// === HARNESS · RUTEO DE LENTE · ADI abre la lente según la intención de la pregunta (boleta._lensFor) ===
import { buildSentrixBoleta } from "./src/adi/sentrix/boleta.js";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("✅", m); } else { fail++; console.log("🚨", m); } };
// resp sintético con entidad+métrica+reading → la boleta se construye · el lens sale de ctx.__query (o del route).
const lensOf = (query, route) => buildSentrixBoleta(
  { evidence: { entidad: "Lider", entityType: "client", metrica: "margen", reading: { focus: "Lider", focusType: "client" } } },
  null, route || "ranking_extremes", "bonanza", { __query: query }
).lens;

console.log("── DEFAULT · finding / porqué → Diagnóstico (la historia) ──");
ok(lensOf("el peor cliente por margen") === "diagnostico", "«el peor cliente por margen» → diagnostico");
ok(lensOf("qué bodega tiene más capital inmovilizado") === "diagnostico", "«...capital inmovilizado» → diagnostico");
ok(lensOf("cómo está Falabella") === "diagnostico", "«cómo está Falabella» → diagnostico");

console.log("\n── CONTROL · acción / palanca / comparar / recuperar → la mesa ──");
ok(lensOf("el peor cliente por margen, qué hago") === "control", "«...qué hago» → control");
ok(lensOf("cuál es el peor cliente y su palanca") === "control", "«...su palanca» → control");
ok(lensOf("el peor cliente por margen contra el promedio") === "control", "«...contra el promedio» → control");
ok(lensOf("cuánto puedo recuperar del peor cliente") === "control", "«cuánto puedo recuperar...» → control");

console.log("\n── EVIDENCIA · probame / la cuenta / de dónde sale → el recibo ──");
ok(lensOf("el peor cliente por margen, probame la cuenta") === "evidencia", "«...probame la cuenta» → evidencia");
ok(lensOf("de dónde sale el margen de Lider") === "evidencia", "«de dónde sale...» → evidencia");
ok(lensOf("el peor margen, cómo se calcula") === "evidencia", "«...cómo se calcula» → evidencia");

console.log("\n── PRECEDENCIA · Evidencia (probar) gana sobre Control cuando ambos aparecen ──");
ok(lensOf("probame la cuenta y qué hago") === "evidencia", "«probame...y qué hago» → evidencia (probar primero)");

console.log("\n── LLM-READY · evidence.lens explícito MANDA (v2 lo setea directo) ──");
const forced = buildSentrixBoleta({ evidence: { entidad: "Lider", metrica: "margen", lens: "control" } }, null, "ranking_extremes", "bonanza", { __query: "el peor cliente por margen" });
ok(forced.lens === "control", "evidence.lens explícito gana sobre el ruteo por texto");

console.log("\n── ROBUSTEZ · sin query → default diagnostico (no rompe) ──");
ok(lensOf("") === "diagnostico" && lensOf(undefined) === "diagnostico", "query vacía/undefined → diagnostico");

console.log("\n════════════════════════════════════════════════════");
console.log(`GATES: ${pass}/${pass + fail} · ${fail === 0 ? "TODOS VERDES" : "HAY ROJOS"}`);
process.exit(fail === 0 ? 0 : 1);
