/* === src/adi/agente/contratoAgente.js · LA LETRA DEL CONTRATO Y SU VETO MECÁNICO (F3 · owner 2026-08-30) =====
 *
 * DOS PIEZAS, deliberadamente juntas (la letra y su candado se leen en la misma página):
 *
 *   1 · LA LETRA — los PRINCIPIOS del agente en estilo Code: frases cortas, imperativas, cero prosa. El owner
 *       pidió el arco como PRINCIPIO (no como plantilla) y una sección de FORMA con el mismo estilo. La
 *       invariante nueva va acá con su palabra textual: «ese qué hacer debe ser SUGERENCIAS para que no se
 *       malinterprete, las decisiones son del usuario y él debe evaluarlas».
 *
 *   2 · EL VETO — `vetosDeContrato(texto)`: chequeos MECÁNICOS (el juez no opina: compara — la regla del
 *       notario, aplicada a un juez NUEVO que vive FUERA de guardC: el notario no se toca, este juez se le
 *       SUMA en el bucle). Pocas reglas, calibradas contra el corpus de exámenes (cero gasto): un veto que
 *       dispara sobre textos ya aceptados es un falso positivo, y se afina ANTES de gastar una llamada.
 *
 * PURO · determinístico · sin red. La letra es BYTE-ESTABLE (prefijo cacheable del proveedor). */

/* ── LA LETRA · principios estilo Code (F3) ─────────────────────────────────────────────────────────────────── */
export const PRINCIPIOS_ARCO = [
  "Qué pasa → por qué y dónde → qué se puede hacer. En ese orden, y solo hasta donde la pregunta lo pide.",
  "El «qué hacer» se OFRECE con su cifra — jamás se ordena. Las decisiones son del usuario y él debe evaluarlas.",
  "El cierre ENTREGA la decisión («si quieres, lo vemos por X»), nunca la da por tomada («procede con X»).",
].map((s) => `- ${s}`).join("\n");

export const PRINCIPIOS_FORMA = [
  "Conclusión primero; el detalle después.",
  "Frases cortas. Cero relleno.",
  "Cada cifra con su dueño y su período.",
  "Tabla solo cuando piden lista o comparación de varios; si no, prosa.",
  "El nombre del usuario se respeta si lo declaró; el REGISTRO no se negocia — formal siempre, lo llamen como lo llamen.",
].map((s) => `- ${s}`).join("\n");

/* ── EL VETO MECÁNICO · vetosDeContrato(texto) → [{ regla, multa }] ─────────────────────────────────────────────
 * REGLAS POCAS Y CIEGAS. Cada una con su carnada en el gate y su pasada de calibración contra los exámenes.
 * Lo que NO se veta, a propósito: el condicional de oferta («Renegociaría primero…», «Profundizaría por…»)
 * y la pregunta de cierre («¿Arrancamos por ahí?») — esa ES la forma correcta de sugerir. */

// El cierre que ORDENA: el último párrafo arranca con un imperativo de ejecución dirigido al usuario.
// Verbos acotados a ejecución de negocio (no se vetan «mira», «considera», «recuerda» — ofrecen, no ordenan).
const _IMPERATIVO_EJECUCION = /^(procede|proced[eé]|ejecut[aá]|implement[aá]|renegoci[aá]|liquid[aá]|aplic[aá]|lanz[aá]|corta|cort[aá]|sub[ií] (el|los|la|las)|baj[aá] (el|los|la|las))\b/i;
// La decisión dada por tomada, en cualquier parte del texto — la carnada NOMBRADA por el owner.
const _DECISION_TOMADA = /\b(procede con|proced[eé] con|avanz[aá] con la ejecuci[oó]n|queda decidido|ya est[aá] decidido|debes ejecutar|ten[eé]s que ejecutar)\b/i;

export function vetosDeContrato(texto) {
  if (typeof texto !== "string" || !texto.trim()) return [];
  const v = [];
  const parrafos = texto.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const cierre = parrafos.length ? parrafos[parrafos.length - 1] : "";
  // el cierre se juzga línea a línea (una lista final de acciones imperativas también es un cierre que ordena)
  const lineasCierre = cierre.split("\n").map((l) => l.replace(/^[-·•\d.)\s]+/, "").trim()).filter(Boolean);
  if (lineasCierre.some((l) => _IMPERATIVO_EJECUCION.test(l))) {
    v.push({ regla: "cierre-imperativo", multa: "el cierre ORDENA una ejecución — el qué hacer se ofrece con su cifra y la decisión se le entrega al usuario, jamás se da por tomada. Reescribe el cierre como oferta (condicional o pregunta)." });
  }
  if (_DECISION_TOMADA.test(texto)) {
    v.push({ regla: "decision-por-tomada", multa: "das una decisión por tomada («procede con…») — las decisiones son del usuario y él debe evaluarlas. Preséntala como sugerencia con su cifra." });
  }
  return v;
}
