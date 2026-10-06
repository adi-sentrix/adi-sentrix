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
 *        diseño (§4f del diseño: Makita con variación, 5 marcas y 4 familias sobre el nivel, rankings de familias, empates de carga, redondeo de simulación, un umbral cruzado por el dato).
 *   §6 · CARNADAS: cada candado se prueba con el defecto adentro (en memoria: no se toca ningún archivo).
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
  eq("unidades", [["clienteVentas", sum(d.clientesVentas, "unidades")], ["clienteMargen", sum(d.clientesMargen, "unidades")], ["marcaVentas", sum(d.marcasVentas, "unidades")], ["marcaMargen", sum(d.marcasMargen, "unidades")], ["familiaVentas", sum(d.sfamiliasVentas, "unidades")], ["familiaMargen", sum(d.sfamiliasMargen, "unidades")], ["mes", sum(d.ventasMensuales, "unidades")], ["KPI", d.ventasKPI.unidades]]);
  /* la contribución del cliente es la OFICIAL (D8): venta oficial × margen % por cliente — la misma cuenta del motor */
  const contribD8 = sum(d.clientesMargen, (c) => Math.round((ventaOf[c.nombre] ?? c.venta) * c.margen / 100));
  eq("contribución", [["cliente (D8)", contribD8], ["marca", sum(d.marcasMargen, "contribucion")], ["familia", sum(d.sfamiliasMargen, "contribucion")], ["mes (venta − costo − acciones)", sum(d.ventasMensuales, "actual") - sum(d.ventasMensuales, "costo") - sum(d.ventasMensuales, "acciones")], ["KPI", d.margenKPI.totalUSD]]);
  /* las acciones comerciales se declaran con UN decimal (4,4 %): su suma por eje puede diferir del cliente en el redondeo de ese decimal, medido = Σ venta × 0,05 % */
  const acc = sum(d.clientesMargen, (c) => Math.round((ventaOf[c.nombre] ?? c.venta) * c.pctRebate / 100));
  const tolAcc = Math.ceil(sum(d.clientesVentas, "actual") * 0.0005);
  for (const [eje, v] of [["marca", sum(d.marcasMargen, "rebates")], ["familia", sum(d.sfamiliasMargen, "rebates")], ["mes", sum(d.ventasMensuales, "acciones")]]) if (Math.abs(v - acc) > tolAcc) mal.push(`acciones comerciales: cliente ${acc} vs ${eje} ${v} (tolerancia de redondeo medida ${tolAcc})`);
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
  /* LO QUE NO SE PROPUSO CORREGIR, declarado y no escondido: la contribución del SKU ($23.738K) es el único eje aparte (la tabla de SKU es otra muestra comercial: CLAUDE.md §4) */
  ok(sum(T.skusMargen, "venta") === V, "el SKU cuadra en VENTA ($100.000K); su contribución ($23.738K) y sus unidades (674) quedan aparte, declarados (no entran al cuadre: ver CLAUDE.md §4)");
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
  "cinco-marcas-cuatro-familias": [(sale, entra) => entra.some((l) => /Bosch, Samsung, Makita, Philips, LG|Materiales de Construcción, Electrodomésticos, Cuidado Personal|Serían \d+ marcas|Sería 1 marca/.test(l)) || sale.some((l) => /Bosch, Samsung, Makita\.|Materiales de Construcción, Electrodomésticos\.|Sería 1 marca|Serían \d+ marcas/.test(l)), "las 5 marcas sobre el nivel de carga (antes 3 de 5) y las 4 familias (antes 2 de 4); el margen de marca calibrado cambia cuántas quedan sobre una referencia (§4f ②)"],
  "empate-de-carga-de-marcas": [(sale, entra) => [...sale, ...entra].some((l) => /empate del filo|Empate en el orden servido|empatado con|empate: Samsung, Makita/.test(l)), "el empate de carga por marca cambia de miembros: la carga de la tabla de ventas se alineó con la de margen (Samsung 4,2→4,4 · LG y Philips 3,5→3,6, §2 a)"],
  "ranking-de-familias": [(sale, entra) => [...sale, ...entra].some((l) => /Por familia, ordenado por (Margen|Variación)|variación vs año anterior: |margen: (Línea|Cuidado|Materiales)/.test(l)), "el ranking de familias por variación y por margen: Materiales de Construcción entra Makita (+37 %, 28,3 %) y sube (§4f ③)"],
  "redondeo-de-simulacion": [(sale, entra) => sale.some((l) => /La venta (se mantiene en|pasaría de)/.test(l)) && entra.some((l) => /La venta (se mantiene en|pasaría de)/.test(l)), "una simulación dice «se mantiene» o «pasaría de» según redondee la cifra de partida (la venta de la tabla difiere del redondeo de «bonanza» en ≤ $26K): el delta es el mismo"],
  "veredicto-de-premisa-por-el-dato": [(sale, entra) => [...sale, ...entra].some((l) => /Sobre la premisa|lo que usted da por hecho/.test(l)), "el veredicto de una premisa (correcto ↔ no es así) cambia porque cambia el dato contra el que se verifica"],
  "umbral-del-filtro-cruzado-por-el-dato": [(sale, entra, enc) => JSON.stringify(enc).includes('"filtros"') && /"valor":\d/.test(JSON.stringify(enc)), "un filtro del encargo con un umbral numérico escrito sobre el dato de entonces (saldo vencido > $1.055.700 · variación > 4 % · unidades > 140) lo cruza otra cuenta con el dato vigente"],
};
/* LOS CASOS LISTADOS POR ID (42), cada uno con la(s) causa(s) que su diff tiene que mostrar */
const LISTADOS = {"v17:W16":["redondeo-de-simulacion"],"v17:W17":["redondeo-de-simulacion"],"v17:W23":["redondeo-de-simulacion"],"v20:U04":["empate-de-carga-de-marcas"],"v20:U31":["redondeo-de-simulacion"],"v21:T03":["cinco-marcas-cuatro-familias","empate-de-carga-de-marcas"],"v21:T59":["redondeo-de-simulacion"],"v23:R04":["empate-de-carga-de-marcas"],"v23:R40":["cinco-marcas-cuatro-familias"],"v23:R78":["redondeo-de-simulacion"],"v23:R45":["cinco-marcas-cuatro-familias"],"v24:Q77":["redondeo-de-simulacion"],"v24:Q78":["redondeo-de-simulacion"],"v25:P04":["empate-de-carga-de-marcas"],"v25:P24":["cinco-marcas-cuatro-familias","ranking-de-familias"],"v25:P76":["redondeo-de-simulacion"],"v25:P23":["ranking-de-familias"],"v25:P45":["cinco-marcas-cuatro-familias"],"v26:N26":["cinco-marcas-cuatro-familias","ranking-de-familias"],"v27:M45":["cinco-marcas-cuatro-familias"],"v27:M51":["cinco-marcas-cuatro-familias"],"v27:M86":["redondeo-de-simulacion"],"v28:L100":["makita-con-variacion"],"v29:K38":["cinco-marcas-cuatro-familias"],"v29:K56":["makita-con-variacion"],"v30:J38":["cinco-marcas-cuatro-familias"],"v30:J56":["makita-con-variacion"],"v31:H09":["ranking-de-familias"],"v31:H42":["cinco-marcas-cuatro-familias"],"v31:H23":["ranking-de-familias"],"v32:G07":["empate-de-carga-de-marcas"],"v32:G41":["cinco-marcas-cuatro-familias"],"v32:G23":["ranking-de-familias"],"v32:G78":["makita-con-variacion","ranking-de-familias"],"v34:E56":["cinco-marcas-cuatro-familias","veredicto-de-premisa-por-el-dato"],"v35:D03":["makita-con-variacion"],"v35:D52":["cinco-marcas-cuatro-familias"],"v35:D67":["makita-con-variacion"],"v37:B78":["makita-con-variacion"],"v18:X78":["umbral-del-filtro-cruzado-por-el-dato"],"v36:C78":["umbral-del-filtro-cruzado-por-el-dato"],"v39:Z09":["umbral-del-filtro-cruzado-por-el-dato"]};
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
  ok(cuenta.igual === 310 && cuenta.cifras === 175 && cuenta.premisas === 5 && cuenta.listado === 42, "las cuentas están selladas: 310 idénticos · 175 solo cifras · 5 solo premisas · 42 listados = 532 (si el producto mueve un texto más, este candado lo nombra)");
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
  ok(cuadre(carga).some((x) => /carga 4\.2 ≠ 4\.4/.test(x)), "CARNADA «Samsung 4,2 % en una tabla y 4,4 % en la otra» → el cuadre por entidad se pone ROJO");
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

console.log(`\n── _una_sola_realidad_gate: ${PASS} PASS · ${FAIL} FAIL (de ${PASS + FAIL}) ──`);
process.exit(FAIL ? 1 : 0);
