/* === _proveedor_declarado_gate.mjs · EL PROVEEDOR SE DECLARA, NO SE ADIVINA (owner 2026-08-13) ==========
 * @inspeccion-estatica — este gate LEE código fuente como texto además de ejercer módulos puros. No importa el
 * gateway, no invoca a ningún handler y no sale a la red; el candado de runtime se le aplica igual que a todos.
 *
 * EL DEFECTO QUE CUIDA, medido en vivo antes de este pase. El gateway resolvía el proveedor con
 * `e.LLM_PROVIDER || "anthropic"`. Sin la variable, NO fallaba: se iba callado al otro proveedor con la clave
 * equivocada, devolvía su 401, el cliente degradaba al piso y el usuario leía "gateway no disponible". La causa
 * real —una variable que falta, lo único que el operador puede arreglar solo— quedaba invisible en las tres capas.
 *
 * POR QUÉ ESTE GATE PUEDE EXISTIR. Todo gate que importe `gatewayCore.js` queda clasificado LIVE y NO corre en
 * `npm run gates:offline`: la decisión más peligrosa del gateway era la única que ningún gate offline podía
 * ejercer. Por eso la decisión vive ahora en `providerConfig.js` —módulo puro, sin imports, sin red— y acá se
 * EJERCE de verdad (§1, §2, §5), no se lee. Lo que sí se lee como texto es el CABLEADO (§3, §4, §6): que el
 * freno esté en los cuatro handlers que pueden gastar, dentro del try y antes del proveedor.
 *
 *   [1] LA DECISIÓN, EJERCIDA · ausente/vacía/basura no eligen proveedor. Nunca inventa uno.
 *   [2] EL ERROR NOMBRA LA VARIABLE · es todo el punto: "gateway no disponible" obliga a adivinar.
 *   [3] NO QUEDA UN SOLO DEFAULT DE PROVEEDOR · ni en el gateway, ni en los dos arranques que lo anunciaban.
 *   [4] EL FRENO LLEGA · en LOS CUATRO handlers que gastan, dentro del try, por el freno emisor, antes del proveedor.
 *   [5] LA CAUSA ES MEDIBLE Y PROPIA · `config_missing` ≠ `provider_error`, y el texto no sobrevive al borde.
 *   [6] NO PISA LA PUERTA DE ACCESO · un caller sin autorización no se entera de cómo está configurado el server.
 * Cero red, cero LLM. `npm run gates:offline`
 */
import { readFileSync } from "fs";
import { resolverProveedor, mensajeFaltaProveedor, VARIABLE_PROVEEDOR } from "./src/adi/llm/providerConfig.js";
import { REASON_CODES, aReasonCode, _limpio, desdeRespuesta } from "./src/adi/llm/telemetry.js";

let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };
const H = (t) => console.log("\n" + t);

// Fin de línea normalizado: el repo está en CRLF y un `\n}\n` literal no matchea nunca sobre `\r\n}\r\n` — un
// aislador que se pasa de largo mide el handler siguiente, o sea que no mide nada.
const leer = (p) => readFileSync(p, "utf8").replace(/\r\n/g, "\n");
// SE ESCANEA EL CÓDIGO, NO LOS COMENTARIOS (misma lección que en el gate del endpoint de versión, y este gate
// la volvió a pagar al escribirse): los archivos arreglados NOMBRAN el defecto para explicar por qué se fue —
// `LLM_PROVIDER || "anthropic"` está citado textual en tres cabeceras—, y un barrido ingenuo lee la explicación
// como si fuera el defecto. Se sacan los bloques /* */ y las líneas que son sólo comentario.
const codigo = (txt) => txt.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const SRC = leer("./src/adi/llm/gatewayCore.js");
const PC = codigo(leer("./src/adi/llm/providerConfig.js"));
const cuerpo = (nombre) => {
  const i = SRC.indexOf(`export async function ${nombre}(`);
  if (i < 0) return "";
  const j = SRC.indexOf("\n}\n", i);
  return SRC.slice(i, j < 0 ? SRC.length : j + 2);
};

H("[1] LA DECISIÓN, EJERCIDA · lo que falta no elige nada, y nunca se inventa un proveedor");
{
  ok(VARIABLE_PROVEEDOR === "LLM_PROVIDER", `la variable se llama ${VARIABLE_PROVEEDOR} y vive en un solo lugar`);

  const declarado = resolverProveedor({ LLM_PROVIDER: "openai" });
  ok(declarado.proveedor === "openai" && declarado.falta === null,
    "declarada → se usa tal cual (el entorno que HOY funciona sigue funcionando igual)");
  ok(resolverProveedor({ LLM_PROVIDER: "  openai  " }).proveedor === "openai",
    "se recortan los espacios: un valor pegado desde un panel no se convierte en otro proveedor");
  ok(resolverProveedor({ LLM_PROVIDER: "un-proveedor-que-no-existe" }).falta === null,
    "este módulo NO valida la lista de proveedores: esa verdad vive en el registro de adapters, no duplicada acá");

  // LO QUE NO PUEDE PASAR NUNCA MÁS: que la ausencia devuelva un proveedor.
  const casos = [
    [undefined, "el env entero ausente"],
    [null, "el env en null"],
    [{}, "la variable no está"],
    [{ LLM_PROVIDER: "" }, "seteada en vacío"],
    [{ LLM_PROVIDER: "   " }, "seteada con espacios (campo creado y sin valor en el panel)"],
    [{ LLM_PROVIDER: null }, "seteada en null"],
    [{ LLM_PROVIDER: 7 }, "seteada con algo que no es texto"],
    [{ LLM_PROVIDER: { name: "openai" } }, "seteada con un objeto"],
    ["LLM_PROVIDER=openai", "un string en vez de un env"],
  ];
  for (const [env, porQue] of casos) {
    let r = null, revento = false;
    try { r = resolverProveedor(env); } catch { revento = true; }
    ok(!revento && r && r.proveedor === null && r.falta === "LLM_PROVIDER",
      `${porQue} → falta declarada, proveedor null (y no lanza)`, JSON.stringify(r));
  }
  const inventados = casos.map(([env]) => { try { return resolverProveedor(env).proveedor; } catch { return "REVENTÓ"; } });
  ok(inventados.every((p) => p === null), `ninguno de los ${casos.length} casos devolvió un proveedor — ${JSON.stringify([...new Set(inventados)])}`);
  ok(!/anthropic|openai|gemini/i.test(PC), "y el módulo no nombra un solo proveedor: no tiene con qué inventarlo");
}

H("[2] EL ERROR NOMBRA LA VARIABLE · «gateway no disponible» obliga a adivinar; esto dice qué setear");
{
  const msg = mensajeFaltaProveedor();
  ok(msg.includes("LLM_PROVIDER"), `el mensaje NOMBRA la variable que falta — "${msg}"`);
  ok(mensajeFaltaProveedor("LLM_PROVIDER").includes("LLM_PROVIDER"), "…y también cuando se le pasa el nombre explícito");
  ok(/servidor|server-side/.test(msg), "dice DÓNDE va la variable (server-side): el error es accionable, no un diagnóstico");
  ok(!/\d/.test(msg.replace(/\.env/g, "")), "no lleva cifras: no es un canal por el que pueda colarse un dato");
}

H("[3] NO QUEDA UN SOLO DEFAULT DE PROVEEDOR · ni en el gateway ni en los dos arranques que lo anunciaban");
{
  // EL ANCLA ANTI-REGRESIÓN: `LLM_PROVIDER || "algo"` es la forma exacta del defecto. Que no vuelva, en ningún
  // archivo — incluidos los dos logs de arranque, que imprimían `provider=anthropic` cuando no había ninguno y
  // confirmaban por escrito una configuración inexistente.
  const DEV = codigo(leer("./src/adi/llm/devGateway.js"));
  const SERVER = codigo(leer("./server.js"));
  for (const [archivo, txt] of [["gatewayCore.js", codigo(SRC)], ["devGateway.js", DEV], ["server.js", SERVER]]) {
    ok(!/LLM_PROVIDER\s*\|\|/.test(txt), `${archivo} · no elige un proveedor por su cuenta cuando la variable falta`);
    ok(/resolverProveedor\(/.test(txt), `${archivo} · lee el proveedor por el único resolvedor que hay (una sola verdad)`);
  }
  ok(!/process\.env\.LLM_PROVIDER/.test(DEV) && !/process\.env\.LLM_PROVIDER/.test(SERVER),
    "ninguno de los dos arranques vuelve a leer la variable a mano por atrás");
  ok(/SIN DECLARAR/.test(DEV) && /SIN DECLARAR/.test(SERVER),
    "y los dos DICEN que no hay proveedor declarado, en vez de anunciar uno que nadie configuró");
}

H("[4] EL FRENO LLEGA · en los cuatro handlers que gastan, dentro del try y antes de tocar al proveedor");
{
  // La lista NO se escribe a mano: se deriva del fuente. Un handler nuevo que llame al proveedor sin este freno
  // rompe acá solo, sin que nadie tenga que acordarse de agregarlo — mismo criterio que el gate de emisión.
  const EXPORTADOS = [...SRC.matchAll(/export async function (\w+)\(/g)].map((m) => m[1]);
  const GASTAN = EXPORTADOS.filter((n) => /getAdapter\(/.test(cuerpo(n)));
  ok(GASTAN.length >= 4, `el fuente declara ${GASTAN.length} handlers que llaman al proveedor — ${JSON.stringify(GASTAN)}`);

  for (const n of GASTAN) {
    const body = cuerpo(n);
    ok(/const\s*\{[^}]*\bfalta\b[^}]*\}\s*=\s*_config\(env\)/.test(body),
      `${n} · recibe del config si la variable falta (no la re-lee ni la adivina)`);
    const iFreno = body.indexOf("if (falta) return _frenado(");
    ok(iFreno > 0, `${n} · frena el turno cuando falta el proveedor`);
    // …Y EL FRENO TIENE QUE LLEGAR, no solo existir. Tres condiciones, en el orden en que corre el handler:
    const iTry = body.indexOf("\n  try {");
    const iAdapter = body.indexOf("getAdapter(provider)");
    ok(iTry > 0 && iFreno > iTry, `${n} · el freno vive DENTRO del try: una falla de configuración no puede irse sin evento`);
    ok(iAdapter > 0 && iFreno < iAdapter, `${n} · …y ANTES del proveedor: no se gasta un turno que no puede salir`);
    ok(/const\s+_frenado\s*=[^\n]*_emitir\s*\(/.test(body),
      `${n} · sale por el freno EMISOR, que es el que deja el evento de telemetría`);
    // el evento no inventa un proveedor tampoco: reporta el que resolvió el config, que en este caso es null.
    ok(/proveedor:\s*provider\b/.test(body), `${n} · el evento reporta el proveedor resuelto, sin rellenar el hueco`);
    ok(/mensajeFaltaProveedor\(falta\)/.test(body), `${n} · y el error que devuelve es el que NOMBRA la variable`);
  }
  ok(/import\s*\{[^}]*resolverProveedor[^}]*\}\s*from\s*"\.\/providerConfig\.js"/.test(SRC),
    "el gateway toma la decisión del módulo puro: es la misma que este gate acaba de ejercer de verdad");
}

H("[5] LA CAUSA ES MEDIBLE Y PROPIA · «nadie declaró proveedor» ≠ «el proveedor falló»");
{
  ok(REASON_CODES.includes("config_missing"), `el código está en la lista cerrada — ${REASON_CODES.join(" · ")}`);
  // LA COMPOSICIÓN REAL de los dos módulos: el mensaje que devuelve el gateway, traducido por el traductor real.
  ok(aReasonCode(mensajeFaltaProveedor()) === "config_missing",
    "el mensaje de configuración se clasifica como configuración, no como caída del proveedor");
  ok(aReasonCode('LLM_PROVIDER desconocido: "gpt" · disponibles: anthropic, openai') === "config_missing",
    "y un proveedor MAL escrito también: las dos son cosas que arregla el operador, no el proveedor");
  ok(aReasonCode("el proveedor no respondió") === "provider_error",
    "un fallo real del proveedor sigue siendo provider_error: la separación no se logró borrando la otra");
  ok(aReasonCode("rate limit") === "rate_limited" && aReasonCode("fetch failed") === "network_error",
    "los códigos que ya existían no se movieron de lugar");
  // EL MENSAJE NO SOBREVIVE AL BORDE: lo que queda registrado es el código, nunca el texto (ni siquiera el nuestro).
  const ev = _limpio({ etapa: "plan", reasonCode: mensajeFaltaProveedor() });
  ok(ev.reasonCode === "config_missing" && !/servidor|env\.example/.test(JSON.stringify(ev)),
    `en el evento queda el código y nada del texto — ${JSON.stringify(ev.reasonCode)}`);
  // …y el evento que ARMA el gateway con la respuesta del freno queda tipado como error, con la causa correcta.
  const evGw = desdeRespuesta({
    traceId: "t0", proveedor: null, modelo: "gpt-4o-mini", etapa: "plan", intento: 0, latencia_ms: 3,
    respuesta: { ok: false, error: mensajeFaltaProveedor(), configFaltante: "LLM_PROVIDER" }, ruta_deterministica: false,
  });
  ok(evGw.resultado === "error" && evGw.reasonCode === "config_missing",
    `el turno frenado se registra como error con causa propia — ${evGw.resultado}/${evGw.reasonCode}`);
  ok(evGw.proveedor === null, "y el proveedor queda en null: el instrumento tampoco rellena el hueco");
  ok(evGw.tokens_in === null && evGw.tokens_out === null,
    "sin tokens: un turno frenado antes del proveedor no se cuenta como consumo (ni como cero fingido)");
  ok(!("configFaltante" in evGw), "el campo extra de la respuesta NO entra al evento: la lista blanca sigue mandando");
}

H("[6] NO PISA LA PUERTA DE ACCESO · el estado del servidor no se le cuenta a un caller sin autorización");
{
  const EXPORTADOS = [...SRC.matchAll(/export async function (\w+)\(/g)].map((m) => m[1]);
  for (const n of EXPORTADOS.filter((x) => /getAdapter\(/.test(cuerpo(x)))) {
    const body = cuerpo(n);
    ok(body.indexOf("_access(access, env)") < body.indexOf("if (falta) return _frenado("),
      `${n} · primero la puerta, después el diagnóstico de configuración`);
  }
  // Y el freno de configuración no se comió ninguno de los que ya existían.
  for (const [n, esperados] of [["handleSpec", 2], ["handleNarrate", 2], ["handlePlan", 3], ["handleNarrateC", 3]]) {
    const nFrenos = (cuerpo(n).match(/return\s+_frenado\s*\(/g) || []).length;
    ok(nFrenos >= esperados + 1, `${n} · conserva sus ${esperados} frenos y suma el de configuración — ${nFrenos}`);
  }
}

console.log(`\n── EL PROVEEDOR SE DECLARA, NO SE ADIVINA · ${PASS} PASS · ${FAIL} FAIL ──`);
process.exit(FAIL ? 1 : 0);
