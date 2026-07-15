/* === _conversation_gate.mjs · GATE del PARSE CONVERSACIONAL · nace con V1 · crece por fase ===
 * Prueba SIN key la fundación determinística: ruteo por turn_type · composers (recommendation/explain/meta/compare-v1) ·
 * modify/change recalculan por el seam · guards activos · desconocido-contextual NO cae mal a new_query · contexto chico.
 * La calidad de CLASIFICACIÓN del LLM #1 se valida en vivo (con key) — acá probamos que, dado el turn_type, ADI resuelve bien.
 * Secciones V2-V6 declaradas abajo como comentarios: SOLO se testea lo implementado (nada de tests pendientes en verde). */
import esbuild from "esbuild"; import { pathToFileURL } from "url"; import path from "path"; import fs from "fs";
const root = process.cwd(); const entry = path.join(root, "_cge.js"), out = path.join(root, "_cgb.mjs");
fs.writeFileSync(entry, [
  'export { answerConversational, resolveTurn, buildConversationContext, composeExplain, composeMeta, composeCompareNotYet, updateMemoria, extractOffer } from "./src/adi/conversation.js";',
  'export { coerceSpec } from "./src/adi/coerceChain.js";',
  'export { composeSpecSimulate } from "./src/adi/specRetrieval.js";',
  'export { guardAgainstBoleta } from "./src/adi/boleta.js";',
  'export { buildParseUserMessage } from "./src/adi/llm/contractMenu.js";',
  'export { buildNarrateSystem, NARRATE_EXPLAIN, NARRATE_RECOMMENDATION, NARRATE_SIMULATION, NARRATE_GENERAL } from "./src/adi/llm/narratePrompt.js";',
].join("\n"));
await esbuild.build({ entryPoints: [entry], bundle: true, outfile: out, format: "esm", platform: "node", logLevel: "silent" });
const M = await import(pathToFileURL(out).href + "?t=" + Math.random());
try { fs.unlinkSync(entry); } catch {} try { fs.unlinkSync(out); } catch {}
const { answerConversational: AC, resolveTurn, buildConversationContext: BCC, composeExplain, composeMeta, composeCompareNotYet, composeSpecSimulate, guardAgainstBoleta, updateMemoria: UM, coerceSpec: CS } = M;
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
ok("8 · compare sin target ni sujeto (last general) → repregunta CRISP '¿qué dos clientes?' (no _needLast genérico)",
  (() => { const r = AC(S({ turn_type: "followup_compare" }), { lastEvidence: LAST }, {}); return /qu[eé] dos clientes/i.test(r.text) && !/no tengo una lectura/i.test(r.text) && r.route === "clarification_needed"; })());
ok("9 · compare con target pero last general (sin sujeto) → repregunta CRISP con opciones concretas (no vaga)",
  (() => { const r = AC(S({ turn_type: "followup_compare", comparison: { dimension: "cliente", entities: ["Lider"] } }), { lastEvidence: LAST }, {}); return /comparar con Lider/i.test(r.text) && /u otro cliente|Puedo cruzar/i.test(r.text) && !/tienes algunos|podr[ií]amos hacer un an[aá]lisis/i.test(r.text) && r.route === "clarification_needed"; })());

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
// buildNarrateSystem = prompt del TIPO + universo DISPONIBLE appendeado (owner 2026-07-09: "que considere solo
// lo que le damos como disponible" — la boleta autoriza cifras, DISPONIBLE autoriza capacidades · en TODO prompt)
const _conDisp = (s, base) => s.startsWith(base) && /DISPONIBLE — todo lo que ADI puede analizar/.test(s);
ok("21 · narrate: explain → prompt EXPLAIN (simple) + DISPONIBLE", _conDisp(BNS({ followup: true, kind: "explain" }), NARRATE_EXPLAIN));
ok("22 · narrate: meta/compare → GENERAL (fiel, no distorsiona) + DISPONIBLE", _conDisp(BNS({ followup: true, kind: "meta" }), NARRATE_GENERAL) && _conDisp(BNS({ followup: true, kind: "compare_pending" }), NARRATE_GENERAL));
ok("23 · narrate: recommendation → RECOMENDACIÓN · simulación → SIMULACIÓN (ambos + DISPONIBLE)", _conDisp(BNS({ followup: true, transform: {} }), NARRATE_RECOMMENDATION) && _conDisp(BNS({ transform: {} }), NARRATE_SIMULATION));

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

// ══ D · CONTINUIDAD del "por qué": explain sigue el ÚLTIMO foco (capital), NO re-diagnostica (owner 2026-07-06) ══
const LAST_INV = { inventory: { total: 33200, byBodega: [{ bodega: "Valparaíso", usd: 24800, pct: 75 }], bySku: [{ sku: "LG-DRYER8KG", usd: 13600, doh: 165, rotacion: 1, critico: true }, { sku: "BOS-SANDER", usd: 11200, doh: 115, rotacion: 1.6, critico: false }] } };
ok("31 · D · explain sobre foco INVENTARIO → explica CAPITAL (rotación/DOH · góndola), NO margen · route followup_explain · boleta self-consistente",
  (() => { const r = AC(S({ turn_type: "followup_explain" }), { lastEvidence: LAST_INV }, {}); return r.route === "followup_explain" && /rotaci|DOH|dejaron de rotar|sin salida|g[oó]ndola|capital/i.test(r.text) && !/contribuci[oó]n no capturada|carga comercial/i.test(r.text) && guardAgainstBoleta(r.text, r.evidence.boleta).ok; })());

const LAST_DIAG_EV = { findings: [{ detector: "margen", titulo: "Contribución no capturada", subtotal_usd: 4900000, items: [{ entidad: "Falabella", usd: 1600000 }] }, { detector: "capital", titulo: "Capital detenido", subtotal_usd: 33200, items: [{ entidad: "LG-DRYER8KG", usd: 13600 }] }] };
ok("32 · D · explain tras DIAGNÓSTICO → explica el FOCO TOP (contribución/Falabella/benchmark), NO relleno genérico · boleta self-consistente",
  (() => { const r = AC(S({ turn_type: "followup_explain" }), { lastEvidence: LAST_DIAG_EV }, {}); return r.route === "followup_explain" && /contribuci[oó]n no capturada|benchmark|Falabella/i.test(r.text) && !/lectura directa del dato real/i.test(r.text) && guardAgainstBoleta(r.text, r.evidence.boleta).ok; })());

// ══ CONTINUIDAD DE LA OFERTA (owner 2026-07-15 · "respondo SI y luego se pierde"): el "sí" ejecuta el CIERRE de ADI ══
const LAST_DIVE_SKU = { entidad: "PHI-SHAVER9", entityType: "sku", dimension: "sku", lens: "cuadro" };
ok("33 · ACEPTACIÓN de la oferta narrada tras un DIVE: 'sí' a «¿análisis de los costos?» → el porqué del SKU (costo/margen/carga), NO el clarify genérico",
  (() => { const r = AC(S({ turn_type: "followup_accept" }), { lastEvidence: LAST_DIVE_SKU, lastOffer: "¿Te parece que sería útil empezar con el análisis de los costos?" }, {}); return exec(r) && /PHI-SHAVER9/.test(r.text) && /[Cc]osto/.test(r.text) && r.route !== "clarification_needed"; })());
ok("34 · oferta de cierre INÚTIL ('¿Cómo lo ves?') tras un dive → red del porqué de la entidad (nunca 'Dale — ¿seguimos…?')",
  (() => { const r = AC(S({ turn_type: "followup_accept" }), { lastEvidence: LAST_DIVE_SKU, lastOffer: "¿Cómo lo ves?" }, {}); return exec(r) && /PHI-SHAVER9/.test(r.text) && r.route !== "clarification_needed"; })());
ok("35 · 'sí' tras dive de CLIENTE sin oferta ni sugerencias → el porqué graduado de esa cuenta",
  (() => { const r = AC(S({ turn_type: "followup_accept" }), { lastEvidence: { entidad: "Falabella", entityType: "cliente", dimension: "cliente" } }, {}); return exec(r) && /Falabella/.test(r.text) && r.route !== "clarification_needed"; })());
ok("36 · la oferta corre por la red del piso: 'sí' a «¿Te sirve ver qué SKU libero primero?» → inventario ejecutado (no clarify)",
  (() => { const r = AC(S({ turn_type: "followup_accept" }), { lastEvidence: LAST_DIAG_EV, lastOffer: "¿Te sirve ver qué SKU libero primero?" }, {}); return exec(r) && /SKU|capital/i.test(r.text) && r.route !== "clarification_needed"; })());
ok("37 · digest del LLM #1: la OFERTA de cierre del turno de ADI viaja explícita (el gist trunca el arranque del texto)",
  (() => { const c = BCC([{ role: "user", text: "Profundiza en PHI-SHAVER9" }, { role: "adi", text: "Mucho texto de análisis…\n\n¿Te parece que sería útil empezar con el análisis de los costos?", route: "qi_retrieval" }], null, null); const a = c.turns.find((t) => t.role === "adi"); return a && a.offer === "¿Te parece que sería útil empezar con el análisis de los costos?"; })());
ok("38 · sin hilo reconocible NI oferta → el clarify amable sigue siendo la ÚLTIMA red (no rompe)",
  (() => { const r = AC(S({ turn_type: "followup_accept" }), { lastEvidence: { foo: 1 } }, {}); return r.route === "clarification_needed" && /seguimos con lo último/i.test(r.text); })());

// ══ LA BOLETA DE MEMORIA (owner 2026-07-15: "última entidad + última pregunta/oferta + última evidencia + próxima
// acción — eso basta para que 'sí', 'dale', 'compáralo', 'por qué' o 'muéstrame más' tengan sentido") ══
const R_DIVE = { route: "qi_retrieval", text: "PHI-SHAVER9 rinde 28%. ¿Querés que abra el análisis de costos?", suggestions: null, evidence: { entidad: "PHI-SHAVER9", entityType: "sku", dimension: "sku", metrica: "margen" } };
const R_GLOBAL = { route: "qi_retrieval", text: "Diagnóstico: 3 focos.", suggestions: ["Por qué Falabella cede margen", "El capital detenido en detalle"], evidence: { metrica: "diagnose", dimension: "cliente", findings: [] } };
const MEM1 = UM(null, R_DIVE);
ok("39 · updateMemoria arma la boleta: entidad {nombre,eje} + oferta de cierre + tema",
  MEM1.entidad && MEM1.entidad.nombre === "PHI-SHAVER9" && MEM1.entidad.eje === "sku" && MEM1.oferta === "¿Querés que abra el análisis de costos?" && MEM1.tema && MEM1.tema.dimension === "sku");
const MEM2 = UM(MEM1, R_GLOBAL);
ok("40 · la ENTIDAD PERSISTE tras un turno global; la oferta/próxima acción se REEMPLAZAN (el 'sí' refiere al último cierre)",
  MEM2.entidad && MEM2.entidad.nombre === "PHI-SHAVER9" && MEM2.oferta === null && MEM2.proximaAccion === "Por qué Falabella cede margen" && MEM2.tema.dimension === "cliente");
ok("41 · una CLARIFICACIÓN no deja oferta (el 'sí' no acepta una repregunta) y no borra la entidad",
  (() => { const m = UM(MEM1, { route: "clarification_needed", text: "¿Podés precisar? ¿Contra qué SKU?", suggestions: null }); return m.oferta === null && m.entidad && m.entidad.nombre === "PHI-SHAVER9"; })());
ok("42 · claims de CONTINUAR: 'muéstrame más' / 'seguí' / 'continuá' / 'dale' → followup_accept (con hilo · mensaje entero)",
  ["muéstrame más", "mostrame más", "seguí", "continuá", "dale", "ver más"].every((q) => CS(q, S({ operation: "clarification_needed" }), true, null).turn_type === "followup_accept")
  && CS("ver más ventas de Lider", S({ operation: "clarification_needed" }), true, null).turn_type !== "followup_accept");
ok("43 · 'sí' SIN lastEvidence pero con memoria (paréntesis largo) → ejecuta la oferta sobre la entidad en foco",
  (() => { const r = AC(S({ turn_type: "followup_accept" }), { lastEvidence: null, memoria: MEM1 }, {}); return exec(r) && /PHI-SHAVER9/.test(r.text) && r.route !== "clarification_needed"; })());
ok("44 · 'compáralo con SAM-TV55' tras un paréntesis (sujeto SOLO en la memoria) → compara PHI-SHAVER9 vs SAM-TV55",
  (() => { const r = AC(S({ turn_type: "followup_compare", comparison: { entities: ["SAM-TV55"] } }), { lastEvidence: null, memoria: MEM2 }, {}); return exec(r) && /PHI-SHAVER9/.test(r.text) && /SAM-TV55/.test(r.text); })());
ok("45 · 'por qué' tras un DIVE → el porqué GRADUADO de la entidad (mecanismo), no el relleno genérico",
  (() => { const r = AC(S({ turn_type: "followup_explain" }), { lastEvidence: R_DIVE.evidence, memoria: MEM1 }, {}); return exec(r) && /PHI-SHAVER9/.test(r.text) && /Mecanismo|mecanismo/.test(r.text) && !/lectura directa del dato real/i.test(r.text); })());
ok("46 · el digest del LLM #1 lleva la memoria (BCC 4º arg) y buildParseUserMessage la serializa",
  (() => { const c = BCC([], null, null, MEM1); if (!c.memoria || c.memoria.entidad.nombre !== "PHI-SHAVER9") return false; const msg = BPUM(c, "si"); return /"memoria"/.test(msg) && /PHI-SHAVER9/.test(msg); })());

// ══ REVIEW ADVERSARIAL 2026-07-15 (24 agentes · 2 jueces c/u) — las reglas que salieron del panel ══
ok("47 · 'por qué' tras un turno GLOBAL no hereda la entidad VIEJA de la memoria (la lectura global se explica sola, honesto)",
  (() => { const r = AC(S({ turn_type: "followup_explain" }), { lastEvidence: { metrica: "ventas", dimension: "cliente", lens: "cuadro" }, memoria: MEM1 }, {}); return exec(r) && !/PHI-SHAVER9/.test(r.text); })());
ok("48 · 'sí' tras un turno global ejecuta LA OFERTA DE ESE TURNO con su alcance — no la reescribe hacia la entidad vieja",
  (() => { const r = AC(S({ turn_type: "followup_accept" }), { lastEvidence: R_GLOBAL.evidence, memoria: MEM2 }, {}); return exec(r) && !/PHI-SHAVER9/.test(r.text) && r.route !== "clarification_needed"; })());
ok("49 · COHESIÓN nombre+eje: 'compáralo con SAM-TV55' con last=overview de bodega y sujeto en memoria (SKU) → compara en el eje de la MEMORIA",
  (() => { const r = AC(S({ turn_type: "followup_compare", comparison: { entities: ["SAM-TV55"] } }), { lastEvidence: { metrica: "capital", dimension: "bodega" }, memoria: MEM1 }, {}); return exec(r) && /PHI-SHAVER9/.test(r.text) && /SAM-TV55/.test(r.text) && !/no tengo a PHI-SHAVER9/i.test(r.text); })());
ok("50 · 'sí' repetido ESCALA (dive → why → recommend): tras un why ya dado de la misma entidad, el siguiente sí recomienda (no repite)",
  (() => { const memWhy = { ...MEM1, oferta: null, sugerencias: null, proximaAccion: null, ruta: "why_mechanism" }; const r = AC(S({ turn_type: "followup_accept" }), { lastEvidence: { entidad: "PHI-SHAVER9", entityType: "sku", dimension: "sku" }, memoria: memWhy }, {}); return exec(r) && r.route !== "why_mechanism" && /PHI-SHAVER9|recomend|acci[oó]n|medida/i.test(r.text); })());
ok("51 · 'muéstrame más' NO pisa una traducción RESUELTA del LLM #1 (op concreta sobrevive; el piso sin resolver sí reclama)",
  CS("muéstrame más", S({ operation: "rank", metric: "ventas", dimension: "cliente", sort: { by: "ventas", dir: "desc" }, limit: 10 }), true, null).turn_type !== "followup_accept"
  && CS("muéstrame más", S({ operation: "clarification_needed" }), true, null).turn_type === "followup_accept");

// ══ V3 · multi_analysis (evidences[]) — PENDIENTE ══
// ══ V4 · recall_analysis (ctx.history) — PENDIENTE ══
// ══ V5 · session_resume / apply_criteria (ctx.session/criteria · con permiso) — PENDIENTE ══
// ══ V6 · conversación libre controlada — PENDIENTE ══

console.log(`\n── _conversation_gate (V1): ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
