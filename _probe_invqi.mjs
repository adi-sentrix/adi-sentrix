import { detectIntent } from "./src/adi/router.js";
import { answerADI } from "./src/adi/answerADI.js";
const qs = [
  "dónde tengo capital detenido", "qué productos no rotan", "qué SKUs están atrapando más capital",
  "qué productos debo liquidar", "dónde tengo riesgo de quiebre", "cuál es la rotación promedio del portafolio",
];
for (const q of qs) {
  const di = detectIntent(q, {});
  const r = answerADI(q, {}, { scenario: "bonanza" });
  console.log(`«${q}»\n   detectIntent.type=${di.type}${di.crossDomain ? " arch=" + di.crossDomain.archetype : ""}${di.skuOperational ? " skuOp" : ""}${di.skuDeepDive ? " skuDive" : ""} · modular route=${r.route}`);
}
