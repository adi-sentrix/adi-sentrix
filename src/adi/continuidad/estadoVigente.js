/* === src/adi/continuidad/estadoVigente.js · EL ESTADO VIGENTE Y LOS EVENTOS DE CONTINUIDAD (Etapa 2) ══════════
 * REVISIÓN 3 §3 de `_ADI_DISENO_FLUJO_V2.md`, textual: «el estado vigente viaja en la capa ESTRUCTURADA para el
 * LLM (con la instrucción de no narrarlo), no en el texto. ADI mantiene la coherencia por sí sola… Al texto
 * narrable solo sale UNA línea y SOLO ante un evento.» Los cinco eventos, textuales: los datos cambiaron · una
 * cifra ya entregada ahora vale otra cosa · una premisa del usuario contradice lo entregado · cambió el criterio
 * · un supuesto de escenario sigue vivo y afecta la respuesta. SIN evento, CERO texto de continuidad — la
 * continuidad se siente invisible mientras no hay nada que aclarar (ley del owner).
 *
 * Puro: solo transforma lo que ya trae el `Libro` (`libro.js`) — no re-verifica nada (eso es `retomar.js`, que
 * SÍ recibe un verificador inyectado, porque re-verificar exige la evidencia real del pack).
 *
 * TAMAÑO. `estadoVigenteDe` devuelve un objeto JSON ≤ `ESTADO_VIGENTE_TOPE_BYTES` (2 KB) y
 * `estadoVigenteTextoCorto` un resumen de ≤ `ESTADO_VIGENTE_TOPE_TEXTO` caracteres (900) — los dos topes del
 * diseño v2 §B, ajustables tras medir (igual que los de `libro.js`). */
import { formatoDeLaCasa } from "../notario/hechos.js";

export const ESTADO_VIGENTE_TOPE_BYTES = 2 * 1024;
export const ESTADO_VIGENTE_TOPE_TEXTO = 900;
export const TIPOS_DE_EVENTO = ["datos_cambiaron", "cifra_cambio", "premisa_contradice", "criterio_cambio", "supuesto_vivo_afecta"];

function _bytes(obj) { try { return new TextEncoder().encode(JSON.stringify(obj)).length; } catch { return Infinity; } }

function _criterioTexto(c) {
  if (!c) return null;
  const dueño = c.origen === "usuario" ? "pedido por usted" : "criterio de ADI";
  if (c.valor && c.valor.lente) return `${c.valor.lente} (${dueño})`;
  if (c.valor && c.valor.referencia) return `${c.valor.referencia.concepto} = ${c.valor.referencia.valor}${c.valor.referencia.unidad || ""} (declarado por usted)`;
  return null;
}
function _supuestoTexto(s) {
  const valor = s.valor != null && Number.isFinite(+s.valor) && s.unidad ? formatoDeLaCasa(+s.valor, s.unidad) : (s.delta != null ? `${s.delta > 0 ? "+" : ""}${s.delta}${s.unidad || ""}` : "");
  const alcance = s.alcance && typeof s.alcance === "object" ? s.alcance.nombre : s.alcance;
  return `${alcance ? alcance + " · " : ""}${s.concepto || ""} ${valor}`.trim() + (s.turno ? ` (E${s.turno})` : "");
}
/* LO YA ENTREGADO, CITABLE POR ID (ensayo 10, owner 2026-10-09 · `_ADI_DISENO_CONTRATO_ANFITRION.md` §16): cuando el anfitrión dice «como vimos antes» necesita saber DE QUIÉN y de QUÉ MÉTRICA es cada cifra entregada, con el id para consultarla —no recordarla—. Por cada métrica de la tabla de la Entrega
 * (hasta `METRICAS_INDEXADAS_MAX`), los primeros `DUENOS_INDEXADOS_MAX` dueños con su id y cuántos más hay («Saldo vencido: Lider E2.h1, Falabella E2.h2, Sodimac E2.h3 (+10)»): es el orden de la tabla tal como se entregó, NO un orden por esa métrica (el orden se le pide a ADI: coincidencia o top).
 * Solo de las Entregas anteriores a la de este turno (esa se acaba de recibir completa); va ANTES de la lista de entidades de siempre (que se conserva: quiénes se entregaron). El detalle completo de cada cifra sigue siendo `retomar`. Cabe en el mismo tope de 2 KB de este resumen: si sobra, se acorta primero `loEntregado`, lo más viejo primero. */
export const METRICAS_INDEXADAS_MAX = 3;
export const DUENOS_INDEXADOS_MAX = 3;
function _indiceDeLaEntrega(tabla) {
  const porMetrica = new Map();
  for (const h of tabla) {
    if (!h || !h.sujeto || !h.metrica || !h.id) continue;   /* un total del listado no tiene dueño: no se indexa por dueño */
    if (!porMetrica.has(h.metrica)) porMetrica.set(h.metrica, []);
    porMetrica.get(h.metrica).push(`${h.sujeto} ${h.id}`);
  }
  return [...porMetrica].slice(0, METRICAS_INDEXADAS_MAX).map(([m, xs]) => `${m}: ${xs.slice(0, DUENOS_INDEXADOS_MAX).join(", ")}${xs.length > DUENOS_INDEXADOS_MAX ? ` (+${xs.length - DUENOS_INDEXADOS_MAX})` : ""}`).join(" · ");
}
function _entregaTextoCorta(e, { conIndice = false } = {}) {
  const temas = Array.isArray(e.temas) && e.temas.length ? e.temas.join("+") : null;
  const entidades = Array.isArray(e.entidades) && e.entidades.length ? e.entidades.join(", ") : null;
  const _tabla = Array.isArray(e.hechos) ? e.hechos.filter((h) => !(h && h.fuera)) : [];   /* el rango es el de la tabla de la Entrega: las cifras de `fueraDelTexto` (con id, `fuera:true`) no lo mueven */
  const rango = _tabla.length ? (_tabla.length > 1 ? `${_tabla[0].id}–${_tabla[_tabla.length - 1].id}` : _tabla[0].id) : null;
  const indice = conIndice ? _indiceDeLaEntrega(_tabla) : "";
  return [`E${e.n}`, temas, indice, entidades, e.cierre, rango].filter(Boolean).join(" · ");
}

/** estadoVigenteDe(libro, {versionIdActual?}) → EstadoVigente (JSON compacto, ≤2KB) — lo que el LLM recibe en
 * la capa estructurada de CADA Entrega, con instrucción de NO narrarlo salvo que haya un evento (ver más abajo). */
export function estadoVigenteDe(libro, { versionIdActual = null } = {}) {
  if (!libro) return null;
  const entregas = libro.entregas || [], ultima = entregas[entregas.length - 1];
  let loEntregado = entregas.slice(-6).map((e) => _entregaTextoCorta(e, { conIndice: e !== ultima }));   /* el índice por dueño es de lo ya entregado ANTES: la Entrega de este turno el anfitrión la acaba de recibir completa */
  let estado = {
    conversacionId: libro.conversacionId,
    turno: libro.turno,
    datos: { version: versionIdActual || libro.datos.versionId || null, cambio: libro.datos.cambio || null },
    criterio: _criterioTexto(libro.criterioVigente),
    supuestosVivos: (libro.supuestosVivos || []).map(_supuestoTexto),
    loEntregado,
    premisasPendientes: (libro.premisas || []).filter((p) => p.veredicto == null).map((p) => p.id),
    hechosAportados: (libro.hechosAportados || []).slice(),
  };
  // el tope es de EXHIBICIÓN, nunca de las premisas/criterio (misma ley que `libro.js:recortarATope`): si
  // sobra, se acorta primero `loEntregado` (lo más prescindible de este resumen).
  while (_bytes(estado) > ESTADO_VIGENTE_TOPE_BYTES && estado.loEntregado.length > 0) {
    estado = { ...estado, loEntregado: estado.loEntregado.slice(1) };
  }
  return estado;
}

/** estadoVigenteTextoCorto(estadoVigente) → string ≤900 caracteres · una síntesis en prosa MÍNIMA, para un
 * canal que solo acepta texto (nunca para narrar al usuario sin que medie un evento: ver `lineaDeContinuidad`). */
export function estadoVigenteTextoCorto(ev) {
  if (!ev) return "";
  const partes = [];
  if (ev.criterio) partes.push(`Criterio vigente: ${ev.criterio}.`);
  if (ev.supuestosVivos && ev.supuestosVivos.length) partes.push(`Supuestos vivos: ${ev.supuestosVivos.join("; ")}.`);
  if (ev.loEntregado && ev.loEntregado.length) partes.push(`Entregado antes: ${ev.loEntregado.join(" | ")}.`);
  if (ev.premisasPendientes && ev.premisasPendientes.length) partes.push(`Premisas pendientes de veredicto: ${ev.premisasPendientes.join(", ")}.`);
  let texto = partes.join(" ");
  if (texto.length > ESTADO_VIGENTE_TOPE_TEXTO) texto = texto.slice(0, ESTADO_VIGENTE_TOPE_TEXTO - 1).trimEnd() + "…";
  return texto;
}

/** eventosDeContinuidad({...}) → Evento[] · SOLO estos cinco tipos, cada uno con su texto ya armado (la casa
 * redacta, no el LLM) — sin ellos, `lineaDeContinuidad` devuelve null y no hay nada que decir. */
export function eventosDeContinuidad({
  cambioVersion = null,               // {de, a, desdeTurno} | null — de `libro.detectarCambioVersion`
  cifrasReverificadas = [],           // [{id, label, estado:"cambio"|"ya_no_existe", valorNuevo?}]
  premisasFalsas = [],                // [{id, texto}] — premisas de ESTE turno cuyo veredicto contradice lo entregado
  criterioCambio = null,              // {de, a} | null
  supuestosVivosRelevantes = [],      // [{id, texto}] — supuestos vivos que el encargo de ESTE turno usa
  /* BLOQUE 4 (owner 2026-10-04) — RETOMAR REVALIDANDO. `cambiosDeCifras` = { nombrados:[{label, estado:"cambio"|"ya_no_existe", antes, ahora?}], adicionales } es lo que la línea dice de las cifras
   * ya entregadas: UN solo evento `cifra_cambio` que nombra hasta 3 cambios (los elige `revalidar.js:elegirCambiosANombrar`, no este archivo) y dice cuántos más hay — nunca solo el conteo y nunca una
   * lista que se alarga. `lenguajeDeNegocio` quita los ids de carga del evento de datos («1 → 2», «v3»): la persona oye «los datos», no una versión. Sin ninguno de los dos, el texto es el de siempre. */
  cambiosDeCifras = null,
  lenguajeDeNegocio = false,
} = {}) {
  const eventos = [];
  if (cambioVersion) {
    eventos.push({ tipo: "datos_cambiaron", texto: lenguajeDeNegocio ? `los datos cambiaron desde la Entrega ${cambioVersion.desdeTurno}` : `los datos cambiaron desde la Entrega ${cambioVersion.desdeTurno}: ${cambioVersion.de} → ${cambioVersion.a}` });
  }
  if (cambiosDeCifras && Array.isArray(cambiosDeCifras.nombrados) && cambiosDeCifras.nombrados.length) {
    const dicho = cambiosDeCifras.nombrados.map((c) => (c.estado === "ya_no_existe"
      ? `${c.label} (antes ${c.antes != null ? c.antes : "otro valor"}; ya no figura en los datos actuales)`
      : `${c.label} (antes ${c.antes != null ? c.antes : "otro valor"}, ahora ${c.ahora != null ? c.ahora : "otro valor"})`));
    const mas = Number.isFinite(cambiosDeCifras.adicionales) ? cambiosDeCifras.adicionales : 0;
    eventos.push({ tipo: "cifra_cambio", texto: `de lo ya entregado, con los datos actuales cambiaron: ${dicho.join(", ")}${mas > 0 ? `, y ${mas} ${mas === 1 ? "cambio" : "cambios"} más; el detalle está disponible` : ""}` });
  }
  for (const c of cambiosDeCifras ? [] : (Array.isArray(cifrasReverificadas) ? cifrasReverificadas : [])) {
    if (c.estado === "cambio") eventos.push({ tipo: "cifra_cambio", texto: `${c.label || c.id} ya no vale lo mismo: ahora ${c.valorNuevo != null ? c.valorNuevo : "otro valor"}` });
    else if (c.estado === "ya_no_existe") eventos.push({ tipo: "cifra_cambio", texto: `${c.label || c.id} ya no está en los datos vigentes` });
  }
  for (const p of Array.isArray(premisasFalsas) ? premisasFalsas : []) {
    eventos.push({ tipo: "premisa_contradice", texto: `lo que usted da por hecho sobre ${p.texto || p.id} no coincide con lo entregado` });
  }
  if (criterioCambio) eventos.push({ tipo: "criterio_cambio", texto: `el criterio cambió: ahora ordena por ${criterioCambio.a}` });
  for (const s of Array.isArray(supuestosVivosRelevantes) ? supuestosVivosRelevantes : []) {
    eventos.push({ tipo: "supuesto_vivo_afecta", texto: `sigue vivo el supuesto ${s.texto || s.id}, y afecta esta respuesta` });
  }
  return eventos;
}

/** lineaDeContinuidad(eventos) → string | null · UNA línea, solo si hay eventos — jamás una por evento (ley:
 * «al texto narrable solo sale UNA línea»). null cuando `eventos` está vacío: es la señal de «cero texto». */
export function lineaDeContinuidad(eventos) {
  const es = (Array.isArray(eventos) ? eventos : []).filter(Boolean);
  if (!es.length) return null;
  return es.map((e) => e.texto).join(" · ");
}
