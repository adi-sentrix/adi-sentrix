/* === _forma_manda_sobre_el_alcance_gate.mjs · PEDIR MENOS NO PUEDE DEVOLVER DOCE FILAS =========================
 * LOCAL, NO commiteado (convención del repo: _*_gate.mjs es local). CERO red, CERO LLM: callPlan/callNarrate van
 * MOCKEADOS a mano y el BATCH corre REAL contra el dataset demo.
 *
 * ══ EL LÍMITE QUE ESTE GATE DECLARABA ABIERTO QUEDÓ CERRADO (owner 2026-08-11) ════════════════════════════════
 * HISTORIA, porque explica por qué la sección 4-b cambió dos veces: primero se retiró
 * `..._negaciones(_TABLA_N_FORMA)` de `_PROHIBE_FORMA` por 14 falsos positivos medidos —`tabla-no-autorizada`
 * contra una tabla que el usuario RECLAMABA porque faltó—, y este gate pasó a afirmar la consecuencia:
 * «solo la cifra, nada de tablas» SALÍA CON TABLA, declarado como E3.t3 abierto.
 * AHORA HAY UNA DECISIÓN DE PRODUCTO que resuelve la tensión sin volver al falso positivo: «solo la cifra, nada
 * de tablas» debe responder con la cifra en una ORACIÓN NATURAL BREVE, sin tabla y sin análisis. Y la precedencia
 * quedó fijada: la instrucción explícita del turno manda sobre la herramienta, el formato anterior y los
 * disparadores implícitos; el respaldo determinístico sólo prohíbe ante una orden INEQUÍVOCA y, ante un reclamo,
 * cae a `auto` y deja decidir al PLAN. Por eso los 14 reclamos siguen recibiendo su tabla Y el turno que prohíbe
 * recibe su prosa: no son la misma clase de frase, y ahora el motor las distingue por tiempo y modo verbal.
 * QUÉ EXPECTATIVA CAMBIÓ EN LA SECCIÓN 4-B: afirmaba «sale con tabla» y ahora afirma «sale sin tabla, con la
 * cifra en línea». Cambió porque contradecía la precedencia aprobada, no porque el gate estorbara.
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
import { resolveTablePolicy, resolveOutputForm } from "./src/adi/oracle/progressiveDisclosure.js";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";

// vía 1 (2026-08-20): el dataset se DECLARA acá. Antes se heredaba del import por defecto de tenantStore,
// que ya no existe: el store arranca en la forma vacía y el dato entra por initTenant. Ver tenantEmpty.js.
initTenant(TENANT_DEMO);

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
/* RE-CERTIFICADO (owner 2026-08-12, punto 3). Estas seis afirmaban «data_only ⇒ TABLA». Lo que el gate defiende es
 * que una restricción puramente NEGATIVA no cambia el ALCANCE —sigue siendo data_only y el narrador libre nunca se
 * invoca—, y eso no se movió ni un milímetro. Lo que cambió es la FORMA con la que ese alcance se sirve: el owner
 * la fijó explícita —«data_only: cifra, entidad y período en una oración breve»— porque doce filas eran la respuesta
 * más larga que el motor sabe emitir para alguien que acababa de pedir MENOS.
 * Las dos condiciones que importan se conservan y se aprietan: el narrador sigue sin invocarse (garantía por
 * construcción) y la cifra autorizada sigue estando. Sólo se cambia la que medía la forma vieja. */
for (const q of SIGUEN_SIENDO_DATO) {
  const { texto, narrado } = await turno(q);
  ok(narrado === 0, `«${q}» SIGUE siendo data_only — el narrador libre nunca se invoca`, `narrado=${narrado}`);
  ok(!HAY_TABLA.test(texto), `…y ya no responde con doce filas a quien pidió menos`, JSON.stringify(texto.slice(0, 80)));
  ok(/\$[\d.,]+|\d+[.,]\d+\s*(?:%|pts)|\d+%/.test(texto), `…pero la cifra autorizada sigue estando en «${q}»`, JSON.stringify(texto.slice(0, 80)));
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
// ── RE-CERTIFICADO POR DECISIÓN DE PRODUCTO (owner 2026-08-11) ───────────────────────────────────────────────
// QUÉ EXPECTATIVA CAMBIÓ, y por qué: este bloque afirmaba que «solo la cifra, nada de tablas» SALÍA CON TABLA, y
// lo declaraba como límite abierto (E3.t3). El owner definió la conducta: «debe responder con la cifra en una
// oración natural breve, sin tabla y sin análisis adicional». O sea que la expectativa vieja contradice la
// precedencia aprobada —la instrucción explícita del turno manda sobre la presentación que sugiere la
// herramienta— y por eso se cambia, no porque el gate estorbara.
// LOS DOS EJES SE RESPETAN A LA VEZ, que es lo que hace correcta la conducta nueva: `data_only` decide el ALCANCE
// (sólo el dato, sin análisis) y `outputForm` decide la FORMA (sin tabla). La cifra NO se pierde: sale en línea.
// LO QUE NO CAMBIA: la garantía por construcción del alcance restringido —el narrador libre no se invoca— sigue
// afirmada abajo sin tocar, y el control de que `data_only` SIN orden de forma sigue tabulando también.
const CIFRA_EN_LINEA = /Ventas del período:\s*\$/;
for (const q of ["dame solo las cifras, sin tabla", "solo la cifra, nada de tablas"]) {
  ok(resolveOutputForm({ plan: { pref: {} }, text: q }) === "prosa", `LA CAUSA: «${q}» resuelve outputForm=prosa — la prohibición inequívoca es el primer escalón de la precedencia`, resolveOutputForm({ plan: { pref: {} }, text: q }));
  const { texto, narrado } = await turno(q, PLAN_DATA);
  ok(!HAY_TABLA.test(texto), `E3.t3 CERRADO: «${q}» ya NO sale con tabla — se respeta la forma que el turno negó`, JSON.stringify(texto.slice(0, 70)));
  ok(CIFRA_EN_LINEA.test(texto), `…y la cifra autorizada sigue estando, ahora en una oración breve: «${q}»`, JSON.stringify(texto.slice(0, 70)));
  ok(narrado === 0, `…y la garantía POR CONSTRUCCIÓN del alcance restringido queda entera igual: el narrador libre nunca se invoca en «${q}»`, narrado);
}
// control: el mismo alcance restringido SIN orden de forma sigue tabulando exactamente como siempre.
{
  const { texto, narrado } = await turno("dame solo los datos del período", PLAN_DATA);
  // MISMO RE-CERTIFICADO que el bloque (a): el control ya no puede exigir la tabla, porque la forma de `data_only`
  // dejó de ser tabular por decisión. Lo que el control existe para proteger —que sin orden de forma el alcance NO
  // invoque al narrador y la cifra llegue igual— se conserva entero.
  ok(narrado === 0, "control: data_only sin ninguna orden de forma sigue sin invocar al narrador", `narrado=${narrado}`);
  ok(/\$[\d.,]+|\d+[.,]\d+\s*(?:%|pts)|\d+%/.test(texto), "…y sigue devolviendo la cifra autorizada", JSON.stringify(texto.slice(0, 80)));
}

console.log(`\n── _forma_manda_sobre_el_alcance_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
