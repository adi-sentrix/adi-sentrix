/* === src/adi/oracle/toolContracts.js · ARQUITECTURA C · CONTRATOS DE TOOLS — Etapa 2/3 ===
 * owner (pedido "continuidad conversacional universal", 2026-08-03) — Etapa 2 del diseño: "cada tool debe declarar
 * dimensiones soportadas, si acepta una o varias entidades, inputs obligatorios, supuestos requeridos, operación
 * válida, y el resultado estructurado que debe escribir de vuelta al conversationScope. Generalizar las tools que
 * hoy asumen una sola entidad o dimension=cliente. Si una operación no admite varias entidades, ADI debe
 * EXPLICARLO y ofrecer ejecutarla por separado — nunca cambiar de dimensión en silencio."
 *
 * Este módulo tiene DOS partes:
 *   1. TOOL_CONTRACTS — la tabla declarativa, UNA entrada por cada tool de toolRegistry.js (TOOLS), verificada por
 *      lectura directa del código de cada tool/composer (nunca adivinada) — ver `_tool_contracts_gate.mjs` (local)
 *      para el chequeo de completitud (TOOL_CONTRACTS cubre EXACTAMENTE las tools registradas, ni más ni menos).
 *   2. applyMultiEntityScope(plan, calls, maxCalls) — el backstop DETERMINÍSTICO que decide, call por call, QUÉ
 *      HACER cuando `plan.scope.level==="list"` trae 2+ entidades (resueltas por conversationScope.js — Etapa 1 —
 *      o por PLAN mismo, por comprensión): puebla `args.entityScope`/`args.entities` para las tools que sí lo
 *      soportan, expande a N calls (fan-out) para las que lo soportan "una por una", y DECLINA con una alternativa
 *      CONCRETA (nunca fuerza ni cambia de eje en silencio) para las que genuinamente no admiten una lista.
 *
 * `entidad` (vocabulario del contrato):
 *   "none"              la tool NO toma una entidad puntual — rankea/agrega TODO el eje (opcionalmente acotado por
 *                        UN filtro, nunca una lista) — ej. queryMetric/gridTable/diagnose/marginRead.
 *   "single"             la tool SIEMPRE opera sobre EXACTAMENTE una entidad nombrada — ej. entityProfile/trend.
 *   "multi"               la tool toma una LISTA de entidades con cardinalidad FIJA — ej. compareEntities (2).
 *   "multi-vía-fanout"    la tool SOLO sabe correr sobre una entidad a la vez — el multi-entidad se logra
 *                         EXPANDIENDO el plan a N calls idénticas (una por entidad), nunca tocando la tool.
 *
 * `aceptaEntidadPuntual` — true si esta tool tiene ALGÚN concepto de "acotar a una entidad/lista" en sus args (filtro
 * de UN valor, `entity`, `entities`, o `entityScope`). false = la tool es de alcance global puro (defineConcept,
 * executiveSummary, el `simulate` genérico) — un scope multi-entidad heredado NUNCA la toca (no aplica, no declina).
 *
 * `entityScopeNativo` — true si la tool YA recibe/aplica `args.entityScope={entities:[...]}` end-a-end (4 tools lo
 * traían de fábrica — inventoryStatus/marginRead/salesRead/contributionRead, ver specRetrieval.js `_scopeRows`;
 * Etapa 2 generaliza el MISMO parámetro, mecánicamente, a queryMetric/gridTable/tensionRead/simulateCosto — ver el
 * comentario de cada composer tocado en specRetrieval.js/entityRecord.js/toolRegistry.js. Sesión posterior, cierre
 * del núcleo (owner 2026-08-04): mismo parámetro generalizado a diagnose/simulateCarga/simulateCapital — ver el
 * comentario de cada entrada abajo y de _diagComercial/_diagCapital/composeSpecDiagnose en specRetrieval.js).
 *
 * `escribeEntityList` — documentación (no gatea nada acá): si la boleta de esta tool sigue la convención
 * "<entidad> · <label>" que conversationScope.js:buildEntityList lee para reconstruir conversationScope.current.
 * entities el turno siguiente — false SOLO para las tools cuya boleta nunca nombra una entidad puntual
 * (defineConcept: boleta siempre vacía).
 */
import { guessDimension } from "./entityRecord.js";

// ── LA TABLA ─────────────────────────────────────────────────────────────────────────────────────────────────────
export const TOOL_CONTRACTS = {
  // queryMetric · ranking/lista de UNA métrica × UN eje. Etapa 2: entityScope generalizado (composeSpecRetrieval,
  // specRetrieval.js) — "de esos SKU, ¿cuál vendió más?" ahora se acota al subconjunto en vez de mostrar el ranking
  // completo del eje. bodega/canal quedan soportados como eje (ya lo estaban) y desde Etapa 1 (owner 2026-08-04)
  // conversationScope también resuelve entidades de esos 2 ejes (guessDimension las reconoce, entityRecord.js) —
  // el entityScope ahora sí puede llegar poblado para "esas bodegas"/"esos canales" (composeSpecRetrieval no
  // necesitó cambios: ya filtraba por el `name` agregado del grupo, sin depender de r.nombre/r.sku crudo).
  queryMetric: {
    dimensionesSoportadas: ["cliente", "sku", "marca", "familia", "bodega", "canal"],
    entidad: "none", aceptaEntidadPuntual: true, multiCardinality: null,
    inputsObligatorios: ["metric", "dimension"], supuestosRequeridos: null, operacionValida: ["answer"],
    entityScopeNativo: true, escribeEntityList: true,
    notas: "Etapa 2: entityScope generalizado (antes solo aceptaba UN filtro por marca/familia/bodega, nunca cliente ni una lista).",
  },
  // entityProfile · perfil de UNA entidad (todas sus métricas + benchmark). Nunca multi — perfilar 2+ entidades a la
  // vez mezclaría benchmarks/brechas de negocios distintos en el mismo bloque; compareEntities es la tool correcta
  // para "2 entidades lado a lado". Un scope de 2+ → decline + oferta de correrlas una por una (nunca la primera en silencio).
  entityProfile: {
    dimensionesSoportadas: ["cliente", "sku", "marca", "familia"],
    entidad: "single", aceptaEntidadPuntual: true, multiCardinality: null,
    inputsObligatorios: ["dimension", "entity"], supuestosRequeridos: null, operacionValida: ["answer", "define"],
    entityScopeNativo: false, escribeEntityList: true,
  },
  // entityRecord · LA FILA COMPLETA de una entidad (todas sus columnas crudas). Mismo motivo que entityProfile:
  // una fila es de UNA entidad por diseño — 2+ entidades a la vez es gridTable (la grilla), no esta tool.
  entityRecord: {
    dimensionesSoportadas: ["cliente", "sku", "marca", "familia"],
    entidad: "single", aceptaEntidadPuntual: true, multiCardinality: null,
    inputsObligatorios: ["dimension", "entity"], supuestosRequeridos: null, operacionValida: ["answer"],
    entityScopeNativo: false, escribeEntityList: true,
  },
  // entityComposicion · cómo se compone la compra de UN cliente por familia (venta/contribución/margen). Nunca
  // multi por el mismo motivo que entityProfile — es SOLO eje cliente (marca/familia/SKU no tienen "de qué se
  // compone" en este sentido, ver composeSpecComposicion en specRetrieval.js).
  entityComposicion: {
    dimensionesSoportadas: ["cliente"],
    entidad: "single", aceptaEntidadPuntual: true, multiCardinality: null,
    inputsObligatorios: ["dimension", "entity"], supuestosRequeridos: null, operacionValida: ["answer"],
    entityScopeNativo: false, escribeEntityList: true,
  },
  // entityCapitalLigado · inventario inmovilizado cruzado contra el surtido de UN cliente (SKU/bodega/valorizado/
  // unidades/días sin venta). Solo eje cliente, misma razón que entityComposicion.
  // DECISIÓN 9 (owner 2026-08-09): el eje soportado NO alcanza — esta tool además exige que el DATO sostenga la
  // relación cliente×SKU. Con `datasetCapability().crosses.atomic === false` y una afinidad modelada que alcanza
  // todo el inventario, DECLINA (supported:false + relación + razón medida) en vez de servir el inventario global
  // con el nombre de un cliente encima. La medición vive en `specRetrieval.clientCapitalRelacion`.
  entityCapitalLigado: {
    dimensionesSoportadas: ["cliente"],
    entidad: "single", aceptaEntidadPuntual: true, multiCardinality: null,
    inputsObligatorios: ["dimension", "entity"], supuestosRequeridos: null, operacionValida: ["answer"],
    entityScopeNativo: false, escribeEntityList: true,
  },
  // gridTable · LA GRILLA: top-N de un eje × todas sus columnas. Etapa 2: entityScope generalizado (buildGrid,
  // entityRecord.js) — "de esos clientes, armame la tabla" ahora filtra las filas al subconjunto ANTES de rankear/
  // recortar a `limit`, en vez de traer el top-N del eje entero.
  gridTable: {
    dimensionesSoportadas: ["cliente", "sku", "marca", "familia"],
    entidad: "none", aceptaEntidadPuntual: true, multiCardinality: null,
    inputsObligatorios: ["dimension"], supuestosRequeridos: null, operacionValida: ["answer"],
    entityScopeNativo: true, escribeEntityList: true,
    notas: "Etapa 2: entityScope generalizado (antes rankeaba SIEMPRE el eje entero, sin forma de acotar a una lista).",
  },
  // tensionRead · cruce de 2 métricas del MISMO eje (top-N por cada una + intersección). Etapa 2: entityScope
  // generalizado (buildTension, entityRecord.js) — "de esos SKU, ¿quién sostiene contribución vs consume capital?"
  // ahora cruza solo el subconjunto, en vez del eje completo.
  tensionRead: {
    dimensionesSoportadas: ["cliente", "sku", "marca", "familia"],
    entidad: "none", aceptaEntidadPuntual: true, multiCardinality: null,
    inputsObligatorios: ["dimension"], supuestosRequeridos: null, operacionValida: ["answer"],
    entityScopeNativo: true, escribeEntityList: true,
    notas: "Etapa 2: entityScope generalizado (antes cruzaba SIEMPRE el eje entero).",
  },
  // compareEntities · 2 entidades lado a lado. Cardinalidad FIJA {min:2,max:2} — composeSpecCompare (specRetrieval.js)
  // ya rechaza !=2 estructuralmente (destino: null → coverage.supported=false). Con 3+ en el scope, applyMultiEntity
  // Scope decline ANTES de correr la tool (nunca deja que el composer se quede con las 2 primeras en silencio) —
  // ofrece comparar de a pares o el ranking completo (gridTable) de las N.
  compareEntities: {
    dimensionesSoportadas: ["cliente", "sku", "marca", "familia"],
    entidad: "multi", aceptaEntidadPuntual: true, multiCardinality: { min: 2, max: 2 },
    inputsObligatorios: ["dimension", "entities"], supuestosRequeridos: null, operacionValida: ["answer"],
    entityScopeNativo: false, escribeEntityList: true,
  },
  // diagnose · barre TODOS los detectores (contribución no capturada · carga alta · capital detenido) del eje
  // comercial (cliente) + capital (sku) A LA VEZ. Etapa 2 (owner 2026-08-04, generalización multientidad diagnose/
  // simulateCarga/simulateCapital): entityScope generalizado (composeSpecDiagnose → _diagComercial/_diagCapital,
  // specRetrieval.js) — "de esos clientes, ¿dónde perdemos plata?" acota el barrido al subconjunto pedido. FILTRADO
  // (nunca fan-out): ambos detectores siguen recorriendo su eje en un pase y agregando por foco, solo que acotados.
  // Un entityScope de UN solo eje (ej. solo clientes) deja el foco del OTRO eje (capital) intacto — el fallback
  // suave de _scopeRows (Etapa 1) ignora el scope cuando no intersecta ese eje, nunca lo fuerza ni lo vacía.
  diagnose: {
    dimensionesSoportadas: ["cliente", "sku"],
    entidad: "none", aceptaEntidadPuntual: true, multiCardinality: null,
    inputsObligatorios: [], supuestosRequeridos: null, operacionValida: ["answer", "redirect"],
    entityScopeNativo: true, escribeEntityList: true,
    notas: "Etapa 2: entityScope generalizado (antes CONSCIENTEMENTE no generalizado — decline ante 2+ entidades).",
  },
  // executiveSummary · la lectura completa de 5 movimientos del NEGOCIO ENTERO — no tiene concepto de entidad.
  executiveSummary: {
    dimensionesSoportadas: [],
    entidad: "none", aceptaEntidadPuntual: false, multiCardinality: null,
    inputsObligatorios: [], supuestosRequeridos: null, operacionValida: ["answer"],
    entityScopeNativo: false, escribeEntityList: true,
  },
  // inventoryStatus · estado de inventario (capital detenido/frenado/cobertura), implícito sobre sku/bodega. YA
  // nativo de fábrica (composeSpecInventory acepta entityScope desde antes de este trabajo) — el caso obligatorio
  // del owner ("estos SKU") pasa por acá.
  inventoryStatus: {
    dimensionesSoportadas: ["sku", "bodega"],
    entidad: "none", aceptaEntidadPuntual: true, multiCardinality: null,
    inputsObligatorios: [], supuestosRequeridos: null, operacionValida: ["answer"],
    entityScopeNativo: true, escribeEntityList: true,
  },
  // marginRead/salesRead/contributionRead · lectura por eje (bajo benchmark/vs anterior/no capturada), YA nativas
  // de fábrica (_scopeRows ya las trae generalizadas desde antes de este trabajo) — bodega queda fuera (gap
  // preexistente del motor, no introducido acá: _MLBL de specRetrieval.js no declara bodega para estas 3).
  marginRead: {
    dimensionesSoportadas: ["cliente", "sku", "marca", "familia"],
    entidad: "none", aceptaEntidadPuntual: true, multiCardinality: null,
    inputsObligatorios: [], supuestosRequeridos: null, operacionValida: ["answer"],
    entityScopeNativo: true, escribeEntityList: true,
  },
  salesRead: {
    dimensionesSoportadas: ["cliente", "sku", "marca", "familia"],
    entidad: "none", aceptaEntidadPuntual: true, multiCardinality: null,
    inputsObligatorios: [], supuestosRequeridos: null, operacionValida: ["answer"],
    entityScopeNativo: true, escribeEntityList: true,
  },
  contributionRead: {
    dimensionesSoportadas: ["cliente", "sku", "marca", "familia"],
    entidad: "none", aceptaEntidadPuntual: true, multiCardinality: null,
    inputsObligatorios: [], supuestosRequeridos: null, operacionValida: ["answer"],
    entityScopeNativo: true, escribeEntityList: true,
  },
  // trend · LA SERIE MENSUAL de UNA entidad (o global, sin entity/dimension). Overlay de 2+ series en el mismo
  // gráfico NO está soportado (composeSpecTemporal es de una sola entidad) — 2+ en el scope → decline + oferta de
  // traer la serie de cada una por separado.
  trend: {
    dimensionesSoportadas: ["cliente", "sku", "marca", "familia"],
    entidad: "single", aceptaEntidadPuntual: true, multiCardinality: null,
    inputsObligatorios: [], supuestosRequeridos: null, operacionValida: ["answer"],
    entityScopeNativo: false, escribeEntityList: false,
  },
  // simulate · el simulador GENÉRICO legacy (delta-% lineal sobre un nivel, sin entidad puntual) — de alcance por
  // eje/filtro, nunca por entidad nombrada (simulateGeneral es la tool con entidad; ésta quedó de una etapa previa).
  simulate: {
    dimensionesSoportadas: ["cliente", "sku", "marca", "familia"],
    entidad: "none", aceptaEntidadPuntual: false, multiCardinality: null,
    inputsObligatorios: ["metric", "dimension", "transform"], supuestosRequeridos: ["transform"], operacionValida: ["answer"],
    entityScopeNativo: false, escribeEntityList: false,
  },
  // simulateCarga/simulateCapital · simulaciones de UNA acción fija (llevar la carga al target · liberar el capital
  // detenido) — reusan composeSpecDiagnose por debajo (una verdad, cero cálculo nuevo). Etapa 2 (owner 2026-08-04):
  // entityScope generalizado (mismo forwarding que diagnose arriba) — "de esos clientes, ¿y si bajamos la carga al
  // target?" acota la simulación al subconjunto. RIESGO DE COPY aceptado (no funcional, documentado en
  // specRetrieval.js): cuando la única entidad llega vía entityScope (no vía filters.cliente/filters.bodega), la
  // frase "Dónde pega" cae a la variante de lista en vez de nombrar la entidad — mismo dato correcto, prosa menos
  // personalizada. No se corrige en esta etapa salvo pedido explícito del owner.
  simulateCarga: {
    dimensionesSoportadas: ["cliente"],
    entidad: "none", aceptaEntidadPuntual: true, multiCardinality: null,
    inputsObligatorios: [], supuestosRequeridos: null, operacionValida: ["answer"],
    entityScopeNativo: true, escribeEntityList: true,
    notas: "Etapa 2: entityScope generalizado (antes CONSCIENTEMENTE no generalizado — decline ante 2+ entidades).",
  },
  simulateCapital: {
    dimensionesSoportadas: ["sku"],
    entidad: "none", aceptaEntidadPuntual: true, multiCardinality: null,
    inputsObligatorios: [], supuestosRequeridos: null, operacionValida: ["answer"],
    entityScopeNativo: true, escribeEntityList: true,
    notas: "Etapa 2: entityScope generalizado (antes CONSCIENTEMENTE no generalizado — decline ante 2+ entidades).",
  },
  // simulateCosto · simulación de costo medio ±% sobre un SUBCONJUNTO del eje (bajo_benchmark|all) acotado por
  // `filters`. Etapa 2: entityScope generalizado (composeSpecSimulateCosto, specRetrieval.js — antes pasaba `null`
  // HARDCODEADO como 3er arg de `_scopeRows`, ignorando cualquier alcance heredado) — "de esos SKU, ¿y si bajo el
  // costo medio 3%?" ahora corre solo sobre el subconjunto.
  simulateCosto: {
    dimensionesSoportadas: ["sku", "cliente", "marca", "familia"],
    entidad: "none", aceptaEntidadPuntual: true, multiCardinality: null,
    inputsObligatorios: ["pct"], supuestosRequeridos: ["pct"], operacionValida: ["answer"],
    entityScopeNativo: true, escribeEntityList: true,
    notas: "Etapa 2: entityScope generalizado (antes ignoraba cualquier alcance heredado — 3er arg de _scopeRows hardcodeado a null).",
  },
  // simulateGeneral · "simulate v2": DOS variables (precio+volumen) covariando sobre UNA entidad puntual — el
  // composer en sí queda intacto (sigue siendo correcto para 1 entidad); Etapa 2 declara el fan-out {min:1,max:6}:
  // applyMultiEntityScope expande el plan a N calls idénticas (una por entidad), acotado por maxCalls de
  // toolRunner.js — nunca trunca en silencio, decline si el scope excede el cupo. Wiring de infraestructura para
  // que Etapa 3 (scenarioIntent.js multi-eje) lo use en el caso obligatorio completo — acá NO se dispara todavía
  // desde el detector de intención de escenario (ver answerViaOracle.js líneas ~681-724, fuera de alcance de Etapa 2).
  simulateGeneral: {
    dimensionesSoportadas: ["cliente", "sku", "marca", "familia"],
    entidad: "multi-vía-fanout", aceptaEntidadPuntual: true, multiCardinality: { min: 1, max: 6 },
    inputsObligatorios: ["entity", "variableA", "variableB"], supuestosRequeridos: ["precioLista", "unidades"], operacionValida: ["answer"],
    entityScopeNativo: false, escribeEntityList: true,
  },
  // defineConcept · definición AUTORIZADA de un concepto del glosario — nunca cifras, nunca boleta, nunca entidad.
  defineConcept: {
    dimensionesSoportadas: [],
    entidad: "none", aceptaEntidadPuntual: false, multiCardinality: null,
    inputsObligatorios: ["concept"], supuestosRequeridos: null, operacionValida: ["define"],
    entityScopeNativo: false, escribeEntityList: false,
  },
  // pnlRead · EL RESULTADO DEL NEGOCIO (owner 2026-08-09, decisión 3). Envuelve `composePnl`: la cascada del
  // negocio (default), la de UNA entidad, o la tabla por eje.
  // `dimensionesSoportadas` declara lo que la tool sabe PEDIR; qué ejes están realmente disponibles lo decide el
  // DATO en cada tenant (`pnlDisponibilidad()`: un eje entra sólo si la base del P&L trae la venta desglosada
  // hacia él) y la tool declina con el motivo declarado cuando no — SKU, bodega y canal no entran acá porque el
  // P&L no baja desglosado a ellos en ningún tenant conocido, y prorratear sobre un eje sin venta sería inventar
  // la cifra (decisión 8: si no lo soporta, lo dice; nunca devuelve filas de otro eje).
  // `supuestosRequeridos`: es la ÚNICA tool del catálogo cuyo resultado depende de un supuesto DECLARADO por el
  // usuario (las líneas de gasto y su % sobre la venta). Sin ellas no hay resultado que afirmar — declina, no
  // estima. `entidad:"single"`: un P&L de 2+ entidades a la vez mezclaría prorrateos de bases distintas; el
  // alcance multi-entidad del P&L es la TABLA POR EJE (`dimension`), que sí cierra exacto contra el negocio.
  pnlRead: {
    dimensionesSoportadas: ["cliente", "marca", "familia"],
    entidad: "single", aceptaEntidadPuntual: true, multiCardinality: null,
    inputsObligatorios: [], supuestosRequeridos: ["líneas de gasto declaradas (% sobre la venta)"], operacionValida: ["answer"],
    entityScopeNativo: false, escribeEntityList: true,
    notas: "envuelve composePnl (pnl.js) — no recalcula: la cifra es byte-igual a la de la cara Resultado de Sentrix. Sin P&L declarado DECLINA (nunca abre el flujo guiado: eso deja estado conversacional y una tool es pura).",
  },
};

export function getToolContract(toolName) {
  return TOOL_CONTRACTS[toolName] || null;
}

// ── MENSAJES DE DECLINE — nunca genéricos, siempre nombran las entidades CONCRETAS del scope (mismo principio que
// composeReferenceAmbiguity/composeReferenceDecline de conversationScope.js) ────────────────────────────────────
export function composeMultiEntityUnsupported(toolName, dimension, entities) {
  const dim = dimension || "esas entidades";
  const list = entities.join(", ");
  return `Esa operación la corro de a una — no la tengo generalizada para varias ${dim} a la vez. ¿La corro por separado para cada una (${list}), o prefieres que me quede con una sola?`;
}

export function composeCardinalityExceeded(toolName, card, entities, dimension) {
  const dim = dimension || "entidades";
  const list = entities.join(", ");
  if (toolName === "compareEntities") {
    return `Comparo de a pares — tengo ${entities.length} ${dim} (${list}). ¿Cuáles dos comparo, o prefieres que arme el ranking completo de las ${entities.length}?`;
  }
  const max = (card && card.max) || 2;
  return `Esa operación admite hasta ${max} a la vez y tengo ${entities.length} (${list}). ¿Con cuáles seguimos?`;
}

export function composeFanOutCapped(toolName, entities, cap) {
  const primeras = entities.slice(0, cap).join(", ");
  return `Son ${entities.length} — puedo correrlo hasta para ${cap} a la vez. ¿Sigo con las primeras ${cap} (${primeras}), o prefieres elegir cuáles?`;
}

export function composeDimensionUnsupported(toolName, contract, dimension) {
  const ejes = (contract && Array.isArray(contract.dimensionesSoportadas) && contract.dimensionesSoportadas.length)
    ? contract.dimensionesSoportadas.join("/") : "ningún eje";
  return `Esa operación no la corro por ${dimension} — solo por ${ejes}. ¿La corro por otro eje, o seguimos con estas entidades de otra forma?`;
}

// _alreadyNarrowedToOne(contract, args, entities) → true si ESTA call ya trae, en sus propios args, UNA entidad
// puntual que además pertenece al scope resuelto — PLAN "ya lo resolvió bien por comprensión" (mismo criterio que
// resolveConversationReference:kind="none" de conversationScope.js) y no hay nada que forzar ni que declinar.
function _alreadyNarrowedToOne(args, entities) {
  if (!args || typeof args !== "object") return false;
  if (typeof args.entity === "string" && entities.includes(args.entity)) return true;
  if (args.filters && typeof args.filters === "object" && !Array.isArray(args.filters)) {
    for (const v of Object.values(args.filters)) if (typeof v === "string" && entities.includes(v)) return true;
  }
  return false;
}

// ── applyMultiEntityScope(plan, calls, maxCalls) → { calls } | { decline } ─────────────────────────────────────
// Backstop DETERMINÍSTICO — corre SOLO cuando plan.scope.level==="list" con 2+ entidades (el caso multi-entidad
// genuino; con 0-1 entidades este módulo no tiene nada que decidir, el resto del pipeline sigue como siempre).
// Para cada call del plan, por CONTRATO (nunca adivinando por el nombre de la tool):
//   1. Si esta call YA viene acotada a una entidad puntual del scope (PLAN acertó solo) → no se toca.
//   2. Si el eje resuelto no está en dimensionesSoportadas de la tool → decline honesto (nunca cambia de eje en
//      silencio — cierra el punto pendiente "paso (h)" que Etapa 1 dejó documentado como diferido).
//   3. entityScopeNativo → puebla args.entityScope (+ args.dimension si la tool lo requiere y no vino ya puesto).
//   4. entidad="multi" (cardinalidad fija) → si el N calza, puebla args.entities; si no, decline con alternativas.
//   5. entidad="multi-vía-fanout" → expande a N calls (una por entidad), acotado por min(contract.max, maxCalls);
//      si el scope excede el cupo, decline (nunca trunca en silencio).
//   6. cualquier otro caso (single/none sin entityScopeNativo) → la tool NO admite una lista — decline + oferta de
//      correrla por separado, EXACTAMENTE lo que pide el owner ("nunca cambiar de dimensión en silencio").
// Tools fuera del catálogo (sin contrato) o sin concepto de entidad (aceptaEntidadPuntual=false) → sin cambios,
// siguen su curso normal (el batch las reporta como siempre si algo falla).
export function applyMultiEntityScope(plan, calls, maxCalls = 6) {
  const arr = Array.isArray(calls) ? calls : [];
  const scope = plan && plan.scope;
  if (!scope || scope.level !== "list" || !Array.isArray(scope.entities)) return { calls: arr };
  const entities = scope.entities.filter((e) => typeof e === "string" && e);
  if (entities.length < 2 || !arr.length) return { calls: arr };
  const dimension = (typeof scope.dimension === "string" && scope.dimension) ? scope.dimension : (guessDimension(entities[0]) || null);

  const outCalls = [];
  for (const c of arr) {
    if (!c || typeof c.tool !== "string") { outCalls.push(c); continue; }
    const contract = TOOL_CONTRACTS[c.tool];
    if (!contract || !contract.aceptaEntidadPuntual) { outCalls.push(c); continue; }   // sin contrato, o global puro — sin cambios
    const args = (c.args && typeof c.args === "object" && !Array.isArray(c.args)) ? c.args : {};

    if (_alreadyNarrowedToOne(args, entities)) { outCalls.push(c); continue; }   // PLAN ya lo resolvió bien por comprensión — nada que forzar

    if (dimension && Array.isArray(contract.dimensionesSoportadas) && contract.dimensionesSoportadas.length && !contract.dimensionesSoportadas.includes(dimension)) {
      return { decline: composeDimensionUnsupported(c.tool, contract, dimension) };
    }

    if (contract.entityScopeNativo) {
      const newArgs = { ...args, entityScope: { entities } };
      if (Array.isArray(contract.inputsObligatorios) && contract.inputsObligatorios.includes("dimension") && !args.dimension) newArgs.dimension = dimension;
      outCalls.push({ ...c, args: newArgs });
      continue;
    }

    if (contract.entidad === "multi") {
      const card = contract.multiCardinality || { min: 2, max: 2 };
      if (entities.length >= card.min && entities.length <= card.max) {
        outCalls.push({ ...c, args: { ...args, dimension: args.dimension || dimension, entities } });
        continue;
      }
      return { decline: composeCardinalityExceeded(c.tool, card, entities, dimension) };
    }

    if (contract.entidad === "multi-vía-fanout") {
      const card = contract.multiCardinality || { min: 1, max: maxCalls };
      const cap = Math.min(card.max || maxCalls, maxCalls);
      if (entities.length > cap) return { decline: composeFanOutCapped(c.tool, entities, cap) };
      for (const e of entities) outCalls.push({ tool: c.tool, args: { ...args, entity: e, dimension: args.dimension || dimension } });
      continue;
    }

    // "single"/"none" sin entityScopeNativo: la tool opera sobre UNA entidad (o el eje entero sin lista) — nunca
    // varias a la vez en silencio. Decline explícito + oferta concreta de correrlas por separado.
    return { decline: composeMultiEntityUnsupported(c.tool, dimension, entities) };
  }
  return { calls: outCalls };
}

// ── applySingleEntityScope(plan, calls) → calls ─────────────────────────────────────────────────────────────────
// Backstop DETERMINÍSTICO (Etapa 3, owner 2026-08-03, continuidad conversacional universal) — hermano de
// applyMultiEntityScope, pero para el caso N=1: `plan.scope.level==="entity"` con EXACTAMENTE 1 entidad YA
// resuelta (por PLAN mismo, o por resolveConversationReference — ej. "profundiza en el primero"/"esa marca" tras
// un ordinal/deíctico singular resuelto por conversationScope.js). HALLAZGO real durante la verificación de esta
// etapa: `_coerceEntityScopedFilters` (arriba, mecanismo PRE-Etapa-3, sin tocar) solo cubre 8 tools con `filters`
// (marginRead/contributionRead/diagnose/queryMetric/simulateCarga/simulateCapital/simulateCosto/simulateGeneral)
// — para el resto de tools que SÍ aceptan una entidad puntual (entityProfile/entityRecord/trend vía `args.entity`
// directo · gridTable/tensionRead/inventoryStatus vía `args.entityScope` nativo de Etapa 2) NADA poblaba el
// argumento cuando PLAN dejaba la call sin `entity` (el caso típico de una referencia RESUELTA POR CÓDIGO, no
// nombrada por PLAN) — "profundiza en el primero" quedaría corriendo entityProfile SIN entidad. Se generaliza acá,
// vía TOOL_CONTRACTS (nunca por nombre de tool hardcodeado), como pide el owner: "generalizar las tools que hoy
// asumen una sola entidad". NUNCA pisa una call que YA viene bien acotada (a esa MISMA entidad, por cualquiera de
// las 3 formas: args.entity/args.filters[eje]/args.entityScope) — PLAN o `_coerceEntityScopedFilters` "ya
// acertaron solo" es el caso más común y no se toca.
export function applySingleEntityScope(plan, calls) {
  const arr = Array.isArray(calls) ? calls : [];
  const scope = plan && plan.scope;
  if (!scope || scope.level !== "entity" || !Array.isArray(scope.entities) || scope.entities.length !== 1) return arr;
  const entity = scope.entities[0];
  if (typeof entity !== "string" || !entity) return arr;
  const axis = guessDimension(entity);
  if (!axis) return arr;   // nombre no reconocido en el dato → no se fuerza nada, la tool declina honesto como siempre

  return arr.map((c) => {
    if (!c || typeof c.tool !== "string") return c;
    const contract = TOOL_CONTRACTS[c.tool];
    if (!contract || !contract.aceptaEntidadPuntual) return c;   // sin contrato, o global puro — sin cambios
    const args = (c.args && typeof c.args === "object" && !Array.isArray(c.args)) ? c.args : {};

    // YA bien acotada a ESTA entidad (por cualquiera de las 3 formas) → no-op, PLAN/el backstop de filters ya acertó.
    if (typeof args.entity === "string" && args.entity === entity) return c;
    if (args.filters && typeof args.filters === "object" && !Array.isArray(args.filters) && args.filters[axis] === entity) return c;
    if (args.entityScope && Array.isArray(args.entityScope.entities) && args.entityScope.entities.length === 1 && args.entityScope.entities[0] === entity) return c;

    const dimSupported = !Array.isArray(contract.dimensionesSoportadas) || !contract.dimensionesSoportadas.length || contract.dimensionesSoportadas.includes(axis);
    if (!dimSupported) return c;   // eje no soportado por esta tool — no se fuerza (la tool declina honesto, mismo criterio que applyMultiEntityScope)

    // entidad="single" (entityProfile/entityRecord/trend) O "multi-vía-fanout" con N=1 (simulateGeneral: el mismo
    // arg shape que el fan-out usa por entidad, ver applyMultiEntityScope arriba) → args.entity/dimension directo.
    if (contract.entidad === "single" || contract.entidad === "multi-vía-fanout") {
      return { ...c, args: { ...args, entity, dimension: args.dimension || axis } };
    }
    // entityScopeNativo (gridTable/tensionRead/inventoryStatus/marginRead/salesRead/contributionRead/queryMetric/
    // simulateCosto) → args.entityScope con la única entidad — mismo mecanismo `{entities:[...]}` que Etapa 2 ya
    // generalizó, ahora también alcanzable con N=1 (antes solo llegaba acá con 2+, vía applyMultiEntityScope).
    if (contract.entityScopeNativo) {
      const newArgs = { ...args, entityScope: { entities: [entity] } };
      if (Array.isArray(contract.inputsObligatorios) && contract.inputsObligatorios.includes("dimension") && !args.dimension) newArgs.dimension = axis;
      return { ...c, args: newArgs };
    }
    return c;   // "multi" (compareEntities): 1 sola entidad no le alcanza — no se fuerza, la tool declina honesto
  });
}
