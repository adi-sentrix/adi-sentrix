/* sonda del cerrojo · INTENTA resolver un host de proveedor. Bajo el candado: exit 97. */
import dns from "node:dns";
dns.lookup("api.anthropic.com", () => {});
console.log("ESCAPE · dns.lookup() no fue bloqueado");
process.exit(0);
