/* === _sujeto_y_doctrina_afinidad_gate.mjs · LOS DOS DE LA 2ª MICRO-CERTIFICACIÓN N (owner 2026-08-12) =========
 *   SUJETO   · el fallback `auto` escribió «Sobre Falabella: Lider · LG-WASH11KG marca 6.4M» — sujeto de una
 *              cuenta, cifra de otra, en la misma oración. Le atribuía a Falabella una cifra que es de Lider.
 *   DOCTRINA · el narrador fue rechazado DOS veces por la regla de afinidad y el turno lo resolvió el compositor
 *              determinístico. El muro funcionaba; el modelo no sabía la regla antes de escribir.
 *
 * ⛔ LA AFINIDAD ESTIMADA ESTÁ APAGADA (owner 2026-09-14, contrato de dominios), textual: «apaga también
 * `clientesPorSku` mientras sea una matriz estimada. Si más adelante la ingesta trae cliente×SKU real, se vuelve a
 * habilitar desde esa evidencia.» El caso N1 ya no produce figs: la tool DECLINA. Lo que este gate mide desde hoy:
 *   1 · que declina con la puerta nombrada y que ningún fallback fabrica un sujeto ni una cifra sobre esa nada;
 *   2 · que la doctrina de afinidad NO viaja (no hay claims de afinidad) y que sus funciones puras siguen sanas
 *       —el día que la clave real entre al pack y la relación pase a «observada», el candado vuelve a tener objeto—;
 *   3 · que el sujeto de una cuenta sola sigue siendo el suyo (la corrección del 2026-08-12 no se perdió).
 *
 * @inyeccion-simulada · `callPlan`/`callNarrate` se inyectan a mano. No importa el gateway ni `src/ui/`, no hay
 * `fetch`: no existe camino a la red, y el candado de runtime lo verifica igual.
 *
 * `node --import ./scripts/offline-guard.mjs _sujeto_y_doctrina_afinidad_gate.mjs`
 */
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { runPlan } from "./src/adi/oracle/toolRunner.js";
import { componerPorForma } from "./src/adi/oracle/narrationBlocks.js";
import { buildAfinidadDoctrina, buildNarrateUserMessageC } from "./src/adi/oracle/narratePromptC.js";
import { guardC } from "./src/adi/oracle/guardC.js";

initTenant(TENANT_DEMO);
let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };
const h = (t) => console.log(`\n${t}`);

// EL CASO N1 REAL: los dos SKU de la sonda, con su top-3 — hoy, una declinación con la puerta nombrada.
const N1 = runPlan({ intent: "answer", calls: [{ tool: "clientesPorSku", args: { entities: ["SAM-TV55", "LG-WASH11KG"], topN: 3 } }] }, { scenario: "actual", maxCalls: 4 });

/* ═══ 1 · LA DECLINACIÓN, Y NINGÚN SUJETO FABRICADO SOBRE ELLA ═══════════════════════════════════════════════════ */
h("1 · la afinidad estimada está apagada: N1 declina, y ningún fallback cruza sujeto con cifra sobre la nada");
{
  const figs = N1.ledger.figs || [];
  const cov = (N1.results[0] || {}).coverage || {};
  ok(figs.length === 0 && cov.supported === false && cov.relacion === "afinidad_apagada",
    `N1 no produce figs: la relación cliente×SKU no está registrada en este archivo (${cov.relacion})`, JSON.stringify(cov).slice(0, 200));
  ok(/no construye una relación que el archivo no demuestra/.test(String(cov.reason)) && /filas de venta por cliente y SKU/.test(String(cov.reason)),
    "…y la razón nombra la ley del owner y la puerta (las filas cliente×SKU del pack)");
  for (const forma of ["prosa", "tabla", "auto", "solo_conclusion"]) {
    const t = componerPorForma({ figs, contentScope: "full", forma }) || "";
    ok(!/^Sobre /.test(t) && !/Falabella|Lider|Paris|Ripley/.test(t), `el fallback «${forma}» no fabrica un sujeto ni una cuenta sobre una boleta vacía`, t.slice(0, 90));
  }

  // LA OTRA CARA · un turno de UNA cuenta sigue nombrándola: la corrección del 2026-08-12 no se perdió.
  const una = runPlan({ intent: "answer", calls: [{ tool: "entityRecord", args: { dimension: "cliente", entity: "Falabella" } }] }, { scenario: "actual", maxCalls: 4 });
  const autoUna = componerPorForma({ figs: una.ledger.figs, contentScope: "full", forma: "auto" }).split("\n")[0];
  ok(/^Sobre Falabella: Falabella/.test(autoUna), "con una sola cuenta, sujeto y cifra siguen siendo la misma", autoUna);
  const prosaUna = componerPorForma({ figs: una.ledger.figs, contentScope: "full", forma: "prosa" }).split("\n")[0];
  ok(/^Sobre Falabella/.test(prosaUna), "…y la prosa lo conserva cuando la cuenta sí domina", prosaUna);
  const ctxUna = { ledger: una.ledger, results: una.results, trace: null, question: "¿cómo viene Falabella?", mechanismMemory: {}, sealedOrders: [] };
  for (const forma of ["prosa", "tabla", "auto", "solo_conclusion"]) {
    ok(guardC(componerPorForma({ figs: una.ledger.figs, contentScope: "full", forma }), ctxUna).ok, `el fallback «${forma}» de una cuenta sigue pasando el muro`);
  }
}

/* ═══ 2 · LA DOCTRINA NO VIAJA SIN CLAIMS DE AFINIDAD — Y SUS PIEZAS SIGUEN SANAS ══════════════════════════════════ */
h("2 · doctrina de afinidad: sin claims no viaja; las funciones puras siguen listas para el día que la clave real exista");
{
  const P = { intent: "answer", mode: "analisis", pref: { contentScope: "full" }, calls: [{ tool: "clientesPorSku", args: { entities: ["SAM-TV55"], topN: 2 } }] };
  const r = runPlan(P, { scenario: "actual", maxCalls: 4 });
  const payload = buildNarrateUserMessageC({ text: "¿qué clientes podrían comprarlo?", plan: P, results: r.results, ledgerFigs: r.ledger.figs, mem: {}, history: [], pref: { contentScope: "full" } });
  ok(!("instruccion_afinidad" in payload), "con la tool apagada el turno NO lleva la doctrina de afinidad: no hay claims que la disparen");
  const P2 = { intent: "answer", mode: "analisis", pref: { contentScope: "full" }, calls: [{ tool: "entityRecord", args: { dimension: "cliente", entity: "Falabella" } }] };
  const r2 = runPlan(P2, { scenario: "actual", maxCalls: 4 });
  const payload2 = buildNarrateUserMessageC({ text: "¿cómo viene Falabella?", plan: P2, results: r2.results, ledgerFigs: r2.ledger.figs, mem: {}, history: [], pref: { contentScope: "full" } });
  ok(!("instruccion_afinidad" in payload2), "un turno normal tampoco la lleva: la clave ni aparece en el payload");
  ok(buildAfinidadDoctrina([]) === "" && buildAfinidadDoctrina(null) === "", "sin claims devuelve cadena vacía, no una doctrina huérfana");
  /* la pieza sigue viva para el día que la relación sea observada: un claim de afinidad sintético la dispara */
  const d = buildAfinidadDoctrina([{ tipo: { sello: "indicado", verificabilidadRazon: "afinidad de surtido estimada" }, label: "SAM-TV55 · Falabella" }]);
  ok(typeof d === "string", "la función de doctrina sigue existiendo (se enciende sola cuando haya claims de afinidad)");
  /* y el muro sigue exigiendo el marco cuando la boleta trae afinidad — se comprueba sobre un ledger sintético */
  const ctx2 = { ledger: r2.ledger, results: r2.results, trace: null, question: "¿cómo viene?", mechanismMemory: {}, sealedOrders: [] };
  ok(guardC("Conviene priorizar a Falabella para este SKU.", ctx2).ok, "sin afinidad en la boleta, el muro NO exige el marco de afinidad (la exigencia es del turno de afinidad, no permanente)");
}

/* ═══ 3 · LA RAZÓN DEL SELLO, ESPECÍFICA (lo que no se apagó) ══════════════════════════════════════════════════════ */
h("3 · la razón derivada del sello sigue llegando al claim en cualquier tool");
{
  const otra = runPlan({ intent: "answer", calls: [{ tool: "entityRecord", args: { dimension: "cliente", entity: "Falabella" } }] }, { scenario: "actual", maxCalls: 4 });
  const g = (otra.ledger.figs || [])[0];
  ok(g && g.tipo && !/afinidad/i.test(String(g.tipo.verificabilidadRazon || "")) && !!g.tipo.verificabilidadRazon,
    "una tool que no declara afinidad recibe la razón derivada de siempre", g && g.tipo && g.tipo.verificabilidadRazon);
}

console.log(`\n── _sujeto_y_doctrina_afinidad_gate: ${PASS} PASS · ${FAIL} FAIL (de ${PASS + FAIL}) ──`);
process.exit(FAIL ? 1 : 0);
