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

H("[1] LA SECUENCIA COMPLETA · tres movimientos, en el orden que fijó el owner");
{
  const { container } = abrir(evTemporal());
  const T = container.textContent;
  ok(T.includes("MESA DE CONTROL"), "abre la Mesa de Control");
  const bloques = [
    ["Qué está pasando", "01 · movimiento QUÉ ESTÁ PASANDO"],
    ["Lectura ejecutiva · negocio completo", "1 · veredicto + alcance + KPIs"],
    ["El año, mes a mes", "2 · evolutivo (este año · año anterior · presupuesto)"],
    ["Concentración comercial · 80/20", "3 · gráfico de concentración (el mapa)"],
    [R.composicion.titulo, "4 · composición por cliente (a quién investigar)"],
    ["Por qué está pasando", "02 · movimiento POR QUÉ ESTÁ PASANDO"],
    ["Cómo se forma el margen", "5 · UNA pieza: identidad + brecha con sus estatus"],
    ["Qué hacer primero", "03 · movimiento QUÉ HACER PRIMERO"],
    [R.encabezadoDecisiones, "6 · decisiones prioritarias"],
    ["Evidencia completa · opcional", "7 · evidencia completa opcional, al final"],
  ];
  const pos = bloques.map(([marca]) => T.indexOf(marca));
  for (let i = 0; i < bloques.length; i++) ok(pos[i] >= 0, `bloque ${bloques[i][1]} presente`);
  ok(pos.every((p, i) => i === 0 || (p > pos[i - 1] && pos[i - 1] >= 0)), `TODOS vienen en la secuencia exacta — ${pos.join(" < ")}`);
  ok(T.indexOf("Evidencia completa · opcional") > T.indexOf(R.encabezadoDecisiones),
    "la evidencia completa queda al final: está disponible, pero no domina la primera lectura");
  // UNA SOLA LECTURA DE ALCANCE (owner 2026-08-07): el universo 80/20 se declaraba en tres lugares distintos.
  ok(!T.includes("Plano de decisión:"), "la banda \"Plano de decisión\" ya NO existe (su contenido subió al veredicto)");
  ok(!T.includes(R.plano.frase), "…ni queda su frase suelta en ningún lado");
  ok(!T.includes(R.tension.reconcilia), "la banda ALCANCE larga tampoco: quedó la versión compacta");
  const vecesPlano = (T.match(new RegExp(`${R.plano.n} clientes explican el ${R.plano.pct.toString().replace(".", "\\.")}%`, "g")) || []).length;
  ok(vecesPlano === 1, `"X clientes explican el Y%" aparece UNA sola vez en la vista — ${vecesPlano}`);

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
  ok(T.includes(R.veredicto.soporte), "el alcance se declara UNA vez, en el veredicto (X clientes · Y% · N concentran $Z)");
  ok(T.includes(R.tension.reconciliaCorta), "…con la reconciliación compacta de cabeza y cola debajo");
  ok(T.includes(R.puente.brechaTotalFmt) && T.includes(R.puente.probadoFmt) && T.includes(R.puente.abiertoFmt),
    `la brecha muestra total/probado/abierto — ${R.puente.brechaTotalFmt} = ${R.puente.probadoFmt} + ${R.puente.abiertoFmt}`);
  for (const t of R.puente.tramos) ok(T.includes(t.titulo) && T.includes(t.detalle), `tramo ${t.estatus.toUpperCase()} completo ("${t.titulo}")`);
  // la LOCALIZACIÓN va después de la partición y separada — no como una tercera porción entre las dos partes
  ok(T.indexOf(R.puente.tramos.find((x) => !x.esParte).titulo) > T.indexOf(R.puente.tramos.filter((x) => x.esParte)[1].titulo),
    "la localización se pinta DESPUÉS de la partición, no mezclada entre sus partes");
  ok(T.includes(`${R.puente.materialFmt} de ese total está en las ${R.puente.materialN} con brecha material`),
    "el universo del total se declara a la vista, no solo en el tooltip");
  ok(["probado", "indicado", "abierto"].every((e) => T.includes(e)), "los tres estatus epistémicos están rotulados a la vista");
  const i0 = R.insights[0];
  ok(T.includes(i0.entidad) && T.includes(i0.enJuegoFmt), `la primera decisión — ${i0.entidad} · ${i0.enJuegoFmt}`);
  ok(T.includes(i0.accionCorta) && T.includes(i0.faltaCorta), "…como FILA DE DECISIÓN: la acción concreta y qué falta aislar");
  ok(!T.includes(i0.razon), "la tarjeta larga de informe ya no está — quedó la fila corta");
  // la primera profundización sugerida YA NO es una banda aparte: es la PRIMERA FILA de decisión (owner: no
  // repetir cifras ni conceptos). Se verifica que ese lugar lo ocupe la cuenta de mayor prioridad del módulo.
  ok(!T.includes("Primera profundización sugerida:"), "la banda separada de \"primera profundización\" ya no existe");
  const filasDec = [...container.querySelectorAll("div")]
    .filter((d) => R.insights.some((i) => d.textContent.startsWith(i.entidad) && d.textContent.includes(i.enJuegoFmt)));
  ok(filasDec.length > 0 && filasDec[0].textContent.startsWith(R.primera.entidad),
    `la PRIMERA fila de decisión es la de mayor prioridad — ${R.primera.entidad}`);
  // EL GRÁFICO: las barras del módulo, con sus nombres y montos
  for (const b of R.pareto.ventas.barras) ok(T.includes(b.nombre) && T.includes(b.fmt), `barra "${b.nombre}" (${b.fmt}) dibujada`);
  ok(T.includes(R.pareto.ventas.cruce80), `el cruce real del 80% se nombra — ${R.pareto.ventas.cruce80}`);
  ok(T.includes(R.pareto.ventas.nota), "la nota del gráfico es la del módulo");
  cleanup();
}

H("[1b] EL EVOLUTIVO · tres líneas, y su total ES el del KPI");
{
  const { container } = abrir(evTemporal());
  const T = container.textContent;
  const e = R.evolutivo;
  for (const s of e.series) {
    ok(T.includes(s.label) && T.includes(s.totalFmt), `serie "${s.label}" con su total ${s.totalFmt}`);
    const b = botones(container).find((x) => x.textContent.includes(s.label) && x.textContent.includes(s.totalFmt));
    ok(!!b && b.textContent.includes(s.estatus), `…rotulada ${s.estatus.toUpperCase()} y apagable desde la leyenda`);
  }
  ok(T.includes(e.totalActualFmt) && e.totalActualFmt === R.kpis[0].valor,
    `RECONCILIA a la vista: el cierre del gráfico y el KPI de ventas son el MISMO número — ${e.totalActualFmt}`);
  ok(T.includes(e.lectura), "la lectura del año viene del módulo (cierre, variación, mes más alto y más bajo)");
  ok(T.includes(e.nota) && /anclad/i.test(e.nota), "…y la nota declara el anclaje en vez de esconder la diferencia entre tablas");
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

H("[1c] LA COMPOSICIÓN POR CLIENTE · Grupo 80% / Menor margen / Todos");
{
  const { container } = abrir(evTemporal());
  const comp = R.composicion;
  const T = container.textContent;
  for (const c of comp.columnas) ok(T.includes(c.label), `columna "${c.label}"`);
  // sobre los ENCABEZADOS reales, no sobre el texto suelto: la ayuda del bloque explica por qué no hay rotación,
  // y esa explicación no puede hacer fallar al chequeo que verifica justamente eso.
  const th = [...container.querySelectorAll("th")].map((x) => x.textContent);
  ok(th.length === comp.columnas.length && comp.columnas.every((c, i) => th[i] === c.label), `la tabla tiene EXACTAMENTE las 7 columnas del módulo — ${th.join(" · ")}`);
  ok(!th.some((h) => /rotaci/i.test(h)), "sin columna Rotación: es del inventario, no del cliente");
  const g80 = comp.vistas[0];
  ok(g80.filas.every((f) => T.includes(f.nombre)), `abre en Grupo 80% con sus ${g80.n} clientes`);
  ok(T.includes(g80.filas[0].participacionFmt) && T.includes(g80.filas[0].cargaFmt), `con sus cifras del módulo (${g80.filas[0].nombre}: ${g80.filas[0].participacionFmt} · ${g80.filas[0].cargaFmt})`);
  ok(T.includes(g80.nota), "y declara su universo");
  ok(T.includes(comp.nota), "el pie explica los dos resaltes con sus varas");
  // "Ver Ficha" SOLO en clientes reales — acá TODAS las filas lo son
  const nombres = new Set(R.rows.map((r) => r.name));
  const fichaBtns = botones(container).filter((b) => (b.title || "").startsWith("Abrir la Ficha de "));
  ok(fichaBtns.length > 0 && fichaBtns.every((b) => nombres.has((b.title || "").replace("Abrir la Ficha de ", ""))),
    `los ${fichaBtns.length} accesos a Ficha apuntan a clientes REALES, ninguno a un agregado`);
  // el toggle de vistas
  for (const v of comp.vistas.slice(1)) {
    const b = conTexto(container, `${v.label} (${v.n})`);
    ok(!!b, `la vista "${v.label}" se ofrece con su cantidad (${v.n})`);
    fireEvent.click(b);
    ok(v.filas.every((f) => container.textContent.includes(f.nombre)), `…y al tocarla muestra sus ${v.n} clientes`);
    ok(container.textContent.includes(v.nota), "…declarando su universo");
  }
  // MENOR MARGEN: los 5 de mayor brecha, estén o no en el 80% — y la vista lo marca
  fireEvent.click(conTexto(container, `Menor margen (${comp.vistas[1].n})`));
  const fuera = comp.vistas[1].filas.filter((f) => !f.enPlano);
  ok(fuera.length > 0, `incluye ${fuera.length} cuenta(s) fuera del grupo 80% — ${fuera.map((f) => f.nombre).join(", ")}`);
  ok(comp.vistas[1].filas.some((f) => f.enPlano), "…y también las que sí están dentro");
  ok([...container.querySelectorAll("span")].some((s) => s.textContent === "80%"), "las que pertenecen al grupo 80% llevan su marca, para no confundir universos");
  // desde la tabla se abre la Ficha
  const objetivo = comp.vistas[1].filas[0].nombre;
  fireEvent.click(botones(container).find((b) => b.title === `Abrir la Ficha de ${objetivo}`));
  ok(container.textContent.includes(`Importancia de ${objetivo} en tu cartera`), `tocar un cliente de la tabla abre su Ficha (${objetivo})`);
  cleanup();
}

H("[1d] CÓMO SE FORMA EL MARGEN · la identidad con el estatus de cada línea");
{
  const { container } = abrir(evTemporal());
  const f = R.formacion;
  const T = container.textContent;
  ok(T.includes(f.lectura), `la lectura reparte la venta — "${f.lectura}"`);
  for (const l of f.lineas) ok(T.includes(l.label) && T.includes(l.montoFmt) && T.includes(l.pctFmt), `línea "${l.label}" con ${l.montoFmt} (${l.pctFmt})`);
  const costo = f.lineas.find((l) => l.key === "costo");
  ok(T.includes(costo.nota), "el costo explica a la vista POR QUÉ no es una causa (sale por diferencia, no está medido)");
  ok(T.includes("indicado") && T.includes("probado"), "cada línea lleva su estatus epistémico rotulado");
  ok(!/revisar costo/i.test(T), "y en ningún lado aparece \"revisar costo\"");
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
  // UNA SOLA LECTURA (owner 2026-08-07): la banda ALCANCE se disolvió; su contenido es ahora la segunda línea
  // del veredicto, en versión compacta — pero sigue nombrando los dos universos, que es lo que no se negocia.
  ok(T.includes(R.tension.reconciliaCorta), `la reconciliación compacta se muestra entera — "${R.tension.reconciliaCorta}"`);
  ok(!T.includes(R.tension.reconcilia), "…y NO conviven la versión larga y la corta diciendo lo mismo");
  // los dos montos parecidos conviven, pero SIEMPRE con su universo pegado
  ok(T.includes(c.enJuegoFmt) && T.includes(R.tension.enJuegoFmt), `los dos montos están a la vista — cartera ${c.enJuegoFmt} · plano ${R.tension.enJuegoFmt}`);
  ok(T.includes(R.tension.concentraPctFmt), `el % que el plano concentra de la oportunidad total se muestra y es dinámico — ${R.tension.concentraPctFmt}`);
  // REGLA DURA: cada aparición de la cifra de CARTERA viene con "toda la cartera" cerca; cada una de la del PLANO,
  // con "plano"/"que explican el X%". Se chequea sobre el texto real, no sobre la intención.
  const ventanas = (txt, aguja) => { const out = []; let i = txt.indexOf(aguja); while (i >= 0) { out.push(txt.slice(Math.max(0, i - 220), i + 220)); i = txt.indexOf(aguja, i + 1); } return out; };
  const vCartera = ventanas(T, c.enJuegoFmt).filter((w) => !w.includes("Ver todos los clientes"));
  ok(vCartera.length > 0 && vCartera.every((w) => /cartera completa|toda la cartera|cartera material|con brecha material/i.test(w)),
    `las ${vCartera.length} apariciones de ${c.enJuegoFmt} declaran su universo (toda la cartera)`);
  const vPlano = ventanas(T, R.tension.enJuegoFmt);
  ok(vPlano.length > 0 && vPlano.every((w) => /plano de decisi[óo]n|clientes del plano|el plano concentra|que explican el|Dentro de ellos/i.test(w)),
    `las ${vPlano.length} apariciones de ${R.tension.enJuegoFmt} declaran el suyo (el plano de decisión)`);
  // el TOTAL de la brecha ($5.0M) es un tercer universo y también se declara, A LA VISTA (no solo en el tooltip)
  ok(T.includes(`Toda la cartera, las ${R.rows.length} cuentas del negocio`), "el total de la brecha declara su universo a la vista");
  ok(T.includes(`${R.puente.materialFmt} de ese total está en las ${R.puente.materialN} con brecha material`),
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
  // el comparado de UNA entidad se titula "Comparado · <entidad> · 12 meses" — ese es el marcador exacto. (No
  // sirve buscar "Este año": el evolutivo GLOBAL del negocio, que sí debe estar, usa esa misma etiqueta.)
  ok(T2.includes(`Ver Ficha de ${fila}`) && !T2.includes(`Comparado · ${fila}`),
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

H("[10] SÍNTESIS · nada se dice dos veces, y nada queda tapado (owner 2026-08-07)");
{
  const { container } = abrir(evTemporal());
  const T = container.textContent;
  const cabecera = T.split("Evidencia completa")[0];
  const veces = (aguja) => (aguja ? cabecera.split(aguja).length - 1 : 0);
  // NO REPETIR CIFRAS NI CONCEPTOS · cada afirmación tiene UN solo hogar en la primera lectura
  for (const [aguja, que] of [
    [R.veredicto.soporte, "la lectura de alcance"],
    [R.tension.reconciliaCorta, "la reconciliación cabeza/cola"],
    [R.evolutivo.lectura, "la lectura del año"],
    [R.formacion.lectura, "el reparto de la venta"],
    [R.composicion.titulo, "el título de la composición"],
    [R.encabezadoDecisiones, "el encabezado de decisiones"],
  ]) ok(veces(aguja) === 1, `"${que}" aparece UNA sola vez — ${veces(aguja)}`);
  // el % del plano sobre la oportunidad total vive en la reconciliación Y en el tramo indicado (son dos
  // afirmaciones distintas sobre el mismo hecho); lo que NO puede pasar es que el ALCANCE se repita textual.
  ok(veces(`${R.plano.n} clientes explican`) === 1, "el 80/20 se declara una vez, no en cada bloque");
  // TOOLTIPS para lo explicativo: los InfoDot llevan las definiciones largas, no el cuerpo de la vista
  const tips = [...container.querySelectorAll(".adi-tip")].map((x) => x.textContent);
  ok(tips.length >= 8, `las definiciones y el modo de uso viven en tooltips — ${tips.length} en la vista`);
  ok(tips.some((t) => t.length > 200), "…y son las piezas largas (lo extenso no está en el cuerpo)");
  // EL BOTÓN FLOTANTE NO PUEDE TAPAR CONTENIDO
  const flot = conTexto(container, "Preguntar a ADI sobre esta vista");
  ok(!!flot, "el botón flotante de ADI está");
  // se mide el padding COMPUTADO, no el string del atributo: jsdom colapsa `padding` + `paddingBottom` en el
  // shorthand `padding: 18px 18px 74px`, así que buscar "padding-bottom" en el texto nunca acertaría.
  const scroller = [...container.querySelectorAll("div")].find((d) => /overflow-y:\s*auto/i.test(d.getAttribute("style") || ""));
  ok(!!scroller, "el contenedor con scroll de la Mesa está");
  const pb = scroller ? parseInt(getComputedStyle(scroller).paddingBottom || "0", 10) : 0;
  ok(pb >= 60, `reserva colchón abajo para que el botón flotante no se pose sobre el contenido — ${pb}px`);
  cleanup();
}

H("[11] MENOS CELESTE · el acento queda para lo que se toca (owner 2026-08-07)");
{
  const { container } = abrir(evTemporal());
  // jsdom serializa el color con espacios (`rgba(47, 184, 218, 0.5)`), así que el patrón los tolera.
  const CELESTE = /rgba\(\s*47,\s*184,\s*218/i;
  const cardsCeleste = [...container.querySelectorAll("div")]
    .filter((d) => new RegExp(`border:\\s*1px solid ${CELESTE.source}`, "i").test(d.getAttribute("style") || "")).length;
  ok(cardsCeleste === 0, `ninguna card de CONTENIDO lleva borde celeste completo — ${cardsCeleste}`);
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
