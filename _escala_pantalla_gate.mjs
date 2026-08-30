/* === _escala_pantalla_gate.mjs · LA PANTALLA HABLA EN LA ESCALA DEL PACK (owner 2026-08-30, barrido A·1) =====
 *
 * EL DEFECTO QUE VIGILA, medido antes del barrido: la Mesa de un pack de planilla decía «$4.5M sin capturar ·
 * $304K de carga» sobre un negocio de $61 mil, y `headlineTotal` reportaba raw 61.483.000. El ×1000 fijo vivía
 * en cada superficie visible: mesa, mesaFlujo, mesaResultado, headline, resumenComercial, specRetrieval (que
 * calcula los focos que la card muestra) y los formateadores de SentrixPanel.
 *
 * LA SALIDA: cada sitio lee `factorComercialDe(pack)` — la escala DECLARADA (`escalaComercial`)— en vez de
 * asumir miles. Sin declarar cae a «K»: el tenant de fábrica produce EXACTAMENTE los bytes de siempre, y este
 * candado lo exige literal (sección 1). De paso, la card de ventas dejó de afirmar «+0% vs presupuesto» sobre
 * un negocio sin presupuesto declarado (la regla de la v2.3, aplicada a la Mesa).
 *
 * ⚠️ ALCANCE: superficies de PANTALLA + specRetrieval (calcula lo que las cards muestran — partirlo entre
 * etapas dejaría un archivo mitad y mitad). La maquinaria honda (toolRegistry, composers, pnl, entityRecord)
 * es la etapa 3 del barrido, con su carnada pasando por guardC. SentrixPanel (React) se verifica TEXTUAL:
 * los 8 formateadores comerciales rutean por `enK`, cuya semántica está gateada acá behavioralmente vía
 * `factorComercialDe` — se declara la limitación en vez de fingir una prueba de render.
 *
 * OFFLINE · determinístico · no importa el gateway y no puede gastar.
 * `node --import ./scripts/offline-guard.mjs _escala_pantalla_gate.mjs`
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { plantillaEjemplo } from "./src/ingesta/plantilla/generarPlantilla.js";
import { ingestarPlantilla } from "./src/ingesta/plantilla/ingestarPlantilla.js";
import { buildMesaEstado } from "./src/adi/sentrix/mesa.js";
import { headlineTotal } from "./src/adi/sentrix/headline.js";
import { buildResumenComercial } from "./src/adi/sentrix/resumenComercial.js";
import { buildMesaFlujo } from "./src/adi/sentrix/mesaFlujo.js";
import { buildMesaResultado } from "./src/adi/sentrix/mesaResultado.js";

let pass = 0, fail = 0;
const ok = (cond, label, detalle) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label}`); if (detalle !== undefined) console.log(`      ${detalle}`); }
};
const H = (t) => console.log(`\n${t}`);
const PACK = ingestarPlantilla(Buffer.from(plantillaEjemplo()), { nombreArchivo: "v2.xlsx", fechaCarga: "2026-08-31" }).dataset;
/** los montos ×1000 que se MIDIERON en pantalla antes del barrido — si reaparecen, el defecto volvió */
const INFLADOS = /\$61\.5M|\$62\.0M|\$22\.6M|\$24\.0M|\$4\.5M sin capturar|\$304K de carga|\$21\.0M|\$19\.6M/;

/* ═══ 1 · EL TENANT DE FÁBRICA · byte por byte ════════════════════════════════════════════════════════════════ */
H("1 · el demo no se mueve: las mismas cifras de siempre, literales");
{
  initTenant(TENANT_DEMO);
  const m = buildMesaEstado("actual");
  ok(m.estados.ventas.linea === "+3.1% vs presupuesto · +7.6% vs año anterior",
    "card de ventas byte-idéntica (presupuesto declarado → se compara)", m.estados.ventas.linea);
  ok(m.estados.contribucion.linea === "$4.9M sin capturar contra tu benchmark · $656K de carga sobre el target",
    "card de contribución byte-idéntica", m.estados.contribucion.linea);
  ok(headlineTotal("ventas", "cliente", "actual").raw === 100000000,
    "headline: los $100.0M del demo siguen siendo 100.000.000 crudos");
  const r = buildResumenComercial("actual");
  const kpiVentas = (r.kpis || []).find((k) => k.key === "ventas");
  ok(!!kpiVentas && kpiVentas.valor === "$100.0M", "el KPI de ventas del resumen sigue diciendo $100.0M", kpiVentas && kpiVentas.valor);
}

/* ═══ 2 · EL PACK DE PLANILLA · la pantalla dice lo que dice el archivo ═══════════════════════════════════════ */
H("2 · un pack de planilla se muestra en SU escala — nunca más ×1000");
{
  initTenant(PACK);
  ok(headlineTotal("ventas", "cliente", "actual").raw === 61483,
    "headline: la venta oficial cruda es 61.483 — la del archivo, no 61.483.000");
  const m = buildMesaEstado("actual");
  const jm = JSON.stringify(m);
  ok(!INFLADOS.test(jm), "ninguna card de la Mesa trae un monto inflado medido", (jm.match(INFLADOS) || [])[0]);
  const r = buildResumenComercial("actual");
  const jr = JSON.stringify(r);
  ok(!INFLADOS.test(jr), "el resumen comercial tampoco", (jr.match(INFLADOS) || [])[0]);
  const flujo = buildMesaFlujo("actual");
  const jf = JSON.stringify(flujo);
  ok(!INFLADOS.test(jf) && !/\$\d+(\.\d+)?M/.test(jf),
    "la cara del cobro habla en los montos del archivo ($21K de abonos, no $21.0M)", (jf.match(/\$\d+(\.\d+)?M/) || [])[0]);
  const jpl = JSON.stringify(buildMesaResultado("actual"));
  ok(!/\$\d+(\.\d+)?M/.test(jpl), "y el P&L de la Mesa no fabrica millones", (jpl.match(/\$\d+(\.\d+)?M/) || [])[0]);
}

/* ═══ 3 · SIN PRESUPUESTO DECLARADO, LA CARD NO COMPARA CONTRA NADA ═══════════════════════════════════════════ */
H("3 · «+0% vs presupuesto» sin presupuesto era una afirmación — ya no existe");
{
  initTenant(PACK);
  const v = buildMesaEstado("actual").estados.ventas;
  ok(/sin presupuesto declarado/.test(v.linea), "la card lo dice con palabras", v.linea);
  ok(!/vs presupuesto/.test(v.linea.replace("sin presupuesto declarado", "")),
    "y no queda ningún «% vs presupuesto» al lado");
  ok(v.ask === "¿Cómo vienen las ventas?", "el click tampoco promete una comparación que no existe", v.ask);
  ok(/vs año anterior/.test(v.linea), "la comparación que SÍ existe (año anterior) se conserva", v.linea);
}

/* ═══ 4 · SENTRIXPANEL · textual, declarado ═══════════════════════════════════════════════════════════════════ */
H("4 · los 8 formateadores comerciales de SentrixPanel rutean por enK (verificación textual, declarada)");
{
  const s = fs.readFileSync("./src/ui/SentrixPanel.jsx", "utf8").replace(/\r\n/g, "\n");
  ok(/const enK = \(v\) => \(Number\(v\) \|\| 0\) \* factorComercialDe\(getTenantData\(\)\) \/ 1000;/.test(s),
    "enK existe y lee la escala DECLARADA del pack");
  ok(/const fmtK = \(n\) => simboloMoneda\(\) \+ Math\.round\(enK\(n\)\) \+ "K";/.test(s), "fmtK rutea por enK");
  ok(/const fMon = .*Math\.abs\(enK\(n\)\)/.test(s), "fMon rutea por enK");
  ok(/const usdK = \(vK\) => \{ const v = enK\(vK\) \* 1000/.test(s), "usdK (P&L del panel) rutea por enK");
  ok(/Math\.abs\(enK\(v\)\) >= 1000 \? fMon\(v\) : fmtK\(v\)/.test(s), "el umbral del ring compara en unidades convertidas");
  // DISPLAY K BAJO $1M (owner 2026-08-30): estos formateadores dejaron de ser siempre-M — «$87K, nunca $0.1M».
  // El ruteo por enK se mantiene (la escala sigue declarada); lo que cambió es la magnitud del sufijo.
  ok(/const money = \(v\) => \{ const k = enK\(v\); return simboloMoneda\(\) \+ \(Math\.abs\(k\) >= 1000 \? \(k \/ 1000\)\.toFixed\(1\) \+ "M" : Math\.round\(k\) \+ "K"\); \};/.test(s),
    "las columnas comerciales del cuadro rutean por enK, con K bajo $1M");
  ok((s.match(/const fmV = \(v\) => \{ const k = enK\(v\); return simboloMoneda\(\) \+ \(Math\.abs\(k\) >= 1000 \? \(k \/ 1000\)\.toFixed\(1\) \+ "M" : Math\.round\(k\) \+ "K"\); \};/g) || []).length === 2,
    "las dos películas (comparada y global) rutean por enK, con K bajo $1M");
  ok(/const _fmDin = \(v\) => \{ const k = enK\(v\);/.test(s), "el Pareto rutea por enK");
  ok(!/\* 1000(?!\) \/ 10)/.test(s.split("\n").filter((l) => /usdK|fmV|fMon|fmtK|_fmDin|const money =/.test(l)).join("\n").replace(/enK\(vK\) \* 1000/, "")),
    "y ningún formateador comercial conserva un ×1000 fijo");
}

/* ═══ 5 · CARNADAS · cada superficie, probada ROJA con el ×1000 fijo de vuelta ════════════════════════════════ */
H("5 · CARNADA · el candado se prueba con el defecto puesto");
{
  const tmp = [];
  let nCarnada = 0;
  const mutar = (rel, reemplazos) => {
    const abs = path.join(process.cwd(), rel);
    let txt = fs.readFileSync(abs, "utf8").replace(/\r\n/g, "\n");   // CRLF de git en Windows: normalizar SIEMPRE
    for (const [de, a] of reemplazos) {
      const antes = txt;
      txt = txt.replace(de, a);
      if (txt === antes) return { error: `la carnada no encontró qué mutar en ${rel}` };
    }
    const destino = abs.replace(/\.jsx?$/, (m) => `.carnada${process.pid}_${++nCarnada}${m}`).replace(/\.jsx$/, ".jsx");
    fs.writeFileSync(destino, txt);
    tmp.push(destino);
    return { url: pathToFileURL(destino).href, destino };
  };
  const carnada = async (nombre, rel, reemplazos, prueba) => {
    const m = mutar(rel, reemplazos);
    if (m.error) return ok(false, `carnada «${nombre}»`, m.error);
    let cazada = false, detalle = "";
    try { cazada = await prueba(await import(m.url), m); }
    catch (e) { detalle = `la copia mutada ni siquiera carga: ${e.message}`; }
    ok(cazada, `carnada «${nombre}» → el chequeo se pone ROJO`, detalle || "el defecto pasó DESAPERCIBIDO");
  };

  // (a) specRetrieval con el ×1000 fijo: los focos de la card vuelven a inventar millones
  await carnada("specRetrieval al ×1000 fijo (los focos de la card)", "src/adi/specRetrieval.js",
    [[/const _fxe = \(\) => factorComercialDe\(getTenantData\(\)\);/, "const _fxe = () => 1000;"]],
    async (Mut) => {
      initTenant(PACK);
      const spec = Mut.composeSpecDiagnose ? Mut.composeSpecDiagnose("actual") : null;
      const j = JSON.stringify(spec || Mut.buildOverviewNarrative ? (Mut.composeSpecDiagnose && Mut.composeSpecDiagnose("actual")) : null) || "";
      // el foco de margen del pack vuelve a ser millonario
      return /\$4\.5M|"subtotal_usd":45\d\d\d\d\d/.test(j) || /subtotal_usd":4529/.test(j) || /\$\d+(\.\d)?M sin capturar/.test(j) || /45291\d\d|452\d\d\d\d/.test(j);
    });

  // (b) la Mesa con _moneyK fijo: los movers del pack se inflan
  await carnada("mesa al ×1000 fijo (movers)", "src/adi/sentrix/mesa.js",
    [[/const _moneyK = \(v\) => _money\(v \* factorComercialDe\(getTenantData\(\)\)\);/, "const _moneyK = (v) => _money(v * 1000);"]],
    async (Mut) => {
      initTenant(PACK);
      const j = JSON.stringify(Mut.buildMesaEstado("actual"));
      return /\$\d+(\.\d+)?M/.test(j);   // en el pack crudo del ejemplo, NINGÚN mover legítimo llega a millones
    });

  // (c) headline con ×1000 fijo: el raw vuelve a mentir
  await carnada("headline al ×1000 fijo", "src/adi/sentrix/headline.js",
    [[/v \* factorComercialDe\(getTenantData\(\)\) : v \};/, "v * 1000 : v };"]],
    async (Mut) => {
      initTenant(PACK);
      return Mut.headlineTotal("ventas", "cliente", "actual").raw === 61483000;
    });

  // (d) resumen con _fxc fijo: el KPI del pack dice $61.5M
  await carnada("resumenComercial al ×1000 fijo", "src/adi/sentrix/resumenComercial.js",
    [[/const _fxc = \(\) => factorComercialDe\(getTenantData\(\)\);/, "const _fxc = () => 1000;"]],
    async (Mut) => {
      initTenant(PACK);
      const j = JSON.stringify(Mut.buildResumenComercial("actual"));
      return /\$61\.5M/.test(j);
    });

  // (e) el cobro con _mK fijo: los abonos del archivo se vuelven millones
  await carnada("mesaFlujo al ×1000 fijo (cobro)", "src/adi/sentrix/mesaFlujo.js",
    [[/const _mK = \(v\) => _money\(v \* factorComercialDe\(getTenantData\(\)\)\);.*/, "const _mK = (v) => _money(v * 1000);"]],
    async (Mut) => {
      initTenant(PACK);
      return /\$\d+(\.\d+)?M/.test(JSON.stringify(Mut.buildMesaFlujo("actual")));
    });

  // (f) la card que vuelve a afirmar «vs presupuesto» sin presupuesto
  await carnada("card de ventas afirmando presupuesto inexistente", "src/adi/sentrix/mesa.js",
    [[/    linea: \[\n      _hayPpto \? `\$\{_pct\(K\.vsPresupuesto\)\} vs presupuesto` : etiquetaSinDeclarar\("presupuesto"\),\n      _hayAnt \? `\$\{_pct\(K\.vsAnterior\)\} vs año anterior` : "sin período anterior",\n    \]\.join\(" · "\),/,
      '    linea: `${_pct(K.vsPresupuesto)} vs presupuesto · ${_pct(K.vsAnterior)} vs año anterior`,']],
    async (Mut) => {
      initTenant(PACK);
      return /\+0% vs presupuesto/.test(Mut.buildMesaEstado("actual").estados.ventas.linea);
    });

  // (g) SentrixPanel: enK degradado a la identidad K — el chequeo textual (sección 4) tiene que caer
  {
    const m = mutar("src/ui/SentrixPanel.jsx",
      [[/const enK = \(v\) => \(Number\(v\) \|\| 0\) \* factorComercialDe\(getTenantData\(\)\) \/ 1000;/,
        "const enK = (v) => (Number(v) || 0) * 1000 / 1000;"]]);
    if (m.error) ok(false, "carnada «SentrixPanel sin escala declarada»", m.error);
    else {
      const s2 = fs.readFileSync(m.destino, "utf8");
      const pasaria = /const enK = \(v\) => \(Number\(v\) \|\| 0\) \* factorComercialDe\(getTenantData\(\)\) \/ 1000;/.test(s2);
      ok(!pasaria, "carnada «SentrixPanel sin escala declarada» → el chequeo textual se pone ROJO");
    }
  }

  for (const f of tmp) { try { fs.unlinkSync(f); } catch { /* */ } }
}

initTenant(TENANT_DEMO);
console.log(`\n── _escala_pantalla_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
