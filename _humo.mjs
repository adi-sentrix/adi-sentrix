/* === _humo.mjs · LA CORRIDA DE HUMO PRE-PUBLICACIÓN (owner 2026-09-03) ======================================
 *
 * ⚠️ ESTO GASTA CRÉDITOS REALES. NO SE CORRE SIN LA PALABRA DEL OWNER QUE NOMBRE EL GASTO.
 * Techo cosido: US$0.10 — el freno corre ANTES de cada turno y no es superable por diseño (el mismo patrón del
 * conductor de certificación: se reserva el costo de un turno normal y si lo que queda no lo paga, no se
 * arranca). Lo corre el SUPERVISOR como semáforo previo a cada publicación; este archivo solo lo ARMA.
 *
 * QUÉ ES: ~6 preguntas en vivo —una por familia certificada— con veredicto MECÁNICO por turno: un patrón que
 * TIENE que aparecer (la conducta certificada) y otro que NO PUEDE aparecer (los defectos que la certificación
 * mató: el menú de labels, la disculpa genérica, el vencido en $0, el molde). El texto del cerebro varía;
 * la conducta no debe — el mismo criterio del gate congelado, en versión de 6 turnos y diez centavos.
 *
 *   node _humo.mjs                                → contra el demo
 *   node _humo.mjs --planilla <ruta.xlsx>         → contra una planilla (la insignia usa --cliente)
 *   node _humo.mjs --cliente "Mercado Norte"      → el nombre para la pregunta insignia de serie
 *
 * Exit 0 = humo verde (publicable) · 1 = algún turno FAIL · 2 = freno o error de arnés.
 */
import fs from "node:fs";
import { execFileSync } from "node:child_process";
/* LOS VEREDICTOS VIVEN EN _humo_criterios.mjs — CONDUCTA, no cadenas (re-apuntado 2026-09-03 tras la primera
 * corrida viva: dos respuestas IMPECABLES dieron FAIL porque los regex de acá pedían frases del composer y el
 * cerebro respondió mejor con otras palabras — el caso 13 del patrón, en el medidor). El módulo es UNO para
 * el humo y para su gate de calibración (_humo_calibracion_gate, corpus real congelado): una sola fuente. */
import { FAMILIAS } from "./_humo_criterios.mjs";

const TECHO = 0.10;      // el techo del humo, cosido — diez centavos, no más
const RESERVA = 0.02;    // un turno normal del agente (medido en certificación: ~US$0.005-0.02)
const ESTADO = "_examen_agente_estado.json";
const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const PLANILLA = arg("--planilla");
const CLIENTE = arg("--cliente", PLANILLA ? "Mercado Norte" : "Falabella");

const TURNOS = FAMILIAS.map((f) => ({ familia: f.familia, q: f.pregunta({ cliente: CLIENTE }), pasa: f.pasa, prohibido: f.prohibido }));

const consola = (args) => execFileSync("node", ["_consola_examen.mjs", "--agente", ...args], { encoding: "utf8", timeout: 240000 });
const leerCosto = () => { try { return JSON.parse(fs.readFileSync(ESTADO, "utf8")).costoUSD || 0; } catch { return null; } };

const base = PLANILLA ? ["--planilla", PLANILLA] : [];
if (PLANILLA && !fs.existsSync(PLANILLA)) { console.error(`✗ no encuentro la planilla: ${PLANILLA}`); process.exit(2); }

console.log(`HUMO · ${TURNOS.length} turnos · techo US$${TECHO} · reserva por turno US$${RESERVA} · dato: ${PLANILLA || "demo"}`);
try { console.log(consola([...base, "--reset", "--titulo", "humo pre-publicación"])); } catch (e) { console.error("✗ la consola no arranca:", String(e.message).slice(0, 200)); process.exit(2); }

let fallas = 0;
for (const [i, t] of TURNOS.entries()) {
  const gastado = leerCosto();
  if (gastado === null) { console.error("■ estado ilegible — freno por precaución"); process.exit(2); }
  if (gastado + RESERVA > TECHO) {
    console.error(`■ FRENO: gastado US$${gastado.toFixed(4)} + reserva US$${RESERVA} > techo US$${TECHO}. No se arranca el turno ${i + 1}.`);
    process.exit(2);
  }
  console.log(`\n────── HUMO ${i + 1}/${TURNOS.length} · ${t.familia} ──────`);
  console.log(`» ${t.q}`);
  let salida = "";
  try { salida = consola([...base, "--frenar-en-vacia", t.q]); }
  catch (e) { console.error(`✗ TURNO CON ERROR: ${String(e.message).slice(0, 200)}`); fallas++; continue; }
  console.log(salida.split("\n").slice(-14).join("\n"));
  const razonProhibida = t.prohibido(salida);
  const okPasa = t.pasa(salida);
  if (okPasa && !razonProhibida) console.log(`✓ PASS · ${t.familia}`);
  else { fallas++; console.log(`✗ FAIL · ${t.familia} — ${razonProhibida ? `apareció un patrón prohibido (${razonProhibida})` : "falta la conducta certificada"}`); }
}

const total = leerCosto();
console.log(`\n════ HUMO: ${TURNOS.length - fallas}/${TURNOS.length} PASS · gastado US$${total === null ? "?" : total.toFixed(4)} de US$${TECHO} ════`);
console.log(fallas === 0 ? "🟢 humo verde: publicable" : "🔴 humo rojo: NO publicar — revisa los FAIL de arriba");
process.exit(fallas === 0 ? 0 : 1);
