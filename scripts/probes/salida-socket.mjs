/* sonda del cerrojo · EL PISO. Primero pisa `globalThis.fetch` con un mock (que es una técnica offline legítima
 * y por eso el candado lo permite), para probar que el bloqueo NO depende de que `fetch` siga siendo el del
 * candado: la salida TCP cruda tiene que morir igual. Bajo el candado: exit 97. */
import net from "node:net";
globalThis.fetch = async () => ({ ok: true, json: async () => ({}) });   // el mock no llega a la red; el socket sí
net.connect({ host: "api.openai.com", port: 443 });
console.log("ESCAPE · net.connect() no fue bloqueado");
process.exit(0);
