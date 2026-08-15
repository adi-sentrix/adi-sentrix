/* === _carpeta_por_eje.mjs · LA CARPETA LEÍDA POR EJE, UNA SOLA VEZ (owner 2026-08-15) ========================
 * «Los verificadores no deben mezclar clientes con marcas, familias, SKU o bodegas. Cada examen debe tener claro
 * su universo.»
 *
 * POR QUÉ EXISTE: mis verificadores parseaban la carpeta cada uno por su cuenta, con un regex propio, y CUATRO
 * VECES me dieron rojos falsos — mezclaron clientes con marcas y familias («19 clientes» cuando son 13, Makita
 * apareciendo entre los clientes), cortaron decimales («8.0» + «.0%» = «8.0.0%»), y capturaron de menos (9 de 13
 * filas). Un rojo falso manda a perseguir un fantasma; un verde falso deja dormir con un defecto vivo. La
 * herramienta que verifica tiene que estar más cuidada que lo verificado, no menos.
 *
 * CÓMO: la carpeta ya viene ORGANIZADA POR BLOQUES con encabezado propio («CLIENTES (13):», «MARCAS (5):»,
 * «SKU COMERCIALES (…)», «UNIVERSO «INVENTARIO» (…)»). Se lee por bloque, nunca por regex suelto sobre el texto
 * entero: un eje es lo que su bloque contiene, ni una fila más. Si un bloque cambia de nombre, esto se rompe
 * RUIDOSAMENTE (lista vacía) en vez de devolver un conjunto contaminado en silencio.
 *
 * PURO Y OFFLINE: solo lee la proyección. Cero red, cero .env, cero costo. */
import { proyectarDatoNegocio } from "./src/adi/oracle/datoProyectado.js";
import { ESCENARIO_INICIAL } from "./src/config/scenarios.js";

const _num = (s) => (s == null ? null : +s);
// los encabezados que ABREN un bloque; cualquiera de ellos CIERRA el anterior.
const _ES_ENCABEZADO = (l) => /^(?:CLIENTES|MARCAS|FAMILIAS|SKU COMERCIALES|UNIVERSO|LOS DOS UNIVERSOS|LO QUE ESTE DATO|KPIs)/.test(l);

function _bloque(L, abre) {
  const i = L.findIndex((l) => abre.test(l));
  if (i < 0) return [];
  const j = L.findIndex((l, k) => k > i && _ES_ENCABEZADO(l));
  return L.slice(i + 1, j > 0 ? j : undefined).filter((l) => /^- /.test(l));
}

/** carpetaPorEje(scenario) → { escenario, clientes, marcas, familias, skuVenta, skuInventario, bodegas, kpis }
 *  Cada eje es un Map(nombre → campos). Los ejes NO se mezclan: cada uno sale de SU bloque. */
export function carpetaPorEje(scenario = ESCENARIO_INICIAL) {
  const texto = proyectarDatoNegocio(scenario);
  const L = texto.split("\n");
  const comercial = (linea) => {
    const m = linea.match(/^- (.+?) — Ventas \$([\d.]+)M(?: \(año anterior \$([\d.]+)M · presupuesto \$([\d.]+)M\))?.*?Margen ([\d.]+)% · Contribución \$([\d.]+)([MK])/);
    if (!m) return null;
    const carga = (linea.match(/Carga comercial ([\d.]+)%/) || [])[1];
    const acciones = (linea.match(/Acciones comerciales \$([\d.]+)([MK])/) || []);
    return [m[1].trim(), {
      venta: _num(m[2]), anterior: _num(m[3]), presupuesto: _num(m[4]), margen: _num(m[5]),
      contribucion: m[7] === "K" ? _num(m[6]) / 1000 : _num(m[6]),
      carga: _num(carga), acciones: acciones[1] ? (acciones[2] === "K" ? _num(acciones[1]) / 1000 : _num(acciones[1])) : null,
    }];
  };
  const arma = (lineas) => new Map(lineas.map(comercial).filter(Boolean));
  const inv = new Map();
  for (const l of _bloque(L, /^UNIVERSO «INVENTARIO»/)) {
    const m = l.match(/^- ([A-Z0-9-]+) \(bodega ([^)]+)\) — Capital \$([\d.]+)K · (\d+) unidades en stock · Rotación ([\d.]+)x · Días de inventario (\d+)d(?: · (\d+)d sin venta)?.*?margen de inventario ([\d.]+)% · estado ([^\s·]+)/);
    if (m) inv.set(m[1], { bodega: m[2], capital: _num(m[3]), unidades: _num(m[4]), rotacion: _num(m[5]), doh: _num(m[6]), diasSinVenta: _num(m[7]) || 0, margenInv: _num(m[8]), estado: m[9] });
  }
  const kpis = {};
  for (const l of L.slice(0, 12)) {
    const v = l.match(/Ventas totales: \$([\d.]+)M \(año anterior \$([\d.]+)M · presupuesto \$([\d.]+)M · ([\d.]+)% vs año anterior · ([\d.]+)% vs presupuesto\)/);
    if (v) Object.assign(kpis, { ventas: _num(v[1]), ventasAnterior: _num(v[2]), presupuesto: _num(v[3]), vsAnterior: _num(v[4]), vsPresupuesto: _num(v[5]) });
    const m = l.match(/Margen de la cartera: ([\d.]+)% · Contribución total \$([\d.]+)M/);
    if (m) Object.assign(kpis, { margenCartera: _num(m[1]), contribucionTotal: _num(m[2]) });
    const i = l.match(/capital total \$([\d.]+)K · (\d+)d de inventario promedio · inmovilizado ([\d.]+)% \(\$([\d.]+)K\)/);
    if (i) Object.assign(kpis, { capitalTotal: _num(i[1]), dohPromedio: _num(i[2]), inmovilizadoPct: _num(i[3]), inmovilizadoUSD: _num(i[4]) });
    const b = l.match(/benchmark de margen ([\d.]+)%.*?Meta de carga comercial ([\d.]+)%.*?Piso de rotación ([\d.]+)x · techo de días de inventario (\d+)d/);
    if (b) Object.assign(kpis, { benchmark: _num(b[1]), metaCarga: _num(b[2]), pisoRotacion: _num(b[3]), techoDias: _num(b[4]) });
  }
  return {
    escenario: scenario, texto,
    clientes: arma(_bloque(L, /^CLIENTES \(/)),
    marcas: arma(_bloque(L, /^MARCAS \(/)),
    familias: arma(_bloque(L, /^FAMILIAS \(/)),
    skuVenta: arma(_bloque(L, /^SKU COMERCIALES \(/)),
    skuInventario: inv,
    bodegas: [...new Set([...inv.values()].map((s) => s.bodega))],
    kpis,
  };
}

/* EL AUTOCONTROL: si un bloque cambia de nombre o de forma, estos números dejan de cuadrar y el verificador lo
 * dice ANTES de juzgar una respuesta. Sin esto, un parser roto se disfraza de examen reprobado. */
export function carpetaSana(C) {
  const p = [];
  if (C.clientes.size < 5) p.push(`bloque CLIENTES vacío o corto (${C.clientes.size})`);
  if (C.skuInventario.size < 5) p.push(`bloque INVENTARIO vacío o corto (${C.skuInventario.size})`);
  if (C.marcas.size && [...C.clientes.keys()].some((n) => C.marcas.has(n))) p.push("un nombre aparece como cliente Y como marca: los ejes se están mezclando");
  if (!C.kpis.ventas || !C.kpis.benchmark) p.push("KPIs del negocio no reconocidos");
  const sumaCli = [...C.clientes.values()].reduce((a, c) => a + c.venta, 0);
  if (Math.abs(sumaCli - C.kpis.ventas) > 0.15) p.push(`la suma de clientes ($${sumaCli.toFixed(1)}M) no cuadra con el total ($${C.kpis.ventas}M)`);
  return p;
}
