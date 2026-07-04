/* === adi/composers/mechanisms.js ===
 * ADI conversacional extraído de 41cc33d8 · verbatim · solo imports agregados.
 * Importa motor (engine/) + datos/config sellados. Cero cambio de cálculo. */
import { scanMechanisms } from "./thesis.js";
import { composeSentrixAction } from "./clientDive.js";
import { buildResponseContract, filterTextualSuggestions } from "../helpers.js";
import { _buildEntityId } from "../router.js";
import { MECHANISM_REGISTRY } from "../../config/mechanisms.js";
import { VOZ2_ENABLED, VOICE_NARRATIVE_LAYER_ENABLED } from "../../config/voiceFlags.js";
import { POLICY } from "../../config/businessPolicy.js";   // hardening · política de negocio · UNA fuente (byte-idéntico)

// ── r7_* formatters · copiados verbatim de 41cc33d8 (L19886-19901) ──
// Usados por composeCustomerDependencyRiskResponse (M y listInstances) y composeMechanismScan (K).
// Eran referencias libres no resueltas en la extracción previa → ReferenceError latente. Reparado.
function r7_formatCurrencyK(amount) {
  if (amount >= 1000) return `aproximadamente $${+(amount / 1000).toFixed(1)}M`;
  return `aproximadamente $${Math.round(amount)}K`;
}

function r7_formatCurrencyM(amountM) {
  return `$${amountM.toFixed(2)}M`;
}

function r7_listInstances(instances, maxNames = 3) {
  const names = instances.slice(0, maxNames).map(i => i.clientName);
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} y ${names[1]}`;
  const allButLast = names.slice(0, -1).join(", ");
  return `${allButLast} y ${names[names.length - 1]}`;
}

export function composeMechanismResponse(mechanismId, scenarioId) {
  const scan = scanMechanisms(scenarioId);
  const m = scan[mechanismId];

  if (!m || !m.triggered) {
    return composeMechanismInactiveResponse(mechanismId, scan);
  }

  if (mechanismId === "commercial_erosion") {
    return composeCommercialErosionResponse(m, scan, scenarioId);
  }
  if (mechanismId === "quality_of_growth_deterioration") {
    return composeQualityGrowthDeteriorationResponse(m, scan, scenarioId);
  }
  if (mechanismId === "customer_dependency_risk") {
    return composeCustomerDependencyRiskResponse(m, scan, scenarioId);
  }

  return composeMechanismInactiveResponse(mechanismId, scan);
}

export function composeCommercialErosionResponse(m, scan, scenarioId) {
  // BRIEF #22 · Estructura tripartita Evidencia + Lectura + Foco.
  // Preserva cifras determinísticas del aggregate (recuperable_total_K,
  // recuperable_at_target_3_5 por instance) y campos del dataset
  // (carga_pct, margen_pct, contribucion_M, ventas_M).
  const top3 = m.instances.slice(0, 3);
  const top_instance = top3[0];

  // ── Helpers formato (preservan R2 magnitud absoluta).
  // fmtK omite decimal cuando el valor es entero múltiplo de 1000.
  const fmtK = (val) => {
    if (val >= 1000) {
      const k = val / 1000;
      return Number.isInteger(k) ? `$${k}K` : `$${k.toFixed(1)}K`;
    }
    return `$${Math.round(val)}`;
  };
  const fmtM = (val) => `$${val.toFixed(2)}M`;

  // ── EVIDENCIA · ranking estructurado con cifras canónicas
  const rankingLines = top3.map(inst =>
    `${inst.clientName.padEnd(12, " ")} → Margen ${inst.margen_pct}% | Ventas ${fmtM(inst.ventas_M)} | Contribución ${fmtM(inst.contribucion_M)} | Carga ${inst.carga_pct}%`
  ).join("\n");

  const cuentasWord = top3.length === 1 ? "cuenta" : "cuentas";
  const evidencia = `${top3.length} ${cuentasWord} Tier 1 con margen bajo benchmark pero contribución alta:\n\n${rankingLines}`;

  // ── LECTURA · interpretación causal desde datos
  const totalContribTier = top3.reduce((sum, i) => sum + i.contribucion_M, 0);
  const pctSales = m.aggregate.pct_of_total_sales;
  const margenes = top3.map(i => i.margen_pct);
  const cargas = top3.map(i => i.carga_pct);
  const rangoMargen = margenes.length === 1
    ? `${margenes[0]}%`
    : `${Math.min(...margenes).toFixed(1)}% y ${Math.max(...margenes).toFixed(1)}%`;
  const rangoCarga = cargas.length === 1
    ? `${cargas[0]}%`
    : `${Math.min(...cargas).toFixed(1)}% y ${Math.max(...cargas).toFixed(1)}%`;
  const bestPractice = top_instance.bestPractice_pct || POLICY.bestPracticeCarga;

  const _voz2 = (typeof VOZ2_ENABLED !== "undefined" && VOZ2_ENABLED);
  const lectura = _voz2
    ? `Las ${top3.length} ${cuentasWord} aportan ${fmtM(totalContribTier)} al año (${pctSales}% de las ventas de la cartera), pero todas rinden por debajo del promedio de la cartera (${POLICY.benchmark}%). La diferencia se concentra en la carga comercial, que está entre ${rangoCarga} y por encima de lo sano internamente (${bestPractice}%). Cada punto adicional en esa carga reduce el aporte que la cuenta podría generar.`
    : `Las ${top3.length} ${cuentasWord} sostienen ${fmtM(totalContribTier)} anuales en contribución agregada (${pctSales}% del total de ventas cartera) pero operan con márgenes entre ${rangoMargen}, todos bajo el benchmark de cartera (${POLICY.benchmark}%). La presión sobre el margen unitario proviene de carga comercial alta (${rangoCarga}, sobre la mejor práctica interna de ${bestPractice}%). Cada punto de carga sobre la mejor práctica se traduce directamente en contribución que no se captura.`;

  // ── FOCO · acción accionable con cliente líder + recuperable
  // FIX (V_VISUAL 2026-07-03) · recuperable_at_target_3_5 viene en unidades K (= (pctRebate−target)/100 × ventas_K),
  // igual que recuperable_total_K → hay que ×1000 a USD antes de fmtK. Sin esto fmtK lo trata como <1000 y OMITE la "K"
  // ("$194" en vez de "$194K"). El comentario previo tenía la unidad al revés.
  const recuperablePalanca = top_instance.recuperable_at_target_3_5 * 1000;
  const recuperableTotalUSD = m.aggregate.recuperable_total_K * 1000;
  const otros = top3.slice(1).map(i => i.clientName).join(" y ");

  let focoText = `Mecanismo disponible: ${top_instance.clientName} concentra mayor materialidad (${fmtM(top_instance.contribucion_M)}) y mayor gap de carga (${top_instance.carga_pct}% vs ${POLICY.targetCarga}%) · la palanca de renegociación opera sobre ese cliente. Una reducción gradual desde ${top_instance.carga_pct}% hacia ${POLICY.targetCarga}% recuperaría aproximadamente ${fmtK(recuperablePalanca)} anuales sin afectar volumen presente.`;
  if (otros) {
    focoText += ` La misma lógica progresiva sobre ${otros} liberaría aproximadamente ${fmtK(recuperableTotalUSD)} agregados de contribución.`;
  }

  const foco = `${focoText}`;

  // ── Confianza
  const confianza = `*Confianza alta · las ${top3.length} instancias y la materialidad son determinísticas sobre el escenario activo.*`;

  const opener = `${evidencia}\n\n${lectura}\n\n${foco}\n\n${confianza}`;

  // ── Suggestions accionables (entidades reales)
  const suggestions = [
    `Cómo arranco la renegociación con ${top_instance.clientName}`,
    `Cuál es el impacto exacto de bajar carga 1pp`,
    `Profundizar en ${top_instance.clientName}`,
  ];

  // BRIEF #16 · acción Sentrix contextual (preservado)
  const sentrixAction = composeSentrixAction("mechanism_commercial_erosion", {
    instances: m.instances,
  });

  // BRIEF #26-quinquies-B · enriquecimiento con contrato v1.
  // Usa nombres REALES de campos del composer (clientName, contribucion_M,
  // carga_pct, recuperable_at_target_3_5, m.aggregate.recuperable_total_K).
  return buildResponseContract({
    opener,
    // BRIEF N-bis · Tipo A puro · suggestions filtradas
    suggestions: filterTextualSuggestions(suggestions),
    sentrixAction,
    decision: top_instance.clientName,
    evidence: {
      cliente_principal: top_instance.clientName,
      margen_pct: top_instance.margen_pct,
      benchmark_margen: POLICY.benchmark,
      carga_actual: top_instance.carga_pct,
      best_practice_carga: POLICY.targetCarga,
      gap_carga_pp: +(top_instance.carga_pct - POLICY.targetCarga).toFixed(1),
      contribucion_principal_M: top_instance.contribucion_M,
      recuperable_principal_USD: top_instance.recuperable_at_target_3_5,
      recuperable_agregado_K: m.aggregate.recuperable_total_K,
      top3_clientes: top3.map(t => t.clientName),
    },
    focus: `Palanca de carga comercial sobre ${top_instance.clientName}`,
    confidence: "alta",
    materialMetrics: [
      `${fmtK(top_instance.recuperable_at_target_3_5)} recuperable`,
      `${top_instance.carga_pct}% carga`,
      `${top_instance.margen_pct}% margen`,
    ],
    reasoningPattern: "high_sales_low_contribution_via_load",
    suggestedNextActions: [
      "Ver detalle del cliente principal",
      "Comparar contra cuentas virtuosas",
      "Simular impacto de bajar carga",
    ],
    // 🆕 AN+.FIX2 D-AN+.FIX2-2=A · clientList aditivo (paridad BRIEF #22 contrato preservado)
    // Habilita poblamiento lastClientList post-Q1 → AN.B Capa 4 ring poblado → AN+ dispara Q2.
    // IDs canónicos consumibles por AN.B + Evidence Sync Layer futura.
    clientList: top3.map(t => _buildEntityId("client", t.clientName)),
  });
}

export function composeQualityGrowthDeteriorationResponse(m, scan, scenarioId) {
  // BRIEF #22 · Estructura tripartita Evidencia + Lectura + Foco.
  // Quality instances tienen: clientName, ventas_M, crecimiento_pct,
  // crecimiento_M, margen_pct, benchmark_pct, gap_margen_pp,
  // contribucion_perdida_M. NO traen carga ni contribución absoluta
  // por cliente. Para enriquecer ranking con carga, hacemos
  // cross-lookup contra erosion instances (mismo cliente, mismo scan).
  // Para contribución absoluta usamos ventas_M × (margen_pct/100).
  const instances = m.instances;
  const top = instances.slice(0, Math.min(instances.length, 4));
  const top_instance = top[0];

  // ── Helpers formato. fmtK omite decimal cuando es entero múltiplo de 1000.
  const fmtK = (val) => {
    if (val >= 1000) {
      const k = val / 1000;
      return Number.isInteger(k) ? `$${k}K` : `$${k.toFixed(1)}K`;
    }
    return `$${Math.round(val)}`;
  };
  const fmtM = (val) => `$${val.toFixed(2)}M`;

  // ── Cross-lookup a erosion instances (si triggered) para enriquecer
  //    carga_pct + recuperable por cliente. NO inventa: usa data del scan.
  const erosionByClient = {};
  if (scan.commercial_erosion && scan.commercial_erosion.triggered) {
    scan.commercial_erosion.instances.forEach(ei => {
      erosionByClient[ei.clientName] = ei;
    });
  }

  // ── EVIDENCIA · ranking estructurado
  const rankingLines = top.map(inst => {
    // Contribución absoluta determinística: ventas_M × margen_pct/100
    const contribAbsoluta = inst.ventas_M * (inst.margen_pct / 100);
    const erosionMatch = erosionByClient[inst.clientName];
    const cargaText = erosionMatch ? ` | Carga ${erosionMatch.carga_pct}%` : "";
    const yoyStr = inst.crecimiento_pct > 0 ? `+${inst.crecimiento_pct}` : `${inst.crecimiento_pct}`;
    return `${inst.clientName.padEnd(12, " ")} → Ventas ${yoyStr}% YoY | Margen ${inst.margen_pct}%${cargaText} | Contribución ${fmtM(contribAbsoluta)}`;
  }).join("\n");

  const evidencia = `Clientes con crecimiento pero contribución bajo benchmark:\n\n${rankingLines}`;

  // ── LECTURA · interpretación causal
  const crec_min = m.aggregate.crecimiento_range.min;
  const crec_max = m.aggregate.crecimiento_range.max;
  const rangoYoY = crec_min === crec_max
    ? `+${crec_min}%`
    : `entre +${crec_min}% y +${crec_max}%`;
  const margenes = top.map(i => i.margen_pct);
  const rangoMargen = margenes.length === 1
    ? `${margenes[0]}%`
    : `${Math.min(...margenes).toFixed(1)}% y ${Math.max(...margenes).toFixed(1)}%`;
  const benchmark = top_instance.benchmark_pct || POLICY.benchmark;
  const totalRecuperable = m.aggregate.contribucion_perdida_M;
  const totalRecuperableStr = `$${Math.round(totalRecuperable * 1000)}K`;

  const cuentasWord = top.length === 1 ? "cuenta crece" : "cuentas crecen";

  const _voz2 = (typeof VOZ2_ENABLED !== "undefined" && VOZ2_ENABLED);
  const lectura = _voz2
    ? `Las ${top.length} ${cuentasWord} ${rangoYoY}, pero ese crecimiento rinde poco: sus márgenes operan entre ${rangoMargen}, todos por debajo del promedio de la cartera (${benchmark}%). Venden más, pero ese crecimiento no se transforma en aporte al mismo ritmo — alrededor de ${totalRecuperableStr} anuales de contribución no llega a capturarse.`
    : `Las ${top.length} ${cuentasWord} ${rangoYoY} pero capturan ese crecimiento a costa de margen unitario. Sus márgenes operan entre ${rangoMargen}, todos bajo el benchmark de cartera (${benchmark}%). El crecimiento es estructuralmente diluido: el volumen incremental no convierte a contribución al mismo ritmo. Aproximadamente ${totalRecuperableStr} anuales de contribución se pierden por este mecanismo.`;

  // ── FOCO · cliente líder con materialidad y recuperable
  const erosionLider = erosionByClient[top_instance.clientName];
  const lider_contribAbs = top_instance.ventas_M * (top_instance.margen_pct / 100);

  let focoText;
  if (erosionLider) {
    // Si el líder también está en erosion, tenemos carga y recuperable
    const recuperableLider = erosionLider.recuperable_at_target_3_5;
    focoText = `Mecanismo disponible: ${top_instance.clientName} combina mayor materialidad de cartera (${fmtM(lider_contribAbs)} de contribución) y mayor controlabilidad operativa (carga comercial ${erosionLider.carga_pct}%) · zona donde la palanca tiene mayor impacto cuantificable. Una reducción gradual desde ${erosionLider.carga_pct}% hacia ${POLICY.targetCarga}% recuperaría aproximadamente ${fmtK(recuperableLider)} anuales sin sacrificar volumen presente.`;
  } else {
    // Sin datos de carga · foco basado en materialidad y deterioro de margen
    const contribPerdida = top_instance.contribucion_perdida_M;
    const contribPerdidaStr = `$${Math.round(contribPerdida * 1000)}K`;
    focoText = `Mecanismo disponible: ${top_instance.clientName} concentra mayor materialidad (${fmtM(lider_contribAbs)} de contribución) y mayor gap vs benchmark (${top_instance.gap_margen_pp}pp) · cuantifica zona donde el cierre de gap recuperaría aproximadamente ${contribPerdidaStr} anuales.`;
  }

  const foco = `${focoText}`;

  // ── Confianza
  const confianza = `*Confianza alta · la relación crecimiento-margen es observable en el escenario activo.*`;

  const opener = `${evidencia}\n\n${lectura}\n\n${foco}\n\n${confianza}`;

  // ── Suggestions accionables (entidades reales)
  const suggestions = [
    `Cómo arranco la renegociación con ${top_instance.clientName}`,
    `Qué pasa si bajo carga de ${top_instance.clientName} 1pp`,
    `Profundizar en ${top_instance.clientName}`,
  ];

  // BRIEF #16 · acción Sentrix contextual (preservado)
  const sentrixAction = composeSentrixAction("mechanism_quality_growth", {
    instances: m.instances,
  });

  // BRIEF N-bis · Tipo A puro · suggestions filtradas en return
  // 🆕 AN+.FIX2 D-AN+.FIX2-2=A · clientList aditivo (shape distinto: variable `top` no `top3`)
  // Quality growth usa top = instances.slice(0, Math.min(instances.length, 4)) · objetos con .clientName
  return {
    opener,
    suggestions: filterTextualSuggestions(suggestions),
    sentrixAction,
    clientList: top.map(t => _buildEntityId("client", t.clientName)),
  };
}

export function composeCustomerDependencyRiskResponse(m, scan, scenarioId) {
  const top3_names = m.aggregate.top3_names;
  const top3_participacion = m.aggregate.top3_participacion_pct;
  const top3_contribucion = m.aggregate.top3_contribucion_M;
  const namesList = r7_listInstances(top3_names.map(n => ({ clientName: n })));

  const M1 = `El riesgo de dependencia se concentra en ${namesList}. Los tres concentran ${top3_participacion}% de las ventas y ${r7_formatCurrencyM(top3_contribucion)} de contribución.`;

  const _voz2dep = (typeof VOZ2_ENABLED !== "undefined" && VOZ2_ENABLED);
  const M2 = _voz2dep
    ? `Cuando pocas cuentas concentran buena parte de la cartera, perder cualquiera golpea fuerte y reemplazarla cuesta.`
    : `La dependencia aumenta cuando pocas cuentas concentran proporción mayor de la cartera. Cualquier pérdida estructural sobre estas cuentas tiene impacto desproporcionado, y la capacidad de reemplazo se vuelve crítica.`;

  const M3 = _voz2dep
    ? `Las tres comparten el mismo perfil: pesan mucho, rinden por debajo del promedio y sostienen carga comercial alta. Reemplazarlas exige reconstruir simultáneamente volumen, margen y mecanismo comercial.`
    : `Las tres cuentas operan con el mismo patrón estructural: alta participación, margen bajo benchmark, carga comercial sostenida. La dependencia no es solo de volumen: es del modelo comercial actual que estas cuentas absorben. Reemplazarlas exige reconstruir simultáneamente volumen, margen y mecanismo comercial.`;

  const M4 = `La palanca prioritaria es diversificación proactiva de Tier 2 mientras los Tier 1 siguen activos. El objetivo no es reemplazar volumen, es construir capacidad comercial alternativa con perfil de margen sano antes de que la salida sea forzada.`;

  const confianza = `*Confianza alta · la cuantificación de exposición es determinística sobre el escenario activo.*`;

  const opener = [M1, M2, M3, M4, confianza].join("\n\n");

  const suggestions = [
    `Qué pasa si pierdo a los tres simultáneamente`,
    `Cómo arranco la diversificación de Tier 2`,
    `Qué cuentas Tier 2 tienen mayor potencial`,
  ];

  // BRIEF #16 · acción Sentrix contextual
  const sentrixAction = composeSentrixAction("mechanism_dependency_risk", {
    top3_names: m.aggregate.top3_names,
  });

  // BRIEF N-bis · Tipo A puro · suggestions filtradas en return
  // 🆕 AN+.FIX2 D-AN+.FIX2-2=A · clientList aditivo (shape distinto: top3_names son STRINGS directos)
  // NO usar .clientName · top3_names viene de m.aggregate.top3_names ya como array de strings.
  return {
    opener,
    suggestions: filterTextualSuggestions(suggestions),
    sentrixAction,
    clientList: top3_names.map(name => _buildEntityId("client", name)),
  };
}

export function composeMechanismInactiveResponse(mechanismId, scan) {
  const mech = MECHANISM_REGISTRY[mechanismId];

  let mensaje = "";
  if (mechanismId === "trapped_capital") {
    mensaje = `${mech.nombre_capitalizado} no se evalúa con precisión cuantitativa sin drilldown por categoría de inventario. La lectura agregada del módulo sugiere presión, pero la confirmación causal requiere desglose por categoría que no está disponible en el escenario actual.`;
  } else if (mechanismId === "liquidity_compression") {
    mensaje = `${mech.nombre_capitalizado} no se manifiesta materialmente en el escenario activo. El flujo de caja se sostiene en los rangos esperados.`;
  } else {
    mensaje = `${mech.nombre_capitalizado} no presenta instancias activas en el escenario actual.`;
  }

  const opener = `${mensaje}\n\n*Confianza ${mechanismId === "trapped_capital" ? "media" : "alta"}.*`;

  return { opener, suggestions: [] };
}

// ── MECHANISM_NARRATIVE_RULES · copiado verbatim de 41cc33d8 (L10923-10994) ──
// Data pura · consumida por buildNarrativeSignalsForMechanismScan (abajo).
// No tenía export previo en src/ → copiado module-local (no exportado).
const MECHANISM_NARRATIVE_RULES = {
  commercial_erosion: {
    label: "Erosión comercial",
    nature: "raíz",                    // raíz · derivado · estructural
    controllability: "alta",            // alta · media · baja
    horizon: "inmediato",               // inmediato (3-6m) · medio (6-12m) · largo (12-18m)
    reframe_key: "internal_commercial_load",
    severity_signal: (m) => "critica",  // siempre crítica si activo
    // extractor para narrativa scan
    headline: (m) => {
      const recK = m.aggregate.recuperable_total_K || 0;
      const recM_bp = m.aggregate.recuperable_total_M_at_3_0 || 0;
      const top3 = m.instances.slice(0, 3).map(i => i.clientName);
      return {
        recoverable_K: recK,
        recoverable_M_at_bestPractice: recM_bp,
        instances_count: m.instances.length,
        top3_names: top3,
      };
    },
  },
  quality_of_growth_deterioration: {
    label: "Deterioro de calidad de crecimiento",
    nature: "derivado",
    derived_from: "commercial_erosion",
    controllability: "media",
    horizon: "medio",
    reframe_key: "quality_growth_derived",
    severity_signal: () => "atencion",
    headline: (m) => ({
      contribPerdida_M: m.aggregate.contribucion_perdida_M || 0,
      instances_count: m.instances.length,
      crecimiento_range: m.aggregate.crecimiento_range,
    }),
  },
  customer_dependency_risk: {
    label: "Riesgo de dependencia de cliente",
    nature: "estructural",
    controllability: "baja",
    horizon: "largo",
    reframe_key: "structural_dependency",
    severity_signal: () => "atencion",
    headline: (m) => ({
      top3_names: m.aggregate.top3_names || [],
      top3_participacion_pct: m.aggregate.top3_participacion_pct || 0,
      top3_contribucion_M: m.aggregate.top3_contribucion_M || 0,
    }),
  },
  trapped_capital: {
    label: "Capital atrapado",
    nature: "raíz",
    controllability: "alta",
    horizon: "inmediato",
    reframe_key: "operational_inefficiency",
    severity_signal: () => "atencion",
    headline: (m) => ({
      // placeholder · scanMechanisms hoy retorna false en bonanza
      instances_count: m.instances?.length || 0,
    }),
  },
  liquidity_compression: {
    label: "Compresión de liquidez",
    nature: "estructural",
    controllability: "media",
    horizon: "medio",
    reframe_key: "structural_dependency",  // re-uso temporal · founder puede definir nuevo
    severity_signal: () => "atencion",
    headline: (m) => ({
      instances_count: m.instances?.length || 0,
    }),
  },
};

// ── buildNarrativeSignalsForMechanismScan · copiado verbatim de 41cc33d8 (L11000-11052) ──
// Module-local (no exportado) · invocado por composeMechanismScan.
function buildNarrativeSignalsForMechanismScan(scan) {
  if (!scan || typeof scan !== "object") return null;
  const activos = [];
  const inactivos = [];
  for (const [id, m] of Object.entries(scan)) {
    if (m.triggered) activos.push({ id, m });
    else inactivos.push({ id, m });
  }
  if (activos.length === 0) return null;

  // Orden canónico: raíces primero · derivados después · estructurales al final
  const orderByNature = { "raíz": 0, "derivado": 1, "estructural": 2 };
  activos.sort((a, b) => {
    const na = orderByNature[MECHANISM_NARRATIVE_RULES[a.id]?.nature || "raíz"];
    const nb = orderByNature[MECHANISM_NARRATIVE_RULES[b.id]?.nature || "raíz"];
    return na - nb;
  });

  // Detectar pattern · ¿hay derivados que apuntan a raíces activas?
  // Si sí · narrativa puede decir "X deriva de Y" (causalidad)
  const hasDerivedFromRoot = activos.some(({ id }) => {
    const rule = MECHANISM_NARRATIVE_RULES[id];
    if (!rule || rule.nature !== "derivado") return false;
    const rootId = rule.derived_from;
    return rootId && activos.some(a => a.id === rootId);
  });

  // Construir hierarchy con narrative chunks por mecanismo
  const hierarchy = activos.map(({ id, m }) => {
    const rule = MECHANISM_NARRATIVE_RULES[id] || {};
    return {
      mechanismId: id,
      label: rule.label || m.nombre,
      nature: rule.nature || "raíz",
      controllability: rule.controllability || "media",
      horizon: rule.horizon || "medio",
      derived_from: rule.derived_from || null,
      severity: rule.severity_signal ? rule.severity_signal(m) : "atencion",
      headline: rule.headline ? rule.headline(m) : {},
      reframe_key: rule.reframe_key || null,
    };
  });

  return {
    kind: "mechanism_scan",
    hierarchy,
    activos_count: activos.length,
    inactivos_count: inactivos.length,
    inactivos_names: inactivos.map(({ m }) => m.nombre),
    has_derived_from_root: hasDerivedFromRoot,
    // posture: prioritize · siempre para mechanism_scan
  };
}

// ── composeMechanismScan · copiado verbatim de 41cc33d8 (L24778-24881) · solo `export` agregado ──
export function composeMechanismScan(scenarioId) {
  const scan = scanMechanisms(scenarioId);

  const activos = [];
  const inactivos = [];

  for (const [mechanismId, m] of Object.entries(scan)) {
    if (m.triggered) {
      activos.push({ mechanismId, m });
    } else {
      inactivos.push({ mechanismId, m });
    }
  }

  activos.sort((a, b) => {
    const order = ["commercial_erosion", "quality_of_growth_deterioration", "customer_dependency_risk"];
    return order.indexOf(a.mechanismId) - order.indexOf(b.mechanismId);
  });

  let opener = `La cartera presenta ${activos.length} mecanismos activos y ${inactivos.length} inactivos en el escenario actual.`;

  for (const { mechanismId, m } of activos) {
    let parrafo = "";

    if (mechanismId === "commercial_erosion") {
      const top3 = m.instances.slice(0, 3);
      const namesList = r7_listInstances(top3);
      const recuperable_str = r7_formatCurrencyK(m.aggregate.recuperable_total_K);
      parrafo = `**Erosión comercial** concentra la mayor oportunidad recuperable: ${recuperable_str} anuales sobre ${top3.length} cuentas con presión activa (${namesList}). Es el mecanismo de mayor controlabilidad operativa: las ${top3.length} operan con carga sobre la mejor práctica interna · palanca comercial disponible con horizonte inmediato.`;
    }

    if (mechanismId === "quality_of_growth_deterioration") {
      const crec_min = m.aggregate.crecimiento_range.min;
      const crec_max = m.aggregate.crecimiento_range.max;
      const contrib_perdida = m.aggregate.contribucion_perdida_M;
      const contrib_perdida_str = `aproximadamente $${Math.round(contrib_perdida * 1000)}K`;

      // BRIEF #15-bis · FIX 2 y 3 · idem composeQualityGrowthDeteriorationResponse
      const cuentasWord_s = m.instances.length === 1 ? "cuenta" : "cuentas";
      const cuentasLabel_s = `${m.instances.length} ${cuentasWord_s}`;
      const rangoCrecimiento_s = crec_min === crec_max
        ? `+${crec_min}%`
        : `entre +${crec_min}% y +${crec_max}%`;
      const verboPlur_s = m.instances.length === 1 ? "" : "n";

      parrafo = `**Deterioro de calidad de crecimiento** opera sobre ${cuentasLabel_s} que crece${verboPlur_s} ${rangoCrecimiento_s} pero captura${verboPlur_s} ese crecimiento a costa de margen unitario. Equivale a ${contrib_perdida_str} anuales de contribución que se pierden respecto al estándar del benchmark. Es derivado de erosión comercial: la carga sostenida es la causa.`;
    }

    if (mechanismId === "customer_dependency_risk") {
      const top3_names = m.aggregate.top3_names;
      const top3_participacion = m.aggregate.top3_participacion_pct;
      const top3_contribucion = m.aggregate.top3_contribucion_M;
      const namesList = r7_listInstances(top3_names.map(n => ({ clientName: n })));
      parrafo = `**Riesgo de dependencia de cliente** es estructural: ${namesList} concentran ${top3_participacion}% de las ventas y ${r7_formatCurrencyM(top3_contribucion)} de contribución. Una salida simultánea representaría la pérdida de aproximadamente la mitad de la rentabilidad operativa. Mecanismo de horizonte largo · la palanca de diversificación opera sobre cuentas Tier 2.`;
    }

    opener += "\n\n" + parrafo;
  }

  if (inactivos.length > 0) {
    const inactivosNombres = inactivos.map(({ m }) => `**${m.nombre}**`);
    let inactivosTxt = "Los mecanismos inactivos son ";
    if (inactivosNombres.length === 1) {
      inactivosTxt += inactivosNombres[0] + ".";
    } else {
      inactivosTxt += inactivosNombres.slice(0, -1).join(", ") + " y " + inactivosNombres[inactivosNombres.length - 1] + ".";
    }

    if (scan.trapped_capital && !scan.trapped_capital.triggered) {
      inactivosTxt += ` Capital atrapado requiere drilldown por categoría de inventario para evaluación cuantitativa precisa.`;
    }

    opener += "\n\n" + inactivosTxt;
  }

  opener += `\n\n*Confianza alta · mecanismos activos con cifras determinísticas del escenario.*`;

  const suggestions = activos.length > 0 ? [
    `Profundizar en ${activos[0].m.nombre}`,
    `Cuál es el mecanismo más caro`,
    `Qué pasa si intervengo en una sola palanca`,
  ] : [];

  // ── BRIEF M.B.2 · narrative_signals + posture_hint ──
  // Bajo flag OFF · narrative_signals queda null · output bitwise equivalente.
  let narrative_signals = null;
  let posture_hint = "prioritize";
  if (VOICE_NARRATIVE_LAYER_ENABLED) {
    try {
      narrative_signals = buildNarrativeSignalsForMechanismScan(scan);
    } catch (sig_err) {
      // eslint-disable-next-line no-console
      console.warn("BRIEF M.B.2 mechanism scan narrative_signals error:", sig_err);
      narrative_signals = null;
    }
  }

  return {
    opener,
    suggestions,
    narrative_signals,
    posture_hint,
  };
}
