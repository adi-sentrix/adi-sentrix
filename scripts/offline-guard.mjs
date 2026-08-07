/* === scripts/offline-guard.mjs · CANDADO DE RED (owner 2026-08-07) ===================================
 * Se PRECARGA con `node --import ./scripts/offline-guard.mjs <gate>` antes de que el gate importe nada.
 * Cualquier intento de salir a la red desde ese proceso MATA el proceso ahí mismo, con el stack del culpable.
 *
 * POR QUÉ EXISTE (el incidente que lo motiva): se corrió `npm run gates` bajo una instrucción explícita de no
 * gastar créditos, creyendo que sin `OPENAI_API_KEY` en el env del shell los gates live fallaban gratis. Es
 * FALSO: los gates pegan contra el gateway DESPLEGADO, que tiene la key server-side. La corrida consumió los
 * créditos de la cuenta real. La lección: "no hay key local" no es una garantía de nada. La garantía tiene que
 * ser el proceso mismo, y por eso este archivo mata en vez de avisar.
 *
 * QUÉ TAPA — todas las salidas que un gate de este repo puede usar, no solo `fetch`:
 *   · globalThis.fetch          (lo que usan gatewayCore/los adapters y los propios gates)
 *   · node:http / node:https    request/get (por si algún gate usa el cliente crudo)
 *   · node:net  Socket.connect  (el piso: cualquier TCP, incluido lo que abra una librería)
 *   · node:dns  lookup/resolve  (falla ANTES de abrir el socket, con mejor mensaje)
 * Las importaciones de `handlePlan`/`handleNarrateC` no se pueden tapar acá (son funciones locales del gateway),
 * pero NO HACE FALTA: las dos terminan en `fetch` contra el proveedor, así que caen igual. Además el runner las
 * detecta ESTÁTICAMENTE antes de correr nada — ver scripts/gates-offline.mjs.
 *
 * localhost NO se exceptúa a propósito: varios gates montan jsdom y podrían pegarle a un server local que a su
 * vez proxea al gateway. En modo offline, ninguna red es red permitida.
 */
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

// 1 · fetch (el camino real de gatewayCore y de los gates)
globalThis.fetch = function bloqueado(input) {
  const url = typeof input === "string" ? input : (input && input.url) || String(input);
  matar("fetch()", url);
};

// 2 · http/https crudos
const { default: http } = await import("node:http");
const { default: https } = await import("node:https");
for (const [mod, nombre] of [[http, "http"], [https, "https"]]) {
  for (const fn of ["request", "get"]) {
    mod[fn] = function bloqueado(a) {
      matar(`${nombre}.${fn}()`, typeof a === "string" ? a : (a && (a.hostname || a.host)) || "");
    };
  }
}

// 3 · el piso: cualquier socket TCP
const { default: net } = await import("node:net");
const _connect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function bloqueado(...args) {
  const o = args[0];
  const dest = typeof o === "object" && o ? `${o.host || o.path || ""}:${o.port || ""}` : String(args[1] || o || "");
  // el socket a un path unix/pipe no es red (lo usa child_process en Windows) — solo se corta host:puerto TCP
  if (typeof o === "object" && o && o.path && !o.port) return _connect.apply(this, args);
  matar("net.Socket.connect()", dest);
};

// 4 · DNS: falla antes, con mejor mensaje que un socket colgado
const { default: dns } = await import("node:dns");
for (const fn of ["lookup", "resolve", "resolve4", "resolve6"]) {
  if (typeof dns[fn] === "function") dns[fn] = function bloqueado(h) { matar(`dns.${fn}()`, String(h)); };
  if (dns.promises && typeof dns.promises[fn] === "function") dns.promises[fn] = function bloqueado(h) { matar(`dns.promises.${fn}()`, String(h)); };
}

// marca para que un gate pueda saberlo si quiere (informativa — NUNCA para saltearse el candado)
process.env.ADI_OFFLINE_GATES = "1";
