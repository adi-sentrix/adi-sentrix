/* === _oracle_tension_gate.mjs · ARQUITECTURA C · GATE DE tensionRead === turno 14 del veredicto de 18 turnos
 * (owner 2026-07-29): "¿quién sostiene la contribución y quién consume más capital, hay tensión?" — antes
 * disparaba 2 tool-calls de EJES DISTINTOS (contribución por cliente + capital por SKU) que el narrador mezclaba
 * sin declarar el mismatch — 1/3 corridas caía a total-mal-atribuido (abstención), 2/3 pasaba con una atribución
 * de eje falsa en prosa (sin cifra inventada, invisible al guard numérico). Nuevo composer `buildTension`
 * (entityRecord.js) + tool `tensionRead` cruzan DOS métricas del MISMO eje y devuelven el top-N de cada una YA
 * intersectado — o declinan HONESTO si el eje no tiene ambas columnas (cliente/marca/familia no tienen capital).
 * 1) determinístico (sin LLM): axisHasField/buildTension directo. 2) smoke LLM real (3 corridas × 2 variantes).
 */
import fs from "fs";
import { axisHasField, buildTension } from "./src/adi/oracle/entityRecord.js";
import { runPlan } from "./src/adi/oracle/toolRunner.js";
import { guardC } from "./src/adi/oracle/guardC.js";
import { handlePlan, handleNarrateC } from "./src/adi/llm/gatewayCore.js";
import { buildNarrateUserMessageC } from "./src/adi/oracle/narratePromptC.js";
import { ledgerBoleta } from "./src/adi/oracle/ledger.js";
import { answerViaOracle } from "./src/adi/oracle/answerViaOracle.js";
for (const ln of fs.readFileSync(".env", "utf8").split(/\r?\n/)) { const m = ln.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
const SC = "actual";
let pass = 0, fail = 0;
const ok = (cond, label) => { console.log(`  ${cond ? "✓" : "✗"} ${label}`); if (cond) pass++; else fail++; };

console.log("── 1 · DETERMINÍSTICO (sin LLM) ──");
{
  ok(axisHasField("sku", "contribucion") && axisHasField("sku", "stockUSD"), "sku tiene AMBAS columnas (contribución + capital)");
  ok(!axisHasField("cliente", "stockUSD"), "cliente NO tiene capital (confirma que el cruce no existe en ese eje)");
  const rSku = buildTension("sku", {});
  ok(!!rSku && !rSku.unsupported, "buildTension('sku') devuelve resultado (no unsupported)");
  ok(rSku.facts.topA.length >= 5 && rSku.facts.topB.length >= 5, "top-N de ambas métricas con suficientes filas");
  ok(Array.isArray(rSku.facts.enAmbosRankings), "la intersección (enAmbosRankings) viene YA calculada, no la arma el narrador");
  const rCliente = buildTension("cliente", {});
  ok(rCliente && !!rCliente.unsupported, "buildTension('cliente') declina con `unsupported` (razón honesta)");
  ok(/no hay tabla puente/.test(rCliente.unsupported), "la razón menciona explícitamente la ausencia de tabla puente");
  const { results: rr } = runPlan({ intent: "answer", calls: [{ tool: "tensionRead", args: { dimension: "cliente" } }] }, { scenario: SC });
  ok(rr[0].coverage.supported === false && /no se miden juntas/.test(rr[0].coverage.reason), "el tool tensionRead(cliente) vía runPlan expone coverage=false con la razón honesta");
}

console.log("\n── 2 · SMOKE LLM REAL — variante SKU (cruce válido, 3 corridas) ──");
{
  let planOk = 0, guardOk = 0, nombraAmbos = 0;
  for (let run = 0; run < 3; run++) {
    const q = "¿qué SKU sostienen la contribución del negocio y cuáles tienen más capital inmovilizado? ¿hay tensión entre esos dos grupos?";
    let plan;
    try { const pr = await handlePlan({ text: q, history: [], mem: {}, scenario: SC }); if (!pr.ok) throw new Error(pr.error); plan = pr.plan; }
    catch (e) { console.log(`  run${run}: PLAN-FAIL ${e.message}`); continue; }
    const calls = Array.isArray(plan.calls) ? plan.calls : [];
    const usedTension = calls.some((c) => c.tool === "tensionRead" && (!c.args || !c.args.dimension || c.args.dimension === "sku"));
    console.log(`  run${run}: calls=${JSON.stringify(calls.map((c) => ({ tool: c.tool, dim: c.args && c.args.dimension })))}`);
    if (usedTension) planOk++; else continue;
    const { ledger, results, trace } = runPlan({ intent: plan.intent, calls }, { scenario: SC });
    const figs = ledgerBoleta(ledger);
    let narration = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      let n;
      try { const nr = await handleNarrateC({ payload: buildNarrateUserMessageC({ text: q, plan, results, ledgerFigs: figs, mem: {} }), mem: {} }); n = nr.ok ? nr.narration : null; }
      catch { n = null; }
      if (!n) continue;
      if (guardC(n, { ledger, results, trace, question: q }).ok) { narration = n; break; }
    }
    if (!narration) { console.log("     guard rechazó los 3 intentos"); continue; }
    guardOk++;
    const tensionResult = results.find((r) => r.tool === "tensionRead" || (r.facts && r.facts.enAmbosRankings));
    const enAmbos = (tensionResult && tensionResult.facts && tensionResult.facts.enAmbosRankings) || [];
    const citaAlgunEnAmbos = enAmbos.some((n) => narration.includes(n));
    if (citaAlgunEnAmbos) nombraAmbos++;
    console.log(`     GUARD_OK (${citaAlgunEnAmbos ? "cita un SKU en ambos rankings" : "no citó ninguno de la intersección"}): ${narration.slice(0, 180).replace(/\n/g, " ⏎ ")}`);
  }
  ok(planOk >= 2, `el plan elige tensionRead(sku) en ≥2/3 corridas (obtuvo ${planOk}/3)`);
  ok(guardOk >= 2, `≥2/3 corridas pasan el guard (obtuvo ${guardOk}/3)`);
}

console.log("\n── 4 · SMOKE LLM REAL — vocabulario de métricas explícito (hallazgo del re-barrido adversarial, 3 corridas) ──");
{
  // ANTES: "cruza rotación con contribución por SKU" ignoraba metricA/metricB (el catálogo no daba los field-tokens
  // válidos) y el plan caía siempre a los defaults (contribución vs capital) — respondía con confianza una pregunta
  // DISTINTA a la que se hizo. Ahora planPrompt.js enumera los tokens — el plan debe honrar lo pedido.
  //
  // owner 2026-08-03 (investigación cruzada, causa raíz confirmada): esta sección medía SOLO la capa CRUDA
  // (handlePlan() aislado, sin el resto del pipeline) — pero desde el commit que cierra este mismo hallazgo
  // (_coerceTensionArgs en answerViaOracle.js), esa NO es la capa que llega al usuario: answerViaOracle() la
  // corrige INCONDICIONALMENTE en cuanto hay 2 tokens de métrica claros y el plan ya eligió tensionRead. Medir solo
  // la capa cruda es medir la capa EQUIVOCADA — se agrega la medición de la capa CORREGIDA (la que de verdad narra)
  // como la aserción REAL de este gate, y se CONSERVA la cruda como log informativo (no se pierde visibilidad de una
  // futura regresión del LLM #1 crudo — es justo el dato que documentó este gate originalmente como 0/3).
  let honraCrudo = 0, honraCorregido = 0;
  for (let run = 0; run < 3; run++) {
    const q = "cruza rotación con contribución por SKU";
    // capa CRUDA (informativa, NO bloqueante) — handlePlan() aislado, sin _coerceTensionArgs.
    let plan = null;
    try { const pr = await handlePlan({ text: q, history: [], mem: {}, scenario: SC }); if (!pr.ok) throw new Error(pr.error); plan = pr.plan; }
    catch (e) { console.log(`  run${run} [capa cruda]: PLAN-FAIL ${e.message}`); }
    if (plan) {
      const call = (plan.calls || []).find((c) => c.tool === "tensionRead");
      const args = call && call.args ? call.args : {};
      const metricas = new Set([args.metricA, args.metricB].filter(Boolean));
      const honra = metricas.has("rotacion") && metricas.has("contribucion");
      if (honra) honraCrudo++;
      console.log(`  run${run} [capa cruda, informativo — handlePlan() SOLO]: tensionRead args=${JSON.stringify(args)} ${honra ? "✓" : "✗ (gap pre-existente del LLM #1, ya documentado — no bloquea este gate)"}`);
    }
    // capa CORREGIDA (la aserción REAL) — el MISMO texto vía answerViaOracle() con callPlan REAL (handlePlan
    // headless) — _coerceTensionArgs corre adentro, automático, exactamente como en producción. callNarrate es un
    // mock que solo CAPTURA plan.calls YA corregidos (mismo patrón `correctedCalls` de _oracle_tension_vocab_gate.mjs,
    // salvo que acá el plan crudo es REAL, no fijo a mano).
    let correctedArgs = {};
    try {
      const callPlanReal = async ({ text: t, history, mem, scenario }) => { const pr = await handlePlan({ text: t, history, mem, scenario }); return pr.ok ? pr.plan : null; };
      const callNarrateCapture = async ({ plan: p }) => { const c = (p.calls || []).find((cc) => cc.tool === "tensionRead"); correctedArgs = (c && c.args) || {}; return "texto de prueba sin cifras."; };
      await answerViaOracle({ text: q, history: [], mem: {}, scenario: SC, callPlan: callPlanReal, callNarrate: callNarrateCapture });
    } catch (e) { console.log(`  run${run} [capa corregida]: FAIL ${e.message}`); }
    const metricasCorregidas = new Set([correctedArgs.metricA, correctedArgs.metricB].filter(Boolean));
    const honraC = metricasCorregidas.has("rotacion") && metricasCorregidas.has("contribucion");
    if (honraC) honraCorregido++;
    console.log(`  run${run} [capa CORREGIDA — lo que de verdad narra/llega al usuario]: tensionRead args=${JSON.stringify(correctedArgs)} ${honraC ? "✓ honra rotación+contribución" : "✗ NO honra — esto SÍ es un fallo real, llegaría al usuario sin la métrica pedida"}`);
  }
  console.log(`  medición informativa (capa cruda, LLM #1 SOLO, sin backstop): ${honraCrudo}/3 — no bloquea este gate, es el gap pre-existente ya documentado`);
  ok(honraCorregido >= 2, `la capa CORREGIDA (post _coerceTensionArgs — lo que de verdad narra/llega al usuario) honra metricA/metricB EXPLÍCITOS en ≥2/3 corridas (obtuvo ${honraCorregido}/3)`);
}

console.log("\n── 3 · SMOKE LLM REAL — variante CLIENTE (cruce inválido, debe declinar honesto, 3 corridas) ──");
{
  let declineOk = 0, sinTotalMalAtribuido = 0;
  for (let run = 0; run < 3; run++) {
    const q = "¿qué clientes sostienen la contribución y cuáles consumen más capital? ¿hay tensión ahí?";
    let plan;
    try { const pr = await handlePlan({ text: q, history: [], mem: {}, scenario: SC }); if (!pr.ok) throw new Error(pr.error); plan = pr.plan; }
    catch (e) { console.log(`  run${run}: PLAN-FAIL ${e.message}`); continue; }
    const calls = Array.isArray(plan.calls) ? plan.calls : [];
    console.log(`  run${run}: calls=${JSON.stringify(calls.map((c) => ({ tool: c.tool, dim: c.args && c.args.dimension })))}`);
    const { ledger, results, trace } = runPlan({ intent: plan.intent, calls }, { scenario: SC });
    const figs = ledgerBoleta(ledger);
    let narration = null, sawTotalMalAtribuido = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      let n;
      try { const nr = await handleNarrateC({ payload: buildNarrateUserMessageC({ text: q, plan, results, ledgerFigs: figs, mem: {} }), mem: {} }); n = nr.ok ? nr.narration : null; }
      catch { n = null; }
      if (!n) continue;
      const g = guardC(n, { ledger, results, trace, question: q });
      if (g.violations.some((v) => v.kind === "total-mal-atribuido")) sawTotalMalAtribuido = true;
      if (g.ok) { narration = n; break; }
    }
    if (!sawTotalMalAtribuido) sinTotalMalAtribuido++;
    if (narration) {
      const declara = /no (?:hay|tengo|se mide|se miden)|no puedo cruzar|tabla puente|no está (?:medid|disponible)/i.test(narration);
      if (declara) declineOk++;
      console.log(`     GUARD_OK (${declara ? "declara el límite" : "NO declaró el límite"}): ${narration.slice(0, 180).replace(/\n/g, " ⏎ ")}`);
    } else console.log("     cayó a fallback (guard rechazó los 3 intentos) — aceptable, no cuenta como fallo de este gate");
  }
  ok(sinTotalMalAtribuido === 3, `NINGUNA corrida dispara total-mal-atribuido por el mismatch de eje (obtuvo ${sinTotalMalAtribuido}/3 limpias)`);
  ok(declineOk >= 1, `al menos 1/3 corridas declara honestamente el límite cliente↔capital cuando responde (obtuvo ${declineOk}/3)`);
}

console.log(`\n── _oracle_tension_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
