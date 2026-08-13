/* === _amplitud_calculadora_gate.mjs · AMPLITUD F2 · LA CALCULADORA DE CATÁLOGO CERRADO (suite 138 → 139) =====
 * La decisión D1 del owner (2026-08-13) vuelta contrato: «catálogo cerrado ampliable — cada operación nueva entra
 * con su gate; jamás fórmula libre». La regla madre: el LLM propone, el motor calcula, el muro sella.
 *
 * LAS CUATRO GARANTÍAS DE LA FASE:
 *   1 · CATÁLOGO CERRADO — las operaciones son EXACTAMENTE las declaradas; el módulo es puro y no contiene
 *       ningún evaluador (sin eval/Function); la tolerancia es LA de _isCalc, nunca una segunda.
 *   2 · LA TOOL ES ALCANZABLE Y HONESTA — registrada + nombrable + descrita (una línea); resuelve insumos POR
 *       REFERENCIA contra el dato real; declina con razón: fórmula libre, insumo inexistente, cifra del usuario
 *       sin procedencia, unidades incompatibles, y el cruce de universos NOMBRANDO la regla.
 *   3 · EL MURO VERIFICA CUENTAS DEL CATÁLOGO — bidireccional (la cuenta exacta pasa, la torcida se veta) y
 *       ADITIVO (sin material del catálogo, el muro es byte-idéntico: el nivel _isCalc de siempre es subset).
 *   4 · EL CASO CANÓNICO DEL GERENTE — «la industria debería estar en 25% → ¿qué nos falta?» sobre el dato real
 *       del tenant: insumos probados, vara del usuario sellada INDICADO con procedencia, resultado con fórmula
 *       declarada y marco de hipótesis garantizado.
 * Una operación futura del catálogo = una entrada en OPERACIONES_CALCULO + sus casos bidireccionales ACÁ.
 */
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { OPERACIONES_CALCULO, ejecutarCalculo, esCalculoDelCatalogo, tolCalculo } from "./src/adi/oracle/calculoCatalogo.js";
import { toolNames, TOOLS } from "./src/adi/oracle/toolRegistry.js";
import { runPlan } from "./src/adi/oracle/toolRunner.js";
import { guardC } from "./src/adi/oracle/guardC.js";
import { fig } from "./src/adi/boleta.js";
import { ensureHypothesisFraming } from "./src/adi/oracle/narratePromptC.js";
import { rawRecordFor } from "./src/adi/oracle/entityRecord.js";
import { TOOL_CATALOG, PLAN_TOOL } from "./src/adi/oracle/planPrompt.js";
import { TOOL_CONTRACTS } from "./src/adi/oracle/toolContracts.js";
import { readFileSync } from "node:fs";

initTenant(TENANT_DEMO);

let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ " + m + (extra ? "\n      " + String(extra).slice(0, 220) : "")); } };

console.log("── 1 · CATÁLOGO CERRADO ──");
// GATE MOVIDO 2026-08-13 (cierre de la certificación amplia, hallazgo 3 · E5) — ANÁLISIS GARANTÍA-VS-FORMATO:
// la lista exacta es el punto de AMPLIACIÓN que este mismo gate declara en su cabecera («una operación futura del
// catálogo = una entrada en OPERACIONES_CALCULO + sus casos bidireccionales ACÁ»). Entra `variacion_aplicada`
// (aplicar un % del usuario a un monto — «¿y si mi venta subiera 10%?», el caso medido en vivo) CON sus casos
// bidireccionales abajo. La garantía (catálogo cerrado, sin eval, tolerancia única) queda intacta.
// GATE MOVIDO 2026-08-13 (encargo «umbral del usuario + dueño por fila») — ANÁLISIS GARANTÍA-VS-FORMATO: entra
// `suma_filtrada` por el MISMO punto de ampliación declarado (hallazgo VIVO del owner: «¿capital parado >90
// días?» respondió el total del criterio interno del motor como si fuera el umbral pedido — no existía ninguna
// operación que filtre por el umbral del usuario y sume). Sus casos bidireccionales, abajo y en
// _probe_umbral_dueno.mjs / _umbral_dueno_gate.mjs. La garantía (cerrado, sin eval, tolerancia única) intacta.
ok(Object.keys(OPERACIONES_CALCULO).join(",") === "suma,resta,variacion_pct,participacion,brecha_pp,escalar,variacion_aplicada,suma_filtrada,margen_objetivo",
  "las operaciones son EXACTAMENTE las declaradas (D1 + ampliaciones E5 y umbral-del-usuario)", Object.keys(OPERACIONES_CALCULO).join(","));
{
  // los casos bidireccionales de la operación nueva (contrato de ampliación): la suma N-aria exacta ejecuta con
  // su fórmula; el muro NO la espeja (conservador: una suma N-aria sobre el pool es combinatoria pura — los
  // resultados llegan sellados en la boleta de la tool, misma decisión medida que el `proyectado`).
  const sfOk = ejecutarCalculo("suma_filtrada", [{ raw: 13600, unit: "money" }, { raw: 8400, unit: "money" }]);
  ok(sfOk.ok && sfOk.resultados[0].raw === 22000 && /=/.test(sfOk.resultados[0].formula),
    "suma_filtrada: $13.6K + $8.4K → $22K con su fórmula declarada", JSON.stringify(sfOk.resultados));
  const sfMal = ejecutarCalculo("suma_filtrada", [{ raw: 13600, unit: "money" }, { raw: 94, unit: "days" }]);
  ok(!sfMal.ok && sfMal.regla === "unidades-incompatibles", "montos con días NO se suman: declina por unidades");
  const sfVacia = ejecutarCalculo("suma_filtrada", []);
  ok(!sfVacia.ok && sfVacia.regla === "aridad", "cero filas declina por aridad (1+)");
  ok(esCalculoDelCatalogo(33200, "money", [{ raw: 13600, unit: "money" }, { raw: 11200, unit: "money" }, { raw: 8400, unit: "money" }]) === false,
    "el muro NO recomputa la suma N-aria (viene sellada en boleta — conservador)");
}
{
  // los casos bidireccionales de la operación nueva: la cuenta exacta ejecuta con su fórmula; el muro la verifica
  // en ambos sentidos (la exacta pasa, la torcida se veta) — mismo patrón que la regla de tres y la participación.
  const va = ejecutarCalculo("variacion_aplicada", [{ raw: 100000000, unit: "money" }, { raw: 10, unit: "pct" }]);
  ok(va.ok && va.resultados.length === 2 && va.resultados[1].clave === "proyectado"
    && Math.abs(va.resultados[1].raw - 110000000) < 1 && /=/.test(va.resultados[1].formula),
    "variacion_aplicada: $100.0M + 10% → proyectado $110.0M con su fórmula declarada", JSON.stringify(va.resultados));
  ok(Math.abs(va.resultados[0].raw - 10000000) < 1, "…y el delta ($10.0M) también declarado");
  const vaMal = ejecutarCalculo("variacion_aplicada", [{ raw: 100000000, unit: "money" }, { raw: 194000, unit: "money" }]);
  ok(!vaMal.ok && vaMal.regla === "unidades-incompatibles", "monto con monto NO es una variación %: declina por unidades");
  // EL MURO NO ESPEJA EL PROYECTADO, deliberadamente (medido en este mismo pase): monto×(1+%) sobre el pool real
  // (134 montos del dato) colisionaba y autorizó una cifra con dueño equivocado — el gate del dato-narrador se
  // puso rojo. Los resultados de variacion_aplicada SIEMPRE llegan sellados en la boleta de la tool; el narrador
  // que haga esa cuenta por su cuenta se veta y repara. El delta (monto×%) sí queda cubierto por la expresión que
  // margen_objetivo ya espeja.
  const pool = [{ raw: 100000000, unit: "money" }, { raw: 10, unit: "pct" }];
  ok(esCalculoDelCatalogo(110000000, "money", pool) === false, "el muro NO recomputa el proyectado (viene sellado en boleta — conservador)");
  ok(esCalculoDelCatalogo(10000000, "money", pool) === true, "…el delta (monto × %) sí sigue cubierto (expresión ya espejada)");
}
const SRC = readFileSync(new URL("./src/adi/oracle/calculoCatalogo.js", import.meta.url), "utf8");
ok(!/\beval\s*\(|new\s+Function\b/.test(SRC), "sin eval/Function — no hay evaluador de expresiones escondido");
ok(!/from\s+["'][^"']*(data\/|engine\/|specRetrieval)/.test(SRC), "el módulo es puro: no importa dato ni motor");
const libre = ejecutarCalculo("formula_libre", [{ raw: 1, unit: "money" }]);
ok(!libre.ok && libre.regla === "catalogo-cerrado" && /No ejecuto fórmulas libres/.test(libre.razon),
  "una operación fuera del catálogo declina declarando el catálogo cerrado");
// la tolerancia del catálogo ES la de _isCalc: la expresión vive dos veces (guardC no puede importar con ciclo
// cero riesgo) y este chequeo las mantiene idénticas — si una cambia sola, esto se pone rojo.
const GSRC = readFileSync(new URL("./src/adi/oracle/guardC.js", import.meta.url), "utf8");
const TOL_EXPR = 'unit === "money" ? Math.max(1000, Math.abs(raw) * 0.02) : (unit === "pct" || unit === "pp") ? 0.2 : unit === "ratio" ? 0.15 : unit === "days" ? 0.6 : 0.05';
ok(SRC.includes(TOL_EXPR) && GSRC.includes(TOL_EXPR.replace(/raw/g, "raw")), "la tolerancia es UNA (la de _isCalc), verificada en las dos fuentes");

console.log("── 2 · LA TOOL, ALCANZABLE Y HONESTA ──");
ok(toolNames().includes("calcular") && typeof TOOLS.calcular === "function", "registrada en TOOLS");
ok((PLAN_TOOL.schema.properties.calls.items.properties.tool.enum || []).includes("calcular"), "nombrable en el enum de PLAN");
ok(/calcular\{/.test(TOOL_CATALOG), "descrita en TOOL_CATALOG (la línea del catálogo del PLAN)");
ok(!!TOOL_CONTRACTS.calcular && TOOL_CONTRACTS.calcular.inputsObligatorios.join(",") === "operacion,insumos", "con su contrato declarado en TOOL_CONTRACTS");
{
  const cx = TOOLS.calcular({ operacion: "participacion", insumos: [{ entidad: "Falabella", metrica: "ventas" }, { entidad: "SAM-TV55", metrica: "capital" }], scenario: "actual" });
  ok(cx.coverage.supported === false && /universos no reconcilian/.test(cx.coverage.reason) && /MILES/.test(cx.coverage.reason),
    "venta ÷ inventario DECLINA nombrando la regla de los dos universos y su razón medida", cx.coverage.reason);
  const sp = TOOLS.calcular({ operacion: "suma", insumos: [{ usuario: "$500K" }, { entidad: "Falabella", metrica: "contribucion" }], scenario: "actual" });
  ok(sp.coverage.supported === false && /procedencia/.test(sp.coverage.reason), "cifra del usuario sin procedencia DECLINA pidiendo el origen");
  const um = TOOLS.calcular({ operacion: "suma", insumos: [{ entidad: "Falabella", metrica: "margen" }, { entidad: "Falabella", metrica: "ventas" }], scenario: "actual" });
  ok(um.coverage.supported === false && /MISMA unidad/.test(um.coverage.reason), "$ con % DECLINA por unidades (jamás convierte en silencio)");
  const ne = TOOLS.calcular({ operacion: "resta", insumos: [{ entidad: "Inexistente SpA", metrica: "ventas" }, { metrica: "ventas" }], scenario: "actual" });
  ok(ne.coverage.supported === false && /no encuentro/.test(ne.coverage.reason), "insumo inexistente DECLINA honesto");
}

console.log("── 3 · EL MURO VERIFICA CUENTAS DEL CATÁLOGO (bidireccional · aditivo) ──");
{
  const figs = [fig("Falabella · Medida 1pp", "$194K", { unit: "money", raw: 194000 })];
  const base = { ledger: { figs }, results: [{ tool: "marginRead", facts: {}, boleta: figs, coverage: { supported: true } }], trace: null, question: "si 1 punto vale $194K, ¿cuánto valen 4 puntos de margen?" };
  ok(guardC("Recuperar 4 puntos de margen en Falabella vale $776K ($194K × 4pp).", base).ok,
    "la regla de tres exacta PASA ($194K × 4pp = $776K)");
  const tor = guardC("Recuperar 4 puntos de margen en Falabella vale $920K.", base);
  ok(!tor.ok && tor.verdict === "cifra-no-autorizada", "el resultado torcido ($920K) se VETA");
  const figsV = [fig("Lider · Ventas", "$17.9M", { unit: "money", raw: 17900000 }), fig("Total · Ventas", "$100.0M", { unit: "money", raw: 100000000 })];
  const baseV = { ledger: { figs: figsV }, results: [{ tool: "queryMetric", facts: {}, boleta: figsV, coverage: { supported: true } }], trace: null, question: "" };
  ok(guardC("Lider representa el 17.9% de la venta total ($17.9M sobre $100.0M).", baseV).ok, "la participación exacta PASA");
  ok(!guardC("Lider representa el 24.5% de la venta total.", baseV).ok, "la participación torcida se VETA");
  // ADITIVIDAD — el subset de siempre intacto: sin material del catálogo, mismo veredicto de siempre
  const inv = guardC("La venta de Lider fue $55.5M.", { ledger: { figs: figsV }, results: [], trace: null, question: "" });
  ok(!inv.ok && inv.verdict === "cifra-no-autorizada", "una cifra que NO es cuenta del catálogo sigue vetada con el kind madre");
  const limpio = guardC("Lider vendió $17.9M y el total fue $100.0M.", { ledger: { figs: figsV }, results: [], trace: null, question: "" });
  ok(limpio.ok && limpio.violations.length === 0, "una narración 100% autorizada pasa idéntica (la vía nueva ni se consulta)");
}

console.log("── 4 · EL CASO CANÓNICO DEL GERENTE, CONTRA EL DATO REAL ──");
{
  const rec = rawRecordFor("cliente", "Falabella", "actual");
  const out = runPlan({ intent: "answer", calls: [{ tool: "calcular", args: { operacion: "margen_objetivo", insumos: [{ entidad: "Falabella" }], objetivo: { usuario: "25% (una noticia dice que la industria debería estar ahí)" } } }] }, { scenario: "actual" });
  const r = out.results[0];
  ok(r.coverage.supported === true && r.facts.es_calculo === true, "runPlan resuelve los insumos y ejecuta la cuenta");
  const fV = r.boleta.find((f) => f.label === "Falabella · Ventas");
  ok(!!fV && fV.tipo.sello === "probado" && Math.abs(fV.raw - rec.venta * 1000) < 1, "la venta se resolvió POR REFERENCIA contra el dato real, sellada probado");
  const fU = r.boleta.find((f) => /Cifra del usuario/.test(f.label));
  ok(!!fU && fU.tipo.sello === "indicado" && /procedencia/.test(fU.tipo.verificabilidadRazon), "la vara del usuario entra sellada INDICADO con su procedencia");
  const fF = r.boleta.find((f) => f.label === "Falabella · Contribución faltante");
  ok(!!fF && fF.mandatory === true && fF.source === "computed" && fF.tipo.sello === "indicado" && typeof fF.formula === "string" && fF.formula.includes(" = "),
    "la contribución faltante sale computed+mandatory, sello INDICADO, con su FÓRMULA declarada", fF && fF.formula);
  ok(r.facts.conCifraDeUsuario === true, "facts declaran que hay una cifra del usuario adentro");
  const texto = "Con tu 25% de referencia, a Falabella le faltan " + fF.value + " de contribución.";
  ok(/estimado/i.test(ensureHypothesisFraming(texto, "default", out.results)), "el marco de hipótesis se garantiza (derivada de vara del usuario = escenario)");
  ok(ensureHypothesisFraming("La venta creció 7.6%.", "default",
    [{ tool: "calcular", facts: { conCifraDeUsuario: false }, coverage: { supported: true } }]) === "La venta creció 7.6%.",
    "sin cifra del usuario NO hay marco extra: la cuenta sobre datos del motor es del dato");
}

console.log(`\n── _amplitud_calculadora_gate: ${PASS} PASS · ${FAIL} FAIL ──`);
process.exit(FAIL ? 1 : 0);
