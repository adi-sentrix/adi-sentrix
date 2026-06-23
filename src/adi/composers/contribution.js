/* === src/adi/composers/contribution.js ===
 * composeClientContributionRanking · BRIEF #46 · extraído de 41cc33d8 (L24337) · verbatim.
 * Ranking de clientes por contribución mensual. Determinístico sobre clientesMargen. */
import { clientesMargen } from "../../data/demoData.js";
import { buildResponseContract, filterTextualSuggestions } from "../helpers.js";
import { _buildEntityId } from "../router.js";

export function composeClientContributionRanking(scenarioId) {
  // ── 1. Helpers formato
  const fmtM = (val) => {
    if (val == null || isNaN(val)) return "$0M";
    return `$${(val / 1000).toFixed(2)}M`;
  };

  // ── 2. Ranking runtime sobre clientesMargen
  // clientesMargen tiene contribucion en miles USD. Ordenar desc.
  const ranked = [...clientesMargen]
    .filter(c => c.tipo === "cliente")
    .sort((a, b) => b.contribucion - a.contribucion);

  if (ranked.length === 0) {
    return buildResponseContract({
      opener: "El portafolio no registra clientes con contribución activa en el dataset actual.\n\n*Confianza alta.*",
      suggestions: filterTextualSuggestions(["¿Qué productos dejan más plata?", "¿Cómo está la rotación?", "Cuál es la cobertura"]),
      sentrixAction: null,
      decision: null,
      evidence: { client_count: 0 },
      focus: "client_contribution_empty",
      confidence: "alta",
      materialMetrics: [],
      reasoningPattern: "client_contribution_ranking",
      suggestedNextActions: [],
    });
  }

  const totalContrib = ranked.reduce((s, c) => s + c.contribucion, 0);
  const top3 = ranked.slice(0, 3);
  const top3Contrib = top3.reduce((s, c) => s + c.contribucion, 0);
  const pctTop3 = ((top3Contrib / totalContrib) * 100).toFixed(0);

  // ── 3. EVIDENCIA · ranking visual
  const rankingLines = top3.map(c => {
    const pct = ((c.contribucion / totalContrib) * 100).toFixed(0);
    return `${c.nombre.padEnd(14, " ")} → Contribución ${fmtM(c.contribucion)} · ${pct}% del total · Margen ${c.margen}% · Carga ${c.pctRebate}%`;
  }).join("\n");

  const headerLine = `Los ${ranked.length} clientes aportan ${fmtM(totalContrib)} de contribución mensual agregada. Top 3 concentra ${pctTop3}%.`;
  const evidencia = `${headerLine}\n\nRanking por contribución mensual:\n${rankingLines}`;

  // ── 4. LECTURA causal
  const top1 = top3[0];
  const top1pct = ((top1.contribucion / totalContrib) * 100).toFixed(0);
  const bottom = ranked[ranked.length - 1];
  const ratio = bottom ? (top1.contribucion / Math.max(bottom.contribucion, 1)).toFixed(1) : "1";

  // Detectar cliente con margen alto + contribución alta (estrella) vs
  // cliente con margen bajo + contribución alta (palanca riesgosa)
  const margenAlto = top3.find(c => c.margen >= 25);
  const margenBajo = top3.find(c => c.margen < 23);

  let lecturaCausal = `${top1.nombre} concentra ${top1pct}% de la contribución (${fmtM(top1.contribucion)}), ${ratio}x lo que aporta ${bottom.nombre}.`;
  if (margenAlto && margenBajo && margenAlto !== margenBajo) {
    lecturaCausal += ` ${margenAlto.nombre} (${margenAlto.margen}% margen) y ${margenBajo.nombre} (${margenBajo.margen}% margen) coexisten en el top: el segundo aporta volumen pero a costo de carga comercial (${margenBajo.pctRebate}%) sobre la mejor práctica interna.`;
  } else if (margenAlto) {
    lecturaCausal += ` ${margenAlto.nombre} opera con margen ${margenAlto.margen}%, ${margenAlto.margen >= 25 ? "por encima" : "alineado"} del benchmark cartera (30.1%).`;
  }

  // ── 5. FOCO accionable
  const ascendiendo = ranked.find(c => c.margen >= 28 && c.pctRebate <= 2.5);
  const recuperable = ranked.find(c => c.pctRebate >= 4.5);
  let focoText;
  if (ascendiendo && recuperable) {
    focoText = `Dos mecanismos disponibles: ${ascendiendo.nombre} opera con margen sano (${ascendiendo.margen}%, carga ${ascendiendo.pctRebate}%) · ${recuperable.nombre} concentra carga sobre benchmark (${recuperable.pctRebate}% vs 3%) · espacio comercial cuantificable.`;
  } else if (recuperable) {
    focoText = `${recuperable.nombre} opera con carga sobre mejor práctica (${recuperable.pctRebate}%) · la palanca comercial sobre este cliente tiene espacio cuantificable de recuperación de contribución.`;
  } else {
    focoText = `${top1.nombre} opera como cuenta ancla del top 3 · la base de diversificación está concentrada en pocas cuentas.`;
  }

  const confianza = `*Confianza alta · ranking determinístico sobre cartera mensual.*`;
  const opener = `${evidencia}\n\n${lecturaCausal}\n\n${focoText}\n\n${confianza}`;

  // ── 6. Suggestions + SentrixAction
  const suggestions = [
    `Profundizar en ${top1.nombre}`,
    margenBajo ? `Por qué ${margenBajo.nombre} tiene margen bajo` : `Comparar top 3 cuentas`,
    "Qué productos dejan más plata",
  ];

  const sentrixAction = {
    label: `Ver ranking de ${ranked.length} clientes`,
    moduleChip: "Margenes",
    payload: {
      modulo: "margenes",
      clientes: top3.map(c => c.nombre),
      skus: [],
      mechanismBanner: "Ranking por contribución mensual",
    },
  };

  return buildResponseContract({
    opener,
    suggestions: filterTextualSuggestions(suggestions.slice(0, 3)),
    sentrixAction,
    decision: top1.nombre,
    evidence: {
      client_count: ranked.length,
      total_contribucion_M: +totalContrib / 1000,
      top_cliente: top1.nombre,
      top_cliente_contribucion_pct: +top1pct,
      top3_concentration_pct: +pctTop3,
    },
    focus: "client_contribution_ranking",
    confidence: "alta",
    clientList: top3.map(c => _buildEntityId("client", c.nombre)),
    materialMetrics: top3.map(c => `${c.nombre}: ${fmtM(c.contribucion)} de contribución`),
    reasoningPattern: "client_contribution_ranking",
    suggestedNextActions: [
      { type: "drill_top_client", clientName: top1.nombre },
      { type: "review_high_load", clientName: recuperable ? recuperable.nombre : null },
      { type: "compare_top3", count: 3 },
    ],
  });
}
