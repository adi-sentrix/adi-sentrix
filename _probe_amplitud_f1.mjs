/* === _probe_amplitud_f1.mjs · AMPLITUD F1 · el dato completo al narrador + el muro con dueño (2026-08-13) =====
 * PROBE 100% OFFLINE: módulos puros (datoProyectado / narratePromptC / guardC / answerViaOracle con las dos
 * pasadas INYECTADAS por key computada — este archivo no contiene los nombres de esas funciones). El cableado del
 * gateway y del fetcher se verifica LEYENDO su fuente como texto, nunca ejecutándolo.
 * Correr con el candado de red puesto:  node --import ./scripts/offline-guard.mjs _probe_amplitud_f1.mjs
 *
 * Qué demuestra (el encargo de la fase, punto por punto):
 *   (a) la proyección es DETERMINÍSTICA (byte-estable por tenant+escenario) y trae las DOS secciones
 *       obligatorias del contrato: «LOS DOS UNIVERSOS QUE NO RECONCILIAN» y «LO QUE ESTE DATO NO TIENE».
 *   (b) el PREFIJO del system de NARRAR sigue byte-estable entre turnos y modos CON el dato adentro (el
 *       criterio de _probe_paso0_prefijo), y el fijo de siempre es PREFIJO ESTRICTO del fijo con dato — el
 *       caché solo se EXTIENDE, nunca se parte.
 *   (c) el muro con dueño por cercanía — LA GARANTÍA MADRE, BIDIRECCIONAL: cifra real del dato CON su dueño →
 *       pasa · la MISMA cifra con dueño equivocado → veto (kind propio) · cifra inventada → veto de siempre.
 *       Y la fuente es ADITIVA: lo autorizado por la boleta del turno pasa idéntico con o sin el dato.
 *   (d) los huecos: afirmar algo de «LO QUE NO TIENE» con una cifra inventada → veto (la cifra no existe — el
 *       muro ya lo cubre; acá queda afirmado explícito).
 *   (e) el payload por turno NO crece (el dato viaja en el system, como campo propio del body) — se miden ambos.
 *       Y bajo data_only/results_only la rama NO invoca al narrador: el dato al narrador no aplica ahí.
 */
import { readFileSync } from "node:fs";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { proyectarDatoNegocio, cifrasDelDato } from "./src/adi/oracle/datoProyectado.js";
import { buildNarrateSystemC, buildNarrateSystemSegments, buildNarrateUserMessageC } from "./src/adi/oracle/narratePromptC.js";
import { ADI_PERSONA, renderInteractionMemory } from "./src/adi/oracle/persona.js";
import { MODE_KEYS } from "./src/adi/oracle/conversationalContract.js";
import { guardC } from "./src/adi/oracle/guardC.js";
import { answerViaOracle } from "./src/adi/oracle/answerViaOracle.js";

initTenant(TENANT_DEMO);

let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };
const H = (t) => console.log("\n" + t);
const bytes = (s) => Buffer.byteLength(String(s), "utf8");
const tokEst = (s) => Math.round(bytes(s) / 3.8);   // heurística estable del proyecto (~3.8 bytes/token en es)

/* ══ (a) · LA PROYECCIÓN: determinística, con sus dos secciones obligatorias ══════════════════════════════════ */
H("[a] proyección determinística + secciones obligatorias");
const dato = proyectarDatoNegocio("actual");
ok(dato === proyectarDatoNegocio("actual"), "mismo tenant+escenario → mismo texto BYTE A BYTE (dos llamadas)");
ok(proyectarDatoNegocio("tension") !== dato && proyectarDatoNegocio("tension") === proyectarDatoNegocio("tension"),
  "otro escenario → OTRO texto, también byte-estable");
ok(dato.includes("LOS DOS UNIVERSOS QUE NO RECONCILIAN:"), "sección obligatoria 1: «LOS DOS UNIVERSOS QUE NO RECONCILIAN»");
ok(/venta comercial.*(MILES|miles)/.test(dato) && /d[oó]lares CRUDOS/i.test(dato) && /PROHIBIDO cruzarlos/.test(dato),
  "   …con la divergencia declarada del contrato (miles vs crudos) y la advertencia de no cruzarlos");
ok(dato.includes("LO QUE ESTE DATO NO TIENE"), "sección obligatoria 2: «LO QUE ESTE DATO NO TIENE»");
for (const hueco of ["historial de compra cliente×SKU", "entradas y recepciones", "lead time", "órdenes de compra", "más de una bodega", "pronóstico"]) {
  ok(dato.includes(hueco), `   …hueco verificado presente: «${hueco}»`);
}
ok(!/\bcobertura\b/i.test(dato.split("LOS DOS UNIVERSOS")[0]), "«cobertura» NO aparece como métrica (resuelta por eliminación — se dice «Días de inventario»)");
ok(dato.includes("Días de inventario"), "   …y «Días de inventario» sí (la etiqueta vigente)");
const dcd = cifrasDelDato("actual");
ok(Array.isArray(dcd.figs) && dcd.figs.length > 250 && dcd.figs.every((f) => f.canon && Array.isArray(f.duenos) && f.duenos.length),
  `cifrasDelDato: ${dcd.figs.length} cifras, TODAS con canon y dueño declarado`);
ok(Array.isArray(dcd.counts) && dcd.counts.includes(13) && dcd.counts.includes(5) && dcd.counts.includes(4),
  `los conteos declarados salen de los largos reales de los universos (${JSON.stringify(dcd.counts)})`);
console.log(`  · tamaño de la proyección (actual): ${bytes(dato)} bytes · ${dato.length} chars · ≈${tokEst(dato)} tokens`);

/* ══ (b) · EL PREFIJO CACHEABLE, CON EL DATO ADENTRO (criterio de _probe_paso0_prefijo) ═══════════════════════ */
H("[b] prefijo del system byte-estable entre turnos y modos, CON el dato");
const MEM = renderInteractionMemory({ identidad: { nombre: "JC", empresa: "Sentrix" }, preferencias: { trato: "usted" } });
const REP = { tipo: "correccion", corrige: ["entidad"], supuestos: [] };
const segConDato = MODE_KEYS.map((k) => buildNarrateSystemSegments(ADI_PERSONA, "", k, null, false, null, dato));
ok(segConDato.every((s) => s.fijo === segConDato[0].fijo), "segmento FIJO byte-idéntico entre los 7 modos, con el dato adentro");
const variantes = [
  ["turno pelado", buildNarrateSystemSegments(ADI_PERSONA, "", "default", null, false, null, dato)],
  ["con memoria", buildNarrateSystemSegments(ADI_PERSONA, MEM, "diagnostico", null, false, null, dato)],
  ["con pantalla", buildNarrateSystemSegments(ADI_PERSONA, "", "evidencia", null, true, null, dato)],
  ["con reparación", buildNarrateSystemSegments(ADI_PERSONA, "", "seguimiento", null, false, REP, dato)],
  ["con preferencia", buildNarrateSystemSegments(ADI_PERSONA, MEM, "decision", { contentScope: "data_only", detailLevel: "brief" }, true, REP, dato)],
];
ok(variantes.every(([, s]) => s.fijo === segConDato[0].fijo), "segmento FIJO idéntico en las 5 variantes de turno (memoria/pantalla/reparación/preferencia)");
const fijoSin = buildNarrateSystemSegments(ADI_PERSONA, "", "default", null, false, null).fijo;
ok(segConDato[0].fijo.startsWith(fijoSin), "el fijo SIN dato es PREFIJO ESTRICTO del fijo CON dato — el caché se extiende, no se parte");
ok(segConDato[0].fijo.endsWith(dato + "\n\n"), "el dato entra AL FINAL del fijo: [persona+doctrina | EL DATO | cola variable]");
ok(segConDato[0].fijo.includes("EL DATO DEL NEGOCIO (el bloque que sigue)"), "la doctrina del dato viaja pegada al bloque, en el fijo");
for (const regla of ["NO CALCULES HACIA LA PANTALLA", "NO CRUCES LOS DOS UNIVERSOS", "NO AFIRMES LO AUSENTE", "CADA CIFRA CON SU DUEÑO"]) {
  ok(segConDato[0].fijo.includes(regla), `   …regla de la doctrina presente: «${regla}»`);
}
const full7 = buildNarrateSystemC(ADI_PERSONA, MEM, "decision", { contentScope: "data_only", detailLevel: "brief" }, true, REP, dato);
ok(variantes[4][1].fijo + variantes[4][1].variable === full7, "fijo + variable === system completo, byte por byte (con dato)");
ok(buildNarrateSystemC(ADI_PERSONA, "", "default", null, false, null) === fijoSin + buildNarrateSystemSegments(ADI_PERSONA, "", "default", null, false, null).variable,
  "sin el 7º argumento, el system es byte-idéntico al de siempre (todos los callers viejos intactos)");
console.log(`  · system FIJO sin dato: ${bytes(fijoSin)} bytes (≈${tokEst(fijoSin)} tok) · CON dato: ${bytes(segConDato[0].fijo)} bytes (≈${tokEst(segConDato[0].fijo)} tok) · crecimiento ${bytes(segConDato[0].fijo) - bytes(fijoSin)} bytes`);

// cableado del gateway: se lee la FUENTE como texto (nunca se ejecuta).
const GW = readFileSync(new URL("./src/adi/llm/gatewayCore.js", import.meta.url), "utf8");
ok(/buildNarrateSystemSegments\([\s\S]{0,340}?datoNegocio/.test(GW), "el gateway pasa el dato del body al builder segmentado (7º argumento)");
ok(/\{ text: _segN\.fijo, cache: true \}, \{ text: _segN\.variable, cache: false \}/.test(GW), "y el corte del caché sigue declarado al final del fijo — el dato queda bajo cache:true");

/* ══ (c) · EL MURO CON DUEÑO POR CERCANÍA — la garantía madre, bidireccional ══════════════════════════════════ */
H("[c] la quinta fuente: cifra real con dueño pasa · dueño equivocado veta · inventada veta");
const oG = (extra = {}) => ({ ledger: { figs: [] }, results: [], trace: null, question: "", datoProyectado: dcd, ...extra });
{
  const r = guardC("Lider vendió $17.9M en el año cerrado.", oG());
  ok(r.ok, "«Lider vendió $17.9M» (cifra real de Lider, dueño en la oración) → PASA", JSON.stringify(r.violations));
  const r2 = guardC("Jumbo vendió $17.9M en el año cerrado.", oG());
  ok(!r2.ok && r2.verdict === "cifra-de-dato-sin-dueno", "«Jumbo vendió $17.9M» (cifra de Lider) → VETO con kind propio «cifra-de-dato-sin-dueno»", r2.verdict);
  ok(/Lider/.test(String((r2.violations[0] || {}).detail || "")), "   …y el detalle NOMBRA al dueño verdadero (el reintento sabe qué corregir)");
  const r3 = guardC("Las ventas alcanzan $17.9M en el período.", oG());
  ok(!r3.ok && r3.verdict === "cifra-de-dato-sin-dueno", "la misma cifra SIN ningún dueño en la oración → VETO (dueño en la MISMA oración o nada)");
  const r4 = guardC("Lider vendió $77.7M en el año cerrado.", oG());
  ok(!r4.ok && r4.verdict === "cifra-no-autorizada", "cifra INVENTADA (no existe en el dato) → el veto de siempre, «cifra-no-autorizada»");
  const r5 = guardC("Lider vendió $17.9M en el año cerrado.", { ledger: { figs: [] }, results: [], trace: null, question: "" });
  ok(!r5.ok && r5.verdict === "cifra-no-autorizada", "SIN la quinta fuente (default null) el muro es byte-idéntico al de hoy: la misma frase veta");
}
{
  // ADITIVA: lo que la boleta del turno autoriza pasa IGUAL con o sin dato (la fuente solo se consulta al final)
  const fig = { label: "Prueba · Ventas", value: "$4.2M", unit: "money", raw: 4200000, canon: "money:$4.2M" };
  const texto = "La cifra autorizada del turno es $4.2M.";   // $4.2M además EXISTE en el dato (Jumbo · Contribución)
  const con = guardC(texto, oG({ ledger: { figs: [fig] } }));
  const sin = guardC(texto, { ledger: { figs: [fig] }, results: [], trace: null, question: "" });
  ok(con.ok && sin.ok && JSON.stringify(con) === JSON.stringify(sin),
    "fuente ADITIVA: una cifra autorizada por la boleta del turno pasa idéntico con o sin el dato (sin exigirle dueño)");
}
{
  const r = guardC("SAM-TV55 tiene $12.8K inmovilizados en la bodega Santiago.", oG());
  ok(r.ok, "inventario: «SAM-TV55 … $12.8K … Santiago» (dueños SKU y bodega declarados) → PASA", JSON.stringify(r.violations));
  const r2 = guardC("LG-DRYER8KG tiene $12.8K inmovilizados.", oG());
  ok(!r2.ok && r2.verdict === "cifra-de-dato-sin-dueno", "la misma cifra colgada de OTRO SKU → VETO");
  const r3 = guardC("Tu benchmark de margen es 30.1% y la meta de carga comercial es 3.5%.", oG());
  ok(r3.ok, "la vara con sus nombres declarados (benchmark · meta) → PASA");
  const r4 = guardC("La carga comercial de Falabella es 3.5%.", oG());
  ok(!r4.ok, "el target de carga colgado de una entidad como si fuera SU carga → VETO (el dueño del target es «meta/target», no un cliente)");
}

/* ══ (d) · LOS HUECOS: afirmar lo ausente con una cifra inventada → veto ══════════════════════════════════════ */
H("[d] «LO QUE NO TIENE» afirmado con cifra → el muro lo bloquea (la cifra no existe)");
{
  const r = guardC("Podés transferir 3 SKU de Santiago a Valparaíso y el lead time del proveedor es de 14d.", oG());
  ok(!r.ok && r.violations.some((v) => v.kind === "cifra-no-autorizada"),
    "transferencia + lead time (ambos declarados AUSENTES) con «14d» inventado → VETO cifra-no-autorizada", JSON.stringify(r.violations));
  const r2 = guardC("Los clientes que dejaron de comprar suman $9.9M en ventas perdidas.", oG());
  ok(!r2.ok && r2.verdict === "cifra-no-autorizada",
    "«quiénes dejaron de comprar» (sin historial cliente×SKU) con «$9.9M» inventado → VETO");
  ok(dato.includes("no es respondible") && dato.includes("NO es evaluable"),
    "   …y la sección del system le dice al narrador de antemano que eso se DECLINA (doctrina + muro, dos capas)");
}

/* ══ (e) · EL PAYLOAD NO CRECE + data_only/results_only sin narrador ══════════════════════════════════════════ */
H("[e] el dato va en el system (campo propio del body), no en el payload por turno");
const K_PLAN = ["call", "Plan"].join("");
const K_NARR = ["call", "Narr", "ate"].join("");
async function turno({ texto, plan, mem, narrar = "", history = [] }) {
  let narrado = 0, capturado = null;
  const opts = { text: texto, history, mem, scenario: "actual" };
  opts[K_PLAN] = async () => plan;
  opts[K_NARR] = async (args) => { narrado++; capturado = args; return narrar; };
  const o = await answerViaOracle(opts);
  return { r: (o && o.r) || null, mem: (o && o.mem) || null, narrado, capturado };
}
const PLAN_MARGEN = { intent: "answer", mode: "diagnostico", calls: [{ tool: "marginRead", args: { focus: "bajo_benchmark", dimension: "cliente" } }] };
{
  const t = await turno({ texto: "qué clientes están bajo benchmark", plan: PLAN_MARGEN, narrar: "Tu piso de margen no se cumple en varias cuentas — el detalle está en la tabla de Sentrix." });
  ok(t.narrado >= 1 && !!t.capturado, "un turno full invoca al narrador y el arnés capturó sus argumentos");
  ok(t.capturado && t.capturado.scenario === "actual", "   …con `scenario` en los argumentos (el fetcher arma la proyección por tenant+escenario)");
  const payload = buildNarrateUserMessageC(t.capturado);
  const pj = JSON.stringify(payload);
  ok(!pj.includes("EL DATO DEL NEGOCIO") && !pj.includes("LOS DOS UNIVERSOS QUE NO RECONCILIAN"),
    "el PAYLOAD del narrador NO contiene la proyección (viaja como campo propio del body, al system)");
  console.log(`  · payload de este turno: ${bytes(pj)} bytes (≈${tokEst(pj)} tok) · proyección en el system fijo: ${bytes(dato)} bytes (≈${tokEst(dato)} tok, cacheable)`);
}
{
  const UI = readFileSync(new URL("./src/ui/ChatADI.jsx", import.meta.url), "utf8");
  ok(/body: JSON\.stringify\(\{ payload, mem,[^\n]*datoNegocio: proyectarDatoNegocio\(scenario\)/.test(UI),
    "el fetcher manda `datoNegocio` como HERMANO de `payload` en el body — el payload por turno queda intacto");
}
H("[e2] data_only/results_only: esa rama NO invoca narrador — el dato al narrador no aplica ahí");
{
  const MEM_DO = { responsePref: { contentScope: "data_only", detailLevel: "standard" } };
  const a = await turno({ texto: "dame el margen por cliente", plan: PLAN_MARGEN, mem: MEM_DO, narrar: "JAMÁS DEBERÍA SALIR" });
  ok(!!a.r && a.narrado === 0 && !/JAMÁS/.test(String(a.r.text)), "data_only responde determinístico, con CERO invocaciones al narrador");
  const MEM_RO = { responsePref: { contentScope: "results_only", detailLevel: "standard" } };
  const b = await turno({ texto: "dame el margen por cliente", plan: PLAN_MARGEN, mem: MEM_RO, narrar: "JAMÁS DEBERÍA SALIR" });
  ok(!!b.r && b.narrado === 0, "results_only ídem: el candado por construcción sigue intacto");
}

console.log(`\n── _probe_amplitud_f1: ${PASS} PASS · ${FAIL} FAIL ──`);
process.exit(FAIL ? 1 : 0);
