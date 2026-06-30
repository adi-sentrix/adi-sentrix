// === PRUEBA CONTUNDENTE A · runner · corre el corpus hostil por answerADI y captura cada respuesta ===
// El veredicto de fabricación lo da un verificador (semántico) después. Acá: ejecutar + clasificación estructural.
import { JSDOM } from "jsdom"; import esbuild from "esbuild"; import { fileURLToPath, pathToFileURL } from "url"; import path from "path"; import fs from "fs";
const dom = new JSDOM(`<!doctype html><html><body><div id="root"></div></body></html>`, { url: "http://localhost/", pretendToBeVisual: true });
const W = dom.window; globalThis.window = W; globalThis.document = W.document;
try { Object.defineProperty(globalThis, "navigator", { value: W.navigator, configurable: true }); } catch {}
globalThis.HTMLElement = W.HTMLElement; globalThis.Node = W.Node; globalThis.getComputedStyle = W.getComputedStyle.bind(W);
globalThis.localStorage = W.localStorage; globalThis.IS_REACT_ACT_ENVIRONMENT = false; console.error = () => {};
const root = path.dirname(fileURLToPath(import.meta.url)); const bp = path.join(root, "_oracle_bundle.mjs");
await esbuild.build({ entryPoints: [path.join(root, "_oracle_entry.jsx")], bundle: true, outfile: bp, format: "esm", platform: "browser", jsx: "automatic", external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "react/jsx-dev-runtime"], alias: { recharts: path.join(root, "_oracle", "stub_recharts.js") }, logLevel: "silent" });
const mod = await import(pathToFileURL(bp).href);
const React = (await import("react")).default; const { renderToStaticMarkup } = await import("react-dom/server");
function txt(t) { if (t == null) return "(null)"; const d = document.createElement("div"); d.innerHTML = renderToStaticMarkup(React.createElement(mod.AdiMessageBody, { text: t })); return d.textContent; }
const corpus = JSON.parse(fs.readFileSync(path.join(root, "_adv_corpus.json"), "utf8"));
const modFor = (q) => (/bodega|inventario|stock|rotaci|\bdoh\b|parado|capital|cobertura/i.test(q) ? "inventario" : "margenes");

// marcadores de honestidad (bloqueo/guía/aclaración) — su presencia sugiere respuesta honesta, no fabricada.
const HONEST = /no tengo|no existe|no puedo|no llego|no cuento|no hay|disponible|granularidad|atómic|no inventa|¿|para esa pregunta|no está|sin dato|no se puede|no dispongo|puedo darte|puedo mostrarte|en qué|cuál de/i;

const out = [];
for (const q of corpus) {
  const r = mod.answerADI(q, { activeModule: modFor(q) }, { scenario: "bonanza" });
  const T = txt(r.text);
  const hasReading = !!(r.evidence && r.evidence.reading);
  const honestMarker = HONEST.test(T);
  out.push({ q, route: r.route, text: T, hasReading, readingKind: hasReading ? r.evidence.reading.kind : null, honestMarker });
}
fs.writeFileSync(path.join(root, "_A_responses.json"), JSON.stringify(out, null, 2));

// clasificación estructural de primer paso (el juicio fino lo da el verificador):
//   SOSPECHA = produjo una lectura ejecutiva (reading) O no tiene ningún marcador de honestidad.
const suspects = out.filter((x) => x.hasReading || !x.honestMarker);
console.log("█".repeat(66)); console.log(`PRUEBA A · runner · ${out.length} preguntas hostiles ejecutadas`); console.log("█".repeat(66));
console.log(`con marcador de honestidad: ${out.filter(x => x.honestMarker).length}/${out.length}`);
console.log(`con lectura ejecutiva (reading): ${out.filter(x => x.hasReading).length}/${out.length}`);
console.log(`SOSPECHAS a verificar (reading o sin marcador honesto): ${suspects.length}`);
console.log("─".repeat(66));
for (const s of suspects) console.log(`  ⚠ [${s.route}${s.readingKind ? "·" + s.readingKind : ""}] ${s.q}\n      → ${s.text.replace(/\s+/g, " ").slice(0, 150)}`);
console.log("═".repeat(66)); console.log(`→ respuestas completas en _A_responses.json (para el verificador)`);
process.exit(0);
