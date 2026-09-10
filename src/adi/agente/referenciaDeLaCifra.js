/* === src/adi/agente/referenciaDeLaCifra.js · UNA CIFRA QUE SOSTIENE UNA RECOMENDACIÓN TRAE SU REFERENCIA ====
 *
 * LA REGLA DEL OWNER, textual (2026-09-09): «Si ADI usa una cifra para sostener una recomendación, debe traer
 * también su referencia. No basta decir "su carga es 4.5%"; debe decir "4.5% contra nivel declarado de 3.5%".»
 *
 * DE DÓNDE SALE, y por eso es ley y no una nota de estilo: al pesar «¿le doy más descuento a X?», el
 * procedimiento decía «su carga comercial hoy va 4.5% — el espacio lo ves ahí». La cifra era correcta, estaba
 * en la boleta y ningún juez del muro tenía nada que objetar. Y aun así la frase no servía para decidir: un
 * 4.5% no es alto ni bajo hasta que se dice contra qué. Sin la referencia, «tienes espacio» era una opinión
 * con una cifra al lado.
 *
 * ⚠️ NO ES «TODA CIFRA LLEVA REFERENCIA». Una lectura corriente —«te deben $41.2M»— es un hecho y se dice
 * solo. Lo que la regla cubre es la cifra que hace de ARGUMENTO: la que aparece en la misma frase en que ADI
 * empuja una decisión. Ahí, sin vara de comparación, el dueño no puede evaluar el consejo, solo creerlo.
 *
 * QUÉ CUENTA COMO REFERENCIA, y es deliberadamente amplio porque hay muchas formas legítimas de darla:
 *   · una SEGUNDA cifra en la misma frase («4.5% contra 3.5%», «$17.3M contra $17.8M»);
 *   · una palabra de comparación con su término («sobre el benchmark declarado», «bajo el nivel declarado»,
 *     «contra el período comparable», «al revés del año anterior»);
 *   · el propio nombre de la cifra cuando YA es relativa («exceso», «brecha», «por sobre», «variación»): un
 *     exceso trae su referencia por construcción — es la distancia a ella.
 *
 * ⚠️ JUZGA AL CEREBRO, NO A LOS PELDAÑOS — el criterio de la casa: la línea honesta y el respaldo sirven
 * textos ya juzgados, y multar al que rescata es castigar al que arregla.
 *
 * PURO · determinístico · sin red. */

/* ── EMPUJAR UNA DECISIÓN ──────────────────────────────────────────────────────────────────────────────────
 * La frase donde ADI dice qué hacer, qué conviene, o qué margen de maniobra hay. NO entran las OFERTAS
 * («¿te abro el detalle?», «dime si lo vemos»), que son el cierre normal del contrato y no recomiendan nada. */
const _RECOMIENDA = new RegExp([
  `\\b(?:te )?conviene\\b`, `\\bdeber[ií]as\\b`, `\\bte recomiendo\\b`, `\\bte sugiero\\b`,
  `\\byo (?:entrar[ií]a|empezar[ií]a|arrancar[ií]a|mirar[ií]a|priorizar[ií]a|partir[ií]a|(?:la|lo) (?:dejar[ií]a|soltar[ií]a|mantendr[ií]a))\\b`,
  `\\bhay que\\b`, `\\blo (?:mejor|ideal) (?:es|ser[ií]a)\\b`,
  `\\b(?:empieza|arranca|parte|entra) por\\b`, `\\bprioriza\\b`, `\\brenegocia\\b`,
  `\\btienes espacio\\b`, `\\bhay espacio\\b`, `\\bel espacio lo ves\\b`, `\\bpuedes ceder\\b`, `\\bno (?:le )?cedas\\b`,
  `\\bte sale caro\\b`, `\\bno (?:te )?conviene\\b`, `\\bvale la pena\\b`,
  `\\bel dato (?:no )?sostiene\\b`, `\\bes tu (?:problema|prioridad)\\b`,
].join("|"), "i");

/* ── LA REFERENCIA, en cualquiera de sus formas legítimas ─────────────────────────────────────────────────── */
const _COMPARA = new RegExp([
  `\\bcontra\\b`, `\\bvs\\.?\\b`, `\\bfrente a\\b`, `\\brespecto (?:a|de)\\b`, `\\bcomparad[oa]\\b`,
  `\\b(?:sobre|bajo|por sobre|por debajo de|encima de|debajo de) (?:el|la|los|las|un|una|su|tu)\\b`,
  `\\bbenchmark\\b`, `\\bdeclarad[oa]\\b`, `\\bcomparable\\b`, `\\baño anterior\\b`, `\\bper[ií]odo anterior\\b`,
  `\\bdel total\\b`, `\\bde (?:un|el) total\\b`, `\\bde la cartera\\b`, `\\bde \\d+\\b`,
].join("|"), "i");

/* la cifra que YA es relativa: trae su referencia por construcción, porque ES la distancia a ella */
const _YA_RELATIVA = /\bexceso\b|\bbrecha\b|\bvariaci[oó]n\b|\bcreci[oó]\b|\bcay[oó]\b|\bpor sobre\b|\bde m[aá]s\b|\bYoY\b|\bpp\b/i;

/** las cifras del turno, tal como la boleta las publica (lo que el muro considera citable). */
function _cifrasDelTurno(figs) {
  const s = new Set();
  for (const f of Array.isArray(figs) ? figs : []) {
    const v = String((f && (f.text || f.value)) || "");
    if (v && /\d/.test(v)) s.add(v);
  }
  return s;
}

/**
 * vetosDeReferencia(texto, ctx) → [{ regla, multa }]
 * Se suma al muro como los demás jueces: no lo reemplaza ni lo afloja.
 */
export function vetosDeReferencia(texto, { figs = [], sitio = "cierre" } = {}) {
  const t = String(texto || "");
  if (!t.trim()) return [];
  if (sitio !== "cierre" && sitio !== "reparacion" && !String(sitio).startsWith("playbook:")) return [];
  const cifras = _cifrasDelTurno(figs);
  if (!cifras.size) return [];

  /* ⚠️ EL PUNTO DECIMAL NO CORTA ORACIÓN («4.5%», «$2.3M»): el mismo cuidado que guardC documenta con sus
   * cifras enmascaradas. Se corta en punto/punto y coma/salto que NO esté entre dígitos. */
  const oraciones = t.split(/(?<!\d)[.;\n](?!\d)/);
  const v = [];
  for (let i = 0; i < oraciones.length; i++) {
    let o = oraciones[i];
    if (!_RECOMIENDA.test(o)) continue;
    /* las cifras del turno que aparecen EN ESTA frase */
    let enFrase = [...cifras].filter((c) => o.includes(c));
    /* ⚠️ LA CIFRA PUEDE VENIR EN LA FRASE SIGUIENTE, y es la forma más natural de escribirlo: «Te conviene
     * mirarlo. Su carga va 4.5%». El consejo y su respaldo están separados por un punto y siguen siendo la
     * misma afirmación — lo destapó una carnada del gate que yo había escrito mal y que, al revisarla, resultó
     * ser un hueco de verdad. Se mira la siguiente SOLO si ella no recomienda por su cuenta (si lo hace, se
     * juzga sola en su propia vuelta y multarla dos veces sería cobrar el mismo defecto dos veces). */
    if (!enFrase.length && i + 1 < oraciones.length && !_RECOMIENDA.test(oraciones[i + 1])) {
      const sig = oraciones[i + 1];
      const enSig = [...cifras].filter((c) => sig.includes(c));
      if (enSig.length) { o = `${o}. ${sig}`; enFrase = enSig; }
    }
    if (!enFrase.length) continue;                 // recomendar sin cifra es otro problema, de otro juez
    if (enFrase.length >= 2) continue;             // dos cifras juntas ya son cifra y referencia
    if (_COMPARA.test(o) || _YA_RELATIVA.test(o)) continue;
    /* la referencia puede venir en la frase inmediatamente anterior: «Su carga va 4.5%. El nivel declarado
     * es 3.5%, así que conviene…» es una referencia dada, solo que en dos tiempos. */
    const antes = i > 0 ? oraciones[i - 1] : "";
    if (antes && ([...cifras].some((c) => antes.includes(c)) && (_COMPARA.test(antes) || _COMPARA.test(o)))) continue;
    v.push({
      regla: "cifra-sin-referencia",
      multa: `usas «${enFrase[0]}» para sostener una recomendación sin decir contra qué («${o.trim().slice(0, 70)}…»). Una cifra sola no es alta ni baja: sin su referencia el dueño no puede evaluar el consejo, solo creerlo. Di «${enFrase[0]} contra el nivel declarado de …» —o el benchmark, o el período comparable— con la cifra de esa referencia al lado.`,
    });
  }
  return v;
}
