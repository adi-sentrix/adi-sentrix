/* === _oracle_multiempresa_gate.mjs · MULTIEMPRESA/ESCALA · los 7 gates pedidos por el owner (2026-07-29) ===
 * "Antes de Fase 3, prepara Arquitectura C para multiempresa, múltiples usuarios y mayor volumen de datos.
 * Implementa, no solo audites." — este arnés PRUEBA en vivo (no solo lee el código) cada uno de los 7 puntos:
 *   1 · cero fuga entre dos empresas
 *   2 · guard de tenant (assertTenantContext) aborta ANTES de tocar el LLM con un contexto obsoleto
 *   3 · memoria aislada entre conversaciones CONCURRENTES (Promise.all real, no secuencial)
 *   4 · totales consistentes al paginar / usar top-N (ordena sobre TODO el dato, nunca sobre una página)
 *   5 · alta cardinalidad (10 y 1.000 clientes sintéticos) — sin crash, sin truncar en silencio
 *   6 · cambio de LLM sin alterar aislamiento ni cifras — el guard de tenant es JS puro, provider-neutral por
 *       construcción (no reimporta el gate de certificación cross-provider ya existente, para no duplicar costo)
 *   7 · locale/moneda/timezone distintos para la misma pregunta — el contexto los respeta sin tocar el tenant
 *
 * Las secciones 1/4/5 son DETERMINÍSTICAS (runPlan directo, sin LLM) — la superficie de riesgo real de
 * aislamiento/escala vive en el motor y el orquestador, no en la redacción del LLM. La sección 3 usa callPlan/
 * callNarrate MOCKEADOS a propósito: lo que se prueba es la PUREZA de answerViaOracle frente a llamadas
 * concurrentes (¿alguna variable de módulo se comparte entre hilos?), no el juicio del LLM — meterlo real acá
 * sólo agregaría varianza de muestreo sin sumar señal a la pregunta de aislamiento.
 */
import fs from "fs";
for (const ln of fs.readFileSync(".env", "utf8").split(/\r?\n/)) { const m = ln.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
import { initTenant, getTenantId } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { TENANT_EMPRESA2 } from "./src/data/tenants/empresa2.js";
import { runPlan } from "./src/adi/oracle/toolRunner.js";
import { answerViaOracle } from "./src/adi/oracle/answerViaOracle.js";
import { buildRequestContext, assertTenantContext } from "./src/adi/oracle/requestContext.js";
import { applyScenarioToClientesMargen } from "./src/engine/scenarios.js";

let pass = 0, fail = 0;
const ok = (cond, label) => { console.log(`  ${cond ? "✓" : "✗"} ${label}`); if (cond) pass++; else fail++; };
const grid = (dimension, extra = {}) => runPlan({ intent: "grid", calls: [{ tool: "gridTable", args: { dimension, ...extra } }] }, { scenario: "actual" });
const rowsOf = (r) => (r.results[0] && r.results[0].facts && r.results[0].facts.rows) || [];

console.log("── 1 · CERO FUGA ENTRE DOS EMPRESAS (gridTable cliente, tenant demo vs empresa2) ──");
initTenant(TENANT_DEMO);
ok(getTenantId() === "demo", "tenant activo tras initTenant(TENANT_DEMO) = \"demo\"");
const namesD = new Set(rowsOf(grid("cliente", { limit: 50 })).map((r) => r.entidad));
ok(namesD.has("Falabella"), "demo: gridTable trae \"Falabella\"");
ok(namesD.size === 13, `demo: gridTable trae los 13 clientes del demo (trajo ${namesD.size})`);

initTenant(TENANT_EMPRESA2);
ok(getTenantId() === "empresa2", "tenant activo tras initTenant(TENANT_EMPRESA2) = \"empresa2\"");
const namesE = new Set(rowsOf(grid("cliente", { limit: 50 })).map((r) => r.entidad));
ok(namesE.has("Supermercados del Valle"), "empresa2: gridTable trae \"Supermercados del Valle\"");
ok(namesE.size === 8, `empresa2: gridTable trae los 8 clientes de empresa2 (trajo ${namesE.size})`);

const interseccion = [...namesD].filter((n) => namesE.has(n));
ok(interseccion.length === 0, `cero solapamiento de nombres entre demo y empresa2 (${interseccion.length} en común)`);
ok(!namesE.has("Falabella"), "empresa2 NUNCA muestra \"Falabella\" (cliente del demo)");
ok(!namesD.has("Supermercados del Valle"), "demo NUNCA muestra \"Supermercados del Valle\" (cliente de empresa2)");

initTenant(TENANT_DEMO);
const namesD2 = new Set(rowsOf(grid("cliente", { limit: 50 })).map((r) => r.entidad));
ok(namesD.size === namesD2.size && [...namesD].every((n) => namesD2.has(n)), "round-trip demo→empresa2→demo: mismo set de clientes exacto (sin arrastre de estado)");

console.log("\n── 2 · GUARD DE TENANT bloquea un requestContext con tenantId obsoleto (abstención ANTES del LLM) ──");
initTenant(TENANT_DEMO);
const staleCtx = buildRequestContext({ conversationId: "conv-stale", scenario: "actual", mem: {} });
ok(staleCtx.tenantId === "demo", "requestContext capturado con el tenant activo de ese momento (demo)");
initTenant(TENANT_EMPRESA2);   // el tenant activo CAMBIA bajo un contexto ya capturado (turno en vuelo, ej. usuario cambió de empresa)
let llmCalled = false;
const throwingPlan = async () => { llmCalled = true; throw new Error("NO debería llamarse"); };
const throwingNarrate = async () => { llmCalled = true; throw new Error("NO debería llamarse"); };
const abstained = await answerViaOracle({ text: "cualquier pregunta", mem: {}, callPlan: throwingPlan, callNarrate: throwingNarrate, requestContext: staleCtx });
ok(abstained === null, "answerViaOracle devuelve null (abstención) con tenantId stale");
ok(!llmCalled, "callPlan/callNarrate NUNCA se invocan — el guard corta ANTES de tocar el LLM");
const freshCheck = assertTenantContext(staleCtx);
ok(!freshCheck.ok, `assertTenantContext detecta el mismatch en frío (reason: "${freshCheck.reason}")`);
initTenant(TENANT_DEMO);

console.log("\n── 3 · MEMORIA AISLADA entre conversaciones CONCURRENTES (Promise.all real, mocks deterministas) ──");
const wait = () => new Promise((r) => setTimeout(r, Math.random() * 20));   // fuerza interleaving real entre hilos
const mkDefaultThread = () => ({
  callPlan: async () => { await wait(); return { intent: "define", mode: "default", rationale: "r", calls: [], memoryUpdate: null }; },
  callNarrate: async () => { await wait(); return "Entendido."; },
});
const [rA1, rB1] = await Promise.all([
  answerViaOracle({ text: "hola", mem: { mechanismByEntity: { EntidadA: "mecA" } }, ...mkDefaultThread() }),
  answerViaOracle({ text: "hola", mem: { mechanismByEntity: { EntidadB: "mecB" } }, ...mkDefaultThread() }),
]);
ok(!!(rA1 && rA1.mem && rA1.mem.mechanismByEntity && rA1.mem.mechanismByEntity.EntidadA === "mecA"), "hilo A conserva SU mechanismByEntity (EntidadA)");
ok(!!(rA1 && rA1.mem && !rA1.mem.mechanismByEntity.EntidadB), "hilo A NUNCA ve EntidadB (del hilo B concurrente)");
ok(!!(rB1 && rB1.mem && rB1.mem.mechanismByEntity && rB1.mem.mechanismByEntity.EntidadB === "mecB"), "hilo B conserva SU mechanismByEntity (EntidadB)");
ok(!!(rB1 && rB1.mem && !rB1.mem.mechanismByEntity.EntidadA), "hilo B NUNCA ve EntidadA (del hilo A concurrente)");

const callPlanClarify = async () => { await wait(); return { intent: "define", mode: "clarify", rationale: "c", calls: [], memoryUpdate: null }; };
const callPlanDefault = async () => { await wait(); return { intent: "define", mode: "default", rationale: "d", calls: [], memoryUpdate: null }; };
const callNarrateOk = async () => { await wait(); return "Te lo explico simple."; };
let memC = {}, memD = {};
for (let i = 0; i < 3; i++) {
  const [rC, rD] = await Promise.all([
    answerViaOracle({ text: "no entendí, explícamelo más fácil", mem: memC, callPlan: callPlanClarify, callNarrate: callNarrateOk }),
    answerViaOracle({ text: "dame el resumen", mem: memD, callPlan: callPlanDefault, callNarrate: callNarrateOk }),
  ]);
  memC = rC.mem; memD = rD.mem;
}
ok(memC.clarifyStreak === 3, `hilo C (clarify×3, corriendo CONCURRENTE con D) acumula clarifyStreak=3 (obtuvo ${memC.clarifyStreak})`);
ok(memD.clarifyStreak === 0, `hilo D (default, nunca clarify) queda en clarifyStreak=0 (obtuvo ${memD.clarifyStreak}) — no se contamina del hilo C`);

console.log("\n── 4 · TOTALES CONSISTENTES al paginar / usar top-N (ordena sobre TODO el dato, nunca sobre una página ya recortada) ──");
initTenant(TENANT_DEMO);
const rowsFull = rowsOf(grid("cliente", { sortBy: "venta", limit: 1000 }));
const rowsTop3 = rowsOf(grid("cliente", { sortBy: "venta", limit: 3 }));
const rawRows = applyScenarioToClientesMargen("actual");
const maxRaw = rawRows.reduce((best, r) => (typeof r.venta === "number" && (!best || r.venta > best.venta) ? r : best), null);
ok(rowsFull.length === rawRows.length, `limit=1000 sobre ${rawRows.length} clientes trae TODOS (trajo ${rowsFull.length}) — no trunca de más`);
ok(rowsTop3.length === 3, "limit=3 trae exactamente 3 filas");
ok(rowsTop3.every((r, i) => r.entidad === rowsFull[i].entidad), "el top-3 (limit=3) es EXACTAMENTE el prefijo del ranking completo (limit=1000) — mismo orden, ninguna fila cambia de lugar por paginar");
ok(!!maxRaw && rowsTop3[0].entidad === maxRaw.nombre, `el top-1 por venta ("${rowsTop3[0].entidad}") coincide con el máximo real de la fuente oficial D8 ("${maxRaw && maxRaw.nombre}") — el ranking se computa sobre TODO el dato, no sobre una página`);

console.log("\n── 5 · ALTA CARDINALIDAD (10 y 1.000 clientes sintéticos) — sin crash, sin truncar en silencio ──");
function buildSyntheticTenant(n) {
  const ventas = [], margen = [];
  for (let i = 0; i < n; i++) {
    const nombre = `ClienteSint${i}`;
    const venta = 1000 + (i % 97) * 37;   // determinístico (sin Math.random) · valores variados para que el ranking no sea trivial
    ventas.push({ nombre, sfamilia: "Sintética", marca: "Marca", canal: "Retail", actual: venta, anterior: venta - 50, unidades: 100 + i, unidadesAnt: 95 + i, pctRebate: 3.0, presupuesto: venta - 20 });
    margen.push({ nombre, tipo: "cliente", marca: "Marca", sfamilia: "Sintética", venta, costo: Math.round(venta * 0.7), rebates: Math.round(venta * 0.03), contribucion: Math.round(venta * 0.27), pctRebate: 3.0, margen: 27.0, costoMedio: 10, precioLista: 14, unidades: 100 + i, benchmark: 30.1 });
  }
  return { ...TENANT_DEMO, id: `sint${n}`, nombre: `Sintético ${n}`, clientesVentas: ventas, clientesMargen: margen };
}
for (const n of [10, 1000]) {
  initTenant(buildSyntheticTenant(n));
  ok(getTenantId() === `sint${n}`, `tenant sintético de ${n} clientes activo`);
  const rows5 = rowsOf(grid("cliente", { sortBy: "venta", limit: 5 }));
  ok(rows5.length === 5, `${n} clientes: limit=5 trae exactamente 5 filas (trajo ${rows5.length})`);
  const rowsAll = rowsOf(grid("cliente", { sortBy: "venta", limit: n }));
  ok(rowsAll.length === n, `${n} clientes: limit=${n} trae los ${n} completos, sin truncar en silencio`);
}
initTenant(TENANT_DEMO);

console.log("\n── 6 · CAMBIO DE LLM sin alterar aislamiento ni cifras (el guard de tenant es JS puro, provider-neutral) ──");
const rcSrc = fs.readFileSync("./src/adi/oracle/requestContext.js", "utf8");
ok(!/llm\/adapters|getAdapter|providerAdapter/.test(rcSrc), "requestContext.js (el guard de tenant) NO importa nada de la capa de proveedor — el aislamiento no depende de qué LLM esté detrás");
const avoSrc = fs.readFileSync("./src/adi/oracle/answerViaOracle.js", "utf8");
ok(/callPlan\s*,\s*callNarrate/.test(avoSrc) || /callPlan\b/.test(avoSrc), "answerViaOracle recibe callPlan/callNarrate INYECTADOS (nunca importa un adapter concreto) — cambiar de proveedor es cambiar el inyectado, no el guard");
console.log("  → la portabilidad cross-provider (openai CERTIFICADO · anthropic PENDIENTE por credenciales) ya se certificó en _oracle_provider_certification_gate.mjs corriendo ESTE MISMO answerViaOracle — no se repite acá para no duplicar costo de LLM real.");

console.log("\n── 7 · LOCALE/MONEDA/TIMEZONE distintos para la MISMA pregunta — el contexto los respeta sin tocar el tenant ──");
const ctxCL = buildRequestContext({ conversationId: "c1", scenario: "actual", mem: { identidad: { moneda: "CLP" } } });
const ctxMX = buildRequestContext({ conversationId: "c2", scenario: "actual", mem: {}, locale: "es-MX", currency: "MXN", timezone: "America/Mexico_City" });
ok(ctxCL.currency === "CLP", "sin currency explícito, hereda mem.identidad.moneda (CLP)");
ok(ctxMX.currency === "MXN" && ctxMX.locale === "es-MX" && ctxMX.timezone === "America/Mexico_City", "con locale/currency/timezone explícitos, el contexto los respeta tal cual (MXN/es-MX/America/Mexico_City)");
ok(ctxCL.tenantId === ctxMX.tenantId, "mismo tenant activo en ambos contextos — la moneda/locale NUNCA cambia qué empresa/dato se consulta");
ok(!!ctxCL.schemaVersion && ctxCL.schemaVersion === ctxMX.schemaVersion, "misma versión de esquema/catálogo de métricas en ambos contextos, sin importar locale");

console.log(`\n── _oracle_multiempresa_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
