/* === _spec_gate.mjs · GATE del SEAM answerADIFromSpec (Paso 4) ===
 * Prueba el seam del spec SIN proveedor LLM: specs escritos a mano → answerADIFromSpec → asserts.
 * Demuestra el objetivo del owner: el LLM habla contra un spec canónico · ADI valida contra el contrato · recién ahí responde.
 * Uso: node _spec_gate.mjs   (exit 1 si algún test falla · para CI). El gate del MOTOR (16/0) corre aparte: node _gate.mjs
 */
import esbuild from "esbuild"; import { pathToFileURL } from "url"; import path from "path"; import fs from "fs";
const root = process.cwd(), out = path.join(root, "_sgb.mjs");
await esbuild.build({ entryPoints: [path.join(root, "src/adi/answerADIFromSpec.js")], bundle: true, outfile: out, format: "esm", platform: "node", logLevel: "silent" });
const M = await import(pathToFileURL(out).href + "?t=" + Math.random());
try { fs.unlinkSync(out); } catch {}
const A = M.answerADIFromSpec;

const S = (o) => ({ schemaVersion: 1, scenario: "actual", filters: {}, ...o });   // spec base + overrides
const blocked = (r, kind) => typeof r.route === "string" && r.route === "spec_blocked_" + kind;
const executes = (r, route) => typeof r.text === "string" && r.text.length > 0 && r.route === route && !/^spec_blocked/.test(r.route);

const TESTS = [
  // ── EJECUTA (spec válido → productor real) ──
  { n: "1 · rank válido ejecuta",        spec: S({ operation: "rank", metric: "ventas", dimension: "cliente", sort: { by: "ventas", dir: "desc" }, limit: 3 }), ok: (r) => executes(r, "ranking_extremes") },
  { n: "2 · overview válido ejecuta",    spec: S({ operation: "overview", metric: "margen", dimension: "cliente" }), ok: (r) => executes(r, "qi_retrieval") },
  { n: "3 · compare 2 clientes ejecuta", spec: S({ operation: "compare", metric: "margen", dimension: "cliente", comparison: { dimension: "cliente", entities: ["Falabella", "Lider"] } }), ok: (r) => executes(r, "client_comparison") },
  { n: "4 · dive cliente ejecuta",       spec: S({ operation: "dive", metric: "margen", dimension: "cliente", entity: "Falabella" }), ok: (r) => executes(r, "client_dive") },
  // ── BLOQUEA HONESTO (validación contra el contrato) ──
  { n: "5 · métrica inexistente bloquea", spec: S({ operation: "overview", metric: "foo", dimension: "cliente" }), ok: (r) => blocked(r, "unknown-metric") },
  { n: "6 · dimensión inválida bloquea",  spec: S({ operation: "rank", metric: "ventas", dimension: "vendedor" }), ok: (r) => blocked(r, "unknown-dimension") },
  { n: "7 · métrica no en dimensión",     spec: S({ operation: "overview", metric: "margen", dimension: "bodega" }), ok: (r) => blocked(r, "metric-not-in-dim") },
  { n: "8 · SKU margen en simulación (base-only) bloquea honesto", spec: S({ operation: "overview", metric: "margen", dimension: "sku", scenario: "simulation", assumption: { type: "margin", value: -5, unit: "pct" } }), ok: (r) => blocked(r, "scenario-blind") },
  // 9 EVOLUCIONADO (matriz 2026-07-09): overview/rank con filtro marca responde por atributo DOMINANTE con la
  // salvedad DECLARADA (antes bloqueaba entero pudiendo responder); el dive con ese cruce SIGUE bloqueando.
  { n: "9 · cruce marca×cliente (overview) responde por DOMINANTE con salvedad declarada", spec: S({ operation: "overview", metric: "margen", dimension: "cliente", filters: { marca: "Bosch" } }), ok: (r) => executes(r, "qi_retrieval") && /salvedad/i.test(r.text) && /DOMINANTE/i.test(r.text) && /Sodimac|Easy/.test(r.text) },
  { n: "9b · cruce marca×cliente en DIVE sigue bloqueando honesto", spec: S({ operation: "dive", metric: "margen", dimension: "cliente", entity: "Falabella", filters: { marca: "Bosch" } }), ok: (r) => blocked(r, "blocked-cross") },
  { n: "10 · operación no soportada ofrece", spec: S({ operation: "forecast", metric: "ventas", dimension: "cliente" }), ok: (r) => blocked(r, "unsupported-op") },
  // 11 EVOLUCIONADO (matriz 2026-07-09): costo está DECLARADO en el contrato → el retrieval genérico lo sirve.
  { n: "11 · costo@cliente EJECUTA vía retrieval del contrato (celda ROTA cableada)", spec: S({ operation: "overview", metric: "costo", dimension: "cliente" }), ok: (r) => executes(r, "qi_retrieval") && /Costo por cliente/i.test(r.text) && /Falabella/.test(r.text) },
  { n: "12 · schemaVersion desconocida bloquea", spec: { schemaVersion: 2, operation: "overview", metric: "ventas", dimension: "cliente" }, ok: (r) => blocked(r, "version") },
  // fix #2 (hallado en el experimento LLM): explain_availability EXPLICA (no cae en el bloqueo genérico metric-not-in-dim)
  { n: "13 · explain_availability(margen@bodega) explica, no bloquea", spec: S({ operation: "explain_availability", metric: "margen", dimension: "bodega" }), ok: (r) => r.route === "spec_explain" && typeof r.text === "string" && /bodega/i.test(r.text) },
  { n: "14 · overview(margen@bodega) SÍ bloquea metric-not-in-dim (regresión #7)", spec: S({ operation: "overview", metric: "margen", dimension: "bodega" }), ok: (r) => blocked(r, "metric-not-in-dim") },
  // productor de inventario spec-driven (capital/rotación/DOH por bodega/sku · sin texto)
  { n: "15 · capital@bodega overview EJECUTA (spec-driven)", spec: S({ operation: "overview", metric: "capital", dimension: "bodega" }), ok: (r) => executes(r, "qi_retrieval") && /Santiago|Valpara|\$/.test(r.text) },
  { n: "16 · rotacion@bodega overview EJECUTA", spec: S({ operation: "overview", metric: "rotacion", dimension: "bodega" }), ok: (r) => executes(r, "qi_retrieval") && /x/.test(r.text) },
  { n: "17 · doh@bodega overview EJECUTA", spec: S({ operation: "overview", metric: "doh", dimension: "bodega" }), ok: (r) => executes(r, "qi_retrieval") },
  { n: "18 · capital@bodega rank top 2 EJECUTA", spec: S({ operation: "rank", metric: "capital", dimension: "bodega", limit: 2, sort: { by: "capital", dir: "desc" } }), ok: (r) => executes(r, "qi_retrieval") },
  { n: "19 · capital@cliente degrada honesto (métrica no en esa dimensión)", spec: S({ operation: "overview", metric: "capital", dimension: "cliente" }), ok: (r) => blocked(r, "metric-not-in-dim") },
  // cobertura FULL de compare/dive (marca/bodega vía composers del motor · sku/familia degradan honesto)
  { n: "20 · compare marca EJECUTA (brand_comparison)", spec: S({ operation: "compare", metric: "margen", dimension: "marca", comparison: { dimension: "marca", entities: ["Samsung", "LG"] } }), ok: (r) => executes(r, "brand_comparison") },
  { n: "21 · dive marca EJECUTA (brand_dive)", spec: S({ operation: "dive", metric: "margen", dimension: "marca", entity: "Samsung" }), ok: (r) => executes(r, "brand_dive") },
  { n: "22 · dive bodega EJECUTA (warehouse_dive)", spec: S({ operation: "dive", metric: "capital", dimension: "bodega", entity: "Santiago" }), ok: (r) => executes(r, "warehouse_dive") },
  { n: "23 · compare SKU EJECUTA (productor spec-driven)", spec: S({ operation: "compare", metric: "margen", dimension: "sku", comparison: { dimension: "sku", entities: ["SAM-REF500L", "SAM-TV55"] } }), ok: (r) => executes(r, "qi_retrieval") && /SAM-REF500L/.test(r.text) },
  { n: "24 · dive SIN métrica ejecuta (dive perfila la entidad · no requiere métrica)", spec: S({ operation: "dive", metric: null, dimension: "marca", entity: "Samsung" }), ok: (r) => executes(r, "brand_dive") },
  // rank marca/familia vía el productor spec-driven genérico (agregados · sourceByAxis)
  { n: "25 · rank margen@marca EJECUTA (agregado spec-driven)", spec: S({ operation: "rank", metric: "margen", dimension: "marca", limit: 3, sort: { by: "margen", dir: "desc" } }), ok: (r) => executes(r, "qi_retrieval") && /%/.test(r.text) },
  { n: "26 · rank contribucion@familia EJECUTA", spec: S({ operation: "rank", metric: "contribucion", dimension: "familia", limit: 3, sort: { by: "contribucion", dir: "desc" } }), ok: (r) => executes(r, "qi_retrieval") && /\$/.test(r.text) },
  { n: "27 · rank ventas@marca EJECUTA", spec: S({ operation: "rank", metric: "ventas", dimension: "marca" }), ok: (r) => executes(r, "qi_retrieval") },
  // 28 EVOLUCIONADO (matriz 2026-07-09): carga@familia se EXPANDIÓ en el contrato (sfamiliasMargen.pctRebate existe).
  { n: "28 · rank carga@familia EJECUTA (contrato expandido)", spec: S({ operation: "rank", metric: "carga", dimension: "familia" }), ok: (r) => executes(r, "qi_retrieval") && /%/.test(r.text) },
  { n: "28b · métrica de verdad NO disponible en el eje degrada honesto (rotación@marca)", spec: S({ operation: "rank", metric: "rotacion", dimension: "marca" }), ok: (r) => /^spec_blocked_/.test(r.route || "") },
  // dive/compare para SKU y familia (productores spec-driven · el motor no tiene composer para estos)
  { n: "29 · dive SKU EJECUTA (perfil comercial + inventario)", spec: S({ operation: "dive", metric: null, dimension: "sku", entity: "SAM-REF500L" }), ok: (r) => executes(r, "qi_retrieval") && /SAM-REF500L/.test(r.text) },
  { n: "30 · dive familia EJECUTA", spec: S({ operation: "dive", metric: null, dimension: "familia", entity: "Electrodomésticos" }), ok: (r) => executes(r, "qi_retrieval") },
  { n: "31 · compare familia EJECUTA", spec: S({ operation: "compare", metric: "margen", dimension: "familia", comparison: { dimension: "familia", entities: ["Electrodomésticos", "Línea Blanca"] } }), ok: (r) => executes(r, "qi_retrieval") },
  { n: "32 · dive SKU inexistente degrada honesto (no lo inventa)", spec: S({ operation: "dive", metric: null, dimension: "sku", entity: "NO-EXISTE-999" }), ok: (r) => blocked(r, "dive-empty") },
  // ── DIAGNOSE · barrido data-driven de focos de pérdida (contribución/carga/capital · ordenados por $) ──
  { n: "33 · diagnose cartera EJECUTA (focos de pérdida con $)", spec: S({ operation: "diagnose", metric: "contribucion", dimension: "cliente" }), ok: (r) => executes(r, "qi_retrieval") && /foco/i.test(r.text) && /\$/.test(r.text) },
  { n: "34 · diagnose con dimensión inválida bloquea honesto", spec: S({ operation: "diagnose", metric: "contribucion", dimension: "vendedor" }), ok: (r) => blocked(r, "unknown-dimension") },
  // ── WHY · el porqué (reusa el mecanismo determinístico · gradúa la certeza) ──
  { n: "35 · why SKU EJECUTA (mecanismo de inventario)", spec: S({ operation: "why", dimension: "sku", entity: "LG-DRYER8KG" }), ok: (r) => executes(r, "why_mechanism") && /Mecanismo/i.test(r.text) },
  { n: "36 · why cliente book-wide REUSA el mecanismo determinístico", spec: S({ operation: "why", dimension: "cliente" }), ok: (r) => r.route === "cross_domain_mechanism" && /carga/i.test(r.text) },
  { n: "37 · why sin entidad (sku) bloquea honesto", spec: S({ operation: "why", dimension: "sku" }), ok: (r) => blocked(r, "why-no-entity") },
  // ── RECOMMEND · qué hacer (SOLO palancas probadas · honesto si no hay) ──
  { n: "38 · recommend cartera EJECUTA (palanca probada + trade-off)", spec: S({ operation: "recommend", dimension: "cliente" }), ok: (r) => executes(r, "recommend_action") && /Recomendaci[oó]n/i.test(r.text) && /probado por el dato/i.test(r.text) },
  { n: "39 · recommend sin foco material bloquea honesto (no inventa solución)", spec: S({ operation: "recommend", dimension: "cliente", entity: "Mercado Libre" }), ok: (r) => blocked(r, "recommend-empty") },
  // ── SCRUB de escenario · el seam NUNCA muestra Bonanza/Tensión/Crisis/escenario (base única = real · demo/prod) ──
  { n: "40 · overview NO filtra escenario (dice 'base real')", spec: S({ operation: "overview", metric: "ventas", dimension: "cliente" }), ok: (r) => !/escenario|bonanza|tensi[oó]n|crisis/i.test(r.text) && /base real/.test(r.text) },
  { n: "41 · compare NO filtra 'cifras runtime sobre escenario'", spec: S({ operation: "compare", metric: "margen", dimension: "cliente", comparison: { dimension: "cliente", entities: ["Falabella", "Lider"] } }), ok: (r) => !/escenario|bonanza|tensi[oó]n|crisis/i.test(r.text) },
  // ── SIMULATE COMPUESTO · 2+ supuestos (op:multi) → degrade honesto (no proyecta parcial ni toma uno en silencio) ──
  { n: "42 · transform op:multi degrada honesto (un supuesto a la vez)", spec: S({ operation: "table", metric: "ventas", dimension: "cliente", transform: { kind: "assumption", op: "multi", base: "real" } }), ok: (r) => blocked(r, "simulate-compound") && /un supuesto a la vez/.test(r.text) },
  // ── SENTRIX · overview/rank/diagnose abren el CUADRO de la cartera (el camino LLM cablea la evidencia · owner 2026-07-06) ──
  { n: "43 · overview → evidence.lens=cuadro + dimensión (abre el Cuadro)", spec: S({ operation: "overview", metric: "ventas", dimension: "cliente" }), ok: (r) => r.evidence && r.evidence.lens === "cuadro" && r.evidence.dimension === "cliente" },
  { n: "44 · diagnose NO se fuerza a cuadro (va al panel de FOCOS · findings es flag-gated · el panel se valida por render-smoke)", spec: S({ operation: "diagnose", metric: "contribucion", dimension: "cliente" }), ok: (r) => executes(r, "qi_retrieval") && !(r.evidence && r.evidence.lens === "cuadro") },
  { n: "45 · rank → evidence.lens=cuadro (abre el Cuadro)", spec: S({ operation: "rank", metric: "margen", dimension: "cliente", sort: { by: "margen", dir: "asc" }, limit: 5 }), ok: (r) => r.evidence && r.evidence.lens === "cuadro" },
  { n: "46 · dive NO se fuerza a cuadro (op fuera del set · el shell/reading es flag-gated aparte)", spec: S({ operation: "dive", metric: "margen", dimension: "cliente", entity: "Falabella" }), ok: (r) => !(r.evidence && r.evidence.lens === "cuadro") },
  // ── FOCO INVENTARIO (owner 2026-07-06 · "la pregunta manda el foco") · capital inmovilizado por bodega/SKU, NO el diagnóstico ──
  { n: "47 · inventory EJECUTA foco capital (evidence.inventory · total/byBodega/bySku · NO diagnóstico genérico)", spec: S({ operation: "inventory", metric: "capital", dimension: "bodega" }), ok: (r) => executes(r, "qi_retrieval") && r.evidence && r.evidence.inventory && Array.isArray(r.evidence.inventory.byBodega) && r.evidence.inventory.byBodega.length > 0 && Array.isArray(r.evidence.inventory.bySku) && r.evidence.inventory.bySku.length > 0 && /capital inmovilizado/i.test(r.text) },
];

let pass = 0, fail = 0; const lines = [];
for (const t of TESTS) {
  let r; try { r = A(t.spec, {}, {}); } catch (e) { r = { route: "THREW", text: String(e && e.message) }; }
  const good = !!t.ok(r);
  if (good) pass++; else fail++;
  lines.push(`  ${good ? "✓" : "✗"} ${t.n}${good ? "" : `   → route="${r.route}" text="${String(r.text).slice(0, 60)}…"`}`);
}
console.log(`── _spec_gate: PASS ${pass} · FAIL ${fail} (de ${TESTS.length}) ──`);
console.log(lines.join("\n"));
process.exit(fail ? 1 : 0);
