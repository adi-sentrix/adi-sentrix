/* === scenarios.js ===
 * MOTOR PURO extraído de 41cc33d8 · misma entrada → misma salida · sin React.
 * Funciones copiadas verbatim; solo se agregan imports. Cero cambio de cálculo. */
import { FEATURE_FAMILY_MARGEN_BLENDED } from "../config/features.js";
import { SCENARIO_TRANSFORMS } from "../config/scenarios.js";
import { clientesMargen, clientesVentas, marcasVentas, sfamiliasMargen, sfamiliasVentas, skuInventario } from "../data/demoData.js";

export function applyScenarioToClientesVentas(scenarioId, override) {
  const t = resolveTransform(scenarioId, override)?.clientes;
  if (!t) return clientesVentas;
  // __remove__ · "perder cuenta" saca la entidad del universo (set tipo remover · filtrar ANTES del map)
  const _removed = new Set(Object.keys(t).filter(n => t[n] && t[n].__remove__));
  return clientesVentas.filter(c => !_removed.has(c.nombre)).map(c => {
    const tc = t[c.nombre];
    if (!tc) return c;
    // Crecimiento aplicado sobre el "anterior" (estado base independiente del escenario)
    const newActual    = Math.round(c.anterior * (1 + tc.growth / 100));
    // Unidades crecen al 70% del ritmo de ventas (mix de volumen + precio)
    const unidadesAnt  = c.unidadesAnt || Math.round(c.unidades * 0.95);
    const newUnidades  = Math.round(unidadesAnt * (1 + (tc.growth / 100) * 0.7));
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

export function applyScenarioToMarcasVentas(scenarioId) {
  if (!SCENARIO_TRANSFORMS[scenarioId]?.clientes) return marcasVentas;
  const clientes = applyScenarioToClientesVentas(scenarioId);
  const byMarca = {};
  clientes.forEach(c => {
    if (!byMarca[c.marca]) {
      byMarca[c.marca] = {
        nombre:c.marca, marca:c.marca, sfamilia:c.sfamilia, canal:c.canal,
        actual:0, anterior:0, unidades:0, unidadesAnt:0, presupuesto:0,
        pctRebate:0, _count:0,
      };
    }
    const g = byMarca[c.marca];
    g.actual      += c.actual;
    g.anterior    += c.anterior;
    g.unidades    += c.unidades;
    g.unidadesAnt += (c.unidadesAnt || c.unidades);
    g.presupuesto += (c.presupuesto || 0);
    g.pctRebate   += c.pctRebate;
    g._count++;
  });
  return Object.values(byMarca).map(g => ({
    ...g,
    pctRebate: Math.round((g.pctRebate / g._count) * 10) / 10,
  })).sort((a,b) => b.actual - a.actual);
}

export function applyScenarioToSfamiliasVentas(scenarioId) {
  if (!SCENARIO_TRANSFORMS[scenarioId]?.clientes) return sfamiliasVentas;
  const clientes = applyScenarioToClientesVentas(scenarioId);
  const bySfam = {};
  clientes.forEach(c => {
    if (!bySfam[c.sfamilia]) {
      bySfam[c.sfamilia] = {
        nombre:c.sfamilia, sfamilia:c.sfamilia, marca:c.marca, canal:c.canal,
        actual:0, anterior:0, unidades:0, unidadesAnt:0, presupuesto:0,
        pctRebate:0, _count:0,
      };
    }
    const g = bySfam[c.sfamilia];
    g.actual      += c.actual;
    g.anterior    += c.anterior;
    g.unidades    += c.unidades;
    g.unidadesAnt += (c.unidadesAnt || c.unidades);
    g.presupuesto += (c.presupuesto || 0);
    g.pctRebate   += c.pctRebate;
    g._count++;
  });
  return Object.values(bySfam).map(g => ({
    ...g,
    pctRebate: Math.round((g.pctRebate / g._count) * 10) / 10,
  })).sort((a,b) => b.actual - a.actual);
}

export function applyScenarioToClientesMargen(scenarioId, override) {
  const t = resolveTransform(scenarioId, override)?.clientes;
  if (!t) return clientesMargen;
  // Indexar ventas del escenario para lookup por nombre
  const ventasScn   = applyScenarioToClientesVentas(scenarioId, override);
  const ventaByName = Object.fromEntries(ventasScn.map(v => [v.nombre, v.actual]));
  // __remove__ · misma remoción que ventas (consistencia · no media-cuenta)
  const _removed = new Set(Object.keys(t).filter(n => t[n] && t[n].__remove__));

  return clientesMargen.filter(c => !_removed.has(c.nombre)).map(c => {
    const tc = t[c.nombre];
    if (!tc) return c;
    const newMargen = Math.max(6, +(c.margen + (tc.marginErosion || 0)).toFixed(1));
    const newVenta  = ventaByName[c.nombre] ?? c.venta;
    const newContrib= Math.round(newVenta * (newMargen / 100));
    return {
      ...c,
      venta:        newVenta,
      contribucion: newContrib,
      margen:       newMargen,
      pctRebate:    Math.round((c.pctRebate + (tc.rebateDelta || 0)) * 10) / 10,
    };
  }).sort((a,b) => b.contribucion - a.contribucion);
}

export function applyScenarioToSfamiliasMargen(scenarioId) {
  if (!SCENARIO_TRANSFORMS[scenarioId]?.clientes) return sfamiliasMargen;
  const cli = applyScenarioToClientesMargen(scenarioId);
  const by = {};
  cli.forEach(c => {
    if (!by[c.sfamilia]) {
      by[c.sfamilia] = {
        nombre:c.sfamilia, tipo:"sfamilia", marca:c.marca, sfamilia:c.sfamilia,
        venta:0, costo:0, rebates:0, contribucion:0, unidades:0,
        pctRebate:0, margen:0, costoMedio:0, precioLista:0, benchmark:30.1,
        _count:0,
      };
    }
    const g = by[c.sfamilia];
    g.venta        += c.venta;
    g.costo        += (c.costo || 0);
    g.rebates      += (c.rebates || 0);
    g.contribucion += c.contribucion;
    g.unidades     += c.unidades;
    g.pctRebate    += c.pctRebate;
    g.margen       += c.margen;
    g._count++;
  });
  return Object.values(by).map(g => ({
    ...g,
    pctRebate: Math.round((g.pctRebate / g._count) * 10) / 10,
    // MICRO-CORTE · margen blended real (contribución/venta) cuando el flag está ON.
    // contribucion y venta ya vienen sumadas (venta-ponderadas) en g; el margen viejo
    // promediaba sin ponderar (g.margen/_count) e inflaba → venta×margen≠contribución.
    // Rama OFF = expresión original byte-idéntica. _count y g.margen se preservan.
    margen: FEATURE_FAMILY_MARGEN_BLENDED
      ? (g.venta > 0 ? Math.round((g.contribucion / g.venta) * 1000) / 10 : 0)
      : Math.round((g.margen / g._count) * 10) / 10,
  })).sort((a,b) => b.venta - a.venta);
}

export function applyScenarioToSkuInventario(scenarioId, override) {
  if (!resolveTransform(scenarioId, override)) return skuInventario;
  if (scenarioId === "bonanza") return skuInventario;

  return skuInventario.map(sku => {
    const r = _seededRand(scenarioId + sku.sku);
    let nuevoEstado = sku.estado;
    let nuevaDoh    = sku.doh;
    let nuevaAlerta = sku.alerta;

    if (scenarioId === "tension") {
      if (sku.estado === "Activo" && r < 0.30) {
        nuevoEstado = "Lento";
        nuevaDoh    = Math.round(sku.doh * 1.6);
        nuevaAlerta = "warn";
      } else if (sku.estado === "Lento") {
        nuevaDoh = Math.round(sku.doh * 1.25);
      }
    } else if (scenarioId === "crisis") {
      if (sku.estado === "Activo" && r < 0.50) {
        nuevoEstado = "Lento";
        nuevaDoh    = Math.round(sku.doh * 2.0);
        nuevaAlerta = "warn";
      } else if (sku.estado === "Lento" && r < 0.40) {
        nuevoEstado = "120d";
        nuevaDoh    = Math.round(sku.doh * 2.5);
        nuevaAlerta = "crit";
      } else if (sku.estado === "60d" || sku.estado === "90d") {
        nuevoEstado = "120d";
        nuevaDoh    = Math.round(sku.doh * 1.4);
        nuevaAlerta = "crit";
      }
    }
    return { ...sku, estado:nuevoEstado, doh:nuevaDoh, alerta:nuevaAlerta };
  });
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
  const benchmark = 30.1;

  // pctAnt e inventario: PRESERVADOS del literal (no derivables del estado actual · v1)
  const lit = (typeof SCENARIO_TRANSFORMS !== "undefined" && SCENARIO_TRANSFORMS[scenarioId] && SCENARIO_TRANSFORMS[scenarioId].kpis) || {};
  const litMargen = lit.margen || {};
  const litVentas = lit.ventas || {};
  const pctAnt = litMargen.pctAnt != null ? litMargen.pctAnt : null;
  const gapPuntos = pctAnt != null ? +(pct - pctAnt).toFixed(1) : null;   // gapPuntos = pct - pctAnt (NO vs benchmark)

  const vsAnterior = totalAnterior > 0 ? +(((totalActual / totalAnterior) - 1) * 100).toFixed(1) : null;
  const totalPresupuesto = totalPresup > 0 ? totalPresup : (litVentas.totalPresupuesto != null ? litVentas.totalPresupuesto : null);
  const vsPresupuesto = totalPresupuesto ? +(((totalActual / totalPresupuesto) - 1) * 100).toFixed(1) : null;

  return {
    ventas: { totalActual, totalAnterior, totalPresupuesto, vsAnterior, vsPresupuesto },
    margen: { pct, pctAnt, totalUSD, gapPuntos, benchmark },
    inventario: lit.inventario || null,   // PRESERVADO del literal · v1 no recalcula inventario
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

export function _seededRand(seedStr) {
  let h = 2166136261;
  for (let i = 0; i < seedStr.length; i++) {
    h ^= seedStr.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // Convertir a [0,1)
  return ((h >>> 0) % 100000) / 100000;
}
