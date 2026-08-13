/* === _probe_anthropic_defaults.mjs · preparación Anthropic · A3 (2026-08-13) =============================
 * PROBE 100% OFFLINE: ejerce DE VERDAD los dos módulos puros (modelDefaults.js + providerConfig.js) y lee el
 * gateway SOLO como texto — jamás lo importa (todo import del gateway arrastra medio mundo y la trampa
 * documentada en la memoria del proyecto: la decisión se saca a un módulo puro para poder ejercerla offline).
 * Correr con el candado:  node --import ./scripts/offline-guard.mjs _probe_anthropic_defaults.mjs
 *
 * Qué demuestra (A3):
 *   · anthropic sin vars de modelo → claude-haiku-4-5 (parse) y claude-sonnet-5 (narrar) — nunca gpt-4o-mini;
 *   · openai sin vars → gpt-4o-mini como siempre, herencia narrar←parse intacta;
 *   · sin LLM_PROVIDER → el gateway SIGUE fallando nombrando la variable (el freno de d4ab496 no se debilitó);
 *   · lo declarado siempre gana al default, y una var de openai no viaja a la API de anthropic.
 */
import { readFileSync } from "node:fs";

const D = await import(new URL("./src/adi/llm/modelDefaults.js", import.meta.url).href);
const P = await import(new URL("./src/adi/llm/providerConfig.js", import.meta.url).href);
const { resolverModelos, MODELO_PARSE_DEFAULT, MODELO_NARRATE_DEFAULT } = D;
const { resolverProveedor, mensajeFaltaProveedor } = P;

let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ " + m + (extra ? " — " + extra : "")); } };
const J = JSON.stringify;

console.log("── A3.a · anthropic sin vars de modelo → el par del owner, nunca un modelo de otro proveedor ──");
{
  const r = resolverModelos({}, "anthropic");
  ok(r.model === "claude-haiku-4-5" && r.narrateModel === "claude-sonnet-5",
    `anthropic + env vacío → parse=claude-haiku-4-5 · narrar=claude-sonnet-5`, J(r));
  ok(!/gpt/.test(J(r)), "ningún modelo de openai en la resolución");
  ok(MODELO_PARSE_DEFAULT.anthropic === "claude-haiku-4-5" && MODELO_NARRATE_DEFAULT.anthropic === "claude-sonnet-5",
    "los defaults declarados en el módulo son exactamente los DOS modelos decididos");
  ok(!J(MODELO_PARSE_DEFAULT).includes("opus") && !J(MODELO_NARRATE_DEFAULT).includes("opus"),
    "claude-opus-5 NO es default de nada (está tarifado, no cableado)");
  const conResto = resolverModelos({ OPENAI_MODEL: "gpt-4o-mini" }, "anthropic");
  ok(conResto.model === "claude-haiku-4-5" && conResto.narrateModel === "claude-sonnet-5",
    "un OPENAI_MODEL sobrante del deploy anterior NO viaja a la API de anthropic — la trampa exacta que se cierra", J(conResto));
}

console.log("\n── A3.b · lo DECLARADO gana al default (el switch del deploy manda) ──");
{
  const r = resolverModelos({ LLM_MODEL_PARSE: "claude-haiku-4-5", LLM_MODEL_NARRATE: "claude-sonnet-5" }, "anthropic");
  ok(r.model === "claude-haiku-4-5" && r.narrateModel === "claude-sonnet-5", "las dos vars explícitas se usan tal cual");
  const opus = resolverModelos({ LLM_MODEL_NARRATE: "claude-opus-5" }, "anthropic");
  ok(opus.narrateModel === "claude-opus-5" && opus.model === "claude-haiku-4-5",
    "el escalón futuro (opus) se puede DECLARAR por env sin tocar código — pero nadie lo elige solo");
  const propio = resolverModelos({ ANTHROPIC_MODEL: "claude-sonnet-5" }, "anthropic");
  ok(propio.model === "claude-sonnet-5" && propio.narrateModel === "claude-sonnet-5",
    "ANTHROPIC_MODEL (el modelo del proveedor, declarado) cubre las dos pasadas — como siempre hizo");
  const soloParse = resolverModelos({ LLM_MODEL_PARSE: "claude-haiku-4-5" }, "anthropic");
  ok(soloParse.narrateModel === "claude-sonnet-5",
    "declarar SOLO parse no arrastra a Haiku a narrar: narrar conserva su default sonnet (decisión de dos modelos)");
  ok(resolverModelos({ LLM_MODEL_PARSE: "   " }, "anthropic").model === "claude-haiku-4-5",
    "una var seteada en blanco (campo creado sin valor en el panel) cuenta como ausente — misma política que el proveedor");
}

console.log("\n── A3.c · openai sin vars → gpt-4o-mini como siempre (el mundo viejo, intacto) ──");
{
  const r = resolverModelos({}, "openai");
  ok(r.model === "gpt-4o-mini" && r.narrateModel === "gpt-4o-mini", `openai + env vacío → gpt-4o-mini en las dos pasadas`, J(r));
  const conVar = resolverModelos({ OPENAI_MODEL: "gpt-5.6-terra" }, "openai");
  ok(conVar.model === "gpt-5.6-terra" && conVar.narrateModel === "gpt-5.6-terra",
    "OPENAI_MODEL sigue mandando bajo openai, y narrar hereda de parse como siempre");
  const herencia = resolverModelos({ LLM_MODEL_PARSE: "gpt-4o-mini", LLM_MODEL_NARRATE: "gpt-5.6-terra" }, "openai");
  ok(herencia.model === "gpt-4o-mini" && herencia.narrateModel === "gpt-5.6-terra",
    "la config de producción actual (parse y narrar declarados) resuelve idéntica a hoy");
  const stub = resolverModelos({}, "gemini");
  ok(stub.model === "gpt-4o-mini", "un proveedor stub/desconocido sigue por la cadena legada de siempre (sin cambios)");
}

console.log("\n── A3.d · sin LLM_PROVIDER el gateway SIGUE fallando nombrando la variable ──");
{
  const r = resolverProveedor({});
  ok(r.proveedor === null && r.falta === "LLM_PROVIDER", "la ausencia no elige proveedor: viaja como falta", J(r));
  ok(mensajeFaltaProveedor(r.falta).includes("LLM_PROVIDER"), `y el error la NOMBRA — "${mensajeFaltaProveedor(r.falta)}"`);
  const sinProveedor = resolverModelos({}, null);
  ok(sinProveedor.model === "gpt-4o-mini",
    "con proveedor sin declarar, los modelos se resuelven como siempre (solo para telemetría: el freno actúa antes)");
}

console.log("\n── A3.e · el gateway consume la decisión del módulo puro (fuente leída como texto) ──");
{
  const SRC = readFileSync(new URL("./src/adi/llm/gatewayCore.js", import.meta.url), "utf8");
  const codigo = SRC.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  ok(/import \{ resolverModelos \} from "\.\/modelDefaults\.js"/.test(SRC),
    "el gateway importa resolverModelos del módulo puro");
  ok(/const \{ model, narrateModel \} = resolverModelos\(e, proveedor\)/.test(SRC),
    "_config resuelve los dos modelos por el único resolvedor (una sola verdad)");
  ok(!/gpt-4o-mini/.test(codigo), "no queda NINGÚN default de modelo escrito a mano en el código del gateway");
  ok(/if \(falta\) return _frenado\(/.test(codigo), "el freno de proveedor sin declarar sigue en los handlers (no se debilitó)");
}

console.log(`\n── _probe_anthropic_defaults: ${PASS} PASS · ${FAIL} FAIL ──`);
process.exit(FAIL ? 1 : 0);
