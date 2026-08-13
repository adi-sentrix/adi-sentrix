/* === _glosario_cobertura_gate.mjs · ADI NO EMITE TÉRMINO QUE NO SABE DEFINIR (Paso 2 · owner 2026-08-13) ========
 *
 * EL DEFECTO QUE CIERRA, medido en producción. El usuario preguntó «las cuentas que estan bajo benchmark, que
 * eso?» y el PLAN emitió defineConcept con `bajo_benchmark` — un TOKEN interno con guion bajo, no las palabras del
 * usuario. resolveGlossary('bajo_benchmark') → null, la tool declinó, y la excusa interna («no tengo una
 * definición curada para 'bajo_benchmark'») salió VERBATIM a pantalla: el usuario leyó código. Doble falla: una
 * definición que EXISTÍA se perdió por un guion bajo, y un identificador interno llegó a superficie.
 *
 * QUÉ CERTIFICA, en el orden en que importa:
 *   [1] ROUND-TRIP DEL CATÁLOGO      cada slug, aka y etiqueta declarada en CONCEPT_DEFS resuelve a SU propio
 *                                    concepto — ninguna etiqueta apunta al vecino ni cae en null.
 *   [2] LAS ETIQUETAS VISIBLES       toda etiqueta del manifiesto de vistas, del registro de métricas y del «i»
 *                                    de las cards resuelve a una entrada (la escalera del glosario), y la lista
 *                                    de huérfanas DERIVADA de los contratos está vacía.
 *   [3] LA ESCALERA DE defineConcept el token sucio del caso real resuelve por «_»→« » (peldaño b), la frase del
 *                                    usuario inyectada resuelve cuando el concept es irrecuperable (peldaño c),
 *                                    y el orden de los peldaños es el declarado (el concept del plan gana).
 *   [4] REGRESIÓN DEL CASO DEL OWNER de punta a punta offline por el ejecutor: token sucio + pregunta inyectada →
 *                                    supported:true con la definición de benchmark en facts.
 *   [5] NINGUNA EXCUSA INTERNA       lo REALMENTE desconocido sigue declinando honesto, y su reason cita palabras
 *                                    de usuario: jamás /\w_\w/, jamás un nombre de tool del catálogo, jamás el
 *                                    vocabulario del contrato interno.
 *
 * DEUDA PREEXISTENTE: ninguna. El barrido del 2026-08-13 (Paso 2) midió round-trip y etiquetas visibles con CERO
 * desvíos y CERO nulls — este gate afirma cobertura PLENA porque la cobertura plena existe, no por optimismo.
 *
 * Puro/offline: importa el glosario, los contratos de vocabulario y el ejecutor determinístico. No nombra ni
 * importa los símbolos que hablan con un proveedor — cero crédito. Correr por `npm run gates:offline`.
 */
import { CONCEPT_DEFS, METRIC_DEFS, resolveGlossary, vocabularioSinConcepto } from "./src/adi/sentrix/glossary.js";
import { VIEW_MANIFEST } from "./src/adi/sentrix/viewManifest.js";
import { METRICS } from "./src/config/contract/metricRegistry.js";
import { runPlan } from "./src/adi/oracle/toolRunner.js";
import { toolNames } from "./src/adi/oracle/toolRegistry.js";

let pass = 0, fail = 0; const rotos = [];
const ok = (nombre, cond, detalle = "") => { if (cond) pass++; else { fail++; rotos.push(`${nombre}${detalle ? ` → ${detalle}` : ""}`); } };

const PREGUNTA_OWNER = "las cuentas que estan bajo benchmark, que eso?";
const _define = (concept, preguntaUsuario) =>
  runPlan({ intent: "define", calls: [{ tool: "defineConcept", args: { concept } }] },
    { scenario: "actual", ...(preguntaUsuario ? { preguntaUsuario } : {}) }).results[0];

// ── [1] ROUND-TRIP · cada nombre declarado vuelve a su propio concepto ───────────────────────────────────────
for (const [slug, c] of Object.entries(CONCEPT_DEFS)) {
  for (const nombre of [slug, c.aka, ...(c.etiquetas || [])]) {
    const r = resolveGlossary(nombre);
    ok(`[1] «${nombre}» → ${slug}`, r && r.slug === slug, r ? `dio ${r.slug} (fuente ${r.fuente})` : "null");
  }
}

// ── [2] LAS ETIQUETAS VISIBLES · lo que se ve en pantalla se sabe definir ────────────────────────────────────
for (const [id, m] of Object.entries(VIEW_MANIFEST)) {
  if (!m.label) continue;
  ok(`[2] manifiesto · «${m.label}» (${id}) responde`, !!resolveGlossary(m.label));
}
for (const [k, m] of Object.entries(METRICS)) ok(`[2] registro · label de ${k} («${m.label}») responde`, !!resolveGlossary(m.label));
for (const label of Object.keys(METRIC_DEFS)) ok(`[2] «i» de card · «${label}» responde`, !!resolveGlossary(label));
{
  const h = vocabularioSinConcepto();
  for (const [familia, lista] of Object.entries(h))
    ok(`[2] huérfanas derivadas · ${familia} vacía`, Array.isArray(lista) && lista.length === 0, lista.join(" | "));
}

// ── [3] LA ESCALERA DE defineConcept · los términos del caso real, peldaño por peldaño ───────────────────────
for (const t of ["bajo benchmark", "brecha", "benchmark", "vs benchmark"]) {
  const r = resolveGlossary(t);
  ok(`[3] «${t}» resuelve en el glosario`, !!r, "null");
}
ok("[3] el token crudo sigue null EN EL GLOSARIO (la tolerancia vive en la tool, no se ensució el catálogo)",
  resolveGlossary("bajo_benchmark") === null);
{
  const r = _define("bajo_benchmark");   // peldaño (b): «_»→« », SIN pregunta
  ok("[3] peldaño (b) · defineConcept('bajo_benchmark') sin pregunta → supported:true", r.coverage && r.coverage.supported === true, JSON.stringify(r.coverage));
  ok("[3] peldaño (b) · y es LA definición de benchmark", r.facts && r.facts.definicion === CONCEPT_DEFS.benchmark.def);
}
{
  const r = _define("un_token_irrecuperable", PREGUNTA_OWNER);   // peldaño (c): la frase del usuario
  ok("[3] peldaño (c) · concept irrecuperable + pregunta del turno → resuelve por la FRASE", r.coverage && r.coverage.supported === true);
  const sin = _define("un_token_irrecuperable");
  ok("[3] peldaño (c) · control: sin la pregunta, declina (la frase era la señal)", sin.coverage && sin.coverage.supported === false);
}
{
  const r = _define("margen bruto", "qué es la carga comercial?");   // el orden: la señal específica gana
  ok("[3] orden · un concept válido GANA a la pregunta (margen bruto, no carga)", r.facts && r.facts.definicion === CONCEPT_DEFS.margen_bruto.def);
}

// ── [4] REGRESIÓN DEL CASO DEL OWNER · de punta a punta por el ejecutor, offline ─────────────────────────────
{
  const r = _define("bajo_benchmark", PREGUNTA_OWNER);
  ok("[4] el caso real · token sucio + pregunta inyectada → supported:true", r.coverage && r.coverage.supported === true, JSON.stringify(r.coverage));
  ok("[4] el caso real · la definición de benchmark viaja en facts", r.facts && r.facts.definicion === CONCEPT_DEFS.benchmark.def);
  ok("[4] el caso real · como definición declarada (es_definicion)", r.facts && r.facts.es_definicion === true);
}

// ── [5] NINGUNA EXCUSA INTERNA A PANTALLA · el reason del desconocido habla en palabras de usuario ───────────
{
  const r = _define("flujo_de_caja_proyectado", "qué es el flujo de caja proyectado?");
  ok("[5] un desconocido REAL sigue declinando (no hay fuzzy ni invento)", r.coverage && r.coverage.supported === false);
  const reason = (r.coverage && r.coverage.reason) || "";
  ok("[5] el reason NO contiene identificadores con guion bajo (/\\w_\\w/)", !/\w_\w/.test(reason), JSON.stringify(reason));
  ok("[5] el reason cita el término en PALABRAS", /flujo de caja proyectado/.test(reason), JSON.stringify(reason));
  ok("[5] el reason no dice «coverage» ni vocabulario del contrato interno", !/coverage|supported|args\b/i.test(reason));
  for (const t of toolNames()) ok(`[5] el reason no nombra la tool ${t}`, !reason.includes(t));
}
{
  const r = _define("");   // degenerado: ni concept ni pregunta
  ok("[5] sin concept ni pregunta → genérico limpio", r.coverage && r.coverage.supported === false && !/\w_\w/.test(r.coverage.reason || ""), JSON.stringify(r.coverage && r.coverage.reason));
}

console.log(`\nGLOSARIO·COBERTURA · ${pass} PASS · ${fail} FAIL · ${Object.keys(CONCEPT_DEFS).length} conceptos · ${Object.keys(VIEW_MANIFEST).length} piezas del manifiesto`);
if (rotos.length) { console.log("\nROTOS:"); for (const r of rotos) console.log("  ✗ " + r); }
process.exit(fail ? 1 : 0);
