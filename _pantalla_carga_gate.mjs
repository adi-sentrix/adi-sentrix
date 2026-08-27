/* === _pantalla_carga_gate.mjs · LA PANTALLA DE CARGA (v1.4 · owner 2026-08-25) ================================
 * LO QUE PIDIÓ, textual: «que el usuario pueda subir la plantilla, ver la preview, confirmar si hay alertas, y
 * dejar esos datos activos para que ADI responda sobre ellos». Cuatro pasos; este gate prueba los cuatro y, sobre
 * todo, el ORDEN en que ocurren.
 *
 * ⚠️ EL ORDEN ES LA DECISIÓN, no un detalle de maquetación. El owner eligió que la observación abra ANTES del
 * resumen: «el usuario sabrá que ya detectamos algo, y él deberá confirmar si seguimos así». Un aviso puesto
 * debajo de un resumen tranquilizador es un aviso que llegó tarde. Por eso la sección 4 no comprueba que el texto
 * EXISTA —eso es fácil— sino que esté ARRIBA, y lo comprueba contra una carnada que lo invierte.
 *
 * ⚠️ POR QUÉ EL ARCHIVO SE PROCESA EN EL SERVIDOR: `leerLibro` descomprime el .xlsx con `node:zlib`, que el
 * navegador no tiene. No es una preferencia de arquitectura: es que el código no puede correr allá. La sección 1
 * fija ese hecho, porque si alguien lo olvida y mueve la ingesta al bundle, la pantalla muere sin aviso claro.
 *
 * @inspeccion-estatica · lee `gatewayFetch.js` y los .jsx COMO TEXTO para certificar que el cableado existe. No
 * importa el gateway ni ningún adapter, y no invoca a nadie. El candado de runtime se le aplica igual.
 *
 * OFFLINE · módulos puros de ingesta + lectura de fuentes · no puede gastar. */
import { readFileSync } from "node:fs";
import { handleIngesta } from "./src/ingesta/handleIngesta.server.js";
import { PARAMETROS } from "./src/config/contract/plantilla.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";

let pass = 0, fail = 0;
const ok = (cond, label, detalle) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ FALLO: ${label}${detalle !== undefined ? ` — ${detalle}` : ""}`); }
};
const leer = (p) => { try { return readFileSync(p, "utf8"); } catch { return ""; } };

const PANEL = leer("./src/ui/PanelDatos.jsx");
const BARRA = leer("./src/ui/BarraLateral.jsx");
const APP   = leer("./src/ui/App.jsx");
const RUTAS = leer("./src/adi/llm/gatewayFetch.js");

console.log("=".repeat(100));
console.log("1 · POR QUÉ EN EL SERVIDOR · el navegador no puede descomprimir un .xlsx");
console.log("=".repeat(100));
{
  const libro = leer("./src/ingesta/leerLibro.js");
  ok(/node:zlib/.test(libro), "`leerLibro` descomprime con node:zlib — el hecho que decide toda la arquitectura");
  ok(!/leerLibro|ingestarPlantilla|node:zlib/.test(PANEL),
    "y la pantalla NO lo importa: si lo hiciera, el bundle se rompería al construirse");
  const ep = leer("./api/adi-ingesta.js");
  ok(ep.length > 0 && !/runtime:\s*["']edge["']/.test(ep),
    "el endpoint NO declara runtime edge — el edge tampoco tiene zlib (adi-data sí es edge, y por eso no servía)");
}

console.log("\n" + "=".repeat(100));
console.log("2 · LA RUTA VIVE APARTE DEL ROUTER · y esa separación es la que mantiene vivo el deploy");
console.log("=".repeat(100));
{
  /* ⚠️ ACÁ HUBO UN DEFECTO CARO (2026-08-26). La primera versión montó esta ruta en `gatewayFetch`, imitando a
   * la vía 1. Pero a `gatewayFetch` lo importan los CINCO endpoints que corren en EDGE, y la ingesta arrastra
   * `node:zlib`: Vercel falló el build entero en tres commits y producción se quedó atrás — con los 177 gates
   * en verde, porque ninguno empaquetaba para edge. El reparto correcto es este, y quien lo vigila de verdad
   * es `_edge_bundle_gate`, que empaqueta cada endpoint edge como lo hace la plataforma. */
  /* Se miran los IMPORTS, no las menciones: un chequeo que busca la palabra se pone rojo con el comentario que
   * explica por qué esa palabra no se usa. Pasó en la primera versión de este mismo gate. */
  const ep = leer("./api/adi-ingesta.js");
  ok(/import\s*\{[^}]*handleIngesta[^}]*\}/.test(ep), "el endpoint importa el handler de ingesta");
  ok(!/^\s*import[^\n]*from\s*["'][^"']*gatewayFetch\.js["']/m.test(ep),
    "…y NO importa el router compartido: llama al handler directo");
  ok(!/^\s*import[^\n]*handleIngesta/m.test(RUTAS),
    "y el router no la importa: así ningún endpoint edge arrastra un módulo de Node");
  const srv = leer("./server.js");
  ok(/adi-ingesta/.test(srv) && /handleIngesta/.test(srv),
    "el servidor local sirve la misma ruta por el mismo camino — si divergen, probar local deja de probar producción");
}

console.log("\n" + "=".repeat(100));
console.log("3 · EL CICLO COMPLETO · lo que el usuario baja, lo puede volver a subir");
console.log("=".repeat(100));
let respuestaConAlarma = null;
{
  const baja = await handleIngesta({ op: "plantilla", conEjemplo: false });
  ok(baja.ok && baja.nombre.endsWith(".xlsx"), `la plantilla vacía se genera del contrato (${baja.nombre})`);
  const conEj = await handleIngesta({ op: "plantilla", conEjemplo: true });
  const sube = await handleIngesta({ archivo: conEj.archivo, nombre: conEj.nombre });
  ok(sube.ok, "y la de ejemplo, al volver a subirla, produce un dataset");

  /* LA CONDICIÓN QUE HACE CHICA A LA PANTALLA: si el dataset tiene las mismas claves que el tenant de
   * referencia, `initTenant` lo activa sin adaptador. Si algún día divergen, la pantalla activaría un negocio a
   * medias y media app quedaría pintando lo anterior — sin error, que es lo peligroso. */
  const faltan = Object.keys(TENANT_DEMO).filter((k) => !(k in sube.dataset));
  ok(faltan.length === 0,
    `el dataset trae las ${Object.keys(TENANT_DEMO).length} claves del tenant de referencia: initTenant lo activa directo`,
    `faltan: ${faltan.join(", ")}`);
}

console.log("\n" + "=".repeat(100));
console.log("4 · EL ORDEN QUE ELIGIÓ EL OWNER · la observación ABRE, no cierra");
console.log("=".repeat(100));
{
  const iApertura = PANEL.indexOf("datos-apertura");
  const iPreview  = PANEL.indexOf("Esto es lo que leí");
  const iBoton    = PANEL.indexOf("datos-activar");
  ok(iApertura > 0 && iPreview > 0 && iBoton > 0, "los tres momentos existen en la pantalla");
  ok(iApertura < iPreview, `la apertura va ANTES del resumen (${iApertura} < ${iPreview})`);
  ok(iPreview < iBoton, "y el botón de confirmar va al final, después de haber mostrado todo");

  /* CARNADA · este chequeo tiene que poder ponerse rojo. Se invierte el orden sobre una COPIA del texto y se
   * comprueba que la comparación lo detecta. Sin esto, un `<` que siempre da true pasaría por garantía —
   * ya pasó cinco veces en este repo que un chequeo mío estuviera verde y ciego. */
  const invertido = PANEL.replace(/datos-apertura/, "zzz-movida").concat("\ndatos-apertura");
  const jA = invertido.indexOf("datos-apertura"), jP = invertido.indexOf("Esto es lo que leí");
  ok(!(jA < jP), "y la comprobación SE PONE ROJA si alguien baja la apertura debajo del resumen (carnada)");
}

console.log("\n" + "=".repeat(100));
console.log("5 · AVISA, PREGUNTA Y NO BLOQUEA · el negocio raro es del cliente");
console.log("=".repeat(100));
{
  /* Un archivo verosímil en la forma pero con un período mucho menos cargado que el otro: pasa los 22 chequeos
   * del validador y aun así hay algo que decir. Es el caso que separa «leer» de «entender». */
  const conEj = await handleIngesta({ op: "plantilla", conEjemplo: true });
  const r = await handleIngesta({ archivo: conEj.archivo, nombre: "negocio.xlsx" });
  respuestaConAlarma = r;
  ok(r.ok && !!r.dataset, "con alarmas o sin ellas, el dataset viaja igual: la lectura NO bloquea");
  ok(Array.isArray(r.alarmas), "las alarmas viajan aparte de los bloqueos del validador — son cosas distintas");
  ok(r.apertura === null || /\?/.test(r.apertura),
    "y cuando hay apertura, termina preguntando: es una hipótesis sobre el archivo, no un diagnóstico");

  /* LA SEÑAL QUE NACIÓ MUERTA UNA VEZ: necesita el conteo de filas por período. Si el motor deja de emitirlo,
   * vuelve a ser verde-para-siempre sin que nadie lo note. Acá se fija el insumo, no el resultado. */
  ok(r.preview && r.preview.periodos && r.preview.periodos.filas &&
     Object.keys(r.preview.periodos.filas).length > 0,
    `el conteo por período llega a la lectura (${JSON.stringify(r.preview && r.preview.periodos && r.preview.periodos.filas)})`);
}

console.log("\n" + "=".repeat(100));
console.log("6 · EL SELLO · confirmar no borra la observación, la marca como asumida");
console.log("=".repeat(100));
{
  /* Se arma un archivo que SÍ dispara: el ejemplo del contrato con un período casi vacío no siempre alcanza,
   * así que se usa la respuesta de la sección anterior si trajo alarma, y si no, se declara que no aplica. */
  const r = respuestaConAlarma;
  if (r && r.alarmas.length > 0) {
    ok(r.sello && r.sello.confirmadoPorElUsuario === false, "antes de decidir: «sin resolver»");
    ok(r.selloConfirmado && r.selloConfirmado.confirmadoPorElUsuario === true, "después de confirmar: «confirmado»");
    ok(r.sello.nota !== r.selloConfirmado.nota,
      `y la nota que acompaña a las cifras CAMBIA: «${r.sello.nota}» → «${r.selloConfirmado.nota}»`);
    ok(r.selloConfirmado.conAlarmas === true,
      "…pero sigue diciendo que hubo alarmas: confirmar no las borra, solo declara que el usuario las asumió");
  } else {
    ok(r && r.sello === null && r.selloConfirmado === null,
      "sin alarmas no hay sello: no se arrastra una advertencia que nunca existió");
  }
  /* LA PANTALLA TIENE QUE USAR EL CONFIRMADO, no el otro. Este fue un defecto real: se activaba con el sello sin
   * confirmar y la nota decía «observación sin resolver» justo después de que el usuario resolviera seguir. */
  ok(/onActivar\(r\.dataset, r\.selloConfirmado/.test(PANEL),
    "y al activar, la pantalla entrega el sello CONFIRMADO — no el de antes de preguntar");
}

console.log("\n" + "=".repeat(100));
console.log("7 · EL RECHAZO TAMBIÉN ORIENTA · un no sin motivo convierte la plantilla en un obstáculo");
console.log("=".repeat(100));
{
  const basura = await handleIngesta({ archivo: Buffer.from("esto no es un libro de excel").toString("base64"), nombre: "roto.xlsx" });
  ok(!basura.ok, "un archivo que no es un .xlsx se rechaza sin reventar la función");
  ok(typeof basura.motivo === "string" && basura.motivo.length > 10, `…con un motivo legible: «${basura.motivo}»`);
  ok(!basura.dataset, "…y sin dataset: nada a medias que se pueda activar por error");
  const vacio = await handleIngesta({});
  ok(!vacio.ok && /archivo/.test(vacio.motivo), "sin archivo, lo dice en vez de fallar en silencio");
  ok(/datos-rechazo/.test(PANEL), "y la pantalla tiene dónde mostrar el rechazo con sus bloqueos");
}

console.log("\n" + "=".repeat(100));
console.log("8 · LA PUERTA ES PERMANENTE · probar con datos propios no es un paso de arranque");
console.log("=".repeat(100));
{
  ok(/datos-abrir/.test(BARRA), "«Tus datos» es una fila fija de la barra lateral, no un cartel de bienvenida");
  ok(/datosAbiertos/.test(BARRA) && /onDatos/.test(BARRA), "…con su estado y su acción declarados como las otras tres");
  ok(/onDatos=\{/.test(APP) && /<PanelDatos/.test(APP), "y App la cablea a la pantalla");
  ok(/datos-volver-demo/.test(PANEL), "hay vuelta atrás: el demo se puede recuperar sin recargar");
  /* EL REMONTE. `initTenant` re-arma los módulos, pero React seguiría pintando lo que tenía derivado en estado.
   * Sin la llave, media pantalla quedaría con la empresa anterior — la mezcla que este producto no permite. */
  ok(/key=\{datosVersion\}/.test(APP),
    "y el árbol se remonta al cambiar de dato: ninguna cifra de la empresa anterior sobrevive al cambio");
}

console.log("\n" + "=".repeat(100));
console.log("9 · CERO CÁLCULO EN LA VISTA · la regla de la casa vale también acá");
console.log("=".repeat(100));
{
  /* Se buscan cuentas de NEGOCIO en el .jsx. El formateo (miles, redondeo para pintar) no es una cuenta: lo que
   * está prohibido es que la pantalla DERIVE una cifra que el módulo debería haber entregado. */
  const cuentas = (PANEL.match(/^\s*const\s+\w+\s*=\s*[^;\n]*[-+*/]\s*\w+\.(venta|costo|margen|stock|doh|rotacion)/gm) || []);
  ok(cuentas.length === 0, "la pantalla no calcula ninguna cifra de negocio: pinta lo que el módulo le entrega", cuentas.join(" | "));
  ok(/apertura/.test(PANEL) && !/Acabo de leer/.test(PANEL),
    "la redacción de la apertura tampoco vive acá: llega armada, para que no haya dos versiones del mismo hallazgo");
}

console.log("\n" + "=".repeat(100));
console.log("10 · LA PLANTILLA PIDE HECHOS, NO POLÍTICAS · y lo que no le pide, lo declara");
console.log("=".repeat(100));
{
  /* ⚠️ ESTA SECCIÓN SE DIO VUELTA EL 2026-08-26. El día anterior yo había AGREGADO el techo de días y la rotación
   * mínima a la cabecera, porque sin ellos la alarma de inventario no podía dispararse nunca. El owner los sacó
   * junto con el resto de las políticas: «deja solo datos de empresa y período; no tienes para qué colocar eso».
   * La alarma no murió: los umbrales caen a la REFERENCIA GENERAL de ADI, la misma con la que el diagnóstico
   * asigna los estados. Lo que se prueba acá es que la plantilla no las pida Y que la vara siga existiendo. */
  const politicas = ["dohMax", "rotacionMin", "benchmark", "bestPracticeCarga", "targetCarga", "margenBrechaMaterial"];
  const pedidas = politicas.filter((k) => PARAMETROS.some((p) => p.policyKey === k || p.clave === k));
  ok(pedidas.length === 0, "la plantilla no le pide NINGUNA política al usuario", pedidas.join(", "));
  /* ⚠️ SE MIDE LA REGLA, NO UN NÚMERO. Esto decía `PARAMETROS.length === 3` y se puso rojo al agregar la moneda
   * como campo OPCIONAL —que es un cambio que la propia regla de congelamiento permite—. Un conteo fijo no
   * expresaba lo que el owner pidió («deja solo datos de empresa y período»): lo que no se le puede pedir al
   * usuario es que declare POLÍTICAS y que llene campos de más para poder cargar. Eso es lo que se exige ahora. */
  const obligatorios = PARAMETROS.filter((p) => p.obligatorio);
  ok(obligatorios.length === 3,
    `solo tres campos son obligatorios: ${obligatorios.map((p) => p.etiqueta).join(" · ")}`);
  ok(PARAMETROS.filter((p) => !p.obligatorio).every((p) => p.clave === "moneda"),
    `y lo único opcional es la moneda: ${PARAMETROS.filter((p) => !p.obligatorio).map((p) => p.clave).join(" · ") || "nada"}`);

  const conEj = await handleIngesta({ op: "plantilla", conEjemplo: true });
  const r2 = await handleIngesta({ archivo: conEj.archivo, nombre: "sin-politicas.xlsx" });
  ok(r2.ok, "y un archivo sin ninguna política declarada se procesa igual");
  const k = (r2.dataset && r2.dataset.margenKPI) || {};
  ok(typeof k.benchmark === "number" && k.benchmarkProcedencia === "referencia general de ADI",
    `la vara existe y dice de dónde sale: ${k.benchmark}% · ${k.benchmarkProcedencia}`);
  ok(typeof k.brechaPuntos === "number", `…así que la brecha de margen se sigue pudiendo calcular (${k.brechaPuntos} pp)`);
  ok(r2.dataset.skuInventario.every((s) => s.estado), "…y cada SKU sigue recibiendo su estado: la vara del inventario tampoco se apagó");
}

console.log(`\n── _pantalla_carga_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail === 0 ? 0 : 1);
