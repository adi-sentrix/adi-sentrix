/* === _raw_gate.mjs · CRUDO OBLIGATORIO — NINGÚN HECHO SIN CRUDO SALE «VERIFICADA» (owner 2026-09-25, offline) ═══
 * Etapa 1 · corte 2 (item 3) y corte 2b («resuelto DE RAÍZ», owner 2026-09-25). La lección `adi-verificado-no-es-
 * exacto` (commit `0a6178da`): una fig sin `raw` numérico hace que `notario/evidencia.js` reparsee el TEXTO ya
 * redondeado como si fuera el dato (`crudo:false`), y esa reconstrucción NUNCA puede llamarse «medido»/
 * «verificada» sin mentir.
 *
 * CORTE 2b — CERO TOLERANCIA. El corte 2 medía el invariante (verificada ⟺ crudo) pero TOLERABA figs sin crudo
 * en el demo (23 de ellas, todas evitables). El owner cerró la mezcla «condicionada = sin crudo» (esa palabra es
 * para un insumo DECLARADO por el usuario, no para el redondeo de ADI) y pidió resolverlo EN EL ORIGEN: los
 * productores (`toolRegistry.js:_fmtMoneyFacts` + los paneles de `specRetrieval.js` que auto-camina
 * `enrichFromFacts`) ahora cuelgan el crudo del $ formateado con el símbolo `CRUDO_MONEY` (ledger.js) — invisible
 * a `Object.keys`/`JSON.stringify`, así que la forma de `facts` que ve el LLM no cambia un byte. Este gate ahora
 * EXIGE CERO figs sin crudo en el barrido del demo: cualquier fig nueva sin crudo pone el gate en ROJO y la
 * LISTA por nombre (nunca en silencio). Si algún día aparece una que de verdad no se puede resolver (un campo
 * genuinamente sin escala conocida), se declara en `EXCEPCIONES_SIN_CRUDO` de abajo CON SU MOTIVO — nunca se
 * tolera calladamente.
 *
 * CORTE 2c (owner 2026-09-25, corrige el corte 2b) — «el valor es el comprobante a la precisión de lo impreso»,
 * ley vigente del Notario: una cita directa que repite lo mostrado sigue VERDADERA sin crudo (el crudo es para
 * HACER UNA CUENTA NUEVA — razón/derivada —, nunca para rechazar una cita). El corte 2b había hecho que la cita
 * directa saliera «no-verificable» sin crudo, y `_ronda5_gate` (RA15) cazó la regresión: una cita legítima de un
 * composer de la casa quedaba bloqueada. Lo único que sin-crudo cambia en la cita directa es su FUERZA: null
 * (nunca «verificada», nunca «condicionada» — esa palabra es de un insumo declarado por el usuario).
 *
 * Este gate BARRE LAS FIGS REALES del demo, escenario CANÓNICO bonanza (ESCENARIO_INICIAL) — no una muestra
 * sintética — con el mismo método que `_verificador_crudo_gate.mjs` (runPlan/toolRunner, el camino que usa el
 * agente EN VIVO) y `_entrega_gate.mjs` (barrido sobre figs reales), sobre los tres dominios (comercial ·
 * cobranza · inventario). Para CADA fig se arma un hecho «ref» que la cita directamente y se verifica el
 * INVARIANTE: fuerza === "verificada" SI Y SOLO SI la fig trae crudo genuino (`crudo !== false`); sin crudo, la
 * cita sigue verdadera (si coincide con lo mostrado) pero su fuerza es null.
 *
 * CERO llamadas a un LLM: todo determinístico, sobre datos del tenant demo. Solo por `npm run gates:offline` (o
 * `node --import ./scripts/offline-guard.mjs _raw_gate.mjs`). */
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { ESCENARIO_INICIAL } from "./src/config/scenarios.js";
import { cifrasDelDato } from "./src/adi/oracle/datoProyectado.js";
import { axisEntityNames } from "./src/adi/oracle/entityIndex.js";
import { runPlan } from "./src/adi/oracle/toolRunner.js";
import { TOOLS } from "./src/adi/oracle/toolRegistry.js";
import { cajaDelAgente } from "./src/adi/agente/herramientasAgente.js";
import { indiceDeEvidencia } from "./src/adi/notario/evidencia.js";
import { libroDeHechos, asignarIds, fuerzaDe, origenDe, composicionDe } from "./src/adi/notario/hechos.js";

let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };
const H = (t) => console.log(`\n${t}`);

initTenant(TENANT_DEMO);
ok(ESCENARIO_INICIAL === "bonanza", "el escenario canónico sigue siendo «bonanza» — barrer otro escenario no es barrer el dato real");

const CAJA = cajaDelAgente(TOOLS);
const DATO = cifrasDelDato(ESCENARIO_INICIAL);
const ejes = {};
for (const e of ["cliente", "sku", "marca", "familia", "bodega", "canal"]) { try { const n = axisEntityNames(e); if (n && n.length) ejes[e] = n; } catch { /* sin índice */ } }

const figsDeCall = (tool, args) => {
  const rp = runPlan({ intent: "answer", calls: [{ tool, args }] }, { scenario: ESCENARIO_INICIAL, maxCalls: 18, preguntaUsuario: "barrido de crudo", registry: CAJA });
  return asignarIds((rp.ledger && rp.ledger.figs) || []);
};

/* ═══ EL BARRIDO — comercial · cobranza · inventario, las llamadas reales del agente ═══ */
const LLAMADAS = [
  ["marginRead", { focus: "bajo_benchmark", dimension: "cliente" }],
  ["salesRead", { focus: "vs_anterior", dimension: "cliente" }],
  ["contributionRead", {}],
  ["cobranza", {}],
  ["inventoryStatus", {}],
  ["queryMetric", { metric: "capital", dimension: "sku" }],
];

H("1 · el barrido — cuántas figs reales trae cada llamada");
/* CADA llamada arma SU PROPIO índice (mismo método que `_hechos_gate.mjs`/`_verificador_crudo_gate.mjs`): combinar
 * las figs de varias llamadas en un solo índice haría colisionar sus ids («c1» de marginRead con «c1» de cobranza,
 * cada uno con su propio `asignarIds`) y `_figPorId` resolvería la fig EQUIVOCADA — un defecto del barrido, no del
 * producto. Por eso el invariante se mide llamada por llamada. */
const LOTES = [];
for (const [tool, args] of LLAMADAS) {
  let figs = [];
  try { figs = figsDeCall(tool, args); } catch (e) { figs = []; ok(false, `${tool}(${JSON.stringify(args)}) no lanza`, e && e.message); continue; }
  ok(Array.isArray(figs), `${tool}(${JSON.stringify(args)}) → ${figs.length} figs`);
  LOTES.push({ tool, figs });
}
const totalFigs = LOTES.reduce((s, l) => s + l.figs.length, 0);
ok(totalFigs >= 30, `al menos 30 figs reales barridas en total (dio ${totalFigs})`);

/* EXCEPCIONES DECLARADAS (owner 2026-09-25, corte 2b, item 3: «si alguna es legítimamente imposible, que quede
 * en una lista declarada con el motivo, en el gate y a la vista, nunca en silencio»). Vacía hoy: el barrido mide
 * CERO figs sin crudo en el demo tras el corte 2b. Si algún día una fig nueva no puede resolver su crudo (un
 * campo genuinamente sin escala conocida en el origen), se declara acá — clave = `${tool}: ${label}` exacto —
 * con su motivo, y el gate la deja pasar SOLO a ella, nombrándola igual en el resumen. Cualquier otra fig sin
 * crudo que no esté en esta lista es ROJO. */
const EXCEPCIONES_SIN_CRUDO = {
  // "marginRead: Entidad · Concepto": "motivo textual, por qué de verdad no se puede resolver la escala acá",
};

H("2 · CADA fig real, citada directamente — CERO figs sin crudo (fuerza «verificada» ⟺ crudo genuino)");
let conCrudo = 0, sinCrudo = 0, verificadasBien = 0, sinCrudoExcusada = 0, malas = [], sinCrudoNueva = [];
for (const { tool, figs } of LOTES) {
  const I = indiceDeEvidencia({ figs, datoProyectado: DATO, ejesDelTenant: ejes });
  for (const f of I.figs) {
    if (!f.fig || !f.fig.id) continue;   // ids asignados por asignarIds a cada fig original
    const libro = libroDeHechos([{ id: "x", tipo: "ref", de: f.fig.id }], { indice: I });
    const x = libro.porId.get("x");
    const rotulo = `${tool}: ${f.label}`;
    if (f.crudo === false) {
      sinCrudo++;
      // sin crudo: la cita directa sigue verdadera («el valor es el comprobante a la precisión de lo impreso»
      // — corte 2c), pero su fuerza es null — nunca "verificada" y nunca "condicionada".
      if (!x || x.veredicto !== "verdadera" || fuerzaDe(libro, "x") != null) {
        malas.push(`★ CARNADA ROTA · «${rotulo}» sin crudo no salió verdadera-con-fuerza-null (veredicto=${x && x.veredicto}, fuerza=${fuerzaDe(libro, "x")})`);
      }
      if (EXCEPCIONES_SIN_CRUDO[rotulo]) sinCrudoExcusada++; else sinCrudoNueva.push(rotulo);
      continue;
    }
    if (!x || !x.ok) continue;   // una ref que no resolvió (colisión de label duplicado DENTRO de la misma llamada) no participa de la medida
    const fz = fuerzaDe(libro, "x");
    const og = origenDe(libro, "x");
    const comp = composicionDe(libro, "x");
    if (comp.length !== 1 || comp[0].rol !== "valor") { malas.push(`${rotulo}: composición inesperada (${JSON.stringify(comp)})`); continue; }
    if (og.titular !== "medido") { malas.push(`${rotulo}: origen «${og.titular}» ≠ medido (ninguna fig real del demo declara otro origen hoy)`); continue; }
    conCrudo++;
    if (fz !== "verificada") malas.push(`«${rotulo}» tiene crudo genuino pero fuerza = «${fz}» (debería ser «verificada»)`); else verificadasBien++;
  }
}
ok(conCrudo > 0, `figs con crudo genuino en el barrido: ${conCrudo}`);
ok(verificadasBien === conCrudo, `TODAS las figs con crudo salen «verificada» (${verificadasBien}/${conCrudo})`, malas.filter((m) => m.includes("tiene crudo genuino") || m.includes("composición") || m.includes("≠ medido")).slice(0, 10).join("\n      "));
ok(malas.filter((m) => m.includes("CARNADA ROTA")).length === 0, `★ CARNADA · TODA fig sin crudo (${sinCrudo}) sigue verdadera (cita correcta) con fuerza null`, malas.filter((m) => m.includes("CARNADA ROTA")).join("\n      "));
// CERO TOLERANCIA (item 3): cualquier fig sin crudo NO declarada en EXCEPCIONES_SIN_CRUDO pone esto en rojo,
// LISTÁNDOLA por nombre — nunca en silencio.
ok(sinCrudoNueva.length === 0, `CERO figs sin crudo sin declarar en el barrido (dio ${sinCrudoNueva.length} nuevas de ${sinCrudo} sin crudo total, ${sinCrudoExcusada} excusadas)`, sinCrudoNueva.map((r) => `SIN CRUDO NO DECLARADA: ${r}`).join("\n      "));
ok(malas.filter((m) => !m.includes("CARNADA ROTA")).length === 0, "sin otras anomalías de composición/origen en el barrido", malas.filter((m) => !m.includes("CARNADA ROTA")).join("\n      "));

/* ═══ 3 · CARNADA explícita — una fig sin `raw` (reparseada desde el texto) nunca es «verificada», pero SIGUE
 * siendo una cita legítima («el valor es el comprobante a la precisión de lo impreso») ═══ */
H("3 · CARNADA — una fig fabricada sin `raw` (reparseo de evidencia.js) nunca sale «verificada», pero sigue verdadera");
{
  const { fig } = await import("./src/adi/boleta.js");
  const sinRaw = fig("Jumbo · Saldo vencido", "$12.6M", { unit: "money" });   // sin `raw`: el mismo defecto de la lección 36,3→36,1
  const figs = asignarIds([sinRaw]);
  const I2 = indiceDeEvidencia({ figs, ejesDelTenant: {} });
  ok(I2.figs[0].crudo === false, "control: evidencia.js SÍ marca crudo:false (reparseó el texto)");
  const libro = libroDeHechos([{ id: "y", tipo: "ref", de: figs[0].id }], { indice: I2 });
  const y = libro.porId.get("y");
  // corte 2c (corrige 2b): una cita directa («ref») sin crudo sigue verdadera — repite EXACTAMENTE lo mostrado;
  // el crudo es para calcular (razón/derivada), no para citar. Lo único que cambia es la fuerza: null.
  ok(y.veredicto === "verdadera", "★ CONTROL · la cita directa sin crudo sigue verdadera (repite lo mostrado)", y.motivo);
  ok(fuerzaDe(libro, "y") == null, `★ CARNADA · fuerza = ${fuerzaDe(libro, "y")} (null: nunca verificada, nunca condicionada)`);
}

/* ═══ 4 · CONTROL NEGATIVO — una razón real (crudo en los dos operandos) sí sale «verificada» ═══ */
H("4 · CONTROL NEGATIVO — una razón con los dos operandos con crudo real sí sale «verificada»");
{
  const figsCobranza = figsDeCall("cobranza", {});
  const I3 = indiceDeEvidencia({ figs: figsCobranza, datoProyectado: DATO, ejesDelTenant: ejes });
  const libro = libroDeHechos([
    { id: "h1", tipo: "razon", num: { sujeto: "Lider", metrica: "Saldo vencido" }, den: { sujeto: "negocio", metrica: "Saldo vencido" }, valor: "36.3%" },
  ], { indice: I3 });
  const h1 = libro.porId.get("h1");
  ok(!!h1 && h1.ok, "h1 (Lider ÷ negocio, saldo vencido) verdadera", h1 ? h1.motivo : "sin hecho");
  ok(fuerzaDe(libro, "h1") === "verificada", `fuerza = «${fuerzaDe(libro, "h1")}» (esperado verificada: los dos operandos tienen crudo real)`);
}

console.log(`\n── _raw_gate: ${PASS} PASS · ${FAIL} FAIL (de ${PASS + FAIL}) ──`);
if (FAIL > 0) process.exit(1);
