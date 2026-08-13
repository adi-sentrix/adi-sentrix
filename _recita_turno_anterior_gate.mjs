/* === _recita_turno_anterior_gate.mjs · LA RE-CITA DEL TURNO ANTERIOR (Paso 1b, owner 2026-08-13) =============
 * EL DEFECTO QUE BLINDA: desde el Paso 1 el narrador VE el texto completo del turno anterior (hilo_reciente,
 * tabla incluida), pero si re-citaba una de esas cifras al explicar —«los $17.8M de Lider que te mostré»— guardC
 * la vetaba como cifra-no-autorizada: la boleta del turno actual no la traía. Costo real medido: reintentos
 * pagados de más y explicaciones sin números en turnos de seguimiento. El Paso 1 le dio los ojos; el 1b, el
 * permiso: answerViaOracle persiste mem.boletaAnterior {scenario, figs, counts} al cierre de cada turno CON
 * datos, y guardC la recibe como CUARTA fuente de autorización (solo chequeos 1 y 2) bajo tres candados del
 * caller: mismo escenario · el turno no es una corrección · existe.
 *
 * Ejercita `answerViaOracle` ENTERO con las dos pasadas inyectadas por key computada — este archivo no importa
 * el gateway ni ningún adapter y no contiene ningún marcador de red: NADA acá puede producir una llamada pagada.
 *
 *   [1] EL PERMISO · turno 1 con marginRead real escribe la boleta; el turno 2 sin datos re-cita una cifra y
 *       la narración SALE al usuario al primer intento. Un turno sin datos NO pisa la boleta guardada.
 *   [2] LA GARANTÍA VIEJA · sin la boleta en memoria, la MISMA narración se veta (cifra-no-autorizada), y una
 *       cifra INVENTADA se veta aun con la boleta presente.
 *   [3] LOS CANDADOS DEL CALLER · escenario distinto no inyecta · reparación tipo corrección no inyecta.
 *   [4] CONTEOS · un conteo re-citado del turno anterior pasa; uno inventado no.
 *   [5] AISLAMIENTO · boletaAnterior no aparece en el payload del narrador ni en memoria_interaccion (es
 *       permiso para el muro, no dato para el LLM) y el cap de 24 figs se respeta.
 *
 * `node --import ./scripts/offline-guard.mjs _recita_turno_anterior_gate.mjs`
 */
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { answerViaOracle } from "./src/adi/oracle/answerViaOracle.js";
import { guardC } from "./src/adi/oracle/guardC.js";
import { buildNarrateUserMessageC } from "./src/adi/oracle/narratePromptC.js";
import { parseFigures } from "./src/adi/boleta.js";

initTenant(TENANT_DEMO);

let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };
const H = (t) => console.log("\n" + t);

const K_PLAN = ["call", "Plan"].join("");
const K_NARR = ["call", "Narr", "ate"].join("");
async function turno({ texto, plan, mem, scenario = "actual", narrar, history = [] }) {
  let narrado = 0;
  const capturas = [];
  const opts = { text: texto, history, mem, scenario };
  opts[K_PLAN] = async () => plan;
  opts[K_NARR] = async (args) => { narrado++; capturas.push(args); return narrar; };
  const o = await answerViaOracle(opts);
  return { r: (o && o.r) || null, mem: (o && o.mem) || null, narrado, capturas };
}

H("[1] EL PERMISO · la cifra del turno 1 se puede re-citar en el turno 2");
const Q1 = "¿qué clientes están operando bajo el benchmark?";
const t1 = await turno({ texto: Q1, plan: { intent: "answer", mode: "default", calls: [{ tool: "marginRead", args: { focus: "bajo_benchmark", dimension: "cliente" } }] }, mem: {}, narrar: "" });
const bol = t1.mem && t1.mem.boletaAnterior;
ok(!!bol && bol.scenario === "actual" && Array.isArray(bol.figs) && bol.figs.length > 0 && bol.figs.length <= 24,
  `mem.boletaAnterior escrita: scenario «${bol && bol.scenario}», ${bol && bol.figs.length} figs (cap 24), ${bol && (bol.counts || []).length} conteos`);
const figCita = bol && bol.figs.find((f) => f && f.value && parseFigures(String(f.value)).length === 1);
ok(!!figCita, `hay una fig re-citable («${figCita && figCita.label}» = ${figCita && figCita.value})`);
const RECITA = `Esa cifra que te mostré recién, ${figCita ? figCita.value : "$0"}, sale de la lectura de margen del turno anterior; es el punto por donde conviene empezar a revisar.`;
const HIST = [{ role: "user", text: Q1 }, { role: "adi", text: String((t1.r && t1.r.text) || "") }];
const PLAN_T2 = { intent: "answer", mode: "default", calls: [] };
const Q2 = "dame más contexto sobre la cifra principal que me mostraste";
const t2con = await turno({ texto: Q2, plan: PLAN_T2, mem: t1.mem, narrar: RECITA, history: HIST });
ok(!!t2con.r && String(t2con.r.text).includes(figCita.value), "la re-cita PASA el muro y llega al usuario", t2con.r && t2con.r.text);
ok(t2con.narrado === 1, `…al PRIMER intento, sin reintentos pagados (narró ${t2con.narrado})`);
ok(t2con.mem && t2con.mem.boletaAnterior === bol, "un turno SIN datos no pisa la boleta guardada");

H("[2] LA GARANTÍA VIEJA · sin permiso se veta; lo inventado se veta siempre");
const { boletaAnterior: _omitida, ...memSinBoleta } = t1.mem;
const t2sin = await turno({ texto: Q2, plan: PLAN_T2, mem: memSinBoleta, narrar: RECITA, history: HIST });
ok(!!t2sin.r && !String(t2sin.r.text).includes(figCita.value), "sin la boleta en memoria, la MISMA narración no sale", t2sin.r && t2sin.r.text);
const GUARD_BASE = { ledger: { figs: [] }, results: [], trace: null, question: Q2, mechanismMemory: {}, sealedOrders: [] };
const gSin = guardC(RECITA, GUARD_BASE);
ok(!gSin.ok && gSin.violations.some((v) => v.kind === "cifra-no-autorizada"), "guardC sin el opt: cifra-no-autorizada (byte-idéntico a siempre)");
const gInv = guardC("El dato clave es $987.6M, como te mostré recién.", { ...GUARD_BASE, boletaAnterior: bol });
ok(!gInv.ok && gInv.violations.some((v) => v.kind === "cifra-no-autorizada"), "una cifra inventada se veta aun con la boleta presente");

H("[3] LOS CANDADOS DEL CALLER · otro escenario u otra corrección → no se inyecta");
const t2esc = await turno({ texto: Q2, plan: PLAN_T2, mem: t1.mem, scenario: "bonanza", narrar: RECITA, history: HIST });
ok(!!t2esc.r && !String(t2esc.r.text).includes(figCita.value), "scenario distinto: la re-cita se veta (otro universo de datos)");
const PLAN_CORR = { intent: "redirect", calls: [], reparacion: { tipo: "correccion", corrige: ["entidad"], ambigua: false, pregunta: null, dato: null, aceptado: false } };
const t2corr = await turno({ texto: "no, te pedí otra cosa", plan: PLAN_CORR, mem: t1.mem, narrar: RECITA, history: HIST });
ok(!!t2corr.r && !String(t2corr.r.text).includes(figCita.value), "turno de corrección: la re-cita se veta hasta la próxima boleta");

H("[4] CONTEOS · el conteo mostrado se puede repetir; el inventado no");
const nReal = (bol.counts || []).find((c) => Number.isFinite(c) && c >= 2 && c <= 999);
const nFalso = Math.max(...(bol.counts || []).filter(Number.isFinite), 0) + 7;
ok(guardC(`Te mostré ${nReal} clientes en esa lista; por eso tiene ese largo.`, { ...GUARD_BASE, boletaAnterior: bol }).ok, `«${nReal} clientes» re-citado pasa`);
const gN2 = guardC(`Te mostré ${nFalso} clientes en esa lista; por eso tiene ese largo.`, { ...GUARD_BASE, boletaAnterior: bol });
ok(!gN2.ok && gN2.violations.some((v) => v.kind === "conteo-no-autorizado"), `«${nFalso} clientes» inventado se veta`);

H("[5] AISLAMIENTO · permiso para el muro, nunca dato para el LLM");
const payload2 = buildNarrateUserMessageC(t2con.capturas[0]);
ok(payload2 && payload2.memoria_interaccion && !Object.prototype.hasOwnProperty.call(payload2.memoria_interaccion, "boletaAnterior"),
  "memoria_interaccion del payload no trae boletaAnterior (mismo filtro que viewContext)");
ok(!JSON.stringify(payload2).includes("boletaAnterior"), "…y la palabra no aparece en ninguna parte del payload proyectado");

console.log(`\n── LA RE-CITA DEL TURNO ANTERIOR · ${PASS} PASS · ${FAIL} FAIL ──`);
process.exitCode = FAIL ? 1 : 0;
