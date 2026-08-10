/* sonda de CONTROL del cerrojo · la misma salida TCP que las otras sondas, pero contra un puerto cerrado de
 * 127.0.0.1 — nunca contra un proveedor. Sirve para probar que la sonda DISTINGUE los dos estados:
 *   · SIN candado → el intento sale del proceso, la conexión la rechaza el sistema, y esto imprime ESCAPE y sale 0
 *   · CON candado → muere en `net.Socket.connect` con exit 97
 * Sin este control, "todas las sondas dan 97" no probaría nada: podrían dar 97 por cualquier otro motivo. */
import net from "node:net";
const s = net.connect({ host: "127.0.0.1", port: 9 });
s.on("error", () => { console.log("ESCAPE · el intento salió del proceso (no hay candado)"); process.exit(0); });
s.on("connect", () => { console.log("ESCAPE · el intento salió del proceso (no hay candado)"); process.exit(0); });
setTimeout(() => { console.log("ESCAPE · el intento salió del proceso (no hay candado)"); process.exit(0); }, 3000);
