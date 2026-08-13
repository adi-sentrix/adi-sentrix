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
ok(Object.keys(OPERACIONES_CALCULO).join(",") === "suma,resta,variacion_pct,participacion,brecha_pp,escalar,margen_objetivo",
  "las operaciones son EXACTAMENTE las declaradas (D1)", Object.keys(OPERACIONES_CALCULO).join(","));
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
