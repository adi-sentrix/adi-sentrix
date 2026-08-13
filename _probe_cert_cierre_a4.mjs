/* === _probe_cert_cierre_a4.mjs · ARREGLO 4 del cierre de la certificación amplia (2026-08-13) ==================
 * Reproduce OFFLINE el hallazgo 2 (hilo E turno 3, `_cert_amplia_openai.EFGH.json`, dev=81638bf — el caso
 * canónico del owner): tras dos turnos sobre Falabella, «una noticia dice que el margen de la industria debería
 * estar en 25%, ¿cuál es el nuestro?» ancló a FALABELLA en vez del margen general del negocio. La doctrina «del
 * negocio nunca hereda entidad» existía solo en el prompt del PLAN; «el nuestro» sin la palabra «negocio» no la
 * disparaba. Verifica el piso determinístico `_coerceAlcanceNegocio`:
 *   [1] «¿cuál es el nuestro?» con entidad heredada en las calls → alcance GLOBAL (filtros limpiados, trazado);
 *   [2] «¿y Lider?» sigue heredando como siempre (sin marcador, la red no toca nada);
 *   [3] candado 2: si el TEXTO nombra la entidad («a Falabella en total»), no se limpia nada;
 *   [4] candado 3: una call cuyo contrato EXIGE entidad no se fuerza (falso negativo antes que call inválida).
 * 100% OFFLINE: pasadas inyectadas por key computada — cero gateway, cero red.
 * Correr con el candado de red puesto:  node --import ./scripts/offline-guard.mjs _probe_cert_cierre_a4.mjs */
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { answerViaOracle } from "./src/adi/oracle/answerViaOracle.js";

initTenant(TENANT_DEMO);

let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ " + m + (extra ? "\n      " + String(extra).slice(0, 300) : "")); } };
const H = (t) => console.log("\n" + t);

const K_PLAN = ["call", "Plan"].join("");
const K_NARR = ["call", "Narr", "ate"].join("");
async function turno({ texto, plan, mem = {}, narrar = "", history = [] }) {
  let planVisto = null;
  const opts = { text: texto, history, mem, scenario: "actual" };
  opts[K_PLAN] = async () => plan;
  // capturamos el plan que llega al narrador (ya coercionado) leyendo el payload del usuario del narrador
  opts[K_NARR] = async (payload) => { planVisto = payload; return narrar; };
  const o = await answerViaOracle(opts);
  return { r: (o && o.r) || null, mem: (o && o.mem) || null, planVisto };
}

// el hilo previo: dos turnos sobre Falabella (como en la cert), con su scope vigente en mem
const HIST = [
  { role: "user", text: "¿cuánto representa Falabella de mi venta total?" },
  { role: "adi", text: "Falabella genera $19.4M en ventas, 19.4% del total. Su margen es 22%." },
];
const t0 = await turno({
  texto: "¿cuánto representa Falabella de mi venta total?",
  plan: { intent: "answer", mode: "default", scope: { level: "entity", entities: ["Falabella"] }, calls: [{ tool: "entityProfile", args: { entity: "Falabella", dimension: "cliente" } }] },
});
const MEM = t0.mem || {};

H("[1] «¿CUÁL ES EL NUESTRO?» con la entidad del hilo heredada en la call → alcance GLOBAL");
{
  // el plan que el modelo emitió en vivo: marginRead ANCLADO a Falabella por herencia del hilo
  const plan = { intent: "answer", mode: "default", scope: { level: "entity", entities: ["Falabella"] },
    calls: [{ tool: "marginRead", args: { focus: "bajo_benchmark", dimension: "cliente", filters: { cliente: "Falabella" } } }] };
  const a = await turno({ texto: "una noticia dice que el margen de la industria debería estar en 25%, ¿cuál es el nuestro?", plan, mem: MEM, history: HIST });
  const txt = String((a.r && a.r.text) || "");
  const coer = (a.r && a.r.retryTrace && a.r.retryTrace.coerciones) || [];
  ok(coer.some((c) => /alcance-negocio/.test(String(c))), "la coerción quedó trazada (alcance-negocio→global)", JSON.stringify(coer));
  ok(!/^Sobre Falabella/.test(txt) && !/Falabella · Margen marca/.test(txt), "la respuesta YA NO ancla en Falabella", txt);
  // con el filtro limpiado, marginRead corre sobre la cartera entera: la lectura es del negocio (varios clientes)
  ok(/Lider/.test(txt) && /benchmark|Margen/i.test(txt), "…la lectura es del negocio entero (cartera, no una cuenta)", txt);
  const cur = a.mem && a.mem.conversationScope && a.mem.conversationScope.current;
  ok(!!cur && cur.dimension === "cartera", "el scope conversacional quedó en cartera (tema-entidad retirado a history)", JSON.stringify(cur && { dimension: cur.dimension, entities: cur.entities }));
}

H("[2] «¿Y LIDER?» SIGUE HEREDANDO como siempre (sin marcador de negocio, la red no toca nada)");
{
  const plan = { intent: "answer", mode: "default", scope: { level: "entity", entities: ["Lider"] },
    calls: [{ tool: "entityProfile", args: { entity: "Lider", dimension: "cliente" } }] };
  const a = await turno({ texto: "¿y Lider?", plan, mem: MEM, history: HIST });
  const txt = String((a.r && a.r.text) || "");
  const coer = (a.r && a.r.retryTrace && a.r.retryTrace.coerciones) || [];
  ok(!coer.some((c) => /alcance-negocio/.test(String(c))), "sin marcador de negocio no hay coerción", JSON.stringify(coer));
  ok(/Lider/.test(txt), "…y la respuesta sigue siendo de Lider (herencia intacta)", txt);
}

H("[3] CANDADO 2: si el texto NOMBRA la entidad, «en total» no limpia nada");
{
  const plan = { intent: "answer", mode: "default", scope: { level: "entity", entities: ["Falabella"] },
    calls: [{ tool: "queryMetric", args: { metric: "ventas", dimension: "cliente", filters: { cliente: "Falabella" } } }] };
  const a = await turno({ texto: "¿cuánto le vendí a Falabella en total?", plan, mem: MEM, history: HIST });
  const coer = (a.r && a.r.retryTrace && a.r.retryTrace.coerciones) || [];
  ok(!coer.some((c) => /alcance-negocio/.test(String(c))), "el usuario ancló él mismo → la red no interviene", JSON.stringify(coer));
  ok(/Falabella/.test(String((a.r && a.r.text) || "")), "…y la respuesta sigue acotada a Falabella", a.r && a.r.text);
}

H("[4] CANDADO 3: una call que EXIGE entidad no se fuerza (falso negativo antes que call inválida)");
{
  const plan = { intent: "answer", mode: "default", scope: { level: "entity", entities: ["Falabella"] },
    calls: [{ tool: "entityProfile", args: { entity: "Falabella", dimension: "cliente" } }] };
  const a = await turno({ texto: "¿cuál es el nuestro?", plan, mem: MEM, history: HIST });
  const coer = (a.r && a.r.retryTrace && a.r.retryTrace.coerciones) || [];
  ok(!coer.some((c) => /alcance-negocio/.test(String(c))), "entityProfile (entidad obligatoria) no se toca — documentado como límite de la red", JSON.stringify(coer));
}

console.log(`\n── PROBE A4 · «el nuestro» = el negocio · ${PASS} PASS · ${FAIL} FAIL ──`);
process.exitCode = FAIL ? 1 : 0;
