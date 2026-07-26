/* === data/tenants/empresa2.js · FIXTURE EMPRESA-2 · "Distribuidora Andina" (F1 multiempresa · 2026-07-26) ===
 * LA PRUEBA DE FUEGO del rumbo multiempresa (mandato del owner: "las pruebas con un segundo dataset las hagas
 * tú mismo, corrobores… valida todas estas cosas"). Dataset sintético PERMANENTE con OTRO shape a propósito:
 *
 *   · Otro rubro (distribución de alimentos/bebidas) · 8 clientes con otros nombres · otras familias/marcas/SKUs.
 *   · SIN canal en las ventas → el eje canal debe DESAPARECER solo (disponibilidad data-driven).
 *   · CON venta por bodega en la base de clientes (campo `bodega` en clientesVentas/clientesMargen) → el eje
 *     bodega del P&L debe APARECER solo (la promesa data-driven al revés).
 *   · Otro benchmark declarado por fila (26.0 ≠ 30.1 del demo) — el perfil viaja EN el dato.
 *   · Números que CIERRAN por construcción: venta×margen == contribución EXACTO en primarios; los agregados
 *     suman de sus miembros; venta == costo + rebates + contribución en cada fila; KPIs/escenarios/series se
 *     DERIVAN programáticamente de las mismas filas (una verdad, sin segunda fuente que pueda driftear).
 *   · NevadaFoods: marca del contrato SIN clientes en la base (como Makita en el demo) — ejercita el canon
 *     covered:false y el drift declarado clientes-vs-familias del universo agregado.
 *
 * REGLA DE ORO: si algo falla con este fixture, el fix va SIEMPRE en el producto (des-hardcodear), jamás acá. */

// ── CLIENTES · la base primaria (venta×margen==contribución exacto · venta==costo+rebates+contribución) ──────
// [nombre, familia, marca, bodega, venta(K), margen(%), pctRebate(%), unidades, anterior(K), unidadesAnt, presupuesto(K), precioLista]
const _CLIENTES = [
  ["Supermercados del Valle", "Bebidas",    "AndesCola",   "Bodega Norte",  14000, 24.0, 4.0, 700, 12800, 640, 13500, 23.50],
  ["Comercial Aconcagua",     "Abarrotes",  "Cordillera",  "Bodega Norte",  11500, 22.0, 5.0, 575, 11900, 595, 11800, 22.80],
  ["Distribuidora Los Ríos",  "Lácteos",    "LactoSur",    "Bodega Centro",  9800, 27.0, 3.5, 490,  8700, 435,  9200, 24.10],
  ["Mayorista El Puerto",     "Bebidas",    "AndesCola",   "Bodega Centro",  7200, 24.0, 4.5, 360,  7000, 350,  7500, 23.20],
  ["Minimarket Red Sur",      "Congelados", "FrostAl",     "Bodega Centro",  5400, 30.0, 2.5, 270,  4700, 235,  5100, 24.60],
  ["Almacenes Cumbre",        "Abarrotes",  "Cordillera",  "Bodega Norte",   4100, 22.0, 3.0, 205,  4350, 218,  4300, 22.50],
  ["Ferias del Maule",        "Lácteos",    "LactoSur",    "Bodega Sur",     3300, 27.0, 4.0, 165,  3050, 152,  3200, 24.00],
  ["Bazar Patagonia",         "Congelados", "FrostAl",     "Bodega Sur",     2700, 30.0, 2.0, 135,  2450, 122,  2600, 24.20],
];
const BENCHMARK = 26.0;   // la vara de ESTA empresa · por fila (≠ 30.1 del demo)
const _r1 = (n) => Math.round(n * 10) / 10;
const _r2 = (n) => Math.round(n * 100) / 100;

export const clientesVentas = _CLIENTES.map(([nombre, sfamilia, marca, bodega, venta, _m, pctRebate, unidades, anterior, unidadesAnt, presupuesto]) => ({
  nombre, sfamilia, marca, bodega, actual: venta, anterior, unidades, unidadesAnt, pctRebate, presupuesto,
}));

export const clientesMargen = _CLIENTES.map(([nombre, sfamilia, marca, bodega, venta, margen, pctRebate, unidades, _a, _ua, _p, precioLista]) => {
  const contribucion = Math.round(venta * margen / 100);   // exacto por diseño de las filas (venta×margen cierra entero)
  const rebates = Math.round(venta * pctRebate / 100);
  const costo = venta - contribucion - rebates;
  return { nombre, tipo: "cliente", marca, sfamilia, bodega, venta, costo, rebates, contribucion, pctRebate,
           margen, costoMedio: _r2(costo / unidades), precioLista, unidades, benchmark: BENCHMARK };
});

// ── MARCAS y FAMILIAS · agregados que SUMAN de sus miembros (contribución almacenada = Σ exacta) ─────────────
// NevadaFoods no tiene clientes (universo agregado > universo clientes — drift declarado, como Makita).
const _NEVADA = { nombre: "NevadaFoods", sfamilia: "Abarrotes", venta: 2600, margen: 29.0, pctRebate: 4.0,
                  unidades: 130, anterior: 2300, unidadesAnt: 115, precioLista: 24.50 };

const _aggBy = (campo) => {
  const by = new Map();
  for (const c of clientesMargen) {
    const k = c[campo];
    if (!by.has(k)) by.set(k, { venta: 0, costo: 0, rebates: 0, contribucion: 0, unidades: 0, sfamilia: c.sfamilia, marca: c.marca });
    const g = by.get(k);
    g.venta += c.venta; g.costo += c.costo; g.rebates += c.rebates; g.contribucion += c.contribucion; g.unidades += c.unidades;
  }
  return by;
};
const _aggVentasBy = (campo) => {
  const by = new Map();
  for (const c of clientesVentas) {
    const k = c[campo];
    if (!by.has(k)) by.set(k, { actual: 0, anterior: 0, unidades: 0, unidadesAnt: 0, rebK: 0, sfamilia: c.sfamilia, marca: c.marca });
    const g = by.get(k);
    g.actual += c.actual; g.anterior += c.anterior; g.unidades += c.unidades; g.unidadesAnt += c.unidadesAnt;
    g.rebK += c.actual * c.pctRebate / 100;
  }
  return by;
};
const _nevadaRebates = Math.round(_NEVADA.venta * _NEVADA.pctRebate / 100);                 // 104
const _nevadaContrib = _NEVADA.venta * _NEVADA.margen / 100;                                 // 754 exacto
const _nevadaCosto = _NEVADA.venta - _nevadaContrib - _nevadaRebates;                        // 1742

const _mkMargenRow = (nombre, tipo, g, extra = {}) => ({
  nombre, tipo, marca: extra.marca || nombre, sfamilia: extra.sfamilia || g.sfamilia,
  venta: g.venta, costo: g.costo, rebates: g.rebates, contribucion: g.contribucion,
  pctRebate: _r1(g.rebates / g.venta * 100), margen: _r1(g.contribucion / g.venta * 100),
  costoMedio: _r2(g.costo / g.unidades), precioLista: extra.precioLista || 23.5,
  unidades: g.unidades, benchmark: BENCHMARK,
});

const _byMarca = _aggBy("marca");
_byMarca.set("NevadaFoods", { venta: _NEVADA.venta, costo: _nevadaCosto, rebates: _nevadaRebates,
  contribucion: _nevadaContrib, unidades: _NEVADA.unidades, sfamilia: _NEVADA.sfamilia, marca: "NevadaFoods" });
export const marcasMargen = [...(_byMarca.entries())]
  .map(([nombre, g]) => _mkMargenRow(nombre, "marca", g, { marca: nombre }))
  .sort((a, b) => b.venta - a.venta);

const _byFamilia = (() => {
  const by = _aggBy("sfamilia");
  const ab = by.get("Abarrotes");   // NevadaFoods suma a su familia (el agregado familia SÍ lo incluye)
  ab.venta += _NEVADA.venta; ab.costo += _nevadaCosto; ab.rebates += _nevadaRebates;
  ab.contribucion += _nevadaContrib; ab.unidades += _NEVADA.unidades;
  return by;
})();
export const sfamiliasMargen = [...(_byFamilia.entries())]
  .map(([nombre, g]) => _mkMargenRow(nombre, "sfamilia", g, { marca: g.marca, sfamilia: nombre }))
  .sort((a, b) => b.venta - a.venta);

const _mkVentasRow = (nombre, g) => ({
  nombre, sfamilia: g.sfamilia, marca: g.marca, actual: g.actual, anterior: g.anterior,
  unidades: g.unidades, unidadesAnt: g.unidadesAnt, pctRebate: _r1(g.rebK / g.actual * 100),
});
const _byMarcaV = _aggVentasBy("marca");
_byMarcaV.set("NevadaFoods", { actual: _NEVADA.venta, anterior: _NEVADA.anterior, unidades: _NEVADA.unidades,
  unidadesAnt: _NEVADA.unidadesAnt, rebK: _NEVADA.venta * _NEVADA.pctRebate / 100, sfamilia: _NEVADA.sfamilia, marca: "NevadaFoods" });
export const marcasVentas = [...(_byMarcaV.entries())]
  .map(([nombre, g]) => _mkVentasRow(nombre, { ...g, marca: nombre }))
  .sort((a, b) => b.actual - a.actual);

const _byFamiliaV = (() => {
  const by = _aggVentasBy("sfamilia");
  const ab = by.get("Abarrotes");
  ab.actual += _NEVADA.venta; ab.anterior += _NEVADA.anterior; ab.unidades += _NEVADA.unidades;
  ab.unidadesAnt += _NEVADA.unidadesAnt; ab.rebK += _NEVADA.venta * _NEVADA.pctRebate / 100;
  return by;
})();
export const sfamiliasVentas = [...(_byFamiliaV.entries())]
  .map(([nombre, g]) => _mkVentasRow(nombre, { ...g, sfamilia: nombre }))
  .sort((a, b) => b.actual - a.actual);

// ── SKUs · comercial (venta en K como el demo · venta×margen==contribución exacto) ───────────────────────────
// [nombre, marca, familia, venta(K), margen(%), pctRebate(%), unidades, precioLista]
const _SKUS = [
  ["AC-COLA-3L",   "AndesCola",   "Bebidas",    9600, 24.0, 4.0, 32, 340.00],
  ["AC-AGUA-6P",   "AndesCola",   "Bebidas",    7400, 26.0, 5.0, 37, 230.00],
  ["CO-ARROZ-25K", "Cordillera",  "Abarrotes",  8200, 21.0, 4.5, 41, 230.00],
  ["CO-ACEITE-5L", "Cordillera",  "Abarrotes",  5100, 22.0, 4.0, 30, 195.00],
  ["LS-LECHE-1L",  "LactoSur",    "Lácteos",    8800, 27.5, 3.5, 44, 225.00],
  ["LS-QUESO-GDA", "LactoSur",    "Lácteos",    6100, 28.0, 4.0, 20, 350.00],
  ["FA-HELADO-5L", "FrostAl",     "Congelados", 5200, 30.0, 2.5, 26, 230.00],
  ["FA-PIZZA-FAM", "FrostAl",     "Congelados", 3900, 31.0, 3.0, 15, 300.00],
  ["NV-SNACK-MIX", "NevadaFoods", "Abarrotes",  2600, 29.0, 5.0, 13, 230.00],
  ["NV-BARRA-CER", "NevadaFoods", "Abarrotes",  1900, 30.0, 4.0, 10, 220.00],
];
export const skusMargen = _SKUS.map(([nombre, marca, sfamilia, venta, margen, pctRebate, unidades, precioLista]) => {
  const contribucion = venta * margen / 100;                   // exacto por diseño de las filas
  const rebates = Math.round(venta * pctRebate / 100);
  const costo = venta - contribucion - rebates;
  return { nombre, tipo: "sku", marca, sfamilia, venta, costo, rebates, contribucion, pctRebate, margen,
           costoMedio: _r2(costo / unidades), precioLista, unidades, benchmark: BENCHMARK };
});

// ── INVENTARIO · 3 bodegas propias · estados contra POLICY (dormido: rot<2 ó doh>120 · quiebre: rot≥6 y doh≤20) ──
export const skuInventario = [
  { sku:"AC-COLA-3L",   bodega:"Bodega Norte",  marca:"AndesCola",   sfamilia:"Bebidas",    stockUSD:9800, stockUnd:35, ventaDiaria:5.2, vendidoMes:156, rotacion:10.4, doh:14,  cobertura:16,  margenPct:24, diasSinVenta:0,  estado:"Activo", alerta:"ok",   pctInv:16.3 },
  { sku:"AC-AGUA-6P",   bodega:"Bodega Centro", marca:"AndesCola",   sfamilia:"Bebidas",    stockUSD:7200, stockUnd:40, ventaDiaria:3.0, vendidoMes:90,  rotacion:8.2,  doh:18,  cobertura:20,  margenPct:26, diasSinVenta:0,  estado:"Activo", alerta:"ok",   pctInv:12.0 },
  { sku:"CO-ARROZ-25K", bodega:"Bodega Norte",  marca:"Cordillera",  sfamilia:"Abarrotes",  stockUSD:8600, stockUnd:48, ventaDiaria:1.4, vendidoMes:42,  rotacion:3.4,  doh:45,  cobertura:45,  margenPct:21, diasSinVenta:4,  estado:"Activo", alerta:"ok",   pctInv:14.3 },
  { sku:"CO-ACEITE-5L", bodega:"Bodega Norte",  marca:"Cordillera",  sfamilia:"Abarrotes",  stockUSD:6400, stockUnd:42, ventaDiaria:0.5, vendidoMes:15,  rotacion:1.7,  doh:96,  cobertura:96,  margenPct:22, diasSinVenta:31, estado:"60d",    alerta:"warn", pctInv:10.7 },
  { sku:"LS-LECHE-1L",  bodega:"Bodega Centro", marca:"LactoSur",    sfamilia:"Lácteos",    stockUSD:7900, stockUnd:52, ventaDiaria:6.0, vendidoMes:180, rotacion:11.8, doh:12,  cobertura:14,  margenPct:27, diasSinVenta:0,  estado:"Activo", alerta:"ok",   pctInv:13.2 },
  { sku:"LS-QUESO-GDA", bodega:"Bodega Centro", marca:"LactoSur",    sfamilia:"Lácteos",    stockUSD:5600, stockUnd:24, ventaDiaria:0.9, vendidoMes:27,  rotacion:2.6,  doh:62,  cobertura:62,  margenPct:28, diasSinVenta:12, estado:"Lento",  alerta:"warn", pctInv:9.3  },
  { sku:"FA-HELADO-5L", bodega:"Bodega Sur",    marca:"FrostAl",     sfamilia:"Congelados", stockUSD:4800, stockUnd:30, ventaDiaria:2.2, vendidoMes:66,  rotacion:6.8,  doh:21,  cobertura:22,  margenPct:30, diasSinVenta:0,  estado:"Activo", alerta:"ok",   pctInv:8.0  },
  { sku:"FA-PIZZA-FAM", bodega:"Bodega Sur",    marca:"FrostAl",     sfamilia:"Congelados", stockUSD:4100, stockUnd:18, ventaDiaria:0.3, vendidoMes:9,   rotacion:1.2,  doh:132, cobertura:132, margenPct:31, diasSinVenta:58, estado:"120d",   alerta:"crit", pctInv:6.8  },
  { sku:"NV-SNACK-MIX", bodega:"Bodega Norte",  marca:"NevadaFoods", sfamilia:"Abarrotes",  stockUSD:3400, stockUnd:16, ventaDiaria:0.2, vendidoMes:6,   rotacion:0.9,  doh:148, cobertura:148, margenPct:29, diasSinVenta:84, estado:"120d",   alerta:"crit", pctInv:5.7  },
  { sku:"NV-BARRA-CER", bodega:"Bodega Sur",    marca:"NevadaFoods", sfamilia:"Abarrotes",  stockUSD:2200, stockUnd:12, ventaDiaria:1.0, vendidoMes:30,  rotacion:4.6,  doh:28,  cobertura:26,  margenPct:30, diasSinVenta:2,  estado:"Activo", alerta:"ok",   pctInv:3.7  },
];

// ── KPIs y SERIE MENSUAL · DERIVADOS de las filas (una verdad · misma técnica `distribuir` del demo) ─────────
const _sum = (a, f) => a.reduce((s, x) => s + f(x), 0);
const _totalActual = _sum(clientesVentas, (c) => c.actual);          // 58000
const _totalAnterior = _sum(clientesVentas, (c) => c.anterior);      // 54950
const _totalPresupuesto = _sum(clientesVentas, (c) => c.presupuesto);// 57200
const _totalContrib = _sum(clientesMargen, (c) => c.contribucion);   // 14487
const _totalUnidades = _sum(clientesVentas, (c) => c.unidades);      // 2900

export const ventasKPI = {
  totalActual: _totalActual, totalAnterior: _totalAnterior, totalPresupuesto: _totalPresupuesto,
  vsAnterior: _r1((_totalActual / _totalAnterior - 1) * 100),        // 5.6
  vsPresupuesto: _r1((_totalActual / _totalPresupuesto - 1) * 100),  // 1.4
  unidades: _totalUnidades, ticketProm: _r1(_totalActual / _totalUnidades),   // 20.0
};
export const margenKPI = {
  pct: _r1(_totalContrib / _totalActual * 100),                      // 25.0
  pctAnt: 23.6, totalUSD: _totalContrib,
  gapPuntos: _r1(_totalContrib / _totalActual * 100 - 23.6),         // 1.4
};
const _totalStock = _sum(skuInventario, (s) => s.stockUSD);          // 60000
const _dormidos = skuInventario.filter((s) => s.rotacion < 2 || s.doh > 120);
const _dormidoUSD = _sum(_dormidos, (s) => s.stockUSD);              // 13900 (aceite + pizza + snack)
export const invKPI = {
  totalUSD: _totalStock,
  doh: Math.round(_sum(skuInventario, (s) => s.doh) / skuInventario.length),   // 58
  inmovilizadoPct: _r1(_dormidoUSD / _totalStock * 100), inmovilizadoUSD: _dormidoUSD,
  sobrestockPct: 20.0, riesgoPct: 41.5,
};

// serie mensual: curva estacional propia, distribuida EXACTA a los totales (cuadre en el último mes — la
// misma técnica del demo). Los tres totales cierran con ventasKPI por construcción.
const _CURVA = [68, 65, 78, 74, 82, 87, 81, 91, 86, 94, 98, 96];
const _curvaTot = _CURVA.reduce((s, v) => s + v, 0);
const _distribuir = (total) => {
  const m = _CURVA.map((w) => Math.round((w / _curvaTot) * total));
  m[11] += total - m.reduce((s, v) => s + v, 0);
  return m;
};
const _MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const _mAct = _distribuir(_totalActual), _mAnt = _distribuir(_totalAnterior), _mPpto = _distribuir(_totalPresupuesto);
export const ventasMensuales = _MESES.map((mes, i) => ({ mes, actual: _mAct[i], anterior: _mAnt[i], presupuesto: _mPpto[i] }));

// ── HISTORIAL POR ENTIDAD · generado con la técnica del demo (curva + contribución anual EXACTA de las filas) ──
export const historialMargen = (() => {
  const lerp = (a, b, t) => +(a + (b - a) * t).toFixed(2);
  const fracs = _CURVA.map((w) => w / _curvaTot);
  const dist = (total) => { const m = fracs.map((f) => Math.round(f * total)); m[11] += total - m.reduce((s, v) => s + v, 0); return m; };
  const result = {};
  const entidades = [
    ...clientesMargen.map((c) => ({ nombre: c.nombre, venta: c.venta, contribucion: c.contribucion, margen: c.margen, rebates: c.rebates, cm: c.costoMedio, pl: c.precioLista })),
    ...marcasMargen.map((m) => ({ nombre: m.nombre, venta: m.venta, contribucion: m.contribucion, margen: m.margen, rebates: m.rebates, cm: m.costoMedio, pl: m.precioLista })),
    ...sfamiliasMargen.map((f) => ({ nombre: f.nombre, venta: f.venta, contribucion: f.contribucion, margen: f.margen, rebates: f.rebates, cm: f.costoMedio, pl: f.precioLista })),
    ...skusMargen.map((s) => ({ nombre: s.nombre, venta: s.venta, contribucion: s.contribucion, margen: s.margen, rebates: s.rebates, cm: s.costoMedio, pl: s.precioLista })),
  ];
  for (const e of entidades) {
    const vBase = Math.round(e.venta * 0.85 / 12), vDic = Math.round(e.venta * 1.18 / 12);
    const rBase = Math.round(e.rebates * 0.85 / 12), rDic = Math.round(e.rebates * 1.18 / 12);
    const margenAnt = _r1(e.margen - 1.4);
    const contribM = dist(e.contribucion);
    const contribAntM = dist(Math.round(e.contribucion / 1.056 * (margenAnt / e.margen)));
    result[e.nombre] = _MESES.map((mes, i) => {
      const t = i / 11;
      const venta = Math.round(lerp(vBase, vDic, t));
      return {
        mes, venta, ventaAnt: Math.round(venta / 1.056),
        contribucion: contribM[i], contribucionAnt: contribAntM[i],
        margen: e.margen, margenAnt,
        rebates: Math.round(lerp(rBase, rDic, t)),
        costoMedio: lerp(e.cm, _r2(e.cm * 0.98), t),
        ticket: lerp(_r2(e.pl * 0.82), _r2(e.pl * 0.86), t),
        precioLista: lerp(e.pl, _r2(e.pl * 0.985), t),
      };
    });
  }
  return result;
})();

// ── PERFIL ESTRATÉGICO · el conocimiento de negocio de ESTA empresa ──────────────────────────────────────────
export const CLIENTES_STRATEGIC_PROFILE = {
  "Supermercados del Valle": { tier: 1, cargaComercial: "Alta",  poderNegociacion: "Alto",
    categoriaDominante: "AndesCola en Bebidas, alta rotación con margen presionado",
    rolEstrategico: "Volumen con carga alta y margen presionado",
    sustitutosNaturales: ["Mayorista El Puerto parcial"] },
  "Comercial Aconcagua": { tier: 1, cargaComercial: "Alta",  poderNegociacion: "Alto",
    categoriaDominante: "Cordillera en Abarrotes, volumen grande con margen bajo la vara",
    rolEstrategico: "Volumen con carga alta y margen presionado",
    sustitutosNaturales: ["Almacenes Cumbre limitado"] },
  "Distribuidora Los Ríos": { tier: 1, cargaComercial: "Media", poderNegociacion: "Alto",
    categoriaDominante: "LactoSur en Lácteos, alta rotación",
    rolEstrategico: "Volumen sano con contribución estructural",
    sustitutosNaturales: ["Ferias del Maule parcial"] },
  "Mayorista El Puerto": { tier: 2, cargaComercial: "Alta",  poderNegociacion: "Medio",
    categoriaDominante: "AndesCola en Bebidas",
    rolEstrategico: "Volumen sano con contribución estructural",
    sustitutosNaturales: ["Supermercados del Valle parcial"] },
  "Minimarket Red Sur": { tier: 2, cargaComercial: "Baja",  poderNegociacion: "Medio",
    categoriaDominante: "FrostAl en Congelados con margen sano",
    rolEstrategico: "Margen alto con baja carga comercial",
    sustitutosNaturales: ["Bazar Patagonia limitado"] },
  "Almacenes Cumbre": { tier: 3, cargaComercial: "Media", poderNegociacion: "Bajo",
    categoriaDominante: "Cordillera en Abarrotes",
    rolEstrategico: "Cuenta de baja escala con margen presionado",
    sustitutosNaturales: ["Comercial Aconcagua limitado"] },
  "Ferias del Maule": { tier: 3, cargaComercial: "Media", poderNegociacion: "Bajo",
    categoriaDominante: "LactoSur en Lácteos con margen sano",
    rolEstrategico: "Cuenta de baja escala con margen sano",
    sustitutosNaturales: ["Distribuidora Los Ríos limitado"] },
  "Bazar Patagonia": { tier: 3, cargaComercial: "Baja",  poderNegociacion: "Bajo",
    categoriaDominante: "FrostAl en Congelados con margen sano",
    rolEstrategico: "Cuenta de baja escala con margen sano",
    sustitutosNaturales: ["Minimarket Red Sur parcial"] },
};

// ── CATÁLOGOS ────────────────────────────────────────────────────────────────────────────────────────────────
export const SUPERFAMILIAS = ["Todas", "Bebidas", "Abarrotes", "Lácteos", "Congelados"];
export const MARCAS_ALL = ["AndesCola", "Cordillera", "LactoSur", "FrostAl", "NevadaFoods"];
export const SUCURSALES = ["Bodega Norte", "Bodega Centro", "Bodega Sur"];

// ── ESCENARIOS · los que ESTA empresa declara (ids compartidos con la UI hoy) ────────────────────────────────
// bonanza = identidad EXACTA por construcción (growth derivado de actual/anterior con precisión completa →
// round(anterior·(1+g/100)) == actual). tension/crisis = transforms propios; sus kpis se DERIVAN acá mismo
// replicando la aritmética del motor (una verdad — el fixture no declara cifras que no salgan de sus filas).
const _growthExacto = Object.fromEntries(clientesVentas.map((c) => [c.nombre, { growth: (c.actual / c.anterior - 1) * 100, rebateDelta: 0, marginErosion: 0 }]));
const _T_TENSION = {
  "Supermercados del Valle": { growth:  1.0, rebateDelta: +0.8, marginErosion: -2.0 },
  "Comercial Aconcagua":     { growth: -4.0, rebateDelta: +1.0, marginErosion: -3.0 },
  "Distribuidora Los Ríos":  { growth:  3.0, rebateDelta: +0.6, marginErosion: -1.5 },
  "Mayorista El Puerto":     { growth:  2.0, rebateDelta: +0.5, marginErosion: -2.5 },
  "Minimarket Red Sur":      { growth:  6.0, rebateDelta: +0.4, marginErosion: -1.0 },
  "Almacenes Cumbre":        { growth: -6.0, rebateDelta: +1.2, marginErosion: -3.5 },
  "Ferias del Maule":        { growth: -2.0, rebateDelta: +0.6, marginErosion: -2.0 },
  "Bazar Patagonia":         { growth: -8.0, rebateDelta: +0.8, marginErosion: -2.5 },
};
const _T_CRISIS = {
  "Supermercados del Valle": { growth: -12.0, rebateDelta: +2.0, marginErosion: -6.0 },
  "Comercial Aconcagua":     { growth: -16.0, rebateDelta: +2.5, marginErosion: -7.5 },
  "Distribuidora Los Ríos":  { growth:  -7.0, rebateDelta: +1.8, marginErosion: -4.5 },
  "Mayorista El Puerto":     { growth: -14.0, rebateDelta: +2.2, marginErosion: -6.0 },
  "Minimarket Red Sur":      { growth:  12.0, rebateDelta: +1.5, marginErosion: -3.0 },
  "Almacenes Cumbre":        { growth: -20.0, rebateDelta: +2.8, marginErosion: -8.0 },
  "Ferias del Maule":        { growth: -11.0, rebateDelta: +1.6, marginErosion: -5.0 },
  "Bazar Patagonia":         { growth: -24.0, rebateDelta: +2.4, marginErosion: -7.0 },
};
// réplica de la aritmética del motor (applyScenarioTo*) para derivar los kpis del transform — una verdad
const _kpisDe = (T) => {
  let vTot = 0, cTot = 0;
  for (const c of clientesMargen) {
    const cv = clientesVentas.find((x) => x.nombre === c.nombre);
    const t = T[c.nombre];
    const venta = t ? Math.round(cv.anterior * (1 + t.growth / 100)) : cv.actual;
    const margen = t ? Math.max(6, +(c.margen + (t.marginErosion || 0)).toFixed(1)) : c.margen;
    vTot += venta; cTot += Math.round(venta * (margen / 100));
  }
  return {
    ventas: { totalActual: vTot, totalAnterior: _totalAnterior, totalPresupuesto: _totalPresupuesto,
              vsAnterior: _r1((vTot / _totalAnterior - 1) * 100), vsPresupuesto: _r1((vTot / _totalPresupuesto - 1) * 100) },
    margen: { pct: _r1(cTot / vTot * 100), pctAnt: margenKPI.pct, totalUSD: cTot,
              gapPuntos: _r1(cTot / vTot * 100 - margenKPI.pct), benchmark: BENCHMARK },
  };
};
export const SCENARIO_TRANSFORMS = {
  bonanza: {
    clientes: _growthExacto,
    kpis: {
      ventas: { totalActual: _totalActual, totalAnterior: _totalAnterior, totalPresupuesto: _totalPresupuesto,
                vsAnterior: ventasKPI.vsAnterior, vsPresupuesto: ventasKPI.vsPresupuesto },
      margen: { pct: margenKPI.pct, pctAnt: margenKPI.pctAnt, totalUSD: margenKPI.totalUSD, gapPuntos: margenKPI.gapPuntos, benchmark: BENCHMARK },
      inventario: { totalUSD: invKPI.totalUSD, doh: invKPI.doh, inmovilizadoPct: invKPI.inmovilizadoPct, inmovilizadoUSD: invKPI.inmovilizadoUSD,
                    sobrestockPct: invKPI.sobrestockPct, riesgoPct: invKPI.riesgoPct, desalineacionPct: 28, desalineacionUSD: 16800, concentracionPct: 63, concentracionTopCat: "Bebidas" },
    },
  },
  tension: {
    clientes: _T_TENSION,
    kpis: { ..._kpisDe(_T_TENSION),
      inventario: { totalUSD: 70800, doh: 68, inmovilizadoPct: 31.4, inmovilizadoUSD: 22231, sobrestockPct: 26.0, riesgoPct: 48.0, desalineacionPct: 39, desalineacionUSD: 27612, concentracionPct: 71, concentracionTopCat: "Abarrotes" } },
  },
  crisis: {
    clientes: _T_CRISIS,
    kpis: { ..._kpisDe(_T_CRISIS),
      inventario: { totalUSD: 79200, doh: 81, inmovilizadoPct: 44.8, inmovilizadoUSD: 35482, sobrestockPct: 33.5, riesgoPct: 56.0, desalineacionPct: 52, desalineacionUSD: 41184, concentracionPct: 78, concentracionTopCat: "Abarrotes" } },
  },
};

/* ── PERFIL DE EMPRESA (F2 multiempresa · 2026-07-26) · LA VARA DE ESTA EMPRESA, distinta a propósito ────────
 * Cada llave difiere del config para que el gate PRUEBE la resolución (perfil ?? config · C.2 del usuario
 * siempre encima · "olvidá" vuelve a ESTOS valores, no a los del config). pnlLineas = la estructura de gastos
 * típica del rubro (distribución): el P&L arranca armado con estos supuestos y la declaración del usuario los
 * pisa entera. El benchmark del perfil coincide con el POR-FILA (26.0) — misma fuente, una verdad. */
export const PERFIL = {
  benchmark: BENCHMARK,     // 26.0 · la vara de cartera de esta empresa (fallback para filas sin benchmark)
  bestPracticeCarga: 3.5,   // mejor práctica de carga del rubro (%)
  targetCarga: 4.0,         // target operativo de carga (%) — ≠ 3.5 del config
  rotacionMin: 2.5,         // piso de rotación del rubro (alimentos rota más rápido que electro)
  dohMax: 90,               // techo de cobertura (días) — perecibilidad manda
  margenBrechaMaterial: 2,  // brecha material (pp) — con vara 26.0, a 2pp ya duele
  pnlLineas: [
    { nombre: "Logística", pct: 3 },        // % sobre la venta · defaults del rubro (origen perfil_empresa)
    { nombre: "Administración", pct: 1.5 },
  ],
};

// ── EL TENANT ARMADO · mismo shape que TENANT_DEMO ───────────────────────────────────────────────────────────
export const TENANT_EMPRESA2 = {
  id: "empresa2",
  nombre: "Distribuidora Andina",
  perfil: PERFIL,
  clientesVentas, clientesMargen, marcasVentas, marcasMargen, sfamiliasVentas, sfamiliasMargen,
  skuInventario, skusMargen, historialMargen, CLIENTES_STRATEGIC_PROFILE,
  ventasKPI, margenKPI, invKPI, ventasMensuales,
  SUPERFAMILIAS, MARCAS_ALL, SUCURSALES,
  SCENARIO_TRANSFORMS,
};
