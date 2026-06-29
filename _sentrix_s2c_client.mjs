// === Etapa 5 · Sentrix S2c · LECTURA del CLIENTE · margen (carga comercial) ===
// Asume flags afuera (régimen + SENTRIX_BOLETA + SENTRIX_READING). Gate clave: el TEXTO narrativo del cliente
// NO se toca (ya es ejecutivo) y el boleta carga reading{} con números IDÉNTICOS al texto (mismo narrative_signals).
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
function modR(t) { if (t == null) return null; const d = document.createElement("div"); d.innerHTML = renderToStaticMarkup(React.createElement(mod.AdiMessageBody, { text: t })); return d.textContent; }
const run = (q) => mod.answerADI(q, { activeModule: "margenes" }, { scenario: "bonanza" });
const r = run("el peor cliente por margen"); const txt = modR(r.text) || ""; const rd = r.evidence && r.evidence.reading;
const rmejor = run("el mejor cliente por margen");                  // control: no es worst → sin reading de cliente
const CASES = [
  // 1) el texto narrativo del cliente queda INTACTO (no reemplazado · sigue siendo el ejecutivo del piso)
  { name: "texto narrativo INTACTO (carga + recuperable + reframe)", pass: /carga comercial sobre Lider es 4\.2%/.test(txt) && /\$47K anuales recuperables/.test(txt) && /\$214K/.test(txt) && /La conversación que vale/.test(txt) },
  { name: "boleta carga reading{} de cliente (focusType client)", pass: !!rd && rd.focusType === "client" && rd.focus === "Lider" },
  // 2) números del panel == números del texto (cero divergencia · regla madre)
  { name: "carga 4.2% (== texto)", pass: !!rd && rd.carga === 4.2 },
  { name: "vsPromedio +0.26pp (== texto)", pass: !!rd && rd.vsPromedio === 0.26 },
  { name: "targetCarga 3.9% (== texto)", pass: !!rd && rd.targetCarga === 3.9 },
  { name: "recuperable $47K al promedio (== texto)", pass: !!rd && rd.recoverableK === 47 },
  { name: "recuperable $214K a mejor práctica (== texto)", pass: !!rd && rd.recoverableBPK === 214 },
  { name: "margen 21.5% (== texto)", pass: !!rd && rd.pct === 21.5 },
  { name: "drivers de la lectura completos (4)", pass: !!rd && Array.isArray(rd.drivers) && rd.drivers.length === 4 },
  { name: "reframe ejecutivo (carga comercial)", pass: !!rd && /carga comercial/.test(rd.reframe) },
  // 3) control: el mejor cliente NO recibe reading de peor-margen
  { name: "control · 'el mejor cliente' sin reading de cliente", pass: !(rmejor.evidence && rmejor.evidence.reading && rmejor.evidence.reading.focusType === "client") },
];
fs.writeFileSync(path.join(root, process.argv[2] || "_s2c_client_dump.json"), JSON.stringify({ text: txt, reading: rd }, null, 2));
console.log("█".repeat(62)); console.log("Sentrix S2c · lectura del CLIENTE (carga comercial · texto intacto)"); console.log("█".repeat(62));
for (const c of CASES) console.log(`${c.pass ? "✅" : "🚨 FALLA"} ${c.name}`);
const fails = CASES.filter(c => !c.pass);
console.log("═".repeat(62)); console.log(`GATES: ${CASES.length - fails.length}/${CASES.length}` + (fails.length ? " · 🚨" : " · TODOS VERDES")); console.log("═".repeat(62));
process.exit(fails.length ? 1 : 0);
