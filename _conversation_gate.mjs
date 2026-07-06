/* === _conversation_gate.mjs · GATE del PARSE CONVERSACIONAL · nace con V1 · crece por fase ===
 * Prueba SIN key la fundación determinística: ruteo por turn_type · composers (recommendation/explain/meta/compare-v1) ·
 * modify/change recalculan por el seam · guards activos · desconocido-contextual NO cae mal a new_query · contexto chico.
 * La calidad de CLASIFICACIÓN del LLM #1 se valida en vivo (con key) — acá probamos que, dado el turn_type, ADI resuelve bien.
 * Secciones V2-V6 declaradas abajo como comentarios: SOLO se testea lo implementado (nada de tests pendientes en verde). */
import esbuild from "esbuild"; import { pathToFileURL } from "url"; import path from "path"; import fs from "fs";
const root = process.cwd(); const entry = path.join(root, "_cge.js"), out = path.join(root, "_cgb.mjs");
fs.writeFileSync(entry, [
  'export { answerConversational, resolveTurn, buildConversationContext, composeExplain, composeMeta, composeCompareNotYet } from "./src/adi/conversation.js";',
  'export { composeSpecSimulate } from "./src/adi/specRetrieval.js";',
  'export { guardAgainstBoleta } from "./src/adi/boleta.js";',
  'export { buildParseUserMessage } from "./src/adi/llm/contractMenu.js";',
  'export { buildNarrateSystem, NARRATE_EXPLAIN, NARRATE_RECOMMENDATION, NARRATE_SIMULATION, NARRATE_GENERAL } from "./src/adi/llm/narratePrompt.js";',
].join("\n"));
await esbuild.build({ entryPoints: [entry], bundle: true, outfile: out, format: "esm", platform: "node", logLevel: "silent" });
const M = await import(pathToFileURL(out).href + "?t=" + Math.random());
try { fs.unlinkSync(entry); } catch {} try { fs.unlinkSync(out); } catch {}
const { answerConversational: AC, resolveTurn, buildConversationContext: BCC, composeExplain, composeMeta, composeCompareNotYet, composeSpecSimulate, guardAgainstBoleta } = M;
const { buildParseUserMessage: BPUM, buildNarrateSystem: BNS, NARRATE_EXPLAIN, NARRATE_RECOMMENDATION, NARRATE_SIMULATION, NARRATE_GENERAL } = M;

let pass = 0, fail = 0; const ok = (n, c) => { if (c) { pass++; console.log("  ✓ " + n); } else { fail++; console.log("  ✗ " + n); } };
const S = (o) => ({ schemaVersion: 1, scenario: "actual", ...o });
const TF = (v) => ({ kind: "assumption", op: "delta", value: v, unit: "pct", base: "real" });
// última evidencia accionable = una simulación ventas@cliente +3% (completa · con concentración/estructura/boleta)
const LAST = composeSpecSimulate({ metric: "ventas", dimension: "cliente", filters: {}, transform: TF(3) }).evidence;
const exec = (r) => typeof r.text === "string" && r.text.length > 0 && typeof r.route === "string" && !r.route.startsWith("spec_blocked_");

// ── V1 · RUTEO por turn_type ─────────────────────────────────────────────────────────────────────────────────────
ok("1 · new_query → ejecuta por el seam", exec(AC(S({ turn_type: "new_query", operation: "rank", metric: "ventas", dimension: "cliente", sort: { by: "ventas", dir: "desc" }, limit: 3 }), {}, {})));
ok("2 · modify_assumption → RECALCULA por el seam (simula +5% · boleta fresca)",
  (() => { const r = AC(S({ turn_type: "followup_modify_assumption", operation: "table", metric: "ventas", dimension: "cliente", transform: TF(5) }), { lastEvidence: LAST }, {}); return exec(r) && r.evidence && r.evidence.transform && r.evidence.transform.value === 5 && Array.isArray(r.evidence.projection); })());
ok("3 · change_dimension → RECALCULA por el seam (ventas@marca +3%)",
  (() => { const r = AC(S({ turn_type: "followup_change_dimension", operation: "table", metric: "ventas", dimension: "marca", transform: TF(3) }), { lastEvidence: LAST }, {}); return exec(r) && r.evidence && r.evidence.dimension === "marca"; })());

// ── V1 · recommendation / explain / meta (narrativos · reusan la última evidencia · SHAPE finalizado `.text`) ──────
const rRec = AC(S({ turn_type: "followup_recommendation" }), { lastEvidence: LAST }, {});
ok("4 · recommendation → texto desde la última evidencia (no vacío · no NOT_YET)", typeof rRec.text === "string" && /No empujaría el \+3%/.test(rRec.text) && rRec.route === "followup_recommendation");
ok("5 · recommendation sin última evidencia → honesto (no rompe)", /no tengo una lectura reciente/i.test(AC(S({ turn_type: "followup_recommendation" }), {}, {}).text));
const rExp = AC(S({ turn_type: "followup_explain" }), { lastEvidence: LAST }, {});
ok("6 · explain → historia fluida (sin header) desde la estructura/concentración", /Lo digo porque/.test(rExp.text) && /81%/.test(rExp.text) && !/\*\*/.test(rExp.text));
const rMeta = AC(S({ turn_type: "meta_question", meta: "real_o_supuesto" }), { lastEvidence: LAST }, {});
ok("7 · meta real/supuesto → honesto ('es un supuesto…')", /supuesto/i.test(rMeta.text) && /dato real/i.test(rMeta.text) && rMeta.route === "meta_question");

// ── V1 · followup_compare repregunta ESPECÍFICO cuando falta sujeto/target (last general · sin adivinar) ───────────
ok("8 · compare sin target (last general) → repregunta por el target", /contra qu[eé] cliente/i.test(AC(S({ turn_type: "followup_compare" }), { lastEvidence: LAST }, {}).text));
ok("9 · compare con target pero last general (sin sujeto) → repregunta por el sujeto",
  (() => { const r = AC(S({ turn_type: "followup_compare", comparison: { dimension: "cliente", entities: ["Lider"] } }), { lastEvidence: LAST }, {}); return /qu[eé] cliente comparo con Lider/i.test(r.text) && r.route === "clarification_needed"; })());

// ── V1 · clarification + desconocido (Condición 1 del owner) ──────────────────────────────────────────────────────
ok("10 · clarification_needed → devuelve la repregunta", AC(S({ turn_type: "clarification_needed", clarify: "¿por cliente o por marca?" }), {}, {}).text === "¿por cliente o por marca?");
ok("11 · desconocido CONTEXTUAL (followup_xyz, spec incompleto) → clarifica (NO new_query)", resolveTurn("followup_xyz", S({}), { last: LAST }, {}).route === "clarification_needed");
ok("12 · desconocido AUTÓNOMO (spec completo) → new_query (ejecuta)", exec(resolveTurn("algo_futuro", S({ operation: "overview", metric: "margen", dimension: "cliente" }), {}, {})));

// ── V1 · GUARDS activos (ningún número entra por el LLM · self-consistencia) ──────────────────────────────────────
ok("13 · recommendation self-consistente con su boleta", guardAgainstBoleta(rRec.text, rRec.evidence.boleta).ok);
ok("14 · explain self-consistente con su boleta", guardAgainstBoleta(rExp.text, rExp.evidence.boleta).ok);
ok("15 · cifra por-entidad inventada en un narrativo → guard la BLOQUEA", !guardAgainstBoleta("El bloque suma $19.4M en Falabella y el 81% se concentra.", rRec.evidence.boleta).ok);

// ── V1 · CONTEXTO chico (3 turnos + última evidencia · digest, no boleta completa) ───────────────────────────────
const cc = BCC([{ role: "user", text: "a" }, { role: "adi", text: "b", route: "qi_retrieval" }, { role: "user", text: "c" }, { role: "adi", text: "d" }, { role: "user", text: "sube las ventas 3% por cliente" }], LAST);
ok("16 · contexto = últimos 3 turnos", cc.turns.length === 3);
ok("17 · last = digest (kind supuesto · transform · boletaDigest ≤6 · NO boleta completa)", cc.last.kind === "supuesto" && cc.last.transform && Array.isArray(cc.last.boletaDigest) && cc.last.boletaDigest.length <= 6 && cc.last.boletaDigest.length < (LAST.boleta || []).length);
ok("18 · campos de fases futuras reservados (history/session/criteria)", Array.isArray(cc.history) && cc.session === null && cc.criteria === null);

// ── V1 · incremento 2 · CONTEXTO viaja al LLM #1 (buildParseUserMessage) + narración por TIPO (buildNarrateSystem) ──
const um = BPUM(BCC([{ role: "user", text: "sube las ventas 3% por cliente" }], LAST), "dime qué hacemos");
ok("19 · buildParseUserMessage antepone el CONTEXTO + el mensaje", /CONTEXTO DE CONVERSACIÓN/.test(um) && /MENSAJE DEL USUARIO/.test(um) && /dime qué hacemos/.test(um) && /"kind":"supuesto"/.test(um));
ok("20 · sin contexto → solo el texto (turno aislado)", BPUM(null, "ventas por cliente") === "ventas por cliente" && BPUM({ turns: [], last: null }, "hola") === "hola");
ok("21 · narrate: explain → prompt EXPLAIN (simple)", BNS({ followup: true, kind: "explain" }) === NARRATE_EXPLAIN);
ok("22 · narrate: meta/compare → GENERAL (fiel, no distorsiona)", BNS({ followup: true, kind: "meta" }) === NARRATE_GENERAL && BNS({ followup: true, kind: "compare_pending" }) === NARRATE_GENERAL);
ok("23 · narrate: recommendation → RECOMENDACIÓN · simulación → SIMULACIÓN", BNS({ followup: true, transform: {} }) === NARRATE_RECOMMENDATION && BNS({ transform: {} }) === NARRATE_SIMULATION);

// ══ V2 · followup_compare — COMPARACIÓN CONVERSACIONAL REAL (sujeto del contexto · target del LLM · seam ejecuta) ══
const LAST_ENT = { entidad: "Falabella", entityType: "cliente", dimension: "cliente", metrica: "margen", lens: "cuadro" };  // última = foco sobre UNA cuenta
const LAST_DIAG = { findings: [{ detector: "margen", titulo: "Contribución no capturada", items: [{ entidad: "Falabella", usd: 1600000 }] }], dimension: "cliente", entityType: "cliente" };
ok("24 · V2 compare REAL: sujeto=Falabella (contexto) + target=Lider (LLM elíptico) → EJECUTA + boleta fresca",
  (() => { const r = AC(S({ turn_type: "followup_compare", comparison: { dimension: "cliente", entities: ["Lider"] } }), { lastEvidence: LAST_ENT }, {}); return exec(r) && /Falabella/.test(r.text) && /Lider/.test(r.text) && r.evidence && Array.isArray(r.evidence.boleta) && r.evidence.boleta.length > 0; })());
ok("25 · V2 compare tras DIAGNOSE: sujeto = foco principal (Falabella) + target Lider → EJECUTA",
  (() => { const r = AC(S({ turn_type: "followup_compare", comparison: { entities: ["Lider"] } }), { lastEvidence: LAST_DIAG }, {}); return exec(r) && /Falabella/.test(r.text) && /Lider/.test(r.text); })());
ok("26 · V2 dos entidades EXPLÍCITAS ('compará Falabella con Lider') sin contexto → EJECUTA",
  (() => { const r = AC(S({ turn_type: "followup_compare", comparison: { dimension: "cliente", entities: ["Falabella", "Lider"] } }), {}, {}); return exec(r) && /Falabella/.test(r.text) && /Lider/.test(r.text); })());
ok("27 · V2 contra 'el promedio' → repregunta honesta (NO placeholder · no finge)",
  (() => { const r = AC(S({ turn_type: "followup_compare", comparison: { entities: ["el promedio"] } }), { lastEvidence: LAST_ENT }, {}); return /promedio de cartera/i.test(r.text) && r.route === "clarification_needed"; })());
ok("28 · V2 cruza mundos (Samsung no es cliente) → degrade HONESTO (dice que no lo tiene · no fabrica comparación)",
  (() => { const r = AC(S({ turn_type: "followup_compare", comparison: { entities: ["Samsung"] } }), { lastEvidence: LAST_ENT }, {}); return /no tengo a Samsung|no pude comparar|est[aá]n bien escritos|no encontr|no est[aá]/i.test(r.text) && !/Samsung.*\$\d/.test(r.text); })());
ok("29 · V2 target = el propio sujeto → pide otra cuenta (no compara consigo mismo)",
  (() => { const r = AC(S({ turn_type: "followup_compare", comparison: { entities: ["Falabella"] } }), { lastEvidence: LAST_ENT }, {}); return /contra qu[eé] cliente/i.test(r.text) && r.route === "clarification_needed"; })());
ok("30 · V2 robustez: el LLM manda new_query + compare con 1 entidad → igual se resuelve como followup elíptico (EJECUTA)",
  (() => { const r = AC(S({ turn_type: "new_query", operation: "compare", metric: "margen", dimension: "cliente", comparison: { dimension: "cliente", entities: ["Lider"] } }), { lastEvidence: LAST_ENT }, {}); return exec(r) && /Falabella/.test(r.text) && /Lider/.test(r.text); })());

// ══ V3 · multi_analysis (evidences[]) — PENDIENTE ══
// ══ V4 · recall_analysis (ctx.history) — PENDIENTE ══
// ══ V5 · session_resume / apply_criteria (ctx.session/criteria · con permiso) — PENDIENTE ══
// ══ V6 · conversación libre controlada — PENDIENTE ══

console.log(`\n── _conversation_gate (V1): ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
