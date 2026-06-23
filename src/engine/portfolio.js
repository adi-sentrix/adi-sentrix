/* === portfolio.js ===
 * MOTOR PURO extraído de 41cc33d8 · misma entrada → misma salida · sin React.
 * Funciones copiadas verbatim; solo se agregan imports. Cero cambio de cálculo. */
import { applyScenarioToClientesVentas } from "./scenarios.js";

export function calculateIncrementalGrowth(clientName, scenarioId) {
  const ventas = applyScenarioToClientesVentas(scenarioId);
  const cliente = ventas.find(c => c.nombre === clientName);
  if (!cliente) return null;

  const totalActual   = ventas.reduce((s, c) => s + c.actual,   0);
  const totalAnterior = ventas.reduce((s, c) => s + c.anterior, 0);
  const deltaTotal    = totalActual - totalAnterior;

  // If total cartera contracted or stagnated, incremental share is not meaningful
  if (deltaTotal <= 0) return null;

  const deltaCliente = cliente.actual - cliente.anterior;
  return +((deltaCliente / deltaTotal) * 100).toFixed(1);
}
