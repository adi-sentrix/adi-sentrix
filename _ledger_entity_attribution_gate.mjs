/* === _ledger_entity_attribution_gate.mjs · GATE del pedido del owner (2026-08-02, segunda vuelta) ===
 * "No dejes el escape de cifras pct/doh/rotacion sin entidad protegido solo por prompt: filtra o etiqueta esas
 * cifras por entidad y alcance antes de entregarlas al narrador, para impedir cualquier atribución incorrecta
 * también en prosa."
 *
 * Hallazgo en vivo (encontrado depurando el gate anterior, no reportado por el owner): `enrichFromFacts`
 * (src/adi/oracle/ledger.js) — mecanismo GENERAL usado por TODAS las tools de Architecture C, no solo
 * inventario — auto-genera fig() autorizadas desde `facts` (todo lo que NO es `boleta` curada) usando el NOMBRE
 * DE LA CLAVE como label cuando el nodo no tiene .name/.entidad/.nombre/.label. `facts.inventory.bySku[]`/
 * `byBodega[]` (specRetrieval.js) SÍ tienen entidad (.sku/.bodega) pero NO esos 4 campos genéricos — así que
 * "doh"/"rotacion"/"pct" quedaban autorizadas SUELTAS, sin decir de qué SKU/bodega eran. Reproducido en vivo
 * (pipeline real, "cuánto capital tengo detenido en Valparaíso"): el narrador citó "100%" para Valparaíso a
 * partir de una fig autorizada literalmente llamada "pct", no "Valparaíso · % del total".
 *
 * Fix (ledger.js, alcance ACOTADO a propósito — ver comentario en el archivo): _ENTITY_KEYS ahora también
 * reconoce sku/bodega/familia/cliente/marca (no solo name/entidad/nombre/label); la rama NUMÉRICA arma
 * "Entidad · Concepto" (nunca la entidad sola, para no colisionar 2 campos del mismo nodo) y, si NINGÚN campo de
 * entidad aplica, la cifra se OMITE en vez de autorizarse suelta. La rama de STRING (usada por trend/tablaM para
 * series ya formateadas, y por figuras genuinamente globales sin entidad como `comparacion.vs_anio_anterior`,
 * toolRegistry.js) queda INTACTA — no es el mismo riesgo (valores pre-formateados por el motor, no doh/rotacion/
 * pct crudos de una fila sin nombre) y auditoría previa confirmó que tocarla rompe ese camino real.
 */
import { enrichFromFacts } from "./src/adi/oracle/ledger.js";
import { composeSpecInventory } from "./src/adi/specRetrieval.js";
import { answerViaOracle } from "./src/adi/oracle/answerViaOracle.js";
import { handlePlan, handleNarrateC } from "./src/adi/llm/gatewayCore.js";
import { buildNarrateUserMessageC } from "./src/adi/oracle/narratePromptC.js";
import fs from "fs";
for (const ln of fs.readFileSync(".env", "utf8").split(/\r?\n/)) { const m = ln.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }

let pass = 0, fail = 0;
const ok = (cond, label) => { console.log(`  ${cond ? "✓" : "✗"} ${label}`); if (cond) pass++; else fail++; };
const BARE_KEYS = ["doh", "pct", "rotacion", "diasSinVenta", "porcentaje"];

console.log("── 1 · enrichFromFacts — el patrón EXACTO del bug (bySku[]/byBodega[] sin .nombre/.entidad, solo .sku/.bodega) ──");
{
  const facts = { inventory: { bySku: [
    { sku: "SKU-A", usd: 1000, doh: 50, rotacion: 2.5, diasSinVenta: 30 },
    { sku: "SKU-B", usd: 800, doh: 60, rotacion: 1.8, diasSinVenta: 45 },
  ], byBodega: [{ bodega: "Norte", usd: 500, pct: 100 }] } };
  const boleta = enrichFromFacts([], facts);
  const labels = boleta.map((f) => f.label);
  ok(labels.some((l) => l === "SKU-A · Días de inventario"), `SKU-A tiene su doh correctamente atribuido — labels: ${labels.join(" | ")}`);
  ok(labels.some((l) => l === "SKU-A · Rotación"), "SKU-A tiene su rotación correctamente atribuida");
  ok(labels.some((l) => l === "SKU-A · Días sin venta"), "SKU-A tiene sus días sin venta correctamente atribuidos");
  ok(labels.some((l) => l === "SKU-B · Días de inventario"), "SKU-B (OTRO SKU) tiene SU PROPIO doh, no se confunde con SKU-A");
  ok(labels.some((l) => l === "Norte · % del total"), "byBodega: Norte tiene su % correctamente atribuido");
  ok(!BARE_KEYS.some((k) => labels.includes(k)), `NINGÚN label es una clave pelada sin entidad (${BARE_KEYS.join("/")}) — obtuvo: ${labels.filter((l) => BARE_KEYS.includes(l)).join(", ") || "ninguna"}`);
}

console.log("\n── 2 · REGRESIÓN — un nodo con nombre GENÉRICO (.nombre/.entidad) sigue funcionando como antes ──");
{
  const facts = { ranking: [{ nombre: "Falabella", margen: 22.5 }, { entidad: "Lider", margen: 18.3 }] };
  const boleta = enrichFromFacts([], facts);
  const labels = boleta.map((f) => f.label);
  ok(labels.some((l) => l === "Falabella · Margen"), `.nombre sigue siendo reconocido como entidad — obtuvo: ${labels.join(" | ")}`);
  ok(labels.some((l) => l === "Lider · Margen"), ".entidad sigue siendo reconocido como entidad");
}

console.log("\n── 3 · REGRESIÓN — cifra GENUINAMENTE sin entidad (ni siquiera sku/bodega/familia/cliente/marca) se OMITE, no se autoriza suelta ──");
{
  const facts = { resumen: { crecimientoTotal: 12.5 } };   // sin name/entidad/nombre/label/sku/bodega/familia/cliente/marca
  const boleta = enrichFromFacts([], facts);
  ok(boleta.length === 0, `sin ningún campo de entidad reconocible, NO se autoriza la cifra suelta (obtuvo ${boleta.length} figs: ${boleta.map((f) => f.label).join(", ")})`);
}

console.log("\n── 4 · REGRESIÓN CRÍTICA — la rama de STRING (trend/tablaM, cifras globales pre-formateadas) queda INTACTA ──");
{
  // mismo shape real que toolRegistry.js:513-524 (trend, rama de venta global) — auditoría previa confirmó que
  // esta es la ÚNICA vía de esa cifra hacia la boleta; si esto deja de autorizarse, el narrador citaría una cifra
  // "no autorizada" (guardC la rechazaría) pese a que el propio facts.comparacion.nota le pide citarla tal cual.
  const facts = { comparacion: { vs_anio_anterior: "+15.2%", direccion_vs_anio_anterior: "sube", nota: "la dirección ya está resuelta acá — copiala, no la recalcules" } };
  const boleta = enrichFromFacts([], facts);
  const labels = boleta.map((f) => f.label);
  ok(labels.includes("vs_anio_anterior"), `REGRESIÓN CRÍTICA: la cifra global sin entidad (trend/comparacion) sigue autorizándose vía la rama de string, byte-igual a antes (obtuvo: ${labels.join(" | ")})`);
  const fig1 = boleta.find((f) => f.label === "vs_anio_anterior");
  ok(!!fig1 && fig1.value === "15.2%", `y su valor sigue extrayéndose byte-igual a antes de mi cambio (_FIGRE no captura el signo "+", comportamiento preexistente no tocado) — obtuvo "${fig1 && fig1.value}"`);
}

console.log("\n── 5 · composeSpecInventory REAL (sin mocks) — el facts.inventory completo, sin ninguna clave pelada ──");
{
  const r = composeSpecInventory({ scenario: "actual", focus: "frenado" });
  const { boleta: curada, ...rest } = r.evidence;
  const enriquecida = enrichFromFacts(curada.slice(), rest);
  const nuevos = enriquecida.slice(curada.length);
  const bareHits = nuevos.filter((f) => BARE_KEYS.includes(f.label));
  ok(bareHits.length === 0, `evidence.inventory completo (bySku+byBodega+estados+contrapunta) no genera NINGUNA clave pelada al enriquecer (obtuvo ${bareHits.length}: ${bareHits.map((f) => f.label).join(", ")})`);
  ok(nuevos.some((f) => /^[A-Za-zÁÉÍÓÚáéíóúñÑ0-9-]+ · (Días de inventario|Rotación|Días sin venta)$/.test(f.label)), `SÍ aparecen las cifras operacionales (doh/rotación/días sin venta) — pero correctamente atribuidas — ejemplo: ${(nuevos.find((f) => /Días de inventario|Rotación|Días sin venta/.test(f.label)) || {}).label}`);
}

console.log("\n── 6 · SMOKE LLM REAL — el caso exacto reproducido (\"cuánto capital tengo detenido en Valparaíso\") sin cifras sueltas en el ledger ──");
{
  const callPlan = async ({ text, history, mem, scenario }) => { const r = await handlePlan({ text, history, mem, scenario }); if (!r.ok) throw new Error(r.error); return r.plan; };
  let lastFigs = null;
  const callNarrate = async ({ text, plan, results, ledgerFigs, mem, history }) => {
    lastFigs = ledgerFigs;
    const built = buildNarrateUserMessageC({ text, plan, results, ledgerFigs, mem, history });
    const r = await handleNarrateC({ payload: built, mem });
    if (!r.ok) throw new Error(r.error);
    return r.narration;
  };
  let cleanRuns = 0, resolved = 0;
  for (let i = 0; i < 3; i++) {
    const r = await answerViaOracle({ text: "cuánto capital tengo detenido en Valparaíso", history: [], mem: {}, scenario: "actual", callPlan, callNarrate });
    if (!r) continue;
    resolved++;
    const bareLabels = (lastFigs || []).filter((f) => BARE_KEYS.includes(f.label));
    console.log(`  run: cifras sueltas sin entidad = ${bareLabels.length} (${bareLabels.map((f) => f.label + "=" + f.value).join(", ") || "ninguna"})`);
    if (bareLabels.length === 0) cleanRuns++;
  }
  console.log(`  medición: ${cleanRuns}/${resolved} corridas SIN ninguna cifra pelada en el ledger real`);
  ok(resolved === 0 || cleanRuns === resolved, `TODAS las corridas resueltas del caso real quedan sin cifras sin-entidad en el ledger (obtuvo ${cleanRuns}/${resolved})`);
}

console.log(`\n── _ledger_entity_attribution_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
