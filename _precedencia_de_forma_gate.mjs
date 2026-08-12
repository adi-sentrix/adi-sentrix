/* === _precedencia_de_forma_gate.mjs · LA PRECEDENCIA APROBADA DEL FORMATO (owner 2026-08-11) =================
 * @inyeccion-simulada — `answerViaOracle` con `callPlan`/`callNarrate` a mano. Sin gateway, sin adapter, sin
 * `fetch(`, sin `src/ui/`. Cero red, cero llamadas pagadas.
 *
 * ── LAS SIETE REGLAS, tal como el owner las fijó ─────────────────────────────────────────────────────────────
 *  1. La instrucción explícita del turno manda sobre herramientas, formato anterior y disparadores implícitos.
 *  2. «sin tabla» / «nada de tablas» o equivalente → prosa, nunca tabla.
 *  3. «solo la cifra/el dato» → data_only; combinado con «sin tabla», UNA ORACIÓN BREVE.
 *  4. Pedido explícito de tabla → tabla.
 *  5. Pedido de tabla Y explicación → tabla MÁS interpretación, conservando entidad, métrica y período.
 *  6. Un pedido implícito («peor mes») NO obliga a tabla.
 *  7. El formato del turno anterior NO se hereda.
 *
 * ── LOS RECLAMOS, Y POR QUÉ NO SON UN PARCHE ─────────────────────────────────────────────────────────────────
 * «Me dejaste sin la tabla que te pedí» y «Ni la tabla ni el detalle aparecieron, necesito las dos» NIEGAN el
 * sustantivo sin prohibir nada: son solicitudes vigentes. No se detectan como dos frases especiales — el respaldo
 * determinístico distingue la clase por TIEMPO Y MODO VERBAL (un reclamo habla en indicativo pasado de lo que ADI
 * hizo; una orden viene en imperativo o como «nada de X»), y ante la duda cae a `auto` para que el PLAN declare
 * la forma. Un respaldo que adivina de más le niega al usuario lo que pidió; uno que adivina de menos delega.
 *
 * `node --import ./scripts/offline-guard.mjs _precedencia_de_forma_gate.mjs`
 */
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { answerViaOracle } from "./src/adi/oracle/answerViaOracle.js";
import { resolveOutputForm, prohibeFormaTabularInequivoco } from "./src/adi/oracle/progressiveDisclosure.js";

initTenant(TENANT_DEMO);
let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };
const H = (t) => console.log("\n" + t);
const F = (t, pref = {}) => resolveOutputForm({ plan: { pref }, text: t });
const HAY_TABLA = /^\s*\|.*\|\s*$/m;

const PLAN = (pref = {}, calls = [{ tool: "executiveSummary", args: {} }]) => ({ intent: "answer", mode: "default", calls, pref });
// el narrador simulado DESOBEDECE: devuelve siempre tabla. Lo que se certifica es que el renderer impone igual.
const NARRA_TABLA = async () => "Lo más relevante del período.\n\n| Concepto | Valor |\n|---|---|\n| Ventas | $99.9M |\n\nEmpieza por revisar Falabella.";
async function turno(text, plan, mem = {}) {
  const o = await answerViaOracle({ text, history: [], mem, scenario: "bonanza", callPlan: async () => plan, callNarrate: NARRA_TABLA });
  return { texto: (o && o.r && o.r.text) || "", mem: (o && o.mem) || {} };
}

H("[R2] «sin tabla» / «nada de tablas» → PROSA, nunca tabla");
for (const q of ["dame solo las cifras, sin tabla", "solo la cifra, nada de tablas", "Sin tablas. Decímelo en dos líneas.",
  "Nada de tablas, por favor: contame qué pasa.", "No me armes ninguna tabla, decime qué pasó.", "Explicámelo en prosa."]) {
  const f = F(q);
  ok(f === "prosa" || f === "solo_conclusion", `«${q}» → ${f}`);
}

H("[R1+R6] LA INSTRUCCIÓN EXPLÍCITA GANA AL DISPARADOR IMPLÍCITO · el turno E3.t3");
{
  ok(F("Explicalo sin repetir la tabla: cuál fue el peor mes.") === "prosa",
    "«explicalo sin repetir la tabla: cuál fue el peor mes» → prosa (el «peor mes» es implícito y NO obliga)");
  ok(F("¿Cuál fue el peor mes?") === "auto", "un pedido implícito solo → auto: no fuerza tabla (regla 6)");
  ok(F("¿Cómo viene Falabella?") === "auto", "una consulta general → auto");
}

H("[R4+R5] PEDIDO EXPLÍCITO DE TABLA → TABLA, y con explicación sigue siendo tabla");
for (const q of ["Dame la evolución mes a mes en una tabla.", "Hazme un cuadro con los clientes.",
  "Dame la tabla mes a mes, sin la columna de unidades", "Dame la tabla y explicame qué pasó."]) {
  ok(F(q) === "tabla", `«${q}» → tabla`);
}

H("[RECLAMOS] niegan el sustantivo pero PIDEN la tabla · el respaldo NO los prohíbe");
for (const q of ["Me quedé sin la tabla mes a mes, ¿la rehacés?", "Me dejaste sin la tabla que te pedí.",
  "Ni la tabla ni el detalle aparecieron, necesito las dos.", "No me diste ni la tabla ni el resumen.",
  "No llegó ni la tabla, ¿me la mandás?", "No vi ni la tabla ni el cuadrito.",
  "La respuesta vino sin la tabla, y yo la necesito.", "Nos quedamos sin la tabla del trimestre, ¿la podés mandar?"]) {
  ok(F(q) !== "prosa", `«${q}» NO se lee como prohibición (queda para el PLAN)`, F(q));
  ok(!prohibeFormaTabularInequivoco(q), `…y el predicado inequívoco tampoco lo prohíbe`);
}

H("[R3] «solo la cifra, nada de tablas» → UNA ORACIÓN BREVE, sin tabla y sin análisis");
{
  const r = await turno("solo la cifra, nada de tablas", PLAN({ contentScope: "data_only" }));
  ok(!HAY_TABLA.test(r.texto), "no sale tabla", r.texto.slice(0, 90));
  ok(/\$/.test(r.texto), "…y la cifra autorizada sigue estando", r.texto.slice(0, 90));
}

H("[R7] EL FORMATO NO SE HEREDA");
{
  const t1 = await turno("Dame la evolución mes a mes en una tabla.", PLAN({ outputForm: "tabla" }));
  ok(HAY_TABLA.test(t1.texto), "turno 1: tabla");
  ok(F("¿Y cuánto contribuye Jumbo?") === "auto", "turno 2 sin pedido de forma → auto: la tabla del turno 1 no se arrastra");
  ok(!/outputForm/.test(JSON.stringify(t1.mem || {})), "la forma no se guarda en la memoria del hilo");
}

H("[PLAN MANDA] la forma declarada por el PLAN vence al respaldo determinístico");
{
  ok(F("Explicalo sin repetir la tabla.", { outputForm: "tabla" }) === "tabla", "PLAN=tabla gana sobre la prohibición del texto");
  ok(F("Dame la tabla mes a mes.", { outputForm: "prosa" }) === "prosa", "PLAN=prosa gana sobre el pedido explícito del texto");
  ok(F("Dame la tabla mes a mes.", { outputForm: "zzz" }) === "tabla", "un valor inválido cae al respaldo, no rompe");
}

console.log(`\n── _precedencia_de_forma_gate: ${PASS} PASS · ${FAIL} FAIL (de ${PASS + FAIL}) ──`);
process.exit(FAIL ? 1 : 0);
