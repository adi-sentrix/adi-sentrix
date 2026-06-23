// Sonda rápida · qué hace el modular con la query ejemplo del founder y variantes de margen.
import { answerADI } from "./src/adi/answerADI.js";
const qs = [
  "clientes con bajo margen",
  "qué clientes tienen bajo margen",
  "clientes menos rentables",
  "qué clientes erosionan el margen",
  "quién aporta más contribución",
  "ranking de clientes por contribución",
];
for (const q of qs) {
  const r = answerADI(q, {}, { scenario: "bonanza" });
  console.log(`\n«${q}»`);
  console.log(`  route: ${r.route} · intent: ${r.intent} · len: ${r.text ? r.text.length : 0}`);
  console.log(`  ${r.text ? r.text.split("\n")[0].slice(0, 90) : "(null)"}`);
}
