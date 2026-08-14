/* === _scenario_intent_gate.mjs · ARQUITECTURA C · GATE DE COERCIÓN DE INTENCIÓN DE ESCENARIO (owner 2026-07-31) ===
 * La certificación integral post-#56 mostró 2 fallas REALES de ENTRADA a simulate v2 (no de continuación):
 *   1. "Sube 8% el precio de Lider" (imperativo, sin "¿me conviene?") nunca llamaba a simulateGeneral.
 *   2. Una consulta puntual sobre Jumbo perdió el alcance y produjo una simulación de CARTERA COMPLETA.
 * "Que el motor funcione después de reformular no basta. El primer intento natural debe llegar al flujo
 * correcto" (owner). scenarioIntent.js es la red determinística; este gate certifica las 7 categorías pedidas
 * (imperativo/interrogativo/condicional/cero explícito/entidad puntual/cartera global/pasado histórico) MÁS la
 * reproducción end-to-end de los 2 bugs originales en el PRIMER intento, sin reformular.
 *
 * 1) DETERMINÍSTICO puro — scenarioIntent.js directo (sin LLM, sin answerViaOracle): las 7 categorías.
 * 2) end-to-end vía answerViaOracle (callPlan mockeado para PROBAR que nunca se invoca cuando el bypass
 *    intercepta, y que SÍ se invoca cuando el turno es genuinamente ambiguo) — reproduce los 2 bugs originales.
 * 3) «VENTAS» CUENTA COMO VOLUMEN (owner 2026-08-14, defecto verificado en vivo): la guía de inicio ofrece
 *    «Si subo ventas 4%, ¿qué cambia?», el detector devolvía "none" y el turno quedaba a merced de PLAN, que no
 *    corrió la simulación. Sección 1h (detector) + sección e2e del defecto de la guía, con los negativos
 *    exhaustivos que el diseño conservador exige (pasado, causal, comparaciones, XOR precio/ventas).
 *
 * @inyeccion-simulada — este gate le pasa a `answerViaOracle` sus DOS pasadas (PLAN y NARRAR) como funciones
 * locales mockeadas en este mismo archivo. No importa el gateway ni un adapter, no importa nada de `src/ui/` y no
 * contiene una salida cruda. Cumple las cuatro condiciones del escape declarado en scripts/gates-offline.mjs —
 * hasta 2026-08-14 este gate quedaba EXCLUIDO en silencio de `gates:offline` por nombrar callPlan sin el marcador
 * (la trampa documentada del clasificador): sus mocks eran ya una inyección simulada, solo faltaba declararla.
 */
import fs from "fs";
for (const ln of fs.readFileSync(".env", "utf8").split(/\r?\n/)) { const m = ln.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
import { detectScenarioIntent, extractScenarioVariable, isHistoricalMention, extractKnownEntity } from "./src/adi/oracle/scenarioIntent.js";
import { answerViaOracle } from "./src/adi/oracle/answerViaOracle.js";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";

let pass = 0, fail = 0;
const ok = (cond, label) => { console.log(`  ${cond ? "✓" : "✗"} ${label}`); if (cond) pass++; else fail++; };

initTenant(TENANT_DEMO);

console.log("── 1 · DETERMINÍSTICO — scenarioIntent.js (sin LLM) ──");

console.log("\n  -- 1a · IMPERATIVO --");
{
  const r = detectScenarioIntent("Sube 8% el precio de Lider.");
  ok(r.kind === "future" && r.entity === "Lider", `bug #1 original, forma imperativa — obtuvo ${JSON.stringify(r)}`);
  ok(r.kind === "future" && r.variable.campo === "precioLista" && r.variable.delta_pct === 8, "variable precio+8% correcta");

  const r2 = detectScenarioIntent("Baja 3% el volumen de Jumbo.");
  ok(r2.kind === "future" && r2.entity === "Jumbo" && r2.variable.campo === "unidades" && r2.variable.delta_pct === -3, `imperativo volumen a la baja — obtuvo ${JSON.stringify(r2)}`);

  const r3 = detectScenarioIntent("Mantén el volumen de Lider sin cambios.");
  ok(r3.kind === "future" && r3.entity === "Lider" && r3.variable.campo === "unidades" && r3.variable.delta_pct === 0, `imperativo + 0% explícito ("mantén") — obtuvo ${JSON.stringify(r3)}`);
}

console.log("\n  -- 1b · INTERROGATIVO --");
{
  const r = detectScenarioIntent("¿Qué pasa si subo 8% el precio de Lider?");
  ok(r.kind === "future" && r.entity === "Lider" && r.variable.campo === "precioLista" && r.variable.delta_pct === 8, `forma interrogativa explícita del owner — obtuvo ${JSON.stringify(r)}`);

  const r2 = detectScenarioIntent("¿Cómo queda Falabella si el volumen baja 5%?");
  ok(r2.kind === "future" && r2.entity === "Falabella" && r2.variable.campo === "unidades" && r2.variable.delta_pct === -5, `interrogativa, volumen a la baja — obtuvo ${JSON.stringify(r2)}`);
}

console.log("\n  -- 1c · CONDICIONAL --");
{
  const r = detectScenarioIntent("Si le subiera el precio a Jumbo un 6%, ¿qué pasaría?");
  ok(r.kind === "future" && r.entity === "Jumbo" && r.variable.campo === "precioLista" && r.variable.delta_pct === 6, `condicional ("si...-ra") — obtuvo ${JSON.stringify(r)}`);

  const r2 = detectScenarioIntent("Simula una baja de 3% en precio.");
  ok(r2.kind === "no_entity" && r2.variable.campo === "precioLista" && r2.variable.delta_pct === -3, `condicional/imperativo del owner SIN entidad — variable resuelta, pero nunca asume cartera — obtuvo ${JSON.stringify(r2)}`);
}

console.log("\n  -- 1d · CERO EXPLÍCITO --");
{
  const r = detectScenarioIntent("Mantén el volumen sin cambios.");
  ok(r.kind === "no_entity" && r.variable.campo === "unidades" && r.variable.delta_pct === 0, `frase EXACTA del owner, sin entidad — 0% legítimo, no "falta variable" — obtuvo ${JSON.stringify(r)}`);

  const r2 = detectScenarioIntent("El precio de Sodimac no cambia.");
  ok(r2.kind === "future" && r2.entity === "Sodimac" && r2.variable.campo === "precioLista" && r2.variable.delta_pct === 0, `"no cambia" con entidad — 0% explícito, nunca confundido con ausencia — obtuvo ${JSON.stringify(r2)}`);

  const r3 = detectScenarioIntent("El volumen de Tottus queda igual.");
  ok(r3.kind === "future" && r3.entity === "Tottus" && r3.variable.delta_pct === 0, `"queda igual" — otra formulación de 0% explícito — obtuvo ${JSON.stringify(r3)}`);
}

console.log("\n  -- 1e · ENTIDAD PUNTUAL (nunca degrada a cartera completa) --");
{
  const r = detectScenarioIntent("¿Qué pasa si le subo el precio a Jumbo 6%?");
  ok(r.kind === "future" && r.entity === "Jumbo", `bug #2 original invertido: Jumbo SIEMPRE preservado, nunca cae a "none"/cartera — obtuvo ${JSON.stringify(r)}`);
  ok(extractKnownEntity("¿Qué pasa si le subo el precio a Jumbo 6% y a Falabella también?") === null, "2 clientes nombrados a la vez → ambigüedad real, nunca adivina cuál (null, no el primero)");
  ok(extractKnownEntity("¿cómo viene el negocio en general?") === null, "sin ninguna entidad conocida nombrada → null, nunca falso positivo");
}

console.log("\n  -- 1f · CARTERA GLOBAL (variable inequívoca, SIN entidad → pregunta, nunca asume portfolio) --");
{
  const r = detectScenarioIntent("Sube el precio 5%.");
  ok(r.kind === "no_entity" && r.variable.campo === "precioLista" && r.variable.delta_pct === 5, `sin entidad nombrada — "no_entity", NUNCA "future" con cartera completa — obtuvo ${JSON.stringify(r)}`);

  const r2 = detectScenarioIntent("¿Qué pasa si el volumen cae 10%?");
  ok(r2.kind === "no_entity" && r2.variable.campo === "unidades" && r2.variable.delta_pct === -10, `interrogativa sin entidad — misma regla — obtuvo ${JSON.stringify(r2)}`);
}

console.log("\n  -- 1g · PASADO HISTÓRICO (lectura del dato, NUNCA simulación) --");
{
  const r = detectScenarioIntent("el precio subió 8%");
  ok(r.kind === "historical", `frase EXACTA del owner (3a persona preterite) — obtuvo ${JSON.stringify(r)}`);

  const r2 = detectScenarioIntent("las ventas bajaron 3%");
  ok(r2.kind === "historical", `segunda frase EXACTA del owner — obtuvo ${JSON.stringify(r2)}`);

  const r3 = detectScenarioIntent("el precio de Lider subió 8% el mes pasado");
  ok(r3.kind === "historical", `histórico CON entidad nombrada — sigue siendo lectura, nunca dispara simulación — obtuvo ${JSON.stringify(r3)}`);

  const r4 = detectScenarioIntent("el volumen de Jumbo aumentó 4% y las ventas crecieron con eso");
  ok(r4.kind === "historical", `verbos histórico adicionales (aumentó/crecieron) — obtuvo ${JSON.stringify(r4)}`);

  // control: NO debe sobre-generalizar — "si subo el precio y bajo el volumen" (presente 1a persona, hipotético,
  // caso YA cubierto por PLAN con ambas variables) nunca debe leerse como pasado.
  const r5 = detectScenarioIntent("si subo el precio a Falabella 5% y bajo el volumen 3%, ¿me conviene?");
  ok(r5.kind === "none", `control: presente 1a persona ("bajo") NUNCA se confunde con pretérito ("bajó") — obtuvo ${JSON.stringify(r5)}`);
  ok(!isHistoricalMention("si subo el precio y bajo el volumen"), "control aislado: isHistoricalMention no dispara con 'bajo' presente");
}

console.log("\n  -- control: caso YA cubierto por PLAN normal (ambas variables en la misma frase) — el detector se aparta --");
{
  const r = detectScenarioIntent("si subo el precio a Lider 8% y el volumen baja 2%, ¿me conviene?");
  ok(r.kind === "none", `ambas variables en una frase → "none", deja pasar a PLAN sin tocar nada — obtuvo ${JSON.stringify(r)}`);
  ok(extractScenarioVariable("si subo el precio a Lider 8% y el volumen baja 2%") === null, "extractScenarioVariable por sí solo también se aparta (ambos campos presentes)");
}

console.log("\n  -- control: turno normal, sin ninguna intención de escenario --");
{
  const r = detectScenarioIntent("¿cómo viene la venta de Lider este mes?");
  ok(r.kind === "none", `pregunta de lectura normal, sin % ni campo de escenario — obtuvo ${JSON.stringify(r)}`);
}

console.log("\n  -- 1h · «VENTAS» CUENTA COMO VOLUMEN (owner 2026-08-14) · positivos --");
{
  const r = detectScenarioIntent("Si subo ventas 4%, ¿qué cambia?");
  ok(r.kind === "no_entity" && r.variable.campo === "unidades" && r.variable.delta_pct === 4 && r.variable.via === "ventas",
    `la pregunta EXACTA de la guía de inicio — volumen +4, marcada via:"ventas" — obtuvo ${JSON.stringify(r)}`);

  const r2 = detectScenarioIntent("Si subo las ventas 4% a Falabella, ¿me conviene?");
  ok(r2.kind === "future" && r2.entity === "Falabella" && r2.variable.campo === "unidades" && r2.variable.delta_pct === 4,
    `«ventas» con entidad nombrada → future, volumen +4 — obtuvo ${JSON.stringify(r2)}`);

  const r3 = detectScenarioIntent("vendo 4% menos");
  ok(r3.kind === "no_entity" && r3.variable.campo === "unidades" && r3.variable.delta_pct === -4,
    `stem de vender + «menos» — obtuvo ${JSON.stringify(r3)}`);

  const r4 = detectScenarioIntent("vendo 4% más, ¿qué cambia?");
  ok(r4.kind === "no_entity" && r4.variable.campo === "unidades" && r4.variable.delta_pct === 4,
    `«N% más» postfijo cerrando la cláusula → dirección arriba — obtuvo ${JSON.stringify(r4)}`);

  const r5 = detectScenarioIntent("si vendiera 10% más, ¿me conviene?");
  ok(r5.kind === "no_entity" && r5.variable.campo === "unidades" && r5.variable.delta_pct === 10,
    `condicional de vender («vendiera») — obtuvo ${JSON.stringify(r5)}`);

  const r6 = detectScenarioIntent("si subo la venta 4%");
  ok(r6.kind === "no_entity" && r6.variable.campo === "unidades" && r6.variable.delta_pct === 4,
    `singular «la venta» también cuenta — obtuvo ${JSON.stringify(r6)}`);
}

console.log("\n  -- 1h · «VENTAS» · negativos (el diseño conservador NO se relaja) --");
{
  const r = detectScenarioIntent("subo precio y ventas 4%");
  ok(r.kind === "none", `XOR intacta: precio Y ventas en la misma frase → none, PLAN decide — obtuvo ${JSON.stringify(r)}`);

  const r2 = detectScenarioIntent("¿por qué cayeron las ventas 8%?");
  ok(r2.kind === "historical", `causal en PASADO → historical, JAMÁS simula — obtuvo ${JSON.stringify(r2)}`);

  const r3 = detectScenarioIntent("las ventas subieron 4% este mes");
  ok(r3.kind === "historical", `lectura del pasado con % — obtuvo ${JSON.stringify(r3)}`);

  const r4 = detectScenarioIntent("¿por qué caen las ventas 8%?");
  ok(r4.kind === "none", `causal en PRESENTE (el filtro de pasado no la ve) → none, PLAN explica — obtuvo ${JSON.stringify(r4)}`);

  const r5 = detectScenarioIntent("se vendieron 4% menos unidades este mes");
  ok(r5.kind === "historical", `«se vendieron» (pasado de vender, hueco preexistente cerrado) — obtuvo ${JSON.stringify(r5)}`);

  const r6 = detectScenarioIntent("vendimos 8% menos");
  ok(r6.kind === "none", `«vendimos» (pasado 1a plural) EXCLUIDO del stem: probable lectura, nunca se fuerza — obtuvo ${JSON.stringify(r6)}`);

  const r7 = detectScenarioIntent("vendemos 3% más que el año pasado");
  ok(r7.kind === "none", `«más que» es COMPARACIÓN, no dirección de supuesto → ambiguo, none — obtuvo ${JSON.stringify(r7)}`);

  const r8 = detectScenarioIntent("la comisión del vendedor sube 1,5%");
  ok(r8.kind === "none", `«vendedor» es un sujeto, no la variable — obtuvo ${JSON.stringify(r8)}`);

  const r9 = detectScenarioIntent("ventas 4%");
  ok(r9.kind === "none", `% sin dirección → nunca se adivina el signo — obtuvo ${JSON.stringify(r9)}`);

  const r10 = detectScenarioIntent("¿qué clientes venden más del 5% de margen?");
  ok(r10.kind === "none", `pregunta de ranking con «venden» y % → sin dirección de supuesto, none — obtuvo ${JSON.stringify(r10)}`);
}

console.log("\n  -- 1h · «ventas» como RESULTADO PREGUNTADO no le quita el piso a «precio» --");
{
  const r = detectScenarioIntent("¿qué pasa con las ventas si subo el precio 5% a Lider?");
  ok(r.kind === "future" && r.entity === "Lider" && r.variable.campo === "precioLista" && r.variable.delta_pct === 5,
    `"¿qué pasa con las ventas si…?" nombra el RESULTADO, no la variable: precio conserva su piso — obtuvo ${JSON.stringify(r)}`);

  const r2 = detectScenarioIntent("¿cómo quedan las ventas si subo el precio 4%?");
  ok(r2.kind === "no_entity" && r2.variable.campo === "precioLista" && r2.variable.delta_pct === 4,
    `"¿cómo quedan las ventas si…?" — misma poda — obtuvo ${JSON.stringify(r2)}`);

  const r3 = detectScenarioIntent("¿cuánto caen las ventas si subo el precio 5%?");
  ok(r3.kind === "none", `"¿cuánto CAEN las ventas…?" NO se poda: su verbo direccional contaminaría el signo del precio → none — obtuvo ${JSON.stringify(r3)}`);
}

console.log("\n── 2 · END-TO-END vía answerViaOracle — reproducción de los 2 bugs originales, PRIMER intento ──");
{
  // BUG #1 original: "Sube 8% el precio de Lider" (imperativo puro, sin "¿me conviene?") — PLAN (LLM) lo leía como
  // pedido de análisis/decisión y respondía con margen/benchmark, SIN llamar nunca a simulateGeneral. Mockeamos
  // callPlan para que devuelva EXACTAMENTE esa mala clasificación (reproduciendo el bug tal cual se veía) — el
  // bypass determinístico debe interceptar ANTES de que ese callPlan se invoque siquiera.
  let planCalled1 = false;
  const BAD_PLAN_1 = { intent: "answer", mode: "analisis", scope: { level: "entity", entities: ["Lider"] }, calls: [{ tool: "entityProfile", args: { dimension: "cliente", entity: "Lider" } }] };
  const r1 = await answerViaOracle({
    text: "Sube 8% el precio de Lider.", history: [], mem: {}, scenario: "actual",
    callPlan: async () => { planCalled1 = true; return BAD_PLAN_1; },
    callNarrate: async () => "nunca debería aparecer",
  });
  ok(!planCalled1, "BUG #1: 'Sube 8% el precio de Lider' — PLAN nunca se invoca, el bypass determinístico llega PRIMERO");
  const ps1 = r1 && r1.mem && r1.mem.pendingSimulation;
  ok(ps1 && ps1.entity === "Lider" && ps1.known.campo === "precioLista" && ps1.known.delta_pct === 8 && ps1.missingCampo === "unidades",
    `BUG #1: pendingSimulation correcto en el PRIMER intento, sin reformular — obtuvo ${JSON.stringify(ps1)}`);
  ok(r1 && /volumen|unidades/i.test(r1.r.text), `BUG #1: la pregunta de aclaración es sobre la variable faltante (volumen) — obtuvo "${r1 && r1.r.text}"`);

  // Turno 2: responde la variable faltante → resuelve, calcula, conserva Lider — SIN volver a nombrarlo.
  let narrateArgs1b = null;
  const r1b = await answerViaOracle({
    text: "el volumen baja 2%", history: [], mem: r1.mem, scenario: "actual",
    callPlan: async () => { throw new Error("PLAN no debería llamarse — bug #1, turno 2"); },
    callNarrate: async (a) => { narrateArgs1b = a; return "Con ese supuesto, la venta de Lider baja frente al escenario actual."; },
  });
  const call1b = narrateArgs1b && narrateArgs1b.plan.calls[0].args;
  ok(call1b && call1b.entity === "Lider" && call1b.variableA.delta_pct === 8 && call1b.variableB.delta_pct === -2,
    `BUG #1 resuelto en 2 turnos limpios: Lider conservado, ambas variables correctas — obtuvo ${JSON.stringify(call1b)}`);

  // BUG #2 original: una consulta puntual sobre Jumbo "perdió el alcance" y produjo una simulación de CARTERA
  // COMPLETA en vez de la entidad nombrada. Mockeamos callPlan devolviendo EXACTAMENTE esa mala clasificación
  // (scope global, sin entity) — el bypass debe interceptar antes, preservando Jumbo estructuralmente (la entidad
  // la pone el detector determinístico, nunca el LLM).
  let planCalled2 = false;
  const BAD_PLAN_2 = { intent: "answer", mode: "simulacion", scope: { level: "global" }, calls: [{ tool: "simulateGeneral", args: { dimension: "cliente", variableA: { campo: "precioLista", delta_pct: 6 } } }] };
  const r2 = await answerViaOracle({
    text: "¿Qué pasa si le subo el precio a Jumbo 6%?", history: [], mem: {}, scenario: "actual",
    callPlan: async () => { planCalled2 = true; return BAD_PLAN_2; },
    callNarrate: async () => "nunca debería aparecer",
  });
  ok(!planCalled2, "BUG #2: consulta puntual de Jumbo — PLAN nunca se invoca, el bypass intercepta primero");
  const ps2 = r2 && r2.mem && r2.mem.pendingSimulation;
  ok(ps2 && ps2.entity === "Jumbo", `BUG #2: entidad Jumbo preservada estructuralmente, NUNCA degrada a cartera completa — obtuvo ${JSON.stringify(ps2)}`);

  // control: un turno genuinamente ambiguo (ninguna categoría dispara) SÍ debe invocar a PLAN con normalidad —
  // el bypass no debe convertirse en una trampa que intercepta todo.
  let planCalled3 = false;
  const NORMAL_PLAN = { intent: "answer", mode: "default", calls: [{ tool: "entityProfile", args: { dimension: "cliente", entity: "Lider" } }] };
  await answerViaOracle({
    text: "¿cómo viene la venta de Lider este mes?", history: [], mem: {}, scenario: "actual",
    callPlan: async () => { planCalled3 = true; return NORMAL_PLAN; },
    callNarrate: async () => "El negocio se mantiene estable este período, sin sobresaltos que merezcan una alerta.",
  });
  ok(planCalled3, "control: turno de lectura normal SÍ invoca a PLAN — el bypass no intercepta indiscriminadamente");

  // control: histórico SÍ debe invocar a PLAN (es una lectura del dato, nunca dispara el bypass).
  let planCalled4 = false;
  await answerViaOracle({
    text: "el precio de Lider subió 8% el mes pasado", history: [], mem: {}, scenario: "actual",
    callPlan: async () => { planCalled4 = true; return NORMAL_PLAN; },
    callNarrate: async () => "El negocio se mantiene estable este período, sin sobresaltos que merezcan una alerta.",
  });
  ok(planCalled4, "control: mención histórica SÍ invoca a PLAN — nunca se interpreta como supuesto a simular");
}

console.log("\n── 3 · END-TO-END · el defecto de la guía (2026-08-14): «Si subo ventas 4%, ¿qué cambia?» ──");
{
  // El defecto verificado en vivo: la guía ofrece esta pregunta con un click, viaja como texto libre, el detector
  // devolvía "none" y todo quedaba a merced de PLAN (Haiku no corrió la simulación → "No tengo corrida esa
  // simulación"). Ahora el bypass determinístico la intercepta ANTES de PLAN, y además DECLARA la interpretación
  // (ventas → volumen, unidades vendidas) para que el usuario pueda corregir si quería otra cosa.
  let planCalledG = false;
  const rG = await answerViaOracle({
    text: "Si subo ventas 4%, ¿qué cambia?", history: [], mem: {}, scenario: "actual",
    callPlan: async () => { planCalledG = true; return { intent: "answer", mode: "default", calls: [] }; },
    callNarrate: async () => "nunca debería aparecer",
  });
  ok(!planCalledG, "la pregunta de la guía NUNCA llega a PLAN: el piso determinístico la reclama primero");
  ok(rG && /volumen \(unidades vendidas\)/i.test(rG.r.text), `la respuesta DECLARA la interpretación (volumen, unidades vendidas) — obtuvo "${rG && rG.r.text}"`);
  ok(rG && /¿Sobre qué cliente, SKU, marca o familia/.test(rG.r.text), "…y pregunta por la entidad, nunca asume cartera completa");

  // Con entidad nombrada: pendiente correcto + declaración + pregunta SOLO por el precio faltante.
  let planCalledG2 = false;
  const rG2 = await answerViaOracle({
    text: "Si subo las ventas 4% a Falabella, ¿me conviene?", history: [], mem: {}, scenario: "actual",
    callPlan: async () => { planCalledG2 = true; return { intent: "answer", mode: "default", calls: [] }; },
    callNarrate: async () => "nunca debería aparecer",
  });
  ok(!planCalledG2, "«ventas 4% a Falabella» tampoco llega a PLAN");
  const psG = rG2 && rG2.mem && rG2.mem.pendingSimulation;
  ok(psG && psG.entity === "Falabella" && psG.known.campo === "unidades" && psG.known.delta_pct === 4 && psG.missingCampo === "precioLista",
    `pendiente correcto: Falabella · volumen +4 · falta el precio — obtuvo ${JSON.stringify(psG)}`);
  ok(rG2 && /volumen \(unidades vendidas\)/i.test(rG2.r.text) && /cambie el precio/.test(rG2.r.text),
    `declara la interpretación Y pregunta por el precio — obtuvo "${rG2 && rG2.r.text}"`);

  // Turno 2: el usuario confirma precio sin cambios → simulateGeneral corre con precio 0 CONFIRMADO (nunca
  // asumido) y volumen +4 — la boleta declara ambos supuestos como figs (Precio propuesto 0% · Volumen propuesto 4%).
  let narrateArgsG = null;
  await answerViaOracle({
    text: "el precio queda igual", history: [], mem: rG2.mem, scenario: "actual",
    callPlan: async () => { throw new Error("PLAN no debería llamarse — el pendiente resuelve solo"); },
    callNarrate: async (a) => { narrateArgsG = a; return "Con ese supuesto, la venta de Falabella sube frente al escenario actual."; },
  });
  const callG = narrateArgsG && narrateArgsG.plan.calls[0] && narrateArgsG.plan.calls[0].args;
  ok(callG && callG.entity === "Falabella" && callG.variableA.delta_pct === 0 && callG.variableB.campo === "unidades" && callG.variableB.delta_pct === 4,
    `simulateGeneral corre con precio 0 (confirmado por el usuario) y volumen +4 — obtuvo ${JSON.stringify(callG)}`);
  const bolG = (narrateArgsG && narrateArgsG.results && narrateArgsG.results[0] && narrateArgsG.results[0].boleta) || [];
  ok(bolG.some((f) => /Precio propuesto/.test(f.label) && f.value === "0%") && bolG.some((f) => /Volumen propuesto/.test(f.label) && f.value === "4%"),
    "la boleta declara AMBOS supuestos como figs autorizadas (precio 0% · volumen 4%) — el supuesto no viaja escondido");

  // Control: la causal con «ventas» SÍ va a PLAN (es una lectura/explicación, nunca el bypass).
  let planCalledG3 = false;
  await answerViaOracle({
    text: "¿por qué caen las ventas 8%?", history: [], mem: {}, scenario: "actual",
    callPlan: async () => { planCalledG3 = true; return { intent: "answer", mode: "default", calls: [] }; },
    callNarrate: async () => "La lectura general del período no cambia respecto de lo que veníamos conversando.",
  });
  ok(planCalledG3, "control: «¿por qué caen las ventas 8%?» SÍ invoca a PLAN — el vocabulario nuevo no secuestra las causales");
}

console.log(`\n── _scenario_intent_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
if (fail > 0) process.exit(1);
