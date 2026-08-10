/* === _plan_cache_gate.mjs · EL COSTO FIJO DE PLAN · SEGMENTACIÓN DEL CONTRATO (owner 2026-08-10) ==============
 *
 * DE DÓNDE SALE. La certificación live midió las 9 llamadas de PLAN: 8.880–8.891 tokens de entrada cada una, con
 * una variación TOTAL de 11 tokens entre las nueve preguntas. O sea que la pregunta del usuario no pesa nada y
 * ~77.000 de los 105.699 tokens de entrada de la corrida son el MISMO texto repetido nueve veces.
 *
 * QUÉ CERTIFICA, y el primero es el que importa:
 *   [1] NO SE RECORTÓ NADA. `fijo + variable` es BYTE POR BYTE lo que devuelve `buildPlanSystem`, en las cuatro
 *       combinaciones de memoria y contexto de pantalla. La orden del owner fue explícita: no se recorta ni una
 *       regla de negocio ni se reduce la capacidad de interpretar. Este chequeo es el que lo prueba.
 *   [2] EL CORTE ESTÁ DONDE TERMINA LO ESTABLE. El segmento fijo es IDÉNTICO con y sin memoria, con y sin
 *       pantalla, y con cualquier escenario — que es la condición para que un caché de prefijo pegue.
 *   [3] EL CATÁLOGO COMPLETO SIGUE ADENTRO. Las 20 tools y las dos doctrinas viajan en el segmento fijo: la
 *       segmentación mueve el corte, no adelgaza el contrato.
 *   [4] EL DESGLOSE MEDIDO, impreso para que el ahorro sea verificable y no una promesa.
 *   [5] EL ADAPTER PONE EL CORTE DONDE SE LE DICE, y con un string se comporta byte-idéntico al de siempre.
 *
 * CERO RED · CERO LLM · CERO CRÉDITOS.
 */
import { buildPlanSystem, buildPlanSystemSegments, buildPlanUserMessage, PLAN_TOOL, TOOL_CATALOG, DOCTRINA_CONTEXTO_VISTA } from "./src/adi/oracle/planPrompt.js";
import { ADI_PERSONA_PLAN, renderInteractionMemory } from "./src/adi/oracle/persona.js";

let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };
const H = (t) => console.log("\n" + t);
const tok = (n) => Math.round(n / 4);

const MEM_VACIA = renderInteractionMemory(null);
const MEM_LLENA = renderInteractionMemory({ nombre: "jc", cargo: "CEO", empresa: "ADI", trato: "tu", prioridad: "financiero" });
// las cuatro combinaciones reales: memoria sí/no × contexto de pantalla sí/no, en dos escenarios distintos.
const CASOS = [
  { n: "sin memoria · sin pantalla · actual", mem: MEM_VACIA, sc: "actual", vista: false },
  { n: "CON memoria · sin pantalla · actual", mem: MEM_LLENA, sc: "actual", vista: false },
  { n: "sin memoria · CON pantalla · actual", mem: MEM_VACIA, sc: "actual", vista: true },
  { n: "CON memoria · CON pantalla · bonanza", mem: MEM_LLENA, sc: "bonanza", vista: true },
];

H("[1] NO SE RECORTÓ NADA · `fijo + variable` es byte por byte el prompt de siempre");
for (const c of CASOS) {
  const completo = buildPlanSystem(ADI_PERSONA_PLAN, c.mem, c.sc, c.vista);
  const { fijo, variable } = buildPlanSystemSegments(ADI_PERSONA_PLAN, c.mem, c.sc, c.vista);
  ok(fijo + variable === completo, `${c.n} — reconstruye el prompt exacto (${completo.length} chars)`,
    `fijo=${fijo.length} + variable=${variable.length} = ${fijo.length + variable.length}`);
}

H("[2] EL CORTE ESTÁ DONDE TERMINA LO ESTABLE · el segmento fijo no depende del turno");
{
  const fijos = CASOS.map((c) => buildPlanSystemSegments(ADI_PERSONA_PLAN, c.mem, c.sc, c.vista).fijo);
  ok(new Set(fijos).size === 1, `el segmento fijo es IDÉNTICO en las ${CASOS.length} combinaciones — ${fijos[0].length} chars`,
    fijos.map((f, i) => `${CASOS[i].n}=${f.length}`).join(" · "));
  // lo que varía tiene que estar ENTERO del lado variable: si algo de esto se colara al fijo, el caché no pegaría.
  for (const c of CASOS) {
    const { fijo, variable } = buildPlanSystemSegments(ADI_PERSONA_PLAN, c.mem, c.sc, c.vista);
    // se busca la LÍNEA DE DECLARACIÓN, no la palabra suelta: "actual" aparece en la doctrina fija por otros
    // motivos ("el turno ACTUAL del usuario"), y buscar la palabra daba un falso rojo en 3 de los 4 casos.
    const linea = `· Escenario de datos actual: ${c.sc}.`;
    ok(!fijo.includes(linea) && variable.includes(linea), `${c.n} — el escenario se declara del lado variable`);
    if (c.mem) ok(!fijo.includes("jc"), `${c.n} — la memoria de sesión NO está en el fijo`);
    if (c.vista) ok(!fijo.includes(DOCTRINA_CONTEXTO_VISTA) && variable.includes(DOCTRINA_CONTEXTO_VISTA),
      `${c.n} — la doctrina de pantalla viaja del lado variable`);
  }
}

H("[3] EL CATÁLOGO COMPLETO SIGUE ADENTRO · se movió el corte, no se adelgazó el contrato");
{
  const { fijo } = buildPlanSystemSegments(ADI_PERSONA_PLAN, MEM_LLENA, "actual", true);
  ok(fijo.includes(TOOL_CATALOG), "las 20 tools completas viajan en el segmento fijo");
  ok(fijo.includes(ADI_PERSONA_PLAN), "la persona también");
  ok(fijo.includes("REGLA DE ALCANCE") && fijo.includes("REGLA DE ARGUMENTOS"), "y las dos reglas duras del plan");
  const TOOLS_DEL_ENUM = PLAN_TOOL.schema.properties.calls.items.properties.tool.enum;
  const faltan = TOOLS_DEL_ENUM.filter((t) => !fijo.includes(t));
  ok(faltan.length === 0, `las ${TOOLS_DEL_ENUM.length} tools del schema están nombradas en el catálogo fijo`, `faltan: ${faltan.join(", ")}`);
}

H("[4] EL DESGLOSE MEDIDO · el ahorro es verificable, no una promesa");
{
  const { fijo, variable } = buildPlanSystemSegments(ADI_PERSONA_PLAN, MEM_VACIA, "actual", false);
  const tool = JSON.stringify(PLAN_TOOL).length;
  const user = buildPlanUserMessage([], "¿Cuánto contribuye Falabella?").length;
  const total = fijo.length + variable.length + tool + user;
  const cacheable = fijo.length + tool;   // jerarquía del proveedor: tools → system → messages
  console.log(`      system fijo ...... ${String(fijo.length).padStart(6)} chars  ~${String(tok(fijo.length)).padStart(5)} tok`);
  console.log(`      system variable ... ${String(variable.length).padStart(6)} chars  ~${String(tok(variable.length)).padStart(5)} tok`);
  console.log(`      PLAN_TOOL ........ ${String(tool).padStart(6)} chars  ~${String(tok(tool)).padStart(5)} tok`);
  console.log(`      pregunta ......... ${String(user).padStart(6)} chars  ~${String(tok(user)).padStart(5)} tok`);
  console.log(`      ── por llamada ... ${String(total).padStart(6)} chars  ~${String(tok(total)).padStart(5)} tok  · cacheable ${(cacheable / total * 100).toFixed(1)}%`);
  ok(cacheable / total > 0.9, `el tramo cacheable es la ABRUMADORA mayoría de la llamada — ${(cacheable / total * 100).toFixed(1)}%`);
  ok(variable.length < 1200, `lo que se paga completo en cada turno es marginal — ${variable.length} chars (~${tok(variable.length)} tok)`);
  // el hecho que motivó todo: la pregunta del usuario no mueve la aguja.
  const largos = ["¿y en Valparaíso?", "El KPI dice $4.1M de acciones comerciales, ¿de dónde sale?"]
    .map((q) => buildPlanUserMessage([], q).length);
  ok(Math.abs(largos[0] - largos[1]) < 60, `la pregunta del usuario pesa casi nada: ${Math.abs(largos[0] - largos[1])} chars entre la más corta y la más larga`);
}

H("[5] EL ADAPTER PONE EL CORTE DONDE SE LE DICE · y con un string no cambia nada");
{
  // se prueba la FORMA del cuerpo que arma el adapter, sin llamar a nadie: se replica su función pura de bloques.
  const bloques = (system) => {
    if (typeof system === "string") return [{ type: "text", text: system, cache_control: { type: "ephemeral" } }];
    const segs = (Array.isArray(system) ? system : []).filter((s) => s && typeof s.text === "string" && s.text.length);
    if (!segs.length) return null;
    let ult = -1; segs.forEach((s, i) => { if (s.cache) ult = i; });
    return segs.map((s, i) => (i === ult ? { type: "text", text: s.text, cache_control: { type: "ephemeral" } } : { type: "text", text: s.text }));
  };
  const { fijo, variable } = buildPlanSystemSegments(ADI_PERSONA_PLAN, MEM_LLENA, "actual", true);
  const b = bloques([{ text: fijo, cache: true }, { text: variable, cache: false }]);
  ok(b.length === 2, "dos bloques: el estable y el del turno");
  ok(!!b[0].cache_control && !b[1].cache_control, "el corte del caché va al FINAL del estable, no después de la memoria");
  ok(b[0].text + b[1].text === buildPlanSystem(ADI_PERSONA_PLAN, MEM_LLENA, "actual", true),
    "lo que se manda sigue siendo el prompt entero, sin una coma de diferencia");
  const s = bloques("un system cualquiera");
  ok(s.length === 1 && !!s[0].cache_control && s[0].text === "un system cualquiera",
    "con un STRING el comportamiento es el de siempre — los ~30 callers y gates que no segmentan no cambian");
}

console.log(`\n── _plan_cache_gate: ${PASS} PASS · ${FAIL} FAIL (de ${PASS + FAIL}) ──`);
process.exit(FAIL ? 1 : 0);
