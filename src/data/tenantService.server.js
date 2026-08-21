/* === data/tenantService.server.js · QUIÉN RECIBE QUÉ DATO · SOLO SERVIDOR (vía 1 · 2026-08-20) ================
 *
 * ⚠️ EL `.server.` DEL NOMBRE ES UNA ADVERTENCIA, NO UN ADORNO. Este es el único módulo del repo que importa el
 * REGISTRO COMPLETO de tenants. Si algún día un módulo del navegador lo importa —directa o transitivamente— el
 * dato de todas las empresas vuelve al bundle publicado, que es exactamente el defecto que la vía 1 cierra.
 * El candado `_bundle_sin_datos_gate.mjs` [A] se pone rojo si eso pasa: no depende de que alguien se acuerde.
 *
 * QUÉ RESUELVE. «La empresa sale de la sesión, nunca de un parámetro libre del navegador» (owner 2026-08-20).
 * El código de acceso ya era el login de la demo privada; ahora lleva **la empresa adentro de la firma HMAC**
 * (`accessToken.js`). Este módulo:
 *   1. VERIFICA el código con el secret del servidor — el cliente no puede fabricarlo ni estirarlo,
 *   2. lee la empresa DEL PAYLOAD YA VERIFICADO (jamás de lo que el cliente afirme),
 *   3. devuelve UN dataset: el de esa empresa y ninguno más.
 *
 * TRES DECISIONES QUE VALE LA PENA QUE ESTÉN ESCRITAS:
 *
 * · **Sin sesión válida no se sirve dato.** Ni el demo «por las dudas». Con la puerta armada
 *   (`ADI_TOKEN_SECRET` presente), un código inválido o vencido recibe `{ok:false}` y CERO filas. La app queda
 *   en la forma vacía y muestra la pantalla de acceso, que es lo que ya hacía con las llamadas al gateway.
 *
 * · **Si la empresa firmada no existe en el registro, se declara — no se cae al demo.** Un fallback silencioso
 *   acá serviría el dato de OTRA empresa a alguien cuyo código dice otra cosa. Preferimos el error visible.
 *
 * · **El conmutador de empresa en desarrollo (`?tenant=`) existe, pero lo habilita el SERVIDOR.** Solo con
 *   `ADI_DEV_TENANT_SWITCH=true` en el entorno del servidor se honra `tenantSolicitado`. En producción esa
 *   variable no está, así que el parámetro del navegador no hace absolutamente nada. Y la respuesta SIEMPRE
 *   declara por qué sirvió lo que sirvió (`origen`), para que un dato inesperado se pueda explicar sin adivinar.
 */
import { TENANTS } from "./tenants/index.js";
import { verifyAccessCode } from "../adi/llm/accessToken.js";

const _env = (env) => env || (typeof process !== "undefined" && process.env) || {};

/** Los ids que esta build conoce — sale del registro, no de una lista escrita a mano. */
export const tenantsDisponibles = () => Object.keys(TENANTS);

/* resolverTenantDeSesion({ access, tenantSolicitado }, env) → { ok, tenantId, origen, nombre? } | { ok:false, … }
 * La decisión de QUÉ empresa, separada de la entrega del dato: así el gate la puede ejercer sin mover datasets. */
export async function resolverTenantDeSesion({ access, tenantSolicitado } = {}, env) {
  const e = _env(env);
  const secret = e.ADI_TOKEN_SECRET || "";

  let tenantId = "demo";
  let origen = "sin-puerta";     // no hay ADI_TOKEN_SECRET: la demo abierta de siempre, solo demo
  let nombre = null;

  if (secret) {
    const r = await verifyAccessCode(access, secret);
    if (!r.ok) return { ok: false, motivo: r.reason === "expired" ? "sesión vencida" : "sin sesión válida" };
    tenantId = r.tenant || "demo";
    origen = "sesion";
    nombre = r.name || null;
  }

  // conmutador de desarrollo · lo habilita el SERVIDOR, nunca el navegador por su cuenta
  if (String(e.ADI_DEV_TENANT_SWITCH) === "true" && tenantSolicitado) {
    const pedido = String(tenantSolicitado).trim().toLowerCase();
    if (Object.prototype.hasOwnProperty.call(TENANTS, pedido)) { tenantId = pedido; origen = "dev-switch"; }
  }

  if (!Object.prototype.hasOwnProperty.call(TENANTS, tenantId)) {
    return { ok: false, motivo: `empresa no habilitada en esta build: ${tenantId}` };
  }
  return { ok: true, tenantId, origen, nombre };
}

/* handleData(body, env) → la respuesta del endpoint /api/adi-data.
 * Contrato: { ok:true, tenantId, origen, nombre, dataset } · { ok:false, motivo } — y en el caso falso NO viaja
 * ni una fila. Devuelve 200 con ok:false igual que el resto del gateway (el cliente ya sabe leer ese contrato). */
export async function handleData(body = {}, env) {
  const r = await resolverTenantDeSesion(body, env);
  if (!r.ok) return { ok: false, motivo: r.motivo };
  return { ok: true, tenantId: r.tenantId, origen: r.origen, nombre: r.nombre, dataset: TENANTS[r.tenantId] };
}
