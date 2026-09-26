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
function _entregaTextoCorta(e) {
  const temas = Array.isArray(e.temas) && e.temas.length ? e.temas.join("+") : null;
  const entidades = Array.isArray(e.entidades) && e.entidades.length ? e.entidades.join(", ") : null;
  const rango = e.hechos && e.hechos.length ? (e.hechos.length > 1 ? `${e.hechos[0].id}–${e.hechos[e.hechos.length - 1].id}` : e.hechos[0].id) : null;
  return [`E${e.n}`, temas, entidades, e.cierre, rango].filter(Boolean).join(" · ");
}

/** estadoVigenteDe(libro, {versionIdActual?}) → EstadoVigente (JSON compacto, ≤2KB) — lo que el LLM recibe en
 * la capa estructurada de CADA Entrega, con instrucción de NO narrarlo salvo que haya un evento (ver más abajo). */
export function estadoVigenteDe(libro, { versionIdActual = null } = {}) {
  if (!libro) return null;
  let loEntregado = (libro.entregas || []).slice(-6).map(_entregaTextoCorta);
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
} = {}) {
  const eventos = [];
  if (cambioVersion) {
    eventos.push({ tipo: "datos_cambiaron", texto: `los datos cambiaron desde la Entrega ${cambioVersion.desdeTurno}: ${cambioVersion.de} → ${cambioVersion.a}` });
  }
  for (const c of Array.isArray(cifrasReverificadas) ? cifrasReverificadas : []) {
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
