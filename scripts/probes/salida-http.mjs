/* sonda del cerrojo · INTENTA salir por el cliente http crudo (incluye localhost: en modo offline ninguna red
 * es red permitida, porque un server local puede proxear al gateway). Bajo el candado: exit 97. */
import http from "node:http";
http.get({ hostname: "127.0.0.1", port: 8080, path: "/api/adi-spec" }, () => {});
console.log("ESCAPE · http.get() no fue bloqueado");
process.exit(0);
