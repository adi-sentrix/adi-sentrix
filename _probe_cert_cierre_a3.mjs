/* === _probe_cert_cierre_a3.mjs · ARREGLO 3 del cierre de la certificación amplia (2026-08-13) ==================
 * Hallazgo 4 (registro), medido en los transcripts `_cert_amplia_openai.*.json` (dev=81638bf):
 *   (a) «capital detenido» / «inventario detenido» salió 4 veces (D1 ×2, D4, H4) — CLAUDE.md §4: INMOVILIZADO;
 *   (b) B2 cerró con DOS preguntas seguidas: la del narrador + la genérica de ensureClarifyClosingQuestion,
 *       porque la cláusula de período «(Datos del año cerrado.)» tapaba el «?» real.
 * Verifica: los bigramas se barren (encadenando desde «dormido») · el VERBO sobre un SKU queda intacto (H3) ·
 * el texto reescrito sigue pasando guardC con la boleta real de diagnose · el cierre queda con UNA pregunta ·
 * el caso sin pregunta sigue ganando la suya.
 * 100% OFFLINE — cero gateway, cero red.
 * Correr con el candado de red puesto:  node --import ./scripts/offline-guard.mjs _probe_cert_cierre_a3.mjs */
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { stripLanguageLeaks } from "./src/adi/llm/voiceGuard.js";
import { ensureClarifyClosingQuestion } from "./src/adi/oracle/narratePromptC.js";
import { TOOLS } from "./src/adi/oracle/toolRegistry.js";
import { tiparBoleta } from "./src/adi/oracle/ledger.js";
import { guardC } from "./src/adi/oracle/guardC.js";

initTenant(TENANT_DEMO);

let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ " + m + (extra ? "\n      " + String(extra).slice(0, 240) : "")); } };
const H = (t) => console.log("\n" + t);

H("[1] LOS BIGRAMAS SE BARREN (las 4 formas medidas en la certificación)");
{
  const casos = [
    ["El **capital total detenido** en las bodegas asciende a **$33K**.", /capital total inmovilizado/],          // D1
    ["| Bodega | Capital detenido | % del total |", /Capital inmovilizado/],                                      // D1/H4 (encabezado)
    ["presenta un **capital detenido de $14K**, con una rotación de **1.0x**.", /capital inmovilizado de \$14K/], // D1
    ["hay **$33K** de inventario detenido concentrado en dos SKU.", /inventario inmovilizado/],                   // F4
    ["Los capitales detenidos por bodega suman $33K.", /capitales inmovilizados/],                                // plural
    ["Hay capital dormido en Valparaíso.", /capital inmovilizado/],                                               // encadena dormido→detenido→inmovilizado
  ];
  for (const [entrada, esperado] of casos) {
    const out = stripLanguageLeaks(entrada);
    ok(esperado.test(out) && !/(capital|inventario)(\s+total)?\s+detenid/i.test(out), `«${entrada.slice(0, 44)}…» → inmovilizado`, out);
  }
}

H("[2] EL VERBO SOBRE UN SKU/PROCESO QUEDA INTACTO (H3/H4, legítimo)");
{
  const casos = [
    "¿Por qué se detuvo el SKU Refrigerador Samsung 300L?",
    "La detención del Refrigerador Samsung 300L no tiene una causa identificable.",
    "MAK-COMP-AIR está detenido y acumula 190 días de inventario.",
    "Los más detenidos (LG-DRYER8KG) llevan meses sin salida.",
  ];
  for (const c of casos) ok(stripLanguageLeaks(c) === c, `intacto: «${c.slice(0, 50)}…»`);
}

H("[3] EL TEXTO REESCRITO SIGUE PASANDO EL MURO (la boleta real de diagnose usa el label viejo)");
{
  const raw = TOOLS.diagnose({ filters: {}, scenario: "actual" });
  const figs = tiparBoleta({ tool: "diagnose", callId: "c1", args: { scenario: "actual" } }, raw);
  const sub = figs.find((f) => /Capital detenido · subtotal/.test(f.label));
  ok(!!sub, "la boleta de diagnose trae el subtotal con su label histórico («Capital detenido · subtotal»)", figs.map((f) => f.label).join(" | "));
  if (sub) {
    const texto = stripLanguageLeaks(`El capital detenido suma ${sub.value} y se concentra en Valparaíso.`);
    ok(/capital inmovilizado suma/.test(texto), "la narración queda en registro («capital inmovilizado»)", texto);
    const v = guardC(texto, { ledger: { figs }, results: [{ tool: "diagnose", callId: "c1", facts: raw.facts, boleta: figs, coverage: raw.coverage }], trace: null, question: "¿dónde tengo capital inmovilizado?" });
    ok(v.ok, "…y guardC la deja pasar (la cifra sigue autorizada aunque el concepto diga inmovilizado)", JSON.stringify(v.violations && v.violations.slice(0, 2)));
  }
}

H("[4] EL CIERRE DE CLARIFY QUEDA CON UNA SOLA PREGUNTA");
{
  // el caso B2 medido: pregunta guía del narrador + cláusula de período escrita por el propio narrador
  const b2 = "Ripley tiene un margen del 25%.\n\n¿Te gustaría que profundizáramos en alguna de las acciones comerciales? (Datos del año cerrado.)";
  const out = ensureClarifyClosingQuestion(b2, "clarify");
  ok(out === b2, "pregunta guía + cláusula de período → NO se agrega otra pregunta", out);
  ok((out.match(/\?/g) || []).length === 1, "…el cierre queda con exactamente una pregunta");
  // marco mixto también tapa el cierre
  const mixto = "¿Quieres verlo por bodega? (Dos marcos distintos: la venta es del año cerrado y el inventario es la foto a hoy.)";
  ok(ensureClarifyClosingQuestion(mixto, "clarify") === mixto, "la cláusula de marco mixto tampoco duplica");
  // el caso sin pregunta SIGUE ganando la suya (la garantía original, intacta)
  const sinP = "Ripley tiene un margen del 25%. (Datos del año cerrado.)";
  const out2 = ensureClarifyClosingQuestion(sinP, "clarify");
  ok(/¿Quieres que lo repase de otra forma, o seguimos con el siguiente paso\?$/.test(out2), "sin pregunta guía → la garantía agrega la suya, como siempre", out2);
  // y el final limpio en «?» sigue siendo no-op (byte-idéntico al comportamiento previo)
  const limpio = "¿Quieres que te lo muestre con un ejemplo?";
  ok(ensureClarifyClosingQuestion(limpio, "clarify") === limpio, "final en «?» sin cláusulas → no-op de siempre");
  ok(ensureClarifyClosingQuestion(sinP, "default") === sinP, "fuera de clarify no cambia nada");
}

console.log(`\n── PROBE A3 · registro (inmovilizado + una sola pregunta) · ${PASS} PASS · ${FAIL} FAIL ──`);
process.exitCode = FAIL ? 1 : 0;
