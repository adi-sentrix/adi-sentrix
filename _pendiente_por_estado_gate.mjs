/* === _pendiente_por_estado_gate.mjs · LA SIMULACIÓN PENDIENTE MUERE POR ESTADO, NO POR CALENDARIO ==============
 * LOCAL, NO commiteado (convención del repo: _*_gate.mjs es local). CERO red, CERO LLM: callPlan/callNarrate van
 * MOCKEADOS a mano y el BATCH corre REAL contra el dataset demo — mismo patrón que _simulate_general_gate.mjs.
 *
 * EL DEFECTO QUE PROTEGE (medido en la certificación en vivo, E7): ADI arma una simulación de dos variables, le
 * pregunta al usuario el supuesto que falta, el usuario hace CUALQUIER OTRA COSA en el medio, y al volver con la
 * respuesta ADI le pide DE NUEVO el dato que él ya había dado. `mem.pendingSimulation` se borraba incondicional en
 * los TRES puntos de salida de answerViaOracle.js (ruta PLAN, _composedBypassResult y el bypass de criterio): moría
 * por CALENDARIO —sobrevivía exactamente un turno— sin mirar jamás si el turno intercalado tenía algo que ver con
 * la simulación.
 *
 * LO QUE ESTE GATE AFIRMA, que es la REGLA y no el caso: un pendiente muere cuando SE RESUELVE, cuando SE
 * REEMPLAZA, cuando una CORRECCIÓN lo invalida, cuando el usuario lo ABANDONA con todas las letras, o cuando se le
 * acaba el PLAZO. Un cambio de tema no es ninguna de esas cinco cosas. Y mientras vive, un turno que vuelve a
 * hablar del mismo escenario lo COMPLETA o lo ACTUALIZA — nunca lo re-arma perdiendo el supuesto ya aportado.
 *
 * GENERALIDAD (el caso medido era: eje CLIENTE · Sodimac · precio +8% · paréntesis = lectura normal del negocio):
 * acá NINGÚN caso repite esa combinación. Se ejercitan el eje MARCA con un paréntesis de GLOSARIO, el eje SKU con
 * la variable conocida invertida (volumen primero) y un paréntesis de ACEPTACIÓN HUÉRFANA ("dale", el bypass que
 * el árbitro señaló como el más grave porque su respuesta se contradecía a sí misma), más los dos ejes de arming
 * que existen (el detector determinístico de escenario y `supuestos_faltantes` del planificador).
 *
 * MUTACIÓN QUE LO PONE EN ROJO: devolverle a cualquiera de los tres puntos de salida su `pendingSimulation: null`
 * incondicional. Las secciones 2, 3 y 4 caen enteras.
 *
 * @inyeccion-simulada — este gate le pasa a `answerViaOracle` sus DOS pasadas (PLAN y NARRAR) como funciones
 * locales definidas en este mismo archivo. No importa el gateway ni un adapter, no importa nada de `src/ui/`
 * (donde viven las únicas implementaciones reales de esas dos funciones) y no contiene una salida cruda. Cumple
 * las cuatro condiciones del escape declarado en scripts/gates-offline.mjs, que las verifica una por una en vez
 * de creerle a esta línea. Sin esto el gate quedaba clasificado LIVE y NUNCA corría: una garantía que hay que
 * acordarse de invocar a mano no es una garantía.
 */
import { answerViaOracle } from "./src/adi/oracle/answerViaOracle.js";
import { PENDING_SIM_TTL_TURNOS, nacePendingSimulation, pendingSimulationVigente, envejecerPendingSimulation,
  repararPendingSimulation, fusionarPendientes, pendienteDesdeEscenario } from "./src/adi/oracle/conversationScope.js";

let pass = 0, fail = 0;
const ok = (cond, label, detail) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label}${detail ? ` — obtuvo ${detail}` : ""}`); }
};
const seccion = (t) => console.log(`\n── ${t} ──`);

// narraciones SEGURAS y DISTINTAS entre sí: guardC marca `degraded` cuando un turno repite verbatim un tramo de
// 8+ palabras de una narración propia reciente, así que reusar el mismo texto envenenaría el arnés (es exactamente
// la higiene rota que este pase encontró en el chequeo 4d de _simulate_general_gate.mjs).
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

// el plan de un paréntesis: un turno normal que NO habla de la simulación. `scope` explícito para que el turno no
// se lea como cambio de alcance (una corrección inferida invalidaría el pendiente, y eso lo prueba la sección 5).
const planLectura = (entidad) => ({ intent: "answer", mode: "default", scope: { level: "entity", entities: [entidad] }, calls: [{ tool: "entityProfile", args: { dimension: "cliente", entity: entidad } }] });
const simCall = (r) => {
  const p = r && r.__plan;
  const c = p && Array.isArray(p.calls) && p.calls.find((x) => x && x.tool === "simulateGeneral");
  return c ? c.args : null;
};
// corre un turno capturando el plan que recibió el narrador (la única forma de ver QUÉ tool se ejecutó de verdad).
async function turno({ text, mem, plan, narracion }) {
  let planVisto = null;
  const r = await answerViaOracle({
    text, history: [], mem, scenario: "actual",
    callPlan: async () => plan || { intent: "answer", mode: "default", calls: [] },
    callNarrate: async (a) => { planVisto = a.plan; return narracion || safe(); },
  });
  if (r) r.__plan = planVisto;
  return r;
}

// ════════════════════════════════════════════════════════════════════════════════════════════════════════════
seccion("1 · las reglas, aisladas (conversationScope.js · funciones puras, sin motor de por medio)");
{
  const base = { dimension: "marca", entity: "Samsung", entities: ["Samsung"], known: { campo: "precioLista", delta_pct: 7 }, missingCampo: "unidades" };
  const nace = nacePendingSimulation(base);
  ok(nace.restan === PENDING_SIM_TTL_TURNOS, "nace con el plazo completo estampado", JSON.stringify(nace));
  ok(nacePendingSimulation({ entity: "X" }) === null, "un pendiente sin variable conocida no nace (mejor nada que un pendiente roto)");

  let p = nace;
  for (let i = 0; i < PENDING_SIM_TTL_TURNOS - 1; i++) p = envejecerPendingSimulation(p);
  ok(!!p, `sobrevive ${PENDING_SIM_TTL_TURNOS - 1} turnos de paréntesis`, JSON.stringify(p));
  ok(envejecerPendingSimulation(p) === null, "y muere al agotar el plazo (el TTL es lo que impide el pendiente zombi)");
  ok(pendingSimulationVigente({ ...base, restan: 0 }) === null, "un pendiente con el plazo agotado ya no es vigente");
  ok(pendingSimulationVigente(base) === base, "un pendiente SIN `restan` (memoria vieja) se toma como vigente — nunca se descarta por un campo que no existía");

  // precedencia
  const otro = { dimension: "marca", entity: "LG", entities: ["LG"], known: { campo: "precioLista", delta_pct: 9 }, missingCampo: "unidades" };
  ok(fusionarPendientes(nace, otro).accion === "reemplaza", "otra entidad → REEMPLAZA");
  const completa = fusionarPendientes(nace, { ...base, known: { campo: "unidades", delta_pct: 3 }, missingCampo: "precioLista" });
  ok(completa.accion === "completa" && completa.vars.variableA.delta_pct === 7 && completa.vars.variableB.delta_pct === 3,
    "misma entidad + la variable que faltaba → COMPLETA, conservando el supuesto ya aportado", JSON.stringify(completa.vars));
  const actualiza = fusionarPendientes(nace, { ...base, known: { campo: "precioLista", delta_pct: 12 } });
  ok(actualiza.accion === "actualiza" && actualiza.pending.known.delta_pct === 12 && actualiza.pending.missingCampo === "unidades",
    "misma entidad + la MISMA variable → ACTUALIZA el valor y sigue faltando lo mismo", JSON.stringify(actualiza.pending));
  ok(fusionarPendientes(nace, null).accion === "conserva", "sin nada nuevo que armar → el pendiente que había se conserva");

  // reparación
  const rep = { tipo: "correccion", corrige: ["entidad"], ambigua: false };
  const reescrito = repararPendingSimulation(nace, rep, { scope: { level: "entity", entities: ["LG"] } });
  ok(!!reescrito && reescrito.entity === "LG" && reescrito.known.delta_pct === 7,
    "una corrección de entidad REESCRIBE el pendiente y conserva el supuesto del usuario", JSON.stringify(reescrito));
  ok(repararPendingSimulation(nace, rep, { scope: { level: "global" } }) === null, "una corrección que se lleva el eje entero lo MATA (ya no hay nada puntual que simular)");
  ok(repararPendingSimulation(nace, { tipo: "desacuerdo" }, { scope: { level: "entity", entities: ["LG"] } }) === nace, "un desacuerdo NO invalida nada (§5: conserva la evidencia)");
  ok(repararPendingSimulation(nace, { tipo: "correccion", corrige: ["periodo"], ambigua: false }, { scope: { level: "entity", entities: ["LG"] } }) === nace, "corregir el PERÍODO no toca el sujeto de la simulación");

  const desdeIntent = pendienteDesdeEscenario({ kind: "future", entity: "Samsung", dimension: "marca", variable: { campo: "unidades", delta_pct: -5 } });
  ok(desdeIntent.missingCampo === "precioLista" && desdeIntent.entities[0] === "Samsung", "un escenario declarado se traduce a pendiente con el campo faltante correcto", JSON.stringify(desdeIntent));
}

// ════════════════════════════════════════════════════════════════════════════════════════════════════════════
seccion("2 · CASO A · eje MARCA · el paréntesis es una pregunta de GLOSARIO (nada que ver con el caso medido)");
{
  const a1 = await turno({ text: "Sube 7% el precio de Samsung.", mem: {}, plan: { intent: "answer", mode: "default", calls: [] } });
  const p1 = a1 && a1.mem.pendingSimulation;
  ok(!!p1 && p1.entity === "Samsung" && p1.known.delta_pct === 7 && p1.missingCampo === "unidades", "t1 arma el pendiente de marca (precondición)", JSON.stringify(p1));

  const a2 = await turno({ text: "¿Qué quiere decir margen de contribución?", mem: a1.mem,
    plan: { intent: "define", mode: "clarify", calls: [{ tool: "defineConcept", args: { concept: "margen de contribución" } }] } });
  const p2 = a2 && a2.mem.pendingSimulation;
  ok(!!p2 && p2.entity === "Samsung" && p2.known.delta_pct === 7, "t2 (pregunta de vocabulario) NO destruye la simulación pendiente", JSON.stringify(p2));
  ok(!!p2 && p2.restan === p1.restan - 1, "t2 sí le consume un turno de plazo (el paréntesis cuesta, aunque no mate)", JSON.stringify(p2 && p2.restan));

  const a3 = await turno({ text: "el volumen sube 3%", mem: a2.mem, plan: { intent: "answer", mode: "default", calls: [] } });
  const args = simCall(a3);
  ok(!!args && args.variableA.campo === "precioLista" && args.variableA.delta_pct === 7 && args.variableB.campo === "unidades" && args.variableB.delta_pct === 3,
    "t3 EJECUTA la simulación con las dos variables — el +7% no se perdió en el paréntesis", JSON.stringify(args));
  ok(a3 && a3.mem.pendingSimulation == null, "t3 consume el pendiente (se resolvió: ésa sí es una razón para morir)");
}

// ════════════════════════════════════════════════════════════════════════════════════════════════════════════
seccion("3 · CASO B · eje SKU · variable conocida INVERTIDA · el paréntesis es la aceptación huérfana (bypass :829)");
{
  const b1 = await turno({ text: "Baja 4% las unidades de SAM-REF500L.", mem: {}, plan: { intent: "answer", mode: "default", calls: [] } });
  const p1 = b1 && b1.mem.pendingSimulation;
  ok(!!p1 && p1.entity === "SAM-REF500L" && p1.known.campo === "unidades" && p1.known.delta_pct === -4 && p1.missingCampo === "precioLista",
    "t1 arma el pendiente con el VOLUMEN como variable conocida (el caso medido era al revés)", JSON.stringify(p1));

  const b2 = await turno({ text: "dale", mem: b1.mem, plan: { intent: "answer", mode: "default", calls: [] } });
  const p2 = b2 && b2.mem.pendingSimulation;
  ok(!!p2 && p2.entity === "SAM-REF500L" && p2.known.delta_pct === -4, "t2 ('dale' sin oferta) NO destruye la simulación pendiente", JSON.stringify(p2));
  // EL TURNO AUTOCONTRADICTORIO: ADI borraba el contexto y en el mismo acto decía que no lo tenía.
  ok(b2 && !/no tengo un contexto previo/i.test(b2.r.text), `t2 NUNCA responde "no tengo un contexto previo" un turno después de haber preguntado ella misma`, JSON.stringify(b2 && b2.r.text));
  ok(b2 && /precio/i.test(b2.r.text), "t2 recuerda QUÉ falta en vez de negar el contexto", JSON.stringify(b2 && b2.r.text));

  const b3 = await turno({ text: "el precio sube 5%", mem: b2.mem, plan: { intent: "answer", mode: "default", calls: [] } });
  const args = simCall(b3);
  ok(!!args && args.variableA.campo === "precioLista" && args.variableA.delta_pct === 5 && args.variableB.campo === "unidades" && args.variableB.delta_pct === -4,
    "t3 cierra la simulación del SKU con las dos variables en su lugar", JSON.stringify(args));
}

// ════════════════════════════════════════════════════════════════════════════════════════════════════════════
seccion("4 · NUNCA SE RE-ARMA DEGRADADO · el turno que vuelve a hablar del mismo escenario lo completa o lo actualiza");
{
  const c1 = await turno({ text: "Sube 6% el precio de Jumbo.", mem: {}, plan: { intent: "answer", mode: "default", calls: [] } });
  ok(c1.mem.pendingSimulation.known.delta_pct === 6, "precondición: pendiente de Jumbo con precio +6%");

  // (a) COMPLETAR — el usuario re-nombra la entidad y aporta la variable que faltaba: ya están las dos.
  const c2 = await turno({ text: "Y las unidades de Jumbo bajan 2%.", mem: c1.mem, plan: { intent: "answer", mode: "default", calls: [] } });
  const argsC = simCall(c2);
  ok(!!argsC && argsC.variableA.delta_pct === 6 && argsC.variableB.delta_pct === -2,
    "(a) misma entidad + la variable que faltaba → se EJECUTA, nunca se vuelve a preguntar", JSON.stringify(argsC));
  ok(c2.mem.pendingSimulation == null, "(a) y el pendiente queda consumido");

  // (b) ACTUALIZAR — el usuario cambia de idea sobre el MISMO supuesto: se actualiza el valor, sigue faltando lo mismo.
  const d2 = await turno({ text: "Mejor sube 11% el precio de Jumbo.", mem: c1.mem, plan: { intent: "answer", mode: "default", calls: [] } });
  const pd = d2 && d2.mem.pendingSimulation;
  ok(!!pd && pd.known.campo === "precioLista" && pd.known.delta_pct === 11 && pd.missingCampo === "unidades",
    "(b) misma entidad + el MISMO supuesto → se ACTUALIZA el valor, jamás se degrada a la otra variable", JSON.stringify(pd));

  // (c) REEMPLAZAR — otro escenario, sobre otra entidad: el anterior se abandona, sin mezclar supuestos.
  const e2 = await turno({ text: "Sube 9% el precio de Lider.", mem: c1.mem, plan: { intent: "answer", mode: "default", calls: [] } });
  const pe = e2 && e2.mem.pendingSimulation;
  ok(!!pe && pe.entity === "Lider" && pe.known.delta_pct === 9 && pe.restan === PENDING_SIM_TTL_TURNOS,
    "(c) otra entidad → REEMPLAZA con plazo fresco (nunca hereda el supuesto de la anterior)", JSON.stringify(pe));
}

// ════════════════════════════════════════════════════════════════════════════════════════════════════════════
seccion("5 · LAS OTRAS TRES FORMAS DE MORIR · corrección · abandono explícito · plazo agotado");
{
  const f1 = await turno({ text: "Sube 8% el precio de Falabella.", mem: {}, plan: { intent: "answer", mode: "default", calls: [] } });
  ok(f1.mem.pendingSimulation.entity === "Falabella", "precondición: pendiente de Falabella");

  // (a) CORRECCIÓN DE ENTIDAD — §1 del Contrato v1.2: la reparación reescribe el pendiente hacia lo corregido.
  const f2 = await turno({ text: "No, era Jumbo.", mem: f1.mem,
    plan: { intent: "redirect", mode: "default", scope: { level: "entity", entities: ["Jumbo"] },
      reparacion: { tipo: "correccion", corrige: ["entidad"], ambigua: false, pregunta: null, dato: null, aceptado: false },
      calls: [{ tool: "entityProfile", args: { dimension: "cliente", entity: "Jumbo" } }] } });
  const pf = f2 && f2.mem.pendingSimulation;
  ok(!!pf && pf.entity === "Jumbo" && pf.known.delta_pct === 8,
    "(a) la corrección REESCRIBE el pendiente hacia la entidad corregida — nunca simula la equivocada", JSON.stringify(pf));

  // (b) ABANDONO EXPLÍCITO — el usuario lo descarta con todas las letras.
  const g2 = await turno({ text: "Olvidalo, mejor dime otra cosa del negocio.", mem: f1.mem, plan: { intent: "answer", mode: "default", scope: { level: "global" }, calls: [{ tool: "executiveSummary", args: {} }] } });
  ok(g2 && g2.mem.pendingSimulation == null, "(b) un abandono EXPLÍCITO sí lo mata (la puerta de salida que antes daba el calendario)", JSON.stringify(g2 && g2.mem.pendingSimulation));

  // (c) PLAZO AGOTADO — el pendiente zombi es imposible: N paréntesis seguidos lo entierran.
  let mem = f1.mem;
  for (let i = 0; i < PENDING_SIM_TTL_TURNOS; i++) {
    const r = await turno({ text: `¿qué margen tiene Sodimac?`, mem, plan: planLectura("Sodimac") });
    ok(!!r, `(c) el paréntesis ${i + 1} responde (el arnés no se abstiene)`);
    mem = r.mem;
  }
  ok(mem.pendingSimulation == null, `(c) tras ${PENDING_SIM_TTL_TURNOS} paréntesis el pendiente muere solo`, JSON.stringify(mem.pendingSimulation));

  // y ya muerto, un porcentaje suelto NO resucita nada: ésa es la definición del zombi que el TTL cierra.
  // OJO CON LO QUE ESTE CHEQUEO NO DICE (corrección 2026-08-11, revisión adversarial): prueba el zombi con el
  // pendiente VENCIDO, o sea justo cuando ya no puede pasar. El caso peligroso —un % que habla de OTRA cosa con el
  // pendiente VIVO— no lo cubre ni éste ni la sección 6 (que sólo mira el turno que nombra otra ENTIDAD, un guard
  // que ya existía). Ese caso vive completo, con sus dos caras, en _pendiente_pertinencia_gate.mjs. Este chequeo
  // se queda porque el TTL también hay que certificarlo, pero no hay que leerlo como si cerrara el zombi.
  const z = await turno({ text: "baja 3%", mem, plan: { intent: "answer", mode: "default", calls: [] } });
  ok(!simCall(z), "(c) con el pendiente vencido, un '%' suelto NO ejecuta ninguna simulación vieja", JSON.stringify(simCall(z)));
}

// ════════════════════════════════════════════════════════════════════════════════════════════════════════════
seccion("6 · NO SE RESUELVE CONTRA UN PENDIENTE DE OTRO TEMA (el guard que hace segura la supervivencia)");
{
  const h1 = await turno({ text: "Sube 8% el precio de Falabella.", mem: {}, plan: { intent: "answer", mode: "default", calls: [] } });
  // el turno nombra OTRA entidad conocida: no está contestando, está hablando de otra cosa.
  const h2 = await turno({ text: "y en Lider el volumen baja 2%", mem: h1.mem, plan: { intent: "answer", mode: "default", scope: { level: "entity", entities: ["Lider"] }, calls: [{ tool: "entityProfile", args: { dimension: "cliente", entity: "Lider" } }] } });
  const argsH = simCall(h2);
  ok(!argsH || argsH.entity !== "Falabella", "un turno que nombra OTRA entidad nunca resuelve el pendiente de la primera", JSON.stringify(argsH));

  // …y el caso que ESTA sección no cubría: el turno NO nombra ninguna entidad, sólo un % pegado a otro sustantivo,
  // con el pendiente VIVO. Es la mitad que faltaba de la regla; el gate propio está en _pendiente_pertinencia_gate.mjs.
  const h3 = await turno({ text: "y si el costo de flete sube 4%, ¿cambia algo?", mem: h1.mem, plan: { intent: "answer", mode: "default", scope: { level: "global" }, calls: [] } });
  ok(!simCall(h3), "con el pendiente VIVO, un % que habla de otra cosa tampoco lo resuelve (evidencia POSITIVA o nada)", JSON.stringify(simCall(h3)));
  ok(h3 && h3.mem.pendingSimulation != null, "…y no por eso se abandona: sigue esperando la respuesta real", JSON.stringify(h3 && h3.mem.pendingSimulation));
}

console.log(`\n── _pendiente_por_estado_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
