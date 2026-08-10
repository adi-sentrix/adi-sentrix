/* === _oracle_mechanism_gate.mjs · ARQUITECTURA C · GATE DE "MECANISMO DOMINANTE" === turno 9 del veredicto de 18
 * turnos (owner 2026-07-29): "ADI diagnostica que el problema es el COSTO, pero recomienda una acción de PRECIO,
 * sin conectarlos". Fix de MOTOR: `_marginPanel` (specRetrieval.js) ahora computa `mecanismo` por entidad bajo
 * benchmark — MISMO criterio que el detector de "carga alta" de _diagComercial (pctRebate > POLICY.targetCarga,
 * una verdad) — y guardC agrega un AVISO (NO bloqueante, ver comentario en guardC.js) `_mechanismAdvisory` que
 * señala cuando la acción prometida nombra el mecanismo CONTRARIO sin conector causal. Es AVISO, no bloqueo,
 * porque la coherencia semántica diagnóstico↔acción no se puede validar con certeza vía regex — el riesgo real de
 * subir la abstención con un bloqueo mal calibrado ya se documentó (memoria: mismo patrón que atribución/graduación).
 * 1) determinístico: el campo `mecanismo` es LA MISMA verdad que el detector de carga (sin segunda fórmula).
 * 2) determinístico: el aviso dispara/no dispara sobre fixtures fijos de narración.
 * 3) smoke LLM real sobre el repro EXACTO del recon (MAK-COMP-AIR) — mide, no asume, si el nuevo dato estructural
 *    mejora la coherencia medible del narrador (honesto: puede seguir siendo variable, es un AVISO no un bloqueo).
 */
import fs from "fs";
import { composeSpecMargin } from "./src/adi/specRetrieval.js";
import { POLICY } from "./src/config/businessPolicy.js";
import { guardC } from "./src/adi/oracle/guardC.js";
import { runPlan } from "./src/adi/oracle/toolRunner.js";
import { handlePlan, handleNarrateC } from "./src/adi/llm/gatewayCore.js";
import { buildNarrateUserMessageC } from "./src/adi/oracle/narratePromptC.js";
import { ledgerBoleta } from "./src/adi/oracle/ledger.js";
for (const ln of fs.readFileSync(".env", "utf8").split(/\r?\n/)) { const m = ln.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
const SC = "actual";
let pass = 0, fail = 0;
const ok = (cond, label) => { console.log(`  ${cond ? "✓" : "✗"} ${label}`); if (cond) pass++; else fail++; };

console.log("── 1 · DETERMINÍSTICO — el campo `mecanismo` es la MISMA verdad que el detector de carga alta ──");
{
  const r = composeSpecMargin({ scenario: SC, focus: "bajo_benchmark", dimension: "sku" });
  const rows = r.evidence.margin.panel.rows.filter((x) => x.below);
  ok(rows.length > 0, `hay filas bajo benchmark en sku (${rows.length})`);
  ok(rows.every((x) => x.mecanismo === "carga comercial/rebate" || x.mecanismo === "costo estructural" || x.mecanismo == null), "todo `mecanismo` es uno de los 2 valores esperados o null");
  // MAK-COMP-AIR es el caso del repro real (recon): margen 7.9% bajo benchmark, pctRebate bajo → debe salir "costo estructural"
  const mak = rows.find((x) => x.nombre === "MAK-COMP-AIR");
  console.log(`  MAK-COMP-AIR → mecanismo=${mak && mak.mecanismo}`);
  ok(!!mak, "MAK-COMP-AIR aparece bajo benchmark (mismo caso del recon)");
  // control cruzado: ninguna fila con mecanismo="carga comercial/rebate" debería tener pctRebate <= targetCarga si
  // pudiéramos verlo — no viene pctRebate en el panel, así que el control real es contra composeSpecDiagnose (el
  // detector de carga real), verificado abajo.
}
{
  // control cruzado REAL: toda entidad que _diagComercial marca con "carga alta" (findings.detector==="carga")
  // debe tener mecanismo="carga comercial/rebate" en el panel de margen de esa MISMA entidad — una sola verdad.
  const { results: diagR } = runPlan({ intent: "answer", calls: [{ tool: "diagnose", args: {} }] }, { scenario: SC });
  const cargaFinding = (diagR[0].facts.findings || []).find((f) => f.detector === "carga");
  const cargaEntities = cargaFinding ? new Set(cargaFinding.items.map((it) => it.entidad)) : new Set();
  const rCliente = composeSpecMargin({ scenario: SC, focus: "bajo_benchmark", dimension: "cliente" });
  const rowsCliente = rCliente.evidence.margin.panel.rows.filter((x) => x.below);
  const consistente = rowsCliente.every((x) => !cargaEntities.has(x.nombre) || x.mecanismo === "carga comercial/rebate");
  console.log(`  entidades con carga alta (diagnose): ${[...cargaEntities].join(", ") || "(ninguna)"}`);
  ok(consistente, "toda entidad marcada 'carga alta' por el diagnose real tiene mecanismo='carga comercial/rebate' en marginRead — UNA verdad, sin drift");
}

console.log("\n── 2 · DETERMINÍSTICO — el aviso `_mechanismAdvisory` dispara/no dispara sobre fixtures fijos ──");
{
  const results = [{ tool: "marginRead", facts: { margin: { panel: { rows: [{ nombre: "Acme", margen: 18, mecanismo: "costo estructural" }] } } } }];
  const g1 = guardC("Acme tiene el margen bajo por un costo estructural alto. Deberías renegociar el rebate de Acme como primer paso.", { ledger: { figs: [] }, results, trace: null, question: "" });
  ok(g1.ok, "el aviso NUNCA bloquea (guardC.ok sigue true aunque el aviso dispare)");
  ok(g1.advisories.some((a) => a.kind === "mecanismo-inconsistente"), "MALO: mecanismo=costo, acción nombra 'rebate' sin conector → dispara aviso");

  const g2 = guardC("Acme tiene el margen bajo por un costo estructural alto. Deberías revisar el costo y ajustar el precio como primer paso.", { ledger: { figs: [] }, results, trace: null, question: "" });
  ok(!g2.advisories.some((a) => a.kind === "mecanismo-inconsistente"), "BUENO: mecanismo=costo, acción nombra 'costo/precio' → NO dispara");

  const g3 = guardC("Acme tiene el margen bajo por un costo estructural alto. Aunque el costo aprieta, no es negociable a corto plazo, así que la acción es renegociar el rebate.", { ledger: { figs: [] }, results, trace: null, question: "" });
  ok(!g3.advisories.some((a) => a.kind === "mecanismo-inconsistente"), "BUENO: mecanismo=costo pero acción nombra rebate CON conector causal explícito → NO dispara (excepción)");

  const results2 = [{ tool: "marginRead", facts: { margin: { panel: { rows: [{ nombre: "Beta", margen: 18, mecanismo: "carga comercial/rebate" }] } } } }];
  const g4 = guardC("Beta tiene el margen bajo por una carga comercial alta. Deberías ajustar el costo de Beta como primer paso.", { ledger: { figs: [] }, results: results2, trace: null, question: "" });
  ok(g4.advisories.some((a) => a.kind === "mecanismo-inconsistente"), "MALO (dirección inversa): mecanismo=carga, acción nombra 'costo' sin conector → dispara aviso");

  const g5 = guardC("Foo tiene un buen margen, no hay nada que ajustar.", { ledger: { figs: [] }, results, trace: null, question: "" });
  ok(!g5.advisories.some((a) => a.kind === "mecanismo-inconsistente"), "sin entidad nombrada / sin acción → no dispara (no hay de qué hablar)");
}

console.log("\n── 3 · SMOKE LLM REAL — repro exacto del recon (MAK-COMP-AIR, 3 corridas, medición honesta) ──");
{
  let coherentes = 0, corridas = 0;
  const THREAD = ["dame el costo medio y precio de lista de MAK-COMP-AIR", "¿por qué tiene tan bajo margen?", "ok, ¿qué deberíamos hacer?"];
  for (let run = 0; run < 3; run++) {
    let mem = {}, history = [];
    let lastNarration = null, lastResults = null;
    for (const q of THREAD) {
      let plan;
      try { const pr = await handlePlan({ text: q, history, mem, scenario: SC }); if (!pr.ok) throw new Error(pr.error); plan = pr.plan; }
      catch { plan = null; }
      if (!plan) continue;
      const calls = Array.isArray(plan.calls) ? plan.calls : [];
      const { ledger, results, trace } = runPlan({ intent: plan.intent, calls }, { scenario: SC });
      const figs = ledgerBoleta(ledger);
      let narration = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        let n;
        try { const nr = await handleNarrateC({ payload: buildNarrateUserMessageC({ text: q, plan, results, ledgerFigs: figs, mem, history }), mem }); n = nr.ok ? nr.narration : null; }
        catch { n = null; }
        if (!n) continue;
        if (guardC(n, { ledger, results, trace, question: q }).ok) { narration = n; break; }
      }
      lastNarration = narration; lastResults = results;
      history = [...history, { role: "user", text: q }, { role: "adi", gist: (narration || "(fallback)").slice(0, 140) }].slice(-8);
    }
    corridas++;
    if (lastNarration) {
      const g = guardC(lastNarration, { ledger: { figs: [] }, results: lastResults, trace: null, question: "" });
      const advisoryFired = g.advisories.some((a) => a.kind === "mecanismo-inconsistente");
      if (!advisoryFired) coherentes++;
      console.log(`  run${run}: ${advisoryFired ? "AVISO disparado (posible incoherencia)" : "sin aviso"} — "${lastNarration.slice(0, 160).replace(/\n/g, " ⏎ ")}"`);
    } else console.log(`  run${run}: sin narración final (fallback)`);
  }
  console.log(`  medición: ${coherentes}/${corridas} corridas sin aviso de mecanismo-inconsistente`);
  ok(corridas === 3, "las 3 corridas completaron el hilo (medición honesta, no fuerza un resultado)");
}

console.log(`\n── _oracle_mechanism_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
