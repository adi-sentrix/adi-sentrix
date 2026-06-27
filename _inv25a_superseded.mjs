import { JSDOM } from "jsdom"; import esbuild from "esbuild"; import { fileURLToPath, pathToFileURL } from "url"; import path from "path";
const dom = new JSDOM(`<!doctype html><html><body></body></html>`, { url: "http://localhost/" }); const W = dom.window;
globalThis.window=W; globalThis.document=W.document; globalThis.localStorage=W.localStorage; console.error=()=>{};
const root = path.dirname(fileURLToPath(import.meta.url)); const bp = path.join(root,"_oracle_bundle.mjs");
await esbuild.build({entryPoints:[path.join(root,"_oracle_entry.jsx")],bundle:true,outfile:bp,format:"esm",platform:"browser",jsx:"automatic",external:["react","react-dom","react-dom/client","react/jsx-runtime","react/jsx-dev-runtime"],alias:{recharts:path.join(root,"_oracle","stub_recharts.js")},logLevel:"silent"});
const mod = await import(pathToFileURL(bp).href);
const FOREIGN=/\$\s?\d|\bUSD\b|\d+\s*d[ií]as|\bdoh\b|inmoviliz|capital\s+(atrap|deten)|stock\s*usd|d[ií]as\s+(de\s+)?cobertura/i;
// los gates de ROTACIÓN que pasan de AVISA → RESPONDE (Fix A · Fix C · spine 2.1a/2.1b/2.1d)
const SUP = ["cuál es el SKU con peor rotación","cuál es el SKU con mejor rotación","peor rotación","qué SKU de Samsung rota peor","cuál es el SKU de Samsung que peor rota","qué SKU de la familia Línea Blanca rota peor","qué SKU de Bosch rota peor","qué productos no rotan"];
console.log("══════ GATES DE ROTACIÓN SUPERSEDED · AVISA → RESPONDE (mundo nuevo · 2.5a) ══════\n");
let leak=0;
for (const q of SUP) {
  const r = mod.answerADI(q, {activeModule:"inventario"}, {scenario:"bonanza"});
  const f = FOREIGN.test(r.text||""); if(f) leak++;
  console.log(`«${q}»`);
  console.log(`  ${r.route}  →  ${(r.text||"").replace(/\n+/g," ").slice(0,120)}`);
  if (r.evidence) console.log(`  evidence: metrica=${r.evidence.metrica} · fuente=${r.evidence.fuente} · op=${r.evidence.query_plan&&r.evidence.query_plan.operacion} · fórmula="${r.evidence.formula}"`);
  console.log(`  fuga ajena (capital/DOH/$): ${f?"🚨 SÍ":"✅ no"}\n`);
}
console.log(`RECONFIRMACIÓN: ${SUP.length} gates de rotación → RESPONDE · fugas ajenas: ${leak} ${leak?"🚨":"✅"}`);
process.exit(0);
