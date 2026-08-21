/* === _pendiente_pertinencia_gate.mjs · UN % SUELTO NO CONTESTA UNA PREGUNTA QUE NO SE LE HIZO =================
 * LOCAL, NO commiteado (convención del repo: _*_gate.mjs es local). CERO red, CERO LLM: callPlan/callNarrate van
 * MOCKEADOS a mano y el BATCH corre REAL contra el dataset demo — mismo patrón que _pendiente_por_estado_gate.mjs.
 *
 * EL DEFECTO QUE PROTEGE (regresión medida, con atribución contra el árbol base 2b062cc): el ciclo de vida por
 * ESTADO le dio a la simulación pendiente 3 turnos de vida en vez de 1, pero el criterio que decide si un turno la
 * está CONTESTANDO se quedó como estaba — "trae un porcentaje con dirección y no nombra otra entidad conocida".
 * Con un turno de vida eso era casi inalcanzable; con tres, es un camino normal de conversación. Repro exacto:
 *   t1 «Sube 7% el precio de Samsung.»   → ADI pregunta por el volumen, queda el pendiente
 *   t2 «¿Qué margen tiene Sodimac?»      → paréntesis legítimo, el pendiente sobrevive (eso está BIEN)
 *   t3 «y si el costo de flete sube 4%, ¿cambia algo?»
 * En BASE t3 devolvía null (el pendiente ya estaba muerto). Con el TTL, t3 EJECUTABA simulateGeneral(Samsung ·
 * precio +7% · unidades +4%) e imprimía una tabla sellada de diez cifras de Samsung con un supuesto de volumen que
 * el usuario jamás dio. Preguntó por el flete y le contestaron una simulación de Samsung: eso es FABRICAR un
 * supuesto ajeno y atribuirlo a una entidad vieja.
 *
 * POR QUÉ ESTE GATE Y NO LA SECCIÓN 5(c) DEL OTRO: aquella prueba el zombi con el pendiente VENCIDO —o sea justo
 * cuando ya no puede pasar—, así que está verde sin proteger nada. Acá el pendiente está VIVO en TODOS los casos
 * peligrosos, que es el estado en el que pasa 3 de cada 3 turnos nuevos.
 *
 * LO QUE AFIRMA, que es la REGLA y no el caso: resolver un pendiente exige evidencia POSITIVA de que el turno lo
 * está contestando — (a) nombra la variable que falta, o (b) es una respuesta PELADA (el porcentaje y su dirección
 * y nada más). Un porcentaje pegado a cualquier otro sustantivo es un turno nuevo, no una respuesta.
 *
 * LAS DOS CARAS, las dos obligatorias:
 *   · sección 2 · CINCO turnos con % dirigido que NO contestan → ninguno ejecuta, en tres ejes distintos.
 *   · sección 3 · CATORCE respuestas legítimas → las catorce siguen ejecutando, con el pendiente a las tres
 *     edades posibles. Ésta es la mitad que impide que el fix se pague con turnos que hoy funcionan.
 *
 * GENERALIDAD: tres ejes (CLIENTE · SKU · FAMILIA), las dos direcciones de variable faltante (falta el volumen /
 * falta el precio), y los distractores son sustantivos de negocio que NO están en ninguna lista del motor (tipo de
 * cambio, inflación, bonificación, comisión) — porque la regla es una lista BLANCA de vocabulario de respuesta, no
 * una lista negra de métricas que habría que ir completando para siempre.
 *
 * MUTACIÓN QUE LO PONE EN ROJO: borrar la línea `if (!_contestaElSupuestoFaltante(...)) return null;` de
 * answerViaOracle.js:_resolvePendingSimulation. La sección 2 cae entera (5 de 5) y la 4 con ella.
 * MUTACIÓN DE ACOTAMIENTO: quitar el arm (b) (`_esRespuestaPelada`) del criterio → la sección 3 pierde las
 * respuestas peladas. Las dos mitades tienen que estar.
 *
 * @inyeccion-simulada — este gate le pasa a `answerViaOracle` sus DOS pasadas (PLAN y NARRAR) como funciones
 * locales definidas en este mismo archivo. No importa el gateway ni un adapter, no importa nada de `src/ui/` y no
 * contiene una salida cruda. Cumple las cuatro condiciones del escape declarado en scripts/gates-offline.mjs.
 */
import { answerViaOracle } from "./src/adi/oracle/answerViaOracle.js";
import { PENDING_SIM_TTL_TURNOS } from "./src/adi/oracle/conversationScope.js";
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

// narraciones SEGURAS y DISTINTAS entre sí: guardC marca `degraded` cuando un turno repite verbatim un tramo de
// 8+ palabras de una narración propia reciente, así que reusar el mismo texto envenenaría el arnés.
let _nSafe = 0;
const SAFES = [
  "Ese frente no muestra desvíos que ameriten una alerta en este momento.",
  "La lectura general del período no cambia respecto de lo que ya veníamos conversando.",
  "Sin novedades relevantes en ese ángulo del negocio durante el período consultado.",
  "El comportamiento observado se mantiene dentro de lo esperable para esa cuenta.",
  "No aparece ninguna señal que obligue a mover una decisión hoy mismo.",
  "Ese punto no altera la prioridad que ya habíamos identificado antes.",
  "La foto de ese aspecto queda igual que en la revisión anterior del negocio.",
  "Nada en ese frente sugiere un cambio de rumbo en lo inmediato.",
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
const simCall = (r) => {
  const p = r && r.__plan;
  const c = p && Array.isArray(p.calls) && p.calls.find((x) => x && x.tool === "simulateGeneral");
  return c ? c.args : null;
};
// el paréntesis: un turno normal, con scope explícito para que no se lea como corrección de alcance.
const planLectura = (entidad) => ({ intent: "answer", mode: "default", scope: { level: "entity", entities: [entidad] }, calls: [{ tool: "entityProfile", args: { dimension: "cliente", entity: entidad } }] });
// el turno "nuevo": el LLM no pidió ninguna simulación (calls vacío, scope global) — exactamente el plan que
// devolvió el planificador en la corrida medida para «y si el costo de flete sube 4%, ¿cambia algo?».
const planTemaNuevo = { intent: "answer", mode: "default", scope: { level: "global" }, calls: [] };

// ════════════════════════════════════════════════════════════════════════════════════════════════════════════
seccion("1 · PRECONDICIONES · tres ejes, las dos direcciones de variable faltante");
const ESCENARIOS = [
  { eje: "cliente", apertura: "Sube 6% el precio de Sodimac.", entidad: "Sodimac", falta: "unidades", conocida: 6 },
  { eje: "sku", apertura: "Baja 4% las unidades de LG-WASH11KG.", entidad: "LG-WASH11KG", falta: "precioLista", conocida: -4 },
  { eje: "familia", apertura: "Sube 5% el precio de Línea Blanca.", entidad: "Línea Blanca", falta: "unidades", conocida: 5 },
];
const abrir = async (e) => {
  const r = await turno({ text: e.apertura, mem: {}, plan: { intent: "answer", mode: "default", calls: [] } });
  return r;
};
for (const e of ESCENARIOS) {
  const r = await abrir(e);
  const p = r && r.mem.pendingSimulation;
  ok(!!p && p.missingCampo === e.falta && p.known.delta_pct === e.conocida,
    `[${e.eje}] «${e.apertura}» arma el pendiente (falta ${e.falta})`, JSON.stringify(p));
  ok(!!p && p.restan === PENDING_SIM_TTL_TURNOS, `[${e.eje}] nace con el plazo completo`, JSON.stringify(p && p.restan));
}

// ════════════════════════════════════════════════════════════════════════════════════════════════════════════
seccion("2 · EL ZOMBI, CON EL PENDIENTE VIVO · un % que habla de OTRA cosa nunca ejecuta la simulación vieja");
// Los cinco distractores son sustantivos de negocio que ninguna lista del motor nombra: si la regla fuera una
// lista negra de métricas, cualquiera de estos la atravesaría.
const DISTRACTORES = [
  "y si el tipo de cambio sube 3%, ¿cambia algo?",
  "¿y si la inflación del semestre baja 2%?",
  "y si le damos 5% más de bonificación a los mayoristas",
  "la comisión del vendedor sube 1,5%, ¿lo notás?",
  "¿y si el costo de flete sube 4%, cambia algo?",
];
for (const e of ESCENARIOS) {
  for (const d of DISTRACTORES) {
    const r1 = await abrir(e);
    // un paréntesis real en el medio: el pendiente llega VIVO y con un turno menos, que es el estado peligroso.
    const r2 = await turno({ text: "¿qué margen tiene Tottus?", mem: r1.mem, plan: planLectura("Tottus") });
    const vivo = r2 && r2.mem.pendingSimulation;
    const r3 = await turno({ text: d, mem: r2.mem, plan: planTemaNuevo });
    ok(!!vivo && vivo.restan === PENDING_SIM_TTL_TURNOS - 1, `[${e.eje}] precondición: el pendiente llega VIVO al turno del distractor`, JSON.stringify(vivo && vivo.restan));
    ok(!simCall(r3), `[${e.eje}] «${d}» NO ejecuta ninguna simulación de ${e.entidad}`, JSON.stringify(simCall(r3)));
  }
}

// ════════════════════════════════════════════════════════════════════════════════════════════════════════════
seccion("3 · LA OTRA CARA · las respuestas LEGÍTIMAS siguen resolviendo (el fix no se paga con turnos que andan)");
// (a) el turno NOMBRA la variable que falta · (b) el turno es una respuesta PELADA. Catorce redacciones, ninguna
// copiada de los gates existentes salvo las dos que ya estaban certificadas (se conservan a propósito: si el fix
// las rompiera, el gate viejo también caería y este lo diría antes).
const RESPUESTAS_VOLUMEN = [
  "el volumen baja 2%", "las unidades caen 6%", "el volumen sube 3%",
  "las cantidades bajan un 4%", "el volumen no cambia", "el volumen se mantiene",
  "creo que el volumen cae cerca de 8%",
];
const RESPUESTAS_PELADAS = [
  "baja 3%", "sube 4%", "que suba un 5%", "-2%", "no cambia", "queda igual", "y si baja 6%",
  // pronombres y modales SIN contenido: son la forma natural de contestar y no nombran ningún sujeto. Cada uno
  // sale de un barrido de falsos negativos, no de la imaginación — «yo diría 3% menos» se perdía por el "yo".
  "yo diría 3% menos", "más o menos 5% menos", "un 4% menos", "podría bajar 6%", "capaz sube 2%",
];
for (const e of ESCENARIOS.filter((x) => x.falta === "unidades")) {
  for (const t of [...RESPUESTAS_VOLUMEN, ...RESPUESTAS_PELADAS]) {
    const r1 = await abrir(e);
    const r2 = await turno({ text: t, mem: r1.mem });
    const args = simCall(r2);
    ok(!!args && args.variableA.delta_pct === e.conocida && args.variableB.campo === "unidades",
      `[${e.eje}] «${t}» SÍ resuelve — el supuesto ya dado (${e.conocida}%) se conserva`, JSON.stringify(args));
  }
}
// la dirección inversa: falta el PRECIO. El vocabulario propio es otro y el pelado es el mismo.
for (const t of ["el precio sube 5%", "la lista de precios baja 3%", "el precio no cambia", "sube 7%", "baja un 2%"]) {
  const e = ESCENARIOS.find((x) => x.falta === "precioLista");
  const r1 = await abrir(e);
  const r2 = await turno({ text: t, mem: r1.mem });
  const args = simCall(r2);
  ok(!!args && args.variableA.campo === "precioLista" && args.variableB.delta_pct === e.conocida,
    `[sku · falta el precio] «${t}» SÍ resuelve`, JSON.stringify(args));
}

// ════════════════════════════════════════════════════════════════════════════════════════════════════════════
seccion("4 · EL PENDIENTE NO MUERE POR NO SER CONTESTADO · sigue esperando, un turno más viejo");
{
  const e = ESCENARIOS[0];
  const r1 = await abrir(e);
  const r2 = await turno({ text: DISTRACTORES[0], mem: r1.mem, plan: planTemaNuevo });
  const p2 = r2 && r2.mem.pendingSimulation;
  ok(!!p2 && p2.known.delta_pct === e.conocida && p2.restan === PENDING_SIM_TTL_TURNOS - 1,
    "un turno que no lo contesta NO lo abandona: envejece un turno y sigue vivo (§ el paréntesis no es un abandono)", JSON.stringify(p2));
  // …y el turno SIGUIENTE, que sí contesta, lo cierra con el supuesto original intacto.
  const r3 = await turno({ text: "el volumen baja 2%", mem: r2.mem });
  const args = simCall(r3);
  ok(!!args && args.variableA.delta_pct === e.conocida && args.variableB.delta_pct === -2,
    "y la respuesta REAL, un turno después del distractor, cierra la simulación completa", JSON.stringify(args));
}

// ════════════════════════════════════════════════════════════════════════════════════════════════════════════
seccion("5 · EL BORDE QUE MÁS DUELE · un % sobre la variable YA CONOCIDA no se lee como la que falta");
{
  // Falta el VOLUMEN. Si el usuario vuelve a hablar del PRECIO sin nombrar entidad, el criterio viejo le asignaba
  // ese porcentaje a la variable FALTANTE: el usuario decía "precio" y el motor entendía "volumen".
  const e = ESCENARIOS[0];
  const r1 = await abrir(e);
  const r2 = await turno({ text: "y si el precio sube 10% en vez de eso", mem: r1.mem, plan: planTemaNuevo });
  const args = simCall(r2);
  ok(!args || args.variableB.delta_pct !== 10,
    "un % que habla del PRECIO nunca se convierte en el supuesto de VOLUMEN que falta", JSON.stringify(args));
}

// ════════════════════════════════════════════════════════════════════════════════════════════════════════════
seccion("6 · LA PUERTA DE SALIDA EXPLÍCITA, con las dos redacciones que no enganchaban");
for (const t of ["Descartá esa simulación.", "Ya no me interesa ese escenario.", "Olvidalo, mejor contame otra cosa."]) {
  const r1 = await abrir(ESCENARIOS[0]);
  const r2 = await turno({ text: t, mem: r1.mem, plan: { intent: "answer", mode: "default", scope: { level: "global" }, calls: [{ tool: "executiveSummary", args: {} }] } });
  ok(r2 && r2.mem.pendingSimulation == null, `«${t}» abandona el pendiente`, JSON.stringify(r2 && r2.mem.pendingSimulation));
}
// …y el control: una instrucción sobre el DATO que empieza con el mismo verbo NO es un abandono.
{
  const r1 = await abrir(ESCENARIOS[0]);
  const r2 = await turno({ text: "descartá los SKU sin venta del análisis", mem: r1.mem, plan: planTemaNuevo });
  ok(r2 && r2.mem.pendingSimulation != null, "control: «descartá los SKU sin venta» NO abandona nada (el objeto es el dato, no el escenario)", JSON.stringify(r2 && r2.mem.pendingSimulation));
}

console.log(`\n── _pendiente_pertinencia_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
