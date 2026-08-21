/* === _guia_promesas_gate.mjs · EL CANDADO DE PROMESAS DE LA GUÍA (owner 2026-08-14 · contrato nuevo 2026-08-15) ==
 * EL DEFECTO QUE LO HACE NACER, verificado en vivo (captura del owner): la guía de inicio ofrecía con un click
 * «Si subo ventas 4%, ¿qué cambia?» y ADI respondió "No tengo corrida esa simulación". La guía prometió; el motor
 * no llegó. De ahí la regla permanente: NINGUNA pregunta entra a la guía sin una garantía DECLARADA de que el
 * primer click no termina en un decline — la garantía se decide ANTES de prometer, no después del primer fallo.
 *
 * QUÉ CAMBIÓ EL 2026-08-15. El owner sacó el atajo: «no deben usar una ruta demo, respuesta prearmada ni shortcut
 * … debe responder exactamente igual que si yo escribiera la pregunta manualmente». Antes la garantía era un SPEC
 * ENLATADO (un chip curado de HERO_CHIPS o el spec derivado del coercer) que se ejecutaba por una puerta propia.
 * Ya no hay spec: el click manda el PROMPT EXACTO al chat normal, así que la garantía tiene que ser de otra clase.
 *
 * LA GARANTÍA NUEVA, y es más dura que la anterior: cada pregunta de la guía es el prompt de un TURNO REAL de los
 * Exámenes 1, 2 y 3 — corridos en vivo, contra la carpeta real, con notario y ciclo de reparación — y ese turno
 * quedó REGISTRADO con su estado. Este gate abre el expediente y comprueba que el turno de origen existe y que
 * ADI lo respondió (`verde` o `reparado`). Un turno que cayó al SUPLENTE no puede ofrecerse con un click: sería
 * prometer justo lo que ya se midió que falla.
 *
 * QUÉ NO GARANTIZA, dicho sin disimulo: que la respuesta de hoy sea idéntica a la del examen. El camino natural
 * pasa por el cerebro y no es determinístico — la misma pregunta puede resolverse verde una vez y reparada la
 * siguiente. Lo que el expediente prueba es que la pregunta ES RESPONDIBLE con esta carpeta y este muro, no que
 * su salida esté congelada. Y la vía viva no se puede ejercitar acá: eso costaría llamadas (bloque 4).
 *
 * OFFLINE · CERO GASTO: expediente en disco + detectores puros + el bundle de la guía. Nada de este archivo
 * invoca al planificador ni al gateway; el candado de runtime de gates:offline aplica igual.
 */
import { JSDOM } from "jsdom";
import esbuild from "esbuild";
import { fileURLToPath, pathToFileURL } from "url";
import path from "path";
import fs from "fs";

let pass = 0, fail = 0;
const ok = (cond, label, detail) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ FALLO: ${label}${detail !== undefined ? ` — obtuvo ${detail}` : ""}`); }
};

// ── 0 · DOM mínimo (los módulos de UI del bundle esperan window/localStorage al cargarse) ──────────────────────
const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
try { Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true }); } catch {}
globalThis.localStorage = dom.window.localStorage;
globalThis.__ADI_PROFILE__ = "dev";
if (typeof dom.window.matchMedia !== "function") {
  dom.window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
}

const root = path.dirname(fileURLToPath(import.meta.url));
const bundlePath = path.join(root, `_guia_promesas_gate_bundle.tmp${process.pid}.mjs`);
await esbuild.build({
  entryPoints: [path.join(root, "_guia_promesas_gate_entry.jsx")],
  bundle: true, outfile: bundlePath, format: "esm", platform: "node", jsx: "automatic",
  external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "react/jsx-dev-runtime"],
  logLevel: "silent",
});
const ui = await import(pathToFileURL(bundlePath).href);
// vía 1 · declarar el tenant SOBRE ESTA instancia, y ANTES de leer GUIA_EJEMPLOS: la guía se re-arma en
// initTenant (su ejemplo de simulación nombra las cuentas del dato), así que destructurar antes congelaría la
// versión de la forma vacía — una pregunta que ningún usuario ve.
ui.initTenant(ui.TENANT_DEMO);
const { GUIA_EJEMPLOS, coerceFloor, detectScenarioIntent, detectPnlIntent } = ui;

console.log("═".repeat(100));
console.log("1 · NINGUNA PREGUNTA SE CAE EN SILENCIO · _TEMAS (fuente) ↔ GUIA_EJEMPLOS (lo ofrecido)");
console.log("═".repeat(100));
// _TEMAS no está exportado (es privado del módulo a propósito): se lee del FUENTE. Si el bloque cambia de forma,
// este parse devuelve otra cosa y las aserciones de abajo lo gritan — nunca falla abierto.
const fuente = fs.readFileSync(path.join(root, "src/ui/GuiaInicio.jsx"), "utf8");
const iTemas = fuente.indexOf("const _TEMAS = [");
const fTemas = fuente.indexOf("];", iTemas);
ok(iTemas > 0 && fTemas > iTemas, "el bloque _TEMAS existe en GuiaInicio.jsx");
const bloqueTemas = fuente.slice(iTemas, fTemas);
/* SE COTEJA POR TÍTULO, no por el texto del prompt (2026-08-21). El prompt dejó de ser siempre un literal: el
 * ejemplo de simulación nombraba «Falabella y Lider» —dos cuentas del demo escritas a mano en la pantalla de
 * bienvenida— y ahora recibe las dos cuentas más grandes DEL DATO. Cotejar por el texto del prompt ataría este
 * candado al dataset que esté cargado; el TÍTULO es lo que el usuario lee en la tarjeta, es literal en el fuente
 * y no nombra ninguna entidad. La correspondencia fuente↔ofrecido se sigue verificando por los dos lados. */
const temasSrc = [...bloqueTemas.matchAll(/titulo:\s*"([^"]+)"/g)].map((m) => m[1]);
ok(temasSrc.length >= 4, `_TEMAS declara ${temasSrc.length} preguntas (≥4)`);
for (const t of temasSrc) {
  ok(GUIA_EJEMPLOS.some((e) => e.titulo === t), `«${t.slice(0, 60)}…» declarada en _TEMAS SIGUE ofrecida en GUIA_EJEMPLOS`);
}
ok(GUIA_EJEMPLOS.every((e) => temasSrc.includes(e.titulo)), "…y la guía no ofrece nada que _TEMAS no declare");
// Y el prompt, sea literal o armado con el dato, tiene que llegar como TEXTO de verdad al usuario.
ok(GUIA_EJEMPLOS.every((e) => typeof e.q === "string" && e.q.trim().length > 40),
  "…y cada ejemplo llega con su prompt ya resuelto en texto (ninguno queda como plantilla sin armar)",
  JSON.stringify(GUIA_EJEMPLOS.map((e) => typeof e.q)));
// EL ATAJO, CERRADO POR LOS DOS LADOS · en el objeto y en el fuente. Un spec acá sería la ruta prearmada que el
// owner sacó: el click dejaría de ejercitar el camino natural y la guía volvería a ser una demo.
ok(GUIA_EJEMPLOS.every((e) => e.spec === undefined), "ningún ejemplo trae spec (el click manda el prompt, no un atajo)");
ok(!/\bspec\b/.test(bloqueTemas), "…y el bloque _TEMAS no nombra `spec` ni una vez en el fuente");

console.log("\n" + "═".repeat(100));
console.log("2 · LA GARANTÍA DECLARADA · cada pregunta es un TURNO REAL de examen, y ADI lo respondió");
console.log("═".repeat(100));
/* El mapa del candado. Cada entrada dice de qué turno de qué examen sale la pregunta; `exacta` distingue las que
 * se ofrecen palabra por palabra de las que el owner tuvo que reescribir, y en esos dos casos el POR QUÉ queda
 * escrito. Agregar una pregunta a la guía exige agregar su entrada acá — con su turno de origen medido, no con
 * un "ya veremos". Los estados salen del expediente en disco, no de la memoria de nadie. */
const ESTADOS_OK = new Set(["verde", "reparado"]);
// La llave es el TÍTULO (ver el bloque 1): es lo que el usuario lee, es literal en el fuente y no nombra
// entidades, así que no se mueve cuando cambia el dataset cargado.
const CANDADO = new Map([
  ["¿Qué clientes venden mucho pero están bajo benchmark?",
    { origen: "_examen1_consolidado.json", turno: 0, exacta: true, redes: ["coerce:diagnose"] }],
  ["¿Dónde tengo capital inmovilizado o frenado?",
    { origen: "_examen2_consolidado.json", turno: 0, exacta: true, redes: ["coerce:inventory"] }],
  ["¿Cómo va el año contra el anterior?",
    { origen: "_examen3_consolidado.json", turno: 1, exacta: false, redes: [],
      razon: "el turno del examen abría con «Entonces hazlo anual…» — una anáfora que un primer click no tiene cómo resolver" }],
  ["Si bajo 2% la carga comercial, ¿qué cambia?",
    { origen: "_examen3_consolidado.json", turno: 4, exacta: false, redes: ["coerce:overview"],
      razon: "el turno del examen traía los nombres mal escritos a propósito («falabela», «lider») para medir la corrección; acá se ofrece la versión limpia, y las cuentas que nombra ya no están escritas a mano: salen del dato activo" }],
]);

// palabras con carga (≥5 letras, sin acento) — sirve para probar que el origen declarado es el MISMO tema, no uno
// cualquiera. Es un piso deliberadamente bajo: lo que se verifica es que nadie declare un origen de adorno.
const _carga = (s) => new Set(String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .split(/[^a-z0-9]+/).filter((w) => w.length >= 5));

for (const ej of GUIA_EJEMPLOS) {
  const entrada = CANDADO.get(ej.titulo);
  ok(!!entrada, `«${ej.titulo}» tiene garantía DECLARADA en este candado — una pregunta nueva sin garantía no entra a la guía`);
  if (!entrada) continue;
  const ruta = path.join(root, entrada.origen);
  const hay = fs.existsSync(ruta);
  ok(hay, `«${ej.titulo}» · el expediente ${entrada.origen} existe`);
  if (!hay) continue;
  let exp = null;
  try { exp = JSON.parse(fs.readFileSync(ruta, "utf8")); } catch { /* ilegible → la aserción de abajo lo dice */ }
  const turno = exp && Array.isArray(exp.turnos) ? exp.turnos[entrada.turno] : null;
  ok(!!turno, `…y trae el turno ${entrada.turno} («${(exp && exp.titulo) || "?"}»)`);
  if (!turno) continue;
  console.log(`  · origen: ${entrada.origen} t${entrada.turno} [${turno.estado}] «${String(turno.q).slice(0, 78)}…»`);
  ok(ESTADOS_OK.has(turno.estado),
    `…y ADI LO RESPONDIÓ en vivo (estado «${turno.estado}») — un turno que cayó al suplente no se ofrece con un click`);
  if (entrada.exacta) {
    ok(String(turno.q).trim() === ej.q, "…con el prompt IDÉNTICO al que se ofrece (se mide una cosa y se ofrece la misma)");
  } else {
    ok(String(turno.q).trim() !== ej.q, `…reescrita respecto del turno original, como declara la entrada: ${entrada.razon}`);
    const a = _carga(turno.q), b = _carga(ej.q);
    const comunes = [...b].filter((w) => a.has(w));
    ok(comunes.length >= 3,
      `…y sigue siendo la MISMA pregunta que se midió (${comunes.length} palabras con carga en común: ${comunes.slice(0, 6).join(", ")})`);
  }
}
for (const t of CANDADO.keys()) {
  ok(GUIA_EJEMPLOS.some((e) => e.titulo === t), `la garantía declarada para «${t.slice(0, 50)}…» no quedó huérfana (la pregunta sigue en la guía)`);
}

console.log("\n" + "═".repeat(100));
console.log("3 · UN CLICK ES UN PRIMER TURNO · el prompt se basta solo y nombra su propio sujeto");
console.log("═".repeat(100));
/* Los exámenes son CONVERSACIONES: la mitad de sus turnos se apoya en el anterior. Un prompt así, disparado con
 * un click sobre un chat vacío, deja a ADI sin antecedente y lo correcto sería que preguntara de qué le hablan —
 * o sea, el primer turno del usuario nuevo se gasta en una repregunta. Por eso los prompts ofrecidos se revisan
 * como lo que son: la PRIMERA cosa que ADI va a leer. */
const ANAFORA = /^\s*(entonces|ahora|sobre (esos|esas|eso)|de (esos|esas)|con (eso|ese|esa)|y (ahora|entonces))\b/i;
const PRONOMBRE = /\b(esos|esas|ese\s+sku|esa\s+cuenta|ahí|dicho\s+eso)\b/i;
for (const ej of GUIA_EJEMPLOS) {
  ok(!ANAFORA.test(ej.q), `«${ej.titulo}» no abre con una anáfora`);
  ok(!PRONOMBRE.test(ej.q), "…ni apunta a un antecedente que en el primer turno no existe");
}

console.log("\n" + "═".repeat(100));
console.log("4 · EL LÍMITE, A LA VISTA · lo que las redes determinísticas alcanzan, medido y no supuesto");
console.log("═".repeat(100));
/* HASTA DÓNDE LLEGA ESTE GATE. Con el oráculo encendido —producción hoy— las cuatro preguntas viajan como texto
 * libre al cerebro: ninguna red determinística las "reserva", y su garantía es el expediente del bloque 2. Este
 * bloque deja MEDIDO lo que el piso reclama cuando el gateway se cae, para dos cosas: (a) saber qué ve un usuario
 * en ese caso, y (b) que si mañana una red empieza a reclamar una de estas preguntas, alguien lo note acá en vez
 * de descubrirlo en pantalla.
 *
 * LO MEDIDO HOY, y las dos degradaciones se declaran en vez de taparse:
 *   · Comercial → coerce:diagnose  · Inventario → coerce:inventory  (los dos contestan con cifras, 1.7K y 1.1K car.)
 *   · Períodos  → NINGUNA red. Con el gateway caído devuelve 241 caracteres SIN cifras ("no pude armar la lectura
 *     de ventas para ese corte"). Es una respuesta honesta, no un decline, pero no es la comparación prometida:
 *     esta pregunta DEPENDE del cerebro.
 *   · Simulación → coerce:overview, que es una lectura general, NO una simulación. Con el gateway caído el click
 *     contesta algo correcto sobre el valor de la venta, pero no baja los 2 puntos que se pidieron. */
for (const ej of GUIA_EJEMPLOS) {
  const esc = detectScenarioIntent(ej.q), pnl = detectPnlIntent(ej.q), piso = coerceFloor(ej.q, false, null);
  const redes = [esc && esc.kind && esc.kind !== "none" ? `escenario:${esc.kind}` : null, pnl ? "p&l" : null,
    piso && piso.operation ? `coerce:${piso.operation}` : null].filter(Boolean);
  console.log(`  · «${ej.titulo}» → ${redes.length ? redes.join(" · ") : "ninguna red del piso la reclama — viaja entera al cerebro"}`);
  const esperado = (CANDADO.get(ej.titulo) || {}).redes;
  ok(Array.isArray(esperado) && esperado.join("|") === redes.join("|"),
    `«${ej.titulo}» · la cobertura determinística es la DECLARADA (${esperado ? esperado.join(" · ") || "ninguna" : "sin declarar"})`,
    redes.join(" · ") || "ninguna");
}

try { fs.unlinkSync(bundlePath); } catch { /* el tmp no bloquea el veredicto */ }
console.log(`\n── _guia_promesas_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail === 0 ? 0 : 1);
