/* === _parse_harness.mjs · ADI Core · Paso 5 v1 · HARNESS DE PARSE (el experimento aislado · provider-neutral) ===
 * Prueba UNA cosa: ¿el LLM entiende la pregunta y emite un SPEC VÁLIDO contra el contrato de ADI?
 * Flujo (v1 · gateway-only · motor local): pregunta → adapter.parse(text, {system=contractMenu, tool, model}) → spec
 *   → answerADIFromSpec LOCAL → categoriza la ruta. SIN UI, SIN mover el motor. Si falla, el fallo es el parse/prompt.
 *
 * PROVIDER-NEUTRAL: el proveedor es un adapter intercambiable (LLM_PROVIDER). El contrato/spec/seam no dependen de él.
 * El MISMO harness corre con distintos providers y compara: válidos / ejecutables / degradación honesta / costo·latencia.
 *
 * Uso (key-safe · .env local · nunca en chat/commit):
 *   .env → ANTHROPIC_API_KEY=sk-...  [ANTHROPIC_MODEL=claude-sonnet-5]  [LLM_PROVIDER=anthropic]
 *   node _parse_harness.mjs
 * Categorías: EJECUTA (entró y el motor ejecutó) · DEGRADA-HONESTO (spec dentro del contrato, no ejecutable hoy →
 *   correcto) · FUERA-CONTRATO (spec fuera del vocabulario → problema de parse) · ERROR (falló la llamada al LLM).
 */
import esbuild from "esbuild"; import { pathToFileURL } from "url"; import path from "path"; import fs from "fs";

const root = process.cwd();
const entry = path.join(root, "_pment.js"), out = path.join(root, "_pmb.mjs");
fs.writeFileSync(entry, [
  'export { answerADIFromSpec } from "./src/adi/answerADIFromSpec.js";',
  'export { buildContractMenu } from "./src/adi/llm/contractMenu.js";',
  'export { buildSpecTool } from "./src/adi/llm/specTool.js";',
  'export { getAdapter } from "./src/adi/llm/providerAdapter.js";',
].join("\n"));
await esbuild.build({ entryPoints: [entry], bundle: true, outfile: out, format: "esm", platform: "node", logLevel: "silent" });
const M = await import(pathToFileURL(out).href + "?t=" + Math.random());
try { fs.unlinkSync(entry); } catch {} try { fs.unlinkSync(out); } catch {}
const { answerADIFromSpec, buildContractMenu, buildSpecTool, getAdapter } = M;

// carga .env si existe · KEY-SAFE: el owner crea el .env local · yo nunca veo la key
try {
  const envPath = path.join(root, ".env");
  if (fs.existsSync(envPath)) {
    for (const ln of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
      const mt = ln.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (mt && !process.env[mt[1]]) process.env[mt[1]] = mt[2].replace(/^["']|["']$/g, "");
    }
  }
} catch { /* sin .env · seguimos con el entorno */ }

const PROVIDER = process.env.LLM_PROVIDER || "anthropic";
const MODEL = process.env.LLM_MODEL_PARSE || process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
const PARSE_ENABLED = process.env.LLM_PARSE_ENABLED !== "false";
const SYSTEM = buildContractMenu();
const TOOL = buildSpecTool();

let adapter;
try { adapter = getAdapter(PROVIDER); }
catch (e) { console.log("── _parse_harness: config ──\n  " + e.message); process.exit(1); }

const QUESTIONS = [
  { q: "¿cuáles son mis 5 mejores clientes por contribución?", note: "rank cliente contribucion desc 5" },
  { q: "mostrame el margen por cliente", note: "overview margen cliente" },
  { q: "compará Falabella con Lider", note: "compare cliente" },
  { q: "¿cómo está Falabella?", note: "dive cliente Falabella" },
  { q: "ventas por marca", note: "overview ventas marca" },
  { q: "los 3 SKU con peor margen", note: "rank sku margen asc 3" },
  { q: "¿por qué no puedo ver el margen por bodega?", note: "explain/metric-not-in-dim margen@bodega" },
  { q: "¿qué pasa con el margen por SKU si el margen cae 5 puntos?", note: "simulation margin sku → base-only" },
  { q: "qué SKU rotan menos", note: "rank sku rotacion asc" },
  { q: "cuánto capital tengo por bodega", note: "overview capital bodega" },
  { q: "el costo por cliente", note: "overview costo cliente → declarado, no ejecutable" },
  { q: "contribución por familia", note: "overview contribucion familia" },
  { q: "el peor cliente por margen", note: "rank cliente margen asc 1" },
  { q: "dame el margen de la marca Bosch por cliente", note: "cruce marca×cliente → bloqueado" },
  { q: "rotación por SKU, los 10 más altos", note: "rank sku rotacion desc 10" },
  { q: "compará la marca Bosch con la marca Makita", note: "compare marca → no cableado" },
];

const OUT_OF_CONTRACT = new Set(["version", "unsupported-op", "unknown-metric", "unknown-dimension", "metric-not-in-dim", "bad-filter", "bad-assumption", "no-spec", "unhandled"]);
function categorize(route) {
  if (typeof route !== "string") return "ERROR";
  if (!route.startsWith("spec_blocked_")) return "EJECUTA";
  return OUT_OF_CONTRACT.has(route.slice("spec_blocked_".length)) ? "FUERA-CONTRATO" : "DEGRADA-HONESTO";
}

const _avail = adapter.isAvailable ? adapter.isAvailable() : !!process.env[adapter.keyEnv];
if (!PARSE_ENABLED || !_avail) {
  console.log("── _parse_harness: LISTO pero SIN conexión ──");
  console.log(`  provider=${PROVIDER} · model=${MODEL} · parseEnabled=${PARSE_ENABLED} · conexión=${_avail ? "disponible" : "AUSENTE"}`);
  console.log(`  No hay key/token/base-url en el entorno. Camino seguro: .env local con ${adapter.keyEnv}=... y corré: node _parse_harness.mjs`);
  console.log(`  Preguntas cargadas: ${QUESTIONS.length}`);
  console.log("\n── Vista previa del MENÚ que verá el LLM (buildContractMenu · generado del contrato) ──\n");
  console.log(SYSTEM);
  process.exit(0);
}

// rate-limit de orgs nuevas (RPM bajo) → reintento con backoff SOLO en 429. El scope 401 falla rápido (perms de la key).
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function parseWithRetry(q) {
  let delay = 5000;
  for (let attempt = 0; attempt < 4; attempt++) {
    try { return await adapter.parse(q, { system: SYSTEM, tool: TOOL, model: MODEL }); }
    catch (e) {
      if (/HTTP 429/.test(String(e && e.message)) && attempt < 3) { await sleep(delay); delay *= 2; continue; }
      throw e;
    }
  }
}

const counts = { EJECUTA: 0, "DEGRADA-HONESTO": 0, "FUERA-CONTRATO": 0, ERROR: 0 };
let tokIn = 0, tokOut = 0, totalMs = 0, calls = 0;
const lines = [];
for (const { q, note } of QUESTIONS) {
  let cat, route, detail, ms = 0;
  const t0 = Date.now();
  try {
    const { spec, usage } = await parseWithRetry(q);
    ms = Date.now() - t0; totalMs += ms; calls++;
    if (usage) { tokIn += usage.input_tokens || 0; tokOut += usage.output_tokens || 0; }
    const r = answerADIFromSpec(spec, {}, {});
    route = r.route; cat = categorize(route);
    detail = `${spec.operation}/${spec.metric}@${spec.dimension}${spec.scenario === "simulation" ? " [sim]" : ""}${spec.limit ? " N=" + spec.limit : ""}${spec.sort ? " " + spec.sort.dir : ""}`;
  } catch (e) { ms = Date.now() - t0; route = "THREW"; cat = "ERROR"; detail = String(e && e.message).slice(0, 140); }
  counts[cat]++;
  lines.push(`  [${cat.padEnd(14)}] "${q}"  (${ms}ms)\n        spec: ${detail}   · ruta: ${route}   (esperado: ${note})`);
  await sleep(2500);   // espaciado base para no golpear el RPM de la org nueva
}

const dentro = counts.EJECUTA + counts["DEGRADA-HONESTO"];
console.log(`── _parse_harness · provider=${PROVIDER} · model=${MODEL} ──`);
console.log(`  ¿ENTRÓ POR LA PUERTA (spec dentro del contrato)?  ${dentro}/${QUESTIONS.length}`);
console.log(`  EJECUTA ${counts.EJECUTA} · DEGRADA-HONESTO ${counts["DEGRADA-HONESTO"]} · FUERA-CONTRATO ${counts["FUERA-CONTRATO"]} · ERROR ${counts.ERROR}`);
console.log(`  costo/latencia: tokens in=${tokIn} out=${tokOut} · latencia media ${calls ? Math.round(totalMs / calls) : 0}ms (${calls} llamadas)`);
console.log(lines.join("\n"));
process.exit(0);
