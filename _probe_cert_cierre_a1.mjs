/* === _probe_cert_cierre_a1.mjs · ARREGLO 1 del cierre de la certificación amplia (2026-08-13) ==================
 * Reproduce OFFLINE el hallazgo 1 (hilo B turno 1, transcript `_cert_amplia_openai.ABCD.json`, dev=81638bf):
 * «dame el margen por cliente» agotó los 3 intentos del narrador y el respaldo compuso una oración-líder con el
 * ancla en Ripley (la magnitud mayor = el margen MÁS ALTO) + el resto en choclo — donde la cert #2 había narrado
 * una tabla. Verifica:
 *   [1] la reparación de un EJE COMPLETO compone TABLA con la métrica preguntada como columna protagonista;
 *   [2] el ancla es la PRIMERA fig del ranking sellado (peor brecha para marginRead), no la magnitud;
 *   [3] G6 «resúmeme TODO en una sola frase» resuelve solo_conclusion (una línea);
 *   [4] E4 (sin métrica nombrada, con fig mandatory de simulación) ancla en la cifra que la tool sella central;
 *   [5] las garantías del 3b quedan intactas (métrica preguntada encabeza · magnitud cuando no hay métrica).
 * 100% OFFLINE: pasadas inyectadas por key computada, cero gateway, cero red.
 * Correr con el candado de red puesto:  node --import ./scripts/offline-guard.mjs _probe_cert_cierre_a1.mjs */
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { answerViaOracle } from "./src/adi/oracle/answerViaOracle.js";
import { componerPorForma } from "./src/adi/oracle/narrationBlocks.js";
import { resolveOutputForm } from "./src/adi/oracle/progressiveDisclosure.js";

initTenant(TENANT_DEMO);

let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };
const H = (t) => console.log("\n" + t);

const K_PLAN = ["call", "Plan"].join("");
const K_NARR = ["call", "Narr", "ate"].join("");
async function turno({ texto, plan, mem = {}, narrar = "", history = [] }) {
  let narrado = 0;
  const opts = { text: texto, history, mem, scenario: "actual" };
  opts[K_PLAN] = async () => plan;
  opts[K_NARR] = async () => { narrado++; return narrar; };   // narrar="" → «sin narración utilizable» ×3 → reparación
  const o = await answerViaOracle(opts);
  return { r: (o && o.r) || null, mem: (o && o.mem) || null, narrado };
}

H("[1] B1 REPRODUCIDO: «dame el margen por cliente» + narrador agotado → el respaldo compone TABLA");
{
  const plan = { intent: "answer", mode: "default", calls: [{ tool: "marginRead", args: { focus: "bajo_benchmark", dimension: "cliente" } }] };
  const a = await turno({ texto: "dame el margen por cliente", plan });
  const txt = String((a.r && a.r.text) || "");
  ok(!!a.r && a.r.narrationRepaired === true, "el turno salió por la reparación (narrador agotado, como en vivo)", txt);
  ok(/\|\s*Cliente\s*\|\s*Margen\s*\|/.test(txt), "la tabla lleva la métrica preguntada como columna protagonista", txt);
  const filas = (txt.match(/^\|\s*[^|]+\|\s*\d/gm) || []).length;
  ok(filas >= 4, `el eje completo se tabuló (${filas} filas de cifra, ≥4)`, txt);
  ok(!/marca 25\.0%/.test(txt) && !/^Ripley · Margen/.test(txt), "no queda la oración-líder anclada en Ripley (el margen más alto)", txt);
  // el ancla, si hay oración de partida, es la PRIMERA del ranking sellado (peor brecha = Lider 21.5%)
  const m = /Por dónde partir: ([^,]+),/.exec(txt);
  ok(!!m && /Lider/.test(m[1]), "el «por dónde partir» ancla en la peor brecha (Lider, primera del ranking sellado)", txt);
  ok(/que es la métrica por la que preguntaste/.test(txt), "…con la justificación verdadera del 3b intacta", txt);
}

H("[2] EL ANCLA DE ORACIÓN (cuando NO hay eje completo) sale del ranking sellado, no de la magnitud");
{
  // figs sintéticas con la forma EXACTA de marginRead bajo_benchmark: orden sellado peor-brecha-primero
  const figs = [
    { label: "Lider · Margen", value: "21.5%", unit: "pct", raw: 21.5, tipo: { sello: "probado", entidad: "Lider", dimension: "cliente" } },
    { label: "Falabella · Margen", value: "22.0%", unit: "pct", raw: 22.0, tipo: { sello: "probado", entidad: "Falabella", dimension: "cliente" } },
    { label: "Ripley · Margen", value: "25.0%", unit: "pct", raw: 25.0, tipo: { sello: "probado", entidad: "Ripley", dimension: "cliente" } },
  ];
  const t = componerPorForma({ figs, contentScope: "full", forma: "auto", metricaLabels: ["Margen"] });
  ok(/\|\s*Cliente\s*\|\s*Margen\s*\|/.test(String(t)) === false, "con 3 entidades (N<4) NO tabula — la red es angosta", t);
  ok(/^Lider · Margen marca 21\.5%/.test(String(t)), "la oración ancla en la PRIMERA del ranking sellado (peor brecha), no en Ripley", t);
  // data_only también hereda el ancla del ranking sellado
  const d = componerPorForma({ figs, contentScope: "data_only", forma: "auto", metricaLabels: ["Margen"] });
  ok(/^Lider · Margen: 21\.5%/.test(String(d)), "data_only: la oración de cifra ancla igual en el ranking sellado", d);
}

H("[3] G6: «resúmeme TODO en una sola frase» resuelve solo_conclusion y sale en UNA línea");
{
  ok(resolveOutputForm({ plan: null, text: "resúmeme TODO en una sola frase" }) === "solo_conclusion",
    "la forma resuelve solo_conclusion (el adjetivo «sola» ya no la esconde)");
  ok(resolveOutputForm({ plan: null, text: "explícame la línea de producto en dos líneas" }) === "solo_conclusion",
    "«en dos líneas» sigue resolviendo (regresión)");
  ok(resolveOutputForm({ plan: null, text: "cómo viene la línea de crédito" }) === "auto",
    "«línea de crédito» NO es un presupuesto de largo (lookahead intacta)");
  const plan = { intent: "ack", mode: "seguimiento", calls: [{ tool: "entityProfile", args: { entity: "Falabella", dimension: "cliente" } }] };
  const a = await turno({ texto: "resúmeme TODO en una sola frase", plan });
  const txt = String((a.r && a.r.text) || "");
  ok(!!a.r && !txt.includes("\n") && /Falabella/.test(txt), "el turno reparado sale en UNA línea", txt);
}

H("[4] E4 (sin métrica nombrada, CON supuesto): el EFECTO ancla, con su justificación verdadera");
{
  const figs = [
    { label: "Falabella · Venta actual", value: "$19.4M", unit: "money", raw: 19400000, source: "actual", context: "supuesto: carga comercial → target (3.5%) sobre el dato real", tipo: { sello: "probado", entidad: "Falabella" } },
    { label: "Recuperable · total", value: "$194K", unit: "money", raw: 194000, mandatory: true, source: "computed", tipo: { sello: "indicado", entidad: null } },
    { label: "Falabella · Venta supuesta", value: "$18.0M", unit: "money", raw: 18000000, source: "computed", tipo: { sello: "indicado", entidad: "Falabella" } },
  ];
  const t = String(componerPorForma({ figs, contentScope: "full", forma: "auto", metricaLabels: [] }));
  ok(/Por dónde partir: Recuperable · total, que es el efecto del supuesto planteado\./.test(t),
    "ancla en el efecto (primera fig computed), no en la magnitud mayor", t);
  ok(!/Venta actual, que es la magnitud mayor/.test(t), "…y la magnitud mayor dejó de mandar ahí", t);
  // sin supuesto en el ledger, la magnitud sigue mandando (la red es angosta)
  const sinSup = figs.map(({ context, ...f }) => f);
  const t2 = String(componerPorForma({ figs: sinSup, contentScope: "full", forma: "auto", metricaLabels: [] }));
  ok(/Venta actual, que es la magnitud mayor/.test(t2), "sin supuesto declarado, el criterio de siempre queda intacto", t2);
}

H("[5] LAS GARANTÍAS DEL 3b, INTACTAS");
{
  const MEM_DO = { responsePref: { contentScope: "data_only", detailLevel: "standard" } };
  const PLAN_PROFILE = { intent: "answer", mode: "default", calls: [{ tool: "entityProfile", args: { entity: "Sodimac", dimension: "cliente" } }] };
  const a = await turno({ texto: "margen de Sodimac", plan: PLAN_PROFILE, mem: MEM_DO });
  ok(!!a.r && /^Sodimac · Margen: 23\.5%/.test(String(a.r.text)), "«margen de Sodimac» → encabeza la métrica preguntada (3b)", a.r && a.r.text);
  const b = await turno({ texto: "dame Sodimac", plan: PLAN_PROFILE, mem: MEM_DO });
  ok(!!b.r && /^Sodimac · Ventas: \$8\.2M/.test(String(b.r.text)), "«dame Sodimac» (sin métrica, perfil sin mandatory) → magnitud de siempre", b.r && b.r.text);
}

console.log(`\n── PROBE A1 · compositor de respaldo digno · ${PASS} PASS · ${FAIL} FAIL ──`);
process.exitCode = FAIL ? 1 : 0;
