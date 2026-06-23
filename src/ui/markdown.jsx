/* === src/ui/markdown.jsx ===
 * renderMarkdownLite + highlighter financiero · extraídos de 41cc33d8 · verbatim.
 * Presentación pura · NO cambia el texto (solo envuelve cifras/entidades en <span> con estilo);
 * el textContent renderizado es byte-idéntico al texto que entrega answerADI. */
import React from "react";
import { FINANCIAL_HIGHLIGHT, FINANCIAL_PLAIN, KNOWN_ENTITIES } from "./theme.js";

export function isTabularText(text) {
  if (!text) return false;
  // Buscar línea con 2+ espacios consecutivos entre caracteres no-espacio
  return /\S\s{2,}\S/.test(text);
}

// Patrón unificado · longest-match-first
// Orden importa: deltas con signo > pp > money > unit > mult > ratio > pct > entity
export function tokenizeFinancialText(text) {
  if (!text) return [];
  const entityAlt = KNOWN_ENTITIES.map(e => e.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const re = new RegExp(
    "(\\+\\d+(?:[.,]\\d+)?%)" +                                          // 1 up
    "|(\\-\\d+(?:[.,]\\d+)?%)" +                                         // 2 down
    "|([+\\-]?\\d+(?:[.,]\\d+)?\\s?(?:pp|puntos)\\b)" +                  // 3 pp
    "|(\\$\\s?\\d+(?:[.,]\\d+)?\\s?[KMB]?(?:\\b|(?=\\W)))" +             // 4 money
    "|(\\d+(?:[.,]\\d+)?\\s?(?:días|dias|meses|semanas|años|anos|horas)\\b)" + // 5 unit
    "|(\\d+(?:[.,]\\d+)?x\\b)" +                                         // 6 mult
    "|(\\d+:\\d+)" +                                                     // 7 ratio
    "|(\\d+(?:[.,]\\d+)?%)" +                                            // 8 pct
    "|(" + entityAlt + ")",                                              // 9 entity
    "gi"
  );
  const tokens = [];
  let lastIdx = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > lastIdx) {
      tokens.push({ type:"plain", text: text.slice(lastIdx, m.index) });
    }
    if (m[1])      tokens.push({ type:"up",     text: m[1] });
    else if (m[2]) tokens.push({ type:"down",   text: m[2] });
    else if (m[3]) tokens.push({ type:"pp",     text: m[3] });
    else if (m[4]) tokens.push({ type:"money",  text: m[4] });
    else if (m[5]) tokens.push({ type:"unit",   text: m[5] });
    else if (m[6]) tokens.push({ type:"mult",   text: m[6] });
    else if (m[7]) tokens.push({ type:"ratio",  text: m[7] });
    else if (m[8]) tokens.push({ type:"pct",    text: m[8] });
    else if (m[9]) tokens.push({ type:"entity", text: m[9] });
    lastIdx = m.index + m[0].length;
  }
  if (lastIdx < text.length) tokens.push({ type:"plain", text: text.slice(lastIdx) });
  return tokens;
}

export function renderWithFinancialHighlight(text, keyPrefix="fh", forcePlain=false) {
  const tokens = tokenizeFinancialText(text);
  if (tokens.length <= 1) return text; // Sin matches · devuelve string crudo
  const styleSet = forcePlain ? FINANCIAL_PLAIN : FINANCIAL_HIGHLIGHT;
  return tokens.map((t, i) => {
    if (t.type === "plain") return t.text;
    const style = styleSet[t.type];
    return <span key={`${keyPrefix}-${i}`} style={style}>{t.text}</span>;
  });
}

export function renderMarkdownLite(text) {
  if (!text) return null;

  // Detección de contexto tabular: si el texto tiene alineación columnar
  // (2+ espacios consecutivos entre caracteres), suprimimos chips en cifras
  // para no romper la visualidad de tabla. En prosa narrativa: chips normales.
  const forcePlain = isTabularText(text);

  // Tokenize the string into segments of plain text + bold + italic.
  // **bold** must be matched before *italic* to avoid conflicts.
  const segments = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    const boldMatch = remaining.match(/^\*\*([^*]+)\*\*/);
    if (boldMatch) {
      segments.push(<strong key={`md-${key++}`}>{renderWithFinancialHighlight(boldMatch[1], `md-${key}b`, forcePlain)}</strong>);
      remaining = remaining.slice(boldMatch[0].length);
      continue;
    }

    const italicMatch = remaining.match(/^\*([^*]+)\*/);
    if (italicMatch) {
      segments.push(<em key={`md-${key++}`}>{renderWithFinancialHighlight(italicMatch[1], `md-${key}i`, forcePlain)}</em>);
      remaining = remaining.slice(italicMatch[0].length);
      continue;
    }

    const nextMarker = remaining.indexOf("*");
    if (nextMarker === -1) {
      segments.push(<span key={`md-${key++}`}>{renderWithFinancialHighlight(remaining, `md-${key}p`, forcePlain)}</span>);
      break;
    }

    if (nextMarker > 0) {
      segments.push(<span key={`md-${key++}`}>{renderWithFinancialHighlight(remaining.slice(0, nextMarker), `md-${key}p`, forcePlain)}</span>);
      remaining = remaining.slice(nextMarker);
    } else {
      segments.push(<span key={`md-${key++}`}>{remaining.charAt(0)}</span>);
      remaining = remaining.slice(1);
    }
  }

  return segments;
}
