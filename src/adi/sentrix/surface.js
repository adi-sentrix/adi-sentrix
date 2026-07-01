/* === adi/sentrix/surface.js · Etapa 5 · Sentrix · el MOTOR arma la superficie del Diagnóstico ===
 * Decide QUÉ gráficos se muestran y con QUÉ métrica/dims, DERIVADO del foco (no la UI, no hardcode). Cuando el
 * LLM entre (v2), solo emite el foco → el motor arma la superficie → cero retrabajo ("ADI es controlador, no
 * generador de pantallas"). Regla de honestidad incorporada: el evolutivo (margen mes a mes) solo va donde el
 * histórico es REAL (comercial); en inventario el dato es point-in-time → no se inventa una tendencia, se oculta. */
import { CONCENTRATION_DIMS, INV_DIMS } from "./concentration.js";

// ¿Es un foco de inventario? Hoy = bodega (única entidad de inventario del set). Se extiende solo al sumar SKU-inv.
const _isInventory = (focusType) => focusType === "bodega";

export function diagnosisCharts(focusType) {
  const inventory = _isInventory(focusType);
  return {
    inventory,
    // EVOLUTIVO: histórico de margen REAL (12 meses) solo en comercial. Inventario point-in-time → no inventa tendencia.
    evolution: !inventory,
    // PARETO: siempre útil, pero el motor pivotea métrica + dims según el foco.
    concentration: inventory
      ? { metric: "inmovilizado", dims: INV_DIMS, defaultDim: "sku",
          verb: "concentran", ofNoun: "del capital inmovilizado", byNoun: "del capital inmovilizado" }
      : { metric: "ventas", dims: CONCENTRATION_DIMS, defaultDim: "cliente",
          verb: "explican", ofNoun: "de las ventas", byNoun: "por ventas" },
  };
}
