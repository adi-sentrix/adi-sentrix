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
 * Puro: sin I/O — el CALLER decide cuándo leer/guardar con el almacén (`almacen.js`); estas funciones solo
 * transforman el objeto `Libro` (que siempre se trata como inmutable: cada función devuelve uno nuevo). */

export const LIBRO_TOPE_BYTES = 16 * 1024;
export const ENTREGAS_TOPE = 12;
export const SUPUESTOS_VIVOS_TOPE = 3; // = SUPUESTOS_USUARIO_MAX (oracle/conversationScope.js, encargo/esquema.js)
export const VERSION_LIBRO = "libro/v1";

/* tamaño en bytes de lo que de verdad se guarda (UTF-8, no `.length` de JS que cuenta unidades UTF-16) —
 * `TextEncoder` funciona igual en Node y en runtime edge, a diferencia de `Buffer` (regla del repo: nada que
 * dependa de un módulo de Node en un camino que pueda correr en edge). */
export function tamanoBytes(obj) {
  try { return new TextEncoder().encode(JSON.stringify(obj)).length; } catch { return Infinity; }
}

/** emitirConversacionId() → string · un id NUEVO, emitido por ADI (nunca por el anfitrión ni por el LLM). */
export function emitirConversacionId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  // reserva sin dependencias, para un runtime sin `crypto.randomUUID` (Node viejo sin `--experimental-*`):
  // no es un UUID v4 verdadero, pero es único y suficientemente aleatorio para no colisionar en la práctica.
  return `conv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** libroNuevo({conversacionId?, versionId?}) → Libro · si no viene `conversacionId`, se emite uno. */
export function libroNuevo({ conversacionId = null, versionId = null } = {}) {
  return {
    version: VERSION_LIBRO,
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
export function recortarATope(libro) {
  let L = libro;
  if (Array.isArray(L.entregas) && L.entregas.length > ENTREGAS_TOPE) {
    L = { ...L, entregas: L.entregas.slice(L.entregas.length - ENTREGAS_TOPE) };
  }
  let vueltas = 0;
  while (tamanoBytes(L) > LIBRO_TOPE_BYTES && vueltas < (L.entregas ? L.entregas.length : 0)) {
    const idx = L.entregas.findIndex((e) => !e.recortada);
    if (idx < 0) break;
    const entregas = L.entregas.slice();
    entregas[idx] = _esqueleto(entregas[idx]);
    L = { ...L, entregas };
    vueltas++;
  }
  while (tamanoBytes(L) > LIBRO_TOPE_BYTES && Array.isArray(L.ofertasEnPie) && L.ofertasEnPie.length > 0) {
    L = { ...L, ofertasEnPie: L.ofertasEnPie.slice(1) };
  }
  return L;
}

/** registrarEntrega(libro, entrada) → Libro · avanza el turno, asigna ids `E<n>.h<k>`/`E<n>.u<k>` estables,
 * declara el cambio de versión si lo hay (§B: «los ids anteriores quedan con su versión») y aplica el tope.
 * entrada = { versionId, temas?, entidades?, cierre?, hechos?: [{sujeto,metrica,valor,unidad,periodo,universoId?,origen?}], universos?: [...] } */
export function registrarEntrega(libro, entrada = {}) {
  const turno = libro.turno + 1;
  const cambio = detectarCambioVersion(libro, entrada.versionId);
  const hechos = (Array.isArray(entrada.hechos) ? entrada.hechos : []).map((h, k) => ({ ...h, id: `E${turno}.h${k + 1}` }));
  const universos = (Array.isArray(entrada.universos) ? entrada.universos : []).map((u, k) => ({ ...u, id: u && u.id ? u.id : `E${turno}.u${k + 1}` }));
  const entrega = {
    n: turno, turno, versionId: entrada.versionId || null,
    temas: Array.isArray(entrada.temas) ? entrada.temas.slice() : [],
    entidades: Array.isArray(entrada.entidades) ? entrada.entidades.slice() : [],
    cierre: entrada.cierre || null, hechos, universos, recortada: false,
  };
  const L = {
    ...libro, turno,
    datos: { versionId: entrada.versionId || libro.datos.versionId || null, cambio: cambio || null },
    entregas: [...(libro.entregas || []), entrega],
  };
  return recortarATope(L);
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

/** registrarHechoAportado(libro, hechoEmpresaId) → Libro · referencia (id) a un hecho de `memoria_empresa` que
 * esta conversación aportó — el libro NUNCA copia el valor, solo la referencia (ley: «las conversaciones solo
 * guardan referencias»). */
export function registrarHechoAportado(libro, hechoEmpresaId) {
  if (!hechoEmpresaId) return libro;
  if ((libro.hechosAportados || []).includes(hechoEmpresaId)) return libro;
  return { ...libro, hechosAportados: [...(libro.hechosAportados || []), hechoEmpresaId] };
}
