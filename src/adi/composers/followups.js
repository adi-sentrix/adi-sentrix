import { applyScenarioToClientesMargen } from "../../engine/scenarios.js";
import { cuentasMasGrandes, filterTextualSuggestions } from "../helpers.js";
import { POLICY } from "../../config/businessPolicy.js";   // hardening · política de negocio · UNA fuente (byte-idéntico)
import { simboloMoneda } from "../../config/moneda.js";

import { getTenantData } from "../../data/tenantStore.js";
import { factorComercialDe } from "../../config/contract/figureType.js";
// unidades VERDADERAS del monto comercial ALMACENADO (barrido A·maquinaria 2026-08-30) — demo: identidad
const _enM = (v) => (Number(v) || 0) * factorComercialDe(getTenantData()) / 1e6;
const _enK = (v) => (Number(v) || 0) * factorComercialDe(getTenantData()) / 1e3;

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
      suggestions: filterTextualSuggestions(cuentasMasGrandes(dataset).map(n => `Cuéntame de ${n}`)),
      sentrixAction: null,
    };
  }

  // La cuenta contra la que se ofrece comparar: la más grande que NO sea la que se está mirando. Antes eran
  // "Jumbo" y "Lider" escritas a mano — dos cuentas del demo ofrecidas como vara a cualquier negocio.
  const referencia = cuentasMasGrandes(dataset, 2).find(n => n !== c.nombre) || null;

  // PROMEDIO SIMPLE, Y SE LLAMA ASÍ (owner 2026-08-10). Estas dos cuentas son la media SIMPLE de las filas, y el
  // texto las nombraba «el promedio de la cartera» / «el promedio interno de la cartera» — que es como el glosario
  // AUTORIZADO (CONCEPT_DEFS.promedio_cartera, el que `defineConcept` le sirve al usuario) define OTRA cosa: el
  // promedio PONDERADO POR VENTA, el único que reconcilia con el total del negocio. Los dos números no coinciden
  // (margen 27,8% simple contra 25,1% ponderado; carga 3,9% contra 4,1%), y la diferencia INVIERTE el signo de la
  // lectura: Paris queda «1,3pp debajo» del simple y 1,4pp ARRIBA del ponderado, y su carga «sobre» el simple está
  // BAJO el ponderado. ADI definía el término de una forma y medía con la otra en el turno siguiente.
  // No se cambia la cuenta —eso movería veredictos y es decisión del owner—: se DECLINA el nombre. Lo que se llama
  // «el promedio de la cartera» es el ponderado; esto es «el promedio simple de las cuentas», y lo dice.
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

    opener = `La carga comercial de ${c.nombre} es **${c.pctRebate}%** · ${Math.abs(gapVsAvg).toFixed(1)} puntos ${gapVsAvg >= 0 ? "sobre" : "bajo"} el promedio simple de las cuentas (${avgCarga.toFixed(1)}%).\n\n`;
    opener += `En valor absoluto representa **${simboloMoneda()}${(totalCarga/1000).toFixed(2)}M anuales** de rebate sobre ventas de ${simboloMoneda()}${(c.venta/1000).toFixed(1)}M. `;

    // Thresholds calibrados · D-1.5.B-HOTFIX-3-VOZ-CARGA-MODERADA firmada
    if (gapVsAvg >= 2) {
      opener += `Es de las cuentas más caras de la cartera · cada punto de rebate aquí cuesta más porque el cliente concentra volumen.\n\n`;
      opener += `**Mecanismo disponible**: la lectura natural es si ese ${c.pctRebate}% retorna volumen incremental al benchmark o solo compensa presión comercial sin upside.`;
    } else if (gapVsAvg > 0.3) {
      // FRASE FOUNDER FIRMADA
      opener += `Se ubica moderadamente sobre ese promedio simple · no explica por sí sola todo el deterioro, pero sí refuerza la necesidad de revisar la carga comercial.`;
    } else if (gapVsAvg < -1) {
      opener += `Es una de las cuentas con carga más liviana · margen libre para crecer comercialmente sin deterioro.`;
    } else {
      opener += `Está en línea con ese promedio simple · sin presión particular de renegociación pero tampoco margen estructural.`;
    }

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
      opener = `No tengo margen consolidado de ${c.nombre} en el módulo actual · si quieres revisarlo, cambia a Márgenes.`;
      suggestions = filterTextualSuggestions([
        `Cuéntame de ${c.nombre} en márgenes`,
        "Top clientes por margen",
      ]);
      return { opener, suggestions, sentrixAction: null };
    }

    const gapVsBench = c.margen - benchmark;
    const gapVsAvgInternal = c.margen - avgMargen;

    opener = `${c.nombre} opera con margen **${c.margen}%** · ${Math.abs(gapVsBench).toFixed(1)} puntos ${gapVsBench >= 0 ? "sobre" : "bajo"} tu benchmark (${benchmark}%).\n\n`;
    opener += `Frente al promedio simple de las cuentas (${avgMargen.toFixed(1)}%), está ${Math.abs(gapVsAvgInternal).toFixed(1)}pp ${gapVsAvgInternal >= 0 ? "arriba" : "debajo"}. `;

    if (gapVsBench < -3) {
      const destruccion = Math.round(_enK(c.venta * (benchmark - c.margen) / 100));
      opener += `La cuenta está cediendo margen: aproximadamente **${simboloMoneda()}${destruccion}K anuales** de contribución no capturada por estar bajo benchmark.\n\n`;
      opener += `**Mecanismo disponible**: el cruce margen vs carga comercial es la lectura natural · si ${c.nombre} tiene carga sobre ese promedio simple (${avgCarga.toFixed(1)}%), la palanca de rebate opera antes que la de precio.`;
    } else if (gapVsBench >= 0) {
      // MISMO DEFECTO QUE comparisons.js (owner 2026-08-09, decisión 1 · hallazgo N): la rama entra por
      // `gapVsBench >= 0` —está sobre la VARA— y la frase nombraba el PROMEDIO. Y acá era peor: dos líneas más
      // arriba este mismo texto ya imprimió el promedio interno real de la cartera, que es otro número. Dos
      // referencias distintas con el mismo nombre en el mismo párrafo.
      opener += `La cuenta sostiene margen sobre tu benchmark.`;
    } else {
      opener += `Margen razonable pero hay espacio · existen 2 palancas disponibles: composición del mix y carga comercial.`;
    }

    suggestions = filterTextualSuggestions([
      `¿Por qué ${c.nombre} está bajo benchmark?`,
      ...(referencia ? [`Compara con ${referencia}`] : []),
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
      opener = `No tengo contribución consolidada de ${c.nombre} en el módulo actual · ese dato vive en Márgenes. Si quieres revisarlo, cambia a Márgenes y vuelvo a calcular.`;
      suggestions = filterTextualSuggestions([
        `Cuéntame de ${c.nombre} en márgenes`,
        "Top contribuciones",
      ]);
      return { opener, suggestions, sentrixAction: null };
    }
    const totalCartera = dataset.reduce((s, x) => s + (x.contribucion || 0), 0);
    const pctCartera = totalCartera > 0 ? (c.contribucion / totalCartera * 100) : 0;

    opener = `${c.nombre} aporta **${simboloMoneda()}${(c.contribucion/1000).toFixed(2)}M** de contribución · `;
    opener += `**${pctCartera.toFixed(1)}%** de la cartera total (${simboloMoneda()}${(totalCartera/1000).toFixed(1)}M).\n\n`;

    if (pctCartera > 15) {
      opener += `Es una cuenta estructural · una salida total significaría perder ${simboloMoneda()}${(c.contribucion/1000).toFixed(1)}M de contribución que el resto de la cartera difícilmente absorbe.`;
    } else {
      opener += `Aporte relevante pero no dependiente · la cartera tiene resiliencia ante variaciones de esta cuenta.`;
    }

    suggestions = filterTextualSuggestions([
      `¿Qué pasaría si pierdo a ${c.nombre}?`,
      `Top contribuciones`,
      ...(referencia ? [`Compara con ${referencia}`] : []),
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

    opener = `${c.nombre} factura **${simboloMoneda()}${(c.venta/1000).toFixed(1)}M** anuales · `;
    opener += `**${pctCartera.toFixed(1)}%** del volumen total de la cartera.\n\n`;
    if (c.sfamilia && c.marca) {
      opener += `El cliente opera en ${c.sfamilia} con marca principal ${c.marca}. `;
    }
    opener += `Cada $1 vendido aporta ${simboloMoneda()}${ratioContrib.toFixed(2)} de contribución después de carga.`;

    suggestions = filterTextualSuggestions([
      `¿Cuánto creció ${c.nombre} YoY?`,
      ...(referencia ? [`Compara con ${referencia}`] : []),
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
    opener = `No tengo cobertura determinística para la métrica "${metricKey}" sobre ${c.nombre} en este escenario. Puedo revisar carga, margen, contribución o ventas · dime cuál te interesa.`;
    suggestions = filterTextualSuggestions([
      `Cuéntame de ${c.nombre}`,
      `Y la carga de ${c.nombre}`,
      `Y el margen de ${c.nombre}`,
    ]);
    sentrixAction = null;
  }

  return { opener, suggestions, sentrixAction };
}
