/* === src/adi/oracle/ledger.js · ARQUITECTURA C · LEDGER DE CIFRAS CON PROCEDENCIA ===
 * Fase 0 (andamio en sombra). El "oráculo verificado" reemplaza el embudo angosto: el LLM PLANEA qué datos
 * necesita, el motor los TRAE con la garantía de siempre, y el LLM NARRA sobre ellos bajo el guard.
 *
 * El LEDGER es la boleta UNIFICADA de un turno: acumula los fig() de N tool-calls, estampando cada cifra con su
 * PROCEDENCIA origin={tool, callId, scope, entityLabel}. Hoy la boleta es de UN composer one-shot; el ledger es la
 * unión de todas las llamadas del plan → habilita respuestas que componen varios datos, y la procedencia habilita
 * el guard POR-CALL-SCOPE de la Fase 2 (una cifra se valida contra la boleta de la call que NOMBRA su entidad, no
 * contra la unión — cierra el hueco "cifra real, referente inventado").
 *
 * PURO · sin estado global · sin I/O. Mismas tool-calls → mismo ledger (byte-igual · gate-testable).
 * NO importado por el pipeline vivo (Fase 0 es sombra): montarlo no cambia ninguna respuesta a clientes.
 */

import { fig } from "../boleta.js";

// createLedger() → ledger vacío. figs: la boleta plana acumulada (cada fig con .origin). calls: el trace por call.
export function createLedger() {
  return { figs: [], calls: [] };
}

// ── ENRIQUECIMIENTO boleta ← facts (Fase calidad · adelanto de Fase 5) ──────────────────────────────────────────
// La boleta del composer es un SUBCONJUNTO curado; los `facts` traen TODO lo que el motor calculó (filas, DOH, gaps,
// share…). El LLM interpreta con los facts → citaba cifras REALES pero no autorizadas → guardC abstenía. Autorizar
// las cifras de los facts es SEGURO (son del motor, no inventadas): el guard sigue bloqueando derivaciones (sumas
// que NO están en facts) y mala atribución (por-call-scope). Reusa las cifras ya FORMATEADAS de los facts + usd crudo.
const _moneyE = (v) => { const a = Math.abs(v), s = v < 0 ? "-" : ""; if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(1)}M`; if (a >= 1e3) return `${s}$${Math.round(a / 1e3)}K`; return `${s}$${Math.round(a)}`; };
const _FIGRE = /-?\$\s?\d[\d.,]*\s*[KMB]?|\d[\d.,]*\s*%|\d[\d.,]*\s*(?:x|×)|\b\d+\s*d(?:[ií]as?)?\b/gi;
const _unitOf = (v) => /%/.test(v) ? "pct" : /(?:×|\dx)\b/i.test(v) ? "ratio" : /\d\s*d(?:[ií]as?)?\b/i.test(v) ? "days" : "money";
// crudos → unidad por NOMBRE de clave (días/%/x · el $ se omite: la escala K/crudo es ambigua sin el formateo del composer)
const _KEYUNIT = [[/doh|d[ií]as/i, "days"], [/rotacion/i, "ratio"], [/margen|carga|benchmark|rebate|share|participaci|concentraci|cobertura|variacion|yoy|crecimiento|pct|porcentaje/i, "pct"]];
export function enrichFromFacts(boleta, facts) {
  if (!facts || typeof facts !== "object") return boleta;
  const seen = new Set(boleta.map((f) => f.canon));
  const add = (label, tok) => {
    const v = String(tok).trim().replace(/\s+/g, " "); if (!v || v === "—") return;
    const f = fig(String(label || v), v, { unit: _unitOf(v) });
    if (seen.has(f.canon)) return; seen.add(f.canon); boleta.push(f);
  };
  const walk = (node, entity, key = null) => {
    if (node == null) return;
    // STRING SUELTO (dentro de un array): las celdas ya formateadas de una MATRIZ viven así — tablaM.rows[].values =
    // ["$6.8M","$6.3M",…] (la serie mes a mes de `trend`). Sin esta rama se descartaban y el guard bloqueaba TODA la
    // tabla temporal (cifras REALES del motor, no autorizadas). Mismo criterio que un string en un campo con nombre.
    if (typeof node === "string") { const mm = node.match(_FIGRE); if (mm) mm.forEach((g) => add(entity || key, g)); return; }
    if (Array.isArray(node)) { node.forEach((x) => walk(x, entity, key)); return; }
    if (typeof node === "object") {
      const ent = node.name || node.entidad || node.nombre || node.label || entity || null;
      if (typeof node.usd === "number" && node.entidad) add(String(node.entidad), _moneyE(node.usd));   // findings (diagnose): usd crudo
      for (const [k, v] of Object.entries(node)) {
        if (typeof v === "string") { const mm = v.match(_FIGRE); if (mm) mm.forEach((g) => add(ent || k, g)); }
        else if (typeof v === "number" && Number.isFinite(v)) {
          // crudos por unidad-según-clave · SOLO días/%/x (el $ se omite por la ambigüedad de escala K/crudo)
          const ku = _KEYUNIT.find(([re]) => re.test(k));
          if (ku) add(ent || k, ku[1] === "days" ? `${Math.round(v)}d` : ku[1] === "ratio" ? `${v.toFixed(1)}x` : `${v}%`);
        } else walk(v, ent, k);
      }
      return;
    }
  };
  walk(facts, null);
  return boleta;
}

// recordCall(ledger, meta, result) → estampa cada fig del result con su procedencia y lo acumula.
//   meta   = { tool, callId, scope, args }  (scope = el eje/alcance de la call · base del guard por-call-scope)
//   result = { facts, boleta:fig[], coverage }  (contrato uniforme de una tool-oráculo)
// entityLabel se toma del label de la fig (donde el composer ya pone la entidad: "Falabella · Margen") — semilla
// del binding cifra↔entidad que la Fase 2 usa para validar la atribución.
export function recordCall(ledger, { tool, callId, scope = null, args = null } = {}, result) {
  const base = (result && Array.isArray(result.boleta)) ? result.boleta.slice() : [];
  // enriquece con las cifras REALES de los facts que la boleta curada no cubría (baja abstenciones · guardC intacto)
  const boleta = enrichFromFacts(base, result && result.facts);
  const stamped = boleta.map((f) => ({ ...f, origin: { tool, callId, scope, entityLabel: (f && f.label) || null } }));
  ledger.figs.push(...stamped);
  ledger.calls.push({
    tool, callId, scope, args: args || null,
    coverage: (result && result.coverage) || null,
    figCount: stamped.length,
  });
  return ledger;
}

// ledgerBoleta(ledger) → la boleta plana del turno (unión de todas las calls). Compat directo con
// guardAgainstBoleta(narración, boleta) del guard actual: el ledger es un drop-in de la boleta one-shot.
export function ledgerBoleta(ledger) {
  return (ledger && Array.isArray(ledger.figs)) ? ledger.figs : [];
}

// figsForEntity(ledger, entidad) → las figs cuya call NOMBRA esa entidad en su label (match por token, no substring
// de 3 chars). Base del guard POR-CALL-SCOPE de la Fase 2 — acá se deja lista la consulta, aún NO se aplica en vivo.
export function figsForEntity(ledger, entidad) {
  const n = String(entidad == null ? "" : entidad).trim().toLowerCase();
  if (n.length < 3) return [];
  return ledgerBoleta(ledger).filter((f) => {
    const lbl = String((f.origin && f.origin.entityLabel) || f.label || "").toLowerCase();
    return lbl.includes(n);   // Fase 2 endurecerá a match de token; en Fase 0 solo alimenta el diagnóstico
  });
}
