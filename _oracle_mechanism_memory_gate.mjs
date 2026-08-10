/* === _oracle_mechanism_memory_gate.mjs · ARQUITECTURA C · GATE DE "MECANISMO CON MEMORIA ENTRE TURNOS" ===
 * owner 2026-07-29 (3er residual del punch list post-recon): "si un turno ya estableció mecanismo dominante por
 * entidad, el siguiente no debe recomendar otro mecanismo sin evidencia nueva o sin explicitar el cambio."
 * Distinto del chequeo turno-9 (_mechanismAdvisory, MISMO turno: resultados y narración del mismo call a C) — este
 * cruza la narración de HOY contra `mem.mechanismByEntity`, memoria que answerViaOracle.js escribe al final de cada
 * turno exitoso y guardC.js lee al principio del siguiente vía el param `mechanismMemory`. Mismo AVISO-no-bloqueo
 * (coherencia semántica vía regex, no una cifra — ver comentario en guardC.js).
 * 1) determinístico: guardC({mechanismMemory}) dispara/no dispara sobre fixtures fijos (sin LLM).
 * 2) determinístico: answerViaOracle con callPlan/callNarrate MOCKEADOS prueba el CABLEADO end-to-end de dos turnos
 *    — incluye el caso donde el turno 2 ADEMÁS emite un memoryUpdate (el bug real que este mismo trabajo encontró:
 *    applyMemoryUpdate reconstruye `mem` desde una lista fija de campos y no preservaba mechanismByEntity).
 */
import { guardC } from "./src/adi/oracle/guardC.js";
import { answerViaOracle } from "./src/adi/oracle/answerViaOracle.js";

let pass = 0, fail = 0;
const ok = (cond, label) => { console.log(`  ${cond ? "✓" : "✗"} ${label}`); if (cond) pass++; else fail++; };

console.log("── 1 · DETERMINÍSTICO — guardC dispara/no dispara sobre fixtures fijos de mechanismMemory ──");
{
  // sin evidencia nueva este turno (results vacío) + memoria dice "costo estructural" para Acme + la acción prioriza rebate → dispara
  const g1 = guardC("Deberías renegociar el rebate de Acme como primer paso.", { ledger: { figs: [] }, results: [], trace: null, question: "", mechanismMemory: { Acme: "costo estructural" } });
  ok(g1.ok, "el aviso nunca bloquea");
  ok(g1.advisories.some((a) => a.kind === "mecanismo-memoria-inconsistente"), "MALO: memoria dice costo, acción (sin evidencia nueva) nombra rebate sin conector → dispara");

  // misma memoria, pero la acción SÍ nombra costo/precio → no dispara
  const g2 = guardC("Deberías ajustar el costo de Acme como primer paso.", { ledger: { figs: [] }, results: [], trace: null, question: "", mechanismMemory: { Acme: "costo estructural" } });
  ok(!g2.advisories.some((a) => a.kind === "mecanismo-memoria-inconsistente"), "BUENO: acción consistente con lo memorizado → no dispara");

  // misma memoria, acción nombra rebate PERO con conector causal explícito → excepción, no dispara
  const g3 = guardC("Aunque el costo aprieta, no es negociable a corto plazo, así que deberías renegociar el rebate de Acme.", { ledger: { figs: [] }, results: [], trace: null, question: "", mechanismMemory: { Acme: "costo estructural" } });
  ok(!g3.advisories.some((a) => a.kind === "mecanismo-memoria-inconsistente"), "BUENO: conector causal explícito → excepción, no dispara");

  // misma memoria, acción nombra rebate PERO el texto explicita el cambio → excepción, no dispara
  const g4 = guardC("A diferencia de lo anterior, ahora deberías renegociar el rebate de Acme.", { ledger: { figs: [] }, results: [], trace: null, question: "", mechanismMemory: { Acme: "costo estructural" } });
  ok(!g4.advisories.some((a) => a.kind === "mecanismo-memoria-inconsistente"), "BUENO: cambio explicitado en el texto → excepción, no dispara");

  // EVIDENCIA NUEVA este turno (results SÍ trae a Acme con un mecanismo, aunque sea el mismo o distinto) → no dispara
  // este chequeo (el que aplicaría es el de MISMO turno, _mechanismAdvisory, que es un aviso distinto)
  const resultsFresh = [{ tool: "marginRead", facts: { margin: { panel: { rows: [{ nombre: "Acme", margen: 18, mecanismo: "carga comercial/rebate" }] } } } }];
  const g5 = guardC("Deberías renegociar el rebate de Acme como primer paso.", { ledger: { figs: [] }, results: resultsFresh, trace: null, question: "", mechanismMemory: { Acme: "costo estructural" } });
  ok(!g5.advisories.some((a) => a.kind === "mecanismo-memoria-inconsistente"), "BUENO: evidencia NUEVA este turno para Acme → no aplica el chequeo de memoria (aplica el de mismo-turno, no este)");

  // memoria de una entidad DISTINTA a la nombrada → no dispara (no hay de qué hablar)
  const g6 = guardC("Deberías renegociar el rebate de Beta como primer paso.", { ledger: { figs: [] }, results: [], trace: null, question: "", mechanismMemory: { Acme: "costo estructural" } });
  ok(!g6.advisories.some((a) => a.kind === "mecanismo-memoria-inconsistente"), "sin mención de la entidad memorizada → no dispara");

  // sin mechanismMemory (turno 1, mem vacío) → no dispara nunca, ni crashea
  const g7 = guardC("Deberías renegociar el rebate de Acme como primer paso.", { ledger: { figs: [] }, results: [], trace: null, question: "" });
  ok(g7.ok && !g7.advisories.some((a) => a.kind === "mecanismo-memoria-inconsistente"), "sin mechanismMemory (turno 1) → no dispara, no crashea");

  // dirección inversa: memoria dice carga, acción nombra costo sin conector → dispara
  const g8 = guardC("Deberías ajustar el costo de Beta como primer paso.", { ledger: { figs: [] }, results: [], trace: null, question: "", mechanismMemory: { Beta: "carga comercial/rebate" } });
  ok(g8.advisories.some((a) => a.kind === "mecanismo-memoria-inconsistente"), "MALO (dirección inversa): memoria dice carga, acción nombra costo sin conector → dispara");
}

console.log("\n── 2 · DETERMINÍSTICO — cableado end-to-end de 2 turnos vía answerViaOracle (callPlan/callNarrate MOCKEADOS) ──");
console.log("   (runPlan NO está inyectado — corre contra el dataset REAL, así que el turno 1 descubre una entidad real en vez de asumir un nombre fijo)");
{
  const PLAN1 = { intent: "answer", calls: [{ tool: "marginRead", args: { dimension: "cliente", focus: "bajo_benchmark" } }] };
  const callPlan1 = async () => PLAN1;
  const callNarrate1 = async () => "Este es un resumen de margen sin ninguna recomendación, solo para establecer el dato.";

  const r1 = await answerViaOracle({ text: "¿cómo viene el margen de los clientes bajo benchmark?", history: [], mem: {}, scenario: "actual", callPlan: callPlan1, callNarrate: callNarrate1 });
  ok(r1 && r1.r && r1.r.route === "oracle", "turno 1 responde por C");
  const entries1 = (r1 && r1.mem && r1.mem.mechanismByEntity) ? Object.entries(r1.mem.mechanismByEntity) : [];
  ok(entries1.length > 0, `turno 1 escribe al menos 1 entidad en mem.mechanismByEntity (dataset real) — obtuvo ${JSON.stringify(r1 && r1.mem && r1.mem.mechanismByEntity)}`);
  const [realName, realMech] = entries1[0] || [null, null];
  const esCosto = realMech === "costo estructural";
  const accionOpuesta = esCosto ? `Deberías renegociar el rebate de ${realName} como primer paso.` : `Deberías ajustar el costo de ${realName} como primer paso.`;

  // turno 2: mem trae lo del turno 1, PERO el plan de este turno no vuelve a traer evidencia (calls:[] → results:[]
  // siempre, sea cual sea el dataset real) — la narración recomienda el mecanismo OPUESTO al memorizado, sin
  // conector ni cambio explícito.
  const PLAN2 = { intent: "ack", calls: [] };
  const callPlan2 = async () => PLAN2;
  let guardSpy = null;
  const callNarrate2 = async ({ mem }) => { guardSpy = mem; return accionOpuesta; };
  const r2 = await answerViaOracle({ text: "¿y algo más?", history: [], mem: r1.mem, scenario: "actual", callPlan: callPlan2, callNarrate: callNarrate2 });
  ok(r2 && r2.r && r2.r.route === "oracle", "turno 2 también responde por C (el aviso no bloquea)");
  ok(guardSpy && guardSpy.mechanismByEntity && guardSpy.mechanismByEntity[realName] === realMech, `el mecanismo de ${realName} llegó VIVO al turno 2 (mem pasado a callNarrate) — obtuvo ${JSON.stringify(guardSpy && guardSpy.mechanismByEntity)}`);
  const gCheck = guardC(accionOpuesta, { ledger: { figs: [] }, results: [], trace: null, question: "", mechanismMemory: guardSpy.mechanismByEntity });
  ok(gCheck.advisories.some((a) => a.kind === "mecanismo-memoria-inconsistente"), `el guard del turno 2, con la memoria REAL propagada, SÍ hubiera marcado la inconsistencia para ${realName}`);

  // turno 2b: mismo escenario pero el plan del turno 2 ADEMÁS emite un memoryUpdate (ej. detecta trato) — el bug
  // real que este trabajo encontró y arregló: applyMemoryUpdate no preservaba mechanismByEntity.
  const PLAN2B = { intent: "ack", calls: [], memoryUpdate: { trato: "usted" } };
  const callPlan2b = async () => PLAN2B;
  let guardSpy2b = null;
  const callNarrate2b = async ({ mem }) => { guardSpy2b = mem; return accionOpuesta; };
  const r2b = await answerViaOracle({ text: "¿y algo más?", history: [], mem: r1.mem, scenario: "actual", callPlan: callPlan2b, callNarrate: callNarrate2b });
  ok(r2b && r2b.r && r2b.r.route === "oracle", "turno 2b (con memoryUpdate simultáneo) también responde por C");
  ok(guardSpy2b && guardSpy2b.mechanismByEntity && guardSpy2b.mechanismByEntity[realName] === realMech, `REGRESIÓN DEL BUG REAL: mechanismByEntity.${realName} sobrevive aunque este turno TAMBIÉN traiga un memoryUpdate — obtuvo ${JSON.stringify(guardSpy2b && guardSpy2b.mechanismByEntity)}`);
  ok(guardSpy2b && guardSpy2b.preferencias && guardSpy2b.preferencias.trato === "usted", "y el memoryUpdate del turno 2b (trato=usted) también se aplicó normalmente — ninguno de los dos pisó al otro");

  // turno 2c: SÍ hay evidencia nueva de la misma entidad este turno (mismo tool real) → el chequeo de MEMORIA no
  // debe aplicar (aplicaría el de mismo-turno, uno distinto) y mem.mechanismByEntity se refresca para el turno 3.
  const PLAN2C = { intent: "answer", calls: [{ tool: "marginRead", args: { dimension: "cliente", focus: "bajo_benchmark" } }] };
  const callPlan2c = async () => PLAN2C;
  const callNarrate2c = async () => "Este es otro resumen de margen sin recomendación, solo para refrescar el dato.";
  const r2c = await answerViaOracle({ text: "actualiza el panel de margen", history: [], mem: r1.mem, scenario: "actual", callPlan: callPlan2c, callNarrate: callNarrate2c });
  ok(r2c && r2c.r && r2c.r.route === "oracle", "turno 2c responde por C (evidencia nueva del mismo tool real)");
  const entries2c = (r2c && r2c.mem && r2c.mem.mechanismByEntity) ? Object.entries(r2c.mem.mechanismByEntity) : [];
  ok(entries2c.length > 0, `turno 2c mantiene/refresca mem.mechanismByEntity con evidencia fresca — obtuvo ${JSON.stringify(r2c && r2c.mem && r2c.mem.mechanismByEntity)}`);
}

console.log(`\n── _oracle_mechanism_memory_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
