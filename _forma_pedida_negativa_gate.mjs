/* === _forma_pedida_negativa_gate.mjs · EL PEDIDO DE FORMA TAMBIÉN PUEDE DECIR QUE NO (defecto D8) ==============
 * ══ LO PRIMERO, SIN ADORNOS: «EXPLICALO SIN REPETIR LA TABLA» (E3.t3) QUEDA ABIERTO ═══════════════════════════
 * Este gate YA NO certifica que la negación de un sustantivo INEQUÍVOCO de forma («sin la tabla», «nada de
 * tablas», «no me armes ninguna planilla») prohíba tabular. NO LO HACE. El owner retiró
 * `..._negaciones(_TABLA_N_FORMA)` de `_PROHIBE_FORMA` (progressiveDisclosure.js, 2026-08-11) y hoy esos turnos
 * resuelven `required` —si el mismo turno trae un disparador positivo— o `auto` —si no lo trae—. Nunca
 * `forbidden`. «Explicalo sin repetir la tabla: cuál fue el peor mes» recibe una tabla. Es un DEFECTO REAL de la
 * certificación (E3.t3) y está ABIERTO; abajo se mide, end-to-end, hasta el rechazo que le cobra a la prosa
 * obediente. No hay ninguna aserción en este archivo que lo tape.
 *
 * POR QUÉ SE PREFIRIÓ ASÍ, que es la parte que importa: esa lista producía 14 FALSOS POSITIVOS MEDIDOS de la peor
 * clase posible — `tabla-no-autorizada` contra una tabla que el usuario estaba RECLAMANDO porque FALTÓ. «Me quedé
 * sin la tabla mes a mes, ¿la rehacés?», «No llegó ni la tabla, ¿me la mandás?», «No quiero la tabla resumida,
 * quiero la completa»: los tres piden la tabla y los tres se quedaban sin ninguna. Moverla al paso 3 no alcanza y
 * está probado, no supuesto: el paso 2 sólo exonera al turno que ADEMÁS pide la tabla en positivo, y
 * `pidePresentacionTabular` reconoce el pedido en 6 de los 14 — los otros 8 seguirían prohibidos. Ese conteo se
 * verifica acá (bloque 12) en vez de creerse.
 * LA DOCTRINA DE LA CASA, APLICADA CONTRA EL PROPIO FIX: falso negativo antes que falso positivo. Que ADI muestre
 * una tabla de más es un defecto de forma que cuesta un turno; que se niegue a mostrar la que le piden es un turno
 * que el usuario no puede completar.
 *
 * ══ QUÉ CERTIFICA ESTE GATE HOY ══════════════════════════════════════════════════════════════════════════════
 * Cambió de objeto: dejó de custodiar una capacidad y pasa a custodiar QUE EL FALSO POSITIVO NO VUELVA. Tres cosas:
 *   1. LA CARA NUEVA Y PERMANENTE (bloque 12) · los 14 reclamos que NO deben prohibir, afirmados en positivo, con
 *      el detector, la política y guardC. Si alguien reintroduce la lista retirada, los 42 chequeos se ponen rojos.
 *      VERIFICADO POR REVERSIÓN REAL (no mental): se restauró `..._negaciones(_TABLA_N_FORMA)` en una COPIA del
 *      src fuera del repo y se corrió este gate contra ella — los 14 pasan a `forbidden` y el bloque 12 cae entero.
 *   2. EL LÍMITE, ESCRITO COMO PRUEBA (bloques 1, 2, 5, 7, 10c) · cada turno que ANTES se prohibía queda afirmado
 *      en su valor REAL de hoy, con la razón al lado. Ninguno se borró y ninguno se aflojó a «no forbidden»: se
 *      afirma el valor exacto, así que el día que el eje vuelva a moverse —en cualquier dirección— se ve.
 *   3. TODO LO QUE SIGUE VALIENDO, intacto y probado sobre el eje que sí existe:
 *      · EL VERBO NEGADO con modo cerrado («no me tabules», «sin tabular», «no tabular») — es la única familia de
 *        `_PROHIBE_FORMA` que quedó, y sigue GANANDO sobre el disparador positivo co-ocurrente (bloques 1-bis, 7-bis).
 *      · EL GUARD DE POLISEMIA · negar una columna o un cuadro no mata la tabla que el mismo turno pidió (bloque 3),
 *        y sin pedido positivo esos polisémicos siguen prohibiendo (bloques 2, 10c).
 *      · LA POLARIDAD DE PROSA · pedir prosa sigue siendo, por sí solo, prohibir la tabla (bloque 2).
 *      · EL CORTE GRAMATICAL indicativo≠imperativo, que `_negaciones` sigue aplicando sobre los POLISÉMICOS
 *        (bloque 10b-bis): el reclamo no es una orden en el eje que quedó vivo.
 *      · EL RETIRO DE `matriz` (bloque 11), LA REDUCCIÓN DE LARGO vs. REGISTRO (bloque 4), LA CONTINUIDAD DE FORMA
 *        (bloque 5), LA PRECEDENCIA pedido>poda (bloque 6) y LA DOCTRINA DE PLAN (bloque 8).
 *
 * OFFLINE PURO: sólo detectores puros + el contrato de narración + guardC sobre texto fijo. Cero red, cero LLM,
 * cero credencial. Corre bajo el candado: `node --import ./scripts/offline-guard.mjs _forma_pedida_negativa_gate.mjs`.
 */
import { resolveTablePolicy, prohibeFormaTabular, pideMantenerLaForma, podarPlanProgresivo, pideTablaExplicita, pideDetalleTemporal, pideDetalleComposicion, pidePresentacionTabular, ANSWER_SHAPES } from "./src/adi/oracle/progressiveDisclosure.js";
import { pideReduccionDeForma, pideReduccionDeLargo, pideCorreccionDeRegistro, pideDatoPelado, buildPrefDoctrine, REDUCCION_EJEMPLOS } from "./src/adi/oracle/responsePreference.js";
import { buildNarrationContract, buildExtensionPolicy } from "./src/adi/oracle/narrationContract.js";
import { buildNarrateUserMessageC } from "./src/adi/oracle/narratePromptC.js";
import { guardC } from "./src/adi/oracle/guardC.js";

let PASS = 0, FAIL = 0;
const ok = (cond, msg) => { if (cond) { PASS++; console.log("  ok   " + msg); } else { FAIL++; console.log("  FAIL " + msg); } };

// ── material mínimo del turno (no hay red: son datos fijos) ────────────────────────────────────────────────────
const FIGS = [
  { label: "Falabella · ventas", value: 4943664, unit: "CLP", tipo: { universo: "venta comercial" } },
  { label: "Falabella · margen", value: 18.4, unit: "%", tipo: { universo: "venta comercial" } },
];
const RESULTS = [{ tool: "entityProfile", coverage: { supported: true }, facts: { entity: "Falabella" } }];
const PLAN_PERFIL = { intent: "answer", mode: "default", calls: [{ tool: "entityProfile", entity: "Falabella", dimension: "cliente" }, { tool: "trend" }, { tool: "entityComposicion" }] };
const TABLA_MD = "| Mes | Venta |\n| --- | --- |\n| Ene | $4.9M |";
const kinds = (v) => (v.violations || []).map((x) => x.kind);
// el camino REAL de un turno: detector → contrato → payload del narrador → guardC. Se usa en los tres bloques
// end-to-end para que ninguna afirmación se quede en el detector.
const e2e = (q, cuerpo = TABLA_MD) => {
  const tp = resolveTablePolicy({ text: q, podado: [] });
  const contrato = buildNarrationContract({ text: q, plan: PLAN_PERFIL, results: RESULTS, ledgerFigs: FIGS, tablePolicy: tp });
  const raw = buildNarrateUserMessageC({ text: q, plan: PLAN_PERFIL, results: RESULTS, ledgerFigs: FIGS, tablePolicy: tp });
  const payload = typeof raw === "string" ? JSON.parse(raw) : raw;
  return { tp, sellada: contrato.politicaExtension.tablePolicy, payload, guard: guardC(cuerpo, { ledger: { figs: FIGS }, results: RESULTS, question: q, tablePolicy: tp }) };
};

/* ══ 1 · RE-CERTIFICADO · el sustantivo INEQUÍVOCO negado YA NO gana sobre el disparador positivo ════════════════
 * ESTE BLOQUE AFIRMABA «forbidden». HOY AFIRMA `required`, QUE ES LO QUE PASA DE VERDAD. No es un aflojamiento:
 * es el valor exacto, no un «!== forbidden» que dejaría pasar cualquier cosa. Con `_negaciones(_TABLA_N_FORMA)`
 * fuera de `_PROHIBE_FORMA`, el paso 1 de `prohibeFormaTabular` ya no ve estos turnos; el paso 2 corta porque el
 * MISMO turno trae un disparador positivo, y `resolveTablePolicy` cae en `required`.
 * ES EL DEFECTO E3.t3, ABIERTO, Y SE MIDE EN LOS SEIS CASOS que antes eran la prueba de la capacidad. */
console.log("\n══ 1 · EL LÍMITE ABIERTO (E3.t3) · la negación del sustantivo inequívoco ya no gana: manda el positivo ══");
{
  const casos = [
    ["Explicalo sin repetir la tabla: cuál fue el peor mes.", "_TEMPORAL (peor mes)"],
    ["Sin tablas por favor: contame el desglose en prosa.", "_DESGLOSE (desglose)"],
    ["No quiero la tabla de Falabella, explicame en prosa qué le pasa.", "_PIDE_TABLA_OBJETO (quiero la tabla)"],
    ["Explicame la evolución sin tabla, solo texto corrido.", "_TEMPORAL (evolución)"],
    ["Ni se te ocurra darme una tabla con el mix.", "_DESGLOSE (mix)"],
    ["Olvidate de armar una tabla: quiero entender la composición, no leerla.", "_DESGLOSE (composición)"],
  ];
  for (const [q, disparador] of casos) {
    ok(pidePresentacionTabular(q), `el disparador positivo SIGUE presente en «${q.slice(0, 40)}…» — ${disparador} (si no, el caso no probaría nada)`);
    ok(!prohibeFormaTabular(q), `EL LÍMITE: el detector YA NO lee la prohibición (la lista del sustantivo inequívoco fue retirada): «${q.slice(0, 40)}…»`);
    ok(resolveTablePolicy({ text: q, podado: [] }) === "required", `→ E3.t3 ABIERTO: gana ${disparador} y se entrega la tabla que el turno negó (valor real: required, no forbidden)`);
  }
  // EL TESTIGO MÍNIMO DEL RETIRO, medido y no declarado: un turno con el sustantivo INEQUÍVOCO negado, SIN verbo
  // `tabular` y SIN ningún polisémico, o sea sin ninguna de las familias que quedaron vivas. Si alguna negación de
  // sustantivo inequívoco volviera a `_PROHIBE_FORMA`, esto deja de ser `auto` — es el detector del regreso.
  ok(resolveTablePolicy({ text: "No me armes ninguna tabla, decime qué está pasando.", podado: [] }) === "auto",
    "TESTIGO DEL RETIRO: de `_PROHIBE_FORMA` sólo sobrevive la familia del VERBO negado — un inequívoco negado y solo cae en `auto`");
}

/* ══ 1-bis · LO QUE SÍ SIGUE GANANDO · el VERBO negado con modo CERRADO ═══════════════════════════════════════════
 * La única familia que quedó en `_PROHIBE_FORMA` es la del verbo `tabular` negado, y conserva entera la propiedad
 * que este gate certificaba: gana sobre el disparador positivo co-ocurrente. Es la mitad de la afirmación original
 * que NO se perdió, y se prueba con disparador pegado en los cuatro casos para que no se confunda con el bloque 2. */
console.log("\n══ 1-bis · LO QUE SIGUE VALIENDO · el VERBO negado gana sobre el disparador positivo del mismo turno ══");
{
  const casos = [
    ["Contame el mes a mes sin tabular.", "«sin» + INFINITIVO, con _TEMPORAL pegado"],
    ["No me tabules nada, contame nomás qué pasó mes a mes.", "«no me tabules» SUBJUNTIVO, con _TEMPORAL pegado"],
    ["Respondeme en formato narrativo, no tabular.", "«no tabular» INFINITIVO — el sub-disparo peor medido"],
    ["Nada de tabular, hablame nomás del mes a mes.", "«nada de» + INFINITIVO"],
  ];
  for (const [q, nota] of casos) {
    ok(pidePresentacionTabular(q), `precondición: el disparador positivo está pegado (${nota}) — si no, el caso no probaría nada: «${q.slice(0, 42)}…»`);
    ok(resolveTablePolicy({ text: q, podado: [] }) === "forbidden", `la prohibición GANA sobre el positivo, como siempre → forbidden: «${q.slice(0, 42)}…»`);
  }
  // el corte de MODO no se aflojó al quedarse solo: el indicativo sigue siendo un reclamo, no una orden.
  ok(!prohibeFormaTabular("¿Por qué no tabulaste el mes a mes?"), "y el corte de MODO sigue en pie: «¿por qué no tabulaste?» es un RECLAMO, no una orden");
  ok(resolveTablePolicy({ text: "¿Por qué no tabulaste el mes a mes?", podado: [] }) === "required", "…así que se le entrega la tabla que reclama");
}

/* ══ 2 · RE-CERTIFICADO · negación SOLA, sin disparador positivo (el viejo «grado b») ══════════════════════════
 * El bloque se parte en dos porque el eje se partió en dos. Lo que sobrevive está arriba y lo que se perdió está
 * abajo, cada uno con su valor exacto. */
console.log("\n══ 2 · NEGACIÓN SOLA · lo que sigue prohibiendo, y lo que dejó de hacerlo ══");
{
  console.log("  ·· SIGUE VALIENDO: polisémicos sin pedido positivo, y la polaridad de prosa");
  const VIVOS = [
    ["Basta de cuadros, hablemos del negocio.", "polisémico `cuadro` negado, sin pedido positivo que lo exonere (paso 3)"],
    ["Evitá las columnas, quiero leerlo de corrido.", "polisémico `columna` negado (paso 3)"],
    ["Contámelo en prosa.", "la FORMA OPUESTA nombrada en positivo: pedir prosa es prohibir la tabla"],
  ];
  for (const [q, nota] of VIVOS) {
    ok(!pidePresentacionTabular(q), `«${q.slice(0, 38)}…» no trae disparador positivo (es el grado b puro)`);
    ok(resolveTablePolicy({ text: q, podado: [] }) === "forbidden", `la prohibición sola sigue llegando a forbidden — ${nota}`);
  }
  console.log("  ·· EL LÍMITE ABIERTO (E3.t3): el sustantivo INEQUÍVOCO negado ya no llega a forbidden");
  const PERDIDOS = [
    ["Nada de tablas, por favor: contame qué está pasando con el negocio.", "«nada de» + `tablas`"],
    ["No me armes ninguna tabla, decime qué está pasando con Falabella.", "imperativo negado + `tabla`"],
  ];
  for (const [q, nota] of PERDIDOS) {
    ok(!pidePresentacionTabular(q), `«${q.slice(0, 38)}…» tampoco trae disparador positivo — así que ni siquiera es el paso 2 el que lo salva`);
    ok(resolveTablePolicy({ text: q, podado: [] }) === "auto", `→ auto, no forbidden (${nota}): la prohibición se evapora y el narrador decide — defecto ABIERTO, escrito con su valor exacto`);
  }
}

console.log("\n══ 3 · EL LÍMITE · negar el CONTENIDO no es negar la FORMA (el lado opuesto del mismo defecto) ══");
{
  // Si "forbidden" se disparara con cualquier "sin"/"no" de la frase, se rompería el caso mixto legítimo. Estos
  // tienen que seguir dando required — es la mitad del contrato que sigue INTACTA.
  ok(resolveTablePolicy({ text: "Dame la tabla mes a mes, sin el diagnóstico.", podado: [] }) === "required", "«la tabla mes a mes, SIN EL DIAGNÓSTICO» sigue siendo required (niega el contenido, no la forma)");
  ok(resolveTablePolicy({ text: "La tabla completa de Falabella, sin recomendación.", podado: [] }) === "required", "«la tabla completa, SIN RECOMENDACIÓN» sigue siendo required");
  ok(resolveTablePolicy({ text: "No, te pedí contribución, no ventas. Dame el mes a mes.", podado: [] }) === "required", "«no ventas» niega una métrica, no la forma → sigue required");
  ok(!prohibeFormaTabular("dame la tabla mes a mes, sin el diagnóstico"), "el detector NO se dispara con una negación de contenido");
  ok(!prohibeFormaTabular("explicame esta tabla"), "la DEIXIS («explicame esta tabla») no es una prohibición");
  ok(!prohibeFormaTabular("no entendí lo de contribución no capturada"), "un «no» de comprensión no prohíbe nada");
  ok(resolveTablePolicy({ text: "explicame esta tabla", podado: [] }) === "auto", "la deixis sigue resolviendo auto");
  // EL GUARD DE POLISEMIA, sobre el eje que quedó vivo: negar una COLUMNA no mata la tabla que el turno pidió.
  ok(!prohibeFormaTabular("Dame la tabla mes a mes, sin la columna de margen."), "negar una COLUMNA no mata la tabla que el mismo turno pidió (paso 2, intacto)");
  ok(resolveTablePolicy({ text: "Dame la tabla mes a mes, sin la columna de margen.", podado: [] }) === "required", "…y por lo tanto la tabla se entrega igual");
}

console.log("\n══ 4 · REDUCCIÓN DE LARGO · pedir MENOS no puede devolver doce filas ══");
{
  // SÓLO las dos familias que hablan del LARGO: un presupuesto ("en dos renglones") o un recorte a la conclusión.
  // Una respuesta que tiene que entrar en una línea no se entrega en doce filas. INTACTO: este eje no depende de
  // la lista retirada — `pideReduccionDeLargo` es un paso propio de `resolveTablePolicy`.
  const casos = [
    "Ahora solo la conclusión, nada más.",
    "Resumilo en una frase, sin explicación.",
    "Decime en dos renglones qué está fallando.",
    "Quedate con lo esencial de Falabella.",
    "Contámelo en una línea.",
  ];
  for (const q of casos) {
    ok(pideReduccionDeForma(q), `reconocida como REDUCCIÓN: «${q}»`);
    ok(pideReduccionDeLargo(q), `…y es de la familia del LARGO (la que sí es incompatible con una tabla): «${q.slice(0, 36)}…»`);
    ok(resolveTablePolicy({ text: q, podado: [] }) === "forbidden", `una reducción de LARGO prohíbe la tabla → forbidden: «${q.slice(0, 36)}…»`);
  }
  // EL LÍMITE DE LA CLÁUSULA (revisión adversarial 2026-08-11) · la familia de REGISTRO corrige el TONO, no la
  // forma. Estos turnos eran `auto` —el narrador decidía si tabular— y hacerlos `forbidden` le niega al usuario
  // una forma que nadie prohibió: un top-10 y una comparación se leen mejor en tabla, y "al grano" no dice lo
  // contrario. Baja `detailLevel` por su propio eje y no toca la presentación.
  const REGISTRO = [
    ["Andá al grano: dame el top 10 de clientes.", "una lista top-N se lee en tabla"],
    ["Sin rodeos, compará Falabella y Lider.", "una comparación se lee en tabla"],
    ["Hablame más directo sobre el negocio.", "corrección de registro pura"],
    ["Hablame directo y sin rodeos de lo más grave del negocio.", "el caso medido en vivo: el daño era el ALCANCE, no la tabla"],
    ["Andá al grano con lo de Falabella.", "idem"],
  ];
  for (const [q, nota] of REGISTRO) {
    ok(pideCorreccionDeRegistro(q), `es una corrección de REGISTRO: «${q.slice(0, 40)}…»`);
    ok(!pideReduccionDeLargo(q), `…y NO es un presupuesto de largo — ${nota}`);
    ok(pideReduccionDeForma(q), "…pero sigue bajando `detailLevel` (las tres familias son REDUCCIÓN para el eje de detalle)");
    ok(resolveTablePolicy({ text: q, podado: [] }) !== "forbidden", `el registro NO le prohíbe la tabla al narrador: «${q.slice(0, 40)}…»`);
  }
  ok(resolveTablePolicy({ text: "Al grano: dame la tabla mes a mes.", podado: [] }) === "required", "y si el mismo turno pide la tabla, la reducción no se la quita");
  // LA TRAMPA ASCII DEL `\b` ANTE VOCAL ACENTUADA, la misma que este repo ya documenta dos veces: con el `\b`
  // delante, «únicamente la conclusión» —la forma CON tilde, la que un usuario escribe— no matcheaba nunca.
  ok(pideReduccionDeLargo("Únicamente la conclusión, por favor."), "«ÚNICAMENTE la conclusión» (con tilde) es una reducción de largo — el `\\b` ASCII no la dejaba entrar");
  ok(pideReduccionDeLargo("Unicamente la conclusion, por favor."), "…y la forma sin tilde sigue entrando (no se cambió una por la otra)");
  // LA FRONTERA DE LOS DOS EJES: una restricción negativa NO nombra el alcance; un pedido positivo del dato SÍ.
  ok(!pideDatoPelado("Hablame directo y sin rodeos"), "una corrección de REGISTRO no nombra ningún dato → no puede fijar contentScope");
  ok(!pideDatoPelado("Resumilo en una frase, sin explicación"), "una restricción negativa sola no nombra ningún dato → no puede fijar contentScope");
  ok(pideDatoPelado("Dame solo el dato de contribución"), "nombrar el dato EN POSITIVO sí fija el alcance");
  ok(pideDatoPelado("Solo el dato, sin explicación"), "cuando conviven, manda el positivo (el que nombra la cosa pedida)");
  // el falso positivo que separa un pedido de forma de un sustantivo del negocio
  ok(!pideReduccionDeForma("cayó una línea de producto entera"), "«una línea DE producto» no es un presupuesto de largo");
  ok(!pideReduccionDeForma("cómo va el negocio"), "una pregunta normal no es una reducción");
  ok(resolveTablePolicy({ text: "cómo va el negocio", podado: [] }) === "auto", "una pregunta normal sigue en auto");
}

console.log("\n══ 5 · CONTINUIDAD DE FORMA · «mantené el formato» hereda la decisión REAL del turno anterior ══");
{
  ok(pideMantenerLaForma("No, te pedí contribución, no ventas. Mantén el período y EL FORMATO."), "detecta el pedido aunque el complemento esté en el medio (verbo y sustantivo separados)");
  ok(pideMantenerLaForma("Lo mismo pero en el mismo cuadro"), "«en el mismo cuadro»");
  ok(pideMantenerLaForma("seguí con esa vista"), "«seguí con esa vista»");
  // la trampa ASCII otra vez, ahora en el verbo de continuidad: con `\bconserv\w+`, la forma imperativa que un
  // usuario escribe de verdad («conservá», con tilde) NO matcheaba — sólo la forma sin acento.
  ok(pideMantenerLaForma("conservá la estructura de la respuesta anterior"), "«CONSERVÁ la estructura» (con tilde) también es continuidad");
  ok(pideMantenerLaForma("conserva el formato de antes"), "…y la forma sin tilde sigue entrando");
  ok(!pideMantenerLaForma("dame el margen de Falabella"), "un turno normal no pide continuidad");
  // FALSOS POSITIVOS · "mismo/misma" es un adjetivo cualquiera del español. Antes bastaba con que apareciera en
  // CUALQUIER parte del mensaje junto a un sustantivo de forma en CUALQUIER otra parte, sin relación sintáctica.
  // El día que se cablee `politicaPrevia`, cada uno de estos heredaría la forma del turno anterior sin que nadie
  // la haya pedido — que es el mismo daño que este gate certifica en la otra dirección.
  const NO_CONTINUIDAD = [
    ["¿Por qué el mismo mes muestra otra cifra en la tabla?", "«mismo MES» + «tabla» a diez palabras: dos cosas sin relación"],
    ["Mismo cliente, otra estructura de costos", "«mismo CLIENTE»; «estructura» es del negocio, no de la respuesta"],
    ["Es la misma tabla que vimos ayer, ¿no?", "cópula + relativo: habla DE la tabla, no pide conservarla"],
    ["¿Es el mismo cuadro de la semana pasada?", "pregunta de deixis sobre lo que ya está en pantalla"],
    ["El mismo problema aparece en el cuadro de mando", "«mismo PROBLEMA»: el sustantivo de forma queda lejos"],
    ["Ese cliente compra lo mismo todos los meses", "«lo mismo» sin ningún sustantivo de forma pegado"],
  ];
  for (const [q, nota] of NO_CONTINUIDAD) {
    ok(!pideMantenerLaForma(q), `NO es un pedido de continuidad — ${nota}: «${q.slice(0, 44)}…»`);
    ok(resolveTablePolicy({ text: q, podado: [], politicaPrevia: "forbidden" }) === "auto",
      `…y por lo tanto NO hereda la política del turno anterior: «${q.slice(0, 44)}…»`);
  }
  // EL LÍMITE DECLARADO en la otra dirección: «la misma vista de siempre» SÍ es continuidad (el adjetivo está
  // pegado al sustantivo de forma y no hay cópula ni relativo que lo vuelva deixis). Se afirma a propósito: es un
  // pedido genuino de conservar la forma, y negárselo sería el falso positivo simétrico.
  ok(pideMantenerLaForma("En la misma vista de siempre, ¿cuánto es el margen?"), "«en la misma VISTA de siempre» sí pide continuidad (adyacencia, sin cópula ni relativo)");
  const Q_MANTENER = "No, te pedí contribución, no ventas. Mantén el período y EL FORMATO.";
  ok(resolveTablePolicy({ text: Q_MANTENER, podado: [], politicaPrevia: "required" }) === "required", "hereda el `required` del turno anterior (la tabla se mantiene)");
  ok(resolveTablePolicy({ text: Q_MANTENER, podado: [], politicaPrevia: "forbidden" }) === "forbidden", "hereda también el `forbidden` — la continuidad no tiene dirección preferida");
  ok(resolveTablePolicy({ text: Q_MANTENER, podado: [], politicaPrevia: "auto" }) === "auto", "un `auto` previo no se hereda: nadie había decidido nada que conservar");
  ok(resolveTablePolicy({ text: Q_MANTENER, podado: [] }) === "auto", "sin política previa, nada que heredar (el motor no inventa una forma)");
  ok(resolveTablePolicy({ text: "Mantené el formato y dame el mes a mes.", podado: [], politicaPrevia: "forbidden" }) === "required", "un pedido POSITIVO nuevo de este turno gana sobre la herencia");
  // LA REGLA «una prohibición NUEVA gana sobre la herencia» SIGUE VIVA, y se prueba sobre las familias que
  // quedaron — el verbo negado y el polisémico. Antes se probaba con «pero sin tabla», que era la familia retirada.
  ok(resolveTablePolicy({ text: "Mantené el formato, pero no me tabules.", podado: [], politicaPrevia: "required" }) === "forbidden", "una prohibición NUEVA gana sobre la herencia (verbo negado): required heredado → forbidden");
  ok(resolveTablePolicy({ text: "Mantené el formato, pero sin cuadros.", podado: [], politicaPrevia: "required" }) === "forbidden", "…y también con el polisémico: «pero sin cuadros» gana sobre el `required` heredado");
  // EL LÍMITE ABIERTO, en este eje: con el sustantivo INEQUÍVOCO la prohibición nueva ya no gana — la herencia
  // pasa por encima. Antes esto afirmaba `forbidden`; hoy afirma el valor real, que es el defecto E3.t3 visto
  // desde la continuidad.
  ok(resolveTablePolicy({ text: "Mantené el formato, pero sin tabla.", podado: [], politicaPrevia: "required" }) === "required",
    "E3.t3 ABIERTO acá también: «pero SIN TABLA» ya no se lee, así que la herencia `required` sobrevive y se tabula igual (valor real: required)");
}

console.log("\n══ 6 · LA PRECEDENCIA QUE NO SE TOCÓ · pedido explícito > poda (owner 2026-08-07) ══");
{
  const poda = podarPlanProgresivo(PLAN_PERFIL, "Dame la tabla completa de Falabella");
  ok(poda.podado.length > 0, "el turno de perfil general poda detalle (precondición del caso del owner)");
  ok(resolveTablePolicy({ text: "Dame la tabla completa de Falabella", podado: poda.podado }) === "required", "«dame la tabla completa» sigue ganando sobre la poda — «si el usuario pidió la tabla, la pidió»");
  const poda2 = podarPlanProgresivo(PLAN_PERFIL, "contame de Falabella");
  ok(resolveTablePolicy({ text: "contame de Falabella", podado: poda2.podado }) === "forbidden", "la poda sigue produciendo forbidden cuando nadie pidió ni prohibió nada");
  ok(resolveTablePolicy({ text: "compará Falabella y Lider", podado: [] }) === "auto", "una comparación sigue en auto");
}

/* ══ 7 · RE-CERTIFICADO · E3.t3 MEDIDO POR EL CAMINO REAL, hasta el rechazo que le cobra a la prosa ══════════════
 * Este bloque afirmaba que la prohibición viajaba sellada hasta guardC. HOY MIDE LO CONTRARIO, porque es lo que
 * pasa: el turno resuelve `required`, el contrato lo sella `required`, al narrador le llega `instruccion_tabla`,
 * guardC deja pasar la tabla que el usuario pidió no ver — y le cobra `tabla-faltante` a la prosa obediente.
 * NO SE BORRÓ NINGUNA ASERCIÓN: el rechazo imposible que el fix decía haber eliminado volvió, y queda escrito acá
 * con su nombre. Es el costo de haber elegido el falso negativo, y no está escondido en un comentario. */
console.log("\n══ 7 · E3.t3 END-TO-END · el defecto abierto, medido hasta guardC (no se queda en el detector) ══");
{
  const Q = "Explicalo sin repetir la tabla: cuál fue el peor mes.";
  const r = e2e(Q);
  ok(r.tp === "required", "E3.t3: el turno que dice «sin repetir la tabla» resuelve `required` (valor real, no forbidden)");
  ok(r.sellada === "required", "…y el contrato lo sella `required`: al narrador no le llega ninguna prohibición");
  ok(!!r.payload.instruccion_tabla && !r.payload.instruccion_sin_tabla, "…al narrador le llega la orden de TABULAR, que es exactamente la contraria a la que el usuario dio");
  ok(!kinds(r.guard).includes("tabla-no-autorizada"), "…guardC NO bloquea la tabla que el usuario prohibió (el eje quedó sin mordida para este turno)");
  const PROSA = "Falabella vendió $4.9M y su margen es 18.4%.";
  ok(kinds(guardC(PROSA, { ledger: { figs: FIGS }, results: RESULTS, question: Q, tablePolicy: r.tp })).includes("tabla-faltante"),
    "EL COSTO, DICHO ENTERO: la prosa que el usuario pidió vuelve a ser rechazada por `tabla-faltante` — el rechazo que el narrador no puede evitar por más que obedezca");
  ok(!kinds(guardC(PROSA, { ledger: { figs: FIGS }, results: RESULTS, question: Q, tablePolicy: "forbidden" })).includes("tabla-faltante"),
    "control: bajo `forbidden` esa misma prosa pasaba limpia — o sea que el rechazo lo produce la política, no el texto");
}

/* ══ 7-bis · LA MISMA CADENA, SOBRE EL EJE QUE SIGUE VIVO ═══════════════════════════════════════════════════════
 * La certificación «la orden llega hasta el narrador Y hasta el guard» no se perdió: se prueba con el verbo
 * negado, que es la familia de `_PROHIBE_FORMA` que quedó. Sin este bloque, retirar la lista habría dejado el
 * camino end-to-end sin ninguna prueba de que sigue transportando una prohibición. */
console.log("\n══ 7-bis · LO QUE SIGUE VALIENDO · la prohibición VIVA viaja sellada hasta guardC ══");
{
  const Q = "Contame el mes a mes sin tabular.";
  const r = e2e(Q);
  ok(pidePresentacionTabular(Q), "precondición: el turno TRAE el disparador positivo (mes a mes) — la prohibición tiene que ganarle");
  ok(r.tp === "forbidden", "la prohibición del VERBO gana → forbidden");
  ok(r.sellada === "forbidden", "…y viaja SELLADA en el contrato (politicaExtension.tablePolicy)");
  ok(!!r.payload.instruccion_sin_tabla && !r.payload.instruccion_tabla, "…el narrador RECIBE la instrucción de no tabular, y NO la contraria (nada de una orden imposible)");
  ok(kinds(r.guard).includes("tabla-no-autorizada"), "…y guardC BLOQUEA la tabla que el usuario prohibió");
  const PROSA = "Falabella vendió $4.9M y su margen es 18.4%.";
  ok(!kinds(guardC(PROSA, { ledger: { figs: FIGS }, results: RESULTS, question: Q, tablePolicy: r.tp })).includes("tabla-faltante"),
    "…y la prosa obediente NO se cobra `tabla-faltante`: acá el eje sí cierra entero");
}

console.log("\n══ 8 · LA DOCTRINA DE PLAN Y EL DETECTOR NO PUEDEN DIVERGIR ══");
{
  const doctrina = buildPrefDoctrine();
  ok(REDUCCION_EJEMPLOS.length >= 6, "la clase se declara con ejemplos canónicos en UN solo lugar");
  for (const ej of REDUCCION_EJEMPLOS) {
    ok(pideReduccionDeForma(ej), `el detector reconoce el ejemplo canónico «${ej}»`);
    ok(!pideDatoPelado(ej), `y NO lo confunde con un pedido de dato pelado: «${ej}»`);
    ok(doctrina.includes(ej), `y la doctrina de PLAN lo cita textualmente: «${ej}»`);
  }
  ok(/restricci[oó]n NEGATIVA nunca fija "contentScope"/i.test(doctrina), "la doctrina enuncia la REGLA GENERAL (una restricción negativa no fija el alcance), no una lista de frases");
  ok(/nombra EN POSITIVO/i.test(doctrina), "…y su contraparte: el alcance lo fija sólo lo que el turno nombra en positivo");

  /* UNA FRASE, UN ALCANCE · el chequeo ESTRUCTURAL, no una comparación contra un literal.
   * El defecto que cierra (revisión adversarial 2026-08-11): "al grano" quedó citado a la vez en el bullet de
   * REDUCCIÓN (detailLevel="brief", alcance VACÍO) y en el de contentScope="action_only". El prompt le pedía al
   * LLM del PLAN las dos cosas contrarias sobre la misma frase — la segunda-verdad que este mismo fix dice estar
   * eliminando. El chequeo viejo (`doctrina.includes(ej)`) se satisfacía CON la contradicción, porque sólo pedía
   * que la frase apareciera en alguna parte.
   * ACÁ se lee la doctrina como estructura: se toman los bullets que fijan un `contentScope` y se pasa CADA frase
   * entrecomillada por el DETECTOR. Si alguna es una reducción, el bullet la está mandando a un alcance — y eso es
   * exactamente la contradicción. Nada de comparar contra el texto de la certificación: el juez es el detector. */
  const bulletsDeAlcance = doctrina.split("\n").filter((l) => /contentScope\s*=\s*"(?:data_only|action_only|results_only)"/.test(l));
  ok(bulletsDeAlcance.length >= 3, "la doctrina sigue teniendo los tres bullets de contentScope (si no, el chequeo de abajo no probaría nada)");
  for (const linea of bulletsDeAlcance) {
    const alcance = (linea.match(/contentScope\s*=\s*"([a-z_]+)"/) || [])[1];
    const frases = (linea.match(/"[^"]{2,60}"/g) || []).map((s) => s.slice(1, -1));
    ok(frases.length >= 2, `el bullet de ${alcance} cita frases de ejemplo (${frases.length}) — hay material que auditar`);
    for (const f of frases) {
      ok(!pideReduccionDeForma(f), `el bullet de ${alcance} NO se lleva una frase de REDUCCIÓN: «${f}»`);
    }
  }
  // y la contracara: las frases de reducción siguen teniendo SU bullet, el de detailLevel con alcance vacío.
  const bulletReduccion = doctrina.split("\n").find((l) => /REDUCCI[OÓ]N/.test(l) && /detailLevel="brief"/.test(l));
  ok(!!bulletReduccion, "existe un bullet propio de REDUCCIÓN con detailLevel=\"brief\"");
  for (const ej of REDUCCION_EJEMPLOS) ok(bulletReduccion.includes(ej), `y es el que cita «${ej}» (una frase, un alcance)`);

  /* «UNA FRASE, UN ALCANCE» ES LA AFIRMACIÓN VERDADERA · «SIEMPRE Y SÓLO ACÁ» ERA FALSA (revisión adversarial 2).
   * El bullet de REDUCCIÓN decía «Siempre y sólo acá» sobre sus seis frases, pero "al grano" y "sin rodeos" siguen
   * —correctamente— citadas también en el bullet de REGISTRO. Los dos bullets coinciden en `detailLevel` y ninguno
   * fija alcance, así que la doctrina no se contradice: lo falso era la palabra «sólo». Y un gate que certificaba
   * esa frase con `ok(/Siempre y sólo acá/)` estaba certificando la mentira — le daba verde a una afirmación que el
   * propio prompt incumplía dos líneas más abajo.
   * ACÁ SE MIDE LO QUE DE VERDAD SE CUMPLE, y se mide estructuralmente: se buscan TODOS los bullets que citan una
   * frase de REDUCCIÓN y se exige que cada uno fije `detailLevel="brief"` y que NINGUNO le pegue un `contentScope`.
   * La exclusividad se prueba sobre el eje donde una segunda-verdad hace daño —el ALCANCE—, no sobre la cantidad de
   * bullets, que es lo que la frase vieja prometía y no cumplía. */
  ok(!/Siempre y s[oó]lo ac[aá]/i.test(doctrina), "la doctrina ya NO afirma una exclusividad que ella misma incumple («siempre y SÓLO acá», con «al grano» citado también en REGISTRO)");
  ok(/ninguna fija contentScope/i.test(bulletReduccion), "…y en su lugar dice lo que sí se cumple: ninguna de esas frases fija un alcance");
  const bulletsQueCitan = doctrina.split("\n").filter((l) => REDUCCION_EJEMPLOS.some((e) => l.includes(`"${e}"`)));
  ok(bulletsQueCitan.length >= 2, `más de un bullet cita frases de REDUCCIÓN (${bulletsQueCitan.length}) — por eso «sólo acá» era falso; acá se mide en vez de declararlo`);
  for (const l of bulletsQueCitan) {
    const cita = l.trim().slice(0, 52);
    ok(/detailLevel="brief"/.test(l), `todo bullet que cita una frase de REDUCCIÓN fija detailLevel="brief" (las ramas no divergen): «${cita}…»`);
    ok(!/contentScope\s*=\s*"(?:data_only|action_only|results_only)"/.test(l), `…y NINGUNO le pega un contentScope: «${cita}…»`);
  }
}

console.log("\n══ 9 · UNA SOLA LISTA DE FORMAS DE RESPUESTA (sin copia que pueda divergir) ══");
{
  for (const s of ANSWER_SHAPES) {
    ok(buildExtensionPolicy({ scope: null, claims: [], acciones: [], formaRespuesta: s }).formaRespuesta === s, `politicaExtension acepta la forma declarada «${s}» (nada de un enum copiado que la anule en silencio)`);
  }
  ok(buildExtensionPolicy({ scope: null, claims: [], acciones: [], formaRespuesta: "inventada" }).formaRespuesta === null, "una forma no declarada se sigue descartando");
}

/* ══ 10 · EL RECLAMO NO ES UNA ORDEN · el modo del verbo decide, no la palabra (revisión adversarial 2) ══════════
 * EL FALSO POSITIVO QUE ESTE BLOQUE CIERRA: `_VERBO_ENTREGA` era `\w+` abierto (`arm\w+`, `us\w+`, `inclu\w+`,
 * `copi\w+`, `repit\w+`, `muestr\w+`), así que las familias de negación matcheaban también el INDICATIVO, que NO es
 * una orden: es un RECLAMO de que la tabla FALTÓ. La regla que lo cierra es gramática, no una lista de frases: en
 * español el imperativo NEGADO se conjuga en SUBJUNTIVO («no me armes»), y detrás de «sin»/«olvidate de»/«dejá
 * de»/«ni se te ocurra»/«no vuelvas a» va el INFINITIVO. Por eso `_VE_INF` y `_VE_SUBJ` son enumeraciones CERRADAS.
 * SIGUE VALIENDO DESPUÉS DEL RETIRO, y por eso el bloque se conserva entero: `_negaciones` ya no se aplica al
 * sustantivo INEQUÍVOCO, pero SÍ se sigue aplicando a `_TABLA_N_PARTE` (los polisémicos) en el paso 3. El corte de
 * modo es lo único que impide que «no me armaste el cuadro que te pedí» se lea como una prohibición — ver 10-b-bis,
 * que es el sub-bloque nuevo: prueba la regla sobre el eje donde HOY tiene efecto, no sólo donde ya no lo tiene. */
console.log("\n══ 10 · EL RECLAMO NO ES UNA ORDEN · indicativo ≠ imperativo, en TODOS los verbos de entrega ══");
{
  // (a) EL CASO CORRECTO QUE YA NO SE BLOQUEA, por el camino real y hasta guardC. Es el turno EXACTO que el revisor
  //     midió: reclamo en indicativo pasado, con el disparador temporal pegado, que antes salía forbidden.
  const RECLAMO = "No me armaste la tabla mes a mes, ¿la podés hacer?";
  const r = e2e(RECLAMO);
  ok(pideDetalleTemporal(RECLAMO), "precondición: el turno TRAE el disparador positivo (mes a mes) — si no, el caso no probaría nada");
  ok(r.tp === "required", `el RECLAMO ya no se lee como prohibición → required (antes: forbidden): «${RECLAMO}»`);
  ok(r.sellada === "required", "…y el contrato lo sella así (no se pierde en el camino al narrador)");
  ok(!r.payload.instruccion_sin_tabla && !!r.payload.instruccion_tabla, "…al narrador le llega la orden de TABULAR, no la contraria");
  ok(!kinds(r.guard).includes("tabla-no-autorizada"), "…y guardC YA NO bloquea con `tabla-no-autorizada` la tabla que el usuario reclamaba porque FALTÓ");

  // (b) LA CLASE ENTERA, verbo por verbo · RECLAMO (indicativo pasado) y PEDIDO CORTÉS (indicativo presente). El
  //     defecto estaba en los seis verbos, así que los seis se prueban; probar sólo `tabular` fue el error anterior.
  const NO_SON_ORDENES = [
    ["No me armaste la tabla mes a mes, ¿la podés hacer?", "armar · pasado"],
    ["¿No me armas la tabla mes a mes?", "armar · presente"],
    ["¿No me armás la tabla mes a mes?", "armar · presente voseo"],
    ["No usaste la tabla mes a mes que te pasé.", "usar · pasado"],
    ["¿No me usas la tabla de siempre para el mes a mes?", "usar · presente"],
    ["No me incluiste la tabla de la evolución mensual.", "incluir · pasado"],
    ["¿No me repites la tabla mes a mes?", "repetir · presente"],
    ["¿No me haces la tabla por marca?", "hacer · presente"],
    ["No me copiaste la tabla del mes a mes que te pedí.", "copiar · pasado"],
    ["¿No me muestras la tabla del mes a mes?", "mostrar · presente"],
    ["¿No me pones la tabla mes a mes de una vez?", "poner · presente"],
    ["¿Por qué no tabulaste el mes a mes?", "tabular · pasado (el único que ya estaba cerrado)"],
  ];
  for (const [q, nota] of NO_SON_ORDENES) {
    ok(!prohibeFormaTabular(q), `el INDICATIVO no es una orden (${nota}): «${q}»`);
    ok(resolveTablePolicy({ text: q, podado: [] }) !== "forbidden", `→ y por lo tanto NO se prohíbe la tabla que el turno reclama: «${q.slice(0, 44)}…»`);
  }

  // (b-bis) NUEVO · LA MISMA REGLA, SOBRE EL EJE DONDE HOY TIENE EFECTO. Los de arriba pasarían aunque el corte de
  //   modo se aflojara, porque su familia salió de `_PROHIBE_FORMA`. Estos NO: son polisémicos SIN disparador
  //   positivo, así que llegan al paso 3, donde `_negaciones(_TABLA_N_PARTE)` sí los juzga. Si `_VE_SUBJ` volviera a
  //   ser `\w+` abierto, los tres se pondrían rojos — que es lo que un gate de esta regla tiene que garantizar.
  const RECLAMOS_POLISEMICOS = [
    ["No me armaste el cuadro que te pedí.", "armar · pasado, sobre el polisémico `cuadro`"],
    ["¿No me armas el cuadro de siempre?", "armar · presente, sobre `cuadro`"],
    ["No me copiaste las columnas que te pasé.", "copiar · pasado, sobre `columnas`"],
  ];
  for (const [q, nota] of RECLAMOS_POLISEMICOS) {
    ok(!pidePresentacionTabular(q), `precondición: NO trae disparador positivo, así que el paso 2 no lo salva y llega al paso 3 — ${nota}`);
    ok(!prohibeFormaTabular(q), `el corte de MODO es lo único que lo salva, y aguanta (${nota}): «${q}»`);
    ok(resolveTablePolicy({ text: q, podado: [] }) === "auto", `→ auto: el reclamo del polisémico no prohíbe nada: «${q.slice(0, 44)}…»`);
  }

  // (c) LA OTRA CARA · el subjuntivo (imperativo negado) SÍ es una orden. ACÁ ESTÁ EL CORTE QUE DEJÓ EL RETIRO, y
  //     se escribe partido en dos con los valores REALES, no aflojado a un «!== algo».
  console.log("  ·· SIGUEN BLOQUEANDO: el verbo negado y los polisémicos (las familias que quedaron)");
  const SIGUEN_SIENDO_ORDENES = [
    ["No me copies el cuadro otra vez.", "copiar · subjuntivo, sobre un polisémico sin pedido positivo"],
    ["No me pongas ningún cuadro, decime nomás.", "poner · subjuntivo, sobre `cuadro`"],
    ["Evitá las columnas, quiero leerlo de corrido.", "«evitá» + polisémico"],
    ["No me tabules nada, contame nomás.", "el VERBO negado en subjuntivo"],
    ["Nada de tabular, hablame nomás.", "«nada de» + INFINITIVO del verbo"],
    ["Contámelo sin tabular.", "«sin» + INFINITIVO del verbo"],
  ];
  for (const [q, nota] of SIGUEN_SIENDO_ORDENES) {
    ok(resolveTablePolicy({ text: q, podado: [] }) === "forbidden", `la orden REAL se sigue bloqueando (${nota}) → forbidden: «${q.slice(0, 44)}…»`);
  }
  console.log("  ·· EL LÍMITE ABIERTO (E3.t3): las MISMAS órdenes sobre el sustantivo inequívoco ya no bloquean");
  // Cada una lleva el valor REAL de hoy. `auto` cuando no hay disparador positivo; `required` cuando el turno trae
  // uno (y entonces el paso 2 lo entrega tabulado). Ninguna se borró: todas siguen acá, midiendo el defecto.
  const YA_NO_SON_ORDENES = [
    ["No me armes la tabla, contame nomás.", "auto", "armar · subjuntivo"],
    ["No me armés ninguna tabla, hablame nomás.", "auto", "armar · subjuntivo voseo"],
    ["No me muestres la tabla, explicámelo.", "auto", "mostrar · subjuntivo"],
    ["No me repitas la tabla del mes pasado.", "auto", "repetir · subjuntivo"],
    ["No me incluyas ninguna tabla.", "auto", "incluir · subjuntivo"],
    ["No me pongas ninguna planilla, decime nomás.", "auto", "poner · subjuntivo, sobre `planilla`"],
    ["No me uses tablas para esto.", "auto", "usar · subjuntivo"],
    ["No me hagas una tabla, contámelo.", "auto", "hacer · subjuntivo"],
    ["No me des la tabla, explicámelo.", "auto", "dar · subjuntivo"],
    ["No vuelvas a mostrar la tabla, por favor.", "auto", "«no vuelvas A» + INFINITIVO"],
    ["Explicalo sin repetir la tabla: cuál fue el peor mes.", "required", "«sin» + INFINITIVO, con disparador positivo pegado"],
    ["Olvidate de armar una tabla: quiero entender la composición.", "required", "«olvidate de» + INFINITIVO, con disparador pegado"],
    ["Ni se te ocurra darme una tabla con el mix.", "required", "«ni se te ocurra» + INFINITIVO enclítico, con disparador pegado"],
  ];
  for (const [q, esperado, nota] of YA_NO_SON_ORDENES) {
    ok(resolveTablePolicy({ text: q, podado: [] }) === esperado, `la orden REAL ya NO se bloquea → ${esperado} (${nota}): «${q.slice(0, 44)}…»`);
  }
  const rOrden = e2e("No me tabules nada, contame nomás qué pasó mes a mes.");
  ok(rOrden.tp === "forbidden" && rOrden.sellada === "forbidden", "y por el camino real la prohibición VIVA sigue viajando sellada");
  ok(!!rOrden.payload.instruccion_sin_tabla && kinds(rOrden.guard).includes("tabla-no-autorizada"), "…hasta guardC, que sigue bloqueando la tabla que el usuario prohibió de verdad");
}

/* ══ 11 · «MATRIZ» ES UNA PALABRA DEL NEGOCIO · límite DECLARADO, no un olvido (revisión adversarial 2) ══════════
 * `matriz|matrices` estaba en `_TABLA_N_PARTE` (los polisémicos). El guard de polisemia sólo salva el turno si hay
 * un disparador POSITIVO de tabla en el mismo mensaje; sin él, «matriz» negada prohibía. Y la polisemia real de
 * esta palabra no es la que se había previsto: HACIA AFUERA nombra objetos del negocio que no tienen nada que ver
 * con la presentación —«la matriz» es la CASA MATRIZ frente a las filiales, «matriz de riesgo/FODA/BCG» es un
 * documento—. MEDIDO antes del fix: «Dame las ventas de las filiales, sin la matriz.» → forbidden (base 2b062cc:
 * `auto`) y guardC devolvía `tabla-no-autorizada` sobre una lista que el narrador tabularía.
 * SE RESOLVIÓ POR REVERSIÓN, y se declara: la palabra salió del enum. Ante ambigüedad, este eje SE ABSTIENE. El
 * costo está abajo, escrito como prueba y no como comentario. Es el MISMO criterio —y la misma dirección— con que
 * el owner retiró después la lista entera del sustantivo inequívoco; este bloque es su precedente. */
console.log("\n══ 11 · «MATRIZ» ES DEL NEGOCIO ANTES QUE DE LA FORMA · reversión declarada, con su costo medido ══");
{
  const TABLA = "| Filial | Venta |\n| --- | --- |\n| Norte | $4.9M |";
  const CORRECTOS = [
    ["Dame las ventas de las filiales, sin la matriz.", "«la matriz» = la CASA MATRIZ, no una forma de respuesta"],
    ["Dame el consolidado sin la matriz de riesgo del área legal.", "«matriz de riesgo» = un documento ajeno a la respuesta"],
    ["¿Cuánto factura la matriz frente a las filiales?", "sin negación: nunca tuvo que moverse, y sigue sin moverse"],
    ["Contame el resultado sin la matriz FODA que hizo comercial.", "otro documento del negocio"],
  ];
  for (const [q, nota] of CORRECTOS) {
    ok(!prohibeFormaTabular(q), `«matriz» ya no se lee como forma — ${nota}: «${q.slice(0, 46)}…»`);
    ok(resolveTablePolicy({ text: q, podado: [] }) === "auto", `→ auto, como en la base 2b062cc (antes del fix: forbidden): «${q.slice(0, 46)}…»`);
    const v = guardC(TABLA, { ledger: { figs: FIGS }, results: RESULTS, question: q, tablePolicy: resolveTablePolicy({ text: q, podado: [] }) });
    ok(!kinds(v).includes("tabla-no-autorizada"), `…y guardC ya no bloquea la lista que el narrador tabularía: «${q.slice(0, 46)}…»`);
  }
  // EL COSTO DE LA REVERSIÓN, declarado como chequeo para que no se pueda olvidar: la prohibición escrita CON esa
  // palabra ya no se detecta. Es un falso NEGATIVO elegido —cuesta un turno de más— frente a un falso POSITIVO que
  // rompía turnos correctos. Si algún día alguien quiere recuperarlo, que sea con un contexto de forma explícito y
  // con este chequeo poniéndose rojo, no en silencio.
  ok(resolveTablePolicy({ text: "Nada de matrices, contame qué está pasando.", podado: [] }) === "auto",
    "COSTO DECLARADO: «nada de matrices» ya no prohíbe (falso negativo elegido — la palabra es del negocio antes que de la forma)");
  // y la pinza: el polisémico que NO tiene esa segunda vida sigue prohibiendo igual que antes.
  ok(resolveTablePolicy({ text: "Nada de cuadros, contame qué está pasando.", podado: [] }) === "forbidden", "…y sacar `matriz` no vació el enum: «nada de cuadros» sigue prohibiendo");
  ok(resolveTablePolicy({ text: "Evitá las columnas, quiero leerlo de corrido.", podado: [] }) === "forbidden", "…ni «evitá las columnas»");
  ok(resolveTablePolicy({ text: "Mostrame la tabla mes a mes, sin la matriz de correlación.", podado: [] }) === "required", "y la tabla pedida con una matriz negada al lado sigue entregándose");
}

/* ══ 12 · LA CARA QUE FALTABA · LOS 14 RECLAMOS QUE NO DEBEN PROHIBIR ═══════════════════════════════════════════
 * ESTE ES EL VALOR QUE QUEDA. La lista `_negaciones(_TABLA_N_FORMA)` se retiró porque producía 14 falsos positivos
 * MEDIDOS de la peor clase: `tabla-no-autorizada` contra una tabla que el usuario estaba RECLAMANDO porque faltó.
 * Un gate que sólo borrara las aserciones muertas dejaría el retiro sin custodia y el defecto podría volver en
 * silencio. Acá los 14 se afirman EN POSITIVO y de forma PERMANENTE, en los tres puntos donde el daño era visible:
 * el detector, la política y guardC.
 *
 * MORDIDA VERIFICADA (no mental): se restauró `..._negaciones(_TABLA_N_FORMA)` en `_PROHIBE_FORMA` sobre una COPIA
 * del src FUERA del repo y se corrió este mismo gate contra ella. Los 14 pasan de {required×6, auto×8} a
 * `forbidden`×14, `prohibeFormaTabular` da true en los 14 y guardC devuelve `tabla-no-autorizada` en los 14: CAEN
 * LAS 48 ASERCIONES DE CONDUCTA de este bloque (las 17 que sobreviven son las que miden `pidePresentacionTabular`,
 * que por diseño no depende de esa línea — son las que prueban el reparto 6/8).
 * Y el reparto de la mordida es el correcto: bajo la reversión sólo se mueven los bloques del LÍMITE (1, 2-perdidos,
 * 5-límite, 7 y 10c) y el 12. Los bloques 1-bis, 3, 4, 6, 7-bis, 8, 9, 10a/10b/10b-bis y 11 —todo lo que este gate
 * CONSERVA— quedaron IDÉNTICOS: ninguna capacidad que se certifica acá depende de la línea retirada, y ninguna
 * afirmación del bloque 12 sobrevive si la línea vuelve.
 *
 * Y SE PRUEBA LA RAZÓN POR LA QUE NO ALCANZA CON MOVERLA AL PASO 3, que es la parte que el src afirma y que un
 * comentario no puede sostener solo: el paso 2 sólo exonera al turno que ADEMÁS pide la tabla en positivo, y
 * `pidePresentacionTabular` reconoce el pedido en 6 de los 14. Los otros 8 seguirían prohibidos sin haberlo pedido.
 * El conteo 6/8 se MIDE abajo; si el detector positivo mejorara hasta reconocer los 14, el chequeo se pondría rojo
 * y esa es exactamente la señal de que la lista podría volver. */
console.log("\n══ 12 · LA CARA NUEVA · los 14 RECLAMOS de una tabla que faltó NO pueden leerse como prohibición ══");
{
  // Los 14, con el valor REAL de hoy y la familia de negación que los agarraba antes del retiro.
  //   `posit` = lo que ve `pidePresentacionTabular`: es lo que decide si el paso 2 los salvaría o no.
  const RECLAMOS = [
    ["Me quedé sin la tabla mes a mes, ¿la rehacés?", "required", true, "«sin» + DET + tabla · citado en el src"],
    ["Me dejaste sin la tabla por marca, ¿la armás de nuevo?", "required", true, "«sin» + DET + tabla"],
    ["No me diste ni la tabla ni el detalle, ¿los agregás?", "required", true, "«ni» + DET + tabla"],
    ["No quiero la tabla resumida, quiero la completa.", "required", true, "«no quiero» + tabla · citado en el src"],
    ["No quiero la tabla de ventas, quiero la de margen.", "required", true, "«no quiero» + tabla"],
    ["¿Por qué evitaste la tabla mes a mes?", "required", true, "«evit\\w*» abierto agarraba el INDICATIVO «evitaste»"],
    ["Nos quedamos sin la tabla del trimestre, ¿la podés mandar?", "auto", false, "«sin» + DET + tabla · el caso HUÉRFANO citado en el src"],
    ["Quedé sin la planilla que me pasaste, ¿me la reenviás?", "auto", false, "«sin» + DET + planilla"],
    ["La respuesta vino sin la tabla que te pedí.", "auto", false, "«sin» + DET + tabla, en indicativo puro"],
    ["Se cortó y quedé sin la grilla de precios, ¿la repetís?", "auto", false, "«sin» + DET + grilla"],
    ["No llegó ni la tabla, ¿me la mandás?", "auto", false, "«ni» + DET + tabla · citado en el src"],
    ["No vino ni una tabla en la respuesta anterior.", "auto", false, "«ni una» + tabla"],
    ["Evitaste la planilla completa y era justo la que servía.", "auto", false, "«evit\\w*» + planilla"],
    ["Me quedé sin la tabla del mes pasado, ¿me la volvés a pasar?", "auto", false, "«sin» + DET + tabla"],
  ];
  ok(RECLAMOS.length === 14, `son los 14 falsos positivos medidos, ni uno menos (${RECLAMOS.length})`);
  for (const [q, esperado, , familia] of RECLAMOS) {
    ok(!prohibeFormaTabular(q), `NO es una prohibición, es un RECLAMO de la tabla que FALTÓ (${familia}): «${q.slice(0, 46)}…»`);
    ok(resolveTablePolicy({ text: q, podado: [] }) === esperado, `→ ${esperado}, nunca forbidden: «${q.slice(0, 46)}…»`);
    const v = guardC(TABLA_MD, { ledger: { figs: FIGS }, results: RESULTS, question: q, tablePolicy: resolveTablePolicy({ text: q, podado: [] }) });
    ok(!kinds(v).includes("tabla-no-autorizada"), `…y guardC NO bloquea con \`tabla-no-autorizada\` la tabla RECLAMADA (el daño peor, medido en su punto exacto): «${q.slice(0, 40)}…»`);
  }

  // POR QUÉ NO ALCANZA CON MOVER LA LISTA AL PASO 3 · el conteo, medido y no citado.
  const reconocidos = RECLAMOS.filter(([q]) => pidePresentacionTabular(q));
  const huerfanos = RECLAMOS.filter(([q]) => !pidePresentacionTabular(q));
  ok(reconocidos.length === 6, `el paso 2 sólo exonera al turno que ADEMÁS pide la tabla en positivo, y \`pidePresentacionTabular\` reconoce ${reconocidos.length} de los 14 (el src dice 6)`);
  ok(huerfanos.length === 8, `→ los otros ${huerfanos.length} seguirían PROHIBIDOS si la lista sólo se moviera al paso 3: mover no es arreglar`);
  for (const [q, , posit, familia] of RECLAMOS) {
    ok(pidePresentacionTabular(q) === posit, `y el reparto es estable, caso por caso (posit=${posit}, ${familia}): «${q.slice(0, 40)}…»`);
  }

  // EL CAMINO REAL, en un huérfano y en un reconocido: el falso positivo no se medía en el detector, se medía en
  // el contrato, en el payload del narrador y en guardC. Acá se cierra en los tres.
  const HUERFANO = "Nos quedamos sin la tabla del trimestre, ¿la podés mandar?";
  const rh = e2e(HUERFANO);
  ok(rh.tp === "auto" && rh.sellada === "auto", "el HUÉRFANO viaja `auto` sellado: el narrador queda libre de tabular lo que le reclaman");
  ok(!rh.payload.instruccion_sin_tabla, "…y NO se le manda `instruccion_sin_tabla` (era la orden de negarle al usuario justo lo que pedía)");
  ok(!kinds(rh.guard).includes("tabla-no-autorizada"), "…y guardC deja pasar la tabla reclamada");
  const RECONOCIDO = "No quiero la tabla resumida, quiero la completa.";
  const rr = e2e(RECONOCIDO);
  ok(rr.tp === "required" && rr.sellada === "required", "el RECONOCIDO viaja `required` sellado: se le entrega la tabla completa que pidió");
  ok(!!rr.payload.instruccion_tabla && !rr.payload.instruccion_sin_tabla, "…al narrador le llega TABULAR, no la contraria");
  ok(!kinds(rr.guard).includes("tabla-no-autorizada"), "…y guardC no la bloquea");
}

console.log(`\n${PASS} ok · ${FAIL} fallos`);
process.exit(FAIL ? 1 : 0);
