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
import { politicaLimpia } from "../config/politicaCobro.js";
import { fusionarHechos, alcanceDeHistoria, periodosDeHechos, periodoInformadoDe } from "./historico.js";
import { calcularDataset } from "./plantilla/motorKpi.js";

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
  tipo = "negocio", env, cliente, ttlSegundos, hash: hashDado, actor = null, hechos = null,
} = {}) {
  /* ⚠️ `sinBase` MARCA LOS DOS CASOS EN QUE NO GUARDAR ES LO CORRECTO —no hay empresa, no hay base— y los
   * separa de los FALLOS. Sin esa marca la pantalla los trataba a todos igual: activaba en memoria y le decía
   * al usuario que había quedado guardado. Una carga que se pierde en silencio es peor que una que se cae. */
  if (!tenantId) return { guardado: false, sinBase: true, motivo: "sin sesión con empresa: no se guarda" };
  if (!dataset) return { guardado: false, motivo: "no hay dataset que guardar" };

  const e = env || (typeof process !== "undefined" && process.env) || {};
  const db = cliente || clienteDesdeEntorno(e);
  if (!db) return { guardado: false, sinBase: true, motivo: "base no configurada" };

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
    pase, columnas: "version,pack", filtros: { tenant_id: `eq.${tenantId}` }, orden: "version.desc", limite: 1,
  });
  if (!ult.ok) return { guardado: false, motivo: `no se pudo leer la última versión: ${ult.motivo}`, uploadId, hash };
  const version = (ult.filas.length ? Number(ult.filas[0].version) : 0) + 1;

  /* ── 3b · LA POLÍTICA VIAJA A LA VERSIÓN NUEVA ────────────────────────────────────────────────────────
   * ⚠️ SIN ESTO, EL PLAZO DE PAGO SE PIERDE EN CADA CARGA MENSUAL. El pack se arma entero desde la planilla, y
   * la planilla no trae el plazo —justamente porque es política y no dato del período, que fue la decisión del
   * owner—. Así que la versión nueva nacería sin él: el usuario declara sus plazos una vez, sube el archivo del
   * mes siguiente y el saldo vencido vuelve a una raya sin que nadie haya cambiado nada.
   *
   * Es el defecto que hace parecer que el producto «se olvida». Se arrastra explícitamente, desde la última
   * versión hacia la nueva. La MONEDA no se arrastra acá a propósito: se pregunta al activar, y ahí se escribe
   * — arrastrarla también sería decidir dos veces la misma cosa en dos lugares.
   *
   * Si la planilla del mes trajera su propia política (hoy no puede), la de la planilla manda: lo que el
   * usuario acaba de subir gana sobre lo que había. */
  const packAnterior = ult.filas.length ? ult.filas[0].pack : null;
  const cobroAnterior = packAnterior && packAnterior.perfil ? packAnterior.perfil.cobro : null;
  const traeCobro = dataset && dataset.perfil && dataset.perfil.cobro;
  const datasetConPolitica = (!traeCobro && cobroAnterior)
    ? { ...dataset, perfil: { ...(dataset.perfil || {}), cobro: cobroAnterior } }
    : dataset;

  /* ── 3c · LOS HECHOS VIAJAN DENTRO DEL PACK (owner 2026-08-30: la carga es histórica) ─────────────────
   * Las filas por período son lo que permite que la PRÓXIMA carga se FUSIONE en vez de reemplazar. Van adentro
   * del pack —no en una columna nueva— porque el pack es autosuficiente por diseño y porque así el esquema no
   * cambia: la versión vieja sin `hechos` sigue siendo válida, solo que no se puede fusionar con ella (y eso
   * se declara al subir el archivo siguiente). En este momento el pack guarda los hechos DEL ARCHIVO: la
   * fusión con la historia ocurre al ACTIVAR, que es cuando el usuario decide. */
  const packAGuardar = hechos ? { ...datasetConPolitica, hechos } : datasetConPolitica;

  // ── 4 · la versión del pack · INACTIVA ───────────────────────────────────────────────────────────────
  /* El SELLO viaja adentro de la versión y no en `uploads`: califica las lecturas de ESTE pack, y si el usuario
   * asumió una observación eso tiene que volver con el pack al recargar la página. */
  const alt = await db.insertar("fact_pack_versions", {
    pase, devolver: true,
    filas: {
      tenant_id: tenantId,
      upload_id: uploadId,
      version,
      pack: packAGuardar,
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

/* historiaActiva({ tenantId, env, cliente }) → { hay, periodos, hechos, version } | { hay:false }
 *
 * QUÉ HISTORIA TIENE HOY ESTA EMPRESA: los períodos de la versión ACTIVA — la que ADI habla—, para que la
 * pantalla pueda declarar el diff ANTES de activar («ya tenías enero-agosto; este archivo trae septiembre»).
 * Una versión activa vieja, guardada antes de que el pack llevara hechos, devuelve `hechos: null` y sus
 * períodos salen de la serie mensual del pack: se puede DECIR qué había, aunque no se pueda fusionar con ello. */
export async function historiaActiva({ tenantId, env, cliente, ttlSegundos } = {}) {
  if (!tenantId) return { hay: false };
  const e = env || (typeof process !== "undefined" && process.env) || {};
  const db = cliente || clienteDesdeEntorno(e);
  if (!db) return { hay: false };
  const p = await emitirPase({ tenantId, secreto: e.SUPABASE_JWT_SECRET || "", ...(ttlSegundos ? { ttlSegundos } : {}) });
  if (!p.ok) return { hay: false };
  const r = await db.seleccionar("fact_pack_versions", {
    pase: p.pase, columnas: "version,pack", limite: 1,
    filtros: { tenant_id: `eq.${tenantId}`, activa: "eq.true" },
  });
  if (!r.ok || !r.filas.length) return { hay: false };
  const pack = r.filas[0].pack || {};
  const hechos = pack.hechos || null;
  const periodos = hechos
    ? periodosDeHechos(hechos)
    : [...new Set((pack.ventasMensuales || []).map((m) => m && m.periodo).filter(Boolean))].sort();
  return { hay: true, version: r.filas[0].version, hechos, periodos };
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
export async function activarVersion({ tenantId, versionId, moneda, actor = null, env, cliente, ttlSegundos, reemplazar = [] } = {}) {
  if (!tenantId) return { activada: false, motivo: "sin sesión con empresa" };
  if (!versionId) return { activada: false, motivo: "no se dijo qué versión activar" };

  const e = env || (typeof process !== "undefined" && process.env) || {};
  const db = cliente || clienteDesdeEntorno(e);
  if (!db) return { activada: false, motivo: "base no configurada" };

  const p = await emitirPase({ tenantId, secreto: e.SUPABASE_JWT_SECRET || "", ...(ttlSegundos ? { ttlSegundos } : {}) });
  if (!p.ok) return { activada: false, motivo: `no se pudo emitir el pase: ${p.motivo}` };

  /* El sello guardado es el de la lectura, sin confirmar. Se lee para confirmarlo con la redacción de la casa,
   * en vez de aceptar el que mande el navegador: quien decide qué dice el sello es el servidor. El pack viaja
   * en la misma lectura porque la fusión de abajo necesita sus hechos. */
  const previa = await db.seleccionar("fact_pack_versions", {
    pase: p.pase, columnas: "sello,pack", filtros: { id: `eq.${versionId}` }, limite: 1,
  });
  if (!previa.ok) return { activada: false, motivo: `no se pudo leer la versión: ${previa.motivo}` };
  if (!previa.filas.length) return { activada: false, motivo: "esa versión no existe para esta empresa" };

  const sello = confirmarSello(previa.filas[0].sello);

  /* ── LA FUSIÓN CON LA HISTORIA (owner 2026-08-30: la carga es histórica y explícita) ─────────────────────
   * Hasta acá, activar una versión reemplazaba el pack ENTERO: subir abril-junio hacía desaparecer enero-marzo
   * sin un aviso. Ahora, si la versión trae hechos, se fusionan con los de la versión activa — por período,
   * sobre las FILAS, nunca sobre los agregados— y el pack acumulado se RECALCULA entero con el mismo motor.
   *
   * ⚠️ LA DECISIÓN SE RE-VERIFICA ACÁ, no solo en la pantalla: entre subir y activar la historia pudo cambiar
   * (otra activación en el medio). Un período repetido que no venga nombrado en `reemplazar` corta la
   * activación con el motivo — el default es cancelar, nunca pisar.
   *
   * ⚠️ EL PERÍODO INFORMADO del acumulado es el ÚLTIMO CON VENTAS de la historia, no el del archivo: re-subir
   * un mayo corregido no puede volver «el período» de la Mesa a mayo cuando la historia llega a septiembre.
   *
   * Una versión SIN hechos (guardada antes de este cambio) se activa como siempre, sin fusión: no hay filas
   * con qué fusionar, y fabricarlas desde los agregados sería inventar. */
  const packVersion = previa.filas[0].pack || {};
  let alcance = null;
  let packFinal = null;
  /* ⚠️ REACTIVAR UNA VERSIÓN VIEJA ES VOLVER ATRÁS, NO VOLVER A FUSIONAR. Una versión ya finalizada lleva la
   * historia completa de su momento (`historiaCompleta`): se restaura TAL CUAL — que es lo que «reversible»
   * significa. Si se fusionara contra la activa, todos sus meses serían «repetidos» y deshacer exigiría
   * nombrarlos uno por uno para pisarlos con lo mismo que ya dicen. */
  if (packVersion.hechos && packVersion.historiaCompleta) {
    alcance = alcanceDeHistoria(periodosDeHechos(packVersion.hechos));
    packFinal = packVersion;
  } else if (packVersion.hechos) {
    const activa = await historiaActiva({ tenantId, env: e, cliente: db, ttlSegundos });
    const fusion = fusionarHechos({
      previos: (activa.hay && activa.hechos) || null,
      delArchivo: packVersion.hechos,
      reemplazar: Array.isArray(reemplazar) ? reemplazar : [],
    });
    if (!fusion.ok) return { activada: false, motivo: fusion.motivo, sinDecision: fusion.sinDecision || null };

    const h = fusion.hechos;
    const m = calcularDataset({
      parametros: { ...(h.parametros || {}), periodo_actual: periodoInformadoDe(h) || (h.parametros || {}).periodo_actual },
      tablas: { Ventas: h.Ventas, Inventario: h.Inventario, Abonos: h.Abonos },
      fechaCarga: h.fechaCarga,
    });
    /* El plazo de pago sobrevive a la fusión por la misma razón que sobrevivía a la carga: es política, no
     * dato del período, y el recálculo desde las filas no lo conoce. Se toma del pack recién guardado (que ya
     * lo arrastró) o, en su defecto, del activo. */
    const cobro = (packVersion.perfil && packVersion.perfil.cobro) || null;
    /* `historiaCompleta` sella que ESTE pack ya es la historia fusionada: la próxima activación de esta misma
     * versión la restaura tal cual en vez de volver a fusionarla. */
    packFinal = { ...m.dataset, ...(cobro ? { perfil: { ...m.dataset.perfil, cobro } } : {}), hechos: h, historiaCompleta: true };
    alcance = alcanceDeHistoria(periodosDeHechos(h));

    const upd = await db.actualizar("fact_pack_versions", {
      pase: p.pase, filtros: { id: `eq.${versionId}` }, cambios: { pack: packFinal },
    });
    if (!upd.ok) return { activada: false, motivo: `no se pudo escribir la historia acumulada: ${upd.motivo}` };
  }

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

  /* EL PACK ACUMULADO VUELVE AL LLAMADOR: la pantalla activa en la sesión LO QUE QUEDÓ ACTIVO en la base — la
   * historia completa—, no el archivo suelto que acaba de subir. Sin esto, la sesión mostraría solo los meses
   * del archivo hasta la próxima recarga. La moneda declarada al activar se refleja igual que en la base. */
  const packSesion = packFinal && monedaDeclarada
    ? { ...packFinal, perfil: { ...(packFinal.perfil || {}), moneda: monedaDeclarada } }
    : packFinal;
  return { activada: true, versionId, version: r.filas[0].version, sello, moneda: monedaDeclarada,
    ...(alcance ? { alcance } : {}), ...(packSesion ? { pack: packSesion } : {}) };
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

/* declararCobro({ tenantId, diasGeneral, porCliente, actor, env }) → { declarada, cobro } | { declarada:false, motivo }
 *
 * EL PLAZO DE PAGO DE LA EMPRESA · general y por cliente. Escribe `perfil.cobro` dentro del pack de la versión
 * activa, con la función de la 006.
 *
 * ⚠️ SE VALIDA ACÁ *Y* EN LA BASE, y no es duplicación por descuido. Acá, para poder decirle al usuario qué
 * estaba mal en su idioma; en la base, porque una regla que solo vive en el servidor no es una garantía — es
 * una costumbre. Las dos aplican el mismo criterio: lo que no se entiende se DESCARTA, nunca se aproxima.
 * Un plazo ilegible no puede convertirse en 30 días.
 *
 * ⚠️ Y NO SE PUEDE DECLARAR SIN DATOS CARGADOS. La política vive dentro del pack activo: sin pack no hay dónde
 * escribirla. La base lo rechaza con esas palabras en vez de crear una versión fantasma. */
export async function declararCobro({ tenantId, diasGeneral, porCliente, actor = null, env, cliente, ttlSegundos } = {}) {
  if (!tenantId) return { declarada: false, sinBase: true, motivo: "sin sesión con empresa" };

  /* ⚠️ SE VALIDA ANTES DE MIRAR LA BASE, y el orden importa por dos razones. Al usuario hay que decirle qué
   * escribió mal, no «base no configurada» —que es cierto y no le sirve de nada—. Y una validación que solo
   * corre con base viva es una validación que ningún candado puede ejercer sin red.
   *
   * La misma normalización que usa la pantalla para leer la política: una sola verdad sobre qué es un plazo. */
  const limpia = politicaLimpia({ diasGeneral, porCliente });
  if (diasGeneral !== null && diasGeneral !== undefined && diasGeneral !== "" && limpia.diasGeneral === null) {
    return { declarada: false, motivo: "el plazo general tiene que ser un número entero de 0 a 365 días" };
  }
  const pedidos = Object.keys((porCliente && typeof porCliente === "object") ? porCliente : {});
  const descartados = pedidos.filter((n) => !(n.trim() in limpia.porCliente));
  if (descartados.length) {
    return { declarada: false,
      motivo: `estos plazos no se entienden y no se guardó nada: ${descartados.slice(0, 3).join(", ")}. Tienen que ser números enteros de 0 a 365 días.` };
  }

  const e = env || (typeof process !== "undefined" && process.env) || {};
  const db = cliente || clienteDesdeEntorno(e);
  if (!db) return { declarada: false, sinBase: true, motivo: "base no configurada" };

  const p = await emitirPase({ tenantId, secreto: e.SUPABASE_JWT_SECRET || "", ...(ttlSegundos ? { ttlSegundos } : {}) });
  if (!p.ok) return { declarada: false, motivo: `no se pudo emitir el pase: ${p.motivo}` };

  const r = await db.llamarFuncion("adi_declarar_cobro", {
    p_dias_general: limpia.diasGeneral,
    p_por_cliente: limpia.porCliente,
    p_actor_id: (actor && actor.id) || null,
    p_actor_label: (actor && actor.label) || null,
    p_actor_rol: (actor && actor.rol) || null,
  }, { pase: p.pase });
  if (!r.ok) return { declarada: false, motivo: `no se pudo guardar el plazo: ${r.motivo}` };
  if (!r.filas.length) return { declarada: false, motivo: "la base no confirmó el plazo" };

  /* Vuelve lo que QUEDÓ GUARDADO, no lo que se mandó: si la base descartó algo, la pantalla muestra lo real. */
  return { declarada: true, version: r.filas[0].version, cobro: politicaLimpia(r.filas[0].cobro) };
}
