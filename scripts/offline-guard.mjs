/* === scripts/offline-guard.mjs · CANDADO DE RED + CANDADO DE CREDENCIAL (owner 2026-08-07 / 2026-08-09) ====
 * Se PRECARGA con `node --import ./scripts/offline-guard.mjs <gate>` antes de que el gate importe nada.
 * Cualquier intento de salir a la red desde ese proceso MATA el proceso ahí mismo, con el stack del culpable.
 *
 * POR QUÉ EXISTE (el incidente que lo motiva): se corrió `npm run gates` bajo una instrucción explícita de no
 * gastar créditos, creyendo que sin `OPENAI_API_KEY` en el env del shell los gates live fallaban gratis. Es
 * FALSO: los gates pegan contra el gateway DESPLEGADO, que tiene la key server-side. La corrida consumió los
 * créditos de la cuenta real. La lección: "no hay key local" no es una garantía de nada. La garantía tiene que
 * ser el proceso mismo, y por eso este archivo mata en vez de avisar.
 *
 * SEGUNDA VEZ (2026-08-09) — y por eso este archivo ahora tiene DOS candados, no uno. Un subagente corrió
 * `node _orden_sellado_gate.mjs` suelto (fuera del runner, sin este candado) creyéndolo offline: no lo es, y gastó.
 * El shell NO tenía credencial —se verificó en la propia corrida: `OPENAI:false ANTHROPIC:false`— y aun así gastó,
 * porque 41 de los 140 gates de la raíz SE AUTOCARGAN el `.env` del disco en su primera línea:
 *     for (const ln of fs.readFileSync(".env","utf8").split(/\r?\n/)) { ... process.env[m[1]] = m[2] ... }
 * Es decir: limpiar el entorno del proceso hijo NO alcanza, porque el gate se re-hidrata solo desde el disco.
 * Orden del owner: «No vuelvas a confiar solamente en una instrucción para evitar consumo. Impidelo técnicamente.»
 *
 * ── CANDADO 1 · LA CREDENCIAL NO EXISTE EN ESTE PROCESO ────────────────────────────────────────────────
 *   a) se BORRA del entorno heredado toda credencial de proveedor (ver scripts/provider-keys.mjs);
 *   b) `process.env` queda detrás de un Proxy que RECHAZA cualquier escritura posterior de una credencial —
 *      esto es lo que desarma la re-hidratación desde `.env`: el gate escribe, y no queda nada escrito;
 *   c) toda lectura de un archivo `.env*` se sirve SIN sus líneas de credencial — para el gate que no pasa por
 *      `process.env` y se guarda el valor en una variable local.
 *   Un proceso sin credencial no puede gastar aunque su código lo intente.
 *
 * ── CANDADO 2 · LA RED ESTÁ CERRADA ────────────────────────────────────────────────────────────────────
 *   · globalThis.fetch          (lo que usan gatewayCore/los adapters y los propios gates)
 *   · node:http / node:https    request/get (por si algún gate usa el cliente crudo)
 *   · node:net  Socket.connect  (EL PISO: cualquier TCP, incluido lo que abra una librería o el `fetch` interno)
 *   · node:dns  lookup/resolve  (falla ANTES de abrir el socket, con mejor mensaje)
 * El PISO (net/dns/http) se sella NO-ESCRIBIBLE y NO-CONFIGURABLE: un gate no puede restaurarlo ni por asignación
 * ni por defineProperty (en ESM, que es strict, el intento tira TypeError y se ve). `globalThis.fetch` se deja
 * REEMPLAZABLE a propósito: mockear `fetch` es una técnica offline legítima y varios gates la usan — un mock no
 * llega a la red, y el que sí llega cae igual en el piso. Lo mismo vale para `import { request } from "node:http"`
 * (el binding con nombre del facade ESM se toma antes del parche): también termina en el socket.
 *
 * localhost NO se exceptúa a propósito: varios gates montan jsdom y podrían pegarle a un server local que a su
 * vez proxea al gateway. En modo offline, ninguna red es red permitida.
 */
import { esCredencial, credencialesVisibles, filtrarTextoDotenv } from "./provider-keys.mjs";

const RED = "\x1b[31m", OFF = "\x1b[0m";

function matar(que, detalle) {
  const err = new Error(`[gates:offline] RED BLOQUEADA · ${que}${detalle ? " → " + detalle : ""}`);
  console.error(`\n${RED}════════════════════════════════════════════════════════════════════${OFF}`);
  console.error(`${RED}[gates:offline] ACCESO A RED BLOQUEADO${OFF}`);
  console.error(`  intento : ${que}`);
  if (detalle) console.error(`  destino : ${detalle}`);
  console.error(`  Este gate NO es offline: hace llamadas reales (y por lo tanto pagadas).`);
  console.error(`  Sacalo de la lista OFFLINE en scripts/gates-offline.mjs o hacelo determinístico.`);
  console.error(`${RED}════════════════════════════════════════════════════════════════════${OFF}`);
  console.error(err.stack);
  process.exit(97);   // código propio: distingue "tocó la red" de un FAIL normal del gate
}

/* ══ CANDADO 1 · LA CREDENCIAL NO EXISTE ═══════════════════════════════════════════════════════════════ */

// 1a · borrar lo heredado. El runner ya spawnea con el entorno limpio, pero este archivo tiene que sostenerse
// SOLO: su caso de uso más importante es justamente el `node --import ./scripts/offline-guard.mjs <gate>` suelto,
// que es como se corre un gate a mano — y como se gastó la segunda vez.
const _envReal = process.env;
for (const k of Object.keys(_envReal)) if (esCredencial(k, _envReal[k])) delete _envReal[k];

// 1b · rechazar toda escritura posterior. Sin esto, el auto-cargador de `.env` que traen 41 gates vuelve a poner
// la credencial en pie en la primera línea del gate, y el candado de entorno no sirve para nada.
const _envProxy = new Proxy(_envReal, {
  get: (t, k) => (typeof k === "string" && esCredencial(k, t[k]) ? undefined : t[k]),
  set: (t, k, v) => { if (typeof k === "string" && esCredencial(k, v)) return true; t[k] = v; return true; },
  has: (t, k) => (typeof k === "string" && esCredencial(k, t[k]) ? false : k in t),
  deleteProperty: (t, k) => { delete t[k]; return true; },
  ownKeys: (t) => Reflect.ownKeys(t).filter((k) => !(typeof k === "string" && esCredencial(k, t[k]))),
  getOwnPropertyDescriptor: (t, k) =>
    (typeof k === "string" && esCredencial(k, t[k]) ? undefined : Reflect.getOwnPropertyDescriptor(t, k)),
});
// `process.env = x` no sirve (Node copia y descarta el Proxy); hay que redefinir la propiedad del objeto `process`.
Object.defineProperty(process, "env", { value: _envProxy, writable: true, configurable: true, enumerable: true });

// 1c · servir todo `.env*` sin sus líneas de credencial. Tapa al gate que lee el archivo y se guarda el valor en
// una variable local, sin pasar nunca por `process.env` (donde 1b no lo vería).
const { default: fs } = await import("node:fs");
const _esDotenv = (p) => /(^|[\\/])\.env(\.[^\\/]*)?$/.test(String(p));
const _filtrar = (contenido) =>
  (Buffer.isBuffer(contenido)
    ? Buffer.from(filtrarTextoDotenv(contenido.toString("utf8")), "utf8")
    : filtrarTextoDotenv(contenido));

// UN `.env` AUSENTE ES UN `.env` VACÍO, NO UN CRASH (owner 2026-08-11). 41 gates hacen
// `readFileSync(".env")` sin comprobar que exista, así que en un clon nuevo, en CI, o en un worktree —donde el
// archivo está gitignoreado y por lo tanto NO está— los 41 morían con ENOENT antes de correr una sola aserción.
// Medido en este mismo worktree: la suite reportaba «88 PASS · 6 FAIL» y los 6 no eran defectos del producto,
// eran seis gates que no habían llegado a arrancar. Un rojo que no distingue «el producto falla» de «falta un
// archivo de configuración» hace perder el tiempo en el mejor caso y esconde un defecto real en el peor.
// SE RESUELVE ACÁ Y NO EN LOS 41 porque acá ya vive la política de `.env` (servirlo sin credenciales): que su
// ausencia se sirva como vacío es la MISMA política, no una segunda. Y sólo aplica a `.env`: cualquier otro
// archivo que falte sigue lanzando ENOENT como siempre — no se tapa un error de verdad.
const _ENV_VACIO = "# (.env ausente · servido vacío por el candado offline)\n";
const _sinDotenv = (e) => e && e.code === "ENOENT";
const _readFileSync = fs.readFileSync;
fs.readFileSync = function (ruta, ...resto) {
  let out;
  try { out = _readFileSync.call(this, ruta, ...resto); }
  catch (e) {
    if (!_esDotenv(ruta) || !_sinDotenv(e)) throw e;
    const pideBuffer = !resto.length || (resto[0] && typeof resto[0] === "object" && !resto[0].encoding);
    return pideBuffer ? Buffer.from(_ENV_VACIO, "utf8") : _ENV_VACIO;
  }
  return _esDotenv(ruta) ? _filtrar(out) : out;
};
// LOS TRES CAMINOS, LA MISMA REGLA. El `.env` ausente se sirve vacío por `readFileSync`, por `readFile` y por
// `fs.promises.readFile` — si sólo se cubriera uno, un consumidor que lee por otro camino seguiría muriendo con
// ENOENT y la garantía sería parcial sin decirlo. (La sonda del cerrojo usa los tres a propósito.)
const _vacioComo = (resto) => {
  const pideBuffer = !resto.length || (resto[0] && typeof resto[0] === "object" && !resto[0].encoding);
  return pideBuffer ? Buffer.from(_ENV_VACIO, "utf8") : _ENV_VACIO;
};
const _readFile = fs.readFile;
fs.readFile = function (ruta, ...resto) {
  if (!_esDotenv(ruta)) return _readFile.call(this, ruta, ...resto);
  const cb = resto.pop();
  return _readFile.call(this, ruta, ...resto, (e, d) =>
    (e ? (_sinDotenv(e) ? cb(null, _vacioComo(resto)) : cb(e, d)) : cb(null, _filtrar(d))));
};
if (fs.promises && fs.promises.readFile) {
  const _readFileP = fs.promises.readFile;
  fs.promises.readFile = async function (ruta, ...resto) {
    let out;
    try { out = await _readFileP.call(this, ruta, ...resto); }
    catch (e) { if (!_esDotenv(ruta) || !_sinDotenv(e)) throw e; return _vacioComo(resto); }
    return _esDotenv(ruta) ? _filtrar(out) : out;
  };
}

/* ══ CANDADO 2 · LA RED ESTÁ CERRADA ═══════════════════════════════════════════════════════════════════ */

// sellar = dejar la función puesta y que NO se pueda ni reasignar ni redefinir (en ESM, strict, el intento tira)
const sellar = (obj, prop, valor) =>
  Object.defineProperty(obj, prop, { value: valor, writable: false, configurable: false, enumerable: true });

// 1 · fetch (el camino real de gatewayCore y de los gates) — REEMPLAZABLE a propósito, ver cabecera
globalThis.fetch = function bloqueado(input) {
  const url = typeof input === "string" ? input : (input && input.url) || String(input);
  matar("fetch()", url);
};

// 2 · http/https crudos
const { default: http } = await import("node:http");
const { default: https } = await import("node:https");
for (const [mod, nombre] of [[http, "http"], [https, "https"]]) {
  for (const fn of ["request", "get"]) {
    sellar(mod, fn, function bloqueado(a) {
      matar(`${nombre}.${fn}()`, typeof a === "string" ? a : (a && (a.hostname || a.host)) || "");
    });
  }
}

// 3 · el piso: cualquier socket TCP
const { default: net } = await import("node:net");
const _connect = net.Socket.prototype.connect;
sellar(net.Socket.prototype, "connect", function bloqueado(...args) {
  // `net.connect({host,port})` no llega acá como objeto: llega como el array normalizado `[options, cb]`. Sin
  // desenvolverlo, el destino salía vacío (":") y se perdía justo el dato forense — a dónde quiso salir.
  const crudo = args[0];
  const o = Array.isArray(crudo) ? crudo[0] : crudo;
  const dest = typeof o === "object" && o ? `${o.host || o.path || ""}:${o.port || ""}` : String(args[1] || o || "");
  // el socket a un path unix/pipe no es red (lo usa child_process en Windows) — solo se corta host:puerto TCP
  if (typeof o === "object" && o && o.path && !o.port) return _connect.apply(this, args);
  matar("net.Socket.connect()", dest);
});

// 4 · DNS: falla antes, con mejor mensaje que un socket colgado
const { default: dns } = await import("node:dns");
for (const fn of ["lookup", "resolve", "resolve4", "resolve6"]) {
  if (typeof dns[fn] === "function") sellar(dns, fn, function bloqueado(h) { matar(`dns.${fn}()`, String(h)); });
  if (dns.promises && typeof dns.promises[fn] === "function")
    sellar(dns.promises, fn, function bloqueado(h) { matar(`dns.promises.${fn}()`, String(h)); });
}

/* ══ VERIFICACIÓN PROPIA · el candado se comprueba a sí mismo antes de dejar correr nada ═══════════════ */
const _fugadas = credencialesVisibles(process.env);
if (_fugadas.length) {
  console.error(`\n${RED}[gates:offline] EL CANDADO DE CREDENCIAL NO CERRÓ${OFF}`);
  console.error(`  siguen visibles: ${_fugadas.join(", ")}`);
  console.error(`  El proceso podría gastar. Se aborta antes de correr el gate.`);
  process.exit(98);   // 98 = fuga de credencial (distinto de 97 = tocó la red)
}

// marca para que un gate pueda saberlo si quiere (informativa — NUNCA para saltearse el candado)
process.env.ADI_OFFLINE_GATES = "1";
