/* === _consumo_sin_conteo_gate.mjs · LA LLAMADA QUE PUDO FACTURARSE Y NO SE PUEDE CONTAR ================
 * @inspeccion-estatica — este gate LEE código fuente como texto además de ejercer la telemetría real. No
 * importa el gateway, no invoca a ningún handler y no sale a la red; el candado de runtime se le aplica igual.
 *
 * EL AGUJERO QUE CIERRA. `modelPricing` ya AVISA por consola cuando una llamada vuelve sin `usage`: "el
 * proveedor pudo haberla generado y facturado igual". Ese aviso no queda en ninguna parte — sale UNA vez por
 * familia, muere con el proceso, y no cubre a los dos handlers viejos, que ni siquiera tarifan. En el registro,
 * esa llamada se veía IDÉNTICA a una normal: `resultado:"ok"` y los tokens en null, que es lo mismo que registra
 * un turno frenado antes de salir. O sea: la pregunta "¿cuántas llamadas pudieron cobrarnos sin que podamos
 * contarlas?" no se podía responder, y el repo no lleva contador de consumo (CLAUDE.md §3).
 *
 *   [1] EL ESTADO EXISTE Y ES CERRADO · un campo declarado, dos valores, y nada más sobrevive.
 *   [2] EL EMISOR NO PUEDE MENTIR · declara que la llamada SALIÓ; cuál valor le toca lo deciden los tokens.
 *   [3] EL TURNO QUE NO SALIÓ NO SE MARCA · null es un estado, no un descuido: no se grita lobo.
 *   [4] EL CASO QUE LO MOTIVA · sale, vuelve sin conteo → queda marcado. Y el peor: la que revienta después de salir.
 *   [5] EL CABLEADO LLEGA · los cuatro handlers cruzan la línea ANTES del await, y el emisor la lleva al evento.
 *   [6] NADA DE LO QUE YA SE MEDÍA SE MOVIÓ · y el campo nuevo no puede traer un dato del cliente.
 * Cero red, cero LLM. `npm run gates:offline`
 */
import { readFileSync } from "fs";
import { CAMPOS_TELEMETRIA, CONSUMO, _limpio, desdeRespuesta, emit, setSink } from "./src/adi/llm/telemetry.js";

let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };
const H = (t) => console.log("\n" + t);
const leer = (p) => readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const SRC = leer("./src/adi/llm/gatewayCore.js");
const cuerpo = (nombre) => {
  const i = SRC.indexOf(`export async function ${nombre}(`);
  if (i < 0) return "";
  const j = SRC.indexOf("\n}\n", i);
  return SRC.slice(i, j < 0 ? SRC.length : j + 2);
};
// el evento tal como lo arma el gateway, con la respuesta que quiera probarse.
const evento = (respuesta, salioAlProveedor) => desdeRespuesta({
  traceId: "t1", proveedor: "openai", modelo: "gpt-4o-mini", etapa: "plan", intento: 0,
  latencia_ms: 900, respuesta, ruta_deterministica: false, salioAlProveedor,
});

H("[1] EL ESTADO EXISTE Y ES CERRADO · un campo declarado, dos valores, y nada más sobrevive");
{
  ok(CAMPOS_TELEMETRIA.includes("consumo"), `\`consumo\` está en la lista blanca — ${CAMPOS_TELEMETRIA.length} campos`);
  ok(JSON.stringify(CONSUMO) === JSON.stringify(["contado", "sin_conteo"]), `los dos valores declarados — ${CONSUMO.join(" · ")}`);
  // vocabulario CERRADO, igual que etapa/resultado/reasonCode: lo que no está declarado no se guarda, se anula.
  const veneno = [
    ["facturada", "un valor parecido pero no declarado"],
    ["Falabella", "un nombre de entidad"],
    ["$13,9M", "una cifra"],
    ["sin_conteo ", "el valor bueno con un espacio pegado"],
    [true, "un booleano"],
    [1, "un número"],
    [{ estado: "sin_conteo" }, "un objeto"],
  ];
  for (const [v, porQue] of veneno) {
    const ev = _limpio({ etapa: "plan", consumo: v, tokens_in: 10, tokens_out: 2 });
    ok(ev.consumo === null && !/Falabella|13,9/.test(JSON.stringify(ev)), `se anula entero: ${porQue}`, JSON.stringify(ev.consumo));
  }
  ok("consumo" in _limpio({ etapa: "plan" }), "el campo SIEMPRE está en el evento: su ausencia sería otra forma de silencio");
}

H("[2] EL EMISOR NO PUEDE MENTIR · declara que la llamada SALIÓ; cuál valor le toca lo deciden los tokens");
{
  // Mismo criterio que `tokens_in_fresh`: lo que se puede derivar no se acepta de afuera. Si el caller declarara
  // el valor final, un "contado" sin tokens haría desaparecer justo el caso que este campo existe para contar.
  ok(_limpio({ consumo: "contado", tokens_in: null, tokens_out: null }).consumo === "sin_conteo",
    "«contado» sin un solo token se corrige a «sin_conteo»: la que miente es la etiqueta, no el conteo");
  ok(_limpio({ consumo: "sin_conteo", tokens_in: 1200, tokens_out: 80 }).consumo === "contado",
    "…y al revés: con tokens la llamada está contada, diga lo que diga el emisor");
  ok(_limpio({ consumo: "contado", tokens_in: 0, tokens_out: 0 }).consumo === "contado",
    "cero tokens INFORMADOS es un conteo (raro, pero informado): distinto de no tener conteo");
  ok(_limpio({ consumo: "contado", tokens_in: null, tokens_out: 40 }).consumo === "contado",
    "con una sola de las dos mitades alcanza para estar contada");
}

H("[3] EL TURNO QUE NO SALIÓ NO SE MARCA · null es un estado, no un descuido");
{
  ok(evento({ ok: true, usage: { input_tokens: 900, output_tokens: 120 } }, false).consumo === null,
    "sin cruzar la línea, el campo queda en null aunque la respuesta traiga tokens");
  ok(evento({ ok: false, error: "acceso requerido" }, false).consumo === null, "un freno de acceso no pudo facturar nada");
  ok(evento({ ok: false, error: "rate_limited" }, false).consumo === null, "un rate limit propio tampoco: el turno no salió de la máquina");
  ok(evento({ ok: false, error: "falta LLM_PROVIDER en el entorno del servidor" }, false).consumo === null,
    "ni un freno por configuración: no se grita lobo por un turno que nunca pudo salir");
  // LA RUTA DETERMINÍSTICA emite directo, sin declarar nada — y tiene que quedar en null sin que nadie se acuerde.
  const DET = leer("./src/adi/oracle/answerViaOracle.js");
  const iEmit = DET.indexOf('etapa: "deterministica"');
  const bloque = iEmit > 0 ? DET.slice(DET.lastIndexOf("emitTelemetria({", iEmit), iEmit + 400) : "";
  ok(bloque.length > 50 && !/salioAlProveedor|consumo/.test(bloque),
    "el emisor determinístico no declara nada: el batch es gratis y su evento sale en null solo");
  const capturados = [];
  setSink((ev) => capturados.push(ev));
  emit({ traceId: "t0", etapa: "deterministica", intento: 0, ruta_deterministica: true, resultado: "ok", tools: [] });
  setSink(null);
  ok(capturados.length === 1 && capturados[0].consumo === null,
    `y medido de verdad, un evento determinístico sale con el campo en null — ${JSON.stringify(capturados[0] && capturados[0].consumo)}`);
}

H("[4] EL CASO QUE LO MOTIVA · salió, volvió sin conteo, y eso QUEDA");
{
  const contada = evento({ ok: true, usage: { input_tokens: 7600, output_tokens: 190 } }, true);
  ok(contada.consumo === "contado" && contada.tokens_in === 7600, "una llamada normal queda «contado», con sus tokens");

  // EL CASO EXACTO DEL AVISO DE modelPricing: el proveedor respondió y no informó conteo.
  const sinUsage = evento({ ok: true }, true);
  ok(sinUsage.consumo === "sin_conteo" && sinUsage.resultado === "ok",
    "respuesta OK SIN usage → «sin_conteo», y el resultado sigue siendo ok: no se disfraza de error");
  ok(sinUsage.tokens_in === null && sinUsage.tokens_out === null,
    "los tokens siguen en null: no se inventa un cero para tapar el hueco (un costo desconocido no es cero)");
  ok(evento({ ok: true, usage: {} }, true).consumo === "sin_conteo", "un `usage` vacío es lo mismo que no tenerlo");

  // Y EL PEOR: la que revienta DESPUÉS de salir — el proveedor ya generó, el cliente nunca recibió el conteo.
  // Son los 6 timeouts de la corrida medida, que se contabilizaron como si no hubieran costado nada.
  const reventada = evento({ ok: false, error: "el proveedor no respondió" }, true);
  ok(reventada.consumo === "sin_conteo", "la llamada que revienta después de salir también queda marcada");
  ok(reventada.resultado === "error" && reventada.reasonCode === "provider_error",
    `…sin perder por qué falló — ${reventada.resultado}/${reventada.reasonCode}`);

  // LA PREGUNTA QUE ANTES NO SE PODÍA HACER, hecha sobre un registro completo.
  const registro = [
    evento({ ok: true, usage: { input_tokens: 100, output_tokens: 10 } }, true),
    evento({ ok: true }, true),
    evento({ ok: false, error: "el proveedor no respondió" }, true),
    evento({ ok: false, error: "rate_limited" }, false),
    evento({ ok: true, usage: { prompt_tokens: 50, completion_tokens: 5 } }, true),
  ];
  const invisibles = registro.filter((e) => e.consumo === "sin_conteo").length;
  const contadas = registro.filter((e) => e.consumo === "contado").length;
  const noSalieron = registro.filter((e) => e.consumo === null).length;
  ok(invisibles === 2 && contadas === 2 && noSalieron === 1,
    `sobre 5 eventos: 2 contadas · 2 que pudieron facturarse sin conteo · 1 que no salió — ${invisibles}/${contadas}/${noSalieron}`);
}

H("[5] EL CABLEADO LLEGA · los cuatro handlers cruzan la línea ANTES del await, y el emisor la lleva al evento");
{
  // La lista se DERIVA del fuente: un handler nuevo que llame al proveedor sin esto rompe el gate solo.
  const EXPORTADOS = [...SRC.matchAll(/export async function (\w+)\(/g)].map((m) => m[1]);
  const GASTAN = EXPORTADOS.filter((n) => /getAdapter\(/.test(cuerpo(n)));
  ok(GASTAN.length >= 4, `los ${GASTAN.length} handlers que llaman al proveedor — ${JSON.stringify(GASTAN)}`);
  for (const n of GASTAN) {
    const body = cuerpo(n);
    ok(/let\s+_salioAlProveedor\s*=\s*false/.test(body), `${n} · arranca declarando que la llamada NO salió (falla cerrada)`);
    const iCruce = body.indexOf("_salioAlProveedor = true;");
    const iAdapter = body.indexOf("getAdapter(provider)");
    ok(iCruce > 0, `${n} · marca el cruce en algún punto`);
    // EL ORDEN ES EL FIX: prendido DESPUÉS del await, la llamada que revienta por timeout —la que el proveedor
    // ya generó y facturó— se registraría como un turno que nunca salió. Justo el caso que hay que contar.
    ok(iAdapter > 0 && iCruce < iAdapter, `${n} · …y lo marca ANTES de la llamada, no después`, `cruce@${iCruce} adapter@${iAdapter}`);
    ok((body.match(/_salioAlProveedor = true;/g) || []).length === 1, `${n} · una sola vez: es el cruce, no un flag que se toquetea`);
    ok(/salioAlProveedor:\s*_salioAlProveedor/.test(body), `${n} · el emisor lo lleva al evento (si no, el campo sería cañería muerta)`);
    // NINGÚN FRENO PUEDE PRENDERLO: todo lo que está antes del cruce sale declarando que no salió.
    const antesDelCruce = body.slice(0, iCruce);
    ok(!/_salioAlProveedor\s*=\s*true/.test(antesDelCruce), `${n} · ningún freno propio del gateway lo prende antes de tiempo`);
    ok((antesDelCruce.match(/return\s+_frenado\s*\(/g) || []).length >= 2,
      `${n} · y sus frenos propios quedan del lado de «no salió», donde corresponde`);
  }
  ok(/consumo:\s*salioAlProveedor\s*\?/.test(leer("./src/adi/llm/telemetry.js")),
    "y del otro lado del cable, la telemetría traduce el cruce al campo declarado");
}

H("[6] NADA DE LO QUE YA SE MEDÍA SE MOVIÓ");
{
  const ev = desdeRespuesta({
    traceId: "t2", proveedor: "openai", modelo: "gpt-4o-mini-2024-07-18", etapa: "narrar", intento: 1,
    latencia_ms: 1500, ruta_deterministica: false, salioAlProveedor: true, tools: ["queryMetric"],
    respuesta: { ok: true, usage: { input_tokens: 8000, cachedTokens: 7600, output_tokens: 210 } },
  });
  ok(ev.tokens_in === 8000 && ev.tokens_in_cache === 7600 && ev.tokens_in_fresh === 400,
    `el caché y la resta siguen igual — ${ev.tokens_in}/${ev.tokens_in_cache}/${ev.tokens_in_fresh}`);
  ok(ev.modelo === "gpt-4o-mini-2024-07-18" && ev.etapa === "narrar" && ev.intento === 1 && ev.resultado === "ok",
    "modelo efectivo, etapa, intento y resultado intactos");
  ok(Object.keys(ev).every((k) => CAMPOS_TELEMETRIA.includes(k)), `el evento no trae una sola clave fuera de la lista — ${Object.keys(ev).join(",")}`);
  // el campo nuevo no abre un canal: no es texto libre y ningún dato del cliente puede viajar por él.
  const sucio = _limpio({ consumo: "sin_conteo · Falabella pidió $13,9M", tokens_in: null, tokens_out: null });
  ok(sucio.consumo === null && !/Falabella|13,9/.test(JSON.stringify(sucio)),
    `ni pegándole texto al valor bueno se filtra algo — ${JSON.stringify(sucio.consumo)}`);
}

console.log(`\n── CONSUMO SIN CONTEO · ${PASS} PASS · ${FAIL} FAIL ──`);
process.exit(FAIL ? 1 : 0);
