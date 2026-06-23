// Gate rápido por índice DEFER · modular (render AdiMessageBody) vs target cacheado (_defer_targets.json).
// Uso: node _gate.mjs 15 37 40 41 ...   (sin args → las 16). NO re-corre el oráculo (usa cache byte-exact).
import { JSDOM } from "jsdom";
import esbuild from "esbuild";
import { fileURLToPath, pathToFileURL } from "url";
import path from "path";
import fs from "fs";
const dom = new JSDOM(`<!doctype html><html><body><div id="root"></div></body></html>`, { url: "http://localhost/", pretendToBeVisual: true });
const W = dom.window;
globalThis.window = W; globalThis.document = W.document;
try { Object.defineProperty(globalThis, "navigator", { value: W.navigator, configurable: true }); } catch {}
globalThis.HTMLElement = W.HTMLElement; globalThis.Node = W.Node; globalThis.getComputedStyle = W.getComputedStyle.bind(W);
globalThis.requestAnimationFrame = W.requestAnimationFrame.bind(W); globalThis.cancelAnimationFrame = W.cancelAnimationFrame.bind(W);
globalThis.localStorage = W.localStorage; globalThis.IS_REACT_ACT_ENVIRONMENT = false; console.error = () => {};
const root = path.dirname(fileURLToPath(import.meta.url));
const bundlePath = path.join(root, "_oracle_bundle.mjs");
await esbuild.build({ entryPoints: [path.join(root, "_oracle_entry.jsx")], bundle: true, outfile: bundlePath, format: "esm", platform: "browser", jsx: "automatic", external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "react/jsx-dev-runtime"], alias: { recharts: path.join(root, "_oracle", "stub_recharts.js") }, logLevel: "silent" });
const mod = await import(pathToFileURL(bundlePath).href);
const React = (await import("react")).default;
const { renderToStaticMarkup } = await import("react-dom/server");
const norm = (s) => (s || "").replace(/\s+/g, " ").trim();
function modRendered(text) { if (text == null) return null; const t = document.createElement("div"); t.innerHTML = renderToStaticMarkup(React.createElement(mod.AdiMessageBody, { text })); return t.textContent; }
const targets = JSON.parse(fs.readFileSync(path.join(root, "_defer_targets.json"), "utf8"));
const argv = process.argv.slice(2).map(Number);
const idxs = argv.length ? argv : targets.map(t => t.i);
let pass = 0, defer = 0, mism = 0;
for (const i of idxs) {
  const t = targets.find(e => e.i === i);
  if (!t) { console.log(`[${i}] (sin target cacheado)`); continue; }
  const r = mod.answerADI(t.q, { activeModule: t.moduleKey }, { scenario: "bonanza" });
  const P = norm(t.text), M = norm(modRendered(r.text));
  let cat, diff = "";
  if (r.text == null) { cat = "DEFIERE"; defer++; }
  else if (P === M) { cat = "PARIDAD"; pass++; }
  else { cat = "MISMATCH"; mism++; let k = 0; while (k < Math.min(P.length, M.length) && P[k] === M[k]) k++; diff = `\n     @${k} piso«…${P.slice(Math.max(0,k-30),k+60)}»\n         mod «…${M.slice(Math.max(0,k-30),k+60)}»`; }
  console.log(`${cat.padEnd(8)} [${String(i).padStart(2)}] ${String(r.route).padEnd(22)} piso ${String(P.length).padStart(4)} / mod ${String(M?M.length:0).padStart(4)} «${t.q}»${diff}`);
}
console.log(`\n── gate: PARIDAD ${pass} · MISMATCH ${mism} · DEFIERE ${defer} (de ${idxs.length}) ──`);
process.exit(0);
