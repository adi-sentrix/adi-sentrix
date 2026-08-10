/* sonda del cerrojo · INTENTA salir por el cliente https crudo. Bajo el candado: exit 97. */
import https from "node:https";
https.request({ hostname: "api.openai.com", port: 443, path: "/v1/chat/completions", method: "POST" }, () => {}).end();
console.log("ESCAPE · https.request() no fue bloqueado");
process.exit(0);
