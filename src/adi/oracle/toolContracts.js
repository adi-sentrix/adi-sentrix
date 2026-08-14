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
// EL ÍNDICE DEL EJE es la ÚNICA autoridad sobre "¿esta entidad está en el dato?" (entityIndex.js, contrato v2:
// `resolveCanonical` devuelve null SOLO cuando el nombre no está en el catálogo de ese eje). Se usa abajo, en la
// sección VERACIDAD DEL VACÍO, para no dejar que un resultado vacío afirme una ausencia que el índice desmiente.
import { resolveCanonical, axisCollisions, AXES } from "./entityIndex.js";

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
  // clientesPorSku · LA TRANSPUESTA de la anterior: dados unos SKU, QUÉ CUENTAS los tienen en su surtido
  // (owner 2026-08-12, E4.t3). El eje del PEDIDO es `sku` —son SKU lo que se pasa en `entities`— y lo que
  // devuelve son cuentas; por eso `dimensionesSoportadas` dice `sku` y no `cliente`.
  // ES MULTI-ENTIDAD NATIVA: la pregunta medida decía «para ESOS SKU» (plural), así que acepta la lista entera y
  // no hay nada que descomponer — a diferencia de `compareEntities`, que corre de a pares.
  // SELLO: lo decide `clientCapitalRelacion`, no esta tabla. Con el cruce atómico ausente (el caso de hoy) las
  // cifras salen `indicado`; si el dataset registrara la venta cliente×SKU pasarían a `probado` solas.
  clientesPorSku: {
    dimensionesSoportadas: ["sku"],
    entidad: "multi", aceptaEntidadPuntual: true, multiCardinality: null,
    inputsObligatorios: ["entities"], supuestosRequeridos: null, operacionValida: ["answer"],
    entityScopeNativo: true, escribeEntityList: true,
    notas: "Afinidad de surtido: la relación cliente×SKU es estimada (IPF sobre marca dominante > familia), cierra exacta por cuenta y proporcional por SKU. NUNCA atribuye inventario a una cuenta: las celdas son venta/contribución.",
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
  // calcular · LA CALCULADORA DE CATÁLOGO CERRADO (AMPLITUD F2, owner 2026-08-13, decisión D1). Las entidades no
  // viajan en `entity`/`entities` sino DENTRO de cada insumo ({entidad, metrica} — referencias, nunca números
  // sueltos), así que para el scope multi-entidad heredado esta tool es opaca: `aceptaEntidadPuntual: false`
  // (como defineConcept/executiveSummary — applyMultiEntityScope no la toca ni la declina; el PLAN arma los
  // insumos por comprensión). La aritmética es el catálogo cerrado de calculoCatalogo.js: suma, resta,
  // variacion_pct, participacion, brecha_pp, escalar, margen_objetivo — jamás fórmula libre.
  calcular: {
    dimensionesSoportadas: ["cliente", "sku", "marca", "familia"],
    entidad: "none", aceptaEntidadPuntual: false, multiCardinality: null,
    inputsObligatorios: ["operacion", "insumos"], supuestosRequeridos: null, operacionValida: ["answer"],
    entityScopeNativo: false, escribeEntityList: true,
    notas: "cada resultado sale con su fórmula declarada y sello indicado (source:'computed'); con una cifra del usuario adentro exige además su procedencia y el marco de hipótesis (facts.conCifraDeUsuario → ensureHypothesisFraming). Declina honesto: operación fuera del catálogo, insumo inexistente, unidades incompatibles, cruce de universos (nombrando la regla).",
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

/* ── VERACIDAD DEL VACÍO · "la tool volvió vacía" ≠ "el dato no existe" ═════════════════════════════════════════
 * (owner 2026-08-11, defecto D7 "ADI declina datos que acaba de mostrar")
 *
 * EL DEFECTO, medido: el turno anterior imprime la tabla de Falabella/Lider/Jumbo/Sodimac con margen y venta, y el
 * siguiente contesta «no puedo comparar estas cuatro cuentas: FALTAN SUS REGISTROS EN EL EJE CLIENTE». Los cuatro
 * registros están —el índice del eje los resuelve en el mismo proceso, con veintiún campos y catorce cifras
 * autorizadas cada uno—. Lo que pasó es otra cosa: `compareEntities` compara DE A PARES (multiCardinality {2,2}) y
 * el plan le mandó cuatro entidades en `args`; el composer devolvió `null` por cardinalidad y `_pack`
 * (toolRegistry.js) tradujo ese `null` al único texto que tiene a mano — uno que AFIRMA AUSENCIA DE DATO. Aguas
 * abajo nadie puede distinguirlo: el narrador recibe `{disponible:false, motivo:<ese texto>}` y escribe fielmente
 * lo que le dieron. El narrador está exonerado; el defecto es que las dos afirmaciones se colapsaron en una.
 *
 * LA REGLA QUE FALTABA, y que rige acá: «la tool volvió vacía» y «el dato no existe» son afirmaciones DISTINTAS.
 * Declinar es legítimo; MENTIR sobre la razón no. Un resultado vacío cuya causa REAL es la FORMA del pedido no
 * puede salir diciendo que faltan los registros: tiene que decir la verdad —«no pude traerlo así»— y nombrar lo
 * que sí está.
 *
 * ═══ EL RECORTE DE ALCANCE (auditoría adversarial 2026-08-11, sobre la PRIMERA versión de este mismo bloque) ═══
 * La primera versión decía «CUALQUIER tool que devuelve vacío por CÓMO se pidió» y lo implementaba como: si el
 * pedido nombra AL MENOS UNA entidad que el índice reconoce, la razón se reescribe a «el vacío es de cómo se
 * pidió, no del dato». Eso NO era la regla: era un BLANQUEO de declinaciones, y produjo mentiras nuevas. Tres
 * medidas, todas reproducibles en `_veracidad_vacio_gate.mjs` (sección 6):
 *
 *   (FP-1) EL EJE ERA FALSO. El eje del mensaje se tomaba de `args.dimension` —el eje por el que se RANKEA— y se
 *          le aplicaba a entidades que habían entrado por una KEY DE FILTRO, que es otro eje. Medido:
 *          `queryMetric{metric:"rotacion", dimension:"cliente", filters:{marca:"Samsung"}}` salía diciendo
 *          «SAMSUNG ESTÁ EN EL EJE 'CLIENTE' y lo tengo». Samsung es una marca. Un bloque escrito para impedir que
 *          el motor mienta sobre el dato estaba inventando una atribución de eje — el error de atribución exacto
 *          que entityIndex.js existe para matar.
 *   (FP-2) LOS LÍMITES DECLARADOS QUEDABAN BLANQUEADOS. `la métrica 'rotacion' no está declarada para el eje
 *          'cliente'` es VERDAD y es un límite del contrato (rotación y DOH son declaradas por SKU/bodega, no
 *          derivables por cliente; el propio TOOL_CATALOG le dice al plan «si pedís uno que no está declarado la
 *          tool DECLINA honesto y eso es lo correcto, NO REINTENTES con otro eje»). La reescritura la convertía en
 *          «el vacío es de cómo se pidió, no del dato. Decime por dónde lo busco y lo traigo» — una negación de un
 *          límite real MÁS una invitación explícita a reintentar contra la instrucción que dice no reintentar.
 *          Idéntico en `inventoryStatus{filters:{cliente:…}}` (no hay puente cliente↔SKU) y en
 *          `marginRead{filters:{bodega:…}}` (las bodegas no tienen venta ni presupuesto propios).
 *   (FP-3) SE ATRIBUÍA CAUSA SIN MEDIRLA. Ninguna de esas reescrituras tenía evidencia de que la causa fuera el
 *          pedido: la única evidencia era «hay una entidad real nombrada en los args», que es compatible con
 *          cualquier causa, incluida la ausencia genuina.
 *   (FP-4) LA MISMA ENFERMEDAD EN LA CURA, hallada auditando la corrección de FP-1/2/3. La rama del EJE se
 *          disparaba en CUALQUIER tool con sólo ver una entidad de otro eje en los args — incluidas las que por
 *          contrato declaran `entidad:"none"` y ni miran `entity`. Medido con `{dimension:"cliente",
 *          entity:"SAM-TV55"}`: `pnlRead` (declina porque EL P&L NO ESTÁ DECLARADO para el negocio),
 *          `tensionRead` (no hay puente cliente↔SKU), `simulateGeneral` (le faltaban las dos variables del
 *          supuesto) y `simulateCosto` (no había SKU bajo benchmark) salían las cuatro diciendo que su vacío era
 *          del eje del pedido. Cuatro límites verdaderos tapados por una causa inventada. De ahí las tres
 *          condiciones de la rama (B) abajo.
 *
 * De la doctrina de la casa —«falso negativo antes que falso positivo»— se sigue que un motivo declarado de menos
 * es preferible a un motivo declarado de más. Así que esta versión sólo reescribe cuando la causa está MEDIDA, y
 * la medición no es «hay una entidad real» sino una CONTRADICCIÓN entre dos hechos que el motor ya tiene:
 *
 *   (A) CARDINALIDAD FUERA DE CONTRATO · el contrato declara `multiCardinality` para una tool `entidad:"multi"`
 *       —hoy sólo `compareEntities` {min:2,max:2}— y la lista que llegó en los args no cabe. Eso NO es opinión:
 *       `composeSpecCompare` (specRetrieval.js) rechaza estructuralmente cualquier largo != 2, así que el vacío
 *       está explicado ENTERO por la forma del pedido. Es exactamente el defecto medido.
 *   (B) EJE DEL PEDIDO EQUIVOCADO · TODAS las entidades nombradas fallan `resolveCanonical` en el eje sobre el que
 *       se las pidió y TODAS resuelven en otro eje. El índice desmiente el eje, no el dato.
 *
 * TODO LO DEMÁS SE DEJA INTACTO, a propósito y con nombre: un límite declarado (métrica no disponible en ese eje,
 * falta de tabla puente, granularidad ausente) sale con SU razón, sin `motivoTipo` y sin reescritura. Este bloque
 * prefiere no decir nada antes que decir algo que no midió.
 *
 * POR QUÉ SÓLO `entidad:"multi"` Y NO `"multi-vía-fanout"`: en `compareEntities` la cardinalidad la hace cumplir el
 * COMPOSER (es la causa del vacío). En `simulateGeneral` {min:1,max:6} la cardinalidad es un PRESUPUESTO DE PLAN
 * que expande `applyMultiEntityScope` antes de correr — el composer no la conoce, así que un vacío de esa tool no
 * está explicado por ella. Declarar esa causa sería adivinar.
 *
 * POR QUÉ NO SE VALIDA `dimensionesSoportadas` CONTRA LOS ARGS (y el diagnóstico original proponía hacerlo): esa
 * tabla NO es autoridad de runtime. Medido: `compareEntities` declara ["cliente","sku","marca","familia"] y corre
 * PERFECTO por `bodega` y por `canal` (dos ejes que la tabla no lista). La tabla está más conservadora que los
 * composers; enforzarla en la ejecución convertiría en decline un camino que hoy funciona — cambiar un defecto por
 * una regresión. Acá la tabla se usa sólo para lo que sí está sincronizado con el composer (`multiCardinality`), y
 * para todo lo demás manda el ÍNDICE, que es medición y no declaración.
 *
 * POR QUÉ NO REESCRIBE EL VEREDICTO NI FUERZA UN REINTENTO: la decisión de declinar no se toca —sigue declinando,
 * `supported:false` sigue siendo `supported:false`, la forma de la respuesta no cambia y el turno sigue narrando
 * igual que hoy—. Lo único que cambia es QUÉ RAZÓN se declara. Reintentar recortando la lista a las dos primeras
 * sería contestar otra pregunta en silencio, que es justo lo que el resto de este módulo existe para impedir.
 *
 * QUÉ SE PUEDE PROMETER EN EL TEXTO. La salida que ofrece (A) —«dime con cuáles seguimos»— está MEDIDA:
 * `compareEntities` con exactamente dos entidades reales devuelve `supported:true` en los SEIS ejes del índice
 * (sku, cliente, marca, familia, bodega, canal · gate sección 3). La de (B) es deliberadamente más floja («puedo
 * intentarlo por ese eje»): ahí no hay medición de que el reintento funcione, y prometer un resultado que no se
 * midió es la misma clase de mentira, sólo que en futuro.
 *
 * SIN DÍGITOS EN LA RAZÓN, a propósito: este texto viaja al narrador como `motivo` y el narrador lo parafrasea. Un
 * conteo desnudo ("tengo 4 clientes") lo empuja a escribir una cifra que la boleta de este turno no autoriza y
 * guardC la rechaza con razón — el turno se degrada por una cifra que ni siquiera era del negocio. Se dice en
 * palabras. Los nombres de entidad sí viajan: son los que el usuario acaba de nombrar y el índice acaba de
 * confirmar (un código de SKU trae dígitos propios, y eso no es una cifra del negocio).
 */

// Los veredictos que este bloque sabe SOSTENER sobre un resultado vacío. Viajan en `coverage.motivoTipo` para que
// cualquier consumidor aguas abajo (narrador, evidencia, panel) pueda discriminar SIN leer la prosa con un regex.
// NO HAY un valor "por defecto": una declinación sin `motivoTipo` es una declinación cuya causa este bloque NO
// midió, y ésa es la mayoría — se la deja pasar tal como la tool la declaró.
export const MOTIVO_TIPO = {
  CONTRATO: "contrato",         // la lista no cabe en la cardinalidad que el composer hace cumplir — el dato está
  EJE: "eje_del_pedido",        // ninguna entidad está en el eje sobre el que se la pidió; todas están en otro
  SIN_DATO: "sin_dato",         // ninguna de las entidades nombradas existe en el dato — la ausencia es real
};

const _normTxt = (x) => String(x == null ? "" : x).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

// ejeCanonico(x) → el eje del índice que ese texto nombra, o null. El plan escribe el eje en lenguaje natural
// ("clientes", "SKU", "Familias") y el índice lo tiene en minúscula singular. Se canoniza contra `AXES` —el
// vocabulario del PROPIO índice contra el que vamos a preguntar— y no contra una segunda lista escrita acá.
export function ejeCanonico(x) {
  const n = _normTxt(x);
  if (!n) return null;
  for (const e of AXES) { const c = _normTxt(e); if (n === c || n === `${c}s` || n === `${c}es`) return c; }
  return null;
}

// entidadesNombradas(args) → las entidades que ESTA call nombró en sus propios args, cada una con el eje en que la
// pidió. Las cuatro formas en que una entidad entra a una tool de este catálogo (ver applySingleEntityScope arriba,
// que puebla exactamente las mismas): `entity` · `entities[]` · `entityScope.entities[]` · un valor de `filters`
// (ahí la KEY es el eje). Se leen los args REALES de la ejecución, nunca `plan.scope` — que es opcional en el
// schema del planificador y por eso el camino normal del plan dejaba toda la capa de contrato inerte.
// `origen` NO es decorado: dice POR DÓNDE entró la entidad, y eso decide qué se puede afirmar sobre ella. Una
// entidad que llegó por `entity`/`entities` es el SUJETO declarado de la lectura (la tool la consume y su eje
// determina la búsqueda). Una que llegó por `filters` o `entityScope` es un ACOTAMIENTO que muchas tools ni
// miran — `pnlRead` no toma entidad, y sin embargo un `entity` suelto en los args la haría parecer el motivo del
// vacío. Ver la nota de FP-4 en `diagnosticarVacio`.
export function entidadesNombradas(args) {
  const out = [];
  if (!args || typeof args !== "object") return out;
  const ejeDeclarado = ejeCanonico(args.dimension);
  const add = (nombre, eje, origen) => { if (typeof nombre === "string" && nombre.trim()) out.push({ nombre: nombre.trim(), eje: eje || null, origen }); };
  add(args.entity, ejeDeclarado, "entity");
  if (Array.isArray(args.entities)) for (const e of args.entities) add(e, ejeDeclarado, "entities");
  if (args.entityScope && Array.isArray(args.entityScope.entities)) for (const e of args.entityScope.entities) add(e, ejeDeclarado, "entityScope");
  if (args.filters && typeof args.filters === "object" && !Array.isArray(args.filters)) {
    for (const [k, v] of Object.entries(args.filters)) add(v, ejeCanonico(k), "filters");
  }
  const vistos = new Set();
  return out.filter((e) => { const k = `${e.eje || ""}|${_normTxt(e.nombre)}`; if (vistos.has(k)) return false; vistos.add(k); return true; });
}

// SUJETO OBLIGATORIO · la entidad explica el vacío de una lectura sólo si esa lectura NO EXISTE sin ella. El
// discriminador no es `entidad:"single"` —eso dice cuántas entidades acepta, no que las necesite— sino
// `inputsObligatorios`: la lista de lo que el contrato declara IMPRESCINDIBLE para que la tool signifique algo.
//
// POR QUÉ NO ALCANZABA `entidad`, medido: `pnlRead` declara `entidad:"single"` y su PRIMER control es
// `pnlDefined()` — si el negocio no declaró sus líneas de gasto, declina ANTES de mirar la entidad. Su
// `inputsObligatorios` es `[]`, y eso lo dice bien: el P&L del negocio entero es una llamada válida, así que una
// entidad en los args es un alcance opcional y no la causa del vacío. Idem `trend`. En cambio
// entityRecord/entityProfile/entityComposicion/entityCapitalLigado declaran `["dimension","entity"]` y
// `compareEntities` declara `["dimension","entities"]`: sin eso no hay lectura que pedir.
//
// `entityScope` NUNCA califica, aunque un contrato lo listara: es un forwarding mecánico que la mitad de los
// composers ignora, así que su presencia no explica nada.
const _ES_SUJETO = new Set(["entity", "entities"]);

// _falta(args, k) → ¿el pedido dejó vacío un input que el contrato declara imprescindible?
const _falta = (args, k) => {
  const v = args ? args[k] : undefined;
  if (v == null) return true;
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === "string") return v.trim() === "";
  return false;
};

// _entidadExplicaElVacio(contract, args, origen) → ¿puede la entidad ser la causa del vacío de ESTA llamada?
// DOS exigencias, las dos leídas del contrato y contrastadas contra los args REALES:
//   (1) la entidad entró por un input que el contrato declara OBLIGATORIO — no basta con que la tool la acepte.
//   (2) TODO EL RESTO de lo obligatorio también vino. Si al pedido le faltaba otra cosa imprescindible, el vacío
//       ya está explicado por eso y la entidad no tiene nada que ver. Medido: `simulateGeneral` declara
//       `["entity","variableA","variableB"]`; llamada con la entidad sola declina por LAS VARIABLES —«necesito
//       exactamente 2 variables distintas»— y culpar al eje de la entidad tapaba ese motivo verdadero.
const _entidadExplicaElVacio = (contract, args, origen) => {
  if (!contract || !_ES_SUJETO.has(origen)) return false;
  const obligatorios = Array.isArray(contract.inputsObligatorios) ? contract.inputsObligatorios : [];
  if (!obligatorios.includes(origen)) return false;
  return obligatorios.every((k) => !_falta(args, k));
};

// _ubicar({nombre,eje}) → dónde está esa entidad SEGÚN EL DATO: en el eje que se pidió, en otro eje, o en ninguno.
// "en otro eje" NO es ausencia: pedir un SKU sobre el eje cliente es un pedido mal armado, no un registro que falta.
// `origen` viaja intacto: la decisión de (B) depende de POR DÓNDE entró la entidad, no sólo de dónde vive.
function _ubicar({ nombre, eje, origen }) {
  if (eje && resolveCanonical(eje, nombre)) return { nombre, eje, origen, estado: "presente", ejes: [eje] };
  const hits = axisCollisions(nombre).map((h) => h.dimension);
  if (!hits.length) return { nombre, eje, origen, estado: "ausente", ejes: [] };
  return { nombre, eje, origen, estado: eje ? "otro_eje" : "presente", ejes: hits };
}

// _listaCardinalidad(contract, args) → la lista de entidades que la tool va a tener que honrar como LISTA, o null
// si esta tool no tiene una cardinalidad que el COMPOSER haga cumplir. Sólo `entidad:"multi"` califica —hoy
// `compareEntities`, cuyo composer rechaza estructuralmente un largo != 2—. `multi-vía-fanout` queda EXCLUIDA a
// propósito: su cupo es un presupuesto que el plan expande antes de correr, no la causa de que la tool vuelva
// vacía (ver el bloque de arriba). Atribuirle esa causa sería adivinar.
function _listaCardinalidad(contract, args) {
  if (!contract || !contract.multiCardinality) return null;
  if (contract.entidad !== "multi") return null;
  const pick = (xs) => (Array.isArray(xs) ? xs.filter((x) => typeof x === "string" && x.trim()) : null);
  const desdeEntities = pick(args && args.entities);
  if (desdeEntities && desdeEntities.length) return desdeEntities;
  // `entityScope` NO cuenta acá: `compareEntities` declara `entityScopeNativo:false`, así que un scope suelto en
  // los args no es la lista que el composer va a contar — juzgar la cardinalidad con él sería juzgar otra cosa.
  if (args && typeof args.entity === "string" && args.entity.trim()) return [args.entity.trim()];
  return null;   // sin lista nombrada no se puede juzgar la cardinalidad — no se inventa un veredicto
}

const _PALABRA = { 1: "una", 2: "dos", 3: "tres", 4: "cuatro", 5: "cinco", 6: "seis", 7: "siete", 8: "ocho" };
const _cupoEnPalabras = (card) => {
  const max = (card && card.max) || 2;
  const min = (card && card.min) || 1;
  if (min === max) return max === 2 ? "de a pares" : `de a ${_PALABRA[max] || "varias"} a la vez`;
  return `hasta ${_PALABRA[max] || "varias"} a la vez`;
};
const _nombres = (us) => us.map((u) => u.nombre).join(", ");
const _estanEn = (us) => (us.length === 1 ? "está" : "están");

// EL EJE DE CADA ENTIDAD ES EL SUYO, NUNCA `args.dimension` (FP-1 de la auditoría: `dimension` es el eje por el
// que se RANKEA y una entidad que entró por `filters.marca` no vive ahí). `_ubicar` ya devolvió, POR ENTIDAD, los
// ejes en que el índice la encuentra; acá sólo se agrupa para que la frase salga en castellano. Si un nombre está
// en dos ejes a la vez (homónimo real) se nombran los dos: desambiguar es del usuario, no nuestro.
function _agruparPorEje(us) {
  const m = new Map();
  for (const u of us) {
    const k = (Array.isArray(u.ejes) && u.ejes.length) ? u.ejes.join("/") : "";
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(u.nombre);
  }
  return [...m.entries()].map(([eje, nombres]) => ({ eje: eje || null, nombres }));
}
const _dondeEstan = (us) => _agruparPorEje(us)
  .map(({ eje, nombres }) => `${nombres.join(", ")} ${nombres.length === 1 ? "está" : "están"} ${eje ? `en el eje '${eje}'` : "en el dato"}`)
  .join("; ");

// LA AFIRMACIÓN VA PRIMERO Y EN POSITIVO. Estos textos empiezan por lo que SÍ hay ("Falabella, Lider… están en el
// eje 'cliente' y los tengo") y recién después explican por qué la lectura volvió vacía. No es cosmética: el
// narrador parafrasea el motivo y una frase que ABRE con una negación se le sintetiza como "no tengo el dato" —
// exactamente la mentira que este bloque viene a impedir. Por el mismo motivo no se usa la palabra "falta" para
// hablar de lo que está.
const _yLosTengo = (us) => (us.length === 1 ? "y lo tengo" : "y los tengo");
const _sinRegistro = (ausentes) => (ausentes.length ? ` De ${_nombres(ausentes)} no tengo registro.` : "");

// composeVacioPorCardinalidad · la lista no cabe en la tool, pero el dato está. Dice las DOS cosas y ofrece la
// salida MEDIDA (dos entidades reales funcionan en los seis ejes del índice — gate sección 3).
export function composeVacioPorCardinalidad(toolName, card, presentes, ausentes) {
  const cupo = _cupoEnPalabras(card);
  return `${_dondeEstan(presentes)} ${_yLosTengo(presentes)}. Esta lectura corre ${cupo} y el pedido vino con otra cantidad: por eso volvió vacía — no porque el dato no esté.${_sinRegistro(ausentes)} Dime con cuáles seguimos y las comparo.`;
}

// composeVacioPorEje · el índice desmiente el EJE del pedido, no el dato. NO promete que el reintento funcione:
// que la entidad viva en otro eje no implica que esta tool sirva ese eje, y eso acá no se midió.
export function composeVacioPorEje(toolName, otroEje, ausentes, ejePedido) {
  return `${_dondeEstan(otroEje)}${ejePedido ? `, no en '${ejePedido}'` : ""}: esta lectura volvió vacía por el eje del pedido, no porque el dato no esté.${_sinRegistro(ausentes)} Si es por ahí que lo quieres, dímelo y lo intento.`;
}

// ── diagnosticarVacio(toolName, args, coverage) → parche de `coverage`, o null si no hay nada que corregir ───────
// EL ÚNICO PUNTO donde se decide si un vacío puede afirmar ausencia. Devuelve un objeto para MEZCLAR sobre la
// cobertura (nunca muta la que recibe): `reason` reescrita SÓLO en las dos situaciones medidas, `reasonTool` con el
// texto original para no perder la señal técnica, y `motivoTipo` únicamente cuando hay algo que sostener.
//
// LA REGLA DE ORO DE ESTA FUNCIÓN: el default es NO TOCAR NADA. Devolver `null` deja la declinación exactamente
// como la tool la emitió, que es el comportamiento anterior al fix — el peor caso de un `null` de más es el
// defecto original en un turno; el peor caso de una reescritura de más es negar un límite REAL del dato e invitar
// a reintentar contra él (medido, ver el bloque de arriba). Por eso cada `return` con `reason` exige una
// contradicción MEDIDA, no un indicio.
//
// PRECEDENCIA, y por qué en ese orden:
//   0. Si la cobertura YA trae un discriminador MEDIDO (`cross` del guard de cruce imposible · `eje` de la
//      decisión 8 · `relacion` de la decisión 9 · un `motivoTipo` puesto antes), no se toca: esas rutas ya dicen la
//      verdad sobre su causa y pisarlas sería perder precisión. Es un chequeo por CAMPO ESTRUCTURAL, no por texto.
//   1. Sin entidades nombradas en los args no hay nada que reconciliar contra el índice → intacta. Un resumen
//      ejecutivo que no pudo armarse no está mintiendo sobre ninguna entidad.
//   2. Si NINGUNA de las nombradas existe en el dato, la ausencia de ESAS entidades es real: la razón se deja como
//      está —no se reescribe nada— y sólo se estampa `sin_dato` con los nombres. Es una afirmación sobre las
//      entidades, no sobre la causa única del vacío, y su dirección es la segura (ADI sigue declinando).
//   3. EJE EQUIVOCADO antes que cardinalidad: si el índice desmiente el eje de TODAS las nombradas, ése es el
//      diagnóstico más de fondo (con el eje corregido, la cardinalidad puede ni siquiera importar).
//   4. Cardinalidad fuera del cupo que el composer hace cumplir → `contrato`. Es el defecto medido D7.
//   5. Cualquier otra cosa → `null`. Acá viven los límites declarados del dato (métrica no disponible en ese eje,
//      falta de tabla puente, granularidad ausente) y salen con SU razón, sin que este bloque opine.
export function diagnosticarVacio(toolName, args, coverage) {
  if (!coverage || coverage.supported !== false) return null;
  if (coverage.motivoTipo || coverage.cross === true || coverage.eje || coverage.relacion) return null;   // ya discriminada

  const nombradas = entidadesNombradas(args);
  if (!nombradas.length) return null;

  const ubicadas = nombradas.map(_ubicar);
  const presentes = ubicadas.filter((u) => u.estado !== "ausente");
  const ausentes = ubicadas.filter((u) => u.estado === "ausente");
  const enElDato = presentes.map((u) => u.nombre);
  const sinRegistro = ausentes.map((u) => u.nombre);

  if (!presentes.length) return { motivoTipo: MOTIVO_TIPO.SIN_DATO, entidadesSinRegistro: sinRegistro };

  const contract = TOOL_CONTRACTS[toolName] || null;

  // (B) EJE DEL PEDIDO EQUIVOCADO. DOS condiciones, y las dos salieron de medir un falso positivo:
  //   · LA ENTIDAD PUEDE EXPLICAR EL VACÍO (ver `_entidadExplicaElVacio`): entró por un input que el contrato
  //     declara obligatorio Y el pedido trajo todo lo demás que también lo es. Sin esto, `pnlRead` con un `entity`
  //     suelto salía diciendo que su vacío era del eje, cuando declina antes de mirarla porque EL P&L NO ESTÁ
  //     DECLARADO PARA EL NEGOCIO — un límite real, negado (FP-4). Igual `tensionRead` (no hay puente
  //     cliente↔SKU), `simulateCosto` (no había SKU bajo benchmark) y `simulateGeneral` (le faltaban las
  //     variables del supuesto).
  //   · TODAS las presentes están fuera del eje en que se las pidió. Con una sola bien ubicada el eje del pedido
  //     no está desmentido y el vacío puede venir de cualquier otra parte.
  const otroEje = presentes.filter((u) => u.estado === "otro_eje");
  const sujetos = otroEje.filter((u) => _entidadExplicaElVacio(contract, args, u.origen));
  if (otroEje.length === presentes.length && sujetos.length === presentes.length && presentes.length > 0) {
    const ejePedido = [...new Set(otroEje.map((u) => u.eje).filter(Boolean))];
    return {
      motivoTipo: MOTIVO_TIPO.EJE,
      reason: composeVacioPorEje(toolName, otroEje, ausentes, ejePedido.length === 1 ? ejePedido[0] : null),
      reasonTool: coverage.reason || null,
      entidadesEnElDato: enElDato, entidadesSinRegistro: sinRegistro,
    };
  }

  // (A) CARDINALIDAD FUERA DEL CUPO QUE EL COMPOSER HACE CUMPLIR — el defecto medido.
  const lista = _listaCardinalidad(contract, args || {});
  const card = contract && contract.multiCardinality;
  if (lista && card && (lista.length < card.min || lista.length > card.max)) {
    return {
      motivoTipo: MOTIVO_TIPO.CONTRATO,
      reason: composeVacioPorCardinalidad(toolName, card, presentes, ausentes),
      reasonTool: coverage.reason || null,
      entidadesEnElDato: enElDato, entidadesSinRegistro: sinRegistro,
    };
  }

  // (5) NO MEDIDO → no se opina. Un límite declarado del dato sale con su propia razón, intacta.
  return null;
}
