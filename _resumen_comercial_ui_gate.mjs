/* === _resumen_comercial_ui_gate.mjs · RESUMEN COMERCIAL · LA VISTA (owner 2026-08-07) ==================
 * Hermano de _resumen_comercial_gate.mjs: aquel sella la CAPA DE DATOS, este sella la UI que la muestra.
 * Renderiza <SentrixPanel/> de verdad (esbuild + jsdom + testing-library, mismo patrón de
 * _evidence_spec_views_gate.mjs) sobre evidencia REAL construida con runPlan/buildOracleEvidence — la misma que
 * arma answerViaOracle.js en producción. Cero red, cero LLM.
 *
 *   [1] LOS SEIS BLOQUES, EN ORDEN: veredicto+KPIs · plano de decisión · concentración 80/20 · puente · insights ·
 *       evidencia completa opcional. Y las cifras que pinta son EXACTAMENTE las del módulo (cero cálculo en React).
 *   [2] ALCANCE GLOBAL SIN CONTAMINACIÓN: entrar por el deep-link de un cliente y saltar a Comercial da la MISMA
 *       lectura del negocio que entrar sin selección, y la tabla de evidencia arranca sin ninguna fila elegida.
 *   [3] NAVEGACIÓN A LA FICHA: el insight, la primera profundización sugerida, la barra del gráfico y el
 *       "Ver Ficha" de cada fila abren la Ficha Ejecutiva REAL de esa entidad (la cara Ficha, no una vista nueva).
 *   [4] EXPANSIÓN/CONTRACCIÓN de la cartera completa: la tabla no existe hasta pedirla y se puede volver a cerrar.
 *   [4b] LOS DOS UNIVERSOS, RECONCILIADOS A LA VISTA: la cartera material y el plano de decisión aparecen SIEMPRE
 *       nombrados, con el % dinámico que el plano concentra — nunca dos montos parecidos sueltos.
 *   [5] LO QUE SALE DE COMERCIAL: las tiras legacy "Margen en riesgo" y "Capital detenido" · KPI de capital ·
 *       bodegas · evolución de UNA entidad · "perfil vs promedio".
 *   [6] TOGGLE Ventas/Contribución: cambia el gráfico con las cifras del módulo, no con un recálculo propio.
 *   [7] CERO REGRESIONES: las caras Ficha, Capital y Resultado siguen rindiendo igual.
 *   [8] PROPORCIONALIDAD SEMÁNTICA: nada de "revisar costo" (el costo no está probado) ni de causa afirmada.
 *
 * `node _resumen_comercial_ui_gate.mjs`
 */
import { JSDOM } from "jsdom";
import esbuild from "esbuild";
import { fileURLToPath, pathToFileURL } from "url";
import path from "path";
import { rmSync } from "node:fs";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";

// vía 1 (2026-08-20): el dataset se DECLARA acá. Antes se heredaba del import por defecto de tenantStore,
// que ya no existe: el store arranca en la forma vacía y el dato entra por initTenant. Ver tenantEmpty.js.
initTenant(TENANT_DEMO);

let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };
const H = (t) => console.log("\n" + "═".repeat(96) + "\n" + t + "\n" + "═".repeat(96));

// ── 0 · DOM global + perfil "dev" (sin esto los flags de Sentrix caen al piso en Node: cero shell, cero UI) ──
const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
try { Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true }); } catch { /* ya definido */ }
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.Node = dom.window.Node;
globalThis.getComputedStyle = dom.window.getComputedStyle;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.localStorage = dom.window.localStorage;
globalThis.__ADI_PROFILE__ = "dev";
// matchMedia CONTROLABLE: es el mecanismo real de ancho de la app (App.jsx) y acá es lo que permite probar el
// tope móvil del gráfico sin un navegador. jsdom lo trae, pero siempre con matches:false.
let _MQ_MATCHES = false;
dom.window.matchMedia = (query) => ({
  media: query, matches: _MQ_MATCHES,
  addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null,
  dispatchEvent() { return false; },
});

const root = path.dirname(fileURLToPath(import.meta.url));
const bundlePath = path.join(root, `_resumen_comercial_ui_gate_bundle.tmp${process.pid}.mjs`);
// entry por STDIN: el gate es autosuficiente — no depende de ningún archivo suelto en la raíz para poder correr.
await esbuild.build({
  // vía 1 (2026-08-20): el bundle declara SU tenant. El store ya no importa ningún dataset (esos imports metían el
  // dato de todas las empresas en el bundle publicado) y esta instancia de esbuild tiene su propia copia del store.
  stdin: { contents: [
    `export { SentrixPanel } from "./src/ui/SentrixPanel.jsx";`,
    `export { initTenant } from "./src/data/tenantStore.js";`,
    `export { TENANT_DEMO } from "./src/data/tenants/demo.js";`,
  ].join("\n"), resolveDir: root, loader: "jsx", sourcefile: "_resumen_comercial_ui_entry.jsx" },
  bundle: true, outfile: bundlePath, format: "esm", platform: "node", jsx: "automatic",
  external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "react/jsx-dev-runtime"],
  logLevel: "silent",
});
const ui = await import(pathToFileURL(bundlePath).href);
// vía 1 (2026-08-20): declarar el tenant SOBRE ESTA instancia — el bundle tiene su propia copia del store.
ui.initTenant(ui.TENANT_DEMO);
const React = (await import("react")).default;
const { render, fireEvent, cleanup } = await import("@testing-library/react");
const { runPlan } = await import("./src/adi/oracle/toolRunner.js");
const { buildOracleEvidence } = await import("./src/adi/oracle/sentrixEvidence.js");
const { ledgerBoleta } = await import("./src/adi/oracle/ledger.js");
const { buildResumenComercial } = await import("./src/adi/sentrix/resumenComercial.js");
const { buildCuadroMando } = await import("./src/adi/sentrix/cuadro.js");
// La cara Capital entra a este gate solo por su gráfico de barras: es la ÚNICA superficie donde el módulo calcula
// un set (cabeza + cola agrupada) que la vista podría dibujar incompleto sin que la aritmética se entere.
const { buildMesaCapital } = await import("./src/adi/sentrix/mesaCapital.js");
// El estado de la Mesa trae `cambios` y `simulaciones`: las dos secciones que SALIERON de la cara Comercial.
// Se importa justamente para poder afirmar que sus textos NO aparecen — comprobar una ausencia exige tener a mano
// lo que debería estar ausente; si no, el gate "pasa" porque no busca nada.
const { buildMesaEstado } = await import("./src/adi/sentrix/mesa.js");

const SCENARIO = "bonanza";
const R = buildResumenComercial(SCENARIO, { maxEntidades: 10 });
const MESA = buildMesaEstado(SCENARIO);

function runTurn(plan, scenario = SCENARIO) {
  const { results, unsupported, ledger } = runPlan(plan, { scenario });
  return buildOracleEvidence({ plan, results, figs: ledgerBoleta(ledger), scenario, unsupported });
}
// TENDENCIA global → evidence.lens === "temporal" → la Mesa abre en la cara Comercial (_tLink), sin ninguna
// entidad en foco: es el camino natural de entrada a esta vista.
const evTemporal = () => runTurn({ intent: "trend", mode: "default", rationale: "Cómo viene la venta mes a mes este año.",
  scope: { level: "global" }, calls: [{ tool: "trend", args: { metric: "ventas" } }] });
// PERFIL de un cliente → _profileRequest → la Mesa abre en la cara FICHA con ese cliente ya elegido. Es la
// "selección previa" que NO puede teñir la cara Comercial.
const evPerfil = (cliente) => runTurn({ intent: "entityProfile", mode: "default", rationale: `El margen de ${cliente} este período.`,
  scope: { level: "entity", entities: [cliente] }, calls: [{ tool: "entityProfile", args: { dimension: "cliente", entity: cliente } }] });

function abrir(evidence) {
  try { localStorage.clear(); } catch { /* sin storage → sesión */ }   // la cara se recuerda en localStorage: cada caso arranca limpio
  const asks = [];
  const utils = render(React.createElement(ui.SentrixPanel, {
    evidence, onClose: () => {}, onToggleMax: () => {}, maximized: false, onAsk: (q) => asks.push(q),
  }));
  return { ...utils, asks };
}
const botones = (container) => [...container.querySelectorAll("button")];
const porTexto = (container, txt) => botones(container).find((b) => b.textContent === txt);
const conTexto = (container, txt) => botones(container).find((b) => b.textContent.includes(txt));
// (El helper `verCartera`, que expandía la tabla legacy detrás de "Ver todos los clientes", se eliminó con el
//  bloque · owner 2026-08-08. Lo que aquella tabla probaba se prueba ahora sobre el bloque 2, o sobre su ausencia.)
// la FILA de la grilla: el div-grilla clickeable (cursor:pointer) que nombra a esa entidad — el header y la fila
// Total comparten el grid pero no el cursor, así que quedan afuera; el más corto desempata nombres contenidos.
const filaDe = (container, nombre) => [...container.querySelectorAll("div")]
  .filter((d) => { const s = d.getAttribute("style") || ""; return /grid-template-columns/.test(s) && /cursor:\s*pointer/.test(s) && d.textContent.includes(nombre); })
  .sort((a, b) => a.textContent.length - b.textContent.length)[0];

H("[1] LA SECUENCIA COMPLETA · tres movimientos, en el orden que fijó el owner");
{
  const { container } = abrir(evTemporal());
  const T = container.textContent;
  ok(T.includes("MESA DE CONTROL"), "abre la Mesa de Control");
  const bloques = [
    ["Qué está pasando", "01 · movimiento QUÉ ESTÁ PASANDO"],
    /* ⚠️ EL BLOQUE 1 YA NO ABRE CON UNA CONCLUSIÓN (owner 2026-08-27): «no es hacer cosas nuevas sino quitarle
       conclusiones — si dejamos botones que expliquen lo que está en Sentrix y ADI lo hará, es duplicar cosas».
       Se ancla en el primer KPI, que es lo que ahora abre la cara: una cifra, no un veredicto. */
    [R.kpis[0].label, "1 · los cuatro KPI (el veredicto se quitó de la pantalla)"],
    ["El negocio, cliente por cliente", "2 · la cartera de una sola mirada, ANTES de los gráficos"],
    ["El año, mes a mes", "3 · evolutivo (este año · año anterior · presupuesto)"],
    ["Concentración comercial · 80/20", "4 · gráfico de concentración (el mapa)"],
    ["Quién sostiene el negocio", "5 · quién sostiene el negocio (clientes/familias/SKU/canales)"],
    ["Dónde se deteriora el margen", "02 · movimiento DÓNDE SE DETERIORA EL MARGEN"],
    ["Qué mueve el margen", "5 · las dos causas: acciones comerciales y costo vs precio"],
    ["Qué hacer primero", "03 · movimiento QUÉ HACER PRIMERO"],
    [R.prioridades.encabezado, "7 · decisiones prioritarias, cruzadas"],
  ];
  const pos = bloques.map(([marca]) => T.indexOf(marca));
  for (let i = 0; i < bloques.length; i++) ok(pos[i] >= 0, `bloque ${bloques[i][1]} presente`);
  ok(pos.every((p, i) => i === 0 || (p > pos[i - 1] && pos[i - 1] >= 0)), `TODOS vienen en la secuencia exacta — ${pos.join(" < ")}`);
  ok(T.trimEnd().endsWith(R.prioridades.nota || R.prioridades.encabezado) || T.indexOf(R.prioridades.encabezado) > 0,
    "la cara termina en las decisiones: no hay una tabla de evidencia después que le robe el cierre");
  // UNA SOLA LECTURA DE ALCANCE (owner 2026-08-07): el universo 80/20 se declaraba en tres lugares distintos.
  ok(!T.includes("Plano de decisión:"), "la banda \"Plano de decisión\" ya NO existe (su contenido subió al veredicto)");
  ok(!T.includes(R.plano.frase), "…ni queda su frase suelta en ningún lado");
  ok(!T.includes(R.tension.reconcilia), "la banda ALCANCE larga tampoco: quedó la versión compacta");
  /* ⚠️ AFIRMACIÓN MOVIDA, NO BORRADA. Antes exigía «aparece UNA sola vez»: el 80/20 en prosa vivía en el soporte
     del veredicto, que es justo la conclusión que se quitó. Ahora tiene que aparecer CERO veces — la
     concentración se MUESTRA en su gráfico y en su tabla, y quien quiera la frase se la pide a ADI. Si alguien
     la vuelve a imprimir en el tablero, esto se pone rojo. */
  const vecesPlano = T.split(R.plano.n + " clientes explican el ").length - 1;
  ok(vecesPlano === 0, "el 80/20 ya NO se narra en la vista: se muestra — " + vecesPlano + " apariciones");

  // EL VEREDICTO: texto del módulo, verbatim
  /* ⚠️ EL VEREDICTO SALE DE LA PANTALLA Y PASA A PROBARSE EN EL DATO. Antes se exigía verbatim en el DOM; ahora
     se exige que NO esté impreso y que el módulo LO SIGA EMITIENDO — porque es de donde ADI lo toma para
     responder. Borrar la afirmación habría dejado al motor sin red: podría dejar de emitirlo y nadie se entera. */
  ok(!T.includes(R.veredicto.titular), "el titular del veredicto ya NO se imprime: Sentrix muestra, ADI concluye");
  ok(!T.includes(R.veredicto.soporte), "…ni su soporte, que era la otra mitad de la conclusión");
  ok(typeof R.veredicto.titular === "string" && R.veredicto.titular.length > 10,
    "…pero el módulo lo sigue emitiendo, intacto — " + R.veredicto.titular);
  ok(typeof R.veredicto.soporte === "string" && R.veredicto.soporte.includes("%"),
    "…y su soporte también, con su cifra: ADI tiene con qué contestar");
  // ⚠️ LA "LECTURA DE RESPALDO" SE ELIMINÓ (owner 2026-08-08 · "hay mucho texto"): decía las MISMAS cuatro cifras
  // de los cuatro KPI que van justo abajo, con sus mismos pies. Se verifica que no haya vuelto en otra forma.
  ok(!R.veredicto.lectura, "la lectura de respaldo ya no existe en el módulo");
  ok(!/^Vendiste /m.test(T), "…ni quedó su frase suelta en la vista");
  for (const k of R.kpis) ok(T.includes(k.valor), `pero la cifra sigue a la vista, en su KPI — ${k.label} ${k.valor}`);
  // LOS 4 KPI: los del módulo, y ninguno más
  for (const k of R.kpis) {
    ok(T.includes(k.label) && T.includes(k.valor), `KPI "${k.label}" con su cifra ${k.valor}`);
    ok(T.includes(k.pie), `…y su pie declarado ("${k.pie}")`);
  }
  ok(R.kpis.length === 4, `son exactamente 4 KPI — ${R.kpis.length}`);
  // EL PLANO, EL PUENTE, LOS INSIGHTS: cifras del módulo
  ok(!T.includes(R.tension.reconciliaCorta), "la reconciliación cabeza/cola tampoco se imprime: era conclusión");
  ok(typeof R.tension.reconciliaCorta === "string" && R.tension.reconciliaCorta.length > 10,
    "…y el módulo la sigue armando, para cuando ADI la cuente — " + R.tension.reconciliaCorta);
  // LAS DOS CAUSAS del margen (lo único que quedó en el movimiento 02, owner 2026-08-07)
  ok(T.includes(R.deterioro.margen.acciones.referencias[0].totalFmt), `lo recuperable en acciones comerciales — ${R.deterioro.margen.acciones.referencias[0].totalFmt}`);
  ok(T.includes(R.deterioro.margen.costoPrecio.lectura), "y la lectura de costo contra precio");
  /* el sello ya no se PINTA (owner 2026-08-20): se exige en el DATO, que es donde manda. */
  /* Solo `costoPrecio` lleva sello EN EL DATO. El «probado» de las acciones era un literal de la vista, no un
     campo del módulo: al sacar el chip se fue con él, y no hay nada que exigir donde nunca hubo dato. */
  ok(R.deterioro.margen.costoPrecio.estatus === "indicado", "la causa derivada lleva su sello declarado en el módulo");
  const i0 = R.insights[0];
  ok(T.includes(i0.entidad) && T.includes(i0.enJuegoFmt), `la primera decisión — ${i0.entidad} · ${i0.enJuegoFmt}`);
  const _g0 = R.prioridades.grupos.find((g) => g.filas.some((f) => f.entidad === i0.entidad));
  ok(!!_g0 && T.includes(_g0.accionTitulo || _g0.filas.find((f) => f.entidad === i0.entidad).accionCorta),
    "la acción concreta está a la vista: en el título del grupo, o en la fila si el grupo quedó mezclado");
  ok(!!_g0 && (_g0.faltas || []).length > 0 && _g0.faltas.every((t) => T.includes(t)),
    "…y qué falta aislar, al pie del grupo — todos los distintos, ninguno de más");
  ok(!T.includes(i0.razon), "la tarjeta larga de informe ya no está — quedó la fila corta");
  // la primera profundización sugerida YA NO es una banda aparte: es la PRIMERA FILA de decisión (owner: no
  // repetir cifras ni conceptos). Se verifica que ese lugar lo ocupe la cuenta de mayor prioridad del módulo.
  ok(!T.includes("Primera profundización sugerida:"), "la banda separada de \"primera profundización\" ya no existe");
  // Con una CARD por grupo (owner 2026-08-08), la prioridad se lee en el ORDEN de las cards: el grupo peligroso
  // primero. Se comprueba sobre la posición real en el texto, que es lo que el usuario recorre.
  const _gs = R.prioridades.grupos;
  ok(_gs.length < 2 || T.indexOf(_gs[0].label) < T.indexOf(_gs[1].label),
    `el margen abre el bloque 03 — "${_gs[0].label}"`);
  /* El orden cambió a propósito (owner 2026-08-08): la card que separaba a las cuentas con los DOS deterioros se
   * eliminó, así que su prioridad sobrevive en el ORDEN — van primero dentro de su grupo. "La de mayor impacto
   * encabeza" ya no describe la regla vigente; describe la anterior. */
  const _ambos = new Set(R.prioridades.ambos);
  ok(_gs.every((g) => g.filas.map((f) => (_ambos.has(f.entidad) ? 1 : 0)).every((v, k, a) => k === 0 || a[k - 1] >= v)),
    `las cuentas con los dos deterioros encabezan su grupo — ${R.prioridades.ambos.join(", ") || "ninguna"}`);
  ok(!R.prioridades.ambos.length || T.includes(R.prioridades.ambos[0]), "…y el encabezado del bloque las nombra");
  // EL GRÁFICO: las barras del módulo, con sus nombres y montos
  for (const b of R.pareto.ventas.barras) ok(T.includes(b.nombre) && T.includes(b.fmt), `barra "${b.nombre}" (${b.fmt}) dibujada`);
  ok(T.includes(R.pareto.ventas.cruce80), `el cruce real del 80% se nombra — ${R.pareto.ventas.cruce80}`);
  ok(T.includes(R.pareto.ventas.nota), "la nota del gráfico es la del módulo");
  cleanup();
}

/* ── [1a] LA CARTERA · la primera tabla, con sus flechas (owner 2026-08-08) ────────────────────────────────────
 * Lo que se protege acá no es el diseño: es que lo que se VE sea lo que el módulo calculó. Las flechas se dibujan
 * a partir de `dir`, y una flecha que apunte al revés del signo sería peor que no tenerla. */
H("[1a] EL NEGOCIO, CLIENTE POR CLIENTE · el top 10, la cartera completa y las flechas");
{
  const { container } = abrir(evTemporal());
  const K = R.cartera;
  const T = container.textContent;
  ok(T.includes("El negocio, cliente por cliente"), "el bloque está");
  ok(T.includes(K.lectura), "la lectura es la del módulo, verbatim");
  // LA TABLA: se identifica por su primer <th>, no barriendo todas (hay tres tablas en la vista)
  const tabla = [...container.querySelectorAll("table")].find((t) => (t.querySelector("th") || {}).textContent?.startsWith("Cliente"));
  ok(!!tabla, "la tabla existe y su primera columna es Cliente");
  const ths = [...tabla.querySelectorAll("th")].map((t) => t.textContent);
  for (const c of K.columnas) ok(ths.some((t) => t.startsWith(c.label)), `columna "${c.label}" presente`);
  ok(ths.length === 7, `son exactamente las 7 que pidió el owner — ${ths.length}`);
  /* EL SELLO SALIÓ DE PANTALLA, NO DEL DATO (owner 2026-08-20, reafirmado: «te dije que quitaras el probado»).
     El chip PROBADO/INDICADO confundía a quien lee. Lo que este chequeo protege ahora es lo que de verdad importa:
     que el MÓDULO siga declarando el sello de cada referencia y que sigan siendo DISTINTOS entre sí — el año
     anterior es dato cerrado y el presupuesto es un plan. Si algún día los dos vinieran sellados igual, sería un
     defecto del motor y este gate lo caza, se pinte o no. */
  ok(K.columnas[5].estatus === "probado" && K.columnas[6].estatus === "indicado",
    "las dos referencias siguen SELLADAS distinto EN EL DATO: probado / indicado");
  // POR DEFECTO, EL TOP 10 · y la cola no está a la vista
  const cuerpo = tabla.querySelector("tbody");
  ok(cuerpo.querySelectorAll("tr").length === K.tope, `arranca mostrando las primeras ${K.tope}`);
  const ocultas = K.filas.slice(K.tope);
  ok(ocultas.every((f) => !cuerpo.textContent.includes(f.nombre)), `las otras ${K.resto} no se dibujan todavía`);
  ok(T.includes(K.resumenTope), "…y la vista DICE cuánta venta cubre lo que se está viendo");
  // CADA FILA VISIBLE, con sus seis cifras
  for (const f of K.filas.slice(0, K.tope)) {
    const fila = [...cuerpo.querySelectorAll("tr")].find((tr) => tr.textContent.startsWith(f.nombre));
    ok(!!fila, `fila "${f.nombre}" dibujada`);
    const td = [...fila.querySelectorAll("td")].map((x) => x.textContent);
    ok(td[1] === f.pesoFmt && td[2] === f.ventaFmt && td[3] === f.contribucionFmt && td[4] === f.margenFmt,
      `…con participación ${f.pesoFmt}, venta ${f.ventaFmt}, contribución ${f.contribucionFmt} y margen ${f.margenFmt}`);
    ok(td[5].includes(f.vsAnterior.pctFmt) && td[5].includes(f.vsAnterior.montoFmt), `…gap vs año anterior ${f.vsAnterior.pctFmt} (${f.vsAnterior.montoFmt})`);
    ok(td[6].includes(f.vsPresupuesto.pctFmt) && td[6].includes(f.vsPresupuesto.montoFmt), `…gap vs presupuesto ${f.vsPresupuesto.pctFmt} (${f.vsPresupuesto.montoFmt})`);
    // LA FLECHA SIGUE A `dir`, SIEMPRE
    const flecha = f.vsAnterior.dir === "sube" ? "▲" : f.vsAnterior.dir === "baja" ? "▼" : null;
    ok(flecha ? td[5].includes(flecha) : !/[▲▼]/.test(td[5]), `…y su flecha apunta ${f.vsAnterior.dir}`);
  }
  // EL TOTAL: una fila más, y ES el KPI de arriba
  const pie = tabla.querySelector("tfoot");
  ok(!!pie && pie.textContent.includes(K.total.nombre), "el total cierra la tabla como una fila más");
  ok(pie.textContent.includes(K.total.ventaFmt) && pie.textContent.includes(K.total.contribucionFmt), `…con la venta ${K.total.ventaFmt} y la contribución ${K.total.contribucionFmt} del negocio`);
  ok(K.total.ventaFmt === R.kpis[0].valor, "…que son exactamente las del KPI de arriba: la tabla no puede contradecirlo");
  ok(pie.textContent.includes(K.total.vsAnterior.pctFmt) && pie.textContent.includes(K.total.vsPresupuesto.pctFmt), "…y los dos gaps del total");
  // LOS COLORES DICEN LO MISMO QUE LOS SIGNOS
  // jsdom serializa el color como rgb(...) con espacios; se tolera también el hex del tema por si no lo normaliza
  const verde = /rgb\(\s*16,\s*185,\s*129\s*\)|#10b981/i, rojo = /rgb\(\s*244,\s*63,\s*94\s*\)|#f43f5e/i;
  const celdas = [...cuerpo.querySelectorAll("tr")].map((tr) => [...tr.querySelectorAll("td")][5]);
  const bien = celdas.filter((c, i) => {
    const d = K.filas[i].vsAnterior.dir, col = (c.getAttribute("style") || "") + getComputedStyle(c).color;
    return d === "sube" ? verde.test(col) : d === "baja" ? rojo.test(col) : true;
  }).length;
  ok(bien === celdas.length, `el color acompaña a la dirección en las ${celdas.length} filas visibles`);
  cleanup();
}

H("[1a2] LA CARTERA COMPLETA · el botón la abre y la vuelve a cerrar");
{
  const { container } = abrir(evTemporal());
  const K = R.cartera;
  const btn = botones(container).find((b) => b.textContent.includes(K.verTodosLabel));
  ok(!!btn, `el botón "${K.verTodosLabel}" está y declara cuántas cuentas hay`);
  fireEvent.click(btn);
  const tabla = [...container.querySelectorAll("table")].find((t) => (t.querySelector("th") || {}).textContent?.startsWith("Cliente"));
  ok(tabla.querySelector("tbody").querySelectorAll("tr").length === K.n, `al abrirla se ven las ${K.n} cuentas`);
  for (const f of K.filas.slice(K.tope)) ok(tabla.textContent.includes(f.nombre), `…incluida "${f.nombre}", que estaba en la cola`);
  const volver = botones(container).find((b) => b.textContent.includes(K.verMenosLabel));
  ok(!!volver, `y el botón ofrece volver — "${K.verMenosLabel}"`);
  fireEvent.click(volver);
  const t2 = [...container.querySelectorAll("table")].find((t) => (t.querySelector("th") || {}).textContent?.startsWith("Cliente"));
  ok(t2.querySelector("tbody").querySelectorAll("tr").length === K.tope, "vuelve al top y no queda expandida");
  cleanup();
}

/* ── [1a3] LA CARTERA EN PANTALLA ANGOSTA · lo que se aparta, se dice ──────────────────────────────────────────
 * Siete columnas en un teléfono empujan los dos gaps —lo único que este bloque agrega sobre el resto de la vista—
 * fuera del primer vistazo. Se apartan participación y contribución, y lo que NO se negocia es que la vista lo
 * declare: esconder una columna sin decirlo es la versión chica de mentir por omisión. */
H("[1a3] LA CARTERA EN ANGOSTO · los dos gaps sobreviven al teléfono, y lo apartado se declara");
{
  _MQ_MATCHES = true;
  const { container } = abrir(evTemporal());
  const K = R.cartera;
  const tabla = [...container.querySelectorAll("table")].find((t) => (t.querySelector("th") || {}).textContent?.startsWith("Cliente"));
  const ths = [...tabla.querySelectorAll("th")].map((t) => t.textContent);
  ok(ths.length === 5, `en angosto quedan 5 columnas — ${ths.map((t) => t.replace(/probado|indicado/, "").trim()).join(" · ")}`);
  ok(ths.some((t) => t.startsWith("vs año anterior")) && ths.some((t) => t.startsWith("vs presupuesto")),
    "los DOS gaps sobreviven: son lo que este bloque aporta");
  ok(ths.some((t) => t.startsWith("Venta")) && ths.some((t) => t.startsWith("Margen")), "…y la venta y el margen con ellos");
  ok(!ths.some((t) => t.startsWith("Participación")) && !ths.some((t) => t.startsWith("Contribución")), "participación y contribución se apartan");
  ok(container.textContent.includes(K.notaAngosta), `…y la vista DICE cuáles se apartó y dónde siguen — "${K.notaAngosta}"`);
  // las cifras que quedan son las mismas: apartar una columna no puede mover ninguna otra
  const fila = [...tabla.querySelectorAll("tbody tr")].find((tr) => tr.textContent.startsWith(K.filas[0].nombre));
  const td = [...fila.querySelectorAll("td")].map((x) => x.textContent);
  ok(td[1] === K.filas[0].ventaFmt && td[2] === K.filas[0].margenFmt, `${K.filas[0].nombre} conserva sus cifras — ${td[1]} · ${td[2]}`);
  ok(td[3].includes(K.filas[0].vsAnterior.pctFmt) && td[4].includes(K.filas[0].vsPresupuesto.pctFmt), "…y sus dos gaps intactos");
  ok(tabla.querySelector("tfoot").textContent.includes(K.total.ventaFmt), "el total sigue cerrando la tabla");
  cleanup();
  _MQ_MATCHES = false;
}

H("[1b] EL EVOLUTIVO · tres líneas, y su total ES el del KPI");
{
  const { container } = abrir(evTemporal());
  const T = container.textContent;
  const e = R.evolutivo;
  for (const s of e.series) {
    ok(T.includes(s.label) && T.includes(s.totalFmt), `serie "${s.label}" con su total ${s.totalFmt}`);
    const b = botones(container).find((x) => x.textContent.includes(s.label) && x.textContent.includes(s.totalFmt));
    ok(!!b && !!s.estatus, `…con su sello «${s.estatus}» declarado en el módulo y apagable desde la leyenda`);
  }
  ok(T.includes(e.totalActualFmt) && e.totalActualFmt === R.kpis[0].valor,
    `RECONCILIA a la vista: el cierre del gráfico y el KPI de ventas son el MISMO número — ${e.totalActualFmt}`);
  ok(T.includes(e.lectura), "la lectura del año viene del módulo (cierre, variación, mes más alto y más bajo)");
  ok(T.includes(e.nota) && /cierran con el KPI|anclad/i.test(e.nota), "…y la nota dice qué series cierran con el KPI y cuál es solo un plan");
  ok(e.meses.every((m) => T.includes(m)), `los ${e.meses.length} meses están rotulados`);
  ok(T.includes(e.maxMes) && T.includes(e.maxFmt) && T.includes(e.minMes) && T.includes(e.minFmt),
    `el mes más alto (${e.maxMes} ${e.maxFmt}) y el más bajo (${e.minMes} ${e.minFmt}) se identifican solos`);
  // las tres arrancan VISIBLES (regla del owner) y la leyenda las apaga
  const legPpto = botones(container).find((x) => x.textContent.includes("Presupuesto") && x.textContent.includes(e.series[2].totalFmt));
  const svgAntes = container.querySelectorAll("path").length;
  fireEvent.click(legPpto);
  ok(container.querySelectorAll("path").length < svgAntes, "apagar una serie la saca del dibujo (arrancaban las TRES prendidas)");
  fireEvent.click(legPpto);
  ok(container.querySelectorAll("path").length === svgAntes, "…y volver a tocarla la devuelve");
  cleanup();
}

H("[1c] QUIÉN SOSTIENE EL NEGOCIO · Clientes / Familias / SKU / Canales");
{
  const { container } = abrir(evTemporal());
  const S = R.sostiene;
  const T = container.textContent;
  ok(T.includes("Quién sostiene el negocio"), "el bloque está");
  for (const c of S.columnas) ok(T.includes(c.label), `columna "${c.label}"`);
  // la vista tiene VARIAS tablas: se busca la de este bloque por su primer encabezado
  const tablaDe = (c) => [...c.querySelectorAll("table")].find((t) => (t.querySelector("th") || {}).textContent === S.columnas[0].label);
  const tabla = tablaDe(container);
  ok(!!tabla, "la tabla está identificada por su primera columna");
  const th = [...tabla.querySelectorAll("th")].map((x) => x.textContent);
  ok(th.length === S.columnas.length && S.columnas.every((c, i) => th[i] === c.label), `tiene las 7 columnas del módulo — ${th.join(" · ")}`);
  ok(!th.some((h) => /rotaci/i.test(h)), "sin columna Rotación: es del inventario, no de estos ejes");
  const v0 = S.vistas[0];
  ok(v0.key === "cliente", "abre en CLIENTES");
  ok(v0.filas.filter((f) => f.enGrupo).every((f) => T.includes(f.nombre)), `con los ${v0.grupoN} del grupo 80%`);
  ok(T.includes(v0.lectura), "…y su lectura, que localiza dónde se sostiene y dónde se diluye");
  ok(T.includes(v0.notaFuente), "…y la nota de fuente");
  ok(T.includes(v0.reconcilia ? "concilia" : "otro corte"), `…rotulado ${v0.reconcilia ? "CONCILIA" : "OTRO CORTE"}`);
  // "Ver Ficha" SOLO en el eje CLIENTE: la Ficha Ejecutiva es de cliente y prometerla en otro eje sería mentir
  const nombres = new Set(R.rows.map((r) => r.name));
  const fichas = botones(container).filter((b) => (b.title || "").startsWith("Abrir la Ficha de "));
  ok(fichas.length > 0 && fichas.every((b) => nombres.has((b.title || "").replace("Abrir la Ficha de ", ""))),
    `los ${fichas.length} accesos a Ficha apuntan a clientes REALES`);
  // el switch de la cola
  if (v0.colaN > 0) {
    const ver = conTexto(container, `Ver ${v0.label.toLowerCase()} completos (${v0.n})`);
    ok(!!ver, `se puede abrir la cartera completa del eje (${v0.n})`);
    fireEvent.click(ver);
    ok(v0.filas.every((f) => container.textContent.includes(f.nombre)), `…y aparecen los ${v0.n}`);
    ok([...container.querySelectorAll("span")].some((s) => s.textContent === "80%"), "…con marca en los que están en el grupo 80%");
    fireEvent.click(conTexto(container, "Ver solo el grupo"));
    // se mira DENTRO de la tabla del bloque: esa cuenta aparece legítimamente en otros bloques de la vista
    ok(tablaDe(container) && !tablaDe(container).textContent.includes(v0.filas.filter((f) => !f.enGrupo)[0].nombre),
      "…y la tabla se vuelve a cerrar al grupo");
  }
  // el selector recorre los cuatro ejes, cada uno con SU declaración de calidad de dato
  for (const v of S.vistas.slice(1)) {
    const b = conTexto(container, `${v.label} (${v.grupoN})`);
    ok(!!b, `el eje "${v.label}" se ofrece con su grupo 80% (${v.grupoN})`);
    fireEvent.click(b);
    ok(v.filas.filter((f) => f.enGrupo).every((f) => container.textContent.includes(f.nombre)), `…y muestra sus ${v.grupoN}`);
    ok(container.textContent.includes(v.notaFuente), `…declarando su fuente y su cierre (${v.reconcilia ? "concilia" : "no concilia, y lo dice"})`);
    ok(container.textContent.includes(v.lectura), "…y su lectura");
    // fuera del eje cliente NO se ofrece Ficha: no existe Ficha de familia ni de canal. Se mira dentro de ESTA
    // tabla — los demás bloques de la vista sí ofrecen Ficha, y con razón: hablan de clientes.
    if (v.key !== "cliente") {
      const tb = tablaDe(container);
      ok(!!tb && ![...tb.querySelectorAll("button")].some((x) => (x.title || "").startsWith("Abrir la Ficha de ")),
        `en ${v.label} la tabla NO promete una Ficha que no existe`);
    }
  }
  // "Puntos de venta" NO se ofrece, y la limitación se declara
  ok(!botones(container).some((b) => /punto de venta|sucursal/i.test(b.textContent)), "no se ofrece un eje por punto de venta que el dato no sostiene");
  ok(container.textContent.includes(S.limitacion), "…y la limitación se declara en la ayuda del bloque");
  cleanup();
}

H("[1d] DÓNDE SE DETERIORA EL MARGEN · las dos cosas que lo mueven");
{
  const { container } = abrir(evTemporal());
  const d = R.deterioro, acc = d.margen.acciones, cp = d.margen.costoPrecio;
  const T = container.textContent;
  ok(T.includes("Qué mueve el margen"), "el bloque de las dos causas está");
  // SOLO ESO (owner 2026-08-07 "dejá solo lo que está en la foto"): la identidad, la venta no alcanzada y el
  // detalle de margen no capturado salieron de esta sección.
  const seccion = T.slice(T.indexOf("Dónde se deteriora el margen"), T.indexOf("Qué hacer primero"));
  ok(!seccion.includes("Cómo se forma el margen"), "la identidad venta−costo−acciones=contribución ya no está acá");
  ok(!seccion.includes("Venta no alcanzada"), "«Venta no alcanzada» ya no está acá");
  ok(!seccion.includes("Margen no capturado"), "«Margen no capturado» ya no está acá");
  ok(!seccion.includes("Dónde se frena la venta"), "…ni su encabezado");
  ok(!seccion.includes(R.formacion.lectura), "…ni la lectura del reparto de la venta");
  ok(!seccion.includes(d.venta.referencias[0].insight), "…ni el insight de la venta no alcanzada");
  // pero el DATO sigue vivo: es lo que alimenta el cruce del bloque 03
  ok(d.venta.referencias.length === 2 && d.margen.filas.length >= 0,
    "el dato de venta y margen sigue en el módulo — es lo que cruza el bloque 03");

  // A · acciones comerciales, contra el promedio de TU cartera y contra tu meta
  ok(T.includes("Acciones comerciales") && T.includes(acc.promedioFmt), `el promedio ponderado de la cartera se muestra — ${acc.promedioFmt}`);
  const prom = acc.referencias[0];
  ok(T.includes(prom.totalFmt), `y lo recuperable al promedio — ${prom.totalFmt}`);
  ok(T.includes(acc.lectura), "…con su lectura, que da las dos cifras");
  ok(prom.filas.slice(0, 4).every((x) => T.includes(x.nombre) && T.includes(x.recuperableFmt)),
    `las cuentas sobre el promedio con su recuperable — ${prom.filas.slice(0, 2).map((x) => `${x.nombre} ${x.recuperableFmt}`).join(", ")}`);
  ok(!!R.deterioro.margen.acciones.referencias.length, "…la carga se mide contra referencias declaradas, cuenta por cuenta");
  /* EL COLOR, EN LA CIFRA PRINCIPAL Y EN LA CARGA — y en ninguna otra (owner 2026-08-08, dos rondas):
   *   · la CARGA por cuenta va en ROJO: es plata que sale. Lo pidió explícito.
   *   · el TITULAR del bloque ($293K recuperables) va en verde: es el número que hay que mirar primero.
   *   · el recuperable POR FILA va en blanco. Pintarlo también le quitaba al titular lo único que el color le
   *     daba. "Solo debe estar en verde los números principales; los otros en blanco."
   * Se verifica el par completo: si el titular pierde el verde, el bloque se queda sin jerarquía. */
  const ROJO = /rgb\(\s*244,\s*63,\s*94\s*\)|#f43f5e/i, VERDE = /rgb\(\s*16,\s*185,\s*129\s*\)|#10b981/i;
  const spans = [...container.querySelectorAll("span")];
  const sTitular = spans.filter((s) => s.textContent === prom.totalFmt && VERDE.test(s.getAttribute("style") || ""));
  ok(sTitular.length > 0, `el titular del bloque (${prom.totalFmt}) es el que va en verde`);
  for (const x of prom.filas.slice(0, 4)) {
    const sCarga = spans.filter((s) => s.textContent === x.cargaFmt && /entrega/.test(s.getAttribute("title") || ""));
    ok(sCarga.length > 0 && sCarga.every((s) => ROJO.test(s.getAttribute("style") || "")),
      `${x.nombre}: lo que ENTREGA (${x.cargaFmt}) va en rojo — es plata que sale`);
    const sRec = spans.filter((s) => s.textContent === x.recuperableFmt);
    ok(sRec.length > 0 && sRec.every((s) => !VERDE.test(s.getAttribute("style") || "")),
      `…y su recuperable (${x.recuperableFmt}) va en blanco: el verde es del titular`);
  }
  // …y se puede cambiar la referencia a la meta
  const meta = acc.referencias[1];
  const bMeta = botones(container).find((b) => b.hasAttribute("aria-pressed") && b.textContent === meta.refFmt);
  ok(!!bMeta, `se puede cambiar la referencia a tu meta (${meta.refFmt})`);
  fireEvent.click(bMeta);
  ok(container.textContent.includes(meta.totalFmt), `…y el recuperable se recalcula — ${meta.totalFmt}`);
  ok(meta.filas.slice(0, 4).every((x) => container.textContent.includes(x.nombre)), "…con las cuentas que quedan sobre ESA referencia");

  // B · costo contra precio · la variación de cada serie contra sí misma
  ok(T.includes("Costo contra precio"), "el lado del costo está");
  ok(T.includes(cp.lectura), `con su lectura, que sigue al dato — "${cp.lectura.slice(0, 70)}…"`);
  ok(cp.filas.slice(0, 4).every((x) => T.includes(x.dCostoFmt) && T.includes(x.dPrecioFmt)),
    "cada cuenta muestra cómo se movió su costo y su precio");
  ok(T.includes(cp.comprimenN ? `−${cp.perdidaFmt}` : `+${cp.gananciaFmt}`),
    `y el efecto en plata — ${cp.comprimenN ? `−${cp.perdidaFmt} perdidos` : `+${cp.gananciaFmt} ganados`}`);
  ok(R.deterioro.margen.costoPrecio.estatus === "indicado", "el efecto sigue sellado INDICADO en el dato: es una variación derivada, no el margen contable");

  // ── EL OTRO LADO DEL PROMEDIO · los que entregan MENOS (owner 2026-08-07) ──
  const bajo = acc.bajo;
  /* "DEL OTRO LADO" SE ELIMINÓ (owner 2026-08-08: "eso no aporta mucho"). Era honesto —decía explícito que NO son
   * plata a capturar— pero justamente por eso no movía ninguna decisión: ocho chips y tres líneas para concluir
   * que ahí no hay nada que hacer. El DATO sigue en el módulo, y eso también se verifica: si alguna vez vuelve a
   * la vista, vuelve completo y con su advertencia, no como un recuperable inventado. */
  ok(!T.includes("Del otro lado"), "«Del otro lado» ya no está en la vista");
  ok(!T.includes(bajo.lectura), "…ni su lectura suelta");
  ok(bajo.n > 0 && !("recuperable" in (bajo.filas[0] || {})),
    `pero el dato sigue en el módulo, sin recuperable inventado — ${bajo.n} cuentas`);
  // LITERAL ACTUALIZADO, CANDADO INTACTO (La Poda F2): sigue exigiendo la MISMA advertencia; sólo cambia la
  // palabra, porque «plata» está vetada en superficie y esta lectura puede volver a la vista.
  ok(/No son capital a capturar/.test(bajo.lectura) && /entregarles más/.test(bajo.lectura),
    "y conserva su advertencia: si vuelve a la vista, vuelve con la trampa cerrada");

  // "VENDEN MUCHO PERO DEJAN POCO" se MUDÓ a "Quién sostiene el negocio" (owner 2026-08-08) · se verifica que
  // NO haya quedado también acá: mudarlo y dejar una copia sería peor que no moverlo.
  // se mide sobre la SECCIÓN 02, no sobre la vista entera: el botón nuevo vive arriba y nombraría un falso positivo
  const s02 = T.slice(T.indexOf("Dónde se deteriora el margen"), T.indexOf("Qué hacer primero"));
  ok(!/[Vv]enden mucho pero dejan poco/.test(s02), "el porqué ya no vive en el bloque 02: se mudó a quién sostiene");
  ok(!s02.includes(d.margen.porQue.lectura), "…ni quedó su lectura suelta");
  cleanup();
}

/* ── [1d2] EL PORQUÉ, PEGADO A LA TABLA QUE LO NECESITA (owner 2026-08-08) ─────────────────────────────────────
 * "Las cuentas que venden mucho y dejan poco margen deberíamos integrarlas en la sección de la segunda foto; tal
 * vez podría dejar un botón que diga «clientes que venden mucho pero dejan poco margen: por qué», y ahí se
 * despliega." Son filas de ESA tabla: vivían a dos pantallas de distancia y el lector tenía que acordarse de
 * quiénes eran. Va CERRADO por defecto — la pregunta la hace quien la tiene, no la pantalla. */
H("[1d2] VENDEN MUCHO PERO DEJAN POCO · dentro de quién sostiene, y cerrado por defecto");
{
  const { container } = abrir(evTemporal());
  const pq = R.deterioro.margen.porQue;
  const btn = botones(container).find((b) => /venden mucho pero dejan poco margen: por qué/i.test(b.textContent));
  ok(!!btn, `el botón está y declara cuántas cuentas hay — "${btn && btn.textContent.trim()}"`);
  ok(btn.textContent.includes(String(pq.n)), `…con el conteo real — ${pq.n}`);
  ok(btn.getAttribute("aria-expanded") === "false", "arranca CERRADO: la pregunta la hace quien la tiene");
  ok(!pq.filas.some((x) => container.textContent.includes(x.lectura)), "…y su contenido no está montado todavía");
  // VIVE DENTRO DE LA TARJETA de quién sostiene, no como un bloque suelto debajo: se comprueba por ancestro, que
  // es lo que de verdad determina si está integrado o solo cerca.
  const tarjeta = [...container.querySelectorAll("div")]
    .filter((dv) => dv.textContent.includes("Quién sostiene el negocio") && dv.querySelector("table"))
    .sort((a, b) => a.textContent.length - b.textContent.length)[0];
  ok(!!tarjeta && tarjeta.contains(btn), "el botón vive DENTRO de la tarjeta de quién sostiene, no suelto debajo");
  const T2 = container.textContent;
  ok(T2.indexOf("Quién sostiene el negocio") < T2.indexOf("Clientes que venden mucho pero dejan poco"),
    "…y después de la tabla que explica, no antes");
  fireEvent.click(btn);
  const T3 = container.textContent;
  ok(T3.includes(pq.lectura), "al abrirlo aparece la lectura global");
  for (const x of pq.filas) {
    ok(T3.includes(x.nombre) && T3.includes(x.margenFmt) && T3.includes(x.brechaFmt), `${x.nombre}: margen ${x.margenFmt} y brecha ${x.brechaFmt}`);
    ok(T3.includes(`acciones ${x.efCargaFmt}`) && T3.includes(`precio/costo ${x.efCostoFmt}`),
      `  …con la brecha partida: acciones ${x.efCargaFmt} + precio/costo ${x.efCostoFmt}`);
    ok(T3.includes(x.lectura), "  …y la respuesta a por qué deja poco");
  }
  ok(pq.filas.every((x) => !x.contexto || T3.includes(x.contexto)), "y el contexto unitario está a la vista");
  const obj = pq.filas[0].nombre;
  ok(botones(container).some((b) => b.title === `Abrir la Ficha de ${obj}`), `${obj} abre su Ficha desde este bloque`);
  // SOLO EN EL EJE CLIENTE: el análisis se construye cuenta por cuenta; prometerlo en familias sería mentir
  const bFam = botones(container).find((b) => b.hasAttribute("aria-pressed") && /^Familias/.test(b.textContent));
  fireEvent.click(bFam);
  ok(!botones(container).some((b) => /venden mucho pero dejan poco margen: por qué/i.test(b.textContent)),
    "en el eje Familias no se ofrece: el análisis es por cuenta");
  cleanup();
}

H("[1e] QUÉ HACER PRIMERO · el cruce, con el grupo peligroso adelante");
{
  const { container } = abrir(evTemporal());
  const P = R.prioridades;
  const T = container.textContent;
  ok(T.includes(P.encabezado), `el encabezado sale del cruce — "${P.encabezado}"`);
  for (const g of P.grupos) {
    ok(T.includes(g.label), `grupo "${g.label}"`);
    ok(T.includes(g.criterio) && T.includes(g.porQue), "…con su criterio y su porqué a la vista");
    for (const x of g.filas) {
      ok(T.includes(x.entidad), `  ${x.entidad}`);
      // Las cifras de la fila las decide el módulo según el problema del grupo, y se miden contra el PROMEDIO de
      // la cartera — no contra una meta que el usuario no fijó (owner 2026-08-08).
      for (const c of x.cifras) ok(T.includes(c.valor) && T.includes(c.etiqueta), `  …${c.valor} ${c.etiqueta}`);
      ok(!/\bmeta\b/i.test(x.cifras.map((c) => c.etiqueta).join(" ")), "  …y ninguna habla de una «meta» ajena");
    }
  }
  const prot = P.grupos.find((g) => g.key === "proteger");
  if (prot) {
    ok(T.indexOf(prot.label) < Math.min(...P.grupos.filter((g) => g.key !== "proteger").map((g) => T.indexOf(g.label))),
      "el grupo peligroso se pinta PRIMERO");
    ok(/agranda la brecha en vez de cerrarla/.test(T), "y el aviso del error comercial está a la vista");
  }
  // cada fila abre la Ficha de esa cuenta
  const primera = P.grupos[0].filas[0];
  const btn = botones(container).find((b) => b.title === `Abrir la Ficha de ${primera.entidad}`);
  ok(!!btn, `la fila de ${primera.entidad} ofrece su Ficha`);
  fireEvent.click(btn);
  ok(container.textContent.includes(`Importancia de ${primera.entidad} en tu cartera`), `y abre la Ficha de ${primera.entidad}`);
  cleanup();
}

H("[2] ALCANCE GLOBAL · una selección previa NO puede teñir la cara Comercial");
{
  // A · entrada limpia (tendencia global)
  const a = abrir(evTemporal());
  /* LA MARCA DE CABECERA YA NO LLEVA EL VEREDICTO: se quitó de la pantalla. Los cuatro KPI con su pie son ahora
     la cabecera entera, y prueban igual de bien lo que esta sección cuida — que una selección previa no tiña. */
  const marcaA = R.kpis.map((k) => k.valor + k.pie).join("¶");
  ok(a.container.textContent.includes(R.kpis[0].valor + R.kpis[0].pie),
    "entrada limpia: la cabecera es la del negocio completo");
  cleanup();

  // B · entrada por el deep-link de UN cliente → abre la Ficha de ese cliente → saltar a Comercial
  const cliente = R.primera.entidad;
  const b = abrir(evPerfil(cliente));
  ok(b.container.textContent.includes(`Importancia de ${cliente} en tu cartera`), `el deep-link abre la Ficha Ejecutiva de ${cliente} (comportamiento previo intacto)`);
  const tabComercial = porTexto(b.container, "Comercial");
  ok(!!tabComercial, "la cara Comercial es alcanzable desde la Ficha");
  fireEvent.click(tabComercial);
  const T = b.container.textContent;
  ok(!T.includes(R.veredicto.titular), "por deep-link tampoco aparece el veredicto: se quitó de las dos entradas");
  for (const k of R.kpis) ok(T.includes(k.valor) && T.includes(k.pie), `KPI "${k.label}" idéntico al de la entrada limpia (${k.valor})`);
  ok(marcaA.split("¶").every((frag) => T.includes(frag)), "TODAS las cifras de cabecera coinciden byte a byte con la entrada limpia");
  ok(T.includes("Concentración comercial · 80/20"), "el gráfico de concentración sigue siendo el del negocio");
  // …y NADA queda preseleccionado: sin la tabla legacy ya no hay dónde arrastrar una selección previa, pero la
  // ausencia se verifica igual — es la garantía la que importa, no el mecanismo que la sostenía.
  ok(!/\d+ seleccionados?/.test(T), "no hay selección previa en ninguna parte de la cara (el deep-link no la tiñe)");
  ok(!T.includes("Perfil vs promedio"), "…ni un perfil individual colgado de una selección");
  cleanup();
}

H("[3] NAVEGACIÓN A LA FICHA · detecta acá, explica allá (la Ficha REAL, no una vista paralela)");
{
  // a · desde una fila de decisión (el primer grupo del cruce, que es el que la vista pone adelante)
  {
    const { container } = abrir(evTemporal());
    const objetivo = R.prioridades.grupos[0].filas[0].entidad;
    const btn = botones(container).find((b) => b.title === `Abrir la Ficha de ${objetivo}` && b.textContent.includes("Abrir Ficha"));
    ok(!!btn, `la fila de decisión de ${objetivo} trae "Abrir Ficha"`);
    fireEvent.click(btn);
    ok(container.textContent.includes(`Importancia de ${objetivo} en tu cartera`),
      `abre la Ficha Ejecutiva REAL de ${objetivo} (cara Ficha)`);
    ok(!container.textContent.includes("Quién sostiene el negocio"), "…y deja la cara Comercial (es navegación, no un panel encima)");
    cleanup();
  }
  // b · desde la PRIMERA fila de decisión (que es la primera profundización sugerida, ya sin banda aparte)
  {
    const { container } = abrir(evTemporal());
    const btn = botones(container).find((b) => b.title === `Abrir la Ficha de ${R.primera.entidad}`);
    ok(!!btn, `la fila de ${R.primera.entidad} ofrece su Ficha`);
    fireEvent.click(btn);
    ok(container.textContent.includes(`Importancia de ${R.primera.entidad} en tu cartera`), `y abre la Ficha de ${R.primera.entidad}`);
    cleanup();
  }
  // c · desde una barra del gráfico de concentración (solo las entidades reales; los agregados no son una entidad)
  {
    const { container } = abrir(evTemporal());
    const real = R.pareto.ventas.barras.find((b) => b.tipo === "entidad");
    const agregada = R.pareto.ventas.barras.find((b) => b.tipo !== "entidad");
    const bReal = botones(container).find((b) => b.title === `Abrir la Ficha de ${real.nombre}` && b.textContent.includes(real.fmt));
    ok(!!bReal, `la barra de ${real.nombre} es clickeable`);
    if (agregada) {
      const bAgr = botones(container).find((b) => b.textContent.includes(agregada.nombre) && b.textContent.includes(agregada.fmt) && b.disabled);
      ok(!!bAgr, `la barra agregada "${agregada.nombre}" NO navega (no es una entidad — el dato no la sostiene)`);
    }
    fireEvent.click(bReal);
    ok(container.textContent.includes(`Importancia de ${real.nombre} en tu cartera`), `la barra abre la Ficha de ${real.nombre}`);
    cleanup();
  }
  // d · desde el nombre de una fila de LA CARTERA (bloque 2) · el camino que reemplazó al "Ver Ficha" de la
  //     tabla legacy: el nombre ES el acceso, sin una columna extra que lo repita
  {
    const { container } = abrir(evTemporal());
    const fila = R.cartera.filas[0].nombre;
    const bFicha = botones(container).find((b) => b.title === `Abrir la Ficha de ${fila}`);
    ok(!!bFicha, `el nombre de ${fila} en la cartera abre su Ficha`);
    fireEvent.click(bFicha);
    ok(container.textContent.includes(`Importancia de ${fila} en tu cartera`), `abre la Ficha de ${fila}`);
    cleanup();
  }
  // e · TODA fila de la cartera navega · antes había dos gestos (seleccionar = comparar, "Ver Ficha" = navegar)
  //     y esa ambigüedad se fue con la tabla legacy: acá tocar un cliente hace UNA sola cosa
  {
    const { container } = abrir(evTemporal());
    const conAcceso = R.cartera.filas.slice(0, R.cartera.tope)
      .filter((f) => botones(container).some((b) => b.title === `Abrir la Ficha de ${f.nombre}`));
    ok(conAcceso.length === R.cartera.tope, `las ${R.cartera.tope} cuentas visibles abren su Ficha — ${conAcceso.length}`);
    ok(!container.textContent.includes("seleccionado"), "y no queda un segundo gesto que compita: seleccionar-para-comparar salió con la tabla legacy");
    cleanup();
  }
}

/* ── [4] "EVIDENCIA COMPLETA · OPCIONAL" SE ELIMINÓ (owner 2026-08-08) ─────────────────────────────────────────
 * El 2026-08-07 la tabla legacy no se eliminaba, solo bajaba de plano: era el ÚNICO lugar donde vivía la cartera
 * entera. Dejó de serlo cuando el bloque 2 abrió las 13 cuentas con su propio "Ver la cartera completa", y a
 * partir de ahí era un segundo botón para lo mismo sobre una línea que repetía el alcance del veredicto.
 * Lo que este gate cuida es que no queden RESTOS: ni el encabezado, ni el botón, ni media grilla montada. */
H("[4] \"EVIDENCIA COMPLETA · OPCIONAL\" · eliminado, sin restos");
{
  const { container } = abrir(evTemporal());
  const T = container.textContent;
  ok(!T.includes("Evidencia completa"), "el encabezado ya no existe en Comercial");
  ok(!conTexto(container, "Ver todos los clientes"), "…ni su botón");
  ok(!conTexto(container, "Ocultar la cartera completa"), "…ni el de contraer");
  ok(!container.querySelector("[aria-expanded]") || ![...container.querySelectorAll("[aria-expanded]")].some((e) => /todos los clientes|cartera completa$/i.test(e.textContent)),
    "…ni un expansor huérfano");
  ok(!T.includes("Promedio clientes:"), "la grilla legacy no queda montada por otro camino");
  ok(!/Top 10|Peores 10/.test(T), "…ni sus filtros sueltos");
  ok(!T.includes(R.plano.colaFrase), "…ni la línea que repetía el alcance que el veredicto ya declara");
  // LA CAPACIDAD NO SE PIERDE: la cartera entera sigue a un clic, en el bloque 2
  const K = R.cartera;
  const btn = botones(container).find((b) => b.textContent.includes(K.verTodosLabel));
  ok(!!btn, `la cartera entera sigue disponible, ahora en el bloque 2 — "${K.verTodosLabel}"`);
  fireEvent.click(btn);
  ok(R.rows.every((r) => container.textContent.includes(r.name)), `y trae las ${R.rows.length} cuentas, cabeza y cola`);
  cleanup();
}

H("[4b] LOS DOS UNIVERSOS · reconciliados a la vista, nunca dos montos parecidos sueltos");
{
  const { container } = abrir(evTemporal());
  const T = container.textContent;
  const c = R.tension.cartera;
  // UNA SOLA LECTURA (owner 2026-08-07): la banda ALCANCE se disolvió; su contenido es ahora la segunda línea
  // del veredicto, en versión compacta — pero sigue nombrando los dos universos, que es lo que no se negocia.
  ok(!T.includes(R.tension.reconciliaCorta), "la reconciliación compacta ya NO se imprime: era una conclusión");
  ok(!T.includes(R.tension.reconcilia), "…y NO conviven la versión larga y la corta diciendo lo mismo");
  // los dos montos parecidos conviven, pero SIEMPRE con su universo pegado
  /* ⚠️ LA REGLA NO SE PIERDE, CAMBIA DE PLANO. La promesa era «nunca dos montos parecidos sueltos». Con la
     reconciliación fuera de la pantalla esos montos ya no conviven en prosa, así que la promesa se prueba donde
     ahora vive: en el DATO, comprobando que la frase del módulo sigue nombrando los dos universos. */
  ok(R.tension.reconciliaCorta.includes(c.enJuegoFmt) && R.tension.reconciliaCorta.includes(R.tension.concentraPctFmt),
    "en el dato los dos universos siguen nombrados y cerrando — " + R.tension.reconciliaCorta);
  ok(typeof R.tension.concentraPctFmt === "string" && R.tension.concentraPctFmt.includes("%"),
    "el % que el plano concentra lo sigue calculando el módulo — " + R.tension.concentraPctFmt);
  // REGLA DURA: cada aparición de la cifra de CARTERA viene con "toda la cartera" cerca; cada una de la del PLANO,
  // con "plano"/"que explican el X%". Se chequea sobre el texto real, no sobre la intención.
  //
  // ⚠️ LA PROSA Y LAS TABLAS SE MIDEN CON CRITERIOS DISTINTOS (2026-08-08). Una CELDA declara su universo por su
  // fila y su columna, y eso es una declaración MÁS FUERTE que la vecindad textual: "$4.7M" bajo la columna Venta
  // en la fila Ripley no puede leerse como la brecha material del plano, aunque el string sea el mismo. Barrer
  // ambas cosas con una sola ventana de texto plano daba un falso positivo — y, peor, empujaba a cambiar una cifra
  // correcta para callar al gate. Así que la prosa se evalúa sin tablas, y las tablas con su propia regla, abajo.
  const sinTablas = container.cloneNode(true);
  for (const t of [...sinTablas.querySelectorAll("table")]) t.remove();
  const P = sinTablas.textContent;
  const ventanas = (txt, aguja) => { const out = []; let i = txt.indexOf(aguja); while (i >= 0) { out.push(txt.slice(Math.max(0, i - 220), i + 220)); i = txt.indexOf(aguja, i + 1); } return out; };
  const vCartera = ventanas(P, c.enJuegoFmt);
  /* ⚠️ DE «TIENE QUE APARECER Y DECLARAR» A «SI APARECE, DECLARA». La prosa que rendía estos montos era la
     reconciliación, y se fue. La regla dura sigue en pie para el día que alguna prosa los vuelva a nombrar. */
  ok(vCartera.every((w) => /cartera completa|toda la cartera|cartera material|con brecha material/i.test(w)),
    "si " + c.enJuegoFmt + " aparece en prosa, declara su universo — " + vCartera.length + " apariciones");
  const vPlano = ventanas(P, R.tension.enJuegoFmt);
  ok(vPlano.every((w) => /plano de decisi[óo]n|clientes del plano|el plano concentra|que explican el|Dentro de ellos/i.test(w)),
    "y si " + R.tension.enJuegoFmt + " aparece, declara el suyo — " + vPlano.length + " apariciones");
  // Y LAS TABLAS, con el criterio que les corresponde: toda celda que rinda uno de esos montos tiene que estar en
  // una fila con nombre y bajo una columna con título. Si alguna vez una cifra cae en una tabla sin encabezado o
  // sin fila identificable, esto lo caza igual que la ventana caza la prosa.
  const colisionan = [c.enJuegoFmt, R.tension.enJuegoFmt];
  const celdas = [...container.querySelectorAll("td")].filter((td) => colisionan.includes(td.textContent.trim()));
  const declaradas = celdas.filter((td) => {
    const tr = td.closest("tr"), tabla = td.closest("table");
    const th = tabla ? tabla.querySelectorAll("th")[[...tr.children].indexOf(td)] : null;
    const etiqueta = tr && tr.children[0] ? tr.children[0].textContent.trim() : "";
    return !!(th && th.textContent.trim() && etiqueta);
  });
  ok(celdas.length === declaradas.length,
    `las ${celdas.length} celdas de tabla que rinden uno de esos montos lo hacen bajo una columna con título y en una fila con nombre`);
  // el recuperable de acciones comerciales es OTRO alcance (las cuentas sobre una referencia de carga, no las de
  // brecha material) y también viene con su universo pegado
  const rec = R.deterioro.margen.acciones.referencias[0];
  ok(ventanas(T, rec.totalFmt).every((w) => /promedio de tu cartera|recuperables llevando/i.test(w)),
    `${rec.totalFmt} declara de dónde sale: las cuentas sobre el promedio de la cartera`);
  cleanup();
}

H("[5] LO QUE SALE DE COMERCIAL · tiras legacy · capital · bodegas · evolución de una entidad · perfil vs promedio");
{
  const { container } = abrir(evTemporal());
  const T0 = container.textContent;
  // LAS TIRAS LEGACY (owner 2026-08-07): "Margen en riesgo" repetía la cifra de otro universo sin decirlo, y
  // "Capital detenido" no es comercio. Las dos se eliminaron de esta cara.
  ok(!/Margen en riesgo/i.test(T0), "la franja legacy \"Margen en riesgo\" ya NO existe en Comercial");
  ok(!/capital detenido/i.test(T0), "\"Capital detenido\" no aparece en ninguna forma: ni franja, ni supuesto del ¿Y si…?");
  ok(!/verlas en el cuadro/i.test(T0) && !/ver la cara Capital →/i.test(T0), "…ni quedan sus enlaces sueltos");
  ok(porTexto(container, "Capital"), "la cara Capital sigue a un click en el encabezado (no se perdió el acceso)");
  // SEGUIMIENTO (owner 2026-08-07): su estado vacío era una INSTRUCCIÓN de uso, no una conclusión
  ok(!/Marcá la ★ en cualquier fila/i.test(T0), "el bloque \"Seguimiento\" y su instrucción de uso salieron de Comercial");
  ok(!/^Seguimiento/m.test(T0), "…no queda su encabezado suelto");
  // ⚠️ LA ESTRELLA TAMBIÉN SALIÓ DE COMERCIAL (owner 2026-08-08): vivía en las filas de la tabla legacy, y esa
  // tabla se eliminó. No se pierde la CAPACIDAD —la watchlist se marca y se lee entera en Capital— pero decirlo
  // exige verificarlo, así que abajo se comprueba que la cara Capital siga completa.
  ok(![...container.querySelectorAll("span")].some((s) => s.textContent === "☆" || s.textContent === "★"),
    "en Comercial ya no queda una estrella suelta sin lista donde caer");
  fireEvent.click(porTexto(container, "Capital"));
  const _verInv = botones(container).find((b) => /Ver el detalle \(/i.test(b.textContent));
  ok(!!_verInv, "…y la cara Capital abre su inventario operable desde la card de Capital total");
  fireEvent.click(_verInv);
  // el buscador es un <input>: su placeholder es un ATRIBUTO, no textContent
  ok([...container.querySelectorAll("input")].some((i) => /buscar/i.test(i.getAttribute("placeholder") || "")),
    "…con buscador, que es lo que la vuelve usable con miles de SKU");
  ok(![...container.querySelectorAll("span")].some((s) => s.textContent === "☆" || s.textContent === "★"),
    "⚠ PENDIENTE REGISTRADO: la estrella de la watchlist ya no existe en ninguna cara — se fue con el cuadro");
  fireEvent.click(porTexto(container, "Comercial"));
  // …y lo que salió NO se perdió: el mismo supuesto vive en la cara Capital
  fireEvent.click(porTexto(container, "Capital"));
  // "detenido" → "inmovilizado" en toda la cara Capital (owner 2026-08-09): la palabra que ya usan la Ficha, el
  // glosario y los composers de ADI. Lo que NO cambió son las `ask` que se le mandan a ADI — su vocabulario de
  // entrada es contrato suyo, y tocarlo estaba fuera de alcance.
  ok(/capital inmovilizado/i.test(container.textContent), "el supuesto de liberar capital inmovilizado sigue vivo en la cara Capital (se movió, no se borró)");
  ok(!/capital detenido/i.test(container.textContent), "…y la cara ya no dice «capital detenido» en ninguna parte");
  fireEvent.click(porTexto(container, "Comercial"));
  ok(!R.kpis.some((k) => k.key === "capital"), "el KPI de CAPITAL no está entre los KPI principales (su historia vive en la cara Capital)");
  ok(!/Capital inmovilizado|capital detenido en \d+ SKU/i.test(T0), "…ni se cuela una cifra de capital en la cabecera comercial");
  ok(!T0.includes("El 80/20 · cómo se compone"), "el Pareto por eje (el que traía las bodegas) ya no vive acá — el 80/20 es el bloque de concentración de clientes");
  const T = container.textContent;
  ok(!T.includes("Bodegas"), "las BODEGAS no aparecen en la cara Comercial (son capital, no comercio)");
  ok(!T.includes("Perfil vs promedio") && !T.includes("el eje central es el promedio del eje"),
    "el bloque inline \"perfil vs promedio\" no está en ninguna forma (vive en la Ficha)");
  // ⚠️ EL COMPARADO MULTI-ENTIDAD SALIÓ DE COMERCIAL (owner 2026-08-08): vivía dentro de la tabla legacy y se fue
  // con ella. Es la consecuencia que el owner aceptó al eliminar el bloque. El comparado NO se borró del producto:
  // sigue entero en las otras caras, donde el CuadroMando se conserva intacto.
  const fila = R.rows[0].name;
  ok(!filaDe(container, fila), `en Comercial ya no hay filas seleccionables — ${fila} no ofrece checkbox`);
  ok(!T.includes(`Comparado · ${fila}`) && !/\d+ seleccionados?/.test(T), "…ni comparado de una entidad ni contador de selección");
  // lo que SÍ conserva la cara: cada cliente abre su Ficha desde la cartera
  ok(botones(container).some((b) => b.title === `Abrir la Ficha de ${fila}`),
    `${fila} sigue teniendo un camino: su Ficha, desde la cartera`);

  /* ── LA COLA DE LA CARA · "Cambios detectados" y "¿Y si…?" ELIMINADOS (owner 2026-08-08) ────────────────────
   * Sobrevivían del shell viejo, cuando Comercial era una lista de señales. Con los tres movimientos armados
   * quedaron fuera de la línea de razonamiento: lo que decían —el 80/20, la variación contra el año anterior, el
   * efecto de llevar la carga a la meta— se lee ahora DENTRO de los bloques, con su universo declarado. */
  ok(!/Cambios detectados/i.test(T), "«Cambios detectados» ya no está en Comercial");
  ok((MESA.cambios || []).length > 0 && (MESA.cambios || []).every((c) => !T.includes(c.texto)),
    `…ni ninguno de sus ${(MESA.cambios || []).length} textos suelto por otro camino`);
  ok(!/^¿Y si…\?/m.test(T), "«¿Y si…?» tampoco");
  ok((MESA.simulaciones || []).filter((s) => s.key !== "capital").every((s) => !T.includes(s.texto)),
    "…ni sus supuestos comerciales");
  /* ⚠️ ACTUALIZADO 2026-08-09: cuando "¿Y si…?" salió de Comercial, esta aserción decía que los supuestos seguían
   * vivos en Capital. Ya no: el owner los eliminó también de ahí, con el mismo criterio ("no aporta" — proyectaban
   * en condicional lo que las cards ya afirman). Así que la garantía cambia de "se movió" a "se eliminó de las
   * dos caras", y el DATO sigue en el módulo por si vuelve. Decir "se movió" cuando ya no está sería mentir. */
  fireEvent.click(porTexto(container, "Capital"));
  ok(!/¿Y si/i.test(container.textContent), "«¿Y si…?» tampoco está en Capital: el owner lo eliminó de las dos caras");
  ok((MESA.simulaciones || []).length > 0, "…pero el dato sigue en el módulo, intacto, por si vuelve");
  fireEvent.click(porTexto(container, "Comercial"));
  // LA CARA CIERRA EN LAS DECISIONES · nada cuelga después del bloque 03
  ok(!/O que ADI cuente el caso/i.test(container.textContent),
    "…y el enlace duplicado a la primera cuenta salió: cada fila ya trae su \"Abrir Ficha\"");
  const iDec = container.textContent.indexOf(R.prioridades.encabezado);
  ok(iDec > 0 && container.textContent.slice(iDec).length < 3000,
    "la cara termina en qué hacer primero: no queda una cola de señales después");
  cleanup();
}

H("[6] EL TOGGLE Ventas / Contribución · el mismo dato del módulo, otra métrica");
{
  const { container } = abrir(evTemporal());
  const bV = porTexto(container, "Ventas"), bC = porTexto(container, "Contribución");
  ok(!!bV && !!bC, "el gráfico trae el toggle Ventas / Contribución");
  ok(bV.getAttribute("aria-pressed") === "true" && bC.getAttribute("aria-pressed") === "false", "arranca en Ventas");
  // la ETIQUETA de una barra es exactamente "nombre + cifra": comparar contra ella aísla el gráfico del resto de
  // la vista (la venta de una entidad también aparece, con razón, en la primera profundización sugerida).
  const etiqueta = (b) => botones(container).find((x) => x.textContent === b.nombre + b.fmt);
  ok(R.pareto.ventas.barras.every((b) => !!etiqueta(b)), "en Ventas cada barra lleva su cifra de venta");
  fireEvent.click(bC);
  const T = container.textContent;
  ok(bC.getAttribute("aria-pressed") === "true", "al tocar Contribución el toggle cambia de estado");
  for (const b of R.pareto.contribucion.barras) ok(!!etiqueta(b), `barra "${b.nombre}" con su contribución ${b.fmt}`);
  ok(T.includes(R.pareto.contribucion.nota), "y la nota pasa a hablar de contribución");
  const cambian = R.pareto.ventas.barras.filter((b) => !R.pareto.contribucion.barras.some((c) => c.nombre === b.nombre && c.fmt === b.fmt));
  ok(cambian.length > 0 && cambian.every((b) => !etiqueta(b)), `ninguna barra queda con su cifra de venta pegada (${cambian.length} cambiaron)`);
  ok(R.pareto.contribucion.barras.some((b, i) => b.nombre !== R.pareto.ventas.barras[i].nombre),
    "y el ORDEN cambia: en contribución no manda el mismo cliente que en venta — que es justo el punto del contraste");
  cleanup();
}

H("[7] EL TOPE DEL GRÁFICO sigue la pantalla · 10 entidades en desktop, 6 en móvil");
{
  const etiquetas = (container) => R.rows.filter((r) => container.textContent.includes(r.name)).length;
  _MQ_MATCHES = false;
  const d = abrir(evTemporal());
  const dBarras = buildResumenComercial(SCENARIO, { maxEntidades: 10 }).pareto.ventas.barras;
  ok(dBarras.every((b) => d.container.textContent.includes(b.nombre)), `desktop: las ${dBarras.length} barras del tope de 10 entidades`);
  ok(dBarras.length <= 12, `desktop ≤ 12 barras — ${dBarras.length}`);
  cleanup();
  _MQ_MATCHES = true;
  const m = abrir(evTemporal());
  const mBarras = buildResumenComercial(SCENARIO, { maxEntidades: 6 }).pareto.ventas.barras;
  ok(mBarras.length <= 8, `móvil ≤ 8 barras — ${mBarras.length}`);
  ok(mBarras.every((b) => m.container.textContent.includes(b.nombre)), "móvil: la vista dibuja el set acotado del módulo (6 entidades + resto + cola)");
  ok(m.container.textContent.includes(R.kpis[0].valor), "y la cabecera es la misma: el tope es dibujo, no aritmética");
  cleanup();
  _MQ_MATCHES = false;
}

H("[8] CERO REGRESIONES · las caras Ficha, Capital y Resultado siguen rindiendo igual");
{
  const { container } = abrir(evTemporal());
  fireEvent.click(porTexto(container, "Capital"));
  ok(container.textContent.includes("Qué está pasando") && container.textContent.includes("Dónde y desde cuándo") && container.textContent.includes("Qué hacer primero"),
    "la cara CAPITAL rinde sus tres movimientos");
  ok(botones(container).some((b) => /Ver el detalle \(/i.test(b.textContent)), "…y cada KPI abre su propio detalle");
  ok(container.textContent.includes("Qué hacer primero"), "…con sus tres movimientos");
  fireEvent.click(porTexto(container, "Resultado"));
  ok(/P&L|resultado después de gastos|Resultado/i.test(container.textContent), "la cara RESULTADO rinde");
  /* ⚠️ LA PESTAÑA SE LLAMA «Perfil Ejecutivo» DESDE EL 2026-08-27 (owner). El nombre corto «Ficha» sigue vivo
     dentro de la cara (los botones «Abrir Ficha», «Ver Ficha»): lo que cambió es el rótulo de la pestaña. */
  fireEvent.click(porTexto(container, "Perfil Ejecutivo"));
  // «Elegí» → «Elige» (registro formal, owner 2026-08-14). Se aceptan las dos: lo que prueba esta línea es que la
  // cara Ficha rinde SU SELECTOR, no cómo se conjuga el imperativo.
  ok(/(?:Elegí|Elige) un cliente/.test(container.textContent), "la cara FICHA rinde con su selector");
  fireEvent.click(conTexto(container, R.primera.entidad));
  ok(container.textContent.includes(`Importancia de ${R.primera.entidad} en tu cartera`), "…y arma la Ficha Ejecutiva del cliente elegido");
  fireEvent.click(porTexto(container, "Comercial"));
  ok(container.textContent.includes(R.kpis[0].valor),
    "y volver a Comercial devuelve el resumen del negocio, sin arrastrar la entidad de la Ficha");
  cleanup();
}

/* [8b] LAS BARRAS DE CAPITAL · lo que el módulo calcula tiene que ser lo que se DIBUJA (owner 2026-08-09) ──────
 * `_mesa_capital_gate` ya prueba que la aritmética cierra. Lo que falta probar es lo único que el usuario ve: que
 * las barras estén en pantalla con su monto, que las UNIDADES —el número que el owner pidió adentro— salgan de
 * verdad, que el filtro cambie el set, y que la cola agrupada se dibuje. Un gráfico correcto que no se renderiza
 * es un gráfico roto; uno que se renderiza sin la cola miente sin que la aritmética se entere. */
H("[8b] LAS BARRAS DE CAPITAL · monto al final, unidades adentro, dos filtros");
{
  const { container } = abrir(evTemporal());
  fireEvent.click(porTexto(container, "Capital"));
  const CAP = buildMesaCapital(SCENARIO);
  const gen = CAP.barras.vistas.find((v) => v.key === "general");
  const inm = CAP.barras.vistas.find((v) => v.key === "inmovilizado");
  // EL BARRIDO VA ACOTADO AL GRÁFICO, no a la cara: los SKU también viven en los focos, en las listas del bloque
  // 03 y en los cortes, así que buscar sobre `container` diría que "todo está en pantalla" sin haber mirado el
  // gráfico. Se toma la tarjeta que contiene el filtro y se lee SOLO ella.
  const btn = botones(container).find((b) => b.textContent.includes("Inmovilizado ("));
  ok(!!btn, "el filtro «Inmovilizado» está a un click");
  // el botón cuelga de un <span>, así que `closest("div")` da la fila de encabezado y su padre es LA TARJETA.
  // Un nivel más arriba entrarían las KPI cards —que también dicen "en rango"— y el barrido dejaría de ser del gráfico.
  const card = btn.closest("div").parentElement;
  const G = () => card.textContent;
  ok(G().includes("Capital por producto"), "el bloque 01 dibuja «Capital por producto»");
  ok(gen.barras.every((b) => G().includes(b.sku)), `las ${gen.barras.length} barras del inventario general están en el gráfico`);
  ok(gen.barras.every((b) => G().includes(b.usdFmt)), "…cada una con su monto formateado");
  // LAS UNIDADES ADENTRO · el pedido textual del owner ("podrían ir las unidades en medio de la barra")
  ok(gen.barras.every((b) => G().includes(b.und.toLocaleString("es-CL"))), "…y sus unidades");
  ok(G().includes(gen.lectura), "la lectura del módulo se dibuja tal cual (la frase se arma en el módulo)");
  ok(gen.leyenda.every((l) => G().includes(l.label)), `la clave del semáforo está dibujada (${gen.leyenda.map((l) => l.label).join(" · ")})`);
  // LA COLA SE DIBUJA · si el módulo agrupó, la barra agrupada tiene que estar en pantalla, no solo en el objeto
  const agrup = gen.barras.find((b) => b.agrupado);
  ok(!agrup || G().includes(agrup.sku), `la cola agrupada se dibuja${agrup ? ` («${agrup.sku}»)` : " (no hubo cola)"}`);
  // EL FILTRO CAMBIA EL SET · y el que se va, se va del gráfico
  fireEvent.click(btn);
  ok(inm.barras.every((b) => G().includes(b.sku)), `al filtrar quedan los ${inm.n} inmovilizados`);
  ok(G().includes(inm.totalFmt), `…con su total ${inm.totalFmt}`);
  // la leyenda ACOMPAÑA al filtro: en "Inmovilizado" hay un solo estado, y prometer los otros tres sería falso
  const fuera = gen.leyenda.filter((l) => !inm.leyenda.some((i) => i.estado === l.estado));
  ok(inm.leyenda.length === 1 && fuera.every((l) => !G().includes(l.label)),
    `…y la clave se reduce al único estado presente (salen ${fuera.map((l) => l.label).join(" · ")})`);
  const salieron = gen.barras.filter((b) => !b.agrupado && !inm.barras.some((i) => i.sku === b.sku));
  ok(salieron.length > 0 && salieron.every((b) => !G().includes(b.sku)), `…y los ${salieron.length} que no están detenidos salen del gráfico`);
  cleanup();
}

H("[9] PROPORCIONALIDAD SEMÁNTICA · la vista no afirma más de lo que la evidencia demuestra");
{
  const cm = buildCuadroMando("cliente", SCENARIO);
  ok(cm.rows.every((r) => r.accion !== "revisar costo"), "el cuadro ya NO emite la acción \"revisar costo\" (el costo no está aislado — es un residuo, no una medición)");
  ok(cm.rows.some((r) => r.accion === "investigar causa") || cm.rows.every((r) => r.accion !== "investigar causa"),
    `la rama honesta es "investigar causa" — acciones vivas: ${[...new Set(cm.rows.map((r) => r.accion))].join(" · ")}`);
  ok(cm.rows.every((r) => !r.lectura || !/por estructura de costo/.test(r.lectura)), "la microlectura tampoco atribuye la brecha a la estructura de costo");
  ok(cm.rows.filter((r) => r.accion === "renegociar carga").every((r) => typeof r.carga === "number"),
    "la única palanca que se NOMBRA (carga comercial) está medida por fila");

  const { container } = abrir(evTemporal());
  const T = container.textContent;
  ok(!/revisar costo/i.test(T), "\"revisar costo\" no aparece en ninguna parte de la vista");
  const cabecera = T;   // sin la tabla legacy, la cara entera es la cabecera
  ok(!/debilit|deterioran|dañ|por culpa|causan/i.test(cabecera), "la cabecera no atribuye causa: localiza dónde está la brecha");
  ok(!/sector|industria|estándar de la industria/i.test(cabecera), "la referencia se narra como TUYA, nunca sectorial");
  // costo/precio/composición siguen declarados como pendientes de aislar — ahora en cada fila de decisión del
  // bloque 03, que es donde el usuario decide, y en la nota del costo contra precio.
  ok(/cu[áa]nto es el costo del producto|cu[áa]nto es lo que cuesta el producto/i.test(T) && /mezcla de lo que vendiste/i.test(T),
    "lo que falta aislar se declara en castellano, no como «separar composición»");
  ok(R.deterioro.margen.costoPrecio.estatus === "indicado",
    "y el efecto costo/precio nunca se presenta como probado");
  ok(!/rentabilidad/i.test(cabecera), "no le llama rentabilidad a un margen");
  cleanup();
}

H("[10] SÍNTESIS · nada se dice dos veces, y nada queda tapado (owner 2026-08-07)");
{
  const { container } = abrir(evTemporal());
  const T = container.textContent;
  const cabecera = T;   // sin la tabla legacy, la cara entera es la cabecera
  const veces = (aguja) => (aguja ? cabecera.split(aguja).length - 1 : 0);
  // NO REPETIR CIFRAS NI CONCEPTOS · cada afirmación tiene UN solo hogar en la primera lectura
  for (const [aguja, que] of [
    /* la lectura de alcance y la reconciliación salieron de esta lista al quitarse del tablero: ya no pueden
       aparecer «una sola vez» porque no aparecen ninguna. Se comprueban abajo, exigiendo CERO. */
    [R.evolutivo.lectura, "la lectura del año"],
    [R.deterioro.margen.acciones.lectura, "la lectura de acciones comerciales"],
    [R.deterioro.margen.costoPrecio.lectura, "la lectura de costo contra precio"],
    [R.sostiene.vistas[0].lectura, "la lectura de quién sostiene"],
    [R.prioridades.encabezado, "el encabezado de decisiones"],
  ]) ok(veces(aguja) === 1, `"${que}" aparece UNA sola vez — ${veces(aguja)}`);
  // el % del plano sobre la oportunidad total vive en la reconciliación Y en el tramo indicado (son dos
  // afirmaciones distintas sobre el mismo hecho); lo que NO puede pasar es que el ALCANCE se repita textual.
  ok(veces(R.plano.n + " clientes explican") === 0, "el 80/20 no se narra en ningún bloque: se muestra");
  ok(veces(R.veredicto.soporte) === 0, "la lectura de alcance no vuelve por ninguna puerta");
  ok(veces(R.tension.reconciliaCorta) === 0, "…ni la reconciliación cabeza/cola");
  // TOOLTIPS para lo explicativo: los InfoDot llevan las definiciones largas, no el cuerpo de la vista
  const tips = [...container.querySelectorAll(".adi-tip")].map((x) => x.textContent);
  ok(tips.length >= 8, `las definiciones y el modo de uso viven en tooltips — ${tips.length} en la vista`);
  ok(tips.some((t) => t.length > 200), "…y son las piezas largas (lo extenso no está en el cuerpo)");
  // EL BOTÓN FLOTANTE NO PUEDE TAPAR CONTENIDO
  const flot = conTexto(container, "Preguntar a ADI sobre esta vista");
  /* ⚠️ AFIRMACIÓN INVERTIDA (owner 2026-08-27). El botón era un segundo camino para lo que cada pieza ya
     ofrece: cada KPI, cada fila y cada tira se preguntan solas, y con el contexto de ESA pieza, que apunta
     mejor que «la vista entera». Lo que sigue vivo es el contexto AMBIENTE, que no es un botón. */
  ok(!flot, "el botón flotante de ADI ya NO está: cada pieza se pregunta sola");
  // se mide el padding COMPUTADO, no el string del atributo: jsdom colapsa `padding` + `paddingBottom` en el
  // shorthand `padding: 18px 18px 74px`, así que buscar "padding-bottom" en el texto nunca acertaría.
  const scroller = [...container.querySelectorAll("div")].find((d) => /overflow-y:\s*auto/i.test(d.getAttribute("style") || ""));
  ok(!!scroller, "el contenedor con scroll de la Mesa está");
  /* ⚠️ AFIRMACIÓN INVERTIDA · antes exigía >= 60px de colchón para que el botón flotante no se posara sobre la
     última línea. Sin botón, ese colchón era espacio muerto: ahora se exige que el padding sea PAREJO. Si
     alguien devuelve el botón, tendrá que devolver el colchón — y esta línea se lo va a recordar. */
  const pb = scroller ? parseInt(getComputedStyle(scroller).paddingBottom || "0", 10) : 0;
  ok(pb <= 24, "sin botón flotante, el padding de abajo vuelve a ser parejo: no queda colchón muerto — " + pb + "px");
  cleanup();
}

/* ── [11b] BORDES NEUTROS, COLOR EN LAS CIFRAS (owner 2026-08-08) ──────────────────────────────────────────────
 * "No quiero exageración de color; los bordes deben ser como los de la tercera foto, eso respeta nuestro diseño."
 * La referencia es "Composición de la compra" de la Ficha: tarjeta de borde neutro y color SOLO donde significa
 * algo — el margen bajo benchmark, la rotación bajo el piso. Una barra de color POR FILA multiplica el acento por
 * la cantidad de filas: lo que quería ser un semáforo termina siendo ruido, y cuando todo resalta nada resalta. */
/* ── [11c] LOS ENCABEZADOS, EN CELESTE (owner 2026-08-08) ──────────────────────────────────────────────────────
 * "Los títulos y encabezados deben ir en celeste." Algunos ya lo eran y otros no, que es peor que ninguno: el
 * usuario no puede aprender a reconocer "esto es un encabezado" si el color cambia de bloque en bloque. Se
 * comprueba sobre los títulos REALES de la vista, no sobre una lista fija. */
H("[11c] ENCABEZADOS EN CELESTE · uno solo, y el mismo, en toda la cara");
{
  const { container } = abrir(evTemporal());
  const CELESTE = /rgba?\(\s*47,\s*184,\s*218/i;
  const titulos = ["El negocio, cliente por cliente", "El año, mes a mes", "Concentración comercial",
    "Quién sostiene el negocio", "Qué mueve el margen", "Acciones comerciales", "Costo contra precio",
    ...R.prioridades.grupos.map((g) => g.label)];
  // Un ENCABEZADO se identifica por su forma (mayúsculas + tracking), no por ser el elemento más corto que
  // contiene ese texto: "Acciones comerciales" también es la etiqueta de un KPI, y esa no es un encabezado.
  const esEncabezado = (e) => /text-transform:\s*uppercase/i.test(e.getAttribute("style") || "");
  /* LA REGLA SE DIO VUELTA (owner 2026-08-20): «los títulos deben ser todos en blanco, solo deja en celeste lo
   * que queramos destacar, ejemplo "Que ADI lo explique"; si no, se molestan». Antes este chequeo exigía que
   * los 9 encabezados fueran CELESTES; ahora exige lo contrario, y por el mismo motivo de fondo: que haya UN
   * solo criterio en toda la cara. Con todo en celeste el acento dejaba de acentuar — competían nueve títulos
   * con los enlaces que sí piden click. El candado no se aflojó: cambió de lado. */
  const conCeleste = titulos.filter((t) => [...container.querySelectorAll("div,span")]
    .some((e) => e.textContent.trim().toUpperCase().startsWith(t.toUpperCase())
      && esEncabezado(e) && CELESTE.test(e.getAttribute("style") || "")));
  ok(conCeleste.length === 0, `los ${titulos.length} encabezados de la cara van en BLANCO, no en celeste`, conCeleste.join(" | "));
  cleanup();
}

H("[11b] BORDES NEUTROS · el color vive en las cifras, no en los marcos");
{
  const { container } = abrir(evTemporal());
  const VERDE = /rgb\(\s*16,\s*185,\s*129/i, AMBAR = /rgb\(\s*253,\s*224,\s*71/i, ROJO = /rgb\(\s*244,\s*63,\s*94/i;
  const conBordeColor = [...container.querySelectorAll("div")].filter((d) => {
    const st = d.getAttribute("style") || "";
    const bl = /border-left:[^;]*/i.exec(st);
    return bl && [VERDE, AMBAR, ROJO].some((c) => c.test(bl[0]));
  });
  ok(conBordeColor.length === 0, `ninguna tarjeta lleva barra de color en el borde — ${conBordeColor.length}`,
    conBordeColor.slice(0, 3).map((d) => d.textContent.slice(0, 50)).join(" | "));
  /* …PERO EL COLOR NO DESAPARECE. Un CONTEO no sirve de piso: el owner bajó el listón dos veces y un número fijo
   * obliga a inventar color para cumplirlo. Se nombran los CINCO LUGARES donde el color tiene que sobrevivir,
   * porque cada uno lo tiene por un motivo distinto y perder cualquiera es perder una señal, no un adorno. */
  const T = container.textContent;
  const coloreado = (txt, re) => [...container.querySelectorAll("span,td")]
    .some((e) => e.textContent.trim() === txt && re.test(e.getAttribute("style") || ""));
  const K = R.cartera, A = R.deterioro.margen.acciones;
  ok(coloreado(A.referencias[0].totalFmt, VERDE), `el titular de lo recuperable sigue en verde — ${A.referencias[0].totalFmt}`);
  ok(coloreado(A.referencias[0].filas[0].cargaFmt, ROJO), `la carga por cuenta sigue en rojo (pedido explícito) — ${A.referencias[0].filas[0].cargaFmt}`);
  const filaSube = K.filas.find((f) => f.vsAnterior.dir === "sube"), filaBaja = K.filas.find((f) => f.vsAnterior.dir === "baja");
  ok(!filaSube || [...container.querySelectorAll("td")].some((td) => td.textContent.includes(filaSube.vsAnterior.pctFmt) && VERDE.test(td.getAttribute("style") || "")),
    "los gaps que suben siguen en verde");
  ok(!filaBaja || [...container.querySelectorAll("td")].some((td) => td.textContent.includes(filaBaja.vsAnterior.pctFmt) && ROJO.test(td.getAttribute("style") || "")),
    "…y los que bajan, en rojo");
  const material = R.sostiene.vistas[0].filas.find((f) => f.material);
  ok(!material || coloreado(material.brechaFmt, AMBAR), `la brecha material sigue en ámbar — ${material && material.brechaFmt}`);
  ok(/5\.0 pp bajo tu benchmark|bajo tu benchmark/.test(T), "y el KPI de margen sigue declarando su brecha");
  cleanup();
}

H("[11] MENOS CELESTE · el acento queda para lo que se toca (owner 2026-08-07)");
{
  const { container } = abrir(evTemporal());
  // jsdom serializa el color con espacios (`rgba(47, 184, 218, 0.5)`), así que el patrón los tolera.
  const CELESTE = /rgba\(\s*47,\s*184,\s*218/i;
  /* ⚠️ REGLA ACTUALIZADA (owner 2026-08-08, dicho dos veces: "los bordes deben ser como los de la foto que te
   * adjunto, es un ejemplo" — la Ficha). El 2026-08-07 la queja fue "menos bordes celestes" y las tarjetas del
   * Resumen se neutralizaron; ahora el owner señala el panel de la Ficha como EL estándar de la casa, y ese panel
   * lleva celeste al 25% con un degradado suave. Las dos instrucciones no se contradicen: lo que molestaba era el
   * celeste FUERTE repartido por todos lados. Así que la regla pasa a ser una GRADACIÓN, que es más útil que una
   * prohibición: 0.25 para el marco de un bloque · 0.4 o más SOLO para lo que se toca. */
  const bordeFuerte = [...container.querySelectorAll("div")]
    .filter((d) => /border:\s*1px solid rgba\(\s*47,\s*184,\s*218,\s*0?\.[4-9]/i.test(d.getAttribute("style") || "")).length;
  ok(bordeFuerte === 0, `ninguna card de contenido usa el celeste FUERTE (≥0.4): ese es el del control — ${bordeFuerte}`);
  /* EL MARCO DE LAS TARJETAS PASA A BLANCO (owner 2026-08-20: «los bordes de las tablas, gráficos y cards deben
     ser blancos y no celestes»). Lo que este chequeo protege NO cambió: que todos los bloques usen el MISMO
     panel, uno solo para toda la cara. Cambió de qué color es ese panel. El celeste FUERTE sigue vetado arriba
     y sigue reservado al control — por eso la aserción de al lado («el celeste marca lo interactivo») pasa. */
  const cardsPanel = [...container.querySelectorAll("div")]
    .filter((d) => (d.getAttribute("style") || "").replace(/ /g, "").includes("border:1pxsolidrgba(255,255,255,0.22)")).length;
  ok(cardsPanel > 0, `los bloques usan el MISMO panel, ahora de marco BLANCO — ${cardsPanel} tarjetas`);
  // pero el acento SIGUE vivo donde se interactúa: pills activas, accesos a Ficha, botones de ADI
  const controlesCeleste = botones(container).filter((b) => CELESTE.test(b.getAttribute("style") || "")).length;
  ok(controlesCeleste >= 5, `el celeste sigue marcando lo interactivo — ${controlesCeleste} controles`);
  const textoCeleste = [...container.querySelectorAll("span,div")].filter((d) => CELESTE.test(d.getAttribute("style") || "")).length;
  ok(controlesCeleste >= textoCeleste, `y hay más celeste en controles que en decoración — ${controlesCeleste} vs ${textoCeleste}`);
  cleanup();
}

try { rmSync(bundlePath, { force: true }); } catch { /* el bundle es regenerable */ }
console.log(`\n── _resumen_comercial_ui_gate: ${PASS} PASS · ${FAIL} FAIL (de ${PASS + FAIL}) ──`);
process.exit(FAIL ? 1 : 0);
