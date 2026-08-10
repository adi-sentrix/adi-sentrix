/* === _evidence_spec_purity_gate.mjs · evidenceSpec · GATE DE PUREZA (owner 2026-07-31) ===
 * REGLA CENTRAL DEL PRODUCTO: "ADI asesora; Sentrix demuestra." evidenceSpec (sentrixEvidence.js) se construye
 * EXCLUSIVAMENTE desde {plan, results, figs, scenario, unsupported} — JAMÁS desde `narration` (prohibido extraer
 * hechos parseando la prosa narrada). Este gate prueba la regla en 3 capas, la más fuerte primero:
 *
 *   A. ESTÁTICO · grafo de imports: camina TODO el árbol de imports relativos que alcanza sentrixEvidence.js
 *      (transitivamente) y confirma que NINGÚN archivo del grafo importa desde narrationBlocks.js/narratePromptC.js/
 *      guardC.js (los módulos donde vive/se valida la prosa narrada de C) — si no existe una RUTA de import hacia
 *      esos módulos, buildOracleEvidence/buildEvidenceSpec no pueden leer narración aunque alguien lo intentara.
 *   B. ESTÁTICO · identificador, ACOTADO A LA CADENA REAL: para cada archivo del grafo, aísla el texto de cada
 *      export cuyo NOMBRE efectivamente se importa en algún punto del grafo (la "cadena que arma evidenceSpec" —
 *      ej. `fig`/`figFor` de boleta.js, pero NO `guardAgainstBoleta`, que nadie importa en esta cadena) y confirma
 *      que "narration" no aparece como código (fuera de comentarios) en ESE texto acotado. Deliberadamente MÁS
 *      preciso que "grep archivo completo" (que daría un falso positivo con `guardAgainstBoleta(narration, boleta)`
 *      — una función real de boleta.js, pero de la ruta del guard VIEJO, nunca importada por esta cadena).
 *   C. DINÁMICO · llama a buildOracleEvidence() dos veces con el MISMO {plan,results,figs,scenario,unsupported}:
 *      una vez limpio, otra con una key extra `narration` cargada con prosa FABRICADA (cifras inventadas $999M /
 *      "87%" formateado exacto) — y confirma que el evidenceSpec resultante es BYTE-IDÉNTICO en ambos casos
 *      (JSON.stringify): la desestructuración de argumentos de buildOracleEvidence({plan,results,figs,scenario,
 *      unsupported=[]}) ignora cualquier key extra, así que aunque un llamador descuidado pasara narración,
 *      tendría CERO influencia — y ninguna cifra fabricada se filtra al resultado.
 *
 * PURO · sin LLM · sin red. Determinístico: mismo código fuente + mismo plan/figs/scenario → mismo resultado.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { runPlan } from "./src/adi/oracle/toolRunner.js";
import { ledgerBoleta } from "./src/adi/oracle/ledger.js";
import { buildOracleEvidence } from "./src/adi/oracle/sentrixEvidence.js";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
let pass = 0; const fails = [];
const ok = (cond, label, extra) => { if (cond) pass++; else fails.push({ label, extra }); console.log(`  ${cond ? "✓" : "✗"} ${label}`); };

// ── A · GRAFO DE IMPORTS (estático) — también recolecta, por archivo, qué NOMBRES se importan de él (para B) ─────
const ENTRY = "src/adi/oracle/sentrixEvidence.js";
const FORBIDDEN_MODULES = [/narrationBlocks\.js$/i, /narratePromptC\.js$/i, /guardC\.js$/i];

function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}
// extractImports(src) → [{ spec, names[] | null (null = namespace/default, no podemos acotar → conservador) }]
function extractImports(src) {
  const out = [];
  const reNamed = /\bimport\s+\{([^}]*)\}\s+from\s+["']([^"']+)["']/g;
  let m;
  const seen = new Set();
  while ((m = reNamed.exec(src))) {
    const names = m[1].split(",").map((s) => s.trim().split(/\s+as\s+/)[0].trim()).filter(Boolean);
    out.push({ spec: m[2], names });
    seen.add(m.index);
  }
  // cualquier otra forma de import relativo (namespace `* as x`, default, side-effect `import "./x.js"`) → conservador: names=null (B escanea el archivo completo)
  const reAny = /\bimport\s+(?:[^'"{}]*?from\s+)?["']([^"']+)["']/g;
  while ((m = reAny.exec(src))) {
    if (seen.has(m.index)) continue;
    if (!out.some((x) => x.spec === m[1])) out.push({ spec: m[1], names: null });
  }
  const reExport = /\bexport\s+(?:\*|\{[^}]*\})\s+from\s+["']([^"']+)["']/g;
  while ((m = reExport.exec(src))) out.push({ spec: m[1], names: null });
  return out;
}
function resolveModule(fromFile, spec) {
  let p = path.resolve(path.dirname(fromFile), spec);
  if (fs.existsSync(p) && fs.statSync(p).isFile()) return p;
  if (fs.existsSync(p + ".js")) return p + ".js";
  return p;
}
function walkImportGraph(entryRel) {
  const visited = new Set();
  const importedNamesByFile = new Map();   // file → Set(names) actualmente importados de él en TODO el grafo | "*" = archivo completo
  const queue = [path.resolve(ROOT, entryRel)];
  const forbiddenHits = [];
  while (queue.length) {
    const file = queue.shift();
    if (visited.has(file)) continue;
    visited.add(file);
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) continue;
    const raw = fs.readFileSync(file, "utf8");
    for (const { spec, names } of extractImports(raw)) {
      if (FORBIDDEN_MODULES.some((re) => re.test(spec))) forbiddenHits.push({ file: path.relative(ROOT, file), spec });
      if (!spec.startsWith(".")) continue;   // solo seguimos imports RELATIVOS (código propio del repo, no libs npm)
      const resolved = resolveModule(file, spec);
      if (!visited.has(resolved)) queue.push(resolved);
      const set = importedNamesByFile.get(resolved) || new Set();
      if (names === null) set.add("*"); else names.forEach((n) => set.add(n));
      importedNamesByFile.set(resolved, set);
    }
  }
  return { visited, forbiddenHits, importedNamesByFile };
}

// exportSlice(src, name) → el texto del export NAME (function/const/let/class), desde su declaración hasta el
// PRÓXIMO `export ` de nivel 0 o EOF — acotamos ahí para no arrastrar declaraciones vecinas no relacionadas.
function exportSlice(src, name) {
  const re = new RegExp(`export\\s+(?:async\\s+)?(?:function\\*?|const|let|class)\\s+${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`);
  const m = re.exec(src);
  if (!m) return null;
  const start = m.index;
  const rest = src.slice(start + m[0].length);
  const nextExport = rest.search(/\n\s*export\s+/);
  return nextExport === -1 ? src.slice(start) : src.slice(start, start + m[0].length + nextExport);
}

console.log("\n═══ evidenceSpec · GATE DE PUREZA (nunca depende de narration) ═══\n");
console.log("── A · grafo de imports de sentrixEvidence.js (estático, transitivo) ──");
const { visited, forbiddenHits, importedNamesByFile } = walkImportGraph(ENTRY);
console.log(`  grafo recorrido: ${visited.size} archivos (siguiendo solo imports relativos, código propio)`);
ok(visited.size >= 10, `el grafo tiene un tamaño razonable (no un walk vacío por regex roto) — ${visited.size} archivos`);
ok(forbiddenHits.length === 0, "ningún archivo del grafo importa narrationBlocks.js / narratePromptC.js / guardC.js (los módulos donde vive la prosa narrada)", forbiddenHits);

console.log("\n── B · identificador 'narration', ACOTADO a lo que la cadena realmente importa de cada archivo ──");
const hits = [];
let scannedExports = 0, fullFileFallbacks = 0;
for (const file of visited) {
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) continue;
  const raw = fs.readFileSync(file, "utf8");
  const names = importedNamesByFile.get(file);
  if (file === path.resolve(ROOT, ENTRY) || !names || names.has("*")) {
    // el propio archivo de entrada, o un import namespace/default/side-effect (no podemos acotar) → conservador: archivo completo
    fullFileFallbacks += file === path.resolve(ROOT, ENTRY) ? 0 : 1;
    if (/\bnarration\b/i.test(stripComments(raw))) hits.push({ file: path.relative(ROOT, file), scope: "archivo completo" });
    continue;
  }
  for (const name of names) {
    const slice = exportSlice(raw, name);
    if (!slice) continue;   // nombre importado que no matchea el patrón export (ej. re-export indirecto) → no rompe el gate por eso
    scannedExports++;
    if (/\bnarration\b/i.test(stripComments(slice))) hits.push({ file: path.relative(ROOT, file), scope: `export ${name}` });
  }
}
console.log(`  ${scannedExports} exports acotados escaneados · ${fullFileFallbacks} archivos completos (import namespace/default, conservador)`);
ok(hits.length === 0, "el identificador 'narration' no aparece como código (fuera de comentarios) en ningún export realmente importado por la cadena", hits);

// ── C · DINÁMICO — narración fabricada inyectada a mano NO cambia el evidenceSpec ──────────────────────────────
console.log("\n── C · dinámico — buildOracleEvidence() ignora una key `narration` inyectada ──");
const plan = {
  intent: "answer", mode: "default", rationale: "el margen puntual de Falabella",
  scope: { level: "entity", entities: ["Falabella"] },
  calls: [{ tool: "entityRecord", args: { dimension: "cliente", entity: "Falabella" } }],
};
const { ledger, results, unsupported } = runPlan({ intent: plan.intent, calls: plan.calls }, { scenario: "actual" });
const figs = ledgerBoleta(ledger);

const clean = buildOracleEvidence({ plan, results, figs, scenario: "actual", unsupported });
const dirty = buildOracleEvidence({
  plan, results, figs, scenario: "actual", unsupported,
  // prosa FABRICADA con cifras inventadas — si evidenceSpec la leyera de algún modo, estos tokens aparecerían abajo.
  narration: "Falabella factura $999.9M con un margen del 61.4% — cifras completamente inventadas para este probe de pureza.",
});

ok(!!clean.evidenceSpec, "evidenceSpec se arma completo SIN que la llamada incluya `narration` en absoluto");
ok(JSON.stringify(clean.evidenceSpec) === JSON.stringify(dirty.evidenceSpec),
  "evidenceSpec es BYTE-IDÉNTICO con o sin `narration` fabricada inyectada (la desestructuración de argumentos la ignora, cero influencia)");
ok(JSON.stringify(dirty.evidenceSpec).indexOf("999.9") === -1, "la cifra fabricada ($999.9M) no se filtró al evidenceSpec");
ok(JSON.stringify(dirty.evidenceSpec).indexOf("61.4") === -1, "el margen fabricado (61.4%) tampoco se filtró al evidenceSpec");

const summary = { total: pass + fails.length, pass, fails };
fs.writeFileSync(path.join(ROOT, "_evidence_spec_purity_gate.json"), JSON.stringify(summary, null, 2));
console.log(`\n${pass}/${pass + fails.length} chequeos correctos${fails.length ? " · FALLAS: " + JSON.stringify(fails, null, 1) : " ✓"}`);
console.log("→ _evidence_spec_purity_gate.json");
process.exit(fails.length ? 1 : 0);
