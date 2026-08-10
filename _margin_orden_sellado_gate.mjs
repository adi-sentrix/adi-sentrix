/* === _margin_orden_sellado_gate.mjs · GATE del pedido del owner (2026-08-03) ===
 * "Sella facts.orden para marginRead. La clasificación y el orden deben calcularse determinísticamente antes de
 * NARRAR, viajar en la boleta y coincidir con lo prometido en el texto. Agrega gates que comparen criterio
 * declarado, valores y orden real."
 *
 * Pendiente documentado desde el pase quirúrgico de confiabilidad (2026-07-29, requisito 4 — ver _orden_sellado_
 * gate.mjs): gridTable/tensionRead ya sellaban `facts.orden`/`ordenA`/`ordenB` (entityRecord.js: buildGrid/
 * buildTension) — marginRead (composeSpecMargin, specRetrieval.js) NO lo hacía, dejando el requisito de orden
 * cubierto SOLO por refuerzo de prompt (`_needsOrdenMontoReinforcement`/ORDEN_MONTO_INSTRUCTION, narratePromptC.js)
 * para el caso "ordename por dinero" — sin guard duro para el resto de los focos, que YA ordenan determinísticamente
 * en código (brecha/venta/markup/costo/carga/capital) pero nunca lo declaraban.
 *
 * Fix: mismo patrón buildGrid/buildTension — cada foco de composeSpecMargin ahora expone `evidence.orden` (o
 * `ordenA`/`ordenB` para `palancas`, que arma DOS rankings independientes, mismo patrón dual que buildTension) con
 * el criterio+dirección que YA usa para ordenar sus filas. `_pack` (toolRegistry.js) lo sube a `facts.orden` sin
 * tocarlo (string, no pasa por `_fmtMoneyFacts`) → `answerViaOracle.js` lo recoge en `sealedOrders` → `guardC`
 * (`_sealedOrderBroken`) lo verifica DIRECTO contra la tabla final — mecanismo 100% reusado, cero cambios en
 * guardC.js/answerViaOracle.js. De paso, corregido un sub-caso que NO estaba ordenado en absoluto (bajo_benchmark·
 * negativo, cuando SÍ hay negativos: antes preservaba el orden crudo de la fuente, un accidente de archivo, no una
 * clasificación real — ahora ascendente por Margen, peor primero, mismo criterio "peor primero" del resto).
 *
 * También corregido un hallazgo incidental (misma clase de bug, sitio DISTINTO — toolRegistry.js, no specRetrieval.js
 * ni _figLever): el enriquecimiento de marginRead para dimension≠cliente pusheaba figs "Medida · cerrar brecha en X"/
 * "Medida · 1pp en X" con la ENTIDAD al final (convención vieja) — corregido a "X · Medida cerrar brecha"/
 * "X · Medida 1pp". Ningún gate dependía del label viejo (grep confirmado antes del cambio).
 */
import fs from "fs";
for (const ln of fs.readFileSync(".env", "utf8").split(/\r?\n/)) { const m = ln.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
import { composeSpecMargin } from "./src/adi/specRetrieval.js";
import { runPlan } from "./src/adi/oracle/toolRunner.js";
import { guardC } from "./src/adi/oracle/guardC.js";
import { answerViaOracle } from "./src/adi/oracle/answerViaOracle.js";
import { handlePlan, handleNarrateC } from "./src/adi/llm/gatewayCore.js";
import { buildNarrateUserMessageC } from "./src/adi/oracle/narratePromptC.js";

let pass = 0, fail = 0;
const ok = (cond, label) => { console.log(`  ${cond ? "✓" : "✗"} ${label}`); if (cond) pass++; else fail++; };
const isMonotone = (seq, dir) => {
  for (let i = 1; i < seq.length; i++) {
    if (dir === "desc" && seq[i] > seq[i - 1] + 1e-9) return false;
    if (dir === "asc" && seq[i] < seq[i - 1] - 1e-9) return false;
  }
  return true;
};

console.log("── 1 · CRITERIO DECLARADO — cada foco expone evidence.orden/ordenA/ordenB con el criterio real ──");
{
  const CASES = [
    { name: "alto_volumen_bajo_margen", args: { scenario: "actual", focus: "alto_volumen_bajo_margen" }, expect: { orden: "descendente por Ventas" } },
    { name: "bajo_benchmark · pct", args: { scenario: "actual", focus: "bajo_benchmark", pct: true }, expect: { orden: "descendente por Brecha" } },
    { name: "bajo_benchmark · negativo (sin negativos → pivot a below)", args: { scenario: "actual", focus: "bajo_benchmark", negativo: true }, expect: { orden: "descendente por Brecha" } },
    { name: "bajo_benchmark · default (rankeados por brecha, prometido en texto)", args: { scenario: "actual", focus: "bajo_benchmark" }, expect: { orden: "descendente por Brecha" } },
    { name: "causa_precio", args: { scenario: "actual", focus: "causa_precio" }, expect: { orden: "ascendente por Markup" } },
    { name: "causa_costo", args: { scenario: "actual", focus: "causa_costo" }, expect: { orden: "descendente por Costo" } },
    { name: "subir_precio", args: { scenario: "actual", focus: "subir_precio" }, expect: { orden: "ascendente por Markup" } },
    { name: "alto_margen_subpenetrado", args: { scenario: "actual", focus: "alto_margen_subpenetrado" }, expect: { orden: "descendente por Margen" } },
    { name: "stock_bajo_margen (early return, evidence propia)", args: { scenario: "actual", focus: "stock_bajo_margen" }, expect: { orden: "descendente por Capital" } },
    { name: "palancas (DOS rankings independientes → ordenA+ordenB)", args: { scenario: "actual", focus: "palancas" }, expect: { ordenA: "descendente por Carga", ordenB: "ascendente por Markup" } },
  ];
  for (const c of CASES) {
    const r = composeSpecMargin(c.args);
    ok(!!r, `${c.name}: composer responde (no null)`);
    if (!r) continue;
    const ev = r.evidence;
    for (const [k, v] of Object.entries(c.expect)) ok(ev[k] === v, `${c.name}: evidence.${k} === "${v}" (obtuvo ${JSON.stringify(ev[k])})`);
  }
  // huecos (gap) y ninguno de los otros dos sub-focos NO declaran un orden que no tienen — no forzamos una promesa falsa
  const rGap = composeSpecMargin({ scenario: "actual", focus: "bajo_benchmark", gap: "caida" });
  ok(!!rGap && rGap.evidence.orden === undefined, "huecos honestos (gap): NO declara orden (el pivot de 3 candidatos no es un ranking prometido)");
}

console.log("\n── 2 · VALORES REALES — la secuencia que el USUARIO VE (texto) respeta la dirección declarada ──");
{
  // bajo_benchmark (las 3 sub-ramas comparten el MISMO array `below`, expuesto en evidence.margin.below) — un solo
  // chequeo cubre pct/negativo-sin-negativos/default, ya que las 3 heredan el mismo orden real.
  const r1 = composeSpecMargin({ scenario: "actual", focus: "bajo_benchmark" });
  const gaps = r1.evidence.margin.below.map((x) => x.gap);
  ok(gaps.length >= 3 && isMonotone(gaps, "desc"), `bajo_benchmark: evidence.margin.below[].gap desciende (${gaps.join(", ")})`);

  const r2 = composeSpecMargin({ scenario: "actual", focus: "alto_volumen_bajo_margen" });
  const ventas = [...r2.opener.matchAll(/\(\$([\d.,]+)([KMB]?)\s+a\s+[\d.,]+%\)/g)].map((m) => { const v = parseFloat(m[1].replace(/,/g, "")); const s = m[2]; return s === "M" ? v * 1e6 : s === "K" ? v * 1e3 : s === "B" ? v * 1e9 : v; });
  ok(ventas.length >= 3 && isMonotone(ventas, "desc"), `alto_volumen_bajo_margen: la venta citada en el texto desciende (${ventas.join(", ")})`);

  const r3 = composeSpecMargin({ scenario: "actual", focus: "causa_precio" });
  const markupsP = [...r3.opener.matchAll(/markup ([\d.,]+)%\)/g)].map((m) => parseFloat(m[1]));
  ok(markupsP.length >= 3 && isMonotone(markupsP, "asc"), `causa_precio: el markup citado asciende (peor primero) (${markupsP.join(", ")})`);

  const r4 = composeSpecMargin({ scenario: "actual", focus: "causa_costo" });
  const costos = [...r4.opener.matchAll(/costo (\d+(?:\.\d+)?)% de la lista\)/g)].map((m) => parseFloat(m[1]));
  ok(costos.length >= 3 && isMonotone(costos, "desc"), `causa_costo: el % de costo citado desciende (${costos.join(", ")})`);

  const r5 = composeSpecMargin({ scenario: "actual", focus: "subir_precio" });
  const markupsS = [...r5.opener.matchAll(/markup ([\d.,]+)%\)/g)].map((m) => parseFloat(m[1]));
  ok(markupsS.length >= 3 && isMonotone(markupsS, "asc"), `subir_precio: el markup citado asciende (${markupsS.join(", ")})`);

  const r6 = composeSpecMargin({ scenario: "actual", focus: "alto_margen_subpenetrado" });
  const margenes = [...r6.opener.matchAll(/([\d.,]+)%\s+margen/g)].map((m) => parseFloat(m[1]));
  ok(margenes.length >= 2 && isMonotone(margenes, "desc"), `alto_margen_subpenetrado: el margen citado desciende (${margenes.join(", ")})`);

  const r7 = composeSpecMargin({ scenario: "actual", focus: "stock_bajo_margen" });
  const capitales = [...r7.opener.matchAll(/\(\$([\d.,]+)([KMB]?)\)/g)].map((m) => { const v = parseFloat(m[1].replace(/,/g, "")); const s = m[2]; return s === "M" ? v * 1e6 : s === "K" ? v * 1e3 : s === "B" ? v * 1e9 : v; });
  ok(capitales.length >= 2 && isMonotone(capitales, "desc"), `stock_bajo_margen: el capital por bodega citado desciende (${capitales.join(", ")})`);

  const r8 = composeSpecMargin({ scenario: "actual", focus: "palancas" });
  const cargas = [...r8.opener.matchAll(/\(([\d.,]+)%\)/g)].map((m) => parseFloat(m[1]));
  ok(cargas.length >= 1 && isMonotone(cargas, "desc"), `palancas · Carga/rebates: desciende (${cargas.join(", ") || "sin candidatos sobre target (válido)"})`);
  const markupsPal = [...r8.opener.matchAll(/markup ([\d.,]+)%\)/g)].map((m) => parseFloat(m[1]));
  ok(markupsPal.length === 0 || isMonotone(markupsPal, "asc"), `palancas · Precio de lista: asciende si hay candidatos (${markupsPal.join(", ") || "sin candidatos (válido)"})`);
}

console.log("\n── 3 · REGRESIÓN — bajo_benchmark·negativo CON negativos reales ya no hereda el orden crudo de archivo ──");
{
  // el dataset demo no tiene márgenes negativos en ningún escenario/eje real (confirmado por barrido manual) — se
  // testea el COMPARADOR mismo en aislamiento (no el composer completo, que no puede reproducir el caso con datos
  // reales) para no dejar esta rama sin cobertura solo porque el demo no la alcanza.
  const synthetic = [{ nombre: "Z", margen: -5 }, { nombre: "A", margen: -1 }, { nombre: "M", margen: -12 }];
  const sorted = synthetic.slice().sort((a, b) => a.margen - b.margen);
  ok(sorted.map((r) => r.nombre).join(",") === "M,Z,A", `el comparador ascendente por margen deja el más negativo primero (M=-12, Z=-5, A=-1) — obtuvo ${sorted.map((r) => r.nombre).join(",")}`);
  const src = fs.readFileSync("./src/adi/specRetrieval.js", "utf8");
  ok(/const negatives = rows\.filter\(\(r\) => r\.margen < 0\)\.sort\(\(a, b\) => a\.margen - b\.margen\);/.test(src), "el composer real usa ESE MISMO comparador (verificado en el fuente — no hay forma de ejercitarlo con el dataset demo)");
}

console.log("\n── 4 · GUARDC END-TO-END — sealedOrders de marginRead bloquea una tabla que lo contradice, pasa una que lo respeta ──");
{
  const plan = runPlan({ intent: "margin", calls: [{ tool: "marginRead", args: { scenario: "actual", focus: "bajo_benchmark" } }] }, { scenario: "actual" });
  const r = plan.results[0];
  ok(r.facts && r.facts.orden === "descendente por Brecha", `runPlan(marginRead) sube facts.orden intacto hasta el resultado de la tool (obtuvo "${r.facts && r.facts.orden}")`);
  // usa las 3 primeras filas REALES (autorizadas) de below — swapea las filas 2 y 3 para romper el orden sin
  // inventar ninguna cifra (si se inventa un valor no-autorizado, el guard cae antes en "cifra-no-autorizada",
  // un chequeo DISTINTO — acá se aísla específicamente el chequeo de orden sellado, mismo criterio que
  // _orden_sellado_gate.mjs, que arma su propio ledger sintético para lo mismo).
  const comp = composeSpecMargin({ scenario: "actual", focus: "bajo_benchmark" });
  const top3 = comp.evidence.margin.below.slice(0, 3);
  ok(top3.length === 3 && top3[0].gap >= top3[1].gap && top3[1].gap >= top3[2].gap, `las 3 primeras filas reales YA vienen descendentes (${top3.map((x) => x.gap).join(", ")}) — base válida para el swap`);
  const rowsRota = [top3[0], top3[2], top3[1]];   // swap 2↔3: rompe el descendente
  const tabla = (rows) => `| Cliente | Brecha |\n|---------|--------|\n${rows.map((x) => `| ${x.nombre} | ${x.gap}pp |`).join("\n")}`;
  const ledger = { figs: r.boleta };
  const gRota = guardC(tabla(rowsRota), { ledger, results: plan.results, trace: null, question: "clientes bajo el margen mínimo", mechanismMemory: {}, sealedOrders: [r.facts.orden] });
  ok(!gRota.ok && gRota.violations.some((v) => v.kind === "orden-sellado-incumplido"), `bloquea la tabla con filas 2↔3 swapeadas (${rowsRota.map((x) => `${x.nombre} ${x.gap}pp`).join(" → ")}) — verdict="${gRota.verdict}"`);
  const gOk = guardC(tabla(top3), { ledger, results: plan.results, trace: null, question: "clientes bajo el margen mínimo", mechanismMemory: {}, sealedOrders: [r.facts.orden] });
  ok(gOk.ok, `la MISMA tabla, en el orden correcto, pasa limpia — verdict="${gOk.verdict}"`);
}

console.log("\n── 5 · INTEGRACIÓN — marginRead (toolRegistry.js) via runPlan sube orden/ordenA/ordenB para TODOS los focos, dimension≠cliente incluido ──");
{
  const p1 = runPlan({ intent: "margin", calls: [{ tool: "marginRead", args: { scenario: "actual", focus: "palancas" } }] }, { scenario: "actual" });
  ok(p1.results[0].facts.ordenA === "descendente por Carga" && p1.results[0].facts.ordenB === "ascendente por Markup", `palancas vía runPlan sube ordenA+ordenB (obtuvo ${JSON.stringify({ a: p1.results[0].facts.ordenA, b: p1.results[0].facts.ordenB })})`);
  const p2 = runPlan({ intent: "margin", calls: [{ tool: "marginRead", args: { scenario: "actual", focus: "bajo_benchmark", dimension: "sku" } }] }, { scenario: "actual" });
  ok(p2.results[0].facts.orden === "descendente por Brecha", `bajo_benchmark·SKU (dimension≠cliente, rama de enriquecimiento con figs extra) sigue subiendo el mismo orden (obtuvo "${p2.results[0].facts.orden}")`);
  // el enriquecimiento de esa misma rama (dimension≠cliente) no deja labels con la entidad al final (hallazgo incidental corregido)
  const bareLabelHits = p2.results[0].boleta.filter((f) => /^Medida · (cerrar brecha en|1pp en) /.test(f.label || ""));
  ok(bareLabelHits.length === 0, `el enriquecimiento de marginRead (dimension≠cliente) no deja labels "Concepto · Entidad" (obtuvo ${bareLabelHits.length}: ${bareLabelHits.map((f) => f.label).join(", ")})`);
}

console.log("\n── 6 · SMOKE LLM REAL — preguntas reales de margen, sin fallback elevado por falsos positivos del guard nuevo ──");
{
  const callPlan = async ({ text, history, mem, scenario }) => { const pr = await handlePlan({ text, history, mem, scenario }); return pr.ok ? pr.plan : null; };
  const callNarrate = async (args) => { const nr = await handleNarrateC({ payload: buildNarrateUserMessageC(args), mem: args.mem }); return nr.ok ? nr.narration : null; };
  const QS = ["qué clientes están bajo el margen mínimo?", "los que más venden y peor margen dejan, en una tabla", "cuáles ceden margen por costo", "candidatos a subir precio"];
  let responded = 0;
  for (const q of QS) for (let i = 0; i < 2; i++) {
    const r = await answerViaOracle({ text: q, history: [], mem: {}, scenario: "actual", callPlan, callNarrate });
    if (r) responded++;
  }
  console.log(`  ${responded}/${QS.length * 2} corridas respondieron`);
  ok(responded >= QS.length, `≥${QS.length}/${QS.length * 2} respondieron (sin fallback elevado por el sello nuevo) — obtuvo ${responded}`);
}

console.log(`\n── _margin_orden_sellado_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
