/* === _probe_espejo_cierre_a2.mjs · ARREGLO 2 del cierre del espejo Anthropic (2026-08-13) =====================
 * Hallazgo 2 (transcript `_cert_espejo_anthropic.EF.json`, F4): la mejor respuesta de Sonnet llegó CORTADA a
 * mitad de frase por el tope del proveedor — «…contribución no capturada ($1.6M» — y el envoltorio de marcos se
 * appendeó al muñón: «($1.6M (Dos marcos distintos: …)». Verifica las dos mitades:
 *   [1] el F4 SINTÉTICO: un texto cortado a mitad de frase recibe la cláusula de marcos TRAS recortar el muñón
 *       hasta la última oración completa — nunca pegada al fragmento;
 *   [2] recortarMunonDeOracion: number-safe (el punto decimal no es fin de oración) · idempotente · una tabla o
 *       una lista cierran sin puntuación y NO se recortan · un muñón entero (sin ninguna oración completa) queda
 *       intacto · un texto cerrado vuelve byte a byte;
 *   [3] los demás appenders (hipótesis · cierre de clarify · faltante de transferencia) también recortan;
 *   [4] el default del adapter quedó en 3072 (la otra mitad del hallazgo — análisis en _probe_anthropic_adapter).
 * 100% OFFLINE · cero red, cero LLM:  node --import ./scripts/offline-guard.mjs _probe_espejo_cierre_a2.mjs */
import { ensurePeriodoDeclared, recortarMunonDeOracion } from "./src/adi/oracle/guardC.js";
import { ensureHypothesisFraming, ensureClarifyClosingQuestion } from "./src/adi/oracle/narratePromptC.js";

let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ " + m + (extra ? "\n      " + String(extra).slice(0, 240) : "")); } };
const H = (t) => console.log("\n" + t);

H("[1] F4 SINTÉTICO: el muñón se recorta y el marco queda tras oración completa");
{
  // la forma EXACTA del defecto medido: última oración cortada a mitad de paréntesis por el tope del proveedor
  const cortado = "La brecha no está repartida parejo: tus tres clientes más grandes concentran el 49% de la contribución.\n\nPor dónde arrancar: Falabella, no solo por ser el más grande sino porque combina la mayor contribución no capturada ($1.6M";
  const out = ensurePeriodoDeclared(cortado, ["anual", "hoy"]);
  ok(!/\$1\.6M \(Dos marcos/.test(out), "la cláusula ya NO se pega al muñón «($1.6M»", out);
  ok(/contribución\.\s*\(Dos marcos distintos: la venta es del año cerrado y el inventario es la foto a hoy\.\)$/.test(out),
    "…queda tras la última oración COMPLETA, con el muñón recortado", out);
  ok(!/Por dónde arrancar/.test(out), "el fragmento sin cerrar se fue entero (era un muñón, no información)", out);
  // con UNA sola familia el comportamiento es el mismo
  const una = ensurePeriodoDeclared(cortado, ["anual"]);
  ok(/contribución\.\s*\(Datos del año cerrado\.\)$/.test(una), "misma garantía con una sola familia de período", una);
}

H("[2] recortarMunonDeOracion: number-safe · idempotente · tablas/listas/muñón-entero intactos");
{
  const cerrado = "Falabella vendió $19.4M en el año cerrado, un 19.4% de tus $100.0M totales.";
  ok(recortarMunonDeOracion(cerrado) === cerrado, "un texto cerrado vuelve byte a byte (idempotente)");
  ok(recortarMunonDeOracion(recortarMunonDeOracion(cerrado)) === cerrado, "…y aplicarlo dos veces da lo mismo");
  const conDecimal = "El margen marca 25.1% contra tu benchmark de 30.1%.";
  ok(recortarMunonDeOracion(conDecimal) === conDecimal, "el punto decimal de una cifra jamás cuenta como fin de oración (number-safe)");
  const tabla = "Tus cuentas bajo el benchmark:\n\n| Cliente | Margen |\n|---|---|\n| Lider | 21.5% |\n| Falabella | 22.0% |";
  ok(recortarMunonDeOracion(tabla) === tabla, "una tabla cierra sin puntuación y NO se recorta");
  const lista = "Tres señales:\n· Lider cede 8.6 pp\n· Falabella cede 8.1 pp\n· Jumbo cede 6.1 pp";
  ok(recortarMunonDeOracion(lista) === lista, "una lista cierra sin puntuación y NO se recorta");
  const munonEntero = "Para llegar a ese 25% lo primero sería revisar la carga de";
  ok(recortarMunonDeOracion(munonEntero) === munonEntero, "un muñón ENTERO (sin ninguna oración completa) queda intacto — nunca se deja la respuesta vacía");
  const pregunta = "¿Quieres que lo veamos por cliente?";
  ok(recortarMunonDeOracion(pregunta) === pregunta, "un cierre con «?» está cerrado");
  const tablaCortada = "El detalle:\n\n| Cliente | Margen |\n|---|---|\n| Lider | 21.5% |\n| Falabe";
  const tc = recortarMunonDeOracion(tablaCortada);
  ok(/\| Lider \| 21\.5% \|$/.test(tc), "una FILA cortada a la mitad se recorta hasta la última fila completa", tc);
}

H("[3] los demás appenders también recortan antes de sumar");
{
  const cortado = "Con ese supuesto recuperarías $194K en el año. El resto depende de la carga que hoy corre sobre";
  const h = ensureHypothesisFraming(cortado, "simulacion", []);
  ok(/\$194K en el año\.\n\nEsto es un estimado/.test(h), "hipótesis: la oración de resguardo va tras el recorte", h);
  const c = ensureClarifyClosingQuestion("Puedo mostrarte el margen o la rotación. Dime cuál de los dos te", "clarify");
  ok(/la rotación\.\n\n¿Quieres que lo repase de otra forma/.test(c), "clarify: la pregunta de cierre va tras el recorte", c);
}

H("[4] el default del adapter quedó en 3072 (la otra mitad del hallazgo)");
{
  delete process.env.LLM_NARRATE_MAX_TOKENS;
  const { buildNarrateBody } = await import("./src/adi/llm/adapters/anthropic.js");
  ok(buildNarrateBody({ x: 1 }, { model: "m", system: "s" }).max_tokens === 3072,
    "narrate() sin env → 3072 (el análisis formato-vs-garantía vive en _probe_anthropic_adapter.mjs)");
}

console.log(`\n── PROBE A2 · borde de oración + tope 3072 · ${PASS} PASS · ${FAIL} FAIL ──`);
process.exitCode = FAIL ? 1 : 0;
