/* === _conversation_continuity_universal_gate.mjs · Etapa 3/3 · continuidad conversacional universal — arnés final ===
 * LOCAL, NO commiteado (convención del repo: _*_gate.mjs es local). CERO red, CERO LLM: ejercita answerViaOracle.js
 * de punta a punta con callPlan/callNarrate MOCKEADOS a mano (mismo patrón que _tool_contracts_gate.mjs /
 * _conversation_scope_gate.mjs / _scenario_intent_gate.mjs) — el BATCH (runPlan/TOOLS) corre REAL contra el dataset
 * demo embebido, nunca se mockea (así los resultados/boletas son datos verdaderos, no inventados por este arnés).
 *
 * Reproduce y verifica el CASO OBLIGATORIO exacto del owner (capital inmovilizado → ¿qué SKU? → sube 3% el precio
 * de estos SKU → resuelve el volumen) MÁS los otros 7 casos listados explícitamente por el owner:
 *   1. CASO OBLIGATORIO (4 turnos) — resuelve LG-DRYER8KG/BOS-SANDER/MAK-COMP-AIR, pregunta SOLO por volumen, NUNCA
 *      por cliente, y el turno de resolución corre un fan-out REAL de 3 simulateGeneral (una por SKU).
 *   2. "compara los dos peores" — ordinal + dirección sellada (ascendente por Margen) → los 2 primeros de la lista.
 *   3. "haz lo mismo con Falabella" — PLAN ya lo resuelve por comprensión (nombra la entidad); control de que
 *      conversationScope NO interfiere ni cruza con la entidad anterior.
 *   4. "¿y el año anterior?" — continuidad de PERÍODO: el scope conserva el período ya mostrado y lo surfacea a
 *      PLAN (persona.js:renderInteractionMemory) para que no tenga que volver a preguntar por la entidad.
 *   5. "simula estos clientes" — el mismo mecanismo "future_multi" del caso obligatorio, pero dimension=cliente
 *      (prueba que NO es un parche solo-para-SKU: fan-out real de 3 simulateGeneral por CLIENTE).
 *   6. "profundiza en el primero" — ordinal posicional → 1 sola entidad → applySingleEntityScope puebla args.entity
 *      para entityProfile (tool que _coerceEntityScopedFilters, pre-Etapa-3, no cubría).
 *   7. cambio real de tema (scope.level=global) + regreso ("volvamos a Falabella") — current se retira a history,
 *      un deíctico plano post-cambio-de-tema NO hereda nada, y el regreso nombrado no cruza con el resumen ejecutivo.
 *   8. entidad inexistente Y entidad de OTRO tenant — ambas rechazan explícito, PLAN se invoca (para leer intent/
 *      scope) pero NARRATE NUNCA corre, y el texto final nunca inventa/cruza el dato.
 *
 * REGLA DURA DE FIDELIDAD verificada en punta a punta: en NINGÚN test de este archivo se le pasa a callNarrate un
 * mock que devuelva una entidad/cifra que después se intente resolver desde ahí — toda resolución de referencia
 * ocurre ANTES de narrar, sobre `results`/boleta REALES del batch, nunca sobre el string que devuelve callNarrate.
 */
import { answerViaOracle } from "./src/adi/oracle/answerViaOracle.js";
import { resolveConversationReference, composeReferenceDecline } from "./src/adi/oracle/conversationScope.js";
import { renderInteractionMemory } from "./src/adi/oracle/persona.js";
import { buildRequestContext } from "./src/adi/oracle/requestContext.js";

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log(`  OK  ${name}`); }
  else { fail++; console.log(`FAIL  ${name}${detail ? " — " + detail : ""}`); }
}
function section(title) { console.log(`\n== ${title} ==`); }

const SAFE_SKU = ["LG-DRYER8KG", "BOS-SANDER", "MAK-COMP-AIR"];   // los 3 SKU EXACTOS del caso obligatorio (verificado contra el dato real)

// ════════════════════════════════════════════════════════════════════════════════════════════════════════════
section("1 · CASO OBLIGATORIO — capital inmovilizado → ¿qué SKU? → sube 3% el precio de estos SKU → resuelve volumen");
// ────────────────────────────────────────────────────────────────────────────────────────────────────────────
{
  let mem = {};
  const hist = [];

  // Turno 1 — "Muéstrame mi capital inmovilizado" (inventoryStatus sin filtro, dato REAL)
  const PLAN1 = { intent: "answer", mode: "diagnostico", rationale: "capital inmovilizado", scope: { level: "entity", entities: [] }, calls: [{ tool: "inventoryStatus", args: {} }] };
  const r1 = await answerViaOracle({
    text: "Muéstrame mi capital inmovilizado", history: hist, mem, scenario: "actual",
    callPlan: async () => PLAN1,
    callNarrate: async () => "Tenés capital relevante inmovilizado, concentrado en un grupo chico de SKU.",
  });
  ok("turno1 responde route=oracle", !!r1 && r1.r.route === "oracle", JSON.stringify(r1 && r1.r && r1.r.text));
  const scope1 = r1 && r1.mem.conversationScope && r1.mem.conversationScope.current;
  ok("turno1: conversationScope.current resuelve dimension=sku, los 3 SKU EXACTOS (nunca de la prosa narrada)",
    !!scope1 && scope1.dimension === "sku" && JSON.stringify(scope1.entities) === JSON.stringify(SAFE_SKU),
    JSON.stringify(scope1));
  mem = r1.mem;
  hist.push({ role: "user", gist: "Muéstrame mi capital inmovilizado" }, { role: "assistant", gist: r1.r.text });

  // Turno 2 — "¿Qué SKU?" (re-consulta el mismo inventario; conversationScope se re-deriva de RESULTADOS reales)
  const PLAN2 = { intent: "answer", mode: "default", rationale: "detalle de SKU", scope: { level: "list", entities: [] }, calls: [{ tool: "inventoryStatus", args: {} }] };
  const r2 = await answerViaOracle({
    text: "¿Qué SKU?", history: hist, mem, scenario: "actual",
    callPlan: async () => PLAN2,
    callNarrate: async () => `Los SKU con más capital detenido son ${SAFE_SKU.join(", ")}.`,
  });
  const scope2 = r2 && r2.mem.conversationScope && r2.mem.conversationScope.current;
  ok("turno2: sigue resolviendo los 3 SKU exactos tras la pregunta de aclaración", !!scope2 && JSON.stringify(scope2.entities) === JSON.stringify(SAFE_SKU), JSON.stringify(scope2));
  mem = r2.mem;
  hist.push({ role: "user", gist: "¿Qué SKU?" }, { role: "assistant", gist: r2.r.text });

  // Turno 3 — "¿Qué pasa si subo 3% el precio de estos SKU?" — DEBE bypasear PLAN ENTERO (scenarioIntent
  // "future_multi") y preguntar SOLO por volumen — EL BUG OBLIGATORIO ("¿Para qué cliente...?") NUNCA debe aparecer.
  let planCalledT3 = false;
  const r3 = await answerViaOracle({
    text: "¿Qué pasa si subo 3% el precio de estos SKU?", history: hist, mem, scenario: "actual",
    callPlan: async () => { planCalledT3 = true; return { intent: "answer", mode: "simulacion", calls: [] }; },
    callNarrate: async () => { throw new Error("NUNCA debería narrar — el bypass debe cortar antes"); },
  });
  ok("turno3: PLAN NUNCA se invoca (bypass determinístico future_multi intercepta primero)", planCalledT3 === false);
  ok("turno3: la ÚNICA pregunta es sobre volumen/unidades", !!r3 && /volumen|unidades/i.test(r3.r.text), r3 && r3.r.text);
  ok("turno3: NUNCA pregunta por cliente (EL BUG OBLIGATORIO EXACTO que este trabajo cierra)", !!r3 && !/cliente/i.test(r3.r.text), r3 && r3.r.text);
  const ps3 = r3 && r3.mem.pendingSimulation;
  ok("turno3: pendingSimulation trae los 3 SKU EXACTOS (nunca 1, nunca 'estos SKU' sin resolver)",
    !!ps3 && ps3.dimension === "sku" && JSON.stringify(ps3.entities.slice().sort()) === JSON.stringify(SAFE_SKU.slice().sort()),
    JSON.stringify(ps3));
  ok("turno3: variable conocida = precio +3%, falta = unidades", !!ps3 && ps3.known.campo === "precioLista" && ps3.known.delta_pct === 3 && ps3.missingCampo === "unidades", JSON.stringify(ps3));
  mem = r3.mem;
  hist.push({ role: "user", gist: "¿Qué pasa si subo 3% el precio de estos SKU?" }, { role: "assistant", gist: r3.r.text });

  // Turno 4 — "El volumen no cambia" → resuelve el pendiente, fan-out REAL a 3 simulateGeneral (uno por SKU),
  // costModelOf() se evalúa POR CALL (automático, sin código nuevo — ver toolRegistry.js:simulateGeneral).
  let planCalledT4 = false, narrateArgsT4 = null;
  const r4 = await answerViaOracle({
    text: "El volumen no cambia", history: hist, mem, scenario: "actual",
    callPlan: async () => { planCalledT4 = true; return { intent: "answer", mode: "default", calls: [] }; },
    callNarrate: async (a) => { narrateArgsT4 = a; return "Con este supuesto, la venta de ese grupo de SKU sube levemente frente al escenario actual."; },
  });
  ok("turno4: PLAN NUNCA se invoca (resuelve el pendiente determinísticamente, sin re-preguntar)", planCalledT4 === false);
  ok("turno4 responde route=oracle", !!r4 && r4.r.route === "oracle", r4 && r4.r.text);
  ok("turno4: 3 calls REALES a simulateGeneral, una por SKU (fan-out de Etapa 2 reusado para simular)",
    !!narrateArgsT4 && Array.isArray(narrateArgsT4.results) && narrateArgsT4.results.length === 3 && narrateArgsT4.results.every((r) => r.tool === "simulateGeneral"),
    JSON.stringify(narrateArgsT4 && narrateArgsT4.results.map((r) => r.tool)));
  const boleta4 = (r4 && r4.r.evidence && r4.r.evidence.boleta) || [];
  ok("turno4: la boleta final nombra LOS 3 SKU (ninguno se pierde en el fan-out)",
    SAFE_SKU.every((sku) => boleta4.some((f) => f.label.startsWith(sku))), JSON.stringify(boleta4.map((f) => f.label)));
  ok("turno4: cada call resultó SOPORTADA (dato real, sin declinar)", narrateArgsT4.results.every((r) => r.coverage && r.coverage.supported === true), JSON.stringify(narrateArgsT4.results.map((r) => r.coverage)));
}

// ════════════════════════════════════════════════════════════════════════════════════════════════════════════
section("2 · \"compara los dos peores\" — ordinal + dirección SELLADA por la tool (ascendente por Margen)");
// ────────────────────────────────────────────────────────────────────────────────────────────────────────────
{
  let mem = {};
  const PLAN_R1 = { intent: "answer", mode: "default", scope: { level: "list", entities: [] }, calls: [{ tool: "gridTable", args: { dimension: "cliente", sortBy: "margen", dir: "asc", limit: 5 } }] };
  const rR1 = await answerViaOracle({
    text: "muéstrame el margen de mis clientes de peor a mejor", history: [], mem, scenario: "actual",
    callPlan: async () => PLAN_R1, callNarrate: async () => "Estos son tus clientes ordenados de peor a mejor margen.",
  });
  mem = rR1.mem;
  const scopeR1 = mem.conversationScope.current;
  // dato real verificado (probe): ascendente por margen → Lider, Falabella, Sodimac, Jumbo, Ripley
  ok("turno1: ranking real ascendente por margen, Lider y Falabella son los 2 peores", scopeR1.entities[0] === "Lider" && scopeR1.entities[1] === "Falabella", JSON.stringify(scopeR1.entities));
  ok("turno1: el orden SELLADO por la tool queda en selection.orden", scopeR1.selection && scopeR1.selection.orden === "ascendente por Margen", JSON.stringify(scopeR1.selection));

  let planCalledR2 = false;
  const rR2 = await answerViaOracle({
    text: "compara los dos peores",
    history: [{ role: "user", gist: "muéstrame el margen de mis clientes de peor a mejor" }, { role: "assistant", gist: rR1.r.text }],
    mem, scenario: "actual",
    callPlan: async () => { planCalledR2 = true; return { intent: "answer", mode: "default", scope: { level: "list", entities: [] }, calls: [{ tool: "compareEntities", args: { dimension: "cliente" } }] }; },
    callNarrate: async () => "Comparando esos dos clientes, ambos muestran un margen bajo el benchmark.",
  });
  ok("turno2: PLAN SÍ se invoca (elegir la tool es comprensión de PLAN; SOLO la entidad la resuelve código)", planCalledR2 === true);
  const boletaR2 = (rR2.r.evidence && rR2.r.evidence.boleta) || [];
  ok("turno2: la comparación es EXACTAMENTE Lider vs Falabella (los 2 peores), ningún otro cliente",
    boletaR2.some((f) => f.label.startsWith("Lider")) && boletaR2.some((f) => f.label.startsWith("Falabella")) && !boletaR2.some((f) => f.label.startsWith("Sodimac") || f.label.startsWith("Jumbo") || f.label.startsWith("Ripley")),
    JSON.stringify(boletaR2.map((f) => f.label)));
}

// ════════════════════════════════════════════════════════════════════════════════════════════════════════════
section("3 · \"haz lo mismo con Falabella\" — PLAN resuelve por comprensión, conversationScope no interfiere");
// ────────────────────────────────────────────────────────────────────────────────────────────────────────────
{
  let mem = {};
  const PLAN_H1 = { intent: "answer", mode: "default", scope: { level: "entity", entities: ["Sodimac"] }, calls: [{ tool: "entityRecord", args: { dimension: "cliente", entity: "Sodimac" } }] };
  const rH1 = await answerViaOracle({ text: "muéstrame el detalle de Sodimac", history: [], mem, scenario: "actual", callPlan: async () => PLAN_H1, callNarrate: async () => "Acá está el detalle completo de Sodimac." });
  mem = rH1.mem;
  ok("turno1: scope ancla en Sodimac", mem.conversationScope.current.entities[0] === "Sodimac");

  const PLAN_H2 = { intent: "answer", mode: "default", scope: { level: "entity", entities: ["Falabella"] }, calls: [{ tool: "entityRecord", args: { dimension: "cliente", entity: "Falabella" } }] };
  const rH2 = await answerViaOracle({
    text: "haz lo mismo con Falabella",
    history: [{ role: "user", gist: "muéstrame el detalle de Sodimac" }, { role: "assistant", gist: rH1.r.text }],
    mem, scenario: "actual", callPlan: async () => PLAN_H2, callNarrate: async () => "Acá está el detalle completo de Falabella.",
  });
  const boletaH2 = (rH2.r.evidence && rH2.r.evidence.boleta) || [];
  // entityRecord trae, además de las columnas "<entidad> · <label>", 2 varas de referencia SIN prefijo ("Benchmark
  // de margen"/"Target de carga comercial" — REFERENCIA_CAMPO, ver entityRecord.js) — nunca "Sodimac", eso es lo
  // único que de verdad importa acá (que NO haya cruce con la entidad anterior).
  ok("turno2: la boleta trae a Falabella y NINGÚN dato de Sodimac cruzado", boletaH2.some((f) => f.label.startsWith("Falabella")) && !boletaH2.some((f) => f.label.startsWith("Sodimac")), JSON.stringify(boletaH2.map((f) => f.label)));
  mem = rH2.mem;
  // Sodimac→Falabella es un simple SWITCH de entidad puntual (NUNCA un "cambio real de tema" — ese disparador es
  // ÚNICO y es scope.level="global", ver updateConversationScope) — por diseño, `current` se SOBREESCRIBE sin pasar
  // por `history` (mismo comportamiento LRU que recentSubjects), Sodimac simplemente ya no es el foco vigente.
  ok("turno2: conversationScope avanza a Falabella (switch de entidad puntual, no dispara el mecanismo de historial)", mem.conversationScope.current.entities[0] === "Falabella", JSON.stringify(mem.conversationScope.current));
}

// ════════════════════════════════════════════════════════════════════════════════════════════════════════════
section("4 · \"¿y el año anterior?\" — continuidad de PERÍODO (conversationScope.current.periodo + memBlock a PLAN)");
// ────────────────────────────────────────────────────────────────────────────────────────────────────────────
{
  let mem = {};
  const PLAN_P1 = { intent: "answer", mode: "default", scope: { level: "entity", entities: ["Falabella"] }, calls: [{ tool: "entityRecord", args: { dimension: "cliente", entity: "Falabella" } }] };
  const rP1 = await answerViaOracle({ text: "¿cómo viene la venta de Falabella?", history: [], mem, scenario: "actual", callPlan: async () => PLAN_P1, callNarrate: async () => "La venta de Falabella viene sólida este año." });
  mem = rP1.mem;
  const scopeP1 = mem.conversationScope.current;
  ok("turno1: el scope conserva la entidad Y el período ya mostrado", scopeP1.entities[0] === "Falabella" && !!scopeP1.periodo, JSON.stringify(scopeP1));

  const memBlock = renderInteractionMemory(mem);
  ok("el memBlock que llega a PLAN trae la entidad Y el período mostrado (dato ESTRUCTURADO, no prosa nueva)",
    memBlock.includes("Falabella") && memBlock.includes(scopeP1.periodo), memBlock);

  // turno2: PLAN, informado por el memBlock (simulado acá — el LLM real lo leería), resuelve Falabella de nuevo sin
  // que el usuario la re-nombre — el dato de "año anterior" YA vive en la MISMA fila de entityRecord (columna
  // "anterior"), disponible sin ningún tool nuevo.
  const PLAN_P2 = { intent: "answer", mode: "default", scope: { level: "entity", entities: ["Falabella"] }, calls: [{ tool: "entityRecord", args: { dimension: "cliente", entity: "Falabella" } }] };
  const rP2 = await answerViaOracle({
    text: "¿y el año anterior?",
    history: [{ role: "user", gist: "¿cómo viene la venta de Falabella?" }, { role: "assistant", gist: rP1.r.text }],
    mem, scenario: "actual", callPlan: async () => PLAN_P2, callNarrate: async () => "El año anterior, la venta de Falabella fue algo menor a la actual.",
  });
  const boletaP2 = (rP2.r.evidence && rP2.r.evidence.boleta) || [];
  ok("turno2: el dato de 'año anterior' está disponible y autorizado en la boleta, sin re-preguntar por Falabella",
    boletaP2.some((f) => f.label === "Falabella · Ventas año anterior"), JSON.stringify(boletaP2.map((f) => f.label)));
}

// ════════════════════════════════════════════════════════════════════════════════════════════════════════════
section("5 · \"simula estos clientes\" — MISMO mecanismo future_multi, dimension=cliente (prueba de UNIVERSALIDAD)");
// ────────────────────────────────────────────────────────────────────────────────────────────────────────────
{
  let mem = {};
  const PLAN_S1 = { intent: "answer", mode: "default", scope: { level: "list", entities: [] }, calls: [{ tool: "gridTable", args: { dimension: "cliente", sortBy: "margen", dir: "asc", limit: 3 } }] };
  const rS1 = await answerViaOracle({ text: "muéstrame los 3 clientes con peor margen", history: [], mem, scenario: "actual", callPlan: async () => PLAN_S1, callNarrate: async () => "Estos son los 3 clientes con peor margen." });
  mem = rS1.mem;
  const scopeS1 = mem.conversationScope.current;
  ok("turno1: scope resuelve 3 clientes (dimension=cliente, no sku)", scopeS1.dimension === "cliente" && scopeS1.entities.length === 3, JSON.stringify(scopeS1.entities));

  let planCalledS2 = false;
  const rS2 = await answerViaOracle({
    text: "Simula estos clientes: sube el precio 4%.",
    history: [{ role: "user", gist: "muéstrame los 3 clientes con peor margen" }, { role: "assistant", gist: rS1.r.text }],
    mem, scenario: "actual",
    callPlan: async () => { planCalledS2 = true; return { intent: "answer", mode: "simulacion", calls: [] }; },
    callNarrate: async () => { throw new Error("NUNCA debería narrar"); },
  });
  ok("turno2: el bypass future_multi intercepta ANTES de PLAN — TAMBIÉN para dimension=cliente (no es un parche solo-SKU)", planCalledS2 === false);
  ok("turno2: pregunta SOLO por volumen, nunca por 'SKU' (serían clientes, no productos)", !!rS2 && /volumen|unidades/i.test(rS2.r.text) && !/\bSKU\b/i.test(rS2.r.text), rS2 && rS2.r.text);
  const psS2 = rS2.mem.pendingSimulation;
  ok("turno2: pendingSimulation trae los 3 CLIENTES exactos del scope", psS2.dimension === "cliente" && JSON.stringify(psS2.entities.slice().sort()) === JSON.stringify(scopeS1.entities.slice().sort()), JSON.stringify(psS2));
  mem = rS2.mem;

  let planCalledS3 = false, narrateArgsS3 = null;
  const rS3 = await answerViaOracle({
    text: "el volumen baja 2%",
    history: [{ role: "user", gist: "Simula estos clientes: súbeles el precio 4%." }, { role: "assistant", gist: rS2.r.text }],
    mem, scenario: "actual",
    callPlan: async () => { planCalledS3 = true; return { intent: "answer", mode: "default", calls: [] }; },
    callNarrate: async (a) => { narrateArgsS3 = a; return "Con este supuesto, la venta de ese grupo de clientes baja levemente frente al escenario actual."; },
  });
  ok("turno3: resuelve determinísticamente, PLAN nunca se invoca", planCalledS3 === false);
  ok("turno3: fan-out REAL a 3 CLIENTES distintos (universalidad confirmada: mismo mecanismo, otro eje)",
    !!narrateArgsS3 && narrateArgsS3.results.length === 3 && narrateArgsS3.results.every((r) => r.tool === "simulateGeneral"),
    JSON.stringify(narrateArgsS3 && narrateArgsS3.results.map((r) => r.facts && r.facts.entidad)));
  ok("turno3: cada resultado nombra un cliente DISTINTO del subconjunto", JSON.stringify(narrateArgsS3.results.map((r) => r.facts.entidad).sort()) === JSON.stringify(scopeS1.entities.slice().sort()));
}

// ════════════════════════════════════════════════════════════════════════════════════════════════════════════
section("6 · \"profundiza en el primero\" — ordinal posicional → 1 entidad → applySingleEntityScope (entityProfile)");
// ────────────────────────────────────────────────────────────────────────────────────────────────────────────
{
  let mem = {};
  const PLAN_F1 = { intent: "answer", mode: "default", scope: { level: "list", entities: [] }, calls: [{ tool: "gridTable", args: { dimension: "sku", sortBy: "stockUSD", dir: "desc", limit: 3 } }] };
  const rF1 = await answerViaOracle({ text: "muéstrame los SKU con más capital inmovilizado", history: [], mem, scenario: "actual", callPlan: async () => PLAN_F1, callNarrate: async () => "Estos son los SKU con más capital inmovilizado." });
  mem = rF1.mem;
  const scopeF1 = mem.conversationScope.current;
  // dato real verificado (probe): descendente por Valor de inventario → SAM-REF500L, LG-WASH11KG, LG-DRYER8KG
  ok("turno1: ranking real de SKU por capital, SAM-REF500L es el primero", scopeF1.entities[0] === "SAM-REF500L", JSON.stringify(scopeF1.entities));

  const rF2 = await answerViaOracle({
    text: "profundiza en el primero",
    history: [{ role: "user", gist: "muéstrame los SKU con más capital inmovilizado" }, { role: "assistant", gist: rF1.r.text }],
    mem, scenario: "actual",
    // PLAN reconoce (por comprensión) que esto pide UN PERFIL COMPLETO (entityProfile) pero no sabe A CUÁL —
    // deja `entity` sin poblar, exactamente como se espera que un LLM real, sin este dato estructurado, se comporte.
    callPlan: async () => ({ intent: "answer", mode: "default", scope: { level: "entity", entities: [] }, calls: [{ tool: "entityProfile", args: { dimension: "sku" } }] }),
    callNarrate: async () => "Acá tenés el perfil completo de ese SKU.",
  });
  const boletaF2 = (rF2.r.evidence && rF2.r.evidence.boleta) || [];
  const OTHER_SKUS = ["LG-WASH11KG", "LG-DRYER8KG"];
  ok("turno2: applySingleEntityScope pobló args.entity='SAM-REF500L' — la boleta trae SU perfil",
    boletaF2.some((f) => f.label.startsWith("SAM-REF500L")), JSON.stringify(boletaF2.map((f) => f.label)));
  ok("turno2: ningún OTRO SKU del ranking se cuela (el mecanismo acotó a UNA sola entidad, la correcta)",
    !boletaF2.some((f) => OTHER_SKUS.some((s) => f.label.startsWith(s))), JSON.stringify(boletaF2.map((f) => f.label)));
}

// ════════════════════════════════════════════════════════════════════════════════════════════════════════════
section("7 · cambio real de tema (scope.level=global) + regreso (\"volvamos a Falabella\")");
// ────────────────────────────────────────────────────────────────────────────────────────────────────────────
{
  let mem = {};
  const PLAN_C1 = { intent: "answer", mode: "default", scope: { level: "entity", entities: ["Falabella"] }, calls: [{ tool: "entityRecord", args: { dimension: "cliente", entity: "Falabella" } }] };
  const rC1 = await answerViaOracle({ text: "¿cómo viene Falabella?", history: [], mem, scenario: "actual", callPlan: async () => PLAN_C1, callNarrate: async () => "Falabella viene sólida." });
  mem = rC1.mem;
  ok("turno1: scope ancla en Falabella", mem.conversationScope.current.entities[0] === "Falabella");

  const PLAN_C2 = { intent: "answer", mode: "default", scope: { level: "global" }, calls: [{ tool: "executiveSummary", args: {} }] };
  const rC2 = await answerViaOracle({
    text: "¿cómo viene el negocio en general?",
    history: [{ role: "user", gist: "¿cómo viene Falabella?" }, { role: "assistant", gist: rC1.r.text }],
    mem, scenario: "actual", callPlan: async () => PLAN_C2, callNarrate: async () => "El negocio viene estable en general este período.",
  });
  mem = rC2.mem;
  ok("turno2 (cambio real de tema): current se resetea a cartera (0 entidades)", mem.conversationScope.current.dimension === "cartera" && mem.conversationScope.current.entities.length === 0, JSON.stringify(mem.conversationScope.current));
  ok("turno2: Falabella se RETIRA a history, no se pierde (permite 'volvamos a X')", mem.conversationScope.history[0] && mem.conversationScope.history[0].entities[0] === "Falabella", JSON.stringify(mem.conversationScope.history));

  // control determinístico (función pura): tras el cambio real de tema, un deíctico PLANO ("esos clientes", sin
  // marca de recuerdo explícita) NO debe resucitar el tema retirado — debe caer a PLAN sin tocar nada.
  const refPlano = resolveConversationReference("y esos clientes, ¿qué tal?", { intent: "answer", scope: { level: "entity", entities: [] } }, mem.conversationScope, null);
  ok("control: deíctico plano post-cambio-de-tema → 'none' (NO hereda Falabella desde history sin marca de recuerdo)", refPlano.kind === "none", JSON.stringify(refPlano));

  // turno3: "volvamos a Falabella" — nombra la entidad explícitamente, PLAN la resuelve por comprensión (mismo
  // patrón que "haz lo mismo con Falabella" — dialogueState.js/resolveSubjectRecall es para referencias
  // POSICIONALES sin nombre, no compite acá).
  const PLAN_C3 = { intent: "answer", mode: "default", scope: { level: "entity", entities: ["Falabella"] }, calls: [{ tool: "entityRecord", args: { dimension: "cliente", entity: "Falabella" } }] };
  const rC3 = await answerViaOracle({
    text: "volvamos a Falabella",
    history: [{ role: "user", gist: "¿cómo viene Falabella?" }, { role: "assistant", gist: rC1.r.text }, { role: "user", gist: "¿cómo viene el negocio en general?" }, { role: "assistant", gist: rC2.r.text }],
    mem, scenario: "actual", callPlan: async () => PLAN_C3, callNarrate: async () => "Retomando Falabella: viene sólida.",
  });
  const boletaC3 = (rC3.r.evidence && rC3.r.evidence.boleta) || [];
  // entityRecord trae, además de "Falabella · <label>", 2 varas de referencia SIN prefijo ("Benchmark de margen"/
  // "Target de carga comercial") — lo que de verdad prueba "sin cruzar" es que NINGÚN otro CLIENTE (los que el
  // resumen ejecutivo del turno2 sí habría podido tocar) aparezca acá.
  ok("turno3: vuelve a Falabella limpio, SIN cruzar con ningún otro cliente del resumen ejecutivo del turno2", boletaC3.some((f) => f.label.startsWith("Falabella")) && !boletaC3.some((f) => /^(Lider|Sodimac|Jumbo|Ripley|Tottus|Paris)\s*·/.test(f.label)), JSON.stringify(boletaC3.map((f) => f.label)));
  mem = rC3.mem;
  ok("turno3: conversationScope vuelve a anclar en Falabella", mem.conversationScope.current.entities[0] === "Falabella");
}

// ════════════════════════════════════════════════════════════════════════════════════════════════════════════
section("8a · entidad INEXISTENTE en el scope → decline explícito, NUNCA inventa ni fuerza una interpretación rota");
// ────────────────────────────────────────────────────────────────────────────────────────────────────────────
{
  // scope construido a mano con 2 nombres que NO existen en el dataset demo (ninguno pasa guessDimension) — simula
  // un escenario/tenant que cambió a mitad de sesión, o un scope corrupto/viejo.
  const staleScope = {
    version: 1,
    current: {
      turno: 0, dimension: "cliente", entities: ["EmpresaFantasma1", "EmpresaFantasma2"],
      selection: null, periodo: null, filtros: null, metrica: null, operacion: "answer", modo: "default", tool: "gridTable",
      origen: { callId: null, boletaLabels: [] }, supuestos: [], faltantes: [], ofertaPendiente: null, tenant: null,
    },
    history: [],
  };
  const refDirect = resolveConversationReference("esos clientes", { intent: "answer", scope: { level: "list", entities: [] } }, staleScope, null);
  ok("función pura: 0 entidades sobreviven la revalidación → decline 'sin_referente' (nunca fuerza)", refDirect.kind === "decline" && refDirect.reason === "sin_referente", JSON.stringify(refDirect));
  ok("composeReferenceDecline no inventa ni nombra las entidades fantasma", !/EmpresaFantasma/.test(composeReferenceDecline(refDirect.reason)));

  // end-a-end: PLAN SÍ se invoca (una vez, para leer intent/mode) pero NARRATE nunca corre (bypass corta antes del batch real/narración)
  let narrateCalled = false;
  const mem = { conversationScope: staleScope };
  const r = await answerViaOracle({
    text: "esos clientes, compáralos", history: [], mem, scenario: "actual",
    callPlan: async () => ({ intent: "answer", mode: "default", scope: { level: "entity", entities: [] }, calls: [] }),
    callNarrate: async () => { narrateCalled = true; return "esto NUNCA debería narrarse"; },
  });
  ok("end-a-end: NARRATE nunca se invoca (el decline corta antes)", narrateCalled === false);
  ok("end-a-end: el texto final es el decline, nunca nombra las entidades fantasma ni inventa un dato", !!r && r.r.route === "oracle" && !/EmpresaFantasma/.test(r.r.text), r && r.r.text);
}

// ════════════════════════════════════════════════════════════════════════════════════════════════════════════
section("8b · entidad(es) de OTRO tenant → rechazo explícito, NUNCA cruza dato entre empresas");
// ────────────────────────────────────────────────────────────────────────────────────────────────────────────
{
  const otroTenantScope = {
    version: 1,
    current: {
      turno: 0, dimension: "cliente", entities: ["Falabella", "Lider"],   // nombres VÁLIDOS — pero de OTRO tenant
      selection: null, periodo: null, filtros: null, metrica: null, operacion: "answer", modo: "default", tool: "gridTable",
      origen: { callId: null, boletaLabels: [] }, supuestos: [], faltantes: [], ofertaPendiente: null,
      tenant: { tenantId: "otro-tenant-xyz", dataSnapshotId: "otro-tenant-xyz::actual" },
    },
    history: [],
  };
  const requestContextActivo = buildRequestContext({ conversationId: "c-test-tenant", scenario: "actual", mem: {} });   // tenantId = el ACTIVO (demo)
  ok("control: el requestContext de este turno es del tenant ACTIVO, distinto al del scope guardado", requestContextActivo.tenantId !== "otro-tenant-xyz");

  const refDirect = resolveConversationReference("esos clientes", { intent: "answer", scope: { level: "list", entities: [] } }, otroTenantScope, requestContextActivo);
  ok("función pura: scope de otro tenant + referencia inequívoca → decline 'otro_tenant' (nunca reusa parcial)", refDirect.kind === "decline" && refDirect.reason === "otro_tenant", JSON.stringify(refDirect));

  let narrateCalled2 = false;
  const mem = { conversationScope: otroTenantScope };
  const r = await answerViaOracle({
    text: "esos clientes, compáralos", history: [], mem, scenario: "actual", requestContext: requestContextActivo,
    callPlan: async () => ({ intent: "answer", mode: "default", scope: { level: "entity", entities: [] }, calls: [] }),
    callNarrate: async () => { narrateCalled2 = true; return "esto NUNCA debería narrarse"; },
  });
  ok("end-a-end: NARRATE nunca se invoca (rechazo de tenant corta antes)", narrateCalled2 === false);
  ok("end-a-end: el texto final NUNCA menciona Falabella/Lider (dato de otro tenant, nunca se cruza)", !!r && r.r.route === "oracle" && !/Falabella|Lider/.test(r.r.text), r && r.r.text);
}

console.log(`\n── _conversation_continuity_universal_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
