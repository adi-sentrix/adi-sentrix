/* === _oracle_provider_certification_gate.mjs · CERTIFICACIÓN DE PORTABILIDAD ENTRE PROVEEDORES ===
 * owner 2026-07-29: "certifica de verdad la portabilidad entre modelos... NO compares redacción literal: verifica
 * cumplimiento del contrato, conservación de entidad y métrica, cifras autorizadas, transición de modos, acción
 * concreta, ausencia de repeticiones y cierre correcto... si hoy no existen credenciales para un segundo proveedor,
 * deja el harness preparado y reporta claramente: arquitectura compatible / proveedor actual certificado / segundo
 * proveedor pendiente. NO declares equivalencia entre proveedores hasta ejecutar esa prueba real."
 *
 * Corre el MISMO hilo de 6 turnos (el de _oracle_multimodo_gate.mjs — diagnóstico→decisión→seguimiento→evidencia→
 * simulación→clarify, anclado en Falabella/carga comercial $194K) contra CADA adapter con `getAdapter(provider)`
 * DIRECTO (bypass del `_config` de un-solo-proveedor de gatewayCore — así se puede correr N proveedores en el
 * mismo proceso) inyectado en `answerViaOracle` real (retries, guardC, clarifyStreak, coerción — el pipeline
 * genuino, no un atajo). 2 corridas independientes por proveedor disponible (variance del LLM, no se certifica con
 * una sola muestra). Los criterios son ESTRUCTURALES/determinísticos — nunca se compara texto de un proveedor
 * contra el de otro palabra por palabra.
 *
 * SMOKE LLM REAL (etiquetado 2026-07-31, gate de reconciliación/trazabilidad evidenceSpec): invoca adapter.parse/
 * adapter.narrate reales de CADA proveedor con credenciales disponibles — probabilístico, no determinístico (mismo
 * criterio que los demás "SMOKE LLM REAL" del repo, con la variance ya documentada arriba). Etiqueta agregada por
 * auditoría de grep sobre los ~85 "_*_gate.mjs" (este era 1 de los 3 sin autoetiquetar) — CERO cambio de lógica.
 */
import fs from "fs";
for (const ln of fs.readFileSync(".env", "utf8").split(/\r?\n/)) { const m = ln.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
import { answerViaOracle } from "./src/adi/oracle/answerViaOracle.js";
import { buildPlanSystem, buildPlanUserMessage, PLAN_TOOL } from "./src/adi/oracle/planPrompt.js";
import { buildNarrateSystemC, buildNarrateUserMessageC } from "./src/adi/oracle/narratePromptC.js";
import { ADI_PERSONA, renderInteractionMemory } from "./src/adi/oracle/persona.js";
import { MODE_KEYS } from "./src/adi/oracle/conversationalContract.js";
import { ADAPTERS } from "./src/adi/llm/providerAdapter.js";
import { parseFigures } from "./src/adi/boleta.js";
import { sharedVerbatimRun } from "./src/adi/oracle/guardC.js";

const SC = "actual";
const DEFAULT_MODEL = { openai: "gpt-4o-mini", anthropic: "claude-haiku-4-5-20251001", gemini: null, local: null };
const IMPLEMENTED = ["openai", "anthropic"];   // gemini/local son stubs sin parse/narrate — ver providerAdapter.js

// ── el MISMO hilo que _oracle_multimodo_gate.mjs (no se reinventa el caso de prueba) ──
const THREAD = [
  { q: "Hazme un resumen ejecutivo", expectedMode: "diagnostico" },
  { q: "¿Qué hago primero?", expectedMode: "decision" },
  { q: "Sí, profundiza en eso", expectedMode: "seguimiento" },
  { q: "¿De dónde sale ese número de $194K?", expectedMode: "evidencia" },
  { q: "¿Y si negocio esa carga hasta el target?", expectedMode: "simulacion" },
  { q: "No entendí, explícamelo más fácil", expectedMode: "clarify" },
];

function makeProviderCallers(providerName) {
  const adapter = ADAPTERS[providerName];
  const model = process.env[`${providerName.toUpperCase()}_MODEL`] || DEFAULT_MODEL[providerName];
  const callPlan = async ({ text, history, mem, scenario }) => {
    const system = buildPlanSystem(ADI_PERSONA, renderInteractionMemory(mem), scenario || SC);
    const user = buildPlanUserMessage(history, text);
    const { spec } = await adapter.parse(user, { system, tool: PLAN_TOOL, model });
    return spec;
  };
  const callNarrate = async ({ text, plan, results, ledgerFigs, mem, history }) => {
    const system = buildNarrateSystemC(ADI_PERSONA, renderInteractionMemory(mem));
    const payload = buildNarrateUserMessageC({ text, plan, results, ledgerFigs, mem, history });
    const { text: narration } = await adapter.narrate(payload, { model, system });
    return narration;
  };
  return { callPlan, callNarrate };
}

async function runThread(providerName) {
  const { callPlan, callNarrate } = makeProviderCallers(providerName);
  let mem = {}, history = [];
  const turnos = [];
  for (const { q, expectedMode } of THREAD) {
    // el mode OBSERVABLE tiene que leerse de lo que recibe callNarrate, NO de lo que devuelve callPlan: answerViaOracle
    // aplica _coerceMode/_coerceTensionArgs DESPUÉS de callPlan, sobre su PROPIA variable interna `plan` — espiar
    // callPlan (bug real cazado acá mismo) muestra el mode CRUDO del LLM antes de la coerción de clarify, nunca el
    // final. Mismo patrón ya probado en _oracle_multimodo_gate.mjs/_oracle_clarify_mode_gate.mjs.
    let lastPlan = null;
    const spyCallNarrate = async (args) => { lastPlan = args.plan; return callNarrate(args); };
    const r = await answerViaOracle({ text: q, history, mem, scenario: SC, callPlan, callNarrate: spyCallNarrate });
    const narration = (r && r.r && r.r.text) || null;
    const modo = lastPlan && lastPlan.mode;
    // bypassStructural (owner 2026-08-03, causa raíz real cazada en vivo con este MISMO hilo de 6 turnos — T5
    // "¿Y si negocio esa carga hasta el target?" a veces resuelve vía `_composedBypassResult` en answerViaOracle.js
    // — ej. una simulación con una variable faltante — que SALTEA PLAN→NARRAR entero, `deterministic:true`, y
    // NUNCA invoca callNarrate/spyCallNarrate: `lastPlan` legítimamente queda null, no es un fallo de clasificación.
    const bypassStructural = modo == null && !!(r && r.r && r.r.deterministic);
    turnos.push({ q, expectedMode, modo, narration, route: r && r.r && r.r.route, bypassStructural, nCifras: narration ? parseFigures(narration).length : null });
    if (r) mem = r.mem;
    history = [...history, { role: "user", text: q }, { role: "adi", gist: (narration || "(fallback)").slice(0, 200) }].slice(-8);
  }
  return turnos;
}

const _words = (s) => new Set(String(s).toLowerCase().replace(/[^a-záéíóúñ0-9\s]/gi, "").split(/\s+/).filter((w) => w.length > 4));
const _overlap = (a, b) => { const wa = _words(a), wb = _words(b); if (!wb.size) return 0; let inter = 0; for (const w of wb) if (wa.has(w)) inter++; return inter / wb.size; };
const _ACTION_VERB_RE = /\b(renegoci\w*|revis\w*|ajust\w*|prioriz\w*|enfoc\w*|empez\w*|comenz\w*|primero|corrig\w*)\b/i;
// hipótesis: "si" y un verbo hipotético en la MISMA ORACIÓN (no una ventana de caracteres fija — un bug real cazado
// probando esto: "Si bajás la carga comercial de Falabella al target del 3.5%, recuperarías $194K" tiene la cláusula
// condicional larga y una ventana de 60 caracteres cortaba ANTES de llegar al verbo).
function _isHypothesisFramed(text) {
  const sentences = String(text || "").split(/(?<=[.!?])\s+/);
  return sentences.some((s) => /\bsi\b/i.test(s) && /\b(recuper\w*|podr[ií]as?|estimad\w*|liberar\w*)\b/i.test(s));
}

// certifyRun(turnos) → { checks:[{key,label,pass,detail}], overall } — TODOS los criterios son estructurales,
// nunca comparan la redacción de un proveedor contra la de otro.
function certifyRun(turnos) {
  const checks = [];
  const add = (key, label, pass, detail) => checks.push({ key, label, pass, detail });

  // C1 · transición de modos: cada turno QUE NARRA clasifica un valor VÁLIDO del contrato (siempre exigible) — los
  // turnos que resuelven por un bypass ESTRUCTURAL (deterministic:true, nunca invocan callNarrate — ver
  // bypassStructural en runThread) no tienen mode narrativo que observar por este mecanismo, no se exigen acá.
  add("modos_validos", "Cada turno que narra clasifica un mode válido del contrato", turnos.every((t) => t.bypassStructural || MODE_KEYS.includes(t.modo)),
    turnos.map((t) => t.bypassStructural ? "(bypass estructural)" : t.modo).join(" → "));
  // C2 · clarify determinístico: T6 SIEMPRE clasifica clarify (es el gate de _coerceMode, no depende del proveedor)
  add("clarify_determinista", "T6 clasifica clarify (gate determinístico, independiente del proveedor)", turnos[5].modo === "clarify", `obtuvo "${turnos[5].modo}"`);
  // C3 · cifras autorizadas: guardC ya corrió dentro de answerViaOracle — si hay narración, PASÓ el muro (si no
  // pasaba, answerViaOracle habría devuelto null/fallback para ese turno) — se verifica indirectamente por route.
  const conNarracion = turnos.filter((t) => t.narration);
  add("cifras_autorizadas", "Toda narración producida pasó guardC (cifras autorizadas — lo hubiera rechazado si no)", conNarracion.length > 0,
    `${conNarracion.length}/${turnos.length} turnos con narración (el resto cayó a fallback, no es un turno con cifra sin autorizar)`);
  // C4 · conservación de entidad — Falabella (establecida en T1 como la acción prioritaria) debe seguir presente en
  // T2 (decisión) y T3 (seguimiento), los dos continuadores MÁS directos de esa recomendación.
  for (const i of [1, 2]) {
    add(`entidad_T${i + 1}`, `T${i + 1}: conserva la entidad "Falabella" (no reinicia el foco)`, !turnos[i].narration || /falabella/i.test(turnos[i].narration), turnos[i].narration ? turnos[i].narration.slice(0, 60) : "(sin narración)");
  }
  // C5 · acción concreta (decisión, T2): nombra la entidad Y un verbo de acción concreto, no un genérico vago
  add("accion_concreta_T2", "T2 (decisión): nombra Falabella + un verbo de acción concreto", !turnos[1].narration || (/falabella/i.test(turnos[1].narration) && _ACTION_VERB_RE.test(turnos[1].narration)),
    turnos[1].narration ? turnos[1].narration.slice(0, 100) : "(sin narración)");
  // C6 · simulación enmarcada como hipótesis (T5): "si... recuperarías/podrías/estimado" — nunca hecho consumado
  add("hipotesis_T5", "T5 (simulación): enmarca como HIPÓTESIS, no como hecho consumado", !turnos[4].narration || _isHypothesisFramed(turnos[4].narration), turnos[4].narration ? turnos[4].narration.slice(0, 100) : "(sin narración)");
  // C7 · T6 (clarify) cita MENOS cifras que T1 (bajar el nivel — el criterio estructural más directo)
  if (turnos[0].nCifras != null && turnos[5].nCifras != null) add("clarify_baja_cifras", "T6 (clarify) cita menos cifras que T1 (resumen)", turnos[5].nCifras < turnos[0].nCifras, `${turnos[5].nCifras} < ${turnos[0].nCifras}`);
  // C8 · cierre correcto de clarify: termina con pregunta guía
  if (turnos[5].narration) add("cierre_clarify", "T6 (clarify) cierra con una pregunta guía ('?')", /\?\s*$/.test(turnos[5].narration.trim()), turnos[5].narration.slice(-60));
  // C9 · ausencia de repeticiones: ningún par de turnos (DEL MISMO proveedor, nunca entre proveedores) es
  // literalmente el mismo contenido reciclado. owner 2026-08-03 (investigación cruzada, causa raíz confirmada):
  // el umbral de RATIO crudo (70%, código byte-idéntico al de _oracle_multimodo_gate.mjs) castigaba la continuidad
  // legítima T2(decisión)→T3(seguimiento) — DISEÑADOS a propósito para compartir vocabulario (misma entidad/
  // mecanismo) — sin ningún tramo de 8 palabras seguidas realmente compartido en las corridas medidas. Se reemplaza
  // por sharedVerbatimRun (fuente única en guardC.js, la MISMA que usa guardC/`degraded` y _oracle_multimodo_gate.
  // mjs) — detecta reciclaje palabra-por-palabra real, no "mismo tema mencionado de nuevo".
  let maxOverlap = 0, maxPair = null;
  let verbatimHit = null;
  for (let i = 0; i < turnos.length; i++) for (let j = i + 1; j < turnos.length; j++) { if (!turnos[i].narration || !turnos[j].narration) continue; const o = _overlap(turnos[i].narration, turnos[j].narration); if (o > maxOverlap) { maxOverlap = o; maxPair = [i + 1, j + 1]; } if (!verbatimHit && sharedVerbatimRun(turnos[i].narration, turnos[j].narration, 8)) verbatimHit = [i + 1, j + 1]; }
  console.log(`    medición informativa: mayor solapamiento léxico crudo par-a-par = ${(maxOverlap * 100).toFixed(0)}%${maxPair ? ` (T${maxPair[0]} vs T${maxPair[1]})` : ""} — sin umbral, solo referencia`);
  add("sin_repeticion", "Ningún par de turnos comparte un tramo de 8+ palabras SEGUIDAS verbatim (nada reciclado palabra por palabra)", !verbatimHit, verbatimHit ? `T${verbatimHit[0]} vs T${verbatimHit[1]}` : `sin coincidencia verbatim (ratio crudo informativo: ${(maxOverlap * 100).toFixed(0)}%)`);
  // C10 · cobertura mínima de la conversación: al menos 4/6 turnos deben responder por Arquitectura C (si casi
  // todo cae a fallback, no hay nada que certificar — variance de guardC es aceptable, un colapso total no)
  const enOracle = turnos.filter((t) => t.route === "oracle").length;
  add("cobertura_minima", "Al menos 4/6 turnos responden por Arquitectura C", enOracle >= 4, `${enOracle}/6`);

  const overall = checks.every((c) => c.pass);
  return { checks, overall };
}

async function certifyProvider(providerName, runs = 2) {
  const adapter = ADAPTERS[providerName];
  const implemented = IMPLEMENTED.includes(providerName);
  if (!implemented) return { status: "NO_APLICA", reason: "adapter no implementado (stub sin parse/narrate real)" };
  const available = typeof adapter.isAvailable === "function" && adapter.isAvailable();
  if (!available) return { status: "PENDIENTE", reason: `sin credenciales en este entorno (${adapter.keyEnv} no está seteado)` };

  const runResults = [];
  for (let i = 0; i < runs; i++) {
    console.log(`  [${providerName}] corrida ${i + 1}/${runs}...`);
    const turnos = await runThread(providerName);
    const cert = certifyRun(turnos);
    runResults.push({ turnos, cert });
    for (let t = 0; t < turnos.length; t++) console.log(`    T${t + 1} "${turnos[t].q}" → modo=${turnos[t].modo} · route=${turnos[t].route || "FALLBACK"} · ${turnos[t].nCifras ?? "?"} cifras`);
    for (const c of cert.checks) console.log(`      ${c.pass ? "✓" : "✗"} ${c.label} — ${c.detail}`);
    console.log(`    corrida ${i + 1}: ${cert.overall ? "TODOS los criterios OK" : "hay criterios que fallaron"}`);
  }
  const allOk = runResults.every((r) => r.cert.overall);
  return { status: allOk ? "CERTIFICADO" : "NO_CERTIFICADO", reason: allOk ? `${runs}/${runs} corridas cumplieron TODOS los criterios` : "al menos una corrida falló algún criterio (ver detalle arriba)", runs: runResults };
}

console.log("═══ CERTIFICACIÓN DE PORTABILIDAD ENTRE PROVEEDORES ═══\n");
console.log("── ARQUITECTURA ──");
console.log(`  compatible con ${Object.keys(ADAPTERS).length} proveedores registrados: ${Object.keys(ADAPTERS).join(", ")}`);
console.log(`  implementados (parse+narrate reales): ${IMPLEMENTED.join(", ")}`);
console.log(`  el MISMO contrato (planPrompt.js/narratePromptC.js/conversationalContract.js) corre sin cambios contra cualquiera — solo cambia qué adapter traduce la llamada.\n`);

const results = {};
for (const providerName of Object.keys(ADAPTERS)) {
  console.log(`── ${providerName.toUpperCase()} ──`);
  results[providerName] = await certifyProvider(providerName, 2);
  console.log(`  ${providerName}: ${results[providerName].status} — ${results[providerName].reason}\n`);
}

console.log("── VEREDICTO HONESTO (sin declarar equivalencia sin ejecutar) ──");
const certified = Object.entries(results).filter(([, r]) => r.status === "CERTIFICADO").map(([n]) => n);
const pending = Object.entries(results).filter(([, r]) => r.status === "PENDIENTE").map(([n]) => n);
const notCertified = Object.entries(results).filter(([, r]) => r.status === "NO_CERTIFICADO").map(([n]) => n);
console.log(`  proveedor(es) CERTIFICADO(S) por esta corrida: ${certified.length ? certified.join(", ") : "ninguno"}`);
console.log(`  proveedor(es) PENDIENTE(S) de certificación (sin credencial en este entorno): ${pending.length ? pending.join(", ") : "ninguno"}`);
if (notCertified.length) console.log(`  proveedor(es) que NO certificaron (fallaron algún criterio): ${notCertified.join(", ")}`);
console.log(`  NO se declara equivalencia entre proveedores — solo se afirma lo efectivamente ejecutado arriba.`);

let pass = 0, fail = 0;
const ok = (cond, label) => { console.log(`  ${cond ? "✓" : "✗"} ${label}`); if (cond) pass++; else fail++; };
console.log("\n── ASERCIONES DEL GATE ──");
ok(certified.length >= 1, `al menos 1 proveedor CERTIFICADO con prueba real ejecutada (obtuvo: ${certified.join(", ") || "ninguno"})`);
ok(notCertified.length === 0, `ningún proveedor con credencial disponible falló la certificación (obtuvo: ${notCertified.join(", ") || "ninguno"})`);
ok(Object.values(results).some((r) => r.status === "PENDIENTE" || r.status === "CERTIFICADO"), "el harness reconoce al menos un proveedor no-stub (arquitectura multi-proveedor real, no decorativa)");

console.log(`\n── _oracle_provider_certification_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
