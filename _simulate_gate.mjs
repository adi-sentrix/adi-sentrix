/* === _simulate_gate.mjs · ADI Core · GATE de SIMULACIÓN (un SUPUESTO sobre el dato REAL) ===
 * base única = real · transform explícito · fórmula por celda · boleta source:"computed" · degrade honesto ·
 * lenguaje de PRODUCTO (dato real / supuesto / Δ · nunca escenario/bonanza/tensión/crisis). */
import { answerADIFromSpec } from "./src/adi/answerADIFromSpec.js";
import { composeSpecSimulate, computeQualityVerdict } from "./src/adi/specRetrieval.js";
import { guardAgainstBoleta } from "./src/adi/boleta.js";

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log("  ✓ " + n); } else { fail++; console.log("  ✗ " + n); } };
const sim = (spec) => answerADIFromSpec({ schemaVersion: 1, ...spec }, {}, { scenario: "bonanza" });
const TF = { kind: "assumption", op: "delta", value: 3, unit: "pct", base: "real" };

// ── 1 · ventas@cliente +3% → tabla actual/supuesto/Δ ─────────────────────────────
const r = sim({ operation: "table", metric: "ventas", dimension: "cliente", transform: TF });
ok("1 · ventas@cliente +3% produce tabla (no degrade)", r.route === "qi_retrieval");
ok("2 · evidence.transform = {op:delta, value:3, base:real}",
  !!(r.evidence && r.evidence.transform && r.evidence.transform.op === "delta" && r.evidence.transform.value === 3 && r.evidence.transform.base === "real"));
ok("3 · lenguaje de PRODUCTO (dato real · supuesto · impacto · voz ejecutiva sin Δ en el texto)", /dato real/.test(r.text) && /supuesto/.test(r.text) && /impacto/i.test(r.text));
ok("3b · HISTORIA fluida · SIN títulos visibles (nada de **Lectura**/**Estructura**/**Riesgo**/**Qué hacer** ni encabezados)", !/\*\*(Lectura|Estructura|Riesgo|Qu[eé] hacer)\*\*/i.test(r.text) && !/^\s*(Lectura|Estructura|Riesgo|Qu[eé] hacer)\s*:/im.test(r.text));
ok("4 · SIN lenguaje de escenario (bonanza/tensión/crisis/escenario)", !/bonanza|tensi[oó]n|crisis|escenario/i.test(r.text));
ok("5 · el texto de ADI pasa su propia boleta (self-consistente)", guardAgainstBoleta(r.text, (r.evidence && r.evidence.boleta) || []).ok);

const bol = (r.evidence && r.evidence.boleta) || [];
ok("6 · boleta con figuras source:actual y source:computed", bol.some((f) => f.source === "actual") && bol.some((f) => f.source === "computed"));
ok("7 · toda figura computed trae fórmula auditable", bol.filter((f) => f.source === "computed").length > 0 && bol.filter((f) => f.source === "computed").every((f) => f.formula && f.formula.length));

// ── 2 · el cómputo es correcto (determinístico) ──────────────────────────────────
const cs = composeSpecSimulate({ metric: "ventas", dimension: "cliente", filters: {}, transform: TF });
const top = cs.evidence.projection[0];
ok("8 · supuesto = actual × 1.03 y Δ = actual × 0.03 (por entidad)",
  Math.abs(top.supuesto - top.actual * 1.03) < 1e-6 && Math.abs(top.delta - top.actual * 0.03) < 1e-6);
ok("9 · total supuesto = total actual × 1.03", Math.abs(cs.evidence.total.supuesto - cs.evidence.total.actual * 1.03) < 1e-6);
ok("10 · la fórmula computed referencia el actual y el factor", cs.evidence.boleta.some((f) => f.source === "computed" && /× 1\.03/.test(f.formula)));

// ── 3 · degradación honesta (allow-list) ─────────────────────────────────────────
const rM = sim({ operation: "table", metric: "margen", dimension: "cliente", transform: TF });
ok("11 · margen (tasa · no simulable con +%) → degrade honesto (menciona 'actual', sin Δ)",
  /simulate-not/.test(rM.route) && /actual/.test(rM.text) && !/Δ/.test(rM.text));
const rT = sim({ operation: "table", metric: "ventas", dimension: "cliente", transform: { kind: "assumption", op: "target", value: 5, unit: "pct", base: "real" } });
ok("12 · transform no soportado (op:target) → degrade honesto", /simulate-not/.test(rT.route));
const rNo = sim({ operation: "overview", metric: "ventas", dimension: "cliente" });
ok("13 · sin transform → ruta normal, NO simula (sin evidence.transform)", !(rNo.evidence && rNo.evidence.transform));

// ── 4 · base = real (no escenario) ───────────────────────────────────────────────
ok("14 · la boleta declara base real ('...sobre el dato real')", bol.some((f) => /sobre el dato real/.test(f.context || "")));

// ── 5 · COHERENCIA narración ⟷ Sentrix (criterio duro del owner): la cifra que ADI NARRA (opener) = el blockPct de
//    evidence.concentration = el Acum% del corte (última fila del bloque) = la figura de la boleta. UNA sola fuente →
//    lo que Sentrix pinta (callout + Acum%) NO puede divergir de lo que ADI dice. "No hay cifra narrativa sin respaldo."
const _cc = cs.evidence.concentration;
const _lastCum = Math.round(_cc.bars[_cc.blockCount - 1].cumPct);
const _openerPct = (cs.opener.match(/explican el (\d+)%/) || [])[1];
ok("15 · coherencia: narración% === concentration.blockPct === Acum% del corte === boleta",
  _cc.blockPct === _lastCum && String(_cc.blockPct) === _openerPct && cs.evidence.boleta.some((f) => /Concentración/.test(f.label) && f.value === `${_cc.blockPct}%`));

// ── 5 · VEREDICTO DE CALIDAD (B) · juzga el bloque 80% contra promedio INTERNO + benchmark DECLARADO, graduado, honesto ──
const _qv = cs.evidence.quality_verdict;
ok("16 · veredicto presente (buena/débil/mixta) · basis 'both' · cruce margen (ventas→margen)",
  ["buena_captura", "captura_debil", "mixta"].includes(_qv.verdict) && _qv.basis === "both" && _qv.crossMetric === "margen");
ok("17 · declarado = POLICY (30.1 · NO inventado) + la explicación cita bloque · interno · declarado",
  _qv.declared === 30.1 && _qv.explanation.includes(_qv.blockValueFmt) && _qv.explanation.includes(_qv.internalAvgFmt) && _qv.explanation.includes(_qv.declaredFmt));
const _qCap = composeSpecSimulate({ metric: "capital", dimension: "bodega", filters: {}, transform: { kind: "assumption", op: "delta", value: -10, unit: "pct", base: "real" } }).evidence.quality_verdict;
ok("18 · capital → cruce rotación vs mínimo declarado (2x) · basis both", _qCap.crossMetric === "rotacion" && _qCap.declared === 2 && _qCap.basis === "both");
ok("19 · HONESTIDAD: métrica sin cruce → 'sin_benchmark' (NUNCA juzga bueno/malo sin benchmark)",
  computeQualityVerdict({ metric: "margen", dimension: "cliente", items: [{ name: "x", actual: 1 }], blockCount: 1 }).verdict === "sin_benchmark");

console.log(`\n── simulate-gate: ${pass} PASS · ${fail} FAIL ──`);
process.exit(fail ? 1 : 0);
