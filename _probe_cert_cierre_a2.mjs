/* === _probe_cert_cierre_a2.mjs · ARREGLO 2 del cierre de la certificación amplia (2026-08-13) ==================
 * Reproduce OFFLINE el hallazgo 3 (hilo E turno 5, `_cert_amplia_openai.EFGH.json`, dev=81638bf): «¿y si mi venta
 * subiera 10% el próximo año?» → el PLAN eligió `escalar` con 1 insumo y la razón salió TÉCNICA a pantalla:
 * «'escalar' necesita exactamente 2 insumos (llegaron 1) — un monto $ …». Verifica:
 *   [1] el caso E5 se RESCATA: la tool resuelve la operación correcta (variacion_aplicada) sellada como hipótesis;
 *   [2] cuando no se puede rescatar, la declinación PREGUNTA la variable que falta EN PALABRAS DE USUARIO;
 *   [3] la regla de registro es verificable en toda la familia: sin /\w_\w/, sin nombres de operación, sin «insumos»;
 *   [4] las declinaciones legítimas (unidades, universos, procedencia) conservan su honestidad con el mismo registro;
 *   [5] la red es angosta: una tasa DEL DATO no se rescata (venta × margen sigue cerrado).
 * 100% OFFLINE: solo la tool y el catálogo — cero gateway, cero red.
 * Correr con el candado de red puesto:  node --import ./scripts/offline-guard.mjs _probe_cert_cierre_a2.mjs */
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { TOOLS } from "./src/adi/oracle/toolRegistry.js";
import { OPERACIONES_CALCULO } from "./src/adi/oracle/calculoCatalogo.js";
import { deriveKpis } from "./src/engine/scenarios.js";
import { ensureHypothesisFraming } from "./src/adi/oracle/narratePromptC.js";

initTenant(TENANT_DEMO);

let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ " + m + (extra ? "\n      " + String(extra).slice(0, 260) : "")); } };
const H = (t) => console.log("\n" + t);

// LA REGLA DE REGISTRO, verificable: sin identificadores con guion bajo, sin nombres de operación del catálogo,
// sin la palabra «insumos». (Los nombres se buscan como palabra exacta: «sumar»/«restar» son palabras de usuario.)
const OPS_RE = new RegExp("\\b(" + Object.keys(OPERACIONES_CALCULO).join("|") + ")\\b", "i");
const registroLimpio = (reason) => !/\w_\w/.test(reason) && !OPS_RE.test(reason) && !/insumos?\b/i.test(reason);

H("[1] E5 RESCATADO: escalar mal elegido + «10%» en objetivo → la operación correcta, sellada como hipótesis");
{
  const r = TOOLS.calcular({ operacion: "escalar", insumos: [{ entidad: "negocio", metrica: "ventas" }], objetivo: { usuario: "10% el próximo año" }, scenario: "actual" });
  ok(r.coverage.supported === true, "la tool YA NO declina: rescató la lectura inequívoca", r.coverage.reason);
  ok(r.facts && r.facts.operacion === "variacion_aplicada" && r.facts.operacionPedida === "escalar",
    "facts declaran la operación ejecutada Y la pedida (trazable)", JSON.stringify(r.facts && { op: r.facts.operacion, pedida: r.facts.operacionPedida }));
  const ventas = deriveKpis("actual").ventas.totalActual * 1000;
  const proy = r.boleta.find((f) => /Proyección/.test(f.label));
  ok(!!proy && Math.abs(proy.raw - ventas * 1.1) < 1000, "el proyectado es ventas × 1.1 sobre el dato real", proy && proy.value);
  ok(!!proy && proy.source === "computed" && typeof proy.formula === "string" && proy.formula.includes(" = "),
    "…computed y con su fórmula declarada", proy && proy.formula);
  const fU = r.boleta.find((f) => /Cifra del usuario/.test(f.label));
  ok(!!fU && fU.tipo && fU.tipo.sello === "indicado" && /procedencia/.test(String(fU.tipo.verificabilidadRazon || "")),
    "la tasa del usuario entra sellada INDICADO con su procedencia («el próximo año»)");
  ok(r.facts.conCifraDeUsuario === true && /hip[oó]tesis|ESCENARIO/i.test(String(r.facts.marco_hipotesis || "")),
    "el marco de hipótesis viaja en facts (igual que siempre)");
  ok(/estimado/i.test(ensureHypothesisFraming("Tu venta proyectada sería " + proy.value + ".", "default",
    [{ tool: "calcular", facts: r.facts, coverage: r.coverage }])), "…y ensureHypothesisFraming lo garantiza en el texto");
  // la MISMA lectura con el % como insumo directo (otra forma en que el plan puede mandarlo) también se rescata
  const r2 = TOOLS.calcular({ operacion: "escalar", insumos: [{ entidad: "negocio", metrica: "ventas" }, { usuario: "10% de aumento el próximo año" }], scenario: "actual" });
  ok(r2.coverage.supported === true && r2.facts.operacion === "variacion_aplicada", "…también cuando el % llega como insumo (unidades incompatibles → rescate)", r2.coverage.reason);
}

H("[2] SIN RESCATE POSIBLE: la declinación pregunta LA variable que falta, en palabras de usuario");
{
  const r = TOOLS.calcular({ operacion: "escalar", insumos: [{ usuario: "10% el próximo año" }], scenario: "actual" });
  ok(r.coverage.supported === false, "solo el % sin monto → declina (no adivina el monto)");
  ok(/sobre qué monto aplicarlo/.test(r.coverage.reason) && /venta total del negocio/.test(r.coverage.reason),
    "…preguntando la variable que falta («¿la venta total del negocio?»)", r.coverage.reason);
  ok(registroLimpio(r.coverage.reason), "…con registro limpio (sin token, sin operación, sin «insumos»)", r.coverage.reason);
}

H("[3] LA REGLA DE REGISTRO, en toda la familia de declinaciones");
{
  const casos = [
    ["operación inventada", { operacion: "formula_magica", insumos: [{ entidad: "Falabella", metrica: "ventas" }] }],
    ["aridad de suma", { operacion: "suma", insumos: [{ entidad: "Falabella", metrica: "ventas" }] }],
    ["aridad de brecha", { operacion: "brecha_pp", insumos: [{ entidad: "Falabella", metrica: "margen" }] }],
    ["unidades $ con %", { operacion: "suma", insumos: [{ entidad: "Falabella", metrica: "margen" }, { entidad: "Falabella", metrica: "ventas" }] }],
    ["métrica desconocida", { operacion: "suma", insumos: [{ entidad: "Falabella", metrica: "ebitda" }, { entidad: "Falabella", metrica: "ventas" }] }],
    ["entidad inexistente", { operacion: "resta", insumos: [{ entidad: "Inexistente SpA", metrica: "ventas" }, { entidad: "Falabella", metrica: "ventas" }] }],
    ["cifra sin procedencia", { operacion: "suma", insumos: [{ usuario: "$500K" }, { entidad: "Falabella", metrica: "contribucion" }] }],
    ["margen_objetivo sin entidad", { operacion: "margen_objetivo", insumos: [], objetivo: { usuario: "25% según la industria" } }],
  ];
  for (const [nombre, args] of casos) {
    const r = TOOLS.calcular({ ...args, scenario: "actual" });
    ok(r.coverage.supported === false && registroLimpio(r.coverage.reason), `${nombre} → declina con registro limpio`, r.coverage.reason);
  }
}

H("[4] LAS DECLINACIONES LEGÍTIMAS CONSERVAN SU HONESTIDAD");
{
  const um = TOOLS.calcular({ operacion: "suma", insumos: [{ entidad: "Falabella", metrica: "margen" }, { entidad: "Falabella", metrica: "ventas" }], scenario: "actual" });
  ok(/MISMA unidad/.test(um.coverage.reason) && /no convierto unidades en silencio/.test(um.coverage.reason),
    "$ con % dice QUÉ no opera y por qué (jamás convierte en silencio)", um.coverage.reason);
  const cx = TOOLS.calcular({ operacion: "participacion", insumos: [{ entidad: "Falabella", metrica: "ventas" }, { entidad: "SAM-TV55", metrica: "capital" }], scenario: "actual" });
  ok(cx.coverage.supported === false && /universos no reconcilian/.test(cx.coverage.reason),
    "el cruce de universos sigue nombrando la regla (el gate F2 la fija)", cx.coverage.reason);
  const sp = TOOLS.calcular({ operacion: "suma", insumos: [{ usuario: "$500K" }, { entidad: "Falabella", metrica: "contribucion" }], scenario: "actual" });
  ok(/procedencia/.test(sp.coverage.reason), "la cifra del usuario sin origen sigue pidiendo la procedencia", sp.coverage.reason);
}

H("[5] LA RED ES ANGOSTA: una tasa DEL DATO no se rescata («venta × margen» sigue cerrado)");
{
  const r = TOOLS.calcular({ operacion: "escalar", insumos: [{ entidad: "negocio", metrica: "ventas" }, { entidad: "Falabella", metrica: "margen" }], scenario: "actual" });
  ok(r.coverage.supported === false, "monto del dato × tasa del dato NO ejecuta (declina)", r.coverage.reason);
  ok(registroLimpio(r.coverage.reason), "…con registro limpio también ahí", r.coverage.reason);
  const leg = TOOLS.calcular({ operacion: "escalar", insumos: [{ entidad: "Falabella", metrica: "ventas" }, { usuario: "4 puntos de margen (mi meta)" }], scenario: "actual" });
  ok(leg.coverage.supported === true && leg.facts.operacion === "escalar",
    "la regla de tres legítima ($ × pp del usuario) sigue ejecutando como siempre, SIN rescate", leg.coverage.reason || JSON.stringify(leg.facts && leg.facts.operacion));
}

console.log(`\n── PROBE A2 · la calculadora habla en palabras de usuario · ${PASS} PASS · ${FAIL} FAIL ──`);
process.exitCode = FAIL ? 1 : 0;
