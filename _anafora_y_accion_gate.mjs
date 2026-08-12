/* === _anafora_y_accion_gate.mjs · LOS DOS HALLAZGOS DE LA MICRO-CERTIFICACIÓN N (owner 2026-08-12) ============
 *   N2c · «Sumá las dos» abrió una consulta NUEVA por SKU en vez de resolver contra los dos turnos previos. La
 *         boleta quedó con un solo universo, así que las dos garantías que existen para el cruce —la declinación
 *         y el pie mixto— nunca se alcanzaron. No fallaron: el caso no llegó a formarse.
 *   N1  · la lista de frases resultó esquivable, y se comprobó: cubría «reforzar la relación comercial» y el
 *         narrador escribió «reforzar la relación con Lider». Mismo acto, una palabra menos, y pasó.
 *
 * @inyeccion-simulada · `callPlan`/`callNarrate` se inyectan a mano. No importa el gateway ni `src/ui/`, no hay
 * `fetch`: no existe camino a la red, y el candado de runtime lo verifica igual.
 *
 * `node --import ./scripts/offline-guard.mjs _anafora_y_accion_gate.mjs`
 */
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { answerViaOracle } from "./src/adi/oracle/answerViaOracle.js";
import { guardC } from "./src/adi/oracle/guardC.js";
import { componerPorForma } from "./src/adi/oracle/narrationBlocks.js";
import { runPlan } from "./src/adi/oracle/toolRunner.js";

initTenant(TENANT_DEMO);
let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };
const h = (t) => console.log(`\n${t}`);
const P = (calls) => ({ intent: "answer", mode: "analisis", pref: { contentScope: "full" }, calls });

// una conversación como la de la micro-certificación: venta anual, después capital a hoy.
async function conversacionVentaYCapital() {
  let mem = {}, hist = [];
  const turno = async (t, calls, narr) => {
    const o = await answerViaOracle({ text: t, history: hist, mem, scenario: "actual", callPlan: async () => P(calls), callNarrate: async () => narr });
    mem = o.mem; hist = [...hist, { role: "user", text: t }, { role: "assistant", text: o.r.text }];
    return o.r.text;
  };
  await turno("¿Cuánto vendimos este año?", [{ tool: "queryMetric", args: { metric: "ventas", dimension: "cliente" } }], "[[DATOS]]\nLa venta del año es la del cuadro.");
  await turno("¿Y cuánto capital tenemos inmovilizado?", [{ tool: "inventoryStatus", args: { focus: "frenado" } }], "[[DATOS]]\nEl capital inmovilizado es el del cuadro.");
  return { mem, hist };
}

/* ═══ 1 · «SUMÁ LAS DOS» RESUELVE CONTRA LOS TURNOS PREVIOS ═══════════════════════════════════════════════════ */
h("1 · N2c · la referencia se resuelve con la memoria, sin abrir otra consulta");
{
  const { mem, hist } = await conversacionVentaYCapital();
  ok(Array.isArray(mem.universosRecientes) && mem.universosRecientes.includes("venta_comercial") && mem.universosRecientes.includes("inventario"),
    "la memoria conserva los DOS universos de los turnos previos", JSON.stringify(mem.universosRecientes));

  let abrioConsulta = false;
  const o = await answerViaOracle({
    text: "Sumá las dos y decime el total del negocio.", history: hist, mem, scenario: "actual",
    // el plan que el proveedor emitió DE VERDAD en N2c: se fue a costo por SKU. Si el motor lo llegara a pedir,
    // esta sonda lo delata.
    callPlan: async () => { abrioConsulta = true; return P([{ tool: "queryMetric", args: { metric: "costo", dimension: "sku" } }]); },
    callNarrate: async () => "[[DATOS]]\nAlgo sobre SKU.",
  });
  const texto = (o && o.r && o.r.text) || "";
  ok(!abrioConsulta, "NO abre una consulta nueva: la referencia es del diálogo, no del dato");
  ok(/^No las sumo/.test(texto), "declina explícitamente, y de entrada", texto.slice(0, 60));
  ok(/stock a una fecha/.test(texto) && /flujo del per[ií]odo/.test(texto), "…explicando por qué no se suman", texto.slice(0, 140));
  ok(/venta comercial/i.test(texto) && /inventario/i.test(texto), "…nombrando las DOS de las que se hablaba", texto.slice(0, 140));
  ok(!/SKU/i.test(texto), "…y sin cambiar de eje a los SKU que el plan proponía", texto);
  ok(!/\$/.test(texto), "sin emitir cifras: el bypass corre con la boleta vacía a propósito");
}

/* ═══ 2 · SIN DOS CIFRAS ÚNICAS, SE PREGUNTA ══════════════════════════════════════════════════════════════════ */
h("2 · si no hay dos salidas distintas que recordar, se pregunta en vez de suponer");
{
  let mem = {}, hist = [];
  const o1 = await answerViaOracle({
    text: "¿Cuánto vendimos este año?", history: [], mem: {}, scenario: "actual",
    callPlan: async () => P([{ tool: "queryMetric", args: { metric: "ventas", dimension: "cliente" } }]),
    callNarrate: async () => "[[DATOS]]\nLa venta del año es la del cuadro.",
  });
  mem = o1.mem; hist = [{ role: "user", text: "¿Cuánto vendimos este año?" }, { role: "assistant", text: o1.r.text }];

  let abrio = false;
  const o = await answerViaOracle({
    text: "Sumá las dos y decime el total.", history: hist, mem, scenario: "actual",
    callPlan: async () => { abrio = true; return P([{ tool: "queryMetric", args: { metric: "ventas", dimension: "cliente" } }]); },
    callNarrate: async () => "[[DATOS]]\nAlgo.",
  });
  const t = (o && o.r && o.r.text) || "";
  ok(!abrio, "con UN solo universo recordado tampoco sale a consultar a ciegas");
  ok(/no tengo claro a cu[aá]les/i.test(t), "pregunta cuáles son, en vez de suponerlas", t.slice(0, 90));
  ok(/\?/.test(t), "…y lo hace como pregunta", t.slice(0, 90));

  // LA CARA QUE IMPIDE QUE SE ENTROMETA: sin anáfora, el turno sigue su curso normal.
  let abrio2 = false;
  await answerViaOracle({
    text: "¿Cuánto sumaron las ventas de Falabella?", history: hist, mem, scenario: "actual",
    callPlan: async () => { abrio2 = true; return P([{ tool: "entityRecord", args: { dimension: "cliente", entity: "Falabella" } }]); },
    callNarrate: async () => "[[DATOS]]\nFalabella aporta lo del cuadro.",
  });
  ok(abrio2, "una pregunta de suma SIN «las dos» no se desvía: el plan corre normal");
}

/* ═══ 3 · AFINIDAD SIN LENGUAJE DE DECISIÓN COMERCIAL ═════════════════════════════════════════════════════════ */
h("3 · N1 · sobre una afinidad estimada no se recomienda como si estuviera respaldada");
{
  const r = runPlan({ intent: "answer", calls: [{ tool: "clientesPorSku", args: { entities: ["SAM-TV55"], topN: 3 } }] }, { scenario: "actual", maxCalls: 4 });
  const ctx = { ledger: r.ledger, results: r.results, trace: null, question: "¿qué clientes podrían comprarlo?", mechanismMemory: {}, sealedOrders: [] };

  // EL TEXTO REAL DE N1: declaraba la estimación en una oración y recomendaba en otra, sin marco. La lista de
  // frases no lo cazó porque el narrador escribió «la relación» y no «la relación comercial».
  const REAL = "Estos valores son estimaciones basadas en afinidades de surtido y no reflejan ventas específicas. Además, considera reforzar la relación con Lider para LG-WASH11KG, dado su alto nivel de participación.";
  ok(!guardC(REAL, ctx).ok, "el texto real de N1 ahora se bloquea, aunque esquive la lista de frases");
  const det = (guardC(REAL, ctx).violations || []).map((v) => String(v.detail || "")).join(" ");
  ok(/recomienda una acci[oó]n comercial/i.test(det), "…y el veredicto explica que el problema es RECOMENDAR sin marco", det.slice(0, 120));

  // el eje real de la regla: el mismo consejo, con y sin marco en LA MISMA oración.
  const SIN = "Conviene priorizar a Falabella para este SKU.";
  const CON = "Una posible salida es priorizar a Falabella para este SKU, a validar con el equipo comercial.";
  ok(!guardC(SIN, ctx).ok, "«conviene priorizar…» sin marco se bloquea");
  ok(guardC(CON, ctx).ok, "…y el MISMO consejo enmarcado como posible pasa", (guardC(CON, ctx).violations || []).map((v) => v.kind).join(","));

  // POR ORACIÓN, no por texto: una declaración lejos no autoriza una orden suelta.
  const LEJOS = "Son estimaciones de afinidad de surtido.\n\nHay que activar a Lider en este SKU cuanto antes.";
  ok(!guardC(LEJOS, ctx).ok, "declarar el estatus en otro párrafo NO autoriza la orden de éste");

  // varias formas de recomendar, ninguna de la lista de frases de negocio.
  for (const frase of ["Recomiendo enfocar el esfuerzo en Paris.", "Deberías activar a Ripley para este producto.", "Empezá por Falabella."]) {
    ok(!guardC(frase, ctx).ok, `«${frase}» se bloquea sin nombrar ninguna frase de negocio`);
  }

  // y el fallback determinístico sigue pasando su propio muro en las cuatro formas.
  for (const forma of ["prosa", "tabla", "auto", "solo_conclusion"]) {
    const t = componerPorForma({ figs: r.ledger.figs, contentScope: "full", forma });
    ok(guardC(t, ctx).ok, `el fallback «${forma}» pasa`, (guardC(t, ctx).violations || []).map((v) => v.kind).join(","));
  }

  // LA CARA QUE IMPIDE EL FALSO POSITIVO: sin figs de afinidad, recomendar es normal y no se toca.
  const rNormal = runPlan({ intent: "answer", calls: [{ tool: "entityRecord", args: { dimension: "cliente", entity: "Falabella" } }] }, { scenario: "actual", maxCalls: 4 });
  const ctxNormal = { ledger: rNormal.ledger, results: rNormal.results, trace: null, question: "¿cómo viene Falabella?", mechanismMemory: {}, sealedOrders: [] };
  ok(guardC("Conviene priorizar a Falabella: su margen quedó bajo la vara.", ctxNormal).ok,
    "sobre un dato normal, recomendar sigue siendo legítimo — la regla ni se ejecuta");
}

console.log(`\n── _anafora_y_accion_gate: ${PASS} PASS · ${FAIL} FAIL (de ${PASS + FAIL}) ──`);
process.exit(FAIL ? 1 : 0);
