// Smoke test mínimo: ¿el grafo ESM importa y corre? (no es UI; harness de verificación)
import { answerADI } from "./src/adi/answerADI.js";

const r = answerADI("cómo están las ventas", {}, { scenario: "bonanza" });
console.log("route:", r.route);
console.log("intent:", r.intent);
console.log("text != null:", r.text != null);
console.log("text.length:", r.text ? r.text.length : 0);
console.log("---- primeras líneas del texto ----");
console.log(r.text ? r.text.split("\n").slice(0, 4).join("\n") : "(null)");
