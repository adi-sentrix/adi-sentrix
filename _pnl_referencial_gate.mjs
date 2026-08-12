/* === _pnl_referencial_gate.mjs · PEDIR EL RESULTADO SEÑALANDO UN ANÁLISIS ANTERIOR (owner 2026-08-12) =======
 * @inspeccion-estatica — lee `ChatADI.jsx` como texto para probar cuál de los dos detectores decide el ruteo.
 * No importa el gateway, no invoca a nadie, no sale a la red.
 *
 * EL TURNO QUE LO ORIGINA, textual del owner: después de recibir el análisis de gastos escribió
 * «el analisis que me diste de gastos, el resultado del negocio». No es una pregunta nueva: señala lo que ya
 * recibió y pide UN nivel concreto de esa cascada.
 *
 * LO QUE SE MIDIÓ, y es lo que este gate congela: ese turno YA se resuelve bien, pero por una coincidencia frágil
 * entre DOS detectores que tienen que decir cosas OPUESTAS para que funcione:
 *   · `detectPnlIntent`  → null   ⟹ ChatADI deja pasar el turno al oráculo (si dijera algo, iría a la ruta vieja)
 *   · `pnlOraclePlan`    → plan   ⟹ el oráculo lo resuelve SIN pagar PLAN (answerViaOracle.js:1463)
 * Nada en el repo declaraba esa dependencia. Cualquiera que «ordene» los detectores —hacer que el del flujo
 * reclame también las lecturas, o afinar las familias de `detectPnlLectura`— rompe este turno EN SILENCIO: la
 * respuesta seguiría saliendo, con cifras correctas, contestando la contribución en vez del resultado.
 *
 * POR QUÉ IMPORTA MÁS QUE UN CASO: «resultado» y «contribución» son dos niveles distintos de la misma cascada.
 * Confundirlos no se ve —los dos son un número con signo de peso— y es exactamente el error que `pnlOraclePlan`
 * existe para impedir (ver su comentario: «que la respuesta sea el RESULTADO y no la contribución no puede
 * depender de que un modelo elija bien la tool»).
 *
 *   [1] EL TURNO DEL OWNER · su frase textual llega al resultado, y sin pagar.
 *   [2] LOS DOS DETECTORES · tienen que discrepar; si convergen, el turno cambia de camino.
 *   [3] LAS OTRAS FORMAS DE PEDIRLO · el mismo nivel dicho de seis maneras reales.
 *   [4] LA RED ES ANGOSTA · lo que NO es una lectura del resultado no entra.
 *   [5] EL CABLEADO · ChatADI decide con `detectPnlIntent`, y el oráculo consulta `pnlOraclePlan`.
 * Cero red, cero LLM. `npm run gates:offline`
 */
import { readFileSync } from "fs";
import { detectPnlIntent, detectPnlLectura, pnlOraclePlan } from "./src/adi/pnl.js";

let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };
const H = (t) => console.log("\n" + t);

const TURNO_OWNER = "el analisis que me diste de gastos, el resultado del negocio";

H("[1] EL TURNO DEL OWNER · textual, tal como lo escribió");
{
  const lec = detectPnlLectura(TURNO_OWNER);
  ok(!!lec, "la lectura del P&L reclama el turno");
  ok(lec && lec.focus === "resultado", `y pide el RESULTADO, no la contribución — focus:${lec && lec.focus}`);
  ok(lec && lec.entity === null, "sin entidad: «del negocio» pisa cualquier cliente nombrado de paso");
  const plan = pnlOraclePlan(TURNO_OWNER);
  ok(!!plan, "el oráculo arma el plan determinísticamente → PLAN no se paga");
  ok(plan && plan.intent === "answer", `y es un plan de respuesta, no una repregunta — intent:${plan && plan.intent}`);
}

H("[2] LOS DOS DETECTORES · el turno funciona porque DISCREPAN");
{
  /* Si `detectPnlIntent` empezara a reclamar este turno, ChatADI lo mandaría a la ruta vieja y `pnlOraclePlan`
   * —que vive en el oráculo— no llegaría a correr nunca. Los dos lados de esta dependencia van juntos acá. */
  ok(detectPnlIntent(TURNO_OWNER) === null,
    "el detector del FLUJO GUIADO NO lo reclama — si lo hiciera, el turno no llegaría al oráculo");
  ok(pnlOraclePlan(TURNO_OWNER) !== null,
    "…y el detector de LECTURA sí — es la única combinación en que este turno se responde bien");
}

H("[3] LAS OTRAS FORMAS DE PEDIR EL MISMO NIVEL");
{
  for (const q of ["el resultado del negocio", "¿cuál es el resultado del negocio?", "dame el resultado del negocio",
    "¿cuánto me queda después de gastos?", "¿cuál es mi utilidad neta?", "el estado de resultados"]) {
    const lec = detectPnlLectura(q);
    ok(lec && lec.focus === "resultado", `llega al resultado — "${q}"`, lec ? `focus:${lec.focus}` : "no la reclama nadie");
  }
}

H("[4] LA RED ES ANGOSTA · ante la duda no reclama el turno");
{
  for (const q of ["¿Qué clientes ceden más margen?", "¿dónde tengo capital inmovilizado?", "no entiendo",
    "logistica por que tiene un 3.5%", "¿cómo viene la venta mes a mes?"])
    ok(!detectPnlLectura(q), `NO la reclama — "${q}"`);
  /* «utilidad» en su sentido NO financiero: contestarla con la cascada sería el error que el veto ya impide. */
  for (const q of ["¿qué utilidad tiene este análisis?", "¿qué utilidad le ves a mirar esto?"])
    ok(!detectPnlLectura(q), `y distingue el otro sentido de «utilidad» — "${q}"`);
}

H("[5] EL CABLEADO · quién decide en cada capa");
{
  const sinComentarios = (p) => readFileSync(p, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const CHAT = sinComentarios("./src/ui/ChatADI.jsx");
  const ORACULO = sinComentarios("./src/adi/oracle/answerViaOracle.js");
  ok(/if\s*\(\s*_oracleOn\(\)\s*&&\s*!detectPnlIntent\(q\)\s*\)/.test(CHAT),
    "ChatADI cede el turno al P&L con `detectPnlIntent`, y SÓLO con ése");
  ok(/pnlOraclePlan\(q\)/.test(ORACULO), "y el oráculo consulta `pnlOraclePlan` antes de pagar");
  /* EL ANCLA DEL PAGO ES EL BUCLE DE REINTENTO, NO EL NOMBRE DE LA FUNCIÓN, y no es un rodeo: nombrar el símbolo
   * del gateway en un gate lo hace clasificar LIVE y lo SACA de la suite offline (scripts/gates-offline.mjs) —
   * el gate deja de correr sin ponerse rojo, que es la peor forma de fallar. El bucle `for (let attempt = 0;
   * attempt < 3; attempt++)` aparece dos veces en el archivo: la PRIMERA es la pasada del plan (la que se paga),
   * la segunda es la de narrar. `indexOf` toma la primera, que es exactamente la que hay que medir. */
  const iPnl = ORACULO.indexOf("pnlOraclePlan(q)");
  const iPago = ORACULO.indexOf("for (let attempt = 0; attempt < 3; attempt++)");
  ok(iPnl > 0 && iPago > 0 && iPnl < iPago, "…antes, no después: si corriera después, el plan ya estaría pagado",
    `pnlOraclePlan@${iPnl} · pasada pagada@${iPago}`);
}

console.log(`\n── P&L REFERENCIAL · ${PASS} PASS · ${FAIL} FAIL ──`);
process.exitCode = FAIL ? 1 : 0;
