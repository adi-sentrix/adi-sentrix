/* === _definicion_alcance_restringido_gate.mjs · EL ALCANCE ACOTA LOS TURNOS DE DATO, NO LOS DE DEFINICIÓN =======
 * LOCAL, NO commiteado (convención del repo: _*_gate.mjs es local). CERO red, CERO LLM: callPlan/callNarrate van
 * MOCKEADOS y el BATCH corre REAL (defineConcept resuelve contra el glosario curado de verdad).
 *
 * EL DEFECTO QUE PROTEGE (medido en la certificación en vivo, E10): tras usar "contribución no capturada" cuatro
 * veces, ante "No entendí lo de contribución no capturada" ADI contestó «No tengo información autorizada
 * suficiente para responder eso con el alcance pedido» — MIENTRAS tenía la definición resuelta y sellada en la
 * mano (`coverage.supported: true`). El plan era correcto y la tool respondía; lo que fallaba era la rama de
 * garantía por construcción de data_only/results_only: su ÚNICO compositor sabía imprimir BOLETA, y la evidencia
 * de una definición es TEXTO. Boleta vacía → composeFromLedger null → mensaje de ausencia. El motor declaraba una
 * ausencia que no era cierta.
 *
 * LA REGLA QUE ESTE GATE AFIRMA: el alcance restringido acota los turnos que responden un DATO. Una definición no
 * es un turno de dato —no tiene universo, no tiene período, no hay nada que interpretar de más— así que se dice
 * VERBATIM desde el glosario. La garantía de "cero superficie lingüística" queda intacta: el narrador libre sigue
 * sin invocarse en ninguno de los dos alcances.
 *
 * GENERALIDAD (el caso medido era el término "contribución no capturada" bajo data_only, entrando por la frase
 * "sin rodeos"): acá se ejercitan CUATRO conceptos distintos, CUATRO redacciones distintas de la pregunta, las
 * DOS formas de llegar al alcance restringido (preferencia del turno y preferencia de sesión) y los DOS alcances.
 * No hay una sola comparación contra el texto de la pregunta medida.
 *
 * MUTACIÓN QUE LO PONE EN ROJO: sacar `composeFromTextualEvidence` de la cadena de la rama restringida en
 * answerViaOracle.js (volver a `desdeLedger || composeNoDataMessage(results)`). Las secciones 2 y 3 caen enteras.
 * Y revertir la persistencia por eje de `_coercePref` pone en rojo la sección 5.
 * LA SECCIÓN 6 TIENE SU PROPIA MUTACIÓN, Y ES LA INVERSA: volver a ampliar `_PREF_RESET_RE` a
 * `(?:volv[eé]|vuelv[ae]|volver|volvamos)\s+al?\s+…normal` — la ampliación que se revirtió el 2026-08-11 — pone en
 * rojo las 10 afirmaciones de las preguntas de negocio. Ese es exactamente el punto: la sección 5 prueba las
 * frases que SÍ deben resetear y la 6 las que NO, y ninguna reapertura de esa regex puede pasar las dos.
 *
 * @inyeccion-simulada — este gate le pasa a `answerViaOracle` sus DOS pasadas (PLAN y NARRAR) como funciones
 * locales definidas en este mismo archivo. No importa el gateway ni un adapter, no importa nada de `src/ui/`
 * (donde viven las únicas implementaciones reales de esas dos funciones) y no contiene una salida cruda. Cumple
 * las cuatro condiciones del escape declarado en scripts/gates-offline.mjs, que las verifica una por una en vez
 * de creerle a esta línea. Sin esto el gate quedaba clasificado LIVE y NUNCA corría: una garantía que hay que
 * acordarse de invocar a mano no es una garantía.
 */
import { answerViaOracle } from "./src/adi/oracle/answerViaOracle.js";
import { composeFromTextualEvidence, composeNoDataMessage } from "./src/adi/oracle/narrationBlocks.js";
import { resolveGlossary } from "./src/adi/sentrix/glossary.js";

let pass = 0, fail = 0;
const ok = (cond, label, detail) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label}${detail ? ` — obtuvo ${detail}` : ""}`); }
};
const seccion = (t) => console.log(`\n── ${t} ──`);
const AUSENCIA_RE = /No tengo información autorizada suficiente/i;

// corre un turno contando si el narrador libre llegó a invocarse (la garantía por construcción de esta rama).
async function turno({ text, mem = {}, plan, narracion = "[[DATOS]]\nprosa libre que NUNCA debería llegar al usuario en un alcance restringido" }) {
  let narrado = 0;
  const r = await answerViaOracle({
    text, history: [], mem, scenario: "actual",
    callPlan: async () => plan,
    callNarrate: async () => { narrado++; return narracion; },
  });
  return { r, narrado, texto: (r && r.r && r.r.text) || "(abstención)" };
}
const planDefine = (concepto, pref) => ({ intent: "define", mode: "clarify", calls: [{ tool: "defineConcept", args: { concept: concepto } }], ...(pref ? { pref } : {}) });

// ════════════════════════════════════════════════════════════════════════════════════════════════════════════
seccion("1 · el compositor, aislado (narrationBlocks.js) — el límite es TAN importante como la apertura");
{
  const definicion = { tool: "defineConcept", facts: { concepto: "rotación", definicion: "Es cuántas veces el stock se vende y se repone.", es_definicion: true }, boleta: [], coverage: { supported: true } };
  const salida = composeFromTextualEvidence([definicion]);
  ok(!!salida && salida.includes("Es cuántas veces el stock se vende y se repone."), "compone VERBATIM la definición sellada por la tool", JSON.stringify(salida));
  ok(!!salida && /^Rotación:/.test(salida), "encabeza con el concepto que el usuario preguntó", JSON.stringify(salida));

  // los tres límites, uno por uno: sin ellos la rama se sobre-abre y vuelve el escape que el 3er residual cerró.
  ok(composeFromTextualEvidence([{ ...definicion, coverage: { supported: false, reason: "x" } }]) === null, "una tool que DECLINÓ no compone nada (la evidencia tiene que estar autorizada)");
  ok(composeFromTextualEvidence([{ ...definicion, boleta: [{ label: "Falabella · Venta", value: "$1M" }] }]) === null, "si el turno aportó CIFRAS no es un turno de definición (el dato manda)");
  ok(composeFromTextualEvidence([{ tool: "marginRead", facts: { margen: 0.21 }, boleta: [], coverage: { supported: true } }]) === null, "un result autorizado SIN texto de definición tampoco compone — sigue siendo el mensaje honesto");
  ok(composeFromTextualEvidence([]) === null && composeFromTextualEvidence(null) === null, "sin results, null (nunca crashea, nunca inventa)");
  ok(AUSENCIA_RE.test(composeNoDataMessage([])), "composeNoDataMessage sigue siendo la última red honesta, intacta");
}

// ════════════════════════════════════════════════════════════════════════════════════════════════════════════
seccion("2 · CUATRO conceptos · CUATRO redacciones · los DOS alcances restringidos (preferencia del TURNO)");
{
  const CASOS = [
    ["¿Qué es la rotación? Solo el dato.", "rotación", "data_only"],
    ["No entiendo qué son las acciones comerciales, sin explicación.", "acciones comerciales", "data_only"],
    ["Explicame en simple qué es el benchmark, dame únicamente eso.", "benchmark", "data_only"],
    ["¿Qué quiere decir capital inmovilizado?", "capital inmovilizado", "results_only"],
  ];
  for (const [texto, concepto, alcance] of CASOS) {
    const d = resolveGlossary(concepto);
    const { r, narrado, texto: salida } = await turno({ text: texto, plan: planDefine(concepto, { contentScope: alcance }) });
    ok(!!d, `precondición: el glosario conoce "${concepto}"`);
    ok(!!r, `[${alcance}] "${concepto}": el turno responde (nunca se abstiene)`);
    ok(!AUSENCIA_RE.test(salida), `[${alcance}] "${concepto}": NUNCA declara ausencia teniendo la definición sellada`, JSON.stringify(salida.slice(0, 80)));
    ok(!!d && salida.includes(String(d.def).slice(0, 60)), `[${alcance}] "${concepto}": dice la definición del glosario, verbatim`, JSON.stringify(salida.slice(0, 80)));
    ok(narrado === 0, `[${alcance}] "${concepto}": el narrador libre NUNCA se invoca — la garantía por construcción sigue entera`);
  }
}

// ════════════════════════════════════════════════════════════════════════════════════════════════════════════
seccion("3 · la OTRA puerta al alcance restringido: la preferencia de SESIÓN, fijada de forma legítima");
{
  const t1 = await turno({ text: "Desde ahora dame solo los datos, sin interpretación.", plan: { intent: "answer", mode: "diagnostico", calls: [{ tool: "diagnose", args: {} }] } });
  ok(t1.r && t1.r.mem.responsePref && t1.r.mem.responsePref.contentScope === "data_only", "un pedido explícito y persistente SÍ deja data_only en la sesión (eso es correcto, no es el defecto)", JSON.stringify(t1.r && t1.r.mem.responsePref));

  const t2 = await turno({ text: "¿Y qué significa exactamente la carga comercial?", mem: t1.r.mem, plan: planDefine("carga comercial") });
  const d = resolveGlossary("carga comercial");
  ok(!AUSENCIA_RE.test(t2.texto) && t2.texto.includes(String(d.def).slice(0, 60)), "con el alcance heredado de la SESIÓN, la definición se responde igual", JSON.stringify(t2.texto.slice(0, 80)));
  ok(t2.narrado === 0, "y sigue sin invocarse el narrador libre");
}

// ════════════════════════════════════════════════════════════════════════════════════════════════════════════
seccion("4 · CONTROLES — la apertura no se come ni el turno de dato ni el 'no' honesto");
{
  // (a) un turno de DATO bajo data_only sigue respondiendo con la CIFRA. El caso decisivo es el mixto: el plan
  // trae la tool de dato Y defineConcept a la vez — si la apertura estuviera mal ordenada, la definición (texto)
  // le ganaría al dato (cifras) y el usuario recibiría una explicación donde pidió un número.
  const dato = await turno({ text: "Dame el margen de los clientes bajo benchmark. Solo el dato.", plan: { intent: "answer", mode: "default", scope: { level: "global" }, calls: [{ tool: "marginRead", args: { dimension: "cliente", focus: "bajo_benchmark" } }, { tool: "defineConcept", args: { concept: "margen" } }], pref: { contentScope: "data_only" } } });
  // LA PRUEBA DE QUE MANDA LA BOLETA ES QUE SALE UNA CIFRA, no que salga una tabla (revisión 2026-08-12). El proxy
  // era el encabezado `| Concepto | Valor |`, y servía mientras `data_only` tabulaba siempre; desde que su forma es
  // una oración breve por decisión del owner, ese encabezado mide la FORMA y ya no el orden de apertura. Lo que el
  // caso mixto defiende —que el dato le gane a la definición— se afirma directo: hay cifra, y (la línea siguiente)
  // no hay texto de definición.
  ok(/\$[\d.,]+|\d+[.,]\d+\s*(?:%|pts)|\d+%/.test(dato.texto), "(a) con cifras Y definición en el mismo turno, manda la BOLETA — la definición nunca le roba el turno al dato", JSON.stringify(dato.texto.slice(0, 60)));
  ok(!/Es lo que queda de la venta después/.test(dato.texto), "(a) y el texto de la definición no se cuela junto a la tabla");
  ok(dato.narrado === 0, "(a) y tampoco ahí se invoca al narrador libre");

  // (b) un término que el glosario NO conoce sigue declinando, y con la razón REAL (nunca la genérica).
  const raro = await turno({ text: "¿Qué es el índice de simpatía trimestral? Solo el dato.", plan: planDefine("índice de simpatía trimestral", { contentScope: "data_only" }) });
  ok(AUSENCIA_RE.test(raro.texto) && /no tengo una definición curada/i.test(raro.texto), "(b) sin entrada en el glosario, sigue el 'no' honesto CITANDO la razón real", JSON.stringify(raro.texto.slice(0, 110)));
  ok(raro.narrado === 0, "(b) y el honesto tampoco pasa por el narrador");
}

// ════════════════════════════════════════════════════════════════════════════════════════════════════════════
seccion("5 · LA TRAMPA QUE HACÍA ALCANZABLE EL DEFECTO — una corrección de REGISTRO no congela el ALCANCE");
{
  // "hablame directo / sin rodeos" es una corrección de REGISTRO: autoriza persistir detailLevel y NADA más. Antes
  // arrastraba a la sesión el contentScope que el planificador había inferido para ESE turno, y el usuario quedaba
  // encerrado en "solo el dato" sin haberlo pedido jamás.
  const reg = await turno({ text: "Hablame directo y sin rodeos.", plan: { intent: "answer", mode: "diagnostico", calls: [{ tool: "diagnose", args: {} }], pref: { contentScope: "data_only" } } });
  const pref = reg.r && reg.r.mem.responsePref;
  ok(!!pref && pref.detailLevel === "brief", "una frase de REGISTRO sí persiste el registro (detailLevel=brief)", JSON.stringify(pref));
  ok(!!pref && pref.contentScope !== "data_only", "…y NO arrastra a la sesión el alcance del contenido de ese turno", JSON.stringify(pref));

  // el turno siguiente, ya sin la trampa, llega al narrador como cualquier turno normal.
  const sig = await turno({ text: "No entendí lo de contribución no capturada.", mem: reg.r.mem, plan: planDefine("contribución no capturada"), narracion: "Es la brecha entre lo que una cuenta aporta y lo que aportaría al alcanzar tu referencia." });
  ok(!AUSENCIA_RE.test(sig.texto), "el turno medido en vivo ya no contesta 'no tengo información autorizada'", JSON.stringify(sig.texto.slice(0, 90)));

  // la salida de emergencia canónica sigue enganchando.
  const sesionRestringida = { responsePref: { contentScope: "data_only", detailLevel: "brief" } };
  for (const frase of ["Volvé a lo normal.", "Dame el análisis completo.", "Como antes, por favor."]) {
    const reset = await turno({ text: frase, mem: sesionRestringida, plan: { intent: "answer", mode: "default", calls: [] }, narracion: "Retomo el registro habitual para lo que sigue de la conversación." });
    const p = reset.r && reset.r.mem.responsePref;
    ok(!!p && p.contentScope === "full" && p.detailLevel === "standard", `"${frase}" cancela la preferencia de sesión`, JSON.stringify(p));
  }
}

// ════════════════════════════════════════════════════════════════════════════════════════════════════════════
seccion("6 · LA CARA OPUESTA DEL RESET — una PREGUNTA DE NEGOCIO no es una instrucción de formato");
{
  /* POR QUÉ EXISTE ESTA SECCIÓN (owner 2026-08-11, segunda revisión adversarial). Esta misma sección 5 probaba
   * ANTES «Ahora vuelve al nivel normal.» y «Volvamos al modo normal.» como resets, y para hacerlas pasar se había
   * ampliado `_PREF_RESET_RE` a cualquier conjugación de volver + normal. La ampliación se comió las preguntas de
   * negocio: «¿La demanda vuelve al nivel normal este trimestre?» borraba —en silencio y para siempre— la
   * preferencia que el usuario había pedido dos turnos antes, y soltaba al narrador libre en un turno que estaba
   * bajo garantía por construcción. Medido: 4/4 redacciones corrientes de retail lo disparaban; en la base 2b062cc
   * las 4 eran inocuas. La ampliación se REVIRTIÓ a la base y esta sección es su lápida: fija por gate la mitad que
   * no estaba probada —las preguntas que NO deben resetear—, para que ninguna reapertura futura de esa regex las
   * vuelva a romper sin que un gate lo grite.
   * EL LÍMITE DECLARADO, y es el precio de revertir: «Ahora vuelve al nivel normal.» y «Volvamos al modo normal.»
   * NO cancelan la preferencia. Se afirma acá EN POSITIVO —no se omite— porque un límite que el gate no nombra es
   * un límite que nadie recuerda. Separarlas de la pregunta de negocio exigiría decidir el MODO del verbo por la
   * presencia de un sujeto delante, y eso es inferencia sintáctica, no una regla que falle cerrada: ante ambigüedad
   * entre forma y contenido, este archivo se abstiene. */
  const restringida = () => ({ responsePref: { contentScope: "data_only", detailLevel: "brief" } });
  const NEGOCIO = [
    "¿La demanda vuelve al nivel normal este trimestre?",
    "¿El stock de Samsung vuelve al nivel normal después de la promo?",
    "¿Cuándo vuelve al nivel normal la rotación de Línea Blanca?",
    "¿La venta vuelve al nivel normal en marzo?",
    "¿Volvemos al nivel normal de inventario en abril?",
  ];
  for (const q of NEGOCIO) {
    const r = await turno({ text: q, mem: restringida(), plan: { intent: "answer", mode: "diagnostico", calls: [{ tool: "diagnose", args: {} }] }, narracion: "El período no muestra desvíos que ameriten mover una decisión hoy." });
    const p = r.r && r.r.mem.responsePref;
    ok(!!p && p.contentScope === "data_only", `una PREGUNTA de negocio NO borra la preferencia: «${q}»`, JSON.stringify(p));
    ok(r.narrado === 0, `…y tampoco suelta al narrador libre en ese turno: «${q}»`, `narrado=${r.narrado}`);
  }
  // Y EL LÍMITE, dicho en positivo: estas dos NO resetean, y el gate lo fija para que nadie lo descubra en prod.
  for (const frase of ["Ahora vuelve al nivel normal.", "Volvamos al modo normal."]) {
    const r = await turno({ text: frase, mem: restringida(), plan: { intent: "answer", mode: "default", calls: [] }, narracion: "Retomo el registro habitual para lo que sigue de la conversación." });
    const p = r.r && r.r.mem.responsePref;
    ok(!!p && p.contentScope === "data_only", `LÍMITE DECLARADO: "${frase}" NO cancela la preferencia (el usuario tiene "Volvé a lo normal.")`, JSON.stringify(p));
  }
}

console.log(`\n── _definicion_alcance_restringido_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
