/* === src/adi/continuidad/almacenSupabase.js · EL ALMACÉN SOBRE SUPABASE (Etapa 2 · bloque 1 «guardado durable») ═
 * ⚠️ ESTE ARCHIVO NO SE IMPORTA DESDE NINGÚN GATE NI DESDE `_continuidad_gate.mjs`; lo ejerce
 * `_guardado_durable_gate.mjs` a través de un DOBLE de la base (`scripts/doble-supabase-continuidad.mjs`, sin red).
 * La migración 015 (`db/migraciones/015_memoria_empresa_y_conversacion.sql`) que este adaptador asume está
 * ESCRITA, NO APLICADA contra ningún proyecto de Supabase — igual que 012/013/014 (regla del repo: aplicar una
 * migración es un paso de despliegue que exige la palabra del owner). Sigue EXACTAMENTE el patrón de
 * `data/supabaseRest.js` («el cliente de la base, escrito a mano», sin el SDK, para no romper el runtime edge) —
 * un envoltorio delgado sobre las funciones RPC que la 015 define.
 *
 * LA MISMA INTERFAZ QUE LA MEMORIA (`almacen.js`), ASÍNCRONA: cada método devuelve una promesa y el consumidor
 * hace `await` — el defecto D1 de la Etapa 2 era que este archivo era asíncrono y quien lo usaba, síncrono.
 *
 * EL CONTRATO DE FALLA (lo que protege lo durable): una lectura que NO PUDO hablar con la base LANZA
 * `ErrorDeAlmacen`; solo «la fila no existe» devuelve `null`/`[]`. Antes, `leerHechosEmpresa` y `leerLibro`
 * respondían `[]`/`null` ante CUALQUIER error, y `aportarContexto` abría «un libro nuevo» con el mismo id y lo
 * guardaba encima del real: una falla transitoria de red borraba una conversación. Ahora la acción atrapa el error
 * y responde «memoria no disponible» — nunca un olvido silencioso.
 *
 * SEGURIDAD: cero lógica de aislamiento acá — la hace la base (RLS + `security definer` acotado por
 * `adi.tenant_actual()`, migración 015). Este archivo solo garantiza no mandar la llave de servicio
 * (`crearClienteRest` ya lo rechaza) y traducir `{ok:false, motivo}` de PostgREST a `ErrorDeAlmacen`. El
 * `tenantId` que reciben los métodos es ilustrativo de la interfaz (para que `empresa.js` no distinga si el
 * almacén es local o remoto): contra Supabase el aislamiento real lo da el PASE, no ese parámetro.
 *
 * `pase` (el JWT del tenant) se fija UNA vez al crear el almacén, y por eso el almacén es POR PEDIDO: la puerta
 * (`capacidad/puerta.js`) arma uno con el pase de la empresa de ESA llamada. Compartir un almacén Supabase entre
 * empresas sería compartir el pase de la primera — nunca se hace. */
import { crearClienteRest } from "../../data/supabaseRest.js";
import { ErrorDeAlmacen } from "./almacen.js";
import { VERSION_LIBRO, comprimirLibro, expandirLibro } from "./libro.js";

/* el motivo corto y SIN dato del cliente que viaja en el error: qué dijo la base, no qué se le preguntó. */
const _motivoDe = (r) => `${r.motivo || "la base no respondió"}${r.detalle ? ` · ${String(r.detalle).replace(/\s+/g, " ").slice(0, 160)}` : ""}`;

/** crearAlmacenSupabase({url, apikey, pase, transporte?}) → Almacen (la misma forma que `almacen.js`, asíncrona)
 * `pase` es el JWT vigente de la empresa (RLS se evalúa contra él, nunca contra un tenantId que mande el
 * cliente). `transporte` se inyecta SOLO para ejercerlo con un doble en el candado, igual que `crearClienteRest`. */
export function crearAlmacenSupabase({ url, apikey, pase, transporte } = {}) {
  const cliente = crearClienteRest({ url, apikey, ...(transporte ? { transporte } : {}) });

  return {
    /* memoria de empresa — RLS te la aísla por `adi.tenant_actual()` */
    async leerHechosEmpresa(_tenantId) {
      const r = await cliente.llamarFuncion("adi_leer_memoria_empresa", {}, { pase });
      if (!r.ok) throw new ErrorDeAlmacen("leerHechosEmpresa", _motivoDe(r), { estado: r.estado || null });
      return (r.filas || []).map(_filaAHecho);
    },
    async guardarHechoEmpresa(_tenantId, hecho) {
      /* ⚠️ `p_reemplaza` en la función SQL RETIRA la fila vieja en el acto (015, `adi_aportar_hecho_empresa`). La ley
       * es otra: un aporte NACE «pendiente» y el retiro de lo ya confirmado ocurre RECIÉN al confirmar
       * (`empresa.js:confirmarHecho` → `adi_confirmar_hecho_empresa(p_reemplaza)`). Mandarlo con un pendiente dejaría
       * a la empresa SIN el valor que la persona sí confirmó, hasta que confirme el nuevo: proponer pisaría a
       * confirmar. Por eso un pendiente viaja sin `p_reemplaza` (el vínculo se escribe al confirmar). */
      const reemplazaYa = hecho.estado === "pendiente" ? null : (hecho.reemplaza || null);
      const r = await cliente.llamarFuncion("adi_aportar_hecho_empresa", {
        p_clase: hecho.clase, p_concepto: hecho.concepto, p_eje: hecho.eje || null, p_entidad: hecho.entidad || null,
        p_periodo: hecho.periodo || null, p_valor: hecho.valor || null, p_origen: hecho.origen,
        p_documento: hecho.documento || null, p_estado: hecho.estado || "vigente", p_reemplaza: reemplazaYa,
        p_conversacion_id: hecho.conversacionId || null, p_actor_label: hecho.actorLabel || null, p_actor_rol: null,
      }, { pase });
      if (!r.ok) throw new ErrorDeAlmacen("guardarHechoEmpresa", _motivoDe(r), { estado: r.estado || null });
      if (!r.filas || !r.filas[0]) throw new ErrorDeAlmacen("guardarHechoEmpresa", "la base no devolvió la fila guardada");
      return _filaAHecho(r.filas[0]);
    },
    async actualizarHechoEmpresa(_tenantId, id, cambios) {
      /* siempre el CONJUNTO COMPLETO de argumentos nombrados de la función: PostgREST resuelve por nombre, y mandar el
       * conjunto exacto no depende de cómo trate los argumentos con valor por defecto. */
      let r;
      if (cambios && cambios.estado === "retirado") {
        r = await cliente.llamarFuncion("adi_retirar_hecho_empresa", { p_id: id, p_motivo: cambios.retiradoMotivo || null, p_actor_label: cambios.retiradoPor || null, p_actor_rol: null }, { pase });
      } else {
        r = await cliente.llamarFuncion("adi_confirmar_hecho_empresa", {
          p_id: id, p_confirmacion: cambios && cambios.confirmacion ? cambios.confirmacion : null,
          p_estado: cambios && cambios.estado ? cambios.estado : null, p_reemplaza: cambios && cambios.reemplaza ? cambios.reemplaza : null,
          p_actor_label: (cambios && cambios.confirmacion && cambios.confirmacion.por) || null, p_actor_rol: null,
        }, { pase });
      }
      // un error de la base NO es «ese hecho no existe»: lanzar. Solo «la base contestó y no hay fila» es `null`.
      if (!r.ok) throw new ErrorDeAlmacen("actualizarHechoEmpresa", _motivoDe(r), { estado: r.estado || null });
      return r.filas && r.filas[0] ? _filaAHecho(r.filas[0]) : null;
    },

    /* libro de conversación — columna `estado` de `conversaciones` (009 + 015), NUNCA una tabla nueva. */
    async leerLibro(_tenantId, conversacionId) {
      const r = await cliente.llamarFuncion("adi_leer_estado_conversacion", { p_hilo_id: conversacionId }, { pase });
      if (!r.ok) throw new ErrorDeAlmacen("leerLibro", _motivoDe(r), { estado: r.estado || null });
      const estado = r.filas && r.filas[0] ? r.filas[0].estado : null;
      // una fila de `conversaciones` sin libro (estado `{}`: un hilo de la app) NO es un libro — es «no existe».
      if (!estado || typeof estado !== "object" || estado.version !== VERSION_LIBRO || estado.conversacionId !== conversacionId) return null;
      return expandirLibro(estado);   /* la base guarda la forma compacta (`libro.js:comprimirLibro`, sin pérdida) y acá se lee como siempre */
    },
    async guardarLibro(_tenantId, libro) {
      const r = await cliente.llamarFuncion("adi_guardar_estado_conversacion", { p_hilo_id: libro.conversacionId, p_estado: comprimirLibro(libro), p_actor_id: null, p_actor_label: null, p_actor_rol: null }, { pase });
      if (!r.ok) throw new ErrorDeAlmacen("guardarLibro", _motivoDe(r), { estado: r.estado || null });
      return libro;
    },
    nuevoIdHecho() { return null; }, // la base emite el id (uuid) al insertar — este almacén nunca lo inventa
  };
}

/* la fila cruda de PostgREST → la forma `HechoEmpresa` que `empresa.js` espera (mismos nombres que `almacen.js`). */
function _filaAHecho(f) {
  return {
    id: f.id, clase: f.clase, concepto: f.concepto, eje: f.eje, entidad: f.entidad, periodo: f.periodo,
    valor: f.valor, origen: f.origen, documento: f.documento, confirmacion: f.confirmacion, estado: f.estado,
    declaradoEn: f.declarado_en, actorLabel: f.actor_label, conversacionId: f.conversacion_id, reemplaza: f.reemplaza,
  };
}
