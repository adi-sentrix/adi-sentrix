/* === _telemetria_gateway_gate.mjs · TELEMETRÍA MÍNIMA DEL GATEWAY (owner 2026-08-10) ==================
 * Nació de un hecho: se gastaron llamadas pagadas y NO se pudo saber cuántas, con qué modelo ni por qué
 * reintentaron. Este gate certifica que eso ya no puede volver a pasar — y que la telemetría no se convierta
 * en una fuga de datos del cliente.
 *   [1] LOS NUEVE CAMPOS que el owner pidió, y NINGUNO más.
 *   [2] EL CANDADO: lo que no está en la lista blanca NO sale, aunque el llamador lo mande.
 *   [3] SIN DATOS SENSIBLES: prompts, respuestas, nombres, cifras y argumentos nunca tocan el sink.
 *   [4] APAGADA POR DEFECTO y NUNCA LANZA: un fallo de telemetría no puede tumbar un turno del producto.
 *   [5] PROVIDER-NEUTRAL: los mismos nueve campos con cualquier proveedor y cualquier forma de `usage`.
 *   [6] OBSERVACIÓN PURA: el gateway la importa pero la telemetría no decide nada.
 * Cero red, cero LLM. `npm run gates:offline`
 */
import fs from "fs";
import { emit, setSink, getSink, _limpio, desdeRespuesta, nuevoTraceId, ETAPAS, RESULTADOS, getToolsDeclaradas } from "./src/adi/llm/telemetry.js";
// El registro de tools se declara como EFECTO DE IMPORTAR el ejecutor real (toolRunner.js): así el gate prueba el
// cableado que corre en producción, no una lista escrita a mano acá. Es puro — no toca red ni proveedor.
import { TOOLS } from "./src/adi/oracle/toolRegistry.js";
import "./src/adi/oracle/toolRunner.js";

let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };
const H = (t) => console.log("\n" + t);
const cap = () => { const a = []; setSink((e) => a.push(e)); return a; };

H("[1] LOS NUEVE CAMPOS · lo que el owner pidió, completo");
{
  const a = cap();
  emit({ traceId: "t1", proveedor: "openai", modelo: "mini", etapa: "plan", intento: 1, resultado: "ok",
    motivo: null, tokens_in: 800, tokens_out: 120, latencia_ms: 940, ruta_deterministica: false });
  const e = a[0];
  for (const k of ["traceId", "proveedor", "modelo", "etapa", "intento", "resultado", "reasonCode", "tokens_in", "tokens_out", "latencia_ms", "ruta_deterministica"])
    ok(k in e, `emite \`${k}\``);
  ok(ETAPAS.join() === "plan,narrar,deterministica", `las tres etapas del owner — ${ETAPAS.join(" · ")}`);
  ok(RESULTADOS.includes("rechazado") && RESULTADOS.includes("rate_limited"), "el resultado distingue rechazo de límite de tasa (era justo lo indistinguible)");
}

H("[2] EL CANDADO · lo que no está en la lista blanca NO sale");
{
  const a = cap();
  emit({ traceId: "t2", etapa: "plan", prompt: "El KPI dice $4.1M, ¿de dónde sale?", respuesta: "Falabella aporta $4.3M",
    entidad: "Falabella", args: { metric: "carga", entity: "Falabella" }, tenantId: "acme-sa", cifra: 4300000 });
  const e = a[0], s = JSON.stringify(e);
  for (const k of ["prompt", "respuesta", "entidad", "args", "tenantId", "cifra"]) ok(!(k in e), `descarta \`${k}\` aunque el llamador lo mande`);
  ok(!/Falabella|acme|4\.?3/.test(s), `nada del negocio sobrevive — ${s.slice(0, 90)}`);
  ok(_limpio({ etapa: "inventada" }).etapa === null, "una etapa fuera del enum se anula, no se propaga");
  ok(_limpio({ resultado: "cualquier-cosa" }).resultado === null, "un resultado fuera del enum también");
}

H("[3] SIN DATOS SENSIBLES · la causa es un CODIGO cerrado, nunca texto");
{
  const a = cap();
  emit({ traceId: "t3", etapa: "narrar", resultado: "rechazado", reasonCode: "cifra-no-autorizada: 4.3M de Falabella" });
  ok(a[0].reasonCode === "guard_rejected", );
  ok(!/Falabella|4.3/.test(JSON.stringify(a[0])), "nada del texto original sobrevive");
  ok(_limpio({ tokens_in: "800; DROP TABLE" }).tokens_in === null, "un numerico contaminado queda en null, no se parsea a medias");
  ok(_limpio({ tokens_in: "no-es-numero" }).tokens_in === null, "y lo que no es numero queda en null");
}

H("[4] APAGADA POR DEFECTO · y no puede tumbar un turno");
{
  setSink(null);
  ok(getSink() === null, "el sink arranca apagado: el gateway no elige destino");
  ok(emit({ traceId: "t5", etapa: "plan" }) === null, "sin sink, emitir no hace nada");
  setSink(() => { throw new Error("el disco se llenó"); });
  let cayo = false;
  try { emit({ traceId: "t6", etapa: "plan" }); } catch { cayo = true; }
  ok(!cayo, "si el sink explota, `emit` NO propaga: la telemetría jamás rompe el producto");
  setSink(null);
}

H("[5] PROVIDER-NEUTRAL · los mismos nueve campos con cualquier proveedor");
{
  const openai = desdeRespuesta({ traceId: "a", proveedor: "openai", modelo: "mini", etapa: "plan", intento: 0, latencia_ms: 900,
    respuesta: { ok: true, usage: { prompt_tokens: 700, completion_tokens: 90 } } });
  const anthropic = desdeRespuesta({ traceId: "b", proveedor: "anthropic", modelo: "haiku", etapa: "plan", intento: 0, latencia_ms: 800,
    respuesta: { ok: true, usage: { input_tokens: 700, output_tokens: 90 } } });
  ok(openai.tokens_in === 700 && anthropic.tokens_in === 700, `las dos formas de \`usage\` dan el mismo campo — ${openai.tokens_in}/${anthropic.tokens_in}`);
  ok(openai.tokens_out === 90 && anthropic.tokens_out === 90, "y los de salida también");
  ok(Object.keys(openai).sort().join() === Object.keys(anthropic).sort().join(), "el mismo juego de campos, sin importar el proveedor");
  const rl = desdeRespuesta({ traceId: "c", proveedor: "openai", etapa: "plan", intento: 1, respuesta: { ok: false, error: "rate_limited" } });
  ok(rl.resultado === "rate_limited", `un 429 se tipa como límite de tasa, no como rechazo — ${rl.resultado}`);
  const rj = desdeRespuesta({ traceId: "d", proveedor: "openai", etapa: "narrar", intento: 0, respuesta: { ok: true }, motivo: "guard: entidad-sin-dueño" });
  ok(rj.resultado === "rechazado", `un rechazo del guard se tipa distinto — ${rj.resultado}`);
  ok(nuevoTraceId("x") === nuevoTraceId("x") && nuevoTraceId("x") !== nuevoTraceId("y"), "el traceId es estable por semilla y no colisiona trivialmente");
}

H("[6] LO QUE FALTABA · modelo EFECTIVO · tools ejecutadas · caché de entrada (owner 2026-08-10, cierre de la certificación)");
{
  // MODELO EFECTIVO. Las 11 llamadas de la corrida quedaron con el modelo en "?": el adapter descartaba el que
  // devuelve el proveedor y el gateway sólo exponía el PEDIDO. No son la misma cadena — el alias se resuelve a una
  // versión fechada, y para medir costo importa la que respondió.
  const efectivo = desdeRespuesta({ traceId: "m1", proveedor: "openai", modelo: "gpt-4o-mini", etapa: "plan", intento: 0,
    respuesta: { ok: true, modelo: "gpt-4o-mini-2024-07-18", modelUsed: "gpt-4o-mini", usage: { prompt_tokens: 10, completion_tokens: 2 } } });
  ok(efectivo.modelo === "gpt-4o-mini-2024-07-18", `gana el modelo que RESPONDIÓ, no el que se pidió — ${efectivo.modelo}`);
  const sinEfectivo = desdeRespuesta({ traceId: "m2", proveedor: "openai", modelo: "gpt-4o-mini", etapa: "plan", intento: 0,
    respuesta: { ok: true, usage: {} } });
  ok(sinEfectivo.modelo === "gpt-4o-mini", "si el proveedor no lo informa, cae al pedido — nunca a null (era el «?»)");

  // CACHÉ DE ENTRADA. Los dos adapters ya normalizaban `cachedTokens` desde 2026-08-03 y acá se descartaba.
  const cacheado = desdeRespuesta({ traceId: "c1", proveedor: "anthropic", modelo: "haiku", etapa: "plan", intento: 0,
    respuesta: { ok: true, usage: { input_tokens: 8891, output_tokens: 62, cachedTokens: 7600 } } });
  ok(cacheado.tokens_in_cache === 7600, `separa los tokens de entrada servidos por el caché — ${cacheado.tokens_in_cache}`);
  ok(cacheado.tokens_in_fresh === 1291, `y los que se pagaron completos, por resta — ${cacheado.tokens_in_fresh}`);
  const sinCache = desdeRespuesta({ traceId: "c2", proveedor: "openai", modelo: "mini", etapa: "plan", intento: 0,
    respuesta: { ok: true, usage: { prompt_tokens: 800, completion_tokens: 20 } } });
  ok(sinCache.tokens_in_cache === null && sinCache.tokens_in_fresh === null,
    "sin dato del proveedor queda en null, NUNCA en 0: no se finge «cero cacheado»");
  ok(_limpio({ tokens_in: 100, tokens_in_cache: 40, tokens_in_fresh: 999 }).tokens_in_fresh === 60,
    "el `fresh` se DERIVA: un valor que no cierra con los otros dos no se acepta");

  // TOOLS EJECUTADAS, con el MISMO candado de lista cerrada que la causa.
  ok(getToolsDeclaradas().length === Object.keys(TOOLS).length && getToolsDeclaradas().length > 0,
    `el registro de tools se declara desde el ejecutor real, no desde una copia — ${getToolsDeclaradas().length} tools`,
    `telemetría=${getToolsDeclaradas().length} vs toolRegistry=${Object.keys(TOOLS).length}`);
  const a = cap();
  emit({ traceId: "tl", etapa: "deterministica", tools: ["queryMetric", "entityRecord", "Falabella", "$4.1M", "tool_inventada"] });
  ok(JSON.stringify(a[0].tools) === JSON.stringify(["queryMetric", "entityRecord"]),
    `sólo sobreviven las tools del registro real — ${JSON.stringify(a[0].tools)}`);
  ok(!/Falabella|4\.1M/.test(JSON.stringify(a[0])), "una entidad disfrazada de tool NO sobrevive al candado");
  setSink(null);
}

/* [7] OBSERVACIÓN PURA · el cableado en el gateway NO se verifica acá a propósito: leer ese archivo
 * —aunque sea como texto— hace que el clasificador estático marque este gate como LIVE y lo saque de la suite
 * offline. Un gate que no corre no certifica nada. La decisión es del owner (ver el informe): o el clasificador
 * distingue "lee el archivo" de "llama al gateway", o esta verificación vive en otro lado. */


