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
import fs from "fs";   // el bloque 9 comprueba contra el CÓDIGO que los cruces que la guía promete existen de verdad

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

const { GUIA_EJEMPLOS, GUIA_KEY, GUIA_VISTA, GUIA_NUNCA, GUIA_CAPITULOS, GUIA_PASOS, HERO_CHIPS, buildAdiTurn, NOT_YET_TEXT, answerConversational, resetPnlDraft, coerceSpec, coerceFloor } = ui;

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
const _vacioSpec = (o) => !o || typeof o !== "object" || Object.keys(o).length === 0;
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
// salta directo por el ÍNDICE · con seis capítulos, llegar al último a fuerza de "Siguiente" no prueba nada que el
// recorrido lineal no pruebe ya, y hace que cada aserción dependa de las cinco anteriores.
const irA = async (c, i) => { await clic($(c, `guia-indice-${i}`)); };

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
     container.textContent.includes("Cuando tocas una fila del cuadro, se la puedes preguntar a ADI"),
    "el ida y vuelta está contado en las DOS direcciones (ADI→Sentrix y Sentrix→ADI)");
  ok(!!$(container, "guia-abrir"), "el botón permanente \"¿Cómo funciona?\" está en el header");
  cleanup();
}

console.log("\n" + "═".repeat(100));
console.log("2 · LOS EJEMPLOS NO SON INVENTADOS · un tema por ejemplo, y el spec DERIVADO, nunca escrito a mano");
console.log("═".repeat(100));
{
  // El owner pidió un ejemplo por tema (2026-08-10). La invariante no cambió, el mecanismo se amplió: el spec sale
  // de HERO_CHIPS si hay chip, y si no, del MISMO coercer determinístico del texto libre. Ninguno se escribe a mano.
  ok(GUIA_EJEMPLOS.length === 4, `la guía ofrece 4 ejemplos por tema (obtuvo: ${GUIA_EJEMPLOS.length}) — si uno deja de producir spec, acá se pierde`);
  const temas = GUIA_EJEMPLOS.map((e) => e.tema);
  ok(new Set(temas).size === temas.length, `un ejemplo por tema, sin repetir (${temas.join(" · ")})`);
  for (const ej of GUIA_EJEMPLOS) {
    ok(typeof ej.tema === "string" && ej.tema.length > 2, `«${ej.q}» declara su tema`);
    ok(!_vacioSpec(ej.spec), `«${ej.q}» trae spec (fuente: ${ej.fuente})`);
    if (ej.fuente === "hero") {
      const chip = HERO_CHIPS.find((c) => c.q === ej.q);
      ok(!!chip && JSON.stringify(chip.spec) === JSON.stringify(ej.spec),
        `«${ej.q}» usa el spec de HERO_CHIPS SIN modificar (una sola fuente de preguntas de entrada)`);
    } else {
      // el spec derivado tiene que seguir siendo EXACTAMENTE lo que el coercer devuelve para ESE texto: si alguien
      // lo edita a mano, la guía deja de prometer lo que la app hace y este candado lo caza.
      const derivado = coerceFloor(ej.q, {}, {});
      ok(JSON.stringify(derivado) === JSON.stringify(ej.spec),
        `«${ej.q}» usa el spec que el coercer deriva de su propio texto, sin retoques`);
    }
    ok(typeof ej.glosa === "string" && ej.glosa.length > 10, `«${ej.q}» trae su bajada de qué devuelve`);
  }
  /* LAS DOS AUSENCIAS, MEDIDAS · el owner pidió seis temas y hay cuatro. Que falten no es un olvido: las dos que
   * no están fueron probadas y no se pueden ofrecer hoy. El gate deja constancia para que, cuando el motor cambie,
   * alguien las vuelva a probar en vez de asumir que siguen rotas. */
  const ficha = "Explicame Falabella y qué debería revisar primero.";
  ok(_vacioSpec(coerceFloor(ficha, {}, {})) && _vacioSpec(coerceSpec(ficha, {}, {})),
    "FICHA sigue sin spec en los dos coercers · con el oráculo apagado el click daría «No recibí un pedido» — por eso no se ofrece");
  const cruce = "¿Puedo sumar venta anual con capital inmovilizado?";
  const rCruce = buildAdiTurn(cruce, {}, "actual").adiMsg;
  const rCapital = buildAdiTurn("¿Dónde tengo capital inmovilizado?", {}, "actual").adiMsg;
  ok(String(rCruce.text || "") === String(rCapital.text || ""),
    "CRUCES sigue devolviendo la MISMA respuesta que «¿Dónde tengo capital inmovilizado?» · no contesta lo que se le pregunta, por eso no se ofrece");
  ok(!GUIA_EJEMPLOS.some((e) => e.q === ficha || e.q === cruce), "…y ninguna de las dos está ofrecida en la guía");
}

console.log("\n" + "═".repeat(100));
console.log("3 · EL MOTOR RESPONDE CADA EJEMPLO · las DOS puertas que el click puede tomar · NUNCA un decline");
console.log("═".repeat(100));
{
  /* LA EXCEPCIÓN DEL FLUJO GUIADO (owner 2026-08-10, al pedir un ejemplo por tema).
   * "¿Cuánto me queda después de gastos?" NO devuelve cifras, y es correcto que no las devuelva: sin líneas de
   * gasto declaradas no hay resultado que afirmar, así que el motor las PIDE en vez de inventarlas. Eso es la
   * regla 3 ocurriendo en el primer turno, no un decline. Antes esta pregunta quedaba fuera de la guía por este
   * mismo motivo; ahora entra porque es LA pregunta del tema Resultado, y su glosa avisa exactamente qué pasa.
   * Lo que NO se relaja: la ruta tiene que ser una ruta de respuesta (no de no-cobertura) y el texto, sustancial. */
  const FLUJO_GUIADO = new Set(["¿Cuánto me queda después de gastos?"]);
  for (const ej of GUIA_EJEMPLOS) {
    const guiado = FLUJO_GUIADO.has(ej.q);
    const juzgar = (r) => {
      const razon = porQueEsDecline(r);
      // al ejemplo del flujo guiado se le perdona SOLO la falta de cifras, nada más
      if (guiado && razon && /sin una sola cifra/.test(razon)) return null;
      return razon;
    };
    // cada ejemplo se mide COMO PRIMER TURNO de alguien que recién llega, no arrastrando el estado del anterior
    limpiar();
    // puerta A · oráculo ON: submitSpec delega en submit(texto) → piso determinístico
    const turnoA = buildAdiTurn(ej.q, {}, "bonanza");
    const rA = { text: turnoA.adiMsg.text, route: turnoA.adiMsg.route, _degrade: turnoA.adiMsg._degrade };
    const malA = juzgar(rA);
    ok(!malA, `[A · texto libre] «${ej.q}» → responde (ruta ${rA.route}, ${rA.text ? rA.text.length : 0} car.${guiado ? " · flujo guiado" : ""})${malA ? " · " + malA : ""}`);
    // puerta B · oráculo OFF (producción hoy): el spec enlatado por el seam conversacional
    limpiar();
    const rB = answerConversational(ej.spec, {}, { scenario: "bonanza" });
    const malB = juzgar(rB);
    ok(!malB, `[B · spec enlatado] «${ej.q}» → responde (ruta ${rB && rB.route}, ${rB && rB.text ? rB.text.length : 0} car.${guiado ? " · flujo guiado" : ""})${malB ? " · " + malB : ""}`);
    // …y el que abre el flujo guiado tiene que DECIRLO en su glosa: el usuario no puede descubrirlo al hacer click
    if (guiado) ok(/te pide|arma tu P&L/i.test(ej.glosa), `«${ej.q}» avisa en su bajada que abre el flujo guiado`);
  }
}

console.log("\n" + "═".repeat(100));
console.log("4 · CLICK EN UN EJEMPLO · la guía se cierra y la explicación se convierte en el PRIMER TURNO");
console.log("═".repeat(100));
for (const modo of [{ nombre: "oráculo ON (dev)", oracle: null }, { nombre: "oráculo OFF (producción)", oracle: "0" }]) {
  limpiar();
  if (modo.oracle !== null) dom.window.localStorage.setItem("adi_oracle", modo.oracle);
  const { container } = await montarApp();
  await avanzar(container, 2);
  ok(pasoActual(container) === 3, `[${modo.nombre}] "Siguiente" lleva al capítulo 3 (los ejemplos)`);
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
for (const p of [...Array(GUIA_PASOS).keys()]) {
  limpiar();
  const { container } = await montarApp();
  await irA(container, p);
  ok(pasoActual(container) === p + 1, `capítulo ${p + 1} («${GUIA_CAPITULOS[p]}») en pantalla`);
  ok(!!$(container, "guia-saltar") && !!$(container, "guia-cerrar"), `capítulo ${p + 1}: "Saltar" y ✕ disponibles`);
  ok(!!$(container, "guia-abrir"), `capítulo ${p + 1}: el header sigue vivo detrás (no es un modal que bloquea)`);
  await clic($(container, "guia-saltar"));
  ok(!hayGuia(container), `capítulo ${p + 1}: "Saltar" la cierra`);
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
console.log("8 · EL CAPÍTULO 5 nombra dónde vive la evidencia (la Mesa bajo cada respuesta · la Ficha con el detalle)");
console.log("═".repeat(100));
{
  limpiar();
  const { container } = await montarApp();
  await irA(container, 4);
  ok(pasoActual(container) === 5, "capítulo 5 en pantalla");
  const t = container.textContent;
  ok(/Debajo de cada respuesta aparece un botón que abre/.test(t) && t.includes("Sentrix"), "nombra el botón de evidencia bajo cada respuesta");
  ok(t.includes("Ficha") && /ahí vive el detalle/.test(t), "nombra la Ficha como el lugar del detalle de una entidad");
  ok(t.includes("Mesa de control"), "nombra la Mesa de control del header");
  // CÓMO SE ABRE SENTRIX · el owner pidió que se dijera, y son las cuatro caras que tiene de verdad
  ok(/Comercial/.test(t) && /Capital/.test(t) && /Resultado/.test(t), "nombra las caras de la Mesa (adónde llega el usuario cuando la abre)");
  cleanup();
}

/* ── 9 · EL ÍNDICE Y LOS CAPÍTULOS NUEVOS (owner 2026-08-10: "está muy básica") ────────────────────────────────
 * La guía pasó de 3 pasos a 6 capítulos. Lo que este bloque cuida es lo que la ampliación puede romper:
 *   · que los SEIS se puedan abrir directo — con seis pasos, un asistente de solo "Siguiente" no se lee;
 *   · que el capítulo de LA HISTORIA nombre los tres movimientos EN ORDEN: es el modelo mental del producto
 *     entero (toda respuesta de ADI y toda cara de la Mesa están armadas así), y en desorden no enseña nada;
 *   · que el capítulo de LOS CRUCES no prometa un cruce que no existe (invariante 3 del archivo). Se verifica
 *     contra el producto: el capital ligado vive en la Ficha y los compradores de un SKU inmovilizado en Capital;
 *   · que las TRES REGLAS estén las tres, en la redacción que el owner selló (lengua del usuario, no la interna);
 *   · que la guía NO se contradiga con la palabra que se unificó en el resto del producto ("inmovilizado"). */
console.log("\n" + "═".repeat(100));
console.log("9 · SEIS CAPÍTULOS · el índice, la historia, los cruces y las tres reglas");
console.log("═".repeat(100));
{
  limpiar();
  const { container } = await montarApp();
  ok(GUIA_PASOS === 6 && GUIA_CAPITULOS.length === 6, `la guía tiene 6 capítulos (obtuvo: ${GUIA_PASOS})`);
  // el índice completo, y cada botón lleva a SU capítulo
  for (const i of [...Array(GUIA_PASOS).keys()]) {
    ok(!!$(container, `guia-indice-${i}`), `el índice ofrece el capítulo ${i + 1} («${GUIA_CAPITULOS[i]}»)`);
  }
  for (const i of [5, 3, 1, 0]) {   // en desorden a propósito: saltar no puede depender de haber pasado por el anterior
    await irA(container, i);
    ok(pasoActual(container) === i + 1, `el índice abre el capítulo ${i + 1} directo (sin pasar por los anteriores)`);
  }
  /* EL BLANCO DE CLIC NO SE MUEVE. La primera versión metía el NOMBRE del capítulo dentro de la pastilla activa:
   * al cambiar de capítulo la pastilla se ensanchaba, corría a las vecinas, y quien apuntaba al 4 caía en el 5.
   * Se verificó a mano y pasaba de verdad. Ahora el nombre vive en el encabezado y las pastillas son todas del
   * mismo ancho — un índice cuyos destinos se mueven bajo el cursor es peor que no tener índice. */
  {
    const anchos = [...Array(GUIA_PASOS).keys()].map((i) => $(container, `guia-indice-${i}`).style.width);
    ok(anchos.every((w) => w && w === anchos[0]), `las pastillas del índice miden todas lo mismo (${[...new Set(anchos)].join(" / ")}) — así el destino no se corre al cambiar de capítulo`);
    const conNombre = [...Array(GUIA_PASOS).keys()].filter((i) => GUIA_CAPITULOS.some((t) => $(container, `guia-indice-${i}`).textContent.includes(t)));
    ok(conNombre.length === 0, "…y ninguna lleva el título adentro, que es lo que las hacía crecer");
  }

  // CAPÍTULO 2 · LA HISTORIA · los tres movimientos, en orden
  await irA(container, 1);
  const t2 = container.textContent;
  const iQue = t2.indexOf("Qué está pasando"), iPor = t2.indexOf("Por qué y dónde"), iHacer = t2.indexOf("Qué hacer primero");
  ok(iQue >= 0 && iPor >= 0 && iHacer >= 0, "los tres movimientos están nombrados");
  ok(iQue < iPor && iPor < iHacer, `y EN ORDEN (qué ${iQue} · por qué ${iPor} · qué hacer ${iHacer}) — al revés no enseña el modelo`);
  ok(/no alcanza para explicarlo/.test(t2), "…y dice qué pasa cuando el dato no explica: lo declara en vez de inventar la causa");
  ok(/la enmarca, no la toma|decisión sigue siendo tuya/i.test(t2), "…sin sobreafirmar: ADI enmarca la decisión, no decide");

  /* CAPÍTULO 4 · LOS CRUCES · lo que se promete tiene que EXISTIR, comprobado contra el código.
   * 🔴 Este bloque nació de un error real: la guía prometió el capital ligado a un cliente el mismo día que el
   * owner lo retiró (decisión 9, `203bc89` — el mix salía de una matriz de afinidad con todos los pesos > 0, así
   * que la cifra era el inventario global repetido trece veces con nombre de cuenta encima). Por eso acá hay dos
   * candados y no uno: que exista lo que se promete, Y que NO vuelva lo que se retiró. */
  await irA(container, 3);
  const t4 = container.textContent;
  ok(/qué clientes lo compran/i.test(t4), "el cruce producto parado↔comprador nombra a los clientes que lo compran");
  const cap = fs.readFileSync(path.join(root, "src/adi/sentrix/mesaCapital.js"), "utf8");
  ok(/_compradoresDe/.test(cap), "…y ese cruce EXISTE en la cara Capital (no es una promesa vacía)");
  ok(/estimaci[óo]n|indicado/i.test(t4), "…y se declara como estimación, que es como el módulo lo sella");
  // EL CANDADO DEL CRUCE RETIRADO · si el capital ligado no está en la Ficha, la guía no puede prometerlo
  const ficha = fs.readFileSync(path.join(root, "src/ui/SentrixPanel.jsx"), "utf8");
  const hayCapitalLigado = /en productos que le vend[ée]s a/.test(ficha);
  ok(!hayCapitalLigado, "el capital ligado a un cliente sigue retirado del producto (decisión 9 del owner)");
  // NOMBRAR el cruce retirado es correcto —es la regla 3 en pantalla—; PROMETERLO no. La diferencia está en el
  // modo: prometerlo es mandar al usuario a buscarlo ("abre la Ficha y vas a ver…"). Eso es lo que se prohíbe.
  ok(!/Ficha[^.]{0,80}(capital (inmovilizado|parado|ligado)|cu[áa]nto capital)/i.test(t4),
    "…y la guía NO manda a buscarlo en la Ficha: lo nombra como límite, no como destino");
  ok(/no sostiene|se retir/i.test(t4), "…dicho en pantalla, que es la regla 3 funcionando");

  // CAPÍTULO 6 · LAS TRES REGLAS · en la redacción sellada por el owner (2026-08-10)
  await irA(container, 5);
  const t6 = container.textContent;
  for (const regla of ["Cada cifra cierra con su cuenta", "No te decimos por qué si no lo podemos probar", "Lo que falta, aparece en pantalla"]) {
    ok(t6.includes(regla), `regla presente: «${regla}»`);
  }
  ok(/Preferimos un «no lo sé» a un número que no se sostiene/.test(t6), "y el cierre que las resume");
  // la versión INTERNA no se filtra a la pantalla: "hardcodear" no le dice nada a un cliente
  ok(!/hardcode/i.test(t6) && !/proporcionalidad sem[áa]ntica/i.test(t6), "…sin la jerga interna de las reglas");
  await clic($(container, "guia-siguiente"));
  ok(!hayGuia(container), "\"Empezar\" cierra la guía en el último capítulo");
  cleanup();
}

// UNA SOLA PALABRA EN TODO EL PRODUCTO · la cara Capital dejó de decir "detenido" (be4f523); si la guía lo dijera,
// el usuario leería dos nombres para el mismo dinero en su primera pantalla.
{
  const guia = fs.readFileSync(path.join(root, "src/ui/GuiaInicio.jsx"), "utf8")
    .replace(/\/\*[^]*?\*\//g, "").split("\n").filter((l) => !/^\s*(\/\/|\*)/.test(l)).join("\n");
  ok(!/detenid/i.test(guia), "la guía dice «inmovilizado», igual que el resto del producto",
    (guia.match(/[^.]*detenid[^.]*/i) || [""])[0].slice(0, 100));
}
limpiar();

console.log(`\n── _guia_inicio_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail === 0 ? 0 : 1);
