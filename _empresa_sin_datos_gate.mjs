/* === _empresa_sin_datos_gate.mjs · LA EMPRESA QUE TODAVÍA NO SUBIÓ NADA VE ALGO (vía 3 · 2026-08-27) =====
 *
 * DE DÓNDE SALE ESTE ARCHIVO. Del click en vivo que pidió el owner. Los 184 candados estaban verdes, la
 * verificación contra Supabase daba 19 de 19, el servidor respondía EXACTAMENTE lo que debía —`sin-datos` con
 * su mensaje— y el usuario veía **una pantalla negra**. Dos defectos, los dos en el camino de render, los dos
 * invisibles para todo lo que había:
 *
 *   1. un retorno temprano por `!datosListos` pintaba una pantalla neutra ANTES del bloque que abre «Tus
 *      datos», así que la pantalla se abría en un árbol que nunca se pintaba;
 *   2. `activarDatos` no marcaba los datos como listos — nunca hizo falta, porque hasta la vía 3 solo se
 *      llegaba a esa pantalla con el demo ya cargado. Viniendo de una empresa vacía, el usuario confirmaba su
 *      archivo y se quedaba mirando el mismo negro, con el dato guardado y activo en la base.
 *
 * LA LECCIÓN: el servidor puede tener razón y el producto estar roto igual. Ningún candado de servidor ve el
 * árbol de React, y ninguna prueba de módulo ve un `return` que corta antes.
 *
 * QUÉ HACE ACÁ: monta la pantalla de verdad (JSDOM + React) en el estado «sin datos» y exige que se lea el
 * mensaje del owner y que estén los dos caminos que ese mensaje ofrece. Y comprueba las dos condiciones de
 * `App.jsx` que hacen que esa pantalla llegue a pintarse.
 *
 * OFFLINE · JSDOM + React en memoria · no puede gastar. */
import { JSDOM } from "jsdom";
import fs from "node:fs";
import path from "node:path";
import esbuild from "esbuild";
import { fileURLToPath, pathToFileURL } from "node:url";
import React from "react";
import { MENSAJE_SIN_DATOS } from "./src/data/tenantService.server.js";

let pass = 0, fail = 0;
const ok = (cond, label, detalle) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ FALLO: ${label}`); if (detalle !== undefined) console.log(`      ${detalle}`); }
};

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
try { Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true }); } catch { }
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.Node = dom.window.Node;
globalThis.getComputedStyle = dom.window.getComputedStyle;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

/* Node no importa `.jsx`: se compila con esbuild, igual que los otros candados de pantalla.
 *
 * (Se probó moverlo al directorio temporal para aliviar a `_poda_anti_resurreccion_gate`, que barre todo
 * archivo `_*.mjs` de la raíz: NO era la causa de su falta de memoria, y allá esbuild no resuelve `react`
 * porque no hay `node_modules`. Queda en la raíz como los demás, y se borra al terminar.)
 */
const root = path.dirname(fileURLToPath(import.meta.url));
const bundlePath = path.join(root, "_empresa_sin_datos_gate_bundle.mjs");
await esbuild.build({
  entryPoints: [path.join(root, "_empresa_sin_datos_gate_entry.jsx")],
  bundle: true, outfile: bundlePath, format: "esm", platform: "node", jsx: "automatic",
  external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "react/jsx-dev-runtime"],
  logLevel: "silent",
});
const ui = await import(pathToFileURL(bundlePath).href);
// El bundle tiene su propia copia del store: el dataset se declara SOBRE esa instancia, no sobre la de acá.
ui.initTenant(ui.TENANT_DEMO);
const { render, cleanup } = await import("@testing-library/react");
const { PanelDatos } = ui;

console.log("\n" + "=".repeat(100));
console.log("1 · LA PANTALLA, MONTADA DE VERDAD · el mensaje del owner se lee");
console.log("=".repeat(100));
{
  const { container } = render(React.createElement(PanelDatos, {
    sinDatos: MENSAJE_SIN_DATOS,
    activo: null,
    onCerrar: () => { },
    onActivar: () => { },
    onVerDemo: () => { },
    onVolverAlDemo: () => { },
  }));
  const texto = container.textContent || "";

  ok(texto.includes(MENSAJE_SIN_DATOS),
    "se lee la frase completa que decidió el owner, textual",
    `no aparece en: ${texto.slice(0, 160)}…`);

  /* Los dos caminos que la frase OFRECE tienen que estar a mano. Prometerlos y no darlos sería peor que no
   * ofrecerlos: el usuario se queda buscando un botón que no existe. */
  ok(Boolean(container.querySelector('[data-testid="datos-ver-demo"]')), "…y está el botón para mirar el demo");
  ok(Boolean(container.querySelector('[data-testid="datos-subir"]')), "…y el de subir la planilla");

  /* ⚠️ Y NO SE LE DICE QUE ESTÁ VIENDO EL DEMO. Esa línea es correcta cuando corre el negocio de ejemplo; acá
   * sería afirmarle que ADI ya responde sobre algo, cuando no hay nada. */
  ok(!/responde sobre el/i.test(texto),
    "y NO se le anuncia que ADI ya responde sobre un negocio: todavía no hay ninguno",
    texto.slice(0, 200));
  cleanup();
}

console.log("\n" + "=".repeat(100));
console.log("2 · SIN EL AVISO, LA PANTALLA ES LA DE SIEMPRE");
console.log("=".repeat(100));
{
  const { container } = render(React.createElement(PanelDatos, {
    sinDatos: null, activo: null, onCerrar: () => { }, onActivar: () => { }, onVerDemo: () => { }, onVolverAlDemo: () => { },
  }));
  const texto = container.textContent || "";
  ok(!texto.includes("Todavía no hay datos cargados"), "no aparece el aviso cuando no corresponde");
  ok(/responde sobre el/i.test(texto), "…y vuelve la línea de siempre sobre el negocio de demostración");
  ok(!container.querySelector('[data-testid="datos-ver-demo"]'), "…y el botón de mirar el demo no está de más");
  cleanup();
}

console.log("\n" + "=".repeat(100));
console.log("3 · QUE LA PANTALLA LLEGUE A PINTARSE · los dos defectos del click en vivo");
console.log("=".repeat(100));
{
  /* ⚠️ ESTOS DOS SON CHEQUEOS ESTRUCTURALES SOBRE `App.jsx`, y lo digo en vez de disimularlo: leen la forma del
   * código, no lo ejecutan. Montar `App` entero exigiría simular la puerta, la red y el arranque, y una prueba
   * frágil que se apaga sola no protege nada. Estos dos son exactamente los dos defectos que aparecieron en
   * vivo, y se ponen rojos si vuelven. */
  const app = fs.readFileSync("./src/ui/App.jsx", "utf8");

  const corte = app.match(/if \(!datosListos\) return ([^\n]+)/);
  ok(Boolean(corte), "existe el retorno temprano por `!datosListos`");
  ok(Boolean(corte) && /panelDatos/.test(corte[1]),
    "⚠️ …y ese retorno INCLUYE la pantalla de datos: si no, la empresa sin archivo se queda en negro",
    corte ? corte[1] : "");

  /* ⚠️ SE BUSCA LA SENTENCIA, NO LA MENCIÓN: `^\s*…;` en su propia línea. La primera versión buscaba el texto
   * suelto y lo encontraba dentro del COMENTARIO que explica por qué la llamada tiene que estar — así que
   * borrar la llamada de verdad no ponía nada rojo. Es la misma trampa que ya cazó a otro candado de este
   * repo: un chequeo que lee prosa mide la prosa. */
  const LLAMA_A_LISTOS = /^\s*setDatosListos\(true\);/m;
  const activar = app.match(/const activarDatos = [\s\S]*?\n  \};/);
  ok(Boolean(activar), "existe `activarDatos`");
  ok(Boolean(activar) && LLAMA_A_LISTOS.test(activar[0]),
    "⚠️ …y marca los datos como listos: sin eso, confirmar el archivo deja la app en negro con el dato ya guardado",
    activar ? activar[0].slice(0, 200) : "");

  /* Y que la pantalla se abra sola cuando el servidor dice que no hay datos: si no, nadie la ve nunca. */
  ok(/sinDatos\b[\s\S]{0,120}setDatosAbiertos\(true\)/.test(app),
    "y la pantalla se abre sola al recibir «sin datos» del servidor");
}

console.log("\n" + "=".repeat(100));
console.log("4 · CARNADA · los tres chequeos estructurales tienen que poder ponerse rojos");
console.log("=".repeat(100));
{
  const app = fs.readFileSync("./src/ui/App.jsx", "utf8");
  const roto1 = app.replace(/if \(!datosListos\) return [^\n]+/, 'if (!datosListos) return <div style={{ height:"100vh" }}/>;');
  ok(!/if \(!datosListos\) return [^\n]*panelDatos/.test(roto1),
    "quitarle la pantalla al retorno temprano lo pondría rojo (es el defecto 1 del click en vivo)");

  /* ⚠️ LA MUTACIÓN TIENE QUE SER DENTRO DE `activarDatos`, no en la primera aparición del archivo: la llamada
   * existe también en el efecto de carga y en «mirar el demo», así que borrar la primera dejaba `activarDatos`
   * intacto y la carnada no simulaba nada. La primera versión de este chequeo se puso roja por eso — y está
   * bien que lo haya hecho: una carnada que no reproduce el defecto no prueba el chequeo, lo decora. */
  const bloque = app.match(/const activarDatos = [\s\S]*?\n  \};/);
  const activarRoto = bloque ? bloque[0].replace(/^\s*setDatosListos\(true\);/m, "") : null;
  ok(Boolean(activarRoto) && !/^\s*setDatosListos\(true\);/m.test(activarRoto),
    "quitarle la marca a `activarDatos` lo pondría rojo (es el defecto 2)");

  const roto3 = app.replace(/setDatosAbiertos\(true\)/g, "setDatosAbiertos(false)");
  ok(!/sinDatos\b[\s\S]{0,120}setDatosAbiertos\(true\)/.test(roto3),
    "y no abrir la pantalla al recibir «sin datos» también lo pondría rojo");
}

try { fs.unlinkSync(bundlePath); } catch { /* el bundle es temporal: si no se puede borrar, no es un fallo */ }

console.log(`\n── _empresa_sin_datos_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail === 0 ? 0 : 1);
