/* === _guard_gate.mjs · GATE del NUMBER-GUARD + decisor de narración (Paso 5) ===
 * numberGuard/pickNarratedText son puros (sin imports del motor) → node los importa directo, sin esbuild.
 * Uso: node _guard_gate.mjs   (exit 1 si algún test falla)
 */
import { numberGuard, pickNarratedText } from "./src/adi/llm/numberGuard.js";

// output validado de ADI (ejemplo real · rank de contribución) · obligatorias = evidence.ranking_values
const V = {
  text: "Los 5 mejores clientes por contribución son Falabella (4271) · Jumbo (4153) · Lider (3836) · Sodimac (1923) · Tottus (1909).",
  evidence: { ranking_entities: ["Falabella", "Jumbo", "Lider", "Sodimac", "Tottus"], ranking_values: [4271, 4153, 3836, 1923, 1909] },
};
// output SIN figuras estructuradas → todas las cifras del texto son obligatorias (fallback del guard)
const VNOEV = { text: "El margen de La Polar es 34.0% y el de Lider 21.5%.", evidence: {} };

const T = [
  // ── numberGuard ──
  { n: "1 · acepta narración con las MISMAS cifras",
    run: () => numberGuard("Falabella lidera con 4271, seguido de Jumbo (4153), Lider (3836), Sodimac (1923) y Tottus (1909).", V),
    ok: (r) => r.ok === true },
  { n: "2 · rechaza cifra ALTERADA (1909→1950)",
    run: () => numberGuard("Falabella 4271, Jumbo 4153, Lider 3836, Sodimac 1923, Tottus 1950.", V),
    ok: (r) => r.ok === false && r.unauthorized.includes("1950") },
  { n: "3 · rechaza cifra INVENTADA (total 15000)",
    run: () => numberGuard("Falabella 4271, Jumbo 4153, Lider 3836, Sodimac 1923, Tottus 1909; el total ronda 15000.", V),
    ok: (r) => r.ok === false && r.unauthorized.some((x) => x.replace(/[.,]/g, "") === "15000") },
  { n: "4 · tolera FORMATO equivalente (4.271 ≡ 4271, miles con punto)",
    run: () => numberGuard("Falabella lidera con 4.271, luego Jumbo 4.153, Lider 3.836, Sodimac 1.923 y Tottus 1.909.", V),
    ok: (r) => r.ok === true },
  { n: "5 · rechaza OMISIÓN de obligatoria (falta Sodimac 1923 y Tottus 1909)",
    run: () => numberGuard("Falabella lidera con 4271, seguido de Jumbo 4153 y Lider 3836.", V),
    ok: (r) => r.ok === false && r.missing.length >= 1 && r.unauthorized.length === 0 },
  { n: "6 · el LLM NO calcula: número derivado (rango 12.5) es no-autorizado",
    run: () => numberGuard("Falabella 4271, Jumbo 4153, Lider 3836, Sodimac 1923, Tottus 1909; hay un rango de 12.5 entre ellos.", V),
    ok: (r) => r.ok === false && r.unauthorized.includes("12.5") },
  { n: "7 · tolera equivalencia decimal en % (34.0 ≡ 34)",
    run: () => numberGuard("El margen líder es 34 puntos.", { text: "La Polar concentra el mayor margen (34.0%).", evidence: {} }),
    ok: (r) => r.ok === true },
  { n: "8 · sin evidence estructurado: TODA cifra del texto es obligatoria (omitir 21.5 → falla)",
    run: () => numberGuard("El margen de La Polar es 34.0%.", VNOEV),
    ok: (r) => r.ok === false && r.missing.length >= 1 },
  // ── pickNarratedText (decisor: narración vs texto determinístico) ──
  { n: "9 · pick: narración FIEL → se usa la narración",
    run: () => pickNarratedText(V, "Falabella lidera con 4271, Jumbo 4153, Lider 3836, Sodimac 1923, Tottus 1909."),
    ok: (r) => r.narrated === true && /Falabella lidera/.test(r.text) },
  { n: "10 · pick: cifra ALTERADA → cae al texto determinístico de ADI",
    run: () => pickNarratedText(V, "Falabella 4271, Jumbo 4153, Lider 3836, Sodimac 1923, Tottus 1950."),
    ok: (r) => r.narrated === false && r.text === V.text },
  { n: "11 · pick: cifra INVENTADA → cae al texto determinístico de ADI",
    run: () => pickNarratedText(V, "Falabella 4271, Jumbo 4153, Lider 3836, Sodimac 1923, Tottus 1909; total 15000."),
    ok: (r) => r.narrated === false && r.text === V.text },
  { n: "12 · pick: narración vacía / gateway sin texto → texto determinístico",
    run: () => pickNarratedText(V, ""),
    ok: (r) => r.narrated === false && r.text === V.text },
];

let pass = 0, fail = 0; const lines = [];
for (const t of T) {
  const r = t.run();
  const good = !!t.ok(r);
  if (good) pass++; else fail++;
  lines.push(`  ${good ? "✓" : "✗"} ${t.n}${good ? "" : `\n        → ${JSON.stringify(r)}`}`);
}
console.log(`── _guard_gate: PASS ${pass} · FAIL ${fail} (de ${T.length}) ──`);
console.log(lines.join("\n"));
process.exit(fail ? 1 : 0);
