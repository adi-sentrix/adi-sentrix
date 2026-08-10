/* === _oracle_plan_gate.mjs · ARQUITECTURA C · GATE DE PLAN (la DECISIÓN, testeable) ===
 * Corre preguntas clave por la Pasada 1 (handlePlan · LLM) y ASSERTA propiedades ESTRUCTURALES del plan: alcance
 * (global vs entidad heredada), intención (define/redirect/ack), memoria de interacción, tool elegida. Es el arnés
 * que blinda el fix del owner (el "del negocio" que heredaba Falabella) y las clases que antes se parchaban con regex.
 * LLM-backed (como los sweeps): cada caso se corre y se asserta la propiedad. → exit 1 si falla alguno.
 * SMOKE LLM REAL (etiquetado 2026-07-31, gate de reconciliación/trazabilidad evidenceSpec): invoca handlePlan real
 * contra el proveedor LLM configurado — probabilístico, no determinístico (mismo criterio que los demás "SMOKE LLM
 * REAL" del repo). Etiqueta agregada por auditoría de grep sobre los ~85 "_*_gate.mjs" — CERO cambio de lógica.
 */
import fs from "fs";
import { handlePlan } from "./src/adi/llm/gatewayCore.js";
for (const ln of fs.readFileSync(".env", "utf8").split(/\r?\n/)) { const m = ln.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
const SC = "actual";

const H_FALABELLA = [{ role: "user", text: "dame el perfil de Falabella" }, { role: "adi", gist: "Falabella: ventas $19.4M, margen 22%, contribución $4.1M." }];
const H_LISTA = [{ role: "user", text: "¿qué clientes ceden más margen?" }, { role: "adi", gist: "Lider, Falabella y Sodimac ceden margen contra el benchmark." }];

// helpers de assert sobre el plan
const noEntity = (p) => !(p.calls || []).some((c) => c.args && (c.args.entity || (c.args.filters && (c.args.filters.cliente || c.args.filters.marca)) || (Array.isArray(c.args.entities) && c.args.entities.length)));
const isGlobal = (p) => p.scope && p.scope.level === "global" && noEntity(p);
const usesTool = (p, t) => (p.calls || []).some((c) => c.tool === t);

const CASES = [
  { name: "del-negocio-no-hereda", q: "y para el negocio en general, ¿por dónde arranco a mejorar?", history: H_FALABELLA, ok: (p) => isGlobal(p) },
  { name: "del-negocio-explicito", q: "y del negocio en general, ¿cómo venimos?", history: H_FALABELLA, ok: (p) => isGlobal(p) },
  { name: "correccion-redirect", q: "te pedí del negocio y me hablás de una sola cuenta, ¿te parece adecuado?", history: [...H_FALABELLA, { role: "user", text: "y por dónde arranco" }, { role: "adi", gist: "En Falabella conviene revisar el margen." }], ok: (p) => p.intent === "redirect" && isGlobal(p) },
  { name: "definicion-usa-glosario", q: "¿qué es exactamente la contribución no capturada?", history: [], ok: (p) => p.intent === "define" && usesTool(p, "defineConcept") },
  { name: "definicion-carga", q: "explicame qué es la carga comercial", history: [], ok: (p) => p.intent === "define" && usesTool(p, "defineConcept") },
  { name: "memoria-nombre", q: "de ahora en más llámame Juan", history: [], ok: (p) => p.memoryUpdate && /juan/i.test(p.memoryUpdate.nombre || "") },
  { name: "memoria-usted", q: "trátame de usted por favor", history: [], ok: (p) => p.memoryUpdate && p.memoryUpdate.trato === "usted" },
  // owner 2026-07-31: "háblame más directo" YA NO es memoryUpdate.verbosidad (retirado — era una 2ª fuente de
  // verdad para lo mismo que resuelve pref.detailLevel, y encima el LLM no la clasificaba de forma confiable acá).
  // Ahora mapea a "pref" (responsePreference.js) — el mecanismo PRINCIPAL es esta clasificación del LLM; la red
  // determinística de _coercePref en answerViaOracle.js (probada en _response_preference_gate.mjs sección 17) es
  // el backstop, no lo que este gate ejercita (acá solo corre handlePlan, sin el resto del pipeline).
  { name: "directo-es-pref", q: "háblame más directo, sin rodeos", history: [], ok: (p) => p.pref && p.pref.detailLevel === "brief" },
  { name: "entidad-scope", q: "dame el perfil de Falabella", history: [], ok: (p) => p.scope && p.scope.level === "entity" && usesTool(p, "entityProfile") },
  { name: "diagnostico", q: "¿dónde estoy perdiendo plata?", history: [], ok: (p) => usesTool(p, "diagnose") },
  { name: "de-esos-lista", q: "de esos, ¿cuáles ceden más margen?", history: H_LISTA, ok: (p) => p.scope && (p.scope.level === "list" || (Array.isArray(p.scope.entities) && p.scope.entities.length > 0)) },
];

async function pool(items, n, fn) { const out = new Array(items.length); let i = 0; await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k]); } })); return out; }

// _sleep/_isRateLimited/_handlePlanWithRetry (owner 2026-08-03, investigación cruzada de los 5 gates de Arquitectura
// C, causa raíz CONFIRMADA con evidencia real: 7 corridas de este gate, 50/50 fallas de case fueron HTTP 429 crudo
// del proveedor — CERO discrepancia semántica genuina) — a diferencia de answerViaOracle.js (que envuelve la MISMA
// llamada a handlePlan en un loop de 3 intentos con escalada de modelo, mini→terra→sol), este gate llamaba
// handlePlan() UNA sola vez por caso, sin ningún retry — un 429 transitorio (que en producción se recupera solo)
// tumbaba el case de forma PERMANENTE. Esto es una corrección de la FIDELIDAD del arnés de test (regla 2: reemplaza
// una métrica/arnés frágil por uno más correcto, NUNCA relaja la aserción semántica `c.ok(r.plan)` de cada case),
// no un cambio de producción — answerViaOracle.js/modelRouter.js no se tocan.
function _sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
function _isRateLimited(e) { return !!(e && (e.code === "rate_limited" || /HTTP 429/.test(String(e.message || "")))); }
async function _handlePlanWithRetry(args, maxAttempts = 3) {
  let lastErr = null;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try { return await handlePlan({ ...args, attempt }); }
    catch (e) {
      lastErr = e;
      if (!_isRateLimited(e)) throw e;   // solo reintenta 429 real — cualquier otro error sigue siendo fallo inmediato
      const wait = Number(e && e.retryAfterMs) > 0 ? Math.min(e.retryAfterMs, 2000) : 1500;
      await _sleep(wait);
    }
  }
  throw lastErr;
}

// concurrencia 4→2 (owner 2026-08-03): reduce el burst simultáneo de tokens que el propio gate genera (cada case
// manda un system prompt de ~8000 tokens) — menos presión propia sobre el mismo cupo TPM que el retry de arriba
// ya intenta sortear.
const res = await pool(CASES, 2, async (c) => {
  try { const r = await _handlePlanWithRetry({ text: c.q, history: c.history, mem: {}, scenario: SC }); if (!r.ok) return { ...c, pass: false, why: "plan-fail: " + (r.error || "?") }; const pass = !!c.ok(r.plan); return { name: c.name, pass, plan: { intent: r.plan.intent, scope: r.plan.scope, tools: (r.plan.calls || []).map((x) => x.tool), mem: r.plan.memoryUpdate, pref: r.plan.pref } }; }
  catch (e) { return { name: c.name, pass: false, why: (_isRateLimited(e) ? "RATE_LIMIT tras reintentos: " : "") + String(e.message).slice(0, 200) }; }
});
const passed = res.filter((r) => r.pass).length;
fs.writeFileSync("_oracle_plan_gate.json", JSON.stringify(res, null, 2));
console.log(`\n═══ PLAN-GATE · ${passed}/${res.length} ═══`);
for (const r of res) console.log(`  ${r.pass ? "✓" : "✗"} ${r.name.padEnd(26)} ${r.pass ? JSON.stringify(r.plan.scope || r.plan.tools || r.plan.mem) : (r.why || JSON.stringify(r.plan))}`);
console.log(passed === res.length ? "\n✓ las decisiones del plan quedan blindadas" : "\n⚠ revisar los que fallan");
process.exit(passed === res.length ? 0 : 1);
