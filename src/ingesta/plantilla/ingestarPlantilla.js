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
import { HOJAS } from "../../config/contract/plantilla.js";   // para derivar QUÉ no trajo el archivo, contra el contrato

/* ingestarPlantilla(archivo, { nombreArchivo }) → { ok, dataset, preview } */
export function ingestarPlantilla(archivo, { nombreArchivo = "", fechaCarga = null } = {}) {
  const v = validarPlantilla(archivo, { nombreArchivo });
  const base = { archivo: nombreArchivo || "(sin nombre)", version: v.version, hojas: v.hojas, bloqueos: v.bloqueos, avisos: v.avisos };

  if (!v.ok) return { ok: false, dataset: null, preview: { ...base, parametros: {}, calculado: [], bloqueado: [], disponibilidad: null, totales: null, periodos: null } };

  const m = calcularDataset({ parametros: v.parametros, tablas: v.tablas, fechaCarga });
  const d = m.dataset;
  /* La procedencia de días y rotación, contada · es el concepto que pidió el owner («debe viajar con cada valor»)
   * y si no se ve en la preview, el usuario no sabe cuáles cifras son de su sistema y cuáles calculó ADI. */
  const inv = d.skuInventario || [];
  const cuenta = (campo, cual) => inv.filter((s) => s.procedencia && s.procedencia[campo] === cual).length;
  const procedencia = inv.length ? {
    total: inv.length,
    dias: { informado: cuenta("doh", "informado"), calculado: cuenta("doh", "calculado"), sinDato: cuenta("doh", "sin dato") },
    rotacion: { informado: cuenta("rotacion", "informado"), calculado: cuenta("rotacion", "calculado"), sinDato: cuenta("rotacion", "sin dato") },
    /* EL CAPITAL TAMBIÉN SE CUENTA (owner 2026-08-26): desde que la plantilla pide stock FÍSICO y no
     * valorizado, el capital es una cuenta de ADI y el usuario tiene derecho a ver cuántas filas pudo
     * valorizar y cuántas no. «sin dato» acá son los SKU con stock que no vendieron en el período. */
    capital: { informado: cuenta("capital", "informado"), calculado: cuenta("capital", "calculado"), sinDato: cuenta("capital", "sin dato") },
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
    /* DE QUIÉN ES LA VARA · condición del owner para la v1.6: «deja muy claro en preview y en respuestas que ADI
     * usa referencia general cuando el cliente no declara una propia. No quiero que la referencia general
     * parezca una meta del cliente». Viaja como dato, no como frase, para que la pantalla y el texto digan lo
     * mismo sin repetir la redacción. */
    referencia: d.margenKPI ? { valor: d.margenKPI.benchmark, procedencia: d.margenKPI.benchmarkProcedencia } : null,
    /* CAPTURADO PERO NO ANALIZADO (owner 2026-08-26): «que punto de venta quede declarado como dato disponible
     * para futuro, no como métrica activa». Se declara acá para que el usuario no crea que puede preguntarlo. */
    guardadoSinAnalizar: (() => {
      const filas = (v.tablas.Ventas || []).filter((f) => f.puntoVenta);
      return filas.length ? [{ campo: "punto de venta", filas: filas.length, distintos: new Set(filas.map((f) => f.puntoVenta)).size }] : [];
    })(),
  };

  /* ── LO QUE EL ARCHIVO NO TRAJO, VIAJANDO CON EL DATO (owner 2026-08-31, vía el criterio «límite corto CON
   * alternativa disponible») ──────────────────────────────────────────────────────────────────────────────
   * MEDIDO en el escenario de planilla PARCIAL: la ingesta SABE que «Ventas no trae "punto de venta"» y que no
   * vino la hoja Abonos, pero eso moría acá, en el preview. Sin esa memoria, ADI puede decir «no tengo el eje
   * canal» —la consecuencia— y nunca «tu archivo no trae esa columna: con ella te lo abro», que es la conducta
   * que el owner pidió para el dato incompleto.
   * ESTRICTAMENTE ADITIVO: una llave NUEVA, nadie cambia de forma ni de valor. Y su ausencia tiene que ser
   * inofensiva: los packs YA GUARDADOS en la base no la tienen, y un pack viejo debe comportarse exactamente
   * como hoy — ausencia de la llave NO significa «no faltaba nada», significa «no se registró». Quien la lea
   * trata `undefined` y `[]` distinto solo si puede probar la diferencia; el mapa, por eso, no dice nada
   * cuando no está. */
  /* LAS AUSENCIAS SE DERIVAN DEL CONTRATO, y eso es un HECHO, no una interpretación: el validador ya sabe qué
   * hojas vinieron y qué columnas trae cada una (`v.hojas[].columnas`), así que comparar contra `HOJAS` dice
   * exactamente qué falta y con qué nombre. Los avisos propios de la ingesta («clave más gruesa», «benchmark
   * sin declarar») se conservan igual: dicen otra cosa y ambos sirven. */
  const _porHoja = new Map((v.hojas || []).map((h) => [h.hoja, h]));
  const ausencias = [];
  for (const def of HOJAS) {
    const info = _porHoja.get(def.nombre);
    if (!info || !info.presente) { ausencias.push({ tipo: "hoja-ausente", hoja: def.nombre, detalle: `no vino la hoja «${def.nombre}»` }); continue; }
    /* ⚠️ LA HOJA VACÍA ES EL CASO NORMAL, NO EL RARO — y era el que se estaba perdiendo (2026-09-01).
     * La regla de arriba solo declara la hoja AUSENTE, y una hoja ausente casi no puede ocurrir: la plantilla
     * oficial se descarga CON las cuatro hojas dentro, así que quien no lleva cuenta corriente no borra la hoja
     * Abonos — la deja en blanco. Resultado medido con la planilla parcial del owner: el archivo entra, Abonos
     * no tiene una sola fila, y aun así el dato no registraba ningún faltante; a la pregunta «quién me debe»
     * ADI no tenía con qué nombrar la pieza y volvía a la disculpa que este trabajo vino a eliminar.
     * Para el usuario las dos situaciones son la MISMA —no hay dato de cobro— y merecen la misma frase. Otra
     * vez el patrón de siempre: se medía la FORMA (¿está la pestaña?) en vez del CONCEPTO (¿hay dato?). */
    if (!(v.tablas[def.nombre] || []).length) {
      ausencias.push({ tipo: "hoja-vacia", hoja: def.nombre, detalle: `la hoja «${def.nombre}» vino sin ninguna fila` });
      continue;
    }
    const traidas = new Set((info.columnas || []).map((c) => c.campo));
    for (const c of def.columnas) {
      if (c.obligatoria || traidas.has(c.campo)) continue;
      ausencias.push({ tipo: "columna-ausente", hoja: def.nombre, columna: c.titulo, detalle: `«${def.nombre}» no trae la columna "${c.titulo}"` });
    }
  }
  const avisosDeCarga = [
    ...ausencias,
    ...[...v.avisos, ...m.avisos].filter((a) => a && a.detalle)
      .map((a) => ({ tipo: a.tipo, detalle: String(a.detalle), ...(a.hoja ? { hoja: a.hoja } : {}) })),
  ];

  return {
    ok: true, dataset: { ...d, avisosDeCarga },
    /* LOS HECHOS DEL ARCHIVO, tal como los normalizó el validador (owner 2026-08-30: la carga es histórica).
     * Son el grano fino que la persistencia guarda DENTRO del pack para poder fusionar por período: sin las
     * filas, «agregar septiembre» solo podría sumar agregados — y un margen de dos cargas sumadas no es el
     * margen de nadie. El pack ya era autosuficiente por diseño; esto lo hace autosuficiente de verdad. */
    hechos: {
      parametros: v.parametros, fechaCarga: fechaCarga || null, inventarioDe: fechaCarga || null,
      Ventas: v.tablas.Ventas || [], Inventario: v.tablas.Inventario || [], Abonos: v.tablas.Abonos || [],
    },
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
    L.push(`  capital en stock:   ${q(t.procedencia.capital)}`);
    L.push(`  días de inventario: ${q(t.procedencia.dias)}`);
    L.push(`  rotación:           ${q(t.procedencia.rotacion)}`);
  }

  /* ⚠️ DE QUIÉN ES LA VARA · condición del owner para la v1.6: «no quiero que la referencia general parezca una
   * meta del cliente». Se dice acá, con todas las letras, y no en una nota al pie. */
  if (t.referencia && typeof t.referencia.valor === "number") {
    L.push(t.referencia.procedencia === "informado"
      ? `  margen de referencia: ${t.referencia.valor}% — el que declaró tu negocio`
      : `  margen de referencia: ${t.referencia.valor}% — REFERENCIA GENERAL DE ADI. Tu negocio no declaró una propia, así que no es tu meta: es la vara con la que ADI compara cuando no hay otra.`);
  }
  /* LO QUE SE GUARDA Y TODAVÍA NO SE ANALIZA. Decirlo evita la decepción de preguntar por algo que se llenó. */
  for (const g of t.guardadoSinAnalizar || []) {
    L.push(`  ${g.campo}: ${n(g.filas)} filas con ${n(g.distintos)} valores distintos — guardado, pero ADI todavía no analiza por ${g.campo}`);
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
