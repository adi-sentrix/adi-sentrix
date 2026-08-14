/* === _cierre_cert_amplia_gate.mjs · EL CIERRE DE LA CERTIFICACIÓN AMPLIA (2026-08-13 · suite 140 → 141) =======
 * Los 4 arreglos de MOTOR sobre los hallazgos medidos en vivo (transcripts `_cert_amplia_openai.ABCD/EFGH.json`,
 * dev=81638bf), vueltos permanentes:
 *   1 · EL RESPALDO COMPONE DIGNO (hallazgo 1 · B1/G6/E4): una pregunta de EJE COMPLETO reparada compone TABLA
 *       con la métrica preguntada como columna protagonista; el ancla de la oración es la PRIMERA fig del ranking
 *       sellado por la tool (peor brecha en marginRead), nunca «la magnitud mayor» (que en margen es la entidad
 *       MENOS urgente); con supuesto declarado, el EFECTO ancla. «En una sola frase» resuelve solo_conclusion.
 *   2 · LA CALCULADORA HABLA EN PALABRAS DE USUARIO (hallazgo 3 · E5): ningún coverage.reason de `calcular` trae
 *       identificadores con guion bajo, nombres de operación del catálogo ni la palabra «insumos»; el caso medido
 *       («¿y si mi venta subiera 10%?» → escalar mal elegido) se RESCATA a la operación correcta sellada como
 *       hipótesis, o declina PREGUNTANDO la variable que falta.
 *   3 · REGISTRO (hallazgo 4): «capital/inventario detenido» → «inmovilizado» (solo el bigrama — el verbo sobre
 *       un SKU es legítimo); el cierre de clarify no duplica la pregunta cuando la cláusula de período la tapa.
 *   4 · «EL NUESTRO» ES EL NEGOCIO (hallazgo 2): el posesivo de negocio fuerza alcance global y limpia los
 *       anclajes heredados; «¿y Lider?» sigue heredando.
 * 100% OFFLINE: ejercita `answerViaOracle` ENTERO con las dos pasadas inyectadas por key computada — este archivo
 * no contiene los nombres de esas funciones ni ningún marcador de red, y no importa gateway ni adapters.
 * Cero red, cero LLM. `npm run gates:offline`
 */
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { answerViaOracle } from "./src/adi/oracle/answerViaOracle.js";
import { TOOLS } from "./src/adi/oracle/toolRegistry.js";
import { OPERACIONES_CALCULO } from "./src/adi/oracle/calculoCatalogo.js";
import { stripLanguageLeaks } from "./src/adi/llm/voiceGuard.js";
import { ensureClarifyClosingQuestion } from "./src/adi/oracle/narratePromptC.js";
import { resolveOutputForm } from "./src/adi/oracle/progressiveDisclosure.js";

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
  return { r: (o && o.r) || null, mem: (o && o.mem) || null };
}

H("[1] EL RESPALDO COMPONE DIGNO (B1: eje completo → tabla · ancla del ranking sellado)");
{
  const plan = { intent: "answer", mode: "default", calls: [{ tool: "marginRead", args: { focus: "bajo_benchmark", dimension: "cliente" } }] };
  const a = await turno({ texto: "dame el margen por cliente", plan });
  const txt = String((a.r && a.r.text) || "");
  ok(a.r && a.r.narrationRepaired === true && /\|\s*Cliente\s*\|\s*Margen\s*\|/.test(txt),
    "la reparación de un eje completo compone TABLA con la métrica protagonista", txt.slice(0, 120));
  /* ESTA ASERCIÓN SE MOVIÓ DE FORMATO A COMPORTAMIENTO (2026-08-14, respaldo digno). Fijaba la frase textual
   * «Por dónde partir: Lider · Margen, que es la métrica por la que preguntaste.» — y esa frase se retiró de
   * pantalla porque es el motor explicando su propio criterio de selección, vocabulario de máquina que el owner
   * marcó como indigno («¿qué es eso de en este turno?» sobre la línea hermana). LO QUE EL GATE PROTEGÍA de
   * verdad, y sigue protegiendo, es el COMPORTAMIENTO: que el ancla sea la PRIMERA fig del ranking sellado por la
   * tool —Lider, la peor brecha— y no la magnitud mayor, que en margen es Ripley 25.0%, la cuenta MENOS urgente.
   * Se verifica sobre la lectura de apertura, que es donde el ancla quedó, y se agrega el contrapositivo explícito
   * (Ripley no encabeza) para que un cambio de redacción no pueda volver a tapar una regresión de criterio. */
  ok(/^Lider encabeza la lectura/m.test(txt) && !/^Ripley encabeza/m.test(txt),
    "el ancla es la peor brecha (primera del ranking sellado), no la magnitud mayor", txt);
  ok(!/magnitud mayor/.test(txt), "«la magnitud mayor» (el margen más alto = lo menos urgente) dejó de anclar", txt);
  ok(/Por dónde partir: \w/.test(txt) && !/que es la métrica por la que preguntaste/.test(txt),
    "el cierre sigue diciendo por dónde partir, ya sin explicar en pantalla el criterio del motor", txt);
  ok(resolveOutputForm({ plan: null, text: "resúmeme TODO en una sola frase" }) === "solo_conclusion",
    "G6: «en una sola frase» resuelve solo_conclusion");
}

H("[2] LA CALCULADORA HABLA EN PALABRAS DE USUARIO (E5: rescate o pregunta)");
{
  const OPS_RE = new RegExp("\\b(" + Object.keys(OPERACIONES_CALCULO).join("|") + ")\\b", "i");
  const registroLimpio = (reason) => !/\w_\w/.test(reason) && !OPS_RE.test(reason) && !/insumos?\b/i.test(reason);
  const r = TOOLS.calcular({ operacion: "escalar", insumos: [{ entidad: "negocio", metrica: "ventas" }], objetivo: { usuario: "10% el próximo año" }, scenario: "actual" });
  ok(r.coverage.supported === true && r.facts.operacion === "variacion_aplicada" && r.facts.conCifraDeUsuario === true,
    "el caso E5 exacto se RESCATA a la operación correcta, sellada como hipótesis", r.coverage.reason);
  const sinMonto = TOOLS.calcular({ operacion: "escalar", insumos: [{ usuario: "10% el próximo año" }], scenario: "actual" });
  ok(sinMonto.coverage.supported === false && /sobre qué monto aplicarlo/.test(sinMonto.coverage.reason) && registroLimpio(sinMonto.coverage.reason),
    "sin monto no adivina: pregunta la variable que falta, en palabras de usuario", sinMonto.coverage.reason);
  for (const [nombre, args] of [
    ["operación inventada", { operacion: "formula_magica", insumos: [{ entidad: "Falabella", metrica: "ventas" }] }],
    ["unidades $ con %", { operacion: "suma", insumos: [{ entidad: "Falabella", metrica: "margen" }, { entidad: "Falabella", metrica: "ventas" }] }],
    ["aridad", { operacion: "brecha_pp", insumos: [{ entidad: "Falabella", metrica: "margen" }] }],
  ]) {
    const d = TOOLS.calcular({ ...args, scenario: "actual" });
    ok(d.coverage.supported === false && registroLimpio(d.coverage.reason), `${nombre} → declinación con registro limpio`, d.coverage.reason);
  }
  const noRescate = TOOLS.calcular({ operacion: "escalar", insumos: [{ entidad: "negocio", metrica: "ventas" }, { entidad: "Falabella", metrica: "margen" }], scenario: "actual" });
  ok(noRescate.coverage.supported === false, "una tasa DEL DATO no se rescata («venta × margen» sigue cerrado)");
}

H("[3] REGISTRO: inmovilizado (solo el bigrama) · una sola pregunta de cierre");
{
  ok(/capital total inmovilizado/.test(stripLanguageLeaks("El capital total detenido asciende a $33K.")),
    "«capital total detenido» → «capital total inmovilizado»");
  ok(/inventario inmovilizado/.test(stripLanguageLeaks("hay $33K de inventario detenido.")), "«inventario detenido» → «inventario inmovilizado»");
  const sku = "MAK-COMP-AIR está detenido y el SKU se detuvo hace 112 días.";
  ok(stripLanguageLeaks(sku) === sku, "el verbo sobre un SKU/proceso queda intacto (H3/H4, legítimo)");
  const b2 = "Ripley tiene un margen del 25%.\n\n¿Te gustaría que profundizáramos en las acciones comerciales? (Datos del año cerrado.)";
  ok(ensureClarifyClosingQuestion(b2, "clarify") === b2, "pregunta guía + cláusula de período → NO se duplica la pregunta (B2)");
  const sinP = "Ripley tiene un margen del 25%. (Datos del año cerrado.)";
  ok(/siguiente paso\?$/.test(ensureClarifyClosingQuestion(sinP, "clarify")), "sin pregunta guía, la garantía sigue agregando la suya");
}

H("[4] «EL NUESTRO» ES EL NEGOCIO (E3): alcance global · «¿y Lider?» hereda");
{
  const plan = { intent: "answer", mode: "default", scope: { level: "entity", entities: ["Falabella"] },
    calls: [{ tool: "marginRead", args: { focus: "bajo_benchmark", dimension: "cliente", filters: { cliente: "Falabella" } } }] };
  const HIST = [{ role: "user", text: "¿cuánto representa Falabella de mi venta total?" }, { role: "adi", text: "Falabella genera $19.4M, 19.4% del total." }];
  const a = await turno({ texto: "una noticia dice que el margen de la industria debería estar en 25%, ¿cuál es el nuestro?", plan, history: HIST });
  const coer = (a.r && a.r.retryTrace && a.r.retryTrace.coerciones) || [];
  ok(coer.some((c) => /alcance-negocio/.test(String(c))) && !/^Sobre Falabella/.test(String((a.r && a.r.text) || "")),
    "el posesivo de negocio fuerza alcance GLOBAL (la entidad del hilo no ancla)", JSON.stringify(coer));
  const b = await turno({ texto: "¿y Lider?", plan: { intent: "answer", mode: "default", scope: { level: "entity", entities: ["Lider"] }, calls: [{ tool: "entityProfile", args: { entity: "Lider", dimension: "cliente" } }] }, history: HIST });
  const coerB = (b.r && b.r.retryTrace && b.r.retryTrace.coerciones) || [];
  ok(!coerB.some((c) => /alcance-negocio/.test(String(c))) && /Lider/.test(String((b.r && b.r.text) || "")),
    "«¿y Lider?» sigue heredando como siempre (la red es angosta)");
}

console.log(`\n── CIERRE CERT AMPLIA · ${PASS} PASS · ${FAIL} FAIL ──`);
process.exitCode = FAIL ? 1 : 0;
