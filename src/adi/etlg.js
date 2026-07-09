import { applyScenarioToClientesMargen } from "../engine/scenarios.js";
import { skusMargen } from "../data/skusMargen.js";

export function detectRceTier(derivedIntentType, intentType, lastComposerResponse) {
  const t = derivedIntentType || intentType || "";
  // Tier explícitos por derivedIntentType (QI lo setea a "query_interpreter",
  // disambig path lo setea a "disambiguation")
  if (t === "query_interpreter") return "qi";
  if (t === "disambiguation") return "disambig";
  if (t === "module") return "module_overview";
  // Generic: intent.type === "generic" (fallback final detectIntent)
  // O caso sin tipo y sin lastComposerResponse (defensivo)
  if (t === "generic") return "generic";
  if (!t && !lastComposerResponse) return "generic";
  // Default conservador · cualquier intent.type conocido (Ferrari) → ferrari
  return "ferrari";
}

const ETLG_THESIS_TEMPLATES = {
  // ── Tier ferrari · variantes scenario completas (D6) ────────────────────
  priority_recommendation: {
    requires_concepts: [], // matchea por intent_id directo
    bonanza: () => "Las ventas están creciendo, pero el crecimiento no se está convirtiendo en la misma proporción en contribución y además tienes capital detenido en inventario.",
    tension: () => "Las ventas se quedaron planas, el margen perdió tracción y tienes capital detenido en inventario · tres problemas activos al mismo tiempo.",
    crisis:  () => "Las ventas cayeron, el margen cayó y tienes capital detenido en inventario · tres problemas activos al mismo tiempo en magnitud severa.",
  },

  // ── Tier ferrari · paramétricos runtime ─────────────────────────────────
  fuga_distribuida: {
    requires_concepts: ["loss_explicit"],
    template: () => "El margen está cayendo en dos lugares a la vez: capital frenado en stock y carga comercial sobre cuentas grandes.",
  },

  mechanism_explore_erosion: {
    requires_concepts: [],
    template: (params) => {
      const n = params.tier1Count || "Tres";
      return `${n} cuentas Tier 1 están aportando volumen pero no margen · el costo viene de la carga comercial que pagan.`;
    },
    resolve_params: (scenario) => {
      try {
        const rows = applyScenarioToClientesMargen(scenario);
        const benchmark = 30.1;
        const target_carga = 3.5;
        const count = rows.filter(c => c.margen < benchmark && c.pctRebate > target_carga).length;
        let word;
        if (count === 1) word = "Una";
        else if (count === 2) word = "Dos";
        else if (count === 3) word = "Tres";
        else if (count === 4) word = "Cuatro";
        else word = String(count);
        return { tier1Count: word };
      } catch (e) { return { tier1Count: "Tres" }; }
    },
  },

  // client_dive (legacy intent.type === "client" path) · usa intent.clientName
  client_dive: {
    requires_concepts: [],
    template: (params) => {
      // FIX #D-BUG-4-extended (BRIEF #11) · null safety.
      // Mismo patrón que FIX B Bug Fix Routing: si no hay clientName válido,
      // retornar null · ETLG aplica passthrough silencioso en vez de emitir
      // thesis robotizada con placeholder "La cuenta".
      if (!params.clientName) return null;
      const name = params.clientName;
      const sizeDesc = params.sizeDesc || "más grande";
      return `${name} es la cuenta ${sizeDesc} pero también la más cara · el margen no compensa la concentración.`;
    },
    resolve_params: (scenario, intentMeta) => {
      try {
        const clientName = intentMeta?.client_name || null;
        if (!clientName) return { clientName: null };
        const rows = applyScenarioToClientesMargen(scenario);
        const sorted = [...rows].sort((a,b) => b.venta - a.venta);
        const rank = sorted.findIndex(r => r.nombre === clientName);
        // HONESTIDAD (sweep 2026-07-09): entidad que NO está en la cartera (rank -1) → SIN tesis. La plantilla
        // afirmaba propiedades ("la más cara · el margen no compensa") de cuentas inexistentes (Walmart/Corona)
        // ANTES del degrade honesto — fabricación de piso que el narrador después amplificaba.
        if (rank === -1) return { clientName: null };
        let sizeDesc = "del Tier 1";
        if (rank === 0) sizeDesc = "más grande";
        else if (rank === 1) sizeDesc = "segunda más grande";
        else if (rank >= 2 && rank <= 4) sizeDesc = "del Tier 1";
        else sizeDesc = "del portafolio";
        return { clientName, sizeDesc };
      } catch (e) { return { clientName: null }; }
    },
  },

  client_simulation_lose: {
    requires_concepts: [],
    template: (params) => {
      // FIX B (Opción C1 · bug routing) · null safety.
      // Si no hay clientName válido, retornar null · ETLG aplica passthrough
      // silencioso (línea 15656) en vez de emitir thesis robotizada con
      // placeholder genérico tipo "La cuenta".
      if (!params.clientName) return null;
      const name = params.clientName;
      const pct = params.contribPct;
      if (pct) return `Perder a ${name} significa aproximadamente ${pct}% menos contribución del portafolio · es una de las cuentas más concentradas.`;
      return `Perder a ${name} es perder una de las cuentas más concentradas del portafolio.`;
    },
    resolve_params: (scenario, intentMeta) => {
      try {
        const clientName = intentMeta?.client_name || null;
        if (!clientName) return { clientName: null };
        const rows = applyScenarioToClientesMargen(scenario);
        const totalContrib = rows.reduce((s, r) => s + (r.contribucion || 0), 0);
        const row = rows.find(r => r.nombre === clientName);
        if (!row || totalContrib <= 0) return { clientName };
        const pct = Math.round((row.contribucion / totalContrib) * 100);
        return { clientName, contribPct: pct };
      } catch (e) { return { clientName: null }; }
    },
  },

  client_contribution_ranking: {
    requires_concepts: [],
    template: (params) => {
      const pct = params.top3Pct;
      if (pct) return `Tres cuentas concentran ${pct}% de la contribución total · la cartera depende de ese trío.`;
      return "Tres cuentas concentran la mayor parte de la contribución total · la cartera depende de ese trío.";
    },
    resolve_params: (scenario) => {
      try {
        const rows = applyScenarioToClientesMargen(scenario);
        const sorted = [...rows].sort((a,b) => b.contribucion - a.contribucion);
        const total = sorted.reduce((s, r) => s + (r.contribucion || 0), 0);
        const top3 = sorted.slice(0, 3).reduce((s, r) => s + (r.contribucion || 0), 0);
        if (total <= 0) return {};
        return { top3Pct: Math.round((top3 / total) * 100) };
      } catch (e) { return {}; }
    },
  },

  product_contribution_query: {
    requires_concepts: [],
    template: (params) => {
      const pct = params.top4Pct;
      if (pct) return `Cuatro SKUs concentran ${pct}% de la contribución total · el resto del portafolio aporta participación fragmentada.`;
      return "Pocos SKUs concentran la mayor parte de la contribución total · el resto del portafolio aporta participación fragmentada.";
    },
    resolve_params: () => {
      try {
        const sorted = [...skusMargen].sort((a,b) => b.contribucion - a.contribucion);
        const total = sorted.reduce((s, r) => s + (r.contribucion || 0), 0);
        const top4 = sorted.slice(0, 4).reduce((s, r) => s + (r.contribucion || 0), 0);
        if (total <= 0) return {};
        return { top4Pct: Math.round((top4 / total) * 100) };
      } catch (e) { return {}; }
    },
  },

  profitability_gap: {
    requires_concepts: ["growth_positive", "profitability_negative"],
    template: () => "Las ventas están creciendo pero el margen se está comprimiendo · el crecimiento no se está convirtiendo en utilidad.",
  },

  exposure_analysis: {
    requires_concepts: [],
    template: (params) => {
      const pct = params.top3Pct;
      if (pct) return `Tres clientes concentran ${pct}% de la contribución · una salida simultánea elimina aproximadamente la mitad de la rentabilidad operativa.`;
      return "Tres clientes concentran la mayor parte de la contribución · una salida simultánea afecta directamente la rentabilidad operativa.";
    },
    resolve_params: (scenario) => {
      try {
        const rows = applyScenarioToClientesMargen(scenario);
        const sorted = [...rows].sort((a,b) => b.contribucion - a.contribucion);
        const total = sorted.reduce((s, r) => s + (r.contribucion || 0), 0);
        const top3 = sorted.slice(0, 3).reduce((s, r) => s + (r.contribucion || 0), 0);
        if (total <= 0) return {};
        return { top3Pct: Math.round((top3 / total) * 100) };
      } catch (e) { return {}; }
    },
  },

  // ── Tier module_overview · variantes scenario (D6 margen + ventas) ──────
  module_overview_margenes: {
    requires_concepts: [],
    bonanza: (params) => `El margen está en ${params.actualMargin}%, bajo el benchmark de industria · la diferencia viene de la carga comercial sobre las cuentas Tier 1.`,
    tension: (params) => `El margen cayó de 25.6% a ${params.actualMargin}% · la carga comercial sobre las cuentas grandes está absorbiendo más del crecimiento.`,
    crisis:  (params) => `El margen cayó a ${params.actualMargin}% · tres clientes están operando bajo costo real con la carga comercial actual.`,
    resolve_params: (scenario) => {
      // margen actual del KPI del scenario
      const margins = { bonanza: "25.6", tension: "22.4", crisis: "18.9" };
      return { actualMargin: margins[scenario] || "25.6" };
    },
  },

  module_overview_ventas: {
    requires_concepts: [],
    bonanza: () => "Las ventas crecieron +7.6% versus el año anterior · el crecimiento se concentra en tres cuentas grandes.",
    tension: () => "Las ventas se quedaron planas (0%) versus el año anterior · el portafolio dejó de tracciónar.",
    crisis:  () => "Las ventas cayeron -12.6% versus el año anterior · la cartera está perdiendo volumen en magnitud significativa.",
  },

  module_overview_inventario: {
    requires_concepts: [],
    bonanza: () => "Hay capital detenido en stock · la rotación opera bajo el promedio operativo en algunas familias.",
    tension: () => "Hay capital detenido en stock · la velocidad de deterioro empezó a acelerarse en categorías específicas.",
    crisis:  () => "Hay capital detenido en stock · el monto comprometido empezó a impactar el ciclo de caja del negocio.",
  },
};

// ── PIEZA 1 · executiveThesisLineGenerator ──────────────────────────────────
// Dispatcher principal · aplica E1 templates (E2 diferido D1) · E3 fallback
// silencioso. Variables runtime directas.
//
// Retorna:
//   {
//     thesisLine: string | null,    // 1-2 frases (null = E3 fallback)
//     shouldApply: boolean,         // true solo si thesisLine válido
//     reason: string,               // debug
//   }
export function executiveThesisLineGenerator(rawPayload, intentMeta, scenario) {
  // Sanity check
  if (!rawPayload || typeof rawPayload.opener !== "string" || rawPayload.opener.length === 0) {
    return { thesisLine: null, shouldApply: false, reason: "no_opener" };
  }
  if (!intentMeta || typeof intentMeta !== "object") {
    return { thesisLine: null, shouldApply: false, reason: "no_intent_meta" };
  }

  const tier = intentMeta.tier;
  // Solo aplica a ferrari + module_overview (D5)
  if (tier !== "ferrari" && tier !== "module_overview") {
    return { thesisLine: null, shouldApply: false, reason: "tier_skipped:" + tier };
  }

  const scn = scenario || "bonanza";

  // Build template key
  // Para tier=ferrari: intent_id (intent_id semántico) o legacy type "client"
  // Para tier=module_overview: "module_overview_" + modulo
  let templateKey = null;
  if (tier === "module_overview") {
    const modulo = intentMeta.modulo || "margenes";
    templateKey = "module_overview_" + modulo;
  } else {
    // Ferrari · preferir intent_id semántico
    templateKey = intentMeta.intent_id
                  || (intentMeta.intent_type === "client" ? "client_dive" : null)
                  || (intentMeta.intent_type === "client_followup" ? "client_dive" : null);
  }

  if (!templateKey) {
    return { thesisLine: null, shouldApply: false, reason: "no_template_key" };
  }

  const template = ETLG_THESIS_TEMPLATES[templateKey];
  if (!template) {
    return { thesisLine: null, shouldApply: false, reason: "template_not_found:" + templateKey };
  }

  try {
    // Verificar requires_concepts si están definidos
    if (Array.isArray(template.requires_concepts) && template.requires_concepts.length > 0) {
      const concepts = Array.isArray(intentMeta.concepts) ? intentMeta.concepts : [];
      const allPresent = template.requires_concepts.every(req => concepts.includes(req));
      if (!allPresent) {
        return { thesisLine: null, shouldApply: false, reason: "concepts_insufficient" };
      }
    }

    // Resolver params runtime
    let params = {};
    if (typeof template.resolve_params === "function") {
      params = template.resolve_params(scn, intentMeta) || {};
    }

    // Generar thesis según variantes scenario (D6) o template paramétrico
    let thesisLine = null;
    if (typeof template[scn] === "function") {
      // Variante scenario-específica (D6 · priority_recommendation, module_overview_margenes, module_overview_ventas)
      thesisLine = template[scn](params);
    } else if (typeof template.template === "function") {
      // Template paramétrico runtime
      thesisLine = template.template(params);
    } else {
      return { thesisLine: null, shouldApply: false, reason: "no_renderer" };
    }

    if (!thesisLine || typeof thesisLine !== "string" || thesisLine.length === 0) {
      return { thesisLine: null, shouldApply: false, reason: "empty_thesis" };
    }

    return { thesisLine, shouldApply: true, reason: "ok:" + templateKey };
  } catch (e) {
    // Fallback silencioso E3
    return { thesisLine: null, shouldApply: false, reason: "exception:" + (e?.message || "?") };
  }
}
