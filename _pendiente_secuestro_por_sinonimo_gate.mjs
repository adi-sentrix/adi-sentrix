/* === _pendiente_secuestro_por_sinonimo_gate.mjs · LA RAMA (a) DEL PENDIENTE TAMBIÉN FALLA CERRADA ============
 * LOCAL, NO commiteado (convención del repo: _*_gate.mjs es local). CERO red, CERO LLM: callPlan/callNarrate van
 * MOCKEADOS a mano y el BATCH corre REAL contra el dataset demo — mismo patrón que _pendiente_pertinencia_gate.mjs.
 *
 * EL DEFECTO QUE PROTEGE (medido, con atribución contra el árbol sin el guard). El guard de pertinencia tiene dos
 * ramas: (a) el turno NOMBRA la variable que falta, (b) el turno es una respuesta PELADA. La rama (b) se decidía
 * por lista blanca y fallaba CERRADA. La rama (a) era `_VOCAB_FALTANTE[missing].test(texto)` — o sea CONTIENE la
 * palabra, sin importar de QUIÉN es ese precio o esa cantidad — y fallaba ABIERTA. Resultado: el defecto que
 * motivó todo el arreglo seguía alcanzable A UN SUSTANTIVO DE DISTANCIA. Repro exacto, el mismo de la
 * certificación cambiando UNA palabra:
 *   t1 «Suben 7% las unidades de Samsung.»       → ADI pregunta por el precio, queda el pendiente
 *   t2 «¿Qué margen tiene Sodimac?»              → paréntesis legítimo, el pendiente sobrevive
 *   t3 «y si el PRECIO del flete sube 4%, ¿cambia algo?»
 * Con «costo de flete» devolvía null (bien). Con «precio del flete» volvía a ejecutar simulateGeneral y a imprimir
 * la tabla sellada de Samsung con un supuesto de precio que el usuario nunca dio. 9/9 secuestros medidos con el
 * mismo patrón: precio del flete (a t+1 y a t+2), tarifa de flete, precio del combustible, precio del dólar,
 * precios de la competencia, cantidad de clientes activos, cantidad de días de stock, volumen de importaciones del
 * país. El fix protegía la FRASE certificada y no la CLASE.
 *
 * LO QUE AFIRMA, que es la REGLA y no el caso: nombrar la variable que falta NO alcanza. El turno tiene que ser
 * una respuesta pelada UNA VEZ QUE SE LE SACA ESE NOMBRE. Se podan del texto (1) el vocabulario de la variable
 * faltante y (2) los nombres de las entidades DEL PROPIO pendiente —hablar de la entidad que ya está en la mesa no
 * introduce ningún sujeto nuevo— y lo que queda pasa por la MISMA lista blanca cerrada de la rama (b). No hay
 * lista negra de métricas ajenas en ninguna parte: cualquier sustantivo que no sea la variable faltante ni la
 * entidad del pendiente frena el turno, se llame flete, combustible, dólar, competencia, clientes activos, días de
 * stock o importaciones. Ésa es la diferencia entre cerrar el repro y cerrar la clase.
 *
 * LAS DOS CARAS, las dos obligatorias:
 *   · sección 1 · LOS 9 SECUESTROS, cada uno contra el eje que lo hace peligroso → ninguno resuelve.
 *   · sección 2 · el sinónimo de volumen CON UN SUJETO AJENO pegado → tampoco resuelve (es la prueba de que
 *     ampliar el vocabulario no reabrió nada).
 *   · sección 3 · LAS RESPUESTAS LEGÍTIMAS → siguen resolviendo, incluidos los SIETE sinónimos de volumen que
 *     antes se perdían («las ventas caen 3%», «la demanda baja 4%», «se vende 5% menos», «vendemos 3% menos»,
 *     «salida 4% menor», «la rotación baja 3%», «que las ventas suban 2%») y la respuesta que nombra la variable
 *     JUNTO A LA ENTIDAD PROPIA («el volumen de Samsung baja 2%»). Ésta es la mitad que impide que el cierre se
 *     pague con turnos correctos, y es la mitad que faltaba en la pasada anterior.
 *   · sección 4 · EL COSTO EXACTO DEL GUARD, medido en el mismo run: el barrido de 30 respuestas plausibles da el
 *     MISMO número de resoluciones con guard que sin él. El guard no cuesta ni una respuesta legítima.
 *
 * MUTACIÓN QUE LO PONE EN ROJO: devolver la rama (a) a `if (propio && propio.test(s)) return true;` (sin la poda).
 * La sección 1 cae entera (9 de 9) y la 2 con ella.
 * MUTACIÓN DE ACOTAMIENTO: sacar la poda de `propias` (las entidades del pendiente) → cae «el volumen de Samsung
 * baja 2%» en la sección 3. Sacar los sinónimos de volumen del vocabulario → caen 7 de la sección 3.
 *
 * @inyeccion-simulada — este gate le pasa a `answerViaOracle` sus DOS pasadas (PLAN y NARRAR) como funciones
 * locales definidas en este mismo archivo. No importa el gateway ni un adapter, no importa nada de `src/ui/` y no
 * contiene una salida cruda. Cumple las cuatro condiciones del escape declarado en scripts/gates-offline.mjs.
 */
import { answerViaOracle } from "./src/adi/oracle/answerViaOracle.js";

let pass = 0, fail = 0;
const ok = (cond, label, detail) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label}${detail !== undefined ? ` — obtuvo ${detail}` : ""}`); }
};
const seccion = (t) => console.log(`\n── ${t} ──`);

// narraciones SEGURAS y DISTINTAS entre sí: guardC marca `degraded` cuando un turno repite verbatim un tramo largo
// de una narración propia reciente, así que reusar el mismo texto envenenaría el arnés.
let _nSafe = 0;
const SAFES = [
  "Ese frente no muestra desvíos que ameriten una alerta en este momento.",
  "La lectura general del período no cambia respecto de lo que ya veníamos conversando.",
  "Sin novedades relevantes en ese ángulo del negocio durante el período consultado.",
  "El comportamiento observado se mantiene dentro de lo esperable para esa cuenta.",
  "No aparece ninguna señal que obligue a mover una decisión el día de hoy.",
  "Ese punto no altera la prioridad que ya habíamos identificado en la conversación.",
];
const safe = () => SAFES[_nSafe++ % SAFES.length];

async function turno({ text, mem = {}, plan }) {
  let planVisto = null;
  const r = await answerViaOracle({
    text, history: [], mem, scenario: "actual",
    callPlan: async () => plan || { intent: "answer", mode: "default", calls: [] },
    callNarrate: async (a) => { planVisto = a.plan; return safe(); },
  });
  if (r) r.__plan = planVisto;
  return r;
}
// el ÚNICO observable que importa: ¿se ejecutó la simulación pendiente sin que el usuario la contestara?
const simArgs = (r) => {
  const p = r && r.__plan;
  const c = p && Array.isArray(p.calls) && p.calls.find((x) => x && x.tool === "simulateGeneral");
  return c ? c.args : null;
};
const PAREN = { intent: "answer", mode: "default", scope: { level: "entity", entities: ["Sodimac"] }, calls: [{ tool: "entityProfile", args: { dimension: "cliente", entity: "Sodimac" } }] };

// t1 abre el pendiente; el eje elegido decide CUÁL variable queda faltando.
const FALTA_PRECIO = "Suben 7% las unidades de Samsung.";   // conocido = unidades → falta precioLista
const FALTA_VOLUMEN = "Sube 7% el precio de Samsung.";      // conocido = precio   → falta unidades

async function conversacion(t1, respuesta, { conParentesis = false } = {}) {
  const a = await turno({ text: t1 });
  let mem = a.mem;
  if (conParentesis) { const b = await turno({ text: "¿Qué margen tiene Sodimac?", mem, plan: PAREN }); mem = b.mem; }
  const c = await turno({ text: respuesta, mem });
  return simArgs(c);
}

// ════════════════════════════════════════════════════════════════════════════════════════════════════════════
seccion("1 · LOS 9 SECUESTROS · un % pegado a un sujeto que NO es la variable faltante NO resuelve");
{
  // eje PRECIO faltante: el vocabulario de precioLista aparece en la oración, pero es el precio DE OTRA COSA.
  for (const q of [
    "y si el precio del flete sube 4%, ¿cambia algo?",
    "y si la tarifa de flete sube 4%, ¿cambia algo?",
    "y si el precio del combustible sube 4%, ¿cambia algo?",
    "¿y si el precio del dólar sube 6%?",
    "¿y si los precios de la competencia bajan 4%?",
  ]) {
    const s = await conversacion(FALTA_PRECIO, q);
    ok(s === null, `falta el PRECIO y el % es de otro sujeto → NO resuelve: «${q}»`, JSON.stringify(s));
  }
  // el repro del revisor en su forma exacta: a DOS turnos, con un paréntesis legítimo en el medio.
  {
    const s = await conversacion(FALTA_PRECIO, "y si el precio del flete sube 4%, ¿cambia algo?", { conParentesis: true });
    ok(s === null, "el MISMO secuestro a t+2, con el paréntesis de Sodimac en el medio → NO resuelve", JSON.stringify(s));
  }
  // eje VOLUMEN faltante: idem con "cantidad"/"volumen" de otra cosa.
  for (const q of [
    "¿y si la cantidad de clientes activos baja 5%?",
    "¿y si la cantidad de días de stock sube 8%?",
    "el volumen de importaciones del país cae 9%",
  ]) {
    const s = await conversacion(FALTA_VOLUMEN, q);
    ok(s === null, `falta el VOLUMEN y el % es de otro sujeto → NO resuelve: «${q}»`, JSON.stringify(s));
  }
  // el repro certificado original sigue cerrado (no se cambió una cosa por otra).
  {
    const s = await conversacion(FALTA_VOLUMEN, "y si el costo de flete sube 4%, ¿cambia algo?", { conParentesis: true });
    ok(s === null, "el repro certificado ORIGINAL («costo de flete», a t+2) sigue cerrado", JSON.stringify(s));
  }
}

// ════════════════════════════════════════════════════════════════════════════════════════════════════════════
seccion("2 · AMPLIAR EL VOCABULARIO NO REABRE NADA · el sinónimo con un sujeto ajeno pegado tampoco resuelve");
{
  // Esto es lo que hace HONESTA la ampliación de la sección 3: los sinónimos de volumen entraron al vocabulario,
  // y aun así siguen frenados cuando el % viaja pegado a un sujeto que no es el del pendiente.
  for (const q of [
    "las ventas de la competencia caen 3%",
    "la demanda del mercado total baja 4%",
    "la rotación del proveedor baja 3%",
    "las ventas del canal mayorista suben 2%",
    "el volumen de importaciones cae 9%",
  ]) {
    const s = await conversacion(FALTA_VOLUMEN, q);
    ok(s === null, `sinónimo de volumen + sujeto AJENO → NO resuelve: «${q}»`, JSON.stringify(s));
  }
}

// ════════════════════════════════════════════════════════════════════════════════════════════════════════════
seccion("3 · LA MITAD CARA · las respuestas legítimas siguen resolviendo (y siete que ANTES se perdían)");
{
  for (const q of ["el volumen baja 2%", "las unidades caen 6%", "las cantidades bajan 4%", "baja 3%", "-2%",
    "que suba un 5%", "no cambia", "un 4% menos", "supongamos que sube 6%", "yo diría 3% menos", "poné 3% menos",
    "y si baja 6%", "sin cambios en el volumen", "estimo 3% menos de volumen", "el volumen de ventas cae 2%"]) {
    const s = await conversacion(FALTA_VOLUMEN, q);
    ok(!!s, `RESUELVE (falta volumen) «${q}»`, JSON.stringify(s));
  }
  // los SIETE sinónimos que el residual medido daba por perdidos: todos contestan literalmente la pregunta que
  // ADI hizo («¿cuánto esperás que cambie el volumen o las unidades vendidas?»).
  for (const q of ["las ventas caen 3%", "la demanda baja 4%", "se vende 5% menos", "vendemos 3% menos",
    "salida 4% menor", "la rotación baja 3%", "que las ventas suban 2%"]) {
    const s = await conversacion(FALTA_VOLUMEN, q);
    ok(!!s, `RESUELVE con un SINÓNIMO de volumen «${q}»`, JSON.stringify(s));
  }
  // nombrar la variable JUNTO A LA ENTIDAD PROPIA sigue siendo una respuesta: la entidad ya estaba en la mesa.
  for (const q of ["el volumen de Samsung baja 2%", "las unidades de Samsung caen 6%"]) {
    const s = await conversacion(FALTA_VOLUMEN, q);
    ok(!!s, `RESUELVE nombrando la ENTIDAD PROPIA «${q}»`, JSON.stringify(s));
  }
  // el otro eje, para que la regla no quede probada en una sola dirección.
  for (const q of ["el precio sube 5%", "la lista de precios baja 3%", "sube 4%", "que baje 2%"]) {
    const s = await conversacion(FALTA_PRECIO, q);
    ok(!!s, `RESUELVE (falta precio) «${q}»`, JSON.stringify(s));
  }
  // y a DOS turnos de distancia, con el paréntesis en el medio.
  for (const q of ["el volumen baja 2%", "baja 3%", "no cambia", "las ventas caen 3%"]) {
    const s = await conversacion(FALTA_VOLUMEN, q, { conParentesis: true });
    ok(!!s, `RESUELVE a t+2 «${q}»`, JSON.stringify(s));
  }
}

// ════════════════════════════════════════════════════════════════════════════════════════════════════════════
seccion("4 · EL COSTO DEL GUARD, MEDIDO EN ESTE MISMO RUN · no cuesta ni una respuesta legítima");
{
  /* El residual de la pasada anterior declaraba CUATRO pérdidas; la revisión midió ONCE, siete de ellas causadas
   * por el guard. Acá se fija el número por gate: de las 30 respuestas plausibles del barrido, las únicas que no
   * resuelven son las CINCO que tampoco resolvían con el guard REMOVIDO — o sea las que pierde `extractSignedPct`
   * / `ZERO_EXPLICIT_RE`, que son de otro dueño. Si alguien vuelve a estrechar el guard, este número baja y el
   * gate lo grita en vez de dejarlo en un residual. */
  const CANDIDATAS = [
    "el volumen baja 2%", "las unidades caen 6%", "baja 3%", "-2%", "no cambia", "queda igual",
    "un 4% menos", "que suba un 5%", "supongamos que sube 6%", "yo diría 3% menos", "poné 3% menos",
    "2% arriba", "que caiga un 5%", "digamos 4%", "que no cambie", "sin cambios", "0%",
    "las ventas caen 3%", "la demanda baja 4%", "se vende 5% menos", "vendemos 3% menos",
    "el volumen de ventas cae 2%", "salida 4% menor", "la rotación baja 3%",
    "asumí una caída de 5% en unidades", "que las ventas suban 2%", "estimo 3% menos de volumen",
    "más o menos 5% menos", "creo que baja como 4%", "sin cambios en el volumen",
  ];
  // las CINCO preexistentes, nombradas: no las pierde este guard, las pierde el extractor de porcentaje.
  const AJENAS = new Set(["2% arriba", "que caiga un 5%", "digamos 4%", "que no cambie", "asumí una caída de 5% en unidades"]);
  const perdidas = [];
  for (const q of CANDIDATAS) {
    const s = await conversacion(FALTA_VOLUMEN, q);
    if (!s) perdidas.push(q);
  }
  ok(perdidas.length === AJENAS.size, `el barrido pierde exactamente ${AJENAS.size} de ${CANDIDATAS.length} (las de extractSignedPct/ZERO_EXPLICIT_RE)`, JSON.stringify(perdidas));
  for (const q of perdidas) ok(AJENAS.has(q), `la pérdida «${q}» es una de las declaradas como AJENAS al guard`);
  for (const q of AJENAS) ok(perdidas.includes(q), `la pérdida declarada «${q}» sigue siendo real (el residual no infla la lista)`);
}

console.log(`\n── _pendiente_secuestro_por_sinonimo_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
