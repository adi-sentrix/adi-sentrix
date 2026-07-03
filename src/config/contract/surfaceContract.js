/* === config/contract/surfaceContract.js · CONTRATO DE DATOS · Paso 3 ===
 * QUÉ ES VISIBLE / COMPARABLE / BLOQUEADO. Declara la superficie honesta que hoy vive hardcodeada en el motor y el
 * panel (el guard SKU-margen del hardening, los cruces sin granularidad atómica del honesty-guard, el availability de
 * la boleta). Al declararlo acá, el resolver del LLM sabe QUÉ puede emitir SIN que ADI invente ni topе un dead-end.
 *
 * EXTENSIBILIDAD: un dominio nuevo declara su superficie acá (qué lentes lo muestran, qué está bloqueado y por qué) →
 * el LLM lo respeta sin tocar el motor.
 *
 * Convención de clave: "<metrica>@<eje>". `blockedWhen(scenario)` devuelve null (disponible) o {reason, offer[]}. */
export const SURFACE = {
  // ── comercial · disponible ──
  "ventas@cliente":      { lenses: ["diagnostico", "control", "cuadro"], comparable: true,  blockedWhen: () => null },
  "ventas@marca":        { lenses: ["cuadro"],                            comparable: false, blockedWhen: () => null },
  "ventas@familia":      { lenses: ["cuadro"],                            comparable: false, blockedWhen: () => null },
  "margen@cliente":      { lenses: ["diagnostico", "evidencia", "control", "cuadro"], comparable: true, blockedWhen: () => null },
  "contribucion@cliente":{ lenses: ["diagnostico", "control", "cuadro"], comparable: true,  blockedWhen: () => null },
  "carga@cliente":       { lenses: ["diagnostico", "evidencia", "control"], comparable: true, blockedWhen: () => null },

  // ── SKU/marca margen · base-only → BLOQUEO HONESTO fuera de bonanza (declara el guard del hardening) ──
  "margen@sku": {
    lenses: ["diagnostico", "control", "cuadro"], comparable: true,
    blockedWhen: (scn) => scn && scn !== "bonanza"
      ? { reason: "el margen por SKU se enciende con el ERP", offer: ["margen@cliente", "margen@familia"] } : null,
  },
  "margen@marca": {
    lenses: ["control", "cuadro"], comparable: true,
    blockedWhen: (scn) => scn && scn !== "bonanza"
      ? { reason: "el margen por marca no se ajusta por escenario en la demo", offer: ["margen@cliente", "margen@familia"] } : null,
  },

  // ── inventario · disponible (flags ADI_INV_* ON) ──
  "capital@bodega":   { lenses: ["diagnostico", "evidencia", "control", "cuadro"], comparable: true, blockedWhen: () => null },
  "capital@sku":      { lenses: ["cuadro"],  comparable: false, blockedWhen: () => null },
  "rotacion@sku":     { lenses: ["cuadro"],  comparable: false, blockedWhen: () => null },
  "rotacion@bodega":  { lenses: ["control", "cuadro"], comparable: true, blockedWhen: () => null },
  "doh@sku":          { lenses: ["cuadro"],  comparable: false, blockedWhen: () => null },
  "doh@bodega":       { lenses: ["control", "cuadro"], comparable: true, blockedWhen: () => null },
};

// ── CRUCES BLOQUEADOS · sin granularidad atómica en el dato (declara lo que el honesty-guard hace hoy) ──
// El resolver del LLM consulta esto para NO emitir un cruce imposible (y ADI ofrecer lo disponible en su lugar).
export const BLOCKED_CROSSES = [
  { cross: ["marca", "cliente"], reason: "no hay granularidad atómica marca×cliente en los datos", offer: ["margen@cliente", "margen@marca"] },
  { cross: ["cliente", "sku"],   reason: "no hay granularidad atómica cliente×SKU (qué SKU compra cada cliente)", offer: ["margen@cliente", "margen@sku"] },
];

// helper: ¿está disponible métrica@eje en este escenario? → null (ok) o {reason, offer}
export function surfaceBlock(metric, axis, scenario) {
  const s = SURFACE[`${metric}@${axis}`];
  if (!s) return { reason: `no está declarado ${metric} por ${axis}`, offer: [] };
  return s.blockedWhen(scenario);
}
