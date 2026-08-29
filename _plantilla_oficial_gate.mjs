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
 *   [E] DÍAS Y ROTACIÓN · informado manda, calculado rellena, procedencia con el valor, y el caso trampa
 *   [F] BENCHMARK · parámetro en la cabecera, jamás columna
 *   [G] LA PREVIEW · las secciones, y la disponibilidad de Sentrix
 *   [H] COHERENCIA · el mismo SKU con dos marcas distintas no se resuelve eligiendo: se rechaza nombrando las filas
 *
 * Determinístico · sin red · sin credenciales · sin modelo · sin dependencias nuevas.
 */
import { plantillaVacia, plantillaEjemplo, datosEjemplo, hojasDeLaPlantilla } from "./src/ingesta/plantilla/generarPlantilla.js";
import { validarPlantilla } from "./src/ingesta/plantilla/validarPlantilla.js";
import { calcularDataset, CALCULOS, BLOQUEADOS } from "./src/ingesta/plantilla/motorKpi.js";
import { ingestarPlantilla, previewPlantillaEnTexto } from "./src/ingesta/plantilla/ingestarPlantilla.js";
import { CASOS } from "./src/ingesta/plantilla/casosPrueba.js";
import { construirXlsx, ESTILO } from "./src/ingesta/escribirLibro.js";
import { leerLibro } from "./src/ingesta/leerLibro.js";
import { HOJAS, PARAMETROS, PLANTILLA_VERSION, MARCA_PLANTILLA, COLUMNAS_PROHIBIDAS, HOJA_EMPRESA, HOJA_EJEMPLO } from "./src/config/contract/plantilla.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { initTenant, getTenantId } from "./src/data/tenantStore.js";
import { LLAVES_DATASET } from "./src/ingesta/normalizar.js";

let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ FALLO: " + m + (extra ? "\n      " + extra : "")); } };
const H = (t) => console.log("\n" + t + "\n" + "─".repeat(Math.min(100, t.length)));

import { readFileSync } from "node:fs";
/** Las filas REALES que el generador produce para una hoja — no una reconstrucción. Es la diferencia entre
 *  comprobar el archivo y comprobar la idea que uno tiene del archivo. */
const hojaDeGate = (def) => (hojasDeLaPlantilla().find((h) => h.nombre === def.nombre) || {}).filas || [];

const EJEMPLO = plantillaEjemplo();
const val = (buf) => validarPlantilla(buf, { nombreArchivo: "x.xlsx" });

/** rehace el .xlsx del ejemplo con las hojas mutadas — para fabricar archivos rotos a propósito */
function ejemploCon(mutar) {
  const d = datosEjemplo();
  /* Fabrica el libro a mano para poder ROMPERLO en un punto concreto. Desde 2026-08-26 los datos de la empresa
   * viven en su propia hoja, así que acá también: si el gate siguiera armando la cabecera dentro de Ventas
   * estaría probando una estructura que la plantilla ya no genera. */
  const empresa = { nombre: HOJA_EMPRESA, filas: [[MARCA_PLANTILLA], [], ...PARAMETROS.map((p) => [p.etiqueta, d.parametros[p.clave] ?? null])] };
  const hojas = HOJAS.map((def) => {
    const datos = ({ Ventas: d.ventas, Inventario: d.inventario })[def.nombre] || [];
    return { nombre: def.nombre, filas: [[def.que], def.columnas.map((c) => c.ayuda), def.columnas.map((c) => c.titulo),
      ...datos.map((f) => def.columnas.map((c) => f[c.campo] ?? null))] };
  });
  const todas = [empresa, ...hojas];
  if (mutar) mutar(todas);
  return construirXlsx(todas);
}
const hoja = (hojas, n) => hojas.find((h) => h.nombre === n);
/** El índice de una columna por su CAMPO. Antes estos tests escribían el número a mano y cada vez que el
 *  contrato movía una columna se rompían diez asserts que no tenían nada que ver con el cambio. */
const col = (nombreHoja, campo) => HOJAS.find((d) => d.nombre === nombreHoja).columnas.findIndex((c) => c.campo === campo);
/** el índice de la fila de encabezados dentro de las filas fabricadas por `ejemploCon` */
const iEnc = (h) => h.filas.findIndex((f) => (f || [])[0] === HOJAS.find((d) => d.nombre === h.nombre).columnas[0].titulo);

/* ── [A] LA PLANTILLA SE GENERA DEL CONTRATO ───────────────────────────────────────────────────────────────── */
H("[A] LA PLANTILLA SE GENERA DEL CONTRATO · dos hojas para llenar");
{
  const vacia = plantillaVacia();
  ok(vacia.length > 1500 && vacia[0] === 0x50 && vacia[1] === 0x4b, `la plantilla vacía es un .xlsx real (${(vacia.length / 1024).toFixed(1)} KB)`);
  ok(Buffer.compare(plantillaVacia(), vacia) === 0, "generarla dos veces da los MISMOS bytes (determinística)");
  ok(Buffer.compare(plantillaEjemplo(), EJEMPLO) === 0, "el ejemplo también es determinístico");
  /* ⚠️ ERA `HOJAS.length === 2`. La cuenta fija se rompía sola al agregar una hoja compatible; lo que esta
     línea cuida no es CUÁNTAS son sino que las dos obligatorias estén y en su orden, que es de lo que dependen
     el generador y el validador. Abonos entró el 2026-08-27, opcional y al final. */
  ok(HOJAS[0].nombre === "Ventas" && HOJAS[1].nombre === "Inventario" && HOJAS.every((h) => ["Ventas", "Inventario", "Abonos"].includes(h.nombre)),
    `el contrato declara sus hojas, en orden: ${HOJAS.map((h) => h.nombre).join(" · ")}`);

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
  const suma = e.ventas.filter((v) => String(v.fecha).startsWith("2026-08")).reduce((s, v) => s + v.venta, 0);
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
  /* El mensaje tiene que nombrar títulos que el validador ACEPTE. Clavar el texto acá fue lo que mantuvo vivo
   * "Venta (USD)" después de que los títulos perdieran la moneda: el usuario corregía como se le indicaba y
   * volvía a fallar por unidad ambigua. Ahora se exige el título real, no una cadena cualquiera. */
  ok(!!b1 && /Venta y Costo/.test(b1.detalle), "…y el mensaje dice qué mandar en su lugar");
  ok(!!b1 && !/\(USD\)/.test(b1.detalle), "…con un encabezado que la plantilla acepta, no uno que ella misma rechaza");
  ok(Object.keys(v1.tablas).length === 0, "…y no devuelve ni una fila: un archivo que no cumple no entrega datos a medias");

  for (const calc of ["Capital inmovilizado", "Contribución", "Carga comercial", "Benchmark", "Costo unitario", "Presupuesto"]) {
    const b = val(ejemploCon((hs) => { const h = hoja(hs, "Inventario"); const i = iEnc(h); h.filas[i] = [...h.filas[i], calc]; h.filas.slice(i + 1).forEach((f) => f.push(1)); }));
    ok(b.bloqueos.some((x) => x.tipo === "columna-calculada"), `«${calc}» se rechaza como columna calculada`);
  }

  /* El título ya no lleva la moneda (owner: «si el usuario pone CLP también es válido»), pero la trampa que
   * importa sigue viva y es la de la ESCALA: alguien que escribe "Venta (miles)" está diciendo otra cosa. Un
   * título parecido no se acepta como equivalente — adivinar cuál quiso decir es miles-contra-dólares otra vez. */
  const enMiles = ejemploCon((hs) => { const h = hoja(hs, "Ventas"); const i = iEnc(h); h.filas[i] = h.filas[i].map((t) => (t === "venta" ? "venta (miles)" : t)); });
  ok(val(enMiles).bloqueos.some((b) => b.tipo === "unidad-ambigua"), '"Venta (miles)" NO se acepta como equivalente de "Venta": la escala no se adivina');
  const plural = ejemploCon((hs) => { const h = hoja(hs, "Ventas"); const i = iEnc(h); h.filas[i] = h.filas[i].map((t) => (t === "venta" ? "ventas" : t)); });
  ok(val(plural).bloqueos.some((b) => b.tipo === "unidad-ambigua"), '…y tampoco un plural: los títulos son los del contrato o no son');
  ok(!/USD/.test(HOJAS.flatMap((h) => h.columnas.map((c) => c.titulo)).join(" ")), "ningún título impone la moneda: la declara el cliente en la cabecera");

  const dupDistinto = ejemploCon((hs) => { const h = hoja(hs, "Ventas"); const i = iEnc(h); const f = [...h.filas[i + 1]]; f[8] = 99999; h.filas.push(f); });
  ok(val(dupDistinto).bloqueos.some((b) => b.tipo === "duplicado-contradictorio"), "misma clave con distinto valor → BLOQUEA");
  const dupIgual = ejemploCon((hs) => { const h = hoja(hs, "Ventas"); h.filas.push([...h.filas[iEnc(h) + 1]]); });
  const v3 = val(dupIgual);
  ok(v3.ok === true && v3.avisos.some((a) => a.tipo === "fila-duplicada-identica"), "misma clave con el mismo valor → se colapsa y se avisa");

  ok(val(ejemploCon((hs) => { const h = hoja(hs, "Ventas"); h.filas[iEnc(h) + 1][col("Ventas", "cliente")] = null; })).bloqueos.some((b) => b.tipo === "celda-obligatoria-vacia"), "una fila sin cliente no se puede atribuir: bloquea");
  ok(val(ejemploCon((hs) => hs.push({ nombre: "Mis notas", filas: [["a"]] }))).bloqueos.some((b) => b.tipo === "hoja-de-mas"), "una hoja de más rechaza el archivo");
  ok(val(ejemploCon((hs) => { hs.splice(hs.findIndex((h) => h.nombre === HOJA_EMPRESA), 1); })).bloqueos.some((b) => b.tipo === "no-es-la-plantilla"), `sin la hoja «${HOJA_EMPRESA}» no hay plantilla que validar: ahí vive la marca del archivo`);
  ok(val(ejemploCon((hs) => { hoja(hs, HOJA_EMPRESA).filas[0][0] = "PLANTILLA OFICIAL ADI/SENTRIX · v0"; })).bloqueos.some((b) => b.tipo === "version-distinta"), "una plantilla de otra versión se rechaza nombrando las dos");

  const cualquiera = construirXlsx([{ nombre: "Hoja1", filas: [["Cliente", "Venta"], ["Uno", 100]] }]);
  const v4 = val(cualquiera);
  ok(v4.ok === false && v4.bloqueos.some((b) => b.tipo === "no-es-la-plantilla"), "un Excel cualquiera NO entra");
  ok(/descargá la plantilla oficial/.test(v4.bloqueos[0].detalle), "…y le dice al usuario qué hacer, en vez de un «formato inválido»");

  ok(val(ejemploCon((hs) => { const h = hoja(hs, "Ventas"); h.filas[iEnc(h) + 1][col("Ventas", "unidades")] = "muchas"; })).bloqueos.some((b) => b.tipo === "valor-no-numerico"), "un texto donde va un número bloquea, con la fila nombrada");
  ok(val(ejemploCon((hs) => { const h = hoja(hs, "Ventas"); h.filas[iEnc(h) + 1][col("Ventas", "fecha")] = "agosto"; })).bloqueos.some((b) => b.tipo === "fecha-mal-escrita"), "una fecha mal escrita bloquea, y dice el formato esperado (aaaa-mm-dd)");
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
H("[E] LA PLANTILLA PIDE HECHOS · ADI valoriza, calcula días y rotación, y declara lo que no puede");
{
  /* EL CONTRATO v1 DE INVENTARIO (owner 2026-08-26), textual: «la plantilla debe pedir hechos, no KPIs ni
   * valorizaciones manuales. El cliente entrega stock físico; ADI calcula capital, días y rotación». La hoja
   * quedó en SKU + Bodega (opcional) + Stock. Todo lo demás sale de acá y de la hoja Ventas.
   *
   * ⚠️ LA REGLA «informado manda» NO MURIÓ: sigue viva en `resolverDiasYRotacion` y la prueba
   * `_dias_rotacion_gate`, para cuando el dato llegue por un ERP. Lo que cambió es que la PLANTILLA ya no
   * ofrece esas columnas — pedirle al usuario un KPI era pedirle que hiciera nuestra cuenta. */
  const hojaInv = HOJAS.find((h) => h.nombre === "Inventario");
  ok(hojaInv.columnas.length === 3, `la hoja pide 3 columnas: ${hojaInv.columnas.map((c) => c.titulo).join(" · ")}`);
  const pedidas = hojaInv.columnas.map((c) => c.campo);
  for (const fuera of ["fechaCorte", "stockUSD", "ultimaVenta", "doh", "rotacion"]) {
    ok(!pedidas.includes(fuera), `«${fuera}» ya NO se le pide al usuario: la calcula o la deduce ADI`);
  }
  ok(hojaInv.columnas.filter((c) => c.obligatoria).map((c) => c.campo).join(",") === "sku,stockUnd",
    "y las obligatorias son exactamente SKU y stock: la bodega es opcional");

  const inv = r.dataset.skuInventario;
  ok(inv.length === 6, `el inventario entró como hechos (${inv.length} filas)`);
  ok(inv.every((s) => typeof s.stockUnd === "number"), "el stock físico es el hecho que entra");
  ok(inv.every((s) => s.procedencia && s.procedencia.doh && s.procedencia.rotacion && s.procedencia.capital),
    "cada fila declara la procedencia de sus tres métricas derivadas");

  /* CAPITAL = STOCK × COSTO UNITARIO, y el costo unitario sale de Ventas (costo ÷ unidades vendidas). Se
   * reproduce la cuenta acá con los datos crudos: si el motor cambiara de fórmula por dentro, esto se cae. */
  const uno = inv.find((s) => s.sku === "TRM-800");
  /* La hoja Ventas ya no trae bodega (owner 2026-08-26), así que el costo unitario se acumula por SKU sobre el
   * período actual — que es exactamente lo que hace el motor cuando no puede separar por bodega. */
  const filasDelSku = datosEjemplo().ventas.filter((v) => v.sku === "TRM-800" && String(v.fecha).startsWith("2026-08"));
  const costo = filasDelSku.reduce((a, v) => a + v.costo, 0);
  const und = filasDelSku.reduce((a, v) => a + v.unidades, 0);
  const esperado = Math.round(uno.stockUnd * (costo / und));
  ok(uno.stockUSD === esperado, `capital de ${uno.sku} = ${uno.stockUnd} × (${costo} ÷ ${und}) = ${esperado} (dio ${uno.stockUSD})`);
  ok(uno.procedencia.capital === "calculado" && /costo/.test(uno.procedencia.formulaCapital || ""),
    `…marcado calculado y con su fórmula: «${uno.procedencia.formulaCapital}»`);
  ok(inv.every((s) => s.procedencia.doh === "calculado"), "los días los calcula ADI: ninguno vino informado");
  ok(inv.every((s) => s.procedencia.rotacion === "calculado"), "…y la rotación también");
  ok(typeof uno.doh === "number" && typeof uno.rotacion === "number",
    `…y dan números reales (${uno.doh} días · ${uno.rotacion}x)`);

  /* ⚠️ EL CASO QUE EL OWNER PIDIÓ POR ESCRITO: «si un SKU tiene stock pero no tiene venta/costo suficiente en el
   * período, ADI no inventa: declara que no puede valorizar o calcular rotación/días para ese SKU». Un cero acá
   * diría «no tiene capital inmovilizado», que es lo contrario de «no lo sé». */
  const d = datosEjemplo();
  const conFantasma = ingestarPlantilla(
    plantillaEjemplo({ ...d, inventario: [...d.inventario, { sku: "SIN-VENTA-1", bodega: "Central", stockUnd: 500 }] }),
    { nombreArchivo: "fantasma.xlsx" });
  const f = conFantasma.dataset.skuInventario.find((s) => s.sku === "SIN-VENTA-1");
  ok(f.stockUSD === null, "un SKU con stock y sin venta NO se valoriza: null, nunca cero");
  ok(f.doh === null && f.rotacion === null, "…ni se le inventan días ni rotación");
  ok(f.procedencia.capital === "sin dato" && f.procedencia.doh === "sin dato", "…y la fila lo declara: «sin dato»");
  ok(f.estado === null, "…y se queda sin estado: diagnosticarlo sería diagnosticar un hueco");
  const av = conFantasma.preview.avisos.map((a) => a.tipo);
  ok(av.includes("sku-sin-valorizar") && av.includes("sku-sin-ritmo"),
    `…y sube a los avisos, con el SKU nombrado (${av.filter((x) => /^sku-sin/.test(x)).join(" · ")})`);
}

/* ── [F] EL BENCHMARK ES PARÁMETRO ─────────────────────────────────────────────────────────────────────────── */
H("[F] EL BENCHMARK · lo pone ADI y lo declara, y jamás es una columna");
{
  /* ⚠️ EL BENCHMARK DEJÓ DE PEDIRSE (owner 2026-08-26): salió de la plantilla con el resto de las políticas
   * —«deja solo datos de empresa y período»— y ADI usa su REFERENCIA GENERAL. Lo que no cambió, y es lo que este
   * bloque protege, son las dos garantías de siempre: que la referencia se DECLARE en vez de pasar por dato del
   * cliente, y que como COLUMNA se rechace. Un benchmark que llega por columna es una vara distinta por fila. */
  const k = r.dataset.margenKPI;
  ok(typeof k.benchmark === "number", `hay una referencia con la que comparar el margen (${k.benchmark}%)`);
  ok(k.benchmarkProcedencia === "referencia general de ADI",
    `…y se declara de dónde sale: «${k.benchmarkProcedencia}» — no se hace pasar por dato del negocio`);
  ok(typeof k.brechaPuntos === "number", `la brecha de margen se puede calcular igual (${k.brechaPuntos} pp)`);
  ok(!PARAMETROS.some((p) => p.clave === "benchmark"), "y la plantilla ya no se lo pide al usuario");

  const conCol = val(ejemploCon((hs) => { const h = hoja(hs, "Ventas"); const i = iEnc(h); h.filas[i] = [...h.filas[i], "Benchmark"]; h.filas.slice(i + 1).forEach((f) => f.push(30)); }));
  ok(conCol.bloqueos.some((b) => b.tipo === "columna-calculada"), "como columna se rechaza: una vara por fila no es una vara");
}

H("[G] LA PREVIEW HUMANA");
{
  const t = previewPlantillaEnTexto(r.preview);
  for (const s of ["1 · QUÉ DATOS RECIBIÓ", "2 · QUÉ CALCULA ADI CON ESTO", "3 · QUÉ NO CALCULA, Y QUÉ HARÍA FALTA", "4 · QUÉ PARTES DE SENTRIX QUEDAN DISPONIBLES"])
    ok(t.includes(s), `la preview trae «${s}»`);
  ok(t.includes("autoriza:") && t.includes("comprobado:"), "cada cálculo muestra QUÉ lo autoriza y con qué medición se comprobó");
  ok(t.includes("para abrirlo:"), "cada bloqueo dice qué haría falta para abrirlo");

  const d = r.preview.disponibilidad;
  ok(d.caras.find((c) => c.cara === "Comercial").completa === true, "con el ejemplo, la cara Comercial abre completa");
  ok(d.caras.find((c) => c.cara === "Capital").completa === true, "…y Capital ahora abre COMPLETA: con la regla nueva, el diagnóstico se puede armar");

  const roto = previewPlantillaEnTexto(ingestarPlantilla(ejemploCon((hs) => { const h = hoja(hs, "Ventas"); h.filas[iEnc(h)] = [...h.filas[iEnc(h)], "Margen %"]; }), { nombreArchivo: "r.xlsx" }).preview);
  ok(/EL ARCHIVO NO SE CARGÓ/.test(roto), "cuando no entra, la preview lo dice arriba y no muestra totales de nada");
}

/* ── [H] COHERENCIA · el precio de colapsar los maestros ───────────────────────────────────────────────────── */
H("[H] COHERENCIA · el mismo SKU con dos marcas no se resuelve eligiendo");
{
  const dosMarcas = ejemploCon((hs) => { const h = hoja(hs, "Ventas"); const i = iEnc(h); h.filas[i + 2][col("Ventas", "marca")] = "OtraMarca"; });
  const v = val(dosMarcas);
  ok(v.ok === false && v.bloqueos.some((b) => b.tipo === "atributo-incoherente"), "el mismo SKU con dos marcas distintas RECHAZA el archivo");
  const b = v.bloqueos.find((x) => x.tipo === "atributo-incoherente");
  ok(/fila \d+/.test(b.detalle) && /OtraMarca/.test(b.detalle), `…y nombra las dos filas que se contradicen: "${b.detalle.slice(0, 130)}…"`);
  ok(/no se elige una/.test(b.detalle), "…y dice explícitamente que no elige una: lo corrige el usuario");

  const dosCanales = ejemploCon((hs) => { const h = hoja(hs, "Ventas"); const i = iEnc(h); h.filas[i + 2][col("Ventas", "canal")] = "Mayorista"; });
  ok(val(dosCanales).bloqueos.some((x) => x.tipo === "atributo-incoherente"), "el mismo cliente con dos canales distintos también se rechaza");

  // el caso legítimo: un atributo vacío en una fila y presente en otra NO es una contradicción
  const unoVacio = ejemploCon((hs) => { const h = hoja(hs, "Ventas"); const i = iEnc(h); h.filas[i + 2][4] = null; });
  const vv = val(unoVacio);
  ok(vv.bloqueos.every((x) => x.tipo !== "atributo-incoherente"), "una celda vacía NO es una contradicción: se toma el valor de la otra fila");
}

/* ── [I] LA PROCEDENCIA SE VE, Y LA HERRAMIENTA PARA PROBARLA EXISTE ───────────────────────────────────────
 * «Informado manda, calculado rellena» solo sirve si el usuario puede VER cuál es cuál. Un valor calculado que
 * se muestra igual que uno del ERP se lee como si viniera del ERP: la primera vez que difiera de su sistema, el
 * usuario concluye que ADI se equivoca. Por eso el conteo va en la preview y se verifica acá. */
H("[I] PROCEDENCIA VISIBLE · el usuario distingue lo suyo de lo que puso ADI");
{
  /* Desde el contrato v1 de Inventario (owner 2026-08-26) la plantilla pide HECHOS, así que las tres métricas
   * derivadas —capital, días y rotación— salen SIEMPRE calculadas. Que se cuenten igual no es redundante: es lo
   * que le permite al usuario ver que ninguna de esas cifras vino de su archivo, y cuántas ADI no pudo producir. */
  const pr = r.preview.totales.procedencia;
  const inv = r.dataset.skuInventario;
  ok(pr && pr.total === inv.length, `la preview cuenta las ${inv.length} filas de inventario`);
  ok(pr.dias.informado === 0 && pr.dias.calculado === 6, `días: ${pr.dias.informado} informados · ${pr.dias.calculado} calculados por ADI`);
  ok(pr.rotacion.informado === 0 && pr.rotacion.calculado === 6, `rotación: ${pr.rotacion.informado} informadas · ${pr.rotacion.calculado} calculadas`);
  ok(pr.capital.calculado === 6 && pr.capital.sinDato === 0, `capital: ${pr.capital.calculado} valorizados por ADI · ${pr.capital.sinDato} sin dato`);
  // el conteo no puede ser un literal: tiene que salir del dataset
  const dCalc = inv.filter((x) => x.procedencia.doh === "calculado").length;
  ok(dCalc === pr.dias.calculado, "el conteo de la preview sale del dataset, no de un número escrito a mano");

  const t = previewPlantillaEnTexto(r.preview);
  ok(/capital en stock: .*calculados por ADI/.test(t), "la preview en texto declara que el capital lo calculó ADI");
  ok(/días de inventario: .*calculados por ADI/.test(t), "…y los días también");
  ok(/rotación: *.*calculad/.test(t), "…y la rotación");

  /* EL SILENCIO ES DIRIGIDO, NO GENERAL · una opcional que ADI SÍ deriva no genera aviso al quedar vacía (sería
   * un aviso por fila que entierra los que importan), pero una que ADI NO puede completar sigue avisando. Con
   * días y rotación fuera de la plantilla, el caso que queda vivo es «Precio de lista»: es opcional, es un hecho
   * del negocio, y si no viene, no existe. */
  const sinPrecio = ejemploCon((hs) => {
    const h = hoja(hs, "Ventas"); const i = iEnc(h);
    const col = h.filas[i].findIndex((c) => /Precio de lista/i.test(String(c || "")));
    h.filas[i + 1][col] = null;
  });
  const pv = ingestarPlantilla(sinPrecio, { nombreArchivo: "sp.xlsx" }).preview;
  ok(pv.avisos.some((a) => a.tipo === 'columna-opcional-vacia' && /precio de lista/i.test(a.detalle)),
     'una opcional que ADI NO calcula sí avisa al quedar vacía — y UNA vez por columna, no una por fila');
  ok(!/precio de lista/i.test(previewPlantillaEnTexto(r.preview) || ''),
     "…y el archivo completo no arrastra ningún aviso de ese tipo");
}

H("[I2] LA PLANTILLA SE PUEDE PROBAR SIN UI · scripts/leer-plantilla.mjs");
{
  const { spawnSync } = await import("node:child_process");
  const { writeFileSync, mkdtempSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const dir = mkdtempSync(`${tmpdir()}/adi-plantilla-`);
  const bueno = `${dir}/ok.xlsx`, malo = `${dir}/malo.xlsx`;
  writeFileSync(bueno, EJEMPLO);
  writeFileSync(malo, ejemploCon((hs) => { const h = hoja(hs, "Ventas"); h.filas[iEnc(h)] = [...h.filas[iEnc(h)], "Margen %"]; }));

  const corre = (f) => spawnSync(process.execPath, ["scripts/leer-plantilla.mjs", f], { encoding: "utf8" });
  const a = corre(bueno);
  ok(a.status === 0, "un archivo válido sale con código 0");
  ok(/QUÉ PARTES DE SENTRIX/.test(a.stdout), "…y escribe la preview completa en pantalla");
  const b = corre(malo);
  ok(b.status === 1, "un archivo bloqueado sale con código 1, para poder encadenarlo");
  ok(/EL ARCHIVO NO SE CARGÓ/.test(b.stdout), "…y dice por qué, sin cargar ninguna fila");
  const c = spawnSync(process.execPath, ["scripts/leer-plantilla.mjs", `${dir}/no-existe.xlsx`], { encoding: "utf8" });
  ok(c.status === 2 && /no existe/.test(c.stderr), "un archivo que no está se distingue de uno inválido (código 2)");
}

/* ── [J] LOS TRES CASOS DEL OWNER · completo · mínimo · malo ────────────────────────────────────────────────
 * Cada caso declara qué debe probar (`espera`) y acá se verifica. Un archivo de prueba sin esa afirmación es un
 * archivo, no una prueba: el día que el resultado cambie, nadie sabría si mejoró o se rompió. */
H("[J] LOS TRES CASOS · uno completo, uno mínimo, uno malo");
{
  const por = Object.fromEntries(CASOS.map((c) => [c.clave, ingestarPlantilla(c.construir(), { nombreArchivo: c.archivo })]));

  // 1 · COMPLETO — el ERP publica sus propios KPI y ADI no le discute ninguno
  const c1 = por.completo, e1 = CASOS[0].espera;
  ok(c1.ok === true, "COMPLETO: entra");
  const p1 = c1.preview.totales.procedencia;
  /* «COMPLETO» ya no significa «el ERP publica sus KPI»: desde el contrato v1 de Inventario significa que el
   * archivo trae TODAS las columnas que la plantilla ofrece, incluida la bodega. Días, rotación y capital los
   * produce ADI en los dos casos — lo que cambia entre COMPLETO y MÍNIMO es el GRANO del cálculo. */
  ok(p1.dias.calculado === e1.diasCalculados && p1.dias.informado === 0,
     `COMPLETO: ADI calculó los ${p1.dias.calculado} días — la plantilla ya no pide KPIs`);
  ok(p1.rotacion.calculado === e1.diasCalculados, "COMPLETO: y las 6 rotaciones también salen de esos días");
  ok(c1.dataset.skuInventario.every((s) => s.bodega),
     "COMPLETO: trae bodega, así que capital, días y rotación van por SKU+bodega");
  ok(c1.preview.disponibilidad.caras.filter((x) => x.completa).length === e1.carasCompletas,
     "COMPLETO: las 4 caras de Sentrix abren completas");

  // 2 · MÍNIMO — solo lo obligatorio; ADI calcula, y DICE qué se pierde
  const c2 = por.minimo, e2 = CASOS[1].espera;
  ok(c2.ok === true, "MÍNIMO: entra aunque falten canal, marca, familia, bodega, acciones y precio de lista");
  const p2 = c2.preview.totales.procedencia;
  ok(p2.dias.calculado === e2.diasCalculados && p2.dias.informado === 0,
     `MÍNIMO: ADI calculó los ${p2.dias.calculado} días, ninguno vino informado`);
  ok(p2.rotacion.calculado === e2.diasCalculados, "MÍNIMO: y las 6 rotaciones");
  ok(c2.preview.avisos.some((a) => a.tipo === "clave-mas-gruesa"),
     "MÍNIMO: se declara que sin Bodega en Ventas todo queda agregado — caer al total es una decisión visible");
  /* ⚠️ REGLA TEXTUAL DEL OWNER (2026-08-26): «si no viene Bodega, se calcula por SKU total y se declara». La
   * segunda mitad es la que importa: agregar por SKU total es una respuesta legítima; hacerlo en silencio deja
   * al usuario creyendo que mira un número por bodega. */
  ok(c2.dataset.skuInventario.every((s) => s.bodega === null),
     "MÍNIMO: el inventario entra sin bodega — dejó de ser obligatoria");
  ok(c2.preview.avisos.some((a) => a.tipo === "inventario-sin-bodega"),
     "MÍNIMO: y se DECLARA que capital, días y rotación van por SKU total");
  ok(c2.dataset.skuInventario.every((s) => typeof s.stockUSD === "number"),
     "MÍNIMO: con solo SKU y stock, ADI igual valoriza el inventario completo");
  const falta2 = c2.preview.disponibilidad.caras.flatMap((x) => x.falta);
  ok(falta2.includes("ventas@marca") && falta2.includes("ventas@familia"),
     "MÍNIMO: se nombra exactamente qué métricas se pierden, en vez de decir «faltan datos»");
  ok(c2.preview.disponibilidad.resumen.metricasDisponibles < c1.preview.disponibilidad.resumen.metricasDisponibles,
     `MÍNIMO: rinde menos que el completo (${c2.preview.disponibilidad.resumen.metricasDisponibles} contra ${c1.preview.disponibilidad.resumen.metricasDisponibles} métricas), y se ve`);

  // 3 · MALO — los seis problemas juntos, no el primero
  const c3 = por.malo, e3 = CASOS[2].espera;
  ok(c3.ok === false && c3.dataset === null, "MALO: no entra y no carga ninguna fila");
  for (const t of e3.tipos) ok(c3.preview.bloqueos.some((b) => b.tipo === t), `MALO: detecta «${t}»`);
  ok(c3.preview.bloqueos.length >= e3.tipos.length,
     `MALO: los reporta TODOS juntos (${c3.preview.bloqueos.length}), no se detiene en el primero — si no, el usuario sube el archivo seis veces`);
  ok(c3.preview.bloqueos.filter((b) => b.fila).every((b) => /fila \d+/.test(b.detalle)),
     "MALO: cada problema de fila dice en qué fila está");

  /* El mensaje de «sacá esta columna» tiene que mandar a escribir un encabezado que el validador ACEPTE. Decía
   * "Venta (USD)" —de cuando los títulos llevaban moneda— y ese título hoy se rechaza por unidad ambigua: el
   * usuario corregía como se le indicaba y volvía a fallar. */
  const titulos = new Set(HOJAS.flatMap((h) => h.columnas.map((c) => c.titulo)));
  for (const r of COLUMNAS_PROHIBIDAS) {
    const nombra = [...titulos].filter((t) => r.enSuLugar.includes(t));
    for (const t of nombra) ok(titulos.has(t), `«${r.enSuLugar}» nombra "${t}", que es un título real de la plantilla`);
    ok(!/\(USD\)/.test(r.enSuLugar), `«${r.enSuLugar.slice(0, 46)}» no manda a escribir una moneda en el título`);
  }
}

/* ── [K] LA CABECERA SE LEE EN CASTELLANO ──────────────────────────────────────────────────────────────────
 * La hoja la llena un gerente comercial, no un programador. Una celda rotulada `margenBrechaMaterial` es una
 * adivinanza. El contrato ya traía la etiqueta legible y la plantilla no la estaba usando: se veía recién al
 * ABRIR el archivo, que es justamente lo que ninguna prueba hacía. La clave se sigue aceptando, para no romper
 * un archivo que alguien ya haya llenado. */
H("[K] LA HOJA EMPRESA EN CASTELLANO · y la clave interna sigue valiendo");
{
  /* La cabecera se mudó a su propia pestaña (owner 2026-08-26) y quedó en TRES campos: identidad y período.
   * Lo que se prueba es lo de siempre — que el rótulo esté en castellano legible, que ninguna celda le muestre
   * al usuario un nombre de programador, y que un archivo rotulado con la clave interna se siga aceptando. */
  const filas = leerLibro(plantillaVacia(), { nombreArchivo: "v.xlsx" }).hojas.find((h) => h.nombre === HOJA_EMPRESA).matriz;
  const enHoja = filas.map((f) => (f || [])[0]).filter(Boolean).map(String);
  for (const p of PARAMETROS) ok(enHoja.includes(p.etiqueta), `la hoja «${HOJA_EMPRESA}» pide "${p.etiqueta}"`);
  ok(!enHoja.some((t) => /[a-z][A-Z]/.test(t)), "…y ninguna celda le muestra al usuario un nombre de programador");
  ok(PARAMETROS.every((p) => p.ayuda && p.ayuda === p.ayuda.toLowerCase()),
    "cada campo trae su explicación, en minúscula como pidió el owner");
  for (const p of PARAMETROS) ok(enHoja.includes(p.ayuda), `…y la explicación de "${p.etiqueta}" está escrita en la hoja, no solo en el contrato`);

  const conEtiqueta = ingestarPlantilla(EJEMPLO, { nombreArchivo: "e.xlsx" });
  ok(conEtiqueta.ok && conEtiqueta.preview.parametros.empresa_id === "andes",
     "el archivo con la cabecera en castellano entra, y el parámetro llega al motor con su clave interna");

  const conClave = ingestarPlantilla(ejemploCon(() => {}), { nombreArchivo: "c.xlsx" });
  ok(conClave.ok === true && conClave.preview.parametros.empresa_id === "andes",
     "un archivo rotulado con la etiqueta o con la clave sigue entrando: los ya llenados no se rompen");

  const sinNombre = ejemploCon((hs) => {
    const h = hoja(hs, HOJA_EMPRESA);
    const et = PARAMETROS.find((p) => p.clave === "empresa_nombre").etiqueta;
    h.filas = h.filas.filter((f) => (f || [])[0] !== et);
  });
  const bm = validarPlantilla(sinNombre, { nombreArchivo: "sn.xlsx" }).bloqueos.find((b) => b.tipo === "parametro-obligatorio-ausente");
  ok(!!bm && /nombre de tu empresa/.test(bm.detalle),
     "cuando falta, el error nombra la etiqueta que el usuario ve en la hoja, no la clave interna");
  ok(!!bm && new RegExp(HOJA_EMPRESA).test(bm.detalle), "…y dice en qué pestaña buscarla");
}

/* ── [L] QUE EL USUARIO SEPA QUÉ HACER ─────────────────────────────────────────────────────────────────────── */
H("[L] EL USUARIO ABRE EL ARCHIVO Y SABE QUÉ HACER · amarillo, explicación y ejemplo adentro");
{
  /* LA FRASE QUE ORDENA ESTA SECCIÓN, del owner (2026-08-26): «lo que no debe pasar es que el usuario vea la
   * planilla y no sepa qué hacer». Todo lo de acá existe por eso, y ninguna de las cuatro piezas se puede probar
   * mirando el contrato: hay que mirar el ARCHIVO que se genera, que es lo que la persona abre. */
  const vacia = plantillaVacia();

  // 1 · el amarillo · pidió «marca en amarillo los campos obligatorios»
  ok(vacia.includes("xl/styles.xml"), "el libro trae hoja de estilos: sin eso no hay color posible");
  ok(ESTILO.OBLIGATORIA !== ESTILO.NORMAL && ESTILO.OBLIGATORIA !== ESTILO.OPCIONAL,
    "obligatoria, opcional y normal son tres estilos distintos");
  for (const def of HOJAS) {
    const filas = hojaDeGate(def);
    const titulos = filas.find((f) => Array.isArray(f) && f.some((c) => c && c.v === def.columnas[0].titulo));
    const conEstilo = (t) => (titulos || []).find((c) => c && c.v === t.titulo);
    const obligatorias = def.columnas.filter((c) => c.obligatoria);
    ok(obligatorias.every((c) => (conEstilo(c) || {}).s === ESTILO.OBLIGATORIA),
      `«${def.nombre}»: las ${obligatorias.length} obligatorias van en amarillo`);
    ok(def.columnas.filter((c) => !c.obligatoria).every((c) => (conEstilo(c) || {}).s === ESTILO.OPCIONAL),
      `«${def.nombre}»: las opcionales NO — si todo se pinta, el color deja de decir algo`);
  }

  // 2 · la explicación de cada campo · «un comentario en cada campo, todo en minúscula»
  for (const def of HOJAS) {
    ok(def.columnas.every((c) => c.ayuda && c.ayuda.length > 10), `«${def.nombre}»: cada columna trae su explicación`);
    ok(def.columnas.every((c) => c.ayuda === c.ayuda.toLowerCase()), `«${def.nombre}»: y todas en minúscula, como pidió`);
    ok(def.columnas.every((c) => c.titulo === c.titulo.toLowerCase()), `«${def.nombre}»: los títulos también`);
  }
  {
    const m = leerLibro(vacia, { nombreArchivo: "v.xlsx" }).hojas.find((h) => h.nombre === "Ventas").matriz;
    const iTit = m.findIndex((f) => (f || [])[0] === HOJAS[0].columnas[0].titulo);
    ok(iTit > 0, "la fila de títulos no es la primera: arriba hay contexto");
    ok((m[iTit - 1] || [])[0] === HOJAS[0].columnas[0].ayuda,
      "…y la explicación de cada columna está JUSTO ARRIBA de su título, no escondida en un comentario");
    ok(m.slice(0, iTit).some((f) => /amarillo son obligatorias/.test(String((f || [])[0] || ""))),
      "la hoja dice, escrito, qué significa el amarillo");
    ok(m.slice(0, iTit).some((f) => /adi no va a poder responderte|no va a poder responder/.test(String((f || [])[0] || ""))),
      "…y qué pasa si dejás una opcional vacía: «ADI solo no responderá sobre eso»");
  }

  // 3 · el ejemplo vive adentro · «coloca una pestaña hoja con ese ejemplo y listo»
  {
    const nombres = leerLibro(vacia, { nombreArchivo: "v.xlsx" }).hojas.map((h) => h.nombre);
    ok(nombres.includes(HOJA_EJEMPLO), `la pestaña «${HOJA_EJEMPLO}» viaja dentro del mismo archivo`);
    const ej = leerLibro(vacia, { nombreArchivo: "v.xlsx" }).hojas.find((h) => h.nombre === HOJA_EJEMPLO).matriz;
    ok(ej.length > 8, `…y trae filas de muestra (${ej.length} líneas)`);
    ok(ej.some((f) => /solo para mirar/.test(String((f || [])[0] || ""))), "…y avisa que no hay que llenarla");
    const panel = readFileSync("./src/ui/PanelDatos.jsx", "utf8");
    ok(!/Con datos de ejemplo/.test(panel), "y la pantalla dejó de ofrecer una segunda descarga: un archivo, un botón");
  }

  // 4 · lo que el owner pidió agregar y quitar
  {
    const ventas = HOJAS.find((h) => h.nombre === "Ventas");
    const pv = ventas.columnas.find((c) => c.campo === "puntoVenta");
    ok(!!pv && !pv.obligatoria, "«punto de venta» existe y es opcional: hay clientes con varias sucursales y clientes con una");
    ok(pv.clave === true, "…y es parte de la clave: dos sucursales del mismo cliente el mismo día no son la misma fila");
    ok(!ventas.columnas.some((c) => c.campo === "bodega"), "«bodega» salió de Ventas: ya se pide en Inventario");
    const fecha = ventas.columnas.find((c) => c.campo === "fecha");
    ok(!!fecha && fecha.tipo === "fecha" && /aaaa-mm-dd/.test(fecha.titulo),
      `el período pasó a ser fecha completa: «${fecha.titulo}»`);
    const d = ingestarPlantilla(EJEMPLO, { nombreArchivo: "f.xlsx" });
    ok(d.ok && d.preview.periodos.todos.every((p) => /^\d{4}-\d{2}$/.test(p)),
      `…y el mes se deriva del día para agrupar (${d.preview.periodos.todos.join(" · ")})`);
  }
}

console.log(`\n${FAIL === 0 ? "✅" : "❌"} _plantilla_oficial_gate · ${PASS} ok · ${FAIL} fallas`);
process.exit(FAIL === 0 ? 0 : 1);
