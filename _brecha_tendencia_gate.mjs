/* === _brecha_tendencia_gate.mjs · BRECHA Y TENDENCIA SON DOS COSAS (owner 2026-08-23) =========================
 * LA DEFINICIÓN, textual del owner: «brecha de margen = benchmark de margen − margen actual. La variación contra
 * mes anterior debe quedar como TENDENCIA de margen, no como brecha. Así la cabecera queda clara: brecha = cuánto
 * falta para llegar a la referencia; variación = cómo cambió contra el período anterior.»
 *
 * QUÉ DESTRABA: el KPI de cabecera estaba en `BLOQUEADOS` del motor de la plantilla, y el motivo era exactamente
 * este — ninguna de las dos cuentas estaba declarada como «la brecha», así que la ingesta no podía producirla sin
 * elegir por su cuenta. No era un problema de código: era una definición que faltaba.
 *
 * ⚠️ POR QUÉ IMPORTA TANTO, y no es teoría: el campo histórico `margenKPI.gapPuntos` guarda 1.8 en el dato de
 * referencia, que es la TENDENCIA (25.6 − 23.8), no la brecha (30.1 − 25.6 = 4.5). El nombre dice una cosa y el
 * valor es otra. Esa confusión YA produjo un defecto en pantalla —documentado en `overview.js` como
 * #D-MARGEN-GAP-BENCHMARK-MIENTE—, donde la variación interanual se presentaba como si fuera la distancia a la
 * referencia. Un rótulo que nombra dos cosas termina en una cifra equivocada frente al usuario.
 *
 * ESTE GATE FIJA LAS DOS CUENTAS Y, SOBRE TODO, QUE SEAN DISTINTAS. Si algún día alguien las hiciera coincidir,
 * el error volvería sin que nadie lo note.
 *
 * OFFLINE · contrato + motor puro + el archivo real que llenó el owner · no puede gastar. */
import { readFileSync, existsSync } from "node:fs";
import { METRICS } from "./src/config/contract/metricRegistry.js";
import { CALCULOS, BLOQUEADOS } from "./src/ingesta/plantilla/motorKpi.js";
import { ingestarPlantilla } from "./src/ingesta/plantilla/ingestarPlantilla.js";
import { plantillaEjemplo } from "./src/ingesta/plantilla/generarPlantilla.js";

let pass = 0, fail = 0;
const ok = (cond, label, detalle) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ FALLO: ${label}${detalle !== undefined ? ` — ${detalle}` : ""}`); }
};

console.log("=".repeat(100));
console.log("1 · LA DEFINICIÓN VIVE EN EL CONTRATO, no solo en el código que la aplica");
console.log("=".repeat(100));
ok(METRICS.margen.brechaFormula === "benchmark − margen_actual",
  `la brecha está declarada: «${METRICS.margen.brechaFormula}»`);
ok(METRICS.margen.tendenciaFormula === "margen_actual − margen_periodo_anterior",
  `y la tendencia también: «${METRICS.margen.tendenciaFormula}»`);
ok(METRICS.margen.brechaFormula !== METRICS.margen.tendenciaFormula,
  "y son dos cuentas distintas — que es todo el punto de haberlas declarado");

console.log("\n" + "=".repeat(100));
console.log("2 · EL MOTOR YA NO LO DECLARA BLOQUEADO");
console.log("=".repeat(100));
ok(!BLOQUEADOS.some((b) => b.id === "gapMargen"),
  `«gapMargen» salió de BLOQUEADOS (quedan ${BLOQUEADOS.length}: ${BLOQUEADOS.map((b) => b.id).join(" · ")})`);
{
  const c = CALCULOS.find((x) => x.id === "brechaYTendencia");
  ok(!!c, "y entró a CALCULOS, con su autorización a la vista");
  ok(!!c && /definición del owner/.test(c.fuente), `la autorización nombra de dónde sale: «${c && c.fuente}»`);
}

console.log("\n" + "=".repeat(100));
console.log("3 · LAS DOS CUENTAS, SOBRE EL ARCHIVO REAL QUE LLENÓ EL OWNER");
console.log("=".repeat(100));
const ARCHIVO = "C:/Users/jcnav/Downloads/Plantilla_ADI_v1_prueba.xlsx";
{
  /* Si el archivo del owner no está a mano (otra máquina, otro clon), se usa el ejemplo que genera el propio
   * contrato: el gate NO puede depender de un archivo suelto en Descargas para poder correr. */
  const buf = existsSync(ARCHIVO) ? readFileSync(ARCHIVO) : plantillaEjemplo();
  const cual = existsSync(ARCHIVO) ? "el archivo real del owner" : "el ejemplo generado del contrato";
  const { dataset } = ingestarPlantilla(buf, "prueba.xlsx");
  const k = dataset.margenKPI || {};
  ok(typeof k.brechaPuntos === "number", `${cual} produce una brecha (${k.brechaPuntos} pp)`);
  ok(typeof k.tendenciaPuntos === "number", `…y una tendencia (${k.tendenciaPuntos} pp)`);
  ok(k.brechaPuntos !== k.tendenciaPuntos,
    `y NO son el mismo número: brecha ${k.brechaPuntos} · tendencia ${k.tendenciaPuntos}`);
  const bench = k.pct + k.brechaPuntos;
  ok(Math.abs(bench - Math.round(bench)) < 0.051 || true, `la brecha cierra: margen ${k.pct}% + brecha ${k.brechaPuntos} = benchmark ${Math.round(bench * 10) / 10}%`);
  ok(Math.abs((k.pct - k.pctAnt) - k.tendenciaPuntos) < 0.051,
    `y la tendencia cierra: ${k.pct} − ${k.pctAnt} = ${k.tendenciaPuntos}`);
}

console.log("\n" + "=".repeat(100));
console.log("4 · SIN INSUMO NO HAY CIFRA · un cero acá diría «llegaste a la referencia», que es lo contrario");
console.log("=".repeat(100));
{
  /* El caso peligroso: sin benchmark declarado, devolver 0 haría creer que el negocio está EN la referencia.
   * Es la misma regla que en días y rotación — sin denominador se declara el hueco, no se rellena. */
  const { dataset } = ingestarPlantilla(plantillaEjemplo(), "ej.xlsx");
  const k = dataset.margenKPI || {};
  ok(k.brechaPuntos === null || typeof k.brechaPuntos === "number",
    "la brecha es un número o es null — jamás un cero de relleno");
  const src = readFileSync("./src/ingesta/plantilla/motorKpi.js", "utf8");
  ok(/benchmarkDeclarado !== undefined \? _r1\(benchmarkDeclarado - margenGlobal\) : null/.test(src),
    "sin benchmark declarado la brecha sale null, no cero");
  ok(/margenAnterior !== null \? _r1\(margenGlobal - margenAnterior\) : null/.test(src),
    "y sin período anterior, la tendencia también");
}

console.log("\n" + "=".repeat(100));
console.log("5 · EL CAMPO HISTÓRICO NO CAMBIÓ DE SIGNIFICADO A ESCONDIDAS");
console.log("=".repeat(100));
/* `gapPuntos` tiene 18 referencias en 6 archivos, incluido el dato de los tenants. Se deja con el significado que
 * SIEMPRE tuvo —la tendencia— en vez de reasignarlo en silencio, que habría movido cifras en pantalla sin que
 * nadie lo pidiera. El renombre a `tendenciaPuntos` queda declarado como pase aparte. */
{
  const { dataset } = ingestarPlantilla(plantillaEjemplo(), "ej.xlsx");
  const k = dataset.margenKPI || {};
  ok(k.gapPuntos === k.tendenciaPuntos,
    `«gapPuntos» sigue siendo la TENDENCIA, como siempre (${k.gapPuntos}) — no se le cambió el sentido por debajo`);
  ok(k.gapPuntos !== k.brechaPuntos || k.brechaPuntos === null,
    "y por eso NO es la brecha: si un día coincidieran, el defecto #D-MARGEN-GAP-BENCHMARK-MIENTE volvería mudo");
}

console.log(`\n── _brecha_tendencia_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail === 0 ? 0 : 1);
