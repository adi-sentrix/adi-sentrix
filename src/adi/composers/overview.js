/* === adi/composers/overview.js ===
 * ADI conversacional extraído de 41cc33d8 · verbatim · solo imports agregados.
 * Importa motor (engine/) + datos/config sellados. Cero cambio de cálculo. */
import { ADI_MARGIN_BENCHMARK_GAP_FIX_ENABLED, VOICE_C32_EVIDENCE_ENABLED, ADI_MT_INV_COVERAGE_ENABLED, ADI_QI_FILTER_ENABLED } from "../../config/voiceFlags.js";
import { isAvailable, unavailableMessage } from "../core/availabilityMap.js";  // ADI Core · 2.2a-2 parte B · cierre semántico del overview de inventario
import { clientesMargen } from "../../data/demoData.js";
import { getInvKPI, getMargenKPI, getVentasKPI } from "../../engine/metrics.js";
import { applyScenarioToClientesVentas, applyScenarioToSkuInventario } from "../../engine/scenarios.js";
import { filterTextualSuggestions } from "../helpers.js";

export function composeModuleOverview(scenarioId, moduloId) {
  // ── ADI Core · 2.2a-2 parte B · CIERRE SEMÁNTICO del overview de inventario ──
  // composeModuleOverview es EL overview de un módulo. Si lo llaman con moduloId="inventario" mientras el
  // Availability Map lo bloquea (Fase 2.5), AVISA en vez de surfacear capital/rotación. Esto cierra el "stock"
  // elíptico que esquiva el muro de TEXTO (regex) y resuelve a módulo inventario por early_gate/late_layer/D0
  // — un solo punto, por SEMÁNTICA (sin tocar el regex, sin over-trigger del "stock disponible" comercial).
  // Gateado por QI_FILTER (régimen del muro): con QI off el piso responde byte-exacto; con QI on el muro de
  // texto ya AVISA lo explícito, este guard caza lo elíptico. Mensaje byte-idéntico al muro.
  if (ADI_MT_INV_COVERAGE_ENABLED && ADI_QI_FILTER_ENABLED && moduloId === "inventario" && !isAvailable("inventario"))
    return { opener: unavailableMessage("inventario"), suggestions: [], sentrixAction: null, reasoningPattern: "mt_inv_coverage_block" };
  // ════════════════════════════════════════════════════════════════════════
  // BRIEF #15 · Executive V1 dispatch · Oleada 1
  // Flag rollback: cambiar a false → composer legacy se ejecuta bitwise.
  // ════════════════════════════════════════════════════════════════════════
  const VOICE_EXEC_MODULE_OVERVIEW_ENABLED = true;
  if (VOICE_EXEC_MODULE_OVERVIEW_ENABLED) {
    return composeModuleOverviewV2(scenarioId, moduloId);
  }
  // ── Helpers internos ───────────────────────────────────────────────────
  const fmtM = (val) => {
    // val expressed in same scale as ventasKPI.totalActual (e.g. 100000 = $100M)
    const m = val / 1000;
    return Number.isInteger(m) ? `$${m}M` : `$${m.toFixed(1)}M`;
  };
  const fmtK = (val) => {
    if (val >= 1000) {
      const k = val / 1000;
      return Number.isInteger(k) ? `$${k}K` : `$${k.toFixed(1)}K`;
    }
    return `$${Math.round(val)}`;
  };
  const pct1 = (v) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;

  // ────────────────────────────────────────────────────────────────────────
  // BRANCH VENTAS
  //   Cifra principal · vsAnterior · delta absoluto · cifras CANÓNICAS via
  //   getVentasKPI(scenarioId). Runtime se usa SOLO para enriquecimiento:
  //   top 3 ranking, fastest grower y worst decliner.
  //   Regla LOCKED: dashboard muestra KPI canónico · narrativa debe coincidir.
  // ────────────────────────────────────────────────────────────────────────
  if (moduloId === "ventas") {
    // ── KPI canónico (scenario-aware · misma fuente que el dashboard)
    const kpi = getVentasKPI("Anual", null, scenarioId);
    const totalActual   = kpi.totalActual;     // escala miles (99,999 = $99.999M)
    const totalAnterior = kpi.totalAnterior;
    const growth        = kpi.vsAnterior;      // canónico 7.6 / 0 / -12.6
    const deltaUSD      = totalActual - totalAnterior; // escala miles

    // ── Runtime (enriquecimiento · top 3, fastest, worst)
    const dataset = applyScenarioToClientesVentas(scenarioId);
    const sorted = [...dataset].sort((a, b) => b.actual - a.actual);
    const top3 = sorted.slice(0, 3);
    const top3Sum = top3.reduce((s, c) => s + c.actual, 0);
    const top3Pct = (top3Sum / totalActual) * 100;
    const top3Names = top3.map(c => c.nombre).join(", ");

    const growers = dataset
      .filter(c => c.actual > c.anterior)
      .map(c => ({ ...c, g: ((c.actual - c.anterior) / c.anterior) * 100 }))
      .sort((a, b) => b.g - a.g);
    const fastest = growers[0] || null;

    const decliners = dataset
      .filter(c => c.actual < c.anterior)
      .map(c => ({ ...c, g: ((c.actual - c.anterior) / c.anterior) * 100 }))
      .sort((a, b) => a.g - b.g);
    const worst = decliners[0] || null;

    // ── Header · cifra principal canónica (escala miles → fmtM)
    const m1 = `El año cerró en ${fmtM(totalActual)} con crecimiento de ${pct1(growth)} versus el período anterior, equivalente a ${fmtM(Math.abs(deltaUSD))} de variación absoluta.`;

    // ── Cuerpo · top 3 + concentración (R3 + R5)
    const m2 = `${top3Names} concentran el ${top3Pct.toFixed(1)}% de la facturación, lo que explica que la dinámica de la cartera dependa de tres cuentas.`;

    // ── Lectura · pattern estructural + outlier (R8)
    let m3 = "";
    if (scenarioId === "bonanza" && fastest) {
      m3 = `${fastest.nombre} crece ${pct1(fastest.g)} con apenas ${fastest.pctRebate}% de carga comercial, mientras la cartera promedio opera entre 3% y 5%. El motor de eficiencia está fuera del top de concentración.`;
    } else if (scenarioId === "tension") {
      const tier1Growth = top3.map(c => ((c.actual - c.anterior) / c.anterior) * 100);
      const flatNames = top3.filter((c, i) => Math.abs(tier1Growth[i]) < 3).map(c => c.nombre).join(" y ");
      m3 = worst
        ? `${worst.nombre} cae ${pct1(worst.g)}${flatNames ? ` mientras ${flatNames} se mantienen prácticamente planos` : ""}, lo que indica que el deterioro empezó por la periferia y aún no contagia el núcleo Tier 1.`
        : `El crecimiento del período anterior se desinfló sin que cambiara el portafolio comercial.`;
    } else if (scenarioId === "crisis") {
      m3 = worst && fastest
        ? `${worst.nombre} cae ${pct1(worst.g)} mientras ${fastest.nombre} crece ${pct1(fastest.g)}, lo que muestra ruptura del modelo comercial: el deterioro es estructural en los canales tradicionales y el e-commerce absorbe parcialmente la caída.`
        : `El portafolio entra en contracción profunda con concentración del riesgo en cuentas Tier 1.`;
    } else if (fastest) {
      m3 = `${fastest.nombre} crece ${pct1(fastest.g)} con carga comercial ${fastest.pctRebate}%, lo que explica que la eficiencia de la cartera dependa de un canal con condiciones distintas al promedio.`;
    }

    const m4 = `¿Qué quieres entender primero?`;
    const confianza = `*Confianza alta · cifras runtime sobre escenario ${scenarioId}.*`;
    const opener = [m1, m2, m3, m4, confianza].filter(Boolean).join("\n\n");

    const suggestionsByScenario = {
      bonanza: [
        "¿Por qué Mercado Libre crece tanto?",
        "¿Qué pasa si pierdo a Falabella?",
        "¿Dónde están los clientes que caen?",
      ],
      tension: [
        "¿Qué clientes están en caída?",
        "¿La carga comercial está subiendo sin retorno?",
        "¿Dónde podemos recuperar volumen?",
      ],
      crisis: [
        "¿Qué clientes están perdiendo más volumen?",
        "¿Mercado Libre puede compensar?",
        "¿Dónde corto y dónde sostengo?",
      ],
    };
    const suggestions = suggestionsByScenario[scenarioId] || suggestionsByScenario.bonanza;

    // BRIEF N-bis · Tipo A puro · suggestionsByScenario filtradas (LEGACY · no-runtime · por consistencia)
    return { opener, suggestions: filterTextualSuggestions(suggestions) };
  }

  // ────────────────────────────────────────────────────────────────────────
  // BRANCH MARGENES
  //   Cifra principal · pct, pctAnt, totalUSD, gapPuntos, benchmark CANÓNICAS
  //   via getMargenKPI(scenarioId). Ventas canónicas via getVentasKPI para
  //   coherencia bitwise (escala miles → fmtM). Runtime se usa SOLO para
  //   enriquecimiento: outlier topRebate y outlier virtuoso (Mercado Libre).
  // ────────────────────────────────────────────────────────────────────────
  if (moduloId === "margenes") {
    const k = getMargenKPI(scenarioId);
    const vk = getVentasKPI("Anual", null, scenarioId);
    const margenPct = k.pct;
    const margenAnt = k.pctAnt;
    const contribTotal = k.totalUSD;       // escala miles
    const gap = k.gapPuntos;                // YoY (pct - pctAnt) · NO vs benchmark (ver L17790)
    const benchmark = k.benchmark || 30.1;
    const deltaPp = margenPct - margenAnt; // delta YoY puntos
    const ventaActual = vk.totalActual;    // escala miles (KPI canónico)

    // FIX #D-MARGEN-GAP-BENCHMARK-MIENTE · el gap a benchmark = margen − benchmark (no gapPuntos · YoY).
    const _marginGapFixOn = (typeof ADI_MARGIN_BENCHMARK_GAP_FIX_ENABLED !== "undefined" && ADI_MARGIN_BENCHMARK_GAP_FIX_ENABLED);
    const _gapBench = _marginGapFixOn ? (margenPct - benchmark) : gap;

    // ── Gap contribution vs benchmark · ventas canónicas × gap puntos
    //    Esto coincide con el monto que el dashboard expone como brecha vs benchmark.
    const gapContrib = ventaActual * (Math.abs(_gapBench) / 100); // escala miles

    // ── Contribución erosionada YoY · ventas canónicas × delta puntos
    //    Solo aplica cuando deltaPp < 0 (margen cayó respecto al período anterior).
    const erosionContrib = ventaActual * (Math.abs(deltaPp) / 100); // escala miles

    // ── Runtime · outlier de carga comercial (cliente concentrador)
    const marg = clientesMargen;
    const ml = marg.find(c => c.nombre === "Mercado Libre");
    const topRebate = [...marg].sort((a, b) => b.rebates - a.rebates)[0];

    let m1, m2, m3;

    if (scenarioId === "bonanza") {
      // Bonanza · gap vs benchmark (positivo o negativo según escenario)
      m1 = `El margen general está en ${margenPct.toFixed(1)}%, ${Math.abs(_gapBench).toFixed(1)} puntos ${_gapBench >= 0 ? "sobre" : "bajo"} el benchmark de industria (${benchmark.toFixed(1)}%), equivalente a ${fmtM(gapContrib)} de contribución ${_gapBench >= 0 ? "capturada sobre el estándar" : "no capturada"}.`;
      m2 = `${topRebate.nombre} concentra ${fmtM(topRebate.rebates)} en carga comercial con margen ${topRebate.margen.toFixed(1)}%, mientras ${ml.nombre} opera con margen ${ml.margen.toFixed(1)}% y carga ${ml.pctRebate}% — la diferencia es estructural, no coyuntural.`;
      m3 = `La carga comercial sobre cuentas Tier 1 explica gran parte de la diferencia versus benchmark, ya que el resto del portafolio opera dentro de rango.`;
    } else if (scenarioId === "tension") {
      m1 = `El margen cayó de ${margenAnt.toFixed(1)}% a ${margenPct.toFixed(1)}% en un año (${deltaPp >= 0 ? "+" : ""}${deltaPp.toFixed(1)}pp), equivalente aproximadamente a ${fmtM(erosionContrib)} de contribución erosionada.`;
      m2 = `${topRebate.nombre} concentra ${fmtM(topRebate.rebates)} en carga comercial con margen ${topRebate.margen.toFixed(1)}%, lo que muestra que la erosión se origina en las cuentas que más pesan.`;
      m3 = `La carga comercial subió sin retorno en volumen, lo que significa que el incentivo dejó de comprar ventas y empezó a destruir contribución.`;
    } else if (scenarioId === "crisis") {
      m1 = `El margen colapsó de ${margenAnt.toFixed(1)}% a ${margenPct.toFixed(1)}% (${deltaPp >= 0 ? "+" : ""}${deltaPp.toFixed(1)}pp), equivalente aproximadamente a ${fmtM(erosionContrib)} de contribución destruida.`;
      m2 = `${topRebate.nombre} concentra ${fmtM(topRebate.rebates)} en carga comercial sobre margen ${topRebate.margen.toFixed(1)}%, lo que indica que algunas cuentas Tier 1 están operando cerca o bajo costo real.`;
      m3 = `La empresa está perdiendo contribución por sostener volumen, ya que la carga comercial supera el retorno marginal de varios clientes.`;
    } else {
      m1 = `El margen general está en ${margenPct.toFixed(1)}%, con gap de ${Math.abs(_gapBench).toFixed(1)}pp ${_gapBench >= 0 ? "sobre" : "bajo"} benchmark.`;
      m2 = `${topRebate.nombre} concentra ${fmtM(topRebate.rebates)} en carga comercial.`;
      m3 = `La presión sobre margen explica la mayor parte de la brecha versus benchmark.`;
    }

    const m4 = `¿Por dónde profundizamos?`;
    const confianza = `*Confianza alta · cifras runtime sobre escenario ${scenarioId}.*`;
    const opener = [m1, m2, m3, m4, confianza].join("\n\n");

    const suggestionsByScenario = {
      bonanza: [
        "¿Cuánto margen perdemos por cliente?",
        "¿Falabella está pagando lo que vale?",
        "¿Qué pasa si bajo la carga comercial de Lider?",
      ],
      tension: [
        "¿Dónde se está yendo el margen?",
        "¿Qué cliente concentra la pérdida?",
        "¿Cuánto recupero si renegocio la carga comercial?",
      ],
      crisis: [
        "¿Qué clientes están en pérdida real?",
        "¿Cuánto cuesta sostener a Ripley?",
        "¿Qué pasa si subo precios a los Tier 2?",
      ],
    };
    const suggestions = suggestionsByScenario[scenarioId] || suggestionsByScenario.bonanza;

    // BRIEF N-bis · Tipo A puro · suggestionsByScenario filtradas (LEGACY · no-runtime · por consistencia)
    return { opener, suggestions: filterTextualSuggestions(suggestions) };
  }

  // ────────────────────────────────────────────────────────────────────────
  // BRANCH INVENTARIO
  // ────────────────────────────────────────────────────────────────────────
  if (moduloId === "inventario") {
    const k = getInvKPI(scenarioId);
    const totalInvUSD = k.totalUSD;       // canónico scenario-aware
    const inmovUSD = k.inmovilizadoUSD;   // canónico scenario-aware
    const inmovPct = k.inmovilizadoPct;   // canónico scenario-aware
    const doh = k.doh;

    // Top categoría runtime sobre SKUs con estado !== "Activo"
    // (autorización BRIEF #2 · Opción C)
    const skuScn = applyScenarioToSkuInventario(scenarioId);
    const inmovSkus = skuScn.filter(s => s.estado !== "Activo");

    let topCatName = null;
    let topCatPct = 0;
    let topCatUSD = 0;
    if (inmovSkus.length > 0) {
      const byCat = {};
      inmovSkus.forEach(s => { byCat[s.sfamilia] = (byCat[s.sfamilia] || 0) + s.stockUSD; });
      const sumInmovUSD = inmovSkus.reduce((s, x) => s + x.stockUSD, 0);
      const sortedCat = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
      topCatName = sortedCat[0][0];
      topCatUSD = sortedCat[0][1];
      topCatPct = (topCatUSD / sumInmovUSD) * 100;
    }

    // Header · cifra principal canónica scenario-aware
    const m1 = `El ${inmovPct.toFixed(1)}% del inventario opera fuera de rango óptimo, con ${fmtK(inmovUSD)} comprometidos sobre un total de ${fmtK(totalInvUSD)} en stock. La cobertura promedio se ubica en ${doh} días.`;

    // Cuerpo · top categoría runtime (R3 + R5)
    let m2 = "";
    if (topCatName) {
      m2 = `${topCatName} concentra el ${topCatPct.toFixed(1)}% del capital inmovilizado, lo que explica que el problema esté estructuralmente en una sola línea de producto.`;
    }

    // Lectura causal · diferenciada por scenario (R8)
    let m3 = "";
    if (scenarioId === "bonanza") {
      m3 = `El stock detenido es manejable en magnitud pero está concentrado en SKUs específicos, ya que la rotación promedio del portafolio rotacional opera sobre 8x.`;
    } else if (scenarioId === "tension") {
      m3 = `La velocidad del deterioro pesa más que el monto absoluto, ya que SKUs que estaban activos hace meses cruzaron a estado lento sin reacción comercial.`;
    } else if (scenarioId === "crisis") {
      m3 = `El capital comprometido se duplicó versus el escenario base, lo que provoca presión sobre flujo de caja y obliga a priorizar liquidación versus sostenimiento.`;
    }

    const m4 = `¿Por dónde quieres empezar a desarmar el problema?`;
    const confianza = `*Confianza alta · cifras runtime sobre escenario ${scenarioId}.*`;
    const opener = [m1, m2, m3, m4, confianza].filter(Boolean).join("\n\n");

    const suggestionsByScenario = {
      bonanza: [
        "¿Qué SKUs están atrapando más capital?",
        "¿Por qué Materiales de Construcción se desbordó?",
        "¿Cuánto puedo recuperar si actúo ahora?",
      ],
      tension: [
        "¿Qué productos están deteniéndose?",
        "¿Por qué Línea Blanca dejó de rotar?",
        "¿Cuánto pierdo si los liquido?",
      ],
      crisis: [
        "¿Qué SKUs liquido primero?",
        "¿Cuánto puedo recuperar en 90 días?",
        "¿Qué productos están en quiebre próximo?",
      ],
    };
    const suggestions = suggestionsByScenario[scenarioId] || suggestionsByScenario.bonanza;

    // BRIEF N-bis · Tipo A puro · suggestionsByScenario filtradas (LEGACY · no-runtime · por consistencia)
    return { opener, suggestions: filterTextualSuggestions(suggestions) };
  }

  // Fallback defensivo · módulo no reconocido
  return {
    opener: "Cuéntame qué módulo quieres explorar: ventas, márgenes o inventario.",
    // BRIEF N-bis · Tipo A puro · filtradas
    suggestions: filterTextualSuggestions(["Las ventas", "El margen", "El inventario"]),
  };
}

export function composeModuleOverviewV2(scenarioId, moduloId) {
  // Helpers internos (mismo formato que legacy)
  const fmtM = (val) => {
    const m = val / 1000;
    return Number.isInteger(m) ? `$${m}M` : `$${m.toFixed(1)}M`;
  };
  const fmtK = (val) => {
    if (val >= 1000) {
      const k = val / 1000;
      return Number.isInteger(k) ? `$${k}K` : `$${k.toFixed(1)}K`;
    }
    return `$${Math.round(val)}K`;
  };
  const pct1 = (val) => `${val >= 0 ? "+" : ""}${val.toFixed(1)}%`;

  // ────────────────────────────────────────────────────────────────────────
  // BRANCH VENTAS
  // ────────────────────────────────────────────────────────────────────────
  if (moduloId === "ventas") {
    const kpi = getVentasKPI("Anual", null, scenarioId);
    const totalActual = kpi.totalActual;
    const totalAnterior = kpi.totalAnterior;
    const growth = kpi.vsAnterior;
    const deltaUSD = totalActual - totalAnterior;

    const dataset = applyScenarioToClientesVentas(scenarioId);
    const sorted = [...dataset].sort((a, b) => b.actual - a.actual);
    const top3 = sorted.slice(0, 3);
    const top3Sum = top3.reduce((s, c) => s + c.actual, 0);
    const top3Pct = (top3Sum / totalActual) * 100;
    const top3Names = top3.map(c => c.nombre).join(", ");

    const growers = dataset
      .filter(c => c.actual > c.anterior)
      .map(c => ({ ...c, g: ((c.actual - c.anterior) / c.anterior) * 100 }))
      .sort((a, b) => b.g - a.g);
    const fastest = growers[0] || null;

    const decliners = dataset
      .filter(c => c.actual < c.anterior)
      .map(c => ({ ...c, g: ((c.actual - c.anterior) / c.anterior) * 100 }))
      .sort((a, b) => a.g - b.g);
    const worst = decliners[0] || null;

    let b2, b3, b4, b5;
    if (scenarioId === "bonanza") {
      b2 = `Las ventas crecen ${pct1(growth)} YoY · la contribución crece a menor velocidad.`;
      b3 = `Total ${fmtM(totalActual)} · variación +${fmtM(Math.abs(deltaUSD))} · top 3 (${top3Names}) concentran ${top3Pct.toFixed(1)}%${fastest ? ` · ${fastest.nombre} crece ${pct1(fastest.g)} con carga ${fastest.pctRebate}%` : ""}.`;
      b4 = `El motor de eficiencia opera fuera del top de concentración.`;
      b5 = `Profundizaría primero en cuentas Tier 1 · luego en canal digital.`;
    } else if (scenarioId === "tension") {
      b2 = `Las ventas se quedaron planas YoY (${pct1(growth)}) · el portafolio dejó de traccionar.`;
      b3 = `Total ${fmtM(totalActual)} · variación ${fmtM(deltaUSD)}${worst ? ` · ${worst.nombre} cae ${pct1(worst.g)}` : ""} · top 3 (${top3Names}) concentran ${top3Pct.toFixed(1)}%.`;
      b4 = `El deterioro empezó por la periferia · el núcleo Tier 1 todavía no muestra caída.`;
      b5 = `Profundizaría primero en las cuentas en caída · luego revisaría Tier 1.`;
    } else if (scenarioId === "crisis") {
      b2 = `Las ventas cayeron ${pct1(growth)} YoY · la cartera está perdiendo volumen.`;
      b3 = `Total ${fmtM(totalActual)} · variación ${fmtM(deltaUSD)}${worst ? ` · ${worst.nombre} cae ${pct1(worst.g)}` : ""}${fastest ? ` · ${fastest.nombre} crece ${pct1(fastest.g)}` : ""} · top 3 concentran ${top3Pct.toFixed(1)}%.`;
      b4 = `El canal tradicional cae · el e-commerce absorbe parcialmente la pérdida.`;
      b5 = `Profundizaría primero en las cuentas con mayor caída · luego canal digital.`;
    } else {
      // Fallback genérico
      b2 = `Las ventas presentan variación ${pct1(growth)} YoY.`;
      b3 = `Total ${fmtM(totalActual)} · variación ${fmtM(deltaUSD)} · top 3 (${top3Names}) concentran ${top3Pct.toFixed(1)}%.`;
      b4 = `La dinámica de la cartera depende de tres cuentas.`;
      b5 = `Profundizaría primero por cuenta · luego por canal.`;
    }
    const b6 = `*Confianza alta · cifras runtime sobre escenario ${scenarioId}.*`;
    const opener = [b2, b3, b4, b5, b6].filter(Boolean).join("\n\n");

    // Suggestions intactas (D5 mantener bitwise · legacy wording)
    const suggestionsByScenario = {
      bonanza: [
        "¿Por qué Mercado Libre crece tanto?",
        "¿Qué pasa si pierdo a Falabella?",
        "¿Dónde están los clientes que caen?",
      ],
      tension: [
        "¿Qué clientes están en caída?",
        "¿La carga comercial está subiendo sin retorno?",
        "¿Dónde podemos recuperar volumen?",
      ],
      crisis: [
        "¿Qué clientes están perdiendo más volumen?",
        "¿Mercado Libre puede compensar?",
        "¿Dónde corto y dónde sostengo?",
      ],
    };
    const suggestions = suggestionsByScenario[scenarioId] || suggestionsByScenario.bonanza;
    // BRIEF N-bis · Tipo A puro · suggestionsByScenario filtradas
    return { opener, suggestions: filterTextualSuggestions(suggestions) };
  }

  // ────────────────────────────────────────────────────────────────────────
  // BRANCH MARGENES
  // ────────────────────────────────────────────────────────────────────────
  if (moduloId === "margenes") {
    const k = getMargenKPI(scenarioId);
    const vk = getVentasKPI("Anual", null, scenarioId);
    const margenPct = k.pct;
    const margenAnt = k.pctAnt;
    const gap = k.gapPuntos;
    const benchmark = k.benchmark || 30.1;
    const deltaPp = margenPct - margenAnt;
    const ventaActual = vk.totalActual;

    // FIX #D-MARGEN-GAP-BENCHMARK-MIENTE · el gap a benchmark se calcula margen − benchmark (no gapPuntos
    // que es YoY). _gapBench < 0 = bajo benchmark · >= 0 = sobre. OFF: usa gapPuntos (el bug).
    const _marginGapFixOn = (typeof ADI_MARGIN_BENCHMARK_GAP_FIX_ENABLED !== "undefined" && ADI_MARGIN_BENCHMARK_GAP_FIX_ENABLED);
    const _gapBench = _marginGapFixOn ? (margenPct - benchmark) : gap;

    const gapContrib = ventaActual * (Math.abs(_gapBench) / 100);
    const erosionContrib = ventaActual * (Math.abs(deltaPp) / 100);

    const marg = clientesMargen;
    const ml = marg.find(c => c.nombre === "Mercado Libre");
    const topRebate = [...marg].sort((a, b) => b.rebates - a.rebates)[0];

    let b2, b3, b4, b5;
    if (scenarioId === "bonanza") {
      b2 = `El margen general está en ${margenPct.toFixed(1)}% · ${Math.abs(_gapBench).toFixed(1)}pp ${_gapBench >= 0 ? "sobre" : "bajo"} benchmark de industria.`;
      // D2 ajuste LOCKED: NO repetir "Margen X%" de B2.
      b3 = `Benchmark ${benchmark.toFixed(1)}% · gap ${fmtM(gapContrib)} · ${topRebate.nombre} concentra ${fmtM(topRebate.rebates)} en carga${ml ? ` · ${ml.nombre} opera con margen ${ml.margen.toFixed(1)}% y carga ${ml.pctRebate}%` : ""}.`;
      b4 = `La presión sobre margen se concentra en Tier 1.`;
      b5 = `Negociaría primero la carga comercial de ${topRebate.nombre} · luego revisaría Tier 2.`;
    } else if (scenarioId === "tension") {
      // D2-bis LOCKED: "erosionada" → "menos de contribución capturada"
      b2 = `El margen cayó de ${margenAnt.toFixed(1)}% a ${margenPct.toFixed(1)}% (${deltaPp >= 0 ? "+" : ""}${deltaPp.toFixed(1)}pp) · aproximadamente ${fmtM(erosionContrib)} menos de contribución capturada.`;
      // D2 ajuste LOCKED: NO repetir "Margen X%" de B2.
      b3 = `YoY ${deltaPp.toFixed(1)}pp · brecha de captura ${fmtM(erosionContrib)} · ${topRebate.nombre} concentra ${fmtM(topRebate.rebates)} en carga con margen ${topRebate.margen.toFixed(1)}%.`;
      b4 = `La caída de margen se origina en las cuentas que más pesan.`;
      b5 = `Negociaría primero la carga comercial de ${topRebate.nombre} · luego revisaría Tier 1 restante.`;
    } else if (scenarioId === "crisis") {
      // D2-bis LOCKED: "colapsó" → "cayó" · "destruida" → "menos de contribución capturada"
      b2 = `El margen cayó de ${margenAnt.toFixed(1)}% a ${margenPct.toFixed(1)}% (${deltaPp.toFixed(1)}pp) · aproximadamente ${fmtM(erosionContrib)} menos de contribución capturada.`;
      // D2 ajuste LOCKED: NO repetir "Margen X%" de B2.
      b3 = `YoY ${deltaPp.toFixed(1)}pp · brecha de captura ${fmtM(erosionContrib)} · ${topRebate.nombre} concentra ${fmtM(topRebate.rebates)} en carga sobre margen ${topRebate.margen.toFixed(1)}%.`;
      b4 = `Algunas cuentas Tier 1 operan cerca o bajo costo real.`;
      b5 = `Revisaría primero las cuentas con margen sub-costo · luego negociaría Tier 1 restante.`;
    } else {
      b2 = `El margen general está en ${margenPct.toFixed(1)}% · gap ${Math.abs(_gapBench).toFixed(1)}pp ${_gapBench >= 0 ? "sobre" : "bajo"} benchmark.`;
      b3 = `Benchmark ${benchmark.toFixed(1)}% · ${topRebate.nombre} concentra ${fmtM(topRebate.rebates)} en carga.`;
      b4 = `La presión sobre margen se concentra en Tier 1.`;
      b5 = `Negociaría primero la carga comercial de ${topRebate.nombre}.`;
    }
    const b6 = `*Confianza alta · cifras runtime sobre escenario ${scenarioId}.*`;
    const opener = [b2, b3, b4, b5, b6].filter(Boolean).join("\n\n");

    const suggestionsByScenario = {
      bonanza: [
        "¿Cuánto margen perdemos por cliente?",
        "¿Falabella está pagando lo que vale?",
        "¿Qué pasa si bajo la carga comercial de Lider?",
      ],
      tension: [
        "¿Dónde se está yendo el margen?",
        "¿Qué cliente concentra la pérdida?",
        "¿Cuánto recupero si renegocio la carga comercial?",
      ],
      crisis: [
        "¿Qué clientes están en pérdida real?",
        "¿Cuánto cuesta sostener a Ripley?",
        "¿Qué pasa si subo precios a los Tier 2?",
      ],
    };
    const suggestions = suggestionsByScenario[scenarioId] || suggestionsByScenario.bonanza;
    // BRIEF N-bis · Tipo A puro · suggestionsByScenario filtradas
    return { opener, suggestions: filterTextualSuggestions(suggestions) };
  }

  // ────────────────────────────────────────────────────────────────────────
  // BRANCH INVENTARIO
  // ────────────────────────────────────────────────────────────────────────
  if (moduloId === "inventario") {
    const k = getInvKPI(scenarioId);
    const totalInvUSD = k.totalUSD;
    const inmovUSD = k.inmovilizadoUSD;
    const inmovPct = k.inmovilizadoPct;
    const doh = k.doh;

    const skuScn = applyScenarioToSkuInventario(scenarioId);
    const inmovSkus = skuScn.filter(s => s.estado !== "Activo");

    let topCatName = null;
    let topCatPct = 0;
    if (inmovSkus.length > 0) {
      const byCat = {};
      inmovSkus.forEach(s => { byCat[s.sfamilia] = (byCat[s.sfamilia] || 0) + s.stockUSD; });
      const sumInmovUSD = inmovSkus.reduce((s, x) => s + x.stockUSD, 0);
      const sortedCat = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
      topCatName = sortedCat[0][0];
      const topCatUSD = sortedCat[0][1];
      topCatPct = (topCatUSD / sumInmovUSD) * 100;
    }
    // C3.2 · SKU principal (pieza 4-5) · el top del set inmovSkus YA cargado (decisión (a) del founder · misma
    // data · seleccionar el top, no recompute externo). La categoría es el frente; el SKU es el responsable.
    const _topInmovSku = (VOICE_C32_EVIDENCE_ENABLED && inmovSkus.length > 0)
      ? [...inmovSkus].sort((a, b) => b.stockUSD - a.stockUSD)[0]
      : null;

    let b2, b3, b4, b5;
    if (scenarioId === "bonanza") {
      b2 = `El ${inmovPct.toFixed(1)}% del inventario opera fuera de rango óptimo · cobertura promedio ${doh} días.`;
      b3 = `Inmovilizado ${fmtK(inmovUSD)} · total ${fmtK(totalInvUSD)}${topCatName ? ` · ${topCatName} concentra ${topCatPct.toFixed(1)}% del capital detenido` : ""}.`;
      // D2 ajuste LOCKED: B4 lectura ejecutiva · topCatName ya está en B3.
      b4 = `El problema es estructural en una sola línea de producto.`;
      b5 = topCatName
        ? `Atacaría primero los SKUs de ${topCatName} · luego revisaría rotación por familia.`
        : `Atacaría primero los SKUs de la categoría más concentrada · luego revisaría rotación por familia.`;
    } else if (scenarioId === "tension") {
      // D2-bis LOCKED: "velocidad de deterioro creciente" → "SKUs cruzando a estado lento"
      b2 = `El ${inmovPct.toFixed(1)}% del inventario opera fuera de rango óptimo · cobertura ${doh} días · SKUs cruzando a estado lento.`;
      b3 = `Inmovilizado ${fmtK(inmovUSD)} · total ${fmtK(totalInvUSD)}${topCatName ? ` · ${topCatName} concentra ${topCatPct.toFixed(1)}% del capital detenido · SKUs activos hace meses cruzaron a estado lento` : ""}.`;
      // D2 ajuste LOCKED: "pesa más que" → "está en velocidad de cambio · no en magnitud absoluta"
      b4 = `El problema está en velocidad de cambio · no en magnitud absoluta.`;
      b5 = topCatName
        ? `Atacaría primero los SKUs recién cruzados a lento · luego revisaría ${topCatName}.`
        : `Atacaría primero los SKUs recién cruzados a lento · luego revisaría por familia.`;
    } else if (scenarioId === "crisis") {
      // D2-bis LOCKED: "comprometido duplicado vs base" → "sobre el doble del rango base"
      b2 = `El ${inmovPct.toFixed(1)}% del inventario opera fuera de rango óptimo · cobertura ${doh} días · capital detenido sobre el doble del rango base.`;
      b3 = `Inmovilizado ${fmtK(inmovUSD)} · total ${fmtK(totalInvUSD)}${topCatName ? ` · ${topCatName} concentra ${topCatPct.toFixed(1)}% del capital detenido` : ""}.`;
      // D2-bis LOCKED: "presiona" → "impacta el ciclo de caja"
      b4 = `El capital detenido impacta el ciclo de caja.`;
      b5 = topCatName
        ? `Liquidaría primero los SKUs de ${topCatName} · luego priorizaría categorías por cobertura.`
        : `Liquidaría primero los SKUs de la categoría más concentrada · luego priorizaría por cobertura.`;
    } else {
      b2 = `El ${inmovPct.toFixed(1)}% del inventario opera fuera de rango óptimo · cobertura ${doh} días.`;
      b3 = `Inmovilizado ${fmtK(inmovUSD)} · total ${fmtK(totalInvUSD)}.`;
      b4 = `El stock detenido requiere lectura por familia.`;
      b5 = `Revisaría rotación por familia.`;
    }
    const b6 = `*Confianza alta · cifras runtime sobre escenario ${scenarioId}.*`;
    const opener = [b2, b3, b4, b5, b6].filter(Boolean).join("\n\n");

    const suggestionsByScenario = {
      bonanza: [
        "¿Qué SKUs están atrapando más capital?",
        "¿Por qué Materiales de Construcción se desbordó?",
        "¿Cuánto puedo recuperar si actúo ahora?",
      ],
      tension: [
        "¿Qué productos están deteniéndose?",
        "¿Por qué Línea Blanca dejó de rotar?",
        "¿Cuánto pierdo si los liquido?",
      ],
      crisis: [
        "¿Qué SKUs liquido primero?",
        "¿Cuánto puedo recuperar en 90 días?",
        "¿Qué productos están en quiebre próximo?",
      ],
    };
    const suggestions = suggestionsByScenario[scenarioId] || suggestionsByScenario.bonanza;
    // BRIEF N-bis · Tipo A puro · suggestionsByScenario filtradas
    // C3.2 · EVIDENCIA DE LA TESIS (nivel 2) · ADITIVO read-only · las 5 piezas con los valores YA computados
    // arriba (inmovUSD/topCatName/topCatPct = los mismos que el opener interpoló · _topInmovSku derivado de
    // inmovSkus ya cargado). SEÑAL DE EXPERIENCIA para Sentrix · NUNCA leída por razonamiento. El opener (prosa)
    // queda byte-idéntico — esto solo deja de DESCARTAR lo computado. Valores RAW (Sentrix formatea igual que el opener).
    return {
      opener,
      suggestions: filterTextualSuggestions(suggestions),
      ...(VOICE_C32_EVIDENCE_ENABLED ? {
        evidencia: {
          capital_inmovilizado_USD: inmovUSD,                       // pieza 1 · = el inmovUSD del opener
          categoria_responsable:    topCatName,                     // pieza 2 · = el topCatName del opener
          participacion_pct:        topCatPct,                      // pieza 3 · = el topCatPct del opener
          sku_principal:            _topInmovSku ? _topInmovSku.sku : null,       // pieza 4 · top de inmovSkus
          capital_asociado_USD:     _topInmovSku ? _topInmovSku.stockUSD : null,  // pieza 5 · su stockUSD
        },
      } : {}),
    };
  }

  // Fallback defensivo · módulo no reconocido
  return {
    opener: "Cuéntame qué módulo quieres explorar: ventas, márgenes o inventario.",
    // BRIEF N-bis · Tipo A puro · filtradas
    suggestions: filterTextualSuggestions(["Las ventas", "El margen", "El inventario"]),
  };
}
