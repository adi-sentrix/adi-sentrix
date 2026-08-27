/* === data/paseTenant.js · EL PASE CORTO QUE LE DICE A LA BASE DE QUÉ EMPRESA ES ESTA CONSULTA ==========
 *
 * LA DECISIÓN DEL OWNER (2026-08-27), textual: «la puerta actual con código firmado sigue igual; el servidor
 * verifica ese código; luego emite un pase corto con tenant_id; Supabase RLS usa ese tenant_id para filtrar;
 * no usamos service role para saltarnos RLS en lecturas normales; no metemos Supabase Auth todavía».
 *
 * POR QUÉ EXISTE ESTE ARCHIVO. Con la llave de servicio, RLS **no protege nada**: el servidor puede leer todo
 * y el aislamiento vuelve a depender de que el código no tenga un bug — que es exactamente lo que la vía 1
 * salió a eliminar. Con el pase, un error de filtro devuelve CERO FILAS, no las de otra empresa. Falla cerrada.
 *
 * QUÉ ES. Un JWT HS256 mínimo —`{role, tenant_id, iat, exp}`— firmado con el secreto JWT del proyecto de
 * Supabase. PostgREST lo acepta como cualquier token suyo y deja los claims en `request.jwt.claims`, que es
 * de donde los lee `adi.tenant_actual()` en `db/migraciones/001_esquema_base.sql`.
 *
 * NO TRAE UNA DEPENDENCIA. Firma con las mismas primitivas Web Crypto que ya usa la puerta
 * (`adi/llm/accessToken.js`), que corren en **edge y en node por igual** — y eso importa, porque el endpoint
 * que va a leer el pack activo corre en edge junto a otros cuatro. Meter algo de Node en ese camino ya costó
 * tres builds rotos con todos los candados en verde.
 *
 * EL PASE ES CORTO A PROPÓSITO. Se emite por request, se usa en el mismo milisegundo y muere. Cinco minutos
 * no es holgura para el viaje: es tolerancia a que los relojes de dos servicios distintos no coincidan.
 *
 * ⚠️ EL SECRETO NUNCA SALE DEL SERVIDOR. Este módulo no se importa desde el navegador: quien pueda firmar un
 * pase puede fabricarse el de cualquier empresa. Lo verifica `_pase_tenant_gate.mjs`.
 *
 * COMPATIBILIDAD HACIA ADELANTE (pedido explícito del owner): el día que haya cuentas, el pase suma `sub` y
 * las políticas se extienden con un OR. Ni este archivo ni las tablas se rehacen.
 */
import { b64urlDeTexto, textoDeB64url, firmarHmacB64u, constantTimeEqual, tenantLimpio } from "../adi/llm/accessToken.js";

/** Cinco minutos: tolerancia de reloj entre Vercel y Supabase, no holgura de uso. */
export const TTL_PASE_S = 300;

/** El rol de base que creó la migración. Un rol propio y NO `authenticated`: este pase no es una sesión de
 *  Supabase Auth, y cuando existan cuentas de verdad tiene que verse que son otra cosa. */
export const ROL_PASE = "adi_tenant";

const _CABECERA = b64urlDeTexto(JSON.stringify({ alg: "HS256", typ: "JWT" }));
const _PARTES = /^([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/;

/* emitirPase({ tenantId, secreto, ... }) → { ok:true, pase, expiraEn } | { ok:false, motivo }
 * Devuelve el contrato `{ok, motivo}` del resto del servidor en vez de tirar una excepción: un pase que no se
 * puede emitir tiene que terminar en «sin sesión válida» y cero filas, no en un 500. */
export async function emitirPase({ tenantId, secreto, ttlSegundos = TTL_PASE_S, ahora = Date.now() } = {}) {
  if (!secreto) return { ok: false, motivo: "falta el secreto de firma" };

  const t = tenantLimpio(tenantId);
  if (!t) return { ok: false, motivo: "empresa inválida" };

  const iat = Math.floor(ahora / 1000);
  const exp = iat + Math.max(1, Math.floor(ttlSegundos));
  const cuerpo = b64urlDeTexto(JSON.stringify({ role: ROL_PASE, tenant_id: t, iat, exp }));
  const mensaje = `${_CABECERA}.${cuerpo}`;
  const firma = await firmarHmacB64u(mensaje, secreto);

  return { ok: true, pase: `${mensaje}.${firma}`, expiraEn: exp * 1000, tenantId: t };
}

/* leerPaseSinVerificar(pase) → { tenantId, rol, expiraEn } | null
 * SIN verificar la firma: sirve para diagnóstico y para el candado, jamás para decidir si se sirve un dato.
 * Quien decide es `verificarPase`. */
export function leerPaseSinVerificar(pase) {
  try {
    const m = String(pase || "").trim().match(_PARTES);
    if (!m) return null;
    const p = JSON.parse(textoDeB64url(m[2]));
    if (!p || typeof p.exp !== "number") return null;
    return { tenantId: tenantLimpio(p.tenant_id), rol: String(p.role || ""), expiraEn: p.exp * 1000 };
  } catch { return null; }
}

/* verificarPase(pase, secreto, ahora) → { ok:true, tenantId, rol, expiraEn } | { ok:false, motivo }
 * Existe para el candado y para cualquier verificación nuestra. La verificación que cuenta en producción la
 * hace la BASE al evaluar la política — este módulo no es el muro, es quien emite la credencial del muro. */
export async function verificarPase(pase, secreto, ahora = Date.now()) {
  if (!secreto) return { ok: false, motivo: "falta el secreto de firma" };

  const m = String(pase || "").trim().match(_PARTES);
  if (!m) return { ok: false, motivo: "pase mal formado" };

  const esperada = await firmarHmacB64u(`${m[1]}.${m[2]}`, secreto);
  // Tiempo constante: no cortar en el primer byte distinto. Mismo criterio que la puerta.
  if (!constantTimeEqual(esperada, m[3])) return { ok: false, motivo: "firma inválida" };

  const leido = leerPaseSinVerificar(pase);
  if (!leido) return { ok: false, motivo: "pase mal formado" };
  if (!leido.tenantId) return { ok: false, motivo: "empresa inválida" };
  if (leido.rol !== ROL_PASE) return { ok: false, motivo: "rol no autorizado" };
  if (ahora >= leido.expiraEn) return { ok: false, motivo: "pase vencido" };

  return { ok: true, tenantId: leido.tenantId, rol: leido.rol, expiraEn: leido.expiraEn };
}

/* esCredencialDeServicio(token) → boolean
 * ⚠️ EL CERROJO QUE IMPIDE EL ACCIDENTE QUE ESTE DISEÑO EXISTE PARA EVITAR. La llave de servicio de Supabase
 * es un JWT con `role: "service_role"` y **se salta RLS entera**. Mandarla en una lectura normal —por copiar
 * una variable de entorno de más, que es como pasa de verdad— convertiría el muro en decoración sin que nada
 * fallara ni se pusiera rojo. Por eso el cliente REST la reconoce y se niega, en vez de confiar en que nadie
 * la ponga ahí. Reconocerla NO requiere el secreto: el rol viaja en el cuerpo, a la vista. */
export function esCredencialDeServicio(token) {
  try {
    const m = String(token || "").trim().match(_PARTES);
    if (!m) return false;
    const p = JSON.parse(textoDeB64url(m[2]));
    return String(p?.role || "") === "service_role";
  } catch { return false; }
}
