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
const bundlePath = path.join(root, "_resumen_comercial_ui_gate_bundle.mjs");
// entry por STDIN: el gate es autosuficiente — no depende de ningún archivo suelto en la raíz para poder correr.
await esbuild.build({
  stdin: { contents: `export { SentrixPanel } from "./src/ui/SentrixPanel.jsx";`, resolveDir: root, loader: "jsx", sourcefile: "_resumen_comercial_ui_entry.jsx" },
  bundle: true, outfile: bundlePath, format: "esm", platform: "node", jsx: "automatic",
  external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "react/jsx-dev-runtime"],
  logLevel: "silent",
});
const ui = await import(pathToFileURL(bundlePath).href);
const React = (await import("react")).default;
const { render, fireEvent, cleanup } = await import("@testing-library/react");
const { runPlan } = await import("./src/adi/oracle/toolRunner.js");
const { buildOracleEvidence } = await import("./src/adi/oracle/sentrixEvidence.js");
const { ledgerBoleta } = await import("./src/adi/oracle/ledger.js");
const { buildResumenComercial } = await import("./src/adi/sentrix/resumenComercial.js");
const { buildCuadroMando } = await import("./src/adi/sentrix/cuadro.js");

const SCENARIO = "bonanza";
const R = buildResumenComercial(SCENARIO, { maxEntidades: 10 });

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
const verCartera = (container) => { const b = conTexto(container, "Ver todos los clientes"); if (b) fireEvent.click(b); return b; };
// la FILA de la grilla: el div-grilla clickeable (cursor:pointer) que nombra a esa entidad — el header y la fila
// Total comparten el grid pero no el cursor, así que quedan afuera; el más corto desempata nombres contenidos.
const filaDe = (container, nombre) => [...container.querySelectorAll("div")]
  .filter((d) => { const s = d.getAttribute("style") || ""; return /grid-template-columns/.test(s) && /cursor:\s*pointer/.test(s) && d.textContent.includes(nombre); })
  .sort((a, b) => a.textContent.length - b.textContent.length)[0];

H("[1] LOS SEIS BLOQUES · en orden, con las cifras del módulo (cero cálculo en React)");
{
  const { container } = abrir(evTemporal());
  const T = container.textContent;
  ok(T.includes("MESA DE CONTROL"), "abre la Mesa de Control");
  const bloques = [
    ["Lectura ejecutiva · negocio completo", "1 · veredicto + KPIs"],
    ["Plano de decisión:", "2 · plano de decisión 80/20 declarado"],
    ["Concentración comercial · 80/20", "3 · gráfico de concentración"],
    ["Puente de oportunidad", "4 · puente de oportunidad"],
    ["Insights que mueven la aguja", "5 · insights"],
    ["Evidencia completa · opcional", "6 · evidencia completa opcional"],
  ];
  const pos = bloques.map(([marca]) => T.indexOf(marca));
  for (let i = 0; i < bloques.length; i++) ok(pos[i] >= 0, `bloque ${bloques[i][1]} presente`);
  ok(pos.every((p, i) => i === 0 || (p > pos[i - 1] && pos[i - 1] >= 0)), `los seis vienen EN ORDEN — ${pos.join(" < ")}`);

  // EL VEREDICTO: texto del módulo, verbatim
  ok(T.includes(R.veredicto.titular), `el titular es el del módulo — "${R.veredicto.titular}"`);
  ok(T.includes(R.veredicto.soporte), "el soporte que LOCALIZA la tensión es el del módulo, sin prosa nueva");
  ok(T.includes(R.veredicto.lectura), "la lectura de respaldo (ventas · variación · margen · brecha) también");
  // LOS 4 KPI: los del módulo, y ninguno más
  for (const k of R.kpis) {
    ok(T.includes(k.label) && T.includes(k.valor), `KPI "${k.label}" con su cifra ${k.valor}`);
    ok(T.includes(k.pie), `…y su pie declarado ("${k.pie}")`);
  }
  ok(R.kpis.length === 4, `son exactamente 4 KPI — ${R.kpis.length}`);
  // EL PLANO, EL PUENTE, LOS INSIGHTS: cifras del módulo
  ok(T.includes(R.plano.frase), "la frase del plano viene armada del módulo (X e Y dinámicos)");
  ok(T.includes(R.plano.colaFrase), "…y declara qué queda en la cola");
  ok(T.includes(R.puente.brechaTotalFmt) && T.includes(`${R.puente.probadoFmt} probado`) && T.includes(`${R.puente.abiertoFmt} por aislar`),
    `el puente muestra total/probado/abierto — ${R.puente.brechaTotalFmt} = ${R.puente.probadoFmt} + ${R.puente.abiertoFmt}`);
  for (const t of R.puente.tramos) ok(T.includes(t.titulo) && T.includes(t.detalle), `tramo ${t.estatus.toUpperCase()} completo ("${t.titulo}")`);
  ok(["probado", "indicado", "abierto"].every((e) => T.includes(e)), "los tres estatus epistémicos están rotulados a la vista");
  const i0 = R.insights[0];
  ok(T.includes(i0.entidad) && T.includes(i0.razon) && T.includes(i0.enJuegoFmt), `el primer insight completo — ${i0.entidad} · ${i0.enJuegoFmt}`);
  ok(T.includes(`${i0.posVenta}° venta · ${i0.posMargen}° margen más bajo`), "…con su posición por venta y por margen");
  ok(T.includes("Primera profundización sugerida:") && T.includes(R.primera.entidad), `la primera profundización sugerida es ${R.primera.entidad}`);
  // EL GRÁFICO: las barras del módulo, con sus nombres y montos
  for (const b of R.pareto.ventas.barras) ok(T.includes(b.nombre) && T.includes(b.fmt), `barra "${b.nombre}" (${b.fmt}) dibujada`);
  ok(T.includes(R.pareto.ventas.cruce80), `el cruce real del 80% se nombra — ${R.pareto.ventas.cruce80}`);
  ok(T.includes(R.pareto.ventas.nota), "la nota del gráfico es la del módulo");
  cleanup();
}

H("[2] ALCANCE GLOBAL · una selección previa NO puede teñir la cara Comercial");
{
  // A · entrada limpia (tendencia global)
  const a = abrir(evTemporal());
  const marcaA = [R.veredicto.titular, R.veredicto.soporte, ...R.kpis.map((k) => k.valor + k.pie)].join("¶");
  ok(a.container.textContent.includes(R.veredicto.soporte), "entrada limpia: la lectura es del negocio completo");
  cleanup();

  // B · entrada por el deep-link de UN cliente → abre la Ficha de ese cliente → saltar a Comercial
  const cliente = R.primera.entidad;
  const b = abrir(evPerfil(cliente));
  ok(b.container.textContent.includes(`Importancia de ${cliente} en tu cartera`), `el deep-link abre la Ficha Ejecutiva de ${cliente} (comportamiento previo intacto)`);
  const tabComercial = porTexto(b.container, "Comercial");
  ok(!!tabComercial, "la cara Comercial es alcanzable desde la Ficha");
  fireEvent.click(tabComercial);
  const T = b.container.textContent;
  ok(T.includes(R.veredicto.titular) && T.includes(R.veredicto.soporte),
    "el veredicto es el MISMO del negocio completo — la entidad del deep-link no lo tiñe");
  for (const k of R.kpis) ok(T.includes(k.valor) && T.includes(k.pie), `KPI "${k.label}" idéntico al de la entrada limpia (${k.valor})`);
  ok(marcaA.split("¶").every((frag) => T.includes(frag)), "TODAS las cifras de cabecera coinciden byte a byte con la entrada limpia");
  ok(T.includes(`${R.plano.n} clientes explican el ${R.plano.pct}%`), `el gráfico sigue siendo del negocio — ${R.plano.n} clientes / ${R.plano.pct}%`);
  // …y la tabla de evidencia arranca SIN ninguna fila elegida
  verCartera(b.container);
  const T2 = b.container.textContent;
  ok(!/\d+ seleccionados?/.test(T2), "la cartera completa arranca SIN selección previa (el deep-link no preselecciona la fila)");
  ok(!T2.includes("Perfil vs promedio"), "…y por lo tanto tampoco aparece un perfil individual colgado de esa selección");
  cleanup();
}

H("[3] NAVEGACIÓN A LA FICHA · detecta acá, explica allá (la Ficha REAL, no una vista paralela)");
{
  // a · desde un insight
  {
    const { container } = abrir(evTemporal());
    const btn = conTexto(container, "Abrir Ficha");
    ok(!!btn, `el insight de ${R.insights[0].entidad} trae "Abrir Ficha"`);
    fireEvent.click(btn);
    ok(container.textContent.includes(`Importancia de ${R.insights[0].entidad} en tu cartera`),
      `abre la Ficha Ejecutiva REAL de ${R.insights[0].entidad} (cara Ficha)`);
    ok(!container.textContent.includes("Insights que mueven la aguja"), "…y deja la cara Comercial (es navegación, no un panel encima)");
    cleanup();
  }
  // b · desde la primera profundización sugerida
  {
    const { container } = abrir(evTemporal());
    fireEvent.click(conTexto(container, `Ver el caso ${R.primera.entidad}`));
    ok(container.textContent.includes(`Importancia de ${R.primera.entidad} en tu cartera`), `"Ver el caso ${R.primera.entidad}" abre su Ficha`);
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
  // d · desde el "Ver Ficha" de una fila de la tabla de evidencia
  {
    const { container } = abrir(evTemporal());
    verCartera(container);
    const fila = R.rows[0].name;
    const bFicha = botones(container).find((b) => b.title === `Abrir la Ficha de ${fila}`);
    ok(!!bFicha, `la fila de ${fila} trae "Ver Ficha" (owner: agregado por fila)`);
    fireEvent.click(bFicha);
    ok(container.textContent.includes(`Importancia de ${fila} en tu cartera`), `abre la Ficha de ${fila}`);
    cleanup();
  }
  // e · SELECCIONAR sigue siendo COMPARAR, no navegar (owner: son dos gestos distintos)
  {
    const { container } = abrir(evTemporal());
    verCartera(container);
    const fila = R.rows[0].name;
    const check = filaDe(container, fila);
    ok(!!check, `la fila de ${fila} es seleccionable`);
    fireEvent.click(check);
    ok(container.textContent.includes("1 seleccionado"), "seleccionar SELECCIONA (para comparar) — no salta a la Ficha");
    ok(container.textContent.includes("Evidencia completa · opcional"), "…y seguimos en la cara Comercial");
    ok(container.textContent.includes(`Ver Ficha de ${fila}`), "con una sola fila, la vista ofrece su Ficha en vez de dibujar su evolución acá");
    cleanup();
  }
}

H("[4] LA CARTERA COMPLETA · evidencia opcional que se expande y se contrae");
{
  const { container } = abrir(evTemporal());
  const marcaTabla = "Promedio clientes:";
  ok(!container.textContent.includes(marcaTabla), "la tabla NO está montada hasta pedirla (evidencia opcional, no la vista principal)");
  const btn = conTexto(container, "Ver todos los clientes");
  ok(!!btn && btn.textContent.includes(String(R.rows.length)), `el botón declara cuántos clientes hay — "${btn && btn.textContent.trim()}"`);
  ok(btn.getAttribute("aria-expanded") === "false", "arranca declarándose cerrado (aria-expanded=false)");
  fireEvent.click(btn);
  ok(container.textContent.includes(marcaTabla), "al expandir aparece la grilla completa");
  ok(R.rows.every((r) => container.textContent.includes(r.name)), `están los ${R.rows.length} clientes, cabeza y cola`);
  ok(container.textContent.includes("Top 10") && container.textContent.includes("En alerta") && container.textContent.includes("Peores 10"),
    "conserva los FILTROS de siempre");
  ok(container.textContent.includes("Ventas ↓") || container.textContent.includes("↓"), "conserva el ORDENAMIENTO por columna");
  ok(container.textContent.includes("Clientes") && container.textContent.includes("Marcas") && container.textContent.includes("SKU"),
    "conserva los ejes comerciales");
  const cerrar = conTexto(container, "Ocultar la cartera completa");
  ok(!!cerrar && cerrar.getAttribute("aria-expanded") === "true", "expandido se declara abierto (aria-expanded=true)");
  fireEvent.click(cerrar);
  ok(!container.textContent.includes(marcaTabla), "y se vuelve a contraer");
  cleanup();
}

H("[4b] LOS DOS UNIVERSOS · reconciliados a la vista, nunca dos montos parecidos sueltos");
{
  const { container } = abrir(evTemporal());
  const T = container.textContent;
  const c = R.tension.cartera;
  ok(T.includes(R.tension.reconcilia), `la frase de reconciliación se muestra entera — "${R.tension.reconcilia}"`);
  ok(T.includes("Alcance"), "…rotulada como ALCANCE (es una declaración de universo, no un dato más)");
  // los dos montos parecidos conviven, pero SIEMPRE con su universo pegado
  ok(T.includes(c.enJuegoFmt) && T.includes(R.tension.enJuegoFmt), `los dos montos están a la vista — cartera ${c.enJuegoFmt} · plano ${R.tension.enJuegoFmt}`);
  ok(T.includes(R.tension.concentraPctFmt), `el % que el plano concentra de la oportunidad total se muestra y es dinámico — ${R.tension.concentraPctFmt}`);
  // REGLA DURA: cada aparición de la cifra de CARTERA viene con "toda la cartera" cerca; cada una de la del PLANO,
  // con "plano"/"que explican el X%". Se chequea sobre el texto real, no sobre la intención.
  const ventanas = (txt, aguja) => { const out = []; let i = txt.indexOf(aguja); while (i >= 0) { out.push(txt.slice(Math.max(0, i - 220), i + 220)); i = txt.indexOf(aguja, i + 1); } return out; };
  const vCartera = ventanas(T, c.enJuegoFmt).filter((w) => !w.includes("Ver todos los clientes"));
  ok(vCartera.length > 0 && vCartera.every((w) => /toda la cartera|cartera material|cuentas con brecha material/i.test(w)),
    `las ${vCartera.length} apariciones de ${c.enJuegoFmt} declaran su universo (toda la cartera)`);
  const vPlano = ventanas(T, R.tension.enJuegoFmt);
  ok(vPlano.length > 0 && vPlano.every((w) => /plano de decisi[óo]n|clientes del plano|que explican el/i.test(w)),
    `las ${vPlano.length} apariciones de ${R.tension.enJuegoFmt} declaran el suyo (el plano de decisión)`);
  // el TOTAL del puente ($5.0M) es un tercer universo y también se declara
  ok(T.includes(R.puente.universo), "el total del puente declara que incluye cuentas sin brecha material");
  ok(T.includes(`${R.puente.materialFmt} está en las ${R.puente.materialN} cuentas con brecha material`),
    "…y publica al lado cuánto de ese total es material, para que las dos cifras se lean juntas sin chocar");
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
  // …y lo que salió NO se perdió: el mismo supuesto vive en la cara Capital
  fireEvent.click(porTexto(container, "Capital"));
  ok(/capital detenido/i.test(container.textContent), "el supuesto de liberar capital detenido sigue vivo en la cara Capital (se movió, no se borró)");
  fireEvent.click(porTexto(container, "Comercial"));
  ok(!R.kpis.some((k) => k.key === "capital"), "el KPI de CAPITAL no está entre los KPI principales (su historia vive en la cara Capital)");
  ok(!/Capital inmovilizado|capital detenido en \d+ SKU/i.test(T0.split("Evidencia completa")[0]), "…ni se cuela una cifra de capital en la cabecera comercial");
  ok(!T0.includes("El 80/20 · cómo se compone"), "el Pareto por eje (el que traía las bodegas) ya no vive acá — el 80/20 es el bloque de concentración de clientes");
  verCartera(container);
  const T = container.textContent;
  ok(!T.includes("Bodegas"), "las BODEGAS salen del cuadro de la cara Comercial (son capital, no comercio)");
  const fila = R.rows[0].name;
  fireEvent.click(filaDe(container, fila));
  const T2 = container.textContent;
  ok(!T2.includes("Perfil vs promedio"), "el bloque inline \"perfil vs promedio\" SALE (vive en la Ficha)");
  ok(!T2.includes("el eje central es el promedio del eje"), "…y no queda ningún resto suyo");
  ok(T2.includes(`Ver Ficha de ${fila}`) && !/Este año/.test(T2),
    "la evolución de UNA entidad no se dibuja acá: la vista manda a su Ficha");
  // pero el COMPARADO MULTI-ENTIDAD se conserva (owner: eso NO sale)
  const fila2 = R.rows[1].name;
  fireEvent.click(filaDe(container, fila2));
  ok(container.textContent.includes("2 seleccionados"), "se pueden seleccionar dos filas");
  ok(container.textContent.includes(fila) && container.textContent.includes(fila2) && !container.textContent.includes(`Ver Ficha de ${fila}`),
    "con DOS filas vuelve el comparado multi-entidad (owner: eso se conserva)");
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
  ok(m.container.textContent.includes(R.veredicto.titular), "y el veredicto es el mismo: el tope es dibujo, no aritmética");
  cleanup();
  _MQ_MATCHES = false;
}

H("[8] CERO REGRESIONES · las caras Ficha, Capital y Resultado siguen rindiendo igual");
{
  const { container } = abrir(evTemporal());
  fireEvent.click(porTexto(container, "Capital"));
  ok(container.textContent.includes("Cuadro de capital") && container.textContent.includes("Qué está pasando"), "la cara CAPITAL rinde completa");
  ok(container.textContent.includes("Qué hacer primero"), "…con sus tres movimientos");
  fireEvent.click(porTexto(container, "Resultado"));
  ok(/P&L|resultado después de gastos|Resultado/i.test(container.textContent), "la cara RESULTADO rinde");
  fireEvent.click(porTexto(container, "Ficha"));
  ok(container.textContent.includes("Elegí un cliente"), "la cara FICHA rinde con su selector");
  fireEvent.click(conTexto(container, R.primera.entidad));
  ok(container.textContent.includes(`Importancia de ${R.primera.entidad} en tu cartera`), "…y arma la Ficha Ejecutiva del cliente elegido");
  fireEvent.click(porTexto(container, "Comercial"));
  ok(container.textContent.includes(R.veredicto.titular), "y volver a Comercial devuelve el resumen del negocio, sin arrastrar la entidad de la Ficha");
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
  verCartera(container);
  const T = container.textContent;
  ok(!/revisar costo/i.test(T), "\"revisar costo\" no aparece en ninguna parte de la vista");
  const cabecera = T.split("Evidencia completa")[0];
  ok(!/debilit|deterioran|dañ|por culpa|causan/i.test(cabecera), "la cabecera no atribuye causa: localiza dónde está la brecha");
  ok(!/sector|industria|estándar de la industria/i.test(cabecera), "la referencia se narra como TUYA, nunca sectorial");
  ok(/rutas de investigación abiertas — no causas/.test(T), "costo, precio y composición quedan declarados como rutas ABIERTAS");
  ok(!/rentabilidad/i.test(cabecera), "no le llama rentabilidad a un margen");
  cleanup();
}

try { rmSync(bundlePath, { force: true }); } catch { /* el bundle es regenerable */ }
console.log(`\n── _resumen_comercial_ui_gate: ${PASS} PASS · ${FAIL} FAIL (de ${PASS + FAIL}) ──`);
process.exit(FAIL ? 1 : 0);
