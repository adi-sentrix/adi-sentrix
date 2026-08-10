/* === _concordancia_escala_gate.mjs · CONCORDANCIA ADI↔SENTRIX · ESCALA (owner 2026-08-09) ======================
 *
 * POR QUÉ EXISTE. Los otros tres gates del frente corren contra el tenant demo: 13 clientes, 13 SKU. A esa escala
 * TODO parece O(1) — un ranking del eje entero son 13 filas y nadie lo nota. El defecto que este gate cierra era
 * invisible ahí y salía a la luz recién con un tenant de verdad: "explicame este gráfico" sobre `capital/01/barras`
 * siembra queryMetric{capital,sku}, que NO tiene cota propia, y el payload de la segunda pasada medía 6.114 B en el
 * demo y 613.411 B en un tenant de 5.200 SKU — ×100, ~118 B por SKU, lineal en las entidades. El candado O(1) del
 * ViewContext se cumplía perfecto (la línea del prompt no se movió ni un byte) y el prompt explotaba igual, porque
 * lo que crecía no era lo que el contexto TRANSPORTA sino lo que el contexto MANDA A PEDIR.
 *
 * QUÉ AFIRMA, contra un tenant sintético construido acá mismo (no el demo):
 *   [1] LA LÍNEA DEL PLAN ES O(1)     el mismo componente en dos tenants de tamaño muy distinto mueve el prompt de
 *                                     la primera pasada menos que un puñado de bytes.
 *   [2] LA SIEMBRA ESTÁ ACOTADA       toda entrada del manifiesto, proyectada al motor, o usa una tool con cota
 *                                     propia o viaja con `limit` ≤ VIEW_EVIDENCE_ROWS_MAX. Estructural: una entrada
 *                                     nueva que se olvide de la cota deja el gate en rojo.
 *   [3] BYTES REALES                  se corre la evidencia sembrada y se mide el payload de la segunda pasada en
 *                                     los dos tenants. El factor de crecimiento tiene que estar acotado.
 *   [4] LA MEMORIA ES O(1)            `conversationScope.current.entities` no tiene tope, y el bloque de memoria
 *                                     los escribía todos — en las DOS pasadas y en CADA turno posterior. Se afirma
 *                                     que el bloque no crece con n, y que por debajo del tope el texto es IDÉNTICO
 *                                     al de siempre (el candado no le puede cambiar el prompt a lo que está en prod).
 *   [5] EL RESIDUO, DECLARADO         las tools sembradas que hoy NO tienen forma de acotarse están enumeradas. El
 *                                     conjunto puede achicarse; si crece, el gate lo dice.
 *
 * Sin red, sin proveedor, sin crédito: importa módulos puros, corre las tools client-side y mide strings.
 *   node _concordancia_escala_gate.mjs
 */
import { initTenant, getTenantId } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { VIEW_MANIFEST } from "./src/adi/sentrix/viewManifest.js";
import {
  projectViewContextForPlan, projectViewContextForCoercion, sealViewContext,
  VIEW_EVIDENCE_ROWS_MAX, VIEW_PLAN_LINE_MAX,
} from "./src/adi/oracle/viewContext.js";
import { renderInteractionMemory, MEMORY_SCOPE_ENTITIES_MAX } from "./src/adi/oracle/persona.js";
import { buildPlanUserMessage } from "./src/adi/oracle/planPrompt.js";
import { buildNarrateUserMessageC } from "./src/adi/oracle/narratePromptC.js";
import { runPlan } from "./src/adi/oracle/toolRunner.js";
import { buildRequestContext } from "./src/adi/oracle/requestContext.js";
import { deriveViewContextOrErrors } from "./src/adi/sentrix/viewContextFrom.js";
import { buildMesaCapital } from "./src/adi/sentrix/mesaCapital.js";

let PASS = 0, FAIL = 0;
const B = (s) => Buffer.byteLength(typeof s === "string" ? s : JSON.stringify(s), "utf8");
const N = (v) => v.toLocaleString("es-CL");
const H = (t) => console.log(`\n${t}\n${"─".repeat(Math.min(110, t.length))}`);
function ok(cond, msg, extra = "") {
  if (cond) { PASS++; console.log(`  ✓ ${msg}`); }
  else { FAIL++; console.log(`  ✗ ${msg}${extra ? `\n      ${extra}` : ""}`); }
}

// ── el tenant sintético · mismo shape que TENANT_DEMO, sin un solo nombre del demo en las filas nuevas ──────────
const MAR = ["Samsung", "LG", "Philips", "Bosch", "Makita"];
const FAM = ["Electrodomésticos", "Línea Blanca", "Cuidado Personal", "Materiales de Construcción"];
const BOD = ["Santiago", "Valparaíso", "Concepción", "Antofagasta"];
const CAN = ["Retail", "Mayorista", "Online", "Distribuidor"];
const r2 = (v) => Math.round(v * 100) / 100;
function tenantSintetico(nClientes, nSkus) {
  const cv = TENANT_DEMO.clientesVentas.slice(), cm = TENANT_DEMO.clientesMargen.slice();
  for (let i = cv.length; i < nClientes; i++) {
    const nombre = `Cuenta Sintética ${String(i).padStart(4, "0")}`;
    const marca = MAR[i % MAR.length], sfamilia = FAM[i % FAM.length];
    const actual = 1200 + (i % 97) * 43, unidades = 40 + (i % 71) * 3, margen = r2(14 + (i % 23));
    const contribucion = Math.round(actual * margen / 100);
    cv.push({ nombre, sfamilia, marca, canal: CAN[i % CAN.length], actual, anterior: Math.round(actual * 0.93), unidades, unidadesAnt: Math.round(unidades * 0.95), pctRebate: 4.5, presupuesto: Math.round(actual * 1.05) });
    cm.push({ nombre, tipo: "cliente", marca, sfamilia, venta: actual, costo: actual - contribucion, rebates: Math.round(actual * 0.04), contribucion, pctRebate: 4.5, margen, costoMedio: r2((actual - contribucion) / unidades), precioLista: r2(actual / unidades * 1.2), unidades, benchmark: 30.1 });
  }
  const si = TENANT_DEMO.skuInventario.slice(), sm = TENANT_DEMO.skusMargen.slice();
  for (let i = si.length; i < nSkus; i++) {
    const sku = `SIN-${String(i).padStart(5, "0")}`;
    const marca = MAR[i % MAR.length], sfamilia = FAM[i % FAM.length];
    const stockUnd = 5 + (i % 89), rotacion = r2(0.4 + (i % 61) / 10), doh = 10 + (i % 240), margenPct = r2(10 + (i % 29));
    si.push({ sku, bodega: BOD[i % BOD.length], marca, sfamilia, stockUSD: 400 + (i % 211) * 37, stockUnd, ventaDiaria: r2(stockUnd / doh), vendidoMes: Math.round(stockUnd * rotacion), rotacion, doh, cobertura: doh, margenPct, diasSinVenta: i % 7 === 0 ? 40 + (i % 120) : 0, estado: rotacion < 2 ? "Lento" : "Activo", alerta: rotacion < 2 ? "sobrestock" : "ok", pctInv: r2(100 / nSkus) });
    const venta = 900 + (i % 173) * 61, unidades = 10 + (i % 143), contribucion = Math.round(venta * margenPct / 100);
    sm.push({ nombre: sku, tipo: "sku", marca, sfamilia, venta, costo: venta - contribucion, rebates: Math.round(venta * 0.045), contribucion, pctRebate: 4.5, margen: margenPct, costoMedio: r2((venta - contribucion) / unidades), precioLista: r2(venta / unidades * 1.25), unidades, benchmark: 30.1 });
  }
  return { ...TENANT_DEMO, id: "escala", nombre: "Tenant sintético de escala", clientesVentas: cv, clientesMargen: cm, skuInventario: si, skusMargen: sm };
}

const SCN = "actual";
// GRANDE es deliberadamente modesto (400 SKU) para que el gate corra en segundos: la LINEALIDAD se demuestra con la
// PENDIENTE entre dos tamaños, no con el tamaño absoluto. Un dump lineal a 400 filas ya es inequívoco.
const CHICO = TENANT_DEMO, GRANDE = tenantSintetico(60, 400);
const COMPONENTE = "capital/01/barras";   // el caso que destapó el defecto: queryMetric{capital,sku}, sin cota propia

function contexto(tenant) {
  initTenant(tenant);
  const rc = buildRequestContext({ tenantId: getTenantId(), scenario: SCN });
  const d = deriveViewContextOrErrors(COMPONENTE, buildMesaCapital(SCN), { scenario: SCN, requestContext: rc });
  return { rc, vc: d.ok ? d.vc : null, errores: d.ok ? null : d.errors };
}
function payloadDe(tenant, calls) {
  initTenant(tenant);
  const rc = buildRequestContext({ tenantId: getTenantId(), scenario: SCN });
  const plan = { intent: "answer", mode: "default", rationale: "", scope: { level: "global", entities: [] }, calls };
  const { results, ledger } = runPlan(plan, { scenario: SCN, requestContext: rc });
  const p = buildNarrateUserMessageC({ text: "explicame este gráfico", plan, results, ledgerFigs: ledger.figs, mem: {}, history: [], pref: null, scenario: SCN, requestContext: rc, viewContext: null, formaRespuesta: "explicar_componente" });
  return { bytes: B(p), figs: (ledger.figs || []).length };
}

console.log(`CONCORDANCIA · ESCALA · demo ${CHICO.clientesVentas.length}c/${CHICO.skuInventario.length}sku · sintético ${GRANDE.clientesVentas.length}c/${GRANDE.skuInventario.length}sku`);
console.log(`topes declarados: siembra ${VIEW_EVIDENCE_ROWS_MAX} filas · línea del plan ${VIEW_PLAN_LINE_MAX} chars · memoria ${MEMORY_SCOPE_ENTITIES_MAX} entidades`);

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════
H("[1] LA LÍNEA DEL PLAN · lo que el contexto TRANSPORTA no crece con el tenant");
{
  const c = contexto(CHICO), g = contexto(GRANDE);
  ok(!!c.vc && !!g.vc, "el contexto deriva del builder vivo en los dos tenants", `${(c.errores || []).join(" · ")} ${(g.errores || []).join(" · ")}`);
  if (c.vc && g.vc) {
    const TXT = "explicame este gráfico";
    const bc = B(buildPlanUserMessage([], TXT, projectViewContextForPlan(c.vc)));
    const bg = B(buildPlanUserMessage([], TXT, projectViewContextForPlan(g.vc)));
    console.log(`      · primera pasada — demo ${N(bc)} B · sintético ${N(bg)} B (Δ ${bg - bc} B)`);
    ok(Math.abs(bg - bc) <= 16, `el prompt de la primera pasada se mueve ${Math.abs(bg - bc)} B entre los dos tenants — O(1) real`);
    // el tope está declarado en CARACTERES (VIEW_PLAN_LINE_MAX), que es lo que el recorte de la proyección cuenta.
    // En bytes la misma línea pesa más (los acentos y las comillas angulares son multibyte en UTF-8) — medirla en
    // bytes contra un tope de caracteres sería inventarle al producto un límite que nunca declaró.
    const linea = projectViewContextForPlan(g.vc);
    ok(linea.length <= VIEW_PLAN_LINE_MAX, `la línea respeta su tope declarado: ${linea.length} de ${VIEW_PLAN_LINE_MAX} caracteres (${N(B(linea))} B)`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════
H("[2] LA SIEMBRA · toda evidencia declarada viaja ACOTADA o con cota propia de la tool");
{
  // tools con cota PROPIA en el registro (su default ya recorta) — no necesitan `limit` del manifiesto
  // `pnlRead` con el alcance que el manifiesto siembra (el NEGOCIO, sin `dimension`) tiene cota ESTRUCTURAL, no
  // por argumento: la cascada son 8 peldaños fijos y las líneas de gasto están topeadas en 10 por el propio
  // contrato del P&L (`setPnlLines`/`_perfilLineas` cortan en 10). Su evidencia no crece con el tenant —
  // `_pnl_canonico_gate.mjs` lo mide con las 10 líneas declaradas y contra el tope de filas de la siembra.
  const CON_COTA_PROPIA = new Set(["gridTable", "tensionRead", "trend", "entityProfile", "entityRecord", "compareEntities", "defineConcept", "executiveSummary", "pnlRead"]);
  // tools que HOY no tienen forma de acotarse: el residuo declarado (ver [5])
  const SIN_FORMA_DE_ACOTAR = new Set(["marginRead", "salesRead", "contributionRead", "diagnose", "inventoryStatus", "simulateCarga", "simulateCapital", "simulateCosto", "simulateGeneral", "simulate"]);
  initTenant(GRANDE);
  const rc = buildRequestContext({ tenantId: getTenantId(), scenario: SCN });
  const sinCota = [];
  for (const [cid, m] of Object.entries(VIEW_MANIFEST)) {
    if (!Array.isArray(m.evidencia) || !m.evidencia.length) continue;
    const vc = sealViewContext({
      tenantId: rc.tenantId, componentId: cid, vista: m.vista, seccion: m.seccion, tipo: m.tipo,
      metrica: m.metrica || null, eje: m.eje || null, periodo: null, escenario: SCN,
      universo: { kind: (m.universo && m.universo.kind) || "negocio", n: null, label: null, cierraCon: null },
      seleccion: { modo: "todas", n: 0, entidades: [], filtro: null }, filtros: {},
      comparacion: m.comparacion || null, controles: {}, evidenceIds: [], estatus: m.estatusDefault || "indicado",
    });
    const proj = vc ? projectViewContextForCoercion(vc) : null;
    if (!proj) continue;
    for (const e of proj.evidencia) {
      if (CON_COTA_PROPIA.has(e.tool) || SIN_FORMA_DE_ACOTAR.has(e.tool)) continue;
      const lim = Number(e.args && e.args.limit);
      if (!(isFinite(lim) && lim > 0 && lim <= VIEW_EVIDENCE_ROWS_MAX)) sinCota.push(`${cid} → ${e.tool} (limit=${e.args && e.args.limit})`);
    }
  }
  ok(!sinCota.length, `ninguna evidencia sembrada pide el eje entero sin cota (tope ${VIEW_EVIDENCE_ROWS_MAX})`, sinCota.slice(0, 6).join("\n      "));
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════
H("[3] BYTES REALES · el payload de la segunda pasada, con la evidencia que el componente declara");
{
  const m = VIEW_MANIFEST[COMPONENTE];
  const vc = contexto(GRANDE).vc;
  const proj = vc ? projectViewContextForCoercion(vc) : null;
  const callsAcotadas = (proj ? proj.evidencia : []).map((e) => ({ tool: e.tool, args: { ...e.args } }));
  const callsCrudas = (m.evidencia || []).map((e) => ({ tool: e.tool, args: { ...(e.args || {}) } }));
  const g = payloadDe(GRANDE, callsAcotadas);
  const c = payloadDe(CHICO, callsAcotadas);
  const crudo = payloadDe(GRANDE, callsCrudas);
  console.log(`      · ${COMPONENTE} — demo ${N(c.bytes)} B (${c.figs} cifras) · sintético ${N(g.bytes)} B (${g.figs} cifras)`);
  console.log(`      · el MISMO componente sin la cota: ${N(crudo.bytes)} B (${crudo.figs} cifras) — lo que costaba antes del candado`);
  ok(g.figs <= VIEW_EVIDENCE_ROWS_MAX, `la evidencia sembrada autoriza ${g.figs} cifras, no las ${crudo.figs} del eje entero`);
  ok(g.bytes / Math.max(1, c.bytes) < 4, `el payload crece ×${(g.bytes / Math.max(1, c.bytes)).toFixed(1)} al multiplicar el tenant por ${(GRANDE.skuInventario.length / CHICO.skuInventario.length).toFixed(0)} — acotado, no proporcional`);
  ok(crudo.bytes > g.bytes * 3, `y sin el candado sería ×${(crudo.bytes / Math.max(1, g.bytes)).toFixed(1)} más pesado — el candado NO es decorativo`);
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════
H("[4] LA MEMORIA · el bloque que viaja en CADA turno posterior, en las DOS pasadas");
{
  const mkScope = (n, dim = "sku") => ({ version: 1, history: [], current: {
    turno: 2, dimension: dim, entities: Array.from({ length: n }, (_, i) => `SIN-${String(i).padStart(5, "0")}`),
    selection: null, periodo: null, filtros: null, metrica: null, operacion: "answer", modo: "default",
    tool: "queryMetric", origen: { callId: null, boletaLabels: [] }, supuestos: [], faltantes: [], ofertaPendiente: null, tenant: null,
  } });
  const b = (n) => B(renderInteractionMemory({ conversationScope: mkScope(n) }));
  const b20 = b(20), b400 = b(400), b5000 = b(5000);
  console.log(`      · bloque de memoria — 20 entidades ${N(b20)} B · 400 ${N(b400)} B · 5.000 ${N(b5000)} B`);
  // Lo único que todavía cambia entre 400 y 5.000 es el CONTEO impreso ("400" → "5000"): un dígito, o sea que crece
  // con el LOGARITMO del tamaño, no con el tamaño. Esa es la diferencia entre decir cuántos son y nombrarlos.
  ok(Math.abs(b5000 - b400) <= 8, `pasar de 400 a 5.000 entidades mueve ${b5000 - b400} B — los dígitos del conteo, nada más (${b400} → ${b5000})`);
  ok(Math.abs(b400 - b20) < 512, "y por encima del tope el bloque queda en un tamaño fijo, no en uno proporcional");
  const costoPorEntidad = (b5000 - b400) / (5000 - 400);
  ok(Math.abs(costoPorEntidad) < 0.01, `costo marginal por entidad en memoria: ${costoPorEntidad.toFixed(5)} B — indistinguible de cero`);
  const nombres = mkScope(5000).current.entities;
  const txt = renderInteractionMemory({ conversationScope: mkScope(5000) });
  ok(!nombres.some((x) => txt.includes(x)), "ni uno de los 5.000 nombres aparece en el bloque que lee el modelo");
  ok(/5000|5\.000/.test(txt), "el TAMAÑO sí viaja (se puede decir cuántos son), el contenido no");
  // y la contra-prueba: por debajo del tope, el texto de siempre, sin una coma de diferencia
  const chico = mkScope(6);
  const linea = renderInteractionMemory({ conversationScope: chico });
  ok(linea.includes(`entidades=[${chico.current.entities.join(", ")}]`),
    `por debajo del tope (${MEMORY_SCOPE_ENTITIES_MAX}) la línea es la de siempre — el candado no le cambia el prompt a lo que ya está en producción`);
  // el tope tiene que estar por encima de lo que el demo puede emitir con una sola tool, o cambiaría el prod de hoy
  const maxDemo = Math.max(CHICO.clientesVentas.length, CHICO.skuInventario.length, 20);
  ok(MEMORY_SCOPE_ENTITIES_MAX >= maxDemo, `el tope (${MEMORY_SCOPE_ENTITIES_MAX}) está por encima de lo máximo que el demo emite con una tool (${maxDemo})`);
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════
H("[5] EL RESIDUO DECLARADO · lo que HOY no se puede acotar, enumerado (puede bajar, nunca subir en silencio)");
{
  // Estas tools no aceptan un tope de filas (o lo aceptan solo en focos que la siembra no usa): su evidencia crece
  // con el tenant y eso está DICHO, no escondido. Cerrarlo es una decisión de producto —cambia lo que ADI queda
  // autorizado a afirmar—, no una corrección de escala.
  const DECLARADAS = new Set(["marginRead", "salesRead", "contributionRead", "diagnose", "inventoryStatus", "simulateCarga", "simulateCapital", "simulateCosto", "simulateGeneral", "simulate"]);
  // pnlRead: cota ESTRUCTURAL con el alcance sembrado (ver [2]) — la cascada del negocio no crece con el tenant.
  const CON_COTA = new Set(["queryMetric", "gridTable", "tensionRead", "trend", "entityProfile", "entityRecord", "compareEntities", "defineConcept", "executiveSummary", "pnlRead"]);
  const usadas = new Set();
  for (const m of Object.values(VIEW_MANIFEST)) for (const e of (m.evidencia || [])) usadas.add(e.tool);
  const nuevas = [...usadas].filter((t) => !DECLARADAS.has(t) && !CON_COTA.has(t));
  ok(!nuevas.length, "el manifiesto no sembró ninguna tool fuera de las clasificadas (con cota / residuo declarado)", nuevas.join(", "));
  const residuo = [...usadas].filter((t) => DECLARADAS.has(t)).sort();
  console.log(`      · tools sembradas SIN cota posible hoy: ${residuo.join(", ")}`);
  console.log(`      · su evidencia sigue creciendo con el tenant — declarado, no corregido (decisión del owner)`);
  ok(residuo.length <= DECLARADAS.size, "el residuo está acotado por la lista declarada");
}

console.log(`\n${FAIL === 0 ? "✓" : "✗"} CONCORDANCIA · ESCALA · ${PASS} pasaron · ${FAIL} fallaron`);
process.exit(FAIL ? 1 : 0);
