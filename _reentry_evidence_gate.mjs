/* === _reentry_evidence_gate.mjs · verificación del fix de reentrada + botón evidencia en ChatADI.jsx ===
 * Turno de trabajo: "reentrada de ChatADI.jsx (dale, cuéntame más inconsistente)".
 *
 * PARTE A · isSim fuera del gate de EvidenceButton (bug confirmado, no hipotético): extrae la función _evLabel
 *   TAL COMO quedó en el archivo (no una reproducción a mano) y la corre sobre evidencia REAL producida por el
 *   motor (simulación → "por qué?" → evidence {followup:true, kind:"explain", transform, boleta} SIN lens/reading,
 *   el shape exacto que arma conversation.js:265) — antes del fix esto devolvía null (sin botón "Ver la proyección
 *   en Sentrix"), ahora debe devolver el label.
 *
 * PARTE B · guardia de reentrada: renderiza <ChatADI/> con ADI_LLM_ENABLED forzado ON (global __ADI_LLM_ENABLED__ —
 *   así lee el flag voiceFlags.js), mockea fetch, sostiene la 1ª llamada a /api/adi-spec pendiente (con `location`
 *   no seteado como global en Node, _oracleOn() cae a ADI_ORACLE_ENABLED=false → la ruta que dispara ES la
 *   PRECEDENCIA LLM#1, /api/adi-spec — verificado corriendo el mock sin resolver nunca y mirando qué URL llega),
 *   dispara un 2º submit MIENTRAS el 1º sigue en vuelo y confirma que NO dispara red ni agrega una 2ª burbuja de
 *   usuario — y que, liberado el 1º, la guardia se suelta sola (un 3er submit sí progresa).
 */
import { JSDOM } from "jsdom";
import esbuild from "esbuild";
import { fileURLToPath, pathToFileURL } from "url";
import path from "path";
import fs from "fs";

let pass = 0, fail = 0;
const ok = (cond, label) => { if (cond) { pass++; console.log(`  ✓ ${label}`); } else { fail++; console.log(`  ✗ FALLO: ${label}`); } };

// ── 0 · DOM global ANTES de testing-library (mismo patrón que _verify_ui_parity.mjs) ──
const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
try { Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true }); } catch {}
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.Node = dom.window.Node;
globalThis.getComputedStyle = dom.window.getComputedStyle;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.localStorage = dom.window.localStorage;

// ADI_LLM_ENABLED se lee de este global (voiceFlags.js: typeof __ADI_LLM_ENABLED__ !== "undefined" ? ... : false).
// Forzado ON para poder ejercer el camino async donde vive la guardia de reentrada (Node/gate = OFF por defecto).
globalThis.__ADI_LLM_ENABLED__ = true;

const root = path.dirname(fileURLToPath(import.meta.url));
const bundlePath = path.join(root, `_reentry_evidence_gate_bundle.tmp${process.pid}.mjs`);
await esbuild.build({
  entryPoints: [path.join(root, "_reentry_evidence_gate_entry.jsx")],
  bundle: true, outfile: bundlePath, format: "esm", platform: "node", jsx: "automatic",
  external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "react/jsx-dev-runtime"],
  logLevel: "silent",
});
const ui = await import(pathToFileURL(bundlePath).href);
const React = (await import("react")).default;
const { render, fireEvent, act, cleanup } = await import("@testing-library/react");

console.log("═".repeat(82));
console.log("PARTE A · botón de evidencia sobrevive a un follow-up de simulación (isSim en el gate)");
console.log("═".repeat(82));

// 1 · evidencia REAL: turno 1 = simulación (piso, sin LLM) · turno 2 = "por qué?" vía answerConversational
//     (el mismo composer que usa el camino LLM/oráculo cuando cae al fallback conversacional) — exactamente el
//     shape { followup:true, kind:"explain", transform, boleta, metrica, dimLabel } que conversation.js:265 emite.
const t1 = ui.buildAdiTurn("¿Qué pasa si las ventas suben un 3%?", {}, "bonanza");
ok(!!(t1.adiMsg.evidence && t1.adiMsg.evidence.transform), "turno 1 (simulación) trae evidence.transform");
const spec2 = { schemaVersion: 1, turn_type: "followup_explain" };
const r2 = ui.answerConversational(spec2, t1.context, { scenario: "bonanza" });
const ev2 = r2.evidence;
ok(!!(ev2 && ev2.transform) && !ev2.lens && !ev2.reading,
  "evidencia del follow-up: transform SÍ, lens/reading NO (el caso exacto que el gate viejo mataba)");

// 2 · extrae _evLabel TAL COMO ESTÁ en el archivo fuente (no una reproducción a mano — si alguien la edita más
//    adelante sin querer romper esto, este gate lo sigue viendo con el código real, no con una copia congelada).
const srcPath = path.join(root, "src", "ui", "ChatADI.jsx");
const src = fs.readFileSync(srcPath, "utf8");
const startMarker = "function _evLabel(evidence) {";
const startIdx = src.indexOf(startMarker);
if (startIdx < 0) {
  console.log("  ✗ FALLO: no encontré _evLabel en ChatADI.jsx (¿se renombró?)");
  fail++;
} else {
  let depth = 0, i = startIdx, endIdx = -1;
  for (; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") { depth--; if (depth === 0) { endIdx = i + 1; break; } }
  }
  const fnSrc = src.slice(startIdx, endIdx);
  const _evLabel = new Function(`"use strict"; ${fnSrc}; return _evLabel;`)();

  const got = _evLabel(ev2);
  ok(got === "Ver la proyección en Sentrix", `_evLabel(follow-up de simulación) === "Ver la proyección en Sentrix" (obtuvo: ${JSON.stringify(got)})`);
  // no-regresión: una evidencia SIN ninguna señal sigue sin botón — el gate no quedó abierto de más.
  ok(_evLabel({ followup: true, kind: "meta", boleta: [] }) === null, "evidencia sin ninguna señal sigue devolviendo null (gate no quedó abierto de más)");
  ok(_evLabel(null) === null && _evLabel(undefined) === null, "_evLabel(null/undefined) === null");
}

console.log("\n" + "═".repeat(82));
console.log("PARTE B · guardia de reentrada bloquea un 2º submit mientras el 1º sigue en vuelo");
console.log("═".repeat(82));

const calls = [];
let pendingSpec1Resolve = null;
const pendingSpec1 = new Promise((res) => { pendingSpec1Resolve = res; });
let spec1CallSeen = false;

globalThis.fetch = async (url, opts) => {
  calls.push(String(url));
  if (String(url).includes("/api/adi-spec") && !spec1CallSeen) {
    spec1CallSeen = true;
    return pendingSpec1;   // sostenido a propósito · abre la ventana de reentrada
  }
  // cualquier otra llamada (adi-narrate del turno liberado, o el turno 3) responde YA con ok:false → el pipeline
  // degrada honesto y el turno se completa igual (lo que importa acá es la guardia, no que la narración salga "bonita").
  return { json: async () => ({ ok: false, error: "mock" }) };
};

async function waitFor(fn, { timeout = 4000, interval = 20 } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (fn()) return true;
    await new Promise((r) => setTimeout(r, interval));
  }
  return false;
}

let container;
await act(async () => {
  ({ container } = render(React.createElement(ui.ChatADI, { scenario: "bonanza", animate: false })));
});
const textarea = container.querySelector("textarea");
ok(!!textarea, "encontré el textarea de entrada");

// solo las burbujas de MENSAJE (transcript) — excluye el wrapper del input, que también es un <div> y cuyo
// textContent arrastra el valor VIVO del textarea (jsdom refleja el .value en el árbol) + el hint del pie:
// sin este filtro, tipear "pregunta dos" en el input (sin enviarla) YA hace match con un div, dando un falso
// positivo de "se agregó una 2ª burbuja" aunque submit() nunca haya corrido.
const bubbleTexts = () => [...container.querySelectorAll("div")]
  .filter((d) => !d.querySelector("textarea") && !d.querySelector("button") && !d.querySelector("kbd"))
  .map((d) => d.textContent);
function typeAndEnter(text) {
  fireEvent.change(textarea, { target: { value: text } });
  fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false });
}

await act(async () => { typeAndEnter("pregunta uno"); });
ok(calls.length === 1 && calls[0].includes("/api/adi-spec"), `turno 1 disparó exactamente 1 fetch a /api/adi-spec (calls=${calls.length}: ${calls.join(", ")})`);
ok(bubbleTexts().includes("pregunta uno"), "la burbuja de usuario del turno 1 está en el DOM");

// ── REENTRADA: turno 1 sigue en vuelo (pendingSpec1 sin resolver) — dispara turno 2 YA ──
await act(async () => { typeAndEnter("pregunta dos"); });
ok(calls.length === 1, `la guardia bloqueó el turno 2 · CERO fetch nueva mientras el turno 1 seguía en vuelo (calls=${calls.length})`);
ok(!bubbleTexts().includes("pregunta dos"), "la guardia bloqueó el turno 2 · NO se agregó una 2ª burbuja de usuario mientras el turno 1 seguía en vuelo");
ok(textarea.value === "pregunta dos", "el texto del intento bloqueado sigue en el input (submit() no llegó a limpiarlo)");

// ── libera el turno 1 (ok:false → degrada honesto, se completa por el fallback local) → la guardia debe soltarse ──
await act(async () => { pendingSpec1Resolve({ json: async () => ({ ok: false, error: "mock-released" }) }); });
await act(async () => { await waitFor(() => bubbleTexts().some((t) => t !== "Pensando…" && t.length > 0 && t !== "pregunta uno" && !t.includes("pregunta uno")), { timeout: 4000 }); });

// turno 3: la MISMA pregunta que quedó bloqueada en el input sigue ahí — reenviarla debe progresar de verdad ahora.
await act(async () => { typeAndEnter("pregunta dos"); });
await act(async () => { await waitFor(() => bubbleTexts().includes("pregunta dos"), { timeout: 4000 }); });
ok(bubbleTexts().includes("pregunta dos"), "liberado el turno 1, la guardia se soltó: el turno 3 (\"pregunta dos\") SÍ progresó y su burbuja de usuario apareció en el DOM");

cleanup();
console.log(`\n── _reentry_evidence_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail === 0 ? 0 : 1);
