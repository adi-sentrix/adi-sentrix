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

console.log(`\n── _scenario_intent_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
if (fail > 0) process.exit(1);
