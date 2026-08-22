/* === _plantilla_oficial_gate.mjs · LA INGESTA ES ABURRIDA, ESTRICTA Y CONTRACTUAL (v1 · 2026-08-22) ===========
 *
 * La regla central del owner: «ADI calcula. El usuario informa hechos. Si el usuario tiene que calcular margen,
 * benchmark o capital inmovilizado antes de subir el archivo, el diseño está mal.» Este gate prueba las dos
 * mitades: que el portero no deje pasar un KPI precalculado, y que el motor calcule solo con fórmulas declaradas.
 *
 * v1 (owner, 2026-08-22): DOS hojas para llenar — `Ventas` (con la cabecera del negocio arriba) e `Inventario`.
 * Los maestros de productos y clientes salieron: son trabajo de sistema, y cuando ADI se conecte a un ERP van a
 * llegar de ahí. El precio de esa decisión es que la marca de un SKU se repite en cada fila, y por eso [H] existe.
 *
 * LA PRUEBA QUE SOSTIENE EL MOTOR [D]. Se toman las filas del tenant demo —que traen venta, costo y acciones— y se
 * le pide al motor que reconstruya margen, carga y contribución. Tienen que dar EXACTO contra los valores que el
 * demo declara. Si el motor inventara una fórmula «razonable pero distinta», esa comparación se rompe. Es la
 * diferencia entre decir «usamos las fórmulas del producto» y demostrarlo.
 *
 * OCHO PARTES:
 *   [A] la plantilla se genera del contrato · dos hojas · misma entrada, mismos bytes
 *   [B] el ejemplo pasa el portero entero y produce un dataset
 *   [C] EL PORTERO RECHAZA · columna calculada · unidad ambigua · duplicado contradictorio · clave faltante ·
 *       hoja de más · hoja obligatoria ausente · versión distinta · un Excel cualquiera
 *   [D] EL MOTOR · las fórmulas declaradas reproducen el dato de referencia, campo por campo
 *   [E] LO BLOQUEADO · rotación y días en null CON motivo, y nada relleno con un valor plausible
 *   [F] BENCHMARK · parámetro en la cabecera, jamás columna
 *   [G] LA PREVIEW · las secciones, y la disponibilidad de Sentrix
 *   [H] COHERENCIA · el mismo SKU con dos marcas distintas no se resuelve eligiendo: se rechaza nombrando las filas
 *
 * Determinístico · sin red · sin credenciales · sin modelo · sin dependencias nuevas.
 */
import { plantillaVacia, plantillaEjemplo, datosEjemplo } from "./src/ingesta/plantilla/generarPlantilla.js";
import { validarPlantilla } from "./src/ingesta/plantilla/validarPlantilla.js";
import { calcularDataset, CALCULOS, BLOQUEADOS } from "./src/ingesta/plantilla/motorKpi.js";
import { ingestarPlantilla, previewPlantillaEnTexto } from "./src/ingesta/plantilla/ingestarPlantilla.js";
import { construirXlsx } from "./src/ingesta/escribirLibro.js";
import { HOJAS, PARAMETROS, PLANTILLA_VERSION, MARCA_PLANTILLA } from "./src/config/contract/plantilla.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { initTenant, getTenantId } from "./src/data/tenantStore.js";
import { LLAVES_DATASET } from "./src/ingesta/normalizar.js";

let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ FALLO: " + m + (extra ? "\n      " + extra : "")); } };
const H = (t) => console.log("\n" + t + "\n" + "─".repeat(Math.min(100, t.length)));

const EJEMPLO = plantillaEjemplo();
const val = (buf) => validarPlantilla(buf, { nombreArchivo: "x.xlsx" });

/** rehace el .xlsx del ejemplo con las hojas mutadas — para fabricar archivos rotos a propósito */
function ejemploCon(mutar) {
  const d = datosEjemplo();
  const hojas = HOJAS.map((def) => {
    const datos = ({ Ventas: d.ventas, Inventario: d.inventario })[def.nombre] || [];
    const cabecera = def.conCabecera
      ? [[MARCA_PLANTILLA, "", ""], ["", "", ""], ["Parámetro", "Valor", "Qué es"],
         ...PARAMETROS.map((p) => [p.clave, d.parametros[p.clave] ?? null, ""]), ["", "", ""]]
      : [];
    return { nombre: def.nombre, filas: [...cabecera, [def.que], def.columnas.map((c) => c.titulo), ...datos.map((f) => def.columnas.map((c) => f[c.campo] ?? null))] };
  });
  mutar(hojas);
  return construirXlsx(hojas);
}
const hoja = (hojas, n) => hojas.find((h) => h.nombre === n);
/** el índice de la fila de encabezados dentro de las filas fabricadas por `ejemploCon` */
const iEnc = (h) => h.filas.findIndex((f) => (f || [])[0] === HOJAS.find((d) => d.nombre === h.nombre).columnas[0].titulo);

/* ── [A] LA PLANTILLA SE GENERA DEL CONTRATO ───────────────────────────────────────────────────────────────── */
H("[A] LA PLANTILLA SE GENERA DEL CONTRATO · dos hojas para llenar");
{
  const vacia = plantillaVacia();
  ok(vacia.length > 1500 && vacia[0] === 0x50 && vacia[1] === 0x4b, `la plantilla vacía es un .xlsx real (${(vacia.length / 1024).toFixed(1)} KB)`);
  ok(Buffer.compare(plantillaVacia(), vacia) === 0, "generarla dos veces da los MISMOS bytes (determinística)");
  ok(Buffer.compare(plantillaEjemplo(), EJEMPLO) === 0, "el ejemplo también es determinístico");
  ok(HOJAS.length === 2 && HOJAS[0].nombre === "Ventas" && HOJAS[1].nombre === "Inventario", "el contrato declara DOS hojas: Ventas e Inventario");
  ok(HOJAS[0].conCabecera === true && !HOJAS[1].conCabecera, "la cabecera del negocio vive dentro de Ventas, no en una pestaña aparte");

  const v = val(vacia);
  ok(v.version === PLANTILLA_VERSION, `la vacía se identifica como plantilla ${v.version}`);
  ok(v.ok === false, "la vacía NO carga: le faltan los parámetros obligatorios (es un molde, no un dato)");
  ok(v.bloqueos.every((b) => b.tipo === "parametro-obligatorio-ausente"), "…y lo único que le falta son los parámetros, no la estructura",
    v.bloqueos.map((b) => b.tipo).join(" · "));
  for (const def of HOJAS) {
    const info = v.hojas.find((h) => h.hoja === def.nombre);
    ok(info && info.presente && (info.titulos || []).filter(Boolean).length === def.columnas.length,
      `la hoja «${def.nombre}» trae sus ${def.columnas.length} columnas oficiales`);
  }
}

/* ── [B] EL EJEMPLO PASA ENTERO ────────────────────────────────────────────────────────────────────────────── */
H("[B] EL EJEMPLO SINTÉTICO PASA EL PORTERO Y PRODUCE DATASET");
const r = ingestarPlantilla(EJEMPLO, { nombreArchivo: "ejemplo.xlsx" });
ok(r.ok === true, `carga sin bloqueos${r.ok ? "" : " — " + r.preview.bloqueos.map((b) => b.detalle).join(" · ")}`);
{
  const d = r.dataset, e = datosEjemplo();
  const cuentas = new Set(e.ventas.map((v) => v.cliente)).size, skus = new Set(e.ventas.map((v) => v.sku)).size;
  ok(d.id === "andes" && d.nombre === "Andes Distribución S.A.", "el dataset toma su identidad de la cabecera");
  ok(d.clientesVentas.length === cuentas, `${d.clientesVentas.length} cuentas, reconstruidas de las filas de venta`);
  ok(d.skusMargen.length === skus, `${d.skusMargen.length} SKU, reconstruidos de las filas de venta`);
  ok(d.MARCAS_ALL.length === 3 && d.SUCURSALES.length === 2, `marca, familia y bodega salen de las columnas (${d.MARCAS_ALL.length} marcas · ${d.SUCURSALES.length} bodegas)`);
  ok(d.clientesVentas.every((c) => c.canal), "el canal de cada cuenta sale de su columna, sin hoja de clientes");
  ok(d.skusMargen.every((s) => s.marca && s.sfamilia), "la marca y la familia de cada SKU salen de sus columnas, sin hoja de productos");
  ok(LLAVES_DATASET.every((k) => k in d), "trae todas las llaves de un tenant");
  const suma = e.ventas.filter((v) => v.periodo === "2026-08").reduce((s, v) => s + v.venta, 0);
  ok(d.ventasKPI.totalActual === suma, `la venta del período es la suma de sus filas (${d.ventasKPI.totalActual})`);
  ok(d.ventasMensuales.length === 2, "la serie mensual sale de los períodos informados");
}

/* ── [C] EL PORTERO RECHAZA ────────────────────────────────────────────────────────────────────────────────── */
H("[C] EL PORTERO · lo que NO entra, y el mensaje que da");
{
  const conMargen = ejemploCon((hs) => { const h = hoja(hs, "Ventas"); const i = iEnc(h); h.filas[i] = [...h.filas[i], "Margen %"]; h.filas.slice(i + 1).forEach((f) => f.push(28)); });
  const v1 = val(conMargen);
  ok(v1.ok === false, "una columna «Margen %» RECHAZA el archivo (no se ignora)");
  const b1 = v1.bloqueos.find((b) => b.tipo === "columna-calculada");
  ok(!!b1 && /Venta \(USD\) y Costo \(USD\)/.test(b1.detalle), "…y el mensaje dice qué mandar en su lugar");
  ok(Object.keys(v1.tablas).length === 0, "…y no devuelve ni una fila: un archivo que no cumple no entrega datos a medias");

  for (const calc of ["Rotación", "Días de inventario", "Capital inmovilizado", "Contribución", "Carga comercial", "Benchmark", "Costo unitario", "Presupuesto"]) {
    const b = val(ejemploCon((hs) => { const h = hoja(hs, "Inventario"); const i = iEnc(h); h.filas[i] = [...h.filas[i], calc]; h.filas.slice(i + 1).forEach((f) => f.push(1)); }));
    ok(b.bloqueos.some((x) => x.tipo === "columna-calculada"), `«${calc}» se rechaza como columna calculada`);
  }

  const sinUnidad = ejemploCon((hs) => { const h = hoja(hs, "Ventas"); const i = iEnc(h); h.filas[i] = h.filas[i].map((t) => (t === "Venta (USD)" ? "Venta" : t)); });
  ok(val(sinUnidad).bloqueos.some((b) => b.tipo === "unidad-ambigua"), '"Venta" sin unidad se trata como AMBIGUA, no como sinónimo de "Venta (USD)"');

  const dupDistinto = ejemploCon((hs) => { const h = hoja(hs, "Ventas"); const i = iEnc(h); const f = [...h.filas[i + 1]]; f[8] = 99999; h.filas.push(f); });
  ok(val(dupDistinto).bloqueos.some((b) => b.tipo === "duplicado-contradictorio"), "misma clave con distinto valor → BLOQUEA");
  const dupIgual = ejemploCon((hs) => { const h = hoja(hs, "Ventas"); h.filas.push([...h.filas[iEnc(h) + 1]]); });
  const v3 = val(dupIgual);
  ok(v3.ok === true && v3.avisos.some((a) => a.tipo === "fila-duplicada-identica"), "misma clave con el mismo valor → se colapsa y se avisa");

  ok(val(ejemploCon((hs) => { const h = hoja(hs, "Ventas"); h.filas[iEnc(h) + 1][1] = null; })).bloqueos.some((b) => b.tipo === "celda-obligatoria-vacia"), "una fila sin cliente no se puede atribuir: bloquea");
  ok(val(ejemploCon((hs) => hs.push({ nombre: "Mis notas", filas: [["a"]] }))).bloqueos.some((b) => b.tipo === "hoja-de-mas"), "una hoja de más rechaza el archivo");
  ok(val(ejemploCon((hs) => { hs.splice(hs.findIndex((h) => h.nombre === "Ventas"), 1); })).bloqueos.some((b) => b.tipo === "no-es-la-plantilla"), "sin la hoja Ventas no hay plantilla que validar");
  ok(val(ejemploCon((hs) => { hoja(hs, "Ventas").filas[0][0] = "PLANTILLA OFICIAL ADI/SENTRIX · v0"; })).bloqueos.some((b) => b.tipo === "version-distinta"), "una plantilla de otra versión se rechaza nombrando las dos");

  const cualquiera = construirXlsx([{ nombre: "Hoja1", filas: [["Cliente", "Venta"], ["Uno", 100]] }]);
  const v4 = val(cualquiera);
  ok(v4.ok === false && v4.bloqueos.some((b) => b.tipo === "no-es-la-plantilla"), "un Excel cualquiera NO entra");
  ok(/descargá la plantilla oficial/.test(v4.bloqueos[0].detalle), "…y le dice al usuario qué hacer, en vez de un «formato inválido»");

  ok(val(ejemploCon((hs) => { const h = hoja(hs, "Ventas"); h.filas[iEnc(h) + 1][7] = "muchas"; })).bloqueos.some((b) => b.tipo === "valor-no-numerico"), "un texto donde va un número bloquea, con la fila nombrada");
  ok(val(ejemploCon((hs) => { const h = hoja(hs, "Ventas"); h.filas[iEnc(h) + 1][0] = "agosto"; })).bloqueos.some((b) => b.tipo === "periodo-mal-escrito"), "un período mal escrito bloquea, y dice el formato esperado");
  ok(val(ejemploCon((hs) => { const h = hoja(hs, "Ventas"); const i = iEnc(h); h.filas[i][0] = "Periodo"; })).bloqueos.some((b) => b.tipo === "encabezado-no-encontrado"), "si alguien reescribe el título de la primera columna, se dice que no se encuentra el encabezado");
}

/* ── [D] EL MOTOR ──────────────────────────────────────────────────────────────────────────────────────────── */
H("[D] EL MOTOR · reproduce el dato de referencia con las fórmulas DECLARADAS");
{
  const ventas = TENANT_DEMO.clientesMargen.map((c) => ({ periodo: "2026-08", cliente: c.nombre, canal: null, sku: `SKU-${c.nombre}`,
    marca: c.marca, sfamilia: c.sfamilia, bodega: "U", unidades: c.unidades, venta: c.venta, costo: c.costo, acciones: c.rebates, precioLista: null }));
  const m = calcularDataset({ parametros: { empresa_id: "ref", empresa_nombre: "Referencia", periodo_actual: "2026-08", moneda: "USD", benchmark: 30.1 },
    tablas: { Ventas: ventas, Inventario: [] } });

  let peorM = 0, peorC = 0, peorK = 0, ejemplo = "";
  for (const decl of TENANT_DEMO.clientesMargen) {
    const calc = m.dataset.clientesMargen.find((x) => x.nombre === decl.nombre);
    if (!calc) { ok(false, `falta la cuenta ${decl.nombre}`); continue; }
    const dM = Math.abs(calc.margen - decl.margen);
    if (dM > peorM) { peorM = dM; ejemplo = `${decl.nombre}: margen ${calc.margen} vs ${decl.margen}`; }
    peorC = Math.max(peorC, Math.abs(calc.pctRebate - decl.pctRebate));
    peorK = Math.max(peorK, Math.abs(calc.contribucion - decl.contribucion));
  }
  ok(peorC <= 0.1, `carga comercial: desvío máx ${peorC} pp en ${TENANT_DEMO.clientesMargen.length} cuentas (tolerancia 0.1 pp)`);
  ok(peorM <= 0.1, `margen: desvío máx ${peorM} pp (tolerancia 0.1 pp)`, ejemplo);
  ok(peorK <= 1, `contribución: desvío máx $${peorK} (tolerancia $1K)`);
  ok(m.dataset.clientesMargen.every((c) => c.benchmark === 30.1), "el benchmark de cada fila sale del PARÁMETRO, no de una columna");

  const sumaMarca = new Map();
  for (const v of ventas) sumaMarca.set(v.marca, (sumaMarca.get(v.marca) || 0) + v.venta);
  ok(m.dataset.marcasMargen.every((x) => Math.abs(x.venta - sumaMarca.get(x.nombre)) <= 1), `las tablas por marca son la suma de sus SKU (${m.dataset.marcasMargen.length} marcas)`);
  ok(CALCULOS.every((c) => c.que && c.formula && c.fuente), "cada cálculo declara qué hace, con qué fórmula y qué lo autoriza");
}

/* ── [E] LO BLOQUEADO ──────────────────────────────────────────────────────────────────────────────────────── */
H("[E] LO BLOQUEADO · en null, con motivo, y sin rellenar con nada plausible");
{
  const inv = r.dataset.skuInventario;
  ok(inv.length === 6, `el inventario entró como hechos (${inv.length} filas)`);
  ok(inv.every((s) => typeof s.stockUSD === "number" && typeof s.stockUnd === "number"), "stock valorizado y unidades son hechos: entran");
  ok(inv.every((s) => s.rotacion === null && s.doh === null), "rotación y días quedan en NULL — no se inventan");
  ok(inv.every((s) => s.estado === null && s.alerta === null), "el estado del SKU tampoco: sale de rotación y días, que están bloqueadas");
  ok(inv.every((s) => s.marca && s.sfamilia), "el inventario hereda marca y familia de las filas de venta del mismo SKU");
  const lento = inv.find((s) => s.sku === "SAN-LAV60");
  ok(lento && lento.diasSinVenta > 100, `los días sin venta SÍ se calculan (resta de dos fechas informadas): ${lento && lento.diasSinVenta} días`);
  ok(r.dataset.invKPI && r.dataset.invKPI.totalUSD > 0 && r.dataset.invKPI.inmovilizadoUSD === null, "el capital total sí; el inmovilizado no");
  ok(r.dataset.clientesVentas.every((c) => c.presupuesto === null), "el presupuesto queda en null: salió de la v1 y está declarado como bloqueado");
  for (const id of ["rotacion", "doh", "diagnosticoCapital", "presupuesto"]) {
    const b = BLOQUEADOS.find((x) => x.id === id);
    ok(!!b && !!b.porque && !!b.paraAbrirlo, `«${id}» está declarado bloqueado, con motivo y con qué haría falta para abrirlo`);
  }
}

/* ── [F] EL BENCHMARK ES PARÁMETRO ─────────────────────────────────────────────────────────────────────────── */
H("[F] EL BENCHMARK · parámetro de la cabecera, jamás columna");
{
  ok(r.dataset.perfil.benchmark === 28.0, `el benchmark declarado viaja al perfil del negocio (${r.dataset.perfil.benchmark})`);
  ok(r.dataset.clientesMargen.every((c) => c.benchmark === 28.0), "…y cada fila lo lleva desde ahí");
  const conCol = val(ejemploCon((hs) => { const h = hoja(hs, "Ventas"); const i = iEnc(h); h.filas[i] = [...h.filas[i], "Benchmark"]; h.filas.slice(i + 1).forEach((f) => f.push(30)); }));
  ok(conCol.bloqueos.some((b) => b.tipo === "columna-calculada" && /cabecera/.test(b.detalle)), "como columna se rechaza, y remite a la cabecera");

  const sinBench = ejemploCon((hs) => { const h = hoja(hs, "Ventas"); h.filas = h.filas.filter((f) => f[0] !== "benchmark"); });
  const v = ingestarPlantilla(sinBench, { nombreArchivo: "s.xlsx" });
  ok(v.ok === true, "sin benchmark declarado el archivo IGUAL carga (es opcional)");
  ok(v.preview.avisos.some((a) => a.tipo === "benchmark-sin-declarar"), "…y se avisa que ADI usa su referencia general, en vez de inventarle una vara");
}

/* ── [G] LA PREVIEW ────────────────────────────────────────────────────────────────────────────────────────── */
H("[G] LA PREVIEW HUMANA");
{
  const t = previewPlantillaEnTexto(r.preview);
  for (const s of ["1 · QUÉ DATOS RECIBIÓ", "2 · QUÉ CALCULA ADI CON ESTO", "3 · QUÉ NO CALCULA, Y QUÉ HARÍA FALTA", "4 · QUÉ PARTES DE SENTRIX QUEDAN DISPONIBLES"])
    ok(t.includes(s), `la preview trae «${s}»`);
  ok(t.includes("autoriza:") && t.includes("comprobado:"), "cada cálculo muestra QUÉ lo autoriza y con qué medición se comprobó");
  ok(t.includes("para abrirlo:"), "cada bloqueo dice qué haría falta para abrirlo");

  const d = r.preview.disponibilidad;
  ok(d.caras.find((c) => c.cara === "Comercial").completa === true, "con el ejemplo, la cara Comercial abre completa");
  ok(d.caras.find((c) => c.cara === "Capital").completa === false, "…y Capital queda PARCIAL: el capital sí, el diagnóstico no");
  ok(d.caras.find((c) => c.cara === "Capital").falta.join(" ").includes("rotacion"), "…y nombra rotación como lo que falta");

  const roto = previewPlantillaEnTexto(ingestarPlantilla(ejemploCon((hs) => { const h = hoja(hs, "Ventas"); h.filas[iEnc(h)] = [...h.filas[iEnc(h)], "Margen %"]; }), { nombreArchivo: "r.xlsx" }).preview);
  ok(/EL ARCHIVO NO SE CARGÓ/.test(roto), "cuando no entra, la preview lo dice arriba y no muestra totales de nada");
}

/* ── [H] COHERENCIA · el precio de colapsar los maestros ───────────────────────────────────────────────────── */
H("[H] COHERENCIA · el mismo SKU con dos marcas no se resuelve eligiendo");
{
  const dosMarcas = ejemploCon((hs) => { const h = hoja(hs, "Ventas"); const i = iEnc(h); h.filas[i + 2][4] = "OtraMarca"; });
  const v = val(dosMarcas);
  ok(v.ok === false && v.bloqueos.some((b) => b.tipo === "atributo-incoherente"), "el mismo SKU con dos marcas distintas RECHAZA el archivo");
  const b = v.bloqueos.find((x) => x.tipo === "atributo-incoherente");
  ok(/fila \d+/.test(b.detalle) && /OtraMarca/.test(b.detalle), `…y nombra las dos filas que se contradicen: "${b.detalle.slice(0, 130)}…"`);
  ok(/no se elige una/.test(b.detalle), "…y dice explícitamente que no elige una: lo corrige el usuario");

  const dosCanales = ejemploCon((hs) => { const h = hoja(hs, "Ventas"); const i = iEnc(h); h.filas[i + 2][2] = "Mayorista"; });
  ok(val(dosCanales).bloqueos.some((x) => x.tipo === "atributo-incoherente"), "el mismo cliente con dos canales distintos también se rechaza");

  // el caso legítimo: un atributo vacío en una fila y presente en otra NO es una contradicción
  const unoVacio = ejemploCon((hs) => { const h = hoja(hs, "Ventas"); const i = iEnc(h); h.filas[i + 2][4] = null; });
  const vv = val(unoVacio);
  ok(vv.bloqueos.every((x) => x.tipo !== "atributo-incoherente"), "una celda vacía NO es una contradicción: se toma el valor de la otra fila");
}

initTenant(r.dataset);
ok(getTenantId() === "andes", "el dataset calculado se activa como tenant sin romper nada");
initTenant(TENANT_DEMO);

console.log(`\n${FAIL === 0 ? "✅" : "❌"} _plantilla_oficial_gate · ${PASS} ok · ${FAIL} fallas`);
process.exit(FAIL === 0 ? 0 : 1);
