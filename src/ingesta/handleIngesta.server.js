/* === ingesta/handleIngesta.server.js · EL ARCHIVO DEL USUARIO SE PROCESA EN EL SERVIDOR (owner 2026-08-23) ====
 *
 * POR QUÉ EN EL SERVIDOR, y no es una preferencia: `leerLibro` descomprime el `.xlsx` con `node:zlib`, que en el
 * navegador NO EXISTE. Se podría reescribir con `DecompressionStream`, pero eso convierte una función síncrona en
 * asíncrona y arrastra a todos sus consumidores y a sus gates. Procesarlo en el borde del servidor es más barato Y
 * es mejor para la frontera del dato: el archivo se lee donde ya se leen los demás datos de empresa.
 *
 * ⚠️ RUNTIME NODE, NO EDGE. `/api/adi-data` corre en edge, pero el edge tampoco tiene `node:zlib`. Este endpoint
 * va en node, igual que `/api/adi-narrate-c` — y por el mismo tipo de razón: lo que necesita, el edge no lo tiene.
 *
 * EL ORDEN IMPORTA, y es la decisión del owner («abre antes de analizar»): viajan juntos la preview, las alarmas
 * y el dataset, pero es la PANTALLA la que decide cuándo activarlo. Acá no se activa nada.
 *
 * PERSISTE, DESDE LA VÍA 3 (2026-08-27) — y hasta acá decía lo contrario, con razón: «sin base de datos todavía,
 * guardar sería inventar un lugar donde dejar el dato de un cliente». Ese lugar ya existe. Tres condiciones, y
 * si falta cualquiera este endpoint se comporta EXACTAMENTE como antes: que la base esté configurada, que haya
 * una sesión verificada que diga de qué empresa es, y que el archivo haya pasado la validación.
 *
 * ⚠️ GUARDAR NO ES ACTIVAR. La versión queda `activa = false`; adoptarla es del usuario, en la pantalla. Y una
 * falla al guardar NO rompe la carga: la preview y las alarmas se devuelven igual, con `persistencia` diciendo
 * qué pasó. Convertir un problema de base en un archivo rechazado sería castigar al usuario por algo nuestro.
 *
 * CERO LLAMADAS AL MODELO. Leer, validar y detectar alarmas es todo determinístico. Este endpoint no gasta.
 */
import { ingestarPlantilla } from "./plantilla/ingestarPlantilla.js";
import { leerPlausibilidad, textoDeApertura, selloDeLaLectura } from "./plausibilidad.js";
import { plantillaVacia, plantillaEjemplo } from "./plantilla/generarPlantilla.js";
import { umbralesDe } from "./umbrales.js";
import { PLANTILLA_VERSION } from "../config/contract/plantilla.js";
import { verifyAccessCode } from "../adi/llm/accessToken.js";
import { persistirCarga, cargasPrevias, activarVersion, declararCobro, declararDiario, hashSha256, historiaActiva,
         guardarConversacion, listarConversaciones, leerConversacion, ocultarConversacion, declararContexto,
         monedaTenant } from "./persistirCarga.server.js";
import { diffDeCarga, periodosDeHechos } from "./historico.js";
import { validarEscala, FUENTES } from "../config/escala.js";

/* De qué empresa es esta carga. Sale del código firmado y de ningún otro lado.
 *
 * ⚠️ NO SE CAE AL DEMO, y esa es la diferencia con `resolverTenantDeSesion`. Sin la puerta armada, servir el
 * negocio de demostración es correcto —es lo que hay que mostrar—; GUARDAR ahí el archivo real de un cliente
 * sería meter su contabilidad adentro del ejemplo. Para escribir hace falta un código verificado, o nada. */
async function empresaDeLaCarga(access, env) {
  const s = await sesionDeLaCarga(access, env);
  return s ? s.tenantId : null;
}

/* sesionDeLaCarga(access, env) → { tenantId, actor } | null · QUIÉN, EN QUÉ EMPRESA, CON QUÉ ROL.
 *
 * ⚠️ EL ACTOR SE PUEDE REGISTRAR HOY, ANTES DE QUE HAYA CUENTAS (owner 2026-08-30). El código de acceso lleva
 * FIRMADO el nombre de a quién se le emitió: eso no identifica a una persona como lo haría una cuenta —dos
 * personas pueden compartir un código— pero es información real y verificada, no un «desconocido». Se guarda
 * como etiqueta; el `id` queda nulo hasta que existan las cuentas, y ese día se llena sin migrar nada.
 *
 * El ROL viaja al lado y también se guarda en el momento de la acción: los roles cambian, y lo que hay que
 * poder responder es con qué rol se hizo ESO. Hoy no hay membresías, así que va nulo — el campo existe para
 * que el día que haya, no haya que decidir qué poner en el histórico. */
async function sesionDeLaCarga(access, env) {
  const secreto = (env && env.ADI_TOKEN_SECRET) || "";
  if (!secreto || !access) return null;
  const r = await verifyAccessCode(access, secreto);
  if (!r.ok || !r.tenant) return null;
  return { tenantId: r.tenant, actor: { id: null, label: r.name || null, rol: null } };
}

// `umbralesDe` se movió a `./umbrales.js` (2026-09-25, corrección del supervisor: estaba duplicado con el
// Acta de ingesta). Mismo cuerpo, misma referencia general de ADI cuando el negocio no declara la suya.

/* archivoDeLaCarga(body) → { ok:true, buf, nombreArchivo } | { ok:false, motivo }
 * Lo que llega en el cuerpo, decodificado y con su tope. Lo usan la carga y el camino en memoria de la escala: las
 * dos leen el MISMO archivo con las MISMAS reglas, así que el límite y los motivos viven una sola vez. */
function archivoDeLaCarga(body) {
  const b64 = typeof body.archivo === "string" ? body.archivo : "";
  const nombreArchivo = String(body.nombre || "").slice(0, 80);
  if (!b64) return { ok: false, motivo: "no llegó ningún archivo" };
  let buf;
  try { buf = Buffer.from(b64, "base64"); } catch { return { ok: false, motivo: "el archivo no se pudo decodificar" }; }
  /* TOPE DE TAMAÑO. Una plantilla llena de verdad pesa decenas de KB; 12 MB es holgura enorme y a la vez impide
   * que un archivo equivocado —un video, un respaldo— tumbe la función. El límite se declara en el mensaje. */
  if (buf.length > 12 * 1024 * 1024) return { ok: false, motivo: "el archivo pesa más de 12 MB: ¿es la plantilla?" };
  return { ok: true, buf, nombreArchivo };
}

/* handleIngesta(body, env) → { ok:true, preview, alarmas, dataset, persistencia } | { ok:false, motivo, preview }
 * `body.archivo` = el .xlsx en base64 · `body.nombre` = cómo se llama, para poder nombrarlo en pantalla ·
 * `body.access` = el código de acceso firmado, de donde sale la empresa cuando hay que guardar. */
export async function handleIngesta(body = {}, env) {
  /* DESCARGAR LA PLANTILLA TAMBIÉN ES COSA DEL SERVIDOR: se ARMA con las mismas rutinas de compresión que la
   * leen. Que salga del contrato y no de un archivo guardado es lo que garantiza que la planilla que baja el
   * usuario y la que ADI espera sean la misma — un .xlsx versionado se desincronizaría en silencio. */
  if (body.op === "plantilla") {
    const conEjemplo = body.conEjemplo !== false;
    const libro = conEjemplo ? plantillaEjemplo() : plantillaVacia();
    return { ok: true, op: "plantilla", version: PLANTILLA_VERSION,
      nombre: "Plantilla_ADI_" + PLANTILLA_VERSION + (conEjemplo ? "_ejemplo" : "") + ".xlsx",
      archivo: Buffer.from(libro).toString("base64") };
  }

  /* ADOPTAR LOS DATOS · el usuario confirmó en la pantalla (3.d).
   * Es la otra mitad de la carga: subir deja la versión guardada e inactiva, y esto la vuelve la versión de
   * la que ADI habla. Va acá y no en un endpoint nuevo porque es el mismo acto del mismo usuario sobre el
   * mismo archivo — partirlo en dos rutas obligaría a la pantalla a saber en cuál está cada mitad. */
  if (body.op === "activar") {
    const s = await sesionDeLaCarga(body.access, env);
    if (!s) return { ok: false, motivo: "sin sesión con empresa: no se puede activar" };
    /* `reemplazar` viaja EXPLÍCITO desde la pantalla (owner 2026-08-30): la lista de períodos que el usuario
     * confirmó pisar. Sin ella, un período repetido corta la activación — el default es cancelar. */
    /* ⚠️ LA ESCALA (Y LA MONEDA, SI EL ARCHIVO NO LA TRAÍA) VIAJAN EN EL ACTO DE ACTIVAR y se EXIGEN en `activarVersion`
     * (owner 2026-10-04 · P1): sin ellas no se activa nada, y con «miles» el pack que vuelve ya está convertido a unidades. */
    const r = await activarVersion({ tenantId: s.tenantId, versionId: body.versionId, moneda: body.moneda, escala: body.escala,
      reemplazar: Array.isArray(body.reemplazar) ? body.reemplazar : [], actor: s.actor, env });
    return r.activada
      ? { ok: true, op: "activar", version: r.version, sello: r.sello, moneda: r.moneda, escala: r.escala,
          ...(r.alcance ? { alcance: r.alcance } : {}), ...(r.pack ? { dataset: r.pack } : {}) }
      : { ok: false, op: "activar", motivo: r.motivo, ...(r.sinEscala ? { sinEscala: true } : {}), ...(r.sinMoneda ? { sinMoneda: true } : {}),
          ...(r.sinDecision ? { sinDecision: r.sinDecision } : {}) };
  }

  /* DECLARAR EL PLAZO DE PAGO · política del negocio, no dato del período (owner 2026-08-30).
   *
   * ⚠️ VA POR ACÁ Y NO POR UN ENDPOINT NUEVO por la misma razón que «activar»: es el mismo usuario, sobre la
   * misma empresa, decidiendo cómo se leen sus propios datos. Y porque este endpoint ya sabe quién es —el
   * código firmado trae el nombre—, así que el plazo queda con la firma de quién lo declaró sin agregar nada.
   *
   * ⚠️ NO SE PUEDE DECLARAR SIN DATOS ACTIVOS, y la base lo rechaza: la política vive dentro del pack, así que
   * sin pack no hay dónde escribirla. Es una limitación real y se dice, en vez de guardarla en un limbo. */
  /* DIARIO ETAPA 2 (owner, GO 2026-09-05): la memoria entre sesiones va POR ESTA MISMA PUERTA y por la misma
   * razón que los plazos — el mismo usuario, sobre su misma empresa, decidiendo qué recuerda su asesor. El
   * objeto llega ARMADO por el motor del hilo (guardar = con la pieza; olvidar = sin ella). */
  if (body.op === "diario") {
    const s = await sesionDeLaCarga(body.access, env);
    if (!s) return { ok: false, motivo: "sin sesión con empresa: no se puede guardar el diario" };
    const r = await declararDiario({ tenantId: s.tenantId, diario: body.diario, actor: s.actor, env });
    return r.declarada
      ? { ok: true, op: "diario", version: r.version, diario: r.diario }
      : { ok: false, op: "diario", motivo: r.motivo };
  }

  /* EL HISTORIAL DE CONVERSACIONES (owner 2026-09-08): «guardando el historial etc. tal como lo hago con
   * claude o gpt». Cuatro verbos por la MISMA puerta y el MISMO pase — guardar (upsert por hilo, corre en
   * cada turno), listar (el panel: títulos y fechas, sin contenido), abrir (una) y borrar (con su rastro).
   * ⚠️ La sesión se exige en LOS CUATRO, incluido listar: el historial es lo más privado que guarda el
   * producto — las preguntas del dueño y las cifras de su negocio. Sin empresa firmada no se responde. */
  if (body.op === "conversaciones") {
    const s = await sesionDeLaCarga(body.access, env);
    if (!s) return { ok: false, motivo: "sin sesión con empresa: el historial es de la empresa, no del navegador" };
    const base = { tenantId: s.tenantId, env };
    if (body.accion === "guardar") {
      const r = await guardarConversacion({ ...base, hilo: body.hilo, mensajes: body.mensajes, actor: s.actor });
      return r.ok ? { ok: true, op: "conversaciones", accion: "guardar", hilo: r.hilo, titulo: r.titulo }
                  : { ok: false, op: "conversaciones", motivo: r.motivo };
    }
    if (body.accion === "abrir") {
      const r = await leerConversacion({ ...base, hilo: body.hilo });
      return r.ok ? { ok: true, op: "conversaciones", accion: "abrir", hilo: r.hilo, titulo: r.titulo, mensajes: r.mensajes }
                  : { ok: false, op: "conversaciones", motivo: r.motivo };
    }
    /* QUITAR DEL PANEL, no borrar (owner 2026-09-08): la fila queda en la base y sale de la lista. Se acepta
     * el verbo viejo para no romper a quien ya lo llama, pero lo que se responde dice lo que de verdad pasó. */
    if (body.accion === "ocultar" || body.accion === "borrar") {
      const r = await ocultarConversacion({ ...base, hilo: body.hilo, actor: s.actor });
      return r.ok ? { ok: true, op: "conversaciones", accion: "ocultar", ocultas: r.ocultas }
                  : { ok: false, op: "conversaciones", motivo: r.motivo };
    }
    /* por defecto, LISTAR: es lo que el panel pide al abrir y la única acción sin efectos. */
    const r = await listarConversaciones({ ...base, limite: body.limite });
    return r.ok ? { ok: true, op: "conversaciones", accion: "listar", conversaciones: r.conversaciones }
                : { ok: false, op: "conversaciones", motivo: r.motivo, conversaciones: [] };
  }

  /* «TU NEGOCIO» · EL CONTEXTO DECLARADO (owner 2026-09-08, Pro): el negocio en palabras de su dueño. Va por
   * la puerta de siempre y con la sesion de siempre. Escribir exige empresa firmada; el texto vacio = borrar. */
  if (body.op === "contexto") {
    const s2 = await sesionDeLaCarga(body.access, env);
    if (!s2) return { ok: false, motivo: "sin sesión con empresa: el contexto es de la empresa, no del navegador" };
    const r = await declararContexto({ tenantId: s2.tenantId, contexto: body.contexto, actor: s2.actor, env });
    return r.ok ? { ok: true, op: "contexto", version: r.version, contexto: r.contexto }
                : { ok: false, op: "contexto", motivo: r.motivo };
  }

  if (body.op === "plazos") {
    const s = await sesionDeLaCarga(body.access, env);
    if (!s) return { ok: false, motivo: "sin sesión con empresa: no se puede declarar el plazo de pago" };
    const r = await declararCobro({
      tenantId: s.tenantId, diasGeneral: body.diasGeneral, porCliente: body.porCliente, actor: s.actor, env,
    });
    return r.declarada
      ? { ok: true, op: "plazos", version: r.version, cobro: r.cobro }
      : { ok: false, op: "plazos", motivo: r.motivo };
  }

  /* ESCALAR · EL CAMINO EN MEMORIA (owner 2026-10-04 · P1). Cuando la carga no se guardó porque no hay empresa o no hay base
   * (`persistencia.sinBase`), no existe una versión que activar y por lo tanto tampoco la conversión de `activarVersion`.
   * Este es su equivalente: la pantalla vuelve a mandar el MISMO archivo junto con la escala que la empresa declaró (y la
   * moneda, si el archivo no la traía), y lo que vuelve es el dataset YA CONVERTIDO a unidades de la moneda, con
   * `perfil.escala` y su procedencia. Es lo que se activa en la sesión: la pantalla nunca activa el dataset de la primera
   * lectura.
   *
   * No guarda nada, no necesita sesión y no toca la base — por eso va por su propia op y no repite la carga: repetirla
   * crearía una versión nueva por cada clic. Misma exigencia que `activar`: sin escala, o sin moneda de ninguna de las dos
   * fuentes, no hay dataset. */
  if (body.op === "escalar") {
    const ve = validarEscala(body.escala);
    if (!ve.ok) return { ok: false, op: "escalar", sinEscala: true, motivo: ve.motivo };
    const a = archivoDeLaCarga(body);
    if (!a.ok) return { ok: false, op: "escalar", motivo: a.motivo };
    let re;
    try { re = ingestarPlantilla(a.buf, { nombreArchivo: a.nombreArchivo, fechaCarga: new Date().toISOString().slice(0, 10), escala: ve.valor, moneda: body.moneda }); }
    catch (e) { return { ok: false, op: "escalar", motivo: `no se pudo leer el archivo: ${(e && e.message) || "formato inesperado"}` }; }
    const falta = re && !re.ok && ((re.preview && re.preview.bloqueos) || []).find((b) => b.tipo === "declaracion-faltante");
    if (falta) return { ok: false, op: "escalar", ...(falta.sinMoneda ? { sinMoneda: true } : { sinEscala: true }), motivo: falta.detalle };
    if (!re || !re.ok) return { ok: false, op: "escalar", motivo: "el archivo no pasó la validación", preview: (re && re.preview) || null };
    return { ok: true, op: "escalar", dataset: re.dataset, preview: re.preview, escala: (re.dataset.perfil && re.dataset.perfil.escala) || null };
  }

  const leido = archivoDeLaCarga(body);
  if (!leido.ok) return { ok: false, motivo: leido.motivo };
  const { buf, nombreArchivo } = leido;

  let r;
  /* LA FECHA RELEVANTE ES LA DE CARGA, y la pone ADI (owner 2026-08-26): «no la llena el usuario». El stock es
   * una foto del momento en que se exportó el archivo, así que la referencia para contar días sin venta es
   * cuándo llegó, no una fecha que el usuario tenga que tipear —y que en la plantilla anterior era idéntica en
   * todas las filas, señal de que nunca fue una columna. Se stampa acá, en el borde: el motor la recibe como
   * dato, de modo que los gates puedan pasarle una fija y seguir siendo reproducibles. */
  const fechaCarga = new Date().toISOString().slice(0, 10);
  try { r = ingestarPlantilla(buf, { nombreArchivo, fechaCarga }); }
  catch (e) { return { ok: false, motivo: `no se pudo leer el archivo: ${(e && e.message) || "formato inesperado"}` }; }

  /* EL RECHAZO TAMBIÉN ES UNA RESPUESTA ÚTIL: viaja la preview con sus bloqueos, porque rechazar sin decir qué
   * corregir convierte la plantilla en un obstáculo en vez de una puerta. */
  if (!r || !r.ok) return { ok: false, motivo: "el archivo no pasó la validación", preview: (r && r.preview) || null };

  const filasPorPeriodo = (r.preview && r.preview.periodos && r.preview.periodos.filas) || null;
  const lectura = leerPlausibilidad(r.dataset, { umbrales: umbralesDe(r.dataset), filasPorPeriodo });

  const sello = selloDeLaLectura(lectura, { confirmado: false });
  const selloConfirmado = selloDeLaLectura(lectura, { confirmado: true });

  /* ── GUARDAR ─────────────────────────────────────────────────────────────────────────────────────────
   * Va envuelto en su propio `try` porque nada de acá adentro puede tumbar una carga que ya salió bien: el
   * usuario hizo su parte, el archivo es válido y la preview está lista. Un problema de base se INFORMA en
   * `persistencia`; no se convierte en un rechazo del archivo. */
  let persistencia = { guardado: false, sinBase: true, motivo: "base no configurada" };
  let repetido = null;
  /* LA HISTORIA, DECLARADA ANTES DE ACTIVAR (owner 2026-08-30): qué períodos ya existían, qué trae el archivo,
   * y si alguno se pisa — con la pregunta. Sin sesión o sin base no hay historia guardada que comparar: el
   * diff igual viaja, describiendo la primera carga. */
  let historia = diffDeCarga({ previos: [], delArchivo: periodosDeHechos(r.hechos) });
  try {
    const s = await sesionDeLaCarga(body.access, env);
    const empresa = s ? s.tenantId : null;
    if (!empresa) {
      persistencia = { guardado: false, sinBase: true, motivo: "sin sesión con empresa: no se guarda" };
    } else {
      const activa = await historiaActiva({ tenantId: empresa, env });
      historia = diffDeCarga({ previos: activa.hay ? activa.periodos : [], delArchivo: periodosDeHechos(r.hechos) });
      /* Una historia activa SIN hechos es una versión de antes de este cambio: se puede decir qué había, pero
       * no fusionar con ello. Se declara — activar reemplazaría lo anterior completo, como hasta hoy. */
      if (activa.hay && !activa.hechos) {
        historia = { ...historia, sinDetallePrevio: true,
          texto: `${historia.texto} Las cargas anteriores no guardaron su detalle por mes, así que no se pueden combinar: si activas este archivo, pasa a ser la historia completa.`,
          pideDecision: false, repetidos: [], resultado: periodosDeHechos(r.hechos) };
      }
      const hash = await hashSha256(buf);
      /* El aviso se calcula ANTES de insertar: después, la carga de recién sería siempre «una carga previa». */
      const previa = await cargasPrevias({ tenantId: empresa, hash, env });
      if (previa.hubo) repetido = previa.cuando;

      /* ── CAMINO B (Etapa 2 §3, medido con sonda offline antes de escribir esto — ver el informe): si ESTE
       * archivo no trae moneda, se ofrece la que la EMPRESA ya declaró en una carga anterior (`tenants.moneda`,
       * `db/migraciones/012_perfil_empresa.sql`, sin aplicar) — así la pantalla no vuelve a preguntar algo que
       * este cliente ya contestó. Se mergea ANTES de persistir, para que la versión inactiva recién guardada
       * (la que arma la preview de `PanelDatos.jsx`) ya la traiga; si la empresa tampoco la declaró nunca,
       * `monedaTenant` da `null` y todo sigue exactamente como hasta hoy: preguntando. NUNCA se infiere — es la
       * MISMA declaración de una carga previa, recordada, no un valor nuevo. */
      if (!(r.dataset.perfil && r.dataset.perfil.moneda)) {
        const heredada = await monedaTenant({ tenantId: empresa, env });
        /* ⚠️ LA HERENCIA MARCA SU FUENTE (P1): la moneda recordada NO viene del archivo, y la pantalla no puede rotularla «del
         * archivo». `monedaFuente: "empresa"` es lo que le dice a la pantalla —y a la activación— que es una declaración de
         * una carga anterior de ESTA empresa, la tercera fuente de la moneda. */
        if (heredada) r.dataset = { ...r.dataset, perfil: { ...(r.dataset.perfil || {}), moneda: heredada, monedaFuente: FUENTES.empresa } };
      }

      /* ⚠️ SE GUARDA EL SELLO **SIN CONFIRMAR**, y no es un detalle: el sello lleva adentro un campo que dice si
       * el usuario asumió las observaciones, y en este momento no las asumió — la versión todavía está
       * inactiva. Guardar acá el confirmado dejaría una fila afirmando algo que no pasó. Cuando el usuario
       * confirme (3.d), esa misma versión pasa a activa Y su sello pasa a confirmado: son el mismo acto. */
      persistencia = await persistirCarga({
        tenantId: empresa, bytes: buf, nombreArchivo, dataset: r.dataset, hechos: r.hechos,
        sello, plantillaVersion: PLANTILLA_VERSION, hash, env, actor: s.actor,
      });
    }
  } catch (e) {
    persistencia = { guardado: false, motivo: `no se pudo guardar: ${(e && e.message) || "error inesperado"}` };
  }

  /* LA APERTURA SE REDACTA ACÁ, no en la pantalla: es la misma función que ya probó el gate de plausibilidad, y
   * duplicar la redacción en React sería una segunda verdad sobre el mismo hallazgo. El sello viaja junto porque
   * la observación tiene que quedar pegada a las lecturas posteriores, no morir en el momento de confirmar. */
  return { ok: true, preview: r.preview, alarmas: lectura.alarmas, dataset: r.dataset,
    persistencia, historia, ...(repetido ? { repetido } : {}),
    apertura: textoDeApertura(lectura, { archivo: nombreArchivo }),
    sello,
    /* LOS DOS SELLOS SALEN DE LA MISMA FUNCIÓN, y por eso viajan los dos: el usuario todavía no decidió cuando
     * se arma esta respuesta. Si la pantalla tuviera que redactar el sello confirmado por su cuenta, habría dos
     * redacciones para el mismo hallazgo — la clase de duplicación que este producto trata como defecto. */
    selloConfirmado };
}
