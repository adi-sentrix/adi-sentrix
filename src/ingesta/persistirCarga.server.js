/* === ingesta/persistirCarga.server.js · DONDE EL DATO DEL CLIENTE DEJA DE SER UNA VARIABLE (vía 3 · 3.c) ====
 *
 * QUÉ RESUELVE. `handleIngesta` decía, textual, «NO PERSISTE NADA … sin base de datos todavía, guardar sería
 * inventar un lugar donde dejar el dato de un cliente». La base ya existe: este archivo es ese lugar.
 *
 * ⚠️ GUARDA INACTIVO, SIEMPRE. Subir un archivo no es adoptarlo. La versión nace con `activa = false` y solo la
 * pantalla, cuando el usuario confirma, la vuelve activa (paso 3.d). Es la misma decisión del owner que ya rige
 * la ingesta —«abre antes de analizar»— llevada a la base: cargar y adoptar son dos actos distintos, y el
 * segundo es del usuario.
 *
 * ⚠️ SIN SESIÓN VERIFICADA NO SE GUARDA NADA. Sin la puerta armada, la sesión cae a la empresa de demostración
 * —eso es correcto para MOSTRAR el negocio de ejemplo, y sería un desastre para GUARDAR: metería el archivo real
 * de un cliente adentro del demo. Así que acá el demo por defecto no alcanza: hace falta un código verificado
 * que diga de qué empresa es. Si no lo hay, se devuelve el resultado como siempre y no se persiste.
 *
 * EL ORDEN NO ES CASUAL: primero la fila de `uploads` (queda el rastro del archivo aunque después falle algo),
 * después el original al depósito, y al final la versión del pack. Si el pack no se puede guardar, queda un
 * upload en estado «recibido» que dice exactamente eso — un rastro honesto vale más que una limpieza silenciosa.
 *
 * GUARDAR EL ORIGINAL ES DESEABLE, NO IMPRESCINDIBLE. Si el depósito falla, la versión se guarda igual con
 * `storage_path` en nulo. El pack es autosuficiente por diseño (la fuente de cada cifra viaja adentro), así que
 * perder el archivo degrada la auditoría pero no invalida el dato. Frenar la carga entera por eso sería tratar
 * una copia de respaldo como si fuera el dato.
 *
 * CERO LLAMADAS AL MODELO. Todo el camino es determinístico.
 */
import { clienteDesdeEntorno } from "../data/supabaseRest.js";
import { emitirPase } from "../data/paseTenant.js";
import { confirmarSello } from "./plausibilidad.js";
import { monedaLimpia } from "../config/moneda.js";

const BUCKET = "adi-originales";
const TIPO_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** sha-256 en hexadecimal, con Web Crypto para no atarse a `node:crypto`.
 *  El hash NO bloquea nada: sirve para avisar «este archivo ya lo subiste» y para auditar. */
export async function hashSha256(bytes) {
  const vista = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const dig = await globalThis.crypto.subtle.digest("SHA-256", vista);
  return Array.from(new Uint8Array(dig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/* persistirCarga({...}) → { guardado, motivo?, uploadId?, versionId?, version?, hash?, original? }
 * `cliente` se puede inyectar para ejercer esto con un doble, sin red y sin proyecto creado. */
export async function persistirCarga({
  tenantId, bytes, nombreArchivo, dataset, sello, plantillaVersion,
  tipo = "negocio", env, cliente, ttlSegundos, hash: hashDado, actor = null,
} = {}) {
  if (!tenantId) return { guardado: false, motivo: "sin sesión con empresa: no se guarda" };
  if (!dataset) return { guardado: false, motivo: "no hay dataset que guardar" };

  const e = env || (typeof process !== "undefined" && process.env) || {};
  const db = cliente || clienteDesdeEntorno(e);
  if (!db) return { guardado: false, motivo: "base no configurada" };

  const secreto = e.SUPABASE_JWT_SECRET || "";
  const p = await emitirPase({ tenantId, secreto, ...(ttlSegundos ? { ttlSegundos } : {}) });
  if (!p.ok) return { guardado: false, motivo: `no se pudo emitir el pase: ${p.motivo}` };
  const pase = p.pase;

  // Se acepta el hash ya calculado: quien llama lo necesita antes, para poder avisar si el archivo se repite.
  const hash = hashDado || await hashSha256(bytes);

  // ── 1 · el rastro del archivo ────────────────────────────────────────────────────────────────────────
  const alta = await db.insertar("uploads", {
    pase, devolver: true,
    filas: {
      tenant_id: tenantId,
      tipo,
      nombre_archivo: String(nombreArchivo || "sin-nombre").slice(0, 200),
      hash_sha256: hash,
      bytes: bytes.length,
      estado: "recibido",
      /* QUIÉN · el `id` va nulo hasta que haya cuentas; la etiqueta sale del código firmado. */
      subido_por: (actor && actor.id) || null,
      subido_por_label: (actor && actor.label) || null,
      subido_por_rol: (actor && actor.rol) || null,
    },
  });
  if (!alta.ok || !alta.filas.length) {
    return { guardado: false, motivo: `no se pudo registrar la carga: ${alta.motivo || "la base no devolvió la fila"}`, hash };
  }
  const uploadId = alta.filas[0].id;

  // ── 2 · el original, si se puede ─────────────────────────────────────────────────────────────────────
  let original = null;
  const ruta = `${tenantId}/${uploadId}.xlsx`;
  const sub = await db.subirObjeto(BUCKET, ruta, bytes, { pase, contentType: TIPO_XLSX });
  if (sub.ok) {
    const marca = await db.actualizar("uploads", { pase, filtros: { id: `eq.${uploadId}` }, cambios: { storage_path: ruta } });
    original = marca.ok ? ruta : null;
  }

  // ── 3 · el número de versión ─────────────────────────────────────────────────────────────────────────
  /* ⚠️ ESTA CUENTA TIENE UNA CARRERA, Y LA GANA LA BASE. Dos cargas simultáneas de la misma empresa pueden leer
   * el mismo máximo; la que llegue segunda choca contra `unique (tenant_id, version)` y se rechaza con un
   * motivo, en vez de pisar la otra. Resolverlo acá con un candado sería reimplementar mal lo que Postgres ya
   * garantiza — y el caso real (una persona subiendo un archivo) no lo produce. */
  const ult = await db.seleccionar("fact_pack_versions", {
    pase, columnas: "version", filtros: { tenant_id: `eq.${tenantId}` }, orden: "version.desc", limite: 1,
  });
  if (!ult.ok) return { guardado: false, motivo: `no se pudo leer la última versión: ${ult.motivo}`, uploadId, hash };
  const version = (ult.filas.length ? Number(ult.filas[0].version) : 0) + 1;

  // ── 4 · la versión del pack · INACTIVA ───────────────────────────────────────────────────────────────
  /* El SELLO viaja adentro de la versión y no en `uploads`: califica las lecturas de ESTE pack, y si el usuario
   * asumió una observación eso tiene que volver con el pack al recargar la página. */
  const alt = await db.insertar("fact_pack_versions", {
    pase, devolver: true,
    filas: {
      tenant_id: tenantId,
      upload_id: uploadId,
      version,
      pack: dataset,
      sello: sello || null,
      plantilla_version: plantillaVersion || null,
      activa: false,
      creado_por: (actor && actor.id) || null,
      creado_por_label: (actor && actor.label) || null,
      creado_por_rol: (actor && actor.rol) || null,
    },
  });
  if (!alt.ok || !alt.filas.length) {
    return { guardado: false, motivo: `no se pudo guardar la versión: ${alt.motivo || "la base no devolvió la fila"}`, uploadId, hash, original };
  }

  await db.actualizar("uploads", { pase, filtros: { id: `eq.${uploadId}` }, cambios: { estado: "ingestado" } });

  return { guardado: true, uploadId, versionId: alt.filas[0].id, version, hash, original };
}

/* activarVersion({ tenantId, versionId, env, cliente }) → { activada, version? , motivo? }
 *
 * ⚠️ ES EL MOMENTO EN QUE EL CLIENTE ADOPTA SUS DATOS, y por eso pasan dos cosas a la vez: la versión queda
 * activa Y su sello pasa a confirmado. Separarlas dejaría una versión activa cuyo sello sigue diciendo que
 * nadie asumió las observaciones — la contradicción que el guardado evita al no confirmar de antemano.
 *
 * Las dos escrituras ocurren DENTRO de la base, en una función (`003_activar_version.sql`). No es una
 * preferencia de estilo: apagar la anterior y encender esta desde acá, en dos llamadas, deja un instante sin
 * ninguna versión activa —permanente si la segunda falla— y además choca contra el índice que impide dos
 * activas a la vez. La transacción es la única forma correcta.
 *
 * NO REDACTA EL SELLO: lo lee de la fila guardada y lo pasa por `confirmarSello`, que es la MISMA función que
 * redacta el sello de la lectura. Dos redacciones del mismo hallazgo son dos verdades. */
export async function activarVersion({ tenantId, versionId, moneda, actor = null, env, cliente, ttlSegundos } = {}) {
  if (!tenantId) return { activada: false, motivo: "sin sesión con empresa" };
  if (!versionId) return { activada: false, motivo: "no se dijo qué versión activar" };

  const e = env || (typeof process !== "undefined" && process.env) || {};
  const db = cliente || clienteDesdeEntorno(e);
  if (!db) return { activada: false, motivo: "base no configurada" };

  const p = await emitirPase({ tenantId, secreto: e.SUPABASE_JWT_SECRET || "", ...(ttlSegundos ? { ttlSegundos } : {}) });
  if (!p.ok) return { activada: false, motivo: `no se pudo emitir el pase: ${p.motivo}` };

  /* El sello guardado es el de la lectura, sin confirmar. Se lee para confirmarlo con la redacción de la casa,
   * en vez de aceptar el que mande el navegador: quien decide qué dice el sello es el servidor. */
  const previa = await db.seleccionar("fact_pack_versions", {
    pase: p.pase, columnas: "sello", filtros: { id: `eq.${versionId}` }, limite: 1,
  });
  if (!previa.ok) return { activada: false, motivo: `no se pudo leer la versión: ${previa.motivo}` };
  if (!previa.filas.length) return { activada: false, motivo: "esa versión no existe para esta empresa" };

  const sello = confirmarSello(previa.filas[0].sello);

  /* LA MONEDA se limpia acá y NO se completa: si el usuario no respondió y la planilla no la traía, viaja
   * nula y el pack queda como está. El pack sin moneda se rotula sin símbolo, que es lo honesto. */
  const monedaDeclarada = monedaLimpia(moneda);

  const r = await db.llamarFuncion("adi_activar_version",
    { p_version_id: versionId, p_sello: sello, p_moneda: monedaDeclarada,
      p_actor_id: (actor && actor.id) || null,
      p_actor_label: (actor && actor.label) || null,
      p_actor_rol: (actor && actor.rol) || null }, { pase: p.pase });
  if (!r.ok) return { activada: false, motivo: `no se pudo activar: ${r.motivo}` };
  if (!r.filas.length) return { activada: false, motivo: "la base no confirmó la activación" };

  return { activada: true, versionId, version: r.filas[0].version, sello, moneda: monedaDeclarada };
}

/* cargasPrevias({ tenantId, hash, env, cliente }) → { hubo, cuando } | { hubo:false }
 * Para poder avisar «este archivo ya lo subiste el 12 de agosto». NO bloquea: el hash no es único a propósito,
 * porque volver a subir el mismo archivo es algo que un cliente hace con razón. */
export async function cargasPrevias({ tenantId, hash, env, cliente, ttlSegundos } = {}) {
  if (!tenantId || !hash) return { hubo: false };
  const e = env || (typeof process !== "undefined" && process.env) || {};
  const db = cliente || clienteDesdeEntorno(e);
  if (!db) return { hubo: false };

  const p = await emitirPase({ tenantId, secreto: e.SUPABASE_JWT_SECRET || "", ...(ttlSegundos ? { ttlSegundos } : {}) });
  if (!p.ok) return { hubo: false };

  const r = await db.seleccionar("uploads", {
    pase: p.pase, columnas: "created_at", orden: "created_at.desc", limite: 1,
    filtros: { tenant_id: `eq.${tenantId}`, hash_sha256: `eq.${hash}` },
  });
  if (!r.ok || !r.filas.length) return { hubo: false };
  return { hubo: true, cuando: String(r.filas[0].created_at || "").slice(0, 10) };
}
