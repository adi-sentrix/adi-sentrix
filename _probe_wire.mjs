import { detectIntent } from "./src/adi/router.js";
import { composeMechanismResponse } from "./src/adi/composers/mechanisms.js";

const qs = ["clientes con bajo margen", "qué clientes erosionan el margen", "qué cliente concentra la pérdida", "dónde tengo capital detenido", "qué clientes tienen bajo margen"];
for (const q of qs) {
  const intent = detectIntent(q, {});
  console.log(`«${q}» type=${intent.type} · crossDomain=${JSON.stringify(intent.crossDomain || null)}`);
}

console.log("\n── composeMechanismResponse('commercial_erosion','bonanza') ──");
try {
  const r = composeMechanismResponse("commercial_erosion", "bonanza");
  console.log("opener len:", r.opener ? r.opener.length : 0);
  console.log("head:", r.opener ? r.opener.split("\n")[0] : "(null)");
} catch (e) { console.log("ERR:", e.message); }
