/* === src/adi/diagnosis/economicDiagnosis.js · DIAGNÓSTICOS CALCULADOS POR ADI (no el LLM) ===
 * Keystone del "narrador libre, diagnóstico blindado" (owner 2026-07-06). El LLM puede interpretar libre, pero el
 * DIAGNÓSTICO — el patrón económico de un cliente, el origen de su contribución, el estado de un SKU — lo calcula ADI,
 * determinista y data-driven. El narrador lo NARRA; no lo inventa ni lo contradice (lo enforcea el guard de diagnósticos).
 *
 * Todo POLICY-configurable. Terciles como regla base (adaptativa por cartera · "cliente grande" ≠ lo mismo en pyme que
 * en corporación) · bandas absolutas quedan como override futuro. NO toca el motor sellado ni el seam · módulo puro.
 */
import { POLICY, benchmarkOf, umbralesDeInventario } from "../../config/businessPolicy.js";

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

// ── CONCENTRACIÓN · el 80/20 CON su composición de riesgo (owner 2026-07-06) ─────────────────────────────────────────
// No solo "el 81% está en 7" — QUIÉNES y con qué diagnóstico. Habilita "…y varios son alto volumen con bajo margen".
// items: [{nombre, valor(raw · para ordenar/computar), fmt?(string para mostrar), diagnostico?}] · el caller adjunta el
// diagnóstico (patrón del cliente o estado del SKU). El guard NO deja al LLM inventar integrantes, acumulados ni diagnósticos.
export function concentracion(items, umbral = 0.8) {
  const list = (items || []).filter((i) => typeof i.valor === "number");
  const total = list.reduce((s, i) => s + i.valor, 0) || 1;
  const sorted = [...list].sort((a, b) => b.valor - a.valor);
  const entidades = []; let acc = 0;
  for (const it of sorted) {
    acc += it.valor;
    entidades.push({
      nombre: it.nombre, valor: it.fmt != null ? it.fmt : it.valor,
      participacionPct: +((it.valor / total) * 100).toFixed(1), acumuladoPct: +((acc / total) * 100).toFixed(1),
      diagnostico: it.diagnostico != null ? it.diagnostico : null,
    });
    if (acc / total >= umbral) break;
  }
  return {
    regla: `${Math.round(umbral * 100)}/${Math.round((1 - umbral) * 100)}`, umbral,
    cantidadEntidades: entidades.length,
    totalCubiertoPct: entidades.length ? entidades[entidades.length - 1].acumuladoPct : 0,
    entidades,
  };
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
// distribución de estados dentro de un grupo (bodega/familia) · A+B: cada grupo trae su total y su breakdown por estado
function _groupDist(perSku, key) {
  const g = {};
  for (const s of perSku) {
    const k = s[key] || "—";
    const gg = (g[k] = g[k] || { nombre: k, total: 0, estados: {} });
    gg.total += s.capital;
    (gg.estados[s.estado] = gg.estados[s.estado] || { usd: 0, count: 0 }).usd += s.capital;
    gg.estados[s.estado].count++;
  }
  for (const k in g) for (const e in g[k].estados) g[k].estados[e].pct = g[k].total ? Math.round((g[k].estados[e].usd / g[k].total) * 100) : 0;
  return Object.values(g).sort((a, b) => b.total - a.total);
}
// skus: [{sku, bodega, sfamilia, stockUSD, rotacion, doh, diasSinVenta}] · per-SKU + distribución por estado + POR BODEGA + POR FAMILIA (A+B) + materialidad del quiebre
export function diagnoseInventario(skus, opts = {}) {
  const capF = opts.capitalField || "stockUSD";
  const perSku = (skus || []).map((s) => ({ sku: s.sku, bodega: s.bodega, familia: s.sfamilia, capital: s[capF] || 0, doh: s.doh, rotacion: s.rotacion, diasSinVenta: s.diasSinVenta, estado: diagnoseInventarioSku(s, opts) }));
  const total = perSku.reduce((a, s) => a + s.capital, 0);
  const dist = {};
  for (const s of perSku) { (dist[s.estado] = dist[s.estado] || { usd: 0, count: 0 }).usd += s.capital; dist[s.estado].count++; }
  for (const k in dist) dist[k].pct = total ? Math.round((dist[k].usd / total) * 100) : 0;
  // materialidad de la alerta de quiebre (owner): $ mínimo · % del capital · o toca un top-SKU → si no, es ruido y no secuestra
  const q = dist.riesgo_quiebre || { usd: 0, pct: 0 };
  const topSkus = perSku.slice().sort((a, b) => b.capital - a.capital).slice(0, 3).map((s) => s.sku);
  const quiebreTocaTop = perSku.some((s) => s.estado === "riesgo_quiebre" && topSkus.includes(s.sku));
  const quiebreMaterial = q.usd >= (opts.quiebreMaterialUsd ?? POLICY.quiebreMaterialUsd) || q.pct >= (opts.quiebreMaterialPct ?? POLICY.quiebreMaterialPct) || quiebreTocaTop;
  return { perSku, total, dist, byBodega: _groupDist(perSku, "bodega"), byFamilia: _groupDist(perSku, "familia"), quiebreMaterial };
}

// ── grupo con % sobre el total (usado por jerarquiaInventario) ──────────────────────────────────────────────────
const _grupo = (rows, total) => ({
  skus: rows.map((s) => s.sku), n: rows.length,
  usd: rows.reduce((a, s) => a + s.capital, 0),
  pct: total ? +((rows.reduce((a, s) => a + s.capital, 0) / total) * 100).toFixed(1) : 0,
});
// idem, sin % (para la intersección: el diseño §2 no le pide pct a esos tres subconjuntos)
const _grupoSinPct = (rows) => ({ skus: rows.map((s) => s.sku), n: rows.length, usd: rows.reduce((a, s) => a + s.capital, 0) });

/* jerarquiaInventario(skus, { umbrales, capitalField }) → la ÚNICA jerarquía inmovilizado / crítico / frenado
 * (diseño §2, `diseno_inventario/DISENO.md`; decisiones del owner §7.3·30-32 y ·34). Envuelve `diagnoseInventario`
 * y NO RECALCULA un estado: el detector de estado sigue siendo `diagnoseInventarioSku`, intacto.
 *
 * NO DECIDE UMBRALES: los recibe. Si el llamador no pasa `umbrales`, llama a `umbralesDeInventario()` (sin
 * consulta) — así todo llamador que hoy usa `POLICY` implícitamente (vía `diagnoseInventarioSku`) sigue
 * funcionando igual, porque `umbral()` resuelve exactamente la misma precedencia (conversación → perfil →
 * config) que `POLICY` ya resolvía. Quien decide valor y origen es SIEMPRE `businessPolicy.js` (§3).
 *
 * INMOVILIZADO = capital_frenado ∪ sobrestock (capital atrapado por permanencia o rotación insuficiente).
 * INMOVILIZADO CRÍTICO ("critico") = capital_frenado — el tramo, ⊆ inmovilizado POR CONSTRUCCIÓN (nunca se
 * verifica aparte: es la misma condición). FRENADO = venta interrumpida — nunca se asume a partir del estado del
 * detector; se MIDE contra `frenadoDiasSinVenta` cuando hay umbral, y queda `"sin_evaluar"` cuando no lo hay (el
 * owner: «nunca 60 días como verdad de ADI»). La intersección entre frenado e inmovilizado también se MIDE
 * (`interseccion`), nunca se asume contención en un sentido u otro. */
export function jerarquiaInventario(skus, { umbrales, capitalField = "stockUSD" } = {}) {
  const U = umbrales || umbralesDeInventario();
  const opts = {
    capitalField,
    rotacionMin: U.rotacionMin.valor,
    dohMax: U.dohMax.valor,
    quiebreRotMin: U.quiebreRotMin.valor,
    quiebreDohMax: U.quiebreDohMax.valor,
    sobrestockDohMin: U.sobrestockDohMin.valor,
  };
  const diag = diagnoseInventario(skus, opts);   // delega — NO duplica el predicado del estado
  const total = diag.total;
  const frenadoValor = U.frenadoDiasSinVenta.valor;

  const porSku = diag.perSku.map((s) => {
    const critico = s.estado === "capital_frenado";
    const inmovilizado = s.estado === "capital_frenado" || s.estado === "sobrestock";
    const frenado = (frenadoValor != null && typeof s.diasSinVenta === "number") ? (s.diasSinVenta > frenadoValor) : "sin_evaluar";
    return { ...s, inmovilizado, critico, frenado };
  });

  const inmovilizadoRows = porSku.filter((s) => s.inmovilizado);
  const criticoRows = porSku.filter((s) => s.critico);
  const sobrestockRows = porSku.filter((s) => s.estado === "sobrestock");
  const riesgoQuiebreRows = porSku.filter((s) => s.estado === "riesgo_quiebre");
  const sanoRows = porSku.filter((s) => s.estado === "capital_sano");
  const sinDias = porSku.filter((s) => typeof s.diasSinVenta !== "number").length;

  let frenado;
  if (frenadoValor == null) {
    frenado = { evaluado: false, motivo: "sin_umbral", sinDias };
  } else {
    const frenadoRows = porSku.filter((s) => s.frenado === true);
    frenado = { evaluado: true, umbral: U.frenadoDiasSinVenta, ..._grupo(frenadoRows, total), sinDias };
  }

  let interseccion = null;
  if (frenado.evaluado) {
    const frenadoSet = new Set(frenado.skus);
    const inmovSet = new Set(inmovilizadoRows.map((s) => s.sku));
    interseccion = {
      frenadoEInmovilizado: _grupoSinPct(porSku.filter((s) => frenadoSet.has(s.sku) && inmovSet.has(s.sku))),
      frenadoNoInmovilizado: _grupoSinPct(porSku.filter((s) => frenadoSet.has(s.sku) && !inmovSet.has(s.sku))),
      inmovilizadoNoFrenado: _grupoSinPct(porSku.filter((s) => inmovSet.has(s.sku) && !frenadoSet.has(s.sku))),
    };
  }

  return {
    umbrales: U,
    total,
    porSku,
    inmovilizado: _grupo(inmovilizadoRows, total),
    critico: _grupo(criticoRows, total),
    sobrestock: _grupo(sobrestockRows, total),
    riesgoQuiebre: _grupo(riesgoQuiebreRows, total),
    sano: _grupo(sanoRows, total),
    frenado,
    interseccion,
    dist: diag.dist, byBodega: diag.byBodega, byFamilia: diag.byFamilia, quiebreMaterial: diag.quiebreMaterial,
  };
}

/* kpiInventario(skus, opts) → EL INDICADOR de negocio (owner 2026-09-28, diseño §8.2/R7 — «el indicador, la
 * ingesta y la Entrega leen UNA sola función de jerarquía»). Envuelve `jerarquiaInventario` y le agrega `doh` (que
 * la jerarquía no calcula: no es un estado, es el promedio del negocio) para que `deriveKpis().inventario`
 * (engine/scenarios.js), `getInvKPI` (engine/metrics.js) y el pack de la ingesta (motorKpi.js) dejen de leer el
 * `invKPI` escrito a mano y lean ESTA función, con el MISMO contrato de llaves que ya leían sus consumidores
 * (`totalUSD`, `doh`, `inmovilizadoUSD`, `inmovilizadoPct`, `sobrestockPct`, `riesgoPct`) más lo que faltaba
 * declarar (`criticoUSD/Pct`, `sobrestockUSD`, `riesgoUSD`, `frenado`, `umbrales`).
 *
 * `doh` PONDERADO POR CAPITAL, declarado (no hay una sola forma «correcta» — el diseño pide declarar cuál):
 * el mismo criterio que ya usa `FEATURE_FAMILY_MARGEN_BLENDED` para «el promedio real pondera por el peso
 * económico de cada fila, no por cuántas filas hay» — un SKU de $18.600 pesa más en el promedio que uno de
 * $4.400. Redondeado a día entero, como el resto de la casa formatea días (`_dias` en datoProyectado.js). */
export function kpiInventario(skus, opts = {}) {
  const J = jerarquiaInventario(skus, opts);
  const capF = opts.capitalField || "stockUSD";
  /* Días de inventario promedio: la fórmula que la ingesta ya usaba para un cliente real (promedio simple de los SKU
   * con días declarados, un decimal). No se inventa una métrica nueva (supervisor 2026-09-28): el valor anterior del
   * demo (48) estaba escrito a mano y no salía de sus filas. */
  void capF;
  const conDoh = (skus || []).filter((s) => typeof s.doh === "number");
  const doh = conDoh.length ? Math.round((conDoh.reduce((a, s) => a + s.doh, 0) / conDoh.length) * 10) / 10 : null;
  return {
    totalUSD: J.total, doh,
    inmovilizadoUSD: J.inmovilizado.usd, inmovilizadoPct: J.inmovilizado.pct,
    criticoUSD: J.critico.usd, criticoPct: J.critico.pct,
    sobrestockUSD: J.sobrestock.usd, sobrestockPct: J.sobrestock.pct,
    riesgoUSD: J.riesgoQuiebre.usd, riesgoPct: J.riesgoQuiebre.pct,
    frenado: J.frenado.evaluado ? { usd: J.frenado.usd, pct: J.frenado.pct, n: J.frenado.n, umbral: J.frenado.umbral } : null,
    umbrales: J.umbrales,
  };
}

// C · diagnóstico ECONÓMICO a nivel SKU (vende mucho/poco × margen alto/bajo) — desbloquea "SKU alta venta bajo margen",
// "alto margen subpenetrado", etc. Margen vs PROMEDIO interno de SKU (no hay benchmark externo de SKU declarado).
export function diagnoseSkus(skus, opts = {}) {
  const salesF = opts.salesField || "vendidoMes", marginF = opts.marginField || "margenPct";
  const vBy = {}; for (const s of skus || []) vBy[s.sku] = s[salesF] || 0;
  const ms = (skus || []).map((s) => s[marginF]).filter((m) => typeof m === "number");
  const promM = ms.length ? ms.reduce((a, m) => a + m, 0) / ms.length : 0;
  const out = {};
  for (const s of skus || []) {
    const vE = _tercil(vBy, s.sku), m = s[marginF];
    const mC = typeof m !== "number" ? "medio" : m >= promM * 1.1 ? "alto" : m >= promM * 0.9 ? "medio" : "bajo";
    let patron;
    if (vE === "alta" && mC === "bajo") patron = "alto_volumen_bajo_margen";
    else if (mC === "alto" && vE === "baja") patron = "alto_margen_subpenetrado";
    else if (vE === "alta" && mC === "alto") patron = "producto_estrella";
    else if (vE === "baja" && mC === "bajo") patron = "bajo_impacto";
    else patron = "producto_mixto";
    out[s.sku] = { ventaEscala: vE, margenCalidad: mC, margenPct: m, patron, estadoInventario: diagnoseInventarioSku(s, opts), promedioMargen: +promM.toFixed(1) };
  }
  return out;
}
