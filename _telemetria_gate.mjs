/* === _telemetria_gate.mjs · EL REGISTRO DE SALUD DE ADI (owner 2026-08-21) ====================================
 * POR QUÉ EXISTE. CLAUDE.md §3, textual: «el repo NO registra consumo. No hay contador de llamadas, gasto ni
 * reintentos». Todo lo que sabíamos de cómo responde ADI salía de exámenes manuales pagos — así se descubrió el
 * último defecto: por una captura del owner. Este módulo cierra ese hueco, y este gate lo mantiene honesto.
 *
 * LO QUE FIJA, y las tres cosas son de fondo:
 *   1. EL ESQUEMA · lo que no está declarado no se guarda. Agregar un campo con dato de negocio tiene que ser
 *      imposible por descuido, no por buena memoria.
 *   2. LA FRONTERA DEL DATO · este renglón es la tabla que Supabase va a heredar, así que nace con la regla:
 *      ni cifras, ni entidades, ni firma de la carpeta. La pregunta SOLO cuando el turno no salió verde.
 *   3. EL ANILLO · acotado. Un registro que crece sin fin deja de ser un instrumento y pasa a ser un problema.
 *
 * Y UNO DE CABLEADO, que nació de un defecto real: el rastro declaraba el escenario EQUIVOCADO. Los callers
 * pasaban `scenario` y `_turnFromResult` no lo declaraba en su firma, así que se perdía en el camino y la firma
 * de la carpeta salía la de «actual» ($100.0M) mientras la app corría `bonanza` ($99.9M). El instrumento hecho
 * para detectar «dos entornos mirando negocios distintos» reportaba el negocio equivocado.
 *
 * OFFLINE · CERO GASTO: importa un módulo puro y lee dos archivos. */
import fs from "node:fs";
import path from "path";
import { fileURLToPath } from "url";
import { CAMPOS_TELEMETRIA, registrarTurno, resumenTelemetria, exportarTelemetria, borrarTelemetria } from "./src/adi/telemetria.js";

const root = path.dirname(fileURLToPath(import.meta.url));
let pass = 0, fail = 0;
const ok = (cond, label, detalle) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ FALLO: ${label}${detalle !== undefined ? ` — ${detalle}` : ""}`); }
};

console.log("═".repeat(100));
console.log("1 · EL ESQUEMA · lo que no está declarado, no se guarda");
console.log("═".repeat(100));
borrarTelemetria();
const fila = registrarTurno({
  t: 1, via: "natural", route: "qi_retrieval", estado: "reparado", vetos: ["cifra-de-dato-sin-dueno"],
  reparaciones: 1, llamadas: 2, ms: 1234, pregunta: "dime donde estoy perdiendo margen",
  // ── lo que NO puede pasar: dato de negocio colado en el registro de salud ──
  carpeta: "Ventas totales: $99.9M", escenario: "bonanza", entidad: "Falabella", monto: "$1.57M",
});
ok(!!fila, "un turno se registra");
const sobran = Object.keys(fila || {}).filter((k) => !CAMPOS_TELEMETRIA.includes(k));
ok(sobran.length === 0, `el renglón trae SOLO los campos declarados${sobran.length ? "" : ` (${CAMPOS_TELEMETRIA.join(", ")})`}`, `se colaron: ${sobran.join(", ")}`);
for (const k of ["carpeta", "escenario", "entidad", "monto"]) {
  ok(!(k in (fila || {})), `«${k}» NO entra al registro: es dato de negocio, no salud`);
}

console.log("\n" + "═".repeat(100));
console.log("2 · LA FRONTERA DEL DATO · la pregunta solo cuando algo salió mal");
console.log("═".repeat(100));
ok(fila.pregunta === "dime donde estoy perdiendo margen", "un turno REPARADO guarda la pregunta: sin ella no se puede arreglar");
borrarTelemetria();
const verde = registrarTurno({ estado: "verde", via: "natural", llamadas: 1, ms: 900, pregunta: "cuánto vendí este año" });
ok(verde.pregunta === null, "…y un turno VERDE no la guarda: si salió bien, el texto no aporta y sí expone");
const sup = registrarTurno({ estado: "suplente", via: "natural", llamadas: 3, ms: 8000, pregunta: "hazme un resumen ejecutivo de las dos cosas" });
ok(sup.pregunta && sup.pregunta.length > 10, "un SUPLENTE sí la guarda: es el caso que hay que reproducir");
ok(String(sup.pregunta).length <= 120, "…recortada, nunca la conversación entera");

console.log("\n" + "═".repeat(100));
console.log("3 · EL RESUMEN · responde «¿cómo se está portando?» sin gastar una llamada");
console.log("═".repeat(100));
borrarTelemetria();
for (const e of ["verde", "verde", "verde", "reparado", "suplente"]) {
  registrarTurno({ estado: e, via: "natural", llamadas: e === "suplente" ? 3 : 1, ms: 1000, reparaciones: e === "verde" ? 0 : 1, vetos: e === "verde" ? [] : ["calculo-no-verificable"] });
}
const r = resumenTelemetria();
ok(r.turnos === 5, `cuenta los turnos (${r.turnos})`);
ok(r.verde === "60%" && r.reparado === "20%" && r.suplente === "20%", `el reparto por estado: ${r.verde} verde · ${r.reparado} reparado · ${r.suplente} suplente`);
ok(r.llamadasPorTurno === 1.4, `las llamadas por turno (${r.llamadasPorTurno})`);
ok(r.reparaciones === 2, `las reparaciones acumuladas (${r.reparaciones})`);
ok(Array.isArray(r.vetosFrecuentes) && r.vetosFrecuentes[0] === "calculo-no-verificable (2)", `y el veto más frecuente: ${r.vetosFrecuentes[0]}`);
ok(typeof r.texto === "string" && r.texto.includes("60% verde"), "…con una línea que se lee sin abrir el código");

console.log("\n" + "═".repeat(100));
console.log("4 · EL ANILLO ESTÁ ACOTADO · un registro que crece sin fin es un problema, no un instrumento");
console.log("═".repeat(100));
borrarTelemetria();
for (let i = 0; i < 260; i++) registrarTurno({ estado: "verde", via: "natural" });
ok(exportarTelemetria().length === 200, `se queda con los últimos 200 (${exportarTelemetria().length})`);
borrarTelemetria();
ok(exportarTelemetria().length === 0, "…y se puede vaciar para empezar una medición limpia");

console.log("\n" + "═".repeat(100));
console.log("5 · EL CABLEADO · el rastro declara el escenario que DE VERDAD corrió");
console.log("═".repeat(100));
/* EL DEFECTO QUE CIERRA (medido 2026-08-21): los dos callers pasaban `scenario` como quinto argumento y
 * `_turnFromResult` no lo declaraba, así que se perdía y `proyectarDatoNegocio(undefined)` devolvía la firma de
 * «actual» ($100.0M) mientras la app corría `bonanza` ($99.9M). El instrumento que existe para detectar que dos
 * entornos miran negocios distintos estaba reportando el negocio equivocado. */
{
  const chat = fs.readFileSync(path.join(root, "src", "ui", "ChatADI.jsx"), "utf8");
  ok(/function _turnFromResult\(q, r, context, source, escenario\)/.test(chat),
    "`_turnFromResult` DECLARA el escenario que sus callers le pasan");
  ok(/_rastroDeRuta\(q, r, source, escenario\)/.test(chat), "…y se lo entrega al rastro");
  const llamadas = chat.match(/_turnFromResult\([^)]*\)/g) || [];
  const conEscenario = llamadas.filter((l) => /,\s*(scenario|escenario)\s*\)/.test(l));
  ok(conEscenario.length >= 2, `y los callers del camino natural/oráculo se lo pasan (${conEscenario.length} de ${llamadas.length})`);
  ok(/registrarTurno\(/.test(chat) && /from "\.\.\/adi\/telemetria\.js"/.test(chat),
    "cada turno se REGISTRA, no solo se imprime en la consola del navegador");
  ok(/_marcarInicioDeTurno\(\)/.test(chat), "…y el reloj del turno arranca cuando el usuario envía, que es la latencia que él espera");
}

console.log("\n" + "=".repeat(100));
console.log("6 · POR QUÉ VINO VACÍA · el hueco que costó cuatro fallas indiagnosticables");
console.log("=".repeat(100));
/* La causa de las cadenas vacías (el razonamiento comiéndose el tope de tokens) apareció recién cuando se
 * instrumentó el MOTIVO DE CORTE… pero solo en la consola del examen. En el producto, un turno vacío decía
 * «vacio» y nada más, así que entender uno costaba una corrida paga. Ahora el motivo viaja con el renglón. */
borrarTelemetria();
const vacio = registrarTurno({ estado: "vacio", via: "natural", llamadas: 2, ms: 9000, vetos: ["narracion-vacia"],
  cortes: ["max_tokens", "max_tokens"], vacias: 2, pregunta: "dime donde estoy perdiendo margen" });
ok(Array.isArray(vacio.cortes) && vacio.cortes.join() === "max_tokens,max_tokens",
  "el renglón guarda POR QUÉ cortó el proveedor en cada llamada");
ok(vacio.vacias === 2, "…y cuántas volvieron sin una sola letra");
ok(CAMPOS_TELEMETRIA.includes("cortes") && CAMPOS_TELEMETRIA.includes("vacias"),
  "los dos están DECLARADOS en el esquema: lo que no se declara, no se guarda");
{
  const r = resumenTelemetria();
  ok(r.turnosSinTexto === 1, `el resumen los cuenta (${r.turnosSinTexto})`);
  ok(/max_tokens/.test(r.texto) && /sin una sola letra/.test(r.texto),
    "…y lo dice en una línea legible, que es la diferencia entre un misterio y un arreglo");
}
ok(registrarTurno({ estado: "verde", via: "natural", cortes: ["end_turn"], vacias: 0 }).cortes[0] === "end_turn",
  "se registra SIEMPRE, no solo cuando falla: comparar una vacía contra una buena es el diagnóstico");

console.log("\n" + "=".repeat(100));
console.log("7 · SE PUEDE LEER · un registro que nadie abre no es observabilidad, es un archivo");
console.log("=".repeat(100));
{
  const chat = fs.readFileSync(path.join(root, "src", "ui", "ChatADI.jsx"), "utf8");
  ok(/window\.__ADI_SALUD__/.test(chat), "la app expone `__ADI_SALUD__()` para leer el resumen sin gastar una llamada");
  ok(/filas: \(\) => exportarTelemetria\(\)/.test(chat), "…y `.filas()`, que son los renglones que Supabase va a heredar");
  ok(/cortes: cortesDelTurno/.test(chat) && /cortes\.push\(String\(\(data && data\.stop\)/.test(chat),
    "el motivo de corte se recoge del gateway en CADA llamada del turno, no se pierde en el camino");
}

console.log(`\n── _telemetria_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail === 0 ? 0 : 1);
