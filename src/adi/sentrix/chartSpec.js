/* === src/adi/sentrix/chartSpec.js · GRÁFICO EN LA RESPUESTA (owner 2026-07-09: "además de la respuesta y los
 * datos, que esté el gráfico — el cliente entiende que ADI hace lo que quiere") ===
 * DESPACHADOR DETERMINÍSTICO: lee la EVIDENCIA que la respuesta ya emite (una verdad — lo mismo que alimenta a
 * Sentrix) y elige la PLANTILLA de gráfico. El LLM no participa: el dato manda el gráfico, igual que las cifras.
 * null = respuesta sin gráfico (degrades, saludos, clarificaciones, follow-ups administrativos). Puro · gate-testable.
 * I1: pareto de contribución · evolutivo de ventas · barras de ranking/overview del contrato. (I2: margen vs piso,
 * perfil comparado, dos curvas por entidad, inventario con estados.) */
import { fieldLabel, TEXT_LABELS } from "../oracle/entityRecord.js";

const _HEAD_POR_DIM = { cliente: "Cliente", sku: "SKU", marca: "Marca", familia: "Familia" };

// _gridRowsToTabla(e) → {titulo, head, cols, rows, nota} | null · transforma gridTable's facts.rows (dinámicas por
// columna, ver entityRecord.js buildGrid: {entidad, "Ventas":"$19.4M", "Margen":"22.0%", …}) a la forma YA
// soportada por MiniTablaMatriz — cero componente UI nuevo, solo el adaptador de forma (requisito 5).
function _gridRowsToTabla(e) {
  const rows = e && e.rows;
  if (!e.dimension || !Array.isArray(rows) || rows.length < 2 || !rows[0] || typeof rows[0] !== "object" || !("entidad" in rows[0])) return null;
  const metaKeys = new Set(["entidad", "entityType"]);
  const perRow = rows.map((r) => Object.keys(r).filter((k) => !metaKeys.has(k) && !TEXT_LABELS.has(k)));   // solo NUMÉRICAS — nunca Nombre/Tipo/Marca/Familia/Canal
  let cols = perRow[0].filter((k) => perRow.every((ks) => ks.includes(k)));   // presentes en TODAS las filas (sin huecos)
  if (!cols.length) return null;
  // gridTable trae TODAS las columnas por diseño (el LLM elegía cuáles narrar) — acá, SIN narrador, se recorta a
  // lo esencial para que la tabla siga siendo legible en el chat: el campo por el que se ordenó primero, tope 5.
  const sortLabel = e.sortBy ? fieldLabel(e.sortBy) : null;
  if (sortLabel && cols.includes(sortLabel)) cols = [sortLabel, ...cols.filter((c) => c !== sortLabel)];
  cols = cols.slice(0, 5);
  const notaPartes = [];
  if (e.totalCount != null && e.count != null && e.totalCount > e.count) notaPartes.push(`mostrando ${e.count} de ${e.totalCount}`);
  if (e.resto && e.resto.sumaFmt) notaPartes.push(`el resto (${e.resto.count}) suma ${e.resto.sumaFmt} en ${e.resto.campo}`);
  return {
    titulo: `${_HEAD_POR_DIM[e.dimension] || "Entidad"} · grilla`,
    head: _HEAD_POR_DIM[e.dimension] || "Entidad",
    cols,
    rows: rows.map((r) => ({ label: r.entidad, values: cols.map((k) => r[k]) })),
    ...(notaPartes.length ? { nota: notaPartes.join(" · ") } : {}),
  };
}

// _tensionToTabla(e) → {titulo, head, cols, rows, nota} | null · transforma tensionRead's facts.topA/topB (dos
// rankings cruzados, ver entityRecord.js buildTension) a la MISMA forma tabla — dos columnas, una por métrica,
// "—" honesto donde una entidad no aparece en ese ranking (requisito 5).
function _tensionToTabla(e) {
  if (!Array.isArray(e.topA) || !Array.isArray(e.topB) || !e.metricA || !e.metricB || (e.topA.length + e.topB.length) < 2) return null;
  const mapA = new Map(e.topA.map((x) => [x.nombre, x.valor]));
  const mapB = new Map(e.topB.map((x) => [x.nombre, x.valor]));
  const names = [...new Set([...e.topA.map((x) => x.nombre), ...e.topB.map((x) => x.nombre)])];
  const notaPartes = [];
  if (e.totalCount != null) notaPartes.push(`top ${Math.max(e.topA.length, e.topB.length)} de ${e.totalCount} por cada métrica`);
  if (e.restoA && e.restoA.sumaFmt) notaPartes.push(`resto de ${e.metricA} (${e.restoA.count}): ${e.restoA.sumaFmt}`);
  if (e.restoB && e.restoB.sumaFmt) notaPartes.push(`resto de ${e.metricB} (${e.restoB.count}): ${e.restoB.sumaFmt}`);
  return {
    titulo: `${e.metricA} vs ${e.metricB}${e.dimension ? ` · ${_HEAD_POR_DIM[e.dimension] || e.dimension}` : ""}`,
    head: e.dimension ? (_HEAD_POR_DIM[e.dimension] || "Entidad") : "Entidad",
    cols: [e.metricA, e.metricB],
    rows: names.map((n) => ({ label: n, values: [mapA.get(n) ?? "—", mapB.get(n) ?? "—"] })),
    ...(notaPartes.length ? { nota: notaPartes.join(" · ") } : {}),
  };
}

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

  // 0c · GRILLA multi-entidad × multi-métrica (gridTable) — owner "pase quirúrgico de confiabilidad" 2026-07-29,
  // requisito 5: "multi-entidad + multi-métrica deben renderizarse como tabla estructurada, sin depender del
  // narrador". Reusa el MISMO tipo "tabla_matriz" (misma UI que el mes a mes) — solo transforma la forma de
  // gridTable (filas dinámicas por columna, ver entityRecord.js buildGrid) a {cols, rows:[{label, values}]}.
  const gt = _gridRowsToTabla(e);
  if (gt) return { tipo: "tabla_matriz", titulo: gt.titulo, tabla: gt };

  // 0d · TENSIÓN (dos rankings cruzados, tensionRead) — misma garantía de tabla estructurada, requisito 5.
  const tt = _tensionToTabla(e);
  if (tt) return { tipo: "tabla_matriz", titulo: tt.titulo, tabla: tt };

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
