/* === _view_context_gate.mjs · CONTRATO DE CONCORDANCIA · EL NÚCLEO (owner 2026-08-09) =========================
 * Verifica el núcleo del ViewContext contra los BUILDERS REALES de Sentrix. No mira la UI: eso es el gate del
 * frente de emisión (_view_contract_gate.mjs, biyección hook ↔ manifiesto). Acá se afirma lo que sostiene todo
 * lo demás:
 *
 *   [1] MANIFIESTO ÍNTEGRO       vista/sección/tipo válidos · componentId === vista/sección/slug · el silencio
 *                                está prohibido (evidencia[] o sinTool declarado, nunca ninguno de los dos).
 *   [2] EL `campo` RESUELVE      cada componente se deriva contra la salida VIVA de su builder. Un `campo` que no
 *                                resuelve es un componente que quedaría mudo — salvo que se declare campoOpcional.
 *   [3] SELLADO REAL             el contexto está congelado en profundidad, verificado con `isSealed` — la MISMA
 *                                función que verifica el NarrationContract (mejora A: una sola capa de sellado).
 *   [4] CANDADO O(1)             300 entidades explícitas se RECHAZAN; como filtro, se aceptan. Estructural.
 *   [5] LA LÍNEA DEL PLAN        ≤ 240 caracteres, sin una sola cifra de negocio, siempre presente el sello.
 *   [6] DIRECCIÓN CANÓNICA       round-trip format → parse → resolve reabre EXACTAMENTE el mismo componente.
 *   [7] INVALIDACIÓN             misma pantalla = misma key; cambiar vista/componente/control/escenario/filtro la
 *                                cambia; cambio de tema, tenant ajeno y TTL vencido devuelven null.
 *   [8] ÍNDICE tool→COMPONENTE   una tool que cruza vistas SE ABSTIENE en vez de adivinar la cara equivocada.
 *
 * Cero red, cero LLM, cero créditos. `node _view_context_gate.mjs`
 */
import { VIEW_MANIFEST, VISTAS, SECCIONES, TIPOS, COMPARACIONES, UNIVERSO_KINDS, CONCORDANCIA_ESTADOS, componentIdForTool, toolIndexConflicts, vistaComponentId, builderKeyOf } from "./src/adi/sentrix/viewManifest.js";
import { builderOutsPorComponente } from "./src/adi/sentrix/viewBuilderRun.js";
import { deriveViewContextOrErrors, resolvePath } from "./src/adi/sentrix/viewContextFrom.js";
import {
  validateViewContext, viewContextKey, invalidateViewContext, projectViewContextForPlan,
  projectViewContextForCoercion, VIEW_SELECTION_MAX, VIEW_PLAN_LINE_MAX, VIEW_CONTEXT_TTL_TURNOS, VIEW_CONTEXT_VERSION,
  VIEW_CONTEXT_TTL_ENTRADAS, VIEW_CONTEXT_ENTRADAS_POR_TURNO,
} from "./src/adi/oracle/viewContext.js";
import { isSealed } from "./src/adi/oracle/narrationContract.js";
import { formatAddress, parseAddress, addressFromViewContext, resolveAddress, evidenceForAddress, buildSentrixActionFromAddress } from "./src/adi/sentrix/address.js";
import { normalizeSentrixAction } from "./src/adi/responseContract.js";
import { buildResumenComercial } from "./src/adi/sentrix/resumenComercial.js";
import { buildMesaCapital } from "./src/adi/sentrix/mesaCapital.js";
import { buildMesaResultado } from "./src/adi/sentrix/mesaResultado.js";
import { buildReadingFromSignals, buildClientContribSignals } from "./src/adi/sentrix/reading.js";
import { buildCuadroMando } from "./src/adi/sentrix/cuadro.js";
import { getTenantId } from "./src/data/tenantStore.js";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";

// vía 1 (2026-08-20): el dataset se DECLARA acá. Antes se heredaba del import por defecto de tenantStore,
// que ya no existe: el store arranca en la forma vacía y el dato entra por initTenant. Ver tenantEmpty.js.
initTenant(TENANT_DEMO);

let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };
const H = (t) => console.log("\n" + t);

const SCN = "bonanza";
const RC = { tenantId: getTenantId() };
// una salida por COMPONENTE, no por vista: desde la decisión 12 las superficies de nivel 2 que ADI abre declaran
// su propio builder (ver SUPERFICIE_BUILDERS). Quien lo ejecuta es `viewBuilderRun.js`, una sola vez para todos.
const SALIDAS = builderOutsPorComponente(SCN);
const BUILDERS = { comercial: SALIDAS["comercial/otro/vista"], capital: SALIDAS["capital/otro/vista"], resultado: SALIDAS["resultado/otro/vista"], ficha: SALIDAS["ficha/otro/vista"] };

H("[1] MANIFIESTO · íntegro y sin silencios");
{
  const ids = Object.keys(VIEW_MANIFEST);
  ok(ids.length > 0, `el manifiesto declara ${ids.length} componentes`);
  const malForm = ids.filter((id) => {
    const m = VIEW_MANIFEST[id];
    const [v, s, ...rest] = id.split("/");
    return !VISTAS.includes(v) || !SECCIONES.includes(s) || !rest.join("/") || m.vista !== v || m.seccion !== s;
  });
  ok(!malForm.length, "todo componentId es exactamente vista/sección/slug y concuerda con su entrada", malForm.join(", "));
  const tipoMal = ids.filter((id) => !TIPOS.includes(VIEW_MANIFEST[id].tipo));
  ok(!tipoMal.length, "todo componente declara un tipo del vocabulario cerrado", tipoMal.join(", "));
  const cmpMal = ids.filter((id) => VIEW_MANIFEST[id].comparacion && !COMPARACIONES.includes(VIEW_MANIFEST[id].comparacion));
  ok(!cmpMal.length, "toda comparación declarada existe en el vocabulario", cmpMal.join(", "));
  const uniMal = ids.filter((id) => !VIEW_MANIFEST[id].universo || !UNIVERSO_KINDS.includes(VIEW_MANIFEST[id].universo.kind));
  ok(!uniMal.length, "todo componente declara su universo con un kind válido", uniMal.join(", "));
  // EL SILENCIO ESTÁ PROHIBIDO: o hay tools que lo demuestran, o se declara por qué no las hay.
  const mudos = ids.filter((id) => { const m = VIEW_MANIFEST[id]; return !(m.evidencia && m.evidencia.length) && !m.sinTool; });
  ok(!mudos.length, "ningún componente calla: todos declaran `evidencia` o `sinTool` con su motivo", mudos.join(", "));
  // CERO cifras y CERO nombres de tenant en el manifiesto (vale para cualquier empresa)
  const nombresTenant = buildCuadroMando("cliente", SCN).rows.filter((r) => r && !r._total && !r._ref).map((r) => r.name);
  const src = JSON.stringify(VIEW_MANIFEST);
  const filtrado = nombresTenant.filter((n) => src.includes(n));
  ok(!filtrado.length, "el manifiesto no nombra ninguna entidad del tenant activo", filtrado.join(", "));
  const cadaVista = VISTAS.filter((v) => !vistaComponentId(v));
  ok(!cadaVista.length, "cada vista tiene su componente de contexto ambiente `<vista>/otro/vista`", cadaVista.join(", "));
}

H("[2] EL `campo` RESUELVE contra la salida VIVA del builder");
const DERIVADOS = {};
const OPCIONALES = [];
{
  const rotos = [];
  for (const [id, m] of Object.entries(VIEW_MANIFEST)) {
    const out = SALIDAS[id];
    if (out == null) { rotos.push(`${id} (el builder declarado, ${builderKeyOf(id)}, no produjo salida)`); continue; }
    const r = deriveViewContextOrErrors(id, out, { scenario: SCN, requestContext: RC });
    if (r.ok) { DERIVADOS[id] = r.vc; continue; }
    if (r.opcional) { OPCIONALES.push(id); continue; }
    rotos.push(`${id} → ${r.errors.join(" | ")}`);
  }
  ok(!rotos.length, `${Object.keys(DERIVADOS).length} componentes derivan del builder real`, rotos.join("\n      "));
  ok(OPCIONALES.every((id) => VIEW_MANIFEST[id].campoOpcional),
    `${OPCIONALES.length} ausentes son limitaciones DECLARADAS (campoOpcional), no fallas silenciosas`, OPCIONALES.join(", "));
  // el universo lo pone el DATO, nunca el manifiesto
  const sinN = Object.entries(DERIVADOS).filter(([, vc]) => vc.universo.n == null && vc.tipo !== "veredicto" && vc.tipo !== "vista" && vc.tipo !== "kpi" && vc.tipo !== "tira");
  ok(!sinN.length, "toda tabla/lista/serie/barra derivada trae el tamaño de su universo desde el dato", sinN.map(([id]) => id).join(", "));
}

H("[3] SELLADO · la misma capa que el NarrationContract");
{
  const noSellados = Object.entries(DERIVADOS).filter(([, vc]) => !isSealed(vc));
  ok(!noSellados.length, "todo ViewContext derivado es inmutable en profundidad (isSealed, la función del contrato)", noSellados.map(([id]) => id).join(", "));
  const vc = DERIVADOS["comercial/01/tabla-cartera"];
  ok(Object.isFrozen(vc) && Object.isFrozen(vc.universo) && Object.isFrozen(vc.seleccion) && Object.isFrozen(vc.filtros),
    "el congelado alcanza a los hijos (universo/selección/filtros), no solo a la raíz");
  ok(Object.values(DERIVADOS).every((x) => x.version === VIEW_CONTEXT_VERSION), "todo contexto declara su versión");
  ok(Object.values(DERIVADOS).every((x) => x.dataSnapshotId === `${x.tenantId}::${x.escenario}`),
    "dataSnapshotId usa el MISMO formato de requestContext.js (tenant::escenario)");
}

H("[4] CANDADO O(1) · estructural, no una convención");
{
  const base = DERIVADOS["comercial/01/tabla-cartera"];
  const muchos = Array.from({ length: 300 }, (_, i) => `Entidad ${i}`);
  const r = validateViewContext({ ...base, seleccion: { modo: "explicita", n: 300, entidades: muchos, filtro: null } });
  ok(!r.ok && r.errors.join(" ").includes("VIEW_SELECTION_MAX"), "300 entidades explícitas son RECHAZADAS por la validación");
  const rf = validateViewContext({ ...base, seleccion: { modo: "filtro", n: 300, entidades: [], filtro: { canal: "Retail" } } });
  ok(rf.ok && rf.vc.seleccion.modo === "filtro" && rf.vc.seleccion.n === 300, "una selección de 300 SÍ viaja como filtro (n, sin nombres)");
  const d = deriveViewContextOrErrors("comercial/01/tabla-cartera", BUILDERS.comercial, { scenario: SCN, requestContext: RC, seleccion: { modo: "explicita", entidades: muchos } });
  ok(d.ok && d.vc.seleccion.entidades.length === 0 && d.vc.seleccion.n === 300,
    "la derivación COLAPSA sola una selección grande: conserva el tamaño, descarta los nombres");
  const chica = muchos.slice(0, VIEW_SELECTION_MAX);
  const d8 = deriveViewContextOrErrors("comercial/01/tabla-cartera", BUILDERS.comercial, { scenario: SCN, requestContext: RC, seleccion: { modo: "explicita", entidades: chica } });
  ok(d8.ok && d8.vc.seleccion.modo === "explicita" && d8.vc.seleccion.entidades.length === VIEW_SELECTION_MAX,
    `una selección de ${VIEW_SELECTION_MAX} o menos sí viaja por nombre`);
  const d9 = deriveViewContextOrErrors("comercial/01/tabla-cartera", BUILDERS.comercial, { scenario: SCN, requestContext: RC, seleccion: { modo: "explicita", entidades: muchos.slice(0, VIEW_SELECTION_MAX + 1) } });
  ok(d9.ok && d9.vc.seleccion.entidades.length === 0, `${VIEW_SELECTION_MAX + 1} entidades ya no viajan por nombre — el corte es exacto`);
}

H("[5] LA LÍNEA DEL PLAN · ≤240, sin cifras de negocio");
{
  const largas = [], conCifra = [], sinSello = [];
  for (const [id, vc] of Object.entries(DERIVADOS)) {
    const l = projectViewContextForPlan(vc);
    if (!l || l.length > VIEW_PLAN_LINE_MAX) largas.push(`${id} (${l && l.length})`);
    // se permite el CONTEO del universo entre paréntesis; cualquier otra cifra (monto, %, decimal) está prohibida.
    const sinConteo = String(l).replace(/\(\d+\)/g, "");
    if (/\$|%|\d+[.,]\d/.test(sinConteo)) conCifra.push(`${id} → ${l}`);
    if (!/sello (probado|indicado|abierto)\.?$/.test(String(l))) sinSello.push(id);
  }
  ok(!largas.length, `las ${Object.keys(DERIVADOS).length} líneas de contexto entran en ${VIEW_PLAN_LINE_MAX} caracteres`, largas.join(", "));
  ok(!conCifra.length, "ninguna línea lleva una cifra de negocio (el contexto identifica, no autoriza)", conCifra.join("\n      "));
  ok(!sinSello.length, "toda línea cierra declarando su sello epistémico", sinSello.join(", "));
  ok(projectViewContextForPlan(null) === null && projectViewContextForPlan({}) === null,
    "sin contexto no se agrega NI UN carácter al prompt");
  // el candado O(1) también en el prompt
  const muchos = Array.from({ length: 300 }, (_, i) => `Entidad ${i}`);
  const d = deriveViewContextOrErrors("comercial/01/tabla-cartera", BUILDERS.comercial, { scenario: SCN, requestContext: RC, seleccion: { modo: "explicita", entidades: muchos } });
  const linea = projectViewContextForPlan(d.vc);
  ok(!/Entidad 1\b/.test(linea) && linea.length <= VIEW_PLAN_LINE_MAX, "una selección de 300 no mete 300 nombres en el prompt", linea);
}

H("[6] DIRECCIÓN CANÓNICA · round-trip y CTA");
{
  const rotos = [], noCta = [];
  for (const [id, vc] of Object.entries(DERIVADOS)) {
    const s = formatAddress(addressFromViewContext(vc));
    const back = s && parseAddress(s);
    const res = back && resolveAddress(back);
    if (!s || !back || back.componentId !== id || !res || res.cara !== vc.vista || res.componentId !== id) rotos.push(`${id} → ${s}`);
    const act = normalizeSentrixAction(buildSentrixActionFromAddress(back));
    if (!act || !act.label || !Array.isArray(act.payload.clientes)) noCta.push(id);
    if (!evidenceForAddress(back, SCN)) noCta.push(`${id} (sin evidence)`);
  }
  ok(!rotos.length, `format → parse → resolve reabre EXACTAMENTE el mismo componente, en los ${Object.keys(DERIVADOS).length}`, rotos.join("\n      "));
  ok(!noCta.length, "toda dirección produce un CTA que sobrevive a normalizeSentrixAction", noCta.join(", "));
  for (const basura of ["", "http://x", "sentrix://", "sentrix://noexiste/01/x", "sentrix://comercial/99/kpi-ventas", null, 42, {}])
    if (parseAddress(basura) !== null) { FAIL++; console.log(`  ✗ parseAddress aceptó basura: ${JSON.stringify(basura)}`); }
  ok(true, "parseAddress devuelve null ante basura — nunca una dirección a medias");
  // regla 2: nunca más de una entidad en la dirección
  const vcMulti = validateViewContext({ ...DERIVADOS["comercial/01/tabla-cartera"], seleccion: { modo: "explicita", n: 3, entidades: ["A", "B", "C"], filtro: null } });
  const sMulti = formatAddress(addressFromViewContext(vcMulti.vc));
  ok(vcMulti.ok && (sMulti.match(/entidad=/g) || []).length === 0, "una selección de 3 NO pone entidades en la dirección (regla: una o ninguna)", sMulti);
  // regla 3: la dirección no lleva cifras de negocio
  const conPlata = Object.entries(DERIVADOS).map(([id, vc]) => [id, formatAddress(addressFromViewContext(vc))]).filter(([, s]) => /\$|%24/.test(s));
  ok(!conPlata.length, "ninguna dirección transporta una cifra: es un puntero, no un payload", conPlata.map(([id]) => id).join(", "));
}

H("[7] INVALIDACIÓN · al cambiar vista, filtro, entidad o tema");
{
  const a = DERIVADOS["comercial/01/tabla-cartera"];
  const b = DERIVADOS["comercial/01/sostiene-clientes"];
  /* ⚠️ ERA "capital/01/mapa", que se fue el 2026-08-27 con la línea que narraba el mapa del capital. Lo que
     esta línea prueba —que dos componentes distintos nunca comparten key— no depende de CUÁL sea el tercero,
     así que toma el KPI de capital, que sigue en pantalla y en el manifiesto. */
  const cap = DERIVADOS["capital/01/kpi-capital"];
  ok(a.key !== b.key && a.key !== cap.key, "dos componentes distintos nunca comparten key");
  const a2 = deriveViewContextOrErrors("comercial/01/tabla-cartera", buildResumenComercial(SCN), { scenario: SCN, requestContext: RC }).vc;
  ok(a2.key === a.key, "repintar el MISMO componente con el MISMO dato no invalida nada");
  const aCtrl = deriveViewContextOrErrors("comercial/01/tabla-cartera", BUILDERS.comercial, { scenario: SCN, requestContext: RC, controles: { todos: 1 } }).vc;
  ok(aCtrl.key !== a.key, "cambiar un control declarado SÍ cambia la key");
  const aEsc = deriveViewContextOrErrors("comercial/01/tabla-cartera", buildResumenComercial("actual"), { scenario: "actual", requestContext: RC }).vc;
  ok(aEsc.key !== a.key, "cambiar de escenario SÍ cambia la key");
  const aFil = validateViewContext({ ...a, filtros: { canal: "Retail" } }).vc;
  ok(aFil.key !== a.key, "cambiar un filtro SÍ cambia la key");
  const aSel = validateViewContext({ ...a, seleccion: { modo: "explicita", n: 1, entidades: ["X"], filtro: null } }).vc;
  ok(aSel.key !== a.key, "cambiar la selección SÍ cambia la key");
  const prev = { key: a.key, vc: a, turno: 3 };
  ok(invalidateViewContext(prev, b, { turno: 4, requestContext: RC }) === b, "con contexto fresco manda el fresco — el anterior se descarta ENTERO, nunca se mezcla");
  // EL TTL SE MIDE EN LA UNIDAD REAL DE `turno` = history.length, y history lleva DOS entradas por turno
  // conversacional (userMsg + adiMsg, ChatADI.jsx). Medirlo en "turnos" contra un delta en "entradas" hacía que el
  // contexto muriera siempre en el turno siguiente. Este gate afirma el paso REAL del caller, no uno de laboratorio.
  ok(invalidateViewContext(prev, null, { turno: 3 + VIEW_CONTEXT_TTL_ENTRADAS, requestContext: RC }) === a, `sin contexto fresco el anterior sobrevive ${VIEW_CONTEXT_TTL_TURNOS} turno conversacional (${VIEW_CONTEXT_TTL_ENTRADAS} entradas de history)`);
  ok(invalidateViewContext(prev, null, { turno: 3 + VIEW_CONTEXT_TTL_ENTRADAS + 1, requestContext: RC }) === null, "vencido el TTL, se descarta");
  ok(VIEW_CONTEXT_TTL_ENTRADAS === VIEW_CONTEXT_TTL_TURNOS * VIEW_CONTEXT_ENTRADAS_POR_TURNO, "el TTL en entradas es el TTL en turnos por el paso real del contador — la conversión es explícita, no implícita");
  ok(invalidateViewContext(prev, null, { turno: 3 + VIEW_CONTEXT_ENTRADAS_POR_TURNO, requestContext: RC }) === a, "el turno conversacional SIGUIENTE con el panel cerrado todavía ve la pantalla que el usuario miraba");
  ok(invalidateViewContext(prev, null, { turno: 4, requestContext: RC, plan: { scope: { level: "global" } } }) === null,
    "cambio de TEMA (plan.scope.level=global, el mismo disparador de conversationScope) invalida");
  ok(invalidateViewContext(prev, null, { turno: 4, requestContext: { tenantId: "otra-empresa" } }) === null, "tenant distinto descarta el contexto ENTERO");
  ok(invalidateViewContext(prev, { ...a, tenantId: "otra-empresa" }, { turno: 4, requestContext: RC }) === null, "un contexto fresco de OTRO tenant no entra");
  ok(viewContextKey(a) === a.key, "la key es determinística y se recalcula igual");
}

H("[8] ÍNDICE tool→componente · se abstiene antes que adivinar");
{
  ok(componentIdForTool("salesRead", "concentracion") === "comercial/01/pareto-ventas", "salesRead@concentracion → el Pareto de ventas");
  ok(componentIdForTool("diagnose", "carga") === "comercial/02/acciones-vs-meta", "diagnose@carga → acciones contra la meta");
  ok(componentIdForTool("entityProfile") === "ficha/otro/ficha-cliente", "entityProfile → el Perfil Ejecutivo (no el contexto ambiente de la vista)");
  /* ⚠️ APUNTABA A "capital/01/veredicto", que se fue el 2026-08-27 con la tarjeta del veredicto del capital.
     Lo que esta línea prueba es que la tool aterriza EN LA CARA CAPITAL, no en cuál de sus piezas: ahora cae
     en los focos, que es la pieza viva más cercana a lo que inventoryStatus devuelve. */
  ok(componentIdForTool("inventoryStatus") === "capital/01/focos", "inventoryStatus → la cara Capital");
  ok(componentIdForTool("queryMetric") === null, "queryMetric SIN args se ABSTIENE: cruza Comercial y Capital, y adivinar abriría la cara equivocada");
  // LA PIEZA QUE LA TOOL DE VERDAD DEMUESTRA (owner 2026-08-09, decisión 6 · hallazgo E). Esto esperaba
  // `capital/01/kpi-capital` porque la card del capital TOTAL declaraba como evidencia un ranking por SKU que
  // nunca devuelve un total. Ahora ese ranking apunta a la pieza que sí demuestra —las barras de capital por
  // SKU— y el TOTAL lo demuestra la tool que lo devuelve. El índice no perdió cobertura: la corrigió.
  ok(componentIdForTool("queryMetric", null, { metric: "capital", dimension: "sku" }) === "capital/01/barras", "queryMetric con args de capital resuelve a Capital · a las barras por SKU, que es lo que ese ranking demuestra");
  ok(componentIdForTool("inventoryStatus", "estado") === "capital/01/kpi-capital", "inventoryStatus@estado → la cabecera del capital, que es la tool que SÍ devuelve el total");
  ok(componentIdForTool("queryMetric", null, { metric: "ventas", dimension: "cliente" }) === "comercial/01/kpi-ventas", "queryMetric con args de ventas resuelve a Comercial");
  ok(componentIdForTool("queryMetric", null, { metric: "acciones", dimension: "cliente" }) === "comercial/01/kpi-acciones-comerciales", "queryMetric con args de acciones comerciales resuelve al KPI que las muestra (antes no tenía tool)");
  ok(componentIdForTool("noExisteEstaTool") === null, "una tool sin componente devuelve null y cae al default honesto");
  const amb = toolIndexConflicts();
  ok(amb.every((x) => x.vistas.length > 1), `las ${amb.length} ambigüedades declaradas son exactamente las tools que cruzan vistas`, amb.map((x) => `${x.tool}: ${x.vistas.join("+")}`).join(" · "));
  const vista = Object.entries(VIEW_MANIFEST).filter(([, m]) => m.tipo === "vista").map(([id]) => id);
  ok(vista.length === VISTAS.length, "los componentes de vista existen pero NO compiten en el índice de evidencia");
}

H("[9] PROYECCIÓN AL MOTOR · todo lo estructural, cero cifras");
{
  const p = projectViewContextForCoercion(DERIVADOS["comercial/01/pareto-ventas"]);
  ok(p && p.evidencia.length && p.evidencia[0].tool === "salesRead", "la proyección al motor lleva las calls declaradas del componente");
  ok(p && p.universo && p.universo.n === 13, `el universo del Pareto son las entidades REALES (${p && p.universo && p.universo.n}), no las barras dibujadas`);
  const sinTool = projectViewContextForCoercion(DERIVADOS["comercial/02/acciones-vs-promedio-cartera"]);
  ok(sinTool && !sinTool.evidencia.length && sinTool.sinTool, "un componente sin equivalente en el oráculo proyecta su `sinTool`, no una call inventada");
  // EL ESTADO DE CONCORDANCIA VIAJA SIEMPRE (owner 2026-08-09, decisión 11). Antes acá se pedía que la
  // `divergencia` de kpi-ventas viajara declarada — y eso dejaba pasar los 16 componentes cuyo campo era `null`:
  // el motor no podía distinguir "esta cifra cierra" de "nadie lo comprobó". Ahora se exige lo que reemplazó a ese
  // null: un estado del vocabulario cerrado, con razón, en TODOS los componentes proyectados.
  const proyecciones = Object.keys(DERIVADOS).map((id) => [id, projectViewContextForCoercion(DERIVADOS[id])]).filter(([, p]) => p);
  const sinEstado = proyecciones.filter(([, p]) => !p.concordancia || !CONCORDANCIA_ESTADOS.includes(p.concordancia.estado) || !String(p.concordancia.razon || "").trim());
  ok(!sinEstado.length,
    `el estado de concordancia viaja declarado al motor en los ${proyecciones.length} componentes proyectados (nunca \`null\`)`,
    sinEstado.map(([id]) => id).join(", "));
  const divs = proyecciones.filter(([, p]) => p.concordancia.estado === "divergent");
  ok(divs.length > 0 && divs.every(([, p]) => Array.isArray(p.concordancia.campos) && p.concordancia.campos.length),
    `las ${divs.length} divergencias conocidas viajan con los campos exactos que no reconcilian`);
  // NI UNA FILA, NI UNA CIFRA. La proyección lleva IDENTIDAD y ESTRUCTURA; los únicos números permitidos son
  // conteos (el tamaño del universo y el de la selección). Las cifras del negocio salen de las tools, nunca de acá.
  // (Los textos de `sinTool`/`divergencia` sí pueden citar un umbral de política — son la explicación de por qué
  //  una cifra NO se puede contrastar, no la cifra contrastada.)
  const PROHIBIDAS = ["valor", "monto", "total", "cifra", "filas", "rows", "barras", "series", "datos", "boleta"];
  const conDatos = [], conNumero = [];
  for (const id of Object.keys(DERIVADOS)) {
    const proj = projectViewContextForCoercion(DERIVADOS[id]);
    for (const k of PROHIBIDAS) if (k in proj) conDatos.push(`${id}.${k}`);
    for (const [k, v] of Object.entries(proj)) {
      if (typeof v === "number") conNumero.push(`${id}.${k}`);
      if (k === "universo" && v) for (const [uk, uv] of Object.entries(v)) if (typeof uv === "number" && uk !== "n") conNumero.push(`${id}.universo.${uk}`);
    }
  }
  ok(!conDatos.length, "la proyección al motor no transporta filas ni cifras: ninguna llave de dato", conDatos.join(", "));
  ok(!conNumero.length, "el único número de la proyección es el conteo del universo", conNumero.join(", "));
}

console.log(`\n${FAIL ? "✗" : "✓"} VIEW CONTEXT GATE · ${PASS} pasaron · ${FAIL} fallaron`);
process.exit(FAIL ? 1 : 0);
