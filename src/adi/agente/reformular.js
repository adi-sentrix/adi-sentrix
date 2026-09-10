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
const _VERBO = "(?:expl[ií]c|res[uú]m|d[ií]|pon|p[aá]s|traduc|arm|escrib)[a-záéíóúñ]*";
/* ⚠️ EL PRONOMBRE VA PEGADO AL VERBO, y buscarlo suelto con `\b` no lo encuentra JAMÁS. En castellano el
 * clítico es enclítico —«explícaMELO», «resúmeMELO», «díMELO», «pásaLO»— así que «lo» no es una palabra en
 * esas frases: es la última sílaba de otra. Lo pagó la calibración: cuatro de diez formas se caían por eso, y
 * las que pasaban lo hacían por la regla del destinatario, no por el pronombre. Es primo del `\b` imposible
 * tras vocal acentuada: la misma trampa de creer que el borde de palabra está donde uno lo imagina. */
const _PIDE_LO_DICHO = new RegExp(`\\b${_VERBO}(?:me|se|te|nos)?l[oa]s?\\b`, "i");
const _LO_YA_DICHO = /\beso\b|\besto\b|\blo que (?:dijiste|me dijiste|acabas de decir|respondiste)\b|\bla respuesta\b|\blo anterior\b/i;
const _DESTINATARIO = /\bpara (?:el|la|los|las|mi|mis)\s+[\wáéíóúñ]+|\ba(?:l)? (?:equipo|directorio|gerente|socio|jefe|due[ñn]o|comit[eé]|vendedor)/i;
const _FORMA = /\bm[aá]s (?:corto|simple|breve|claro|sencillo|f[aá]cil|directo)\b|\ben (?:una|dos|tres) l[ií]neas?\b|\ben vi[ñn]etas\b|\ben bullet/i;

/** ¿la pregunta pide RE-DECIR lo ya respondido, no una lectura nueva? */
export function esReformular(pregunta) {
  const q = String(pregunta || "");
  if (!q.trim()) return false;
  const apunta = _PIDE_LO_DICHO.test(q) || _LO_YA_DICHO.test(q);
  const dest = _DESTINATARIO.test(q);
  const forma = _FORMA.test(q);
  /* «dímelo más corto» (verbo con pronombre + forma) · «explícamelo para el equipo» (+ destinatario) ·
   * «resúmemelo para el directorio». El verbo con pronombre alcanza SI además dice para quién o de qué forma —
   * un «explícamelo» a secas es legítimo pero ambiguo, y ahí prefiero que lo tome el camino de siempre. */
  if (apunta && (dest || forma)) return true;
  /* «cómo se lo explico a mi socio» — el dueño pregunta cómo DECIRLO él, que es la misma ruta vista al revés */
  if (/\bc[oó]mo (?:se ?l[oa]|le|les) (?:explico|digo|cuento|present[oó])\b/i.test(q)) return true;
  /* ⚠️ NO HAY TERCERA REGLA «verbo + destinatario SIN pronombre», y la calibración explicó por qué: se llevaba
   * «qué le digo al equipo comercial», donde «digo» es PRIMERA PERSONA —el dueño pregunta qué decir él, no le
   * pide a ADI que rescriba nada—. Ese turno pide producir un mensaje, no reformular uno, lo atiende el plan
   * de acción y lo atiende bien. El pronombre pegado al verbo es justamente lo que separa «explícaMELO» (dilo
   * otra vez) de «qué digo» (dime qué decir). */
  return false;
}

/** para quién es, dicho en palabras del negocio — o null si solo pidió otra forma. */
export function destinatarioDe(pregunta) {
  const m = _DESTINATARIO.exec(String(pregunta || ""));
  if (!m) return null;
  return m[0].replace(/^\ba(?:l)?\s+/i, "el ").replace(/^para\s+/i, "").trim();
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
    "    · si te pidieron otro DESTINATARIO, cambia el vocabulario y qué se explica — a un equipo comercial se",
    "      le dice qué hacer y con qué cuenta; a un directorio, cuánto pesa y qué decisión abre. Nunca cambies",
    "      la conclusión: no es una respuesta nueva, es la misma para otro lector.",
    "    · si te pidieron otro LARGO, corta lo accesorio y deja la conclusión con su cifra. «Más corto» no es",
    "      quitar el número: es quitar el rodeo.",
    "    · si te pidieron más SIMPLE, saca el vocabulario técnico, no el rigor.",
    "4 · SI NO HAY NADA QUE REFORMULAR porque todavía no respondiste nada en este hilo, dilo así: que aún no",
    "    hay una respuesta que reescribir, y ofrécele hacer la lectura. JAMÁS digas que no tienes información",
    "    autorizada: la tendrías, y decirle que no la tienes es enseñarle que el producto es más corto de lo",
    "    que es.",
  ].join("\n");
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
    const teniaCifras = (previa.match(_CIFRA) || []).length > 0;
    if (teniaCifras && !(t.match(_CIFRA) || []).length) {
      v.push({ regla: "reformular-pierde-la-cifra", multa: "la respuesta original sostenía su conclusión con cifras y tu versión no trae ninguna. «Más corto» o «para otro lector» no es quitar el número: es quitar el rodeo. La conclusión viaja con su cifra clave — la misma de antes, con el mismo dueño." });
    }
  }

  /* (c) SIN NADA QUE REFORMULAR, se dice ESO — no que falta información. */
  if (!hayPrevia && _NO_TENGO.test(t)) {
    v.push({ regla: "reformular-sin-previa-mal-dicho", multa: "todavía no hay una respuesta que reescribir en este hilo, y eso es lo que hay que decir. Decir «no tengo información autorizada» es otra cosa y es falsa: el dato está, lo que falta es la lectura. Dilo así y ofrécele hacerla." });
  }
  return v;
}
