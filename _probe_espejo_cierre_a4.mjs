/* === _probe_espejo_cierre_a4.mjs · ARREGLO 4 del cierre del espejo Anthropic (2026-08-13) =====================
 * Hallazgo 4: el narrador de Sonnet dijo «tu propia vara» ×4 en el espejo (E3/F1/F3) — palabra PROHIBIDA en
 * superficie (CLAUDE.md §4, registro ejecutivo). Verifica el barrido de voiceGuard y sus tres cuidados:
 *   [1] las tres formas se barren: «tu (propia )?vara»→«tu referencia» · «la vara»→«la referencia» ·
 *       «vara declarada»→«referencia declarada» — con la frase REAL del espejo;
 *   [2] number-safe e idempotente, mayúscula preservada, «varado/varada» (SKU encallado) intacto;
 *   [3] el CONCEPTO `vara` del glosario queda INTACTO (slug/aka/etiquetas/def) y defineConcept lo sigue
 *       sirviendo — el barrido es del texto narrado, jamás del catálogo;
 *   [4] el eco del usuario en la NARRACIÓN se barre igual (registro manda; su palabra en la pregunta no se toca
 *       porque la pregunta no pasa por el barrido).
 * 100% OFFLINE · cero red, cero LLM:  node --import ./scripts/offline-guard.mjs _probe_espejo_cierre_a4.mjs */
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { stripLanguageLeaks } from "./src/adi/llm/voiceGuard.js";
import { CONCEPT_DEFS, resolveGlossary } from "./src/adi/sentrix/glossary.js";
import { runPlan } from "./src/adi/oracle/toolRunner.js";

initTenant(TENANT_DEMO);

let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ " + m + (extra ? "\n      " + String(extra).slice(0, 240) : "")); } };
const H = (t) => console.log("\n" + t);
const S = stripLanguageLeaks;

H("[1] LAS TRES FORMAS SE BARREN — con la frase real del espejo");
{
  const e3 = "Tu margen de cartera cierra en 25.1% — por debajo de tu propia vara, que es la que manda: tu benchmark de 30.1%.";
  const out = S(e3);
  ok(/por debajo de tu referencia, que es la que manda/.test(out), "«tu propia vara» (E3 literal) → «tu referencia»", out);
  ok(!/\bvara\b/i.test(out), "…y no queda ninguna «vara» en la salida", out);
  ok(/25\.1%/.test(out) && /30\.1%/.test(out), "…con las cifras intactas (number-safe)", out);
  ok(/Lo que sí puedo darte es tu referencia: tu negocio/.test(S("Lo que sí puedo darte es tu propia vara: tu negocio tiene un benchmark declarado de 30.1%.")),
    "la variante de F1 también se barre");
  ok(S("mide contra tu vara de margen") === "mide contra tu referencia de margen", "«tu vara» sin «propia» → «tu referencia»");
  ok(S("La vara la define el negocio.") === "La referencia la define el negocio.", "«La vara» → «La referencia» (mayúscula preservada)");
  ok(S("es una vara declarada, no un promedio") === "es una referencia declarada, no un promedio", "«vara declarada» → «referencia declarada»");
}

H("[2] NUMBER-SAFE · IDEMPOTENTE · SIN FALSOS POSITIVOS");
{
  const t = "Tu referencia de margen es 30.1% y la vara nueva quedó en 28%.";
  const una = S(t), dos = S(una);
  ok(una === dos, "idempotente: aplicarlo dos veces da lo mismo", una);
  ok(/30\.1%/.test(una) && /28%/.test(una), "las cifras no se tocan", una);
  const varado = "LG-DRYER8KG está varado hace 94 días en Valparaíso.";
  ok(S(varado) === varado, "«varado» (encallado) NO matchea — el \\b protege la palabra distinta", S(varado));
  const varas = "esa vara ajena";   // fuera de las tres formas enumeradas: se deja (red angosta a propósito)
  ok(S(varas) === varas, "una forma NO enumerada no se toca (falso negativo antes que falso positivo)");
}

H("[3] EL CONCEPTO DEL GLOSARIO, INTACTO");
{
  const v = CONCEPT_DEFS.vara;
  ok(!!v && v.aka === "la vara", "el slug `vara` existe con su aka de siempre", JSON.stringify(v && v.aka));
  ok(Array.isArray(v.etiquetas) && v.etiquetas.includes("vara") && v.etiquetas.includes("tu vara") && v.etiquetas.includes("vara declarada"),
    "las etiquetas del concepto siguen enteras (el catálogo no se barre)", JSON.stringify(v && v.etiquetas));
  const r = resolveGlossary("vara");
  ok(r && r.slug === "vara" && typeof r.def === "string" && r.def.length > 40, "resolveGlossary(«vara») sigue sirviendo su definición", r && r.slug);
  ok(!/\bvara\b/i.test(v.def), "la DEFINICIÓN curada no contiene la palabra (verificado, no asumido)");
  // el `distingue` SÍ la contiene («la vara es la referencia que tú declaraste») — decisión de producto ANOTADA
  // en _INFORME_ESPEJO_CIERRE.md, NO tocada acá: texto curado del catálogo, fuera del barrido por diseño.
  const { results } = runPlan({ intent: "define", calls: [{ tool: "defineConcept", args: { concept: "vara" } }] }, { scenario: "actual", maxCalls: 2 });
  const f = results && results[0] && results[0].facts;
  ok(!!f && results[0].coverage && results[0].coverage.supported === true && typeof f.definicion === "string" && f.definicion.length > 40,
    "defineConcept(«vara») sigue sirviendo la definición por su ruta verbatim", JSON.stringify(f && f.definicion ? f.definicion.slice(0, 80) : f));
}

H("[4] EL ECO DEL USUARIO EN LA NARRACIÓN SE BARRE IGUAL — el registro manda");
{
  const eco = "Me preguntas por la vara: tu referencia de margen declarada es 28%.";
  ok(/Me preguntas por la referencia/.test(S(eco)), "la narración que repite la palabra del usuario también sale barrida", S(eco));
}

console.log(`\n── PROBE A4 · «vara» jamás en superficie · ${PASS} PASS · ${FAIL} FAIL ──`);
process.exitCode = FAIL ? 1 : 0;
