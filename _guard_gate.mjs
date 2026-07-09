/* === _guard_gate.mjs · GATE del NUMBER-GUARD + decisor de narración (Paso 5) ===
 * numberGuard/pickNarratedText son puros (sin imports del motor) → node los importa directo, sin esbuild.
 * Uso: node _guard_gate.mjs   (exit 1 si algún test falla)
 */
import { numberGuard, pickNarratedText, shouldNarrate } from "./src/adi/llm/numberGuard.js";
import { stripProactiveSuffix } from "./src/adi/llm/voiceGuard.js";

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
  // ── sweep de calidad 2026-07-09 · política de narración (los degrades honestos van crudos) ──
  { n: "13 · política: bloqueo del seam (spec_blocked_*) NO se narra",
    run: () => shouldNarrate({ route: "spec_blocked_simulate-compound", text: "Eso no lo puedo proyectar." }),
    ok: (r) => r === false },
  { n: "14 · política: degrade honesto ('No tengo a X…') NO se narra (Walmart fabricado)",
    run: () => shouldNarrate({ route: "client_dive", text: "No tengo a Walmart en el detalle de la cartera de este escenario. ¿Cuál querés revisar?" }),
    ok: (r) => r === false },
  { n: "15 · política: dimensión inexistente ('No te puedo atribuir…') NO se narra",
    run: () => shouldNarrate({ route: "qi_retrieval", text: "No te puedo atribuir margen a un vendedor: falta la dimensión." }),
    ok: (r) => r === false },
  { n: "16 · política: respuesta normal SÍ se narra",
    run: () => shouldNarrate({ route: "qi_retrieval", text: "8 de 13 clientes están bajo tu piso de 30.1%." }),
    ok: (r) => r === true },
  // ── guard de ESCALA (drift $M→$K cazado por los jueces en brand_comparison) ──
  { n: "17 · escala: '$31.6K' narrado donde ADI dijo '$31.6M' → descartada (escala-alterada)",
    run: () => pickNarratedText({ text: "Samsung vende $31.6M y Philips $28.0M.", evidence: {} }, "Samsung genera más volumen, con ventas de $31.6K frente a $28.0M de Philips."),
    ok: (r) => r.narrated === false && r.verdict === "escala-alterada" },
  { n: "18 · escala: sufijo CONSERVADO → narración pasa",
    run: () => pickNarratedText({ text: "Samsung vende $31.6M y Philips $28.0M.", evidence: {} }, "Samsung genera más volumen: $31.6M en ventas frente a $28.0M de Philips."),
    ok: (r) => r.narrated === true },
  // ── guard de ETIQUETA (la carga 1.8% narrada como "margen" — cifra real, etiqueta falsa) ──
  { n: "19 · etiqueta: boleta dice CARGA 1.8% y la narración lo llama 'margen' → descartada",
    run: () => pickNarratedText(
      { text: "Mercado Libre crece 25.3% con carga 1.8%.", evidence: { boleta: [{ label: "Carga · Mercado Libre", value: "1.8%" }, { label: "Crecimiento · Mercado Libre", value: "25.3%" }] } },
      "Mercado Libre crece 25.3% con uno de los márgenes más bajos de la cartera, solo 1.8%."),
    ok: (r) => r.narrated === false && r.verdict === "etiqueta-corrupta" },
  { n: "20 · etiqueta: la misma cifra bien etiquetada ('carga 1.8%') → narración pasa",
    run: () => pickNarratedText(
      { text: "Mercado Libre crece 25.3% con carga 1.8%.", evidence: { boleta: [{ label: "Carga · Mercado Libre", value: "1.8%" }, { label: "Crecimiento · Mercado Libre", value: "25.3%" }] } },
      "Mercado Libre viene creciendo 25.3% con una carga de apenas 1.8%."),
    ok: (r) => r.narrated === true },
  // ── muletilla proactiva (owner 2026-07-09: "no deberíamos tener muletillas") ──
  { n: "21 · muletilla: el suffix 'Un punto que no saliste a buscar…' se elimina y el resto queda intacto",
    run: () => stripProactiveSuffix("La venta va +7.6% vs el año anterior.\n\nUn punto que no saliste a buscar: Mercado Libre viene creciendo 25.3% — y casi nadie la mira."),
    ok: (r) => r === "La venta va +7.6% vs el año anterior." },
  { n: "22 · muletilla: texto sin suffix queda idéntico (idempotente)",
    run: () => stripProactiveSuffix("La venta va +7.6% vs el año anterior."),
    ok: (r) => r === "La venta va +7.6% vs el año anterior." },
  { n: "23 · muletilla: nunca deja el texto vacío (suffix solo → se conserva)",
    run: () => stripProactiveSuffix("Un punto que no saliste a buscar: Mercado Libre viene creciendo 25.3%."),
    ok: (r) => typeof r === "string" && r.trim().length > 0 },
  // ── saludo (primera impresión 2026-07-09): verbatim, sin gastar gateway ──
  { n: "24 · saludo: NO se narra (shouldNarrate false — ni gastar el gateway)",
    run: () => shouldNarrate({ route: "meta_saludo", text: "¡Hola! Soy ADI…", evidence: { kind: "saludo" } }),
    ok: (r) => r === false },
  { n: "25 · saludo: pickNarratedText lo devuelve VERBATIM aunque llegue narración",
    run: () => pickNarratedText({ text: "¡Hola! Soy ADI, tu asesor.", evidence: { kind: "saludo", boleta: [] } }, "Hola! Encantado de saludarte, veo números interesantes."),
    ok: (r) => r.narrated === false && r.text === "¡Hola! Soy ADI, tu asesor." },
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
