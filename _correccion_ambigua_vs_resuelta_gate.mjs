/* === _correccion_ambigua_vs_resuelta_gate.mjs · LAS DOS CONDUCTAS DE UNA CORRECCIÓN (owner 2026-08-11) ========
 * @inyeccion-simulada — ejercita `answerViaOracle` ENTERO con `callPlan`/`callNarrate` pasados a mano. No importa
 * el gateway ni un adapter, no contiene `fetch(`, no importa nada de `src/ui/`. Cero red, cero llamadas pagadas.
 *
 * ── EL DEFECTO QUE PROTEGE (defecto 9 de la certificación de 44 turnos) ───────────────────────────────────────
 * El turno medido fue «Eso está mal.», y el planificador emitió `{intent:"redirect", calls:["pnlRead"]}` SIN el
 * objeto `reparacion`. El motor ejecutó la tool y ADIVINÓ qué estaba mal en vez de preguntar. El contrato pide una
 * sola pregunta de precisión.
 *
 * ── POR QUÉ SON DOS CONDUCTAS Y NO UNA ───────────────────────────────────────────────────────────────────────
 * Las dos llegan como `redirect` sin `reparacion`, y confundirlas rompe una de las dos:
 *   · «Eso está mal»  → NO hay información suficiente. Las calls repetirían el alcance vigente, así que se
 *                       descartan: UNA pregunta, CERO tools, CERO narrador, contexto intacto.
 *   · «No, era Lider» → la corrección está RESUELTA: el sujeto nuevo viaja EN LAS CALLS. Cambia la entidad,
 *                       conserva métrica y período, ejecuta y responde. Pedir precisión acá es hacerle repetir
 *                       al usuario algo que ya dijo.
 * La diferencia NO se detecta leyendo la frase del usuario —eso sería un detector de texto, justo lo que el owner
 * prohibió—: se decide comparando el ALCANCE VIGENTE contra el ALCANCE QUE EL PLAN RESUELVE.
 *
 * ── LO QUE ESTE GATE IMPIDE QUE VUELVA ───────────────────────────────────────────────────────────────────────
 * `inferirCorrige` exigía `plan.scope`, un campo OPCIONAL que el planificador puede omitir. Con esa guarda, una
 * omisión del modelo convertía cualquier corrección clara en ambigua. Ahora las calls son la segunda fuente.
 *
 * `node --import ./scripts/offline-guard.mjs _correccion_ambigua_vs_resuelta_gate.mjs`
 */
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { answerViaOracle } from "./src/adi/oracle/answerViaOracle.js";
import { inferirCorrige } from "./src/adi/oracle/conversationScope.js";

initTenant(TENANT_DEMO);

let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };
const H = (t) => console.log("\n" + t);

// el alcance vigente que deja un turno anterior — mismo shape que produce updateConversationScope.
const scopePrev = (tool, entities, { dimension = "cliente", metrica = "contribucion" } = {}) => ({
  conversationScope: {
    version: 1,
    current: {
      turno: 2, dimension, entities, selection: { orden: null, subset: null }, periodo: "año cerrado",
      filtros: entities.length === 1 ? { [dimension]: entities[0] } : null, metrica,
      operacion: "answer", modo: "default", tool,
      origen: { callId: "c1", boletaLabels: [] }, supuestos: [], faltantes: [], ofertaPendiente: null, tenant: null,
    },
    history: [],
    recentSubjects: [{ entidad: entities[0], dimension, turno: 2, mode: "default", intent: "answer", tool }],
  },
});

// UN TURNO COMPLETO, con las dos pasadas SIMULADAS. `narrado` cuenta si se invocó al narrador: un turno que
// pregunta no puede gastar la segunda llamada, y eso se mide, no se supone.
async function turno(texto, plan, mem) {
  let narrado = 0, planeado = 0;
  const o = await answerViaOracle({
    text: texto, history: [{ role: "user", text: "contexto previo del hilo" }], mem, scenario: "bonanza",
    callPlan: async () => { planeado++; return plan; },
    callNarrate: async () => { narrado++; return "El resultado de la cuenta llega hasta la contribución."; },
  });
  const r = (o && o.r) ? o.r : null;
  return {
    texto: r ? String(r.text || "") : null,
    narrado, planeado,
    mem: (o && o.mem) || null,
    preguntas: ((r ? String(r.text || "") : "").match(/\?/g) || []).length,
    figs: ((r && r.evidence && (r.evidence.boleta || r.evidence.figs)) || []).length,
  };
}

/* ══ [1] «ESO ESTÁ MAL» · el plan EXACTO de E8.t3 ═══════════════════════════════════════════════════════════ */
H("[1] SIN INFORMACIÓN SUFICIENTE · una pregunta, cero tools, cero narrador, contexto intacto");
{
  const memIn = scopePrev("pnlRead", ["Falabella"]);
  const r = await turno("Eso está mal.", { intent: "redirect", calls: [{ tool: "pnlRead", args: {} }] }, memIn);
  ok(r.preguntas === 1, `hace UNA sola pregunta de precisión (hizo ${r.preguntas})`, r.texto);
  ok(r.narrado === 0, `no invoca al narrador — el turno no gasta la segunda llamada (narró ${r.narrado})`);
  ok(r.figs === 0, `no ejecuta tools: la boleta queda vacía (${r.figs} cifras)`);
  // CONTEXTO INTACTO: el contrato dice que mientras no tenga la respuesta, no modifica el alcance.
  const antes = memIn.conversationScope.current;
  const desp = (r.mem && r.mem.conversationScope && r.mem.conversationScope.current) || {};
  ok(JSON.stringify(desp.entities || []) === JSON.stringify(antes.entities),
    "conserva la entidad vigente (no recalcula ni reencuadra mientras pregunta)", JSON.stringify(desp.entities));
  ok((desp.metrica || antes.metrica) === antes.metrica, "conserva la métrica vigente");
}

/* ══ [2] «NO, ERA LIDER» · corrección RESUELTA ══════════════════════════════════════════════════════════════ */
H("[2] CORRECCIÓN RESUELTA · cambia la entidad, ejecuta y responde SIN pedir precisión");
{
  const memIn = scopePrev("pnlRead", ["Falabella"]);
  const r = await turno("No, era Lider.", { intent: "redirect", calls: [{ tool: "pnlRead", args: { entity: "Lider" } }] }, memIn);
  ok(!/qué corrijo|qué es lo que|precisión|cuál de/i.test(r.texto || ""),
    "NO pide una precisión: la corrección venía resuelta en las calls", r.texto);
  const desp = (r.mem && r.mem.conversationScope && r.mem.conversationScope.current) || {};
  ok(!(desp.entities || []).includes("Falabella"), "la entidad anterior no sobrevive", JSON.stringify(desp.entities));
}

/* ══ [3] LA CAUSA RAÍZ · una omisión del modelo no vuelve ambigua una corrección clara ══════════════════════ */
H("[3] `inferirCorrige` LEE EL ALCANCE QUE RESUELVEN LAS CALLS, no sólo el `scope` declarado");
{
  const prev = scopePrev("pnlRead", ["Falabella"]).conversationScope;
  // el plan de la corrección clara, SIN `scope` — exactamente lo que emitió el planificador real.
  ok(inferirCorrige(prev, { intent: "redirect", calls: [{ tool: "pnlRead", args: { entity: "Lider" } }] }).includes("entidad"),
    "sin `plan.scope`, la entidad nueva de las calls se infiere igual");
  // …y el plan ambiguo, que no resuelve NINGÚN alcance nuevo, sigue sin inferir nada.
  ok(inferirCorrige(prev, { intent: "redirect", calls: [{ tool: "pnlRead", args: {} }] }).length === 0,
    "un plan que no resuelve ningún alcance nuevo NO infiere una corrección que nadie declaró");
  // el `scope` declarado sigue MANDANDO cuando viene: las calls completan, nunca pisan.
  ok(inferirCorrige(prev, { scope: { level: "global", entities: [] }, calls: [{ tool: "pnlRead", args: { entity: "Lider" } }] }).includes("alcance"),
    "cuando el planificador SÍ declara `scope`, manda el declarado");
}

/* ══ [4] NO SECUESTRA CAMBIOS DE TEMA LEGÍTIMOS ═════════════════════════════════════════════════════════════ */
H("[4] UN CAMBIO DE TEMA ENTRA COMO `answer` Y NO ACTIVA EL RESPALDO");
{
  for (const [q, plan] of [
    ["¿Y cómo viene Lider?", { intent: "answer", calls: [{ tool: "pnlRead", args: { entity: "Lider" } }] }],
    ["Mostrame el capital detenido", { intent: "answer", calls: [{ tool: "inventoryRead", args: {} }] }],
  ]) {
    const r = await turno(q, plan, scopePrev("pnlRead", ["Falabella"]));
    ok(!/qué corrijo|la entidad, la métrica, el período/i.test(r.texto || ""),
      `«${q}» no cae en la pregunta de precisión`, (r.texto || "").slice(0, 90));
  }
}

console.log(`\n── _correccion_ambigua_vs_resuelta_gate: ${PASS} PASS · ${FAIL} FAIL (de ${PASS + FAIL}) ──`);
process.exit(FAIL ? 1 : 0);
