/* === _simulate_gate.mjs · ADI Core · GATE de SIMULACIÓN (un SUPUESTO sobre el dato REAL) ===
 * base única = real · transform explícito · fórmula por celda · boleta source:"computed" · degrade honesto ·
 * lenguaje de PRODUCTO (dato real / supuesto / Δ · nunca escenario/bonanza/tensión/crisis). */
import { answerADIFromSpec } from "./src/adi/answerADIFromSpec.js";
import { composeSpecSimulate } from "./src/adi/specRetrieval.js";
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

console.log(`\n── simulate-gate: ${pass} PASS · ${fail} FAIL ──`);
process.exit(fail ? 1 : 0);
