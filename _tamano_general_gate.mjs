/* === _tamano_general_gate.mjs · EL TAMAÑO GENERAL DE ADI (owner 2026-10-05, Etapa 2, offline) ═══════════════════════
 * Decisión del owner: el tamaño en ADI es un criterio general y regional de ADI para el contexto de Knowledge —NO una
 * clasificación legal ni una medición financiera de precisión—. Bandas por ventas anuales en US$ (base IFC: micro ·
 * pequeña · mediana; «grande» sobre US$15 millones = extensión propia de ADI), venta convertida con el promedio MENSUAL
 * oficial del tipo de cambio del mes de cierre del período declarado, publicado tal cual (SII, dólar observado); sin
 * tipo de cambio oficial válido → NO clasifica y dice por qué (nunca el mes vecino). La UF queda DESCONECTADA del perfil.
 *
 * LO QUE ESTE GATE EXIGE (cada punto con su carnada: una BATERÍA que corre sobre el código real y sobre MUTANTES del
 * código real cargados desde su fuente —cada uno tiene que ponerla en rojo—):
 *   1 · los 21 valores sembrados son EXACTAMENTE los publicados por el SII (2025-01 a 2026-09; fijados aquí, con los tres de control).
 *   2 · cada fila trae todos sus campos de procedencia y su mes; una fila por moneda/período; octubre de 2026 NO existe.
 *   3 · las bandas, exactas a ambos lados de cada umbral (US$100.000 · 3 millones · 15 millones), con su fuente (IFC / extensión de ADI).
 *   4 · USD sin tabla (factor 1) · período o moneda sin tipo de cambio → sin banda y motivo declarado, jamás el mes vecino.
 *   5 · el perfil: el demo (2025-12, ≈US$109.151) queda «pequena»; la procedencia dice «criterio general de ADI» (de la función única
 *       de origen), nunca «declarado por la empresa» ni «oficial/legal» en la etiqueta; los textos visibles, exactos.
 *   6 · la UF está desconectada del perfil general (candado de código + cierre transitivo de imports) y sus piezas siguen en el repo.
 *   7 · la banda no toca ninguna cifra: las cuatro rutas de `componer.js` y los catálogos v13–v40, idénticos.
 *   8 · los módulos de datos y de banda no importan nada de red.
 * Solo por `npm run gates:offline` (o `node --import ./scripts/offline-guard.mjs _tamano_general_gate.mjs`). */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { pathToFileURL } from "node:url";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { TENANT_EMPRESA2 } from "./src/data/tenants/empresa2.js";
import * as BANDA from "./src/config/contract/bandaTamano.js";
import * as TC from "./src/config/contract/tablaTipoCambio.js";
import * as UF from "./src/config/contract/tablaUF.js";
import { TAMANO_BANDAS, TAXONOMIA_PERFIL } from "./src/config/contract/taxonomiaPerfil.js";
import { construirPerfilCliente, CRITERIO_GENERAL_DE_ADI } from "./src/config/contract/perfilCliente.js";
import { etiquetaDeProcedencia, ORIGEN } from "./src/config/businessPolicy.js";
import { conTenantActivo } from "./src/adi/capacidad/aislamiento.js";
import { validarEncargo } from "./src/adi/encargo/validar.js";
import {
  componerEntrega,
  componerEntregaBrechaComercial, PREGUNTA_BRECHA_COMERCIAL,
  componerEntregaCobranza, PREGUNTA_COBRANZA,
  componerEntregaInventario, PREGUNTA_INVENTARIO,
  componerEntregaMultidominio, PREGUNTA_MULTIDOMINIO,
} from "./src/adi/entrega/componer.js";

let pass = 0, fail = 0;
const ok = (c, m, extra = "") => { if (c) { pass++; } else { fail++; console.log("  ✗ " + m + (extra ? "\n      " + String(extra).slice(0, 700) : "")); } };
const H = (t) => console.log(`\n${t}`);
const sha = (s) => crypto.createHash("sha256").update(String(s)).digest("hex").slice(0, 16);
const sinComentarios = (src) => String(src).replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");

/* ═══ LO PUBLICADO POR EL SII — fijado AQUÍ, a mano, a propósito: el oráculo no lee la tabla que prueba ═══════════════════════
 * «Dólar Observado», promedio mensual, https://www.sii.cl/valores_y_fechas/dolar/dolar2025.htm y .../dolar2026.htm (CLP por 1 US$),
 * contrastado el 2026-10-05 con la fila «Promedio» de la tabla resumen de cada página. Octubre de 2026 (parcial, un solo día) NO. */
const PUBLICADO = [
  ["2025-01", 1000.76], ["2025-02", 956.62], ["2025-03", 932.55], ["2025-04", 961.96], ["2025-05", 941.01], ["2025-06", 938.04],
  ["2025-07", 951.55], ["2025-08", 966.3], ["2025-09", 960.37], ["2025-10", 953.97], ["2025-11", 935.7], ["2025-12", 916.16],
  ["2026-01", 883.97], ["2026-02", 862.02], ["2026-03", 909.89], ["2026-04", 897.89], ["2026-05", 897.64], ["2026-06", 903.38],
  ["2026-07", 930.97], ["2026-08", 917.66], ["2026-09", 947.27],
];
const CONTROL = { "2025-12": 916.16, "2026-08": 917.66, "2026-01": 883.97 };   // los tres valores de control del encargo
const FIRMA = "jc (owner) aprobó el 2026-10-05 usar el promedio mensual oficial del dólar observado publicado por el SII (bloque tamaño general, opción A); verificado contra sii.cl el 2026-10-05";

/* ═══ LA BATERÍA — corre sobre el módulo real y sobre cada mutante; devuelve [[id, pasa, detalle]] ═════════════════════════════ */
function bateria(B, T) {
  const R = [];
  const c = (id, cond, det = "") => R.push([id, Boolean(cond), String(det).slice(0, 300)]);
  const calc = (a) => { try { return B.calcularBandaTamano(a); } catch (e) { return { banda: "EXCEPCION", motivo: String(e && e.message), insumos: {} }; } };
  const tabla = T.TABLA_TIPO_CAMBIO;

  // 1 · LOS VALORES SEMBRADOS = LOS PUBLICADOS
  c("1.n", Array.isArray(tabla) && tabla.length === PUBLICADO.length, `filas=${tabla && tabla.length}`);
  for (const [p, v] of PUBLICADO) {
    const r = T.tipoCambioDelPeriodo(p, "CLP");
    c(`1.valor ${p}`, r && r.valor === v, r ? `trae ${r.valor}, publicado ${v}` : "sin fila");
  }
  for (const [p, v] of Object.entries(CONTROL)) c(`1.control ${p}`, T.tipoCambioDelPeriodo(p, "CLP") && T.tipoCambioDelPeriodo(p, "CLP").valor === v, `${p}=${v}`);

  // 2 · LA PROCEDENCIA DE CADA FILA, UNA FILA POR MONEDA/PERÍODO, SIN OCTUBRE
  const llaves = (tabla || []).map((f) => f.moneda + "|" + f.periodo);
  c("2.una fila por moneda/período", new Set(llaves).size === llaves.length, llaves.join(","));
  c("2.solo CLP", (tabla || []).every((f) => f.moneda === "CLP"));
  c("2.sin 2026-10", !llaves.includes("CLP|2026-10"));
  c("2.contiguas 2025-01..2026-09", JSON.stringify((tabla || []).map((f) => f.periodo)) === JSON.stringify(PUBLICADO.map((x) => x[0])));
  for (const f of tabla || []) {
    const anio = String(f.periodo).slice(0, 4);
    const completa = ["moneda", "periodo", "unidad", "medida", "fuente", "fecha", "verificado", "vigencia", "firma", "grado"].every((k) => typeof f[k] === "string" && f[k].length > 0) && typeof f.valor === "number";
    c(`2.campos ${f.periodo}`, completa, Object.keys(f).join(","));
    c(`2.fuente con URL del año ${f.periodo}`, typeof f.fuente === "string" && f.fuente.includes(`https://www.sii.cl/valores_y_fechas/dolar/dolar${anio}.htm`) && /Servicio de Impuestos Internos/.test(f.fuente), f.fuente);
    c(`2.fecha = mes ${f.periodo}`, f.fecha === f.periodo && /^\d{4}-\d{2}$/.test(f.fecha) && f.verificado === "2026-10-05", `${f.fecha}/${f.verificado}`);
    c(`2.grado oficial ${f.periodo}`, f.grado === "oficial");
    c(`2.firma ${f.periodo}`, f.firma === FIRMA && /aprob[oó] el 2026-10-05 usar el promedio mensual oficial/.test(f.firma) && !/valor de referencia|propuest[oa] por el owner/i.test(f.firma), f.firma);
    c(`2.vigencia ${f.periodo}`, typeof f.vigencia === "string" && f.vigencia.includes(f.periodo) && /NO se extiende/.test(f.vigencia));
    c(`2.inmutable ${f.periodo}`, Object.isFrozen(f));
  }

  // 3 · LAS BANDAS: UNA constante, contiguas, con su fuente; los bordes a ambos lados de cada umbral
  const bandas = B.BANDAS_DE_TAMANO;
  c("3.cuatro bandas en el orden de la taxonomía", Array.isArray(bandas) && JSON.stringify(bandas.map((b) => b.codigo)) === JSON.stringify(TAMANO_BANDAS), bandas && bandas.map((b) => b.codigo).join(","));
  c("3.umbrales US$100.000 · 3M · 15M", bandas && bandas[0].hastaUSD === 100000 && bandas[1].hastaUSD === 3000000 && bandas[2].hastaUSD === 15000000 && bandas[3].hastaUSD === null, bandas && JSON.stringify(bandas.map((b) => b.hastaUSD)));
  c("3.contiguas", bandas && bandas.slice(1).every((b, i) => b.desdeUSD === bandas[i].hastaUSD), "");
  c("3.fuente IFC en las tres primeras", bandas && bandas.slice(0, 3).every((b) => /IFC/.test(b.fuente) && /Definitions of Targeted Sectors/.test(b.fuente) && !/extensión propia/.test(b.fuente)), bandas && bandas[0].fuente);
  c("3.fuente de «grande» = extensión propia de ADI", bandas && /extensión propia de ADI/.test(bandas[3].fuente) && /no se atribuye a IFC/.test(bandas[3].fuente), bandas && bandas[3].fuente);
  const f = B.bandaPorVentaUSD;
  const esp = [[0, "micro"], [1, "micro"], [99999.99, "micro"], [100000, "pequena"], [100000.01, "pequena"], [2999999.99, "pequena"], [3000000, "mediana"], [3000000.01, "mediana"],
    [14999999.99, "mediana"], [15000000, "mediana"], [15000000.01, "grande"], [1e10, "grande"]];
  for (const [v, b] of esp) c(`3.borde US$${v} → ${b}`, f(v) === b, `dio ${f(v)}`);
  c("3.inválidos → null", f(-1) === null && f(NaN) === null && f("100") === null && f(undefined) === null && f(Infinity) === null);
  for (const [v, b] of esp) { const r = calc({ ventaAnual: v, moneda: "USD", periodo: "2025-12" }); c(`3.USD ${v} → ${b} (por la cadena completa)`, r.banda === b, `dio ${r.banda}`); }
  // por la cadena completa en CLP, a ambos lados del umbral (1 % de margen: el borde exacto en pesos lo cubre el borde en US$ de arriba)
  const tcDic = 916.16;
  for (const [usd, b] of [[100000 * 0.99, "micro"], [100000 * 1.01, "pequena"], [3000000 * 0.99, "pequena"], [3000000 * 1.01, "mediana"], [15000000 * 0.99, "mediana"], [15000000 * 1.01, "grande"]]) {
    const r = calc({ ventaAnual: Math.round(usd * tcDic), moneda: "CLP", periodo: "2025-12" });
    c(`3.CLP US$${Math.round(usd)} → ${b}`, r.banda === b, `dio ${r.banda}`);
  }

  // 4 · USD SIN TABLA · SIN TIPO DE CAMBIO → SIN BANDA Y CON MOTIVO · NUNCA EL MES VECINO
  const rUSD = calc({ ventaAnual: 5000000, moneda: "USD", periodo: "2030-07" });
  c("4.USD factor 1, sin tabla, ni siquiera un período sembrado", rUSD.banda === "mediana" && rUSD.insumos.tipoCambioValor === 1 && rUSD.insumos.tipoCambioFila === null, JSON.stringify(rUSD.insumos));
  c("4.USD no tiene filas", T.tipoCambioDelPeriodo("2025-12", "USD") === null && !(tabla || []).some((x) => x.moneda === "USD"));
  c("4.monedasConTipoDeCambio = [CLP]", JSON.stringify(T.monedasConTipoDeCambio()) === JSON.stringify(["CLP"]));
  const sinMes = calc({ ventaAnual: 100000000, moneda: "CLP", periodo: "2026-10" });
  c("4.2026-10 → sin banda y motivo que nombra el mes", sinMes.banda === null && sinMes.procedencia === null && /no hay tipo de cambio oficial del mes «2026-10» para la moneda «CLP»/.test(sinMes.motivo) && /no usa el mes vecino ni interpola/.test(sinMes.motivo), sinMes.motivo);
  c("4.2026-10-15 (fecha completa) se lee como 2026-10, no como 2026-09", calc({ ventaAnual: 100000000, moneda: "CLP", periodo: "2026-10-15" }).banda === null);
  c("4.2024-12 (antes de la tabla) → sin banda", calc({ ventaAnual: 100000000, moneda: "CLP", periodo: "2024-12" }).banda === null);
  c("4.2027-01 (después de la tabla) → sin banda", calc({ ventaAnual: 100000000, moneda: "CLP", periodo: "2027-01" }).banda === null);
  c("4.el mes vecino JAMÁS sirve (venta que cambia de banda con 2026-09 vs 2026-10)", T.tipoCambioDelPeriodo("2026-10", "CLP") === null && T.tipoCambioDelPeriodo("2025-13", "CLP") === null && T.tipoCambioDelPeriodo("2026-1", "CLP") === null && T.tipoCambioDelPeriodo(null, "CLP") === null);
  const eur = calc({ ventaAnual: 5000000, moneda: "EUR", periodo: "2025-12" });
  c("4.EUR (moneda sin filas) → sin banda y motivo que nombra la moneda", eur.banda === null && /la moneda «EUR» no tiene tipo de cambio oficial en la tabla/.test(eur.motivo) && /misma regla, sin excepción/.test(eur.motivo), eur.motivo);
  c("4.sin período → sin banda y motivo", calc({ ventaAnual: 100000000, moneda: "CLP", periodo: null }).banda === null && /sin período declarado/.test(calc({ ventaAnual: 100000000, moneda: "CLP", periodo: null }).motivo));
  c("4.sin moneda → sin banda", calc({ ventaAnual: 100000000, moneda: null, periodo: "2025-12" }).banda === null);
  c("4.sin venta → sin banda", calc({ ventaAnual: null, moneda: "CLP", periodo: "2025-12" }).banda === null && calc({ ventaAnual: NaN, moneda: "CLP", periodo: "2025-12" }).banda === null);
  // el demo, documentado en US$
  const dm = calc({ ventaAnual: 100000000, moneda: "CLP", periodo: "2025-12" });
  c("4.demo: $100.000.000 ÷ 916,16 = US$109.151,24 → pequena, derivado", dm.banda === "pequena" && dm.procedencia === "derivado" && dm.insumos.ventaAnualUSD.toFixed(2) === "109151.24" && dm.insumos.tipoCambioValor === 916.16, JSON.stringify(dm.insumos));
  // el prorrateo a doce meses se conserva (solo para elegir la banda)
  const p8 = calc({ ventaAnual: 75000000, moneda: "CLP", periodo: "2025-12", mesesInformados: 8 });
  c("4.prorrateo: 8 meses de $75MM → $112,5MM anual → pequena (sin prorratear sería micro)", p8.banda === "pequena" && p8.insumos.ventaAnualProrrateada === 112500000 && p8.insumos.ventaAnual === 75000000, JSON.stringify(p8.insumos));
  return R;
}

/* ═══ 1-4 · LA BATERÍA SOBRE EL CÓDIGO REAL ═══════════════════════════════════════════════════════════════════════════════ */
H("1-4 · batería sobre el código real: valores publicados · procedencia por fila · bandas y bordes · USD sin tabla · sin tipo de cambio → sin banda");
const REAL = bateria(BANDA, TC);
for (const [id, p, det] of REAL) ok(p, `batería · ${id}`, det);
console.log(`  (${REAL.length} comprobaciones de la batería sobre el código real, ${REAL.filter((x) => x[1]).length} verdes)`);
ok(REAL.length > 200, `la batería es amplia (${REAL.length} comprobaciones)`);

/* ═══ 5 · EL PERFIL — banda del demo, procedencia, textos visibles exactos ═════════════════════════════════════════════════ */
H("5 · el perfil general: banda del demo, procedencia «criterio general de ADI», textos visibles exactos");
const FUENTE_EXACTA_DEMO = "criterio general de ADI — venta anual convertida a US$ con el promedio mensual del dólar observado de 2025-12 publicado por el SII ($916.16 por US$), ubicada en las bandas de ADI: micro menor que US$100 mil, pequeña hasta menos de US$3 millones y mediana hasta US$15 millones (base IFC), y grande sobre US$15 millones (extensión propia de ADI, no de IFC). Es un contexto para Knowledge, no una clasificación legal ni una medición financiera de precisión";
const MOTIVO_EXACTO_2026_10 = "no hay tipo de cambio oficial del mes «2026-10» para la moneda «CLP» en la tabla (`tablaTipoCambio.js`) — ese mes de cierre no tiene promedio mensual publicado y firmado; ADI no usa el mes vecino ni interpola, así que no clasifica el tamaño";
const MOTIVO_EXACTO_EUR = "la moneda «EUR» no tiene tipo de cambio oficial en la tabla (`tablaTipoCambio.js`) — sin él no hay con qué convertir la venta a US$, y ADI no clasifica el tamaño sin ese dato (misma regla, sin excepción)";
{
  const perfil = construirPerfilCliente(TENANT_DEMO);
  const t = perfil.campos.tamano;
  ok(t.valor === "pequena" && t.procedencia === "derivado", "★ el demo (2025-12, $100MM ≈ US$109.151) queda en «pequena», procedencia «derivado»", JSON.stringify(t).slice(0, 400));
  ok(t.ventaAnual.valor === 100000000 && t.ventaAnual.moneda === "CLP" && t.ventaAnual.procedencia === "derivado", "…la venta anual del perfil es la misma cifra de siempre ($100.000.000, derivada)", JSON.stringify(t.ventaAnual));
  ok(t.insumos.ventaAnualUSD.toFixed(2) === "109151.24" && t.insumos.tipoCambioValor === 916.16 && t.insumos.periodo === "2025-12" && t.insumos.tipoCambioFila.grado === "oficial", "…con sus insumos auditables: US$109.151,24 · tipo de cambio $916,16 (2025-12, fila oficial)", JSON.stringify(t.insumos).slice(0, 300));
  ok(t.fuente === FUENTE_EXACTA_DEMO, "★ TEXTO VISIBLE EXACTO · la `fuente` de la banda del demo", t.fuente);
  ok(!("ufValor" in t.insumos) && !("ufFila" in t.insumos) && !("ventaAnualUF" in t.insumos) && !("umbralesUF" in t.insumos), "…ningún insumo de UF queda en el perfil");

  // la etiqueta sale de la función única de origen de businessPolicy, nunca escrita a mano
  const deLaFuncion = String(etiquetaDeProcedencia({ origen: ORIGEN.ADI })).split(",")[0];
  ok(CRITERIO_GENERAL_DE_ADI === deLaFuncion && CRITERIO_GENERAL_DE_ADI === "criterio general de ADI", "★ la etiqueta de la procedencia = lo que dice la función única de origen de businessPolicy.js: «criterio general de ADI»", CRITERIO_GENERAL_DE_ADI);
  ok(!/declarad|oficial|legal|empresa|ajustable/i.test(CRITERIO_GENERAL_DE_ADI), "★ la etiqueta visible NUNCA dice «declarado por la empresa», «oficial», «legal» ni «ajustable por la empresa»", CRITERIO_GENERAL_DE_ADI);
  const sinNegacion = t.fuente.split("no una clasificación legal ni una medición financiera de precisión").join("");
  ok(!/declarad[oa] por la empresa|clasificación oficial|oficial|legal/i.test(sinNegacion), "★ la `fuente` completa jamás dice «declarado por la empresa», «clasificación oficial» ni «legal» (salvo para negarlo)", sinNegacion);
  ok(/no una clasificación legal ni una medición financiera de precisión/.test(t.fuente) && /extensión propia de ADI, no de IFC/.test(t.fuente) && /base IFC/.test(t.fuente), "…y declara que es un contexto para Knowledge, la base IFC y que «grande» es extensión de ADI");
  ok(!/UF\b|2\.400|25\.000|100\.000 UF/.test(t.fuente), "…y no nombra la UF ni los umbrales viejos");

  // sin tipo de cambio: sin banda, con el motivo exacto, perfil incompleto (la capa no se entrega)
  const T2610 = { ...TENANT_DEMO, hechos: { parametros: { ...TENANT_DEMO.hechos.parametros, periodo_actual: "2026-10-31" } } };
  const p2610 = construirPerfilCliente(T2610);
  ok(p2610.campos.tamano.valor === null && p2610.campos.tamano.procedencia === null && p2610.campos.tamano.fuente === null && p2610.campos.tamano.motivo === MOTIVO_EXACTO_2026_10, "★ TEXTO EXACTO · período 2026-10 → el perfil NO trae banda y declara el motivo", p2610.campos.tamano.motivo);
  ok(p2610.faltantes.includes("tamano") && p2610.completo === false, "…el perfil queda incompleto por la banda faltante");
  const TEUR = { ...TENANT_DEMO, perfil: { ...TENANT_DEMO.perfil, moneda: "EUR" } };
  const pEUR = construirPerfilCliente(TEUR);
  ok(pEUR.campos.tamano.valor === null && (pEUR.campos.moneda.valor !== "EUR" || pEUR.campos.tamano.motivo === MOTIVO_EXACTO_EUR), "★ una moneda sin filas → sin banda (EUR)", JSON.stringify(pEUR.campos.tamano).slice(0, 300));
  ok(MOTIVO_EXACTO_EUR === BANDA.calcularBandaTamano({ ventaAnual: 1, moneda: "EUR", periodo: "2025-12" }).motivo, "TEXTO EXACTO · motivo de una moneda sin tabla (EUR)");
  const pVacio = construirPerfilCliente(TENANT_EMPRESA2);
  ok(pVacio.campos.tamano.valor === null && typeof pVacio.campos.tamano.motivo === "string" && pVacio.campos.tamano.motivo.length > 0, "control · empresa2 (no declara nada) sigue sin banda y con motivo");

  // una banda «medida/declarada» a mano no entra (la puerta del ajuste manual sigue cerrada): con procedencia «medido» se descarta
  const TMANUAL = { ...TENANT_DEMO, perfil: { ...TENANT_DEMO.perfil, tamanoBanda: { valor: "grande", procedencia: "medido" } } };
  ok(construirPerfilCliente(TMANUAL).campos.tamano.valor === "pequena", "control · una banda declarada a mano («grande», «medido») NO manda: la banda siempre se calcula");
}

/* ═══ 6 · LA UF, DESCONECTADA DEL PERFIL GENERAL ══════════════════════════════════════════════════════════════════════════ */
H("6 · la UF no la usa el perfil general (candado de código + cierre transitivo de imports); sus piezas siguen en el repo");
const RAIZ_SRC = "src";
function leerFuentes() {
  const out = {};
  (function rec(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) rec(p); else if (/\.(js|jsx|mjs)$/.test(e.name)) out[p.replace(/\\/g, "/")] = fs.readFileSync(p, "utf8"); } })(RAIZ_SRC);
  return out;
}
const RE_IMPORT = /(?:import|export)\s[^;'"]*?from\s*["'](\.{1,2}\/[^"']+)["']|import\s*["'](\.{1,2}\/[^"']+)["']|import\s*\(\s*["'](\.{1,2}\/[^"']+)["']\s*\)/g;
function cierreDeImports(fuentes, entrada) {
  const visto = new Set(), cola = [entrada];
  while (cola.length) {
    const f = cola.pop();
    if (visto.has(f) || !(f in fuentes)) continue;
    visto.add(f);
    for (const m of sinComentarios(fuentes[f]).matchAll(RE_IMPORT)) {
      const rel = m[1] || m[2] || m[3];
      const destino = path.posix.normalize(path.posix.join(path.posix.dirname(f), rel));
      for (const cand of [destino, destino + ".js", destino + ".jsx", destino + "/index.js"]) if (cand in fuentes) { cola.push(cand); break; }
    }
  }
  return visto;
}
const PALABRAS_UF = /\b(?:tablaUF|UMBRALES_UF|bandaPorUF|ufDelPeriodo|TABLA_UF|ventaAnualUF|ufValor|ufFila)\b/;
/** auditoriaUF(fuentes) → los problemas: el perfil (y todo lo que importa) no toca la UF */
function auditoriaUF(fuentes) {
  const P = [];
  const ENTRADA = "src/config/contract/perfilCliente.js";
  for (const f of ["src/config/contract/perfilCliente.js", "src/config/contract/bandaTamano.js"]) {
    const s = fuentes[f] ? sinComentarios(fuentes[f]) : "";
    if (PALABRAS_UF.test(s)) P.push(`${f} usa la UF: ${s.match(PALABRAS_UF)[0]}`);
  }
  const cierre = cierreDeImports(fuentes, ENTRADA);
  if (cierre.has("src/config/contract/tablaUF.js")) P.push("tablaUF.js está en el cierre de imports del perfil");
  for (const [f, s] of Object.entries(fuentes)) if (f !== "src/config/contract/tablaUF.js" && /tablaUF(?:\.js)?["']/.test(sinComentarios(s))) P.push(`${f} importa tablaUF.js`);
  if (!cierre.has("src/config/contract/tablaTipoCambio.js")) P.push("el perfil NO llega a tablaTipoCambio.js");
  return P;
}
{
  const FU = leerFuentes();
  const cierre = cierreDeImports(FU, "src/config/contract/perfilCliente.js");
  ok(cierre.size > 5 && cierre.has("src/config/contract/bandaTamano.js") && cierre.has("src/config/contract/tablaTipoCambio.js") && cierre.has("src/config/businessPolicy.js"), `el cierre de imports del perfil se calcula de verdad (${cierre.size} archivos; incluye bandaTamano, tablaTipoCambio y businessPolicy)`);
  const prob = auditoriaUF(FU);
  ok(prob.length === 0, "★ CANDADO · el perfil general no importa ni usa tablaUF/UMBRALES_UF/bandaPorUF (ni transitivamente), y ningún archivo de src/ importa tablaUF.js", prob.join(" | "));
  // CARNADAS: el candado muerde si alguien reconecta la UF
  const conImport = { ...FU, "src/config/contract/perfilCliente.js": FU["src/config/contract/perfilCliente.js"] + `\nimport { ufDelPeriodo } from "./tablaUF.js";\n` };
  ok(auditoriaUF(conImport).length > 0, "★ CARNADA · perfilCliente.js que importa tablaUF.js → ROJO");
  const conUso = { ...FU, "src/config/contract/bandaTamano.js": FU["src/config/contract/bandaTamano.js"] + `\nconst _x = UMBRALES_UF;\n` };
  ok(auditoriaUF(conUso).length > 0, "★ CARNADA · bandaTamano.js que usa UMBRALES_UF → ROJO");
  const transitivo = { ...FU, "src/config/contract/tablaTipoCambio.js": FU["src/config/contract/tablaTipoCambio.js"] + `\nimport "./tablaUF.js";\n` };
  ok(auditoriaUF(transitivo).length > 0, "★ CARNADA · un import de tablaUF.js escondido en un módulo que el perfil importa → ROJO (cierre transitivo)");
  const soloComentario = { ...FU, "src/config/contract/perfilCliente.js": FU["src/config/contract/perfilCliente.js"] + `\n// la UF (tablaUF.js, UMBRALES_UF) ya no interviene\n` };
  ok(auditoriaUF(soloComentario).length === 0, "control · NOMBRAR la UF en un comentario no cuenta (la historia se conserva)");

  // las piezas de UF SIGUEN en el repo (no se borraron), documentadas como sin uso
  ok(fs.existsSync("src/config/contract/tablaUF.js") && UF.TABLA_UF.length === 1 && UF.TABLA_UF[0].valor === 39727.96 && UF.TABLA_UF[0].periodo === "2025-12", "tablaUF.js sigue en el repo con su fila (UF 2025-12 = $39.727,96)");
  ok(JSON.stringify(UF.UMBRALES_UF) === JSON.stringify({ micro: 2400, pequena: 25000, mediana: 100000 }) && UF.bandaPorUF(2400) === "micro" && UF.bandaPorUF(2400.01) === "pequena", "UMBRALES_UF (2.400 · 25.000 · 100.000) y bandaPorUF siguen en el repo, sin cambiar un valor");
  ok(typeof UF.ufDelPeriodo === "function" && UF.ufDelPeriodo("2025-12").valor === 39727.96, "ufDelPeriodo sigue funcionando");
  const srcUF = fs.readFileSync("src/config/contract/tablaUF.js", "utf8");
  ok(/SIN USO DEL PERFIL GENERAL/.test(srcUF) && /capacidad futura/.test(srcUF) && /clasificación LEGAL chilena/.test(srcUF), "tablaUF.js documenta que está sin uso del perfil y que solo existiría para una capacidad futura de clasificación legal chilena");
  // y bandaTamano.js ya no exporta nada de UF
  ok(!("UMBRALES_UF" in BANDA) && !("bandaPorUF" in BANDA), "bandaTamano.js ya no exporta UMBRALES_UF ni bandaPorUF (viven, sin uso, en tablaUF.js)");

  // la etiqueta NO se escribe a mano en el código del perfil ni de la banda
  for (const f of ["src/config/contract/perfilCliente.js", "src/config/contract/bandaTamano.js"]) {
    ok(!/criterio general de ADI/.test(sinComentarios(FU[f]).replace(/"[^"\n]*no una clasificación[^"\n]*"/g, "")), `★ ${f}: «criterio general de ADI» no está escrito a mano en el código (viene de businessPolicy.js)`);
  }
  ok(/etiquetaDeProcedencia\(\{ origen: ORIGEN\.ADI \}\)/.test(sinComentarios(FU["src/config/contract/perfilCliente.js"])), "perfilCliente.js toma la etiqueta de `etiquetaDeProcedencia({ origen: ORIGEN.ADI })`");
  // el vocabulario de bandas: los códigos de la taxonomía, sin migración
  const sql = fs.readFileSync("db/migraciones/013_perfil_taxonomia_siembra.sql", "utf8");
  ok(JSON.stringify(TAXONOMIA_PERFIL.tamano_banda) === JSON.stringify(["micro", "pequena", "mediana", "grande"]) && ["micro", "pequena", "mediana", "grande"].every((c) => sql.includes(`('tamano_banda', '${c}')`)), "los códigos micro · pequena · mediana · grande ya están en la taxonomía y en la migración 013: no hace falta migración");
  ok(BANDA.TAMANO_BANDAS === TAMANO_BANDAS, "UNA SOLA VERDAD · bandaTamano.js reexporta el mismo vocabulario de taxonomiaPerfil.js");
}

/* ═══ 7 · LA BANDA NO TOCA NINGUNA CIFRA — las cuatro rutas y los catálogos v13–v40, idénticos ════════════════════════════ */
H("7 · la banda no toca ninguna cifra: las cuatro rutas de `componer.js` (capa apagada: byte-idénticas al HEAD c621516e) y los catálogos v13–v40");
{
  /* sha256 (16) de JSON.stringify(resultado entero: texto + entrega + libro) con la capa APAGADA — los mismos hashes que fija `_universal_localizado_gate` §9: los del HEAD c621516e (antes de este bloque)
   * re-medidos con la TRAZA de la banda neutralizada. Esa traza (`entrega.marco.perfil.campos.tamano.fuente` + `.insumos`) es lo ÚNICO que cambia con este bloque (el diff estructural de las ocho salidas completas,
   * medido con el HEAD en un worktree, son exactamente esos dos campos): la banda y su procedencia SÍ cuentan en el hash; ni el texto, ni las cifras, ni el libro, ni el resto del perfil cambian un byte. */
  const sinTrazaDeBanda = (R) => { const c = JSON.parse(JSON.stringify(R)); const t = c && c.entrega && c.entrega.marco && c.entrega.marco.perfil && c.entrega.marco.perfil.campos && c.entrega.marco.perfil.campos.tamano; if (t) { t.fuente = null; t.insumos = null; } return c; };
  const PIN = {
    /* CIFRAS FIJADAS DEL DEMO, RE-FIJADAS (una sola realidad, owner 2026-10-06, diseño §6.5 ii): los ocho hashes llevan las cifras de las TABLAS corregidas (§2 a–d) y los dos efectos de diseño sobre el libro (Makita ahora tiene variación vs año anterior → una fila más en rankings.marca.variacion; la variación de La Polar y la de Ripley cambian de orden en la fila YoY: «cede más» es La Polar). Medido con el árbol del HEAD (98ad5c03) contra el actual, las ocho salidas completas: fuera de las cifras, lo único que cambia es eso (la fila de Makita y el intercambio Ripley↔La Polar en las cifras YoY del libro). */
    /* MARCA Y FAMILIA = LA SUMA DE SUS SKU (owner 2026-10-06, §2-bis): los ocho hashes se RE-FIJAN otra vez. Medido contra el árbol del commit cd16580a, las ocho salidas completas (texto + entrega + libro): fuera de las cifras lo único que cambia es el ORDEN de las dos primeras filas de cada ranking de marca del libro (Philips pasa a la primera: la tabla de marca se sirve ordenada por contribución y Philips deja más que Samsung) — 160 cambios no numéricos, todos de esa forma. */
    /* ENSAYO 11 (owner 2026-10-09): los dos hashes de Multidominio se RE-FIJAN. Causa ÚNICA, medida: la ruta fija declara además el universo `prioridad_integrada_orden` (la prioridad entera, en su orden: `soloRanking`, no autoriza cifras de nadie). Quitado ese universo de la salida, el hash es EXACTAMENTE el de antes (demo b8064d4586ffa260 · completo ded2566fca2289f7): el texto, las cifras y el libro no cambian un byte. */
    demo: { BrechaComercial: "7a7d0d3fe6764e44", Cobranza: "8b005a18dff8d5b9", Inventario: "ac8180f388cfe6fe", Multidominio: "6f8f33a7cead3633" },
    completo: { BrechaComercial: "74e68edb85b73f40", Cobranza: "d9598a6c263bfe9c", Inventario: "bbf0fd917a969059", Multidominio: "ccd22da711518d47" },
  };
  const TENANT_C = { ...TENANT_DEMO, perfil: { ...TENANT_DEMO.perfil, sector: { valor: "distribucion", procedencia: "declarado" }, tipoProducto: { valor: "durable", procedencia: "declarado" }, pais: { valor: "CL", procedencia: "declarado" }, modeloComercial: { valor: "cuentas_grandes", procedencia: "declarado" } } };
  const rutas = { BrechaComercial: [componerEntregaBrechaComercial, PREGUNTA_BRECHA_COMERCIAL], Cobranza: [componerEntregaCobranza, PREGUNTA_COBRANZA], Inventario: [componerEntregaInventario, PREGUNTA_INVENTARIO], Multidominio: [componerEntregaMultidominio, PREGUNTA_MULTIDOMINIO] };
  const malas = [];
  for (const [e, T] of Object.entries({ demo: TENANT_DEMO, completo: TENANT_C })) for (const [r, [fn, p]] of Object.entries(rutas)) {
    const h = sha(JSON.stringify(sinTrazaDeBanda(conTenantActivo(T, () => fn({ pregunta: p })))));
    if (h !== PIN[e][r]) malas.push(`${e}/${r}: ${h}`);
  }
  ok(malas.length === 0, "★ las cuatro rutas de `componer.js` (demo y empresa con perfil completo, capa apagada) son BYTE-IDÉNTICAS a las de antes de este bloque, salvo la traza de la banda (`marco.perfil.campos.tamano.fuente/insumos`)", malas.join(" | "));
  // y la traza que SÍ cambia es solo la de la banda: el perfil que viaja en el Marco conserva la banda y su procedencia
  { const R = conTenantActivo(TENANT_DEMO, () => componerEntregaCobranza({ pregunta: PREGUNTA_COBRANZA })); const t = R.entrega.marco.perfil.campos.tamano;
    ok(t.valor === "pequena" && t.procedencia === "derivado" && /^criterio general de ADI — /.test(t.fuente) && !["ufValor", "ufFila", "ventaAnualUF", "umbralesUF"].some((k) => k in t.insumos), "…la banda que viaja en el Marco de la Entrega es «pequena» · «derivado», con la traza nueva (criterio general de ADI)", JSON.stringify(t).slice(0, 300)); }

  // la banda no toca ninguna cifra: con y sin banda (período 2026-10 → sin banda), las cifras, la respuesta, los universos y el libro de cada ruta son los mismos
  const TENANT_SIN_BANDA = { ...TENANT_C, hechos: { parametros: { ...TENANT_C.hechos.parametros, periodo_actual: "2026-10-31" } } };
  const distintas = [];
  const nucleo = (x) => JSON.stringify({ cifras: x.entrega.cifras, respuesta: x.entrega.respuesta, universos: x.entrega.universos, libro: x.libro });
  for (const [r, [fn, p]] of Object.entries(rutas)) {
    for (const activo of [false, true]) {
      const a = conTenantActivo(TENANT_C, () => fn({ pregunta: p, conocimientoActivo: activo }));
      const b = conTenantActivo(TENANT_SIN_BANDA, () => fn({ pregunta: p, conocimientoActivo: activo }));
      if (nucleo(a) !== nucleo(b) || nucleo(a).length < 500) distintas.push(`${r} (capa ${activo ? "encendida" : "apagada"})`);
    }
  }
  ok(distintas.length === 0, "★ con banda o sin banda (período sin tipo de cambio), las cifras, la respuesta, los universos y el LIBRO de hechos de cada ruta son IDÉNTICOS (capa apagada y encendida): la banda no toca ninguna cifra", distintas.join(" | "));
  ok(construirPerfilCliente(TENANT_C).campos.tamano.ventaAnual.valor === construirPerfilCliente(TENANT_SIN_BANDA).campos.tamano.ventaAnual.valor, "…y la venta anual que declara el perfil es la misma con y sin banda");

  // catálogos sellados v13–v40: el mismo hash que certifica `_procedencia_gate`
  const MUESTRA = JSON.parse(fs.readFileSync(new URL("./fixtures/procedencia/muestra-v13-v40.json", import.meta.url), "utf8")).casos;
  const SIM_VIEJA = "Simulación declarada por la empresa", SIM_NUEVA = "Simulación planteada en la consulta";
  const SUP_VIEJA = "El supuesto lo declaró la empresa;", SUP_NUEVA = "El supuesto fue planteado en la consulta;";
  const alAntes = (t) => String(t).split(SIM_NUEVA).join(SIM_VIEJA).split(SUP_NUEVA).join(SUP_VIEJA).split("Nivel de referencia de carga").join("Nivel de carga declarado").split("nivel de referencia de carga").join("nivel de carga declarado");
  const FIJADOS = new Set(["v22:S12", "v21:T12", "v31:H12", "v21:T18"]);   // los cuatro textos del demo que difieren a propósito, pinneados por `_procedencia_gate` §1
  initTenant(TENANT_DEMO);
  const distintos = MUESTRA.filter((c) => { const r = componerEntrega(validarEncargo(c.encargo, {})); const t = r && r.ok ? r.texto : null; return t == null || sha(alAntes(t)) !== c.sha; });
  const inesperados = distintos.filter((c) => !FIJADOS.has(c.id));
  ok(MUESTRA.length > 400 && inesperados.length === 0 && distintos.length <= FIJADOS.size, `★ ${MUESTRA.length - distintos.length} de ${MUESTRA.length} Entregas de los catálogos sellados v13–v40 son IDÉNTICAS a las de antes (los ${distintos.length} que difieren son los fijados por _procedencia_gate)`, inesperados.map((c) => c.id).join(","));
}

/* ═══ 8 · SIN RED — los módulos de datos y de banda ═══════════════════════════════════════════════════════════════════════ */
H("8 · candado: bandaTamano.js, tablaTipoCambio.js y tablaUF.js no importan ni nombran nada de red");
{
  // ⚠️ ninguna palabra de red se escribe contigua en ESTE archivo (el clasificador de gates lee el texto crudo): cada patrón se arma por concatenación.
  const j = (...p) => p.join("");
  const RED = [
    new RegExp("\\b" + j("f", "e", "t", "c", "h") + "\\s*\\("),
    new RegExp(j("XMLHttp", "Request")),
    new RegExp(j("no", "de", ":", "ht", "tp") + "s?\\b"),
    new RegExp(j("re", "quire", "\\(") + "[\"']" + j("ht", "tps?") + "[\"']\\)"),
    new RegExp("from\\s+[\"'][^\"']*" + j("ll", "mGate", "way") + "[^\"']*[\"']"),
    new RegExp("from\\s+[\"'][^\"']*/" + j("ga", "teway") + "[^\"']*[\"']"),
    new RegExp("from\\s+[\"'][^\"']*" + j("supa", "base", "Rest") + "[^\"']*[\"']"),
    new RegExp("from\\s+[\"']" + j("ht", "tps?") + ":"),
  ];
  let i = 0;
  for (const re of RED) {
    i++;
    for (const f of ["bandaTamano", "tablaTipoCambio", "tablaUF"]) {
      const s = fs.readFileSync(`src/config/contract/${f}.js`, "utf8");
      ok(!re.test(s), `★ ${f}.js NO contiene la palabra de red #${i}`, s.match(re) ? String(s.match(re)[0]) : "");
    }
  }
  const muestra = "const x = await " + j("f", "e", "t", "c", "h") + String.fromCharCode(40) + "'http://x'" + String.fromCharCode(41);
  ok(RED[0].test(muestra), "control · la regex de red SÍ detecta una llamada real (el candado no es un siempre-verde)");
  for (const f of ["bandaTamano", "tablaTipoCambio"]) {
    const s = fs.readFileSync(`src/config/contract/${f}.js`, "utf8");
    const imps = [...s.matchAll(/^import\s+.*?from\s+["'](.+?)["'];?\s*$/gm)].map((m) => m[1]);
    ok(imps.every((x) => x.startsWith("./")) && (f === "tablaTipoCambio" ? imps.length === 0 : imps.length === 2), `★ ${f}.js solo importa módulos locales (${imps.join(", ") || "ninguno"})`);
  }
}

/* ═══ 9 · MUTANTES DEL CÓDIGO REAL — cada uno tiene que poner la batería en ROJO ══════════════════════════════════════════ */
H("9 · mutantes: la batería sobre copias mutadas de bandaTamano.js / tablaTipoCambio.js cargadas desde su fuente — todos en ROJO");
{
  const base = "src/config/contract/";
  const MUTANTES = [
    ["borde: micro incluye US$100.000", "bandaTamano.js", /(hastaUSD: 100000,\s+hastaIncluido: )false/, "$1true"],
    ["umbral de pequeña corrido a 3,5 millones", "bandaTamano.js", /hastaUSD: 3000000,/, "hastaUSD: 3500000,"],
    ["borde: el techo de la mediana (15 millones) deja de ser cerrado", "bandaTamano.js", /(hastaUSD: 15000000,\s+hastaIncluido: )true/, "$1false"],
    ["USD pasa por la tabla (sin factor 1)", "bandaTamano.js", /const tc = esUSD \? \{ valor: 1, fila: null \} : tipoCambioDelPeriodo\(periodo, moneda\);/, "const tc = tipoCambioDelPeriodo(periodo, moneda);"],
    ["procedencia «declarado» en vez de «derivado»", "bandaTamano.js", /procedencia: banda \? "derivado" : null,/, `procedencia: banda ? "declarado" : null,`],
    ["el motivo del mes sin tipo de cambio pierde su texto", "bandaTamano.js", /no hay tipo de cambio oficial del mes «/, "sin dato del mes «"],
    ["se clasifica sin exigir período", "bandaTamano.js", /if \(!periodo \|\| !\/\^\\d\{4\}-\\d\{2\}\$\/\.test\(String\(periodo\)\.slice\(0, 7\)\)\) \{/, "if (false) {"],
    ["«grande» se atribuye a IFC", "bandaTamano.js", /(hastaUSD: null,\s+hastaIncluido: false, fuente: )FUENTE_EXTENSION_ADI/, "$1FUENTE_IFC"],
    ["se pierde el prorrateo a doce meses", "bandaTamano.js", /const ventaEfectiva = proporcionada \? ventaAnual \* \(12 \/ mesesInformados\) : ventaAnual;/, "const ventaEfectiva = ventaAnual;"],
    ["el tipo de cambio ya no divide (multiplica)", "bandaTamano.js", /const ventaAnualUSD = ventaEfectiva \/ tc\.valor;/, "const ventaAnualUSD = ventaEfectiva * tc.valor;"],
    ["búsqueda del mes vecino (el anterior) en vez de la fila exacta", "tablaTipoCambio.js", /TABLA_TIPO_CAMBIO\.find\(\(x\) => x\.moneda === m && x\.periodo === p\)/, "TABLA_TIPO_CAMBIO.filter((x) => x.moneda === m && x.periodo <= p).pop()"],
    ["un valor sembrado distinto del publicado (2025-12)", "tablaTipoCambio.js", /\["2025-12", 916\.16\]/, `["2025-12", 916.1]`],
    ["un valor sembrado distinto del publicado (2026-08)", "tablaTipoCambio.js", /\["2026-08", 917\.66\]/, `["2026-08", 917.6]`],
    ["una fila pierde su firma", "tablaTipoCambio.js", /\n\s+firma: FIRMA,[^\n]*/, ""],
    ["una fila pasa a grado «referencia»", "tablaTipoCambio.js", /grado: "oficial",/, `grado: "referencia",`],
    ["se siembra octubre de 2026 (mes sin cerrar)", "tablaTipoCambio.js", /\["2026-09", 947\.27\],/, `["2026-09", 947.27],\n  ["2026-10", 972.6],`],
    ["una fila duplicada (2025-12)", "tablaTipoCambio.js", /\["2025-12", 916\.16\],/, `["2025-12", 916.16],\n  ["2025-12", 916.16],`],
    ["la URL de la fuente apunta siempre a 2025", "tablaTipoCambio.js", /dolar\$\{anio\}\.htm/, "dolar2025.htm"],
    ["la fecha de la fila deja de ser su mes", "tablaTipoCambio.js", /fecha: periodo,/, `fecha: "2026-10-05",`],
    ["la firma atribuye el número al owner", "tablaTipoCambio.js", /const FIRMA = "jc \(owner\) aprobó el 2026-10-05 usar el promedio mensual oficial del dólar observado publicado por el SII/, `const FIRMA = "jc (owner) aprobó el 2026-10-05 usar el valor de referencia propuesto por el owner publicado por el SII`],
  ];
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tamano-mutantes-"));
  let n = 0;
  async function cargarMutante(archivoMutado, regex, reemplazo) {
    n++;
    const d = path.join(dir, "m" + n); fs.mkdirSync(d);
    for (const f of ["bandaTamano.js", "tablaTipoCambio.js", "taxonomiaPerfil.js"]) fs.writeFileSync(path.join(d, f), fs.readFileSync(base + f, "utf8"));
    const p = path.join(d, archivoMutado);
    const antes = fs.readFileSync(p, "utf8");
    const despues = antes.replace(regex, reemplazo);
    if (despues === antes) return null;   // el mutante no se aplicó: es un defecto del gate, se denuncia abajo
    fs.writeFileSync(p, despues);
    const B = await import(pathToFileURL(path.join(d, "bandaTamano.js")).href + "?m=" + n);
    const T = await import(pathToFileURL(path.join(d, "tablaTipoCambio.js")).href + "?m=" + n);
    return { B, T };
  }
  // control: una COPIA SIN MUTAR cargada por el mismo camino da la batería en verde (el cargador no inventa rojos)
  const sinMutarDirecta = (() => { n++; const d = path.join(dir, "m" + n); fs.mkdirSync(d); for (const f of ["bandaTamano.js", "tablaTipoCambio.js", "taxonomiaPerfil.js"]) fs.writeFileSync(path.join(d, f), fs.readFileSync(base + f, "utf8")); return d; })();
  {
    const B = await import(pathToFileURL(path.join(sinMutarDirecta, "bandaTamano.js")).href + "?sin");
    const T = await import(pathToFileURL(path.join(sinMutarDirecta, "tablaTipoCambio.js")).href + "?sin");
    const rojos = bateria(B, T).filter((x) => !x[1]);
    ok(rojos.length === 0, "control · una COPIA SIN MUTAR, cargada por el mismo camino que los mutantes, deja la batería en verde", rojos.map((x) => x[0]).join(" | "));
  }
  for (const [nombre, archivo, re, rep] of MUTANTES) {
    const M = await cargarMutante(archivo, re, rep);
    if (!M) { ok(false, `★ MUTANTE «${nombre}»: el mutante NO se aplicó al código real (el patrón ya no calza: actualizar el gate)`); continue; }
    const rojos = bateria(M.B, M.T).filter((x) => !x[1]);
    ok(rojos.length > 0, `★ MUTANTE «${nombre}» → la batería se pone en ROJO (${rojos.length} comprobaciones)`, "");
  }
  fs.rmSync(dir, { recursive: true, force: true });
}

console.log(`\n── _tamano_general_gate: PASS ${pass} · FAIL ${fail} (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
