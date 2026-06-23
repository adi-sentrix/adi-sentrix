/* === src/adi/composers/skuOperational.js ===
 * composeSkuOperationalAnalysis · extraído de 41cc33d8 (L22858) · verbatim.
 * Análisis de SKUs operacionales con capital atrapado (top4 críticos).
 * Expone narrative_signals kind="sku_operational_group" → la capa narrativa
 * (composeSkuOperationalNarrative) lo reescribe. Helpers de signals (L11476/L11482) verbatim. */
import { skuInventario } from "../../data/demoData.js";
import { filterTextualSuggestions } from "../helpers.js";
import { VOICE_NARRATIVE_LAYER_ENABLED } from "../../config/voiceFlags.js";

// ── classifySkuOperationalProfile · perfil individual del SKU (L11476) ────
// operational_inefficient · DOH > 90 ∧ rotación < 3 → driver activo · liquidar
// high_volume_healthy    · DOH ≤ 90 ∧ rotación ≥ 3 → stock alto pero saludable
// borderline             · cuadrantes mixtos
function classifySkuOperationalProfile(sku) {
  if (sku.doh > 90 && sku.rotacion < 3) return "operational_inefficient";
  if (sku.doh <= 90 && sku.rotacion >= 3) return "high_volume_healthy";
  return "borderline";
}

// ── buildNarrativeSignalsForSkuOperational (L11482) · top4 como grupo ─────
function buildNarrativeSignalsForSkuOperational(top4) {
  if (!Array.isArray(top4) || top4.length === 0) return null;
  // Clasificación por perfil (M.B.3 v2 · founder Caso E ajuste)
  const profiles = top4.map(s => ({
    sku: s.sku, marca: s.marca, sfamilia: s.sfamilia,
    stockUSD: s.stockUSD, doh: s.doh, rotacion: s.rotacion, alerta: s.alerta,
    profile: classifySkuOperationalProfile(s),
  }));
  const operationalCount = profiles.filter(p => p.profile === "operational_inefficient").length;
  const healthyCount = profiles.filter(p => p.profile === "high_volume_healthy").length;
  const borderlineCount = profiles.filter(p => p.profile === "borderline").length;

  // Pattern detection · 3 escenarios narrativos
  let pattern;
  if (operationalCount === top4.length) pattern = "all_operational";
  else if (operationalCount > 0 && healthyCount > 0) pattern = "mixed_operational_healthy";
  else pattern = "borderline_group";

  // Agregados · totales del grupo completo Y del subset operacional
  // Decisión founder Caso E: cifras agregadas SOLO sobre subset operacional
  // (no diluir el monto recuperable con SKUs que NO requieren intervención).
  const totalStockUSD = top4.reduce((s, k) => s + (k.stockUSD || 0), 0);
  const avgDoh = top4.reduce((s, k) => s + (k.doh || 0), 0) / top4.length;
  const operationalSubset = profiles.filter(p => p.profile === "operational_inefficient");
  const operationalStockUSD = operationalSubset.reduce((s, k) => s + (k.stockUSD || 0), 0);
  const operationalAvgDoh = operationalSubset.length > 0
    ? operationalSubset.reduce((s, k) => s + (k.doh || 0), 0) / operationalSubset.length
    : 0;
  const healthySubset = profiles.filter(p => p.profile === "high_volume_healthy");

  return {
    kind: "sku_operational_group",
    items: profiles,                         // todos los 4 con su profile tag
    operational_subset: operationalSubset,   // solo operacionales · para acción
    healthy_subset: healthySubset,           // solo saludables · para nota
    aggregate: {
      total_stockUSD: totalStockUSD,
      avg_doh: +avgDoh.toFixed(1),
      count: top4.length,
      // Subset operacional · cifras que importan para la acción
      operational_count: operationalCount,
      operational_stockUSD: operationalStockUSD,
      operational_avg_doh: +operationalAvgDoh.toFixed(1),
      healthy_count: healthyCount,
      borderline_count: borderlineCount,
    },
    pattern,
    reframe_key: "operational_inefficiency",
  };
}

export function composeSkuOperationalAnalysis(scenarioId) {
  // ── 1. Filtrar SKUs críticos (alerta crit/warn o estado ≠ Activo)
  //       ordenados por capital descendente
  const criticalSkus = skuInventario
    .filter(s => s.alerta === "crit" || s.alerta === "warn" || s.estado !== "Activo")
    .sort((a, b) => b.stockUSD - a.stockUSD);

  const top4 = criticalSkus.slice(0, 4);

  if (top4.length === 0) {
    return {
      opener: "El inventario opera dentro de rango óptimo en el escenario actual. No hay SKUs con capital atrapado relevante.",
      // BRIEF N-bis · Tipo A puro · filtradas
      suggestions: filterTextualSuggestions([
        "Cómo está la rotación general",
        "Qué SKUs sí están funcionando",
      ]),
      sentrixAction: null,
    };
  }

  // ── 2. Helper formato. fmtK omite decimal cuando es entero múltiplo de 1000.
  const fmtK = (val) => {
    if (val >= 1000) {
      const k = val / 1000;
      return Number.isInteger(k) ? `$${k}K` : `$${k.toFixed(1)}K`;
    }
    return `$${Math.round(val)}`;
  };

  // ── 3. Cálculos para Lectura causal
  const totalInventario = skuInventario.reduce((sum, s) => sum + s.stockUSD, 0);
  const capitalTop4 = top4.reduce((sum, s) => sum + s.stockUSD, 0);
  const pctCapitalTop4 = ((capitalTop4 / totalInventario) * 100).toFixed(0);

  // Categoría dominante en top 4
  const categoriasTop = {};
  top4.forEach(s => {
    categoriasTop[s.sfamilia] = (categoriasTop[s.sfamilia] || 0) + 1;
  });
  const catDominante = Object.entries(categoriasTop)
    .sort((a, b) => b[1] - a[1])[0];

  // Worst SKU = mayor combinación DOH × diasSinVenta (antigüedad + inmovilidad)
  const worstSku = [...top4].sort((a, b) =>
    (b.doh * (b.diasSinVenta || 1)) - (a.doh * (a.diasSinVenta || 1))
  )[0];

  // Segundo peor (diferente del worst) para palanca dual
  const secondWorst = [...top4]
    .filter(s => s.sku !== worstSku.sku)
    .sort((a, b) =>
      (b.doh * (b.diasSinVenta || 1)) - (a.doh * (a.diasSinVenta || 1))
    )[0] || top4[0];

  // SKUs rotacionales del portafolio para destino de reinversión
  const rotacionales = skuInventario
    .filter(s => s.rotacion >= 9)
    .sort((a, b) => b.rotacion - a.rotacion)
    .slice(0, 2)
    .map(s => s.sku);

  // ── 4. EVIDENCIA · ranking estructurado
  const rankingLines = top4.map(s =>
    `${s.sku.padEnd(15, " ")} → Stock ${fmtK(s.stockUSD)} | DOH ${s.doh}d | ${s.diasSinVenta} días sin venta | Rotación ${s.rotacion}x`
  ).join("\n");

  const m1 = `${top4.length} SKUs con mayor capital inmovilizado:\n\n${rankingLines}`;

  // ── 5. LECTURA · causal con cifras determinísticas del dataset
  const promedioRotacionTop = (top4.reduce((sum, s) => sum + s.rotacion, 0) / top4.length).toFixed(1);
  const pctWorst = ((worstSku.stockUSD / totalInventario) * 100).toFixed(1);

  let lecturaCausal = `Los ${top4.length} SKUs concentran ${fmtK(capitalTop4)} en capital comprometido, equivalente al ${pctCapitalTop4}% del inventario total (${fmtK(totalInventario)}). La rotación promedio del top crítico es ${promedioRotacionTop}x, muy por debajo del benchmark interno (>7x para SKUs rotacionales).`;

  if (catDominante && catDominante[1] >= 2) {
    lecturaCausal += ` ${catDominante[1]} de los ${top4.length} SKUs pertenecen a ${catDominante[0]}, mostrando un patrón estructural en esa categoría.`;
  }

  lecturaCausal += ` ${worstSku.sku} concentra la mayor exposición operativa: ${worstSku.diasSinVenta} días sin venta con stock equivalente al ${pctWorst}% del inventario total.`;

  const m2 = `${lecturaCausal}`;

  // ── 6. FOCO · acción accionable con SKUs específicos y destino de reinversión
  const capitalLiberable = worstSku.stockUSD + secondWorst.stockUSD;
  const rotacionalesText = rotacionales.length > 0
    ? ` (${rotacionales.join(", ")})`
    : "";

  const focoText = `Mecanismo disponible: ${worstSku.sku} y ${secondWorst.sku} concentran ${fmtK(capitalLiberable)} de capital con más de ${Math.min(worstSku.diasSinVenta, secondWorst.diasSinVenta || 0)} días sin venta · zona donde la palanca de liquidación libera reinversión hacia SKUs rotacionales del portafolio${rotacionalesText} (rotación sobre 9x).`;

  const m3 = `${focoText}`;

  // ── 7. Confianza
  const confianza = `*Confianza alta · cifras determinísticas sobre el inventario actual del escenario.*`;

  const opener = `${m1}\n\n${m2}\n\n${m3}\n\n${confianza}`;

  // ── 8. Suggestions accionables derivadas (entidades reales)
  const suggestions = [
    `Cuánto recupero si liquido ${worstSku.sku}`,
    `Profundizar en ${worstSku.sku}`,
    `Qué cliente compra ${worstSku.sku}`,
  ];

  // ── 9. Sentrix action · BRIEF #22 incluye skus específicos
  //       para que BRIEF #23 pueda consumirlos como filtro.
  const sentrixAction = {
    label: `Ver ${top4.length} SKUs críticos`,
    moduleChip: "Inventario",
    payload: {
      modulo: "inventario",
      clientes: [],
      skus: top4.map(s => s.sku),
      mechanismBanner: "Capital atrapado en SKUs críticos",
    },
  };

  // ── BRIEF M.B.3 · narrative_signals + posture_hint ──
  // Postura prioritize · grupo SKU operacional con capital atrapado.
  let narrative_signals = null;
  let posture_hint = "prioritize";
  if (VOICE_NARRATIVE_LAYER_ENABLED) {
    try {
      narrative_signals = buildNarrativeSignalsForSkuOperational(top4);
    } catch (sig_err) {
      // eslint-disable-next-line no-console
      console.warn("BRIEF M.B.3 sku operational narrative_signals error:", sig_err);
      narrative_signals = null;
    }
  }

  // BRIEF N-bis · Tipo A puro · suggestions filtradas en return
  return {
    opener,
    suggestions: filterTextualSuggestions(suggestions),
    sentrixAction,
    narrative_signals,
    posture_hint,
  };
}
