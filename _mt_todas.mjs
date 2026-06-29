// === sub-fix "todas" · clarify de alcance de simulación → follow-up resuelto (ADI_SIM_SCOPE_FOLLOWUP_ENABLED) ===
// El clarify de contribución/margen persiste un pendiente sim_scope; el turno N+1 lo resuelve determinístico.
// Asume flags afuera (requiere MT_SPINE_FOLLOWUP + SIM_SCOPE_FOLLOWUP). Gate: todas/grupo→cartera · cliente→dive · pregunta nueva NO se secuestra.
import { JSDOM } from "jsdom"; import esbuild from "esbuild"; import { fileURLToPath, pathToFileURL } from "url"; import path from "path"; import fs from "fs";
const dom = new JSDOM(`<!doctype html><html><body><div id="root"></div></body></html>`, { url: "http://localhost/", pretendToBeVisual: true });
const W = dom.window; globalThis.window = W; globalThis.document = W.document;
try { Object.defineProperty(globalThis, "navigator", { value: W.navigator, configurable: true }); } catch {}
globalThis.HTMLElement = W.HTMLElement; globalThis.Node = W.Node; globalThis.getComputedStyle = W.getComputedStyle.bind(W);
globalThis.requestAnimationFrame = W.requestAnimationFrame.bind(W); globalThis.cancelAnimationFrame = W.cancelAnimationFrame.bind(W);
globalThis.localStorage = W.localStorage; globalThis.IS_REACT_ACT_ENVIRONMENT = false; console.error = () => {};
const root = path.dirname(fileURLToPath(import.meta.url)); const bundlePath = path.join(root, "_oracle_bundle.mjs");
await esbuild.build({ entryPoints: [path.join(root, "_oracle_entry.jsx")], bundle: true, outfile: bundlePath, format: "esm", platform: "browser", jsx: "automatic", external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "react/jsx-dev-runtime"], alias: { recharts: path.join(root, "_oracle", "stub_recharts.js") }, logLevel: "silent" });
const mod = await import(pathToFileURL(bundlePath).href);
const React = (await import("react")).default; const { renderToStaticMarkup } = await import("react-dom/server");
const norm = (s) => (s || "").replace(/\s+/g, " ").trim();
function modR(t) { if (t == null) return null; const d = document.createElement("div"); d.innerHTML = renderToStaticMarkup(React.createElement(mod.AdiMessageBody, { text: t })); return d.textContent; }
const T1 = "qué debería hacer para aumentar el margen de contribución";
function chain(t2) { let ctx = { activeModule: "margenes" }; const r1 = mod.answerADI(T1, ctx, { scenario: "bonanza" }); ctx = r1.context || ctx; const r2 = mod.answerADI(t2, ctx, { scenario: "bonanza" }); return { t1route: r1.route, route: r2.route, text: modR(r2.text) }; }
const CASES = [
  { name: "T1 clarify dispara", t2: "todas", check: (r) => r.t1route === "simulation_needs_precision" },
  { name: "todas → cartera (contribution_ranking)", t2: "todas", check: (r) => r.route === "client_contribution_ranking" && /concentran/.test(r.text) },
  { name: "lider → client_dive", t2: "lider", check: (r) => r.route === "client_dive" && /Lider/.test(r.text) },
  { name: "el grupo erosionado → cartera", t2: "el grupo erosionado", check: (r) => r.route === "client_contribution_ranking" },
  { name: "pregunta nueva NO se secuestra", t2: "qué SKU tiene más capital", check: (r) => r.route === "spine_inv_superlative" && /SAM-REF500L/.test(r.text) },
];
const out = {}; const rows = [];
for (const c of CASES) { const r = chain(c.t2); out[c.name] = r; rows.push({ name: c.name, route: r.route, pass: c.check(r), text: r.text }); }
fs.writeFileSync(path.join(root, process.argv[2] || "_mttodas_dump.json"), JSON.stringify(out, null, 2));
console.log("█".repeat(60)); console.log('sub-fix "todas" · clarify de alcance resuelto'); console.log("█".repeat(60));
for (const r of rows) { console.log(`${r.pass ? "✅" : "🚨 FALLA"} ${r.name.padEnd(40)} → ${r.route}`); if (!r.pass) console.log(`     ${norm(r.text || "(null)").slice(0, 80)}`); }
const fails = rows.filter(r => !r.pass);
console.log("═".repeat(60)); console.log(`GATES: ${rows.length - fails.length}/${rows.length}` + (fails.length ? ` · 🚨 ${fails.map(f => f.name).join(", ")}` : " · TODOS VERDES")); console.log("═".repeat(60));
process.exit(fails.length ? 1 : 0);
