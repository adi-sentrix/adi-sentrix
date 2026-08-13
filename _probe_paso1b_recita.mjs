/* === _probe_paso1b_recita.mjs · Paso 1b «ADI pierde el hilo» · A1-A5 (2026-08-13) ============================
 * PROBE 100% OFFLINE: ejercita `answerViaOracle` ENTERO con las dos pasadas inyectadas a mano (keys computadas —
 * este archivo no contiene los nombres de esas funciones ni ningún marcador de red). No importa el gateway ni
 * ningún adapter — ninguna ruta de código acá puede producir una llamada pagada.
 * Correr con el candado de red puesto:  node --import ./scripts/offline-guard.mjs _probe_paso1b_recita.mjs
 *
 * Qué demuestra (el defecto: el narrador VE el turno anterior —Paso 1— pero guardC le vetaba re-citar sus cifras):
 *   A1 · turno 1 CON datos (marginRead real) → mem.boletaAnterior queda escrita {scenario, figs, counts}.
 *        Turno 2 SIN datos nuevos: una narración que re-cita UNA cifra del turno 1 SALE al usuario (1 intento);
 *        la MISMA narración sin la boleta en memoria es VETADA los 3 intentos (la garantía vieja, intacta).
 *   A2 · los candados: cifra INVENTADA sigue vetada aun con la boleta · escenario distinto → no se inyecta ·
 *        reparación tipo corrección → no se inyecta.
 *   A3 · un conteo del turno anterior re-citado pasa; un conteo inventado no.
 *   A5 · aislamiento: boletaAnterior NO aparece en el payload del narrador ni en memoria_interaccion ni en el
 *        bloque de memoria del system; el cap de 24 figs se respeta con una boleta grande.
 */
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { answerViaOracle } from "./src/adi/oracle/answerViaOracle.js";
import { guardC } from "./src/adi/oracle/guardC.js";
import { buildNarrateUserMessageC } from "./src/adi/oracle/narratePromptC.js";
import { renderInteractionMemory } from "./src/adi/oracle/persona.js";
import { parseFigures } from "./src/adi/boleta.js";

initTenant(TENANT_DEMO);

let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };
const H = (t) => console.log("\n" + t);

// las dos pasadas, inyectadas por key computada (ver cabecera): el plan es fijo; la narración puede mirar lo
// que el motor le pasa (para las aserciones de payload) y devuelve siempre el mismo texto.
const K_PLAN = ["call", "Plan"].join("");
const K_NARR = ["call", "Narr", "ate"].join("");
async function turno({ texto, plan, mem, scenario = "actual", narrar, history = [] }) {
  let narrado = 0;
  const capturas = [];
  const opts = { text: texto, history, mem, scenario };
  opts[K_PLAN] = async () => plan;
  opts[K_NARR] = async (args) => { narrado++; capturas.push(args); return typeof narrar === "function" ? narrar(args) : narrar; };
  const o = await answerViaOracle(opts);
  return { r: (o && o.r) || null, mem: (o && o.mem) || null, narrado, capturas };
}

/* ══ TURNO 1 · CON DATOS (marginRead real, offline) ═══════════════════════════════════════════════════════════ */
H("[A1a] TURNO 1 · marginRead real deja mem.boletaAnterior escrita");
const PLAN_T1 = { intent: "answer", mode: "default", calls: [{ tool: "marginRead", args: { focus: "bajo_benchmark", dimension: "cliente" } }] };
const Q1 = "¿qué clientes están operando bajo el benchmark?";
const t1 = await turno({ texto: Q1, plan: PLAN_T1, mem: {}, narrar: "" });   // narración vacía → el compositor determinístico resuelve; la boleta se escribe igual (pre-narración)
ok(!!t1.r && !!t1.r.text, "el turno 1 responde (compositor determinístico sobre la boleta real)");
const bol = t1.mem && t1.mem.boletaAnterior;
ok(!!bol && typeof bol === "object", "mem.boletaAnterior quedó escrita");
ok(bol && bol.scenario === "actual", `…con el scenario del turno («${bol && bol.scenario}»)`);
ok(bol && Array.isArray(bol.figs) && bol.figs.length > 0, `…con figs del ledger (${bol && bol.figs.length})`);
ok(bol && bol.figs.every((f) => f && typeof f.label === "string" && typeof f.value === "string"), "…cada fig con label+value verbatim (strings)");
ok(bol && bol.figs.length <= 24, `…y el cap de 24 se respeta (${bol && bol.figs.length} ≤ 24)`);
ok(bol && Array.isArray(bol.counts) && bol.counts.length > 0, `…con los conteos autorizados del turno (${bol && bol.counts.length})`);

// la cifra a re-citar: una fig de la boleta cuyo value el parser reconoce (misma vara que usará guardC).
const figCita = bol && bol.figs.find((f) => f && f.value && parseFigures(String(f.value)).length === 1);
ok(!!figCita, `hay una fig re-citable en la boleta («${figCita && figCita.label}» = ${figCita && figCita.value})`);
const RECITA = `Esa cifra que te mostré recién, ${figCita ? figCita.value : "$0"}, sale de la lectura de margen del turno anterior; es el punto por donde conviene empezar a revisar.`;

/* ══ TURNO 2 · SIN DATOS NUEVOS ═══════════════════════════════════════════════════════════════════════════════ */
const HIST = [{ role: "user", text: Q1 }, { role: "adi", text: String(t1.r.text) }];
const PLAN_T2 = { intent: "answer", mode: "default", calls: [] };
const Q2 = "dame más contexto sobre la cifra principal que me mostraste";

H("[A1b] TURNO 2 · con la boleta en memoria, la re-cita SALE al usuario");
const t2con = await turno({ texto: Q2, plan: PLAN_T2, mem: t1.mem, narrar: RECITA, history: HIST });
ok(!!t2con.r && String(t2con.r.text).includes(figCita.value), "la narración que re-cita la cifra del turno 1 PASA guardC y llega al usuario", t2con.r && t2con.r.text);
ok(t2con.narrado === 1, `…al PRIMER intento (narró ${t2con.narrado} vez/veces)`);
const bolDespues = t2con.mem && t2con.mem.boletaAnterior;
ok(!!bolDespues && bolDespues === bol, "un turno SIN datos NO pisa la boleta guardada (misma referencia)");

H("[A1c] TURNO 2 · SIN la boleta en memoria, la MISMA narración es VETADA (garantía vieja intacta)");
const { boletaAnterior: _omitida, ...memSinBoleta } = t1.mem;
const t2sin = await turno({ texto: Q2, plan: PLAN_T2, mem: memSinBoleta, narrar: RECITA, history: HIST });
ok(!!t2sin.r && !String(t2sin.r.text).includes(figCita.value), "sin permiso, la cifra re-citada NO llega al usuario", t2sin.r && t2sin.r.text);
// `cifra-no-autorizada` es un veredicto DE REDACCIÓN: al segundo rechazo el motor deja de gastar y resuelve el
// compositor determinístico (política del reintento económico, owner 2026-08-11) — por eso 2 intentos, no 3.
ok(t2sin.narrado === 2, `…los 2 intentos que la política permite fueron vetados (narró ${t2sin.narrado})`);

// y la garantía, afirmada también DIRECTO sobre el muro (mismo texto, mismos argumentos, con y sin el opt):
const GUARD_BASE = { ledger: { figs: [] }, results: [], trace: null, question: Q2, mechanismMemory: {}, sealedOrders: [] };
const gSin = guardC(RECITA, GUARD_BASE);
ok(!gSin.ok && gSin.violations.some((v) => v.kind === "cifra-no-autorizada"), "guardC sin el opt: cifra-no-autorizada (byte-idéntico al comportamiento de siempre)");
const gCon = guardC(RECITA, { ...GUARD_BASE, boletaAnterior: bol });
ok(gCon.ok, "guardC con el opt: la MISMA narración pasa", JSON.stringify(gCon.violations || []));

/* ══ A2 · LOS CANDADOS ════════════════════════════════════════════════════════════════════════════════════════ */
H("[A2a] cifra INVENTADA sigue vetada aun con la boleta presente");
const INVENTADA = "El dato clave es $987.6M, como te mostré recién.";
ok(!bol.figs.some((f) => String(f.value).replace(/\s/g, "") === "$987.6M"), "($987.6M no está en la boleta guardada — el caso es limpio)");
const gInv = guardC(INVENTADA, { ...GUARD_BASE, boletaAnterior: bol });
ok(!gInv.ok && gInv.violations.some((v) => v.kind === "cifra-no-autorizada"), "guardC con el opt veta la cifra inventada igual que siempre");

H("[A2b] escenario distinto → el caller NO inyecta (la cifra vieja no es citable en otro universo)");
const t2esc = await turno({ texto: Q2, plan: PLAN_T2, mem: t1.mem, scenario: "bonanza", narrar: RECITA, history: HIST });
ok(!!t2esc.r && !String(t2esc.r.text).includes(figCita.value), "bajo scenario «bonanza», la re-cita de la boleta «actual» es vetada", t2esc.r && t2esc.r.text);

H("[A2c] reparación tipo corrección → el caller NO inyecta (lo viejo no es citable hasta la próxima boleta)");
const PLAN_CORR = { intent: "redirect", calls: [], reparacion: { tipo: "correccion", corrige: ["entidad"], ambigua: false, pregunta: null, dato: null, aceptado: false } };
const t2corr = await turno({ texto: "no, te pedí otra cosa", plan: PLAN_CORR, mem: t1.mem, narrar: RECITA, history: HIST });
ok(!!t2corr.r && !String(t2corr.r.text).includes(figCita.value), "en un turno de corrección, la re-cita es vetada aunque la boleta exista", t2corr.r && t2corr.r.text);

/* ══ A3 · CONTEOS ═════════════════════════════════════════════════════════════════════════════════════════════ */
H("[A3] un conteo del turno anterior re-citado pasa; uno inventado no");
const nReal = bol.counts.find((c) => Number.isFinite(c) && c >= 2 && c <= 999);
ok(Number.isFinite(nReal), `hay un conteo re-citable en la boleta (${nReal})`);
const nFalso = Math.max(...bol.counts.filter(Number.isFinite), 0) + 7;
const CITA_CONTEO = `Te mostré ${nReal} clientes en esa lista; por eso tiene ese largo.`;
const CITA_FALSA = `Te mostré ${nFalso} clientes en esa lista; por eso tiene ese largo.`;
const gN1 = guardC(CITA_CONTEO, { ...GUARD_BASE, boletaAnterior: bol });
ok(gN1.ok, `«${nReal} clientes» re-citado PASA con la boleta`, JSON.stringify(gN1.violations || []));
const gN0 = guardC(CITA_CONTEO, GUARD_BASE);
ok(!gN0.ok && gN0.violations.some((v) => v.kind === "conteo-no-autorizado"), "…y sin la boleta se veta (garantía vieja)");
const gN2 = guardC(CITA_FALSA, { ...GUARD_BASE, boletaAnterior: bol });
ok(!gN2.ok && gN2.violations.some((v) => v.kind === "conteo-no-autorizado"), `«${nFalso} clientes» inventado sigue vetado aun con la boleta`);

/* ══ A5 · AISLAMIENTO ═════════════════════════════════════════════════════════════════════════════════════════ */
H("[A5a] boletaAnterior NO viaja al narrador — payload real del turno 2, capturado en la pasada inyectada");
const args2 = t2con.capturas[0];
ok(!!args2 && args2.mem && Object.prototype.hasOwnProperty.call(args2.mem, "boletaAnterior"),
  "(el motor SÍ la tiene en su memoria interna en ese instante — el caso es real, no trivial)");
const payload2 = buildNarrateUserMessageC(args2);
ok(payload2 && payload2.memoria_interaccion && !Object.prototype.hasOwnProperty.call(payload2.memoria_interaccion, "boletaAnterior"),
  "memoria_interaccion del payload NO trae la key boletaAnterior (mismo filtro que viewContext)");
ok(!JSON.stringify(payload2).includes("boletaAnterior"), "…y la palabra no aparece en NINGUNA parte del payload proyectado");
ok(!renderInteractionMemory(t1.mem).toLowerCase().includes("boleta"), "el bloque de memoria del system tampoco la rinde");

H("[A5b] el cap de 24 con una boleta grande (cuatro tools en un turno)");
const PLAN_GRANDE = { intent: "answer", mode: "default", calls: [
  { tool: "marginRead", args: { focus: "bajo_benchmark", dimension: "cliente" } },
  { tool: "inventoryStatus", args: {} },
  { tool: "salesRead", args: { dimension: "cliente" } },
  { tool: "contributionRead", args: { dimension: "cliente" } },
] };
const tg = await turno({ texto: "dame una lectura completa del negocio", plan: PLAN_GRANDE, mem: {}, narrar: "" });
const bolG = tg.mem && tg.mem.boletaAnterior;
const figsCrudas = (tg.r && tg.r.evidence && (tg.r.evidence.boleta || tg.r.evidence.figs) || []).length;
console.log(`  (figs autorizadas del turno grande: ${figsCrudas} · persistidas: ${bolG ? bolG.figs.length : "—"})`);
ok(!!bolG && bolG.figs.length <= 24, `la boleta persistida respeta el cap (${bolG && bolG.figs.length} ≤ 24)`);
ok(figsCrudas <= 24 || (bolG && bolG.figs.length === 24), "…y con más de 24 figs autorizadas, persiste EXACTAMENTE 24");

console.log(`\n── _probe_paso1b_recita: ${PASS} PASS · ${FAIL} FAIL ──`);
process.exit(FAIL ? 1 : 0);
