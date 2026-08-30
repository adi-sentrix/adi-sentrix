/* === adi/composers/overview.js ===
 * ADI conversacional extraído de 41cc33d8 · verbatim · solo imports agregados.
 * Importa motor (engine/) + datos/config sellados. Cero cambio de cálculo. */
import { ADI_MARGIN_BENCHMARK_GAP_FIX_ENABLED, VOICE_C32_EVIDENCE_ENABLED, ADI_MT_INV_COVERAGE_ENABLED, ADI_QI_FILTER_ENABLED } from "../../config/voiceFlags.js";
import { isAvailable, unavailableMessage } from "../core/availabilityMap.js";  // ADI Core · 2.2a-2 parte B · cierre semántico del overview de inventario
import { clientesMargen } from "../../data/demoData.js";
import { getInvKPI, getMargenKPI, getVentasKPI } from "../../engine/metrics.js";
import { applyScenarioToClientesVentas, applyScenarioToSkuInventario } from "../../engine/scenarios.js";
import { filterTextualSuggestions } from "../helpers.js";
import { POLICY } from "../../config/businessPolicy.js";   // hardening · política de negocio · UNA fuente (byte-idéntico)
import { simboloMoneda } from "../../config/moneda.js";
import { getTenantData } from "../../data/tenantStore.js";
import { factorComercialDe } from "../../config/contract/figureType.js";
// monto comercial ALMACENADO → M verdaderos (la escala la declara el pack · demo «K» = identidad · 2026-08-30)
const _enM = (v) => (Number(v) || 0) * factorComercialDe(getTenantData()) / 1e6;

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
    // monto comercial ALMACENADO → M verdaderos · bajo $1M se muestra en K (owner 2026-08-30)
    const m = _enM(val);
    if (Math.abs(m) < 1) return `${simboloMoneda()}${Math.round(m * 1000)}K`;
    return Number.isInteger(m) ? `${simboloMoneda()}${m}M` : `${simboloMoneda()}${m.toFixed(1)}M`;
  };
  const fmtK = (val) => {
    if (val >= 1000) {
      const k = val / 1000;
      return Number.isInteger(k) ? `${simboloMoneda()}${k}K` : `${simboloMoneda()}${k.toFixed(1)}K`;
    }
    return `${simboloMoneda()}${Math.round(val)}`;
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
    const top3Pct = totalActual > 0 ? (top3Sum / totalActual) * 100 : 0;   // R7: NaN con total 0
    const top3Names = top3.map(c => c.nombre).join(", ");

    const growers = dataset
      .filter(c => c.anterior > 0 && c.actual > c.anterior)   // R7: sin año anterior no hay % (el primer archivo de un mes no divide por cero)
      .map(c => ({ ...c, g: ((c.actual - c.anterior) / c.anterior) * 100 }))
      .sort((a, b) => b.g - a.g);
    const fastest = growers[0] || null;

    const decliners = dataset
      .filter(c => c.anterior > 0 && c.actual < c.anterior)   // R7: ídem
      .map(c => ({ ...c, g: ((c.actual - c.anterior) / c.anterior) * 100 }))
      .sort((a, b) => a.g - b.g);
    const worst = decliners[0] || null;

    /* COLAPSO NARRATIVO (owner 2026-08-30, «si autorizado!»): acá vivían TRES guiones por escenario
     * (bonanza=crecimiento, tensión=meseta, crisis=ruptura) — letra escrita para la película del demo, narrada
     * sobre el dato de CUALQUIER tenant: un pack con venta −0.9% recibía «crecimiento de −0.9%» (dirección
     * invertida — la falta sagrada) y causas con reparto inventado («Tier 1», «canal digital», «e-commerce»).
     * Queda UNA narrativa cuya dirección sale del SIGNO del dato y que solo nombra lo que el pack trae. */
    // ── Header · cifra principal canónica (escala miles → fmtM) · la dirección la dice el signo
    // R7: el primer archivo de un solo mes no declara período anterior (vsAnterior null) — la variación se
    // DECLINA en palabras, jamás se calcula sobre nada ni revienta la cara.
    const m1 = typeof growth === "number" && Number.isFinite(growth)
      ? `El año cerró en ${fmtM(totalActual)} con variación de ${pct1(growth)} versus el período anterior, equivalente a ${fmtM(Math.abs(deltaUSD))} ${deltaUSD >= 0 ? "más" : "menos"} que entonces.`
      : `El período cerró en ${fmtM(totalActual)} — sin período anterior declarado para comparar.`;

    // ── Cuerpo · top 3 + concentración (R3 + R5) · la lectura de dependencia solo si el dato la sostiene
    const m2 = `${top3Names} concentran el ${top3Pct.toFixed(1)}% de la facturación${top3Pct >= 50 ? " — la dinámica de la cartera depende de pocas cuentas" : ""}.`;

    // ── Lectura · el mayor movimiento REAL de la cartera (fastest crece por construcción · worst cae por construcción)
    let m3 = "";
    if (fastest) {
      // UN PROMEDIO ES UN HECHO CALCULADO, NO UNA BANDA ESCRITA A MANO (owner 2026-08-09) — el cálculo se queda.
      const _cargaPonderada = (() => {
        const tv = dataset.reduce((s, c) => s + (c.actual || 0), 0);
        if (!tv) return null;
        return +((dataset.reduce((s, c) => s + ((c.pctRebate || 0) / 100) * (c.actual || 0), 0) / tv) * 100).toFixed(1);
      })();
      m3 = _cargaPonderada != null
        ? `${fastest.nombre} crece ${pct1(fastest.g)} con ${fastest.pctRebate}% de carga comercial, contra un promedio ponderado de la cartera de ${_cargaPonderada}%.`
        : `${fastest.nombre} crece ${pct1(fastest.g)} con ${fastest.pctRebate}% de carga comercial.`;
    } else if (worst) {
      m3 = `${worst.nombre} cae ${pct1(worst.g)} — la caída más pronunciada de la cartera.`;
    }

    const m4 = `¿Qué quieres entender primero?`;
    const opener = [m1, m2, m3, m4].filter(Boolean).join("\n\n");

    // COLAPSO NARRATIVO: una sola lista, con las cuentas elegidas por su PAPEL en el dato (la que más crece,
    // la más grande) — sin variantes por escenario. Si no hay quien crezca, la sugerencia se cae sola.
    const suggestions = [];   // PODA (C-2 del retrabajo, decisión del chat principal): filterTextualSuggestions descarta TODO string desde la decisión de voz vieja (solo cognitive actions Tipo B pasan) — una lista que jamás llega a pantalla es código que miente «sugiere». Si el owner quiere sugerencias vivas acá, nacen como acciones Tipo B, encargo propio.

    // BRIEF N-bis · Tipo A puro · sugerencias filtradas (LEGACY · no-runtime · por consistencia)
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
    const benchmark = k.benchmark || POLICY.benchmark;
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
    /* EL CONTRAPUNTO SE CALCULA, NO SE NOMBRA (2026-08-21). Acá decía `find(c => c.nombre === "Mercado Libre")`:
     * la cuenta que el texto usa como contraejemplo de `topRebate` estaba amarrada por NOMBRE a una del demo.
     * Con otra empresa, `ml` quedaba undefined y la línea reventaba en `ml.nombre` (no era un texto raro: era un
     * TypeError). El papel que cumple en la frase es "la que opera con la carga más baja de la cartera", que es
     * justamente lo que la hace el contrapunto estructural del que más carga concentra. Eso sí sale del dato. */
    const ml = [...marg].filter(c => c && c.tipo === "cliente").sort((a, b) => (a.pctRebate || 0) - (b.pctRebate || 0))[0];
    const _porRebates = [...marg].sort((a, b) => b.rebates - a.rebates);
    const topRebate = _porRebates[0];
    const segundoRebate = _porRebates[1];   // la segunda palanca de carga · nombra una sugerencia, no una cifra
    const masCaraDeSostener = [...marg].filter(c => c && c.tipo === "cliente")
      .sort((a, b) => (b.pctRebate || 0) - (a.pctRebate || 0))[0];   // la de mayor carga EN % de su venta

    /* COLAPSO NARRATIVO (owner 2026-08-30): los guiones por escenario («colapsó», «Tier 1 bajo costo real»,
     * «la diferencia es estructural, no coyuntural») narraban causas con reparto inventado. Queda UNA lectura:
     * la dirección la dicen los signos (_gapBench, deltaPp) y cada nombre sale del dato. */
    const m1 = `El margen general está en ${margenPct.toFixed(1)}%, ${Math.abs(_gapBench).toFixed(1)} puntos ${_gapBench >= 0 ? "sobre" : "bajo"} tu benchmark (${benchmark.toFixed(1)}%), equivalente a ${fmtM(gapContrib)} de contribución ${_gapBench >= 0 ? "capturada sobre tu referencia" : "no capturada"}.`;
    const m2 = `${topRebate.nombre} concentra ${fmtM(topRebate.rebates)} en carga comercial con margen ${topRebate.margen.toFixed(1)}%${ml && topRebate && ml.nombre !== topRebate.nombre ? `, mientras ${ml.nombre} opera con margen ${ml.margen.toFixed(1)}% y carga ${ml.pctRebate}%` : ""}.`;   // R7: con un solo cliente no se compara consigo mismo
    const m3 = "";   // la «lectura causal» era el guion — la causa la arma ADI con sus herramientas, no una plantilla

    const m4 = `¿Por dónde profundizamos?`;
    const opener = [m1, m2, m3, m4].join("\n\n");

    /* COLAPSO NARRATIVO: una sola lista. Las cuentas se eligen por su PAPEL en la frase, con el criterio dicho:
     *   · "¿… está pagando lo que vale?" → la que más carga comercial concentra en $ (`topRebate`).
     *   · "¿… si bajo la carga comercial de X?" → la que le sigue: la segunda palanca de la misma naturaleza.
     *   · "¿Cuánto cuesta sostener a X?" → la de mayor carga en PORCENTAJE de su venta. */
    const suggestions = [];   // PODA (C-2 del retrabajo, decisión del chat principal): filterTextualSuggestions descarta TODO string desde la decisión de voz vieja (solo cognitive actions Tipo B pasan) — una lista que jamás llega a pantalla es código que miente «sugiere». Si el owner quiere sugerencias vivas acá, nacen como acciones Tipo B, encargo propio.

    // BRIEF N-bis · Tipo A puro · sugerencias filtradas (LEGACY · no-runtime · por consistencia)
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
    const inmovSkus = (inmovUSD > 0) ? skuScn.filter(s => s.estado !== "Activo") : [];   // R7: el KPI del motor manda — $0 inmovilizado = cero narrativa de concentración

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

    /* COLAPSO NARRATIVO (owner 2026-08-30): la «lectura causal por escenario» era guion («rotación sobre 8x»,
     * «se duplicó versus el escenario base» — cifras y causas escritas a mano). La concentración se AFIRMA solo
     * cuando el dato la sostiene; la causa la arma ADI con sus herramientas, no una plantilla. */
    let m2 = "";
    if (topCatName) {
      m2 = `${topCatName} concentra el ${topCatPct.toFixed(1)}% del capital inmovilizado${topCatPct >= 50 ? " — el problema está concentrado en una sola línea de producto" : ""}.`;
    }
    const m3 = "";

    const m4 = `¿Por dónde quieres empezar a desarmar el problema?`;
    const opener = [m1, m2, m3, m4].filter(Boolean).join("\n\n");

    // COLAPSO NARRATIVO: una sola lista — y la categoría que se nombra SALE DEL DATO (`topCatName`), no de la
    // película del demo («Materiales de Construcción»/«Línea Blanca» escritas a mano eran cuentas de OTRO negocio).
    const suggestions = [];   // PODA (C-2 del retrabajo, decisión del chat principal): filterTextualSuggestions descarta TODO string desde la decisión de voz vieja (solo cognitive actions Tipo B pasan) — una lista que jamás llega a pantalla es código que miente «sugiere». Si el owner quiere sugerencias vivas acá, nacen como acciones Tipo B, encargo propio.

    // BRIEF N-bis · Tipo A puro · sugerencias filtradas (LEGACY · no-runtime · por consistencia)
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
    const m = _enM(val);   // comercial almacenado → M verdaderos · bajo $1M en K (owner 2026-08-30)
    if (Math.abs(m) < 1) return `${simboloMoneda()}${Math.round(m * 1000)}K`;
    return Number.isInteger(m) ? `${simboloMoneda()}${m}M` : `${simboloMoneda()}${m.toFixed(1)}M`;
  };
  const fmtK = (val) => {
    if (val >= 1000) {
      const k = val / 1000;
      return Number.isInteger(k) ? `${simboloMoneda()}${k}K` : `${simboloMoneda()}${k.toFixed(1)}K`;
    }
    return `${simboloMoneda()}${Math.round(val)}`;   // R7: bajo 1000 el valor NO está en miles — sufijo K acá era ×1000 de mentira
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
    const top3Pct = totalActual > 0 ? (top3Sum / totalActual) * 100 : 0;   // R7: NaN con total 0
    const top3Names = top3.map(c => c.nombre).join(", ");

    const growers = dataset
      .filter(c => c.anterior > 0 && c.actual > c.anterior)   // R7: sin año anterior no hay % (el primer archivo de un mes no divide por cero)
      .map(c => ({ ...c, g: ((c.actual - c.anterior) / c.anterior) * 100 }))
      .sort((a, b) => b.g - a.g);
    const fastest = growers[0] || null;

    const decliners = dataset
      .filter(c => c.anterior > 0 && c.actual < c.anterior)   // R7: ídem
      .map(c => ({ ...c, g: ((c.actual - c.anterior) / c.anterior) * 100 }))
      .sort((a, b) => a.g - b.g);
    const worst = decliners[0] || null;

    /* COLAPSO NARRATIVO (owner 2026-08-30, «si autorizado!»): cuatro guiones por escenario narraban la película
     * del demo sobre el dato de cualquier tenant — «Las ventas crecen −0.9%» (dirección invertida: la falta
     * sagrada) y «Tier 1»/«canal digital»/«e-commerce» inventados. Queda UNA narrativa: la dirección sale del
     * SIGNO de la variación, cada nombre sale del pack, la lectura de dependencia solo si el dato la sostiene,
     * y el siguiente paso SE OFRECE sobre un eje que el dato tiene (cuenta — el eje columna vertebral). */
    // R7: sin período anterior declarado (el primer archivo de un mes) la dirección se DECLINA, no se inventa
    // ni revienta — y la cláusula de variación se cae de b3 con él.
    const _hayGrowth = typeof growth === "number" && Number.isFinite(growth);
    const _dirVentas = !_hayGrowth ? null
      : growth > 0.5 ? `crecen ${pct1(growth)} YoY`
      : growth < -0.5 ? `caen ${pct1(growth)} YoY`
      : `están prácticamente planas YoY (${pct1(growth)})`;
    const b2 = _dirVentas ? `Las ventas ${_dirVentas}.` : `Ventas del período: ${fmtM(totalActual)} — sin período anterior declarado para comparar.`;
    const b3 = `Total ${fmtM(totalActual)}${_hayGrowth ? ` · variación ${fmtM(deltaUSD)}` : ""} · top 3 (${top3Names}) concentran ${top3Pct.toFixed(1)}%${fastest ? ` · ${fastest.nombre} crece ${pct1(fastest.g)} con carga ${fastest.pctRebate}%` : ""}${worst ? ` · ${worst.nombre} cae ${pct1(worst.g)}` : ""}.`;
    const b4 = top3Pct >= 50 ? `La dinámica de la cartera depende de pocas cuentas.` : `La venta está repartida en la cartera.`;
    const b5 = `Profundizaría primero por cuenta.`;
    const opener = [b2, b3, b4, b5].filter(Boolean).join("\n\n");

    // Suggestions intactas (D5 mantener bitwise · legacy wording)
    // COLAPSO NARRATIVO: una sola lista, cuentas por su PAPEL en el dato (la que más crece, la más grande).
    // Si no hay quien crezca, la sugerencia que la nombraba se cae sola en vez de inventar una cuenta.
    const suggestions = [];   // PODA (C-2 del retrabajo, decisión del chat principal): filterTextualSuggestions descarta TODO string desde la decisión de voz vieja (solo cognitive actions Tipo B pasan) — una lista que jamás llega a pantalla es código que miente «sugiere». Si el owner quiere sugerencias vivas acá, nacen como acciones Tipo B, encargo propio.
    // BRIEF N-bis · Tipo A puro · sugerencias filtradas
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
    const benchmark = k.benchmark || POLICY.benchmark;
    const deltaPp = margenPct - margenAnt;
    const ventaActual = vk.totalActual;

    // FIX #D-MARGEN-GAP-BENCHMARK-MIENTE · el gap a benchmark se calcula margen − benchmark (no gapPuntos
    // que es YoY). _gapBench < 0 = bajo benchmark · >= 0 = sobre. OFF: usa gapPuntos (el bug).
    const _marginGapFixOn = (typeof ADI_MARGIN_BENCHMARK_GAP_FIX_ENABLED !== "undefined" && ADI_MARGIN_BENCHMARK_GAP_FIX_ENABLED);
    const _gapBench = _marginGapFixOn ? (margenPct - benchmark) : gap;

    const gapContrib = ventaActual * (Math.abs(_gapBench) / 100);
    const erosionContrib = ventaActual * (Math.abs(deltaPp) / 100);

    const marg = clientesMargen;
    /* EL CONTRAPUNTO SE CALCULA, NO SE NOMBRA (2026-08-21). Acá decía `find(c => c.nombre === "Mercado Libre")`:
     * la cuenta que el texto usa como contraejemplo de `topRebate` estaba amarrada por NOMBRE a una del demo.
     * Con otra empresa, `ml` quedaba undefined y la línea reventaba en `ml.nombre` (no era un texto raro: era un
     * TypeError). El papel que cumple en la frase es "la que opera con la carga más baja de la cartera", que es
     * justamente lo que la hace el contrapunto estructural del que más carga concentra. Eso sí sale del dato. */
    const ml = [...marg].filter(c => c && c.tipo === "cliente").sort((a, b) => (a.pctRebate || 0) - (b.pctRebate || 0))[0];
    const _porRebates = [...marg].sort((a, b) => b.rebates - a.rebates);
    const topRebate = _porRebates[0];
    const segundoRebate = _porRebates[1];   // la segunda palanca de carga · nombra una sugerencia, no una cifra
    const masCaraDeSostener = [...marg].filter(c => c && c.tipo === "cliente")
      .sort((a, b) => (b.pctRebate || 0) - (a.pctRebate || 0))[0];   // la de mayor carga EN % de su venta

    /* COLAPSO NARRATIVO (owner 2026-08-30): los guiones por escenario («Tier 1 bajo costo real», «Tier 2»)
     * narraban reparto inventado. Queda UNA lectura: dirección por signo (_gapBench), población bajo benchmark
     * CONTADA del dato (no un tier escrito a mano), y la oferta nombra la segunda palanca REAL si existe. */
    const _nBajoBench = marg.filter((c) => c && typeof c.margen === "number" && c.margen < benchmark).length;
    const b2 = `El margen general está en ${margenPct.toFixed(1)}% · ${Math.abs(_gapBench).toFixed(1)}pp ${_gapBench >= 0 ? "sobre" : "bajo"} tu benchmark.`;
    // D2 ajuste LOCKED: NO repetir "Margen X%" de B2.
    const b3 = `Benchmark ${benchmark.toFixed(1)}% · gap ${fmtM(gapContrib)} · ${topRebate.nombre} concentra ${fmtM(topRebate.rebates)} en carga${ml && topRebate && ml.nombre !== topRebate.nombre ? ` · ${ml.nombre} opera con margen ${ml.margen.toFixed(1)}% y carga ${ml.pctRebate}%` : ""}.`;   // R7: ídem
    const b4 = `${_nBajoBench} de ${marg.length} cuentas operan bajo tu benchmark.`;
    const b5 = `Negociaría primero la carga comercial de ${topRebate.nombre}${segundoRebate ? ` · luego la de ${segundoRebate.nombre}` : ""}.`;
    const opener = [b2, b3, b4, b5].filter(Boolean).join("\n\n");

    /* COLAPSO NARRATIVO: una sola lista. Las cuentas se eligen por su PAPEL en la frase, con el criterio dicho:
     *   · "¿… está pagando lo que vale?" → la que más carga comercial concentra en $ (`topRebate`).
     *   · "¿… si bajo la carga comercial de X?" → la que le sigue: la segunda palanca de la misma naturaleza.
     *   · "¿Cuánto cuesta sostener a X?" → la de mayor carga en PORCENTAJE de su venta. */
    const suggestions = [];   // PODA (C-2 del retrabajo, decisión del chat principal): filterTextualSuggestions descarta TODO string desde la decisión de voz vieja (solo cognitive actions Tipo B pasan) — una lista que jamás llega a pantalla es código que miente «sugiere». Si el owner quiere sugerencias vivas acá, nacen como acciones Tipo B, encargo propio.
    // BRIEF N-bis · Tipo A puro · sugerencias filtradas
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
    const inmovSkus = (inmovUSD > 0) ? skuScn.filter(s => s.estado !== "Activo") : [];   // R7: el KPI del motor manda — $0 inmovilizado = cero narrativa de concentración

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

    /* COLAPSO NARRATIVO (owner 2026-08-30): los guiones por escenario afirmaban dinámica inventada («SKUs
     * cruzando a estado lento», «sobre el doble del rango base» — el dato es FOTO, no película). Queda UNA
     * lectura: cifras de la foto, concentración afirmada solo si el dato la sostiene, oferta con nombre real. */
    const b2 = `El ${inmovPct.toFixed(1)}% del inventario opera fuera de rango óptimo · cobertura promedio ${doh} días.`;
    const b3 = `Inmovilizado ${fmtK(inmovUSD)} · total ${fmtK(totalInvUSD)}${topCatName ? ` · ${topCatName} concentra ${topCatPct.toFixed(1)}% del capital inmovilizado` : ""}.`;
    // D2 ajuste LOCKED: B4 lectura ejecutiva · topCatName ya está en B3.
    const b4 = inmovUSD <= 0 ? `Sin capital inmovilizado material.`   // R7: con el KPI en $0 no hay reparto que leer
      : topCatName && topCatPct >= 50 ? `El inmovilizado se concentra en una sola línea de producto.` : `El inmovilizado está repartido entre familias.`;
    const b5 = inmovUSD <= 0 ? `Revisaría rotación por familia.`   // R7: sin inmovilizado no hay SKUs que «atacar»
      : topCatName
      ? `Atacaría primero los SKUs de ${topCatName} · luego revisaría rotación por familia.`
      : `Atacaría primero los SKUs de la categoría más concentrada · luego revisaría rotación por familia.`;
    const opener = [b2, b3, b4, b5].filter(Boolean).join("\n\n");

    // COLAPSO NARRATIVO: una sola lista — la categoría que se nombra SALE DEL DATO (`topCatName`), no de la
    // película del demo («Materiales de Construcción»/«Línea Blanca» eran cuentas de OTRO negocio).
    const suggestions = [];   // PODA (C-2 del retrabajo, decisión del chat principal): filterTextualSuggestions descarta TODO string desde la decisión de voz vieja (solo cognitive actions Tipo B pasan) — una lista que jamás llega a pantalla es código que miente «sugiere». Si el owner quiere sugerencias vivas acá, nacen como acciones Tipo B, encargo propio.
    // BRIEF N-bis · Tipo A puro · sugerencias filtradas
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
