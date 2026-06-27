// Fix A · ranking de inventario filtrado (marca/familia).
// ADI Core Fase 2.5a: ROTACIÓN modelada → RESPONDE (flag ON) / AVISA (flag OFF · disolución métrica por métrica).
// DOH NO modelada → AVISA siempre (rotación ON NO la habilita). Flag-aware: pasa en ambos regímenes.
import { answerADI } from "./src/adi/answerADI.js";
import { ADI_INV_ROTACION_ENABLED } from "./src/config/voiceFlags.js";
const run = (q) => answerADI(q, { activeModule: "inventario" }, { scenario: "bonanza" });
let pass = 0, fail = 0;
const ck = (label, cond, detail) => { if (cond) { pass++; console.log(`✓ ${label}`); } else { fail++; console.log(`✗ FAIL ${label}  ${detail || ""}`); } };
const ROT = ADI_INV_ROTACION_ENABLED;
const isInvResp = (r) => r.route === "spine_inv_superlative" || r.route === "spine_inv_retrieval";
const FOREIGN = /\$\s?\d|\bUSD\b|\d+\s*d[ií]as|\bdoh\b|inmoviliz|capital\s+(atrap|deten)|stock\s*usd|d[ií]as\s+(de\s+)?cobertura/i;

console.log(`════ ROTACIÓN FILTRADA (marca/familia) · ${ROT ? "RESPONDE (2.5a · modelada · cero fuga ajena)" : "AVISA (pre-2.5a)"} ════`);
for (const [q, filt] of [
  ["qué SKU de Samsung rota peor", "Samsung"],
  ["cuál es el SKU de Samsung que peor rota", "Samsung"],
  ["qué SKU de la familia Línea Blanca rota peor", "Línea Blanca"],
]) {
  const r = run(q); const t = r.text || "";
  const ok = ROT
    ? (isInvResp(r) && /\d\.\dx/.test(t) && t.includes(filt) && !FOREIGN.test(t))           // RESPONDE rotación · respeta filtro · sin fuga ajena
    : (r.route === "qi_inventory_filter_avisar" && !t.includes("MAK-COMP-AIR") && t.includes(filt));  // AVISA viejo
  ck(`«${q}» → ${r.route}`, ok, `route=${r.route}`);
  console.log(`   ${t.slice(0, 110)}`);
}

console.log(`\n════ DOH FILTRADO · NO modelada → AVISA SIEMPRE (rotación disponible NO la habilita) ════`);
{
  const r = run("qué SKU de Bosch tiene peor DOH"); const t = r.text || "";
  ck("«qué SKU de Bosch tiene peor DOH» → AVISA", r.route === "qi_inventory_filter_avisar" && t.includes("Bosch") && !t.includes("MAK-COMP-AIR"), `route=${r.route}`);
}

console.log(`\n════ ROTACIÓN SIN FILTRO · ${ROT ? "RESPONDE" : "AVISA"} ════`);
for (const q of ["cuál es el SKU con peor rotación", "peor rotación", "cuál es el SKU con mejor rotación"]) {
  const r = run(q); const t = r.text || "";
  const ok = ROT ? (isInvResp(r) && /\d\.\dx/.test(t) && !FOREIGN.test(t)) : (r.route === "qi_inventory_avisar" && !t.includes("MAK-COMP-AIR"));
  ck(`«${q}» → ${r.route}`, ok, `route=${r.route}`);
}
console.log(`\n════ DOH SIN FILTRO · NO modelada → AVISA ════`);
{
  const r = run("el SKU con más DOH");
  ck("«el SKU con más DOH» → AVISA", r.route === "qi_inventory_avisar" && !(r.text || "").includes("MAK-COMP-AIR"), `route=${r.route}`);
}
console.log(`\n── Fix A: ${pass} ok / ${fail} fail ── (rotación ${ROT ? "RESPONDE" : "AVISA"} · DOH AVISA)`);
process.exit(fail ? 1 : 0);
