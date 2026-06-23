/* === adi/router.js ===
 * ROUTER del ADI extraído de 41cc33d8 · verbatim · solo imports agregados.
 * Importa motor + datos/config + el resto del adi. Cero cambio de ruteo. */
import { FEATURE_BRAND_AS_ENTITY, FEATURE_ENTITY_COMPARISON, FEATURE_FAMILY_AS_ENTITY, FEATURE_FAMILY_INVENTORY, FEATURE_GROWTH_PROJECTION, FEATURE_INVENTORY_PREMIUM } from "../config/features.js";
import { INTENTS_REGISTRY } from "../config/intentsRegistry.js";
import { CONCEPT_ONTOLOGY, SEMANTIC_FAMILIES } from "../config/ontology.js";
import { AFFIRMATIVE_REPLIES, CLIENT_NAMES, CROSS_DOMAIN_EXECUTIVE_EXPRESSIONS, DOMAIN_KEYWORDS, EXECUTIVE_INTENT_PATTERNS, EXECUTIVE_REPORT_PATTERNS, EntityRegistry, KEYWORDS_DICTIONARY, RANKING_INTENT_PATTERNS, SEMANTIC_ENTITIES, SEMANTIC_INTENTS, SEMANTIC_METRICS, SEMANTIC_QUALIFIERS, _D30BIS_MEASURES_PATTERNS, _DEICTIC_CLIENT_HINT, _DEICTIC_PLURAL_DEMONSTRATIVE, _DEICTIC_QUANTIFIED, _DEICTIC_SKU_HINT, _VENTAS_TOTAL_GLOBAL_PHRASES } from "../config/routerData.js";
import { ADI_DRILL_ELIPTICO_SKU_ENABLED, ADI_IDLEAK_RESOLVE_ORDINAL_ENABLED, ADI_PANORAMA_SYNONYMS_ENABLED, ADI_VENTAS_TOTAL_LEXICO_ENABLED, VOICE_D30BIS_MEASURES_ENABLED, VOICE_DEICTIC_PLURAL_ENABLED, VOICE_ENTITY_REGISTRY_ENABLED, VOICE_EXECUTIVE_INTELLIGENCE_ENABLED, VOICE_EXECUTIVE_REPORT_COMPOSER_ENABLED, VOICE_NARRATIVE_V2_ENABLED, VOICE_SEMANTIC_INTENT_LAYER_ENABLED } from "../config/voiceFlags.js";
import { MARCAS_ALL, SUCURSALES, SUPERFAMILIAS } from "../data/catalogs.js";
import { clientesMargen, marcasMargen } from "../data/demoData.js";
import { CLIENT_KEYWORDS, CLIENT_NAME_MAP, detectBrandInText, detectClientInText, detectSkuInText } from "./detectors.js";
import { normalizeText } from "./helpers.js";

export function semanticNormalize(normalizedText) {
  const tokens = normalizedText.split(/\s+/).filter(Boolean);
  const emitted = [];

  for (const [, family] of Object.entries(SEMANTIC_FAMILIES)) {
    if (family.type === "combinatorial") {
      // Buscar noun + state en proximidad ≤ proximityWindow
      // BRIEF #37-quintus · Fase 2 · soporte dual:
      //   · family.states (F1/F2/F3 viejas) → startsWith con stem crudo
      //   · family.stateMatchers (F4/F5/F6 nuevas) → matchType "exact_word"
      //     o "stem_startswith" para evitar FPs léxicos.
      // Si una familia define ambas, stateMatchers tiene precedencia.
      //
      // BRIEF #4 (post-46-bis) · Captura BIDIRECCIONAL noun ↔ state.
      //   Ventana [i-W, i-1] ∪ [i+1, i+W] excluyendo self (i).
      //   Captura tanto "plata atrapada" (noun-first · estaba en motor) como
      //   "atrapada la plata" (state-first · faltaba). proximityWindow=3
      //   actúa como guard natural anti-FP · matched=true garantiza una
      //   emisión por familia. Aplica únicamente al branch combinatorial.
      let matched = false;

      // Helper inline · verifica si un token matchea cualquiera de los
      // stateMatchers (rama Fase 2) o de los states legacy (rama F1-F3).
      // stateMatchers tiene precedencia cuando ambos están definidos.
      const checkStateMatch = (token) => {
        if (Array.isArray(family.stateMatchers)) {
          for (const m of family.stateMatchers) {
            if (m.matchType === "exact_word") {
              if (token === m.pattern) return true;
            } else if (m.matchType === "stem_startswith") {
              if (token.startsWith(m.pattern)) return true;
            }
          }
          return false;
        }
        if (Array.isArray(family.states)) {
          for (const stateStem of family.states) {
            if (token.startsWith(stateStem)) return true;
          }
        }
        return false;
      };

      for (let i = 0; i < tokens.length && !matched; i++) {
        if (!family.nouns.includes(tokens[i])) continue;
        // Ventana bidireccional [i-W, i-1] ∪ [i+1, i+W] · excluye self (i)
        const lo = Math.max(0, i - family.proximityWindow);
        const hi = Math.min(tokens.length - 1, i + family.proximityWindow);
        for (let j = lo; j <= hi && !matched; j++) {
          if (j === i) continue;
          if (checkStateMatch(tokens[j])) {
            emitted.push(family.canonicalToken);
            matched = true;
            break;
          }
        }
      }
    } else if (family.type === "stem_only") {
      // Token que startsWith algún stem
      let matched = false;
      for (const token of tokens) {
        if (matched) break;
        for (const stem of family.stems) {
          if (token.startsWith(stem)) {
            emitted.push(family.canonicalToken);
            matched = true;
            break;
          }
        }
      }
    } else if (family.type === "disjunctive_set") {
      // term incluido en el texto entero
      for (const term of family.terms || []) {
        if (normalizedText.includes(term)) {
          emitted.push(family.canonicalToken);
          break;
        }
      }
    } else if (family.type === "combinatorial_with_standalone") {
      // BRIEF #37-sextus · Fase 3 · F7
      // Paso 1: combinatoria normal (noun + state en proximidad).
      // Paso 2: SOLO si paso 1 NO matcheó, fallback nounStandalone.
      let matched = false;
      // Paso 1 · combinatorial
      for (let i = 0; i < tokens.length && !matched; i++) {
        if (!family.nouns.includes(tokens[i])) continue;
        const upTo = Math.min(tokens.length, i + 1 + family.proximityWindow);
        for (let j = i + 1; j < upTo && !matched; j++) {
          const token = tokens[j];
          for (const m of family.stateMatchers) {
            if (m.matchType === "exact_word") {
              if (token === m.pattern) {
                emitted.push(family.canonicalToken);
                matched = true;
                break;
              }
            } else if (m.matchType === "stem_startswith") {
              if (token.startsWith(m.pattern)) {
                emitted.push(family.canonicalToken);
                matched = true;
                break;
              }
            }
          }
        }
      }
      // Paso 2 · standalone fallback (solo si paso 1 falló)
      if (!matched && Array.isArray(family.nounStandalone)) {
        for (const token of tokens) {
          if (family.nounStandalone.includes(token)) {
            emitted.push(family.canonicalToken);
            matched = true;
            break;
          }
        }
      }
    } else if (family.type === "combinatorial_double") {
      // BRIEF #37-sextus · Fase 3 · F9
      // verbStem × (intensifiers ∪ economicObjects) con VENTANA BIDIRECCIONAL
      // ≤ proximityWindow. Justificación: sintaxis interrogativa española
      // invierte verbo+modificador frecuentemente ("¿qué deja más?" vs
      // "¿más rinde qué?"). Único caso del registry con ventana bidireccional.
      let matched = false;

      // ──────────────────────────────────────────────────────────────────
      // BRIEF #3 (post-46-bis) · Early-emit single_noun
      //   Si la familia define family.singleNouns, evaluar PRIMERO substring
      //   o exact_word standalone. Si matchea, emite canonical y skip
      //   combinatoria (idempotente · una emisión por familia).
      //   Si no matchea, flujo combinatorial estándar continúa bitwise.
      // ──────────────────────────────────────────────────────────────────
      if (Array.isArray(family.singleNouns)) {
        for (const sn of family.singleNouns) {
          if (sn.subType === "substring") {
            if (normalizedText.includes(sn.pattern)) {
              emitted.push(family.canonicalToken);
              matched = true;
              break;
            }
          } else if (sn.subType === "exact_word") {
            if (tokens.includes(sn.pattern)) {
              emitted.push(family.canonicalToken);
              matched = true;
              break;
            }
          }
        }
      }

      const w = family.proximityWindow;
      for (let i = 0; i < tokens.length && !matched; i++) {
        const token = tokens[i];
        // ¿token matchea algún verbStem?
        let isVerb = false;
        for (const m of family.verbStems) {
          if (m.matchType === "exact_word") {
            if (token === m.pattern) { isVerb = true; break; }
          } else if (m.matchType === "stem_startswith") {
            if (token.startsWith(m.pattern)) { isVerb = true; break; }
          }
        }
        if (!isVerb) continue;
        // Ventana bidireccional [i-w, i-1] ∪ [i+1, i+w] · excluye self (i)
        const lo = Math.max(0, i - w);
        const hi = Math.min(tokens.length - 1, i + w);
        for (let j = lo; j <= hi && !matched; j++) {
          if (j === i) continue;
          const tj = tokens[j];
          if (family.intensifiers.includes(tj) || family.economicObjects.includes(tj)) {
            emitted.push(family.canonicalToken);
            matched = true;
            break;
          }
        }
      }
    }
  }

  if (emitted.length === 0) return normalizedText;
  return normalizedText + " " + emitted.join(" ");
}

export function extractConcepts(text) {
  const normalized = normalizeText(text);
  const conceptsDetected = [];

  // 1. Conceptos estándar de ontología (no dynamic)
  for (const [conceptId, concept] of Object.entries(CONCEPT_ONTOLOGY)) {
    if (conceptId === "client_entity") continue; // se procesa aparte
    // CORTE 1 · family_entity también se procesa en bloque dedicado (abajo), igual
    // que client_entity. Con flag OFF, family_entity no está en CONCEPT_ONTOLOGY,
    // así que esta guarda nunca aplica → loop idéntico al piso.
    if (FEATURE_FAMILY_AS_ENTITY && conceptId === "family_entity") continue;

    let totalWeight = 0;
    let signalsMatched = 0;
    const matchedSignalTypes = new Set();

    for (const signal of concept.signals) {
      if (signal.dynamic) continue;
      const patterns = signal.patterns || [];
      for (const pattern of patterns) {
        if (normalized.includes(pattern)) {
          totalWeight += signal.weight;
          signalsMatched++;
          matchedSignalTypes.add(signal.type);
          break;
        }
      }
    }

    const rule = concept.activation_rule;
    const requiredAnyMatched = !rule.required_any ||
      rule.required_any.some(req => {
        // BRIEF #17-bis · soportar composición AND con "+"
        // "client_collective + margin_deterioration_verb" → ambos deben matchear
        if (req.includes("+")) {
          const components = req.split("+").map(s => s.trim());
          return components.every(comp => matchedSignalTypes.has(comp));
        }
        // OR clásico con "|"
        const alternatives = req.split("|").map(s => s.trim());
        return alternatives.some(alt => matchedSignalTypes.has(alt));
      });

    const minCount = rule.minimum_signal_count || 1;
    const minWeight = rule.minimum_combined_weight || 0;

    if (requiredAnyMatched && signalsMatched >= minCount && totalWeight >= minWeight) {
      conceptsDetected.push({
        type: conceptId,
        confidence: Math.min(totalWeight, 1.0),
        signals_matched: signalsMatched,
        // BRIEF #37 v2 · aditivo · expone qué signal types matchearon
        // para que override de goal (F2 action_liberate) lo lea downstream.
        signals_matched_types: Array.from(matchedSignalTypes),
      });
    }
  }

  // 2. client_entity dinámico
  for (const clientName of CLIENT_NAMES) {
    const clientNorm = normalizeText(clientName);
    if (normalized.includes(clientNorm)) {
      conceptsDetected.push({
        type: "client_entity",
        confidence: 0.9,
        value: clientName,
      });
    }
  }

  // CORTE 1 · 2.5 · family_entity dinámico (espejo de client_entity).
  // Empuja EXACTAMENTE UN family_entity: específico (0.9, value=nombre) si matchea
  // un nombre de SUPERFAMILIAS o alias; sino genérico (0.7, value=null) si aparece
  // "familia"/"familias" (→ family_dive abre la familia top, caso 1). Fuente de
  // nombres = SUPERFAMILIAS (única fuente de verdad). Aliases mínimos y distintivos.
  if (FEATURE_FAMILY_AS_ENTITY) {
    const _famAliases = {
      "Electrodomésticos": ["electro"],
      "Materiales de Construcción": ["construccion", "materiales"],
    };
    let _familyMatched = null;
    for (const fam of SUPERFAMILIAS.slice(1)) { // omite "Todas"
      const tokens = [normalizeText(fam), ...(_famAliases[fam] || [])];
      if (tokens.some(t => t && normalized.includes(t))) { _familyMatched = fam; break; }
    }
    if (_familyMatched) {
      conceptsDetected.push({ type: "family_entity", confidence: 0.9, value: _familyMatched });
    } else if (["familia", "familias"].some(p => normalized.includes(p))) {
      conceptsDetected.push({ type: "family_entity", confidence: 0.7, value: null });
    }
  }

  // CORTE 2 · 2.6 · growth_projection_marker (defensa de precedencia).
  // Enciende con condicional ("si"/"qué pasa si"/"y si") + verbo de crecimiento/
  // caída. NO exige magnitud acá (extractGrowthSimulation pide precisión si falta).
  // El chain W.6 (PRE-detectIntent) ya intercepta growth; este marcador solo evita
  // que el dive lo capture si la query llegara a resolveSemanticIntent.
  if (FEATURE_GROWTH_PROJECTION) {
    const _cond = normalized.startsWith("si ") || normalized.includes(" si ")
      || normalized.startsWith("que pasa si") || normalized.startsWith("y si");
    const _growthVerb = /\b(crece\w*|crezca\w*|crecier\w*|aument\w*|sube\w*|suben\w*|subier\w*|cae|caen|caer\w*|caiga\w*|cayer\w*|baja\w*|bajen\w*|bajar\w*)\b/.test(normalized);
    // Excluir margen (eso es simulación de margen, no growth top-line).
    const _esMargen = /margen|m[aá]rgenes|rentabilidad/.test(normalized);
    if (_cond && _growthVerb && !_esMargen) {
      conceptsDetected.push({ type: "growth_projection_marker", confidence: 0.9, value: null });
    }
  }

  // 3. module_entity con subtype
  const moduleSubtypes = {
    "module_ventas": ["ventas", "facturacion"],
    "module_margenes": ["margenes", "margen general", "rentabilidad general", "mis margenes"],
    "module_inventario": ["inventario", "stock general"],
  };
  for (const [subtype, patterns] of Object.entries(moduleSubtypes)) {
    for (const pattern of patterns) {
      if (normalized.includes(pattern)) {
        const existing = conceptsDetected.find(c => c.type === "module_entity");
        if (existing && !existing.subtype) {
          existing.subtype = subtype;
        }
        break;
      }
    }
  }

  return conceptsDetected;
}

export function scoreIntents(concepts) {
  const scores = {};

  for (const [intentId, intent] of Object.entries(INTENTS_REGISTRY)) {
    const sig = intent.signature;
    let score = 0;
    let valid = true;

    // Check forbidden
    // BRIEF #19 · soporta items condicionales: { type: "X", unless: "Y" }.
    // El concepto X bloquea el intent A MENOS QUE el concepto Y también
    // esté presente (forbidden condicional). String simple = forbidden
    // incondicional (comportamiento clásico).
    if (sig.forbidden && sig.forbidden.length > 0) {
      for (const forbiddenItem of sig.forbidden) {
        if (typeof forbiddenItem === "string") {
          // Forbidden clásico incondicional
          if (concepts.some(c => c.type === forbiddenItem)) {
            valid = false;
            break;
          }
        } else if (forbiddenItem && typeof forbiddenItem === "object") {
          // Forbidden condicional: bloquea unless el concepto unless está presente
          const blockerType = forbiddenItem.type;
          const unlessType = forbiddenItem.unless;
          const blockerPresent = concepts.some(c => c.type === blockerType);
          const unlessPresent = unlessType && concepts.some(c => c.type === unlessType);
          if (blockerPresent && !unlessPresent) {
            valid = false;
            break;
          }
        }
      }
    }
    if (!valid) {
      scores[intentId] = 0;
      continue;
    }

    // Check required
    if (sig.required && sig.required.length > 0) {
      const allRequiredPresent = sig.required.every(reqType =>
        concepts.some(c => c.type === reqType)
      );
      if (!allRequiredPresent) {
        scores[intentId] = 0;
        continue;
      }
      for (const reqType of sig.required) {
        const c = concepts.find(x => x.type === reqType);
        score += c.confidence;
      }
      score = score / sig.required.length;
    }

    // BRIEF #20 · Check required_any_secondary.
    // Diferente de required_any: required_any_secondary EXIGE que los
    // required clásicos estén TODOS presentes, MÁS al menos UNO de los
    // required_any_secondary. Permite intents con firma compuesta:
    // "concepto primario obligatorio + uno de N secundarios".
    if (sig.required_any_secondary && sig.required_any_secondary.length > 0) {
      const anySecondaryMatched = sig.required_any_secondary.some(reqType =>
        concepts.some(c => c.type === reqType)
      );
      if (!anySecondaryMatched) {
        scores[intentId] = 0;
        continue;
      }
      // Suma confidence del primer concepto secundario que matcheó (peso parcial 0.5)
      for (const reqType of sig.required_any_secondary) {
        const c = concepts.find(x => x.type === reqType);
        if (c) {
          score += c.confidence * 0.5;
          break;
        }
      }
    }

    // BRIEF #18 · Check required_any · al menos UNO debe matchear.
    // Mutuamente excluyente con required (un intent usa uno u otro).
    if (sig.required_any && sig.required_any.length > 0) {
      const anyMatched = sig.required_any.find(reqType =>
        concepts.some(c => c.type === reqType)
      );
      if (!anyMatched) {
        scores[intentId] = 0;
        continue;
      }
      const matchedConcept = concepts.find(c => c.type === anyMatched);
      score += matchedConcept.confidence;
    }

    // Check requires_multiple
    if (sig.requires_multiple) {
      const targetType = sig.requires_multiple.concept;
      const minCount = sig.requires_multiple.min;
      const actualCount = concepts.filter(c => c.type === targetType).length;
      if (actualCount < minCount) {
        scores[intentId] = 0;
        continue;
      }
    }

    // Apply boost
    if (sig.boost && sig.boost.length > 0) {
      for (const boostType of sig.boost) {
        if (concepts.some(c => c.type === boostType)) {
          score += 0.1;
        }
      }
    }

    scores[intentId] = Math.min(score, 1.0);
  }

  return scores;
}

export function hypothesizeMechanisms(intentId) {
  const intent = INTENTS_REGISTRY[intentId];
  if (!intent) return [];
  return intent.mechanisms_relacionados.filter(m => m !== "all");
}

export function resolveSemanticIntent(text, context = {}) {
  // BRIEF #37 v2 · Pipeline expandido:
  //   normalizeText → semanticNormalize → extractConcepts → scoreIntents
  // El normalizer enriquece el texto con canonical tokens por familia
  // semántica (capital_inmovilizado, action_liberate, margin_erosion).
  // extractConcepts internamente vuelve a llamar normalizeText (idempotente
  // sobre texto ya normalizado · tokens __snake_case__ son inmunes).
  const normalized = normalizeText(text);
  const enriched = semanticNormalize(normalized);

  // Capa 2 · Extract concepts (Capa 1 normalize incluida internamente)
  const concepts = extractConcepts(enriched);

  if (concepts.length === 0) return null;

  // Capa 3 · Score intents
  const scores = scoreIntents(concepts);

  let topIntent = null;
  let topScore = 0;
  for (const [intentId, score] of Object.entries(scores)) {
    if (score > topScore) {
      topScore = score;
      topIntent = intentId;
    }
  }

  if (!topIntent) return null;

  // ════════════════════════════════════════════════════════════════════
  // H1 · TIE-BREAKER CROSS-DOMAIN (BRIEF post-#9 quirúrgico)
  //
  // Cuando múltiples intents tienen score idéntico Y TODOS pertenecen a
  // legacy_intent_type === "cross_domain_query", aplicar cascada:
  //   1. Mayor domains.length gana
  //   2. Si persiste empate: mayor mechanisms_relacionados.length gana
  //   3. Si persiste empate: fallback al orden actual del registry
  //      (topIntent ya calculado arriba · sin cambio)
  //
  // Lógica defensiva · si:
  //   · solo 1 intent tiene score máximo → no entra al tie-breaker
  //   · intents en empate NO son TODOS cross_domain_query → sin cambio
  //   · domains.length no existe en algún intent → fallback
  //   · cualquier error → fallback orden inserción (topIntent actual)
  //
  // Variables h1_* prefijadas · scoped al try-catch.
  // ════════════════════════════════════════════════════════════════════
  try {
    if (topScore > 0) {
      // Identificar TODOS los intents con score === topScore
      const h1_tied = [];
      for (const [intentId, score] of Object.entries(scores)) {
        if (score === topScore) h1_tied.push(intentId);
      }
      if (h1_tied.length >= 2) {
        // Verificar que TODOS sean cross_domain_query
        const h1_allCrossDomain = h1_tied.every(id => {
          const it = INTENTS_REGISTRY[id];
          return it && it.legacy_intent_type === "cross_domain_query";
        });
        if (h1_allCrossDomain) {
          // Cascada 1 · mayor domains.length gana
          let h1_winner = topIntent;
          let h1_maxDomains = -1;
          let h1_maxMechs = -1;
          let h1_winnerIdx = -1;
          // Recorrer en orden de inserción del registry para fallback estable
          const h1_orderedTied = Object.keys(INTENTS_REGISTRY).filter(id => h1_tied.includes(id));
          for (let i = 0; i < h1_orderedTied.length; i++) {
            const id = h1_orderedTied[i];
            const it = INTENTS_REGISTRY[id];
            const dCount = Array.isArray(it.domains) ? it.domains.length : 0;
            const mCount = Array.isArray(it.mechanisms_relacionados) ? it.mechanisms_relacionados.length : 0;
            // Si dCount === 0 (domains no existe) · saltar este candidato
            // pero NO fallar el tie-breaker entero · seguir con los demás
            if (dCount === 0) continue;
            if (dCount > h1_maxDomains) {
              h1_maxDomains = dCount;
              h1_maxMechs = mCount;
              h1_winner = id;
              h1_winnerIdx = i;
            } else if (dCount === h1_maxDomains) {
              // Cascada 2 · mayor mechanisms_relacionados.length gana
              if (mCount > h1_maxMechs) {
                h1_maxMechs = mCount;
                h1_winner = id;
                h1_winnerIdx = i;
              }
              // Cascada 3 · empate persiste → primero en orden inserción
              // ya está en h1_winner (se mantiene · no se sobreescribe)
            }
          }
          // Solo aplicar si el winner detectado tiene un dCount válido
          if (h1_maxDomains > 0 && h1_winner !== topIntent) {
            topIntent = h1_winner;
          }
        }
      }
    }
  } catch (h1_err) {
    // eslint-disable-next-line no-console
    console.warn("H1 tie-breaker error:", h1_err);
    // FAIL-SAFE: topIntent ya tiene el valor orden-inserción · sin cambio
  }

  const intent = INTENTS_REGISTRY[topIntent];

  // Capa 5 · Confidence threshold
  if (topScore < intent.confidence_threshold) return null;

  // Capa 4 · Hypothesize mechanisms (info para Cortex)
  const mechanisms = hypothesizeMechanisms(topIntent);

  // Extract params
  const params = intent.resolve_params(text, concepts, context);

  const legacyType = intent.legacy_intent_type;

  const result = {
    type: legacyType,
    _semantic_meta: {
      intent_id: topIntent,
      confidence: topScore,
      concepts: concepts.map(c => c.type),
      // BRIEF #37 v2 · aditivo · objetos completos para que override goal
      // (PIEZA 6 setConversationContext) lea signals_matched_types.
      // Cero impacto en consumidores existentes (campo paralelo).
      concepts_full: concepts,
      mechanisms_hypothesis: mechanisms,
      resolved_by: "semantic_layer_v2",
    },
  };

  if (legacyType === "client") {
    result.clientName = params.clientName;
  } else if (legacyType === "simulation") {
    result.text = text;
  } else if (legacyType === "cross_domain_query") {
    result.crossDomain = {
      isCrossDomainQuery: true,
      archetype: intent.legacy_archetype,
      domainsDetected: intent.domains,
      hasRankingIntent: false,
    };
  } else if (legacyType === "module") {
    result.modulo = params.modulo;
  } else if (legacyType === "sku_operational") {
    // BRIEF #20 · dispatch a composer SKU operacional
    result.skuOperational = true;
  } else if (legacyType === "sku_deep_dive") {
    // BRIEF #24 · deep dive de SKU específico. params.skuName viene de
    // resolve_params si fue detectado por concept layer; sino, queda
    // null y el dispatch lo resuelve por otro camino.
    result.skuDeepDive = true;
    result.skuName = params.skuName || null;
  } else if (legacyType === "product_contribution") {
    // BRIEF #21-B · ranking de productos por aporte económico (contribución)
    result.productContribution = true;
  } else if (legacyType === "product_dual_comparison") {
    // BRIEF #26-ter · Modo Oportunidad · dual virtuoso vs lastre
    result.productDualComparison = true;
  } else if (legacyType === "growth_opportunity") {
    // BRIEF #26-ter · Modo Oportunidad · dónde invertir esfuerzo comercial
    result.growthOpportunity = true;
  } else if (legacyType === "out_of_domain") {
    // BRIEF #21-A · declinación honesta de preguntas fuera de dominio
    result.outOfDomain = true;
  } else if (legacyType === "client_compare") {
    // V1 no soporta client_compare todavía → null para fallback
    return null;
  } else if (legacyType === "warehouse_dive") {
    // BRIEF #40-bis HOTFIX · propagar specificSucursal del
    // resolve_params al result. Patrón canónico del resto
    // de intents (skuName, clientName, modulo).
    result.specificSucursal = params.specificSucursal || null;
  } else if (FEATURE_FAMILY_AS_ENTITY && legacyType === "family") {
    // CORTE 1 · familia como entidad. familyName=null → la familia top por ventas
    // (caso 1). subFocus se setea solo vía detectFamilyFollowUp (arrastre).
    result.familyName = params.familyName || null;
    result.subFocus = params.subFocus || null;
  }

  return result;
}

export function detectCrossDomainQuery(userText) {
  const normalized = userText.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // Step 1: Check executive expressions first (more specific)
  let archetype = null;
  let autoDomains = [];
  for (const expr of CROSS_DOMAIN_EXECUTIVE_EXPRESSIONS) {
    for (const p of expr.pattern) {
      if (normalized.includes(p)) {
        archetype = expr.archetype;
        autoDomains = [...expr.autoDomains];
        break;
      }
    }
    if (archetype) break;
  }

  // Step 2: Detect explicit domain keywords
  const domainsFound = new Set(autoDomains);
  for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
    for (const kw of keywords) {
      if (normalized.includes(kw)) {
        domainsFound.add(domain);
        break;
      }
    }
  }

  const hasRankingIntent = RANKING_INTENT_PATTERNS.some(p =>
    normalized.includes(p)
  );

  const isMultiDomain = domainsFound.size >= 2;
  const isCrossDomainQuery = archetype !== null || isMultiDomain;

  return {
    isCrossDomainQuery: isCrossDomainQuery,
    archetype: archetype,
    domainsDetected: Array.from(domainsFound),
    hasRankingIntent: hasRankingIntent,
  };
}

export function detectIntent(userText, context = {}) {
  // Normalizar: lowercase + sin acentos
  const normalized = userText
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  // Versión sin signos iniciales para .startsWith()
  const stripped = normalized.replace(/^[¿¡?!.,;:\s]+/, "");

  // PRIORIDAD 0 · Afirmativa corta tras una respuesta sobre un cliente
  // El test es sobre el texto completo trimmed (sin signos al final): un "sí"
  // solo, un "ok" solo, etc. Si la afirmativa viene acompañada de keywords
  // adicionales ("sí pero el margen"), se cae a las prioridades siguientes.
  const naked = normalized.trim().replace(/[¿¡?!.,;:]+$/g, "").trim();
  if (context.lastClientMentioned && AFFIRMATIVE_REPLIES.includes(naked)) {
    return { type: "client_followup", clientName: context.lastClientMentioned };
  }

  // FASE 1.5.B-HOTFIX-3 · PRIORIDAD 0.05 · Comparación cliente sobre memoria
  // Detecta "compáralo con Y" · resuelve clientA desde lastClientMentioned + clientB del texto.
  // Va ANTES de 0.1 porque tiene patrón comparativo explícito (más específico).
  const clientComparison = detectClientComparison(userText, context);
  if (clientComparison) {
    return {
      type: "client_comparison",
      clientA: clientComparison.clientA,
      clientB: clientComparison.clientB,
    };
  }

  // CORTE 6 · comparación familia/bodega · DESPUÉS de cliente (cliente tiene
  // precedencia). Mutuamente excluyentes: cada detector exige ≥2 entidades de su
  // tipo, así un cruce de tipo deja 1 de cada → ninguno dispara. Flag OFF → null.
  if (FEATURE_ENTITY_COMPARISON) {
    const famCmp = detectFamilyComparison(userText, context);
    if (famCmp) return famCmp;
    const whCmp = detectWarehouseComparison(userText, context);
    if (whCmp) return whCmp;
  }

  // CORTE 8 · comparación de marca · marca vs marca (≥2 marcas distintas · va con
  // las otras comparaciones, después de cliente). No roba SKU dual (un par de SKUs
  // no tiene ≥2 marcas distintas). Flag OFF → null.
  if (FEATURE_BRAND_AS_ENTITY) {
    const brandCmp = detectBrandComparison(userText, context);
    if (brandCmp) return brandCmp;
  }

  // FASE 1.5.B-HOTFIX-3 · PRIORIDAD 0.07 · Follow-up métrico sobre cliente memoria
  // Detecta "y la X" / "y el X" donde X es métrica · resuelve cliente desde memoria.
  // Va ANTES de 0.1 porque tiene patrón conversacional explícito · si no matchea,
  // pipeline cae al flow tradicional sin romper anti-regresión.
  const clientMetricFU = detectClientMetricFollowUp(userText, context);
  if (clientMetricFU) {
    return {
      type: "client_metric_followup",
      clientName: clientMetricFU.clientName,
      metricKey: clientMetricFU.metricKey,
    };
  }

  // CORTE 1 · PRIORIDAD 0.08 · Arrastre contextual de familia (criterio 7).
  // "y sus SKUs" / "sus clientes" / "cuánto vende" tras abrir una familia.
  // Va DESPUÉS del follow-up de cliente (cliente tiene precedencia si es el foco)
  // y ANTES de SKU/cognitive/semántica. Solo dispara si la familia es el foco más
  // reciente (freshness en detectFamilyFollowUp). Con flag OFF queda inerte.
  if (FEATURE_FAMILY_AS_ENTITY) {
    const familyFU = detectFamilyFollowUp(userText, context);
    if (familyFU) return familyFU;
  }

  // CORTE 5 · inventario por familia · intercepta (inventario físico + familia)
  // ANTES de resolveSemanticIntent (que dispersa estas queries en family_dive /
  // sku_operational / module). Va DESPUÉS del follow-up de familia (que defiere si
  // hay nombre explícito) y requiere familia explícita o "familias". Flag OFF → inerte.
  if (FEATURE_FAMILY_INVENTORY) {
    const famInv = detectFamilyInventoryQuery(userText, context);
    if (famInv) return famInv;
  }

  // BRIEF #24 · PRIORIDAD 0.1 · Detección temprana de referencia SKU/deíctico.
  // Si el texto menciona un SKU canónico (LG-DRYER8KG, SAM-REF500L, etc),
  // retornamos directo sku_deep_dive. Si usa deíctico ordinal ("el primero",
  // "el segundo", "el último") o anafórico ("ese", "este") con entidad en
  // memoria, resolvemos contra context.lastSkuList o context.lastClientList.
  //
  // Va ANTES de resolveSemanticIntent porque:
  //   (1) los SKUs canónicos no tienen pattern en CONCEPT_ONTOLOGY · si se
  //       resolviera por capa semántica, requeriría agregar 13 patterns
  //       (uno por SKU) en concept_sku_query, sumando ruido y rompiendo
  //       intents que requieren forbidden:["concept_sku_query"].
  //   (2) los deícticos son contextuales · sólo tienen sentido si hay
  //       memoria conversacional. Resolver ANTES garantiza prioridad sobre
  //       intents que podrían matchear el texto sin contexto.

  // BRIEF Q · BETA · Q.D · Executive Report detector
  // Va ANTES de detectExecutiveIntent (N.B.1/N.B.3) porque Q.D es vista
  // COMPLETA cross-domain (reporte ejecutivo) y N.B.x son slices unidimensionales
  // (action 1 decisión · concern 1 dimensión riesgo). Pattern Q.D explícito
  // (resumen/reporte/panorama/cómo está el negocio) NO solapa con "qué harías"
  // (N.B.1) ni "qué me preocuparía" (N.B.3). Cero touch a EXECUTIVE_INTENT_PATTERNS
  // firmados V_VISUAL · si Q.D NO matchea, sigue flujo normal a N.B.x.
  // Flag rollback VOICE_EXECUTIVE_REPORT_COMPOSER_ENABLED.
  // BRIEF R · R.I · FIX_DISPATCHER · V2 detector va ANTES de V1.
  // detectExecutiveReportV2Intent honra VOICE_NARRATIVE_V2_ENABLED internamente
  // (línea 38040 · early return null si flag OFF). Por eso NO requiere guard
  // de flag aquí · si V2 está OFF retorna null y sigue flujo normal hacia V1.
  // Cero touch a V1 (guard VOICE_EXECUTIVE_REPORT_COMPOSER_ENABLED + invocación)
  // que sigue invariante a continuación.
  // Lección registrada: #L-CERO-TOUCH-A-V1-NO-EQUIVALE-A-CONECTAR-V2-AL-DISPATCHER
  const reportIntentV2 = detectExecutiveReportV2Intent(userText);
  if (reportIntentV2) return reportIntentV2;

  if (VOICE_EXECUTIVE_REPORT_COMPOSER_ENABLED) {
    const reportIntent = detectExecutiveReportIntent(userText);
    if (reportIntent) return reportIntent;
  }

  // BRIEF N · executive intent detection (D-N-5 estrategia FIX_L_PRECEDENCE)
  // Va ANTES de SKU/cliente detection porque patterns F son frases largas
  // ("si fueras gerente comercial qué harías") · únicas · cero solape con
  // ranking/deep-dive. Guard estricto · si pattern no matchea · sigue flujo
  // normal. Flag rollback VOICE_EXECUTIVE_INTELLIGENCE_ENABLED.
  if (VOICE_EXECUTIVE_INTELLIGENCE_ENABLED) {
    const executiveIntent = detectExecutiveIntent(userText);
    if (executiveIntent) return executiveIntent;
  }

  const skuByName = detectSkuInText(userText);
  if (skuByName) {
    return { type: "sku_deep_dive", skuName: skuByName };
  }

  // BRIEF #25-ter · detección de acciones cognitivas escritas en texto libre.
  // El usuario puede escribir "plan de salida", "y los otros", "qué clientes
  // lo compran", etc. Cada acción se resuelve con entidad implícita desde
  // conversationContext (lastSkuMentioned / lastClientMentioned / listas).
  //
  // Va ANTES de deíctico porque las acciones cognitivas son más específicas
  // que un deíctico simple ("plan de salida" → exit_plan, no deep dive de
  // entidad genérica). Si el detector retorna null (no matchea pattern, o
  // matchea pero falta entidad en memoria), el flujo continúa a deíctico
  // → resolveSemanticIntent normal · backward compat preservado.
  const cognitiveAction = detectCognitiveAction(userText, context);
  if (cognitiveAction) {
    return { type: "cognitive_action", action: cognitiveAction };
  }

  // CORTE 9 · MICRO-FIX precedencia (gateado · OFF byte-idéntico a 9ed4206e).
  // Guarda predictivo/linaje: estas dos intenciones colisionan con el drilldown
  // ("qué SKU…"). Se hoistean antes del drilldown para que ganen. Solo interceptan
  // los modos predictive/lineage (frase inequívoca: "se agotará", "demanda futura",
  // "elasticidad", o meta-pregunta de linaje) → un drill legítimo no las dispara.
  // (La comparación interrogativa de bodegas NO necesita guarda aquí: detectWarehouse
  // Comparison ya corre en L~4755 dentro del bloque FEATURE_ENTITY_COMPARISON, antes
  // de este punto; su precedencia frente al superlativo se resuelve en el handler,
  // micro-fix v2.)
  if (FEATURE_INVENTORY_PREMIUM) {
    const _invPredEarly = detectInventoryPremium(userText, context);
    if (_invPredEarly && (_invPredEarly.mode === "predictive" || _invPredEarly.mode === "lineage")) return _invPredEarly;
  }

  // BRIEF #27 · Active Investigation Drilldown
  // Si hay investigation activa en conversationContext y el usuario hace
  // pregunta de DIMENSIÓN sin nombrar entidad canónica (SKU/cliente ya
  // resueltos arriba), heredamos contexto y aplicamos nueva dimensión.
  // El composer destino (composeContextualDrilldown) lee el dataset
  // apropiado según domain y agrupa por la dimensión solicitada.
  const drilldown = detectActiveInvestigation(userText, context);
  if (drilldown) {
    return drilldown;
  }

  const deicticRef = detectDeicticReference(userText, context);
  if (deicticRef.resolved && deicticRef.entityType === "sku") {
    return { type: "sku_deep_dive", skuName: deicticRef.entityValue };
  }
  if (deicticRef.resolved && deicticRef.entityType === "client") {
    return { type: "client", clientName: deicticRef.entityValue };
  }

  // BRIEF #17 · Semantic Understanding Layer (V2)
  // Se evalúa después de la afirmativa corta (contexto especial) y antes
  // del detector léxico V1. Si encuentra resolución con confianza suficiente,
  // retorna directamente. Si retorna null (sin conceptos o confianza baja),
  // cae al detector léxico V1 actual (backward compatibility preservada).
  // FIX #D-DRILL-ELIPTICO-SKU · la elipsis "¿qué SKU?" tras navegar cliente/familia → drill al SKU.
  // VA ANTES de resolveSemanticIntent porque "¿qué SKU?" se mal-clasifica como "module" en la capa
  // semántica (→ fallback). Con contexto de navegación fresco, lo ruteamos a composeClientToSku (el
  // mismo destino que "los SKU de esa familia"). Sin contexto fresco → null → sigue el flujo normal.
  const _ellipticalDrill = detectEllipticalSkuDrill(userText, context);
  if (_ellipticalDrill) return _ellipticalDrill;

  // FIX #D-VENTAS-TOTAL-LEXICO · "cuánto vendí en total" (venta global SIN lista) → módulo ventas.
  // VA ANTES de resolveSemanticIntent porque la frase conversacional cae al fallback (no contiene
  // "ventas"/"facturacion" y no hay lista → ni módulo ni aggregation la capturan). Con lista de contexto
  // ("esos"/"ellos") → el detector devuelve null → sigue el flujo y aggregation_sum_on_context maneja.
  const _ventasTotalGlobal = detectVentasTotalGlobal(userText, context);
  if (_ventasTotalGlobal) return _ventasTotalGlobal;

  // CORTE 9 · router de inventario físico (world-lock) · ANTES de marca y de la
  // capa semántica/comercial, para que las consultas físicas no caigan al template
  // comercial ni al fallback. Gana sobre brand dive en "Makita en Antofagasta"
  // (marca×bodega). No roba bodega-sola/familia-inventario/marca-inventario (esos
  // requieren su propio detector y el router devuelve null). Flag OFF → null.
  if (FEATURE_INVENTORY_PREMIUM) {
    const invPrem = detectInventoryPremium(userText, context);
    if (invPrem) return invPrem;
  }

  // CORTE 8 · marca como sujeto · DESPUÉS de SKU/deícticos/drill (un SKU como
  // LG-WASH11KG gana sobre la marca LG) y ANTES de la capa semántica. Defiere a
  // cliente (precedencia). Solo entra por un nombre ∈ MARCAS_ALL. Flag OFF → null.
  if (FEATURE_BRAND_AS_ENTITY) {
    const brandDive = detectBrandDive(userText, context);
    if (brandDive) return brandDive;
  }

  const semanticResolution = resolveSemanticIntent(userText, context);
  if (semanticResolution !== null) {
    return semanticResolution;
  }

  // === V1 (legacy) detector léxico continúa abajo ===

  // BRIEF #14 · PRIORIDAD 0.3 · Cross-Domain Query
  // Procesa preguntas que mezclan 2+ dominios o usan expresiones ejecutivas
  // amplias. Sin esto, la pregunta cae a detección simple y devuelve
  // respuesta de un solo dominio. Va antes de simulación porque preguntas
  // como "si pierdo a mis 3 principales" deben rutar a cross-domain
  // exposure_analysis, no a simulation single-client.
  const crossDomain = detectCrossDomainQuery(userText);
  if (crossDomain.isCrossDomainQuery) {
    return {
      type: "cross_domain_query",
      crossDomain: crossDomain,
    };
  }

  // PRIORIDAD 0.5 · Simulación ("qué pasa si…", "y si…", "si pierdo/renegocio…")
  // Va ANTES de cliente porque "qué pasa si pierdo a Falabella" es una
  // simulación con cliente, no un perfil descriptivo de cliente (BRIEF #8-cuatris).
  const isSimulation = (
    stripped.startsWith("que pasa si") ||
    stripped.startsWith("y si") ||
    normalized.includes("si pierdo") ||
    normalized.includes("si renegocio") ||
    normalized.includes("si liquido") ||
    normalized.includes("si subo") ||
    normalized.includes("si bajo")
  );
  if (isSimulation) {
    return { type: "simulation", text: userText };
  }

  // Helper: matchea la keyword como palabra completa (\b…\b en regex).
  // Permite frases multi-palabra como "mercado libre" o "carga comercial".
  const hasWord = (kw) => {
    const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`\\b${escaped}\\b`, "i").test(normalized);
  };

  // PRIORIDAD 1 · Cliente específico mencionado
  for (const client of CLIENT_KEYWORDS) {
    if (hasWord(client)) {
      return {
        type: "client",
        clientName: CLIENT_NAME_MAP[client] || client,
      };
    }
  }

  // BRIEF P · ALPHA · SEMANTIC INTENT LAYER
  // FIX_P_C_RUNTIME_RELOCATION · ubicado ANTES de PRIORIDAD 2 módulo · queries
  // naturales con métrica+qualifier (ej. "qué clientes con bajo margen") son
  // MÁS ESPECÍFICAS que queries genéricas de módulo. Si ALPHA no mapea (sin
  // direccionalidad por D-P.B-5 · sin entity ni qualifier inferencial) ·
  // retorna null y el flujo CAE a PRIORIDAD 2 como pre-FIX. Backward compat 100%.
  // Lección #L-INSERCION-ANTES-DEL-RETURN-FINAL-NO-ES-DESPUES-DE-DETECTORES.
  if (VOICE_SEMANTIC_INTENT_LAYER_ENABLED) {
    const semanticIntent = composeSemanticIntent(userText, context);
    if (semanticIntent) return semanticIntent;
  }

  // PRIORIDAD 2 · Módulo específico (orden: ventas, margenes, inventario)
  for (const [moduloKey, keywords] of Object.entries(KEYWORDS_DICTIONARY)) {
    for (const kw of keywords) {
      if (hasWord(kw)) {
        return { type: "module", modulo: moduloKey };
      }
    }
  }

  // PRIORIDAD 3 · Sin match → genérico contextual al escenario
  return { type: "generic" };
}

export function detectAllClientsInText(text) {
  if (!text || typeof text !== "string") return [];
  const normalized = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const matches = [];
  for (const key of CLIENT_KEYWORDS) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`\\b${escaped}\\b`, "i");
    const m = normalized.match(re);
    if (m) {
      matches.push({ name: CLIENT_NAME_MAP[key] || key, index: m.index });
    }
  }
  // Ordenar por posición de aparición en el texto
  matches.sort((a, b) => a.index - b.index);
  // Deduplicar preservando orden
  return [...new Set(matches.map(m => m.name))];
}

export function parseQuantifier(token, companionNumber) {
  if (!token) return null;
  const t = token.toLowerCase();
  if (/^\d+$/.test(t)) return { kind: "number", value: parseInt(t, 10) };
  if (/^primer/.test(t)) {
    const v = companionNumber && /^\d+$/.test(companionNumber) ? parseInt(companionNumber, 10) : null;
    return { kind: "from_start", value: v };
  }
  if (/^[uú]ltim/.test(t)) {
    const v = companionNumber && /^\d+$/.test(companionNumber) ? parseInt(companionNumber, 10) : null;
    return { kind: "from_end", value: v };
  }
  if (/^anteriores$/.test(t)) return { kind: "all_prior", value: null };
  return null;
}

export function pickPluralList(text, context) {
  if (!context) return null;
  if (_DEICTIC_SKU_HINT.test(text)) {
    if (context.lastSkuList && context.lastSkuList.length > 0) {
      return { list: context.lastSkuList, resolvedFrom: "lastSkuList", entityType: "plural_sku" };
    }
    return null;
  }
  if (_DEICTIC_CLIENT_HINT.test(text)) {
    if (context.lastClientList && context.lastClientList.length > 0) {
      return { list: context.lastClientList, resolvedFrom: "lastClientList", entityType: "plural_client" };
    }
    return null;
  }
  // Sin pista explícita · priorizar según lastIntent y disponibilidad
  const lastIntentIsClient = context.lastIntent === "cross_domain_query"
    || context.lastIntent === "client"
    || context.lastIntent === "client_followup"
    || context.lastIntent === "client_contribution_ranking";
  if (lastIntentIsClient && context.lastClientList && context.lastClientList.length > 0) {
    return { list: context.lastClientList, resolvedFrom: "lastClientList", entityType: "plural_client" };
  }
  if (context.lastSkuList && context.lastSkuList.length > 0) {
    return { list: context.lastSkuList, resolvedFrom: "lastSkuList", entityType: "plural_sku" };
  }
  if (context.lastClientList && context.lastClientList.length > 0) {
    return { list: context.lastClientList, resolvedFrom: "lastClientList", entityType: "plural_client" };
  }
  return null;
}

export function applyQuantifierSlice(list, quantifier) {
  if (!quantifier) return list.slice(); // sin cuantificador · lista completa
  if (quantifier.kind === "number") {
    return list.slice(0, quantifier.value);
  }
  if (quantifier.kind === "from_start") {
    // "primeros N" · usa value si está · sino lista completa (semántica débil)
    if (quantifier.value && quantifier.value > 0) {
      return list.slice(0, quantifier.value);
    }
    return list.slice();
  }
  if (quantifier.kind === "from_end") {
    // "últimos N" · usa value si está · sino último elemento como array de 1
    if (quantifier.value && quantifier.value > 0) {
      return list.slice(-quantifier.value);
    }
    return list.slice(-1);
  }
  if (quantifier.kind === "all_prior") {
    return list.slice();
  }
  return list.slice();
}

export function resolvePluralDeictic(lower, context) {
  // 1. Intentar cuantificado embebido primero (más específico)
  const quantMatch = lower.match(_DEICTIC_QUANTIFIED);
  if (quantMatch) {
    // quantMatch[1] · cuantificador principal (digit | primer/últim/anteriores)
    // quantMatch[2] · número compañero opcional ("primeros 2" · "últimos 3")
    const quantifier = parseQuantifier(quantMatch[1], quantMatch[2]);
    if (quantifier) {
      const picked = pickPluralList(lower, context);
      if (picked) {
        const entities = applyQuantifierSlice(picked.list, quantifier);
        if (entities.length > 0) {
          return {
            resolved: true,
            entityType: picked.entityType,
            entities,
            count: entities.length,
            resolvedFrom: picked.resolvedFrom,
            quantifier,
          };
        }
      }
    }
  }
  // 2. Definido cuantificado (los/las + cuantificador · sin demostrativo)
  // Cubierto por _DEICTIC_QUANTIFIED arriba · este branch redundante por claridad.
  // 3. Demostrativo puro (sin cuantificador)
  if (_DEICTIC_PLURAL_DEMONSTRATIVE.test(lower)) {
    const picked = pickPluralList(lower, context);
    if (picked) {
      return {
        resolved: true,
        entityType: picked.entityType,
        entities: picked.list.slice(),
        count: picked.list.length,
        resolvedFrom: picked.resolvedFrom,
        quantifier: null,
      };
    }
  }
  return null;
}

export function detectDeicticReference(text, context) {
  if (!text || !context) return { resolved: false };
  const lower = text.toLowerCase().trim();

  // BRIEF G · Rama plural bajo flag · evaluada PRIMERO porque cubre patrones
  // ortogonales a los singulares/ordinales existentes. Si la rama plural no
  // matchea · cae al comportamiento legacy intacto (backward compat estricta).
  if (VOICE_DEICTIC_PLURAL_ENABLED) {
    const plural = resolvePluralDeictic(lower, context);
    if (plural) return plural;
  }

  // Patrones de referencia ordinal · regex con word boundary
  const ordinalPatterns = [
    { regex: /\b(el|la|los|las)?\s*primer[oa]?s?\b/i, index: 0 },
    { regex: /\b(el|la|los|las)?\s*segund[oa]s?\b/i, index: 1 },
    { regex: /\b(el|la|los|las)?\s*tercer[oa]?s?\b/i, index: 2 },
    { regex: /\b(el|la|los|las)?\s*cuart[oa]s?\b/i, index: 3 },
    { regex: /\b(el|la|los|las)?\s*[uú]ltim[oa]s?\b/i, index: -1 },
  ];

  // Patrones anafóricos
  const anaphoricPatterns = [
    /\bese\b/i, /\beste\b/i, /\baquel\b/i,
    /\besa\b/i, /\besta\b/i, /\baquella\b/i,
    /\beso\b/i,
  ];

  // Determinar prioridad según lastIntent: si fue de clientes, priorizar clientes.
  // Intents de clientes que poblaron lastClientList:
  //   · cross_domain_query con archetype erosion/quality/dependency
  //   · client (deep dive de un cliente)
  const lastIntentIsClient = context.lastIntent === "cross_domain_query"
    || context.lastIntent === "client"
    || context.lastIntent === "client_followup";
  const tryClientFirst = lastIntentIsClient
    && context.lastClientList && context.lastClientList.length > 0;

  // Resolver ordinal
  for (const op of ordinalPatterns) {
    if (op.regex.test(lower)) {
      const sources = tryClientFirst
        ? [
            { list: context.lastClientList, type: "client" },
            { list: context.lastSkuList,    type: "sku"    },
          ]
        : [
            { list: context.lastSkuList,    type: "sku"    },
            { list: context.lastClientList, type: "client" },
          ];
      for (const src of sources) {
        if (src.list && src.list.length > 0) {
          const idx = op.index < 0 ? src.list.length + op.index : op.index;
          const value = src.list[idx];
          if (value) {
            // FIX #D-I5-CLIENT-ID-LEAK · resolver el ID a nombre (Falabella), no el ID crudo
            // (client_falabella). _d1fResolveEntityName es read-only y defensivo: si value es
            // un nombre real o no resuelve, pasa intacto. off → devuelve value (el ID · el bug).
            const _resolvedValue =
              (typeof ADI_IDLEAK_RESOLVE_ORDINAL_ENABLED !== "undefined" && ADI_IDLEAK_RESOLVE_ORDINAL_ENABLED)
                ? _d1fResolveEntityName(value)
                : value;
            return { resolved: true, entityType: src.type, entityValue: _resolvedValue };
          }
        }
      }
    }
  }

  // Resolver anafórico · usa lastSkuMentioned o lastClientMentioned
  for (const ap of anaphoricPatterns) {
    if (ap.test(lower)) {
      // Prioridad: el último mencionado (lo más reciente). Si hay ambos,
      // priorizar el del lastIntent.
      if (lastIntentIsClient && context.lastClientMentioned) {
        return { resolved: true, entityType: "client", entityValue: context.lastClientMentioned };
      }
      if (context.lastSkuMentioned) {
        return { resolved: true, entityType: "sku", entityValue: context.lastSkuMentioned };
      }
      if (context.lastClientMentioned) {
        return { resolved: true, entityType: "client", entityValue: context.lastClientMentioned };
      }
    }
  }

  return { resolved: false };
}

export function detectClientMetricFollowUp(text, context) {
  if (!context || !context.lastClientMentioned) return null;
  if (!text || typeof text !== "string") return null;

  // Normalizar · lowercase + sin acentos · trim
  const normalized = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

  // Patrones que indican follow-up con métrica sobre cliente memoria
  // Orden importa · evaluamos más específicos primero
  const followUpPatterns = [
    /^y\s+(el|la|los|las)\s+\w+/,           // "y la carga", "y el margen"
    /^y\s+(su|sus)\s+\w+/,                  // "y su rebate", "y sus ventas"
    /^que\s+tal\s+(el|la|su)\s+\w+/,        // "qué tal el margen"
    /^(que|cual)\s+(es|son)\s+(el|la|su|sus)\s+\w+/, // "cuál es el rebate"
    /^(el|la|su)\s+\w+\s+de\s+(eso|el|ella|esa)/, // "la carga de eso"
  ];

  const matchesFollowUp = followUpPatterns.some(p => p.test(normalized));
  if (!matchesFollowUp) return null;

  // Usar _detectMetricInText con hint "client" (busca métricas relevantes a cliente)
  // _detectMetricInText está definida más abajo (línea ~7195) · forward reference OK
  // porque se invoca en runtime, no en tiempo de declaración.
  const metricKey = _detectMetricInText(normalized, "client");
  if (!metricKey) return null;

  return {
    clientName: context.lastClientMentioned,
    metricKey,
  };
}

export function detectFamilyFollowUp(text, context) {
  if (!FEATURE_FAMILY_AS_ENTITY) return null;
  if (!context || !context.lastFamilyMentioned) return null;
  if (!text || typeof text !== "string") return null;

  // Freshness: familia fue el foco del turno anterior.
  if (typeof context.turnCount === "number"
      && context.lastFamilyMentionedTurn !== context.turnCount) {
    return null;
  }

  const normalized = normalizeText(text);

  // Si nombra una familia explícita → deferir a la ruta principal.
  const _famAliases = {
    "Electrodomésticos": ["electro"],
    "Materiales de Construcción": ["construccion", "materiales"],
  };
  for (const fam of SUPERFAMILIAS.slice(1)) {
    const tokens = [normalizeText(fam), ...(_famAliases[fam] || [])];
    if (tokens.some(t => t && normalized.includes(t))) return null;
  }

  // Patrones de follow-up elíptico → subFocus.
  // Orden: SKUs y clientes antes que métricas (más específicos).
  const _has = (arr) => arr.some(p => normalized.includes(p));
  let subFocus = null;
  if (_has(["sus skus", "y sus skus", "los skus", "que skus", "cuales skus",
            "sus sku", "y sus sku", "que sku", "los sku"])) {
    subFocus = "skus";
  } else if (_has(["sus clientes", "y sus clientes", "que clientes", "quienes la compran",
                   "quien la compra", "sus cuentas", "y sus cuentas", "que cuentas"])) {
    subFocus = "clientes";
  } else if (_has(["cuanto vende", "cuanto factura", "sus ventas", "y sus ventas",
                   "cuanto vendio", "cuanto facturo", "que vende", "sus numeros"])) {
    subFocus = "metrics";
  }

  if (!subFocus) return null;

  return {
    type: "family",
    familyName: context.lastFamilyMentioned,
    subFocus,
  };
}

export function detectFamilyInventoryQuery(text, context) {
  if (!FEATURE_FAMILY_INVENTORY) return null;
  const norm = normalizeText(text || "");
  // Sucursal presente (para el detalle SKU y para la señal de "skus en {bodega}").
  let bodega = null;
  for (const suc of SUCURSALES) { if (norm.includes(normalizeText(suc))) { bodega = suc; break; } }
  // Señal física de inventario: sustantivo de inventario, o "skus" + una bodega named.
  const invNoun = /\b(inventario|inventarios|stock|inmovilizad\w*|almacen\w*|bodegas?)\b/.test(norm);
  const skuWord = /\bskus?\b/.test(norm);
  const invSignal = invNoun || (skuWord && bodega);
  if (!invSignal) return null;
  // Familia específica (SUPERFAMILIAS + alias del Corte 1).
  const _famAliases = { "Electrodomésticos": ["electro"], "Materiales de Construcción": ["construccion", "materiales"] };
  let familyName = null;
  for (const fam of SUPERFAMILIAS.slice(1)) {
    const tokens = [normalizeText(fam), ...(_famAliases[fam] || [])];
    if (tokens.some(t => t && norm.includes(t))) { familyName = fam; break; }
  }
  // Ranking: "familias" (plural genérico) sin familia específica.
  const esRanking = !familyName && /\bfamilias\b/.test(norm);
  if (!familyName && !esRanking) return null;   // ni familia ni "familias" → no es este intent
  const inmovilizado = /\binmovilizad/.test(norm);
  return { type: "family_inventory", familyName: familyName || null, bodega: bodega || null, ranking: esRanking, inmovilizado };
}

export function detectAllFamiliesInText(text) {
  if (!text || typeof text !== "string") return [];
  const norm = normalizeText(text);
  const _famAliases = { "Electrodomésticos": ["electro"], "Materiales de Construcción": ["construccion", "materiales"] };
  const matches = [];
  for (const fam of SUPERFAMILIAS.slice(1)) {
    const tokens = [normalizeText(fam), ...(_famAliases[fam] || [])];
    let best = -1;
    for (const t of tokens) { if (!t) continue; const i = norm.indexOf(t); if (i >= 0 && (best < 0 || i < best)) best = i; }
    if (best >= 0) matches.push({ name: fam, index: best });
  }
  matches.sort((a, b) => a.index - b.index);
  return [...new Set(matches.map(m => m.name))];
}

export function detectAllWarehousesInText(text) {
  if (!text || typeof text !== "string") return [];
  const norm = normalizeText(text);
  const matches = [];
  for (const suc of SUCURSALES) {
    const i = norm.indexOf(normalizeText(suc));
    if (i >= 0) matches.push({ name: suc, index: i });
  }
  matches.sort((a, b) => a.index - b.index);
  return [...new Set(matches.map(m => m.name))];
}

export function detectFamilyComparison(text, context) {
  if (!FEATURE_ENTITY_COMPARISON || !text || typeof text !== "string") return null;
  const norm = normalizeText(text);
  const deicticPatterns = [
    /^comp(arar|ara|aralo|arala|aralas|aralos)\s+con\s+/,
    /^comp(arar|ara)\s+(a|contra)\s+/,
    /^(versus|vs\.?)\s+/,
  ];
  // FORMA 1 · deíctica · famA desde memoria (freshness · mismo patrón que C1).
  if (context && context.lastFamilyMentioned && context.lastFamilyMentionedTurn === context.turnCount) {
    if (deicticPatterns.some(p => p.test(norm))) {
      const fams = detectAllFamiliesInText(text);
      const famB = fams.find(f => f !== context.lastFamilyMentioned) || null;
      if (famB) return { type: "family_comparison", famA: context.lastFamilyMentioned, famB };
    }
  }
  // FORMA 2 · explícita · ≥2 familias.
  const explicitPatterns = [
    /\bcompar\w+\s+.+\s+(con|vs\.?|versus|contra|y)\s+/i,
    /\b.+\s+(vs\.?|versus)\s+.+/i,
  ];
  if (explicitPatterns.some(p => p.test(norm))) {
    const fams = detectAllFamiliesInText(text);
    if (fams.length >= 2 && fams[0] !== fams[1]) return { type: "family_comparison", famA: fams[0], famB: fams[1] };
  }
  return null;
}

export function detectWarehouseComparison(text, context) {
  if (!FEATURE_ENTITY_COMPARISON || !text || typeof text !== "string") return null;
  const norm = normalizeText(text);
  const deicticPatterns = [
    /^comp(arar|ara|aralo|arala|aralas|aralos)\s+con\s+/,
    /^comp(arar|ara)\s+(a|contra)\s+/,
    /^(versus|vs\.?)\s+/,
  ];
  if (context && context.lastWarehouseMentioned && context.lastWarehouseMentionedTurn === context.turnCount) {
    if (deicticPatterns.some(p => p.test(norm))) {
      const whs = detectAllWarehousesInText(text);
      const whB = whs.find(w => w !== context.lastWarehouseMentioned) || null;
      if (whB) return { type: "warehouse_comparison", whA: context.lastWarehouseMentioned, whB };
    }
  }
  const explicitPatterns = [
    /\bcompar\w+\s+.+\s+(con|vs\.?|versus|contra|y)\s+/i,
    /\b.+\s+(vs\.?|versus)\s+.+/i,
  ];
  if (explicitPatterns.some(p => p.test(norm))) {
    const whs = detectAllWarehousesInText(text);
    if (whs.length >= 2 && whs[0] !== whs[1]) return { type: "warehouse_comparison", whA: whs[0], whB: whs[1] };
  }
  // CORTE 9 · WS4 · forma INTERROGATIVA · "qué/cuál bodega está peor/mejor, A o B"
  // o "cuál tiene más/menos/mejor <métrica>, A o B" con ≥2 bodegas. Gateado por
  // FEATURE_INVENTORY_PREMIUM → con el flag OFF este detector es C6 byte-idéntico.
  if (FEATURE_INVENTORY_PREMIUM) {
    const interrogative = /\b(que|cual|cuales)\b/.test(norm) && /\b(peor|mejor|mejores|peores|mas|menos|mayor|menor|alto|alta|bajo|baja|critic\w*)\b/.test(norm) && /\b(,|\bo\b)/.test(norm);
    if (interrogative) {
      const whs = detectAllWarehousesInText(text);
      if (whs.length >= 2 && whs[0] !== whs[1]) return { type: "warehouse_comparison", whA: whs[0], whB: whs[1] };
    }
  }
  return null;
}

export function detectAllBrandsInText(text) {
  if (!FEATURE_BRAND_AS_ENTITY || !text || typeof text !== "string") return [];
  const norm = normalizeText(text);
  const matches = [];
  for (const b of MARCAS_ALL) {
    const m = norm.match(new RegExp(`\\b${normalizeText(b)}\\b(?!-)`, "i"));
    if (m) matches.push({ name: b, index: m.index });
  }
  matches.sort((a, b) => a.index - b.index);
  return [...new Set(matches.map(m => m.name))];
}

export function detectBrandComparison(text, context) {
  if (!FEATURE_BRAND_AS_ENTITY || !text || typeof text !== "string") return null;
  const norm = normalizeText(text);
  const deicticPatterns = [
    /^comp(arar|ara|aralo|arala|aralas|aralos)\s+con\s+/,
    /^comp(arar|ara)\s+(a|contra)\s+/,
    /^(versus|vs\.?)\s+/,
  ];
  if (context && context.lastBrandMentioned && context.lastBrandMentionedTurn === context.turnCount) {
    if (deicticPatterns.some(p => p.test(norm))) {
      const bs = detectAllBrandsInText(text);
      const brandB = bs.find(b => b !== context.lastBrandMentioned) || null;
      if (brandB) return { type: "brand_comparison", brandA: context.lastBrandMentioned, brandB };
    }
  }
  const explicitPatterns = [
    /\bcompar\w+\s+.+\s+(con|vs\.?|versus|contra|y)\s+/i,
    /\b.+\s+(vs\.?|versus)\s+.+/i,
  ];
  if (explicitPatterns.some(p => p.test(norm))) {
    const bs = detectAllBrandsInText(text);
    if (bs.length >= 2 && bs[0] !== bs[1]) return { type: "brand_comparison", brandA: bs[0], brandB: bs[1] };
  }
  return null;
}

export function detectBrandDive(text, context) {
  if (!FEATURE_BRAND_AS_ENTITY || !text || typeof text !== "string") return null;
  const brand = detectBrandInText(text);
  if (!brand) return null;
  // Precedencia: si hay un cliente nombrado, cliente gana (§9).
  if (detectClientInText(text)) return null;
  const norm = normalizeText(text);
  let subFocus = null;
  if (/\bmargen(es)?\b/.test(norm)) subFocus = "margen";
  else if (/\b(inventario|inventarios|stock|bodegas?|inmovilizad\w*)\b/.test(norm)) subFocus = "inventario";
  else if (/\bskus?\b/.test(norm)) subFocus = "skus";
  return { type: "brand_dive", brand, subFocus };
}

export function detectClientComparison(text, context) {
  if (!text || typeof text !== "string") return null;

  const normalized = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

  // ── FORMA 1 · DEÍCTICA · clientA viene de memoria conversacional
  // Patrones que asumen clientA implícito ("compáralo con X" = "lo" es clientA)
  // Requiere context.lastClientMentioned poblado
  const deicticPatterns = [
    /^comp(arar|ara|aralo|aralas|aralos)\s+con\s+/,    // "compáralo con X"
    /^comp(arar|ara)\s+(a|contra)\s+/,                   // "compara a X"
    /^(versus|vs\.?)\s+/,                                // "versus X" / "vs X"
  ];

  if (context && context.lastClientMentioned) {
    const matchesDeictic = deicticPatterns.some(p => p.test(normalized));
    if (matchesDeictic) {
      const clientB = detectClientInText(text);
      if (clientB && clientB !== context.lastClientMentioned) {
        return {
          clientA: context.lastClientMentioned,
          clientB,
        };
      }
    }
  }

  // ── FORMA 2 · EXPLÍCITA · ambos clientes en el texto
  // FASE 1.5.B-HOTFIX-3-PATCH · cobertura sintaxis natural humana
  // Caso real founder: "compara falabella con lider" · "Falabella vs Lider"
  // Patrones que asumen 2 clientes en el texto (no requieren memoria)
  const explicitPatterns = [
    /\bcompar\w+\s+\S+\s+(con|vs\.?|versus|contra|y)\s+/i,  // "compara A con/vs/y B"
    /\b\S+\s+(vs\.?|versus)\s+\S+/i,                         // "A vs/versus B"
  ];

  const matchesExplicit = explicitPatterns.some(p => p.test(normalized));
  if (matchesExplicit) {
    const clients = detectAllClientsInText(text);
    // Requiere al menos 2 clientes distintos en el texto
    if (clients.length >= 2 && clients[0] !== clients[1]) {
      return {
        clientA: clients[0],   // primer cliente en orden de aparición
        clientB: clients[1],   // segundo cliente en orden de aparición
      };
    }
  }

  return null;
}

export function detectVentasTotalGlobal(text, context) {
  if (typeof ADI_VENTAS_TOTAL_LEXICO_ENABLED === "undefined" || !ADI_VENTAS_TOTAL_LEXICO_ENABLED) return null;
  if (!text || typeof text !== "string") return null;
  // Guard de frontera: si hay lista de contexto activa → NO capturar (deja aggregation_sum_on_context).
  if ((context && context.lastClientList && context.lastClientList.length > 0) ||
      (context && context.lastSkuList && context.lastSkuList.length > 0)) return null;
  const t = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[¿¡?!.,;:]+/g, "").trim();
  // Guard léxico: si menciona "esos"/"ellos"/"estos" (referencia a lista) → NO capturar.
  if (/\b(esos|ellos|estos|estas|esas|ellas)\b/.test(t)) return null;
  if (_VENTAS_TOTAL_GLOBAL_PHRASES.includes(t)) {
    return { type: "module", modulo: "ventas", _ventasTotalGlobal: true };
  }
  return null;
}

export function _d1fResolveEntityName(s) {
  if (typeof s !== "string" || !s) return s;
  try {
    const e = (typeof getEntityById === "function") ? getEntityById(s) : null;
    if (e && typeof e.canonical_name === "string" && e.canonical_name) return e.canonical_name;
  } catch (err) { /* defensivo · read-only · nunca rompe el flujo */ }
  return s;
}

export function _normalizeSemanticText(text) {
  if (!text || typeof text !== "string") return "";
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export function _extractEntities(normalizedText) {
  if (!normalizedText) return [];
  const results = [];
  for (const [key, entity] of Object.entries(SEMANTIC_ENTITIES)) {
    for (const term of entity.vocabulary) {
      // word boundary para evitar matches parciales
      const re = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
      if (re.test(normalizedText)) {
        results.push({
          key,
          canonical_entityType: entity.canonical_entityType,
          matched_term: term,
        });
        break; // primer match por entity · no duplicar
      }
    }
  }
  return results;
}

export function _extractMetrics(normalizedText) {
  if (!normalizedText) return [];
  const results = [];
  for (const [key, metric] of Object.entries(SEMANTIC_METRICS)) {
    for (const term of metric.vocabulary) {
      const re = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
      if (re.test(normalizedText)) {
        results.push({
          key,
          field: metric.field,
          ranking_key: metric.ranking_key,
          domain: metric.domain,
          matched_term: term,
        });
        break; // primer match por metric · no duplicar
      }
    }
  }
  return results;
}

export function _extractQualifiers(normalizedText) {
  if (!normalizedText) return [];
  const results = [];
  for (const [key, qual] of Object.entries(SEMANTIC_QUALIFIERS)) {
    for (const term of qual.vocabulary) {
      const re = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
      if (re.test(normalizedText)) {
        results.push({
          key,
          direction: qual.direction || null,
          threshold: qual.threshold || null,
          state: qual.state || null,
          metric_inferred: qual.metric_inferred || null,
          driver_inferred: qual.driver_inferred || null,
          matched_term: term,
        });
        break;
      }
    }
  }
  return results;
}

export function _extractIntents(normalizedText) {
  if (!normalizedText) return [];
  const results = [];
  for (const [key, intent] of Object.entries(SEMANTIC_INTENTS)) {
    let matched = false;
    if (intent.vocabulary_starters) {
      for (const term of intent.vocabulary_starters) {
        // startsWith de inicio del texto · maneja "¿que" tras strip
        const stripped = normalizedText.replace(/^[¿¡?!.,;:\s]+/, "");
        if (stripped.startsWith(term + " ") || stripped === term) {
          matched = true;
          break;
        }
      }
    }
    if (!matched && intent.vocabulary_markers) {
      for (const term of intent.vocabulary_markers) {
        const re = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
        if (re.test(normalizedText)) {
          matched = true;
          break;
        }
      }
    }
    if (matched) {
      results.push({
        key,
        composer_hint: intent.composer_hint,
      });
    }
  }
  return results;
}

export function _resolveDirection(qualifiers) {
  if (!qualifiers || !qualifiers.length) return null;
  // Direction explícita
  const hasWorst = qualifiers.some(q => q.direction === "worst");
  const hasBest = qualifiers.some(q => q.direction === "best");
  if (hasWorst) return "worst";
  if (hasBest) return "best";
  // Threshold implícito
  const hasLow = qualifiers.some(q => q.threshold === "below_benchmark");
  const hasHigh = qualifiers.some(q => q.threshold === "above_benchmark");
  if (hasLow) return "worst";
  if (hasHigh) return "best";
  return null;
}

export function _associateQualifiersToMetrics(normalizedText, metrics, qualifiers) {
  if (!normalizedText || !metrics || metrics.length < 2 || !qualifiers || qualifiers.length < 2) {
    return null;
  }
  // Filtrar qualifiers que indican direccionalidad
  const directionals = qualifiers.filter(q =>
    q.direction === "worst" || q.direction === "best" ||
    q.threshold === "below_benchmark" || q.threshold === "above_benchmark"
  );
  if (directionals.length < 2) return null;

  // Clasificar low vs high entre los directionals
  const lowQuals = directionals.filter(q => q.direction === "worst" || q.threshold === "below_benchmark");
  const highQuals = directionals.filter(q => q.direction === "best" || q.threshold === "above_benchmark");
  if (lowQuals.length === 0 || highQuals.length === 0) return null; // necesitamos uno de cada

  // Tomar el primer match de cada · localizar indices en el texto normalizado
  const lowQ = lowQuals[0];
  const highQ = highQuals[0];
  const lowIdx = normalizedText.indexOf(lowQ.matched_term);
  const highIdx = normalizedText.indexOf(highQ.matched_term);
  if (lowIdx < 0 || highIdx < 0) return null;

  // Para cada metric · encontrar idx en texto y calcular distancia a cada qualifier
  const metricsWithIdx = metrics.slice(0, 2).map(m => ({
    metric: m,
    idx: normalizedText.indexOf(m.matched_term),
  }));
  // Asegurar todos tienen idx válido
  if (metricsWithIdx.some(m => m.idx < 0)) return null;

  // Asociar: cada qualifier al metric más cercano
  // Estrategia: distancia mínima · si empate · qualifier que aparece primero gana primero
  const distLowToM0 = Math.abs(metricsWithIdx[0].idx - lowIdx);
  const distLowToM1 = Math.abs(metricsWithIdx[1].idx - lowIdx);
  const distHighToM0 = Math.abs(metricsWithIdx[0].idx - highIdx);
  const distHighToM1 = Math.abs(metricsWithIdx[1].idx - highIdx);

  // Decisión por suma mínima · evita doble asignación a misma metric
  // Asignación A: low→M0 · high→M1 · costo = distLowToM0 + distHighToM1
  // Asignación B: low→M1 · high→M0 · costo = distLowToM1 + distHighToM0
  const costA = distLowToM0 + distHighToM1;
  const costB = distLowToM1 + distHighToM0;

  if (costA <= costB) {
    return {
      low_metric: metricsWithIdx[0].metric,
      high_metric: metricsWithIdx[1].metric,
    };
  } else {
    return {
      low_metric: metricsWithIdx[1].metric,
      high_metric: metricsWithIdx[0].metric,
    };
  }
}

export function _mapToComposer({ entity, metric, direction, qualifiers, metrics, association }) {
  // ── CASO 6 · cross-metric (cliente + 2 metrics + 2 qualifiers asociados) ──
  // Precedencia primero porque es más específico.
  if (
    entity && entity.canonical_entityType === "client" &&
    metrics && metrics.length >= 2 &&
    association && association.low_metric && association.high_metric
  ) {
    // Validar que ambas metrics tienen ranking_key (existen en RANKING_EXTREMES_METRICS)
    if (association.low_metric.ranking_key && association.high_metric.ranking_key) {
      return {
        type: "cross_metric_ranking",
        rankMetric: association.high_metric.ranking_key,
        rankDirection: "best",
        rankN: 3,
        sortMetric: association.low_metric.ranking_key,
        sortDirection: "worst",
        entityType: "client",
        _semantic_origin: true,
      };
    }
  }

  // ── CASO 4 · sku + trapped_state OR capital_inmovilizado ──
  if (
    entity && entity.canonical_entityType === "sku" &&
    (
      (metric && metric.field === "stockUSD") ||
      qualifiers.some(q => q.state === "trapped")
    )
  ) {
    return {
      type: "sku_operational",
      _semantic_origin: true,
    };
  }

  // ── CASO 3 · cliente + bleeding_state (driver_inferred=internal_commercial_load) ──
  // FIX_P_C_RUNTIME_RELOCATION · D-FIX-P.C-2 Opción 2c · mapea a MARGEN WORST
  // (NO carga best). Razón: INTERNAL_DRIVER_RULES["client.carga"] es stub ·
  // narrativa magistral M.B.1 vive en client.margen con driver internal_commercial_load
  // detectado por la rule client.margen · que ES la respuesta ejecutiva correcta
  // a "regalando puntos / comiendo margen" porque la causa raíz (carga comercial alta)
  // está dentro del driver de la narrativa Lider 21.5% firmada V_VISUAL.
  // Lección #L-CONSULTA-SEMANTICA-PUEDE-MAPEAR-A-METRICA-DISTINTA-VIA-DRIVER.
  if (
    entity && entity.canonical_entityType === "client" &&
    qualifiers.some(q => q.driver_inferred === "internal_commercial_load")
  ) {
    return {
      type: "ranking_extremes",
      direction: "worst",
      metric: "margen",
      entityType: "client",
      topN: 1,
      _semantic_origin: true,
    };
  }

  // ── CASO 1 · cliente + worst OR low_magnitude + metric con ranking_key ──
  if (
    entity && entity.canonical_entityType === "client" &&
    metric && metric.ranking_key &&
    (direction === "worst" || qualifiers.some(q => q.threshold === "below_benchmark"))
  ) {
    return {
      type: "ranking_extremes",
      direction: "worst",
      metric: metric.ranking_key,
      entityType: "client",
      topN: 1,
      _semantic_origin: true,
    };
  }

  // ── CASO 2 · cliente + best OR high_magnitude + metric con ranking_key ──
  if (
    entity && entity.canonical_entityType === "client" &&
    metric && metric.ranking_key &&
    (direction === "best" || qualifiers.some(q => q.threshold === "above_benchmark"))
  ) {
    return {
      type: "ranking_extremes",
      direction: "best",
      metric: metric.ranking_key,
      entityType: "client",
      topN: 1,
      _semantic_origin: true,
    };
  }

  // ── CASO 5 · sku + worst/low_magnitude + metric con ranking_key (rotacion · doh) ──
  if (
    entity && entity.canonical_entityType === "sku" &&
    metric && metric.ranking_key &&
    (direction === "worst" || qualifiers.some(q => q.threshold === "below_benchmark"))
  ) {
    return {
      type: "ranking_extremes",
      direction: "worst",
      metric: metric.ranking_key,
      entityType: "sku",
      topN: 1,
      _semantic_origin: true,
    };
  }

  // Sin match · ALPHA NO mapea · fallback honesto
  return null;
}

export function composeSemanticIntent(text, context) {
  // Guard básico
  if (!text || typeof text !== "string") return null;
  if (typeof VOICE_SEMANTIC_INTENT_LAYER_ENABLED !== "undefined" && !VOICE_SEMANTIC_INTENT_LAYER_ENABLED) {
    return null; // flag rollback · P.C declara la constante
  }

  // FASE 1 · normalizar + extraer componentes (helpers P.A)
  const normalized = _normalizeSemanticText(text);
  if (!normalized) return null;
  let entities = _extractEntities(normalized);
  let metrics = _extractMetrics(normalized);
  const qualifiers = _extractQualifiers(normalized);
  const intents = _extractIntents(normalized);

  // FASE 2 · inferencias semánticas (D-P.B-1 y D-P.B-2 firmadas)
  // Excepción documentada · NO regla general · qualifier infiere entity
  // SOLO cuando NO hay entity explícita en el texto.
  if (!entities.length) {
    if (qualifiers.some(q => q.state === "trapped")) {
      // D-P.B-1 · trapped_state sin entity → sku
      entities.push({
        key: "sku",
        canonical_entityType: "sku",
        matched_term: "(inferred)",
      });
    } else if (qualifiers.some(q => q.driver_inferred === "internal_commercial_load")) {
      // D-P.B-2 · bleeding_state sin entity → cliente
      entities.push({
        key: "cliente",
        canonical_entityType: "client",
        matched_term: "(inferred)",
      });
    } else if (
      // D-P.B-7 · Caso 6 cross-metric sin entity → cliente (runtime fix)
      // Trigger: ≥2 metrics + ≥2 qualifiers directionals (low + high)
      // Razón: cross_metric_ranking dispatch solo acepta entityType=client.
      // Queries naturales tipo "bajo margen pero alto volumen" sin "clientes".
      metrics.length >= 2 &&
      qualifiers.filter(q => q.direction === "worst" || q.threshold === "below_benchmark").length >= 1 &&
      qualifiers.filter(q => q.direction === "best" || q.threshold === "above_benchmark").length >= 1
    ) {
      entities.push({
        key: "cliente",
        canonical_entityType: "client",
        matched_term: "(inferred)",
      });
    }
  }
  // Inferencia de métrica desde qualifier si no hay explícita
  if (!metrics.length) {
    if (qualifiers.some(q => q.metric_inferred === "capital_inmovilizado")) {
      const inferredKey = "capital_inmovilizado";
      const inferredMetric = SEMANTIC_METRICS[inferredKey];
      if (inferredMetric) {
        metrics.push({
          key: inferredKey,
          field: inferredMetric.field,
          ranking_key: inferredMetric.ranking_key,
          domain: inferredMetric.domain,
          matched_term: "(inferred)",
        });
      }
    } else if (qualifiers.some(q => q.driver_inferred === "internal_commercial_load")) {
      const inferredKey = "carga_comercial";
      const inferredMetric = SEMANTIC_METRICS[inferredKey];
      if (inferredMetric) {
        metrics.push({
          key: inferredKey,
          field: inferredMetric.field,
          ranking_key: inferredMetric.ranking_key,
          domain: inferredMetric.domain,
          matched_term: "(inferred)",
        });
      }
    }
  }

  // FASE 3 · validar composición mínima
  if (!entities.length || !metrics.length) return null;

  // FASE 4 · resolver primarios + asociación cross-metric si aplica
  const primaryEntity = entities[0];
  const primaryMetric = metrics[0];
  const direction = _resolveDirection(qualifiers);
  // Asociación qualifier↔metric para Caso 6 · solo si hay 2 metrics y 2 qualifiers directionals
  const association = _associateQualifiersToMetrics(normalized, metrics, qualifiers);

  // FASE 5 · validar direccionalidad mínima (D-P.B-5)
  // Si NO hay direction explícita NI threshold NI state NI bleeding · null
  const hasDirectionality = direction !== null
    || qualifiers.some(q => q.state === "trapped")
    || qualifiers.some(q => q.driver_inferred === "internal_commercial_load")
    || _metricIsCapitalOnly(primaryMetric); // capital_inmovilizado implica trapped por dominio
  if (!hasDirectionality) return null;

  // FASE 6 · mapear a composer existente
  const intentShape = _mapToComposer({
    entity: primaryEntity,
    metric: primaryMetric,
    direction,
    qualifiers,
    metrics, // para Caso 6
    association, // para Caso 6
    intent: intents[0] || null,
  });

  return intentShape; // null si no mapeable · fallback honesto
}

export function _metricIsCapitalOnly(metric) {
  if (!metric || !metric.key) return false;
  return metric.key === "capital_inmovilizado";
}

export function _detectMetricInText(normalizedText, entityTypeHint) {
  const n = normalizedText;
  // Sinónimos canónicos → key del catálogo
  // Orden importa: revisar términos compuestos antes que simples.
  if (/\b(rotacion|rota|gira|veces\s+al\s+a[nñ]o)\b/.test(n)) return "rotacion";
  if (/\b(cobertura|dias\s+de\s+stock)\b/.test(n))             return "cobertura";
  if (/\b(doh|dias\s+de\s+oferta)\b/.test(n))                  return "doh";
  if (/\b(stock\s*usd|stock|capital\s+inmovilizado|capital\s+atrapado)\b/.test(n)) return "stockUSD";
  if (/\b(carga|rebate|carga\s+comercial)\b/.test(n))          return "carga";
  // Ambigüedad margen/contribucion · resolver por entityTypeHint
  if (/\b(margen|rentabilidad|margen\s+unitario)\b/.test(n)) {
    return entityTypeHint === "sku" ? "sku_margen" : "margen";
  }
  if (/\b(contribuci[oó]n|aporte|aportan|aporta)\b/.test(n)) {
    return entityTypeHint === "sku" ? "sku_contribucion" : "contribucion";
  }
  if (/\b(ventas|venta|facturaci[oó]n|facturan|factura)\b/.test(n)) return "ventas";
  return null;
}

export function detectExecutiveIntent(text) {
  if (!text || typeof text !== "string") return null;
  // Probar concern (más específico semánticamente)
  for (const p of EXECUTIVE_INTENT_PATTERNS.concern) {
    if (p.test(text)) return { type: "executive_intent", subtype: "concern" };
  }
  // Probar opportunity
  for (const p of EXECUTIVE_INTENT_PATTERNS.opportunity) {
    if (p.test(text)) return { type: "executive_intent", subtype: "opportunity" };
  }
  // Probar action (último · patterns más amplios)
  for (const p of EXECUTIVE_INTENT_PATTERNS.action) {
    if (p.test(text)) return { type: "executive_intent", subtype: "action" };
  }
  // ═══ D3.0-bis · hueco léxico de "medidas" (GD3-2 · única fuente · flag-gated) ═══
  // Extensión de la familia `action` (medidas/solucionar/qué hago son acción ejecutiva).
  // Agregada acá (no en el const array) para gatear por flag sin tocar la estructura sellada.
  // Anti-colisión verificada: cero solape con 16t ni rutas selladas (rankings/causa/cruce/overview).
  // off = inerte ("medidas" vuelve a fallback K · byte-idéntico D2.b).
  if (typeof VOICE_D30BIS_MEASURES_ENABLED !== "undefined" && VOICE_D30BIS_MEASURES_ENABLED) {
    for (const p of _D30BIS_MEASURES_PATTERNS) {
      if (p.test(text)) return { type: "executive_intent", subtype: "action" };
    }
  }
  return null;
}

export function detectExitPlanAction(text, context) {
  const t = text.toLowerCase();
  const matches = (
    t.includes("plan de salida") ||
    t.includes("plan de liquidacion") ||
    t.includes("plan de liquidación") ||
    t.includes("como lo liquido") ||
    t.includes("cómo lo liquido") ||
    t.includes("como liquido") ||
    t.includes("cómo liquido") ||
    t.includes("que hago con esto") ||
    t.includes("qué hago con esto") ||
    t.includes("que hago con este sku") ||
    t.includes("qué hago con este sku") ||
    t.includes("como saco este stock") ||
    t.includes("cómo saco este stock") ||
    t.includes("como me deshago") ||
    t.includes("cómo me deshago") ||
    t.includes("estrategia de salida") ||
    t.includes("salida del sku")
  );
  if (!matches) return null;

  // Resolver entidad desde memoria · necesitamos un SKU
  const sku = context?.lastSkuMentioned;
  if (!sku) return null;

  return {
    type: "exit_plan",
    payload: { sku },
  };
}

export function detectContinuePendingAction(text, context) {
  const t = text.toLowerCase().trim();
  const matches = (
    t.includes("y los otros") ||
    t.includes("sigamos con los demas") ||
    t.includes("sigamos con los demás") ||
    t.includes("sigamos con el resto") ||
    t.includes("y el resto") ||
    (t.includes("el resto") && t.length < 30) ||
    t.includes("los pendientes") ||
    t.includes("y los pendientes") ||
    t.includes("los demas") ||
    t.includes("los demás") ||
    t.includes("continuemos con los demas") ||
    t.includes("continuemos con los demás") ||
    (t.includes("sigamos") && t.length < 20) ||
    t.includes("que pasa con los otros") ||
    t.includes("qué pasa con los otros")
  );
  if (!matches) return null;

  // Necesitamos lista padre con elementos pendientes
  const hasSkuList = context?.lastSkuList?.length > 0;
  const hasClientList = context?.lastClientList?.length > 0;
  if (!hasSkuList && !hasClientList) return null;

  // Heurística de tipo: si hay ambas listas, prioridad por lastIntent
  // (que indica qué exploración estábamos haciendo).
  const lastIntent = context?.lastIntent || "";
  const intentSuggestsClient = lastIntent === "cross_domain_query"
                              || lastIntent === "client"
                              || lastIntent === "client_followup"
                              || lastIntent === "cross_domain_sku_to_client";
  const useClientList = hasClientList && (intentSuggestsClient || !hasSkuList);

  if (useClientList) {
    const seen = context.lastClientMentioned;
    const pending = context.lastClientList.filter(c => c !== seen);
    if (pending.length === 0) return null;
    return {
      type: "continue_pending",
      payload: {
        entityType: "client",
        entities: pending,
        sourceIntent: context.lastIntent || "mechanism_explore_erosion",
      },
    };
  } else {
    const seen = context.lastSkuMentioned;
    const pending = context.lastSkuList.filter(s => s !== seen);
    if (pending.length === 0) return null;
    return {
      type: "continue_pending",
      payload: {
        entityType: "sku",
        entities: pending,
        sourceIntent: context.lastIntent || "sku_operational",
      },
    };
  }
}

export function detectSkuToClientAction(text, context) {
  const t = text.toLowerCase();
  const matches = (
    t.includes("que clientes lo compran") ||
    t.includes("qué clientes lo compran") ||
    t.includes("quien lo compra") ||
    t.includes("quién lo compra") ||
    t.includes("donde se vende") ||
    t.includes("dónde se vende") ||
    t.includes("quien compra esto") ||
    t.includes("quién compra esto") ||
    t.includes("que clientes lo tienen") ||
    t.includes("qué clientes lo tienen") ||
    t.includes("en que cuentas pesa") ||
    t.includes("en qué cuentas pesa") ||
    t.includes("a quien le vendo") ||
    t.includes("a quién le vendo")
  );
  if (!matches) return null;

  const sku = context?.lastSkuMentioned;
  if (!sku) return null;

  return {
    type: "cross_domain_sku_to_client",
    payload: { skuName: sku },
  };
}

export function detectClientToSkuAction(text, context) {
  const t = text.toLowerCase();
  const matches = (
    t.includes("que le vendo") ||
    t.includes("qué le vendo") ||
    t.includes("que skus le pesan") ||
    t.includes("qué skus le pesan") ||
    t.includes("que productos explican") ||
    t.includes("qué productos explican") ||
    t.includes("que productos aportan") ||
    t.includes("qué productos aportan") ||
    t.includes("que productos pesan") ||
    t.includes("qué productos pesan") ||
    t.includes("que skus aportan") ||
    t.includes("qué skus aportan") ||
    t.includes("que productos vende") ||
    t.includes("qué productos vende") ||
    t.includes("que skus tiene") ||
    t.includes("qué skus tiene")
  );
  if (!matches) return null;

  const client = context?.lastClientMentioned;
  if (!client) return null;

  return {
    type: "cross_domain_client_to_sku",
    payload: { clientName: client },
  };
}

export function detectCompareOppositeAction(text, context) {
  const t = text.toLowerCase();
  const matches = (
    t.includes("comparar con los buenos") ||
    t.includes("y los virtuosos") ||
    t.includes("contra los mejores") ||
    t.includes("contra los virtuosos") ||
    t.includes("vs los virtuosos") ||
    t.includes("vs los buenos") ||
    t.includes("y los rotacionales") ||
    t.includes("contra los rotacionales") ||
    t.includes("los buenos del portafolio") ||
    t.includes("contra los que rotan") ||
    t.includes("mejores cuentas") ||
    t.includes("cuentas virtuosas") ||
    t.includes("skus virtuosos") ||
    t.includes("skus rotacionales") ||
    t.includes("comparar contra")
  );
  if (!matches) return null;

  // Determinar domain según contexto conversacional
  const lastIntent = context?.lastIntent || "";

  let domain, pattern;

  if (lastIntent.includes("client")
      || lastIntent === "cross_domain_query"
      || lastIntent === "mechanism_explore_erosion"
      || lastIntent === "mechanism_explore_quality"
      || (context?.lastClientMentioned && !context?.lastSkuMentioned)) {
    domain = "client";
    pattern = "virtuoso";
  } else if (lastIntent === "product_contribution") {
    domain = "sku";
    pattern = (t.includes("rotacional") || t.includes("rotan")) ? "rotacional" : "bottom_contrib";
  } else {
    // Default · si hay SKU en memoria, sku rotacional; si hay cliente, virtuoso
    domain = context?.lastSkuMentioned ? "sku" : "client";
    pattern = domain === "sku" ? "rotacional" : "virtuoso";
  }

  return {
    type: "compare_opposite",
    payload: { domain, pattern },
  };
}

export function detectSimulationAction(text, context) {
  const t = text.toLowerCase();

  // Sub-tipo 6.a · load_reduction · "bajo carga", "reducir rebate"
  // BRIEF #26-bis · patterns ampliados para frases naturales de
  // compensación/concesión/renegociación que también deben rutear a
  // simulation_load_reduction sobre el último cliente mencionado.
  const isLoadReduction = (
    // Patterns originales
    ((t.includes("baj") || t.includes("reduc"))
     && (t.includes("carga") || t.includes("rebate")))
    // BRIEF #26-bis · simulación de compensación/concesión
    || (t.includes("ofrezco algo a cambio") && t.includes("rebate"))
    || (t.includes("ofrecer algo a cambio") && t.includes("rebate"))
    || (t.includes("ofrezco algo") && t.includes("cambio"))
    || t.includes("que le puedo dar a cambio")
    || t.includes("qué le puedo dar a cambio")
    || t.includes("que le doy a cambio")
    || t.includes("qué le doy a cambio")
    || (t.includes("compensar") && (t.includes("rebate") || t.includes("carga")))
    || (t.includes("compenso") && (t.includes("rebate") || t.includes("carga")))
    || (t.includes("compensa") && (t.includes("rebate") || t.includes("carga")))
    || t.includes("si le compenso")
    || t.includes("si renegocio")
    || t.includes("renegociar el rebate")
    || t.includes("renegociar la carga")
    || t.includes("si le doy mas volumen")
    || t.includes("si le doy más volumen")
    || t.includes("a cambio de bajar")
    || t.includes("y si bajo")
  );

  if (isLoadReduction) {
    const client = context?.lastClientMentioned;
    if (!client) return null;
    return {
      type: "simulation_load_reduction",
      payload: { entity: client, targetCarga: 3.5 },
    };
  }

  // Sub-tipo 6.b · rotation · "rotara más", "cuánto libero si rota"
  if (t.includes("rotar") || t.includes("rotación") || t.includes("rotacion")) {
    if (t.includes("si ") || t.includes("cuanto libero") || t.includes("cuánto libero")
        || t.includes("que pasa si") || t.includes("qué pasa si")
        || t.includes("alcanza") || t.includes("alcanzara") || t.includes("alcanzará")) {
      const sku = context?.lastSkuMentioned;
      if (!sku) return null;
      return {
        type: "simulation_rotation",
        payload: { sku, targetRotation: 9 },
      };
    }
  }

  // Sub-tipo 6.c · benchmark · "iguala el benchmark de margen"
  if ((t.includes("igualo") || t.includes("igualar") || t.includes("alcanza"))
      && (t.includes("benchmark") || t.includes("margen"))) {
    const client = context?.lastClientMentioned;
    const sku = context?.lastSkuMentioned;
    if (!client && !sku) return null;
    return {
      type: "simulation_benchmark",
      payload: {
        entity: client || sku,
        entityType: client ? "client" : "sku",
        metric: "margen",
        target: 30.1,
      },
    };
  }

  // Sub-tipo 6.d · contribución · "cierro el gap", "subir contribución"
  if (t.includes("cierro el gap") || t.includes("cierra el gap")
      || t.includes("subir contribucion") || t.includes("subir contribución")) {
    const client = context?.lastClientMentioned;
    const sku = context?.lastSkuMentioned;
    if (!client && !sku) return null;
    return {
      type: "simulation_contribution",
      payload: {
        entity: client || sku,
        entityType: client ? "client" : "sku",
        gap: 8,
      },
    };
  }

  return null;
}

export function detectCrossModuleViewAction(text, context) {
  const t = text.toLowerCase().trim();

  // Detectar módulo target
  let targetModule = null;
  if (t.includes("en margenes") || t.includes("en márgenes")
      || t.includes("en margen") || t.includes("desde margenes")
      || t.includes("desde márgenes")) {
    targetModule = "margenes";
  } else if (t.includes("en ventas") || t.includes("desde ventas")) {
    targetModule = "ventas";
  } else if (t.includes("en inventario") || t.includes("desde inventario")) {
    targetModule = "inventario";
  }

  if (!targetModule) return null;

  // Detectar intención de "ver en otro módulo"
  const isViewAction = (
    t.startsWith("y en ")
    || t.startsWith("como se ve")
    || t.startsWith("cómo se ve")
    || t.startsWith("que pasa en")
    || t.startsWith("qué pasa en")
    || t.startsWith("ahora en ")
    || t.includes("ver en " + targetModule)
    || t.includes("vamos a " + targetModule)
  );

  if (!isViewAction) return null;

  // Resolver entidad desde memoria · prioridad cliente sobre SKU
  // (la vista cross-module es más típicamente sobre cuentas)
  const client = context?.lastClientMentioned;
  const sku = context?.lastSkuMentioned;

  if (!client && !sku) return null;

  const entity = client || sku;
  const entityType = client ? "client" : "sku";

  return {
    type: "cross_module_view",
    payload: { entity, entityType, targetModule },
  };
}

export function detectCognitiveAction(text, context) {
  return (
    detectExitPlanAction(text, context)
    || detectContinuePendingAction(text, context)
    || detectSkuToClientAction(text, context)
    || detectClientToSkuAction(text, context)
    || detectCompareOppositeAction(text, context)
    || detectSimulationAction(text, context)
    || detectCrossModuleViewAction(text, context)
    || null
  );
}

export function detectActiveInvestigation(text, context) {
  // Guard 1: debe haber investigation activa en context
  if (!context?.investigationDomain || !context?.investigationMetric) {
    return null;
  }
  if (!text) return null;

  // Normalizar + strip de signos iniciales (¿¡) para que startsWith funcione.
  // Patrón replicado de detectIntent (línea ~2893).
  const t = text.toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/^[¿¡?!.,;:\s]+/, "");

  // BRIEF #29-bis · Vocabulario semántico extendido de verbos de dimensión.
  // Cada raíz cubre singular Y plural · captura formas naturales del habla
  // ejecutiva ("qué SKU explican", "qué bodegas sostienen", etc.).
  // Boundary check con espacio o inicio/fin de string · evita falsos positivos
  // por substring dentro de otras palabras.
  const DIMENSION_VERBS = [
    "explica", "explican",
    "concentra", "concentran",
    "aporta", "aportan",
    "sostiene", "sostienen",
    "genera", "generan",
    "compone", "componen",
    "representa", "representan",
    "origina", "originan",
  ];
  const matchesDimensionVerb = DIMENSION_VERBS.some(v => {
    // Boundary: precedido por espacio O inicio · seguido por espacio,
    // fin de string, o puntuación común (¿!?.,;:). Cubre "explican?" al final.
    const pattern = new RegExp("(^|\\s)" + v + "(\\s|$|[?!.,;:])", "i");
    return pattern.test(t);
  });

  // Detectar pattern de DIMENSIÓN (la pregunta busca distribución, no entidad)
  const isDimensionQuery = (
    t.startsWith("en que ")
    || t.startsWith("en cual ")
    || (t.startsWith("que ") && matchesDimensionVerb)
    || t.startsWith("donde esta")
    || t.startsWith("dónde está")
    || t.includes("como se distribuye")
    || t.includes("cómo se distribuye")
    || t.includes("como se concentra")
    || t.includes("cómo se concentra")
    || matchesDimensionVerb  // BRIEF #29-bis · cualquier verbo de dimensión activa
  );

  if (!isDimensionQuery) return null;

  // Identificar la nueva dimensión solicitada por el usuario
  let newDimension = null;

  if (t.includes("bodega") || t.includes("sucursal") || t.includes("ciudad")) {
    newDimension = "bodega";
  } else if (
    t.includes("categoria") || t.includes("categoría")
    || t.includes("familia") || t.includes("linea") || t.includes("línea")
  ) {
    newDimension = "sfamilia";
  } else if (t.includes("sku") || t.includes("producto") || t.includes("productos")) {
    newDimension = "sku";
  } else if (t.includes("marca") || t.includes("brand")) {
    newDimension = "marca";
  } else if (t.includes("cliente") || t.includes("cuenta") || t.includes("cuentas")) {
    newDimension = "cliente";
  }

  if (!newDimension) return null;

  return {
    type: "contextual_drilldown",
    newDimension,
    investigationContext: {
      domain: context.investigationDomain,
      metric: context.investigationMetric,
      hypothesis: context.investigationHypothesis,
      lastIntent: context.investigationLastIntent,
      // BRIEF #27-bis · pass goal al composer (puede ser null si no fue poblado)
      goal: context.investigationGoal || null,
    },
  };
}

export function _brandRow(marca) { return marcasMargen.find(m => m.marca === marca) || null; }

export function _brandHasClientWorld(marca) {
  for (const c of clientesMargen) { if (c.marca === marca) return true; }
  return false;
}

export function _bFmt1(v) { return `$${(v / 1000).toFixed(1)}K`; }

export function _bFmt2(v) { return `$${(Math.round(v / 10) / 100).toFixed(2)}K`; }

export function _invLineageQuery(norm) {
  if (/\b(mundo-?cliente|mundo cliente|mundo-?fisico|mundo fisico)\b/.test(norm) && /\binventario\b/.test(norm)) return true;
  if (/\bpor que\b/.test(norm) && /\bmateriales\b/.test(norm) && /\b(makita|venta|inventario|cliente)\b/.test(norm)) return true;
  if (/\b(no coincide|no cuadra|no reconcilia|no calza|difiere)\b/.test(norm) && /\b(venta|inventario)\b/.test(norm)) return true;
  if (/\b(dato directo|directo o inferido|directo o derivado|que dato es directo)\b/.test(norm) && /\binventario\b/.test(norm)) return true;
  if (/\b(que no puedes calcular|que no podes calcular|no puedes calcular|que no sabes)\b/.test(norm) && /\binventario\b/.test(norm)) return true;
  return false;
}

export function _invLineageKind(norm) {
  if (/\b(mundo-?cliente|mundo cliente|mundo-?fisico|mundo fisico)\b/.test(norm)) return "world";
  if (/\bmakita\b/.test(norm) || (/\bmateriales\b/.test(norm) && /\bcliente\b/.test(norm))) return "makita";
  if (/\b(no coincide|no cuadra|no reconcilia|no calza|difiere)\b/.test(norm)) return "reconcile";
  if (/\b(dato directo|directo o inferido|directo o derivado|que dato es directo)\b/.test(norm)) return "direct_vs_derived";
  if (/\b(no puedes calcular|que no sabes|no podes calcular)\b/.test(norm)) return "limits";
  return "world";
}

export function _invPredictiveQuery(norm) {
  if (/\b(se quedara sin stock|sin stock el proximo|se agotara|se agota primero|quiebre de stock|stockout)\b/.test(norm)) return true;
  if (/\b(demanda futura|proximo mes|proxima semana|el proximo trimestre)\b/.test(norm) && /\b(stock|inventario|sku|skus|bodega)\b/.test(norm)) return true;
  if (/\belasticidad\b/.test(norm)) return true;
  if (/\bmix optimo\b/.test(norm) || (/\bmix\b/.test(norm) && /\b(optim\w*|reducir (el )?inventario)\b/.test(norm))) return true;
  if (/\b(liquidar|vender)\b/.test(norm) && /\b(todo el inventario|todo el stock|el inventario completo)\b/.test(norm)) return true;
  return false;
}

export function detectInventoryPremium(text, context) {
  if (!FEATURE_INVENTORY_PREMIUM || !text || typeof text !== "string") return null;
  const norm = normalizeText(text);

  if (_invLineageQuery(norm)) return { type: "inv_premium", mode: "lineage", lineageKind: _invLineageKind(norm) };
  if (_invPredictiveQuery(norm)) return { type: "inv_premium", mode: "predictive" };

  const whs = detectAllWarehousesInText(text);
  const wh = whs[0] || null;
  const brand = (FEATURE_BRAND_AS_ENTITY && typeof detectBrandInText === "function") ? detectBrandInText(text) : null;
  const fams = detectAllFamiliesInText(text);
  const fam = fams[0] || null;
  // Palabra de detalle de inventario (familias/SKUs/críticos/dominante).
  const detailKw = /\b(familias?|skus?|criticos?|domina|dominante|concentra|concentr\w*|alertas?)\b/.test(norm);
  const invSignal = /\b(inventario|inventarios|stock|stocks|inmovilizad\w*|bodega|bodegas|doh|rotacion)\b/.test(norm) || /\bskus?\b/.test(norm) || (wh && detailKw);
  if (!invSignal) return null;

  // WS2.6 · cruce explícito a comercial (declarado).
  if (/\b(impacta|impacto|afecta|afectan)\b/.test(norm) && /\b(margen|contribucion|rentabilidad)\b/.test(norm) && /\b(inventario|stock|inmovilizad\w*)\b/.test(norm)) {
    return { type: "inv_premium", mode: "cross_commercial" };
  }

  // WS3.8 · marca × bodega (fix #5) · gana sobre familia.
  if (brand && wh) return { type: "inv_premium", mode: "brand_warehouse", brand, warehouse: wh };

  // WS3.7 / WS3.9 · bodega + sub-foco.
  if (wh) {
    const wantsFamilias = /\bfamilias?\b/.test(norm);
    const wantsDominant = /\b(domina|dominante|concentra|concentr\w*|mayor stock|mas stock)\b/.test(norm);
    const wantsCriticos = /\bcriticos?\b/.test(norm) || /\balertas?\b/.test(norm);
    const wantsSkus = /\bskus?\b/.test(norm);
    const wantsImmob = /\b(capital inmovilizado|inmovilizad\w*)\b/.test(norm);
    if (fam && wantsSkus) return null;                       // familia×bodega→SKUs ya lo maneja C5
    if (wantsDominant) return { type: "inv_premium", mode: "warehouse_dominant", warehouse: wh };
    if (wantsFamilias) return { type: "inv_premium", mode: "warehouse_families", warehouse: wh };
    if (wantsCriticos) return { type: "inv_premium", mode: "warehouse_criticos", warehouse: wh };
    if (wantsImmob) return { type: "inv_premium", mode: "warehouse_immobilized", warehouse: wh };
    if (wantsSkus && !fam) return { type: "inv_premium", mode: "warehouse_skus", warehouse: wh };
    return null;                                             // bodega sola → C4 warehouse_dive
  }

  // WS1.4 · total global (sin entidad).
  if (!brand && !fam) {
    const immob = /\b(inmovilizad\w*|capital)\b/.test(norm);
    const isTotal = /\b(total|totales|global|globales)\b/.test(norm) || /\b(cuanto|cuanta)\b[\s\S]*\binventario\b/.test(norm) || /\binventario\b[\s\S]*\b(tengo|hay)\b/.test(norm);
    if (isTotal) return { type: "inv_premium", mode: immob ? "immobilized_total" : "total" };
  }
  return null;
}

export function detectExecutiveReportIntent(text) {
  if (!VOICE_EXECUTIVE_REPORT_COMPOSER_ENABLED) return null;
  if (!text || typeof text !== "string") return null;
  let matched = false;
  for (const p of EXECUTIVE_REPORT_PATTERNS) {
    if (p.test(text)) { matched = true; break; }
  }
  // FIX #D-PANORAMA-SYNONYMS · sinónimos coloquiales de panorama → el MISMO destino que "panorama".
  // Solo se evalúan si NO matcheó ya un pattern formal. Guard de módulo: si el texto menciona un módulo
  // (inventario/stock/ventas/margen/etc), NO es el panorama TRANSVERSAL ("la foto del inventario" → va
  // a módulo · bare-module) · dejamos que siga su ruta. Las frases coloquiales transversales no traen
  // módulo. Match normalizado (sin tildes) · frases (no "foto"/"todo" sueltos · firma cláusula 5).
  if (!matched && typeof ADI_PANORAMA_SYNONYMS_ENABLED !== "undefined" && ADI_PANORAMA_SYNONYMS_ENABLED) {
    const _norm = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const _hasModuleWord = /\b(inventario|stock|ventas|facturacion|margen|margenes|rentabilidad|sku|doh|rotacion|cobertura)\b/.test(_norm);
    if (!_hasModuleWord) {
      const _PANORAMA_SYNONYMS = [
        "dame la foto", "dame la foto general", "la foto del negocio",
        "muestrame la foto del negocio", "muestrame la foto",
        "como viene todo", "como va el negocio", "como viene la mano",
        "ponme al dia", "ponme al tanto",
        "que onda el negocio",
        "dame una mirada general", "una mirada general",
      ];
      for (const syn of _PANORAMA_SYNONYMS) {
        if (_norm.includes(syn)) { matched = true; break; }
      }
    }
  }
  if (!matched) return null;
  // Detectar áreas específicas mencionadas (opcional)
  const areas = [];
  if (/\b(venta|ventas|ingreso|crecimiento)\b/i.test(text)) areas.push("ventas");
  if (/\b(margen|m[aá]rgenes|carga\s+comercial|rebate)\b/i.test(text)) areas.push("margenes");
  if (/\b(inventario|stock|capital|sku|doh)\b/i.test(text)) areas.push("inventario");
  // Detección de subtype: "solamente" / "solo" + área = partial
  const isPartial = areas.length > 0 && areas.length < 3 &&
    /\b(solamente|s[oó]lo|enf[oó]cate|solo\s+en)\b/i.test(text);
  return {
    type: "executive_report",
    subtype: isPartial ? "partial" : "full",
    areas: areas.length > 0 ? areas : null,
  };
}

export function detectExecutiveReportV2Intent(text) {
  if (!VOICE_NARRATIVE_V2_ENABLED) return null;
  if (!text || typeof text !== "string") return null;
  // Patterns alineados con manifiesto (cubre Q.D V1 + extensiones V2)
  const V2_PATTERNS = [
    /\bresumen\s+ejecutivo\b/i,
    /\binforme\s+ejecutivo\b/i,
    /\bpanorama\s+del\s+negocio\b/i,
    /\bpanorama\s+ejecutivo\b/i,
    /\bc[oó]mo\s+est[aá]\s+el\s+negocio\b/i,
    /\bqu[eé]\s+hay\s+del\s+negocio\b/i,
    /\breporte\s+ejecutivo\b/i,
    /\breporte\s+gerencial\b/i,
  ];
  let matched = false;
  for (const p of V2_PATTERNS) {
    if (p.test(text)) { matched = true; break; }
  }
  if (!matched) return null;
  // Áreas opcionales (alineado V1 · permite partial)
  const areas = [];
  if (/\b(venta|ventas|ingreso|crecimiento)\b/i.test(text)) areas.push("ventas");
  if (/\b(margen|m[aá]rgenes|carga\s+comercial|rebate)\b/i.test(text)) areas.push("margenes");
  if (/\b(inventario|stock|capital|sku|doh)\b/i.test(text)) areas.push("inventario");
  const isPartial = areas.length > 0 && areas.length < 3 &&
    /\b(solamente|s[oó]lo|enf[oó]cate|solo\s+en)\b/i.test(text);
  return {
    type: "executive_report_v2",
    subtype: isPartial ? "partial" : "full",
    areas: areas.length > 0 ? areas : null,
  };
}

export function _normalizeAlias(text) {
  if (text == null) return "";
  return String(text)
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function _generateAliases(canonical_name) {
  if (typeof canonical_name !== "string" || canonical_name.length === 0) return [];
  const out = new Set();
  out.add(canonical_name);
  out.add(canonical_name.toLowerCase());
  const norm = _normalizeAlias(canonical_name);
  out.add(norm);
  // Trim sufijos legales (defensive · datasets actuales NO los tienen)
  const trimmed = norm.replace(/\s+(s\.a\.|ltda|sa|sociedad)$/i, "").trim();
  if (trimmed.length > 0 && trimmed !== norm) out.add(trimmed);
  // Multi-word: agregar palabras individuales si len > 1 word (ej "Mercado Libre" → ["mercado", "libre"])
  const words = norm.split(/\s+/);
  if (words.length > 1) {
    for (const w of words) {
      if (w.length >= 4) out.add(w);
    }
  }
  return Array.from(out);
}

export function _buildEntityId(kind, canonical_name) {
  if (typeof kind !== "string" || typeof canonical_name !== "string") return null;
  const norm = _normalizeAlias(canonical_name)
    .replace(/[^\w-]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return kind + "_" + norm;
}

export function getEntityById(id) {
  if (!VOICE_ENTITY_REGISTRY_ENABLED) return null;
  if (typeof id !== "string") return null;
  return EntityRegistry.entities[id] || null;
}

export function detectEllipticalSkuDrill(text, context) {
  if (typeof ADI_DRILL_ELIPTICO_SKU_ENABLED === "undefined" || !ADI_DRILL_ELIPTICO_SKU_ENABLED) return null;
  if (!text || !context) return null;

  const norm = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[¿?¡!.,;:]/g, "")
    .trim();

  // Forma elíptica CORTA de pedir SKUs · match EXACTO del texto completo (no substring · evita capturar
  // frases largas que ya rutean a otro lado · ej. "qué skus le pesan a Falabella" tiene su propio detector).
  const ELLIPTICAL_SKU_PHRASES = [
    "que sku", "que skus", "cuales sku", "cuales skus",
    "que producto", "que productos", "cuales productos",
    "y los sku", "y los skus", "y que skus", "y que sku",
    "y los productos", "y que productos",
  ];
  if (!ELLIPTICAL_SKU_PHRASES.includes(norm)) return null;

  // Contexto de navegación FRESCO: un cliente mencionado en el turno actual (recién navegado).
  // Sin esto → null (en frío no inventa drill · firma cláusula · test D).
  const cc = context;
  const _freshClient = !!cc.lastClientMentioned
    && cc.lastClientMentionedTurn === cc.turnCount;
  if (!_freshClient) return null;

  return {
    type: "client_to_sku_drill",
    clientName: cc.lastClientMentioned,
  };
}
