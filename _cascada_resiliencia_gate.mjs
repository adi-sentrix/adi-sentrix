/* === _cascada_resiliencia_gate.mjs · LA RED DE LA CASCADA, PROBADA (owner 2026-09-03) =======================
 *
 * ChatADI promete: agente → catch → natural → catch → oráculo, «el usuario nunca ve el error». Desde que el
 * agente ascendió a FEATURE esa promesa es EL ROLLBACK AUTOMÁTICO del camino principal de producción — y
 * estaba declarada en un comentario, no probada por ningún gate. Esto la prueba, con el flag REAL del perfil
 * (el de FEATURE, no un stub): si mañana alguien lo apaga o rompe la cascada, esto arde antes que un usuario.
 *
 * CÓMO: `buildAdiTurnLLM` se bundlea con esbuild (ChatADI es JSX — el patrón de _pnl_conversation_scope_gate,
 * con la declaración de tenant AL BUNDLE porque su store es OTRO), y las caídas se fabrican con un plugin que
 * reemplaza el módulo del agente (y en el caso doble, el del natural) por un stub que LANZA — la cascada real
 * de ChatADI corre tal cual está escrita:
 *   caída 1 · el agente lanza  → el turno sale del CAMINO NATURAL (el puente responde determinístico, cero
 *             fetch: la pregunta insignia se resuelve sin cerebro) — sin error a pantalla.
 *   caída 2 · el agente lanza Y el natural lanza → el turno LLEGA VIVO al oráculo. El oráculo va stubbeado a
 *             una respuesta canned (sus adentros ya los cubren sus propios gates; lo que ESTE prueba es que la
 *             cascada lo alcanza y que su respuesta sale a pantalla) — el límite se declara, no se disimula.
 *   carnada · una copia de ChatADI con el catch del agente vuelto re-throw: el turno EXPLOTA → el check ★
 *             de la caída 1 daría ✗. La red desconectada arde.
 *
 * OFFLINE · determinístico · cero tráfico: los stubs lanzan o devuelven canned y el natural responde por el
 * puente. `node --import ./scripts/offline-guard.mjs _cascada_resiliencia_gate.mjs` */
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
const NATURAL_LANZA = 'export async function answerViaNatural() { globalThis.__cascada_natural_lanzo = true; throw new Error("carnada de cascada: el natural explotó"); }';
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
    'export { ADI_AGENTE, ADI_CAMINO_NATURAL } from "./src/config/voiceFlags.js";',
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

/* ═══ 1 · CAÍDA 1 · el agente lanza → el turno sale del natural, sin error a pantalla ═══════════════════════ */
H("1 · el agente lanza → el natural responde en el MISMO turno (la promesa, con el flag real)");
{
  const M = await bundlear("caida1", { stubs: [[/bucleAgente\.js$/, AGENTE_LANZA]] });
  ok(M.ADI_AGENTE === true && M.ADI_CAMINO_NATURAL === true,
    `★ los flags REALES del perfil: ADI_AGENTE=${M.ADI_AGENTE} (FEATURE — el ascenso del owner) · ADI_CAMINO_NATURAL=${M.ADI_CAMINO_NATURAL}`);
  M.initTenant(M.TENANT_DEMO);
  globalThis.__cascada_agente_lanzo = false;
  const turn = await M.buildAdiTurnLLM("cuanto me compro falabella el ultimo mes", {}, "bonanza", [], () => {});
  ok(globalThis.__cascada_agente_lanzo === true, "el agente efectivamente LANZÓ (el stub se ejecutó — la caída es real, no un atajo)");
  const texto = String((turn && turn.adiMsg && turn.adiMsg.text) || "");
  ok(!!turn && !!texto, "★ el turno SALIÓ — el usuario recibió respuesta en el mismo turno", JSON.stringify(turn || null).slice(0, 120));
  ok(/Falabella/.test(texto) && /no reconcilia|de muestra/.test(texto),
    "★ …y es la del CAMINO NATURAL (el puente declina honesto, determinístico): el rollback automático funciona", texto.slice(0, 110));
  ok(!/error|explot|excepci[oó]n|stack/i.test(texto), "★ y el usuario NUNCA ve el error — ni una palabra de la explosión en pantalla");
}

/* ═══ 2 · CAÍDA DOBLE · agente Y natural lanzan → el turno llega vivo al oráculo ════════════════════════════ */
H("2 · la red entera: agente lanza Y natural lanza → el oráculo responde");
{
  const M = await bundlear("caida2", { stubs: [
    [/bucleAgente\.js$/, AGENTE_LANZA],
    [/caminoNatural\.js$/, NATURAL_LANZA],
    [/answerViaOracle\.js$/, ORACULO_CANNED],
  ] });
  M.initTenant(M.TENANT_DEMO);
  globalThis.__cascada_agente_lanzo = false;
  globalThis.__cascada_natural_lanzo = false;
  globalThis.__cascada_oraculo_alcanzado = false;
  const turn = await M.buildAdiTurnLLM("cuanto me compro falabella el ultimo mes", {}, "bonanza", [], () => {});
  ok(globalThis.__cascada_agente_lanzo && globalThis.__cascada_natural_lanzo,
    "las DOS caídas ocurrieron de verdad (ambos stubs lanzaron)");
  ok(globalThis.__cascada_oraculo_alcanzado === true,
    "★ y el turno LLEGÓ VIVO al oráculo — la red entera, peldaño por peldaño");
  const texto = String((turn && turn.adiMsg && turn.adiMsg.text) || "");
  ok(/canned del oráculo|la cascada llegó viva/.test(texto),
    "★ …y SU respuesta salió a pantalla (el oráculo va canned a propósito: sus adentros los cubren sus gates; acá se prueba la cascada)", texto.slice(0, 110));
  ok(!/error|explot|excepci[oó]n/i.test(texto), "★ y tampoco acá el usuario ve error alguno");
}

/* ═══ 3 · CARNADA · el peldaño del natural quitado — la conducta pineada muere ══════════════════════════════
 * (El primer intento de carnada fue un re-throw en el catch del agente, y NO rompió la promesa: el try
 * EXTERNO del turno también ataja y el flujo cae a la ruta vieja — la red es más profunda de lo declarado,
 * y eso es una BUENA noticia medida, anotada acá. La carnada real: quitar el peldaño del natural entero.) */
H("3 · carnada: el peldaño del natural quitado — el turno ya no sale del natural");
{
  const original = fs.readFileSync(path.join(root, "src", "ui", "ChatADI.jsx"), "utf8").replace(/\r\n/g, "\n");
  const OBJETIVO = "      if (ADI_CAMINO_NATURAL) {";
  const mutado = original.replace(OBJETIVO, "      if (false) {   // CARNADA: el peldaño del natural, quitado");
  if (mutado === original) ok(false, "carnada «peldaño del natural quitado»", "no encontró qué mutar en ChatADI.jsx");
  else {
    const copia = path.join(root, "src", "ui", `ChatADI.carnada${process.pid}.jsx`);
    fs.writeFileSync(copia, mutado);
    try {
      const M = await bundlear("carnada", { entradaUI: `./src/ui/ChatADI.carnada${process.pid}.jsx`,
        stubs: [[/bucleAgente\.js$/, AGENTE_LANZA], [/answerViaOracle\.js$/, ORACULO_CANNED]] });
      M.initTenant(M.TENANT_DEMO);
      const turn = await M.buildAdiTurnLLM("cuanto me compro falabella el ultimo mes", {}, "bonanza", [], () => {});
      const texto = String((turn && turn.adiMsg && turn.adiMsg.text) || "");
      ok(!/no reconcilia|de muestra/.test(texto) && /canned del oráculo/.test(texto),
        "carnada «peldaño del natural quitado» → la respuesta YA NO es la del natural (el check ★ de §1 daría ✗): la cascada pineada no es decorativa",
        texto.slice(0, 110));
    } finally {
      try { fs.unlinkSync(copia); } catch { /* */ }
    }
  }
}

console.log(`\n── _cascada_resiliencia_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
