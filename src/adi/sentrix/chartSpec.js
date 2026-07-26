/* === src/adi/sentrix/chartSpec.js · GRÁFICO EN LA RESPUESTA (owner 2026-07-09: "además de la respuesta y los
 * datos, que esté el gráfico — el cliente entiende que ADI hace lo que quiere") ===
 * DESPACHADOR DETERMINÍSTICO: lee la EVIDENCIA que la respuesta ya emite (una verdad — lo mismo que alimenta a
 * Sentrix) y elige la PLANTILLA de gráfico. El LLM no participa: el dato manda el gráfico, igual que las cifras.
 * null = respuesta sin gráfico (degrades, saludos, clarificaciones, follow-ups administrativos). Puro · gate-testable.
 * I1: pareto de contribución · evolutivo de ventas · barras de ranking/overview del contrato. (I2: margen vs piso,
 * perfil comparado, dos curvas por entidad, inventario con estados.) */

export function chartForEvidence(e) {
  if (!e) return null;

  // 0 · TABLA COMPARADA universal (regla del owner 2026-07-25: dos columnas de números = tabla, siempre) —
  // la data viene ESTRUCTURADA del composer (una verdad, cero re-formateo). e.proyeccion = la venta proyectada
  // (Real hoy | Proyectado) · e.tabla = el portador genérico (hoy: el ANTES|AHORA de una edición del P&L).
  // Va ANTES del guard followup: la edición de una línea es administrativa (followup:true — NO pisa la
  // última lectura) y aun así su antes/después se muestra como tabla.
  const tc = e.tabla || e.proyeccion;
  if (tc && Array.isArray(tc.rows) && tc.rows.length)
    return { tipo: "tabla_comparada", titulo: tc.titulo || "Comparado", tabla: tc };

  // 0b · TABLA MATRIZ (mejora 7 · 2026-07-26): filas × N columnas (meses × entidades · mes a mes con año
  // anterior/presupuesto) — la data viene estructurada del composer temporal (misma serie del evolutivo).
  const tm = e.tablaM;
  if (tm && Array.isArray(tm.rows) && tm.rows.length && Array.isArray(tm.cols) && tm.cols.length)
    return { tipo: "tabla_matriz", titulo: tm.titulo || "Mes a mes", tabla: tm };

  if (e.followup) return null;   // saludo/criteria/explain/meta → sin gráfico

  // 1 · CONTRIBUCIÓN · Pareto (quién sostiene la plata · corte 80/20 real)
  const cp = e.contribucion && e.contribucion.panel;
  if (cp && cp.kind === "pareto" && Array.isArray(cp.rows) && cp.rows.length >= 3)
    return { tipo: "pareto", titulo: cp.title || "Quién sostiene la contribución", panel: { totalPct: cp.totalPct, cutoff: cp.cutoff, of: cp.of, rows: cp.rows.slice(0, 10) } };

  // 2 · VENTAS con panel de MOVERS (vs anterior/ppto · caída · precio realizado) → barras divergentes "quién mueve
  // la aguja" — responde LO PREGUNTADO por entidad (owner 2026-07-09: "ventas por cliente vs año anterior" mostraba
  // la película global). El evolutivo queda para la lectura global sin desglose.
  const vp = e.lens === "ventas" && e.ventas && e.ventas.panel;
  if (vp && vp.kind === "movers" && Array.isArray(vp.rows) && vp.rows.length >= 2)
    return { tipo: "movers", titulo: `${vp.title || "Quién mueve la aguja"}${vp.headline ? ` · ${vp.headline}` : ""}`, panel: { ...vp, rows: vp.rows.slice(0, 10) } };
  if (e.lens === "ventas" && e.ventas)
    return { tipo: "evolutivo", titulo: "Venta · 12 meses vs año anterior" };

  // 3 · COMPARE A vs B · métrica por métrica en dos columnas (evidence.pairs de una verdad — el MISMO patrón
  // tabla_comparada de la venta proyectada; antes el comparado quedaba sin gráfico). aFmt/bFmt vienen
  // formateados del contrato; "—" cuando un lado no tiene la métrica (honesto, jamás fabricar).
  const ca = e.compareA || e.entidad, cb = e.compareB || e.entityB;
  if (Array.isArray(e.pairs) && e.pairs.length >= 2 && ca && cb)
    return { tipo: "tabla_comparada", titulo: `${ca} vs. ${cb}`, tabla: { titulo: `${ca} vs. ${cb}`, cols: [ca, cb], rows: e.pairs.map((p) => ({ label: p.label, a: p.aFmt, b: p.bFmt })) } };

  // 4 · RANKING/OVERVIEW del contrato · barras horizontales (rows estructuradas con formato de una verdad)
  if (Array.isArray(e.rows) && e.rows.length >= 2 && e.metricLabel && e.rows.every((r) => r && typeof r.value === "number" && r.name))
    return { tipo: "barras", titulo: `${e.metricLabel} por ${e.dimLabel || e.dimension || ""}`.trim(), rows: e.rows.slice(0, 8), unit: e.unit || "money", polarity: e.polarity || "higherIsBetter" };

  return null;
}
