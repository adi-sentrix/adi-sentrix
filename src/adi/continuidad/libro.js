/* === src/adi/continuidad/libro.js · EL LIBRO DE CONVERSACIÓN (Etapa 2 · owner 2026-09-25/26) ══════════════════
 * `_ADI_DISENO_FLUJO_V2.md` §B «capa c»: «esta [tabla] NO guarda ni una frase» — el libro guarda REFERENCIAS
 * (ids + versión de datos) y lo que es PROPIO de la conversación: criterio vigente, supuestos de escenario
 * vivos, premisas con veredicto, ofertas en pie. REVISIÓN 2/3 del supervisor: no es una tabla nueva — vive como
 * la columna `estado jsonb` de `conversaciones` (migración 009), la misma fila que ya guarda `mensajes`.
 *
 * ID DE CONVERSACIÓN, EMITIDO POR ADI. «ADI lo emite en la primera Entrega (`meta.conversacionId`) y lo exige en
 * cada acción. Si el anfitrión no lo devuelve: se abre uno nuevo… y se pierde solo el libro, no la memoria de
 * empresa» (§B). `emitirConversacionId()` es la única fuente de un id nuevo — nadie más lo inventa.
 *
 * IDS ESTABLES DENTRO DE LA CONVERSACIÓN: `E<n>.h<k>` para un hecho de la Entrega n, `E<n>.u<k>` para un
 * universo. `n` es el TURNO en que se registró esa Entrega — nunca se reasigna, ni siquiera cuando el libro
 * recorta las más viejas (recortar cambia el CONTENIDO de la entrada, nunca su número).
 *
 * TOPES (decisión técnica del supervisor, ajustable tras medir — §7.6 del contrato de encargo): 16 KB por libro,
 * ≤ 12 Entregas, ≤ 3 supuestos vivos (= `SUPUESTOS_USUARIO_MAX`, `oracle/conversationScope.js` /
 * `encargo/esquema.js`). Al pasarse el tope, se recorta lo MÁS VIEJO — nunca las premisas ni el criterio vigente
 * (ley del owner, textual, corte 5 de `_ADI_DISENO_FLUJO_V2.md` §F): una Entrega recortada queda como esqueleto
 * `{n, temas, versionId, recortada:true}`, sin sus hechos ni universos.
 *
 * ═══ ETAPA 2, BLOQUE 4 · LO QUE EL LIBRO CONSERVA PARA REVALIDAR (owner 2026-10-04, decisión §7.3·59) ═══════════════════════
 * Retomar una conversación días después con datos recargados exige poder VOLVER A HACERLE AL CORE la misma pregunta y comparar cifra por cifra
 * (`revalidar.js`). Para eso cada Entrega guarda, ADEMÁS de lo de siempre (todo ADITIVO: lo guardado antes se sigue leyendo; no se migra nada):
 *   · por Entrega: `encargo` (el Encargo v1 recibido, sin `conversacionId`, sin `contexto` y sin `preguntaOriginal`: este libro «NO guarda ni una frase»),
 *     `referencias` (con qué criterios y referencia declarada se calculó), `moneda` y `revalidable: true` — la marca de que esa Entrega SÍ conservó
 *     el valor exacto y la pregunta (una sin ella es de antes de este bloque: se declara, no se adivina);
 *   · por hecho, UN campo aparte `rv` (los de siempre —`origen` guarda la PROCEDENCIA de la fila y no se renombra, `unidad` y `periodo` siguen en `null`— quedan
 *     intactos, y citar una respuesta anterior, `resolverContexto`, no lo muestra: no es lo que la Entrega dijo): `raw` (el valor exacto), `unidad`, `clave` (la clave
 *     canónica de la métrica), `dueno`, `titular` (de quién es el dato: medido · declarado · documento · supuesto), `procedencia` (cómo se obtuvo), `tipo` (de hecho),
 *     `prioridad` (la de su fila de Cifras: con ella se elige qué nombra la línea de continuidad) y `deSupuesto`;
 *   · por libro: `empresaId` (la empresa que lo creó — además de la llave del almacén, un libro de otra empresa se rechaza por su propio dato).
 * `retomar` NO escribe el libro: el pasado no se reescribe.
 * EL TOPE SE MIDIÓ Y SIGUE EN 16 KB: lo nuevo agrega ~145 bytes por hecho (`rv`) y ~0,25 KB por Entrega (el Encargo y las referencias): un hilo de cuatro Entregas con 27 hechos pasó de 6,5 KB a 11,8 KB (+80 %), así que un hilo largo esqueletiza antes
 * sus Entregas más viejas —se declaran «recortada» y no se revalidan—. Subir el tope no es un cambio de constante: la base lo exige (migración 015: `check pg_column_size(estado) <= 16384`
 * y la guarda de `adi_guardar_estado_conversacion`), y las migraciones se tocan con una migración nueva, a decisión del owner. Por eso `rv` va compacto (`titular:"medido"` y `tipo:"ref"` no se escriben).
 *
 * Puro: sin I/O — el CALLER decide cuándo leer/guardar con el almacén (`almacen.js`); estas funciones solo
 * transforman el objeto `Libro` (que siempre se trata como inmutable: cada función devuelve uno nuevo). */

export const LIBRO_TOPE_BYTES = 16 * 1024;
export const ENTREGAS_TOPE = 12;
export const SUPUESTOS_VIVOS_TOPE = 3; // = SUPUESTOS_USUARIO_MAX (oracle/conversationScope.js, encargo/esquema.js)
/* Las DERIVACIONES de la quinta acción `derivar` (Contrato del Anfitrión, owner 2026-10-05): hechos nuevos `D<k>` calculados por ADI sobre cifras ya entregadas (`libro.derivaciones[]`, aditivo). No consumen los cupos de Entregas ni mueven ningún `E<n>.h<k>`. */
export const DERIVACIONES_TOPE = 24;
export const VERSION_LIBRO = "libro/v1";
/* EL ORIGEN DEL HILO (Etapa 2, bloque 1 · D3): un libro de conversación es SIEMPRE un hilo del Complemento. Es el
 * dato ESTRUCTURAL con el que la base distingue estos hilos de los del chat de la app (`adi_listar_conversaciones`,
 * migración 015, solo lista `origen = 'app'`): ninguna fila fantasma —título vacío, cero mensajes— aparece en el
 * Historial de un usuario PRO, y no hay filtro por título vacío ni por conteo de mensajes. La base lo SELLA
 * ella misma al guardar (`adi_guardar_estado_conversacion`); acá se escribe también para que lo guardado y lo
 * leído sean idénticos. Cuando «retomar» llegue al chat directo (etapa 4), ese hilo llevará SU origen. */
export const ORIGEN_LIBRO = "complemento";

/* ═══ LA FORMA GUARDADA (ensayo 5, owner 2026-10-07 · `_ADI_DISENO_CONTRATO_ANFITRION.md` §11) ═══════════════════════════════════════════════════════════════
 * «Toda cifra que ADI entrega lleva un id que `derivar` y `retomar` pueden resolver mientras dure la conversación.» El tope de 16 KB es de la base (migración 015) y no se toca; lo que se pudo
 * hacer es no desperdiciarlo: una cifra del libro pesaba ~250 B porque repetía cada dato (el dueño dos veces, la procedencia dos veces, la prioridad, `ref`, el id, dos `null`) y nombraba cada
 * campo. La FORMA GUARDADA escribe la cifra regular como una tupla posicional y repone lo que se deduce de su lugar (el id, la prioridad, el dueño igual al sujeto…): ~100 B. Es SIN PÉRDIDA —
 * `expandirLibro(comprimirLibro(L))` es el mismo libro— y solo la ven los almacenes: todo lo demás (acciones, revalidar, derivar, estado vigente) trabaja con el libro de siempre. Lo que no
 * es regular (una fila ancha con `rv.mas`, una cifra con campos que esta forma no conoce, un libro anterior a este cambio) se guarda tal cual y se lee igual. Y `tamanoBytes(libro)` mide la
 * forma GUARDADA, que es la que la base limita. */
const _CLAVES_HECHO = new Set(["id", "sujeto", "metrica", "valor", "unidad", "periodo", "origen", "ref", "rv", "fuera"]);
const _CLAVES_RV = new Set(["raw", "unidad", "clave", "dueno", "titular", "procedencia", "tipo", "prioridad", "deSupuesto", "supuesto", "deListado", "filas"]);
const _esTxtONulo = (x) => x === null || typeof x === "string";
const _esObj = (x) => x !== null && typeof x === "object" && !Array.isArray(x);

/* un hecho regular → su tupla; cualquier otra cosa → null (se guarda tal cual) */
function _tuplaDeHecho(h, k, n) {
  if (!_esObj(h) || !Object.keys(h).every((c) => _CLAVES_HECHO.has(c))) return null;
  if (h.id !== `E${n}.h${k + 1}` || h.unidad !== null || h.periodo !== null) return null;
  if (!_esTxtONulo(h.sujeto) || !_esTxtONulo(h.metrica) || !_esTxtONulo(h.valor) || !_esTxtONulo(h.origen) || !_esTxtONulo(h.ref)) return null;
  if (!("sujeto" in h && "metrica" in h && "valor" in h && "origen" in h && "ref" in h) || ("fuera" in h && h.fuera !== true)) return null;
  const v = h.rv;
  if (!_esObj(v) || !Object.keys(v).every((c) => _CLAVES_RV.has(c))) return null;
  if (!Number.isFinite(v.raw) || typeof v.clave !== "string" || typeof v.unidad !== "string" || typeof v.dueno !== "string" || typeof v.procedencia !== "string") return null;
  if (("titular" in v && typeof v.titular !== "string") || ("tipo" in v && typeof v.tipo !== "string") || ("deSupuesto" in v && v.deSupuesto !== true) || ("supuesto" in v && (typeof v.supuesto !== "string" || !v.supuesto)) || ("deListado" in v && v.deListado !== true) || ("filas" in v && (typeof v.filas !== "string" || !v.filas))) return null;
  if ("prioridad" in v && !Number.isFinite(v.prioridad)) return null;
  const x = {};
  if (!("prioridad" in v)) x.np = 1; else if (v.prioridad !== k) x.p = v.prioridad;
  if ("titular" in v) x.s = v.titular;
  if ("tipo" in v) x.t = v.tipo;
  if (v.deSupuesto === true) x.d = 1;
  if (typeof v.supuesto === "string") x.u = v.supuesto;   /* ensayo 9: de QUÉ supuestos sale una cifra simulada («s1» · «s1+s2»): `derivar` dice «bajo el supuesto …» */
  if (v.deListado === true) x.l = 1;
  if (typeof v.filas === "string") x.r = v.filas;   /* el total de un listado: de qué filas es la suma (ensayo 8: retomar lo recalcula desde ellas) */
  if (h.fuera === true) x.f = 1;
  const t = [h.valor, v.raw, v.clave, v.unidad, h.sujeto, h.metrica, h.sujeto !== null && v.dueno === h.sujeto ? 0 : v.dueno, v.procedencia, h.origen === v.procedencia ? 0 : h.origen, h.ref === `e${k + 1}` ? 0 : h.ref];
  if (Object.keys(x).length) t.push(x);
  else while (t.length > 8 && t[t.length - 1] === 0) t.pop();
  return t;
}
function _hechoDeTupla(t, k, n) {
  const [valor, raw, clave, unidad, sujeto, metrica, dn, procedencia, og, rf, x = {}] = t;
  const rv = { raw, unidad, clave, dueno: dn === 0 || dn === undefined ? sujeto : dn, ...(x.s !== undefined ? { titular: x.s } : {}), procedencia, ...(x.t !== undefined ? { tipo: x.t } : {}), ...(x.d ? { deSupuesto: true } : {}), ...(x.u !== undefined ? { supuesto: x.u } : {}), ...(x.l ? { deListado: true } : {}), ...(x.r !== undefined ? { filas: x.r } : {}), ...(x.np ? {} : { prioridad: x.p !== undefined ? x.p : k }) };
  return { sujeto, metrica, valor, unidad: null, periodo: null, origen: og === 0 || og === undefined ? procedencia : og, ref: rf === 0 || rf === undefined ? `e${k + 1}` : rf, rv, ...(x.f ? { fuera: true } : {}), id: `E${n}.h${k + 1}` };
}

/* una cifra de APOYO (lo que el texto imprime además de la tabla: la referencia, una comparación) → su tupla; el id es `E<n>.<sufijo>` y solo se guarda el sufijo. Una de apoyo sin cifra exacta
 * (`{id}` a secas) se guarda como el sufijo: ADI sabe que existe y por qué no se deriva. */
function _tuplaDeApoyo(a, n) {
  if (!_esObj(a) || typeof a.id !== "string" || !a.id.startsWith(`E${n}.`)) return null;
  const sufijo = a.id.slice(String(n).length + 2);
  if (!sufijo || Object.keys(a).some((c) => c !== "id" && c !== "rv")) return null;
  if (!("rv" in a)) return sufijo;
  const v = a.rv;
  if (!_esObj(v) || !Object.keys(v).every((c) => ["raw", "unidad", "clave", "dueno", "titular", "procedencia", "tipo", "origenRef", "premisa"].includes(c))) return null;
  if (!Number.isFinite(v.raw) || typeof v.clave !== "string" || typeof v.unidad !== "string" || typeof v.dueno !== "string" || typeof v.procedencia !== "string") return null;
  if (("titular" in v && typeof v.titular !== "string") || ("tipo" in v && typeof v.tipo !== "string") || ("origenRef" in v && typeof v.origenRef !== "string") || ("premisa" in v && v.premisa !== true)) return null;
  const x = {};
  if ("titular" in v) x.s = v.titular;
  if ("tipo" in v) x.t = v.tipo;
  if ("origenRef" in v) x.o = v.origenRef;
  if (v.premisa === true) x.p = 1;
  const t = [sufijo, v.raw, v.clave, v.unidad, v.dueno, v.procedencia];
  if (Object.keys(x).length) t.push(x);
  return t;
}
function _apoyoDeTupla(t, n) {
  if (typeof t === "string") return { id: `E${n}.${t}` };
  const [sufijo, raw, clave, unidad, dueno, procedencia, x = {}] = t;
  return { id: `E${n}.${sufijo}`, rv: { raw, unidad, clave, dueno, ...(x.s !== undefined ? { titular: x.s } : {}), procedencia, ...(x.t !== undefined ? { tipo: x.t } : {}), ...(x.o !== undefined ? { origenRef: x.o } : {}), ...(x.p ? { premisa: true } : {}) } };
}

/* un UNIVERSO de una Entrega (el conjunto sobre el que se pidió) → su tupla. Los campos en su valor por omisión (diez de quince en un universo común) no se escriben. */
const _CLAVES_UNIVERSO = ["id", "eje", "top", "base", "texto", "valido", "estados", "excluir", "filtros", "periodo", "criterio", "entidades", "no_estados", "soloRanking", "errorValidacion"];
const _UNIVERSO_POR_OMISION = { top: null, base: null, valido: true, estados: null, excluir: null, filtros: null, periodo: null, criterio: null, no_estados: null, soloRanking: false, errorValidacion: null };
function _tuplaDeUniverso(u) {
  if (!_esObj(u) || Object.keys(u).length !== _CLAVES_UNIVERSO.length || !_CLAVES_UNIVERSO.every((c) => c in u)) return null;
  if (typeof u.id !== "string" || !_esTxtONulo(u.eje) || !_esTxtONulo(u.texto) || !Array.isArray(u.entidades) || !u.entidades.every((x) => typeof x === "string")) return null;
  const x = {};
  for (const [c, d] of Object.entries(_UNIVERSO_POR_OMISION)) if (JSON.stringify(u[c]) !== JSON.stringify(d)) x[c] = u[c];
  const t = [u.id, u.eje, u.texto, u.entidades];
  if (Object.keys(x).length) t.push(x);
  return t;
}
function _universoDeTupla(t) {
  const [id, eje, texto, entidades, x = {}] = t;
  const v = (c) => (c in x ? x[c] : _UNIVERSO_POR_OMISION[c]);
  return { id, eje, top: v("top"), base: v("base"), texto, valido: v("valido"), estados: v("estados"), excluir: v("excluir"), filtros: v("filtros"), periodo: v("periodo"), criterio: v("criterio"), entidades, no_estados: v("no_estados"), soloRanking: v("soloRanking"), errorValidacion: v("errorValidacion") };
}

/* ═══ LO REPETIDO SE ESCRIBE UNA VEZ (segunda pasada, sin pérdida y sin saber qué es cada campo) ═══════════════════════════════════════════════════════════════════════
 * Un libro repite lo mismo en cada Entrega: el período, las referencias, la moneda, los nombres de las cuentas, el rótulo de cada métrica. Todo valor (texto, lista u objeto) que aparece dos o más veces y cuya
 * repetición ahorra bytes se escribe UNA vez en la tabla \`_d\` y cada aparición queda como el texto «§<índice>». Un texto verdadero que empieza con «§» se escribe «§§…» (así nunca se confunde). Solo se usa
 * si el resultado pesa menos. \`expandirLibro\` lo deshace antes que nada. */
const _MARCA = "§";
const _clonar = (v) => (v !== null && typeof v === "object" ? JSON.parse(JSON.stringify(v)) : v);
function _internar(doc) {
  if (!_esObj(doc) || "_d" in doc) return doc;
  const llaveDe = (x) => JSON.stringify(x);
  const cuenta = new Map();
  const contar = (x, esRaiz) => {
    if (Array.isArray(x)) { for (const y of x) contar(y, false); }
    else if (_esObj(x)) { for (const k of Object.keys(x)) contar(x[k], false); }
    else if (typeof x !== "string") return;
    if (esRaiz) return;
    const k = llaveDe(x);
    if (k.length < 8) return;   /* «"abc"» o «[]»: no ahorra nada */
    const c = cuenta.get(k);
    if (c) c.n += 1; else cuenta.set(k, { n: 1, val: x, len: k.length });
  };
  contar(doc, true);
  const TOK = 5;   /* «"§k"» con k de un dígito en base 36, y la coma */
  let elegidos = [...cuenta.entries()].filter(([, c]) => c.n >= 2 && c.n * c.len - (c.len + 1 + c.n * TOK) > 8)
    .sort((a, b) => (b[1].n * b[1].len - a[1].n * a[1].len) || (b[1].len - a[1].len) || (a[0] < b[0] ? -1 : 1));
  for (let vuelta = 0; vuelta < 4 && elegidos.length; vuelta++) {
    const indice = new Map(elegidos.map(([k], i) => [k, i]));
    const usos = new Array(elegidos.length).fill(0);
    const reemplazar = (x, esRaiz) => {
      if (!esRaiz && (typeof x === "string" || Array.isArray(x) || _esObj(x))) {
        const k = llaveDe(x);
        if (indice.has(k)) { usos[indice.get(k)] += 1; return `${_MARCA}${indice.get(k).toString(36)}`; }
      }
      if (typeof x === "string") return x.startsWith(_MARCA) ? _MARCA + x : x;
      if (Array.isArray(x)) return x.map((y) => reemplazar(y, false));
      if (_esObj(x)) { const r = {}; for (const k of Object.keys(x)) r[k] = reemplazar(x[k], false); return r; }
      return x;
    };
    const hecho = reemplazar(doc, true);
    if (usos.every((u) => u >= 2)) {
      const out = { ...hecho, _d: elegidos.map(([, c]) => c.val) };
      return tamanoJson(out) < tamanoJson(doc) ? out : doc;
    }
    elegidos = elegidos.filter((_, i) => usos[i] >= 2);   /* un valor anidado en otro que ya se tabuló quedó usado menos de dos veces: se quita y se vuelve a pasar */
  }
  return doc;
}
function _desinternar(doc) {
  if (!_esObj(doc) || !Array.isArray(doc._d)) return doc;
  const { _d: tabla, ...resto } = doc;
  const volver = (x) => {
    if (typeof x === "string") {
      if (!x.startsWith(_MARCA)) return x;
      if (x.startsWith(_MARCA + _MARCA)) return x.slice(1);
      const i = parseInt(x.slice(1), 36);
      return Number.isInteger(i) && i >= 0 && i < tabla.length ? _clonar(tabla[i]) : x;
    }
    if (Array.isArray(x)) return x.map(volver);
    if (_esObj(x)) { const r = {}; for (const k of Object.keys(x)) r[k] = volver(x[k]); return r; }
    return x;
  };
  return volver(resto);
}
function tamanoJson(x) { return new TextEncoder().encode(JSON.stringify(x)).length; }

/** comprimirLibro(libro) → la forma que se GUARDA (sin pérdida). Un libro que no es un libro vuelve tal cual. */
export function comprimirLibro(libro) {
  if (!_esObj(libro) || !Array.isArray(libro.entregas)) return libro;
  const entregas = libro.entregas.map((e) => {
    if (!_esObj(e) || e.recortada) return e;
    let r = e;
    if (Array.isArray(e.hechos) && e.hechos.length) r = { ...r, hechos: e.hechos.map((h, k) => _tuplaDeHecho(h, k, e.n) || h) };
    if (Array.isArray(e.apoyo) && e.apoyo.length) r = { ...r, apoyo: e.apoyo.map((a) => _tuplaDeApoyo(a, e.n) || a) };
    if (Array.isArray(e.universos) && e.universos.length) r = { ...r, universos: e.universos.map((u) => _tuplaDeUniverso(u) || u) };
    return r;
  });
  return _internar({ ...libro, entregas });
}
/** expandirLibro(libro) → el libro de siempre. Lo que ya está expandido (o es de antes de la forma guardada) pasa idéntico. */
export function expandirLibro(libro) {
  if (!_esObj(libro)) return libro;
  const L = _desinternar(libro);
  if (!Array.isArray(L.entregas)) return L;
  let cambio = false;
  const entregas = L.entregas.map((e) => {
    if (!_esObj(e) || e.recortada) return e;
    let r = e;
    if (Array.isArray(e.hechos) && e.hechos.some(Array.isArray)) { r = { ...r, hechos: e.hechos.map((h, k) => (Array.isArray(h) ? _hechoDeTupla(h, k, e.n) : h)) }; cambio = true; }
    if (Array.isArray(e.apoyo) && e.apoyo.some((a) => Array.isArray(a) || typeof a === "string")) { r = { ...r, apoyo: e.apoyo.map((a) => (Array.isArray(a) || typeof a === "string" ? _apoyoDeTupla(a, e.n) : a)) }; cambio = true; }
    if (Array.isArray(e.universos) && e.universos.some(Array.isArray)) { r = { ...r, universos: e.universos.map((u) => (Array.isArray(u) ? _universoDeTupla(u) : u)) }; cambio = true; }
    return r;
  });
  return cambio ? { ...L, entregas } : L;
}

/* tamaño en bytes de lo que de verdad se guarda (UTF-8, no `.length` de JS que cuenta unidades UTF-16) —
 * `TextEncoder` funciona igual en Node y en runtime edge, a diferencia de `Buffer` (regla del repo: nada que
 * dependa de un módulo de Node en un camino que pueda correr en edge). De un LIBRO mide su forma GUARDADA (`comprimirLibro`): es la que la base limita. */
export function tamanoBytes(obj) {
  try { return new TextEncoder().encode(JSON.stringify(_esObj(obj) && obj.version === VERSION_LIBRO ? comprimirLibro(obj) : obj)).length; } catch { return Infinity; }
}

/** emitirConversacionId() → string · un id NUEVO, emitido por ADI (nunca por el anfitrión ni por el LLM). */
export function emitirConversacionId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  // reserva sin dependencias, para un runtime sin `crypto.randomUUID` (Node viejo sin `--experimental-*`):
  // no es un UUID v4 verdadero, pero es único y suficientemente aleatorio para no colisionar en la práctica.
  return `conv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** libroNuevo({conversacionId?, versionId?, empresaId?}) → Libro · si no viene `conversacionId`, se emite uno. `empresaId` (bloque 4): la empresa que lo abre; sin él, el libro es el de siempre. */
export function libroNuevo({ conversacionId = null, versionId = null, empresaId = null } = {}) {
  return {
    version: VERSION_LIBRO,
    origen: ORIGEN_LIBRO,
    ...(empresaId ? { empresaId } : {}),
    conversacionId: conversacionId || emitirConversacionId(),
    versionIdInicial: versionId || null,
    turno: 0,
    datos: { versionId: versionId || null, cambio: null },
    criterioVigente: null,
    supuestosVivos: [],
    entregas: [],
    premisas: [],
    ofertasEnPie: [],
    hechosAportados: [],
  };
}

/** detectarCambioVersion(libro, versionIdActual) → {de, a, desdeTurno} | null
 * Compara la versión de datos de la ÚLTIMA Entrega registrada (o la inicial, si todavía no hay ninguna) contra
 * la versión activa que trae el turno actual. Sin versión previa declarada, no hay "cambio" que declarar
 * (primera Entrega de la conversación). */
export function detectarCambioVersion(libro, versionIdActual) {
  if (!libro || !versionIdActual) return null;
  const ultima = (libro.entregas && libro.entregas.length) ? libro.entregas[libro.entregas.length - 1].versionId : libro.versionIdInicial;
  if (!ultima || ultima === versionIdActual) return null;
  return { de: ultima, a: versionIdActual, desdeTurno: libro.turno };
}

/* una Entrega vieja recortada: solo lo que la ley permite conservar — "queda n, temas, versionId" (§B). */
function _esqueleto(e) {
  return { n: e.n, turno: e.turno, versionId: e.versionId || null, temas: Array.isArray(e.temas) ? e.temas.slice() : [], recortada: true };
}

/** recortarATope(libro) → Libro · aplica, EN ORDEN, tres recortes que NUNCA tocan `premisas` ni `criterioVigente`:
 *   1) más de `ENTREGAS_TOPE` entregas → las que sobran del tope (las MÁS viejas) se QUITAN del arreglo entero
 *      (§B del diseño: «entregas: […] ≤ 12» es un tope de CANTIDAD, no de tamaño — su `n`/id de hecho sigue
 *      siendo válido como referencia histórica, pero deja de listarse entre las Entregas activas);
 *   2) sigue por encima de `LIBRO_TOPE_BYTES` → de las que quedan, se esqueletizan de la más vieja a la más
 *      nueva (queda `{n, temas, versionId}`, sin hechos ni universos — "recortar" en el sentido del corte 5);
 *   3) sigue por encima → se recortan las ofertas en pie más viejas (lo menos esencial que queda).
 * Si aun así excede el tope (premisas+criterio+supuestos por sí solos superan 16 KB — un caso extremo que
 * ningún flujo real alcanza hoy), el libro se devuelve tal cual: la ley dice qué NO se toca, no que el tope sea
 * absoluto a cualquier costo. */
export function recortarATope(libro, tope = LIBRO_TOPE_BYTES) {   // `tope`: solo para los candados (la costura para probar el caso que la base no admite); en producción es siempre el de la base
  let L = libro;
  /* PASO 0 (Contrato del Anfitrión, 2026-10-05): más de `DERIVACIONES_TOPE` derivaciones → se quitan las MÁS viejas (su id `D<k>` no se reasigna jamás: lo garantiza `nDerivaciones`). Un libro sin derivaciones pasa idéntico. */
  if (Array.isArray(L.derivaciones) && L.derivaciones.length > DERIVACIONES_TOPE) {
    L = { ...L, derivaciones: L.derivaciones.slice(L.derivaciones.length - DERIVACIONES_TOPE) };
  }
  if (Array.isArray(L.entregas) && L.entregas.length > ENTREGAS_TOPE) {
    L = { ...L, entregas: L.entregas.slice(L.entregas.length - ENTREGAS_TOPE) };
  }
  let vueltas = 0;
  while (tamanoBytes(L) > tope && vueltas < (L.entregas ? L.entregas.length : 0)) {
    const idx = L.entregas.findIndex((e) => !e.recortada);
    if (idx < 0) break;
    const entregas = L.entregas.slice();
    entregas[idx] = _esqueleto(entregas[idx]);
    L = { ...L, entregas };
    vueltas++;
  }
  while (tamanoBytes(L) > tope && Array.isArray(L.ofertasEnPie) && L.ofertasEnPie.length > 0) {
    L = { ...L, ofertasEnPie: L.ofertasEnPie.slice(1) };
  }
  /* último recurso (Contrato del Anfitrión): si aun así excede el tope, las derivaciones más viejas ceden su lugar —nunca la más nueva, que es la que el anfitrión acaba de recibir—. Sin derivaciones, el libro sale como siempre. */
  while (tamanoBytes(L) > tope && Array.isArray(L.derivaciones) && L.derivaciones.length > 1) {
    L = { ...L, derivaciones: L.derivaciones.slice(1) };
  }
  return L;
}

/** registrarEntrega(libro, entrada) → Libro · avanza el turno, asigna ids `E<n>.h<k>`/`E<n>.u<k>` estables,
 * declara el cambio de versión si lo hay (§B: «los ids anteriores quedan con su versión») y aplica el tope.
 * entrada = { versionId, temas?, entidades?, cierre?, hechos?: [{sujeto,metrica,valor,unidad,periodo,universoId?,origen?, rv?: {raw,unidad,clave,dueno,titular,procedencia,tipo,prioridad,deSupuesto?}}], universos?: [...],
 *             entregadaEn?, periodo?, revalidable?, encargo?, referencias?, moneda? }
 * `revalidable: true` (bloque 4) viene CON `encargo`, `referencias` y `moneda`: sin esa marca la Entrega se guarda como siempre y retomar la declara «anterior a la revalidación».
 * `entregadaEn` (cuándo se entregó, ISO — lo pone quien llama con SU reloj: esta función no lee la hora) y `periodo`
 * (el período de los datos que la Entrega declara en su Marco) quedan con la Entrega: «lo entregado se conserva tal
 * cual» incluye CUÁNDO y SOBRE QUÉ CARGA se entregó, para que un retomar posterior pueda mostrarlo sin recalcular. */
export function registrarEntrega(libro, entrada = {}, { tope = LIBRO_TOPE_BYTES } = {}) {
  const turno = libro.turno + 1;
  const cambio = detectarCambioVersion(libro, entrada.versionId);
  const hechos = (Array.isArray(entrada.hechos) ? entrada.hechos : []).map((h, k) => ({ ...h, id: `E${turno}.h${k + 1}` }));
  const universos = (Array.isArray(entrada.universos) ? entrada.universos : []).map((u, k) => ({ ...u, id: u && u.id ? u.id : `E${turno}.u${k + 1}` }));
  const entrega = {
    n: turno, turno, versionId: entrada.versionId || null,
    temas: Array.isArray(entrada.temas) ? entrada.temas.slice() : [],
    entidades: Array.isArray(entrada.entidades) ? entrada.entidades.slice() : [],
    cierre: entrada.cierre || null, hechos, universos, recortada: false,
    ...(Array.isArray(entrada.apoyo) && entrada.apoyo.length ? { apoyo: entrada.apoyo } : {}),
    entregadaEn: entrada.entregadaEn || null, periodo: entrada.periodo || null,
    ...(entrada.revalidable === true ? { revalidable: true, encargo: entrada.encargo || null, referencias: entrada.referencias || null, moneda: entrada.moneda || null } : {}),
  };
  const L = {
    ...libro, turno,
    datos: { versionId: entrada.versionId || libro.datos.versionId || null, cambio: cambio || null },
    entregas: [...(libro.entregas || []), entrega],
  };
  return recortarATope(L, tope);
}

/** registrarDerivacion(libro, derivacion) → Libro · agrega una derivación con su id `D<k>`. El contador `nDerivaciones` es propio y solo crece: un id NUNCA se reutiliza aunque el libro recorte las derivaciones más viejas. Un libro sin el campo
 *  se lee igual (el contador arranca de lo que haya). No avanza el turno (una derivación no es una Entrega) y aplica el tope de tamaño como toda escritura. La derivación recibe el `turno` vigente. */
export function registrarDerivacion(libro, derivacion, { tope = LIBRO_TOPE_BYTES } = {}) {
  const previas = Array.isArray(libro.derivaciones) ? libro.derivaciones : [];
  const k = (Number.isInteger(libro.nDerivaciones) ? libro.nDerivaciones : previas.length) + 1;
  const d = { ...derivacion, id: `D${k}`, turno: libro.turno || 0 };
  return recortarATope({ ...libro, derivaciones: [...previas, d], nDerivaciones: k }, tope);
}

/** derivacionesDe(libro) → [derivación] · las que el libro conserva (copia del arreglo; vacío si el libro no las trae) */
export function derivacionesDe(libro) {
  return libro && Array.isArray(libro.derivaciones) ? libro.derivaciones.slice() : [];
}

/** actualizarCriterio(libro, criterioResuelto) → Libro
 * Solo cambia por `encargo.criterio` EXPLÍCITO del usuario (ley: «jamás se infiere»). Si todavía no hay
 * criterio vigente, se acepta también el default de ADI (origen "adi") — es el mismo valor determinístico que
 * `validarEncargo` ya resuelve cuando el usuario no pidió uno (nunca una adivinanza sobre prosa): sin esto, el
 * estado vigente no tendría qué mostrar en el primer turno («riesgo integrado (criterio de ADI)», §B). */
export function actualizarCriterio(libro, criterioResuelto) {
  if (!criterioResuelto) return libro;
  const esUsuario = criterioResuelto.origen === "usuario";
  if (!esUsuario && libro.criterioVigente) return libro; // ya hay uno vigente: un default de ADI no lo pisa
  return { ...libro, criterioVigente: { valor: criterioResuelto.lente ? { lente: criterioResuelto.lente } : { referencia: criterioResuelto.referencia }, origen: criterioResuelto.origen, alternativa: criterioResuelto.alternativa || null, desdeTurno: libro.turno + 1 } };
}

/** agregarSupuestoVivo(libro, supuesto) → Libro · ≤3 (SUPUESTOS_VIVOS_TOPE), el más nuevo primero, se cae el
 * más viejo — el mismo patrón que `oracle/conversationScope.js:_conSupuesto` ya usa para `SUPUESTOS_USUARIO_MAX`. */
export function agregarSupuestoVivo(libro, supuesto) {
  if (!supuesto || !supuesto.id) return libro;
  const sinDuplicado = (libro.supuestosVivos || []).filter((s) => s.id !== supuesto.id);
  const conTurno = { ...supuesto, turno: libro.turno + 1 };
  return { ...libro, supuestosVivos: [conTurno, ...sinDuplicado].slice(0, SUPUESTOS_VIVOS_TOPE) };
}

/** retirarSupuestoVivo(libro, id) → Libro · cuando el supuesto ya no aplica (el usuario lo abandona explícito). */
export function retirarSupuestoVivo(libro, id) {
  return { ...libro, supuestosVivos: (libro.supuestosVivos || []).filter((s) => s.id !== id) };
}

/** registrarPremisa(libro, premisa) → Libro · premisa = {id, hecho tipado, veredicto, verdadId?} (§1.3 del
 * Contrato del Encargo). NUNCA se recorta (ley del owner): las premisas sobreviven a cualquier tope de tamaño. */
export function registrarPremisa(libro, premisa) {
  if (!premisa || !premisa.id) return libro;
  const sinDuplicada = (libro.premisas || []).filter((p) => p.id !== premisa.id);
  return { ...libro, premisas: [...sinDuplicada, { ...premisa, turno: libro.turno + 1 }] };
}

/** registrarOfertaEnPie(libro, oferta) → Libro · oferta = {texto, encargoSugerido?}. */
export function registrarOfertaEnPie(libro, oferta) {
  if (!oferta || !oferta.texto) return libro;
  return { ...libro, ofertasEnPie: [...(libro.ofertasEnPie || []), { ...oferta, turno: libro.turno + 1 }] };
}

/** limpiarOfertasEnPie(libro) → Libro · una vez que el usuario tomó (o descartó) las ofertas del turno anterior. */
export function limpiarOfertasEnPie(libro) {
  return { ...libro, ofertasEnPie: [] };
}

/* ═══ CITAR UNA RESPUESTA ANTERIOR (Etapa 2, bloque 3 · owner 2026-10-03) ═════════════════════════════════════════════════
 * `encargo.contexto` (`E1`, `E1.h3`, `E1.u1`) apunta a lo que una Entrega YA entregó en ESTA conversación. Esta función es la ÚNICA que
 * traduce un id al contenido del libro, y lo trae TAL CUAL quedó guardado —sus hechos con id, la versión de la carga con que se entregó,
 * cuándo y el período—: nunca recalcula nada («el pasado no se reescribe»; revisar si una cifra cambió con los datos nuevos es del bloque 4).
 * Un id que no resuelve vuelve con su MOTIVO en palabras de negocio, para que quien consulta sepa qué pasó (no «no disponible» a secas).
 * Puro: sin I/O, sin red. El formato del id lo valida `encargo/validar.js` antes de llamar (un id mal formado no llega acá). */
const _ID_DE_CONTEXTO = /^E(\d+)(?:\.([hu])(\d+))?$/;
/* un hecho CITADO se trae como se entregó: lo que el libro conserva APARTE para revalidar (`rv`, bloque 4) no es parte de lo que la Entrega dijo, y citar una respuesta anterior no cambia por ello */
const _comoSeEntrego = (h) => { const { rv, ...comoSeDijo } = h || {}; return comoSeDijo; };
const _cabeceraDeEntrega = (e) => ({ n: e.n, versionId: e.versionId || null, entregadaEn: e.entregadaEn || null, periodo: e.periodo || null, temas: Array.isArray(e.temas) ? e.temas.slice() : [], entidades: Array.isArray(e.entidades) ? e.entidades.slice() : [], cierre: e.cierre || null, recortada: Boolean(e.recortada) });

/** resolverContexto(libro, id) → { ok:true, tipo:"entrega"|"hecho"|"universo", id, entrega, hecho?, universo? } | { ok:false, id, detalle } */
export function resolverContexto(libro, id) {
  const m = _ID_DE_CONTEXTO.exec(String(id == null ? "" : id));
  if (!m) return { ok: false, id, detalle: "el id no tiene la forma de una referencia a lo entregado (E3, E3.h2, E3.u1)" };
  if (!libro) return { ok: false, id, detalle: "esta conversación no tiene Entregas que citar: falta el conversacionId, o la conversación no existe" };
  const n = Number(m[1]);
  const entregas = Array.isArray(libro.entregas) ? libro.entregas : [];
  const e = entregas.find((x) => x && x.n === n);
  if (!e) {
    if (!entregas.length) return { ok: false, id, detalle: `la conversación todavía no tiene ninguna Entrega: ${id} no existe` };
    if (n >= 1 && n <= (libro.turno || 0)) return { ok: false, id, detalle: `la Entrega E${n} ya no se conserva en la conversación (el libro recorta las más viejas por tamaño)` };
    const primera = entregas[0].n, ultima = entregas[entregas.length - 1].n;
    return { ok: false, id, detalle: `la conversación tiene ${primera === ultima ? `la Entrega E${primera}` : `las Entregas E${primera} a E${ultima}`}: ${id} no existe` };
  }
  const entrega = _cabeceraDeEntrega(e);
  if (!m[2]) return { ok: true, tipo: "entrega", id, entrega, hechos: (Array.isArray(e.hechos) ? e.hechos : []).map(_comoSeEntrego), universos: (Array.isArray(e.universos) ? e.universos : []).map((u) => ({ ...u })) };
  if (e.recortada) return { ok: false, id, detalle: `la Entrega E${n} se recortó por tamaño: ya no conserva sus ${m[2] === "h" ? "hechos" : "universos"}` };
  const lista = (m[2] === "h" ? e.hechos : e.universos) || [];
  /* un HECHO se cita por su id (`registrarEntrega` siempre lo emite como `E<n>.h<k>`). Un UNIVERSO se cita por su POSICIÓN (`E<n>.u<k>` = el k-ésimo universo de esa Entrega): el libro conserva el id
   * con que el compositor lo nombró (`p1`, `p1_Lider`), que no es el que se cita; si la lista trae justo ese id, también resuelve. */
  const hallado = m[2] === "h" ? lista.find((x) => x && x.id === id) : (lista[Number(m[3]) - 1] || lista.find((x) => x && x.id === id));
  if (!hallado) return { ok: false, id, detalle: `la Entrega E${n} ${lista.length ? `tiene ${m[2] === "h" ? `los hechos ${lista[0].id} a ${lista[lista.length - 1].id}` : `${lista.length} universo${lista.length === 1 ? "" : "s"} (E${n}.u1${lista.length > 1 ? ` a E${n}.u${lista.length}` : ""})`}` : `no tiene ${m[2] === "h" ? "hechos" : "universos"}`}: ${id} no existe` };
  return m[2] === "h" ? { ok: true, tipo: "hecho", id, entrega, hecho: _comoSeEntrego(hallado) } : { ok: true, tipo: "universo", id, entrega, universo: { ...hallado } };
}

/** registrarHechoAportado(libro, hechoEmpresaId) → Libro · referencia (id) a un hecho de `memoria_empresa` que
 * esta conversación aportó — el libro NUNCA copia el valor, solo la referencia (ley: «las conversaciones solo
 * guardan referencias»). */
export function registrarHechoAportado(libro, hechoEmpresaId) {
  if (!hechoEmpresaId) return libro;
  if ((libro.hechosAportados || []).includes(hechoEmpresaId)) return libro;
  return { ...libro, hechosAportados: [...(libro.hechosAportados || []), hechoEmpresaId] };
}
