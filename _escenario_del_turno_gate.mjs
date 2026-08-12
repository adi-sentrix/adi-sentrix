/* === _escenario_del_turno_gate.mjs · EL ESCENARIO LO DECIDE EL RUN, NUNCA EL PLAN (owner 2026-08-11) =========
 * Sin red, sin LLM, sin llamadas pagadas. Se verifica contra la evidencia REAL de la certificación.
 *
 * ── EL DEFECTO (punto 5 de la revisión, síntoma medido en E1.t3) ─────────────────────────────────────────────
 * La MISMA boleta llevó «Lider · Venta» = $17.8M y «Lider · Ventas» = $17.9M. No era un problema de formateo ni
 * de dos fuentes de dato: `clientesVentas.actual` y `clientesMargen.venta` valen 17843 los dos.
 * LA CAUSA: `toolRunner` componía los argumentos como `{ scenario, ...callArgs }`, así que un `scenario` presente
 * en los args del plan —incluso `undefined`, que es lo que emite un modelo cuando declara el campo sin llenarlo—
 * PISABA el del turno. Y aguas abajo `composeSpecRetrieval` con `scenario: undefined` no falla: cae en `actual`
 * en silencio y devuelve 17857.
 * LO MÁS GRAVE: los dos figs DECLARAN `tipo.escenario: "bonanza"` y uno trae el número de otro escenario. La
 * declaración y el cómputo se contradicen, así que ningún chequeo que lea el sello podía detectarlo.
 *
 * `node --import ./scripts/offline-guard.mjs _escenario_del_turno_gate.mjs`
 */
import { readFileSync } from "node:fs";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { runPlan } from "./src/adi/oracle/toolRunner.js";
import { composeSpecRetrieval } from "./src/adi/specRetrieval.js";
import { applyScenarioToClientesVentas, applyScenarioToClientesMargen } from "./src/engine/scenarios.js";

initTenant(TENANT_DEMO);
let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };
const H = (t) => console.log("\n" + t);
const figDe = (r, re) => ((r && r.ledger && r.ledger.figs) || []).find((f) => re.test(String(f.label || "")));

H("[1] EL SÍNTOMA MEDIDO · la evidencia real de E1.t3 tenía dos valores");
{
  const F = JSON.parse(readFileSync("./fixtures/certificacion-f4f2949.json", "utf8"));
  const c = F.casos.find((x) => x.id === "E1.t3");
  const vs = c.boleta.filter((f) => /^Lider · Ventas?$/.test(String(f.label || "")));
  ok(vs.length >= 2, `la boleta real llevaba ${vs.length} figs de venta de Lider`);
  ok(new Set(vs.map((f) => f.value)).size > 1, `…con valores DISTINTOS: ${vs.map((f) => f.value).join(" vs ")}`);
  ok(vs.every((f) => (f.tipo || {}).escenario === "bonanza"),
    "…y las dos DECLARABAN el mismo escenario: el sello no podía delatar la contradicción");
}

H("[2] EL DATO DE ORIGEN ES UNO SOLO · el defecto no estaba en la fuente");
for (const scn of ["bonanza", "tension", "crisis"]) {
  const cv = applyScenarioToClientesVentas(scn).find((x) => x.nombre === "Lider");
  const cm = applyScenarioToClientesMargen(scn).find((x) => x.nombre === "Lider");
  ok(cv.actual === cm.venta, `${scn}: las dos fuentes coinciden (${cv.actual})`);
}

H("[3] LA CAUSA · sin escenario, el composer cae en otro universo EN SILENCIO");
{
  const conB = composeSpecRetrieval({ metric: "ventas", dimension: "cliente", filters: { cliente: "Lider" }, scenario: "bonanza" });
  const sinE = composeSpecRetrieval({ metric: "ventas", dimension: "cliente", filters: { cliente: "Lider" }, scenario: undefined });
  const v = (r) => (((r || {}).evidence || {}).boleta || []).find((f) => /Lider · Ventas$/.test(f.label));
  ok(!!v(conB) && !!v(sinE), "el composer responde en los dos casos");
  ok(v(conB).raw !== v(sinE).raw,
    `sin escenario devuelve OTRO número (${v(conB).raw} vs ${v(sinE).raw}) — por eso la fuga era invisible: no falla, miente`);
}

H("[4] EL FIX · el escenario del turno gana sobre lo que diga el plan");
{
  // exactamente la forma que producía la fuga: el plan declara `scenario` sin llenarlo.
  const r = runPlan({ intent: "answer", calls: [
    { tool: "queryMetric", args: { dimension: "cliente", entity: "Lider", metric: "ventas", scenario: undefined } },
    { tool: "marginRead", args: { dimension: "cliente", entity: "Lider" } },
  ] }, { scenario: "bonanza", maxCalls: 6 });
  const q = figDe(r, /^Lider · Ventas$/), m = figDe(r, /^Lider · Venta$/);
  ok(!!q && q.raw === applyScenarioToClientesVentas("bonanza").find((x) => x.nombre === "Lider").actual * 1000,
    `queryMetric usa el escenario del TURNO aunque el plan lo pise con undefined (raw=${q && q.raw})`);
  ok(!!m && String(m.value) === String(q.value),
    `los dos emisores muestran el MISMO texto formateado (${m && m.value} · ${q && q.value})`);
  // y un plan que intenta cambiar de escenario tampoco puede: el marco del turno no lo elige el modelo.
  const r2 = runPlan({ intent: "answer", calls: [{ tool: "queryMetric", args: { dimension: "cliente", entity: "Lider", metric: "ventas", scenario: "crisis" } }] }, { scenario: "bonanza", maxCalls: 6 });
  const q2 = figDe(r2, /^Lider · Ventas$/);
  ok(!!q2 && q2.raw === q.raw, `un plan que pide otro escenario NO cambia el del turno (raw=${q2 && q2.raw})`);
}

H("[5] NINGUNA BOLETA CON DOS VALORES PARA LA MISMA ETIQUETA · los tres escenarios");
for (const scn of ["bonanza", "tension", "crisis"]) {
  const r = runPlan({ intent: "answer", calls: [
    { tool: "queryMetric", args: { dimension: "cliente", entity: "Lider", metric: "ventas" } },
    { tool: "marginRead", args: { dimension: "cliente", entity: "Lider" } },
    { tool: "entityRecord", args: { dimension: "cliente", entity: "Lider" } },
  ] }, { scenario: scn, maxCalls: 8 });
  const porTexto = new Map();
  for (const f of ((r.ledger || {}).figs || [])) {
    if (!/^Lider · Ventas?$/.test(String(f.label || ""))) continue;
    porTexto.set(String(f.value), (porTexto.get(String(f.value)) || 0) + 1);
  }
  ok(porTexto.size <= 1, `${scn}: las tres tools muestran UN solo valor de venta para Lider`, [...porTexto.keys()].join(" vs "));
}

console.log(`\n── _escenario_del_turno_gate: ${PASS} PASS · ${FAIL} FAIL (de ${PASS + FAIL}) ──`);
process.exit(FAIL ? 1 : 0);
