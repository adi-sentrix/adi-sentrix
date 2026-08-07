/* === config/businessPolicy.js · POLÍTICA DE NEGOCIO · UNA fuente de verdad ===
 * Hardening pre-lanzamiento (2026-07-02): los umbrales que ADI CITA al usuario (benchmark de margen, mejor práctica
 * y target de carga comercial) estaban re-declarados como literales en 8+ composers (crossDomain/thesis/mechanisms/
 * contribution/…). Eso era "dos verdades": si el owner movía un umbral, había que cazarlo en cada archivo y uno se
 * olvidaba → dos respuestas citando targets distintos. Ahora vive acá, UNA vez.
 *
 * F2 MULTIEMPRESA (2026-07-26): POLICY deja de ser una constante global — se RESUELVE por empresa. Tres capas,
 * siempre en este orden de precedencia:
 *   1. el CRITERIO del usuario (C.2 · "mi margen mínimo es 28%") — SIEMPRE gana · scopeado por tenant (criteria.js)
 *   2. el PERFIL del tenant (tenants/<id>.js · `perfil`) — la vara que ESTA empresa declara con su dato
 *   3. POLICY_CONFIG — el fallback de config para lo que el perfil no declara
 * `POLICY` sigue siendo EL objeto que todos leen (los ~22 importadores no se tocan): initTenant lo re-resuelve
 * (capa 2 sobre 3) y criteria.js re-aplica encima lo del usuario (capa 1) — su callback corre después porque
 * criteria importa este módulo. Resolución DEFENSIVA: solo números finitos del perfil cuentan (un perfil roto
 * cae al config, y el validador del contrato lo reporta — regla perfil-valido).
 *
 * REGLA DE PRECEDENCIA DEL DATO: `benchmark` es el FALLBACK para cuando una fila del dataset no trae su propio
 * `benchmark` — siempre preferir `fila.benchmark ?? POLICY.benchmark` (el demo trae 30.1 por fila · empresa-2, 26.0). */
import { getTenantData, onTenantChange } from "../data/tenantStore.js";

// ── CAPA 3 · el fallback de config (lo que valía como literal hasta F2 · congelado: la config no muta) ──────────────
export const POLICY_CONFIG = Object.freeze({
  benchmark: 30.1,          // margen benchmark de cartera (%) · FALLBACK · el dato lo trae por-fila
  bestPracticeCarga: 3.0,   // mejor práctica interna de carga comercial (%)
  targetCarga: 3.5,         // target operativo de carga comercial (%)
  rotacionMin: 2,           // diagnose · piso de rotación (x): por debajo, el stock se considera dormido (numérico · portable a ERP real)
  dohMax: 120,              // diagnose · techo de cobertura (días): por encima, el stock se considera dormido
  margenBrechaMaterial: 4,  // diagnose · brecha material de margen (pp bajo la vara) · UNA verdad (detector + semáforo de la Mesa/cuadro)
  // ── diagnóstico de inventario (owner 2026-07-06 · umbrales configurables) · salud de las DOS puntas: sobra y falta ──
  quiebreRotMin: 6,         // riesgo de quiebre: rotación ALTA (≥) …
  quiebreDohMax: 20,        // … y cobertura BAJA (DOH ≤ días) → se va a quedar sin stock
  sobrestockDohMin: 60,     // sobrestock: DOH entre esto y dohMax (vende, pero cobertura excesiva)
  quiebreMaterialUsd: 20000,// materialidad de la alerta de quiebre: $ mínimo para no secuestrar la respuesta con ruido
  quiebreMaterialPct: 5,    // … o % del capital del foco
});

// ── EL OBJETO VIVO · lo que todo ADI lee (composers/detectores/semáforos) · re-resuelto en initTenant ───────────────
export const POLICY = { ...POLICY_CONFIG };

// ── CRITERIO DEL OWNER (C.2 · 2026-07-07) · "mi piso de margen es 28%, no el estándar" ──────────────────────────────
// El usuario puede fijar SU vara ("recordá que mi margen mínimo es 28%") → override del benchmark en el PUNTO ÚNICO:
// pisa tanto el default resuelto (perfil/config) como el benchmark embebido por-fila. null = sin criterio →
// precedencia original intacta (byte-exacto · los gates corren en default). Scopeado por tenant vía criteria.js.
let _benchmarkOverride = null;
export const setBenchmarkOverride = (v) => { _benchmarkOverride = (typeof v === "number" && isFinite(v)) ? v : null; };
export const getBenchmarkOverride = () => _benchmarkOverride;

// ── CAPA 2 · resolución del perfil del tenant (defensiva: solo números finitos) ─────────────────────────────────────
const _perfilVal = (key) => {
  const p = getTenantData() && getTenantData().perfil;
  const v = p ? p[key] : undefined;
  return (typeof v === "number" && isFinite(v)) ? v : undefined;
};
// el default VIGENTE de una llave (perfil del tenant ?? config) — lo que "olvidá el criterio" restaura (criteria.js)
export const tenantPolicyDefault = (key) => { const v = _perfilVal(key); return v !== undefined ? v : POLICY_CONFIG[key]; };

function _resolvePolicy() {
  for (const k of Object.keys(POLICY_CONFIG)) POLICY[k] = tenantPolicyDefault(k);
  setBenchmarkOverride(null);   // la vara del usuario NO arrastra entre empresas — criteria.js re-aplica la del tenant activo
}
_resolvePolicy();                 // al evaluar el módulo: resuelve el tenant activo (demo perfil == config → byte-idéntico)
onTenantChange(_resolvePolicy);   // en cada initTenant: perfil nuevo primero; criteria.js (registrado después) re-aplica C.2 encima

// helper: el benchmark de una entidad — el CRITERIO del usuario manda; si no hay, el dato por-fila; si no, POLICY.
export const benchmarkOf = (entity) => (_benchmarkOverride != null ? _benchmarkOverride : (entity && typeof entity.benchmark === "number" ? entity.benchmark : POLICY.benchmark));

// ── PROCEDENCIA DE LA REFERENCIA (Regla de Proporcionalidad Semántica, owner 2026-08-07) ───────────────────────
// Las TRES capas que resuelve `benchmarkOf` son INTERNAS de la empresa: (1) el criterio que el usuario fijó (C.2),
// (2) el `benchmark` por fila del dataset del tenant, (3) `POLICY.benchmark` del PERFIL. Ninguna viene de una
// fuente sectorial. Por eso la referencia se narra como "tu benchmark" / "tu referencia" / "la meta definida para
// tu negocio", y NUNCA como "estándar del sector", "promedio del mercado" ni "referencia de la industria".
//
// ESTO NO ES UNA OPINIÓN, ES EL ESTADO DEL PRODUCTO: `SECTORAL_BENCHMARKS` existe declarado en
// src/config/scenarios.js pero NO se importa en ninguna parte de `src/` (solo en los monolitos archivados), y sus
// propios comentarios lo marcan `[DERIVADO n=6 SKU]` / `[ASUNCIÓN U.A]` — o sea, derivado del mismo dato demo.
// Mientras eso siga así, "externa_sector" NO se puede producir y toda afirmación sectorial es no autorizada.
// El día que exista una fuente externa real, se cambia ACÁ (una verdad) y el resto del sistema la respeta solo.
export const REFERENCIA_PROCEDENCIA = "interna_empresa";   // "interna_empresa" | "externa_sector"

// Etiquetas de MÉTRICA que son una REFERENCIA (no una medición del negocio). Se declaran acá, junto al único
// resolvedor (`benchmarkOf`), para que la procedencia no se adivine con un regex esparcido por los composers.
// Los emisores usan estas etiquetas literales: toolRegistry.js (boleta del perfil/margen), entityRecord.js
// (REFS.margen.label) y conversation.js (enumeración) — una sola convención de nombre, ya vigente.
export const METRICAS_DE_REFERENCIA = ["Benchmark de margen"];

// ── COST MODEL (owner 2026-07-31, #56 "simulate v2") ── declaración EXPLÍCITA de cómo se comporta el costo del
// tenant — sin esto, simulateGeneral (toolRegistry.js) no puede calcular margen/contribución bajo un supuesto de
// precio+volumen, solo ventas (degrade honesto, nunca inventa el modelo). NO es numérico → resolución PROPIA,
// AFUERA del loop genérico de `_resolvePolicy` de arriba (que exige `typeof==="number"`, ver `_perfilVal`) — no se
// toca esa función para no arriesgar los ~22 importadores que ya dependen de su comportamiento byte-exacto.
// Default HONESTO: `null` (no autorizado) — ningún tenant lo declara salvo que su PERFIL lo traiga explícito.
const _COST_MODEL_TIPOS = new Set(["variable_total"]);
let _costModelOverride = null;   // C.2-style: override puntual del usuario ("asumamos costo variable") — no re-pregunta cada turno
export const setCostModelOverride = (v) => { _costModelOverride = (v && _COST_MODEL_TIPOS.has(v.tipo)) ? v : null; };
export const getCostModelOverride = () => _costModelOverride;
function _resolveCostModel() {
  const p = getTenantData() && getTenantData().perfil;
  const fromPerfil = (p && p.costModel && _COST_MODEL_TIPOS.has(p.costModel.tipo)) ? p.costModel : null;
  POLICY.costModel = fromPerfil;
  _costModelOverride = null;   // no arrastra entre tenants, mismo criterio que _benchmarkOverride
}
_resolveCostModel();
onTenantChange(_resolveCostModel);
// costModelOf() → el modelo EFECTIVO (criterio del usuario > perfil del tenant > sin autorizar), mismo orden de
// precedencia que benchmarkOf().
export const costModelOf = () => (_costModelOverride != null ? _costModelOverride : POLICY.costModel);
