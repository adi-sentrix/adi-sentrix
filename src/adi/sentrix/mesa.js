/* === adi/sentrix/mesa.js · MESA DE CONTROL 2.0 · PASE 1 (owner 2026-07-14: "me gusta, comienza") ===
 * El estado de la Mesa para los 3 movimientos del sello (entender→explicar→actuar):
 *   - estados: semáforo por KPI contra TU vara (POLICY/benchmarkOf · criterio C.2 del owner manda) — CERO cálculo
 *     nuevo: ventas contra el presupuesto del dato · margen contra la vara con la MISMA brecha material del detector
 *     (POLICY.margenBrechaMaterial) · contribución y capital directo de los focos del diagnose (una verdad).
 *   - accion: LA acción priorizada = el foco top del diagnose (ya viene ordenado por $) con su medida y su pregunta.
 *   - cambios: el movimiento del período — quién sube/cede en venta (actual vs anterior del dato) · la trayectoria
 *     de contribución (series ancladas de temporal.js — cierran EXACTO con el cuadro) · entradas/salidas del bloque
 *     80/20 (concentración del MOTOR sobre las mismas filas, hoy vs año anterior).
 * Cada estado, acción y línea lleva su PREGUNTA a ADI (anti-BI: nada mudo) — todas se prueban por _promise_gate.
 * Registro EJECUTIVO en todo texto emitido (lockeado por _registro_gate). Puro · client-side · motor sellado intacto. */
import { composeSpecDiagnose } from "../specRetrieval.js";
import { applyScenarioToClientesVentas, applyScenarioToClientesMargen } from "../../engine/scenarios.js";
import { POLICY, benchmarkOf } from "../../config/businessPolicy.js";
import { buildEntityEvolution } from "./temporal.js";
import { concentracion } from "../diagnosis/economicDiagnosis.js";

const _r1 = (n) => Math.round(n * 10) / 10;
const _sum = (a, f) => a.reduce((s, x) => s + (typeof f(x) === "number" ? f(x) : 0), 0);
const _money = (v) => {
  const a = Math.abs(v), s = v < 0 ? "-" : "";
  if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${s}$${Math.round(a / 1e3)}K`;
  return `${s}$${Math.round(a)}`;
};
const _moneyK = (vK) => _money(vK * 1000);   // dato comercial en $K → $
const _pct = (v) => `${v >= 0 ? "+" : "−"}${Math.abs(_r1(v))}%`;

// ── LA ACCIÓN por detector (medida ejecutiva + su pregunta · la pregunta es una PROMESA gate-ada) ──
const _ACCION = {
  carga: (f, top) => ({
    titulo: `Renegociar la carga comercial de ${top.entidad}`,
    detalle: `${_money(f.subtotal_usd)} recuperable si la carga vuelve al target (${POLICY.targetCarga}%) — la cuenta más pesada es ${top.entidad} (${_money(top.usd)}).`,
    ask: `¿Cómo recupero la carga de ${top.entidad}?`,
  }),
  margen: (f, top) => ({
    titulo: `Recuperar el margen que cede ${top.entidad}`,
    detalle: `${_money(f.subtotal_usd)} de contribución no capturada contra tu vara — la brecha más grande está en ${top.entidad} (${_money(top.usd)}).`,
    ask: `¿Cómo mejoro el margen?`,
  }),
  capital: (f) => ({
    titulo: `Liberar el capital detenido`,
    detalle: `${_money(f.subtotal_usd)} en ${f.items.length} SKU sin rotar — capital que puede volver a trabajar.`,
    ask: `¿Dónde está detenido mi capital?`,
  }),
};

/* buildMesaEstado(scenario) → { vara, estados, accion, cambios } · todo formateado (la UI solo renderiza) */
export function buildMesaEstado(scenario) {
  const s = scenario || "bonanza";
  const V = applyScenarioToClientesVentas(s) || [];
  const M = applyScenarioToClientesMargen(s) || [];
  const vara = benchmarkOf(null);   // TU vara (criterio C.2 del owner si lo fijó · si no, dato/POLICY)

  // los focos del diagnose (MISMO motor que la lectura y los paneles · ya ordenados por $)
  const diag = composeSpecDiagnose({ filters: {}, scenario: s });
  const F = (diag && diag.evidence && diag.evidence.findings) || [];
  const by = (d) => F.find((x) => x.detector === d);
  const mg = by("margen"), cg = by("carga"), cap = by("capital");

  // ── ESTADOS · semáforo por KPI (verde/ámbar/rojo) + la línea contra la vara + su pregunta ──
  // VENTAS · contra el presupuesto del dato (la vara operativa) y el año anterior — ambos vienen por fila.
  const ventasK = _sum(V, (r) => r.actual), antK = _sum(V, (r) => r.anterior), pptoK = _sum(V, (r) => r.presupuesto);
  const vsPpto = pptoK ? _r1(((ventasK - pptoK) / pptoK) * 100) : 0;
  const vsAnt = antK ? _r1(((ventasK - antK) / antK) * 100) : 0;
  const ventas = {
    estado: ventasK >= pptoK ? "verde" : ventasK >= antK ? "ambar" : "rojo",
    linea: `${_pct(vsPpto)} vs presupuesto · ${_pct(vsAnt)} vs año anterior`,
    ask: "¿Cómo van las ventas contra el presupuesto?",
  };
  // MARGEN · contra TU vara, con la MISMA brecha material del detector (una verdad — no un umbral de UI).
  const ventaBaseK = _sum(M, (r) => r.venta), contribK = _sum(M, (r) => r.contribucion);
  const margenProm = ventaBaseK ? (contribK / ventaBaseK) * 100 : 0;
  const gapVara = _r1(vara - margenProm);   // + = bajo la vara
  const margen = {
    estado: gapVara <= 0 ? "verde" : gapVara < POLICY.margenBrechaMaterial ? "ambar" : "rojo",
    linea: gapVara <= 0 ? `${Math.abs(gapVara)} pp sobre tu vara (${vara}%)` : `${gapVara} pp bajo tu vara (${vara}%)`,
    ask: "¿Quiénes están bajo el margen mínimo?",
  };
  // CONTRIBUCIÓN · los focos COMERCIALES del diagnose (0 = verde · 1 = ámbar · 2 = rojo — derivado, sin umbral nuevo).
  const contribucion = {
    estado: !mg && !cg ? "verde" : mg && cg ? "rojo" : "ambar",
    linea: !mg && !cg ? "sin fugas materiales contra tu vara"
      : mg && cg ? `${_money(mg.subtotal_usd + cg.subtotal_usd)} de fuga entre margen y carga comercial`
      : mg ? `${_money(mg.subtotal_usd)} sin capturar contra tu vara`
      : `${_money(cg.subtotal_usd)} de carga sobre el target`,
    ask: "¿Cuánta contribución no estoy capturando?",
  };
  // CAPITAL · el detector de inventario (rotación/DOH de POLICY) · rojo = hay SKU críticos (el dato lo marca).
  const criticos = cap ? cap.items.filter((it) => it.critico).length : 0;
  const capital = {
    estado: !cap ? "verde" : criticos ? "rojo" : "ambar",
    linea: !cap ? "rotando sano — sin capital detenido material"
      : criticos ? `${_money(cap.subtotal_usd)} detenido · ${criticos} SKU crítico${criticos > 1 ? "s" : ""}`
      : `${_money(cap.subtotal_usd)} detenido en ${cap.items.length} SKU`,
    ask: "¿Dónde está detenido mi capital?",
  };

  // ── LA ACCIÓN priorizada · el foco top del diagnose (F ya viene ordenado por subtotal) ──
  const topF = F[0] || null;
  const accion = topF ? { ...(_ACCION[topF.detector] || _ACCION.margen)(topF, topF.items[0] || {}), usdFmt: _money(topF.subtotal_usd), askLabel: "Armame el plan" } : null;

  // ── QUÉ CAMBIÓ · 3 líneas de movimiento del período · cada una es una pregunta ──
  const cambios = [];
  // 1 · VENTA · quién más sube / más cede contra el año anterior (dato real por fila).
  const movers = V.filter((r) => typeof r.actual === "number" && typeof r.anterior === "number" && r.anterior > 0)
    .map((r) => ({ nombre: r.nombre, d: r.actual - r.anterior, p: _r1(((r.actual - r.anterior) / r.anterior) * 100) }));
  if (movers.length) {
    const up = movers.reduce((a, b) => (b.d > a.d ? b : a));
    const down = movers.reduce((a, b) => (b.d < a.d ? b : a));
    cambios.push({
      key: "venta",
      texto: down.d < 0
        ? `En venta, ${up.nombre} es quien más sube (${_moneyK(up.d)}, ${_pct(up.p)}); ${down.nombre} es quien más cede (${_moneyK(down.d)}, ${_pct(down.p)}).`
        : `En venta, ${up.nombre} es quien más sube (${_moneyK(up.d)}, ${_pct(up.p)}); ningún cliente retrocede contra el año anterior.`,
      ask: `¿Cómo viene ${up.nombre} vs el año pasado?`,
    });
  }
  // 2 · CONTRIBUCIÓN · la trayectoria del año por cuenta (series ancladas de temporal.js — cierran con el cuadro).
  const trayectos = M.map((r) => { const e = buildEntityEvolution(r.nombre, "contribucion"); return e && typeof e.pct === "number" ? { nombre: r.nombre, pct: e.pct } : null; }).filter(Boolean);
  if (trayectos.length) {
    const u = trayectos.reduce((a, b) => (b.pct > a.pct ? b : a));
    const d = trayectos.reduce((a, b) => (b.pct < a.pct ? b : a));
    cambios.push({
      key: "contribucion",
      texto: d.pct < 0
        ? `En contribución, ${u.nombre} trae la mejor trayectoria del año (${_pct(u.pct)}); ${d.nombre}, la que más cede (${_pct(d.pct)}).`
        : `En contribución, ${u.nombre} trae la mejor trayectoria del año (${_pct(u.pct)}); ninguna cuenta cierra bajo su arranque.`,
      ask: `¿De dónde saca ${u.nombre} su contribución?`,
    });
  }
  // 3 · EL BLOQUE 80/20 · entradas/salidas del grupo que concentra la venta (concentración del MOTOR · hoy vs año anterior).
  const cNow = concentracion(V.map((r) => ({ nombre: r.nombre, valor: Number(r.actual) || 0 })), 0.8);
  const cAnt = concentracion(V.map((r) => ({ nombre: r.nombre, valor: Number(r.anterior) || 0 })), 0.8);
  const setAnt = new Set(cAnt.entidades.map((e) => e.nombre));
  const setNow = new Set(cNow.entidades.map((e) => e.nombre));
  const entran = cNow.entidades.map((e) => e.nombre).filter((n) => !setAnt.has(n));
  const salen = cAnt.entidades.map((e) => e.nombre).filter((n) => !setNow.has(n));
  cambios.push({
    key: "8020",
    texto: entran.length || salen.length
      ? `El bloque 80/20 cambió: ${entran.length ? `entra${entran.length > 1 ? "n" : ""} ${entran.join(", ")}` : ""}${entran.length && salen.length ? " y " : ""}${salen.length ? `sale${salen.length > 1 ? "n" : ""} ${salen.join(", ")}` : ""} del grupo que concentra el 80% de la venta.`
      : `El bloque 80/20 se mantiene: ${cNow.cantidadEntidades} clientes concentran el ${cNow.totalCubiertoPct}% de la venta, igual que el año anterior.`,
    ask: "¿Quiénes son mis principales clientes por venta?",
  });

  return { vara, estados: { ventas, margen, contribucion, capital }, accion, cambios };
}
