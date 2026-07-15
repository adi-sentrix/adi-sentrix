/* === adi/sentrix/mesaCapital.js · MESA DE CONTROL · CARA CAPITAL (owner 2026-07-15: "ok, veamos cómo queda") ===
 * El estado de la SEGUNDA CARA de la Mesa: el mismo sello (entender→explicar→actuar) contando EL CAPITAL —
 * "el inventario está muy pobre en Sentrix y para el cliente es súper relevante" (owner). No es un módulo de dato
 * ([[adi-sentrix-estructura]]): es la misma mesa mirando otro capital, con los detectores de INVENTARIO existentes.
 *   - mapa: la tira de flujo del capital — los 4 estados del MOTOR (diagnoseInventario · POLICY 2x/120d · una
 *     verdad con el composer de inventario y el detector del diagnose) · los tramos SUMAN EXACTO el total.
 *   - kpis: capital total · detenido · quiebres próximos · rotación media — semáforo del dato (cero umbral nuevo).
 *   - focos: por qué pasa, con su $ (detenido · quiebre próximo · sobrestock — la dist del motor).
 *   - reponer/liquidar: QUÉ HACER PRIMERO en dos listas — quiebre próximo con venta alta (join real con skusMargen,
 *     mismo cruce del top_sellers) · detenido por capital (items del detector).
 *   - simulaciones: "¿y si libero…?" (el composer de simulate YA cuantifica) · "¿y si repongo…?" honesto (la
 *     reposición no se cuantifica en este pase — la línea pregunta y ADI responde con lo probado; venta-en-riesgo
 *     es pase 2, toca motor).
 *   - alertas: la pata de inventario del "En alerta" (SKU críticos · $ detenido).
 *   - "Qué cambió" NO existe acá: sin historial de stock no se fabrica (el bloque no aparece — honesto).
 * + buildCuadroCapital: la tabla HERMANA del cuadro (la de ventas NO se toca) — eje SKU/bodega con columnas
 *   clásicas legibles (Stock · Capital · Rotación · DOH · Estado vs benchmark · "En juego $" · Acción), microlectura
 *   solo con señal del detector, chip Acción con su pregunta. Comparado de 12 meses NO: no existe serie mensual de
 *   stock por SKU y la serie de venta NO la sustituye en silencio.
 * Cada tramo, KPI, foco, línea y chip lleva su PREGUNTA a ADI (anti-BI: nada mudo) — todas por _promise_gate.
 * Registro EJECUTIVO y lenguaje formal en todo texto emitido (_registro_gate · benchmark, no vara).
 * Puro · client-side · CERO cálculo nuevo (agrupar y formatear lo que el motor ya afirma) · motor sellado intacto. */
import { applyScenarioToSkuInventario } from "../../engine/scenarios.js";
import { diagnoseInventario } from "../diagnosis/economicDiagnosis.js";
import { skusMargen } from "../../data/skusMargen.js";
import { POLICY } from "../../config/businessPolicy.js";

const _r1 = (n) => Math.round(n * 10) / 10;
const _mean = (a, f) => (a.length ? a.reduce((s, x) => s + (typeof f(x) === "number" ? f(x) : 0), 0) / a.length : 0);
const _money = (v) => {
  const a = Math.abs(v), s = v < 0 ? "-" : "";
  if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${s}$${Math.round(a / 1e3)}K`;
  return `${s}$${Math.round(a)}`;
};

// ── LOS 4 ESTADOS DEL MOTOR · label legible + color + su pregunta (todas gate-proven · la pregunta es del ESTADO,
// no de la fila: el composer de inventario responde la punta completa — ahí vive la historia) ──
export const CAPITAL_ESTADOS = {
  capital_sano:    { label: "en rango",        color: "green", ask: "Ver todo el inventario",
    def: "Rota dentro de tu benchmark (rotación sobre " + POLICY.rotacionMin + "x y cobertura bajo " + POLICY.dohMax + " días) — capital trabajando." },
  riesgo_quiebre:  { label: "quiebre próximo", color: "red",   ask: "¿Qué reponer por quiebre?",
    def: "Rota rápido (" + POLICY.quiebreRotMin + "x o más) con cobertura corta (" + POLICY.quiebreDohMax + " días o menos): el stock no alcanza hasta la próxima compra." },
  sobrestock:      { label: "sobrestock",      color: "cyan",  ask: "¿Dónde sobra inventario?",
    def: "Vende, pero con cobertura excesiva (entre " + POLICY.sobrestockDohMin + " y " + POLICY.dohMax + " días): capital inmovilizado de más." },
  capital_frenado: { label: "detenido",        color: "amber", ask: "¿Dónde está detenido mi capital?",
    def: "Sin rotación según tu benchmark (rotación bajo " + POLICY.rotacionMin + "x o cobertura sobre " + POLICY.dohMax + " días): capital que no trabaja." },
};
const _ORDEN = ["capital_sano", "riesgo_quiebre", "sobrestock", "capital_frenado"];
const _RANK = { capital_frenado: 0, riesgo_quiebre: 1, sobrestock: 2, capital_sano: 3 };

// el diagnóstico del motor + el join con la alerta del dato (crítico) · la ÚNICA entrada de todo el módulo
function _diag(scenario) {
  const inv = applyScenarioToSkuInventario(scenario || "bonanza") || [];
  const D = diagnoseInventario(inv, {});
  const bySku = {}; for (const r of inv) bySku[r.sku] = r;
  return { inv, D, bySku };
}

/* buildMesaCapital(scenario) → { kpis, mapa, focos, reponer, liquidar, simulaciones, alertas } · todo formateado */
export function buildMesaCapital(scenario) {
  const { inv, D, bySku } = _diag(scenario);
  const dist = (e) => D.dist[e] || { usd: 0, count: 0, pct: 0 };
  const frenado = dist("capital_frenado"), quiebre = dist("riesgo_quiebre"), sobre = dist("sobrestock"), sano = dist("capital_sano");
  const criticos = D.perSku.filter((s) => s.estado === "capital_frenado" && bySku[s.sku] && bySku[s.sku].alerta === "crit").length;
  const rotMedia = _r1(_mean(inv, (r) => r.rotacion));

  // ── EL MAPA DEL CAPITAL · la tira de flujo (los tramos del motor suman EXACTO el total — el gate lo verifica) ──
  const tramos = _ORDEN.filter((e) => dist(e).usd > 0).map((e) => ({
    key: e, label: CAPITAL_ESTADOS[e].label, color: CAPITAL_ESTADOS[e].color,
    usd: dist(e).usd, usdFmt: _money(dist(e).usd), n: dist(e).count,
    pct: D.total ? (dist(e).usd / D.total) * 100 : 0,
    ask: CAPITAL_ESTADOS[e].ask, def: CAPITAL_ESTADOS[e].def,
  }));
  const _frase = { capital_sano: "trabajan en rango", riesgo_quiebre: "con quiebre próximo", sobrestock: "en sobrestock", capital_frenado: "detenidos" };
  const lectura = `De tus ${_money(D.total)} en inventario: ${tramos.map((t) => `${t.usdFmt} ${_frase[t.key]}`).join(" · ")}.`;
  const mapa = { totalUsd: D.total, totalFmt: _money(D.total), lectura, tramos };

  // ── KPIs DE LA CARA · semáforo del dato (los estados del motor — cero umbral nuevo) + su pregunta ──
  const kpis = [
    { key: "capital", label: "Capital total", value: _money(D.total),
      estado: !frenado.usd ? "verde" : criticos ? "rojo" : "ambar",
      linea: `${sano.pct}% en rango · ${inv.length} SKU en ${[...new Set(inv.map((r) => r.bodega))].length} bodegas`,
      ask: "Ver todo el inventario" },
    { key: "detenido", label: "Capital detenido", value: _money(frenado.usd),
      estado: !frenado.usd ? "verde" : criticos ? "rojo" : "ambar",
      linea: frenado.usd ? `${frenado.count} SKU sin rotación${criticos ? ` · ${criticos} crítico${criticos > 1 ? "s" : ""}` : ""}` : "sin capital detenido material",
      ask: frenado.usd ? "¿Dónde está detenido mi capital?" : "Ver todo el inventario" },
    { key: "quiebres", label: "Quiebres próximos", value: `${quiebre.count} SKU`,
      estado: !quiebre.count ? "verde" : D.quiebreMaterial ? "rojo" : "ambar",
      linea: quiebre.count ? `${_money(quiebre.usd)} rotan rápido con cobertura corta` : "sin quiebres a la vista",
      ask: quiebre.count ? "¿Qué reponer por quiebre?" : "Ver todo el inventario" },
    // la ask cuenta LO MISMO que la línea (auditoría de asks 2026-07-15: preguntaba los SKU sin venta +90d —
    // 2 SKU/$22K — mientras la línea habla del criterio de DETENCIÓN — 3 SKU/$33K: dos cifras para un click)
    { key: "rotacion", label: "Rotación media", value: `${rotMedia}x`,
      estado: rotMedia >= POLICY.rotacionMin ? "verde" : "rojo",
      linea: `benchmark ${POLICY.rotacionMin}x — por debajo, el capital se considera detenido`,
      ask: frenado.usd ? "¿Dónde está detenido mi capital?" : "Ver todo el inventario" },
  ];

  // ── 02 · POR QUÉ PASA · los focos de capital con su $ (la dist del motor · solo los materiales) ──
  const focos = [];
  if (frenado.usd) focos.push({ key: "detenido", usdFmt: _money(frenado.usd), label: `detenido en ${frenado.count} SKU sin rotación`, ask: "Por qué el capital está detenido" });
  if (quiebre.usd) focos.push({ key: "quiebre", usdFmt: _money(quiebre.usd), label: `en ${quiebre.count} SKU con quiebre próximo`, ask: "¿Qué reponer por quiebre?" });
  if (sobre.usd) focos.push({ key: "sobrestock", usdFmt: _money(sobre.usd), label: `en sobrestock · cobertura excesiva`, ask: "¿Dónde sobra inventario?" });

  // ── 03 · QUÉ REPONGO / QUÉ LIQUIDO · dos listas accionables (los mismos cruces del motor/composer) ──
  const ventaBy = {}; for (const s of skusMargen) ventaBy[s.nombre] = s.venta;   // venta anual $K (join real · el del top_sellers)
  const reponer = {
    titulo: "Qué repongo",
    items: D.perSku.filter((s) => s.estado === "riesgo_quiebre")
      .map((s) => ({ sku: s.sku, ventaK: ventaBy[s.sku] || 0, doh: s.doh, rotacion: s.rotacion }))
      .sort((a, b) => b.ventaK - a.ventaK).slice(0, 4)
      .map((s) => ({ sku: s.sku, usdFmt: _money(s.ventaK * 1000),
        linea: `vende ${_money(s.ventaK * 1000)} al año · ${Math.round(s.doh)}d de cobertura`,
        ask: `Profundiza en ${s.sku}` })),
    ask: "¿Qué reponer por quiebre?",
  };
  const liquidar = {
    titulo: "Qué liquido",
    items: D.perSku.filter((s) => s.estado === "capital_frenado")
      .sort((a, b) => b.capital - a.capital).slice(0, 4)
      .map((s) => ({ sku: s.sku, usdFmt: _money(s.capital),
        linea: `${_money(s.capital)} detenidos${typeof s.diasSinVenta === "number" && s.diasSinVenta > 0 ? ` · sin venta hace ${s.diasSinVenta}d` : ""}${bySku[s.sku] && bySku[s.sku].alerta === "crit" ? " · crítico" : ""}`,
        ask: `¿Cómo libero el capital de ${s.sku}?` })),
    ask: "¿Qué SKU libero primero?",
  };

  // ── ¿Y SI…? · supuestos accionables (liberar YA lo cuantifica el composer de simulate · reponer es honesto:
  // la reposición no se proyecta en este pase — la pregunta abre lo probado del motor) ──
  const simulaciones = [];
  if (frenado.usd) simulaciones.push({
    key: "liberar", delta: _money(frenado.usd),
    texto: `Si liberás el capital detenido, ${_money(frenado.usd)} de caja vuelven a trabajar.`,
    ask: "¿Qué pasa si libero el capital detenido?",
  });
  if (quiebre.count) simulaciones.push({
    key: "reponer", delta: _money(quiebre.usd),
    texto: quiebre.count === 1
      ? `Si reponés a tiempo, el SKU con quiebre próximo (${_money(quiebre.usd)}) no corta su venta.`
      : `Si reponés a tiempo, los ${quiebre.count} SKU con quiebre próximo (${_money(quiebre.usd)}) no cortan su venta.`,
    ask: "¿Qué reponer por quiebre?",
  });

  // ── EN ALERTA · la pata de inventario (SKU críticos · $ detenido) — para la tira compartida de la Mesa ──
  const alertas = {
    n: criticos, usd: frenado.usd, usdFmt: _money(frenado.usd),
    linea: criticos
      ? `${criticos} SKU crítico${criticos > 1 ? "s" : ""} · ${_money(frenado.usd)} de capital detenido`
      : frenado.usd ? `${_money(frenado.usd)} de capital detenido · sin SKU críticos` : "Capital rotando en rango — sin alertas de inventario.",
    ask: frenado.usd ? "¿Dónde está detenido mi capital?" : "Ver todo el inventario",
  };

  return { kpis, mapa, focos, reponer, liquidar, simulaciones, alertas };
}

/* ── CUADRO DE CAPITAL · la tabla hermana (eje SKU/bodega · columnas clásicas legibles · el cuadro de ventas NO
 * se toca) — mismo patrón del cuadro comercial: Estado = el semáforo del MOTOR contra POLICY (2x/120d), "En juego $"
 * = el capital detenido que el detector afirma de esa fila, microlectura SOLO con señal, chip Acción con su pregunta.
 * SIN comparado de 12 meses: no existe serie mensual de stock por SKU (la serie de venta NO la sustituye). ── */
export const CUADRO_CAPITAL_EJES = [
  { key: "sku",    label: "SKU",     plural: "SKUs" },
  { key: "bodega", label: "Bodegas", plural: "bodegas" },
];
const COLS_CAPITAL = {
  sku: [
    { key: "stock", label: "Stock", fmt: "int", sort: "desc" },
    { key: "capital", label: "Capital", fmt: "moneyk", sort: "desc", defKey: "Capital" },
    { key: "rotacion", label: "Rotación", fmt: "x", sort: "desc", defKey: "Rotación" },
    { key: "doh", label: "DOH", fmt: "d", sort: "asc", defKey: "DOH" },
    { key: "estado", label: "Estado", fmt: "estado" },
    { key: "enJuego", label: "En juego $", fmt: "usd", sort: "desc", adv: true },
    { key: "accion", label: "Acción", fmt: "accion" },
  ],
  bodega: [
    { key: "stock", label: "Stock", fmt: "int", sort: "desc" },
    { key: "capital", label: "Capital", fmt: "moneyk", sort: "desc", defKey: "Capital" },
    { key: "rotacion", label: "Rotación", fmt: "x", sort: "desc", defKey: "Rotación" },
    { key: "criticos", label: "SKU crít.", fmt: "int", sort: "asc" },
    { key: "estado", label: "Estado", fmt: "estado" },
    { key: "enJuego", label: "En juego $", fmt: "usd", sort: "desc", adv: true },
    { key: "accion", label: "Acción", fmt: "accion" },
  ],
};

export function buildCuadroCapital(eje = "sku", scenario = "bonanza") {
  const { inv, D, bySku } = _diag(scenario);
  const estadoDe = {}; for (const s of D.perSku) estadoDe[s.sku] = s;
  let rows;
  if (eje === "bodega") {
    const names = [...new Set(inv.map((r) => r.bodega))];
    rows = names.map((b) => {
      const rs = inv.filter((r) => r.bodega === b);
      const det = rs.filter((r) => estadoDe[r.sku].estado === "capital_frenado");
      const detUsd = det.reduce((a, r) => a + r.stockUSD, 0);
      const crit = rs.filter((r) => r.alerta === "crit").length;
      const est = crit ? "capital_frenado" : detUsd ? "capital_frenado" : "capital_sano";
      return {
        name: b, stock: rs.reduce((a, r) => a + r.stockUnd, 0), capital: rs.reduce((a, r) => a + r.stockUSD, 0),
        rotacion: _r1(_mean(rs, (r) => r.rotacion)), criticos: crit,
        estado: est, estadoRank: crit ? 0 : detUsd ? 1 : 3,
        estadoLabel: crit ? `${crit} SKU crítico${crit > 1 ? "s" : ""}` : detUsd ? "capital detenido" : "en rango",
        estadoColor: crit ? "red" : detUsd ? "amber" : "green",
        enJuego: detUsd || null, alert: crit > 0 || detUsd > 0,
        lectura: detUsd ? `${_money(detUsd)} detenidos en ${det.length} SKU sin rotación${crit ? ` · ${crit} crítico${crit > 1 ? "s" : ""}` : ""}` : null,
        accion: detUsd ? "liquidar lento" : "sostener",
        accionAsk: detUsd ? `¿Cómo libero el capital detenido en ${b}?` : `¿Cuánto capital tengo en ${b}?`,
      };
    });
  } else {
    rows = inv.map((r) => {
      const s = estadoDe[r.sku], E = CAPITAL_ESTADOS[s.estado];
      const detenido = s.estado === "capital_frenado";
      const quiebre = s.estado === "riesgo_quiebre";
      return {
        name: r.sku, stock: r.stockUnd, capital: r.stockUSD, rotacion: _r1(r.rotacion), doh: Math.round(r.doh),
        estado: s.estado, estadoRank: _RANK[s.estado], estadoLabel: E.label, estadoColor: E.color,
        enJuego: detenido ? r.stockUSD : null, alert: detenido || quiebre,
        lectura: detenido
          ? `${_money(r.stockUSD)} detenidos${r.bodega ? ` en ${r.bodega}` : ""} · rotación ${_r1(r.rotacion)}x · ${Math.round(r.doh)}d de cobertura${typeof r.diasSinVenta === "number" && r.diasSinVenta > 0 ? ` · sin venta hace ${r.diasSinVenta}d` : ""}${r.alerta === "crit" ? " · crítico" : ""}`
          : quiebre ? `Rota ${_r1(r.rotacion)}x con ${Math.round(r.doh)}d de cobertura — reposición antes del corte` : null,
        accion: detenido ? "liquidar" : quiebre ? "reponer" : s.estado === "sobrestock" ? "frenar compra" : "sostener",
        accionAsk: detenido ? `¿Cómo libero el capital de ${r.sku}?`
          : quiebre ? "¿Qué reponer por quiebre?"
          : s.estado === "sobrestock" ? "¿Dónde sobra inventario?"
          : `Profundiza en ${r.sku}`,
      };
    });
  }
  const tCap = rows.reduce((a, r) => a + r.capital, 0), tEJ = rows.reduce((a, r) => a + (r.enJuego || 0), 0);
  const total = { name: "Total", stock: rows.reduce((a, r) => a + r.stock, 0), capital: tCap,
    rotacion: _r1(_mean(inv, (r) => r.rotacion)), criticos: eje === "bodega" ? rows.reduce((a, r) => a + r.criticos, 0) : null,
    doh: null, estado: null, enJuego: tEJ || null, accion: "", _total: true };
  const meta = CUADRO_CAPITAL_EJES.find((d) => d.key === eje) || CUADRO_CAPITAL_EJES[0];
  return { eje, label: meta.label, plural: meta.plural, columns: COLS_CAPITAL[eje] || COLS_CAPITAL.sku, rows, total, n: rows.length, rotacionMedia: _r1(_mean(inv, (r) => r.rotacion)) };
}
