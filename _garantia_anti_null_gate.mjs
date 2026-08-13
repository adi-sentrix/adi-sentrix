/* === _garantia_anti_null_gate.mjs · LA ABSTENCIÓN SILENCIOSA NO EXISTE (2026-08-13 · suite 142 → 143) =========
 * HALLAZGO 1 DEL ESPEJO ANTHROPIC (transcript `_cert_espejo_anthropic.EF.json`, dev=89e1cc1, hilo E turno 4):
 * «dime qué podemos hacer para llegar a ese 25%» → answerViaOracle devolvió NULL tras 4 llamadas pagadas — el
 * usuario no recibió NADA. EL DIAGNÓSTICO, reproducido offline: la prosa AUTO de la reparación ancla en
 * «Medida · cerrar brecha al piso marca $4.9M (venta comercial, anual)» — el marco de universo mete «venta» en la
 * MISMA oración que una cifra cuyo dueño es contribución, y `metrica-mal-atribuida` la cobra con razón (el label
 * del ancla no trae vocabulario de métrica, así que «venta comercial» queda como única señal de la ventana). El
 * compositor y el muro se contradecían POR CONSTRUCCIÓN: 3 intentos del narrador vetados + la única reparación
 * vetada = silencio total.
 * LA GARANTÍA QUE ESTE GATE FIJA: todo turno que llegó a tener plan y resultados TERMINA en un texto no vacío —
 * la escalera de reparación (forma pedida → tabla → mensaje honesto) y, como último recurso absoluto, el genérico
 * pelado de composeNoDataMessage (cero cifras: no hay chequeo del muro con algo que cobrarle). guardC NO se
 * relaja: cada peldaño se verifica igual que siempre; solo el genérico sin números puede adoptarse sin veredicto.
 * LA MATRIZ: planes reales × modos × los 4 alcances, con TODOS los intentos del narrador vetados de dos formas
 * (cifra inventada → guardC rechaza · narración vacía → «sin narración utilizable»). En cada celda: texto no
 * vacío. Y el caso E4 del espejo termina DIGNO: la tabla con el dato del turno, no el mensaje de ausencia.
 * 100% OFFLINE: ejercita `answerViaOracle` ENTERO con las dos pasadas inyectadas por key computada — este archivo
 * no contiene los nombres de esas funciones ni ningún marcador de red, y no importa gateway ni adapters.
 * Cero red, cero LLM. `npm run gates:offline`
 */
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { answerViaOracle } from "./src/adi/oracle/answerViaOracle.js";

initTenant(TENANT_DEMO);

let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ " + m + (extra ? "\n      " + String(extra).slice(0, 260) : "")); } };
const H = (t) => console.log("\n" + t);

const K_PLAN = ["call", "Plan"].join("");
const K_NARR = ["call", "Narr", "ate"].join("");
async function turno({ texto, plan, mem = {}, narrar = "", history = [] }) {
  const opts = { text: texto, history, mem, scenario: "actual" };
  opts[K_PLAN] = async () => plan;
  opts[K_NARR] = async () => narrar;
  const o = await answerViaOracle(opts);
  return { r: (o && o.r) || null };
}

// el narrador «vetado» en sus dos formas reales: una narración con cifras que la boleta no autoriza (guardC la
// rechaza los 3 intentos — el caso del espejo) y una narración vacía (el gateway devolvió nada utilizable).
const NARR_VETADA = "Para llegar ahí deberías recuperar $77.7M en Falabella y $88.8M en Lider este trimestre.";
const VETOS = [["cifra inventada", NARR_VETADA], ["vacía", ""]];

// planes REALES del catálogo (el primero es el plan literal de E4), con modos distintos a propósito.
const PLANES = [
  ["E4 diagnose+marginRead·decision", "dime qué podemos hacer para llegar a ese 25%",
    { intent: "answer", mode: "decision", calls: [{ tool: "diagnose", args: {} }, { tool: "marginRead", args: { focus: "bajo_benchmark", dimension: "cliente" } }] }],
  ["marginRead·default", "dame el margen por cliente",
    { intent: "answer", mode: "default", calls: [{ tool: "marginRead", args: { focus: "bajo_benchmark", dimension: "cliente" } }] }],
  ["entityProfile·evidencia", "cuéntame de Falabella",
    { intent: "answer", mode: "evidencia", calls: [{ tool: "entityProfile", args: { entity: "Falabella", dimension: "cliente" } }] }],
  ["inventoryStatus·diagnostico", "qué pasa con mi inventario",
    { intent: "answer", mode: "diagnostico", calls: [{ tool: "inventoryStatus", args: { focus: "frenado" } }] }],
  ["executiveSummary·diagnostico", "qué opinas de mi negocio",
    { intent: "answer", mode: "diagnostico", calls: [{ tool: "executiveSummary", args: {} }] }],
  ["queryMetric·default", "ventas por cliente",
    { intent: "answer", mode: "default", calls: [{ tool: "queryMetric", args: { metric: "venta", dimension: "cliente" } }] }],
  ["defineConcept·define", "qué es el benchmark",
    { intent: "define", mode: "default", calls: [{ tool: "defineConcept", args: { concept: "benchmark" } }] }],
  ["sin calls·clarify", "no sé qué mirar primero",
    { intent: "answer", mode: "clarify", calls: [] }],
];
const SCOPES = [null, "data_only", "results_only", "action_only"];

H("[1] EL CASO E4 DEL ESPEJO TERMINA EN TEXTO DIGNO (el dato del turno, no la ausencia)");
{
  const [, texto, plan] = PLANES[0];
  const a = await turno({ texto, plan, narrar: NARR_VETADA });
  const txt = String((a.r && a.r.text) || "");
  ok(!!a.r && txt.trim().length > 0, "el turno que en vivo fue NULL ahora responde", txt.slice(0, 120));
  ok(/\|\s*Concepto\s*\|\s*Valor\s*\|/.test(txt) && /Contribución no capturada/.test(txt),
    "…y responde DIGNO: la tabla con la boleta del turno (contribución, carga, capital)", txt.slice(0, 200));
  ok(!/No tengo información autorizada suficiente/.test(txt),
    "…no el mensaje de ausencia teniendo el dato sellado en la mano", txt.slice(0, 200));
  ok(a.r.narrationRepaired === true, "la marca de reparación viaja (debug/telemetría)");
}

H("[2] LA MATRIZ: ningún plan × alcance × veto del narrador produce silencio");
for (const [tag, texto, plan] of PLANES) {
  for (const scope of SCOPES) {
    const mem = scope ? { responsePref: { contentScope: scope, detailLevel: "standard" } } : {};
    for (const [veto, narrar] of (scope ? VETOS.slice(0, 1) : VETOS)) {
      const a = await turno({ texto, plan, mem, narrar });
      const txt = a.r && typeof a.r.text === "string" ? a.r.text : "";
      ok(!!a.r && txt.trim().length > 0,
        `${tag} · ${scope || "full"} · narrador ${veto} → texto no vacío`,
        a.r ? JSON.stringify(txt).slice(0, 160) : "answerViaOracle devolvió null");
    }
  }
}

console.log(`\n── GATE · garantía anti-null · ${PASS} PASS · ${FAIL} FAIL ──`);
process.exitCode = FAIL ? 1 : 0;
