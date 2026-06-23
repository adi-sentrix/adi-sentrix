/* === adi/composers/simulation.js ===
 * ADI conversacional extraído de 41cc33d8 · verbatim · solo imports agregados.
 * Capa de simulación determinista (B1a/B2a/B2b + Cortes 2/3). Cero cambio de cálculo. */
import { FEATURE_GROWTH_PROJECTION, FEATURE_PRICE_LEVER, FEATURE_LEVER_NO_SI } from "../../config/features.js";
import { SUPERFAMILIAS } from "../../data/catalogs.js";
import { clientesMargen } from "../../data/demoData.js";
import { skusMargen } from "../../data/skusMargen.js";
import { applyScenarioToClientesMargen, applyScenarioToSfamiliasMargen, deriveKpis } from "../../engine/scenarios.js";
import { detectClientInText, detectSkuInText } from "../detectors.js";
import { filterTextualSuggestions, normalizeText } from "../helpers.js";
import { deriveBusinessThesis, scanMechanisms } from "./thesis.js";
import { buildNarrativeSignalsForExecutiveAction } from "./executiveAction.js";

export function extractMarginSimulation(text, scenarioId) {
  const raw = text || "";
  // PASO 1 · detector de intención de margen (disjunto del legacy de pérdida)
  if (/\b(pierd\w*|perd\w*)\b/i.test(raw)) return null;        // pérdida → legacy (client_simulation_lose)
  const accionMejora = /(recuper|aument|mejor)\w*|\bsub[ieoíé]\w*|\bgan[aeáo]\w*/i.test(raw);
  const variableMargen = /margen|m[aá]rgenes|rentabilidad/i.test(raw);
  if (!(accionMejora && variableMargen)) return null;          // no es simulación de margen

  // PASO 2 · magnitud + unidad (taxonomía delta de B1a)
  const numMatch = raw.match(/(\d+(?:[.,]\d+)?)/);
  const magnitud = numMatch ? parseFloat(numMatch[1].replace(",", ".")) : null;
  const esPP = /\b\d+(?:[.,]\d+)?\s*(pp|puntos?|punto)\b/i.test(raw) || /puntos?\s+de\s+margen/i.test(raw);
  const esPct = /\b\d+(?:[.,]\d+)?\s*(%|por\s*ciento|porciento)/i.test(raw);
  // ambigüedad "%" en margen → precisión puntual (caso B · puntos/pp es el camino limpio)
  if (esPct && !esPP) {
    return { needsPrecision: true, question: "¿" + (magnitud || "X") + " puntos de margen (pp) o " + (magnitud || "X") + "% relativo?", options: ["puntos (pp)", "% relativo"] };
  }

  // PASO 3 · resolver alcance (cuenta nombrada O grupo erosionado · SIN default)
  let alcance = null;
  const cuenta = (typeof detectClientInText === "function") ? detectClientInText(raw) : null;
  if (cuenta) {
    alcance = [cuenta];                                        // a · cuenta nombrada
  } else if (/erosionad|que\s+pierden\s+margen|bajo\s+benchmark/i.test(raw)) {
    // b · grupo erosionado = entities del movimiento de carga que ADI narra (top3 commercial_erosion)
    //     DERIVADO en runtime · NO lista hardcodeada · NO el filtro crudo L4014
    const acts = (typeof buildNarrativeSignalsForExecutiveAction === "function")
      ? (buildNarrativeSignalsForExecutiveAction(scenarioId).actions || []) : [];
    const carga = acts.find(a => a.type === "commercial_load_renegotiation");
    if (carga && Array.isArray(carga.entities) && carga.entities.length) alcance = carga.entities.slice();
  }
  if (!alcance || !alcance.length) {
    // c · sin alcance → transform INCOMPLETO → pedir precisión de ALCANCE (NO default · firmado)
    return { needsPrecision: true, question: "¿En qué cuentas? Lider · el grupo erosionado · todas", options: ["una cuenta", "el grupo erosionado", "todas"] };
  }
  if (magnitud == null) {
    // alcance resuelto pero falta magnitud → precisión de magnitud
    return { needsPrecision: true, question: "¿Cuántos puntos de margen?", options: [] };
  }

  // PASO 4 · generar el override (forma B1a · marginErosion DELTA +)
  const marginDelta = +magnitud;                               // dirección POSITIVA (recuperar/subir/aumentar/mejorar)
  const clientes = {};
  for (const nombre of alcance) clientes[nombre] = { marginErosion: marginDelta };
  return { override: { clientes }, magnitud, unidad: "pp", alcance };
}
// ── SIMULATION LAYER · buildSimulationState / compareStates (B2a · comparador) ──────────
// buildSimulationState arma las 4 capas de un estado desde scenarioId + override (undefined = actual).
// compareStates es GENÉRICO: orquesta LAYER_SPECS auto-descriptivas · no conoce "margen" (primer pasajero).
// Materialidad asimétrica POR CAPA: métrica = umbral · tesis/prioridad/mecanismos = cualquier cambio.
const UMBRAL_MATERIALITY_MARGEN_PP = 0.5;   // pp · umbral de materialidad de la métrica de margen

export function buildSimulationState(scenarioId, override) {
  const sig = buildNarrativeSignalsForExecutiveAction(scenarioId, null, null, override);
  return {
    tesis:      deriveBusinessThesis(scenarioId, override),
    prioridad:  (sig && sig.actions) ? sig.actions : [],
    metrica:    deriveKpis(scenarioId, override),
    mecanismos: scanMechanisms(scenarioId, override),
  };
}

function _activeMechanisms(mecs) {
  return Object.keys(mecs || {}).filter(k => mecs[k] && mecs[k].triggered === true).sort();
}
export function compareStates(actual, simulado) {
  const LAYER_SPECS = [
    { tipo: "metrica",
      extrae: s => (s.metrica && s.metrica.margen) ? s.metrica.margen.pct : null,
      difiere: (a, b) => Math.abs((a || 0) - (b || 0)) > 1e-9,
      material: (a, b) => Math.abs((a || 0) - (b || 0)) >= UMBRAL_MATERIALITY_MARGEN_PP },
    { tipo: "tesis",
      extrae: s => ({ titular: s.tesis.titular, es_causal: s.tesis.es_causal, entities_clave: s.tesis.entities_clave }),
      difiere: (a, b) => JSON.stringify(a) !== JSON.stringify(b),
      material: (a, b) => JSON.stringify(a) !== JSON.stringify(b) },
    { tipo: "prioridad",
      extrae: s => (s.prioridad || []).map(a => a.type),
      difiere: (a, b) => JSON.stringify(a) !== JSON.stringify(b),
      material: (a, b) => JSON.stringify(a) !== JSON.stringify(b) },
    { tipo: "mecanismos",
      extrae: s => _activeMechanisms(s.mecanismos),
      difiere: (a, b) => JSON.stringify(a) !== JSON.stringify(b),
      material: (a, b) => JSON.stringify(a) !== JSON.stringify(b) },
  ];
  const result = {};
  for (const spec of LAYER_SPECS) {
    const va = spec.extrae(actual), vs = spec.extrae(simulado);
    const cambio = spec.difiere(va, vs);
    const entry = { tipo: spec.tipo, cambió: cambio, material: cambio ? spec.material(va, vs) : false, valorActual: va, valorSimulado: vs };
    if (spec.tipo === "mecanismos") {
      entry.persistentes = (va || []).filter(m => (vs || []).includes(m));   // activos en AMBOS estados (no-mudanza causal · B2b)
    }
    result[spec.tipo] = entry;
  }
  return result;
}
// ── composeSimulationDelta(simState, scenarioId) · VOZ DEL DELTA (B2b · culminación Nivel 2) ──
// Consume el diff de B2a (simulationDiffRef) y lo narra como asesor ejecutivo: qué cambió, por qué,
// qué mejora, qué NO toca. Descendente · grado 2 (explica, no dicta) · no-mudanza causal.
// REGLA CIFRA: la magnitud = delta de metrica.margen.totalUSD (simulado − actual) · NUNCA recoverable_K.
export function _mechanismPersistencePhrase(mechId) {
  const M = {
    customer_dependency_risk: "la dependencia sigue concentrada en las mismas cuentas",
    commercial_erosion: "la erosión de margen continúa, con menor intensidad",
    quality_of_growth_deterioration: "la calidad del crecimiento sigue presionada",
    trapped_capital: "el capital sigue inmovilizado",
    liquidity_compression: "la liquidez sigue comprimida",
  };
  return M[mechId] || null;
}

export function composeSimulationDelta(simState, scenarioId) {
  if (!simState || !simState.diff) return null;
  const diff = simState.diff;
  const override = simState.ov && simState.ov.override;
  const alcance = (simState.ov && simState.ov.alcance) || [];

  // REGLA CIFRA · delta = simulado.totalUSD − actual.totalUSD (recomputado · NO recoverable_K)
  const actual = deriveKpis(scenarioId);
  const simulado = deriveKpis(scenarioId, override);
  const deltaUSD = Math.round(simulado.margen.totalUSD - actual.margen.totalUSD);
  const pctActual = actual.margen.pct;
  const pctSim = simulado.margen.pct;

  // formateador de lista inline (fmtList es anidado · no accesible a módulo)
  const _fmtList = (arr) => !arr || !arr.length ? "las cuentas señaladas"
    : arr.length === 1 ? arr[0]
    : arr.slice(0, -1).join(", ") + " y " + arr[arr.length - 1];
  const cuentasTxt = _fmtList(alcance);

  // CASO PÉRDIDA (__remove__) · trade-off REAL leído del CÁLCULO (NO asumir el signo de la dependencia)
  if (simState.ov && simState.ov.tipo === "perdida") {
    const cuenta = simState.ov.cuenta || cuentasTxt;
    const costo = Math.abs(deltaUSD);
    let depFrase = "";
    let _reconcentra = false;          // BRIEF CONTRATO1 · ¿la pérdida reconcentra (cuenta chica) o reparte (cuenta grande)?
    let _simTopNames = [];             // BRIEF CONTRATO1 · cuentas que encabezan tras la pérdida (fuente única · scanMechanisms · NO recompute)
    try {
      const _depA = scanMechanisms(scenarioId).customer_dependency_risk;
      const _depS = scanMechanisms(scenarioId, override).customer_dependency_risk;
      const _tA = _depA && _depA.aggregate && _depA.aggregate.top3_participacion_pct;
      const _tS = _depS && _depS.aggregate && _depS.aggregate.top3_participacion_pct;
      _simTopNames = (_depS && _depS.aggregate && _depS.aggregate.top3_names) || [];
      if (_tA != null && _tS != null) {
        if (_tS < _tA - 1) {
          // PASO 2 enriquecido · nombrar las mayores TRAS la pérdida (paso 3 "el riesgo se reparte" byte-idéntico)
          depFrase = ` — tu dependencia bajaría (del ${Math.round(_tA)}% al ${Math.round(_tS)}% en las mayores, ahora ${_fmtList(_simTopNames)}), el riesgo se reparte`;
        } else {
          _reconcentra = true;
          const _rest = _simTopNames.slice(0, 2);
          depFrase = ` — y tu dependencia no baja: ${_rest.join(" y ")} pasarían a pesar aún más, el riesgo se reconcentra en menos cuentas`;
        }
      }
    } catch (e) { depFrase = ""; }
    const _tf = { dependencia: "la concentración en pocos clientes", erosion: "la erosión de margen", baja_calidad: "la calidad del crecimiento", capital: "el capital inmovilizado" };
    const tShift = diff.tesis.cambió
      ? ` Tu lectura del negocio se movería: el problema central pasaría de ${_tf[diff.tesis.valorActual.titular] || diff.tesis.valorActual.titular} a ${_tf[diff.tesis.valorSimulado.titular] || diff.tesis.valorSimulado.titular}.`
      : "";
    // PASO 5 · ABRIR EL SIGUIENTE NIVEL · derivado del diff · ADI empuja la continuidad (no la tironea el usuario).
    // GUARD honestidad: NO emite números · abre una línea REAL y seguible · "en cuánto tiempo" queda como
    // pregunta (no derivable · no se promete el número · solo se abre lo que ADI sí puede seguir).
    let _paso5 = "";
    if (diff.tesis.cambió) {
      _paso5 = ` Lo siguiente que miraría: qué cuentas de la cartera podrían absorber ese volumen y en cuánto tiempo se recuperaría la contribución.`;
    } else if (_reconcentra) {
      const _foco = _simTopNames[0] || cuenta;
      _paso5 = ` Lo siguiente que miraría: cuánto sube la exposición a ${_foco} y si conviene diversificar antes de que el riesgo se concentre más.`;
    }
    // BRIEF FORMATO · bloques (\n\n entre movimientos · wording VERBATIM · solo cambia el separador " "→"\n\n")
    const _lossB1 = `Perder ${cuenta} te costaría aproximadamente $${costo}K de contribución${depFrase}.`;
    return [_lossB1, tShift.replace(/^ +/, ""), _paso5.replace(/^ +/, "")].filter(Boolean).join("\n\n");
  }

  // PASO 1 · significancia narrativa (derivada del diff · NO hardcode)
  const significancia = diff.prioridad.cambió ? "ALTA"
    : (diff.tesis.cambió ? "MEDIA"
      : (diff.metrica.material ? "BAJA" : "NULA"));

  if (significancia === "NULA") {
    return "Esta acción no mueve nada relevante: el margen no cambia de forma material y tu lectura del negocio se mantiene.";
  }

  // MAGNITUD · la cifra de la simulación · descendente
  const signo = deltaUSD >= 0 ? "Recuperarías" : "Perderías";
  const magnitud = `${signo} aproximadamente $${Math.abs(deltaUSD)}K de contribución — el margen pasa de ${pctActual}% a ${pctSim}% en ${cuentasTxt}.`;

  if (significancia === "ALTA") {
    // liderar con el cambio de prioridad (no canónico · forma base · se sella en vivo cuando aparezca)
    const prioActual = (diff.prioridad.valorActual || [])[0];
    const prioSim = (diff.prioridad.valorSimulado || [])[0];
    return `Esto cambiaría tu decisión: el primer movimiento pasaría de ${prioActual} a ${prioSim}. ${magnitud}`;
  }
  if (significancia === "MEDIA") {
    // liderar con el cambio de tesis (no canónico · forma base)
    const tActual = diff.tesis.valorActual && diff.tesis.valorActual.titular;
    const tSim = diff.tesis.valorSimulado && diff.tesis.valorSimulado.titular;
    return `Tu lectura del negocio se movería: de ${tActual} a ${tSim}. ${magnitud} La prioridad, en cambio, no se mueve.`;
  }

  // BAJA (el canónico) · MAGNITUD + NO-MUDANZA CAUSAL + VEREDICTO
  const orden = ["customer_dependency_risk", "commercial_erosion", "quality_of_growth_deterioration", "trapped_capital", "liquidity_compression"];
  const persist = (diff.mecanismos.persistentes || []).slice()
    .sort((a, b) => orden.indexOf(a) - orden.indexOf(b));
  const frases = persist.map(_mechanismPersistencePhrase).filter(Boolean).slice(0, 2);
  const noMudanza = frases.length ? `Pero ${frases.join(", y ")}.` : "";
  const veredicto = "Por eso tu lectura del negocio y tu prioridad no cambian: esto mejora el número, no toca el problema de fondo.";
  // BRIEF FORMATO · bloques (\n\n entre movimientos · wording sellado VERBATIM · solo cambia el separador) +
  // P5 nuevo (abre el umbral · honesto · CUALITATIVO · sin número de cruce · igual que VOZ2)
  const _paso5Margen = "Lo siguiente que analizaría: cuánto debería reducirse la concentración de estas cuentas para que la prioridad cambie.";
  return [magnitud, noMudanza, veredicto, _paso5Margen].filter(Boolean).join("\n\n");
}
export function extractLossSimulation(text, scenarioId) {
  const raw = text || "";
  if (!/\b(pierd\w*|perd\w*|perder)\b/i.test(raw)) return null;        // intención de pérdida
  const cuenta = (typeof detectClientInText === "function") ? detectClientInText(raw) : null;
  if (!cuenta) return null;                                            // v1: requiere cuenta nombrada
  return { override: { clientes: { [cuenta]: { __remove__: true } } }, tipo: "perdida", cuenta };
}
// ════════════════════════════════════════════════════════════════════════════
// CORTE 2 · extractGrowthSimulation · hermana de extractMargin/LossSimulation.
// Detecta proyección top-line (crece/cae X%) para cliente o familia. Va DESPUÉS
// de margen y pérdida en el chain (excluye ambos). NO devuelve un override de
// compareStates: devuelve { growth: { scope, scopeType, pct, signo } } para el
// composer propio (Opción A). Sin alcance/magnitud → needsPrecision.
// ════════════════════════════════════════════════════════════════════════════
export function extractGrowthSimulation(text, scenarioId) {
  if (!FEATURE_GROWTH_PROJECTION) return null;
  const raw = text || "";
  // Excluir margen (→ extractMarginSimulation) y pérdida (→ extractLossSimulation).
  if (/margen|m[aá]rgenes|rentabilidad/i.test(raw)) return null;
  if (/\b(pierd\w*|perd\w*|perder)\b/i.test(raw)) return null;
  // CORTE 3 · guarda de precio: "sube/aumenta el precio" es palanca de precio, no
  // crecimiento de volumen. Gateada → con FEATURE_PRICE_LEVER OFF, growth se comporta
  // como en 2efdb9db (cazaría "aumenta el precio" como volumen).
  if (FEATURE_PRICE_LEVER && /\bprecios?\b/i.test(raw)) return null;
  // Contexto condicional.
  const norm = normalizeText(raw);
  const condicional = norm.startsWith("si ") || norm.includes(" si ")
    || norm.startsWith("que pasa si") || norm.startsWith("y si");
  // Verbo de crecimiento (+) o caída (−).
  const subeRe = /\b(crece\w*|crezca\w*|crecier\w*|aument\w*|sube\w*|suben\w*|subier\w*)\b/i;
  const caeRe  = /\b(cae|caen|caer\w*|caiga\w*|cayer\w*|baja\w*|bajen\w*|bajar\w*)\b/i;
  const esCae  = caeRe.test(raw);
  const esSube = subeRe.test(raw);
  if (!esSube && !esCae) return null;                 // no es growth top-line
  const signo = esCae ? -1 : 1;                       // caída explícita gana; sino crecimiento
  // MICRO-CORTE · magnitud parseada ANTES del guard. ON: prefiere número adyacente
  // a %/por ciento, excluyendo dígitos embebidos en tokens (códigos de SKU como
  // SAM-REF500L). OFF: parser viejo (byte-idéntico a 64204032).
  const numMatch = FEATURE_LEVER_NO_SI
    ? (raw.match(/(?<![A-Za-z])(\d+(?:[.,]\d+)?)\s*(?:%|por\s*ciento)/i)
       || raw.match(/(?<![A-Za-z0-9-])(\d+(?:[.,]\d+)?)(?![A-Za-z0-9-])/))
    : raw.match(/(\d+(?:[.,]\d+)?)/);
  const pct = numMatch ? parseFloat(numMatch[1].replace(",", ".")) : null;
  // MICRO-CORTE · disparo por magnitud (no por "si"). ON: con número dispara aunque
  // no haya "si"; sin número y sin "si" → null (cae al dive · no regresiona
  // descriptivos). OFF: exige condicional (comportamiento 64204032).
  if (FEATURE_LEVER_NO_SI) {
    if (pct == null && !condicional) return null;
  } else {
    if (!condicional) return null;
  }
  // Alcance: cliente (detectClientInText) o familia (SUPERFAMILIAS + alias del Corte 1).
  let scope = null, scopeType = null;
  const cli = (typeof detectClientInText === "function") ? detectClientInText(raw) : null;
  if (cli) { scope = cli; scopeType = "cliente"; }
  else {
    const _famAliases = { "Electrodomésticos": ["electro"], "Materiales de Construcción": ["construccion", "materiales"] };
    for (const fam of SUPERFAMILIAS.slice(1)) {
      const tokens = [normalizeText(fam), ...(_famAliases[fam] || [])];
      if (tokens.some(t => t && norm.includes(t))) { scope = fam; scopeType = "familia"; break; }
    }
  }
  if (!scope) return { needsPrecision: true, question: "¿De qué cliente o familia? (p. ej. Falabella · Línea Blanca)", options: [] };
  if (pct == null) return { needsPrecision: true, question: "¿Cuánto " + (signo < 0 ? "cae" : "crece") + "? (p. ej. 2%)", options: [] };
  return { growth: { scope, scopeType, pct, signo } };
}
// ════════════════════════════════════════════════════════════════════════════
// CORTE 2 · composeGrowthProjection · cálculo Opción A + voz del delta + supuesto.
// Fuente = funciones scenario-aware selladas (Corte 1) → reconcilia con el dive.
// Invariante: delta = round(contribución_actual × pct/100) × signo; proy = actual+delta.
// Familia "se expande por mundo-cliente" sin código extra: su contribución ya es
// Σ contribuciones de clientes (applyScenarioToSfamiliasMargen).
// ════════════════════════════════════════════════════════════════════════════
export function composeGrowthProjection(payload, scenarioId) {
  if (!FEATURE_GROWTH_PROJECTION || !payload || !payload.growth) return null;
  const { scope, scopeType, pct, signo } = payload.growth;
  let row = null;
  if (scopeType === "cliente") {
    row = applyScenarioToClientesMargen(scenarioId).find(c => c.nombre === scope);
  } else {
    row = applyScenarioToSfamiliasMargen(scenarioId).find(f => f.sfamilia === scope);
  }
  if (!row) return null;

  const contribActual = row.contribucion;
  // INVARIANTE del founder · exacto sobre la cifra actual del escenario.
  const deltaAporte = Math.round(contribActual * pct / 100) * signo;
  const contribProy = contribActual + deltaAporte;

  const fmt = (v) => "$" + Math.round(v).toLocaleString() + "K";   // formato del dive (Corte 1)
  const deltaAbs = Math.abs(deltaAporte);
  const verbo = signo < 0 ? "cae" : "crece";
  const dirVerbo = signo < 0 ? "baja" : "sube";
  const deltaTxt = (signo < 0 ? "\u2212" : "+") + fmt(deltaAbs);   // U+2212 minus para la caída

  const lines = [];
  lines.push(`Si ${scope} ${verbo} ${pct}%, su contribución ${dirVerbo} de ${fmt(contribActual)} a ${fmt(contribProy)} (${deltaTxt}).`);
  // Supuesto declarado · texto literal del founder.
  lines.push(`Modelo simple: crecimiento sobre la venta actual del escenario, manteniendo margen constante.`);

  return {
    opener: lines.join("\n\n"),
    suggestions: filterTextualSuggestions([]),
    derivedClient: scopeType === "cliente" ? scope : null,
    derivedFamily: scopeType === "familia" ? scope : null,
    derivedModule: "margenes",
  };
}
// ════════════════════════════════════════════════════════════════════════════
// CORTE 3 · _priceOrphanSkusForFamily · detección DINÁMICA de SKUs huérfanos.
// Un SKU es huérfano si su marca NO aparece en ninguna fila de clientesMargen
// (mundo-cliente). Hoy: marcas con cliente = {Samsung, LG, Philips, Bosch};
// Makita no → MAK-SAW18V, MAK-COMP-AIR huérfanos. NO hardcodeado.
// ════════════════════════════════════════════════════════════════════════════
function _priceOrphanSkusForFamily(familyName) {
  const brandsWithClient = new Set();
  for (const c of clientesMargen) { if (c.marca) brandsWithClient.add(c.marca); }
  const orphans = [];
  for (const s of skusMargen) {
    if (s.sfamilia === familyName && s.marca && !brandsWithClient.has(s.marca)) {
      orphans.push(s.nombre);
    }
  }
  return orphans;
}
// ════════════════════════════════════════════════════════════════════════════
// CORTE 3 · extractPriceSimulation · hermana de extractGrowthSimulation.
// REQUIERE "precio". Excluye margen y pérdida. Va DESPUÉS de growth en el chain
// (doble defensa: growth también excluye precio). Devuelve { price: {...} }, NO
// un override. Alcance: SKU > cliente > familia (el SKU es lo más específico).
// ════════════════════════════════════════════════════════════════════════════
export function extractPriceSimulation(text, scenarioId) {
  if (!FEATURE_PRICE_LEVER) return null;
  const raw = text || "";
  // REQUIERE precio. Excluye margen (→ margen sim) y pérdida (→ legacy).
  if (!/\bprecios?\b/i.test(raw)) return null;
  if (/margen|m[aá]rgenes|rentabilidad/i.test(raw)) return null;
  if (/\b(pierd\w*|perd\w*|perder)\b/i.test(raw)) return null;
  // Condicional.
  const norm = normalizeText(raw);
  const condicional = norm.startsWith("si ") || norm.includes(" si ")
    || norm.startsWith("que pasa si") || norm.startsWith("y si");
  // Verbo de precio: sube (↑) / baja (↓).
  const subeRe = /\b(sub\w*|aument\w*|increment\w*)\b/i;
  const bajaRe = /\b(baj\w*|reduc\w*|rebaj\w*|disminu\w*|recort\w*)\b/i;
  const esBaja = bajaRe.test(raw);
  const esSube = subeRe.test(raw);
  if (!esSube && !esBaja) return null;
  const signo = esBaja ? -1 : 1;
  // MICRO-CORTE · magnitud robusta ANTES del guard. ON: número adyacente a
  // %/por ciento o número suelto no embebido en token (evita el "500" de
  // SAM-REF500L). OFF: parser viejo (byte-idéntico a 64204032).
  const numMatch = FEATURE_LEVER_NO_SI
    ? (raw.match(/(?<![A-Za-z])(\d+(?:[.,]\d+)?)\s*(?:%|por\s*ciento)/i)
       || raw.match(/(?<![A-Za-z0-9-])(\d+(?:[.,]\d+)?)(?![A-Za-z0-9-])/))
    : raw.match(/(\d+(?:[.,]\d+)?)/);
  const pct = numMatch ? parseFloat(numMatch[1].replace(",", ".")) : null;
  // MICRO-CORTE · disparo por magnitud (no por "si"). ON: con número dispara sin
  // "si"; sin número y sin "si" → null (cae al dive). OFF: exige condicional.
  if (FEATURE_LEVER_NO_SI) {
    if (pct == null && !condicional) return null;
  } else {
    if (!condicional) return null;
  }
  // Alcance: SKU > cliente > familia.
  let scope = null, scopeType = null;
  const sku = (typeof detectSkuInText === "function") ? detectSkuInText(raw) : null;
  if (sku) { scope = sku; scopeType = "sku"; }
  else {
    const cli = (typeof detectClientInText === "function") ? detectClientInText(raw) : null;
    if (cli) { scope = cli; scopeType = "cliente"; }
    else {
      const _famAliases = { "Electrodomésticos": ["electro"], "Materiales de Construcción": ["construccion", "materiales"] };
      for (const fam of SUPERFAMILIAS.slice(1)) {
        const tokens = [normalizeText(fam), ...(_famAliases[fam] || [])];
        if (tokens.some(t => t && norm.includes(t))) { scope = fam; scopeType = "familia"; break; }
      }
    }
  }
  if (!scope) return { needsPrecision: true, question: "¿De qué SKU, cliente o familia? (p. ej. SAM-REF500L · Falabella · Línea Blanca)", options: [] };
  if (pct == null) return { needsPrecision: true, question: "¿Cuánto " + (signo < 0 ? "baja" : "sube") + " el precio? (p. ej. 2%)", options: [] };
  return { price: { scope, scopeType, pct, signo } };
}
// ════════════════════════════════════════════════════════════════════════════
// CORTE 3 · composePriceLever · cálculo §2 + caveat §3 + declaración huérfanos §5.
// Fuentes §4: SKU=skusMargen (estático), cliente/familia=scenario-aware sellada
// (familia=mundo-cliente, NO suma de SKUs → reconcilia con el dive del Corte 1).
// Invariante: Δ=round(venta×pct/100)×signo; venta_proy=round(venta×(1±pct/100));
// contrib_proy=contrib+Δ; margen_proy=contrib_proy/venta_proy.
// ════════════════════════════════════════════════════════════════════════════
export function composePriceLever(payload, scenarioId) {
  if (!FEATURE_PRICE_LEVER || !payload || !payload.price) return null;
  const { scope, scopeType, pct, signo } = payload.price;
  let row = null;
  if (scopeType === "sku") {
    row = skusMargen.find(s => s.nombre === scope);                          // estático (§4 · no scenario-aware)
  } else if (scopeType === "cliente") {
    row = applyScenarioToClientesMargen(scenarioId).find(c => c.nombre === scope);
  } else {
    row = applyScenarioToSfamiliasMargen(scenarioId).find(f => f.sfamilia === scope);  // mundo-cliente sellado
  }
  if (!row) return null;

  const ventaActual   = row.venta;
  const contribActual = row.contribucion;
  // INVARIANTE · precio +X% con volumen/costo/rebate constantes → toda la suba es margen.
  const deltaAporte = Math.round(ventaActual * pct / 100) * signo;
  const contribProy = contribActual + deltaAporte;
  const ventaProy   = Math.round(ventaActual * (1 + signo * pct / 100));
  const margenProy  = ventaProy > 0 ? Math.round((contribProy / ventaProy) * 1000) / 10 : 0;

  const fmt = (v) => "$" + Math.round(v).toLocaleString() + "K";            // formato del dive (Corte 1)
  const deltaAbs = Math.abs(deltaAporte);
  const verbo    = signo < 0 ? "bajás" : "subís";
  const dirVerbo = signo < 0 ? "baja"  : "sube";
  const deltaTxt = (signo < 0 ? "\u2212" : "+") + fmt(deltaAbs);            // U+2212 minus para la baja

  const lines = [];
  lines.push(`Si ${verbo} ${pct}% el precio de ${scope}, su contribución ${dirVerbo} de ${fmt(contribActual)} a ${fmt(contribProy)} (${deltaTxt}). Sobre una venta de ${fmt(ventaActual)} \u2192 ${fmt(ventaProy)}, el margen pasa a ${margenProy}%.`);
  // Caveat sellado · prominente (texto literal del founder).
  lines.push(`Esto es el techo bruto de la palanca: asume que no perdés volumen. En la práctica, una suba de precio puede reducir la cantidad vendida.`);
  // Familia con SKUs huérfanos → declaración (§5 · texto literal).
  if (scopeType === "familia") {
    const orphans = _priceOrphanSkusForFamily(scope);
    if (orphans.length) {
      lines.push(`${scope} se proyecta sobre la venta cliente sellada del escenario. Los SKUs ${orphans.join(" y ")} tienen venta de SKU pero no cliente asignado en este dataset; se pueden simular como SKU, pero no se incorporan al total de familia sin inventar relación.`);
    }
  }

  return {
    opener: lines.join("\n\n"),
    suggestions: filterTextualSuggestions([]),
    derivedSku: scopeType === "sku" ? scope : null,
    derivedClient: scopeType === "cliente" ? scope : null,
    derivedFamily: scopeType === "familia" ? scope : null,
    derivedModule: "margenes",
  };
}
