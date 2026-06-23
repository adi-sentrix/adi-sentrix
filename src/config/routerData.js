/* === config/routerData.js ===
 * Datos del router extraídos de 41cc33d8 · byte-idénticos (Fase 4b · aditivo). */

import { _buildEntityId, _generateAliases, _normalizeAlias } from "../adi/router.js";
import { clientesVentas, skuInventario } from "../data/demoData.js";
import { VOICE_ENTITY_REGISTRY_ENABLED } from "./voiceFlags.js";

export const KEYWORDS_DICTIONARY = {
  ventas: [
    "ventas", "venta", "facturacion", "ingresos", "ingreso",
    "volumen", "crecimiento", "performance comercial",
    "top 10 ventas", "mostrar ventas",
  ],
  margenes: [
    "margen", "margenes", "rentabilidad", "contribucion",
    "rebate", "rebates", "carga comercial", "descuento", "convenio",
  ],
  inventario: [
    "inventario", "stock", "cobertura", "capital",
    "capital en riesgo", "skus", "sku", "productos",
    "rotacion", "doh", "dias de cobertura",
  ],
};

export const AFFIRMATIVE_REPLIES = [
  "si", "sí", "ok", "dale", "vale", "cuentame", "cuéntame",
  "explicame", "explícame", "vamos", "ya", "claro", "porfavor",
  "por favor", "sigue", "continua", "continúa", "sí porfa",
];

export const DOMAIN_KEYWORDS = {
  margenes: [
    "margen", "margenes", "contribucion", "rentabilidad",
    "benchmark", "presion de margen", "calidad de margen",
    "contribuir", "destruyen valor", "valor",
  ],
  ventas: [
    "carga comercial", "rebate", "rebates", "acciones comerciales",
    "ventas", "crecimiento", "crecer", "participacion",
    "facturacion", "concentracion", "principales clientes",
    "top clientes", "top tres", "top 3",
  ],
  inventario: [
    "inventario", "stock", "capital inmovilizado", "rotacion",
    "skus", "sku", "antiguedad", "categorias inventario",
    "capital atrapado", "capital sin devolver", "doh",
    "dias en mano", "liquidez", "capital de trabajo",
  ],
};

export const CROSS_DOMAIN_EXECUTIVE_EXPRESSIONS = [
  { pattern: ["fuga de capital", "donde se va la plata", "donde estamos perdiendo plata", "donde se nos va", "perdiendo plata"],
    archetype: "fuga_distribuida",
    autoDomains: ["margenes", "ventas", "inventario"] },

  // BRIEF #15-bis · FIX B1 · priority_recommendation MOVIDO antes de calidad_crecimiento
  // para que preguntas combinadas ("dónde está el problema y qué intervenir primero")
  // disparen priority_recommendation (que pide priorización ejecutiva).
  { pattern: [
      // Patrones originales del BRIEF #14
      "si tuviera que intervenir",
      "una sola parte",
      "mayor impacto",
      "donde tendria mayor",
      "una sola palanca",
      "que priorizar",
      "donde concentrar",
      "donde enfocar este mes",

      // BRIEF #15-bis · expresiones ejecutivas naturales
      "donde esta el problema",
      "que deberia intervenir",
      "intervenir primero",
      "ganando menos",
      "ganando menos de lo que",
      "deberiamos estar mejor",
      "que hago primero",
      "por donde empiezo",
      "donde deberia enfocar",
      "que tendria mayor impacto",
      "donde duele mas",
      "que es lo mas urgente",
    ],
    archetype: "priority_recommendation",
    autoDomains: ["margenes", "ventas", "inventario"] },

  { pattern: [
      // Patrones originales
      "crecen ventas pero",
      "destruyen valor",
      "destruyendo valor",
      "ventas crecen pero contribucion",
      "crecer pero no contribuir",
      "calidad del crecimiento",
      "crecimiento sin rentabilidad",
      "contribucion no esta creciendo",
      "contribucion no crece",
      "ventas estan creciendo, por que la contribucion",
      "ventas crecen al mismo ritmo",
      "contribucion al mismo ritmo",

      // BRIEF #15-bis · FIX B1 · expresiones ejecutivas naturales
      "crecemos pero ganamos menos",
      "crecemos pero no ganamos",
      "ganando menos de lo que deberiamos",
      "el negocio crece pero",
      "el negocio esta creciendo, pero",
      "ganamos menos de lo que deberiamos",
      "estamos creciendo pero ganamos",
      "creciendo pero ganamos menos",
      "ventas suben pero ganancia",
      "ventas suben pero ganancias",
      "facturacion crece pero rentabilidad",
      "el margen no acompana",
    ],
    archetype: "calidad_crecimiento",
    autoDomains: ["ventas", "margenes"] },

  { pattern: ["si pierdo a mis", "si pierdo tres principales", "expuesto queda",
              "que tan critico", "que tan expuesto", "top tres clientes"],
    archetype: "exposure_analysis",
    autoDomains: ["ventas", "margenes"] },

  { pattern: ["consumiendo capital", "consume capital sin devolver",
              "capital atrapado", "donde se traba el capital",
              "sin devolver rentabilidad"],
    archetype: "trapped_capital",
    autoDomains: ["inventario", "margenes"] },

  // BRIEF #15 · Mechanism-first queries
  { pattern: ["donde hay erosion comercial", "donde esta la erosion comercial",
              "casos de erosion comercial", "mostrame erosion comercial"],
    archetype: "mechanism_commercial_erosion",
    autoDomains: ["margenes", "ventas"] },

  { pattern: ["donde hay calidad de crecimiento", "deterioro de calidad de crecimiento",
              "cuentas que crecen pero destruyen", "casos de crecimiento de baja calidad",
              "donde hay deterioro de calidad"],
    archetype: "mechanism_quality_growth",
    autoDomains: ["ventas", "margenes"] },

  { pattern: ["donde hay dependencia", "riesgo de dependencia",
              "cuentas con mayor dependencia", "concentracion de clientes",
              "donde esta la dependencia"],
    archetype: "mechanism_dependency_risk",
    autoDomains: ["ventas", "margenes"] },

  { pattern: ["que mecanismos estan activos", "mecanismos activos en la cartera",
              "que mecanismos detectaste", "estado de los mecanismos",
              "que mecanismos hay activos"],
    archetype: "mechanism_scan",
    autoDomains: ["margenes", "ventas", "inventario"] },

  { pattern: ["cual es el mecanismo mas caro", "mecanismo de mayor costo",
              "que mecanismo cuesta mas", "ranking de mecanismos",
              "cual mecanismo prioriza"],
    archetype: "mechanism_ranking",
    autoDomains: ["margenes", "ventas", "inventario"] },
];

export const RANKING_INTENT_PATTERNS = [
  "cuales son", "cuales clientes", "cuales cuentas",
  "top", "los que tienen", "ranking", "rankeame",
  "los mas", "las mas", "mayor", "menor", "principales",
];

export const CLIENT_NAMES = [
  "Falabella", "Lider", "Jumbo", "Sodimac", "Tottus", "Paris",
  "Mercado Libre", "Ripley", "Easy", "La Polar", "Hites",
  "ABC", "Unimarc"
];

export const _DEICTIC_PLURAL_DEMONSTRATIVE = /\b(esos|estos|aquellos|esas|estas|aquellas)\b/i;

export const _DEICTIC_QUANTIFIED = /\b(?:esos|estos|aquellos|esas|estas|aquellas|los|las)\s+(\d+|primer[oa]s?|[uú]ltim[oa]s?|anteriores)(?:\s+(\d+))?\b/i;

export const _DEICTIC_SKU_HINT = /\b(sku|skus|producto|productos|item|items)\b/i;

export const _DEICTIC_CLIENT_HINT = /\b(cliente|clientes|cuenta|cuentas)\b/i;

export const _VENTAS_TOTAL_GLOBAL_PHRASES = [
  "cuanto vendi en total", "cuanto vendi", "cuanto vendimos en total", "cuanto vendimos",
  "cuanto facture en total", "cuanto facture", "cuanto facturamos en total", "cuanto facturamos",
  "cuanto vende la empresa", "cuanto vendio la empresa", "cuanto factura la empresa",
  "total de ventas", "el total de ventas", "la venta total", "venta total del negocio",
  "cuanto fue la venta total", "cual es la venta total", "cuanto facturo la empresa",
];

export const SEMANTIC_ENTITIES = {
  cliente: {
    vocabulary: [
      "cliente", "clientes", "cuenta", "cuentas",
      "comprador", "compradores", "buyer", "buyers",
      "retailer", "retailers", "canal", "canales",
      "distribuidor", "distribuidores",
    ],
    canonical_entityType: "client", // alineado con RANKING_EXTREMES_METRICS
  },
  sku: {
    vocabulary: [
      "sku", "skus", "producto", "productos",
      "item", "items", "articulo", "articulos",
      "modelo", "modelos", "referencia", "referencias",
      "codigo", "codigos", "material", "materiales",
      "unidad", "unidades",
    ],
    canonical_entityType: "sku",
  },
  marca: {
    vocabulary: [
      "marca", "marcas", "brand", "brands",
      "fabricante", "fabricantes",
    ],
    canonical_entityType: null, // D-P-4 · NO mapea · fallback honesto
  },
  familia: {
    vocabulary: [
      "familia", "familias", "categoria", "categorias",
      "linea", "lineas", "grupo", "grupos",
      "rubro", "rubros", "segmento", "segmentos",
      "portfolio", "portafolio",
    ],
    canonical_entityType: null, // D-P-4 · NO mapea · fallback honesto
  },
};

export const SEMANTIC_METRICS = {
  margen: {
    vocabulary: [
      "margen", "margenes", "rentabilidad",
      "margin", "profit", "pct margen",
      "puntos de margen", "%margen",
    ],
    field: "margen",
    ranking_key: "margen",
    domain: "margenes",
  },
  contribucion: {
    vocabulary: [
      "contribucion", "contribución", "contribute",
      "aporte", "aporta", "rinden", "rinde",
      "valor economico", "valor económico",
    ],
    field: "contribucion",
    ranking_key: "contribucion",
    domain: "margenes",
  },
  ventas: {
    vocabulary: [
      "ventas", "venta", "sales", "facturacion",
      "facturación", "volumen", "volumen de ventas",
    ],
    field: "venta",
    ranking_key: "ventas",
    domain: "ventas",
  },
  carga_comercial: {
    vocabulary: [
      "carga comercial", "carga", "rebate",
      "descuento", "descuentos", "incentivo",
      "incentivos", "pct rebate", "% descuento",
    ],
    field: "pctRebate",
    ranking_key: "carga",
    domain: "margenes",
  },
  rotacion: {
    vocabulary: [
      "rotacion", "rotación", "turnover",
      "movimiento", "se mueve", "ventas por dia",
    ],
    field: "rotacion",
    ranking_key: "rotacion",
    domain: "inventario",
  },
  doh: {
    vocabulary: [
      "doh", "dias de stock", "días de stock",
      "days on hand", "dias sin venta", "días sin venta",
      "antigüedad", "antiguedad",
    ],
    field: "doh",
    ranking_key: "doh",
    domain: "inventario",
  },
  capital_inmovilizado: {
    vocabulary: [
      "capital", "capital atrapado", "capital muerto",
      "capital inmovilizado", "capital detenido",
      "capital amarrado", "capital varado",
      "plata atrapada", "plata muerta", "plata dormida",
      "dinero atrapado", "dinero muerto",
      "stock muerto", "stock dormido", "stock parado",
    ],
    field: "stockUSD",
    ranking_key: "stockUSD",
    domain: "inventario",
  },
};

export const SEMANTIC_QUALIFIERS = {
  worst: {
    vocabulary: [
      "peor", "peores", "mal", "malo", "malos",
      "mas bajo", "mas baja", "mas bajos", "mas bajas",
      "minimo", "ultimo", "ultimos", "fondo", "abajo",
      // VOZ2 · honest-fail routing · "más problemático" = dirección worst
      "problematico", "problematica", "problematicos", "problematicas",
    ],
    direction: "worst",
  },
  best: {
    vocabulary: [
      "mejor", "mejores", "bueno", "buenos",
      "mas alto", "mas alta", "mas altos", "mas altas",
      "maximo", "primero", "primeros", "tope", "arriba",
    ],
    direction: "best",
  },
  low_magnitude: {
    vocabulary: [
      "bajo", "baja", "bajos", "bajas",
      "poco", "poca", "pocos", "pocas",
      "escaso", "escasos", "insuficiente",
      "limitado", "reducido", "comprimido", "comprimida",
    ],
    threshold: "below_benchmark",
  },
  high_magnitude: {
    vocabulary: [
      "alto", "alta", "altos", "altas",
      "mucho", "mucha", "muchos", "muchas",
      "sobrado", "elevado", "excesivo",
      "fuerte", "grande", "grandes",
    ],
    threshold: "above_benchmark",
  },
  trapped_state: {
    vocabulary: [
      "atrapado", "atrapados", "atrapada", "atrapadas",
      "atrapan", "atrapando", "atrapa",
      "detenido", "detenidos", "detenida", "detenidas",
      "inmovilizado", "inmovilizados",
      "muerto", "muertos", "muerta", "muertas",
      "dormido", "dormidos", "parado", "parados",
      "estancado", "estancados", "varado", "varados",
      "amarrado", "amarrados",
    ],
    state: "trapped",
    metric_inferred: "capital_inmovilizado",
  },
  bleeding_state: {
    vocabulary: [
      "comiendo", "come", "comen",
      "drenando", "drena", "drenan",
      "regalando", "regala", "regalan",
      "perdiendo", "pierde", "pierden",
      "fugando", "fuga", "fugan",
      "erosionando", "erosiona", "erosionan",
    ],
    state: "bleeding",
    driver_inferred: "internal_commercial_load",
  },
};

export const SEMANTIC_INTENTS = {
  diagnosis_query: {
    vocabulary_starters: [
      "que", "qué", "cual", "cuál", "cuales", "cuáles",
      "quien", "quién", "quienes", "quiénes",
      "donde", "dónde", "como", "cómo",
    ],
    composer_hint: "ranking_extremes_or_deep_dive",
  },
  cause_query: {
    vocabulary_markers: [
      "por que", "por qué", "que causa", "qué causa",
      "que genera", "qué genera", "que explica", "qué explica",
      "cual es la causa", "cuál es la causa",
      // ═══ D1.b · extensión D-D1-3 firmada (única fuente léxica · primer consumidor
      // real: detectCausalFollowUp · _mapToComposer sigue ignorando intents → inerte
      // fuera de D1 · verificado I4) ═══
      "a que se debe", "a qué se debe",
      "que lo explica", "qué lo explica", "que la explica", "qué la explica",
      "que los explica", "qué los explica", "que las explica", "qué las explica",
      // ═══ D3.a · §1.2 · variantes de "porqué" (UNA palabra · ancladas a "el" para
      // NO colisionar con "porque" conjunción · el canónico dice "el porqué de eso") ═══
      "el porque", "el porque de eso",
    ],
    composer_hint: "mechanism_scan",
  },
  decision_query: {
    vocabulary_markers: [
      "que hago", "qué hago", "como resuelvo", "cómo resuelvo",
      "plan de", "estrategia de", "que medidas", "qué medidas",
      "como lo arreglo", "cómo lo arreglo",
    ],
    composer_hint: "exit_plan_or_action",
  },
  comparison_query: {
    vocabulary_markers: [
      "vs", "versus", "contra", "respecto a",
      "comparado con", "frente a",
    ],
    composer_hint: "cross_metric_ranking",
  },
};

export const _D30BIS_MEASURES_PATTERNS = [
  /\bmedidas?\b/i,                                                  // "dame medidas", "qué medidas"
  /\b(soluci[oó]n(ar|arlo|arla|es)?|c[oó]mo\s+(lo\s+|la\s+)?soluciono)\b/i, // "solucionar", "cómo lo soluciono"
  /\bqu[eé]\s+hago\b/i,                                             // "qué hago" (sin requerir "primero")
];

export const EXECUTIVE_INTENT_PATTERNS = {
  action: [
    /\b(si\s+fueras|qu[eé]\s+har[ií]as|qu[eé]\s+har[ií]a\s+yo|c[oó]mo\s+atacar|por\s+d[oó]nde\s+empi?ez)/i,
    /\b(priorizo|prioriz(ar|ar[ií]a)|prioridad\s+ahora|este\s+mes|esta\s+semana)/i,
    // RUTEO · familia estricta de priorización (cada patrón anclado · separados para legibilidad/seguridad)
    /\bqu[eé]\s+(deber[ií]a|tengo\s+que)\s+hacer\s+primero\b/i,
    /\bqu[eé]\s+hago\s+primero\b/i,
    /\bqu[eé]\s+hacer\s+primero\b/i,
    /\b(dame\s+una\s+recomendaci[oó]n|qu[eé]\s+(me\s+)?recom(i?e)nd(ar[ií]as|as|aci[oó]n))/i,
    /\blo\s+m[aá]s\s+(importante|urgente)\b/i,
  ],
  opportunity: [
    /\b(qu[eé]\s+(no\s+veo|me\s+pierdo|estoy\s+ignorando|oportunidad)|qu[eé]\s+falta)/i,
    /\b(angulo\s+ciego|ciego|no\s+veo)/i,
  ],
  concern: [
    /\b(qu[eé]\s+me\s+preocupar[ií]a|qu[eé]\s+miedo|qu[eé]\s+riesgos?|si\s+fuera\s+mi\s+empresa)/i,
    /\b(qu[eé]\s+podr[ií]a\s+salir\s+mal|qu[eé]\s+vigilar)/i,
  ],
};

export const EXECUTIVE_REPORT_PATTERNS = [
  // Group 1 · keywords formales reporte
  /\b(resumen\s+ejecutivo|reporte\s+ejecutivo|reporte\s+mensual|an[aá]lisis\s+ejecutivo)\b/i,
  // Group 2 · panorama integral
  /\b(panorama|c[oó]mo\s+est[aá]\s+el\s+negocio|c[oó]mo\s+est[aá]\s+mi\s+negocio)\b/i,
  // Group 3 · queries gerenciales (alcance total)
  /\b(qu[eé]\s+tengo\s+que\s+mirar|qu[eé]\s+pasa\s+con\s+mi\s+negocio)\b/i,
  // Group 4 · inclusivas
  /\b(dame\s+todo\s+lo\s+que\s+ves|hazme\s+un\s+resumen|dame\s+un\s+resumen)\b/i,
];

export const _storage = (function _detectStorage() {
  // Caso A · Artifact Claude.ai · window.storage proprietary API
  if (typeof window !== "undefined" && window.storage && typeof window.storage.get === "function") {
    return {
      mode: "window_storage",
      is_persistent: true,
      get: async function (key) {
        try { const r = await window.storage.get(key); return r ? r.value : null; }
        catch (e) { return null; }
      },
      set: async function (key, value) {
        try { await window.storage.set(key, value); return true; }
        catch (e) { return false; }
      },
      list: async function (prefix) {
        try { const r = await window.storage.list(prefix); return r ? r.keys : []; }
        catch (e) { return []; }
      },
      del: async function (key) {
        try { await window.storage.delete(key); return true; }
        catch (e) { return false; }
      },
    };
  }
  // Caso B · build local · localStorage estándar (sync · wrap en async)
  if (typeof localStorage !== "undefined") {
    return {
      mode: "local_storage",
      is_persistent: true,
      get: async function (key) {
        try { return localStorage.getItem(key); }
        catch (e) { return null; }
      },
      set: async function (key, value) {
        try {
          const v = typeof value === "string" ? value : JSON.stringify(value);
          localStorage.setItem(key, v); return true;
        } catch (e) { return false; }
      },
      list: async function (prefix) {
        try { return Object.keys(localStorage).filter(k => k.startsWith(prefix || "")); }
        catch (e) { return []; }
      },
      del: async function (key) {
        try { localStorage.removeItem(key); return true; }
        catch (e) { return false; }
      },
    };
  }
  // Caso C · fallback in-memory degradado · session-only
  const _mem = {};
  return {
    mode: "in_memory",
    is_persistent: false,
    get: async function (key) { return _mem[key] != null ? _mem[key] : null; },
    set: async function (key, value) { _mem[key] = value; return true; },
    list: async function (prefix) { return Object.keys(_mem).filter(k => k.startsWith(prefix || "")); },
    del: async function (key) { delete _mem[key]; return true; },
  };
})();

export const EntityRegistry = (function _initEntityRegistry() {
  if (!VOICE_ENTITY_REGISTRY_ENABLED) {
    return { entities: {}, index: { by_canonical_name: {}, by_alias: {}, by_kind: {} }, meta: { storage_mode: _storage.mode, is_persistent: _storage.is_persistent } };
  }
  // Defensive · datasets pueden no estar definidos en harness · graceful empty
  const _clientes = (typeof clientesVentas !== "undefined" && Array.isArray(clientesVentas)) ? clientesVentas : [];
  const _skus = (typeof skuInventario !== "undefined" && Array.isArray(skuInventario)) ? skuInventario : [];
  const entities = {};
  const idx_canonical = {};
  const idx_alias = {};
  const idx_kind = { client: [], sku: [], brand: [], product_family: [], channel: [] };
  const _now = "2026-05-26T00:00:00Z"; // determinístico (NO Date.now · evita fuga determinismo)
  // Helper · registrar entidad
  function _addEntity(kind, canonical_name, metadata) {
    if (!canonical_name || !kind) return;
    const id = _buildEntityId(kind, canonical_name);
    if (!id || entities[id]) return; // idempotente
    const aliases = _generateAliases(canonical_name);
    entities[id] = {
      id,
      kind,
      canonical_name,
      aliases,
      created_at: _now,
      last_seen: _now,
      metadata: metadata || {},
    };
    idx_canonical[canonical_name] = id;
    for (const a of aliases) {
      const norm = _normalizeAlias(a);
      if (norm.length > 0 && !idx_alias[norm]) idx_alias[norm] = id;
    }
    if (idx_kind[kind]) idx_kind[kind].push(id);
  }
  // ── Inicialización runtime · 5 kinds ──
  // 1 · client (13 entidades · desde clientesVentas)
  const _seen_clients = new Set();
  for (const c of _clientes) {
    if (!c || !c.nombre || _seen_clients.has(c.nombre)) continue;
    _seen_clients.add(c.nombre);
    _addEntity("client", c.nombre, {
      tier: null,
      industry: null,
      canal: c.canal || null,
      sfamilia: c.sfamilia || null,
      marca: c.marca || null,
    });
  }
  // 2 · sku (13 entidades · desde skuInventario)
  const _seen_skus = new Set();
  for (const s of _skus) {
    if (!s || !s.sku || _seen_skus.has(s.sku)) continue;
    _seen_skus.add(s.sku);
    _addEntity("sku", s.sku, {
      marca: s.marca || null,
      sfamilia: s.sfamilia || null,
      bodega: s.bodega || null,
    });
  }
  // 3 · brand (5 entidades · marcas únicas client + sku)
  const _seen_brands = new Set();
  for (const c of _clientes) { if (c && c.marca) _seen_brands.add(c.marca); }
  for (const s of _skus)     { if (s && s.marca) _seen_brands.add(s.marca); }
  for (const brand of _seen_brands) _addEntity("brand", brand, {});
  // 4 · product_family (4 entidades · sfamilia únicas)
  const _seen_sfam = new Set();
  for (const c of _clientes) { if (c && c.sfamilia) _seen_sfam.add(c.sfamilia); }
  for (const s of _skus)     { if (s && s.sfamilia) _seen_sfam.add(s.sfamilia); }
  for (const sfam of _seen_sfam) _addEntity("product_family", sfam, {});
  // 5 · channel (2 entidades · Retail + E-commerce)
  const _seen_ch = new Set();
  for (const c of _clientes) { if (c && c.canal) _seen_ch.add(c.canal); }
  for (const ch of _seen_ch) _addEntity("channel", ch, {});
  return {
    schema_version: "S.A.v1",
    initialized_at: _now,
    entities,
    index: {
      by_canonical_name: idx_canonical,
      by_alias: idx_alias,
      by_kind: idx_kind,
    },
    meta: {
      storage_mode: _storage.mode,
      is_persistent: _storage.is_persistent,
      total_entities: Object.keys(entities).length,
    },
  };
})();
