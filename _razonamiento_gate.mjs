/* === _razonamiento_gate.mjs · EL RAZONAMIENTO NO SE COME LA RESPUESTA (owner 2026-08-21) =======================
 * @inspeccion-estatica · lee código fuente como TEXTO para certificar el cableado. No importa el gateway ni un
 * adapter, no invoca a nadie, no abre una salida. Nombra `adapters/anthropic` porque su trabajo es auditar ese
 * archivo; sin el marcador quedaría LIVE y un gate que no corre no certifica nada.
 *
 * EL DEFECTO QUE CIERRA, medido con el instrumento nuevo en el arranque del Examen 5:
 *     motivo de corte: max_tokens · tokens de salida: 3072 · bloques: thinking
 * El proveedor gastó EL TOPE ENTERO razonando y devolvió CERO bloques de texto. ADI lo veía como «el cerebro no
 * dijo nada» (`narracion-vacia`), reintentaba con los mismos parámetros y volvía a pasar lo mismo: se paga el
 * 100% y se recibe 0%. Había ocurrido CUATRO veces en distintas sesiones sin poder diagnosticarse, porque el
 * cuerpo del request no declaraba NADA sobre razonamiento — decidía el default del proveedor, y ese default
 * decidía si ADI contestaba o no.
 *
 * LO QUE FIJA:
 *   1. el cuerpo de narrar DECLARA el razonamiento SIEMPRE — jamás lo hereda;
 *   2. apagado por defecto, con el tope de texto intacto;
 *   3. encendido, el tope SUBE por encima del presupuesto de razonamiento: el texto conserva su espacio;
 *   4. el motivo de corte y el tipo de bloque llegan hasta quien mide — sin eso, la próxima vacía vuelve a ser
 *      indiagnosticable.
 *
 * CÓMO VERIFICA EL PUNTO 2 Y 3 SIN IMPORTAR EL ADAPTER: extrae del fuente el TEXTO de `narrateBudget` y lo
 * ejercita. Es la función REAL, no una copia — si alguien la edita, este gate corre lo editado. */
import fs from "node:fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.dirname(fileURLToPath(import.meta.url));
let pass = 0, fail = 0;
const ok = (cond, label, detalle) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ FALLO: ${label}${detalle !== undefined ? ` — ${detalle}` : ""}`); }
};
const leer = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const ANT = leer(path.join("src", "adi", "llm", "adapters", "anthropic.js"));

console.log("═".repeat(100));
console.log("1 · EL CUERPO DE NARRAR DECLARA EL RAZONAMIENTO · nunca lo hereda del proveedor");
console.log("═".repeat(100));
const cuerpo = (ANT.match(/export function buildNarrateBody[\s\S]*?\n\}/) || [""])[0];
ok(!!cuerpo, "existe `buildNarrateBody`");
ok(/\.\.\.narrateBudget\(\)/.test(cuerpo), "el cuerpo toma el tope Y el razonamiento de `narrateBudget()`, juntos");
ok(!/max_tokens:\s*_narrateMaxTokens\(\)/.test(cuerpo),
  "…y ya NO fija el tope por su cuenta: separarlos es lo que dejó al razonamiento sin control");
ok(/thinking/.test(ANT), "el campo `thinking` existe en el adapter");
const parse = (ANT.match(/export function buildParseBody[\s\S]*?\n\}/) || [""])[0];
ok(/tool_choice/.test(parse) && !/thinking/.test(parse),
  "parse() sigue SIN el campo: fuerza `tool_choice`, que ya excluye el razonamiento (queda byte-idéntico)");

console.log("\n" + "═".repeat(100));
console.log("2 y 3 · EL PRESUPUESTO, EJERCITADO · se corre la función REAL extraída del fuente");
console.log("═".repeat(100));
// se lleva TAMBIÉN `_narrateMaxTokens`: el tope de texto es parte del presupuesto, no un vecino suyo
const _iA = ANT.indexOf('const _narrateMaxTokens');
const _iB = ANT.indexOf('export function narrateBudget', _iA);
const _iC = ANT.indexOf(String.fromCharCode(10) + '}', _iB);
const fuente = (_iA >= 0 && _iB > _iA && _iC > _iB) ? ANT.slice(_iA, _iC + 2) : '';
ok(!!fuente, "se pudo extraer `narrateBudget` del fuente");
// se ejercita con un entorno de mentira: la función real, sin tocar el proceso ni el `.env`
const construir = new Function("process", `${fuente.replace(/^export /m, "")}\nreturn narrateBudget;`);
const conEnv = (v) => construir({ env: v === null ? {} : { LLM_NARRATE_THINKING: String(v) } })();

const apagado = conEnv(null);
ok(apagado.thinking && apagado.thinking.type === "disabled",
  `por defecto el razonamiento va APAGADO y DECLARADO (${JSON.stringify(apagado.thinking)})`);
ok(apagado.max_tokens === 3072, `…con el tope de texto intacto (${apagado.max_tokens})`);

const encendido = conEnv(4000);
ok(encendido.thinking && encendido.thinking.type === "enabled" && encendido.thinking.budget_tokens === 4000,
  `encendido, el presupuesto es EXPLÍCITO (${JSON.stringify(encendido.thinking)})`);
ok(encendido.max_tokens === 4000 + 3072,
  `…y el tope SUBE por encima de él: el texto conserva sus 3072 (${encendido.max_tokens})`, `dio ${encendido.max_tokens}`);
ok(encendido.max_tokens - encendido.thinking.budget_tokens >= 2048,
  "EL INVARIANTE DE FONDO: pase lo que pase, al texto le queda espacio propio para escribir la respuesta");
ok(conEnv(0).thinking.type === "disabled" && conEnv(-5).thinking.type === "disabled",
  "un presupuesto de 0 o negativo lo deja apagado, no a medio encender");

console.log("\n" + "═".repeat(100));
console.log("4 · LA VACÍA SE PUEDE DIAGNOSTICAR · el motivo de corte y el tipo de bloque llegan a quien mide");
console.log("═".repeat(100));
const narrar = (ANT.match(/async narrate\([\s\S]*?\n  \},/) || [""])[0];
ok(/stop:\s*data\.stop_reason/.test(narrar), "el adapter copia el MOTIVO DE CORTE del proveedor");
ok(/bloques:\s*\(data\.content \|\| \[\]\)\.map\(\(b\) => b && b\.type\)/.test(narrar),
  "…y los TIPOS de bloque que vinieron — no su contenido: un tipo no es dato de nadie");
const GW = leer(path.join("src", "adi", "llm", "gatewayCore.js"));
ok(/stop:\s*motivoCorte \|\| null/.test(GW) && /bloques:\s*bloquesRecibidos \|\| null/.test(GW),
  "el gateway los deja pasar hasta el caller");
const CON = leer("_consola_examen.mjs");
ok(/CADENA VACÍA · motivo de corte/.test(CON) && /bloques que devolvió el proveedor/.test(CON),
  "y la consola del examen los GRITA cuando el borrador vuelve vacío");
ok(/stop: \(nr && nr\.stop\)/.test(CON) && /bloques: \(nr && nr\.bloques\)/.test(CON),
  "…además de guardarlos en el expediente, SIEMPRE: comparar una vacía contra una buena es el diagnóstico");

console.log(`\n── _razonamiento_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail === 0 ? 0 : 1);
