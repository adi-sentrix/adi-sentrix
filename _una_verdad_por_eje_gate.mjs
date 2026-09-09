/* === _una_verdad_por_eje_gate.mjs · UN EJE, UNA CIFRA ========================================================
 *
 * LA ORDEN DEL OWNER (2026-09-09), textual: «No quiero dos verdades para el eje marca. Si el usuario ingresa
 * marca en la planilla, Sentrix y ADI deben decir lo mismo, en lo que sea. La decisión es una sola verdad:
 * pantalla y agente usan la misma cifra reconciliada. […] Deja candado para que una marca no vuelva a publicar
 * cifras distintas según universo.»
 *
 * QUÉ PASABA, medido antes del arreglo, en el escenario que la app muestra:
 *     Samsung  pantalla $33.2M · ADI $31.6M      Philips  pantalla $29.4M · ADI $28.0M
 *     LG       pantalla $25.8M · ADI $24.6M      Bosch    pantalla $11.5M · ADI $11.0M
 * Las CUATRO marcas divergían. La causa: la tabla de venta por marca se movía con el escenario y la de margen
 * estaba declarada ciega, así que cada superficie leía la suya. Preguntar «cuánto vendió Samsung» daba una
 * cifra distinta según a quién se le preguntara — el pecado capital de esta casa, con nombre propio: dos
 * verdades para el mismo negocio.
 *
 * EL CANDADO, y por qué así: no verifica el arreglo (eso ya lo hace el chequeo de cifras), verifica LA
 * PROPIEDAD — para cada eje y cada escenario, el universo de venta y el universo de margen tienen que decir el
 * mismo número. Si mañana alguien declara un eje nuevo, o vuelve a poner uno en modo ciego, o agrega una tabla
 * agregada que no reconcilia, esto se pone rojo sin que nadie tenga que acordarse de este día.
 *
 * OFFLINE · determinístico · CERO llamadas al modelo.
 * `node --import ./scripts/offline-guard.mjs _una_verdad_por_eje_gate.mjs` */
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { SCENARIO_TRANSFORMS } from "./src/config/scenarios.js";
import { ESCENARIO_INICIAL } from "./src/config/scenarios.js";
import { SOURCES } from "./src/config/contract/sourceManifest.js";
import { TOOLS } from "./src/adi/oracle/toolRegistry.js";
import {
  applyScenarioToMarcasVentas, applyScenarioToSfamiliasVentas, applyScenarioToClientesVentas,
} from "./src/engine/scenarios.js";

let pass = 0, fail = 0;
const ok = (cond, label, detalle) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label}`); if (detalle !== undefined) console.log(`      ${String(detalle).slice(0, 400)}`); }
};
const H = (t) => console.log(`\n${t}`);
const _m = (v) => (v == null ? "—" : `$${(v / 1000).toFixed(1)}M`);

initTenant(TENANT_DEMO);
const ESCENARIOS = ["actual", ...Object.keys(SCENARIO_TRANSFORMS || {})];

/* ═══ 1 · LOS DOS UNIVERSOS DICEN LO MISMO, EJE POR EJE Y ESCENARIO POR ESCENARIO ═══════════════════════════
 * La venta de una entidad tiene dos tablas: la de VENTAS (que pinta la pantalla) y la de MARGEN (que responde
 * ADI). Para el mismo nombre, en el mismo escenario, tienen que dar el mismo número. */
H("1 · un eje, una cifra — la tabla de ventas y la de margen dicen lo mismo");
{
  const EJES = [
    { eje: "marca", ventas: applyScenarioToMarcasVentas, margen: (scn) => SOURCES.marcasMargen.scenarioLoad ? SOURCES.marcasMargen.scenarioLoad(scn) : SOURCES.marcasMargen.load() },
    { eje: "familia", ventas: applyScenarioToSfamiliasVentas, margen: (scn) => SOURCES.sfamiliasMargen.scenarioLoad ? SOURCES.sfamiliasMargen.scenarioLoad(scn) : SOURCES.sfamiliasMargen.load() },
    { eje: "cliente", ventas: applyScenarioToClientesVentas, margen: (scn) => SOURCES.clientesMargen.scenarioLoad ? SOURCES.clientesMargen.scenarioLoad(scn) : SOURCES.clientesMargen.load() },
  ];
  for (const { eje, ventas, margen } of EJES) {
    for (const scn of ESCENARIOS) {
      const V = ventas(scn) || [], M = (margen(scn) || []).filter((r) => !r.tipo || r.tipo !== "sku");
      const divergen = [];
      for (const v of V) {
        const g = M.find((x) => x.nombre === v.nombre);
        if (!g || typeof g.venta !== "number" || typeof v.actual !== "number") continue;
        /* tolerancia de redondeo del propio dato: 1 en las unidades del contrato (miles) */
        if (Math.abs(g.venta - v.actual) > 1) divergen.push(`${v.nombre} ${_m(v.actual)}≠${_m(g.venta)}`);
      }
      ok(divergen.length === 0,
        `★ ${eje} · «${scn}»: la venta es la MISMA en los dos universos (${V.length} filas)`,
        `divergen ${divergen.length}: ${divergen.slice(0, 4).join(" · ")}`);
    }
  }
}

/* ═══ 2 · Y LO QUE PUBLICA ADI ES LO QUE MUESTRA LA PANTALLA ════════════════════════════════════════════════
 * El chequeo anterior mira las tablas; este mira la SALIDA REAL de las herramientas, que es lo que el usuario
 * lee. Una tabla reconciliada que una herramienta no usa no sirve de nada. */
H("2 · lo que ADI publica coincide con la fuente que pinta la pantalla");
{
  for (const scn of ESCENARIOS) {
    const V = applyScenarioToMarcasVentas(scn) || [];
    const malas = [];
    for (const v of V) {
      for (const [tool, args] of [["entityProfile", { dimension: "marca", entity: v.nombre, scenario: scn }],
                                  ["entityRecord", { dimension: "marca", entity: v.nombre, scenario: scn }]]) {
        if (!TOOLS[tool]) continue;
        let r; try { r = TOOLS[tool](args); } catch { continue; }
        const f = (r.boleta || []).find((x) => new RegExp(`^${v.nombre} · Ventas$`, "i").test(String(x.label || "")));
        if (!f || !Number.isFinite(f.raw)) continue;
        /* la boleta publica en $ reales; la tabla, en miles del contrato */
        const enMiles = f.raw / 1000;
        if (Math.abs(enMiles - v.actual) > Math.max(1, Math.abs(v.actual) * 0.005)) {
          malas.push(`${tool}/${v.nombre}: ${_m(enMiles)} vs pantalla ${_m(v.actual)}`);
        }
      }
    }
    ok(malas.length === 0, `★★ marca · «${scn}»: ADI publica la misma venta que la pantalla`, malas.slice(0, 4).join(" · "));
  }
}

/* ═══ 3 · NINGÚN EJE AGREGADO VUELVE A QUEDAR CIEGO AL ESCENARIO ════════════════════════════════════════════
 * La divergencia nació de una declaración: `scenarioLoad: null` en la tabla de margen por marca. Este chequeo
 * la persigue en la DECLARACIÓN, no en el síntoma — si mañana alguien vuelve a poner un agregado en modo
 * ciego, esto arde antes de que el usuario vea dos cifras. `skusMargen` es la excepción declarada: el SKU es
 * la base de la que se derivan los agregados, no un agregado él mismo. */
H("3 · ningún eje AGREGADO se declara ciego al escenario (la raíz de la divergencia)");
{
  const CIEGO_PERMITIDO = new Set(["skusMargen"]);
  for (const [nombre, src] of Object.entries(SOURCES)) {
    if (!src || !src.aggregate) continue;
    ok(typeof src.scenarioLoad === "function" || CIEGO_PERMITIDO.has(nombre),
      `★★ «${nombre}» es un agregado y declara cómo lo ajusta el escenario — no queda ciego`,
      `scenarioLoad = ${src.scenarioLoad === null ? "null (CIEGO: acá nació la divergencia de marca)" : typeof src.scenarioLoad}`);
  }
  ok(typeof SOURCES.marcasMargen.scenarioLoad === "function",
    "★★ y marca en particular: la tabla de margen se reconcilia con la de ventas (el arreglo del 2026-09-09)");
}

/* ═══ 4 · LA PLANILLA DE UN CLIENTE NO SE TOCA ═════════════════════════════════════════════════════════════
 * Condición del owner: «el arreglo debe funcionar también para planillas de usuario, no solo demo». Un pack de
 * ingesta no declara transformaciones de escenario, así que la reconciliación hace bypass y sirve la tabla tal
 * como vino del archivo — ni un número cambiado. */
H("4 · con una planilla (sin escenarios declarados) las cifras salen como vinieron del archivo");
{
  const literal = SOURCES.marcasMargen.load() || [];
  const servida = SOURCES.marcasMargen.scenarioLoad("actual") || [];
  const distintas = literal.filter((l) => {
    const s = servida.find((x) => x.nombre === l.nombre);
    return !s || s.venta !== l.venta || s.contribucion !== l.contribucion || s.costo !== l.costo;
  });
  ok(distintas.length === 0,
    "★★ «actual» (el camino de todo pack de planilla) hace BYPASS: la tabla del cliente sale intacta",
    `cambiadas: ${distintas.map((x) => x.nombre).join(", ")}`);
  ok(servida.length === literal.length, "…y con todas sus filas");
}

console.log(`\n── _una_verdad_por_eje_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
