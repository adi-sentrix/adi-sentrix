/* === _divulgacion_progresiva_gate.mjs · REGLA TRANSVERSAL (owner 2026-08-07) =========================
 * Consulta GENERAL de entidad → qué pasa / por qué / qué hacer primero, SIN tablas de detalle.
 * El detalle vive en la Ficha de Sentrix. Las tablas temporales solo si se piden explícitamente.
 *   [1] DETECTOR temporal: dispara con las formas reales de pedir tiempo, y NO con una consulta general.
 *   [2] DETECTOR de desglose: composición/SKU/familia solo si se pide.
 *   [3] PODA ANTES DEL BATCH: la tool no se ejecuta. Es lo que hace que ahorre de verdad.
 *   [4] AHORRO MEDIDO: el turno real de perfil pasa de 134 cifras a 18.
 *   [5] LOS CUATRO EJES: cliente, familia, marca y SKU — el criterio es la forma de la consulta, no el eje.
 *   [6] NO SE PIERDE LA LECTURA: qué pasa, por qué y la prioridad cuantificada siguen autorizados.
 *   [7] EL NARRADOR LO SABE: la instrucción viaja y nombra la Ficha; sin poda no se paga.
 *   [8] EL ENLACE: el botón dice "Ver ficha en Sentrix" y abre la cara Ficha.
 *   [9] NO REGRESIÓN: un pedido explícito trae TODO lo que traía antes.
 * Cero red, cero LLM. `node _divulgacion_progresiva_gate.mjs`
 */
import { runPlan } from "./src/adi/oracle/toolRunner.js";
import {
  pideDetalleTemporal, pideDetalleComposicion, esConsultaGeneralDeEntidad,
  podarPlanProgresivo, podarLedgerProgresivo, buildDisclosureInstruction,
} from "./src/adi/oracle/progressiveDisclosure.js";
import { buildNarrateUserMessageC } from "./src/adi/oracle/narratePromptC.js";

let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };
const H = (t) => console.log("\n" + t);

const planCompleto = (entity, dimension = "cliente") => ({
  intent: "answer", mode: "default", scope: { level: "entity", entities: [entity] },
  calls: [
    { tool: "entityProfile", args: { dimension, entity } },
    { tool: "trend", args: { dimension, entity } },
    ...(dimension === "cliente" ? [{ tool: "entityComposicion", args: { dimension, entity } }, { tool: "entityCapitalLigado", args: { dimension, entity } }] : []),
  ],
});
const tools = (p) => p.calls.map((c) => c.tool);

H("[1] DETECTOR TEMPORAL · las formas reales de pedir tiempo");
{
  const SI = ["Falabella mes a mes", "mostrame la evolución de Falabella", "¿cuál es la tendencia?", "comparación por período",
    "cómo viene Falabella", "Falabella últimos 6 meses", "ventas mensuales de Falabella", "Falabella año contra año",
    "Falabella vs el año pasado", "¿en qué meses cayó?", "la trayectoria de Falabella", "el histórico de Falabella",
    "Falabella por trimestre", "cuál fue el mejor mes"];
  for (const q of SI) ok(pideDetalleTemporal(q), `pide tiempo: "${q}"`);
  const NO = ["Falabella", "perfil de Falabella", "¿cómo va Falabella?", "contame de Falabella", "el estado de Falabella",
    "ventas de Falabella", "margen de Falabella", "qué hago con Falabella", "resumen de Falabella"];
  for (const q of NO) ok(!pideDetalleTemporal(q), `NO pide tiempo: "${q}"`);
}

H("[2] DETECTOR DE DESGLOSE · la composición solo si se pide");
{
  for (const q of ["qué me compra Falabella", "desglose de Falabella por familia", "composición de Falabella", "abrí el detalle", "qué productos lleva", "el mix de Falabella"])
    ok(pideDetalleComposicion(q), `pide desglose: "${q}"`);
  for (const q of ["Falabella", "perfil de Falabella", "¿cómo va Falabella?"])
    ok(!pideDetalleComposicion(q), `NO pide desglose: "${q}"`);
}

H("[3] PODA ANTES DEL BATCH · la tool NO se ejecuta");
{
  const p = planCompleto("Falabella");
  const gen = podarPlanProgresivo(p, "perfil de Falabella");
  ok(!tools(gen.plan).includes("trend"), `consulta general: trend NO se llama — ${tools(gen.plan).join(",")}`);
  ok(!tools(gen.plan).includes("entityComposicion"), "consulta general: entityComposicion NO se llama");
  ok(tools(gen.plan).includes("entityProfile") && tools(gen.plan).includes("entityCapitalLigado"), "…y SÍ quedan las tools de lectura (perfil + capital)");
  ok(gen.podado.length === 2 && gen.entidad === "Falabella", `declara qué podó y de quién — ${JSON.stringify(gen.podado)} · ${gen.entidad}`);
  const tmp = podarPlanProgresivo(p, "Falabella mes a mes");
  ok(tools(tmp.plan).includes("trend"), "pedido temporal explícito: trend SÍ se llama");
  const des = podarPlanProgresivo(p, "qué me compra Falabella");
  ok(tools(des.plan).includes("entityComposicion"), "pedido de desglose explícito: entityComposicion SÍ se llama");
  const ambos = podarPlanProgresivo(p, "la evolución y la composición de Falabella");
  ok(ambos.podado.length === 0 && tools(ambos.plan).length === 4, "pide las dos cosas: no se poda nada");
  // una consulta que NO es de entidad no se toca
  const rank = { intent: "answer", mode: "default", calls: [{ tool: "marginRead", args: { dimension: "cliente" } }] };
  ok(esConsultaGeneralDeEntidad(rank) === null && podarPlanProgresivo(rank, "quién está bajo el benchmark").podado.length === 0,
    "un turno que no es de entidad no entra en la regla (no hay entityProfile)");
}

H("[4] AHORRO MEDIDO · el costo real, no la promesa");
{
  const p = planCompleto("Falabella");
  const antes = runPlan({ intent: "answer", calls: p.calls }, { scenario: "actual" }).ledger.figs.length;
  const gen = podarPlanProgresivo(p, "perfil de Falabella");
  const l = runPlan({ intent: "answer", calls: gen.plan.calls }, { scenario: "actual" }).ledger;
  const despues = podarLedgerProgresivo(l.figs, { quiereDesglose: false }).figs.length;
  ok(antes > 100, `el turno completo autoriza ${antes} cifras (el costo de hoy)`);
  ok(despues < 25, `la consulta general autoriza ${despues} — ${Math.round((1 - despues / antes) * 100)}% menos`);
  ok(l.figs.length < antes, `y las cifras podadas NUNCA se calcularon: el ledger sale con ${l.figs.length}, no con ${antes}`);
}

H("[5] LOS CUATRO EJES · el criterio es la forma de la consulta, no el eje");
{
  for (const [eje, ent] of [["cliente", "Falabella"], ["familia", "Electrodomésticos"], ["marca", "Samsung"], ["sku", "LG-DRYER8KG"]]) {
    const p = planCompleto(ent, eje);
    const gen = podarPlanProgresivo(p, `${ent}`);
    ok(!tools(gen.plan).includes("trend"), `${eje}: la consulta general de "${ent}" NO trae el evolutivo`);
    const tmp = podarPlanProgresivo(p, `${ent} mes a mes`);
    ok(tools(tmp.plan).includes("trend"), `${eje}: "${ent} mes a mes" SÍ lo trae`);
  }
}

H("[6] NO SE PIERDE LA LECTURA · qué pasa, por qué y la prioridad siguen autorizados");
{
  const gen = podarPlanProgresivo(planCompleto("Falabella"), "perfil de Falabella");
  const l = runPlan({ intent: "answer", calls: gen.plan.calls }, { scenario: "actual" }).ledger;
  const figs = podarLedgerProgresivo(l.figs, { quiereDesglose: false }).figs;
  const tiene = (re) => figs.some((f) => re.test(String(f.label || "")));
  ok(tiene(/· Ventas$/), "QUÉ PASA: las ventas de la entidad siguen");
  ok(tiene(/· Margen$/) && tiene(/^Benchmark de margen$/) && tiene(/brecha de margen/i), "POR QUÉ: margen, referencia y brecha siguen");
  ok(tiene(/exceso de acciones comerciales/i), "LA PALANCA cuantificada sigue (el 'qué hacer primero')");
  ok(tiene(/capital detenido/i), "el capital detenido sigue (el segundo frente)");
  ok(!figs.some((f) => /^(Ene|Feb|Mar|Abr|May|Jun|Jul|Ago|Sep|Oct|Nov|Dic)$/i.test(String(f.label || ""))), "y NO queda ninguna cifra de mes suelto");
  ok(!figs.some((f) => /· participación$/i.test(String(f.label || ""))), "ni ninguna fila de composición por familia");
  ok(!figs.some((f) => /(unidades detenidas|d[ií]as sin venta)/i.test(String(f.label || ""))), "ni las columnas del capital que solo se leen en tabla");
}

H("[7] EL NARRADOR LO SABE · y no paga cuando no hay nada que decir");
{
  const gen = podarPlanProgresivo(planCompleto("Falabella"), "perfil de Falabella");
  const inst = buildDisclosureInstruction({ podado: gen.podado, entidad: gen.entidad });
  ok(/Ficha de Sentrix/.test(inst) && /Ver ficha en Sentrix/.test(inst), "la instrucción nombra la Ficha como destino del detalle");
  ok(/NO armes ninguna tabla/i.test(inst), "…y prohíbe explícitamente armar la tabla");
  ok(/prioridad/i.test(inst), "…pero deja la prioridad concreta con su monto");
  ok(buildDisclosureInstruction({ podado: [], entidad: "Falabella" }) === "", "sin poda NO se paga la instrucción (economía de tokens)");
  // y llega de verdad al payload
  const r = runPlan({ intent: "answer", calls: gen.plan.calls }, { scenario: "actual" });
  const pay = buildNarrateUserMessageC({ text: "perfil de Falabella", plan: gen.plan, results: r.results, ledgerFigs: r.ledger.figs,
    mem: {}, history: [], pref: null, scenario: "actual", instruccionDisclosure: inst });
  ok(typeof pay.instruccion_divulgacion === "string" && /Ficha de Sentrix/.test(pay.instruccion_divulgacion), "y viaja en el payload de NARRAR");
  const sin = buildNarrateUserMessageC({ text: "perfil de Falabella", plan: gen.plan, results: r.results, ledgerFigs: r.ledger.figs, mem: {}, history: [], pref: null, scenario: "actual" });
  ok(!sin.instruccion_divulgacion, "sin instrucción, la clave ni aparece");
}

H("[8] EL ENLACE · el botón dice Ficha, no un panel genérico");
{
  const src = (await import("node:fs")).readFileSync("src/ui/ChatADI.jsx", "utf8");
  ok(/Ver ficha de \$\{evidence\.entidad\} en Sentrix/.test(src) || /Ver ficha de/.test(src), "_evLabel devuelve \"Ver ficha … en Sentrix\" para un perfil");
  ok(/evidence\._profileRequest/.test(src), "…disparado por `_profileRequest`, la MISMA marca que abre la cara Ficha del panel");
}

H("[9] NO REGRESIÓN · el pedido explícito trae TODO lo que traía antes");
{
  const p = planCompleto("Falabella");
  const completo = runPlan({ intent: "answer", calls: p.calls }, { scenario: "actual" }).ledger.figs.length;
  const pedido = podarPlanProgresivo(p, "la evolución y la composición de Falabella");
  const conTodo = runPlan({ intent: "answer", calls: pedido.plan.calls }, { scenario: "actual" }).ledger.figs.length;
  ok(conTodo === completo, `pidiendo las dos cosas se autorizan las MISMAS ${completo} cifras que antes — sin pérdida`);
  const soloTemporal = podarPlanProgresivo(p, "Falabella mes a mes");
  const lt = runPlan({ intent: "answer", calls: soloTemporal.plan.calls }, { scenario: "actual" }).ledger;
  ok(lt.figs.some((f) => /^(Ene|Feb|Mar)$/i.test(String(f.label || ""))), "el pedido temporal SÍ recupera las cifras mes a mes");
}

console.log(`\n── _divulgacion_progresiva_gate: ${PASS} PASS · ${FAIL} FAIL (de ${PASS + FAIL}) ──`);
process.exit(FAIL ? 1 : 0);
