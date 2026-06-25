// CABO 2 · capability-gate de inventario en sugerencias/ángulos/CTA (flag ON) + comercial intacto.
import { answerADI } from "./src/adi/answerADI.js";
const run = (q, mod) => answerADI(q, { activeModule: mod }, { scenario: "bonanza" });
// frases que OFRECEN inventario (no menciones sueltas) — ninguna debe aparecer con flag ON
const OFRECE_INV = /validar rotaci|revisar[ií]a inventario|drilldown.*inventario|capital detenido por categor|Rotaci[oó]n promedio del top|SKUs que atrapan|cruzar con rotaci|disponibilidad operativa/i;
const ctaInv = (r) => !!(r.sentrixAction && (r.sentrixAction.moduleChip === "Inventario" || (r.sentrixAction.payload && r.sentrixAction.payload.modulo === "inventario")));
let pass = 0, fail = 0;
const ck = (l, c, d) => { if (c) pass++; else fail++; console.log(`${c ? "✓" : "✗ FAIL"} ${l}${c ? "" : "  " + (d || "")}`); };

console.log("════ GATE · NINGUNA respuesta OFRECE inventario (ángulo/sugerencia/CTA) con flag ON ════");
const CASES = [
  ["por qué cae mi margen", "inventario"],
  ["por qué cae mi margen", "margenes"],
  ["ranking de clientes por contribución", "margenes"],
  ["quién aporta más contribución", "margenes"],
  ["top 3 familias por contribución", "margenes"],
  ["cómo va el negocio", "ventas"],
  ["mostrame algo interesante", "ventas"],
  ["cuál es mi cliente más caro", "margenes"],
];
for (const [q, mod] of CASES) {
  const r = run(q, mod);
  const t = r.text || "";
  const ofrece = OFRECE_INV.test(t);
  const cta = ctaInv(r);
  const ok = !ofrece && !cta;
  ck(`«${q}» [${mod}] route=${r.route}`, ok, `ofrece-inv=${ofrece} cta-inv=${cta} | ${t.replace(/\s+/g," ").slice(-120)}`);
}

console.log("\n════ COMERCIAL INTACTO (responde + sugerencias/CTA comerciales sobreviven) ════");
const COM = [
  ["el cliente con peor margen", "margenes"],
  ["ventas por cliente de Samsung", "ventas"],
  ["mejores clientes", "ventas"],
  ["cómo le va a Falabella", "ventas"],
];
for (const [q, mod] of COM) {
  const r = run(q, mod);
  const ok = r.route !== "qi_inventory_avisar" && (r.text || "").length > 50;
  ck(`«${q}» → ${r.route} responde`, ok);
  if (r.suggestions) console.log(`     suggestions sobreviven: ${JSON.stringify(r.suggestions)}`);
  if (r.sentrixAction) console.log(`     CTA: ${JSON.stringify(r.sentrixAction).slice(0,110)}`);
}
console.log(`\n── Cabo 2: ${pass} ok / ${fail} fail ──`);
process.exit(fail ? 1 : 0);
