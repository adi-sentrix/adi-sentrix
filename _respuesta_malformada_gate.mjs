/* === _respuesta_malformada_gate.mjs · "SIN TOOL_CALL" NO ES UNA SOLA COSA (owner 2026-08-13) ============
 * @inspeccion-estatica — este gate INYECTA respuestas malformadas en el módulo real que las clasifica, y además
 * LEE los dos adaptadores como texto para probar que están enchufados a él. No importa el gateway ni un adapter
 * (el clasificador los marca LIVE y quedarían fuera de la suite), no invoca a nadie y no sale a la red.
 *
 * EL DÍA QUE COSTÓ UNA CORRIDA. Las 12 puertas de una corrida viva fallaron con el MISMO mensaje —"sin tool_call
 * en la respuesta"— y ese mensaje mandó a revisar el adaptador. El adaptador estaba sano: un interceptor de
 * prueba había reemplazado el fetch global y devolvía `{ok:true}` a toda ruta que no reconocía. Al adaptador
 * nunca le llegó una respuesta del proveedor; le llegó un objeto de otro programa. El mensaje nombraba la única
 * causa que el adaptador sabía nombrar, y era la equivocada.
 *
 *   [1] LA RESPUESTA EXACTA DEL INCIDENTE · `{ok:true}`, inyectada. Tiene que decir que NO es del proveedor.
 *   [2] EL OTRO CASO, QUE SÍ ES DEL PROVEEDOR · sobre real sin tool_call. Mensaje distinto, y dice por qué.
 *   [3] LOS DOS SE DISTINGUEN · ni el texto ni el código se pisan. Es todo el punto del arreglo.
 *   [4] SE FALLA HACIA EL STATUS QUO · ante la duda, se trata como respuesta del proveedor. Nunca al revés.
 *   [5] EL ERROR EN EL CUERPO · sobre válido con `error` adentro y HTTP 200: tercera causa, tercer mensaje.
 *   [6] EL CABLEADO LLEGA · los dos adaptadores lo usan en parse Y en narrar, y ya nadie tira el mensaje plano.
 *   [7] EL TURNO SIGUE QUEDANDO TIPADO · el error viaja como código cerrado a la telemetría, no como texto.
 * Cero red, cero LLM. `npm run gates:offline`
 */
import { readFileSync } from "fs";
import { sobreAjeno, errorDeRespuesta, pareceRespuestaDelProveedor, MARCADORES_DE_SOBRE } from "./src/adi/llm/respuestaProveedor.js";
import { aReasonCode } from "./src/adi/llm/telemetry.js";

let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };
const H = (t) => console.log("\n" + t);
const leer = (p) => readFileSync(p, "utf8").replace(/\r\n/g, "\n");

// LA RESPUESTA DEL INCIDENTE, tal cual la devolvía el interceptor: sin `choices`, sin `usage`, sin `model`.
const DEL_INTERCEPTOR = { ok: true };
// Y UNA RESPUESTA REAL del proveedor a la que le falta el tool_call: el modelo redactó prosa en vez de llamar.
const SIN_TOOL_CALL = {
  id: "chatcmpl-x", object: "chat.completion", model: "gpt-4o-mini-2024-07-18",
  choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content: "Claro, te explico…" } }],
  usage: { prompt_tokens: 7600, completion_tokens: 42 },
};

H("[1] LA RESPUESTA EXACTA DEL INCIDENTE · `{ok:true}` inyectada, sin red");
{
  const err = errorDeRespuesta(DEL_INTERCEPTOR, { proveedor: "openai", esperado: "tool_call" });
  ok(err instanceof Error, "inyectarla devuelve un Error de verdad (no un objeto que alguien tenga que interpretar)");
  ok(/el proveedor \(openai\) no mandó esto/i.test(err.message), `dice que NO es una respuesta del proveedor — "${err.message}"`);
  ok(!/sin tool_call/i.test(err.message), "y NO dice «sin tool_call»: ése era el mensaje que mandó a revisar un adaptador sano");
  ok(/claves: ok\b/.test(err.message), "nombra las claves que llegaron, que es lo que delata al intruso de un vistazo");
  ok(/interceptor|proxy|mock/i.test(err.message), "y apunta a dónde buscar: al camino, no al adaptador");
  ok(err.code === "respuesta_ajena", `el código de la causa viaja aparte del texto — ${err.code}`);
  // el mismo objeto, entrando por la puerta de narrar: antes salía como una narración VACÍA con ok:true.
  const enNarrar = sobreAjeno(DEL_INTERCEPTOR, "openai");
  ok(enNarrar instanceof Error && enNarrar.code === "respuesta_ajena",
    "y por la puerta de narrar también corta: un objeto que no se entiende no puede salir como éxito vacío");
  // NUNCA los valores, sólo las claves: el mensaje va al log del server y no puede volverse una fuga.
  const conDato = sobreAjeno({ Falabella: 13900000, margen: "22%" }, "openai");
  ok(!/13900000|22%/.test(conDato.message), `del objeto ajeno viajan las claves, jamás los valores — "${conDato.message}"`);
}

H("[2] EL OTRO CASO · el proveedor SÍ contestó, y le faltó la llamada a la tool");
{
  const err = errorDeRespuesta(SIN_TOOL_CALL, { proveedor: "openai", esperado: "tool_call" });
  ok(/el proveedor \(openai\) contestó sin tool_call/i.test(err.message), `dice exactamente eso — "${err.message}"`);
  ok(!/no mandó esto|interceptor/i.test(err.message), "y NO acusa a un interceptor: acá el proveedor contestó de verdad");
  ok(/pudo facturarse/i.test(err.message), "avisa que la llamada salió y pudo cobrarse: no es un turno gratis");
  ok(/corte: stop/.test(err.message), "trae el motivo de corte, que separa «el modelo prefirió redactar» de «se truncó»");
  const truncada = errorDeRespuesta({ ...SIN_TOOL_CALL, choices: [{ finish_reason: "length", message: {} }] },
    { proveedor: "openai", esperado: "tool_call" });
  ok(/corte: length/.test(truncada.message), `una respuesta truncada se ve distinta de una completa — "${truncada.message}"`);
  ok(err.code === "sin_tool_call", `y su propio código — ${err.code}`);
  // el vocabulario del otro proveedor no se hardcodea acá: el adapter dice qué esperaba.
  const anth = errorDeRespuesta({ id: "msg_1", stop_reason: "end_turn", content: [{ type: "text", text: "hola" }] },
    { proveedor: "anthropic", esperado: "tool_use" });
  ok(/el proveedor \(anthropic\) contestó sin tool_use/.test(anth.message) && /corte: end_turn/.test(anth.message),
    `el mismo trato para el otro adaptador, con su vocabulario — "${anth.message}"`);
}

H("[3] LOS DOS SE DISTINGUEN · ni el texto ni el código se pisan");
{
  const a = errorDeRespuesta(DEL_INTERCEPTOR, { proveedor: "openai", esperado: "tool_call" });
  const b = errorDeRespuesta(SIN_TOOL_CALL, { proveedor: "openai", esperado: "tool_call" });
  ok(a.message !== b.message, "dos causas, dos mensajes");
  ok(a.code !== b.code, `dos causas, dos códigos — ${a.code} ≠ ${b.code}`);
  // LA PRUEBA QUE IMPORTA: leyendo el mensaje, ¿a dónde manda a mirar? A lugares distintos.
  ok(/no mandó esto/i.test(a.message) && /contestó sin tool_call/i.test(b.message),
    "uno dice que el objeto no vino del proveedor; el otro, que el proveedor contestó y le faltó la tool");
  ok(/interceptor|proxy|mock/i.test(a.message) && !/interceptor|proxy|mock/i.test(b.message),
    "el que no es del proveedor manda a revisar el camino; el otro, no");
  ok(/pudo facturarse/i.test(b.message) && !/pudo facturarse/i.test(a.message),
    "y sólo el que salió de verdad avisa que pudo cobrarse: uno costó plata y el otro no");
}

H("[4] SE FALLA HACIA EL STATUS QUO · ante la duda, se trata como respuesta del proveedor");
{
  // Un falso «no es una respuesta del proveedor» mandaría a buscar un interceptor que no existe — el error caro
  // que este arreglo viene a evitar. Por eso alcanza UN solo campo del sobre.
  for (const k of MARCADORES_DE_SOBRE) {
    ok(pareceRespuestaDelProveedor({ [k]: null }), `con sólo \`${k}\` ya cuenta como respuesta del proveedor`);
  }
  ok(!("ok" in { ...Object.fromEntries(MARCADORES_DE_SOBRE.map((k) => [k, 1])) }),
    "…y `ok` NO es un marcador: es justo el campo con el que el interceptor se hizo pasar por el proveedor");
  ok(sobreAjeno(SIN_TOOL_CALL, "openai") === null, "un sobre real pasa sin error: la puerta no molesta al camino bueno");
  ok(sobreAjeno({ choices: [{ message: { content: "" } }] }, "openai") === null,
    "y una respuesta REAL con contenido vacío sigue pasando: eso no cambió, se sigue devolviendo texto vacío");
  // lo que ni siquiera es un objeto (una página de error parseada, null, un array) también se nombra bien.
  for (const [v, esperado] of [[null, "null"], ["<html>", "un string"], [[1, 2], "un array"], [42, "un number"], [undefined, "un undefined"]]) {
    const e = sobreAjeno(v, "openai");
    ok(e && e.code === "respuesta_ajena" && e.message.includes(esperado), `llegó ${esperado} → se dice qué llegó`, e && e.message);
  }
}

H("[5] EL ERROR EN EL CUERPO · sobre válido, HTTP 200, y adentro un error del proveedor");
{
  const e = sobreAjeno({ error: { type: "insufficient_quota", message: "You exceeded your current quota" } }, "openai");
  ok(e instanceof Error && e.code === "error_en_cuerpo", `tercera causa, tercer código — ${e && e.code}`);
  ok(/insufficient_quota/.test(e.message), `y el tipo del proveedor, que es lo accionable — "${e.message}"`);
  ok(!/You exceeded/.test(e.message), "sin arrastrar el texto largo del proveedor al mensaje");
  ok(!/sin tool_call|interceptor/i.test(e.message), "no se disfraza de ninguna de las otras dos");
  ok(aReasonCode(e.message) === "provider_error", `y queda tipada en la telemetría — ${aReasonCode(e.message)}`);
}

H("[6] EL CABLEADO LLEGA · los dos adaptadores lo usan, en parse Y en narrar");
{
  // No se pueden importar (el clasificador sacaría este gate de la suite), así que se leen como texto. Lo que se
  // prueba acá es lo único que la inspección puede probar: que el arreglo esté ENCHUFADO en los dos puntos.
  for (const [nombre, ruta, esperado] of [
    ["openai", "./src/adi/llm/adapters/openai.js", "tool_call"],
    ["anthropic", "./src/adi/llm/adapters/anthropic.js", "tool_use"],
  ]) {
    const SRC = leer(ruta);
    ok(/^\s*import\s*\{[^}]*errorDeRespuesta[^}]*\}\s*from\s*"\.\.\/respuestaProveedor\.js"/m.test(SRC),
      `${nombre} · importa el clasificador (una sola fuente para los dos adaptadores)`);
    ok(new RegExp(`throw errorDeRespuesta\\(data, \\{ proveedor: "${nombre}", esperado: "${esperado}" \\}\\)`).test(SRC),
      `${nombre} · parse lanza el error clasificado, con su propio vocabulario`);
    ok(new RegExp(`sobreAjeno\\(data, "${nombre}"\\)`).test(SRC), `${nombre} · narrar corta antes de devolver una narración vacía`);
    // EL MENSAJE PLANO YA NO EXISTE: si alguien lo reescribe, este gate se pone rojo.
    ok(!/new Error\("sin tool_(call|use) en la respuesta"\)/.test(SRC),
      `${nombre} · ya no queda el mensaje plano que confundía las tres causas`);
    // …y el orden importa: la puerta de narrar tiene que estar ANTES de leer el contenido, o no sirve de nada.
    const iPuerta = SRC.indexOf(`sobreAjeno(data, "${nombre}")`);
    const iTexto = SRC.indexOf("const txt =");
    ok(iPuerta > 0 && iTexto > iPuerta, `${nombre} · la puerta va ANTES de leer el contenido`, `puerta@${iPuerta} texto@${iTexto}`);
    // el adapter sigue sin importar módulos de producto: la regla vieja no se relajó para meter esto.
    const imports = [...SRC.matchAll(/^\s*import[^\n]*from\s+["']([^"']+)["']/gm)].map((m) => m[1]);
    ok(imports.every((p) => /respuestaProveedor\.js$/.test(p)),
      `${nombre} · y no se coló ninguna otra dependencia — ${JSON.stringify(imports)}`);
  }
}

H("[7] EL TURNO SIGUE QUEDANDO TIPADO · el error viaja como código cerrado, no como texto");
{
  // El gateway ya traduce `e.message` a un reasonCode de lista cerrada. Con mensajes nuevos hay que verificar
  // que sigan cayendo donde corresponde: si cayeran en «unknown», el registro perdería la causa.
  const ajena = errorDeRespuesta(DEL_INTERCEPTOR, { proveedor: "openai", esperado: "tool_call" });
  const sinCall = errorDeRespuesta(SIN_TOOL_CALL, { proveedor: "openai", esperado: "tool_call" });
  ok(aReasonCode(ajena.message) === "provider_error", `la respuesta ajena queda tipada — ${aReasonCode(ajena.message)}`);
  ok(aReasonCode(sinCall.message) === "provider_error", `y la que contestó sin tool_call también — ${aReasonCode(sinCall.message)}`);
  // El texto NO viaja a la telemetría (ahí sólo va el código); el detalle vive en el log del server, que es
  // donde el gateway ya loguea el cuerpo de error del proveedor. Se verifica que el mensaje entre en ese renglón.
  ok(ajena.message.length <= 200 && sinCall.message.length <= 200,
    `los dos mensajes entran completos en el log del server (200 caracteres) — ${ajena.message.length}/${sinCall.message.length}`);
}

console.log(`\n── RESPUESTA MALFORMADA DEL PROVEEDOR · ${PASS} PASS · ${FAIL} FAIL ──`);
process.exit(FAIL ? 1 : 0);
