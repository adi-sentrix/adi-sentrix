/* === _escala_declarada_gate.mjs · LA ESCALA SE DECLARA, NUNCA SE SUPONE (owner 2026-10-04 · P1) ====================
 *
 * EL DEFECTO QUE CIERRA, medido con una sonda real antes de escribir una línea: la pantalla «Tus datos» —en producción,
 * detrás de la puerta de la demo privada— decretaba la escala de los montos («raw») sin preguntarla. Quien escribía sus
 * montos en MILES cargaba SIN UNA SOLA ALARMA (venta 61 en vez de 61.483.000) y ADI analizaba magnitudes mil veces
 * erradas con la misma voz de seguridad de siempre. La ley del owner: «el símbolo de moneda declarado sí, la ESCALA
 * jamás se supone».
 *
 * LA DECISIÓN FINAL (owner, mismo día): el recorrido que «Tus datos» ya tiene —leer → mostrar lo entendido → confirmar →
 * analizar—.
 *   · «Esto es lo que leí» suma dos líneas, Moneda y Escala, armadas en el módulo;
 *   · la MONEDA es la de la hoja Empresa si trae ese parámetro («CLP (del archivo)», sin preguntar); si el archivo no la
 *     trae pero la EMPRESA ya la declaró en una carga anterior, se le recuerda («CLP (declarada antes por la empresa)», sin
 *     preguntar y SIN rotularla «del archivo»: sería falso); si no, se pregunta, sin preselección;
 *   · la ESCALA se pregunta SIEMPRE (la plantilla congelada no tiene dónde declararla), sin preselección;
 *   · NO se infiere nada que el archivo no declare explícitamente: ni encabezados («M$», «MM$») ni el rango de los
 *     valores. Eso es otro frente (P2).
 *
 * QUÉ SE VIGILA, y cada garantía tiene su CARNADA (un chequeo que no puede ponerse rojo es una foto, no un candado):
 *   1 · el CONTRATO declara qué columna es dinero y cuál cantidad — y una columna nueva sin declarar apaga la conversión;
 *   2 · la escala es «unidades» o «miles»; las dos líneas de «lo que leí» y la pregunta que corresponde, desde el módulo;
 *   3 · LA CARNADA DEL ENCARGO — la plantilla con TODOS los montos ÷1000 carga sin alarma; ni el módulo, ni el endpoint,
 *       ni la pantalla la activan sin escala; y declarada «miles» ES la original;
 *   4 · «miles» multiplica TODOS los campos monetarios del contrato y NINGUNO de los demás, con la procedencia
 *       («declarado por la empresa»), la moneda, su FUENTE (archivo · pantalla) y la transformación registradas;
 *   5 · los DOS caminos —versión guardada y en memoria— convierten igual, con moneda del archivo y con moneda de la pantalla;
 *   5c· la herencia: archivo sin moneda + empresa con moneda declarada → no se pregunta, se rotula «declarada antes por la
 *       empresa», la activación funciona y registra fuente «empresa» — y la ESCALA no se hereda: se pregunta en cada carga;
 *   6 · la PANTALLA, montada de verdad (jsdom): moneda en el archivo → NO se pregunta y aparece en «lo que leí»; moneda
 *       ausente → se pregunta sin preselección; escala siempre preguntada sin preselección; botón en candado; y cinco
 *       mutantes del componente (escala preseleccionada · moneda preseleccionada · botón sin candado · escala INFERIDA de un
 *       encabezado «M$» · moneda del archivo preguntada de nuevo · moneda heredada rotulada «del archivo» · moneda heredada
 *       preguntada de nuevo) cazados por la misma comprobación;
 *   7 · CERO cálculo ni inferencia en la vista (carnadas: un `* 1000` y un «M$» colados en el .jsx);
 *   8 · la plantilla NO se tocó: la estructura congelada sigue idéntica a su sello.
 *
 * OFFLINE · ingesta determinística + dobles en memoria + jsdom · el único «fetch» es un enrutador en memoria que
 * contesta el endpoint de ingesta y simula la base: no puede salir a ninguna red y no llama a ningún modelo.
 * `node --import ./scripts/offline-guard.mjs _escala_declarada_gate.mjs` */
import { JSDOM } from "jsdom";
import esbuild from "esbuild";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { HOJAS, PARAMETROS, PLANTILLA_VERSION, MAGNITUDES, columnasMonetarias, columnasNoMonetarias, columnasSinMagnitud } from "./src/config/contract/plantilla.js";
import { PLANTILLA_SELLADA, compararColumnas } from "./src/config/contract/plantillaSellada.js";
import { ESCALAS, ESCALAS_OFRECIDAS, ORIGEN_DECLARACION, FUENTES, preguntaDeDeclaracion, lineasDeDeclaracion, escalaLimpia, validarEscala, multiplicar } from "./src/config/escala.js";
import { convertirHechos } from "./src/ingesta/convertirEscala.js";
import { ingestarPlantilla } from "./src/ingesta/plantilla/ingestarPlantilla.js";
import { datosEjemplo, plantillaEjemplo } from "./src/ingesta/plantilla/generarPlantilla.js";
import { handleIngesta } from "./src/ingesta/handleIngesta.server.js";
import { activarVersion } from "./src/ingesta/persistirCarga.server.js";
import { ETIQUETA_ORIGEN, ORIGEN } from "./src/config/businessPolicy.js";
import { makeAccessCode } from "./src/adi/llm/accessToken.js";

let pass = 0, fail = 0;
const ok = (cond, label, detalle) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ FALLO: ${label}${detalle !== undefined ? `\n      ${detalle}` : ""}`); }
};
const H = (t) => console.log("\n" + "=".repeat(100) + "\n" + t + "\n" + "=".repeat(100));
const leer = (p) => { try { return fs.readFileSync(p, "utf8"); } catch { return ""; } };

/* ── EL ORÁCULO DE ESTE GATE · qué columnas son dinero en esta plantilla ───────────────────────────────────────────
 * Escrito AQUÍ a mano a propósito: es la verdad independiente contra la que se compara el contrato. Si el contrato
 * declarara de más o de menos, esta lista y `columnasMonetarias()` dejarían de coincidir y el gate se pone rojo. */
const DINERO = { Ventas: ["venta", "costo", "acciones", "precioLista"], Abonos: ["monto"] };
const CANTIDAD = { Ventas: ["unidades"], Inventario: ["stockUnd"] };

/* los datos del ejemplo con TODOS los montos × f (o ÷ f): el mismo negocio escrito en otra escala */
const escalarMontos = (datos, f) => {
  const d = JSON.parse(JSON.stringify(datos));
  for (const [hoja, campos] of Object.entries(DINERO)) {
    const filas = hoja === "Ventas" ? d.ventas : d.abonos;
    for (const fila of filas) for (const c of campos) if (typeof fila[c] === "number") fila[c] = multiplicar(fila[c], f);
  }
  return d;
};
const xlsx = (datos) => Buffer.from(plantillaEjemplo(datos));
const b64 = (buf) => buf.toString("base64");
const conMoneda = (m, datos = datosEjemplo()) => xlsx({ ...datos, parametros: { ...datos.parametros, moneda: m } });
/* UN NEGOCIO CON 61.483.000 DE VENTA, escrito de dos maneras (la hoja Empresa declara CLP en las dos):
 *   · ORIGINAL — en UNIDADES: 61.483.000
 *   · EN_MILES — en MILES: el mismo negocio con todos los montos ÷1000, es decir 61.483 */
const ORIGINAL = xlsx(escalarMontos(datosEjemplo(), 1000));
const EN_MILES = xlsx(datosEjemplo());
/* y las otras dos situaciones de la moneda: la hoja Empresa NO la trae, o trae algo que no es un código («M$») */
const SIN_MONEDA = conMoneda(null);
const MONEDA_RARA = conMoneda("M$");
const FECHA = "2026-09-01";
/* el pack sin lo que NO es cifra del negocio: la declaración (`perfil`), los hechos guardados y llaves que solo trae la
 * primera lectura (`avisosDeCarga`, `guardadoSinAnalizar`: el recálculo de una historia no las vuelve a armar — es así desde
 * antes) y la fecha de corte del cobro (la lectura directa la trae con el día, el recálculo con el mes: tampoco es cifra) */
const sinPerfil = (d) => {
  const { perfil, avisosDeCarga, guardadoSinAnalizar, hechos, historiaCompleta, flujoComercial, ...resto } = d;
  const { fechaCorte, ...cobro } = flujoComercial || {};
  return JSON.stringify({ ...resto, flujoComercial: flujoComercial ? cobro : flujoComercial });
};

/* ═══ 1 · EL CONTRATO DECLARA QUÉ ES DINERO ═══════════════════════════════════════════════════════════════════ */
H("1 · EL CONTRATO DECLARA QUÉ ES DINERO · y la conversión se niega a adivinar");
{
  ok(columnasSinMagnitud().length === 0,
    "toda columna numérica de la plantilla declara su magnitud (dinero | cantidad)",
    columnasSinMagnitud().map((c) => `${c.hoja}.${c.campo}`).join(", "));
  const vivo = {};
  for (const c of columnasMonetarias()) (vivo[c.hoja] = vivo[c.hoja] || []).push(c.campo);
  ok(JSON.stringify(vivo) === JSON.stringify(DINERO),
    `lo que el contrato declara como dinero coincide con el oráculo: ${Object.entries(vivo).map(([h, c]) => `${h}[${c.join(",")}]`).join(" · ")}`,
    `contrato: ${JSON.stringify(vivo)} · oráculo: ${JSON.stringify(DINERO)}`);
  const vivoCant = {};
  for (const c of columnasNoMonetarias()) (vivoCant[c.hoja] = vivoCant[c.hoja] || []).push(c.campo);
  ok(JSON.stringify(vivoCant) === JSON.stringify(CANTIDAD), `…y lo que declara como cantidad también: ${JSON.stringify(vivoCant)}`);
  ok(MAGNITUDES.join() === "dinero,cantidad", "las magnitudes posibles son dos y están declaradas como dato");

  /* CARNADA · una columna numérica NUEVA sin magnitud: la conversión tiene que NEGARSE, no multiplicar a ciegas ni saltársela */
  const ventas = HOJAS.find((h) => h.nombre === "Ventas");
  ventas.columnas.push({ campo: "flete", titulo: "flete", tipo: "numero", obligatoria: false, ayuda: "carnada" });
  try {
    ok(columnasSinMagnitud().some((c) => c.campo === "flete"), "CARNADA: una columna numérica sin magnitud aparece en la lista de huecos");
    const c = convertirHechos({ parametros: {}, Ventas: [{ venta: 10 }], Inventario: [], Abonos: [] }, "miles", { moneda: "CLP" });
    ok(c.ok === false && /flete/.test(c.motivo || ""),
      `CARNADA: con una columna sin magnitud la conversión se NIEGA y nombra la columna: «${(c.motivo || "").slice(0, 90)}…»`);
  } finally { ventas.columnas.pop(); }
  ok(columnasSinMagnitud().length === 0 && convertirHechos({ parametros: {}, Ventas: [], Inventario: [], Abonos: [] }, "miles", { moneda: "CLP" }).ok === true,
    "(restaurado) y sin la columna intrusa la conversión vuelve a correr");
}

/* ═══ 2 · LA ESCALA, LA PREGUNTA Y LAS DOS LÍNEAS DE «LO QUE LEÍ» ═════════════════════════════════════════════ */
H("2 · LA ESCALA SE DECLARA: nada por defecto, nada interpretado · y las palabras salen del módulo");
{
  ok(ESCALAS_OFRECIDAS.join() === "unidades,miles", "se ofrecen dos escalas: unidades de la moneda y miles (no «millones»)");
  ok(ESCALAS.miles.factor === 1000 && ESCALAS.unidades.factor === 1, "y el factor de cada una es dato declarado");
  ok(escalaLimpia("miles") === "miles" && escalaLimpia(" Unidades ") === "unidades", "se normaliza mayúscula y espacios, nada más");
  for (const raro of [undefined, null, "", "  ", "millones", "k", "K", "mil", "raw", "M$", "MM$", 1000, {}, true]) {
    ok(escalaLimpia(raro) === null, `«${typeof raro === "object" ? JSON.stringify(raro) : String(raro)}» NO es una escala: null, sin interpretarlo ni elegir por la empresa`);
  }
  ok(validarEscala(undefined).ok === false && /escala/.test(validarEscala(undefined).motivo), "sin escala el rechazo lo dice con motivo");
  ok(multiplicar(61.4835, 1000) === 61483.5 && multiplicar(0.001, 1000) === 1 && multiplicar(3.528, 1000) === 3528 && multiplicar(84e-3, 1000) === 84,
    "×1000 exacto en decimal: sin el ruido de coma flotante (61,4835 → 61.483,5 · 3,528 → 3.528)");
  ok(multiplicar(500, 1) === 500 && multiplicar("5", 1000) === "5" && multiplicar(null, 1000) === null, "«unidades» no toca nada; un valor que no es número queda como estaba");

  /* la pregunta que corresponde a lo que falta */
  const ambas = preguntaDeDeclaracion({ faltaMoneda: true }), soloEscala = preguntaDeDeclaracion({ faltaMoneda: false });
  ok(ambas.titulo === "¿En qué moneda y escala están expresados los montos?", `faltan las dos → «${ambas.titulo}»`);
  ok(soloEscala.titulo === "¿Los montos están en unidades de la moneda o en miles?", `falta solo la escala → «${soloEscala.titulo}»`);
  ok(/no se dan por supuestas/.test(ambas.ayuda) && /no se da por supuesta/.test(soloEscala.ayuda) && /multiplica por 1\.000/.test(soloEscala.ayuda),
    "las dos ayudas dicen por qué se pregunta y qué hace «miles»");
  ok(!/moneda y escala/.test(soloEscala.titulo), "cuando solo falta la escala, la pregunta NO habla de moneda");

  /* las dos líneas de «Esto es lo que leí» */
  const v = (a) => lineasDeDeclaracion(a).map((l) => `${l.rotulo}: ${l.valor}`).join(" · ");
  ok(v({ monedaArchivo: "CLP" }) === "Moneda: CLP (del archivo) · Escala: sin indicar en el archivo", `moneda en el archivo: «${v({ monedaArchivo: "CLP" })}»`);
  ok(v({}) === "Moneda: sin indicar en el archivo · Escala: sin indicar en el archivo", `ninguna indicada: «${v({})}»`);
  ok(v({ monedaPantalla: "USD", escala: "miles" }) === "Moneda: USD (declarada en pantalla) · Escala: en miles (declarada en pantalla)",
    `declaradas en pantalla: «${v({ monedaPantalla: "USD", escala: "miles" })}»`);
  ok(v({ monedaArchivo: "CLP", escala: "unidades" }) === "Moneda: CLP (del archivo) · Escala: en unidades de la moneda (declarada en pantalla)", "escala en unidades");
  ok(v({ monedaEmpresa: "CLP" }) === "Moneda: CLP (declarada antes por la empresa) · Escala: sin indicar en el archivo", `moneda recordada de una carga anterior: «${v({ monedaEmpresa: "CLP" })}»`);
  ok(lineasDeDeclaracion({ monedaEmpresa: "CLP" })[0].fuente === "empresa" && FUENTES.empresa === "empresa" && !/del archivo/.test(v({ monedaEmpresa: "CLP" }).split(" · ")[0]),
    "…con fuente «empresa», y NUNCA «del archivo»: la moneda recordada no está en el archivo");
  ok(v({ monedaArchivo: "CLP", monedaEmpresa: "USD" }).startsWith("Moneda: CLP (del archivo)"), "si el archivo la trae, manda el archivo sobre lo recordado");
  ok(ORIGEN_DECLARACION === ETIQUETA_ORIGEN[ORIGEN.EMPRESA] && ORIGEN_DECLARACION === "declarado por la empresa",
    "la procedencia sale de la tabla ÚNICA de la casa (`ETIQUETA_ORIGEN`) y el texto no cambió: «declarado por la empresa»");
  const fu = lineasDeDeclaracion({ monedaArchivo: "CLP", escala: "miles" }).map((l) => l.fuente).join();
  ok(fu === "archivo,pantalla" && FUENTES.archivo === "archivo" && FUENTES.pantalla === "pantalla", "y cada línea dice su fuente: moneda «archivo» · escala «pantalla»");
  ok(lineasDeDeclaracion({ monedaArchivo: "CLP", escala: "miles", } ).length === 2, "son exactamente dos líneas: Moneda y Escala");
}

/* ═══ 3 · LA CARNADA DEL ENCARGO · la plantilla con todos los montos ÷1000 ═══════════════════════════════════════ */
H("3 · LA CARNADA · una plantilla con TODOS los montos ÷1000 no se activa sin responder la escala");
{
  const lecturaOrig = await handleIngesta({ archivo: b64(ORIGINAL), nombre: "original.xlsx" }, {});
  const lecturaMiles = await handleIngesta({ archivo: b64(EN_MILES), nombre: "en-miles.xlsx" }, {});
  ok(lecturaOrig.ok && lecturaMiles.ok, "las dos lecturas pasan la validación (el archivo es válido: lo raro es el negocio, no la forma)");
  const vOrig = lecturaOrig.preview.totales.venta, vMiles = lecturaMiles.preview.totales.venta;
  ok(vOrig === 61483000 && vMiles === 61483,
    `LA SONDA: el mismo negocio escrito en miles lee «${vMiles.toLocaleString("es-CL")}» en vez de «${vOrig.toLocaleString("es-CL")}» — y carga igual`, `${vOrig} · ${vMiles}`);
  ok((lecturaMiles.alarmas || []).length === 0 && !lecturaMiles.apertura,
    "…SIN UNA SOLA ALARMA: es exactamente el hueco — ninguna lectura de plausibilidad puede saber la escala, y por eso se pregunta");
  ok(!lecturaMiles.dataset.perfil.escala, "el dataset de la primera lectura NO lleva `perfil.escala`: nadie la declaró, y no se inventa");
  ok(lecturaMiles.dataset.perfil.moneda === "CLP", "…y la moneda es la que la hoja Empresa trae explícita (CLP)");

  const ENV_BASE = { SUPABASE_URL: "https://x.supabase.co", SUPABASE_ANON_KEY: "k", SUPABASE_JWT_SECRET: "s" };
  /* a · el módulo: la escala se exige ANTES de tocar la base */
  const sinEscala = await activarVersion({ tenantId: "acme", versionId: "v-1", moneda: "CLP", env: ENV_BASE });
  ok(sinEscala.activada === false && sinEscala.sinEscala === true, "a · `activarVersion` sin escala NO activa (y ni siquiera llega a la base)");
  /* b · el endpoint */
  const SECRETO = "secreto-de-puerta-escala";
  const { code } = await makeAccessCode("prueba", 72, SECRETO, Date.now(), "acme");
  const epSinEscala = await handleIngesta({ op: "activar", versionId: "v-1", moneda: "CLP", access: code }, { ADI_TOKEN_SECRET: SECRETO });
  ok(epSinEscala.ok === false && epSinEscala.sinEscala === true, "b · el endpoint `activar` sin escala NO activa");
  /* c · el camino en memoria */
  const mSin = await handleIngesta({ op: "escalar", archivo: b64(EN_MILES), nombre: "en-miles.xlsx", moneda: "CLP" }, {});
  ok(mSin.ok === false && mSin.sinEscala === true && !mSin.dataset, "c · el endpoint `escalar` (camino en memoria) sin escala NO devuelve dataset alguno");
  const mSinMoneda = await handleIngesta({ op: "escalar", archivo: b64(SIN_MONEDA), nombre: "sin-moneda.xlsx", escala: "miles" }, {});
  ok(mSinMoneda.ok === false && mSinMoneda.sinMoneda === true && !mSinMoneda.dataset, "c · …ni con la escala pero SIN moneda de ninguna fuente (el archivo no la trae y nadie la declaró)");
  for (const raro of ["millones", "k", "1000", "raw", "M$"]) {
    const r = await handleIngesta({ op: "escalar", archivo: b64(EN_MILES), nombre: "en-miles.xlsx", escala: raro }, {});
    ok(r.ok === false && !r.dataset, `d · «${raro}» tampoco se interpreta como escala: no hay dataset`);
  }

  /* y declarada «miles», ESA plantilla es la original: mismo negocio, mismas cifras (la moneda es la del archivo) */
  const miles = await handleIngesta({ op: "escalar", archivo: b64(EN_MILES), nombre: "en-miles.xlsx", escala: "miles" }, {});
  const orig = await handleIngesta({ op: "escalar", archivo: b64(ORIGINAL), nombre: "original.xlsx", escala: "unidades" }, {});
  ok(miles.ok && orig.ok, "declarada «miles» la plantilla ÷1000 se procesa; la original, declarada «unidades», también");
  ok(miles.dataset.ventasKPI.totalActual === 61483000 && orig.dataset.ventasKPI.totalActual === 61483000,
    `★ la venta queda en 61.483.000 por los dos lados: ${miles.dataset.ventasKPI.totalActual} · ${orig.dataset.ventasKPI.totalActual}`);
  ok(sinPerfil(miles.dataset) === sinPerfil(orig.dataset),
    "★ y el pack ENTERO es idéntico (clientes, SKU, marcas, inventario, KPI, series, cobro): lo escrito en miles, ya convertido, ES el original");
}

/* ═══ 4 · «MILES» MULTIPLICA TODO LO MONETARIO Y NADA MÁS ═════════════════════════════════════════════════════ */
H("4 · «MILES» MULTIPLICA TODOS LOS CAMPOS MONETARIOS DEL CONTRATO Y NINGUNO DE LOS DEMÁS");
{
  const a = ingestarPlantilla(EN_MILES, { nombreArchivo: "o.xlsx", fechaCarga: FECHA, escala: "unidades" });
  const m = ingestarPlantilla(EN_MILES, { nombreArchivo: "o.xlsx", fechaCarga: FECHA, escala: "miles" });
  ok(a.ok && m.ok, "el mismo archivo (moneda CLP en la hoja Empresa), procesado declarando «unidades» y declarando «miles»");

  /* campo por campo, fila por fila: TODO el contrato, no una muestra */
  for (const c of columnasMonetarias()) {
    const filasA = a.hechos[c.hoja], filasM = m.hechos[c.hoja];
    const con = filasA.filter((f) => typeof f[c.campo] === "number");
    ok(con.length > 0, `${c.hoja}.${c.campo} (dinero): el archivo trae valores — el chequeo no es vacío (${con.length})`);
    const todos = filasA.every((f, i) => (typeof f[c.campo] !== "number") || filasM[i][c.campo] === multiplicar(f[c.campo], 1000));
    ok(todos, `${c.hoja}.${c.campo} (dinero): en las ${con.length} filas, miles = unidades × 1000 exacto`);
  }
  for (const c of columnasNoMonetarias()) {
    const filasA = a.hechos[c.hoja], filasM = m.hechos[c.hoja];
    ok(filasA.length > 0 && filasA.every((f, i) => f[c.campo] === filasM[i][c.campo]),
      `${c.hoja}.${c.campo} (cantidad): IDÉNTICO — no se multiplica jamás`);
  }
  const intactos = ["cliente", "fecha", "periodo", "folio", "tipoDoc", "condicion", "puntoVenta", "canal", "sku", "marca", "sfamilia"];
  ok(a.hechos.Ventas.every((f, i) => intactos.every((k) => f[k] === m.hechos.Ventas[i][k])), "textos, fechas, períodos y claves de Ventas: idénticos");
  ok(a.hechos.Abonos.every((f, i) => ["cliente", "fecha", "folio"].every((k) => f[k] === m.hechos.Abonos[i][k])), "…y los de Abonos");

  /* lo derivado: dinero ×1000, razones y cantidades intactas */
  const da = a.dataset, dm = m.dataset;
  ok(dm.ventasKPI.totalActual === da.ventasKPI.totalActual * 1000, "KPI · la venta del período es ×1000");
  ok(dm.skusMargen.every((s, i) => s.venta === da.skusMargen[i].venta * 1000 && s.costo === da.skusMargen[i].costo * 1000), "SKU · venta y costo ×1000");
  ok(dm.skusMargen.every((s, i) => s.margen === da.skusMargen[i].margen && s.pctRebate === da.skusMargen[i].pctRebate && s.unidades === da.skusMargen[i].unidades),
    "SKU · margen %, carga % y unidades IDÉNTICOS: los porcentajes y las cantidades no se tocan");
  ok(dm.skuInventario.every((s, i) => s.stockUnd === da.skuInventario[i].stockUnd && s.doh === da.skuInventario[i].doh && s.rotacion === da.skuInventario[i].rotacion),
    "inventario · stock físico, días y rotación IDÉNTICOS");
  ok(Math.abs(dm.invKPI.totalUSD - da.invKPI.totalUSD * 1000) <= da.skuInventario.length * 500, "inventario · el capital valorizado sale ×1000 (módulo el redondeo por SKU del lado chico)");
  ok(dm.escalaComercial === "raw", "el pack se declara en moneda cruda («raw»): con la conversión hecha, ya es verdad por construcción");

  /* LA PROCEDENCIA, LA MONEDA, SU FUENTE Y LA TRANSFORMACIÓN, dentro del pack */
  const pe = dm.perfil.escala;
  ok(pe && pe.valor === "miles" && pe.factor === 1000 && pe.moneda === "CLP" && pe.origen === "declarado por la empresa" && pe.origen === ORIGEN_DECLARACION,
    `perfil.escala: ${JSON.stringify({ valor: pe && pe.valor, factor: pe && pe.factor, moneda: pe && pe.moneda, origen: pe && pe.origen })}`);
  ok(pe.fuente.moneda === "archivo" && pe.fuente.escala === "pantalla",
    "…con la FUENTE de cada declaración: la moneda salió del archivo (la hoja Empresa la traía) y la escala de la pantalla");
  const tr = pe && pe.transformacion;
  ok(tr && tr.operacion === "multiplicar por 1000" && /miles/.test(tr.motivo) && /antes de calcular/.test(tr.motivo),
    "la transformación queda registrada con su porqué: qué se hizo y que fue antes de calcular");
  const registrados = (tr && tr.campos || []).map((c) => `${c.hoja}.${c.campo}`).sort().join(",");
  const esperados = columnasMonetarias().map((c) => `${c.hoja}.${c.campo}`).sort().join(",");
  ok(registrados === esperados, `…y registra EXACTAMENTE las columnas monetarias del contrato: ${registrados}`, `esperadas: ${esperados}`);
  ok(tr.campos.every((c) => c.celdas > 0), "con cuántas celdas se multiplicaron en cada una");
  ok(da.perfil.escala.valor === "unidades" && da.perfil.escala.transformacion === null && da.perfil.escala.origen === "declarado por la empresa",
    "«unidades» también queda declarado, con su procedencia y sin ninguna transformación");
  ok(da.perfil.moneda === "CLP" && dm.perfil.moneda === "CLP", "la moneda queda en el pack");

  /* la moneda de la PANTALLA, cuando el archivo no la trae: misma procedencia, otra fuente */
  const ps = ingestarPlantilla(SIN_MONEDA, { nombreArchivo: "s.xlsx", fechaCarga: FECHA, escala: "miles", moneda: "usd" });
  ok(ps.ok && ps.dataset.perfil.moneda === "USD" && ps.dataset.perfil.escala.fuente.moneda === "pantalla" && ps.dataset.perfil.escala.origen === "declarado por la empresa",
    "archivo SIN moneda + «usd» declarada en pantalla → el pack lleva USD con fuente «pantalla» y la misma procedencia");
  const sm = ingestarPlantilla(SIN_MONEDA, { nombreArchivo: "s.xlsx", fechaCarga: FECHA, escala: "miles" });
  ok(sm.ok === false && sm.preview.bloqueos.some((b) => b.tipo === "declaracion-faltante" && b.sinMoneda === true),
    "archivo SIN moneda y sin que nadie la declare → no hay pack: la moneda tampoco se supone");

  /* las TRES fuentes de la moneda y su precedencia: pantalla > archivo > empresa (carga anterior) */
  const base3 = { parametros: {}, Ventas: [], Inventario: [], Abonos: [] };
  const f3 = (hechos, o) => { const c = convertirHechos(hechos, "miles", o); return c.ok ? `${c.registro.moneda}/${c.registro.fuente.moneda}` : "RECHAZO"; };
  ok(f3({ ...base3, parametros: { moneda: "CLP" } }, { moneda: "USD", monedaHeredada: "EUR" }) === "USD/pantalla", "moneda: la de la pantalla gana");
  ok(f3({ ...base3, parametros: { moneda: "CLP" } }, { monedaHeredada: "EUR" }) === "CLP/archivo", "…luego la del archivo");
  ok(f3(base3, { monedaHeredada: "eur" }) === "EUR/empresa", "…y, si no hay otra, la que la empresa declaró antes: fuente «empresa»");
  ok(f3(base3, {}) === "RECHAZO", "sin ninguna de las tres no hay conversión");

  /* NO SE MUTA LA ENTRADA */
  const entrada = JSON.parse(JSON.stringify(a.hechos));
  const snapshot = JSON.stringify(entrada);
  const c = convertirHechos(entrada, "miles");
  ok(c.ok && JSON.stringify(entrada) === snapshot, "la conversión devuelve copias: las filas de entrada quedan intactas");

  /* montos con decimales + «miles» */
  const conDec = convertirHechos({ parametros: {}, Ventas: [{ venta: 61.4835, costo: 40.2, acciones: null, precioLista: undefined, unidades: 3 }], Inventario: [], Abonos: [] }, "miles", { moneda: "CLP" });
  ok(conDec.hechos.Ventas[0].venta === 61483.5 && conDec.hechos.Ventas[0].costo === 40200 && conDec.hechos.Ventas[0].acciones === null && conDec.hechos.Ventas[0].unidades === 3,
    "montos con decimales: 61,4835 → 61.483,5 · 40,2 → 40.200; los vacíos siguen vacíos y la cantidad igual");
  ok(convertirHechos({}, "millones", { moneda: "CLP" }).ok === false, "una escala que no es una de las dos no convierte nada");
}

/* ═══ 4b · NO SE INFIERE NADA QUE EL ARCHIVO NO DECLARE ═══════════════════════════════════════════════════════ */
H("4b · NO SE INFIERE NADA · ni de un encabezado («M$») ni del rango de los valores");
{
  /* la hoja Empresa trae «M$» donde va la moneda: no es un código, no es una declaración — ni de moneda ni de escala */
  const r = ingestarPlantilla(MONEDA_RARA, { nombreArchivo: "rara.xlsx", fechaCarga: FECHA });
  ok(r.ok && r.dataset.perfil.moneda === undefined && !r.dataset.perfil.escala,
    "con «M$» en la celda de moneda: el pack NO trae moneda ni escala — «M$» no se interpreta como «miles de pesos»");
  ok(r.preview.totales.venta === 61483, "…y los montos quedan exactamente como vinieron (61.483): nada se multiplicó por intuición");
  for (const cifra of ["MM$", "M$", "miles", "(en miles)"]) {
    const x = ingestarPlantilla(conMoneda(cifra), { nombreArchivo: "x.xlsx", fechaCarga: FECHA });
    ok(x.ok && !x.dataset.perfil.escala && x.preview.totales.venta === 61483, `«${cifra}» en la hoja Empresa: sin escala inferida, venta intacta`);
  }
  /* un encabezado de COLUMNA con «M$» NO se lee como miles: el archivo se rechaza con «unidad ambigua» (copiá el título tal cual) */
  const ventas = HOJAS.find((h) => h.nombre === "Ventas");
  const col = ventas.columnas.find((c) => c.campo === "venta");
  const tituloOriginal = col.titulo;
  let conTituloM = null;
  col.titulo = "venta (M$)";
  try { conTituloM = xlsx(datosEjemplo()); } finally { col.titulo = tituloOriginal; }
  const rm = await handleIngesta({ archivo: b64(conTituloM), nombre: "titulo-m.xlsx" }, {});
  ok(rm.ok === false && !rm.dataset && (rm.preview.bloqueos || []).some((b) => b.tipo === "unidad-ambigua"),
    "una columna rotulada «venta (M$)» NO se lee como miles: el archivo se rechaza por unidad ambigua, nunca se adivina");
  ok(ventas.columnas.find((c) => c.campo === "venta").titulo === "venta", "(el contrato quedó restaurado)");
  /* el rango de los valores tampoco: dos archivos de magnitud distinta reciben el mismo trato — ninguna escala */
  const chico = ingestarPlantilla(EN_MILES, { nombreArchivo: "c.xlsx", fechaCarga: FECHA });
  const grande = ingestarPlantilla(ORIGINAL, { nombreArchivo: "g.xlsx", fechaCarga: FECHA });
  ok(!chico.dataset.perfil.escala && !grande.dataset.perfil.escala && chico.preview.escala === undefined,
    "venta de 61.483 y de 61.483.000: ninguno recibe una escala por su tamaño");
}

/* ═══ 5 · LOS DOS CAMINOS CONVIERTEN IGUAL ════════════════════════════════════════════════════════════════════ */
/* EL DOBLE DE LA BASE + EL ENRUTADOR · RLS por pase y todo serializado como en la base real. El «fetch» es un enrutador
 * EN MEMORIA: contesta el endpoint de ingesta con el handler real y la base con el doble. No sale de este proceso. */
function dobleDeBase() {
  const T = { uploads: [], fact_pack_versions: [], tenants: [] };
  let nid = 0, reloj = 0;
  const copia = (x) => JSON.parse(JSON.stringify(x));
  const tenantDelPase = (pase) => { try { return JSON.parse(Buffer.from(String(pase).split(".")[1], "base64url").toString()).tenant_id; } catch { return null; } };
  const cli = {
    async seleccionar(tabla, o) {
      const t = tenantDelPase(o.pase);
      let filas = (T[tabla] || []).filter((f) => f.tenant_id === t);
      for (const [k, v] of Object.entries(o.filtros || {})) { const val = String(v).replace(/^(eq|is)\./, ""); filas = filas.filter((f) => String(f[k]) === val); }
      if (o.orden) { const [c, d] = o.orden.split("."); filas = [...filas].sort((a, b) => (a[c] < b[c] ? -1 : 1) * (d === "desc" ? -1 : 1)); }
      if (o.limite) filas = filas.slice(0, o.limite);
      return { ok: true, filas: copia(filas) };
    },
    async insertar(tabla, o) {
      const t = tenantDelPase(o.pase);
      const f = copia(Array.isArray(o.filas) ? o.filas[0] : o.filas);
      if (f.tenant_id !== t) return { ok: false, motivo: "RLS: tenant ajeno" };
      const con = { ...f, id: `id-${++nid}`, created_at: `2026-09-01T00:00:${String(++reloj).padStart(2, "0")}Z` };
      T[tabla].push(con);
      return { ok: true, filas: [copia(con)] };
    },
    async actualizar(tabla, o) {
      const t = tenantDelPase(o.pase);
      for (const f of T[tabla] || []) {
        if (f.tenant_id !== t) continue;
        let pasa = true;
        for (const [k, v] of Object.entries(o.filtros || {})) if (String(f[k]) !== String(v).replace(/^eq\./, "")) pasa = false;
        if (pasa) Object.assign(f, copia(o.cambios));
      }
      return { ok: true, filas: [] };
    },
    async subirObjeto() { return { ok: true, filas: [] }; },
    async llamarFuncion(nombre, args, o) {
      const t = tenantDelPase(o.pase);
      /* la herencia de moneda: activar con una moneda la deja TAMBIÉN en `tenants` (best-effort), de donde la lee la próxima carga */
      if (nombre === "adi_declarar_perfil_empresa") {
        let f = T.tenants.find((x) => x.tenant_id === t);
        if (!f) { f = { tenant_id: t }; T.tenants.push(f); }
        if (args.p_moneda) f.moneda = String(args.p_moneda).toUpperCase();
        return { ok: true, filas: [{ id: t, moneda: f.moneda || null }] };
      }
      const fila2 = T.fact_pack_versions.find((f) => f.id === args.p_version_id && f.tenant_id === t);
      if (!fila2) return { ok: false, motivo: "la versión no existe o no es alcanzable con este pase" };
      for (const f of T.fact_pack_versions) if (f.tenant_id === t) f.activa = false;
      fila2.activa = true;
      if (args.p_sello) fila2.sello = args.p_sello;
      /* lo mismo que hace la función SQL: la moneda se escribe en el pack, y SOLO la moneda */
      if (args.p_moneda) fila2.pack = { ...fila2.pack, perfil: { ...(fila2.pack.perfil || {}), moneda: String(args.p_moneda).toUpperCase() } };
      return { ok: true, filas: [{ id: fila2.id, version: fila2.version, activa: true }] };
    },
  };
  return { cli, T };
}
const SECRETO_PUERTA = "secreto-de-puerta-escala";
const ENV_CON_BASE = { SUPABASE_URL: "https://proyecto-de-prueba.supabase.co", SUPABASE_ANON_KEY: "llave-publica-de-prueba",
  SUPABASE_JWT_SECRET: "secreto-jwt-de-prueba", ADI_TOKEN_SECRET: SECRETO_PUERTA };
const BASE = dobleDeBase();
let ENV_ACTUAL = {};          // {} = sin empresa ni base (camino en memoria) · ENV_CON_BASE = camino guardado
const PEDIDOS = [];           // lo que la pantalla le mandó al endpoint
const respuesta = (cuerpo, ok = true, status = 200) => ({ ok, status, json: async () => cuerpo, text: async () => (typeof cuerpo === "string" ? cuerpo : JSON.stringify(cuerpo)) });
globalThis.fetch = async (url, init = {}) => {
  const u = new URL(String(url), "http://localhost");
  if (u.pathname.endsWith("adi-ingesta")) {
    const body = JSON.parse(init.body || "{}");
    PEDIDOS.push({ op: body.op || "subir", escala: body.escala, moneda: body.moneda, versionId: body.versionId });
    return respuesta(await handleIngesta(body, ENV_ACTUAL));
  }
  const pase = String((init.headers || {}).Authorization || "").replace(/^Bearer /, "");
  const filtros = {}; let columnas = "*", orden, limite;
  for (const [k, v] of u.searchParams) { if (k === "select") columnas = v; else if (k === "order") orden = v; else if (k === "limit") limite = Number(v); else filtros[k] = v; }
  let r;
  if (u.pathname.startsWith("/rest/v1/rpc/")) r = await BASE.cli.llamarFuncion(u.pathname.split("/").pop(), JSON.parse(init.body || "{}"), { pase });
  else if (u.pathname.startsWith("/rest/v1/")) {
    const tabla = u.pathname.split("/").pop();
    if (init.method === "GET") r = await BASE.cli.seleccionar(tabla, { pase, columnas, filtros, orden, limite });
    else if (init.method === "POST") r = await BASE.cli.insertar(tabla, { pase, filas: JSON.parse(init.body), devolver: /representation/.test((init.headers || {}).Prefer || "") });
    else if (init.method === "PATCH") r = await BASE.cli.actualizar(tabla, { pase, filtros, cambios: JSON.parse(init.body) });
  } else if (u.pathname.startsWith("/storage/v1/")) r = await BASE.cli.subirObjeto("adi-originales", "x", init.body, { pase });
  if (!r) return respuesta("ruta no simulada", false, 404);
  return r.ok ? respuesta(r.filas) : respuesta(r.motivo || "error", false, 400);
};
const codigoDe = async (empresa) => (await makeAccessCode("prueba", 72, SECRETO_PUERTA, Date.now(), empresa)).code;
const CODIGO = await codigoDe("acme");

H("5 · LOS DOS CAMINOS CONVIERTEN IGUAL · versión guardada y en memoria · con moneda del archivo y de la pantalla");
let DS_GUARDADO = null;
{
  /* ── moneda EN EL ARCHIVO (CLP): nadie la repite, y la fuente queda «archivo» ── */
  const mem = await handleIngesta({ op: "escalar", archivo: b64(EN_MILES), nombre: "en-miles.xlsx", escala: "miles" }, {});
  ok(mem.ok, "en memoria: `escalar` con «miles» (la moneda la trae el archivo) devuelve el dataset");

  const subida = await handleIngesta({ archivo: b64(EN_MILES), nombre: "en-miles.xlsx", access: CODIGO }, ENV_CON_BASE);
  ok(subida.ok && subida.persistencia.guardado === true && subida.persistencia.versionId, "guardado: la carga deja una versión INACTIVA con su versionId");
  const fila = BASE.T.fact_pack_versions.find((f) => f.id === subida.persistencia.versionId);
  ok(fila && fila.activa === false && fila.pack.ventasKPI.totalActual === 61483 && !fila.pack.perfil.escala,
    "…que guarda la lectura TAL COMO VINO (61.483 de venta, sin `perfil.escala`): no se convierte nada hasta que la empresa declare");
  const act = await handleIngesta({ op: "activar", versionId: subida.persistencia.versionId, escala: "miles", access: CODIGO }, ENV_CON_BASE);
  ok(act.ok && act.dataset, "guardado: `activar` con «miles» (sin repetir la moneda) activa y devuelve el pack", act.motivo);
  DS_GUARDADO = act.dataset;

  const difieren = Object.keys(act.dataset).filter((k) => !["perfil", "avisosDeCarga", "guardadoSinAnalizar", "hechos", "historiaCompleta", "flujoComercial"].includes(k)
    && JSON.stringify(act.dataset[k]) !== JSON.stringify(mem.dataset[k]));
  ok(sinPerfil(act.dataset) === sinPerfil(mem.dataset),
    "★ el pack del camino guardado y el del camino en memoria son IDÉNTICOS (clientes, SKU, marcas, inventario, KPI, series, cobro)",
    `difieren: ${difieren.join(", ")}`);
  ok(act.dataset.ventasKPI.totalActual === 61483000 && mem.dataset.ventasKPI.totalActual === 61483000, "ambos: venta 61.483.000");
  const pg = act.dataset.perfil.escala, pm = mem.dataset.perfil.escala;
  ok(pg.valor === "miles" && pg.valor === pm.valor && pg.factor === pm.factor && pg.origen === pm.origen && pg.origen === "declarado por la empresa" &&
     pg.moneda === "CLP" && pm.moneda === "CLP" && JSON.stringify(pg.transformacion) === JSON.stringify(pm.transformacion),
    "…y con la MISMA procedencia («declarado por la empresa»), moneda y transformación registradas en `perfil.escala`");
  ok(pg.fuente.moneda === "archivo" && pm.fuente.moneda === "archivo" && pg.fuente.escala === "pantalla" && pm.fuente.escala === "pantalla",
    "★ la FUENTE queda igual en los dos caminos: moneda «archivo» (la hoja Empresa) · escala «pantalla»");
  ok(act.dataset.perfil.moneda === "CLP" && mem.dataset.perfil.moneda === "CLP", "la moneda del archivo es la del pack, en los dos");
  ok(act.escala && act.escala.valor === "miles", "el endpoint devuelve la escala con la que quedó el pack");
  const activa = BASE.T.fact_pack_versions.filter((f) => f.tenant_id === "acme" && f.activa);
  ok(activa.length === 1 && activa[0].pack.ventasKPI.totalActual === 61483000 && activa[0].pack.perfil.escala.valor === "miles" && activa[0].pack.perfil.moneda === "CLP",
    "★ la fila ACTIVA de la base ya está convertida (61.483.000), declara su escala y lleva la moneda");
  ok(activa[0].pack.hechos.Ventas.every((v) => typeof v.venta === "number" && v.venta >= 1000),
    "…y sus hechos —lo que la próxima carga fusionará— también están en unidades");

  /* ── moneda AUSENTE en el archivo: la declara la empresa en la pantalla, y la fuente queda «pantalla» ── */
  const empB = await codigoDe("empresa-b");
  const memB = await handleIngesta({ op: "escalar", archivo: b64(SIN_MONEDA), nombre: "sin-moneda.xlsx", escala: "miles", moneda: "usd" }, {});
  const subB = await handleIngesta({ archivo: b64(SIN_MONEDA), nombre: "sin-moneda.xlsx", access: empB }, ENV_CON_BASE);
  ok(memB.ok && subB.persistencia.versionId, "sin moneda en el archivo: los dos caminos arrancan");
  /* …y sin que nadie la declare, el camino guardado tampoco activa (se mira al leer la versión, antes de escribir) */
  const escritosAntes = JSON.stringify(BASE.T.fact_pack_versions);
  const sinMonedaEp = await handleIngesta({ op: "activar", versionId: subB.persistencia.versionId, escala: "miles", access: empB }, ENV_CON_BASE);
  ok(sinMonedaEp.ok === false && sinMonedaEp.sinMoneda === true, "el endpoint `activar` con escala pero SIN moneda de ninguna fuente NO activa");
  const sinMonedaMod = await activarVersion({ tenantId: "empresa-b", versionId: subB.persistencia.versionId, escala: "miles", env: ENV_CON_BASE, cliente: BASE.cli });
  ok(sinMonedaMod.activada === false && sinMonedaMod.sinMoneda === true, "…y `activarVersion` tampoco");
  ok(JSON.stringify(BASE.T.fact_pack_versions) === escritosAntes, "…sin escribir ni una fila en la base");
  const actB = await handleIngesta({ op: "activar", versionId: subB.persistencia.versionId, escala: "miles", moneda: "usd", access: empB }, ENV_CON_BASE);
  ok(actB.ok, "con «usd» declarada en pantalla, activa", actB.motivo);
  ok(sinPerfil(actB.dataset) === sinPerfil(memB.dataset), "★ también aquí los dos caminos dan el mismo pack");
  ok(actB.dataset.perfil.moneda === "USD" && memB.dataset.perfil.moneda === "USD" && actB.dataset.perfil.escala.fuente.moneda === "pantalla" && memB.dataset.perfil.escala.fuente.moneda === "pantalla",
    "…con moneda USD y fuente «pantalla» en los dos");
  ok(BASE.T.tenants.some((x) => x.tenant_id === "empresa-b" && x.moneda === "USD"), "y la moneda declarada queda también en la empresa, de donde la leerá la carga siguiente");
}

H("5c · LA HERENCIA DE MONEDA · archivo sin moneda + empresa que ya la declaró: no se pregunta, no es «del archivo», se registra «empresa»");
{
  const empH = await codigoDe("empresa-h");
  BASE.T.tenants.push({ tenant_id: "empresa-h", moneda: "CLP" });   // la empresa declaró CLP en una carga anterior
  const subH = await handleIngesta({ archivo: b64(SIN_MONEDA), nombre: "sin-moneda-h.xlsx", access: empH }, ENV_CON_BASE);
  ok(subH.ok && subH.persistencia.versionId && subH.dataset.perfil.moneda === "CLP" && subH.dataset.perfil.monedaFuente === "empresa",
    "la lectura de un archivo SIN moneda hereda la de la empresa (CLP) y MARCA su fuente: «empresa»");
  ok(!subH.dataset.perfil.escala, "…pero la ESCALA no se hereda: la lectura no trae perfil.escala");
  const sinEsc = await handleIngesta({ op: "activar", versionId: subH.persistencia.versionId, access: empH }, ENV_CON_BASE);
  ok(sinEsc.ok === false && sinEsc.sinEscala === true, "y sin escala no se activa, aunque la moneda esté heredada: la escala se pregunta en cada carga");
  const actH = await handleIngesta({ op: "activar", versionId: subH.persistencia.versionId, escala: "miles", access: empH }, ENV_CON_BASE);
  ok(actH.ok && actH.dataset, "con la escala declarada, la activación FUNCIONA (sin que nadie repita la moneda)", actH.motivo);
  ok(actH.dataset.perfil.moneda === "CLP" && actH.dataset.ventasKPI.totalActual === 61483000, "…con moneda CLP y la venta convertida (61.483.000)");
  ok(actH.dataset.perfil.escala.fuente.moneda === "empresa" && actH.dataset.perfil.escala.fuente.escala === "pantalla" && actH.dataset.perfil.escala.origen === "declarado por la empresa",
    "★ perfil.escala.fuente.moneda registra «empresa» (no «archivo»); la escala, «pantalla»; el origen, «declarado por la empresa»");
  /* si el archivo SÍ trae moneda, manda el archivo y no se marca herencia */
  BASE.T.tenants.push({ tenant_id: "empresa-h2", moneda: "USD" });
  const subH2 = await handleIngesta({ archivo: b64(EN_MILES), nombre: "con-moneda-h2.xlsx", access: await codigoDe("empresa-h2") }, ENV_CON_BASE);
  ok(subH2.dataset.perfil.moneda === "CLP" && subH2.dataset.perfil.monedaFuente === undefined, "con moneda en el archivo (CLP) y otra recordada (USD), manda el archivo y no se marca herencia");
  /* una empresa que nunca declaró moneda sigue preguntando */
  const subH3 = await handleIngesta({ archivo: b64(SIN_MONEDA), nombre: "sin-moneda-h3.xlsx", access: await codigoDe("empresa-h3") }, ENV_CON_BASE);
  ok(subH3.dataset.perfil.moneda === undefined && subH3.dataset.perfil.monedaFuente === undefined, "una empresa que nunca declaró moneda: nada se hereda, se sigue preguntando");
}

/* ═══ 6 · LA PANTALLA, MONTADA DE VERDAD ══════════════════════════════════════════════════════════════════════ */
H("6 · LA PANTALLA · moneda del archivo se confirma, moneda ausente se pregunta, escala SIEMPRE se pregunta, sin preselección");
{
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  try { Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true }); } catch { /* ya definido */ }
  for (const k of ["HTMLElement", "Node", "File", "Blob", "FileReader", "Event"]) globalThis[k] = dom.window[k];
  globalThis.getComputedStyle = dom.window.getComputedStyle;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.localStorage = dom.window.localStorage;

  const root = path.dirname(fileURLToPath(import.meta.url));
  const bundles = [];
  process.on("exit", () => { for (const b of bundles) { try { fs.rmSync(b, { force: true }); } catch { /* regenerable */ } } });
  /* arma un bundle de la pantalla; `fuente` permite probar una COPIA MUTADA sin escribir nada en src/ */
  async function armar(nombre, fuente = null) {
    const salida = path.join(root, `_escala_declarada_gate_bundle.tmp${process.pid}_${nombre}.mjs`);
    bundles.push(salida);
    const cola = `\nexport { initTenant } from "../data/tenantStore.js";\nexport { TENANT_DEMO } from "../data/tenants/demo.js";\n`;
    await esbuild.build({
      stdin: { contents: (fuente === null ? `export { PanelDatos } from "./PanelDatos.jsx";` : fuente) + cola,
        resolveDir: path.join(root, "src", "ui"), loader: "jsx", sourcefile: `_panel_${nombre}.jsx` },
      bundle: true, outfile: salida, format: "esm", platform: "node", jsx: "automatic",
      external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "react/jsx-dev-runtime"], logLevel: "silent",
    });
    const mod = await import(pathToFileURL(salida).href);
    mod.initTenant(mod.TENANT_DEMO);
    return mod.PanelDatos;
  }
  const React = (await import("react")).default;
  const { render, fireEvent, waitFor, cleanup } = await import("@testing-library/react");

  const PANEL_FUENTE = leer("./src/ui/PanelDatos.jsx");
  const PanelReal = await armar("real");

  const Q = (c, id) => c.querySelector(`[data-testid="${id}"]`);
  const T = (c, id) => (Q(c, id) ? Q(c, id).textContent : null);
  const esPrimario = (el) => Boolean(el) && !/transparent/.test(el.style.background || "transparent");
  const archivo = (buf, nombre) => new dom.window.File([buf], nombre);
  const botonesMoneda = (c) => [Q(c, "datos-moneda-CLP"), Q(c, "datos-moneda-USD"), Q(c, "datos-moneda-otra")].filter(Boolean);
  const botonesEscala = (c) => [Q(c, "datos-escala-unidades"), Q(c, "datos-escala-miles")];

  /* sube un archivo y espera a que la preview esté lista */
  async function subir(Panel, buf, nombre = "datos.xlsx") {
    let activado = null;
    PEDIDOS.length = 0;
    const r = render(React.createElement(Panel, { sinDatos: null, activo: null, onCerrar: () => {}, onVerDemo: () => {}, onVolverAlDemo: () => {},
      onActivar: (dataset, sello, quien) => { activado = { dataset, sello, quien }; } }));
    fireEvent.change(Q(r.container, "datos-input"), { target: { files: [archivo(buf, nombre)] } });
    await waitFor(() => { if (!Q(r.container, "datos-activar")) throw new Error("la preview todavía no está"); }, { timeout: 8000 });
    return { ...r, activado: () => activado };
  }
  const reposo = () => new Promise((r) => setTimeout(r, 120));
  let HERENCIAS = 0, MUTANTES = 0;
  async function otroArchivo(w, buf, nombre) {
    fireEvent.click(Q(w.container, "datos-otro"));
    fireEvent.change(Q(w.container, "datos-input"), { target: { files: [archivo(buf, nombre)] } });
    await waitFor(() => { if (!Q(w.container, "datos-activar")) throw new Error("la preview todavía no está"); }, { timeout: 8000 });
  }

  /* LA COMPROBACIÓN QUE SE LE APLICA AL REAL Y A LOS MUTANTES · devuelve la lista de garantías rotas */
  async function garantiasRotas(Panel) {
    const rotas = [];

    /* A · LA HOJA EMPRESA TRAE LA MONEDA (CLP): se muestra «del archivo» y NO se pregunta; la escala SÍ */
    {
      const w = await subir(Panel, ORIGINAL);
      const c = w.container;
      if (Q(c, "datos-moneda") || botonesMoneda(c).length) rotas.push("se PREGUNTA la moneda aunque el archivo la trae");
      if (T(c, "datos-leido-moneda") !== "CLP (del archivo)") rotas.push(`«Esto es lo que leí» no dice «CLP (del archivo)»: «${T(c, "datos-leido-moneda")}»`);
      if (T(c, "datos-leido-escala") !== "sin indicar en el archivo") rotas.push(`la línea de escala no dice «sin indicar en el archivo»: «${T(c, "datos-leido-escala")}»`);
      if (T(c, "datos-declaracion-pregunta") !== "¿Los montos están en unidades de la moneda o en miles?") rotas.push("la pregunta no es solo de escala cuando la moneda viene en el archivo");
      if (botonesEscala(c).some((b) => !b)) rotas.push("falta alguna opción de escala");
      if (botonesEscala(c).some(esPrimario)) rotas.push("hay una escala PRESELECCIONADA");
      if (!Q(c, "datos-activar").disabled) rotas.push("el botón de activar está HABILITADO sin haber respondido la escala");
      if (!/Falta declarar la escala\./.test(c.textContent || "")) rotas.push("no avisa que falta declarar la escala");
      fireEvent.click(Q(c, "datos-activar"));
      await reposo();
      if (w.activado()) rotas.push("un clic forzado SIN la escala activó datos");
      fireEvent.click(Q(c, "datos-escala-miles"));
      if (Q(c, "datos-activar").disabled) rotas.push("al responder la escala el botón NO se habilita (la moneda del archivo se confirma con el mismo botón)");
      if (T(c, "datos-leido-escala") !== "en miles (declarada en pantalla)") rotas.push("la línea de escala no refleja la respuesta");
      w.unmount(); cleanup();
    }

    /* B · LA HOJA EMPRESA NO TRAE MONEDA: se pregunta la moneda y la escala, sin preselección */
    {
      const w = await subir(Panel, SIN_MONEDA);
      const c = w.container;
      if (!Q(c, "datos-moneda") || botonesMoneda(c).length !== 3) rotas.push("no se pregunta la moneda cuando el archivo no la trae");
      if (T(c, "datos-declaracion-pregunta") !== "¿En qué moneda y escala están expresados los montos?") rotas.push("la pregunta no es la de moneda y escala");
      if (T(c, "datos-leido-moneda") !== "sin indicar en el archivo") rotas.push("la línea de moneda no dice «sin indicar en el archivo»");
      if (botonesMoneda(c).some(esPrimario)) rotas.push("hay una moneda PRESELECCIONADA");
      if (botonesEscala(c).some(esPrimario)) rotas.push("hay una escala PRESELECCIONADA");
      if (!Q(c, "datos-activar").disabled) rotas.push("el botón de activar está HABILITADO sin haber respondido moneda y escala");
      if (!/Falta declarar la moneda y la escala\./.test(c.textContent || "")) rotas.push("no avisa que falta declarar moneda y escala");
      fireEvent.click(Q(c, "datos-escala-miles"));   // solo la escala
      if (!Q(c, "datos-activar").disabled) rotas.push("el botón se HABILITÓ con la escala sola: no esperó la moneda");
      fireEvent.click(Q(c, "datos-activar"));
      await reposo();
      if (w.activado()) rotas.push("un clic forzado SIN la moneda activó datos");
      await otroArchivo(w, SIN_MONEDA, "otra-vez.xlsx");   // las respuestas se reinician
      fireEvent.click(Q(c, "datos-moneda-USD"));            // solo la moneda
      if (!Q(c, "datos-activar").disabled) rotas.push("el botón se HABILITÓ con la moneda sola: no esperó la escala");
      fireEvent.click(Q(c, "datos-activar"));
      await reposo();
      if (w.activado()) rotas.push("un clic forzado SIN la escala activó datos");
      w.unmount(); cleanup();
    }

    /* C · EL ARCHIVO TRAE «M$» DONDE VA LA MONEDA: no es una declaración de nada — la escala sigue sin responder */
    {
      const w = await subir(Panel, MONEDA_RARA);
      const c = w.container;
      if (botonesEscala(c).some(esPrimario)) rotas.push("la escala quedó marcada por un «M$» del archivo: ESCALA INFERIDA");
      if (T(c, "datos-leido-escala") !== "sin indicar en el archivo") rotas.push("la línea de escala dejó de decir «sin indicar en el archivo» por un «M$»: ESCALA INFERIDA");
      if (!Q(c, "datos-activar").disabled) rotas.push("el botón de activar está HABILITADO por un «M$» del archivo: ESCALA INFERIDA");
      if (!Q(c, "datos-moneda")) rotas.push("«M$» no es una moneda y no debía dar la moneda por declarada");
      w.unmount(); cleanup();
    }

    /* D · EL ARCHIVO NO TRAE MONEDA PERO LA EMPRESA YA LA DECLARÓ ANTES: no se pregunta, se rotula «declarada antes por la
     * empresa» (jamás «del archivo») y se confirma con el mismo botón; la escala SÍ se pregunta */
    {
      const empresa = `herencia-${++HERENCIAS}`;
      BASE.T.tenants.push({ tenant_id: empresa, moneda: "CLP" });
      const antes = ENV_ACTUAL;
      ENV_ACTUAL = ENV_CON_BASE;
      localStorage.setItem("adi_access_v1", await codigoDe(empresa));
      try {
        const w = await subir(Panel, SIN_MONEDA);
        const c = w.container;
        if (Q(c, "datos-moneda") || botonesMoneda(c).length) rotas.push("se PREGUNTA la moneda herencia aunque la empresa ya la declaró");
        const linea = T(c, "datos-leido-moneda");
        if (linea !== "CLP (declarada antes por la empresa)") rotas.push(`la moneda heredada no se rotula «declarada antes por la empresa»: «${linea}»`);
        if (/del archivo/.test(linea || "")) rotas.push("la moneda heredada se rotula «del archivo»: es FALSO, no está en el archivo");
        if (T(c, "datos-declaracion-pregunta") !== "¿Los montos están en unidades de la moneda o en miles?") rotas.push("con la moneda heredada la pregunta no es solo de escala");
        if (botonesEscala(c).some(esPrimario)) rotas.push("hay una escala PRESELECCIONADA (con moneda heredada)");
        if (!Q(c, "datos-activar").disabled) rotas.push("el botón de activar está HABILITADO sin escala (con moneda heredada)");
        fireEvent.click(Q(c, "datos-escala-miles"));
        if (Q(c, "datos-activar").disabled) rotas.push("la moneda heredada no se confirma con el mismo botón: sigue deshabilitado con la escala respondida");
        w.unmount(); cleanup();
      } finally { localStorage.removeItem("adi_access_v1"); ENV_ACTUAL = antes; }
    }
    return rotas;
  }

  /* ── 6a · la pantalla real cumple las garantías ── */
  {
    const rotas = await garantiasRotas(PanelReal);
    ok(rotas.length === 0, "la pantalla REAL: moneda del archivo se confirma sin preguntar · moneda ausente se pregunta · escala siempre se pregunta · sin preselección · botón en candado · «M$» no infiere nada", rotas.join(" · "));
  }

  /* ── 6b · LAS CARNADAS · cinco mutantes del componente tienen que ser cazados por la MISMA comprobación ── */
  {
    const muta = (nombre, desde, hasta, buscado) => {
      const m = PANEL_FUENTE.replace(desde, () => hasta);
      ok(m !== PANEL_FUENTE, `(el mutante «${nombre}» se pudo fabricar: el código que muta existe tal cual)`);
      return armar(`mut${++MUTANTES}`, m).then((P) => garantiasRotas(P)).then((rotas) => {
        ok(rotas.some((x) => buscado.test(x)), `CARNADA «${nombre}» → ROJO (la comprobación la caza: ${rotas.length} garantía(s) rota(s))`, rotas.join(" · "));
      });
    };
    const RESET = 'setMoneda(""); setOtraMoneda(""); setEscala("");   //';
    await muta("escala preseleccionada", RESET, 'setMoneda(""); setOtraMoneda(""); setEscala("unidades");   //', /escala PRESELECCIONADA/);
    await muta("moneda preseleccionada", RESET, 'setMoneda("CLP"); setOtraMoneda(""); setEscala("");   //', /moneda PRESELECCIONADA/);
    await muta("botón sin candado", "disabled={guardando || !monedaLista || !escalaLista ||", "disabled={guardando || !monedaLista ||", /HABILITADO|HABILIT/);
    await muta("escala inferida de M$", "const escalaElegida = escalaLimpia(escala);",
      'const escalaElegida = escalaLimpia(escala) || (/M\\$/.test(String(r && r.preview && r.preview.parametros && r.preview.parametros.moneda)) ? "miles" : null);', /ESCALA INFERIDA/);
    await muta("moneda del archivo preguntada", "const faltaMoneda = Boolean(r && r.ok && !monedaDelArchivo && !monedaDeLaEmpresa);", "const faltaMoneda = Boolean(r && r.ok);", /se PREGUNTA la moneda aunque el archivo la trae/);
    await muta("heredada rotulada del archivo", "const monedaDelArchivo = monedaDelDataset && !monedaDeLaEmpresa ? monedaDelDataset : null;", "const monedaDelArchivo = monedaDelDataset;", /rotula «del archivo»|no se rotula «declarada antes por la empresa»/);
    await muta("heredada preguntada", "const faltaMoneda = Boolean(r && r.ok && !monedaDelArchivo && !monedaDeLaEmpresa);", "const faltaMoneda = Boolean(r && r.ok && !monedaDelArchivo);", /se PREGUNTA la moneda herencia/);
  }

  /* ── 6c · EL FLUJO COMPLETO EN MEMORIA, moneda en el archivo ── */
  {
    ENV_ACTUAL = {};
    const w = await subir(PanelReal, EN_MILES, "en-miles.xlsx");
    const c = w.container;
    ok(T(c, "datos-leido-moneda") === "CLP (del archivo)" && T(c, "datos-leido-escala") === "sin indicar en el archivo",
      "«Esto es lo que leí» muestra: «Moneda: CLP (del archivo)» · «Escala: sin indicar en el archivo»");
    ok(T(c, "datos-declaracion-pregunta") === "¿Los montos están en unidades de la moneda o en miles?", "y la pregunta es solo de escala: «¿Los montos están en unidades de la moneda o en miles?»");
    ok(T(c, "datos-escala-unidades") === "En unidades de la moneda" && T(c, "datos-escala-miles") === "En miles", "con sus dos respuestas: «En unidades de la moneda» · «En miles»");
    ok(!Q(c, "datos-moneda"), "NO hay pregunta de moneda: ya la trae el archivo");
    ok(Q(c, "datos-activar").disabled === true, "el botón de activar parte en candado");
    fireEvent.click(Q(c, "datos-escala-miles"));
    ok(esPrimario(Q(c, "datos-escala-miles")) && !esPrimario(Q(c, "datos-escala-unidades")), "al responder queda marcada solo la elegida");
    ok(Q(c, "datos-activar").disabled === false, "con la escala respondida el botón se habilita: la moneda se confirma con el mismo botón");
    ok(T(c, "datos-leido-escala") === "en miles (declarada en pantalla)", "y la línea de escala pasa a «en miles (declarada en pantalla)»");
    fireEvent.click(Q(c, "datos-activar"));
    await waitFor(() => { if (!w.activado()) throw new Error("todavía no activó"); }, { timeout: 8000 });
    const ds = w.activado().dataset;
    const ped = PEDIDOS.find((p) => p.op === "escalar");
    ok(ped && ped.escala === "miles" && ped.moneda === undefined && !PEDIDOS.some((p) => p.op === "activar"),
      "en memoria la pantalla pidió `escalar` con «miles» y SIN moneda (la del archivo la pone el servidor); no usó `activar`");
    ok(ds.ventasKPI.totalActual === 61483000, `★ lo ACTIVADO en la sesión tiene la venta en 61.483.000, no en 61.483: ${ds.ventasKPI.totalActual}`);
    ok(ds.perfil.escala.valor === "miles" && ds.perfil.escala.origen === "declarado por la empresa" && ds.perfil.moneda === "CLP" &&
       ds.perfil.escala.fuente.moneda === "archivo" && ds.perfil.escala.fuente.escala === "pantalla" && ds.perfil.escala.transformacion.operacion === "multiplicar por 1000",
      "…con su procedencia, moneda y fuente (archivo · pantalla) y la transformación dentro del pack");
    ok(JSON.stringify(ds.skusMargen) === JSON.stringify(DS_GUARDADO.skusMargen), "…y los SKU activados son los mismos que dejó el camino guardado");
    w.unmount(); cleanup();
  }

  /* ── 6d · EL FLUJO EN MEMORIA, moneda AUSENTE: se pregunta y viaja ── */
  {
    ENV_ACTUAL = {};
    const w = await subir(PanelReal, SIN_MONEDA, "sin-moneda.xlsx");
    const c = w.container;
    ok(T(c, "datos-leido-moneda") === "sin indicar en el archivo" && T(c, "datos-declaracion-pregunta") === "¿En qué moneda y escala están expresados los montos?",
      "sin moneda en el archivo: «Moneda: sin indicar en el archivo» y la pregunta de moneda y escala");
    fireEvent.click(Q(c, "datos-moneda-USD"));
    fireEvent.click(Q(c, "datos-escala-miles"));
    ok(T(c, "datos-leido-moneda") === "USD (declarada en pantalla)" && T(c, "datos-leido-escala") === "en miles (declarada en pantalla)",
      "al responder, las dos líneas dicen «USD (declarada en pantalla)» · «en miles (declarada en pantalla)»");
    fireEvent.click(Q(c, "datos-activar"));
    await waitFor(() => { if (!w.activado()) throw new Error("todavía no activó"); }, { timeout: 8000 });
    const ped = PEDIDOS.find((p) => p.op === "escalar");
    const ds = w.activado().dataset;
    ok(ped && ped.moneda === "USD" && ped.escala === "miles", "la pantalla mandó moneda USD y escala miles");
    ok(ds.perfil.moneda === "USD" && ds.perfil.escala.fuente.moneda === "pantalla" && ds.ventasKPI.totalActual === 61483000,
      "lo activado: USD, fuente «pantalla», venta 61.483.000");
    w.unmount(); cleanup();
  }

  /* ── 6e · EL FLUJO GUARDADO · con empresa y base: la escala (y la moneda, si la dio la pantalla) viajan en `activar` ── */
  {
    ENV_ACTUAL = ENV_CON_BASE;
    localStorage.setItem("adi_access_v1", await codigoDe("empresa-ui"));
    const w = await subir(PanelReal, EN_MILES, "en-miles-2.xlsx");
    const c = w.container;
    ok(PEDIDOS.length === 1 && PEDIDOS[0].op === "subir", "con empresa y base, la carga guardó una versión inactiva");
    ok(Q(c, "datos-activar").disabled === true && !Q(c, "datos-moneda"), "el botón sigue en candado hasta responder la escala, y la moneda no se pregunta (la trae el archivo)");
    fireEvent.click(Q(c, "datos-escala-miles"));
    fireEvent.click(Q(c, "datos-activar"));
    await waitFor(() => { if (!w.activado()) throw new Error("todavía no activó"); }, { timeout: 8000 });
    const act = PEDIDOS.find((p) => p.op === "activar");
    ok(act && act.escala === "miles" && act.moneda === undefined && act.versionId, `la pantalla mandó \`activar\` con la escala y la versión, sin moneda: ${JSON.stringify(act)}`, JSON.stringify(PEDIDOS));
    ok(!PEDIDOS.some((p) => p.op === "escalar"), "…y NO usó el camino en memoria");
    const ds = w.activado().dataset;
    ok(ds.ventasKPI.totalActual === 61483000 && ds.perfil.escala.valor === "miles" && ds.perfil.moneda === "CLP" && ds.perfil.escala.fuente.moneda === "archivo",
      "★ lo activado en la sesión es el pack convertido que devolvió el servidor, con la moneda del archivo");
    ok(JSON.stringify(ds.skusMargen) === JSON.stringify(DS_GUARDADO.skusMargen), "idéntico al del camino en memoria");
    w.unmount(); cleanup();

    /* con moneda ausente: «Otra» con un código inválido de una letra no vale; con «eur» sí, y viaja */
    localStorage.setItem("adi_access_v1", await codigoDe("empresa-ui-2"));
    const w2 = await subir(PanelReal, SIN_MONEDA, "sin-moneda-2.xlsx");
    const c2 = w2.container;
    fireEvent.click(Q(c2, "datos-moneda-otra"));
    fireEvent.change(Q(c2, "datos-moneda-input"), { target: { value: "e" } });
    fireEvent.click(Q(c2, "datos-escala-miles"));
    ok(Q(c2, "datos-activar").disabled === true, "una «moneda» de una sola letra no vale: sigue el control de siempre (2 a 6 letras) y el botón en candado");
    fireEvent.change(Q(c2, "datos-moneda-input"), { target: { value: "eur" } });
    ok(Q(c2, "datos-activar").disabled === false, "con «eur» (Otra) y «miles» se habilita");
    fireEvent.click(Q(c2, "datos-activar"));
    await waitFor(() => { if (!w2.activado()) throw new Error("todavía no activó"); }, { timeout: 8000 });
    const act2 = PEDIDOS.find((p) => p.op === "activar");
    ok(act2 && act2.escala === "miles" && act2.moneda === "EUR" && act2.versionId, `la pantalla mandó \`activar\` con escala, moneda EUR y versión: ${JSON.stringify(act2)}`);
    const ds2 = w2.activado().dataset;
    ok(ds2.perfil.moneda === "EUR" && ds2.perfil.escala.fuente.moneda === "pantalla" && ds2.ventasKPI.totalActual === 61483000,
      "lo activado lleva EUR, fuente «pantalla» y la venta convertida");
    w2.unmount(); cleanup();
    localStorage.removeItem("adi_access_v1");
    ENV_ACTUAL = {};
  }

  /* ── 6e2 · EL FLUJO GUARDADO CON MONEDA HEREDADA: la escala viaja, la moneda no se repite y queda «empresa» ── */
  {
    ENV_ACTUAL = ENV_CON_BASE;
    BASE.T.tenants.push({ tenant_id: "empresa-ui-h", moneda: "CLP" });
    localStorage.setItem("adi_access_v1", await codigoDe("empresa-ui-h"));
    const w = await subir(PanelReal, SIN_MONEDA, "sin-moneda-h.xlsx");
    const c = w.container;
    ok(T(c, "datos-leido-moneda") === "CLP (declarada antes por la empresa)" && T(c, "datos-leido-escala") === "sin indicar en el archivo",
      "«Esto es lo que leí» muestra: «Moneda: CLP (declarada antes por la empresa)» · «Escala: sin indicar en el archivo»");
    ok(!Q(c, "datos-moneda") && T(c, "datos-declaracion-pregunta") === "¿Los montos están en unidades de la moneda o en miles?",
      "no hay pregunta de moneda, y la pregunta es solo de escala");
    ok(Q(c, "datos-activar").disabled === true, "el botón parte en candado");
    fireEvent.click(Q(c, "datos-escala-miles"));
    ok(Q(c, "datos-activar").disabled === false, "con la escala respondida se habilita: la moneda recordada se confirma con el mismo botón");
    fireEvent.click(Q(c, "datos-activar"));
    await waitFor(() => { if (!w.activado()) throw new Error("todavía no activó"); }, { timeout: 8000 });
    const act = PEDIDOS.find((p) => p.op === "activar");
    ok(act && act.escala === "miles" && act.moneda === undefined && act.versionId, `la pantalla mandó \`activar\` con la escala y SIN moneda: ${JSON.stringify(act)}`);
    const ds = w.activado().dataset;
    ok(ds.perfil.moneda === "CLP" && ds.ventasKPI.totalActual === 61483000 && ds.perfil.escala.fuente.moneda === "empresa" && ds.perfil.escala.fuente.escala === "pantalla",
      "★ lo activado: CLP, venta convertida, y la procedencia registra moneda «empresa» · escala «pantalla»");
    w.unmount(); cleanup();
    localStorage.removeItem("adi_access_v1");
    ENV_ACTUAL = {};
  }

  /* ── 6f · SUBIR OTRO ARCHIVO REINICIA LAS RESPUESTAS: se pregunta con cada carga ── */
  {
    ENV_ACTUAL = {};
    const w = await subir(PanelReal, ORIGINAL, "uno.xlsx");
    fireEvent.click(Q(w.container, "datos-escala-unidades"));
    ok(Q(w.container, "datos-activar").disabled === false, "con la escala elegida (y la moneda del archivo) se habilita");
    await otroArchivo(w, SIN_MONEDA, "dos.xlsx");
    ok(![...botonesMoneda(w.container), ...botonesEscala(w.container)].some(esPrimario) && Q(w.container, "datos-activar").disabled === true,
      "al subir OTRO archivo las respuestas vuelven a estar vacías: la respuesta es de cada carga, no se arrastra");
    w.unmount(); cleanup();
  }
}

/* ═══ 7 · CERO CÁLCULO NI INFERENCIA EN LA VISTA ══════════════════════════════════════════════════════════════ */
H("7 · CERO CÁLCULO NI INFERENCIA EN REACT · la pantalla pinta, el motor multiplica");
{
  const PANEL = leer("./src/ui/PanelDatos.jsx");
  const sinComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  const codigo = sinComentarios(PANEL);
  const multiplica = (s) => /[*]\s*1000|1000\s*[*]|\b1e3\b|\bmultiplicar\b|\baUnidades\b|convertirHechos|convertirEscala/.test(s);
  const infiere = (s) => /M\$|MM\$|miles de pesos|\/miles\/|\.includes\(["']miles["']\)/.test(s) || !/const escalaElegida = escalaLimpia\(escala\);/.test(s);
  ok(!multiplica(codigo), "la pantalla no multiplica ni importa la conversión: ni `* 1000`, ni `multiplicar`, ni `convertirHechos`");
  ok(!/ingestarPlantilla|leerLibro|node:zlib/.test(PANEL), "…ni arrastra el motor de ingesta al navegador");
  ok(!/En miles|En unidades de la moneda/.test(codigo) && /from "\.\.\/config\/escala\.js"/.test(PANEL) && /preguntaDeDeclaracion\(/.test(codigo) && /lineasDeDeclaracion\(/.test(codigo),
    "la pregunta, los rótulos y las dos líneas de «lo que leí» vienen del módulo, no están escritos en la pantalla");
  ok(!infiere(codigo) && !/perfil\.escala/.test(codigo),
    "la escala sale ÚNICAMENTE de lo que la empresa respondió: sin «M$», sin «miles» buscado en el archivo, sin leer `perfil.escala`");
  ok(/const monedaDelDataset = \(r && r\.dataset && r\.dataset\.perfil && r\.dataset\.perfil\.moneda\) \|\| null;/.test(codigo)
    && /r\.dataset\.perfil\.monedaFuente === FUENTES\.empresa/.test(codigo) && /const monedaDelArchivo = monedaDelDataset && !monedaDeLaEmpresa \? monedaDelDataset : null;/.test(codigo),
    "lo ÚNICO que se toma de la lectura es la moneda que dejó el servidor en `perfil.moneda`: la del parámetro «moneda» de la hoja Empresa («del archivo») o la que la empresa declaró antes (marcada «empresa»)");
  /* CARNADAS · un `* 1000` colado y una inferencia de escala desde un encabezado tienen que ponerse rojos */
  const colado = PANEL.replace("const escalaLista = escalaElegida !== null;", "const escalaLista = escalaElegida !== null; const falso = ((r && r.preview && r.preview.totales.venta) || 0) * 1000;");
  ok(colado !== PANEL && multiplica(sinComentarios(colado)), "CARNADA: un `* 1000` colado en la pantalla es detectado por el chequeo de arriba");
  const inferida = PANEL.replace("const escalaElegida = escalaLimpia(escala);", 'const escalaElegida = escalaLimpia(escala) || (/M\\$/.test(JSON.stringify(r && r.preview && r.preview.hojas)) ? "miles" : null);');
  ok(inferida !== PANEL && infiere(sinComentarios(inferida)), "CARNADA: una escala inferida desde un encabezado «M$» colada en la pantalla es detectada por el chequeo de arriba");
}

/* ═══ 8 · LA PLANTILLA NO SE TOCÓ ═════════════════════════════════════════════════════════════════════════════ */
H("8 · LA ESTRUCTURA CONGELADA SIGUE IDÉNTICA · la escala vive en la pantalla, no en una columna");
{
  const sello = PLANTILLA_SELLADA[PLANTILLA_VERSION];
  ok(PLANTILLA_VERSION === "v2" && !!sello, `la versión de la plantilla no cambió (${PLANTILLA_VERSION}) y sigue sellada`);
  for (const h of HOJAS) {
    const viva = h.columnas.map((c) => ({ campo: c.campo, titulo: c.titulo, obligatoria: !!c.obligatoria }));
    const r = compararColumnas(sello.hojas[h.nombre], viva);
    ok(r.compatible && r.agregadas.length === 0 && viva.length === sello.hojas[h.nombre].length,
      `«${h.nombre}»: ni una columna agregada, quitada, renombrada ni vuelta obligatoria (${viva.length} columnas)`);
  }
  ok(!PARAMETROS.some((p) => /escala/i.test(p.clave) || /escala/i.test(p.etiqueta)), "la hoja Empresa NO tiene un campo de escala");
  ok(!HOJAS.some((h) => h.columnas.some((c) => /escala|miles/i.test(c.titulo))), "ningún título de columna habla de escala ni de miles");
  ok(!/magnitud|escala/i.test(leer("./src/config/contract/plantillaSellada.js").replace(/\/\*[\s\S]*?\*\//g, "")), "el sello no se editó para acomodar el cambio");
}

console.log(`\n── _escala_declarada_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail === 0 ? 0 : 1);
