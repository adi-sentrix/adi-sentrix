/* === adi/composers/brand.js ===
 * ROUTER del ADI extraído de 41cc33d8 · verbatim · solo imports agregados.
 * Importa motor + datos/config + el resto del adi. Cero cambio de ruteo. */
import { FEATURE_BRAND_AS_ENTITY } from "../../config/features.js";
import { skuInventario } from "../../data/demoData.js";
import { skusMargen } from "../../data/skusMargen.js";
import { applyScenarioToSkuInventario } from "../../engine/scenarios.js";
import { filterTextualSuggestions } from "../helpers.js";
import { _bFmt1, _bFmt2, _brandHasClientWorld, _brandRow } from "../router.js";

export function _brandInventory(marca, scenarioId) {
  const inv = FEATURE_BRAND_AS_ENTITY ? applyScenarioToSkuInventario(scenarioId) : skuInventario;
  const skus = inv.filter(s => s.marca === marca);
  const total = skus.reduce((a, s) => a + s.stockUSD, 0);
  const bodegas = [...new Set(skus.map(s => s.bodega))];
  return { total, bodegas, skus: skus.map(s => s.sku) };
}

export function composeBrandDive(marca, scenarioId, opts = {}) {
  const subFocus = (opts && opts.subFocus) || null;
  const r = _brandRow(marca);
  if (!r) {
    return { opener: `No tengo a ${marca} en la vista de marca de este dataset.`, suggestions: filterTextualSuggestions([]), brandResolved: null, derivedModule: "margenes" };
  }
  const joinEs = (arr) => arr.length <= 1 ? (arr[0] || "") : arr.slice(0, -1).join(", ") + " y " + arr[arr.length - 1];
  const skusDir = skusMargen.filter(s => s.marca === marca).map(s => s.nombre);
  const invAgg = _brandInventory(marca, scenarioId);
  const sinCliente = !_brandHasClientWorld(marca);   // Makita

  // ── subFocus margen ──
  if (subFocus === "margen") {
    let op = `${marca} tiene ${r.margen.toFixed(1)}% de margen (vista de marca, estática).`;
    if (sinCliente) op += ` ${marca} está completa en la vista de marca (venta, margen, contribución e inventario); lo que no tiene en este dataset es cobertura comercial por cliente.`;
    return { opener: op, suggestions: filterTextualSuggestions([`Qué vende ${marca}`, `Qué inventario tiene ${marca}`]), brandResolved: marca, derivedModule: "margenes" };
  }
  // ── subFocus inventario ──
  if (subFocus === "inventario") {
    const op = `Inventario de ${marca}: ${_bFmt1(invAgg.total)} (${joinEs(invAgg.skus)}) en ${joinEs(invAgg.bodegas)}.`;
    return { opener: op, suggestions: filterTextualSuggestions([`Qué vende ${marca}`, `Qué margen tiene ${marca}`]), brandResolved: marca, derivedModule: "inventario" };
  }
  // ── subFocus skus ──
  if (subFocus === "skus") {
    const op = `${marca} agrupa ${skusDir.length} ${skusDir.length === 1 ? "SKU" : "SKUs"}: ${joinEs(skusDir)}.`;
    return { opener: op, suggestions: filterTextualSuggestions([`Qué inventario tiene ${marca}`, `Qué margen tiene ${marca}`]), brandResolved: marca, derivedModule: "ventas" };
  }
  // ── Dive completo ──
  let opener = `${marca} (marca): vende ${_bFmt1(r.venta)} con ${_bFmt2(r.contribucion)} de contribución (margen ${r.margen.toFixed(1)}%). ${skusDir.length} ${skusDir.length === 1 ? "SKU" : "SKUs"}: ${joinEs(skusDir)}. Inventario físico ${_bFmt1(invAgg.total)} en ${joinEs(invAgg.bodegas)}.`;
  // Declaración de linaje (§3/§4).
  if (sinCliente) {
    opener += ` Nota: ${marca} está completa en la vista de marca, pero no tiene cobertura comercial por cliente en este dataset — por eso aparece en mundo-marca pero no en mundo-cliente.`;
  } else {
    opener += ` (Cifras de la vista de marca, estáticas — pueden no reconciliar con la venta por clientes scenario-aware: son linajes distintos.)`;
  }
  return {
    opener,
    suggestions: filterTextualSuggestions([`Qué margen tiene ${marca}`, `Qué inventario tiene ${marca}`, `Qué SKUs forman ${marca}`]),
    sentrixAction: { label: "Ver márgenes", moduleChip: "Márgenes", payload: { modulo: "margenes", clientes: [], skus: skusDir } },
    brandResolved: marca,
    derivedModule: "margenes",
  };
}
