/* === _telemetria_cableado_gate.mjs · EL CABLEADO REAL, POR INSPECCIÓN ESTÁTICA ========================
 * @inspeccion-estatica — este gate LEE código fuente como texto. No importa el gateway, no invoca a nadie y
 * no sale a la red; el candado de runtime (--import offline-guard) se le aplica igual que a todos.
 *
 * POR QUÉ EXISTE: el gate de telemetría certifica el MÓDULO (los campos, el candado, la neutralidad). Este
 * certifica que el módulo esté REALMENTE ENCHUFADO — que PLAN y NARRAR emitan en éxito, error y reintento.
 * Un módulo perfecto que nadie llama no mide nada, y esa era exactamente la situación antes de este pase.
 *
 *   [1] PLAN emite · [2] NARRAR emite · [3] el intento viaja (sin él no se distingue un reintento)
 *   [4] ÉXITO y ERROR quedan tipados · [5] la RUTA DETERMINÍSTICA es un campo real, no una suposición
 *   [6] OBSERVACIÓN PURA · ninguna decisión del gateway depende de la telemetría, y no puede tumbar un turno
 */
import { readFileSync } from "fs";
import { REASON_CODES, aReasonCode, _limpio, emit, setSink } from "./src/adi/llm/telemetry.js";

let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };
const H = (t) => console.log("\n" + t);

const SRC = readFileSync("./src/adi/llm/gatewayCore.js", "utf8");
const TEL = readFileSync("./src/adi/llm/telemetry.js", "utf8");
// el cuerpo de cada handler, para poder afirmar "PLAN emite" y no solo "el archivo menciona emit".
const cuerpo = (nombre) => {
  const i = SRC.indexOf(`export async function ${nombre}`);
  if (i < 0) return "";
  const j = SRC.indexOf("\nexport async function", i + 10);
  return SRC.slice(i, j < 0 ? SRC.length : j);
};
const PLAN = cuerpo("handlePlan"), NARR = cuerpo("handleNarrateC");

H("[1] PLAN EMITE · dentro del handler, no en cualquier parte del archivo");
{
  ok(PLAN.length > 200, `se aisló el cuerpo de handlePlan — ${PLAN.length} caracteres`);
  ok(/emitTelemetria\s*\(/.test(PLAN), "handlePlan emite telemetría");
  ok(/etapa:\s*["']plan["']/.test(PLAN), "…y la etiqueta como etapa `plan`");
  ok(/latencia_ms:\s*Date\.now\(\)\s*-/.test(PLAN), "mide latencia real, no un valor fijo");
}

H("[2] NARRAR EMITE · el mismo trato, o la mitad del costo queda ciega");
{
  ok(NARR.length > 200, `se aisló el cuerpo de handleNarrateC — ${NARR.length} caracteres`);
  ok(/emitTelemetria\s*\(/.test(NARR), "handleNarrateC emite telemetría");
  ok(/etapa:\s*["']narrar["']/.test(NARR), "…y la etiqueta como etapa `narrar`");
  ok(/latencia_ms:\s*Date\.now\(\)\s*-/.test(NARR), "mide su propia latencia");
}

H("[3] EL INTENTO VIAJA · sin él, un reintento es indistinguible de un turno nuevo");
{
  ok(/intento:\s*Number\(attempt\)/.test(PLAN), "PLAN reporta el número de intento");
  ok(/intento:\s*Number\(attempt\)/.test(NARR), "NARRAR reporta el número de intento");
  ok(/\battempt\b/.test(SRC.slice(SRC.indexOf("export async function handlePlan"), SRC.indexOf("export async function handlePlan") + 200)),
    "`attempt` es parámetro del handler: el dato existe de verdad, no se inventa");
}

H("[4] ÉXITO Y ERROR QUEDAN TIPADOS · y el motivo es un código cerrado, nunca texto");
{
  ok(/resultado\s*=\s*["']ok["']/.test(TEL), "el éxito se tipa `ok`");
  ok(/rate_limited/.test(TEL) && /:\s*"error"/.test(TEL), "un 429 se separa de un error genérico");
  ok(/reasonCode:\s*aReasonCode\(/.test(TEL), "la causa pasa SIEMPRE por el traductor a código cerrado");
  ok(!/o\.motivo\s*=/.test(TEL) && !/"motivo"/.test(TEL), "ya no existe el campo de texto libre `motivo`");
  // LA LISTA SE ENUMERA, NO SE CUENTA (owner 2026-08-13). Un `length === 7` deja pasar el cambio de un código por
  // otro sin ponerse rojo — y lo que hace CERRADA a la lista no es su tamaño, sino que esté escrita. Acá va
  // entera: sumar, sacar o renombrar un código obliga a tocar esta línea, que es el registro de la decisión.
  // `config_missing` entró el 2026-08-13: "nadie declaró proveedor" y "el proveedor falló" no son lo mismo.
  const CODIGOS = ["rate_limited", "network_error", "invalid_plan", "empty_redirect", "guard_rejected",
    "provider_error", "config_missing", "unknown"];
  ok(REASON_CODES.length === CODIGOS.length && CODIGOS.every((c) => REASON_CODES.includes(c)),
    `los ${CODIGOS.length} códigos declarados, ni uno más — ${REASON_CODES.join(" · ")}`);
  ok(aReasonCode("cifra-no-autorizada: 4.3M de Falabella") === "guard_rejected",
    "un rechazo del guard con nombre y cifra adentro sale como CÓDIGO: el texto no sobrevive");
  ok(aReasonCode("algo rarisimo y sin patron conocido") === "unknown",
    "lo que no mapea cae en `unknown`, jamás en el texto original");
  const e = _limpio({ reasonCode: "el cliente Falabella pidió $4.3M" });
  ok(e.reasonCode === "unknown" && !/Falabella|4\.3/.test(JSON.stringify(e)),
    `ni forzando texto en el campo se filtra — ${JSON.stringify(e.reasonCode)}`);
}

H("[5] LA RUTA DETERMINÍSTICA · es un campo real, tipado, no una suposición");
{
  ok(/ruta_deterministica/.test(TEL), "el módulo declara el campo");
  ok(/ruta_deterministica/.test(PLAN) && /ruta_deterministica/.test(NARR), "los dos handlers lo reportan");
  ok(_limpio({ ruta_deterministica: 1 }).ruta_deterministica === true, "se normaliza a booleano");
  ok(_limpio({}).ruta_deterministica === null, "y sin dato queda en null, no en un falso `false`");
  ok(/["']deterministica["']/.test(TEL), "la etapa `deterministica` existe: un turno que NO pagó también se puede contar");
}

H("[6] OBSERVACIÓN PURA · no decide, y su fallo no puede tumbar un turno");
{
  ok(!/if\s*\([^)]*emitTelemetria/.test(SRC), "ninguna condición del gateway depende de la telemetría");
  ok(!/return\s+emitTelemetria/.test(SRC), "ningún retorno del gateway sale de la telemetría");
  ok(!/await\s+emitTelemetria/.test(SRC), "no se espera: no puede demorar la respuesta");
  // `fetch\s*\(` y no `\bfetch\b`: la lista de códigos menciona "fetch failed" como TEXTO a mapear, que no es
  // una llamada. Distinguir la mención del uso es justo lo que este gate certifica en el resto de los casos.
  ok(!/\bfetch\s*\(|from ["']fs["']|node:fs|process\.exit/.test(TEL),
    "el módulo no escribe, no sale a la red y no puede cortar el proceso: el host decide el destino");
  // el fallo del destino, probado de verdad
  let cayo = false;
  setSink(() => { throw new Error("destino caído"); });
  try { emit({ traceId: "t", etapa: "plan", resultado: "ok" }); } catch { cayo = true; }
  setSink(null);
  ok(!cayo, "si el destino explota, `emit` se lo traga: la respuesta al usuario nunca se ve afectada");
}

console.log(`\n── CABLEADO DE TELEMETRÍA · ${PASS} PASS · ${FAIL} FAIL ──`);
process.exitCode = FAIL ? 1 : 0;
