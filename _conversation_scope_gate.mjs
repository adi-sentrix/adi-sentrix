/* === _conversation_scope_gate.mjs · Etapa 1/3 · continuidad conversacional universal — arnés determinístico ===
 * LOCAL, NO commiteado (convención del repo: _*_gate.mjs es local). Cero red, cero LLM: ejercita funciones puras
 * de src/adi/oracle/conversationScope.js directo (mismo patrón que _model_router_gate.mjs / _guardc_repetition_
 * degraded_gate.mjs — mockea el estado a mano, nunca llama a callPlan/callNarrate reales).
 *
 * Cubre, como mínimo, lo pedido por el owner para cerrar Etapa 1:
 *   1. la referencia resuelve desde un resultado ESTRUCTURADO anterior (boleta), nunca de prosa/narración.
 *   2. una entidad de otro tenant se rechaza (nunca se cruza dato entre empresas).
 *   3. un cambio real de tema (plan.scope.level="global") no hereda nada al turno siguiente.
 *   4. una ambigüedad real dispara una pregunta con alternativas CONCRETAS (nunca un "¿para qué cliente?" genérico).
 * + una batería más chica de regresión (buildEntityList contra el hallazgo empírico de inventoryStatus,
 *   resolveOrdinalReference, y el caso obligatorio completo turno-a-turno hasta donde Etapa 1 alcanza).
 *
 * SECCIÓN 8 (owner 2026-08-04, "cierre de los límites restantes de conversationScope" — cierra el punto 1 del
 * encargo, bodega/canal como dimensión reconocida): fixtures NUEVOS que antes del fix de entityRecord.js/
 * conversationScope.js/specRetrieval.js hubieran fallado — bodega ganando la mayoría del voto de buildEntityList
 * (no existía ese caso: todos los fixtures previos de inventoryStatus tenían más candidatos SKU que bodega), el
 * entityScope de bodega FILTRANDO de verdad composeSpecInventory (antes: fallback suave lo ignoraba en silencio),
 * y la garantía multiempresa (empresa2, canal ausente por diseño del fixture) de que guessDimension sigue siendo
 * data-driven, nunca una lista fija.
 */
import {
  buildEntityList, updateConversationScope, resolveConversationReference, resolveOrdinalReference,
  validateScopeTenant, composeReferenceAmbiguity, composeReferenceDecline, emptyConversationScope,
} from "./src/adi/oracle/conversationScope.js";
import { guessDimension } from "./src/adi/oracle/entityRecord.js";
import { composeSpecInventory } from "./src/adi/specRetrieval.js";
import { initTenant, getTenantData } from "./src/data/tenantStore.js";
import { TENANTS } from "./src/data/tenants/index.js";

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log(`  OK  ${name}`); }
  else { fail++; console.log(`FAIL  ${name}${detail ? " — " + detail : ""}`); }
}
function section(title) { console.log(`\n== ${title} ==`); }

const TENANT_A = { tenantId: "acme-cl", dataSnapshotId: "acme-cl::actual", conversationId: "c1" };
const TENANT_B = { tenantId: "beta-cl", dataSnapshotId: "beta-cl::actual", conversationId: "c2" };

// ── helper: boleta shape real de inventoryStatus (foco "frenado" default) tal como se observó en vivo contra el
// dataset demo (2026-08-03): total → 2 bodegas → 2 familias → 3 SKU → 4 "Estado del inventario" → 1 "Medida".
function inventoryBoletaLike() {
  return {
    tool: "inventoryStatus",
    callId: "c0",
    facts: { lens: "inventory", metrica: "capital", dimension: "bodega", periodo: "foto de inventario a hoy — no es un promedio anual" },
    boleta: [
      { label: "Capital inmovilizado · total", value: "$33K" },
      { label: "Valparaíso · Capital detenido", value: "$25K" },
      { label: "Valparaíso · % del total", value: "75%" },
      { label: "Antofagasta · Capital detenido", value: "$8K" },
      { label: "Antofagasta · % del total", value: "25%" },
      { label: "Materiales de Construcción · Familia", value: "$20K" },
      { label: "Línea Blanca · Familia", value: "$14K" },
      { label: "LG-DRYER8KG · Capital detenido", value: "$14K" },
      { label: "LG-DRYER8KG · % del total", value: "41%" },
      { label: "BOS-SANDER · Capital detenido", value: "$11K" },
      { label: "BOS-SANDER · % del total", value: "34%" },
      { label: "MAK-COMP-AIR · Capital detenido", value: "$8K" },
      { label: "MAK-COMP-AIR · % del total", value: "25%" },
      { label: "Estado del inventario: capital detenido", value: "$33K" },
      { label: "Medida · liberar LG-DRYER8KG y MAK-COMP-AIR", value: "$22K" },
    ],
  };
}

function skuScopeEntry({ turno = 1, tenant = TENANT_A } = {}) {
  return {
    turno, dimension: "sku", entities: ["LG-DRYER8KG", "BOS-SANDER", "MAK-COMP-AIR"],
    selection: null, periodo: "foto de inventario a hoy — no es un promedio anual", filtros: null, metrica: null,
    operacion: "answer", modo: "diagnostico", tool: "inventoryStatus",
    origen: { callId: "c0", boletaLabels: [] },
    supuestos: [], faltantes: [], ofertaPendiente: null,
    tenant: { tenantId: tenant.tenantId, dataSnapshotId: tenant.dataSnapshotId },
  };
}

// ════════════════════════════════════════════════════════════════════════════════════════════════════════════
section("1 · buildEntityList — extrae SIEMPRE del resultado ESTRUCTURADO (boleta), nunca de prosa");
// ────────────────────────────────────────────────────────────────────────────────────────────────────────────
{
  const r = inventoryBoletaLike();
  const built = buildEntityList(r.tool, r);
  ok("resuelve dimension=sku (mayoría 3 SKU > 2 familias, empate roto por orden)", built && built.dimension === "sku", JSON.stringify(built));
  ok("entities = EXACTAMENTE los 3 SKU del caso obligatorio, en orden", built && JSON.stringify(built.entities) === JSON.stringify(["LG-DRYER8KG", "BOS-SANDER", "MAK-COMP-AIR"]), JSON.stringify(built && built.entities));
  ok("descarta 'Capital inmovilizado · total' / 'Estado del inventario…' / 'Medida · …' (no son entidades)", built && !built.entities.includes("Capital inmovilizado") && !built.entities.some((e) => e.startsWith("Estado") || e.startsWith("Medida")));
  // Etapa 1 (2026-08-04): guessDimension YA reconoce bodega — Valparaíso/Antofagasta SÍ son candidatos válidos
  // ahora (antes se descartaban como ruido), pero siguen sin entrar a `entities` en ESTE fixture porque SKU sigue
  // siendo la mayoría (3 sku > 2 bodega > 2 familia — bodega no cambia el ganador acá, ver sección 8 para el
  // fixture donde bodega SÍ gana la mayoría).
  ok("Valparaíso/Antofagasta SÍ son candidatos bodega válidos ahora (guessDimension los reconoce)", guessDimension("Valparaíso") === "bodega" && guessDimension("Antofagasta") === "bodega");
  ok("pero NO entran a `entities` en este fixture — SKU (3) sigue siendo mayoría sobre bodega (2)", built && !built.entities.includes("Valparaíso") && !built.entities.includes("Antofagasta"));

  // PROSA-NUNCA-FUENTE: un `facts` con un blob de prosa que MENCIONA una entidad decoy en texto libre (nunca en
  // boleta estructurada) NO debe filtrarse a `entities` — solo lo que vino en `.boleta`.
  const r2 = { tool: "inventoryStatus", facts: { resumenNarrado: "Como referencia, Falabella también tiene capital inmovilizado relevante." }, boleta: r.boleta };
  const built2 = buildEntityList(r2.tool, r2);
  ok("un campo de prosa en `facts` (resumenNarrado) NUNCA contamina `entities`", built2 && !built2.entities.includes("Falabella"), JSON.stringify(built2 && built2.entities));

  const rEmpty = { tool: "inventoryStatus", facts: {}, boleta: [{ label: "Benchmark de margen", value: "30%" }, { label: "Resto (3 de 8)", value: "$5K" }] };
  ok("boleta sin NINGUNA entidad real → null (nunca inventa un grupo)", buildEntityList(rEmpty.tool, rEmpty) === null);
}

// ════════════════════════════════════════════════════════════════════════════════════════════════════════════
section("2 · updateConversationScope — cambio real de tema (plan.scope.level=global) NO hereda nada");
// ────────────────────────────────────────────────────────────────────────────────────────────────────────────
{
  const scopePrev = { version: 1, current: skuScopeEntry({ turno: 1 }), history: [] };
  const planGlobal = { intent: "answer", mode: "default", scope: { level: "global" } };
  const next = updateConversationScope(scopePrev, { plan: planGlobal, calls: [{ tool: "executiveSummary", args: {} }], results: [{ tool: "executiveSummary", facts: {}, boleta: [] }], turno: 2, requestContext: TENANT_A });
  ok("current.dimension pasa a 'cartera'", next.current.dimension === "cartera", JSON.stringify(next.current));
  ok("current.entities queda VACÍO — no hereda los 3 SKU", Array.isArray(next.current.entities) && next.current.entities.length === 0);
  ok("el scope viejo se retira a `history[0]` (no se pierde, pero deja de ser `current`)", next.history[0] && JSON.stringify(next.history[0].entities) === JSON.stringify(["LG-DRYER8KG", "BOS-SANDER", "MAK-COMP-AIR"]));

  // y el turno SIGUIENTE, sin ninguna marca de "de antes"/"anterior", un deíctico plano NO debe resolver a lo viejo:
  const planNext = { intent: "answer", mode: "default", scope: { level: "entity", entities: [] } };
  const refAfterReset = resolveConversationReference("¿y estos clientes también?", planNext, next, TENANT_A);
  ok("tras el reset, un deíctico plano no resucita el grupo abandonado (current=cartera, vacío)", refAfterReset.kind !== "resolved", JSON.stringify(refAfterReset));
}

// ════════════════════════════════════════════════════════════════════════════════════════════════════════════
section("3 · resolveConversationReference — resuelve SIEMPRE desde el resultado estructurado, nunca de prosa");
// ────────────────────────────────────────────────────────────────────────────────────────────────────────────
{
  // caso obligatorio, turno 3: "¿Qué pasa si subo 3% el precio de estos SKU?" — PLAN falló en poblar scope.entities
  // (el bug real que dispara este trabajo). scopePrev.current viene de un turno 2 estructurado (inventoryStatus).
  const scopePrev = { version: 1, current: skuScopeEntry({ turno: 1 }), history: [] };
  const plan = { intent: "answer", mode: "simulacion", scope: { level: "list", entities: [] }, calls: [] };
  // "prosa/rationale" DECOY: si el resolver alguna vez empezara a leer texto libre en vez del scope estructurado,
  // este decoy (un nombre de cliente que NO está en el scope estructurado) se filtraría — se afirma que no.
  const planConDecoy = { ...plan, rationale: "el usuario habla de Falabella y de un aumento de precio" };
  const res = resolveConversationReference("¿Qué pasa si subo 3% el precio de estos SKU?", planConDecoy, scopePrev, TENANT_A);
  ok("kind=resolved", res.kind === "resolved", JSON.stringify(res));
  ok("dimension=sku", res.dimension === "sku");
  ok("entities = LOS 3 SKU EXACTOS del turno 2 (nunca 'Falabella', que solo vive en rationale/prosa)", JSON.stringify(res.entities) === JSON.stringify(["LG-DRYER8KG", "BOS-SANDER", "MAK-COMP-AIR"]), JSON.stringify(res.entities));
  ok("NUNCA incluye la entidad decoy de la prosa (Falabella)", !res.entities.includes("Falabella"));

  // si PLAN YA acertó solo (nombra las 3 entidades correctas), el resolver no debe tocar nada (kind:none = no-op)
  const planYaResuelto = { intent: "answer", mode: "simulacion", scope: { level: "list", entities: ["LG-DRYER8KG", "BOS-SANDER", "MAK-COMP-AIR"] } };
  const res2 = resolveConversationReference("¿Qué pasa si subo 3% el precio de estos SKU?", planYaResuelto, scopePrev, TENANT_A);
  ok("PLAN ya acertó solo → kind=none (no se superpone)", res2.kind === "none", JSON.stringify(res2));

  // "haz lo mismo con Falabella" — PLAN nombra a Falabella explícitamente (nombre nuevo, real, resoluble) → no hay
  // nada que resolver acá (PLAN ya lo entendió por comprensión); el resolver debe apartarse.
  const planFalabella = { intent: "answer", mode: "seguimiento", scope: { level: "entity", entities: ["Falabella"] } };
  const res3 = resolveConversationReference("haz lo mismo con Falabella", planFalabella, scopePrev, TENANT_A);
  ok("'haz lo mismo con Falabella' (PLAN ya nombró una entidad real) → kind=none", res3.kind === "none", JSON.stringify(res3));
}

// ════════════════════════════════════════════════════════════════════════════════════════════════════════════
section("4 · tenant — una entidad/scope de OTRO tenant se rechaza, nunca se cruza dato entre empresas");
// ────────────────────────────────────────────────────────────────────────────────────────────────────────────
{
  const scopeOfTenantB = { version: 1, current: skuScopeEntry({ turno: 1, tenant: TENANT_B }), history: [] };
  const plan = { intent: "answer", mode: "simulacion", scope: { level: "list", entities: [] } };

  const tCheck = validateScopeTenant(scopeOfTenantB, TENANT_A);
  ok("validateScopeTenant detecta el mismatch (ok=false)", tCheck.ok === false, JSON.stringify(tCheck));
  ok("el reason nombra AMBOS tenants (auditable)", tCheck.reason.includes("beta-cl") && tCheck.reason.includes("acme-cl"));

  const res = resolveConversationReference("¿Qué pasa si subo 3% el precio de estos SKU?", plan, scopeOfTenantB, TENANT_A);
  ok("resolveConversationReference RECHAZA (kind=decline), nunca resuelve al scope de otro tenant", res.kind === "decline", JSON.stringify(res));
  ok("reason='otro_tenant'", res.reason === "otro_tenant");
  ok("el objeto de resultado NUNCA trae los SKU del tenant ajeno (no hay leak de `entities`)", !res.entities);

  const composed = composeReferenceDecline(res.reason);
  ok("el mensaje de rechazo es honesto (no inventa/pretende continuar)", /otra empresa|no puedo reusarla/i.test(composed), composed);

  // control: MISMO tenant → sí resuelve (para confirmar que el rechazo de arriba es específico del mismatch, no un bug general)
  const scopeOfTenantA = { version: 1, current: skuScopeEntry({ turno: 1, tenant: TENANT_A }), history: [] };
  const resOk = resolveConversationReference("¿Qué pasa si subo 3% el precio de estos SKU?", plan, scopeOfTenantA, TENANT_A);
  ok("control: mismo tenant → sí resuelve normalmente", resOk.kind === "resolved", JSON.stringify(resOk));
}

// ════════════════════════════════════════════════════════════════════════════════════════════════════════════
section("5 · ambigüedad real — alternativas CONCRETAS, nunca un '¿para qué cliente?' genérico");
// ────────────────────────────────────────────────────────────────────────────────────────────────────────────
{
  const clienteActual = {
    turno: 3, dimension: "cliente", entities: ["Falabella"], selection: null, periodo: null, filtros: null,
    metrica: null, operacion: "answer", modo: "default", tool: "entityProfile",
    origen: { callId: "c2", boletaLabels: [] }, supuestos: [], faltantes: [], ofertaPendiente: null,
    tenant: { tenantId: TENANT_A.tenantId, dataSnapshotId: TENANT_A.dataSnapshotId },
  };
  const clienteHistorico = {
    turno: 1, dimension: "cliente", entities: ["Sodimac", "Jumbo"], selection: null, periodo: null, filtros: null,
    metrica: null, operacion: "answer", modo: "default", tool: "compareEntities",
    origen: { callId: "c0", boletaLabels: [] }, supuestos: [], faltantes: [], ofertaPendiente: null,
    tenant: { tenantId: TENANT_A.tenantId, dataSnapshotId: TENANT_A.dataSnapshotId },
  };
  const scopePrev = { version: 1, current: clienteActual, history: [clienteHistorico] };
  const plan = { intent: "answer", mode: "simulacion", scope: { level: "list", entities: [] } };

  // "esos clientes de antes" — deíctico + marca de recuerdo explícita ("de antes") + pista de dimensión (clientes)
  // → 2 grupos de dimension="cliente" igual de válidos (el actual Y el histórico) → ambigüedad REAL.
  const res = resolveConversationReference("¿simulamos con esos clientes de antes?", plan, scopePrev, TENANT_A);
  ok("kind=ambiguous", res.kind === "ambiguous", JSON.stringify(res));
  ok("trae 2+ opciones CONCRETAS", Array.isArray(res.options) && res.options.length >= 2, JSON.stringify(res.options));

  const composed = composeReferenceAmbiguity(res.options);
  ok("el mensaje nombra Falabella (grupo actual) en concreto", composed.includes("Falabella"), composed);
  ok("el mensaje nombra Sodimac Y Jumbo (grupo histórico) en concreto", composed.includes("Sodimac") && composed.includes("Jumbo"), composed);
  ok("NUNCA cae al genérico '¿para qué cliente?' (el bug obligatorio que este trabajo cierra)", !/¿para\s+qu[eé]\s+cliente/i.test(composed), composed);

  // control: SIN la marca "de antes" (deíctico plano), no hay ambigüedad — resuelve directo al grupo VIGENTE
  // (current), nunca mira history (ver sección 2 — mismo principio "no hereda nada sin marca explícita").
  const resPlano = resolveConversationReference("¿simulamos con esos clientes?", plan, scopePrev, TENANT_A);
  ok("sin 'de antes': deíctico plano resuelve DIRECTO al grupo vigente (Falabella), sin preguntar", resPlano.kind === "resolved" && JSON.stringify(resPlano.entities) === JSON.stringify(["Falabella"]), JSON.stringify(resPlano));
}

// ════════════════════════════════════════════════════════════════════════════════════════════════════════════
section("6 · resolveOrdinalReference — 'el primero'/'los dos peores' recortan sin re-derivar el ranking");
// ────────────────────────────────────────────────────────────────────────────────────────────────────────────
{
  const currentDesc = {
    dimension: "cliente", entities: ["Falabella", "Sodimac", "Jumbo", "Ripley"],
    selection: { orden: "descendente por Margen", subset: { kind: "top", n: 4 } },
  };
  ok("'el primero' → el primero de la lista sellada", JSON.stringify(resolveOrdinalReference("profundiza en el primero", currentDesc).entities) === JSON.stringify(["Falabella"]));
  ok("'los dos primeros' → slice(0,2)", JSON.stringify(resolveOrdinalReference("compara los dos primeros", currentDesc).entities) === JSON.stringify(["Falabella", "Sodimac"]));
  // descendente (mayor primero) → "los peores" (margen más bajo) están al FINAL de la lista mostrada
  ok("'los dos peores' (orden descendente) → los ÚLTIMOS 2 de la lista", JSON.stringify(resolveOrdinalReference("compara los dos peores", currentDesc).entities) === JSON.stringify(["Jumbo", "Ripley"]));
  ok("'el mejor' (orden descendente) → el primero", JSON.stringify(resolveOrdinalReference("dame el mejor", currentDesc).entities) === JSON.stringify(["Falabella"]));

  const currentAsc = { dimension: "sku", entities: ["A", "B", "C"], selection: { orden: "ascendente por Rotación" } };
  ok("'el peor' (orden ascendente) → el primero (el valor más bajo YA está primero)", JSON.stringify(resolveOrdinalReference("el peor", currentAsc).entities) === JSON.stringify(["A"]));

  ok("sin selection.orden, 'peor/mejor' no se adivina (null)", resolveOrdinalReference("el peor", { dimension: "sku", entities: ["A", "B"], selection: null }) === null);
  ok("texto sin ningún patrón ordinal → null", resolveOrdinalReference("cómo viene la venta", currentDesc) === null);
}

// ════════════════════════════════════════════════════════════════════════════════════════════════════════════
section("7 · turno sin dato nuevo no pisa el scope anterior (mejor no actualizar que perder memoria)");
// ────────────────────────────────────────────────────────────────────────────────────────────────────────────
{
  const scopePrev = { version: 1, current: skuScopeEntry({ turno: 1 }), history: [] };
  const planDefine = { intent: "define", mode: "clarify", scope: { level: "entity", entities: [] } };
  const declined = { tool: "entityProfile", facts: null, boleta: [], coverage: { supported: false, reason: "no encuentro esa entidad" } };
  const next = updateConversationScope(scopePrev, { plan: planDefine, calls: [{ tool: "defineConcept", args: {} }], results: [declined], turno: 2, requestContext: TENANT_A });
  ok("current se conserva tal cual (no se pisa con un scope vacío)", JSON.stringify(next.current.entities) === JSON.stringify(["LG-DRYER8KG", "BOS-SANDER", "MAK-COMP-AIR"]), JSON.stringify(next.current));
}

// ════════════════════════════════════════════════════════════════════════════════════════════════════════════
section("8 · Etapa 1 (2026-08-04) — bodega/canal como dimensión reconocida");
// ────────────────────────────────────────────────────────────────────────────────────────────────────────────
{
  // 8a · guessDimension reconoce bodega/canal (case/acento-insensitive, mismo mecanismo que sku/cliente/marca/familia)
  ok("guessDimension('Valparaíso') === 'bodega'", guessDimension("Valparaíso") === "bodega");
  ok("guessDimension('valparaiso' sin acento/minúscula) === 'bodega' (normalización case/acento)", guessDimension("valparaiso") === "bodega");
  ok("guessDimension('Retail') === 'canal'", guessDimension("Retail") === "canal");
  ok("guessDimension(nombre inexistente) === null (nunca inventa un eje)", guessDimension("NoExisteXYZ123") === null);

  // 8b · buildEntityList — fixture NUEVO donde BODEGA gana la mayoría del voto (4 bodegas vs 3 SKU vs 2 familias) —
  // este caso NO existía antes del fix (todos los fixtures previos tenían más candidatos SKU que bodega).
  const inventoryBodegaMajority = {
    tool: "inventoryStatus",
    callId: "c1",
    facts: { lens: "inventory", metrica: "capital", dimension: "bodega" },
    boleta: [
      { label: "Capital inmovilizado · total", value: "$50K" },
      { label: "Santiago · Capital detenido", value: "$15K" },
      { label: "Valparaíso · Capital detenido", value: "$14K" },
      { label: "Concepción · Capital detenido", value: "$12K" },
      { label: "Antofagasta · Capital detenido", value: "$9K" },
      { label: "Línea Blanca · Familia", value: "$20K" },
      { label: "Electrodomésticos · Familia", value: "$18K" },
      { label: "LG-DRYER8KG · Capital detenido", value: "$14K" },
      { label: "BOS-SANDER · Capital detenido", value: "$11K" },
      { label: "MAK-COMP-AIR · Capital detenido", value: "$8K" },
      { label: "Estado del inventario: capital detenido", value: "$50K" },
    ],
  };
  const builtBod = buildEntityList(inventoryBodegaMajority.tool, inventoryBodegaMajority);
  ok("dimension='bodega' (4 bodegas > 3 SKU > 2 familias — bodega gana la mayoría)", builtBod && builtBod.dimension === "bodega", JSON.stringify(builtBod));
  ok("entities = las 4 bodegas, en orden de aparición en la boleta", builtBod && JSON.stringify(builtBod.entities) === JSON.stringify(["Santiago", "Valparaíso", "Concepción", "Antofagasta"]), JSON.stringify(builtBod && builtBod.entities));

  // 8c · el scope de bodega alimenta updateConversationScope/resolveConversationReference como cualquier otro eje
  // (el mecanismo universal — nada especial para bodega/canal a partir de acá, confirma el punto 1 del encargo:
  // "confirma que conversationScope.js/buildEntityList YA los captura vía boleta — no asumas, confirmalo").
  const scopeAfterBodega = updateConversationScope(emptyConversationScope(), {
    plan: { intent: "answer", mode: "diagnostico", scope: { level: "none" } },
    calls: [{ tool: "inventoryStatus", args: {} }], results: [inventoryBodegaMajority], turno: 1, requestContext: { tenantId: "acme-cl", dataSnapshotId: "acme-cl::actual" },
  });
  ok("conversationScope.current.dimension='bodega' tras el turno", scopeAfterBodega.current && scopeAfterBodega.current.dimension === "bodega");
  const refBodega = resolveConversationReference("¿y esas bodegas, cómo vienen?", { intent: "answer", mode: "default", scope: { level: "list", entities: [] } }, scopeAfterBodega, { tenantId: "acme-cl", dataSnapshotId: "acme-cl::actual" });
  ok("'esas bodegas' resuelve kind=resolved dimension=bodega (deíctico plural + hint 'bodegas')", refBodega.kind === "resolved" && refBodega.dimension === "bodega", JSON.stringify(refBodega));
  ok("entities = las 4 bodegas exactas", JSON.stringify(refBodega.entities) === JSON.stringify(["Santiago", "Valparaíso", "Concepción", "Antofagasta"]), JSON.stringify(refBodega.entities));

  // 8d · EL BLOCKER REAL (specRetrieval.js _scopeRows): un entityScope de bodega debe FILTRAR composeSpecInventory
  // de verdad — antes del fix del punto 3, el fallback suave lo ignoraba en silencio (comparaba solo r.nombre/r.sku,
  // nunca matcheaba un nombre de bodega, y devolvía el eje completo sin avisar).
  const fullInv = composeSpecInventory({ filters: {}, scenario: "actual", focus: "frenado" });
  const scopedInv = composeSpecInventory({ filters: {}, scenario: "actual", focus: "frenado", entityScope: { entities: ["Valparaíso"] } });
  ok("sin scope: composeSpecInventory trae MÁS de 1 bodega (Valparaíso Y Antofagasta)", fullInv && fullInv.evidence.inventory.byBodega.length >= 2, JSON.stringify(fullInv && fullInv.evidence.inventory.byBodega));
  ok("CON entityScope=['Valparaíso']: composeSpecInventory filtra a SOLO esa bodega (el fix real)", scopedInv && scopedInv.evidence.inventory.byBodega.length === 1 && scopedInv.evidence.inventory.byBodega[0].bodega === "Valparaíso", JSON.stringify(scopedInv && scopedInv.evidence.inventory.byBodega));
  ok("y los SKU del resultado scoped son SOLO los de Valparaíso (LG-DRYER8KG, BOS-SANDER — no MAK-COMP-AIR de Antofagasta)", scopedInv && JSON.stringify(scopedInv.evidence.inventory.bySku.map((s) => s.sku).sort()) === JSON.stringify(["BOS-SANDER", "LG-DRYER8KG"]), JSON.stringify(scopedInv && scopedInv.evidence.inventory.bySku.map((s) => s.sku)));

  // 8e · MULTIEMPRESA — empresa2 (canal ausente por diseño del fixture, ver src/data/tenants/empresa2.js línea 6)
  // sigue devolviendo null: el mecanismo es DATA-DRIVEN por tenant, nunca una lista fija hardcodeada. bodega SÍ
  // existe en empresa2 (Bodega Norte/Centro/Sur) — confirma que el fix no es "todo o nada" por tenant.
  const _tenantBefore = getTenantData();
  try {
    initTenant(TENANTS.empresa2);
    ok("empresa2: guessDimension('Retail') === null (canal ausente por diseño, NUNCA inventado)", guessDimension("Retail") === null);
    ok("empresa2: guessDimension('Bodega Norte') === 'bodega' (bodega SÍ existe en este tenant)", guessDimension("Bodega Norte") === "bodega");
    ok("empresa2: guessDimension('AC-COLA-3L') === 'sku' (ejes no-groupby siguen intactos)", guessDimension("AC-COLA-3L") === "sku");
  } finally {
    initTenant(_tenantBefore);   // restaura el tenant activo — nunca dejar el proceso en un tenant distinto al que empezó
  }
}

console.log(`\n${pass}/${pass + fail} OK` + (fail ? `  — ${fail} FALLO(S)` : ""));
process.exit(fail ? 1 : 0);
