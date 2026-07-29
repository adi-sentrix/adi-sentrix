/* === _entidad_puntual_gate.mjs · GATE DE ENTIDAD PUNTUAL (2 bugs pre-existentes cazados en un "reliability pass") ===
 * owner 2026-07-29, hallazgo durante un fix quirúrgico no relacionado:
 *
 *  BUG 1 · "el costo medio de Sodimac" / "la rotación de Falabella" — Sodimac y Falabella son CLIENTES
 *  (data/tenants/demo.js), pero el plan a veces los clasifica dimension:"marca" (adivina el eje por el fraseo,
 *  que no lo revela) → entityProfile/entityRecord declinaban "no encuentro a 'Sodimac' en el eje 'marca'" aunque
 *  el dato SÍ tiene a Sodimac, solo que en 'cliente'. FIX (toolRegistry.js): entityProfile/entityRecord reintentan
 *  con `guessDimension` (mismo mecanismo data-driven que ya usaba `trend`) antes de declinar — el motor se
 *  autocorrige del eje sin depender de que el LLM del plan adivine bien un dato que no puede conocer de antemano.
 *
 *  BUG 2 · "unidades vendidas por Falabella" — el plan la clasifica como una tool de RANKING (queryMetric/salesRead)
 *  con `filters` apuntando al MISMO eje que ya está rankeando (dimension:"cliente", filters:{cliente:"Falabella"}):
 *  eso es semánticamente "la fila de UNA entidad", no un ranking. composeSpecRetrieval no filtra por cliente (motivo
 *  documentado en el propio código: ranking≠fila puntual) y el crossGuard lo rechazaba honesto pero FALSO — el dato
 *  (unidades:1040 de Falabella en clientesVentas) SÍ existe, solo que por otra tool. FIX (toolRegistry.js):
 *  queryMetric detecta el auto-filtro (filters[dimension] seteado) y redirige a entityRecord ANTES del crossGuard —
 *  misma fila completa que entityRecord/entityProfile ya traen, incluida 'unidades'.
 *
 *  Además: planPrompt.js (TOOL_CATALOG) se afiló para reducir la frecuencia de la mala clasificación en origen
 *  (queryMetric/salesRead declaran que NO sirven para una entidad puntual; entityProfile/entityRecord aclaran que
 *  el eje es un HECHO del dato, no del fraseo, con default "cliente" ante la duda) — defensa en profundidad, pero
 *  la garantía real es el fix de motor (secciones 1-4 corren SIN LLM, deterministas byte-a-byte).
 *
 * 5 capas: (1) auto-corrección de eje en entityProfile/entityRecord, ambas direcciones cliente↔marca↔familia↔sku,
 * sin LLM · (2) regresión: entidad inexistente sigue declinando honesto, sin crash · (3) regresión: dimension
 * correcta declarada sigue funcionando igual (no cambia comportamiento sano) · (4) redirect de queryMetric
 * (auto-filtro → entityRecord) + regresión de sus usos legítimos (filtro de OTRO eje, ranking normal) · (5) smoke
 * con el pipeline real (LLM, 3 corridas) sobre las 3 preguntas originales del hallazgo.
 */
import fs from "fs";
import { TOOLS } from "./src/adi/oracle/toolRegistry.js";
import { buildEntityRecord, guessDimension } from "./src/adi/oracle/entityRecord.js";
import { runPlan } from "./src/adi/oracle/toolRunner.js";
import { handlePlan, handleNarrateC } from "./src/adi/llm/gatewayCore.js";
import { buildNarrateUserMessageC } from "./src/adi/oracle/narratePromptC.js";
import { ledgerBoleta } from "./src/adi/oracle/ledger.js";
import { guardC } from "./src/adi/oracle/guardC.js";

for (const ln of fs.readFileSync(".env", "utf8").split(/\r?\n/)) { const m = ln.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
const SC = "actual";
let pass = 0, fail = 0;
const ok = (cond, label) => { console.log(`  ${cond ? "✓" : "✗"} ${label}`); if (cond) pass++; else fail++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

console.log("── 1 · entityProfile: auto-corrección de eje (BUG 1), sin LLM ──");
{
  // Sodimac/Falabella son CLIENTES — pedidos con dimension:"marca" (la clasificación errada real observada).
  for (const entity of ["Sodimac", "Falabella"]) {
    const bad = TOOLS.entityProfile({ dimension: "marca", entity, scenario: SC });
    ok(bad.coverage.supported === true, `entityProfile(dimension:"marca", entity:"${entity}") se AUTOCORRIGE a cliente y responde (antes: "no encuentro a '${entity}' en el eje 'marca'")`);
    const good = TOOLS.entityProfile({ dimension: "cliente", entity, scenario: SC });
    ok(bad.boleta.length === good.boleta.length && bad.facts.entityType === "cliente", `entityProfile("marca"→autocorregido) es equivalente a pedirlo directo con dimension:"cliente" (mismo figCount=${bad.boleta.length}, entityType corregido)`);
  }
  // dirección inversa: una MARCA pedida con dimension:"cliente"/"familia" también se autocorrige.
  const marcaComoCliente = TOOLS.entityProfile({ dimension: "cliente", entity: "Samsung", scenario: SC });
  ok(marcaComoCliente.coverage.supported === true && marcaComoCliente.facts.entityType === "marca", `entityProfile(dimension:"cliente", entity:"Samsung") se autocorrige a marca (entityType=${marcaComoCliente.facts && marcaComoCliente.facts.entityType})`);
  const familiaComoMarca = TOOLS.entityProfile({ dimension: "marca", entity: "Materiales de Construcción", scenario: SC });
  ok(familiaComoMarca.coverage.supported === true && familiaComoMarca.facts.entityType === "familia", `entityProfile(dimension:"marca", entity:"Materiales de Construcción") se autocorrige a familia (entityType=${familiaComoMarca.facts && familiaComoMarca.facts.entityType})`);
  // un SKU pedido con dimension:"cliente" también se autocorrige.
  const skuComoCliente = TOOLS.entityProfile({ dimension: "cliente", entity: "SAM-REF500L", scenario: SC });
  ok(skuComoCliente.coverage.supported === true && skuComoCliente.facts.entityType === "sku", `entityProfile(dimension:"cliente", entity:"SAM-REF500L") se autocorrige a sku (entityType=${skuComoCliente.facts && skuComoCliente.facts.entityType})`);
}

console.log("\n── 2 · entityRecord: auto-corrección de eje (BUG 1 también reproducido acá), sin LLM ──");
{
  for (const entity of ["Sodimac", "Falabella"]) {
    const bad = TOOLS.entityRecord({ dimension: "marca", entity });
    ok(bad.coverage.supported === true, `entityRecord(dimension:"marca", entity:"${entity}") se AUTOCORRIGE a cliente y responde`);
    const direct = buildEntityRecord("cliente", entity);
    ok(bad.facts.Ventas === direct.facts.Ventas && bad.boleta.length === direct.boleta.length, `entityRecord("marca"→autocorregido) es BYTE-IGUAL a buildEntityRecord("cliente", "${entity}") directo (Ventas=${bad.facts.Ventas}, figCount=${bad.boleta.length})`);
    ok(typeof bad.facts["Unidades vendidas"] === "string", `entityRecord("marca"→autocorregido) trae 'Unidades vendidas' de ${entity} (${bad.facts["Unidades vendidas"]}) — el campo del BUG 2`);
  }
}

console.log("\n── 3 · regresión: entidad inexistente sigue declinando honesto (sin crash) ──");
{
  const gProfile = TOOLS.entityProfile({ dimension: "marca", entity: "EntidadQueNoExiste9999", scenario: SC });
  ok(gProfile.coverage.supported === false && /no encuentro/.test(gProfile.coverage.reason), `entityProfile con nombre inexistente declina honesto (reason: "${gProfile.coverage.reason}")`);
  const gRecord = TOOLS.entityRecord({ dimension: "marca", entity: "EntidadQueNoExiste9999" });
  ok(gRecord.coverage.supported === false && /no encuentro/.test(gRecord.coverage.reason), `entityRecord con nombre inexistente declina honesto (reason: "${gRecord.coverage.reason}")`);
  ok(guessDimension("EntidadQueNoExiste9999") === null, "guessDimension de un nombre inexistente devuelve null (no fuerza una corrección falsa)");
}

console.log("\n── 4 · regresión: dimension CORRECTA declarada sigue funcionando igual (no cambia el camino sano) ──");
{
  const r = TOOLS.entityProfile({ dimension: "cliente", entity: "Falabella", scenario: SC });
  ok(r.coverage.supported === true && r.facts.entityType === "cliente", "entityProfile(dimension:\"cliente\", entity:\"Falabella\") — ya correcto, sin cambios");
  const r2 = TOOLS.entityRecord({ dimension: "sku", entity: "SAM-REF500L" });
  ok(r2.coverage.supported === true && r2.facts.entityType === "sku", "entityRecord(dimension:\"sku\", entity:\"SAM-REF500L\") — ya correcto, sin cambios");
}

console.log("\n── 5 · queryMetric: redirect de auto-filtro → entityRecord (BUG 2), sin LLM ──");
{
  const redirected = TOOLS.queryMetric({ metric: "unidades", dimension: "cliente", filters: { cliente: "Falabella" }, scenario: SC });
  ok(redirected.coverage.supported === true, `queryMetric(dimension:"cliente", filters:{cliente:"Falabella"}) YA NO declina "no tengo ese cruce" — se redirige a la fila completa`);
  const direct = TOOLS.entityRecord({ dimension: "cliente", entity: "Falabella" });
  ok(redirected.facts && direct.facts && redirected.facts["Unidades vendidas"] === direct.facts["Unidades vendidas"], `el redirect es BYTE-IGUAL a entityRecord directo (Unidades vendidas=${redirected.facts && redirected.facts["Unidades vendidas"]})`);
  // combinado: auto-filtro CON eje errado (Sodimac no es marca) — debe encadenar los dos fixes y de todos modos responder.
  const combinado = TOOLS.queryMetric({ metric: "ventas", dimension: "marca", filters: { marca: "Sodimac" }, scenario: SC });
  ok(combinado.coverage.supported === true && combinado.facts.entityType === "cliente", `queryMetric(dimension:"marca", filters:{marca:"Sodimac"}) encadena redirect+autocorrección de eje y responde (entityType=${combinado.facts && combinado.facts.entityType})`);

  // REGRESIÓN — usos LEGÍTIMOS de queryMetric no deben tocarse:
  const rankingNormal = TOOLS.queryMetric({ metric: "ventas", dimension: "cliente", scenario: SC });
  ok(rankingNormal.coverage.supported === true && Array.isArray(rankingNormal.facts.rows) && rankingNormal.facts.rows.length > 1, `ranking normal (dimension:"cliente", SIN filters) sigue trayendo VARIAS filas (${rankingNormal.facts.rows && rankingNormal.facts.rows.length}), no se redirige a una entidad`);
  const filtroDeOtroEje = TOOLS.queryMetric({ metric: "ventas", dimension: "sku", filters: { marca: "Samsung" }, scenario: SC });
  ok(filtroDeOtroEje.coverage.supported === true && Array.isArray(filtroDeOtroEje.facts.rows) && filtroDeOtroEje.facts.rows.length > 1, `ranking filtrado por OTRO eje (dimension:"sku", filters:{marca:"Samsung"}) sigue funcionando como ranking (${filtroDeOtroEje.facts.rows && filtroDeOtroEje.facts.rows.length} filas), no se redirige`);
  const crossImposibleIntacto = TOOLS.queryMetric({ metric: "ventas", dimension: "sku", filters: { cliente: "Falabella" }, scenario: SC });
  ok(crossImposibleIntacto.coverage.supported === false && crossImposibleIntacto.coverage.cross === true, `cruce genuinamente imposible (dimension:"sku", filters:{cliente:"X"} — NO es auto-filtro) sigue declinando honesto igual que antes`);
}

console.log("\n── 6 · SMOKE LLM REAL (3 corridas, pipeline completo) — las 3 preguntas originales del hallazgo ──");
{
  const CASES = ["el costo medio de Sodimac", "la rotación de Falabella", "unidades vendidas por Falabella"];
  for (const q of CASES) {
    let coveredOk = 0, guardOk = 0;
    for (let run = 0; run < 3; run++) {
      if (run > 0) await sleep(8000);
      let plan;
      try { const pr = await handlePlan({ text: q, history: [], mem: {}, scenario: SC }); if (!pr.ok) throw new Error(pr.error || "plan no-ok"); plan = pr.plan; }
      catch (e) { console.log(`  «${q}» run${run}: PLAN-FAIL ${e.message}`); continue; }
      const calls = Array.isArray(plan.calls) ? plan.calls : [];
      const { ledger, results, trace } = runPlan({ intent: plan.intent, calls }, { scenario: SC });
      const anySupported = results.some((r) => r.coverage && r.coverage.supported);
      console.log(`  «${q}» run${run}: calls=${JSON.stringify(calls.map((c) => `${c.tool}(${JSON.stringify(c.args)})`))} → supported=${anySupported}`);
      if (anySupported) coveredOk++; else continue;
      const figs = ledgerBoleta(ledger);
      let narration = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        let n;
        try { const nr = await handleNarrateC({ payload: buildNarrateUserMessageC({ text: q, plan, results, ledgerFigs: figs, mem: {} }), mem: {} }); n = nr.ok ? nr.narration : null; }
        catch { n = null; }
        if (!n) continue;
        if (guardC(n, { ledger, results, trace, question: q }).ok) { narration = n; break; }
      }
      if (narration) { guardOk++; console.log(`     GUARD_OK: ${narration.slice(0, 180).replace(/\n/g, " ⏎ ")}`); }
      else console.log("     guard rechazó los 3 intentos de narración");
    }
    ok(coveredOk >= 2, `«${q}»: el plan trae datos soportados (coverage.supported) en ≥2/3 corridas (obtuvo ${coveredOk}/3)`);
    ok(guardOk >= 1, `«${q}»: al menos 1/3 corridas narra con guardOk=true citando evidencia real`);
  }
}

console.log(`\n── _entidad_puntual_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
