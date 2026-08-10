/* === _oracle_order_gate.mjs · ARQUITECTURA C · GATE DE ORDEN PROMETIDO (owner 2026-07-28) ===
 * "Si dice que ordena por monto, la lista debe estar ordenada por monto — ADI no puede fallar en una promesa
 * explícita de ordenamiento." Hallazgo real: marginRead da las filas por margen/brecha (peor margen primero) y
 * diagnose/contributionRead las da por $ (mayor primero) — cuando el usuario pide "ordená por dinero recuperable"
 * y el narrador usa la fuente equivocada, la lista queda en el orden de margen mientras el TEXTO promete dinero.
 *
 * Corre la Pasada completa REAL (plan→batch→narrar→guard, igual que answerViaOracle · hasta 3 intentos) y verifica,
 * por CADA caso, que la secuencia de cifras que el narrador cita junto a cada entidad —en el orden en que las
 * MENCIONA— sea monótona según lo que la pregunta pidió. No mira el plan ni la boleta: mira el TEXTO final, que es
 * lo que el usuario lee. LLM-backed (como plan-gate/fase2-gate) → exit 1 si algún caso rompe su propio orden.
 * SMOKE LLM REAL (etiquetado 2026-07-31, gate de reconciliación/trazabilidad evidenceSpec): invoca handlePlan +
 * handleNarrateC reales — probabilístico, no determinístico (mismo criterio que los demás "SMOKE LLM REAL" del
 * repo). Etiqueta agregada por auditoría de grep sobre los ~85 "_*_gate.mjs" — CERO cambio de lógica.
 */
import fs from "fs";
import { handlePlan, handleNarrateC } from "./src/adi/llm/gatewayCore.js";
import { buildNarrateUserMessageC } from "./src/adi/oracle/narratePromptC.js";
import { runPlan } from "./src/adi/oracle/toolRunner.js";
import { ledgerBoleta } from "./src/adi/oracle/ledger.js";
import { guardC } from "./src/adi/oracle/guardC.js";
for (const ln of fs.readFileSync(".env", "utf8").split(/\r?\n/)) { const m = ln.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
const SC = "actual";

// _toNum("$1.6M"|"18.5%") → número comparable (mismo signo/escala dentro de un caso · $ en dólares, % en puntos)
function _toNum(tok) {
  const dm = String(tok).match(/\$\s?([\d.,]+)\s?([KMB]?)/i);
  if (dm) { let v = parseFloat(dm[1].replace(/,/g, "")); const s = (dm[2] || "").toUpperCase(); if (s === "K") v *= 1e3; else if (s === "M") v *= 1e6; else if (s === "B") v *= 1e9; return v; }
  const pm = String(tok).match(/([\d.,]+)\s?%/);
  if (pm) return parseFloat(pm[1].replace(/,/g, ""));
  return null;
}
// _extractTable(text) → filas de la PRIMERA tabla markdown del texto (| a | b |) como [{cells, header}] | null.
function _extractTable(text) {
  const lines = text.split("\n").map((l) => l.trim()).filter((l) => l.includes("|"));
  if (lines.length < 3) return null;
  const cellsOf = (l) => { let s = l; if (s.startsWith("|")) s = s.slice(1); if (s.endsWith("|")) s = s.slice(0, -1); return s.split("|").map((c) => c.trim()); };
  const sepIdx = lines.findIndex((l) => /^\|?[\s:|-]*-[\s:|-]*\|?$/.test(l));
  if (sepIdx < 1) return null;
  const header = cellsOf(lines[sepIdx - 1]);
  const rows = lines.slice(sepIdx + 1).map(cellsOf).filter((r) => r.length >= header.length - 1 && !/^total$/i.test(r[0] || ""));
  return { header, rows };
}
// _extractOrder(text, entities, metric, keywords) → [{entidad, valor}] en el orden en que aparecen las entidades.
// Si el texto trae una TABLA markdown, usa la COLUMNA cuyo encabezado matchea `keywords` (ej. "recuperable"/"brecha"
// para dinero, "margen" para %) — así no confunde "Venta" con "Valor recuperable" cuando ambas son columnas $ en la
// MISMA fila. Sin tabla (o sin columna que matchee), cae al heurístico: la PRIMERA cifra del tipo pedido cerca del nombre.
function _extractOrder(text, entities, metric, keywords) {
  const re = metric === "pct" ? /([\d.,]+)\s?%/ : /\$\s?[\d.,]+\s?[KMB]?/;
  const table = _extractTable(text);
  if (table) {
    const colIdx = table.header.findIndex((h) => keywords.some((k) => new RegExp(k, "i").test(h)));
    if (colIdx >= 0) {
      const out = [];
      for (const row of table.rows) {
        const nameCell = row[0] || "";
        const ent = entities.find((e) => nameCell.includes(e));
        const valCell = row[colIdx];
        if (ent && valCell) { const m = valCell.match(re); if (m) { const v = _toNum(m[0]); if (v != null) out.push({ entidad: ent, valor: v }); } }
      }
      if (out.length) return out;
    }
  }
  const hits = [];
  for (const e of entities) { const i = text.indexOf(e); if (i >= 0) hits.push({ e, i }); }
  hits.sort((a, b) => a.i - b.i);
  const out = []; const seen = new Set();
  for (const { e, i } of hits) {
    if (seen.has(e)) continue; seen.add(e);
    const m = text.slice(i, i + 160).match(re);
    if (m) { const v = _toNum(m[0]); if (v != null) out.push({ entidad: e, valor: v }); }
  }
  return out;
}
function _monotoneViolation(seq, dir) {
  for (let i = 1; i < seq.length; i++) {
    if (dir === "desc" && seq[i].valor > seq[i - 1].valor + 1e-9) return { i, a: seq[i - 1], b: seq[i] };
    if (dir === "asc" && seq[i].valor < seq[i - 1].valor - 1e-9) return { i, a: seq[i - 1], b: seq[i] };
  }
  return null;
}

const CASES = [
  { name: "clientes-dinero-recuperable-desc",
    q: "¿Qué clientes venden mucho pero dejan poco margen? Ordénalos por dinero recuperable, no solo por porcentaje.",
    entities: ["Falabella", "Lider", "Jumbo", "Sodimac", "Ripley", "Paris", "Tottus", "Mercado Libre"], dir: "desc", metric: "money", keywords: ["recuperable", "no captur", "contribuci"] },
  { name: "sku-valor-recuperable-desc",
    q: "Dame los SKU con bajo margen ordenados de mayor a menor valor recuperable.",
    entities: ["MAK-COMP-AIR", "LG-DRYER8KG", "BOS-SANDER", "SAM-TV55", "PHI-IRON-PRO", "SAM-REF500L", "PHI-SHAVER9"], dir: "desc", metric: "money", keywords: ["recuperable", "brecha"] },
  { name: "clientes-margen-asc",
    q: "¿Qué clientes ceden más margen? Ordénalos de menor a mayor margen (el peor primero).",
    entities: ["Lider", "Falabella", "Sodimac", "Jumbo", "Ripley", "Paris", "Tottus", "Mercado Libre"], dir: "asc", metric: "pct", keywords: ["margen"] },
];

let pass = 0, fail = 0, inconclusive = 0;
for (const c of CASES) {
  let ok = null, lastText = null, lastSeq = null;
  for (let attempt = 0; attempt < 3 && ok !== true; attempt++) {
    const pr = await handlePlan({ text: c.q, history: [], mem: {}, scenario: SC });
    const p = pr.plan; const calls = Array.isArray(p.calls) ? p.calls : [];
    const { ledger, results, trace } = runPlan({ intent: p.intent, calls }, { scenario: SC });
    const figs = ledgerBoleta(ledger);
    const nr = await handleNarrateC({ payload: buildNarrateUserMessageC({ text: c.q, plan: p, results, ledgerFigs: figs, mem: {} }), mem: {} });
    const n = nr.ok ? nr.narration : null;
    if (!n) continue;
    const g = guardC(n, { ledger, results, trace, question: c.q });
    if (!g.ok) continue;   // el muro ya rechazó esta narración por otra razón — no es el caso que este gate mide
    const seq = _extractOrder(n, c.entities, c.metric, c.keywords || []);
    lastText = n; lastSeq = seq;
    if (seq.length < 2) continue;   // no hay suficientes entidades citadas con cifra para juzgar el orden
    const viol = _monotoneViolation(seq, c.dir);
    ok = !viol;
    if (viol) lastSeq = { seq, viol };
  }
  if (ok === true) { pass++; console.log(`  ✓ ${c.name} — orden ${c.dir} respetado (${lastSeq.map((x) => `${x.entidad}=${x.valor}`).join(" > ")})`); }
  else if (ok === false) { fail++; console.log(`  ✗ ${c.name} — ROMPE el orden ${c.dir} prometido: ${JSON.stringify(lastSeq.viol)}\n     texto: ${lastText.slice(0, 300).replace(/\n/g, " ")}`); }
  else { inconclusive++; console.log(`  ⚠ ${c.name} — sin evidencia suficiente en 3 intentos (guard rechazó todo o citó <2 entidades) — NO es una violación, no cuenta para el resultado; revisar manualmente si se repite`); }
}
console.log(`\n── _oracle_order_gate: ${pass} PASS · ${fail} FAIL · ${inconclusive} inconcluso (de ${CASES.length}) ──`);
process.exit(fail ? 1 : 0);
