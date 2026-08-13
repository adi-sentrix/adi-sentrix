/* === _probe_amplitud_f2.mjs · AMPLITUD F2 · LA CALCULADORA DE CATÁLOGO CERRADO — probe integral ===============
 * Ejercita las cuatro piezas de la fase, BIDIRECCIONAL en cada operación (la cuenta correcta pasa con su fórmula;
 * la torcida se veta; las unidades incompatibles y el cruce de universos declinan con su razón):
 *   1 · el catálogo puro (calculoCatalogo.js) — operación por operación
 *   2 · la tool `calcular` vía runPlan, con los insumos resueltos contra el DATO REAL del tenant
 *   3 · el muro (guardC) verificando cuentas del catálogo — extensión aditiva del chequeo 1
 *   4 · el marco de hipótesis (ensureHypothesisFraming) cuando hay una cifra del usuario
 *   5 · byte-identidad: las tools existentes no se movieron (boleta byte-igual a su composer)
 * Offline puro: cero red, cero credencial, cero gateway. Se corre suelto con `node --import ./scripts/offline-guard.mjs`.
 */
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { OPERACIONES_CALCULO, ejecutarCalculo, esCalculoDelCatalogo, tolCalculo, formatearCanon } from "./src/adi/oracle/calculoCatalogo.js";
import { TOOLS, toolNames } from "./src/adi/oracle/toolRegistry.js";
import { runPlan } from "./src/adi/oracle/toolRunner.js";
import { guardC } from "./src/adi/oracle/guardC.js";
import { fig } from "./src/adi/boleta.js";
import { ensureHypothesisFraming } from "./src/adi/oracle/narratePromptC.js";
import { rawRecordFor } from "./src/adi/oracle/entityRecord.js";
import { composeSpecMargin, composeSpecRetrieval } from "./src/adi/specRetrieval.js";
import { readFileSync } from "node:fs";

initTenant(TENANT_DEMO);

let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ " + m + (extra ? "\n      " + String(extra).slice(0, 240) : "")); } };

const M = (raw, universo = "venta_comercial") => ({ raw, unit: "money", universo });
const P = (raw) => ({ raw, unit: "pct" });

console.log("── 1 · EL CATÁLOGO PURO, OPERACIÓN POR OPERACIÓN ──");
{
  ok(Object.keys(OPERACIONES_CALCULO).join(",") === "suma,resta,variacion_pct,participacion,brecha_pp,escalar,margen_objetivo",
    "el catálogo es EXACTAMENTE el declarado (D1: cerrado, ampliable solo con gate)", Object.keys(OPERACIONES_CALCULO).join(","));
  const src = readFileSync(new URL("./src/adi/oracle/calculoCatalogo.js", import.meta.url), "utf8");
  ok(!/\beval\s*\(|new\s+Function\b/.test(src), "sin eval/Function en el módulo — catálogo cerrado no es un dicho");
  ok(!/from\s+["'][^"']*(data\/|engine\/|specRetrieval|gateway)/.test(src), "el módulo es PURO: no importa dato, motor ni gateway");

  // suma / resta — montos con montos, pp con pp, jamás $ con %
  const s1 = ejecutarCalculo("suma", [M(1600000), M(900000)]);
  ok(s1.ok && s1.resultados[0].value === "$2.5M" && s1.resultados[0].formula === "$2.5M = $1.6M + $900K", "suma $+$ con fórmula declarada", JSON.stringify(s1));
  const s2 = ejecutarCalculo("suma", [M(1000000), P(5)]);
  ok(!s2.ok && s2.regla === "unidades-incompatibles", "suma $ con % declina por unidades", JSON.stringify(s2));
  const s3 = ejecutarCalculo("resta", [{ raw: 8.1, unit: "pp" }, { raw: 3, unit: "pp" }]);
  ok(s3.ok && s3.resultados[0].unit === "pp" && s3.resultados[0].value === "5.1pp", "resta pp−pp conserva la unidad", JSON.stringify(s3));

  // variacion_pct
  const v1 = ejecutarCalculo("variacion_pct", [M(92900000), M(100000000)]);
  ok(v1.ok && v1.resultados[0].value === "7.6%" && /÷/.test(v1.resultados[0].formula), "variacion_pct de A a B (la cifra real del negocio: +7.6%)", JSON.stringify(v1));
  ok(!ejecutarCalculo("variacion_pct", [M(0), M(100)]).ok, "variación desde cero declina honesto");
  ok(!ejecutarCalculo("variacion_pct", [M(100), P(5)]).ok, "variación con unidades mezcladas declina");

  // participacion
  const p1 = ejecutarCalculo("participacion", [M(17900000), M(100000000)]);
  ok(p1.ok && p1.resultados[0].value === "17.9%", "participación A sobre B", JSON.stringify(p1));
  ok(!ejecutarCalculo("participacion", [M(100), M(0)]).ok, "participación sobre 0 declina");

  // brecha_pp — tasa vs tasa → puntos
  const b1 = ejecutarCalculo("brecha_pp", [P(30.1), P(22)]);
  ok(b1.ok && b1.resultados[0].value === "8.1pp" && b1.resultados[0].unit === "pp", "brecha_pp: benchmark 30.1% vs margen 22% → 8.1pp", JSON.stringify(b1));
  ok(!ejecutarCalculo("brecha_pp", [M(100), M(50)]).ok, "brecha_pp con montos declina (es de tasas)");

  // escalar — regla de tres
  const e1 = ejecutarCalculo("escalar", [M(194000), { raw: 4, unit: "pp" }]);
  ok(e1.ok && e1.resultados[0].value === "$776K" && e1.resultados[0].formula === "$776K = $194K × 4pp",
    "escalar: «si 1 punto vale $194K, 4 puntos…» → $776K con la fórmula del encargo", JSON.stringify(e1));
  ok(!ejecutarCalculo("escalar", [M(194000), P(4)]).ok, "escalar con % como factor declina (escalar por tasa es margen_objetivo, no regla de tres)");

  // margen_objetivo — el caso canónico en crudo
  const mo = ejecutarCalculo("margen_objetivo", [M(19433000), M(4275000), P(25)]);
  ok(mo.ok && mo.resultados.map((r) => r.clave).join(",") === "margen_actual,brecha,contribucion_objetivo,contribucion_faltante",
    "margen_objetivo devuelve los cuatro peldaños de la cuenta", JSON.stringify(mo && mo.resultados));
  ok(mo.ok && mo.resultados[3].value === "$583K" && mo.resultados[3].formula === "$583K = $4.9M − $4.3M",
    "la contribución faltante sale con su fórmula declarada");
  ok(!ejecutarCalculo("margen_objetivo", [M(100), P(25), P(25)]).ok, "margen_objetivo con unidades corridas declina");

  // cruce de universos — declina NOMBRANDO la regla
  const cx = ejecutarCalculo("participacion", [M(17900000, "venta_comercial"), M(135000, "inventario")]);
  ok(!cx.ok && cx.regla === "universos-no-reconcilian" && /no reconcilian/.test(cx.razon) && /MILES/.test(cx.razon),
    "venta ÷ inventario declina nombrando la regla y su razón medida", cx.razon);
  const cx2 = ejecutarCalculo("suma", [M(1000, "venta_comercial"), M(2000, "inventario")]);
  ok(!cx2.ok && cx2.regla === "universos-no-reconcilian", "sumar los dos universos también declina");

  // catálogo cerrado
  const libre = ejecutarCalculo("raiz_cuadrada", [M(100)]);
  ok(!libre.ok && libre.regla === "catalogo-cerrado" && /No ejecuto fórmulas libres/.test(libre.razon),
    "operación fuera del catálogo declina declarando el catálogo cerrado");
  // la tolerancia es LA DE _isCalc, no una segunda (mismos valores en las 5 unidades)
  ok(tolCalculo(100000, "money") === Math.max(1000, 100000 * 0.02) && tolCalculo(5, "pct") === 0.2 && tolCalculo(5, "pp") === 0.2
    && tolCalculo(2, "ratio") === 0.15 && tolCalculo(30, "days") === 0.6, "tolCalculo espeja la tolerancia de _isCalc en todas las unidades");
}

console.log("── 2 · LA TOOL `calcular` VÍA runPlan, CONTRA EL DATO REAL ──");
{
  // el caso canónico del gerente: «la industria debería estar en 25% → ¿qué nos falta?» sobre el dato real
  const rec = rawRecordFor("cliente", "Falabella", "actual");
  const ventaEsp = formatearCanon(rec.venta * 1000, "money");
  const contribEsp = formatearCanon(rec.contribucion * 1000, "money");
  const faltanteEsp = formatearCanon(rec.venta * 1000 * 0.25 - rec.contribucion * 1000, "money");
  const out = runPlan({ intent: "answer", calls: [{ tool: "calcular", args: { operacion: "margen_objetivo", insumos: [{ entidad: "Falabella" }], objetivo: { usuario: "25% (una noticia dice que la industria debería estar ahí)" } } }] }, { scenario: "actual" });
  const r = out.results[0];
  ok(r.coverage.supported === true, "runPlan ejecuta la tool y la soporta", JSON.stringify(r.coverage));
  ok(r.facts.es_calculo === true && r.facts.operacion === "margen_objetivo", "facts declaran el cálculo");
  ok(r.boleta.some((f) => f.label === "Falabella · Ventas" && f.value === ventaEsp && f.tipo.sello === "probado"),
    `el insumo venta se resolvió contra el dato real (${ventaEsp}), sellado probado`);
  ok(r.boleta.some((f) => f.label === "Falabella · Contribución" && f.value === contribEsp && f.tipo.sello === "probado"),
    `el insumo contribución se resolvió contra el dato real (${contribEsp})`);
  const fUser = r.boleta.find((f) => /Cifra del usuario/.test(f.label));
  ok(!!fUser && fUser.tipo.sello === "indicado" && /procedencia/.test(fUser.tipo.verificabilidadRazon),
    "la cifra del usuario entra sellada INDICADO con su procedencia declarada", fUser && JSON.stringify(fUser.tipo));
  const fFalt = r.boleta.find((f) => f.label === "Falabella · Contribución faltante");
  ok(!!fFalt && fFalt.value === faltanteEsp && fFalt.mandatory === true && fFalt.source === "computed" && fFalt.tipo.sello === "indicado",
    `la contribución faltante (${faltanteEsp}) sale computed+mandatory con sello INDICADO (derivada de vara del usuario)`, fFalt && JSON.stringify({ v: fFalt.value, m: fFalt.mandatory, s: fFalt.source, sello: fFalt.tipo.sello }));
  ok(typeof fFalt.formula === "string" && fFalt.formula.startsWith(faltanteEsp + " = "), "la fig lleva su FÓRMULA declarada", fFalt && fFalt.formula);
  ok(r.facts.conCifraDeUsuario === true && /hipótesis|escenario/i.test(r.facts.marco_hipotesis || ""),
    "facts declaran el marco de hipótesis (vara del usuario)");
  ok(out.ledger.figs.length === r.boleta.length && out.ledger.figs.every((f) => f.canon), "todas las figs entran al ledger con canon");

  // variación del negocio (sin entidad): los agregados de deriveKpis, jamás una re-suma propia
  const rv = runPlan({ intent: "answer", calls: [{ tool: "calcular", args: { operacion: "variacion_pct", insumos: [{ metrica: "anterior" }, { metrica: "ventas" }] } }] }, { scenario: "actual" }).results[0];
  ok(rv.coverage.supported && rv.facts.resultados.variacion.value === "7.6%" && rv.boleta.some((f) => f.label === "Negocio · Ventas"),
    "variación del negocio: insumos de deriveKpis (Negocio · Ventas) → +7.6%", JSON.stringify(rv.facts && rv.facts.resultados));

  // declinaciones honestas, una por una
  const d1 = TOOLS.calcular({ operacion: "participacion", insumos: [{ entidad: "Falabella", metrica: "ventas" }, { entidad: "SAM-TV55", metrica: "capital" }], scenario: "actual" });
  ok(d1.coverage.supported === false && /no reconcilian/.test(d1.coverage.reason), "cruce de universos → declina nombrando la regla", d1.coverage.reason);
  const d2 = TOOLS.calcular({ operacion: "suma", insumos: [{ usuario: "$500K" }, { entidad: "Falabella", metrica: "contribucion" }], scenario: "actual" });
  ok(d2.coverage.supported === false && /procedencia/.test(d2.coverage.reason), "cifra del usuario SIN procedencia → declina pidiendo el origen", d2.coverage.reason);
  const d3 = TOOLS.calcular({ operacion: "promedio_movil", insumos: [{ entidad: "Falabella", metrica: "ventas" }], scenario: "actual" });
  ok(d3.coverage.supported === false && /fórmulas libres/.test(d3.coverage.reason), "operación fuera del catálogo → declina cerrado", d3.coverage.reason);
  const d4 = TOOLS.calcular({ operacion: "suma", insumos: [{ entidad: "NoExiste SA", metrica: "ventas" }, { metrica: "ventas" }], scenario: "actual" });
  ok(d4.coverage.supported === false && /no encuentro 'NoExiste SA'/.test(d4.coverage.reason), "insumo inexistente → declina honesto", d4.coverage.reason);
  const d5 = TOOLS.calcular({ operacion: "suma", insumos: [{ entidad: "Falabella", metrica: "margen" }, { entidad: "Falabella", metrica: "ventas" }], scenario: "actual" });
  ok(d5.coverage.supported === false && /MISMA unidad/.test(d5.coverage.reason), "margen (%) + venta ($) → declina por unidades", d5.coverage.reason);
}

console.log("── 3 · EL MURO VERIFICA CUENTAS DEL CATÁLOGO (bidireccional, aditivo) ──");
{
  const figsMedida = [fig("Falabella · Medida 1pp", "$194K", { unit: "money", raw: 194000 })];
  const baseMedida = { ledger: { figs: figsMedida }, results: [{ tool: "marginRead", facts: {}, boleta: figsMedida, coverage: { supported: true } }], trace: null, question: "si 1 punto vale $194K, ¿cuánto valen 4 puntos de margen?" };
  ok(guardC("Recuperar 4 puntos de margen en Falabella vale $776K ($194K × 4pp).", baseMedida).ok,
    "escalar: $194K × 4pp = $776K narrado PASA (el factor viene del eco de la pregunta)");
  {
    const r = guardC("Recuperar 4 puntos de margen en Falabella vale $920K.", baseMedida);
    ok(!r.ok && r.verdict === "cifra-no-autorizada", "el resultado TORCIDO ($920K, fuera de tolerancia) se VETA", r.verdict);
  }
  const figsVenta = [fig("Lider · Ventas", "$17.9M", { unit: "money", raw: 17900000 }), fig("Total · Ventas", "$100.0M", { unit: "money", raw: 100000000 })];
  const baseVenta = { ledger: { figs: figsVenta }, results: [{ tool: "queryMetric", facts: {}, boleta: figsVenta, coverage: { supported: true } }], trace: null, question: "" };
  ok(guardC("Lider representa el 17.9% de la venta total ($17.9M sobre $100.0M).", baseVenta).ok,
    "participación: 17.9M ÷ 100M = 17.9% narrado PASA");
  {
    const r = guardC("Lider representa el 24.5% de la venta total.", baseVenta);
    ok(!r.ok && r.verdict === "cifra-no-autorizada", "la participación torcida (24.5%) se VETA");
  }
  ok(guardC("La venta creció 7.6% contra el año anterior ($92.9M → $100.0M).",
    { ledger: { figs: [fig("Negocio · Ventas", "$100.0M", { unit: "money", raw: 100000000 }), fig("Negocio · Año anterior", "$92.9M", { unit: "money", raw: 92900000 })] }, results: [], trace: null, question: "" }).ok,
    "variación: (100−92.9)÷92.9 = 7.6% narrado PASA");
  // el caso canónico SIN la tool: venta+contribución en boleta, el 25% en la pregunta → la faltante pasa
  const figsFala = [fig("Falabella · Ventas", "$19.4M", { unit: "money", raw: 19433000 }), fig("Falabella · Contribución", "$4.3M", { unit: "money", raw: 4275000 })];
  const baseFala = { ledger: { figs: figsFala }, results: [{ tool: "entityRecord", facts: {}, boleta: figsFala, coverage: { supported: true } }], trace: null, question: "una noticia dice que la industria está en 25% de margen, ¿qué nos falta?" };
  ok(guardC("Para llegar al 25% que mencionás, a Falabella le faltan $583K de contribución.", baseFala).ok,
    "margen_objetivo re-computado por el muro: venta×25%−contribución = $583K PASA");
  {
    const r = guardC("Para llegar al 25%, a Falabella le faltan $1.2M de contribución.", baseFala);
    ok(!r.ok && r.verdict === "cifra-no-autorizada", "la faltante torcida ($1.2M) se VETA");
  }
  // ADITIVIDAD: sin material del catálogo, el muro es byte-idéntico al de siempre
  {
    const opts = () => ({ ledger: { figs: figsVenta }, results: [], trace: null, question: "" });
    const r1 = guardC("La venta de Lider fue $55.5M.", opts());
    ok(!r1.ok && r1.verdict === "cifra-no-autorizada", "una cifra inventada que NO es cuenta del catálogo sigue vetada igual");
    const r2 = guardC("Lider vendió $17.9M y el total fue $100.0M.", opts());
    ok(r2.ok && JSON.stringify(r2.violations) === "[]", "una narración 100% autorizada pasa idéntica (la vía nueva ni se consulta)");
  }
  // el pool se ACOTA: una fig de OTRA entidad (no mencionada) no participa de la cuenta. `facts` trae los
  // nombres como una tool real (es de ahí que guardC deriva entityNames — el scope de _isCalc/_isCalc2).
  {
    const figsDos = [fig("Falabella · Ventas", "$19.4M", { unit: "money", raw: 19433000 }), fig("Jumbo · Contribución", "$1.5M", { unit: "money", raw: 1500000 })];
    const base = () => ({ ledger: { figs: figsDos }, results: [{ tool: "gridTable", facts: { rows: [{ nombre: "Falabella" }, { nombre: "Jumbo" }] }, boleta: figsDos, coverage: { supported: true } }], trace: null, question: "" });
    // 1.5/19.433 = 7.7% — solo saldría combinando la fig de Jumbo, que la narración NO menciona
    const r = guardC("Falabella aporta el 7.7% en esa cuenta.", base());
    ok(!r.ok, "una participación que necesita la fig de una entidad NO mencionada se veta (scope como _isCalc2)");
    // y con las DOS entidades mencionadas, la MISMA cuenta pasa — el scope es de mención, no una prohibición
    const r2 = guardC("La contribución de Jumbo ($1.5M) representa el 7.7% de la venta de Falabella ($19.4M).", base());
    ok(r2.ok, "la misma participación con ambas entidades nombradas PASA", JSON.stringify(r2.violations));
  }
}

console.log("── 4 · EL MARCO DE HIPÓTESIS (vara del usuario) ──");
{
  const conUsuario = [{ tool: "calcular", facts: { conCifraDeUsuario: true }, coverage: { supported: true } }];
  const sinUsuario = [{ tool: "calcular", facts: { conCifraDeUsuario: false }, coverage: { supported: true } }];
  const texto = "Con tu 25% de referencia, a Falabella le faltan $583K de contribución.";
  ok(/estimado/i.test(ensureHypothesisFraming(texto, "default", conUsuario)), "calcular con cifra del usuario → el marco de hipótesis se garantiza");
  ok(ensureHypothesisFraming(texto, "default", sinUsuario) === texto, "calcular SOLO sobre datos del motor → sin marco extra (la cuenta es del dato)");
  ok(/estimado/i.test(ensureHypothesisFraming(texto, "simulacion", [])), "el disparo por mode=simulacion sigue intacto");
}

console.log("── 5 · BYTE-IDENTIDAD: LAS TOOLS EXISTENTES NO SE MOVIERON ──");
{
  const nombres = toolNames();
  ok(nombres.length === 24 && nombres.includes("calcular"),
    "el registro tiene las 23 tools de siempre + calcular (nada se fue, nada más entró)", nombres.join(","));
  const viaTool = TOOLS.marginRead({ dimension: "cliente", scenario: "actual" });
  const viaComposer = composeSpecMargin({ dimension: "cliente", scenario: "actual", focus: "bajo_benchmark", filters: {}, negativo: false, pct: false, gap: null, entityScope: null });
  ok(JSON.stringify(viaTool.boleta) === JSON.stringify(viaComposer.evidence.boleta), "marginRead: boleta byte-igual a su composer (como antes de F2)");
  const viaTool2 = TOOLS.queryMetric({ metric: "ventas", dimension: "cliente", scenario: "actual" });
  const viaComposer2 = composeSpecRetrieval({ metric: "ventas", dimension: "cliente", filters: {}, scenario: "actual", limit: null, sort: null, entityScope: null });
  ok(JSON.stringify(viaTool2.boleta) === JSON.stringify(viaComposer2.evidence.boleta), "queryMetric: boleta byte-igual a su composer");
}

console.log(`\n── _probe_amplitud_f2: ${PASS} PASS · ${FAIL} FAIL ──`);
process.exit(FAIL ? 1 : 0);
