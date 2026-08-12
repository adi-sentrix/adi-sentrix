/* === src/adi/llm/voiceGuard.js · ADI Core · GUARD DE VOZ (determinístico) ===
 * La narración LLM (#2) debe entrar DIRECTO al negocio (controller/CFO senior): "Falabella cede margen por carga alta…",
 * no "Estuve revisando los números de Falabella y…". gpt-4o-mini no obedece el prompt de forma consistente (whack-a-mole
 * por conjugación · owner 2026-07-06). Este guard es el BACKSTOP determinístico: mata aperturas de PLANTILLA y muletillas
 * conectoras SIN tocar cifras (corre DESPUÉS del number-guard, sobre el texto ya validado). Puro string → testeable
 * (_voice_gate). NO toca el motor ni el seam · vive en la capa UI de narración (_narrateResult). Idempotente.
 */

const _cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

// Familia "revisé/analicé/miré <OBJETO-DE-DATOS> (de X)? y (encontré) que…" ROBUSTA a conjugación. El ancla SEGURA es el
// OBJETO-DE-DATOS (los números / los datos / la información / las cifras…) JUSTO tras el verbo → el contenido real jamás
// abre así (sólo la muletilla de informe). Consume hasta el hallazgo (deja "hay un par de cosas…"/"tres áreas…") y, si
// sigue un verbo de hallazgo + "que", lo consume. No toca cifras.
const _REVIEW_VERB = String.raw`(?:revis\p{L}+|analiz\p{L}+|analic\p{L}+|mir\p{L}+|examin\p{L}+|repas\p{L}+|estudi\p{L}+|evalu\p{L}+)`;
const _DATA_OBJ = String.raw`(?:(?:tus|los|las|mis|sus)\s+(?:datos|n[uú]meros|cifras)|la\s+(?:informaci[oó]n|data|situaci[oó]n|cartera)|el\s+(?:detalle|negocio|panorama)|tu\s+(?:cartera|negocio|informaci[oó]n|data))`;
const _FOUND_VERB = String.raw`(?:encontr\p{L}+|detect\p{L}+|not\p{L}+|identific\p{L}+|hall\p{L}+|vist\p{L}+|observ\p{L}+|cuent\p{L}+|ve\p{L}*)`;
const REVIEW_PREAMBLE = new RegExp(
  String.raw`^\s*(?:tras\s+|luego\s+de\s+|despu[eé]s\s+de\s+)?(?:he\s+|hemos\s+|estuve\s+|estoy\s+|estuvimos\s+)?(?:estado\s+)?` +
  _REVIEW_VERB + String.raw`\s+` + _DATA_OBJ +
  String.raw`(?:\s+de\s+\p{L}+(?:\s+\p{L}+)?)?\s*[,.:]?\s*(?:y\s+)?(?:(?:he\s+|te\s+|hemos\s+)?` + _FOUND_VERB + String.raw`\s*(?:que\s+)?)?`,
  "iu",
);
// Aperturas de PLANTILLA al inicio del mensaje → se borran; la frase real arranca y se capitaliza. Una sola vez.
const OPENERS = [
  REVIEW_PREAMBLE,
  /^\s*las\s+proyecciones\s+(?:indican|muestran|sugieren|reflejan|se[ñn]alan)\s+que\s+/iu,
  /^\s*(?:estos\s+datos|los\s+datos|las\s+cifras|los\s+n[uú]meros|estas\s+cifras)\s+(?:indican|muestran|sugieren|reflejan|se[ñn]alan)\s+que\s+/iu,
  /^\s*seg[uú]n\s+(?:los\s+datos|el\s+an[aá]lisis|la\s+informaci[oó]n|las\s+cifras)\s*[,]?\s*/iu,
];

// Muletillas CONECTORAS a inicio de frase (arranque o tras . ; : ! ?) → se borran, la palabra siguiente se capitaliza.
// Incluye "estos/los datos indican que" (informe) y fillers ("Claramente,"). OJO: "es importante NOTAR que" (muletilla),
// NO "es importante que <acción>" (recomendación real).
const CONNECTOR = /(^|[.;:!?]\s+)(?:sin\s+embargo|no\s+obstante|dicho\s+esto|claramente|obviamente|evidentemente|en\s+resumen|en\s+conclusi[oó]n|es\s+importante\s+(?:notar|destacar|mencionar)\s+que|cabe\s+(?:destacar|notar|mencionar)\s+que|(?:estos\s+datos|los\s+datos|las\s+cifras|los\s+n[uú]meros)\s+(?:indican|muestran|sugieren|reflejan|se[ñn]alan)\s+que)\s*[,]?\s+(\p{L})/giu;

// stripRoboticVoice(text) → sin apertura de plantilla ni muletillas conectoras. Idempotente · number-safe.
export function stripRoboticVoice(text) {
  if (typeof text !== "string" || !text.trim()) return text;
  let s = text;
  for (const re of OPENERS) {
    if (re.test(s)) {
      const stripped = _cap(s.replace(re, "").replace(/^\s+/, ""));
      if (stripped.trim()) s = stripped;   // seguridad: nunca dejar vacío
      break;
    }
  }
  // muletillas conectoras · loop hasta estable (atrapa encadenadas: "Claramente, estos datos indican que…")
  for (let i = 0; i < 4; i++) {
    const prev = s;
    s = s.replace(CONNECTOR, (_m, pre, ch) => pre + ch.toUpperCase());
    if (s === prev) break;
  }
  return s;
}

// ── MULETILLA PROACTIVA (owner 2026-07-09: "no deberíamos tener muletillas — si el LLM interpreta el dato, debe
// decir la realidad") · el suffix enlatado "Un punto que no saliste a buscar: …" se pegaba a CUALQUIER respuesta
// (hasta degradas). Se elimina del texto en el camino LLM; el insight (real, calculado) viaja como GANCHO en la
// boleta del diagnóstico — el narrador decide si viene al caso, con cifras autorizadas. Idempotente · number-safe
// (el piso demo byte-exacto no pasa por acá).
const _PROACTIVE_SUFFIX = /\n*\s*Un punto que no saliste a buscar:[^\n]*/g;
export function stripProactiveSuffix(text) {
  if (typeof text !== "string" || !text.trim()) return text;
  const s = text.replace(_PROACTIVE_SUFFIX, "").replace(/\s+$/, "");
  return s.trim() ? s : text;   // seguridad: nunca dejar vacío
}

// ── LEAKS DE IDIOMA Y SLANG (owner 2026-07-10: "esas correcciones son vitales") · el narrador soltó en vivo
// "¿Qué te parece if profundizamos?" (inglés) y "la pasta" (slang de España — P6: registro de directorio, jamás
// slang). El prompt ya lo prohíbe; esto es la GARANTÍA. Solo sustituciones INEQUÍVOCAS y gramaticalmente seguras
// (palabra completa · ninguna es palabra española válida · "so" se excluye por "so pena"). Preserva la mayúscula
// inicial. Idempotente · number-safe (no toca dígitos ni nombres propios — \b no corta SKUs/marcas). ──
// + REGISTRO VETADO POR EL OWNER (revisión de la Mesa 2026-07-14: "Este **upside** es una **palanca** que podemos
// aprovechar" y "sin que **nos pegue** en las ventas" salieron NARRADOS — el _registro_gate lockea los textos
// determinísticos, esta tabla es la garantía sobre la narración): palanca→acción · upside→potencial · nos pegue→
// nos afecte. "Palanca" sí es palabra española, pero está vetada del registro (sello ejecutivo · commit 82e03c7).
const _LEAKS = [
  // `\b` DE CIERRE + VOCAL ACENTUADA (bug real cazado al sumar el barrido de voseo, owner 2026-08-10): `\b` es
  // ASCII, así que en «andá» el borde cae entre la "d" y la "á" y `\band\b` reescribía el prefijo → «yá». La
  // palabra inglesa se sigue cazando igual; lo único que cambia es que ya no parte una palabra española que
  // arranca con esas mismas letras. Mismo cierre Unicode que usa la tabla de voseo de más abajo.
  [/\bif(?![\p{L}])/giu, "si"], [/\band(?![\p{L}])/giu, "y"], [/\bbut(?![\p{L}])/giu, "pero"],
  [/\bwith(?![\p{L}])/giu, "con"], [/\bfor(?![\p{L}])/giu, "para"],
  [/\bdeep dive\b/gi, "análisis a fondo"], [/\bdive into\b/gi, "análisis a fondo de"],
  [/\binsights\b/gi, "hallazgos"], [/\binsight\b/gi, "hallazgo"],
  [/\bla pasta\b(?!\s+de)/gi, "el capital"], [/\bguita\b/gi, "caja"],
  [/\bpalancas\b/gi, "acciones"], [/\bpalanca\b/gi, "acción"],
  [/\bupsides\b/gi, "potenciales"], [/\bupside\b/gi, "potencial"],
  [/\bnos\s+pegue\b/gi, "nos afecte"],
  // + IGUALAR EL GATE ESTÁTICO (owner 2026-07-26: "apretado" se coló NARRADO en vivo) · el _registro_gate BANNED ya
  // lockea el texto determinístico, pero el stripper de la voz viva sólo cubría guita/palanca — faltaban apretar/
  // dormido/plata. Ahora la GARANTÍA sobre la narración cubre el MISMO set. Formas ENUMERADAS (no \w* — inflexionaría
  // mal): preservan inflexión, concordancia de género y mayúscula inicial · palabra completa (\b) · number-safe ·
  // idempotentes (ninguna réplica es palabra vetada). plata→caja: femenino, "la plata"→"la caja" (consistente con
  // guita→caja); NO "capital" a secas, que en "la plata" daría "la capital"=ciudad. Plurales antes que singulares.
  [/\bapretados\b/gi, "ajustados"], [/\bapretadas\b/gi, "ajustadas"],
  [/\bapretado\b/gi, "ajustado"], [/\bapretada\b/gi, "ajustada"],
  [/\bapretando\b/gi, "ajustando"], [/\bapretar\b/gi, "ajustar"],
  [/\baprietan\b/gi, "ajustan"], [/\baprieta\b/gi, "ajusta"],
  [/\bdormidos\b/gi, "detenidos"], [/\bdormidas\b/gi, "detenidas"],
  [/\bdormido\b/gi, "detenido"], [/\bdormida\b/gi, "detenida"],
  [/\bplata\b/gi, "caja"],
];
// ── VOSEO → TUTEO NEUTRO (owner 2026-08-10, certificación live · defecto 4) ────────────────────────────────────
// EL HALLAZGO: el registro es "formal LatAm, sin chilenismos", y el `_registro_gate` lo verificaba desde 2026-07-14
// — pero busca VOCABULARIO PROHIBIDO (plata, dormido, palanca, apretar), no FORMAS VERBALES. Por eso «querés»,
// «podés», «decime» y «mirá» pasaban los 86 gates sin que nada se pusiera rojo: ninguna de esas palabras está en
// la lista, y la lista era el único criterio. El voseo no es un descuido de redacción: es otro dialecto, y en una
// herramienta que se presenta como asesor ejecutivo para LatAm lo marca de inmediato.
//
// POR QUÉ ACÁ ADEMÁS DE EN EL TEXTO DETERMINÍSTICO: los literales del motor se arreglan uno por uno (y este pase
// los arregla), pero el narrador redacta libre — y los prompts que lo guían están escritos en voseo, así que lo
// imita. La misma arquitectura que ya vale para el registro desde el sello ejecutivo: doctrina en el prompt MÁS
// cerrojo determinístico sobre la voz viva. Una regla escrita no frena una forma verbal; una sustitución sí.
//
// QUÉ NO ENTRA, A PROPÓSITO: los imperativos en -í («pedí», «elegí», «seguí», «abrí», «subí») son AMBIGUOS con el
// pretérito de primera persona («yo pedí el dato») — reescribirlos automáticamente rompería oraciones correctas.
// Se dejan fuera del cerrojo runtime y se barren a mano en el texto determinístico, donde cada caso se puede leer.
// Formas ENUMERADAS (no \w*, que inflexionaría mal) · palabra completa · preserva la mayúscula inicial ·
// number-safe · idempotente (ninguna réplica es a su vez una forma voseante).
// EL `\b` DE CIERRE NO SIRVE ACÁ, y es la trampa que este repo ya documenta en dos archivos
// (progressiveDisclosure.js `_PIDE_TABLA`, `_DESGLOSE`): `\b` es ASCII, así que después de una vocal acentuada NO
// hay borde de palabra y «comenzá»/«mirá»/«considerá» —justo las formas que un usuario escribe de verdad— se
// escapaban enteras. Se cierra con un lookahead de letra Unicode, con flag `u`.
// SEGUNDA TRAMPA, y por eso algunas exigen tilde: para «hacé/poné/tené/andá/entregá», la forma SIN tilde es
// tercera persona legítima («el motor hace X», «la entrega»), y reescribirla rompería prosa correcta. Ahí la
// tilde es obligatoria. Donde la forma sin tilde no existe («comenza», «pensa») o donde la sustitución es un
// no-op («mira»→«mira», «arma»→«arma»), se aceptan las dos y no hay riesgo.
const _FIN = "(?![\\p{L}])";
const _v = (patron, rep) => [new RegExp("\\b" + patron + _FIN, "giu"), rep];
const _VOSEO = [
  // presente de indicativo, 2ª persona voseante — ninguna de estas formas es ambigua
  _v("quer[eé]s", "quieres"), _v("pod[eé]s", "puedes"), _v("ten[eé]s", "tienes"),
  _v("sab[eé]s", "sabes"), _v("hac[eé]s", "haces"), _v("dec[ií]s", "dices"),
  _v("ven[ií]s", "vienes"), _v("prefer[ií]s", "prefieres"), _v("eleg[ií]s", "eliges"),
  _v("segu[ií]s", "sigues"), _v("vend[eé]s", "vendes"), _v("deb[eé]s", "debes"),
  _v("sos", "eres"),
  // «vos» ES DOS PRONOMBRES DISTINTOS y no se traduce con una sola palabra: sujeto → «tú» («vos decidís»), pero
  // TRAS PREPOSICIÓN el tuteo usa la forma tónica «ti» («declarado por vos» → «por ti», nunca «por tú»). La regla
  // de preposición va PRIMERO: si corriera después, el genérico ya habría dejado un «por tú» agramatical.
  [/\b(por|para|a|de|con|en|sin|sobre|entre|hacia|hasta|según)\s+vos(?![\p{L}])/giu, (_m, prep) => `${prep} ti`],
  _v("vos", "tú"),
  // imperativos visibles que el barrido de la primera vuelta no cubría (owner 2026-08-10, segunda pasada: la UI
  // los usa mucho en los textos de ayuda — «tocá una fila», «pasá el cursor», «editá conversando»)
  _v("toc[aá]", "toca"), _v("pas[aá]", "pasa"), _v("edit[aá]", "edita"), _v("record[aá]", "recuerda"),
  _v("agreg[aá]", "agrega"), _v("sac[aá]", "saca"), _v("cambi[aá]", "cambia"), _v("fij[aá]", "fija"),
  _v("orden[aá]", "ordena"), _v("filtr[aá]", "filtra"), _v("seleccion[aá]", "selecciona"),
  _v("compar[aá]", "compara"), _v("calcul[aá]", "calcula"), _v("guard[aá]", "guarda"), _v("arranc[aá]", "arranca"),
  _v("declar[aá]", "declara"), _v("marc[aá]", "marca"), _v("ejecut[aá]", "ejecuta"), _v("confirm[aá]", "confirma"),
  // presente voseante REGULAR en -ás. NO se puede generalizar a "cualquier palabra terminada en -ás": el futuro
  // de tuteo es correcto y termina igual («verás», «podrás», «tendrás»), y además hay adverbios («jamás»,
  // «quizás», «además», «atrás»). Por eso van enumeradas, con su cambio de raíz cuando lo tienen.
  _v("necesit[aá]s", "necesitas"), _v("busc[aá]s", "buscas"), _v("us[aá]s", "usas"), _v("dej[aá]s", "dejas"),
  _v("llev[aá]s", "llevas"), _v("manej[aá]s", "manejas"), _v("trabaj[aá]s", "trabajas"), _v("esper[aá]s", "esperas"),
  _v("gan[aá]s", "ganas"), _v("compr[aá]s", "compras"), _v("pag[aá]s", "pagas"), _v("habl[aá]s", "hablas"),
  _v("trat[aá]s", "tratas"), _v("mir[aá]s", "miras"), _v("arm[aá]s", "armas"), _v("sum[aá]s", "sumas"),
  _v("baj[aá]s", "bajas"), _v("ajust[aá]s", "ajustas"), _v("revis[aá]s", "revisas"), _v("consider[aá]s", "consideras"),
  _v("mand[aá]s", "mandas"), _v("entreg[aá]s", "entregas"), _v("liquid[aá]s", "liquidas"), _v("rot[aá]s", "rotas"),
  // los de raíz que cambia (o → ue, e → ie): la sustitución NO es "sacarle la tilde"
  _v("pens[aá]s", "piensas"), _v("cerr[aá]s", "cierras"), _v("comenz[aá]s", "comienzas"), _v("empez[aá]s", "empiezas"),
  _v("prob[aá]s", "pruebas"), _v("encontr[aá]s", "encuentras"), _v("mostr[aá]s", "muestras"),
  _v("record[aá]s", "recuerdas"), _v("cont[aá]s", "cuentas"), _v("volv[eé]s", "vuelves"), _v("perd[eé]s", "pierdes"),
  // imperativos voseantes en -á/-é (los -í quedan fuera, ver arriba)
  _v("mir[aá]", "mira"), _v("dej[aá]", "deja"), _v("revis[aá]", "revisa"), _v("consider[aá]", "considera"),
  _v("comenz[aá]", "comienza"), _v("prob[aá]", "prueba"), _v("pens[aá]", "piensa"),
  _v("mand[aá]", "manda"), _v("empez[aá]", "empieza"), _v("sum[aá]", "suma"),
  _v("ajust[aá]", "ajusta"), _v("arm[aá]", "arma"), _v("tom[aá]", "toma"),
  _v("baj[aá]", "baja"), _v("cerr[aá]", "cierra"), _v("fraseal[aá]", "fraséala"),
  // tilde OBLIGATORIA: sin ella son tercera persona o sustantivo (ver el comentario de arriba)
  _v("hacé", "haz"), _v("tené", "ten"), _v("poné", "pon"), _v("andá", "ve"), _v("entregá", "entrega"),
  // enclíticos (la forma en que el voseo se cuela con más frecuencia en una oferta de seguimiento)
  _v("dec[ií]me", "dime"), _v("cont[aá]me", "cuéntame"), _v("mostr[aá]me", "muéstrame"),
  _v("dec[ií]le", "dile"), _v("fij[aá]te", "fíjate"), _v("acord[aá]te", "acuérdate"),
  _v("ped[ií]le", "pídele"),
  /* ── LA RED MORFOLÓGICA · ÚLTIMA, y por eso segura (owner 2026-08-11, defecto 4 de la certificación final) ───
   * MEDIDO: «Primero liquidá o rotá LG-DRYER8KG en Valparaíso» salió tal cual al usuario. Las formas estaban
   * enumeradas para el PRESENTE («liquidás», «rotás») pero no para el IMPERATIVO («liquidá», «rotá»), y una lista
   * cerrada siempre se queda corta: el narrador redacta libre y puede conjugar cualquier verbo del español.
   * EL IMPERATIVO VOSEANTE ES SISTEMÁTICO: es el infinitivo sin la -r final, con tilde en la última sílaba. Así
   * que la regla general es quitarle la tilde — «liquidá»→«liquida», «rotá»→«rota», «priorizá»→«prioriza».
   * VA AL FINAL A PROPÓSITO: las formas de raíz cambiante («pensá»→«piensa», «cerrá»→«cierra») ya se
   * sustituyeron arriba, así que acá sólo llegan las regulares, donde sacar la tilde ES la forma correcta.
   * LAS EXCLUSIONES NO SON OPCIONALES: en español hay palabras terminadas en «á» que no son verbos («está»,
   * «acá», «allá», «quizá», «ojalá», «sofá») y topónimos («Panamá», «Bogotá»). Sin esta lista, la red rompería
   * prosa correcta — que es peor que el voseo que viene a corregir.
   * SÓLO -á: el imperativo en -é («reponé») cambia de raíz en tuteo («repón») y quitarle la tilde da una forma
   * que no es la correcta; se deja a la enumeración, donde cada caso se decide leyéndolo. */
  /* TRES CORTES, y los tres se pagaron midiendo:
   *  · 3+ letras de raíz, no 4: «rotá» tiene tres («rot») y se escapaba entera.
   *  · SE ACEPTAN LAS CAPITALIZADAS: un imperativo al inicio de oración lo está («Validá el escenario»), y
   *    excluirlas dejaba pasar justo las que abren una recomendación. Los topónimos se cubren por lista.
   *  · SE EXCLUYE TODO LO TERMINADO EN «rá»: el FUTURO de tercera persona termina igual («podrá», «mejorará»,
   *    «tendrá») y quitarle la tilde rompe prosa correcta. Cuesta los imperativos de verbos en -rar («mejorá»),
   *    y se acepta: falso negativo antes que falso positivo, la doctrina de esta casa. */
  [/(?<![\p{L}])(?!(?:est|ac|all|quiz|ojal|sof|mam|pap|caf|dem|ah|panam|bogot|canad|paran)á(?![\p{L}]))([a-zñáéíóúA-ZÑÁÉÍÓÚ]{3,})á(?![\p{L}])/giu,
    (m, raiz) => (/r$/i.test(raiz) ? m : `${raiz}a`)],
];
// + NOTAS INTERNAS DEL ANALISTA (auditoría de asks 2026-07-15: cuando el number-guard bloquea la narración, el
// texto determinístico de una ruta rica del motor puede traer su cola de notas — "Sin driver interno obvio en
// los 5. El gap vs benchmark puede ser mix-effect o pricing · sugerir drilldown por cliente." — jerga en spanglish
// con tono de debug que el dueño no debe leer). La ORACIÓN completa se elimina (el motor sellado no se toca; esto
// solo corre en el camino LLM — el piso demo byte-exacto no pasa por acá). Nunca deja el texto vacío.
const _NOTAS_INTERNAS_RE = /\b(mix-?effect|drill\s?-?down|driver\s+interno|sugerir\s+drilldown)\b/i;
export function stripLanguageLeaks(text) {
  if (typeof text !== "string" || !text.trim()) return text;
  let s = text;
  for (const [re, rep] of [..._LEAKS, ..._VOSEO]) {
    // EL REEMPLAZO PUEDE SER UNA FUNCIÓN, y hasta hoy no podía (owner 2026-08-11). Esta línea llamaba
    // `rep.charAt(0)` sin mirar el tipo, así que CUALQUIER regla con reemplazo dinámico reventaba con TypeError
    // en cuanto matcheaba — incluida la de «por vos → por ti», que está escrita como función desde que se agregó.
    // No se había notado porque el único texto que la ejercitaba no llegaba a este pase. Ahora las dos formas
    // conviven: string (con su mayúscula preservada, como siempre) o función (que decide ella).
    s = s.replace(re, (...args) => {
      const m = args[0];
      if (typeof rep === "function") return rep(...args);
      return (m[0] === m[0].toUpperCase() && /[a-záéíóú]/i.test(m[0]) ? rep.charAt(0).toUpperCase() + rep.slice(1) : rep);
    });
  }
  if (_NOTAS_INTERNAS_RE.test(s)) {
    const parts = s.split(/([.!?]+["»)]*\s+|\n+)/);
    let out = "";
    for (let i = 0; i < parts.length; i += 2) {
      const sent = parts[i] || "", delim = parts[i + 1] || "";
      if (_NOTAS_INTERNAS_RE.test(sent)) continue;
      out += sent + delim;
    }
    out = out.replace(/\s+$/, "");
    if (out.trim()) s = out;
  }
  return s.trim() ? s : text;   // seguridad: nunca dejar vacío
}

// ── OFERTA FUERA DE DATO (owner 2026-07-09: "asegurarnos que considere solo lo que le damos como disponible") ·
// el narrador ofreció "¿analizamos las campañas de marketing?" — data que NO existe (promesa rota en el cierre
// libre). El prompt lleva el universo DISPONIBLE (capabilities.js) para que interprete adentro; este scrub es la
// GARANTÍA de última línea: toda ORACIÓN de la narración que mencione data inexistente se elimina completa (el
// piso determinístico jamás la contiene — solo corre en el camino LLM). Sin lookbehind (Safari viejo de invitados
// mobile). Nunca deja el texto vacío. Idempotente · number-safe (borra oraciones enteras, no toca cifras).
import { OUT_OF_DATA_RE } from "./capabilities.js";
export function stripOutOfDataOffers(text) {
  if (typeof text !== "string" || !text.trim() || !OUT_OF_DATA_RE.test(text)) return text;
  const parts = String(text).split(/([.!?]+["»)]*\s+|\n+)/);   // oración + su delimitador (pares)
  let out = "";
  for (let i = 0; i < parts.length; i += 2) {
    const sent = parts[i] || "", delim = parts[i + 1] || "";
    if (OUT_OF_DATA_RE.test(sent)) continue;
    out += sent + delim;
  }
  out = out.replace(/\s+$/, "");
  return out.trim() ? out : text;   // seguridad: nunca dejar vacío (el caso todo-marketing lo cubre el redirect)
}
