// TRAZA INSTRUMENTADA del ETLG vivo · margen vs ventas vs inventario.
// Instrumenta una COPIA del monolito (la referencia _REFERENCIA_PISO queda intacta).
// Log en el punto de aplicación del ETLG: opener-antes, intentMeta, shouldApply, reason, thesis.
import { JSDOM } from "jsdom";
import esbuild from "esbuild";
import { fileURLToPath, pathToFileURL } from "url";
import path from "path";
import fs from "fs";

const root = path.dirname(fileURLToPath(import.meta.url));

// 1 · copia instrumentada
let src = fs.readFileSync(path.join(root, "_REFERENCIA_PISO_41cc33d8.jsx"), "utf8");
const ANCHOR = "const etlg_result = executiveThesisLineGenerator(etlg_rawPayload, etlg_intentMeta, scenario);";
const INSTR = ANCHOR + "\ntry{if(globalThis.__TR)globalThis.__TR.push({pt:'etlg',q:trimmed,openerBefore:(responseOpener||'').slice(0,55),modulo:etlg_intentMeta.modulo,type:etlg_intentMeta.intent_type,tier:etlg_intentMeta.tier,intent_id:etlg_intentMeta.intent_id,apply:etlg_result&&etlg_result.shouldApply,reason:etlg_result&&etlg_result.reason,thesis:(etlg_result&&etlg_result.thesisLine)?etlg_result.thesisLine.slice(0,55):null});}catch(e){}";
const count = src.split(ANCHOR).length - 1;
src = src.split(ANCHOR).join(INSTR);
console.log("ETLG anchors instrumentados:", count);
// marcador de entrada al unified pipeline para saber si la query llega
src = src.replace("if (VOICE_UNIFIED_ROUTING_ENABLED) {", "if (VOICE_UNIFIED_ROUTING_ENABLED) {\ntry{if(globalThis.__TR)globalThis.__TR.push({pt:'unified-enter',q:trimmed});}catch(e){}");
// marcador FASE 5 (entrada al guard del ETLG) · tier + guards
const ANCHOR2 = "const etlg_tier = detectRceTier(derivedIntentType, intent?.type, lastComposerResponse);";
const INSTR2 = ANCHOR2 + "\ntry{if(globalThis.__TR)globalThis.__TR.push({pt:'fase5-tier',q:trimmed,tier:etlg_tier,honest:typeof isHonestFallback!=='undefined'?isHonestFallback:'undef',narrative:typeof narrativeLayerHandled!=='undefined'?narrativeLayerHandled:'undef',type:intent?.type,derived:derivedIntentType});}catch(e){}";
console.log("FASE5 anchors instrumentados:", src.split(ANCHOR2).length - 1);
src = src.split(ANCHOR2).join(INSTR2);
const instrPath = path.join(root, "_oracle", "_mono_trace.jsx");
fs.writeFileSync(instrPath, src);

// 2 · jsdom + bundle
const dom = new JSDOM(`<!doctype html><html><body><div id="root"></div></body></html>`, { url: "http://localhost/", pretendToBeVisual: true });
const W = dom.window;
globalThis.window = W; globalThis.document = W.document;
try { Object.defineProperty(globalThis, "navigator", { value: W.navigator, configurable: true }); } catch {}
globalThis.HTMLElement = W.HTMLElement; globalThis.Node = W.Node;
globalThis.getComputedStyle = W.getComputedStyle.bind(W);
globalThis.requestAnimationFrame = W.requestAnimationFrame.bind(W);
globalThis.cancelAnimationFrame = W.cancelAnimationFrame.bind(W);
globalThis.localStorage = W.localStorage; globalThis.IS_REACT_ACT_ENVIRONMENT = false; console.error = () => {};

const entryPath = path.join(root, "_oracle", "_trace_entry.jsx");
fs.writeFileSync(entryPath, `export { default as ADISentric } from "./_mono_trace.jsx";\n`);
const bundlePath = path.join(root, "_oracle", "_mono_trace_bundle.mjs");
await esbuild.build({ entryPoints: [entryPath], bundle: true, outfile: bundlePath, format: "esm", platform: "browser", jsx: "automatic", external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "react/jsx-dev-runtime"], alias: { recharts: path.join(root, "_oracle", "stub_recharts.js") }, logLevel: "silent" });
const mod = await import(pathToFileURL(bundlePath).href);
const React = (await import("react")).default;
const { createRoot } = await import("react-dom/client");

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const ML = { ventas: "Ventas", margenes: "Márgenes", inventario: "Inventario" };
async function trace(query, moduleKey) {
  W.localStorage.clear();
  const container = document.getElementById("root");
  const r = createRoot(container); r.render(React.createElement(mod.ADISentric)); await sleep(160);
  [...document.querySelectorAll("button")].find(b => new RegExp(ML[moduleKey]).test(b.textContent || ""))?.dispatchEvent(new W.MouseEvent("click", { bubbles: true }));
  await sleep(900);
  globalThis.__TR = [];
  const input = document.querySelector('input[placeholder="Pregunta a ADI..."]');
  const setter = Object.getOwnPropertyDescriptor(W.HTMLInputElement.prototype, "value").set;
  setter.call(input, query); input.dispatchEvent(new W.Event("input", { bubbles: true })); input.dispatchEvent(new W.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  await sleep(4000);
  const tr = globalThis.__TR.slice();
  r.unmount(); container.innerHTML = "";
  console.log(`\n══════ «${query}» (módulo ${moduleKey}) ══════`);
  if (tr.length === 0) console.log("  (sin eventos · la query no llegó al unified pipeline ni al ETLG)");
  for (const e of tr) console.log("  " + JSON.stringify(e));
}

await trace("cómo está el margen", "margenes");
await trace("cómo están las ventas", "ventas");
await trace("cómo está el inventario", "inventario");
process.exit(0);
