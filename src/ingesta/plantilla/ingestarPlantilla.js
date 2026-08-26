/* === ingesta/plantilla/ingestarPlantilla.js · EL RECORRIDO Y LA PREVIEW HUMANA (v0 · 2026-08-22) ==============
 *
 * validar → calcular → decir qué quedó disponible. Tres pasos y ninguna sorpresa en el medio.
 *
 * La preview responde las cinco preguntas que pidió el owner, y una de ellas es nueva respecto de la versión
 * anterior: **qué KPI puede calcular**, con la CITA de qué regla lo autoriza y qué medición lo respalda. Esa
 * columna de citas es la que convierte «no inventamos fórmulas» en algo que se audita renglón por renglón en vez
 * de creerse. Y su contracara —lo bloqueado— dice qué haría falta para abrirlo, que es la única forma de que un
 * «no se puede» sea información y no un portazo.
 */
import { validarPlantilla } from "./validarPlantilla.js";
import { calcularDataset } from "./motorKpi.js";
import { disponibilidadSentrix } from "../disponibilidad.js";

/* ingestarPlantilla(archivo, { nombreArchivo }) → { ok, dataset, preview } */
export function ingestarPlantilla(archivo, { nombreArchivo = "" } = {}) {
  const v = validarPlantilla(archivo, { nombreArchivo });
  const base = { archivo: nombreArchivo || "(sin nombre)", version: v.version, hojas: v.hojas, bloqueos: v.bloqueos, avisos: v.avisos };

  if (!v.ok) return { ok: false, dataset: null, preview: { ...base, parametros: {}, calculado: [], bloqueado: [], disponibilidad: null, totales: null, periodos: null } };

  const m = calcularDataset({ parametros: v.parametros, tablas: v.tablas });
  const d = m.dataset;
  /* La procedencia de días y rotación, contada · es el concepto que pidió el owner («debe viajar con cada valor»)
   * y si no se ve en la preview, el usuario no sabe cuáles cifras son de su sistema y cuáles calculó ADI. */
  const inv = d.skuInventario || [];
  const cuenta = (campo, cual) => inv.filter((s) => s.procedencia && s.procedencia[campo] === cual).length;
  const procedencia = inv.length ? {
    total: inv.length,
    dias: { informado: cuenta("doh", "informado"), calculado: cuenta("doh", "calculado"), sinDato: cuenta("doh", "sin dato") },
    rotacion: { informado: cuenta("rotacion", "informado"), calculado: cuenta("rotacion", "calculado"), sinDato: cuenta("rotacion", "sin dato") },
  } : null;

  const totales = {
    clientes: d.clientesVentas.length, skus: d.skusMargen.length, marcas: d.MARCAS_ALL.length,
    familias: Math.max(0, d.SUPERFAMILIAS.length - 1), bodegas: d.SUCURSALES.length,
    filasVenta: (v.tablas.Ventas || []).length, filasInventario: inv.length,
    venta: d.ventasKPI ? d.ventasKPI.totalActual : null,
    capital: d.invKPI ? d.invKPI.totalUSD : null,
    inmovilizado: d.invKPI ? d.invKPI.inmovilizadoUSD : null,
    inmovilizadoPct: d.invKPI ? d.invKPI.inmovilizadoPct : null,
    procedencia,
  };

  return {
    ok: true, dataset: d,
    preview: { ...base, parametros: v.parametros, calculado: m.calculado, bloqueado: m.bloqueado,
      avisos: [...v.avisos, ...m.avisos], periodos: m.periodos, totales,
      disponibilidad: disponibilidadSentrix(d) },
  };
}

/** La preview en texto · las cinco secciones que pidió el owner, en ese orden. */
export function previewPlantillaEnTexto(p) {
  const L = [];
  const n = (x) => (typeof x === "number" ? x.toLocaleString("es-CL") : "—");
  const sec = (t) => { L.push("", t, "─".repeat(Math.min(98, t.length))); };

  L.push(`ARCHIVO: ${p.archivo}${p.version ? `  ·  plantilla ${p.version}` : ""}`);

  /* 1 · qué datos recibió ───────────────────────────────────────────────────────────────────────────────── */
  sec("1 · QUÉ DATOS RECIBIÓ");
  for (const h of p.hojas) {
    if (!h.presente) { L.push(`  ${h.hoja.padEnd(14)} — no vino${h.obligatoria ? " (OBLIGATORIA)" : " (opcional)"}`); continue; }
    L.push(`  ${h.hoja.padEnd(14)} ${String(h.filas).padStart(5)} filas · ${(h.columnas || []).length} columnas reconocidas`);
    for (const c of h.prohibidas || []) L.push(`      ✗ columna no permitida: "${c}"`);
    for (const a of h.ambiguas || []) L.push(`      ✗ unidad ambigua: vino "${a.vino}", la plantilla dice "${a.esperado}"`);
  }
  if (p.periodos && p.periodos.todos && p.periodos.todos.length) {
    L.push(`  períodos con ventas: ${p.periodos.todos.join(" · ")}   →  se informa ${p.periodos.actual}${p.periodos.anterior ? ` y se compara contra ${p.periodos.anterior}` : " (sin período anterior)"}`);
  }
  if (Object.keys(p.parametros || {}).length) {
    L.push("  parámetros declarados por el negocio:");
    for (const [k, val] of Object.entries(p.parametros)) L.push(`      ${k} = ${val}`);
  }

  /* 2 · errores que bloquean ────────────────────────────────────────────────────────────────────────────── */
  if (p.bloqueos.length) {
    sec(`2 · EL ARCHIVO NO SE CARGÓ · ${p.bloqueos.length} ${p.bloqueos.length === 1 ? "problema" : "problemas"}`);
    for (const b of p.bloqueos) L.push(`  ✗ ${b.detalle}`);
    L.push("", "  Corregí eso en la plantilla y volvé a subirla. No se cargó ninguna fila.");
    return L.join("\n");
  }

  const t = p.totales;
  sec("LO QUE ENTRÓ");
  L.push(`  ${n(t.filasVenta)} filas de venta → ${n(t.clientes)} cuentas · ${n(t.skus)} SKU · ${n(t.marcas)} marcas · ${n(t.familias)} familias · ${n(t.bodegas)} bodegas`);
  if (t.venta !== null) L.push(`  venta del período: ${n(t.venta)}`);
  if (t.capital !== null) L.push(`  capital en stock: ${n(t.capital)}  (${n(t.filasInventario)} filas de inventario)`);

  /* Informado manda, calculado rellena · el usuario tiene que poder ver CUÁLES cifras son de su sistema y cuáles
   * puso ADI. Si no se dice, un número calculado se lee como si viniera del ERP, y ahí empieza la desconfianza. */
  if (t.procedencia) {
    const q = (x) => [x.informado ? `${x.informado} informado${x.informado === 1 ? "" : "s"}` : null,
                      x.calculado ? `${x.calculado} calculado${x.calculado === 1 ? "" : "s"} por ADI` : null,
                      x.sinDato ? `${x.sinDato} sin dato` : null].filter(Boolean).join(" · ") || "—";
    L.push(`  días de inventario: ${q(t.procedencia.dias)}`);
    L.push(`  rotación:           ${q(t.procedencia.rotacion)}`);
  }

  /* 3 · qué KPIs puede calcular ─────────────────────────────────────────────────────────────────────────── */
  sec("2 · QUÉ CALCULA ADI CON ESTO (y con qué autorización)");
  for (const c of p.calculado) {
    L.push(`  ✓ ${c.que}`);
    L.push(`      ${c.formula}`);
    L.push(`      autoriza: ${c.fuente}${c.medido ? `\n      comprobado: ${c.medido}` : ""}`);
  }

  /* 4 · qué NO puede calcular ───────────────────────────────────────────────────────────────────────────── */
  sec("3 · QUÉ NO CALCULA, Y QUÉ HARÍA FALTA");
  for (const b of p.bloqueado) {
    L.push(`  ✗ ${b.que}`);
    L.push(`      por qué: ${b.porque}`);
    L.push(`      para abrirlo: ${b.paraAbrirlo}`);
  }

  /* 5 · qué partes de Sentrix quedan disponibles ────────────────────────────────────────────────────────── */
  const d = p.disponibilidad;
  if (d) {
    sec(`4 · QUÉ PARTES DE SENTRIX QUEDAN DISPONIBLES  (${d.resumen.carasDisponibles} de ${d.resumen.carasTotales} caras · ${d.resumen.metricasDisponibles} de ${d.resumen.metricasTotales} métricas)`);
    for (const c of d.caras) {
      const marca = c.completa ? "✓ COMPLETA " : c.disponible ? "◐ PARCIAL  " : "✗ NO ABRE  ";
      L.push(`  ${marca} ${c.cara.padEnd(10)} ${c.que}`);
      if (!c.completa) L.push(`               falta: ${c.falta.join(" · ")}`);
    }
  }

  /* Los avisos se agrupan por tipo. Uno por SKU es correcto en el dataset y una catástrofe en pantalla: con
   * 5.000 SKU, un aviso legítimo repetido 5.000 veces sepulta a los otros cuatro que había que leer. Se muestran
   * dos y se dice cuántos más hay del mismo tipo — la lista completa sigue entera en p.avisos para quien la use. */
  if (p.avisos.length) {
    sec("5 · AVISOS (no impiden cargar, pero conviene saberlos)");
    const porTipo = new Map();
    for (const a of p.avisos) { if (!porTipo.has(a.tipo)) porTipo.set(a.tipo, []); porTipo.get(a.tipo).push(a); }
    for (const grupo of porTipo.values()) {
      for (const a of grupo.slice(0, 2)) L.push(`  · ${a.detalle}`);
      if (grupo.length > 2) L.push(`    …y ${grupo.length - 2} más del mismo tipo`);
    }
  }
  return L.join("\n");
}
