/* === _alcance_pendiente_gate.mjs · EL ALCANCE DEL PENDIENTE · EL HILO MEDIDO DEL OWNER (2026-08-14) ============
 * EL DEFECTO, MEDIDO EN VIVO EN PRODUCCIÓN (transcript `_medir_sesion_owner.json`, 9 llamadas reales):
 *   t1 «Si subo ventas 4%, ¿qué cambia?»  → ADI declaró volumen y pidió entidad — pero NO guardó ningún estado.
 *   t2 «sobre las ventas»                 → el narrador ecoó el «4%» DEL PROPIO USUARIO y guardC lo vetó DOS veces
 *                                           («cifra-de-dato-sin-dueno»): el turno cayó al genérico «No tengo
 *                                           información autorizada suficiente».
 *   t3 «simula sobre el total de ventas»  → llegó a PLAN, y Haiku eligió **simulateCosto**: la respuesta simuló
 *                                           costo medio +4% sobre TODOS los SKU («costo supuesto $75.0M»,
 *                                           impacto contribución −$2.9M) — un escenario que el usuario JAMÁS
 *                                           pidió, presentado como su supuesto. Es la regla madre violada: lo
 *                                           único que no puede pasar es inventar.
 *
 * LAS TRES GARANTÍAS QUE ESTE GATE FIJA, y ninguna depende del LLM:
 *   (a) «el total / todo el negocio / la cartera / global / en general» resuelve el ALCANCE sin pasar por PLAN,
 *       con la misma prudencia falla-cerrada del guard de pertinencia (poda + lista blanca cerrada);
 *   (b) con un pendiente de precio/volumen vivo, una simulación de OTRA palanca (costo/carga/capital) se descarta
 *       salvo que el turno la NOMBRE — y el caso legítimo («y si además el costo sube 2%») sigue corriendo;
 *   (c) el % del supuesto que vive en el pendiente cuenta como cifra DEL USUARIO para guardC mientras el pendiente
 *       vive — sin que ninguna otra cifra gane autorización (el muro no se relaja: se prueba acá mismo).
 *
 * QUÉ SOPORTA EL MOTOR, medido y fijado en la sección 4: simulateGeneral (2 variables) EXIGE entidad puntual
 * (rawRecordFor sin entidad no tiene registro) — no existe su versión global. El `simulate` genérico SÍ corre
 * sobre el eje completo, y con una de las dos variables confirmada en 0 la venta escala exactamente lineal con la
 * otra, así que el escenario global se responde sin estimar nada. Con las DOS moviéndose se DECLINA declarando el
 * límite y ofreciendo los clientes con más volumen del dato real.
 *
 * @inyeccion-simulada — este gate le pasa a `answerViaOracle` sus DOS pasadas (PLAN y NARRAR) como funciones
 * locales mockeadas en este mismo archivo. No importa el gateway ni un adapter, no importa nada de `src/ui/` y no
 * contiene una salida cruda: cumple las cuatro condiciones del escape declarado en scripts/gates-offline.mjs.
 * NO carga `.env` a propósito — no lo necesita (todo es motor puro + mocks) y así no puede gastar ni por accidente.
 */
import { answerViaOracle } from "./src/adi/oracle/answerViaOracle.js";
import { guardC } from "./src/adi/oracle/guardC.js";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";

let pass = 0, fail = 0;
const ok = (cond, label) => { console.log(`  ${cond ? "✓" : "✗"} ${label}`); if (cond) pass++; else fail++; };
const NUNCA_PLAN = (etiqueta) => async () => { throw new Error(`PLAN no debía invocarse — ${etiqueta}`); };
const NUNCA_NARRAR = async () => "esta narración nunca debería adoptarse";

initTenant(TENANT_DEMO);

console.log("── 1 · EL HILO MEDIDO, TURNO POR TURNO (PLAN mockeado donde el hilo real lo invocó) ──");

// t1 — el turno que abre el escenario sin entidad. Antes: la pregunta salía y NO se guardaba nada.
let planCalled1 = false;
const t1 = await answerViaOracle({
  text: "Si subo ventas 4%, ¿qué cambia?", history: [], mem: {}, scenario: "actual",
  callPlan: async () => { planCalled1 = true; return { intent: "answer", mode: "default", calls: [] }; },
  callNarrate: NUNCA_NARRAR,
});
ok(!planCalled1, "t1: la pregunta de la guía no llega a PLAN (el piso determinístico la reclama)");
const ps1 = t1 && t1.mem && t1.mem.pendingSimulation;
ok(ps1 && ps1.faltaAlcance === true && ps1.known.campo === "unidades" && ps1.known.delta_pct === 4 && ps1.missingCampo === "precioLista",
  `t1: el pendiente de ALCANCE queda persistido (antes: nada) — obtuvo ${JSON.stringify(ps1)}`);
ok(t1 && /volumen \(unidades vendidas\)/i.test(t1.r.text) && /¿Sobre qué cliente, SKU, marca o familia/.test(t1.r.text),
  "t1: declara la interpretación de «ventas» y pide el alcance — el texto del pase de hoy no cambia");

// t2 — «sobre las ventas»: no contesta el alcance, así que PLAN corre (como en el hilo real). Lo que cambia es que
// el eco del 4% DEL USUARIO ya no muere contra el muro.
let planCalled2 = false, narradas2 = 0;
const t2 = await answerViaOracle({
  text: "sobre las ventas", history: [], mem: t1.mem, scenario: "actual",
  callPlan: async () => { planCalled2 = true; return { intent: "answer", mode: "clarify", calls: [] }; },
  callNarrate: async () => { narradas2++; return "Entendido: mantengo el 4% como el cambio a simular sobre las ventas. ¿Sobre qué cliente, SKU, marca o familia lo corro, o lo corro sobre el total del negocio?"; },
});
ok(planCalled2, "t2: «sobre las ventas» NO se toma como respuesta de alcance — PLAN corre normal (falla cerrada)");
ok(t2 && /4%/.test(t2.r.text), `t2: el eco del supuesto del usuario PASA el muro (antes: 2 vetos → genérico) — obtuvo "${t2 && t2.r.text}"`);
ok(narradas2 === 1, `t2: un solo intento del narrador — el rechazo que costaba dos llamadas desapareció (obtuvo ${narradas2})`);
const ps2 = t2 && t2.mem && t2.mem.pendingSimulation;
ok(ps2 && ps2.faltaAlcance === true && ps2.restan === 2, `t2: el pendiente sobrevive el paréntesis, un turno más viejo — obtuvo ${JSON.stringify(ps2)}`);

// EL CONTROL QUE PRUEBA QUE EL MURO NO SE ABRIÓ: una cifra DEL DATO sin dueño sigue vetada en el MISMO turno.
const t2ctrl = await answerViaOracle({
  text: "sobre las ventas", history: [], mem: t1.mem, scenario: "actual",
  callPlan: async () => ({ intent: "answer", mode: "clarify", calls: [] }),
  callNarrate: async () => "La carga comercial es 4.5% y con eso alcanza.",
});
ok(t2ctrl && !/4\.5%/.test(t2ctrl.r.text),
  `t2 control: una cifra del DATO sin dueño («4.5%») sigue vetada con el pendiente vivo — obtuvo "${t2ctrl && t2ctrl.r.text}"`);

// t3 — EL GRAVE. Antes: llegó a PLAN y Haiku eligió simulateCosto sobre todos los SKU.
const t3 = await answerViaOracle({
  text: "simula sobre el total de ventas", history: [], mem: t2.mem, scenario: "actual",
  callPlan: NUNCA_PLAN("t3 del hilo medido: el alcance se resuelve determinísticamente"),
  callNarrate: NUNCA_NARRAR,
});
const ps3 = t3 && t3.mem && t3.mem.pendingSimulation;
ok(ps3 && ps3.alcance === "global" && ps3.known.delta_pct === 4 && ps3.missingCampo === "precioLista",
  `t3: «el total de ventas» resuelve el ALCANCE sin PLAN — obtuvo ${JSON.stringify(ps3)}`);
ok(t3 && /total del negocio/i.test(t3.r.text) && /precio/i.test(t3.r.text),
  `t3: declara el alcance tomado y pregunta SOLO el supuesto que falta — obtuvo "${t3 && t3.r.text}"`);
ok(t3 && !/costo/i.test(t3.r.text), "t3: la palabra «costo» no aparece por ningún lado — el escenario fabricado es imposible acá");

// t4 — el usuario confirma el precio: la simulación global corre con el supuesto declarado.
let narrateArgs4 = null;
const t4 = await answerViaOracle({
  text: "el precio queda igual", history: [], mem: t3.mem, scenario: "actual",
  callPlan: NUNCA_PLAN("t4: el pendiente global resuelve solo"),
  callNarrate: async (a) => { narrateArgs4 = a; return "Con ese supuesto, la venta total del negocio sube frente al dato real."; },
});
const call4 = narrateArgs4 && narrateArgs4.plan && narrateArgs4.plan.calls && narrateArgs4.plan.calls[0];
ok(call4 && call4.tool === "simulate" && call4.args.metric === "ventas" && call4.args.dimension === "cliente" && call4.args.transform.value === 4,
  `t4: corre el simulador GLOBAL de ventas con +4% (precio 0 confirmado → delta lineal) — obtuvo ${JSON.stringify(call4)}`);
ok(call4 && call4.tool !== "simulateCosto" && call4.tool !== "simulateGeneral", "t4: ni simulateCosto (el defecto) ni simulateGeneral (que no existe en global)");
const bol4 = (narrateArgs4 && narrateArgs4.results && narrateArgs4.results[0] && narrateArgs4.results[0].boleta) || [];
ok(bol4.some((f) => /Supuesto %/.test(f.label) && /4%/.test(f.value)) && bol4.some((f) => /Total · supuesto/.test(f.label)),
  `t4: la boleta declara el supuesto y el total proyectado — obtuvo ${JSON.stringify(bol4.map((f) => `${f.label}=${f.value}`))}`);
ok(t4 && t4.mem && t4.mem.pendingSimulation == null, "t4: el pendiente muere RESUELTO, no por calendario");

console.log("\n── 2 · LA RED DEL ALCANCE — falla cerrada, como el guard de pertinencia ──");
{
  // POSITIVOS: formas naturales de contestar «¿sobre qué?». Ninguna puede llegar a PLAN con el pendiente vivo.
  for (const texto of ["el total", "el total de ventas", "todo el negocio", "toda la cartera", "global", "en general",
    "todos los clientes", "sobre el total del negocio", "hazlo sobre el total", "simula sobre todo"]) {
    let llegoAPlan = false;
    const r = await answerViaOracle({
      text: texto, history: [], mem: t1.mem, scenario: "actual",
      callPlan: async () => { llegoAPlan = true; return { intent: "answer", mode: "default", calls: [] }; },
      callNarrate: async () => "una narración cualquiera, sin cifras.",
    });
    const p = r && r.mem && r.mem.pendingSimulation;
    ok(!llegoAPlan && p && p.alcance === "global", `positivo «${texto}» → alcance global, sin PLAN`);
  }

  // NEGATIVOS: un sustantivo de contenido de más, y NO es una respuesta de alcance. PLAN corre normal.
  for (const [texto, porque] of [
    ["¿cuál es el total de ventas?", "es una LECTURA del total, no un alcance"],
    ["dame el total", "pide el dato, no contesta el alcance"],
    ["el total de la competencia", "sujeto ajeno al negocio"],
    ["todos los clientes que compran Bosch", "trae un criterio nuevo"],
    ["el margen total", "nombra otra métrica"],
  ]) {
    let llegoAPlan = false;
    const r = await answerViaOracle({
      text: texto, history: [], mem: t1.mem, scenario: "actual",
      callPlan: async () => { llegoAPlan = true; return { intent: "answer", mode: "default", calls: [] }; },
      callNarrate: async () => "Puedo mostrarte esa lectura si me confirmas qué alcance buscas.",
    });
    const p = r && r.mem && r.mem.pendingSimulation;
    ok(llegoAPlan && !(p && p.alcance === "global"), `negativo «${texto}» → PLAN corre (${porque})`);
  }

  // La respuesta de alcance con ENTIDAD nombrada pasa por la MISMA vara y arma el pendiente puntual de siempre.
  const rEnt = await answerViaOracle({
    text: "sobre Falabella", history: [], mem: t1.mem, scenario: "actual",
    callPlan: NUNCA_PLAN("«sobre Falabella» contesta el alcance"),
    callNarrate: NUNCA_NARRAR,
  });
  const pEnt = rEnt && rEnt.mem && rEnt.mem.pendingSimulation;
  ok(pEnt && pEnt.entity === "Falabella" && !pEnt.faltaAlcance && pEnt.known.delta_pct === 4 && pEnt.missingCampo === "precioLista",
    `«sobre Falabella» resuelve el alcance conservando el supuesto — obtuvo ${JSON.stringify(pEnt)}`);

  // …y una entidad nombrada DENTRO de una pregunta ajena NO lo resuelve (sobra contenido).
  let planAjeno = false;
  await answerViaOracle({
    text: "¿qué margen tiene Falabella?", history: [], mem: t1.mem, scenario: "actual",
    callPlan: async () => { planAjeno = true; return { intent: "answer", mode: "default", calls: [] }; },
    callNarrate: async () => "La lectura del período no cambia respecto de lo que veníamos conversando.",
  });
  ok(planAjeno, "negativo «¿qué margen tiene Falabella?» → PLAN corre: nombrar la entidad no alcanza, sobra contenido");

  // Sin pendiente vivo, «el total» es un turno normal: la red no se activa nunca fuera del flujo pendiente.
  let planSinPendiente = false;
  await answerViaOracle({
    text: "el total", history: [], mem: {}, scenario: "actual",
    callPlan: async () => { planSinPendiente = true; return { intent: "answer", mode: "default", calls: [] }; },
    callNarrate: async () => "La lectura del período no cambia respecto de lo que veníamos conversando.",
  });
  ok(planSinPendiente, "sin pendiente vivo, «el total» es un turno normal — la red no existe fuera del flujo");
}

console.log("\n── 3 · EL FRENO ANTI-SIMULACIÓN-AJENA (con pendiente de volumen/precio vivo) ──");
{
  // pendiente puntual vivo: Falabella, precio +8%, falta el volumen.
  const base = await answerViaOracle({
    text: "Sube 8% el precio de Falabella.", history: [], mem: {}, scenario: "actual",
    callPlan: NUNCA_PLAN("el arm future intercepta"), callNarrate: NUNCA_NARRAR,
  });
  ok(base.mem.pendingSimulation && base.mem.pendingSimulation.entity === "Falabella", "setup: pendiente de Falabella (precio +8, falta volumen)");

  // EL DEFECTO DEL HILO, en su forma general: PLAN trae una simulación de OTRA palanca sin que el turno la nombre.
  for (const [tool, args] of [["simulateCosto", { pct: 8, scope: "all" }], ["simulateCarga", {}], ["simulateCapital", {}], ["simulate", { metric: "capital", dimension: "sku", transform: { op: "delta", unit: "pct", value: 8 } }]]) {
    let narro = false;
    const r = await answerViaOracle({
      text: "y entonces qué pasa con eso", history: [], mem: base.mem, scenario: "actual",
      callPlan: async () => ({ intent: "answer", mode: "simulacion", calls: [{ tool, args }] }),
      callNarrate: async () => { narro = true; return "una narración con cifras de una simulación que nadie pidió"; },
    });
    ok(!narro && r && /Sigo esperando/.test(r.r.text), `${tool} fabricado con pendiente vivo → descartado, se re-pregunta lo que falta`);
    ok(r && r.mem.pendingSimulation && r.mem.pendingSimulation.entity === "Falabella", `${tool}: el pendiente sigue vivo (no se abandona por el freno)`);
  }

  // EL CASO LEGÍTIMO — el turno NOMBRA la palanca: es un pedido REAL y tiene que correr.
  for (const [texto, tool, args] of [
    ["y si además el costo sube 2%", "simulateCosto", { pct: 2, scope: "all" }],
    ["¿y si bajamos la carga comercial al target?", "simulateCarga", {}],
    ["¿cuánto capital liberamos si movemos el inventario?", "simulateCapital", {}],
  ]) {
    let narrateArgs = null;
    await answerViaOracle({
      text: texto, history: [], mem: base.mem, scenario: "actual",
      callPlan: async () => ({ intent: "answer", mode: "simulacion", calls: [{ tool, args }] }),
      callNarrate: async (a) => { narrateArgs = a; return "El escenario planteado queda expresado como supuesto, sin concluir conveniencia."; },
    });
    const c = narrateArgs && narrateArgs.plan.calls.find((x) => x.tool === tool);
    ok(!!c, `legítimo «${texto}» → ${tool} corre: el turno nombra la palanca (el freno no rompe el caso real)`);
  }

  // simulateGeneral NUNCA se frena: es la continuación natural del propio pendiente.
  let narrateArgsSG = null;
  await answerViaOracle({
    text: "y el volumen que baje 3%", history: [], mem: base.mem, scenario: "actual",
    callPlan: async () => ({ intent: "answer", mode: "simulacion", calls: [{ tool: "simulateGeneral", args: { dimension: "cliente", entity: "Falabella", variableA: { campo: "precioLista", delta_pct: 8 }, variableB: { campo: "unidades", delta_pct: -3 } } }] }),
    callNarrate: async (a) => { narrateArgsSG = a; return "Con ese supuesto, la venta de Falabella cambia frente al escenario actual."; },
  });
  ok(narrateArgsSG && narrateArgsSG.plan.calls.some((c) => c.tool === "simulateGeneral"), "simulateGeneral nunca se frena — es la continuación del propio pendiente");

  // SIN pendiente vivo, una simulación de costo no pedida explícitamente sigue corriendo como siempre (el freno
  // existe SOLO en la ventana donde hay un supuesto declarado que podría fabricarse).
  let narrateArgsLibre = null;
  await answerViaOracle({
    text: "y entonces qué pasa con eso", history: [], mem: {}, scenario: "actual",
    callPlan: async () => ({ intent: "answer", mode: "simulacion", calls: [{ tool: "simulateCosto", args: { pct: 3, scope: "all" } }] }),
    callNarrate: async (a) => { narrateArgsLibre = a; return "El escenario planteado queda expresado como supuesto, sin concluir conveniencia."; },
  });
  ok(narrateArgsLibre && narrateArgsLibre.plan.calls.some((c) => c.tool === "simulateCosto"), "sin pendiente vivo, simulateCosto corre normal — el freno no se generaliza");
}

console.log("\n── 4 · QUÉ CORRE EN GLOBAL, Y QUÉ SE DECLINA (evidencia del motor) ──");
{
  // una variable movida (la otra confirmada en 0) → el simulador global responde sin estimar nada.
  let narrateArgsA = null;
  const rA = await answerViaOracle({
    text: "el precio queda igual", history: [], mem: t3.mem, scenario: "actual",
    callPlan: NUNCA_PLAN("global resuelto"), callNarrate: async (a) => { narrateArgsA = a; return "La venta total del negocio se mueve con el supuesto planteado."; },
  });
  const cA = narrateArgsA && narrateArgsA.plan.calls[0];
  ok(cA && cA.tool === "simulate" && cA.args.transform.value === 4, "volumen +4% con precio 0 confirmado → simulate global de ventas +4%");
  ok(rA && !/No tengo información autorizada/.test(rA.r.text), "…y el turno responde de verdad, no cae al genérico");

  // DOS variables moviéndose → el motor no lo soporta en global: se DECLINA con el límite y los candidatos reales.
  const rB = await answerViaOracle({
    text: "el precio sube 2%", history: [], mem: t3.mem, scenario: "actual",
    callPlan: NUNCA_PLAN("la declinación es determinística"), callNarrate: NUNCA_NARRAR,
  });
  ok(rB && /entidad puntual/i.test(rB.r.text) && /límite del motor/i.test(rB.r.text),
    `2 variables sobre el total → declina DECLARANDO el límite — obtuvo "${rB && rB.r.text}"`);
  ok(rB && /Jumbo/.test(rB.r.text) && /Falabella/.test(rB.r.text),
    "…y ofrece los 2 clientes con MÁS VOLUMEN del dato real (nunca una lista escrita a mano)");
  ok(rB && !/\$/.test(rB.r.text), "…sin una sola cifra del negocio: declinar no es una excusa para mostrar dato");

  // las dos en 0 → no hay escenario que proyectar, y se DICE (nunca se corre una simulación de delta cero, que el
  // propio motor rechaza: "0% en ambas variables no mueve nada").
  const c0a = await answerViaOracle({
    text: "Mantén las ventas sin cambios.", history: [], mem: {}, scenario: "actual",
    callPlan: NUNCA_PLAN("0% explícito sin entidad: el arm no_entity lo reclama"), callNarrate: NUNCA_NARRAR,
  });
  const c0b = await answerViaOracle({
    text: "el total del negocio", history: [], mem: c0a.mem, scenario: "actual",
    callPlan: NUNCA_PLAN("alcance global"), callNarrate: NUNCA_NARRAR,
  });
  const rC = await answerViaOracle({
    text: "el precio queda igual", history: [], mem: c0b.mem, scenario: "actual",
    callPlan: NUNCA_PLAN("las dos variables en 0 se responden sin plan"), callNarrate: NUNCA_NARRAR,
  });
  // C-1 del colapso (2026-08-30): la letra dejó el token «escenario» — «no hay nada que proyectar» (la frase del
  // propio diseño). La variante «no hay proyección que hacer» la vetó guardC (juicio-sin-marcar) y el bypass
  // devolvió null: el notario juzga HASTA el texto determinístico, y eso es exactamente lo que este gate cazó.
  ok(rC && rC.r && /no hay nada que proyectar/i.test(rC.r.text || "") && /queda igual al dato real/i.test(rC.r.text || ""),
    `0% en ambas → se declara que no hay nada que proyectar — obtuvo "${rC && rC.r.text}"`);
  ok(rC && rC.mem.pendingSimulation == null, "…y el pendiente se cierra: no queda una pregunta abierta sin objeto");
}

console.log("\n── 5 · LA AUTORIZACIÓN DEL SUPUESTO ES QUIRÚRGICA (guardC aislado) ──");
{
  const narr = "El 4% que planteaste queda como supuesto del escenario.";
  const sin = guardC(narr, { ledger: { figs: [] }, results: [], question: "" });
  const con = guardC(narr, { ledger: { figs: [] }, results: [], question: "", supuestoPendiente: ["4%", "4%"] });
  ok(!sin.ok, "sin el parámetro, el «4%» sigue vetado — el chequeo 1 no se relajó para nadie");
  ok(con.ok, "con el supuesto pendiente, el «4%» del usuario pasa");

  const otra = guardC("El total del negocio es $19.4M.", { ledger: { figs: [] }, results: [], question: "", supuestoPendiente: ["4%", "4%"] });
  ok(!otra.ok, "la autorización NO alcanza a ninguna otra cifra (un monto del dato sigue vetado)");

  const vecina = guardC("El 5% que planteaste queda como supuesto.", { ledger: { figs: [] }, results: [], question: "", supuestoPendiente: ["4%", "4%"] });
  ok(!vecina.ok, "ni siquiera a un % VECINO: autoriza el valor exacto del supuesto, nada más");

  const negativo = guardC("El volumen baja 4% en el escenario.", { ledger: { figs: [] }, results: [], question: "", supuestoPendiente: ["-4%", "4%"] });
  ok(negativo.ok, "un supuesto negativo viaja en valor absoluto: la narración escribe «baja 4%», no «-4%»");
}

console.log(`\n── _alcance_pendiente_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
if (fail > 0) process.exit(1);
