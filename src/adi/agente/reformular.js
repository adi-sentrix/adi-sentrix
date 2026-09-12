/* === src/adi/agente/reformular.js · LA MISMA RESPUESTA, PARA OTRO ============================================
 *
 * EL DEFECTO QUE LA ORIGINA, visto por el owner en producción (v2.23) y medido acá: después de cuatro lecturas
 * buenas en pantalla, pidió «explícamelo para el equipo comercial» y ADI contestó **«No tengo información
 * autorizada suficiente para responder eso»**.
 *
 * ⚠️ ESO NO ES NO CONTESTAR: ES FALSO. La información la tenía —la acababa de servir, con cifras verificadas—
 * y le dijo al dueño que no la tenía. Un producto que se vende por confiable no puede mentir sobre sus propios
 * límites: declinar cuando no hay dato es un mérito de esta casa, pero declinar cuando SÍ lo hay le enseña al
 * usuario que el asesor es más corto de lo que es, y eso no se recupera con una respuesta buena después.
 *
 * LA MEDICIÓN: de ocho formas naturales de pedir lo mismo, SIETE no activaban absolutamente nada —«explícamelo
 * para el equipo comercial», «ponlo en palabras para mi gerente», «resúmemelo para el directorio», «dímelo más
 * corto», «explícamelo más simple», «cómo se lo explico a mi socio», «explícaselo al equipo»—. La octava, «qué
 * le digo al equipo comercial», sí entraba, pero al plan de acción: arrancaba un plan NUEVO del negocio en vez
 * de reformular lo que el dueño acababa de leer, que es otra respuesta a otra pregunta.
 *
 * POR QUÉ ES UNA RUTA Y NO UN CAPRICHO. El censo de nueve rutas miraba QUÉ se pregunta. Ésta es sobre PARA
 * QUIÉN es la respuesta: mismo contenido, otro destinatario, otro largo, otra profundidad. En un negocio real
 * es de las más usadas —al directorio no se le habla como al vendedor— y no cuesta ni una lectura nueva.
 *
 * POR QUÉ VIVE ACÁ Y NO EN UN PLAYBOOK, que es la misma razón que la ley del porqué: un playbook necesita
 * PASOS para activarse (`promesasCumplidas`, registro.js) y esta ruta existe precisamente para NO salir a
 * leer. Su material es la respuesta anterior, que ya pasó el muro; correr herramientas sería pagar de nuevo por
 * lo que ya está verificado en pantalla.
 *
 * ⚠️ Y LAS CIFRAS SIGUEN SIENDO LAS MISMAS. El motor ya guarda las cifras aprobadas del turno anterior con su
 * dueño (`recitaAprobada`, cicloNotarial) y el muro las re-autoriza; verificado además que esa memoria viaja
 * de un turno al siguiente en la app. Reformular es re-decir, no re-calcular: una cifra que no estaba en la
 * respuesta anterior no puede aparecer en su reformulación.
 *
 * PURO · determinístico · sin red. */

import { normalizarSeparadorDecimal } from "../../config/contract/figureType.js";   // el canon del separador se declara UNA vez

/* ── QUIÉN PIDE Y PARA QUIÉN ───────────────────────────────────────────────────────────────────────────────
 * Dos familias, y las dos son «lo mismo dicho de otra manera»:
 *   · CAMBIO DE DESTINATARIO — «para el equipo comercial», «al directorio», «a mi socio».
 *   · CAMBIO DE FORMA — «más corto», «más simple», «en una línea», «en viñetas».
 * ⚠️ El verbo solo no alcanza: «explícame el cuadro» es una lectura nueva, no una reformulación. Hace falta el
 * PRONOMBRE que apunta a lo ya dicho («explícaMELO», «resúmeMELO») o un destinatario/forma explícitos. */
/* «Dámelo más corto» (batería en vivo de la Etapa 4, T3): «dá» no es «dí» — el verbo se escribía con i y el turno se iba al cerebro libre, que lo tomó como una lectura nueva. */
const _VERBO = "(?:expl[ií]c|res[uú]m|d[aáií]|pon|p[aá]s|traduc|arm|escrib)[a-záéíóúñ]*";
/* ⚠️ EL PRONOMBRE VA PEGADO AL VERBO, y buscarlo suelto con `\b` no lo encuentra JAMÁS. En castellano el
 * clítico es enclítico —«explícaMELO», «resúmeMELO», «díMELO», «pásaLO»— así que «lo» no es una palabra en
 * esas frases: es la última sílaba de otra. Lo pagó la calibración: cuatro de diez formas se caían por eso, y
 * las que pasaban lo hacían por la regla del destinatario, no por el pronombre. Es primo del `\b` imposible
 * tras vocal acentuada: la misma trampa de creer que el borde de palabra está donde uno lo imagina. */
const _PIDE_LO_DICHO = new RegExp(`\\b${_VERBO}(?:me|se|te|nos)?l[oa]s?\\b`, "i");
const _LO_YA_DICHO = /\beso\b|\besto\b|\blo que (?:dijiste|me dijiste|acabas de decir|respondiste)\b|\bla respuesta\b|\blo anterior\b/i;
/* ⚠️ EL CALIFICADOR ES PARTE DEL DESTINATARIO, y se notó al mirar la pantalla: «para el equipo comercial»
 * devolvía «el equipo» —una palabra sola— y la reformulación abría hablándole a otro. La lista de
 * calificadores es CERRADA a propósito: un patrón que acepte cualquier palabra siguiente se termina tragando
 * media frase («para el equipo que no llegó a la meta»), y un destinatario mal leído es peor que uno genérico. */
const _CALIF = "(?:\\s+(?:comercial(?:es)?|de ventas|de finanzas|de operaciones|de compras|ejecutiv[oa]s?|t[eé]cnic[oa]s?|regional(?:es)?))?";
/* «Ahora para directorio» (batería en vivo de la Etapa 4, T5): sin artículo no se detectaba ningún lector y el
 * turno se fue al cerebro libre. Las audiencias CONOCIDAS valen sin artículo; las demás siguen exigiéndolo. */
const _DESTINATARIO = new RegExp(`\\bpara (?:el|la|los|las|mi|mis)\\s+[\\wáéíóúñ]+${_CALIF}|\\bpara (?:directorio|comercial|ventas|finanzas|gerencia|board)\\b|\\ba(?:l)? (?:equipo|directorio|gerente|socio|jefe|due[ñn]o|comit[eé]|vendedor)${_CALIF}`, "i");
const _SOLO_DESTINATARIO = new RegExp(`^\\s*¿?\\s*(?:y |ahora |tambi[eé]n |lo mismo |igual |pero )*(?:${_DESTINATARIO.source})\\s*[.?!]*\\s*$`, "i");
const _FORMA = /\bm[aá]s (?:corto|simple|breve|claro|sencillo|f[aá]cil|directo)\b|\ben (?:una|dos|tres) l[ií]neas?\b|\ben vi[ñn]etas\b|\ben bullet/i;

/* ── LA INSTRUCCIÓN DE PRESENTACIÓN POSTERIOR (owner 2026-09-11, el encargo compuesto) ──────────────────────
 * «…qué puedes demostrar y qué harías primero. Después resúmemelo para directorio.» marcaba el turno ENTERO como
 * reformular —el detector miraba si la frase CONTENÍA la forma, no si la frase ERA eso— y el atajo de «no hay
 * nada que reformular» respondía sin leer ni llamar. Su regla: si la forma aparece al final, después de un
 * encargo sustantivo —con «después», «luego», «al final», o como frase de cierre («Explícalo para comercial.»)—,
 * es una instrucción de presentación de lo que ESTE turno va a producir, no la intención del turno. El lector
 * sigue viajando (`destinatarioDe` lee el mensaje entero); lo que no viaja es la doctrina de «no salgas a leer». */
const _POSTERIOR = /^\s*(?:y\s+)?(?:despu[eé]s|luego|al final|finalmente|por [uú]ltimo|al terminar|cuando termines)\b[,\s]*/i;
const _CORTE_POSTERIOR = /(?<=[.;!?])\s+|\s+(?=(?:y\s+)?(?:despu[eé]s|luego|al final|finalmente|por [uú]ltimo|al terminar|cuando termines)\b)/i;
export function presentacionPosterior(pregunta) {
  const q = String(pregunta || "").trim();
  if (!q) return null;
  const tramos = q.split(_CORTE_POSTERIOR).map((s) => s.trim()).filter(Boolean);
  if (tramos.length < 2) return null;
  const clausula = tramos[tramos.length - 1];
  const resto = tramos.slice(0, -1).join(" ");
  const esForma = _esReformularSola(clausula) || (_POSTERIOR.test(clausula) && (_DESTINATARIO.test(clausula) || _FORMA.test(clausula)));
  if (!esForma) return null;
  /* sin un encargo sustantivo delante no hay «posterior»: «Lo mismo, pero más corto. Para el directorio.» sigue
   * siendo una reformulación entera, y una frase de cuatro palabras no es un encargo */
  if (resto.split(/\s+/).length < 5 || _esReformularSola(resto)) return null;
  return { clausula, resto, destinatario: destinatarioDe(clausula), corto: _FORMA.test(clausula) };
}
/** el mensaje sin su instrucción de presentación posterior — lo que los procedimientos tienen que leer */
export function sinPresentacionPosterior(pregunta) {
  const p = presentacionPosterior(pregunta);
  return p ? p.resto : String(pregunta || "");
}

/** ¿la pregunta pide RE-DECIR lo ya respondido, no una lectura nueva? */
export function esReformular(pregunta) {
  if (presentacionPosterior(pregunta)) return false;   // un encargo con presentación al final es un encargo
  return _esReformularSola(pregunta);
}
function _esReformularSola(pregunta) {
  const q = String(pregunta || "");
  if (!q.trim()) return false;
  const apunta = _PIDE_LO_DICHO.test(q) || _LO_YA_DICHO.test(q);
  const dest = _DESTINATARIO.test(q);
  const forma = _FORMA.test(q);
  /* «dímelo más corto» (verbo con pronombre + forma) · «explícamelo para el equipo» (+ destinatario) ·
   * «resúmemelo para el directorio». El verbo con pronombre alcanza SI además dice para quién o de qué forma —
   * un «explícamelo» a secas es legítimo pero ambiguo, y ahí prefiero que lo tome el camino de siempre. */
  if (apunta && (dest || forma)) return true;
  /* «Ahora para directorio.» (batería en vivo de la Etapa 4, T5): la frase que es SOLO el destinatario —con «ahora»,
   * «y» o «también» delante— pide lo mismo para otro lector; no hay verbo ni clítico porque no hace falta. Solo
   * cuando la frase ENTERA es eso: «los riesgos para el directorio» es una lectura nueva y sigue siendo de la
   * síntesis. */
  if (_SOLO_DESTINATARIO.test(q)) return true;
  /* «cómo se lo explico a mi socio» — el dueño pregunta cómo DECIRLO él, que es la misma ruta vista al revés */
  if (/\bc[oó]mo (?:se ?l[oa]|le|les) (?:explico|digo|cuento|present[oó])\b/i.test(q)) return true;
  /* ⚠️ NO HAY TERCERA REGLA «verbo + destinatario SIN pronombre», y la calibración explicó por qué: se llevaba
   * «qué le digo al equipo comercial», donde «digo» es PRIMERA PERSONA —el dueño pregunta qué decir él, no le
   * pide a ADI que rescriba nada—. Ese turno pide producir un mensaje, no reformular uno, lo atiende el plan
   * de acción y lo atiende bien. El pronombre pegado al verbo es justamente lo que separa «explícaMELO» (dilo
   * otra vez) de «qué digo» (dime qué decir). */
  return false;
}

/* ── LA PREVIA SUSTANTIVA (batería en vivo de la Etapa 4, T4-T6) ───────────────────────────────────────────
 * «Dámelo más corto» → «para el equipo comercial» → «ahora para directorio»: cada reformulación se apoyaba en la
 * ANTERIOR, y la tercera reformulaba una reformulación de dos frases — el material se degradaba en cadena. Y el
 * porqué del margen dejaba de reconocer el hilo porque la última respuesta (una reformulación corta) ya no
 * nombraba el margen. La respuesta que se reformula —y la que dice de qué va el hilo— es la última SUSTANTIVA:
 * la última del asistente cuya pregunta NO fue una reformulación. Se lee del hilo, como siempre. */
export function previaSustantiva(history) {
  const hs = Array.isArray(history) ? history : [];
  for (let i = hs.length - 1; i >= 0; i--) {
    const h = hs[i];
    if (!h || h.role === "user" || typeof h.text !== "string" || h.text.trim().length <= 40) continue;
    const pregunta = (() => { for (let j = i - 1; j >= 0; j--) { const u = hs[j]; if (u && u.role === "user" && typeof u.text === "string") return u.text; } return ""; })();
    if (pregunta && esReformular(pregunta)) continue;   // una reformulación no es material: se sigue hacia atrás
    return h.text;
  }
  return null;
}

/** para quién es, dicho en palabras del negocio — o null si solo pidió otra forma. */
export function destinatarioDe(pregunta) {
  const m = _DESTINATARIO.exec(String(pregunta || ""));
  if (!m) return null;
  const crudo = m[0].replace(/^\ba(?:l)?\s+/i, "el ").replace(/^para\s+/i, "").trim();
  /* el lector sin artículo se nombra completo: «directorio» → «el directorio», «comercial» → «el equipo comercial» */
  const SIN_ARTICULO = { directorio: "el directorio", comercial: "el equipo comercial", ventas: "el equipo de ventas", finanzas: "finanzas", gerencia: "la gerencia", board: "el directorio" };
  return SIN_ARTICULO[crudo.toLowerCase()] || crudo;
}

/* ── LA DOCTRINA · byte-estable, y solo viaja en el turno que la pide ───────────────────────────────────────
 * Mismo principio que `doctrinaDelPorque`: la instrucción no sale hasta que hace falta. */
export function doctrinaDeReformular() {
  return [
    "PROCEDIMIENTO · TE PIDIERON LA MISMA RESPUESTA DICHA DE OTRA MANERA, no una lectura nueva.",
    "1 · NO SALGAS A LEER. El material es tu respuesta anterior, que ya está verificada y en pantalla. Pedir",
    "    otra lectura para decir lo mismo es hacerle pagar dos veces por el mismo dato.",
    "2 · MISMO CONTENIDO, MISMAS CIFRAS. Cada número que uses tiene que estar en lo que ya respondiste, con el",
    "    mismo dueño al lado. Si en la reformulación aparece una cifra que antes no estaba, la inventaste.",
    "3 · CAMBIA LO QUE TE PIDIERON QUE CAMBIE, y solo eso:",
    "    · si te pidieron otro DESTINATARIO, cambia el vocabulario y qué se explica (el molde del lector viaja",
    "      aparte). Nunca cambies la conclusión: no es una respuesta nueva, es la misma para otro lector.",
    "    · si te pidieron MÁS CORTO, es de verdad más corto: la tesis y el criterio, en dos o tres frases —",
    "      «Creces, pero con margen presionado. Falabella concentra la mayor recuperación potencial; yo",
    "      empezaría por ahí.» Sin rodeo, sin re-narrar la evidencia. La cifra clave se queda si sostiene la",
    "      conclusión; si la conclusión ya la carga, no hace falta repetirla.",
    "    · si te pidieron más SIMPLE, saca el vocabulario técnico, no el rigor ni la conclusión.",
    "    · si te pidieron DETALLE, ahí sí abre la evidencia: composición, comparaciones, cómo se llega a la cifra.",
    "4 · SI NO HAY NADA QUE REFORMULAR porque todavía no respondiste nada en este hilo, dilo así: que aún no",
    "    hay una respuesta que reescribir, y ofrécele hacer la lectura. JAMÁS digas que no tienes información",
    "    autorizada: la tendrías, y decirle que no la tienes es enseñarle que el producto es más corto de lo",
    "    que es.",
  ].join("\n");
}

/* ── EL PISO · REFORMULAR SIN CEREBRO ══════════════════════════════════════════════════════════════════════
 *
 * ⚠️ EL DEFECTO QUE LO OBLIGA, medido offline con el hilo real del owner (2026-09-10, su prueba de continuidad
 * 4/5): con la respuesta anterior EN el hilo, «explícamelo para el equipo comercial» salía igual con la frase
 * falsa —«No tengo información autorizada suficiente para responder eso con el alcance pedido»—. Y no era que
 * producción estuviera vieja: el turno terminaba `vacio` también en dev.
 *
 * LA RAÍZ, y es incómoda: los vetos de esta ruta PROHIBEN esa frase, pero prohibir no es responder. Cuando el
 * cerebro insistía, el turno se quedaba sin texto y la escalera terminaba en el mensaje de sin-datos… que es
 * LA MISMA FRASE que el veto acaba de prohibir. El candado cerraba la puerta y la salida de emergencia daba a
 * la misma habitación.
 *
 * LA LEY QUE LO RESUELVE es la del owner del mismo día: «no quiero que el respaldo desaparezca; quiero que sea
 * igual de confiable aunque sea menos sofisticado». Reformular es, de todas las rutas, la que MENOS necesita
 * un cerebro: el material ya está escrito y ya pasó el muro. Si el narrador no puede re-decirlo, el
 * procedimiento lo re-dice sin él — con menos gracia y la misma verdad.
 *
 * CÓMO NO INVENTA NADA: las oraciones salen VERBATIM de la respuesta anterior. No se reescriben, no se
 * resumen con palabras nuevas, no se recalcula nada: se ELIGEN y se ordenan. Por eso este piso no puede
 * cambiar la conclusión —la copia— ni traer una cifra que no estuviera (la ley de la conclusión, aplicada al
 * único turno donde el narrador queda a solas con el texto). Y el muro lo juzga igual, con el canal que la
 * casa ya tiene para esto (`boletaAnterior`: re-citar lo que ADI misma mostró no es inventar).
 *
 * ⚠️ EL MATERIAL SE LEE DEL HILO, NO DE LA MEMORIA. `mem.ultimaAprobada` es donde vive lo aprobado, y por eso
 * mismo puede faltar: fue justamente lo que falló en la 2.24 (los turnos de procedimiento no la escribían) y
 * lo que el owner vio tres veces. El hilo lo manda la app en cada turno y no depende de que ningún peldaño se
 * haya acordado de guardar. Un piso que se apoya en lo que puede faltar no es un piso. */

/* las oraciones de un texto, sin partir por el punto decimal de una cifra: se corta solo cuando después del
 * punto viene un espacio y algo que ABRE oración. «$4.6M de $12.6M» no se parte; «…cartera. Y le sigue» sí. */
const _ORACIONES = /(?<=[.!?…])\s+(?=[A-ZÁÉÍÓÚÑ¿«¡])/;
const _ES_TABLA = (l) => /^\s*\|/.test(l) || /^\s*[-:|\s]+$/.test(l);
const _CIFRA_UNA = /\$[\d.,]+\s?[KMB]?|[\d.,]+\s*(?:%|pp\b)/i;

/** las frases de la previa que llevan cifra o conclusión, verbatim y en su orden original. */
function _frasesDe(previa) {
  const out = [];
  for (const linea of String(previa || "").split(/\r?\n/)) {
    const l = linea.trim();
    if (!l || _ES_TABLA(l)) continue;                    // una tabla no se re-narra: se re-ofrece
    /* un bullet es UNA unidad —«· Lider: brecha 8.6 pp, margen 21.5%…»—: partirlo por el punto lo rompe */
    if (/^[·•\-*]\s+/.test(l) || /^\d{1,2}[.)]\s+/.test(l)) { out.push(l); continue; }
    for (const o of l.split(_ORACIONES)) { const s = o.trim(); if (s) out.push(s); }
  }
  return out;
}

/* la frase donde la previa DIJO su conclusión — las formas que los procedimientos de la casa escriben. Va
 * primero en la reformulación aunque en el original fuera al final: para otro lector, la conclusión abre. */
const _CONCLUSION = /\byo entrar[ií]a por\b|\bentrar[ií]a por\b|\bmi recomendaci[oó]n\b|\bcriterio m[ií]o\b|\bpartir[ií]a por\b|\besta semana har[ií]a\b|\bempezar[ií]a por\b|\b(?:yo )?mirar[ií]a primero\b|\brevisar[ií]a primero\b|\bel orden correcto\b|\bprimero\b.{0,40}\bdespu[eé]s\b/i;

/* ── EL TIPO DE AUDIENCIA (Etapa 3, owner 2026-09-11) ──────────────────────────────────────────────────────
 * Cuatro lectores con la MISMA conclusión y distinta forma —«la conclusión debe mantenerse idéntica; cambia la
 * forma»—. Se lee del destinatario que ya detecta `destinatarioDe`; no hay un segundo detector. */
export function tipoDeAudiencia(dest) {
  const d = String(dest || "").toLowerCase();
  if (!d) return null;
  if (/directorio|comit[eé]|junta|board|accionista/.test(d)) return "directorio";
  if (/equipo|vendedor|comercial|fuerza|kam|ventas/.test(d)) return "comercial";
  if (/analista|controller|finanzas|contador|contralor/.test(d)) return "analista";
  return "dueno";
}

/** el molde del lector — viaja SOLO en el turno que nombra una audiencia (la carta lo remite acá a propósito:
 *  el techo del 20% del system no admite cuatro moldes en cada turno). Byte-estable por tipo. */
export function doctrinaDeAudiencia(dest) {
  const tipo = tipoDeAudiencia(dest);
  if (!tipo) return null;
  const INVARIANTE = "LA CONCLUSIÓN NO CAMBIA POR EL LECTOR: mismo cliente prioritario, mismas cifras, mismo veredicto, misma primera acción. Cambia qué se resalta y cuánto.";
  const M = {
    directorio: [
      `[PROCEDIMIENTO — no es el usuario] ESTE TURNO ES PARA ${dest.toUpperCase()}.`,
      "Registro de comité: materialidad (cuánto pesa contra el negocio), riesgo, tendencia y la decisión que se abre. UNA decisión al frente, en tres a cinco frases. Nada operativo, nada del método, ninguna cuenta que no mueva la decisión.",
      INVARIANTE,
    ],
    comercial: [
      `[PROCEDIMIENTO — no es el usuario] ESTE TURNO ES PARA ${dest.toUpperCase()}.`,
      "Aterriza a lo que un vendedor puede usar: la cuenta por su nombre, su problema económico en una frase, la cifra que lo mide con su referencia, y qué conviene revisar. Forma: «Falabella: cede 4.5% de carga contra 3.5% de referencia — ahí hay $194K. Lo que revisaría: si esa condición se pactó a cambio de volumen.» Sin órdenes: si el dato no permite prescribir, se dice qué validar. Sin explicar el método.",
      INVARIANTE,
    ],
    analista: [
      `[PROCEDIMIENTO — no es el usuario] ESTE TURNO ES PARA ${dest.toUpperCase()}.`,
      "Aquí sí cabe la evidencia: composición, comparaciones, cómo se llega a cada cifra y qué queda fuera del dato. Puede llevar tabla si ayuda. Mismas cifras verificadas, ni una más.",
      INVARIANTE,
    ],
    dueno: [
      `[PROCEDIMIENTO — no es el usuario] ESTE TURNO ES PARA ${dest.toUpperCase()}.`,
      "Qué está pasando, cuánto importa y dónde pondrías atención — directo, sin tecnicismos, en pocas frases.",
      INVARIANTE,
    ],
  };
  return M[tipo].join("\n");
}

/** cómo se abre para cada lector. La conclusión no cambia; cambia a quién se le está hablando. */
function _encabezado(dest) {
  if (!dest) return "Lo mismo, más corto:";
  const tipo = tipoDeAudiencia(dest);
  if (tipo === "directorio") return `Para ${dest}, en corto:`;
  if (tipo === "comercial") return `Para ${dest}, lo que importa es esto:`;
  if (tipo === "analista") return `Para ${dest}, con la evidencia:`;
  return `Para ${dest}:`;
}

/**
 * componerReformulacion(previa, { pregunta }) → texto, o null si no hay material que re-decir.
 * PURO · determinístico · cero red · cada frase VERBATIM de `previa`.
 */
export function componerReformulacion(previa, { pregunta = "" } = {}) {
  const src = String(previa || "").trim();
  if (src.length < 40) return null;
  const frases = _frasesDe(src);
  if (!frases.length) return null;
  const dest = destinatarioDe(pregunta);
  const corto = _FORMA.test(String(pregunta || ""));

  const conclusion = frases.find((f) => _CONCLUSION.test(f)) || null;
  /* LA TESIS TAMBIÉN VIAJA (Etapa 3): si la previa abre con una frase sin cifra —«el negocio crece, pero deja menos
   * margen del que debería»— esa es su tesis, y es lo primero que cualquier lector necesita. Verbatim, como todo. */
  /* una tesis es una frase completa: no un encabezado («Lo mismo, más corto:») ni un rótulo de dos palabras */
  const _fraseCompleta = (f) => !!f && f !== conclusion && f.length <= 220 && !/[:]\s*$/.test(f) && !/^[·•\-*]\s|^\d{1,2}[.)]\s/.test(f) && f.split(/\s+/).length >= 6;
  const tesisSinCifra = (_fraseCompleta(frases[0]) && !_CIFRA_UNA.test(frases[0]) && frases[0].length <= 160) ? frases[0] : null;
  /* …y la previa escrita por el cerebro abre con su tesis CON cifras —«la brecha no es difusa: son 5 puntos
   * concentrados en 6 cuentas»—: sigue siendo la tesis y sigue abriendo (batería en vivo de la Etapa 4, T5: sin
   * esto, el directorio recibía una sola línea de números y ninguna conclusión). El encabezado de un lector
   * anterior («Para el equipo comercial…») no es tesis de nadie. */
  const tesis = tesisSinCifra || ((_fraseCompleta(frases[0]) && !/^Para (?:el|la|los|las|mi|mis|finanzas)\b/i.test(frases[0])) ? frases[0] : null);
  /* las que sostienen: llevan cifra. Sin ninguna, la reformulación sería una opinión — y ahí es mejor no
   * componer y dejar que el turno lo diga honestamente, que es lo que hace el peldaño siguiente. */
  const conCifra = frases.filter((f) => f !== conclusion && f !== tesis && _CIFRA_UNA.test(f));
  if (!conCifra.length && !conclusion) return null;

  /* ── EL LECTOR ELIGE QUÉ FRASES, NO CÓMO SE ESCRIBEN (Etapa 3, owner 2026-09-11) ──────────────────────────
   * El piso sigue siendo verbatim —no redacta—, pero ya no sirve las mismas cuatro frases a todos: para el
   * equipo comercial van primero las que nombran una cuenta con su cifra (lo que un vendedor usa); para el
   * directorio, las de magnitud en dinero (lo que pesa) y pocas; para el analista, todas las que sostienen.
   * La conclusión abre siempre, para todos: es lo que ningún lector puede perder. */
  const tipo = tipoDeAudiencia(dest);
  /* la mayúscula inicial de una oración no es una cuenta («Crece: la venta viene +7.5%» no nombra a nadie) — la misma
   * lista de arranques comunes que ya usa la oferta derivada, más abajo (encargo compuesto, 2026-09-11) */
  const _nombraCuenta = (f) => {
    const m = /\b([A-ZÁÉÍÓÚÑ][\wáéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][\wáéíóúñ]+)?)\b[^.\n]{0,40}(?:\$[\d.,]+|\d[\d.,]*\s*(?:%|pp))/.exec(f);
    return !!m && !/^(?:Crece|Pero|Tus|Los|Las|El|La|Hay|En|De|Y|Si|Lo|Donde|Dónde|Entre|Por|Tu|Con|Sin|Para|Ahí|Ah[ií])$/.test(m[1]);
  };
  const _enDinero = (f) => /\$[\d.,]+/.test(f);
  let elegidas = conCifra;
  if (tipo === "comercial") elegidas = [...conCifra.filter(_nombraCuenta), ...conCifra.filter((f) => !_nombraCuenta(f))];
  if (tipo === "directorio") elegidas = [...conCifra.filter(_enDinero), ...conCifra.filter((f) => !_enDinero(f))];
  /* «MÁS CORTO» ES DE VERDAD MÁS CORTO (Etapa 3, owner 2026-09-11): la tesis y el criterio, y nada más si los hay
   * —su vara: «Creces, pero con margen presionado. Falabella concentra la mayor recuperación; yo empezaría por
   * ahí.»—. El directorio recibe una línea de evidencia; el comercial dos; el analista, todas. */
  const tieneLoEsencial = !!(tesis || conclusion);
  const tope = corto ? (tieneLoEsencial ? 0 : 1) : tipo === "directorio" ? 1 : tipo === "analista" ? 6 : tipo === "comercial" ? 2 : 3;
  const cuerpo = elegidas.slice(0, tope);
  const lineas = [_encabezado(dest)];
  if (tesis) lineas.push(tesis);                        // la tesis abre — es la conclusión en una frase
  if (conclusion) lineas.push(conclusion);              // y el criterio: lo que el otro lector necesita
  for (const c of cuerpo) lineas.push(/^[·•\-*\d]/.test(c) ? c : `· ${c}`);
  /* SIN LÍNEA DE CIERRE QUE SE DESCRIBA A SÍ MISMA (Etapa 3): «es la misma lectura de recién… dime cuál y la
   * ajusto» era voz de sistema y un menú. El siguiente paso ya viene en el criterio («entraría por Falabella»);
   * si la previa no lo traía, se ofrece derivado de lo que sí hay: la cuenta que la tesis nombra. */
  if (!conclusion) {
    const cuenta = (cuerpo.join(" ").match(/\b(?:[A-ZÁÉÍÓÚÑ][\wáéíóúñ]+)(?=[^.\n]{0,40}(?:\$[\d.,]+|\d[\d.,]*\s*(?:%|pp)))/) || [])[0];
    if (cuenta && !/^(?:Crece|Pero|Tus|Los|Las|El|La|Hay|En|De)$/.test(cuenta)) lineas.push(`Si quieres seguir, abriría ${cuenta}.`);
  }
  /* verbatim en el contenido, no en el maquillaje: las negritas del cerebro (formato de informe) no se heredan */
  return lineas.map((l) => l.replace(/\*\*/g, "")).join("\n");
}

/* ── LOS VETOS ─────────────────────────────────────────────────────────────────────────────────────────────
 * Se suman al muro como los demás jueces: no lo reemplazan ni lo aflojan. */
const _NO_TENGO = /no tengo (?:informaci[oó]n|datos?)\s+(?:autorizada|autorizados|suficiente)|no (?:cuento|dispongo) con (?:informaci[oó]n|datos)/i;
/* ⚠️ EL `\b` VA SOLO TRAS LAS UNIDADES QUE SON LETRAS. «7.6%.» al final de una frase no tiene borde de palabra
 * después del «%» —los dos lados son no-palabra— así que un `\b` ahí no encuentra la cifra nunca. `cicloNotarial`
 * ya lo tiene documentado con las mismas palabras; acá volvió a morder, y su síntoma es el peor de todos: el
 * veto que existe para cazar la cifra inventada la dejaba pasar. */
const _CIFRA = /\$[\d.,]+\s?[KMB]?|[\d.,]+\s*(?:%|pp\b)/gi;
const _esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/* la CONCLUSIÓN de la respuesta anterior, si la declaró con las formas de la casa: la elección de comparar
 * («Yo entraría por X») o la primera acción del plan («una cosa: entrar por X…»). Es lectura del texto ya
 * aprobado — el material legítimo de este turno — no una re-derivación. */
const _ELECCION_PREVIA = /\byo entrar[ií]a por ([^.:\n]{1,40})|\buna cosa: (?:entrar por|ordenar la cobranza de|frenar la reposici[oó]n de)\s+([^.\n]{1,40}?)(?=\s+y[\s,]|[.\n]|$)/i;

/**
 * vetosDeReformular(texto, ctx) → [{ regla, multa }]
 * `previa` es la última respuesta del asistente en el hilo (el material legítimo de este turno).
 */
export function vetosDeReformular(texto, { pregunta = "", previa = null, sitio = "cierre" } = {}) {
  const t = String(texto || "");
  if (!t.trim()) return [];
  if (sitio !== "cierre" && sitio !== "reparacion") return [];   // juzga al cerebro, no a los peldaños
  if (!esReformular(pregunta)) return [];
  const v = [];
  const hayPrevia = typeof previa === "string" && previa.trim().length > 40;

  /* ⚠️ (a) EL DEFECTO EXACTO QUE EL OWNER VIO. Con una respuesta anterior en el hilo, decir «no tengo
   * información autorizada» es una afirmación falsa sobre el propio producto. */
  if (hayPrevia && _NO_TENGO.test(t)) {
    v.push({ regla: "reformular-niega-lo-que-tiene", multa: "dices que no tienes información y la tienes: acabas de responder con ella en este mismo hilo. Reformular es re-decir lo que ya está en pantalla, no salir a buscar nada. Toma tu respuesta anterior y dila como te la pidieron." });
  }

  /* (b) UNA CIFRA QUE NO ESTABA ANTES es una cifra inventada: reformular es re-decir, no re-calcular. */
  if (hayPrevia) {
    /* la comparación pasa por el canon del separador, que se declara UNA vez en `figureType` — y no por un
     * reemplazo propio: el candado del frente que unificó la ortografía barre `src/` justo buscando eso, y
     * tiene razón. Dos formas del mismo número comparadas con dos criterios distintos son dos verdades. */
    const _canon = (x) => normalizarSeparadorDecimal(String(x).trim());
    const antes = new Set((previa.match(_CIFRA) || []).map(_canon));
    const nuevas = [...new Set((t.match(_CIFRA) || []).map(_canon))].filter((x) => !antes.has(x));
    if (nuevas.length) {
      v.push({ regla: "reformular-cifra-nueva", multa: `«${nuevas[0]}» no estaba en la respuesta que te pidieron reformular. Reformular es decir lo mismo de otra manera: si aparece una cifra nueva, o la inventaste o saliste a leer sin que te lo pidieran. Usa las cifras que ya diste, con su mismo dueño.` });
    }
  }

  /* ⚠️ (d) LA CONCLUSIÓN PREVIA NO SE INVIERTE (ley del owner, 2026-09-10: «la conclusión es del
   * procedimiento, no del narrador» — y reformular es EL turno donde el narrador queda a solas con el texto).
   * Si la respuesta anterior eligió un camino, decirle a otro lector que ese camino no corre prisa —o poner
   * primero el descartado— no es reformular: es una segunda opinión con la autoridad de lo ya verificado. */
  if (hayPrevia) {
    const mEl = _ELECCION_PREVIA.exec(previa);
    const elegida = mEl ? String(mEl[1] || mEl[2] || "").trim() : "";
    if (elegida) {
      const invierte = new RegExp(
        `${_esc(elegida)}[^.\\n]{0,60}?\\b(?:no (?:necesita|requiere|urge|corre prisa|amerita)|puede esperar|no es (?:la )?prioridad)` +
        `|\\bno entrar[ií]a por (?:la |el )?${_esc(elegida)}`, "i");
      if (invierte.test(t)) {
        v.push({ regla: "reformular-invierte-conclusion", multa: `la respuesta que te pidieron reformular eligió ${elegida}, y tu versión lo da vuelta. Reformular cambia el vocabulario, el largo o el destinatario — jamás la conclusión: es la misma respuesta para otro lector, no una segunda opinión.` });
      }
    }
    /* (e) Y LA CONCLUSIÓN NO PIERDE SU CIFRA CLAVE — la doctrina §3 lo dice con todas sus letras: «más corto»
     * no es quitar el número, es quitar el rodeo. Sin ninguna cifra, lo que queda es una opinión. */
    /* ⚠️ CON LA VARA DE LA ETAPA 3 (owner 2026-09-11) la cifra puede faltar SI la conclusión viaja: su propio
     * ejemplo de «más corto» —«Creces, pero con margen presionado. Falabella concentra la mayor recuperación
     * potencial; yo empezaría por ahí.»— no trae ningún número y es exactamente lo que quiere. Lo que sigue
     * prohibido es perder las dos cosas: sin cifra Y sin conclusión, lo que queda es una opinión. */
    const teniaCifras = (previa.match(_CIFRA) || []).length > 0;
    if (teniaCifras && !(t.match(_CIFRA) || []).length && !_CONCLUSION.test(t)) {
      v.push({ regla: "reformular-pierde-la-cifra", multa: "la respuesta original sostenía su conclusión con cifras y tu versión no trae ninguna. «Más corto» o «para otro lector» no es quitar el número: es quitar el rodeo. La conclusión viaja con su cifra clave — la misma de antes, con el mismo dueño." });
    }
  }

  /* (c) SIN NADA QUE REFORMULAR, se dice ESO — no que falta información. */
  if (!hayPrevia && _NO_TENGO.test(t)) {
    v.push({ regla: "reformular-sin-previa-mal-dicho", multa: "todavía no hay una respuesta que reescribir en este hilo, y eso es lo que hay que decir. Decir «no tengo información autorizada» es otra cosa y es falsa: el dato está, lo que falta es la lectura. Dilo así y ofrécele hacerla." });
  }
  return v;
}
