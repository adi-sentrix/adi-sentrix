/* === src/adi/eclCont.js ===
 * Capa ECL-CONT continuation · R4 sku-dev (cierra [5] "profundizá en ese").
 * Extraído verbatim de 41cc33d8: eclContIsPureContinuation (L53640), composeSkuDevelopment (L22191).
 * classifySkuOperationalProfile (L11476) copiado local (no exportado en el modular). Opción A:
 * solo R4 · MODO 3/R3 quedan como deuda ECL-CONT (composeClientToSku/SkuDeepDive/AccountDevelopment). */
import { skuInventario } from "../data/demoData.js";
import { ECL_CONT_ENABLED, ADI_ACTIVE_RESULT_CONTINUITY_ENABLED } from "../config/voiceFlags.js";

// ── classifySkuOperationalProfile (L11476) · módulo-local verbatim ──
function classifySkuOperationalProfile(sku) {
  if (sku.doh > 90 && sku.rotacion < 3) return "operational_inefficient";
  if (sku.doh <= 90 && sku.rotacion >= 3) return "high_volume_healthy";
  return "borderline";
}

// ── eclContIsPureContinuation (L53640) · compuerta de la continuidad ──
// Dispara cuando NO hay intent nuevo (derived* null) Y hay foco activo (incl. activeResult.entities).
// En sesión fresca (los 47 · sin foco previo) → hasFocus=false → NO dispara (no toca single-turn).
export function eclContIsPureContinuation(signals) {
  if (typeof ECL_CONT_ENABLED === "undefined" || !ECL_CONT_ENABLED) return false;
  const s = signals || {};
  // 1. Intent nuevo SIEMPRE gana · si se derivó algo nuevo, NO es continuación.
  if (s.derivedClient || s.derivedSku || s.derivedModule || s.derivedMetric) return false;
  // 2. Foco activo vigente (hypothesis · o lastClient + domain · o activeResult con entidades).
  const cc = s.conversationContext || {};
  const hasFocus = !!cc.investigationHypothesis
    || !!cc.investigationDomain
    || !!cc.lastClientMentioned
    || (typeof ADI_ACTIVE_RESULT_CONTINUITY_ENABLED !== "undefined" && ADI_ACTIVE_RESULT_CONTINUITY_ENABLED
         && !!(cc.activeResult && Array.isArray(cc.activeResult.entities) && cc.activeResult.entities.length > 0));
  return hasFocus;
}

// ── composeSkuDevelopment (L22191) · R4 · desarrollo per-SKU desde activeResult ──
// Lee activeResult.entities (set estable · NO recomputa por escenario · skuInventario estático).
export function composeSkuDevelopment(activeResult, scenarioId) {
  const reanchor = (m) => ({ opener: m, suggestions: [], sentrixAction: null, reasoningPattern: "sku_dev_honest_reanchor", _r4: "honest_reanchor" });
  if (!activeResult || !Array.isArray(activeResult.entities) || activeResult.entities.length === 0)
    return reanchor("No tengo un análisis de SKU activo para profundizar.");
  // set estable · busca por sku en skuInventario · NO recomputa por escenario
  const found = activeResult.entities.map(n => skuInventario.find(s => s.sku === n)).filter(Boolean);
  if (found.length !== activeResult.entities.length)
    return reanchor("El análisis era sobre " + activeResult.entities.join(", ") + ", pero no puedo recuperar todos esos SKUs con datos coherentes. ¿Reanclamos al análisis original?");
  // ACCIÓN TRAZABLE · R4 LLAMA al clasificador del motor (no reimplementa la regla)
  const ACCION = { operational_inefficient: "liquidar", high_volume_healthy: "mantener", borderline: "revisar pricing" };
  const dev = found.map(s => {
    const profile = classifySkuOperationalProfile(s);
    return { sku: s.sku, stockUSD: s.stockUSD, doh: s.doh, rotacion: s.rotacion, diasSinVenta: s.diasSinVenta, margenPct: s.margenPct, profile, accion: ACCION[profile] || "revisar pricing" };
  });
  const fmtK = (v) => "$" + (v / 1000).toFixed(1) + "K";
  // operational_inefficient = liberable · orden de ejecución por capital atrapado (stockUSD desc = money-first)
  const liquidar = dev.filter(d => d.profile === "operational_inefficient").sort((a, b) => b.stockUSD - a.stockUSD);
  const mantener = dev.filter(d => d.profile === "high_volume_healthy");
  const revisar  = dev.filter(d => d.profile === "borderline");
  const liberable = liquidar.reduce((sum, d) => sum + d.stockUSD, 0); // suma stockUSD · cero-hardcoding
  // ── 1. APERTURA ECONÓMICA · el dinero lidera
  let o = "";
  if (liquidar.length === 0) {
    o += "Profundizando en estos SKUs: ninguno requiere liquidación — el capital inmovilizado está en posiciones que aún rotan.\n";
  } else {
    o += `Profundizando en los SKUs con mayor capital inmovilizado, no todos requieren la misma acción. Hoy hay ${fmtK(liberable)} de capital que puede liberarse actuando sobre ${liquidar.length === 1 ? "un producto" : liquidar.length + " productos"} específicos.\n\n`;
  }
  // ── 2. PER-SKU · monto primero · DOH/rotación como respaldo (valores reales + outcome, sin umbral)
  liquidar.forEach((d, i) => {
    if (i === 0) {
      o += `${d.sku} concentra el mayor problema. Mantiene ${fmtK(d.stockUSD)} inmovilizados y prácticamente no rota (rotación ${d.rotacion}x, ${d.doh} días de cobertura, ${d.diasSinVenta} sin venta) — ineficiencia operativa: capital atrapado que no se mueve.\n`;
    } else {
      o += `${d.sku} mantiene ${fmtK(d.stockUSD)} inmovilizados, rotación ${d.rotacion}x con ${d.doh} días de cobertura (${d.diasSinVenta} sin venta) — mismo patrón de ineficiencia operativa.\n`;
    }
  });
  // ── 3. LA EXCEPCIÓN EXPLÍCITA (principio · la excepción valiosa > recomendaciones idénticas)
  mantener.forEach(d => {
    o += `\n${d.sku} es caso aparte: no se toca. Aunque aparece en la alerta de capital, rota sano (rotación ${d.rotacion}x, ${d.doh} días de cobertura) — su capital está trabajando. Liquidarlo destruiría una posición que rinde.\n`;
  });
  revisar.forEach(d => {
    o += `\n${d.sku}: zona intermedia (rotación ${d.rotacion}x, ${d.doh} días de cobertura) — revisar pricing antes de decidir.\n`;
  });
  // ── 4. PRIORIZACIÓN + cierre accionable
  if (liquidar.length > 0) {
    const orden = liquidar.map(d => `${d.sku} (${fmtK(d.stockUSD)})`).join(" → ");
    o += `\nOrden de ejecución por capital atrapado: ${orden}. Liberás ${fmtK(liberable)} sin tocar lo que funciona.`;
  }
  return {
    opener: o,
    suggestions: ["Plan de liquidación", "Ver destino de reinversión", "Comparar con SKUs sanos"],
    sentrixAction: null,
    reasoningPattern: "sku_development_capital_release",
    _r4: "sku_development",
    _actions: Object.fromEntries(dev.map(d => [d.sku, d.accion])), // trazabilidad · invariante
    _liberable: liberable,
    _order: liquidar.map(d => d.sku),
  };
}
