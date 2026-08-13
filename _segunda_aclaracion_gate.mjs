/* === _segunda_aclaracion_gate.mjs · LA SEGUNDA ACLARACIÓN NO EXISTE (owner 2026-08-12) ================
 * NACIÓ DE UNA CONVERSACIÓN REAL, no de un caso de laboratorio. El owner pidió el resultado después de
 * gastos, ADI respondió bien con la cascada, y después:
 *     — «no entiendo»                      → ADI: «¿qué parte no entendés?»              ← ver NOTA D1
 *     — «logística por qué tiene un 3.5%»  → ADI: «¿a qué parte de la logística…?»       ← EL DEFECTO
 *     — el owner explica                   → ADI REPITE la lectura entera, sin responder
 * Nunca contestó por qué logística es 3.5%. Y la respuesta estaba en su propia tabla: la línea viene sellada
 * «supuesto declarado». El usuario había sido específico —nombró la línea y la cifra— y ADI repreguntó igual.
 *
 * QUÉ CUBRE Y QUÉ NO: `needsOrientacion` dispara en clarifyStreak>=3 y es para «sigue perdido, cambiemos de
 * enfoque». Este es otro problema: el usuario NO está perdido, fue concreto. No tenía regla, y por eso llegó
 * a producción con 124 gates en verde — la certificación probaba PREGUNTAS, no CONVERSACIONES.
 *
 * NOTA D1 (owner 2026-08-13, Paso 3 «ADI pierde el hilo»): el «← correcto» de la primera línea quedó REVERTIDO
 * como juicio de producto — un «no entiendo» pelado ya NO se responde con la contrapregunta sino re-enseñando
 * (doctrina clarify + descarte de la reparación ambigua desclasificada; gate: _clarify_reensena_gate.mjs).
 * LO QUE ESTE GATE FIJA NO CAMBIA: `debeResponderSinRepreguntar` con streak 0 sigue devolviendo false — esa
 * función decide si se FUERZA el modo respuesta (la segunda aclaración), no quién redacta la apertura; con D1,
 * quien responde ese primer «no entiendo» es el modo clarify re-enseñando, no una repregunta.
 *
 *   [1] EL CASO DEL OWNER · la conversación exacta de cuatro turnos.
 *   [2] LA REGLA · sin aclaración previa no se corta nada (una primera aclaración es legítima).
 *   [3] LA RED ES ANGOSTA · ante la duda NO corta: una aclaración de más molesta, una respuesta a la pregunta
 *       equivocada miente.
 *   [4] EL RESET · un turno que responde vuelve el contador a cero (la próxima duda empieza de nuevo).
 * Cero red, cero LLM. `npm run gates:offline`
 */
import { respuestaYaEsEspecifica, debeResponderSinRepreguntar, needsOrientacion } from "./src/adi/oracle/dialogueState.js";

let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };
const H = (t) => console.log("\n" + t);

H("[1] EL CASO DEL OWNER · la conversación de cuatro turnos, textual");
{
  // turno 2: «no entiendo» — sin aclaración previa, ESTA regla no corta nada (quién redacta la apertura es
  // asunto de D1/clarify: desde 2026-08-13 se re-enseña, no se repregunta — ver NOTA D1 en la cabecera)
  ok(!debeResponderSinRepreguntar("no entiendo", 0), "«no entiendo» sin aclaración previa: esta regla no fuerza nada (la apertura la decide clarify/D1)");
  ok(!respuestaYaEsEspecifica("no entiendo"), "…porque «no entiendo» no es específico: no nombra nada");
  // turno 3: la respuesta del owner — ACÁ estaba el defecto
  ok(respuestaYaEsEspecifica("logistica por que tiene un 3.5%"), "«logística por qué tiene un 3.5%» ES específico: nombra la línea Y la cifra");
  ok(debeResponderSinRepreguntar("logistica por que tiene un 3.5%", 1),
    "con una aclaración ya pedida, ADI DEBE responder — no repreguntar",
    "este es el turno exacto en que el producto falló en vivo");
  // turno 4: la explicación del owner también obliga a responder
  ok(debeResponderSinRepreguntar("el analisis que me diste de gastos, el resultado del negocio", 1),
    "y la explicación del turno siguiente también obliga a responder");
}

H("[2] LA REGLA · la PRIMERA aclaración sigue siendo legítima");
{
  for (const t of ["logistica por que tiene un 3.5%", "el margen de Falabella", "no entiendo"])
    ok(!debeResponderSinRepreguntar(t, 0), `sin aclaración previa NO se corta nada — "${t}"`);
  ok(debeResponderSinRepreguntar("el margen", 2), "y con dos aclaraciones encima, con más razón");
  ok(needsOrientacion("cualquier cosa", 3) === "confusion_persistente",
    "la orientación por confusión persistente (streak>=3) sigue intacta: es OTRO problema, no se tocó");
}

H("[3] LA RED ES ANGOSTA · ante la duda NO corta");
{
  // vago de verdad: sigue habilitado a repreguntar
  for (const t of ["", "  ", "?", "ah", "eh", "mmm"])
    ok(!debeResponderSinRepreguntar(t, 1), `sigue siendo vago, ADI puede repreguntar — ${JSON.stringify(t)}`);
  // específico por CIFRA o por NOMBRE de línea — las dos señales, por separado
  ok(respuestaYaEsEspecifica("los 4 de arriba"), "una cifra sola ya alcanza — «los 4 de arriba»");
  ok(respuestaYaEsEspecifica("el costo"), "el nombre de una línea también — «el costo»");
  ok(respuestaYaEsEspecifica("la carga comercial"), "«la carga comercial»");
  ok(respuestaYaEsEspecifica("lo del inventario"), "«lo del inventario»");
  ok(!respuestaYaEsEspecifica("no sé"), "y «no sé» NO es específico: ahí repreguntar es lo correcto");
}

H("[4] EL RESET · responder vuelve el contador a cero");
{
  // el reset lo hace answerViaOracle (clarifyStreakNow = 0 si el modo no es clarify); acá se prueba la regla
  // que lo habilita: con streak 0, el ciclo puede empezar de nuevo sin arrastrar el corte del turno anterior.
  ok(!debeResponderSinRepreguntar("no entiendo", 0), "tras un turno que respondió, una duda nueva puede volver a aclararse");
  ok(debeResponderSinRepreguntar("el margen de Lider", 1), "y el ciclo vuelve a cerrarse en la primera respuesta específica");
}

console.log(`\n── LA SEGUNDA ACLARACIÓN · ${PASS} PASS · ${FAIL} FAIL ──`);
process.exitCode = FAIL ? 1 : 0;
