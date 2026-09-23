/* === _verificador_crudo_gate.mjs · EL CANDADO DEL ARREGLO DEL VERIFICADOR (owner 2026-09-23, offline) ═══════════
 * Arreglo aprobado por el owner: `notario/evidencia.js` caía a un fallback cuando `fig.raw` no era finito —
 * reparseaba `fig.value` (el TEXTO ya redondeado para mostrar, «$12.6M») como si fuera el crudo, y ese número
 * terminaba usado como operando EXACTO de una razón (una participación). Caso real: la participación de Lider
 * en el vencido, sobre el escenario canónico (bonanza), daba 36.1% en vez de 36.254% → 36.3%.
 *
 * LO QUE ESTE GATE EXIGE, con evidencia real del tenant demo (bonanza — ESCENARIO_INICIAL, el dato real):
 *   1 · las FUENTES entregan su crudo: `mesaFlujo.js` publica `total` en las dos ramas (planilla y sin planilla) ·
 *       `cobranza()` nunca pasa `raw: NaN` cuando las filas alcanzan para sumarlo.
 *   2 · EL CASO REAL: Lider, bajo bonanza, participa el 36.3% del saldo vencido (exacto a la precisión impresa) —
 *       antes del arreglo daba 36.1%.
 *   3 · LA TASA DE RECUPERACIÓN (recuperado = abonado ÷ venta a crédito, ley canónica del owner) tiene crudo
 *       genuino en las cuatro cifras que la componen.
 *   4 · CARNADA · una razón con un operando SIN crudo (`evidencia.js` reparseó el texto) sale «no-verificable»,
 *       NUNCA un cociente calculado sobre el texto.
 *   5 · CARNADA · el fallback de reparseo NUNCA produce la procedencia «medido» (el equivalente, en el libro de
 *       hechos, de la etiqueta «literal» que `evidencia.js` NO debe estampar sobre una reconstrucción).
 *   6 · CONTROL NEGATIVO · comprobar que el modelo repitió una cifra impresa SIGUE verificando (leer el texto para
 *       cotejarlo es legítimo; la carnada 4 solo cierra USARLO como operando de una cuenta nueva).
 *   7 · CONTROL NEGATIVO · una razón entre dos figs con crudo genuino sigue verificando (el candado no apaga lo
 *       que sí funciona).
 *
 * CERO llamadas a un LLM: todo determinístico, sobre datos del tenant demo. Solo por `npm run gates:offline` (o
 * `node --import ./scripts/offline-guard.mjs _verificador_crudo_gate.mjs`). */
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { ESCENARIO_INICIAL } from "./src/config/scenarios.js";
import { buildMesaFlujo } from "./src/adi/sentrix/mesaFlujo.js";
import { TOOLS } from "./src/adi/oracle/toolRegistry.js";
import { cajaDelAgente } from "./src/adi/agente/herramientasAgente.js";
import { cifrasDelDato } from "./src/adi/oracle/datoProyectado.js";
import { axisEntityNames } from "./src/adi/oracle/entityIndex.js";
import { runPlan } from "./src/adi/oracle/toolRunner.js";
import { indiceDeEvidencia } from "./src/adi/notario/evidencia.js";
import { libroDeHechos, asignarIds } from "./src/adi/notario/hechos.js";

let pass = 0, fail = 0;
const ok = (c, m, extra = "") => { if (c) { pass++; console.log("  ✓ " + m); } else { fail++; console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };
const H = (t) => console.log(`\n${t}`);

initTenant(TENANT_DEMO);
ok(ESCENARIO_INICIAL === "bonanza", "el escenario canónico sigue siendo «bonanza» (medir sobre otro escenario no es medir el dato real)");

const CAJA = cajaDelAgente(TOOLS);
const DATO = cifrasDelDato(ESCENARIO_INICIAL);
const ejes = {};
for (const e of ["cliente", "sku", "marca", "familia", "bodega", "canal"]) { try { const n = axisEntityNames(e); if (n && n.length) ejes[e] = n; } catch { /* sin índice */ } }

const figsDeCall = (tool, args, pregunta) => {
  const rp = runPlan({ intent: "answer", calls: [{ tool, args }] }, { scenario: ESCENARIO_INICIAL, maxCalls: 18, preguntaUsuario: pregunta, registry: CAJA });
  return asignarIds((rp.ledger && rp.ledger.figs) || []);
};
const indiceDe = (figs) => indiceDeEvidencia({ figs, datoProyectado: DATO, ejesDelTenant: ejes });

/* ═══ 1 · LAS FUENTES ENTREGAN SU CRUDO ═══ */
H("1 · las fuentes entregan su crudo (mesaFlujo.js + herramientasAgente.js:cobranza)");
{
  const M = buildMesaFlujo(ESCENARIO_INICIAL);
  ok(!!M && M.origen !== "planilla", "el tenant demo (bonanza) corre la rama SIN planilla de mesaFlujo.js — la que estaba rota");
  ok(!!M.total && Number.isFinite(M.total.ventaK) && Number.isFinite(M.total.abonadoK) && Number.isFinite(M.total.saldoK) && Number.isFinite(M.total.vencidoK),
    "buildMesaFlujo (rama sin planilla) publica `total` con las cuatro cifras, ADITIVO a lo que ya había", JSON.stringify(M.total));
  const sumaVencido = M.filas.reduce((s, f) => s + (Number.isFinite(f.vencidoK) ? f.vencidoK : 0), 0);
  ok(Math.abs(M.total.vencidoK - sumaVencido) < 0.01, "`total.vencidoK` es EXACTAMENTE la suma de las filas (12.556,3K), no el redondeo de pantalla (12.600K)", `total=${M.total.vencidoK} suma=${sumaVencido}`);

  const figsCobranza = figsDeCall("cobranza", {}, "¿quién me debe más?");
  for (const label of ["Venta del período (flujo)", "Abonado · total", "Saldo pendiente · total", "Saldo vencido · total"]) {
    const f = figsCobranza.find((x) => x.label === label);
    ok(!!f && Number.isFinite(f.raw), `cobranza() publica «${label}» con raw finito (antes: NaN)`, f ? `raw=${f.raw}` : "fig ausente");
  }
}

/* ═══ 2 · EL CASO REAL — Lider, bajo bonanza, 36.3% del vencido ═══ */
H("2 · el caso real — participación de Lider en el saldo vencido, bonanza");
{
  const figs = figsDeCall("cobranza", {}, "¿quién me debe más?");
  const I = indiceDe(figs);
  const libro = libroDeHechos([
    { id: "h1", tipo: "razon", num: { sujeto: "Lider", metrica: "Saldo vencido" }, den: { sujeto: "negocio", metrica: "Saldo vencido" }, valor: "36.3%" },
  ], { indice: I });
  const h1 = libro.hechos[0];
  ok(h1.veredicto === "verdadera", "«Lider participa el 36.3% del saldo vencido» verifica VERDADERA (antes del arreglo el crudo real daba 36.1%)", JSON.stringify({ veredicto: h1.veredicto, motivo: h1.motivo }));

  const libroFalso = libroDeHechos([
    { id: "h1", tipo: "razon", num: { sujeto: "Lider", metrica: "Saldo vencido" }, den: { sujeto: "negocio", metrica: "Saldo vencido" }, valor: "36.1%" },
  ], { indice: I });
  ok(libroFalso.hechos[0].veredicto === "falsa", "★ CONTROL · «36.1%» (el número que el reparseo producía) ahora sale FALSA — 36.3% es lo único que verifica", JSON.stringify(libroFalso.hechos[0]));
}

/* ═══ 3 · LA TASA DE RECUPERACIÓN (abonado ÷ venta a crédito) ═══ */
H("3 · la tasa de recuperación — ley canónica del owner, con crudo genuino");
{
  const figs = figsDeCall("cobranza", {}, "¿cuánto me han pagado mis clientes?");
  const venta = figs.find((f) => f.label === "Venta del período (flujo)");
  const abonado = figs.find((f) => f.label === "Abonado · total");
  ok(!!venta && !!abonado && Number.isFinite(venta.raw) && Number.isFinite(abonado.raw), "venta y abonado (los dos operandos de la tasa) tienen crudo genuino");
  const I = indiceDe(figs);
  // por ID, no por (sujeto, métrica): «Venta» del negocio es AMBIGUA en el índice completo —convive con «Ventas
  // totales», la cifra KPI autoritativa que evidencia.js inyecta siempre (ver specRetrieval.js, el ~0.1% que el
  // dataset arrastra entre `ventasKPI` y Σ`clientesVentas`)— y esa ambigüedad es preexistente, no parte de este
  // arreglo. Citar por id apunta exactamente a las dos cifras que cobranza() acaba de publicar.
  const libro = libroDeHechos([
    { id: "h1", tipo: "razon", num: { id: abonado.id }, den: { id: venta.id }, valor: "58.8%" },
  ], { indice: I });
  ok(libro.hechos[0].veredicto === "verdadera", "recuperado = abonado ÷ venta a crédito = 58.8% verifica VERDADERA sobre crudo genuino", JSON.stringify(libro.hechos[0]));
}

/* ═══ 4 · CARNADA — operando sin crudo en una razón → no-verificable, nunca un cociente ═══ */
H("4 · CARNADA — un operando sin crudo hace «no-verificable», nunca un número");
{
  // «Paris · Venta»/«Tottus · Venta» (composeSpecMargin, campo `venta` en MILES) nacen de enrichFromFacts SIN
  // `raw` — a propósito: el ARREGLO GENÉRICO (Paso 2, Condición 1) sólo estampa crudo en días/ratio/% (sin
  // ambigüedad de escala) y en `node.usd` (dólar crudo por contrato); el $ genérico de un `venta`/`costo`/
  // `contribucion` queda sin crudo porque la escala (K vs cruda) depende de la FUENTE y este módulo no la conoce
  // sin el formateo del composer — la MISMA razón por la que antes del arreglo «Saldo vencido · total» rompía.
  // Antes de este arreglo la carnada usaba «Lider/Falabella · Peso del costo» — ESE caso ya no sirve de ejemplo:
  // `costShare` es un campo `%` sin ambigüedad de escala y el arreglo genérico ahora SÍ le pone crudo (control
  // positivo en `_grupos_conteos_universos_gate`/sonda, no acá).
  const figs = figsDeCall("marginRead", { focus: "bajo_benchmark", dimension: "cliente" }, "cómo viene el margen");
  const fVenta = figs.find((f) => f.label === "Paris · Venta");
  ok(!!fVenta && !Number.isFinite(fVenta.raw), "★ control de la carnada · «Paris · Venta» sigue naciendo sin `raw` (el $ genérico queda fuera del arreglo — escala ambigua)", fVenta ? `raw=${fVenta.raw}` : "fig ausente");
  const I = indiceDe(figs);
  const idxF = I.figs.find((f) => f.label === "Paris · Venta");
  ok(!!idxF && idxF.crudo === false && Number.isFinite(idxF.raw), "el índice de evidencia SÍ reparsea el texto para `raw` (uso legítimo: citar/cotejar) pero marca `crudo: false`", JSON.stringify({ raw: idxF && idxF.raw, crudo: idxF && idxF.crudo }));
  const libro = libroDeHechos([
    { id: "h1", tipo: "razon", num: { sujeto: "Paris", metrica: "Venta" }, den: { sujeto: "Tottus", metrica: "Venta" }, valor: "93%" },
  ], { indice: I });
  ok(libro.hechos[0].veredicto === "no-verificable" && /sin-crudo/.test(libro.hechos[0].motivo), "★ CARNADA · la razón sale «no-verificable: sin-crudo», JAMÁS un cociente calculado sobre el texto", JSON.stringify(libro.hechos[0]));

  // la misma carnada del lado de una derivada (suma/diferencia)
  const libroD = libroDeHechos([
    { id: "h1", tipo: "derivada", op: "diferencia", de: [{ sujeto: "Tottus", metrica: "Venta" }, { sujeto: "Paris", metrica: "Venta" }], valor: "$500K" },
  ], { indice: I });
  ok(libroD.hechos[0].veredicto === "no-verificable" && /sin-crudo/.test(libroD.hechos[0].motivo), "★ CARNADA (derivada) · una diferencia con un operando sin crudo también sale «no-verificable: sin-crudo»", JSON.stringify(libroD.hechos[0]));
}

/* ═══ 5 · CARNADA — el fallback nunca se etiqueta «literal» / «medido» ═══ */
H("5 · CARNADA — el fallback de reparseo nunca produce la procedencia «medido»");
{
  const figs = figsDeCall("marginRead", { focus: "bajo_benchmark", dimension: "cliente" }, "cómo viene el margen");
  const I = indiceDe(figs);
  // el fig.tipo.verificabilidad de origen SÍ dice «literal» (se estampa por el rótulo, sin saber si hay crudo) —
  // lo que este candado exige es que la CASA no lo repita ciegamente cuando `crudo === false`.
  const idxF = I.figs.find((f) => f.label === "Paris · Venta");
  ok(idxF && idxF.fig && idxF.fig.tipo && idxF.fig.tipo.verificabilidad === "literal", "★ control · sin el arreglo, la fig de origen SÍ trae `tipo.verificabilidad: \"literal\"` (la trampa que este candado cierra)");
  const libro = libroDeHechos([{ id: "h1", tipo: "cifra", sujeto: "Paris", metrica: "Venta", valor: "$6.3M" }], { indice: I });
  ok(libro.hechos[0].procedencia !== "medido", "★ CARNADA · la procedencia del hecho NO es «medido» — la reconstrucción no hereda la confianza de una lectura directa", `procedencia=${libro.hechos[0].procedencia}`);
}

/* ═══ 6 · CONTROL NEGATIVO — citar/cotejar una cifra impresa SIGUE verificando ═══ */
H("6 · CONTROL NEGATIVO — comprobar que se repitió lo impreso sigue funcionando");
{
  const figs = figsDeCall("marginRead", { focus: "bajo_benchmark", dimension: "cliente" }, "cómo viene el margen");
  const I = indiceDe(figs);
  const libro = libroDeHechos([{ id: "h1", tipo: "cifra", sujeto: "Paris", metrica: "Venta", valor: "$6.3M" }], { indice: I });
  ok(libro.hechos[0].veredicto === "verdadera", "★ CONTROL · «Paris · Venta = $6.3M» (repite el texto mostrado) sigue verificando VERDADERA — no se rompió lo legítimo", JSON.stringify(libro.hechos[0]));
  const libroFalso = libroDeHechos([{ id: "h1", tipo: "cifra", sujeto: "Paris", metrica: "Venta", valor: "$9M" }], { indice: I });
  ok(libroFalso.hechos[0].veredicto === "falsa", "★ CONTROL · y una cifra que NO coincide con lo impreso sigue saliendo FALSA (el juicio de cita no se aflojó)");
}

/* ═══ 7 · CONTROL NEGATIVO — una razón con crudo genuino en los dos lados sigue verificando ═══ */
H("7 · CONTROL NEGATIVO — el candado no apaga lo que sí tiene crudo");
{
  const figs = figsDeCall("cobranza", {}, "¿quién me debe más?");
  const I = indiceDe(figs);
  const libro = libroDeHechos([
    { id: "h1", tipo: "razon", num: { sujeto: "Falabella", metrica: "Saldo vencido" }, den: { sujeto: "negocio", metrica: "Saldo vencido" }, valor: "19.8%" },
  ], { indice: I });
  ok(libro.hechos[0].veredicto === "verdadera", "★ CONTROL · una razón entre dos figs con crudo genuino (Falabella ÷ total vencido) sigue verificando normalmente", JSON.stringify(libro.hechos[0]));
}

/* ═══ 8 · EL CANDADO DE `enrichFromFacts` (owner 2026-09-23 — Paso 4 del encargo) ═══════════════════════════════
 * `ledger.js:enrichFromFacts` ahora pasa `raw` en dos casos, los ÚNICOS donde la escala no se adivina (Condición
 * 1): (a) `node.usd` — dólar crudo por contrato; (b) el número branch de días/ratio/% — `v` ES el operando exacto
 * que la MISMA línea formatea. El $ genérico (venta/costo/contribución/…) queda sin crudo a propósito: sigue
 * viniendo a veces en miles y a veces crudo según la fuente, sin forma de saberlo desde acá. */
H("8 · CANDADO — toda fig con crudo reproduce su texto exacto desde el crudo (la escala es correcta)");
{
  // el mismo algoritmo de formateo $ que usan boleta.js/ledger.js/specRetrieval.js (_moneyC/_moneyE/_money):
  // idéntico en los tres — sólo cambia de dónde toma el símbolo, y acá se usa el mismo `simboloMoneda()`.
  const _moneyFmt = (v) => { const a = Math.abs(v), s = v < 0 ? "-" : ""; const $ = "$"; if (a >= 1e6) return `${s}${$}${(a / 1e6).toFixed(1)}M`; if (a >= 1e3) return `${s}${$}${Math.round(a / 1e3)}K`; return `${s}${$}${Math.round(a)}`; };
  const _reformatea = (unit, raw) => {
    if (unit === "days") return [`${Math.round(raw)}d`];
    if (unit === "ratio") return [`${(+raw).toFixed(1)}x`];
    // «pct» conviven dos convenciones (redondeado acá vs ya-redondeado por el composer) y, además, algunas figs
    // declaran `unit: "pct"` con texto en PUNTOS porcentuales («5.0 pp», ej. «Brecha al benchmark») — no es un
    // error de escala, es la unidad «pp» etiquetada como «pct» (viven juntas en `unidadCompatible`, evidencia.js).
    if (unit === "pct") return [`${(+raw).toFixed(1)}%`, `${raw}%`, `${(+raw).toFixed(1)} pp`, `${raw} pp`];
    if (unit === "money") return [_moneyFmt(raw).replace(/^\$/, "")];   // el símbolo declarado varía (CLP/USD/EUR); se compara sin él
    return null;
  };
  const CASOS = [
    ["marginRead", { focus: "bajo_benchmark", dimension: "cliente" }, "cómo viene el margen"],
    ["marginRead", { focus: "alto_volumen_bajo_margen", dimension: "cliente" }, "cómo viene el margen"],
    ["inventoryStatus", { focus: "frenado" }, "cómo viene el inventario"],
    ["diagnose", {}, "qué está pasando"],
    ["salesRead", { focus: "vs_anterior", dimension: "cliente" }, "cómo van las ventas"],
    ["cobranza", {}, "¿quién me debe más?"],
  ];
  let revisadas = 0, sinMatch = [];
  for (const [tool, args, pregunta] of CASOS) {
    let figs = [];
    try { figs = figsDeCall(tool, args, pregunta); } catch { continue; }
    for (const f of figs) {
      if (!Number.isFinite(f.raw)) continue;
      const cands = _reformatea(f.unit, f.raw);
      if (!cands) continue;   // unidad fuera del alcance de este candado (count, pp…)
      revisadas++;
      const texto = String(f.value || "").replace(/^-?[^\d-]*/, (m) => (m.includes("-") ? "-" : ""));   // pela el símbolo de moneda, conserva el signo
      const ok1 = cands.some((c) => c === texto || c === String(f.value || ""));
      if (!ok1) sinMatch.push({ label: f.label, unit: f.unit, raw: f.raw, value: f.value, cands });
    }
  }
  ok(revisadas > 10, `el candado revisó una muestra real de figs con crudo (${revisadas})`, `revisadas=${revisadas}`);
  ok(sinMatch.length === 0, "★ CANDADO · CADA fig con crudo, en la muestra real, reproduce su texto exacto al reformatear desde el crudo", JSON.stringify(sinMatch.slice(0, 5)));
}

/* ═══ 9 · CANDADO — `enrichFromFacts` no cambia cuántas figs salen ni su orden ═══ */
H("9 · CANDADO — enrichFromFacts no crea ni reordena figs (solo les agrega crudo)");
{
  // se corre el MISMO plan dos veces (misma call, mismo escenario): el ledger es puro (ver cabecera del archivo),
  // así que dos corridas deben dar EXACTAMENTE la misma boleta — cantidad, orden y label — con o sin el arreglo.
  // Esto no prueba "antes vs después del commit" (no hay snapshot congelado de antes); prueba que el arreglo es
  // DETERMINISTA y no introduce una fuente de variación en cuántas figs salen o en qué orden.
  for (const [tool, args, pregunta] of [
    ["marginRead", { focus: "bajo_benchmark", dimension: "cliente" }, "cómo viene el margen"],
    ["salesRead", { focus: "vs_anterior", dimension: "cliente" }, "cómo van las ventas"],
    ["cobranza", {}, "¿quién me debe más?"],
  ]) {
    const a = figsDeCall(tool, args, pregunta).map((f) => f.label);
    const b = figsDeCall(tool, args, pregunta).map((f) => f.label);
    ok(a.length === b.length && a.every((l, i) => l === b[i]), `${tool}(${JSON.stringify(args)}) — misma cantidad (${a.length}) y mismo orden de labels en dos corridas`, a.length === b.length ? "" : `${a.length} vs ${b.length}`);
  }
}

/* ═══ 10 · EL CASO DE `_ronda5_gate` — z02-razon-entidades-distintas h2 ═══════════════════════════════════════
 * El hecho que rompía `_ronda5_gate` (Lider · saldo vencido ÷ negocio · ventas = 4.6%, esperado VERDADERA):
 * el denominador salía de `headlineSub` («$100.0M vs $92.9M», specRetrieval.js composeSpecVentas focus
 * vs_anterior), sin crudo. El arreglo publica «Ventas del período» con crudo real (mismo `_m(tot)` exacto) — la
 * misma fig, dedup por canon — y la razón vuelve a verificar. */
H("10 · EL CASO DE _ronda5_gate — la razón sobre «negocio · ventas» vuelve a verificar");
{
  const figs = figsDeCall("salesRead", { focus: "vs_anterior", dimension: "cliente" }, "¿cómo vienen mis clientes en venta y en cobranza?");
  const fVentasPeriodo = figs.find((f) => f.label === "Ventas del período");
  ok(!!fVentasPeriodo && Number.isFinite(fVentasPeriodo.raw), "«Ventas del período» nace con crudo real (antes: sólo vivía dentro de headlineSub)", fVentasPeriodo ? `raw=${fVentasPeriodo.raw} value=${fVentasPeriodo.value}` : "fig ausente");
  const fHeadlineSub = figs.find((f) => f.label === "headlineSub");
  ok(!fHeadlineSub, "★ CANDADO · el fig «headlineSub» ya NO nace (dedup por canon contra «Ventas del período»/«Ventas del año anterior», ambas con crudo)", fHeadlineSub ? JSON.stringify(fHeadlineSub) : "");
  // el mismo hecho que z02-razon-entidades-distintas h2 (fixtures/ronda5-2026-09-17/hechos.json)
  const cobranzaFigs = figsDeCall("cobranza", {}, "¿cómo vienen mis clientes en venta y en cobranza?");
  const I = indiceDe([...figs, ...cobranzaFigs]);
  const libro = libroDeHechos([
    { id: "h1", tipo: "razon", num: { sujeto: "Lider", metrica: "saldo_vencido" }, den: { sujeto: "negocio", metrica: "ventas" }, valor: "4,6%" },
  ], { indice: I });
  ok(libro.hechos[0].veredicto === "verdadera", "★ CANDADO · el hecho que rompía _ronda5_gate (z02 h2) vuelve a salir VERDADERA", JSON.stringify(libro.hechos[0]));
}

console.log(`\n── _verificador_crudo_gate: PASS ${pass} · FAIL ${fail} (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
