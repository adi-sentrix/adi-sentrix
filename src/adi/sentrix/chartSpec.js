/* === src/adi/sentrix/chartSpec.js · GRÁFICO EN LA RESPUESTA (owner 2026-07-09: "además de la respuesta y los
 * datos, que esté el gráfico — el cliente entiende que ADI hace lo que quiere") ===
 * DESPACHADOR DETERMINÍSTICO: lee la EVIDENCIA que la respuesta ya emite (una verdad — lo mismo que alimenta a
 * Sentrix) y elige la PLANTILLA de gráfico. El LLM no participa: el dato manda el gráfico, igual que las cifras.
 * null = respuesta sin gráfico (degrades, saludos, clarificaciones, follow-ups administrativos). Puro · gate-testable.
 * I1: pareto de contribución · evolutivo de ventas · barras de ranking/overview del contrato. (I2: margen vs piso,
 * perfil comparado, dos curvas por entidad, inventario con estados.) */

export function chartForEvidence(e) {
  if (!e || e.followup) return null;   // saludo/criteria/explain/meta → sin gráfico

  // 1 · CONTRIBUCIÓN · Pareto (quién sostiene la plata · corte 80/20 real)
  const cp = e.contribucion && e.contribucion.panel;
  if (cp && cp.kind === "pareto" && Array.isArray(cp.rows) && cp.rows.length >= 3)
    return { tipo: "pareto", titulo: cp.title || "Quién sostiene la contribución", panel: { totalPct: cp.totalPct, cutoff: cp.cutoff, of: cp.of, rows: cp.rows.slice(0, 10) } };

  // 2 · VENTAS · evolutivo global (12 meses reales · misma verdad que La Historia de Sentrix)
  if (e.lens === "ventas" && e.ventas)
    return { tipo: "evolutivo", titulo: "Venta · 12 meses vs año anterior" };

  // 3 · RANKING/OVERVIEW del contrato · barras horizontales (rows estructuradas con formato de una verdad)
  if (Array.isArray(e.rows) && e.rows.length >= 2 && e.metricLabel && e.rows.every((r) => r && typeof r.value === "number" && r.name))
    return { tipo: "barras", titulo: `${e.metricLabel} por ${e.dimLabel || e.dimension || ""}`.trim(), rows: e.rows.slice(0, 8), unit: e.unit || "money", polarity: e.polarity || "higherIsBetter" };

  return null;
}
