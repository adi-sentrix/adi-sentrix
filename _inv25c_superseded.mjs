import { JSDOM } from "jsdom"; import esbuild from "esbuild"; import { fileURLToPath, pathToFileURL } from "url"; import path from "path";
const dom = new JSDOM(`<!doctype html><html><body></body></html>`, { url: "http://localhost/" }); const W = dom.window;
globalThis.window=W; globalThis.document=W.document; globalThis.localStorage=W.localStorage; console.error=()=>{};
const root = path.dirname(fileURLToPath(import.meta.url)); const bp = path.join(root,"_oracle_bundle.mjs");
await esbuild.build({entryPoints:[path.join(root,"_oracle_entry.jsx")],bundle:true,outfile:bp,format:"esm",platform:"browser",jsx:"automatic",external:["react","react-dom","react-dom/client","react/jsx-runtime","react/jsx-dev-runtime"],alias:{recharts:path.join(root,"_oracle","stub_recharts.js")},logLevel:"silent"});
const mod = await import(pathToFileURL(bp).href);
const FOREIGN=/\d+\.\dx|\b\d+\s*d\b|\bdoh\b|rotaci[oó]n\s+[\d.]/i;  // rotación/DOH (capital "$N.NK" permitido)
// los gates de CAPITAL que pasan de AVISA → RESPONDE (Fix C BARRIDO capital)
const SUP = ["cuánto capital inmovilizado tengo","dónde está concentrado mi capital detenido","qué SKUs atrapan más capital","qué SKUs están atrapando más capital"];
console.log("══════ GATES DE CAPITAL SUPERSEDED · AVISA → RESPONDE (mundo nuevo · 2.5c-1 · vista amplia) ══════\n");
let leak=0;
for (const q of SUP) {
  const r = mod.answerADI(q, {activeModule:"inventario"}, {scenario:"bonanza"});
  const f = FOREIGN.test(r.text||""); if(f) leak++;
  console.log(`«${q}»`);
  console.log(`  ${r.route}  →  ${(r.text||"").replace(/\n+/g," ").slice(0,120)}`);
  if (r.evidence && r.evidence.metrica) console.log(`  evidence: metrica=${r.evidence.metrica} · fuente=${r.evidence.fuente} · op=${r.evidence.query_plan&&r.evidence.query_plan.operacion} · fórmula="${r.evidence.formula}"`);
  console.log(`  fuga ajena (rotación/DOH): ${f?"🚨 SÍ":"✅ no"}\n`);
}
console.log(`RECONFIRMACIÓN: ${SUP.length} gates de capital → RESPONDE · fugas ajenas: ${leak} ${leak?"🚨":"✅"}`);
process.exit(0);
