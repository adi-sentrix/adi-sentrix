/* === scripts/mundos-de-prueba.mjs · «OTROS MUNDOS» PARA LOS GATES, CONSTRUIDOS CON UN INSUMO EXPLÍCITO (owner 2026-10-06) ===
 * UNA SOLA REALIDAD: el motor ya no tiene escenarios (bonanza/tensión/crisis) — las TABLAS del tenant son la realidad y la
 * simulación es un `override` explícito. Varios gates usaban «tensión» y «crisis» para probar que una propiedad (la jerarquía de
 * inventario, la contención, el sello) se sostiene en un negocio DISTINTO al de fábrica. Esa necesidad sigue siendo legítima; lo que
 * se retiró es que el PRODUCTO llevara esos mundos. Acá viven como lo que son: filas de prueba que el gate le pasa al motor
 * (`jerarquiaInventario(inventarioTension(filas))`, o `initTenant({...TENANT_DEMO, skuInventario: …})`). NO es código de producto
 * (fuera de `src/`), nadie en `src/` lo importa (`_una_sola_realidad_gate` lo verifica). La aritmética es la que tenían las ramas
 * por nombre de `applyScenarioToSkuInventario`, byte a byte, para que las cifras de los gates sean las mismas de siempre. */

function seededRand(seedStr) {
  let h = 2166136261;
  for (let i = 0; i < seedStr.length; i++) { h ^= seedStr.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 100000) / 100000;
}

export function inventarioTension(filas) {
  return filas.map((sku) => {
    const r = seededRand("tension" + sku.sku);
    let estado = sku.estado, doh = sku.doh, alerta = sku.alerta;
    if (sku.estado === "Activo" && r < 0.30) { estado = "Lento"; doh = Math.round(sku.doh * 1.6); alerta = "warn"; }
    else if (sku.estado === "Lento") { doh = Math.round(sku.doh * 1.25); }
    return { ...sku, estado, doh, alerta };
  });
}

export function inventarioCrisis(filas) {
  return filas.map((sku) => {
    const r = seededRand("crisis" + sku.sku);
    let estado = sku.estado, doh = sku.doh, alerta = sku.alerta;
    if (sku.estado === "Activo" && r < 0.50) { estado = "Lento"; doh = Math.round(sku.doh * 2.0); alerta = "warn"; }
    else if (sku.estado === "Lento" && r < 0.40) { estado = "120d"; doh = Math.round(sku.doh * 2.5); alerta = "crit"; }
    else if (sku.estado === "60d" || sku.estado === "90d") { estado = "120d"; doh = Math.round(sku.doh * 1.4); alerta = "crit"; }
    return { ...sku, estado, doh, alerta };
  });
}
