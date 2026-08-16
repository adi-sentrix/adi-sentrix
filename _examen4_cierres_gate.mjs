/* === _examen4_cierres_gate.mjs · LOS DOS CIERRES DEL EXAMEN 4 + LA ETIQUETA DE LOS DÍAS (owner 2026-08-16) ====
 * El Examen 4 dejó dos defectos que ningún chequeo veía, y el owner pidió cerrarlos antes de dar por graduado el
 * camino natural:
 *   (1) SUPERLATIVOS Y COMPARATIVOS DE ORDEN — «el peor», «el mayor», «el más bajo», «el principal», «el más
 *       crítico» se verifican contra el conjunto y la métrica, igual que un ranking: una clasificación también
 *       es evidencia. CASO CONTROL DEL OWNER, textual: «Falabella tiene el peor margen de los tres grandes»
 *       debe MORIR porque Lider tiene 21.5% y Falabella 22.0%.
 *   (2) JUICIO ASESOR vs HECHO — cuando ADI recomienda o prioriza, marca qué es dato duro y qué es criterio
 *       suyo, aunque no se lo pidan.
 *   (3) LA ETIQUETA DE LOS DÍAS — «días sin rotar» no existe en este dato: hay días de INVENTARIO y días SIN
 *       VENTA, y son campos distintos.
 *
 * POR QUÉ UN GATE Y NO SOLO LA CALIBRACIÓN: la calibración mide contra lo YA ESCRITO (¿cuántos falsos positivos
 *产 sobre textos buenos?). Este gate fija lo que tiene que pasar SIEMPRE, en las dos direcciones — el defecto
 * muere y su versión CORRECTA vive. Sin la segunda mitad, un chequeo que vetara todo pasaría igual de verde.
 *
 * OFFLINE · CERO GASTO: solo el muro y la carpeta. No lee `.env`, no importa el gateway ni un adapter.
 */
import { guardC } from "./src/adi/oracle/guardC.js";
import { cifrasDelDato } from "./src/adi/oracle/datoProyectado.js";
import { axisEntityNames } from "./src/adi/oracle/entityIndex.js";
import { ESCENARIO_INICIAL } from "./src/config/scenarios.js";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { DOCTRINA_NOTARIO_NATURAL } from "./src/adi/oracle/naturalPrompt.js";
initTenant(TENANT_DEMO);

let pass = 0, fail = 0;
const ok = (cond, label, detalle) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ FALLO: ${label}${detalle !== undefined ? ` — ${detalle}` : ""}`); }
};
const ejes = (a) => a.flatMap((e) => { try { return axisEntityNames(e); } catch { return []; } });
const CTX = {
  ledger: { figs: [] }, results: [], trace: null,
  datoProyectado: cifrasDelDato(ESCENARIO_INICIAL),
  entidadesDelTenant: ejes(["cliente", "sku", "marca"]),
  duenosDelTenant: ejes(["cliente", "sku", "marca", "familia", "bodega", "canal"]),
  contentScope: "full", tablePolicy: "auto",
};
const vetos = (texto) => (guardC(texto, CTX).violations || []).map((v) => v.kind);
const muere = (texto, kind, label) => {
  const vs = vetos(texto);
  ok(vs.includes(kind), label, `vetos obtenidos: ${vs.join(", ") || "(ninguno)"}`);
};
const vive = (texto, kind, label) => {
  const vs = vetos(texto);
  ok(!vs.includes(kind), label, `vetó «${kind}» sobre un texto correcto — falso positivo`);
};

console.log("═".repeat(100));
console.log("1 · SUPERLATIVOS · el caso control del owner, y su versión verdadera");
console.log("═".repeat(100));
// EL CASO CONTROL, TEXTUAL DEL OWNER. Es el defecto que salió DOS VECES a pantalla en el Examen 4, verde.
muere("Falabella tiene el peor margen de los tres grandes: 22.0%, contra 21.5% de Lider y 24.0% de Jumbo.",
  "superlativo-no-sostenido", "«Falabella tiene el peor margen de los tres grandes» MUERE (Lider está en 21.5%)");
// …y la MISMA frase, dicha bien, tiene que vivir: si no, el chequeo no distingue, solo prohíbe.
vive("Lider tiene el peor margen de los tres grandes: 21.5%, contra 22.0% de Falabella y 24.0% de Jumbo.",
  "superlativo-no-sostenido", "…y la versión VERDADERA (Lider) pasa: el chequeo distingue, no prohíbe");
// el sujeto puede venir de la oración anterior (así apareció el defecto real en el Examen 4, turno 2)
muere("El margen de Falabella es 22.0%. Es, de hecho, el margen más bajo entre los tres grandes: Lider está en 21.5% y Jumbo en 24.0%.",
  "superlativo-no-sostenido", "el sujeto heredado de la oración anterior también se verifica");
// la polaridad depende de la MÉTRICA: la peor carga comercial es la más ALTA, no la más baja
muere("Jumbo tiene la peor carga comercial de la cartera: 3.8%.", "superlativo-no-sostenido",
  "«la peor carga comercial» se resuelve como la MÁS ALTA (Easy 5.5%), no como la más baja");
vive("Easy tiene la peor carga comercial de la cartera: 5.5%.", "superlativo-no-sostenido",
  "…y quien de verdad tiene la carga más alta pasa");
// un superlativo verdadero sobre el eje entero
vive("Falabella es el cliente de mayor venta de toda la cartera: $19.4M.", "superlativo-no-sostenido",
  "«el de mayor venta de toda la cartera» es cierto y pasa");

console.log("\n" + "═".repeat(100));
console.log("2 · SUPERLATIVOS · las formas que PARECEN un extremo y no lo son (los falsos positivos medidos)");
console.log("═".repeat(100));
/* Los cuatro salieron de la calibración contra los borradores guardados, ANTES de gastar una corrida. Cada uno
 * es un texto que ya había salido a pantalla y que una versión anterior del chequeo mataba sin razón. */
vive("Falabella y Lider, los dos mayores, tienen los márgenes más bajos de la cartera.", "superlativo-no-sostenido",
  "PLURAL · «los dos mayores» describe un grupo, no le atribuye el extremo a nadie");
vive("Lider tiene $17.8M de venta y la segunda peor carga comercial sobre meta.", "superlativo-no-sostenido",
  "ORDINAL · «la segunda peor» reclama el puesto 2, no el extremo");
vive("Con 8.1pp de brecha, Falabella es donde una mejora de carga comercial produce el mayor efecto en dólares.",
  "superlativo-no-sostenido", "MÉTRICA SUELTA · «el mayor efecto» no es un superlativo de la carga, aunque la nombre cerca");
vive("El máximo aplicable en ese caso es 1.8%.", "superlativo-no-sostenido",
  "«el máximo aplicable» no clasifica entidades: sin métrica pegada no hay orden que verificar");

console.log("\n" + "═".repeat(100));
console.log("3 · JUICIO ASESOR vs HECHO · se exige al recomendar, y solo al recomendar");
console.log("═".repeat(100));
muere("**Acción:** bajar la carga comercial de Falabella de 4.5% a 3.5% antes del próximo ciclo.",
  "juicio-sin-marcar", "una acción sin marcar el criterio MUERE");
vive("**Acción:** bajar la carga comercial de Falabella de 4.5% a 3.5%. Dato duro: son $194K. Criterio mío: arrancaría por ahí, no es una cifra del dato.",
  "juicio-sin-marcar", "…y la MISMA acción con «Dato duro» / «Criterio mío» pasa");
vive("El margen de Falabella es 22.0% y su carga comercial 4.5%, sobre la meta de 3.5%.",
  "juicio-sin-marcar", "una lectura que no recomienda nada no tiene criterio que separar");
muere("Prioridad 1 — Falabella y Lider. Son los dos de mayor venta y mayor brecha combinadas.",
  "juicio-sin-marcar", "una PRIORIZACIÓN también es criterio: «Prioridad 1 — …» sin marcar muere");

console.log("\n" + "═".repeat(100));
console.log("4 · LA ETIQUETA DE LOS DÍAS · dos campos, y «días sin rotar» no es ninguno");
console.log("═".repeat(100));
muere("Están frenados por rotación bajo 2.0x o más de 120 días sin rotar, en 3 SKU.", "dias-etiqueta-incorrecta",
  "«120 días sin rotar» MUERE — el techo se mide contra días de INVENTARIO (defecto real del Examen 4, turno 5)");
vive("Están frenados por rotación bajo 2.0x o más de 120 días de inventario, en 3 SKU.", "dias-etiqueta-incorrecta",
  "…y dicho con el nombre del campo, pasa");
muere("MAK-COMP-AIR lleva 190 días sin venta.", "dias-etiqueta-incorrecta",
  "190d es su DÍAS DE INVENTARIO, no sus días sin venta (esos son 112d)");
vive("MAK-COMP-AIR lleva 112 días sin venta.", "dias-etiqueta-incorrecta", "…y con el número correcto, pasa");
muere("SAM-REF500L lleva 17 días sin venta.", "dias-etiqueta-incorrecta",
  "un SKU CON VENTA AL DÍA no tiene días sin venta");

console.log("\n" + "═".repeat(100));
console.log("5 · EL CONTRATO LLEGA AL CEREBRO · un chequeo que el prompt no enseña es una trampa");
console.log("═".repeat(100));
/* Los tres se pueden cumplir solo si el modelo sabe que existen. Si alguien saca la regla del prompt, el muro
 * seguiría vetando y cada turno caería al suplente sin que nadie entienda por qué: por eso se fija acá. */
ok(/UN SUPERLATIVO ES UNA CLASIFICACI[ÓO]N/.test(DOCTRINA_NOTARIO_NATURAL), "la doctrina le enseña la regla de los superlativos");
ok(/SEPARA EL DATO DURO DE TU CRITERIO/.test(DOCTRINA_NOTARIO_NATURAL), "…la de separar dato duro de criterio");
ok(/LOS DOS CAMPOS DE D[ÍI]AS NO SON EL MISMO/.test(DOCTRINA_NOTARIO_NATURAL), "…y la de los dos campos de días");

console.log(`\n── _examen4_cierres_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail === 0 ? 0 : 1);
