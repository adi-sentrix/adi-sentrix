/* === _periodo_declarado_gate.mjs · REQUISITO 3 · "pase quirúrgico de confiabilidad" (owner 2026-07-29) ===
 * "Toda respuesta numérica debe declarar período o fecha de corte." Lockea la GARANTÍA DETERMINÍSTICA (no un
 * chequeo que bloquea — ver comentario en guardC.js): (1) toolRunner.js estampa `facts.periodo` en toda tool con
 * boleta real, "año cerrado" salvo inventoryStatus ("foto a hoy") · nunca en defineConcept (no numérico) ni en
 * trend (ya trae marco_temporal propio); (2) ensurePeriodoDeclared agrega la cláusula SOLO si falta (no duplica
 * si el LLM ya lo dijo); (3) 100% de las respuestas reales (LLM, en vivo) terminan declarando el período —
 * medido con una compliance run, comparando contra el ~33% de fallback que un guard BLOQUEANTE producía (hallazgo
 * real de este mismo pase, documentado en el comentario de guardC.js).
 */
import fs from "fs";
for (const ln of fs.readFileSync(".env", "utf8").split(/\r?\n/)) { const m = ln.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
import { runPlan } from "./src/adi/oracle/toolRunner.js";
import { periodosEsperados, ensurePeriodoDeclared, periodoDeclarado } from "./src/adi/oracle/guardC.js";
import { answerViaOracle } from "./src/adi/oracle/answerViaOracle.js";
import { handlePlan, handleNarrateC } from "./src/adi/llm/gatewayCore.js";
import { buildNarrateUserMessageC } from "./src/adi/oracle/narratePromptC.js";

let pass = 0, fail = 0;
const ok = (cond, label) => { console.log(`  ${cond ? "✓" : "✗"} ${label}`); if (cond) pass++; else fail++; };

console.log("── 1 · DETERMINÍSTICO — toolRunner.js estampa el período correcto por tipo de tool ──");
{
  const g = runPlan({ intent: "grid", calls: [{ tool: "gridTable", args: { dimension: "cliente", limit: 5 } }] }, { scenario: "actual" });
  ok(g.results[0].facts.periodo === "año cerrado — los 12 meses ya ocurrieron", "gridTable → periodo anual");
  const inv = runPlan({ intent: "inv", calls: [{ tool: "inventoryStatus", args: { focus: "frenado" } }] }, { scenario: "actual" });
  ok(/foto de inventario a hoy/.test(inv.results[0].facts.periodo || ""), "inventoryStatus → periodo 'foto a hoy' (distinto del anual)");
  const def = runPlan({ intent: "define", calls: [{ tool: "defineConcept", args: { concept: "margen" } }] }, { scenario: "actual" });
  ok(def.results[0].facts.periodo === undefined, "defineConcept → sin periodo (no es numérico, sin boleta)");
  const trend = runPlan({ intent: "trend", calls: [{ tool: "trend", args: { metric: "ventas", entity: "Falabella", period: "mes a mes" } }] }, { scenario: "actual" });
  ok(trend.results[0].facts.periodo === undefined && !!trend.results[0].facts.marco_temporal, "trend → sin periodo genérico (ya trae marco_temporal propio, no se pisa)");
}

console.log("\n── 2 · DETERMINÍSTICO — periodosEsperados/ensurePeriodoDeclared ──");
{
  const g = runPlan({ intent: "grid", calls: [{ tool: "gridTable", args: { dimension: "cliente", limit: 5 } }] }, { scenario: "actual" });
  const periodos = periodosEsperados(g.results);
  ok(JSON.stringify(periodos) === JSON.stringify(["anual"]), `periodosEsperados → ["anual"] (obtuvo ${JSON.stringify(periodos)})`);
  ok(periodosEsperados([]).length === 0, "sin results (turno ack/define sin calls) → periodosEsperados=[] (no aplica)");

  const yaLoDice = "Falabella lidera en el año cerrado con $19.4M.";
  ok(ensurePeriodoDeclared(yaLoDice, ["anual"]) === yaLoDice, "si el LLM YA declaró el período, ensurePeriodoDeclared NO duplica ni modifica");

  const noLoDice = "Falabella lidera con $19.4M en ventas.";
  const fixed = ensurePeriodoDeclared(noLoDice, ["anual"]);
  ok(fixed !== noLoDice && /a[nñ]o cerrado/i.test(fixed), `si NO lo declaró, se agrega la cláusula (obtuvo "${fixed}")`);
  ok(fixed.startsWith(noLoDice), "sin pregunta al final: el texto original queda intacto, la cláusula se agrega DESPUÉS (nunca se reescribe la respuesta)");

  ok(ensurePeriodoDeclared("cualquier texto", []) === "cualquier texto", "periodos=[] (turno sin cifras reales) → texto intacto, no agrega nada");

  // BUG real cazado en vivo (owner 2026-07-29, verificando trabajo de otra sesión — _oracle_provider_certification_gate
  // lo detectó): modo=clarify DEBE cerrar con "?" — agregar la cláusula al final le robaba el cierre de pregunta
  // a la última oración ("¿...ejemplo?" pasaba a terminar en "(Datos del año cerrado.)"). Si el texto YA cierra con
  // pregunta, la cláusula va AL PRINCIPIO, nunca después del "?" final.
  const conPregunta = "Te lo explico simple: la carga comercial es lo que le cobrás de más. ¿Querés un ejemplo?";
  const fixedPregunta = ensurePeriodoDeclared(conPregunta, ["anual"]);
  ok(/\?\s*$/.test(fixedPregunta), `con pregunta al final: el "?" SIGUE siendo el último carácter (obtuvo "...${fixedPregunta.slice(-40)}")`);
  ok(fixedPregunta.endsWith(conPregunta), "con pregunta al final: la cláusula va ANTES, el texto original queda intacto y al final tal cual");
}

console.log("\n── 3 · SMOKE LLM REAL — compliance run (8 corridas, comparando contra periodosEsperados REAL de ese turno) ──");
// mide contra `periodos` de ESE turno específico (no un booleano global): si el plan de esa corrida no trajo
// ninguna tool con cifras reales (ej. declinó por completo, coverage.supported=false en todas las calls),
// periodosEsperados=[] y NO hay nada que declarar — exigir la frase ahí sería un falso positivo del gate, no un
// hueco de la garantía. La garantía es "cuando HAY período esperado, SIEMPRE se declara", no "todo texto lo dice".
{
  const callPlan = async ({ text, history, mem, scenario }) => { const pr = await handlePlan({ text, history, mem, scenario }); return pr.ok ? pr.plan : null; };
  const QS = ["¿cuál es el margen de Falabella?", "¿qué clientes están bajo el benchmark de margen?", "¿cómo viene la contribución no capturada?", "dame el estado del inventario"];
  let responded = 0, esperabaPeriodo = 0, declared = 0;
  for (const q of QS) for (let i = 0; i < 2; i++) {
    let capturedResults = null;
    const callNarrate = async (args) => { capturedResults = args.results; const nr = await handleNarrateC({ payload: buildNarrateUserMessageC(args), mem: args.mem }); return nr.ok ? nr.narration : null; };
    const r = await answerViaOracle({ text: q, history: [], mem: {}, scenario: "actual", callPlan, callNarrate });
    if (!r) continue;
    responded++;
    // resultados de ESTE turno específico (capturados de la MISMA llamada que answerViaOracle usó internamente —
    // no una segunda muestra del plan, que podría variar y desincronizar la medición del texto real).
    const periodos = periodosEsperados(capturedResults || []);
    // owner-audit 2026-07-30: usa la MISMA función que la garantía real (periodoDeclarado, ver guardC.js) en vez
    // de un regex propio del gate — antes desincronizado de _PERIODO_FAMILIAS.keywords (le faltaban variantes
    // como "ya transcurrido"/"año fiscal"/"hoy" a secas), lo que producía falsos negativos de MEDICIÓN: el
    // narrador SÍ declaraba el período con una frase válida, ensurePeriodoDeclared lo reconocía bien y no
    // duplicaba nada, pero el regex angosto del gate no la reconocía y contaba como falla.
    const tieneFrase = periodos.length ? periodoDeclarado(r.r.text, periodos) : false;
    if (periodos.length) { esperabaPeriodo++; if (tieneFrase) declared++; }
  }
  console.log(`  ${responded}/${QS.length * 2} corridas respondieron · ${esperabaPeriodo} esperaban período · ${declared}/${esperabaPeriodo} lo declaran`);
  ok(responded > 0, "al menos una corrida respondió");
  ok(esperabaPeriodo > 0, "al menos una corrida tuvo cifras reales que requerían período (el gate ejercitó la garantía, no midió el vacío)");
  ok(declared === esperabaPeriodo, `de las que SÍ esperaban período, el 100% lo declara — ${declared}/${esperabaPeriodo}`);
}

console.log(`\n── _periodo_declarado_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
