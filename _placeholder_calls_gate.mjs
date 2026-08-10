/* === _placeholder_calls_gate.mjs · GATE · placeholders sin rellenar BLOQUEAN + backstop de calls vacío en redirect ===
 * owner 2026-07-31, auditoría (defecto "Diagnóstico, causas y acciones", alto_riesgo):
 *
 * En turnos de corrección/redirect, ~1/3 de las corridas el plan deja `calls` vacío pese a que planPrompt.js lo
 * prohíbe explícitamente. Sin ninguna cifra autorizada, el narrador a veces redacta con placeholders LITERALES sin
 * rellenar ("...con un potencial de $X...", "...alcanzando $Y..."), y guardC NO lo detectaba como violación porque
 * parseFigures() solo reconoce cifras NUMÉRICAS — nada con qué comparar/rechazar el placeholder.
 *
 * FIX: (1) guardC.js agrega un chequeo nuevo (_placeholderSinRellenar) que BLOQUEA cualquier "$X"/"$Y"/"X%"
 * literal (letra mayúscula suelta, nunca una cifra real ni una sigla de 2+ letras). (2) answerViaOracle.js agrega
 * un backstop: si el plan trae intent="redirect" con calls=[], se trata como intento fallido y se reintenta
 * (mismo presupuesto de 3 intentos) antes de proceder a narrar sin datos.
 */
import { guardC } from "./src/adi/oracle/guardC.js";
import { answerViaOracle } from "./src/adi/oracle/answerViaOracle.js";

let pass = 0, fail = 0;
const ok = (cond, label) => { console.log(`  ${cond ? "✓" : "✗"} ${label}`); if (cond) pass++; else fail++; };

console.log("── 1 · guardC BLOQUEA placeholders literales sin rellenar ($X, $Y) ──");
{
  const ledger = { figs: [] };
  const g1 = guardC("Falabella tiene un potencial de $X en recuperación este trimestre.", { ledger, results: [], trace: null, question: "" });
  ok(g1.ok === false && g1.violations.some((v) => v.kind === "placeholder-sin-rellenar"), `"$X" BLOQUEA con kind="placeholder-sin-rellenar" — obtuvo ok=${g1.ok}, violations=${JSON.stringify(g1.violations)}`);
  const g2 = guardC("El margen podría alcanzar $Y si se corrige la carga.", { ledger, results: [], trace: null, question: "" });
  ok(g2.ok === false && g2.violations.some((v) => v.kind === "placeholder-sin-rellenar"), `"$Y" BLOQUEA igual — obtuvo ok=${g2.ok}, violations=${JSON.stringify(g2.violations)}`);
}

console.log("\n── 2 · REGRESIÓN — cifras y siglas REALES nunca se confunden con un placeholder ──");
{
  const figs = [{ label: "Falabella · Venta", value: "$19.4M", unit: "money", raw: 19400000, canon: "money:$19.4M" }];
  const ledger = { figs };
  const g3 = guardC("Falabella vendió $19.4M este año.", { ledger, results: [], trace: null, question: "" });
  ok(g3.ok === true, `una cifra REAL autorizada ($19.4M) NO se confunde con un placeholder — obtuvo ok=${g3.ok}, violations=${JSON.stringify(g3.violations)}`);
  const g4 = guardC("El precio está en USD, no en moneda local.", { ledger, results: [], trace: null, question: "" });
  ok(g4.ok === true, `una sigla real de 3+ letras ("USD") NO dispara el chequeo de placeholder — obtuvo ok=${g4.ok}, violations=${JSON.stringify(g4.violations)}`);
  const g5 = guardC("El margen fue del 22% este trimestre.", { ledger: { figs: [{ label: "m", value: "22%", unit: "pct", raw: 22, canon: "pct:22%" }] }, results: [], trace: null, question: "" });
  ok(g5.ok === true, `un porcentaje REAL ("22%") NO se confunde con el patrón placeholder "X%" — obtuvo ok=${g5.ok}, violations=${JSON.stringify(g5.violations)}`);
}

console.log("\n── 3 · answerViaOracle: intent=redirect con calls=[] en el 1er intento reintenta y usa el 2do (poblado) ──");
{
  let callCount = 0;
  const callPlan = async () => {
    callCount++;
    if (callCount === 1) return { intent: "redirect", mode: "default", rationale: "corrección", scope: { level: "global" }, calls: [] };
    return { intent: "redirect", mode: "default", rationale: "corrección con datos", scope: { level: "global" }, calls: [{ tool: "executiveSummary", args: {} }] };
  };
  const r = await answerViaOracle({ text: "no, te pedí del negocio completo", history: [{ role: "user", text: "x" }], mem: {}, scenario: "actual", callPlan, callNarrate: async () => "El negocio se mantiene estable este período, sin cambios relevantes que reportar." });
  ok(callCount === 2, `callPlan se invocó 2 veces (reintentó tras el calls=[] del primer intento) — obtuvo ${callCount}`);
  ok(r !== null, `la respuesta final NO es null (se recuperó con el 2do intento poblado) — obtuvo ${r === null ? "null" : "respuesta"}`);
}

console.log("\n── 4 · answerViaOracle: si LOS 3 intentos insisten en calls=[], NUNCA deja pasar un placeholder — repara honesto ──");
{
  let callCount = 0;
  const callPlan = async () => { callCount++; return { intent: "redirect", mode: "default", rationale: "corrección", scope: { level: "global" }, calls: [] }; };
  const r = await answerViaOracle({ text: "no, te pedí del negocio completo", history: [{ role: "user", text: "x" }], mem: {}, scenario: "actual", callPlan, callNarrate: async () => "Con un potencial de $X en recuperación este trimestre." });
  ok(callCount === 3, `callPlan se invocó las 3 veces del presupuesto (los 3 insistieron en calls=[]) — obtuvo ${callCount}`);
  ok(r !== null, `la respuesta NUNCA es null — se compone un mensaje honesto en vez de silencio total — obtuvo ${r === null ? "null" : "respuesta"}`);
  ok(!!r && !/\$X\b/.test(r.r.text), `el placeholder "$X" NUNCA llega al texto final — obtuvo: "${r && r.r.text}"`);
}

console.log("\n── 5 · REGRESIÓN — intent=redirect CON calls poblado desde el primer intento NO reintenta de más ──");
{
  let callCount = 0;
  const callPlan = async () => { callCount++; return { intent: "redirect", mode: "default", rationale: "corrección", scope: { level: "global" }, calls: [{ tool: "executiveSummary", args: {} }] }; };
  await answerViaOracle({ text: "no, te pedí del negocio completo", history: [{ role: "user", text: "x" }], mem: {}, scenario: "actual", callPlan, callNarrate: async () => "El negocio se mantiene estable este período." });
  ok(callCount === 1, `callPlan se invocó UNA sola vez (calls ya venía poblado, sin reintento innecesario) — obtuvo ${callCount}`);
}

console.log("\n── 6 · REGRESIÓN — intent=answer con calls=[] (legítimo, ej. ack) NO dispara el reintento de redirect ──");
{
  let callCount = 0;
  const callPlan = async () => { callCount++; return { intent: "ack", mode: "default", rationale: "instrucción de trato", calls: [], memoryUpdate: { trato: "usted" } }; };
  await answerViaOracle({ text: "trátame de usted", history: [], mem: {}, scenario: "actual", callPlan, callNarrate: async () => "debería no llamarse" });
  ok(callCount === 1, `intent="ack" con calls=[] (legítimo) NO dispara el reintento del backstop de redirect — obtuvo ${callCount}`);
}

console.log(`\n── _placeholder_calls_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
