/* === adi/composers/inverse.js ===
 * Composer de ancla extraído de 41cc33d8 · verbatim · solo imports agregados. */
import { FEATURE_INVERSE_PROJECTION, FEATURE_PORTFOLIO_INVERSE } from "../../config/features.js";
import { SUPERFAMILIAS } from "../../data/catalogs.js";
import { skusMargen } from "../../data/skusMargen.js";
import { applyScenarioToClientesMargen, applyScenarioToSfamiliasMargen } from "../../engine/scenarios.js";
import { detectClientInText, detectSkuInText } from "../detectors.js";
import { filterTextualSuggestions, normalizeText } from "../helpers.js";

export function _parseCurrencyK(raw) {
  if (!raw) return null;
  const t = normalizeText(raw);
  // millones: "$2M" · "2 millones" · "2 millon"
  let m = t.match(/(?<![a-z0-9-])(\d+(?:[.,]\d+)?)\s*(?:m\b|millon(?:es)?\b)/);
  if (m) return Math.round(parseFloat(m[1].replace(",", ".")) * 1000);
  // miles: "$500K" · "500 mil" · "500k"
  m = t.match(/(?<![a-z0-9-])(\d+(?:[.,]\d+)?)\s*(?:k\b|mil\b)/);
  if (m) return Math.round(parseFloat(m[1].replace(",", ".")));
  return null;
}

export function extractInverseProjection(text, scenarioId) {
  if (!FEATURE_INVERSE_PROJECTION || !text || typeof text !== "string") return null;
  const raw = text;
  const norm = normalizeText(text);
  // Marco de objetivo de contribución: verbo de aporte O la palabra "contribución".
  const aporteVerb = /\b(aportar|aporte|aporta|generar|genere|genera|lograr|logre|contribuir|contribuya)\b/.test(norm);
  const contribWord = /\bcontribucion(es)?\b/.test(norm);
  if (!aporteVerb && !contribWord) return null;
  // Monto en moneda (distinto del % de los levers).
  const target = _parseCurrencyK(raw);
  if (target == null) return null;
  // Alcance · precedencia SKU > cliente > familia.
  let scope = null, scopeType = null;
  const skuM = detectSkuInText(raw);
  if (skuM) { scope = skuM; scopeType = "sku"; }
  else {
    const cliM = detectClientInText(raw);
    if (cliM) { scope = cliM; scopeType = "cliente"; }
    else {
      const _famAliases = { "Electrodomésticos": ["electro"], "Materiales de Construcción": ["construccion", "materiales"] };
      for (const fam of SUPERFAMILIAS.slice(1)) {
        const tokens = [normalizeText(fam), ...(_famAliases[fam] || [])];
        if (tokens.some(t => t && norm.includes(t))) { scope = fam; scopeType = "familia"; break; }
      }
    }
  }
  // Total vs adicional (§3). Total marcado tiene prioridad; luego adicional; si no, ambiguo.
  let modo = "ambiguo";
  if (/\b(adicional(es)?|extra|sumar)\b/.test(norm) || /\bmas\b/.test(norm) || /\bcrecer\b/.test(norm)) modo = "adicional";
  if (/\b(llegar a|alcanzar|un total de|total|que aporte|que genere|que contribuya)\b/.test(norm)) modo = "total";
  // Sin entidad pero con objetivo → honestidad de cartera (§6) / sobre determinístico
  // del capstone (§2-§4). Se incluye `modo` (reusando la detección de arriba) para que
  // composePortfolioInverse distinga total/adicional. OFF: el modo extra es inerte.
  if (!scope) return { inverse: { noEntity: true, target, modo } };
  return { inverse: { scope, scopeType, target, modo } };
}

export function composePortfolioInverse(inv, scenarioId) {
  const fmtM = (k) => `$${(k / 1000).toFixed(2)}M`;       // $K → $X.XXM
  const pct  = (x) => `${(x * 100).toFixed(1)}%`;
  const cm = applyScenarioToClientesMargen(scenarioId) || [];

  // Degradación honesta (§5.5): <2 entidades con margen calculable, o ΣV=0.
  const valid = cm.filter(c => c && c.venta > 0 && typeof c.contribucion === "number");
  if (valid.length < 2) {
    return {
      opener: `No tengo base suficiente para el sobre de cartera en este escenario: necesito al menos dos entidades con venta y margen calculables.`,
      suggestions: filterTextualSuggestions([]),
      sentrixAction: null,
      derivedModule: "margenes",
    };
  }
  const SV = valid.reduce((a, c) => a + c.venta, 0);
  const SC = valid.reduce((a, c) => a + c.contribucion, 0);
  if (!(SV > 0)) {
    return {
      opener: `No tengo base suficiente: la cartera no tiene venta agregada en este escenario.`,
      suggestions: filterTextualSuggestions([]),
      sentrixAction: null,
      derivedModule: "margenes",
    };
  }
  const blended = SC / SV;

  // Entidades de mayor / menor margen efectivo (reales · §2).
  let eMax = valid[0], eMin = valid[0];
  for (const c of valid) {
    const m = c.contribucion / c.venta;
    if (m > eMax.contribucion / eMax.venta) eMax = c;
    if (m < eMin.contribucion / eMin.venta) eMin = c;
  }
  const mMax = eMax.contribucion / eMax.venta;   // borde eficiente (mínima venta)
  const mMin = eMin.contribucion / eMin.venta;   // borde caro (máxima venta)

  // Total vs adicional (§3) · ambiguo → default Corte 7, declarado.
  const target = inv.target;
  let modo = inv.modo || "ambiguo";
  let ambiguo = false;
  if (modo === "ambiguo") { ambiguo = true; modo = target > SC ? "total" : "adicional"; }
  const incrementoContrib = modo === "adicional" ? target : (target - SC);

  // Edge (§3): total ya superado.
  if (incrementoContrib <= 0) {
    return {
      opener: `La cartera ya aporta ${fmtM(SC)} de contribución, por encima del objetivo de ${fmtM(target)}. No necesitás crecer para llegar ahí.`,
      suggestions: filterTextualSuggestions(["Margen por cliente", "Cuánto debe vender Falabella para aportar $1M adicional"]),
      sentrixAction: { label: "Ver márgenes", moduleChip: "Márgenes", payload: { modulo: "margenes", clientes: [], skus: [] } },
      derivedModule: "margenes",
    };
  }

  // El sobre (§2).
  const ventaUniforme = incrementoContrib / blended;
  const ventaMin = incrementoContrib / mMax;     // vía mayor margen
  const ventaMax = incrementoContrib / mMin;     // vía menor margen

  // Interpretación SIEMPRE explícita (§3).
  const interp = modo === "adicional"
    ? `interpreto como adicional sobre los ${fmtM(SC)} actuales`
    : (ambiguo
        ? `interpreto como total — alcanzar ${fmtM(target)} desde los ${fmtM(SC)} actuales; si era adicional, decímelo`
        : `interpreto como total: alcanzar ${fmtM(target)} desde los ${fmtM(SC)} actuales`);
  const head = modo === "adicional"
    ? `Para +${fmtM(target)} de contribución adicional`
    : `Para ${fmtM(target)} de contribución total`;

  let opener = `${head} (${interp}): si toda la cartera crece proporcionalmente (margen blended ${pct(blended)}), necesitás vender +${fmtM(ventaUniforme)}. `;
  opener += `El rango determinístico va de +${fmtM(ventaMin)} (si todo creciera vía la entidad de mayor margen, ${eMax.nombre} ${pct(mMax)}) a +${fmtM(ventaMax)} (vía la de menor margen, ${eMin.nombre} ${pct(mMin)}).`;
  // Límite del óptimo (§4) · borde como límite, NO como plan.
  opener += `\n\nEl borde eficiente (+${fmtM(ventaMin)}) asume que todo el crecimiento ocurre en la entidad de mayor margen (${eMax.nombre}, ${pct(mMax)}). Es un límite matemático, no un plan operativo. Recomendar un mix óptimo real requiere capacidad/topes de crecimiento por entidad, que este dataset no trae.`;

  return {
    opener,
    suggestions: filterTextualSuggestions([`Cuánto debe vender ${eMin.nombre} para aportar ${fmtM(target)}`, "Margen por cliente"]),
    sentrixAction: { label: "Ver márgenes", moduleChip: "Márgenes", payload: { modulo: "margenes", clientes: [], skus: [] } },
    derivedModule: "margenes",
  };
}

export function composeInverseProjection(payload, scenarioId) {
  if (!FEATURE_INVERSE_PROJECTION || !payload || !payload.inverse) return null;
  const inv = payload.inverse;
  const fmtM = (k) => `$${(k / 1000).toFixed(2)}M`;   // $K → $X.XXM

  // ── Honestidad de cartera (§6) · objetivo sin entidad ──
  // ON → sobre determinístico (composePortfolioInverse). OFF → fallback Corte 7 intacto.
  if (inv.noEntity) {
    if (FEATURE_PORTFOLIO_INVERSE) return composePortfolioInverse(inv, scenarioId);
    return {
      opener: `Sin elegir dónde crecer, hay múltiples soluciones: la venta requerida depende del margen de la entidad que empuje el crecimiento. Puedo calcularlo para un cliente, familia o SKU específico, o mostrarte el rango entre la entidad de menor y mayor margen.`,
      suggestions: filterTextualSuggestions(["Cuánto debe vender Falabella para aportar $5M", "Cuánto debe vender Línea Blanca para aportar $500K adicional"]),
      sentrixAction: null,
      derivedModule: "margenes",
    };
  }

  // ── Resolver entidad · venta/contribución actuales (fuente §4) ──
  let venta = null, contrib = null, nombre = inv.scope, fuenteNota = "";
  if (inv.scopeType === "cliente") {
    const r = applyScenarioToClientesMargen(scenarioId).find(c => c.nombre === inv.scope);
    if (r) { venta = r.venta; contrib = r.contribucion; nombre = r.nombre; }
  } else if (inv.scopeType === "familia") {
    const r = applyScenarioToSfamiliasMargen(scenarioId).find(f => f.sfamilia === inv.scope);
    if (r) { venta = r.venta; contrib = r.contribucion; nombre = r.sfamilia; }
  } else if (inv.scopeType === "sku") {
    const r = skusMargen.find(s => s.nombre === inv.scope);
    if (r) { venta = r.venta; contrib = r.contribucion; nombre = r.nombre; fuenteNota = " (dato directo del SKU)"; }
  }
  if (venta == null || !venta) {
    return { opener: `No tengo a ${inv.scope} en el detalle de este escenario.`, suggestions: filterTextualSuggestions([]), sentrixAction: null, derivedModule: "margenes" };
  }

  const margenEf = contrib / venta;   // margen EFECTIVO (criterio 2 · cierra el álgebra)

  // ── Resolver modo (ambiguo → default §3) ──
  let modo = inv.modo;
  if (modo === "ambiguo") modo = inv.target > contrib ? "total" : "adicional";

  // ── Cálculo §2 ──
  let ventaNec, ventaInc, contribObjetivoTotal;
  if (modo === "total") {
    contribObjetivoTotal = inv.target;
    ventaNec = inv.target / margenEf;
    ventaInc = ventaNec - venta;
  } else {
    ventaInc = inv.target / margenEf;
    ventaNec = venta + ventaInc;
    contribObjetivoTotal = contrib + inv.target;
  }
  const crecimiento = ventaInc / venta * 100;

  const _calc = { venta, contrib, margenEf, modo, target: inv.target, ventaNec, ventaInc, crecimiento, contribObjetivoTotal };
  const _derived = {
    derivedClient: inv.scopeType === "cliente" ? nombre : null,
    derivedFamily: inv.scopeType === "familia" ? nombre : null,
    derivedSku: inv.scopeType === "sku" ? nombre : null,
    derivedModule: "margenes",
  };

  // ── Edge honesto (§3) · ya en o por encima del objetivo ──
  if (crecimiento <= 0) {
    return {
      opener: `${nombre} ya aporta ${fmtM(contrib)}, por encima de ese objetivo — no requiere crecimiento.`,
      suggestions: filterTextualSuggestions([`Cuánto vende ${nombre}`, `Margen de ${nombre}`]),
      sentrixAction: { label: "Ver márgenes", moduleChip: "Márgenes", payload: { modulo: "margenes", clientes: [], skus: [] } },
      _calc, ..._derived,
    };
  }

  // ── Veredicto ejecutivo (§7) · la cuenta a la vista + declaración total/adicional ──
  let opener;
  if (modo === "total") {
    opener = `Para que ${nombre} alcance ${fmtM(contribObjetivoTotal)} de contribución total (interpreto los ${fmtM(inv.target)} como meta total): a su margen efectivo de ${(margenEf * 100).toFixed(1)}%${fuenteNota}, necesita vender ${fmtM(ventaNec)} — hoy vende ${fmtM(venta)} (aporta ${fmtM(contrib)}), así que requiere +${fmtM(ventaInc)} (crecer ${crecimiento.toFixed(1)}%).`;
  } else {
    opener = `Para que ${nombre} sume ${fmtM(inv.target)} de contribución adicional (sobre los ${fmtM(contrib)} actuales): a su margen efectivo de ${(margenEf * 100).toFixed(1)}%${fuenteNota}, necesita vender ${fmtM(ventaNec)} — hoy vende ${fmtM(venta)}, así que requiere +${fmtM(ventaInc)} (crecer ${crecimiento.toFixed(1)}%).`;
  }
  return {
    opener,
    suggestions: filterTextualSuggestions([`Cuánto vende ${nombre}`, `Margen de ${nombre}`, "Otra meta de contribución"]),
    sentrixAction: { label: "Ver márgenes", moduleChip: "Márgenes", payload: { modulo: "margenes", clientes: inv.scopeType === "cliente" ? [nombre] : [], skus: inv.scopeType === "sku" ? [nombre] : [] } },
    _calc, ..._derived,
  };
}
