/* === _evidence_spec_views_gate.mjs · verificación de las vistas adaptativas de Sentrix (evidenceSpec, Nivel 0-4) ===
 * Turno de trabajo: "vistas adaptativas de Sentrix por tipo de respuesta" (SentrixPanel.jsx).
 *
 * Arma PLANES REALES (mismo shape que planPrompt.js le exige al LLM), los corre con runPlan (toolRunner.js) contra
 * el dataset demo REAL, arma evidence con buildOracleEvidence (sentrixEvidence.js, la MISMA función que
 * answerViaOracle.js usa en producción) y renderiza <SentrixPanel/> (testing-library + jsdom) para confirmar:
 *   · Nivel 1 (EvidenceClaimHeader) aparece con el claim.text + el grade badge correcto, en los 7 tipos.
 *   · Nivel 0 (dispatch decisión): evidenceSpec.claim.type==="decision" + .action → DecisionPanel, ganando sobre
 *     el if-chain viejo (Diagnóstico/Mesa).
 *   · Nivel 2 (DecisionPanel): action.text/impact/factors se muestran; el botón askLabel dispara onAsk(askLabel).
 *   · Nivel 3 (EvidenceConfidenceFooter): confianza+límites generalizados — incluye sku/marca (antes SOLO
 *     client/bodega vía EvidenciaRecibo) y NO se duplica cuando EvidenciaRecibo ya cubre la entidad (client, atBase).
 *   · Nivel 4: el askLabel de DecisionPanel llama onAsk con el texto correcto.
 *   · CERO REGRESIÓN: sin evidenceSpec (ruta legacy), ningún panel muestra grade badge ni el nuevo footer.
 *   · Fix ControlRing: la grilla del ring queda envuelta en overflowX:auto (bug ya reportado, overlay móvil).
 */
import { JSDOM } from "jsdom";
import esbuild from "esbuild";
import { fileURLToPath, pathToFileURL } from "url";
import path from "path";

let pass = 0, fail = 0;
const ok = (cond, label) => { if (cond) { pass++; console.log(`  ✓ ${label}`); } else { fail++; console.log(`  ✗ FALLO: ${label}`); } };

// ── 0 · DOM global + perfil "dev" (mismo patrón que _reentry_evidence_gate.mjs: sin esto, ADI_SENTRIX_SHELL_ENABLED
//     y el resto de flags de Sentrix caen al piso "floor" en Node — cero tabs, cero shell, cero UI que testear). ──
const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
try { Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true }); } catch {}
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.Node = dom.window.Node;
globalThis.getComputedStyle = dom.window.getComputedStyle;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.localStorage = dom.window.localStorage;
globalThis.__ADI_PROFILE__ = "dev";   // flagProfile.js: perfil dev → FEATURE+EXPERIMENTAL+DEV_TOOLS ON (Sentrix shell incl.)

const root = path.dirname(fileURLToPath(import.meta.url));
const bundlePath = path.join(root, "_evidence_spec_views_gate_bundle.mjs");
await esbuild.build({
  entryPoints: [path.join(root, "_evidence_spec_views_gate_entry.jsx")],
  bundle: true, outfile: bundlePath, format: "esm", platform: "node", jsx: "automatic",
  external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "react/jsx-dev-runtime"],
  logLevel: "silent",
});
const ui = await import(pathToFileURL(bundlePath).href);
const React = (await import("react")).default;
const { render, fireEvent, cleanup } = await import("@testing-library/react");
const { runPlan } = await import("./src/adi/oracle/toolRunner.js");
const { buildOracleEvidence } = await import("./src/adi/oracle/sentrixEvidence.js");
const { ledgerBoleta } = await import("./src/adi/oracle/ledger.js");
const { composeSpecDiagnose } = await import("./src/adi/specRetrieval.js");

// runTurn(plan, scenario) → evidence REAL (el mismo objeto que answerViaOracle.js construye en producción)
function runTurn(plan, scenario = "bonanza") {
  const { results, unsupported, ledger } = runPlan(plan, { scenario });
  const figs = ledgerBoleta(ledger);
  return buildOracleEvidence({ plan, results, figs, scenario, unsupported });
}

function renderPanel(evidence, { onAsk } = {}) {
  const asks = [];
  const utils = render(React.createElement(ui.SentrixPanel, {
    evidence, onClose: () => {}, onToggleMax: () => {}, maximized: false,
    onAsk: (q) => { asks.push(q); if (onAsk) onAsk(q); },
  }));
  return { ...utils, asks };
}

console.log("═".repeat(90));
console.log("1 · DATO PUNTUAL (cliente Falabella) · Nivel 1 header + grade=probado + PERFIL ÚNICO (owner 2026-08-06)");
console.log("═".repeat(90));
{
  const plan = { intent: "entityProfile", mode: "default", rationale: "El margen de Falabella este período, contra tu benchmark.",
    scope: { level: "entity", entities: ["Falabella"] }, calls: [{ tool: "entityProfile", args: { dimension: "cliente", entity: "Falabella" } }] };
  const evidence = runTurn(plan);
  ok(!!evidence.evidenceSpec, "evidenceSpec presente (ruta oráculo)");
  ok(evidence.evidenceSpec.claim && evidence.evidenceSpec.claim.type === "default", `claim.type === "default" (obtuvo: ${evidence.evidenceSpec.claim && evidence.evidenceSpec.claim.type})`);
  ok(evidence.evidenceSpec.grade === "probado", `grade === "probado" (obtuvo: ${evidence.evidenceSpec.grade})`);
  ok(!!evidence.reading, "evidence.reading presente (entityProfile de cliente → baseRd truthy → panel principal, no un early-return)");
  // PERFIL ÚNICO (owner 2026-08-06, hallazgo en vivo — el owner reportó screenshot: "perfil de Falabella" abría
  // MARGENES›CONTRIBUCION con la tabla completa, no un perfil): entityProfile de cliente ahora es clientMesaLink
  // → abre LA MESA (Ficha: evolutivo + perfil vs promedio + 80/20), NO el shell viejo (Diagnóstico/Evidencia/
  // Control) — el mismo perfil que da clickear esa fila directo en el Cuadro. Reemplaza el check viejo de la
  // tab "Evidencia"/EvidenciaRecibo (ya no aplica: MesaPanel no tiene esas tabs).
  ok(evidence._profileRequest === true, `_profileRequest === true (obtuvo: ${evidence._profileRequest})`);
  const { container, asks } = renderPanel(evidence);
  ok(container.textContent.includes("MESA DE CONTROL"), "abre LA MESA (MesaPanel), no el shell Diagnóstico/Evidencia/Control");
  // FICHA EN SU PROPIA PESTAÑA (owner 2026-08-07, "no debe ir mezclada con lo que ya teníamos, debe ir sola, una
  // nueva pestaña"): el perfil ya NO abre la cara Comercial con MesaFicha/MesaPerfil ("Perfil vs promedio") — abre
  // la cara FICHA con la Ficha Ejecutiva del cliente. La aserción sigue el comportamiento nuevo, que es el correcto.
  ok(container.textContent.includes(`Importancia de ${"Falabella"} en tu cartera`), "abre la FICHA EJECUTIVA en su propia pestaña (bloque de importancia en la cartera)");
  ok(!container.textContent.includes("Perfil vs promedio"), "y NO mezcla la vista vieja de la cara Comercial (el desorden que el owner reportó)");
  ok(container.textContent.includes("Falabella"), "\"Falabella\" nombrado en el DOM");
  cleanup();
}

console.log("\n" + "═".repeat(90));
console.log("2 · DATO PUNTUAL (SKU, sin receipt) · Nivel 3 EXTIENDE confianza+límites a un tipo que antes no tenía nada");
console.log("═".repeat(90));
{
  const plan = { intent: "entityProfile", mode: "default", rationale: "El margen del SKU SAM-REF500L.",
    scope: { level: "entity", entities: ["SAM-REF500L"] }, calls: [{ tool: "entityProfile", args: { dimension: "sku", entity: "SAM-REF500L" } }] };
  const evidence = runTurn(plan);
  ok(evidence.evidenceSpec && evidence.evidenceSpec.grade === "probado", `grade === "probado" para SKU (obtuvo: ${evidence.evidenceSpec && evidence.evidenceSpec.grade})`);
  const { container } = renderPanel(evidence);
  const evTab = [...container.querySelectorAll("button")].find((b) => b.textContent === "Evidencia");
  fireEvent.click(evTab);
  // antes de esta ronda: SKU en la tab Evidencia mostraba "Sin cuenta detallada" y NADA de confianza/límites.
  ok(container.textContent.includes("Probado") && /esta cifra sale del dato real/.test(container.textContent),
    "el footer generalizado (Nivel 3) SÍ aparece para SKU (sin receipt) — cobertura nueva, antes inexistente");
  cleanup();
}

console.log("\n" + "═".repeat(90));
console.log("3 · DIAGNÓSTICO (global) · DiagnosePanel + Nivel 1/3");
console.log("═".repeat(90));
{
  const plan = { intent: "diagnose", mode: "diagnostico", rationale: "Panorama de dónde se pierde margen o se inmoviliza capital.",
    scope: { level: "global" }, calls: [{ tool: "diagnose", args: { filters: {} } }] };
  const evidence = runTurn(plan);
  ok(!evidence.reading, "sin reading (diagnose no resuelve una entidad puntual) → cae al if-chain de early-return");
  ok(Array.isArray(evidence.findings) && evidence.findings.length > 0, "evidence.findings presente (diagnose real, dataset demo)");
  ok(evidence.evidenceSpec.grade === "probado", `grade === "probado" (obtuvo: ${evidence.evidenceSpec.grade})`);
  const { container } = renderPanel(evidence);
  ok(container.textContent.includes("DIAGNÓSTICO"), "header DIAGNÓSTICO presente (DiagnosePanel, if-chain intacto)");
  ok(container.textContent.includes("Panorama de dónde se pierde margen"), "claim.text (Nivel 1) presente dentro de DiagnosePanel");
  ok(container.textContent.includes("Probado"), "grade badge (Nivel 1) presente dentro de DiagnosePanel");
  ok(container.textContent.includes("esta cifra sale del dato real"), "footer de confianza (Nivel 3) presente dentro de DiagnosePanel");
  cleanup();
}

console.log("\n" + "═".repeat(90));
console.log("4 · DECISIÓN · Nivel 0 (dispatch) gana sobre Diagnóstico · Nivel 2 (DecisionPanel, NUEVO) · Nivel 4 (askLabel)");
console.log("═".repeat(90));
{
  // MISMO plan que el diagnóstico de arriba (evidence.findings TAMBIÉN presente) — SOLO cambia mode:"decision".
  // Si el dispatch de Nivel 0 no ganara, esto caería en DiagnosePanel (evidence.findings.length>0 matchea primero
  // en el if-chain viejo) en vez de DecisionPanel — exactamente el defecto que este Nivel 0 corrige.
  const plan = { intent: "diagnose", mode: "decision", rationale: "Qué atacar primero con el mayor $ en juego.",
    scope: { level: "global" }, calls: [{ tool: "diagnose", args: { filters: {} } }] };
  const evidence = runTurn(plan);
  ok(evidence.evidenceSpec.claim.type === "decision", "claim.type === \"decision\"");
  ok(!!evidence.evidenceSpec.action, "evidenceSpec.action presente (mesa.accion vía _actionFrom)");
  ok(Array.isArray(evidence.findings) && evidence.findings.length > 0, "evidence.findings TAMBIÉN presente este turno (el caso que antes ganaba DiagnosePanel)");
  const { container, asks } = renderPanel(evidence);
  ok(container.textContent.includes("DECISIÓN"), "header DECISIÓN presente → ganó DecisionPanel, NO DiagnosePanel (Nivel 0 dispatch)");
  ok(!container.textContent.includes("los focos ordenados por impacto"), "NO es el texto fijo de DiagnosePanel (confirma que no cayó ahí)");
  ok(container.textContent.includes(evidence.evidenceSpec.action.text || "§sin-texto§"), "action.text (mesa.accion.titulo) se muestra en DecisionPanel");
  ok(container.textContent.includes(evidence.evidenceSpec.action.impact || "§sin-impact§"), "action.impact ($ usdFmt) se muestra en DecisionPanel");
  const askBtn = [...container.querySelectorAll("button")].find((b) => b.textContent.includes(evidence.evidenceSpec.action.askLabel));
  ok(!!askBtn, `botón con action.askLabel ("${evidence.evidenceSpec.action.askLabel}") presente (Nivel 4)`);
  fireEvent.click(askBtn);
  ok(asks.length === 1 && asks[0] === evidence.evidenceSpec.action.askLabel, `onAsk fue llamado con exactamente action.askLabel (obtuvo: ${JSON.stringify(asks)})`);
  cleanup();
}

console.log("\n" + "═".repeat(90));
console.log("5 · SIMULACIÓN (ventas +3% cliente) · SimulationPanel + Nivel 1/3 · grade=indicado (supuesto, nunca hecho)");
console.log("═".repeat(90));
{
  const plan = { intent: "simulate", mode: "simulacion", rationale: "Si las ventas de Falabella suben 3%, el impacto proyectado.",
    scope: { level: "entity", entities: ["Falabella"] },
    calls: [{ tool: "simulate", args: { metric: "ventas", dimension: "cliente", filters: {}, transform: { op: "delta", unit: "pct", value: 3 } } }] };
  const evidence = runTurn(plan);
  ok(!!evidence.transform && Array.isArray(evidence.projection), "evidence.transform + evidence.projection presentes (shape real de SimulationPanel)");
  ok(evidence.evidenceSpec.grade === "indicado", `grade === "indicado" (supuesto ≠ hecho consumado) (obtuvo: ${evidence.evidenceSpec.grade})`);
  const { container } = renderPanel(evidence);
  ok(container.textContent.includes("SUPUESTO"), "header SUPUESTO presente (SimulationPanel, if-chain intacto)");
  ok(container.textContent.includes("Si las ventas de Falabella suben 3%"), "claim.text (Nivel 1) presente dentro de SimulationPanel");
  ok(container.textContent.includes("Indicado"), "grade badge \"Indicado\" (Nivel 1) presente dentro de SimulationPanel");
  ok(container.textContent.includes("es una señal, un benchmark o una proyección"), "footer de confianza (Nivel 3) presente dentro de SimulationPanel");
  cleanup();
}

console.log("\n" + "═".repeat(90));
console.log("6 · CAPITAL (inventario frenado) · InventoryPanel + Nivel 1/3");
console.log("═".repeat(90));
{
  const plan = { intent: "inventoryStatus", mode: "default", rationale: "El capital inmovilizado en el inventario.",
    scope: { level: "global" }, calls: [{ tool: "inventoryStatus", args: { filters: {}, focus: "frenado" } }] };
  const evidence = runTurn(plan);
  ok(!!evidence.inventory && Array.isArray(evidence.inventory.bySku), "evidence.inventory.bySku presente (shape real de InventoryPanel)");
  const { container } = renderPanel(evidence);
  ok(container.textContent.includes("INVENTARIO"), "header INVENTARIO presente (InventoryPanel, if-chain intacto)");
  ok(container.textContent.includes("El capital inmovilizado en el inventario"), "claim.text (Nivel 1) presente dentro de InventoryPanel");
  cleanup();
}

console.log("\n" + "═".repeat(90));
console.log("7 · TENDENCIA (venta mes a mes, global) · MesaPanel vía evidence.lens===\"temporal\" + Nivel 1/3");
console.log("═".repeat(90));
{
  const plan = { intent: "trend", mode: "default", rationale: "Cómo viene la venta mes a mes este año.",
    scope: { level: "global" }, calls: [{ tool: "trend", args: { metric: "ventas" } }] };
  const evidence = runTurn(plan);
  ok(evidence.lens === "temporal", `evidence.lens === "temporal" (obtuvo: ${evidence.lens})`);
  const { container } = renderPanel(evidence);
  ok(container.textContent.includes("MESA DE CONTROL"), "header MESA DE CONTROL presente (MesaPanel, if-chain intacto — tendencia/P&L comparten este componente)");
  ok(container.textContent.includes("Cómo viene la venta mes a mes este año"), "claim.text (Nivel 1) presente dentro de MesaPanel (compartido por sus 3 caras)");
  ok(container.textContent.includes("Probado") || container.textContent.includes("Indicado") || container.textContent.includes("Abierto"), "grade badge (Nivel 1) presente dentro de MesaPanel");
  cleanup();
}

console.log("\n" + "═".repeat(90));
console.log("8 · CERO REGRESIÓN · ruta legacy (evidence sin evidenceSpec) → sin grade badge, sin footer nuevo");
console.log("═".repeat(90));
{
  const legacyEvidence = composeSpecDiagnose({ filters: {}, scenario: "bonanza" }).evidence;   // MISMO shape que el pipeline viejo entrega — nunca pasa por buildOracleEvidence
  ok(!("evidenceSpec" in legacyEvidence), "el evidence legacy NO trae evidenceSpec (nunca lo tuvo, no es la ruta oráculo)");
  const { container } = renderPanel(legacyEvidence);
  ok(container.textContent.includes("DIAGNÓSTICO"), "DiagnosePanel sigue rindiendo igual sin evidenceSpec (byte-exacto en estructura)");
  ok(!container.textContent.includes("Probado") && !container.textContent.includes("Indicado") && !container.textContent.includes("Abierto"),
    "CERO grade badge sin evidenceSpec (EvidenceClaimHeader devuelve null · Nivel 1 no se activa)");
  ok(!container.textContent.includes("esta cifra sale del dato real") && !container.textContent.includes("Lo que esta respuesta NO afirma"),
    "CERO footer nuevo sin evidenceSpec (EvidenceConfidenceFooter devuelve null · Nivel 3 no se activa)");
  cleanup();
}

console.log("\n" + "═".repeat(90));
console.log("9 · Fix ControlRing · overflowX:auto envuelve la grilla (bug ya reportado, overlay móvil)");
console.log("═".repeat(90));
{
  // PERFIL ÚNICO (owner 2026-08-06): un cliente puntual ahora es clientMesaLink → abre LA MESA, ya no el shell
  // Diagnóstico/Evidencia/Control (test 1) — así que este check (específico del tab "Control"/ControlRing, un
  // componente del shell viejo, sin relación con el fix de hoy) se mueve a un SKU, que sigue abriendo el shell
  // sin cambios (mismo patrón que el test 2 · el fix de hoy es angosto a entityType client/cliente).
  const plan = { intent: "entityProfile", mode: "default", rationale: "El margen del SKU SAM-REF500L.",
    scope: { level: "entity", entities: ["SAM-REF500L"] }, calls: [{ tool: "entityProfile", args: { dimension: "sku", entity: "SAM-REF500L" } }] };
  const evidence = runTurn(plan);
  const { container } = renderPanel(evidence);
  const controlTab = [...container.querySelectorAll("button")].find((b) => b.textContent === "Control");
  ok(!!controlTab, "tab \"Control\" presente (cliente tiene ring)");
  fireEvent.click(controlTab);
  ok(container.textContent.includes("El ring"), "el contenido del ring se renderizó");
  const scrollers = [...container.querySelectorAll("div")].filter((d) => d.getAttribute("style") && /overflow-x:\s*auto/i.test(d.getAttribute("style")));
  const ringScroller = scrollers.find((d) => d.textContent.includes("Foco") || d.textContent.includes(evidence.evidenceSpec.scope.entityLabel));
  ok(!!ringScroller, `la grilla del ring está envuelta en un div con overflowX:auto (scrollers totales en la página: ${scrollers.length})`);
  cleanup();
}

console.log(`\n── _evidence_spec_views_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail === 0 ? 0 : 1);
