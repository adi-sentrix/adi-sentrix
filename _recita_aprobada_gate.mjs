/* === _recita_aprobada_gate.mjs · LA RE-CITA APROBADA, ACOTADA (owner 2026-08-14) =============================
 * LA REGLA, textual del owner: «puede re-citar cifras aprobadas por ADI en turnos anteriores; solo si coinciden
 * entidad, métrica, unidad, periodo/concepto y alcance; si la cifra no fue aprobada antes, o cambia de
 * dueño/concepto, sigue muriendo».
 *
 * El caso que la motivó, MEDIDO en la mini doble #2: el cerebro derivó y mostró «$100.0M × 1.04 = $104.0M» en el
 * turno 1 —esa respuesta pasó el muro limpia— y en los turnos 2, 3 y 4 volvió a citar el $104.0M sin repetir la
 * cuenta. El muro lo vetaba: castigaba una conversación normal.
 *
 * Cada positivo de este gate tiene su negativo: la misma cifra sin aprobación previa, con otro dueño, con otra
 * unidad, o proveniente de un texto que el muro RECHAZÓ, tiene que seguir muriendo. CERO red, CERO .env. */
import { recitaAprobadaDe, responderConNotario } from "./src/adi/oracle/cicloNotarial.js";
import { guardC } from "./src/adi/oracle/guardC.js";
import { cifrasDelDato } from "./src/adi/oracle/datoProyectado.js";
import { axisEntityNames } from "./src/adi/oracle/entityIndex.js";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
initTenant(TENANT_DEMO);

let pass = 0, fail = 0;
const ok = (cond, msg) => { console.log(`  ${cond ? "✓" : "✗"} ${msg}`); cond ? pass++ : fail++; };
const ENT6 = ["cliente", "sku", "marca", "familia", "bodega", "canal"].flatMap((e) => { try { return axisEntityNames(e); } catch { return []; } });
const BASE = { ledger: { figs: [] }, results: [], trace: null, datoProyectado: cifrasDelDato("actual"), entidadesDelTenant: ENT6, duenosDelTenant: ENT6, contentScope: "full", tablePolicy: "auto" };
const juzgar = (texto, extra = {}) => guardC(texto, { ...BASE, question: "Si subo ventas 4%, ¿qué cambia?", supuestoPendiente: ["4%"], ...extra });

// El turno 1 REAL: la cuenta a la vista, con su dueño («ventas totales del negocio») — pasa el muro.
const T1 = "Ventas totales del negocio: $100.0M proyectados × 1.04 = $104.0M. Es una proyección con tu supuesto.";
console.log("── 1 · EL TURNO QUE APRUEBA ──");
ok(juzgar(T1).ok, "la cuenta a la vista pasa el muro (es la que después se re-cita)");
const RECITA = recitaAprobadaDe({ textoAprobado: T1, catalogoEntidades: ENT6 });
ok(!!RECITA && RECITA.figs.length > 0, `se derivan las cifras aprobadas con su dueño (${RECITA ? RECITA.figs.length : 0})`);
ok(RECITA.figs.some((f) => f.value === "$104.0M" && f.duenos.some((d) => /negocio|total|proyectad/i.test(d))),
  "el $104.0M queda con los dueños de SU oración (negocio/total/proyectados)");

console.log("\n── 2 · LA RE-CITA LEGÍTIMA (el caso medido) ──");
const RE_OK = "Sobre las ventas totales del negocio, esa proyección de $104.0M queda como el techo del escenario.";
ok(!juzgar(RE_OK).ok, "SIN la re-cita, el $104.0M muere — el muro no sabe que ya se mostró");
ok(juzgar(RE_OK, { recitaAprobada: RECITA }).ok, "CON la re-cita aprobada, pasa");

console.log("\n── 3 · LOS CONTROLES NEGATIVOS (la regla acotada del owner) ──");
ok(!juzgar("Las ventas totales del negocio llegarían a $117.0M.", { recitaAprobada: RECITA }).ok,
  "una cifra que NUNCA se aprobó sigue muriendo (no es una re-cita, es un invento)");
ok(!juzgar("El margen de Falabella queda en $104.0M tras el ajuste.", { recitaAprobada: RECITA }).ok,
  "la MISMA cifra con OTRO dueño muere — cambia de concepto, no es la misma afirmación");
ok(!juzgar("Las ventas totales del negocio crecerían 104.0% este año.", { recitaAprobada: RECITA }).ok,
  "el mismo número con OTRA unidad muere ($104.0M ≠ 104.0%) — la unidad va en el canon");
const T1_VETADO = "Ventas totales del negocio: $100.0M proyectados × 1.04 = $121.0M.";
ok(!juzgar(T1_VETADO).ok, "un turno con la cuenta MAL es rechazado por el muro…");
ok(!juzgar("Sobre las ventas totales del negocio, esa proyección de $121.0M queda como el techo.",
  { recitaAprobada: recitaAprobadaDe({ textoAprobado: "", catalogoEntidades: ENT6 }) }).ok,
  "…y sus cifras NO se pueden re-citar: un texto vetado no presta nada");

console.log("\n── 4 · EL CANDADO DEL CALLER: `aprobado` decide quién presta ──");
const rVerde = await responderConNotario({ pedir: async () => T1, juzgar: (t) => juzgar(t) });
ok(rVerde.aprobado === true && rVerde.estado === "verde", "una respuesta verde queda marcada como aprobada");
const rVetado = await responderConNotario({ pedir: async () => T1_VETADO, juzgar: (t) => juzgar(t), suplente: () => "Suplente digno." });
ok(rVetado.aprobado === false && rVetado.estado === "suplente", "una respuesta que el muro rechazó NO queda aprobada");

console.log("\n── 4b · REINCIDE → SUPLENTE DIGNO, TAMBIÉN CON TEXTO VETADO (verificado antes de conectar) ──");
/* EL DEFECTO MEDIDO (2026-08-14, `_probe_suplente_vetado.mjs`): con DOS borradores vetados no vacíos, el ciclo
 * devolvía el SEGUNDO BORRADOR VETADO — un texto que el notario acababa de rechazar por inventar cifras llegaba
 * a la pantalla, con el estado diciendo «suplente» sin que ningún suplente se compusiera. Es exactamente lo que
 * el producto existe para impedir. La constitución no distingue CÓMO falló el cerebro: «si falla dos veces,
 * responde el suplente digno». Este bloque lo fija en las dos formas de falla. */
const INVENTO = "El negocio cerró con $777.7M de venta y un margen de 99.9%, muy por encima del benchmark.";
ok(!juzgar(INVENTO).ok, "el texto de control es un invento que el muro rechaza");
const rVet = await responderConNotario({ pedir: async () => INVENTO, juzgar: (t) => juzgar(t), suplente: () => "Cifras verificadas del negocio." });
ok(rVet.texto !== INVENTO, "🔴 el texto VETADO DOS VECES no puede salir a pantalla");
ok(rVet.texto === "Cifras verificadas del negocio." && rVet.suplenteDigno === true, "sale el suplente digno, con su marca");
ok(rVet.estado === "suplente" && rVet.aprobado === false, "el estado sigue siendo «suplente» (la métrica no se disfraza) y no presta cifras");
const rVac = await responderConNotario({ pedir: async () => "", juzgar: (t) => juzgar(t), suplente: () => "Cifras verificadas del negocio." });
ok(rVac.estado === "vacio" && rVac.suplenteDigno === true, "el vacío conserva su estado propio y también compone suplente");

console.log("\n── 5 · LA MEMORIA SE ACUMULA, PERO CON TECHO ──");
const acum = recitaAprobadaDe({ textoAprobado: "El margen de la cartera del negocio marca 25.1%.", catalogoEntidades: ENT6, previa: RECITA });
ok(acum.figs.length > RECITA.figs.length, "un turno nuevo suma sus cifras a las anteriores");
const muchas = Array.from({ length: 40 }, (_, i) => `Las ventas totales del negocio marcan $${i + 1}.0M.`).join(" ");
ok(recitaAprobadaDe({ textoAprobado: muchas, catalogoEntidades: ENT6 }).figs.length <= 24, "con tope de 24 (el mismo criterio que la boleta anterior)");
ok(recitaAprobadaDe({ textoAprobado: "Sin cifras acá.", catalogoEntidades: ENT6 }) === null, "un texto sin cifras no aporta re-cita");

console.log(`\n── _recita_aprobada_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
