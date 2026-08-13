/* === _amplitud_dato_narrador_gate.mjs · AMPLITUD F1 · el dato completo al narrador, con el muro subido =======
 * @inspeccion-estatica — este gate verifica el cableado LEYENDO fuentes como texto (nunca las ejecuta): no
 * importa el gateway ni ningún adapter, no invoca a nadie, y el candado de runtime (offline-guard) aplica igual.
 *
 * LAS CUATRO GARANTÍAS DE LA FASE (suite 137 → 138):
 *   1 · PROYECCIÓN ESTABLE — mismo tenant+escenario → mismo texto byte a byte (la condición del caché), con las
 *       DOS secciones obligatorias del contrato: «LOS DOS UNIVERSOS QUE NO RECONCILIAN» y «LO QUE ESTE DATO NO
 *       TIENE». Sin ellas el narrador cruza universos o estira sobre huecos — las secciones son la garantía.
 *   2 · DUEÑO POR CERCANÍA — la quinta fuente de guardC autoriza una cifra de la proyección SOLO con su dueño
 *       en la misma oración: cifra real+dueño pasa · dueño equivocado veta (kind «cifra-de-dato-sin-dueno») ·
 *       inventada veta como siempre · sin la fuente (default) el muro es byte-idéntico al de antes.
 *   3 · PREFIJO CACHEABLE — el segmento FIJO del system de NARRAR sigue byte-estable entre modos y turnos CON
 *       el dato adentro, el fijo de siempre es PREFIJO del fijo con dato (el caché se extiende, no se parte), y
 *       el gateway coloca el dato bajo cache:true.
 *       NOTA GARANTÍA-VS-FORMATO: el FIJO creció (~41KB → ~57KB) porque ahora carga el dato del negocio — es
 *       crecimiento de PRESUPUESTO/formato decidido por el owner (proyecto AMPLITUD), como las subas anteriores
 *       del Paso 0/1; la garantía (byte-estabilidad del prefijo) NO se relajó y acá se re-mide.
 *   4 · EL PAYLOAD POR TURNO NO CRECE — la proyección viaja como campo propio del body y jamás dentro del
 *       payload del narrador (el fetcher la manda como hermana de `payload`).
 */
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { proyectarDatoNegocio, cifrasDelDato } from "./src/adi/oracle/datoProyectado.js";
import { buildNarrateSystemSegments } from "./src/adi/oracle/narratePromptC.js";
import { ADI_PERSONA } from "./src/adi/oracle/persona.js";
import { MODE_KEYS } from "./src/adi/oracle/conversationalContract.js";
import { guardC } from "./src/adi/oracle/guardC.js";
import { readFileSync } from "node:fs";

initTenant(TENANT_DEMO);

let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };

console.log("── 1 · PROYECCIÓN ESTABLE + SECCIONES OBLIGATORIAS ──");
const dato = proyectarDatoNegocio("actual");
ok(dato === proyectarDatoNegocio("actual") && proyectarDatoNegocio("tension") === proyectarDatoNegocio("tension"),
  "determinística por tenant+escenario (byte a byte, dos escenarios)");
ok(proyectarDatoNegocio("tension") !== dato, "otro escenario → otro texto (el caché se rompe exactamente cuando el dato ES otro)");
ok(dato.includes("LOS DOS UNIVERSOS QUE NO RECONCILIAN:") && /PROHIBIDO cruzarlos/.test(dato),
  "sección «LOS DOS UNIVERSOS QUE NO RECONCILIAN» con su advertencia");
ok(dato.includes("LO QUE ESTE DATO NO TIENE") && dato.includes("historial de compra cliente×SKU") && dato.includes("lead time"),
  "sección «LO QUE ESTE DATO NO TIENE» con los huecos verificados");
const dcd = cifrasDelDato("actual");
ok(dcd.figs.length > 250 && dcd.figs.every((f) => f.canon && f.duenos.length), `cada cifra de la proyección declara canon y dueño (${dcd.figs.length})`);

console.log("── 2 · EL MURO: DUEÑO POR CERCANÍA (bidireccional) ──");
const oG = (extra = {}) => ({ ledger: { figs: [] }, results: [], trace: null, question: "", datoProyectado: dcd, ...extra });
ok(guardC("Lider vendió $17.9M en el año cerrado.", oG()).ok, "cifra real del dato CON su dueño en la oración → pasa");
{
  const r = guardC("Jumbo vendió $17.9M en el año cerrado.", oG());
  ok(!r.ok && r.verdict === "cifra-de-dato-sin-dueno", "la MISMA cifra con dueño equivocado → veto con kind propio", r.verdict);
}
ok(!guardC("Las ventas alcanzan $17.9M.", oG()).ok, "sin dueño en la oración → veto (la ventana es la oración, no el texto entero)");
{
  const r = guardC("Lider vendió $77.7M.", oG());
  ok(!r.ok && r.verdict === "cifra-no-autorizada", "cifra inventada → el veto madre de siempre (bidireccional)");
}
{
  const r = guardC("Lider vendió $17.9M.", { ledger: { figs: [] }, results: [], trace: null, question: "" });
  ok(!r.ok && r.verdict === "cifra-no-autorizada", "SIN la quinta fuente (default null) → guardC byte-idéntico al de antes");
}
{
  const fig = { label: "Prueba · Ventas", value: "$4.2M", unit: "money", raw: 4200000, canon: "money:$4.2M" };
  const texto = "La cifra autorizada del turno es $4.2M.";
  ok(JSON.stringify(guardC(texto, oG({ ledger: { figs: [fig] } }))) === JSON.stringify(guardC(texto, { ledger: { figs: [fig] }, results: [], trace: null, question: "" })),
    "ADITIVA: lo autorizado por la boleta del turno pasa idéntico con o sin la fuente — ningún chequeo existente se relajó ni se endureció");
}

console.log("── 3 · PREFIJO CACHEABLE CON EL DATO ──");
const segs = MODE_KEYS.map((k) => buildNarrateSystemSegments(ADI_PERSONA, "", k, null, false, null, dato));
ok(segs.every((s) => s.fijo === segs[0].fijo), "segmento FIJO byte-idéntico entre los 7 modos, con el dato adentro");
const fijoSin = buildNarrateSystemSegments(ADI_PERSONA, "", "default", null, false, null).fijo;
ok(segs[0].fijo.startsWith(fijoSin) && segs[0].fijo.endsWith(dato + "\n\n"),
  "el fijo de siempre es PREFIJO del fijo con dato, y el dato cierra el fijo — el caché se extiende, nunca se parte");
ok(segs[0].fijo.includes("NO CALCULES HACIA LA PANTALLA") && segs[0].fijo.includes("NO CRUCES LOS DOS UNIVERSOS") && segs[0].fijo.includes("NO AFIRMES LO AUSENTE"),
  "la doctrina mínima del dato (las tres prohibiciones) viaja pegada al bloque");
const GW = readFileSync(new URL("./src/adi/llm/gatewayCore.js", import.meta.url), "utf8");
ok(/buildNarrateSystemSegments\([\s\S]{0,340}?datoNegocio/.test(GW) && /\{ text: _segN\.fijo, cache: true \}/.test(GW),
  "el gateway pasa el dato al builder segmentado y lo deja bajo cache:true (leído de la fuente, nunca ejecutado)");

console.log("── 4 · EL PAYLOAD POR TURNO NO CRECE ──");
const UI = readFileSync(new URL("./src/ui/ChatADI.jsx", import.meta.url), "utf8");
ok(/body: JSON\.stringify\(\{ payload, mem,[^\n]*datoNegocio: proyectarDatoNegocio\(scenario\)/.test(UI),
  "el fetcher manda la proyección como campo HERMANO de `payload` — jamás adentro del payload del narrador");
const NARR = readFileSync(new URL("./src/adi/oracle/narratePromptC.js", import.meta.url), "utf8");
ok(!/datoNegocio/.test(NARR.slice(NARR.indexOf("export function projectNarratePayload"))),
  "projectNarratePayload no conoce el dato: el payload proyectado del contrato queda intacto");

console.log(`\n── _amplitud_dato_narrador_gate: ${PASS} PASS · ${FAIL} FAIL ──`);
process.exit(FAIL ? 1 : 0);
