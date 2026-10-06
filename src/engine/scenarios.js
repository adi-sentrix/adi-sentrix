/* === scenarios.js ===
 * MOTOR PURO extraído de 41cc33d8 · misma entrada → misma salida · sin React.
 * Funciones copiadas verbatim; solo se agregan imports. Cero cambio de cálculo. */
import { benchmarkOf } from "../config/businessPolicy.js";   // la vara única: perfil del tenant → config, con el criterio C.2 encima
import { SCENARIO_TRANSFORMS } from "../config/scenarios.js";
import { margenKPI } from "../data/baseKpis.js";   // el margen del año anterior lo DECLARA el pack (ver deriveKpis)
import { clientesMargen, clientesVentas, marcasMargen, marcasVentas, sfamiliasMargen, sfamiliasVentas, skuInventario } from "../data/demoData.js";
import { kpiInventario } from "../adi/diagnosis/economicDiagnosis.js";   // R7 (owner 2026-09-28, §7.3·31-32): el indicador de inventario ya NO es un literal — lo calcula la fuente única

/* UNA SOLA REALIDAD (owner 2026-10-06, _ADI_DISENO_UNA_SOLA_REALIDAD.md): las TABLAS del tenant son la realidad
 * vigente —como una planilla real—; el «escenario» como fuente paralela de la verdad se retiró. Lo único que sobrevive
 * es la SIMULACIÓN EXPLÍCITA: un `override` (Simulate v2) que se aplica como DELTA sobre la fila real.
 *   · `growth` es un delta porcentual sobre la cifra REAL (`actual × (1+g)`, unidades al 70 % del ritmo); sin `growth` la
 *     fila real queda intacta (antes: `anterior × (1+growth)`, y sin growth daba NaN).
 *   · `rebateDelta` / `marginErosion` / `__remove__` / `__set__` ya eran deltas o filtros sobre la fila. */
export function applyScenarioToClientesVentas(scenarioId, override) {
  const t = resolveTransform(scenarioId, override)?.clientes;
  if (!t) return clientesVentas;
  // __remove__ · "perder cuenta" saca la entidad del universo (set tipo remover · filtrar ANTES del map)
  const _removed = new Set(Object.keys(t).filter(n => t[n] && t[n].__remove__));
  return clientesVentas.filter(c => !_removed.has(c.nombre)).map(c => {
    const tc = t[c.nombre];
    if (!tc) return c;
    // growth = DELTA sobre la venta REAL (la tabla): sin growth, la realidad queda intacta (0 NaN)
    const g            = (typeof tc.growth === "number" && Number.isFinite(tc.growth)) ? tc.growth : null;
    const newActual    = g == null ? c.actual : Math.round(c.actual * (1 + g / 100));
    // Unidades crecen al 70% del ritmo de ventas (mix de volumen + precio)
    const unidadesAnt  = c.unidadesAnt || Math.round(c.unidades * 0.95);
    const newUnidades  = g == null ? c.unidades : Math.round(c.unidades * (1 + (g / 100) * 0.7));
    return {
      ...c,
      actual:    newActual,
      unidades:  newUnidades,
      unidadesAnt,
      pctRebate: Math.round((c.pctRebate + (tc.rebateDelta || 0)) * 10) / 10,
      // anterior, presupuesto se preservan
    };
  }).sort((a,b) => b.actual - a.actual);
}

/* LOS EJES MARCA Y FAMILIA SON LAS TABLAS (owner 2026-10-06): se sirven tal cual están almacenadas, ORDENADAS (venta desc ·
 * contribución desc — el orden que la rama con transform imponía y que los consumidores —Cuadro, Pareto, tools— dan por
 * hecho: sin ordenar, una planilla real pintaba el Cuadro por marca en el orden de la TABLA). Antes, con el escenario
 * «bonanza», marca y familia se REARMABAN sumando clientes por su marca dominante (no es partición: Makita quedaba fuera,
 * Σ marcas $104,7M) — ese rearme era el resto de la fuente paralela y se retiró. La simulación (override) vive en el eje
 * cliente (applyScenarioToClientesVentas/Margen) y no reescribe estos ejes: son la realidad. */
export function applyScenarioToMarcasVentas(scenarioId) {
  return [...marcasVentas].sort((a,b) => b.actual - a.actual);
}

export function applyScenarioToMarcasMargen(scenarioId) {
  return [...marcasMargen].sort((a,b) => b.contribucion - a.contribucion);
}

export function applyScenarioToSfamiliasVentas(scenarioId) {
  return [...sfamiliasVentas].sort((a,b) => b.actual - a.actual);
}

export function applyScenarioToClientesMargen(scenarioId, override) {
  const t = resolveTransform(scenarioId, override)?.clientes;
  // clientesVentas es LA venta OFICIAL por cliente (owner 2026-07-29, D8: clientesMargen.venta es un segundo
  // número independiente para el MISMO cliente que nunca cuadra con el total del negocio — Σclientesventas.actual=
  // $100.0M vs Σclientesmargen.venta=$95.2M). Se reconcilia SIEMPRE por nombre, incluso en el escenario "actual"
  // (sin transform — el default de producción), donde antes `if (!t) return clientesMargen` dejaba pasar la venta
  // propia SIN TOCAR.
  // margen% se preserva tal cual clientesMargen lo declara (o + marginErosion si hay transform de escenario) — es
  // la eficiencia reportada, no depende de qué "base" de venta se use. contribución/costo SÍ se re-derivan de la
  // venta oficial × ese margen (MISMA fórmula que este archivo ya usaba para escenarios simulados, ahora aplicada
  // siempre, no solo con transform): probado en vivo que NO hacerlo rompe el P&L — con venta reconciliada pero
  // contribución sin tocar, los gastos (%×venta) suben mientras la contribución que los financia se queda fija,
  // apretando el resultado en ~1pp sin ninguna razón de negocio real (puro artefacto de la reconciliación a medias).
  const ventasScn   = applyScenarioToClientesVentas(scenarioId, override);
  const ventaByName = Object.fromEntries(ventasScn.map(v => [v.nombre, v.actual]));
  const _removed = t ? new Set(Object.keys(t).filter(n => t[n] && t[n].__remove__)) : new Set();

  return clientesMargen.filter(c => !_removed.has(c.nombre)).map(c => {
    const tc = t && t[c.nombre];
    const newMargen  = tc ? Math.max(6, +(c.margen + (tc.marginErosion || 0)).toFixed(1)) : c.margen;
    const newVenta   = ventaByName[c.nombre] ?? c.venta;
    const newContrib = Math.round(newVenta * (newMargen / 100));
    const newPctReb  = tc ? Math.round((c.pctRebate + (tc.rebateDelta || 0)) * 10) / 10 : c.pctRebate;
    // REBATES RE-DERIVADOS, igual que contribución y costo (owner 2026-08-07, defecto cazado en vivo: la tabla de
    // clientes mostraba Sodimac con 5.1% de acciones comerciales y el bloque de abajo con 5.4% — dos cifras del
    // MISMO concepto, y eso destruye la confianza en todo lo demás). La causa: `...c` dejaba pasar el `rebates`
    // original, calculado sobre la venta PROPIA de clientesMargen, mientras `venta` ya era la oficial de
    // clientesVentas. Así `rebates / venta` nunca daba el `pctRebate` declarado. Es la MISMA "reconciliación a
    // medias" que el comentario de arriba describe para la contribución, sobre otra línea. Ahora el % declarado
    // manda y el monto se recalcula sobre la venta oficial: `rebates / venta === pctRebate`, exacto, en toda fila.
    return {
      ...c,
      venta:        newVenta,
      costo:        newVenta - newContrib,
      contribucion: newContrib,
      margen:       newMargen,
      pctRebate:    newPctReb,
      rebates:      Math.round(newVenta * (newPctReb / 100)),
    };
  }).sort((a,b) => b.contribucion - a.contribucion);
}

export function applyScenarioToSfamiliasMargen(scenarioId) {
  return [...sfamiliasMargen].sort((a,b) => b.venta - a.venta);
}

/* El inventario es la foto REAL (la tabla): ya no hay mundos «tensión»/«crisis» que lo muevan. (Retirados con el escenario:
 * las ramas por nombre y `_seededRand`.) Una simulación de inventario (`simulateCapital`) opera sobre estas filas. */
export function applyScenarioToSkuInventario(scenarioId, override) {
  return skuInventario;
}

export function deriveKpis(scenarioId, override) {
  const ventas = applyScenarioToClientesVentas(scenarioId, override);
  const margenes = applyScenarioToClientesMargen(scenarioId, override);

  // VENTAS (puro · redondeo por cuenta ya viene de applyScenarioToClientesVentas)
  const totalActual = ventas.reduce((s, c) => s + (c.actual || 0), 0);
  const totalAnterior = ventas.reduce((s, c) => s + (c.anterior || 0), 0);
  const totalPresup = ventas.reduce((s, c) => s + (c.presupuesto || 0), 0);

  // MARGEN (puro · pct = contribución agregada / ventas agregadas)
  const totalUSD = margenes.reduce((s, c) => s + (c.contribucion || 0), 0);
  const pct = totalActual > 0 ? +((totalUSD / totalActual) * 100).toFixed(1) : 0;
  const benchmark = benchmarkOf(null);   // la vara: SIEMPRE por la puerta (benchmarkOf) — jamás un literal (ley de la vara única, 2026-09-03)

  /* pctAnt: el margen del AÑO ANTERIOR no es derivable de las filas (no hay costo anterior por cliente): lo DECLARA el pack
   * como `margenKPI.pctAnt` (la planilla lo mide en motorKpi; el demo lo declara) — ya no un literal de escenario. */
  const pctAnt = (margenKPI && margenKPI.pctAnt != null) ? margenKPI.pctAnt : null;
  const gapPuntos = pctAnt != null ? +(pct - pctAnt).toFixed(1) : null;   // gapPuntos = pct - pctAnt (NO vs benchmark)

  const vsAnterior = totalAnterior > 0 ? +(((totalActual / totalAnterior) - 1) * 100).toFixed(1) : null;
  const totalPresupuesto = totalPresup > 0 ? totalPresup : null;
  const vsPresupuesto = totalPresupuesto ? +(((totalActual / totalPresupuesto) - 1) * 100).toFixed(1) : null;

  /* INVENTARIO · CALCULADO, ya no PRESERVADO del literal (owner 2026-09-28, §7.3·31-32 y ·34; diseño §8.2/R7).
   * Hasta hoy esta línea devolvía `lit.inventario` tal cual el tenant lo escribía a mano — y esos literales ni
   * siquiera cerraban con sus propias filas en tensión/crisis (`applyScenarioToSkuInventario` nunca toca
   * `stockUSD`: diseño §0.4). Ahora es la MISMA fuente única que lee la ingesta (`motorKpi.js`) y la que leerá la
   * Entrega: `kpiInventario` sobre las filas YA transformadas por el escenario — cero segunda verdad, y la cifra
   * de inventario por fin cierra con las filas que la sostienen. */
  const inventario = kpiInventario(applyScenarioToSkuInventario(scenarioId, override));

  return {
    ventas: { totalActual, totalAnterior, totalPresupuesto, vsAnterior, vsPresupuesto },
    margen: { pct, pctAnt, totalUSD, gapPuntos, benchmark },
    inventario,
  };
}

export function mergeTransform(base, override) {
  if (!override) return base;
  // fusión por NATURALEZA del campo (firmado): DELTA suma sobre el base · SET/fijación reemplaza.
  const DELTA_FIELDS = { marginErosion: true, growth: true, rebateDelta: true };
  const merged = Object.assign({}, base);
  const baseClientes = (base && base.clientes) || {};
  const ovClientes = (override && override.clientes) || {};
  const mergedClientes = Object.assign({}, baseClientes);
  for (const acct of Object.keys(ovClientes)) {
    const baseAcct = baseClientes[acct] || {};
    const ovAcct = ovClientes[acct] || {};
    const newAcct = Object.assign({}, baseAcct);
    for (const field of Object.keys(ovAcct)) {
      if (field === "__set__") {
        // SET/FIJACIÓN absoluta · imposición que reemplaza (slot · B1a ejercita solo delta)
        Object.assign(newAcct, ovAcct.__set__);
      } else if (DELTA_FIELDS[field]) {
        newAcct[field] = (baseAcct[field] || 0) + ovAcct[field];   // DELTA · suma sobre el base
      } else {
        newAcct[field] = ovAcct[field];                            // campo no-delta · reemplaza
      }
    }
    mergedClientes[acct] = newAcct;
  }
  merged.clientes = mergedClientes;
  return merged;
}

export function resolveTransform(scenarioId, override) {
  const base = (typeof SCENARIO_TRANSFORMS !== "undefined") ? SCENARIO_TRANSFORMS[scenarioId] : undefined;
  if (!override) return base;                 // SIN simulación → el transform fijo intacto
  return mergeTransform(base, override);      // base + override (delta suma · set reemplaza)
}
