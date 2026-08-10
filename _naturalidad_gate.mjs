/* === _naturalidad_gate.mjs · GATE de NATURALIDAD de la continuidad (owner 2026-07-27) ===
 * El owner, probando en vivo: "le falta naturalidad en la continuidad… se siente como que inventa algo". Diagnóstico
 * por pipeline real (4 defectos). Este gate LOCKEA los 4 casos por el camino determinístico (coerce + composer +
 * prompt estático), independiente del LLM:
 *   1 · DEFINICIÓN → composeDefine (glosario del negocio), NO la lectura numérica del hilo.
 *   2 · SÍ/NO ("¿ese N es rebate?") → responde NO directo + distingue brecha ≠ carga/rebate.
 *   3 · APERTURAS no formulaicas → el prompt del narrador prohíbe "Estamos hablando de…" y abre respondiendo el tipo.
 *   4 · SIN re-narración idéntica → una definición/sí-no es su propio composer (route "define"), NO re-narra la lectura;
 *       y no ROBA los re-lens legítimos ("de esos, ¿cuánto margen ceden?") ni las lecturas reales. */
import esbuild from "esbuild"; import { pathToFileURL } from "url"; import path from "path"; import fs from "fs";
const root = process.cwd(); const entry = path.join(root, `_nge.tmp${process.pid}.js`), out = path.join(root, `_ngb.tmp${process.pid}.mjs`);
fs.writeFileSync(entry, [
  'export { coerceSpec } from "./src/adi/coerceChain.js";',
  'export { answerConversational, composeDefine } from "./src/adi/conversation.js";',
  'export { shouldNarrate } from "./src/adi/llm/numberGuard.js";',
  'export { NARRATE_GENERAL, NARRATE_EXPLAIN, buildNarrateSystem } from "./src/adi/llm/narratePrompt.js";',
  'export { matchConcept, CONCEPT_DEFS } from "./src/adi/sentrix/glossary.js";',
].join("\n"));
await esbuild.build({ entryPoints: [entry], bundle: true, outfile: out, format: "esm", platform: "node", logLevel: "silent" });
const M = await import(pathToFileURL(out).href + "?t=" + Math.random());
try { fs.unlinkSync(entry); } catch {} try { fs.unlinkSync(out); } catch {}
const { coerceSpec: C, answerConversational: AC, composeDefine: CD, shouldNarrate: SN, NARRATE_GENERAL: NG, NARRATE_EXPLAIN: NE, matchConcept: MC, CONCEPT_DEFS: DEFS } = M;

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log("  ✓ " + n); } else { fail++; console.log("  ✗ " + n); } };
const base = () => ({ schemaVersion: 1, operation: "overview", metric: "ventas", dimension: "cliente" });
const co = (q, hasLast) => C(q, base(), !!hasLast);
// última evidencia sintética del hilo (una lectura de contribución no capturada · como el $4.9M del owner)
const lastContrib = { metrica: "contribucion", dimension: "cliente", entidad: null,
  entityList: { dimension: "cliente", entities: ["Falabella", "Lider", "Jumbo", "Sodimac", "Ripley"] }, boleta: [] };

console.log("── 1 · DEFINICIÓN rutea a composeDefine (glosario), NO a la lectura numérica ──");
for (const [q, slug] of [
  ["a qué te refieres con contribución no capturada", "no_capturada"],
  ["¿qué es la carga comercial?", "carga"],
  ["qué significa DOH", "doh"],
  ["explícame el concepto de benchmark", "benchmark"],
  ["¿qué es la rotación?", "rotacion"],
  ["a qué llamás margen de contribución", "margen"],
]) {
  const s = co(q, true);
  ok(`«${q.slice(0, 40)}» → turn_type define + concepto ${slug} (op limpia · no lectura)`,
    s.turn_type === "define" && s._define && s._define.concept === slug && !s.operation);
  const r = AC(s, { lastEvidence: lastContrib }, {});
  ok(`  → composeDefine: route define · DEFINE (contiene la definición del glosario) · no recita las cifras K/M del hilo`,
    r.route === "define" && /:/.test(r.text) && !/\$\s?\d[\d.,]*\s*[KMB]/i.test(r.text) && r.text.includes(DEFS[slug].def.slice(0, 30)));
}

console.log("\n── 2 · SÍ/NO de identidad: «¿ese N es rebate?» → NO directo + distinción (brecha ≠ rebate) ──");
for (const q of [
  "para entender ese 1.6 de Falabella, ¿es rebate?",
  "¿ese 1.6 es un rebate?",
  "eso es rebate?",
]) {
  const s = co(q, true);
  ok(`«${q.slice(0, 38)}» → define + yesno rebate`, s.turn_type === "define" && s._define && s._define.yesno === "rebate");
  const r = AC(s, { lastEvidence: lastContrib }, {});
  ok(`  → abre con NO + nombra contribución no capturada Y carga/rebate (distingue) · route define`,
    r.route === "define" && /^No[.\s,]/.test(r.text.trim()) && /contribuci[oó]n no capturada/i.test(r.text) && /carga comercial|rebate/i.test(r.text));
}
// el sí/no también con predicado carga
{ const s = co("¿eso es carga comercial?", true); ok("«¿eso es carga comercial?» → define + yesno carga", s.turn_type === "define" && s._define.yesno === "carga"); }
// la entidad del hilo/texto viaja al sí/no (personaliza)
{ const s = co("para entender ese 1.6 de Falabella, ¿es rebate?", true); ok("el sí/no captura la entidad del texto (Falabella)", s._define && s._define.entidad === "Falabella"); }

console.log("\n── 3 · APERTURAS no formulaicas · el prompt del narrador (estático) ──");
ok("NARRATE_GENERAL tiene APERTURA (abrir respondiendo el tipo de pregunta)", /APERTURA/.test(NG) && /RESPONDIENDO el tipo de pregunta/.test(NG));
ok("prohíbe 'Estamos hablando de…' / 'En el análisis que hice…' / prefijo de entidad roto", /Estamos hablando de/.test(NG) && /En el an[aá]lisis que hice/.test(NG) && /De Falabella y encontramos/.test(NG));
ok("cubre definición / sí-no / cuáles / seguimiento + variar el arranque", /SÍ\/NO/.test(NG) && /VARI[AÁ] el arranque/.test(NG) && /QU[EÉ] ES/.test(NG));
ok("NARRATE_EXPLAIN también retoma sin fórmula de arranque", /APERTURA/.test(NE) && /sin f[oó]rmula de arranque/.test(NE));

console.log("\n── 4 · SIN re-narración idéntica · define es verbatim y NO roba re-lens/lecturas legítimas ──");
ok("define es VERBATIM (shouldNarrate=false · kind meta → cero deriva, antídoto al 'inventa algo')",
  SN({ text: "x", route: "define", evidence: { followup: true, kind: "meta", boleta: [] } }) === false);
ok("la evidencia de define es followup:true → NO reemplaza la lectura viva del hilo (continuidad intacta)",
  (() => { const r = CD({ _define: { concept: "carga" } }, { last: null }); return r.evidence && r.evidence.followup === true && !r.evidence.metrica; })());
// NO roba el re-lens deíctico legítimo (regresión de continuidad · [[adi-pnl-regresion-continuidad]])
{ const s = co("de esos, ¿cuánto margen ceden?", true); ok("«de esos, ¿cuánto margen ceden?» SIGUE siendo re-lens (margin + _deictic · NO define)", s.turn_type !== "define" && s.operation === "margin" && s._deictic === true); }
// NO roba una lectura real que MENCIONA los conceptos
{ const s = co("dame los márgenes de contribución de estos clientes, y muestra lo no capturado al lado", true); ok("«dame los márgenes… lo no capturado al lado» es LECTURA (no define)", s.turn_type !== "define"); }
{ const s = co("qué es lo que más contribución me da", true); ok("«qué es lo que más contribución me da» es lectura (predicado, no definición)", s.turn_type !== "define"); }
{ const s = co("¿qué es el margen de Falabella?", false); ok("«¿qué es el margen de Falabella?» es lectura de la entidad (no definición abstracta)", s.turn_type !== "define"); }
{ const s = co("¿cuánta contribución no estoy capturando?", false); ok("«¿cuánta contribución no estoy capturando?» es la LECTURA (no define)", s.turn_type !== "define"); }
// matchConcept: prioridad de la frase larga (no_capturada antes que contribución)
ok("matchConcept prioriza 'contribución no capturada' sobre 'contribución'", MC("contribución no capturada") === "no_capturada" && MC("mi contribución total") === "contribucion");

console.log(`\n── _naturalidad_gate: PASS ${pass} · FAIL ${fail} (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
