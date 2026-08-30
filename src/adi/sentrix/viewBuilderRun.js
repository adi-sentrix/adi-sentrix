/* === src/adi/sentrix/viewBuilderRun.js · CORRER EL BUILDER QUE DECLARA CADA COMPONENTE ========================
 * (owner 2026-08-09 · decisión 12 · las cinco superficies de nivel 2)
 *
 * QUÉ RESUELVE. `viewManifest.js` es dato puro: declara con QUÉ se construye cada componente (`VIEW_BUILDERS` por
 * cara, `SUPERFICIE_BUILDERS` por superficie de nivel 2) pero no puede ejecutarlo — no importa nada, a propósito.
 * Hasta hoy esa ejecución vivía copiada dentro de cada gate como un mapa `{comercial: buildResumenComercial(SCN),
 * …}`, y con las superficies de nivel 2 iban a ser CUATRO copias de una lista de trece entradas. Una lista copiada
 * cuatro veces es una lista que se desincroniza: el día que una superficie cambie de builder, tres gates seguirían
 * midiendo la salida vieja y el rojo aparecería en el lugar equivocado.
 *
 * Acá vive esa ejecución, UNA vez. La declaración sigue en el manifiesto; esto sólo la obedece.
 *
 * QUIÉN LO USA. Los gates y cualquier verificación headless. La UI NO lo necesita: en pantalla el objeto del
 * builder ya está construido —es el que el componente está pintando en ese mismo render— y pasárselo al hook es
 * justamente lo que garantiza que el contexto describa lo que el usuario tiene delante, no una reconstrucción.
 *
 * LA ENTIDAD NUNCA SE ESCRIBE A MANO. El ring y el recibo son de un foco puntual, así que su builder pide una
 * entidad; se resuelve del propio dato (la primera fila del eje que corresponda). El manifiesto no puede nombrar
 * una entidad del tenant y este módulo tampoco.
 *
 * PURO · SIN DOM · SIN REACT · SIN RED · SIN LLM.
 */
import { VIEW_MANIFEST, SUPERFICIE_BUILDERS, builderKeyOf } from "./viewManifest.js";
import { buildResumenComercial } from "./resumenComercial.js";
import { buildMesaCapital } from "./mesaCapital.js";
import { buildMesaResultado } from "./mesaResultado.js";
import { buildMesaFlujo } from "./mesaFlujo.js";
import { buildReadingFromSignals, buildClientContribSignals } from "./reading.js";
import { buildCuadroMando } from "./cuadro.js";
import { buildControlRing } from "./control.js";
import { buildMarginReceipt, buildCapitalReceipt } from "./kpis.js";
import { composeSpecSimulate, composeSpecDiagnose } from "../specRetrieval.js";
import { buildOracleEvidence } from "../oracle/sentrixEvidence.js";
import { ESCENARIO_INICIAL } from "../../config/scenarios.js";   // colapso del eje: la base real se declara UNA vez

// ── LA ENTIDAD DEL FOCO · del DATO, jamás de un literal ────────────────────────────────────────────────────────
// La primera fila real del eje (sin la fila Total ni la de Promedio). Si el eje no trae filas, no hay foco y el
// builder devolverá null: sin contexto es honesto, uno inventado no.
export function primeraEntidadDe(eje, scenario) {
  const dim = eje === "cliente" ? "cliente" : eje;
  try {
    const cm = buildCuadroMando(dim, scenario);
    const f = (cm.rows || []).filter((r) => r && !r._total && !r._ref)[0];
    return (f && f.name) || null;
  } catch { return null; }
}

// ── EL SUPUESTO DE LA PROYECCIÓN · el mismo delta para las dos entradas, para que la comparación sea de universo
//    y no de supuesto. No es una cifra de negocio: es el parámetro con el que se construye la superficie.
const TRANSFORM_SONDA = { op: "delta", unit: "pct", value: 5 };

// ── LA EVIDENCIA DE UN TURNO DE DECISIÓN · construida con las MISMAS funciones de producción ───────────────────
// `buildOracleEvidence` es la que arma el `evidenceSpec` que el DecisionPanel pinta; los `findings` son los del
// diagnose real del escenario. Nada se fabrica: se corre el camino de producción con un plan de decisión.
function evidenceSpecDecision(scenario) {
  const d = composeSpecDiagnose({ filters: {}, scenario });
  const findings = (d && d.evidence && d.evidence.findings) || [];
  if (!findings.length) return null;
  const oe = buildOracleEvidence({
    plan: { mode: "decision", calls: [{ tool: "diagnose", args: {} }] },
    results: [{ tool: "diagnose", facts: { findings } }],
    figs: [], scenario,
  });
  return (oe && oe.evidenceSpec) || null;
}

// ── EL DESPACHO · una rama por clave declarada en SUPERFICIE_BUILDERS/VIEW_BUILDERS ────────────────────────────
const _CORREDORES = {
  comercial: (scn) => buildResumenComercial(scn),
  capital:   (scn) => buildMesaCapital(scn),
  resultado: (scn) => buildMesaResultado(scn),
  flujo:     (scn) => buildMesaFlujo(scn),   // la quinta cara (2026-08-30) — null si el tenant no declara flujo
  ficha:     (scn) => { const e = primeraEntidadDe("cliente", scn); const s = e && buildClientContribSignals(e, scn); return s ? buildReadingFromSignals(s) : null; },

  "cuadro:cliente": (scn) => buildCuadroMando("cliente", scn),
  "cuadro:sku":     (scn) => buildCuadroMando("sku", scn),
  "cuadro:marca":   (scn) => buildCuadroMando("marca", scn),
  "cuadro:bodega":  (scn) => buildCuadroMando("bodega", scn),

  // el ring habla el enum de la boleta ("client"), no el del contrato ("cliente") — la traducción vive acá, en el
  // borde, y no se filtra al manifiesto (misma disciplina que `_ejeReal` en address.js).
  "ring:cliente": (scn, ent) => buildControlRing("client", ent, scn),
  "ring:sku":     (scn, ent) => buildControlRing("sku", ent, scn),
  "ring:marca":   (scn, ent) => buildControlRing("marca", ent, scn),
  "ring:bodega":  (scn, ent) => buildControlRing("bodega", ent, scn),

  "recibo:cliente": (scn, ent) => buildMarginReceipt(ent, scn),
  "recibo:bodega":  (scn, ent) => buildCapitalReceipt(ent, scn),

  decision: (scn) => evidenceSpecDecision(scn),
  "simulacion:comercial": () => { const r = composeSpecSimulate({ metric: "ventas", dimension: "cliente", filters: {}, transform: TRANSFORM_SONDA }); return (r && r.evidence) || null; },
  "simulacion:capital":   () => { const r = composeSpecSimulate({ metric: "capital", dimension: "sku", filters: {}, transform: TRANSFORM_SONDA }); return (r && r.evidence) || null; },
};

/* ── builderOutFor(componentId, scenario) → la salida VIVA contra la que se deriva ese componente, o null ────── */
export function builderOutFor(componentId, scenario = ESCENARIO_INICIAL) {
  const clave = builderKeyOf(componentId);
  const fn = clave && _CORREDORES[clave];
  if (!fn) return null;
  const spec = SUPERFICIE_BUILDERS[clave] || null;
  const ent = spec && spec.entidadArg ? primeraEntidadDe(spec.entidadArg, scenario) : null;
  if (spec && spec.entidadArg && !ent) return null;
  try { return fn(scenario, ent); } catch { return null; }
}

/* ── builderOutsPorComponente(scenario) → { componentId: salida } para TODO el manifiesto ────────────────────
 * Lo que consumen los gates: un solo corredor por clave (el builder de una cara se corre UNA vez y lo comparten
 * sus quince piezas), y una entrada por componente declarado. */
export function builderOutsPorComponente(scenario = ESCENARIO_INICIAL) {
  const cache = new Map();
  const out = {};
  for (const id of Object.keys(VIEW_MANIFEST)) {
    const clave = builderKeyOf(id);
    if (!cache.has(clave)) cache.set(clave, builderOutFor(id, scenario));
    out[id] = cache.get(clave);
  }
  return out;
}

// las claves que este módulo sabe correr — el gate afirma que son EXACTAMENTE las declaradas en el manifiesto, así
// que una superficie nueva sin corredor (o un corredor sin superficie) sale roja en vez de quedar muda.
export function clavesCorribles() { return Object.keys(_CORREDORES).sort(); }
