/* === _gateway_causa_emision_gate.mjs · TODO HANDLER QUE PUEDE GASTAR EMITE, Y CON CAUSA ================
 * @inspeccion-estatica — este gate LEE código fuente como texto. No importa el gateway, no invoca a nadie y no
 * sale a la red; el candado de runtime (--import offline-guard) se le aplica igual que a todos. La prueba de
 * CONDUCTA de lo mismo vive en _gateway_causa_y_costo_gate.mjs, que sí ejerce los handlers con el proveedor
 * mockeado y por eso el clasificador estático lo marca LIVE (no corre en la suite). Este corre siempre.
 *
 * EL ALCANCE, DICHO SIN INFLAR (corrección de la 2ª pasada, owner 2026-08-11). La versión anterior se titulaba
 * "TODA RUTA DEL GATEWAY EMITE" y sólo miraba DOS de los cuatro handlers que llaman al proveedor: handleSpec y
 * handleNarrate —montados en endpoints DESPLEGADOS y con llamada PAGA— quedaban fuera del helper que aísla los
 * cuerpos, así que el gate afirmaba más de lo que probaba. Ahora:
 *   · se inspeccionan LOS CUATRO handlers que pueden gastar, y
 *   · la lista no se escribe a mano: se DERIVA del fuente (§0). Un handler nuevo que llame al proveedor y no
 *     esté instrumentado rompe este gate solo, sin que nadie tenga que acordarse de agregarlo acá.
 * Lo que este gate NO prueba y no pretende: el emisor de la ruta DETERMINÍSTICA (answerViaOracle.js), que es de
 * otro archivo y sigue mandando `resultado:"rechazado"` con la causa en null. Está declarado en el residual.
 *
 * EL HECHO QUE LO MOTIVA: de los 142 eventos de la corrida, 10 dijeron "rechazado" con la causa en NULL, 27
 * reintentos se registraron como llamadas felices sin explicar por qué existían, y 6 llamadas pagadas que
 * fallaron no dejaron NI UN evento. El instrumento existe para responder POR QUÉ se reintentó y respondía nulo.
 *
 *   [0] EL ALCANCE SE DERIVA DEL FUENTE · quién puede gastar, lo dice el código, no esta lista.
 *   [1] NINGUNA SALIDA MUDA · todo `return` del handler o pasa por el freno emisor o devuelve algo ya emitido.
 *   [2] LA RED DE SEGURIDAD · toda excepción deja evento, exactamente uno, y se relanza intacta.
 *   [3] LA LLAMADA PAGA SE DESARMA DENTRO DEL try · una respuesta inutilizable ya costó plata.
 *   [4] LA CAUSA NUNCA ES NULA EN UN REINTENTO · lo no declarado es "unknown", no silencio.
 *   [5] EL BORDE DE PRIVACIDAD, EJERCITADO · sólo pueden sobrevivir los siete códigos cerrados.
 *   [6] OBSERVACIÓN PURA · la telemetría sigue sin decidir nada.
 *   [7] EL CABLEADO DEL CLIENTE · la causa sale del navegador, o el campo es cañería muerta.
 */
import { readFileSync } from "fs";
import { REASON_CODES, aReasonCode } from "./src/adi/llm/telemetry.js";

let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };
const H = (t) => console.log("\n" + t);

// Fin de línea normalizado a \n: el repo está en CRLF y un `\n}\n` literal no matchea nunca sobre `\r\n}\r\n`.
// Sin esto el aislador se pasaba de largo y arrastraba el handler siguiente — un gate que mide el archivo
// equivocado no mide nada.
const leer = (p) => readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const SRC = leer("./src/adi/llm/gatewayCore.js");
// El cuerpo termina en el `}` de columna 0 que cierra la declaración — no en "el próximo export", que arrastraba
// los helpers de módulo que viven entre dos handlers y hacía pasar aserciones con texto que no era del handler.
const cuerpo = (nombre) => {
  const i = SRC.indexOf(`export async function ${nombre}(`);
  if (i < 0) return "";
  const j = SRC.indexOf("\n}\n", i);
  return SRC.slice(i, j < 0 ? SRC.length : j + 2);
};

H("[0] EL ALCANCE SE DERIVA DEL FUENTE · quién puede gastar lo dice el código, no una lista escrita a mano");
// LOS QUE COBRAN: los que llaman al adapter del proveedor. Se descubren leyendo el archivo.
const EXPORTADOS = [...SRC.matchAll(/export async function (\w+)\(/g)].map((m) => m[1]);
const GASTAN = EXPORTADOS.filter((n) => /getAdapter\(/.test(cuerpo(n)));
// metadatos por handler: cuántos frenos propios tiene y si su body acepta la causa del intento anterior.
// (SPEC y NARRAR-LEGACY no tienen rate limit ni `attempt`: su contrato de request no los trae.)
const META = {
  handlePlan: { n: "PLAN", frenos: 3, causa: true },
  handleNarrateC: { n: "NARRAR-C", frenos: 3, causa: true },
  handleSpec: { n: "SPEC", frenos: 2, causa: false },
  handleNarrate: { n: "NARRAR-LEGACY", frenos: 2, causa: false },
};
ok(GASTAN.length >= 4, `el fuente declara ${GASTAN.length} handlers que llaman al proveedor — ${JSON.stringify(GASTAN)}`);
ok(GASTAN.every((n) => META[n]), "TODO handler que puede gastar está inspeccionado por este gate (uno nuevo sin instrumentar rompe acá)",
  `sin inspeccionar: ${JSON.stringify(GASTAN.filter((n) => !META[n]))}`);
// …y el que NO gasta se justifica: handleAccess no habla con ningún proveedor, por eso queda afuera sin mentir.
ok(!/getAdapter\(/.test(cuerpo("handleAccess")), "handleAccess queda afuera porque NO llama al proveedor: no puede gastar (si algún día lo hace, entra)");
// Cada ruta publicada apunta a un handler que existe: el mapa no puede quedar apuntando al vacío.
const RUTAS = [...SRC.matchAll(/"\/api\/[a-z0-9-]+":\s*(\w+)/g)].map((m) => m[1]);
ok(RUTAS.length >= 5 && RUTAS.every((h) => EXPORTADOS.includes(h)), `las ${RUTAS.length} rutas publicadas apuntan a handlers exportados`);
ok(GASTAN.every((n) => RUTAS.includes(n)), "y los cuatro que gastan están efectivamente montados: no son código muerto que no haga falta instrumentar");

const HANDLERS = GASTAN.filter((n) => META[n]).map((n) => ({ id: n, ...META[n], body: cuerpo(n) }));
const CON_CAUSA = HANDLERS.filter((h) => h.causa);

H("[1] NINGUNA SALIDA MUDA · todo `return` del handler o pasa por el freno emisor o devuelve algo ya emitido");
for (const { n, frenos, body } of HANDLERS) {
  ok(body.length > 400, `${n} · se aisló el cuerpo — ${body.length} caracteres`);
  ok(/const\s+_emitir\s*=/.test(body) && /emitTelemetria\s*\(/.test(body), `${n} · define UN emisor y ese emisor llama a la telemetría`);
  ok(/const\s+_frenado\s*=[^\n]*_emitir\s*\(/.test(body), `${n} · el freno propio del gateway emite antes de devolver`);
  const nFrenos = (body.match(/return\s+_frenado\s*\(/g) || []).length;
  ok(nFrenos >= frenos, `${n} · sus ${frenos} salidas tempranas emiten — ${nFrenos} encontradas`);

  // LA REGLA GENERAL, no la lista de frenos conocidos: se enumeran TODOS los `return` del cuerpo y cada uno tiene
  // que ser o `_frenado(...)` (que emite y devuelve) o una variable que ya se le pasó a `_emitir`. Un `return`
  // nuevo —correcto o no— que no cumpla ninguna de las dos cosas cae acá, sin que este gate tenga que conocerlo.
  // La definición de `_frenado` se saca ANTES de mirar: su parámetro se llama `r`, igual que la variable de la
  // respuesta feliz de varios handlers, así que su `_emitir(r, causa)` interno hacía pasar por emitido un
  // `return r;` al que le hubieran borrado el emit. Una mutación medida (quitarle `_emitir(r)` al camino feliz
  // de SPEC) pasaba este gate en verde por esa coincidencia de nombres. Se mide sobre el resto del cuerpo.
  const sinFrenado = body.replace(/const\s+_frenado\s*=[^\n]*\n/, "");
  const retornos = [...sinFrenado.matchAll(/\breturn\s+([^;\n]+);/g)].map((m) => m[1].trim());
  const mudos = retornos.filter((r) => {
    if (/^_frenado\(/.test(r)) return false;
    if (!/^[A-Za-z_$][\w$]*$/.test(r)) return true;                       // devuelve un literal armado en el aire
    return !new RegExp(`_emitir\\(\\s*${r}\\s*[,)]`).test(sinFrenado);    // …o una variable que nadie emitió
  });
  ok(mudos.length === 0, `${n} · los ${retornos.length} \`return\` del handler salen emitiendo`, `mudos: ${JSON.stringify(mudos)}`);

  ok(/intento:\s*(Number\(attempt\)|0)/.test(body) && /latencia_ms:\s*Date\.now\(\)\s*-/.test(body),
    `${n} · el evento lleva intento y latencia medida`);
  // el reloj tiene que arrancar ANTES de los frenos, o la latencia de una ruta temprana no existe
  ok(body.indexOf("Date.now()") < body.indexOf("_access("), `${n} · el reloj arranca al entrar al handler, no recién antes de llamar al proveedor`);
}
ok(/etapa:\s*["']plan["']/.test(cuerpo("handlePlan")) && /etapa:\s*["']narrar["']/.test(cuerpo("handleNarrateC")), "cada handler etiqueta su propia etapa");

H("[2] LA RED DE SEGURIDAD · toda excepción deja evento, exactamente uno, y se relanza intacta");
for (const { n, body } of HANDLERS) {
  // el contador es lo que hace que la red no duplique: si una rama de adentro ya contó la llamada, el pie no emite.
  ok(/let\s+_emitidos\s*=\s*0/.test(body) && /_emitidos\+\+/.test(body), `${n} · lleva la cuenta de lo ya emitido (un evento por llamada, jamás dos)`);
  // el try tiene que abrir ANTES del primer freno: si abriera después, todo lo de arriba seguiría siendo ruta ciega.
  const iTry = body.indexOf("\n  try {"), iAcc = body.indexOf("_access(access, env)");
  ok(iTry > 0 && iAcc > 0 && iTry < iAcc, `${n} · el try envuelve el handler ENTERO, no sólo la llamada al proveedor`);
  const cola = body.slice(body.lastIndexOf("catch (e) {"));
  ok(/if\s*\(\s*!_emitidos\s*\)\s*_emitir\(/.test(cola), `${n} · el catch del pie emite SOLO si nadie contó ya esta llamada`);
  ok(/throw\s+e;/.test(cola), `${n} · …y relanza intacta: ningún reintento del oráculo cambia de comportamiento`);
  ok(!/\breturn\b/.test(cola), `${n} · el catch del pie no se traga el error devolviendo algo: no decide nada`);
}

H("[3] LA LLAMADA PAGA SE DESARMA DENTRO DEL try · una respuesta inutilizable ya costó plata");
for (const { n, body } of HANDLERS) {
  const iAd = body.indexOf("getAdapter(provider)");
  const iCatch = body.indexOf("catch (e) {", iAd);
  const iDes = body.indexOf("} = salida)", iAd);
  ok(iAd > 0 && iCatch > iAd, `${n} · la llamada al proveedor está envuelta en try/catch`);
  ok(iDes > iAd && iDes < iCatch,
    `${n} · la respuesta del proveedor se desarma DENTRO del try: si viene vacía, la llamada pagada igual deja evento`,
    `getAdapter@${iAd} desarmado@${iDes} catch@${iCatch}`);
  const bloque = body.slice(iCatch, body.indexOf("\n    }", iCatch) + 6);
  ok(/_emitir\s*\(/.test(bloque), `${n} · el catch del proveedor emite el evento de la llamada fallida`);
  ok(/throw\s+e;/.test(bloque), `${n} · y RELANZA intacta: el loop de reintentos del oráculo vive de esa excepción`);
  ok(!/\breturn\b/.test(bloque), `${n} · el catch del proveedor no devuelve nada: no cambia ninguna decisión`);
}

H("[4] LA CAUSA NUNCA ES NULA EN UN REINTENTO · lo no declarado es «unknown», no silencio");
{
  ok(CON_CAUSA.length === 2, `los dos handlers con reintento resuelven la causa del intento — ${CON_CAUSA.map((h) => h.n).join(", ")}`);
  ok(CON_CAUSA.every((h) => /_causaDelIntento\s*\(/.test(h.body)), "los dos llaman al resolvedor de causa");
  const i = SRC.indexOf("function _causaDelIntento");
  const fn = SRC.slice(i, i + 260);
  ok(/attempt\)\s*\|\|\s*0\)\s*<=\s*0\)\s*return null/.test(fn), "intento 0 no inventa una causa: no hubo ningún rechazo previo que explicar");
  ok(/\|\|\s*"unknown"/.test(fn), "intento ≥1 SIEMPRE sale con causa: lo no declarado queda en «unknown», nunca en null");
  ok(CON_CAUSA.every((h) => /motivoReintento/.test(h.body)), "los dos aceptan la causa declarada por el cliente en el body");
  // la causa heredada no puede pisar la del propio evento (un timeout es más específico que «este intento es un reintento»)
  for (const { n, body } of CON_CAUSA)
    ok(/reasonCode\s*=\s*causa\s*\|\|\s*ev\.reasonCode\s*\|\|\s*_causa/.test(body),
      `${n} · prioridad de causas: la de ESTE evento primero, la heredada del intento anterior después`);
}

H("[5] EL BORDE DE PRIVACIDAD, EJERCITADO · el patrón sale del código y se prueba con texto real");
{
  // No se puede importar el módulo sin que el clasificador saque este gate de la suite, así que el patrón que
  // valida la causa se EXTRAE del fuente y se ejerce acá, compuesto con el traductor REAL de telemetry.js.
  const m = SRC.match(/function _causaDeclarada[\s\S]*?!(\/\^[^\n]+?\/)\.test\(motivo\)/);
  ok(!!m, "se pudo extraer del código el patrón que valida la causa declarada");
  const patron = m ? new RegExp(m[1].slice(1, -1)) : /$^/;
  const borde = (x) => (typeof x === "string" && patron.test(x) ? aReasonCode(x) : null);

  // LO QUE NO PUEDE PASAR: cualquier cosa que se parezca a un dato del cliente muere en el borde, entera.
  const veneno = [
    ["cifra-no-autorizada: $13,9M de Falabella", "el veredicto con la cifra del negocio adentro"],
    ["El margen de Falabella cerró en $99,9M", "una frase del turno"],
    ["Falabella", "un nombre de entidad"],
    ["guard: entidad-sin-dueño", "un motivo con espacios y dos puntos"],
    ["4300000", "una cifra pelada"],
    ["cifra_no_autorizada_2024", "vocabulario con dígitos"],
    ["a".repeat(400), "un texto largo cualquiera"],
    [{ kind: "cifra-no-autorizada" }, "un objeto en vez de un código"],
  ];
  for (const [x, porQue] of veneno) ok(borde(x) === null, `se descarta entero: ${porQue}`);

  // LO QUE SÍ PASA: un token de vocabulario cerrado — y lo que sale es SIEMPRE uno de los siete códigos.
  ok(borde("cifra-no-autorizada") === "guard_rejected", "el veredicto del guard sale como CÓDIGO, no como texto");
  ok(borde("tabla-faltante") === "guard_rejected", "otra clase de rechazo del guard, el mismo código");
  ok(borde("rate-limited") === "rate_limited" && borde("guard_rejected") === "guard_rejected", "un código de la lista pasa tal cual");
  ok(borde("orden-sellado-incumplido") === "unknown", "un veredicto que el traductor no conoce cae en «unknown», jamás en el texto original");
  const salidas = ["cifra-no-autorizada", "tabla-faltante", "guard-lo-que-sea", "orden-sellado-incumplido", "abc"].map(borde);
  ok(salidas.every((s) => REASON_CODES.includes(s)), `todo lo que atraviesa el borde es uno de los siete códigos — ${JSON.stringify(salidas)}`);
  ok(/aReasonCode\(motivo\)/.test(SRC), "y lo que se guarda es la traducción, nunca la cadena que entró");
}

H("[6] OBSERVACIÓN PURA · la telemetría sigue sin decidir nada");
{
  ok(!/if\s*\([^)]*emitTelemetria/.test(SRC), "ninguna condición del gateway depende de la telemetría");
  ok(!/return\s+emitTelemetria/.test(SRC), "ningún retorno del gateway sale de la telemetría");
  ok(!/await\s+emitTelemetria/.test(SRC), "no se espera: no puede demorar la respuesta");
  // POR QUÉ la causa se escribe sobre el evento y NO se pasa como `motivo` a desdeRespuesta: ese parámetro tipa
  // como "rechazado" TODO evento que lo traiga, y una llamada que salió bien no se puede contar como rechazo sólo
  // porque exista por un rechazo anterior — invertiría la métrica de la corrida (27 llamadas buenas → rechazos).
  for (const { n, body } of HANDLERS) ok(!/motivo:/.test(body), `${n} · el resultado lo decide la respuesta, no la causa heredada`);
  // El contrato de retorno de los dos handlers viejos NO cambió al instrumentarlos: siguen devolviendo lo mismo
  // que leen api/adi-spec.js y api/adi-narrate.js. Instrumentar no es una excusa para cambiar una respuesta.
  ok(/const r = \{ ok: true, spec, usage \};/.test(cuerpo("handleSpec")), "SPEC devuelve exactamente {ok, spec, usage}: instrumentar no le cambió el contrato a un endpoint desplegado");
  ok(/const r = \{ ok: true, narration, usage \};/.test(cuerpo("handleNarrate")), "NARRAR-LEGACY devuelve exactamente {ok, narration, usage}: idem");
  for (const { n, body } of CON_CAUSA)
    ok(/costUSD:\s*estimateCostUSD\(modeloReal/.test(body), `${n} · el costo se calcula UNA vez, sobre el modelo EFECTIVO`);
}

H("[7] EL CABLEADO DEL CLIENTE · la causa sale del navegador, o el campo del gateway es cañería muerta");
{
  // EL DEFECTO QUE CIERRA: los dos handlers aceptaban `motivoReintento` y NINGÚN llamador real lo mandaba, así que
  // el veredicto de guardC —la única causa que existe de verdad en el turno— no llegaba nunca a la telemetría.
  const UI = leer("./src/ui/ChatADI.jsx");
  const fn = (nombre) => {
    const i = UI.indexOf(`async function ${nombre}(`);
    if (i < 0) return "";
    const j = UI.indexOf("\n}\n", i);
    return UI.slice(i, j < 0 ? UI.length : j + 2);
  };
  for (const [etiqueta, nombre] of [["PLAN", "_fetchPlan"], ["NARRAR-C", "_fetchNarrateC"]]) {
    const f = fn(nombre);
    ok(f.length > 200, `${etiqueta} · se aisló el emisor del cliente — ${f.length} caracteres`);
    ok(/\bmotivoReintento\b/.test(f.slice(0, f.indexOf("{", f.indexOf("(")))) || /\{[^}]*\bmotivoReintento\b[^}]*\}\s*\)\s*\{/.test(f.slice(0, 400)),
      `${etiqueta} · la función acepta la causa del intento anterior en sus argumentos`);
    const m = f.match(/body:\s*JSON\.stringify\(\{([\s\S]*?)\}\)/);
    ok(!!m, `${etiqueta} · se aisló el body que sale al gateway`);
    const campos = m ? m[1] : "";
    ok(/\battempt\b/.test(campos), `${etiqueta} · el body sigue mandando \`attempt\` (nada de lo que ya viajaba dejó de viajar)`);
    ok(/\bmotivoReintento\b/.test(campos), `${etiqueta} · …y ahora manda también la causa, junto a \`attempt\``, `body: ${campos.trim().slice(0, 160)}`);
  }
  // NO ROMPE EL TURNO QUE NO REINTENTA: sin causa declarada el campo queda `undefined` y JSON.stringify lo OMITE,
  // así que el body de un intento 0 es byte por byte el mismo que antes de este cambio. Se prueba, no se afirma.
  const sin = JSON.stringify({ text: "x", attempt: 0, motivoReintento: undefined });
  ok(sin === JSON.stringify({ text: "x", attempt: 0 }), `un turno sin reintento manda el MISMO body de siempre — ${sin}`);
  const con = JSON.stringify({ text: "x", attempt: 1, motivoReintento: "cifra-no-autorizada" });
  ok(/motivoReintento/.test(con) && con.length > sin.length, `y uno que reintenta suma el campo, sin sacar ninguno — ${con}`);

  // UNA SOLA VERDAD PARA EL COSTO: el gateway ya lo publica calculado sobre el modelo que RESPONDIÓ. El cliente
  // lo tarifaba de nuevo por su cuenta, sobre el que se PIDIÓ — dos cálculos que hoy coinciden y mañana no.
  for (const [etiqueta, nombre] of [["PLAN", "_fetchPlan"], ["NARRAR-C", "_fetchNarrateC"]]) {
    const f = fn(nombre);
    ok(/costUSD:\s*data\.costUSD\s*!==\s*undefined\s*\?\s*data\.costUSD\s*:/.test(f),
      `${etiqueta} · el costo observable sale del gateway, no de un segundo cálculo del cliente`);
    ok(/:\s*estimateCostUSD\(data\.modelUsed, data\.usage\)/.test(f),
      `${etiqueta} · …con el cálculo local de RESPALDO, para toda respuesta que no traiga el campo (nada que hoy funciona deja de funcionar)`);
  }
  // el respaldo tiene que dispararse por AUSENCIA, no por valor: un costo nulo legítimo (modelo sin tarifa
  // conocida) NO puede caer al recálculo y convertirse en otra cosa. `!== undefined` es lo que separa las dos.
  const elegir = (data) => (data.costUSD !== undefined ? data.costUSD : "RECALCULA");
  ok(elegir({ costUSD: 0.0021 }) === 0.0021, "un costo publicado se usa tal cual");
  ok(elegir({ costUSD: null }) === null, "un costo DESCONOCIDO publicado se respeta: null no es «recalculame», es «no se puede tarifar»");
  ok(elegir({}) === "RECALCULA", "y sólo la AUSENCIA del campo cae al cálculo local de respaldo");
}

console.log(`\n── CAUSA Y EMISIÓN EN EL GATEWAY · ${PASS} PASS · ${FAIL} FAIL ──`);
process.exit(FAIL ? 1 : 0);
