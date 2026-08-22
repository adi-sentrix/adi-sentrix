/* === _ingesta_lectura_gate.mjs · LEER UN EXCEL SIN INVENTAR NADA (vía 2 · paso 1 · 2026-08-21) ================
 *
 * El paso 1 de la vía 2 con su alcance exacto, dicho por el owner: **solo Excel demo o sintético**, lectura y
 * normalización LOCAL, salida = un dataset con forma de Sentrix + una preview para ver que cargó bien, **sin
 * modelo**. Este gate es la prueba de que eso es cierto y de que sigue siéndolo mañana.
 *
 * LA PRUEBA QUE VALE ES EL ESPEJO [E]. Se genera un `.xlsx` DESDE el tenant demo, se lo lee, se lo mapea y se lo
 * normaliza, y se exige que las cuatro tablas vuelvan **idénticas** a las del demo. Un ida y vuelta que cierra
 * prueba de una vez que el lector no deforma, que el mapeo acertó columna por columna y que la normalización no
 * redondeó nada por el camino. Veinte asserts sueltos no dan esa garantía.
 *
 * LAS OTRAS SEIS PARTES son las renuncias, que es donde vive el riesgo de una ingesta:
 *   [A] el lector · .xlsx (ZIP+XML) y .csv, con tipos y separador detectado — cero dependencias, cero red
 *   [B] el mapeo · resuelve lo obvio y DECLARA lo que no: ambiguo, faltante obligatorio, sin resolver
 *   [C] el cerrojo de la unidad · sin confirmación humana no se normaliza un número. Miles-vs-dólares, hecho candado
 *   [D] duplicados · misma clave y distinto valor NO se resuelve: se bloquea
 *   [F] sin mezclar tenants · un dataset ingestado no trae una sola entidad del demo, y al activarlo ADI reconoce
 *       las cuentas de ESE archivo y ya no las del demo
 *   [G] forma de Sentrix · el dataset trae todas las llaves y entra por la puerta del dato sin romper nada
 *   [H] la preview humana · las seis secciones que pidió el owner, y qué caras de la Mesa quedan disponibles
 *
 * Determinístico · sin red · sin credenciales · sin modelo · sin dependencias nuevas.
 */
import { leerLibro } from "./src/ingesta/leerLibro.js";
import { proponerMapeo, elegirEje } from "./src/ingesta/mapeoDeterministico.js";
import { normalizarEje } from "./src/ingesta/normalizar.js";
import { ingestarLibro, previewEnTexto } from "./src/ingesta/ingestarLibro.js";
import { disponibilidadSentrix } from "./src/ingesta/disponibilidad.js";
import { LLAVES_DATASET } from "./src/ingesta/normalizar.js";
import { excelDemoBuffer, hojasDelDemo, construirXlsx } from "./scripts/generar-excel-demo.mjs";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { initTenant, getTenantId, tenantCargado } from "./src/data/tenantStore.js";
import { detectClientInText } from "./src/adi/detectors.js";
import { CLIENT_NAMES } from "./src/config/routerData.js";

/** un .xlsx sintético con las hojas que le pasen — para inventar un negocio sin tocar ningún tenant. */
const librosintetico = (hojas) => construirXlsx(hojas);

let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ FALLO: " + m + (extra ? "\n      " + extra : "")); } };
const H = (t) => console.log("\n" + t + "\n" + "─".repeat(Math.min(100, t.length)));

/* ── [A] EL LECTOR ─────────────────────────────────────────────────────────────────────────────────────────── */
H("[A] EL LECTOR · .xlsx y .csv, con código y sin dependencias");
{
  const buf = excelDemoBuffer();
  ok(buf.length > 2000 && buf[0] === 0x50 && buf[1] === 0x4b, `el .xlsx sintético se generó y es un ZIP real (${(buf.length / 1024).toFixed(1)} KB)`);

  const libro = leerLibro(buf, { nombreArchivo: "demo.xlsx" });
  ok(libro.formato === "xlsx", "se detecta el formato por el contenido, no por el nombre");
  ok(libro.hojas.length === hojasDelDemo().length, `lee las ${hojasDelDemo().length} hojas (leyó ${libro.hojas.length})`);

  const inv = libro.hojas.find((h) => h.nombre === "Inventario");
  ok(!!inv && inv.filas.length === TENANT_DEMO.skuInventario.length, `la hoja Inventario trae sus ${TENANT_DEMO.skuInventario.length} filas`);
  ok(inv && typeof inv.filas[0]["Stock valorizado"] === "number", "los números vuelven como número, no como texto");
  ok(inv && typeof inv.filas[0]["Código SKU"] === "string", "los textos vuelven como texto");
  ok(inv && inv.filas[0]["Código SKU"] === TENANT_DEMO.skuInventario[0].sku, `la primera clave es la que se escribió ("${inv && inv.filas[0]["Código SKU"]}")`);

  // csv, con el separador detectado (media LatAm exporta con `;`)
  const csvComa = leerLibro('Cliente,Venta del mes\nUno,100\nDos,200\n', { nombreArchivo: "x.csv" });
  const csvPunto = leerLibro('Cliente;Venta del mes\nUno;100\nDos;200\n', { nombreArchivo: "x.csv" });
  ok(csvComa.hojas[0].filas.length === 2 && csvComa.hojas[0].filas[0]["Venta del mes"] === 100, "csv con coma: 2 filas y el número convertido");
  ok(csvPunto.hojas[0].filas.length === 2 && csvPunto.hojas[0].filas[0]["Venta del mes"] === 100, "csv con punto y coma: el separador se DETECTA, no se asume");
  const csvComillas = leerLibro('Cliente,Nota\n"Perez, S.A.","dijo ""ok"""\n', { nombreArchivo: "x.csv" });
  ok(csvComillas.hojas[0].filas[0]["Cliente"] === "Perez, S.A.", "csv: una coma dentro de comillas no parte el campo");
  ok(csvComillas.hojas[0].filas[0]["Nota"] === 'dijo "ok"', "csv: las comillas escapadas se resuelven");
}

/* ── [B] EL MAPEO ──────────────────────────────────────────────────────────────────────────────────────────── */
H("[B] EL MAPEO · resuelve lo obvio y DECLARA lo que no");
{
  const p = proponerMapeo({ eje: "skuInventario", encabezados: ["Código SKU", "Bodega", "Stock valorizado", "Rotación", "Días de inventario", "Estado", "Comentario del jefe"] });
  ok(p.ok === true, "una hoja con todas las obligatorias queda ok");
  ok(p.mapeo.sku && p.mapeo.sku.via === "sinónimo declarado", `"Código SKU" → sku por sinónimo declarado`);
  ok(p.mapeo.rotacion && p.mapeo.rotacion.via === "nombre exacto", `"Rotación" → rotacion por nombre exacto (los acentos no estorban)`);
  ok(p.mapeo.stockUSD && p.mapeo.stockUSD.unidad === "money(raw)", "la unidad viaja DECLARADA desde el contrato, no deducida del valor");
  ok(p.sinResolver.includes("Comentario del jefe"), "lo que el contrato no conoce se reporta como sin resolver, no se descarta callado");

  const falta = proponerMapeo({ eje: "skuInventario", encabezados: ["Código SKU", "Stock valorizado"] });
  ok(falta.ok === false && falta.faltantes.some((f) => f.campo === "rotacion"), "sin una obligatoria, el eje NO queda ok y la nombra");

  const amb = proponerMapeo({ eje: "clientesMargen", encabezados: ["Cuenta", "Ventas", "Venta total"] });
  ok(amb.ambiguas.some((a) => a.campo === "venta" && a.columnas.length === 2), "dos columnas que reclaman el mismo campo → AMBIGUO, y no se elige ninguna");
  ok(!amb.mapeo.venta, "…y el campo ambiguo queda SIN mapear (elegir por orden sería inventar)");

  // la pista de unidad: «Rebate %» es tasa y «Rebates» es plata, aunque normalizadas colapsen
  const pct = proponerMapeo({ eje: "clientesMargen", encabezados: ["Cuenta", "Ventas", "Rebates", "Rebate %"] });
  ok(pct.mapeo.rebates && pct.mapeo.rebates.columna === "Rebates", '"Rebates" → rebates (plata)');
  ok(pct.mapeo.pctRebate && pct.mapeo.pctRebate.columna === "Rebate %", '"Rebate %" → pctRebate (tasa) — el «%» que escribió el humano desempata');

  // el eje se elige por las columnas, no por el nombre de la hoja
  const e1 = elegirEje({ encabezados: ["Producto", "Ventas", "Margen %"] });
  const e2 = elegirEje({ encabezados: ["Cuenta", "Ventas", "Margen %"] });
  ok(e1.eje === "skusMargen", `"Producto" manda la hoja al eje de productos (dio ${e1.eje})`);
  ok(e2.eje === "clientesMargen", `"Cuenta" la manda al eje de clientes (dio ${e2.eje})`);
  const e3 = elegirEje({ encabezados: ["Nombre", "Ventas"] });
  ok(e3.eje === null && /decide una persona/.test(String(e3.motivo)), "un encabezado genérico que encaja en dos ejes NO se resuelve: lo decide una persona");
}

/* ── [C] EL CERROJO DE LA UNIDAD ───────────────────────────────────────────────────────────────────────────── */
H("[C] LA UNIDAD SE CONFIRMA · sin eso no se normaliza un solo número");
{
  const enc = ["Código SKU", "Stock valorizado", "Rotación", "Días de inventario", "Estado"];
  const p = proponerMapeo({ eje: "skuInventario", encabezados: enc });
  const filas = [{ "Código SKU": "X-1", "Stock valorizado": 1000, "Rotación": 2, "Días de inventario": 30, "Estado": "Activo" }];

  const sin = normalizarEje({ eje: "skuInventario", filas, mapeo: p.mapeo, unidadesConfirmadas: false });
  ok(sin.ok === false && sin.filas.length === 0, "sin confirmar unidades: cero filas normalizadas");
  ok(sin.bloqueos.some((b) => b.tipo === "unidades-sin-confirmar"), "…y el bloqueo dice exactamente por qué");
  ok(sin.bloqueos[0].campos.some((c) => c.unidad === "money(raw)"), "…y muestra QUÉ unidad hay que confirmar, campo por campo");

  const con = normalizarEje({ eje: "skuInventario", filas, mapeo: p.mapeo, unidadesConfirmadas: true });
  ok(con.ok === true && con.filas.length === 1, "confirmadas: la fila entra");
  ok(con.filas[0].stockUSD === 1000 && con.filas[0].rotacion === 2, "…con los valores tal cual, sin reescalar nada por su cuenta");

  const r = ingestarLibro(excelDemoBuffer(), { id: "x", nombre: "X", nombreArchivo: "d.xlsx", unidadesConfirmadas: false });
  ok(r.ok === false && r.dataset === null, "el recorrido completo tampoco produce dataset sin confirmación");
}

/* ── [D] DUPLICADOS ────────────────────────────────────────────────────────────────────────────────────────── */
H("[D] DUPLICADOS · el que no se puede resolver, se bloquea");
{
  const enc = ["Código SKU", "Stock valorizado", "Rotación", "Días de inventario", "Estado"];
  const p = proponerMapeo({ eje: "skuInventario", encabezados: enc });
  const fila = (sku, stock) => ({ "Código SKU": sku, "Stock valorizado": stock, "Rotación": 2, "Días de inventario": 30, "Estado": "Activo" });

  const distinto = normalizarEje({ eje: "skuInventario", filas: [fila("X-1", 1000), fila("X-1", 2000)], mapeo: p.mapeo, unidadesConfirmadas: true });
  ok(distinto.ok === false && distinto.bloqueos.some((b) => b.tipo === "clave-duplicada-con-distinto-valor"), "misma clave con distinto valor → BLOQUEANTE (no hay forma de elegir sin inventar)");

  const igual = normalizarEje({ eje: "skuInventario", filas: [fila("X-1", 1000), fila("X-1", 1000)], mapeo: p.mapeo, unidadesConfirmadas: true });
  ok(igual.ok === true && igual.filas.length === 1, "misma clave con el mismo valor → se colapsa a una fila");
  ok(igual.avisos.some((a) => a.tipo === "fila-duplicada-identica"), "…y se avisa, no se hace en silencio");
}

/* ── [E] EL ESPEJO ─────────────────────────────────────────────────────────────────────────────────────────── */
H("[E] EL ESPEJO · dataset demo → .xlsx → leer → mapear → normalizar → ¿vuelve idéntico?");
const espejo = ingestarLibro(excelDemoBuffer(), { id: "espejo", nombre: "Espejo del demo", nombreArchivo: "demo.xlsx", unidadesConfirmadas: true });
ok(espejo.ok === true, `el recorrido completo cierra sin bloqueos${espejo.ok ? "" : ` — ${espejo.bloqueos.map((b) => b.detalle).join(" · ")}`}`);
{
  const d = espejo.dataset || {};
  const compara = (tabla, campos) => {
    const a = d[tabla] || [], b = TENANT_DEMO[tabla] || [];
    if (a.length !== b.length) return `largo distinto: ${a.length} vs ${b.length}`;
    for (let i = 0; i < a.length; i++) for (const c of campos) {
      if (JSON.stringify(a[i][c]) !== JSON.stringify(b[i][c])) return `fila ${i} campo ${c}: ${JSON.stringify(a[i][c])} vs ${JSON.stringify(b[i][c])}`;
    }
    return null;
  };
  for (const [tabla, campos] of [
    ["clientesVentas", ["nombre", "actual", "anterior", "presupuesto", "unidades", "unidadesAnt", "pctRebate", "canal", "marca", "sfamilia"]],
    ["clientesMargen", ["nombre", "marca", "sfamilia", "venta", "costo", "rebates", "contribucion", "pctRebate", "margen", "benchmark", "unidades", "costoMedio", "precioLista"]],
    ["skuInventario", ["sku", "bodega", "marca", "sfamilia", "stockUSD", "stockUnd", "rotacion", "doh", "cobertura", "margenPct", "diasSinVenta", "vendidoMes", "ventaDiaria", "estado", "alerta"]],
    ["skusMargen", ["nombre", "marca", "sfamilia", "venta", "costo", "rebates", "contribucion", "pctRebate", "margen", "benchmark", "unidades", "costoMedio", "precioLista"]],
  ]) {
    const dif = compara(tabla, campos);
    ok(dif === null, `${tabla}: vuelve IDÉNTICO al demo (${(d[tabla] || []).length} filas)`, dif || "");
  }
  const sumaDemo = TENANT_DEMO.clientesVentas.reduce((s, r) => s + r.actual, 0);
  ok(espejo.preview.totales.ventaClientes === sumaDemo, `la venta sumada coincide al peso (${espejo.preview.totales.ventaClientes})`);
  const capDemo = TENANT_DEMO.skuInventario.reduce((s, r) => s + r.stockUSD, 0);
  ok(espejo.preview.totales.capitalInventario === capDemo, `el capital en inventario coincide al peso (${espejo.preview.totales.capitalInventario})`);
}

/* ── [F] SIN MEZCLAR TENANTS ───────────────────────────────────────────────────────────────────────────────── */
H("[F] SIN MEZCLAR TENANTS · un archivo trae SUS cuentas, y ninguna del demo");
{
  /* Un negocio INVENTADO, que no existe en ningún tenant de la build — dato sintético, que es la regla del paso 1.
   * Va como .xlsx de dos hojas porque es la forma real de un dataset comercial: la venta del período por cuenta
   * (el eje que declara quiénes son las cuentas) y el margen por cuenta. Ver el hallazgo de más abajo sobre por
   * qué las dos hojas importan. */
  const aurora = librosintetico([
    { nombre: "Ventas", filas: [
      ["Cuenta", "Marca", "Familia", "Venta del mes", "Periodo anterior", "Presupuesto", "Cantidad"],
      ["Ferretería Aurora", "Kolbe", "Herramientas", 8000, 7400, 8200, 400],
      ["Depósito Riachuelo", "Kolbe", "Herramientas", 5000, 5300, 5100, 260],
      ["Casa Belgrano", "Nordix", "Sanitarios", 3000, 2700, 3100, 150],
    ] },
    { nombre: "Margen", filas: [
      ["Cliente", "Marca", "Familia", "Ventas", "Costo de venta", "Rebates", "Utilidad bruta", "Rebate %", "Margen %", "Referencia", "Cantidad"],
      ["Ferretería Aurora", "Kolbe", "Herramientas", 8000, 5600, 120, 2400, 1.5, 30, 28, 400],
      ["Depósito Riachuelo", "Kolbe", "Herramientas", 5000, 3600, 80, 1400, 1.6, 28, 28, 260],
      ["Casa Belgrano", "Nordix", "Sanitarios", 3000, 2100, 40, 900, 1.3, 30, 28, 150],
    ] },
  ]);
  const r = ingestarLibro(aurora, { id: "aurora", nombre: "Grupo Aurora", nombreArchivo: "aurora.xlsx", unidadesConfirmadas: true });
  ok(r.ok === true, `el .xlsx sintético carga${r.ok ? "" : ` — ${r.bloqueos.map((b) => b.detalle).join(" · ")}`}`);
  ok(r.dataset.clientesVentas.length === 3 && r.dataset.clientesMargen.length === 3, "las dos hojas van a su eje (3 cuentas en cada uno)");

  const d = r.dataset;
  const textoDataset = JSON.stringify(d);
  const delDemo = TENANT_DEMO.clientesVentas.map((c) => c.nombre).filter((n) => n.length >= 4);
  const colados = delDemo.filter((n) => textoDataset.includes(n));
  ok(colados.length === 0, "el dataset ingestado NO trae una sola entidad del demo", colados.length ? `colados: ${colados.join(", ")}` : "");
  ok(d.id === "aurora" && d.nombre === "Grupo Aurora", "lleva SU id y SU nombre, no los del tenant que estaba activo");
  ok(d.MARCAS_ALL.join("|") === "Kolbe|Nordix", `los catálogos salen del propio archivo (${d.MARCAS_ALL.join(", ")})`);

  // y al activarlo, ADI reconoce SUS cuentas — y deja de reconocer las del demo
  initTenant(d);
  ok(getTenantId() === "aurora", "el dataset ingestado entra por la puerta del dato como cualquier tenant");
  ok(detectClientInText("cómo viene Ferretería Aurora") === "Ferretería Aurora", "ADI reconoce una cuenta DEL ARCHIVO");
  ok(detectClientInText("cómo viene Falabella") === null, "ADI ya NO reconoce una cuenta del demo — el vocabulario se re-armó con este dato");
  ok(!CLIENT_NAMES.some((n) => TENANT_DEMO.clientesVentas.some((c) => c.nombre === n)), "y el vocabulario del router no conserva ni un nombre del demo");

  /* ── HALLAZGO, dejado a la vista en vez de tapado (2026-08-21) ──────────────────────────────────────────────
   * El vocabulario del router se deriva de `clientesVentas` Y SOLO DE AHÍ. Un archivo que trae el margen por
   * cuenta pero no la venta del período carga bien —las cifras entran, la Mesa las usa— pero ADI se queda SIN
   * UNA SOLA CUENTA que reconocer por nombre: preguntar «cómo viene Ferretería Aurora» no matchea nada.
   * No es un bug de la ingesta: es el alcance de la derivación del router, y tocarlo es tocar el vocabulario de
   * entrada de ADI (autorización del owner). Se prueba acá el comportamiento ACTUAL para que quede medido y no
   * pueda cambiar en silencio; el día que se decida derivar también de `clientesMargen`, este assert se da vuelta
   * y avisa que hay que actualizarlo. */
  const soloMargen = ingestarLibro([
    "Cuenta,Ventas,Costo de venta,Margen %",
    "Ferretería Aurora,8000,5600,30",
  ].join("\n"), { id: "solomargen", nombre: "Solo margen", nombreArchivo: "m.csv", unidadesConfirmadas: true });
  ok(soloMargen.ok === true && soloMargen.dataset.clientesMargen.length === 1, "un archivo con SOLO margen por cuenta carga igual (las cifras entran)");
  initTenant(soloMargen.dataset);
  ok(CLIENT_NAMES.length === 0, "…pero HOY el router queda sin cuentas que reconocer: se deriva solo de clientesVentas (hallazgo declarado, pendiente del owner)");
}

/* ── [G] FORMA DE SENTRIX ──────────────────────────────────────────────────────────────────────────────────── */
H("[G] FORMA DE SENTRIX · el dataset tiene la forma que el store espera");
{
  const d = espejo.dataset;
  const faltan = LLAVES_DATASET.filter((k) => !(k in d));
  ok(faltan.length === 0, `trae las ${LLAVES_DATASET.length} llaves de un tenant`, faltan.length ? `faltan: ${faltan.join(", ")}` : "");
  ok(d.SUPERFAMILIAS[0] === "Todas", "el catálogo de familias respeta la convención de la UI («Todas» primero)");
  ok(d.marcasMargen.length === 0 && d.ventasKPI === null, "los agregados y los KPI quedan VACÍOS — no se inventan");
  ok(espejo.preview.ausentes.some((a) => /agregados por marca/.test(a.que)), "…y la preview los declara ausentes, con el costo de esa ausencia");
  ok(espejo.preview.ausentes.every((a) => a.que && a.costo), "cada ausencia dice QUÉ falta y QUÉ deja de poder responderse");

  initTenant(d);
  ok(tenantCargado() === true && getTenantId() === "espejo", "el dataset ingestado se activa sin romper la puerta del dato");
  const texto = previewEnTexto(espejo.preview);
  ok(texto.includes("LO QUE ENTRÓ") && texto.includes("LO QUE ESTE ARCHIVO NO TRAE"), "la preview en texto separa lo que entró de lo que falta");
}

/* ── [H] LA PREVIEW HUMANA ─────────────────────────────────────────────────────────────────────────────────
 * Las seis cosas que pidió el owner, en orden, y la sexta —qué partes de Sentrix quedan disponibles— contrastada
 * contra el dataset de referencia: con el tenant demo COMPLETO las cuatro caras tienen que abrir. Si alguna diera
 * roja ahí, el mapa de caras está mal, no el archivo. */
H("[H] LA PREVIEW HUMANA · las seis secciones, y la disponibilidad contrastada contra el demo");
{
  const texto = previewEnTexto(espejo.preview);
  const secciones = ["1 · HOJAS DETECTADAS", "2 · QUÉ ES CADA UNA", "3 · COLUMNAS MAPEADAS", "4 · CAMPOS AUSENTES",
    "5 · ERRORES QUE BLOQUEAN LA NORMALIZACIÓN", "6 · QUÉ PARTES DE SENTRIX QUEDAN DISPONIBLES"];
  for (const s of secciones) ok(texto.includes(s), `la preview trae la sección «${s}»`);
  ok(texto.indexOf("5 · ERRORES") < texto.indexOf("LO QUE ENTRÓ"), "los bloqueantes van ANTES de los totales (si no entra, el resto es ruido)");

  // el dataset de referencia: el demo entero. Las cuatro caras, completas.
  const dDemo = disponibilidadSentrix(TENANT_DEMO);
  ok(dDemo.caras.every((c) => c.completa), "con el tenant demo COMPLETO las cuatro caras dan completa",
    dDemo.caras.filter((c) => !c.completa).map((c) => `${c.cara}: falta ${c.falta.join(",")}`).join(" · "));
  ok(dDemo.resumen.metricasDisponibles === dDemo.resumen.metricasTotales,
    `y las ${dDemo.resumen.metricasTotales} métricas del contrato quedan disponibles (dio ${dDemo.resumen.metricasDisponibles})`);

  // el archivo del espejo trae clientes y SKU pero NO los agregados por marca/familia: esas métricas deben caer
  const dEsp = espejo.preview.disponibilidad;
  ok(dEsp.metricas.some((m) => m.clave === "ventas@cliente" && m.disponible), "ventas@cliente disponible (el archivo trajo la tabla)");
  ok(dEsp.metricas.some((m) => m.clave === "ventas@marca" && !m.disponible), "ventas@marca NO disponible (el archivo no trajo esa tabla)");
  const marca = dEsp.metricas.find((m) => m.clave === "ventas@marca");
  ok(/no trajo la tabla/.test(String(marca.motivo)), `…y el motivo lo dice con nombre: "${marca.motivo}"`);
  ok(dEsp.caras.find((c) => c.cara === "Comercial").completa === true, "la cara Comercial abre completa con este archivo");
  ok(dEsp.caras.find((c) => c.cara === "Capital").completa === true, "la cara Capital abre completa con este archivo");

  // una columna presente pero VACÍA no habilita nada — parece que sí, y esa es la trampa
  const conVacio = { ...TENANT_DEMO, skuInventario: TENANT_DEMO.skuInventario.map((r) => ({ ...r, stockUSD: null })) };
  const dVacio = disponibilidadSentrix(conVacio);
  const cap = dVacio.metricas.find((m) => m.clave === "capital@sku");
  ok(cap && cap.disponible === false, "una columna que vino en blanco NO habilita la métrica (aunque la tabla tenga filas)");
  ok(cap && /ninguna con/.test(String(cap.motivo)), `…y el motivo distingue «no vino la tabla» de «vino vacía»: "${cap.motivo}"`);

  // un archivo mínimo: solo inventario → Capital abre, Comercial no
  const soloInv = ingestarLibro(librosintetico([{ nombre: "Stock", filas: [
    ["Código SKU", "Bodega", "Stock valorizado", "Rotación", "Días de inventario", "Estado"],
    ["ZZ-1", "Central", 5000, 3, 40, "Activo"],
  ] }]), { id: "soloinv", nombre: "Solo inventario", nombreArchivo: "inv.xlsx", unidadesConfirmadas: true });
  ok(soloInv.ok === true, "un archivo de solo inventario carga");
  const cInv = soloInv.preview.disponibilidad.caras;
  ok(cInv.find((c) => c.cara === "Capital").disponible === true, "…y con él la cara Capital abre");
  ok(cInv.find((c) => c.cara === "Comercial").disponible === false, "…y la cara Comercial NO abre: se dice antes de que el usuario pregunte");
  ok(previewEnTexto(soloInv.preview).includes("✗ NO ABRE"), "la preview en texto lo muestra como «NO ABRE», no como un silencio");
}

initTenant(TENANT_DEMO);   // se deja el demo activo, como lo encontró
console.log(`\n${FAIL === 0 ? "✅" : "❌"} _ingesta_lectura_gate · ${PASS} ok · ${FAIL} fallas`);
process.exit(FAIL === 0 ? 0 : 1);
