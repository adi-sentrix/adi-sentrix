/* === _sello_periodo_una_vez_gate.mjs · EL SELLO DEL PERÍODO SE DICE UNA VEZ ═══════════════════════════════════
 *
 * LA DECISIÓN DEL OWNER (2026-09-10, textual): «"Datos del año cerrado" → una vez, y solo repetir cuando cambie o
 * importe el período. Repetirlo siempre hace que ADI parezca sistema, no asesor.»
 *
 * LA GARANTÍA QUE NO SE AFLOJA (requisito de confiabilidad 2026-07-29): cada familia de período se declara la
 * primera vez que aparece en la conversación; el marco MIXTO se declara siempre; el cambio de familia vuelve a
 * declarar; y si la pregunta habla del período («este año», «a hoy», «el año cerrado»), se declara aunque ya
 * estuviera dicho — ahí IMPORTA.
 *
 * OFFLINE · determinístico · CERO llamadas.
 * `node --import ./scripts/offline-guard.mjs _sello_periodo_una_vez_gate.mjs` */
import { readFileSync } from "node:fs";
import { ensurePeriodoDeclared, periodoDeclarado } from "./src/adi/oracle/guardC.js";

let pass = 0, fail = 0;
const ok = (cond, label, detalle) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label}`); if (detalle !== undefined) console.log(`      ${String(detalle).slice(0, 300)}`); }
};
const H = (t) => console.log(`\n${t}`);
const SELLO = /Datos del año cerrado/;
const TEXTO = "Falabella vende $19.4M y su margen es 22.0%, bajo el benchmark declarado.";

H("1 · la garantía de siempre: sin señal del hilo, el sello se estampa");
ok(SELLO.test(ensurePeriodoDeclared(TEXTO, ["anual"])), "la llamada de siempre (dos argumentos) estampa el sello — nada cambió para quien no pasa la opción");
ok(SELLO.test(ensurePeriodoDeclared(TEXTO, ["anual"], { yaDeclaradoEnElHilo: false })), "…y con la opción en falso, también");

H("2 · ★ la decisión del owner: ya declarado en el hilo → no se repite");
ok(!SELLO.test(ensurePeriodoDeclared(TEXTO, ["anual"], { yaDeclaradoEnElHilo: true })), "★★ con la familia ya declarada en la conversación, el pie NO se estampa de nuevo");
ok(ensurePeriodoDeclared(TEXTO, ["anual"], { yaDeclaradoEnElHilo: true }) === TEXTO, "…y el texto vuelve byte a byte");

H("3 · lo que SÍ se repite: el marco mixto, siempre");
const mixto = ensurePeriodoDeclared(TEXTO, ["anual", "hoy"], { yaDeclaradoEnElHilo: true });
ok(/Dos marcos distintos/.test(mixto), "★ dos familias en juego → se declara la mezcla aunque el hilo ya tuviera una de ellas");

H("4 · el detector del hilo es el MISMO que reconoce una declaración válida");
ok(periodoDeclarado("Tus ventas del año cerrado suman $99.3M.", ["anual"]), "«del año cerrado» en un turno anterior cuenta como declarado");
ok(!periodoDeclarado("Falabella vende $19.4M.", ["anual"]), "…y un turno sin la familia no cuenta");

H("5 · el cableado en el oráculo: el hilo decide, y la pregunta que habla del período lo vuelve a pedir");
{
  const src = readFileSync(new URL("./src/adi/oracle/answerViaOracle.js", import.meta.url), "utf8");
  ok(/_yaDeclarado = periodos\.length === 1 && !_preguntaHablaDePeriodo/.test(src), "solo con UNA familia y solo si la pregunta no habla del período");
  ok(/history : \[\]\)\.some\(\(h\) => h && h\.role !== "user" && typeof h\.text === "string" && periodoDeclarado\(h\.text, periodos\)\)/.test(src),
    "…mirando los turnos del ASISTENTE del hilo con `periodoDeclarado` (una sola fuente de verdad)");
  const sitios = (src.match(/ensurePeriodoDeclared\([^)]*_opPeriodo\)/g) || []).length;
  ok(sitios === 6, `…y los 6 sitios que estampan reciben la señal (${sitios})`);
  const regexPregunta = /const _preguntaHablaDePeriodo = (\/.+?\/i)\.test/.exec(src);
  const re = regexPregunta ? new RegExp(regexPregunta[1].slice(1, -2), "i") : null;
  ok(re && re.test("¿cómo va este año?") && re.test("¿cuánto vendí a hoy?") && !re.test("¿qué clientes explican eso?"),
    "«este año» / «a hoy» hacen que el período IMPORTE; «qué clientes explican eso» no");
}

console.log(`\n══ ${pass} PASS · ${fail} FAIL ══`);
process.exit(fail ? 1 : 0);
