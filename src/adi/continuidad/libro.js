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
/* EL ORIGEN DEL HILO (Etapa 2, bloque 1 · D3): un libro de conversación es SIEMPRE un hilo del Complemento. Es el
 * dato ESTRUCTURAL con el que la base distingue estos hilos de los del chat de la app (`adi_listar_conversaciones`,
 * migración 015, solo lista `origen = 'app'`): ninguna fila fantasma —título vacío, cero mensajes— aparece en el
 * Historial de un usuario PRO, y no hay filtro por título vacío ni por conteo de mensajes. La base lo SELLA
 * ella misma al guardar (`adi_guardar_estado_conversacion`); acá se escribe también para que lo guardado y lo
 * leído sean idénticos. Cuando «retomar» llegue al chat directo (etapa 4), ese hilo llevará SU origen. */
export const ORIGEN_LIBRO = "complemento";

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
    origen: ORIGEN_LIBRO,
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
 * entrada = { versionId, temas?, entidades?, cierre?, hechos?: [{sujeto,metrica,valor,unidad,periodo,universoId?,origen?}], universos?: [...],
 *             entregadaEn?, periodo? }
 * `entregadaEn` (cuándo se entregó, ISO — lo pone quien llama con SU reloj: esta función no lee la hora) y `periodo`
 * (el período de los datos que la Entrega declara en su Marco) quedan con la Entrega: «lo entregado se conserva tal
 * cual» incluye CUÁNDO y SOBRE QUÉ CARGA se entregó, para que un retomar posterior pueda mostrarlo sin recalcular. */
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
    entregadaEn: entrada.entregadaEn || null, periodo: entrada.periodo || null,
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

/* ═══ CITAR UNA RESPUESTA ANTERIOR (Etapa 2, bloque 3 · owner 2026-10-03) ═════════════════════════════════════════════════
 * `encargo.contexto` (`E1`, `E1.h3`, `E1.u1`) apunta a lo que una Entrega YA entregó en ESTA conversación. Esta función es la ÚNICA que
 * traduce un id al contenido del libro, y lo trae TAL CUAL quedó guardado —sus hechos con id, la versión de la carga con que se entregó,
 * cuándo y el período—: nunca recalcula nada («el pasado no se reescribe»; revisar si una cifra cambió con los datos nuevos es del bloque 4).
 * Un id que no resuelve vuelve con su MOTIVO en palabras de negocio, para que quien consulta sepa qué pasó (no «no disponible» a secas).
 * Puro: sin I/O, sin red. El formato del id lo valida `encargo/validar.js` antes de llamar (un id mal formado no llega acá). */
const _ID_DE_CONTEXTO = /^E(\d+)(?:\.([hu])(\d+))?$/;
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
  if (!m[2]) return { ok: true, tipo: "entrega", id, entrega, hechos: (Array.isArray(e.hechos) ? e.hechos : []).map((h) => ({ ...h })), universos: (Array.isArray(e.universos) ? e.universos : []).map((u) => ({ ...u })) };
  if (e.recortada) return { ok: false, id, detalle: `la Entrega E${n} se recortó por tamaño: ya no conserva sus ${m[2] === "h" ? "hechos" : "universos"}` };
  const lista = (m[2] === "h" ? e.hechos : e.universos) || [];
  /* un HECHO se cita por su id (`registrarEntrega` siempre lo emite como `E<n>.h<k>`). Un UNIVERSO se cita por su POSICIÓN (`E<n>.u<k>` = el k-ésimo universo de esa Entrega): el libro conserva el id
   * con que el compositor lo nombró (`p1`, `p1_Lider`), que no es el que se cita; si la lista trae justo ese id, también resuelve. */
  const hallado = m[2] === "h" ? lista.find((x) => x && x.id === id) : (lista[Number(m[3]) - 1] || lista.find((x) => x && x.id === id));
  if (!hallado) return { ok: false, id, detalle: `la Entrega E${n} ${lista.length ? `tiene ${m[2] === "h" ? `los hechos ${lista[0].id} a ${lista[lista.length - 1].id}` : `${lista.length} universo${lista.length === 1 ? "" : "s"} (E${n}.u1${lista.length > 1 ? ` a E${n}.u${lista.length}` : ""})`}` : `no tiene ${m[2] === "h" ? "hechos" : "universos"}`}: ${id} no existe` };
  return m[2] === "h" ? { ok: true, tipo: "hecho", id, entrega, hecho: { ...hallado } } : { ok: true, tipo: "universo", id, entrega, universo: { ...hallado } };
}

/** registrarHechoAportado(libro, hechoEmpresaId) → Libro · referencia (id) a un hecho de `memoria_empresa` que
 * esta conversación aportó — el libro NUNCA copia el valor, solo la referencia (ley: «las conversaciones solo
 * guardan referencias»). */
export function registrarHechoAportado(libro, hechoEmpresaId) {
  if (!hechoEmpresaId) return libro;
  if ((libro.hechosAportados || []).includes(hechoEmpresaId)) return libro;
  return { ...libro, hechosAportados: [...(libro.hechosAportados || []), hechoEmpresaId] };
}
