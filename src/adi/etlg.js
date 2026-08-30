import { applyScenarioToClientesMargen, applyScenarioToClientesVentas } from "../engine/scenarios.js";
import { skusMargen } from "../data/skusMargen.js";
import { POLICY, benchmarkOf } from "../config/businessPolicy.js";   // R1 (retrabajo ultracode 2026-08-30): la vara del NEGOCIO, jamás un 30.1 clavado
import { ESCENARIO_INICIAL } from "../config/scenarios.js";   // colapso del eje: la base real se declara UNA vez

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

/* R1 · LA SÉPTIMA CADENA GUIONADA, TRATADA COMO C7 (retrabajo ultracode 2026-08-30). Acá vivían las variantes
 * por escenario con CIFRAS INVENTADAAS y clavadas ({bonanza:25.6, tension:22.4, crisis:18.9}, «+7.6%», «-12.6%»,
 * benchmark 30.1, target 3.5) que se le decían AL USUARIO como primera línea — un tenant real con margen 25.0%
 * leía «El margen está en 25.6%». La regla de C7 aplica entera: la dirección sale del SIGNO del dato, cada
 * cifra sale del dato o de POLICY, las lecturas de dependencia se AFIRMAN solo si el dato las sostiene, y el
 * guion que no puede derivarse MUERE (el mecanismo ya tiene passthrough silencioso: sin plantilla, la
 * respuesta de abajo — que sí es data-driven — abre sola). */
const ETLG_THESIS_TEMPLATES = {
  /* priority_recommendation, fuga_distribuida y los tres module_overview_* MURIERON: eran guiones puros (la
   * película del demo o causas dobles sin cómputo). Para los module_overview además eran REDUNDANTES: desde C7
   * el opener del overview ya abre con su propia conclusión data-driven — prepender una tesis era decir la
   * misma cifra dos veces (o peor: una inventada encima de la real). */

  // ── Tier ferrari · paramétricos runtime ─────────────────────────────────
  mechanism_explore_erosion: {
    requires_concepts: [],
    template: (params) => {
      if (!params.tier1Count) return null;   // cero cuentas en esa condición → sin tesis (no se inventa una)
      return `${params.tier1Count} ${params.n === 1 ? "cuenta está" : "cuentas están"} bajo tu benchmark con la carga comercial sobre el target.`;
    },
    resolve_params: (scenario) => {
      try {
        const rows = applyScenarioToClientesMargen(scenario);
        // la vara del NEGOCIO (POLICY/benchmarkOf — el criterio C.2 del usuario manda), jamás un literal
        const count = rows.filter(c => typeof c.margen === "number" && c.margen < benchmarkOf(c) && (c.pctRebate || 0) > POLICY.targetCarga).length;
        if (!count) return {};
        const palabras = { 1: "Una", 2: "Dos", 3: "Tres", 4: "Cuatro" };
        return { tier1Count: palabras[count] || String(count), n: count };
      } catch (e) { return {}; }
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
      // R1: «pero también la más cara · el margen no compensa» AFIRMABA carga y compensación sin computarlas.
      // Lo que sí está medido: el tamaño (rank por venta) y el margen contra TU vara — solo eso se dice.
      return params.bajoVara
        ? `${name} es la cuenta ${sizeDesc} y opera bajo tu benchmark (${params.margen}%).`
        : `${name} es la cuenta ${sizeDesc} de la cartera.`;
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
        let sizeDesc = "del grupo que más vende";
        if (rank === 0) sizeDesc = "más grande";
        else if (rank === 1) sizeDesc = "segunda más grande";
        else if (rank >= 2 && rank <= 4) sizeDesc = "del grupo que más vende";   // R1: «Tier 1» era reparto inventado — el rank medido sí existe
        else sizeDesc = "del portafolio";
        const row = sorted[rank];
        const bajoVara = typeof row.margen === "number" && row.margen < benchmarkOf(row);
        return { clientName, sizeDesc, bajoVara, margen: bajoVara ? row.margen : null };
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
      // R1: «una de las más concentradas» se AFIRMA solo cuando el dato la sostiene (≥10% del total) — la
      // misma regla de C7 para las lecturas de dependencia.
      if (pct) return `Perder a ${name} significa aproximadamente ${pct}% menos contribución del portafolio${pct >= 10 ? " · es una de las cuentas más concentradas" : ""}.`;
      return null;   // sin el % medido no hay tesis — la respuesta de abajo trae la cuenta completa
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
      // R1 (regla C7): la cifra medida o nada; «depende de ese trío» solo si el dato la sostiene (≥50%).
      if (!pct) return null;
      return `Tres cuentas concentran ${pct}% de la contribución total${pct >= 50 ? " · la cartera depende de ese trío" : ""}.`;
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
      // R1 (regla C7): ídem — cifra medida o nada; «fragmentada» solo si la concentración lo sostiene.
      if (!pct) return null;
      return `Cuatro SKUs concentran ${pct}% de la contribución total${pct >= 50 ? " · el resto del portafolio aporta participación fragmentada" : ""}.`;
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
    // R1: los concepts venían de la PREGUNTA, no del dato — «Las ventas están creciendo» se afirmaba porque el
    // usuario lo dijo. La dirección sale del SIGNO: se VERIFICA crecimiento real y margen bajo la vara, o no
    // hay tesis (la respuesta de abajo trae la cuenta completa igual).
    requires_concepts: ["growth_positive", "profitability_negative"],
    template: (params) => {
      if (!params.sostenido) return null;
      return `Las ventas crecen (${params.growthFmt}) y el margen corre bajo tu benchmark · el crecimiento no se está convirtiendo en utilidad.`;
    },
    resolve_params: (scenario) => {
      try {
        const v = applyScenarioToClientesVentas(scenario);
        const act = v.reduce((s, r) => s + (r.actual || 0), 0), ant = v.reduce((s, r) => s + (r.anterior || 0), 0);
        const growth = ant > 0 ? ((act - ant) / ant) * 100 : null;
        const m = applyScenarioToClientesMargen(scenario);
        const venta = m.reduce((s, r) => s + (r.venta || 0), 0), contrib = m.reduce((s, r) => s + (r.contribucion || 0), 0);
        const margenProm = venta > 0 ? (contrib / venta) * 100 : null;
        const sostenido = growth != null && growth > 0 && margenProm != null && margenProm < benchmarkOf(null);
        return sostenido ? { sostenido, growthFmt: `+${growth.toFixed(1)}%` } : {};
      } catch (e) { return {}; }
    },
  },

  exposure_analysis: {
    requires_concepts: [],
    template: (params) => {
      const pct = params.top3Pct;
      // R1: «elimina aproximadamente la mitad» era aritmética inventada — la cifra medida ES la exposición.
      if (!pct) return null;
      return `Tres clientes concentran ${pct}% de la contribución · una salida simultánea se lleva esa proporción.`;
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

  /* ⚠️ ACÁ VIVÍAN module_overview_margenes / _ventas / _inventario — los guiones con el mapa de cifras
   * INVENTADAS ({bonanza:"25.6", tension:"22.4", crisis:"18.9"}, «+7.6%», «-12.6%») que cualquier tenant real
   * leía como SU cifra. MURIERON en R1 (retrabajo ultracode 2026-08-30): además de guionados eran redundantes —
   * desde C7 el opener del overview abre con su propia conclusión data-driven, así que el tier module_overview
   * cae al passthrough silencioso del mecanismo (template_not_found) y la respuesta real abre sola. */
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

  const scn = scenario || ESCENARIO_INICIAL;

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
