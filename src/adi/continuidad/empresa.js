/* === src/adi/continuidad/empresa.js · LA MEMORIA ÚNICA DE EMPRESA (Etapa 2 · owner 2026-09-25/26) ═══════════════
 * REVISIÓN 3 §2 de `_ADI_DISENO_FLUJO_V2.md`, textual: «LO QUE LA EMPRESA ES Y DECLARA (perfil, criterios,
 * hechos declarados, documentos) vive en la empresa, sobrevive a las cargas, con vigencia y período, y se
 * reemplaza con historia, nunca en silencio.» Y la ley madre de la sesión (owner, textual): «No acepto que la
 * continuidad factual del producto dependa de la memoria del LLM.»
 *
 * QUÉ GUARDA ESTE MÓDULO Y QUÉ NO. `memoria_empresa` (la tabla de la migración 015) guarda SOLO lo que la
 * empresa DECLARA o APORTA — nunca un hecho medido: eso vive en el pack (`fact_pack_versions`) y en la boleta
 * del turno, no acá. Por eso `ORIGENES_HECHO_EMPRESA` es un subconjunto ESTRICTO de los cuatro orígenes de
 * `notario/hechos.js` (`ORIGENES = medido·documento·declarado·supuesto`): solo `declarado` y `documento` pueden
 * nacer en esta memoria. La ley «un declarado nunca pisa un medido» queda satisfecha POR CONSTRUCCIÓN en este
 * módulo — acá no existe ninguna fila «medido» que un declarado pudiera pisar — y la colisión REAL (un hecho de
 * esta memoria contra una fig medida del pack, dentro de la evidencia de UN turno) la resuelve `notario/hechos.js`
 * (corte 1, Etapa 1: el hecho `discrepancia` que emite `libroDeHechos` cuando dos orígenes comparten la misma
 * llave). Este módulo no reimplementa esa comparación: solo entrega los hechos vigentes con su origen correcto
 * para que quien arme la evidencia del turno (`entrega/componer.js`, fuera del alcance de esta pieza) los use tal
 * cual — ver `_ADI_CONTINUIDAD_INTEGRACION.md`.
 *
 * EL PERFIL (sector, tipo de producto, país, modelo comercial, banda de tamaño, moneda) NO se guarda acá: vive
 * en las columnas de `tenants` (migraciones 012/013) detrás de `adi_declarar_perfil_empresa` y se lee con
 * `config/contract/perfilCliente.js` — ninguno de los dos se toca en esta pieza (Etapa 3, «perfil conversando»,
 * `_ADI_PLAN_PRODUCTO_V2.md` B4, no es esta etapa). Lo único que este módulo aporta sobre el perfil es
 * `hechoDePerfilCampo`, un traductor PURO y de SOLO LECTURA (nunca escribe, nunca se llama desde `declararHecho`)
 * para que la vista unificada de «memoria de empresa» (`memoriaDeEmpresa`) pueda mostrar el perfil junto a los
 * criterios/hechos/documentos sin inventar una segunda tabla ni una segunda verdad.
 *
 * VIGENCIA E HISTORIA, NUNCA EN SILENCIO. Cada fila es INMUTABLE una vez guardada (ver `almacen.js`): un cambio
 * de valor es una fila NUEVA con `reemplaza: idViejo`, y la fila vieja pasa a `estado:"retirado"` — nunca un
 * UPDATE que borre el valor anterior. Sin `reemplaza` explícito, una declaración que choca con una vigente de la
 * MISMA llave (clase, concepto, eje, entidad, período) NUNCA la pisa: entra como `"pendiente"` con
 * `conflictoCon` apuntando a la vigente, exactamente la forma que la Etapa 3 (`aportarContexto`, diseño §E)
 * espera devolver al LLM (`{id, estado, entendido, conflictoCon?, paraConfirmar}`).
 *
 * MIGRACIÓN EN LECTURA DE LO VIEJO (`migrarLegado`/`memoriaDeEmpresa`). El diario (007, `pack.perfil.diario`) y
 * el contexto (011, `pack.perfil.contexto`) viven HOY dentro de la versión activa del pack — el hallazgo 2 del
 * diseño v2: «cambian al activar otra versión; la memoria de empresa no puede colgarse ahí». La migración de
 * DATOS real (mover esas filas a `memoria_empresa`) es un paso de despliegue que esta tarea no ejecuta (igual
 * que 012/013/014: «un archivo, no un hecho en la base»); mientras tanto, `memoriaDeEmpresa` TRADUCE lo viejo EN
 * LECTURA, cada vez que se pide la memoria de una empresa, para que «sin perder nada» sea cierto aunque la
 * migración de datos de la 015 todavía no haya corrido en ningún proyecto real.
 *
 * Puro: sin I/O directo — todo pasa por el `store` inyectado (`almacen.js`). */

export const CLASES_HECHO_EMPRESA = ["perfil", "criterio", "hecho", "documento"];
/* subconjunto de `notario/hechos.js:ORIGENES` — acá NUNCA "medido" ni "supuesto" (ver cabecera). */
export const ORIGENES_HECHO_EMPRESA = ["declarado", "documento"];
export const ESTADOS_HECHO_EMPRESA = ["pendiente", "vigente", "retirado", "omitido"];
/* los tres sellos de un documento (REVISIÓN 3 §4, textual): extraído (la lectura) · confirmado (el usuario avala
 * esa lectura) · verificado (ADI tiene el ORIGINAL y comprueba por código). Se guardan en `documento.sello`. */
export const SELLOS_DOCUMENTO = ["extraido", "confirmado", "verificado"];

const _normTxt = (x) => String(x == null ? "" : x).trim().toLowerCase();
const _es = (x) => x != null && typeof x === "object" && !Array.isArray(x);

/** claveDeHecho(h) → string · la llave (clase, concepto, eje, entidad, período) que decide una colisión —
 * la MISMA composición que el diseño v2 usa para "misma llave" en el modelo de orígenes (§A), aplicada acá a la
 * memoria de empresa en vez de a las figs de un turno. La unidad NO entra en la llave: dos declaraciones de la
 * misma cifra en unidades distintas siguen siendo la MISMA afirmación (choca igual, `_mismoValorDeclarado`
 * decide si además dicen lo mismo). */
export function claveDeHecho(h) {
  if (!_es(h)) return null;
  return JSON.stringify([_normTxt(h.clase), _normTxt(h.concepto), _normTxt(h.eje || ""), _normTxt(h.entidad || ""), _normTxt(h.periodo || "")]);
}

/* ¿dos valores declarados dicen lo mismo? — comparación LOCAL, más laxa que `notario/evidencia.js:mismoValor`
 * (esa compara una cifra dicha CONTRA una fig de la boleta, con el formateo de la casa; acá comparamos dos
 * declaraciones entre sí, que pueden no traer `raw` — solo `texto`, ej. una tesis o un criterio en palabras). */
function _mismoValorDeclarado(a, b) {
  if (a == null || b == null) return a === b;
  const ra = Number(a.raw), rb = Number(b.raw);
  if (Number.isFinite(ra) && Number.isFinite(rb)) {
    if (_normTxt(a.unidad || "") !== _normTxt(b.unidad || "")) return false;
    return Math.abs(ra - rb) < 1e-9 || Math.abs(ra - rb) <= Math.abs(rb || 1) * 0.0005;
  }
  return _normTxt(a.texto) === _normTxt(b.texto);
}

function _pasaFiltro(h, f) {
  if (!f) return true;
  if (f.clase != null && _normTxt(h.clase) !== _normTxt(f.clase)) return false;
  if (f.concepto != null && _normTxt(h.concepto) !== _normTxt(f.concepto)) return false;
  if (f.eje != null && _normTxt(h.eje || "") !== _normTxt(f.eje)) return false;
  if (f.entidad != null && _normTxt(h.entidad || "") !== _normTxt(f.entidad)) return false;
  if (f.estado != null && _normTxt(h.estado) !== _normTxt(f.estado)) return false;
  return true;
}

const _nuevoId = (store) => (typeof store.nuevoIdHecho === "function" ? store.nuevoIdHecho() : `h${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`);
const _ahora = () => new Date().toISOString();

/** leerVigentes(store, tenantId, filtro?) → HechoEmpresa[] · solo `estado:"vigente"`. */
export function leerVigentes(store, tenantId, filtro = {}) {
  const todos = (store.leerHechosEmpresa(tenantId) || []).filter((h) => h.estado === "vigente");
  return todos.filter((h) => _pasaFiltro(h, filtro));
}

/** leerHistoria(store, tenantId, filtro?) → HechoEmpresa[] · vigentes + retirados, en orden de declaración —
 * para auditar una llave completa (qué se dijo, cuándo, qué lo reemplazó). Los omitidos NO son historia de un
 * valor (nunca hubo valor): se leen aparte con `estado:"omitido"` en el filtro si hace falta. */
export function leerHistoria(store, tenantId, filtro = {}) {
  const todos = (store.leerHechosEmpresa(tenantId) || []).filter((h) => h.estado === "vigente" || h.estado === "retirado");
  return todos.filter((h) => _pasaFiltro(h, filtro)).sort((a, b) => String(a.declaradoEn || "").localeCompare(String(b.declaradoEn || "")));
}

/** leerPendientes(store, tenantId, filtro?) → HechoEmpresa[] · solo `estado:"pendiente"` — lo que ADI PROPUSO
 * (declarado o leído de un documento) y la persona todavía NO confirmó (ley 2026-09-26, cabecera de
 * `declararHecho`). Existe para que quien exponga "el estado" (`conocerEmpresa`/`capacidad/acciones.js`) pueda
 * mostrarlo SEPARADO de `leerVigentes` — nunca mezclado como si ya fuera dato: un pendiente se anuncia como
 * "pendiente de confirmar", jamás se usa en una Entrega ni se cuenta como parte de lo que la empresa "ya sabe". */
export function leerPendientes(store, tenantId, filtro = {}) {
  const todos = (store.leerHechosEmpresa(tenantId) || []).filter((h) => h.estado === "pendiente");
  return todos.filter((h) => _pasaFiltro(h, filtro));
}

/** declararHecho(store, tenantId, aporte, opts?) → ResultadoAporte
 * aporte = { clase, concepto, eje?, entidad?, periodo?, valor?: {raw?, unidad?, texto?}, origen?, documento?,
 *            confirmacion?, reemplaza?: id, estado?: "pendiente"|"vigente" }
 * ResultadoAporte = { ok, id?, estado?, entendido?, conflictoCon?, reemplazo?, duplicado?, paraConfirmar?, motivo? }
 * — la MISMA forma que el diseño §E espera de `aportarContexto` (para que la Etapa 3 lo llame sin traducir nada).
 *
 * ═══ CORRECCIÓN (owner 2026-09-26, ley aprobada, reportada por el supervisor tras el corte 9 de `capacidad/`):
 * «un dato declarado o leído de un documento se devuelve para confirmar ANTES de usarlo; proponer es del modelo,
 * confirmar es de la persona.» Antes de esta fecha, un aporte SIN colisión quedaba "vigente" de inmediato (sin
 * pedir nada) — eso violaba la ley: ADI proponía y usaba en el mismo paso. Ahora TODO aporte nuevo (declarado o
 * documento, las dos únicas procedencias que esta memoria admite) entra "pendiente", con `paraConfirmar:true` y
 * el `entendido` canónico, para que el LLM se lo devuelva a la persona ANTES de que cuente como dato. La ÚNICA
 * salida directa (sin pasar por "pendiente") es declarar EXACTAMENTE el mismo valor que YA está vigente — ahí no
 * hay nada nuevo que confirmar, es la misma afirmación de vuelta. `confirmarHecho` es el ÚNICO camino que promueve
 * un "pendiente" a "vigente" (con o sin conflicto que resolver: ver su cabecera) — y NUNCA toca el origen. */
export function declararHecho(store, tenantId, aporte, { actorLabel = null, conversacionId = null } = {}) {
  if (!tenantId) return { ok: false, motivo: "sin empresa: no se declara nada sin saber de qué empresa es" };
  if (!_es(aporte)) return { ok: false, motivo: "el aporte tiene que ser un objeto" };

  const clase = _normTxt(aporte.clase);
  if (!CLASES_HECHO_EMPRESA.includes(clase)) return { ok: false, motivo: `clase desconocida «${aporte.clase}» (${CLASES_HECHO_EMPRESA.join(" · ")})` };
  if (clase === "perfil") return { ok: false, motivo: "el perfil no se declara por esta vía: vive en `tenants` (adi_declarar_perfil_empresa, migraciones 012/013)" };

  const origen = _normTxt(aporte.origen || "declarado");
  if (!ORIGENES_HECHO_EMPRESA.includes(origen)) return { ok: false, motivo: `origen «${aporte.origen}» no admitido en la memoria de empresa (${ORIGENES_HECHO_EMPRESA.join(" · ")})` };
  if (!aporte.concepto || !String(aporte.concepto).trim()) return { ok: false, motivo: "falta el concepto del hecho" };
  if (origen === "documento" && !_es(aporte.documento)) return { ok: false, motivo: "un hecho de documento exige {documento:{nombre,tipo,parte,...}} (REVISIÓN 3 §4)" };
  if (_es(aporte.documento) && aporte.documento.sello != null && !SELLOS_DOCUMENTO.includes(_normTxt(aporte.documento.sello))) {
    return { ok: false, motivo: `sello de documento «${aporte.documento.sello}» desconocido (${SELLOS_DOCUMENTO.join(" · ")})` };
  }

  const valor = aporte.valor != null
    ? { raw: aporte.valor.raw != null && Number.isFinite(+aporte.valor.raw) ? +aporte.valor.raw : null, unidad: aporte.valor.unidad || null, texto: aporte.valor.texto != null ? String(aporte.valor.texto) : null }
    : null;

  const candidato = {
    clase, concepto: String(aporte.concepto).trim(), eje: aporte.eje || null, entidad: aporte.entidad || null,
    // «pendiente» SIEMPRE al nacer (ley 2026-09-26, ver la cabecera de esta función): proponer no es usar.
    periodo: aporte.periodo || null, valor, origen, documento: aporte.documento || null, confirmacion: null,
    estado: "pendiente", declaradoEn: _ahora(), actorLabel: actorLabel || null, conversacionId: conversacionId || null, reemplaza: null,
  };

  // la llave se compara contra lo VIGENTE **y contra lo PENDIENTE** (corrección 2026-09-26: desde que nace
  // "pendiente", una llave declarada dos veces antes de confirmarse tiene que seguir siendo LA MISMA fila —
  // "mismo aporte dos veces → mismo id, nunca dos filas nuevas al azar" — y un valor DISTINTO mientras la
  // primera sigue sin confirmar tiene que declararse en conflicto igual que si ya estuviera vigente).
  const clave = claveDeHecho(candidato);
  const colision = [...leerVigentes(store, tenantId, {}), ...leerPendientes(store, tenantId, {})].find((h) => claveDeHecho(h) === clave);

  if (colision) {
    /* (a) mismo valor que el YA vigente: nada nuevo que declarar ni que confirmar — se toca la confirmación si
     * vino, NUNCA el origen ni el valor. Es la ÚNICA salida directa (no pasa por "pendiente"). */
    if (_mismoValorDeclarado(candidato.valor, colision.valor)) {
      if (aporte.confirmacion) store.actualizarHechoEmpresa(tenantId, colision.id, { confirmacion: aporte.confirmacion });
      return { ok: true, id: colision.id, estado: colision.estado, entendido: colision, duplicado: true, paraConfirmar: colision.estado === "pendiente" };
    }
    /* (b) valor DISTINTO del vigente — con reemplazo EXPLÍCITO (`aporte.reemplaza`) o sin él, da IGUAL: nunca se
     * pisa en silencio y nunca se usa antes de confirmar. Entra "pendiente", con el conflicto declarado; si el
     * aporte nombró explícitamente a qué hecho reemplaza, ese vínculo viaja ya en `reemplaza` (queda escrito, pero
     * el retiro real del vigente ocurre RECIÉN al confirmar — `confirmarHecho({resolverConflicto:true})`, nunca acá). */
    const reemplazaExplicito = aporte.reemplaza && String(aporte.reemplaza) === String(colision.id);
    const guardado = store.guardarHechoEmpresa(tenantId, { ...candidato, id: _nuevoId(store), reemplaza: reemplazaExplicito ? colision.id : null });
    return { ok: true, id: guardado.id, estado: "pendiente", entendido: guardado, conflictoCon: colision.id, paraConfirmar: true };
  }

  const guardado = store.guardarHechoEmpresa(tenantId, { ...candidato, id: _nuevoId(store) });
  return { ok: true, id: guardado.id, estado: guardado.estado, entendido: guardado, paraConfirmar: true };
}

/** confirmarHecho(store, tenantId, id, opts?) → ResultadoAporte
 * La confirmación es un SELLO APARTE (`{por, cuando, medio, sobre}`) — NUNCA cambia el origen (ley del owner,
 * textual: «un dato confirmado de un contrato sigue viniendo del contrato»). `resolverConflicto:true` promueve
 * un hecho `"pendiente"` a `"vigente"` — ES EL ÚNICO CAMINO, desde la corrección 2026-09-26 («proponer es del
 * modelo, confirmar es de la persona»), para que CUALQUIER pendiente (con `conflictoCon` porque chocó con un
 * vigente, o sin él porque era la primera vez que se declaraba esa llave — `declararHecho` ya no deja nada
 * "vigente" de entrada) deje de serlo. Si además había un `conflictoCon` real (otro vigente con la misma llave),
 * ese otro se retira acá — nunca antes de confirmar. */
export function confirmarHecho(store, tenantId, id, { actorLabel = null, medio = "chat-anfitrion", resolverConflicto = false } = {}) {
  if (!tenantId) return { ok: false, motivo: "sin empresa: no se confirma nada sin saber de qué empresa es" };
  const todos = store.leerHechosEmpresa(tenantId) || [];
  const h = todos.find((x) => String(x.id) === String(id));
  if (!h) return { ok: false, motivo: `hecho «${id}» no existe` };

  const sello = { por: actorLabel, cuando: _ahora(), medio, sobre: { concepto: h.concepto, entidad: h.entidad, periodo: h.periodo, valor: h.valor } };
  const cambios = { confirmacion: sello };

  if (resolverConflicto && h.estado === "pendiente") {
    const clave = claveDeHecho(h);
    // el competidor puede ser VIGENTE (chocó contra lo ya confirmado) o él mismo PENDIENTE (dos declaraciones
    // sin confirmar todavía para la misma llave — corrección 2026-09-26: `declararHecho` ya compara contra
    // ambos estados, así que confirmar tiene que poder retirar cualquiera de los dos, nunca dejar un pendiente
    // huérfano compitiendo con el que se acaba de promover).
    const otro = todos.find((x) => (x.estado === "vigente" || x.estado === "pendiente") && String(x.id) !== String(h.id) && claveDeHecho(x) === clave);
    if (otro) store.actualizarHechoEmpresa(tenantId, otro.id, { estado: "retirado" });
    cambios.estado = "vigente";
    if (otro) cambios.reemplaza = otro.id;
  }

  const actualizado = store.actualizarHechoEmpresa(tenantId, id, cambios);
  if (!actualizado) return { ok: false, motivo: `hecho «${id}» no existe` };
  return { ok: true, id, estado: actualizado.estado, entendido: actualizado };
}

/** retirarHecho(store, tenantId, id, opts?) → { ok, id?, entendido?, motivo? }
 * Nunca borra: pasa a `"retirado"` con quién y por qué — la misma disciplina que `access_audit` (007/009/011). */
export function retirarHecho(store, tenantId, id, { motivo = null, actorLabel = null } = {}) {
  if (!tenantId) return { ok: false, motivo: "sin empresa: no se retira nada sin saber de qué empresa es" };
  const actualizado = store.actualizarHechoEmpresa(tenantId, id, { estado: "retirado", retiradoMotivo: motivo || null, retiradoPor: actorLabel || null, retiradoEn: _ahora() });
  if (!actualizado) return { ok: false, motivo: `hecho «${id}» no existe` };
  return { ok: true, id, entendido: actualizado };
}

/** omitirCampo(store, tenantId, {clase?, concepto, eje?, entidad?}, opts?) → { ok, id?, entendido?, motivo? }
 * «Prefiero no decirlo»: se guarda como un hecho sin valor y `estado:"omitido"`, para no volver a preguntarlo
 * (decisión del supervisor con las palabras del owner: no se repite en la MISMA conversación; en otra, solo si
 * una Entrega lo necesita y dice para qué — esa política de CUÁNDO preguntar es de la Etapa 3/`necesitaPerfil`,
 * fuera de esta pieza; acá solo se guarda el hecho de que se omitió, con su conversación de origen). */
export function omitirCampo(store, tenantId, { clase = "hecho", concepto, eje = null, entidad = null } = {}, { actorLabel = null, conversacionId = null } = {}) {
  if (!tenantId) return { ok: false, motivo: "sin empresa: no se omite nada sin saber de qué empresa es" };
  if (!concepto || !String(concepto).trim()) return { ok: false, motivo: "falta el concepto a omitir" };
  const candidato = {
    clase: _normTxt(clase), concepto: String(concepto).trim(), eje, entidad, periodo: null, valor: null,
    origen: "declarado", documento: null, confirmacion: null, estado: "omitido", declaradoEn: _ahora(),
    actorLabel: actorLabel || null, conversacionId: conversacionId || null, reemplaza: null,
  };
  const guardado = store.guardarHechoEmpresa(tenantId, { ...candidato, id: _nuevoId(store) });
  return { ok: true, id: guardado.id, entendido: guardado };
}

/** yaFueOmitido(store, tenantId, {concepto, eje?, entidad?}, {conversacionId?}) → boolean
 * true si YA se preguntó y se declinó: en la MISMA conversación siempre; en otra, solo si el omitido no traía
 * `conversacionId` (una omisión "para siempre", nunca inferida — la marca explícita la pone quien llama). */
export function yaFueOmitido(store, tenantId, { concepto, eje = null, entidad = null } = {}, { conversacionId = null } = {}) {
  const todos = (store.leerHechosEmpresa(tenantId) || []).filter((h) => h.estado === "omitido" && _pasaFiltro(h, { concepto, eje, entidad }));
  return todos.some((h) => !h.conversacionId || (conversacionId && String(h.conversacionId) === String(conversacionId)));
}

/* ── el perfil, SOLO como traducción de lectura (nunca se persiste desde acá) ──────────────────────────────── */
/** hechoDePerfilCampo(campo, {codigo, procedencia}) → HechoEmpresa-like | null
 * Traduce UN campo de `tenants` (012/013: procedencia `'medido'`|`'derivado'`, y desde la 015 también
 * `'declarado'`) al vocabulario de orígenes de esta memoria — SOLO para plegarlo en `memoriaDeEmpresa`, nunca
 * para escribir: `tenants.procedencia` usa un vocabulario PROPIO (012, textual: «'medido' (lo declaró el
 * usuario)»), distinto del de `notario/hechos.js` («medido» = del archivo) — por eso la traducción es:
 *   'medido' (= el usuario lo tipeó)   → origen "declarado"
 *   'declarado' (015, explícito)       → origen "declarado"
 *   'derivado' (= lo calculó el motor) → origen "medido" (es una medición de ADI sobre datos reales, p. ej. la
 *                                         banda de tamaño calculada desde la venta en UF — `bandaTamano.js`)
 * `origen:"medido"` acá es la ÚNICA excepción a `ORIGENES_HECHO_EMPRESA`: es de lectura, nunca se guarda. */
export function hechoDePerfilCampo(campo, { codigo, procedencia } = {}) {
  if (!campo || codigo == null || codigo === "") return null;
  const origen = _normTxt(procedencia) === "derivado" ? "medido" : "declarado";
  return {
    clase: "perfil", concepto: String(campo), eje: null, entidad: null, periodo: null,
    valor: { raw: null, unidad: null, texto: String(codigo) }, origen, documento: null, confirmacion: null,
    estado: "vigente", declaradoEn: null, actorLabel: null, conversacionId: null, reemplaza: null,
    soloLectura: true,
  };
}

/* ── migración EN LECTURA de lo que hoy vive en la versión activa (007 diario, 011 contexto) ────────────────── */
/** migrarLegado({diario?, contexto?}) → HechoEmpresa[] · PURO, sin store. Traduce sin perder nada:
 *   diario.tesis      → un hecho "tesis_de_la_relacion" (concepto), con la huella y el turno de origen guardados
 *                        aparte (para que una futura migración de datos real no pierda la trazabilidad).
 *   diario.intenciones → un hecho "intencion_declarada" por cada una (tope 10 en el diario, se copian todas).
 *   contexto.texto     → un hecho "contexto_del_negocio".
 * Cada uno lleva `migradoDeLegado` (para que `memoriaDeEmpresa` no lo duplique si ya se migró de verdad). */
export function migrarLegado({ diario = null, contexto = null } = {}) {
  const out = [];
  if (_es(diario) && _es(diario.tesis)) {
    const t = diario.tesis;
    out.push({
      clase: "hecho", concepto: "tesis_de_la_relacion", eje: null, entidad: null, periodo: null,
      valor: { raw: null, unidad: null, texto: t.resumen != null ? String(t.resumen) : null },
      origen: "declarado", documento: null, confirmacion: null, estado: "vigente",
      declaradoEn: t.fecha || null, actorLabel: null, conversacionId: t.origenTurno || null, reemplaza: null,
      migradoDeLegado: "diario", legadoClave: t.clave || null, legadoHuella: t.huella || null, legadoCarga: t.carga || null,
    });
  }
  for (const it of (_es(diario) && Array.isArray(diario.intenciones) ? diario.intenciones : [])) {
    if (!_es(it)) continue;
    out.push({
      clase: "hecho", concepto: "intencion_declarada", eje: null,
      entidad: (Array.isArray(it.entidades) && it.entidades[0]) || null, periodo: null,
      valor: { raw: null, unidad: null, texto: (it.pregunta || it.cita || null) && String(it.pregunta || it.cita) },
      origen: "declarado", documento: null, confirmacion: null, estado: "vigente",
      declaradoEn: it.fecha || null, actorLabel: null, conversacionId: null, reemplaza: null,
      migradoDeLegado: "diario", legadoCita: it.cita || null, legadoCarga: it.carga || null,
    });
  }
  if (_es(contexto) && contexto.texto) {
    out.push({
      clase: "hecho", concepto: "contexto_del_negocio", eje: null, entidad: null, periodo: null,
      valor: { raw: null, unidad: null, texto: String(contexto.texto) },
      origen: "declarado", documento: null, confirmacion: null, estado: "vigente",
      declaradoEn: contexto.fecha || null, actorLabel: null, conversacionId: null, reemplaza: null,
      migradoDeLegado: "contexto",
    });
  }
  return out;
}

/** memoriaDeEmpresa(store, tenantId, {legado?}) → { hechos: HechoEmpresa[] }
 * La vista ÚNICA que consume el resto del producto: vigentes de `memoria_empresa` + lo legado NO migrado aún
 * (traducido en lectura, `legado = {diario, contexto}` — leídos por el CALLER desde `pack.perfil.*`, esta pieza
 * no toca el pack). Si un hecho vigente YA trae `migradoDeLegado` con el mismo origen+concepto+entidad, el
 * legado correspondiente NO se repite — así, el día que una migración de datos real copie diario/contexto a la
 * tabla, `memoriaDeEmpresa` deja de traducir por sí sola sin que nadie tenga que tocar este módulo. */
export function memoriaDeEmpresa(store, tenantId, { legado = null } = {}) {
  const vigentes = leerVigentes(store, tenantId, {});
  const yaMigrados = new Set(vigentes.filter((h) => h.migradoDeLegado).map((h) => `${h.migradoDeLegado}:${_normTxt(h.concepto)}:${_normTxt(h.entidad || "")}`));
  const legadoTraducido = legado ? migrarLegado(legado).filter((h) => !yaMigrados.has(`${h.migradoDeLegado}:${_normTxt(h.concepto)}:${_normTxt(h.entidad || "")}`)) : [];
  return { hechos: [...vigentes, ...legadoTraducido] };
}
