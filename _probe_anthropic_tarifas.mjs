/* === _probe_anthropic_tarifas.mjs · preparación Anthropic · A1 (2026-08-13) ==============================
 * PROBE 100% OFFLINE: importa SOLO modelPricing.js (módulo puro, sin red, sin credencial). Cero llamadas.
 * Correr con el candado:  node --import ./scripts/offline-guard.mjs _probe_anthropic_tarifas.mjs
 *
 * Qué demuestra (A1):
 *   · las 3 tarifas nuevas (haiku-4-5 · sonnet-5 · opus-5) resuelven por alias EXACTO con los precios del owner
 *     (sonnet a precio de LISTA $3/$15 — el intro $2/$10 expira 2026-08-31 y la tabla tarifa costos reales);
 *   · la forma FECHADA real de Haiku ("claude-haiku-4-5-20251001") tarifa a la entrada de "claude-haiku-4-5"
 *     por la MISMA regla de snapshot que ya servía a gpt-4o-mini — ninguna regla nueva;
 *   · gpt-4o-mini sigue resolviendo igual que antes, con su entrada byte-igual;
 *   · la regla "JAMÁS un prefijo libre" sigue viva también para los ids nuevos.
 */
const { MODEL_PRICING, resolvePricingKey, costoLlamadaUSD, estimateCostUSD, ESTADO_COSTO } =
  await import(new URL("./src/adi/llm/modelPricing.js", import.meta.url).href);

let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ " + m + (extra ? " — " + extra : "")); } };

console.log("── A1.a · las 3 tarifas nuevas, por alias exacto y con el precio decidido ──");
const ESPERADO = [
  ["claude-haiku-4-5", 1.00, 5.00],
  ["claude-sonnet-5", 3.00, 15.00],
  ["claude-opus-5", 5.00, 25.00],
];
for (const [alias, pin, pout] of ESPERADO) {
  const e = MODEL_PRICING[alias];
  ok(e && e.in === pin && e.out === pout, `MODEL_PRICING["${alias}"] = {in:${pin}, out:${pout}}`, JSON.stringify(e));
  ok(resolvePricingKey(alias) === alias, `resolvePricingKey("${alias}") resuelve por alias exacto`);
}
ok(JSON.stringify(MODEL_PRICING["claude-sonnet-5"]) === JSON.stringify({ in: 3, out: 15 }),
  "sonnet lleva el precio de LISTA ($3/$15), no el intro que expira");

console.log("\n── A1.b · la forma FECHADA de Haiku tarifa por la regla de snapshot de SIEMPRE ──");
ok(resolvePricingKey("claude-haiku-4-5-20251001") === "claude-haiku-4-5",
  `"claude-haiku-4-5-20251001" (snapshot \\d{8} del proveedor) → familia "claude-haiku-4-5"`);
ok(resolvePricingKey("gpt-4o-mini-2024-07-18") === "gpt-4o-mini",
  `…y es la MISMA regla que ya servía a "gpt-4o-mini-2024-07-18" (snapshot fechado con guiones)`);
const cHaiku = costoLlamadaUSD("claude-haiku-4-5-20251001", { input_tokens: 1_000_000, output_tokens: 1_000_000 });
ok(cHaiku.estado === ESTADO_COSTO.TARIFADO && cHaiku.usd === 6 && cHaiku.familia === "claude-haiku-4-5",
  `1M in + 1M out del snapshot fechado de Haiku = US$6.00 exactos (tarifado, familia declarada)`, JSON.stringify(cHaiku));
ok(resolvePricingKey("anthropic/claude-sonnet-5") === "claude-sonnet-5",
  `el prefijo de proveedor ("anthropic/claude-sonnet-5") también resuelve — regla existente, no nueva`);
ok(resolvePricingKey("Claude-Haiku-4-5-LATEST") === "claude-haiku-4-5",
  `caja y "-latest" siguen cubiertos por las formas de siempre`);

console.log("\n── A1.c · gpt-4o-mini sigue resolviendo IGUAL que antes (entrada byte-igual) ──");
ok(JSON.stringify(MODEL_PRICING["gpt-4o-mini"]) === JSON.stringify({ in: 0.15, out: 0.6 }),
  `la entrada de "gpt-4o-mini" es byte-igual a la de siempre — ${JSON.stringify(MODEL_PRICING["gpt-4o-mini"])}`);
ok(resolvePricingKey("gpt-4o-mini") === "gpt-4o-mini", `el alias exacto sigue resolviendo`);
ok(estimateCostUSD("gpt-4o-mini", { input_tokens: 1_000_000, output_tokens: 1_000_000 }) === 0.75,
  `1M+1M de gpt-4o-mini sigue costando US$0.75 exactos`);

console.log("\n── A1.d · JAMÁS un prefijo libre — también para los ids nuevos ──");
ok(resolvePricingKey("claude-haiku-4-5-turbo") === null,
  `un futuro "claude-haiku-4-5-turbo" es OTRO modelo: queda SIN precio (no se inventa tarifa)`);
ok(resolvePricingKey("claude-sonnet-5.5") === null,
  `"claude-sonnet-5.5" tampoco hereda la tarifa de sonnet-5`);

console.log(`\n── _probe_anthropic_tarifas: ${PASS} PASS · ${FAIL} FAIL ──`);
process.exit(FAIL ? 1 : 0);
