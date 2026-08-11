/* === _forma_manda_sobre_el_alcance_gate.mjs · PEDIR MENOS NO PUEDE DEVOLVER DOCE FILAS =========================
 * LOCAL, NO commiteado (convención del repo: _*_gate.mjs es local). CERO red, CERO LLM: callPlan/callNarrate van
 * MOCKEADOS a mano y el BATCH corre REAL contra el dataset demo.
 *
 * ══ LÍMITE DECLARADO ANTES QUE NADA: LA MITAD DE LA SECCIÓN 4 YA NO ES UNA CAPACIDAD ═══════════════════════════
 * Este gate YA NO certifica que la negación de un sustantivo INEQUÍVOCO de forma («sin tabla», «nada de tablas»)
 * le saque la tabla a un turno de alcance restringido. NO LO HACE. El owner retiró `..._negaciones(_TABLA_N_FORMA)`
 * de `_PROHIBE_FORMA` (progressiveDisclosure.js, 2026-08-11) porque producía 14 FALSOS POSITIVOS MEDIDOS de la peor
 * clase: `tabla-no-autorizada` contra una tabla que el usuario RECLAMABA porque faltó («Me quedé sin la tabla mes a
 * mes, ¿la rehacés?»). Moverla al paso 3 salva 6 de 14 — probado, no supuesto. Falso negativo antes que falso
 * positivo: es la doctrina de la casa aplicada contra el propio fix, y el comentario entero está en el src.
 * CONSECUENCIA MEDIDA ACÁ, sin taparla: «dame solo las cifras, sin tabla» y «solo la cifra, nada de tablas» hoy
 * resuelven `auto`, y con el alcance restringido ya fijado por el PLAN SALEN CON TABLA. Es el defecto E3.t3 de la
 * certificación y queda ABIERTO. Abajo (sección 4-b) está afirmado en su VALOR EXACTO de hoy, no aflojado a un
 * «!== forbidden» que dejaría pasar cualquier cosa: el día que el eje se mueva —en cualquier dirección— se ve.
 *
 * LO QUE ESTE GATE SIGUE CUSTODIANDO ENTERO (y es lo que vino a custodiar): la sección 4 nunca fue sobre la lista
 * retirada, fue sobre el ORDEN — que `tablePolicy` se resuelva ANTES de la rama data_only y que la rama tenga un
 * candidato no tabular. Ese orden se prueba igual con las DOS familias de prohibición que SIGUEN VIVAS (reducción
 * de LARGO y pedido de PROSA), en la sección 4-a. Las secciones 1, 2 y 3 no tocan el eje retirado en ningún punto.
 *
 * EL DEFECTO QUE PROTEGE (medido, dos turnos de la corrida pagada): «Ahora solo la conclusión, nada más» y
 * «Resumilo en una frase, sin explicación» devolvían una TABLA. La cláusula de reducción existía —
 * `pideReduccionDeForma` → `tablePolicy: "forbidden"` — y era INERTE en producción por dos motivos que se suman:
 *   (1) CLASIFICACIÓN · la red determinística de answerViaOracle.js leía «nada más» / «sin explicación» como
 *       contentScope="data_only". Una restricción puramente NEGATIVA no nombra ningún dato: es reducción, y la
 *       reducción vive en el eje del LARGO, no en el del ALCANCE.
 *   (2) ORDEN · la rama data_only/results_only resuelve la narración ENTERA desde composeFromLedger (una tabla) y
 *       `tablePolicy` se calculaba TREINTA LÍNEAS DESPUÉS, junto a su consumidor. Una política de forma que se
 *       computa después de que la forma se emitió no gobierna nada.
 *
 * LO QUE AFIRMA, y son las dos caras:
 *   · sección 2 · un pedido de MENOS deja de resolverse como un pedido de DATO PELADO (y por lo tanto deja de
 *     salir en tabla), en ocho redacciones de las tres familias de reducción.
 *   · sección 3 · LOS PEDIDOS LEGÍTIMOS DE SOLO-DATOS SIGUEN DANDO LA TABLA. Ésta es la mitad cara: el defecto
 *     simétrico —quitarle la tabla a quien la pidió— es peor que el original, porque rompe turnos que funcionan.
 *     Incluye el caso que la revisión adversarial midió sobre el detector de otro dueño («dame la tabla mes a
 *     mes, sin la columna de unidades»): acá NO se le quita la tabla, pase lo que pase río arriba.
 *   · sección 4 · cuando el turno es de verdad data_only Y el usuario prohibió la forma tabular, la respuesta sale
 *     con LAS MISMAS cifras autorizadas y sin tabla — y el narrador libre sigue sin invocarse jamás (la garantía
 *     por construcción del alcance restringido queda entera).
 *
 * MUTACIÓN QUE LO PONE EN ROJO: (a) devolverle a `_coercePref` el `else if (_PREF_DATA_ONLY_RE.test(t))` pelado →
 * cae la sección 2. (b) volver a calcular `tablePolicy` después de la rama data_only y sacar el candidato no
 * tabular → cae la sección 4.
 *
 * @inyeccion-simulada — este gate le pasa a `answerViaOracle` sus DOS pasadas (PLAN y NARRAR) como funciones
 * locales definidas en este mismo archivo. No importa el gateway ni un adapter, no importa nada de `src/ui/` y no
 * contiene una salida cruda. Cumple las cuatro condiciones del escape declarado en scripts/gates-offline.mjs.
 */
import { answerViaOracle } from "./src/adi/oracle/answerViaOracle.js";
// Detector puro, importado para que la sección 4-b afirme la CAUSA (`auto`) y no sólo el síntoma (sale tabla). Sin
// esto, un cambio río arriba podría devolver la tabla por otro motivo y el chequeo seguiría verde sin darse cuenta.
import { resolveTablePolicy } from "./src/adi/oracle/progressiveDisclosure.js";

let pass = 0, fail = 0;
const ok = (cond, label, detail) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label}${detail !== undefined ? ` — obtuvo ${detail}` : ""}`); }
};
const seccion = (t) => console.log(`\n── ${t} ──`);

const PLAN = { intent: "answer", mode: "diagnostico", calls: [{ tool: "executiveSummary", args: {} }] };
const PLAN_DATA = { ...PLAN, pref: { contentScope: "data_only" } };
let _n = 0;
const SAFES = [
  "El negocio se mantiene estable este período, sin sobresaltos que merezcan una alerta.",
  "La lectura general del período no cambia respecto de lo que veníamos conversando.",
  "Sin novedades relevantes en ese ángulo del negocio durante el período consultado.",
  "El comportamiento observado se mantiene dentro de lo esperable para esa cuenta.",
  "No aparece ninguna señal que obligue a mover una decisión hoy mismo.",
  "Ese punto no altera la prioridad que ya habíamos identificado antes.",
  "La foto de ese aspecto queda igual que en la revisión anterior del negocio.",
  "Nada en ese frente sugiere un cambio de rumbo en lo inmediato.",
];
async function turno(text, plan = PLAN, mem = {}) {
  let narrado = 0;
  const r = await answerViaOracle({
    text, history: [], mem, scenario: "actual",
    callPlan: async () => plan,
    callNarrate: async () => { narrado++; return SAFES[_n++ % SAFES.length]; },
  });
  return { r, narrado, texto: (r && r.r && r.r.text) || "" };
}
const HAY_TABLA = /\|\s*Concepto\s*\|/;

// ════════════════════════════════════════════════════════════════════════════════════════════════════════════
seccion("1 · LOS DOS TURNOS MEDIDOS · pedir menos ya no devuelve la forma más larga que el motor sabe emitir");
for (const q of ["Ahora solo la conclusión, nada más", "Resumilo en una frase, sin explicación"]) {
  const { texto } = await turno(q);
  ok(!HAY_TABLA.test(texto), `«${q}» NO devuelve una tabla`, JSON.stringify(texto.slice(0, 70)));
}

// ════════════════════════════════════════════════════════════════════════════════════════════════════════════
seccion("2 · LA REGLA, NO LAS DOS FRASES · una restricción NEGATIVA sola nunca fija el ALCANCE");
// Las tres familias de reducción (presupuesto de LARGO · recorte a la CONCLUSIÓN · registro) cruzadas con las
// negaciones que la red determinística sabía leer como data_only. Ninguna de estas ocho está en la certificación.
const REDUCCIONES = [
  "en dos renglones, sin explicación",
  "quedate con lo esencial, nada más",
  "dame el titular en una línea, sin interpretación",
  "resumime el veredicto en una frase y punto.",
  "en tres líneas, no me des contexto",
  "solo lo importante, sin análisis",
  "el titular en dos frases, nada más",
  "en una línea, sin explicación",
];
for (const q of REDUCCIONES) {
  const { texto, narrado } = await turno(q);
  ok(!HAY_TABLA.test(texto), `«${q}» no cae en la rama de tabla`, JSON.stringify(texto.slice(0, 60)));
  ok(narrado === 1, `«${q}» va al narrador con su política de forma, en vez de resolverse como dato pelado`, narrado);
}

// ════════════════════════════════════════════════════════════════════════════════════════════════════════════
seccion("3 · LA OTRA CARA · quien pidió el dato (o la tabla) LO SIGUE RECIBIENDO");
// (a) las restricciones negativas SIN reducción de forma siguen siendo data_only — es la doctrina del owner y
// las 13 frases certificadas dependen de eso.
const SIGUEN_SIENDO_DATO = [
  "dame un resumen ejecutivo, nada mas",
  "dame un resumen ejecutivo, sin análisis",
  "dame un resumen ejecutivo, sin explicacion",
  "dame un resumen ejecutivo, no me des contexto",
  "muestrame la lista y nada mas",
  "dame el margen y punto.",
];
for (const q of SIGUEN_SIENDO_DATO) {
  const { texto, narrado } = await turno(q);
  ok(HAY_TABLA.test(texto) && narrado === 0, `«${q}» SIGUE siendo data_only (tabla, narrador nunca invocado)`, `tabla=${HAY_TABLA.test(texto)} narrado=${narrado}`);
}
// (b) el pedido POSITIVO gana sobre la reducción co-ocurrente: el que nombra la cosa pedida fija el alcance.
for (const q of ["dame solo las cifras en una tabla", "solo el dato, en la tabla de siempre", "dame únicamente los kpis en una tabla"]) {
  const { texto, narrado } = await turno(q);
  ok(HAY_TABLA.test(texto) && narrado === 0, `«${q}» pide el dato EN POSITIVO → tabla`, `tabla=${HAY_TABLA.test(texto)} narrado=${narrado}`);
}
// (c) EL FALSO POSITIVO AJENO · negar una COLUMNA no es negar la TABLA. El detector de prohibición es de otro
// dueño y puede sobre-disparar; el cinturón de este archivo es que un turno que PIDE la tabla no la pierde nunca.
for (const q of ["dame la tabla mes a mes, sin la columna de unidades", "quiero la tabla por marca, sin las columnas de costo", "armá una tabla con el mix, sin columnas de más"]) {
  const { texto } = await turno(q, PLAN_DATA);
  ok(HAY_TABLA.test(texto), `«${q}» conserva la tabla que pidió`, JSON.stringify(texto.slice(0, 60)));
}

// ════════════════════════════════════════════════════════════════════════════════════════════════════════════
seccion("4-a · EL ORDEN · con el alcance restringido YA fijado, la orden de forma del usuario se cumple igual");
// Acá contentScope=data_only lo declara el PLAN (no la red), así que la sección 2 no lo puede explicar: lo único
// que decide es que `tablePolicy` se resuelva ANTES de la rama y que la rama tenga un candidato no tabular.
// LAS DOS FAMILIAS DE PROHIBICIÓN QUE SIGUEN VIVAS, y son las que prueban el ORDEN sin depender del eje retirado:
//   · «en una línea» → paso 4 de resolveTablePolicy (reducción de LARGO, responsePreference.js)
//   · «contámelo en prosa» → paso 3 vía `_PIDE_PROSA` (la forma opuesta nombrada en positivo)
// Que estas dos sigan saliendo sin tabla es exactamente la afirmación original de la sección: el orden se cumple.
const CIFRA = /Ventas del período: \$/;
for (const q of ["dame solo el dato, en una línea", "solo los datos, contámelo en prosa"]) {
  ok(resolveTablePolicy({ text: q, podado: [] }) === "forbidden", `precondición: «${q}» SIGUE resolviendo forbidden (la familia que lo prohíbe no fue retirada)`, resolveTablePolicy({ text: q, podado: [] }));
  const { texto, narrado } = await turno(q, PLAN_DATA);
  ok(!HAY_TABLA.test(texto), `«${q}» sale SIN tabla`, JSON.stringify(texto.slice(0, 70)));
  ok(CIFRA.test(texto), `«${q}» conserva las MISMAS cifras autorizadas (no se pierde el dato por cambiar la forma)`, JSON.stringify(texto.slice(0, 70)));
  ok(narrado === 0, `«${q}» sigue sin invocar al narrador libre — la garantía por construcción queda entera`, narrado);
}

// ════════════════════════════════════════════════════════════════════════════════════════════════════════════
seccion("4-b · RE-CERTIFICADO · EL LÍMITE ABIERTO (E3.t3) · el sustantivo INEQUÍVOCO negado ya no saca la tabla");
// ESTOS DOS CASOS AFIRMABAN «sale SIN tabla». HOY AFIRMAN LO CONTRARIO, QUE ES LO QUE PASA DE VERDAD.
// Ninguno se borró y ninguno se aflojó: se afirma el VALOR EXACTO en los tres ejes (política, forma de salida,
// narrador), así que el día que la lista retirada vuelva —o que el eje se mueva por otro lado— estos chequeos se
// ponen rojos y no hay manera de que el cambio pase en silencio.
// LA CAUSA, medida y no supuesta: sin `..._negaciones(_TABLA_N_FORMA)` en `_PROHIBE_FORMA`, «sin tabla» y «nada de
// tablas» no matchean ninguna familia viva (el verbo `tabular` no está, y `tabla` no es polisémico), el turno
// tampoco trae disparador positivo → `auto`. Con `auto` la rama data_only tabula, que es lo que siempre hizo.
// LA CIFRA NO SE PIERDE, sólo cambia de forma: sale tabulada en vez de en línea. Se afirma en su forma real.
const CIFRA_TABULADA = /\|\s*Ventas del período\s*\|\s*\$/;
for (const q of ["dame solo las cifras, sin tabla", "solo la cifra, nada de tablas"]) {
  ok(resolveTablePolicy({ text: q, podado: [] }) === "auto", `LA CAUSA: «${q}» resuelve auto — la negación del inequívoco ya no la ve nadie (valor real: auto, no forbidden)`, resolveTablePolicy({ text: q, podado: [] }));
  const { texto, narrado } = await turno(q, PLAN_DATA);
  ok(HAY_TABLA.test(texto), `E3.t3 ABIERTO: «${q}» SALE CON TABLA — la forma que el turno negó se entrega igual`, JSON.stringify(texto.slice(0, 70)));
  ok(CIFRA_TABULADA.test(texto), `…y la cifra autorizada sigue estando, tabulada: «${q}»`, JSON.stringify(texto.slice(0, 70)));
  ok(narrado === 0, `…y la garantía POR CONSTRUCCIÓN del alcance restringido queda entera igual: el narrador libre nunca se invoca en «${q}»`, narrado);
}
// control: el mismo alcance restringido SIN orden de forma sigue tabulando exactamente como siempre.
{
  const { texto, narrado } = await turno("dame solo los datos del período", PLAN_DATA);
  ok(HAY_TABLA.test(texto) && narrado === 0, "control: data_only sin ninguna orden de forma sigue devolviendo la tabla de siempre", `tabla=${HAY_TABLA.test(texto)}`);
}

console.log(`\n── _forma_manda_sobre_el_alcance_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
