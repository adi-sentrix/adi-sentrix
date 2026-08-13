/* === _probe_registro_boleta_offline.mjs · EL TURNO DE LA CAPTURA, REPRODUCIDO SIN RED ========================
 * La Poda Fase 2 · el defecto medido en producción (captura del owner 2026-08-14): el owner preguntó «¿Cuánto
 * capital tengo inmovilizado en inventario?» y la pantalla contestó «Valparaíso · **Capital detenido** marca $25K».
 * CLAUDE.md §4 lo prohíbe: se dice **inmovilizado**, nunca «detenido».
 *
 * QUÉ REPRODUCE, y por qué así. En ese turno el narrador NO llegó (airbag: la función se cortó por reloj), así que
 * el texto lo compuso el RESPALDO DETERMINÍSTICO — `componerPorForma` (narrationBlocks.js), que imprime los labels
 * de la boleta VERBATIM, sin pasar por `stripLanguageLeaks` (que solo lava la narración VIVA). Este probe pone al
 * narrador a fallar exactamente igual (`callNarrate` lanza, como un timeout de red) y muestra:
 *   [1] la BOLETA del turno — los labels tal como el motor los sella;
 *   [2] el TEXTO FINAL que la pantalla habría mostrado;
 *   [3] el veredicto contra el vocabulario vetado.
 * Y corre el mismo turno por la segunda puerta: la que SÍ tiene narrador pero cuyo borrador el muro rechaza
 * (reparación determinística) — el otro camino por el que el respaldo llega a pantalla.
 *
 * CERO RED · CERO .env · CERO CRÉDITO: `answerViaOracle` no sabe hablar con ningún proveedor, recibe las dos
 * pasadas como argumentos. Acá se le pasan funciones locales. Se corre a mano:  node _probe_registro_boleta_offline.mjs
 * NO termina en `_gate.mjs` A PROPÓSITO: nombra `callPlan`/`callNarrate`, así que la suite lo clasificaría LIVE y
 * lo dejaría fuera en silencio. El candado permanente de esto es `_registro_boleta_gate.mjs`, que llega a los
 * MISMOS labels sin tocar el oráculo. */
import { answerViaOracle } from "./src/adi/oracle/answerViaOracle.js";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
initTenant(TENANT_DEMO);

// EL MISMO vocabulario que el gate permanente (`_registro_boleta_gate.mjs`) — una sola fuente de verdad sobre qué
// palabra está vetada. CLAUDE.md §4: plata · vara · dormido · guita · palanca · apretar · y «detenido» por capital.
const VETADAS = /\b(plata|guita|palancas?|dormid[oa]s?|apr[ei]et\w*|varas?|detenid[oa]s?)\b/i;

const Q = "¿Cuánto capital tengo inmovilizado en inventario?";
// el plan REAL de ese turno: el foco de inventario que la pregunta manda (inventoryFocus.js → "frenado").
const PLAN = { intent: "answer", mode: "default", calls: [{ tool: "inventoryStatus", args: { focus: "frenado" } }] };

// borrador que el muro RECHAZA a propósito: cita una cifra que la boleta no autoriza ($99.9M). Es la segunda
// puerta al respaldo determinístico — la de la reparación, distinta de la del airbag.
const BORRADOR_VETADO = "El capital inmovilizado asciende a $99.9M y se concentra en una sola bodega.";

const CASOS = [
  ["AIRBAG · el narrador no llega (lo que le pasó al owner)", async () => { throw new Error("socket hang up (simulado, sin red)"); }],
  ["REPARACIÓN · el borrador no pasa el muro", async () => BORRADOR_VETADO],
];

let fallos = 0;
for (const [nombre, callNarrate] of CASOS) {
  let boleta = null;
  const out = await answerViaOracle({
    text: Q, history: [], mem: {}, scenario: "actual",
    callPlan: async () => PLAN,
    callNarrate: async (args) => { boleta = (args.ledgerFigs || []).map((f) => `${f.label} = ${f.value}`); return callNarrate(args); },
  });
  const texto = String((out && out.r && out.r.text) || "");
  console.log(`\n════════════════════════════════════════════════════════════════════════════`);
  console.log(`══ ${nombre}`);
  console.log(`\n[1] BOLETA DEL TURNO (los labels que el respaldo imprime verbatim):`);
  for (const l of (boleta || ["(el narrador nunca fue invocado)"])) console.log(`      ${l}`);
  console.log(`\n[2] TEXTO FINAL EN PANTALLA  ·  determinístico=${!!(out && out.r && out.r.deterministic)} · reparado=${!!(out && out.r && out.r.narrationRepaired)}`);
  console.log(texto.split("\n").map((l) => `      ${l}`).join("\n"));

  // [3] el veredicto: ni el texto ni un solo label pueden traer palabra vetada.
  const enTexto = texto.match(VETADAS);
  const enLabels = (boleta || []).map((l) => [l, l.match(VETADAS)]).filter(([, m]) => m);
  console.log(`\n[3] VEREDICTO`);
  if (enTexto) { fallos++; console.log(`      ✗ TEXTO: palabra vetada «${enTexto[0]}» — …${texto.slice(Math.max(0, enTexto.index - 45), enTexto.index + 45).replace(/\s+/g, " ")}…`); }
  else console.log(`      ✓ TEXTO: 0 palabras vetadas`);
  if (enLabels.length) { fallos += enLabels.length; for (const [l, m] of enLabels) console.log(`      ✗ LABEL: «${m[0]}» en «${l}»`); }
  else console.log(`      ✓ LABELS: 0 palabras vetadas en ${(boleta || []).length} figs`);
  // la cifra de la captura tiene que seguir estando: corregir el registro NO puede costar el dato.
  const traeValparaiso = /Valpara[ií]so/.test(texto), traeCifra = /\$\s?\d/.test(texto);
  console.log(`      ${traeValparaiso && traeCifra ? "✓" : "·"} el dato sigue: bodega nombrada=${traeValparaiso} · cifra presente=${traeCifra}`);
}

console.log(`\n════════════════════════════════════════════════════════════════════════════`);
console.log(fallos ? `✗ ${fallos} hallazgo(s) de registro — el turno de la captura TODAVÍA puede imprimir la palabra vetada.`
                   : `✓ el turno de la captura ya no puede imprimir «Capital detenido» por ninguna de las dos puertas del respaldo determinístico.`);
process.exit(fallos ? 1 : 0);
