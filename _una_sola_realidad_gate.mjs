/* === _una_sola_realidad_gate.mjs · LAS TABLAS DEL TENANT SON LA REALIDAD (owner 2026-10-06, diseño `_ADI_DISENO_UNA_SOLA_REALIDAD.md`) ====================
 * LA DECISIÓN DEL OWNER: «nosotros habíamos decidido eliminar los escenarios como fuentes paralelas de la verdad real y quedarnos con UNA SOLA REALIDAD vigente de la empresa…
 * no quiero resolverlo reconciliando dos versiones que conceptualmente no deberían coexistir. Distingo esto de las simulaciones explícitas, que sí pueden tener escenarios separados.»
 * Hasta hoy el demo se servía por «bonanza» (13 `growth` literales + `kpis` literales + un rearme de marcas y familias desde los clientes): Σ venta $99.887K en cliente, $104.687K en marca, $100.000K en
 * la tabla, y dos totales distintos ($99,9M y $100,0M) en la misma pantalla. Este gate certifica el cierre:
 *   §1 · UN CUADRE: la tabla cuadra en venta, año anterior, presupuesto, unidades, contribución y acciones comerciales en cliente · marca · familia · mes · KPI — sin tolerancia más que el redondeo
 *        MEDIDO del 1 decimal con que se declara un %, nunca un literal. Los KPI de cabecera son la suma de las filas (una sola cifra por superficie).
 *   §2 · EL MOTOR: marca y familia se sirven como la TABLA, ordenadas (el Cuadro por marca ya no sale «en orden de tabla»); un override sin `growth` no produce NaN; `growth` es un DELTA sobre lo real.
 *   §3 · LAS SIMULACIONES SON DELTAS sobre la realidad: perder una cuenta, +2 pp de margen, crecer 10 %: lo que mueven es exactamente el delta, sobre la cifra de la tabla.
 *   §4 · CANDADO ANTI-RESURRECCIÓN (patrón `_poda_natural_anti_resurreccion_gate`): ningún tenant ni `src/` declara un escenario; `tension`/`crisis` y `_seededRand` no existen en el producto.
 *   §5 · LOS 532 ENCARGOS v13–v40: el texto de cada uno contra el texto VIEJO archivado (fixtures/una-sola-realidad): idéntico · solo cifras · solo premisas · o un caso LISTADO por id con su causa de
 *        diseño (§4f del diseño: Makita con variación, 5 marcas y 4 familias sobre el nivel, rankings de familias, empates de carga, redondeo de simulación, un umbral cruzado por el dato; y de la segunda
 *        consolidación, §2-bis: marca-desde-sku, makita-deja-de-ser-mejor-margen, phi-hair-cruza-benchmark, unidades-de-sku-calibradas). Sellado: 276 idénticos · 194 solo cifras · 13 solo premisas · 49 listados.
 *   §6 · CARNADAS: cada candado se prueba con el defecto adentro (en memoria: no se toca ningún archivo).
 *   §8 · LA BASE SON DOS ÁTOMOS (owner 2026-10-06, §2-bis): cliente y SKU; marca y familia = la SUMA de sus SKU en toda métrica aditiva (y sus razones salen de las sumas); el SKU se calibró con UN factor por métrica
 *        (contribución × 1,0556 · acciones × 0,9867 · unidades × 8,19, mayor resto) hasta los totales del cliente; ninguna tabla de marca o familia se escribe como literal. Con sus carnadas.
 *   §7 · NINGUNA SUPERFICIE DICE QUE LAS SIMULACIONES FALTAN (owner 2026-10-06): sin transforms de escenario las simulaciones explícitas siguen vivas sobre las tablas reales (el catálogo de herramientas del agente es LA
 *        fuente de qué se simula). El mapa del dato del agente, `ausentes` de la ingesta, BLOQUEADOS, `noCalcula` del catálogo y el acta de ingesta —en el demo y en una planilla— no pueden decir que faltan «transforms» o que
 *        «las simulaciones» están ausentes/bloqueadas. Tampoco hay una línea nueva que diga lo contrario: lo que se puede simular lo dice el catálogo, no un segundo texto.
 *        Y (owner 2026-10-07, Opción A): las unidades del año anterior por marca = el CRECIMIENTO DECLARADO (par viejo unidades/unidadesAnt) a la escala nueva × UN factor (≈ × 0,9986) hasta 5.222, mayor resto; la familia suma sus marcas.
 * CERO red · CERO LLM. `node --import ./scripts/offline-guard.mjs _una_sola_realidad_gate.mjs` */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import crypto from "node:crypto";
import { pathToFileURL } from "node:url";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { TENANT_EMPRESA2 } from "./src/data/tenants/empresa2.js";
import { TENANT_VACIO } from "./src/data/tenantEmpty.js";
import { SCENARIO_TRANSFORMS, ESCENARIO_INICIAL } from "./src/config/scenarios.js";
import { ESCENARIOS_CON_TRANSFORM, ESCENARIOS_QUE_ALTERAN_TASAS } from "./src/config/contract/figureType.js";
import * as ENG from "./src/engine/scenarios.js";
import { getVentasKPI, getMargenKPI } from "./src/engine/metrics.js";
import { buildCuadroMando } from "./src/adi/sentrix/cuadro.js";
import { buildResumenComercial } from "./src/adi/sentrix/resumenComercial.js";
import { proyectarDatoNegocio } from "./src/adi/oracle/datoProyectado.js";
import { crearAcciones } from "./src/adi/capacidad/acciones.js";
import { crearAlmacenEnMemoria } from "./src/adi/continuidad/almacen.js";
import { plantillaEjemplo } from "./src/ingesta/plantilla/generarPlantilla.js";
import { ingestarPlantilla } from "./src/ingesta/plantilla/ingestarPlantilla.js";
import { ingestarLibro, previewEnTexto } from "./src/ingesta/ingestarLibro.js";
import { construirXlsx } from "./src/ingesta/escribirLibro.js";
import { actaDeIngesta } from "./src/ingesta/acta/actaDeIngesta.js";
import { BLOQUEADOS } from "./src/ingesta/plantilla/motorKpi.js";
import { mapaDelDato } from "./src/adi/agente/mapaDelDato.js";
import { construirCatalogo } from "./src/adi/capacidad/catalogo.js";
import { catalogoAgente } from "./src/adi/agente/catalogoAgente.js";

let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ " + m + (extra ? "\n      " + String(extra).slice(0, 600) : "")); } };
const H = (t) => console.log("\n" + t);
const sum = (a, k) => a.reduce((s, x) => s + (Number(typeof k === "function" ? k(x) : x[k]) || 0), 0);
initTenant(TENANT_DEMO);
const T = TENANT_DEMO;
const S = ESCENARIO_INICIAL;

/* ═══ §1 · UN CUADRE ═════════════════════════════════════════════════════════════════════════════════════════════ */
/* cuadre(dataset) → la lista de lo que NO cuadra (vacía = cuadra). Sin tolerancia salvo la del redondeo MEDIDO de un % declarado con un decimal: por fila ≤ 0,05 % × venta. */
function cuadre(d) {
  const mal = [];
  const eq = (nombre, vals) => { const u = [...new Set(vals.map(([, v]) => v))]; if (u.length > 1) mal.push(`${nombre}: ${vals.map(([k, v]) => `${k}=${v}`).join(" · ")}`); };
  const ventaOf = Object.fromEntries(d.clientesVentas.map((c) => [c.nombre, c.actual]));
  eq("venta", [["cliente", sum(d.clientesVentas, "actual")], ["marca", sum(d.marcasVentas, "actual")], ["marcaMargen", sum(d.marcasMargen, "venta")], ["familia", sum(d.sfamiliasVentas, "actual")], ["familiaMargen", sum(d.sfamiliasMargen, "venta")], ["sku", sum(d.skusMargen, "venta")], ["mes", sum(d.ventasMensuales, "actual")], ["KPI", d.ventasKPI.totalActual]]);
  eq("año anterior", [["cliente", sum(d.clientesVentas, "anterior")], ["marca", sum(d.marcasVentas, "anterior")], ["familia", sum(d.sfamiliasVentas, "anterior")], ["mes", sum(d.ventasMensuales, "anterior")], ["KPI", d.ventasKPI.totalAnterior]]);
  eq("presupuesto", [["cliente", sum(d.clientesVentas, "presupuesto")], ["mes", sum(d.ventasMensuales, "presupuesto")], ["KPI", d.ventasKPI.totalPresupuesto]]);
  eq("unidades", [["clienteVentas", sum(d.clientesVentas, "unidades")], ["clienteMargen", sum(d.clientesMargen, "unidades")], ["marcaVentas", sum(d.marcasVentas, "unidades")], ["marcaMargen", sum(d.marcasMargen, "unidades")], ["sku", sum(d.skusMargen, "unidades")], ["familiaVentas", sum(d.sfamiliasVentas, "unidades")], ["familiaMargen", sum(d.sfamiliasMargen, "unidades")], ["mes", sum(d.ventasMensuales, "unidades")], ["KPI", d.ventasKPI.unidades]]);
  /* la contribución del cliente es la OFICIAL (D8): venta oficial × margen % por cliente — la misma cuenta del motor */
  const contribD8 = sum(d.clientesMargen, (c) => Math.round((ventaOf[c.nombre] ?? c.venta) * c.margen / 100));
  eq("contribución", [["cliente (D8)", contribD8], ["marca", sum(d.marcasMargen, "contribucion")], ["familia", sum(d.sfamiliasMargen, "contribucion")], ["mes (venta − costo − acciones)", sum(d.ventasMensuales, "actual") - sum(d.ventasMensuales, "costo") - sum(d.ventasMensuales, "acciones")], ["sku", sum(d.skusMargen, "contribucion")], ["KPI", d.margenKPI.totalUSD]]);
  /* las acciones comerciales se declaran con UN decimal (4,4 %): su suma por eje puede diferir del cliente en el redondeo de ese decimal, medido = Σ venta × 0,05 % */
  const acc = sum(d.clientesMargen, (c) => Math.round((ventaOf[c.nombre] ?? c.venta) * c.pctRebate / 100));
  const tolAcc = Math.ceil(sum(d.clientesVentas, "actual") * 0.0005);
  for (const [eje, v] of [["marca", sum(d.marcasMargen, "rebates")], ["familia", sum(d.sfamiliasMargen, "rebates")], ["sku", sum(d.skusMargen, "rebates")], ["mes", sum(d.ventasMensuales, "acciones")]]) if (Math.abs(v - acc) > tolAcc) mal.push(`acciones comerciales: cliente ${acc} vs ${eje} ${v} (tolerancia de redondeo medida ${tolAcc})`);
  /* la misma entidad en sus dos tablas: la carga y las unidades son las MISMAS (antes: Samsung 4,2 contra 4,4) */
  for (const [a, b, n] of [[d.marcasVentas, d.marcasMargen, "marca"], [d.sfamiliasVentas, d.sfamiliasMargen, "familia"]]) for (const x of a) { const y = b.find((z) => z.nombre === x.nombre); if (!y) { mal.push(`${n} ${x.nombre} sin par`); continue; } if (x.pctRebate !== y.pctRebate) mal.push(`${n} ${x.nombre}: carga ${x.pctRebate} ≠ ${y.pctRebate}`); if (x.unidades !== y.unidades) mal.push(`${n} ${x.nombre}: unidades ${x.unidades} ≠ ${y.unidades}`); }
  eq("capital", [["SKU", sum(d.skuInventario, "stockUSD")], ["por bodega", sum([...new Set(d.skuInventario.map((s) => s.bodega))], (b) => sum(d.skuInventario.filter((s) => s.bodega === b), "stockUSD"))], ["por marca", sum([...new Set(d.skuInventario.map((s) => s.marca))], (m) => sum(d.skuInventario.filter((s) => s.marca === m), "stockUSD"))]]);
  return mal;
}
H("§1 · UN CUADRE: la tabla cuadra en venta · año anterior · presupuesto · unidades · contribución · acciones comerciales, en cliente · marca · familia · mes · KPI");
{
  const mal = cuadre(T);
  ok(mal.length === 0, "★ el demo cuadra en TODOS los ejes (sin más tolerancia que el redondeo medido del decimal de un %)", mal.join("\n      "));
  const V = sum(T.clientesVentas, "actual");
  ok(V === 100000 && T.ventasKPI.totalActual === 100000 && sum(T.marcasVentas, "actual") === 100000 && sum(T.sfamiliasVentas, "actual") === 100000, `la venta es $${V}K en cliente, marca, familia y KPI (antes $99.887K · $104.687K · $100.000K)`);
  ok(sum(T.marcasMargen, "contribucion") === 25057 && T.margenKPI.totalUSD === 25057, "la contribución es $25.057K en cliente (D8), marca, familia, mes y KPI (antes $25.028K · $25.559K)");
  /* EL SKU ES UNO DE LOS DOS ÁTOMOS (owner 2026-10-06, §2-bis): su venta, contribución, acciones comerciales y unidades son las del universo cliente (antes: contribución $23.738K y 674 unidades, «otra muestra») */
  ok(sum(T.skusMargen, "venta") === V && sum(T.skusMargen, "contribucion") === 25057 && sum(T.skusMargen, "rebates") === 4075 && sum(T.skusMargen, "unidades") === 5520, "el SKU suma venta $100.000K · contribución $25.057K · acciones $4.075K · unidades 5.520 — los mismos totales que el universo cliente (antes: $23.738K · $4.130K · 674)");
  /* los KPI son la SUMA de las filas: una sola cifra por superficie */
  const D = ENG.deriveKpis(S), GV = getVentasKPI(null, null, S), GM = getMargenKPI(S);
  ok(D.ventas.totalActual === GV.totalActual && D.ventas.totalAnterior === GV.totalAnterior && D.ventas.totalPresupuesto === GV.totalPresupuesto && D.ventas.vsAnterior === GV.vsAnterior && D.ventas.vsPresupuesto === GV.vsPresupuesto, `★ deriveKpis y getVentasKPI dan la MISMA venta ($${D.ventas.totalActual}K · ${D.ventas.vsAnterior} % vs año anterior · ${D.ventas.vsPresupuesto} % vs presupuesto)`);
  ok(D.margen.pct === GM.pct && D.margen.totalUSD === GM.totalUSD && D.margen.gapPuntos === GM.gapPuntos, `★ deriveKpis y getMargenKPI dan el MISMO margen (${D.margen.pct} % · $${D.margen.totalUSD}K · brecha ${D.margen.gapPuntos} pp vs el año anterior declarado)`);
  const K = proyectarDatoNegocio(S);
  ok(/Ventas totales: \$100\.0M \(año anterior \$92\.9M · presupuesto \$97\.0M · 7\.6% vs año anterior · 3\.1% vs presupuesto\)/.test(K) && /Margen de la cartera: 25\.1% · Contribución total \$25\.1M/.test(K), "★ la carpeta que lee ADI dice $100.0M · +7,6 % · 25,1 % · $25,1M (antes $99,9M · +7,5 % · $25,0M junto a $100,0M · +7,6 % · 25,6 %)");
  const R = buildResumenComercial(S);
  ok(R.kpis.find((k) => k.key === "ventas").valor === "$100.0M" && R.kpis.find((k) => k.key === "contribucion").valor === "$25.1M" && R.kpis.find((k) => k.key === "margen").valor === "25.1%", "★ la Mesa Comercial dice lo mismo ($100.0M · $25.1M · 25.1%)");
  /* las marcas y familias de la pantalla son las de la tabla y suman la venta */
  ok(ENG.applyScenarioToMarcasVentas(S).length === 5 && sum(ENG.applyScenarioToMarcasVentas(S), "actual") === V && sum(ENG.applyScenarioToSfamiliasVentas(S), "actual") === V, "las 5 marcas (Makita incluida) y las 4 familias suman $100,0M (antes 4 marcas rearmadas = $104,7M)");
}

/* ═══ §2 · EL MOTOR ═════════════════════════════════════════════════════════════════════════════════════════════ */
H("§2 · EL MOTOR: marca y familia = la tabla, ORDENADAS · override sin growth no produce NaN · growth es un DELTA sobre la venta real");
{
  const orden = (rows, k) => rows.every((r, i) => i === 0 || rows[i - 1][k] >= r[k]);
  ok(orden(ENG.applyScenarioToMarcasVentas(S), "actual") && orden(ENG.applyScenarioToMarcasMargen(S), "contribucion") && orden(ENG.applyScenarioToSfamiliasVentas(S), "actual") && orden(ENG.applyScenarioToSfamiliasMargen(S), "venta"), "★ la rama identidad devuelve la tabla ORDENADA (venta desc · contribución desc) — antes una planilla real pintaba el Cuadro por marca en el orden de la TABLA");
  const cm = buildCuadroMando("marca", S);
  const contribs = (cm.rows || cm.filas).map((r) => r.contribucion);
  ok(contribs.length === 5 && contribs.every((c, i) => i === 0 || contribs[i - 1] >= c), `el Cuadro por MARCA va por contribución descendente (${(cm.rows || cm.filas).map((r) => r.nombre || r.name).join(" · ")})`);
  const sinNaN = (x) => !JSON.stringify(x).includes("null") || !/NaN/.test(String(x)) ;
  const ov = { clientes: { Falabella: { marginErosion: 2 } } };   /* solo marginErosion: SIN growth */
  const v = ENG.applyScenarioToClientesVentas(S, ov), m = ENG.applyScenarioToClientesMargen(S, ov), k = ENG.deriveKpis(S, ov);
  const finito = (arr, ks) => arr.every((r) => ks.every((c) => Number.isFinite(r[c])));
  ok(finito(v, ["actual", "unidades"]) && finito(m, ["venta", "contribucion", "costo", "rebates"]) && Number.isFinite(k.ventas.totalActual) && Number.isFinite(k.margen.totalUSD), "★ un override SOLO con marginErosion produce 0 NaN (antes `growth` undefined → actual = NaN)");
  ok(v.find((c) => c.nombre === "Falabella").actual === T.clientesVentas.find((c) => c.nombre === "Falabella").actual, "…y sin growth la fila REAL queda intacta (la venta de Falabella es la de la tabla)");
  const g = ENG.applyScenarioToClientesVentas(S, { clientes: { Falabella: { growth: 10 } } }).find((c) => c.nombre === "Falabella"), real = T.clientesVentas.find((c) => c.nombre === "Falabella");
  ok(g.actual === Math.round(real.actual * 1.1) && g.unidades === Math.round(real.unidades * 1.07), `★ growth es un DELTA sobre lo REAL: Falabella +10 % → ${g.actual} = round(${real.actual} × 1,10) (antes: anterior × (1+growth), sin relación con la tabla)`);
  ok(ENG.applyScenarioToSkuInventario(S) === T.skuInventario || JSON.stringify(ENG.applyScenarioToSkuInventario(S)) === JSON.stringify(T.skuInventario), "el inventario es la foto REAL (sin ramas por escenario)");
  ok(ENG.applyScenarioToClientesVentas("cualquier-id") === T.clientesVentas && JSON.stringify(ENG.applyScenarioToMarcasVentas("otro")) === JSON.stringify(ENG.applyScenarioToMarcasVentas(S)), "el id de escenario es solo la RANURA: ningún id cambia un número");
}

/* ═══ §3 · LAS SIMULACIONES SON DELTAS SOBRE LA REALIDAD ═══════════════════════════════════════════════════════════ */
H("§3 · simulaciones explícitas: lo que mueven es exactamente el delta, sobre la cifra de la tabla");
{
  const base = ENG.deriveKpis(S);
  const perder = ENG.deriveKpis(S, { clientes: { Lider: { __remove__: true } } });
  const lider = T.clientesVentas.find((c) => c.nombre === "Lider").actual;
  ok(perder.ventas.totalActual === base.ventas.totalActual - lider && perder.ventas.totalActual === 100000 - 17857, `★ perder Lider: la venta pasa de $${base.ventas.totalActual}K a $${perder.ventas.totalActual}K = 100.000 − ${lider} (antes 82.044 sobre un rearme)`);
  const mejora = ENG.deriveKpis(S, { clientes: { Falabella: { marginErosion: 2 } } });
  const fal = T.clientesVentas.find((c) => c.nombre === "Falabella").actual;
  ok(Math.abs((mejora.margen.totalUSD - base.margen.totalUSD) - Math.round(fal * 0.02)) <= 1, `★ Falabella +2 pp de margen: la contribución sube $${mejora.margen.totalUSD - base.margen.totalUSD}K ≈ ${fal} × 2 % (el delta es exacto sobre la venta de la tabla)`);
  const crece = ENG.deriveKpis(S, { clientes: { Falabella: { growth: 10 } } });
  ok(crece.ventas.totalActual - base.ventas.totalActual === Math.round(fal * 1.1) - fal, `Falabella crece 10 %: la venta total sube $${crece.ventas.totalActual - base.ventas.totalActual}K = el 10 % de la venta REAL de Falabella`);
  ok(base.inventario.totalUSD === ENG.deriveKpis(S, { clientes: { Lider: { __remove__: true } } }).inventario.totalUSD, "el inventario NO cambia con una simulación comercial (no hay mundo de inventario que lo mueva)");
}

/* ═══ §4 · CANDADO ANTI-RESURRECCIÓN ════════════════════════════════════════════════════════════════════════════ */
const sinComentarios = (src) => String(src).replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
/* anti(archivosSrc, tenants) → lo que resucita un escenario (vacío = no resucitó) */
function antiResurreccion(archivos, tenants) {
  const mal = [];
  for (const [n, t] of Object.entries(tenants)) if (t && t.SCENARIO_TRANSFORMS && Object.keys(t.SCENARIO_TRANSFORMS).length) mal.push(`tenant ${n} declara transforms: ${Object.keys(t.SCENARIO_TRANSFORMS).join(",")}`);
  for (const [f, src] of Object.entries(archivos)) {
    const s = sinComentarios(src);
    if (/SCENARIO_TRANSFORMS\s*=\s*\{\s*[A-Za-z_"'$]/.test(s)) mal.push(`${f}: SCENARIO_TRANSFORMS con claves`);
    if (/(?:===?|!==?)\s*["'](?:bonanza|tension|crisis)["']|case\s+["'](?:tension|crisis|bonanza)["']\s*:/.test(s)) mal.push(`${f}: ramifica por un escenario por nombre`);
    if (/\b_seededRand\b/.test(s)) mal.push(`${f}: _seededRand resucitó`);
    if (/ESCENARIOS_CON_TRANSFORM\s*=\s*\[\s*["']/.test(s)) mal.push(`${f}: ESCENARIOS_CON_TRANSFORM redefinido con elementos`);
    if (/mundos-de-prueba/.test(s)) mal.push(`${f}: el producto importa mundos de prueba (son de los gates)`);
  }
  return mal;
}
const leerSrc = (dir) => { const out = {}; const rec = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) rec(p); else if (/\.(js|jsx|mjs)$/.test(e.name)) out[p.replace(/\\/g, "/")] = fs.readFileSync(p, "utf8"); } }; rec(dir); return out; };
H("§4 · anti-resurrección: ningún tenant ni `src/` declara un escenario");
const SRC = leerSrc("./src");
{
  const { packRenombrado } = await import(pathToFileURL(path.resolve("./scripts/medicion-anfitrion/empresa-no-demo.mjs")).href);
  const tenants = { demo: T, empresa2: TENANT_EMPRESA2, vacio: TENANT_VACIO, rioclaro: packRenombrado({ version: 1 }) };
  const mal = antiResurreccion(SRC, tenants);
  ok(mal.length === 0, `★ ${Object.keys(tenants).length} tenants con SCENARIO_TRANSFORMS = {} y ${Object.keys(SRC).length} archivos de src/ sin escenarios por nombre, sin _seededRand, sin mundos de prueba`, mal.join("\n      "));
  ok(Object.keys(SCENARIO_TRANSFORMS).length === 0 && ESCENARIOS_CON_TRANSFORM.length === 0 && ESCENARIOS_QUE_ALTERAN_TASAS.length === 0, "la fachada y el contrato de tipado no listan ningún escenario (ESCENARIOS_CON_TRANSFORM = ESCENARIOS_QUE_ALTERAN_TASAS = [])");
  ok(ESCENARIO_INICIAL === "bonanza" && (SRC["src/config/scenarios.js"].match(/export const ESCENARIO_INICIAL\s*=/g) || []).length === 1, "ESCENARIO_INICIAL se conserva como la única RANURA (decisión 4 del owner: no se renombra) y se declara una sola vez");
  ok(!/_seededRand|tension|crisis/.test(sinComentarios(SRC["src/engine/scenarios.js"])), "engine/scenarios.js ya no trae las ramas tensión/crisis ni el azar semillado");
}

/* ═══ §5 · LOS 532 ENCARGOS v13–v40 ═════════════════════════════════════════════════════════════════════════════ */
const mask = (s) => String(s).replace(/[+\-−]?\$?\d[\d.,]*\s?[KMB%x]?/g, "#").replace(/\s+/g, " ").trim();
const esPremisa = (l) => /^▸ Sobre la premisa|lo que usted da por hecho|^el criterio cambió/.test(l);
const lineas = (t) => String(t).split("\n").map((l) => l.trimEnd());
/* LAS CAUSAS DE DISEÑO (§4f del diseño y las correcciones §2 a–d) · cada una con su FIRMA: lo que el diff de ese caso tiene que mostrar */
const CAUSAS = {
  "makita-con-variacion": [(sale, entra) => sale.some((l) => /sin dato de variación vs año anterior para Makita|ranking-parcial|sin-evidencia-temporal: la boleta no trae la variación de «Venta» de Makita/.test(l)) || entra.some((l) => /Makita/.test(l) && /Variación vs año anterior/.test(l)), "Makita gana «variación vs año anterior» (antes ausente): desaparece el límite «sin dato … para Makita» y el ranking por marca queda completo (§4f ④)"],
  "cinco-marcas-cuatro-familias": [(sale, entra) => entra.some((l) => /Bosch, Samsung, Makita, Philips, LG|Materiales de Construcción, Electrodomésticos, Cuidado Personal|Serían \d+ marcas|Sería 1 marca/.test(l)) || sale.some((l) => /Bosch, Samsung, Makita\.|Materiales de Construcción, Electrodomésticos\.|Sería 1 marca|Serían \d+ marcas/.test(l)), "Makita entra al conteo: con la tabla las 5 marcas y las 4 familias eran las que superaban el nivel de carga (antes 3 de 5 y 2 de 4), y el margen de marca calibrado cambia cuántas quedan sobre una referencia (§4f ②); con marca desde SKU el conteo vuelve a mirarse en `marca-desde-sku`"],
  "empate-de-carga-de-marcas": [(sale, entra) => [...sale, ...entra].some((l) => /empate del filo|Empate en el orden servido|empatad[oa]s? con|empate: Samsung, Makita/.test(l) && /(?<![A-Z-])(Philips|LG|Samsung|Makita|Bosch)(?![-A-Z0-9])/.test(l)), "el empate de carga por MARCA cambia de miembros: la carga de la tabla de ventas se alineó con la de margen (§2 a) y, con marca = suma de sus SKU, deja de haber empate (Philips 3,5 % · LG 3,9 %)"],
  "ranking-de-familias": [(sale, entra) => [...sale, ...entra].some((l) => /Por familia, ordenado por (Margen|Variación)|variación vs año anterior: |margen: (Línea|Cuidado|Materiales)/.test(l)), "el ranking de familias por variación y por margen: Materiales de Construcción entra Makita (+37 %) y sube (§4f ③); con marca desde SKU su margen baja a 25,3 % y Cuidado Personal vuelve a ser la de mejor margen"],
  "redondeo-de-simulacion": [(sale, entra) => sale.some((l) => /La venta (se mantiene en|pasaría de)/.test(l)) && entra.some((l) => /La venta (se mantiene en|pasaría de)/.test(l)), "una simulación dice «se mantiene» o «pasaría de» según redondee la cifra de partida (la venta de la tabla difiere del redondeo de «bonanza» en ≤ $26K): el delta es el mismo"],
  /* ── SEGUNDA CONSOLIDACIÓN (owner 2026-10-06, §2-bis): LA BASE SON DOS ÁTOMOS, cliente y producto; marca y familia = la SUMA de sus SKU ── */
  "marca-desde-sku": [(sale, entra) => [...sale, ...entra].some((l) => /\b(marcas?|familias?)\b/i.test(l) && /Samsung|Philips|\bLG\b|Bosch|Makita|Cuidado Personal|Línea Blanca|Electrodomésticos|Materiales de Construcción/.test(l)), "marca y familia dejan de escribirse: son la SUMA de sus SKU (contribución, margen, carga). Cambian los rankings por contribución (Philips pasa a primera) y por margen de familia (Cuidado Personal primera) y los conteos sobre el nivel de carga (Philips 3,5 % ya no lo supera: 4 de 5 marcas y 3 de 4 familias)"],
  "makita-deja-de-ser-mejor-margen": [(sale) => sale.some((l) => /Makita[^|]*(34\.8|35\.5)%/.test(l)), "con la contribución de sus dos SKU (MAK-SAW18V y MAK-COMP-AIR) Makita pasa de 34,8 % (35,5 % antes de la tabla) a 26,1 % de margen: deja de ser la marca de mejor margen (Philips 28,8 %) y de estar sobre el benchmark (30,1 %): 0 de 5 marcas lo superan"],
  "phi-hair-cruza-benchmark": [(sale, entra) => [...sale, ...entra].some((l) => /PHI-HAIR-PRO/.test(l) && /benchmark/i.test(l)), "con la contribución calibrada PHI-HAIR-PRO pasa de 30,0 % a 31,7 % de margen y cruza el benchmark (30,1 %): sale del grupo «SKU bajo el benchmark» y entra al de «sobre el benchmark»"],
  "unidades-de-sku-calibradas": [(sale) => sale.some((l) => /nidades vendidas/.test(l) && /empat/i.test(l)), "las unidades de SKU pasan al universo del cliente (× 8,19, Σ 5.520): LG-WASH11KG y BOS-DRILL18V ya no empatan (328 contra 327) y el empate del filo de una lista desaparece; el orden entre SKU no cambia"],
  "veredicto-de-premisa-por-el-dato": [(sale, entra) => [...sale, ...entra].some((l) => /Sobre la premisa|lo que usted da por hecho/.test(l)), "el veredicto de una premisa (correcto ↔ no es así) cambia porque cambia el dato contra el que se verifica"],
  "umbral-del-filtro-cruzado-por-el-dato": [(sale, entra, enc) => JSON.stringify(enc).includes('"filtros"') && /"valor":\d/.test(JSON.stringify(enc)), "un filtro del encargo con un umbral numérico escrito sobre el dato de entonces (saldo vencido > $1.055.700 · variación > 4 % · unidades > 140) lo cruza otra cuenta con el dato vigente"],
};
/* LOS CASOS LISTADOS POR ID (42), cada uno con la(s) causa(s) que su diff tiene que mostrar */
const LISTADOS = {"v13:Z67":["marca-desde-sku","makita-deja-de-ser-mejor-margen"],"v14:Z05":["marca-desde-sku"],"v17:W16":["redondeo-de-simulacion"],"v17:W17":["redondeo-de-simulacion"],"v17:W23":["redondeo-de-simulacion"],"v17:W89":["phi-hair-cruza-benchmark","veredicto-de-premisa-por-el-dato"],"v18:X78":["umbral-del-filtro-cruzado-por-el-dato"],"v20:U04":["empate-de-carga-de-marcas","marca-desde-sku"],"v20:U31":["redondeo-de-simulacion"],"v21:T03":["cinco-marcas-cuatro-familias","empate-de-carga-de-marcas","marca-desde-sku"],"v21:T78":["redondeo-de-simulacion"],"v22:S100":["unidades-de-sku-calibradas"],"v23:R04":["empate-de-carga-de-marcas","marca-desde-sku"],"v23:R40":["marca-desde-sku"],"v23:R78":["redondeo-de-simulacion"],"v23:R45":["cinco-marcas-cuatro-familias","marca-desde-sku","makita-deja-de-ser-mejor-margen"],"v24:Q02":["unidades-de-sku-calibradas","veredicto-de-premisa-por-el-dato"],"v24:Q77":["redondeo-de-simulacion"],"v24:Q78":["redondeo-de-simulacion"],"v24:Q45":["phi-hair-cruza-benchmark","veredicto-de-premisa-por-el-dato","umbral-del-filtro-cruzado-por-el-dato"],"v25:P04":["empate-de-carga-de-marcas","marca-desde-sku"],"v25:P76":["redondeo-de-simulacion"],"v25:P23":["ranking-de-familias","marca-desde-sku"],"v25:P45":["cinco-marcas-cuatro-familias","marca-desde-sku","makita-deja-de-ser-mejor-margen"],"v26:N07":["unidades-de-sku-calibradas","veredicto-de-premisa-por-el-dato"],"v27:M45":["cinco-marcas-cuatro-familias","marca-desde-sku"],"v27:M51":["cinco-marcas-cuatro-familias","marca-desde-sku"],"v27:M86":["redondeo-de-simulacion"],"v28:L23":["marca-desde-sku","makita-deja-de-ser-mejor-margen","veredicto-de-premisa-por-el-dato"],"v28:L100":["makita-con-variacion","marca-desde-sku"],"v29:K38":["cinco-marcas-cuatro-familias","marca-desde-sku"],"v29:K56":["makita-con-variacion"],"v30:J38":["cinco-marcas-cuatro-familias","marca-desde-sku"],"v30:J56":["makita-con-variacion"],"v30:J78":["phi-hair-cruza-benchmark"],"v31:H42":["cinco-marcas-cuatro-familias","marca-desde-sku"],"v31:H23":["ranking-de-familias","marca-desde-sku"],"v32:G07":["cinco-marcas-cuatro-familias","empate-de-carga-de-marcas","marca-desde-sku"],"v32:G41":["cinco-marcas-cuatro-familias","marca-desde-sku"],"v32:G78":["makita-con-variacion","ranking-de-familias","marca-desde-sku"],"v34:E56":["cinco-marcas-cuatro-familias","marca-desde-sku","veredicto-de-premisa-por-el-dato"],"v35:D03":["makita-con-variacion"],"v35:D52":["cinco-marcas-cuatro-familias","marca-desde-sku"],"v35:D67":["makita-con-variacion"],"v36:C78":["umbral-del-filtro-cruzado-por-el-dato"],"v37:B78":["makita-con-variacion","marca-desde-sku"],"v38:A06":["phi-hair-cruza-benchmark","veredicto-de-premisa-por-el-dato","umbral-del-filtro-cruzado-por-el-dato"],"v38:A45":["marca-desde-sku"],"v39:Z09":["umbral-del-filtro-cruzado-por-el-dato"]};
/* clasificar(textoViejo, textoNuevo, encargo) → "igual" | "cifras" | "premisas" | { causas: [...] } | "SIN-CAUSA" */
function clasificar(a, b, enc) {
  if (a === b) return "igual";
  const la = lineas(a), lb = lineas(b);
  if (la.map(mask).join("\n") === lb.map(mask).join("\n")) return "cifras";
  const sp = (ls) => ls.filter((l) => !esPremisa(l) && l.trim() !== "").map(mask).join("\n");
  if (sp(la) === sp(lb)) return "premisas";
  const ma = la.map(mask), mb = lb.map(mask), sa = new Set(ma), sb = new Set(mb);
  const sale = la.filter((l, i) => !sb.has(ma[i]) && l.trim()), entra = lb.filter((l, i) => !sa.has(mb[i]) && l.trim());
  const causas = Object.entries(CAUSAS).filter(([, [f]]) => f(sale, entra, enc)).map(([n]) => n);
  return causas.length ? { causas } : "SIN-CAUSA";
}
H("§5 · los 532 encargos v13–v40: el diff contra el texto VIEJO es solo cifras · premisas · casos listados por id");
{
  const ANTES = JSON.parse(zlib.gunzipSync(fs.readFileSync("./fixtures/una-sola-realidad/textos-v13-v40-antes.json.gz")).toString("utf8")).textos;
  const SELLO_VIEJO = JSON.parse(fs.readFileSync("./fixtures/una-sola-realidad/textos-v13-v40.sha256.antes.json", "utf8")).hashes;
  const SELLO_NUEVO = JSON.parse(fs.readFileSync("./fixtures/total-del-listado/textos-v13-v40.sha256.json", "utf8")).hashes;
  const MUESTRA = JSON.parse(fs.readFileSync("./fixtures/procedencia/muestra-v13-v40.json", "utf8")).casos;
  const sha = (s) => crypto.createHash("sha256").update(String(s)).digest("hex");
  ok(MUESTRA.length === 532 && Object.keys(ANTES).length === 532 && MUESTRA.every((c) => c.id in ANTES), "el archivo del texto viejo trae los 532 encargos del catálogo");
  ok(MUESTRA.every((c) => (ANTES[c.id] == null ? SELLO_VIEJO[c.id] == null : sha(ANTES[c.id]) === SELLO_VIEJO[c.id])), "★ el texto viejo archivado es EXACTAMENTE lo que se selló: su sha256 por caso es el sello viejo (532 de 532)");
  const TD = { id: "demo", nombre: "ADI Demo", dataset: TENANT_DEMO, version: 1, sello: null };
  initTenant(TENANT_DEMO);
  const NUEVOS = {};
  for (const c of MUESTRA) { const r = await crearAcciones({ continuidad: crearAlmacenEnMemoria() }).consultar({ tenant: TD, encargo: c.encargo }); NUEVOS[c.id] = r && r.ok && r.entrega ? r.entrega.texto : null; }
  ok(MUESTRA.every((c) => (NUEVOS[c.id] == null ? SELLO_NUEVO[c.id] == null : sha(NUEVOS[c.id]) === SELLO_NUEVO[c.id])), "el sello NUEVO (textos-v13-v40.sha256.json) es el del texto vigente: 532 de 532");
  const cuenta = { igual: 0, cifras: 0, premisas: 0, listado: 0 }, malas = [], listadosVistos = new Set(), causaFalta = [];
  for (const c of MUESTRA) {
    const k = ANTES[c.id] == null || NUEVOS[c.id] == null ? (ANTES[c.id] == null && NUEVOS[c.id] == null ? "igual" : "SIN-CAUSA") : clasificar(ANTES[c.id], NUEVOS[c.id], c.encargo);
    if (k === "igual" || k === "cifras" || k === "premisas") { cuenta[k]++; if (c.id in LISTADOS) causaFalta.push(`${c.id} está listado pero cambia solo ${k}`); continue; }
    if (k === "SIN-CAUSA") { malas.push(`${c.id}: cambia por algo que el diseño no explica`); continue; }
    if (!(c.id in LISTADOS)) { malas.push(`${c.id}: cambia por «${k.causas.join(" + ")}» y NO está listado por id`); continue; }
    if (!LISTADOS[c.id].every((n) => k.causas.includes(n))) { malas.push(`${c.id}: listado como «${LISTADOS[c.id].join(" + ")}» pero su diff muestra «${k.causas.join(" + ")}»`); continue; }
    listadosVistos.add(c.id); cuenta.listado++;
  }
  ok(malas.length === 0, `★ cada uno de los 532 es idéntico · solo cifras · solo premisas, o un caso LISTADO por id con su causa de diseño (${JSON.stringify(cuenta)})`, malas.slice(0, 8).join("\n      "));
  ok(causaFalta.length === 0 && listadosVistos.size === Object.keys(LISTADOS).length, `la lista no tiene casos huérfanos: los ${Object.keys(LISTADOS).length} listados cambian de verdad por su causa (ninguno quedó «idéntico»)`, causaFalta.join(" | "));
  ok(cuenta.igual === 276 && cuenta.cifras === 194 && cuenta.premisas === 13 && cuenta.listado === 49, "las cuentas están selladas: 276 idénticos · 194 solo cifras · 13 solo premisas · 49 listados = 532 (si el producto mueve un texto más, este candado lo nombra)");
  /* las premisas se refrescaron SOLO en su cifra: el resto del encargo (partes, conteos, órdenes) es el de siempre — el catálogo conserva sus 28 versiones y sus 532 casos */
  ok(new Set(MUESTRA.map((c) => c.id.split(":")[0])).size === 28, "el catálogo sigue siendo de 28 versiones (v13–v40) y 532 encargos");
  globalThis.__532 = { ANTES, NUEVOS, MUESTRA };
}

/* ═══ §6 · CARNADAS: CADA CANDADO SE PRUEBA CON EL DEFECTO ADENTRO ═══════════════════════════════════════════════ */
H("§6 · carnadas (en memoria): el defecto reconstruido pone cada candado en ROJO");
{
  /* (a) el descuadre de antes: la marca vuelve a sumar $104,7M (el rearme), o la carga de una marca difiere entre sus dos tablas */
  const rearme = { ...T, marcasVentas: T.marcasVentas.map((m) => (m.nombre === "Samsung" ? { ...m, actual: 33158 } : m)) };
  ok(cuadre(rearme).some((x) => /^venta/.test(x)), "CARNADA «Samsung vuelve a sumar $33.158K (el rearme de bonanza)» → el cuadre de venta se pone ROJO");
  const carga = { ...T, marcasVentas: T.marcasVentas.map((m) => (m.nombre === "Samsung" ? { ...m, pctRebate: 4.2 } : m)) };
  ok(cuadre(carga).some((x) => /carga 4\.2 ≠ 4\.3/.test(x)), "CARNADA «Samsung 4,2 % en una tabla y 4,3 % en la otra» → el cuadre por entidad se pone ROJO");
  const unid = { ...T, ventasKPI: { ...T.ventasKPI, unidades: 5703 } };
  ok(cuadre(unid).some((x) => /^unidades/.test(x)), "CARNADA «5.703 unidades en el KPI contra 5.520 en las filas (la tajada de Makita)» → el cuadre de unidades se pone ROJO");
  const kpi = { ...T, margenKPI: { ...T.margenKPI, totalUSD: 25559 } };
  ok(cuadre(kpi).some((x) => /^contribución/.test(x)), "CARNADA «el KPI de margen vuelve a $25.559K (literal)» → el cuadre de contribución se pone ROJO");
  /* (b) la resurrección */
  const resucita = antiResurreccion({ "src/x.js": `export const SCENARIO_TRANSFORMS = { bonanza: { clientes: {} } };` }, { demo: { SCENARIO_TRANSFORMS: { crisis: {} } } });
  ok(resucita.length === 2, "CARNADA «un tenant declara «crisis» y un archivo de src/ declara «bonanza»» → el candado anti-resurrección se pone ROJO");
  ok(antiResurreccion({ "src/y.js": `if (scenarioId === "tension") { x(); }` }, {}).length === 1 && antiResurreccion({ "src/z.js": `const r = _seededRand("a");` }, {}).length === 1, "CARNADA «una rama por nombre de escenario / _seededRand de vuelta» → ROJO");
  ok(antiResurreccion({ "src/c.js": `// if (scenarioId === "tension") — comentario\n/* _seededRand */ const x = 1;` }, {}).length === 0, "…y la historia en COMENTARIOS no cuenta (la historia del repo se conserva, como en la poda del natural)");
  /* (c) los 532: un texto cuya estructura cambia por algo que el diseño no explica */
  const { ANTES, NUEVOS, MUESTRA } = globalThis.__532;
  const id = MUESTRA.find((c) => ANTES[c.id] === NUEVOS[c.id] && ANTES[c.id]).id;
  const tocado = ANTES[id].replace(/\n\*\*Respuesta\.\*\*/, "\n**Respuesta.**\n▸ Una línea nueva que el diseño no explica.");
  ok(!["igual", "cifras", "premisas"].includes(clasificar(ANTES[id], tocado, {})), "CARNADA «una línea de contenido que el diseño no explica en un texto idéntico» → el clasificador NO la acepta como idéntico, cifras ni premisas (queda sin causa y exige un id listado)");
  ok(clasificar(ANTES[id], ANTES[id].replace(/\$\d[\d.,]*[KM]/, () => "$999.9M"), {}) === "cifras", "…y un cambio de CIFRA sí es «solo cifras» (el control: lo permitido pasa)");
  const conPremisa = ANTES[id] + "\n▸ Sobre la premisa planteada en la consulta: no es así — X.";
  ok(clasificar(ANTES[id], conPremisa, {}) === "premisas", "…y una línea de PREMISA nueva es «solo premisas» (el control: lo permitido pasa)");
}

/* ═══ §7 · NINGUNA SUPERFICIE DICE QUE LAS SIMULACIONES FALTAN (demo y planilla) ═════════════════════════════════════ */
H("§7 · el mapa del agente, la ingesta, BLOQUEADOS, noCalcula y el acta no dicen que las simulaciones faltan (demo y planilla)");
{
  const DICE_AUSENTE = /transforms? de simulaci|simulaci[oó]n(es)? .{0,20}(no|sin|bloque)/i;
  /* qué texto lee cada lector, por tenant: el mapa que carga el agente, el catálogo que lee el anfitrión (noCalcula) */
  const superficies = (nombre) => ({
    [`${nombre} · mapa del dato del agente`]: mapaDelDato("actual"),
    [`${nombre} · noCalcula del catálogo`]: JSON.stringify(construirCatalogo().noCalcula),
  });
  const planilla = ingestarPlantilla(Buffer.from(plantillaEjemplo()), { nombreArchivo: "v2.xlsx", fechaCarga: "2026-08-31" });
  const hoja = { nombre: "Margen", filas: [["Cliente", "Venta", "Costo", "Rebates", "Margen %"], ["Cuenta Uno", 1000, 700, 10, 29], ["Cuenta Dos", 2000, 1400, 20, 29]] };
  const libro = ingestarLibro(construirXlsx([hoja]), { id: "sim-lock", nombre: "Sim lock", nombreArchivo: "x.xlsx", unidadesConfirmadas: true, ejePorHoja: { Margen: "clientesMargen" } });
  ok(planilla.ok === true && libro.ok === true, "precondición: la planilla de ejemplo y un libro libre cargan");
  const S7 = {};
  initTenant(TENANT_DEMO);
  Object.assign(S7, superficies("demo"));
  initTenant(planilla.dataset);
  Object.assign(S7, superficies("planilla"));
  initTenant(TENANT_DEMO);
  S7["BLOQUEADOS (motorKpi)"] = JSON.stringify(BLOQUEADOS);
  S7["acta de ingesta · planilla"] = JSON.stringify(actaDeIngesta(planilla));
  S7["acta de ingesta · libro libre"] = JSON.stringify(actaDeIngesta(libro));
  S7["ausentes de la ingesta (normalizar) · libro libre"] = JSON.stringify(libro.preview.ausentes);
  S7["preview en texto · libro libre"] = previewEnTexto(libro.preview);
  const dicen = Object.entries(S7).filter(([, t]) => DICE_AUSENTE.test(t)).map(([k, t]) => `${k}: «${(t.match(DICE_AUSENTE) || [""])[0]}»`);
  ok(Object.keys(S7).length === 9 && Object.values(S7).every((t) => typeof t === "string" && t.length > 20), "las nueve superficies existen y traen texto (el candado no mira vacío)");
  ok(dicen.length === 0, "★ ninguna de las superficies dice que faltan «transforms» ni que las simulaciones están ausentes o bloqueadas", dicen.join("\n      "));
  ok(!BLOQUEADOS.some((b) => /simulaci|transform|escenario/i.test(`${b.id} ${b.que} ${b.porque} ${b.paraAbrirlo}`)) && !(libro.preview.ausentes || []).some((a) => /simulaci|transform|escenario/i.test(`${a.llave} ${a.que} ${a.costo}`)), "…y ni BLOQUEADOS ni los `ausentes` de la ingesta traen una entrada sobre simulaciones, transforms o escenarios (ni negativa ni positiva)");
  /* las simulaciones SIGUEN existiendo: el catálogo de herramientas del agente las tiene (esa es la única descripción de qué se simula) */
  const nombres = catalogoAgente().map((t) => t.name);
  ok(["simulate", "simulateGeneral", "simulateCarga", "simulateCosto", "simulateCapital", "proyectar"].every((n) => nombres.includes(n)), "las herramientas de simulación existen en el catálogo del agente (simulate · simulateGeneral · simulateCarga · simulateCosto · simulateCapital · proyectar)");
  ok(!/puedes simular|se puede simular|simulaciones disponibles/i.test(S7["demo · mapa del dato del agente"] + S7["planilla · mapa del dato del agente"] + S7["demo · noCalcula del catálogo"]), "y el mapa del dato NO duplica esa descripción con una línea positiva («puedes simular…»): una sola fuente de qué se simula");
  /* CARNADAS: la frase retirada vuelve y el candado se pone ROJO */
  ok(DICE_AUSENTE.test("LÍMITES: sin transforms de simulación declarados.") && DICE_AUSENTE.test("las simulaciones: sin transforms de simulación sobre este dato") && DICE_AUSENTE.test("las simulaciones no están disponibles"), "CARNADA «sin transforms de simulación declarados» / «las simulaciones no están disponibles» → el detector se pone ROJO");
  ok(!DICE_AUSENTE.test("Simulación explícita: crecer 10 % la venta sobre la tabla real"), "…y una simulación explícita descrita en positivo NO se confunde con el defecto (el control)");
}

/* ═══ §8 · LA BASE SON DOS ÁTOMOS: CLIENTE Y PRODUCTO · MARCA Y FAMILIA SE DERIVAN DE LOS SKU (owner 2026-10-06, §2-bis) ═════════════════════════════════
 * «En un negocio real la verdad es cada fila de venta; cliente y producto son dos formas de sumar las mismas filas; marca y familia son grupos de productos. El demo no trae filas, así que su base son dos
 * tablas: clientes y productos. Donde cliente y producto discrepan, manda el CLIENTE; el producto se ajusta con UN factor por métrica, idéntico para los 13 SKU.» */
H("§8 · la base son dos átomos (cliente · SKU): marca y familia = la SUMA de sus SKU, el SKU se calibró con un factor uniforme, y ninguna de las dos tablas es un literal");
const r1 = (n) => Math.round(n * 10) / 10, r2 = (n) => Math.round(n * 100) / 100;
/* derivadas(d) → lo que NO es la suma de sus SKU (vacío = marca y familia son un grupo de productos) */
function derivadas(d) {
  const mal = [];
  for (const [tabla, campo, tipo] of [[d.marcasMargen, "marca", "marca"], [d.sfamiliasMargen, "sfamilia", "familia"]]) {
    for (const g of tabla) {
      const filas = d.skusMargen.filter((s) => s[campo] === g.nombre);
      if (!filas.length) { mal.push(`${tipo} ${g.nombre}: no tiene ningún SKU`); continue; }
      for (const k of ["venta", "costo", "rebates", "contribucion", "unidades"]) if (g[k] !== sum(filas, k)) mal.push(`${tipo} ${g.nombre}.${k}: ${g[k]} ≠ Σ SKU ${sum(filas, k)}`);
      if (g.margen !== r1(g.contribucion / g.venta * 100)) mal.push(`${tipo} ${g.nombre}.margen: ${g.margen} ≠ contribución ÷ venta`);
      if (g.pctRebate !== r1(g.rebates / g.venta * 100)) mal.push(`${tipo} ${g.nombre}.pctRebate: ${g.pctRebate} ≠ rebates ÷ venta`);
      if (g.costoMedio !== r2(g.costo / g.unidades)) mal.push(`${tipo} ${g.nombre}.costoMedio: ${g.costoMedio} ≠ costo ÷ unidades`);
      if (g.precioLista !== r2(g.venta / g.unidades)) mal.push(`${tipo} ${g.nombre}.precioLista: ${g.precioLista} ≠ venta ÷ unidades`);
    }
    if (sum(tabla, "venta") !== sum(d.skusMargen, "venta")) mal.push(`${tipo}: la venta del eje no es la de todos los SKU`);
  }
  for (const [tabla, campo, tipo] of [[d.marcasVentas, "marca", "marca"], [d.sfamiliasVentas, "sfamilia", "familia"]]) for (const g of tabla) {
    const filas = d.skusMargen.filter((s) => s[campo] === g.nombre);
    if (g.actual !== sum(filas, "venta")) mal.push(`${tipo} ${g.nombre} (ventas).actual: ${g.actual} ≠ Σ SKU ${sum(filas, "venta")}`);
    if (g.unidades !== sum(filas, "unidades")) mal.push(`${tipo} ${g.nombre} (ventas).unidades: ${g.unidades} ≠ Σ SKU ${sum(filas, "unidades")}`);
  }
  return mal;
}
/* sinLiteral(src) → las tablas de marca y familia que el archivo ESCRIBE a mano (vacío = ninguna: las deriva) */
function sinLiteral(src) { return ["marcasVentas", "marcasMargen", "sfamiliasVentas", "sfamiliasMargen"].filter((n) => new RegExp(`export const ${n}\\s*=\\s*\\[`).test(sinComentarios(src))); }
/* LA TABLA DE SKU ANTES DE LA CALIBRACIÓN (contribución · acciones · unidades, en el orden de la tabla) y el redondeo de mayor resto: la prueba de que el factor es UNO por métrica */
const BASE_SKU = { contribucion: [2430, 2460, 2100, 2852, 624, 1848, 3444, 2790, 1408, 1837, 756, 1054, 135], rebates: [486, 599, 300, 372, 308, 297, 443, 298, 243, 340, 218, 124, 102], unidades: [43, 20, 66, 40, 17, 35, 148, 131, 98, 40, 17, 15, 4] };
function mayorResto(vals, objetivo) {
  const f = objetivo / vals.reduce((a, b) => a + b, 0), crudo = vals.map((v) => v * f), piso = crudo.map(Math.floor);
  let resto = objetivo - piso.reduce((a, b) => a + b, 0);
  crudo.map((c, i) => [c - piso[i], i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]).slice(0, resto).forEach(([, i]) => piso[i]++);
  return { f, out: piso };
}
function factorUniforme(d) {
  const mal = [], factores = {};
  const objetivos = { contribucion: 25057, rebates: 4075, unidades: 5520 };
  for (const k of Object.keys(BASE_SKU)) {
    const { f, out } = mayorResto(BASE_SKU[k], objetivos[k]); factores[k] = f;
    d.skusMargen.forEach((s, i) => { if (s[k] !== out[i]) mal.push(`${s.nombre}.${k}: ${s[k]} ≠ ${out[i]} (factor único ${f.toFixed(4)} con redondeo de mayor resto)`); });
  }
  d.skusMargen.forEach((s) => { if (s.costo !== s.venta - s.rebates - s.contribucion) mal.push(`${s.nombre}.costo ≠ venta − rebates − contribución`); if (s.margen !== r1(s.contribucion / s.venta * 100)) mal.push(`${s.nombre}.margen ≠ contribución ÷ venta`); if (s.pctRebate !== r1(s.rebates / s.venta * 100)) mal.push(`${s.nombre}.pctRebate ≠ rebates ÷ venta`); });
  return { mal, factores };
}
/* LAS UNIDADES DEL AÑO ANTERIOR POR MARCA = EL CRECIMIENTO DECLARADO A LA ESCALA NUEVA (owner 2026-10-07, Opción A de §2-bis).
 * Lo ÚNICO que la tabla vieja de marca declaraba bien de las unidades del año anterior era su CRECIMIENTO (unidades ÷ unidadesAnt de la tabla vieja); al derivar las unidades de la marca desde los SKU (Σ 5.520), esos pares
 * viejos son el insumo declarado y la regla es UNA: unidadesAnt = unidades(Σ SKU) × (unidadesAnt vieja ÷ unidades vieja) × f, con UN f que lleva la suma al universo cliente (5.222), y mayor resto. */
const CRECIMIENTO_DECLARADO = { Samsung: [1747, 1703], Philips: [1892, 1788], LG: [1268, 1135], Bosch: [436, 434], Makita: [177, 162] };   /* [unidades, unidadesAnt] de la tabla vieja: el único insumo declarado */
function unidadesAnteriores(d) {
  const mal = [], marcas = Object.keys(CRECIMIENTO_DECLARADO), objetivo = sum(d.clientesVentas, "unidadesAnt");
  const crudo = marcas.map((m) => sum(d.skusMargen.filter((x) => x.marca === m), "unidades") * CRECIMIENTO_DECLARADO[m][1] / CRECIMIENTO_DECLARADO[m][0]);
  const { f, out } = mayorResto(crudo, objetivo);
  const porMarca = Object.fromEntries(d.marcasVentas.map((m) => [m.nombre, m]));
  marcas.forEach((m, i) => { const g = porMarca[m]; if (!g) { mal.push(`marca ${m}: falta`); return; }
    if (g.unidadesAnt !== out[i]) mal.push(`marca ${m}.unidadesAnt: ${g.unidadesAnt} ≠ ${out[i]} (crecimiento declarado × unidades de sus SKU × f ${f.toFixed(4)}, mayor resto)`);
    const dec = (CRECIMIENTO_DECLARADO[m][0] / CRECIMIENTO_DECLARADO[m][1] - 1) * 100, real = (g.unidades / g.unidadesAnt - 1) * 100;
    if (Math.abs(real - dec) > 0.3) mal.push(`marca ${m}: crecimiento en unidades ${r1(real)} % ≠ el declarado ${r1(dec)} % (±0,3 pp)`); });
  if (sum(d.marcasVentas, "unidadesAnt") !== objetivo) mal.push(`Σ unidadesAnt marca ${sum(d.marcasVentas, "unidadesAnt")} ≠ cliente ${objetivo}`);
  if (sum(d.sfamiliasVentas, "unidadesAnt") !== objetivo) mal.push(`Σ unidadesAnt familia ${sum(d.sfamiliasVentas, "unidadesAnt")} ≠ cliente ${objetivo}`);
  for (const fa of d.sfamiliasVentas) { const hijas = [...new Set(d.skusMargen.filter((x) => x.sfamilia === fa.nombre).map((x) => x.marca))]; const es = sum(hijas.map((m) => porMarca[m]), "unidadesAnt"); if (fa.unidadesAnt !== es) mal.push(`familia ${fa.nombre}.unidadesAnt: ${fa.unidadesAnt} ≠ Σ de sus marcas ${es}`); }
  return { mal, f };
}
{
  const dm = derivadas(T);
  ok(dm.length === 0, "★ marca y familia son la SUMA de sus SKU en toda métrica aditiva (venta · costo · acciones · contribución · unidades) y sus razones salen de las sumas (margen = contribución ÷ venta · carga = acciones ÷ venta · costo medio · precio), en las dos tablas de cada eje", dm.join("\n      "));
  const lit = sinLiteral(fs.readFileSync("./src/data/tenants/demo.js", "utf8"));
  ok(lit.length === 0, "★ ninguna tabla de marca ni de familia se ESCRIBE a mano en el tenant demo: marcasVentas · marcasMargen · sfamiliasVentas · sfamiliasMargen se derivan de skusMargen", lit.join(", "));
  const { mal: mf, factores } = factorUniforme(T);
  ok(mf.length === 0, `★ el SKU se calibró con UN factor por métrica, idéntico para los 13 SKU (contribución × ${factores.contribucion.toFixed(4)} · acciones × ${factores.rebates.toFixed(4)} · unidades × ${factores.unidades.toFixed(2)}) y redondeo de mayor resto: ningún SKU ni marca se eligió a mano`, mf.join("\n      "));
  ok(Math.abs(factores.contribucion - 1.0556) < 5e-5 && Math.abs(factores.rebates - 0.9867) < 5e-5 && Math.abs(factores.unidades - 8.19) < 5e-3, "…los factores son los declarados en la nota del tenant (≈ × 1,0556 · × 0,9867 · × 8,19)");
  ok(sum(T.marcasVentas, "anterior") === 92900 && sum(T.sfamiliasVentas, "anterior") === 92900 && sum(T.marcasVentas, "unidadesAnt") === sum(T.clientesVentas, "unidadesAnt"), "lo único que NO sale de un SKU —la venta y las unidades del año anterior— sigue DECLARADO por marca y suma lo del universo cliente (Σ $92.900K · Σ 5.222 unidades)");
  const fam = Object.fromEntries(T.sfamiliasVentas.map((f) => [f.nombre, f]));
  ok(fam["Materiales de Construcción"].anterior === T.marcasVentas.find((m) => m.nombre === "Bosch").anterior + T.marcasVentas.find((m) => m.nombre === "Makita").anterior, "la familia suma el año anterior de sus marcas (Materiales de Construcción = Bosch + Makita)");
  {
    const { mal: mu, f: fu } = unidadesAnteriores(T);
    ok(mu.length === 0, `★ las unidades del año anterior por marca respetan el CRECIMIENTO DECLARADO a la escala nueva: unidades(Σ SKU) × (unidadesAnt vieja ÷ unidades vieja) × UN factor uniforme (× ${fu.toFixed(4)}), mayor resto; la familia suma sus marcas`, mu.join("\n      "));
    ok(Math.abs(fu - 0.9986) < 5e-5, "…el factor uniforme es el declarado en la nota del tenant (≈ × 0,9986)");
    const mv = Object.fromEntries(ENG.applyScenarioToMarcasVentas(S).map((m) => [m.nombre, m])), fv = ENG.applyScenarioToSfamiliasVentas(S);
    ok(sum(Object.values(mv), "unidadesAnt") === 5222 && sum(fv, "unidadesAnt") === 5222 && sum(T.clientesVentas, "unidadesAnt") === 5222, "★ Σ unidades del año anterior = 5.222 en marca = familia = cliente, leídas por el motor (applyScenarioTo…Ventas)");
    const lee = (r) => ({ vol: (r.unidades / r.unidadesAnt - 1) * 100, pre: ((r.actual / r.unidades) / (r.anterior / r.unidadesAnt) - 1) * 100 });
    const filas = [...Object.values(mv), ...fv].map((r) => ({ n: r.nombre, ...lee(r) }));
    ok(filas.every((x) => Math.abs(x.vol) <= 15 && Math.abs(x.pre) <= 5), "★ la lectura volumen/precio por marca y por familia, como la sirve el motor, es creíble (volumen entre −15 % y +15 %, precio realizado entre −5 % y +5 %): ya no hay precios de +68 % ni volúmenes de +73 %", filas.map((x) => `${x.n}: vol ${r1(x.vol)} % precio ${r1(x.pre)} %`).join(" · "));
    ok(r1(lee(mv.Samsung).vol) === 2.7 && r1(lee(mv.Philips).vol) === 6 && r1(lee(mv.LG).vol) === 11.9 && r1(lee(mv.Bosch).vol) === 0.6 && r1(lee(mv.Samsung).pre) === 1.4 && r1(lee(mv.Philips).pre) === 1.1 && r1(lee(mv.LG).pre) === 3.3 && r1(lee(mv.Bosch).pre) === 1.5, "lo medido, sellado: volumen Samsung +2,7 · Philips +6,0 · LG +11,9 · Bosch +0,6 %; precio realizado +1,4 · +1,1 · +3,3 · +1,5 % (antes: precio Samsung +67,9 %, LG +74,0 %; volumen Philips +72,7 %)");
  }
  /* EL IMPACTO MEDIDO, sellado: los SKU conservan su orden por contribución y por margen; cruza el benchmark el que tenía que cruzarlo; las marcas cambian como cambian */
  const orden = (xs, k) => xs.map((x, i) => [x, i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]).map(([, i]) => i);
  const contribAntes = BASE_SKU.contribucion, contribAhora = T.skusMargen.map((s) => s.contribucion);
  ok(orden(contribAntes).join() === orden(contribAhora).join(), "el ranking de SKU por CONTRIBUCIÓN no cambia con la calibración (mismo orden de los 13)");
  const ventaSku = T.skusMargen.map((s) => s.venta), margenAntes = contribAntes.map((c, i) => r1(c / ventaSku[i] * 100)), margenAhora = T.skusMargen.map((s) => s.margen);
  let monotono = true; for (let i = 0; i < 13; i++) for (let j = 0; j < 13; j++) if (margenAntes[i] > margenAntes[j] && !(margenAhora[i] >= margenAhora[j])) monotono = false;
  ok(monotono, "el ranking de SKU por MARGEN no cambia (ningún SKU pasa a otro: los empates de un decimal pueden aparecer, nunca invertirse)");
  const sku = Object.fromEntries(T.skusMargen.map((s) => [s.nombre, s]));
  ok(sku["PHI-HAIR-PRO"].margen === 31.7 && margenAntes[7] === 30 && sku["PHI-HAIR-PRO"].margen > 30.1 && T.skusMargen.filter((s) => s.margen > 30.1).map((s) => s.nombre).join() === "PHI-HAIR-PRO,MAK-SAW18V", "PHI-HAIR-PRO pasa de 30,0 % a 31,7 % y cruza el benchmark (30,1 %): son 2 los SKU sobre él (MAK-SAW18V y PHI-HAIR-PRO), antes 1");
  const mm = Object.fromEntries(T.marcasMargen.map((m) => [m.nombre, m.margen])), ff = Object.fromEntries(T.sfamiliasMargen.map((m) => [m.nombre, m.margen]));
  ok(mm.Samsung === 23.4 && mm.LG === 22.8 && mm.Philips === 28.8 && mm.Bosch === 24.9 && mm.Makita === 26.1 && ff["Materiales de Construcción"] === 25.3 && ff["Cuidado Personal"] === 28.8, "los márgenes medidos: Samsung 23,4 · LG 22,8 · Philips 28,8 (el mejor) · Bosch 24,9 · Makita 26,1 (ya no es el mejor: antes 34,8) · familia Materiales de Construcción 25,3 (antes 28,3)");
  /* ADI y Sentrix leen la MISMA tabla: la boleta de «margen por marca» y el Cuadro por marca dicen lo mismo */
  const cm = buildCuadroMando("marca", S), filasCm = cm.rows || cm.filas;
  ok(filasCm.length === 5 && filasCm.every((r) => { const m = T.marcasMargen.find((x) => x.nombre === (r.nombre || r.name)); return m && r.contribucion === m.contribucion; }), "el Cuadro por marca pinta la contribución de la tabla derivada (la suma de sus SKU), para las 5 marcas");
}
H("§8 · carnadas (en memoria): marca escrita a mano, un SKU fuera del factor, una unidad de más, un literal de vuelta");
{
  /* EL ESTADO ABSURDO DE ANTES: las unidades del año anterior declaradas contra la tabla VIEJA de marca (otra escala) */
  const viejas = { Samsung: 1703, Philips: 1788, LG: 1135, Bosch: 434, Makita: 162 };
  const Tv = { ...T, marcasVentas: T.marcasVentas.map((m) => ({ ...m, unidadesAnt: viejas[m.nombre] })), sfamiliasVentas: T.sfamiliasVentas.map((f) => ({ ...f, unidadesAnt: [...new Set(T.skusMargen.filter((x) => x.sfamilia === f.nombre).map((x) => x.marca))].reduce((a, m) => a + viejas[m], 0) })) };
  ok(sum(Tv.marcasVentas, "unidadesAnt") === 5222 && unidadesAnteriores(Tv).mal.some((x) => /Samsung\.unidadesAnt: 1703 ≠ 1028/.test(x)) && unidadesAnteriores(Tv).mal.some((x) => /Philips: crecimiento en unidades 72\.7 %/.test(x)), "CARNADA «las unidades del año anterior vuelven a la tabla vieja (Σ 5.222 pero otra escala: Samsung 1.703, Philips 1.788…)» → la suma sigue cuadrando y aun así el crecimiento declarado se pone ROJO (Philips +72,7 %)");
  const Tw = { ...T, marcasVentas: T.marcasVentas.map((m) => (m.nombre === "Bosch" ? { ...m, unidadesAnt: m.unidadesAnt + 5 } : m)) };
  ok(unidadesAnteriores(Tw).mal.some((x) => /Bosch\.unidadesAnt/.test(x)) && unidadesAnteriores(Tw).mal.some((x) => /Σ unidadesAnt marca/.test(x)), "CARNADA «+5 unidades del año anterior elegidas a mano en una marca» → deja de ser la regla única y deja de cuadrar con el cliente, ROJO");
  const Tx = { ...T, sfamiliasVentas: T.sfamiliasVentas.map((f) => (f.nombre === "Línea Blanca" ? { ...f, unidadesAnt: f.unidadesAnt + 40 } : f)) };
  ok(unidadesAnteriores(Tx).mal.some((x) => /familia Línea Blanca\.unidadesAnt/.test(x)), "CARNADA «una familia que no suma las unidades del año anterior de sus marcas» → ROJO");
  ok(unidadesAnteriores(T).mal.length === 0, "…y la tabla vigente pasa los tres candados (el control)");
  const Tm = { ...T, marcasMargen: T.marcasMargen.map((m) => (m.nombre === "Makita" ? { ...m, contribucion: 1671, margen: 34.8 } : m)) };
  ok(derivadas(Tm).some((x) => /Makita\.contribucion: 1671 ≠ Σ SKU 1255/.test(x)), "CARNADA «Makita vuelve a 1.671 de contribución (la marca escrita a mano)» → marca ≠ Σ SKU, ROJO");
  const Tf = { ...T, sfamiliasMargen: T.sfamiliasMargen.map((m) => (m.nombre === "Materiales de Construcción" ? { ...m, margen: 28.3 } : m)) };
  ok(derivadas(Tf).some((x) => /Materiales de Construcción\.margen/.test(x)), "CARNADA «Materiales de Construcción vuelve a 28,3 % de margen (el escalado a mano)» → familia ≠ contribución ÷ venta, ROJO");
  const Tu = { ...T, skusMargen: T.skusMargen.map((s, i) => (i === 0 ? { ...s, unidades: s.unidades + 1 } : s)) };
  ok(cuadre(Tu).some((x) => /^unidades/.test(x)) && factorUniforme(Tu).mal.some((x) => /SAM-REF500L\.unidades/.test(x)), "CARNADA «una unidad de más en un SKU» → el cuadre de unidades Y el factor único se ponen ROJO");
  const Tc = { ...T, skusMargen: T.skusMargen.map((s, i) => (i === 3 ? { ...s, contribucion: s.contribucion + 3, costo: s.costo - 3 } : s)) };
  ok(factorUniforme(Tc).mal.some((x) => /LG-WASH11KG\.contribucion/.test(x)) && cuadre(Tc).some((x) => /^contribución/.test(x)), "CARNADA «+3 de contribución elegidos a mano en un SKU» → deja de ser el factor único y deja de cuadrar con el cliente, ROJO");
  ok(sinLiteral("export const marcasMargen = [ { nombre:\"Samsung\" } ];").length === 1 && sinLiteral("export const sfamiliasVentas = [\n  { nombre:\"X\" } ];").length === 1, "CARNADA «una tabla de marca o de familia escrita como literal» → ROJO");
  ok(sinLiteral("export const marcasMargen = _margenDe(_MARCAS, \"marca\");\n// export const marcasVentas = [ comentario ]").length === 0, "…y la derivación (y la historia en un comentario) NO se confunde con el defecto (el control)");
}

console.log(`\n── _una_sola_realidad_gate: ${PASS} PASS · ${FAIL} FAIL (de ${PASS + FAIL}) ──`);
process.exit(FAIL ? 1 : 0);
