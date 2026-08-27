/* === data/supabaseRest.js · EL CLIENTE DE LA BASE, ESCRITO A MANO ======================================
 *
 * POR QUÉ NO EL SDK DE SUPABASE. El endpoint que va a leer el pack activo (`/api/adi-data`) corre en runtime
 * **EDGE**, junto a otros cuatro que importan `adi/llm/gatewayFetch.js`. Meter en ese camino algo que dependa
 * de un módulo de Node ya costó **tres builds rotos** con los 177 candados en verde, porque ninguno empaquetaba
 * para edge. Es el mismo criterio con el que se escribió el lector de `.xlsx` en vez de sumar una librería: el
 * repo tiene casi cero dependencias de ejecución y esa postura es la que hace el camino edge predecible.
 *
 * QUÉ ES. Un envoltorio delgado sobre PostgREST, la API REST que Supabase expone sobre Postgres. Habla HTTP y
 * nada más, así que sirve igual en edge y en node.
 *
 * ⚠️ ESTE MÓDULO NO ES EL MURO. El aislamiento lo hace la base al evaluar las políticas de RLS contra el pase
 * (`db/migraciones/001_esquema_base.sql`). Acá no hay ninguna comprobación de la que dependa la seguridad —
 * si la hubiera, estaríamos otra vez confiando en que el código del servidor no tenga un bug, que es
 * exactamente lo que este diseño evita. Lo único que este archivo garantiza es que **no se mande la credencial
 * equivocada**, que es el accidente que apagaría el muro sin que nada se ponga rojo.
 *
 * SIN CONFIGURAR, NO HACE NADA. `clienteDesdeEntorno()` devuelve `null` cuando faltan las variables, y quien
 * lo llama sigue con el comportamiento de hoy. Es la bandera que el owner pidió: sin credenciales, la app se
 * comporta exactamente como antes de este frente.
 *
 * EL CONTRATO ES `{ok, …}` Y NO EXCEPCIONES, igual que `handleData`: un problema de base tiene que terminar en
 * «no se pudo» y cero filas, no en un 500 que el navegador no sabe leer.
 *
 * ⚠️ UN RESULTADO VACÍO NO ES UN ERROR. `{ok:true, filas:[]}` es la respuesta correcta cuando el pase no
 * autoriza nada — y es justamente la forma en que este diseño falla cerrado. Quien llama decide qué significa.
 */
import { esCredencialDeServicio } from "./paseTenant.js";

const _IDENT = /^[a-z_][a-z0-9_]*$/;

/* Los operadores de PostgREST que este cliente admite. Lista blanca y no lista negra: un filtro se escribe
 * `{ activa: "is.true" }` y el operador viaja en el valor, así que sin esto un valor mal armado se convertiría
 * en una consulta distinta de la que quien llama creyó escribir. */
const _OPERADORES = new Set(["eq", "neq", "gt", "gte", "lt", "lte", "is", "in", "like", "ilike"]);

const _transportePorDefecto = (...a) => globalThis.fetch(...a);

function _validarFiltros(filtros) {
  for (const [col, expr] of Object.entries(filtros || {})) {
    if (!_IDENT.test(col)) return `filtro con columna inválida: ${col}`;
    const op = String(expr).split(".")[0];
    if (!_OPERADORES.has(op)) return `filtro con operador no admitido: ${op}`;
  }
  return null;
}

/* crearClienteRest({ url, apikey, transporte, timeoutMs }) → { seleccionar, insertar, actualizar }
 * `transporte` se inyecta para poder ejercerlo con un doble en el candado, sin red y sin proyecto creado. */
export function crearClienteRest({ url, apikey, transporte = _transportePorDefecto, timeoutMs = 8000 } = {}) {
  const base = String(url || "").replace(/\/+$/, "");
  if (!base) throw new Error("crearClienteRest: falta la URL del proyecto");

  // ⚠️ EL CERROJO. La llave de servicio se salta RLS entera; mandarla acá —por copiar una variable de más, que
  // es como pasa de verdad— dejaría el muro de adorno sin que nada fallara. Se rechaza al construir el cliente
  // y no en cada llamada: así el error aparece al arrancar, no en la consulta desafortunada.
  if (esCredencialDeServicio(apikey)) {
    throw new Error("crearClienteRest: la llave de servicio se salta RLS y no puede usarse acá — es solo para migrar y sembrar");
  }

  async function _pedir(metodo, ruta, { pase, cuerpo, cuerpoCrudo, prefer, contentType } = {}) {
    if (!pase) return { ok: false, motivo: "sin pase: no se consulta la base sin declarar de qué empresa es" };
    if (esCredencialDeServicio(pase)) {
      return { ok: false, motivo: "el pase no puede ser la llave de servicio" };
    }

    const cabeceras = {
      apikey: String(apikey || ""),
      Authorization: `Bearer ${pase}`,
      Accept: "application/json",
    };
    if (cuerpo !== undefined) cabeceras["Content-Type"] = "application/json";
    if (cuerpoCrudo !== undefined) cabeceras["Content-Type"] = contentType || "application/octet-stream";
    if (prefer) cabeceras.Prefer = prefer;

    // Un corte propio: sin esto, una base lenta cuelga el endpoint y el usuario ve la app en blanco sin
    // explicación. Con corte, ve «no se pudo leer» y la razón.
    const corte = new AbortController();
    const reloj = setTimeout(() => corte.abort(), timeoutMs);
    try {
      const r = await transporte(`${base}${ruta}`, {
        method: metodo,
        headers: cabeceras,
        body: cuerpoCrudo !== undefined ? cuerpoCrudo : (cuerpo === undefined ? undefined : JSON.stringify(cuerpo)),
        signal: corte.signal,
      });
      const texto = await r.text();
      if (!r.ok) {
        // El detalle de PostgREST se pasa tal cual: diagnosticar una política sin el mensaje de la base es
        // adivinar. No lleva dato del cliente, solo el motivo del rechazo.
        return { ok: false, motivo: `la base respondió ${r.status}`, estado: r.status, detalle: texto.slice(0, 400) };
      }
      let filas = [];
      if (texto) { try { filas = JSON.parse(texto); } catch { return { ok: false, motivo: "la base respondió algo que no es JSON" }; } }
      return { ok: true, filas: Array.isArray(filas) ? filas : [filas] };
    } catch (e) {
      const abortado = e && (e.name === "AbortError" || e.name === "TimeoutError");
      return { ok: false, motivo: abortado ? `la base no respondió en ${timeoutMs} ms` : "no se pudo hablar con la base" };
    } finally {
      clearTimeout(reloj);
    }
  }

  function _consulta(tabla, { filtros = {}, columnas = "*", orden, limite } = {}) {
    if (!_IDENT.test(String(tabla))) return { error: `tabla inválida: ${tabla}` };
    const malo = _validarFiltros(filtros);
    if (malo) return { error: malo };

    const q = new URLSearchParams();
    q.set("select", String(columnas));
    for (const [col, expr] of Object.entries(filtros)) q.set(col, String(expr));
    if (orden) q.set("order", String(orden));
    if (limite) q.set("limit", String(Math.max(1, Math.floor(limite))));
    return { ruta: `/rest/v1/${tabla}?${q.toString()}` };
  }

  return {
    /** seleccionar("fact_pack_versions", { pase, filtros:{ tenant_id:"eq.demo", activa:"is.true" } }) */
    async seleccionar(tabla, opciones = {}) {
      const { ruta, error } = _consulta(tabla, opciones);
      if (error) return { ok: false, motivo: error };
      return _pedir("GET", ruta, { pase: opciones.pase });
    },

    /** insertar("uploads", { pase, filas:[{…}], devolver:true }) */
    async insertar(tabla, { pase, filas, devolver = false } = {}) {
      if (!_IDENT.test(String(tabla))) return { ok: false, motivo: `tabla inválida: ${tabla}` };
      const lote = Array.isArray(filas) ? filas : [filas];
      if (!lote.length) return { ok: false, motivo: "no hay filas que insertar" };
      return _pedir("POST", `/rest/v1/${tabla}`, {
        pase,
        cuerpo: lote,
        prefer: devolver ? "return=representation" : "return=minimal",
      });
    },

    /** actualizar("fact_pack_versions", { pase, filtros:{ id:"eq.…" }, cambios:{ activa:true } })
     *  ⚠️ Sin filtros no se actualiza: un PATCH sin `where` en PostgREST toca TODA la tabla que el pase
     *  alcance. La política de RLS lo acotaría a la empresa, pero pisar todas las versiones de esa empresa
     *  ya sería el desastre — el muro no protege de un error de alcance dentro de la propia empresa. */
    async actualizar(tabla, { pase, filtros, cambios, devolver = false } = {}) {
      if (!_IDENT.test(String(tabla))) return { ok: false, motivo: `tabla inválida: ${tabla}` };
      if (!filtros || !Object.keys(filtros).length) return { ok: false, motivo: "actualizar sin filtros afectaría toda la tabla" };
      if (!cambios || !Object.keys(cambios).length) return { ok: false, motivo: "no hay cambios que aplicar" };
      const { ruta, error } = _consulta(tabla, { filtros, columnas: "*" });
      if (error) return { ok: false, motivo: error };
      return _pedir("PATCH", ruta, {
        pase,
        cuerpo: cambios,
        prefer: devolver ? "return=representation" : "return=minimal",
      });
    },

    /* llamarFuncion("adi_activar_version", { p_version_id: "…" }, { pase }) → ejecuta una función de la base.
     *
     * POR QUÉ HACE FALTA: hay operaciones que son VARIAS escrituras y tienen que pasar juntas o no pasar —
     * cambiar de versión activa es la primera. Partida en dos llamadas, entre una y otra la empresa no tiene
     * ninguna versión activa, y si la segunda falla eso queda así. Adentro de una función es una transacción.
     * Las funciones corren con los permisos de quien llama, así que RLS sigue aplicándose. */
    async llamarFuncion(nombre, argumentos = {}, { pase } = {}) {
      if (!_IDENT.test(String(nombre))) return { ok: false, motivo: `función inválida: ${nombre}` };
      return _pedir("POST", `/rest/v1/rpc/${nombre}`, { pase, cuerpo: argumentos });
    },

    /* subirObjeto("adi-originales", "demo/abc.xlsx", bytes, { pase }) → guarda el archivo tal como llegó.
     *
     * ⚠️ LA RUTA ES EL CONTROL DE ACCESO, NO UNA CONVENCIÓN DE ORDEN. La política del depósito compara la
     * PRIMERA CARPETA del nombre contra la empresa del pase (`002_storage_originales.sql`), así que una ruta
     * sin esa forma no es un archivo mal ordenado: es un archivo fuera del alcance de la política. Por eso se
     * valida la forma acá y se rechaza antes de salir, en vez de dejar que la base decida. */
    async subirObjeto(bucket, ruta, bytes, { pase, contentType, sobrescribir = false } = {}) {
      if (!/^[a-z0-9][a-z0-9-]*$/.test(String(bucket))) return { ok: false, motivo: `depósito inválido: ${bucket}` };
      if (!/^[a-z0-9][a-z0-9_-]{0,31}\/[A-Za-z0-9._-]{1,100}$/.test(String(ruta))) {
        return { ok: false, motivo: `la ruta tiene que ser {empresa}/{archivo}: ${ruta}` };
      }
      if (bytes === undefined || bytes === null) return { ok: false, motivo: "no hay bytes que subir" };
      return _pedir(sobrescribir ? "PUT" : "POST", `/storage/v1/object/${bucket}/${ruta}`, {
        pase, cuerpoCrudo: bytes, contentType,
      });
    },
  };
}

/* clienteDesdeEntorno(env) → cliente | null
 * ⚠️ DEVOLVER `null` ES LA BANDERA. Sin `SUPABASE_URL` y `SUPABASE_ANON_KEY` no hay base, quien llama sigue
 * con el camino de hoy y nada cambia en producción. No hay un valor por defecto ni una URL de respaldo: un
 * respaldo silencioso acá sería servir o guardar datos en un lugar que nadie eligió.
 *
 * `SUPABASE_ANON_KEY` es pública por diseño (viaja en cualquier app de Supabase); igual va en las variables de
 * Vercel y **nunca con prefijo `VITE_`**, que la hornearía en el paquete del navegador. */
export function clienteDesdeEntorno(env, extra = {}) {
  const e = env || (typeof process !== "undefined" && process.env) || {};
  const url = e.SUPABASE_URL || "";
  const apikey = e.SUPABASE_ANON_KEY || "";
  if (!url || !apikey) return null;
  return crearClienteRest({ url, apikey, ...extra });
}

/** ¿Está la base configurada en este entorno? Para que quien llama pueda decirlo sin construir el cliente. */
export const baseConfigurada = (env) => {
  const e = env || (typeof process !== "undefined" && process.env) || {};
  return Boolean(e.SUPABASE_URL && e.SUPABASE_ANON_KEY);
};
