/* === inventory.js ===
 * MOTOR PURO extraído de 41cc33d8 · misma entrada → misma salida · sin React.
 * Funciones copiadas verbatim; solo se agregan imports. Cero cambio de cálculo. */
import { FEATURE_FAMILY_INVENTORY } from "../config/features.js";
import { clientesMargen, skuInventario } from "../data/demoData.js";
import { applyScenarioToSkuInventario } from "./scenarios.js";

export function _familyInventoryAgg(scenarioId) {
  const inv = FEATURE_FAMILY_INVENTORY ? applyScenarioToSkuInventario(scenarioId) : skuInventario;
  const brandsWithClient = new Set();
  for (const c of clientesMargen) { if (c.marca) brandsWithClient.add(c.marca); }
  const fams = {};
  for (const s of inv) {
    if (!fams[s.sfamilia]) fams[s.sfamilia] = { sfamilia: s.sfamilia, total: 0, inmovilizado: 0, bodegas: {}, skus: [], orphanStock: 0, orphanSkus: [] };
    const f = fams[s.sfamilia];
    f.total += s.stockUSD;
    f.bodegas[s.bodega] = (f.bodegas[s.bodega] || 0) + s.stockUSD;
    f.skus.push(s);
    // Inmovilizado Def 2 (alerta crit/warn O rotación < 2) · misma def que el módulo.
    if (s.alerta === "crit" || s.alerta === "warn" || s.rotacion < 2) f.inmovilizado += s.stockUSD;
    // Huérfano: marca sin cliente asignado en mundo-cliente.
    if (s.marca && !brandsWithClient.has(s.marca)) { f.orphanStock += s.stockUSD; f.orphanSkus.push(s); }
  }
  return fams;
}
