/* === src/config/flagProfile.js · ADI Core · PERFILES DE EJECUCIÓN ===
 * El PISO (floor) protege el MOTOR: todos los flags de feature en OFF → gates byte-exactos contra el oráculo.
 * El piso NO es la experiencia de cliente. Los perfiles resuelven QUÉ features se prenden, POR ENV, sin editar
 * voiceFlags.js a mano (adiós flag-dance).
 *
 *   floor · gates / oráculo            → ninguna feature (byte-exacto)
 *   demo  · demo privada               → features ON (Sentrix · evidencia · boleta · diagnóstico) · escenarios OFF · suffix OFF
 *   prod  · producción                 → = demo, SIN dev-tools ni experimental
 *   dev   · trabajo interno            → features + experimental + dev-tools (selector de escenarios, etc.)
 *
 * Se resuelve por VITE_ADI_PROFILE → Vite lo hornea como el global `__ADI_PROFILE__` (ver vite.config.js).
 * Bajo Node (gates/oráculo/esbuild) el global NO existe → `typeof` cae a "undefined" → perfil `floor` → byte-exacto.
 * (El on/off y la KEY del LLM van por SU propio env: VITE_ADI_LLM_ENABLED / OPENAI_API_KEY · ortogonal al perfil.)
 *
 * Suffix proactivo "Mercado Libre": gateado por `!ADI_QI_FILTER_ENABLED` en _finalize → con QI_FILTER en FEATURE
 * (ON en demo/prod/dev) el suffix queda OFF automáticamente. Solo el piso (QI OFF) lo muestra (byte-exacto).
 */

// FEATURES · validadas flag-por-flag · byte-exactas cuando OFF (piso intacto) · ON en demo/prod/dev
const FEATURE = [
  // ADI Core · Fase 1+2 · 2.1 (spine) · 2.2 (multi-turno)
  "ADI_QI_FILTER_ENABLED",
  "ADI_CORE_SPINE_ENABLED", "ADI_SPINE_DIM_SUPERLATIVE_ENABLED", "ADI_SPINE_FILTER_ENABLED",
  "ADI_SPINE_FILTER_CLARIFY_ENABLED", "ADI_SPINE_EVIDENCE_ENABLED", "ADI_SPINE_COMBINED_ENABLED",
  "ADI_MT_SAFETY_ENABLED", "ADI_MT_INV_COVERAGE_ENABLED", "ADI_MT_TOPIC_CLEAN_ENABLED",
  "ADI_MT_SPINE_FOLLOWUP_ENABLED", "ADI_MT_REFINE_METRIC_ENABLED", "ADI_MT_REFINE_FILTER_ENABLED",
  "ADI_MT_BRAND_INV_COVERAGE_ENABLED", "ADI_MT_REFINE_CUT_ENABLED",
  // Inventario (rotación/DOH/capital/inmovilizado/bodega) + vocabulario
  "ADI_INV_ROTACION_ENABLED", "ADI_INV_DOH_ENABLED", "ADI_INV_CAPITAL_ENABLED",
  "ADI_INV_INMOVILIZADO_ENABLED", "ADI_INV_BODEGA_ENABLED", "ADI_INV_NL_VOCAB_ENABLED",
  // Ruteo / clasificación / guías
  "ADI_RANKING_NL_DIRECTION_ENABLED", "ADI_CLASSIFY_SKU_COMMERCIAL_ENABLED", "ADI_CUADRO_OVERVIEW_ENABLED",
  "ADI_MECHANISM_SCAN_ENABLED", "ADI_SKU_SCENARIO_GUARD_ENABLED", "ADI_RANKING_DEFAULT_METRIC_ENABLED",
  "ADI_SMART_GUIDE_ENABLED", "ADI_SIM_SCOPE_FOLLOWUP_ENABLED", "ADI_HONESTY_GUARD_ENABLED", "ADI_MULTI_ASK_ENABLED",
  // Sentrix (evidencia · boleta · lentes · shell · temporal · pareto · explore · cuadro)
  "ADI_SENTRIX_BOLETA_ENABLED", "ADI_SENTRIX_READING_ENABLED", "ADI_SENTRIX_EXPLORE_ENABLED",
  "ADI_SENTRIX_PARETO_ENABLED", "ADI_SENTRIX_SHELL_ENABLED", "ADI_SENTRIX_TEMPORAL_ENABLED",
  "ADI_SENTRIX_CUADRO_ENABLED",
  // ARQUITECTURA C · ORÁCULO VERIFICADO (owner 2026-07-29, tras verificación en vivo en producción con ?oracle=1 +
  // los 6 pendientes del veredicto de 18 turnos cerrados con gate + 2 bugs reales de P&L cazados y arreglados en
  // vivo): pasa de override manual a DEFAULT en demo/prod/dev. `floor` (Node/gates/oráculo) sigue en [] — byte-exacto
  // intacto, esta lista no lo toca. El override por navegador (localStorage adi_oracle / ?oracle=0) sigue vivo para
  // comparar con la ruta vieja si hiciera falta.
  "ADI_ORACLE_ENABLED",
  // CAMINO NATURAL COMO PRINCIPAL (owner 2026-08-14, autorizado con 6 condiciones — ver caminoNatural.js): el
  // turno libre va por el cerebro único + notario + ciclo de reparación. `floor` (Node/gates) sigue en [] —
  // byte-exacto intacto. APAGARLO EN TODAS PARTES = borrar esta línea (rollback de una línea, condición 2).
  "ADI_CAMINO_NATURAL",
];

// DEV-TOOLS · herramientas internas · SOLO dev (nunca demo/prod)
const DEV_TOOLS = [
  // ADI_SCENARIO_SWITCHER_ENABLED — APAGADO EN TODOS LOS PERFILES (owner 2026-08-07). El selector estaba solo-dev
  // por diseño, pero el deploy de `dev` es lo que el owner y la demo miran, así que el CONCEPTO de escenario se
  // filtraba a la superficie del producto: "Bonanza · Tensión · Crisis" en el header, con códigos de demo enviados.
  // El dato de "bonanza" ES la realidad del negocio (ver la memoria de colapsar escenarios) — lo que sobra es el
  // concepto, no los datos ni la lógica. Apagarlo acá es el primer paso de ese colapso, no un parche: el eje
  // `scenario` sigue vivo en el motor (69 archivos, lo necesitan Simulate v2 y el aislamiento por tenant) y la app
  // queda mostrando el chip neutro "Datos actuales" que App.jsx ya renderiza cuando el flag está en false.
  // Para volver a verlo en una sesión de desarrollo: reponer el nombre en esta lista, nunca en FEATURE.
];

// EXPERIMENTAL · features nuevas aún no aptas para prod · demo + dev, NO prod · (vacío por ahora · el owner clasifica acá)
const EXPERIMENTAL = [];

const PROFILES = {
  floor: [],
  demo:  [...FEATURE, ...EXPERIMENTAL],
  prod:  [...FEATURE],
  dev:   [...FEATURE, ...EXPERIMENTAL, ...DEV_TOOLS],
};

// perfil activo · __ADI_PROFILE__ lo hornea Vite desde VITE_ADI_PROFILE · Node/gates → "floor" (byte-exacto)
const _profile = (typeof __ADI_PROFILE__ !== "undefined" && PROFILES[__ADI_PROFILE__]) ? __ADI_PROFILE__ : "floor";
export const ADI_PROFILE = _profile;

const _ON = new Set(PROFILES[_profile]);

// P(name) → ¿el flag está encendido en el perfil activo? Todos los flags gestionados son OFF al piso (default false).
export function P(name) { return _ON.has(name); }
