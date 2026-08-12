/* === _replay_certificacion_gate.mjs · LOS 25 TURNOS MEDIDOS, CONTRA EL CÓDIGO DE HOY (owner 2026-08-11) ======
 * Sin red, sin LLM, sin llamadas pagadas. Reproduce la evidencia REAL de la certificación de f4f2949: cada
 * respuesta que el proveedor devolvió de verdad, con la boleta que la autorizaba ese día, pasada por el guard
 * actual. Un plan inventado probaría lo que el autor imaginó; esto prueba qué haría el producto HOY con lo que
 * el modelo dijo ENTONCES.
 *
 * ── QUÉ AFIRMA, y qué NO ─────────────────────────────────────────────────────────────────────────────────────
 * AFIRMA que los defectos medidos hoy se BLOQUEAN, y que las respuestas correctas de esa corrida SIGUEN pasando.
 * NO afirma que el narrador vaya a redactar mejor: eso sólo lo dice una corrida pagada. Acá se mide el muro.
 * El valor está en las dos caras: un guard que bloquea todo también "cierra" los defectos, y no sirve.
 *
 * `node --import ./scripts/offline-guard.mjs _replay_certificacion_gate.mjs`
 */
import { readFileSync } from "node:fs";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { guardC } from "./src/adi/oracle/guardC.js";
import { stripLanguageLeaks } from "./src/adi/llm/voiceGuard.js";

initTenant(TENANT_DEMO);
let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };

const F = JSON.parse(readFileSync("./fixtures/certificacion-f4f2949.json", "utf8"));

/* LOS DEFECTOS MEDIDOS, uno por turno. `bloquea:true` = el guard de hoy TIENE que rechazar esa respuesta; el resto
 * son turnos que salieron bien y que este replay usa como control: si el muro los rechazara, habríamos cambiado
 * un defecto por otro peor. */
const ESPERADO = {
  "E5.t2": { bloquea: true, porque: "consolidó venta (flujo del período) con inventario valorizado (stock a una fecha): «Sumando ambos, el total es $13.3M»" },
};
// los turnos que la evaluación dio por correctos: el muro no puede tumbarlos.
const CORRECTOS = ["E1.t1", "E1.t4", "E1.t5", "E3.t2", "E4.t1", "E4.t2", "E4.t4", "E5.t1", "E5.t3", "E5.t4", "E6.t2", "E6.t4"];

/* ── 24 DE 25 REPRODUCIBLES · UNO NO, Y LA CULPA ES DEL ARNÉS (owner 2026-08-11) ──────────────────────────────
 * SE INTENTÓ RECONSTRUIR `results` EJECUTANDO DE NUEVO LAS TOOLS DESDE EL PLAN GUARDADO, y NO SE PUEDE: el
 * corredor de la certificación guardó los NOMBRES de las tools, no sus argumentos. Medido sobre el propio
 * fixture: 0 de 57 calls traen `args`. Sin los argumentos habría que adivinar qué entidad y qué porcentajes pidió
 * cada call, y un replay con argumentos inventados no reproduce nada — certifica la imaginación del que lo
 * escribe. Es una falla de MI instrumentación, no del producto, y se reporta como tal.
 * CONSECUENCIA HONESTA: los chequeos que sólo necesitan la boleta se reproducen en los 25. El único turno cuyo
 * veredicto depende de `results` —E6.t3, donde las cifras en disputa ($0.2M y $0.6M) son la mejora de
 * contribución del escenario, derivada— queda NO REPRODUCIBLE. Su `retryTrace` dice [true,true,true], o sea que
 * el muro lo aprobó tres veces en producción, pero eso es EVIDENCIA DE LO QUE PASÓ, no una reproducción.
 * QUÉ HARÍA FALTA para llegar a 25/25: que el corredor persista `call.args` y `results`. Está anotado acá porque
 * es lo que hay que arreglar antes de la próxima corrida pagada, no un detalle de este gate. */
const NO_REPRODUCIBLE = ["E6.t3"];

console.log(`\n── REPLAY DE ${F.casos.length} TURNOS · commit ${F.commit} · ${F.llamadasPagadas} llamadas · US$${F.costoUSD} ──\n`);
console.log("TURNO   GUARD      VEREDICTOS");
console.log("─".repeat(96));

const resultado = new Map();
for (const c of F.casos) {
  const g = guardC(c.respuesta, {
    ledger: { figs: c.boleta || [] }, results: [], trace: null,
    question: c.pregunta, mechanismMemory: {}, sealedOrders: [],
  });
  const kinds = [...new Set((g.violations || []).map((v) => v.kind))];
  resultado.set(c.id, { ok: g.ok, kinds });
  console.log(`${c.id.padEnd(7)} ${(g.ok ? "pasa" : "BLOQUEA").padEnd(10)} ${kinds.join(", ") || "—"}`);
}

console.log("\n[1] LOS DEFECTOS MEDIDOS SE BLOQUEAN");
for (const [id, e] of Object.entries(ESPERADO)) {
  const r = resultado.get(id);
  ok(!!r && r.ok === false, `${id} · ${e.porque}`, r ? `veredictos: ${r.kinds.join(", ") || "(ninguno)"}` : "turno ausente del fixture");
}

console.log("\n[2] LAS RESPUESTAS CORRECTAS SIGUEN PASANDO · la cara que impide cambiar un defecto por otro");
{
  const rotos = CORRECTOS.filter((id) => { const r = resultado.get(id); return r && r.ok === false; });
  ok(!rotos.length, `los ${CORRECTOS.length} turnos evaluados como correctos siguen pasando el muro`,
    rotos.map((id) => `${id}: ${resultado.get(id).kinds.join(",")}`).join(" · "));
}

console.log("\n[2b] 24/25 REPRODUCIBLES · el que falta se declara, con la causa medida");
{
  // la razón por la que no se puede reconstruir se COMPRUEBA sobre el fixture, no se afirma: si algún día el
  // corredor persiste `args`, este chequeo se pone rojo y obliga a intentar la reconstrucción de nuevo.
  const conArgs = F.casos.flatMap((c) => (c.plan && c.plan.calls) || []).filter((x) => x && typeof x === "object" && x.args).length;
  ok(conArgs === 0,
    `ninguna call del fixture trae \`args\` (${conArgs} de 57): por eso NO se pueden re-ejecutar las tools y reconstruir \`results\``);
  ok(NO_REPRODUCIBLE.length === 1 && NO_REPRODUCIBLE[0] === "E6.t3",
    `se declara 24/25 reproducibles · NO reproducible: ${NO_REPRODUCIBLE.join(", ")} (su veredicto depende de \`results\`)`);
  const c = F.casos.find((x) => x.id === "E6.t3");
  const nar = ((c || {}).retryTrace || {}).narrate || [];
  ok(nar.length > 0 && nar.every((e) => e.guardOk === true),
    `de E6.t3 sólo se conserva EVIDENCIA de lo que pasó -el guard lo aprobó ${nar.length} veces-, y eso NO es una reproducción`);
}

console.log("\n[3] EL REGISTRO DE VOZ · ninguna respuesta conserva voseo tras el guard de voz");
{
  const VOSEO = /\b(?:quer[eé]s|pod[eé]s|ten[eé]s|esperás|repon[eé]|corregí|liquidá|rotá|validá|priorizá|recalculá|reponé)\b/i;
  const conVoseo = F.casos.filter((c) => VOSEO.test(c.respuesta));
  const sobreviven = conVoseo.filter((c) => VOSEO.test(stripLanguageLeaks(c.respuesta)));
  ok(!sobreviven.length,
    `de ${conVoseo.length} respuestas con voseo medido, ninguna lo conserva tras voiceGuard`,
    sobreviven.map((c) => `${c.id}: ${(stripLanguageLeaks(c.respuesta).match(VOSEO) || [])[0]}`).join(" · "));
}

console.log("\n[4] INTEGRIDAD DE LA EVIDENCIA · el replay corre sobre los 25 turnos, no sobre una muestra");
{
  ok(F.casos.length === 25, `el fixture trae los 25 turnos medidos (${F.casos.length})`);
  ok(F.casos.every((c) => typeof c.respuesta === "string" && c.respuesta.length > 0), "los 25 traen la respuesta literal del proveedor");
  ok(F.casos.every((c) => Array.isArray(c.boleta)), "los 25 traen su boleta");
  ok(resultado.size === 25, `los 25 se evaluaron contra el guard de hoy (${resultado.size})`);
}

const bloqueados = [...resultado.entries()].filter(([, r]) => !r.ok).map(([id]) => id);
console.log(`\n── replay: ${resultado.size}/25 evaluados · 24/25 REPRODUCIBLES (E6.t3 no reproducible: sin args de las calls no se re-ejecutan sus tools) · ${bloqueados.length} bloqueados por el guard de hoy: ${bloqueados.join(", ") || "ninguno"} ──`);
console.log(`── _replay_certificacion_gate: ${PASS} PASS · ${FAIL} FAIL (de ${PASS + FAIL}) ──`);
process.exit(FAIL ? 1 : 0);
