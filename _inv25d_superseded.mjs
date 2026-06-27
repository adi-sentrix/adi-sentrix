import { JSDOM } from "jsdom"; import esbuild from "esbuild"; import { fileURLToPath, pathToFileURL } from "url"; import path from "path";
const dom = new JSDOM(`<!doctype html><html><body></body></html>`, { url: "http://localhost/" }); const W = dom.window;
globalThis.window=W; globalThis.document=W.document; globalThis.localStorage=W.localStorage; console.error=()=>{};
const root = path.dirname(fileURLToPath(import.meta.url)); const bp = path.join(root,"_oracle_bundle.mjs");
await esbuild.build({entryPoints:[path.join(root,"_oracle_entry.jsx")],bundle:true,outfile:bp,format:"esm",platform:"browser",jsx:"automatic",external:["react","react-dom","react-dom/client","react/jsx-runtime","react/jsx-dev-runtime"],alias:{recharts:path.join(root,"_oracle","stub_recharts.js")},logLevel:"silent"});
const mod = await import(pathToFileURL(bp).href);
const RESP = (r) => r.route === "spine_inv_superlative" || r.route === "spine_inv_retrieval";   // RESPONDE por el spine
const AVISA = /habilitado en esta fase|no tengo .* como dimensi/i;                              // el muro/G2 viejo
// los CONTROLES bodega-AVISA que los bricks 2.5a/b/c/c2 asertaban → en 2.5d pasan a RESPONDE (bodega = dimensión).
// Bodega NUNCA fue reachableByLegacy → su supersesión no es "vieja-ruta→nueva", es "AVISA-control → RESPONDE-eje".
const SUP = [
  { q: "qué bodega está más complicada", want: /Valparaíso/ },
  { q: "capital por bodega",             want: /[Bb]odega/ },
  { q: "rotación por bodega",            want: /[Bb]odega/ },
  { q: "en qué bodega tengo más capital detenido", want: /Valparaíso|[Bb]odega/ },
];
console.log("══════ CONTROLES BODEGA SUPERSEDED · AVISA → RESPONDE (mundo nuevo · 2.5d · bodega = dimensión) ══════\n");
let fail=0;
for (const { q, want } of SUP) {
  const r = mod.answerADI(q, {activeModule:"inventario"}, {scenario:"bonanza"});
  const ok = RESP(r) && want.test(r.text||"") && !AVISA.test(r.text||"");
  if(!ok) fail++;
  console.log(`«${q}»`);
  console.log(`  ${r.route}  →  ${(r.text||"").replace(/\n+/g," ").slice(0,120)}`);
  if (r.evidence && r.evidence.metrica) console.log(`  evidence: metrica=${r.evidence.metrica} · dim=${r.evidence.dimension} · op=${r.evidence.query_plan&&r.evidence.query_plan.operacion}`);
  console.log(`  ${ok?"✅ RESPONDE (superseded)":"🚨 NO superseded"}\n`);
}
console.log(`RECONFIRMACIÓN: ${SUP.length} controles de bodega → RESPONDE · fallas: ${fail} ${fail?"🚨":"✅"}`);
process.exit(fail?1:0);
