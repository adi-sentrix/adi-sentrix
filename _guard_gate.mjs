/* === _guard_gate.mjs · GATE del NUMBER-GUARD (Paso 5) ===
 * numberGuard es puro (sin imports del motor) → node lo importa directo, sin esbuild.
 * Uso: node _guard_gate.mjs   (exit 1 si algún test falla)
 */
import { numberGuard } from "./src/adi/llm/numberGuard.js";

// output validado de ADI (ejemplo real · rank de contribución) · las obligatorias = evidence.ranking_values
const V = {
  text: "Los 5 mejores clientes por contribución son Falabella (4271) · Jumbo (4153) · Lider (3836) · Sodimac (1923) · Tottus (1909).",
  evidence: { ranking_entities: ["Falabella", "Jumbo", "Lider", "Sodimac", "Tottus"], ranking_values: [4271, 4153, 3836, 1923, 1909] },
};

const T = [
  { n: "1 · acepta narración con las MISMAS cifras",
    narr: "Falabella lidera con 4271, seguido de Jumbo (4153), Lider (3836), Sodimac (1923) y Tottus (1909).",
    ok: (r) => r.ok === true },
  { n: "2 · rechaza cifra ALTERADA (1909→1950)",
    narr: "Falabella 4271, Jumbo 4153, Lider 3836, Sodimac 1923, Tottus 1950.",
    ok: (r) => r.ok === false && r.unauthorized.includes("1950") },
  { n: "3 · rechaza cifra INVENTADA (total 15000)",
    narr: "Falabella 4271, Jumbo 4153, Lider 3836, Sodimac 1923, Tottus 1909; el total ronda 15000.",
    ok: (r) => r.ok === false && r.unauthorized.some((x) => x.replace(/[.,]/g, "") === "15000") },
  { n: "4 · tolera FORMATO equivalente (4.271 ≡ 4271, miles con punto)",
    narr: "Falabella lidera con 4.271, luego Jumbo 4.153, Lider 3.836, Sodimac 1.923 y Tottus 1.909.",
    ok: (r) => r.ok === true },
  { n: "5 · rechaza OMISIÓN de cifra obligatoria (falta Sodimac 1923 y Tottus 1909)",
    narr: "Falabella lidera con 4271, seguido de Jumbo 4153 y Lider 3836.",
    ok: (r) => r.ok === false && r.missing.length >= 1 && r.unauthorized.length === 0 },
  { n: "6 · el LLM NO calcula: número derivado (rango 12.5) es no-autorizado",
    narr: "Falabella 4271, Jumbo 4153, Lider 3836, Sodimac 1923, Tottus 1909; hay un rango de 12.5 entre ellos.",
    ok: (r) => r.ok === false && r.unauthorized.includes("12.5") },
  { n: "7 · tolera equivalencia decimal en % (34.0 ≡ 34)",
    narr: "El margen líder es 34 puntos.",
    ok: (r) => numberGuard("El margen líder es 34 puntos.", { text: "La Polar concentra el mayor margen (34.0%).", evidence: {} }).ok === true },
];

let pass = 0, fail = 0; const lines = [];
for (const t of T) {
  const r = numberGuard(t.narr, V);
  const good = !!t.ok(r);
  if (good) pass++; else fail++;
  lines.push(`  ${good ? "✓" : "✗"} ${t.n}${good ? "" : `\n        → ${JSON.stringify(r)}`}`);
}
console.log(`── _guard_gate: PASS ${pass} · FAIL ${fail} (de ${T.length}) ──`);
console.log(lines.join("\n"));
process.exit(fail ? 1 : 0);
