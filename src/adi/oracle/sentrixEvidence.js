/* === src/adi/oracle/sentrixEvidence.js · ARQUITECTURA C · SENTRIX ES LA EVIDENCIA (owner 2026-07-28) ===
 * "Lo que debes conectar es lo que dice ADI con lo que muestra Sentrix... de esa forma ADI explica y Sentrix
 * muestra la evidencia." Hoy answerViaOracle devolvía un evidence MÍNIMO {boleta,oracle,intent,scope,plan} → el
 * panel de Sentrix NUNCA se movía con las respuestas de C (quedaba en lo que mostraba el turno anterior o en blanco).
 *
 * El arreglo es CONECTAR, no reconstruir: cada composeSpec* que envuelve toolRegistry YA emite un `evidence`
 * panel-ready (lens/margin/ventas/contribucion/inventory/findings/pairs/tablaM…) — es el MISMO objeto que usa el
 * pipeline determinístico, y `_pack()` ya lo guarda en `facts` (para que el LLM razone). Acá se FUSIONA eso mismo
 * para el cliente (aditivo, cero cambio de lo que ve el narrador) y, si el turno resolvió una entidad cliente/SKU,
 * se agrega la LECTURA premium (hero + evolutivo) con el MISMO signal-builder que usa "cómo está Falabella" en el
 * pipeline viejo — ese `reading` NUNCA se expone al narrador (vive solo en el evidence de salida): agregar más
 * números a la vista del LLM aumentaría el riesgo de una cifra no-autorizada; el panel no necesita pasar por el guard.
 */
import { buildReadingFromSignals, buildSkuMarginSignals, buildClientContribSignals } from "../sentrix/reading.js";

// _mergeFacts(results) → un solo objeto con los facts panel-ready de TODAS las calls del plan (last-wins en claves
// repetidas — normalmente no colisionan, cada tool aporta las suyas). defineConcept no aporta nada visual; no rompe nada.
function _mergeFacts(results) {
  let out = {};
  for (const r of results || []) {
    if (r && r.facts && typeof r.facts === "object") out = { ...out, ...r.facts };
  }
  return out;
}

// _entityReading(results, scenario) → la lectura premium de UNA entidad (hero+evolutivo), SOLO si algún call resolvió
// una entidad de eje cliente/SKU (entityProfile/entityRecord dejan `entidad`+`entityType` en sus facts) y existe el
// signal-builder para ese eje (marca/familia/bodega no tienen aún un "dive" general → sin reading, no peor que hoy).
function _entityReading(results, scenario) {
  for (const r of results || []) {
    const f = r && r.facts;
    if (!f || !f.entidad || !f.entityType) continue;
    if (f.entityType === "sku") {
      const s = buildSkuMarginSignals(f.entidad);
      const rd = s && buildReadingFromSignals(s);
      if (rd) return rd;
    }
    if (f.entityType === "cliente" || f.entityType === "client") {
      const s = buildClientContribSignals(f.entidad, scenario);
      const rd = s && buildReadingFromSignals(s);
      if (rd) return rd;
    }
  }
  return null;
}

// buildOracleEvidence({ plan, results, figs, scenario }) → el evidence que ve el CLIENTE (Sentrix). Aditivo: conserva
// boleta/oracle/intent/scope/plan (compatibles con lo que ya devolvía el seam) + los facts panel-ready + la lectura.
export function buildOracleEvidence({ plan, results, figs, scenario }) {
  const merged = _mergeFacts(results);
  const reading = _entityReading(results, scenario);
  const calls = Array.isArray(plan && plan.calls) ? plan.calls : [];
  return {
    ...merged,
    ...(reading ? { reading } : {}),
    boleta: figs,
    periodo: scenario,
    oracle: true,
    intent: (plan && plan.intent) || null,
    scope: (plan && plan.scope) || null,
    plan: { intent: (plan && plan.intent) || null, calls: calls.map((c) => c.tool) },
  };
}
