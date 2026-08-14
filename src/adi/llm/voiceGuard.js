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
  // ── «DETENIDO» APLICADO AL CAPITAL/INVENTARIO → «INMOVILIZADO» (cierre cert amplia 2026-08-13, hallazgo 4a) ──
  // CLAUDE.md §4: se dice «inmovilizado», no «detenido» — salió 4 veces en la certificación (D1 ×2, D4, H4).
  // SOLO el bigrama completo (con «total» opcional en el medio: «capital total detenido», medido en D1): el VERBO
  // sobre un SKU/proceso es legítimo y NO se toca — «¿por qué se detuvo el SKU?» / «MAK-COMP-AIR está detenido»
  // (H3/H4). Van DESPUÉS de dormido→detenido a propósito: «capital dormido» encadena a «capital detenido» y de
  // ahí acá, en la misma pasada. La función preserva la mayúscula del sustantivo (encabezados de tabla incluidos).
  [/\b(capital(?:es)?|inventarios?)(\s+total(?:es)?)?\s+detenido(s)?\b/gi, (_m, n, tot, pl) => `${n}${tot || ""} inmovilizado${pl || ""}`],
  // + ANGLICISMOS DE NEGOCIO (owner 2026-08-13, certificación viva #2 · hilo B turno 2) · MEDIDO EN VIVO: «la
  // distancia entre tu margen actual y ese reference point» — inglés de consultora en un producto cuyo registro es
  // español formal LatAm. El prompt ya pide español; esta tabla es la GARANTÍA, igual que if/insight/deep-dive
  // arriba. Lista CURADA Y ANGOSTA — el vocabulario ADOPTADO del producto NO se barre:
  //   · «benchmark» y «rebate» tienen entrada propia en el glosario (CONCEPT_DEFS.benchmark/.rebate) y SON la
  //     palabra oficial del producto;
  //   · «target» es label vivo del dato («Target de carga comercial», entityRecord.js:82 / criteria.js:26) —
  //     barrerlo reescribiría una etiqueta autorizada de la boleta y guardC la leería como cifra ajena;
  //   · «gap» es etiqueta declarada del concepto brecha (glossary.js, entrada `brecha`) y aparece en texto CURADO
  //     del propio glosario («El gap de margen partido…»); además cambia de género (el gap → la brecha) y la
  //     sustitución de palabra sola rompería concordancia. Falso negativo antes que falso positivo.
  [/\breference points\b/gi, "puntos de referencia"],   // la fuga medida; el glosario ya define benchmark como «punto de referencia»
  [/\breference point\b/gi, "punto de referencia"],
  // driver→factor: ambos masculinos, concordancia intacta. «driver interno» SE EXCLUYE con el lookahead: es el
  // marcador de _NOTAS_INTERNAS_RE (abajo), que elimina la oración ENTERA de notas de analista — traducirlo acá le
  // sacaría el marcador a esa red y la nota saldría a pantalla en español en vez de eliminada.
  [/\bdrivers\b/gi, "factores"],
  [/\bdriver\b(?!\s+intern)/gi, "factor"],
  // performance→desempeño: el caso dominante del dominio es invariante («performance comercial», «performance de
  // X», «del período»). El artículo se enumera porque cambia de género (la performance → el desempeño), el mismo
  // cuidado que «la pasta → el capital». Límite conocido y aceptado: un adjetivo femenino pospuesto poco frecuente
  // («performance financiera») quedaría discorde — se prefiere eso al inglés en registro de directorio.
  [/\bla performance\b/gi, "el desempeño"],
  [/\buna performance\b/gi, "un desempeño"],
  [/\bperformance\b/gi, "desempeño"],
  // ── «VARA» JAMÁS EN SUPERFICIE (cierre del espejo Anthropic 2026-08-13, hallazgo 4) ───────────────────────────
  // CLAUDE.md §4 la prohíbe en superficie desde el sello ejecutivo, y el narrador de Sonnet la dijo en vivo ×4
  // («tu propia vara es la que manda» — E3/F1/F3 del espejo): el prompt no alcanza, esta tabla es la garantía —
  // la misma arquitectura que palanca/plata/dormido. TRES FORMAS ENUMERADAS (no \bvara\b suelto): el barrido es
  // del TEXTO NARRADO, nunca del catálogo — el CONCEPTO `vara` del glosario (slug/aka/etiquetas/definición
  // curada, glossary.js) queda intacto y defineConcept lo sigue sirviendo verbatim por su propia ruta (que no
  // pasa por acá). ECO DEL USUARIO: si el usuario escribió «vara», su palabra en la PREGUNTA no es nuestra — pero
  // este barrido corre sobre la NARRACIÓN, y si la narración la repite como eco se barre igual: el registro manda
  // sobre el eco (decisión del cierre del espejo, documentada en _INFORME_ESPEJO_CIERRE.md). Ambos géneros
  // coinciden (vara→referencia, femenino→femenino): concordancia intacta. Number-safe (\b, cero dígitos) e
  // idempotente («referencia» no contiene «vara»); «varado/varada» (SKU encallado) no matchea por el \b.
  // ── LA CLASE CERRADA (medido en vivo 2026-08-14, `_medir_ojos_vivo.json` turno 7): el narrador escribió «Con
  // **esa vara** puesta, Falabella queda 8,1 puntos por debajo» — y los cuatro patrones de arriba miraban `tu`,
  // `la` y `declarada`, así que «esa» pasó entera. Un determinante no cambia el registro: si «vara» está vetada,
  // lo está con cualquiera. Se cierra por CLASE — la lista de determinantes, no la de frases.
  // EL DETERMINANTE SE PRESERVA (grupo 1): «vara» y «referencia» son las dos femeninas, así que la concordancia
  // queda intacta sola, incluidos los adjetivos pospuestos («esa vara puesta» → «esa referencia puesta»). Además
  // hereda la mayúscula del determinante sin trabajo extra («Esa vara» → «Esa referencia»).
  // EL PLURAL EXIGE DETERMINANTE, y no es un capricho: **«Puerto Varas» es un topónimo chileno real** y este
  // producto es chileno. Un `\bvaras\b` suelto lo convertiría en «Puerto referencias». Con determinante femenino
  // plural delante, el topónimo no matchea nunca.
  // EL CONCEPTO DEL GLOSARIO NO SE TOCA, y está verificado, no supuesto: la entrada `vara` de `CONCEPT_DEFS` la
  // sirve `defineConcept` → `composeFromTextualEvidence`, y esa ruta arma la respuesta VERBATIM sin pasar por
  // este stripper (answerViaOracle.js:2714-2728 · el lavado de la línea 2816 corre sólo sobre el borrador del
  // narrador). Lo que sí se barre es el ECO narrado, que es la decisión ya tomada en el cierre del espejo.
  [/\b(tu|su|mi)\s+propia\s+vara(?![\p{L}])/giu, (_m, det) => `${det} referencia`],
  [/\b(la|una|esa|esta|aquella|tu|su|mi|nuestra|otra|dicha|misma|cada|cualquier)\s+vara(?![\p{L}])/giu, (_m, det) => `${det} referencia`],
  [/\b(las|unas|esas|estas|aquellas|tus|sus|mis|nuestras|otras|dichas|mismas|algunas|varias|ambas)\s+varas(?![\p{L}])/giu, (_m, det) => `${det} referencias`],
  // sin determinante, sólo con el adjetivo que la califica — enumerado, nunca `\bvara\b` suelto
  // acá la mayúscula NO viene de un grupo capturado (las de arriba la heredan del determinante), así que la
  // decide la función: es el sustantivo el que abre la frase («Vara mínima: 30.1%» es un encabezado real).
  [/\bvara\s+(declarada|propia|alta|baja|m[ií]nima|m[aá]xima|actual|vigente|puesta|fijada|definida)(?![\p{L}])/giu,
    (m, adj) => `${/^[A-ZÁÉÍÓÚ]/.test(m) ? "Referencia" : "referencia"} ${adj}`],
  /* ── Y ACÁ SE CIERRA DE VERDAD (medido 2026-08-14, examen 1 · turno 3, camino natural): «**Aclaración de vara
   * primero:**» llegó ENTERA a pantalla — sin determinante y sin adjetivo, colgada de una PREPOSICIÓN. Enumerar
   * ahora la clase de las preposiciones sería el TERCER parche del mismo agujero, y el propio comentario de
   * arriba ya dice por qué no alcanza: «si «vara» está vetada, lo está con cualquiera».
   * EL SINGULAR SE BARRE SUELTO. La razón por la que no se hacía es del PLURAL, no del singular: «Puerto Varas»
   * es un topónimo chileno real, y por eso el plural sigue exigiendo determinante. En singular no hay colisión —
   * «varado/varada» (SKU encallado) no matchea por el `\b` + el lookahead de letra.
   * VA AL FINAL a propósito: las reglas de arriba preservan determinante y adjetivo con su concordancia, y esta
   * solo recoge lo que quedó. Idempotente («referencia» no contiene «vara») y number-safe (cero dígitos). */
  [/\bvara(?![\p{L}])/giu, (m) => (/^[A-ZÁÉÍÓÚ]/.test(m) ? "Referencia" : "referencia")],
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

/* _voseoConContexto(pares) → reglas que SÓLO convierten en posición de orden (owner 2026-08-11, punto 7).
 * `-é` y `-í` son ambiguos de una forma que `-á` no lo es: «reponé» es imperativo voseante, pero «compré» es el
 * pretérito de primera persona de un verbo en -ar; y «corregí» es LAS DOS COSAS a la vez — «corregí las
 * condiciones» (orden) y «corregí el dato ayer» (lo que hice). La terminación sola no alcanza, así que se pide
 * contexto: el imperativo ABRE la oración o va tras un conector de orden, y la oración no puede traer marca de
 * pasado ni sujeto de primera persona. Ante la duda no se toca: dejar pasar un voseo cuesta una palabra;
 * reescribir «corregí el dato ayer» cambia lo que la frase dice. */
const _APERTURA = "((?:^|[.!?;:]\\s+|\\n\\s*|\\b(?:primero|despu[eé]s|luego|entonces|adem[aá]s)[,:]?\\s+))";
const _NO_ES_PASADO = "(?![^.!?\\n]*\\b(?:ayer|anoche|anteayer|pasad[oa]|hace\\s+\\w+|ya\\s+lo|yo)\\b)";
const _voseoConContexto = (pares) => pares.map(([vos, tu]) => [
  new RegExp(`(?<![\\p{L}])${_APERTURA}${vos}${_FIN}${_NO_ES_PASADO}`, "gimu"),
  (m, pre) => `${pre}${/^[A-ZÁÉÍÓÚ]/.test(m.trim()) && m.trim().startsWith(vos.charAt(0).toUpperCase()) ? tu.charAt(0).toUpperCase() + tu.slice(1) : tu}`,
]);
const _v = (patron, rep) => [new RegExp("\\b" + patron + _FIN, "giu"), rep];

/* ══ LA RED MORFOLÓGICA DEL PRESENTE Y DE LOS ENCLÍTICOS ═══════════════════════════════════════════════════════
 * EL HUECO QUE CIERRA, medido en vivo (`_medir_ojos_vivo.json`, turno 2): el narrador escribió «…te muestro qué
 * pasa con esa cuenta si **subís** el volumen 4%». «subís» no estaba en ninguna lista de arriba — y no iba a
 * estarlo. De las 316 variantes que el detector nombra, las enumeraciones lavaban 150; y los prompts que guían al
 * narrador están en voseo A PROPÓSITO, así que va a seguir produciendo formas nuevas. Una lista cerrada no gana
 * esa carrera. Una regla sí.
 *
 * TRES REDES, NO UNA, y la diferencia no es de estilo: es que cada terminación tiene un riesgo distinto.
 *   · **-ás (verbos en -ar) → RED ABIERTA.** Las palabras españolas terminadas en «ás» que NO son verbos son una
 *     clase CERRADA y corta (estás · jamás · quizás · además · demás · compás · Tomás · Nicolás), y TODO el futuro
 *     de tuteo termina en «rás» —incluidos los sincopados «harás», «dirás», «podrás», «tendrás»—, así que se
 *     excluye entero con una condición sobre la raíz. El condicional («recuperarías») no entra siquiera en la
 *     red: lleva la tilde en la «í», no en la «a». El tuteo es quitar la tilde.
 *   · **-és y -ís → TABLA DERIVADA DE INFINITIVOS, jamás red abierta.** Acá la terminación choca con clases
 *     ABIERTAS y productivas del español, y una red las rompería: los gentilicios en -és (francés, japonés,
 *     escocés — familia que crece) y los sustantivos de uso diario en prosa de negocios («después», «interés»,
 *     «a través», «al revés», «marqués»); y en -ís, «país» y —verificado contra el catálogo de este tenant— el
 *     cliente **«Paris»**. La tabla deriva LAS MISMAS formas por regla, pero sólo desde verbos declarados: lo que
 *     no está en la tabla no se toca. Falso negativo antes que falso positivo, la doctrina de esta casa.
 *   · **Enclíticos → tabla de raíces, una regex por conjugación.** La vocal temática tiene que corresponder al
 *     verbo (-ar→«a», -er→«e», -ir→«i») y no puede ser un comodín: «avisame» es voseo, pero **«avíseme» es el
 *     imperativo de USTED**, que es el registro formal que este producto quiere. Aceptar cualquier vocal
 *     convertiría el trato de usted en tuteo — arruinaría justo lo que venimos a proteger.
 *
 * Todo lo de acá abajo respeta las reglas del archivo: number-safe (ninguna regla mira un dígito) · idempotente
 * (ninguna réplica es a su vez forma voseante) · preserva la mayúscula inicial · SIN LOOKBEHIND (el borde
 * izquierdo se resuelve capturando el carácter previo y reinyectándolo) · las réplicas conservan persona y
 * concordancia, que es la razón de que la tabla declare el tuteo de cada verbo de raíz cambiante en vez de
 * derivarlo quitando la tilde. */

// preserva la mayúscula igual que el camino de reemplazo-string de `stripLanguageLeaks` (que sólo la aplica
// cuando la réplica es un string — estas reglas devuelven función, así que la aplican ellas). EL CASO TODO-
// MAYÚSCULAS es propio y salió del barrido de literales: el motor usa versales para ENFATIZAR una instrucción
// («DECLARALO en la primera frase»), y capitalizar sólo la inicial devolvía «Decláralo» — le apagaba el énfasis
// a un texto que lo tenía puesto a propósito.
const _TODO_MAYUS = (s) => s === s.toUpperCase() && /[A-ZÁÉÍÓÚÑ]/.test(s);
const _conMayus = (m, rep) => (_TODO_MAYUS(m) ? rep.toUpperCase()
  : m[0] === m[0].toUpperCase() && /[a-záéíóú]/i.test(m[0]) ? rep.charAt(0).toUpperCase() + rep.slice(1) : rep);
// alternancia por longitud descendente: si una raíz es prefijo de otra («dec» de decir · «decid» de decidir), la
// larga tiene que probarse primero para que el motor no se quede con el match corto.
const _alt = (formas) => formas.slice().sort((a, b) => b.length - a.length).join("|");

/* ── (1) PRESENTE en -és / -ís · la tabla ────────────────────────────────────────────────────────────────────
 * REGULARES: el tuteo es la raíz + «es», tanto en -er como en -ir (vender→vendes · subir→subes). RAÍZ QUE
 * CAMBIA: se declara entera, porque quitar la tilde daría una forma que no existe («entendes», «pides» sale de
 * «pedir», no de «ped»+«es»). Los verbos que ya están enumerados más arriba vuelven a aparecer acá sin efecto:
 * la enumeración corre primero y esta red ya no los encuentra — la duplicación cuesta una alternativa de regex y
 * compra que la tabla se lea como lo que es, la CLASE completa. */
const _PRES_REGULARES = [
  "vender", "correr", "recorrer", "prometer", "responder", "aprender", "escoger", "recoger", "proteger", "comprender",
  "emprender", "sorprender", "depender", "exceder", "proceder", "suceder", "ceder", "beber", "comer", "romper",
  "meter", "prender", "vencer", "convencer", "ejercer", "corresponder", "poner", "proponer", "componer",
  "exponer", "suponer", "imponer", "reponer", "disponer", "conceder", "rehacer", "deshacer", "traer", "deber",
  "subir", "abrir", "escribir", "describir", "decidir", "vivir", "partir", "permitir", "admitir", "omitir",
  "emitir", "definir", "dividir", "cumplir", "recibir", "existir", "insistir", "resistir", "asistir", "discutir",
  "cubrir", "añadir", "imprimir", "compartir", "repartir", "salir", "reducir", "producir", "conducir",
  "introducir", "traducir", "exhibir", "prohibir",
];
const _PRES_RAIZ_CAMBIA = [
  ["entender", "entiendes"], ["atender", "atiendes"], ["extender", "extiendes"], ["defender", "defiendes"],
  ["encender", "enciendes"], ["ascender", "asciendes"], ["descender", "desciendes"], ["perder", "pierdes"],
  ["querer", "quieres"], ["poder", "puedes"], ["tener", "tienes"], ["sostener", "sostienes"],
  ["obtener", "obtienes"], ["contener", "contienes"], ["mantener", "mantienes"], ["detener", "detienes"],
  ["retener", "retienes"], ["volver", "vuelves"], ["devolver", "devuelves"], ["envolver", "envuelves"],
  ["resolver", "resuelves"], ["mover", "mueves"], ["promover", "promueves"], ["remover", "remueves"],
  ["soler", "sueles"],
  ["pedir", "pides"], ["medir", "mides"], ["repetir", "repites"], ["servir", "sirves"], ["vestir", "vistes"],
  ["corregir", "corriges"], ["elegir", "eliges"], ["seguir", "sigues"], ["conseguir", "consigues"],
  ["sentir", "sientes"], ["mentir", "mientes"], ["invertir", "inviertes"], ["convertir", "conviertes"],
  ["revertir", "reviertes"], ["advertir", "adviertes"], ["preferir", "prefieres"], ["referir", "refieres"],
  ["sugerir", "sugieres"], ["transferir", "transfieres"], ["decir", "dices"], ["venir", "vienes"],
  ["incluir", "incluyes"], ["construir", "construyes"], ["concluir", "concluyes"],
  ["distribuir", "distribuyes"], ["contribuir", "contribuyes"], ["atribuir", "atribuyes"],
  ["influir", "influyes"], ["sustituir", "sustituyes"], ["dormir", "duermes"], ["adquirir", "adquieres"],
];
const _PRES = new Map();
// LA TILDE ES OBLIGATORIA en la forma voseante, y es lo que hace segura a toda la tabla: sin ella «vendes»,
// «pones», «subes» y «recorres» son TUTEO CORRECTO, y «Paris» —cliente real de este tenant— es un nombre propio.
const _vosPresente = (inf) => inf.slice(0, -2) + (inf.endsWith("er") ? "és" : "ís");
for (const inf of _PRES_REGULARES) _PRES.set(_vosPresente(inf), inf.slice(0, -2) + "es");
for (const [inf, tu] of _PRES_RAIZ_CAMBIA) _PRES.set(_vosPresente(inf), tu);

/* ── (2) PRESENTE en -ás · la red abierta ────────────────────────────────────────────────────────────────────
 * `r$` sobre la raíz saca de un golpe TODO el futuro de tuteo («mejorarás», «podrás», «tendrás») y de paso
 * «detrás»/«atrás». Cuesta los presentes de los verbos en -rar («mejorás», «comparás»), que quedan enumerados
 * arriba: falso negativo antes que falso positivo. La raíz pide 3 letras (como la red de -á: «rotá» tiene tres).
 * «Tomás» y «tomás» (de tomar) son la misma cadena y no hay contexto que las separe con certeza: gana el nombre
 * propio, y la forma verbal queda declarada como no cubierta. */
const _NO_VERBO_AS = /^(?:est|jam|quiz|adem|dem|comp|tom|nicol|mam|pap|sof|anan|barrab)$/i;
// la vocal de llegada hereda la caja de la raíz: «COMPRÁS» → «COMPRAS», no «COMPRAs» (ver `_conMayus`).
const _comoLaRaiz = (raiz, s) => (_TODO_MAYUS(raiz) ? s.toUpperCase() : s);
const _PRESENTE_AS = [
  // sin lookbehind: el borde izquierdo se captura (grupo 1) y se reinyecta tal cual.
  /(^|[^\p{L}])([a-zñáéíóúA-ZÑÁÉÍÓÚ]{3,})ás(?![\p{L}])/gu,
  (m, pre, raiz) => (/r$/i.test(raiz) || _NO_VERBO_AS.test(raiz) ? m : `${pre}${raiz}${_comoLaRaiz(raiz, "as")}`),
];

/* ── (3) ENCLÍTICOS · imperativo voseante + clítico ──────────────────────────────────────────────────────────
 * «avisame» → «avísame». La sílaba tónica NO se mueve: sólo se hace visible, porque la palabra pasa de llana a
 * esdrújula y ahí la tilde es obligatoria. `_tildarPorClitico` la calcula sobre el imperativo de tuteo, así que
 * la tabla declara UNA cosa por verbo (la raíz, y el imperativo sólo si la raíz cambia) y las formas salen solas.
 * Los IRREGULARES no entran acá: su imperativo es monosílabo y con clítico no lleva tilde («ponete»→«ponte»,
 * «hacelo»→«hazlo», «andate»→«vete»), así que van enumerados abajo, uno por uno. */
const _TILDE_DE = { a: "á", e: "é", i: "í", o: "ó", u: "ú" };
const _VOCAL = (c) => "aeiouáéíóú".includes(c);
const _FUERTE = (c) => "aeoáéó".includes(c);
function _tildarPorClitico(imp) {
  if (/[áéíóú]/.test(imp)) return imp;                       // ya viene tildado (repón, mantén): no se toca
  const ch = [...imp];
  let i = ch.length - 1;
  while (i >= 0 && !_VOCAL(ch[i])) i--;                      // consonantes finales
  const fin = i;
  while (i >= 0 && _VOCAL(ch[i])) i--;                       // grupo vocálico de la última sílaba
  const ini = i + 1;
  // dos vocales FUERTES seguidas son hiato, no diptongo («trae» = tra-e): la tónica es la primera del par
  if (fin > ini && _FUERTE(ch[fin]) && _FUERTE(ch[fin - 1])) { ch[fin - 1] = _TILDE_DE[ch[fin - 1]]; return ch.join(""); }
  while (i >= 0 && !_VOCAL(ch[i])) i--;                      // consonantes de la sílaba anterior
  if (i < 0) return imp;                                     // monosílabo («di», «pon», «ve»): sin tilde
  const fin2 = i;
  while (i >= 0 && _VOCAL(ch[i])) i--;
  const ini2 = i + 1;
  // dentro del grupo la tónica es la última vocal FUERTE; si son todas débiles («cuida»), la última
  let t = fin2;
  for (let k = fin2; k >= ini2; k--) if (_FUERTE(ch[k])) { t = k; break; }
  ch[t] = _TILDE_DE[ch[t]] || ch[t];
  return ch.join("");
}
// [raíz, vocal temática, imperativo de tuteo si la raíz cambia]
const _ENCL = [
  ["avis", "a"], ["habl", "a"], ["arm", "a"], ["pas", "a"], ["dej", "a"], ["mand", "a"], ["explic", "a"],
  ["pregunt", "a"], ["qued", "a"], ["mir", "a"], ["acerc", "a"], ["olvid", "a"], ["llam", "a"], ["ayud", "a"],
  ["sum", "a"], ["rest", "a"], ["baj", "a"], ["fij", "a"], ["marc", "a"], ["revis", "a"], ["ajust", "a"],
  ["compar", "a"], ["calcul", "a"], ["guard", "a"], ["agreg", "a"], ["sac", "a"], ["cambi", "a"], ["orden", "a"],
  ["filtr", "a"], ["liquid", "a"], ["rot", "a"], ["prioriz", "a"], ["valid", "a"], ["declar", "a"],
  ["ejecut", "a"], ["confirm", "a"], ["acept", "a"], ["descart", "a"], ["anot", "a"], ["apunt", "a"],
  ["mejor", "a"], ["liber", "a"], ["esper", "a"], ["busc", "a"], ["quit", "a"], ["cuid", "a"], ["llev", "a"],
  ["separ", "a"], ["ahorr", "a"], ["tom", "a"], ["us", "a"],
  ["cont", "a", "cuenta"], ["mostr", "a", "muestra"], ["cerr", "a", "cierra"], ["prob", "a", "prueba"],
  ["pens", "a", "piensa"], ["acord", "a", "acuerda"], ["record", "a", "recuerda"],
  ["encontr", "a", "encuentra"], ["comenz", "a", "comienza"], ["empez", "a", "empieza"],
  ["vend", "e"], ["corr", "e"], ["aprend", "e"], ["escog", "e"], ["recog", "e"], ["tra", "e", "trae"],
  ["entend", "e", "entiende"], ["resolv", "e", "resuelve"], ["mov", "e", "mueve"], ["volv", "e", "vuelve"],
  ["sub", "i"], ["abr", "i"], ["escrib", "i"], ["decid", "i"], ["defin", "i"], ["divid", "i"], ["permit", "i"],
  ["compart", "i"], ["repart", "i"], ["cumpl", "i"], ["recib", "i"], ["imprim", "i"],
  ["ped", "i", "pide"], ["med", "i", "mide"], ["eleg", "i", "elige"], ["segu", "i", "sigue"],
  ["correg", "i", "corrige"], ["repet", "i", "repite"], ["serv", "i", "sirve"], ["inclu", "i", "incluye"],
];
/* LAS EXCLUSIONES DE LA RED DE ENCLÍTICOS · las cinco las encontró el barrido de este pase pasando los 11.255
 * literales de pantalla del camino vigente por el stripper, no una lista imaginada:
 *   · «tomate» ES UNA PALABRA — y en un producto de retail multi-tenant, un SKU perfectamente posible. La regla
 *     acierta («tomate el tiempo» es voseo) pero ningún contexto la separa del producto con certeza.
 *   · «rotate», «validate», «calculate», «separate» son INGLÉS y a la vez identificadores de código. «rotate» se
 *     cazó en vivo dos veces —`transform="rotate(-40 …)"` en el SVG de SentrixPanel y `transform: rotate(360deg)`
 *     en el CSS de ChatADI—: la red las convertía en «rótate». Hoy esos literales no pasan por este stripper, así
 *     que nada estaba roto en pantalla; pero una regla que reescribe una función de CSS es una bomba con la mecha
 *     puesta, y el voseo que perdemos («rotate el stock») no vale ese riesgo. */
const _ENCL_EXCLUIDOS = new Set(["tomate", "tomáte", "rotate", "rotáte", "validate", "validáte",
  "calculate", "calculáte", "separate", "separáte"]);
const _CLITICO = "me|te|le|nos|lo|la";
const _ENCLITICOS = (() => {
  const porVocal = { a: [], e: [], i: [] }, impDe = new Map();
  for (const [raiz, voc, impTuteo] of _ENCL) {
    porVocal[voc].push(raiz);
    impDe.set(`${raiz}|${voc}`, impTuteo || raiz + (voc === "a" ? "a" : "e"));
  }
  const VOC_RE = { a: "[aá]", e: "[eé]", i: "[ií]" };
  return Object.entries(porVocal).map(([voc, raices]) => [
    new RegExp(`\\b(${_alt(raices)})${VOC_RE[voc]}(${_CLITICO})${_FIN}`, "giu"),
    (m, raiz, clit) => {
      if (_ENCL_EXCLUIDOS.has(m.toLowerCase())) return m;
      return _conMayus(m, _tildarPorClitico(impDe.get(`${raiz.toLowerCase()}|${voc}`)) + clit.toLowerCase());
    },
  ]);
})();

const _RED_MORFOLOGICA = [
  // (a) los que la red de -ás no puede acertar y por eso van ENUMERADOS y ANTES de ella: raíz que cambia
  // («recomendás»→«recomiendas», no «recomendas») o raíz terminada en «r», que el corte del futuro se lleva.
  _v("recomend[aá]s", "recomiendas"), _v("compar[aá]s", "comparas"), _v("mejor[aá]s", "mejoras"),
  _v("gener[aá]s", "generas"), _v("oper[aá]s", "operas"), _v("super[aá]s", "superas"),
  _v("valor[aá]s", "valoras"), _v("incorpor[aá]s", "incorporas"), _v("ahorr[aá]s", "ahorras"),
  _v("borr[aá]s", "borras"), _v("alter[aá]s", "alteras"),
  // los verbos en -rar del dominio: la raíz termina en «r», así que el corte del futuro se los lleva a todos.
  _v("nombr[aá]s", "nombras"), _v("filtr[aá]s", "filtras"), _v("entr[aá]s", "entras"), _v("cobr[aá]s", "cobras"),
  _v("logr[aá]s", "logras"), _v("integr[aá]s", "integras"), _v("concentr[aá]s", "concentras"),
  _v("registr[aá]s", "registras"), _v("administr[aá]s", "administras"), _v("celebr[aá]s", "celebras"),
  _v("ilustr[aá]s", "ilustras"), _v("demostr[aá]s", "demuestras"), _v("demostrá", "demuestra"),
  _v("nombrá", "nombra"), _v("entrá", "entra"), _v("cobrá", "cobra"), _v("lográ", "logra"),
  _v("integrá", "integra"), _v("concentrá", "concentra"), _v("registrá", "registra"),
  // (b) los imperativos en -á que la red de -á tampoco alcanza, por la misma razón (raíz en «r», o menos de 3
  // letras: «usá»). Medidos como no cubiertos en el barrido de este pase.
  _v("mejorá", "mejora"), _v("esperá", "espera"), _v("liberá", "libera"), _v("pará", "para"),
  _v("usá", "usa"), _v("mostrá", "muestra"), _v("generá", "genera"), _v("operá", "opera"),
  _v("superá", "supera"), _v("valorá", "valora"), _v("incorporá", "incorpora"), _v("ahorrá", "ahorra"),
  _v("borrá", "borra"),
  // (c) enclíticos de imperativo IRREGULAR: monosílabo + clítico, sin tilde («ponte», «hazlo», «dime»).
  _v("dec[ií]melo", "dímelo"), _v("dec[ií]nos", "dinos"), _v("dec[ií]lo", "dilo"),
  _v("pon[eé]te", "ponte"), _v("pon[eé]lo", "ponlo"), _v("pon[eé]la", "ponla"), _v("pon[eé]me", "ponme"),
  _v("pon[eé]le", "ponle"), _v("hac[eé]lo", "hazlo"), _v("hac[eé]la", "hazla"), _v("hac[eé]me", "hazme"),
  _v("hac[eé]te", "hazte"), _v("ten[eé]lo", "tenlo"), _v("ten[eé]la", "tenla"), _v("and[aá]te", "vete"),
  // (d) las tres redes
  ..._ENCLITICOS,
  _PRESENTE_AS,
  [new RegExp(`\\b(?:${_alt([..._PRES.keys()])})${_FIN}`, "giu"), (m) => _conMayus(m, _PRES.get(m.toLowerCase()))],
];

const _VOSEO = [
  // presente de indicativo, 2ª persona voseante — ninguna de estas formas es ambigua
  _v("quer[eé]s", "quieres"), _v("pod[eé]s", "puedes"), _v("ten[eé]s", "tienes"),
  _v("sab[eé]s", "sabes"), _v("hac[eé]s", "haces"), _v("dec[ií]s", "dices"),
  _v("ven[ií]s", "vienes"), _v("prefer[ií]s", "prefieres"), _v("eleg[ií]s", "eliges"),
  _v("segu[ií]s", "sigues"), _v("vend[eé]s", "vendes"), _v("deb[eé]s", "debes"),
  _v("sos", "eres"),
  // LAS QUE FALTABAN, medidas (owner 2026-08-14, barrido de la clase completa): cada una salió a pantalla por un
  // literal del camino vigente que este stripper NO habría lavado si lo hubiera escrito el narrador. Se agregan acá
  // —y no solo en el literal— porque el detector del gate y este stripper tienen que cubrir el MISMO conjunto: una
  // forma que el gate sabe nombrar y el runtime no sabe lavar es un hueco que se abre en cuanto el LLM la redacta.
  // LA TILDE ES OBLIGATORIA en casi todas: sin ella «retenes» (plural de retén), «marcas», «entregas», «concedes»,
  // «repones», «liberas» y «quedas» son palabras legítimas —sustantivo o tuteo correcto— y reescribirlas rompería
  // prosa buena. Sólo «referís» y «corregís» la llevan opcional: sin tilde no son nada en español.
  _v("refer[ií]s", "refieres"), _v("correg[ií]s", "corriges"), _v("emit[ií]s", "emites"),
  _v("retenés", "retienes"), _v("concedés", "concedes"), _v("reponés", "repones"),
  _v("quedás", "quedas"), _v("recuperás", "recuperas"), _v("liberás", "liberas"),
  _v("entregás", "entregas"), _v("priorizás", "priorizas"), _v("declarás", "declaras"),
  _v("marcás", "marcas"), _v("ejecutás", "ejecutas"), _v("confirmás", "confirmas"),
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
  // LOS DIPTONGANTES QUE FALTABAN, presente E imperativo (owner 2026-08-14, red morfológica). Tienen que estar
  // ACÁ —antes de las dos redes abiertas de abajo— porque en estos verbos la regla general miente: la red saca la
  // tilde y «acordá» daría «acorda», que no existe (el tuteo es «acuerda»). No reescriben prosa correcta, pero
  // dejan una no-palabra en pantalla, que es la otra forma de romper el registro. Se enumeran los del dominio.
  // LOS VERBOS EN -uar, misma razón y otro mecanismo: su tuteo lleva TILDE («evaluá»→«evalúa», no «evalua»;
  // «continuá»→«continúa»). La red saca la tilde y deja una forma que no existe. Cazado midiendo el literal
  // «después frená compras o evaluá salida» (mesaCapital.js), que la red convertía en «evalua».
  _v("evalu[aá]s", "evalúas"), _v("evaluá", "evalúa"), _v("continu[aá]s", "continúas"), _v("continuá", "continúa"),
  _v("actu[aá]s", "actúas"), _v("actuá", "actúa"), _v("situ[aá]s", "sitúas"), _v("situá", "sitúa"),
  _v("gradu[aá]s", "gradúas"), _v("graduá", "gradúa"), _v("acentu[aá]s", "acentúas"), _v("acentuá", "acentúa"),
  _v("acord[aá]s", "acuerdas"), _v("acordá", "acuerda"), _v("forz[aá]s", "fuerzas"), _v("forzá", "fuerza"),
  _v("reforz[aá]s", "refuerzas"), _v("reforzá", "refuerza"), _v("neg[aá]s", "niegas"), _v("negá", "niega"),
  _v("despert[aá]s", "despiertas"), _v("despertá", "despierta"), _v("sent[aá]s", "sientas"),
  _v("colg[aá]s", "cuelgas"), _v("colgá", "cuelga"), _v("cost[aá]s", "cuestas"),
  // «apretar» está VETADA del registro (CLAUDE.md §4) y `_LEAKS` ya la manda a «ajustar»: sus formas voseantes
  // llegan acá con el veto puesto, así que la réplica es la del registro, no el tuteo de «apretar».
  _v("apret[aá]s", "ajustas"), _v("apretá", "ajusta"),
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
  // `_comoLaRaiz` (owner 2026-08-14): el motor usa versales para enfatizar una orden («CONTESTÁ la decisión»), y
  // sin esto la réplica salía «CONTESTa» — mayúscula rota en el mismo texto que venía a arreglar.
  [/(?<![\p{L}])(?!(?:est|ac|all|quiz|ojal|sof|mam|pap|caf|dem|ah|panam|bogot|canad|paran)á(?![\p{L}]))([a-zñáéíóúA-ZÑÁÉÍÓÚ]{3,})á(?![\p{L}])/giu,
    (m, raiz) => (/r$/i.test(raiz) ? m : `${raiz}${_comoLaRaiz(raiz, "a")}`)],

  /* ── LOS OTROS DOS IMPERATIVOS VOSEANTES · -é y -í (owner 2026-08-11, punto 7) ────────────────────────────────
   * «Reponé primero Electrodomésticos» y «Primero corregí las condiciones» salieron al usuario en la
   * certificación. La red de -á no los cubría, y ACÁ NO SE PUEDE GENERALIZAR como se generalizó allá:
   *   · -é es el imperativo voseante de los verbos en -er (reponer→reponé) Y el pretérito de primera persona de
   *     los verbos en -ar («compré el dato», «hablé con el cliente»). La terminación sola no distingue.
   *   · -í es el imperativo voseante de los -ir (subí, escribí) Y el pretérito de primera de -er/-ir. «corregí»
   *     es LAS DOS COSAS: «corregí las condiciones» (orden) y «corregí el dato ayer» (lo que hice).
   * POR ESO ACÁ SE ENUMERA Y SE PIDE CONTEXTO, en vez de una regla morfológica:
   *   (a) lista cerrada de los verbos del dominio, no `\w+` abierto;
   *   (b) el imperativo ABRE la oración (o va tras un conector de orden: «primero», «después», «luego»);
   *   (c) la oración no puede traer marca de pasado ni sujeto de primera persona.
   * Ante la duda NO se toca: dejar pasar un voseo cuesta una palabra; reescribir «corregí el dato ayer» cambia
   * lo que la frase dice. */
  // LOS PARES SE ESCRIBEN ENTEROS, no se derivan quitando la tilde: «corregí» viene de correg-ir y su tuteo es
  // «corrige» (la raíz cambia e→i), así que `correg`+`e` daría «correge», que no existe. La primera versión de
  // esta red derivaba la forma y por eso no enganchaba ninguno de los verbos que venía a cubrir.
  ..._voseoConContexto([
    ["reponé", "repón"], ["vendé", "vende"], ["resolvé", "resuelve"], ["movés", "mueves"], ["atendé", "atiende"],
    ["corré", "corre"], ["aprendé", "aprende"], ["entendé", "entiende"], ["escogé", "escoge"], ["recorré", "recorre"],
    ["corregí", "corrige"], ["subí", "sube"], ["escribí", "escribe"], ["decidí", "decide"], ["abrí", "abre"],
    ["elegí", "elige"],
    ["medí", "mide"], ["repartí", "reparte"], ["incluí", "incluye"], ["definí", "define"], ["permití", "permite"],
    ["revertí", "revierte"], ["convertí", "convierte"], ["dividí", "divide"], ["seguí", "sigue"], ["pedí", "pide"],
    // LOS -é QUE FALTABAN (owner 2026-08-14, red morfológica): «mantené» salió medida como no cubierta. Se suman
    // sólo los de verbos en -er, y ahí la ambigüedad que gobierna esta red casi no aplica — el pretérito de
    // primera en -é es de verbos en -ar, así que «mantené»/«devolvé»/«sostené» no compiten con ningún pasado.
    // Los -í nuevos NO se suman: ésos sí colisionan de frente («recibí el informe», «conseguí el dato»), y sin
    // haberlos medido en pantalla el riesgo no se paga solo.
    ["mantené", "mantén"], ["devolvé", "devuelve"], ["extendé", "extiende"], ["prometé", "promete"],
    ["respondé", "responde"], ["sostené", "sostén"], ["obtené", "obtén"], ["retené", "retén"],
    ["proponé", "propón"], ["concedé", "concede"], ["comprendé", "comprende"], ["recogé", "recoge"],
    // «protegé» lo encontró el barrido de literales de este pase, vivo en DOS textos de pantalla que ningún gate
    // caza («Protegé estas condiciones y usala de referencia», SentrixPanel · «Primero protegé los SKU de alta
    // salida», mesaCapital). Sin ambigüedad de pasado: el pretérito de «proteger» es «protegí», no «protegé».
    ["protegé", "protege"],
  ]),
  // ── LA RED MORFOLÓGICA VA ÚLTIMA, y por eso es segura (mismo criterio que la red de -á de más arriba): todo lo
  // irregular y todo lo de raíz cambiante ya se sustituyó, así que acá sólo llegan las formas donde la regla
  // general ES la forma correcta. Ver el bloque de arriba para las tres redes y sus exclusiones.
  ..._RED_MORFOLOGICA,
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
      // TODO-MAYÚSCULAS antes que mayúscula-inicial (owner 2026-08-14): el motor usa versales para enfatizar
      // («COMPRÁS», «CONTESTÁ», «DECLARALO») y este camino devolvía «Compras» — le apagaba el énfasis a un texto
      // que lo tenía puesto a propósito. Vale para TODAS las reglas de réplica-string, no sólo las nuevas.
      return _conMayus(m, rep);
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

/* ── EL DETECTOR DE VOSEO · UNA SOLA LISTA, PORQUE HABÍA TRES (owner 2026-08-14) ═══════════════════════════════
 * EL HALLAZGO QUE LO PIDE. La captura del owner —«…¿Sobre qué cliente, SKU, marca o familia querés simular este
 * escenario?»— salió a pantalla con DOS gates de registro en verde que YA miraban voseo: `_registro_gate` desde la
 * certificación live y `_registro_boleta_gate` desde la Poda 2B. No fallaron por no mirar: fallaron porque cada uno
 * llevaba SU PROPIA lista enumerada, y las dos estaban incompletas y desalineadas entre sí y con el `_VOSEO` de
 * arriba. Tres listas de la misma cosa son tres oportunidades de que una quede corta — y «referís», «liberás»,
 * «entregás», «recuperás», «quedás», «retenés» y «concedés» no estaban en ninguna de las tres.
 *
 * POR QUÉ VIVE ACÁ Y NO EN UN GATE. `voiceGuard` ya es la autoridad de voseo del repo: acá está el stripper que lo
 * neutraliza en runtime. Que el DETECTOR (lo que el gate sabe nombrar) y el CORRECTOR (lo que el runtime sabe
 * lavar) salgan del mismo archivo permite atarlos con una invariante verificable —«toda forma que el detector
 * conoce, el stripper la neutraliza»—, que el gate comprueba forma por forma. Una que el gate caza pero el runtime
 * no lava es un hueco que se abre en cuanto el narrador la redacta libre en vez de venir de un literal.
 *
 * DOS NIVELES, y la diferencia es la ambigüedad del español, no la severidad:
 *   · NIVEL 1 · INEQUÍVOCO. Formas que no pueden ser otra cosa. LA TILDE ES OBLIGATORIA salvo donde la forma pelada
 *     no existe en español («querés», «referís»): sin ese cuidado el detector marcaría «marcas», «entregas»,
 *     «retenes» o «necesitas», que son prosa correcta — y un gate con falsos positivos se termina desactivando.
 *   · NIVEL 2 · IMPERATIVO EN -í, SÓLO EN POSICIÓN DE ORDEN. «pedí», «elegí», «seguí», «abrí» son a la vez orden
 *     voseante y pretérito de primera persona («yo pedí el dato»). La terminación sola no distingue, así que se
 *     exige el complemento inmediatamente después Y ningún clítico ni sujeto de primera delante. Con eso «abrí la
 *     Mesa de control» (orden, salió a pantalla) se caza y «me dejaste sin la tabla que te pedí» no.
 *
 * SIN LOOKBEHIND, como el resto de este archivo (Safari viejo de invitados mobile): la condición «qué hay delante»
 * se resuelve en JS mirando el texto previo, no con `(?<!…)`. La apertura usa `\b` y no `(?<![\p{L}])` porque todas
 * las formas EMPIEZAN con letra ASCII — la trampa del borde ASCII es sólo al CERRAR, tras vocal acentuada, y ahí sí
 * va el lookahead Unicode.
 * Ante la duda NO se marca: falso negativo antes que falso positivo, la doctrina de esta casa. */
export const VOSEO_FORMAS = [
  // presente de indicativo · -ás (tilde OBLIGATORIA: la forma sin tilde es tuteo correcto o un sustantivo)
  "andás", "necesitás", "buscás", "usás", "dejás", "encontrás", "mostrás", "pensás", "llevás", "ganás", "esperás",
  "declarás", "marcás", "ejecutás", "confirmás", "recordás", "liberás", "entregás", "quedás", "recuperás",
  "priorizás", "manejás", "trabajás", "comprás", "pagás", "hablás", "tratás", "mirás", "armás", "sumás", "bajás",
  "ajustás", "revisás", "considerás", "mandás", "liquidás", "rotás", "cerrás", "comenzás", "empezás", "probás",
  "contás", "apoyás", "aconsejás", "adulás", "dramatizás", "interpretás", "inventás", "nombrás", "redactás",
  "relacionás", "heredás", "citás", "completás", "cruzás", "calculás", "acabás", "llegás", "terminás",
  "reaccionás", "recomendás", "agregás", "sacás", "cambiás", "fijás", "ordenás", "filtrás", "seleccionás",
  "comparás", "guardás", "arrancás", "tocás", "pasás", "editás", "aumentás", "conservás", "avisás", "explicás",
  "descartás", "olvidás", "aceptás", "llamás", "ayudás",
  // presente de indicativo · -és / -ís · tilde OPCIONAL sólo donde la forma pelada no es palabra («queres», «referis»)
  "quer[eé]s", "pod[eé]s", "ten[eé]s", "dec[ií]s", "ven[ií]s", "prefer[ií]s", "refer[ií]s", "eleg[ií]s",
  "segu[ií]s", "perd[eé]s", "correg[ií]s", "emit[ií]s", "volv[eé]s", "resolv[eé]s", "entend[eé]s", "atend[eé]s",
  // TRES FALSOS POSITIVOS CORREGIDOS (owner 2026-08-14, red morfológica): «aprendes», «escoges» y «recorres»
  // SIN tilde no son voseo — son tuteo perfectamente correcto, y estaban declarados con la tilde opcional, que
  // esta misma lista reserva para las formas cuya versión pelada no existe en español. Con la tilde opcional el
  // detector marcaba prosa buena («recorres la cartera»), que es la forma en que un gate se termina desactivando.
  // Ninguna de las tres está en las formas medidas en pantalla de `_registro_boleta_gate` [2d]: el detector no
  // pierde cobertura real, sólo deja de marcar lo que nunca fue voseo.
  "aprendés", "escogés", "recorrés", "mov[eé]s", "sal[ií]s", "sub[ií]s", "escrib[ií]s", "decid[ií]s",
  "abr[ií]s", "med[ií]s", "repart[ií]s", "defin[ií]s", "permit[ií]s", "revert[ií]s", "convert[ií]s", "divid[ií]s",
  "ped[ií]s", "sent[ií]s", "viv[ií]s", "repet[ií]s", "reduc[ií]s",
  // tilde OBLIGATORIA: «sabes», «haces», «vendes», «pones», «retenes», «respondes» son tuteo o sustantivo
  "sabés", "hacés", "vendés", "debés", "ponés", "corrés", "retenés", "concedés", "reponés", "prometés",
  "proponés", "rehacés", "respondés", "sostenés", "obtenés", "contenés", "mantenés", "sos",
  // imperativo voseante en -á / -é · SIEMPRE con tilde (sin ella son tercera persona o sustantivo)
  "hacé", "tené", "poné", "andá", "entregá", "mirá", "dejá", "revisá", "considerá", "comenzá", "probá", "pensá",
  "mandá", "empezá", "armá", "tomá", "cerrá", "tocá", "pasá", "editá", "recordá", "agregá", "sacá", "cambiá",
  "fijá", "ordená", "filtrá", "seleccioná", "compará", "calculá", "guardá", "arrancá", "declará", "marcá",
  "ejecutá", "confirmá", "liquidá", "rotá", "validá", "recalculá", "priorizá", "bajá", "sumá", "restá", "buscá",
  "reponé", "vendé", "resolvé", "atendé", "corré", "aprendé", "entendé", "escogé", "recorré", "mejorá", "aumentá",
  "mantené", "conservá", "avisá", "explicá", "contá", "mostrá", "descartá", "replanteá", "renegociá", "profundizá",
  "anotá", "apuntá", "olvidá", "aceptá", "esperá", "llamá", "usá", "ayudá", "liberá", "quitá", "pará",
  // enclíticos · la forma en que el voseo se cuela con más frecuencia en una oferta de seguimiento. El tuteo carga
  // la tilde en OTRA sílaba («dime», «cuéntame», «muéstrame», «avísame», «fíjate», «pásame», «tráeme»), así que
  // estas formas no colisionan con él: se acepta la tilde final o ninguna, jamás la esdrújula.
  "dec[ií]me", "dec[ií]melo", "cont[aá]me", "mostr[aá]me", "avis[aá]me", "explic[aá]me", "habl[aá]me",
  "arm[aá]me", "pas[aá]me", "dej[aá]me", "mand[aá]me", "tra[eé]me", "dec[ií]le", "ped[ií]le", "fij[aá]te",
  "pregunt[aá]le", "cont[aá]le", "avis[aá]le", "explic[aá]le", "mand[aá]le", "mostr[aá]le",
  // «tom[aá]te» SALE de la lista, y es la misma clase de decisión: «tomate» es una palabra —y en un producto de
  // retail multi-tenant, un SKU perfectamente posible—. La forma voseante existe («tomate el tiempo»), pero
  // ningún contexto la separa del producto con certeza, así que gana el sustantivo. Queda declarada como forma
  // NO cubierta, ni por el detector ni por el stripper (ver `_ENCL_EXCLUIDOS` arriba): la única de la clase.
  "acord[aá]te", "qued[aá]te", "pon[eé]te", "and[aá]te", "mir[aá]te", "acerc[aá]te", "olvid[aá]te",
  "cont[aá]nos", "dec[ií]nos", "mostr[aá]nos",
];
const _VOSEO_CIERRE = "(?![\\p{L}])";
export const VOSEO_RE = new RegExp(`\\b(?:${VOSEO_FORMAS.join("|")})${_VOSEO_CIERRE}`, "iu");

/* NIVEL 2 · las dos condiciones son necesarias y ninguna alcanza sola:
 *   · DELANTE no puede haber clítico ni sujeto de primera («te pedí», «yo pedí», «que escribí», «lo elegí»): ahí es
 *     pretérito, y marcarlo mandaría a reescribir una frase que dice lo correcto.
 *   · DETRÁS tiene que venir el complemento de la orden (determinante, pronombre, preposición o interrogativo). Un
 *     «…la tabla que te pedí.» al final de la oración no lo trae, y por eso no se marca. */
const _VOSEO_I = ["eleg", "segu", "ped", "escrib", "correg", "sub", "decid", "abr", "med", "defin", "permit",
  "inclu", "divid", "convert", "revert", "repart", "reduc", "sal", "viv", "sent", "repet", "imprim", "cumpl",
  "compart"];
const _OBJETO = "(?:el|la|los|las|un|una|unos|unas|tu|tus|mi|mis|su|sus|lo|le|les|nos|me|te|se|ese|esa|esos|esas|" +
  "este|esta|estos|estas|nom[aá]s|uno|dos|m[aá]s|menos|ac[aá]|all[aá]|aqu[ií]|con|por|para|en|de|desde|hasta|" +
  "entre|sobre|cu[aá]l|cu[aá]les|qu[eé]|c[oó]mo|d[oó]nde|cuando|ahora|primero|siempre|tambi[eé]n)";
const _VOSEO_I_RE = new RegExp(`\\b(?:${_VOSEO_I.join("|")})í${_VOSEO_CIERRE}\\s+${_OBJETO}${_VOSEO_CIERRE}`, "giu");
const _ANTES_ES_PASADO = /\b(?:yo|ya|te|me|le|les|nos|se|lo|la|los|las|que|y|no|cuando|nunca)\s+$/i;
/* LA MARCA DE PASADO TAMBIÉN VA DETRÁS (owner 2026-08-14, medido armando la red morfológica): mirar sólo hacia
 * atrás dejaba pasar «Corregí el dato ayer con la boleta nueva» — abre la oración, trae complemento, y ningún
 * clítico delante, así que el Nivel 2 la marcaba como orden. Es pretérito, y el «ayer» que lo dice está DESPUÉS.
 * El stripper ya miraba las dos direcciones (`_NO_ES_PASADO`, arriba): esto pone al detector en el mismo criterio,
 * que es la convergencia que este archivo declara desde su cabecera. */
const _DESPUES_ES_PASADO = /^[^.!?\n]*\b(?:ayer|anoche|anteayer|pasad[oa]|hace\s+\w+)\b/i;

/* detectVoseo(texto) → la forma encontrada (string) o null. Es la ÚNICA puerta que consumen los gates de registro,
 * para que sumar una forma no exija acordarse de tocar dos archivos — que es exactamente cómo se abrió este hueco. */
export function detectVoseo(text) {
  if (typeof text !== "string" || !text) return null;
  const m1 = text.match(VOSEO_RE);
  if (m1) return m1[0];
  _VOSEO_I_RE.lastIndex = 0;
  let m2;
  while ((m2 = _VOSEO_I_RE.exec(text)) !== null) {
    if (!_ANTES_ES_PASADO.test(text.slice(0, m2.index)) && !_DESPUES_ES_PASADO.test(text.slice(m2.index))) return m2[0];
  }
  return null;
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
