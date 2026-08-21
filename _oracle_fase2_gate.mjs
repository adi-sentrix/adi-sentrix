/* === _oracle_fase2_gate.mjs · ARQUITECTURA C · Fase 2 · GATE ADVERSARIAL DEL MURO ENDURECIDO ===
 * Prueba guardC sobre ledgers REALES: los ataques (atribución, cifra inventada, conteo inventado, graduación,
 * garble de entidad) DEBEN bloquearse; las narraciones FIELES NO deben rechazarse (cero falsos positivos).
 * Determinístico · sin LLM · aditivo. → exit 1 si algún caso no da el veredicto esperado.
 */
import fs from "fs";
import { runPlan } from "./src/adi/oracle/toolRunner.js";
import { ledgerBoleta } from "./src/adi/oracle/ledger.js";
import { guardC, parseCounts } from "./src/adi/oracle/guardC.js";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";

// vía 1 (2026-08-20): el dataset se DECLARA acá. Antes se heredaba del import por defecto de tenantStore,
// que ya no existe: el store arranca en la forma vacía y el dato entra por initTenant. Ver tenantEmpty.js.
initTenant(TENANT_DEMO);

const SC = "actual";
const _strip = (s) => String(s).replace(/\s/g, "");

// ledger de DIAGNÓSTICO (focos con entidades reales · Falabella/Lider/Jumbo…)
const diag = runPlan({ intent: "answer", calls: [{ tool: "diagnose", args: {} }] }, { scenario: SC });
const dfigs = ledgerBoleta(diag.ledger);
// ledger de SIMULACIÓN (para graduación)
const sim = runPlan({ intent: "answer", calls: [{ tool: "simulateCarga", args: {} }] }, { scenario: SC });

// entidades reales del turno (de los facts) para armar ataques legítimos
function entsOf(results) {
  const s = new Set();
  const walk = (v, k) => { if (Array.isArray(v)) v.forEach((x) => walk(x, k)); else if (v && typeof v === "object") for (const kk of Object.keys(v)) walk(v[kk], kk); else if (typeof v === "string" && /^(name|entidad|entity|nombre|entityB)$/i.test(k)) s.add(v.trim()); };
  results.forEach((r) => walk(r.facts, ""));
  return [...s];
}
const dEnts = entsOf(diag.results);
// value → dueño (la entidad puede estar en CUALQUIER segmento del label)
const segEnt = (label, ents) => { const en = new Set(ents.map((e) => e.toLowerCase())); for (const s of String(label).split("·")) { const t = s.trim(); if (en.has(t.toLowerCase())) return t; } return null; };
const ownerOf = (figs, ents) => { const m = new Map(); for (const f of figs) { const e = segEnt(f.label, ents); if (e) { if (!m.has(_strip(f.value))) m.set(_strip(f.value), new Set()); m.get(_strip(f.value)).add(e); } } return m; };
const owners = ownerOf(dfigs, dEnts);

// una cifra con dueño único + una entidad DISTINTA para el ataque de atribución
let attackVal = null, attackTrueOwner = null, attackWrongEnt = null;
for (const [val, set] of owners) { if (set.size === 1) { const owner = [...set][0]; const other = dEnts.find((e) => e.toLowerCase() !== owner.toLowerCase()); if (other) { attackVal = val; attackTrueOwner = owner; attackWrongEnt = other; break; } } }
// una cifra fiel (con su dueño correcto) para el caso positivo
const faithful = dfigs.find((f) => segEnt(f.label, dEnts));
const faithfulEnt = faithful ? segEnt(faithful.label, dEnts) : null;
// conteo autorizado (nº de focos) y uno inventado
const authCount = (diag.results[0] && diag.results[0].facts && Array.isArray(diag.results[0].facts.findings)) ? diag.results[0].facts.findings.length : null;
const badCount = (authCount || 3) + 6;
const simVal = ledgerBoleta(sim.ledger)[0] && ledgerBoleta(sim.ledger)[0].value;

const CASES = [
  // POSITIVOS (deben PASAR)
  { name: "fiel · atribución correcta", ledger: diag.ledger, results: diag.results, trace: diag.trace, text: faithful ? `${faithfulEnt} muestra ${faithful.value} en el foco detectado.` : "", expectOk: true },
  { name: "fiel · conteo correcto", ledger: diag.ledger, results: diag.results, trace: diag.trace, text: authCount ? `Miré tus datos y encontré ${authCount} focos donde se pierde margen.` : "", expectOk: true },
  { name: "fiel · sin cifras (guía)", ledger: diag.ledger, results: diag.results, trace: diag.trace, text: "Conviene arrancar por lo que más pesa y avanzar de a un foco.", expectOk: true },
  // BLOQUEANTES (deben tumbar la respuesta · ok=false)
  { name: "ataque · cifra inventada", ledger: diag.ledger, results: diag.results, trace: diag.trace, text: "Además hay un extra oculto de $999M que conviene mirar.", expectVerdict: "cifra-no-autorizada" },
  { name: "ataque · conteo inventado", ledger: diag.ledger, results: diag.results, trace: diag.trace, text: `El barrido arrojó ${badCount} focos críticos.`, expectVerdict: "conteo-no-autorizado" },
  { name: "ataque · entidad garble", ledger: diag.ledger, results: diag.results, trace: diag.trace, text: "Conviene enfocarse en Falcon para recuperar margen.", expectVerdict: "entidad-corrupta" },
  // ATRIBUCIÓN · CAMBIÓ DE AVISO A BLOQUEO (Contrato v2 · Fase 2, owner 2026-08-07). El contrato viejo la dejaba
  // como aviso para no subir la tasa de abstención por falsos positivos. El contrato NUEVO pide "guard estricto de
  // binding entidad:métrica:período:unidad:valor" — y el falso positivo quedó acotado por el criterio NÍTIDO
  // (exactamente 1 entidad/métrica cerca de la cifra → juzga; 0 o 2+ → se abstiene, ver _binding_guard_gate). Un
  // bloqueo tampoco produce silencio: hay 3 reintentos y después reparación desde la boleta.
  // ESTE caso es exactamente lo que el contrato nuevo quiere tumbar: una cifra de una entidad atribuida a OTRA.
  { name: "bloqueo · atribución (Contrato v2)", ledger: diag.ledger, results: diag.results, trace: diag.trace, text: attackVal ? `${attackWrongEnt} aporta ${attackVal} de contribución no capturada.` : "", expectVerdict: "entidad-mal-atribuida" },
  { name: "aviso · graduación", ledger: sim.ledger, results: sim.results, trace: sim.trace, text: simVal ? `La carga baja al target y el negocio recupera ${simVal} en firme, ya está hecho.` : "", expectAdvisory: "graduacion" },
];

let pass = 0; const fails = [];
for (const c of CASES) {
  if (!c.text) { fails.push({ name: c.name, why: "caso no construible (dato faltante)" }); continue; }
  const g = guardC(c.text, { ledger: c.ledger, results: c.results, trace: c.trace });
  let good;
  if (c.expectOk) good = g.ok === true;
  else if (c.expectAdvisory) good = (g.advisories || []).some((v) => v.kind === c.expectAdvisory);   // detectado como aviso (no bloquea)
  else good = g.ok === false && g.violations.some((v) => v.kind === c.expectVerdict);
  if (good) pass++;
  else fails.push({ name: c.name, text: c.text, expected: c.expectOk ? "ok" : (c.expectAdvisory ? "aviso:" + c.expectAdvisory : c.expectVerdict), got: g.ok ? "ok" : g.violations.map((v) => v.kind).join(","), advisories: (g.advisories || []).map((v) => v.kind).join(",") });
}

const summary = { total: CASES.length, pass, fails, meta: { attackVal, attackTrueOwner, attackWrongEnt, authCount, badCount, faithfulEnt } };
fs.writeFileSync("_oracle_fase2_gate.json", JSON.stringify(summary, null, 2));
console.log(`\n═══ FASE 2 · GATE ADVERSARIAL DEL MURO ═══`);
for (const c of CASES) {
  const g = c.text ? guardC(c.text, { ledger: c.ledger, results: c.results, trace: c.trace }) : null;
  const ok = g && (c.expectOk ? g.ok : c.expectAdvisory ? (g.advisories || []).some((v) => v.kind === c.expectAdvisory) : (!g.ok && g.violations.some((v) => v.kind === c.expectVerdict)));
  const tag = g ? (c.expectAdvisory ? (g.ok ? "aviso✓(no bloquea)" : "aviso?") : g.ok ? "fiel" : g.verdict) : "NO-CONSTRUIBLE";
  console.log(`  ${ok ? "✓" : "✗"} ${c.name.padEnd(30)} → ${tag}`);
}
console.log(`\n${pass}/${CASES.length} casos correctos${fails.length ? " · FALLAS: " + JSON.stringify(fails, null, 1) : " ✓ bloquea cifra/conteo/entidad · detecta atribución/graduación como aviso · no rechaza lo fiel"}`);
console.log("→ _oracle_fase2_gate.json");
process.exit(fails.length ? 1 : 0);
