/* === _simulate_general_gate.mjs · ARQUITECTURA C · GATE DE "SIMULATE V2" (#56, owner 2026-07-29/31) ===
 * Diseño acordado: adi-simulate-v2-motor-escenarios.md. "Si subo 5% el precio a Falabella pero pierdo 10% de
 * volumen, ¿me conviene?" — 2 variables (precio, volumen) covariando sobre UNA entidad, algo que ninguna tool
 * simulate* existente cubre (cada una mueve 1 palanca sobre TODO un eje). Las 3 variantes de aceptación pedidas
 * por el owner, en ese orden, en la sección 3 de abajo:
 *   (a) input completo + modelo de costo autorizado → comparación completa venta/costo/margen/contribución.
 *   (b) input incompleto (precio sin volumen) → request_clarification, NUNCA asume 0% implícito.
 *   (c) input completo + modelo de costo NO autorizado → degrade honesto a solo-ventas, JAMÁS "conviene/no conviene".
 *
 * 1) DETERMINÍSTICO puro — TOOLS.simulateGeneral directo (sin LLM, sin answerViaOracle): identidad multiplicativa
 *    EXACTA (venta = venta_actual × (1+Δprecio%) × (1+Δvolumen%), NUNCA reconstruida desde precioLista×unidades —
 *    verificado que esa identidad NO se sostiene exacta en el dato real, difiere ~3-11%) + los 5 caminos de
 *    decline honesto (1 variable, mismo rol repetido, rango absurdo, ambos 0%, entidad inexistente) + el gating
 *    por costModel (demo=autorizado, empresa2=sin declarar).
 * 2) DETERMINÍSTICO — guardC._simulateGeneralConclusionViolation vía fixtures fijos.
 * 3) end-to-end MOCKEADO (mismo patrón que _dialogue_state_gate.mjs: runPlan/BATCH reales contra el dataset real,
 *    callPlan/callNarrate mockeados) — las 3 variantes.
 *
 * @inyeccion-simulada — este gate le pasa a `answerViaOracle` sus DOS pasadas (PLAN y NARRAR) como funciones
 * locales definidas en este mismo archivo. No importa el gateway ni un adapter, no importa nada de `src/ui/`
 * (donde viven las únicas implementaciones reales de esas dos funciones) y no contiene una salida cruda. Cumple
 * las cuatro condiciones del escape declarado en scripts/gates-offline.mjs, que las verifica una por una en vez
 * de creerle a esta línea. Sin esto el gate quedaba clasificado LIVE y NUNCA corría: una garantía que hay que
 * acordarse de invocar a mano no es una garantía.
 */
import fs from "fs";
for (const ln of fs.readFileSync(".env", "utf8").split(/\r?\n/)) { const m = ln.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
import { TOOLS } from "./src/adi/oracle/toolRegistry.js";
import { guardC } from "./src/adi/oracle/guardC.js";
import { answerViaOracle } from "./src/adi/oracle/answerViaOracle.js";
import { initTenant, getTenantId } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { TENANT_EMPRESA2 } from "./src/data/tenants/empresa2.js";
import { costModelOf } from "./src/config/businessPolicy.js";

let pass = 0, fail = 0;
const ok = (cond, label) => { console.log(`  ${cond ? "✓" : "✗"} ${label}`); if (cond) pass++; else fail++; };
const { simulateGeneral } = TOOLS;

initTenant(TENANT_DEMO);   // arranca en demo (costModel autorizado) — cada sección que necesite empresa2 vuelve a demo al salir

console.log("── 1 · DETERMINÍSTICO — TOOLS.simulateGeneral (sin LLM) ──");
{
  // COLAPSO DEL EJE (C5, 2026-08-30): esta llamada OMITÍA el escenario y viajaba gratis en el default de
  // conveniencia (`"actual"` = la base cruda); al unificarse los defaults a la base real declarada, las cifras
  // hardcodeadas de la identidad (19433/15158 — el mundo crudo) dejaban de coincidir. El mundo del ancla ahora
  // va EXPLÍCITO: la identidad multiplicativa se prueba sobre la base cruda declarada, no sobre un default.
  const args = { dimension: "cliente", entity: "Falabella", variableA: { campo: "precioLista", delta_pct: 5 }, variableB: { campo: "unidades", delta_pct: -10 }, scenario: "actual" };
  const r = simulateGeneral(args);
  ok(r.coverage.supported === true, "caso ancla (Falabella, precio+5%, volumen-10%): supported=true");
  ok(r.facts.costModelAutorizado === true, "demo tiene costModel autorizado — trae costo/margen/contribución");
  // REGRESIÓN (bug real cazado en este desarrollo): enrichFromFacts (ledger.js) camina `facts` recursivamente y
  // auto-autoriza CUALQUIER número cuya clave matchee /pct/i como fig "% suelto" sin la entidad correcta en el
  // label — facts.supuesto={precioPct,volumenPct} generaba 2 figs fantasma ("Supermercados del Valle: 5%"/"-10%",
  // sin "·" que diga QUÉ son). Fix: renombradas a deltaPrecio/deltaVolumen (sin "pct" en la clave). EXACTAMENTE 10
  // figs esperadas (venta×2, PRECIO/VOLUMEN PROPUESTO×2 — agregadas 2026-07-31, ver certificación integral: sin
  // esto guardC no dejaba citar el % del supuesto en un flujo de 2 turnos —, costo×2, contribución×2, margen×2).
  ok(r.boleta.length === 10, `EXACTAMENTE 10 figs (venta/precio-volumen-propuesto/costo/contribución/margen × actual+supuesto), sin fantasmas — obtuvo ${r.boleta.length}: ${JSON.stringify(r.boleta.map((f) => f.label))}`);
  ok(r.boleta.every((f) => f.label.includes(" · ")), "TODA fig de la boleta trae 'Entidad · Campo' — ninguna es un nombre pelado sin qué campo representa");
  // identidad EXACTA: venta_actual=19433 (miles) → venta_nueva = 19433×1.05×0.90
  const ventaEsperada = 19433 * 1.05 * 0.90;
  const figVentaNueva = r.boleta.find((f) => f.label === "Falabella · Venta supuesta");
  ok(figVentaNueva && Math.abs(figVentaNueva.raw - ventaEsperada * 1000) < 1, `venta supuesta = venta_actual × 1.05 × 0.90 EXACTA (miles) — esperaba ${ventaEsperada}, boleta raw/1000=${figVentaNueva && figVentaNueva.raw / 1000}`);
  const costoEsperado = 15158 * 0.90;   // costo escala SOLO con volumen, nunca con precio
  const figCostoNuevo = r.boleta.find((f) => f.label === "Falabella · Costo supuesto");
  ok(figCostoNuevo && Math.abs(figCostoNuevo.raw - costoEsperado * 1000) < 1, `costo supuesto = costo_actual × 0.90 SOLO (el precio no mueve el costo) — esperaba ${costoEsperado}, obtuvo ${figCostoNuevo && figCostoNuevo.raw / 1000}`);
  const contribEsperada = ventaEsperada - costoEsperado;
  const figContribNueva = r.boleta.find((f) => f.label === "Falabella · Contribución supuesta");
  ok(figContribNueva && Math.abs(figContribNueva.raw - contribEsperada * 1000) < 1, `contribución supuesta = venta supuesta − costo supuesto (identidad venta−costo=contribución, verificada contra el dato real) — esperaba ${contribEsperada}, obtuvo ${figContribNueva && figContribNueva.raw / 1000}`);
  const margenEsperado = +((contribEsperada / ventaEsperada) * 100).toFixed(1);
  const figMargenNuevo = r.boleta.find((f) => f.label === "Falabella · Margen supuesto");
  ok(figMargenNuevo && figMargenNuevo.raw === margenEsperado, `margen supuesto = contribución/venta×100 — esperaba ${margenEsperado}%, obtuvo ${figMargenNuevo && figMargenNuevo.raw}%`);
  ok(r.boleta.every((f) => f.source === "actual" || (f.source === "computed" && typeof f.formula === "string" && f.formula.length)), "TODA cifra 'computed' trae su formula auditable (source:computed+formula, el shape que boleta.js reservó)");

  ok(simulateGeneral({ entity: "Falabella", variableA: { campo: "precioLista", delta_pct: 5 }, variableB: null }).coverage.supported === false, "decline: falta variableB");
  ok(simulateGeneral({ entity: "Falabella", variableA: null, variableB: { campo: "unidades", delta_pct: -10 } }).coverage.supported === false, "decline: falta variableA");
  ok(simulateGeneral({ entity: "Falabella", variableA: { campo: "precioLista", delta_pct: 5 }, variableB: { campo: "precioLista", delta_pct: 3 } }).coverage.supported === false, "decline: mismo campo (precioLista) repetido en las 2 variables");
  ok(simulateGeneral({ entity: "Falabella", variableA: { campo: "precioLista", delta_pct: 0 }, variableB: { campo: "unidades", delta_pct: 0 } }).coverage.supported === false, "decline: 0% en ambas — no hay supuesto que proyectar");
  ok(simulateGeneral({ entity: "Falabella", variableA: { campo: "precioLista", delta_pct: 80 }, variableB: { campo: "unidades", delta_pct: -10 } }).coverage.supported === false, "decline: +80% de precio, fuera del rango operable ±50%");
  ok(simulateGeneral({ entity: "Falabella", variableA: { campo: "precioLista", delta_pct: 5 }, variableB: { campo: "unidades", delta_pct: -60 } }).coverage.supported === false, "decline: -60% de volumen, fuera del rango operable ±50%");
  const rNoEnt = simulateGeneral({ entity: "EmpresaQueNoExiste9999", variableA: { campo: "precioLista", delta_pct: 5 }, variableB: { campo: "unidades", delta_pct: -10 } });
  ok(rNoEnt.coverage.supported === false && /no encuentro/i.test(rNoEnt.coverage.reason), `decline: entidad inexistente, razón honesta — "${rNoEnt.coverage.reason}"`);

  // gating por costModel: empresa2 NO lo declara → solo ventas, nunca costo/margen/contribución inventados.
  initTenant(TENANT_EMPRESA2);
  ok(costModelOf() == null, "empresa2: costModelOf() es null (no declarado) — confirma el fixture del gate");
  const rE2 = simulateGeneral({ dimension: "cliente", entity: "Supermercados del Valle", variableA: { campo: "precioLista", delta_pct: 5 }, variableB: { campo: "unidades", delta_pct: -10 } });
  ok(rE2.coverage.supported === true, "empresa2: la simulación IGUAL responde (no es un error, es un degrade)");
  ok(rE2.facts.costModelAutorizado === false, "empresa2: costModelAutorizado=false");
  ok(!rE2.boleta.some((f) => /Costo|Margen|Contribuci[oó]n/.test(f.label)), "empresa2: NINGÚN fig de costo/margen/contribución en la boleta — solo venta");
  ok(rE2.boleta.some((f) => /Venta/.test(f.label)), "empresa2: SÍ trae venta (aritmética pura, no depende del modelo de costo)");
  ok(rE2.boleta.length === 4, `empresa2 (regresión, mismo bug de arriba): EXACTAMENTE 4 figs (venta actual+supuesta, precio/volumen propuesto), sin fantasmas — obtuvo ${rE2.boleta.length}: ${JSON.stringify(rE2.boleta.map((f) => f.label))}`);
  ok(rE2.boleta.every((f) => f.label.includes(" · ")), "empresa2: TODA fig trae 'Entidad · Campo'");
  initTenant(TENANT_DEMO);
}

console.log("\n── 2 · DETERMINÍSTICO — guardC._simulateGeneralConclusionViolation ──");
{
  const degraded = [{ tool: "simulateGeneral", facts: { costModelAutorizado: false } }];
  const authorized = [{ tool: "simulateGeneral", facts: { costModelAutorizado: true } }];
  const g1 = guardC("Con ese supuesto de precio y volumen, esto no te conviene.", { ledger: { figs: [] }, results: degraded, trace: null, question: "" });
  ok(!g1.ok && g1.verdict === "simulacion-sin-costo-concluye", `degradado + 'conviene' → BLOQUEA — obtuvo ok=${g1.ok} verdict=${g1.verdict}`);
  const g2 = guardC("Con ese supuesto de precio y volumen, la venta baja.", { ledger: { figs: [] }, results: degraded, trace: null, question: "" });
  ok(g2.ok, "degradado SIN 'conviene' → pasa limpio (la limitación no prohíbe describir el efecto en ventas)");
  const g3 = guardC("Con ese supuesto de precio y volumen, esto te conviene.", { ledger: { figs: [] }, results: authorized, trace: null, question: "" });
  ok(g3.ok, "costModel autorizado + 'conviene' → permitido (hay base real para concluir)");
  const g4 = guardC("Esto conviene.", { ledger: { figs: [] }, results: [], trace: null, question: "" });
  ok(g4.ok, "sin ningún result de simulateGeneral → 'conviene' no dispara nada (no es de este contrato)");
}

console.log("\n── 2b · guardC deja citar el % del supuesto CUANDO EL TURNO ACTUAL NO LO NOMBRA (hallazgo EN VIVO) ──");
{
  // Reproducido en vivo (owner 2026-07-31): con mem.pendingSimulation (sección 4 más abajo), el precio (8%) se
  // nombra en el TURNO 1 y el volumen (-2%) en el TURNO 2 — el narrador, correctamente, necesita citar AMBOS para
  // que la simulación se entienda ("si subís el precio a Lider un 8%..."), pero guardC.question del turno 2 SOLO
  // trae el texto de ESE turno ("el volumen baja 2%"), sin "8%" — antes de este fix, "8%" salía como
  // cifra-no-autorizada, los 3 intentos del narrador se agotaban, y C ABSTENÍA ENTERO (caía al pipeline viejo).
  // Las figs "Precio propuesto"/"Volumen propuesto" de la boleta (toolRegistry.js) cierran esto de raíz: el %
  // queda autorizado por SER una fig, sin depender de qué haya dicho el usuario en qué turno.
  const r = simulateGeneral({ dimension: "cliente", entity: "Lider", variableA: { campo: "precioLista", delta_pct: 8 }, variableB: { campo: "unidades", delta_pct: -2 } });
  const narration = "(Datos del año cerrado.) Si le subís el precio a Lider un 8%, con un volumen que baja un 2%, la contribución sube de $3.8M a $5.2M y el margen mejora de 21.5% a 27.3%.";
  const g = guardC(narration, { ledger: { figs: r.boleta }, results: [{ tool: "simulateGeneral", facts: r.facts }], trace: null, question: "el volumen baja 2%" });
  ok(g.ok, `2b: cita "8%" (supuesto del TURNO 1) con question del TURNO 2 (sin "8%") → SÍ autorizado — obtuvo ok=${g.ok} ${g.ok ? "" : JSON.stringify(g.violations)}`);

  // control: un % que el motor NUNCA calculó (ni en boleta ni en el texto de la pregunta) SIGUE bloqueado — esto
  // NO es "aflojar el guard en general", es autorizar específicamente el supuesto que la propia tool ya validó.
  const gBad = guardC("Si le subís el precio a Lider un 15%, mejora bastante.", { ledger: { figs: r.boleta }, results: [{ tool: "simulateGeneral", facts: r.facts }], trace: null, question: "el volumen baja 2%" });
  ok(!gBad.ok, `2b control: un % INVENTADO ("15%", no es el supuesto real de 8%) sigue bloqueado — obtuvo ok=${gBad.ok}`);
}

console.log("\n── 3 · end-to-end MOCKEADO — las 3 variantes de aceptación (owner 2026-07-29/31) ──");

console.log("\n  ▸ 3a · input completo + modelo de costo autorizado → comparación completa");
{
  const PLAN_A = { intent: "answer", mode: "simulacion", calls: [{ tool: "simulateGeneral", args: { dimension: "cliente", entity: "Falabella", variableA: { campo: "precioLista", delta_pct: 5 }, variableB: { campo: "unidades", delta_pct: -10 } } }] };
  let seenResultsA = null;
  const rA = await answerViaOracle({ text: "si subo el precio 5% a Falabella pero pierdo 10% de volumen, ¿me conviene?", history: [], mem: {}, scenario: "actual", callPlan: async () => PLAN_A, callNarrate: async ({ results }) => { seenResultsA = results; return "Con ese supuesto, la venta y el margen se mueven así: esto te conviene."; } });
  ok(rA && rA.r && rA.r.route === "oracle", "3a: responde por C");
  ok(seenResultsA && seenResultsA[0] && seenResultsA[0].facts && seenResultsA[0].facts.costModelAutorizado === true, "3a: el narrador RECIBE costModelAutorizado=true (demo)");
  ok(rA && /convien/i.test(rA.r.text), `3a: 'conviene' SÍ puede aparecer cuando el costo está autorizado — "${rA && rA.r.text}"`);
}

console.log("\n  ▸ 3b · input incompleto (solo precio, sin volumen) → request_clarification, NUNCA asume 0%");
{
  const PLAN_B = { intent: "answer", mode: "simulacion", calls: [], supuestos_faltantes: ["¿cuánto esperás que cambie el volumen o las unidades vendidas?"] };
  let narrateCalledB = false;
  const rB = await answerViaOracle({ text: "si subo el precio a Falabella 5%, ¿me conviene?", history: [], mem: {}, scenario: "actual", callPlan: async () => PLAN_B, callNarrate: async () => { narrateCalledB = true; return "nunca debería aparecer"; } });
  ok(!narrateCalledB, "3b: NUNCA invoca al narrador — el bypass determinístico corta antes (garantía por construcción)");
  ok(rB && rB.r && rB.r.route === "oracle", "3b: responde por C igual (nunca se abstiene en silencio)");
  ok(rB && /volumen|unidades/i.test(rB.r.text), `3b: la pregunta de aclaración pide EXACTAMENTE lo que falta (volumen), no un genérico — "${rB && rB.r.text}"`);
  ok(rB && !/nunca deber[ií]a aparecer/i.test(rB.r.text), "3b: el mock del narrador NUNCA aparece en el texto (no se invocó)");
  ok(rB && rB.mem && rB.mem.lastOffer == null, "3b: no deja una lastOffer (no es una oferta de seguimiento real)");

  // control: variables completas (ninguna falta) → supuestos_faltantes vacío/omitido → SÍ llega a narrar.
  const PLAN_B2 = { intent: "answer", mode: "simulacion", calls: [{ tool: "simulateGeneral", args: { dimension: "cliente", entity: "Falabella", variableA: { campo: "precioLista", delta_pct: 5 }, variableB: { campo: "unidades", delta_pct: -10 } } }] };
  let narrateCalledB2 = false;
  const rB2 = await answerViaOracle({ text: "si subo el precio 5% y bajo el volumen 10%, ¿conviene?", history: [], mem: {}, scenario: "actual", callPlan: async () => PLAN_B2, callNarrate: async () => { narrateCalledB2 = true; return "Respuesta real con ambas variables."; } });
  ok(narrateCalledB2, "control 3b: con las 2 variables completas, SÍ se invoca al narrador (el bypass no se dispara de más)");
  // "Respuesta real..." pasa por ensurePeriodoDeclared (simulateGeneral trae período real) — puede llegar con la
  // cláusula agregada al final, esa es la garantía de siempre funcionando, no un desvío de este bypass.
  ok(rB2 && rB2.r.text.startsWith("Respuesta real con ambas variables."), `control 3b: el texto es la narración real, no la pregunta de aclaración — obtuvo "${rB2 && rB2.r.text}"`);

  // REGRESIÓN — hallazgo EN VIVO (owner 2026-07-31): el LLM a veces NO usa supuestos_faltantes y en cambio asume
  // 0% en silencio en la variable que el usuario no nombró ("si le subo el precio a Falabella 5%" → volvió con
  // variableB.delta_pct=0 puesto solo, sin avisar). La red _silentZeroSupuestoFaltante debe cazarlo IGUAL.
  const PLAN_B3 = { intent: "answer", mode: "simulacion", calls: [{ tool: "simulateGeneral", args: { dimension: "cliente", entity: "Falabella", variableA: { campo: "precioLista", delta_pct: 5 }, variableB: { campo: "unidades", delta_pct: 0 } } }] };
  let narrateCalledB3 = false;
  const rB3 = await answerViaOracle({ text: "si le subo el precio a Falabella 5%, ¿me conviene?", history: [], mem: {}, scenario: "actual", callPlan: async () => PLAN_B3, callNarrate: async () => { narrateCalledB3 = true; return "nunca debería aparecer"; } });
  ok(!narrateCalledB3, "REGRESIÓN: 0% silencioso en volumen (sin supuestos_faltantes del LLM) → la RED lo cachea, NUNCA invoca al narrador");
  ok(rB3 && /volumen|unidades/i.test(rB3.r.text), `REGRESIÓN: la red compone la pregunta de aclaración correcta (volumen) — obtuvo "${rB3 && rB3.r.text}"`);

  // REGRESIÓN — hallazgo EN VIVO (owner 2026-07-31, certificación integral): con un window de historia REAL (8
  // mensajes, incluyendo una simulación ANTERIOR de OTRA entidad) reproducido 1/4 — el usuario contesta EXACTO lo
  // que el turno anterior pidió (el volumen), el plan arma `calls` con AMBAS variables completas y correctas, pero
  // el propio plan, confundido por el ruido de la simulación previa, ADEMÁS marca `supuestos_faltantes` con una
  // pregunta sobre una variable que YA está completa (acá, precio) — stale, contradictorio, y ANTES del fix pisaba
  // el cálculo correcto sin llegar nunca a narrar. `_hasCompleteSimulateVars` debe ignorar ese supuestos_faltantes
  // contradictorio y dejar pasar el cálculo ya completo.
  // NOTA (owner 2026-07-31, coerción de intención de escenario): el texto de este test NO puede contener las
  // palabras literales "precio"/"volumen"/"unidades" — scenarioIntent.js es deliberadamente conservador y, sin
  // mem.pendingSimulation activo, interceptaría CUALQUIER frase con una sola de esas palabras + % ANTES de llegar
  // a callPlan (correcto para el caso real que arregla, pero taparía este test, que existe para ejercitar
  // `_hasCompleteSimulateVars` sobre el propio PLAN_B5, no el detector nuevo). Frase reformulada sin esas palabras
  // para seguir ejercitando ÚNICAMENTE el mecanismo que este test verifica.
  const PLAN_B5 = { intent: "answer", mode: "simulacion", calls: [{ tool: "simulateGeneral", args: { dimension: "cliente", entity: "Lider", variableA: { campo: "precioLista", delta_pct: 8 }, variableB: { campo: "unidades", delta_pct: -2 } } }], supuestos_faltantes: ["¿cuánto esperás que cambie el precio unitario?"] };
  let narrateCalledB5 = false;
  const rB5 = await answerViaOracle({ text: "no creo que cambie mucho, digamos que baja 2% no más", history: [], mem: {}, scenario: "actual", callPlan: async () => PLAN_B5, callNarrate: async () => { narrateCalledB5 = true; return "Respuesta real de Lider con ambas variables."; } });
  ok(narrateCalledB5, "REGRESIÓN: supuestos_faltantes STALE (calls ya completo) → se ignora, SÍ se invoca al narrador");
  ok(rB5 && rB5.r.text.startsWith("Respuesta real de Lider"), `REGRESIÓN: el texto es la narración real, NO la pregunta stale — obtuvo "${rB5 && rB5.r.text}"`);

  // control: el usuario SÍ dijo "sin cambio"/"0%" explícito para esa variable → la red NO se entromete, respeta el 0%.
  const PLAN_B4 = { intent: "answer", mode: "simulacion", calls: [{ tool: "simulateGeneral", args: { dimension: "cliente", entity: "Falabella", variableA: { campo: "precioLista", delta_pct: 5 }, variableB: { campo: "unidades", delta_pct: 0 } } }] };
  let narrateCalledB4 = false;
  const rB4 = await answerViaOracle({ text: "si subo el precio a Falabella 5% y el volumen queda igual, ¿conviene?", history: [], mem: {}, scenario: "actual", callPlan: async () => PLAN_B4, callNarrate: async () => { narrateCalledB4 = true; return "Respuesta real, 0% de volumen fue explícito."; } });
  ok(narrateCalledB4, "control REGRESIÓN: '...el volumen queda igual...' (0% EXPLÍCITO) → la red NO se entromete, sí narra");
}

console.log("\n  ▸ 3c · input completo + modelo de costo NO autorizado → degrade honesto a solo-ventas, JAMÁS 'conviene'");
{
  initTenant(TENANT_EMPRESA2);
  const PLAN_C = { intent: "answer", mode: "simulacion", calls: [{ tool: "simulateGeneral", args: { dimension: "cliente", entity: "Supermercados del Valle", variableA: { campo: "precioLista", delta_pct: 5 }, variableB: { campo: "unidades", delta_pct: -10 } } }] };

  // sub-caso: el narrador (mockeado) IGUAL escribe "conviene" — guardC debe bloquearlo los 3 intentos, reparar
  // desde la boleta (componerPorForma), y el texto FINAL nunca puede tener "conviene".
  let attemptsC1 = 0;
  const rC1 = await answerViaOracle({ text: "si subo el precio 5% a este cliente pero pierdo 10% de volumen, ¿me conviene?", history: [], mem: {}, scenario: "actual", callPlan: async () => PLAN_C, callNarrate: async () => { attemptsC1++; return "Con ese supuesto de precio y volumen, esto no te conviene."; } });
  ok(attemptsC1 === 3, `3c: los 3 intentos del narrador se agotan (mockeado para violar SIEMPRE) — obtuvo ${attemptsC1}`);
  ok(rC1 && rC1.r, "3c: NUNCA se abstiene — repara componiendo desde la boleta (mismo patrón que el resto de C)");
  ok(rC1 && !/convien/i.test(rC1.r.text), `3c: el texto FINAL (reparado) NUNCA tiene 'conviene' — "${rC1 && rC1.r.text}"`);
  ok(rC1 && rC1.r.narrationRepaired === true, "3c: telemetría honesta — la respuesta se compuso desde la boleta, no es narración libre");

  // sub-caso: el narrador (mockeado) NO usa "conviene" — pasa limpio en el primer intento, sin reparar.
  let attemptsC2 = 0;
  const rC2 = await answerViaOracle({ text: "si subo el precio 5% a este cliente pero pierdo 10% de volumen, ¿cómo queda la venta?", history: [], mem: {}, scenario: "actual", callPlan: async () => PLAN_C, callNarrate: async () => { attemptsC2++; return "Con ese supuesto de precio y volumen, la venta baja frente al escenario actual."; } });
  ok(attemptsC2 === 1, `3c control: narración limpia (sin 'conviene') pasa en el PRIMER intento — obtuvo ${attemptsC2}`);
  ok(rC2 && rC2.r && !rC2.r.narrationRepaired, "3c control: NO quedó marcada como reparada — es la narración libre real");
  initTenant(TENANT_DEMO);
}

console.log("\n── 4 · mem.pendingSimulation — riesgo residual #2 de la certificación integral (owner 2026-07-31) ──");
{
  // Mismo bug reproducido en vivo: un turno de confusión adicional puede hacer que PLAN pierda el hilo por
  // completo si confía en re-derivar entidad+variables del texto crudo de la ventana de historia. pendingSimulation
  // resuelve el turno SIGUIENTE determinísticamente, sin volver a invocar PLAN.
  const SAFE = "El negocio se mantiene estable este período, sin sobresaltos que merezcan una alerta.";

  // A) supuestos_faltantes con calls VACÍO (el camino "limpio" que pide planPrompt.js) → pendingSimulation se arma
  // extrayendo la variable YA nombrada del TEXTO de este turno (no de `calls`, que viene vacío por diseño).
  const PLAN_A = { intent: "answer", mode: "simulacion", scope: { level: "entity", entities: ["Lider"] }, calls: [], supuestos_faltantes: ["¿cuánto esperás que cambie el volumen o las unidades vendidas?"] };
  const rA = await answerViaOracle({ text: "¿y si le subo el precio a Lider un 8%, me conviene?", history: [], mem: {}, scenario: "actual", callPlan: async () => PLAN_A, callNarrate: async () => "nunca debería aparecer" });
  const ps = rA && rA.mem && rA.mem.pendingSimulation;
  ok(ps && ps.entity === "Lider" && ps.known.campo === "precioLista" && ps.known.delta_pct === 8 && ps.missingCampo === "unidades",
    `4a: pendingSimulation armado del TEXTO (calls vacío) — entidad/variable/faltante correctos — obtuvo ${JSON.stringify(ps)}`);

  // B) turno siguiente con respuesta direccional limpia ("el volumen baja 2%") → RESUELVE, bypasea PLAN entero,
  // preserva la variable conocida intacta, resuelve la faltante con el SIGNO correcto (verbo "baja" → negativo).
  let planCalledB = false, narrateArgsB = null;
  const rB = await answerViaOracle({
    text: "el volumen baja 2%", history: [], mem: rA.mem, scenario: "actual",
    callPlan: async () => { planCalledB = true; return { intent: "answer", mode: "default", calls: [] }; },
    callNarrate: async (a) => { narrateArgsB = a; return SAFE; },
  });
  ok(!planCalledB, "4b: PLAN nunca se invoca — bypass determinístico, no depende de que el LLM reconstruya el contexto");
  const callB = narrateArgsB && narrateArgsB.plan.calls[0].args;
  ok(callB && callB.variableA.campo === "precioLista" && callB.variableA.delta_pct === 8, "4b: variableA (precio, ya conocida) preservada intacta");
  ok(callB && callB.variableB.campo === "unidades" && callB.variableB.delta_pct === -2, "4b: variableB (volumen) resuelta con signo correcto (-2, el verbo 'baja' lo determina — nunca +2)");
  ok(rB && rB.mem && rB.mem.pendingSimulation == null, "4b: pendingSimulation se limpia tras resolverse (one-shot, no sobrevive a un 2º uso)");

  // C) DISTINCIÓN explícita ausente-vs-0% (punto 2 del pedido de certificación): "el volumen no cambia" debe
  // resolver a delta_pct=0 LEGÍTIMO (el usuario SÍ contestó, y contestó cero) — no debe tratarse como "no contestó".
  const PLAN_C = { intent: "answer", mode: "simulacion", scope: { level: "entity", entities: ["Falabella"] }, calls: [], supuestos_faltantes: ["¿cuánto esperás que cambie el volumen o las unidades vendidas?"] };
  const rC1 = await answerViaOracle({ text: "si subo el precio a Falabella 6%, ¿conviene?", history: [], mem: {}, scenario: "actual", callPlan: async () => PLAN_C, callNarrate: async () => "nunca debería aparecer" });
  let narrateArgsC = null;
  await answerViaOracle({
    text: "el volumen no cambia", history: [], mem: rC1.mem, scenario: "actual",
    callPlan: async () => { throw new Error("PLAN no debería llamarse — 4c"); },
    callNarrate: async (a) => { narrateArgsC = a; return SAFE; },
  });
  ok(narrateArgsC && narrateArgsC.plan.calls[0].args.variableB.delta_pct === 0, "4c: '0% explícito' resuelve a delta_pct=0 LEGÍTIMO — distinto de 'no contestó', nunca se confunden");

  // D) el turno siguiente NO contesta la pregunta pendiente (cambia de tema por completo) → NO se resuelve nada,
  // PLAN corre normal (fresh), nunca fuerza una interpretación sobre texto que no es una respuesta.
  //
  // ── RE-CERTIFICACIÓN DEL CHEQUEO 4d (owner 2026-08-11) ───────────────────────────────────────────────────────
  // Este chequeo afirmaba: "pendingSimulation abandonado limpiamente (no sobrevive al turno que cambió de tema)".
  // Esa afirmación era LA CONDUCTA EQUIVOCADA, y la certificación en vivo la cobró: el usuario decía "sube 8% el
  // precio de Sodimac", ADI le preguntaba por el volumen, el usuario preguntaba otra cosa en el medio y, al volver
  // con el volumen, ADI le pedía DE NUEVO el precio que él ya había dado. Un cambio de tema no es un abandono: es
  // un paréntesis. El pendiente muere cuando se RESUELVE, cuando se REEMPLAZA, cuando una CORRECCIÓN lo invalida
  // o cuando se le acaba el PLAZO — nunca por el mero paso de un turno (ver el ciclo de vida en
  // conversationScope.js). El chequeo se re-expresa en esos términos: acá se certifica que SOBREVIVE con un turno
  // menos de plazo, y la sección 5 certifica cada una de las cuatro formas de morir.
  // (La segunda mitad de la higiene: el turno intercalado preguntaba "¿y cómo viene Sodimac?" y reusaba SAFE. Las
  // dos cosas envenenaban el arnés — "cómo viene" pasó a leerse como pedido de EVOLUCIÓN cuando llegó la política
  // de presentación del turno, así que guardC lo rechazaba por `tabla-faltante`; y SAFE ya estaba narrado por
  // 4b/4c, así que el guard marcaba repetición. Entre las dos, el turno se abstenía y el assert fallaba por un
  // motivo que no tenía nada que ver con la simulación pendiente. Se cambia la redacción y el texto narrado.)
  const SAFE_D = "El perfil de esa cuenta no muestra desvíos relevantes frente al período anterior.";
  const PLAN_D1 = { intent: "answer", mode: "simulacion", scope: { level: "entity", entities: ["Jumbo"] }, calls: [], supuestos_faltantes: ["¿cuánto esperás que cambie el volumen o las unidades vendidas?"] };
  const rD1 = await answerViaOracle({ text: "si le subo el precio a Jumbo 4%, ¿conviene?", history: [], mem: {}, scenario: "actual", callPlan: async () => PLAN_D1, callNarrate: async () => "nunca debería aparecer" });
  let planCalledD = false;
  const rD2 = await answerViaOracle({
    text: "¿qué margen tiene Sodimac?", history: [], mem: rD1.mem, scenario: "actual",
    callPlan: async () => { planCalledD = true; return { intent: "answer", mode: "default", scope: { level: "entity", entities: ["Sodimac"] }, calls: [{ tool: "entityProfile", args: { dimension: "cliente", entity: "Sodimac" } }] }; },
    callNarrate: async () => SAFE_D,
  });
  ok(planCalledD, "4d: cambio de tema → no resuelve el pendiente → PLAN corre normal (fresh), no se fuerza nada");
  const psD2 = rD2 && rD2.mem && rD2.mem.pendingSimulation;
  ok(!!psD2 && psD2.entity === "Jumbo" && psD2.known.delta_pct === 4 && psD2.missingCampo === "unidades" && psD2.restan === rD1.mem.pendingSimulation.restan - 1,
    `4d [RE-CERTIFICADO]: el pendiente SOBREVIVE al cambio de tema con un turno menos de plazo — un paréntesis no es un abandono — obtuvo ${JSON.stringify(psD2)}`);

  // E) número AMBIGUO sin signo ni verbo direccional ("2%" a secas) → NO se adivina la dirección, no resuelve.
  const PLAN_E1 = { intent: "answer", mode: "simulacion", scope: { level: "entity", entities: ["Tottus"] }, calls: [], supuestos_faltantes: ["¿cuánto esperás que cambie el volumen o las unidades vendidas?"] };
  const rE1 = await answerViaOracle({ text: "si le subo el precio a Tottus 3%, ¿conviene?", history: [], mem: {}, scenario: "actual", callPlan: async () => PLAN_E1, callNarrate: async () => "nunca debería aparecer" });
  let planCalledE = false;
  await answerViaOracle({
    text: "2%", history: [], mem: rE1.mem, scenario: "actual",
    callPlan: async () => { planCalledE = true; return { intent: "answer", mode: "default", calls: [] }; },
    callNarrate: async () => SAFE,
  });
  ok(planCalledE, "4e: '2%' sin signo ni verbo direccional es genuinamente ambiguo → no se adivina, PLAN corre normal");
}

console.log(`\n── _simulate_general_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
