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

/* ── LÍMITE DEL REPLAY, DECLARADO CON SU EVIDENCIA (owner 2026-08-11) ─────────────────────────────────────────
 * El fixture preserva la respuesta, el plan y la BOLETA de cada turno, pero NO los `results` ni el `trace` de las
 * tools. Los chequeos que autorizan una cifra DERIVADA leyendo `results` —el delta entre el caso base y el
 * simulado, por ejemplo— no pueden resolverse en el replay y producen un rechazo que en producción no ocurrió.
 * NO SE TAPA CON UNA EXCEPCIÓN A CIEGAS: el propio fixture trae la prueba de qué dijo el guard ese día. En E6.t3
 * `retryTrace.narrate` es [true,true,true] — el muro APROBÓ la respuesta tres veces. Las cifras que el replay
 * rechaza ($0.2M y $0.6M) son la mejora de contribución del escenario, derivada de `results`.
 * Se excluye ESE turno, por ESA razón, y el gate lo verifica leyendo el trace en vez de creerle a este comentario:
 * si algún día el fixture guardara `results`, la exclusión deja de hacer falta y se ve acá. */
const LIMITE_DEL_REPLAY = ["E6.t3"];

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

console.log("\n[2b] EL LÍMITE DEL REPLAY SE VERIFICA, NO SE DECLARA · el trace del fixture es la prueba");
for (const id of LIMITE_DEL_REPLAY) {
  const c = F.casos.find((x) => x.id === id);
  const nar = ((c || {}).retryTrace || {}).narrate || [];
  ok(nar.length > 0 && nar.every((e) => e.guardOk === true),
    `${id} está excluido porque el guard lo APROBÓ en producción (trace: ${JSON.stringify(nar.map((e) => e.guardOk))}) — el rechazo del replay es falta de \`results\`, no del producto`);
  const r = resultado.get(id);
  ok(!!r && r.ok === false, `…y hoy el replay lo rechaza, que es justo lo que esta exclusión documenta`, r ? r.kinds.join(",") : "-");
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
console.log(`\n── replay: ${resultado.size}/25 turnos evaluados · ${bloqueados.length} bloqueados por el guard de hoy: ${bloqueados.join(", ") || "ninguno"} ──`);
console.log(`── _replay_certificacion_gate: ${PASS} PASS · ${FAIL} FAIL (de ${PASS + FAIL}) ──`);
process.exit(FAIL ? 1 : 0);
