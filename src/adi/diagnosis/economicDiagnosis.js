/* === src/adi/diagnosis/economicDiagnosis.js · DIAGNÓSTICOS CALCULADOS POR ADI (no el LLM) ===
 * Keystone del "narrador libre, diagnóstico blindado" (owner 2026-07-06). El LLM puede interpretar libre, pero el
 * DIAGNÓSTICO — el patrón económico de un cliente, el origen de su contribución, el estado de un SKU — lo calcula ADI,
 * determinista y data-driven. El narrador lo NARRA; no lo inventa ni lo contradice (lo enforcea el guard de diagnósticos).
 *
 * Todo POLICY-configurable. Terciles como regla base (adaptativa por cartera · "cliente grande" ≠ lo mismo en pyme que
 * en corporación) · bandas absolutas quedan como override futuro. NO toca el motor sellado ni el seam · módulo puro.
 */
import { POLICY, benchmarkOf } from "../../config/businessPolicy.js";

// ── helpers ──────────────────────────────────────────────────────────────────────────────────────────────────────
// tercil por ranking: posición → alta/media/baja (top 1/3 · medio · bajo 1/3). Adaptativo a la cartera.
function _tercil(valByName, name) {
  const N = Object.keys(valByName).length;
  const rank = Object.keys(valByName).filter((k) => valByName[k] > valByName[name]).length + 1;   // 1 = mayor
  if (rank <= N / 3) return "alta";
  if (rank <= (2 * N) / 3) return "media";
  return "baja";
}
const _rank = (valByName, name) => Object.keys(valByName).filter((k) => valByName[k] > valByName[name]).length + 1;
const _score = (lvl) => (lvl === "alta" || lvl === "alto" ? 3 : lvl === "media" || lvl === "medio" ? 2 : 1);

// margenCalidad · juicio económico graduado vs promedio INTERNO + benchmark DECLARADO (veredicto B · owner)
function _margenCalidad(m, prom, bench) {
  if (typeof m !== "number") return "medio";
  if (m >= bench) return "alto";
  if (m >= prom) return "medio";
  return "bajo";
}
// patrón · árbol de PRIORIDAD (6 patrones · owner). NO es 1:1 con los 3 ejes: clasifica en arquetipos accionables.
function _patron(vE, mC, cI) {
  if (vE === "alta" && mC === "alto" && cI === "alta") return "cliente_estrella";
  if (vE === "alta" && mC === "bajo") return "alto_volumen_bajo_margen";
  if (mC === "alto" && cI === "baja") return "buen_margen_baja_contribucion";
  if (vE === "baja" && mC === "bajo" && cI === "baja") return "bajo_impacto_baja_calidad";
  if ((mC === "alto" || mC === "medio") && vE !== "alta" && cI !== "alta") return "cuenta_sana_para_escalar";
  return "volumen_medio_margen_presionado";   // fallback accionable (owner rename de perfil_mixto)
}
// origenContribucion · qué eje pesa más (de dónde viene la plata): volumen / calidad / mix / bajo impacto
function _origen(vE, mC) {
  const vs = _score(vE), ms = _score(mC);
  if (vs === 1 && ms === 1) return "bajo_impacto";
  if (vs > ms) return "volumen";
  if (ms > vs) return "calidad";
  return "mix_balanceado";
}
const _ETIQUETA = {
  cliente_estrella: "cuenta estrella",
  alto_volumen_bajo_margen: "volumen grande con bajo margen",
  buen_margen_baja_contribucion: "buen margen pero poca contribución",
  bajo_impacto_baja_calidad: "bajo impacto y baja calidad",
  cuenta_sana_para_escalar: "cuenta sana para escalar",
  volumen_medio_margen_presionado: "volumen medio con margen presionado",
};

// ── CLIENTE · diagnosticoEconomico (compartido por ventas/margen/contribución · UNA verdad por cliente) ──────────────
// ventasRows: [{nombre, actual}] (ventas) · margenRows: [{nombre, margen, contribucion, benchmark?}]
export function diagnoseClientes(ventasRows, margenRows, opts = {}) {
  const vBy = {}, cBy = {}, mBy = {};
  for (const r of ventasRows || []) vBy[r.nombre] = r.actual;
  for (const r of margenRows || []) { cBy[r.nombre] = r.contribucion; mBy[r.nombre] = r.margen; }
  const N = (margenRows || []).length || 1;
  const prom = +((margenRows || []).reduce((s, r) => s + (r.margen || 0), 0) / N).toFixed(1);
  const out = {};
  for (const r of margenRows || []) {
    const name = r.nombre, bench = benchmarkOf(r);   // el dato manda · POLICY es el piso
    const vE = _tercil(vBy, name), mC = _margenCalidad(mBy[name], prom, bench), cI = _tercil(cBy, name);
    const patron = _patron(vE, mC, cI);
    const rV = _rank(vBy, name), rM = _rank(mBy, name);
    out[name] = {
      ventasEscala: vE, margenCalidad: mC, contribucionImpacto: cI,
      patron, origenContribucion: _origen(vE, mC), etiquetaNarrativa: _ETIQUETA[patron],
      razon: `Cliente #${rV} en ventas, pero #${rM} de ${N} por margen.`,
      ventasRank: rV, margenRank: rM, totalClientes: N, promedioMargen: prom, benchmark: bench,
    };
  }
  return out;
}

// ── INVENTARIO · diagnosticoInventario (las DOS puntas: sobra y falta) ───────────────────────────────────────────────
export function diagnoseInventarioSku(s, opts = {}) {
  const rotMin = opts.rotacionMin ?? POLICY.rotacionMin, dohMax = opts.dohMax ?? POLICY.dohMax;
  const qRot = opts.quiebreRotMin ?? POLICY.quiebreRotMin, qDoh = opts.quiebreDohMax ?? POLICY.quiebreDohMax;
  const soDoh = opts.sobrestockDohMin ?? POLICY.sobrestockDohMin;
  const rot = s.rotacion, doh = s.doh;
  if ((typeof rot === "number" && rot < rotMin) || (typeof doh === "number" && doh > dohMax)) return "capital_frenado"; // dormido = ata caja
  if (typeof rot === "number" && rot >= qRot && typeof doh === "number" && doh <= qDoh) return "riesgo_quiebre";        // rota rápido, poca cobertura = corta venta
  if (typeof doh === "number" && doh >= soDoh && doh <= dohMax) return "sobrestock";                                   // vende, pero cobertura excesiva
  return "capital_sano";
}
// skus: [{sku, bodega, stockUSD, rotacion, doh, diasSinVenta}] · devuelve per-SKU + distribución + materialidad del quiebre
export function diagnoseInventario(skus, opts = {}) {
  const capF = opts.capitalField || "stockUSD";
  const perSku = (skus || []).map((s) => ({ sku: s.sku, bodega: s.bodega, capital: s[capF] || 0, doh: s.doh, rotacion: s.rotacion, estado: diagnoseInventarioSku(s, opts) }));
  const total = perSku.reduce((a, s) => a + s.capital, 0);
  const dist = {};
  for (const s of perSku) { (dist[s.estado] = dist[s.estado] || { usd: 0, count: 0 }).usd += s.capital; dist[s.estado].count++; }
  for (const k in dist) dist[k].pct = total ? Math.round((dist[k].usd / total) * 100) : 0;
  // materialidad de la alerta de quiebre (owner): $ mínimo · % del capital · o toca un top-SKU → si no, es ruido y no secuestra
  const q = dist.riesgo_quiebre || { usd: 0, pct: 0 };
  const topSkus = perSku.slice().sort((a, b) => b.capital - a.capital).slice(0, 3).map((s) => s.sku);
  const quiebreTocaTop = perSku.some((s) => s.estado === "riesgo_quiebre" && topSkus.includes(s.sku));
  const quiebreMaterial = q.usd >= (opts.quiebreMaterialUsd ?? POLICY.quiebreMaterialUsd) || q.pct >= (opts.quiebreMaterialPct ?? POLICY.quiebreMaterialPct) || quiebreTocaTop;
  return { perSku, total, dist, quiebreMaterial };
}
