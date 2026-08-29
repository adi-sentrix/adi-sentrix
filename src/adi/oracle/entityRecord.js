/* === src/adi/oracle/entityRecord.js · ARQUITECTURA C · LA FILA COMPLETA (owner "el Excel completo") ===
 * Devuelve TODAS las columnas reales de UNA entidad (cliente/SKU/marca/familia) del dato, cada una con su unidad
 * correcta — no un menú recortado de métricas. El LLM lee la columna que necesita y, si un valor no viene, lo calcula
 * (como Claude leyendo el Excel). Es "el motor le entrega la sábana completa". Cada columna-cifra va a la boleta
 * (autorizada) → el guard sigue garantizando que no invente. Multiempresa-safe: lee las fachadas live-binding.
 */
import { clientesVentas, marcasVentas, skuInventario } from "../../data/demoData.js";
import { SOURCES } from "../../config/contract/sourceManifest.js";   // el CONTRATO decide cómo cada fuente se mueve con el escenario (scenarioLoad) — ver _srcRows
import { applyScenarioToSfamiliasVentas } from "../../engine/scenarios.js";   // el eje FAMILIA no tiene su Ventas en el manifiesto: entra por la MISMA función del motor que ya usan concentration.js y specRetrieval — ver _sources
import { fig } from "../boleta.js";
import { POLICY, benchmarkOf } from "../../config/businessPolicy.js";
import { ENTITIES } from "../../config/contract/entityRegistry.js";
import { resolveCanonical, axisCollisions } from "./entityIndex.js";   // CONTRATO v2 · Fase 3: índice Map por eje/tenant (O(1)) + colisiones explícitas
import { simboloMoneda } from "../../config/moneda.js";

const _money = (v) => { const a = Math.abs(v), s = v < 0 ? "-" : ""; if (a >= 1e6) return `${s}${simboloMoneda()}${(a / 1e6).toFixed(1)}M`; if (a >= 1e3) return `${s}${simboloMoneda()}${Math.round(a / 1e3)}K`; return `${s}${simboloMoneda()}${Math.round(a)}`; };

// META de cada columna real: etiqueta clara (que NO se pise con otra) + unidad + escala ($ en miles K vs crudo).
// text = no es cifra (contexto). Si una columna no está acá, se ignora (no rompe).
//
// UNA ETIQUETA, UN CAMPO (owner 2026-08-10, barrido de ambigüedad de términos). El caso peligroso no es que dos
// palabras nombren la misma cosa: es que la MISMA palabra nombre dos cosas distintas. Un barrido ingenuo lo da por
// concordante y pasa de largo. Acá vivían tres colisiones, las tres medidas:
//   · `margen` (skusMargen · universo tasa_comercial, año cerrado) y `margenPct` (skuInventario · universo
//     tasa_inventario, foto de hoy) declaraban las dos «Margen». Difieren en 9 de 13 SKU, hasta 6pp (LG-AIR9000
//     28% comercial vs 22% inventario), y `margenPct` es el campo con que economicDiagnosis.js:149 clasifica.
//     NO se reconcilian (los dos universos no cierran, por declaración): se DISTINGUEN por nombre.
//   · `venta` y `actual` declaraban las dos «Ventas». `actual` es un ALIAS que `_rawRecord` descarta a propósito,
//     así que el campo nunca existe en el registro — pero ganaba el `_LABEL2FIELD` y rompía el orden de buildGrid.
//   · `doh` («Cobertura (DOH)») y `cobertura` («Cobertura») entraban las DOS a la misma boleta, las dos
//     autorizadas, difiriendo en 8 de 13 SKU y hasta 28 días (SAM-TV55: 58d vs 30d). La decisión del owner ya
//     está tomada: `doh` es la única verdad y en pantalla se llama «Días de inventario». `cobertura` es un
//     duplicado redondeado y por eso NO ENTRA (se declina, no se le busca un nombre).
const F = {
  // $ en MILES (comercial): el valor guardado × 1000 = dólares
  venta: { l: "Ventas", u: "money", k: true }, actual: { l: "Ventas", u: "money", k: true, alias: "venta" }, anterior: { l: "Ventas año anterior", u: "money", k: true },
  presupuesto: { l: "Presupuesto de ventas", u: "money", k: true }, contribucion: { l: "Contribución", u: "money", k: true },
  costo: { l: "Costo", u: "money", k: true }, rebates: { l: "Rebate (monto $)", u: "money", k: true },
  // $ CRUDO (precios unitarios, valor de stock)
  stockUSD: { l: "Valor de inventario", u: "money" }, precioLista: { l: "Precio de lista", u: "money" }, costoMedio: { l: "Costo medio unitario", u: "money" },
  // porcentajes
  margen: { l: "Margen", u: "pct" }, margenPct: { l: "Margen de inventario", u: "pct" }, pctRebate: { l: "Rebate (%)", u: "pct" }, benchmark: { l: "Benchmark de margen", u: "pct" }, pctInv: { l: "% del inventario total", u: "pct" },
  // ratio / días · `cobertura` NO está y no es un olvido: ver la nota de arriba (duplicado redondeado de `doh`).
  rotacion: { l: "Rotación", u: "ratio" }, doh: { l: "Días de inventario", u: "days" }, diasSinVenta: { l: "Días sin venta", u: "days" },
  // CONTEOS (unidades)
  stockUnd: { l: "Unidades en stock", u: "count" }, unidades: { l: "Unidades vendidas", u: "count" }, unidadesAnt: { l: "Unidades vendidas año anterior", u: "count" }, vendidoMes: { l: "Unidades vendidas en el mes", u: "count" }, ventaDiaria: { l: "Venta diaria (unidades)", u: "count" },
  // texto / contexto (no es cifra)
  nombre: { l: "Nombre", u: "text" }, sku: { l: "SKU", u: "text" }, bodega: { l: "Bodega", u: "text" }, marca: { l: "Marca", u: "text" }, sfamilia: { l: "Familia", u: "text" }, canal: { l: "Canal", u: "text" }, estado: { l: "Estado", u: "text" }, alerta: { l: "Alerta", u: "text" }, tipo: { l: "Tipo", u: "text" },
};

const _fmt = (m, v) => m.u === "money" ? _money(m.k ? v * 1000 : v) : m.u === "pct" ? `${v}%` : m.u === "ratio" ? `${(+v).toFixed(1)}x` : m.u === "days" ? `${Math.round(v)}d` : String(v);

// fieldLabel(token) → la etiqueta ("Margen"/"Ventas"/…) de una columna cruda, para el llamador que necesita
// mapear un token de métrica a la KEY exacta que usa `facts` (requisito "confiabilidad" 2026-07-29, ruta
// determinística entidad+métrica) — sin exponer la tabla `F` completa, solo el accesor puntual que hace falta.
export function fieldLabel(token) {
  return (F[token] && F[token].l) || null;
}

// TEXT_LABELS → las etiquetas de columnas de TEXTO (u:"text"), no métrica — para el llamador que arma una tabla
// multi-columna (chartSpec.js, requisito 5: grilla de gridTable) y necesita mostrar solo las columnas NUMÉRICAS,
// nunca "Nombre" (redundante con la fila) ni "Tipo"/"Marca"/"Familia"/"Canal" (atributos, no la métrica pedida).
export const TEXT_LABELS = new Set(Object.values(F).filter((m) => m.u === "text").map((m) => m.l));

// rawRecordFor(dimension, entity) → el registro CRUDO (números sin formatear) de UNA entidad, case/acento-
// insensitive — para el llamador que necesita el VALOR numérico para comparar (nunca para mostrar: lo que se
// muestra siempre es el fig() ya formateado y autorizado en la boleta, una sola verdad).
export function rawRecordFor(dimension, entity, scenario = "actual") {
  return _rawRecord(dimension, resolveEntity(dimension, entity, scenario), scenario);
}

// REFERENCIA_CAMPO — la VARA AUTORIZADA de cada campo comparable (owner "piensa bien, estás de acuerdo con esta
// respuesta?" 2026-07-29, contrato de LECTURA MÍNIMA para toda respuesta puntual): benchmark/target/piso/techo YA
// establecidos en esta app — la MISMA vara que ya usan diagnose/marginRead/mechanisms.js (benchmarkOf respeta un
// override por-fila; POLICY.* respeta la memoria de criterio del owner, C.2) — NUNCA un promedio de cartera
// inventado para la ocasión. Un campo SIN entrada acá no tiene referencia autorizada: el llamador debe degradar
// honesto (dato limpio + oferta de análisis), nunca fabricar una lectura.
// `frase` = cómo se nombra la referencia en una oración ("Está por encima de {frase} de {valor}") — separado de
// `label` (el nombre del fig en la boleta, más formal/tabular) para que la prosa lea natural sin acoplarse al
// texto exacto de la boleta.
export const REFERENCIA_CAMPO = {
  margen:    { getRef: (rec) => benchmarkOf(rec), unit: "pct", label: "Benchmark de margen", frase: "tu benchmark", umbral: 0.5, fmt: (v) => `${v}%` },
  pctRebate: { getRef: () => POLICY.targetCarga, unit: "pct", label: "Target de carga comercial", frase: "tu target de carga comercial", umbral: 0.5, fmt: (v) => `${v}%` },
  rotacion:  { getRef: () => POLICY.rotacionMin, unit: "ratio", label: "Piso de rotación", frase: "tu piso de rotación", umbralRel: 0.10, fmt: (v) => `${(+v).toFixed(1)}x` },
  doh:       { getRef: () => POLICY.dohMax, unit: "days", label: "Techo de cobertura", frase: "tu techo de cobertura", umbral: 5, fmt: (v) => `${Math.round(v)}d` },
};
// REFERENCIA_ANTERIOR — el período anterior, SOLO cuando el dato lo declara por fila (D8: una sola verdad de
// venta — `anterior`/`unidadesAnt` ya son columnas F-table normales, autorizadas como cualquier otra).
export const REFERENCIA_ANTERIOR = {
  venta:    { campo: "anterior", umbralRel: 0.03 },
  unidades: { campo: "unidadesAnt", umbralRel: 0.03 },
};

// fuentes por dimensión (fachadas live-binding · multiempresa). Cada fuente trae su PROPIO keyField: skuInventario
// identifica el SKU por `sku`, pero skusMargen lo identifica por `nombre` (bug corregido: antes se perdían las
// columnas comerciales del SKU — costoMedio, precioLista, margen, contribución — por filtrar todo por `sku`).
//
// EL ESCENARIO ENTRA POR EL CONTRATO, NO POR UNA SEGUNDA COPIA (owner 2026-08-09, decisión 4: "Sentrix y ADI deben
// consumir LA MISMA transformación de escenario, nunca implementaciones paralelas"). `_srcRows` no transforma nada:
// delega en el `scenarioLoad` que `sourceManifest` ya declara para esa fuente — que es el MISMO `applyScenarioTo*`
// del motor que consume Sentrix (cuadro.js `_clientes`: applyScenarioToClientesMargen + applyScenarioToClientesVentas)
// y el MISMO que specRetrieval usa vía `_load`. Una fuente que el manifiesto declara `scenarioLoad: null` es
// SCENARIO-BLIND POR DECLARACIÓN (skusMargen, marcasMargen) y sigue devolviendo su literal: respetar esa declaración
// es parte del contrato, no un olvido.
//
// ANTES: este archivo leía los imports CRUDOS y clavaba `applyScenarioToClientesMargen("actual")` a mano, así que
// buildGrid/buildTension/buildEntityRecord/rawRecordFor contestaban con el dato del escenario base pasara lo que
// pasara — 65 cifras de gridTable quedaban QUIETAS mientras la pantalla se movía (Falabella en crisis: pantalla
// $15.8M, ledger $19.4M). Medido por `_concordancia_numerica_gate` [3].
const _srcRows = (name, scenario) => {
  const s = SOURCES[name];
  if (!s) return [];
  return (typeof s.scenarioLoad === "function" ? s.scenarioLoad(scenario) : s.load()) || [];
};
function _sources(dimension, scenario = "actual") {
  const A = (x) => (Array.isArray(x) ? x : []);
  switch (dimension) {
    case "sku": return [{ rows: A(_srcRows("skuInventario", scenario)), key: "sku" }, { rows: A(_srcRows("skusMargen", scenario)), key: "nombre" }];
    // cliente: `venta` viene reconciliada contra clientesVentas.actual (owner 2026-07-29, D8 — una sola verdad de
    // venta por cliente), NO el import crudo de clientesMargen. margen/costo/contribución quedan tal cual clientesMargen.
    case "cliente": return [{ rows: A(_srcRows("clientesMargen", scenario)), key: "nombre" }, { rows: A(_srcRows("clientesVentas", scenario)), key: "nombre" }];
    // marca/familia: la fuente de VENTAS de esos dos ejes no está declarada en `sourceManifest` (sólo su Margen).
    //
    // FAMILIA entra por `applyScenarioToSfamiliasVentas` — la MISMA función que ya consumen el Pareto de Sentrix
    // (`sentrix/concentration.js:32`) y `specRetrieval._ventasRows`, no una segunda copia. Hacía falta porque el
    // import crudo NO es el mismo dato: ese transform no preserva `anterior`/`presupuesto` verbatim, los RE-DERIVA
    // haciendo roll-up de `clientesVentas` (la venta oficial por cliente, D8). Medido en el eje familia: el crudo
    // dice `anterior` 30.350 y sin `presupuesto`, el roll-up dice 31.844 y 32.600 — un 4,9% de brecha. Con `venta`
    // ya viniendo del lado Margen scenario-aware, dejar `anterior` en el literal hacía que entityRecord y salesRead
    // contestaran dos años anteriores distintos para la MISMA familia en bonanza/tensión/crisis (en "actual" no se
    // notaba: ahí el transform devuelve el crudo tal cual). `actual` se sigue descartando en el merge porque `venta`
    // ya llegó del lado Margen (ver `_rawRecord`).
    //
    // MARCA queda entero sobre el literal, a propósito: el manifiesto declara `marcasMargen.scenarioLoad: null`, así
    // que su mitad Margen no se mueve. Mover sólo la mitad Ventas armaría la fila mitad-escenario / mitad-literal que
    // esto justamente evita. Cablear el eje MARCA completo (existe `applyScenarioToMarcasMargen`, sin usar) mueve
    // cifras de producto y sigue siendo decisión del owner — es el pendiente ya declarado.
    case "marca": return [{ rows: A(_srcRows("marcasMargen", scenario)), key: "nombre" }, { rows: A(marcasVentas), key: "nombre" }];
    case "familia": return [{ rows: A(_srcRows("sfamiliasMargen", scenario)), key: "nombre" }, { rows: A(applyScenarioToSfamiliasVentas(scenario)), key: "nombre" }];
    default: return null;
  }
}

// MÉTRICAS DERIVADAS que calcula el MOTOR (exactas, sin trampa de escala — owner 2026-07-28: "los cálculos estándar
// los hace el motor, no el LLM"). Se computan sobre el registro CRUDO y se agregan como columnas más.
//   · Precio medio de venta = venta / unidades  (venta está en miles → ×1000 para $ por unidad crudo)
//   · Costo medio de venta  = costo / unidades   (ídem)  [costoMedio, si viene, es el ponderado ya calculado]
//   · Margen de contribución = contribución / venta × 100  (misma escala → % limpio)
// venta/costo y precio/costo unitario van EN LA MISMA escala en el dato (venta/unidades == precioLista, costo/unidades
// == costoMedio) → el precio/costo medio se computa SIN ×1000 para coincidir con esas columnas ancla. El margen de
// contribución es un RATIO (misma escala arriba y abajo) → limpio siempre.
function _derived(rec) {
  const out = [];
  const num = (k) => (typeof rec[k] === "number" && Number.isFinite(rec[k]) ? rec[k] : null);
  const venta = num("venta"), unidades = num("unidades"), costo = num("costo"), contrib = num("contribucion");
  if (num("precioLista") == null && venta != null && unidades && unidades > 0) out.push({ label: "Precio medio de venta", value: +(venta / unidades).toFixed(1), unit: "money" });
  if (num("costoMedio") == null && costo != null && unidades && unidades > 0) out.push({ label: "Costo medio de venta", value: +(costo / unidades).toFixed(1), unit: "money" });
  if (contrib != null && venta && venta > 0) out.push({ label: "Margen de contribución", value: +((contrib / venta) * 100).toFixed(1), unit: "pct" });
  return out;
}

// resolveEntity(dimension, entity) → nombre CANÓNICO tal como vive en el dato (case/acento-insensitive) | el crudo
// si no matchea nada (owner "estas son preguntas simples", hallazgo en vivo 2026-07-29): el plan a veces manda el
// nombre tal cual lo tipeó el usuario ("falabella" en vez de "Falabella") — el lookup EXACTO de abajo
// (String(r[key])===String(entity)) fallaba en silencio con cualquier diferencia de mayúscula/acento, y el turno
// declinaba "no encuentro esa entidad" aunque el dato SÍ existe. Se resuelve UNA vez contra el eje pedido antes
// de cualquier comparación — mismo patrón `_norm` de coerceChain.js/temporalTable.js, duplicado a propósito (capas
// distintas del pipeline, no vale acoplarlas por una función de 1 línea).
const _norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
export function resolveEntity(dimension, entity, scenario = "actual") {
  if (entity == null) return entity;
  // CONTRATO v2 · FASE 3: primero el índice Map por eje/tenant (O(1) — ver entityIndex.js). El scan lineal de
  // abajo queda como RED: cubre cualquier fuente que el índice no cachee (ej. el eje cliente que acá se lee
  // scenario-aware vía applyScenarioToClientesMargen) y garantiza que la resolución nunca EMPEORA respecto del
  // comportamiento histórico. El contrato de retorno no cambia: sin match devuelve el crudo, como siempre.
  const canon = resolveCanonical(dimension, entity);
  if (canon) return canon;
  const target = _norm(entity);
  for (const e of _allEntities(dimension, scenario)) if (_norm(e) === target) return e;
  return entity;   // sin match → tal cual (el caller declina honesto, no se inventa un nombre)
}

// _rawRecord(dimension, entity) → el registro CRUDO mergeado (todas las columnas) | null
// `actual` (clientesVentas/marcasVentas/sfamiliasVentas) es ALIAS de `venta` (mismo label "Ventas" en F) — se
// omite si `venta` ya llegó de la fuente Margen (siempre primera en _sources) para no emitir un fig() duplicado
// con el mismo label y (antes del fix D8) valores distintos — hallazgo real: los 2 sobrevivían en el boleta array,
// autorizando cualquiera de los dos números a la narración.
function _rawRecord(dimension, entity, scenario = "actual") {
  const srcs = _sources(dimension, scenario);
  if (!srcs || entity == null) return null;
  const canon = resolveEntity(dimension, entity, scenario);
  const rec = {};
  for (const s of srcs) for (const r of s.rows) if (r && String(r[s.key]) === String(canon)) for (const k of Object.keys(r)) {
    if (k === "actual" && rec.venta != null) continue;
    if (rec[k] == null) rec[k] = r[k];
  }
  return Object.keys(rec).length ? rec : null;
}

// _formatRecord(entity, rec) → { facts, boleta } · formatea cada columna (cruda + derivada) con su unidad.
// DEDUP por LABEL (integridad #1-quater, auditoría adversarial 2026-07-31, CONFIRMADO en vivo): 2+ columnas crudas
// distintas podían mapear al MISMO label humano en `F` (ej. `margen` y `margenPct` → ambas "Margen", una de
// skusMargen, otra de skuInventario). Antes: `add()` empujaba un fig NUEVO por cada key, así que "LG-AIR9000 ·
// Margen" aparecía 2 VECES en `boleta` con valores distintos (22% y 28%) — `facts["Margen"]` resolvía al último
// (28%), pero `figFor()` (boleta.js) devuelve el PRIMER match → la fig STALE (22%), divergiendo de ADI Y de Sentrix
// aunque AMBOS ya estuvieran de acuerdo entre sí. Este dedup lo tapaba: cuando el label ya se emitió, REEMPLAZA el
// fig en vez de duplicarlo.
//
// EL DEDUP YA NO ES LO QUE EVITA LA CONTRADICCIÓN (owner 2026-08-10). Tapar la colisión con "último gana" dejaba
// vivo el problema real: las dos cifras seguían siendo legítimas y distintas, y cuál sobrevivía dependía del orden
// de escritura de `F`. Ahora cada campo tiene ETIQUETA PROPIA («Margen» comercial vs «Margen de inventario»), así
// que la boleta puede traer las dos SIN MENTIR y el narrador sabe de cuál universo habla cada una. El dedup queda
// como RED — si mañana alguien vuelve a declarar dos campos con la misma etiqueta, no se duplica el fig — y el
// candado de `_LABEL2FIELD` (abajo) además deja la colisión visible en vez de resolverla en silencio.
function _formatRecord(entity, rec) {
  const facts = { entidad: entity };
  const boleta = [];
  const _idxByLabel = new Map();
  // EL VALOR CANÓNICO VIAJA CON LA CIFRA (owner 2026-08-11, defecto 5 de la certificación final).
  // MEDIDO: la MISMA conversación llevó «Lider · Ventas» = $17.9M y = $17.8M, las dos autorizadas y las dos con
  // `raw: null`. La causa no es que haya dos datos —`clientesVentas.actual` y `clientesMargen.venta` valen 17843
  // los dos— sino que esta tool emitía el fig() con el valor YA FORMATEADO y SIN `raw`. Sin `raw` no queda con qué
  // reconciliar dos emisores de la misma métrica: cada uno formatea por su cuenta, el desacuerdo es invisible para
  // el muro, y el usuario ve dos cifras distintas para el mismo hecho en el mismo hilo.
  // `raw` viaja en la escala canónica del ledger (money en unidades, no en miles), derivado del MISMO `m.k` que
  // usa `_fmt` — una sola conversión, no dos que puedan divergir.
  const add = (label, val, unit, raw = null) => {
    facts[label] = val;
    const f = fig(`${entity} · ${label}`, val, { unit, ...(raw != null ? { raw } : {}) });
    if (_idxByLabel.has(label)) boleta[_idxByLabel.get(label)] = f;
    else { _idxByLabel.set(label, boleta.length); boleta.push(f); }
  };
  for (const [k, v] of Object.entries(rec)) {
    const m = F[k]; if (!m) continue;
    if (m.u === "text") { if (v != null && v !== "") facts[m.l] = v; continue; }
    if (typeof v !== "number" || !Number.isFinite(v)) continue;
    add(m.l, _fmt(m, v), m.u, m.u === "money" ? (m.k ? v * 1000 : v) : v);
  }
  for (const d of _derived(rec)) if (facts[d.label] == null) add(d.label, _fmt({ u: d.unit, k: false }, d.value), d.unit, d.value);
  return { facts, boleta };
}

// ── EJES GROUP-BY (bodega/canal) — Etapa 1, owner 2026-08-04, "cierre de los límites restantes de
// conversationScope": "esas bodegas"/"esos canales" deben resolver como entidad reconocida (boleta "Entidad ·
// Concepto"), sin que buildEntityRecord/buildGrid/buildTension aprendan a soportarlos (siguen sin poder, sus
// contratos ya lo reflejan así — ver toolContracts.js). La raíz única del gap era _sources() (arriba): default:null
// para "bodega"/"canal" alimentaba TANTO guessDimension() como _allEntities(), así que ningún nombre de bodega/canal
// podía siquiera reconocerse como perteneciente a un eje real.
//
// SEPARACIÓN DELIBERADA de 2 caminos, para no tocar _rawRecord (armado de registro MERGED, deliberadamente sin
// bodega/canal): bodega/canal son ejes GROUP-BY (N filas por nombre de grupo, ver entityRegistry.js
// ENTITIES.bodega/canal) — un merge naive devolvería un registro FALSO (solo la primera fila que matchee) si
// alguna vez se enrutara dimension="bodega"/"canal" hacia buildEntityRecord. `_axisNames` es SOLO el camino de
// "listar los nombres válidos de un eje" (lo que necesitan guessDimension/_allEntities) — reusa
// ENTITIES.bodega/canal (entityRegistry.js, la MISMA fuente de verdad que ya usa axisAvailable() para multiempresa)
// en vez de duplicar una segunda declaración de dónde vive cada campo.
//
// `_groupBySourceRows` re-lee el import LIVE-BINDING en cada llamada — mismo patrón que `_sources` arriba (nunca
// cachea el array en un objeto a nivel de módulo, que quedaría STALE tras un initTenant()/cambio de tenant).
function _groupBySourceRows(sourceName) {
  if (sourceName === "skuInventario") return skuInventario;
  if (sourceName === "clientesVentas") return clientesVentas;
  return null;
}
function _axisNames(dimension, scenario = "actual") {
  const direct = _sources(dimension, scenario);
  if (direct) return direct;
  const E = ENTITIES[dimension];
  if (!E || !E.isGroupBy) return null;
  const rows = _groupBySourceRows(E.source);
  if (!Array.isArray(rows)) return null;
  return [{ rows, key: E.keyField }];
}

// todas las entidades de una dimensión (para la grilla / ranking) — vía _axisNames: idéntico resultado a _sources
// para sku/cliente/marca/familia (nadie llama esta función con dimension="bodega"/"canal" hoy — gridTable/
// tensionRead/buildEntityRecord no las soportan, ver toolContracts.js), y ahora también sirve como base de
// resolveEntity() para bodega/canal (normalización case/acento-insensitive, guessDimension de abajo).
function _allEntities(dimension, scenario = "actual") {
  const srcs = _axisNames(dimension, scenario); if (!srcs) return [];
  const seen = new Set(); const out = [];
  for (const s of srcs) for (const r of s.rows) { const id = r && r[s.key]; if (id != null && !seen.has(String(id))) { seen.add(String(id)); out.push(String(id)); } }
  return out;
}

// guessDimension(entity) → "sku"|"cliente"|"marca"|"familia"|"bodega"|"canal"|null · a qué eje pertenece un NOMBRE,
// cuando el plan solo tiene el nombre (ej. `trend` con `entity` pero sin `dimension`) — para que la evidencia sepa
// qué cuadro abrir aun cuando la tool DECLINA (no hay serie mensual de esa métrica, pero SÍ sabemos que se hablaba
// de esa entidad). bodega/canal sumados en Etapa 1 (owner 2026-08-04) vía _axisNames — data-driven por tenant: si
// el dato activo no trae canal (ej. empresa2, fixture deliberado sin ese eje), _groupBySourceRows sigue devolviendo
// el array real (clientesVentas) pero ninguna fila tiene ese nombre de canal → sigue devolviendo null, nunca una
// lista fija hardcodeada.
export function guessDimension(entity) {
  if (entity == null) return null;
  // CONTRATO v2 · FASE 3: el índice resuelve en O(1) y además SABE si hubo colisión entre ejes. Acá se conserva
  // el contrato histórico (devolver el PRIMER eje del orden fijo) para no alterar resoluciones existentes — la
  // colisión no se pierde: `axisCollisions`/`resolveEntityRef` (entityIndex.js) la exponen para que el llamador
  // que quiera desambiguar pueda hacerlo. Ver guessDimensionDetallado abajo.
  const hits = axisCollisions(entity);
  if (hits.length) return hits[0].dimension;
  for (const dim of ["sku", "cliente", "marca", "familia", "bodega", "canal"]) {
    const srcs = _axisNames(dim);
    if (!srcs) continue;
    const canon = resolveEntity(dim, entity);
    for (const s of srcs) if (s.rows.some((r) => r && String(r[s.key]) === String(canon))) return dim;
  }
  return null;
}

// guessDimensionDetallado(entity) → lo que guessDimension NO podía decir: si el nombre existe en MÁS DE UN eje.
// El orden fijo (sku > cliente > marca > …) servía la fila del primer eje EN SILENCIO — con cifras reales del eje
// equivocado, que ningún guard numérico marca porque no hay nada inventado. Este accesor deja la colisión visible
// para el llamador que quiera preguntar en vez de adivinar.
export function guessDimensionDetallado(entity) {
  const hits = axisCollisions(entity);
  if (!hits.length) return { dimension: guessDimension(entity), colision: false, opciones: [] };
  return { dimension: hits[0].dimension, colision: hits.length > 1, opciones: hits };
}

// buildEntityRecord(dimension, entity, scenario) → { facts, boleta } | null
export function buildEntityRecord(dimension, entity, scenario = "actual") {
  const canon = resolveEntity(dimension, entity, scenario);
  const rec = _rawRecord(dimension, canon, scenario);
  if (!rec) return null;
  const r = _formatRecord(canon, rec);
  r.facts.entityType = dimension;
  return r;
}

// axisHasField(dimension, field) → true si ALGUNA fuente de ese eje trae esa columna numérica (turno 14 del
// veredicto de 18 turnos: base de buildTension — determina qué cruces existen REALMENTE en el dato).
export function axisHasField(dimension, field, scenario = "actual") {
  const srcs = _sources(dimension, scenario);
  if (!srcs) return false;
  return srcs.some((s) => s.rows.some((r) => r && typeof r[field] === "number"));
}

// buildTension(dimension, {metricA, metricB, limit}) → { facts, boleta } | { unsupported: razón } | null
// TENSIÓN "quién sostiene vs quién consume" (turno 14 del veredicto de 18 turnos, owner 2026-07-29): antes, pedir
// esto disparaba 2 tool-calls de EJES DISTINTOS (contribución por cliente + capital por SKU) que el narrador
// mezclaba sin declarar el mismatch de eje (guardC lo cazaba a veces como total-mal-atribuido, otras veces pasaba
// con una atribución falsa en prosa). Acá se cruzan DOS MÉTRICAS DEL MISMO EJE sobre las MISMAS entidades —
// top-N por metricA y por metricB YA CALCULADOS + su intersección — el narrador no arma el cruce a mano, lo recibe
// resuelto y autorizado. Si el eje no tiene AMBAS columnas (hoy: cliente/marca/familia no tienen capital/inventario
// — no hay tabla puente eje↔SKU en el dato), degrada HONESTO con la razón exacta vía `unsupported`.
// entityScope (Etapa 2, owner 2026-08-03, continuidad conversacional universal — generalización mecánica del MISMO
// parámetro que ya usan inventoryStatus/marginRead/salesRead/contributionRead vía _scopeRows en specRetrieval.js):
// acota `ents` al subconjunto nombrado ANTES de rankear/cruzar — "de esos SKU, ¿quién sostiene contribución?".
// Mismo fallback SUAVE que _scopeRows: si el subconjunto no intersecta NADA del eje (cruce de dimensión/tenant
// stale), se ignora y se sigue con el eje completo — nunca una respuesta vacía por un alcance incompatible.
function _applyEntityScope(ents, entityScope) {
  if (!entityScope || !Array.isArray(entityScope.entities) || !entityScope.entities.length) return ents;
  const set = new Set(entityScope.entities.map(String));
  const scoped = ents.filter((e) => set.has(String(e)));
  return scoped.length ? scoped : ents;
}

export function buildTension(dimension, { metricA = "contribucion", metricB = "stockUSD", limit = 10, dirA = "desc", dirB = "desc", entityScope = null, scenario = "actual" } = {}) {
  const hasA = axisHasField(dimension, metricA, scenario), hasB = axisHasField(dimension, metricB, scenario);
  const lblA = (F[metricA] && F[metricA].l) || metricA, lblB = (F[metricB] && F[metricB].l) || metricB;
  if (!hasA || !hasB) {
    const falta = !hasA && !hasB ? `${lblA} ni ${lblB}` : !hasA ? lblA : lblB;
    return { unsupported: `${lblA} y ${lblB} no se miden juntas por ${dimension} — falta ${falta} en ese eje (no hay tabla puente ${dimension}↔SKU en el dato).` };
  }
  let ents = _allEntities(dimension, scenario); if (!ents.length) return null;
  ents = _applyEntityScope(ents, entityScope);
  const recs = ents.map((e) => ({ e, rec: _rawRecord(dimension, e, scenario) }))
    .filter((x) => x.rec && typeof x.rec[metricA] === "number" && typeof x.rec[metricB] === "number");
  if (recs.length < 2) return null;
  // DIRECCIÓN por métrica (owner 2026-07-29, hallazgo en vivo): "quién CEDE más margen" pide el margen más BAJO
  // primero (el que peor está, no el mejor) — antes siempre ordenaba descendente (mayor primero) sin importar el
  // verbo, así que "cede más margen" mostraba a los de MEJOR margen, lo opuesto de lo pedido. dirA/dirB="asc" invierte.
  const sA = dirA === "asc" ? 1 : -1, sB = dirB === "asc" ? 1 : -1;
  const byA = recs.slice().sort((a, b) => sA * (a.rec[metricA] - b.rec[metricA]));
  const byB = recs.slice().sort((a, b) => sB * (a.rec[metricB] - b.rec[metricB]));
  const topA = byA.slice(0, limit), topB = byB.slice(0, limit);
  const restoA = byA.slice(limit), restoB = byB.slice(limit);   // requisito 2: cuantificar lo que quedó fuera
  const setTopB = new Set(topB.map((x) => x.e)), setTopA = new Set(topA.map((x) => x.e));
  const mA = F[metricA] || { l: metricA, u: "money" }, mB = F[metricB] || { l: metricB, u: "money" };
  // ORDEN SELLADO por la tool (requisito 4) — una por métrica, ya que tension cruza DOS rankings independientes.
  const ordenA = `${dirA === "asc" ? "ascendente" : "descendente"} por ${lblA}`;
  const ordenB = `${dirB === "asc" ? "ascendente" : "descendente"} por ${lblB}`;
  const facts = {
    metricA: lblA, metricB: lblB, dimension, ordenA, ordenB, totalCount: recs.length,
    topA: topA.map((x) => ({ nombre: x.e, valor: _fmt(mA, x.rec[metricA]) })),
    topB: topB.map((x) => ({ nombre: x.e, valor: _fmt(mB, x.rec[metricB]) })),
    enAmbosRankings: topA.filter((x) => setTopB.has(x.e)).map((x) => x.e),
    soloTopA: topA.filter((x) => !setTopB.has(x.e)).map((x) => x.e),
    soloTopB: topB.filter((x) => !setTopA.has(x.e)).map((x) => x.e),
  };
  const boleta = [];
  const seen = new Set();
  const addFig = (x, m, metric) => { const key = `${x.e}·${metric}`; if (seen.has(key)) return; seen.add(key); boleta.push(fig(`${x.e} · ${m.l}`, _fmt(m, x.rec[metric]), { unit: m.u })); };
  for (const x of topA) addFig(x, mA, metricA);
  for (const x of topB) addFig(x, mB, metricB);
  if (restoA.length) { const sum = restoA.reduce((s, x) => s + x.rec[metricA], 0); facts.restoA = { count: restoA.length, campo: lblA, sumaFmt: _fmt(mA, sum) }; boleta.push(fig(`Resto de ${lblA} (${restoA.length} de ${recs.length})`, _fmt(mA, sum), { unit: mA.u })); }
  if (restoB.length) { const sum = restoB.reduce((s, x) => s + x.rec[metricB], 0); facts.restoB = { count: restoB.length, campo: lblB, sumaFmt: _fmt(mB, sum) }; boleta.push(fig(`Resto de ${lblB} (${restoB.length} de ${recs.length})`, _fmt(mB, sum), { unit: mB.u })); }
  return { facts, boleta };
}

// buildGrid(dimension, {sortBy, dir, limit}) → { facts:{rows, sortBy, dimension}, boleta } | null
// LA GRILLA: top-N entidades × TODAS sus columnas (el motor arma la tabla junta y exacta; el LLM elige qué columnas
// mostrar). sortBy = campo crudo por el que rankear (venta/contribucion/stockUSD/rotacion/margen…) o su etiqueta.
// _LABEL2FIELD · etiqueta visible → campo crudo. CANDADO DE COLISIÓN (owner 2026-08-10): antes se armaba con
// Object.fromEntries, así que ante dos campos con la MISMA etiqueta ganaba EL ÚLTIMO ESCRITO — sin aviso. Con eso,
// `_LABEL2FIELD["margen"]` resolvía a `margenPct` y `_LABEL2FIELD["ventas"]` a `actual`: la MAYÚSCULA del sortBy
// decidía el campo (sortBy:"margen" → comercial, sortBy:"Margen" → inventario) y `ventas` (la clave canónica que
// usan las otras tres tools) ordenaba por un campo que `_rawRecord` descarta. Ahora: gana EL PRIMERO declarado,
// los alias no reclaman etiqueta, y una colisión nueva se ve en el momento de cargarse en vez de servir la fila
// del campo equivocado en silencio.
export const LABEL_COLLISIONS = [];   // exportada para que `_ambiguedad_terminos_gate` la afirme vacía (candado)
const _LABEL2FIELD = (() => {
  const out = {};
  for (const [k, m] of Object.entries(F)) {
    if (m.alias) continue;                       // `actual` es alias de `venta`: no reclama la etiqueta «Ventas»
    const key = m.l.toLowerCase();
    if (out[key]) { LABEL_COLLISIONS.push({ etiqueta: m.l, campos: [out[key], k] }); continue; }
    out[key] = k;
  }
  return out;
})();
// SINÓNIMOS DE ENTRADA · la clave CANÓNICA de cada métrica en los otros tres registros del sistema (METRICS,
// RANKING_EXTREMES_METRICS, METRIC_REGISTRY, QI_METRIC_VOCAB) es el plural `ventas`, y el planificador la emite así
// en `metric` para todas las demás tools. buildGrid aceptaba solo el singular `venta`; el plural caía en el campo
// alias y servía una lista SIN ORDENAR con el sello de orden puesto. Esto no cambia el vocabulario que Sentrix le
// manda a ADI: SUMA la forma canónica a la que ya se aceptaba.
const _SORT_SYNONYMS = { ventas: "venta", capital: "stockUSD", cobertura: "doh", "dias de inventario": "doh", "días de inventario": "doh" };
// _resolveSortField(sortBy) → { field, ok } · `ok:false` = el token no se reconoce (el llamador decide).
function _resolveSortField(sortBy) {
  if (!sortBy) return { field: F["venta"] ? "venta" : (F["contribucion"] ? "contribucion" : "stockUSD"), ok: true };
  if (F[sortBy] && !F[sortBy].alias) return { field: sortBy, ok: true };
  const low = String(sortBy).toLowerCase();
  if (F[sortBy] && F[sortBy].alias) return { field: F[sortBy].alias, ok: true };
  if (_SORT_SYNONYMS[low] && F[_SORT_SYNONYMS[low]]) return { field: _SORT_SYNONYMS[low], ok: true };
  if (_LABEL2FIELD[low]) return { field: _LABEL2FIELD[low], ok: true };
  return { field: F["venta"] ? "venta" : "contribucion", ok: false };
}
export function buildGrid(dimension, { sortBy = null, dir = "desc", limit = 20, entityScope = null, scenario = "actual" } = {}) {
  let ents = _allEntities(dimension, scenario); if (!ents.length) return null;
  ents = _applyEntityScope(ents, entityScope);   // Etapa 2: "de esos clientes, armame la tabla" — ver _applyEntityScope arriba
  const { field } = _resolveSortField(sortBy);
  // DECLINAR ANTES QUE SELLAR UN ORDEN QUE NO SE APLICÓ (owner 2026-08-10). Si el eje no trae esa columna, el sort
  // caía a -Infinity para TODAS las filas (un no-op que conserva el orden de entrada) y la tool igual sellaba
  // «descendente por X» — que es justo lo que el narrador CITA en vez de re-inferir. Resultado medido: «los 5
  // clientes de mejor margen» devolvía Falabella 22% cuando el mejor real es La Polar 34%, con la tabla mostrando
  // 22 → 24 → 21.5 → 23.5 → 28 bajo un sello de orden descendente. Ahora se dice que esa columna no existe en ese eje.
  if (sortBy && !axisHasField(dimension, field, scenario)) {
    const lbl = (F[field] && F[field].l) || field;
    return { unsupported: `«${lbl}» no se mide por ${dimension} — esa columna no existe en ese eje del dato, así que no puedo ordenar por ella (no te doy una tabla con un orden que no apliqué).` };
  }
  const recs = ents.map((e) => ({ e, rec: _rawRecord(dimension, e, scenario) })).filter((x) => x.rec);
  recs.sort((a, b) => { const av = a.rec[field], bv = b.rec[field]; const an = typeof av === "number" ? av : -Infinity, bn = typeof bv === "number" ? bv : -Infinity; return dir === "asc" ? an - bn : bn - an; });
  const top = recs.slice(0, Math.max(1, limit));
  // RESTO (owner "pase quirúrgico de confiabilidad" 2026-07-29, requisito 2: "en todo top-N, informa 'N de total' y
  // cuantifica el resto") — lo que quedó FUERA del top-N, para que "los 5 mejores" nunca lea como "son todos".
  const resto = recs.slice(Math.max(1, limit));
  const rows = []; const boleta = [];
  for (const { e, rec } of top) { const fr = _formatRecord(e, rec); rows.push(fr.facts); for (const f of fr.boleta) boleta.push(f); }
  const fm = F[field] || { l: field, u: "money" };
  // ORDEN SELLADO por la tool (requisito 4: "orden, dirección y ranking deben venir sellados por la tool") — el
  // narrador CITA esto, no re-infiere ni re-describe el criterio mirando las filas (ahí es donde se equivocaba).
  const orden = `${dir === "asc" ? "ascendente" : "descendente"} por ${fm.l}`;
  const facts = { dimension, sortBy: field, orden, count: rows.length, totalCount: recs.length, rows };
  if (resto.length) {
    const restoVals = resto.map((x) => x.rec[field]).filter((v) => typeof v === "number");
    if (restoVals.length === resto.length) {
      const sum = restoVals.reduce((a, b) => a + b, 0);
      facts.resto = { count: resto.length, campo: fm.l, sumaFmt: _fmt(fm, sum) };
      boleta.push(fig(`Resto (${resto.length} de ${recs.length}) · ${fm.l}`, _fmt(fm, sum), { unit: fm.u }));
    } else {
      facts.resto = { count: resto.length, campo: fm.l, sumaFmt: null };   // no todos numéricos → no se suma (honesto)
    }
  }
  return { facts, boleta };
}
