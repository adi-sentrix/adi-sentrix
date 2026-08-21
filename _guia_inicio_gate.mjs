/* === _guia_inicio_gate.mjs · LA GUÍA DE INICIO (owner 2026-08-07) ================================================
 * Turno de trabajo: "la app abre en un chat vacío y el usuario no sabe qué puede preguntar ni para qué sirve el panel".
 *
 * Monta la App REAL (jsdom + testing-library, mismo patrón que _evidence_spec_views_gate) — no un harness que
 * imite el cableado — y verifica los cinco hechos que el owner pidió, más el que sostiene a todos:
 *
 *   1. PRIMERA VISITA · sin marca en localStorage la guía se abre SOLA, en el paso 1, con la frase madre.
 *   2. SE PUEDE SALTAR · en CADA uno de los 3 pasos, por "Saltar", por el ✕ y por Escape. Y no bloquea:
 *      aria-modal="false" y la barra lateral sigue viva detrás.
 *   3. "NO VOLVER A MOSTRAR" · persiste EN EL ACTO (no al cerrar) y suprime la apertura automática.
 *   4. EL BOTÓN DE LA BARRA LATERAL la reabre — con la marca puesta, y con cualquiera de los dos valores.
 *   5. EL CLICK NO TIENE PUERTA PROPIA (owner 2026-08-15). El contrato cambió: «no deben usar una ruta demo,
 *      respuesta prearmada ni shortcut … debe responder exactamente igual que si yo escribiera la pregunta
 *      manualmente». Se verifica el CABLEADO contra el código (la guía entrega el prompt → App lo pasa por
 *      runRef → el chat lo entrega a `submit`, la MISMA función del formulario del input) y, en la App montada,
 *      que el click cierre la guía y deje el PROMPT EXACTO puesto como turno del usuario, contestado una vez.
 *   6. LOS EJEMPLOS NO SON INVENTADOS · son los prompts de los Exámenes 1, 2 y 3, ya medidos en vivo. Cuál es el
 *      turno de origen de cada uno y con qué estado respondió lo fija `_guia_promesas_gate`; acá se cuida que
 *      ninguno traiga spec —un spec sería el atajo que el owner sacó— y que todos sean autosuficientes.
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
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";

// vía 1 (2026-08-20): el dataset se DECLARA acá. Antes se heredaba del import por defecto de tenantStore,
// que ya no existe: el store arranca en la forma vacía y el dato entra por initTenant. Ver tenantEmpty.js.
initTenant(TENANT_DEMO);

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
// vía 1 (2026-08-20): declarar el tenant SOBRE ESTA instancia — el bundle tiene su propia copia del store.
ui.initTenant(ui.TENANT_DEMO);
const React = (await import("react")).default;
const { render, fireEvent, cleanup, act } = await import("@testing-library/react");

const { GUIA_EJEMPLOS, GUIA_KEY, GUIA_VISTA, GUIA_NUNCA, GUIA_CAPITULOS, GUIA_PASOS, buildAdiTurn, NOT_YET_TEXT, resetPnlDraft } = ui;

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
  ok(!!$(container, "guia-abrir"), "el botón permanente \"¿Cómo funciona?\" está en la barra lateral");
  cleanup();
}

console.log("\n" + "═".repeat(100));
console.log("2 · LOS EJEMPLOS NO SON INVENTADOS · un tema por ejemplo, con el PROMPT EXACTO y SIN spec (owner 2026-08-15)");
console.log("═".repeat(100));
{
  // El owner pidió un ejemplo por tema (2026-08-10); eso no cambió. Lo que cambió es DE DÓNDE sale la pregunta: ya
  // no es un chip curado con su spec, es el PROMPT EXACTO de un turno de examen y viaja tal cual al chat normal.
  ok(GUIA_EJEMPLOS.length === 4, `la guía ofrece 4 ejemplos, uno por tema (obtuvo: ${GUIA_EJEMPLOS.length})`);
  const temas = GUIA_EJEMPLOS.map((e) => e.tema);
  ok(new Set(temas).size === temas.length, `un ejemplo por tema, sin repetir (${temas.join(" · ")})`);
  for (const ej of GUIA_EJEMPLOS) {
    ok(typeof ej.tema === "string" && ej.tema.length > 2, `«${ej.titulo}» declara su tema`);
    /* ⚠️ EL CONTRATO CAMBIÓ (owner 2026-08-15): los ejemplos YA NO LLEVAN SPEC. Antes cada uno traía un spec
     * enlatado y el click lo ejecutaba por una puerta propia; ahora el click manda el PROMPT EXACTO por la misma
     * función del input. Lo que este gate fija ahora es lo contrario de antes: que NO haya spec —un spec sería el
     * atajo que el owner pidió sacar— y que el prompt sea texto de verdad, distinto del rótulo visible. */
    ok(ej.spec === undefined, `«${ej.titulo}» NO trae spec: el click manda el prompt, no un atajo`);
    ok(typeof ej.q === "string" && ej.q.trim().length > 40, `«${ej.titulo}» trae el prompt exacto que se enviará (${(ej.q || "").length} car.)`);
    ok(typeof ej.titulo === "string" && ej.titulo.length > 10 && ej.titulo !== ej.q,
      "…y un texto visible propio, distinto del prompt (se lee uno, se envía el otro, los dos a la vista)");
    ok(typeof ej.glosa === "string" && ej.glosa.length > 10, `«${ej.titulo}» trae su bajada de qué devuelve`);
  }
  /* AUTOSUFICIENTES · UN CLICK ES SIEMPRE UN PRIMER TURNO. Las preguntas salen de los exámenes, y ahí varias
   * dependían de la anterior («Entonces hazlo anual…», «Sobre esos SKU…»): esa forma no sirve acá, porque sin
   * turno previo la anáfora no tiene a qué apuntar y ADI tendría razón en preguntar de qué le hablan. El owner
   * las reescribió standalone; esto lo fija para que nadie vuelva a pegar un prompt de examen tal cual. */
  const ANAFORA = /^\s*(entonces|ahora|sobre (esos|esas|eso)|de (esos|esas)|con (eso|ese|esa)|y (ahora|entonces))\b/i;
  for (const ej of GUIA_EJEMPLOS) {
    ok(!ANAFORA.test(ej.q), `«${ej.titulo}» no arranca con una anáfora — un click es siempre el PRIMER turno`);
  }
  ok(new Set(GUIA_EJEMPLOS.map((e) => e.q)).size === GUIA_EJEMPLOS.length, "…y no hay dos ejemplos con el mismo prompt");
}

console.log("\n" + "═".repeat(100));
console.log("3 · EL CLICK NO TIENE PUERTA PROPIA · el prompt viaja por la MISMA función que el input");
console.log("═".repeat(100));
{
  /* EL CONTRATO NUEVO (owner 2026-08-15). Antes el click ejecutaba un SPEC ENLATADO por una puerta propia
   * (submitSpec → answerConversational), y este bloque probaba esa puerta. El owner la sacó: «no deben usar una
   * ruta demo, respuesta prearmada ni shortcut … debe responder exactamente igual que si yo escribiera la
   * pregunta manualmente». Quedan dos cosas por verificar, y son distintas entre sí:
   *   · EL CABLEADO, contra el CÓDIGO · la guía entrega el texto, App lo pasa por runRef y el chat lo entrega a
   *     `submit` —la misma función del formulario del input—, NUNCA a submitSpec. Se lee de los tres archivos
   *     porque es una cadena de tres saltos: el bloque 4 prueba que el turno aparece, pero no POR DÓNDE entró.
   *   · EL PISO, ejercitado · con el gateway caído el texto libre igual tiene que producir una respuesta, no un
   *     decline de la UI. La vía VIVA (oráculo encendido = producción) no se puede ejercitar acá sin gastar: su
   *     garantía es el expediente del examen, y la fija `_guia_promesas_gate`. */
  const leer = (f) => fs.readFileSync(path.join(root, f), "utf8");
  const guiaSrc = leer("src/ui/GuiaInicio.jsx"), appSrc = leer("src/ui/App.jsx"), chatSrc = leer("src/ui/ChatADI.jsx");
  ok(/onClick=\{\(\)\s*=>\s*onEjecutar\(ej\.q\)\}/.test(guiaSrc), "GuiaInicio entrega el PROMPT (ej.q) al llamador — no un spec, no un id de demo");
  const bloqueTemas = guiaSrc.slice(guiaSrc.indexOf("const _TEMAS = ["), guiaSrc.indexOf("export const GUIA_CAPITULOS"));
  ok(bloqueTemas.length > 100 && !/\bspec\b/.test(bloqueTemas), "…y el bloque de ejemplos no nombra `spec` ni una vez");
  ok(/onEjecutar=\{\(q\)\s*=>\s*\{[^}]*runRef\.current\(q\)/.test(appSrc), "App pasa ese texto al chat por runRef (el mismo puente de siempre)");
  const mReg = chatSrc.match(/registerRun\(\(q\)\s*=>\s*\{[\s\S]{0,300}?\}\)/);
  ok(!!mReg && /submitRef\.current\(q\)/.test(mReg[0]), "y el chat lo entrega a `submit`, la función del formulario del input");
  ok(!!mReg && !/submitSpec/.test(mReg[0]), "…y NO a submitSpec: por ahí entraba el spec enlatado, que es el atajo que se sacó");

  /* EL PISO, con cada ejemplo medido COMO PRIMER TURNO de alguien que recién llega (sin arrastrar el estado del
   * anterior). Lo que se exige es lo que un usuario con el gateway caído tiene derecho a ver: una respuesta de
   * verdad. Las CIFRAS no se exigen parejo — estas cuatro preguntas están escritas para el cerebro, y el piso
   * contesta lo que su detector alcanza; cuál llega hasta la cifra y cuál no queda IMPRESO acá, no escondido. */
  for (const ej of GUIA_EJEMPLOS) {
    limpiar();
    const turno = buildAdiTurn(ej.q, {}, "bonanza");
    const r = { text: turno.adiMsg.text, route: turno.adiMsg.route, _degrade: turno.adiMsg._degrade };
    const cuerpo = String(r.text || "").replace(/\s+/g, " ").trim();
    console.log(`  · [piso · gateway caído] «${ej.titulo}» → ruta ${r.route} · ${cuerpo.length} car.${/[$%]/.test(cuerpo) ? " · con cifras" : " · SIN cifras"}`);
    console.log(`      ${JSON.stringify(cuerpo.slice(0, 150))}`);
    const mal = porQueEsDecline(r);
    // la falta de cifras se REPORTA arriba; lo que veta es el decline de verdad (nulo, degradado, no-cobertura, vacío)
    const veta = mal && !/sin una sola cifra/.test(mal) ? mal : null;
    ok(!veta, `[piso] «${ej.titulo}» responde con el gateway caído${veta ? " · " + veta : ""}`);
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
  // SE LEE UNO Y SE ENVÍA EL OTRO · en el botón va el rótulo corto; lo que viaja es el prompt largo del examen.
  ok(!!btn && btn.textContent.includes(GUIA_EJEMPLOS[0].titulo), `[${modo.nombre}] el ejemplo 0 se renderiza con su rótulo visible`);
  ok(!!btn && !btn.textContent.includes(GUIA_EJEMPLOS[0].q), `[${modo.nombre}] …y el prompt largo NO se pinta en el botón`);
  await clic(btn);
  ok(!hayGuia(container), `[${modo.nombre}] la guía se CIERRA al tocar el ejemplo`);
  ok(container.textContent.includes(GUIA_EJEMPLOS[0].q),
    `[${modo.nombre}] el PROMPT EXACTO quedó puesto como turno del usuario — es lo que se escribiría a mano, no un rótulo`);
  const burbujas = [...container.querySelectorAll('[data-testid="adi-bubble"]')];
  ok(burbujas.length === 1, `[${modo.nombre}] ADI contestó exactamente una vez (obtuvo: ${burbujas.length})`);
  const respuesta = burbujas.length ? burbujas[0].textContent : "";
  ok(!respuesta.includes(NOT_YET_TEXT.slice(0, 40)), `[${modo.nombre}] la respuesta NO es el decline de la UI`);
  // LECTURA DE NEGOCIO, no un pedido de datos al usuario. El umbral y la cifra en $ no son decorativos: el flujo
  // guiado del P&L ("nombrame tus gastos") también es una respuesta válida del motor, pero como PRIMER turno de la
  // guía no muestra nada — pasa un `%` suelto y se queda en ~200 caracteres. Esta aserción distingue las dos.
  console.log(`      [${modo.nombre}] respuesta de ${respuesta.length} car.${/\$\s?\d/.test(respuesta) ? " · con cifras en $" : " · SIN cifras en $"}`);
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
  ok(!!$(container, "guia-abrir"), `capítulo ${p + 1}: la barra lateral sigue viva detrás (no es un modal que bloquea)`);
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
