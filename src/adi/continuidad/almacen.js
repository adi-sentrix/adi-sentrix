/* === src/adi/continuidad/almacen.js · LA INTERFAZ DE ALMACENAMIENTO, INYECTABLE Y ASÍNCRONA (Etapa 2 · owner 2026-09-25/26) ===
 * «Una sola realidad canónica de empresa» (REVISIÓN 3 §2 de `_ADI_DISENO_FLUJO_V2.md`): los módulos de
 * `continuidad/` (`empresa.js`, `libro.js`) NUNCA tocan I/O directamente — reciben un ALMACÉN por parámetro,
 * el mismo patrón que ya usa el resto del repo para separar cálculo de transporte (`data/supabaseRest.js` para
 * la base, `oracle/toolRunner.js` para las herramientas). Así el candado offline (`_continuidad_gate.mjs`)
 * ejercita la lógica real con el adaptador EN MEMORIA de más abajo, sin abrir una conexión, y el adaptador de
 * Supabase (`almacenSupabase.js`, NUNCA importado por un gate: el candado `_guardado_durable_gate.mjs` lo ejerce
 * con un doble de la base, sin red) sirve la MISMA forma cuando el owner autorice aplicar la migración 015.
 *
 * ═══ UNA SOLA INTERFAZ, Y ES ASÍNCRONA (Etapa 2, bloque 1 · guardado durable) ═══════════════════════════════════
 * Antes, este adaptador en memoria era SÍNCRONO y el de Supabase era ASÍNCRONO, y los consumidores
 * (`empresa.js`, `acciones.js`) se escribieron para el síncrono: enchufar el de Supabase revienta
 * (`.filter is not a function`, `leerLibro` devolvía una promesa sin esperar). La nota que decía «ninguna línea
 * de este archivo cambia» era falsa. Ahora TODO método de lectura y escritura de un almacén devuelve una
 * PROMESA — también el de memoria — y TODO consumidor hace `await`. `await` sobre un valor que no es promesa es
 * inocuo, así que un almacén síncrono de un doble antiguo no rompe a un consumidor nuevo; lo que sí rompe es lo
 * inverso (un consumidor síncrono contra un almacén asíncrono), y por eso el adaptador en memoria también es
 * asíncrono: un consumidor que se olvide de esperar falla acá, con la memoria, y no solo contra la base real.
 *
 * LA FORMA QUE TODO ALMACÉN TIENE QUE CUMPLIR (contrato, no una clase — cualquier objeto con estas funciones sirve):
 *
 *   // memoria de empresa (tabla `memoria_empresa` de la migración 015)
 *   async leerHechosEmpresa(tenantId) -> HechoEmpresa[]
 *     Todos los hechos de la empresa, VIGENTES y de HISTORIA (retirados/omitidos incluidos) — el filtrado por
 *     estado lo hace `empresa.js`, no el almacén: un almacén que ya filtrara no podría servir `leerHistoria`.
 *   async guardarHechoEmpresa(tenantId, hecho) -> HechoEmpresa
 *     Inserta SIEMPRE una fila nueva (append-only, como `access_audit`): un "reemplazo" es una fila nueva con
 *     `reemplaza: idViejo` más la actualización del estado de la fila vieja — nunca un UPDATE del valor.
 *   async actualizarHechoEmpresa(tenantId, id, cambios) -> HechoEmpresa | null
 *     El ÚNICO uso legítimo es tocar `estado` y `confirmacion` (nunca `valor`, `concepto` ni `origen`: la ley
 *     del owner, «la confirmación no cambia el origen», y la ley general, «nunca se reemplaza en silencio»,
 *     hacen que el VALOR de un hecho sea inmutable una vez guardado). `null` = ese hecho no existe.
 *
 *   // libro de conversación (columna `estado jsonb` de `conversaciones`, migración 015 — NO una tabla nueva,
 *   // ley del owner: «el libro de conversación va como estado en la tabla conversaciones de la migración 009»)
 *   async leerLibro(tenantId, conversacionId) -> Libro | null   // `null` = esa conversación NO existe PARA ESA EMPRESA
 *   async guardarLibro(tenantId, libro) -> Libro                // upsert por (empresa, `libro.conversacionId`)
 *     `tenantId` va primero, igual que en los hechos: en memoria es la llave de aislamiento (una empresa que
 *     presente el conversacionId de OTRA no lo encuentra — antes el Map se indexaba solo por conversación y el
 *     id ajeno abría el libro ajeno); contra Supabase es ilustrativo y el aislamiento real lo da el pase (RLS).
 *
 *   // generador de ids del almacén (no es I/O: es síncrono a propósito)
 *   nuevoIdHecho() -> string | null
 *
 * ═══ EL CONTRATO DE FALLA (el que faltaba, y es el que protege lo durable) ═════════════════════════════════════
 * «No existe» y «no se pudo leer» son DOS cosas distintas y NUNCA se confunden:
 *   · una lectura que no encuentra la fila devuelve `null` (libro) o `[]` (hechos);
 *   · una lectura que NO PUDO hablar con la base LANZA `ErrorDeAlmacen`.
 * Si el adaptador contestara `null`/`[]` ante un error de red, `aportarContexto` abriría «un libro nuevo» con el
 * MISMO id de la conversación que no pudo leer y lo guardaría encima del real: perdería la conversación entera
 * por una falla transitoria. Cada acción de `capacidad/acciones.js` atrapa `ErrorDeAlmacen` y responde
 * `{ok:false, memoria:"no_disponible"}` — falla cerrado, nunca un olvido silencioso.
 *
 * Puro en el sentido de que NINGÚN módulo de `continuidad/` importa esto para usarlo por su cuenta: cada
 * función de `empresa.js`/`libro.js`/`retomar.js` recibe el almacén como primer o segundo parámetro. */

import { formaDeFilaDeMemoria } from "./empresa.js";
import { comprimirLibro, expandirLibro } from "./libro.js";

/** Un almacén que no pudo leer o escribir (la base no respondió, rechazó el pase, la función no existe porque la
 * migración no corrió). No lleva dato del cliente: solo la operación y el motivo de la base. */
export class ErrorDeAlmacen extends Error {
  constructor(operacion, motivo, { estado = null } = {}) {
    super(`almacén · ${operacion}: ${motivo}`);
    this.name = "ErrorDeAlmacen";
    this.operacion = operacion;
    this.motivo = motivo;
    this.estado = estado;
  }
}
export const esErrorDeAlmacen = (e) => Boolean(e) && e.name === "ErrorDeAlmacen";

/** Los seis métodos de I/O + el generador de ids. Un almacén al que le falte uno no es un almacén. */
export const METODOS_DE_ALMACEN = ["leerHechosEmpresa", "guardarHechoEmpresa", "actualizarHechoEmpresa", "leerLibro", "guardarLibro", "nuevoIdHecho"];

/** verificarAlmacen(store) → { ok, faltan } · la forma, no el comportamiento (el comportamiento lo prueba el gate). */
export function verificarAlmacen(store) {
  const faltan = METODOS_DE_ALMACEN.filter((m) => !store || typeof store[m] !== "function");
  return { ok: faltan.length === 0, faltan };
}

/** crearAlmacenEnMemoria() → Almacen · para los gates y para cualquier demo sin base configurada.
 * Cada tenant tiene su propia lista de hechos (aislamiento por clave del Map, no por RLS — acá no hay muro que
 * probar, la seguridad real vive en la migración 015 y en `almacenSupabase.js`). Devuelve SIEMPRE copias: nadie
 * que reciba una fila puede mutar el almacén por accidente compartiendo la misma referencia.
 *
 * ASÍNCRONO A PROPÓSITO (ver la cabecera): cada método es `async`, así que un consumidor que lo use como si fuera
 * síncrono ve una promesa donde esperaba un arreglo y falla en el acto — el mismo defecto que antes solo
 * aparecía contra Supabase. */
/* `sinMuroDeForma` existe SOLO para los candados de falla cerrada: deja guardar una fila que la base rechazaría (una de
 * clase «perfil» con un origen que no es «declarado», un hecho con el concepto de un campo de perfil), para probar que
 * los lectores la IGNORAN aunque algún día llegara. Por omisión el almacén en memoria repite los checks de forma de
 * la 015 (`empresa.js:formaDeFilaDeMemoria`): probar contra la memoria vale contra la base. */
export function crearAlmacenEnMemoria({ sinMuroDeForma = false } = {}) {
  const hechosPorTenant = new Map();
  const librosPorConversacion = new Map();
  let contadorId = 0;

  const _clon = (x) => (x == null ? x : JSON.parse(JSON.stringify(x)));
  const _claveLibro = (tenantId, conversacionId) => JSON.stringify([String(tenantId == null ? "" : tenantId), String(conversacionId)]);

  return {
    async leerHechosEmpresa(tenantId) {
      return (hechosPorTenant.get(tenantId) || []).map(_clon);
    },
    async guardarHechoEmpresa(tenantId, hecho) {
      if (!sinMuroDeForma) {
        const forma = formaDeFilaDeMemoria(hecho);
        if (!forma.ok) throw new ErrorDeAlmacen("guardarHechoEmpresa", forma.motivo);
      }
      const arr = hechosPorTenant.get(tenantId) || [];
      const copia = _clon(hecho);
      arr.push(copia);
      hechosPorTenant.set(tenantId, arr);
      return _clon(copia);
    },
    async actualizarHechoEmpresa(tenantId, id, cambios) {
      const arr = hechosPorTenant.get(tenantId) || [];
      const h = arr.find((x) => x.id === id);
      if (!h) return null;
      Object.assign(h, _clon(cambios));
      return _clon(h);
    },
    async leerLibro(tenantId, conversacionId) {
      const L = librosPorConversacion.get(_claveLibro(tenantId, conversacionId));
      return L ? expandirLibro(_clon(L)) : null;   /* el libro se GUARDA en su forma compacta (`libro.js:comprimirLibro`, sin pérdida) y se LEE como siempre */
    },
    async guardarLibro(tenantId, libro) {
      if (!libro || !libro.conversacionId) throw new Error("guardarLibro: falta conversacionId");
      librosPorConversacion.set(_claveLibro(tenantId, libro.conversacionId), _clon(comprimirLibro(libro)));
      return _clon(libro);
    },
    /* generador de ids del ALMACÉN (no del hecho de negocio ni de la conversación, que emite `libro.js`):
     * sirve para que `empresa.js` no tenga que saber si el id final es un uuid de Postgres o una clave local.
     * No es I/O: queda síncrono. */
    nuevoIdHecho() {
      contadorId += 1;
      return `mem-h${contadorId}`;
    },
  };
}
