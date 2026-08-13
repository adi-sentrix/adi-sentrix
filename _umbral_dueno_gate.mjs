/* === _umbral_dueno_gate.mjs · ENCARGO «UMBRAL DEL USUARIO + DUEÑO POR FILA» (2026-08-13 · suite 141 → 142) ====
 * El hallazgo VIVO del owner vuelto contrato. «¿Cuánto capital tengo inmovilizado en inventario parado hace más
 * de 90 días?» → ADI respondió $33K (criterio INTERNO del motor: estados por rotación/DOH — BOS-SANDER de 68
 * días adentro) presentándolo como «>90 días»; el real con diasSinVenta>90 son 2 SKU ≈ $22K. Y atribuyó a
 * LG-DRYER8KG cifras de MAK-COMP-AIR. LAS CUATRO GARANTÍAS:
 *   1 · FILTRAR+SUMAR CON EL UMBRAL DECLARADO — `suma_filtrada` (catálogo D1, con su gate): el total lleva el
 *       criterio COMPLETO en la fórmula y en facts, con las filas que lo componen; el cruce de universos y el
 *       campo inexistente declinan en palabras de usuario (regla A2); el PLAN puede nombrarla (TOOL_CATALOG).
 *   2 · REGLA DE HONESTIDAD DEL CAMINO VIEJO — cuando la pregunta trae un umbral de días que inventoryStatus NO
 *       aplica, la tool lo DECLARA en facts y el backstop (ensureUmbralDeclarado) lo antepone a la narración.
 *       El foco `stale` SÍ aplica el umbral → nada que declarar, y su total ES el del umbral.
 *   3 · DUEÑO POR FILA EN LA BOLETA — generalización de F1 a la primera fuente: mis-atribución ACTIVA (cifra en
 *       una oración que nombra OTRA entidad, sin ningún dueño legítimo a la vista) → veto `cifra-de-boleta-sin-
 *       dueno` NOMBRANDO al dueño real; y es verdicto de REDACCIÓN (reintento con instrucción, no turno perdido).
 *   4 · ADITIVIDAD — solo con 2+ dueños en la misma métrica; la boleta mono-entidad es BYTE-IDÉNTICA; la cifra
 *       suelta y la anáfora legítima («Su margen…») siguen pasando; un valor con dos dueños valida con cualquiera.
 * 100% OFFLINE: tools + guard + módulos puros. El detalle fino vive en _probe_umbral_dueno.mjs (50 casos).
 */
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { TOOLS } from "./src/adi/oracle/toolRegistry.js";
import { runPlan } from "./src/adi/oracle/toolRunner.js";
import { guardC } from "./src/adi/oracle/guardC.js";
import { OPERACIONES_CALCULO, esCalculoDelCatalogo } from "./src/adi/oracle/calculoCatalogo.js";
import { ensureUmbralDeclarado } from "./src/adi/oracle/narratePromptC.js";
import { axisEntityNames } from "./src/adi/oracle/entityIndex.js";
import { TOOL_CATALOG } from "./src/adi/oracle/planPrompt.js";
import { readFileSync } from "node:fs";

initTenant(TENANT_DEMO);

let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ " + m + (extra ? "\n      " + String(extra).slice(0, 240) : "")); } };
const H = (t) => console.log("\n" + t);

const PREG_OWNER = "¿Cuánto capital tengo inmovilizado en inventario parado hace más de 90 días?";
const DUENOS = [];
for (const eje of ["cliente", "sku", "marca", "familia", "bodega", "canal"]) for (const n of axisEntityNames(eje)) DUENOS.push(n);
const OPS_RE = new RegExp("\\b(" + Object.keys(OPERACIONES_CALCULO).join("|") + ")\\b", "i");
const registroLimpio = (r) => !/\w_\w/.test(r) && !OPS_RE.test(r) && !/insumos?\b/i.test(r);

H("── 1 · FILTRAR+SUMAR CON EL UMBRAL DECLARADO ──");
{
  ok("suma_filtrada" in OPERACIONES_CALCULO, "la operación está en el catálogo (D1: cerrada y declarada)");
  const sf = TOOLS.calcular({ operacion: "suma_filtrada", insumos: [{ metrica: "capital" }], umbral: { metrica: "dias sin venta", operador: ">", valor: 90 }, scenario: "actual" });
  const total = sf.boleta.find((f) => f.mandatory);
  ok(sf.coverage.supported === true && !!total && total.raw === 22000, "el caso del owner: >90 días sin venta → $22K, NO los $33K del criterio interno", total && total.value);
  ok(/más de 90 días sin venta/.test(total.formula) && /LG-DRYER8KG/.test(total.formula) && /MAK-COMP-AIR/.test(total.formula),
    "la fórmula declara el criterio COMPLETO con sus filas (un total filtrado sin filas es un top-N sin cola)", total.formula);
  ok(sf.facts.criterio.en_palabras === "más de 90 días sin venta" && sf.facts.filas.length === 2,
    "facts: criterio estructurado + las 2 filas componentes");
  ok(sf.boleta.some((f) => f.label === "LG-DRYER8KG · Días sin venta" && f.raw === 94), "cada fila entra con su valor del campo filtrado (94d autorizado)");
  const cruce = TOOLS.calcular({ operacion: "suma_filtrada", insumos: [{ metrica: "ventas" }], umbral: { metrica: "dias sin venta", operador: ">", valor: 90 }, scenario: "actual" });
  ok(cruce.coverage.supported === false && /universos no reconcilian/.test(cruce.coverage.reason) && registroLimpio(cruce.coverage.reason),
    "el cruce de universos declina nombrando la regla, en palabras de usuario (A2)", cruce.coverage.reason);
  const noEx = TOOLS.calcular({ operacion: "suma_filtrada", insumos: [{ metrica: "capital" }], umbral: { metrica: "temperatura", operador: ">", valor: 1 }, scenario: "actual" });
  ok(noEx.coverage.supported === false && registroLimpio(noEx.coverage.reason), "un campo inexistente declina honesto, en palabras");
  ok(esCalculoDelCatalogo(33200, "money", [{ raw: 13600, unit: "money" }, { raw: 11200, unit: "money" }, { raw: 8400, unit: "money" }]) === false,
    "el muro NO espeja la suma N-aria (los resultados llegan sellados en la boleta — conservador, medido)");
  ok(/suma_filtrada/.test(TOOL_CATALOG) && /umbral/.test(TOOL_CATALOG), "el PLAN puede nombrarla: descrita en TOOL_CATALOG con su arg umbral");
}

H("── 2 · REGLA DE HONESTIDAD DEL CAMINO VIEJO ──");
{
  const out = runPlan({ intent: "answer", calls: [{ tool: "inventoryStatus", args: {} }] }, { scenario: "actual", preguntaUsuario: PREG_OWNER });
  const u = out.results[0].facts.umbral_no_aplicado;
  ok(!!u && u.dias === 90 && /no está aplicado/.test(u.declaracion), "la pregunta del owner dispara la declaración del umbral NO aplicado", JSON.stringify(u || null));
  const texto = "Tienes $33.2K de capital inmovilizado en 3 SKU sin rotar.";
  ok(ensureUmbralDeclarado(texto, out.results).startsWith("Ojo con el criterio:"), "el backstop la ANTEPONE (el criterio va primero) — viaja obligatoria a la narración");
  ok(ensureUmbralDeclarado(ensureUmbralDeclarado(texto, out.results), out.results) === ensureUmbralDeclarado(texto, out.results), "…idempotente");
  const sinU = runPlan({ intent: "answer", calls: [{ tool: "inventoryStatus", args: {} }] }, { scenario: "actual", preguntaUsuario: "¿dónde está detenido mi capital?" });
  ok(!("umbral_no_aplicado" in (sinU.results[0].facts || {})), "sin umbral en la pregunta, byte-idéntico (aditivo)");
  const stale = runPlan({ intent: "answer", calls: [{ tool: "inventoryStatus", args: { focus: "stale", staleDays: 90 } }] }, { scenario: "actual", preguntaUsuario: PREG_OWNER });
  const tSt = stale.results[0].boleta.find((f) => /total/i.test(f.label) && f.mandatory);
  ok(!("umbral_no_aplicado" in (stale.results[0].facts || {})) && !!tSt && tSt.raw === 22000,
    "focus=stale APLICA el corte → sin declaración, y su total ES $22K");
}

H("── 3 · DUEÑO POR FILA EN LA BOLETA DEL TURNO (el caso literal como regresión) ──");
const inv = TOOLS.inventoryStatus({ scenario: "actual" });
const base = { ledger: { figs: inv.boleta }, results: [{ tool: "inventoryStatus", ...inv }], trace: null,
  question: "¿dónde está detenido mi capital?", duenosDelTenant: DUENOS };
{
  const mal = guardC("El más crítico es LG-DRYER8KG, que retiene $8.4K de capital detenido. También están MAK-COMP-AIR y BOS-SANDER.", base);
  ok(!mal.ok && mal.verdict === "cifra-de-boleta-sin-dueno" && /MAK-COMP-AIR/.test(mal.violations[0].detail),
    "la cifra de MAK pegada a LG se VETA nombrando al dueño real — aunque MAK aparezca en otra oración", (mal.violations[0] || {}).detail);
  const bien = guardC("MAK-COMP-AIR retiene $8.4K de capital detenido. LG-DRYER8KG es el de más capital ($13.6K).", base);
  ok(bien.ok === true, "bien atribuidas, las mismas cifras PASAN", JSON.stringify(bien.violations));
  // el verdicto es de REDACCIÓN en el pipeline: la familia está declarada en answerViaOracle (mismo trato que F1)
  const AVO = readFileSync(new URL("./src/adi/oracle/answerViaOracle.js", import.meta.url), "utf8");
  ok(/cifra-no-autorizada\|cifra-de-dato-sin-dueno\|cifra-de-boleta-sin-dueno/.test(AVO),
    "el kind nuevo está en la familia de REDACCIÓN (reintento con instrucción, no turno perdido)");
}

H("── 4 · ADITIVIDAD (no es un dicho: se mide) ──");
{
  const perfil = TOOLS.entityRecord({ dimension: "cliente", entity: "Falabella", scenario: "actual" });
  const args = { ledger: { figs: perfil.boleta }, results: [{ tool: "entityRecord", ...perfil }], trace: null, question: "" };
  const narr = "Falabella vendió $19.4M con margen 22.0%.";
  ok(JSON.stringify(guardC(narr, args)) === JSON.stringify(guardC(narr, { ...args, duenosDelTenant: DUENOS })),
    "boleta MONO-ENTIDAD: byte-idéntica con y sin la referencia de dueños (no hay con qué confundirse)");
  const suelta = guardC("Hay $8.4K parados que conviene liquidar ya.", base);
  ok(suelta.ok === true, "la cifra SUELTA sigue pasando — hoy pasa, y solo la mis-atribución REAL veta");
  const anafora = guardC("MAK-COMP-AIR es el más frío del inventario. Su capital detenido es $8.4K.", base);
  ok(anafora.ok === true, "la anáfora legítima (dueño en la oración anterior) pasa — el patrón real del producto");
  const bodega = guardC("En Antofagasta hay $8.4K de capital detenido.", base);
  ok(bodega.ok === true, "colisión de canon: un valor con dos dueños legítimos valida con CUALQUIERA (F1 §3)");
  const eco = guardC("Los $8.4K que preguntas corresponden a MAK-COMP-AIR.", { ...base, question: "¿de qué es el 8.4K?" });
  ok(eco.ok === true, "el eco de la pregunta conserva su estatus de siempre");
}

console.log(`\n── _umbral_dueno_gate: ${PASS} PASS · ${FAIL} FAIL ──`);
process.exit(FAIL ? 1 : 0);
