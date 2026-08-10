/* === _count_authorized_gate.mjs · GATE PERMANENTE · ensureCountAuthorized (guardC.js) ===
 * owner 2026-08-03 — auditoría de eficiencia de Mini: "conteo-no-autorizado" fue la causa de rechazo MÁS FRECUENTE
 * medida (~50% de las violaciones de bloqueo en la muestra). El caso más frecuente no es una cifra inventada de la
 * nada: es un DESAJUSTE entre el número que el narrador dice ("Los 9 clientes...") y la cantidad de ítems que en
 * realidad ENUMERA a continuación (a veces lista 5, a veces 7) — un error de conteo sobre SU PROPIO texto. Ya está
 * implementado y wireado (ensureCountAuthorized en guardC.js líneas 61-107, invocado en answerViaOracle.js ANTES de
 * guardC() — ver el comentario junto a esa llamada, línea ~1000). Este gate BLINDA el mecanismo: 100%
 * DETERMINÍSTICO, sin LLM real, funciones puras (secciones 1-4) + un arnés end-to-end con callPlan/callNarrate
 * MOCKEADOS pero con el motor/toolRunner REAL corriendo por debajo (sección 5, mismo patrón que
 * _guardc_repetition_degraded_gate.mjs) — sin depender de red/LLM, y usando datos REALES del tenant demo (nunca
 * inventados) para que la corrección/el bloqueo se ejerciten contra un ledger auténtico.
 *
 * Los 5 casos pedidos por la tarea:
 *   1. conteo dice N, la lista enumerada tiene M≠N ítems Y M SÍ está autorizado → se corrige a M.
 *   2. conteo dice N, la lista tiene M ítems pero M NO está autorizado → NO se toca (el bloqueo real de guardC
 *      sigue vigente — nunca inventa, nunca adivina).
 *   3. conteo YA correcto → texto sin cambios.
 *   4. sin lista enumerada en la oración → sin cambios.
 *   5. end-to-end real (motor real, sin LLM): el fix evita un rechazo evitable SIN abrir ningún caso que antes
 *      bloqueaba.
 *
 * NOTA de regex (importante para leer los textos de prueba): parseCounts (guardC.js, _COUNT_NOUN) exige el dígito
 * INMEDIATAMENTE seguido del sustantivo contable ("9 clientes", no "9 principales clientes" — un adjetivo en medio
 * rompe el match, tanto acá como en el chequeo real de guardC). Los textos de prueba respetan esa adyacencia.
 */
import { ensureCountAuthorized, parseCounts, guardC } from "./src/adi/oracle/guardC.js";
import { answerViaOracle } from "./src/adi/oracle/answerViaOracle.js";

let pass = 0, fail = 0;
const ok = (cond, label) => { console.log(`  ${cond ? "✓" : "✗"} ${label}`); if (cond) pass++; else fail++; };

console.log("── 1 · conteo dice N, la lista tiene M≠N ítems Y M SÍ está autorizado → se corrige a M ──");
{
  const texto = "Los 9 clientes en foco son: Falabella · Lider · Sodimac · Jumbo · Tottus.";
  const ledger = { figs: [{ unit: "count", raw: 5, canon: "count:5", label: "Clientes en foco", value: "5" }] };
  const corregido = ensureCountAuthorized(texto, ledger, []);
  ok(corregido === "Los 5 clientes en foco son: Falabella · Lider · Sodimac · Jumbo · Tottus.", `"9" se reemplaza por "5" (la cuenta real enumerada, autorizada) — obtuvo: "${corregido}"`);
  const countsAfter = parseCounts(corregido);
  ok(countsAfter.some((c) => c.raw === 5), `una 2da pasada de parseCounts sobre el resultado confirma raw=5 — obtuvo [${countsAfter.map((c) => c.raw).join(",")}]`);

  // variante "top N" (mismo mecanismo, otro patrón textual)
  const textoTop = "Acá tenés el top 8 por brecha: Falabella · Lider · Sodimac.";
  const ledgerTop = { figs: [{ unit: "count", raw: 3, canon: "count:3", label: "Focos", value: "3" }] };
  const corregidoTop = ensureCountAuthorized(textoTop, ledgerTop, []);
  ok(corregidoTop.includes("top 3"), `variante "top N": "top 8" se corrige a "top 3" — obtuvo: "${corregidoTop}"`);
}

console.log("\n── 2 · conteo dice N, la lista tiene M ítems pero M NO está autorizado → NO se toca (bloqueo real sigue vigente) ──");
{
  const texto = "Los 9 clientes en foco son: Falabella · Lider · Sodimac · Jumbo · Tottus.";
  // ledger SIN 5 autorizado (ni ningún count) — la cuenta real (5) tampoco es verificable contra el dato.
  const ledgerSinAutorizar = { figs: [{ unit: "money", raw: 100, canon: "money:100", label: "Ventas", value: "$100" }] };
  const sinTocar = ensureCountAuthorized(texto, ledgerSinAutorizar, []);
  ok(sinTocar === texto, `sin 5 autorizado → el texto queda BYTE-IDÉNTICO (sigue diciendo "9"), nunca inventa una corrección — obtuvo: "${sinTocar}"`);

  // el bloqueo real de guardC() SIGUE vigente sobre ese mismo texto sin corregir (fin del comportamiento esperado:
  // esto NO abre un caso que antes bloqueaba).
  const veredicto = guardC(sinTocar, { ledger: ledgerSinAutorizar, results: [], trace: null, question: "" });
  ok(veredicto.ok === false, `guardC() SIGUE rechazando el texto sin corregir — ok=${veredicto.ok}`);
  ok(veredicto.verdict === "conteo-no-autorizado", `verdict="conteo-no-autorizado" (obtuvo "${veredicto.verdict}") — el muro real no se relajó`);
}

console.log("\n── 3 · conteo YA correcto → texto sin cambios ──");
{
  const texto = "Los 3 focos son: A · B · C.";
  const ledger = { figs: [{ unit: "count", raw: 3, canon: "count:3", label: "Focos", value: "3" }] };
  const resultado = ensureCountAuthorized(texto, ledger, []);
  ok(resultado === texto, `conteo YA coincide con lo enumerado (3=3) → texto intacto, no lo toca — obtuvo: "${resultado}"`);
}

console.log("\n── 4 · sin lista enumerada en la oración → sin cambios ──");
{
  const texto = "Hay 9 clientes con carga alta este período.";
  const ledger = { figs: [{ unit: "count", raw: 5, canon: "count:5", label: "Clientes en foco", value: "5" }] };
  const resultado = ensureCountAuthorized(texto, ledger, []);
  ok(resultado === texto, `sin ":" + lista "· "-separada en la misma oración → nada que recontar, texto intacto — obtuvo: "${resultado}"`);

  // variante: hay ":" pero sin lista "· " real (menos de 2 ítems) — tampoco toca
  const texto2 = "Los 9 focos: revisión pendiente.";
  const resultado2 = ensureCountAuthorized(texto2, ledger, []);
  ok(resultado2 === texto2, `hay ":" pero sin 2+ ítems "· "-separados → tampoco corrige — obtuvo: "${resultado2}"`);
}

console.log("\n── 5 · end-to-end real (motor real vía runPlan, sin LLM) — ensureCountAuthorized (ANTES) + guardC (DESPUÉS) ──");
{
  // dato REAL verificado del tenant demo (scenario "actual", marginRead sin filtros): 8 clientes bajo el benchmark
  // — nombres reales (facts.margin.below), y esa cuenta (8) queda autorizada como fig unit:"count" (specRetrieval.js
  // "{L.p} bajo el benchmark") + como length del array facts.margin.below (_authorizedCounts también camina arrays).
  const NOMBRES_REALES_BAJO_BENCHMARK = ["Lider", "Falabella", "Sodimac", "Jumbo", "Ripley", "Paris", "Tottus", "Mercado Libre"];
  ok(NOMBRES_REALES_BAJO_BENCHMARK.length === 8, "sanity: 8 nombres reales listados (fija el caso de prueba)");

  console.log("\n  ▸ 5a · caso CORREGIBLE — el narrador dice \"9\" pero enumera los 8 reales → el turno TERMINA en el intento 0 (nunca escala) y el texto final trae \"8\", no \"9\"");
  {
    const NARRACION_CON_DESAJUSTE = `Los 9 clientes bajo el benchmark son: ${NOMBRES_REALES_BAJO_BENCHMARK.join(" · ")}.`;
    const seenAttempts = [];
    const callPlan = async () => ({ intent: "answer", mode: "diagnostico", scope: { level: "global" }, calls: [{ tool: "marginRead", args: {} }] });
    const callNarrate = async ({ attempt }) => { seenAttempts.push(attempt); return NARRACION_CON_DESAJUSTE; };
    const r = await answerViaOracle({ text: "cuántos clientes están bajo el benchmark de margen", history: [], mem: {}, scenario: "actual", callPlan, callNarrate });
    ok(r && r.r && r.r.route === "oracle", "responde por Arquitectura C (no aborta el turno)");
    ok(seenAttempts.length === 1, `el turno TERMINA en el intento 0 — nunca escaló a mini→terra→sol — attempts vistos: ${JSON.stringify(seenAttempts)}`);
    ok(!!(r && r.r && r.r.text && r.r.text.includes("Los 8 clientes bajo el benchmark son:")), `el texto final YA trae el conteo corregido ("Los 8 clientes...", no "Los 9...") — obtuvo: "${(r && r.r && r.r.text || "").slice(0, 90)}..."`);
  }

  console.log("\n  ▸ 5b · caso NO CORREGIBLE — dice \"9\" pero enumera solo 6 (ni 9 ni 6 están autorizados: el dato real es 8/13) → SÍ reintenta, NUNCA cuela el conteo sin corregir");
  {
    const seis = NOMBRES_REALES_BAJO_BENCHMARK.slice(0, 6);
    const NARRACION_ROTA = `Los 9 clientes bajo el benchmark son: ${seis.join(" · ")}.`;
    const seenAttempts = [];
    const callPlan = async () => ({ intent: "answer", mode: "diagnostico", scope: { level: "global" }, calls: [{ tool: "marginRead", args: {} }] });
    const callNarrate = async ({ attempt }) => { seenAttempts.push(attempt); return NARRACION_ROTA; };   // mock fijo, ignora attempt — nunca varía la redacción
    const r = await answerViaOracle({ text: "cuántos clientes están bajo el benchmark de margen", history: [], mem: {}, scenario: "actual", callPlan, callNarrate });
    ok(seenAttempts.length === 3, `sin corrección posible (6 no está autorizado) → guardC rechaza y reintenta los 3 intentos — nunca "abre" el caso — attempts: ${JSON.stringify(seenAttempts)}`);
    // reparación controlada (composeFromLedger) puede igual responder algo — lo que NUNCA puede pasar es que el
    // texto roto ("Los 9 clientes... son: " + los 6 inventados como si fueran todos) cuele verbatim sin bloquear.
    if (r && r.r && r.r.text) {
      ok(r.r.text !== NARRACION_ROTA, `si igual respondió (reparación controlada desde la boleta), NO es el texto roto verbatim — obtuvo: "${r.r.text.slice(0, 90)}..."`);
    } else {
      ok(r === null, "sin narración válida que reparar, C se abstiene limpio (fallback) — nunca cuela el texto roto");
    }
  }
}

console.log(`\n── _count_authorized_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
