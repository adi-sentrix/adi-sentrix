/* === _probe_dato_al_plan.mjs · EL COSTO DEL DATO EN EL PLAN, MEDIDO — y la alternativa reducida ================
 * NO es un gate (no entra a la suite): es la MEDICIÓN del punto de freno del encargo, reproducible sin gastar un
 * centavo. Se corre `node --import ./scripts/offline-guard.mjs _probe_dato_al_plan.mjs` (red bloqueada).
 *
 * POR QUÉ EXISTE: F1 proyectó el costo del bloque con la convención del repo (≈3,8 bytes por token) y estimó
 * ~3.850 tokens ≈ US$0,0004 por llamada de Haiku con caché. Ese número está MAL, y se puede demostrar sin llamar
 * a nadie: la corrida real del owner (_experimento_claude_negocios.json, 5 llamadas del 2026-08-14) trae los
 * `input_tokens` que el proveedor CONTÓ sobre un system que es exactamente persona + esta misma proyección. De
 * ahí sale el ratio REAL de este corpus, y con él el costo verdadero.
 *
 * LA ALTERNATIVA REDUCIDA (§3) se construye acá, no en el producto: es una OPCIÓN para el arquitecto, y agregar
 * un export que nadie llama sería sembrar la clase de código muerto que La Poda acaba de sacar. Si se elige, la
 * función de abajo es el contenido listo para mudar a datoProyectado.js.
 */
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { proyectarDatoNegocio } from "./src/adi/oracle/datoProyectado.js";
import { ADI_PERSONA, ADI_PERSONA_PLAN } from "./src/adi/oracle/persona.js";
import { buildPlanSystem, PLAN_TOOL, DOCTRINA_DATO_PLAN } from "./src/adi/oracle/planPrompt.js";
import { SOURCES } from "./src/config/contract/sourceManifest.js";
import { MODEL_PRICING } from "./src/adi/llm/modelPricing.js";
import { readFileSync } from "node:fs";

initTenant(TENANT_DEMO);
const DATO = proyectarDatoNegocio("actual");
const EXP = JSON.parse(readFileSync(new URL("../../../_experimento_claude_negocios.json", import.meta.url), "utf8"));
const R = EXP.registro;
const H = (t) => console.log(`\n══ ${t} ══`);

/* ── 1 · EL RATIO REAL DE ESTE CORPUS ──────────────────────────────────────────────────────────────────────────
 * Dos anclas independientes, las dos del mismo transcript pagado:
 *   (a) PROSA — el hilo de 3 turnos comparte system, así que la DIFERENCIA de input_tokens entre turnos es
 *       exactamente la respuesta anterior + la pregunta nueva. Nada que estimar.
 *   (b) EL DATO — por resta sobre el system completo, una vez descontada la persona a ratio de prosa. */
H("1 · EL RATIO REAL (medido sobre la corrida pagada del owner, no estimado)");
const d34 = R[3].usage.input_tokens - R[2].usage.input_tokens;
const d45 = R[4].usage.input_tokens - R[3].usage.input_tokens;
const RATIO_PROSA = (R[2].texto.length + R[3].q.length + R[3].texto.length + R[4].q.length) / (d34 + d45);
console.log(`  prosa española de ADI: ${RATIO_PROSA.toFixed(2)} chars/token (dos deltas: ${d34} y ${d45} tok)`);
const CABECERA_EXP = 312;   // la cabecera del arnés, medida sobre su fuente
const TOK_SYS_EXP = R[0].usage.input_tokens - Math.round(R[0].q.length / RATIO_PROSA) - 8;
const TOK_DATO = TOK_SYS_EXP - Math.round((ADI_PERSONA.length + CABECERA_EXP) / RATIO_PROSA);
const RATIO_DATO = DATO.length / TOK_DATO;
console.log(`  el DATO: ${DATO.length} chars = ${TOK_DATO} tok medidos → ${RATIO_DATO.toFixed(2)} chars/token`);
console.log(`  la convención del repo (chars/4) daría ${Math.round(DATO.length / 4)} tok · SUBESTIMA ${(TOK_DATO / (DATO.length / 4)).toFixed(2)}x`);
console.log(`  → una tabla densa de cifras y códigos de SKU tokeniza al DOBLE que la prosa que el repo venía asumiendo.`);

/* ── 2 · EL COSTO POR LLAMADA DE PLAN ───────────────────────────────────────────────────────────────────────── */
H("2 · EL COSTO DEL BLOQUE EN PLAN (Haiku, la tarifa de modelPricing.js)");
const IN_HAIKU = MODEL_PRICING["claude-haiku-4-5"].in;   // USD por 1M tokens de entrada
const sinDato = buildPlanSystem(ADI_PERSONA_PLAN, "", "actual", false);
const conDato = buildPlanSystem(ADI_PERSONA_PLAN, "", "actual", false, DATO);
const crecimiento = conDato.length - sinDato.length;
const tokBloque = Math.round(DOCTRINA_DATO_PLAN.length / RATIO_PROSA) + TOK_DATO;
console.log(`  PLAN system HOY: ${sinDato.length} chars · CON el dato: ${conDato.length} chars (+${crecimiento})`);
console.log(`  el bloque en tokens: doctrina ${Math.round(DOCTRINA_DATO_PLAN.length / RATIO_PROSA)} + dato ${TOK_DATO} = ${tokBloque} tok por llamada`);
const usd = (tok, mult) => `US$${(tok * mult * IN_HAIKU / 1e6).toFixed(6)}`;
console.log(`\n  incremental por LLAMADA de PLAN (tarifa entrada Haiku US$${IN_HAIKU}/MTok):`);
console.log(`    · sin caché (1,0×)              ${usd(tokBloque, 1)}`);
console.log(`    · lectura de caché (0,1×)       ${usd(tokBloque, 0.1)}   ← el caso normal: el bloque es estable por tenant+escenario`);
console.log(`    · escritura de caché (1,25×)    ${usd(tokBloque, 1.25)}   ← una vez por ventana de caché, no por turno`);
console.log(`\n  CONTRA LO QUE F1 PROYECTÓ (~3.850 tok ≈ US$0,00039 con caché): el costo real con caché es`);
console.log(`  ${usd(tokBloque, 0.1)} — ${(tokBloque / 3850).toFixed(2)}x lo proyectado. EL PUNTO DE FRENO DEL ENCARGO SE ACTIVA.`);
console.log(`  (a 40 turnos/día, con 1 llamada de PLAN por turno: US$${(tokBloque * 0.1 * IN_HAIKU / 1e6 * 40 * 30).toFixed(3)}/mes con caché`);
console.log(`   · US$${(tokBloque * 1 * IN_HAIKU / 1e6 * 40 * 30).toFixed(2)}/mes si el caché NO pegara nunca.)`);

/* ── 3 · LA ALTERNATIVA REDUCIDA · EL ÍNDICE SIN CIFRAS ────────────────────────────────────────────────────────
 * QUÉ CONSERVA, y por qué cada cosa: lo que el PLANIFICADOR necesita para elegir tool y alcance es el MAPA —
 * qué entidades existen, con qué nombre exacto, en qué eje, qué métricas tiene ese eje— y los dos límites que le
 * impiden planificar contra un hueco. Nada de eso necesita una sola cifra: las cifras son para NARRAR.
 * QUÉ TIRA: todos los valores (ventas, margen, contribución, costo, carga, capital, rotación, días, unidades) —
 * que es exactamente donde vive el 80% de los tokens, porque una cifra corta como "$17.9M" cuesta más tokens que
 * una palabra larga. */
H("3 · LA ALTERNATIVA REDUCIDA (el índice, sin una sola cifra)");
function proyectarIndiceNegocio(scenario = "actual") {
  const de = (src) => (SOURCES[src].scenarioLoad ? SOURCES[src].scenarioLoad(scenario) : SOURCES[src].load());
  const cv = de("clientesVentas"), mm = de("marcasMargen"), sf = de("sfamiliasMargen"), sk = de("skusMargen"), inv = de("skuInventario");
  const bodegas = [...new Set(inv.map((s) => s.bodega))];
  const canales = [...new Set(cv.map((c) => c.canal))];
  const L = [];
  L.push(`EL MAPA DEL NEGOCIO — qué existe y con qué nombre exacto. SIN CIFRAS a propósito: las cifras las traen las tools.`);
  L.push("");
  L.push(`CLIENTES (${cv.length}) — eje "cliente": ${cv.map((c) => c.nombre).join(" · ")}.`);
  L.push(`MARCAS (${mm.length}) — eje "marca": ${mm.map((m) => m.nombre).join(" · ")}.`);
  L.push(`FAMILIAS (${sf.length}) — eje "familia": ${sf.map((s) => s.nombre).join(" · ")}.`);
  L.push(`SKU (${sk.length}) — eje "sku": ${sk.map((s) => s.nombre).join(" · ")}.`);
  L.push(`BODEGAS (${bodegas.length}) — eje "bodega": ${bodegas.join(" · ")}. CANALES (${canales.length}) — eje "canal": ${canales.join(" · ")}.`);
  L.push("");
  L.push(`QUÉ MÉTRICA TIENE CADA EJE (si no está declarada, la tool declina — no pidas esa combinación):`);
  L.push(`- cliente: ventas, margen, contribución, costo, acciones comerciales, carga, unidades, composición por familia.`);
  L.push(`- marca / familia: ventas, margen, contribución, costo, carga, unidades.`);
  L.push(`- sku: ventas, margen, contribución, costo, carga, unidades, costo medio, precio de lista · y del universo inventario: capital, rotación, días de inventario, días sin venta, estado.`);
  L.push(`- bodega: capital, rotación, días de inventario (nunca venta comercial: el inventario es otro universo).`);
  L.push(`- canal: ventas (agregado).`);
  L.push(`Mensual REAL: ventas y contribución (tool trend). El resto declina honesto.`);
  L.push("");
  // las DOS secciones obligatorias viajan TEXTUALES desde la proyección completa — no se re-redactan acá (serían
  // una segunda verdad sobre los límites del dato, justo la clase de duplicación que este repo ya pagó caro).
  const iU = DATO.indexOf("LOS DOS UNIVERSOS QUE NO RECONCILIAN:");
  L.push(DATO.slice(iU));
  return L.join("\n");
}
const INDICE = proyectarIndiceNegocio("actual");
const tokIndice = Math.round(INDICE.length / RATIO_DATO);   // ratio conservador: el índice es MENOS denso que la tabla
console.log(`  índice: ${INDICE.length} chars ≈ ${tokIndice} tok (contra ${DATO.length} chars / ${TOK_DATO} tok del completo)`);
console.log(`  ahorro: ${(100 - tokIndice / TOK_DATO * 100).toFixed(0)}% de los tokens del bloque`);
console.log(`  costo con caché: ${usd(tokIndice + Math.round(DOCTRINA_DATO_PLAN.length / RATIO_PROSA), 0.1)} por llamada (contra ${usd(tokBloque, 0.1)} del completo)`);
console.log(`  · conserva: los ${INDICE.match(/CLIENTES \((\d+)\)/)[1]} clientes con su nombre exacto, los 6 ejes, qué métrica sirve cada eje,`);
console.log(`    y las DOS secciones que impiden planificar contra un hueco (van textuales, no re-redactadas).`);
console.log(`  · pierde: toda cifra — o sea, la capacidad de que el PLAN reconozca una premisa falsa del usuario`);
console.log(`    («el margen de X es 30%», cuando es 22%) y replantee en vez de pedir el dato que la confirme.`);
console.log(`\n  ── LO QUE EL ÍNDICE NO PUEDE HACER, y por eso la decisión es del owner ──`);
console.log(`  El hilo que motivó el encargo se resuelve con NOMBRES y EJES (el índice alcanza).`);
console.log(`  La sobre-planificación G1 (6 calls donde compareEntities bastaba) también: es un problema de saber`);
console.log(`  cuántas entidades hay y qué tool cubre el par — el índice lo declara.`);
console.log(`  Reconocer una premisa numérica falsa antes de gastar el turno, NO: eso exige las cifras.`);

/* ── 4 · LO QUE EL PLAN SIGUE SIN VER (para el informe, no es una falla) ───────────────────────────────────── */
H("4 · LO QUE EL PLAN SIGUE SIN VER (declarado, no disimulado)");
for (const l of [
  "la serie mensual: datoProyectado.js NO la proyecta (la sirve `trend`, anclada y reconciliada) — el PLAN sigue eligiendo `trend` por el calificador temporal del turno, no por ver los meses.",
  "los agregados por canal: los computa el motor en sus tools; el bloque solo declara que el eje existe.",
  "la boleta del turno anterior: el PLAN sigue viendo el hilo recortado (buildPlanUserMessage), no las cifras que ya se mostraron.",
  "el ViewContext completo: sigue viajando como UNA línea sin cifras (viewContext.js), sin cambios.",
]) console.log(`  · ${l}`);

console.log(`\n── probe informativo (no afirma, mide) · ${new Date(0).toISOString().slice(0, 0)}fin ──`);
