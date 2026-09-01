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
  // P1 de la corrida 4 (owner, textual): «Si digo "mi venta" con un supuesto de crecimiento/proyección, toma
  // por defecto la venta total del negocio, salvo que el contexto indique otra entidad».
  "«Mi venta» con un supuesto de crecimiento o proyección es la venta TOTAL del negocio: ese es el default y no se pregunta. Solo si el contexto nombra otra entidad, esa manda.",
  "Al aclarar una ambigüedad, plantéala en palabras o con una cifra verificada — nunca con un ejemplo numérico inventado sobre una entidad real.",
].map((s) => `- ${s}`).join("\n");

/* ── EL VETO MECÁNICO · vetosDeContrato(texto) → [{ regla, multa }] ─────────────────────────────────────────────
 * REGLAS POCAS Y CIEGAS. Cada una con su carnada en el gate y su pasada de calibración contra los exámenes.
 * Lo que NO se veta, a propósito: el condicional de oferta («Renegociaría primero…», «Profundizaría por…»)
 * y la pregunta de cierre («¿Arrancamos por ahí?») — esa ES la forma correcta de sugerir. */

// El cierre que ORDENA: el último párrafo arranca con un imperativo de ejecución dirigido al usuario.
// Verbos acotados a ejecución de negocio (no se vetan «mira», «considera», «recuerda» — ofrecen, no ordenan).
/* ⚠️ EL FIN DE PALABRA, CUANDO LA PALABRA TERMINA EN VOCAL ACENTUADA (cazado 2026-08-31 al calibrar el registro
 * coloquial). En JavaScript `\b` se define sobre `\w` = [A-Za-z0-9_]: entre «á» y un espacio NO hay frontera,
 * así que un patrón que termina en `[aá]\b` no matchea la forma acentuada. Medido sobre este mismo juez:
 * «Ejecutá la baja de carga», «Renegociá la carga de Falabella», «Liquidá los SKU frenados» e «Implementá el
 * ajuste» pasaban SIN MULTA — el cierre imperativo que el owner blindó estaba ciego justo en las formas
 * rioplatenses, que son las que este usuario ve. `_FIN` es el fin de palabra que sí cuenta las vocales
 * acentuadas y la ñ; va en todo patrón que pueda terminar en una. */
const _FIN = "(?![a-záéíóúüñ])";
const _IMPERATIVO_EJECUCION = new RegExp(`^(procede|proced[eé]|ejecut[aá]|implement[aá]|renegoci[aá]|liquid[aá]|aplic[aá]|lanz[aá]|corta|cort[aá]|sub[ií] (el|los|la|las)|baj[aá] (el|los|la|las))${_FIN}`, "i");
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

  /* ── EL REGISTRO NO SE NEGOCIA POR PREFERENCIA DEL USUARIO (owner 2026-08-31) ────────────────────────────────
   * LO MEDIDO en la corrida 3, sobre lo VISIBLE (no sobre borradores): el apodo persistió, pero le arrastró el
   * registro a la conversación entera — «wachin, acá está lo que mueve aguja:» (T9) · «acá está:» (T11) ·
   * «acá está claro:» (T12) · «acá está, corregido:» (T15) · «acá está verificado:» (T18) · «acá está el
   * impacto…» (T23) · «acá está lo que mueve aguja sin tocar precio:» (T26). Siete turnos con la apertura y
   * dos con la muletilla, todos a PANTALLA.
   * LA PALABRA DEL OWNER: «no quiero que use esas cosas, que use el NOMBRE de usuario… ahora es ejecutivo».
   * EL NOMBRE ESTÁ EXENTO Y ES DELIBERADO: «wachin, la cartera promedia 25,1%…» pasa limpio — el trato no es
   * una fuga, el tono sí. Lo que se veta es la apertura de relleno y la muletilla, no a quién le habla.
   * La lista crece con lo que se MIDE en un examen, nunca con lo que se imagina: estas dos familias salen de
   * los nueve casos de arriba y no aparecen ni una vez en el corpus de exámenes del camino natural. */
  { re: new RegExp(`\\b(?:ac[aá]|aqu[ií])\\s+(?:est[aá]s?|van?|ten[eé]s|tienes|lo ten[eé]s|te (?:va|dejo|paso))${_FIN}`, "i"), regla: "registro-coloquial",
    multa: "apertura coloquial: «acá está…» no es registro ejecutivo. Abre con la conclusión y su cifra («la cartera promedia 25,1% contra un benchmark de 30,1%»). El nombre con el que te pidieron que trates al usuario SÍ va — lo que sobra es el relleno." },
  { re: /\bmueve\s+(?:la\s+)?aguja\b/i, regla: "registro-coloquial",
    multa: "muletilla coloquial: «lo que mueve aguja» no es registro ejecutivo. Di qué es, con su cifra («los tres clientes que concentran $4,3M de contribución no capturada»)." },
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

/* ⚠️ LA LISTA NO PUEDE ANTICIPAR EL CAMPO QUE TODAVÍA NO SE FUGÓ (medido en la certificación, 2026-09-01):
 * `headlineSub` salió a la pantalla del usuario y este juez no lo vio, porque miraba una lista cerrada —los
 * nombres de tools más cinco campos a mano— cuando la intención escrita arriba era otra: «lo que se fuga
 * reconocible es el camelCase». Otra vez la forma en lugar del concepto, esta vez en versión lista blanca.
 * Ahora se mide el camelCase DE VERDAD, y la lista queda como refuerzo para lo que no lo es.
 *
 * DOS MINÚSCULAS ANTES DE LA MAYÚSCULA, a propósito: deja fuera las marcas reales que empiezan con una letra
 * suelta —iPhone, eBay, iPad— que son nombres del mundo, no del motor. Calibrado contra el corpus completo de
 * exámenes: 77 respuestas a pantalla, un solo hallazgo (`headlineSub`, 4 veces) y cero falsos positivos;
 * iPhone · eBay · iPad · WhatsApp · PowerPoint · McKinsey · YoY pasan todos. Y una entidad del tenant nunca se
 * multa: si el negocio se llama así, es su nombre, no jerga nuestra. */
const _CAMELCASE = /\b([a-z]{2,}[a-z0-9]*[A-Z][A-Za-z0-9]*)\b/;
export function esIdentificadorInterno(palabra, entidades = []) {
  const p = String(palabra || "");
  if (!_CAMELCASE.test(p)) return false;
  return !entidades.some((e) => String(e || "").toLowerCase() === p.toLowerCase());
}

/* P1 DE LA CORRIDA 4 · «MI VENTA» CON SUPUESTO = LA VENTA TOTAL DEL NEGOCIO ─────────────────────────────────
 * Palabra del owner (textual): «Si digo "mi venta" con un supuesto de crecimiento/proyección, toma por defecto
 * la venta total del negocio, salvo que el contexto indique otra entidad». Medido en la corrida 4, dos turnos
 * verdes que no respondieron nada: T8 «ponele que el año que viene crezco 3%: cuánto sería mi venta?» →
 * «¿Global o Por cliente? ¿Cuál es tu supuesto?» · T21 «Con ESE TOTAL ANUAL, proyecta 12 meses con +4%» → la
 * misma pregunta, con el contexto ya nombrando la entidad en la propia frase del usuario.
 * LA REGLA ES CIEGA Y CONSERVADORA: multa solo cuando la pregunta pide una proyección, NO nombra ninguna
 * entidad del tenant, y la respuesta le devuelve al usuario la elección de entidad. Si la pregunta nombra una
 * entidad, el default no aplica y no se juzga: «esa manda», como dijo el owner. */
const _PIDE_PROYECCION = /\bproyect|\bcrec(?:e|és|es|imiento)|\bsi (?:sube|aumenta|baja)\b|pon[eé]le que|qu[eé] pasa si/i;
/* ⚠️ SIN `\b` DESPUÉS DEL «%» — la misma trampa de `_FIN`, y me mordió por segunda vez el mismo día. `\b` se
 * define sobre [A-Za-z0-9_]: entre «%» y «:» (o un espacio) NO hay frontera, así que `/\d%\b/` no matchea
 * «crezco 3%:» ni «+4% y dime». El «%» ya delimita solo; el `\b` queda SOLO donde la palabra termina en letra
 * («pp»). REGLA DE LA CASA: un `\b` después de un carácter que no es [A-Za-z0-9_] —%, $, á, ñ— no existe. */
const _CIFRA_SUPUESTO = /\d[\d.,]*\s*(?:%|pp\b)/;
/* ⚠️ ACÁ MEDÍA LA FORMA Y NO EL CONCEPTO — el defecto lo encontré en mi propio candado (corrida de
 * certificación, 2026-09-01). La versión vieja era una lista de cuatro frases copiadas de los textos de la
 * corrida 4 («global … por cliente», «sobre cuál entidad», «qué entidad», «cuál es tu supuesto»). El cerebro
 * cambió la redacción a «si es sobre tu venta total … o si lo aplico a una entidad específica: confirma» y el
 * candado dejó de verlo: 0 vetos sobre un turno que hacía exactamente lo que la regla prohíbe. Arreglé el
 * CASO, no la CLASE — el mismo error que vengo cazando en otros lados (van diez de esta familia).
 *
 * EL CONCEPTO, que no se esquiva cambiando palabras: si pidió una proyección con su supuesto y no nombró
 * ninguna entidad, la respuesta TIENE QUE TRAER LA CIFRA PROYECTADA. Da igual cómo esté redactada: sin cifra
 * de plata no proyectó, y devolverle la elección es la única razón por la que un turno así se queda sin cifra.
 * Para esquivar esta regla hay que dar la cifra — que es justamente lo que la regla pide.
 *
 * HUECO CONOCIDO, a propósito: una respuesta que NO proyecta pero menciona cualquier otro monto pasa (medido:
 * el turno 4 de la certificación, que falló por otra causa y trae «+$2.3M»). Se prefiere multar de menos:
 * un candado con falsos positivos se desactiva solo. */
const _CIFRA_DE_PLATA = /\$\s?\d[\d.,]*\s?[KMB]?\b/;
/* EL DEFAULT DEL OWNER ES SOBRE LA VENTA, y solo sobre ella: «si digo MI VENTA con un supuesto de
 * crecimiento/proyección…». Si la pregunta pone el supuesto sobre OTRA medida —«ponele que riachuelo tiene 30%
 * de MARGEN, qué hacemos»— no hay default que aplicar y la regla no se asoma. Sin esto, mi versión nueva
 * multaba esa pregunta y tumbaba la refutación del supuesto al genérico: lo cazó el gate del bucle (R4b), no
 * yo. Una regla más ancha que su motivo rompe cosas que andaban. */
const _OTRA_MEDIDA = /\bmarg[eé]n|\brentabilidad|\brotaci[oó]n|\bcapital|\bstock|\binventario|\bcosto|\bprecio|\bcontribuci[oó]n|\bcarga\b/i;

export function vetosDeContrato(texto, contexto = {}) {
  if (typeof texto !== "string" || !texto.trim()) return [];
  const v = [];

  const _q = String(contexto.pregunta || "");
  if (_q && _PIDE_PROYECCION.test(_q) && _CIFRA_SUPUESTO.test(_q) && !_OTRA_MEDIDA.test(_q) && !_CIFRA_DE_PLATA.test(texto)) {
    const _ents = Array.isArray(contexto.entidades) ? contexto.entidades : [];
    /* «esa manda» (owner): la entidad cuenta aunque el usuario escriba solo una parte de su nombre —«riachuelo»
     * por «Depósito Riachuelo»—, que es como se la nombra de verdad. Solo palabras largas: un token corto
     * apartaría la regla por casualidad. */
    const _tokens = (e) => String(e).split(/\s+/).filter((p) => p.length >= 5).concat([String(e)]);
    const nombraEntidad = _ents.some((e) => _tokens(e).some((p) =>
      new RegExp(`\\b${p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(_q)));
    if (!nombraEntidad) {
      v.push({ regla: "proyeccion-sin-default",
        multa: "no le devuelvas la elección: cuando pide una proyección sobre «su» venta sin nombrar una entidad, el default es la VENTA TOTAL DEL NEGOCIO. Proyecta sobre el total, dilo («proyección sobre la venta total del negocio»), y ofrece el corte por cliente como alternativa si lo quiere." });
    }
  }
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
  const _entsTexto = Array.isArray(contexto.entidades) ? contexto.entidades : [];
  const mCamel = texto.match(new RegExp(_CAMELCASE.source, "g"));
  const camelFugado = (mCamel || []).find((p) => esIdentificadorInterno(p, _entsTexto));
  const fugado = (mInterno && mInterno[1]) || camelFugado || null;
  if (fugado) {
    v.push({ regla: "identificador-interno", multa: `«${fugado}» es un nombre interno del sistema y no va a pantalla: describe la lectura o el límite en palabras del negocio.` });
  }
  return v;
}
