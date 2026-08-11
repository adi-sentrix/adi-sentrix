/* === _guardc_repetition_degraded_gate.mjs · GATE PERMANENTE · guardC `degraded` + escalada por repetición verbatim ===
 * owner 2026-08-03 — cierre de la investigación cruzada de _oracle_clarify_mode_gate.mjs / _oracle_multimodo_gate.mjs
 * / _oracle_provider_certification_gate.mjs: los 3 gates de solapamiento léxico compartían una causa raíz REAL de
 * producción (no solo de arnés de test) — guardC.js YA calculaba repetición (`_repetitionAdvisory`) pero SOLO como
 * `advisories`, nunca afectaba `ok`/`violations`, así que NINGÚN nivel de repetición disparaba jamás el reintento/
 * escalada de modelo (mini→terra→sol, modelRouter.js) que answerViaOracle.js ya usa para cualquier otro rechazo de
 * guardC. Este gate blinda el fix: `sharedVerbatimRun`/`degraded` en guardC.js (señal ADITIVA, NUNCA toca violations/
 * ok — auditoría adversarial 2026-08-03: eso rompería `_dialogue_state_gate.mjs` sección 1, que fija como decisión
 * DELIBERADA del owner 2026-07-30 que una repetición del 100% SIGUE pasando el guard con ok=true) + el loop de
 * NARRAR de answerViaOracle.js, que ahora reintenta (da a la escalada de modelo una chance real de producir una
 * redacción fresca) ante `degraded`, y si TODOS los intentos quedan degradados, usa la MEJOR disponible en vez de
 * caer a la reparación genérica "sin datos" (nunca reemplaza una respuesta VÁLIDA por una peor solo por repetitiva).
 * 100% DETERMINÍSTICO — sin LLM real, callPlan/callNarrate mockeados (mismo patrón que _oracle_tension_vocab_gate.mjs).
 * @inyeccion-simulada · callPlan/callNarrate se pasan A MANO (mocks locales de este archivo). No importa
 * gatewayCore ni ningún adapter, no importa nada de src/ui/ y no hace ni una salida cruda de red. Ver el segundo
 * escape de scripts/gates-offline.mjs: sin esta declaración el clasificador lo marcaba LIVE por nombrar esos dos
 * símbolos, y un gate que NO CORRE no certifica nada — que es exactamente como este llegó a estar rojo sin que
 * nadie lo notara. El candado de runtime se aplica igual (exit 97 ante cualquier socket).
 * OJO al redactar acá: el clasificador lee ESTE archivo como texto, así que escribir el nombre de la función de
 * red seguido de su paréntesis —aunque sea dentro de un comentario— lo devuelve a la lista LIVE.
 *
 * ══ RE-CERTIFICACIÓN 2026-08-11 (defecto D8-guard) ═════════════════════════════════════════════════════════════
 * LA PREGUNTA QUE SE LE HIZO A ESTE GATE: la certificación pagada midió que E10.t4 devolvió la MISMA tabla de
 * E10.t1, idéntica carácter por carácter, y que `repeticion-verbatim` no la frenó. ¿Este gate afirma la conducta
 * equivocada — o sea, la repetición DEBERÍA bloquear?
 * VEREDICTO: NO. La afirmación de este gate se SOSTIENE, y por su razón escrita, no por inercia:
 *   1. Bloquear la repetición agota los 3 intentos de NARRAR y cae a `composeFromLedger` — la tabla pelada sin
 *      prosa ejecutiva. Eso NO es una mejora sobre una respuesta válida repetida: es el mismo resultado que el
 *      defecto denuncia, más caro. La sección 3b de abajo lo mide: hoy, cuando ningún intento sale fresco, el
 *      motor usa la MEJOR degradada en vez de un mensaje genérico; con bloqueo, devolvería la degradación.
 *   2. `ok` significa FIDELIDAD (cifra/conteo/entidad/orden/total/simulación/placeholder). Una repetición es un
 *      defecto de FORMA. Meter forma en `ok` rompe además `_dialogue_state_gate.mjs` §1, que fija como decisión
 *      deliberada del owner que una repetición del 100% pasa con ok=true.
 *   3. LO QUE SÍ ESTABA ROTO no era este contrato: en la rama `data_only` de answerViaOracle.js la llamada a
 *      guardC NO recibe `recentNarrations`, así que en el ÚNICO camino donde la repetición de E10 ocurrió el
 *      detector ni siquiera se evalúa. Ese cableado vive en answerViaOracle.js, no en guardC.js ni acá.
 * LO QUE SÍ SE ARREGLÓ EN ESTE ARCHIVO: la sección 3 medía 20 PASS · 5 FAIL, y ninguna de las 5 fallas hablaba de
 * repetición. La pregunta del arnés era «¿cómo viene todo?», que desde progressiveDisclosure.js (2026-08-07)
 * matchea `_TEMPORAL` («cómo viene») y resuelve `tablePolicy:"required"` — así que guardC rechazaba la narración
 * en prosa con `tabla-faltante` y los 3 intentos morían por una razón ajena. El fixture estaba podrido, no el
 * contrato. Se cambió por una pregunta sin ningún disparador de forma Y se le agregó el ASERTO 3.0 que fija esa
 * precondición: si mañana otro detector vuelve a secuestrar la pregunta, el gate lo dice en voz alta en vez de
 * fallar por el motivo equivocado. Ninguna aserción se relajó: las 25 originales siguen intactas.
 */
import { guardC, sharedVerbatimRun } from "./src/adi/oracle/guardC.js";
import { answerViaOracle } from "./src/adi/oracle/answerViaOracle.js";
import { resolveTablePolicy } from "./src/adi/oracle/progressiveDisclosure.js";

let pass = 0, fail = 0;
const ok = (cond, label) => { console.log(`  ${cond ? "✓" : "✗"} ${label}`); if (cond) pass++; else fail++; };

console.log("── 1 · sharedVerbatimRun (fuente única, guardC.js) — run de 8+ palabras SEGUIDAS, no bag-of-words ──");
{
  const base = "El desempeño general del negocio se mantiene estable este período, sin cambios relevantes que reportar en el panorama actual.";
  ok(sharedVerbatimRun(base, base, 8), "texto 100% idéntico → SÍ detecta un run verbatim de 8 palabras");
  const distinto = "Ahora te comento un tema completamente distinto, sin relación textual con lo anterior en absoluto.";
  ok(!sharedVerbatimRun(base, distinto, 8), "texto genuinamente distinto → NO detecta ningún run compartido");
  // dos tablas legítimas que comparten encabezados + nombres de cliente + cifras (continuidad de tema, NO reciclaje)
  const t1 = "Falabella concentra la mayor carga comercial del período con $194K, seguido por Lider con $87K y Sodimac con $52K en el mismo corte.";
  const t2 = "Para profundizar en Falabella: la carga comercial de $194K se explica por un rebate del 4.2% sobre ventas de $4.6M en el trimestre.";
  ok(!sharedVerbatimRun(t1, t2, 8), "dos turnos que comparten entidad/cifra pero NUNCA 8 palabras seguidas idénticas → no marca falso positivo");
  const conCorte = t1.slice(0, 40) + " " + t1.slice(0, 60);   // fuerza un run compartido real de más de 8 palabras
  ok(sharedVerbatimRun(t1, t1.slice(0, 80), 8), "un tramo realmente copiado (prefijo del mismo texto, 8+ palabras) SÍ se detecta");
  ok(!sharedVerbatimRun("corto", "muy corto", 8), "textos con menos de 8 palabras nunca crashean ni marcan falso positivo");
}

console.log("\n── 2 · guardC() expone `degraded` SIN tocar `ok`/`violations` (compatibilidad dura con _dialogue_state_gate.mjs §1) ──");
{
  const textoBase = "El desempeño general del negocio se mantiene estable este período, sin cambios relevantes que reportar en el panorama actual.";
  const g1 = guardC(textoBase, { ledger: { figs: [] }, results: [], trace: null, question: "", recentNarrations: [textoBase] });
  ok(g1.ok === true, "repetición 100% → ok SIGUE true (nunca se toca violations por repetición)");
  ok(g1.degraded === true, "repetición 100% (run verbatim ≥8 palabras) → degraded=true");
  ok(g1.advisories.some((a) => a.kind === "repeticion-verbatim"), "queda registrado como advisory 'repeticion-verbatim' (visibilidad, no bloqueo)");
  ok(g1.advisories.some((a) => a.kind === "repeticion"), "el advisory de ratio (_repetitionAdvisory) preexistente SIGUE intacto — no se duplica ni se reemplaza, coexisten");

  const textoDistinto = "Ahora te comento un tema completamente distinto, sin relación textual con lo anterior en absoluto.";
  const g2 = guardC(textoDistinto, { ledger: { figs: [] }, results: [], trace: null, question: "", recentNarrations: [textoBase] });
  ok(g2.degraded === false, "texto genuinamente distinto → degraded=false");

  const g3 = guardC(textoBase, { ledger: { figs: [] }, results: [], trace: null, question: "" });
  ok(g3.degraded === false, "sin recentNarrations → degraded=false, no crashea");

  const g4 = guardC(textoBase, { ledger: { figs: [] }, results: [], trace: null, question: "", recentNarrations: [] });
  ok(g4.degraded === false, "recentNarrations vacío → degraded=false, no crashea");

  // degraded nunca se activa si YA hay una violación real (esa narración ya se reintenta por otro motivo — no
  // necesita una señal aparte, y `ok` ya es false de todos modos).
  const conCifraInventada = "La contribución no capturada asciende a $999,999,999 en este período repetitivo repetitivo repetitivo repetitivo repetitivo repetitivo repetitivo repetitivo.";
  const g5 = guardC(conCifraInventada, { ledger: { figs: [] }, results: [], trace: null, question: "", recentNarrations: [conCifraInventada] });
  ok(g5.ok === false, "con una violación real (cifra no autorizada) → ok sigue false, sin cambios");
  ok(g5.degraded === false, "con violación real, degraded queda false (no aplica — ya hay un violations real)");
}

console.log("\n── 3 · end-to-end vía answerViaOracle — el reintento SÍ se dispara ante `degraded` (mocks, sin LLM) ──");
{
  const REPEATED = "El desempeño general del negocio se mantiene estable este período, sin cambios relevantes que reportar en el panorama actual.";
  const FRESH = "Mirando el trimestre con otro ángulo: la contribución total creció levemente, sostenida por Falabella y Lider, sin cambios de mecanismo relevantes.";
  // LA PREGUNTA DEL ARNÉS ES UNA PRECONDICIÓN, NO DECORACIÓN (owner 2026-08-11). Esta sección mide el loop de
  // reintento ante `degraded`; para eso la respuesta en PROSA tiene que ser una salida admisible. Si la pregunta
  // dispara `tablePolicy:"required"`, guardC la rechaza por `tabla-faltante` y los 3 intentos mueren por un
  // motivo que no es el que este gate certifica — que es exactamente lo que pasó con «¿cómo viene todo?» desde
  // que `_TEMPORAL` reconoce «cómo viene». Se fija acá y se verifica, para que la próxima vez falle diciendo POR
  // QUÉ en vez de fallar en las 5 aserciones de abajo.
  const PREGUNTA = "¿cuál es la situación general del negocio?";
  ok(resolveTablePolicy({ text: PREGUNTA, podado: [] }) === "auto", `3.0 · PRECONDICIÓN: la pregunta del arnés no pide tabla ni serie ni desglose → tablePolicy "auto" (obtuvo "${resolveTablePolicy({ text: PREGUNTA, podado: [] })}")`);

  console.log("\n  ▸ 3a · attempt 0 repetido (degraded) → reintenta → attempt 1 fresco → SE ACEPTA el fresco, no el repetido");
  {
    const seenAttempts = [];
    const callPlan = async () => ({ intent: "ack", calls: [] });
    const callNarrate = async ({ attempt }) => { seenAttempts.push(attempt); return attempt === 0 ? REPEATED : FRESH; };
    const mem0 = { recentNarrations: [REPEATED] };   // simula que REPEATED ya se dijo en un turno anterior
    const r = await answerViaOracle({ text: PREGUNTA, history: [], mem: mem0, scenario: "actual", callPlan, callNarrate });
    ok(r && r.r && r.r.route === "oracle", "responde por Arquitectura C");
    ok(r && r.r && r.r.text === FRESH, `acepta la redacción FRESCA del intento 1, no la repetida del intento 0 — obtuvo "${r && r.r && r.r.text}"`);
    ok(seenAttempts.length >= 2 && seenAttempts[0] === 0 && seenAttempts[1] === 1, `el loop SÍ reintentó (attempt 0 → 1) ante degraded — attempts vistos: ${JSON.stringify(seenAttempts)}`);
    ok(!r.r.narrationDegraded, "el resultado final NO queda marcado narrationDegraded (se logró una redacción fresca)");
  }

  console.log("\n  ▸ 3b · los 3 intentos quedan degradados (mock fijo) → usa la MEJOR degradada, NUNCA cae a 'sin datos' genérico");
  {
    const seenAttempts = [];
    const callPlan = async () => ({ intent: "ack", calls: [] });
    const callNarrate = async ({ attempt }) => { seenAttempts.push(attempt); return REPEATED; };   // siempre el mismo texto, ignora attempt
    const mem0 = { recentNarrations: [REPEATED] };
    const r = await answerViaOracle({ text: PREGUNTA, history: [], mem: mem0, scenario: "actual", callPlan, callNarrate });
    ok(r && r.r && r.r.route === "oracle", "responde por Arquitectura C (nunca fallback total)");
    ok(r && r.r && r.r.text === REPEATED, `usa la narración degradada (VÁLIDA, guardC la aprobó igual) en vez de un mensaje genérico de "sin datos" — obtuvo "${(r && r.r && r.r.text || "").slice(0, 60)}..."`);
    ok(seenAttempts.length === 3, `agotó los 3 intentos de reintento antes de aceptar la degradada — attempts: ${JSON.stringify(seenAttempts)}`);
    ok(r.r.narrationDegraded === true, "el resultado queda marcado narrationDegraded:true (telemetría honesta)");
  }

  console.log("\n  ▸ 3c · sin repetición (primer turno, sin recentNarrations) → se acepta en el intento 0, sin reintentos de más");
  {
    const seenAttempts = [];
    const callPlan = async () => ({ intent: "ack", calls: [] });
    const callNarrate = async ({ attempt }) => { seenAttempts.push(attempt); return FRESH; };
    const r = await answerViaOracle({ text: PREGUNTA, history: [], mem: {}, scenario: "actual", callPlan, callNarrate });
    ok(r && r.r && r.r.text === FRESH, "acepta la narración en el primer intento");
    ok(seenAttempts.length === 1, `NO reintenta de más cuando no hay repetición — attempts: ${JSON.stringify(seenAttempts)}`);
    ok(!r.r.narrationDegraded, "no queda marcado narrationDegraded (nunca hubo repetición)");
  }
}

console.log(`\n── _guardc_repetition_degraded_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
