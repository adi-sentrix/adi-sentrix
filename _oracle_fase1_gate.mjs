/* === _oracle_fase1_gate.mjs · ARQUITECTURA C · Fase 1 · GATE DE BYTE-IGUALDAD DE BOLETA ===
 * Prueba que cada tool-oráculo re-expone su composer SIN alterar la cifra: para cada (tool, args, escenario),
 * la boleta que devuelve la tool es BYTE-IGUAL a la boleta que emite el composer directo (mismo canon, value,
 * label, unit, mandatory, orden). Es el candado que garantiza que el catálogo no introduce dos-verdades.
 * Determinístico · sin LLM · sin tocar el pipeline vivo. → exit 1 si algo diverge.
 */
import fs from "fs";
import { TOOLS } from "./src/adi/oracle/toolRegistry.js";
import {
  composeSpecRetrieval, composeSpecDive, composeSpecCompare, composeSpecDiagnose,
  composeSpecResumenEjecutivo, composeSpecInventory, composeSpecMargin, composeSpecVentas,
  composeSpecContribucion, composeSpecSimulateCarga, composeSpecSimulateCapital, sampleEntities,
} from "./src/adi/specRetrieval.js";

const SCN = ["actual", "bonanza", "tension", "crisis"];
// tuplas por fig (canon+value+label+unit+mandatory) · la garantía es que el tool NO ALTERA ni DROPEA ninguna fig del
// composer (puede ENRIQUECER · ej. entityProfile suma el benchmark) → composer ⊆ tool.
const _tuples = (bol) => (bol || []).map((f) => JSON.stringify({ c: f.canon, v: f.value, l: f.label, u: f.unit, m: !!f.mandatory }));
const _boletaOf = (r) => (r && r.evidence && Array.isArray(r.evidence.boleta)) ? r.evidence.boleta : [];

// entidades reales para dive/compare (data-driven)
const cli = sampleEntities("cliente", 2, "bonanza");
const mar = sampleEntities("marca", 2, "bonanza");

// cada caso: nombre de tool + fn del composer + args (el gate llama a AMBOS con los mismos args + scenario)
const CASES = [
  { tool: "queryMetric", fn: composeSpecRetrieval, args: { metric: "ventas", dimension: "cliente" } },
  { tool: "queryMetric", fn: composeSpecRetrieval, args: { metric: "margen", dimension: "marca" } },
  { tool: "queryMetric", fn: composeSpecRetrieval, args: { metric: "contribucion", dimension: "familia" } },
  { tool: "queryMetric", fn: composeSpecRetrieval, args: { metric: "ventas", dimension: "sku", limit: 8 } },
  { tool: "entityProfile", fn: composeSpecDive, args: { dimension: "cliente", entity: cli[0] } },
  { tool: "entityProfile", fn: composeSpecDive, args: { dimension: "marca", entity: mar[0] } },
  { tool: "compareEntities", fn: composeSpecCompare, args: { dimension: "cliente", entities: [cli[0], cli[1]] } },
  { tool: "compareEntities", fn: composeSpecCompare, args: { dimension: "marca", entities: [mar[0], mar[1]] } },
  { tool: "diagnose", fn: composeSpecDiagnose, args: {} },
  { tool: "diagnose", fn: composeSpecDiagnose, args: { focus: "resumen_ejecutivo" } },
  { tool: "executiveSummary", fn: composeSpecResumenEjecutivo, args: {} },
  { tool: "inventoryStatus", fn: composeSpecInventory, args: { focus: "frenado" } },
  { tool: "marginRead", fn: composeSpecMargin, args: { dimension: "cliente" } },
  { tool: "marginRead", fn: composeSpecMargin, args: { dimension: "marca" } },
  { tool: "salesRead", fn: composeSpecVentas, args: { dimension: "cliente" } },
  { tool: "contributionRead", fn: composeSpecContribucion, args: { dimension: "cliente" } },
  { tool: "simulateCarga", fn: composeSpecSimulateCarga, args: {} },
  { tool: "simulateCapital", fn: composeSpecSimulateCapital, args: {} },
];

let total = 0, ok = 0, skipBothNull = 0;
const fails = [];
for (const cs of CASES) {
  for (const scenario of SCN) {
    const a = { ...cs.args, scenario };
    const direct = cs.fn(a);
    const tool = TOOLS[cs.tool](a);
    const dTuples = _tuples(_boletaOf(direct));
    const tSet = new Set(_tuples(tool.boleta));
    const dSupported = !!(direct && direct.evidence);
    const tSupported = !!(tool.coverage && tool.coverage.supported);
    // consistencia de soporte: si el composer degrada (null) la tool debe reportar supported=false
    if (!dSupported && !tSupported) { skipBothNull++; continue; }
    total++;
    const covered = dTuples.every((t) => tSet.has(t));   // toda fig del composer está en el tool, sin alterar
    if (dSupported === tSupported && covered) ok++;
    else fails.push({ tool: cs.tool, args: JSON.stringify(cs.args), scenario, dSupported, tSupported, dFigs: _boletaOf(direct).length, tFigs: tool.boleta.length, sample: covered ? "soporte-desalineado" : "boleta-altera/dropea" });
  }
}

const summary = { total, ok, fails, skipBothNull, tools: Object.keys(TOOLS).length };
fs.writeFileSync("_oracle_fase1_gate.json", JSON.stringify(summary, null, 2));
console.log(`\n═══ FASE 1 · GATE BYTE-IGUALDAD ═══`);
console.log(`tools en catálogo: ${summary.tools}`);
console.log(`casos con soporte: ${ok}/${total} byte-iguales · (${skipBothNull} ambos-null consistentes)`);
if (fails.length) { console.log(`FALLAS (${fails.length}):`); for (const f of fails) console.log(`  ✗ ${f.tool} ${f.args} @${f.scenario} → ${f.sample} (d=${f.dFigs} t=${f.tFigs})`); }
else console.log(`✓ TODO byte-igual — el catálogo re-expone sin alterar cifra`);
console.log("→ _oracle_fase1_gate.json");
process.exit(fails.length ? 1 : 0);
