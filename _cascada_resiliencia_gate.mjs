/* === _cascada_resiliencia_gate.mjs · LA RED DE LA CASCADA, PROBADA (owner 2026-09-03 · re-apuntada en La
 * Poda 2026-09-05) =========================================================================================
 *
 * ChatADI promete: agente → catch → oráculo, «el usuario nunca ve el error». La cascada tenía TRES peldaños
 * hasta La Poda; con el camino natural retirado del código (palabra del owner) la red quedó de DOS, y este
 * gate la prueba tal cual está escrita, con el flag REAL del perfil:
 *   caída · el agente lanza → el turno LLEGA VIVO al oráculo (canned: sus adentros los cubren sus gates;
 *           lo que ESTE prueba es que la cascada lo alcanza y que su respuesta sale) — sin error a pantalla.
 *   carnada 1 · el peldaño del AGENTE quitado (if false): la respuesta ya no es la suya — el peldaño pineado
 *               no es decorativo.
 *   carnada 2 · el peldaño del ORÁCULO ausente no se puede fingir verde: sin oráculo canned el turno igual
 *               tiene la ruta vieja del try externo — la red es más profunda que la declarada (medido el
 *               2026-09-03 y sigue siendo cierto): se documenta, no se pina.
 *
 * OFFLINE · determinístico · cero tráfico.
 * node --import ./scripts/offline-guard.mjs _cascada_resiliencia_gate.mjs */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

let pass = 0, fail = 0;
const ok = (c, m, extra = "") => { if (c) { pass++; console.log("  ✓ " + m); } else { fail++; console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };
const H = (t) => console.log("\n" + t);

const { JSDOM } = await import("jsdom");
const esbuild = (await import("esbuild")).default;
const root = path.dirname(fileURLToPath(import.meta.url));

// DOM mínimo (patrón _pnl_conversation_scope_gate): el grafo de imports de ChatADI toca globals de browser
const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
try { Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true }); } catch { /* solo-lectura en algunos Node */ }
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.Node = dom.window.Node;
globalThis.getComputedStyle = dom.window.getComputedStyle;
globalThis.localStorage = dom.window.localStorage;

/* el stub de cada caída, servido por plugin (sin archivos): el filtro agarra el import DENTRO del bundle */
const stubPlugin = (stubs) => ({
  name: "cascada-stubs",
  setup(build) {
    for (const [filtro, contents] of stubs) {
      build.onResolve({ filter: filtro }, (args) => ({ path: args.path, namespace: "cascada-stub", pluginData: contents }));
      build.onLoad({ filter: /.*/, namespace: "cascada-stub" }, (args) => ({ contents: args.pluginData, resolveDir: path.join(root, "src", "adi", "oracle"), loader: "js" }));
    }
  },
});
const AGENTE_LANZA = 'export async function answerViaAgente() { globalThis.__cascada_agente_lanzo = true; throw new Error("carnada de cascada: el agente explotó"); }';
/* (La Poda 2026-09-05: acá vivía NATURAL_LANZA — el stub del peldaño del medio, retirado con el camino) */
const ORACULO_CANNED = [
  'import { normalizeResponse } from "../responseContract.js";',
  "export async function answerViaOracle() {",
  "  globalThis.__cascada_oraculo_alcanzado = true;",
  '  return { r: normalizeResponse({ text: "Respuesta canned del oráculo: la cascada llegó viva hasta acá.", route: "oracle", deterministic: true, claims: [], suggestions: null }), mem: {} };',
  "}",
].join("\n");

const bundlear = async (nombre, { entradaUI = "./src/ui/ChatADI.jsx", stubs }) => {
  const entry = path.join(root, `_cascada_entry_${nombre}.js`), out = path.join(root, `_cascada_bundle_${nombre}.mjs`);
  fs.writeFileSync(entry, [
    `export { buildAdiTurnLLM } from "${entradaUI}";`,
    'export { ADI_AGENTE } from "./src/config/voiceFlags.js";',
    // el store del BUNDLE — hay que declarárselo A ÉL (la lección de las dos declaraciones)
    'export { initTenant } from "./src/data/tenantStore.js";',
    'export { TENANT_DEMO } from "./src/data/tenants/demo.js";',
  ].join("\n"));
  try {
    await esbuild.build({
      entryPoints: [entry], bundle: true, outfile: out, format: "esm", platform: "node", jsx: "automatic",
      external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "react/jsx-dev-runtime"],
      /* EL PERFIL DE PRODUCCIÓN, horneado como lo hornea Vite (`__ADI_PROFILE__`): bajo Node el global no
       * existe y flagProfile cae al piso (todo OFF, deliberado para los gates byte-exactos) — pero ESTE gate
       * prueba la cascada DEL PRODUCTO, así que se le da al bundle el mismo perfil que al sitio publicado.
       * Con "prod", ADI_AGENTE llega por la lista FEATURE (el ascenso del owner, 2026-09-02) — que es
       * exactamente el flag que este gate debe probar. */
      define: { __ADI_PROFILE__: '"prod"' },
      plugins: [stubPlugin(stubs)], logLevel: "silent",
    });
    const M = await import(pathToFileURL(out).href + "?t=" + Math.random());
    return M;
  } finally {
    try { fs.unlinkSync(entry); } catch { /* */ } try { fs.unlinkSync(out); } catch { /* */ }
  }
};

/* ═══ 1 · LA CAÍDA · el agente lanza → el turno llega vivo al oráculo, sin error a pantalla ═════════════════ */
H("1 · el agente lanza → el oráculo responde en el MISMO turno (la red de dos peldaños, con el flag real)");
{
  const M = await bundlear("caida1", { stubs: [
    [/bucleAgente\.js$/, AGENTE_LANZA],
    [/answerViaOracle\.js$/, ORACULO_CANNED],
  ] });
  ok(M.ADI_AGENTE === true, `★ el flag REAL del perfil: ADI_AGENTE=${M.ADI_AGENTE} (FEATURE — el camino principal)`);
  /* (La Poda: ADI_CAMINO_NATURAL ya ni se puede importar — esbuild falla el build si alguien lo pide; el
   * candado de la no-resurrección del flag vive en _poda_natural_anti_resurreccion_gate.) */
  M.initTenant(M.TENANT_DEMO);
  globalThis.__cascada_agente_lanzo = false;
  globalThis.__cascada_oraculo_alcanzado = false;
  const turn = await M.buildAdiTurnLLM("cuanto me compro falabella el ultimo mes", {}, "bonanza", [], () => {});
  ok(globalThis.__cascada_agente_lanzo === true, "el agente efectivamente LANZÓ (el stub se ejecutó — la caída es real, no un atajo)");
  ok(globalThis.__cascada_oraculo_alcanzado === true, "★ y el turno LLEGÓ VIVO al oráculo — la red entera, que hoy es un solo salto");
  const texto = String((turn && turn.adiMsg && turn.adiMsg.text) || "");
  ok(!!turn && !!texto, "★ el turno SALIÓ — el usuario recibió respuesta en el mismo turno", JSON.stringify(turn || null).slice(0, 120));
  ok(/canned del oráculo|la cascada llegó viva/.test(texto),
    "★ …y es la del ORÁCULO (canned a propósito: sus adentros los cubren sus gates; acá se prueba la cascada)", texto.slice(0, 110));
  ok(!/error|explot|excepci[oó]n|stack/i.test(texto), "★ y el usuario NUNCA ve el error — ni una palabra de la explosión en pantalla");
}

/* ═══ 2 · CARNADA · el peldaño del agente quitado — la conducta pineada muere ═══════════════════════════════
 * (La nota medida del 2026-09-03 sigue vigente: un re-throw en el catch NO rompe la promesa porque el try
 * EXTERNO del turno también ataja — la red es más profunda de lo declarado. La carnada real: quitar el
 * peldaño entero y comprobar que la respuesta ya no es la suya.) */
H("2 · carnada: el peldaño del agente quitado — el turno ya no pasa por el agente");
{
  const original = fs.readFileSync(path.join(root, "src", "ui", "ChatADI.jsx"), "utf8").replace(/\r\n/g, "\n");
  const OBJETIVO = "      if (ADI_AGENTE) {";
  const mutado = original.replace(OBJETIVO, "      if (false) {   // CARNADA: el peldaño del agente, quitado");
  if (mutado === original) ok(false, "carnada «peldaño del agente quitado»", "no encontró qué mutar en ChatADI.jsx");
  else {
    const copia = path.join(root, "src", "ui", `ChatADI.carnada${process.pid}.jsx`);
    fs.writeFileSync(copia, mutado);
    try {
      const M = await bundlear("carnada", { entradaUI: `./src/ui/ChatADI.carnada${process.pid}.jsx`,
        stubs: [[/bucleAgente\.js$/, AGENTE_LANZA], [/answerViaOracle\.js$/, ORACULO_CANNED]] });
      M.initTenant(M.TENANT_DEMO);
      globalThis.__cascada_agente_lanzo = false;
      const turn = await M.buildAdiTurnLLM("cuanto me compro falabella el ultimo mes", {}, "bonanza", [], () => {});
      const texto = String((turn && turn.adiMsg && turn.adiMsg.text) || "");
      ok(globalThis.__cascada_agente_lanzo === false && /canned del oráculo/.test(texto),
        "carnada «peldaño del agente quitado» → el agente ni se ejecutó y el turno salió por el oráculo (el check ★ de §1 daría ✗): el peldaño pineado no es decorativo",
        texto.slice(0, 110));
    } finally {
      try { fs.unlinkSync(copia); } catch { /* */ }
    }
  }
}

console.log(`\n── _cascada_resiliencia_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
