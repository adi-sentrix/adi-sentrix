/* === adi/composers/warehouse.js ===
 * ADI conversacional extraído de 41cc33d8 · verbatim · solo imports agregados.
 * Importa motor (engine/) + datos/config sellados. Cero cambio de cálculo. */
import { FEATURE_CMP_DOH_FIX, FEATURE_ENTITY_COMPARISON, FEATURE_WAREHOUSE_AS_ENTITY } from "../../config/features.js";
import { ADI_CAPITAL_DEF_CANONICA_ENABLED } from "../../config/voiceFlags.js";
import { SUCURSALES } from "../../data/catalogs.js";
import { clientesMargen, skuInventario } from "../../data/demoData.js";
import { applyScenarioToSkuInventario } from "../../engine/scenarios.js";
import { buildResponseContract, filterTextualSuggestions } from "../helpers.js";
import { simboloMoneda } from "../../config/moneda.js";
import { diagnoseInventarioSku } from "../diagnosis/economicDiagnosis.js";   // owner 2026-09-28 §7.3·30-32: "lentos" pasa a leer el estado real del motor (sobrestock), no el literal doh>60

/* RETIRO DE «L60» Y RENOMBRE DE «Def2» (owner 2026-09-28, §7.3·30-32, diseño §8.4/R3-R4):
 *   · «L60» (días sin venta > 60, fijo en el código) SE RETIRA como regla de ADI — nunca fue un criterio
 *     declarado, era un número escrito a mano. `ADI_CAPITAL_DEF_CANONICA_ENABLED` es `true` SIEMPRE (constante,
 *     no un flag de perfil) desde antes de esta etapa, así que las ramas que dependían de L60
 *     (`inmovilizadoUSD`/`inmovilizadoTotalCartera`, la rama `_capRealOn`/el fallback plano de `_valFor` y
 *     `_baseCartera`) eran código MUERTO — se retiran acá, no solo se renombran.
 *   · «Def2» (`alerta ∈ {crit,warn} ∨ rotación < 2`, `_capitalInmovilizado`/`inmovilizadoDef2USD`) SE CONSERVA
 *     —es una definición real, R3 del diseño— pero deja de llamarse «capital inmovilizado» en superficie: pasa a
 *     «Stock en alerta», el nombre que ya tiene en el resto de la casa desde 2026-08-10 (`cuadro.js`/`control.js`/
 *     `kpis.js`). El cálculo de `_capitalInmovilizado()` NO se toca acá (lo comparte `crossDomain.js`, fuera del
 *     alcance de esta etapa) — solo el TEXTO que este archivo arma con su resultado. */

export function composeWarehouseAnalysis(scenarioId, params) {
  // ── 1. Helpers formato
  const fmtK = (val) => {
    if (val == null || isNaN(val)) return "$0";
    if (Math.abs(val) >= 1000) {
      const k = val / 1000;
      return Number.isInteger(k) ? `${simboloMoneda()}${k}K` : `${simboloMoneda()}${k.toFixed(1)}K`;
    }
    return `${simboloMoneda()}${Math.round(val)}`;
  };
  const safeParams = params || {};
  const specificSucursal = safeParams.specificSucursal || null;

  // CORTE 4 · fuente única del inventario. ON → scenario-aware (reacciona en
  // tensión/crisis vía DOH/alerta; en bonanza === skuInventario). OFF → estático
  // (≡ 0f4d36ac). Se usa en las 5 referencias de abajo (incluido el closure).
  const _invSource = FEATURE_WAREHOUSE_AS_ENTITY
    ? applyScenarioToSkuInventario(scenarioId)
    : skuInventario;

  // ── 2. Agregación runtime por sucursal
  // Single source of truth: skuInventario.bodega field.
  function _aggregateBySucursal(sucursalName) {
    const skus = _invSource.filter(s => s.bodega === sucursalName);
    if (skus.length === 0) {
      return { sucursal: sucursalName, skus: [], totalStock: 0, dohPromedio: 0, sfamilias: {} };
    }
    const totalStock = skus.reduce((acc, s) => acc + s.stockUSD, 0);
    // FIX #D-CAPITAL-DEF-CANONICA · el «Stock en alerta» (Def 2: alerta crit/warn O rotación<2) por sucursal —
    // R3 del diseño de inventario: SE CONSERVA el cálculo, NUNCA se llama «inmovilizado» en superficie.
    const inmovilizadoDef2USD = skus
      .filter(s => s.alerta === "crit" || s.alerta === "warn" || s.rotacion < 2)
      .reduce((acc, s) => acc + s.stockUSD, 0);
    const dohPromedio = skus.reduce((acc, s) => acc + s.doh, 0) / skus.length;
    const sfamilias = {};
    skus.forEach(s => {
      if (!sfamilias[s.sfamilia]) sfamilias[s.sfamilia] = { count: 0, stockUSD: 0, dohSum: 0 };
      sfamilias[s.sfamilia].count++;
      sfamilias[s.sfamilia].stockUSD += s.stockUSD;
      sfamilias[s.sfamilia].dohSum += s.doh;
    });
    Object.values(sfamilias).forEach(f => { f.dohPromedio = f.dohSum / f.count; });
    return { sucursal: sucursalName, skus, totalStock, inmovilizadoDef2USD, dohPromedio: +dohPromedio.toFixed(0), sfamilias };
  }

  const stockTotalCartera = _invSource.reduce((acc, s) => acc + s.stockUSD, 0);
  // FIX #D-CAPITAL-DEF-CANONICA · las cifras canónicas (Def 2 + submétrica) vía el single source of truth.
  const _capCanon = _capitalInmovilizado(_invSource);
  const _capDefOn = (typeof ADI_CAPITAL_DEF_CANONICA_ENABLED !== "undefined" && ADI_CAPITAL_DEF_CANONICA_ENABLED);

  // ─────────────────────────────────────────────────────────────────────
  // CASO A · sucursal específica
  // ─────────────────────────────────────────────────────────────────────
  if (specificSucursal) {
    const agg = _aggregateBySucursal(specificSucursal);

    // Guard defensivo: si la sucursal no tiene SKUs en el dataset actual.
    if (agg.skus.length === 0) {
      const opener = `${specificSucursal} no registra SKUs activos en el dataset actual. Las 4 sucursales canónicas (${SUCURSALES.join(", ")}) tienen distribución desigual del inventario.`;
      return buildResponseContract({
        opener,
        // BRIEF N-bis · Tipo A puro · filtradas
        suggestions: filterTextualSuggestions(["¿Qué pasa en las bodegas?", "Cómo está la rotación", "Cuál es la cobertura"]),
        sentrixAction: {
          label: "Ver inventario por bodega",
          moduleChip: "Inventario",
          payload: { modulo: "inventario", clientes: [], skus: [], mechanismBanner: `Sucursal ${specificSucursal} sin SKUs` },
        },
        decision: null,
        evidence: { sucursal: specificSucursal, sku_count: 0 },
        focus: "warehouse_specific_empty",
        confidence: "alta",
        materialMetrics: [{ label: `0 SKUs en ${specificSucursal}`, source: "sucursal_empty_runtime" }],
        reasoningPattern: "warehouse_dive_analysis",
        suggestedNextActions: [{ type: "drill_all_warehouses" }],
      });
    }

    const pctCartera = ((agg.totalStock / stockTotalCartera) * 100).toFixed(1);

    // ── 3. EVIDENCIA · header
    // FIX #D-CAPITAL-DEF-CANONICA · distinguir inventario TOTAL de «Stock en alerta» (Def 2 — R3 del diseño de
    // inventario, owner 2026-09-28 §7.3·30-32: renombrado, NUNCA «capital inmovilizado»). `ADI_CAPITAL_DEF_CANONICA_ENABLED`
    // es una constante siempre `true`; el fallback plano (sin Def 2) queda como último recurso si algún día no lo fuera.
    const headerLine = (typeof ADI_CAPITAL_DEF_CANONICA_ENABLED !== "undefined" && ADI_CAPITAL_DEF_CANONICA_ENABLED)
      ? `${specificSucursal} concentra ${pctCartera}% del inventario total · ${agg.skus.length} SKUs activos · inventario ${fmtK(agg.totalStock)} · de eso, stock en alerta ${fmtK(agg.inmovilizadoDef2USD)} (SKUs críticos o rotación muy baja) · DOH promedio ${agg.dohPromedio} días.`
      : `${specificSucursal} concentra ${pctCartera}% del inventario total · ${agg.skus.length} SKUs activos · inventario ${fmtK(agg.totalStock)} · DOH promedio ${agg.dohPromedio} días.`;

    // ── 4. EVIDENCIA · top 3 sfamilia por stock
    const topFamilias = Object.entries(agg.sfamilias)
      .sort((a, b) => b[1].stockUSD - a[1].stockUSD)
      .slice(0, 3);
    const familiasLines = topFamilias.map(([name, f]) => {
      const pct = ((f.stockUSD / agg.totalStock) * 100).toFixed(0);
      return `${name.padEnd(34, " ")} → Stock ${fmtK(f.stockUSD)} · DOH ${Math.round(f.dohPromedio)}d · ${pct}% de la bodega`;
    }).join("\n");

    // ── 5. EVIDENCIA · top 3 SKUs por stockUSD
    const topSkus = [...agg.skus].sort((a, b) => b.stockUSD - a.stockUSD).slice(0, 3);
    const skusLines = topSkus.map(s =>
      `${s.sku.padEnd(14, " ")} → Stock ${fmtK(s.stockUSD)} · DOH ${s.doh}d · Rotación ${s.rotacion}x · ${s.diasSinVenta}d sin venta`
    ).join("\n");

    const evidencia = `${headerLine}\n\nComposición por familia:\n${familiasLines}\n\nTop 3 SKUs por capital:\n${skusLines}`;

    // ── 6. LECTURA causal
    const topFamiliaName = topFamilias[0] ? topFamilias[0][0] : null;
    const topFamiliaPct = topFamilias[0] ? ((topFamilias[0][1].stockUSD / agg.totalStock) * 100).toFixed(0) : "0";
    const topSku = topSkus[0];
    const promedioCartera = +(_invSource.reduce((s, x) => s + x.doh, 0) / _invSource.length).toFixed(0);
    const dohGap = agg.dohPromedio - promedioCartera;

    let lecturaCausal = "";
    if (topFamiliaName) {
      lecturaCausal = `${topFamiliaName} concentra ${topFamiliaPct}% del capital de ${specificSucursal}. ${topSku ? `${topSku.sku} es el SKU más pesado (${fmtK(topSku.stockUSD)}, DOH ${topSku.doh}d).` : ""}`;
      if (Math.abs(dohGap) > 10) {
        lecturaCausal += ` La cobertura está ${dohGap > 0 ? "por encima" : "por debajo"} del promedio cartera (${agg.dohPromedio}d vs ${promedioCartera}d).`;
      } else {
        lecturaCausal += ` La cobertura está alineada con el promedio cartera (${agg.dohPromedio}d vs ${promedioCartera}d).`;
      }
    }

    // ── 7. FOCO
    // «lentos» dejó de ser el literal `doh > 60` (owner 2026-09-28 §7.3·30-32, diseño §8.4/R6) — pasa a ser el
    // estado `sobrestock` del motor (`diagnoseInventarioSku`, el mismo detector que usa toda la casa).
    const lentos = agg.skus.filter(s => diagnoseInventarioSku(s) === "sobrestock").sort((a, b) => b.stockUSD - a.stockUSD);
    const rapidos = agg.skus.filter(s => s.rotacion >= 5).sort((a, b) => b.rotacion - a.rotacion);
    let focoText = "";
    if (lentos.length > 0) {
      const top = lentos[0];
      focoText = `Mecanismo disponible en ${specificSucursal}: ${top.sku} concentra capital atrapado (${fmtK(top.stockUSD)} · DOH ${top.doh}d · ${top.diasSinVenta}d sin venta) · zona donde la palanca de plan de salida opera.`;
      if (rapidos.length > 0) {
        focoText += ` En paralelo, ${rapidos[0].sku} opera con rotación ${rapidos[0].rotacion}x · zona estructuralmente sana en disponibilidad.`;
      }
    } else if (rapidos.length > 0) {
      focoText = `Estructura sana: ${specificSucursal} opera con SKUs rotacionales healthy (${rapidos[0].sku} ${rapidos[0].rotacion}x) · la disponibilidad operativa está dentro del rango natural.`;
    } else {
      focoText = `Estructura balanceada: ${specificSucursal} opera sin SKUs en estado crítico ni rotacionales destacados · la evolución mensual es la métrica de seguimiento natural.`;
    }

    const opener = `${evidencia}\n\n${lecturaCausal}\n\n${focoText}`;

    // ── 8. Suggestions + SentrixAction
    const allSkus = agg.skus.map(s => s.sku);
    const suggestions = [];
    if (lentos.length > 0) suggestions.push(`Cuánto recupero si liquido ${lentos[0].sku}`);
    if (rapidos.length > 0) suggestions.push(`Profundizar en ${rapidos[0].sku}`);
    suggestions.push(`Comparar ${specificSucursal} con otras bodegas`);
    while (suggestions.length < 3) suggestions.push("Qué SKUs sí están funcionando");

    const sentrixAction = {
      label: `Ver ${allSkus.length} SKUs en ${specificSucursal}`,
      moduleChip: "Inventario",
      payload: {
        modulo: "inventario",
        clientes: [],
        skus: allSkus,
        bodegas: [specificSucursal],
        mechanismBanner: `Inventario en ${specificSucursal}`,
      },
    };

    return buildResponseContract({
      opener,
      // BRIEF N-bis · Tipo A puro · suggestions filtradas
      suggestions: filterTextualSuggestions(suggestions.slice(0, 3)),
      sentrixAction,
      decision: topSku ? topSku.sku : null,
      evidence: {
        sucursal: specificSucursal,
        pct_cartera: +pctCartera,
        capital_sucursal_USD: agg.totalStock,
        doh_promedio_sucursal: agg.dohPromedio,
        sku_count: agg.skus.length,
        top_familia: topFamiliaName,
      },
      focus: "warehouse_specific",
      confidence: "alta",
      materialMetrics: [
        { label: `${pctCartera}% del inventario`, source: "sucursal_capital_share_runtime" },
        { label: `${agg.dohPromedio}d DOH promedio`, source: "sucursal_doh_promedio_runtime" },
        { label: `${fmtK(agg.totalStock)} capital`, source: "sucursal_capital_USD_runtime" },
        { label: topFamiliaName ? `${topFamiliaPct}% ${topFamiliaName}` : "sin top familia", source: "sucursal_top_familia_runtime" },
      ],
      reasoningPattern: "warehouse_dive_analysis",
      suggestedNextActions: [
        { type: "drill_slow_movers", sucursal: specificSucursal, sku: lentos[0] ? lentos[0].sku : null },
        { type: "protect_top_rotational", sucursal: specificSucursal, sku: rapidos[0] ? rapidos[0].sku : null },
        { type: "compare_warehouses", sucursal: specificSucursal },
      ],
    });
  }

  // ─────────────────────────────────────────────────────────────────────
  // CASO B · cold-start agregado de 4 sucursales
  // ─────────────────────────────────────────────────────────────────────
  const aggs = SUCURSALES.map(s => _aggregateBySucursal(s));
  const aggsConData = aggs.filter(a => a.skus.length > 0);
  // FIX #D-CAPITAL-DEF-CANONICA · el valor por sucursal según la def vigente: Def 2 («Stock en alerta») > total.
  // `_capRealOn`/`inmovilizadoUSD`/`inmovilizadoTotalCartera` (L60) SE RETIRARON (owner 2026-09-28, §7.3·30-32):
  // `_capDefOn` es una constante siempre `true`, así que esas ramas eran código muerto.
  const _valFor = (a) => _capDefOn ? a.inmovilizadoDef2USD : a.totalStock;
  const _baseCartera = _capDefOn ? (_capCanon.total || 1) : stockTotalCartera;
  const aggsRanked = [...aggsConData].sort((a, b) => _valFor(b) - _valFor(a));

  // ── 3. EVIDENCIA · header agregado
  // FIX #D-CAPITAL-DEF-CANONICA · cifra dual: Def 2 (stock en alerta) principal + submétrica >60d sub-lectura
  // (esa submétrica es el HECHO «stock sin venta por más de 60 días», descriptiva — no un veredicto de ADI).
  const headerLine = _capDefOn
    ? `El inventario total entre ${aggsConData.length} sucursales (${aggsConData.map(a => a.sucursal).join(", ")}) suma ${fmtK(stockTotalCartera)}. De eso, ${fmtK(_capCanon.total)} es stock en alerta (SKUs críticos o de rotación muy baja). De eso, ${fmtK(_capCanon.estricto60d)} corresponde a stock sin venta por más de 60 días. Distribución por bodega:`
    : `El inventario distribuido entre ${aggsConData.length} sucursales (${aggsConData.map(a => a.sucursal).join(", ")}) suma ${fmtK(stockTotalCartera)} totales.`;

  // ── 4. EVIDENCIA · ranking por stock en alerta (Def 2 canónica)
  const rankingLines = aggsRanked.map(a => {
    const _val = _valFor(a);
    const pct = ((_val / _baseCartera) * 100).toFixed(1);
    return `${a.sucursal.padEnd(13, " ")} → ${fmtK(_val)} · ${pct}% · DOH promedio ${a.dohPromedio}d · ${a.skus.length} SKUs`;
  }).join("\n");

  const evidencia = `${headerLine}\n\nRanking por stock en alerta:\n${rankingLines}`;

  // ── 5. LECTURA causal
  const top = aggsRanked[0];
  const bottom = aggsRanked[aggsRanked.length - 1];
  const _topVal = top ? _valFor(top) : 0;
  const _bottomVal = bottom ? _valFor(bottom) : 0;
  const _baseCausal = _baseCartera;
  const topPct = top ? ((_topVal / _baseCausal) * 100).toFixed(0) : "0";
  let lecturaCausal = "";
  if (top && bottom && top !== bottom && _topVal > 0) {
    const ratio = (_topVal / Math.max(_bottomVal, 1)).toFixed(1);
    lecturaCausal = _capDefOn
      ? `${top.sucursal} concentra ${topPct}% del stock en alerta, ${ratio}x lo que mantiene ${bottom.sucursal}.`
      : `${top.sucursal} concentra ${topPct}% del capital, ${ratio}x lo que mantiene ${bottom.sucursal}.`;
    // Detectar bodega con DOH crítico
    const dohCritica = aggsRanked.find(a => a.dohPromedio > 80);
    if (dohCritica) {
      lecturaCausal += ` ${dohCritica.sucursal} opera con cobertura más alta del portafolio (${dohCritica.dohPromedio}d promedio).`;
    }
  } else if (_capDefOn && top && _topVal > 0) {
    lecturaCausal = `${top.sucursal} concentra el stock en alerta del portafolio (${fmtK(_topVal)}).`;
  }

  // ── 6. FOCO
  const sucursalCritica = aggsRanked.find(a => a.dohPromedio > 80) || aggsRanked[0];
  const _critVal = sucursalCritica ? _valFor(sucursalCritica) : 0;
  const focoText = sucursalCritica
    ? (_capDefOn
        ? `Mecanismo disponible: ${sucursalCritica.sucursal} concentra mayor presión (${fmtK(_critVal)} en alerta · DOH ${sucursalCritica.dohPromedio}d) · zona estructural a profundizar antes que la palanca de redistribución o liquidación opere.`
        : `Mecanismo disponible: ${sucursalCritica.sucursal} concentra mayor presión (${fmtK(_critVal)} · DOH ${sucursalCritica.dohPromedio}d) · zona estructural a profundizar antes que la palanca de redistribución o liquidación opere.`)
    : `Estructura balanceada: la distribución opera dentro del rango healthy · la evolución mensual es la métrica de seguimiento natural.`;

  const opener = `${evidencia}\n\n${lecturaCausal}\n\n${focoText}`;

  // ── 7. Suggestions + SentrixAction
  const suggestions = [
    `Qué pasa en ${aggsRanked[0] ? aggsRanked[0].sucursal : "Santiago"}`,
    aggsRanked[1] ? `Qué pasa en ${aggsRanked[1].sucursal}` : "Cómo está la rotación",
    "Cuál es la cobertura del inventario",
  ];

  const allSkus = aggsConData.flatMap(a => a.skus.map(s => s.sku)).slice(0, 6);
  const sentrixAction = {
    label: `Ver ${aggsConData.length} sucursales`,
    moduleChip: "Inventario",
    payload: {
      modulo: "inventario",
      clientes: [],
      skus: allSkus,
      bodegas: aggsConData.map(a => a.sucursal),
      mechanismBanner: "Inventario por sucursal",
    },
  };

  return buildResponseContract({
    opener,
    // BRIEF N-bis · Tipo A puro · suggestions filtradas
    suggestions: filterTextualSuggestions(suggestions.slice(0, 3)),
    sentrixAction,
    decision: top ? top.sucursal : null,
    evidence: {
      sucursales_count: aggsConData.length,
      capital_total_USD: stockTotalCartera,
      top_sucursal: top ? top.sucursal : null,
      top_sucursal_pct: +topPct,
      sucursal_doh_critica: sucursalCritica && sucursalCritica.dohPromedio > 80 ? sucursalCritica.sucursal : null,
    },
    focus: "warehouse_distribution",
    confidence: "alta",
    materialMetrics: aggsRanked.slice(0, 4).map(a => ({
      label: `${a.sucursal} ${fmtK(a.totalStock)}`,
      source: `warehouse_${a.sucursal.toLowerCase()}_runtime`,
    })),
    reasoningPattern: "warehouse_dive_analysis",
    suggestedNextActions: [
      { type: "drill_top_warehouse", sucursal: top ? top.sucursal : null },
      { type: "drill_critical_doh", sucursal: sucursalCritica && sucursalCritica.dohPromedio > 80 ? sucursalCritica.sucursal : null },
      { type: "compare_distribution", count: aggsConData.length },
    ],
  });
}

export function composeWarehouseComparison(whA, whB, scenario) {
  const A = _warehouseInvAgg(scenario, whA), B = _warehouseInvAgg(scenario, whB);
  const dStock = A.totalStock - B.totalStock;
  const masGrande = A.totalStock >= B.totalStock ? whA : whB;
  const masSano = A.dohPromedio <= B.dohPromedio ? whA : whB;       // menor DOH = más sano
  // «Def 2» (R3 del diseño de inventario, owner 2026-09-28 §7.3·30-32) — SE CONSERVA el cálculo, se dice
  // «stock en alerta», NUNCA «capital inmovilizado» ni «capital atrapado» (esas palabras nombran el detector,
  // `capital_frenado` ⊎ sobrestock, otra definición).
  const masAtrapado = A.inmovilizadoDef2 >= B.inmovilizadoDef2 ? whA : whB;
  // MICRO-FIX FEATURE_CMP_DOH_FIX · el veredicto pega "con DOH crítico" a masAtrapado,
  // así que el umbral debe mirar el DOH PROPIO de masAtrapado, no el máximo de ambas.
  const masAtrapadoDoh = masAtrapado === whA ? A.dohPromedio : B.dohPromedio;
  const dohCritico = FEATURE_CMP_DOH_FIX
    ? (masAtrapadoDoh >= 80)
    : (Math.max(A.dohPromedio, B.dohPromedio) >= 80);
  const masLento = A.dohPromedio >= B.dohPromedio ? whA : whB;
  const lead = `${masGrande} más grande${masSano === masGrande ? " y más sano" : ""}; ${masAtrapado} con más stock en alerta.`;
  let opener = `**${whA} vs ${whB}** (inventario) · ${lead}\n\n`;
  opener += `Stock: ${_cmpFmtK(A.totalStock)} vs ${_cmpFmtK(B.totalStock)} (${masGrande} ${_cmpRatio(A.totalStock, B.totalStock).toFixed(1)}× · Δ ${_cmpSigned(dStock)}). Stock en alerta: ${_cmpFmtK(A.inmovilizadoDef2)} vs ${_cmpFmtK(B.inmovilizadoDef2)} (${masAtrapado} peor). DOH: ${A.dohPromedio} vs ${B.dohPromedio} días${Math.abs(A.dohPromedio - B.dohPromedio) >= 20 ? ` (${masLento} mucho más lento)` : ""}.\n\n`;
  opener += `Veredicto: ${masGrande} concentra más stock${masSano === masGrande ? " y rota mejor" : ""}; ${masAtrapado} tiene más stock en alerta${dohCritico ? " con DOH crítico" : ""}.`;
  return {
    opener,
    suggestions: filterTextualSuggestions([`Qué hay en ${whA}`, `Qué hay en ${whB}`, "Inventario por bodega"]),
    sentrixAction: { label: "Ver inventario", moduleChip: "Inventario", payload: { modulo: "inventario", clientes: [], skus: [] } },
    derivedModule: "inventario",
  };
}

export function _warehouseInvAgg(scenarioId, sucursal) {
  const inv = FEATURE_ENTITY_COMPARISON ? applyScenarioToSkuInventario(scenarioId) : skuInventario;
  const skus = inv.filter(s => s.bodega === sucursal);
  const brandsWithClient = new Set();
  for (const c of clientesMargen) { if (c.marca) brandsWithClient.add(c.marca); }
  const totalStock = skus.reduce((a, s) => a + s.stockUSD, 0);
  const inmovilizadoDef2 = skus.filter(s => s.alerta === "crit" || s.alerta === "warn" || s.rotacion < 2).reduce((a, s) => a + s.stockUSD, 0);
  const dohPromedio = skus.length ? +(skus.reduce((a, s) => a + s.doh, 0) / skus.length).toFixed(0) : 0;
  const famStock = {};
  for (const s of skus) famStock[s.sfamilia] = (famStock[s.sfamilia] || 0) + s.stockUSD;
  const topFamilias = Object.entries(famStock).sort((a, b) => b[1] - a[1]);
  const orphanSkus = skus.filter(s => s.marca && !brandsWithClient.has(s.marca));
  return { sucursal, totalStock, inmovilizadoDef2, dohPromedio, topFamilias, orphanSkus, skus };
}

export function _capitalInmovilizado(inventario) {
  const inv = Array.isArray(inventario) ? inventario : (typeof skuInventario !== "undefined" ? skuInventario : []);
  const skusCriticos = inv.filter(s => s.alerta === "crit" || s.alerta === "warn" || s.rotacion < 2);
  const skusSinVenta = inv.filter(s => s.diasSinVenta > 60);
  const total = skusCriticos.reduce((sum, s) => sum + s.stockUSD, 0);
  const estricto60d = skusSinVenta.reduce((sum, s) => sum + s.stockUSD, 0);
  return { total, estricto60d, skusCriticos, skusSinVenta };
}

export function _cmpFmtK(val) {
  if (val == null || isNaN(val)) return "$0";
  if (Math.abs(val) >= 1000) { const k = val / 1000; return Number.isInteger(k) ? `${simboloMoneda()}${k}K` : `${simboloMoneda()}${k.toFixed(1)}K`; }
  return `${simboloMoneda()}${Math.round(val)}`;
}

export function _cmpRatio(a, b) { if (!b) return 0; const r = a / b; return r >= 1 ? r : 1 / r; }

export function _cmpSigned(v) { return (v >= 0 ? "+" : "\u2212") + _cmpFmtK(Math.abs(v)); }
