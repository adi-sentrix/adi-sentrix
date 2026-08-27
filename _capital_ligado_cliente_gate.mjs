/* === _capital_ligado_cliente_gate.mjs · DECISIÓN 9 DEL OWNER (2026-08-09) · hallazgo J ========================
 * "entityCapitalLigado no puede repetir el inventario global para cada cliente. Retirar toda afirmación
 *  cliente-específica hasta que exista una relación válida. Si se usa afinidad modelada, sale INDICADO y nunca
 *  como capital PERTENECIENTE al cliente."
 *
 * EL DEFECTO MEDIDO, antes de este arreglo: la tool devolvía subtotal $33.200 y los MISMOS 3 SKU
 * (LG-DRYER8KG · BOS-SANDER · MAK-COMP-AIR), byte-idénticos, para las 13 cuentas del tenant demo — una sola
 * firma para 13 clientes. Causa raíz: el "mix" del cliente sale de `clienteSkuMatrix` (IPF de afinidad
 * MODELADA, no transacciones), y todos sus pesos son > 0, así que el surtido de cualquier cliente abarca los 13
 * SKU con inventario. Intersecar el inventario contra ese surtido devuelve el inventario COMPLETO del negocio.
 * El Perfil Ejecutivo lo mostraba como "Inventario de baja rotación en productos que compra <cliente>" y el chat
 * como "capital detenido en SKU que compra <cliente>" — la mitad de esa afirmación es falsa.
 *
 * Y contradecía una declaración que el propio producto ya hacía: `sentrix/capability.js` declara
 * `crosses.atomic === false` y BLOQUEA la vista "productos que le vendo a este cliente" por "no existe
 * granularidad atómica cliente×SKU en los datos".
 *
 * ESTE GATE verifica las cuatro puntas del arreglo, sobre el dato real, en los cuatro escenarios y sin red:
 *   [1] LA TOOL declina con razón verificable · cero cifra cliente-específica, cero boleta.
 *   [2] LA MEDICIÓN sale del dato (no se asume) y es la MISMA para el composer y para el plan.
 *   [3] LA FICHA declara la limitación en vez de rellenar (render real de SentrixPanel).
 *   [4] NINGÚN OTRO SITIO del producto consume esa cifra creyendo que es por cliente.
 * Determinístico · sin proveedor · sin red. */
import { JSDOM } from "jsdom";
import esbuild from "esbuild";
import { fileURLToPath, pathToFileURL } from "url";
import path from "path";

let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ FALLO: " + m + (extra ? "\n      " + extra : "")); } };
const H = (t) => console.log("\n" + t + "\n" + "─".repeat(Math.min(100, t.length)));

// vía 1 (2026-08-20): el dataset se DECLARA acá, y ANTES de los imports dinámicos de abajo. Ojo con el orden: esas
// líneas DESESTRUCTURAN el namespace (`const { clientesVentas } = await import(…)`), o sea que capturan el VALOR del
// momento — no un live binding. Declarar el tenant después dejaría a este gate mirando la forma vacía.
const { initTenant } = await import("./src/data/tenantStore.js");
const { TENANT_DEMO } = await import("./src/data/tenants/demo.js");
initTenant(TENANT_DEMO);

const { TOOLS } = await import("./src/adi/oracle/toolRegistry.js");
const { clientCapitalRelacion, composeSpecClientCapital } = await import("./src/adi/specRetrieval.js");
const { datasetCapability, entityExplorable } = await import("./src/adi/sentrix/capability.js");
const { clientesVentas, skuInventario } = await import("./src/data/demoData.js");
const { POLICY } = await import("./src/config/businessPolicy.js");
const { runPlan } = await import("./src/adi/oracle/toolRunner.js");
const { ledgerBoleta } = await import("./src/adi/oracle/ledger.js");
const { buildOracleEvidence } = await import("./src/adi/oracle/sentrixEvidence.js");

const ESCENARIOS = ["actual", "bonanza", "tension", "crisis"];
const CLIENTES = clientesVentas.map((c) => c.nombre);

// el inventario inmovilizado GLOBAL, calculado acá con el MISMO criterio POLICY — es la cifra que la tool
// repetía cliente por cliente. Sirve de trampa: si vuelve a aparecer con nombre de cliente, este gate lo ve.
const _inmovilizados = skuInventario.filter((r) =>
  (typeof r.rotacion === "number" && r.rotacion < POLICY.rotacionMin) || (typeof r.doh === "number" && r.doh > POLICY.dohMax));
const GLOBAL_USD = _inmovilizados.reduce((s, r) => s + (typeof r.stockUSD === "number" ? r.stockUSD : 0), 0);
const GLOBAL_SKUS = _inmovilizados.map((r) => r.sku);

H(`[0] EL DEFECTO QUE SE CIERRA · inventario inmovilizado global = $${GLOBAL_USD.toLocaleString("en-US")} en ${GLOBAL_SKUS.length} SKU (${GLOBAL_SKUS.join(", ")})`);
ok(GLOBAL_USD > 0 && GLOBAL_SKUS.length > 0, `el tenant demo SÍ tiene inventario inmovilizado (si no, este gate no probaría nada)`);
ok(CLIENTES.length >= 2, `hay ${CLIENTES.length} clientes para contrastar entre sí`);

H("[1] LA TOOL · ningún cliente recibe una cifra de inventario que el dato no le atribuye");
{
  const firmas = new Set();
  let declina = 0, conCifra = 0, razonesUnicas = new Set();
  for (const scenario of ESCENARIOS) {
    for (const entity of CLIENTES) {
      const r = TOOLS.entityCapitalLigado({ dimension: "cliente", entity, scenario });
      const sup = !!(r && r.coverage && r.coverage.supported);
      if (sup) { conCifra++; firmas.add(JSON.stringify(r.facts.capitalLigado)); }
      else declina++;
      if (!sup) razonesUnicas.add(String(r.coverage.reason || ""));
      if (!sup) continue;
      // si algún día el dato sí sostiene la relación, la cifra NO puede ser la global repetida
      ok(JSON.stringify(r.facts.capitalLigado.items.map((i) => i.sku).sort()) !== JSON.stringify([...GLOBAL_SKUS].sort()),
        `${scenario}/${entity}: la cifra servida NO es el inventario global repetido`);
    }
  }
  ok(conCifra === 0, `con el dato de hoy NINGUNA de las ${ESCENARIOS.length * CLIENTES.length} combinaciones escenario×cliente afirma capital por cliente (afirmaron: ${conCifra})`);
  ok(firmas.size === 0, `cero firmas de capital cliente-específico (antes: 1 sola firma para los ${CLIENTES.length} clientes)`);
  ok(razonesUnicas.size === CLIENTES.length, `cada cliente recibe SU razón, nombrado (razones distintas: ${razonesUnicas.size} · clientes: ${CLIENTES.length})`);

  const r0 = TOOLS.entityCapitalLigado({ dimension: "cliente", entity: CLIENTES[0], scenario: "actual" });
  ok(r0.facts === null && Array.isArray(r0.boleta) && r0.boleta.length === 0, `declina con facts=null y boleta vacía (boleta: ${r0.boleta.length} cifras)`);
  ok(r0.coverage.relacion === "sin_relacion", `declara la RELACIÓN medida, no un "no" seco (relacion: ${r0.coverage.relacion})`);
  ok(/no registra qué SKU/.test(r0.coverage.reason) && r0.coverage.reason.includes(CLIENTES[0]),
    `la razón es verificable y conserva el sujeto — "${String(r0.coverage.reason).slice(0, 110)}…"`);
  ok(Array.isArray(r0.coverage.alternativas) && r0.coverage.alternativas.length > 0,
    `ofrece la alternativa real en vez de cortar seco (${JSON.stringify(r0.coverage.alternativas)})`);
  ok(r0.coverage.cobertura && r0.coverage.cobertura.skusInventario > 0 && r0.coverage.cobertura.skusEnMix > 0,
    `adjunta la MEDICIÓN que sostiene la razón (${r0.coverage.cobertura && r0.coverage.cobertura.skusEnMix}/${r0.coverage.cobertura && r0.coverage.cobertura.skusInventario} SKU)`);
}

H("[2] LA MEDICIÓN sale del dato, no de un supuesto · y es UNA sola (composer y plan leen la misma)");
{
  const cap = datasetCapability();
  ok(cap.crosses.atomic === false, "el contrato de dataset declara crosses.atomic === false (no hay transacciones cliente×SKU)");
  const bloqueadas = entityExplorable("client", CLIENTES[0]).blocked.map((b) => b.view);
  ok(bloqueadas.some((v) => /productos que le vendo/i.test(v)),
    `capability.js YA bloqueaba "productos que le vendo a este cliente" — la tool dejó de contradecirlo (${JSON.stringify(bloqueadas)})`);

  for (const entity of CLIENTES) {
    const rel = clientCapitalRelacion({ entity, scenario: "actual" });
    if (rel.skusEnMix !== rel.skusInventario || rel.atomico !== false || rel.estado !== "unsupported") {
      ok(false, `${entity}: la medición no coincide con lo esperado`, JSON.stringify(rel));
    }
  }
  const rel = clientCapitalRelacion({ entity: CLIENTES[0], scenario: "actual" });
  ok(rel.skusEnMix === rel.skusInventario && rel.skusInventario === GLOBAL_SKUS.length + skuInventario.filter((r) => !GLOBAL_SKUS.includes(r.sku)).length,
    `la relación MIDE cobertura contra el dato: el surtido estimado abarca ${rel.skusEnMix} de ${rel.skusInventario} SKU con inventario — no acota nada`);
  ok(rel.estado === "unsupported" && rel.atomico === false, `estado explícito (${rel.estado}) con su causa (atómico: ${rel.atomico})`);

  // la función no revienta ni inventa con una entidad que no está en el dato
  const fantasma = clientCapitalRelacion({ entity: "Cuenta Que No Existe", scenario: "actual" });
  ok(fantasma.estado === "unsupported" && fantasma.relacion === "sin_mix", `entidad ausente → declina honesto (${fantasma.relacion})`);
  ok(clientCapitalRelacion({}).estado === "unsupported", "sin entidad → declina, nunca devuelve el global");

  // el composer y la tool NO son dos criterios: la tool empaqueta lo que el composer decide
  const c = composeSpecClientCapital({ dimension: "cliente", entity: CLIENTES[0], scenario: "actual" });
  ok(c && c.unsupported === true && c.reason === rel.razon, "el composer devuelve la MISMA razón que la medición (una sola verdad)");
  ok(composeSpecClientCapital({ dimension: "bodega", entity: "Santiago", scenario: "actual" }) === null, "el eje no soportado sigue declinando igual que antes");
}

H("[3] LA FICHA EJECUTIVA · declara la limitación en vez de rellenar con el inventario global");
{
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  try { Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true }); } catch {}
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Node = dom.window.Node;
  globalThis.getComputedStyle = dom.window.getComputedStyle;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.localStorage = dom.window.localStorage;
  globalThis.__ADI_PROFILE__ = "dev";

  const root = path.dirname(fileURLToPath(import.meta.url));
  const bundlePath = path.join(root, `_capital_ligado_cliente_gate_bundle.tmp${process.pid}.mjs`);
  await esbuild.build({
    entryPoints: [path.join(root, "_capital_ligado_cliente_gate_entry.jsx")],
    bundle: true, outfile: bundlePath, format: "esm", platform: "node", jsx: "automatic",
    external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "react/jsx-dev-runtime"],
    logLevel: "silent",
  });
  const ui = await import(pathToFileURL(bundlePath).href);
  // vía 1 (2026-08-20): declarar el tenant SOBRE ESTA instancia — el bundle tiene su propia copia del store.
  ui.initTenant(ui.TENANT_DEMO);
  const React = (await import("react")).default;
  const { render, cleanup } = await import("@testing-library/react");

  const entity = CLIENTES[0];
  const plan = {
    intent: "entityProfile", mode: "default", rationale: `Perfil de ${entity}.`,
    scope: { level: "entity", entities: [entity] },
    calls: [{ tool: "entityProfile", args: { dimension: "cliente", entity } }],
  };
  const { results, unsupported, ledger } = runPlan(plan, { scenario: "actual" });
  const evidence = buildOracleEvidence({ plan, results, figs: ledgerBoleta(ledger), scenario: "actual", unsupported });
  const { container } = render(React.createElement(ui.SentrixPanel, {
    evidence, onClose: () => {}, onToggleMax: () => {}, maximized: false, onAsk: () => {},
  }));
  const t = container.textContent;

  ok(t.includes(`Importancia de ${entity} en tu cartera`), "el Perfil Ejecutivo se renderiza (no es un falso verde por panel vacío)");
  ok(t.includes(`Inventario inmovilizado y ${entity}`), "la tarjeta se titula por lo que el dato sostiene, no por una relación inexistente");
  ok(/no registra qué SKU/.test(t), "muestra la razón medida");
  ok(/cara Capital/.test(t), "remite a donde ese inventario SÍ tiene dueño (el negocio)");
  ok(!t.includes(`productos que compra ${entity}`), `no queda el título viejo "productos que compra ${entity}"`);
  ok(!t.includes(`productos que le vendés a ${entity}`), `no queda la lectura vieja "productos que le vendés a ${entity}"`);
  // la TABLA de inventario por cliente y su cierre de acción ya no existen (sus textos son únicos de esa tarjeta).
  // Ojo: los SKU inmovilizados SÍ siguen apareciendo más arriba, en la COMPOSICIÓN del cliente — eso es otra
  // afirmación (el mix estimado, no el capital) y no es lo que la decisión 9 manda retirar.
  ok(!/Valorizado/.test(t), "la tabla SKU/bodega/valorizado por cliente ya no se arma");
  ok(!/Priorizá/.test(t), "ya no cierra con una prioridad de liquidación por cliente");
  ok(!/Es capital de tu negocio, no de/.test(t), "ya no hace falta el descargo: no se hace la afirmación que lo necesitaba");
  const usdInmov = _inmovilizados.map((r) => `$${(r.stockUSD / 1000).toFixed(1)}K`);
  for (const v of [...new Set(usdInmov)]) ok(!t.includes(v), `el valorizado ${v} de un SKU inmovilizado no se le atribuye a ${entity}`);
  ok(!/\$33\.?2K/.test(t), "el subtotal del inventario global ya no aparece en la ficha de un cliente");
  cleanup();
}

H("[4] NINGÚN OTRO SITIO consume esa cifra creyendo que es por cliente");
{
  const entity = CLIENTES[0];
  const plan = {
    intent: "entityProfile", mode: "default", rationale: `Perfil completo de ${entity}.`,
    scope: { level: "entity", entities: [entity] },
    calls: [
      { tool: "entityProfile", args: { dimension: "cliente", entity } },
      { tool: "entityComposicion", args: { dimension: "cliente", entity } },
      { tool: "entityCapitalLigado", args: { dimension: "cliente", entity } },
    ],
  };
  const { results, unsupported, ledger } = runPlan(plan, { scenario: "actual" });
  const figs = ledgerBoleta(ledger);
  const capFigs = figs.filter((f) => /(capital|inmoviliz|detenid)/i.test(String(f.label || "")));
  ok(capFigs.length === 0, `el ledger del perfil completo no autoriza ninguna cifra de capital con nombre de cliente (encontró: ${capFigs.map((f) => f.label).join(" | ") || "ninguna"})`);
  const sinTool = (unsupported || []).find((u) => u && u.tool === "entityCapitalLigado");
  ok(!!sinTool, `el turno DECLARA que esa lectura no se pudo hacer (unsupported: ${JSON.stringify((unsupported || []).map((u) => u.tool))})`);
  ok(!!sinTool && /no registra qué SKU/.test(String(sinTool.reason || "")), `…con la razón verificable, no un "no" seco`);

  const evidence = buildOracleEvidence({ plan, results, figs, scenario: "actual", unsupported });
  const json = JSON.stringify(evidence);
  ok(!/capitalLigado/.test(json), "la evidence que viaja a Sentrix no lleva un bloque capitalLigado por cliente");
  ok(!new RegExp(`${GLOBAL_USD}|\\$${(GLOBAL_USD / 1000).toFixed(1)}K`).test(json),
    `el subtotal global ($${(GLOBAL_USD / 1000).toFixed(1)}K) no viaja en la evidence de un turno de cliente`);
  for (const r of _inmovilizados) {
    ok(!new RegExp(`${r.stockUSD}\\b`).test(json), `el valorizado inmovilizado de ${r.sku} no viaja con el turno de ${entity}`);
  }
}

console.log(`\n${"═".repeat(100)}`);
console.log(`CAPITAL LIGADO A CLIENTE (decisión 9 · hallazgo J) · ${PASS} pasaron · ${FAIL} fallaron`);
console.log("═".repeat(100));
process.exit(FAIL ? 1 : 0);
