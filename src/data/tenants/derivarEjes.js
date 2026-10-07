/* === data/tenants/derivarEjes.js · LA DERIVACIÓN DE «UNA SOLA REALIDAD», COMO FUNCIONES PURAS (owner 2026-10-06/07) ================================
 * `_ADI_DISENO_UNA_SOLA_REALIDAD.md` §2/§2-bis · CLAUDE.md §4. La base de una empresa con dato de fábrica son DOS ÁTOMOS: cliente
 * (`clientesVentas`/`clientesMargen`, el universo OFICIAL, D8) y producto (`skusMargen`). TODO lo demás se DERIVA de ellos:
 *   · marca y familia = grupos de productos: Σ SKU en toda métrica aditiva; sus razones salen de las sumas (`derivarMarcasYFamilias`);
 *   · las unidades del año anterior por marca = el CRECIMIENTO declarado a la escala nueva × UN factor, mayor resto (`unidadesAntDeMarca`);
 *   · los KPI de cabecera = la suma de las filas del cliente (`derivarKPIs`);
 *   · donde cliente y SKU discrepan MANDA EL CLIENTE: el SKU se calibra con UN factor uniforme por métrica y redondeo de mayor resto
 *     (`calibrarSkus`), y la serie mensual se calibra columna a columna a los mismos totales (`calibrarMensual`).
 * Sin estado, sin red, sin azar: lo usan el tenant demo (`demo.js`) Y la empresa no-demo de la medición con anfitrión
 * (`scripts/medicion-anfitrion/empresa-no-demo.mjs`) — las dos obedecen la MISMA regla, por construcción, no por casualidad de redondeo.
 * Un número escrito a mano en un eje derivado, o un descuadre entre ejes comerciales, es un defecto. Candado: `_una_sola_realidad_gate`. */

const _r1 = (n) => Math.round(n * 10) / 10, _r2 = (n) => Math.round(n * 100) / 100;
const _suma = (filas, k) => filas.reduce((a, f) => a + (f[k] || 0), 0);

/** mayorResto(crudo, objetivo) → { f, out } · UN factor uniforme f = objetivo ÷ Σ crudo; cada valor × f, piso, y el resto entero repartido a los de mayor
 * fracción (desempate por posición): la suma de `out` es EXACTAMENTE `objetivo`. Σ crudo = 0 → todo cero (no hay base que escalar). */
export function mayorResto(crudo, objetivo) {
  const total = crudo.reduce((a, b) => a + b, 0);
  if (!(total > 0)) return { f: 0, out: crudo.map(() => 0) };
  const f = objetivo / total, escalado = crudo.map((c) => c * f), piso = escalado.map(Math.floor);
  const resto = objetivo - piso.reduce((a, b) => a + b, 0);
  escalado.map((c, i) => [c - piso[i], i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]).slice(0, resto).forEach(([, i]) => piso[i]++);
  return { f, out: piso };
}

/** Las dos cuentas del motor sobre la venta OFICIAL de una cuenta (`applyScenarioToClientesMargen`): contribución = venta × margen % · acciones = venta × carga %. */
export const contribucionOficial = (venta, margenPct) => Math.round(venta * (margenPct / 100));
export const accionesOficiales = (venta, pctRebate) => Math.round(venta * (pctRebate / 100));

/** objetivosDelCliente(clientesVentas, clientesMargen) → los totales que MANDAN (el universo cliente, D8): venta · contribución (venta oficial × margen por
 * cliente = `margenKPI.totalUSD`) · acciones comerciales (venta oficial × carga por cliente) · unidades · año anterior · presupuesto · unidades del año anterior. */
export function objetivosDelCliente(clientesVentas, clientesMargen) {
  const ventaOficial = Object.fromEntries(clientesVentas.map((c) => [c.nombre, c.actual]));
  return {
    venta: _suma(clientesVentas, "actual"), anterior: _suma(clientesVentas, "anterior"), presupuesto: _suma(clientesVentas, "presupuesto"),
    unidades: _suma(clientesVentas, "unidades"), unidadesAnt: _suma(clientesVentas, "unidadesAnt"),
    contribucion: clientesMargen.reduce((s, c) => s + contribucionOficial(ventaOficial[c.nombre] ?? c.venta, c.margen), 0),
    acciones: clientesMargen.reduce((s, c) => s + accionesOficiales(ventaOficial[c.nombre] ?? c.venta, c.pctRebate), 0),
  };
}

/** unidadesAntDeMarca({ skusMargen, objetivo, crecimiento }) → { [marca]: unidadesAnt } · Opción A (owner 2026-10-07): unidadesAnt = unidades(Σ SKU) × (unidadesAnt
 * declarada ÷ unidades declaradas) × UN factor f (≈ × 0,9986 en el demo) que lleva la suma a `objetivo` (Σ unidadesAnt del universo cliente), mayor resto. El par
 * declarado `crecimiento[marca] = { unidades, unidadesAnt }` es el ÚNICO insumo; el factor y los resultados se calculan. */
export function unidadesAntDeMarca({ skusMargen, objetivo, crecimiento }) {
  const nombres = Object.keys(crecimiento);
  const crudo = nombres.map((m) => skusMargen.filter((s) => s.marca === m).reduce((a, s) => a + s.unidades, 0) * crecimiento[m].unidadesAnt / crecimiento[m].unidades);
  const { out } = mayorResto(crudo, objetivo);
  return Object.fromEntries(nombres.map((m, i) => [m, out[i]]));
}

/** derivarMarcasYFamilias({ skusMargen, anteriorDeMarca, unidadesAntMarca }) → { marcasVentas, marcasMargen, sfamiliasVentas, sfamiliasMargen } · marca y familia = grupos
 * de SKU: Σ venta, costo, rebates, contribución y unidades; margen = contribución ÷ venta y pctRebate = rebates ÷ venta (1 decimal, como `motorKpi.bloqueMargen`); costoMedio =
 * costo ÷ unidades y precioLista = venta ÷ unidades (2 decimales). Lo único DECLARADO por marca es el año anterior (`anteriorDeMarca[marca].anterior`) y sus unidades
 * (`unidadesAntMarca[marca]`); la familia suma las de sus marcas. */
export function derivarMarcasYFamilias({ skusMargen, anteriorDeMarca, unidadesAntMarca }) {
  const agrupar = (campo) => {
    const grupos = new Map();
    for (const s of skusMargen) { if (!grupos.has(s[campo])) grupos.set(s[campo], []); grupos.get(s[campo]).push(s); }
    return [...grupos.entries()].map(([nombre, filas]) => {
      const suma = (k) => filas.reduce((a, f) => a + f[k], 0);
      const venta = suma("venta"), costo = suma("costo"), rebates = suma("rebates"), contribucion = suma("contribucion"), unidades = suma("unidades");
      const marcas = [...new Set(filas.map((f) => f.marca))];
      const ant = marcas.reduce((a, m) => ({ anterior: a.anterior + anteriorDeMarca[m].anterior, unidadesAnt: a.unidadesAnt + unidadesAntMarca[m] }), { anterior: 0, unidadesAnt: 0 });
      const dominante = filas.reduce((m, f) => { m[f.marca] = (m[f.marca] || 0) + f.venta; return m; }, {});
      return { nombre, filas, venta, costo, rebates, contribucion, unidades, ...ant, marca: Object.entries(dominante).sort((a, b) => b[1] - a[1])[0][0], sfamilia: filas[0].sfamilia,
        pctRebate: _r1(rebates / venta * 100), margen: _r1(contribucion / venta * 100), costoMedio: _r2(costo / unidades), precioLista: _r2(venta / unidades) };
    });
  };
  const margenDe = (g, tipo) => g.map((x) => ({ nombre: x.nombre, tipo, marca: tipo === "marca" ? x.nombre : x.marca, sfamilia: tipo === "marca" ? x.sfamilia : x.nombre, venta: x.venta, costo: x.costo, rebates: x.rebates, contribucion: x.contribucion, pctRebate: x.pctRebate, margen: x.margen, costoMedio: x.costoMedio, precioLista: x.precioLista, unidades: x.unidades, benchmark: x.filas[0].benchmark }));
  const ventasDe = (g, tipo) => [...g].sort((a, b) => b.venta - a.venta).map((x) => ({ nombre: x.nombre, sfamilia: tipo === "marca" ? x.sfamilia : x.nombre, marca: tipo === "marca" ? x.nombre : x.marca, actual: x.venta, anterior: x.anterior, unidades: x.unidades, unidadesAnt: x.unidadesAnt, pctRebate: x.pctRebate }));
  const marcas = agrupar("marca"), familias = agrupar("sfamilia");
  return { marcasVentas: ventasDe(marcas, "marca"), marcasMargen: margenDe(marcas, "marca"), sfamiliasVentas: ventasDe(familias, "sfamilia"), sfamiliasMargen: margenDe(familias, "sfamilia") };
}

/** derivarKPIs({ clientesVentas, clientesMargen, margenAnterior }) → { ventasKPI, margenKPI } · la cabecera es la SUMA de las filas del cliente (venta oficial D8): venta, año
 * anterior, presupuesto y unidades; contribución = venta oficial × margen por cliente. Lo único que no se deriva es el margen del AÑO ANTERIOR (`margenAnterior`, declarado). */
export function derivarKPIs({ clientesVentas, clientesMargen, margenAnterior }) {
  const o = objetivosDelCliente(clientesVentas, clientesMargen);
  const ventasKPI = {
    totalActual: o.venta, totalAnterior: o.anterior, totalPresupuesto: o.presupuesto,
    vsAnterior: _r1((o.venta / o.anterior - 1) * 100), vsPresupuesto: _r1((o.venta / o.presupuesto - 1) * 100),
    unidades: o.unidades, ticketProm: _r1(o.venta / o.unidades),
  };
  const pct = _r1(o.contribucion / o.venta * 100);
  const margenKPI = { pct, pctAnt: margenAnterior, totalUSD: o.contribucion, gapPuntos: _r1(pct - margenAnterior) };
  return { ventasKPI, margenKPI };
}

/** calibrarSkus(skusMargen, objetivos) → los SKU con venta · contribución · acciones (rebates) · unidades calibradas al universo cliente: UN factor uniforme por métrica,
 * idéntico para todos los SKU (ninguna marca ni SKU se elige a mano), redondeo de mayor resto para que cada suma sea EXACTA. costo = venta − rebates − contribución · margen =
 * contribución ÷ venta · pctRebate = rebates ÷ venta · costoMedio = costo ÷ unidades · precioLista = venta ÷ unidades (las definiciones de siempre); benchmark no se toca.
 * `objetivos` = { venta, contribucion, acciones, unidades } (ver `objetivosDelCliente`). Aplicada a una tabla ya calibrada con sus propios totales es la IDENTIDAD. */
export function calibrarSkus(skusMargen, objetivos) {
  const col = { venta: "venta", contribucion: "contribucion", rebates: "acciones", unidades: "unidades" };
  const out = {};
  for (const k of Object.keys(col)) out[k] = mayorResto(skusMargen.map((s) => s[k]), objetivos[col[k]]).out;
  return skusMargen.map((s, i) => {
    const venta = out.venta[i], contribucion = out.contribucion[i], rebates = out.rebates[i], unidades = out.unidades[i], costo = venta - rebates - contribucion;
    return { ...s, venta, costo, rebates, contribucion, pctRebate: _r1(rebates / venta * 100), margen: _r1(contribucion / venta * 100), costoMedio: _r2(costo / unidades), precioLista: _r2(venta / unidades), unidades };
  });
}

/** calibrarMensual(ventasMensuales, objetivos) → la serie mensual con cada columna llevada a su total del universo cliente (UN factor por columna, mayor resto): venta,
 * año anterior, presupuesto, unidades, acciones y costo (= venta − acciones − contribución: Σ cierra con la contribución del cliente). Conserva la forma del año (la
 * proporción de cada mes) y el orden de las claves. */
export function calibrarMensual(ventasMensuales, objetivos) {
  const destino = { actual: objetivos.venta, anterior: objetivos.anterior, presupuesto: objetivos.presupuesto, unidades: objetivos.unidades, acciones: objetivos.acciones, costo: objetivos.venta - objetivos.acciones - objetivos.contribucion };
  const cols = {};
  for (const k of Object.keys(destino)) cols[k] = mayorResto(ventasMensuales.map((m) => m[k]), destino[k]).out;
  return ventasMensuales.map((m, i) => { const fila = { ...m }; for (const k of Object.keys(destino)) fila[k] = cols[k][i]; return fila; });
}
