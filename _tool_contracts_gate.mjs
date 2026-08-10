/* === _tool_contracts_gate.mjs · Etapa 2/3 · contratos de tools + generalización multi-entidad — arnés determinístico ===
 * LOCAL, NO commiteado (convención del repo: _*_gate.mjs es local). Cero red, cero LLM: ejercita funciones puras de
 * src/adi/oracle/toolContracts.js y los TOOLS reales de src/adi/oracle/toolRegistry.js DIRECTO contra el dataset
 * demo embebido (mismo patrón que _conversation_scope_gate.mjs / _model_router_gate.mjs — nunca llama a
 * callPlan/callNarrate reales; donde se ejercita answerViaOracle.js, ambos son mocks locales, cero red).
 *
 * Cubre, como mínimo, lo pedido por el owner para cerrar Etapa 2:
 *   1. TOOL_CONTRACTS cubre EXACTAMENTE las tools registradas (ni falta ninguna, ni sobra ninguna) y cada contrato
 *      tiene el shape completo (dimensiones soportadas · multi-entidad · inputs obligatorios · supuestos · etc).
 *   2. Al menos 1 tool multi-entidad (gridTable/queryMetric/tensionRead/simulateCosto, entityScope generalizado) y
 *      1 tool single-entidad (entityRecord) probadas END-A-END contra datos reales del demo.
 *   3. Una tool que genuinamente NO admite varias entidades (entityProfile) DECLINA + OFRECE correrla por
 *      separado — nunca cambia de dimensión ni se queda con una sola entidad en silencio.
 *   4. compareEntities respeta su candado de cardinalidad {min:2,max:2} — decline + alternativas concretas con 3+.
 *   5. simulateGeneral hace fan-out determinístico a N calls (una por entidad), acotado por maxCalls — decline
 *      (nunca trunca en silencio) si el scope excede el cupo.
 *   6. answerViaOracle.js end-a-end (mocks) — 1 turno multi-entidad, 1 turno single-entidad, 1 turno de decline.
 *
 * SESIÓN POSTERIOR (owner "cierre del núcleo funcional", 2026-08-04) — Etapa 2 de ese plan (distinta de la Etapa
 * 2/3 del header de arriba, ver commit "Etapa 2: multientidad diagnose/simulateCarga/simulateCapital"):
 *   7. diagnose/simulateCarga/simulateCapital, antes CONSCIENTEMENTE no generalizadas (decline ante 2+ entidades),
 *      ahora entityScopeNativo=true — mismo mecanismo de FILTRADO (nunca fan-out) que Etapa 2/3 ya estableció para
 *      queryMetric/gridTable/tensionRead/simulateCosto.
 *   8. AISLAMIENTO DE EJE (la pieza de mayor riesgo de esta generalización, assert dedicado): diagnose corre
 *      _diagComercial (eje cliente) + _diagCapital (eje sku) A LA VEZ — un entityScope de un solo eje debe acotar
 *      SOLO el detector de ESE eje y dejar el foco del OTRO eje totalmente intacto (fallback suave de _scopeRows,
 *      Etapa 1, ya establecido — acá se confirma con datos reales, no se asume).
 *
 * Uso: node _tool_contracts_gate.mjs   (exit 1 si algún test falla)
 */
import { TOOLS } from "./src/adi/oracle/toolRegistry.js";
import {
  TOOL_CONTRACTS, getToolContract, applyMultiEntityScope,
  composeMultiEntityUnsupported, composeCardinalityExceeded, composeFanOutCapped, composeDimensionUnsupported,
} from "./src/adi/oracle/toolContracts.js";
import { answerViaOracle } from "./src/adi/oracle/answerViaOracle.js";

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log(`  OK  ${name}`); }
  else { fail++; console.log(`FAIL  ${name}${detail ? " — " + detail : ""}`); }
}
function section(title) { console.log(`\n== ${title} ==`); }

// entidades REALES del dataset demo (mismas que ya usa _conversation_scope_gate.mjs para el caso obligatorio)
const SKUS = ["SAM-REF500L", "SAM-TV55", "SAM-MICRO32L", "LG-WASH11KG", "LG-DRYER8KG", "LG-AIR9000", "PHI-SHAVER9", "PHI-HAIR-PRO", "PHI-IRON-PRO", "BOS-DRILL18V", "BOS-SANDER", "MAK-SAW18V", "MAK-COMP-AIR"];
const CLIENTES = ["Falabella", "Lider", "Jumbo", "Sodimac", "Tottus"];

// ════════════════════════════════════════════════════════════════════════════════════════════════════════════
section("1 · TOOL_CONTRACTS — completitud (cubre EXACTAMENTE las tools registradas) y shape de cada entrada");
// ────────────────────────────────────────────────────────────────────────────────────────────────────────────
{
  const registered = Object.keys(TOOLS).sort();
  const declared = Object.keys(TOOL_CONTRACTS).sort();
  ok("TOOL_CONTRACTS declara TODAS las tools registradas (ninguna falta)", registered.every((t) => declared.includes(t)), JSON.stringify(registered.filter((t) => !declared.includes(t))));
  ok("TOOL_CONTRACTS NO declara ninguna tool que no exista en el catálogo", declared.every((t) => registered.includes(t)), JSON.stringify(declared.filter((t) => !registered.includes(t))));
  ok("mismo número exacto (19 hoy)", registered.length === declared.length, `registered=${registered.length} declared=${declared.length}`);

  const REQUIRED_FIELDS = ["dimensionesSoportadas", "entidad", "aceptaEntidadPuntual", "multiCardinality", "inputsObligatorios", "supuestosRequeridos", "operacionValida", "entityScopeNativo", "escribeEntityList"];
  const ENTIDAD_VALUES = new Set(["none", "single", "multi", "multi-vía-fanout"]);
  let shapeOk = true, shapeDetail = "";
  for (const [name, c] of Object.entries(TOOL_CONTRACTS)) {
    for (const f of REQUIRED_FIELDS) if (!(f in c)) { shapeOk = false; shapeDetail = `${name} falta '${f}'`; }
    if (!Array.isArray(c.dimensionesSoportadas)) { shapeOk = false; shapeDetail = `${name}.dimensionesSoportadas no es array`; }
    if (!ENTIDAD_VALUES.has(c.entidad)) { shapeOk = false; shapeDetail = `${name}.entidad="${c.entidad}" fuera del vocabulario`; }
    if (typeof c.aceptaEntidadPuntual !== "boolean") { shapeOk = false; shapeDetail = `${name}.aceptaEntidadPuntual no es boolean`; }
    if (typeof c.entityScopeNativo !== "boolean") { shapeOk = false; shapeDetail = `${name}.entityScopeNativo no es boolean`; }
    if (!Array.isArray(c.inputsObligatorios)) { shapeOk = false; shapeDetail = `${name}.inputsObligatorios no es array`; }
    if (!Array.isArray(c.operacionValida)) { shapeOk = false; shapeDetail = `${name}.operacionValida no es array`; }
  }
  ok("CADA contrato trae los 9 campos declarativos con el tipo correcto", shapeOk, shapeDetail);

  ok("getToolContract('marginRead') devuelve el contrato real", getToolContract("marginRead") === TOOL_CONTRACTS.marginRead);
  ok("getToolContract('tool-inexistente') → null (nunca inventa un contrato)", getToolContract("tool-inexistente-xyz") === null);

  // compareEntities: candado de cardinalidad FIJO {min:2,max:2} — declarado, no forzado por el código de la tool.
  ok("compareEntities declara entidad='multi' con cardinalidad {min:2,max:2}", TOOL_CONTRACTS.compareEntities.entidad === "multi" && TOOL_CONTRACTS.compareEntities.multiCardinality.min === 2 && TOOL_CONTRACTS.compareEntities.multiCardinality.max === 2);
  // simulateGeneral: fan-out declarado, nunca forzado dentro de la tool misma.
  ok("simulateGeneral declara entidad='multi-vía-fanout' con cardinalidad {min:1,max:6}", TOOL_CONTRACTS.simulateGeneral.entidad === "multi-vía-fanout" && TOOL_CONTRACTS.simulateGeneral.multiCardinality.min === 1 && TOOL_CONTRACTS.simulateGeneral.multiCardinality.max === 6);
  // tools que genuinamente NO soportan multi-entidad quedan declaradas así (nunca forzadas)
  for (const t of ["entityProfile", "entityRecord", "trend"]) {
    ok(`${t} declara entidad="single" (NUNCA multi, ni forzado)`, TOOL_CONTRACTS[t].entidad === "single");
  }
  // diagnose/simulateCarga/simulateCapital: generalizadas en la sesión de cierre del núcleo (2026-08-04) — ver
  // header arriba. Antes: entityScopeNativo=false (decline ante 2+ entidades). Ahora: entityScopeNativo=true.
  for (const t of ["diagnose", "simulateCarga", "simulateCapital"]) {
    ok(`${t} declara entityScopeNativo=true (generalizada, cierre del núcleo 2026-08-04)`, TOOL_CONTRACTS[t].entityScopeNativo === true && TOOL_CONTRACTS[t].aceptaEntidadPuntual === true);
  }
  // tools SIN concepto de entidad (global puro) — un scope multi-entidad nunca las toca
  for (const t of ["executiveSummary", "defineConcept", "simulate"]) {
    ok(`${t} declara aceptaEntidadPuntual=false (alcance global, sin entidad)`, TOOL_CONTRACTS[t].aceptaEntidadPuntual === false);
  }
  // las 4 tools YA nativas de fábrica (antes de este trabajo) + las generalizadas en Etapa 2
  for (const t of ["inventoryStatus", "marginRead", "salesRead", "contributionRead"]) {
    ok(`${t} entityScopeNativo=true (YA nativo de fábrica)`, TOOL_CONTRACTS[t].entityScopeNativo === true);
  }
  for (const t of ["queryMetric", "gridTable", "tensionRead", "simulateCosto"]) {
    ok(`${t} entityScopeNativo=true (Etapa 2: generalizado)`, TOOL_CONTRACTS[t].entityScopeNativo === true);
  }
}

// ════════════════════════════════════════════════════════════════════════════════════════════════════════════
section("2 · TOOL MULTI-ENTIDAD end-a-end contra datos reales — gridTable con entityScope acota la grilla");
// ────────────────────────────────────────────────────────────────────────────────────────────────────────────
{
  const subset = [SKUS[4], SKUS[10]];   // LG-DRYER8KG, BOS-SANDER (2 de 13)
  const full = TOOLS.gridTable({ dimension: "sku", sortBy: "venta", limit: 20 });
  const scoped = TOOLS.gridTable({ dimension: "sku", sortBy: "venta", limit: 20, entityScope: { entities: subset } });
  ok("SIN entityScope trae los 13 SKU (control)", full.coverage.supported && full.facts.rows.length === 13, `rows=${full.facts.rows.length}`);
  ok("CON entityScope acota a EXACTAMENTE los 2 SKU pedidos", scoped.coverage.supported && scoped.facts.rows.length === 2, JSON.stringify(scoped.facts && scoped.facts.rows && scoped.facts.rows.map((r) => r.entidad)));
  const names = scoped.facts.rows.map((r) => r.entidad).sort();
  ok("los 2 SKU son EXACTAMENTE los del entityScope (ningún otro SKU se filtró)", JSON.stringify(names) === JSON.stringify(subset.slice().sort()), JSON.stringify(names));
  ok("un entityScope que NO intersecta ningún SKU real → fallback suave al eje completo (nunca vacío)", TOOLS.gridTable({ dimension: "sku", entityScope: { entities: ["NO-EXISTE-XYZ"] } }).facts.rows.length === 13);
}

// ════════════════════════════════════════════════════════════════════════════════════════════════════════════
section("3 · queryMetric/tensionRead/simulateCosto — entityScope generalizado (Etapa 2), datos reales");
// ────────────────────────────────────────────────────────────────────────────────────────────────────────────
{
  const subset = [SKUS[4], SKUS[10], SKUS[12]];   // LG-DRYER8KG, BOS-SANDER, MAK-COMP-AIR
  const qm = TOOLS.queryMetric({ metric: "ventas", dimension: "sku", entityScope: { entities: subset } });
  ok("queryMetric con entityScope: boleta trae SOLO figs de las 3 entidades pedidas", qm.coverage.supported && qm.boleta.length === 3 && qm.boleta.every((f) => subset.some((e) => f.label.startsWith(e))), JSON.stringify(qm.boleta.map((f) => f.label)));

  const tr = TOOLS.tensionRead({ dimension: "sku", entityScope: { entities: subset } });
  ok("tensionRead con entityScope: topA/topB nunca nombran un SKU fuera del subconjunto", tr.coverage.supported && tr.facts.topA.every((x) => subset.includes(x.nombre)) && tr.facts.topB.every((x) => subset.includes(x.nombre)), JSON.stringify({ topA: tr.facts.topA, topB: tr.facts.topB }));
  ok("tensionRead con entityScope: totalCount refleja el subconjunto (3), no el eje entero (13)", tr.facts.totalCount === 3, `totalCount=${tr.facts.totalCount}`);

  const sc = TOOLS.simulateCosto({ dimension: "sku", pct: -3, scope: "all", entityScope: { entities: [SKUS[4], SKUS[10]] } });
  ok("simulateCosto con entityScope: soportado y acotado (no truena, no degrada por accidente)", sc.coverage.supported, JSON.stringify(sc.coverage));
  // la boleta trae figs POR ENTIDAD ("LG-DRYER8KG · …") + agregados de PORTAFOLIO ("Total"/"Impacto"/"Margen
  // promedio", sin prefijo de entidad — legítimos, ya existían antes de Etapa 2) — lo que NUNCA debe aparecer es
  // un SKU FUERA del entityScope (los otros 11 del dataset).
  const otrosSkus = SKUS.filter((s) => s !== SKUS[4] && s !== SKUS[10]);
  ok("simulateCosto con entityScope: ningún SKU FUERA del subconjunto aparece en la boleta", !otrosSkus.some((s) => (sc.boleta || []).some((f) => f.label.startsWith(s))), JSON.stringify(sc.boleta.map((f) => f.label)));
  ok("simulateCosto con entityScope: los 2 SKU pedidos SÍ aparecen en la boleta", [SKUS[4], SKUS[10]].every((s) => (sc.boleta || []).some((f) => f.label.startsWith(s))), JSON.stringify(sc.boleta.map((f) => f.label)));
}

// ════════════════════════════════════════════════════════════════════════════════════════════════════════════
section("4 · TOOL SINGLE-ENTIDAD end-a-end — entityRecord (sin cambios de comportamiento, contrato 'single')");
// ────────────────────────────────────────────────────────────────────────────────────────────────────────────
{
  const r = TOOLS.entityRecord({ dimension: "sku", entity: "LG-DRYER8KG" });
  ok("entityRecord de UNA entidad puntual sigue funcionando byte-igual (Etapa 2 no la tocó)", r.coverage.supported && r.facts.entidad === "LG-DRYER8KG", JSON.stringify(r.facts && r.facts.entidad));
  ok("entityRecord NO acepta un segundo parámetro entityScope (no forma parte de su contrato — 'single')", TOOLS.entityRecord.length <= 1);   // signature de 1 solo arg-objeto, sin entityScope en el destructure
}

// ════════════════════════════════════════════════════════════════════════════════════════════════════════════
section("5 · applyMultiEntityScope — compareEntities respeta su candado de cardinalidad {min:2,max:2}");
// ────────────────────────────────────────────────────────────────────────────────────────────────────────────
{
  const planOk = { intent: "answer", mode: "default", scope: { level: "list", entities: ["Falabella", "Lider"] } };
  const rOk = applyMultiEntityScope(planOk, [{ tool: "compareEntities", args: { dimension: "cliente" } }], 6);
  ok("2 entidades EXACTAS (calza min=max=2) → puebla args.entities, sin decline", !rOk.decline && rOk.calls[0].args.entities.length === 2, JSON.stringify(rOk));
  ok("args.dimension se puebla desde el scope resuelto", rOk.calls[0].args.dimension === "cliente");

  const planOver = { intent: "answer", mode: "default", scope: { level: "list", entities: CLIENTES.slice(0, 3) } };
  const rOver = applyMultiEntityScope(planOver, [{ tool: "compareEntities", args: { dimension: "cliente" } }], 6);
  ok("3 entidades (excede max=2) → DECLINE, nunca se queda con las 2 primeras en silencio", !!rOver.decline, JSON.stringify(rOver));
  ok("el decline nombra las 3 entidades CONCRETAS (nunca genérico)", CLIENTES.slice(0, 3).every((c) => rOver.decline.includes(c)), rOver.decline);
  ok("el decline ofrece una alternativa concreta (de a pares / ranking completo)", /de a pares|ranking completo/i.test(rOver.decline), rOver.decline);
}

// ════════════════════════════════════════════════════════════════════════════════════════════════════════════
section("6 · applyMultiEntityScope — tool que NO admite multi-entidad DECLINA + OFRECE correr por separado");
// ────────────────────────────────────────────────────────────────────────────────────────────────────────────
{
  const plan = { intent: "answer", mode: "default", scope: { level: "list", entities: [SKUS[4], SKUS[10]] } };
  const r = applyMultiEntityScope(plan, [{ tool: "entityProfile", args: { dimension: "sku" } }], 6);
  ok("entityProfile (single) con 2 entidades en scope → DECLINE, nunca corre con la primera en silencio", !!r.decline, JSON.stringify(r));
  ok("el decline nombra AMBAS entidades y ofrece correrlas por separado", r.decline.includes(SKUS[4]) && r.decline.includes(SKUS[10]) && /por separado/i.test(r.decline), r.decline);

  // diagnose — generalizada en la sesión de cierre del núcleo (2026-08-04, ver toolContracts.js): ya NO declina,
  // puebla args.entityScope con las entidades del scope (mismo mecanismo que queryMetric/gridTable/tensionRead).
  const plan2 = { intent: "answer", mode: "default", scope: { level: "list", entities: [CLIENTES[0], CLIENTES[1]] } };
  const r2 = applyMultiEntityScope(plan2, [{ tool: "diagnose", args: {} }], 6);
  ok("diagnose con 2 entidades en scope → NO declina (generalizada, cierre del núcleo 2026-08-04)", !r2.decline, JSON.stringify(r2));
  ok("diagnose: args.entityScope se puebla con AMBAS entidades del scope", Array.isArray(r2.calls) && r2.calls.length === 1 && JSON.stringify(r2.calls[0].args.entityScope.entities) === JSON.stringify([CLIENTES[0], CLIENTES[1]]), JSON.stringify(r2));
  // diagnose NO tiene `dimension` en inputsObligatorios (opera sobre `filters`, no sobre un eje elegido por PLAN —
  // ver toolContracts.js) → applyMultiEntityScope correctamente NO fuerza args.dimension acá (a diferencia de
  // queryMetric/gridTable, que sí lo requieren) — confirma que el mecanismo respeta el contrato de CADA tool.
  ok("diagnose: args.dimension NO se fuerza (no está en inputsObligatorios — comportamiento correcto, no un gap)", !("dimension" in r2.calls[0].args), JSON.stringify(r2.calls[0].args));

  // control de regresión: una tool que SÍ sigue sin admitir multi-entidad (entityProfile, entidad="single",
  // entityScopeNativo=false) — mismo trato que siempre, para confirmar que el mecanismo de decline en sí no se rompió.
  const plan2b = { intent: "answer", mode: "default", scope: { level: "list", entities: [SKUS[0], SKUS[1]] } };
  const r2b = applyMultiEntityScope(plan2b, [{ tool: "entityProfile", args: { dimension: "sku" } }], 6);
  ok("control: entityProfile (nunca generalizada) sigue declinando byte-igual", !!r2b.decline, JSON.stringify(r2b));
  ok("control: el mensaje sigue siendo composeMultiEntityUnsupported (una sola forma de componerlo)", r2b.decline === composeMultiEntityUnsupported("entityProfile", "sku", [SKUS[0], SKUS[1]]), r2b.decline);
}

// ════════════════════════════════════════════════════════════════════════════════════════════════════════════
section("6b · diagnose/simulateCarga/simulateCapital multi-entidad END-A-END contra datos reales (cierre del núcleo, 2026-08-04)");
// ────────────────────────────────────────────────────────────────────────────────────────────────────────────
{
  // dataset real (verificado en vivo con _probe_diag_scope.mjs, sin LLM): SIN scope, diagnose trae 3 focos —
  // margen (Falabella/Lider/Jumbo/Sodimac/Ripley, subtotal 4949142), carga (Falabella/Sodimac/Lider/Easy/Ripley/
  // Jumbo, subtotal 655663), capital (LG-DRYER8KG/BOS-SANDER/MAK-COMP-AIR, subtotal 33200).
  const fullDiag = TOOLS.diagnose({ filters: {}, scenario: "actual" });
  const F = (d) => (d.facts && d.facts.findings) || [];
  const byDet = (findings, det) => findings.find((f) => f.detector === det);
  ok("control: SIN entityScope, diagnose trae los 3 focos completos", F(fullDiag).length === 3, JSON.stringify(F(fullDiag).map((f) => f.detector)));

  // 6b-i · entityScope SOLO-CLIENTES (eje comercial): acota margen/carga a esos 2 clientes, deja capital INTACTO
  // (aislamiento de eje — la pieza de mayor riesgo de esta generalización, ver header).
  const scopedClientes = TOOLS.diagnose({ filters: {}, scenario: "actual", entityScope: { entities: [CLIENTES[0], CLIENTES[3]] } });   // Falabella, Sodimac
  const margenC = byDet(F(scopedClientes), "margen"), cargaC = byDet(F(scopedClientes), "carga"), capitalC = byDet(F(scopedClientes), "capital");
  ok("6b-i · foco margen acotado a EXACTAMENTE los 2 clientes del scope", margenC && margenC.items.length === 2 && margenC.items.every((it) => [CLIENTES[0], CLIENTES[3]].includes(it.entidad)), JSON.stringify(margenC));
  ok("6b-i · foco carga acotado a EXACTAMENTE los 2 clientes del scope", cargaC && cargaC.items.length === 2 && cargaC.items.every((it) => [CLIENTES[0], CLIENTES[3]].includes(it.entidad)), JSON.stringify(cargaC));
  ok("6b-i · foco capital QUEDA INTACTO (entityScope de cliente no cruza al eje SKU — fallback suave)", capitalC && capitalC.subtotal_usd === byDet(F(fullDiag), "capital").subtotal_usd && capitalC.items.length === byDet(F(fullDiag), "capital").items.length, JSON.stringify({ scoped: capitalC, full: byDet(F(fullDiag), "capital") }));

  // 6b-ii · entityScope SOLO-SKU (eje capital): acota capital al subconjunto, deja margen/carga INTACTOS.
  const scopedSkus = TOOLS.diagnose({ filters: {}, scenario: "actual", entityScope: { entities: [SKUS[0], SKUS[4], SKUS[10]] } });   // SAM-REF500L, LG-DRYER8KG, BOS-SANDER
  const margenS = byDet(F(scopedSkus), "margen"), cargaS = byDet(F(scopedSkus), "carga"), capitalS = byDet(F(scopedSkus), "capital");
  ok("6b-ii · foco margen QUEDA INTACTO (entityScope de SKU no cruza al eje cliente)", margenS && margenS.subtotal_usd === byDet(F(fullDiag), "margen").subtotal_usd, JSON.stringify(margenS));
  ok("6b-ii · foco carga QUEDA INTACTO (entityScope de SKU no cruza al eje cliente)", cargaS && cargaS.subtotal_usd === byDet(F(fullDiag), "carga").subtotal_usd, JSON.stringify(cargaS));
  ok("6b-ii · foco capital acotado a los SKU del scope que SÍ están dormidos (SAM-REF500L no lo está → excluido honesto)", capitalS && capitalS.items.length === 2 && capitalS.items.every((it) => [SKUS[4], SKUS[10]].includes(it.entidad)) && !capitalS.items.some((it) => it.entidad === SKUS[0]), JSON.stringify(capitalS));
  ok("6b-ii · MAK-COMP-AIR (dormido pero FUERA del scope) no aparece", !capitalS.items.some((it) => it.entidad === "MAK-COMP-AIR"), JSON.stringify(capitalS));

  // 6b-iii · simulateCarga/simulateCapital heredan el mismo forwarding (reusan composeSpecDiagnose por debajo).
  const simCarga = TOOLS.simulateCarga({ filters: {}, scenario: "actual", entityScope: { entities: [CLIENTES[0], CLIENTES[3]] } });
  ok("6b-iii · simulateCarga con entityScope: soportado y acotado al subtotal de los 2 clientes ($350K, no $656K del eje entero)", simCarga.coverage.supported && simCarga.boleta.some((f) => f.label === "Recuperable · total" && f.raw === cargaC.subtotal_usd), JSON.stringify(simCarga.boleta));
  const simCapital = TOOLS.simulateCapital({ filters: {}, scenario: "actual", entityScope: { entities: [SKUS[0], SKUS[4], SKUS[10]] } });
  ok("6b-iii · simulateCapital con entityScope: soportado y acotado al subtotal del subconjunto dormido ($25K, no $33.2K del eje entero)", simCapital.coverage.supported && simCapital.boleta.some((f) => f.label === "Liberable · total" && f.raw === capitalS.subtotal_usd), JSON.stringify(simCapital.boleta));
  ok("6b-iii · simulateCapital: ningún SKU fuera del subconjunto dormido aparece en la boleta (MAK-COMP-AIR)", !simCapital.boleta.some((f) => f.label.startsWith("MAK-COMP-AIR")), JSON.stringify(simCapital.boleta.map((f) => f.label)));
}

// ════════════════════════════════════════════════════════════════════════════════════════════════════════════
section("7 · applyMultiEntityScope — simulateGeneral hace FAN-OUT determinístico (una call por entidad)");
// ────────────────────────────────────────────────────────────────────────────────────────────────────────────
{
  const subset = [SKUS[4], SKUS[10], SKUS[12]];
  const plan = { intent: "answer", mode: "simulacion", scope: { level: "list", entities: subset } };
  const call = { tool: "simulateGeneral", args: { variableA: { campo: "precioLista", delta_pct: 3 }, variableB: { campo: "unidades", delta_pct: -2 } } };
  const r = applyMultiEntityScope(plan, [call], 6);
  ok("fan-out: 3 entidades en scope → EXACTAMENTE 3 calls (nunca 1, nunca colapsa)", !r.decline && Array.isArray(r.calls) && r.calls.length === 3, JSON.stringify(r));
  ok("cada call fanned-out apunta a una entidad DISTINTA del subset", JSON.stringify(r.calls.map((c) => c.args.entity).sort()) === JSON.stringify(subset.slice().sort()), JSON.stringify(r.calls.map((c) => c.args.entity)));
  ok("cada call fanned-out preserva variableA/variableB Y hereda dimension=sku del scope", r.calls.every((c) => c.args.dimension === "sku" && c.args.variableA.delta_pct === 3 && c.args.variableB.delta_pct === -2), JSON.stringify(r.calls));

  // ejecutadas de verdad contra el dato real (deterministic, sin red) — confirma que el fan-out produce resultados
  // VÁLIDOS y DISTINTOS por entidad, no solo el shape de los args.
  const results = r.calls.map((c) => TOOLS.simulateGeneral(c.args));
  ok("las 3 simulaciones fanned-out corren de verdad y todas quedan soportadas", results.every((x) => x.coverage.supported), JSON.stringify(results.map((x) => x.coverage)));
  ok("cada resultado nombra SU PROPIA entidad en la boleta (nunca la de otro SKU)", results.every((x, i) => x.boleta.every((f) => f.label.startsWith(subset[i]))), JSON.stringify(results.map((x) => x.boleta.map((f) => f.label))));

  // cupo excedido — 7 entidades > max(6) → DECLINE, nunca trunca en silencio a las primeras 6
  const bigPlan = { intent: "answer", mode: "simulacion", scope: { level: "list", entities: SKUS.slice(0, 7) } };
  const rBig = applyMultiEntityScope(bigPlan, [call], 6);
  ok("7 entidades > cupo (6) → DECLINE explícito (nunca trunca en silencio)", !!rBig.decline, JSON.stringify(rBig));
  ok("el decline ofrece 'las primeras 6' como alternativa concreta", rBig.decline.includes("6") && SKUS.slice(0, 6).every((s) => rBig.decline.includes(s)), rBig.decline);
  ok("control: composeFanOutCapped produce el MISMO texto (no hay 2 formas de componer el mismo mensaje)", rBig.decline === composeFanOutCapped("simulateGeneral", SKUS.slice(0, 7), 6));
}

// ════════════════════════════════════════════════════════════════════════════════════════════════════════════
section("8 · applyMultiEntityScope — PLAN ya narrowed a UNA entidad válida del scope → no se fuerza ni se declina");
// ────────────────────────────────────────────────────────────────────────────────────────────────────────────
{
  const plan = { intent: "answer", mode: "default", scope: { level: "list", entities: [SKUS[4], SKUS[10]] } };
  const call = { tool: "entityProfile", args: { dimension: "sku", entity: SKUS[4] } };   // YA acotado a UNA entidad DEL scope
  const r = applyMultiEntityScope(plan, [call], 6);
  ok("call YA acotada a 1 entidad válida del scope → PASA SIN TOCAR (ni decline, ni fuerza el resto)", !r.decline && r.calls.length === 1 && r.calls[0] === call, JSON.stringify(r));

  // control: mismo caso pero la entidad del args NO pertenece al scope actual → SÍ declina (no es un free-pass genérico)
  const callAjeno = { tool: "entityProfile", args: { dimension: "sku", entity: "SAM-REF500L" } };
  const rAjeno = applyMultiEntityScope(plan, [callAjeno], 6);
  ok("control: entity fuera del scope actual → SÍ declina (el narrowing debe ser AL scope resuelto, no cualquiera)", !!rAjeno.decline, JSON.stringify(rAjeno));
}

// ════════════════════════════════════════════════════════════════════════════════════════════════════════════
section("9 · applyMultiEntityScope — compatibilidad de dimensión (nunca cambia de eje en silencio)");
// ────────────────────────────────────────────────────────────────────────────────────────────────────────────
{
  // inventoryStatus solo soporta [sku,bodega] — un scope de dimension="cliente" no calza.
  const plan = { intent: "answer", mode: "default", scope: { level: "list", dimension: "cliente", entities: [CLIENTES[0], CLIENTES[1]] } };
  const r = applyMultiEntityScope(plan, [{ tool: "inventoryStatus", args: {} }], 6);
  ok("dimension incompatible con la tool → DECLINE (nunca corre igual con el eje equivocado)", !!r.decline, JSON.stringify(r));
  ok("mensaje coincide con composeDimensionUnsupported (una sola forma de componerlo)", r.decline === composeDimensionUnsupported("inventoryStatus", TOOL_CONTRACTS.inventoryStatus, "cliente"));
}

// ════════════════════════════════════════════════════════════════════════════════════════════════════════════
section("10 · applyMultiEntityScope — controles: scope.level≠'list' o <2 entidades → no-op total");
// ────────────────────────────────────────────────────────────────────────────────────────────────────────────
{
  const calls = [{ tool: "compareEntities", args: { dimension: "cliente", entities: ["Falabella", "Lider"] } }];
  ok("scope.level='entity' → calls sin tocar (mismo array de referencia)", applyMultiEntityScope({ scope: { level: "entity", entities: ["Falabella"] } }, calls, 6).calls === calls);
  ok("scope.level='list' con 1 sola entidad → calls sin tocar", applyMultiEntityScope({ scope: { level: "list", entities: ["Falabella"] } }, calls, 6).calls === calls);
  ok("scope null → calls sin tocar", applyMultiEntityScope({ scope: null }, calls, 6).calls === calls);
  ok("plan null → calls sin tocar, nunca truena", applyMultiEntityScope(null, calls, 6).calls === calls);
}

// ════════════════════════════════════════════════════════════════════════════════════════════════════════════
section("11 · answerViaOracle.js END-A-END (mocks, cero red) — multi-entidad, single-entidad, decline");
// ────────────────────────────────────────────────────────────────────────────────────────────────────────────
{
  // 11a · MULTI-ENTIDAD end-a-end: PLAN mockeado entrega scope.level="list" con 2 SKU y una call a gridTable SIN
  // entityScope (como lo entregaría un LLM real que solo entiende el scope, no el mecanismo de entityScope) — el
  // pipeline completo (coerción Etapa 2 → runPlan real → guardC real → narrar mockeado → guardC real de nuevo) debe
  // devolver una boleta que SOLO nombra los 2 SKU pedidos, nunca los otros 11 del dataset.
  const subset = [SKUS[4], SKUS[10]];
  const planMulti = { intent: "answer", mode: "default", rationale: "test", scope: { level: "list", entities: subset }, calls: [{ tool: "gridTable", args: { dimension: "sku", sortBy: "venta" } }] };
  const callPlanMulti = async () => planMulti;
  const callNarrateMulti = async () => "Acá tenés la tabla de esos dos SKU.";
  const rMulti = await answerViaOracle({ text: "de esos SKU, armame la tabla", callPlan: callPlanMulti, callNarrate: callNarrateMulti, scenario: "actual" });
  ok("11a · el turno responde route=oracle (no se abstiene)", rMulti && rMulti.r && rMulti.r.route === "oracle", JSON.stringify(rMulti && rMulti.r && rMulti.r.text));
  const boletaMulti = (rMulti && rMulti.r && rMulti.r.evidence && rMulti.r.evidence.boleta) || [];
  ok("11a · la boleta final SOLO nombra los 2 SKU del scope (entityScope SÍ llegó a la tool real)", boletaMulti.length > 0 && boletaMulti.every((f) => subset.some((e) => f.label.startsWith(e))), JSON.stringify(boletaMulti.map((f) => f.label)));
  ok("11a · ningún SKU FUERA del scope aparece en la boleta (ej. SAM-REF500L)", !boletaMulti.some((f) => f.label.startsWith("SAM-REF500L")));

  // 11b · SINGLE-ENTIDAD end-a-end (control de regresión — el mecanismo de 1 entidad, anterior a Etapa 2, sigue
  // funcionando byte-igual): scope.level="entity" con 1 SKU, entityRecord.
  const planSingle = { intent: "answer", mode: "default", rationale: "test", scope: { level: "entity", entities: [SKUS[4]] }, calls: [{ tool: "entityRecord", args: { dimension: "sku", entity: SKUS[4] } }] };
  const callPlanSingle = async () => planSingle;
  const callNarrateSingle = async () => "Acá tenés el detalle de ese SKU.";
  const rSingle = await answerViaOracle({ text: "dame el detalle de este SKU", callPlan: callPlanSingle, callNarrate: callNarrateSingle, scenario: "actual" });
  ok("11b · el turno single-entidad responde route=oracle", rSingle && rSingle.r && rSingle.r.route === "oracle", JSON.stringify(rSingle && rSingle.r && rSingle.r.text));
  const boletaSingle = (rSingle && rSingle.r && rSingle.r.evidence && rSingle.r.evidence.boleta) || [];
  // entityRecord trae figs por-columna DE la entidad ("LG-DRYER8KG · Margen") + varas de referencia SIN prefijo
  // ("Benchmark de margen" — ver toolRegistry.js:entityRecord, REFERENCIA_CAMPO, sin cambios de Etapa 2). Lo que
  // importa acá es que NINGÚN otro SKU aparezca (el mecanismo de 1 sola entidad sigue acotado correctamente).
  ok("11b · la boleta nombra la entidad puntual pedida", boletaSingle.some((f) => f.label.startsWith(SKUS[4])), JSON.stringify(boletaSingle.map((f) => f.label)));
  ok("11b · ningún OTRO SKU aparece en la boleta (sigue acotada a 1 sola entidad)", !boletaSingle.some((f) => SKUS.filter((s) => s !== SKUS[4]).some((s) => f.label.startsWith(s))));

  // 11c · DECLINE end-a-end: scope.level="list" con 2 SKU + una call a entityProfile (entidad="single", NUNCA
  // generalizada — diagnose YA NO sirve de ejemplo acá, ver 11d abajo) — el turno NUNCA debe llegar a NARRAR
  // (bypasea PLAN/BATCH/NARRAR igual que ambiguous/decline de conversationScope.js); callNarrate NUNCA debería invocarse.
  let narrateCalled = false;
  const planDecline = { intent: "answer", mode: "default", rationale: "test", scope: { level: "list", entities: [SKUS[0], SKUS[1]] }, calls: [{ tool: "entityProfile", args: { dimension: "sku" } }] };
  const callPlanDecline = async () => planDecline;
  const callNarrateDecline = async () => { narrateCalled = true; return "esto NUNCA debería narrarse"; };
  const rDecline = await answerViaOracle({ text: "perfila esos 2 SKU", callPlan: callPlanDecline, callNarrate: callNarrateDecline, scenario: "actual" });
  ok("11c · el turno responde route=oracle (bypass, no abstención)", rDecline && rDecline.r && rDecline.r.route === "oracle");
  ok("11c · el narrador NUNCA se invocó (bypass determinístico, antes del batch/narrar)", narrateCalled === false);
  ok("11c · el texto final ES el decline (nombra ambos SKU, ofrece correrlos por separado)", rDecline.r.text.includes(SKUS[0]) && rDecline.r.text.includes(SKUS[1]) && /por separado/i.test(rDecline.r.text), rDecline.r.text);
  ok("11c · mem2 no arrastra lastOffer/pendingSimulation de este bypass", rDecline.mem.lastOffer === null && rDecline.mem.pendingSimulation === null);

  // 11d · diagnose MULTI-ENTIDAD end-a-end (cierre del núcleo, 2026-08-04) — PLAN mockeado entrega scope.level=
  // "list" con 2 clientes y una call a diagnose SIN entityScope (como lo entregaría un LLM real que solo entiende
  // el scope) — el pipeline completo debe correr diagnose acotado a esos 2 clientes (nunca decline, nunca los 5
  // clientes del dataset completo).
  const subsetClientes = [CLIENTES[0], CLIENTES[3]];   // Falabella, Sodimac
  const planDiagMulti = { intent: "answer", mode: "default", rationale: "test", scope: { level: "list", entities: subsetClientes }, calls: [{ tool: "diagnose", args: {} }] };
  const callPlanDiagMulti = async () => planDiagMulti;
  const callNarrateDiagMulti = async () => "Acá tenés el diagnóstico de esos 2 clientes.";
  const rDiagMulti = await answerViaOracle({ text: "de esos 2 clientes, diagnostica dónde perdemos plata", callPlan: callPlanDiagMulti, callNarrate: callNarrateDiagMulti, scenario: "actual" });
  ok("11d · el turno responde route=oracle (no declina, no se abstiene)", rDiagMulti && rDiagMulti.r && rDiagMulti.r.route === "oracle", JSON.stringify(rDiagMulti && rDiagMulti.r && rDiagMulti.r.text));
  const findingsDiagMulti = (rDiagMulti && rDiagMulti.r && rDiagMulti.r.evidence && rDiagMulti.r.evidence.findings) || [];
  const margenDiagMulti = findingsDiagMulti.find((f) => f.detector === "margen");
  ok("11d · el foco margen SOLO nombra los 2 clientes del scope (entityScope SÍ llegó a diagnose real)", margenDiagMulti && margenDiagMulti.items.length === 2 && margenDiagMulti.items.every((it) => subsetClientes.includes(it.entidad)), JSON.stringify(margenDiagMulti));
  ok("11d · ningún cliente FUERA del scope aparece en el foco margen (ej. Jumbo)", margenDiagMulti && !margenDiagMulti.items.some((it) => it.entidad === "Jumbo"));
}

console.log(`\n${pass}/${pass + fail} OK` + (fail ? `  — ${fail} FALLO(S)` : ""));
process.exit(fail ? 1 : 0);
