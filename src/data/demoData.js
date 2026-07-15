/* === DATA · datasets del demo ===
 * Extraído de 41cc33d8 · valores byte-idénticos · cero recálculo (Fase 2 del refactor).
 * La única diferencia con el monolito es DÓNDE vive el dato, nunca QUÉ vale. */

/* PRESUPUESTO UNA VERDAD (coherencia total · owner 2026-07-15): Σ presupuesto por cliente = 97,000 = el
 * totalPresupuesto global (baseKpis/ventasMensuales) — antes sumaba 92,350 y la Mesa contaba OTRO cumplimiento
 * (+8.2%) que la respuesta de ADI (+3.1%). El ajuste reparte los +4,650 SOLO entre clientes sobre plan (los que
 * quedan cortos — Ripley/La Polar/Easy — no se tocan: su brecha al plan y los $271K recuperables son los mismos). */
export const clientesVentas = [
  { nombre:"Falabella",     sfamilia:"Electrodomésticos",           marca:"Samsung", canal:"Retail",     actual:19433, anterior:17942, unidades:1040, unidadesAnt:985,  pctRebate:4.5, presupuesto:18900 },
  { nombre:"Lider",         sfamilia:"Línea Blanca",                marca:"LG",      canal:"Retail",     actual:17857, anterior:15529, unidades:900,  unidadesAnt:810,  pctRebate:4.2, presupuesto:17200 },
  { nombre:"Jumbo",         sfamilia:"Cuidado Personal",            marca:"Philips", canal:"Retail",     actual:17332, anterior:15424, unidades:1210, unidadesAnt:1100, pctRebate:3.8, presupuesto:16700 },
  { nombre:"Sodimac",       sfamilia:"Materiales de Construcción",  marca:"Bosch",   canal:"Retail",     actual:8193,  anterior:7764,  unidades:310,  unidadesAnt:298,  pctRebate:5.4, presupuesto:7850  },
  { nombre:"Tottus",        sfamilia:"Cuidado Personal",            marca:"Philips", canal:"Retail",     actual:6828,  anterior:6243,  unidades:410,  unidadesAnt:380,  pctRebate:3.2, presupuesto:6500  },
  { nombre:"Paris",         sfamilia:"Electrodomésticos",           marca:"Samsung", canal:"Retail",     actual:6303,  anterior:6138,  unidades:380,  unidadesAnt:370,  pctRebate:4.0, presupuesto:6100  },
  { nombre:"Mercado Libre", sfamilia:"Línea Blanca",                marca:"LG",      canal:"E-commerce", actual:5462,  anterior:4354,  unidades:275,  unidadesAnt:230,  pctRebate:1.8, presupuesto:5000  },
  { nombre:"Ripley",        sfamilia:"Electrodomésticos",           marca:"Samsung", canal:"Retail",     actual:4727,  anterior:5141,  unidades:245,  unidadesAnt:265,  pctRebate:4.8, presupuesto:4900  },
  { nombre:"Easy",          sfamilia:"Materiales de Construcción",  marca:"Bosch",   canal:"Retail",     actual:3361,  anterior:3536,  unidades:140,  unidadesAnt:150,  pctRebate:5.5, presupuesto:3400  },
  { nombre:"La Polar",      sfamilia:"Cuidado Personal",            marca:"Philips", canal:"Retail",     actual:2941,  anterior:3358,  unidades:185,  unidadesAnt:210,  pctRebate:3.9, presupuesto:3000  },
  { nombre:"Hites",         sfamilia:"Electrodomésticos",           marca:"Samsung", canal:"Retail",     actual:2731,  anterior:2623,  unidades:140,  unidadesAnt:138,  pctRebate:3.6, presupuesto:2700  },
  { nombre:"ABC",           sfamilia:"Línea Blanca",                marca:"LG",      canal:"Retail",     actual:2521,  anterior:2445,  unidades:135,  unidadesAnt:131,  pctRebate:3.5, presupuesto:2450  },
  { nombre:"Unimarc",       sfamilia:"Cuidado Personal",            marca:"Philips", canal:"Retail",     actual:2311,  anterior:2403,  unidades:150,  unidadesAnt:155,  pctRebate:3.0, presupuesto:2300  },
];

export const clientesMargen = [
  { nombre:"Falabella",     tipo:"cliente", marca:"Samsung", sfamilia:"Electrodomésticos",          venta:18500, costo:13597, rebates:833, contribucion:4070, pctRebate:4.5, margen:22.0, costoMedio:13.07, precioLista:18.18, unidades:1040, benchmark:30.1 },
  { nombre:"Lider",         tipo:"cliente", marca:"LG",      sfamilia:"Línea Blanca",               venta:17000, costo:12631, rebates:714, contribucion:3655, pctRebate:4.2, margen:21.5, costoMedio:14.03, precioLista:19.25, unidades:900,  benchmark:30.1 },
  { nombre:"Jumbo",         tipo:"cliente", marca:"Philips", sfamilia:"Cuidado Personal",           venta:16500, costo:11913, rebates:627, contribucion:3960, pctRebate:3.8, margen:24.0, costoMedio:9.85,  precioLista:13.62, unidades:1210, benchmark:30.1 },
  { nombre:"Sodimac",       tipo:"cliente", marca:"Bosch",   sfamilia:"Materiales de Construcción", venta:7800,  costo:5546,  rebates:421, contribucion:1833, pctRebate:5.4, margen:23.5, costoMedio:17.89, precioLista:25.16, unidades:310,  benchmark:30.1 },
  { nombre:"Tottus",        tipo:"cliente", marca:"Philips", sfamilia:"Cuidado Personal",           venta:6500,  costo:4472,  rebates:208, contribucion:1820, pctRebate:3.2, margen:28.0, costoMedio:10.91, precioLista:15.85, unidades:410,  benchmark:30.1 },
  { nombre:"Paris",         tipo:"cliente", marca:"Samsung", sfamilia:"Electrodomésticos",          venta:6000,  costo:4170,  rebates:240, contribucion:1590, pctRebate:4.0, margen:26.5, costoMedio:10.97, precioLista:15.79, unidades:380,  benchmark:30.1 },
  { nombre:"Mercado Libre", tipo:"cliente", marca:"LG",      sfamilia:"Línea Blanca",               venta:5200,  costo:3598,  rebates:94,  contribucion:1508, pctRebate:1.8, margen:29.0, costoMedio:13.08, precioLista:18.91, unidades:275,  benchmark:30.1 },
  { nombre:"Ripley",        tipo:"cliente", marca:"Samsung", sfamilia:"Electrodomésticos",          venta:4500,  costo:3159,  rebates:216, contribucion:1125, pctRebate:4.8, margen:25.0, costoMedio:12.89, precioLista:18.37, unidades:245,  benchmark:30.1 },
  { nombre:"Easy",          tipo:"cliente", marca:"Bosch",   sfamilia:"Materiales de Construcción", venta:3200,  costo:2000,  rebates:176, contribucion:1024, pctRebate:5.5, margen:32.0, costoMedio:14.29, precioLista:22.86, unidades:140,  benchmark:30.1 },
  { nombre:"La Polar",      tipo:"cliente", marca:"Philips", sfamilia:"Cuidado Personal",           venta:2800,  costo:1739,  rebates:109, contribucion:952,  pctRebate:3.9, margen:34.0, costoMedio:9.40,  precioLista:15.14, unidades:185,  benchmark:30.1 },
  { nombre:"Hites",         tipo:"cliente", marca:"Samsung", sfamilia:"Electrodomésticos",          venta:2600,  costo:1648,  rebates:94,  contribucion:858,  pctRebate:3.6, margen:33.0, costoMedio:11.77, precioLista:18.57, unidades:140,  benchmark:30.1 },
  { nombre:"ABC",           tipo:"cliente", marca:"LG",      sfamilia:"Línea Blanca",               venta:2400,  costo:1572,  rebates:84,  contribucion:744,  pctRebate:3.5, margen:31.0, costoMedio:11.64, precioLista:17.78, unidades:135,  benchmark:30.1 },
  { nombre:"Unimarc",       tipo:"cliente", marca:"Philips", sfamilia:"Cuidado Personal",           venta:2200,  costo:1419,  rebates:66,  contribucion:715,  pctRebate:3.0, margen:32.5, costoMedio:9.46,  precioLista:14.67, unidades:150,  benchmark:30.1 },
];

export const marcasVentas = [
  { nombre:"Samsung", sfamilia:"Electrodomésticos",          marca:"Samsung", actual:31600, anterior:30350, unidades:1805, unidadesAnt:1758, pctRebate:4.2 },
  { nombre:"Philips", sfamilia:"Cuidado Personal",           marca:"Philips", actual:28000, anterior:26140, unidades:1955, unidadesAnt:1845, pctRebate:3.5 },
  { nombre:"LG",      sfamilia:"Línea Blanca",               marca:"LG",      actual:24600, anterior:21280, unidades:1310, unidadesAnt:1171, pctRebate:3.5 },
  { nombre:"Bosch",   sfamilia:"Materiales de Construcción", marca:"Bosch",   actual:11000, anterior:10770, unidades:450,  unidadesAnt:448,  pctRebate:5.4 },
  { nombre:"Makita",  sfamilia:"Materiales de Construcción", marca:"Makita",  actual:4800,  anterior:4360,  unidades:183,  unidadesAnt:167,  pctRebate:4.2 },
];

export const marcasMargen = [
  { nombre:"Samsung", tipo:"marca", marca:"Samsung", sfamilia:"Electrodomésticos",          venta:31600, costo:22574, rebates:1383, contribucion:7643, pctRebate:4.4, margen:24.2, costoMedio:12.51, precioLista:17.51, unidades:1805, benchmark:30.1 },
  { nombre:"LG",      tipo:"marca", marca:"LG",      sfamilia:"Línea Blanca",               venta:24600, costo:17801, rebates:892,  contribucion:5907, pctRebate:3.6, margen:24.0, costoMedio:13.59, precioLista:18.78, unidades:1310, benchmark:30.1 },
  { nombre:"Philips", tipo:"marca", marca:"Philips", sfamilia:"Cuidado Personal",           venta:28000, costo:19543, rebates:1010, contribucion:7447, pctRebate:3.6, margen:26.6, costoMedio:10.00, precioLista:14.32, unidades:1955, benchmark:30.1 },
  { nombre:"Bosch",   tipo:"marca", marca:"Bosch",   sfamilia:"Materiales de Construcción", venta:11000, costo:7546,  rebates:597,  contribucion:2857, pctRebate:5.4, margen:26.0, costoMedio:16.77, precioLista:24.44, unidades:450,  benchmark:30.1 },
  { nombre:"Makita",  tipo:"marca", marca:"Makita",  sfamilia:"Materiales de Construcción", venta:4800,  costo:2893,  rebates:202,  contribucion:1705, pctRebate:4.2, margen:35.5, costoMedio:15.81, precioLista:26.23, unidades:183,  benchmark:30.1 },
];

export const sfamiliasVentas = [
  { nombre:"Electrodomésticos",          sfamilia:"Electrodomésticos",          marca:"Samsung", actual:31600, anterior:30350, unidades:1805, unidadesAnt:1758, pctRebate:4.2 },
  { nombre:"Cuidado Personal",           sfamilia:"Cuidado Personal",           marca:"Philips", actual:28000, anterior:26140, unidades:1955, unidadesAnt:1845, pctRebate:3.5 },
  { nombre:"Línea Blanca",               sfamilia:"Línea Blanca",               marca:"LG",      actual:24600, anterior:21280, unidades:1310, unidadesAnt:1171, pctRebate:3.5 },
  { nombre:"Materiales de Construcción", sfamilia:"Materiales de Construcción", marca:"Bosch",   actual:15800, anterior:15130, unidades:633,  unidadesAnt:615,  pctRebate:5.0 },
];

export const sfamiliasMargen = [
  { nombre:"Electrodomésticos",          tipo:"sfamilia", marca:"Samsung", sfamilia:"Electrodomésticos",          venta:31600, costo:22574, rebates:1383, contribucion:7643, pctRebate:4.4, margen:24.2, costoMedio:12.51, precioLista:17.51, unidades:1805, benchmark:30.1 },
  { nombre:"Línea Blanca",               tipo:"sfamilia", marca:"LG",      sfamilia:"Línea Blanca",               venta:24600, costo:17801, rebates:892,  contribucion:5907, pctRebate:3.6, margen:24.0, costoMedio:13.59, precioLista:18.78, unidades:1310, benchmark:30.1 },
  { nombre:"Cuidado Personal",           tipo:"sfamilia", marca:"Philips", sfamilia:"Cuidado Personal",           venta:28000, costo:19543, rebates:1010, contribucion:7447, pctRebate:3.6, margen:26.6, costoMedio:10.00, precioLista:14.32, unidades:1955, benchmark:30.1 },
  { nombre:"Materiales de Construcción", tipo:"sfamilia", marca:"Bosch",   sfamilia:"Materiales de Construcción", venta:15800, costo:10439, rebates:799,  contribucion:4562, pctRebate:5.1, margen:28.9, costoMedio:16.49, precioLista:24.96, unidades:633,  benchmark:30.1 },
];

export const skuInventario = [
  { sku:"SAM-REF500L",  bodega:"Santiago",    marca:"Samsung", sfamilia:"Electrodomésticos",          stockUSD:18600,stockUnd:72, ventaDiaria:4.2, vendidoMes:126, rotacion:9.8, doh:17,  cobertura:18,  margenPct:22, diasSinVenta:0,  estado:"Activo", alerta:"ok",   pctInv:13.8 },
  { sku:"LG-WASH11KG",  bodega:"Santiago",    marca:"LG",      sfamilia:"Línea Blanca",               stockUSD:15200,stockUnd:48, ventaDiaria:3.1, vendidoMes:93,  rotacion:8.6, doh:21,  cobertura:22,  margenPct:23, diasSinVenta:0,  estado:"Activo", alerta:"ok",   pctInv:11.3 },
  { sku:"SAM-TV55",     bodega:"Santiago",    marca:"Samsung", sfamilia:"Electrodomésticos",          stockUSD:12800,stockUnd:18, ventaDiaria:0.8, vendidoMes:24,  rotacion:3.6, doh:58,  cobertura:30,  margenPct:19, diasSinVenta:12, estado:"Lento",  alerta:"warn", pctInv:9.5  },
  { sku:"LG-DRYER8KG",  bodega:"Valparaíso",  marca:"LG",      sfamilia:"Línea Blanca",               stockUSD:13600,stockUnd:42, ventaDiaria:0.2, vendidoMes:6,   rotacion:1.0, doh:165, cobertura:165, margenPct:11, diasSinVenta:94, estado:"120d",   alerta:"crit", pctInv:10.1 },
  { sku:"PHI-SHAVER9",  bodega:"Santiago",    marca:"Philips", sfamilia:"Cuidado Personal",           stockUSD:11400,stockUnd:140,ventaDiaria:6.5, vendidoMes:195, rotacion:11.2,doh:15,  cobertura:18,  margenPct:28, diasSinVenta:0,  estado:"Activo", alerta:"ok",   pctInv:8.4  },
  { sku:"BOS-SANDER",   bodega:"Valparaíso",  marca:"Bosch",   sfamilia:"Materiales de Construcción", stockUSD:11200,stockUnd:45, ventaDiaria:0.4, vendidoMes:12,  rotacion:1.6, doh:115, cobertura:115, margenPct:15, diasSinVenta:68, estado:"90d",    alerta:"warn", pctInv:8.3  },
  { sku:"PHI-IRON-PRO", bodega:"Concepción",  marca:"Philips", sfamilia:"Cuidado Personal",           stockUSD:9800, stockUnd:140,ventaDiaria:1.2, vendidoMes:36,  rotacion:2.4, doh:95,  cobertura:95,  margenPct:21, diasSinVenta:35, estado:"60d",    alerta:"warn", pctInv:7.3  },
  { sku:"BOS-DRILL18V", bodega:"Concepción",  marca:"Bosch",   sfamilia:"Materiales de Construcción", stockUSD:9600, stockUnd:60, ventaDiaria:2.8, vendidoMes:84,  rotacion:8.1, doh:22,  cobertura:22,  margenPct:27, diasSinVenta:0,  estado:"Activo", alerta:"ok",   pctInv:7.1  },
  { sku:"MAK-COMP-AIR", bodega:"Antofagasta", marca:"Makita",  sfamilia:"Materiales de Construcción", stockUSD:8400, stockUnd:15, ventaDiaria:0.1, vendidoMes:3,   rotacion:0.8, doh:190, cobertura:190, margenPct:8,  diasSinVenta:112,estado:"120d",   alerta:"crit", pctInv:6.2  },
  { sku:"SAM-MICRO32L", bodega:"Valparaíso",  marca:"Samsung", sfamilia:"Electrodomésticos",          stockUSD:7800, stockUnd:68, ventaDiaria:2.4, vendidoMes:72,  rotacion:7.4, doh:24,  cobertura:22,  margenPct:25, diasSinVenta:1,  estado:"Activo", alerta:"ok",   pctInv:5.8  },
  { sku:"PHI-HAIR-PRO", bodega:"Valparaíso",  marca:"Philips", sfamilia:"Cuidado Personal",           stockUSD:6400, stockUnd:92, ventaDiaria:4.0, vendidoMes:120, rotacion:10.1,doh:19,  cobertura:20,  margenPct:29, diasSinVenta:0,  estado:"Activo", alerta:"ok",   pctInv:4.7  },
  { sku:"LG-AIR9000",   bodega:"Santiago",    marca:"LG",      sfamilia:"Línea Blanca",               stockUSD:5800, stockUnd:32, ventaDiaria:1.5, vendidoMes:45,  rotacion:5.8, doh:32,  cobertura:25,  margenPct:22, diasSinVenta:2,  estado:"Activo", alerta:"ok",   pctInv:4.3  },
  { sku:"MAK-SAW18V",   bodega:"Antofagasta", marca:"Makita",  sfamilia:"Materiales de Construcción", stockUSD:4400, stockUnd:24, ventaDiaria:1.1, vendidoMes:33,  rotacion:5.2, doh:33,  cobertura:25,  margenPct:34, diasSinVenta:3,  estado:"Activo", alerta:"ok",   pctInv:3.3  },
];

export const historialMargen = (() => {
  const defs = {
    "Falabella":     { vBase:1350, vDic:1780, margen:22.0, rBase:60, rDic:80, cmBase:14.0, cmDic:13.7, tBase:17.6, tDic:18.1, plBase:19.0, plDic:18.6 },
    "Lider":         { vBase:1250, vDic:1650, margen:21.5, rBase:52, rDic:70, cmBase:15.2, cmDic:14.9, tBase:18.5, tDic:19.2, plBase:20.0, plDic:19.7 },
    "Jumbo":         { vBase:1200, vDic:1600, margen:24.0, rBase:45, rDic:62, cmBase:9.8,  cmDic:9.5,  tBase:13.0, tDic:13.9, plBase:14.2, plDic:13.9 },
    "Sodimac":       { vBase:580,  vDic:760,  margen:23.5, rBase:30, rDic:42, cmBase:19.0, cmDic:18.7, tBase:24.5, tDic:25.7, plBase:26.2, plDic:25.8 },
    "Tottus":        { vBase:480,  vDic:640,  margen:28.0, rBase:15, rDic:20, cmBase:11.4, cmDic:11.1, tBase:15.2, tDic:16.3, plBase:16.8, plDic:16.5 },
    "Paris":         { vBase:440,  vDic:590,  margen:26.5, rBase:17, rDic:24, cmBase:11.8, cmDic:11.5, tBase:15.5, tDic:16.1, plBase:17.0, plDic:16.7 },
    "Mercado Libre": { vBase:380,  vDic:510,  margen:29.0, rBase:7,  rDic:10, cmBase:13.5, cmDic:13.2, tBase:18.3, tDic:19.4, plBase:20.5, plDic:20.2 },
    "Ripley":        { vBase:340,  vDic:440,  margen:25.0, rBase:15, rDic:22, cmBase:13.8, cmDic:13.5, tBase:17.8, tDic:18.6, plBase:19.5, plDic:19.2 },
    "Easy":          { vBase:240,  vDic:310,  margen:32.0, rBase:13, rDic:18, cmBase:15.5, cmDic:15.2, tBase:22.0, tDic:23.2, plBase:23.5, plDic:23.1 },
    "La Polar":      { vBase:210,  vDic:280,  margen:34.0, rBase:9,  rDic:12, cmBase:10.0, cmDic:9.7,  tBase:14.5, tDic:15.4, plBase:16.2, plDic:15.9 },
    "Hites":         { vBase:195,  vDic:260,  margen:33.0, rBase:7,  rDic:10, cmBase:12.4, cmDic:12.1, tBase:17.6, tDic:18.9, plBase:20.0, plDic:19.6 },
    "ABC":           { vBase:180,  vDic:240,  margen:31.0, rBase:6,  rDic:9,  cmBase:12.3, cmDic:12.0, tBase:17.0, tDic:18.0, plBase:18.8, plDic:18.5 },
    "Unimarc":       { vBase:165,  vDic:220,  margen:32.5, rBase:5,  rDic:7,  cmBase:10.0, cmDic:9.7,  tBase:14.0, tDic:15.0, plBase:15.5, plDic:15.2 },
    "Electrodom\u00e9sticos":          { vBase:2370, vDic:3130, margen:24.2, rBase:99, rDic:133,cmBase:13.5, cmDic:13.1, tBase:16.8, tDic:17.8, plBase:18.0, plDic:17.7 },
    "L\u00ednea Blanca":               { vBase:1840, vDic:2450, margen:24.0, rBase:77, rDic:103,cmBase:14.5, cmDic:14.2, tBase:17.5, tDic:18.4, plBase:19.0, plDic:18.7 },
    "Cuidado Personal":                { vBase:2080, vDic:2780, margen:26.6, rBase:73, rDic:97, cmBase:10.2, cmDic:9.9,  tBase:13.4, tDic:14.4, plBase:14.8, plDic:14.5 },
    "Materiales de Construcci\u00f3n": { vBase:1180, vDic:1580, margen:28.9, rBase:55, rDic:74, cmBase:17.3, cmDic:17.0, tBase:22.4, tDic:23.6, plBase:24.0, plDic:23.6 },
    "Samsung":       { vBase:2370, vDic:3130, margen:24.2, rBase:99, rDic:133,cmBase:13.5, cmDic:13.1, tBase:16.8, tDic:17.8, plBase:18.0, plDic:17.7 },
    "LG":            { vBase:1840, vDic:2450, margen:24.0, rBase:77, rDic:103,cmBase:14.5, cmDic:14.2, tBase:17.5, tDic:18.4, plBase:19.0, plDic:18.7 },
    "Philips":       { vBase:2080, vDic:2780, margen:26.6, rBase:73, rDic:97, cmBase:10.2, cmDic:9.9,  tBase:13.4, tDic:14.4, plBase:14.8, plDic:14.5 },
    "Bosch":         { vBase:820,  vDic:1100, margen:26.0, rBase:41, rDic:56, cmBase:18.1, cmDic:17.8, tBase:22.8, tDic:24.2, plBase:25.0, plDic:24.7 },
    "Makita":        { vBase:360,  vDic:480,  margen:35.5, rBase:14, rDic:20, cmBase:16.8, cmDic:16.5, tBase:25.2, tDic:26.8, plBase:26.6, plDic:26.3 },
    "SAM-REF500L":   { vBase:820,  vDic:1100, margen:22.5, rBase:37, rDic:50, cmBase:195.0,cmDic:192.0,tBase:256.0,tDic:272.0,plBase:272.0,plDic:268.0 },
    "LG-WASH11KG":   { vBase:940,  vDic:1260, margen:23.0, rBase:28, rDic:38, cmBase:244.0,cmDic:240.0,tBase:317.0,tDic:340.0,plBase:345.0,plDic:340.0 },
    "PHI-SHAVER9":   { vBase:930,  vDic:1240, margen:28.0, rBase:33, rDic:45, cmBase:59.0, cmDic:57.7, tBase:82.0, tDic:87.0, plBase:88.0, plDic:86.5 },
    "BOS-DRILL18V":  { vBase:515,  vDic:690,  margen:27.0, rBase:26, rDic:35, cmBase:117.0,cmDic:114.5,tBase:160.0,tDic:168.0,plBase:172.0,plDic:169.5 },
    "MAK-SAW18V":    { vBase:235,  vDic:315,  margen:34.0, rBase:9,  rDic:13, cmBase:132.0,cmDic:129.2,tBase:200.0,tDic:212.0,plBase:216.0,plDic:212.5 },
    "SAM-TV55":      { vBase:1010, vDic:1340, margen:18.5, rBase:45, rDic:60, cmBase:520.0,cmDic:510.0,tBase:660.0,tDic:672.0,plBase:680.0,plDic:670.0 },
    "LG-DRYER8KG":   { vBase:420,  vDic:570,  margen:11.1, rBase:23, rDic:31, cmBase:276.0,cmDic:272.0,tBase:322.0,tDic:335.0,plBase:335.0,plDic:328.0 },
    "MAK-COMP-AIR":  { vBase:128,  vDic:172,  margen:7.9,  rBase:8,  rDic:10, cmBase:368.0,cmDic:362.0,tBase:420.0,tDic:430.0,plBase:430.0,plDic:420.0 },
    "SAM-MICRO32L":  { vBase:570,  vDic:760,  margen:25.0, rBase:26, rDic:35, cmBase:86.0, cmDic:84.5, tBase:114.0,tDic:120.5,plBase:122.0,plDic:120.0 },
    "PHI-HAIR-PRO":  { vBase:700,  vDic:940,  margen:29.0, rBase:25, rDic:33, cmBase:49.0, cmDic:47.8, tBase:68.0, tDic:72.1, plBase:73.0, plDic:71.8 },
    "LG-AIR9000":    { vBase:500,  vDic:670,  margen:22.0, rBase:28, rDic:38, cmBase:142.0,cmDic:140.0,tBase:181.0,tDic:189.0,plBase:194.0,plDic:191.5 },
    "PHI-IRON-PRO":  { vBase:485,  vDic:650,  margen:21.0, rBase:20, rDic:27, cmBase:51.5, cmDic:50.1, tBase:64.0, tDic:68.0, plBase:69.0, plDic:67.5 },
    "BOS-SANDER":    { vBase:315,  vDic:420,  margen:15.0, rBase:19, rDic:26, cmBase:210.0,cmDic:208.5,tBase:248.0,tDic:258.0,plBase:260.0,plDic:256.0 },
  };

  // Totales anuales exactos — fuente \u00fanica de verdad
  const contribucionAnual = {
    "Falabella":4070,"Lider":3655,"Jumbo":3960,"Sodimac":1833,"Tottus":1820,
    "Paris":1590,"Mercado Libre":1508,"Ripley":1125,"Easy":1024,"La Polar":952,
    "Hites":858,"ABC":744,"Unimarc":715,
    "Electrodom\u00e9sticos":7643,"L\u00ednea Blanca":5907,"Cuidado Personal":7447,"Materiales de Construcci\u00f3n":4562,
    "Samsung":7643,"LG":5907,"Philips":7447,"Bosch":2857,"Makita":1705,
    "SAM-REF500L":2430,"LG-WASH11KG":2852,"PHI-SHAVER9":3444,"BOS-DRILL18V":1837,"MAK-SAW18V":1054,
    "SAM-TV55":2460,"LG-DRYER8KG":624,"MAK-COMP-AIR":135,
    "SAM-MICRO32L":1560,"PHI-HAIR-PRO":2480,"LG-AIR9000":1290,"PHI-IRON-PRO":1330,"BOS-SANDER":570,
  };

  // Fracciones mensuales basadas en ventasMensuales (curva de negocio real)
  const ventasBase = [6800,6500,7800,7400,8200,8700,8100,9100,8600,9400,9800,9600];
  const totalVB    = ventasBase.reduce((s,v)=>s+v,0);
  const fracs      = ventasBase.map(v=>v/totalVB);

  // Distribuir un total en 12 meses proporcionales; ajusta el \u00faltimo para cuadrar exacto
  const distribuir = (total) => {
    const m = fracs.map(f => Math.round(f * total));
    m[11] += total - m.reduce((s,v)=>s+v,0);
    return m;
  };

  const MESES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  const lerp  = (a,b,t) => +(a + (b-a)*t).toFixed(2);
  const result = {};

  Object.entries(defs).forEach(([nombre, d]) => {
    const totalContrib    = contribucionAnual[nombre] ?? Math.round((d.vBase+d.vDic)*6*d.margen/100);
    const margenAnt       = +(d.margen - 1.8).toFixed(1);
    const totalContribAnt = Math.round(totalContrib / 1.081 * ((d.margen - 1.8) / d.margen));
    const contribM        = distribuir(totalContrib);
    const contribAntM     = distribuir(totalContribAnt);

    result[nombre] = MESES.map((mes,i) => {
      const t = i/11;
      const venta   = Math.round(lerp(d.vBase, d.vDic, t));
      return {
        mes, venta, ventaAnt: Math.round(venta/1.081),
        contribucion:    contribM[i],
        contribucionAnt: contribAntM[i],
        margen:d.margen, margenAnt,
        rebates:     Math.round(lerp(d.rBase,  d.rDic,  t)),
        costoMedio:  lerp(d.cmBase, d.cmDic, t),
        ticket:      lerp(d.tBase,  d.tDic,  t),
        precioLista: lerp(d.plBase, d.plDic, t),
      };
    });
  });
  return result;
})();

export const CLIENTES_STRATEGIC_PROFILE = {
  "Falabella": {
    tier: 1,
    cargaComercial: "Alta",
    poderNegociacion: "Alto",
    categoriaDominante: "Samsung en Electrodomésticos, alta rotación con margen presionado",
    rolEstrategico: "Volumen con carga alta y margen presionado",
    sustitutosNaturales: ["Lider parcial", "Paris limitado"],
  },
  "Lider": {
    tier: 1,
    cargaComercial: "Alta",
    poderNegociacion: "Alto",
    categoriaDominante: "LG en Línea Blanca, alta rotación con margen presionado",
    rolEstrategico: "Volumen con carga alta y margen presionado",
    sustitutosNaturales: ["Falabella parcial", "ABC limitado"],
  },
  "Jumbo": {
    tier: 1,
    cargaComercial: "Media",
    poderNegociacion: "Alto",
    categoriaDominante: "Philips en Cuidado Personal, alta rotación",
    rolEstrategico: "Volumen sano con contribución estructural",
    sustitutosNaturales: ["Tottus parcial", "Unimarc limitado"],
  },
  "Sodimac": {
    tier: 2,
    cargaComercial: "Alta",
    poderNegociacion: "Medio",
    categoriaDominante: "Bosch en Materiales de Construcción",
    rolEstrategico: "Volumen sano con contribución estructural",
    sustitutosNaturales: ["Easy limitado"],
  },
  "Tottus": {
    tier: 2,
    cargaComercial: "Media",
    poderNegociacion: "Medio",
    categoriaDominante: "Philips en Cuidado Personal con margen sano",
    rolEstrategico: "Margen sano con carga moderada",
    sustitutosNaturales: ["Jumbo parcial", "Unimarc limitado"],
  },
  "Paris": {
    tier: 2,
    cargaComercial: "Alta",
    poderNegociacion: "Medio",
    categoriaDominante: "Samsung en Electrodomésticos",
    rolEstrategico: "Volumen sano con contribución estructural",
    sustitutosNaturales: ["Ripley parcial", "Hites limitado"],
  },
  "Mercado Libre": {
    tier: 2,
    cargaComercial: "Baja",
    poderNegociacion: "Alto",
    categoriaDominante: "LG en Línea Blanca vía canal digital",
    rolEstrategico: "Margen alto con baja carga comercial",
    sustitutosNaturales: ["sin reemplazo natural en canal digital"],
  },
  "Ripley": {
    tier: 2,
    cargaComercial: "Alta",
    poderNegociacion: "Bajo",
    categoriaDominante: "Samsung en Electrodomésticos",
    rolEstrategico: "Volumen sano con contribución estructural",
    sustitutosNaturales: ["Paris parcial", "Hites limitado"],
  },
  "Easy": {
    tier: 2,
    cargaComercial: "Alta",
    poderNegociacion: "Bajo",
    categoriaDominante: "Bosch en Materiales de Construcción con margen sano",
    rolEstrategico: "Margen alto con carga cara",
    sustitutosNaturales: ["Sodimac limitado"],
  },
  "La Polar": {
    tier: 3,
    cargaComercial: "Media",
    poderNegociacion: "Bajo",
    categoriaDominante: "Philips en Cuidado Personal con margen sano",
    rolEstrategico: "Cuenta de baja escala con margen sano",
    sustitutosNaturales: ["Hites parcial", "Unimarc limitado"],
  },
  "Hites": {
    tier: 3,
    cargaComercial: "Media",
    poderNegociacion: "Bajo",
    categoriaDominante: "Samsung en Electrodomésticos con margen sano",
    rolEstrategico: "Cuenta de baja escala con margen sano",
    sustitutosNaturales: ["Ripley parcial", "La Polar parcial"],
  },
  "ABC": {
    tier: 3,
    cargaComercial: "Media",
    poderNegociacion: "Bajo",
    categoriaDominante: "LG en Línea Blanca con margen sano",
    rolEstrategico: "Cuenta de baja escala con margen sano",
    sustitutosNaturales: ["Lider limitado"],
  },
  "Unimarc": {
    tier: 3,
    cargaComercial: "Media",
    poderNegociacion: "Bajo",
    categoriaDominante: "Philips en Cuidado Personal con margen sano",
    rolEstrategico: "Cuenta de baja escala con margen sano",
    sustitutosNaturales: ["Tottus limitado", "La Polar parcial"],
  },
};
