/* === src/adi/oracle/answerViaOracle.js · ARQUITECTURA C · Fase 3 · EL SEAM DE INTEGRACIÓN ===
 * Corre el ciclo COMPLETO de C (PLAN→BATCH→NARRAR bajo guardC) y devuelve un resultado COMPATIBLE con el pipeline
 * vivo ({text, route, evidence}). Detrás del flag ADI_ORACLE_ENABLED; si C se abstiene (plan falla / guard rechaza)
 * devuelve null → el llamador CAE a la ruta vieja (fallback intacto). Reversible: flag OFF = como si no existiera.
 *
 * callPlan/callNarrate son INYECTADOS: headless usan el adapter directo (oráculo/gates), el cliente usa fetch al
 * gateway (la key vive server-side). El motor, la boleta y guardC son los mismos; esto solo los orquesta.
 */
import { applyMemoryUpdate } from "./persona.js";
import { runPlan } from "./toolRunner.js";
import { ledgerBoleta } from "./ledger.js";
import { guardC } from "./guardC.js";
import { stripFiller, normalizeFigures } from "./narratePromptC.js";
import { stripLanguageLeaks } from "../llm/voiceGuard.js";   // GARANTÍA runtime de registro (owner 2026-07-14/26: "palanca" y demás slang NO van — hoy solo corría en la ruta vieja, C quedaba sin la red)
import { buildOracleEvidence } from "./sentrixEvidence.js";  // SENTRIX ES LA EVIDENCIA (owner 2026-07-28): el panel debe reflejar lo que C acaba de narrar

// answerViaOracle({ text, history, mem, scenario, callPlan, callNarrate, maxCalls }) → { r, mem } | null
//   r   = { text, route:"oracle", evidence:{boleta,...} }  (compatible con _turnFromResult)
//   mem = la memoria de interacción ACTUALIZADA (el llamador la persiste en el context del hilo)
export async function answerViaOracle({ text, history = [], mem = {}, scenario = "actual", callPlan, callNarrate, maxCalls = 6 } = {}) {
  if (typeof callPlan !== "function" || typeof callNarrate !== "function") return null;
  const q = (text || "").trim();
  if (!q) return null;

  // ── PASADA 1 · PLAN ──
  let plan;
  try { plan = await callPlan({ text: q, history, mem, scenario }); }
  catch { return null; }
  if (!plan || !plan.intent) return null;
  // `calls` puede faltar en intent=ack/define (el modelo lo omite cuando no pide datos) → default [] (NO es abstención).
  const calls = Array.isArray(plan.calls) ? plan.calls : [];

  // memoria de interacción (trato/identidad) — se aplica ANTES de narrar
  const mem2 = plan.memoryUpdate ? applyMemoryUpdate(mem, plan.memoryUpdate) : mem;

  // ── BATCH DETERMINÍSTICO ──
  const { ledger, results, trace } = runPlan({ intent: plan.intent, calls }, { scenario, maxCalls });
  const figs = ledgerBoleta(ledger);

  // ── PASADA 2 · NARRAR (con DOS reintentos · 3 intentos máx) ──
  // Un rechazo del guard suele ser VARIANCE del LLM (una cifra derivada, una atribución yuxtapuesta). Re-muestrear
  // recupera la mayoría de esos turnos SIN debilitar el muro (el guard valida cada intento igual). El 2º reintento
  // solo se dispara cuando los dos primeros fallaron —los casos difíciles (temporal por entidad, cruces)— donde
  // recuperar una respuesta LIMPIA de C vale más que caer al fallback. Solo si los TRES fallan, C se abstiene.
  let narration = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    let n;
    try { n = await callNarrate({ text: q, plan, results, ledgerFigs: figs, mem: mem2, history }); }
    catch { return null; }
    if (!n || typeof n !== "string" || !n.trim()) continue;
    n = normalizeFigures(n, figs);   // cifras en forma canónica limpia ($4.9M, no $4,943,664)
    n = stripLanguageLeaks(n);       // registro ejecutivo neutro (palanca→acción, plata→caja…) · GARANTÍA sobre lo que el prompt ya pide
    n = stripFiller(n);              // banda prohibida de cierres-relleno (backstop del prompt)
    if (!n.trim()) continue;
    if (guardC(n, { ledger, results, trace, question: q }).ok) { narration = n; break; }
  }
  if (!narration) return null;   // dos intentos no pasaron el muro → C se abstiene (fallback a la ruta vieja)

  return {
    r: {
      text: narration,
      route: "oracle",
      evidence: buildOracleEvidence({ plan, results, figs, scenario }),
      suggestions: null,
      sentrixAction: null,
    },
    mem: mem2,
  };
}
