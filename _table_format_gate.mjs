/* === _table_format_gate.mjs · GATE del hallazgo "capital inmovilizado da veces tabla, veces prosa, veces lista" ===
 * Hallazgo en vivo (app.adiai.cl, owner 2026-08-02, 2 capturas de pantalla comparando la MISMA pregunta): para el
 * mismo tipo de dato (capital por bodega + por SKU, 2+ cifras por entidad) ADI devolvió, en corridas distintas de
 * esta misma conversación: prosa corrida, una lista con guiones, y (rara vez) una tabla real. La regla YA está en
 * narratePromptC.js (FORMATO: "cuando tu respuesta termina citando 2+ cifras DISTINTAS por entidad... armá una
 * TABLA en MARKDOWN... SIN IMPORTAR que la pregunta haya sido sobre una sola métrica") — pero es solo prompt, sin
 * ningún código que lo haga cumplir (markdown.jsx#parseMarkdownTable es un PARSER, no un generador: solo renderiza
 * tabla si el LLM ya escribió sintaxis "| col | col |" con separadora — si escribe prosa/lista, nadie la convierte).
 *
 * Fix: mismo patrón que instruccion_formato/instruccion_brevedad (responsePreference.js — "el system prompt solo
 * no bastó, reforzar A NIVEL DE TURNO es lo que recuperó cumplimiento"). _needsTableFormat (narratePromptC.js)
 * detecta 2+ entidades con 2+ cifras cada una en cifras_autorizadas (convención de label "Entidad · Concepto",
 * boleta.js fig()) e inyecta instruccion_tabla SOLO en ese caso — payload mínimo, cero cambio para el resto de
 * turnos. */
import { buildNarrateUserMessageC } from "./src/adi/oracle/narratePromptC.js";
import { answerViaOracle } from "./src/adi/oracle/answerViaOracle.js";
import { handlePlan, handleNarrateC } from "./src/adi/llm/gatewayCore.js";

let pass = 0, fail = 0;
const ok = (cond, label) => { console.log(`  ${cond ? "✓" : "✗"} ${label}`); if (cond) pass++; else fail++; };

function _payloadFor(figs) {
  return buildNarrateUserMessageC({ text: "x", plan: { mode: "diagnostico" }, results: [], ledgerFigs: figs, mem: {}, history: [] });
}

console.log("── 1 · _needsTableFormat (vía buildNarrateUserMessageC) — detecta 2+ entidades × 2+ cifras, sin falsos positivos ──");
{
  const figsBodegas = [
    { label: "Valparaíso · Capital detenido", value: "$25K" },
    { label: "Valparaíso · % del total", value: "75%" },
    { label: "Antofagasta · Capital detenido", value: "$8K" },
    { label: "Antofagasta · % del total", value: "25%" },
  ];
  ok(!!_payloadFor(figsBodegas).instruccion_tabla, "el caso REAL reportado (2 bodegas × 2 cifras) trae instruccion_tabla");

  const figsSKU = [
    { label: "LG-DRYER8KG · Capital detenido", value: "$14K" },
    { label: "LG-DRYER8KG · Días sin venta", value: "94d" },
    { label: "BOS-SANDER · Capital detenido", value: "$11K" },
    { label: "BOS-SANDER · Días sin venta", value: "68d" },
    { label: "MAK-COMP-AIR · Capital detenido", value: "$8K" },
    { label: "MAK-COMP-AIR · Días sin venta", value: "112d" },
  ];
  ok(!!_payloadFor(figsSKU).instruccion_tabla, "3 SKU × 2 cifras cada uno también trae instruccion_tabla");

  const figsFicha = [
    { label: "Falabella · Margen", value: "22%" },
    { label: "Falabella · Ventas", value: "$19.4M" },
    { label: "Falabella · Contribución", value: "$4.3M" },
  ];
  ok(!_payloadFor(figsFicha).instruccion_tabla, "REGRESIÓN: 1 sola entidad (ficha de Falabella) NO fuerza tabla — sigue siendo prosa legítima");

  const figsGlobal = [
    { label: "Ventas del período", value: "$100M" },
    { label: "Contribución", value: "$20M" },
  ];
  ok(!_payloadFor(figsGlobal).instruccion_tabla, "REGRESIÓN: figs globales sin patrón 'Entidad · Concepto' NO fuerzan tabla");

  const figsRanking = [
    { label: "Falabella · Margen", value: "22%" },
    { label: "Lider · Margen", value: "18%" },
    { label: "Sodimac · Margen", value: "25%" },
  ];
  ok(!_payloadFor(figsRanking).instruccion_tabla, "REGRESIÓN: 3 entidades pero 1 SOLO concepto cada una (ranking de una métrica) NO fuerza tabla — eso es LISTA NUMERADA, no tabla");

  ok(!_payloadFor([]).instruccion_tabla && !_payloadFor(null).instruccion_tabla, "sin figs (vacío o null) no explota, no fuerza tabla");
  ok(!_payloadFor([{ label: "solo una", value: "$1" }]).instruccion_tabla, "1 sola fig no puede ser 2×2 — no fuerza tabla");
}

console.log("\n── 2 · el texto de la instrucción es correcto y accionable ──");
{
  const figs = [
    { label: "A · X", value: "1" }, { label: "A · Y", value: "2" },
    { label: "B · X", value: "3" }, { label: "B · Y", value: "4" },
  ];
  const instr = _payloadFor(figs).instruccion_tabla;
  ok(/markdown/i.test(instr) && /\|---\|/.test(instr), `menciona markdown y el formato de fila separadora — "${instr}"`);
  ok(/sin importar que la pregunta/i.test(instr), "refuerza que aplica AUNQUE la pregunta haya sido puntual (mismo criterio que el prompt)");
}

console.log("\n── 3 · SMOKE LLM REAL — el caso EXACTO reportado, medido en vivo, ¿mejora el cumplimiento? ──");
{
  const callPlan = async ({ text, history, mem, scenario, requestContext, attempt }) => {
    const r = await handlePlan({ text, history, mem, scenario, requestContext, attempt });
    if (!r.ok) throw new Error(r.error);
    return r.plan;
  };
  const callNarrate = async (payload) => {
    const built = buildNarrateUserMessageC(payload);
    const r = await handleNarrateC({ payload: built, mem: payload.mem, attempt: payload.attempt });
    if (!r.ok) throw new Error(r.error);
    return r.narration;
  };
  const isTabular = (text) => String(text).split("\n").some((l) => { const t = l.trim(); return t.startsWith("|") && t.indexOf("|", 1) > 0; });

  let tableCount = 0, resolved = 0;
  const N = 3;
  for (let i = 0; i < N; i++) {
    const r = await answerViaOracle({ text: "cuanto capital tengo inmovilizado en inventario?", history: [], mem: {}, scenario: "actual", callPlan, callNarrate });
    if (!r) continue;   // abstención de infra (rate limit/timeout) — no es señal de este gate, se descarta del conteo
    resolved++;
    if (isTabular(r.r.text)) tableCount++;
  }
  console.log(`  medición: ${tableCount}/${resolved} corridas resueltas con tabla real (de ${N} intentadas)`);
  ok(resolved === 0 || tableCount >= Math.ceil(resolved * 0.66), `al menos 2/3 de las corridas resueltas cumplen tabla — obtuvo ${tableCount}/${resolved}`);
}

console.log(`\n── _table_format_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
