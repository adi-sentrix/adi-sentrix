/* === _alcance_heredado_natural_gate.mjs · EL CABLE DEL ALCANCE HEREDADO EN EL CAMINO NATURAL ==================
 * (owner 2026-08-14, tras la corrida doble #2: «el natural perdió a Sodimac y justo esa pieza ya existe para
 * vetarlo/repararlo — conectemos el cable y dejémoslo con candado».)
 *
 * QUÉ FIJA, y por qué importa cada parte:
 *  [1] `alcanceHeredadoDe` deriva el conjunto de la RESPUESTA ANTERIOR — la única huella que tiene un cerebro sin
 *      boleta — y solo cuando la pregunta trae una referencia deíctica plural (el MISMO detector del camino
 *      vigente, `DEICTIC_PLURAL_RE`, no una regla nueva).
 *  [2] Los tres candados que impiden que vete conversación legítima: sin deíctico → null · con una sola entidad
 *      no hay conjunto → null · el eje dominante manda y los candidatos son los de ESE eje.
 *  [3] EL CASO MEDIDO: con el alcance conectado, la respuesta que pierde a Sodimac MUERE con
 *      `alcance-heredado-cambiado`; la que trae las cuatro PASA. Sin conectar, la que pierde a Sodimac pasaba —
 *      que es exactamente lo que la corrida doble #2 midió.
 *  [4] El ciclo completo (`responderConNotario`) con un cerebro mockeado: el veto del alcance dispara UNA
 *      reparación con la multa exacta, y si el cerebro corrige, sale la respuesta buena (no el suplente).
 *
 * CERO red, CERO .env, cero proveedor: el cerebro es una función local. */
import { alcanceHeredadoDe, responderConNotario } from "./src/adi/oracle/cicloNotarial.js";
import { guardC } from "./src/adi/oracle/guardC.js";
import { cifrasDelDato } from "./src/adi/oracle/datoProyectado.js";
import { axisEntityNames } from "./src/adi/oracle/entityIndex.js";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
initTenant(TENANT_DEMO);

let pass = 0, fail = 0;
const ok = (cond, msg) => { console.log(`  ${cond ? "✓" : "✗"} ${msg}`); cond ? pass++ : fail++; };

const CATALOGO = (() => {
  const o = {};
  for (const eje of ["cliente", "sku", "marca", "familia", "bodega", "canal"]) {
    try { const n = axisEntityNames(eje); if (n && n.length) o[eje] = n; } catch { /* sin índice */ }
  }
  return o;
})();
const CIFRAS = cifrasDelDato("actual");
const ENT3 = ["cliente", "sku", "marca"].flatMap((e) => { try { return axisEntityNames(e); } catch { return []; } });
const ENT6 = Object.values(CATALOGO).flat();

// la respuesta del turno 1 tal como salió en la corrida doble #2: nombra las cuatro cuentas
const PREV_4 = "Falabella vende $19.4M con margen 22.0%, Lider $17.9M con 21.5%, Jumbo $17.3M con 24.0% y Sodimac $8.2M con 23.5% — los cuatro bajo tu benchmark de 30.1%.";
const Q2 = "reduce en 2 puntos las acciones comerciales de esos clientes y dime si quedan sobre el benchmark";

console.log("── 1 · EL ALCANCE SE DERIVA DE LA RESPUESTA ANTERIOR ──");
const her = alcanceHeredadoDe({ pregunta: Q2, respuestaAnterior: PREV_4, catalogoPorEje: CATALOGO });
ok(!!her, "con «esos clientes» y una respuesta previa que nombra 4 cuentas, hay alcance heredado");
ok(her && her.eje === "cliente", `el eje dominante es el de las entidades nombradas (obtuvo ${her && her.eje})`);
ok(her && her.entities.length === 4 && ["Falabella", "Lider", "Jumbo", "Sodimac"].every((n) => her.entities.includes(n)),
  `las 4 cuentas del turno anterior (obtuvo ${JSON.stringify(her && her.entities)})`);
ok(her && Array.isArray(her.candidatos) && her.candidatos.length > her.entities.length,
  "los candidatos son el eje COMPLETO — así se detecta al intruso");

console.log("\n── 2 · LOS TRES CANDADOS (que no vete conversación legítima) ──");
ok(alcanceHeredadoDe({ pregunta: "¿y cómo viene Falabella este mes?", respuestaAnterior: PREV_4, catalogoPorEje: CATALOGO }) === null,
  "sin referencia deíctica plural → null (una pregunta nueva no hereda nada)");
ok(alcanceHeredadoDe({ pregunta: Q2, respuestaAnterior: "Falabella vende $19.4M con margen 22.0%.", catalogoPorEje: CATALOGO }) === null,
  "con UNA sola entidad en la respuesta previa → null (no hay conjunto que sustituir)");
ok(alcanceHeredadoDe({ pregunta: Q2, respuestaAnterior: "", catalogoPorEje: CATALOGO }) === null, "sin respuesta previa → null");
ok(alcanceHeredadoDe({ pregunta: Q2, respuestaAnterior: PREV_4, catalogoPorEje: null }) === null, "sin catálogo → null (nunca una lista a mano)");
const herSku = alcanceHeredadoDe({ pregunta: "y de esos, ¿cuál libero primero?", respuestaAnterior: "LG-DRYER8KG tiene $14K y MAK-COMP-AIR $8K, los dos frenados en inventario.", catalogoPorEje: CATALOGO });
ok(herSku && herSku.eje === "sku", `el eje dominante se elige por la respuesta, no por defecto (obtuvo ${herSku && herSku.eje})`);

console.log("\n── 3 · EL CASO MEDIDO: la respuesta que pierde a Sodimac ──");
const _juzgar = (texto, heredado) => guardC(texto, {
  ledger: { figs: [] }, results: [], trace: null, question: Q2, alcanceHeredado: heredado,
  datoProyectado: CIFRAS, entidadesDelTenant: ENT3, duenosDelTenant: ENT6, contentScope: "full", tablePolicy: "auto",
});
// la respuesta REAL del brazo natural en la corrida #2 — habla de TRES y le suma un cliente que no venía
const PIERDE = "Ninguno de los tres cruza el benchmark de 30.1%: Falabella 22.0% a 24.0%, Lider 21.5% a 23.5% y Jumbo 24.0% a 26.0%. Tottus, en cambio, ya está sobre la referencia.";
const CUATRO = "Ninguna de las cuatro cruza el benchmark de 30.1%: Falabella 22.0% a 24.0%, Lider 21.5% a 23.5%, Jumbo 24.0% a 26.0% y Sodimac 23.5% a 25.5%.";
const vPierde = _juzgar(PIERDE, her);
ok(!vPierde.ok && vPierde.verdict === "alcance-heredado-cambiado", `la que cambia el conjunto MUERE por su chequeo (obtuvo ${vPierde.verdict})`);
ok(String((vPierde.violations[0] || {}).detail || "").includes("Tottus"), "la multa NOMBRA al intruso, para que la reparación sepa qué sacar");
ok(_juzgar(CUATRO, her).ok, "la que trae las CUATRO cuentas pasa");
ok(_juzgar(PIERDE, null).ok, "SIN el cable, la misma respuesta pasaba — esto es lo que la corrida #2 midió");

console.log("\n── 4 · EL CICLO COMPLETO: veto → UNA reparación → respuesta buena ──");
const r = await responderConNotario({
  pedir: async ({ intento, multa }) => (intento === 1 ? PIERDE : (String(multa).includes("Tottus") ? CUATRO : PIERDE)),
  juzgar: (t) => _juzgar(t, her),
  suplente: () => "Suplente digno con cifras verificadas.",
});
ok(r.estado === "reparado", `el ciclo repara en el segundo intento (obtuvo ${r.estado})`);
ok(r.calls === 2, `cuesta exactamente una llamada extra (obtuvo ${r.calls})`);
ok(r.texto === CUATRO && !r.suplenteDigno, "sale la respuesta buena del cerebro, no el suplente");
ok(r.vetos.length === 1 && r.vetos[0] === "alcance-heredado-cambiado", "el veto queda registrado con su nombre");

console.log(`\n── _alcance_heredado_natural_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
