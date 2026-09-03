/* === _probe_anthropic_adapter.mjs · preparación Anthropic · A2 (2026-08-13) ==============================
 * PROBE 100% OFFLINE: importa el adapter SOLO para ejercer sus CUERPOS PUROS (buildParseBody/buildNarrateBody)
 * — nunca invoca parse()/narrate(), así que ninguna ruta de este archivo puede producir una llamada pagada.
 * El candado de runtime lo garantiza además por diseño (la red muere con exit 97 antes de abrir un socket).
 * Correr con el candado:  node --import ./scripts/offline-guard.mjs _probe_anthropic_adapter.mjs
 *
 * Qué demuestra (A2), construyendo y comparando los BODIES, sin llamar a nadie:
 *   · el body de narrate() SIN la env → max_tokens 3072 (ver el análisis del default abajo);
 *   · CON LLM_NARRATE_MAX_TOKENS → el valor de la env; con basura o "0" → cae al default, nunca a NaN;
 *   · el body de parse() sigue byte-igual al de siempre, max_tokens 1024 incluido;
 *   · parse()/narrate() usan ESTOS builders (no hay un segundo cuerpo inline que se desincronice).
 *
 * EL DEFAULT DE NARRAR ES GARANTÍA, NO FORMATO — y por eso este probe lo fija (2048 → 3072, cierre del espejo
 * Anthropic 2026-08-13, hallazgo 2). El número no es una preferencia de presentación: es el punto donde el
 * proveedor CORTA la generación a mitad de token, y un corte ahí rompe la respuesta a mitad de frase — MEDIDO en
 * el espejo (transcript `_cert_espejo_anthropic.EF.json`, F4): la mejor respuesta de Sonnet llegó cortada en
 * «…contribución no capturada ($1.6M» con el envoltorio de marcos pegado al muñón. Ningún recorte del MOTOR corta
 * a mitad de oración (truncateToBriefBudget corta por oración; los strips borran oraciones/líneas/bloques
 * ENTEROS): el único corte a mitad de token es el max_tokens del proveedor. Los finales visibles de Sonnet miden
 * hasta 1.633 chars (G4) DESPUÉS de strips — el crudo es mayor (marcos [[...]], bloques descartados, tablas
 * podadas), así que 2048 de salida cruda se alcanza en un turno rico. 3072 = ~50% de aire; sigue siendo un TOPE
 * (solo se paga lo generado), así que subirlo no cuesta nada en el caso típico. Si este assert se mueve, que sea
 * con una medición nueva en la mano — no para «hacer pasar» el probe.
 */
import { readFileSync } from "node:fs";

const A = await import(new URL("./src/adi/llm/adapters/anthropic.js", import.meta.url).href);
const { buildParseBody, buildNarrateBody } = A;

let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ " + m + (extra ? " — " + extra : "")); } };
const J = JSON.stringify;

const TOOL = { name: "emitPlan", description: "una tool neutral de prueba", schema: { type: "object", properties: { x: { type: "string" } } } };
const SYSTEM = "SYSTEM DE PRUEBA · contrato";
const PAYLOAD = { pregunta: "¿margen de Falabella?", datos: [{ entidad: "Falabella", margen_pct: 22.1 }], cifras_autorizadas: ["22.1"] };

console.log("── A2.a · el body de parse() sigue BYTE-IGUAL al de siempre (max_tokens 1024 incluido) ──");
{
  // La réplica LITERAL de cómo parse() armaba su body antes de la extracción (anthropic.js pre-cambio).
  const viejo = {
    model: "claude-haiku-4-5", max_tokens: 1024,
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    tools: [{ name: TOOL.name, description: TOOL.description, input_schema: TOOL.schema }],
    tool_choice: { type: "tool", name: TOOL.name },
    messages: [{ role: "user", content: "hola" }],
  };
  const nuevo = buildParseBody("hola", { system: SYSTEM, tool: TOOL, model: "claude-haiku-4-5" });
  ok(J(nuevo) === J(viejo), "buildParseBody === construcción vieja, byte por byte (JSON idéntico)");
  ok(nuevo.max_tokens === 1024, "parse() queda en 1024 — NO se configura ni se movió");
  process.env.LLM_NARRATE_MAX_TOKENS = "4096";
  const conEnv = buildParseBody("hola", { system: SYSTEM, tool: TOOL, model: "m" });
  ok(conEnv.max_tokens === 1024, "…y la env de narrar NO lo alcanza (con LLM_NARRATE_MAX_TOKENS=4096 sigue en 1024)");
  delete process.env.LLM_NARRATE_MAX_TOKENS;
}

console.log("\n── A2.b · el body de narrate() SIN la env → max_tokens 3072, resto byte-igual ──");
{
  delete process.env.LLM_NARRATE_MAX_TOKENS;
  const body = buildNarrateBody(PAYLOAD, { model: "claude-sonnet-5", system: SYSTEM });
  ok(body.max_tokens === 3072, `sin LLM_NARRATE_MAX_TOKENS → 3072 (antes 2048: el espejo demostró que corta — ver cabecera)`);
  const viejoSinTope = {
    model: "claude-sonnet-5",
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: JSON.stringify(PAYLOAD) }],
  };
  const { max_tokens: _mt, ...resto } = body;
  ok(J(resto) === J(viejoSinTope), "todo lo demás del body es byte-igual al de siempre (solo cambió el tope)");
  ok(body.messages[0].content === JSON.stringify(PAYLOAD), "el payload validado viaja serializado igual que siempre");
}

console.log("\n── A2.c · CON la env → el valor de la env; basura o cero → default, nunca NaN ──");
{
  process.env.LLM_NARRATE_MAX_TOKENS = "3000";
  ok(buildNarrateBody(PAYLOAD, { model: "m", system: SYSTEM }).max_tokens === 3000, `LLM_NARRATE_MAX_TOKENS=3000 → 3000`);
  process.env.LLM_NARRATE_MAX_TOKENS = "no-es-un-numero";
  ok(buildNarrateBody(PAYLOAD, { model: "m", system: SYSTEM }).max_tokens === 3072, `un valor basura no produce NaN: cae al default 3072`);
  process.env.LLM_NARRATE_MAX_TOKENS = "0";
  ok(buildNarrateBody(PAYLOAD, { model: "m", system: SYSTEM }).max_tokens === 3072, `"0" (tope imposible) también cae al default`);
  delete process.env.LLM_NARRATE_MAX_TOKENS;
  ok(buildNarrateBody(PAYLOAD, { model: "m", system: SYSTEM }).max_tokens === 3072, `al borrar la env vuelve el default (se lee POR LLAMADA, no al importar)`);
}

console.log("\n── A2.d · parse()/narrate() usan ESTOS builders (fuente leída como texto, nunca ejecutada) ──");
{
  const SRC = readFileSync(new URL("./src/adi/llm/adapters/anthropic.js", import.meta.url), "utf8");
  ok(/await _call\(buildParseBody\(text, \{ system, tool, model \}\)\)/.test(SRC),
    "parse() arma su request con buildParseBody — no hay un segundo cuerpo inline");
  ok(/await _call\(buildNarrateBody\(validatedOutput, \{ model, system \}\)\)/.test(SRC),
    "narrate() arma su request con buildNarrateBody");
  ok(!/max_tokens:\s*1024[\s\S]*max_tokens:\s*1024/.test(SRC),
    "max_tokens: 1024 aparece UNA sola vez en el archivo (el de parse) — el de narrar ya no está fijo");
}

console.log("\n── A2.e · (La Poda 2026-09-05) el MODO NATURAL se retiró del adapter: todo payload viaja serializado ──");
{
  /* la prueba que quedó: un payload que TODAVÍA declare modoNatural (un caller viejo) no recibe trato
   * especial — viaja como el contrato de siempre, y el freno tipado vive en el gateway. */
  const body = buildNarrateBody({ modoNatural: true, mensajes: [{ role: "user", content: "hola" }] }, { model: "claude-sonnet-5", system: SYSTEM });
  ok(body.messages.length === 1 && body.messages[0].role === "user" && body.messages[0].content.includes("modoNatural"),
    "un payload con modoNatural ya NO arma el hilo: viaja serializado como cualquier otro (la rama murió)");
  ok(body.max_tokens === 3072 && body.system[0].cache_control.type === "ephemeral", "mismo tope y mismo corte de caché que narrate() de siempre");
  // y el candado de no-regresión: cualquier payload SIN modoNatural produce el body de siempre, byte por byte
  const normal = buildNarrateBody(PAYLOAD, { model: "claude-sonnet-5", system: SYSTEM });
  ok(normal.messages.length === 1 && normal.messages[0].content === JSON.stringify(PAYLOAD),
    "sin modoNatural el body es byte-igual al de siempre (el camino actual no cambió)");
  const conMensajesSinModo = buildNarrateBody({ mensajes: MENSAJES }, { model: "m", system: SYSTEM });
  ok(conMensajesSinModo.messages.length === 1 && conMensajesSinModo.messages[0].content === JSON.stringify({ mensajes: MENSAJES }),
    "…y `mensajes` sin la declaración modoNatural NO activa nada (el modo se declara, no se adivina)");
}

console.log(`\n── _probe_anthropic_adapter: ${PASS} PASS · ${FAIL} FAIL ──`);
process.exit(FAIL ? 1 : 0);
