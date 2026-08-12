/* === _no_repetir_gate.mjs · EL NARRADOR SABE LO QUE YA DIJO (owner 2026-08-12) =============================
 * @inspeccion-estatica — lee `narratePromptC.js` como texto para probar que la instrucción viaja en los DOS
 * payloads. No importa el gateway, no invoca a nadie, no sale a la red.
 *
 * EL CASO, textual: el owner recibió el análisis de gastos y dos turnos después escribió «el analisis que me
 * diste de gastos, el resultado del negocio». ADI volvió a narrar la lectura entera en vez de ir al nivel pedido.
 *
 * LA CAUSA, medida en las tres capas antes de tocar nada:
 *   · `mem.recentNarrations` existe y se mantiene turno a turno.
 *   · `guardC` la recibe y DETECTA la repetición… pero después de que la respuesta ya está escrita, y sólo avisa.
 *   · el NARRADOR —el único que podría evitarla— no tenía ni una palabra sobre ella.
 * O sea: el que avisa no escribe, y el que escribe no se entera. Séptima vez del mismo patrón en el proyecto.
 *
 * POR QUÉ AVISAR Y NO BLOQUEAR: bloquear está descartado CON EVIDENCIA en guardC.js (`_repetitionVerbatim`) —
 * agotaría los intentos de narrar y caería a una reparación peor que la respuesta repetida. La única capa donde
 * esto se arregla es ANTES de escribir.
 *
 *   [1] SIN HISTORIA NO DICE NADA · el primer turno queda byte-idéntico al de siempre.
 *   [2] CON HISTORIA AVISA · y sólo con las APERTURAS, nunca el texto completo listo para copiar.
 *   [3] LA DISTINCIÓN QUE IMPORTA · repetir una cifra es correcto; repetir la lectura entera no.
 *   [4] LOS DOS PAYLOADS · si sólo viajara en uno, encender claims-only apagaría el arreglo en silencio.
 *   [5] FALLA CERRADA · ante entrada rara devuelve "" y nunca revienta.
 * Cero red, cero LLM. `npm run gates:offline`
 */
import { readFileSync } from "fs";
import { buildNoRepetirDoctrina } from "./src/adi/oracle/narratePromptC.js";

let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };
const H = (t) => console.log("\n" + t);

const LARGA = "La contribución del negocio cae 3.1pp contra el año anterior y el resultado después de gastos queda en 8.4%, con logística pesando 3.5% de la venta y administración 2.0%, ambos supuestos declarados que conviene revisar antes de decidir nada sobre la cartera.";

H("[1] SIN HISTORIA NO DICE NADA · el primer turno no cambia");
{
  ok(buildNoRepetirDoctrina(null) === "", "sin memoria → cadena vacía");
  ok(buildNoRepetirDoctrina({}) === "", "sin recentNarrations → cadena vacía");
  ok(buildNoRepetirDoctrina({ recentNarrations: [] }) === "", "lista vacía → cadena vacía");
  ok(buildNoRepetirDoctrina({ recentNarrations: ["corto"] }) === "", "un fragmento demasiado corto no cuenta como narración");
}

H("[2] CON HISTORIA AVISA · sólo las aperturas");
{
  const d = buildNoRepetirDoctrina({ recentNarrations: [LARGA] });
  ok(d.length > 0, "con una narración reciente sí emite la instrucción");
  ok(/YA LE DIJISTE ESTO/.test(d), "y lo dice sin ambigüedad");
  ok(d.indexOf(LARGA) === -1, "NUNCA pega el texto completo: sería ponerle delante un párrafo listo para copiar");
  ok(/…/.test(d), "la apertura viene recortada");
  ok(d.length < LARGA.length + 600, `la instrucción no crece con la narración — ${d.length} caracteres`);
  const dos = buildNoRepetirDoctrina({ recentNarrations: [LARGA, LARGA.replace("cae", "sube")] });
  ok(dos.split("«").length - 1 === 2, "con dos narraciones recientes cita las dos aperturas");
}

H("[3] LA DISTINCIÓN QUE IMPORTA · qué se puede repetir y qué no");
{
  const d = buildNoRepetirDoctrina({ recentNarrations: [LARGA] });
  ok(/cifra o el nombre de un cliente es correcto/i.test(d),
    "declara que repetir una cifra o un nombre SIGUE siendo correcto — es la decisión del owner de 2026-07-30");
  ok(/no se repite es la lectura completa/i.test(d), "y que lo prohibido es la lectura entera con otra redacción");
  ok(/DIRECTO al nivel o al detalle/i.test(d), "y dice qué hacer en su lugar, no sólo qué evitar");
  ok(/reconoc[eé] en una frase que ya se la diste/i.test(d), "reconocer primero: el usuario no queda con la sensación de que ADI se olvidó");
}

H("[4] LOS DOS PAYLOADS · normal y claims-only");
{
  const SRC = readFileSync("./src/adi/oracle/narratePromptC.js", "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const usos = (SRC.match(/instruccion_no_repetir/g) || []).length;
  ok(usos >= 2, `la clave viaja en los DOS constructores de payload — encontradas ${usos}`,
    "si viajara en uno solo, encender ADI_CLAIMS_ONLY_ENABLED apagaría este arreglo sin que nada se ponga rojo");
  ok(/buildNoRepetirDoctrina\(c\.memoria\)/.test(SRC), "el de claims-only lo arma desde `c.memoria`");
  ok(/buildNoRepetirDoctrina\(mem\)/.test(SRC), "y el normal desde `mem`");
}

H("[5] FALLA CERRADA · ante lo raro, cadena vacía y sin explotar");
{
  for (const m of [undefined, 0, "no soy un objeto", { recentNarrations: "tampoco" }, { recentNarrations: [null, undefined] },
    { recentNarrations: [{ no: "es texto" }] }]) {
    let r; try { r = buildNoRepetirDoctrina(m); } catch { r = "EXPLOTÓ"; }
    ok(r === "", `entrada rara → "" sin explotar — ${JSON.stringify(m)}`, `devolvió: ${String(r).slice(0, 60)}`);
  }
}

console.log(`\n── NO REPETIR LO YA NARRADO · ${PASS} PASS · ${FAIL} FAIL ──`);
process.exitCode = FAIL ? 1 : 0;
