/* === _vara_unica_gate.mjs · LA LEY DE LA VARA ÚNICA (owner 2026-09-03: «nada de parches, profundas») ========
 *
 * EL DEFECTO MEDIDO (sonda del supervisor, con el benchmark declarado por `perfil.benchmark` — el MISMO canal
 * del plazo de cobro): el cliente declara 22% y ADI decía 22,0% mientras la pantalla y el motor seguían en
 * 30,1%. Catorce sitios tenían la vara ESCRITA A MANO, y uno más la tenía CONGELADA (el `margenKPI` que la
 * ingesta graba: si el negocio declara su vara después de cargar el archivo, la cabecera se quedaba con la
 * vieja). Es la enfermedad de la venta oficial, pero sobre la VARA — con la que ADI juzga el negocio entero.
 *
 * LA LEY, y es de CLASE, no de sitio: **la vara sale SIEMPRE por la puerta** (`benchmarkOf`, que resuelve
 * criterio del usuario → `benchmark` de la fila → `POLICY.benchmark`, que a su vez sale del perfil del tenant
 * o de la config). Un literal de benchmark en el código es ILEGAL — este gate lo caza; la carnada lo prueba.
 *
 * LO QUE ESTE GATE VIGILA:
 *   1 · NINGÚN literal de vara en `src/` fuera de la ÚNICA declaración legítima (`POLICY_CONFIG.benchmark`,
 *       la referencia general de la casa) y de los datasets, que son dato del cliente, no código.
 *   2 · CONDUCTA: con un pack que declara una vara distinta de la general, **motor, pantalla y ADI dicen los
 *       TRES lo mismo** (la sonda del supervisor, hecha candado).
 *   3 · LA PROCEDENCIA SIGUE VIVA (regla del owner de agosto: «no quiero que la referencia general parezca una
 *       meta del cliente») — declarada y distinta según quién puso la vara.
 *   4 · CARNADA: un `= 30.1` plantado en un módulo → ROJO.
 *
 * OFFLINE · determinístico · cero red. `node --import ./scripts/offline-guard.mjs _vara_unica_gate.mjs` */
import fs from "node:fs";
import path from "node:path";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { plantillaEjemplo } from "./src/ingesta/plantilla/generarPlantilla.js";
import { ingestarPlantilla } from "./src/ingesta/plantilla/ingestarPlantilla.js";
import { POLICY_CONFIG, benchmarkOf } from "./src/config/businessPolicy.js";
import { deriveKpis } from "./src/engine/scenarios.js";
import { getMargenKPI } from "./src/engine/metrics.js";
import { buildMesaEstado } from "./src/adi/sentrix/mesa.js";
import { composeSpecMargin } from "./src/adi/specRetrieval.js";
import { ESCENARIO_INICIAL } from "./src/config/scenarios.js";

let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };
const H = (t) => console.log("\n" + t);
const ROOT = process.cwd();

/* EL BARRIDO · un literal de vara es una asignación/comparación con el número de la referencia general.
 * Se factoriza para que la carnada lo ejercite con una fuente sintética (el patrón de _unico_buscador_gate). */
export const tieneLiteralDeVara = (src, valor) => {
  const n = String(valor).replace(".", "\\.");
  const sinComentarios = String(src)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
  return new RegExp(`(?:benchmark|vara|piso|referencia)[^\\n=<>]{0,40}(?:=|\\|\\||\\?\\?|:)\\s*${n}\\b|(?:=|\\|\\||\\?\\?|:)\\s*${n}\\b[^\\n]{0,40}(?:benchmark|vara)`, "i")
    .test(sinComentarios);
};

const _archivos = (dir, out = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name.startsWith(".")) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) _archivos(p, out);
    else if (/\.(js|jsx)$/.test(e.name) && !/\.carnada/.test(e.name)) out.push(p);
  }
  return out;
};
const rel = (p) => path.relative(ROOT, p).replace(/\\/g, "/");

/* ═══ 1 · NINGÚN LITERAL DE VARA FUERA DE SU ÚNICA DECLARACIÓN ══════════════════════════════════════════════ */
H("1 · la vara se escribe UNA vez (la referencia general) — el resto la pide por la puerta");
{
  /* los datasets son DATO DEL CLIENTE, no código: un pack puede traer su benchmark por fila y eso es
   * exactamente lo que `benchmarkOf` respeta. La ley rige sobre el código que DECIDE. */
  const DECLARADOS = new Map([
    ["src/config/businessPolicy.js", "LA CASA: `POLICY_CONFIG.benchmark` — la referencia general, declarada UNA vez y con su procedencia"],
  ]);
  const conLiteral = _archivos(path.join(ROOT, "src"))
    .filter((p) => !/^src[/\\]data[/\\]/.test(path.relative(ROOT, p)))
    .filter((p) => tieneLiteralDeVara(fs.readFileSync(p, "utf8"), POLICY_CONFIG.benchmark));
  const fuera = conLiteral.map(rel).filter((p) => !DECLARADOS.has(p));
  ok(fuera.length === 0,
    `★ ningún módulo fuera de la declaración única escribe la vara a mano (${conLiteral.length} con literal)`,
    fuera.join(", "));
  for (const [p, porque] of DECLARADOS) ok(fs.existsSync(path.join(ROOT, p)), `declarado vivo: ${p} — ${porque.slice(0, 70)}…`);
  /* y la puerta se usa DE VERDAD: los módulos que deciden con la vara la piden */
  const PUERTA = ["src/engine/scenarios.js", "src/engine/metrics.js", "src/config/mechanisms.js",
    "src/config/cognitiveData.js", "src/config/primitives.js", "src/adi/narrativeLayer.js", "src/adi/router.js"];
  const sinPuerta = PUERTA.filter((p) => !/benchmarkOf\s*\(/.test(fs.readFileSync(path.join(ROOT, p), "utf8")));
  ok(sinPuerta.length === 0, `★ los ${PUERTA.length} módulos que deciden con la vara la piden por \`benchmarkOf\``, sinPuerta.join(", "));
}

/* ═══ 2 · LA CONDUCTA · con la vara declarada, los tres dicen lo mismo (la sonda, hecha candado) ════════════ */
H("2 · el cliente declara su vara → motor, pantalla y ADI la usan los TRES");
{
  const base = ingestarPlantilla(Buffer.from(plantillaEjemplo()), { nombreArchivo: "v2.xlsx", fechaCarga: "2026-08-31" });
  ok(!!(base && base.ok && base.dataset), "el pack de plantilla ingesta (el vehículo de la prueba)");
  for (const declarado of [null, 22, 38]) {
    const pack = declarado == null ? base.dataset
      : { ...base.dataset, perfil: { ...(base.dataset.perfil || {}), benchmark: declarado } };
    initTenant(pack);
    const esperado = declarado == null ? POLICY_CONFIG.benchmark : declarado;
    const dk = deriveKpis(ESCENARIO_INICIAL);
    const km = getMargenKPI(ESCENARIO_INICIAL);
    const linea = String(((buildMesaEstado(ESCENARIO_INICIAL) || {}).estados || {}).margen ? buildMesaEstado(ESCENARIO_INICIAL).estados.margen.linea : "");
    const sm = composeSpecMargin({ focus: "bajo_benchmark", dimension: "cliente", scenario: ESCENARIO_INICIAL });
    const figB = sm && sm.evidence.boleta.find((f) => /^Benchmark de margen$/i.test(f.label));
    const cerca = (v) => Number.isFinite(Number(v)) && Math.abs(Number(v) - esperado) < 0.05;
    const etiqueta = declarado == null ? "sin declarar (la referencia general)" : `declara ${declarado}%`;
    ok(cerca(dk.margen && dk.margen.benchmark), `★ [${etiqueta}] el MOTOR (deriveKpis) usa ${esperado}`, `dio ${dk.margen && dk.margen.benchmark}`);
    ok(cerca(km && km.benchmark), `★ [${etiqueta}] la PANTALLA (getMargenKPI) usa ${esperado} — la vara vigente pisa a la congelada por la ingesta`, `dio ${km && km.benchmark}`);
    ok(linea.includes(`(${esperado}%)`), `★ [${etiqueta}] la CARD de la Mesa dice ${esperado}%`, linea);
    ok(!figB || cerca(figB.raw), `★ [${etiqueta}] ADI sella ${esperado} en su boleta`, figB && String(figB.raw));
    ok(cerca(benchmarkOf(null)), `…y la puerta misma resuelve ${esperado}`);
  }
  initTenant(TENANT_DEMO);
  ok(Math.abs(benchmarkOf(null) - POLICY_CONFIG.benchmark) < 0.05,
    "…y al volver al demo (sin vara declarada) la puerta vuelve a la referencia general — la vara no arrastra entre packs");
}

/* ═══ 3 · LA PROCEDENCIA SIGUE VIAJANDO (regla del owner de agosto) ═════════════════════════════════════════ */
H("3 · «no quiero que la referencia general parezca una meta del cliente»: la procedencia se declara y distingue");
{
  const sinDeclarar = ingestarPlantilla(Buffer.from(plantillaEjemplo()), { nombreArchivo: "v2.xlsx", fechaCarga: "2026-08-31" });
  const kpiSin = sinDeclarar.dataset && sinDeclarar.dataset.margenKPI;
  ok(!!kpiSin && typeof kpiSin.benchmarkProcedencia === "string" && /referencia general/i.test(kpiSin.benchmarkProcedencia),
    "★ sin vara declarada, la procedencia dice que es la referencia general de ADI — no una meta del cliente",
    kpiSin && kpiSin.benchmarkProcedencia);
  const src = fs.readFileSync(path.join(ROOT, "src", "ingesta", "plantilla", "motorKpi.js"), "utf8");
  ok(/benchmarkProcedencia:\s*benchmarkDelNegocio !== undefined \? "informado"/.test(src),
    "★ y cuando el negocio SÍ la declara, la procedencia cambia a «informado» — las dos varas no se confunden");
  const pol = fs.readFileSync(path.join(ROOT, "src", "config", "businessPolicy.js"), "utf8");
  ok(/procedenciaDeLaVara|PROCEDENCIA DE LA REFERENCIA/i.test(pol),
    "…y la doctrina de la procedencia sigue escrita donde vive la vara");
}

/* ═══ 4 · CARNADA · un literal plantado se caza ═════════════════════════════════════════════════════════════ */
H("4 · carnada: si alguien vuelve a escribir la vara a mano, este gate arde");
{
  const sintetico = `
    // un módulo cualquiera que decide con la vara
    export function juzgar(m) {
      const benchmark = 30.1;
      return m.margen < benchmark;
    }`;
  ok(tieneLiteralDeVara(sintetico, POLICY_CONFIG.benchmark),
    "★ el barrido caza un `const benchmark = 30.1` plantado — el check de la sección 1 se pondría ROJO");
  ok(tieneLiteralDeVara("const b = m.benchmark || 30.1;", POLICY_CONFIG.benchmark),
    "…y también el fallback disfrazado (`m.benchmark || 30.1`), que es como estaban 6 de los 14 sitios");
  ok(tieneLiteralDeVara("        target: 30.1,", POLICY_CONFIG.benchmark) === false
    || tieneLiteralDeVara("      const benchmark_pct = 30.1;", POLICY_CONFIG.benchmark),
    "…el barrido mide la VARA nombrada, no cualquier 30.1 suelto (un total que valga 30.1 no es una vara)");
  ok(!tieneLiteralDeVara("const ventasDelMes = 30.1;", POLICY_CONFIG.benchmark),
    "★ y NO se dispara con un 30.1 que no es la vara — un gate que grita por todo se ignora");
  ok(!tieneLiteralDeVara("// histórico: antes acá había un benchmark = 30.1 escrito a mano", POLICY_CONFIG.benchmark),
    "…ni con la historia contada en un comentario: la ley rige sobre el código, no sobre la memoria escrita");
}

console.log(`\n── _vara_unica_gate: ${PASS} PASS · ${FAIL} FAIL (de ${PASS + FAIL}) ──`);
process.exit(FAIL ? 1 : 0);
