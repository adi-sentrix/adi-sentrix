/* === _probe_anthropic_dosmodelos.mjs · preparación Anthropic · A4 (2026-08-13) ===========================
 * PROBE 100% OFFLINE: ejerce modelRouter.js (puro), los builders reales de narratePromptC.js y los cuerpos
 * puros del adapter — jamás importa el gateway ni invoca parse()/narrate(). Cero llamadas por diseño.
 * Correr con el candado:  node --import ./scripts/offline-guard.mjs _probe_anthropic_dosmodelos.mjs
 *
 * Qué demuestra (A4):
 *   · LA GARANTÍA DE DOS MODELOS: con provider=anthropic, chooseModel devuelve null en attempts 0/1/2 —
 *     no hay escalada de tiers, el reintento tras rechazo de guardC repite el modelo estático (Sonnet en
 *     narrar). Es EXACTAMENTE lo que el owner decidió, no un hueco.
 *   · el ladder de openai sigue intacto (mini → terra → sol, clamp incluido): el mundo viejo no se rompió.
 *   · EL SYSTEM SEGMENTADO: con [{text:fijo,cache:true},{text:variable,cache:false}] construidos por el
 *     builder REAL de narratePromptC, el body Anthropic pone cache_control SOLO en el segmento fijo — el
 *     corte del caché queda al final del prefijo estable (mismo criterio que _probe_paso0_prefijo.mjs).
 */
import { readFileSync } from "node:fs";

const R = await import(new URL("./src/adi/llm/modelRouter.js", import.meta.url).href);
const M = await import(new URL("./src/adi/oracle/narratePromptC.js", import.meta.url).href);
const P = await import(new URL("./src/adi/oracle/persona.js", import.meta.url).href);
const A = await import(new URL("./src/adi/llm/adapters/anthropic.js", import.meta.url).href);
const { chooseModel } = R;
const { buildNarrateSystemSegments } = M;
const { ADI_PERSONA, renderInteractionMemory } = P;
const { buildNarrateBody } = A;

let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ " + m + (extra ? " — " + extra : "")); } };
const J = JSON.stringify;

console.log("── A4.a · dos modelos y nada más: con anthropic NO hay escalada, en ningún intento ──");
{
  for (const step of ["plan", "narrate"]) {
    const tier1 = step === "plan" ? "claude-haiku-4-5" : "claude-sonnet-5";
    for (const attempt of [0, 1, 2]) {
      const r = chooseModel({ provider: "anthropic", tier1, attempt, step, env: {} });
      ok(r === null, `chooseModel(anthropic, ${step}, attempt=${attempt}) → null (el caller repite su modelo estático: ${tier1})`, J(r));
    }
  }
  ok(chooseModel({ provider: "anthropic", tier1: "claude-sonnet-5", attempt: 1, step: "narrate", env: { LLM_ROUTER_ENABLED: "true" } }) === null,
    "ni siquiera prendiendo el router a mano: la puerta es el PROVEEDOR, no el flag");
  ok(chooseModel({ provider: "anthropic", tier1: "claude-sonnet-5", attempt: 2, step: "narrate", env: { LLM_MODEL_TIER2: "claude-opus-5", LLM_MODEL_TIER3: "claude-opus-5" } }) === null,
    "y los overrides de TIER2/TIER3 tampoco lo despiertan: NO existe un tercer tier con anthropic");
}

console.log("\n── A4.b · el mundo viejo intacto: el ladder de openai sigue mini → terra → sol ──");
{
  const t1 = chooseModel({ provider: "openai", tier1: "gpt-4o-mini", attempt: 0, step: "narrate", env: {} });
  const t2 = chooseModel({ provider: "openai", tier1: "gpt-4o-mini", attempt: 1, step: "narrate", env: {} });
  const t3 = chooseModel({ provider: "openai", tier1: "gpt-4o-mini", attempt: 2, step: "narrate", env: {} });
  ok(t1 && t1.tier === 1 && t1.model === "gpt-4o-mini", `attempt=0 → tier1 (${t1 && t1.model})`);
  ok(t2 && t2.tier === 2 && t2.model === "gpt-5.6-terra", `attempt=1 → tier2 (${t2 && t2.model})`);
  ok(t3 && t3.tier === 3 && t3.model === "gpt-5.6-sol", `attempt=2 → tier3 (${t3 && t3.model})`);
  const clamp = chooseModel({ provider: "openai", tier1: "gpt-4o-mini", attempt: 999, step: "narrate", env: {} });
  ok(clamp && clamp.tier === 3, "attempt=999 sigue acotado a tier3 — NUNCA un tier 4+");
}

console.log("\n── A4.c · el system segmentado: cache_control SOLO al final del segmento FIJO ──");
{
  const MEM = renderInteractionMemory({ identidad: { nombre: "JC", empresa: "Sentrix" }, preferencias: { trato: "usted" } });
  const seg = buildNarrateSystemSegments(ADI_PERSONA, MEM, "diagnostico", null, false, null);
  ok(seg && typeof seg.fijo === "string" && seg.fijo.length > 30000 && typeof seg.variable === "string",
    `el builder REAL de narratePromptC entrega {fijo: ${seg.fijo.length} chars, variable: ${seg.variable.length} chars}`);
  // la MISMA forma con que handleNarrateC arma el system (verificada abajo contra la fuente):
  const system = [{ text: seg.fijo, cache: true }, { text: seg.variable, cache: false }];
  const body = buildNarrateBody({ pregunta: "x" }, { model: "claude-sonnet-5", system });
  ok(Array.isArray(body.system) && body.system.length === 2, "el body conserva los DOS segmentos (nada se concatena ni se pierde)");
  ok(body.system[0].text === seg.fijo && body.system[1].text === seg.variable,
    "…y el texto de cada segmento viaja byte-igual al que construyó el builder");
  ok(body.system[0].cache_control && body.system[0].cache_control.type === "ephemeral",
    "cache_control está en el segmento FIJO: el corte del caché queda exactamente al final del prefijo estable");
  ok(!("cache_control" in body.system[1]), "…y el segmento VARIABLE viaja SIN cache_control (lo por-turno no rompe el prefijo)");
  ok(body.system.map((s) => s.text).join("") === seg.fijo + seg.variable,
    "lo que el proveedor lee es byte-idéntico a fijo+variable (el corte solo marca, no recorta)");

  // el corte va en el ÚLTIMO cacheable aunque haya más de un segmento fijo (la regla general de _systemBlocks):
  const tri = buildNarrateBody({ pregunta: "x" }, { model: "m", system: [{ text: "a", cache: true }, { text: "b", cache: true }, { text: "c", cache: false }] });
  ok(tri.system[1].cache_control && !("cache_control" in tri.system[0]) && !("cache_control" in tri.system[2]),
    "con varios segmentos cacheables, el corte va en el ÚLTIMO de ellos — donde de verdad termina el texto estable");

  // el cableado real: handleNarrateC arma EXACTAMENTE esta forma (fuente leída como texto, nunca ejecutada).
  const GW = readFileSync(new URL("./src/adi/llm/gatewayCore.js", import.meta.url), "utf8");
  // [,)]: AMPLITUD F1 agregó `datoNegocio` como 7º argumento — misma garantía, otro cierre de llamada.
ok(/buildNarrateSystemSegments\([\s\S]{0,260}?payload\.reparacion \|\| null[,)]/.test(GW),
    "el gateway construye los segmentos con el builder real de narratePromptC");
  ok(/\{ text: _segN\.fijo, cache: true \}, \{ text: _segN\.variable, cache: false \}/.test(GW),
    "…y declara [{fijo, cache:true}, {variable, cache:false}] — la forma que este probe acaba de ejercer");
}

console.log(`\n── _probe_anthropic_dosmodelos: ${PASS} PASS · ${FAIL} FAIL ──`);
process.exit(FAIL ? 1 : 0);
