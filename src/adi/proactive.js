/* === src/adi/proactive.js · Capa 3 · OBSERVACIÓN ADITIVA (suffix proactivo) ===
 * detectVirtuousException extraído de 41cc33d8 (L18657) · verbatim · solo imports.
 * Determinística (funciones puras de escenario). El gate de sesión (observationEmittedScenario)
 * lo aplica answerADI · acá solo se compone el texto. */
import { deriveBusinessThesis } from "./composers/thesis.js";
import { detectTemplates } from "./composers/clientDive.js";
import { applyScenarioToClientesMargen } from "../engine/scenarios.js";

export function detectVirtuousException(scenarioId, thesis) {
  if (!thesis || thesis.titular === "ninguno") return null;
  const clientes = applyScenarioToClientesMargen(scenarioId);
  // "cubierta" = la cuenta está entre las entities que la tesis CORONÓ (titular · las que ADI nombró)
  const titularDet = thesis._detectores
    ? Object.values(thesis._detectores).find(d => d && d.patron === thesis.titular)
    : null;
  const _cubiertas = new Set((titularDet && titularDet.entities) || []);
  // clasificador virtuoso (replica isVirtuousSideTemplate · motor)
  const _isVirtuousSide = (t) => {
    if (t.id === "hidden_profitability") return true;
    if (t.id === "dependency_risk") {
      const ev = t.evidence || {};
      const isUnique = ev.isUnique === true;
      const lowPart = (ev.participacion === undefined) || ev.participacion < 15;
      return isUnique && lowPart;
    }
    return false;
  };
  const virtuosas = [];
  for (const c of clientes) {
    const tpls = detectTemplates(c.nombre, scenarioId) || [];
    const hasHidden = tpls.some(t => t.id === "hidden_profitability");
    const hasNegative = tpls.some(t => !_isVirtuousSide(t));
    if (!hasHidden || hasNegative) continue;                 // virtuosa pura: hidden && sin negativo
    if (_cubiertas.has(c.nombre)) continue;                  // FILTRO "no cubierta" (titular)
    const hp = tpls.find(t => t.id === "hidden_profitability");
    const ev = (hp && hp.evidence) || {};
    if ((c.contribucion || 0) < 500) continue;               // FILTRO "material" (floor prudencial · contribución K)
    virtuosas.push({
      cuenta: c.nombre,
      evidencia: { participacion: ev.participacion, variacion: ev.variacion, margen: ev.margen, pctRebate: ev.pctRebate },
      _mat: c.contribucion || 0,
    });
  }
  if (virtuosas.length === 0) return null;                   // → SILENCIO (default)
  virtuosas.sort((a, b) => b._mat - a._mat);                 // CORONA la más material (contribución desc)
  const top = virtuosas[0];
  return { cuenta: top.cuenta, evidencia: top.evidencia };
}

// Compone la línea del suffix (replica PanelADI L38493-38499). null = silencio.
export function virtuousExceptionSuffix(scenarioId) {
  const _obs = detectVirtuousException(scenarioId, deriveBusinessThesis(scenarioId));
  if (!_obs) return null;
  const _ev = _obs.evidencia || {};
  const _cr = _ev.variacion != null ? `viene creciendo ${_ev.variacion}%` : `rinde a contramano del grupo`;
  const _ca = _ev.pctRebate != null ? ` con una de las cargas más bajas de la cartera (${_ev.pctRebate}%)` : ``;
  return `Un punto que no saliste a buscar: ${_obs.cuenta} ${_cr}${_ca} — y casi nadie la mira.`;
}
