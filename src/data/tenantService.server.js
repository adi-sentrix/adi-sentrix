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
import { clienteDesdeEntorno, baseConfigurada } from "./supabaseRest.js";
import { emitirPase } from "./paseTenant.js";

const _env = (env) => env || (typeof process !== "undefined" && process.env) || {};

/* LA FRASE ES DEL OWNER, TEXTUAL (2026-08-27), y por eso vive acá y no escrita en la pantalla: es la respuesta
 * del producto a un estado del negocio, no un cartel de una vista. Si la redactara React habría dos verdades
 * el día que otra superficie tenga que decir lo mismo. */
export const MENSAJE_SIN_DATOS =
  "Todavía no hay datos cargados para esta empresa. Puedes subir una planilla o mirar el demo.";

/* packActivo({ tenantId, env }) → qué tiene esta empresa guardado en la base.
 *   { estado:"sin-base" }                    → no hay Supabase configurado: el que llama sigue como hoy
 *   { estado:"empresa-desconocida" }         → hay base, y esta empresa no existe en ella
 *   { estado:"sin-datos" }                   → la empresa existe y todavía no activó ninguna versión
 *   { estado:"activo", pack, sello, version }→ hay una versión activa
 *
 * ⚠️ CORRE EN EDGE. Por eso el cliente de la base se escribió a mano sobre `fetch` y no con el SDK: este
 * módulo lo importa `/api/adi-data`, que junto con otros cuatro endpoints corre en runtime edge. */
async function packActivo({ tenantId, env, cliente }) {
  const e = _env(env);
  if (!baseConfigurada(e)) return { estado: "sin-base" };

  /* `cliente` es la costura para ejercer esto con un doble, sin red ni proyecto. Va por PARÁMETRO y no como
   * estado del módulo: un interruptor global que un gate pueda dejar encendido es un modo de producción que
   * nadie eligió. Acá, si nadie lo pasa, no existe. */
  const db = cliente || clienteDesdeEntorno(e);
  const p = await emitirPase({ tenantId, secreto: e.SUPABASE_JWT_SECRET || "" });
  if (!db || !p.ok) return { estado: "sin-base" };

  /* Preguntar por la empresa YA es la comprobación de que existe: RLS hace que la de otro no aparezca. Esto
   * reemplaza al «¿está en el registro de esta build?» — con base, quién existe lo dice la base, no el bundle. */
  const emp = await db.seleccionar("tenants", { pase: p.pase, columnas: "id,nombre", limite: 1 });
  if (!emp.ok) return { estado: "sin-base" };            // la base no respondió: se cae al camino de hoy
  if (!emp.filas.length) return { estado: "empresa-desconocida" };

  const v = await db.llamarFuncion("adi_version_activa", {}, { pase: p.pase });
  if (!v.ok) return { estado: "sin-base" };
  if (!v.filas.length) return { estado: "sin-datos", nombre: emp.filas[0].nombre };

  const f = v.filas[0];
  return { estado: "activo", pack: f.pack, sello: f.sello, version: f.version, nombre: emp.filas[0].nombre };
}

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

  /* ⚠️ CON BASE, QUIÉN EXISTE LO DICE LA BASE — NO EL BUNDLE. Este chequeo nació cuando el registro estático
   * era la única lista de empresas: preguntar por una que no estaba ahí no podía terminar bien. Con Supabase
   * conectado, una empresa nueva vive en `tenants` y nunca va a estar en el registro compilado, así que exigir
   * las dos cosas dejaría fuera exactamente a los clientes reales. La verificación no desaparece: la hace
   * `packActivo`, preguntándole a la base con el pase — y RLS hace que la de otro no aparezca. */
  if (!baseConfigurada(e) && !Object.prototype.hasOwnProperty.call(TENANTS, tenantId)) {
    return { ok: false, motivo: `empresa no habilitada en esta build: ${tenantId}` };
  }
  return { ok: true, tenantId, origen, nombre };
}

/* handleData(body, env) → la respuesta del endpoint /api/adi-data.
 * Contrato: { ok:true, tenantId, origen, nombre, dataset } · { ok:false, motivo } — y en el caso falso NO viaja
 * ni una fila. Devuelve 200 con ok:false igual que el resto del gateway (el cliente ya sabe leer ese contrato). */
export async function handleData(body = {}, env, { cliente } = {}) {
  /* ── «MIRAR EL DEMO» · el segundo camino que ofrece el aviso de empresa sin datos ────────────────────
   * El negocio de demostración es dato de ejemplo que YA VIAJA en el bundle del servidor: no es de nadie y
   * no revela nada. Por eso se sirve del registro estático y se marca como lo que es.
   *
   * ⚠️ Y POR ESO NO SE EMITE UN PASE DE `demo` PARA UNA SESIÓN QUE NO ES DE `demo`. Sería crear la capacidad
   * de que el servidor firme pases de una empresa distinta a la de la sesión — hoy para el ejemplo, mañana
   * reutilizada para otra cosa. La capacidad que no existe no se puede usar mal. La copia sembrada en la base
   * sigue siendo la que recibe una sesión cuya empresa ES el demo, que es el caso que ejerce el camino real. */
  if (body.op === "demo") {
    const demo = TENANTS.demo || null;
    if (!demo) return { ok: false, motivo: "esta build no trae negocio de demostración" };
    return { ok: true, tenantId: "demo", origen: "demo-explicito", nombre: demo.nombre || "Negocio de demostración",
      dataset: demo, esDemo: true };
  }

  const r = await resolverTenantDeSesion(body, env);
  if (!r.ok) return { ok: false, motivo: r.motivo };

  const g = await packActivo({ tenantId: r.tenantId, env, cliente });

  /* HAY DATOS GUARDADOS: son estos y no los del bundle. El sello viaja con el pack porque califica sus
   * lecturas — si el usuario asumió una observación al cargar, eso tiene que sobrevivir a recargar la página,
   * que es la razón entera por la que este frente existe. */
  if (g.estado === "activo") {
    return { ok: true, tenantId: r.tenantId, origen: "guardado", nombre: g.nombre || r.nombre,
      dataset: g.pack, sello: g.sello || null, version: g.version };
  }

  /* ⚠️ LA EMPRESA EXISTE Y NO SUBIÓ NADA. Decisión del owner (2026-08-27): no se le muestra el demo como si
   * fuera suyo. Se le dice qué pasa y se le ofrecen los dos caminos. `ok:true` a propósito — no es un error
   * ni una falla: es un estado legítimo del negocio, y tratarlo como error haría que la app mostrara una
   * pantalla rota en vez de una puerta. Va sin `dataset`: ni una fila de otra empresa. */
  if (g.estado === "sin-datos") {
    return { ok: true, tenantId: r.tenantId, origen: "sin-datos", nombre: g.nombre || r.nombre,
      dataset: null, sinDatos: true, mensaje: MENSAJE_SIN_DATOS };
  }

  if (g.estado === "empresa-desconocida") {
    return { ok: false, motivo: `empresa no habilitada: ${r.tenantId}` };
  }

  /* SIN BASE CONFIGURADA (o sin respuesta de la base): el registro estático, exactamente como hasta hoy. */
  return { ok: true, tenantId: r.tenantId, origen: r.origen, nombre: r.nombre, dataset: TENANTS[r.tenantId] };
}
