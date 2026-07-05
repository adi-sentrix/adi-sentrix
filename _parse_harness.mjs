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

// Las 5 frases EXACTAS de la revisión en vivo del owner (verbatim · espejo del deploy demo).
const QUESTIONS = [
  { q: "sube las ventas 3% por cliente",         note: "transform delta +3% ventas@cliente → EJECUTA (actual vs supuesto)" },
  { q: "bajá el capital 10% por bodega",         note: "transform delta -10% capital@bodega → EJECUTA (Δ negativo -$)" },
  { q: "sube el margen 3%",                      note: "supuesto sobre TASA (margen) → DEGRADA-HONESTO (no habilitado)" },
  { q: "sube la contribución 5% por familia",    note: "transform delta +5% contribucion@familia → EJECUTA (directo, sin derivar de ventas)" },
  { q: "ventas +3% y margen +2pts",              note: "COMPUESTO → op:multi → DEGRADA-HONESTO (un supuesto a la vez)" },
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

// ── helpers de reporte (lo que el owner quiere ver por frase) ──
const _tf = (s) => (s && s.transform && s.transform.op)
  ? `SÍ · {op:${s.transform.op}, value:${s.transform.value ?? "—"}, unit:${s.transform.unit ?? "—"}, base:${s.transform.base ?? "—"}}`
  : "no";
const _compuesto = (s, route) => ((s && s.transform && s.transform.op === "multi") || route === "spec_blocked_simulate-compound") ? "SÍ" : "no";
const _prohibido = (text) => { const m = String(text || "").match(/escenario|bonanza|tensi[oó]n|crisis/i); return m ? `⚠️ SÍ ("${m[0]}")` : "NINGUNO ✓"; };

const counts = { EJECUTA: 0, "DEGRADA-HONESTO": 0, "FUERA-CONTRATO": 0, ERROR: 0 };
let tokIn = 0, tokOut = 0, totalMs = 0, calls = 0;
const lines = [];
for (const { q, note } of QUESTIONS) {
  let cat, route, block, ms = 0;
  const t0 = Date.now();
  try {
    const { spec, usage } = await parseWithRetry(q);
    ms = Date.now() - t0; totalMs += ms; calls++;
    if (usage) { tokIn += usage.input_tokens || 0; tokOut += usage.output_tokens || 0; }
    const r = answerADIFromSpec(spec, {}, {});
    route = r.route; cat = categorize(route);
    block = [
      `        operación: ${spec.operation} · métrica: ${spec.metric} · dimensión: ${spec.dimension}`,
      `        transform: ${_tf(spec)}`,
      `        resultado: ${cat} · compuesto: ${_compuesto(spec, route)} · ruta: ${route}`,
      `        lenguaje prohibido (escenario/Bonanza/Tensión/Crisis): ${_prohibido(r.text)}`,
      `        spec: ${JSON.stringify(spec)}`,
      `        esperado: ${note}`,
    ].join("\n");
  } catch (e) { ms = Date.now() - t0; route = "THREW"; cat = "ERROR"; block = `        ERROR: ${String(e && e.message).slice(0, 160)}\n        esperado: ${note}`; }
  counts[cat]++;
  lines.push(`  [${cat.padEnd(14)}] "${q}"  (${ms}ms)\n${block}`);
  await sleep(2500);   // espaciado base para no golpear el RPM de la org nueva
}

const dentro = counts.EJECUTA + counts["DEGRADA-HONESTO"];
console.log(`── _parse_harness · provider=${PROVIDER} · model=${MODEL} · ${QUESTIONS.length} frases (revisión en vivo) ──`);
console.log(`  ¿ENTRÓ POR LA PUERTA (spec dentro del contrato)?  ${dentro}/${QUESTIONS.length}`);
console.log(`  EJECUTA ${counts.EJECUTA} · DEGRADA-HONESTO ${counts["DEGRADA-HONESTO"]} · FUERA-CONTRATO ${counts["FUERA-CONTRATO"]} · ERROR ${counts.ERROR}`);
console.log(`  costo/latencia: tokens in=${tokIn} out=${tokOut} · latencia media ${calls ? Math.round(totalMs / calls) : 0}ms (${calls} llamadas)`);
console.log(lines.join("\n\n"));
process.exit(0);
