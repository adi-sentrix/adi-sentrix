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
 * EL PERFIL (sector, tipo de producto, país, modelo comercial, banda de tamaño, moneda). El que viene de las
 * columnas de `tenants` (migraciones 012/013, detrás de `adi_declarar_perfil_empresa`) se lee con
 * `config/contract/perfilCliente.js` y este módulo no lo toca: `hechoDePerfilCampo` es un traductor PURO y de SOLO
 * LECTURA para que la vista unificada de «memoria de empresa» (`memoriaDeEmpresa`) muestre el perfil junto a los
 * criterios/hechos/documentos sin una segunda tabla ni una segunda verdad.
 *
 * ═══ ETAPA 2, BLOQUE 2 · EL PERFIL SE COMPLETA CONVERSANDO (owner 2026-09-25, aprobado; 2026-10-03) ═══════════════
 * El perfil que el anfitrión (el LLM) le saca a la persona conversando se guarda ACÁ, en la memoria de la empresa,
 * con origen «declarado» (nunca otro) y sigue la misma ley que todo aporte: nace «pendiente» y solo
 * `confirmarHecho` lo hace vigente (la confirmación es un sello aparte y no cambia el origen). ADI NO interpreta
 * lenguaje: el anfitrión devuelve el valor TIPADO (el código de una opción de la taxonomía) y `declararPerfilCampo`
 * lo valida contra la taxonomía cerrada (`config/contract/taxonomiaPerfil.js`); lo que no está en la lista se
 * rechaza diciendo cuáles son las válidas — nunca se inventa ni se «aproxima» un valor.
 *
 * CÓMO SE GUARDA (decisión 3 del bloque 2, owner 2026-10-03): una fila de perfil es `clase:"perfil"`, con el CAMPO
 * como concepto (`sector`, `tipoProducto`, `modeloComercial`, `pais` — sin prefijo) y el código en `valor.texto`. La
 * 015 admite esa clase (su check la lista y dos checks de forma la ligan a los cuatro campos y a «declarado»); es la
 * MISMA representación en la memoria del proceso y en Supabase, así que una prueba contra la memoria vale contra la
 * base. La clase «perfil» y los conceptos de perfil NO se pueden declarar por la vía genérica (`declararHecho` y
 * `omitirCampo` los rechazan; el almacén en memoria y la base también): la única puerta de entrada es
 * `declararPerfilCampo`, la que valida la taxonomía. Leer, declarar y omitir un campo de perfil
 * (`leerPerfilDeclarado`, `declararPerfilCampo`, `omitirPerfilCampo`) viven todos acá. `memoriaDeEmpresa` NO lista
 * estas filas entre los hechos (son perfil, no «un hecho»): el perfil se ve por `leerPerfilDeclarado`.
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

import { TAXONOMIA_PERFIL, validarTipoProductoDeSector } from "../../config/contract/taxonomiaPerfil.js";

export const CLASES_HECHO_EMPRESA = ["perfil", "criterio", "hecho", "documento"];

/* ── el perfil declarado conversando (ver la cabecera, «ETAPA 2, BLOQUE 2») ────────────────────────────────────── */
/** los campos del perfil que la persona declara (nunca el tamaño —se deriva— ni la moneda —se declara al cargar—),
 *  en el orden en que ADI los pregunta (la propuesta §6: sector → tipo de producto → a quién vende → país). */
export const CAMPOS_PERFIL_DECLARABLES = Object.freeze(["sector", "tipoProducto", "modeloComercial", "pais"]);
/** campo (camelCase, el de `tenant.perfil`) → su lista en la taxonomía (snake_case, la de la base). UNA sola tabla. */
export const LISTA_DE_CAMPO_PERFIL = Object.freeze({ sector: "sector", tipoProducto: "tipo_producto", modeloComercial: "modelo_comercial", pais: "pais" });
/** la clase con la que una fila de perfil vive en la memoria (la 015 la admite desde el 2026-10-03). */
export const CLASE_PERFIL = "perfil";
/** el concepto de una fila de perfil ES el campo, tal cual (sin prefijo): ver la cabecera, «CÓMO SE GUARDA». */
export const conceptoDePerfil = (campo) => String(campo);
/** campoDeConceptoDePerfil("sector") → "sector" · null si el concepto no es EXACTAMENTE uno de los campos del perfil. */
export function campoDeConceptoDePerfil(concepto) {
  const c = String(concepto == null ? "" : concepto).trim();
  return CAMPOS_PERFIL_DECLARABLES.includes(c) ? c : null;
}
/* los conceptos que SOLO una fila de clase «perfil» puede llevar: los cuatro campos (con otras mayúsculas o en el
 * snake_case de la taxonomía también) y el prefijo viejo `perfil:`. La MISMA lista que el check de la 015
 * (`memoria_empresa_perfil_reservado`): `_migracion_015_gate` vigila que no diverjan. */
const _CONCEPTOS_RESERVADOS = Object.freeze([...CAMPOS_PERFIL_DECLARABLES.map((c) => c.toLowerCase()), ...Object.values(LISTA_DE_CAMPO_PERFIL)]);
export const esConceptoReservadoDePerfil = (concepto) => {
  const c = String(concepto == null ? "" : concepto).trim().toLowerCase();
  return _CONCEPTOS_RESERVADOS.includes(c) || c.startsWith("perfil:");
};
/** formaDeFilaDeMemoria(fila) → { ok, motivo? } · la regla de FORMA que la base aplica con sus checks y que el almacén en
 *  memoria repite para que probar contra la memoria valga contra la base: la clase «perfil» ⇔ el concepto de un campo del
 *  perfil (exacto) con origen «declarado»; un criterio/hecho/documento nunca lleva un concepto de perfil. */
export function formaDeFilaDeMemoria(fila) {
  if (!_es(fila)) return { ok: false, motivo: "la fila no es un objeto" };
  const clase = _normTxt(fila.clase);
  if (clase === CLASE_PERFIL) {
    if (!campoDeConceptoDePerfil(fila.concepto)) return { ok: false, motivo: `clase «perfil» exige el concepto de uno de sus campos (${CAMPOS_PERFIL_DECLARABLES.join(" | ")}): «${fila.concepto}» no lo es` };
    if (_normTxt(fila.origen) !== "declarado") return { ok: false, motivo: `el perfil de la empresa solo se declara (origen declarado), nunca «${fila.origen}»` };
    return { ok: true };
  }
  if (esConceptoReservadoDePerfil(fila.concepto)) return { ok: false, motivo: `el concepto «${fila.concepto}» es de perfil: el perfil de la empresa se declara con la clase «perfil», no como ${fila.clase}` };
  return { ok: true };
}

/** validarValorDePerfil(campo, codigo, { sector? }) → { ok, codigo?, motivo?, validos? }
 *  ADI NO interpreta lenguaje: el valor ya viene TIPADO (el código de una opción). Acá solo se comprueba que ese código
 *  exista en la taxonomía cerrada del campo, y que un tipo de producto calce con el sector (la regla dura de la
 *  taxonomía). Si no, se rechaza diciendo cuáles son los válidos — nunca se corrige ni se aproxima. */
export function validarValorDePerfil(campo, codigo, { sector = null } = {}) {
  if (!CAMPOS_PERFIL_DECLARABLES.includes(campo)) return { ok: false, motivo: `«${campo}» no es un campo del perfil que se declare (${CAMPOS_PERFIL_DECLARABLES.join(" · ")})`, validos: [...CAMPOS_PERFIL_DECLARABLES] };
  const lista = TAXONOMIA_PERFIL[LISTA_DE_CAMPO_PERFIL[campo]] || [];
  if (typeof codigo !== "string" || !codigo.trim() || !lista.includes(codigo.trim())) {
    return { ok: false, motivo: `«${codigo == null ? "" : String(codigo)}» no es un valor válido de ${campo}: se declara el código de una de las opciones (${lista.join(" · ")})`, validos: [...lista] };
  }
  const limpio = codigo.trim();
  if (campo === "tipoProducto") {
    if (!sector) return { ok: false, motivo: "el tipo de producto solo se declara cuando el sector ya está declarado (aplica a distribución, fabricación y minorista)", validos: [...lista], falta: "sector" };
    const v = validarTipoProductoDeSector(sector, limpio);
    if (!v.ok) return { ok: false, motivo: v.motivo, validos: [...lista] };
  }
  return { ok: true, codigo: limpio };
}
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
  /* `Number(null)` es 0: sin esta guarda, dos valores SOLO de texto (raw nulo) se leían como «el mismo número 0» y una
   * declaración con otro texto para la misma llave se tragaba como duplicado, sin conflicto (hallado en el bloque 2 con el
   * perfil: un segundo sector no se registraba). El número solo compara cuando LOS DOS lo traen. */
  const ra = a.raw == null || a.raw === "" ? NaN : Number(a.raw), rb = b.raw == null || b.raw === "" ? NaN : Number(b.raw);
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

/* ═══ TODAS LAS FUNCIONES QUE TOCAN EL ALMACÉN SON ASÍNCRONAS (Etapa 2, bloque 1 · guardado durable) ═══════════════
 * El almacén es UNA sola interfaz y es asíncrona (`almacen.js`): cada `store.*` se ESPERA. Antes estas funciones
 * trataban la respuesta del almacén como un arreglo ya resuelto y reventaban contra el de Supabase
 * (`.filter is not a function`). Las funciones puras (`claveDeHecho`, `migrarLegado`, `hechoDePerfilCampo`) siguen
 * síncronas: no tocan el almacén. NINGUNA de estas funciones usa el estado global del tenant (`tenantStore`): el
 * tenant llega como `tenantId` por parámetro, así que se pueden esperar fuera del tramo del Core sin riesgo
 * (el aislamiento de ese tramo es de `capacidad/aislamiento.js`).
 *
 * OJO, DOCUMENTADO: leer-y-luego-escribir de `declararHecho`/`confirmarHecho` NO es atómico entre llamadas
 * concurrentes de la MISMA empresa; quien necesite esa garantía (las acciones de la capacidad) las serializa por
 * empresa con `serializar.js`. Entre instancias del servidor no hay candado de proceso: eso lo da la base. */

/** leerVigentes(store, tenantId, filtro?) → Promise<HechoEmpresa[]> · solo `estado:"vigente"`. */
export async function leerVigentes(store, tenantId, filtro = {}) {
  const todos = ((await store.leerHechosEmpresa(tenantId)) || []).filter((h) => h.estado === "vigente");
  return todos.filter((h) => _pasaFiltro(h, filtro));
}

/** leerHistoria(store, tenantId, filtro?) → Promise<HechoEmpresa[]> · vigentes + retirados, en orden de declaración —
 * para auditar una llave completa (qué se dijo, cuándo, qué lo reemplazó). Los omitidos NO son historia de un
 * valor (nunca hubo valor): se leen aparte con `estado:"omitido"` en el filtro si hace falta. */
export async function leerHistoria(store, tenantId, filtro = {}) {
  const todos = ((await store.leerHechosEmpresa(tenantId)) || []).filter((h) => h.estado === "vigente" || h.estado === "retirado");
  return todos.filter((h) => _pasaFiltro(h, filtro)).sort((a, b) => String(a.declaradoEn || "").localeCompare(String(b.declaradoEn || "")));
}

/** leerPendientes(store, tenantId, filtro?) → Promise<HechoEmpresa[]> · solo `estado:"pendiente"` — lo que ADI PROPUSO
 * (declarado o leído de un documento) y la persona todavía NO confirmó (ley 2026-09-26, cabecera de
 * `declararHecho`). Existe para que quien exponga "el estado" (`conocerEmpresa`/`capacidad/acciones.js`) pueda
 * mostrarlo SEPARADO de `leerVigentes` — nunca mezclado como si ya fuera dato: un pendiente se anuncia como
 * "pendiente de confirmar", jamás se usa en una Entrega ni se cuenta como parte de lo que la empresa "ya sabe". */
export async function leerPendientes(store, tenantId, filtro = {}) {
  const todos = ((await store.leerHechosEmpresa(tenantId)) || []).filter((h) => h.estado === "pendiente");
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
export async function declararHecho(store, tenantId, aporte, { actorLabel = null, conversacionId = null } = {}) {
  if (!tenantId) return { ok: false, motivo: "sin empresa: no se declara nada sin saber de qué empresa es" };
  if (!_es(aporte)) return { ok: false, motivo: "el aporte tiene que ser un objeto" };

  const clase = _normTxt(aporte.clase);
  if (!CLASES_HECHO_EMPRESA.includes(clase)) return { ok: false, motivo: `clase desconocida «${aporte.clase}» (${CLASES_HECHO_EMPRESA.join(" · ")})` };
  /* el perfil se declara por su propia vía (`declararPerfilCampo`, que valida la taxonomía); acá, por la vía
   * genérica, ni como clase ni con el concepto de un campo de perfil — si no, un hecho cualquiera con ese concepto se
   * saltaría la validación. El motivo que viaja al LLM va en palabras de negocio, sin nombres internos (supervisor
   * 2026-09-26). */
  if (clase === "perfil" || esConceptoReservadoDePerfil(aporte.concepto)) return { ok: false, motivo: "el perfil de la empresa se declara por su propia vía (clase «perfil», con el valor de una de las opciones ofrecidas), no como un hecho de la memoria" };

  const origen = _normTxt(aporte.origen || "declarado");
  if (!ORIGENES_HECHO_EMPRESA.includes(origen)) return { ok: false, motivo: `origen «${aporte.origen}» no admitido en la memoria de empresa (${ORIGENES_HECHO_EMPRESA.join(" · ")})` };
  if (!aporte.concepto || !String(aporte.concepto).trim()) return { ok: false, motivo: "falta el concepto del hecho" };
  if (origen === "documento" && !_es(aporte.documento)) return { ok: false, motivo: "un dato tomado de un documento necesita decir de qué documento y de qué parte viene" };
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

  return _colisionarYGuardar(store, tenantId, candidato, aporte);
}

/* LA ESCRITURA COMÚN (la comparten la vía genérica `declararHecho` y la del perfil `declararPerfilCampo`): compara la
 * llave contra lo vigente y lo pendiente, y guarda SIEMPRE «pendiente» (o devuelve el duplicado). Cada vía valida
 * ANTES de llamarla; esta función no valida nada y no decide qué se puede declarar. */
async function _colisionarYGuardar(store, tenantId, candidato, aporte) {
  // la llave se compara contra lo VIGENTE **y contra lo PENDIENTE** (corrección 2026-09-26: desde que nace
  // "pendiente", una llave declarada dos veces antes de confirmarse tiene que seguir siendo LA MISMA fila —
  // "mismo aporte dos veces → mismo id, nunca dos filas nuevas al azar" — y un valor DISTINTO mientras la
  // primera sigue sin confirmar tiene que declararse en conflicto igual que si ya estuviera vigente).
  const clave = claveDeHecho(candidato);
  // UNA sola lectura del almacén (antes eran dos: vigentes y pendientes) — misma regla, un viaje a la base menos.
  const todosLosHechos = (await store.leerHechosEmpresa(tenantId)) || [];
  const colision = [...todosLosHechos.filter((h) => h.estado === "vigente"), ...todosLosHechos.filter((h) => h.estado === "pendiente")].find((h) => claveDeHecho(h) === clave);

  if (colision) {
    /* (a) mismo valor que el YA vigente: nada nuevo que declarar ni que confirmar — se toca la confirmación si
     * vino, NUNCA el origen ni el valor. Es la ÚNICA salida directa (no pasa por "pendiente"). */
    if (_mismoValorDeclarado(candidato.valor, colision.valor)) {
      if (aporte.confirmacion) await store.actualizarHechoEmpresa(tenantId, colision.id, { confirmacion: aporte.confirmacion });
      return { ok: true, id: colision.id, estado: colision.estado, entendido: colision, duplicado: true, paraConfirmar: colision.estado === "pendiente" };
    }
    /* (b) valor DISTINTO del vigente — con reemplazo EXPLÍCITO (`aporte.reemplaza`) o sin él, da IGUAL: nunca se
     * pisa en silencio y nunca se usa antes de confirmar. Entra "pendiente", con el conflicto declarado; si el
     * aporte nombró explícitamente a qué hecho reemplaza, ese vínculo viaja ya en `reemplaza` (queda escrito, pero
     * el retiro real del vigente ocurre RECIÉN al confirmar — `confirmarHecho({resolverConflicto:true})`, nunca acá). */
    const reemplazaExplicito = aporte.reemplaza && String(aporte.reemplaza) === String(colision.id);
    const guardado = await store.guardarHechoEmpresa(tenantId, { ...candidato, id: _nuevoId(store), reemplaza: reemplazaExplicito ? colision.id : null });
    return { ok: true, id: guardado.id, estado: "pendiente", entendido: guardado, conflictoCon: colision.id, paraConfirmar: true };
  }

  const guardado = await store.guardarHechoEmpresa(tenantId, { ...candidato, id: _nuevoId(store) });
  return { ok: true, id: guardado.id, estado: guardado.estado, entendido: guardado, paraConfirmar: true };
}

/* ── EL PERFIL DECLARADO (bloque 2): leer, declarar y omitir un campo — todo lo que conoce la clase «perfil» ── */

/** leerPerfilDeclarado(store, tenantId) → { vigentes, pendientes, omitidos } — cada uno `{ [campo]: ... }`.
 *  Solo cuenta una fila de perfil BIEN FORMADA: clase «perfil» con el concepto de un campo que existe, origen «declarado» y un
 *  código que está en la taxonomía. Cualquier otra cosa (una fila escrita por fuera de `declararPerfilCampo`, un
 *  código que la taxonomía ya no tiene) se IGNORA — falla cerrado: nunca se sirve un sector que la taxonomía no avala.
 *  `omitidos[campo]` = la lista de omisiones (cada una con la conversación en que se omitió). Una sola lectura. */
export async function leerPerfilDeclarado(store, tenantId) {
  return _perfilDeLasFilas((await store.leerHechosEmpresa(tenantId)) || []);
}
/** perfilDeLasFilas(filas) → { vigentes, pendientes, omitidos } · lo mismo que `leerPerfilDeclarado`, sobre filas que quien llama YA leyó (una sola lectura de la memoria por consulta: Etapa 2, bloque 3). */
export function perfilDeLasFilas(filas) { return _perfilDeLasFilas(filas); }
function _perfilDeLasFilas(todos) {
  const out = { vigentes: {}, pendientes: {}, omitidos: {} };
  const masReciente = (a, b) => (!a || String(b.declaradoEn || "") >= String(a.declaradoEn || "") ? b : a);
  for (const h of todos) {
    const campo = campoDeConceptoDePerfil(h.concepto);
    if (!campo || h.clase !== CLASE_PERFIL) continue;
    if (h.estado === "omitido") { (out.omitidos[campo] = out.omitidos[campo] || []).push({ id: h.id, conversacionId: h.conversacionId || null, declaradoEn: h.declaradoEn || null }); continue; }
    if (h.estado !== "vigente" && h.estado !== "pendiente") continue;
    if (_normTxt(h.origen) !== "declarado") continue;
    const codigo = h.valor && typeof h.valor.texto === "string" ? h.valor.texto : null;
    if (!codigo || !(TAXONOMIA_PERFIL[LISTA_DE_CAMPO_PERFIL[campo]] || []).includes(codigo)) continue;
    const fila = { id: h.id, valor: codigo, origen: "declarado", declaradoEn: h.declaradoEn || null, confirmacion: h.confirmacion || null };
    const destino = h.estado === "vigente" ? out.vigentes : out.pendientes;
    destino[campo] = masReciente(destino[campo], fila);
  }
  return out;
}

/** declararPerfilCampo(store, tenantId, { campo, codigo, sectorDelDataset? }, opts?) → ResultadoAporte | { ok:false, motivo, validos }
 *  La ÚNICA puerta de entrada del perfil a la memoria. Valida contra la taxonomía (`validarValorDePerfil`) y guarda con
 *  origen «declarado»; nace «pendiente» como todo aporte (la persona lo confirma con `confirmarHecho`). El sector con el
 *  que se juzga un tipo de producto es el de la ficha de la empresa si lo hay, y si no el de la memoria. */
export async function declararPerfilCampo(store, tenantId, { campo, codigo, sectorDelDataset = null } = {}, { actorLabel = null, conversacionId = null } = {}) {
  if (!tenantId) return { ok: false, motivo: "sin empresa: no se declara nada sin saber de qué empresa es" };
  const filas = (await store.leerHechosEmpresa(tenantId)) || [];
  let sector = sectorDelDataset || null;
  if (campo === "tipoProducto" && !sector) {
    const e = _perfilDeLasFilas(filas);
    sector = (e.vigentes.sector && e.vigentes.sector.valor) || (e.pendientes.sector && e.pendientes.sector.valor) || null;
  }
  const v = validarValorDePerfil(campo, codigo, { sector });
  if (!v.ok) return { ok: false, motivo: v.motivo, validos: v.validos, ...(v.falta ? { falta: v.falta } : {}) };
  /* UNA sola propuesta pendiente por campo: lo último que la persona dijo es lo que queda por confirmar. Una propuesta
   * pendiente DISTINTA de ese mismo campo se retira (con su motivo; nunca se borra) — si no, repetir un valor anterior
   * devolvería la fila vieja y «lo último que dijo» no sería lo último que se lee (hallado con las conversaciones al azar). */
  for (const h of filas) {
    if (h.estado === "pendiente" && h.clase === CLASE_PERFIL && h.concepto === conceptoDePerfil(campo) && !(h.valor && h.valor.texto === v.codigo)) {
      await store.actualizarHechoEmpresa(tenantId, h.id, { estado: "retirado", retiradoMotivo: "reemplazada por una declaración posterior de la misma persona, todavía sin confirmar", retiradoPor: actorLabel || null, retiradoEn: _ahora() });
    }
  }
  const candidato = {
    clase: CLASE_PERFIL, concepto: conceptoDePerfil(campo), eje: null, entidad: null, periodo: null,
    valor: { raw: null, unidad: null, texto: v.codigo }, origen: "declarado", documento: null, confirmacion: null,
    estado: "pendiente", declaradoEn: _ahora(), actorLabel: actorLabel || null, conversacionId: conversacionId || null, reemplaza: null,
  };
  return _colisionarYGuardar(store, tenantId, candidato, {});
}

/** omitirPerfilCampo(store, tenantId, campo, opts?) → { ok, id?, duplicado?, motivo? }
 *  «Prefiero no decirlo»: usa `omitirCampo`/`yaFueOmitido` (la política de cuándo volver a preguntar es de
 *  `capacidad/perfilConversando.js`). Omitir lo ya declarado no tiene sentido y se rechaza; omitir dos veces en la
 *  misma conversación es la misma omisión. */
export async function omitirPerfilCampo(store, tenantId, campo, { actorLabel = null, conversacionId = null } = {}) {
  if (!tenantId) return { ok: false, motivo: "sin empresa: no se omite nada sin saber de qué empresa es" };
  if (!CAMPOS_PERFIL_DECLARABLES.includes(campo)) return { ok: false, motivo: `«${campo}» no es un campo del perfil (${CAMPOS_PERFIL_DECLARABLES.join(" · ")})` };
  const e = await leerPerfilDeclarado(store, tenantId);
  if (e.vigentes[campo]) return { ok: false, motivo: `el campo ${campo} ya está declarado: no se omite lo que la empresa ya dijo (para cambiarlo, se declara el valor nuevo)` };
  const concepto = conceptoDePerfil(campo);
  if (await yaFueOmitido(store, tenantId, { clase: CLASE_PERFIL, concepto }, { conversacionId })) return { ok: true, duplicado: true };
  return await _guardarOmision(store, tenantId, { clase: CLASE_PERFIL, concepto }, { actorLabel, conversacionId });
}

/** confirmarHecho(store, tenantId, id, opts?) → ResultadoAporte
 * La confirmación es un SELLO APARTE (`{por, cuando, medio, sobre}`) — NUNCA cambia el origen (ley del owner,
 * textual: «un dato confirmado de un contrato sigue viniendo del contrato»). `resolverConflicto:true` promueve
 * un hecho `"pendiente"` a `"vigente"` — ES EL ÚNICO CAMINO, desde la corrección 2026-09-26 («proponer es del
 * modelo, confirmar es de la persona»), para que CUALQUIER pendiente (con `conflictoCon` porque chocó con un
 * vigente, o sin él porque era la primera vez que se declaraba esa llave — `declararHecho` ya no deja nada
 * "vigente" de entrada) deje de serlo. Si además había un `conflictoCon` real (otro vigente con la misma llave),
 * ese otro se retira acá — nunca antes de confirmar. */
export async function confirmarHecho(store, tenantId, id, { actorLabel = null, medio = "chat-anfitrion", resolverConflicto = false } = {}) {
  if (!tenantId) return { ok: false, motivo: "sin empresa: no se confirma nada sin saber de qué empresa es" };
  const todos = (await store.leerHechosEmpresa(tenantId)) || [];
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
    /* TODOS los competidores de la misma llave se retiran —no solo el primero—: si no, una declaración que quedó pendiente
     * detrás de otra (p. ej. un valor pendiente y luego otro, con uno ya vigente) reaparecería «por confirmar» después
     * de que otra se confirmó (bloque 2, hallado con las conversaciones al azar). Con un solo competidor, igual que antes. */
    const otros = todos.filter((x) => (x.estado === "vigente" || x.estado === "pendiente") && String(x.id) !== String(h.id) && claveDeHecho(x) === clave);
    for (const o of otros) await store.actualizarHechoEmpresa(tenantId, o.id, { estado: "retirado" });
    const otro = otros.find((x) => x.estado === "vigente") || otros[0] || null;
    cambios.estado = "vigente";
    if (otro) cambios.reemplaza = otro.id;
  }

  const actualizado = await store.actualizarHechoEmpresa(tenantId, id, cambios);
  if (!actualizado) return { ok: false, motivo: `hecho «${id}» no existe` };
  return { ok: true, id, estado: actualizado.estado, entendido: actualizado };
}

/** retirarHecho(store, tenantId, id, opts?) → { ok, id?, entendido?, motivo? }
 * Nunca borra: pasa a `"retirado"` con quién y por qué — la misma disciplina que `access_audit` (007/009/011). */
export async function retirarHecho(store, tenantId, id, { motivo = null, actorLabel = null } = {}) {
  if (!tenantId) return { ok: false, motivo: "sin empresa: no se retira nada sin saber de qué empresa es" };
  const actualizado = await store.actualizarHechoEmpresa(tenantId, id, { estado: "retirado", retiradoMotivo: motivo || null, retiradoPor: actorLabel || null, retiradoEn: _ahora() });
  if (!actualizado) return { ok: false, motivo: `hecho «${id}» no existe` };
  return { ok: true, id, entendido: actualizado };
}

/** omitirCampo(store, tenantId, {clase?, concepto, eje?, entidad?}, opts?) → { ok, id?, entendido?, motivo? }
 * «Prefiero no decirlo»: se guarda como un hecho sin valor y `estado:"omitido"`, para no volver a preguntarlo
 * (decisión del supervisor con las palabras del owner: no se repite en la MISMA conversación; en otra, solo si
 * una Entrega lo necesita y dice para qué — esa política de CUÁNDO preguntar es de la Etapa 3/`necesitaPerfil`,
 * fuera de esta pieza; acá solo se guarda el hecho de que se omitió, con su conversación de origen). */
export async function omitirCampo(store, tenantId, { clase = "hecho", concepto, eje = null, entidad = null } = {}, { actorLabel = null, conversacionId = null } = {}) {
  if (!tenantId) return { ok: false, motivo: "sin empresa: no se omite nada sin saber de qué empresa es" };
  if (!concepto || !String(concepto).trim()) return { ok: false, motivo: "falta el concepto a omitir" };
  // un campo del perfil se omite por su propia vía (`omitirPerfilCampo`), igual que se declara por la suya
  if (_normTxt(clase) === CLASE_PERFIL || esConceptoReservadoDePerfil(concepto)) return { ok: false, motivo: "el perfil de la empresa se omite por su propia vía (clase «perfil»), no como un hecho de la memoria" };
  return _guardarOmision(store, tenantId, { clase, concepto, eje, entidad }, { actorLabel, conversacionId });
}
/* la escritura común de una omisión (la comparten `omitirCampo` y `omitirPerfilCampo`): cada vía valida ANTES de llamarla. */
async function _guardarOmision(store, tenantId, { clase = "hecho", concepto, eje = null, entidad = null } = {}, { actorLabel = null, conversacionId = null } = {}) {
  const candidato = {
    clase: _normTxt(clase), concepto: String(concepto).trim(), eje, entidad, periodo: null, valor: null,
    origen: "declarado", documento: null, confirmacion: null, estado: "omitido", declaradoEn: _ahora(),
    actorLabel: actorLabel || null, conversacionId: conversacionId || null, reemplaza: null,
  };
  const guardado = await store.guardarHechoEmpresa(tenantId, { ...candidato, id: _nuevoId(store) });
  return { ok: true, id: guardado.id, entendido: guardado };
}

/** yaFueOmitido(store, tenantId, {concepto, eje?, entidad?}, {conversacionId?}) → boolean
 * true si YA se preguntó y se declinó: en la MISMA conversación siempre; en otra, solo si el omitido no traía
 * `conversacionId` (una omisión "para siempre", nunca inferida — la marca explícita la pone quien llama). */
export async function yaFueOmitido(store, tenantId, { clase = null, concepto, eje = null, entidad = null } = {}, { conversacionId = null } = {}) {
  const todos = ((await store.leerHechosEmpresa(tenantId)) || []).filter((h) => h.estado === "omitido" && _pasaFiltro(h, { clase, concepto, eje, entidad }));
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
export async function memoriaDeEmpresa(store, tenantId, { legado = null } = {}) {
  // las filas de perfil (clase «perfil») no son «hechos»: se leen con `leerPerfilDeclarado`, validadas contra la taxonomía
  const vigentes = (await leerVigentes(store, tenantId, {})).filter((h) => _normTxt(h.clase) !== CLASE_PERFIL && !esConceptoReservadoDePerfil(h.concepto));
  const yaMigrados = new Set(vigentes.filter((h) => h.migradoDeLegado).map((h) => `${h.migradoDeLegado}:${_normTxt(h.concepto)}:${_normTxt(h.entidad || "")}`));
  const legadoTraducido = legado ? migrarLegado(legado).filter((h) => !yaMigrados.has(`${h.migradoDeLegado}:${_normTxt(h.concepto)}:${_normTxt(h.entidad || "")}`)) : [];
  return { hechos: [...vigentes, ...legadoTraducido] };
}
