import { catalogoAgente } from "./catalogoAgente.js";   // R8 · los identificadores internos jamás van a pantalla (lazy: nada se deriva al importarse)
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

/* ── [9] DEL EXAMEN 1 (2026-08-31) · RUTEO Y CÁLCULO — los tres desvíos medidos, cerrados en la letra ──────────
 * T21 mapeó «proyecta +4%» a executiveSummary y perdió la proyección $103.9M/+$4.0M que el natural ganó con
 * etiqueta · T23 recibió «corrígelo antes de calcular» (cálculo PRE-AUTORIZADO) y frenó con otra pregunta —
 * el natural corrigió Y calculó $744K · T22 ofreció un cruce cliente×bodega que el dato no sostiene. */
export const PRINCIPIOS_RUTEO = [
  "Una proyección pedida («proyecta +4%», «qué pasa si sube X») va por las herramientas de simulación — jamás por el resumen ejecutivo.",
  "Si el usuario pre-autoriza el cálculo bajo un supuesto declarado («corrígelo antes de calcular»), ejecuta el cálculo ETIQUETADO con la interpretación declarada y ofrece el recálculo alternativo — no frenes con otra pregunta.",
  "El menú de una aclaración solo ofrece cortes que el dato sostiene — una opción incumplible es una promesa falsa.",
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

/* ── R8 DEL EXAMEN 1 (2026-08-31) · EL LÉXICO DE SUPERFICIE, VETADO CIEGO ───────────────────────────────────────
 * Lo MEDIDO en pantalla: «escenario» (T25, replicado T26 — criterio BINARIO del examen: cero escenario, colapso
 * del eje) · «tensión» en 5 turnos (vocabulario interno que además coincide con un nombre de mundo) · «la
 * herramienta de histórico por entidad está bloqueada» (el instrumento expuesto, T9-T12/T19) · «tirarte la
 * cifra» (registro coloquial, T9/T19) · «precioLista/unidades … variableB» (el error de contrato de una tool,
 * VERBATIM en T2). El narrador natural ya prohíbe este léxico en su prompt; el cierre del agente necesita el
 * MISMO piso — y acá es un VETO del juez ciego, no una esperanza del prompt: multa → reparación → si reincide,
 * escalera. La palabra en un texto del USUARIO no pasa por acá (esto juzga SOLO la salida del agente). */
const _LEXICO_SUPERFICIE = [
  { re: /\bescenarios?\b/i, regla: "lexico-escenario",
    multa: "«escenario» no existe en pantalla (colapso del eje): di «supuesto» para lo que el usuario plantea y «proyección» para lo que calculas sobre él." },
  { re: /\btensi[oó]n\b/i, regla: "lexico-tension",
    multa: "«tensión» es vocabulario interno (y coincide con un nombre de mundo): en pantalla se dice «brecha contra el benchmark» o la palabra del dato que corresponda." },
  /* ⚠️ ACOTADO A USOS-INSTRUMENTO: en el pack de ferretería «Herramientas» es una FAMILIA del dato real —
   * vetar la palabra pelada haría que la reparación reescriba un nombre de entidad (la lección de
   * _sanitizeScenario). Se vetan el artículo singular («la/esta herramienta…») y los atributos internos
   * («herramienta bloqueada/interna/del sistema»); «la familia Herramientas» pasa limpia. */
  { re: /\b(?:la|una|esa|esta|otra|cada|mi|tu) herramientas?\b|\bherramientas? (?:internas?|bloqueadas?|del sistema|de hist[oó]rico)\b/i, regla: "lexico-herramienta",
    multa: "no expongas el instrumento: el límite se formula sobre el DATO («el histórico por entidad no reconcilia con la cifra oficial»), jamás sobre «la herramienta» ni su estado." },
  { re: /\btirar(?:te|me|les?|los?|las?)?\b|\btires?\b|\btiro\b/i, regla: "lexico-tirar",
    multa: "registro formal: «tirar» una cifra no — di «traerte», «entregarte» o «servirte» la cifra." },
];
/* Los IDENTIFICADORES INTERNOS (nombres de tools y de campos de contrato) jamás van a pantalla — el catálogo es
 * la fuente (lazy y memoizado: nada se deriva al importarse) más los campos que el examen vio fugarse. Una tool
 * nueva entra al veto SOLA (la lista se construye del catálogo vivo, no de una copia). */
const _CAMPOS_INTERNOS = ["precioLista", "variableA", "variableB", "entityScope", "staleDays"];
let _reInternos = null;
function _internosRe() {
  if (_reInternos) return _reInternos;
  /* SOLO identificadores camelCase (una mayúscula después del primer carácter): un nombre de tool que es
   * palabra castellana corriente («calcular», «trend») no distingue jerga de prosa — vetarlo cazaba «Sí se
   * puede calcular» del corpus aceptado (calibración R8). Lo que se fuga reconocible es el camelCase:
   * inventoryStatus, precioLista, serieEntidad, variableB. */
  const nombres = [...new Set([...catalogoAgente().map((t) => t.name), ..._CAMPOS_INTERNOS])]
    .filter((n) => /[A-Z]/.test(n.slice(1)));
  _reInternos = new RegExp(`\\b(${nombres.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`);
  return _reInternos;
}

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
  for (const L of _LEXICO_SUPERFICIE) {
    if (L.re.test(texto)) v.push({ regla: L.regla, multa: L.multa });
  }
  const mInterno = texto.match(_internosRe());
  if (mInterno) {
    v.push({ regla: "identificador-interno", multa: `«${mInterno[1]}» es un nombre interno del sistema y no va a pantalla: describe la lectura o el límite en palabras del negocio.` });
  }
  return v;
}
