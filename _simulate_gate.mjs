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
ok("20 · concentrado → el opener TEJE el veredicto (cita margen del bloque + benchmark) · self-consistente con su boleta",
  _qv.verdict !== "sin_benchmark" && cs.opener.includes(_qv.blockValueFmt) && cs.opener.includes(_qv.declaredFmt) && guardAgainstBoleta(cs.opener, cs.evidence.boleta).ok);

/* ═══ SIMULATE S1-S3 (owner 2026-07-14 "sí, continúa" · construido 2026-07-15) ═══════════════════════════════
 * La operación `simulate` REAL en el seam (antes → spec_blocked_unsupported-op): contrato supuesto→efecto→dónde
 * pega→límite→decisión · guard de absurdos · acciones específicas (carga→target · liberar capital · $ del
 * detector, graduado probado/abierto) · recommend META-AWARE (ancla "3% = $X" + caminos A/B/C/D). */

// ── 6 · S1 · operation simulate + transform → proyector CON contrato ────────────────────────────────
const rOp = sim({ operation: "simulate", metric: "ventas", dimension: "cliente", transform: TF });
ok("21 · operation simulate EJECUTA (no spec_blocked · era unsupported-op)", rOp.route === "qi_retrieval");
ok("22 · contrato: supuesto → dónde pega → límite → decisión presentes",
  /\*\*El supuesto:\*\*/.test(rOp.text) && /\*\*Dónde pega:\*\*/.test(rOp.text) && /\*\*El límite:\*\*/.test(rOp.text) && /\*\*La decisión:\*\*/.test(rOp.text));
ok("23 · el supuesto se declara proyección (no un dato observado) y el límite declara lo que NO se predice",
  /no un dato observado|no es un dato observado/.test(rOp.text) && /no se predice/.test(rOp.text));
ok("24 · sin lenguaje de escenario + el texto pasa su propia boleta",
  !/bonanza|tensi[oó]n|crisis|escenario/i.test(rOp.text) && guardAgainstBoleta(rOp.text, (rOp.evidence && rOp.evidence.boleta) || []).ok);
ok("25 · evidence completa para Sentrix (transform + projection → SimulationPanel)",
  !!(rOp.evidence && rOp.evidence.transform && Array.isArray(rOp.evidence.projection) && rOp.evidence.projection.length));
ok("26 · la vía legacy (table + transform) queda SIN contrato (byte-cómoda · followups intactos)",
  !/\*\*El supuesto:\*\*/.test(r.text));

// ── 7 · S1 · guard de ABSURDOS (0% · >±50%) → repregunta honesta ────────────────────────────────────
const r0 = sim({ operation: "simulate", metric: "ventas", dimension: "cliente", transform: { ...TF, value: 0 } });
ok("27 · 0% → repregunta honesta (no proyecta nada)", /simulate-absurd/.test(r0.route) && /0%/.test(r0.text));
const r80 = sim({ operation: "simulate", metric: "ventas", dimension: "cliente", transform: { ...TF, value: 80 } });
ok("28 · +80% → repregunta honesta (rango operable declarado)", /simulate-absurd/.test(r80.route) && /±50%/.test(r80.text));
const r50 = sim({ operation: "simulate", metric: "ventas", dimension: "cliente", transform: { ...TF, value: 50 } });
ok("29 · ±50% es el borde INCLUSIVO (ejecuta)", r50.route === "qi_retrieval");
const rN40 = sim({ operation: "table", metric: "ventas", dimension: "cliente", transform: { ...TF, value: -40 } });
ok("30 · el guard cubre también la vía legacy (-40% ejecuta · el rango es el mismo)", rN40.route === "qi_retrieval");

// ── 8 · S2 · supuesto sobre ACCIÓN: carga → target ($ del detector · graduación probado/abierto) ────
const rCg = sim({ operation: "simulate", metric: "carga", dimension: "cliente", simAction: "carga_target" });
ok("31 · carga→target ejecuta con el $ del detector (efecto directo + fórmula (carga − target) × venta)",
  rCg.route === "qi_retrieval" && /\*\*El efecto directo:\*\*/.test(rCg.text) && /\(carga actual − target\) × venta/.test(rCg.text));
ok("32 · graduación dura: lo probado por el dato Y la reacción del volumen abierta",
  /probado por el dato/.test(rCg.text) && /reacci[oó]n del volumen/.test(rCg.text) && /(queda abierto|no predice)/i.test(rCg.text));
const bolCg = (rCg.evidence && rCg.evidence.boleta) || [];
ok("33 · boleta con los campos RESERVADOS de simulate: source computed + formula auditable en el recuperable",
  bolCg.some((f) => f.source === "computed" && /carga/.test(f.formula || "") && /Recuperable/.test(f.label)));
ok("34 · el texto pasa su propia boleta + target de carga autorizado",
  guardAgainstBoleta(rCg.text, bolCg).ok && bolCg.some((f) => /Target de carga/.test(f.label)));
const rCgF = sim({ operation: "simulate", metric: "carga", dimension: "cliente", simAction: "carga_target", filters: { cliente: "Falabella" } });
ok("35 · scoped a UN cliente: el supuesto nombra a Falabella y evidence.entidad la declara (garantía del narrador)",
  /Falabella/.test(rCgF.text) && rCgF.evidence && rCgF.evidence.entidad === "Falabella");
ok("36 · carga + transform % (tasa · no proyectable) NO degrada: cae a la acción (declarando SU supuesto)",
  (() => { const r2 = sim({ operation: "simulate", metric: "carga", dimension: "cliente", transform: TF }); return r2.route === "qi_retrieval" && /target/.test(r2.text); })());

// ── 9 · S2 · supuesto sobre ACCIÓN: liberar el capital detenido ──────────────────────────────────────
const rCap = sim({ operation: "simulate", metric: "capital", dimension: "sku", simAction: "liberar_capital" });
ok("37 · liberar capital ejecuta con el $ del detector + la vara declarada (rotación/DOH de POLICY)",
  rCap.route === "qi_retrieval" && /\*\*El efecto directo:\*\*/.test(rCap.text) && /rotaci[oó]n bajo/.test(rCap.text));
ok("38 · límite honesto: el precio real de salida NO está en el dato",
  /precio real de salida/.test(rCap.text) && /descuento/.test(rCap.text));
ok("39 · el texto pasa su propia boleta (liberable total mandatory + por SKU computed)",
  (() => { const b = (rCap.evidence && rCap.evidence.boleta) || []; return guardAgainstBoleta(rCap.text, b).ok && b.some((f) => f.mandatory && /Liberable · total/.test(f.label)); })());
ok("40 · simulate sin forma reconocible → repregunta EDUCATIVA (enseña % y acción)",
  (() => { const r2 = sim({ operation: "simulate", metric: "margen", dimension: "cliente" }); return /simulate-shape/.test(r2.route) && /qu[eé] pasa si/i.test(r2.text) && /carga al target/.test(r2.text); })());

// ── 10 · S3 · recommend META-AWARE (la red goal ya no descarta el %) ─────────────────────────────────
const rG = sim({ operation: "recommend", metric: "ventas", dimension: "cliente", goal: { pct: 3, dir: "subir" } });
ok("41 · ancla la meta al dato ('Tu meta' + $ de la meta) y cierra con '¿Por cuál partimos?'",
  /\*\*Tu meta, anclada al dato:\*\*/.test(rG.text) && /¿Por cu[aá]l partimos\?/.test(rG.text));
ok("42 · caminos cuantificados NUMERADOS (1./2./…, owner 2026-07-15: 'las rutas con orden') con las líneas del diagnose VERBATIM",
  /^1\. \*\*/m.test(rG.text) && /^2\. \*\*/m.test(rG.text) && /•/.test(rG.text));
ok("43 · la meta viaja en boleta (mandatory · source computed · formula '× 3%')",
  (() => { const b = (rG.evidence && rG.evidence.boleta) || []; return b.some((f) => f.mandatory && /Meta · /.test(f.label) && f.source === "computed" && /× 3%/.test(f.formula || "")); })());
ok("44 · el texto meta-aware pasa su propia boleta + graduación (la causa abierta se declara)",
  guardAgainstBoleta(rG.text, (rG.evidence && rG.evidence.boleta) || []).ok && /causa ra[ií]z/.test(rG.text));
const rNoG = sim({ operation: "recommend", metric: "margen", dimension: "cliente" });
ok("45 · sin goal → el recommend clásico INTACTO (Recomendación + trade-off · cero cambio)",
  /\*\*Recomendaci[oó]n:\*\*/.test(rNoG.text) && /\*\*Trade-off/.test(rNoG.text) && !/Tu meta/.test(rNoG.text));

console.log(`\n── simulate-gate: ${pass} PASS · ${fail} FAIL ──`);
process.exit(fail ? 1 : 0);
