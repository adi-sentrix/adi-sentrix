/* === _cierre_corrida_corta_gate.mjs · LOS TRES ROJOS DE LA CORRIDA DEL 12/08 (owner 2026-08-12) ===============
 * Cada bloque cierra un defecto MEDIDO contra el proveedor real, no uno imaginado:
 *   C1 · el plan eligió `tensionRead` para «¿qué clientes podrían comprar estos SKU?» porque `clientesPorSku` no
 *        estaba en el enum del schema del planificador: era literalmente IMPOSIBLE que la emitiera.
 *   B2 · el motor resolvió 4 cuentas y declaró `NoExisteSA` faltante EN LA BOLETA, y la respuesta no la mencionó.
 *   D4 · «Ahora solo la conclusión» devolvió la respuesta entera porque el recorte exigía `cuerpo.length > 1` y el
 *        narrador contestó en UN párrafo largo.
 *
 * @inyeccion-simulada · `callPlan`/`callNarrate` se inyectan a mano (planes y narraciones literales, escritos acá).
 * No importa el gateway ni nada de `src/ui/`, y no hay un solo `fetch`: no existe camino a la red. El candado de
 * runtime lo verifica igual — si esta clasificación estuviera mal, el proceso muere con exit 97 antes del socket.
 *
 * `node --import ./scripts/offline-guard.mjs _cierre_corrida_corta_gate.mjs`
 */
import { readFileSync } from "node:fs";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { TOOLS } from "./src/adi/oracle/toolRegistry.js";
import { runPlan } from "./src/adi/oracle/toolRunner.js";
import { ensureCoberturaDeclarada } from "./src/adi/oracle/narrationBlocks.js";
import { answerViaOracle } from "./src/adi/oracle/answerViaOracle.js";
import { armarRegistroDeTurno } from "./scripts/replay-local.mjs";

initTenant(TENANT_DEMO);
let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };
const h = (t) => console.log(`\n${t}`);

/* ═══ 1 · C1 · `clientesPorSku` ALCANZABLE DESDE EL PLAN ══════════════════════════════════════════════════════ */
h("1 · C1 · el planificador PUEDE emitir `clientesPorSku` — antes le estaba vedado por el schema");
{
  const SRC = readFileSync("./src/adi/oracle/planPrompt.js", "utf8");
  const m = SRC.match(/tool:\s*\{\s*type:\s*"string",\s*enum:\s*\[([^\]]+)\]/);
  ok(!!m, "el schema del plan declara un enum de tools");
  const enEnum = new Set((m ? m[1] : "").split(",").map((s) => s.trim().replace(/^"|"$/g, "")));
  ok(enEnum.has("clientesPorSku"),
    "`clientesPorSku` está en el enum · SIN esto el modelo no puede emitirla por más que exista la tool",
    [...enEnum].join(","));

  // el enum no alcanza: si no está DESCRITA, el modelo no sabe cuándo usarla — y en la corrida eligió `tensionRead`.
  ok(/clientesPorSku\{/.test(SRC), "…y está descrita en el catálogo que el planificador lee");
  const desc = (SRC.match(/clientesPorSku\{[^\n]*/) || [""])[0];
  ok(/tensionRead/.test(desc), "la descripción la desambigua de `tensionRead`, que fue lo que el modelo eligió en vivo");
  /* LA DESAMBIGUACIÓN CONTRA `entityComposicion` VOLVIÓ (owner 2026-08-12), y volvió porque pasó exactamente lo
   * que este comentario anticipaba: esa tool entró al enum, así que la confusión ya es posible y dejarla sin
   * distinguir sería apostar a que el modelo adivine. Son transpuestas —de unos SKU a las cuentas, contra de UN
   * cliente a sus familias—, que es el par más fácil de cruzar. Vive del lado de `entityComposicion` y no acá:
   * una sola frase, en un solo lugar, en vez de pagarla dos veces.
   * `tensionRead` se conserva por el motivo de siempre: no es una hipótesis, es lo que el modelo eligió de verdad
   * en la corrida del 12/08 cuando le faltaba esta entrada. */
  ok(/clientesPorSku/.test((SRC.match(/entityComposicion\{[^\n]*/) || [""])[0]),
    "…y `entityComposicion`, ahora alcanzable, se desambigua de `clientesPorSku` (son transpuestas)");
  ok(/multi-entidad|lista entera|UNA call/i.test(desc), "…y le dice que mande la lista de SKU en UNA sola call", desc.slice(0, 80));
  ok(/indicad/i.test(desc), "…y le dice al narrador que la relación sale sellada `indicado`", desc.slice(0, 80));

  // LA CARA GENERAL: este defecto es de CLASE, no de esta tool. Se fija el conjunto de inalcanzables conocidas
  // para que una tool nueva que nazca inalcanzable ponga el gate en rojo en vez de descubrirse en una corrida paga.
  // DEUDA CERRADA (owner 2026-08-12): `entityComposicion` y `entityCapitalLigado` ya están en el enum y en el
  // catálogo. La lista queda VACÍA a propósito — el estado sano es que ninguna capacidad registrada sea muda, y
  // así cualquier tool nueva que nazca inalcanzable pone esto en rojo el mismo día. La vigilancia completa de la
  // clase (registrada · nombrable · descrita, y la simétrica) vive ahora en `_tools_alcanzables_gate.mjs`.
  const DEUDA_CONOCIDA = [];
  const inalcanzables = Object.keys(TOOLS).filter((t) => !enEnum.has(t));
  ok(inalcanzables.length === DEUDA_CONOCIDA.length && DEUDA_CONOCIDA.every((t) => inalcanzables.includes(t)),
    `las tools inalcanzables son EXACTAMENTE la deuda ya conocida (${DEUDA_CONOCIDA.join(", ")}) — ninguna nueva se cuela`,
    `inalcanzables: ${inalcanzables.join(", ") || "(ninguna)"}`);

  // y la conducta, no sólo el cableado: un plan que la nombra resuelve y sella `indicado`.
  const r = runPlan({ intent: "answer", calls: [{ tool: "clientesPorSku", args: { entities: ["SAM-TV55", "LG-WASH11KG"], topN: 3 } }] }, { scenario: "actual", maxCalls: 4 });
  const figs = r.ledger.figs || [];
  ok(figs.length > 0 && figs.every((f) => f.tipo && f.tipo.sello === "indicado"),
    `un plan que la emite resuelve con ${figs.length} figs, todas selladas \`indicado\``);
}

/* ═══ 2 · B2 · LA COBERTURA PARCIAL SE DECLARA SOLA ═══════════════════════════════════════════════════════════ */
h("2 · B2 · si la boleta trae `faltantes`, el texto las nombra — no queda a criterio del narrador");
{
  const CINCO = ["Falabella", "Lider", "Ripley", "Paris", "NoExisteSA"];
  const r = runPlan({ intent: "answer", calls: [{ tool: "compareEntities", args: { dimension: "cliente", entities: CINCO } }] }, { scenario: "actual", maxCalls: 4 });
  const cb = (r.results[0].coverage || {}).cobertura;
  ok(!!cb && cb.resueltas.length === 4 && cb.faltantes.includes("NoExisteSA"),
    "el motor resuelve las cuatro reales y declara NoExisteSA faltante (esto ya funcionaba)", JSON.stringify(cb));

  // EL DEFECTO ERA EL TEXTO. Un narrador que habla sólo de las cuatro ya no puede dejar la quinta sin declarar.
  const comoEnLaCorrida = "Falabella lidera con $4.2M, seguida de Lider, Ripley y Paris.";
  const conCobertura = ensureCoberturaDeclarada(comoEnLaCorrida, r.results);
  ok(/NoExisteSA/.test(conCobertura), "la respuesta que la omitía ahora la nombra", conCobertura);
  ok(/no aparece|no est[aá]|no incluí/i.test(conCobertura), "…diciendo que NO está, no como si fuera una cuenta más", conCobertura);
  ok(!/\$/.test(conCobertura.slice(comoEnLaCorrida.length)),
    "…y la línea agregada NO emite ninguna cifra (sería una cifra sin autorizar en la boleta)",
    conCobertura.slice(comoEnLaCorrida.length));

  // LAS DOS CARAS QUE IMPIDEN QUE MOLESTE: si el narrador ya lo dijo, no se repite; sin faltantes, no agrega nada.
  const yaLoDijo = "Comparé Falabella, Lider, Ripley y Paris. NoExisteSA no figura en el eje cliente.";
  ok(ensureCoberturaDeclarada(yaLoDijo, r.results) === yaLoDijo, "si el narrador YA la nombró, no se agrega nada");
  const rOk = runPlan({ intent: "answer", calls: [{ tool: "compareEntities", args: { dimension: "cliente", entities: CINCO.slice(0, 4) } }] }, { scenario: "actual", maxCalls: 4 });
  const limpio = "Las cuatro cuentas quedan comparadas.";
  ok(ensureCoberturaDeclarada(limpio, rOk.results) === limpio, "sin faltantes reales, el texto queda intacto");
}

/* ═══ 3 · D4 · `solo_conclusion` CON UN SOLO PÁRRAFO LARGO ════════════════════════════════════════════════════ */
h("3 · D4 · un párrafo largo ya no derrota el recorte — la garantía no depende de que el narrador separe párrafos");
{
  const PLAN = {
    intent: "answer", mode: "analisis",
    pref: { contentScope: "full", outputForm: "solo_conclusion" },
    calls: [{ tool: "entityRecord", args: { dimension: "cliente", entity: "Falabella" } }],
  };
  // EL NARRADOR DE LA CORRIDA: un solo párrafo largo, sin ningún corte de párrafo que el recorte pudiera usar.
  const UN_PARRAFO = "[[DATOS]]\nFalabella es la cuenta de mayor contribución del período y su margen queda por debajo de la vara declarada, lo que abre una brecha relevante. La cuenta sostiene buena parte del volumen y a la vez concentra el descuento más alto de la cartera. Revisando la mezcla de productos se ve que los de menor margen pesan más de lo que pesaban antes, y eso arrastra el promedio hacia abajo de manera sostenida a lo largo de los meses medidos.";
  const out = await answerViaOracle({
    text: "Ahora solo la conclusión, nada más.",
    history: [], mem: {}, scenario: "actual",
    callPlan: async () => PLAN,
    callNarrate: async () => UN_PARRAFO,
  });
  const texto = (out && out.r && out.r.text) || "";
  ok(texto.length > 0, "el turno produce respuesta");
  const _ES_PIE = /^\(?\s*(?:alcance|datos del|foto de inventario|supuesto)\b/i;
  const cuerpo = texto.split(/\n{2,}/).map((s) => s.trim()).filter(Boolean).filter((s) => !_ES_PIE.test(s));
  const palabras = cuerpo.join(" ").split(/\s+/).filter(Boolean).length;
  ok(palabras <= 45, `la conclusión queda acotada (${palabras} palabras · el narrador entregó ~70 en un solo párrafo)`, cuerpo.join(" "));
  ok(cuerpo.length > 0, "…y no se recortó hasta dejarla vacía");
  ok(/[.!?]\s*$/.test(cuerpo.join(" ").trim()), "…y termina en oración completa, no cortada a mitad de frase", cuerpo.join(" "));
}

/* ═══ 4 · LA INSTRUMENTACIÓN QUE DEJÓ A3 SIN DIAGNOSTICAR ═════════════════════════════════════════════════════ */
h("4 · A3 · el replay guarda ahora el texto y los results — sin eso, un rojo no se puede diagnosticar");
{
  const reg = armarRegistroDeTurno({
    id: "A3", plan: { calls: [{ tool: "queryMetric", args: { metric: "ventas" } }] },
    results: [{ callId: "c0", tool: "queryMetric", facts: { x: 1 }, boleta: [{ label: "Ventas", value: "$99M" }], coverage: { supported: true } }],
    texto: "Las dos cifras no se comparan entre sí.", scenario: "actual",
  });
  ok(reg.texto === "Las dos cifras no se comparan entre sí.", "el TEXTO de la respuesta queda guardado", String(reg.texto));
  ok(reg.results.length === 1 && reg.results[0].boleta.length === 1, "y los `results` con su boleta");
  ok(reg.calls[0].args.metric === "ventas", "…junto a los `args`, que ya funcionaban");

  // la otra mitad: el motor tiene que EXPONER `results`, o el corredor guarda un array vacío como en la corrida.
  const out = await answerViaOracle({
    text: "¿Cómo viene Falabella?", history: [], mem: {}, scenario: "actual",
    callPlan: async () => ({ intent: "answer", mode: "analisis", pref: { contentScope: "full" }, calls: [{ tool: "entityRecord", args: { dimension: "cliente", entity: "Falabella" } }] }),
    callNarrate: async () => "[[DATOS]]\nFalabella aporta la mayor contribución del período.",
  });
  const res = (out && out.r && out.r.results) || [];
  ok(res.length > 0, `answerViaOracle expone \`results\` (${res.length}) — en la corrida del 12/08 llegaban vacíos`);
  ok(!!res[0] && Array.isArray(res[0].boleta), "…con la boleta de cada call, que es lo que hace diagnosticable un rojo");
}

console.log(`\n── _cierre_corrida_corta_gate: ${PASS} PASS · ${FAIL} FAIL (de ${PASS + FAIL}) ──`);
process.exit(FAIL ? 1 : 0);
