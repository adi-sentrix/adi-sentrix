/* === _guia_inicio_gate.mjs · LA GUÍA DE INICIO (owner 2026-08-07) ================================================
 * Turno de trabajo: "la app abre en un chat vacío y el usuario no sabe qué puede preguntar ni para qué sirve el panel".
 *
 * Monta la App REAL (jsdom + testing-library, mismo patrón que _evidence_spec_views_gate) — no un harness que
 * imite el cableado — y verifica los cinco hechos que el owner pidió, más el que sostiene a todos:
 *
 *   1. PRIMERA VISITA · sin marca en localStorage la guía se abre SOLA, en el paso 1, con la frase madre.
 *   2. SE PUEDE SALTAR · en CADA uno de los 3 pasos, por "Saltar", por el ✕ y por Escape. Y no bloquea:
 *      aria-modal="false" y el header sigue vivo detrás.
 *   3. "NO VOLVER A MOSTRAR" · persiste EN EL ACTO (no al cerrar) y suprime la apertura automática.
 *   4. EL BOTÓN DEL HEADER la reabre — con la marca puesta, y con cualquiera de los dos valores.
 *   5. CADA EJEMPLO DISPARA UNA PREGUNTA QUE EL MOTOR RESPONDE, NO UN DECLINE. Es el criterio más caro del turno:
 *      una guía que promete algo que ADI no contesta convierte el primer turno del usuario en un "no la tengo",
 *      peor que no haber guiado. Se prueba por las DOS puertas que el click puede tomar:
 *        · puerta A · oráculo ON  → submitSpec delega en submit(texto) → piso determinístico (buildAdiTurn)
 *        · puerta B · oráculo OFF → spec enlatado por answerConversational (lo que corre en producción hoy)
 *      Y además, en la App montada, que el click CIERRE la guía y deje el turno puesto en el transcript.
 *   6. LOS EJEMPLOS NO SON INVENTADOS · cada uno es, campo por campo, un chip de HERO_CHIPS. Si alguien renombra
 *      un chip, la guía degrada honesto (muestra uno menos) y este gate falla diciendo exactamente cuál se perdió.
 *
 * OFFLINE · CERO GASTO. Todo el camino que se ejercita es determinístico (ADI_LLM_ENABLED es false en Node: el
 * global de Vite no existe). El ÚNICO punto de la App que sale a la red es el chequeo de acceso del arranque, y
 * acá se lo desarma BORRANDO la capacidad de red del proceso (ver el bloque 0) — que es más fuerte que bloquearla,
 * no más débil. Este gate no toca ni restaura el candado de scripts/offline-guard.mjs.
 */
import { JSDOM } from "jsdom";
import esbuild from "esbuild";
import { fileURLToPath, pathToFileURL } from "url";
import path from "path";

let pass = 0, fail = 0;
const ok = (cond, label) => { if (cond) { pass++; console.log(`  ✓ ${label}`); } else { fail++; console.log(`  ✗ FALLO: ${label}`); } };

// ── 0 · DOM global + perfil "dev" ───────────────────────────────────────────────────────────────────────────────
const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
try { Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true }); } catch {}
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.Node = dom.window.Node;
globalThis.getComputedStyle = dom.window.getComputedStyle;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.localStorage = dom.window.localStorage;
globalThis.__ADI_PROFILE__ = "dev";
// jsdom no siempre trae matchMedia; App.jsx lo usa para decidir el layout móvil del panel Sentrix. Shim mínimo
// (siempre "no móvil"): esto es una carencia del entorno de prueba, no del producto.
if (typeof dom.window.matchMedia !== "function") {
  dom.window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
}
// LA RED, BORRADA (no bloqueada). El candado de gates:offline deja `globalThis.fetch` puesto como una función que
// MATA el proceso (exit 97) — correcto para cazar a un gate que se cree offline y no lo es, pero acá haría morir a
// la App en su chequeo de acceso del arranque, que es una llamada legítima y esperada de la App real. Sacando la
// referencia, esa llamada tira ReferenceError y cae en el `catch` que App.jsx ya tiene escrito para ese caso
// ("gateway caído → no bloquear el piso"): la App arranca igual, y la red queda MENOS disponible que con el
// candado puesto, no más. Las otras cuatro capas del candado (http · https · net.Socket · dns) quedan intactas:
// si algo de este árbol intentara salir por ahí, el proceso muere igual.
delete globalThis.fetch;

const root = path.dirname(fileURLToPath(import.meta.url));
const bundlePath = path.join(root, `_guia_inicio_gate_bundle.tmp${process.pid}.mjs`);
await esbuild.build({
  entryPoints: [path.join(root, "_guia_inicio_gate_entry.jsx")],
  bundle: true, outfile: bundlePath, format: "esm", platform: "node", jsx: "automatic",
  external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "react/jsx-dev-runtime"],
  logLevel: "silent",
});
const ui = await import(pathToFileURL(bundlePath).href);
const React = (await import("react")).default;
const { render, fireEvent, cleanup, act } = await import("@testing-library/react");

const { GUIA_EJEMPLOS, GUIA_KEY, GUIA_VISTA, GUIA_NUNCA, HERO_CHIPS, buildAdiTurn, NOT_YET_TEXT, answerConversational, resetPnlDraft } = ui;

// ── helpers ─────────────────────────────────────────────────────────────────────────────────────────────────────
// LIMPIAR ES VOLVER A SER UN USUARIO NUEVO, no solo vaciar localStorage. El flujo del P&L guarda un borrador en
// memoria del módulo: preguntar dos veces por el P&L en el mismo proceso da respuestas distintas (la segunda
// CONTINÚA el flujo: "nombrame tus gastos"). Sin este reset, el bloque 4 medía un click sobre estado sucio dejado
// por el bloque 3 y daba por buena una respuesta de 196 caracteres que no es la lectura que ve alguien que recién
// llega — que es exactamente lo que este gate existe para verificar.
const limpiar = () => {
  try { dom.window.localStorage.clear(); } catch { /* */ }
  try { resetPnlDraft(); } catch { /* */ }
};
const $ = (c, id) => c.querySelector(`[data-testid="${id}"]`);
const hayGuia = (c) => !!$(c, "guia-inicio");
const pasoActual = (c) => { const p = $(c, "guia-paso"); return p ? Number(p.getAttribute("data-paso")) : null; };

// La App real, con los efectos y las microtareas ya drenados (el chequeo de acceso resuelve por su `catch`).
async function montarApp() {
  let utils;
  await act(async () => { utils = render(React.createElement(ui.App, { animate: false })); });
  return utils;
}
const clic = async (el) => { await act(async () => { fireEvent.click(el); }); };
// avanza N pasos con "Siguiente"
const avanzar = async (c, n) => { for (let i = 0; i < n; i++) await clic($(c, "guia-siguiente")); };

// QUÉ ES UN DECLINE. `text == null` es el deferido explícito del motor (la UI pinta NOT_YET_TEXT en su lugar);
// las rutas honestas de no-cobertura y el `_degrade` son las otras formas de "no te lo puedo contestar". Se exige
// además materia real: una lectura de negocio SIEMPRE trae al menos una cifra ($ o %).
const RUTAS_DECLINE = /^(not_yet_extracted|global_honest_fallback|honest_fallback|qi_inventory_avisar|honesty_guard|smart_guide)/;
function porQueEsDecline(r) {
  if (!r) return "resultado nulo";
  if (r.text == null) return "text == null (deferido → NOT_YET_TEXT)";
  if (r._degrade) return `_degrade = ${JSON.stringify(r._degrade).slice(0, 60)}`;
  if (RUTAS_DECLINE.test(r.route || "")) return `ruta de no-cobertura: ${r.route}`;
  const t = String(r.text);
  if (t.includes(NOT_YET_TEXT.slice(0, 40))) return "el texto ES el decline de la UI";
  if (t.trim().length < 60) return `texto demasiado corto (${t.trim().length} car.)`;
  if (!/[$%]/.test(t)) return "sin una sola cifra ($ o %) — no es una lectura de negocio";
  return null;
}

console.log("═".repeat(100));
console.log("1 · PRIMERA VISITA · la guía se abre SOLA, en el paso 1, con la división del trabajo");
console.log("═".repeat(100));
{
  limpiar();
  const { container } = await montarApp();
  ok(hayGuia(container), "la guía está montada sin que nadie la pida (localStorage vacío = primera visita)");
  ok(pasoActual(container) === 1, `arranca en el paso 1 (obtuvo: ${pasoActual(container)})`);
  ok(container.textContent.includes("Sentrix muestra el dato. ADI lo interpreta."),
    "la frase madre está a la vista — el vacío se llena con la división del trabajo, no con un tour de features");
  ok(container.textContent.includes("Cuando ADI nombra una cuenta, Sentrix la pinta") &&
     container.textContent.includes("Cuando tocás una fila del cuadro, se la podés preguntar a ADI"),
    "el ida y vuelta está contado en las DOS direcciones (ADI→Sentrix y Sentrix→ADI)");
  ok(!!$(container, "guia-abrir"), "el botón permanente \"¿Cómo funciona?\" está en el header");
  cleanup();
}

console.log("\n" + "═".repeat(100));
console.log("2 · LOS EJEMPLOS NO SON INVENTADOS · cada uno es un chip verificado de HERO_CHIPS");
console.log("═".repeat(100));
{
  ok(GUIA_EJEMPLOS.length === 3, `la guía ofrece 3 ejemplos (obtuvo: ${GUIA_EJEMPLOS.length}) — si un chip se renombró, acá se pierde`);
  for (const ej of GUIA_EJEMPLOS) {
    const chip = HERO_CHIPS.find((c) => c.q === ej.q);
    ok(!!chip, `«${ej.q}» sigue existiendo en HERO_CHIPS`);
    ok(!!chip && JSON.stringify(chip.spec) === JSON.stringify(ej.spec),
      `«${ej.q}» usa el spec de HERO_CHIPS SIN modificar (una sola fuente de preguntas de entrada)`);
    ok(typeof ej.glosa === "string" && ej.glosa.length > 10, `«${ej.q}» trae su bajada de qué devuelve`);
  }
}

console.log("\n" + "═".repeat(100));
console.log("3 · EL MOTOR RESPONDE CADA EJEMPLO · las DOS puertas que el click puede tomar · NUNCA un decline");
console.log("═".repeat(100));
{
  for (const ej of GUIA_EJEMPLOS) {
    // cada ejemplo se mide COMO PRIMER TURNO de alguien que recién llega, no arrastrando el estado del anterior
    limpiar();
    // puerta A · oráculo ON: submitSpec delega en submit(texto) → piso determinístico
    const turnoA = buildAdiTurn(ej.q, {}, "bonanza");
    const rA = { text: turnoA.adiMsg.text, route: turnoA.adiMsg.route, _degrade: turnoA.adiMsg._degrade };
    const malA = porQueEsDecline(rA);
    ok(!malA, `[A · texto libre] «${ej.q}» → responde (ruta ${rA.route}, ${rA.text ? rA.text.length : 0} car.)${malA ? " · " + malA : ""}`);
    // puerta B · oráculo OFF (producción hoy): el spec enlatado por el seam conversacional
    limpiar();
    const rB = answerConversational(ej.spec, {}, { scenario: "bonanza" });
    const malB = porQueEsDecline(rB);
    ok(!malB, `[B · spec enlatado] «${ej.q}» → responde (ruta ${rB && rB.route}, ${rB && rB.text ? rB.text.length : 0} car.)${malB ? " · " + malB : ""}`);
  }
}

console.log("\n" + "═".repeat(100));
console.log("4 · CLICK EN UN EJEMPLO · la guía se cierra y la explicación se convierte en el PRIMER TURNO");
console.log("═".repeat(100));
for (const modo of [{ nombre: "oráculo ON (dev)", oracle: null }, { nombre: "oráculo OFF (producción)", oracle: "0" }]) {
  limpiar();
  if (modo.oracle !== null) dom.window.localStorage.setItem("adi_oracle", modo.oracle);
  const { container } = await montarApp();
  await avanzar(container, 1);
  ok(pasoActual(container) === 2, `[${modo.nombre}] "Siguiente" lleva al paso 2 (los ejemplos)`);
  const btn = $(container, "guia-ejemplo-0");
  ok(!!btn && btn.textContent.includes(GUIA_EJEMPLOS[0].q), `[${modo.nombre}] el ejemplo 0 se renderiza con su pregunta`);
  await clic(btn);
  ok(!hayGuia(container), `[${modo.nombre}] la guía se CIERRA al tocar el ejemplo`);
  ok(container.textContent.includes(GUIA_EJEMPLOS[0].q), `[${modo.nombre}] la pregunta quedó puesta como turno del usuario`);
  const burbujas = [...container.querySelectorAll('[data-testid="adi-bubble"]')];
  ok(burbujas.length === 1, `[${modo.nombre}] ADI contestó exactamente una vez (obtuvo: ${burbujas.length})`);
  const respuesta = burbujas.length ? burbujas[0].textContent : "";
  ok(!respuesta.includes(NOT_YET_TEXT.slice(0, 40)), `[${modo.nombre}] la respuesta NO es el decline de la UI`);
  // LECTURA DE NEGOCIO, no un pedido de datos al usuario. El umbral y la cifra en $ no son decorativos: el flujo
  // guiado del P&L ("nombrame tus gastos") también es una respuesta válida del motor, pero como PRIMER turno de la
  // guía no muestra nada — pasa un `%` suelto y se queda en ~200 caracteres. Esta aserción distingue las dos.
  ok(respuesta.length > 300 && /\$\s?\d/.test(respuesta),
    `[${modo.nombre}] la respuesta es una lectura con cifras en $, no un pedido de datos (${respuesta.length} car.)`);
  cleanup();
}
limpiar();

console.log("\n" + "═".repeat(100));
console.log("5 · SE PUEDE SALTAR EN CUALQUIER PASO · y no bloquea (la app sigue viva detrás)");
console.log("═".repeat(100));
for (const p of [0, 1, 2]) {
  limpiar();
  const { container } = await montarApp();
  await avanzar(container, p);
  ok(pasoActual(container) === p + 1, `paso ${p + 1} en pantalla`);
  ok(!!$(container, "guia-saltar") && !!$(container, "guia-cerrar"), `paso ${p + 1}: "Saltar" y ✕ disponibles`);
  ok(!!$(container, "guia-abrir"), `paso ${p + 1}: el header sigue vivo detrás (no es un modal que bloquea)`);
  await clic($(container, "guia-saltar"));
  ok(!hayGuia(container), `paso ${p + 1}: "Saltar" la cierra`);
  cleanup();
}
{
  limpiar();
  const { container } = await montarApp();
  ok($(container, "guia-inicio").getAttribute("aria-modal") === "false", "aria-modal=\"false\" — declara que NO bloquea la app");
  await clic($(container, "guia-cerrar"));
  ok(!hayGuia(container), "el ✕ también la cierra");
  cleanup();

  limpiar();
  const r2 = await montarApp();
  await act(async () => { fireEvent.keyDown(dom.window, { key: "Escape" }); });
  ok(!hayGuia(r2.container), "Escape también la cierra (un panel que no se saca con el teclado es un panel que bloquea)");
  cleanup();
}

console.log("\n" + "═".repeat(100));
console.log("6 · \"NO VOLVER A MOSTRAR\" · persiste EN EL ACTO y suprime la apertura automática");
console.log("═".repeat(100));
{
  limpiar();
  const { container } = await montarApp();
  await clic($(container, "guia-nunca"));
  ok(dom.window.localStorage.getItem(GUIA_KEY) === GUIA_NUNCA,
    `la marca se guarda AL TILDAR, sin esperar el cierre (obtuvo: ${dom.window.localStorage.getItem(GUIA_KEY)}) — si el usuario cierra la pestaña, su decisión ya está tomada`);
  await clic($(container, "guia-saltar"));
  ok(dom.window.localStorage.getItem(GUIA_KEY) === GUIA_NUNCA, "cerrar después NO degrada la marca a \"vista\"");
  cleanup();

  const r2 = await montarApp();   // segunda visita, misma marca
  ok(!hayGuia(r2.container), "con \"no volver a mostrar\" puesto, la guía NO se abre sola");
  cleanup();
}
{
  // el otro camino: cerrar sin tildar nada tampoco la trae de vuelta ("primera visita se abre sola; después, solo si la piden")
  limpiar();
  const { container } = await montarApp();
  await clic($(container, "guia-saltar"));
  ok(dom.window.localStorage.getItem(GUIA_KEY) === GUIA_VISTA, `saltar deja la marca "vista" (obtuvo: ${dom.window.localStorage.getItem(GUIA_KEY)})`);
  cleanup();
  const r2 = await montarApp();
  ok(!hayGuia(r2.container), "segunda visita: no se abre sola");
  cleanup();
}

console.log("\n" + "═".repeat(100));
console.log("7 · EL BOTÓN DEL HEADER LA REABRE · con cualquiera de las dos marcas puestas");
console.log("═".repeat(100));
for (const marca of [GUIA_VISTA, GUIA_NUNCA]) {
  limpiar();
  dom.window.localStorage.setItem(GUIA_KEY, marca);
  const { container } = await montarApp();
  ok(!hayGuia(container), `[marca="${marca}"] no se abre sola`);
  await clic($(container, "guia-abrir"));
  ok(hayGuia(container), `[marca="${marca}"] "¿Cómo funciona?" la reabre`);
  ok(pasoActual(container) === 1, `[marca="${marca}"] reabre desde el paso 1`);
  await clic($(container, "guia-abrir"));
  ok(!hayGuia(container), `[marca="${marca}"] el mismo botón la vuelve a cerrar (toggle)`);
  ok(dom.window.localStorage.getItem(GUIA_KEY) === marca, `[marca="${marca}"] reabrirla no pisa la preferencia guardada`);
  cleanup();
}
limpiar();

console.log("\n" + "═".repeat(100));
console.log("8 · EL PASO 3 nombra dónde vive la evidencia (la Mesa bajo cada respuesta · la Ficha con el detalle)");
console.log("═".repeat(100));
{
  limpiar();
  const { container } = await montarApp();
  await avanzar(container, 2);
  ok(pasoActual(container) === 3, "paso 3 en pantalla");
  const t = container.textContent;
  ok(/Debajo de cada respuesta aparece un botón que abre/.test(t) && t.includes("Sentrix"), "nombra el botón de evidencia bajo cada respuesta");
  ok(t.includes("Ficha") && /ahí vive el detalle/.test(t), "nombra la Ficha como el lugar del detalle de una entidad");
  ok(t.includes("Mesa de control"), "nombra la Mesa de control del header");
  await clic($(container, "guia-siguiente"));
  ok(!hayGuia(container), "\"Empezar\" cierra la guía en el último paso");
  cleanup();
}
limpiar();

console.log(`\n── _guia_inicio_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail === 0 ? 0 : 1);
