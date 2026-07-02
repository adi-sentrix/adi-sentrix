/* === config/contract/validationRules.js · CONTRATO DE DATOS · Paso 3 ===
 * QUÉ DEBE CERRAR. Reglas declarativas con las tolerancias aprobadas por el owner. Cada regla: id, desc, severity y
 * un check(ctx) que devuelve hallazgos. El VALIDADOR (validator.js) las corre según el modo. Observe-first en demo.
 *
 * TOLERANCIAS (owner 2026-07-02):
 *  · llaves/entidades/relaciones/conteos → EXACTO (falta = falla)
 *  · dinero → |Δ| ≤ $1K  O  |Δ|/base ≤ 0.1%   (mixta · el redondeo K/M no rompe)
 *  · porcentajes (margen/carga) → ≤ 0.1 pp
 *  · ratios (DOH/rotación) → ≤ 0.1
 *  · escala sospechosa (saltos 1000×, "K" en string) → advertir
 * SEVERIDAD: blocker (cifra que no cierra · fuente/entidad faltante · escala imposible) · warning (diferencia menor ·
 * cobertura parcial · métrica base-only) · info (limitación declarada, ej. SKU margen base-only fuera de bonanza). */

export const TOLERANCE = {
  money: { absK: 1, absRaw: 1000, rel: 0.001 },   // $1K en la unidad del campo (K→1 · raw→1000) O 0.1% relativo
  pct: 0.1,                                        // puntos porcentuales
  ratio: 0.1,                                      // x / días
};

const _moneyClose = (stored, computed, scale) => {
  const delta = Math.abs((stored || 0) - (computed || 0));
  const abs = scale === "K" ? TOLERANCE.money.absK : TOLERANCE.money.absRaw;
  const rel = computed ? delta / Math.abs(computed) : (delta === 0 ? 0 : 1);
  return { ok: delta <= abs || rel <= TOLERANCE.money.rel, delta, rel };
};
const _pctClose = (a, b) => Math.abs((a || 0) - (b || 0)) <= TOLERANCE.pct;

export const RULES = [
  // ── EXACTO · estructura ──
  {
    id: "sources-exist", severity: "blocker", modes: ["ci", "demo", "prod"],
    desc: "Toda fuente declarada carga y trae filas",
    check: (ctx) => {
      const out = [];
      for (const [name, s] of Object.entries(ctx.SOURCES)) {
        let rows; try { rows = s.load(); } catch (e) { out.push({ where: name, msg: `la fuente no carga: ${e.message}` }); continue; }
        if (!Array.isArray(rows) || rows.length === 0) out.push({ where: name, msg: "la fuente está vacía o no es un array" });
      }
      return out;
    },
  },
  {
    id: "entity-sources-declared", severity: "blocker", modes: ["ci", "demo", "prod"],
    desc: "Toda entidad apunta a una fuente declarada",
    check: (ctx) => Object.entries(ctx.ENTITIES)
      .filter(([, e]) => !ctx.SOURCES[e.source])
      .map(([name, e]) => ({ where: name, msg: `su fuente "${e.source}" no está en sourceManifest` })),
  },
  {
    id: "metric-sources-valid", severity: "blocker", modes: ["ci", "demo", "prod"],
    desc: "Toda métrica × eje apunta a fuente + campo que existen",
    check: (ctx) => {
      const out = [];
      for (const [mName, m] of Object.entries(ctx.METRICS)) {
        for (const [axis, sba] of Object.entries(m.sourceByAxis || {})) {
          const src = ctx.SOURCES[sba.source];
          if (!src) { out.push({ where: `${mName}@${axis}`, msg: `fuente "${sba.source}" inexistente` }); continue; }
          if (!(sba.field in src.schema)) out.push({ where: `${mName}@${axis}`, msg: `campo "${sba.field}" no está en el schema de ${sba.source}` });
        }
      }
      return out;
    },
  },
  {
    id: "relations-resolve", severity: "blocker", modes: ["ci", "demo", "prod"],
    desc: "Las relaciones obligatorias (rollup) resuelven: todo padre referido existe",
    check: (ctx) => {
      const out = [];
      const sku = ctx.load("skusMargen");
      const marcas = new Set((ctx.load("marcasMargen") || []).map((r) => r.nombre));
      const familias = new Set((ctx.load("sfamiliasMargen") || []).map((r) => r.nombre));
      for (const s of sku) {
        if (s.marca && !marcas.has(s.marca)) out.push({ where: `sku ${s.nombre}`, msg: `marca "${s.marca}" no existe como entidad marca` });
        if (s.sfamilia && !familias.has(s.sfamilia)) out.push({ where: `sku ${s.nombre}`, msg: `familia "${s.sfamilia}" no existe como entidad familia` });
      }
      return out;
    },
  },
  // ── DINERO · fórmula-metadata cierra ──
  {
    id: "contribucion-cierra", severity: "blocker", modes: ["ci", "demo", "prod"],   // corre en demo (observe-first REPORTA · no bloquea)
    desc: "La contribución almacenada cierra con venta × margen (tolerancia mixta $1K/0.1%)",
    check: (ctx) => {
      const out = [];
      for (const [src, scale] of [["clientesMargen", "K"], ["skusMargen", "raw"], ["marcasMargen", "K"], ["sfamiliasMargen", "K"]]) {
        for (const r of ctx.load(src)) {
          if (typeof r.venta !== "number" || typeof r.margen !== "number" || typeof r.contribucion !== "number") continue;
          const computed = r.venta * r.margen / 100;
          const { ok, delta, rel } = _moneyClose(r.contribucion, computed, scale);
          if (!ok) out.push({ where: `${src}·${r.nombre}`, msg: `contribución ${r.contribucion} vs venta×margen ${computed.toFixed(1)} (Δ${delta.toFixed(1)} · ${(rel * 100).toFixed(2)}%)` });
        }
      }
      return out;
    },
  },
  {
    id: "margen-cierra", severity: "warning", modes: ["ci", "demo", "prod"],
    desc: "margen ≈ 100 − costo% − carga% (cuando el costo se puede derivar)",
    check: (ctx) => {
      const out = [];
      for (const r of ctx.load("clientesMargen")) {
        if (typeof r.venta !== "number" || typeof r.costo !== "number" || typeof r.margen !== "number") continue;
        const costoPct = r.venta ? r.costo / r.venta * 100 : 0;
        const derivado = 100 - costoPct - (r.pctRebate || 0);
        if (!_pctClose(derivado, r.margen)) out.push({ where: `clientesMargen·${r.nombre}`, msg: `margen ${r.margen}% vs derivado ${derivado.toFixed(1)}% (100−costo%−carga%)` });
      }
      return out;
    },
  },
  // ── ESCALA sospechosa ──
  {
    id: "scale-sanity", severity: "warning", modes: ["ci", "demo", "prod"],
    desc: "Ningún valor monetario salta ~1000× de sus hermanos (mezcla K/M sin declarar)",
    check: (ctx) => {
      const out = [];
      for (const [src, field] of [["clientesMargen", "venta"], ["skusMargen", "venta"], ["skuInventario", "stockUSD"]]) {
        const vals = ctx.load(src).map((r) => r[field]).filter((v) => typeof v === "number" && v > 0).sort((a, b) => a - b);
        if (vals.length < 3) continue;
        const median = vals[Math.floor(vals.length / 2)];
        for (const r of ctx.load(src)) {
          const v = r[field];
          if (typeof v === "number" && v > 0 && (v > median * 500 || v < median / 500))
            out.push({ where: `${src}·${r.nombre || r.sku}`, msg: `${field}=${v} vs mediana ${median} — salto de escala sospechoso` });
        }
      }
      return out;
    },
  },
  // ── INFO · limitaciones declaradas ──
  {
    id: "sku-margen-base-only", severity: "info", modes: ["ci", "demo", "prod"],
    desc: "El margen por SKU es base-only (scenario-blind) · fuera de bonanza lo bloquea el surfaceContract",
    check: (ctx) => (ctx.ENTITIES.sku.scenarioAware === false && ctx.METRICS.margen.scenarioAware.sku === false)
      ? [{ where: "margen@sku", msg: "declarado base-only: skusMargen no tiene transform de escenario (por diseño del demo · se enciende con el ERP)" }]
      : [],
  },
];
