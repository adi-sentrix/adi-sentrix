/* === src/adi/oracle/requestContext.js · ARQUITECTURA C · CONTEXTO OBLIGATORIO (multiempresa/multiusuario) ===
 * owner 2026-07-29: "prepara Arquitectura C para multiempresa, múltiples usuarios y mayor volumen de datos" —
 * cada operación del oráculo debe transportar EXPLÍCITAMENTE tenantId, conversationId, dataSnapshotId+fecha de
 * corte, locale/moneda/timezone, versión de esquema — nunca depender de un global implícito.
 *
 * HONESTIDAD DE ALCANCE (documentado, no escondido): esta app hoy NO tiene backend de autenticación/usuarios real
 * (la "demo privada" es un código de acceso HMAC compartido por link, no cuentas de usuario — ver
 * adi-demo-privada.md). `userId`/`role` quedan como CAMPOS ESTRUCTURALES listos para cuando exista ese backend —
 * hoy se completan con un default de un-solo-usuario-por-sesión, NUNCA se usan para decidir autorización real
 * (la autorización real hoy es binaria: tiene el código de acceso o no). tenantId/conversationId/dataSnapshotId/
 * locale-moneda-timezone/schemaVersion SÍ son reales y se validan.
 *
 * EL RIESGO REAL que esto ataca: `tenantStore.js` guarda el tenant activo en una variable GLOBAL de módulo
 * (`let _data`) — correcto para el modelo actual (motor determinístico corriendo CLIENT-SIDE, un browser tab =
 * un proceso = un usuario a la vez), pero un riesgo real si alguna vez el motor corriera server-side compartiendo
 * proceso entre requests de distintos tenants. `assertTenantContext` es el guard que lo detecta ANTES de que
 * pase: si el tenantId del contexto no coincide con el tenant activo, aborta en vez de calcular con datos ajenos.
 */
import { getTenantId } from "../../data/tenantStore.js";
import { ESCENARIO_INICIAL } from "../../config/scenarios.js";   // colapso del eje (C5): el default de conveniencia dejaba leer OTRA carpeta que la pantalla

export const REQUEST_CONTEXT_VERSION = "adi-request-context@1.0.0";
// versión del ESQUEMA de métricas/dimensiones que el catálogo (planPrompt.js TOOL_CATALOG) expone — súbela cuando
// se agregue/renombre una métrica o dimensión, para que un cliente viejo no reciba un catálogo que no entiende.
export const METRIC_SCHEMA_VERSION = "adi-metric-schema@1.0.0";

const _DEFAULT_LOCALE = "es-CL";
const _DEFAULT_TIMEZONE = "America/Santiago";

// buildRequestContext(overrides) → el contexto obligatorio de ESTE turno. tenantId/dataSnapshotId se derivan solos
// (tenantStore + scenario); conversationId/userId hay que pasarlos desde el caller (una conversación = un hilo de
// chat — ChatADI.jsx genera uno por sesión de componente); locale/moneda/timezone se pueden pisar por `overrides`
// o (si no) se toman de la identidad ya guardada en `mem` (persona.js ya lee `mem.identidad.moneda` — este
// contexto no lo reemplaza, lo hace EXPLÍCITO y trazable en la boleta/evidence).
export function buildRequestContext({ conversationId = null, scenario = ESCENARIO_INICIAL, mem = {}, userId = null, role = "owner", locale, currency, timezone } = {}) {
  const tenantId = getTenantId();
  const id = (mem && mem.identidad) || {};
  return {
    contextVersion: REQUEST_CONTEXT_VERSION,
    schemaVersion: METRIC_SCHEMA_VERSION,
    tenantId,
    conversationId: conversationId || null,
    dataSnapshotId: `${tenantId}::${scenario}`,
    cutoffDate: null,   // PLACEHOLDER honesto: el dataset demo no trae fecha de corte real por fila — cuando haya
                        // un pipeline de datos real, acá va la fecha de la última carga/sincronización de ESE tenant.
    locale: locale || _DEFAULT_LOCALE,
    currency: currency || id.moneda || null,
    timezone: timezone || _DEFAULT_TIMEZONE,
    userId,   // PLACEHOLDER — sin backend de auth real, ver nota de arriba
    role,     // PLACEHOLDER — idem
  };
}

// assertTenantContext(context) → { ok, reason? } · el GUARD determinístico contra el riesgo real documentado
// arriba: si el tenant del contexto no es el tenant ACTIVO en este momento, NO calcules — abstenete. Se llama
// ANTES de correr el batch (runPlan), nunca después (de nada sirve detectarlo con el dato ya mezclado).
export function assertTenantContext(context) {
  if (!context || typeof context !== "object") return { ok: false, reason: "sin contexto — tenantId no declarado" };
  const active = getTenantId();
  if (context.tenantId !== active) return { ok: false, reason: `contexto pide tenant "${context.tenantId}" pero el tenant activo es "${active}" — abstención, no se mezcla dato de dos empresas` };
  return { ok: true };
}
