import { applyScenarioToClientesMargen } from "../../engine/scenarios.js";
import { filterTextualSuggestions } from "../helpers.js";
import { POLICY } from "../../config/businessPolicy.js";   // hardening · política de negocio · UNA fuente (byte-idéntico)

export function composeClientMetricFollowUp(clientName, metricKey, scenario, modulo) {
  // FASE 1.5.B-HOTFIX-3-PATCH-3 · cross-dataset
  // ADI como asesor opera a nivel negocio (no limitado por módulo visible) ·
  // coherente con #DIRECCION-FUTURA-RESUMEN-EJECUTIVO-DUAL firmada.
  // Los followups métricos (carga, margen, contribución, ventas) son 
  // preguntas cross-dominio · siempre leen clientesMargen que tiene shape 
  // completo (todos los 13 clientes con todos los fields).
  //
  // Sentrix action sigue apuntando al módulo correcto según métrica:
  //   carga, margen, contribucion → Márgenes (donde viven los datos)
  //   ventas → Ventas (cifra runtime canónica)
  const dataset = applyScenarioToClientesMargen(scenario);

  const c = dataset.find(x => x.nombre === clientName);
  if (!c) {
    return {
      opener: `No tengo a ${clientName} en el detalle de la cartera de este escenario.`,
      suggestions: filterTextualSuggestions([
        "Cuéntame de Falabella",
        "Cuéntame de Lider",
        "Cuéntame de Jumbo",
      ]),
      sentrixAction: null,
    };
  }

  // Promedios de cartera · benchmarks internos
  const avgCarga = dataset.reduce((s, x) => s + (x.pctRebate || 0), 0) / dataset.length;
  const avgMargen = dataset
    .filter(x => x.margen !== null && x.margen !== undefined)
    .reduce((s, x, _, arr) => s + x.margen / arr.length, 0);
  const benchmark = c.benchmark || POLICY.benchmark;

  let opener = "";
  let suggestions = [];
  let sentrixAction = null;

  // ── Rama CARGA / REBATE ─────────────────────────────────────────────────
  if (metricKey === "carga") {
    const gapVsAvg = c.pctRebate - avgCarga;
    const totalCarga = c.rebates;

    opener = `La carga comercial de ${c.nombre} es **${c.pctRebate}%** · ${Math.abs(gapVsAvg).toFixed(1)} puntos ${gapVsAvg >= 0 ? "sobre" : "bajo"} el promedio de la cartera (${avgCarga.toFixed(1)}%).\n\n`;
    opener += `En valor absoluto representa **$${(totalCarga/1000).toFixed(2)}M anuales** de rebate sobre ventas de $${(c.venta/1000).toFixed(1)}M. `;

    // Thresholds calibrados · D-1.5.B-HOTFIX-3-VOZ-CARGA-MODERADA firmada
    if (gapVsAvg >= 2) {
      opener += `Es de las cuentas más caras de la cartera · cada punto de rebate aquí cuesta más porque el cliente concentra volumen.\n\n`;
      opener += `**Mecanismo disponible**: la lectura natural es si ese ${c.pctRebate}% retorna volumen incremental al benchmark o solo compensa presión comercial sin upside.`;
    } else if (gapVsAvg > 0.3) {
      // FRASE FOUNDER FIRMADA
      opener += `Se ubica moderadamente sobre el promedio de cartera · no explica por sí sola todo el deterioro, pero sí refuerza la necesidad de revisar la carga comercial.`;
    } else if (gapVsAvg < -1) {
      opener += `Es una de las cuentas con carga más liviana · margen libre para crecer comercialmente sin deterioro.`;
    } else {
      opener += `Está en línea con el promedio · sin presión particular de renegociación pero tampoco margen estructural.`;
    }
    opener += `\n\n*Confianza alta · cifras runtime sobre escenario ${scenario}.*`;

    suggestions = filterTextualSuggestions([
      `Compara la carga de ${c.nombre} con el resto`,
      `¿Cuánto recupero si bajo 1 punto?`,
      "Ver Top clientes por carga",
    ]);
    sentrixAction = {
      label: `↗ Ver ${c.nombre}`,
      payload: { module: "margenes", focus: "carga", client: c.nombre },
      moduleChip: "Márgenes",
    };
  }

  // ── Rama MARGEN ─────────────────────────────────────────────────────────
  else if (metricKey === "margen") {
    if (c.margen === null || c.margen === undefined) {
      opener = `No tengo margen consolidado de ${c.nombre} en el módulo actual · si querés revisarlo, cambiá a Márgenes.`;
      suggestions = filterTextualSuggestions([
        `Cuéntame de ${c.nombre} en márgenes`,
        "Top clientes por margen",
      ]);
      return { opener, suggestions, sentrixAction: null };
    }

    const gapVsBench = c.margen - benchmark;
    const gapVsAvgInternal = c.margen - avgMargen;

    opener = `${c.nombre} opera con margen **${c.margen}%** · ${Math.abs(gapVsBench).toFixed(1)} puntos ${gapVsBench >= 0 ? "sobre" : "bajo"} el benchmark de industria (${benchmark}%).\n\n`;
    opener += `Frente al promedio interno de la cartera (${avgMargen.toFixed(1)}%), está ${Math.abs(gapVsAvgInternal).toFixed(1)}pp ${gapVsAvgInternal >= 0 ? "arriba" : "debajo"}. `;

    if (gapVsBench < -3) {
      const destruccion = Math.round(c.venta * (benchmark - c.margen) / 100);
      opener += `La cuenta está sub-rentabilizando: aproximadamente **$${destruccion}K anuales** de contribución no capturada por estar bajo benchmark.\n\n`;
      opener += `**Mecanismo disponible**: el cruce margen vs carga comercial es la lectura natural · si ${c.nombre} tiene carga sobre promedio (${avgCarga.toFixed(1)}%), la palanca de rebate opera antes que la de precio.`;
    } else if (gapVsBench >= 0) {
      opener += `La cuenta es estructuralmente rentable · sostiene el promedio de la cartera.`;
    } else {
      opener += `Margen razonable pero hay espacio · existen 2 palancas disponibles: composición del mix y carga comercial.`;
    }
    opener += `\n\n*Confianza alta · cifras runtime sobre escenario ${scenario}.*`;

    suggestions = filterTextualSuggestions([
      `¿Por qué ${c.nombre} está bajo benchmark?`,
      `Compara con Jumbo`,
      "Ver erosión de margen",
    ]);
    sentrixAction = {
      label: `↗ Ver ${c.nombre}`,
      payload: { module: "margenes", focus: "margen", client: c.nombre },
      moduleChip: "Márgenes",
    };
  }

  // ── Rama CONTRIBUCIÓN ───────────────────────────────────────────────────
  else if (metricKey === "contribucion") {
    // FASE 1.5.B-HOTFIX-3 · Honest fail si dataset no tiene contribución
    // (módulo ventas trae clientesVentas que NO expone contribucion · solo
    // clientesMargen sí). Evita reportar "$0.00M" engañoso.
    if (!c.contribucion || c.contribucion === 0) {
      opener = `No tengo contribución consolidada de ${c.nombre} en el módulo actual · ese dato vive en Márgenes. Si querés revisarlo, cambiá a Márgenes y vuelvo a calcular.`;
      suggestions = filterTextualSuggestions([
        `Cuéntame de ${c.nombre} en márgenes`,
        "Top contribuciones",
      ]);
      return { opener, suggestions, sentrixAction: null };
    }
    const totalCartera = dataset.reduce((s, x) => s + (x.contribucion || 0), 0);
    const pctCartera = totalCartera > 0 ? (c.contribucion / totalCartera * 100) : 0;

    opener = `${c.nombre} aporta **$${(c.contribucion/1000).toFixed(2)}M** de contribución · `;
    opener += `**${pctCartera.toFixed(1)}%** de la cartera total ($${(totalCartera/1000).toFixed(1)}M).\n\n`;

    if (pctCartera > 15) {
      opener += `Es una cuenta estructural · una salida total significaría perder $${(c.contribucion/1000).toFixed(1)}M de contribución que el resto de la cartera difícilmente absorbe.`;
    } else {
      opener += `Aporte relevante pero no dependiente · la cartera tiene resiliencia ante variaciones de esta cuenta.`;
    }
    opener += `\n\n*Confianza alta · cifras runtime sobre escenario ${scenario}.*`;

    suggestions = filterTextualSuggestions([
      `¿Qué pasaría si pierdo a ${c.nombre}?`,
      `Top contribuciones`,
      `Compara con Lider`,
    ]);
    sentrixAction = {
      label: `↗ Ver ${c.nombre}`,
      payload: { module: "margenes", focus: "contribucion", client: c.nombre },
      moduleChip: "Márgenes",
    };
  }

  // ── Rama VENTAS ─────────────────────────────────────────────────────────
  else if (metricKey === "ventas") {
    const totalCartera = dataset.reduce((s, x) => s + x.venta, 0);
    const pctCartera = (c.venta / totalCartera * 100);
    const ratioContrib = c.venta > 0 ? (c.contribucion / c.venta) : 0;

    opener = `${c.nombre} factura **$${(c.venta/1000).toFixed(1)}M** anuales · `;
    opener += `**${pctCartera.toFixed(1)}%** del volumen total de la cartera.\n\n`;
    if (c.sfamilia && c.marca) {
      opener += `El cliente opera en ${c.sfamilia} con marca principal ${c.marca}. `;
    }
    opener += `Cada $1 vendido aporta $${ratioContrib.toFixed(2)} de contribución después de carga.`;
    opener += `\n\n*Confianza alta · cifras runtime sobre escenario ${scenario}.*`;

    suggestions = filterTextualSuggestions([
      `¿Cuánto creció ${c.nombre} YoY?`,
      `Compara con Jumbo`,
      "Top clientes por venta",
    ]);
    sentrixAction = {
      label: `↗ Ver ${c.nombre}`,
      payload: { module: "ventas", focus: "ventas", client: c.nombre },
      moduleChip: "Ventas",
    };
  }

  // ── Fallback métrica no cubierta (rotacion, cobertura, etc) ─────────────
  else {
    opener = `No tengo cobertura determinística para la métrica "${metricKey}" sobre ${c.nombre} en este escenario. Puedo revisar carga, margen, contribución o ventas · decime cuál te interesa.`;
    suggestions = filterTextualSuggestions([
      `Cuéntame de ${c.nombre}`,
      `Y la carga de ${c.nombre}`,
      `Y el margen de ${c.nombre}`,
    ]);
    sentrixAction = null;
  }

  return { opener, suggestions, sentrixAction };
}
