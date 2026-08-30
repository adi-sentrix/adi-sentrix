/* === src/adi/agente/mapaDelDato.js · EL MAPA DE EXISTENCIA (ADI Agente · F2 · owner 2026-08-30) ===============
 *
 * QUÉ ES. La foto CHICA que viaja en el system del agente: qué ejes existen, qué entidades, qué métricas por
 * eje, qué períodos, y qué límites están declarados. Lo suficiente para ELEGIR herramientas sin adivinar — el
 * detalle lo trae la herramienta cuando hace falta. Reemplaza EN EL VIAJE a la proyección completa (~3.9K tok);
 * `datoProyectado` no se retira: sigue siendo la quinta fuente del muro y el insumo del suplente, client-side.
 *
 * LAS CUATRO LEYES DE ESTE MÓDULO (F1 §9, aceptadas por el owner):
 *   1 · FIEL EN LAS DOS DIRECCIONES: lo que declara existir existe en el pack, y lo que existe está declarado.
 *       Un mapa que drifea hace que el cerebro pida herramientas que no van a responder — o no pida las que sí.
 *   2 · LÍMITES SIN INVENTAR: sello de carga, presupuesto sin declarar, moneda/escala, huecos de la historia,
 *       serie por entidad bloqueada — se dicen SI el dato los tiene, y NUNCA al revés.
 *   3 · TOPE PROBADO: ≤ ~1.300 tokens (≈4.800 chars) medido en el gate sobre el demo Y sobre un pack con
 *       historia — con listas largas se TRUNCA declarando la cola («… y 487 más»), jamás en silencio.
 *   4 · DETERMINÍSTICO BYTE A BYTE: mismo pack + mismo escenario → el mismo texto exacto. El caché de prefijo
 *       del proveedor — y con él la tabla de costos del F1 — depende de esto. El ORDEN lo fija el mapa
 *       (venta oficial descendente · desempate alfabético), nunca el orden de inserción del dato.
 *
 * PURO · sin red · sin Date.now() · lee el tenant activo. */
import { getTenantData } from "../../data/tenantStore.js";
import { factorComercialDe } from "../../config/contract/figureType.js";
import { getSelloDeCarga } from "../../ingesta/estadoCarga.js";
import { rotuloMoneda, etiquetaSinDeclarar } from "../../config/moneda.js";
import { datasetCapability, serieRealDe, esSerieDelArchivo } from "../sentrix/capability.js";
import { alcanceDeHistoria, periodosDeHechos } from "../../ingesta/historico.js";

/** cuántos nombres se listan por eje antes de declarar la cola — el tope de tamaño manda sobre la lista */
const MAX_NOMBRES = 12;

const _cmp = (a, b) => (b.v - a.v) || String(a.n).localeCompare(String(b.n), "es");

/** los nombres de un eje, ORDENADOS por su venta oficial (desc) y con la cola declarada. */
function _nombres(filas, campoNombre, campoValor) {
  const orden = (filas || [])
    .map((f) => ({ n: f[campoNombre], v: Number(f[campoValor]) || 0 }))
    .filter((x) => x.n)
    .sort(_cmp)
    .map((x) => x.n);
  const unicos = [...new Set(orden)];
  if (!unicos.length) return null;
  if (unicos.length <= MAX_NOMBRES) return `${unicos.length}: ${unicos.join(", ")}`;
  return `${unicos.length}: ${unicos.slice(0, MAX_NOMBRES).join(", ")} … y ${unicos.length - MAX_NOMBRES} más (pídelos con gridTable)`;
}

/* mapaDelDato(scenario) → el texto del mapa. Determinístico: mismo tenant+escenario → mismos bytes. */
export function mapaDelDato(scenario = "actual") {
  const d = getTenantData() || {};
  const L = [];

  const moneda = rotuloMoneda(d);
  const escala = d.escalaComercial === "raw" ? "moneda cruda del archivo" : "miles";
  L.push(`MAPA DEL DATO — ${d.nombre || d.id || "negocio"} · escenario ${scenario} · moneda ${moneda || "sin declarar"} · montos comerciales en ${escala}.`);

  /* ── ejes y entidades · SOLO los que el pack trae ─────────────────────────────────────────────────────── */
  const ejes = [
    ["cliente", _nombres(d.clientesVentas, "nombre", "actual")],
    ["sku", _nombres(d.skusMargen, "nombre", "venta")],
    ["marca", _nombres(d.marcasMargen && d.marcasMargen.length ? d.marcasMargen : d.marcasVentas, "nombre", d.marcasMargen && d.marcasMargen.length ? "venta" : "actual")],
    ["familia", _nombres(d.sfamiliasMargen && d.sfamiliasMargen.length ? d.sfamiliasMargen : d.sfamiliasVentas, "nombre", d.sfamiliasMargen && d.sfamiliasMargen.length ? "venta" : "actual")],
    ["bodega", (() => {
      const b = [...new Set((d.skuInventario || []).map((r) => r.bodega).filter(Boolean))].sort((a, z) => String(a).localeCompare(String(z), "es"));
      return b.length ? `${b.length}: ${b.join(", ")}` : null;
    })()],
    ["canal", (() => {
      const c = [...new Set((d.clientesVentas || []).map((r) => r.canal).filter(Boolean))].sort((a, z) => String(a).localeCompare(String(z), "es"));
      return c.length ? `${c.length}: ${c.join(", ")}` : null;
    })()],
  ];
  L.push("EJES:");
  for (const [eje, txt] of ejes) if (txt) L.push(`- ${eje} (${txt})`);
  const sinEje = ejes.filter(([, txt]) => !txt).map(([e]) => e);
  if (sinEje.length) L.push(`- sin datos en: ${sinEje.join(", ")}`);

  /* ── métricas por eje · lo que de verdad se puede pedir ───────────────────────────────────────────────── */
  L.push("MÉTRICAS: cliente → ventas · margen · contribución · carga comercial" +
    ((d.skusMargen || []).length ? " | sku → venta · margen · contribución" : "") +
    ((d.skuInventario || []).length ? " | inventario → capital · rotación · días (por SKU y bodega)" : ""));

  /* ── períodos y series ────────────────────────────────────────────────────────────────────────────────── */
  const cap = datasetCapability();
  const global = (d.ventasMensuales || []).length;
  const hayArchivo = Object.values(d.historialMargen || {}).some((s) => esSerieDelArchivo(s));
  if (hayArchivo) {
    const conSerie = Object.keys(d.historialMargen || {}).filter((n) => serieRealDe(n).real).sort((a, z) => a.localeCompare(z, "es"));
    const pers = conSerie.length ? (d.historialMargen[conSerie[0]] || []).map((p) => p.periodo) : [];
    L.push(`SERIES: mensual por entidad REAL RECONCILIADA (${conSerie.length} entidades · ${pers.length} ${pers.length === 1 ? "mes" : "meses"}${pers.length ? `: ${pers[0]} a ${pers[pers.length - 1]}` : ""}) — herramienta serieEntidad.`);
  } else if (global) {
    L.push(`SERIES: mensual GLOBAL real (${global} meses — herramienta trend). Por entidad: BLOQUEADA (histórico de muestra, no reconcilia — se declina).`);
  } else {
    L.push("SERIES: sin serie mensual en este dato.");
  }

  /* ── la historia cargada, con sus huecos ──────────────────────────────────────────────────────────────── */
  if (d.hechos && (d.hechos.Ventas || []).length) {
    const alcance = alcanceDeHistoria(periodosDeHechos(d.hechos));
    L.push(`HISTORIA: ${alcance.texto}`);
  }

  /* ── límites declarados · los del dato, nunca inventados ──────────────────────────────────────────────── */
  const limites = [];
  const kv = d.ventasKPI || {};
  if (!(typeof kv.totalPresupuesto === "number" && Number.isFinite(kv.totalPresupuesto) && kv.totalPresupuesto !== 0)) limites.push(etiquetaSinDeclarar("presupuesto"));
  if (!(typeof kv.totalAnterior === "number" && Number.isFinite(kv.totalAnterior) && kv.totalAnterior !== 0)) limites.push("sin período anterior");
  if (!moneda) limites.push(etiquetaSinDeclarar("moneda"));
  if (!cap.crosses.atomic) limites.push("cruce cliente×SKU: solo afinidad modelada (indicado)");
  if (!Object.keys(d.SCENARIO_TRANSFORMS || {}).length) limites.push("sin escenarios de simulación declarados");
  const sello = getSelloDeCarga();
  if (sello && (sello.conAlarmas || (Array.isArray(sello.tipos) && sello.tipos.length))) {
    limites.push(`sello de carga vigente${Array.isArray(sello.tipos) && sello.tipos.length ? ` (${[...sello.tipos].sort().join(", ")})` : ""} — nómbralo cuando la respuesta use una lectura afectada`);
  }
  if (limites.length) L.push(`LÍMITES: ${limites.join(" · ")}.`);

  return L.join("\n");
}
