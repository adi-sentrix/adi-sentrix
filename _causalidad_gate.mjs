/* === _causalidad_gate.mjs · NO HAY CAUSALIDAD SIN RESPALDO (owner 2026-08-21) =================================
 * Es la REGLA 2 del proyecto (CLAUDE.md §2.2) y hasta hoy no la hacía cumplir nadie.
 *
 * LO QUE SE MIDIÓ ANTES DE ESCRIBIR EL CHEQUEO: con el contexto EXACTO del camino natural —el que corre en
 * producción— cuatro causas inventadas pasaban el muro enteras y salían a pantalla:
 *   «…porque el proveedor subió los costos» · «porque el equipo comercial dejó de visitar esa cuenta»
 *   «se debe a un problema logístico en la bodega» · «porque está priorizando a otro proveedor»
 * Ninguna tiene respaldo: CLAUDE.md §4 dice que este dato NO tiene causa de la detención, ni lead time de
 * proveedor, ni órdenes de compra, ni entradas, ni historial cliente×SKU.
 *
 * POR QUÉ PASABAN. Los cuatro chequeos de proporcionalidad se alimentan de la BOLETA, y el camino natural no trae
 * boleta — el propio comentario del muro lo dice: «si el turno no trae boleta, los cuatro salen vacíos solos». La
 * regla madre del producto descansaba solo en el prompt, y en este repo eso ya tiene nombre: una regla escrita no
 * frena nada, un cerrojo sí.
 *
 * ⚠️ LA MITAD DEL TRABAJO ES LO QUE NO SE VETA. ADI ya hace bien cuatro cosas que se PARECEN a inventar una causa,
 * y vetarlas sería peor que el defecto original — el Examen 5 las produjo y estuvieron bien:
 *   · DECLINAR («con este dato no puedo darte la causa raíz») — es la regla cumpliéndose;
 *   · HIPOTETIZAR marcado («puede ser mezcla de clientes, descuentos, o carga comercial») — nombrar lo que no se
 *     puede explicar es honestidad;
 *   · LOCALIZAR («la brecha se concentra en 3 SKU») — localizar no es explicar, y no pretende serlo;
 *   · EXPLICAR CON EL DATO («el costo medio se lleva 77% del precio») — eso tiene respaldo, es aritmética.
 * Por eso el veto exige TRES cosas juntas: conector causal + mecanismo AUSENTE del dato + afirmado (sin hipótesis
 * y sin negación). Falta una, no se juzga.
 *
 * CALIBRADO ANTES DE TOCAR UN TURNO REAL: cero vetos sobre los 68 borradores guardados (51 que salieron a pantalla
 * y 17 rechazados). Cero falsos positivos, y cero verdaderos — ADI venía portándose bien por el prompt. Este
 * candado es para cuando no lo haga.
 *
 * OFFLINE · importa el muro y la carpeta · no puede gastar. */
import { guardC } from "./src/adi/oracle/guardC.js";
import { cifrasDelDato } from "./src/adi/oracle/datoProyectado.js";
import { axisEntityNames } from "./src/adi/oracle/entityIndex.js";
import { ESCENARIO_INICIAL } from "./src/config/scenarios.js";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
initTenant(TENANT_DEMO);

let pass = 0, fail = 0;
const ok = (cond, label, detalle) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ FALLO: ${label}${detalle !== undefined ? ` — ${detalle}` : ""}`); }
};
const ejes = (a) => a.flatMap((e) => { try { return axisEntityNames(e); } catch { return []; } });
/* EL CONTEXTO ES EL DEL CAMINO NATURAL, no uno cómodo: ledger vacío y sin boleta, que es exactamente la
 * condición en la que los otros cuatro chequeos quedan mudos. Medir con boleta sería medir otro producto. */
const CTX = { ledger: { figs: [] }, results: [], trace: null, datoProyectado: cifrasDelDato(ESCENARIO_INICIAL),
  entidadesDelTenant: ejes(["cliente", "sku", "marca"]),
  duenosDelTenant: ejes(["cliente", "sku", "marca", "familia", "bodega", "canal"]),
  contentScope: "full", tablePolicy: "auto" };
const veta = (t) => (guardC(t, { ...CTX, question: "por qué" }).violations || []).some((x) => x.kind === "causalidad-sin-respaldo");

console.log("=".repeat(100));
console.log("1 · LAS CUATRO QUE PASABAN · medidas en el camino natural el 2026-08-21");
console.log("=".repeat(100));
for (const t of [
  "El margen de venta de SAM-TV55 es 18.5% porque el proveedor subió los costos este trimestre.",
  "LG-DRYER8KG está frenado porque el equipo comercial dejó de visitar esa cuenta.",
  "La caída de rotación se debe a un problema logístico en la bodega de Valparaíso.",
  "Falabella compra menos porque está priorizando a otro proveedor.",
]) ok(veta(t), `muere: «${t.slice(0, 72)}…»`);

console.log("\n" + "=".repeat(100));
console.log("2 · LO QUE ADI YA HACE BIEN · vetarlo sería peor que el defecto");
console.log("=".repeat(100));
for (const [q, t] of [
  ["declinar", "Con este dato no puedo darte la causa raíz — no hay descuentos ni negociación por cliente desagregados."],
  ["hipotetizar marcado", "Puede ser mezcla de clientes con distinto precio efectivo, descuentos aplicados, o carga comercial."],
  ["criterio de decisión", "Empezaría por LG-DRYER8KG porque libera más capital que MAK-COMP-AIR con la misma gravedad."],
  ["explicar CON el dato", "Su costo medio ($512) se lleva 77% del precio de lista ($665), contra 73% en SAM-REF500L."],
  ["localizar", "La brecha se concentra en 3 SKU porque ahí está el 80% del capital inmovilizado."],
  ["declarar el hueco", "El dato no trae lead time de proveedor, así que esa vía no la puedo confirmar."],
  ["proponer qué mirar", "Habría que revisar si la causa está en descuentos o en la carga comercial."],
]) ok(!veta(t), `pasa (${q}): «${t.slice(0, 62)}…»`);

console.log("\n" + "=".repeat(100));
console.log("3 · LAS TRES CONDICIONES SON NECESARIAS · si falta una, no se juzga");
console.log("=".repeat(100));
ok(!veta("El proveedor es Samsung y el margen de venta es 18.5%."),
  "mecanismo ausente SIN conector causal: nombrarlo no es atribuirle una causa");
ok(!veta("El margen cayó porque el volumen bajó en el último trimestre."),
  "conector causal SIN mecanismo ausente: no es lo que este chequeo persigue");
ok(veta("El margen cayó por culpa de la competencia."), "…y con las dos, muere");
ok(!veta("El margen podría haber caído por culpa de la competencia."), "…salvo que vaya como hipótesis");

console.log("\n" + "=".repeat(100));
console.log("4 · LA MULTA ENSEÑA LA SALIDA, no solo prohíbe");
console.log("=".repeat(100));
{
  const d = String(((guardC("La caída se debe a un problema logístico en la bodega.", { ...CTX, question: "por qué" }).violations || [])
    .find((x) => x.kind === "causalidad-sin-respaldo") || {}).detail || "");
  ok(/no trae causa de la detención/.test(d), "la multa dice QUÉ le falta al dato, no solo que está mal");
  ok(/LOCALIZAR/.test(d) && /hip[óo]tesis/.test(d), "…y nombra las dos salidas honestas: localizar, o marcarlo como hipótesis");
}

console.log(`\n── _causalidad_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail === 0 ? 0 : 1);
