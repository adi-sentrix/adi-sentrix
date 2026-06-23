import { applyScenarioToClientesMargen } from "../../engine/scenarios.js";
import { filterTextualSuggestions } from "../helpers.js";
import { _bFmt1, _bFmt2, _brandHasClientWorld, _brandRow } from "../router.js";
import { _cmpRatio } from "./warehouse.js";

function composeClientComparison(clientA_name, clientB_name, scenario, modulo) {
  // FASE 1.5.B-HOTFIX-3-PATCH-3 · cross-dataset
  // La comparación entre 2 clientes es cross-dominio por naturaleza ·
  // ADI como asesor reúne TODA la información disponible para apoyar 
  // decisión (no devuelve al usuario a cambiar de módulo · eso es 
  // navegación, no asesoría).
  //
  // Lectura COMPLETA · escala (venta) + eficiencia (margen) + carga + 
  // contribución absoluta · todo viene de clientesMargen.
  //
  // Sentrix action apunta SIEMPRE a Márgenes (donde viven todos los 
  // fields del análisis comparativo). El módulo de origen ya no 
  // determina la respuesta.
  const dataset = applyScenarioToClientesMargen(scenario);

  const A = dataset.find(x => x.nombre === clientA_name);
  const B = dataset.find(x => x.nombre === clientB_name);

  if (!A || !B) {
    const missing = !A ? clientA_name : clientB_name;
    return {
      opener: `No tengo a ${missing} en el detalle de la cartera de este escenario.`,
      suggestions: filterTextualSuggestions([
        "Cuéntame de Falabella",
        "Cuéntame de Lider",
        "Cuéntame de Jumbo",
      ]),
      sentrixAction: null,
    };
  }

  const benchmark = A.benchmark || 30.1;

  // Cálculos comparativos
  const diffVentas = A.venta - B.venta;
  const diffContrib = A.contribucion - B.contribucion;
  const diffCarga = A.pctRebate - B.pctRebate;
  const diffMargen = (A.margen !== null && B.margen !== null) ? (A.margen - B.margen) : null;

  const totalCartera = dataset.reduce((s, x) => s + x.venta, 0);
  const totalContrib = dataset.reduce((s, x) => s + (x.contribucion || 0), 0);
  const pctA_v = (A.venta / totalCartera * 100);
  const pctB_v = (B.venta / totalCartera * 100);
  const pctA_c = totalContrib > 0 ? (A.contribucion / totalContrib * 100) : 0;
  const pctB_c = totalContrib > 0 ? (B.contribucion / totalContrib * 100) : 0;

  // Detección de dimensión dominante · D-VOZ-V3 thresholds calibrados
  const ventasSimilar = Math.abs(diffVentas / A.venta) < 0.20;
  const margenSimilar = diffMargen === null ? true : Math.abs(diffMargen) < 1;

  // Lead insight calibrado · NO fuerza diferenciación
  let leadInsight = "";
  if (ventasSimilar && margenSimilar) {
    leadInsight = `Dos cuentas estructuralmente parecidas · escala y eficiencia operan en el mismo orden de magnitud.`;
  } else if (ventasSimilar && !margenSimilar) {
    leadInsight = `Las dos cuentas operan en escala similar · la diferencia real está en eficiencia, no en tamaño.`;
  } else if (!ventasSimilar && margenSimilar) {
    leadInsight = `Margen parecido entre ambas · la diferencia es de escala y peso en la cartera.`;
  } else {
    leadInsight = `Ambas dimensiones (escala y eficiencia) divergen entre estas dos cuentas.`;
  }

  // Opener estructurado
  let opener = `**${A.nombre} vs ${B.nombre}** · ${leadInsight}\n\n`;

  // Bloque Volumen
  opener += `**Volumen:** ${A.nombre} factura $${(A.venta/1000).toFixed(1)}M (${pctA_v.toFixed(1)}% cartera) · ${B.nombre} $${(B.venta/1000).toFixed(1)}M (${pctB_v.toFixed(1)}%). `;
  if (ventasSimilar) {
    opener += `Escala equivalente.\n\n`;
  } else {
    opener += `Brecha de $${(Math.abs(diffVentas)/1000).toFixed(1)}M.\n\n`;
  }

  // Bloque Margen (solo si ambos tienen margen)
  if (diffMargen !== null) {
    opener += `**Margen:** ${A.nombre} ${A.margen}% · ${B.nombre} ${B.margen}% · `;
    opener += `ambos ${Math.min(A.margen, B.margen) < benchmark ? "bajo" : "sobre"} benchmark (${benchmark}%). `;
    if (margenSimilar) {
      opener += `Brecha de ${Math.abs(diffMargen).toFixed(1)}pp · despreciable.\n\n`;
    } else {
      const ganador = diffMargen > 0 ? A.nombre : B.nombre;
      opener += `${ganador} aventaja por ${Math.abs(diffMargen).toFixed(1)}pp.\n\n`;
    }
  }

  // Bloque Carga
  opener += `**Carga comercial:** ${A.nombre} ${A.pctRebate}% · ${B.nombre} ${B.pctRebate}%. `;
  if (Math.abs(diffCarga) >= 0.3) {
    const masCargada = diffCarga > 0 ? A.nombre : B.nombre;
    opener += `${masCargada} carga ${Math.abs(diffCarga).toFixed(1)}pp más rebate, lo que explica parte del gap de margen.\n\n`;
  } else {
    opener += `Carga prácticamente idéntica · la diferencia de margen NO viene de rebates.\n\n`;
  }

  // Bloque Contribución
  opener += `**Contribución absoluta:** ${A.nombre} aporta $${(A.contribucion/1000).toFixed(2)}M (${pctA_c.toFixed(1)}% cartera) · ${B.nombre} $${(B.contribucion/1000).toFixed(2)}M (${pctB_c.toFixed(1)}%).\n\n`;

  // Lectura ejecutiva · D-VOZ-V3 · interpretación con inmaterialidad
  const sumPctCartera = pctA_v + pctB_v;
  const ambosTier1 = (pctA_v + pctB_v) > 50;  // si juntos son >50%, son Tier 1 estructural

  if (diffMargen !== null && A.margen < benchmark && B.margen < benchmark) {
    if (ventasSimilar && margenSimilar && ambosTier1) {
      // Inserción del insight Tier 1 cuando aplica
      opener += `**Lectura**: ambas operan bajo benchmark con perfiles muy similares · representan el bloque estructural del Tier 1 que concentra el ${sumPctCartera.toFixed(1)}% del volumen y ${(pctA_c + pctB_c).toFixed(1)}% de la contribución. La palanca opera sobre el bloque como conjunto · la diferencia entre las dos cuentas es inmaterial para esa decisión.`;
    } else if (margenSimilar) {
      opener += `**Lectura**: ambas operan bajo benchmark con margen muy similar · la palanca opera sobre ambas por igual · la brecha entre las cuentas es marginal frente al gap vs benchmark.`;
    } else {
      const peorMargen = A.margen < B.margen ? A : B;
      const avgC = dataset.reduce((s, x) => s + (x.pctRebate || 0), 0) / dataset.length;
      const palancaDisponible = peorMargen.pctRebate > avgC ? "carga comercial" : "mix de productos";
      opener += `**Lectura**: ambas operan bajo benchmark · ${peorMargen.nombre} es el caso más crítico con ${Math.abs(peorMargen.margen - benchmark).toFixed(1)}pp bajo benchmark. La palanca disponible opera sobre ${palancaDisponible}.`;
    }
  } else if (diffMargen !== null && A.margen >= benchmark && B.margen >= benchmark) {
    opener += `**Lectura**: ambas cuentas son estructuralmente rentables · sostienen el promedio de la cartera.`;
  } else if (diffMargen !== null) {
    const enriesgo = A.margen < benchmark ? A : B;
    opener += `**Lectura**: ${enriesgo.nombre} es la que sub-rentabiliza · la palanca opera sobre esa cuenta · la otra es estructuralmente sana en margen.`;
  } else {
    // Caso ventas sin margen
    if (ventasSimilar) {
      opener += `**Lectura**: ambas operan en escala equivalente · la diferencia real (si existe) habría que buscarla en margen, no en volumen.`;
    } else {
      const masGrande = diffVentas > 0 ? A.nombre : B.nombre;
      opener += `**Lectura**: ${masGrande} concentra más peso de cartera · su evolución impacta más en el agregado.`;
    }
  }

  opener += `\n\n*Confianza alta · cifras runtime sobre escenario ${scenario}.*`;

  const suggestions = filterTextualSuggestions([
    `¿Por qué ${A.nombre} pierde margen?`,
    `¿Qué pasaría si pierdo a ${A.nombre}?`,
    `Compara ${B.nombre} con Jumbo`,
  ]);

  // FASE 1.5.B-HOTFIX-3-PATCH-3 · Sentrix action apunta a Márgenes
  // (donde viven los datos del análisis comparativo · cross-dataset).
  const sentrixAction = {
    label: `↗ Ver ${A.nombre} vs ${B.nombre}`,
    payload: { module: "margenes", focus: "comparison", clients: [A.nombre, B.nombre] },
    moduleChip: "Márgenes",
  };

  return { opener, suggestions, sentrixAction };
}

function composeBrandComparison(brandA, brandB, scenarioId) {
  const A = _brandRow(brandA), B = _brandRow(brandB);
  if (!A || !B) return { opener: `No tengo a ${!A ? brandA : brandB} en la vista de marca.`, suggestions: filterTextualSuggestions([]), sentrixAction: null, derivedModule: "margenes" };
  const dVenta = A.venta - B.venta;
  const dContrib = A.contribucion - B.contribucion;
  const dMargen = A.margen - B.margen;
  const ganaEscala = A.venta >= B.venta ? brandA : brandB;
  const ganaMargen = A.margen >= B.margen ? brandA : brandB;
  const margenParejo = Math.abs(dMargen) < 1;
  const lead = margenParejo
    ? `${ganaEscala} gana escala, margen parejo.`
    : (ganaEscala === ganaMargen ? `${ganaEscala} domina en escala y eficiencia.` : `${ganaEscala} gana escala, ${ganaMargen} gana margen.`);
  let opener = `**${brandA} vs ${brandB}** (vista de marca) · ${lead}\n\n`;
  opener += `Venta: ${_bFmt1(A.venta)} vs ${_bFmt1(B.venta)} (${ganaEscala} ${_cmpRatio(A.venta, B.venta).toFixed(1)}× · Δ ${(dVenta >= 0 ? "+" : "\u2212") + _bFmt1(Math.abs(dVenta))}). Contribución: ${_bFmt2(A.contribucion)} vs ${_bFmt2(B.contribucion)}. Margen: ${A.margen.toFixed(1)}% vs ${B.margen.toFixed(1)}% (${margenParejo ? "parejo" : ganaMargen + " +" + Math.abs(dMargen).toFixed(1) + "pp"}).\n\n`;
  opener += `Veredicto: ${ganaEscala} pesa más${margenParejo ? "; márgenes parejos" : "; " + ganaMargen + " rinde mejor por peso vendido"}.`;
  // Linaje: si alguna no tiene mundo-cliente (Makita), declararlo.
  const sinCli = [brandA, brandB].filter(b => !_brandHasClientWorld(b));
  if (sinCli.length) opener += `\n\n${sinCli.join(" y ")} está completa en la vista de marca pero sin cobertura comercial por cliente — la comparación es mundo-marca (estática), no reconcilia con el mundo-cliente scenario-aware.`;
  return {
    opener,
    suggestions: filterTextualSuggestions([`Háblame de ${brandA}`, `Háblame de ${brandB}`, "Margen por marca"]),
    sentrixAction: { label: "Ver márgenes", moduleChip: "Márgenes", payload: { modulo: "margenes", clientes: [], skus: [] } },
    derivedModule: "margenes",
  };
}

export { composeClientComparison, composeBrandComparison };
