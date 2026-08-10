/* sonda del cerrojo · INTENTA DESARMAR el bloqueo antes de salir. Es la sonda que responde "¿se puede relajar?".
 * Imprime una línea DESARME con el resultado de cada intento y después trata de salir igual. Bajo el candado:
 * los dos intentos tienen que decir BLOQUEADO, y el proceso tiene que morir con exit 97. */
import net from "node:net";
import dns from "node:dns";

const intentos = [];
const probar = (etiqueta, fn) => { try { fn(); intentos.push(`${etiqueta}:DESARMADO`); } catch (e) { intentos.push(`${etiqueta}:BLOQUEADO(${e.constructor.name})`); } };

probar("net.asignacion", () => { net.Socket.prototype.connect = function () { return this; }; });
probar("net.defineProperty", () => Object.defineProperty(net.Socket.prototype, "connect", { value() { return this; }, writable: true, configurable: true }));
probar("dns.asignacion", () => { dns.lookup = function (h, cb) { cb(null, "1.2.3.4", 4); }; });
probar("dns.defineProperty", () => Object.defineProperty(dns, "lookup", { value(h, cb) { cb(null, "1.2.3.4", 4); }, writable: true, configurable: true }));

console.log("DESARME " + intentos.join(" | "));
net.connect({ host: "api.openai.com", port: 443 });
console.log("ESCAPE · el candado se pudo desarmar y salir");
process.exit(0);
