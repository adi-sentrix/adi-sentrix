/* === src/adi/continuidad/almacenSupabase.js · EL ALMACÉN SOBRE SUPABASE (Etapa 2 · escrito, SIN USAR) ═════════
 * ⚠️ ESTE ARCHIVO NO SE IMPORTA DESDE NINGÚN GATE NI DESDE `_continuidad_gate.mjs`. La migración 015
 * (`db/migraciones/015_memoria_empresa_y_conversacion.sql`) que este adaptador asume está ESCRITA, NO APLICADA
 * contra ningún proyecto de Supabase — igual que 012/013/014 (regla del repo: aplicar una migración es un paso
 * de despliegue que exige la palabra del owner). Este módulo queda listo para el día en que el supervisor
 * conecte `continuidad/` a `entrega/componer.js` y a la puerta del Complemento, siguiendo EXACTAMENTE el patrón
 * de `data/supabaseRest.js` («el cliente de la base, escrito a mano», sin el SDK, para no romper el runtime
 * edge) — un envoltorio delgado sobre las funciones RPC que la 015 define, con el mismo contrato `{ok, …}` que
 * el resto del repo (nunca una excepción que el llamador tenga que adivinar).
 *
 * SEGURIDAD: cero lógica de aislamiento acá — la hace la base (RLS + `security definer` acotado por
 * `adi.tenant_actual()`, migración 015). Este archivo solo garantiza no mandar la llave de servicio
 * (`crearClienteRest` ya lo rechaza) y traducir `{ok:false, motivo}` de PostgREST al mismo contrato que
 * `almacen.js` espera de un almacén.
 *
 * `pase` (el JWT del tenant) viaja en CADA llamada porque `crearClienteRest` no lo guarda: es responsabilidad
 * de quien arma este almacén (la puerta / el endpoint) pasarlo en cada `{pase}` — igual que ya hace
 * `tenantService.server.js` con el resto de las funciones RPC. */
import { crearClienteRest } from "../../data/supabaseRest.js";

/** crearAlmacenSupabase({url, apikey, pase, transporte?}) → Almacen (la misma forma que `almacen.js`)
 * `pase` es el JWT vigente de la empresa (RLS se evalúa contra él, nunca contra un tenantId que mande el
 * cliente) — se fija UNA vez al crear el almacén porque una sesión de la puerta/endpoint vive con un solo pase
 * por request; si algún día una sola instancia debe atender pases distintos, se le pasa `pase` por llamada en
 * vez de al construir (cambio menor, no tomado acá para no anticipar una necesidad que no existe todavía). */
export function crearAlmacenSupabase({ url, apikey, pase, transporte } = {}) {
  const cliente = crearClienteRest({ url, apikey, transporte });

  return {
    /* memoria de empresa — RLS te la aísla por `adi.tenant_actual()`; `tenantId` NO viaja como filtro: es
     * ilustrativo de la interfaz (así `empresa.js` no distingue si el almacén es local o remoto), pero contra
     * Supabase el aislamiento real lo da el pase, no este parámetro. */
    async leerHechosEmpresa(_tenantId) {
      const r = await cliente.llamarFuncion("adi_leer_memoria_empresa", {}, { pase });
      if (!r.ok) return [];
      return (r.filas || []).map(_filaAHecho);
    },
    async guardarHechoEmpresa(_tenantId, hecho) {
      const r = await cliente.llamarFuncion("adi_aportar_hecho_empresa", {
        p_clase: hecho.clase, p_concepto: hecho.concepto, p_eje: hecho.eje || null, p_entidad: hecho.entidad || null,
        p_periodo: hecho.periodo || null, p_valor: hecho.valor || null, p_origen: hecho.origen,
        p_documento: hecho.documento || null, p_estado: hecho.estado || "vigente", p_reemplaza: hecho.reemplaza || null,
        p_conversacion_id: hecho.conversacionId || null, p_actor_label: hecho.actorLabel || null,
      }, { pase });
      if (!r.ok || !r.filas || !r.filas[0]) throw new Error(`guardarHechoEmpresa: ${r.motivo || "la base no devolvió la fila"}`);
      return _filaAHecho(r.filas[0]);
    },
    async actualizarHechoEmpresa(_tenantId, id, cambios) {
      if (cambios && cambios.estado === "retirado") {
        const r = await cliente.llamarFuncion("adi_retirar_hecho_empresa", { p_id: id, p_motivo: cambios.retiradoMotivo || null, p_actor_label: cambios.retiradoPor || null }, { pase });
        return r.ok && r.filas && r.filas[0] ? _filaAHecho(r.filas[0]) : null;
      }
      const r = await cliente.llamarFuncion("adi_confirmar_hecho_empresa", {
        p_id: id, p_confirmacion: cambios && cambios.confirmacion ? cambios.confirmacion : null,
        p_estado: cambios && cambios.estado ? cambios.estado : null, p_reemplaza: cambios && cambios.reemplaza ? cambios.reemplaza : null,
      }, { pase });
      return r.ok && r.filas && r.filas[0] ? _filaAHecho(r.filas[0]) : null;
    },

    /* libro de conversación — columna `estado` de `conversaciones` (009 + 015), NUNCA una tabla nueva. */
    async leerLibro(conversacionId) {
      const r = await cliente.llamarFuncion("adi_leer_estado_conversacion", { p_hilo_id: conversacionId }, { pase });
      if (!r.ok || !r.filas || !r.filas[0] || r.filas[0].estado == null) return null;
      return r.filas[0].estado;
    },
    async guardarLibro(libro) {
      const r = await cliente.llamarFuncion("adi_guardar_estado_conversacion", { p_hilo_id: libro.conversacionId, p_estado: libro }, { pase });
      if (!r.ok) throw new Error(`guardarLibro: ${r.motivo || "la base no confirmó el guardado"}`);
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
