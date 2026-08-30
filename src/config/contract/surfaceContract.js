/* === config/contract/surfaceContract.js · CONTRATO DE DATOS · Paso 3 ===
 * QUÉ ES VISIBLE / COMPARABLE / BLOQUEADO. Declara la superficie honesta que hoy vive hardcodeada en el motor y el
 * panel (el guard SKU-margen del hardening, los cruces sin granularidad atómica del honesty-guard, el availability de
 * la boleta). Al declararlo acá, el resolver del LLM sabe QUÉ puede emitir SIN que ADI invente ni topе un dead-end.
 *
 * EXTENSIBILIDAD: un dominio nuevo declara su superficie acá (qué lentes lo muestran, qué está bloqueado y por qué) →
 * el LLM lo respeta sin tocar el motor.
 *
 * Convención de clave: "<metrica>@<eje>". Un par declarado está disponible; el que no está declarado se responde
 * honesto («no inventariado»). El campo `blockedWhen(scenario)` se retiró con el colapso del eje (2026-08-30). */
export const SURFACE = {
  // ── comercial · disponible ──
  "ventas@cliente":      { lenses: ["diagnostico", "control", "cuadro"], comparable: true },
  "ventas@marca":        { lenses: ["cuadro"],                            comparable: false },
  "ventas@familia":      { lenses: ["cuadro"],                            comparable: false },
  "margen@cliente":      { lenses: ["diagnostico", "evidencia", "control", "cuadro"], comparable: true },
  "contribucion@cliente":{ lenses: ["diagnostico", "control", "cuadro"], comparable: true },
  "carga@cliente":       { lenses: ["diagnostico", "evidencia", "control"], comparable: true },

  // ⚠️ ACÁ VIVÍA `blockedWhen(scenario)` — el campo que bloqueaba margen@sku/margen@marca «fuera de bonanza».
  // SE RETIRÓ CON EL COLAPSO DEL EJE (owner 2026-08-07, ejecutado 2026-08-30): la base real es constante y ese
  // «fuera» no existe — en vivo ambos callers ya pasaban "bonanza" y el campo devolvía null SIEMPRE. La
  // superficie declara qué existe (lenses/comparable); la disponibilidad condicional por escenario era el
  // concepto muerto en forma de contrato. Candado: _colapso_eje_gate.
  "margen@sku":   { lenses: ["diagnostico", "control", "cuadro"], comparable: true },
  "margen@marca": { lenses: ["control", "cuadro"], comparable: true },

  // ── inventario · disponible (flags ADI_INV_* ON) ──
  "capital@bodega":   { lenses: ["diagnostico", "evidencia", "control", "cuadro"], comparable: true },
  "capital@sku":      { lenses: ["cuadro"],  comparable: false },
  "rotacion@sku":     { lenses: ["cuadro"],  comparable: false },
  "rotacion@bodega":  { lenses: ["control", "cuadro"], comparable: true },
  "doh@sku":          { lenses: ["cuadro"],  comparable: false },
  "doh@bodega":       { lenses: ["control", "cuadro"], comparable: true },
};

// ── CRUCES BLOQUEADOS · sin granularidad atómica en el dato (declara lo que el honesty-guard hace hoy) ──
// El resolver del LLM consulta esto para NO emitir un cruce imposible (y ADI ofrecer lo disponible en su lugar).
export const BLOCKED_CROSSES = [
  { cross: ["marca", "cliente"], reason: "no hay granularidad atómica marca×cliente en los datos", offer: ["margen@cliente", "margen@marca"] },
  { cross: ["cliente", "sku"],   reason: "no hay granularidad atómica cliente×SKU (qué SKU compra cada cliente)", offer: ["margen@cliente", "margen@sku"] },
];

// helper: ¿está disponible métrica@eje? → null (ok) o {reason, offer}. El parámetro de escenario se retiró con
// el colapso del eje: la disponibilidad es del CONTRATO (qué pares existen), no de un lente de simulación.
export function surfaceBlock(metric, axis) {
  const s = SURFACE[`${metric}@${axis}`];
  if (!s) return { reason: `no está declarado ${metric} por ${axis}`, offer: [] };
  return null;
}
