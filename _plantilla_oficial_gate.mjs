/* === _plantilla_oficial_gate.mjs · LA INGESTA ES ABURRIDA, ESTRICTA Y CONTRACTUAL (v0 · 2026-08-22) ===========
 *
 * La regla central del owner: «ADI calcula. El usuario informa hechos. Si el usuario tiene que calcular margen,
 * benchmark o capital inmovilizado antes de subir el archivo, el diseño está mal.» Este gate prueba las dos
 * mitades: que el portero no deje pasar un KPI precalculado, y que el motor calcule solo con fórmulas declaradas.
 *
 * LA PRUEBA QUE SOSTIENE EL MOTOR [D]. Se toman las filas del tenant demo —que traen venta, costo y acciones— y
 * se le pide al motor que reconstruya margen, carga y contribución. Tienen que dar EXACTO contra los valores
 * declarados del propio demo. Si el motor inventara una fórmula «razonable pero distinta», esa comparación se
 * rompe. Es la diferencia entre decir «usamos las fórmulas del producto» y demostrarlo.
 *
 * SIETE PARTES:
 *   [A] la plantilla se genera del contrato · vacía y ejemplo · misma entrada, mismos bytes
 *   [B] el ejemplo pasa el portero entero y produce un dataset
 *   [C] EL PORTERO RECHAZA · columna calculada · unidad ambigua · duplicado contradictorio · clave faltante ·
 *       hoja de más · hoja obligatoria ausente · versión distinta · un Excel cualquiera
 *   [D] EL MOTOR · las fórmulas declaradas reproducen el dato de referencia, campo por campo
 *   [E] LO BLOQUEADO · rotación y días quedan en null CON motivo, y nada se rellena con un valor plausible
 *   [F] BENCHMARK · es parámetro, no columna: viaja al perfil del negocio y como columna se rechaza
 *   [G] LA PREVIEW · las cinco secciones, y la disponibilidad de Sentrix
 *
 * Determinístico · sin red · sin credenciales · sin modelo · sin dependencias nuevas.
 */
import { plantillaVacia, plantillaEjemplo, datosEjemplo, FILA_ENCABEZADO } from "./src/ingesta/plantilla/generarPlantilla.js";
import { validarPlantilla } from "./src/ingesta/plantilla/validarPlantilla.js";
import { calcularDataset, CALCULOS, BLOQUEADOS } from "./src/ingesta/plantilla/motorKpi.js";
import { ingestarPlantilla, previewPlantillaEnTexto } from "./src/ingesta/plantilla/ingestarPlantilla.js";
import { construirXlsx } from "./src/ingesta/escribirLibro.js";
import { HOJAS, PLANTILLA_VERSION } from "./src/config/contract/plantilla.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { initTenant, getTenantId } from "./src/data/tenantStore.js";
import { LLAVES_DATASET } from "./src/ingesta/normalizar.js";

let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ FALLO: " + m + (extra ? "\n      " + extra : "")); } };
const H = (t) => console.log("\n" + t + "\n" + "─".repeat(Math.min(100, t.length)));

const EJEMPLO = plantillaEjemplo();
const val = (buf) => validarPlantilla(buf, { nombreArchivo: "x.xlsx" });
/** rehace el .xlsx del ejemplo con una hoja modificada — para fabricar archivos rotos a propósito */
function ejemploCon(mutar) {
  const d = datosEjemplo();
  const hojas = HOJAS.map((h) => {
    if (h.tipo === "parametros") {
      const filas = [[`PLANTILLA OFICIAL ADI/SENTRIX · ${PLANTILLA_VERSION}`, "", "no borrar"], ["Parámetro", "Valor", "Qué es"],
        ...Object.entries(d.parametros).map(([k, v]) => [k, v, ""])];
      return { nombre: "Parametros", filas };
    }
    const cols = h.columnas.map((c) => c.titulo);
    const datos = ({ Productos: d.productos, Clientes: d.clientes, Ventas: d.ventas, Presupuesto: d.presupuesto, Inventario: d.inventario })[h.nombre] || [];
    return { nombre: h.nombre, filas: [[h.que], cols, ...datos.map((f) => h.columnas.map((c) => f[c.campo] ?? null))] };
  });
  mutar(hojas);
  return construirXlsx(hojas);
}
const hoja = (hojas, n) => hojas.find((h) => h.nombre === n);

/* ── [A] LA PLANTILLA SE GENERA DEL CONTRATO ───────────────────────────────────────────────────────────────── */
H("[A] LA PLANTILLA SE GENERA DEL CONTRATO · vacía y ejemplo");
{
  const vacia = plantillaVacia();
  ok(vacia.length > 2000 && vacia[0] === 0x50 && vacia[1] === 0x4b, `la plantilla vacía es un .xlsx real (${(vacia.length / 1024).toFixed(1)} KB)`);
  ok(Buffer.compare(plantillaVacia(), vacia) === 0, "generarla dos veces da los MISMOS bytes (determinística: un gate la puede comparar)");
  ok(Buffer.compare(plantillaEjemplo(), EJEMPLO) === 0, "el ejemplo también es determinístico");

  const v = val(vacia);
  ok(v.version === PLANTILLA_VERSION, `la vacía se identifica como plantilla ${v.version}`);
  ok(v.ok === false, "la vacía NO carga: le faltan los parámetros obligatorios (es un molde, no un dato)");
  ok(v.bloqueos.every((b) => b.tipo === "parametro-obligatorio-ausente"), "…y lo único que le falta son los parámetros, no la estructura",
    v.bloqueos.map((b) => b.tipo).join(" · "));

  // la plantilla trae TODAS las hojas y columnas del contrato, sin faltar ninguna
  const vv = validarPlantilla(vacia, { nombreArchivo: "v.xlsx" });
  for (const def of HOJAS.filter((h) => h.tipo === "tabla")) {
    const info = vv.hojas.find((h) => h.hoja === def.nombre);
    ok(info && info.presente && (info.titulos || []).filter(Boolean).length === def.columnas.length,
      `la hoja «${def.nombre}» trae sus ${def.columnas.length} columnas oficiales`);
  }
}

/* ── [B] EL EJEMPLO PASA ENTERO ────────────────────────────────────────────────────────────────────────────── */
H("[B] EL EJEMPLO SINTÉTICO PASA EL PORTERO Y PRODUCE DATASET");
const r = ingestarPlantilla(EJEMPLO, { nombreArchivo: "ejemplo.xlsx" });
ok(r.ok === true, `carga sin bloqueos${r.ok ? "" : " — " + r.preview.bloqueos.map((b) => b.detalle).join(" · ")}`);
{
  const d = r.dataset;
  const e = datosEjemplo();
  ok(d.id === "andes" && d.nombre === "Andes Distribución S.A.", "el dataset toma su identidad de los parámetros");
  ok(d.clientesVentas.length === e.clientes.length, `${d.clientesVentas.length} cuentas, las del archivo`);
  ok(d.skusMargen.length === e.productos.length, `${d.skusMargen.length} SKU, los del archivo`);
  ok(d.MARCAS_ALL.length === 3 && d.SUCURSALES.length === 2, `catálogos derivados del dato (${d.MARCAS_ALL.length} marcas · ${d.SUCURSALES.length} bodegas)`);
  ok(LLAVES_DATASET.every((k) => k in d), "trae todas las llaves de un tenant");
  // la venta del período sale de la suma de las filas de ESE período, no de todas
  const suma = e.ventas.filter((v) => v.periodo === "2026-08").reduce((s, v) => s + v.venta, 0);
  ok(d.ventasKPI.totalActual === suma, `la venta del período es la suma de sus filas (${d.ventasKPI.totalActual})`);
  ok(d.ventasMensuales.length === 2 && d.ventasMensuales[1].anterior === e.ventas.filter((v) => v.periodo === "2026-07").reduce((s, v) => s + v.venta, 0),
    "la serie mensual sale de los períodos informados, y el «anterior» es el período previo real");
}

/* ── [C] EL PORTERO RECHAZA ────────────────────────────────────────────────────────────────────────────────── */
H("[C] EL PORTERO · lo que NO entra, y el mensaje que da");
{
  // columna calculada: el caso que motivó todo el cambio de enfoque
  const conMargen = ejemploCon((hs) => { const h = hoja(hs, "Ventas"); h.filas[1] = [...h.filas[1], "Margen %"]; h.filas.slice(2).forEach((f) => f.push(28)); });
  const v1 = val(conMargen);
  ok(v1.ok === false, "una columna «Margen %» RECHAZA el archivo (no se ignora)");
  const b1 = v1.bloqueos.find((b) => b.tipo === "columna-calculada");
  ok(!!b1 && /Venta \(USD\) y Costo \(USD\)/.test(b1.detalle), `…y el mensaje dice qué mandar en su lugar: "${b1 && b1.detalle.slice(0, 120)}…"`);
  ok(v1.tablas && Object.keys(v1.tablas).length === 0, "…y no devuelve ni una fila: un archivo que no cumple no entrega datos a medias");

  for (const calc of ["Rotación", "Días de inventario", "Capital inmovilizado", "Contribución", "Carga comercial", "Benchmark", "Costo unitario"]) {
    const b = val(ejemploCon((hs) => { const h = hoja(hs, "Inventario"); h.filas[1] = [...h.filas[1], calc]; h.filas.slice(2).forEach((f) => f.push(1)); }));
    ok(b.ok === false && b.bloqueos.some((x) => x.tipo === "columna-calculada"), `«${calc}» también se rechaza como columna calculada`);
  }

  // unidad ambigua: el título sin su unidad NO es un sinónimo, es una duda
  const sinUnidad = ejemploCon((hs) => { const h = hoja(hs, "Ventas"); h.filas[1] = h.filas[1].map((t) => (t === "Venta (USD)" ? "Venta" : t)); });
  const v2 = val(sinUnidad);
  ok(v2.ok === false && v2.bloqueos.some((b) => b.tipo === "unidad-ambigua"), '"Venta" sin unidad se trata como AMBIGUA, no como sinónimo de "Venta (USD)"');

  // duplicado contradictorio vs idéntico
  const dupDistinto = ejemploCon((hs) => { const h = hoja(hs, "Ventas"); const f = [...h.filas[2]]; f[5] = 99999; h.filas.push(f); });
  ok(val(dupDistinto).bloqueos.some((b) => b.tipo === "duplicado-contradictorio"), "misma clave con distinto valor → BLOQUEA");
  const dupIgual = ejemploCon((hs) => { const h = hoja(hs, "Ventas"); h.filas.push([...h.filas[2]]); });
  const v3 = val(dupIgual);
  ok(v3.ok === true && v3.avisos.some((a) => a.tipo === "fila-duplicada-identica"), "misma clave con el mismo valor → se colapsa y se avisa");

  // clave faltante
  const sinCliente = ejemploCon((hs) => { const h = hoja(hs, "Ventas"); h.filas[2][1] = null; });
  ok(val(sinCliente).bloqueos.some((b) => b.tipo === "celda-obligatoria-vacia"), "una fila sin cliente no se puede atribuir: bloquea");

  // estructura
  ok(val(ejemploCon((hs) => hs.push({ nombre: "Mis notas", filas: [["a"], ["b"]] }))).bloqueos.some((b) => b.tipo === "hoja-de-mas"), "una hoja de más rechaza el archivo");
  ok(val(ejemploCon((hs) => { const i = hs.findIndex((h) => h.nombre === "Ventas"); hs.splice(i, 1); })).bloqueos.some((b) => b.tipo === "hoja-obligatoria-ausente"), "sin la hoja Ventas no hay negocio que leer: bloquea");
  ok(val(ejemploCon((hs) => { hoja(hs, "Parametros").filas[0][0] = "PLANTILLA OFICIAL ADI/SENTRIX · v9"; })).bloqueos.some((b) => b.tipo === "version-distinta"), "una plantilla de otra versión se rechaza nombrando las dos versiones");
  const cualquiera = construirXlsx([{ nombre: "Hoja1", filas: [["Cliente", "Venta"], ["Uno", 100]] }]);
  const v4 = val(cualquiera);
  ok(v4.ok === false && v4.bloqueos.some((b) => b.tipo === "no-es-la-plantilla"), "un Excel cualquiera NO entra: este flujo acepta la plantilla oficial y nada más");
  ok(/descargá la plantilla oficial/.test(v4.bloqueos[0].detalle), "…y le dice al usuario qué hacer, en vez de un «formato inválido»");

  // tipos
  ok(val(ejemploCon((hs) => { hoja(hs, "Ventas").filas[2][4] = "muchas"; })).bloqueos.some((b) => b.tipo === "valor-no-numerico"), "un texto donde va un número bloquea, con la fila nombrada");
  ok(val(ejemploCon((hs) => { hoja(hs, "Ventas").filas[2][0] = "agosto"; })).bloqueos.some((b) => b.tipo === "periodo-mal-escrito"), "un período mal escrito bloquea, y dice el formato esperado");
}

/* ── [D] EL MOTOR · las fórmulas declaradas, contra el dato de referencia ──────────────────────────────────── */
H("[D] EL MOTOR · reproduce el dato de referencia con las fórmulas DECLARADAS");
{
  // se arma una plantilla con los HECHOS del demo (venta, costo, acciones por cuenta) y se le pide al motor
  // que reconstruya lo que el demo declara. Si el motor inventara una fórmula distinta, esto se rompe.
  const ventas = TENANT_DEMO.clientesMargen.map((c) => ({ periodo: "2026-08", cliente: c.nombre, sku: `SKU-${c.nombre}`, bodega: "U",
    unidades: c.unidades, venta: c.venta, costo: c.costo, acciones: c.rebates }));
  const productos = TENANT_DEMO.clientesMargen.map((c) => ({ sku: `SKU-${c.nombre}`, marca: c.marca, sfamilia: c.sfamilia, precioLista: null }));
  const m = calcularDataset({ parametros: { empresa_id: "ref", empresa_nombre: "Referencia", periodo_actual: "2026-08", moneda: "USD", benchmark: 30.1 },
    tablas: { Ventas: ventas, Productos: productos, Clientes: [], Presupuesto: [], Inventario: [] } });

  let peorM = 0, peorC = 0, peorK = 0, ejemplo = "";
  for (const decl of TENANT_DEMO.clientesMargen) {
    const calc = m.dataset.clientesMargen.find((x) => x.nombre === decl.nombre);
    if (!calc) { ok(false, `falta la cuenta ${decl.nombre} en lo calculado`); continue; }
    const dM = Math.abs(calc.margen - decl.margen), dC = Math.abs(calc.pctRebate - decl.pctRebate), dK = Math.abs(calc.contribucion - decl.contribucion);
    if (dM > peorM) { peorM = dM; ejemplo = `${decl.nombre}: margen ${calc.margen} vs ${decl.margen}`; }
    peorC = Math.max(peorC, dC); peorK = Math.max(peorK, dK);
  }
  ok(peorC <= 0.1, `carga comercial: desvío máx ${peorC} pp en ${TENANT_DEMO.clientesMargen.length} cuentas (tolerancia declarada 0.1 pp)`);
  ok(peorM <= 0.1, `margen: desvío máx ${peorM} pp (tolerancia declarada 0.1 pp)`, ejemplo);
  ok(peorK <= 1, `contribución: desvío máx $${peorK} (tolerancia declarada $1K)`);
  ok(m.dataset.clientesMargen.every((c) => c.benchmark === 30.1), "el benchmark de cada fila sale del PARÁMETRO del negocio, no de una columna");

  // el rollup a marca/familia: suma de sus SKU, como declara el contrato
  const sumaMarca = new Map();
  for (const v of ventas) { const k = productos.find((p) => p.sku === v.sku).marca; sumaMarca.set(k, (sumaMarca.get(k) || 0) + v.venta); }
  const okRollup = m.dataset.marcasMargen.every((x) => Math.abs(x.venta - sumaMarca.get(x.nombre)) <= 1);
  ok(okRollup, `las tablas por marca son la suma de sus SKU (${m.dataset.marcasMargen.length} marcas)`);

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
  const lento = inv.find((s) => s.sku === "SAN-LAV60");
  ok(lento && lento.diasSinVenta > 100, `los días sin venta SÍ se calculan (resta de dos fechas informadas): ${lento && lento.diasSinVenta} días`);
  ok(r.dataset.invKPI && r.dataset.invKPI.totalUSD > 0 && r.dataset.invKPI.inmovilizadoUSD === null, "el capital total sí; el inmovilizado no");
  for (const id of ["rotacion", "doh", "diagnosticoCapital"]) {
    const b = BLOQUEADOS.find((x) => x.id === id);
    ok(!!b && !!b.porque && !!b.paraAbrirlo, `«${id}» está declarado bloqueado, con motivo y con qué haría falta para abrirlo`);
  }
  ok(r.dataset.SCENARIO_TRANSFORMS && Object.keys(r.dataset.SCENARIO_TRANSFORMS).length === 0, "los escenarios quedan vacíos: son un supuesto del negocio, no un hecho");
}

/* ── [F] EL BENCHMARK ES PARÁMETRO ─────────────────────────────────────────────────────────────────────────── */
H("[F] EL BENCHMARK · parámetro del negocio, jamás columna");
{
  ok(r.dataset.perfil.benchmark === 28.0, `el benchmark declarado viaja al perfil del negocio (${r.dataset.perfil.benchmark})`);
  ok(r.dataset.clientesMargen.every((c) => c.benchmark === 28.0), "…y cada fila lo lleva desde ahí, no desde una columna del archivo");
  const conCol = val(ejemploCon((hs) => { const h = hoja(hs, "Ventas"); h.filas[1] = [...h.filas[1], "Benchmark"]; h.filas.slice(2).forEach((f) => f.push(30)); }));
  ok(conCol.bloqueos.some((b) => b.tipo === "columna-calculada" && /Parametros/.test(b.detalle)), "como columna se rechaza, y remite a la hoja Parametros");

  const sinBench = ejemploCon((hs) => { const h = hoja(hs, "Parametros"); h.filas = h.filas.filter((f) => f[0] !== "benchmark"); });
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

  const roto = previewPlantillaEnTexto(ingestarPlantilla(ejemploCon((hs) => { const h = hoja(hs, "Ventas"); h.filas[1] = [...h.filas[1], "Margen %"]; }), { nombreArchivo: "r.xlsx" }).preview);
  ok(/EL ARCHIVO NO SE CARGÓ/.test(roto), "cuando no entra, la preview lo dice arriba y no muestra totales de nada");
}

/* ── el dataset entra por la puerta del dato, como cualquier tenant ────────────────────────────────────────── */
initTenant(r.dataset);
ok(getTenantId() === "andes", "el dataset calculado se activa como tenant sin romper nada");
initTenant(TENANT_DEMO);

console.log(`\n${FAIL === 0 ? "✅" : "❌"} _plantilla_oficial_gate · ${PASS} ok · ${FAIL} fallas`);
process.exit(FAIL === 0 ? 0 : 1);
