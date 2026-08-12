/* === _sujeto_y_doctrina_afinidad_gate.mjs · LOS DOS DE LA 2ª MICRO-CERTIFICACIÓN N (owner 2026-08-12) =========
 *   SUJETO   · el fallback `auto` escribió «Sobre Falabella: Lider · LG-WASH11KG marca 6.4M» — sujeto de una
 *              cuenta, cifra de otra, en la misma oración. Le atribuía a Falabella una cifra que es de Lider.
 *   DOCTRINA · el narrador fue rechazado DOS veces por la regla de afinidad y el turno lo resolvió el compositor
 *              determinístico. El muro funcionaba; el modelo no sabía la regla antes de escribir.
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

// EL CASO N1 REAL: los dos SKU de la sonda, con su top-3 — seis cuentas, dos figs cada una, empate perfecto.
const N1 = runPlan({ intent: "answer", calls: [{ tool: "clientesPorSku", args: { entities: ["SAM-TV55", "LG-WASH11KG"], topN: 3 } }] }, { scenario: "actual", maxCalls: 4 });

/* ═══ 1 · SUJETO Y CIFRA, DE LA MISMA ENTIDAD ═════════════════════════════════════════════════════════════════ */
h("1 · el fallback no cruza sujeto con cifra — el caso N1 real");
{
  const figs = N1.ledger.figs || [];
  const porEntidad = {};
  for (const f of figs) { const e = f.tipo && f.tipo.entidad; if (e) porEntidad[e] = (porEntidad[e] || 0) + 1; }
  ok(Object.keys(porEntidad).length >= 4 && new Set(Object.values(porEntidad)).size === 1,
    `el caso reproduce el empate que lo causó: ${Object.keys(porEntidad).length} cuentas con la misma cantidad de figs`,
    JSON.stringify(porEntidad));

  const auto = componerPorForma({ figs, contentScope: "full", forma: "auto" });
  const primera = auto.split("\n")[0];
  ok(!/^Sobre Falabella: Lider/.test(primera), "ya NO escribe «Sobre Falabella: Lider …»", primera);
  ok(/^Afinidad estimada por SKU:/.test(primera), "usa un encabezado NEUTRAL cuando ninguna cuenta domina", primera);

  // LA REGLA GENERAL, no el caso: si hay prefijo «Sobre X», X tiene que ser la entidad de la cifra que sigue.
  const m = primera.match(/^Sobre ([^:]+): (.+?) marca/);
  ok(!m || primera.includes(`Sobre ${m[1]}: ${m[1]}`),
    "si hay sujeto, la cifra que lo sigue es de ESA entidad", m ? `sujeto=${m[1]} · cifra=${m[2]}` : "(sin sujeto, correcto)");

  // LA OTRA CARA · un turno de UNA cuenta sigue nombrándola: la corrección no puede volver mudo al fallback.
  const una = runPlan({ intent: "answer", calls: [{ tool: "entityRecord", args: { dimension: "cliente", entity: "Falabella" } }] }, { scenario: "actual", maxCalls: 4 });
  const autoUna = componerPorForma({ figs: una.ledger.figs, contentScope: "full", forma: "auto" }).split("\n")[0];
  ok(/^Sobre Falabella: Falabella/.test(autoUna), "con una sola cuenta, sujeto y cifra siguen siendo la misma", autoUna);

  // y la prosa, que compartía el mismo `_sujeto`, tampoco puede afirmar un sujeto que no domina.
  const prosa = componerPorForma({ figs, contentScope: "full", forma: "prosa" }).split("\n")[0];
  ok(!/^Sobre /.test(prosa), "la prosa tampoco se atribuye un sujeto en un turno multi-entidad", prosa);
  const prosaUna = componerPorForma({ figs: una.ledger.figs, contentScope: "full", forma: "prosa" }).split("\n")[0];
  ok(/^Sobre Falabella/.test(prosaUna), "…y lo conserva cuando la cuenta sí domina", prosaUna);

  // el muro sigue aprobando las cuatro formas: la corrección no rompió lo que ya funcionaba.
  const ctx = { ledger: N1.ledger, results: N1.results, trace: null, question: "¿qué clientes?", mechanismMemory: {}, sealedOrders: [] };
  for (const forma of ["prosa", "tabla", "auto", "solo_conclusion"]) {
    ok(guardC(componerPorForma({ figs, contentScope: "full", forma }), ctx).ok, `el fallback «${forma}» sigue pasando el muro`);
  }
}

/* ═══ 2 · LA DOCTRINA VIAJA SÓLO CUANDO CORRESPONDE ═══════════════════════════════════════════════════════════ */
h("2 · doctrina de afinidad: condicional por turno, no crecimiento permanente");
{
  const P = { intent: "answer", mode: "analisis", pref: { contentScope: "full" }, calls: [{ tool: "clientesPorSku", args: { entities: ["SAM-TV55"], topN: 2 } }] };
  const r = runPlan(P, { scenario: "actual", maxCalls: 4 });
  const payload = buildNarrateUserMessageC({ text: "¿qué clientes podrían comprarlo?", plan: P, results: r.results, ledgerFigs: r.ledger.figs, mem: {}, history: [], pref: { contentScope: "full" }, scenario: "actual" });
  ok(!!payload.instruccion_afinidad, "el turno de afinidad LA LLEVA");
  const d = payload.instruccion_afinidad || "";
  ok(/candidat/i.test(d) && /posible/i.test(d), "…y le dice cómo SÍ nombrarlas: candidatas, salida posible", d.slice(0, 90));
  ok(/nunca como compras ya ocurridas|no.{0,20}compras ya ocurridas/i.test(d), "…que no son compras ocurridas");
  ok(/MISMA ORACI[ÓO]N/i.test(d), "…y que si recomienda, el marco va en la MISMA oración — que es como lo mide el muro");

  // LA MITAD QUE EVITA EL CRECIMIENTO PERMANENTE: un turno normal no paga ni un token de esto.
  const P2 = { intent: "answer", mode: "analisis", pref: { contentScope: "full" }, calls: [{ tool: "entityRecord", args: { dimension: "cliente", entity: "Falabella" } }] };
  const r2 = runPlan(P2, { scenario: "actual", maxCalls: 4 });
  const payload2 = buildNarrateUserMessageC({ text: "¿cómo viene Falabella?", plan: P2, results: r2.results, ledgerFigs: r2.ledger.figs, mem: {}, history: [], pref: { contentScope: "full" }, scenario: "actual" });
  ok(!("instruccion_afinidad" in payload2), "un turno normal NO la lleva: la clave ni aparece en el payload");
  ok(buildAfinidadDoctrina([]) === "" && buildAfinidadDoctrina(null) === "", "sin claims devuelve cadena vacía, no una doctrina huérfana");

  /* EL DISPARADOR ES EL MISMO QUE EL DEL MURO, y esto es lo que impide que prompt y candado se separen: si algún
   * día uno de los dos cambiara de criterio, el narrador recibiría una regla que después no se le exige, o —peor—
   * se le exigiría una que nunca se le dijo. Se comprueba sobre el MISMO turno. */
  const ctx = { ledger: r.ledger, results: r.results, trace: null, question: "¿quién?", mechanismMemory: {}, sealedOrders: [] };
  const SIN_MARCO = "Conviene priorizar a Falabella para este SKU.";
  ok(!!payload.instruccion_afinidad && !guardC(SIN_MARCO, ctx).ok,
    "el turno que RECIBE la doctrina es el mismo en el que el muro la EXIGE");
  const ctx2 = { ledger: r2.ledger, results: r2.results, trace: null, question: "¿cómo viene?", mechanismMemory: {}, sealedOrders: [] };
  ok(!("instruccion_afinidad" in payload2) && guardC(SIN_MARCO, ctx2).ok,
    "…y el que NO la recibe es el mismo en el que el muro NO la exige");
}

/* ═══ 3 · LA RAZÓN DEL SELLO, ESPECÍFICA ══════════════════════════════════════════════════════════════════════ */
h("3 · la razón del sello llega al claim: sin ella la doctrina no tendría de qué dispararse");
{
  const f = (N1.ledger.figs || [])[0];
  ok(f && f.tipo && /afinidad/i.test(String(f.tipo.verificabilidadRazon || "")),
    "la fig de afinidad declara SU razón, no la genérica del contrato", f && f.tipo && f.tipo.verificabilidadRazon);
  // y ninguna otra tool cambia: el campo es opcional y lo que no se declara se sigue derivando.
  const otra = runPlan({ intent: "answer", calls: [{ tool: "entityRecord", args: { dimension: "cliente", entity: "Falabella" } }] }, { scenario: "actual", maxCalls: 4 });
  const g = (otra.ledger.figs || [])[0];
  ok(g && g.tipo && !/afinidad/i.test(String(g.tipo.verificabilidadRazon || "")) && !!g.tipo.verificabilidadRazon,
    "una tool que no la declara sigue recibiendo la razón derivada de siempre", g && g.tipo && g.tipo.verificabilidadRazon);
}

console.log(`\n── _sujeto_y_doctrina_afinidad_gate: ${PASS} PASS · ${FAIL} FAIL (de ${PASS + FAIL}) ──`);
process.exit(FAIL ? 1 : 0);
