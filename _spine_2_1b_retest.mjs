// RE-TEST 2.1b del owner · 3 spine flags ON · captura textual de cada caso.
import { answerADI } from "./src/adi/answerADI.js";
import { ADI_CORE_SPINE_ENABLED, ADI_SPINE_FILTER_ENABLED } from "./src/config/voiceFlags.js";
const ON = ADI_CORE_SPINE_ENABLED && ADI_SPINE_FILTER_ENABLED;
console.log("spine ON =", ON, "\n");
const run = (q) => { const r = answerADI(q, {}, { scenario: "bonanza" }); return { route: r.route, text: (r.text || "").replace(/\s+/g, " ").trim() }; };
const show = (label, q) => { const r = run(q); console.log(`【${label}】 «${q}»`); console.log(`  route: ${r.route}`); console.log(`  →: ${r.text}\n`); };

console.log("════════ RESPONDE (deben estar arreglados) ════════");
show("R1", "el peor margen de Bosch");
show("R2", "qué cliente Samsung vende más");
show("R3", "qué SKU de LG más débil en margen");
show("R4", "carga comercial de los clientes de Bosch");

console.log("════════ VARIANTES DE ESTRÉS (otros datos/fraseos) ════════");
show("V1", "cuál es el peor cliente de Philips");
show("V2", "qué producto de Samsung rinde menos en margen");
show("V3", "los clientes de LG por contribución");
show("V4", "el mejor SKU de Bosch");
show("V5", "qué cliente de Bosch tiene peor margen");
show("V6", "el SKU de Philips con mejor contribución");
show("V7", "qué familia vende más");
show("V8", "ventas de los clientes de Makita");

console.log("════════ CONTROL (no deben romperse) ════════");
show("C1", "el cliente con peor margen");
show("C2", "ventas por cliente de Samsung");
show("C3", "qué marca tiene peor contribución");

console.log("════════ INVENTARIO BAJO FILTRO ════════");
show("I1", "qué SKU de Bosch rota peor");
process.exit(0);
