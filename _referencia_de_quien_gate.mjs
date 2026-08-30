/* === _referencia_de_quien_gate.mjs · LA VARA NUESTRA NO ES LA META DEL CLIENTE (owner 2026-08-26) ============
 *
 * LA CONDICIÓN, textual, para aprobar la v1.6: «acepto sacar benchmark y políticas de la plantilla para reducir
 * fricción, pero deja muy claro en preview y en respuestas que ADI usa referencia general cuando el cliente no
 * declara una propia. NO QUIERO QUE LA REFERENCIA GENERAL PAREZCA UNA META DEL CLIENTE».
 *
 * POR QUÉ ES UN RIESGO REAL Y NO UNA FORMALIDAD: hasta ayer el benchmark se le pedía al cliente en la plantilla,
 * así que TODO el producto podía decir «tu benchmark» con razón — y lo dice en seis lugares, incluidos el pulso
 * de inicio, el resumen comercial, el P&L y la doctrina que se le enseña al modelo. Al sacar el campo, esas seis
 * frases pasaron a atribuirle al usuario un objetivo que nunca fijó. Es la regla 1 del proyecto aplicada a la
 * autoría del criterio: afirmar más de lo que la evidencia autoriza.
 *
 * ⚠️ EL CASO QUE IMPORTA ES EL SEGUNDO. Con el negocio de demostración —que SÍ declara su 30,1%— todo sigue
 * diciendo «tu benchmark», y está bien. La prueba de verdad es el tenant que NO declara: ahí ninguna superficie
 * puede llamarlo suyo. Por eso la sección 3 busca lo PROHIBIDO, no lo esperado.
 *
 * OFFLINE · módulos puros + lectura de fuentes · no puede gastar. */
import { readFileSync } from "node:fs";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
initTenant(TENANT_DEMO);
import { referenciaEsDelNegocio, etiquetaDeLaReferencia, notaDeLaReferencia, procedenciaDeLaReferencia } from "./src/config/businessPolicy.js";
import { proyectarDatoNegocio } from "./src/adi/oracle/datoProyectado.js";
import { ingestarPlantilla, previewPlantillaEnTexto } from "./src/ingesta/plantilla/ingestarPlantilla.js";
import { plantillaEjemplo } from "./src/ingesta/plantilla/generarPlantilla.js";
import { PARAMETROS } from "./src/config/contract/plantilla.js";

let pass = 0, fail = 0;
const ok = (cond, label, detalle) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ FALLO: ${label}${detalle !== undefined ? ` — ${detalle}` : ""}`); }
};
const leer = (p) => { try { return readFileSync(p, "utf8"); } catch { return ""; } };

/** el mismo tenant de referencia, pero SIN benchmark declarado — el caso del cliente que sube su archivo */
const SIN_VARA = { ...TENANT_DEMO, perfil: { ...TENANT_DEMO.perfil } };
delete SIN_VARA.perfil.benchmark;

console.log("=".repeat(100));
console.log("1 · DE QUIÉN ES LA VARA · una sola función lo decide, y depende del tenant activo");
console.log("=".repeat(100));
{
  initTenant(TENANT_DEMO);
  ok(referenciaEsDelNegocio() === true, "el negocio que declara su benchmark: la vara es SUYA");
  ok(etiquetaDeLaReferencia() === "tu benchmark", `…y se nombra «${etiquetaDeLaReferencia()}»`);
  ok(procedenciaDeLaReferencia() === "interna_empresa", "…procedencia: interna_empresa");
  ok(notaDeLaReferencia() === "", "…y no hay límite que declarar: es su criterio");

  initTenant(SIN_VARA);
  ok(referenciaEsDelNegocio() === false, "el negocio que NO la declara: la vara es NUESTRA");
  ok(etiquetaDeLaReferencia() === "la referencia general de ADI", `…y se nombra «${etiquetaDeLaReferencia()}»`);
  ok(procedenciaDeLaReferencia() === "general_adi", "…procedencia: general_adi");
  ok(/no una meta que tu negocio haya declarado/.test(notaDeLaReferencia()),
    `…y la nota lo dice con todas las letras: «${notaDeLaReferencia()}»`);
  initTenant(TENANT_DEMO);
}

console.log("\n" + "=".repeat(100));
console.log("2 · LAS SUPERFICIES NO ESCRIBEN «tu benchmark» A MANO · lo preguntan");
console.log("=".repeat(100));
{
  /* Se mira el CÓDIGO porque estas tres frases se arman en módulos distintos y cada uno tenía su literal. Una
   * superficie que vuelva a escribirlo a mano sería invisible en tiempo de ejecución hasta que un cliente sin
   * benchmark abra la app. */
  for (const [archivo, que] of [
    /* ⚠️ EL PULSO DE INICIO SALIÓ DE LA LISTA porque el módulo ya no existe: se retiró el 2026-08-27 al
       consolidar la superficie, y llevaba desde el 26 sin pintarse en ninguna pantalla. La regla que esta
       lista cuida —que nadie escriba «tu benchmark» a mano— no se aflojó: sigue exigida en los dos módulos
       que SÍ arman esa frase hoy. Si mañana vuelve un tercero, entra acá. */
    ["./src/adi/sentrix/resumenComercial.js", "el resumen comercial"],
    ["./src/adi/pnl.js", "el P&L"],
  ]) {
    const src = leer(archivo);
    ok(/etiquetaDeLaReferencia\(\)/.test(src), `${que} pregunta de quién es la vara`);
    ok(!/`bajo tu benchmark|está bajo tu benchmark de margen/.test(src), `…y ya no lo escribe a mano`);
  }
}

console.log("\n" + "=".repeat(100));
console.log("3 · CON UN NEGOCIO QUE NO LA DECLARÓ · lo PROHIBIDO, que es la mitad que importa");
console.log("=".repeat(100));
{
  initTenant(SIN_VARA);
  const carpeta = proyectarDatoNegocio("actual");
  ok(/REFERENCIA ES LA GENERAL DE ADI/i.test(carpeta), "la carpeta que ve el cerebro declara que la vara es nuestra");
  ok(/NO es su meta/.test(carpeta), "…y le dice explícitamente que no la presente como meta del usuario");
  ok(!/La referencia la declara el negocio/.test(carpeta),
    "…y NO afirma lo contrario: esa línea era incondicional y le enseñaba a atribuirle un criterio ajeno");

  /* La lista negra: lo que ninguna superficie puede decir de una vara que el negocio no fijó. */
  const prohibido = [/\btu benchmark\b/i, /\btu meta\b/i, /\btu objetivo\b/i, /\btu referencia\b/i, /meta definida para tu negocio/i];
  const etq = etiquetaDeLaReferencia();
  ok(!prohibido.some((re) => re.test(etq)), `la etiqueta no se lo atribuye al usuario: «${etq}»`);

  initTenant(TENANT_DEMO);
  ok(/La referencia la declara el negocio/.test(proyectarDatoNegocio("actual")),
    "y con el negocio que SÍ la declara, la carpeta vuelve a decir que es suya — el cambio es condicional, no un borrado");
}

console.log("\n" + "=".repeat(100));
console.log("4 · LA PREVIEW LO DICE · es donde el usuario lo lee antes de activar nada");
console.log("=".repeat(100));
{
  const r = ingestarPlantilla(plantillaEjemplo(), { nombreArchivo: "e.xlsx" });
  ok(r.ok, "el archivo de ejemplo entra");
  ok(!PARAMETROS.some((p) => p.clave === "benchmark"), "…y no declara benchmark: la plantilla dejó de pedirlo");
  const ref = r.preview.totales.referencia;
  ok(ref && typeof ref.valor === "number", `la preview trae la referencia con la que se comparó (${ref && ref.valor}%)`);
  ok(ref.procedencia === "referencia general de ADI", `…y su procedencia: «${ref.procedencia}»`);

  const texto = previewPlantillaEnTexto(r.preview);
  ok(/REFERENCIA GENERAL DE ADI/.test(texto), "el texto de la preview lo dice en mayúsculas, no en una nota al pie");
  ok(/no es tu meta/.test(texto), "…y niega explícitamente que sea la meta del usuario");

  const panel = leer("./src/ui/PanelDatos.jsx");
  ok(/datos-referencia/.test(panel), "la pantalla tiene su propio recuadro para esto");
  ok(/no es tu meta/.test(panel), "…con la misma negación explícita");
  ok(/referencia general de ADI/.test(panel), "…y nombrando de quién es la vara");
}

console.log("\n" + "=".repeat(100));
console.log("5 · PUNTO DE VENTA · guardado, y declarado como todavía-no-analizable");
console.log("=".repeat(100));
{
  /* Owner: «acepto que punto de venta quede capturado aunque ADI todavía no analice por sucursal; debe quedar
   * declarado como dato disponible para futuro, no como métrica activa». Lo segundo es lo que se prueba: que el
   * usuario no llene una columna con cuidado y después pregunte por ella sin obtener nada. */
  const r = ingestarPlantilla(plantillaEjemplo(), { nombreArchivo: "e.xlsx" });
  const g = (r.preview.totales.guardadoSinAnalizar || []).find((x) => x.campo === "punto de venta");
  ok(!!g, "la preview declara el punto de venta como dato guardado");
  ok(g && g.filas > 0 && g.distintos > 0, `…con cuánto se guardó (${g && g.filas} filas · ${g && g.distintos} sucursales)`);
  const texto = previewPlantillaEnTexto(r.preview);
  ok(/todavía no analiza por punto de venta/.test(texto), "…y dice que ADI todavía no analiza por ahí");
  const panel = leer("./src/ui/PanelDatos.jsx");
  ok(/datos-guardado/.test(panel) && /todavía no analizo por/.test(panel), "y la pantalla lo dice igual");

  /* NO es métrica activa: no puede aparecer como eje disponible en Sentrix. */
  const disp = JSON.stringify(r.preview.disponibilidad || {});
  ok(!/puntoVenta|punto de venta/i.test(disp),
    "y NO aparece como eje analizable: declarar que se guarda no es prometer que se puede preguntar");
}

console.log("\n" + "=".repeat(100));
console.log("6 · CARNADA · estos chequeos tienen que poder ponerse rojos");
console.log("=".repeat(100));
{
  /* Sin esto, todo lo de arriba podría estar verde y ciego. Se fuerza el caso contrario y se comprueba que la
   * distinción existe de verdad: si la función devolviera siempre lo mismo, las dos ramas darían igual. */
  initTenant(SIN_VARA);
  const nuestra = etiquetaDeLaReferencia(), carpetaNuestra = proyectarDatoNegocio("actual");
  initTenant(TENANT_DEMO);
  const suya = etiquetaDeLaReferencia(), carpetaSuya = proyectarDatoNegocio("actual");
  ok(nuestra !== suya, `las dos etiquetas son distintas: «${nuestra}» ≠ «${suya}»`);
  ok(carpetaNuestra !== carpetaSuya, "…y las dos carpetas también: el cerebro recibe información distinta");
  ok(/tu benchmark/.test(suya) && !/tu benchmark/.test(nuestra),
    "…y solo la del negocio que la declaró dice «tu benchmark» — la comprobación distingue, no dice que sí a todo");
}

console.log(`\n── _referencia_de_quien_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail === 0 ? 0 : 1);
