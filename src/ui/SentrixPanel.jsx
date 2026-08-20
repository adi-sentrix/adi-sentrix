/* === src/ui/SentrixPanel.jsx · Etapa 5 · Sentrix · PANEL RESOLVER (registry de packs) ===
 * La "mesa de trabajo" que DEMUESTRA la lectura ejecutiva de ADI (no un dashboard fijo).
 * RESOLVER GENERAL (refactor 2026-06-29): el panel resuelve QUÉ mostrar por `reading.kind` contra una matriz
 * PANEL_PACKS (kind → {title, Hero, Evidence}) — ESPEJO del renderer buildReadingFromSignals. Un kind sin pack
 * cae al pack GENÉRICO (monto + reframe + drivers · sin tarjeta de evidencia vacía) → honesto, nunca en blanco.
 * Agregar una métrica = registrar su pack acá (+ su rama en el renderer). El armazón (header/drivers/lectura/slot)
 * es común. Regla madre: cada card sale de un claim de la lectura, y cada claim del dato. Presentación pura. */
import React, { useState, useEffect } from "react";
import { C } from "./theme.js";

/* LA MESA YA NO NECESITA COLCHÓN (owner 2026-08-20): la barra de barritas se mudó al borde IZQUIERDO de la
 * app —«las líneas que están a la derecha, que estén a la izquierda»— así que dejó de caer encima de este
 * panel. El colchón vive ahora del otro lado, en el historial y en el chat (ver `BarraLateral.jsx`). */
import { MiniPareto } from "./InlineChart.jsx";   // el 80/20 de la Mesa = la MISMA pieza del chat (owner 2026-07-09) · su import inyecta los keyframes adi*
import { skusMargen } from "../data/skusMargen.js";   // composición de marca/familia por sus SKU (cruce REAL · Pareto reflejo de la tabla 2026-07-10)
import { composicionCliente, composicionClientePorFamilia, compradoresSku } from "../data/clienteSkuMatrix.js";   // matriz cliente×SKU (cierra exacto con el cuadro · gate de conexión)
import { buildComparisonReading, buildReadingFromSignals, buildClientContribSignals, buildSkuContribSignals, buildSkuMarginSignals } from "../adi/sentrix/reading.js";   // paso 3 · operaciones
import { entityExplorable, temporalCapability } from "../adi/sentrix/capability.js";   // explorable del frame + regla temporal
import { buildGlobalEvolution, buildCompareEvolution, buildEntityEvolutionComparado, buildNegocioEvolution } from "../adi/sentrix/temporal.js";   // paso 4 · la historia (evolutivo global real + curvas por entidad · el cuadro usa el COMPARADO: negocio/entidad vs año anterior/dos entidades)
import { buildConcentration, CONCENTRATION_DIMS } from "../adi/sentrix/concentration.js";   // paso 4b · Pareto 80/20
import { buildEntityKPIs, buildMarginDecomposition, buildMarginReceipt, buildCapitalReceipt, buildBrechaFilm } from "../adi/sentrix/kpis.js";   // brick 2a/2b/6/2c · tira + descomposición + recibo + película de la brecha
import { METRIC_DEFS } from "../adi/sentrix/glossary.js";   // brick 4 · catálogo de definiciones (el "i" de cada card · determinístico)
import { diagnosisCharts } from "../adi/sentrix/surface.js";   // brick 5 · el motor decide qué gráficos según el foco (LLM-ready)
import { buildControlRing } from "../adi/sentrix/control.js";   // brick 7 · Control · la tabla-ring (foco vs promedio vs par vs mejor)
import { buildCuadroMando, CUADRO_DIMS } from "../adi/sentrix/cuadro.js";   // 4ª lente · Cuadro de mando · la grilla operable
import { buildResumenComercial } from "../adi/sentrix/resumenComercial.js";   // RESUMEN COMERCIAL (owner 2026-08-07) · la cara Comercial entera — veredicto/KPIs/plano 80-20/pareto/puente/insights ya armados y formateados (alcance SIEMPRE global: la firma no acepta selección) · cero cálculo en React
import { buildMesaEstado, buildWatchlistEstado } from "../adi/sentrix/mesa.js";   // MESA 2.0 · semáforo contra TU vara + acción priorizada + "qué cambió" + alertas/watchlist (reusa diagnose/POLICY/temporal/cuadro · una verdad)
import { buildMesaCapital, buildCuadroCapital, CUADRO_CAPITAL_EJES, CAPITAL_ESTADOS } from "../adi/sentrix/mesaCapital.js";   // CARA CAPITAL (owner 2026-07-15) · el mismo sello sobre el inventario — detectores existentes, cero cálculo en UI
import { buildMesaResultado, pnlMesaLink, pnlExportData } from "../adi/sentrix/mesaResultado.js";   // CARA RESULTADO (owner 2026-07-15 "sí, parte por p&l") · la cascada del P&L comercial — buildPnlCascade, cero cálculo en UI · pnlMesaLink = deep-link puro (evidencia P&L → cara Resultado con su alcance) · pnlExportData = copiar/CSV de lo que se está viendo (una verdad)
import { editPnlLine, removePnlLine, addPnlLine } from "../adi/pnl.js";   // EDICIÓN DIRECTA de supuestos en la cara (owner 2026-07-26 "con opción de cambiarlos") · las MISMAS primitivas del chat (una verdad) · emiten adi-pnl-changed (la cara se re-arma) · editan el criterio, JAMÁS disparan a ADI
import { ADI_SENTRIX_TEMPORAL_ENABLED, ADI_SENTRIX_PARETO_ENABLED, ADI_SENTRIX_SHELL_ENABLED, ADI_SENTRIX_CUADRO_ENABLED } from "../config/voiceFlags.js";
import { isNamedInBoleta } from "../adi/boleta.js";   // ESPEJO Sentrix↔ADI (Frente B) · el panel pinta lo que ADI nombró (la boleta = fuente de verdad de lo dicho)
import { buildResumenEjecutivo } from "../adi/specRetrieval.js";   // MESA DE CONTROL · KPIs + lectura + focos del diagnose (una verdad · lo mismo que el hero)
import { POLICY, benchmarkOf } from "../config/businessPolicy.js";   // Perfil comparado · la línea de benchmark/target (criterio-aware: si el owner fijó su vara, ES su vara)
import { setUISignal } from "../adi/uiSignals.js";   // memoria UI (owner 2026-07-08) · lo que el usuario hace en la Mesa informa el contexto de ADI
// CONTRATO DE CONCORDANCIA ADI ↔ SENTRIX (owner 2026-08-09) · la EMISIÓN: cada pieza declara qué está mostrando
// (derivado de su builder, nunca escrito a mano) y los botones "Que ADI lo explique" mandan ese contexto
// ESTRUCTURADO además de la pregunta. `address.js` es la dirección canónica única que resuelven las dos puntas:
// reemplaza a pnlMesaLink/clientMesaLink/_tLink cuando la respuesta trae `evidence.address`, y cae a
// `legacyAddressFrom` (mismo comportamiento byte-a-byte) cuando no.
import { useViewContext, useVistaContext } from "./useViewContext.js";
import { parseAddress, resolveAddress, legacyAddressFrom } from "../adi/sentrix/address.js";
import { ADI_PROFILE } from "../config/flagProfile.js";   // perfil activo · sub-paths incompletos (placeholder Control · fecha por-entidad EJEMPLO) SOLO en dev
import { TOOLS } from "../adi/oracle/toolRegistry.js";   // FICHA EJECUTIVA (owner 2026-08-07): misma boleta/políticas que ADI — entityProfile/entityComposicion/entityCapitalLigado/trend, funciones puras sin LLM, cero cálculo paralelo en React
const _isDev = ADI_PROFILE === "dev";

const MONO = "'JetBrains Mono', ui-monospace, monospace";

// bordes celestes SOLO en los costados (izq+der) + glow lateral suave · top/bottom oscuros · toda card lo usa
const CARD_SIDES = {
  borderTop: "1px solid rgba(255,255,255,0.05)",
  borderBottom: "1px solid rgba(255,255,255,0.05)",
  borderLeft: "1px solid rgba(47,184,218,0.5)",
  borderRight: "1px solid rgba(47,184,218,0.5)",
  boxShadow: "inset 7px 0 14px -9px rgba(47,184,218,0.5), inset -7px 0 14px -9px rgba(47,184,218,0.5)",
};

function Eyebrow({ children, tone = C.textMuted, def }) {
  return (
    <div style={{ fontFamily:MONO, fontSize:9.5, fontWeight:600, color:tone, textTransform:"uppercase", letterSpacing:"1.4px", marginBottom:10 }}>
      {children}{def && <InfoDot def={def} align="left"/>}
    </div>
  );
}

function Card({ children, accent = false }) {
  return (
    <div style={{
      background: accent ? "rgba(255,255,255,0.035)" : "rgba(255,255,255,0.022)",
      ...CARD_SIDES,
      borderRadius:12, padding:"16px 18px",
    }}>
      {children}
    </div>
  );
}

// barra segmentada (descomposición de precio / concentración) · segments:[{label,pct,color}]
function StackBar({ segments }) {
  return (
    <div>
      <div style={{ display:"flex", height:10, borderRadius:5, overflow:"hidden", background:"rgba(255,255,255,0.04)", border:`1px solid ${C.border}` }}>
        {segments.map((s, i) => (
          <div key={i} title={`${s.label} ${p1(s.pct)}%`} style={{ width:`${s.pct}%`, background:s.color, transition:"width 0.4s ease" }}/>
        ))}
      </div>
      <div style={{ display:"flex", flexWrap:"wrap", gap:"6px 16px", marginTop:10 }}>
        {segments.map((s, i) => (
          <div key={i} style={{ display:"flex", alignItems:"center", gap:6, fontSize:11.5, color:C.textSub }}>
            <span style={{ width:8, height:8, borderRadius:2, background:s.color, flexShrink:0 }}/>
            <span>{s.label}</span>
            <span style={{ fontFamily:MONO, fontWeight:600, color:C.text }}>{p1(s.pct)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Num({ children, color = C.text, size = "0.94em" }) {
  return <span style={{ fontFamily:MONO, fontWeight:600, color, fontSize:size, fontFeatureSettings:"'tnum'", letterSpacing:"0.2px" }}>{children}</span>;
}

// chip de leyenda con valor en $ (la barra del cliente muestra plata recuperable, no %)
function Legend({ color, label, v }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:11.5, color:C.textSub }}>
      <span style={{ width:8, height:8, borderRadius:2, background:color, flexShrink:0 }}/>
      <span>{label}</span>
      <Num>{v}</Num>
    </div>
  );
}
const fmtK = (n) => "$" + Math.round(n || 0) + "K";
// formato $ para gráficos. El dato viene en $K → se muestra en $M (÷1000), como las tarjetas KPI
// (100000→$100.0M · 92900→$92.9M · 6800→$6.8M · -600→−$0.6M). Misma fuente de verdad que el header.
const fMon = (n) => { const s = (Number(n) || 0) < 0 ? "−" : "", v = Math.abs(Number(n) || 0) / 1000; return s + "$" + v.toFixed(1) + "M"; };
const r1 = (n) => Math.round(n * 10) / 10;
// % SIEMPRE con 1 decimal (owner: "que queden parejos en la visual") → redondea como r1 pero fuerza el cero final.
// NO reemplaza a r1 (que también formatea 'x' de rotación, que no lleva decimal fijo). Devuelve string.
const p1 = (n) => (Math.round((Number(n) || 0) * 10) / 10).toFixed(1);
// aclara un color hex hacia el blanco (para puntos de gráfico más claros que su curva)
const _lighten = (hex, amt = 0.45) => {
  const h = (hex || "").replace("#", ""); if (h.length < 6) return hex;
  const c = (i) => { const v = parseInt(h.slice(i, i + 2), 16); return Math.round(v + (255 - v) * amt); };
  return `rgb(${c(0)},${c(2)},${c(4)})`;
};

/* ══════════════════════════ evidenceSpec · VISTAS ADAPTATIVAS (owner 2026-07-31) ══════════════════════════
 * "ADI asesora; Sentrix demuestra" — evidence.evidenceSpec (sentrixEvidence.js, SOLO ruta oráculo) es un sub-objeto
 * OPCIONAL/ADITIVO sobre `evidence`: cuando está presente agrega DOS piezas de UI universales, compartidas por los
 * 7 tipos de respuesta (dato puntual/diagnóstico/decisión/simulación/capital/tendencia/P&L) sin tocar los packs
 * existentes — cuando está AUSENTE (ruta legacy, turno bypass) ambos componentes devuelven null: el panel se ve
 * BYTE-EXACTO a como se veía antes de esta ronda, cero regresión.
 *   · EvidenceClaimHeader (Nivel 1) — el claim del turno (evidenceSpec.claim.text) + su grado, arriba del cuerpo.
 *   · EvidenceConfidenceFooter (Nivel 3) — generalización del bloque "Confianza + límites" que antes SOLO existía
 *     dentro de EvidenciaRecibo (client/bodega, vía buildMarginReceipt/buildCapitalReceipt): acá lee evidenceSpec.
 *     grade/.missing/.sources — construido para CUALQUIER tipo, no solo los que tienen receipt. NO reemplaza a
 *     EvidenciaRecibo (ver su propio comentario): el receipt recalcula confianza/límites para el FOCO NAVEGADO
 *     (puede no ser ya la entidad central del turno tras un drill-down/comparación) — usar acá el grado/missing del
 *     turno en ese caso sería la MISMA clase de bug de integridad que motiva esta iniciativa (mostrar un respaldo
 *     que no corresponde a lo que se está mirando). Se usa en su lugar SOLO donde no hay receipt (honesto: hoy
 *     sku/marca/familia no tenían NADA de esto) o donde el llamador confirma que sigue en la entidad base. */
const GRADE_UI = {
  probado:  { label: "Probado",  fg: C.green,     bg: "rgba(124,207,144,0.10)", bd: "rgba(124,207,144,0.35)" },
  indicado: { label: "Indicado", fg: C.amber,      bg: "rgba(217,154,90,0.10)",  bd: "rgba(217,154,90,0.35)" },
  abierto:  { label: "Abierto",  fg: C.textMuted,  bg: "rgba(255,255,255,0.05)", bd: C.border },
};
const GRADE_REASON = {
  probado:  "esta cifra sale del dato real de la entidad citada este turno.",
  indicado: "es una señal, un benchmark o una proyección — no un hecho consumado sobre esta entidad.",
  abierto:  "no hay dato suficiente este turno para respaldar la afirmación completa.",
};
// Nivel 1 · flex/texto simple (sin grid) → hereda el overlay móvil de App.jsx sin CSS nuevo (regla del encargo).
function EvidenceClaimHeader({ evidenceSpec }) {
  const claim = evidenceSpec && evidenceSpec.claim;
  if (!claim || !claim.text) return null;
  const g = evidenceSpec.grade && GRADE_UI[evidenceSpec.grade];
  return (
    <div style={{ display:"flex", alignItems:"flex-start", gap:10, flexWrap:"wrap", marginTop:8 }}>
      <div style={{ flex:1, minWidth:180, fontSize:12.5, color:C.textSub, lineHeight:1.5 }}>{claim.text}</div>
      {g && (
        <span style={{ flexShrink:0, fontFamily:MONO, fontSize:9, fontWeight:600, letterSpacing:"0.6px", textTransform:"uppercase", color:g.fg, background:g.bg, border:`1px solid ${g.bd}`, borderRadius:999, padding:"3px 9px", whiteSpace:"nowrap" }}>
          {g.label}
        </span>
      )}
    </div>
  );
}
// Nivel 3 · generaliza confianza+límites a partir de evidenceSpec.grade/.missing/.sources — MISMA fuente de datos
// que capability.js ya usa para EvidenciaRecibo.limites (temporalCapability/entityExplorable), solo que expuesta
// acá para cualquier tipo. `missing` = unsupported de runPlan (coverage real de ESTE plan, nunca visto antes en
// ningún panel) · `sources` = capability.js verbatim (disponibilidad/confianza temporal de la entidad del turno).
function EvidenceConfidenceFooter({ evidenceSpec }) {
  if (!evidenceSpec || !evidenceSpec.grade) return null;
  const g = GRADE_UI[evidenceSpec.grade];
  const reason = GRADE_REASON[evidenceSpec.grade];
  const limites = [];
  (evidenceSpec.missing || []).forEach((m) => { if (m && m.reason) limites.push(m.reason); });
  const src = evidenceSpec.sources;
  if (src && src.confianza && src.confianza.status === "blocked" && src.confianza.reason) limites.push(src.confianza.reason);
  if (src && src.availability && Array.isArray(src.availability.blocked)) {
    src.availability.blocked.forEach((b) => { if (b && b.view && b.reason) limites.push(`El desglose de ${b.view}: ${b.reason}.`); });
  }
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
      {g && (
        <div style={{ display:"flex", alignItems:"flex-start", gap:10, padding:"12px 14px", borderRadius:10, background:g.bg, border:`1px solid ${g.bd}` }}>
          <span style={{ width:8, height:8, borderRadius:"50%", background:g.fg, marginTop:5, flexShrink:0 }}/>
          <div style={{ fontSize:12.5, color:C.textSub, lineHeight:1.55 }}>
            <span style={{ color:g.fg, fontWeight:600 }}>{g.label}</span> — {reason}
          </div>
        </div>
      )}
      {limites.length > 0 && (
        <div>
          <Eyebrow tone={C.textMuted}>Lo que esta respuesta NO afirma</Eyebrow>
          <div style={{ display:"flex", flexDirection:"column", gap:9 }}>
            {limites.map((t, i) => (
              <div key={i} style={{ display:"flex", gap:10, alignItems:"flex-start", fontSize:12.5, color:C.textSub, lineHeight:1.5 }}>
                <span style={{ color:C.textMuted, flexShrink:0, fontFamily:MONO }}>—</span>
                <span>{t}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════ PACKS (espejo del renderer · kind → {title, Hero, Evidence}) ══════════════════════════

// ── cliente · carga comercial · héroe = barra de PLATA recuperable, evidencia = la cuenta de la carga ──
// Reconciliación del nuance (owner): si la palanca DOMINANTE es el costo (decomp), el hero lo dice — la brecha
// vive en el costo estructural y la carga es el QUICK-WIN (no "el" problema) · así no contradice al header/brecha.
function ClientLoadHero({ rd, decomp }) {
  const recK = rd.recoverableK || 0, recBPK = rd.recoverableBPK || 0;
  const pctAtProm = recBPK > 0 ? Math.max(4, Math.round((recK / recBPK) * 100)) : 100;
  const costoDom = decomp && decomp.dominant === "costo";
  return (
    <>
      <div style={{ display:"flex", alignItems:"baseline", gap:10, marginBottom:4, flexWrap:"wrap" }}>
        <Num color={C.amber} size="2.1em">{rd.montoFmt}</Num>
        {costoDom
          ? <span style={{ fontSize:12.5, color:C.textMuted }}>margen · la brecha vive en la <Num color={C.red}>estructura de costo</Num> · la carga (<Num color={C.amber}>{p1(rd.carga)}%</Num>) es el quick-win</span>
          : <span style={{ fontSize:12.5, color:C.textMuted }}>margen · carga comercial <Num color={C.amber}>{p1(rd.carga)}%</Num> · <Num color={C.amber}>+{p1(rd.vsPromedio)}pp</Num> sobre el promedio ({p1(rd.targetCarga)}%)</span>}
      </div>
      <div style={{ marginTop:14 }}>
        <div style={{ fontSize:11, color:C.textMuted, marginBottom:8 }}>{costoDom ? "Quick-win · recuperable renegociando la carga (anual):" : "Margen recuperable renegociando la carga (anual):"}</div>
        <div style={{ display:"flex", height:10, borderRadius:5, overflow:"hidden", background:"rgba(255,255,255,0.04)", border:`1px solid ${C.border}` }}>
          <div style={{ width:`${pctAtProm}%`, background:C.text, transition:"width 0.4s ease" }}/>
          <div style={{ width:`${100-pctAtProm}%`, background:"rgba(255,255,255,0.22)", transition:"width 0.4s ease" }}/>
        </div>
        <div style={{ display:"flex", flexWrap:"wrap", gap:"6px 16px", marginTop:10 }}>
          <Legend color={C.text} label="al promedio interno" v={fmtK(recK)}/>
          <Legend color="rgba(255,255,255,0.5)" label="a mejor práctica" v={fmtK(recBPK)}/>
        </div>
      </div>
    </>
  );
}
function ClientLoadEvidence({ rd }) {
  const rows = [
    { k:"Margen actual", v:`${p1(rd.pct)}%`, color:C.amber },
    { k:`Carga comercial (promedio ${p1(rd.targetCarga)}%)`, v:`${p1(rd.carga)}%`, color:C.amber },
    ...(rd.targetMargen != null ? [{ k:"Si baja la carga al promedio → margen", v:`${p1(rd.targetMargen)}%`, color:C.green }] : []),
    { k:"Recuperable al promedio (anual)", v:fmtK(rd.recoverableK), color:C.text },
    { k:`Recuperable a mejor práctica (${(rd.bestPracticeCarga||3).toFixed(1)}%)`, v:fmtK(rd.recoverableBPK), color:C.text },
  ];
  return <Rows rows={rows}/>;
}

// ── SKU · descomposición del precio · héroe = barra costo/rebate/margen, evidencia = la cuenta del precio ──
function CostStructureHero({ rd }) {
  return (
    <>
      <div style={{ display:"flex", alignItems:"baseline", gap:10, marginBottom:4 }}>
        <Num color={C.red} size="2.1em">{rd.montoFmt}</Num>
        <span style={{ fontSize:12.5, color:C.textMuted }}>margen · <Num color={C.amber}>{p1(rd.gap)}pp</Num> bajo el benchmark (<Num>{p1(rd.benchmark)}%</Num>)</span>
      </div>
      <div style={{ marginTop:14 }}>
        <StackBar segments={[
          { label:"Costo", pct: rd.decomposition.costo, color:C.red },
          { label:"Rebate", pct: rd.decomposition.rebate, color:C.amber },
          { label:"Margen", pct: rd.decomposition.margen, color:C.green },
        ]}/>
      </div>
    </>
  );
}
function CostStructureEvidence({ rd }) {
  const rows = [
    { k:"Precio de venta (100.0%)", v:"base", color:C.textSub },
    { k:"− Costo", v:`${p1(rd.decomposition.costo)}%`, color:C.red },
    { k:"− Rebate (carga comercial)", v:`${p1(rd.decomposition.rebate)}%`, color:C.amber },
    { k:"= Margen que queda", v:`${p1(rd.decomposition.margen)}%`, color:C.green, strong:true },
  ];
  return <Rows rows={rows}/>;
}

// ── capital/bodega · concentración · héroe = barra foco vs resto, evidencia = ranking de SKUs ──
function CapitalHero({ rd }) {
  const resto = Math.max(0, 100 - (rd.pct || 0));
  return (
    <>
      <div style={{ display:"flex", alignItems:"baseline", gap:10, marginBottom:4 }}>
        <Num color={C.text} size="2.1em">{rd.montoFmt}</Num>
        <span style={{ fontSize:12.5, color:C.textMuted }}><Num color={C.text}>{p1(rd.pct)}%</Num> del capital inmovilizado{rd.totalInmovFmt ? <> (<Num>{rd.totalInmovFmt}</Num> total)</> : null}</span>
      </div>
      <div style={{ marginTop:14 }}>
        <StackBar segments={[
          { label: rd.focus, pct: rd.pct, color:C.text },
          { label:"Resto", pct: resto, color:"rgba(255,255,255,0.14)" },
        ]}/>
      </div>
    </>
  );
}
function CapitalEvidence({ rd }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
      <div style={{ display:"grid", gridTemplateColumns:"1fr auto auto", gap:"0 16px", fontSize:9.5, color:C.textMuted, fontFamily:MONO, letterSpacing:"0.6px", textTransform:"uppercase", paddingBottom:6, borderBottom:`1px solid ${C.border}`, marginBottom:4 }}>
        <span>SKU</span><span style={{ textAlign:"right" }}>Capital</span><span style={{ textAlign:"right" }}>Cobertura</span>
      </div>
      {rd.ranking.map((r, i) => {
        const dot = r.alerta === "crit" ? C.red : r.alerta === "warn" ? C.amber : C.textMuted;
        const cap = "$" + (Math.abs(r.capital) >= 1000 ? (r.capital/1000).toFixed(1)+"K" : Math.round(r.capital));
        return (
          <div key={i} style={{ display:"grid", gridTemplateColumns:"1fr auto auto", gap:"0 16px", alignItems:"center", padding:"6px 0", borderBottom: i < rd.ranking.length-1 ? `1px solid rgba(255,255,255,0.03)` : "none" }}>
            <span style={{ display:"flex", alignItems:"center", gap:8, minWidth:0 }}>
              <span style={{ width:6, height:6, borderRadius:"50%", background:dot, flexShrink:0 }}/>
              <span style={{ color:"#eef2f6", fontWeight:600, fontSize:12.5, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{r.sku}</span>
            </span>
            <Num>{cap}</Num>
            <Num color={r.doh >= 90 ? C.amber : C.textSub}>{r.doh}d</Num>
          </div>
        );
      })}
    </div>
  );
}

// ── pack GENÉRICO (fallback honesto) · cualquier kind sin pack: monto + reframe · sin evidencia bespoke ──
function GenericHero({ rd }) {
  return (
    <div style={{ display:"flex", alignItems:"baseline", gap:10, marginBottom:4, flexWrap:"wrap" }}>
      <Num color={C.text} size="2.1em">{rd.montoFmt}</Num>
      <span style={{ fontSize:12.5, color:C.textMuted }}>{rd.reframe}</span>
    </div>
  );
}

// helper · filas clave→valor (evidencia tabular de cliente/SKU)
function Rows({ rows }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
      {rows.map((r, i) => (
        <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:12, padding:"7px 0", borderBottom: i < rows.length-1 ? `1px solid rgba(255,255,255,0.03)` : "none" }}>
          <span style={{ fontSize:12.5, color: r.strong ? C.text : C.textSub, fontWeight: r.strong ? 600 : 400 }}>{r.k}</span>
          <Num color={r.color}>{r.v}</Num>
        </div>
      ))}
    </div>
  );
}

// ── comparación · operación COMPARAR (paso 3b) · dos entidades lado a lado ──
function CompCol({ entity, valueFmt, sub, better }) {
  return (
    <div style={{ flex:1, minWidth:0, textAlign:"center", padding:"2px 6px" }}>
      <div style={{ fontSize:12, color:"#eef2f6", fontWeight:600, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", marginBottom:6 }}>{entity}</div>
      <Num color={better ? C.green : C.amber} size="1.85em">{valueFmt}</Num>
      <div style={{ fontSize:11, color:C.textMuted, marginTop:6 }}>{sub}</div>
    </div>
  );
}
function ComparisonHero({ rd }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:6 }}>
      <CompCol entity={rd.a.entity} valueFmt={rd.a.valueFmt} sub={rd.a.sub} better={rd.better === rd.a.entity}/>
      <div style={{ flexShrink:0, textAlign:"center", color:C.textMuted }}>
        <div style={{ fontFamily:MONO, fontSize:9, letterSpacing:"1px" }}>VS</div>
        <Num color={C.text} size="1.05em">{rd.gapFmt || `${p1(rd.gap)}pp`}</Num>
      </div>
      <CompCol entity={rd.b.entity} valueFmt={rd.b.valueFmt} sub={rd.b.sub} better={rd.better === rd.b.entity}/>
    </div>
  );
}
function ComparisonEvidence({ rd }) {
  const metricLabel = rd.metric === "capital" ? "Capital" : rd.metric === "contribucion" ? "Contribución" : "Margen";
  const rows = [{ k: metricLabel, a: rd.a.valueFmt, b: rd.b.valueFmt }, { k: "Driver", a: rd.a.sub, b: rd.b.sub }];
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
      <div style={{ display:"grid", gridTemplateColumns:"auto 1fr 1fr", gap:"0 12px", fontSize:9.5, color:C.textMuted, fontFamily:MONO, letterSpacing:"0.5px", textTransform:"uppercase", paddingBottom:6, borderBottom:`1px solid ${C.border}`, marginBottom:4 }}>
        <span/><span style={{ textAlign:"right", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{rd.a.entity}</span><span style={{ textAlign:"right", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{rd.b.entity}</span>
      </div>
      {rows.map((r, i) => (
        <div key={i} style={{ display:"grid", gridTemplateColumns:"auto 1fr 1fr", gap:"0 12px", alignItems:"center", padding:"7px 0", borderBottom: i < rows.length-1 ? `1px solid rgba(255,255,255,0.03)` : "none" }}>
          <span style={{ fontSize:12.5, color:C.textSub }}>{r.k}</span>
          <span style={{ textAlign:"right", fontSize:11.5, color:C.text }}>{r.a}</span>
          <span style={{ textAlign:"right", fontSize:11.5, color:C.text }}>{r.b}</span>
        </div>
      ))}
    </div>
  );
}

// ── barra "Seguir analizando" · el control de operaciones (cambiar métrica · comparar) + bloqueos honestos ──
function ExplorarBar({ explorable, onCompare, metricOptions, currentMetric, onMetric }) {
  const peers = (explorable && explorable.compare) || [];
  const blocked = (explorable && explorable.blocked) || [];
  return (
    <div style={{ padding:"13px 15px", borderRadius:10, border:`1px solid ${C.border}`, background:"rgba(255,255,255,0.012)" }}>
      <Eyebrow tone={C.textMuted}>Seguir analizando</Eyebrow>
      {metricOptions && metricOptions.length > 1 && (
        <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", marginBottom:10 }}>
          <span style={{ fontSize:12.5, color:C.textSub, flexShrink:0 }}>Ver</span>
          {metricOptions.map((mo) => {
            const on = currentMetric === mo.key;
            return (
              <button key={mo.key} onClick={() => onMetric(mo.key)}
                style={{ padding:"5px 11px", borderRadius:6, fontSize:12, cursor:"pointer", fontFamily:"'DM Sans', system-ui, sans-serif",
                  background: on ? "rgba(255,255,255,0.15)" : "transparent", border:`1px solid ${on ? C.text : C.border}`, color: on ? C.text : C.textSub }}>
                {mo.label}
              </button>
            );
          })}
        </div>
      )}
      {peers.length > 0 && (
        <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
          <span style={{ fontSize:12.5, color:C.textSub, flexShrink:0 }}>Comparar con</span>
          <select onChange={(e) => { if (e.target.value) onCompare(e.target.value); }} defaultValue=""
            style={{ flex:1, minWidth:130, background:C.surfaceAlt, color:C.text, border:`1px solid ${C.borderLight}`, borderRadius:6, padding:"7px 10px", fontSize:12.5, fontFamily:"'DM Sans', system-ui, sans-serif", cursor:"pointer", outline:"none" }}>
            <option value="">elige una entidad…</option>
            {peers.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      )}
      {blocked.length > 0 && (
        <div style={{ fontSize:11, color:C.textMuted, marginTop:9, lineHeight:1.45 }}>
          <span style={{ color:C.amber, opacity:0.75 }}>No disponible:</span> {blocked.map((b) => b.view).join(" · ")} — sin granularidad atómica en los datos.
        </div>
      )}
    </div>
  );
}

// ── contribución de cliente · margen unitario vs benchmark (la compresión) ──
function MarginCompressionHero({ rd }) {
  const fillPct = rd.benchmark > 0 ? Math.max(4, Math.round((rd.pct / rd.benchmark) * 100)) : 100;
  const rec = rd.drivers && rd.drivers[3];
  return (
    <>
      <div style={{ display:"flex", alignItems:"baseline", gap:10, marginBottom:4, flexWrap:"wrap" }}>
        <Num color={C.amber} size="2.1em">{rd.montoFmt}</Num>
        <span style={{ fontSize:12.5, color:C.textMuted }}>margen unitario · <Num color={C.amber}>{p1(rd.gap)}pp</Num> bajo el benchmark (<Num>{p1(rd.benchmark)}%</Num>)</span>
      </div>
      <div style={{ marginTop:14 }}>
        <div style={{ height:10, borderRadius:5, overflow:"hidden", background:"rgba(244,63,94,0.2)", border:`1px solid ${C.border}` }}>
          <div style={{ width:`${fillPct}%`, height:"100%", background:C.amber, transition:"width 0.4s ease" }}/>
        </div>
        <div style={{ display:"flex", justifyContent:"space-between", marginTop:8, fontSize:11.5, color:C.textSub }}>
          <span>margen <Num color={C.amber}>{p1(rd.pct)}%</Num></span>
          <span>benchmark <Num>{p1(rd.benchmark)}%</Num></span>
        </div>
      </div>
      {rec && <div style={{ marginTop:12, fontSize:12.5, color:C.textSub }}>Contribución recuperable al benchmark: <Num color={C.green} size="1.1em">{rec.v}</Num> anual</div>}
    </>
  );
}
function MarginCompressionEvidence({ rd }) {
  const rows = [
    { k: "Margen unitario actual", v: `${p1(rd.pct)}%`, color: C.amber },
    { k: "Benchmark de cartera", v: `${p1(rd.benchmark)}%`, color: C.textSub },
    { k: "Brecha de margen unitario", v: `${p1(rd.gap)}pp`, color: C.red, strong: true },
    ...(rd.drivers && rd.drivers[3] ? [{ k: "Contribución recuperable (anual)", v: rd.drivers[3].v, color: C.green }] : []),
  ];
  return <Rows rows={rows}/>;
}

// matriz mechanism/kind → pack. Espejo de buildReadingFromSignals. Sin entrada → GENERIC.
const PANEL_PACKS = {
  internal_commercial_load: { title: (rd) => `Por qué ${rd.focus} tiene el peor margen`, Hero: ClientLoadHero,   Evidence: ClientLoadEvidence },
  cost_structure:           { title: (rd) => `Por qué ${rd.focus} es el peor en margen`, Hero: CostStructureHero, Evidence: CostStructureEvidence },
  capital_concentration:    { title: (rd) => `Por qué ${rd.focus} es el foco`,           Hero: CapitalHero,       Evidence: CapitalEvidence },
  comparison:               { title: (rd) => `Comparación · ${rd.focus}`,                Hero: ComparisonHero,    Evidence: ComparisonEvidence },
  margin_compression:       { title: (rd) => `Por qué ${rd.focus} aporta menos contribución`, Hero: MarginCompressionHero, Evidence: MarginCompressionEvidence },
};
const GENERIC_PACK = { title: (rd) => `Por qué ${rd.focus}`, Hero: GenericHero, Evidence: null };
const packFor = (rd) => PANEL_PACKS[rd.kind] || GENERIC_PACK;

// ── RANKING PANORÁMICO · el Cuadro directo (sin foco único) · "los N mejores/peores clientes/SKU" → la grilla ──
// El ranking no trae reading de UNA entidad; el Cuadro es panorámico (vista de dimensión completa). Shell mínimo:
// header + una sola pestaña (Cuadro) + la grilla, abierta en la dimensión del ranking.
function CuadroOnlyPanel({ evidence, onClose, onToggleMax, maximized }) {
  const metricLabel = (evidence.metrica || "ranking").toString().toUpperCase();
  // enum canónico de la boleta (client/sku/marca/bodega) → dimensión del grid (cliente/sku/marca/bodega) · robusto a
  // variantes/sucursal (antes 'sucursal' caía silenciosamente al grid de clientes · bug latente que B2 cierra).
  const initialDim = ({ sku: "sku", marca: "marca", bodega: "bodega", sucursal: "bodega", client: "cliente", cliente: "cliente", clientes: "cliente", familia: "familia", sfamilia: "familia" })[String(evidence.entityType || evidence.dimension || "").toLowerCase()] || "cliente";
  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", minHeight:0, background:"#000000", borderLeft:`1px solid ${C.border}`, position:"relative", overflow:"hidden" }}>
      <div className="sentrix-sweep"/>
      <div style={{ flexShrink:0, padding:"14px 18px", borderBottom:`1px solid ${C.border}`, background:"linear-gradient(180deg, rgba(255,255,255,0.03), transparent)" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
          <div style={{ display:"flex", alignItems:"center", gap:7, fontFamily:MONO, fontSize:9.5, letterSpacing:"0.8px", color:C.textMuted, textTransform:"uppercase", minWidth:0 }}>
            <span style={{ color:C.text, fontWeight:600 }}>Sentrix</span>
            <span style={{ opacity:0.4 }}>›</span><span>{metricLabel}</span>
            <span style={{ opacity:0.4 }}>›</span><span>RANKING</span>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:4, flexShrink:0 }}>
            <IconBtn onClick={onToggleMax} title={maximized ? "Restaurar" : "Agrandar"}>
              {maximized
                ? <><polyline points="9 14 4 14 4 9"/><polyline points="15 10 20 10 20 15"/></>
                : <><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/></>}
            </IconBtn>
            <IconBtn onClick={onClose} title="Cerrar"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></IconBtn>
          </div>
        </div>
        <div style={{ fontSize:13, color:C.text, fontWeight:500, lineHeight:1.45 }}>
          <span style={{ color:C.textMuted }}>Demostrando: </span>el ranking completo — ordena, filtra y compara en el Cuadro de mando.
        </div>
      </div>
      {ADI_SENTRIX_SHELL_ENABLED && (
        <div style={{ flexShrink:0, display:"flex", gap:2, padding:"0 14px", borderBottom:`1px solid ${C.border}`, background:"#000000" }}>
          <button style={{ padding:"9px 13px", background:"transparent", borderTop:"none", borderLeft:"none", borderRight:"none", borderBottom:`2px solid ${C.text}`, color:C.text, fontSize:12.5, fontWeight:600, cursor:"default", fontFamily:"'DM Sans', system-ui, sans-serif", whiteSpace:"nowrap" }}>Cuadro de mando</button>
        </div>
      )}
      <div style={{ flex:1, overflowY:"auto", minHeight:0, padding:18 }}>
        {/* key por dimensión+métrica → si se abre otro ranking/overview distinto sin cerrar, remonta (dimensión y orden nuevos) */}
        <CuadroMando key={initialDim + "-" + (evidence.metrica || "")} scenario={evidence.periodo} initialDim={initialDim} initialSort={evidence.metrica}/>
      </div>
    </div>
  );
}

// ── SIMULACIÓN · la mesa del SUPUESTO (Actual · Supuesto · Δ · fórmula) sobre el dato REAL · NO es un escenario ──
// Renderiza evidence.projection/total (ya formateados + fórmula por celda desde composeSpecSimulate). Copy de producto.
function SimulationPanel({ evidence, onClose, onToggleMax, maximized }) {
  const proj = (evidence && evidence.projection) || [];
  const tot = evidence && evidence.total;
  const pct = (evidence.transform && evidence.transform.value) || 0;
  /* ── EMISIÓN DEL CONTEXTO · la proyección de vuelta (decisión 12) ──────────────────────────────────────────
   * DOS entradas y no tres, porque lo que se parte es el UNIVERSO, no la métrica: ventas y contribución son la
   * misma venta comercial (misma unidad, misma escala, mismo período) y viajan como un CONTROL dentro de una sola
   * entrada; el capital es inventario, un universo que no reconcilia con el otro, y por eso tiene la suya. La
   * métrica y el eje realmente proyectados viajan siempre en los controles, así que el contexto nunca afirma un
   * alcance que la pantalla no tenga. */
  const _esCapital = String(evidence.metrica || "").toLowerCase() === "capital";
  const _oSim = {
    scenario: evidence.periodo,
    controles: {
      metrica: evidence.metrica || null,
      eje: evidence.dimension || evidence.entityType || null,
      pct: evidence.transform && evidence.transform.value != null ? String(evidence.transform.value) : null,
    },
  };
  useViewContext("comercial/otro/simulacion-supuesto", _esCapital ? null : evidence, { ..._oSim, ambient: !_esCapital });
  useViewContext("capital/otro/simulacion-capital", _esCapital ? evidence : null, { ..._oSim, ambient: _esCapital });
  const factor = evidence.factor || (1 + pct / 100);
  const mLabel = String(evidence.metricLabel || evidence.metrica || "");
  const dLabel = evidence.dimLabel || "entidad";
  const sup = C.celeste;
  const sgn = (v) => (v >= 0 ? "+" : "");
  const cell = { padding: "7px 10px", borderBottom: `1px solid ${C.border}`, fontVariantNumeric: "tabular-nums" };
  // 80/20 DEL IMPACTO (opción B · tabla-evidencia): participación + acumulado + bloque resaltado + corte 80% · dato ya computado.
  const con = (evidence && evidence.concentration) || null;
  const conBars = (con && con.bars) || [];
  const barByName = {}; conBars.forEach((b) => { barByName[b.name] = b; });
  const maxPct = conBars.length ? (conBars[0].pct || 1) : 1;
  const plural = (evidence.structural && evidence.structural.plural) || `${dLabel}s`;
  // VEREDICTO DE CALIDAD (B) · chip que respalda lo que ADI narra (misma fuente · sin cifra sin respaldo). color por veredicto.
  const qv = (evidence && evidence.quality_verdict) || null;
  const _QVMAP = {
    buena_captura: { label: qv && qv.crossMetric === "rotacion" ? "Rota sano" : "Captura sana", fg: C.green,     bg: "rgba(124,207,144,0.10)", bd: "rgba(124,207,144,0.35)" },
    captura_debil: { label: qv && qv.crossMetric === "rotacion" ? "Rota lento" : "Captura débil", fg: C.amber,   bg: "rgba(217,154,90,0.10)",  bd: "rgba(217,154,90,0.35)" },
    mixta:         { label: qv && qv.crossMetric === "rotacion" ? "Rotación media" : "Captura media", fg: C.textMuted, bg: "rgba(255,255,255,0.04)", bd: C.border },
  };
  // el chip aparece SOLO cuando hay bloque concentrado (= cuando la narración de ADI también dice el veredicto) → coherencia
  const _qvm = qv && qv.verdict !== "sin_benchmark" && con && con.concentrated ? _QVMAP[qv.verdict] : null;
  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", minHeight:0, background:"#000000", borderLeft:`1px solid ${C.border}`, position:"relative", overflow:"hidden" }}>
      <div className="sentrix-sweep"/>
      <div style={{ flexShrink:0, padding:"14px 18px", borderBottom:`1px solid ${C.border}`, background:"linear-gradient(180deg, rgba(255,255,255,0.03), transparent)" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
          <div style={{ display:"flex", alignItems:"center", gap:7, fontFamily:MONO, fontSize:9.5, letterSpacing:"0.8px", color:C.textMuted, textTransform:"uppercase", minWidth:0 }}>
            <span style={{ color:C.text, fontWeight:600 }}>Sentrix</span>
            <span style={{ opacity:0.4 }}>›</span><span>{mLabel.toUpperCase()}</span>
            <span style={{ opacity:0.4 }}>›</span><span style={{ color:sup }}>SUPUESTO</span>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:4, flexShrink:0 }}>
            <IconBtn onClick={onToggleMax} title={maximized ? "Restaurar" : "Agrandar"}>{maximized ? <><polyline points="9 14 4 14 4 9"/><polyline points="15 10 20 10 20 15"/></> : <><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/></>}</IconBtn>
            <IconBtn onClick={onClose} title="Cerrar"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></IconBtn>
          </div>
        </div>
        <div style={{ fontSize:13, color:C.text, fontWeight:500, lineHeight:1.45 }}>
          <span style={{ color:C.textMuted }}>Proyección · </span>{mLabel} por {dLabel} · <b>dato real</b> vs <b style={{ color:sup }}>supuesto ({sgn(pct)}{pct}%)</b>.
        </div>
        <div style={{ fontSize:10.5, color:C.textMuted, fontFamily:MONO, marginTop:6 }}>Supuesto = Actual × {factor} · Impacto = Supuesto − Actual · sobre el dato real</div>
        <EvidenceClaimHeader evidenceSpec={evidence.evidenceSpec}/>
      </div>
      <div style={{ flex:1, overflowY:"auto", minHeight:0, padding:18, display:"flex", flexDirection:"column", gap:16 }}>
        {proj.length === 0 ? (
          <div style={{ fontSize:13, color:C.textSub, lineHeight:1.6 }}>Ese supuesto no está habilitado para esta métrica. Hoy puedo proyectar <b>ventas</b>, <b>contribución</b> o <b>capital</b> con un +/−X% sobre el dato real.</div>
        ) : (
          <div style={{ overflowX:"auto", minWidth:0 }}>
            {_qvm && (
              <div style={{ display:"inline-flex", alignItems:"center", gap:8, marginBottom:12, padding:"5px 11px", borderRadius:999, background:_qvm.bg, border:`1px solid ${_qvm.bd}` }}>
                <span style={{ fontSize:10.5, fontWeight:600, color:_qvm.fg, textTransform:"uppercase", letterSpacing:"0.5px" }}>{_qvm.label}</span>
                <span style={{ fontSize:11, color:C.textSub, fontFamily:MONO }}>{qv.crossLabel.toLowerCase()} {qv.blockValueFmt} vs {qv.declaredFmt}</span>
              </div>
            )}
            {con && (
              <div style={{ fontSize:12.5, color:C.text, lineHeight:1.5, marginBottom:14, paddingLeft:10, borderLeft:`2px solid ${sup}` }}>
                {con.concentrated
                  ? <>El impacto se concentra: <b style={{ color:sup }}>{con.blockCount} {plural} explican el {con.blockPct}%</b></>
                  : <>El impacto se reparte: hacen falta <b style={{ color:sup }}>{con.blockCount} de {con.n} {plural}</b> para llegar al 80%</>}
              </div>
            )}
            <table style={{ borderCollapse:"collapse", width:"100%", fontFamily:MONO, fontSize:12 }}>
              <thead>
                <tr style={{ color:C.textMuted, fontSize:9.5, letterSpacing:"0.6px", textTransform:"uppercase" }}>
                  <th style={{ textAlign:"left", padding:"0 10px 8px 0", borderBottom:`1px solid ${C.border}` }}>{dLabel}</th>
                  <th style={{ textAlign:"right", padding:"0 10px 8px", borderBottom:`1px solid ${C.border}` }}>Actual</th>
                  <th style={{ textAlign:"right", padding:"0 10px 8px", borderBottom:`1px solid ${C.border}`, color:sup }}>Supuesto</th>
                  <th style={{ textAlign:"right", padding:"0 10px 8px", borderBottom:`1px solid ${C.border}` }}>Impacto</th>
                  <th style={{ textAlign:"left", padding:"0 10px 8px", borderBottom:`1px solid ${C.border}` }}>Participación</th>
                  <th style={{ textAlign:"right", padding:"0 0 8px 10px", borderBottom:`1px solid ${C.border}` }}>Acum%</th>
                </tr>
              </thead>
              <tbody>
                {proj.flatMap((it, i) => {
                  const b = barByName[it.name] || { pct: 0, cumPct: 0, inBlock: false };
                  const inB = !!b.inBlock;
                  const bw = Math.max(3, Math.round((b.pct / (maxPct || 1)) * 54));
                  const showCut = con && con.concentrated && con.blockCount < proj.length && i === con.blockCount - 1;
                  return [
                    <tr key={i} style={{ background: inB ? "rgba(95,201,214,0.06)" : "transparent" }}>
                      <td style={{ ...cell, padding:"7px 10px 7px 0", textAlign:"left", fontFamily:"'DM Sans', system-ui, sans-serif", color: inB ? C.text : C.textSub, boxShadow: inB ? `inset 2px 0 0 ${sup}` : "none" }}>{it.name}</td>
                      <td style={{ ...cell, textAlign:"right", color:C.text }}>{it.aFmt}</td>
                      <td title={it.formula} style={{ ...cell, textAlign:"right", color:sup, cursor:"help" }}>{it.sFmt}</td>
                      <td style={{ ...cell, textAlign:"right", color: it.delta >= 0 ? C.green : C.amber }}>{sgn(it.delta)}{it.dFmt}</td>
                      <td style={{ ...cell, textAlign:"left", whiteSpace:"nowrap" }}>
                        <span style={{ color: inB ? C.text : C.textMuted }}>{Math.round(b.pct)}%</span>
                        <span style={{ display:"inline-block", height:6, borderRadius:2, background: inB ? sup : C.textMuted, opacity: inB ? 0.9 : 0.45, width:bw, marginLeft:7, verticalAlign:"middle" }}/>
                      </td>
                      <td style={{ ...cell, padding:"7px 0 7px 10px", textAlign:"right", color: inB ? C.text : C.textMuted }}>{Math.round(b.cumPct)}%</td>
                    </tr>,
                    showCut && (
                      <tr key={`${i}-cut`}><td colSpan={6} style={{ borderTop:`1px dashed ${C.amber}`, padding:"3px 0" }}>
                        <span style={{ fontSize:9.5, color:C.amber, textTransform:"uppercase", letterSpacing:"0.6px" }}>corte 80% — el bloque que explica el impacto</span>
                      </td></tr>
                    ),
                  ].filter(Boolean);
                })}
              </tbody>
              {tot && (
                <tfoot><tr style={{ fontWeight:700 }}>
                  <td style={{ padding:"9px 10px 0 0", textAlign:"left", fontFamily:"'DM Sans', system-ui, sans-serif", color:C.text }}>Total</td>
                  <td style={{ padding:"9px 10px 0", textAlign:"right", fontVariantNumeric:"tabular-nums", color:C.text }}>{tot.aFmt}</td>
                  <td style={{ padding:"9px 10px 0", textAlign:"right", fontVariantNumeric:"tabular-nums", color:sup }}>{tot.sFmt}</td>
                  <td style={{ padding:"9px 10px 0", textAlign:"right", fontVariantNumeric:"tabular-nums", color: tot.delta >= 0 ? C.green : C.amber }}>{sgn(tot.delta)}{tot.dFmt}</td>
                  <td style={{ padding:"9px 10px 0" }}/>
                  <td style={{ padding:"9px 0 0 10px", textAlign:"right", color:C.textMuted }}>100%</td>
                </tr></tfoot>
              )}
            </table>
            <div style={{ fontSize:10.5, color:C.textMuted, marginTop:14, lineHeight:1.5 }}>Participación = peso de cada {dLabel} en el impacto · Acum% = acumulado (corte al 80%). Actual es dato real; el Supuesto es una proyección, no un dato observado. Hover en <span style={{ color:sup }}>Supuesto</span> para la fórmula.</div>
          </div>
        )}
        <EvidenceConfidenceFooter evidenceSpec={evidence.evidenceSpec}/>
      </div>
    </div>
  );
}

// ── SIMULACIÓN · ruta ORÁCULO (simulateGeneral) · UNA entidad, supuesto de precio+volumen (owner 2026-07-31,
// hallazgo revisor UX/auditor: sin este panel, el botón "Ver la proyección en Sentrix" no tenía forma de abrir
// nada para las simulaciones que corren por el oráculo — shape distinto al SimulationPanel de arriba (que espera
// un desglose por-entidad de UN eje completo, `evidence.transform`/`.projection`; acá es antes/después de UNA
// entidad puntual). Todo lo que muestra ya viene formateado y AUTORIZADO en `evidence` (facts de simulateGeneral,
// mergeados por buildOracleEvidence) — cero recálculo, misma cuenta que ADI narró este turno.
function SimulationPanelOracle({ evidence, onClose, onToggleMax, maximized }) {
  const entidad = evidence.entidad || "la entidad";
  const dp = evidence.deltaPrecio, dv = evidence.deltaVolumen;
  const sgn = (v) => (typeof v === "number" && v >= 0 ? "+" : "");
  const sup = C.celeste;
  const rows = [
    { label: "Ventas", actual: evidence.ventaActual, nuevo: evidence.ventaNueva },
    ...(evidence.costModelAutorizado ? [
      { label: "Costo", actual: evidence.costoActual, nuevo: evidence.costoNuevo },
      { label: "Contribución", actual: evidence.contribucionActual, nuevo: evidence.contribucionNueva },
      { label: "Margen", actual: evidence.margenActual, nuevo: evidence.margenNuevo },
    ] : []),
  ].filter((r) => r.actual != null && r.nuevo != null);
  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", minHeight:0, background:"#000000", borderLeft:`1px solid ${C.border}`, position:"relative", overflow:"hidden" }}>
      <div className="sentrix-sweep"/>
      <div style={{ flexShrink:0, padding:"14px 18px", borderBottom:`1px solid ${C.border}`, background:"linear-gradient(180deg, rgba(255,255,255,0.03), transparent)" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
          <div style={{ display:"flex", alignItems:"center", gap:7, fontFamily:MONO, fontSize:9.5, letterSpacing:"0.8px", color:C.textMuted, textTransform:"uppercase", minWidth:0 }}>
            <span style={{ color:C.text, fontWeight:600 }}>Sentrix</span><span style={{ opacity:0.4 }}>›</span><span style={{ color:sup }}>SUPUESTO</span>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:4, flexShrink:0 }}>
            <IconBtn onClick={onToggleMax} title={maximized ? "Restaurar" : "Agrandar"}>{maximized ? <><polyline points="9 14 4 14 4 9"/><polyline points="15 10 20 10 20 15"/></> : <><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/></>}</IconBtn>
            <IconBtn onClick={onClose} title="Cerrar"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></IconBtn>
          </div>
        </div>
        <div style={{ fontSize:13, color:C.text, fontWeight:500, lineHeight:1.45 }}>
          <span style={{ color:C.textMuted }}>Proyección · </span>{entidad} · precio <b style={{ color:sup }}>{sgn(dp)}{dp}%</b> · volumen <b style={{ color:sup }}>{sgn(dv)}{dv}%</b>
        </div>
        <EvidenceClaimHeader evidenceSpec={evidence.evidenceSpec}/>
      </div>
      <div style={{ flex:1, overflowY:"auto", minHeight:0, padding:18, display:"flex", flexDirection:"column", gap:16 }}>
        <Card>
          <Eyebrow>Actual → supuesto</Eyebrow>
          <div style={{ display:"flex", flexDirection:"column", marginTop:2 }}>
            {rows.map((r, i) => (
              <div key={i} style={{ display:"flex", alignItems:"baseline", justifyContent:"space-between", gap:14, padding:"11px 0", borderTop: i > 0 ? "1px solid rgba(255,255,255,0.035)" : "none" }}>
                <span style={{ fontSize:13, color:C.textSub, fontWeight:500 }}>{r.label}</span>
                <div style={{ display:"flex", alignItems:"baseline", gap:10 }}>
                  <Num color={C.textMuted}>{r.actual}</Num>
                  <span style={{ color:C.textMuted, fontSize:12 }}>→</span>
                  <Num color={sup}>{r.nuevo}</Num>
                </div>
              </div>
            ))}
          </div>
          {!evidence.costModelAutorizado && (
            <div style={{ fontSize:11.5, color:C.textMuted, marginTop:12, lineHeight:1.5 }}>Costo/contribución/margen no proyectados — el tenant no declaró cómo se comporta su costo bajo este supuesto (solo ventas queda autorizado).</div>
          )}
        </Card>
        <EvidenceConfidenceFooter evidenceSpec={evidence.evidenceSpec}/>
      </div>
    </div>
  );
}

// ── DIAGNÓSTICO · los FOCOS de dónde se va/inmoviliza plata (evidence.findings) · la evidencia de LO QUE ADI DICE en el
// texto (contribución no capturada · carga · capital dormido), no una grilla genérica. Portfolio-wide → no es el shell de
// lentes (que es por foco de UNA entidad) · panel propio. Owner 2026-07-06: la evidencia de Sentrix = la del texto. ──────
// pregunta que abre cada fila del diagnóstico (B.2 · por detector · la que la narración misma sugiere)
const _DIAG_ASK = {
  margen:  (e) => `¿Por qué ${e} cede margen?`,
  carga:   (e) => `¿Cómo recupero la carga de ${e}?`,
  capital: (e) => `Profundiza en ${e}`,
};
function DiagnosePanel({ evidence, onClose, onToggleMax, maximized, onAsk = null }) {
  const foci = (evidence && evidence.findings) || [];
  const nm = _named(evidence);   // espejo (B.1): lo que ADI nombró con cifra propia
  const _fm = (v) => { const a = Math.abs(v), s = v < 0 ? "-" : ""; if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(1)}M`; if (a >= 1e3) return `${s}$${Math.round(a / 1e3)}K`; return `${s}$${Math.round(a)}`; };
  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", minHeight:0, background:"#000000", borderLeft:`1px solid ${C.border}`, position:"relative", overflow:"hidden" }}>
      <div className="sentrix-sweep"/>
      <div style={{ flexShrink:0, padding:"14px 18px", borderBottom:`1px solid ${C.border}`, background:"linear-gradient(180deg, rgba(255,255,255,0.03), transparent)" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
          <div style={{ display:"flex", alignItems:"center", gap:7, fontFamily:MONO, fontSize:9.5, letterSpacing:"0.8px", color:C.textMuted, textTransform:"uppercase", minWidth:0 }}>
            <span style={{ color:C.text, fontWeight:600 }}>Sentrix</span><span style={{ opacity:0.4 }}>›</span><span>DIAGNÓSTICO</span>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:4, flexShrink:0 }}>
            <IconBtn onClick={onToggleMax} title={maximized ? "Restaurar" : "Agrandar"}>{maximized ? <><polyline points="9 14 4 14 4 9"/><polyline points="15 10 20 10 20 15"/></> : <><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/></>}</IconBtn>
            <IconBtn onClick={onClose} title="Cerrar"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></IconBtn>
          </div>
        </div>
        <div style={{ fontSize:13, color:C.text, fontWeight:500, lineHeight:1.45 }}>
          <span style={{ color:C.textMuted }}>Diagnóstico · </span>dónde se pierde margen o se inmoviliza capital — los focos ordenados por impacto.
        </div>
        <EvidenceClaimHeader evidenceSpec={evidence.evidenceSpec}/>
      </div>
      <div style={{ flex:1, overflowY:"auto", minHeight:0, padding:18, display:"flex", flexDirection:"column", gap:12 }}>
        {foci.length === 0 ? (
          <div style={{ fontSize:13, color:C.textSub, lineHeight:1.6 }}>No encontré focos materiales en el dato actual.</div>
        ) : (<>
          {foci.map((f, i) => (
            <div key={i} style={{ border:`1px solid ${C.border}`, borderRadius:12, padding:"13px 15px", background:"rgba(255,255,255,0.02)" }}>
              <div style={{ display:"flex", alignItems:"baseline", justifyContent:"space-between", gap:10, marginBottom:9 }}>
                <span style={{ fontSize:13, color:C.text, fontWeight:600 }}>{f.titulo}</span>
                <span style={{ fontFamily:MONO, fontSize:14, color:C.amber, fontWeight:600, whiteSpace:"nowrap", fontVariantNumeric:"tabular-nums" }}>{_fm(f.subtotal_usd)}</span>
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
                {(f.items || []).slice(0, 4).map((it, j) => { const named = nm(it.entidad); const q = (_DIAG_ASK[f.detector] || _DIAG_ASK.margen)(it.entidad); return (
                  <AskRow key={j} onAsk={onAsk} q={q} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:10, fontSize:12 }}>
                    <span style={{ display:"flex", alignItems:"center", gap:5, minWidth:0 }}>{named ? <NamedDot/> : null}<span style={{ color: named ? C.text : C.textSub, fontWeight: named ? 600 : 400, fontFamily:"'DM Sans', system-ui, sans-serif", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{it.entidad}</span></span>
                    <span style={{ fontFamily:MONO, color:C.text, fontVariantNumeric:"tabular-nums" }}>{_fm(it.usd)}</span>
                  </AskRow>
                ); })}
              </div>
            </div>
          ))}
          <div style={{ fontSize:10.5, color:C.textMuted, marginTop:2, lineHeight:1.5 }}>Cada foco es margen que no se captura (contribución, carga) o capital que se inmoviliza (inventario). {MIRROR_LEGEND}{onAsk ? ` ${ASK_LEGEND}` : ""} Cifras de dato real de tu cartera.</div>
        </>)}
        <EvidenceConfidenceFooter evidenceSpec={evidence.evidenceSpec}/>
      </div>
    </div>
  );
}

// ComparePanel · evidencia de COMPARACIÓN lado a lado (A vs B) · lo que ADI afirma en el texto ("factura más pero capta
// mejor margen") queda PROBADO acá: métrica por métrica, ganador resaltado, gap principal, lectura escala-vs-calidad.
function ComparePanel({ evidence, onClose, onToggleMax, maximized }) {
  const a = evidence.compareA || evidence.entidad || "A";
  const b = evidence.compareB || evidence.entityB || "B";
  const pairs = (evidence && evidence.pairs) || [];
  const lowerBetter = (p) => /low|menor|down|inv|neg|cost|carga/i.test(String(p || ""));
  const winner = (pr) => {
    if (typeof pr.aVal !== "number" || typeof pr.bVal !== "number" || pr.aVal === pr.bVal) return null;
    return (lowerBetter(pr.polarity) ? pr.aVal < pr.bVal : pr.aVal > pr.bVal) ? "a" : "b";
  };
  let gapIdx = -1, gapMax = -1;
  pairs.forEach((pr, i) => {
    if (typeof pr.aVal === "number" && typeof pr.bVal === "number") {
      const den = Math.max(Math.abs(pr.aVal), Math.abs(pr.bVal)) || 1;
      const rel = Math.abs(pr.aVal - pr.bVal) / den;
      if (rel > gapMax) { gapMax = rel; gapIdx = i; }
    }
  });
  const byLabel = (rx) => pairs.find((pr) => rx.test(pr.label));
  const ventas = byLabel(/venta|participaci/i), margen = byLabel(/margen/i);
  const num = (pr) => pr && typeof pr.aVal === "number" && typeof pr.bVal === "number";
  const escala = num(ventas) ? (ventas.aVal >= ventas.bVal ? a : b) : null;
  const calidad = num(margen) ? (margen.aVal >= margen.bVal ? a : b) : null;
  const reading = (escala && calidad)
    ? (escala === calidad ? `${escala} gana en escala y en calidad de margen — domina en ambos frentes.` : `${escala} gana escala (más volumen); ${calidad} captura mejor margen. Ahí está la decisión: escala vs. calidad.`)
    : null;
  const cell = (val, side, pr) => { const w = winner(pr), on = w === side; return <span style={{ fontFamily:MONO, fontSize:13, fontVariantNumeric:"tabular-nums", color: w ? (on ? C.green : C.textMuted) : C.text, fontWeight: on ? 700 : 500 }}>{val}</span>; };
  const head = { fontFamily:MONO, fontSize:9.5, letterSpacing:"0.5px", color:C.text, textTransform:"uppercase" };
  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", minHeight:0, background:"#000000", borderLeft:`1px solid ${C.border}`, position:"relative", overflow:"hidden" }}>
      <div className="sentrix-sweep"/>
      <div style={{ flexShrink:0, padding:"14px 18px", borderBottom:`1px solid ${C.border}`, background:"linear-gradient(180deg, rgba(255,255,255,0.03), transparent)" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
          <div style={{ display:"flex", alignItems:"center", gap:7, fontFamily:MONO, fontSize:9.5, letterSpacing:"0.8px", color:C.textMuted, textTransform:"uppercase", minWidth:0 }}>
            <span style={{ color:C.text, fontWeight:600 }}>Sentrix</span><span style={{ opacity:0.4 }}>›</span><span>COMPARACIÓN</span>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:4, flexShrink:0 }}>
            <IconBtn onClick={onToggleMax} title={maximized ? "Restaurar" : "Agrandar"}>{maximized ? <><polyline points="9 14 4 14 4 9"/><polyline points="15 10 20 10 20 15"/></> : <><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/></>}</IconBtn>
            <IconBtn onClick={onClose} title="Cerrar"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></IconBtn>
          </div>
        </div>
        <div style={{ fontSize:13, color:C.text, fontWeight:500, lineHeight:1.45 }}>
          <span style={{ color:C.textMuted }}>Comparación · </span><b>{a}</b> vs <b>{b}</b> — dónde gana escala y dónde gana calidad.
        </div>
      </div>
      <div style={{ flex:1, overflowY:"auto", minHeight:0, padding:18, display:"flex", flexDirection:"column", gap:0 }}>
        <div style={{ display:"grid", gridTemplateColumns:"1fr auto auto", gap:"0 22px", alignItems:"center" }}>
          <div style={head}></div><div style={{ ...head, textAlign:"right" }}>{a}</div><div style={{ ...head, textAlign:"right" }}>{b}</div>
          {pairs.map((pr, i) => (
            <React.Fragment key={i}>
              <div style={{ gridColumn:"1 / -1", height:1, background: i === 0 ? "transparent" : "rgba(255,255,255,0.05)" }}/>
              <div style={{ padding:"9px 0", display:"flex", alignItems:"center", gap:7 }}>
                <span style={{ fontSize:12.5, color:C.textSub }}>{pr.label}</span>
                {i === gapIdx && <span style={{ fontFamily:MONO, fontSize:8.5, letterSpacing:"0.5px", color:C.amber, border:`1px solid ${C.amber}`, borderRadius:4, padding:"1px 4px", textTransform:"uppercase", opacity:0.9 }}>gap</span>}
              </div>
              <div style={{ padding:"9px 0", textAlign:"right" }}>{cell(pr.aFmt, "a", pr)}</div>
              <div style={{ padding:"9px 0", textAlign:"right" }}>{cell(pr.bFmt, "b", pr)}</div>
            </React.Fragment>
          ))}
        </div>
        {reading && <div style={{ marginTop:16, padding:"12px 14px", border:`1px solid ${C.border}`, borderRadius:10, background:"rgba(255,255,255,0.02)", fontSize:12.5, color:C.text, lineHeight:1.55 }}>{reading}</div>}
        <div style={{ fontSize:10.5, color:C.textMuted, marginTop:12, lineHeight:1.5 }}>Verde = quién gana cada métrica (mayor es mejor · en carga, menor). "Gap" = la diferencia más grande. Cifras de dato real de tu cartera.</div>
        {/* EL COMPARADO TEMPORAL (PASE 1f · owner 2026-07-15: el "Perfil comparado" por ejes se ELIMINA): los MISMOS
            DOS lado a lado en el año — la tabla prueba, la trayectoria cuenta. Sin botón de re-preguntar (ya estamos
            EN la comparación). */}
        {(() => {
          const dim = ({ client: "cliente", cliente: "cliente", clientes: "cliente", marca: "marca", bodega: "bodega", sucursal: "bodega", sku: "sku" })[String(evidence.entityType || "cliente").toLowerCase()] || "cliente";
          if (!CUADRO_DIMS.some((d) => d.key === dim)) return null;
          const cm = buildCuadroMando(dim, evidence.periodo);
          const rowA = cm.rows.find((r) => r.name === a), rowB = cm.rows.find((r) => r.name === b);
          if (!rowA || !rowB) return null;
          return <div style={{ marginTop: 14 }}><ComparadoCard a={a} rowA={rowA} b={b} rowB={rowB} dim={dim} onAsk={null}/></div>;
        })()}
      </div>
    </div>
  );
}

// ContribucionPanel · FOCO CONTRIBUCIÓN (owner 2026-07-06) · pareto (quién sostiene · 80/20 con acumulado) · gap
// (contribución no capturada · plata sobre la mesa) · rank (top por contribución). Respalda el texto de ADI.
// ── ESPEJO Sentrix↔ADI (Frente B · owner 2026-07-07): el panel pinta EXACTAMENTE lo que ADI nombró, no solo el dominio ──
// _named(evidence) → predicado por nombre (la boleta = la fuente de verdad de lo dicho) · NamedDot = el punto celeste sobre
// la fila nombrada · ScopeChip = el alcance heredado de un "de esos…" (evidence.scopedInherited, lo setea el seam).
const _named = (evidence) => { const bol = (evidence && evidence.boleta) || []; return (nombre) => isNamedInBoleta(bol, nombre); };
const NamedDot = () => <span title="ADI lo nombró en su respuesta" style={{ width:5, height:5, borderRadius:"50%", background:C.celeste, flexShrink:0, boxShadow:"0 0 5px rgba(47,184,218,0.8)" }}/>;
const ScopeChip = ({ evidence }) => (evidence && evidence.scopedInherited)
  ? <span style={{ fontFamily:MONO, fontSize:9, letterSpacing:"0.4px", color:C.celeste, border:"1px solid rgba(47,184,218,0.35)", borderRadius:5, padding:"2px 6px", whiteSpace:"nowrap", flexShrink:0 }}>los que veníamos mirando</span>
  : null;
const MIRROR_LEGEND = "El punto celeste marca lo que ADI nombró en su respuesta.";
// B.2 · BIDIRECCIONAL (la mesa habla): click en una fila = pre-cargar la pregunta sobre ESA entidad en el input de ADI.
// Prefill + focus (el usuario confirma con Enter — cero gasto por misclick). Sin onAsk (contexto viejo), la fila es estática.
const ASK_LEGEND = "Click en una fila para preguntarle a ADI por esa cuenta.";
const AskRow = ({ onAsk, q, style, children }) => (
  <div style={{ ...style, ...(onAsk ? { cursor: "pointer", borderRadius: 6, margin: "0 -6px", padding: "3px 6px" } : {}) }}
    title={onAsk ? `Pregúntale a ADI: ${q}` : undefined}
    onClick={onAsk ? () => onAsk(q) : undefined}
    onMouseEnter={onAsk ? (e) => { e.currentTarget.style.background = "rgba(47,184,218,0.07)"; } : undefined}
    onMouseLeave={onAsk ? (e) => { e.currentTarget.style.background = "transparent"; } : undefined}>
    {children}
  </div>
);

// ── CriteriaPanel · "Lo que sé de tu negocio" (C.2 · owner 2026-07-07): la memoria de criterio VISIBLE y borrable por
// ítem. El borrar reusa el plumbing bidireccional (onAsk precarga "olvidá el …" — el usuario confirma con Enter: la
// memoria solo cambia por la conversación, una sola vía de mutación). ──
function CriteriaPanel({ evidence, onClose, onToggleMax, maximized, onAsk = null }) {
  const list = (evidence && evidence.criteriaList) || [];
  const pnl = (evidence && evidence.pnlList) || [];   // P&L COMERCIAL · las líneas de gasto declaradas (misma memoria C.2)
  const head = { fontFamily: MONO, fontSize: 9.5, letterSpacing: "0.5px", color: C.text, textTransform: "uppercase" };
  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", minHeight:0, background:"#000000", borderLeft:`1px solid ${C.border}`, position:"relative", overflow:"hidden" }}>
      <div className="sentrix-sweep"/>
      <div style={{ flexShrink:0, padding:"14px 18px", borderBottom:`1px solid ${C.border}`, background:"linear-gradient(180deg, rgba(255,255,255,0.03), transparent)" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
          <div style={{ display:"flex", alignItems:"center", gap:7, fontFamily:MONO, fontSize:9.5, letterSpacing:"0.8px", color:C.textMuted, textTransform:"uppercase", minWidth:0 }}>
            <span style={{ color:C.text, fontWeight:600 }}>Sentrix</span><span style={{ opacity:0.4 }}>›</span><span>TU CRITERIO</span>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:4, flexShrink:0 }}>
            <IconBtn onClick={onToggleMax} title={maximized ? "Restaurar" : "Agrandar"}>{maximized ? <><polyline points="9 14 4 14 4 9"/><polyline points="15 10 20 10 20 15"/></> : <><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/></>}</IconBtn>
            <IconBtn onClick={onClose} title="Cerrar"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></IconBtn>
          </div>
        </div>
        <div style={{ fontSize:13, color:C.text, fontWeight:500 }}>Lo que sé de tu negocio</div>
      </div>
      <div style={{ flex:1, overflowY:"auto", minHeight:0, padding:18 }}>
        {list.length === 0 && pnl.length === 0 ? (
          <div style={{ fontSize:12.5, color:C.textSub, lineHeight:1.6 }}>Todavía no guardé ningún criterio tuyo — mido con los estándares. Puedes fijar tu benchmark desde el chat: <span style={{ color:C.celeste }}>"recuerda que mi margen mínimo es 28%"</span> — o armar tu P&L comercial: <span style={{ color:C.celeste }}>"armemos mi P&L"</span>.</div>
        ) : list.length === 0 ? null : (
          <div style={{ display:"flex", flexDirection:"column", gap:9 }}>
            <div style={{ ...head, marginBottom:2 }}>Tus benchmarks · reemplazan al estándar en TODAS las lecturas</div>
            {list.map((c, i) => (
              <div key={i} style={{ display:"flex", alignItems:"center", gap:10, padding:"11px 13px", border:`1px solid rgba(47,184,218,0.25)`, borderRadius:10, background:"rgba(47,184,218,0.04)" }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:12.5, color:C.text, fontWeight:600 }}>{c.label}</div>
                  <div style={{ fontSize:11, color:C.textMuted, marginTop:2 }}>estándar: {c.standard}</div>
                </div>
                <div style={{ fontFamily:MONO, fontSize:15, color:C.celeste, fontWeight:700, whiteSpace:"nowrap" }}>{c.valueFmt}</div>
                {onAsk ? (
                  <button onClick={() => onAsk(`Olvida el ${c.label.toLowerCase()}`)} title={`Pregúntale a ADI: Olvida el ${c.label.toLowerCase()}`}
                    style={{ padding:"5px 9px", borderRadius:7, border:`1px solid ${C.border}`, background:"transparent", color:C.textMuted, fontSize:11, cursor:"pointer", flexShrink:0 }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = "#f87171"; e.currentTarget.style.borderColor = "rgba(248,113,113,0.4)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = C.textMuted; e.currentTarget.style.borderColor = C.border; }}>olvidar</button>
                ) : null}
              </div>
            ))}
          </div>
        )}
        {/* P&L COMERCIAL (owner 2026-07-15) · las líneas de gasto declaradas — misma memoria, mismo panel. El botón
            precarga el pedido en el chat (una sola vía de mutación: la conversación · el usuario confirma con Enter). */}
        {pnl.length > 0 && (
          <div style={{ display:"flex", flexDirection:"column", gap:9, marginTop: list.length ? 16 : 0 }}>
            <div style={{ ...head, marginBottom:2, display:"flex", alignItems:"center", gap:4 }}>Tu P&L comercial · gastos declarados sobre la venta<InfoDot def={"Tus líneas de gasto, con el % que les asignaste sobre la venta. Son supuestos declarados por ti (no dato contable): la cara Resultado de la Mesa las resta después de la contribución para llegar al resultado comercial. Cuando entre la contabilidad real, cada línea se reemplaza por su dato, línea a línea. Edita conversando: \"cambia una línea a otro %\", \"saca una línea\", \"agrega otra con su %\"."} align="left"/></div>
            {pnl.map((l, i) => (
              <div key={i} style={{ display:"flex", alignItems:"center", gap:10, padding:"11px 13px", border:`1px dashed rgba(217,154,90,0.45)`, borderRadius:10, background:"rgba(217,154,90,0.04)" }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:12.5, color:C.text, fontWeight:600 }}>{l.nombre}</div>
                  <div style={{ fontSize:11, color:C.textMuted, marginTop:2 }}>supuesto declarado · % sobre la venta</div>
                </div>
                <div style={{ fontFamily:MONO, fontSize:15, color:C.amber, fontWeight:700, whiteSpace:"nowrap" }}>{l.pct}%</div>
                {onAsk ? (
                  <button onClick={() => onAsk(`Saca ${l.nombre.toLowerCase()} del P&L`)} title={`Pregúntale a ADI: Saca ${l.nombre.toLowerCase()} del P&L`}
                    style={{ padding:"5px 9px", borderRadius:7, border:`1px solid ${C.border}`, background:"transparent", color:C.textMuted, fontSize:11, cursor:"pointer", flexShrink:0 }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = "#f87171"; e.currentTarget.style.borderColor = "rgba(248,113,113,0.4)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = C.textMuted; e.currentTarget.style.borderColor = C.border; }}>sacar</button>
                ) : null}
              </div>
            ))}
          </div>
        )}
        <div style={{ fontSize:10.5, color:C.textMuted, lineHeight:1.5, marginTop:14 }}>Tu criterio vive solo en este navegador (no sale de tu máquina). "Olvidar" precarga el pedido en el chat — tú confirmas con Enter. También puedes preguntar "¿qué recuerdas?" cuando quieras.</div>
      </div>
    </div>
  );
}

function ContribucionPanel({ evidence, onClose, onToggleMax, maximized, onAsk = null }) {
  const p = (evidence && evidence.contribucion && evidence.contribucion.panel) || {};
  const kind = p.kind, rows = p.rows || [];
  const head = { fontFamily: MONO, fontSize: 9.5, letterSpacing: "0.5px", color: C.text, textTransform: "uppercase" };
  const p1 = (v) => (Math.round(v * 10) / 10).toFixed(1);
  const maxV = Math.max(1, ...rows.map((r) => Math.abs(r.val != null ? r.val : (r.part || 0))));
  const nm = _named(evidence);   // espejo: lo que ADI nombró
  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", minHeight:0, background:"#000000", borderLeft:`1px solid ${C.border}`, position:"relative", overflow:"hidden" }}>
      <div className="sentrix-sweep"/>
      <div style={{ flexShrink:0, padding:"14px 18px", borderBottom:`1px solid ${C.border}`, background:"linear-gradient(180deg, rgba(255,255,255,0.03), transparent)" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
          <div style={{ display:"flex", alignItems:"center", gap:7, fontFamily:MONO, fontSize:9.5, letterSpacing:"0.8px", color:C.textMuted, textTransform:"uppercase", minWidth:0 }}>
            <span style={{ color:C.text, fontWeight:600 }}>Sentrix</span><span style={{ opacity:0.4 }}>›</span><span>CONTRIBUCIÓN</span>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:4, flexShrink:0 }}>
            <IconBtn onClick={onToggleMax} title={maximized ? "Restaurar" : "Agrandar"}>{maximized ? <><polyline points="9 14 4 14 4 9"/><polyline points="15 10 20 10 20 15"/></> : <><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/></>}</IconBtn>
            <IconBtn onClick={onClose} title="Cerrar"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></IconBtn>
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"baseline", justifyContent:"space-between", gap:10 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, minWidth:0 }}><div style={{ fontSize:13, color:C.text, fontWeight:500 }}>{p.title || "Contribución"}</div><ScopeChip evidence={evidence}/></div>
          {kind === "pareto" ? <div style={{ fontFamily:MONO, fontSize:12, color:C.textMuted, whiteSpace:"nowrap" }}><Num color={C.green}>{p1(p.totalPct)}%</Num> en {p.cutoff}/{p.of}</div>
            : p.headline ? <div style={{ fontFamily:MONO, fontSize:16, color:C.amber, fontWeight:700, whiteSpace:"nowrap" }}>{p.headline}</div> : null}
        </div>
      </div>
      <div style={{ flex:1, overflowY:"auto", minHeight:0, padding:18 }}>
        {kind === "pareto" && (
          <div>
            <div style={{ ...head, marginBottom:11, display:"flex", justifyContent:"space-between" }}><span>Contribución acumulada</span><span style={{ textTransform:"none", letterSpacing:0, color:C.green }}>corte 80%</span></div>
            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              {/* títulos de columna (owner 2026-07-09: el usuario no sabe de qué son los números) */}
              <div style={{ display:"flex", alignItems:"center", gap:9 }}>
                <span style={{ width:118, flexShrink:0 }}/>
                <div style={{ flex:1 }}/>
                <span style={{ fontFamily:MONO, fontSize:9, letterSpacing:"0.5px", color:C.textMuted, textTransform:"uppercase", width:52, textAlign:"right", flexShrink:0 }}>Contrib.</span>
                <span style={{ fontFamily:MONO, fontSize:9, letterSpacing:"0.5px", color:C.textMuted, textTransform:"uppercase", width:42, textAlign:"right", flexShrink:0 }}>Acum</span>
              </div>
              {rows.map((r, i) => { const inTop = i < p.cutoff; const named = nm(r.nombre); return (
                <AskRow key={i} onAsk={onAsk} q={`¿De dónde saca ${r.nombre} su contribución?`} style={{ display:"flex", alignItems:"center", gap:9 }}>
                  <span style={{ display:"flex", alignItems:"center", gap:5, width:118, flexShrink:0, minWidth:0 }}>{named ? <NamedDot/> : null}<span style={{ fontSize:12, color: named ? C.text : inTop ? C.textSub : C.textMuted, fontWeight: named ? 600 : 400, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{r.nombre}</span></span>
                  <div style={{ flex:1, height:8, background:"rgba(255,255,255,0.05)", borderRadius:4, overflow:"hidden" }}>
                    <div style={{ width:`${Math.max(2, r.part / maxV * 100)}%`, height:"100%", background: inTop ? C.blue : "rgba(255,255,255,0.2)", opacity:0.85 }}/>
                  </div>
                  <span style={{ fontFamily:MONO, fontSize:11.5, color: inTop ? C.text : C.textMuted, width:52, textAlign:"right", flexShrink:0 }}>{r.valFmt}</span>
                  <span style={{ fontFamily:MONO, fontSize:10.5, color: r.acum <= 80 ? C.green : C.textMuted, width:42, textAlign:"right", flexShrink:0 }}>{p1(r.acum)}%</span>
                </AskRow>
              ); })}
            </div>
            <div style={{ fontSize:10.5, color:C.textMuted, lineHeight:1.5, marginTop:11 }}>Azul = las cuentas que hacen el 80% de tu contribución (las de arriba del corte). La última columna es el acumulado. {MIRROR_LEGEND}{onAsk ? ` ${ASK_LEGEND}` : ""} Cifras de dato real.</div>
          </div>
        )}
        {(kind === "gap" || kind === "rank") && (
          <div>
            <div style={{ ...head, marginBottom:11 }}>{kind === "gap" ? "Valor sobre la mesa, por cliente" : "Contribución, por cuenta"}</div>
            <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
              {rows.map((r, i) => { const named = nm(r.nombre); return (
                <AskRow key={i} onAsk={onAsk} q={`¿De dónde saca ${r.nombre} su contribución?`} style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <span style={{ display:"flex", alignItems:"center", gap:5, width:118, flexShrink:0, minWidth:0 }}>{named ? <NamedDot/> : null}<span style={{ fontSize:12, color: (r.hi || named) ? C.text : C.textSub, fontWeight: (r.hi || named) ? 600 : 400, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{r.nombre}</span></span>
                  <div style={{ flex:1, height:9, background:"rgba(255,255,255,0.05)", borderRadius:4, overflow:"hidden" }}>
                    <div style={{ width:`${Math.max(2, Math.abs(r.val || 0) / maxV * 100)}%`, height:"100%", background: kind === "gap" ? C.amber : (r.hi ? C.violet : C.blue), opacity:0.85 }}/>
                  </div>
                  <span style={{ fontFamily:MONO, fontSize:12, color:C.text, fontVariantNumeric:"tabular-nums", width:60, textAlign:"right", flexShrink:0 }}>{r.valFmt}</span>
                  {r.sub ? <span style={{ fontFamily:MONO, fontSize:10.5, color:C.textMuted, width:42, textAlign:"right", flexShrink:0 }}>{r.sub}</span> : null}
                </AskRow>
              ); })}
            </div>
            <div style={{ fontSize:10.5, color:C.textMuted, lineHeight:1.5, marginTop:10 }}>{kind === "gap" ? `Ámbar = contribución no capturada (si el margen llegara al benchmark). ${MIRROR_LEGEND}${onAsk ? ` ${ASK_LEGEND}` : ""} Cifras de dato real.` : `Contribución en $ por cuenta, ordenada. ${MIRROR_LEGEND}${onAsk ? ` ${ASK_LEGEND}` : ""} Cifras de dato real.`}</div>
          </div>
        )}
      </div>
    </div>
  );
}

// VentasPanel · FOCO VENTAS (owner 2026-07-06) · se adapta al foco: movers (quién tracciona/resta vs plan o YoY) ·
// decomp (el crecimiento partido en volumen vs precio · el separador ADI-vs-BI) · mix (participación de familias) ·
// rank (SKU por venta). Respalda el texto de ADI. Los $ ya vienen formateados (valFmt) desde el composer (escala ×1000).
function VentasPanel({ evidence, onClose, onToggleMax, maximized, onAsk = null }) {
  const p = (evidence && evidence.ventas && evidence.ventas.panel) || {};
  const kind = p.kind, rows = p.rows || [];
  const head = { fontFamily: MONO, fontSize: 9.5, letterSpacing: "0.5px", color: C.text, textTransform: "uppercase" };
  const p1 = (v) => (Math.round(v * 10) / 10).toFixed(1);
  const maxAbs = Math.max(1, ...rows.map((r) => Math.abs(r.val || 0)));
  const nm = _named(evidence);   // espejo: lo que ADI nombró
  const hl = p.headline || "";
  const hlColor = hl.startsWith("-") ? C.red : hl.startsWith("+") ? C.green : C.text;
  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", minHeight:0, background:"#000000", borderLeft:`1px solid ${C.border}`, position:"relative", overflow:"hidden" }}>
      <div className="sentrix-sweep"/>
      <div style={{ flexShrink:0, padding:"14px 18px", borderBottom:`1px solid ${C.border}`, background:"linear-gradient(180deg, rgba(255,255,255,0.03), transparent)" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
          <div style={{ display:"flex", alignItems:"center", gap:7, fontFamily:MONO, fontSize:9.5, letterSpacing:"0.8px", color:C.textMuted, textTransform:"uppercase", minWidth:0 }}>
            <span style={{ color:C.text, fontWeight:600 }}>Sentrix</span><span style={{ opacity:0.4 }}>›</span><span>VENTAS</span>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:4, flexShrink:0 }}>
            <IconBtn onClick={onToggleMax} title={maximized ? "Restaurar" : "Agrandar"}>{maximized ? <><polyline points="9 14 4 14 4 9"/><polyline points="15 10 20 10 20 15"/></> : <><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/></>}</IconBtn>
            <IconBtn onClick={onClose} title="Cerrar"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></IconBtn>
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"baseline", justifyContent:"space-between", gap:10 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, minWidth:0 }}><div style={{ fontSize:13, color:C.text, fontWeight:500 }}>{p.title || "Ventas"}</div><ScopeChip evidence={evidence}/></div>
          {hl ? <div style={{ fontFamily:MONO, fontSize:16, color:hlColor, fontWeight:700, whiteSpace:"nowrap" }}>{hl}{p.headlineSub ? <span style={{ fontSize:10.5, color:C.textMuted, fontWeight:400 }}> · {p.headlineSub}</span> : null}</div>
            : p.headlineSub ? <div style={{ fontFamily:MONO, fontSize:11, color:C.textMuted }}>{p.headlineSub}</div> : null}
        </div>
      </div>
      <div style={{ flex:1, overflowY:"auto", minHeight:0, padding:18, display:"flex", flexDirection:"column", gap:16 }}>
        {kind === "decomp" && (
          <div>
            <div style={{ ...head, marginBottom:11 }}>El crecimiento, partido</div>
            <div style={{ display:"flex", height:14, borderRadius:5, overflow:"hidden", marginBottom:12, background:"rgba(255,255,255,0.05)" }}>
              <div title={`volumen ${p1(p.volp)}%`} style={{ width:`${Math.max(2, Math.abs(p.volp) / (Math.abs(p.volp) + Math.abs(p.prip) || 1) * 100)}%`, background:C.cyan, opacity:0.85 }}/>
              <div title={`precio ${p1(p.prip)}%`} style={{ flex:1, background:C.green, opacity:0.8 }}/>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:9 }}>
              {[{ lbl:"Más unidades (volumen)", v:p.volp, led:p.volLed, col:C.cyan }, { lbl:"Mejor precio realizado", v:p.prip, led:p.priLed, col:C.green }].map((x, i) => (
                <div key={i} style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <span style={{ width:9, height:9, borderRadius:2, background:x.col, flexShrink:0 }}/>
                  <span style={{ fontSize:12, color:C.textSub, flex:1 }}>{x.lbl}<span style={{ color:C.textMuted }}> · empuja {x.led}</span></span>
                  <span style={{ fontFamily:MONO, fontSize:12.5, color:C.text, fontVariantNumeric:"tabular-nums" }}>{x.v >= 0 ? "+" : ""}{p1(x.v)}%</span>
                </div>
              ))}
            </div>
            <div style={{ fontSize:10.5, color:C.textMuted, lineHeight:1.5, marginTop:11 }}>El {hl || `+${p1(p.totp)}%`} YoY se descompone en volumen (más unidades) vs precio realizado (venta/unidades). Más volumen que precio = crecimiento sano. "Precio realizado" no es un ticket.</div>
          </div>
        )}
        {kind === "mix" && (
          <div>
            <div style={{ ...head, marginBottom:11 }}>Participación en el mix · hoy vs año anterior</div>
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              {rows.map((r, i) => { const named = nm(r.nombre); return (
                <AskRow key={i} onAsk={onAsk} q={`¿Cómo viene ${r.nombre} vs el año pasado?`} style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <span style={{ display:"flex", alignItems:"center", gap:5, width:118, flexShrink:0, minWidth:0 }}>{named ? <NamedDot/> : null}<span style={{ fontSize:12, color: named ? C.text : C.textSub, fontWeight: named ? 600 : 400, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{r.nombre}</span></span>
                  <div style={{ position:"relative", flex:1, height:9, background:"rgba(255,255,255,0.05)", borderRadius:4, overflow:"hidden" }}>
                    <div style={{ width:`${r.sNow}%`, height:"100%", background:C.blue, opacity:0.8 }}/>
                    <div style={{ position:"absolute", left:`${r.sAnt}%`, top:-1, bottom:-1, width:1.5, background:C.textMuted }}/>
                  </div>
                  <span style={{ fontFamily:MONO, fontSize:12, color:C.text, width:42, textAlign:"right", flexShrink:0 }}>{p1(r.sNow)}%</span>
                  <span style={{ fontFamily:MONO, fontSize:11, color: r.dpp >= 0 ? C.green : C.red, width:44, textAlign:"right", flexShrink:0 }}>{r.dpp >= 0 ? "+" : ""}{p1(r.dpp)}pp</span>
                </AskRow>
              ); })}
            </div>
            <div style={{ fontSize:10.5, color:C.textMuted, lineHeight:1.5, marginTop:10 }}>La barra es el share de hoy; la línea gris marca el share del año anterior. Verde/rojo = puntos ganados/perdidos. {MIRROR_LEGEND}{onAsk ? ` ${ASK_LEGEND}` : ""}</div>
          </div>
        )}
        {(kind === "movers" || kind === "rank") && (
          <div>
            <div style={{ ...head, marginBottom:11 }}>{kind === "rank" ? "Ranking de venta" : "Quién mueve la aguja"}</div>
            <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
              {rows.map((r, i) => { const col = kind === "rank" ? C.blue : (r.pos ? C.green : C.red); const named = nm(r.nombre); return (
                <AskRow key={i} onAsk={onAsk} q={kind === "rank" ? `Profundiza en ${r.nombre}` : `¿Cómo viene ${r.nombre} vs el año pasado?`} style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <span style={{ display:"flex", alignItems:"center", gap:5, width:118, flexShrink:0, minWidth:0 }}>{named ? <NamedDot/> : null}<span style={{ fontSize:12, color: named ? C.text : C.textSub, fontWeight: named ? 600 : 400, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{r.nombre}</span></span>
                  <div style={{ flex:1, height:9, background:"rgba(255,255,255,0.05)", borderRadius:4, overflow:"hidden" }}>
                    <div style={{ width:`${Math.max(2, Math.abs(r.val || 0) / maxAbs * 100)}%`, height:"100%", background:col, opacity:0.85 }}/>
                  </div>
                  <span style={{ fontFamily:MONO, fontSize:12, color:C.text, fontVariantNumeric:"tabular-nums", width:64, textAlign:"right", flexShrink:0 }}>{r.valFmt}</span>
                  {typeof r.pct === "number" ? <span style={{ fontFamily:MONO, fontSize:10.5, color:C.textMuted, width:44, textAlign:"right", flexShrink:0 }}>{r.pct >= 0 ? "+" : ""}{p1(r.pct)}%</span> : null}
                </AskRow>
              ); })}
            </div>
            <div style={{ fontSize:10.5, color:C.textMuted, lineHeight:1.5, marginTop:10 }}>{kind === "rank" ? `SKU ordenados por venta del período. ${MIRROR_LEGEND}${onAsk ? ` ${ASK_LEGEND}` : ""} Cifras de dato real.` : `Verde = suma, rojo = resta. Ordenado por impacto en $. ${MIRROR_LEGEND}${onAsk ? ` ${ASK_LEGEND}` : ""} Cifras de dato real.`}</div>
          </div>
        )}
      </div>
    </div>
  );
}

// MarginPanel · FOCO MARGEN (owner 2026-07-06) · la "calidad de la venta" de un vistazo: cada entidad contra la LÍNEA de
// benchmark (bajo la línea = margen delgado) + descomposición precio/costo cuando el foco lo pide. Respalda el texto de ADI.
function MarginPanel({ evidence, onClose, onToggleMax, maximized, onAsk = null }) {
  const p = (evidence && evidence.margin && evidence.margin.panel) || {};
  const rows = p.rows || [], bench = p.bench || 30.1;
  const scale = Math.max(40, ...rows.map((r) => r.margen || 0));   // eje 0..scale (%)
  const benchPct = Math.min(100, bench / scale * 100);
  const head = { fontFamily: MONO, fontSize: 9.5, letterSpacing: "0.5px", color: C.text, textTransform: "uppercase" };
  const p1 = (v) => (Math.round(v * 10) / 10).toFixed(1);
  const decomp = rows.filter((r) => typeof r.costShare === "number" && r.below).slice(0, 5);
  const nm = _named(evidence);   // espejo: lo que ADI nombró
  // B.3 · número PROTAGONISTA (unificación con ventas/inventario): el $ de la palanca ("cuánto vale") de la boleta —
  // misma fuente de verdad que el texto, cero recalculo. Sin palanca (huecos) → cae al conteo como antes.
  const lever = ((evidence && evidence.boleta) || []).find((f) => f && /^Medida · /.test(f.label));
  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", minHeight:0, background:"#000000", borderLeft:`1px solid ${C.border}`, position:"relative", overflow:"hidden" }}>
      <div className="sentrix-sweep"/>
      <div style={{ flexShrink:0, padding:"14px 18px", borderBottom:`1px solid ${C.border}`, background:"linear-gradient(180deg, rgba(255,255,255,0.03), transparent)" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
          <div style={{ display:"flex", alignItems:"center", gap:7, fontFamily:MONO, fontSize:9.5, letterSpacing:"0.8px", color:C.textMuted, textTransform:"uppercase", minWidth:0 }}>
            <span style={{ color:C.text, fontWeight:600 }}>Sentrix</span><span style={{ opacity:0.4 }}>›</span><span>MARGEN</span>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:4, flexShrink:0 }}>
            <IconBtn onClick={onToggleMax} title={maximized ? "Restaurar" : "Agrandar"}>{maximized ? <><polyline points="9 14 4 14 4 9"/><polyline points="15 10 20 10 20 15"/></> : <><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/></>}</IconBtn>
            <IconBtn onClick={onClose} title="Cerrar"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></IconBtn>
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"baseline", justifyContent:"space-between", gap:10 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, minWidth:0 }}><div style={{ fontSize:13, color:C.text, fontWeight:500 }}>{p.title || "Margen"}</div><ScopeChip evidence={evidence}/></div>
          {lever
            ? <div title={`${lever.label} — cuánto vale la medida`} style={{ fontFamily:MONO, fontSize:16, color:C.amber, fontWeight:700, whiteSpace:"nowrap" }}>{lever.value}<span style={{ fontSize:10.5, color:C.textMuted, fontWeight:400 }}> · {p.belowCount}/{p.total} bajo benchmark</span></div>
            : <div style={{ fontFamily:MONO, fontSize:12, color:C.textMuted, whiteSpace:"nowrap" }}><Num color={C.text}>{p.belowCount}</Num>/{p.total} bajo benchmark</div>}
        </div>
      </div>
      <div style={{ flex:1, overflowY:"auto", minHeight:0, padding:18, display:"flex", flexDirection:"column", gap:18 }}>
        <div>
          <div style={{ ...head, marginBottom:11, display:"flex", justifyContent:"space-between" }}><span>Margen vs benchmark</span><span style={{ textTransform:"none", letterSpacing:0, color:C.amber }}>línea = {p1(bench)}%</span></div>
          <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
            {rows.map((r, i) => { const named = nm(r.nombre); return (
              <AskRow key={i} onAsk={onAsk} q={`¿Por qué ${r.nombre} cede margen?`} style={{ display:"flex", alignItems:"center", gap:10 }}>
                <span style={{ display:"flex", alignItems:"center", gap:5, width:118, flexShrink:0, minWidth:0 }}>{named ? <NamedDot/> : null}<span style={{ fontSize:12, color: named ? C.text : C.textSub, fontWeight: named ? 600 : 400, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{r.nombre}</span></span>
                <div style={{ position:"relative", flex:1, height:9, background:"rgba(255,255,255,0.05)", borderRadius:4, overflow:"hidden" }}>
                  <div style={{ width:`${Math.min(100, (r.margen || 0) / scale * 100)}%`, height:"100%", background: r.below ? C.amber : C.green, opacity:0.85 }}/>
                  <div style={{ position:"absolute", left:`${benchPct}%`, top:-1, bottom:-1, width:1.5, background:C.amber, opacity:0.9 }}/>
                </div>
                <span style={{ fontFamily:MONO, fontSize:12, color: r.below ? C.amber : C.textSub, fontVariantNumeric:"tabular-nums", width:44, textAlign:"right", flexShrink:0 }}>{p1(r.margen)}%</span>
              </AskRow>
            ); })}
          </div>
        </div>
        {decomp.length > 0 && (
          <div>
            <div style={{ ...head, marginBottom:11 }}>De dónde sale el margen · precio vs costo</div>
            <div style={{ display:"flex", flexDirection:"column", gap:9 }}>
              {decomp.map((r, i) => (
                <div key={i}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                    <span style={{ fontSize:12, color:C.textSub }}>{r.nombre}</span>
                    <span style={{ fontFamily:MONO, fontSize:11, color:C.textMuted }}>markup <Num color={r.markup < bench ? C.amber : C.green}>{p1(r.markup)}%</Num></span>
                  </div>
                  <div style={{ display:"flex", height:8, borderRadius:4, overflow:"hidden" }}>
                    <div title={`costo ${Math.round(r.costShare)}%`} style={{ width:`${Math.min(100, r.costShare)}%`, background:"rgba(255,255,255,0.18)" }}/>
                    <div title={`markup ${p1(r.markup)}%`} style={{ flex:1, background: r.markup < bench ? C.amber : C.green, opacity:0.85 }}/>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ fontSize:10.5, color:C.textMuted, lineHeight:1.5, marginTop:9 }}>Gris = costo sobre el precio de lista · color = markup. Markup fino (bajo {p1(bench)}%) = el precio no cubre el margen objetivo.</div>
          </div>
        )}
        <div style={{ fontSize:10.5, color:C.textMuted, lineHeight:1.5 }}>La línea vertical es el benchmark de margen ({p1(bench)}%). Ámbar = bajo la línea (margen delgado); verde = sobre el benchmark.{lever ? " El monto del encabezado es cuánto vale la medida (lo que ganas si la ejecutas)." : ""} {MIRROR_LEGEND}{onAsk ? ` ${ASK_LEGEND}` : ""} Cifras de dato real.</div>
      </div>
    </div>
  );
}

// InventoryPanel · FOCO CAPITAL INMOVILIZADO (owner 2026-07-06 · "la pregunta manda el foco") · evidencia de inventario:
// total → por bodega (barra) → por SKU (capital · DOH · rotación · crítico). Respalda lo que ADI afirma en el texto.
function InventoryPanel({ evidence, onClose, onToggleMax, maximized, onAsk = null }) {
  const inv = (evidence && evidence.inventory) || {};
  const byBodega = inv.byBodega || [], bySku = inv.bySku || [];
  const estados = inv.estados || [];   // las 4 puntas (sano/quiebre/frenado/sobrestock) · del motor sellado
  const estColor = { capital_frenado: C.amber, riesgo_quiebre: C.red, sobrestock: C.cyan, capital_sano: C.green };
  const cmap = { amber: C.amber, red: C.red, cyan: C.cyan, green: C.green };
  const fcolor = cmap[inv.focusColor] || C.amber;   // color del FOCO (la pregunta manda) · barras + header
  const cp = inv.contrapunta || null;               // la otra punta material (callout)
  const cpColor = cmap[cp && cp.color] || C.red;
  // el fallback replica el `title` de composeSpecInventory (specRetrieval.js) — se corrige en los DOS lados a la
  // vez o la pantalla dice una cosa distinta según haya evidencia o no. Registro: «inmovilizado», no «detenido».
  const titleParts = String(inv.title || "Capital inmovilizado · dónde está inmovilizado tu capital").split(" · ");
  const isStale = inv.focus === "stale";
  const _fm = (v) => { const a = Math.abs(v), s = v < 0 ? "-" : ""; if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(1)}M`; if (a >= 1e3) return `${s}$${Math.round(a / 1e3)}K`; return `${s}$${Math.round(a)}`; };
  const maxB = Math.max(1, ...byBodega.map((b) => b.usd));
  const head = { fontFamily:MONO, fontSize:9.5, letterSpacing:"0.5px", color:C.text, textTransform:"uppercase" };
  const nm = _named(evidence);   // espejo: lo que ADI nombró
  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", minHeight:0, background:"#000000", borderLeft:`1px solid ${C.border}`, position:"relative", overflow:"hidden" }}>
      <div className="sentrix-sweep"/>
      <div style={{ flexShrink:0, padding:"14px 18px", borderBottom:`1px solid ${C.border}`, background:"linear-gradient(180deg, rgba(255,255,255,0.03), transparent)" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
          <div style={{ display:"flex", alignItems:"center", gap:7, fontFamily:MONO, fontSize:9.5, letterSpacing:"0.8px", color:C.textMuted, textTransform:"uppercase", minWidth:0 }}>
            <span style={{ color:C.text, fontWeight:600 }}>Sentrix</span><span style={{ opacity:0.4 }}>›</span><span>INVENTARIO</span>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:4, flexShrink:0 }}>
            <IconBtn onClick={onToggleMax} title={maximized ? "Restaurar" : "Agrandar"}>{maximized ? <><polyline points="9 14 4 14 4 9"/><polyline points="15 10 20 10 20 15"/></> : <><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/></>}</IconBtn>
            <IconBtn onClick={onClose} title="Cerrar"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></IconBtn>
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"baseline", justifyContent:"space-between", gap:10 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, minWidth:0 }}><div style={{ fontSize:13, color:C.text, fontWeight:500 }}>{titleParts[1] ? <><span style={{ color:C.textMuted }}>{titleParts[0]} · </span>{titleParts[1]}</> : titleParts[0]}</div><ScopeChip evidence={evidence}/></div>
          <div style={{ fontFamily:MONO, fontSize:16, color:fcolor, fontWeight:700, fontVariantNumeric:"tabular-nums", whiteSpace:"nowrap" }}>{_fm(inv.total || 0)}</div>
        </div>
        <EvidenceClaimHeader evidenceSpec={evidence.evidenceSpec}/>
      </div>
      <div style={{ flex:1, overflowY:"auto", minHeight:0, padding:18, display:"flex", flexDirection:"column", gap:18 }}>
        <div>
          <div style={{ ...head, marginBottom:9 }}>Por bodega</div>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {byBodega.map((b, i) => (
              <div key={i} style={{ display:"flex", alignItems:"center", gap:10 }}>
                <span style={{ fontSize:12.5, color:C.textSub, width:118, flexShrink:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{b.bodega}</span>
                <div style={{ flex:1, height:7, background:"rgba(255,255,255,0.05)", borderRadius:4, overflow:"hidden" }}>
                  <div style={{ width:`${Math.round(b.usd / maxB * 100)}%`, height:"100%", background:fcolor, opacity:0.85 }}/>
                </div>
                <span style={{ fontFamily:MONO, fontSize:12.5, color:C.text, fontVariantNumeric:"tabular-nums", width:52, textAlign:"right", flexShrink:0 }}>{_fm(b.usd)}</span>
                <span style={{ fontFamily:MONO, fontSize:11, color:C.textMuted, width:34, textAlign:"right", flexShrink:0 }}>{b.pct}%</span>
              </div>
            ))}
          </div>
        </div>
        {estados.length > 0 && (
          <div>
            <div style={{ ...head, marginBottom:9 }}>Las 4 puntas del inventario<span style={{ textTransform:"none", letterSpacing:0, opacity:0.65 }}> · {_fm(inv.totalInventario || 0)} total</span></div>
            <div style={{ display:"flex", height:9, borderRadius:5, overflow:"hidden", marginBottom:11 }}>
              {estados.map((e, i) => (<div key={i} title={`${e.label} ${e.pct}%`} style={{ width:`${e.pct}%`, background:estColor[e.estado] || C.textMuted, opacity:0.88 }}/>))}
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              {estados.map((e, i) => (
                <div key={i} style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <span style={{ width:8, height:8, borderRadius:2, background:estColor[e.estado] || C.textMuted, flexShrink:0 }}/>
                  <span style={{ fontSize:12, color:C.textSub, flex:1 }}>{e.label}</span>
                  <span style={{ fontFamily:MONO, fontSize:12, color:C.text, fontVariantNumeric:"tabular-nums" }}>{_fm(e.usd)}</span>
                  <span style={{ fontFamily:MONO, fontSize:11, color:C.textMuted, width:34, textAlign:"right", fontVariantNumeric:"tabular-nums" }}>{e.pct}%</span>
                </div>
              ))}
            </div>
            {cp && (
              <div style={{ marginTop:12, padding:"10px 12px", borderRadius:7, background:`${cpColor}14`, border:`1px solid ${cpColor}40` }}>
                <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:5 }}>
                  <span style={{ width:6, height:6, borderRadius:"50%", background:cpColor, flexShrink:0 }}/>
                  <span style={{ fontFamily:MONO, fontSize:9.5, letterSpacing:"0.5px", color:cpColor, textTransform:"uppercase" }}>La otra punta · {cp.label}</span>
                </div>
                <div style={{ fontSize:12, color:C.textSub, lineHeight:1.55 }}>
                  <span style={{ fontFamily:MONO, color:C.text }}>{_fm(cp.usd)}</span> ({cp.pct}%) en {cp.count} SKU{cp.estado === "riesgo_quiebre" ? " que rotan rápido y con pocos días de inventario — se van a cortar" : " que no rotan y retienen el capital"}.
                  {cp.familias && cp.familias.length ? <> Sobre todo en {cp.familias[0].nombre}.</> : null}
                </div>
              </div>
            )}
          </div>
        )}
        <div>
          <div style={{ ...head, marginBottom:9 }}>{titleParts[0]} · el detalle</div>
          <div style={{ display:"grid", gridTemplateColumns: isStale ? "1fr auto auto auto" : "1fr auto auto auto", gap:"0 16px", alignItems:"center" }}>
            <div style={head}>SKU</div><div style={{ ...head, textAlign:"right" }}>Capital</div><div style={{ ...head, textAlign:"right" }}>{isStale ? "Sin venta" : "DOH"}</div><div style={{ ...head, textAlign:"right" }}>Rot.</div>
            {bySku.map((s, i) => (
              <React.Fragment key={i}>
                <div style={{ gridColumn:"1 / -1", height:1, background:"rgba(255,255,255,0.05)" }}/>
                <div style={{ padding:"8px 0", display:"flex", alignItems:"center", gap:6, minWidth:0, ...(onAsk ? { cursor:"pointer" } : {}) }}
                  title={onAsk ? `Pregúntale a ADI: Profundiza en ${s.sku}` : undefined}
                  onClick={onAsk ? () => onAsk(`Profundiza en ${s.sku}`) : undefined}
                  onMouseEnter={onAsk ? (e) => { e.currentTarget.style.background = "rgba(47,184,218,0.07)"; } : undefined}
                  onMouseLeave={onAsk ? (e) => { e.currentTarget.style.background = "transparent"; } : undefined}>
                  {nm(s.sku) ? <NamedDot/> : null}
                  {/* B.3 · crítico = COLOR del texto (un solo marcador por fila; antes era un 2º punto pegado al celeste) */}
                  <span style={{ fontSize:12, color: s.critico ? fcolor : nm(s.sku) ? C.text : C.textSub, fontWeight: nm(s.sku) ? 600 : 400, fontFamily:MONO, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{s.sku}</span>
                </div>
                <div style={{ padding:"8px 0", textAlign:"right", fontFamily:MONO, fontSize:12.5, color:C.text, fontVariantNumeric:"tabular-nums" }}>{_fm(s.usd)}</div>
                <div style={{ padding:"8px 0", textAlign:"right", fontFamily:MONO, fontSize:12, color: (isStale ? (s.diasSinVenta > 90) : (s.doh > 120)) ? fcolor : C.textMuted, fontVariantNumeric:"tabular-nums" }}>{isStale ? `${s.diasSinVenta ?? "—"}d` : `${s.doh}d`}</div>
                <div style={{ padding:"8px 0", textAlign:"right", fontFamily:MONO, fontSize:12, color: s.rotacion < 2 ? fcolor : C.textMuted, fontVariantNumeric:"tabular-nums" }}>{s.rotacion}x</div>
              </React.Fragment>
            ))}
          </div>
        </div>
        <div style={{ fontSize:10.5, color:C.textMuted, lineHeight:1.5 }}>La franja "4 puntas" muestra todo tu inventario: {estados.map((e) => e.label).join(" · ")}. SKU en color = crítico. {MIRROR_LEGEND}{onAsk ? " Click en un SKU para pedirle a ADI que profundice." : ""} Cifras de dato real; el foco resaltado responde tu pregunta.</div>
        <EvidenceConfidenceFooter evidenceSpec={evidence.evidenceSpec}/>
      </div>
    </div>
  );
}

// PERFIL ÚNICO (owner 2026-08-06): deep-link puro (evidencia de perfil → Mesa comercial con esa fila ya
// seleccionada) — mismo patrón que pnlMesaLink. Los DOS pipelines marcan `_profileRequest` (answerADI.js/
// client_dive del piso legacy · sentrixEvidence.js/entityProfile de Arquitectura C — el que responde en vivo
// hoy con LLM ON) — deliberadamente angosto en AMBOS: NO cualquier evidence.reading con entityType client
// (comparaciones/rankings especiales también traen reading pero no deben perder su shell propio). entityType
// llega "cliente" (oracle, dimension tal cual del plan) o "client" (legacy, ya canónico vía boleta.js) — mismo
// dato, dos pipelines, sin normalizar entre sí.
function clientMesaLink(e) {
  if (!e || !e._profileRequest || !e.entidad) return null;
  if (e.entityType !== "client" && e.entityType !== "cliente") return null;
  return { cliente: e.entidad };
}

/* ── MESA DE CONTROL · Sentrix EN OPERACIÓN (owner 2026-07-07) ────────────────────────────────────────────────────────
 * No es la evidencia de una respuesta: es el lugar donde el dueño VIVE sus cifras — ventas, márgenes, capital a la mano —
 * con ADI al lado. Anti-BI por diseño: cada bloque lleva la LECTURA de ADI (no cifras mudas), los FOCOS del día con su $,
 * el 80/20 SIEMPRE visible (el principio del owner: pocos explican la mayor parte), y cada fila es una PREGUNTA (click →
 * ADI lo desglosa al lado). Reusa todo lo construido: resumen ejecutivo, diagnose, buildConcentration, CuadroMando. */
// registro EJECUTIVO (owner 2026-07-09): las preguntas que ADI ofrece van en lenguaje de directorio — nada de
// "plata"/"me come"; el usuario puede ser coloquial, lo emitido por ADI no.
function MesaPanel({ evidence, onClose, onToggleMax, maximized, onAsk = null }) {
  const scenario = (evidence && evidence.periodo) || "bonanza";
  const resumen = React.useMemo(() => buildResumenEjecutivo(scenario), [scenario]);
  // MESA 2.0 · PASE 1 (owner 2026-07-14): el estado contra TU vara + la acción priorizada + el movimiento del
  // período — todo del módulo (mesa.js reusa diagnose/POLICY/temporal · cero cálculo acá).
  const mesa = React.useMemo(() => buildMesaEstado(scenario), [scenario]);
  // CARA CAPITAL (owner 2026-07-15 "ok, veamos cómo queda"): la Mesa tiene DOS CARAS — el mismo sello contando el
  // capital (detectores de inventario existentes · mesaCapital.js · cero cálculo acá). Selector recordado en este
  // navegador (patrón adi_hint_v1) e informado a ADI por uiSignals (el click INFORMA la cara activa, nunca dispara).
  // DEEP-LINK del P&L (2026-07-26): si la Mesa se abre desde una respuesta P&L (evidence.pnl → pnlMesaLink),
  // arranca en la cara Resultado con SU alcance — el eje de la respuesta al selector del cuadro y la entidad
  // en foco en la cascada. El click sigue el patrón de la Mesa: informa (uiSignals), nunca dispara.
  const _pnlLink = pnlMesaLink(evidence);
  const _tLink = !!(evidence && evidence.lens === "temporal");   // mejora 7b · el mes a mes ampliado abre la cara comercial (la película del año vive ahí)
  // DEEP-LINK del perfil único (owner 2026-08-07, "no debe ir mezclada — debe ser su propia pestaña"): "dame el
  // perfil/avance/estado de Falabella" → la cara FICHA con ese cliente ya elegido — la Ficha Ejecutiva completa
  // aparece de una, sola, sin el Cuadro/Pareto/Comparado genéricos de la cara Comercial mezclados encima.
  // Mismo patrón que _pnlLink/_tLink.
  const _clientLink = clientMesaLink(evidence);
  /* ── LA DIRECCIÓN CANÓNICA (Contrato de Concordancia, owner 2026-08-09) ────────────────────────────────────
   * Una sola gramática resuelve QUÉ abre esta evidencia: `sentrix://<vista>/<seccion>/<slug>?…`. Si la respuesta
   * trae `address` (el camino nuevo), manda esa; si no, `legacyAddressFrom` produce EXACTAMENTE la misma
   * {cara, eje, foco} que daban los tres resolvedores viejos, así que el comportamiento actual queda intacto.
   * Lo que la dirección agrega sobre el camino viejo son los CONTROLES: abrir la vista, la sección, la entidad Y
   * el filtro exactos, no solo la cara. */
  const _addr = React.useMemo(() => {
    const a = parseAddress(evidence && evidence.address);
    return a || legacyAddressFrom(evidence);
  }, [evidence]);
  const _link = React.useMemo(() => resolveAddress(_addr), [_addr]);
  const [fichaCliente, setFichaCliente] = useState(
    (_link && _link.cara === "ficha" && _link.entidad) || (_clientLink ? _clientLink.cliente : null)
  );
  const [cara, setCara] = useState(() => {
    if (_link && _link.conocido) return _link.cara;
    if (_pnlLink) return _pnlLink.cara;
    if (_clientLink) return "ficha";
    if (_tLink) return "comercial";
    try { const v = localStorage.getItem("adi_mesa_cara_v1"); return v === "capital" || v === "resultado" || v === "ficha" ? v : "comercial"; } catch { return "comercial"; }
  });
  useEffect(() => {
    try { localStorage.setItem("adi_mesa_cara_v1", cara); } catch { /* sin storage → sesión */ }
    setUISignal({ mesaCara: cara });
  }, [cara]);
  const capital = React.useMemo(() => buildMesaCapital(scenario), [scenario]);   // una pasada: la cara Capital + la pata de inventario del "En alerta"
  // CARA RESULTADO (owner 2026-07-15 "sí, parte por p&l"): el P&L se sella CONVERSANDO — cuando ADI lo sella/edita,
  // pnl.js emite "adi-pnl-changed" y la cara se re-arma con la Mesa abierta (sin cerrar/abrir el panel).
  const [pnlTick, setPnlTick] = useState(0);
  useEffect(() => {
    const onPnl = () => setPnlTick((t) => t + 1);
    try { window.addEventListener("adi-pnl-changed", onPnl); return () => window.removeEventListener("adi-pnl-changed", onPnl); } catch { /* headless */ }
  }, []);
  // PASE 2 (owner 2026-07-25): el cuadro por entidad gana SELECTOR DE EJE (solo ejes con venta desglosada) y la
  // cascada puede scopear a una fila (espejo del comparado del cuadro). Estado local — el click informa, nunca dispara.
  const [pnlEje, setPnlEje] = useState(_pnlLink ? _pnlLink.eje : null);            // null → el eje primario (cliente)
  const [pnlFoco, setPnlFoco] = useState(_pnlLink ? _pnlLink.foco : null);         // { eje, nombre } → la cascada scopeada a esa fila
  // «Ampliar»/«Ver evidencia» sobre OTRA respuesta con la Mesa ya abierta → re-enfoca (la evidencia nueva manda
  // su alcance). Con dirección resoluble se aplica ELLA (cara + eje + foco + controles); sin ella, las tres ramas
  // legacy siguen exactamente como estaban.
  useEffect(() => {
    if (_link && _link.conocido) {
      setCara(_link.cara);
      if (_link.cara === "resultado") { setPnlEje(_link.eje); setPnlFoco(_link.foco); }
      if (_link.cara === "ficha" && _link.entidad) setFichaCliente(_link.entidad);
      return;
    }
    if (_pnlLink) { setCara(_pnlLink.cara); setPnlEje(_pnlLink.eje); setPnlFoco(_pnlLink.foco); }
    else if (_clientLink) { setCara("ficha"); setFichaCliente(_clientLink.cliente); }
    else if (_tLink) setCara("comercial");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evidence]);
  const resultado = React.useMemo(() => buildMesaResultado(scenario, pnlEje, pnlFoco), [scenario, pnlTick, pnlEje, pnlFoco]);
  // MESA 2.0 · PASE 2 · WATCHLIST "lo que yo sigo": persistida en este navegador (localStorage · patrón adi_hint_v1)
  // e informada a ADI por uiSignals (el click INFORMA contexto, nunca dispara — regla dura del owner 2026-07-08).
  const [watch, setWatch] = useState(() => {
    try { const v = JSON.parse(localStorage.getItem("adi_watchlist_v1") || "[]"); return Array.isArray(v) ? v.filter((w) => w && w.dim && w.name) : []; } catch { return []; }
  });
  useEffect(() => {
    try { localStorage.setItem("adi_watchlist_v1", JSON.stringify(watch)); } catch { /* sin storage → sesión */ }
    setUISignal({ watchlist: watch.map((w) => w.name) });
  }, [watch]);
  const toggleWatch = (dim, name) => setWatch((w) => (w.some((x) => x.dim === dim && x.name === name) ? w.filter((x) => !(x.dim === dim && x.name === name)) : [...w, { dim, name }]));
  const wl = React.useMemo(() => buildWatchlistEstado(watch, scenario), [watch, scenario]);
  // ── RESUMEN COMERCIAL (owner 2026-08-07) · TODA la cara Comercial sale de este módulo, con ALCANCE GLOBAL: la
  //    firma no acepta entidad seleccionada, así que ni el deep-link de un cliente ni una selección previa en la
  //    tabla pueden teñirla. El tope del gráfico es lo único que depende de la pantalla (10 entidades en desktop,
  //    6 en móvil — el módulo arma solo el "resto de cabeza" y la "cola"). Cero cálculo acá.
  const narrow = useNarrowViewport();
  const resumenC = React.useMemo(() => {
    try { return buildResumenComercial(scenario, { maxEntidades: narrow ? 6 : 10 }); } catch { return null; }
  }, [scenario, narrow]);
  // ¿Y SI…? de la cara Comercial: solo supuestos COMERCIALES (owner 2026-08-07 · "mantené el capital en Capital").
  // El de liberar capital detenido no se pierde — es el mismo que ya ofrece el "¿Y si…?" de la cara Capital.
  // (`simulacionesComerciales` murió con el "¿Y si…?" de esta cara · owner 2026-08-08. Los supuestos de capital
  //  siguen enteros en la cara Capital, que es de donde nunca salieron.)
  // "detecta → EXPLICA": cada insight, la primera profundización sugerida, cada barra del Pareto y el "Ver Ficha"
  // de la tabla abren la Ficha REAL de esa entidad — el MISMO camino del deep-link `_clientLink` (cara Ficha +
  // cliente elegido), no una vista paralela.
  const irAFicha = (nombre) => { if (!nombre) return; setFichaCliente(nombre); setCara("ficha"); };
  /* ── EL CONTEXTO AMBIENTE DE LA PANTALLA (requisito 2 del owner) ──────────────────────────────────────────
   * "Si el usuario escribe desde Sentrix, ADI recibe ese contexto AUNQUE NO haya pulsado un CTA." Mientras la Mesa
   * está abierta, la cara activa publica su contexto de VISTA por uiSignals; cualquier pieza que el usuario toque
   * después lo REFINA al componente puntual. Al cerrar el panel el contexto se limpia solo — una vista cerrada no
   * puede seguir tiñendo el turno siguiente. El builder de cada cara es el que ya alimenta la pantalla: cero
   * cálculo nuevo, cero contexto escrito a mano.
   * Se llaman los CUATRO hooks siempre (regla de hooks) y solo el de la cara activa publica. */
  const _oV = { scenario };
  useVistaContext("comercial", cara === "comercial" ? resumenC : null, _oV);
  useVistaContext("capital", cara === "capital" ? capital : null, _oV);
  useVistaContext("resultado", cara === "resultado" ? resultado : null, _oV);
  // la cara Ficha publica su propio ambiente DENTRO de MesaFichaCara: es la única que necesita la lectura del
  // módulo para nombrar su sujeto, y esa lectura vive ahí (acá tendríamos que escribirlo a mano, que es justo lo
  // que la mejora B prohíbe).
  // el flotante "Preguntar a ADI sobre esta vista" manda el contexto de la VISTA comercial completa, no el de la
  // última pieza tocada: es el catch-all de la pantalla, y su contexto tiene que decir eso mismo.
  const { ask: askVistaComercial } = useViewContext("comercial/otro/vista", resumenC, { scenario, onAsk });
  const head = { fontFamily: MONO, fontSize: 9.5, letterSpacing: "0.5px", color: C.text, textTransform: "uppercase" };
  const semCol = { verde: C.green, ambar: C.amber, rojo: C.red };
  // header de MOVIMIENTO (el sello entender→explicar→actuar): número celeste + título ejecutivo + su "i"
  const MovHead = ({ num, title, def }) => (
    <div style={{ ...head, marginBottom: 9, display: "flex", alignItems: "center", gap: 6 }}>
      {num ? <span style={{ color: C.celeste, opacity: 0.85 }}>{num}</span> : null}{title}<InfoDot def={def} align="left"/>
    </div>
  );
  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", minHeight:0, background:"#000000", borderLeft:`1px solid ${C.border}`, position:"relative", overflow:"hidden" }}>
      <div className="sentrix-sweep"/>
      {/* encabezado OSCURO (owner 2026-07-14, tras probar el blanco: "dejalo en negro como estaba — a Sentrix no
          le queda bien el blanco") · el blanco es para la barra del app; Sentrix vive en negro */}
      <div style={{ flexShrink:0, padding:"14px 18px", borderBottom:`1px solid ${C.border}`, background:"linear-gradient(180deg, rgba(255,255,255,0.03), transparent)" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
          <div style={{ display:"flex", alignItems:"center", gap:7, fontFamily:MONO, fontSize:9.5, letterSpacing:"0.8px", color:C.textMuted, textTransform:"uppercase", minWidth:0 }}>
            <span style={{ color:C.text, fontWeight:600 }}>Sentrix</span><span style={{ opacity:0.4 }}>›</span><span style={{ color:C.celeste }}>MESA DE CONTROL</span>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:4, flexShrink:0 }}>
            <IconBtn onClick={onToggleMax} title={maximized ? "Restaurar" : "Agrandar"}>{maximized ? <><polyline points="9 14 4 14 4 9"/><polyline points="15 10 20 10 20 15"/></> : <><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/></>}</IconBtn>
            <IconBtn onClick={onClose} title="Cerrar"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></IconBtn>
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:10, flexWrap:"wrap" }}>
          <div style={{ fontSize:13, color:C.text, fontWeight:500 }}>Tu negocio, en vivo <span style={{ color:C.textMuted, fontWeight:400 }}>· datos organizados por vista — ADI explica cualquier punto que quieras entender</span></div>
          {/* SELECTOR DE CARA (owner 2026-07-15) · segmented discreto: la misma Mesa mirando lo comercial o el capital */}
          <div style={{ display:"flex", alignItems:"center", gap:0, border:`1px solid ${C.border}`, borderRadius:7, overflow:"hidden", flexShrink:0 }}>
            {[["comercial", "Comercial"], ["capital", "Capital"], ["resultado", "Resultado"], ["ficha", "Ficha"]].map(([k, lbl]) => (
              <button key={k} onClick={() => setCara(k)}
                title={k === "comercial" ? "La cara comercial: ventas, márgenes y contribución" : k === "capital" ? "La cara Capital: tu inventario — qué trabaja, qué se frena, qué reponer" : k === "resultado" ? "La cara Resultado: tu P&L comercial — la cascada hasta el resultado después de gastos" : "La Ficha Ejecutiva de un cliente: perfil, brecha, evolución, composición y posición en la cartera"}
                style={{ padding:"4px 12px", fontSize:11, fontWeight: cara === k ? 600 : 400, cursor:"pointer", fontFamily:"'DM Sans', system-ui, sans-serif",
                  background: cara === k ? "rgba(255,255,255,0.1)" : "transparent", border:"none",
                  color: cara === k ? C.text : C.textMuted, transition:"all 0.15s" }}>{lbl}</button>
            ))}
          </div>
        </div>
        <EvidenceClaimHeader evidenceSpec={evidence.evidenceSpec}/>
      </div>
      {/* paddingBottom extra cuando el botón flotante de ADI está: SIN esto el botón tapa la última línea de la
          vista y el contenido queda inalcanzable abajo (owner 2026-08-07: "el botón flotante no puede cubrir
          contenido"). El colchón es del alto del botón más su margen. */}
      <div style={{ flex:1, overflowY:"auto", minHeight:0, padding:18, paddingBottom: cara === "comercial" && onAsk ? 74 : 18, display:"flex", flexDirection:"column", gap:18 }}>
        {/* CARA CAPITAL / CARA RESULTADO · el mismo sello sobre el inventario o sobre el P&L — la cara
            comercial vive INTACTA en la rama de abajo (regla de oro del owner). */}
        {cara === "ficha" ? (
          <MesaFichaCara entity={fichaCliente} scenario={scenario} onAsk={onAsk} onSelect={setFichaCliente}/>
        ) : cara === "resultado" ? (
          <MesaResultadoCara resultado={resultado} scenario={scenario} onAsk={onAsk} onEje={(k) => { setPnlEje(k); setPnlFoco(null); }} onFoco={setPnlFoco}
            onExport={() => pnlExportData(scenario, pnlEje, pnlFoco)}/>
        ) : cara === "capital" ? (
          <MesaCapitalCara capital={capital} scenario={scenario} onAsk={onAsk} watch={watch} onWatch={toggleWatch} wl={wl}/>
        ) : (<>
        {/* ── RESUMEN COMERCIAL · el DETECTOR (owner 2026-08-07) ─────────────────────────────────────────────────
            La cara ya no abre con una grilla: abre con el VEREDICTO del negocio completo y sus 4 KPIs, declara el
            PLANO de decisión (el grupo que explica el 80%), muestra dónde se concentra la venta, parte la brecha en
            probado / indicado / abierto, y remata en los insights que llevan a la Ficha de cada entidad. La cartera
            completa queda de evidencia opcional, más abajo. TODO sale de `resumenC` — cero cálculo acá. ── */}
        {resumenC ? (<>
          <ResumenMovimiento num="01" title="Qué está pasando"
            def={"El estado del negocio completo: el veredicto con sus cuatro cifras de cabecera, cómo se movió el año contra el anterior y contra tu presupuesto, en quiénes se concentra la venta y cómo se compone la cartera cliente por cliente. Todo con alcance global — ninguna selección previa lo tiñe."}>
            <ResumenVeredictoKPIs R={resumenC} mesa={mesa} onAsk={onAsk}/>
            <ResumenCartera R={resumenC} onFicha={irAFicha} onAsk={onAsk}/>
            <ResumenEvolutivo ev={resumenC.evolutivo} R={resumenC} onAsk={onAsk}/>
            <ResumenConcentracion R={resumenC} onFicha={irAFicha} onAsk={onAsk}/>
            <ResumenSostiene R={resumenC} onFicha={irAFicha} onAsk={onAsk}/>
          </ResumenMovimiento>
          <ResumenMovimiento num="02" title="Dónde se deteriora el margen"
            def={"Las dos cosas que mueven el margen, cada una contra su propia referencia: lo que entregas en acciones comerciales (contra el promedio de tu cartera o contra tu meta) y cómo se movió tu costo unitario contra tu precio entre el primer mes del período y el último."}>
            <ResumenDeterioro R={resumenC} onFicha={irAFicha} onAsk={onAsk}/>
          </ResumenMovimiento>
          <ResumenMovimiento num="03" title="Qué hacer primero"
            def={"Las cuentas cruzadas por los dos deterioros medidos. De ese cruce sale la prioridad — y el grupo que va primero es el peligroso: donde empujar volumen con descuento agrandaría la brecha en vez de cerrarla. Cada fila lleva a su Ficha Ejecutiva, que es donde la explicación se demuestra."}>
            <ResumenPrioridades R={resumenC} onFicha={irAFicha} onAsk={onAsk}/>
          </ResumenMovimiento>
        </>) : (
          // LIMITACIÓN DECLARADA, nunca relleno: sin filas de cliente en el período no hay veredicto que sostener.
          <div style={{ fontSize:12, color:C.textSub, lineHeight:1.55, padding:"10px 12px", border:`1px dashed ${C.border}`, borderRadius:10 }}>
            El resumen comercial necesita la cartera de clientes del período y este escenario no la trae. Sin esas filas no hay lectura que sostener, así que no se muestra ninguna.
          </div>
        )}
        {/* ── "EVIDENCIA COMPLETA · OPCIONAL" SE ELIMINÓ (owner 2026-08-08) ──────────────────────────────────────
            El 2026-08-07 la tabla legacy no se eliminaba, solo bajaba de plano: era el único lugar donde vivía la
            cartera entera. El 2026-08-08 dejó de serlo — "El negocio, cliente por cliente" abre las 13 cuentas con
            su propio "Ver la cartera completa (13)" —, así que este bloque pasó a ser un segundo botón para lo
            mismo, encima de una línea que repetía el alcance que el veredicto ya declara arriba.
            SE VA CON ÉL el CuadroMando de esta cara: selección para comparar, comparado multi-entidad, filtros,
            orden, buscador y watchlist. El owner lo decidió con esa consecuencia sobre la mesa. Lo que la cara
            conserva de todo eso: la cartera completa (bloque 1) y "Ver Ficha" por fila, que es el camino real —
            Comercial DETECTA, la Ficha EXPLICA. El cuadro sigue vivo e intacto en las otras caras. ── */}
        {/* Las tiras legacy "Margen en riesgo" y "Capital detenido" SE ELIMINARON de esta cara (owner
            2026-08-07). La primera repetía, con OTRO universo y sin decirlo, la cifra que el veredicto ya da:
            su alcance vive ahora reconciliado dentro del bloque 1. La segunda es capital, y el capital tiene
            su propia cara — la pestaña Capital sigue a un click en el encabezado. */}
        {/* ── LA COLA DE LA CARA SE ELIMINÓ · "Cambios detectados" y "¿Y si…?" (owner 2026-08-08) ───────────────
            Las dos secciones sobrevivían del shell viejo, cuando la cara Comercial era una lista de señales. Con
            los tres movimientos armados quedaron fuera de la línea de razonamiento: "Qué hacer primero" cierra
            con las decisiones priorizadas, y después venían tres señales sueltas y dos supuestos que ya no
            respondían ninguna pregunta abierta — el 80/20, la variación contra el año anterior y el efecto de
            llevar la carga a la meta se leen ahora dentro de los bloques, con su universo declarado.
            LA CAPACIDAD NO SE PIERDE: los supuestos de capital ya vivían en el "¿Y si…?" de la cara Capital, y
            cualquier pregunta sobre el período se le hace a ADI con el botón fijo de esta misma vista.
            La cara termina donde tiene que terminar: en qué hacer primero. ── */}
        </>)}
        <EvidenceConfidenceFooter evidenceSpec={evidence.evidenceSpec}/>
      </div>
      {/* ── BOTÓN GLOBAL FIJO · "Preguntar a ADI sobre esta vista" (owner 2026-08-06) — el catch-all cuando lo
          que quieres entender no es un KPI/fila/alerta puntual sino la vista completa. FUERA del scroll (hermano,
          no descendiente, del contenedor overflow:auto de arriba) — un position:absolute adentro de un
          overflow:auto queda clippeado a su caja de scroll aunque el offset se calcule contra un ancestro más
          arriba; comprobado en vivo: el botón existía en el DOM pero el click nunca llegaba. ── */}
      {cara === "comercial" && askVistaComercial && (
        <button onClick={() => askVistaComercial("¿Qué es lo más importante que debería ver en la vista Comercial?")}
          title="Pregúntale a ADI sobre esta vista completa"
          style={{ position:"absolute", right:16, bottom:16, display:"flex", alignItems:"center", gap:7, padding:"10px 16px", borderRadius:999,
            background:C.celeste, color:"#04262e", border:"none", fontSize:12, fontWeight:700, cursor:"pointer",
            fontFamily:"'DM Sans', system-ui, sans-serif", boxShadow:"0 8px 22px -4px rgba(47,184,218,0.5)", zIndex:5, transition:"transform 0.15s" }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-1px)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; }}>
          Preguntar a ADI sobre esta vista
        </button>
      )}
    </div>
  );
}

/* ══ MESA · CARA COMERCIAL · RESUMEN COMERCIAL (owner 2026-08-07) ═══════════════════════════════════════════════
 * LA TESIS: «Resumen comercial DETECTA → la Ficha EXPLICA → Sentrix DEMUESTRA». La cara deja de abrir con una
 * grilla de datos y abre con la SEÑAL del negocio, que termina llevándote a la entidad donde vale la pena
 * profundizar. Seis bloques, en este orden: veredicto + KPIs · plano de decisión · concentración · puente de
 * oportunidad · insights · evidencia completa (opcional).
 *
 * ALCANCE SIEMPRE GLOBAL. Todo sale de `buildResumenComercial(scenario)`, cuya firma NO acepta entidad
 * seleccionada: no hay por dónde contaminar la vista. La tabla de evidencia arranca sin selección aunque se haya
 * entrado por el deep-link de un cliente.
 *
 * CERO CÁLCULO EN REACT. Veredicto, KPIs, plano 80/20, barras del Pareto (con su línea acumulada calculada sobre
 * TODAS las entidades reales), puente e insights vienen armados y formateados del módulo — la misma aritmética del
 * cuadro, del diagnóstico y de lo que ADI dice. Estos componentes ORDENAN píxeles; si una cifra no está autorizada,
 * se muestra la limitación en vez de rellenarla.
 *
 * PROPORCIONALIDAD SEMÁNTICA. La vista LOCALIZA la tensión y nunca afirma la causa: los textos son los del módulo,
 * sin prosa inventada acá. Lo único que la UI agrega es el color del estatus — probado (verde), indicado (ámbar),
 * abierto (neutro) —, que es justamente la graduación epistémica hecha visible.
 */
// ANCHO · el MISMO mecanismo del resto de la app (App.jsx: matchMedia 760px — bajo ese ancho Sentrix deja de ser
// una columna lateral y pasa a overlay a pantalla completa). Solo define el tope del gráfico: 10 entidades en
// desktop, 6 en móvil; el módulo arma el "resto de la cabeza" y la "cola" con lo que quede afuera.
function useNarrowViewport(query = "(max-width: 760px)") {
  const [narrow, setNarrow] = useState(() => { try { return window.matchMedia(query).matches; } catch { return false; } });
  useEffect(() => {
    let mq = null;
    try { mq = window.matchMedia(query); } catch { return undefined; }
    if (!mq || !mq.addEventListener) return undefined;
    const on = (e) => setNarrow(!!e.matches);
    setNarrow(!!mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [query]);
  return narrow;
}

const _RC_HEAD = { fontFamily: MONO, fontSize: 9.5, letterSpacing: "0.7px", color: C.textMuted, textTransform: "uppercase" };
// EL SELLO DE LOS TRES MOVIMIENTOS (qué está pasando · por qué está pasando · qué hacer primero) — el MISMO que
// ya usa la cara Capital. Que las caras compartan el esqueleto es lo que hace que el usuario aprenda a leer una
// vez y le sirva en las cuatro; un BI, en cambio, te obliga a reaprender cada pantalla.
function ResumenMovimiento({ num, title, def, children }) {
  return (
    <div>
      <div style={{ ..._RC_HEAD, marginBottom: 10, display: "flex", alignItems: "center", gap: 6, fontSize: 10.5, color: C.textSub }}>
        <span style={{ color: C.celeste, opacity: 0.85 }}>{num}</span>{title}<InfoDot def={def} align="left"/>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>{children}</div>
    </div>
  );
}
// la GRADUACIÓN epistémica hecha color (el sello del contrato v2 · probado/indicado/abierto)
const _rcEstatusCol = (e) => (e === "probado" ? C.green : e === "indicado" ? C.amber : C.textMuted);
// el sello epistémico, en módulo: lo usan el bloque 02 y el desplegable de "venden mucho pero dejan poco"
const _rcChip = (estatus, texto) => (
  <span style={{ fontFamily: MONO, fontSize: 7.5, letterSpacing: "0.5px", textTransform: "uppercase", color: _rcEstatusCol(estatus), border: `1px solid ${_rcEstatusCol(estatus)}55`, borderRadius: 3, padding: "1px 5px", flexShrink: 0 }}>{texto || estatus}</span>
);
const _rcTonoCol = (t) => (t === "ok" ? C.green : t === "alerta" ? C.red : t === "aviso" ? C.amber : C.textMuted);
// CARD DE CONTENIDO · borde NEUTRO (owner 2026-08-07: "menos bordes celestes; reservarlos para selección e
// interacción"). Con cinco cards celestes seguidas el acento dejaba de acentuar: todo gritaba y nada guiaba.
// Ahora el celeste queda para lo que se toca — pills activas, botones, la fila seleccionada — y el contenido
// respira en gris.
const _RC_CARD = {
  padding: "14px 16px 12px", borderRadius: 12, border: "1px solid rgba(47,184,218,0.25)",
  background: "radial-gradient(140% 90% at 50% 0%, rgba(47,184,218,0.05) 0%, rgba(47,184,218,0) 55%), #0b0b0b",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
};

/* ── 1 · EL VEREDICTO + LOS 4 KPI ──────────────────────────────────────────────────────────────────────────────
 * El bloque nunca queda vacío y la conclusión nunca se fuerza: el módulo entrega titular/soporte/lectura ya
 * graduados (señal o neutral) y acá solo se pintan. El KPI de CAPITAL ya no está: su historia completa vive en la
 * cara Capital (owner 2026-08-07), así que los cuatro que quedan son todos comerciales. */
function ResumenVeredictoKPIs({ R, mesa, onAsk }) {
  // ── EMISIÓN DEL CONTEXTO (Contrato de Concordancia, owner 2026-08-09) ─────────────────────────────────────
  // Una llamada por pieza que el usuario puede señalar. El contexto NO se escribe acá: se DERIVA de `R` (la
  // salida viva de buildResumenComercial) cruzada con el manifiesto. Lo único que la UI aporta es qué componente
  // es cada botón — que es justamente lo que la UI sabe y el módulo no.
  const _o = { scenario: R.scenario, onAsk };
  const vVeredicto = useViewContext("comercial/01/veredicto", R, _o);
  const vRecon = useViewContext("comercial/01/reconciliacion-universos", R, _o);
  const vKpiVentas = useViewContext("comercial/01/kpi-ventas", R, _o);
  const vKpiContrib = useViewContext("comercial/01/kpi-contribucion", R, _o);
  const vKpiMargen = useViewContext("comercial/01/kpi-margen", R, _o);
  const vKpiAcciones = useViewContext("comercial/01/kpi-acciones-comerciales", R, _o);
  // el KPI y su contexto se emparejan por la MISMA llave que el módulo emite (`k.key`), nunca por posición: si
  // mañana el módulo reordena sus KPI, cada botón sigue mandando el contexto de SU cifra.
  const askKpi = {
    ventas: vKpiVentas.ask, contribucion: vKpiContrib.ask, margen: vKpiMargen.ask, acciones: vKpiAcciones.ask,
  };
  // las preguntas son las que el motor YA tiene probadas (mesa.estados / la simulación de carga) — la UI no
  // inventa preguntas nuevas: una pregunta que ADI no puede responder es peor que ninguna.
  const askDe = (key) => {
    const e = mesa && mesa.estados ? mesa.estados[key] : null;
    if (e && e.ask) return e.ask;
    if (key === "acciones") { const s = (mesa && mesa.simulaciones || []).find((x) => x.key === "carga"); return s ? s.ask : null; }
    return null;
  };
  const v = R.veredicto;
  return (
    <div>
      <div style={{ ..._RC_HEAD, marginBottom: 9, display: "flex", alignItems: "center", gap: 4 }}>
        Lectura ejecutiva · negocio completo
        <InfoDot def={"La señal del negocio entero, no de una entidad: se construye sobre todos tus clientes del período y ninguna selección previa la tiñe. El titular LOCALIZA dónde está la tensión y hasta ahí llega: que N cuentas concentren una brecha es una afirmación que el dato sostiene; POR QUÉ la concentran es lo que hay que ir a demostrar, cuenta por cuenta, en su Ficha. La referencia siempre es TU benchmark — el que tú fijaste."} align="left"/>
      </div>
      <div style={{ padding: "13px 16px", borderRadius: 12, borderLeft: `3px solid ${v.tipo === "senal" ? C.celeste : C.borderLight}`,
        border: `1px solid ${C.border}`, borderLeftWidth: 3, borderLeftColor: v.tipo === "senal" ? C.celeste : C.borderLight,
        background: "linear-gradient(90deg, rgba(47,184,218,0.06), rgba(47,184,218,0.01) 55%, transparent)", marginBottom: 10 }}>
        <div style={{ fontSize: 17, fontWeight: 600, color: C.text, lineHeight: 1.35, letterSpacing: "-0.1px" }}>{v.titular}</div>
        {/* UNA SOLA LECTURA DE ALCANCE (owner 2026-08-07: "hoy el universo 80/20 se explica varias veces").
            Antes esto vivía repartido en tres lugares — este soporte, una banda ALCANCE y una banda "Plano de
            decisión" — diciendo lo mismo con distintas palabras. Ahora: la declaración del plano, y debajo una
            línea que reconcilia cabeza y cola nombrando sus universos (esa parte no se negocia por brevedad). */}
        <div style={{ fontSize: 12.5, color: C.textSub, lineHeight: 1.55, marginTop: 6 }}>
          {v.soporte}
          <InfoDot def={`El grupo mínimo cuya venta acumulada alcanza el 80% — el mismo cálculo del diagnóstico y del cuadro, no un top-N fijo. Dentro de él, "brecha material" no es "bajo tu benchmark": son las cuentas que ceden ${POLICY.margenBrechaMaterial} pp o más, porque una diferencia chica no mueve una decisión. Los clientes de la cola no entran a esta lectura inicial; aparecen al expandir la cartera completa, al final.`} align="left"/>
        </div>
        {/* la línea de reconciliación pasa a ser PREGUNTABLE (no cambia su tipografía ni su lugar: solo gana el
            click y el título). Es la única pieza del bloque que declara DOS universos, y "¿por qué hay dos montos
            parecidos?" es la pregunta que más la busca — ahora viaja con el contexto de ESA tira, no del veredicto. */}
        <div style={{ fontSize: 11.5, color: C.textMuted, lineHeight: 1.5, marginTop: 4, ...(vRecon.ask ? { cursor: "pointer" } : {}) }}
          title={vRecon.ask ? "Pregúntale a ADI: ¿Cuál es la diferencia entre la cartera completa y el plano de decisión?" : undefined}
          onClick={vRecon.ask ? () => vRecon.ask("¿Cuál es la diferencia entre la cartera completa y el plano de decisión?") : undefined}>
          {R.tension.reconciliaCorta}
          <InfoDot def={"Dos universos con el MISMO criterio de materialidad y distinto alcance: la cartera completa (todo el negocio) y el plano de decisión (el grupo que explica el 80% de la venta). El primero dimensiona la oportunidad total; el segundo dice por dónde empezar. Cierran exacto: lo del plano más lo de la cola es lo de la cartera. Nunca vas a ver dos montos parecidos sin que diga de qué universo sale cada uno."} align="left"/>
        </div>
        {v.lectura ? (
          <div style={{ fontFamily: MONO, fontSize: 10.5, color: C.textMuted, lineHeight: 1.5, marginTop: 8, paddingTop: 8, borderTop: `1px solid ${C.border}`, fontVariantNumeric: "tabular-nums" }}>{v.lectura}</div>
        ) : null}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(148px, 1fr))", gap: 9 }}>
        {R.kpis.map((k) => { const ask = askDe(k.key); const emitir = askKpi[k.key] || vVeredicto.ask; const clic = !!(emitir && ask); return (
          <button key={k.key} onClick={clic ? () => emitir(ask) : undefined} title={clic ? `Pregúntale a ADI: ${ask}` : undefined}
            style={{ position: "relative", background: "rgba(255,255,255,0.02)", border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 12px", textAlign: "left", fontFamily: "'DM Sans', system-ui, sans-serif", cursor: clic ? "pointer" : "default", display: "flex", flexDirection: "column", gap: 4, transition: "background 0.15s, border-color 0.15s" }}
            onMouseEnter={(ev) => { ev.currentTarget.style.background = "rgba(47,184,218,0.05)"; if (clic) ev.currentTarget.style.borderColor = "rgba(47,184,218,0.5)"; const t = ev.currentTarget.querySelector(".kpi-explain"); if (t) t.style.opacity = 1; }}
            onMouseLeave={(ev) => { ev.currentTarget.style.background = "rgba(255,255,255,0.02)"; ev.currentTarget.style.borderColor = C.border; const t = ev.currentTarget.querySelector(".kpi-explain"); if (t) t.style.opacity = 0; }}>
            {clic && <span className="kpi-explain" style={{ position: "absolute", top: 8, right: 9, fontFamily: MONO, fontSize: 8, letterSpacing: "0.4px", textTransform: "uppercase", color: C.celeste, opacity: 0, transition: "opacity 0.15s" }}>explicar →</span>}
            <span style={{ fontSize: 10.5, color: C.textMuted }}>{k.label}</span>
            <span style={{ fontSize: 19, fontWeight: 600, color: C.text, fontFamily: MONO, letterSpacing: "0.2px", fontVariantNumeric: "tabular-nums", lineHeight: 1.1 }}>{k.valor}</span>
            <span style={{ fontSize: 10, color: _rcTonoCol(k.tono), lineHeight: 1.35 }}>{k.pie}</span>
          </button>
        ); })}
      </div>
    </div>
  );
}

/* ── 2 · EL NEGOCIO, CLIENTE POR CLIENTE · la primera tabla, antes de cualquier gráfico ────────────────────────
 * Owner 2026-08-08: bajo los KPI, la lista de clientes con venta, participación, contribución, margen y los dos
 * gaps —año anterior y presupuesto— con flechas de subida y de bajada; las primeras 10 por defecto y la cartera
 * completa a un clic. Es la vista global del negocio antes de que aparezca ningún gráfico.
 *
 * LA FLECHA ES LA ÚNICA DECISIÓN VISUAL DE ESTE BLOQUE, y ni siquiera es un cálculo: el módulo entrega `dir`
 * ("sube" / "baja" / "plano") ya resuelto con su umbral muerto, para que un ±0.02% no se dibuje como movimiento
 * mientras en pantalla se lee "+0.0%". Va `aria-hidden` porque es redundante: el signo ya vive en el porcentaje.
 * Y los dos gaps NO valen lo mismo — la cabecera lo sella: el año anterior es dato cerrado (probado), el
 * presupuesto es un plan que el usuario declaró (indicado). Mezclarlos sin decirlo sería tratar una intención
 * como una medición. */
// Dos mapas, no uno con columnas removidas: en angosto las cinco que quedan tienen que REPARTIRSE el 100%, o
// `tableLayout: fixed` deja los porcentajes de escritorio y las cifras salen cortadas con puntos suspensivos —
// un número truncado es peor que un número al que hay que scrollear.
const _RC_COLW_CART = {
  ancho:   { nombre: "22%", peso: "11%", venta: "12%", contribucion: "13%", margen: "10%", vsAnterior: "16%", vsPresupuesto: "16%" },
  angosto: { nombre: "26%", venta: "16%", margen: "14%", vsAnterior: "22%", vsPresupuesto: "22%" },
};
function ResumenCartera({ R, onFicha, onAsk }) {
  const K = R.cartera;
  const [todos, setTodos] = useState(false);
  const angosto = useNarrowViewport();
  // EMISIÓN · el control `todos` es estado declarado del componente (el manifiesto lo lista), así que viaja: "estos
  // clientes" con la tabla recortada significa las 10 visibles, y con la cartera abierta significa las 13. La
  // diferencia la decide el contexto, no una suposición del narrador.
  const { ask: askCartera } = useViewContext("comercial/01/tabla-cartera", R, {
    scenario: R.scenario, onAsk, controles: { todos: todos ? "1" : "0" },
    seleccion: { modo: "todas", n: K && K.filas ? (todos ? K.filas.length : Math.min(K.tope || K.filas.length, K.filas.length)) : 0 },
  });
  if (!K || !K.filas.length) return null;
  const filas = todos ? K.filas : K.filas.slice(0, K.tope);
  // en angosto se apartan participación y contribución: siete columnas en un teléfono empujan los dos gaps —lo
  // único que este bloque agrega— fuera del primer vistazo. Lo que se aparta se DICE, abajo, con texto del módulo.
  const cols = angosto ? K.columnas.filter((c) => !c.soloAncho) : K.columnas;
  const ver = (key) => cols.some((c) => c.key === key);
  const gapCell = (g, key, fuerte) => (
    <td key={key} style={{ ..._RC_TD, color: g.hay ? _rcTonoCol(g.tono) : C.textMuted, fontWeight: fuerte ? 600 : 400 }}>
      {g.hay ? (
        <span>
          <span style={{ whiteSpace: "nowrap" }}>
            {g.dir !== "plano" ? <span aria-hidden="true" style={{ fontSize: 8, marginRight: 3 }}>{g.dir === "sube" ? "▲" : "▼"}</span> : null}
            {g.pctFmt}
          </span>
          <span style={{ display: "block", fontSize: 9.5, color: C.textMuted, lineHeight: 1.3, fontWeight: 400 }}>{g.montoFmt}</span>
        </span>
      ) : "—"}
    </td>
  );
  return (
    <div style={_RC_CARD}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
        <span style={{ minWidth: 0, flex: "1 1 250px" }}>
          <span style={{ ..._RC_HEAD, color: C.text, display: "flex", alignItems: "center" }}>
            <span style={{ width: 5, height: 5, borderRadius: 3, background: C.celeste, flexShrink: 0, marginRight: 6, display: "inline-block" }}/>
            El negocio, cliente por cliente
            <InfoDot def={`Tu cartera entera de una sola mirada, con la venta OFICIAL por cliente: la misma que suma el KPI de arriba, así que la participación y los dos gaps salen todos de esa cifra y no de otra tabla del dato. Las dos referencias no valen lo mismo y por eso van selladas distinto: el año anterior es dato cerrado y los escenarios nunca lo reescriben; el presupuesto es el plan que tú declaraste — suma exacto el total del período, pero es una intención, no una medición. Esta tabla dice CÓMO VIENE cada cuenta; dónde se diluye el margen se lee más abajo, contra tu benchmark.`} align="left"/>
          </span>
          <span style={{ display: "block", fontSize: 12.5, color: C.text, lineHeight: 1.5, marginTop: 5 }}>{K.lectura}</span>
        </span>
        {askCartera ? _btnADI(() => askCartera("¿Qué clientes están por debajo de su presupuesto?"), "Que ADI lo explique →") : null}
      </div>
      <div style={{ overflowX: "auto", marginTop: 8 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: angosto ? 11 : 11.5, minWidth: angosto ? 0 : 640, tableLayout: "fixed" }}>
          <colgroup>{cols.map((c) => <col key={c.key} style={{ width: _RC_COLW_CART[angosto ? "angosto" : "ancho"][c.key] }}/>)}</colgroup>
          <thead><tr>{cols.map((c) => (
            <th key={c.key} style={{ ..._RC_TH, textAlign: c.align, verticalAlign: "bottom" }}>
              {c.label}
              {/* en angosto el sello baja a su propia línea: al lado del título se monta encima del de la columna
                  vecina, y un sello ilegible no sella nada */}
              {c.estatus ? <span style={{ display: angosto ? "block" : "inline", width: angosto ? "fit-content" : undefined, marginLeft: angosto ? "auto" : 4, marginTop: angosto ? 2 : 0, fontSize: 7.5, letterSpacing: "0.5px", color: _rcEstatusCol(c.estatus), border: `1px solid ${_rcEstatusCol(c.estatus)}55`, borderRadius: 3, padding: "1px 4px" }}>{c.estatus}</span> : null}
            </th>
          ))}</tr></thead>
          <tbody>{filas.map((f) => (
            <tr key={f.nombre}>
              {/* en angosto el nombre BAJA DE LÍNEA en vez de cortarse: sacrificar ancho de las cifras para que
                  quepa "Mercado Libre" en una sola línea dejaría truncada la venta, que es peor */}
              <td style={{ padding: "5px 6px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: angosto ? "normal" : "nowrap" }}>
                {onFicha ? (
                  <button onClick={() => onFicha(f.nombre)} title={`Abrir la Ficha de ${f.nombre}`}
                    style={{ background: "transparent", border: "none", padding: 0, color: C.text, fontSize: 11.5, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', system-ui, sans-serif", borderBottom: "1px solid rgba(47,184,218,0.35)" }}>{f.nombre}</button>
                ) : <span style={{ color: C.text, fontWeight: 600 }}>{f.nombre}</span>}
              </td>
              {ver("peso") ? <td style={{ ..._RC_TD, color: C.textSub }}>{f.pesoFmt}</td> : null}
              <td style={{ ..._RC_TD, color: C.text }}>{f.ventaFmt}</td>
              {ver("contribucion") ? <td style={{ ..._RC_TD, color: C.textSub }}>{f.contribucionFmt}</td> : null}
              <td style={{ ..._RC_TD, color: C.textSub }}>{f.margenFmt}</td>
              {gapCell(f.vsAnterior, "a", false)}
              {gapCell(f.vsPresupuesto, "p", false)}
            </tr>
          ))}</tbody>
          {/* EL TOTAL ES UNA FILA MÁS y se calcula igual que las otras — contra la suma de las referencias de las
              filas, no contra un total traído de otra tabla. Por eso su gap coincide con el pie del KPI de ventas. */}
          <tfoot><tr style={{ borderTop: `1px solid ${C.border}` }}>
            <td style={{ padding: "7px 6px 4px", color: C.text, fontWeight: 600, fontSize: 11.5, whiteSpace: "nowrap" }}>{K.total.nombre}</td>
            {ver("peso") ? <td style={{ ..._RC_TD, paddingTop: 7, color: C.textSub }}>{K.total.pesoFmt}</td> : null}
            <td style={{ ..._RC_TD, paddingTop: 7, color: C.text, fontWeight: 600 }}>{K.total.ventaFmt}</td>
            {ver("contribucion") ? <td style={{ ..._RC_TD, paddingTop: 7, color: C.text, fontWeight: 600 }}>{K.total.contribucionFmt}</td> : null}
            <td style={{ ..._RC_TD, paddingTop: 7, color: C.text, fontWeight: 600 }}>{K.total.margenFmt}</td>
            {gapCell(K.total.vsAnterior, "a", true)}
            {gapCell(K.total.vsPresupuesto, "p", true)}
          </tr></tfoot>
        </table>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginTop: 8 }}>
        {K.resto > 0 ? (
          <button onClick={() => setTodos((t) => !t)}
            style={{ background: "transparent", border: "none", color: C.celeste, fontSize: 11, fontWeight: 600, cursor: "pointer", padding: 0, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
            {todos ? K.verMenosLabel : K.verTodosLabel} {todos ? "▴" : "▾"}
          </button>
        ) : <span/>}
        <span style={{ fontFamily: MONO, fontSize: 7.5, letterSpacing: "0.5px", textTransform: "uppercase", color: C.green, border: `1px solid ${C.green}55`, borderRadius: 3, padding: "1px 5px", flexShrink: 0 }}>concilia</span>
      </div>
      <div style={{ fontSize: 10.5, color: C.textMuted, lineHeight: 1.5, marginTop: 6 }}>{K.resumenTope}</div>
      {angosto ? <div style={{ fontSize: 10.5, color: C.textMuted, lineHeight: 1.5, marginTop: 5 }}>{K.notaAngosta}</div> : null}
      <div style={{ fontSize: 10.5, color: C.textMuted, lineHeight: 1.5, marginTop: 5 }}>{K.nota}</div>
    </div>
  );
}

/* (El bloque "Plano de decisión" se ELIMINÓ · owner 2026-08-07: el universo 80/20 se explicaba tres veces —
 * en el soporte del veredicto, en una banda ALCANCE y en esta franja. Quedó UNA sola lectura, arriba, en
 * ResumenVeredictoKPIs. El gráfico de abajo se conserva: es el mapa, no una repetición.) */

/* ── 3 · LA CONCENTRACIÓN · 80/20 con toggle Ventas / Contribución ─────────────────────────────────────────────
 * Contrastar las dos métricas es el punto: dónde una venta grande deja poco valor. Las barras vienen ACOTADAS del
 * módulo (10 entidades + resto de cabeza + cola en desktop · 6 + resto + cola en móvil) pero la línea acumulada y
 * el cruce del 80% se calcularon con TODAS las entidades reales — agrupar es una decisión de dibujo, jamás de
 * aritmética. Cada barra de entidad real abre su Ficha; los agregados no (no son una entidad). */
function ResumenConcentracion({ R, onFicha, onAsk }) {
  const [met, setMet] = useState("ventas");
  const [hov, setHov] = useState(null);
  const P = R.pareto[met] || R.pareto.ventas;
  // EMISIÓN · la pill Ventas/Contribución NO es un detalle de dibujo: cambia la MÉTRICA del gráfico, así que cambia
  // el componente que el usuario está mirando. Dos entradas del manifiesto, una por métrica, y la que viaja es la
  // activa — "explicame este gráfico" no puede resolverse contra la barra que el usuario apagó.
  const vParVentas = useViewContext("comercial/01/pareto-ventas", R, { scenario: R.scenario, onAsk, controles: { met } });
  const vParContrib = useViewContext("comercial/01/pareto-contribucion", R, { scenario: R.scenario, onAsk, controles: { met } });
  const askPareto = (met === "contribucion" ? vParContrib.ask : vParVentas.ask);
  const barras = P.barras || [];
  const n = barras.length;
  if (!n) return null;
  const W = 620, H = 176, padL = 10, padR = 10, padT = 16, padB = 8;
  const plotH = H - padT - padB;
  const slot = (W - padL - padR) / n;
  const bw = Math.min(48, Math.max(10, slot - 12));
  const xc = (i) => padL + (i + 0.5) * slot;
  const maxV = Math.max(...barras.map((b) => b.valor || 0), 1);
  const yBar = (v) => (H - padB) - ((v || 0) / maxV) * plotH * 0.84;
  const yCum = (p) => padT + (1 - (p || 0) / 100) * plotH;
  const dCum = _mono(barras.map((_, i) => xc(i)), barras.map((b) => yCum(b.acumuladoPct)));
  const iCorte = Math.max(0, barras.findIndex((b) => b.acumuladoPct >= 80));
  const fillDe = (b, activo) => (b.tipo === "entidad"
    ? (activo ? "rgba(47,184,218,0.92)" : "rgba(47,184,218,0.62)")
    : b.tipo === "resto-cabeza" ? "rgba(47,184,218,0.24)" : "rgba(255,255,255,0.14)");
  const pill = (k, label) => (
    <button key={k} onClick={() => setMet(k)} aria-pressed={met === k}
      style={{ padding: "3px 11px", borderRadius: 6, border: `1px solid ${met === k ? "rgba(47,184,218,0.5)" : C.border}`, background: met === k ? "rgba(47,184,218,0.10)" : "transparent", color: met === k ? C.celeste : C.textMuted, fontSize: 10.5, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', system-ui, sans-serif" }}>{label}</button>
  );
  return (
    <div style={_RC_CARD}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
        <span style={{ minWidth: 0 }}>
          <span style={{ ..._RC_HEAD, color: C.text, display: "flex", alignItems: "center" }}>
            <span style={{ width: 5, height: 5, borderRadius: 3, background: C.celeste, flexShrink: 0, marginRight: 6, display: "inline-block" }}/>
            Concentración comercial · 80/20
            <InfoDot def={"Las barras son la venta (o la contribución) de cada cliente y la curva lavanda el porcentaje acumulado; la punteada marca el umbral del 80% y el punto ámbar, dónde se cruza de verdad. Las barras están acotadas para que se lean, pero la curva y el cruce se calculan con TODOS tus clientes: agrupar es dibujo, nunca aritmética — por eso las barras (con el resto de la cabeza y la cola incluidos) suman exacto el total. Cambia a Contribución para ver dónde una venta grande deja poco valor. Toca la barra de un cliente y se abre su Ficha."} align="left"/>
          </span>
          {/* el "X clientes explican el Y%" NO se repite acá: ya lo dijo el veredicto (una sola lectura de
              alcance). Este bloque aporta lo que solo él puede aportar — el contraste entre volumen y valor. */}
          <span style={{ display: "block", fontSize: 12.5, color: C.text, lineHeight: 1.5, marginTop: 5 }}>
            Cambia a Contribución: las barras que se achican son las que dejan poco.
          </span>
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <span style={{ display: "flex", gap: 3 }}>{pill("ventas", "Ventas")}{pill("contribucion", "Contribución")}</span>
          {askPareto ? _btnADI(() => askPareto(met === "ventas" ? "¿Qué clientes explican el 80% de mi venta?" : "¿En cuántos clientes se concentra mi contribución?"), "Que ADI lo explique →") : null}
        </span>
      </div>
      {/* el gráfico entero scrollea en horizontal en anchos chicos — nunca se comprime hasta volverse ilegible */}
      <div style={{ overflowX: "auto" }}>
        <div style={{ minWidth: Math.max(300, n * 52), position: "relative", touchAction: "pan-y" }}>
          <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
            <defs>
              <linearGradient id="rcBar" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={C.celeste} stopOpacity="0.85"/>
                <stop offset="100%" stopColor={C.celeste} stopOpacity="0.32"/>
              </linearGradient>
            </defs>
            <line x1={padL} x2={W - padR} y1={yCum(80)} y2={yCum(80)} stroke={C.amber} strokeWidth="1" strokeDasharray="5 3" opacity="0.35"/>
            {barras.map((b, i) => (
              <rect key={b.nombre} x={xc(i) - bw / 2} y={yBar(b.valor)} width={bw} height={Math.max(1, (H - padB) - yBar(b.valor))} rx="2"
                fill={b.tipo === "entidad" ? "url(#rcBar)" : fillDe(b, false)}
                opacity={hov == null || hov === i ? 1 : 0.5}
                style={{ transformBox: "fill-box", transformOrigin: "center bottom", animation: `adiRiseY 420ms cubic-bezier(.2,.7,.3,1) ${i * 28}ms both` }}/>
            ))}
            <path d={dCum} fill="none" stroke={C.lav} strokeWidth="4.5" strokeLinejoin="round" opacity="0.18"/>
            <path d={dCum} fill="none" stroke={C.lav} strokeWidth="1.8" strokeLinejoin="round" opacity="0.95"/>
            <circle cx={xc(iCorte)} cy={yCum(barras[iCorte].acumuladoPct)} r="5.5" fill={C.amber} opacity="0.2"/>
            <circle cx={xc(iCorte)} cy={yCum(barras[iCorte].acumuladoPct)} r="2.8" fill={C.amber}/>
            <rect x="0" y="0" width={W} height={H} fill="transparent"
              onPointerMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); const rel = (e.clientX - r.left) / Math.max(1, r.width); setHov(Math.max(0, Math.min(n - 1, Math.floor((rel * W - padL) / slot)))); }}
              onPointerLeave={() => setHov(null)}/>
          </svg>
          {hov != null && barras[hov] && (
            <div style={{ position: "absolute", top: -2, left: `${(xc(hov) / W) * 100}%`, transform: hov > n / 2 ? "translateX(calc(-100% - 8px))" : "translateX(8px)",
              pointerEvents: "none", background: "#161616", border: `1px solid ${C.borderLight}`, borderRadius: 6, padding: "3px 9px",
              fontFamily: MONO, fontSize: 10.5, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", color: C.textMuted, zIndex: 2 }}>
              <b style={{ color: C.text }}>{barras[hov].nombre}</b> · <span style={{ color: C.celeste }}>{barras[hov].fmt}</span> · <span style={{ color: barras[hov].acumuladoPct <= 80 ? C.green : C.textMuted }}>acum {barras[hov].acumuladoPct}%</span>
            </div>
          )}
          {/* etiquetas · la de una entidad REAL es un botón que abre su Ficha; los agregados no lo son */}
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${n}, 1fr)`, columnGap: 2, padding: "0 1.6%", marginTop: 5 }}>
            {barras.map((b) => {
              const clicable = b.tipo === "entidad" && !!onFicha;
              return (
                <button key={b.nombre} onClick={clicable ? () => onFicha(b.nombre) : undefined} disabled={!clicable}
                  title={clicable ? `Abrir la Ficha de ${b.nombre}` : b.tipo === "cola" ? "Los clientes fuera del plano de decisión · se ven al expandir la cartera completa" : "Los clientes de la cabeza que no entran en el gráfico · se ven al expandir la cartera completa"}
                  style={{ background: "transparent", border: "none", padding: 0, textAlign: "center", overflow: "hidden", cursor: clicable ? "pointer" : "default", fontFamily: MONO }}>
                  <span style={{ display: "block", fontSize: 9.5, color: b.tipo === "entidad" ? C.textSub : C.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.nombre}</span>
                  <span style={{ display: "block", fontSize: 9, color: C.textMuted, fontVariantNumeric: "tabular-nums" }}>{b.fmt}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
      {/* el pie aporta SOLO lo que el gráfico sabe y el veredicto no dijo: dónde se cruza el 80% de verdad */}
      <div style={{ fontSize: 10.5, color: C.textMuted, lineHeight: 1.5, marginTop: 10, paddingTop: 9, borderTop: `1px solid ${C.border}` }}>
        {P.nota}{P.agrupadas ? ` ${P.agrupadas === 1 ? "1 cliente de la cabeza se agrupó" : `${P.agrupadas} clientes de la cabeza se agruparon`} para que el gráfico se lea; la curva y el cruce salen de los ${P.entidadesReales}.` : ""}
      </div>
    </div>
  );
}

/* ── EL AÑO, MES A MES · tres líneas que reconcilian ───────────────────────────────────────────────────────────
 * El owner lo pidió de vuelta: "es súper fácil identificar puntos bajos y altos, debería tener la línea año
 * anterior y presupuesto". Las tres series vienen del módulo YA ancladas a la venta oficial — por eso el total del
 * gráfico cierra exacto con el KPI de arriba, que es justo lo que un BI no te garantiza. El presupuesto NO se
 * ancla (es un plan, no tiene contraparte por cliente) y la vista lo declara en vez de disimularlo.
 * Cada serie lleva su estatus: probado el dato real, indicado el plan. */
const _RC_SERIE_COL = { actual: C.elec, anterior: C.teal, presupuesto: C.lav };
function ResumenEvolutivo({ ev, R = null, onAsk }) {
  const [oculta, setOculta] = useState({});            // las TRES arrancan visibles (regla del owner)
  const [hov, setHov] = useState(null);
  // EMISIÓN · el contexto se deriva de `R` (la salida completa del builder), no de `ev`: el manifiesto declara el
  // path `evolutivo` contra buildResumenComercial, y esa es la única forma de que el componente no dependa de que
  // alguien recuerde qué pedacito le pasaron por props. Las series apagadas viajan como control declarado.
  const { ask: askEvo } = useViewContext("comercial/01/evolutivo-serie", R, {
    scenario: R && R.scenario, onAsk,
    controles: { oculta: Object.keys(oculta).filter((k) => oculta[k]).sort().join(",") || "ninguna" },
  });
  if (!ev || !ev.series || !ev.series.length) return null;
  const vivas = ev.series.filter((s) => !oculta[s.key]);
  const meses = ev.meses, n = meses.length;
  const W = 620, H = 186, padL = 42, padR = 14, padT = 16, padB = 24;
  const vals = vivas.flatMap((s) => s.valores);
  const lo0 = vals.length ? Math.min(...vals) : 0, hi0 = vals.length ? Math.max(...vals) : 1;
  const pad = (hi0 - lo0) * 0.12 || 1, ylo = Math.max(0, lo0 - pad), yhi = hi0 + pad;
  const xAt = (i) => padL + (n <= 1 ? 0 : (i / (n - 1)) * (W - padL - padR));
  const yAt = (v) => padT + (1 - (v - ylo) / (yhi - ylo || 1)) * (H - padT - padB);
  const serieActual = ev.series.find((s) => s.key === "actual");
  const iMax = serieActual ? serieActual.valores.indexOf(Math.max(...serieActual.valores)) : -1;
  const iMin = serieActual ? serieActual.valores.indexOf(Math.min(...serieActual.valores)) : -1;
  const grid = [yhi, (yhi + ylo) / 2, ylo];
  return (
    <div style={_RC_CARD}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
        <span style={{ minWidth: 0 }}>
          <span style={{ ..._RC_HEAD, color: C.text, display: "flex", alignItems: "center" }}>
            <span style={{ width: 5, height: 5, borderRadius: 3, background: C.celeste, flexShrink: 0, marginRight: 6, display: "inline-block" }}/>
            El año, mes a mes
            <InfoDot def={"Las tres series del período: este año, el año anterior y el presupuesto que declaraste. Las dos reales están ANCLADAS al total oficial de venta por cliente, así que el cierre del gráfico es el mismo número del KPI de arriba — no dos verdades al lado. El presupuesto no se ancla porque no existe presupuesto por cliente contra el cual conciliarlo, y eso se dice. Toca una serie de la leyenda para apagarla y pasa el cursor para ver mes por mes. Los puntos marcados son el mes más alto y el más bajo del año en foco."} align="left"/>
          </span>
          <span style={{ display: "block", fontSize: 12.5, color: C.text, lineHeight: 1.5, marginTop: 5 }}>{ev.lectura}</span>
        </span>
        {askEvo ? <span style={{ flexShrink: 0 }}>{_btnADI(() => askEvo("¿Cómo viene la venta mes a mes este año?"), "Que ADI lo explique →")}</span> : null}
      </div>
      {/* la leyenda ES el control: cada serie con su total y su estatus (probado / indicado) */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px", marginBottom: 8 }}>
        {ev.series.map((s) => { const off = !!oculta[s.key]; const col = _RC_SERIE_COL[s.key] || C.textMuted; return (
          <button key={s.key} onClick={() => setOculta((o) => ({ ...o, [s.key]: !o[s.key] }))} title={s.nota}
            style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "none", padding: 0, cursor: "pointer", fontFamily: "'DM Sans', system-ui, sans-serif", opacity: off ? 0.4 : 1, transition: "opacity 0.15s" }}>
            <span style={{ width: 14, height: 0, borderTop: `${s.key === "actual" ? 2.5 : 2}px ${s.key === "actual" ? "solid" : "dashed"} ${col}`, flexShrink: 0 }}/>
            <span style={{ fontSize: 11.5, color: off ? C.textMuted : C.textSub }}>{s.label}</span>
            <span style={{ fontFamily: MONO, fontSize: 11.5, fontWeight: 600, color: off ? C.textMuted : col, fontVariantNumeric: "tabular-nums" }}>{s.totalFmt}</span>
            <span style={{ fontFamily: MONO, fontSize: 8, letterSpacing: "0.5px", textTransform: "uppercase", color: _rcEstatusCol(s.estatus), border: `1px solid ${_rcEstatusCol(s.estatus)}55`, borderRadius: 3, padding: "1px 4px" }}>{s.estatus}</span>
          </button>
        ); })}
      </div>
      <div style={{ overflowX: "auto" }}>
        <div style={{ minWidth: 300, position: "relative", touchAction: "pan-y" }}>
          <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
            {/* SOMBREADO BAJO LA CURVA DEL AÑO EN FOCO (owner 2026-08-20: «el gráfico debe estar sombreado»).
                Solo la serie actual lleva relleno: si lo llevaran las tres, tres velos superpuestos taparían
                justamente las diferencias que el gráfico existe para mostrar. Se desvanece hacia abajo. */}
            <defs>
              <linearGradient id="rcAreaActual" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={C.elec} stopOpacity="0.30"/>
                <stop offset="100%" stopColor={C.elec} stopOpacity="0"/>
              </linearGradient>
            </defs>
            {!oculta.actual && serieActual && (
              <path d={`${_mono(serieActual.valores.map((_, i) => xAt(i)), serieActual.valores.map((v) => yAt(v)))} L ${xAt(n - 1)},${H - padB} L ${xAt(0)},${H - padB} Z`}
                fill="url(#rcAreaActual)" stroke="none"/>
            )}
            {/* LÍNEAS DE LA GRILLA MÁS CLARAS (owner: «no se ve bien así»): 0.06 era casi invisible sobre negro. */}
            {grid.map((g, i) => (
              <g key={i}>
                <line x1={padL} x2={W - padR} y1={yAt(g)} y2={yAt(g)} stroke="rgba(255,255,255,0.14)" strokeWidth="1"/>
                <text x={padL - 6} y={yAt(g) + 3} textAnchor="end" fontFamily={MONO} fontSize="8.5" fill={C.textMuted}>{`$${(g / 1000).toFixed(1)}M`}</text>
              </g>
            ))}
            {vivas.map((s) => {
              const col = _RC_SERIE_COL[s.key] || C.textMuted;
              const d = _mono(s.valores.map((_, i) => xAt(i)), s.valores.map((v) => yAt(v)));
              return <path key={s.key} d={d} fill="none" stroke={col} strokeWidth={s.key === "actual" ? 2.2 : 1.5}
                strokeDasharray={s.key === "actual" ? undefined : "5 4"} strokeLinejoin="round" opacity={s.key === "actual" ? 1 : 0.85}/>;
            })}
            {/* el mes más alto y el más bajo del año en foco — describe el movimiento, nunca su causa */}
            {/* PARPADEAN (owner 2026-08-20). El latido es SMIL, nunca un filtro SVG: los filtros sobre paths
                colgaron el compositor la última vez que se probaron acá. Los dos laten con el mismo ritmo y en
                fase: son las dos puntas de la MISMA historia —el mejor mes y el más flojo—, y desincronizarlos
                los convertiría en dos alarmas sueltas. `prefers-reduced-motion` los deja quietos. */}
            {!oculta.actual && serieActual && iMax >= 0 && (<>
              <circle cx={xAt(iMax)} cy={yAt(serieActual.valores[iMax])} r="3.4" fill={C.green}>
                <animate attributeName="opacity" values="1;0.35;1" dur="2.4s" repeatCount="indefinite"/>
              </circle>
              <circle cx={xAt(iMin)} cy={yAt(serieActual.valores[iMin])} r="3.4" fill={C.red}>
                <animate attributeName="opacity" values="1;0.35;1" dur="2.4s" repeatCount="indefinite"/>
              </circle>
            </>)}
            {hov != null && <line x1={xAt(hov)} x2={xAt(hov)} y1={padT} y2={H - padB} stroke="rgba(255,255,255,0.16)" strokeWidth="1"/>}
            {meses.map((m, i) => (
              <text key={m} x={xAt(i)} y={H - 7} textAnchor="middle" fontFamily={MONO} fontSize="8.5" fill={i === iMax ? C.green : i === iMin ? C.red : C.textMuted}>{m}</text>
            ))}
            <rect x="0" y="0" width={W} height={H} fill="transparent"
              onPointerMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); const rel = (e.clientX - r.left) / Math.max(1, r.width); setHov(Math.max(0, Math.min(n - 1, Math.round(((rel * W) - padL) / ((W - padL - padR) / Math.max(n - 1, 1)))))); }}
              onPointerLeave={() => setHov(null)}/>
          </svg>
          {hov != null && (
            <div style={{ position: "absolute", top: 0, left: `${(xAt(hov) / W) * 100}%`, transform: hov > n / 2 ? "translateX(calc(-100% - 8px))" : "translateX(8px)",
              pointerEvents: "none", background: "#161616", border: `1px solid ${C.borderLight}`, borderRadius: 6, padding: "5px 9px",
              fontFamily: MONO, fontSize: 10.5, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", color: C.textMuted, zIndex: 2 }}>
              <b style={{ color: C.text }}>{meses[hov]}</b>
              {vivas.map((s) => (
                <span key={s.key} style={{ display: "block", color: _RC_SERIE_COL[s.key] }}>{s.label}: ${(s.valores[hov] / 1000).toFixed(1)}M</span>
              ))}
            </div>
          )}
        </div>
      </div>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 8, fontSize: 10.5, color: C.textMuted }}>
        <span><span style={{ color: C.green }}>●</span> mes más alto · {ev.maxMes} {ev.maxFmt}</span>
        <span><span style={{ color: C.red }}>●</span> mes más bajo · {ev.minMes} {ev.minFmt}</span>
        {ev.caida ? <span>mayor caída · {ev.caida.desde}→{ev.caida.mes} {ev.caida.fmt}</span> : null}
      </div>
      <div style={{ fontSize: 10.5, color: C.textMuted, lineHeight: 1.5, marginTop: 6 }}>{ev.nota}</div>
    </div>
  );
}

/* ── QUIÉN SOSTIENE EL NEGOCIO · el 80% que mueve la aguja, por cuatro perspectivas ────────────────────────────
 * Owner 2026-08-07: una sola sección basada en el 80%, con Clientes y Familias como las dos vistas principales
 * (SKU y Canales viven en el mismo selector: son el mismo tipo de corte y no duplican pantalla). Cada eje trae SU
 * grupo 80% — calculado, no un top-N — y la cartera entera detrás de un switch. Y cada uno declara si concilia con
 * la venta oficial: decir cuándo una tabla cierra y cuándo es otro corte del dato es lo que un BI no hace. */
const _RC_TH = { color: C.textMuted, fontFamily: MONO, fontSize: 9.5, textTransform: "uppercase", letterSpacing: "0.5px", borderBottom: `1px solid ${C.border}`, padding: "4px 6px" };
const _RC_TD = { padding: "5px 6px", textAlign: "right", fontFamily: MONO, fontSize: 11.5, fontVariantNumeric: "tabular-nums", overflow: "hidden", textOverflow: "ellipsis" };
const _RC_COLW = ["25%", "12%", "12%", "13%", "11%", "12%", "15%"];
function ResumenSostiene({ R, onFicha, onAsk }) {
  const S = R.sostiene;
  const [eje, setEje] = useState(S ? S.porDefecto : null);
  const [todos, setTodos] = useState(false);
  // EMISIÓN · CUATRO componentes, uno por eje, porque son cuatro UNIVERSOS distintos (clientes concilia con la
  // venta oficial; familias y SKU son otro corte y lo declaran). El eje activo y el switch 80%/completos son
  // controles declarados: "cuáles de estos" significa cosas distintas en cada combinación, y el contexto lo dice
  // en vez de dejar que el narrador lo suponga.
  const _vEje = S && S.vistas.length ? (S.vistas.find((x) => x.key === eje) || S.vistas[0]) : null;
  const _ctrl = { eje: _vEje ? _vEje.key : "", todos: todos ? "1" : "0" };
  const _o = { scenario: R.scenario, onAsk, controles: _ctrl };
  const vSosCliente = useViewContext("comercial/01/sostiene-clientes", R, _o);
  const vSosFamilia = useViewContext("comercial/01/sostiene-familias", R, _o);
  const vSosSku = useViewContext("comercial/01/sostiene-sku", R, _o);
  const vSosCanal = useViewContext("comercial/01/sostiene-canales", R, _o);
  const askSostiene = ({ cliente: vSosCliente.ask, familia: vSosFamilia.ask, sku: vSosSku.ask, canal: vSosCanal.ask })[_vEje ? _vEje.key : ""] || vSosCliente.ask;
  if (!S || !S.vistas.length) return null;
  const v = S.vistas.find((x) => x.key === eje) || S.vistas[0];
  const filas = todos ? v.filas : v.filas.filter((f) => f.enGrupo);
  const navegable = v.key === "cliente" && !!onFicha;   // la Ficha Ejecutiva es de CLIENTE: prometerla en otro eje sería mentir
  return (
    <div style={_RC_CARD}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
        <span style={{ minWidth: 0, flex: "1 1 250px" }}>
          <span style={{ ..._RC_HEAD, color: C.text, display: "flex", alignItems: "center" }}>
            <span style={{ width: 5, height: 5, borderRadius: 3, background: C.celeste, flexShrink: 0, marginRight: 6, display: "inline-block" }}/>
            Quién sostiene el negocio
            <InfoDot def={`El sustento económico del negocio desde cuatro perspectivas del mismo dato: qué CLIENTES y qué FAMILIAS mueven la venta, y —cuando aportan— SKU y canales. Cada eje trae su propio grupo 80%, calculado con el mismo motor de concentración que el resto de la vista, no un top-N fijo. Cada eje declara además si cierra con la venta oficial por cliente: los que no cierran lo dicen, con su diferencia, y sus márgenes NO se reescalan para forzar el cuadre — son justo la cifra que vienes a mirar. ${S.limitacion}`} align="left"/>
          </span>
          {/* LA LECTURA SE FUE ABAJO (owner 2026-08-08: "lo que dice arriba podés decirlo abajo, así no queda
              repetitivo"). Arriba anticipaba en prosa lo que la tabla muestra tres centímetros después; abajo es
              la CONCLUSIÓN de lo que se acaba de leer, que es donde una conclusión sirve. */}
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, flexWrap: "wrap" }}>
          <span style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
            {S.vistas.map((x) => (
              <button key={x.key} onClick={() => { setEje(x.key); setTodos(false); }} aria-pressed={v.key === x.key}
                style={{ padding: "3px 11px", borderRadius: 6, border: `1px solid ${v.key === x.key ? "rgba(47,184,218,0.5)" : C.border}`, background: v.key === x.key ? "rgba(47,184,218,0.10)" : "transparent", color: v.key === x.key ? C.celeste : C.textMuted, fontSize: 10.5, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', system-ui, sans-serif", whiteSpace: "nowrap" }}>
                {x.label} ({x.grupoN})
              </button>
            ))}
          </span>
          {askSostiene ? _btnADI(() => askSostiene("¿Quiénes son mis principales clientes por venta?"), "Que ADI lo explique →") : null}
        </span>
      </div>
      <div style={{ overflowX: "auto", marginTop: 8 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5, minWidth: 620, tableLayout: "fixed" }}>
          <colgroup>{_RC_COLW.map((w, i) => <col key={i} style={{ width: w }}/>)}</colgroup>
          <thead><tr>{S.columnas.map((c) => <th key={c.key} style={{ ..._RC_TH, textAlign: c.align }}>{c.label}</th>)}</tr></thead>
          <tbody>{filas.map((f) => (
            <tr key={f.nombre}>
              <td style={{ padding: "5px 6px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {navegable ? (
                  <button onClick={() => onFicha(f.nombre)} title={`Abrir la Ficha de ${f.nombre}`}
                    style={{ background: "transparent", border: "none", padding: 0, color: C.text, fontSize: 11.5, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', system-ui, sans-serif", borderBottom: "1px solid rgba(47,184,218,0.35)" }}>{f.nombre}</button>
                ) : <span style={{ color: C.text, fontWeight: 600 }}>{f.nombre}</span>}
                {todos && f.enGrupo ? <span title="Está dentro del grupo que explica el 80% de la venta" style={{ marginLeft: 5, fontFamily: MONO, fontSize: 8, color: C.celeste, border: "1px solid rgba(47,184,218,0.4)", borderRadius: 3, padding: "0 3px" }}>80%</span> : null}
              </td>
              <td style={{ ..._RC_TD, color: C.textSub }}>{f.pesoFmt}</td>
              <td style={{ ..._RC_TD, color: C.textSub }}>{f.ventaFmt}</td>
              <td style={{ ..._RC_TD, color: C.textSub }}>{f.contribucionFmt}</td>
              <td style={{ ..._RC_TD, color: C.text }} title={`contra tu benchmark de ${f.varaFmt}`}>{f.margenFmt}</td>
              <td style={{ ..._RC_TD, color: f.material ? C.amber : f.bajoBenchmark ? C.textSub : C.green }}>{f.brechaFmt}</td>
              <td style={{ ..._RC_TD, color: f.sobreMeta ? C.amber : C.textSub }} title={f.sobreMeta ? `sobre tu meta de ${p1(POLICY.targetCarga)}%` : `en o bajo tu meta de ${p1(POLICY.targetCarga)}%`}>{f.cargaFmt}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginTop: 8 }}>
        {v.colaN > 0 ? (
          <button onClick={() => setTodos((t) => !t)}
            style={{ background: "transparent", border: "none", color: C.celeste, fontSize: 11, fontWeight: 600, cursor: "pointer", padding: 0, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
            {todos ? `Ver solo el grupo que explica el ${v.grupoPctFmt}` : `Ver ${v.label.toLowerCase()} completos (${v.n})`} {todos ? "▴" : "▾"}
          </button>
        ) : <span/>}
        <span style={{ display: "flex", alignItems: "center", gap: 7, flexShrink: 0 }}>
          <span style={{ fontFamily: MONO, fontSize: 7.5, letterSpacing: "0.5px", textTransform: "uppercase", color: v.reconcilia ? C.green : C.amber, border: `1px solid ${v.reconcilia ? C.green : C.amber}55`, borderRadius: 3, padding: "1px 5px" }}>{v.reconcilia ? "concilia" : "otro corte"}</span>
        </span>
      </div>
      <div style={{ fontSize: 12.5, color: C.text, lineHeight: 1.5, marginTop: 9, paddingTop: 9, borderTop: `1px solid ${C.border}` }}>{v.lectura}</div>
      <div style={{ fontSize: 10.5, color: C.textMuted, lineHeight: 1.5, marginTop: 6 }}>{v.notaFuente}</div>
      <div style={{ fontSize: 10.5, color: C.textMuted, lineHeight: 1.5, marginTop: 5 }}>{S.nota}</div>
      {/* EL PORQUÉ, PEGADO A LA TABLA QUE LO NECESITA (owner 2026-08-08) · solo en el eje CLIENTE: el análisis se
          construye cuenta por cuenta y prometerlo en familias o SKU sería prometer algo que no existe. */}
      {v.key === "cliente" && R.deterioro && R.deterioro.margen ? (
        <ResumenPorQue pq={R.deterioro.margen.porQue} R={R} onFicha={onFicha} onAsk={onAsk}/>
      ) : null}
    </div>
  );
}

/* ── VENDEN MUCHO PERO DEJAN POCO · POR QUÉ ────────────────────────────────────────────────────────────────────
 * Owner 2026-08-08: "las cuentas que venden mucho y dejan poco margen deberíamos integrarlas en la sección de la
 * segunda foto; tal vez podría dejar un botón que diga «clientes que venden mucho pero dejan poco margen: por
 * qué», y ahí se despliega."
 *
 * Y es su lugar: estas cuentas son FILAS DE ESA MISMA TABLA. Vivían en el bloque 02, a dos pantallas de la tabla
 * que las nombra, y el lector tenía que acordarse de quiénes eran. Acá está pegado, y CERRADO por defecto: la
 * pregunta la hace quien la tiene, no la pantalla.
 *
 * La aritmética que responde: la brecha de una cuenta contra el promedio se parte SIEMPRE en dos términos que
 * suman exacto — lo que le entregás (medido) y la relación entre su precio y su costo. Dos cuentas con la misma
 * brecha pueden tener causas opuestas, y se arreglan distinto. */
function ResumenPorQue({ pq, R = null, onFicha, onAsk = null }) {
  const [abierto, setAbierto] = useState(false);
  // EMISIÓN SIN BOTÓN NUEVO: este bloque no tiene "Que ADI lo explique" y no se le agrega uno (las visuales no se
  // tocan). Lo que sí hace es INFORMAR el contexto al desplegarse — la regla del owner desde 2026-07-08: el click
  // informa, nunca dispara. Si después el usuario escribe "¿por qué este cliente me deja poco margen?" en el chat,
  // ADI ya sabe que lo está preguntando sobre ESTA descomposición y no sobre el margen en general.
  const { ctx: ctxPorQue } = useViewContext("comercial/01/porque-vende-mucho-deja-poco", R, {
    scenario: R && R.scenario, onAsk, controles: { abierto: abierto ? "1" : "0" },
  });
  if (!pq || !pq.filas.length) return null;
  return (
    <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.borderLight}` }}>
      <button onClick={() => setAbierto((a) => { const n = !a; if (n && ctxPorQue) setUISignal({ viewContext: ctxPorQue }); return n; })} aria-expanded={abierto}
        style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", background: "transparent", border: "none", padding: 0, color: C.celeste, fontSize: 11.5, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', system-ui, sans-serif", textAlign: "left" }}>
        Clientes que venden mucho pero dejan poco margen: por qué ({pq.n}) <span>{abierto ? "▴" : "▾"}</span>
      </button>
      {abierto && (
        <div style={{ marginTop: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
            {_rcChip(pq.estatus)}
            <span style={{ fontSize: 11.5, color: C.textSub, lineHeight: 1.55 }}>{pq.lectura}</span>
            <InfoDot def={pq.nota} align="left"/>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {pq.filas.map((x) => (
              <div key={x.nombre} style={{ padding: "10px 13px", borderRadius: 10, border: `1px solid ${C.border}`, background: "rgba(255,255,255,0.018)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span style={{ flex: "0 1 132px", minWidth: 104 }}>
                    {onFicha ? <button onClick={() => onFicha(x.nombre)} title={`Abrir la Ficha de ${x.nombre}`} style={{ background: "transparent", border: "none", padding: 0, color: C.text, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', system-ui, sans-serif", borderBottom: "1px solid rgba(47,184,218,0.35)" }}>{x.nombre}</button> : <span style={{ color: C.text, fontSize: 13, fontWeight: 600 }}>{x.nombre}</span>}
                    <span style={{ display: "block", fontFamily: MONO, fontSize: 9.5, color: C.textMuted, marginTop: 2, fontVariantNumeric: "tabular-nums" }}>{x.ventaFmt} · {x.participacionFmt} de la venta</span>
                  </span>
                  {/* la cifra de la fila va en blanco: el color de este bloque lo lleva el término dominante,
                      que es lo único que hay que mirar para saber por dónde se arregla */}
                  <span style={{ display: "flex", alignItems: "baseline", gap: 6, flexShrink: 0 }}>
                    <span style={{ fontFamily: MONO, fontSize: 13.5, fontWeight: 600, color: C.text, fontVariantNumeric: "tabular-nums" }}>{x.margenFmt}</span>
                    <span style={{ fontFamily: MONO, fontSize: 11, color: C.textSub, fontVariantNumeric: "tabular-nums" }}>{x.brechaFmt}</span>
                  </span>
                  {/* LA BRECHA PARTIDA EN SUS DOS TÉRMINOS · el dominante resaltado, el otro apagado */}
                  <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8, flexShrink: 0, fontFamily: MONO, fontSize: 10.5, fontVariantNumeric: "tabular-nums" }}>
                    <span title={`opera con ${x.cargaFmt} de acciones comerciales contra el ${pq.cargaPromFmt} de la cartera`}
                      style={{ color: x.dominante === "acciones" ? C.amber : C.textMuted, fontWeight: x.dominante === "acciones" ? 600 : 400 }}>
                      acciones {x.efCargaFmt}
                    </span>
                    <span style={{ color: C.textMuted }}>·</span>
                    <span title={x.contexto || "la relación entre su precio y su costo"}
                      style={{ color: x.dominante === "precio/costo" ? C.amber : C.textMuted, fontWeight: x.dominante === "precio/costo" ? 600 : 400 }}>
                      precio/costo {x.efCostoFmt}
                    </span>
                  </span>
                </div>
                <div style={{ fontSize: 11.5, color: C.textSub, lineHeight: 1.55, marginTop: 7 }}>{x.lectura}</div>
                {/* EL CONTEXTO UNITARIO va SIEMPRE, no solo cuando domina el término de precio/costo: saber si
                    vende más caro o más barato que el resto dice si hay lugar para mover el precio o no. */}
                {x.contexto && !x.lectura.includes(x.contexto) && (
                  <div style={{ fontSize: 11, color: C.textMuted, lineHeight: 1.5, marginTop: 4 }}>{x.contexto}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── DÓNDE SE FRENA LA VENTA Y DÓNDE SE DILUYE EL MARGEN ───────────────────────────────────────────────────────
 * El bloque 02 completo: la identidad del margen como marco, y debajo los DOS deterioros lado a lado. El izquierdo
 * solo puede afirmarse contra una referencia autorizada, así que declara CUÁL usa — y la descomposición de precio
 * y volumen aparece únicamente contra el año anterior, que es la única referencia que trae unidades. */
function ResumenDeterioro({ R, onFicha, onAsk }) {
  const d = R.deterioro;
  // la referencia de las acciones comerciales: el PROMEDIO de tu cartera (realista) o tu META (aspiracional).
  // Arranca en el promedio — es la que el owner pidió: compararte con vos mismo antes que con un ideal.
  const [varaAcc, setVaraAcc] = useState("promedio");
  // EMISIÓN · la pill de referencia (promedio de tu cartera / tu meta) NO es un filtro cosmético: cambia la VARA y
  // con ella el universo y el monto recuperable. Son dos entradas del manifiesto y viaja la activa — además, la de
  // "promedio de tu cartera" está declarada `sinTool` (ninguna tool conoce esa vara), así que ADI puede decir el
  // límite en vez de contestar con la cifra de la meta creyendo que es la misma.
  const _oD = { scenario: R.scenario, onAsk, controles: { varaAcc } };
  const vAccProm = useViewContext("comercial/02/acciones-vs-promedio-cartera", R, _oD);
  const vAccMeta = useViewContext("comercial/02/acciones-vs-meta", R, _oD);
  const vCostoPrecio = useViewContext("comercial/02/costo-contra-precio", R, { scenario: R.scenario, onAsk });
  const ctxAcc = (varaAcc === "meta" ? vAccMeta.ctx : vAccProm.ctx);
  if (!d) return null;
  const acc = d.margen.acciones, cp = d.margen.costoPrecio, pq = d.margen.porQue;
  const ra = acc ? (acc.referencias.find((x) => x.key === varaAcc) || acc.referencias[0]) : null;
  const _chip = (estatus, texto) => (
    <span style={{ fontFamily: MONO, fontSize: 7.5, letterSpacing: "0.5px", textTransform: "uppercase", color: _rcEstatusCol(estatus), border: `1px solid ${_rcEstatusCol(estatus)}55`, borderRadius: 3, padding: "1px 5px", flexShrink: 0 }}>{texto || estatus}</span>
  );
  return (
    <div style={_RC_CARD}>
      {/* SOLO LAS DOS CAUSAS DEL MARGEN (owner 2026-08-07: "dejá solo lo que está en la foto"). Salieron de
          esta sección la identidad venta−costo−acciones=contribución, la VENTA NO ALCANZADA y el detalle de
          MARGEN NO CAPTURADO. Los datos siguen vivos en el módulo: `deterioro.venta` es lo que alimenta el
          cruce del bloque 03 —una cuenta bajo presupuesto Y bajo benchmark es la que no hay que empujar con
          descuento—, así que sacarlos de la vista no rompe esa lectura. */}
        {/* ── LAS DOS CAUSAS DEL MARGEN (owner 2026-08-07) ──────────────────────────────────────────────────────
            "Hay dos cosas que nos hacen perder margen: acciones comerciales y variación de costos, porque afecta
            el precio." Las dos se miden acá, cada una contra su propia referencia y con su monto. ── */}
        <div style={{}}>
          <div style={{ ..._RC_HEAD, color: C.text, display: "flex", alignItems: "center", marginBottom: 10 }}>
            <span style={{ width: 5, height: 5, borderRadius: 3, background: C.celeste, flexShrink: 0, marginRight: 6, display: "inline-block" }}/>
            Qué mueve el margen
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
            {/* A · ACCIONES COMERCIALES · contra el promedio de tu cartera Y contra tu meta */}
            {acc && (
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginBottom: 7 }}>
                  <span style={{ ..._RC_HEAD, fontSize: 9, color: C.text, display: "flex", alignItems: "center", gap: 4 }}>
                    Acciones comerciales{_chip("probado")}
                    <InfoDot def={`${acc.referencias[0].nota} ${acc.referencias[1].nota} Cambia la referencia y el monto se recalcula con las cuentas que quedan por encima de ella.`} align="left"/>
                  </span>
                  <span style={{ display: "flex", gap: 3 }}>
                    {acc.referencias.map((x) => (
                      // cambiar de vara INFORMA el contexto (nunca dispara): el turno siguiente sabe contra qué
                      // referencia está mirando el usuario, que es de dónde salen dos montos distintos y legítimos.
                      <button key={x.key} onClick={() => { setVaraAcc(x.key); const c = (x.key === "meta" ? vAccMeta.ctx : vAccProm.ctx); if (c) setUISignal({ viewContext: c }); }} aria-pressed={ra.key === x.key}
                        style={{ padding: "2px 9px", borderRadius: 6, border: `1px solid ${ra.key === x.key ? "rgba(47,184,218,0.5)" : C.border}`, background: ra.key === x.key ? "rgba(47,184,218,0.10)" : "transparent", color: ra.key === x.key ? C.celeste : C.textMuted, fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', system-ui, sans-serif", whiteSpace: "nowrap" }}>{x.refFmt}</button>
                    ))}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontFamily: MONO, fontSize: 20, fontWeight: 600, color: ra.n ? C.green : C.textMuted, fontVariantNumeric: "tabular-nums" }}>{ra.n ? ra.totalFmt : "—"}</span>
                  <span style={{ fontSize: 11, color: C.textMuted }}>{ra.n ? `recuperables llevando ${ra.n} ${ra.n === 1 ? "cuenta" : "cuentas"} ${ra.label} (${ra.refFmt})` : `ninguna cuenta entrega más que ${ra.refFmt}`}</span>
                </div>
                {ra.n > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 9 }}>
                    {ra.filas.slice(0, 4).map((x) => (
                      <div key={x.nombre} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", padding: "6px 9px", borderRadius: 8, border: `1px solid ${C.border}`, background: "rgba(255,255,255,0.015)" }}>
                        <span style={{ flex: "0 1 110px", minWidth: 88, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {onFicha ? <button onClick={() => { if (ctxAcc) setUISignal({ viewContext: ctxAcc }); onFicha(x.nombre); }} title={`Abrir la Ficha de ${x.nombre}`} style={{ background: "transparent", border: "none", padding: 0, color: C.text, fontSize: 11.5, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', system-ui, sans-serif", borderBottom: "1px solid rgba(47,184,218,0.35)" }}>{x.nombre}</button> : <span style={{ color: C.text, fontSize: 11.5, fontWeight: 600 }}>{x.nombre}</span>}
                        </span>
                        {/* ROJO, no ámbar (owner 2026-08-08): esta cifra es lo que la cuenta ENTREGA por encima
                            del promedio de la cartera — plata que sale. El exceso en pp y el recuperable en verde
                            se quedan como estaban: son lo que se genera o se recupera, no lo que se cede. */}
                        <span style={{ fontFamily: MONO, fontSize: 10.5, color: C.red, fontVariantNumeric: "tabular-nums", flexShrink: 0 }} title={`entrega ${x.cargaFmt} de su venta`}>{x.cargaFmt}</span>
                        <span style={{ fontFamily: MONO, fontSize: 10, color: C.textMuted, fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>+{x.excesoFmt}</span>
                        <span style={{ marginLeft: "auto", fontFamily: MONO, fontSize: 11.5, fontWeight: 600, color: C.text, fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>{x.recuperableFmt}</span>
                      </div>
                    ))}
                    {ra.filas.length > 4 && <span style={{ fontSize: 10.5, color: C.textMuted }}>+{ra.filas.length - 4} más.</span>}
                  </div>
                )}
                <div style={{ fontSize: 11.5, color: C.textSub, lineHeight: 1.55, marginTop: 9, paddingLeft: 10, borderLeft: `2px solid ${C.border}` }}>{acc.lectura}</div>
                {/* "DEL OTRO LADO" SE ELIMINÓ (owner 2026-08-08: "eso no aporta mucho"). Listaba las 8 cuentas
                    que entregan por debajo del promedio. Era honesto —decía explícito que NO son plata a capturar—
                    pero justamente por eso no movía ninguna decisión: ocho chips y tres líneas para concluir que
                    ahí no hay nada que hacer. El dato sigue en el módulo (acciones.bajo) si alguna vez vuelve. */}
              </div>
            )}
            {/* B · COSTO CONTRA PRECIO · si el costo sube más que el precio, el margen por unidad se comprime */}
            {cp && (
              <div>
                <div style={{ ..._RC_HEAD, fontSize: 9, color: C.text, marginBottom: 7, display: "flex", alignItems: "center", gap: 4 }}>
                  Costo contra precio{_chip(cp.estatus)}
                  <InfoDot def={cp.nota} align="left"/>
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontFamily: MONO, fontSize: 20, fontWeight: 600, color: cp.comprimenN ? C.red : C.green, fontVariantNumeric: "tabular-nums" }}>{cp.comprimenN ? `−${cp.perdidaFmt}` : `+${cp.gananciaFmt}`}</span>
                  <span style={{ fontSize: 11, color: C.textMuted }}>{cp.comprimenN ? `de margen perdido en ${cp.comprimenN} ${cp.comprimenN === 1 ? "cuenta donde el costo subió" : "cuentas donde el costo subió"} más que el precio` : `de margen ganado: el costo cedió más de lo que el precio subió, de ${cp.desde} a ${cp.hasta}`}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 9 }}>
                  {cp.filas.slice(0, 4).map((x) => (
                    <div key={x.nombre} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", padding: "6px 9px", borderRadius: 8, border: `1px solid ${C.border}`, background: "rgba(255,255,255,0.015)" }}>
                      <span style={{ flex: "0 1 106px", minWidth: 84, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {onFicha ? <button onClick={() => { if (vCostoPrecio.ctx) setUISignal({ viewContext: vCostoPrecio.ctx }); onFicha(x.nombre); }} title={`Abrir la Ficha de ${x.nombre}`} style={{ background: "transparent", border: "none", padding: 0, color: C.text, fontSize: 11.5, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', system-ui, sans-serif", borderBottom: "1px solid rgba(47,184,218,0.35)" }}>{x.nombre}</button> : <span style={{ color: C.text, fontSize: 11.5, fontWeight: 600 }}>{x.nombre}</span>}
                      </span>
                      <span style={{ fontFamily: MONO, fontSize: 10, color: C.textSub, fontVariantNumeric: "tabular-nums", flexShrink: 0 }} title={`costo unitario ${x.costoA} → ${x.costoZ}`}>costo {x.dCostoFmt}</span>
                      <span style={{ fontFamily: MONO, fontSize: 10, color: C.textSub, fontVariantNumeric: "tabular-nums", flexShrink: 0 }} title={`precio por unidad ${x.precioA} → ${x.precioZ}`}>precio {x.dPrecioFmt}</span>
                      <span style={{ marginLeft: "auto", fontFamily: MONO, fontSize: 11.5, fontWeight: 600, color: C.text, fontVariantNumeric: "tabular-nums", flexShrink: 0 }} title={`${x.efectoUniFmt} por unidad`}>{x.efectoFmt}</span>
                    </div>
                  ))}
                  {cp.filas.length > 4 && <span style={{ fontSize: 10.5, color: C.textMuted }}>+{cp.filas.length - 4} más.</span>}
                </div>
                <div style={{ fontSize: 11.5, color: C.textSub, lineHeight: 1.55, marginTop: 9, paddingLeft: 10, borderLeft: `2px solid ${C.border}` }}>{cp.lectura}</div>
              </div>
            )}
          </div>

          {/* "VENDEN MUCHO PERO DEJAN POCO" SE MUDÓ a "Quién sostiene el negocio" (owner 2026-08-08): explica
              las cuentas de ESA tabla, así que vive pegado a ella y detrás de un botón. Ver ResumenPorQue. */}
        </div>
    </div>
  );
}

/* ── QUÉ HACER PRIMERO · el cruce de los dos deterioros ────────────────────────────────────────────────────────
 * Owner 2026-08-07: la vista tiene que evitar "el error comercial más peligroso — intentar recuperar ventas
 * mediante descuentos en cuentas que ya están diluyendo el margen". Por eso las cuentas no vienen en una lista
 * plana: vienen cruzadas por los DOS deterioros medidos, y el grupo que sale primero es justamente el peligroso. */
function ResumenPrioridades({ R, onFicha, onAsk }) {
  const P = R.prioridades;
  // EMISIÓN · el encabezado (el cruce) y los grupos son dos componentes: el primero está declarado `sinTool`
  // —ninguna tool produce la INTERSECCIÓN de los dos deterioros— y el segundo tiene su divergencia declarada. Con
  // eso ADI puede explicar el cruce nombrando su límite, en vez de responder con el foco suelto de diagnose.
  const vCruce = useViewContext("comercial/03/encabezado-cruce", R, { scenario: R.scenario, onAsk });
  const vGrupos = useViewContext("comercial/03/grupos-prioridad", R, { scenario: R.scenario, onAsk });
  // (el mapa de tonos murió con las barras y el contador de color · owner 2026-08-08: el orden de los grupos ES
  //  la prioridad, y el grupo peligroso va primero con su aviso escrito. No hace falta pintarlo además.)
  if (!P || !P.grupos.length) {
    return (
      <div style={{ fontSize: 12, color: C.textSub, lineHeight: 1.55, padding: "10px 12px", border: `1px dashed ${C.border}`, borderRadius: 10 }}>{P ? P.encabezado : ""}</div>
    );
  }
  /* UNA CARD POR GRUPO (owner 2026-08-08: "tenés muchas cosas mezcladas, ordenalas bien; puede ser cards
   * separadas, no quiero desorden"). Cada grupo es un problema distinto y ahora se ve así.
   *
   * Y LA ACCIÓN SUBE AL TÍTULO. "Fijate que en la lista de recuperar margen todas dicen lo mismo, revisar acciones
   * comerciales etc. Es mejor un título, dejar los clientes y con el pp que operan y lo que se recuperaría." Las
   * cuatro filas repetían la MISMA frase salvo por dos números: 40 palabras para encontrar 2 cifras. Ahora el
   * verbo se dice una vez arriba, el pendiente una vez abajo, y cada fila deja solo lo que la distingue. */
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontSize: 12.5, color: C.text, lineHeight: 1.5, display: "flex", alignItems: "flex-start", gap: 4 }}>
        {/* el encabezado del cruce pasa a ser preguntable — mismo texto, mismo lugar: gana el click y el título */}
        <span style={vCruce.ask ? { cursor: "pointer" } : undefined}
          title={vCruce.ask ? "Pregúntale a ADI: ¿Por qué debo empezar por estas cuentas?" : undefined}
          onClick={vCruce.ask ? () => vCruce.ask("¿Por qué debo empezar por estas cuentas?") : undefined}>{P.encabezado}</span>
        <InfoDot def={"Las cuentas cruzadas por los DOS deterioros que ya están medidos: si están bajo su referencia de venta y si ceden margen material contra tu benchmark. De ese cruce sale la prioridad, y no de una recomendación inventada. El grupo que va primero es el peligroso: cuentas que están bajo presupuesto Y cediendo margen, donde empujar volumen con descuento agranda la brecha en vez de cerrarla. Cada fila abre la Ficha Ejecutiva de esa cuenta, que es donde la explicación se demuestra."} align="left"/>
      </div>
      {P.grupos.map((g) => (
        <div key={g.key} style={_RC_CARD}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
            <span style={{ ..._RC_HEAD, color: C.text }}>{g.label}</span>
            <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: "0.5px", color: C.textMuted, border: `1px solid ${C.border}`, borderRadius: 3, padding: "1px 5px" }}>{g.filas.length}</span>
          </div>
          <div style={{ fontSize: 11.5, color: C.textSub, lineHeight: 1.5, marginTop: 5 }}>
            {g.criterio} {g.porQue}
            {/* LA ACCIÓN, UNA VEZ · solo si TODAS las filas del grupo comparten el verbo (el módulo lo resuelve) */}
            {g.accionTitulo ? <span style={{ color: C.text, fontWeight: 600 }}> {g.accionTitulo}.</span> : null}
          </div>
          <div style={{ display: "flex", flexDirection: "column", marginTop: 8 }}>
            {g.filas.map((x, i) => (
              <div key={x.entidad} style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "8px 2px",
                borderTop: i === 0 ? "none" : `1px solid ${C.border}` }}>
                <span style={{ flex: "0 1 150px", minWidth: 116, fontSize: 13, fontWeight: 600, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.entidad}</span>
                {/* LO QUE DISTINGUE A ESTA FILA DE LA DE AL LADO, y nada más: cuánto opera sobre la meta y cuánto
                    se recupera si vuelve a ella. Si no aplica (grupo de venta), lo que falta contra su plan. */}
                <span style={{ flex: "1 1 210px", minWidth: 0, display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap", fontFamily: MONO, fontSize: 11.5, fontVariantNumeric: "tabular-nums" }}>
                  {/* LAS CIFRAS VIENEN DECIDIDAS DEL MÓDULO: cuáles y con qué etiqueta depende del problema del
                      grupo, y esa decisión no es de dibujo. El verde queda para el recuperable —la única cifra
                      que dice cuánta plata hay del otro lado de la acción— y el resto va en blanco. */}
                  {(x.cifras || []).map((c, j) => (
                    <span key={j} style={{ color: c.tono === "ok" ? C.green : C.textSub, fontWeight: c.tono === "ok" ? 600 : 400 }}>
                      {c.valor} <span style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 11, fontWeight: 400, color: C.textMuted }}>{c.etiqueta}</span>
                    </span>
                  ))}
                  {/* SOLO LA EXCEPCIÓN SE DECLARA: el título del grupo lleva la acción dominante, y la fila que se
                      aparta dice la suya. Una cuenta sin palanca medida no puede heredar "revisar acciones
                      comerciales", pero por una excepción no se repite la frase en las otras cuatro. */}
                  {x.accionVisible ? (
                    <span style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 11, color: C.textMuted }}>{x.accionCorta}</span>
                  ) : null}
                </span>
                {onFicha ? (
                  // el click informa el contexto del GRUPO de prioridad y después abre la Ficha (nunca dispara)
                  <button onClick={() => { if (vGrupos.ctx) setUISignal({ viewContext: vGrupos.ctx }); onFicha(x.entidad); }} title={`Abrir la Ficha de ${x.entidad}`}
                    style={{ flexShrink: 0, padding: "6px 13px", borderRadius: 8, border: "1px solid rgba(47,184,218,0.45)", background: "transparent", color: C.text, fontSize: 11.5, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', system-ui, sans-serif", whiteSpace: "nowrap", transition: "background 0.15s" }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(47,184,218,0.14)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
                    Abrir Ficha <span style={{ color: C.celeste }}>→</span>
                  </button>
                ) : null}
              </div>
            ))}
          </div>
          {/* EL PENDIENTE, AL PIE Y SIN REPETIRSE · si las filas declaran pendientes distintos van los DISTINTOS,
              no ninguno: decir menos veces no puede convertirse en no decir. */}
          {(g.faltas || []).map((t, j) => (
            <div key={j} style={{ fontSize: 10.5, color: C.textMuted, lineHeight: 1.5, marginTop: j === 0 ? 7 : 3 }}>{t}</div>
          ))}
        </div>
      ))}
      {/* El enlace "O que ADI cuente el caso <entidad>" se ELIMINÓ (owner 2026-08-08): cada fila ya trae su
          "Abrir Ficha →", y ofrecer un segundo camino a la MISMA cuenta —la primera de la lista— competía con
          esa acción en vez de sumarle. Preguntarle a ADI sigue a un clic, con el botón fijo de la vista. */}
    </div>
  );
}


/* ── MESA · CARA RESULTADO (owner 2026-07-15 "sí, parte por p&l") ────────────────────────────────────────────────
 * El mismo sello (entender→explicar→actuar) contando EL RESULTADO: la cascada del P&L comercial con las líneas de
 * gasto QUE EL USUARIO DECLARÓ conversando (% sobre la venta · v1). GRADUACIÓN A LA VISTA: lo probado (dato, trazo
 * firme) vs los supuestos declarados (trazo punteado ámbar). TODO de mesaResultado.js/buildPnlCascade (cero cálculo
 * acá — la cascada cierra exacto, una verdad con las lecturas de ADI). Empty state honesto: sin P&L declarado, la
 * cara lo dice y OFRECE armarlo (prefill del flujo guiado — el click informa/precarga, nunca dispara). */
function MesaResultadoCara({ resultado: mr, scenario = null, onAsk = null, onEje = null, onFoco = null, onExport = null }) {
  /* ── EMISIÓN DEL CONTEXTO · cara Resultado ────────────────────────────────────────────────────────────────
   * La cascada es el caso donde el sello importa más: hasta la contribución es dato probado, de ahí para abajo
   * son SUPUESTOS declarados por el usuario. El contexto lo transporta, así que ADI puede explicar el resultado
   * sin presentar un supuesto como una medición. Con el P&L sin declarar (`defined:false`) el campo no resuelve y
   * `campoOpcional` hace que no se emita contexto — que es lo correcto: no hay cascada que explicar todavía. */
  const _oR = { scenario, onAsk };
  const vPnlCascada = useViewContext("resultado/01/cascada", mr, {
    ..._oR, controles: { cascadaFoco: (mr && mr.alcance && mr.alcance.nombre) || "" },
  });
  const vPnlCuadro = useViewContext("resultado/01/cuadro", mr, {
    ..._oR, controles: { pnlEje: (mr && mr.cuadro && mr.cuadro.eje) || "", pnlFoco: (mr && mr.alcance && mr.alcance.nombre) || "" },
  });
  const askPnl = vPnlCascada.ask || (typeof onAsk === "function" ? (q) => onAsk(q, null) : null);
  const askCuadro = vPnlCuadro.ask || askPnl;
  // EXPORT/COPIAR (mejora 8 · 2026-07-26): lo que se está viendo (eje + foco activos) sale a Excel/Sheets —
  // Copiar = TSV al portapapeles · CSV = descarga. El click exporta, nunca dispara a ADI (patrón de la Mesa).
  const [copiado, setCopiado] = useState(false);
  // SUPUESTOS EDITABLES (owner 2026-07-26 verbatim: "en Sentrix permitirme verlo ordenado y con los supuestos
  // con opción de cambiarlos — eso fue lo que hablamos"): el % de cada línea punteada abre un campo compacto;
  // guardar llama editPnlLine — la MISMA primitiva de la edición por chat (una verdad) — y adi-pnl-changed
  // re-arma la cara en vivo. «sacar» pide un segundo click (confirmación, patrón del panel de criterio) y
  // «+ agregar línea» suma otra. El control EDITA el criterio; jamás dispara una respuesta de ADI.
  const [editKey, setEditKey] = useState(null);      // key de la fila en edición
  const [editVal, setEditVal] = useState("");
  const [editErr, setEditErr] = useState(false);
  const [delKey, setDelKey] = useState(null);        // «sacar» confirmado en el segundo click
  const [addOpen, setAddOpen] = useState(false);
  const [addNombre, setAddNombre] = useState("");
  const [addPct, setAddPct] = useState("");
  const [addErr, setAddErr] = useState(null);
  const _abrirEdit = (r, ev2) => { ev2.stopPropagation(); setDelKey(null); setEditKey(r.key); setEditVal(String(r.edit.pct)); setEditErr(false); };
  const _guardarEdit = (r) => {
    const res = editPnlLine(r.edit.nombre, editVal);
    if (res.ok) { setEditKey(null); setEditErr(false); } else setEditErr(true);   // ok → adi-pnl-changed re-arma la cara
  };
  const _sacar = (r, ev2) => {
    ev2.stopPropagation(); setEditKey(null);
    if (delKey !== r.key) { setDelKey(r.key); return; }
    setDelKey(null); removePnlLine(r.edit.nombre);
  };
  const _agregar = () => {
    const res = addPnlLine(addNombre, addPct);
    if (res.ok) { setAddOpen(false); setAddNombre(""); setAddPct(""); setAddErr(null); } else setAddErr(res.motivo);
  };
  const ADD_ERR_MSG = {
    nombre: "El nombre del gasto va de 2 a 30 letras — y no puede ser una métrica del dato (ventas, margen…).",
    pct: "El % va entre 0.1 y 50, sobre la venta.",
    duplicada: "Esa línea ya está en tu P&L — edita su % en la cascada.",
    tope: "Tu P&L ya tiene 10 líneas — el tope de esta versión. Saca una primero.",
  };
  const _copiar = async () => {
    if (!onExport) return;
    const d = onExport();
    if (!d) return;
    try { await navigator.clipboard.writeText(d.tsv); setCopiado(true); setTimeout(() => setCopiado(false), 1600); } catch { /* clipboard denegado → sin feedback */ }
  };
  const _csv = () => {
    if (!onExport) return;
    const d = onExport();
    if (!d) return;
    try {
      const blob = new Blob(["﻿" + d.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = d.filename; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch { /* descarga bloqueada → sin efecto */ }
  };
  const head = { fontFamily: MONO, fontSize: 9.5, letterSpacing: "0.5px", color: C.text, textTransform: "uppercase" };
  const MovHead = ({ num, title, def }) => (
    <div style={{ ...head, marginBottom: 9, display: "flex", alignItems: "center", gap: 6 }}>
      {num ? <span style={{ color: C.celeste, opacity: 0.85 }}>{num}</span> : null}{title}<InfoDot def={def} align="left"/>
    </div>
  );
  const usdK = (vK) => { const v = vK * 1000, a = Math.abs(v), s = v < 0 ? "-" : ""; return a >= 1e6 ? `${s}$${(a / 1e6).toFixed(1)}M` : a >= 1e3 ? `${s}$${Math.round(a / 1e3)}K` : `${s}$${Math.round(a)}`; };
  // ── EMPTY STATE · sin P&L declarado — honesto + la puerta al flujo guiado ──
  if (!mr.defined) {
    return (
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:14, padding:"46px 26px", border:`1px dashed ${C.border}`, borderRadius:14, textAlign:"center" }}>
        <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:14.5, color:C.text, fontWeight:600 }}>{mr.empty.titulo}<InfoDot def={"La cara Resultado arma tu P&L comercial: la cascada ingreso → costo → margen bruto → carga → contribución → TUS líneas de gasto → resultado. Las líneas las defines tú conversando con ADI, como % sobre la venta (decisión v1 — drivers más finos llegan con la contabilidad real). Hasta la contribución todo es dato probado; tus gastos entran como supuestos declarados."} align="left"/></div>
        <div style={{ fontSize:12.5, color:C.textSub, lineHeight:1.65, maxWidth:520 }}>{mr.empty.texto}</div>
        {askPnl ? (
          <button onClick={() => askPnl(mr.empty.prefill)} title={`Pregúntale a ADI: ${mr.empty.prefill}`}
            style={{ padding:"9px 18px", borderRadius:9, border:"1px solid rgba(47,184,218,0.5)", background:"rgba(47,184,218,0.08)", color:C.text, fontSize:12.5, fontWeight:600, cursor:"pointer", fontFamily:"'DM Sans', system-ui, sans-serif", transition:"background 0.15s" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(47,184,218,0.16)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(47,184,218,0.08)"; }}>
            {mr.empty.cta} <span style={{ color:C.celeste }}>→</span>
          </button>
        ) : null}
        <div style={{ fontSize:10.5, color:C.textMuted }}>El botón precarga «{mr.empty.prefill}» en el chat — tú confirmas con Enter.</div>
      </div>
    );
  }
  // estilos por graduación de la cascada (probado firme · supuesto punteado ámbar · resultado destacado)
  const rowStyle = (r) => r.kind === "supuesto"
    ? { border: "1px dashed rgba(217,154,90,0.45)", background: "rgba(217,154,90,0.04)" }
    : r.kind === "resultado"
    ? { border: "1px solid rgba(47,184,218,0.35)", borderLeft: "2px solid rgba(47,184,218,0.7)", borderRight: "2px solid rgba(47,184,218,0.7)", background: "rgba(47,184,218,0.05)" }
    : { border: `1px solid ${C.border}`, background: r.subtotal ? "rgba(255,255,255,0.035)" : "rgba(255,255,255,0.015)" };
  const valColor = (r) => r.kind === "resultado" ? (r.negativo ? C.red : C.celeste) : r.kind === "supuesto" ? C.amber : C.text;
  return (<>
    {/* ── 01 · QUÉ ESTÁ PASANDO · LA CASCADA (probado vs supuesto declarado · cierra exacto) ── */}
    <div>
      <MovHead num="01" title="Qué está pasando" def={"La cascada de tu P&L comercial: ingreso → costo → margen bruto → acciones comerciales (carga) → contribución → tus líneas de gasto → resultado. Hasta la contribución es dato probado (trazo firme — las mismas cifras de las respuestas de ADI); tus gastos son supuestos declarados por ti, % sobre la venta (trazo punteado). La cascada cierra exacto: ingreso − costo − carga − gastos = resultado. Toca una línea y ADI abre esa historia al lado. Con el ⌖ de una fila del cuadro, esta cascada cuenta ESA entidad (mismas anclas, prorrateo sobre su venta). Los supuestos se editan aquí mismo: el chip con el % de una línea punteada abre un campo para cambiarlo, «sacar» quita la línea (pide confirmación) y «+ agregar línea de gasto» suma otra — es el mismo criterio que editar conversando (una sola verdad) y no dispara una respuesta de ADI."}/>
      {/* ── ALCANCE DE LA CASCADA (pase 2): chip del foco + volver al negocio (el click informa, nunca dispara) ── */}
      {mr.alcance && (
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:9 }}>
          <button onClick={askPnl ? () => askPnl(mr.alcance.ask) : undefined} title={askPnl ? `Pregúntale a ADI: ${mr.alcance.ask}` : undefined}
            style={{ display:"flex", alignItems:"center", gap:6, padding:"5px 12px", borderRadius:7, border:"1px solid rgba(47,184,218,0.5)", background:"rgba(47,184,218,0.08)", color:C.text, fontSize:11.5, fontWeight:600, cursor: askPnl ? "pointer" : "default", fontFamily:"'DM Sans', system-ui, sans-serif" }}>
            <span style={{ color:C.celeste, fontFamily:MONO, fontSize:10 }}>⌖</span> P&L de {mr.alcance.nombre} <span style={{ color:C.celeste }}>→</span>
          </button>
          {onFoco && (
            <button onClick={() => onFoco(null)} title="La cascada vuelve a contar el negocio completo"
              style={{ padding:"5px 10px", borderRadius:7, border:`1px solid ${C.border}`, background:"transparent", color:C.textMuted, fontSize:11, cursor:"pointer", fontFamily:"'DM Sans', system-ui, sans-serif" }}>
              {mr.alcance.volverLabel}
            </button>
          )}
        </div>
      )}
      <div style={{ fontSize:12, color:C.textSub, lineHeight:1.55, padding:"10px 12px", border:`1px solid ${C.border}`, borderRadius:10, background:"rgba(47,184,218,0.03)", marginBottom:9 }}>
        <span style={{ color:C.celeste, fontWeight:600 }}>ADI · </span>{mr.lectura}
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
        {mr.cascada.map((r) => (
          <AskRow key={r.key} onAsk={askPnl} q={r.ask} style={{ display:"flex", alignItems:"center", gap:9, padding: r.kind === "resultado" ? "10px 12px" : "7px 12px", borderRadius:9, ...rowStyle(r) }}>
            <span style={{ display:"flex", alignItems:"center", gap:6, minWidth:0, flex:1 }}>
              <span style={{ fontSize: r.kind === "resultado" ? 12.5 : 12, color: r.kind === "resultado" ? C.text : C.textSub, fontWeight: r.subtotal || r.kind === "resultado" ? 600 : 400 }}>{r.label}</span>
              {/* SUPUESTO EDITABLE: el % abre un campo compacto (misma primitiva del chat · no dispara a ADI) */}
              {r.nota ? (r.edit ? (editKey === r.key ? (
                <span onClick={(ev2) => ev2.stopPropagation()} style={{ display:"flex", alignItems:"center", gap:4, whiteSpace:"nowrap" }}>
                  <input autoFocus value={editVal}
                    onChange={(ev2) => { setEditVal(ev2.target.value); setEditErr(false); }}
                    onKeyDown={(ev2) => { if (ev2.key === "Enter") _guardarEdit(r); if (ev2.key === "Escape") setEditKey(null); }}
                    title="El % del supuesto sobre la venta (0.1–50) · Enter guarda · Esc cancela"
                    style={{ width:52, padding:"2px 6px", borderRadius:6, border:`1px solid ${editErr ? "rgba(248,113,113,0.7)" : "rgba(217,154,90,0.6)"}`, background:"rgba(0,0,0,0.5)", color:C.amber, fontFamily:MONO, fontSize:11, outline:"none" }}/>
                  <span style={{ fontFamily:MONO, fontSize:10, color:C.textMuted }}>%</span>
                  <button onClick={() => _guardarEdit(r)} title="Guardar el supuesto — actualiza tu criterio (mismo efecto que editarlo conversando · no dispara a ADI)"
                    style={{ padding:"2px 8px", borderRadius:5, border:"1px solid rgba(217,154,90,0.55)", background:"rgba(217,154,90,0.1)", color:C.amber, fontSize:10, cursor:"pointer", fontFamily:"'DM Sans', system-ui, sans-serif" }}>guardar</button>
                  <button onClick={() => setEditKey(null)} title="Cancelar sin guardar"
                    style={{ padding:"2px 6px", borderRadius:5, border:`1px solid ${C.border}`, background:"transparent", color:C.textMuted, fontSize:10, cursor:"pointer" }}>×</button>
                  {editErr ? <span style={{ fontSize:9.5, color:"#f87171", fontFamily:MONO }}>0.1–50</span> : null}
                </span>
              ) : (
                <button onClick={(ev2) => _abrirEdit(r, ev2)}
                  title={`Editar el supuesto: ${r.edit.nombre} hoy va en ${r.edit.pct}% sobre la venta — el click edita tu criterio, no dispara a ADI`}
                  style={{ fontSize:9.5, fontFamily:MONO, letterSpacing:"0.4px", color:C.amber, textTransform:"uppercase", whiteSpace:"nowrap", background:"transparent", border:"1px dashed rgba(217,154,90,0.45)", borderRadius:5, padding:"1px 6px", cursor:"pointer" }}>
                  {r.nota} ✎
                </button>
              )) : <span style={{ fontSize:9.5, fontFamily:MONO, letterSpacing:"0.4px", color:C.amber, textTransform:"uppercase", whiteSpace:"nowrap" }}>{r.nota}</span>) : null}
              <InfoDot def={r.def} align="left"/>
            </span>
            {r.edit ? (
              <button onClick={(ev2) => _sacar(r, ev2)}
                title={delKey === r.key ? `Confirmar: sacar ${r.edit.nombre.toLowerCase()} del P&L` : `Sacar ${r.edit.nombre.toLowerCase()} del P&L — edita tu criterio, no dispara a ADI`}
                style={{ padding:"1px 7px", borderRadius:5, border:`1px solid ${delKey === r.key ? "rgba(248,113,113,0.55)" : C.border}`, background: delKey === r.key ? "rgba(248,113,113,0.08)" : "transparent", color: delKey === r.key ? "#f87171" : C.textMuted, fontSize:10, cursor:"pointer", flexShrink:0, fontFamily:"'DM Sans', system-ui, sans-serif" }}>
                {delKey === r.key ? "¿seguro?" : "sacar"}
              </button>
            ) : null}
            {r.pctFmt ? <span style={{ fontFamily:MONO, fontSize:11, color: r.negativo ? C.red : C.textMuted, whiteSpace:"nowrap", fontVariantNumeric:"tabular-nums" }}>{r.pctFmt} de la venta</span> : null}
            <span style={{ fontFamily:MONO, fontSize: r.kind === "resultado" ? 16 : 12.5, fontWeight:600, color: valColor(r), whiteSpace:"nowrap", fontVariantNumeric:"tabular-nums" }}>{r.usdFmt}</span>
          </AskRow>
        ))}
        {/* + AGREGAR LÍNEA · suma un supuesto al criterio desde la cara (misma primitiva del chat · no dispara) */}
        {addOpen ? (
          <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap", padding:"7px 10px", border:"1px dashed rgba(217,154,90,0.45)", borderRadius:9, background:"rgba(217,154,90,0.04)" }}>
            <input autoFocus value={addNombre} placeholder="nombre del gasto"
              onChange={(ev2) => { setAddNombre(ev2.target.value); setAddErr(null); }}
              onKeyDown={(ev2) => { if (ev2.key === "Escape") setAddOpen(false); }}
              title="El nombre de la línea, como lo manejas tú (administrativos, fletes…)"
              style={{ width:170, padding:"3px 8px", borderRadius:6, border:"1px solid rgba(217,154,90,0.5)", background:"rgba(0,0,0,0.5)", color:C.text, fontSize:11.5, outline:"none", fontFamily:"'DM Sans', system-ui, sans-serif" }}/>
            <input value={addPct} placeholder="%"
              onChange={(ev2) => { setAddPct(ev2.target.value); setAddErr(null); }}
              onKeyDown={(ev2) => { if (ev2.key === "Enter") _agregar(); if (ev2.key === "Escape") setAddOpen(false); }}
              title="El % sobre la venta (0.1–50) · Enter guarda"
              style={{ width:52, padding:"3px 8px", borderRadius:6, border:"1px solid rgba(217,154,90,0.5)", background:"rgba(0,0,0,0.5)", color:C.amber, fontFamily:MONO, fontSize:11, outline:"none" }}/>
            <button onClick={_agregar} title="Agregar la línea a tu criterio (mismo efecto que «agrega … con su %» en el chat · no dispara a ADI)"
              style={{ padding:"3px 10px", borderRadius:6, border:"1px solid rgba(217,154,90,0.55)", background:"rgba(217,154,90,0.1)", color:C.amber, fontSize:10.5, cursor:"pointer", fontFamily:"'DM Sans', system-ui, sans-serif" }}>guardar</button>
            <button onClick={() => { setAddOpen(false); setAddErr(null); }} title="Cancelar sin guardar"
              style={{ padding:"3px 8px", borderRadius:6, border:`1px solid ${C.border}`, background:"transparent", color:C.textMuted, fontSize:10.5, cursor:"pointer" }}>×</button>
            {addErr ? <span style={{ fontSize:10, color:"#f87171", lineHeight:1.4 }}>{ADD_ERR_MSG[addErr] || "No pude guardar la línea."}</span> : null}
          </div>
        ) : (
          <button onClick={() => { setAddOpen(true); setAddErr(null); setEditKey(null); setDelKey(null); }}
            title="Agregar una línea de gasto a tu P&L — edita tu criterio, no dispara a ADI"
            style={{ alignSelf:"flex-start", padding:"4px 10px", borderRadius:7, border:"1px dashed rgba(217,154,90,0.4)", background:"transparent", color:C.textMuted, fontSize:10.5, cursor:"pointer", fontFamily:"'DM Sans', system-ui, sans-serif" }}
            onMouseEnter={(ev2) => { ev2.currentTarget.style.color = C.amber; }}
            onMouseLeave={(ev2) => { ev2.currentTarget.style.color = C.textMuted; }}>
            + agregar línea de gasto
          </button>
        )}
      </div>
      {/* CORDURA HONESTA · resultado negativo declarado arriba (nunca silencioso) */}
      {mr.alerta && (
        <button onClick={askPnl ? () => askPnl(mr.alerta.ask) : undefined} title={askPnl ? `Pregúntale a ADI: ${mr.alerta.ask}` : undefined}
          style={{ display:"flex", alignItems:"center", gap:9, width:"100%", marginTop:9, padding:"9px 12px", borderRadius:10,
            border:"1px solid rgba(248,113,113,0.4)", background:"rgba(248,113,113,0.05)", color:C.text, fontFamily:"'DM Sans', system-ui, sans-serif", textAlign:"left", cursor: askPnl ? "pointer" : "default" }}>
          <span style={{ width:7, height:7, borderRadius:"50%", background:C.red, boxShadow:`0 0 6px ${C.red}aa`, flexShrink:0 }}/>
          <span style={{ fontFamily:MONO, fontSize:9.5, fontWeight:600, letterSpacing:"1px", textTransform:"uppercase", color:C.red, flexShrink:0 }}>Resultado negativo</span>
          <span style={{ fontSize:12, color:C.text, lineHeight:1.4 }}>{mr.alerta.linea}</span>
        </button>
      )}
    </div>
    {/* ── 02 · POR QUÉ · la línea que más pesa en el resultado ── */}
    <div>
      <MovHead num="02" title="Por qué pasa" def={"La línea de gasto que más resultado consume, con su valor anual — del propio P&L que declaraste (una sola verdad con la respuesta de ADI). Toca el foco y ADI ordena todas tus líneas por peso."}/>
      {mr.foco ? (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(180px, 1fr))", gap:8 }}>
          <button onClick={askPnl ? () => askPnl(mr.foco.ask) : undefined} title={askPnl ? `Pregúntale a ADI: ${mr.foco.ask}` : undefined}
            style={{ display:"flex", flexDirection:"column", alignItems:"flex-start", gap:2, padding:"9px 12px", borderRadius:10, border:`1px solid ${C.border}`, borderLeft:"2px solid rgba(47,184,218,0.6)", borderRight:"2px solid rgba(47,184,218,0.6)", background:C.surface, color:C.text, fontFamily:"'DM Sans', system-ui, sans-serif", textAlign:"left", cursor: askPnl ? "pointer" : "default", transition:"background 0.15s" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = C.surfaceHover; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = C.surface; }}>
            <span style={{ fontSize:14.5, fontWeight:600, color:C.celeste, fontFamily:MONO, letterSpacing:"0.2px" }}>{mr.foco.usdFmt}</span>
            <span style={{ fontSize:11, color:C.textSub, lineHeight:1.3 }}>{mr.foco.label} <span style={{ color:C.celeste }}>→</span></span>
          </button>
        </div>
      ) : (
        <div style={{ fontSize:12, color:C.textSub, lineHeight:1.5 }}>Sin líneas de gasto declaradas todavía.</div>
      )}
    </div>
    {/* ── 03 · QUÉ HACER PRIMERO · probar el ajuste de la línea que más pesa ── */}
    <div>
      <MovHead num="03" title="Qué hacer primero" def={"La primera medida sobre el P&L: probar un ajuste de la línea que más pesa — ADI proyecta el efecto directo en el resultado (supuesto, no dato). Si tu % real es otro, actualizarlo conversando deja la cascada honesta."}/>
      {mr.accion ? (
        <div style={{ ...CARD_SIDES, borderRadius:12, padding:"13px 15px", background:"rgba(255,255,255,0.025)" }}>
          <div style={{ display:"flex", alignItems:"baseline", justifyContent:"space-between", gap:10, marginBottom:6 }}>
            <span style={{ fontSize:13, color:C.text, fontWeight:600 }}>{mr.accion.titulo}</span>
            <span style={{ fontFamily:MONO, fontSize:14, color:C.amber, fontWeight:600, whiteSpace:"nowrap", fontVariantNumeric:"tabular-nums" }}>{mr.accion.usdFmt}</span>
          </div>
          <div style={{ fontSize:12, color:C.textSub, lineHeight:1.55, marginBottom:10 }}>{mr.accion.detalle}</div>
          {askPnl && (
            <button onClick={() => askPnl(mr.accion.ask)} title={`Pregúntale a ADI: ${mr.accion.ask}`}
              style={{ padding:"7px 14px", borderRadius:8, border:"1px solid rgba(47,184,218,0.5)", background:"rgba(47,184,218,0.08)", color:C.text, fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"'DM Sans', system-ui, sans-serif", transition:"background 0.15s" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(47,184,218,0.16)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(47,184,218,0.08)"; }}>
              {mr.accion.askLabel} <span style={{ color:C.celeste }}>→</span>
            </button>
          )}
        </div>
      ) : (
        <div style={{ fontSize:12, color:C.textSub, lineHeight:1.5 }}>Sin líneas declaradas no hay ajuste que probar.</div>
      )}
    </div>
    {/* ── ¿Y SI…? · cada línea pregunta su proyección + la meta de venta ── */}
    {(mr.simulaciones || []).length > 0 && (
      <div>
        <MovHead title="¿Y si…?" def={"Supuestos, no datos: cada línea proyecta el ajuste de un gasto declarado sobre tu dato real — el cálculo directo de ese cambio, sin predecir si es viable operarlo así. La última línea invierte la pregunta: cuánta venta necesitas para un resultado objetivo, con tu estructura constante. Toca una línea y ADI corre esa cuenta al lado."}/>
        <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
          {mr.simulaciones.map((s) => (
            <AskRow key={s.key} onAsk={askPnl} q={s.ask} style={{ display:"flex", alignItems:"flex-start", gap:9, fontSize:12, color:C.textSub, lineHeight:1.5, padding:"7px 10px", border:`1px solid ${C.border}`, borderRadius:9, background:"rgba(255,255,255,0.015)" }}>
              <span style={{ color:C.celeste, fontFamily:MONO, flexShrink:0, marginTop:1 }}>¿?</span>
              <span style={{ flex:1 }}>{s.texto}</span>
              <span style={{ fontFamily:MONO, fontSize:12, color:C.amber, fontWeight:600, whiteSpace:"nowrap", fontVariantNumeric:"tabular-nums", flexShrink:0 }}>{s.delta}</span>
            </AskRow>
          ))}
        </div>
      </div>
    )}
    {/* ── CUADRO · RESULTADO POR ENTIDAD + SELECTOR DE EJE (pase 2 · solo ejes con venta desglosada) ── */}
    <div>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:10, marginBottom:9, flexWrap:"wrap" }}>
        <div style={{ ...head, display:"flex", alignItems:"center", gap:4 }}>Cuadro de resultado · qué deja cada {mr.cuadro.colLabel.toLowerCase()} después de gastos<InfoDot def={"Cada entidad con sus columnas clásicas (Venta · Contribución · Margen — intactas, las mismas del cuadro comercial) más lo nuevo: Gastos (el prorrateo de tus % declarados sobre la venta de esa entidad) y su Resultado en $ y % de su venta. El selector cambia el eje — solo los ejes donde el dato trae la venta desglosada (por bodega/punto de venta no está, por eso no aparece). En todo eje la suma cierra exacto con el Total del negocio. El prorrateo es un supuesto — reparte tus porcentajes por venta, no lee contabilidad por entidad. Toca una fila y ADI arma su P&L al lado; con el ⌖ la cascada de arriba cuenta esa entidad."} align="left"/></div>
        <div style={{ display:"flex", alignItems:"center", gap:6, flexShrink:0 }}>
          {/* SELECTOR DE EJE (patrón del selector de cara · el click cambia la vista, nunca dispara a ADI) */}
          {mr.cuadro.ejes.length > 1 && (
            <div style={{ display:"flex", alignItems:"center", gap:0, border:`1px solid ${C.border}`, borderRadius:7, overflow:"hidden", flexShrink:0 }}>
              {mr.cuadro.ejes.map((e) => (
                <button key={e.key} onClick={onEje ? () => onEje(e.key) : undefined}
                  title={`El cuadro por ${e.label.toLowerCase()} — la suma cierra exacto con el negocio`}
                  style={{ padding:"3px 10px", fontSize:10.5, fontWeight: mr.cuadro.eje === e.key ? 600 : 400, cursor:"pointer", fontFamily:"'DM Sans', system-ui, sans-serif",
                    background: mr.cuadro.eje === e.key ? "rgba(255,255,255,0.1)" : "transparent", border:"none",
                    color: mr.cuadro.eje === e.key ? C.text : C.textMuted, transition:"all 0.15s" }}>{e.label}</button>
              ))}
            </div>
          )}
          {/* EXPORT (mejora 8): copiar TSV (pegable en Excel/Sheets) · descargar CSV — exporta LO QUE SE VE (eje+foco) */}
          {onExport && (
            <div style={{ display:"flex", alignItems:"center", gap:0, border:`1px solid ${C.border}`, borderRadius:7, overflow:"hidden", flexShrink:0 }}>
              <button onClick={_copiar} title="Copiar la cascada y el cuadro al portapapeles — se pega directo en Excel o Sheets"
                style={{ padding:"3px 10px", fontSize:10.5, fontWeight:400, cursor:"pointer", fontFamily:"'DM Sans', system-ui, sans-serif", background:"transparent", border:"none", color: copiado ? C.green : C.textMuted, transition:"all 0.15s" }}>
                {copiado ? "Copiado ✓" : "Copiar"}
              </button>
              <button onClick={_csv} title="Descargar la cascada y el cuadro como CSV (montos en USD, sumables)"
                style={{ padding:"3px 10px", fontSize:10.5, fontWeight:400, cursor:"pointer", fontFamily:"'DM Sans', system-ui, sans-serif", background:"transparent", border:"none", borderLeft:`1px solid ${C.border}`, color:C.textMuted, transition:"all 0.15s" }}>
                CSV
              </button>
            </div>
          )}
        </div>
      </div>
      <div style={{ overflowX:"auto" }}>
        <div style={{ minWidth:560 }}>
          <div style={{ display:"grid", gridTemplateColumns:"1.4fr 1fr 1fr 0.8fr 1fr 1fr 0.8fr", gap:6, padding:"4px 10px" }}>
            {[mr.cuadro.colLabel, "Venta", "Contribución", "Margen", "Gastos", "Resultado", "Res. %"].map((h, i) => (
              <span key={h} style={{ ...head, fontSize:9, textAlign: i === 0 ? "left" : "right" }}>{h}</span>
            ))}
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:3 }}>
            {mr.cuadro.rows.map((r) => (
              <AskRow key={r.name} onAsk={askCuadro} q={r.ask} style={{ display:"grid", gridTemplateColumns:"1.4fr 1fr 1fr 0.8fr 1fr 1fr 0.8fr", gap:6, alignItems:"center", padding:"6px 10px", border:`1px solid ${C.border}`, borderRadius:8, background:"rgba(255,255,255,0.015)", fontFamily:MONO, fontSize:11.5, fontVariantNumeric:"tabular-nums" }}>
                <span style={{ display:"flex", alignItems:"center", gap:5, minWidth:0 }}>
                  {onFoco && (
                    <button onClick={(ev) => { ev.stopPropagation(); onFoco({ eje: mr.cuadro.eje, nombre: r.name }); }}
                      title={`Ver ${r.name} en la cascada de arriba (no dispara a ADI)`}
                      style={{ border:"none", background:"transparent", color: mr.alcance && mr.alcance.nombre === r.name ? C.celeste : C.textMuted, cursor:"pointer", fontFamily:MONO, fontSize:11, padding:"0 2px", flexShrink:0 }}>⌖</button>
                  )}
                  <span style={{ fontFamily:"'DM Sans', system-ui, sans-serif", fontSize:11.5, fontWeight:600, color:C.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{r.name}</span>
                </span>
                <span style={{ textAlign:"right", color:C.textSub }}>{usdK(r.venta)}</span>
                <span style={{ textAlign:"right", color:C.textSub }}>{usdK(r.contribucion)}</span>
                <span style={{ textAlign:"right", color:C.textMuted }}>{r.margen}%</span>
                <span style={{ textAlign:"right", color:C.amber }}>− {usdK(r.gasto)}</span>
                <span style={{ textAlign:"right", fontWeight:600, color: r.negativo ? C.red : C.text }}>{usdK(r.resultado)}</span>
                <span style={{ textAlign:"right", color: r.negativo ? C.red : C.textMuted }}>{r.resultadoPct}%</span>
              </AskRow>
            ))}
            <div style={{ display:"grid", gridTemplateColumns:"1.4fr 1fr 1fr 0.8fr 1fr 1fr 0.8fr", gap:6, alignItems:"center", padding:"6px 10px", borderTop:`1px solid ${C.borderLight || C.border}`, marginTop:2, fontFamily:MONO, fontSize:11.5, fontVariantNumeric:"tabular-nums" }}>
              <span style={{ fontFamily:"'DM Sans', system-ui, sans-serif", fontSize:11.5, fontWeight:700, color:C.text }}>Total</span>
              <span style={{ textAlign:"right", color:C.text, fontWeight:600 }}>{usdK(mr.cuadro.total.venta)}</span>
              <span style={{ textAlign:"right", color:C.text, fontWeight:600 }}>{usdK(mr.cuadro.total.contribucion)}</span>
              <span style={{ textAlign:"right", color:C.textMuted }}>{mr.cuadro.total.margen}%</span>
              <span style={{ textAlign:"right", color:C.amber }}>− {usdK(mr.cuadro.total.gasto)}</span>
              <span style={{ textAlign:"right", fontWeight:700, color: mr.cuadro.total.resultado < 0 ? C.red : C.celeste }}>{usdK(mr.cuadro.total.resultado)}</span>
              <span style={{ textAlign:"right", color:C.textMuted }}>{mr.cuadro.total.resultadoPct}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div style={{ fontSize:10.5, color:C.textMuted, lineHeight:1.5 }}>La cara Resultado cuenta tu P&L comercial: la cascada del ingreso al resultado (probado hasta la contribución · tus gastos como supuestos declarados, % sobre la venta), qué línea pesa más y qué ajuste probar primero. Todo es pregunta: toca una línea de la cascada o una fila del cuadro y ADI la abre al lado. Los supuestos se editan conversando («cambia una línea a otro %») o directo en la cascada: el % de cada línea punteada se cambia ahí mismo, con «sacar» y «+ agregar línea de gasto» — una sola verdad, sin disparar respuestas de ADI.</div>
  </>);
}

/* ── MESA · CARA CAPITAL (owner 2026-07-15 "ok, veamos cómo queda") ──────────────────────────────────────────────
 * El mismo sello (entender→explicar→actuar) contando EL CAPITAL: el mapa del capital (la tira de flujo con los
 * estados del MOTOR) + los KPIs de la cara · los focos con su $ · QUÉ REPONGO / QUÉ LIQUIDO · ¿y si…? · el CUADRO
 * DE CAPITAL (la tabla hermana — la de ventas NO se toca). TODO de mesaCapital.js (detectores de inventario
 * existentes · POLICY · cero cálculo acá). "Qué cambió" NO aparece: sin historial de stock no se fabrica (honesto).
 * Anti-BI: cada tramo, KPI, foco, línea y chip es una PREGUNTA gate-proven — o navega, nunca muda. */
const _capCol = (c) => ({ green: C.green, amber: C.amber, red: C.red, cyan: C.celeste }[c] || C.textMuted);
/* ── UNA LISTA DEL BLOQUE 03 DE CAPITAL · acción en el título, tope de 5, el resto a un clic ───────────────────
 * Owner 2026-08-08 (decisión 6): "máximo 5 SKU por lista para que escale a empresas grandes; el resto en Ver
 * todos". En el demo entran los 3 reales de cada grupo, así que el botón no aparece — pero el tope existe.
 * La ACCIÓN va una sola vez, en el encabezado del grupo: dentro de un frente el problema es el mismo por
 * construcción, y repetirla por fila fue exactamente lo que hubo que deshacer en Comercial. */
function ResumenCapitalLista({ lista, tono, onAsk }) {
  const [todos, setTodos] = useState(false);
  if (!lista) return null;
  const filas = todos ? lista.filas : lista.filas.slice(0, lista.tope);
  return (
    <div style={{ ...CARD_SIDES, borderRadius: 12, padding: "12px 14px", background: "rgba(255,255,255,0.02)", display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontFamily: MONO, fontSize: 9.5, fontWeight: 600, letterSpacing: "1px", textTransform: "uppercase", color: C.celeste }}>{lista.titulo}</span>
        <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: "0.5px", color: C.textMuted, border: `1px solid ${C.border}`, borderRadius: 3, padding: "1px 5px" }}>{lista.n}</span>
        <Num color={tono}>{lista.usdFmt}</Num>
      </span>
      <span style={{ fontSize: 11.5, color: C.textSub, lineHeight: 1.5 }}>
        {lista.criterio} <span style={{ color: C.text, fontWeight: 600 }}>{lista.accion}</span>
      </span>
      {filas.length === 0 ? (
        <div style={{ fontSize: 11.5, color: C.textSub, lineHeight: 1.5 }}>Nada urgente en este frente — el dato no marca casos.</div>
      ) : filas.map((f, i) => (
        <AskRow key={f.sku} onAsk={onAsk} q={f.ask}
          style={{ display: "flex", alignItems: "baseline", gap: 9, flexWrap: "wrap", fontSize: 11.5, color: C.textSub, lineHeight: 1.45, paddingTop: i === 0 ? 3 : 6, borderTop: i === 0 ? "none" : `1px solid ${C.border}` }}>
          <span style={{ color: C.text, fontWeight: 600, fontSize: 12, flexShrink: 0 }}>{f.sku}</span>
          <span style={{ fontSize: 10.5, color: C.textMuted, flexShrink: 0 }}>{f.bodega}</span>
          <span style={{ minWidth: 0, fontFamily: MONO, fontSize: 10.5, fontVariantNumeric: "tabular-nums" }}>{f.linea}</span>
        </AskRow>
      ))}
      {lista.resto > 0 && (
        <button onClick={() => setTodos((t) => !t)} aria-expanded={todos}
          style={{ alignSelf: "flex-start", background: "transparent", border: "none", padding: 0, color: C.celeste, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', system-ui, sans-serif" }}>
          {todos ? `Ver solo los primeros ${lista.tope}` : `Ver todos (${lista.n})`} {todos ? "▴" : "▾"}
        </button>
      )}
      {onAsk && filas.length > 0 && (
        <button onClick={() => onAsk(lista.ask)} title={`Pregúntale a ADI: ${lista.ask}`}
          style={{ alignSelf: "flex-start", marginTop: 2, padding: "5px 11px", borderRadius: 7, border: "1px solid rgba(47,184,218,0.5)", background: "rgba(47,184,218,0.08)", color: C.text, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', system-ui, sans-serif", transition: "background 0.15s" }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(47,184,218,0.16)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(47,184,218,0.08)"; }}>
          Que ADI lo ordene <span style={{ color: C.celeste }}>→</span>
        </button>
      )}
    </div>
  );
}

/* ── EL DETALLE DE UN KPI DE CAPITAL · la tabla que se abre al tocar su card (owner 2026-08-09) ────────────────
 * Cada card abre EL universo que esa card cuenta — no el inventario entero cuatro veces. Filtros por bodega y por
 * familia arriba (el owner los pidió por manejar varios almacenes), y las alertas visuales que definió: el capital
 * grande destacado, y en rojo lo que se queda sin stock en menos de 5 días.
 *
 * ⚠️ LO QUE FALTA SE DICE, NO SE INVENTA. Cada tabla declara qué columna no puede traer y por qué — lead time del
 * proveedor, estado de la orden de compra y la causa de una detención no están en el dato, y la causa no se puede
 * inferir sin historial de stock. Decirlo es más útil que rellenarlo: nombra exactamente qué habría que conectar. */
/* ── CAPITAL POR PRODUCTO · barras horizontales, la lectura más rápida de la cara (owner 2026-08-09) ───────────
 * Ordenadas de mayor a menor, con el monto al FINAL de la barra: se lee sin ejes y sin leyenda. Las unidades van
 * DENTRO, en tono menor, porque agregan lo que ninguna otra vista muestra — que $11K en 140 unidades y $13K en 18
 * son dos problemas de compra distintos. La barra mide capital; por eso el monto manda y la unidad acompaña.
 * Dos filtros, los que pidió el owner: todo el inventario, o solo lo inmovilizado. */
function CapitalBarras({ barras, onAsk }) {
  const [vista, setVista] = useState((barras && barras.porDefecto) || "general");
  const [hov, setHov] = useState(null);
  if (!barras || !barras.vistas.length) return null;
  const v = barras.vistas.find((x) => x.key === vista) || barras.vistas[0];
  return (
    <div style={{ ..._RC_CARD, marginTop: 10 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
        <span style={{ ..._RC_HEAD, color: C.text }}>Capital por producto</span>
        <span style={{ display: "flex", gap: 3 }}>
          {barras.vistas.map((x) => (
            <button key={x.key} onClick={() => setVista(x.key)} aria-pressed={v.key === x.key}
              style={{ padding: "3px 11px", borderRadius: 6, border: `1px solid ${v.key === x.key ? "rgba(47,184,218,0.5)" : C.border}`, background: v.key === x.key ? "rgba(47,184,218,0.10)" : "transparent", color: v.key === x.key ? C.celeste : C.textMuted, fontSize: 10.5, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', system-ui, sans-serif", whiteSpace: "nowrap" }}>
              {x.label} ({x.n})
            </button>
          ))}
        </span>
        <Num>{v.totalFmt}</Num>
      </div>
      <div style={{ display: "flex", flexDirection: "column" }} onMouseLeave={() => setHov(null)}>
        {v.barras.map((b, i) => {
          const activa = hov == null || hov === i;
          // la unidad entra ADENTRO solo si la barra le da lugar; si no, sale al borde en tono menor. Un número
          // recortado a la mitad es peor que un número afuera.
          const cabe = b.anchoPct >= 16;
          return (
          <div key={b.sku} onMouseEnter={() => setHov(i)}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 6px", margin: "0 -6px", borderRadius: 7,
              background: hov === i ? "rgba(255,255,255,0.035)" : "transparent", transition: "background 0.15s, opacity 0.15s",
              opacity: activa ? 1 : 0.55 }}>
            {/* el estado va como PUNTO de semáforo, no pintando la barra entera: el mismo idioma del cuadro y la
                misma regla del owner — el color resalta, no decora. La barra queda de un solo tono. */}
            <span style={{ width: 6, height: 6, borderRadius: "50%", flexShrink: 0, background: b.estado ? _capCol(b.estadoColor) : "transparent",
              boxShadow: b.estado ? `0 0 6px ${_capCol(b.estadoColor)}88` : "none" }}/>
            <span style={{ flex: "0 0 108px", fontSize: 11, letterSpacing: "0.1px", fontWeight: b.agrupado ? 400 : 600, color: b.agrupado ? C.textMuted : C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {b.ask && onAsk ? (
                <button onClick={() => onAsk(b.ask)} title={`Pregúntale a ADI: ${b.ask}${b.estadoLabel ? ` · ${b.estadoLabel}` : ""}`}
                  style={{ background: "transparent", border: "none", padding: 0, color: "inherit", fontSize: 11, letterSpacing: "0.1px", fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', system-ui, sans-serif" }}>{b.sku}</button>
              ) : b.sku}
            </span>
            {/* EL RIEL · la barra vive dentro de una pista del ancho completo. Es lo que ordena el gráfico: sin él
                las barras flotan y el monto de cada fila queda a una distancia distinta, que es lo que se veía
                barato. Con riel, los montos caen todos en la misma columna y se comparan de arriba a abajo. */}
            <span style={{ flex: 1, minWidth: 0, position: "relative", height: 20, borderRadius: 5,
              background: "rgba(255,255,255,0.035)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.035)" }}
              title={b.estadoLabel ? `${b.sku} · ${b.estadoLabel}` : b.sku}>
              <span style={{ position: "absolute", inset: "0 auto 0 0", width: `${Math.max(b.anchoPct, 3)}%`, borderRadius: 5,
                background: b.agrupado
                  ? "linear-gradient(180deg, rgba(255,255,255,0.155), rgba(255,255,255,0.075))"
                  : `linear-gradient(180deg, ${C.celeste}, rgba(37,150,180,0.92))`,
                boxShadow: b.agrupado ? "none" : `inset 0 1px 0 rgba(255,255,255,0.28), 0 1px 10px ${C.celeste}33`,
                display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 8, boxSizing: "border-box", overflow: "hidden",
                transformOrigin: "left center", animation: `adiRise 460ms cubic-bezier(.2,.7,.3,1) ${i * 26}ms both` }}>
                {/* las unidades DENTRO, en tono menor: la barra mide capital, la unidad acompaña */}
                {b.und != null && cabe ? <span style={{ fontFamily: MONO, fontSize: 9.5, fontVariantNumeric: "tabular-nums", color: b.agrupado ? C.textMuted : "rgba(3,26,33,0.72)", fontWeight: 700, whiteSpace: "nowrap" }}>{b.und.toLocaleString("es-CL")}</span> : null}
              </span>
              {b.und != null && !cabe ? (
                <span style={{ position: "absolute", top: 0, bottom: 0, left: `calc(${Math.max(b.anchoPct, 3)}% + 7px)`, display: "flex", alignItems: "center",
                  fontFamily: MONO, fontSize: 9.5, fontVariantNumeric: "tabular-nums", color: C.textMuted, whiteSpace: "nowrap" }}>{b.und.toLocaleString("es-CL")}</span>
              ) : null}
            </span>
            {/* el valorizado, en columna fija: alineado a la derecha se lee la escala de un barrido vertical */}
            <span style={{ flex: "0 0 52px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}><Num>{b.usdFmt}</Num></span>
          </div>
        ); })}
      </div>
      {/* la clave del punto · sin ella el semáforo es un código interno */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "3px 13px", marginTop: 9 }}>
        {v.leyenda.map((l) => (
          <span key={l.estado} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10.5, color: C.textMuted }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: _capCol(l.color), flexShrink: 0 }}/>{l.label}
          </span>
        ))}
      </div>
      <div style={{ fontSize: 10.5, color: C.textMuted, lineHeight: 1.5, marginTop: 7 }}>{v.lectura} {v.nota}</div>
    </div>
  );
}

const _CAP_PAGINA = 50;   // cuántas filas se dibujan de una vez · el resto entra con "ver más"
function CapitalDrill({ tabla, ask, onAsk, onCerrar }) {
  const [bodega, setBodega] = useState("todas");
  const [familia, setFamilia] = useState("todas");
  const [q, setQ] = useState("");
  const [tope, setTope] = useState(_CAP_PAGINA);
  const [abierto, setAbierto] = useState(null);   // el SKU cuyo "a quién le vendes esto" está desplegado
  if (!tabla) return null;
  const bodegas = [...new Set(tabla.filas.map((f) => f.bodega).filter(Boolean))];
  const familias = [...new Set(tabla.filas.map((f) => f.familia).filter(Boolean))];
  /* ── PENSADO PARA MILES DE SKU, NO PARA TRECE (owner 2026-08-09) ──────────────────────────────────────────
   * Con 1.000+ SKU, dibujar la tabla entera es inusable (y lento). Tres cosas resuelven eso a la vez: un
   * buscador que filtra sobre TODO el universo —no sobre lo que se ve—, filtros por bodega y familia, y un tope
   * de filas dibujadas con su "ver más". El conteo dice siempre cuántas hay detrás: una tabla que corta en
   * silencio se lee como si eso fuera todo, que es la peor forma de mentir con una tabla. */
  const _norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const nq = _norm(q.trim());
  const filtradas = tabla.filas.filter((f) =>
    (bodega === "todas" || f.bodega === bodega) && (familia === "todas" || f.familia === familia) &&
    (!nq || _norm(f.sku).includes(nq) || _norm(f.bodega).includes(nq) || _norm(f.familia).includes(nq)));
  const filas = filtradas.slice(0, tope);
  const celda = (f, c) => {
    if (c.key === "sku") return f.sku;
    if (c.key === "familia") return f.familia;
    if (c.key === "bodega") return f.bodega || "—";
    if (c.key === "estado") return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: _capCol(f.estadoColor), boxShadow: `0 0 5px ${_capCol(f.estadoColor)}99`, flexShrink: 0 }}/>
        {f.estadoLabel}
      </span>
    );
    if (c.key === "accion") return f.accion;
    if (c.key === "usd") return f.usdFmt;
    if (c.key === "rotacion") return f.rotacionFmt;
    if (c.key === "doh") return f.dohFmt;
    if (c.key === "margenPct") return f.margenFmt;
    if (c.key === "benchmark") return f.benchmarkFmt;
    if (c.key === "desvio") return f.desvioFmt;
    if (c.key === "diasSinVenta") return f.diasSinVenta == null ? "—" : `${f.diasSinVenta}d`;
    if (c.key === "ventaDiaria") return f.ventaDiaria == null ? "—" : `${f.ventaDiaria}/d`;
    if (c.key === "stockUnd") return f.stockUnd == null ? "—" : f.stockUnd.toLocaleString("es-CL");
    return f[c.key] ?? "—";
  };
  const colorCelda = (f, c) => {
    if (c.key === "estado") return C.text;   // la palabra en blanco; el color vive en el punto
    if (c.key === "doh" && f.urgente) return C.red;                    // menos de 5 días: se corta ya
    if (c.key === "desvio") return f.bajoBenchmark ? C.amber : C.textSub;
    if (c.key === "usd") return f.destacar ? C.text : C.textSub;       // el capital grande, destacado
    return C.textSub;
  };
  const filtro = (valor, set, opciones, label) => (
    <span style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
      {["todas", ...opciones].map((o) => (
        <button key={o} onClick={() => set(o)} aria-pressed={valor === o}
          style={{ padding: "2px 9px", borderRadius: 6, border: `1px solid ${valor === o ? "rgba(47,184,218,0.5)" : C.border}`, background: valor === o ? "rgba(47,184,218,0.10)" : "transparent", color: valor === o ? C.celeste : C.textMuted, fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', system-ui, sans-serif", whiteSpace: "nowrap" }}>
          {o === "todas" ? label : o}
        </button>
      ))}
    </span>
  );
  return (
    <div style={{ ..._RC_CARD, marginTop: 9 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
        <span style={{ ..._RC_HEAD, color: C.text }}>{tabla.titulo}</span>
        <Num>{tabla.totalFmt}</Num>
        <span style={{ fontSize: 11, color: C.textMuted }}>{tabla.n} {tabla.n === 1 ? "fila" : "filas"} · {tabla.objetivo}</span>
        <button onClick={onCerrar} style={{ marginLeft: "auto", background: "transparent", border: "none", padding: 0, color: C.celeste, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', system-ui, sans-serif" }}>Cerrar ▴</button>
      </div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
        <input value={q} onChange={(e) => { setQ(e.target.value); setTope(_CAP_PAGINA); }}
          placeholder={`Buscar entre ${tabla.n} ${tabla.n === 1 ? "fila" : "filas"}…`} aria-label="Buscar SKU"
          style={{ flex: "0 1 230px", minWidth: 150, padding: "5px 10px", borderRadius: 7, border: `1px solid ${C.border}`, background: "rgba(255,255,255,0.03)", color: C.text, fontSize: 11.5, fontFamily: "'DM Sans', system-ui, sans-serif", outline: "none" }}/>
        {bodegas.length > 1 ? filtro(bodega, setBodega, bodegas, "Todas las bodegas") : null}
        {familias.length > 1 ? filtro(familia, setFamilia, familias, "Todas las familias") : null}
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5, minWidth: 640 }}>
          <thead><tr>{tabla.columnas.map((c) => (
            <th key={c.key} style={{ ..._RC_TH, textAlign: c.align }} title={c.nota ? `${c.label} — ${c.nota}` : undefined}>
              {c.label}{c.nota ? <span style={{ color: C.textMuted, fontWeight: 400 }}> ·{c.nota}</span> : null}
            </th>
          ))}</tr></thead>
          <tbody>{filas.map((f) => (<React.Fragment key={f.sku}>
            <tr>
              {tabla.columnas.map((c) => (
                <td key={c.key} style={{ ..._RC_TD, textAlign: c.align, color: colorCelda(f, c),
                  fontWeight: c.key === "sku" || (c.key === "usd" && f.destacar) ? 600 : 400,
                  fontFamily: c.align === "left" ? "'DM Sans', system-ui, sans-serif" : MONO }}>
                  {c.key === "sku" ? (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      {onAsk ? (
                        <button onClick={() => onAsk(f.ask)} title={`Pregúntale a ADI: ${f.ask}`}
                          style={{ background: "transparent", border: "none", padding: 0, color: C.text, fontSize: 11.5, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', system-ui, sans-serif", borderBottom: "1px solid rgba(47,184,218,0.35)" }}>{celda(f, c)}</button>
                      ) : celda(f, c)}
                      {/* A QUIÉN LE CALZA ESTE PRODUCTO · solo donde el módulo lo trae (los detenidos) */}
                      {f.compradores ? (
                        <button onClick={() => setAbierto(abierto === f.sku ? null : f.sku)} aria-expanded={abierto === f.sku}
                          title={`A quién le vendes ${f.sku}`}
                          style={{ background: "transparent", border: "none", padding: 0, color: C.celeste, fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', system-ui, sans-serif", whiteSpace: "nowrap" }}>
                          {abierto === f.sku ? "▴" : "▾ a quién"}
                        </button>
                      ) : null}
                    </span>
                  ) : celda(f, c)}
                </td>
              ))}
            </tr>
            {f.compradores && abierto === f.sku ? (
              <tr>
                <td colSpan={tabla.columnas.length} style={{ padding: "2px 6px 10px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                    <span style={{ fontFamily: MONO, fontSize: 7.5, letterSpacing: "0.5px", textTransform: "uppercase", color: _rcEstatusCol(f.compradores.estatus), border: `1px solid ${_rcEstatusCol(f.compradores.estatus)}55`, borderRadius: 3, padding: "1px 5px", flexShrink: 0 }}>{f.compradores.estatus}</span>
                    <span style={{ fontSize: 10.5, color: C.textMuted }}>a quién le vendes esto hoy</span>
                    {f.compradores.filas.map((c2) => (
                      <span key={c2.nombre} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "2px 8px", borderRadius: 7, border: `1px solid ${C.border}`, background: "rgba(255,255,255,0.015)" }}>
                        <span style={{ fontSize: 11, color: C.textSub }}>{c2.nombre}</span>
                        <span style={{ fontFamily: MONO, fontSize: 10.5, color: C.text, fontVariantNumeric: "tabular-nums" }}>{c2.pctFmt}</span>
                      </span>
                    ))}
                    {f.compradores.resto > 0 ? <span style={{ fontSize: 10.5, color: C.textMuted }}>+{f.compradores.resto} más</span> : null}
                  </div>
                  <div style={{ fontSize: 10, color: C.textMuted, lineHeight: 1.5, marginTop: 5 }}>{tabla.compradoresNota}</div>
                </td>
              </tr>
            ) : null}
          </React.Fragment>))}</tbody>
        </table>
      </div>
      {/* SIEMPRE se dice cuántas hay detrás: una tabla que corta en silencio se lee como si eso fuera todo */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 7 }}>
        <span style={{ fontSize: 10.5, color: C.textMuted }}>
          {filtradas.length === tabla.n
            ? `${filas.length} de ${tabla.n}`
            : `${filas.length} de ${filtradas.length} que coinciden · ${tabla.n} en total`}
        </span>
        {filtradas.length > filas.length ? (
          <button onClick={() => setTope((t) => t + _CAP_PAGINA)}
            style={{ background: "transparent", border: "none", padding: 0, color: C.celeste, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', system-ui, sans-serif" }}>
            Ver {Math.min(_CAP_PAGINA, filtradas.length - filas.length)} más ▾
          </button>
        ) : null}
        {filtradas.length === 0 ? <span style={{ fontSize: 11, color: C.textSub }}>Ningún SKU coincide con esa búsqueda.</span> : null}
      </div>
      <div style={{ fontSize: 10.5, color: C.textMuted, lineHeight: 1.5, marginTop: 4 }}>Ordenada {tabla.orden}</div>
      {(tabla.faltan || []).map((t, i) => (
        <div key={i} style={{ fontSize: 10.5, color: C.textMuted, lineHeight: 1.5, marginTop: 4 }}>⚠ {t}</div>
      ))}
      {onAsk && ask ? <div style={{ marginTop: 8 }}>{_btnADI(() => onAsk(ask), "Que ADI lo explique →")}</div> : null}
    </div>
  );
}

/* El KPI que emite el módulo ↔ el componente declarado en el manifiesto. Vive FUERA de la cara a propósito: es una
 * tabla estática de emparejamiento, no estado de render. La llave de la izquierda es la del builder (interna, nadie
 * la lee en pantalla); el componentId de la derecha usa la palabra del producto — «inmovilizado», una sola palabra
 * para una sola cosa (candado de vocabulario del owner, `_mesa_capital_gate`). */
const _CAP_KPI_COMPONENTES = [
  ["capital",  "capital/01/kpi-capital"],
  ["detenido", "capital/01/kpi-inmovilizado"],
  ["quiebres", "capital/01/kpi-quiebres"],
  ["rotacion", "capital/01/kpi-rotacion"],
];
function MesaCapitalCara({ capital: cap, scenario, onAsk = null, watch = null, onWatch = null, wl = { items: [] } }) {
  const head = { fontFamily: MONO, fontSize: 9.5, letterSpacing: "0.5px", color: C.text, textTransform: "uppercase" };
  const semCol = { verde: C.green, ambar: C.amber, rojo: C.red };
  // el cuadro operable vive DENTRO de 01, cerrado (owner 2026-08-08, decisión 4) — Capital NO repite el error de
  // Comercial, donde eliminar el contenedor se llevó la operabilidad entera. Acá solo baja de plano.
  // (`verCuadro` murió con "Ver inventario general" · owner 2026-08-09: la card "Capital total" abre la misma
  //  grilla, con buscador y filtros. Tener las dos era la misma tabla dos veces.)
  const [corte, setCorte] = useState((cap.cortes && cap.cortes.porDefecto) || "bodega");
  // (`verDetalle` murió con el detalle sin encabezados · owner 2026-08-09)
  // cada KPI abre SU tabla (owner 2026-08-09): la card ya no dispara la pregunta a ADI — la pregunta vive dentro
  // del detalle, que es donde el usuario ya tiene el contexto para hacerla.
  const [drill, setDrill] = useState(null);
  /* ── EMISIÓN DEL CONTEXTO · cara Capital (Contrato de Concordancia, owner 2026-08-09) ─────────────────────
   * El eje de esta cara es el SKU y su unidad es el capital valorizado, no la venta comercial: es exactamente la
   * clase de confusión que el contexto viene a impedir cuando el usuario pregunta "y esto contra qué se compara".
   * Cada pieza deriva de `cap` (la salida viva de buildMesaCapital) y su control activo viaja declarado. */
  const _oC = { scenario, onAsk };
  const _oCdrill = { ..._oC, controles: { drill: drill || "" } };
  const vCapVeredicto = useViewContext("capital/01/veredicto", cap, _oC);
  const vCapMapa = useViewContext("capital/01/mapa", cap, _oC);
  const vCapCortes = useViewContext("capital/01/cortes", cap, { ..._oC, controles: { corte } });
  const vCapReponer = useViewContext("capital/01/reponer", cap, _oC);
  const vCapLiquidar = useViewContext("capital/01/liquidar", cap, _oC);
  const vCapBarras = useViewContext("capital/01/barras", cap, _oC);
  // las cuatro cards, en el MISMO orden del emparejamiento de módulo (ver _CAP_KPI_COMPONENTES arriba): el KPI se
  // empareja con su componente por la llave que emite el builder, jamás por la posición en pantalla.
  const _hooksKpi = [
    useViewContext(_CAP_KPI_COMPONENTES[0][1], cap, _oCdrill),
    useViewContext(_CAP_KPI_COMPONENTES[1][1], cap, _oCdrill),
    useViewContext(_CAP_KPI_COMPONENTES[2][1], cap, _oCdrill),
    useViewContext(_CAP_KPI_COMPONENTES[3][1], cap, _oCdrill),
  ];
  const ctxKpiCap = Object.fromEntries(_CAP_KPI_COMPONENTES.map(([k], i) => [k, _hooksKpi[i]]));
  // la pregunta de la lectura del mapa sale del propio módulo (la del KPI de capital inmovilizado), nunca de un
  // literal escrito en la vista: el vocabulario de lo que se le manda a ADI es contrato del módulo.
  const _askMapa = ((cap.kpis || []).find((k) => k.key === _CAP_KPI_COMPONENTES[1][0]) || {}).ask || null;
  // `capital/01/focos`, `capital/01/simulaciones` y `capital/01/alertas` están declarados en el manifiesto pero HOY
  // NO SE PINTAN en esta cara (el owner los sacó el 2026-08-09 junto con la tira de estados y el "¿Y si…?"). No se
  // les cablea emisor: un contexto de algo que no está en pantalla haría que ADI resolviera "esto" contra una
  // pieza que el usuario no está viendo. Quedan declarados para cuando vuelvan — es alcance pendiente, no mudo.
  const MovHead = ({ num, title, def }) => (
    <div style={{ ...head, marginBottom: 9, display: "flex", alignItems: "center", gap: 6 }}>
      {num ? <span style={{ color: C.celeste, opacity: 0.85 }}>{num}</span> : null}{title}<InfoDot def={def} align="left"/>
    </div>
  );
  const vistaCorte = (cap.cortes && cap.cortes.vistas.find((v) => v.key === corte)) || (cap.cortes && cap.cortes.vistas[0]);
  // la referencia de largo de las barras del bloque 02 · la fila más grande llena el riel, las demás se miden
  // contra ella. Es dibujo, no aritmética: los montos y los porcentajes salen intactos del módulo.
  const maxFila = vistaCorte ? Math.max(...vistaCorte.filas.map((f) => f.usd || 0), 1) : 1;
  return (<>
    {/* ── 01 · QUÉ ESTÁ PASANDO · veredicto + KPIs + distribución + el inventario general, cerrado ── */}
    <div>
      <MovHead num="01" title="Qué está pasando" def={`El mapa del capital: cuánto trabaja en rango, cuánto está por cortarse (quiebre próximo), cuánto sobra (sobrestock) y cuánto está inmovilizado — los estados del motor contra tu benchmark (rotación ${POLICY.rotacionMin}x · ${POLICY.dohMax} días de inventario). Los tramos suman exacto tu capital total. Toca un tramo, la leyenda o un KPI y ADI abre esa historia al lado.`}/>
      {/* EL VEREDICTO · localiza dónde está el capital y dónde falta. NO afirma la venta perdida por quiebre:
          eso no está medido en este dato. */}
      {cap.veredicto ? (
        <div style={{ padding:"13px 16px", borderRadius:12, border:`1px solid ${C.border}`, borderLeftWidth:3,
          borderLeftColor: cap.veredicto.tipo === "senal" ? C.celeste : C.borderLight,
          background:"linear-gradient(90deg, rgba(47,184,218,0.06), rgba(47,184,218,0.01) 55%, transparent)", marginBottom:10 }}>
          <div style={{ fontSize:17, fontWeight:600, color:C.text, lineHeight:1.35, letterSpacing:"-0.1px" }}>{cap.veredicto.titular}</div>
          <div style={{ fontSize:12.5, color:C.textSub, lineHeight:1.55, marginTop:6 }}>{cap.veredicto.soporte}</div>
          {cap.veredicto.cierre ? <div style={{ fontSize:12.5, color:C.textSub, lineHeight:1.55, marginTop:4 }}>{cap.veredicto.cierre}</div> : null}
        </div>
      ) : null}
      {/* la lectura del mapa pasa a ser preguntable (mismo texto, mismo lugar: gana el click y el título). La
          PREGUNTA no se escribe acá: es la que el módulo ya emite para ese KPI — una sola verdad, y así el
          vocabulario del producto lo sigue fijando el módulo, no la vista. */}
      <div style={{ fontSize:12, color:C.textSub, lineHeight:1.55, padding:"10px 12px", border:`1px solid ${C.border}`, borderRadius:10, background:"rgba(47,184,218,0.03)", marginBottom:9, ...(vCapMapa.ask && _askMapa ? { cursor:"pointer" } : {}) }}
        title={vCapMapa.ask && _askMapa ? `Pregúntale a ADI: ${_askMapa}` : undefined}
        onClick={vCapMapa.ask && _askMapa ? () => vCapMapa.ask(_askMapa) : undefined}>
        <span style={{ color:C.celeste, fontWeight:600 }}>ADI · </span>{cap.mapa.lectura}
      </div>
      {/* LA TIRA DE ESTADOS SE ELIMINÓ (owner 2026-08-09): repetía por tercera vez las cuatro cifras que ya
          dicen la línea de ADI y las cards, y la barra por estado ya vive en cada bodega del bloque 02. */}
      {/* los KPIs de la cara · capital total · detenido · quiebres próximos · rotación media */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(130px, 1fr))", gap:9, marginTop:9 }}>
        {cap.kpis.map((k) => { const col = semCol[k.estado]; const abierta = drill === k.key;
          const tabla = cap.drill && cap.drill[k.key];
          const vK = ctxKpiCap[k.key] || vCapVeredicto; return (
          // abrir el detalle de una card INFORMA su contexto: la pregunta que el usuario haga después ya llega
          // sabiendo qué card tiene abierta y no el total de la cara (dos universos, dos cifras legítimas).
          <button key={k.key} onClick={tabla ? () => { setDrill(abierta ? null : k.key); if (!abierta && vK && vK.ctx) setUISignal({ viewContext: vK.ctx }); } : undefined}
            aria-pressed={abierta} title={tabla ? `Ver ${tabla.titulo.toLowerCase()} (${tabla.n})` : undefined}
            style={{ position:"relative", background: abierta ? "rgba(47,184,218,0.07)" : "rgba(255,255,255,0.02)", border:`1px solid ${abierta ? "rgba(47,184,218,0.5)" : C.border}`, borderRadius:10, padding:"10px 12px", textAlign:"left", fontFamily:"'DM Sans', system-ui, sans-serif", cursor: tabla ? "pointer" : "default", display:"flex", flexDirection:"column", gap:4, transition:"background 0.15s, border-color 0.15s" }}
            onMouseEnter={(ev) => { if (!abierta) ev.currentTarget.style.background = "rgba(47,184,218,0.05)"; }}
            onMouseLeave={(ev) => { if (!abierta) ev.currentTarget.style.background = "rgba(255,255,255,0.02)"; }}>
            {/* minHeight de dos líneas: "Capital inmovilizado" envuelve y sin esto los cuatro titulares quedaban
                a alturas distintas — cuatro cards que se leen juntas tienen que alinear sus cifras */}
            <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:6, minHeight:27 }}>
              <span style={{ fontSize:10.5, color:C.textMuted, lineHeight:1.28 }}>{k.label}</span>
              {col && <span style={{ width:7, height:7, borderRadius:"50%", background:col, boxShadow:`0 0 6px ${col}aa`, flexShrink:0 }}/>}
            </div>
            <div style={{ fontSize:16, fontWeight:600, color:C.text, fontFamily:MONO, letterSpacing:"0.2px", fontVariantNumeric:"tabular-nums" }}>{k.value}</div>
            <div style={{ fontSize:10, color:C.textMuted, lineHeight:1.35 }}>{k.linea}</div>
            {tabla ? <span style={{ fontSize:10, color:C.celeste, fontWeight:600, marginTop:2 }}>{abierta ? "Ocultar el detalle ▴" : `Ver el detalle (${tabla.n}) ▾`}</span> : null}
          </button>
        ); })}
      </div>
      {/* EL DETALLE DE LA CARD ABIERTA · una tabla por KPI, con el universo que ese KPI cuenta */}
      {drill && cap.drill && cap.drill[drill] ? (
        <CapitalDrill tabla={cap.drill[drill]} ask={(cap.kpis.find((k) => k.key === drill) || {}).ask}
          onAsk={(ctxKpiCap[drill] && ctxKpiCap[drill].ask) || vCapVeredicto.ask} onCerrar={() => setDrill(null)}/>
      ) : null}
      {/* DÓNDE ESTÁ TU PLATA · el reparto por SKU, en barras. Va en 01 porque el owner lo pidió para que "se
          entienda al entrar" (2026-08-09). No repite las cards: ellas dan los totales por estado, esto da el
          reparto por producto — y las unidades adentro muestran lo que ninguna otra vista de la cara muestra. */}
      <CapitalBarras barras={cap.barras} onAsk={vCapBarras.ask}/>
      {/* ── "VER INVENTARIO GENERAL" SE ELIMINÓ (owner 2026-08-09) ──────────────────────────────────────────────
          El cuadro entero quedó redundante: la card "Capital total" abre las mismas 13 filas con las mismas
          columnas, más buscador y filtros pensados para miles de SKU. Tener las dos era la misma tabla dos veces.
          ⚠️ SE VA CON ÉL LA ESTRELLA DE LA WATCHLIST, que vivía solo acá — Comercial ya la había perdido, así que
          ahora no queda ninguna cara donde marcar un seguido. La lista "Lo que yo sigo" sigue mostrando lo ya
          marcado, pero no hay dónde agregar. Está avisado al owner; si decide recuperarla, va en el detalle de
          Capital total, que es donde ahora vive la grilla. */}
    </div>
    {/* ── LO QUE YO SIGO · transversal (la MISMA watchlist de la cara comercial — la estrella del cuadro de capital
        también suma acá · una lista, dos caras) ── */}
    {wl.items.length > 0 && (
      <div>
        <MovHead title="Lo que yo sigo" def={"Tu lista de seguimiento — la misma de la cara comercial (una sola lista): marca la estrella en cualquier fila del cuadro y queda acá con su cifra clave y su estado. Toca un seguido y ADI lo abre al lado; la estrella lo saca de la lista."}/>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(150px, 1fr))", gap:8 }}>
          {wl.items.map((it) => { const col = it.vara ? semCol[it.vara] : null; return (
            <button key={it.dim + "·" + it.nombre} onClick={onAsk && it.ask ? () => onAsk(it.ask) : undefined}
              title={onAsk && it.ask ? `Pregúntale a ADI: ${it.ask}` : undefined}
              style={{ display:"flex", flexDirection:"column", alignItems:"stretch", gap:3, padding:"9px 11px", borderRadius:10, border:`1px solid ${C.border}`,
                background:"rgba(255,255,255,0.02)", color:C.text, fontFamily:"'DM Sans', system-ui, sans-serif", textAlign:"left",
                cursor: onAsk && it.ask ? "pointer" : "default", transition:"background 0.15s" }}
              onMouseEnter={(ev) => { ev.currentTarget.style.background = "rgba(47,184,218,0.05)"; }}
              onMouseLeave={(ev) => { ev.currentTarget.style.background = "rgba(255,255,255,0.02)"; }}>
              <span style={{ display:"flex", alignItems:"center", gap:6, minWidth:0 }}>
                <span onClick={(e) => { e.stopPropagation(); onWatch && onWatch(it.dim, it.nombre); }} title="Dejar de seguir"
                  style={{ color:C.celeste, fontSize:11, lineHeight:1, flexShrink:0, cursor:"pointer" }}>★</span>
                <span style={{ fontSize:11.5, fontWeight:600, color:C.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", flex:1 }}>{it.nombre}</span>
                {col && <span style={{ width:7, height:7, borderRadius:"50%", background:col, boxShadow:`0 0 6px ${col}aa`, flexShrink:0 }}/>}
              </span>
              <span style={{ display:"flex", alignItems:"baseline", gap:6 }}>
                <span style={{ fontSize:14, fontWeight:600, color:C.text, fontFamily:MONO, letterSpacing:"0.2px", fontVariantNumeric:"tabular-nums" }}>{it.cifra}</span>
                <span style={{ fontSize:9, color:C.textMuted, fontFamily:MONO, letterSpacing:"0.5px", textTransform:"uppercase" }}>{it.dimLabel}</span>
              </span>
              <span style={{ fontSize:10, color:C.textMuted, lineHeight:1.35 }}>{it.sub}</span>
            </button>
          ); })}
        </div>
      </div>
    )}
    {/* ── 02 · DÓNDE OCURRE · el MISMO capital por bodega, por familia y por SKU ──────────────────────────────
        Abre por BODEGA (owner 2026-08-08, decisión 5: ahí está el patrón operativo más fuerte).
        ⚠️ La bodega LOCALIZA, no explica ni habilita transferencias — las dos cosas se dicen, sin volverlas el
        tema. Los tres cortes reparten el mismo total y el gate lo verifica fila por fila. */}
    <div>
      {/* ── EL TÍTULO DICE LO QUE EL BLOQUE PUEDE DAR (owner 2026-08-09) ────────────────────────────────────────
          El brief original lo llamaba "por qué está pasando", pero este dato no trae la causa: no hay
          obsolescencia, ni sobrecompra, ni temporada, y ya se declara que no se pueden inferir. Lo que sí hay son
          los dos ejes que enmarcan el problema —dónde está el capital y desde cuándo no se mueve—, así que eso
          es lo que promete el título. Prometer causa sería repetir el "revisar costo" de Comercial. */}
      <MovHead num="02" title="Dónde y desde cuándo" def={`El mismo capital repartido de tres maneras: por bodega, por familia y por días sin venta. Cada corte suma exacto tu capital total (${cap.totalFmt}) — son el mismo dinero visto distinto, no tres cuentas, y la barra de cada fila muestra en qué estado está. Los dos ejes enmarcan el problema pero ninguno lo explica: que se concentre en una bodega dice DÓNDE está, y la antigüedad dice DESDE CUÁNDO; por qué se detuvo —obsolescencia, sobrecompra, temporada— no está en este dato. Y como cada SKU aparece en una sola bodega, tampoco se puede evaluar si conviene mover stock de una a otra. Ojo con los días: son días SIN VENTA, no días almacenado — no hay fecha de recepción en el dato.`}/>
      {cap.cortes && vistaCorte ? (<>
        <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", marginBottom:8 }}>
          <span style={{ display:"flex", gap:3 }}>
            {cap.cortes.vistas.map((v) => (
              // cambiar de corte cambia el EJE que el usuario mira (bodega / familia / edad): informa el contexto
              <button key={v.key} onClick={() => { setCorte(v.key); if (vCapCortes.ctx) setUISignal({ viewContext: vCapCortes.ctx }); }} aria-pressed={vistaCorte.key === v.key}
                style={{ padding:"3px 11px", borderRadius:6, border:`1px solid ${vistaCorte.key === v.key ? "rgba(47,184,218,0.5)" : C.border}`, background: vistaCorte.key === v.key ? "rgba(47,184,218,0.10)" : "transparent", color: vistaCorte.key === v.key ? C.celeste : C.textMuted, fontSize:10.5, fontWeight:600, cursor:"pointer", fontFamily:"'DM Sans', system-ui, sans-serif", whiteSpace:"nowrap" }}>
                {v.label} ({v.n})
              </button>
            ))}
          </span>
          <span style={{ fontFamily:MONO, fontSize:7.5, letterSpacing:"0.5px", textTransform:"uppercase", color: vistaCorte.reconcilia ? C.green : C.amber, border:`1px solid ${vistaCorte.reconcilia ? C.green : C.amber}55`, borderRadius:3, padding:"1px 5px" }}>{vistaCorte.reconcilia ? "concilia" : "otro corte"}</span>
        </div>
        {/* LA REGLA 80/20 SOBRE EL CAPITAL (owner 2026-08-09) · la frase viene del módulo y nombra los dos
            universos, cabeza y cola, que cierran con el total */}
        {vistaCorte.pareto ? (
          <div style={{ fontSize:12, color:C.text, lineHeight:1.5, marginBottom:8 }}>{vistaCorte.pareto.lectura}</div>
        ) : null}
        <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
          {vistaCorte.filas.map((f) => (
            <div key={f.nombre} style={{ padding:"9px 12px", borderRadius:10, border:`1px solid ${C.border}`, background:"rgba(255,255,255,0.018)", opacity: f.enGrupo === false ? 0.62 : 1 }}>
              <div style={{ display:"flex", alignItems:"baseline", gap:8, flexWrap:"wrap" }}>
                <span style={{ fontSize:12.5, fontWeight:600, color:C.text, flex:"0 1 auto" }}>{f.nombre}</span>
                <Num>{f.usdFmt}</Num>
                <span style={{ fontSize:10.5, color:C.textMuted }}>{f.pctTotal}% del capital · {f.n} SKU</span>
                {/* la cabeza del 80/20 se marca; la cola queda atenuada, sin desaparecer */}
                {f.enGrupo ? <span style={{ fontFamily:MONO, fontSize:8, color:C.celeste, border:"1px solid rgba(47,184,218,0.4)", borderRadius:3, padding:"0 4px" }}>80%</span> : null}
              </div>
              {/* LA BARRA APILADA · el capital de ESTA fila repartido en sus estados. Dos cambios de fondo
                  (owner 2026-08-09, "mejorá las barras"):
                  · EL LARGO AHORA DICE ALGO. Antes las cuatro bodegas tenían la barra del mismo largo: $64K y $13K
                    se dibujaban igual y solo el número los separaba. Ahora la barra se mide contra la fila más
                    grande, así que el largo es la MAGNITUD y el reparto interno sigue siendo la MEZCLA. Los
                    porcentajes de la leyenda no cambian: siguen siendo dentro de la fila.
                  · Mismo acabado que el gráfico de arriba: riel con borde interior, degradado vertical por tramo y
                    una hairline del color del fondo entre tramos — sin ella dos colores contiguos se funden. */}
              <div style={{ height:10, borderRadius:5, marginTop:8, overflow:"hidden",
                background:"rgba(255,255,255,0.035)", boxShadow:"inset 0 0 0 1px rgba(255,255,255,0.045)" }}>
                <div style={{ display:"flex", height:"100%", borderRadius:5, overflow:"hidden",
                  width:`${Math.max((f.usd / maxFila) * 100, 3)}%` }}>
                  {f.tramos.map((t, ti) => (
                    <span key={t.key} title={`${t.label}: ${t.usdFmt} (${t.pct}%)`}
                      style={{ width:`${Math.max(t.pct, 2)}%`,
                        background:`linear-gradient(180deg, ${_capCol(t.color)}, ${_capCol(t.color)}a8)`,
                        boxShadow: ti ? "inset 1.5px 0 0 rgba(11,11,11,0.9)" : "none",
                        transformOrigin:"left center", animation:`adiRise 460ms cubic-bezier(.2,.7,.3,1) ${ti * 45}ms both` }}/>
                  ))}
                </div>
              </div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:"3px 13px", marginTop:7, fontSize:10.5, color:C.textMuted }}>
                {f.tramos.map((t) => (
                  <span key={t.key} style={{ display:"flex", alignItems:"center", gap:5 }}>
                    <span style={{ width:7, height:7, borderRadius:"50%", background:_capCol(t.color), flexShrink:0 }}/>
                    {t.label} <Num>{t.usdFmt}</Num> <span>{t.pct}%</span>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div style={{ fontSize:10.5, color:C.textMuted, lineHeight:1.5, marginTop:7 }}>{cap.cortes.nota}</div>
        {/* EL "DETALLE POR SKU" SE ELIMINÓ (owner 2026-08-09): era una lista sin encabezados —había que
            adivinar qué era cada número— y la card "Capital total" ya abre los mismos SKU con columnas
            nombradas, buscador y filtros. Era una mala versión de algo que ya está bien hecho. */}
      </>) : (
        <div style={{ fontSize:12, color:C.textSub, lineHeight:1.5 }}>Sin cortes disponibles para el capital del período.</div>
      )}
    </div>
    {/* ── 03 · QUÉ HACER PRIMERO · dos grupos, con la acción en el título (owner 2026-08-08, decisiones 6 y 9) ──
        Máximo 5 por lista, el resto detrás de "ver todos" — para que escale a una empresa grande.
        Las cuatro acciones permitidas son textuales del owner: el detenido dice "evaluar salida comercial", NO
        "liquidar" — que un SKU no rote no prueba que haya que rematarlo. */}
    <div>
      <MovHead num="03" title="Qué hacer primero" def={"Dos frentes, con la evidencia propia del inventario: PROTEGER LA VENTA son los SKU que rotan rápido y a los que les quedan pocos días de inventario (ordenados por urgencia: primero el que se queda sin stock antes); RECUPERAR LIQUIDEZ son los que no rotan según tu benchmark, ordenados por el capital que inmovilizan. Ninguna de las dos listas usa cifras de venta comercial: el inventario y la venta no reconcilian en unidad ni en período, así que cruzarlos daría un número falso. Cada línea lleva su pregunta; el botón le pide a ADI el orden completo."}/>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(300px, 1fr))", gap:9 }}>
        {[cap.reponer, cap.liquidar].map((lista, li) => (
          // cada lista manda SU contexto: reponer se mide en días de inventario y liberar se mide en capital
          // inmovilizado. Son dos universos y dos métricas — un solo contexto para las dos sería el error de siempre.
          <ResumenCapitalLista key={li} lista={lista} tono={li === 0 ? C.red : C.amber} onAsk={li === 0 ? vCapReponer.ask : vCapLiquidar.ask}/>
        ))}
      </div>
    </div>
    {/* ── LO QUE ESTA CARA NO PUEDE AFIRMAR · declarado, no disimulado ── */}
    {(cap.limitaciones || []).length > 0 && (
      <div style={{ fontSize:10.5, color:C.textMuted, lineHeight:1.55, padding:"9px 12px", border:`1px dashed ${C.border}`, borderRadius:10 }}>
        <span style={{ ...head, marginRight:6 }}>Lo que este dato no permite afirmar</span>
        {cap.limitaciones.join(" ")}
      </div>
    )}
    {/* "¿Y SI…?" SE ELIMINÓ (owner 2026-08-09: "no aporta") — el mismo criterio con que salió de Comercial:
        proyectaba lo que ya dicen las cards ($33K detenidos, $36K en quiebre) envuelto en un condicional. */}
    {/* (El "Cuadro de capital" ya NO va suelto al final: subió DENTRO de 01, cerrado bajo "Ver inventario
        general" — owner 2026-08-08, decisión 4. Es el mismo componente con toda su operabilidad; lo único que
        cambió es la altura a la que vive. Tenerlo dos veces sería mostrar la misma tabla dos veces.) */}
  </>);
}

/* ── CUADRO DE CAPITAL · la grilla del inventario (mismo patrón del cuadro comercial · SIN tocar CuadroMando) ──
 * Eje SKU/bodega · columnas clásicas + Estado del MOTOR + "En juego $" + chip Acción con su pregunta · microlectura
 * SOLO en "En alerta" · estrella → watchlist transversal. SIN comparado ni ficha: no existe serie mensual de stock
 * por SKU (honesto — la serie de venta no la sustituye). */
function CuadroCapital({ scenario, onAsk = null, watch = null, onWatch = null }) {
  const [eje, setEje] = useState("sku");
  const [mode, setMode] = useState("all");
  const [busca, setBusca] = useState("");
  const [sortKey, setSortKey] = useState("capital");
  const cc = buildCuadroCapital(eje, scenario);
  const cols = cc.columns;
  const moneyk = (v) => "$" + (Math.abs(v) / 1000).toFixed(1) + "K";
  const usd = (v) => { const a = Math.abs(v); return a >= 1e6 ? "$" + (a / 1e6).toFixed(1) + "M" : a >= 1e3 ? "$" + Math.round(a / 1e3) + "K" : "$" + Math.round(a); };
  const fmt = (col, v) => {
    if (v == null) return "—";
    if (col.fmt === "moneyk") return moneyk(v);
    if (col.fmt === "usd")    return usd(v);
    if (col.fmt === "x")      return r1(v) + "x";
    if (col.fmt === "d")      return Math.round(v) + "d";
    if (col.fmt === "int")    return Math.round(v).toLocaleString("es-CL");
    return v;
  };
  const _normB = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const sortCol = cols.find((c) => c.key === sortKey) || cols.find((c) => c.key === "capital") || cols[0];
  let rows = cc.rows.slice().sort((a, b) => sortKey === "estado" ? (a.estadoRank - b.estadoRank) : (sortCol.sort === "asc" ? -1 : 1) * ((b[sortKey] || 0) - (a[sortKey] || 0)));
  if (busca.trim()) rows = rows.filter((r) => _normB(r.name).includes(_normB(busca)));
  if (mode === "top") rows = rows.slice(0, 10);
  else if (mode === "bottom") rows = rows.slice(-10);
  else if (mode === "alert") rows = rows.filter((r) => r.alert);
  const GRID = `18px 1.3fr ${cols.map(() => "1fr").join(" ")}`;
  const minWBase = 40 + cols.length * 66 + 110;
  const pill = (active, label, onClick, key) => (
    <button key={key} onClick={onClick} style={{ padding:"4px 10px", borderRadius:6, fontSize:11.5, cursor:"pointer", fontFamily:"'DM Sans', system-ui, sans-serif", whiteSpace:"nowrap",
      background: active ? "rgba(255,255,255,0.1)" : "transparent", border:`1px solid ${active ? "rgba(255,255,255,0.35)" : C.border}`, color: active ? C.text : C.textMuted }}>{label}</button>
  );
  const actionColor = (a) => (/liquidar|reponer|frenar/.test(a) ? C.amber : C.textMuted);
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
      {/* eje + filtros de la tabla */}
      <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
        <div style={{ display:"flex", gap:5 }}>
          {CUADRO_CAPITAL_EJES.map((d) => pill(eje === d.key, d.label, () => { setEje(d.key); setMode("all"); setBusca(""); setSortKey("capital"); }, d.key))}
        </div>
        <span style={{ fontSize:11, color:C.textMuted, marginLeft:6 }}>Ver</span>
        {pill(mode === "all", "Todos", () => setMode("all"), "all")}
        {pill(mode === "top", "Top 10", () => setMode("top"), "top")}
        {pill(mode === "bottom", "Peores 10", () => setMode("bottom"), "bot")}
        {pill(mode === "alert", "En alerta", () => setMode("alert"), "al")}
        {cc.rows.length > 12 && (
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={`buscar ${cc.plural}…`}
            style={{ padding:"4px 10px", borderRadius:6, border:`1px solid ${busca ? "rgba(47,184,218,0.5)" : C.border}`, background:"transparent", color:C.text, fontSize:11.5, fontFamily:"'DM Sans', system-ui, sans-serif", outline:"none", width:130 }}/>
        )}
      </div>
      {/* la grilla */}
      <div style={{ overflowX:"auto" }}>
        <div style={{ minWidth: minWBase }}>
          <div style={{ display:"grid", gridTemplateColumns:GRID, gap:"0 8px", alignItems:"center", fontSize:9, color:C.textMuted, fontFamily:MONO, letterSpacing:"0.4px", textTransform:"uppercase", padding:"0 8px 7px", borderBottom:`1px solid ${C.border}` }}>
            <span/><span>{cc.label}</span>
            {cols.map((c) => (
              <span key={c.key} onClick={() => c.key !== "accion" && setSortKey(c.key)} style={{ textAlign: c.key === "accion" ? "left" : "right", cursor: c.key === "accion" ? "default" : "pointer", color: sortKey === c.key ? C.text : C.textMuted, whiteSpace:"nowrap" }}>
                {c.label}{sortKey === c.key ? " ↓" : ""}{c.defKey && METRIC_DEFS[c.defKey] ? <InfoDot def={METRIC_DEFS[c.defKey]} align="right"/> : null}
              </span>
            ))}
          </div>
          {rows.map((r) => (
            <div key={r.name} style={{ display:"grid", gridTemplateColumns:GRID, gap:"0 8px", alignItems:"center", padding:"8px", borderRadius:6, borderBottom:"1px solid rgba(255,255,255,0.03)" }}>
              <span style={{ display:"flex", alignItems:"center", justifyContent:"center" }}>
                {onWatch ? (() => { const onW = (watch || []).some((w) => w.dim === eje && w.name === r.name); return (
                  <span onClick={(e) => { e.stopPropagation(); onWatch(eje, r.name); }}
                    title={onW ? "Dejar de seguir" : 'Seguir en "Lo que yo sigo"'}
                    style={{ color: onW ? C.celeste : "rgba(255,255,255,0.22)", fontSize:11, lineHeight:1, cursor:"pointer", transition:"color 0.15s" }}
                    onMouseEnter={(e) => { if (!onW) e.currentTarget.style.color = "rgba(47,184,218,0.7)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = onW ? C.celeste : "rgba(255,255,255,0.22)"; }}>{onW ? "★" : "☆"}</span>
                ); })() : null}
              </span>
              <span style={{ display:"flex", alignItems:"center", gap:7, minWidth:0 }}>
                {r.alert && <span style={{ width:6, height:6, borderRadius:"50%", background: r.estadoColor === "red" ? C.red : C.amber, flexShrink:0 }}/>}
                <span style={{ color:"#eef2f6", fontWeight:600, fontSize:12.5, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{r.name}</span>
              </span>
              {cols.map((c) => c.key === "accion" ? (
                onAsk && r.accionAsk ? (
                  <span key={c.key}>
                    <button onClick={(e) => { e.stopPropagation(); onAsk(r.accionAsk); }} title={`Pregúntale a ADI: ${r.accionAsk}`}
                      style={{ padding:"2px 8px", borderRadius:5, border:`1px solid ${C.border}`, background:"transparent", color:actionColor(r.accion), fontSize:10.5, cursor:"pointer", fontFamily:"'DM Sans', system-ui, sans-serif", whiteSpace:"nowrap", transition:"all 0.15s" }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(47,184,218,0.5)"; e.currentTarget.style.background = "rgba(47,184,218,0.06)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = "transparent"; }}>{r.accion}</button>
                  </span>
                ) : (
                  <span key={c.key} style={{ fontSize:11, color:actionColor(r.accion), whiteSpace:"nowrap" }}>{r.accion}</span>
                )
              ) : c.key === "estado" ? (
                <span key={c.key} title={`${(CAPITAL_ESTADOS[r.estado] && CAPITAL_ESTADOS[r.estado].def) || ""}${onAsk ? " · click y ADI abre esa historia" : ""}`}
                  onClick={onAsk && CAPITAL_ESTADOS[r.estado] ? (e) => { e.stopPropagation(); onAsk(CAPITAL_ESTADOS[r.estado].ask); } : undefined}
                  style={{ display:"flex", alignItems:"center", justifyContent:"flex-end", gap:6, minWidth:0, ...(onAsk ? { cursor:"pointer" } : {}) }}>
                  <span style={{ width:7, height:7, borderRadius:"50%", background:_capCol(r.estadoColor), boxShadow:`0 0 6px ${_capCol(r.estadoColor)}88`, flexShrink:0 }}/>
                  <span style={{ fontSize:10.5, color:C.textSub, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{r.estadoLabel}</span>
                </span>
              ) : (
                <span key={c.key} style={{ textAlign:"right" }}><Num color={c.key === "enJuego" ? C.amber : c.fmt === "moneyk" ? C.text : C.textSub}>{fmt(c, r[c.key])}</Num></span>
              ))}
              {/* MICROLECTURA · SOLO en "En alerta" (mismo patrón del cuadro comercial): la historia del detector */}
              {mode === "alert" && r.lectura && (
                <span style={{ gridColumn:"2 / -1", fontSize:10.5, color:C.textMuted, lineHeight:1.4, paddingTop:2, minWidth:0 }}>{r.lectura}</span>
              )}
            </div>
          ))}
          {/* fila TOTALES */}
          {cc.total && (
            <div style={{ display:"grid", gridTemplateColumns:GRID, gap:"0 8px", alignItems:"center", padding:"10px 8px", marginTop:4, borderTop:`1px solid ${C.borderLight}`, background:"rgba(255,255,255,0.02)" }}>
              <span/><span style={{ fontFamily:MONO, fontSize:9, fontWeight:600, letterSpacing:"0.6px", textTransform:"uppercase", color:C.text }}>Total</span>
              {cols.map((c) => c.key === "accion" || c.key === "estado" ? <span key={c.key}/> : (
                <span key={c.key} style={{ textAlign:"right" }}><Num color={c.key === "enJuego" ? C.amber : C.text}>{cc.total[c.key] == null ? "—" : fmt(c, cc.total[c.key])}</Num></span>
              ))}
            </div>
          )}
        </div>
      </div>
      <div style={{ fontSize:11, color:C.textMuted, lineHeight:1.5 }}>
        Ordena por cualquier columna · el Estado es el semáforo del motor contra tu benchmark (rotación {POLICY.rotacionMin}x · {POLICY.dohMax}d de inventario) — tocalo y ADI abre esa historia · el "En juego $" es el capital inmovilizado que el detector afirma (solo cuando hay señal) · en <span style={{ color:C.textSub }}>En alerta</span> cada fila trae su microlectura · la Acción es un chip: tocalo y ADI te dice cómo ejecutarla · la ★ la sigue en "Lo que yo sigo" · rotación media {cc.rotacionMedia}x · <span style={{ color:C.textSub }}>{cc.n} {cc.plural}</span> · escenario {scenario} · sin comparado de 12 meses: no existe serie mensual de stock por SKU (se enciende con el ERP).
      </div>
    </div>
  );
}

export function SentrixPanel({ evidence, onClose, onToggleMax, maximized = false, onAsk = null }) {
  // COMPARACIÓN · tiene PRIORIDAD sobre el shell de reading: el compare del motor trae `reading` además de `pairs`, pero
  // la evidencia de lo que ADI afirma ("X factura más, Y capta mejor margen") es la tabla A vs B, no la lente de una entidad.
  if (evidence && Array.isArray(evidence.pairs) && evidence.pairs.length && (evidence.compareB || evidence.entityB))
    return <ComparePanel evidence={evidence} onClose={onClose} onToggleMax={onToggleMax} maximized={maximized}/>;
  const baseRd = evidence && evidence.reading;
  const baseFocus = baseRd && baseRd.focus;
  const mkBase = (r) => ({ focusType: r.focusType, focus: r.focus, metric: "margen", compareWith: null });
  // ESTADO DE ANÁLISIS · STACK de navegación (§4): cada frame = {focusType, focus, metric, compareWith}.
  // El base = la respuesta de ADI; las operaciones empujan frames; "volver" desapila. La mesa viva.
  const [stack, setStack] = useState(() => (baseRd ? [mkBase(baseRd)] : []));
  // RUTEO DE LENTE · ADI abre la lente que el motor eligió (evidence.lens) · VALIDADA: Control/Evidencia solo si el
  // foco base tiene contenido ahí (cliente/bodega); si no, cae a Diagnóstico (que siempre tiene la historia).
  const _routedTab = (rd, lens) => {
    const l = lens || "diagnostico";
    if (l === "cuadro") return ADI_SENTRIX_CUADRO_ENABLED ? "cuadro" : "diagnostico";   // el cuadro es panorámico (no depende del foco)
    // Control abre para client/bodega/sku/marca (B4 · todos tienen ring) · Evidencia solo client/bodega (recibo) · Diagnóstico siempre.
    const hasLens = l === "diagnostico" || rd.focusType === "client" || rd.focusType === "bodega"
      || (l === "control" && (rd.focusType === "sku" || rd.focusType === "marca"));
    return hasLens ? l : "diagnostico";
  };
  const [tab, setTab] = useState(() => _routedTab(baseRd || {}, evidence && evidence.lens));   // shell · lente activa (Diagnóstico|Evidencia|Control)
  useEffect(() => { if (baseRd) { setStack([mkBase(baseRd)]); setTab(_routedTab(baseRd, evidence.lens)); } }, [baseFocus]);   // nueva respuesta → lente ruteada
  // PERFIL ÚNICO (owner 2026-08-06 "dame el perfil/avance/estado de X"): client_dive SIEMPRE trae evidence.reading
  // (baseRd truthy) → sin este check caería en el shell genérico de lectura (Diagnóstico/Evidencia/Control), NO en
  // la Ficha rica de la Mesa (evolutivo + perfil vs promedio + 80/20) que da clickear la fila en el Cuadro. Mismo
  // dato, misma pregunta, un solo destino — sea que la pidas por chat o que la explores vos mismo en Sentrix.
  // DESPUÉS de los hooks (regla de hooks: un return temprano acá no los salta, van todos arriba sin condición).
  if (clientMesaLink(evidence))
    return <MesaPanel evidence={evidence} onClose={onClose} onToggleMax={onToggleMax} maximized={maximized} onAsk={onAsk}/>;
  if (!baseRd) {
    // DECISIÓN (evidenceSpec Nivel 0 · dispatch key rápido, owner 2026-07-31): mesa.accion promovido a un panel
    // propio — antes vivía enterrado como el movimiento "03 · Qué hacer primero" dentro de MesaPanel cara comercial.
    // Va PRIMERO en el if-chain (gana sobre Diagnóstico/Mesa) porque es la promoción explícita del encargo. Cuando
    // evidenceSpec está ausente (ruta legacy) esta condición es siempre falsa → cae intacto al if-chain de abajo.
    if (evidence && evidence.evidenceSpec && evidence.evidenceSpec.claim && evidence.evidenceSpec.claim.type === "decision" && evidence.evidenceSpec.action)
      return <DecisionPanel evidence={evidence} onClose={onClose} onToggleMax={onToggleMax} maximized={maximized} onAsk={onAsk}/>;
    // RANKING PANORÁMICO → el Cuadro directo. "los N mejores/peores clientes/SKU" no tiene un foco ÚNICO (no hay reading
    // de UNA entidad), pero el Cuadro es una vista de dimensión COMPLETA que no necesita foco → abrimos el Cuadro solo,
    // en la dimensión del ranking. Sin esto el panel no renderiza (exige baseRd). Gated CUADRO · sin-lente/OFF = null (byte-exacto).
    // SIMULACIÓN · un supuesto sobre el dato real (transform) → la mesa Actual/Supuesto/Δ. Va ANTES que el Cuadro genérico.
    if (evidence && evidence.transform && Array.isArray(evidence.projection))
      return <SimulationPanel evidence={evidence} onClose={onClose} onToggleMax={onToggleMax} maximized={maximized}/>;
    // SIMULACIÓN · ruta ORÁCULO (simulateGeneral, toolRegistry.js) — owner "por qué el botón nunca aparece para una
    // simulación vía chat" (revisor UX 2026-07-31, CONFIRMADO en vivo): esta tool NUNCA emite `evidence.transform`/
    // `.projection` (ese shape es EXCLUSIVO del composer legacy composeSpecSimulate, un supuesto ±X% sobre TODAS
    // las entidades de un eje) — simulateGeneral es un supuesto de precio+volumen sobre UNA entidad puntual, shape
    // distinto (ventaActual/ventaNueva + costo/contribución/margen si el cost model está autorizado). Antes: cero
    // flag reconocía este shape → ni el botón "Ver ... en Sentrix" aparecía (ChatADI.jsx _evLabel) ni, aunque
    // apareciera, había panel que renderizarlo. Chequeo propio (NO vía evidence.reading — deliberado: si esta tool
    // alguna vez trae entityType, no queremos que la simulación se pierda detrás del panel de "dato puntual" del
    // ESTADO ACTUAL de la entidad, que mostraría números reales pero NO el supuesto que el usuario pidió ver).
    if (evidence && evidence.oracle && typeof evidence.ventaActual === "string" && typeof evidence.ventaNueva === "string")
      return <SimulationPanelOracle evidence={evidence} onClose={onClose} onToggleMax={onToggleMax} maximized={maximized}/>;
    // DIAGNÓSTICO · los FOCOS (evidence.findings) = la evidencia de lo que el texto dice · va ANTES del Cuadro genérico.
    if (evidence && Array.isArray(evidence.findings) && evidence.findings.length)
      return <DiagnosePanel evidence={evidence} onClose={onClose} onToggleMax={onToggleMax} maximized={maximized} onAsk={onAsk}/>;
    // COMPARACIÓN · evidencia LADO A LADO (A vs B, métrica por métrica) = lo que ADI afirma en el texto · antes del Cuadro.
    if (evidence && Array.isArray(evidence.pairs) && evidence.pairs.length && (evidence.compareB || evidence.entityB))
      return <ComparePanel evidence={evidence} onClose={onClose} onToggleMax={onToggleMax} maximized={maximized}/>;
    // MESA DE CONTROL · Sentrix EN OPERACIÓN (botón del header · no atada a una respuesta) — el modo "vivo mi negocio acá".
    if (evidence && evidence.lens === "mesa")
      return <MesaPanel evidence={evidence} onClose={onClose} onToggleMax={onToggleMax} maximized={maximized} onAsk={onAsk}/>;
    // P&L (deep-link · 2026-07-26): «Ampliar en Sentrix» de una lectura/tabla del P&L abre LA MESA en la cara
    // Resultado con el alcance de la respuesta (pnlMesaLink puro · el eje al selector del cuadro, la entidad a la
    // cascada). Antes caía al panel de criterio — el P&L vive en su cara.
    if (pnlMesaLink(evidence))
      return <MesaPanel evidence={evidence} onClose={onClose} onToggleMax={onToggleMax} maximized={maximized} onAsk={onAsk}/>;
    // TEMPORAL (mejora 7b · directiva del owner: "al ver en Sentrix esté todo como debe estar"): el mes a mes
    // ampliado abre LA MESA en la cara comercial — la película del año y el cuadro viven ahí (misma verdad que
    // la serie de la respuesta). Sin esto la evidencia temporal no matcheaba ningún panel (panel vacío).
    if (evidence && evidence.lens === "temporal")
      return <MesaPanel evidence={evidence} onClose={onClose} onToggleMax={onToggleMax} maximized={maximized} onAsk={onAsk}/>;
    // TU CRITERIO (C.2) · la memoria de criterio visible/borrable ("¿qué recordás?" · tras un set/forget).
    if (evidence && Array.isArray(evidence.criteriaList))
      return <CriteriaPanel evidence={evidence} onClose={onClose} onToggleMax={onToggleMax} maximized={maximized} onAsk={onAsk}/>;
    // INVENTARIO · capital inmovilizado por bodega/SKU = la evidencia del foco de inventario · antes del Cuadro.
    if (evidence && evidence.inventory && Array.isArray(evidence.inventory.bySku))
      return <InventoryPanel evidence={evidence} onClose={onClose} onToggleMax={onToggleMax} maximized={maximized} onAsk={onAsk}/>;
    // MARGEN · cada entidad vs la línea de benchmark (+ precio/costo) = la evidencia del foco de margen.
    if (evidence && evidence.margin && evidence.margin.panel && Array.isArray(evidence.margin.panel.rows) && evidence.margin.panel.rows.length)
      return <MarginPanel evidence={evidence} onClose={onClose} onToggleMax={onToggleMax} maximized={maximized} onAsk={onAsk}/>;
    // VENTAS · movers/decomp/mix/rank = la evidencia del foco de ventas.
    if (evidence && evidence.ventas && evidence.ventas.panel && (evidence.ventas.panel.kind === "decomp" || (Array.isArray(evidence.ventas.panel.rows) && evidence.ventas.panel.rows.length)))
      return <VentasPanel evidence={evidence} onClose={onClose} onToggleMax={onToggleMax} maximized={maximized} onAsk={onAsk}/>;
    // CONTRIBUCIÓN · pareto (80/20) / gap (no capturada) / rank = la evidencia del foco de contribución.
    if (evidence && evidence.contribucion && evidence.contribucion.panel && Array.isArray(evidence.contribucion.panel.rows) && evidence.contribucion.panel.rows.length)
      return <ContribucionPanel evidence={evidence} onClose={onClose} onToggleMax={onToggleMax} maximized={maximized} onAsk={onAsk}/>;
    if (ADI_SENTRIX_CUADRO_ENABLED && evidence && evidence.lens === "cuadro")
      return <CuadroOnlyPanel evidence={evidence} onClose={onClose} onToggleMax={onToggleMax} maximized={maximized}/>;
    return null;
  }

  const frames = stack.length ? stack : [mkBase(baseRd)];
  const current = frames[frames.length - 1];
  const atBase = frames.length === 1;
  const isBaseEntity = (fr) => fr.focusType === baseRd.focusType && fr.focus === baseRd.focus;
  const _contribFor = (ft) => (ft === "sku" ? buildSkuContribSignals : ft === "client" ? buildClientContribSignals : null);
  // reading DERIVADO del frame (determinístico): comparación · contribución · entidad base (motor) · SKU entrado (client-side).
  const frameReading = (fr) => {
    if (fr.compareWith) return buildComparisonReading(fr.focusType, fr.focus, fr.compareWith, evidence.periodo) || baseRd;
    if (fr.metric === "contribucion") { const mk = _contribFor(fr.focusType); const s = mk && mk(fr.focus, evidence.periodo); return (s && buildReadingFromSignals(s)) || baseRd; }
    if (isBaseEntity(fr)) return baseRd;
    if (fr.focusType === "sku") return buildReadingFromSignals(buildSkuMarginSignals(fr.focus)) || baseRd;
    return baseRd;
  };
  const frameLabel = (fr) => (fr.compareWith ? `${fr.focus} vs ${fr.compareWith}` : fr.metric === "contribucion" ? `${fr.focus} · contribución` : fr.focus);
  const rd = frameReading(current);
  // brick 2b · descomposición del margen → tesis data-derived + brecha (solo cliente, en base, con el shell)
  const decomp = (ADI_SENTRIX_SHELL_ENABLED && current.focusType === "client" && current.metric === "margen" && frames.length === 1 && !current.compareWith)
    ? buildMarginDecomposition(current.focus, evidence.periodo) : null;
  // EL MOTOR arma la superficie del Diagnóstico (qué gráficos + métrica/dims) según el foco · LLM-ready (surface.js).
  const charts = diagnosisCharts(current.focusType);
  // EVIDENCIA enriquecida · el recibo frío (fórmula+fuentes+confianza+límites) · cliente·margen O bodega·capital.
  const receipt = current.compareWith ? null
    : (current.focusType === "client" && decomp) ? buildMarginReceipt(current.focus, evidence.periodo)
    : (current.focusType === "bodega") ? buildCapitalReceipt(current.focus, evidence.periodo)
    : null;
  // CONTROL · la tabla-ring (foco vs promedio vs par instructivo vs mejor-en-clase) · cliente/bodega/sku/marca (B4) · null → placeholder.
  const ring = (["client", "bodega", "sku", "marca"].includes(current.focusType) && !current.compareWith)
    ? buildControlRing(current.focusType, current.focus, evidence.periodo) : null;
  // Control SOLO con ring real (foco individual) · o en dev (trabajo interno). En comparación (ring null) el tab NO aparece
  // en demo/prod → nunca se ve "Disponible pronto". effTab cae a Diagnóstico si Control no aplica (sin panel en blanco).
  const showControl = ADI_SENTRIX_SHELL_ENABLED && (!!ring || _isDev);
  const effTab = (tab === "control" && !showControl) ? "diagnostico" : tab;

  // operaciones del estado (empujan/actualizan frames)
  const _f = (s) => (s.length ? s : [mkBase(baseRd)]);
  const setMetric = (m) => setStack((s) => { const f = _f(s); const cur = f[f.length - 1]; return [...f.slice(0, -1), { ...cur, metric: m, compareWith: null }]; });
  const opCompare = (peer) => setStack((s) => { const f = _f(s); return [...f, { ...f[f.length - 1], compareWith: peer }]; });
  const opEnter = (entity, ft) => setStack((s) => [..._f(s), { focusType: ft, focus: entity, metric: "margen", compareWith: null }]);
  const back = () => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));

  const explorable = evidence.explorable;
  const curExplorable = explorable ? (isBaseEntity(current) && !current.compareWith && current.metric === "margen" ? explorable : entityExplorable(current.focusType, current.focus)) : null;
  const canCompare = !!(curExplorable && (current.focusType === "sku" || current.focusType === "client" || current.focusType === "bodega") && curExplorable.compare && curExplorable.compare.length);
  const metricOptions = (current.focusType === "sku" || current.focusType === "client") ? [{ key: "margen", label: "margen" }, { key: "contribucion", label: "contribución" }] : null;
  const pack = packFor(rd);
  const Hero = pack.Hero, Evidence = pack.Evidence;
  const domainLabel = (rd.metric || evidence.metrica || "").toString().toUpperCase();
  const dominio = (rd.domain || evidence.domain || "").toString().toUpperCase();

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", minHeight:0, background:"#000000", borderLeft:`1px solid ${C.border}`, position:"relative", overflow:"hidden" }}>
      {/* barrido de luz · reflejo premium que cruza el panel (izq→der · lento · elegante) */}
      <div className="sentrix-sweep"/>
      {/* ── header del panel ── */}
      <div style={{ flexShrink:0, padding:"14px 18px", borderBottom:`1px solid ${C.border}`, background:"linear-gradient(180deg, rgba(255,255,255,0.03), transparent)" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
          <div style={{ display:"flex", alignItems:"center", gap:7, fontFamily:MONO, fontSize:9.5, letterSpacing:"0.8px", color:C.textMuted, textTransform:"uppercase", minWidth:0 }}>
            <span style={{ color:C.text, fontWeight:600 }}>Sentrix</span>
            <span style={{ opacity:0.4 }}>›</span><span>{dominio}</span>
            <span style={{ opacity:0.4 }}>›</span><span>{domainLabel}</span>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:4, flexShrink:0 }}>
            <IconBtn onClick={onToggleMax} title={maximized ? "Restaurar" : "Agrandar"}>
              {maximized
                ? <><polyline points="9 14 4 14 4 9"/><polyline points="15 10 20 10 20 15"/></>
                : <><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/></>}
            </IconBtn>
            <IconBtn onClick={onClose} title="Cerrar"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></IconBtn>
          </div>
        </div>
        <div style={{ fontSize:13, color:C.text, fontWeight:500, lineHeight:1.45 }}>
          {decomp
            ? decomp.thesisFull
            : <><span style={{ color:C.textMuted }}>Demostrando: </span>{rd.reframe}</>}
        </div>
        {/* evidenceSpec (Nivel 1) · compartido por las 3/4 lentes de este panel (Diagnóstico/Evidencia/Control/
            Cuadro) — vive en el header común, no en una tab · null cuando no hay evidenceSpec (byte-exacto). */}
        <EvidenceClaimHeader evidenceSpec={evidence.evidenceSpec}/>
      </div>

      {/* SHELL · 3 tabs sobre el estado compartido (mismo caso, distinta lente) · gated · OFF = sin tabs (byte-exacto) */}
      {ADI_SENTRIX_SHELL_ENABLED && (
        <div style={{ flexShrink:0, display:"flex", gap:2, padding:"0 14px", borderBottom:`1px solid ${C.border}`, background:"#000000" }}>
          {[["diagnostico", "Diagnóstico"], ["evidencia", "Evidencia"], ...(showControl ? [["control", "Control"]] : []), ...(ADI_SENTRIX_CUADRO_ENABLED ? [["cuadro", "Cuadro de mando"]] : [])].map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)}
              style={{ padding:"9px 13px", background:"transparent", borderTop:"none", borderLeft:"none", borderRight:"none", borderBottom:`2px solid ${effTab === k ? C.text : "transparent"}`, color: effTab === k ? C.text : C.textMuted, fontSize:12.5, fontWeight: effTab === k ? 600 : 400, cursor:"pointer", fontFamily:"'DM Sans', system-ui, sans-serif", whiteSpace:"nowrap" }}>
              {label}
            </button>
          ))}
        </div>
      )}

      {/* ── cuerpo (scroll) · la lente activa · Diagnóstico = el contenido actual ── */}
      <div style={{ flex:1, overflowY:"auto", minHeight:0, padding:18, display:"flex", flexDirection:"column", gap:14 }}>
        {(!ADI_SENTRIX_SHELL_ENABLED || effTab === "diagnostico") && (<>

        <Card accent>
          <Eyebrow>{pack.title(rd)}</Eyebrow>
          <Hero rd={rd} decomp={decomp}/>
        </Card>

        {/* COMPARANDO · el gráfico de comparación (dumbbell) · el que faltaba cuando elegís una entidad */}
        {current.compareWith && current.focusType === "client" && (
          <ComparacionChart a={current.focus} b={current.compareWith} scenario={evidence.periodo}/>
        )}

        {decomp && <BrechaCard decomp={decomp}/>}
        {decomp && <BrechaFilm film={buildBrechaFilm(current.focus, evidence.periodo)}/>}

        {ADI_SENTRIX_SHELL_ENABLED && atBase && !current.compareWith && (
          <DataStrip focusType={current.focusType} focus={current.focus} scenario={evidence.periodo}/>
        )}

        {/* Evidencia mínima · con el SHELL se mueve a su tab (separar historia de prueba) · OFF = sigue acá (byte-exacto) */}
        {!ADI_SENTRIX_SHELL_ENABLED && Evidence && (
          <div>
            <Eyebrow tone={C.textMuted}>Evidencia mínima</Eyebrow>
            <Card><Evidence rd={rd}/></Card>
          </div>
        )}

        {rd.drivers && rd.drivers.length > 0 && (
          <div>
            <Eyebrow tone={C.textMuted}>Drivers de la lectura · lo que vuelve el dato criterio</Eyebrow>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              {rd.drivers.map((d, i) => (
                <div key={i} style={{ background:"rgba(255,255,255,0.018)", ...CARD_SIDES, borderRadius:8, padding:"11px 13px" }}>
                  <Num size="1.25em">{d.v}</Num>
                  <div style={{ fontSize:11, color:C.textMuted, lineHeight:1.4, marginTop:4 }}>{d.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {rd.recommendation && (
          <Card>
            <Eyebrow>Mi lectura</Eyebrow>
            <div style={{ fontSize:13, color:C.textSub, lineHeight:1.55 }}>{rd.recommendation}.</div>
            {rd.sensitive && rd.sensitive !== rd.focus && (
              <div style={{ marginTop:8, fontSize:11.5, color:C.textMuted }}>
                El caso más sensible: <span style={{ color:"#eef2f6", fontWeight:600 }}>{rd.sensitive}</span>
              </div>
            )}
          </Card>
        )}

        {/* navegación del estado de análisis (§4) · volver paso a paso · entrar a una entidad · explorar */}
        {!atBase && (
          <button onClick={back}
            style={{ alignSelf:"flex-start", display:"flex", alignItems:"center", gap:6, padding:"7px 12px", background:"transparent", border:`1px solid ${C.border}`, borderRadius:6, color:C.textSub, fontSize:12, cursor:"pointer", fontFamily:"'DM Sans', system-ui, sans-serif" }}>
            ← Volver a {frameLabel(frames[frames.length - 2])}
          </button>
        )}
        {current.compareWith && current.focusType === "sku" && (
          <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
            <span style={{ fontSize:12.5, color:C.textSub, flexShrink:0 }}>Entrar a</span>
            {[rd.a, rd.b].filter(Boolean).map((e) => (
              <button key={e.entity} onClick={() => opEnter(e.entity, "sku")}
                style={{ padding:"6px 12px", borderRadius:6, fontSize:12, cursor:"pointer", fontFamily:"'DM Sans', system-ui, sans-serif", background:"rgba(255,255,255,0.08)", border:`1px solid rgba(255,255,255,0.5)`, color:C.text }}>
                {e.entity} →
              </button>
            ))}
          </div>
        )}
        {!current.compareWith && curExplorable && (canCompare || (metricOptions && metricOptions.length > 1)) && (
          <ExplorarBar explorable={curExplorable} onCompare={opCompare}
            metricOptions={metricOptions} currentMetric={current.metric} onMetric={setMetric}/>
        )}
        {/* LA HISTORIA (paso 4) · evolutivo de margen REAL · el motor lo muestra SOLO donde hay histórico (comercial);
            en inventario (point-in-time) se oculta — no se inventa tendencia (honestidad) · solo en base */}
        {atBase && !current.compareWith && charts.evolution && (
          ADI_SENTRIX_TEMPORAL_ENABLED
            ? <EvolutivoCard/>
            : (current.metric === "margen" && <TemporalSlot evidence={evidence}/>)
        )}
        {/* EL PARETO (paso 4b) · concentración 80/20 · el motor pivotea métrica/dims según el foco (ventas ↔ capital
            inmovilizado) · solo en base · escenario del análisis vigente */}
        {atBase && !current.compareWith && ADI_SENTRIX_PARETO_ENABLED && (
          <ConcentracionCard key={charts.concentration.metric} scenario={evidence.periodo} spec={charts.concentration}/>
        )}
        </>)}

        {/* EVIDENCIA · la prueba que valida la respuesta · el RECIBO FRÍO (fórmula+fuentes+confianza+límites) para
            cliente·margen · el pack bespoke (SKU ranking / comparación) para el resto · separada de la historia */}
        {ADI_SENTRIX_SHELL_ENABLED && effTab === "evidencia" && (
          receipt
            ? <EvidenciaReciboConContexto receipt={receipt} scenario={evidence.periodo} onAsk={onAsk}/>
            : <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
                <div>
                  <Eyebrow>La cuenta de {rd.focus}</Eyebrow>
                  {Evidence
                    ? <Card><Evidence rd={rd}/></Card>
                    : <div style={{ fontSize:12.5, color:C.textMuted, lineHeight:1.6, padding:"4px 2px" }}>Sin cuenta detallada para esta lectura.</div>}
                </div>
                {/* evidenceSpec (Nivel 3, generalizado): confianza+límites para tipos SIN receipt (sku/marca/
                    familia) — antes este bloque solo existía para client/bodega (EvidenciaRecibo, ver su propio
                    comentario). SOLO si seguimos en la entidad BASE del turno sin comparar: navegado a otra fila,
                    el grado/missing de evidenceSpec describe la entidad central del turno, no la que se está
                    mirando ahora — mostrarlo ahí sería el mismo defecto de integridad que motiva esta ronda. */}
                {atBase && !current.compareWith && <EvidenceConfidenceFooter evidenceSpec={evidence.evidenceSpec}/>}
              </div>
        )}

        {ADI_SENTRIX_SHELL_ENABLED && effTab === "control" && (
          ring ? <ControlRingConContexto ring={ring} rd={rd} scenario={evidence.periodo} onAsk={onAsk}/> : <LensPlaceholder tab="control" focus={rd.focus}/>
        )}

        {ADI_SENTRIX_SHELL_ENABLED && ADI_SENTRIX_CUADRO_ENABLED && effTab === "cuadro" && (
          <CuadroMando scenario={evidence.periodo}/>
        )}
      </div>
    </div>
  );
}

/* ── DecisionPanel · NIVEL 2 NUEVO (owner 2026-07-31) ──────────────────────────────────────────────────────────
 * La ÚNICA pieza de UI genuinamente nueva de esta ronda: promueve mesa.accion (LA acción priorizada del diagnose —
 * el foco de mayor $ en juego, ya ordenado) a un panel propio, en vez de quedar enterrada como el movimiento
 * "03 · Qué hacer primero" dentro de MesaPanel cara comercial (ver ese componente, sección homónima — cero cálculo
 * nuevo, MISMA cuenta). Dispatch: evidenceSpec.claim.type==="decision" + evidenceSpec.action presente (mesa.accion
 * verbatim vía _actionFrom en sentrixEvidence.js). Todo lo que muestra ya viene AUTORIZADO en evidenceSpec — cero
 * recálculo, misma verdad que la respuesta de ADI de este turno. */
function DecisionPanel({ evidence, onClose, onToggleMax, maximized, onAsk = null }) {
  const espec = evidence.evidenceSpec;
  const action = espec.action || {};
  const factors = espec.factors || [];
  /* ── EMISIÓN DEL CONTEXTO · la decisión de vuelta (decisión 12) ────────────────────────────────────────────
   * Esta superficie NO se deriva de un builder de Sentrix: se deriva del `evidenceSpec` DE ESTE TURNO, que es lo
   * que la pantalla está pintando. Reconstruirla desde `buildMesaEstado` sería el mismo defecto de integridad que
   * ya se cazó en `_actionFrom`: describir la acción del PORTAFOLIO bajo el turno de una entidad puntual. El
   * sujeto sale del propio spec (`scope.entityLabel`), no de la UI. */
  useViewContext("comercial/03/decision-accion", espec, { scenario: evidence.periodo, onAsk, ambient: true });
  // $ crudo (subtotal_usd de un finding de diagnose, cuando `factors` trae ESE shape en vez del mesa.accion-shape
  // ya formateado) · mismo patrón que ControlRing/EvidenciaRecibo para bodega (raw USD, no $K).
  const moneyUSD = (v) => (Math.abs(v) >= 1e6 ? "$" + (v / 1e6).toFixed(1) + "M" : Math.abs(v) >= 1e3 ? "$" + (v / 1e3).toFixed(1) + "K" : "$" + Math.round(v));
  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", minHeight:0, background:"#000000", borderLeft:`1px solid ${C.border}`, position:"relative", overflow:"hidden" }}>
      <div className="sentrix-sweep"/>
      <div style={{ flexShrink:0, padding:"14px 18px", borderBottom:`1px solid ${C.border}`, background:"linear-gradient(180deg, rgba(255,255,255,0.03), transparent)" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
          <div style={{ display:"flex", alignItems:"center", gap:7, fontFamily:MONO, fontSize:9.5, letterSpacing:"0.8px", color:C.textMuted, textTransform:"uppercase", minWidth:0 }}>
            <span style={{ color:C.text, fontWeight:600 }}>Sentrix</span><span style={{ opacity:0.4 }}>›</span><span style={{ color:C.celeste }}>DECISIÓN</span>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:4, flexShrink:0 }}>
            <IconBtn onClick={onToggleMax} title={maximized ? "Restaurar" : "Agrandar"}>{maximized ? <><polyline points="9 14 4 14 4 9"/><polyline points="15 10 20 10 20 15"/></> : <><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/></>}</IconBtn>
            <IconBtn onClick={onClose} title="Cerrar"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></IconBtn>
          </div>
        </div>
        <div style={{ fontSize:13, color:C.text, fontWeight:500, lineHeight:1.45 }}>
          <span style={{ color:C.textMuted }}>Decisión · </span>la acción priorizada — el foco de mayor $ en juego este turno.
        </div>
        <EvidenceClaimHeader evidenceSpec={espec}/>
      </div>
      <div style={{ flex:1, overflowY:"auto", minHeight:0, padding:18, display:"flex", flexDirection:"column", gap:16 }}>
        <Card accent>
          <Eyebrow>La acción priorizada</Eyebrow>
          <div style={{ display:"flex", alignItems:"baseline", justifyContent:"space-between", gap:12, flexWrap:"wrap", marginBottom:10 }}>
            <span style={{ fontSize:16, color:C.text, fontWeight:600, lineHeight:1.4 }}>{action.text || "Sin acción priorizada este turno."}</span>
            {action.impact && <Num color={C.amber} size="1.5em">{action.impact}</Num>}
          </div>
          {factors.map((f, i) => {
            // dos shapes posibles en evidenceSpec.factors (_factorsFrom, sentrixEvidence.js): findings del diagnose
            // ({detector,titulo,subtotal_usd,items}) si el plan los trajo, o el mesa.accion-shape ({texto,usdFmt})
            // si no — ambos son la MISMA fuente (mesa.js), solo el shape cambia según qué trajo el plan.
            const body = f && f.texto
              ? f.texto
              : f && f.titulo
                ? `${f.titulo}${typeof f.subtotal_usd === "number" ? ` — ${moneyUSD(f.subtotal_usd)}` : ""}${Array.isArray(f.items) && f.items.length ? ` (${f.items.length} cuenta${f.items.length > 1 ? "s" : ""})` : ""}`
                : null;
            return body ? <div key={i} style={{ fontSize:12.5, color:C.textSub, lineHeight:1.55, marginTop: i > 0 ? 8 : 0 }}>{body}</div> : null;
          })}
          {action.askLabel && (
            <button onClick={onAsk ? () => onAsk(action.askLabel) : undefined} title={onAsk ? `Pregúntale a ADI: ${action.askLabel}` : undefined}
              style={{ marginTop:14, padding:"8px 15px", borderRadius:8, border:"1px solid rgba(47,184,218,0.5)", background:"rgba(47,184,218,0.08)", color:C.text, fontSize:12.5, fontWeight:600, cursor: onAsk ? "pointer" : "default", fontFamily:"'DM Sans', system-ui, sans-serif", transition:"background 0.15s" }}
              onMouseEnter={onAsk ? (e) => { e.currentTarget.style.background = "rgba(47,184,218,0.16)"; } : undefined}
              onMouseLeave={onAsk ? (e) => { e.currentTarget.style.background = "rgba(47,184,218,0.08)"; } : undefined}>
              {action.askLabel} <span style={{ color:C.celeste }}>→</span>
            </button>
          )}
        </Card>
        <EvidenceConfidenceFooter evidenceSpec={espec}/>
      </div>
    </div>
  );
}

// ── EVIDENCIA ENRIQUECIDA · el RECIBO FRÍO (brick 6) · "no me creas, acá está la cuenta" ──
// Fórmula venta−costo−carga=margen con cada cifra + su FUENTE (ERP), la base de comparación, la confianza y los
// LÍMITES honestos (lo que el dato NO afirma · derivados de capability). Todo del buildMarginReceipt (motor).
function CompChip({ label, base, gap, unit = "pp" }) {
  const up = gap >= 0;
  return (
    <div style={{ padding:"10px 13px", borderRadius:10, background:"rgba(255,255,255,0.022)", border:`1px solid ${C.border}` }}>
      <div style={{ fontSize:11, color:C.textMuted, marginBottom:6 }}>{label}</div>
      <div style={{ display:"flex", alignItems:"baseline", gap:8, flexWrap:"wrap" }}>
        <Num color={C.textSub}>{base}</Num>
        <Num color={up ? C.green : C.red}>{(up ? "+" : "") + (unit === "x" ? r1(gap) : p1(gap)) + unit}</Num>
      </div>
    </div>
  );
}
function EvidenciaRecibo({ receipt: r }) {
  const toneColor = { base: C.text, costo: C.red, carga: C.amber, margen: C.text };
  const pctColor  = { base: C.textMuted, costo: C.red, carga: C.amber, margen: C.textSub };
  // unidad de la plata: cliente en $K · bodega en $ (stockUSD) → mismo formateo por-tipo que el ring (no errar ×1000).
  const money = r.entityType === "bodega"
    ? (v) => (Math.abs(v) >= 1e6 ? "$" + (v / 1e6).toFixed(1) + "M" : Math.abs(v) >= 1000 ? "$" + (v / 1000).toFixed(1) + "K" : "$" + Math.round(v))
    : (v) => fMon(v);
  const formula = r.entityType === "bodega" ? "capital = sano + inmovilizado" : "venta − costo − carga = margen";
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      {/* LA CUENTA · fórmula con fuentes */}
      <Card>
        <Eyebrow>La cuenta · {formula}</Eyebrow>
        <div style={{ display:"flex", flexDirection:"column", marginTop:2 }}>
          {r.lines.map((l, i) => (
            <div key={i} style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:14,
              padding: l.strong ? "12px 0 2px" : "11px 0",
              borderTop: l.strong ? `1px solid ${C.borderLight}` : (i > 0 ? "1px solid rgba(255,255,255,0.035)" : "none"),
              marginTop: l.strong ? 5 : 0 }}>
              <div style={{ minWidth:0 }}>
                <div style={{ display:"flex", alignItems:"baseline", gap:8 }}>
                  <span style={{ fontFamily:MONO, fontSize:13, color:C.textMuted, width:9, flexShrink:0, opacity: l.sign ? 1 : 0 }}>{l.sign || "·"}</span>
                  <span style={{ fontSize:13.5, color: l.strong ? C.text : C.textSub, fontWeight: l.strong ? 600 : 500 }}>{l.label}</span>
                </div>
                <div style={{ fontFamily:MONO, fontSize:9.5, color:C.textMuted, letterSpacing:"0.4px", textTransform:"uppercase", marginLeft:17, marginTop:4 }}>{l.source}</div>
              </div>
              <div style={{ textAlign:"right", flexShrink:0 }}>
                <Num color={toneColor[l.tone]} size={l.strong ? "1.2em" : "0.98em"}>{money(l.usd)}</Num>
                <div style={{ fontFamily:MONO, fontSize:11, color:pctColor[l.tone], marginTop:4 }}>{p1(l.pct)}%</div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* BASE DE COMPARACIÓN · contra qué se mide (array genérico · cliente: prom/benchmark · bodega: inmov/rotación) */}
      {r.comparison && r.comparison.length > 0 && (
        <div>
          <Eyebrow>Contra qué se mide</Eyebrow>
          <div style={{ display:"grid", gridTemplateColumns: r.comparison.length > 1 ? "1fr 1fr" : "1fr", gap:9 }}>
            {r.comparison.map((c, i) => <CompChip key={i} label={c.label} base={c.base} gap={c.gap} unit={c.unit}/>)}
          </div>
        </div>
      )}

      {/* CONFIANZA · el sello verde (cuenta cerrada) */}
      <div style={{ display:"flex", alignItems:"flex-start", gap:10, padding:"12px 14px", borderRadius:10, background:"rgba(16,185,129,0.05)", border:"1px solid rgba(16,185,129,0.14)" }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" style={{ marginTop:2, flexShrink:0, filter:"drop-shadow(0 0 4px rgba(16,185,129,0.4))" }}>
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        <div style={{ fontSize:12.5, color:C.textSub, lineHeight:1.55 }}>
          <span style={{ color:C.green, fontWeight:600 }}>Confianza {r.confianza.level}</span> — {r.confianza.reason}.
        </div>
      </div>

      {/* LÍMITES HONESTOS · lo que esta cuenta NO afirma (data-driven de capability) */}
      {r.limites.length > 0 && (
        <div>
          <Eyebrow>Lo que esta cuenta NO afirma</Eyebrow>
          <div style={{ display:"flex", flexDirection:"column", gap:9 }}>
            {r.limites.map((t, i) => (
              <div key={i} style={{ display:"flex", gap:10, alignItems:"flex-start", fontSize:12.5, color:C.textSub, lineHeight:1.5 }}>
                <span style={{ color:C.textMuted, flexShrink:0, fontFamily:MONO }}>—</span>
                <span>{t}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── NIVEL 2 · EL CONTEXTO DE VUELTA (owner 2026-08-09, decisión 12) ───────────────────────────────────────────
 * Hasta acá el bucle se cerraba en un solo sentido: la Mesa le pasa contexto al chat en decenas de puntos, y el
 * panel que el chat ABRE cuando responde no devolvía ninguno. El usuario miraba el recibo o la tabla-ring, escribía
 * «y de esos, ¿cuál…?», y ADI resolvía ese «esos» contra la última cara de la Mesa — o contra nada.
 *
 * POR QUÉ UN ENVOLTORIO Y NO UN HOOK EN EL PANEL. `SentrixPanel` decide qué lente pintar DESPUÉS de varios returns
 * tempranos, así que un hook puesto ahí sería condicional (y el orden de hooks dejaría de ser estable al cambiar de
 * respuesta). Montado en un envoltorio, el ciclo de vida hace el trabajo solo: se monta con la lente → publica;
 * se cambia de pestaña, de foco o se cierra el panel → se DESMONTA y el hook borra el contexto. La limpieza al
 * cambiar de vista no es una convención que haya que recordar: es el desmontaje.
 *
 * LAS VISUALES NO CAMBIAN. El envoltorio renderiza exactamente el mismo componente con las mismas props. */
function ControlRingConContexto({ ring, rd, scenario, onAsk = null }) {
  const et = (ring && ring.entityType) || null;
  // el foco del ring ES la selección: una entidad, que es justo lo que la dirección canónica sabe transportar.
  const _o = { scenario, onAsk, seleccion: ring && ring.focus ? { modo: "explicita", n: 1, entidades: [ring.focus] } : null };
  // cuatro llamadas SIN condición (regla de hooks): la que corresponde al eje del ring recibe el dato, las otras
  // reciben null y no emiten nada. El eje decide cuál habla, no un if alrededor del hook.
  useViewContext("comercial/otro/control-ring", et === "client" ? ring : null, { ..._o, ambient: et === "client" });
  useViewContext("comercial/otro/control-ring-sku", et === "sku" ? ring : null, { ..._o, ambient: et === "sku" });
  useViewContext("comercial/otro/control-ring-marca", et === "marca" ? ring : null, { ..._o, ambient: et === "marca" });
  useViewContext("capital/otro/control-ring-bodega", et === "bodega" ? ring : null, { ..._o, ambient: et === "bodega" });
  return <ControlRing ring={ring} rd={rd}/>;
}
function EvidenciaReciboConContexto({ receipt, scenario, onAsk = null }) {
  const et = (receipt && receipt.entityType) || null;
  const _o = { scenario, onAsk, seleccion: receipt && receipt.focus ? { modo: "explicita", n: 1, entidades: [receipt.focus] } : null };
  useViewContext("comercial/otro/evidencia-recibo", et === "client" ? receipt : null, { ..._o, ambient: et === "client" });
  useViewContext("capital/otro/evidencia-recibo-bodega", et === "bodega" ? receipt : null, { ..._o, ambient: et === "bodega" });
  return <EvidenciaRecibo receipt={receipt}/>;
}

// "i" de ayuda inline (determinístico · lee el catálogo) · para headers de columna del ring · align encuadra el
// tooltip según la posición de la columna (centro / derecha=abre a la izquierda) para que no se salga en ninguna.
function InfoDot({ def, align = "center" }) {
  if (!def) return null;
  const cls = align === "left" ? "tip-l" : align === "right" ? "tip-r" : "tip-c";
  return <span className="adi-i2">i<span className={`adi-tip ${cls}`}>{def}</span></span>;
}

// ── CONTROL · la TABLA-RING (brick 7) · "el ring, nunca una fila sola" · foco vs promedio vs par vs mejor + caminos ──
function PathCard({ tag, tagColor, title, value, detail }) {
  return (
    <div style={{ padding:"12px 14px", borderRadius:10, background:"rgba(255,255,255,0.022)", border:`1px solid ${C.border}` }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:10, marginBottom:5 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, minWidth:0 }}>
          <span style={{ fontFamily:MONO, fontSize:8.5, letterSpacing:"0.6px", textTransform:"uppercase", color:tagColor, border:`1px solid ${tagColor}55`, borderRadius:4, padding:"2px 6px", flexShrink:0 }}>{tag}</span>
          <span style={{ fontSize:13, color:C.text, fontWeight:600, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{title}</span>
        </div>
        <Num color={C.green} size="1.05em">{value}</Num>
      </div>
      <div style={{ fontSize:11.5, color:C.textMuted, lineHeight:1.45 }}>{detail}</div>
    </div>
  );
}
function ControlRing({ ring, rd }) {
  // unidad de la plata: CLIENTE en $K (contribución en miles → fMon) · bodega/SKU/marca en $ raw (stockUSD/contribución
  // de skusMargen · magnitude-aware) → formateo distinto para no errar ×1000 (B4 · SKU y marca son raw $ como bodega).
  const money = ring.entityType === "client"
    ? (v) => (Math.abs(v) >= 1000 ? fMon(v) : fmtK(v))
    : (v) => (Math.abs(v) >= 1e6 ? "$" + (v / 1e6).toFixed(1) + "M" : Math.abs(v) >= 1000 ? "$" + (v / 1000).toFixed(1) + "K" : "$" + Math.round(v));
  const roleTag = { focus:{ t:"Foco", c:C.celeste }, peer:{ t:"Par", c:C.textMuted }, avg:{ t:"Promedio", c:C.textMuted }, best:{ t:"Mejor", c:C.green } };
  const cellVal = (r, col) => {
    if (col.key === "gap")   return r.role === "avg" ? "—" : (r.gap >= 0 ? "+" : "") + p1(r.gap) + "pp";
    if (col.fmt === "money") return money(r[col.key]);
    if (col.fmt === "x")     return r1(r[col.key]) + "x";
    return p1(r[col.key]) + "%";
  };
  const cellColor = (r, col) => {
    if (col.key === "gap")          return r.role === "avg" ? C.textMuted : (r.gap >= 0 ? C.green : C.red);
    if (col.key === "margen")       return r.role === "best" ? C.green : r.role === "focus" ? C.amber : C.textSub;
    if (col.key === "inmovilizado") return r.role === "focus" ? C.amber : C.textSub;   // la plata ATRAPADA · foco ámbar (alerta)
    if (col.fmt === "money")        return r.role === "focus" ? C.text : C.textSub;    // la plata · el foco en blanco
    if (col.key === "carga" && r.role === "focus" && ring.lever === "carga") return C.amber;
    return C.textSub;
  };
  const GRID = "1.5fr repeat(4, 1fr)";
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      {/* EL RING · foco anclado contra su liga */}
      <div>
        <Eyebrow>El ring · {ring.focus} contra su liga</Eyebrow>
        <Card>
          {/* bug ya reportado: la grilla (fr-based) se apretaba ilegible en el overlay móvil sin poder scrollear —
              mismo patrón overflowX:auto + minWidth que ya usa CuadroMando (ver su comentario "la grilla"). */}
          <div style={{ overflowX:"auto" }}>
          <div style={{ minWidth: 220 + ring.columns.length * 88 }}>
          <div style={{ display:"grid", gridTemplateColumns:GRID, gap:"0 8px", fontSize:9.5, color:C.textMuted, fontFamily:MONO, letterSpacing:"0.5px", textTransform:"uppercase", paddingBottom:8, borderBottom:`1px solid ${C.border}`, marginBottom:2 }}>
            <span/>{ring.columns.map((c, idx) => <span key={c.key} style={{ textAlign:"right", whiteSpace:"nowrap" }}>{c.label}{c.defKey && METRIC_DEFS[c.defKey] && <InfoDot def={METRIC_DEFS[c.defKey]} align={idx === 0 ? "left" : idx >= Math.ceil(ring.columns.length / 2) ? "right" : "center"}/>}</span>)}
          </div>
          {ring.rows.map((r, i) => {
            const tag = roleTag[r.role] || roleTag.peer, isFocus = r.role === "focus";
            return (
              <div key={i}>
                <div style={{ display:"grid", gridTemplateColumns:GRID, gap:"0 8px", alignItems:"center", padding:"9px 8px", borderRadius:7,
                  background: isFocus ? "rgba(47,184,218,0.06)" : "transparent", border: isFocus ? "1px solid rgba(47,184,218,0.18)" : "1px solid transparent", marginTop: i > 0 ? 2 : 4 }}>
                  <span style={{ minWidth:0, display:"flex", flexDirection:"column", gap:2 }}>
                    <span style={{ color: isFocus ? C.text : r.role === "best" ? "#eef2f6" : C.textSub, fontWeight: isFocus || r.role === "best" ? 600 : 500, fontSize:12.5, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{r.name}</span>
                    <span style={{ fontFamily:MONO, fontSize:8.5, letterSpacing:"0.5px", textTransform:"uppercase", color:tag.c }}>{tag.t}</span>
                  </span>
                  {ring.columns.map((col) => <span key={col.key} style={{ textAlign:"right" }}><Num color={cellColor(r, col)}>{cellVal(r, col)}</Num></span>)}
                </div>
                {r.note && <div style={{ fontSize:10.5, color:C.textMuted, fontStyle:"italic", padding:"1px 8px 3px 8px" }}>{r.note}</div>}
              </div>
            );
          })}
          </div>
          </div>
        </Card>
      </div>

      {/* ADI · ELEGÍ UN CAMINO · las palancas con $ honesto */}
      <div>
        <Eyebrow>ADI · elige un camino</Eyebrow>
        <div style={{ fontSize:12.5, color:C.textSub, lineHeight:1.5, marginBottom:10 }}>
          {ring.focus} {ring.framingVerb || "pierde por"} <span style={{ color:C.text, fontWeight:600 }}>{ring.leverLabel}</span>. Dos caminos, distinto esfuerzo:
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:9 }}>
          {ring.entityType === "bodega" ? (
            <>
              {ring.quickWinK > 0 && (
                <PathCard tag="Rápido" tagColor={C.green}
                  title="Liquidar el stock crítico"
                  value={`+${money(ring.quickWinK)}`}
                  detail="lo marcado crítico (120d+ / sin venta) · liberas ese capital ahora"/>
              )}
              {/* LA TRANSFERENCIA SE OFRECE SÓLO SI EL DATO LA SOSTIENE (owner 2026-08-09, decisión 13 · hallazgo M).
                  Esta tarjeta recomendaba "transferir / mover lo lento a donde se vende" mientras la cara Capital
                  declaraba, en su propia vista, que transferir entre bodegas NO se puede evaluar porque ningún SKU
                  está en más de una. Ni la condición NI EL TEXTO viven acá: los dos salen del motor
                  (`control.js` → `capability.transferenciaCapability`, la MISMA cuenta que produce esa limitación),
                  justamente para que "condicionar la tarjeta" no sea un ternario de copy que una edición futura
                  pueda deshacer sin que el dato cambie. El monto de la palanca no se toca — lo que se retira es la
                  mitad que el dato no sostiene. Si mañana un SKU aparece en dos bodegas, la tarjeta vuelve sola. */}
              {ring.estructuralK > 0 && ring.transferencia && (
                <PathCard tag="Estructural" tagColor={C.amber}
                  title={ring.transferencia.titulo}
                  value={`hasta +${money(ring.estructuralK)}`}
                  detail={ring.transferencia.detalle}/>
              )}
            </>
          ) : (
            <>
              {rd && rd.recoverableK != null && (
                <PathCard tag="Rápido" tagColor={C.green}
                  title="Renegociar la carga comercial"
                  value={`+${money(rd.recoverableK)}`}
                  detail={`al promedio interno${rd.recoverableBPK ? ` · +${money(rd.recoverableBPK)} a mejor práctica` : ""} · anual`}/>
              )}
              {ring.costoTechoK > 0 && (
                <PathCard tag="Estructural" tagColor={C.amber}
                  title={`Cerrar la brecha de ${ring.leverLabel}`}
                  value={`hasta +${money(ring.costoTechoK)}`}
                  detail="si el costo llegara al promedio interno · la medida de fondo, la más difícil (proveedores · mix · volumen)"/>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── CUADRO DE MANDO (4ª lente) · la GRILLA operable · cockpit: ver y manejar TODO el dato ──
// Dimensiones (clientes/SKU/marcas/bodegas) × columnas del catálogo · ordenar · top-N · en-alerta · seleccionar y
// comparar (filtra al resto) · fila promedio de referencia · acción derivada · alerta honesta. NO Power BI: premium.
// PASE 1 Cuadro 2.0 (regla de oro del owner: las columnas clásicas INTACTAS — la voz del asesor se SUMA encima):
// microlectura del detector bajo el nombre (PASE 1b: visible SOLO en el modo "En alerta") · columna "En juego $" ·
// la Acción como chip que pregunta a ADI · dot de movimiento 80/20. El gráfico COMPARADO vs año anterior vive en
// la FICHA (owner 2026-07-15: "no en la tabla" — grande y siempre visible al tocar una fila, FichaEvolutivo).
// RESUMEN COMERCIAL (owner 2026-08-07) · `resumen` baja la grilla a EVIDENCIA de la cara Comercial: conserva todo
// lo operable (selección para comparar, comparado multi-entidad, filtros, orden, buscador, watchlist) y saca lo que
// ahora pertenece a la Ficha — el 80/20 por eje (con sus bodegas), la evolución de UNA entidad y el perfil inline
// vs promedio. `onFicha` es el camino a la Ficha real del cliente (el MISMO que abre el deep-link del perfil).
function CuadroMando({ scenario, initialDim, initialSort, initialSel = null, mesa = false, resumen = false, onAsk = null, onFicha = null, watch = null, onWatch = null }) {
  const [dim, setDim] = useState(initialDim || "cliente");
  // PERFIL ÚNICO (owner 2026-08-06): initialSel llega del deep-link de clientMesaLink — la fila ya viene
  // seleccionada al abrir (la Ficha aparece de una), sin perder la selección manual normal del resto de casos.
  const [sel, setSel] = useState(initialSel || []);   // nombres seleccionados (resaltan · TODAS las filas quedan visibles)
  // memoria UI (owner 2026-07-08): la selección de la Mesa es contexto de ADI ("compará estos dos" la referencia)
  useEffect(() => { if (mesa) setUISignal({ mesaSel: sel, mesaDim: dim }); }, [mesa, sel, dim]);
  const [onlySel, setOnlySel] = useState(false);      // "solo seleccionados" → filtra al resto (el filtro del owner)
  const [mode, setMode] = useState("all");            // all | top | bottom | alert
  const [scope, setScope] = useState("global");       // global | fecha (honesto)
  // (el deep-link "verlas en el cuadro" murió con la tira legacy de alerta · owner 2026-08-07 — el filtro
  //  "En alerta" vive donde se opera: en la propia grilla, un click más abajo)
  const cm = buildCuadroMando(dim, scenario);
  const cols = cm.columns;
  const primary = cols.find((c) => c.key !== "accion") || cols[0];
  // si el overview trae una métrica que ES una columna (ej. "margen por cliente" → columna margen), abrimos ordenando por ahí.
  const [sortKey, setSortKey] = useState(initialSort && cols.some((c) => c.key === initialSort) ? initialSort : primary.key);
  const money = (v) => "$" + (v / 1000).toFixed(1) + "M";       // dato en $K → $M (columnas comerciales)
  const moneyk = (v) => "$" + (Math.abs(v) / 1000).toFixed(1) + "K";   // dato en $ → $K (inventario)
  const usd = (v) => { const a = Math.abs(v); return a >= 1e6 ? "$" + (a / 1e6).toFixed(1) + "M" : a >= 1e3 ? "$" + Math.round(a / 1e3) + "K" : "$" + Math.round(a); };   // $ crudo del detector (En juego $)
  const fmt = (col, v) => {
    if (v == null) return "—";
    if (col.fmt === "money")  return money(v);
    if (col.fmt === "moneyk") return moneyk(v);
    if (col.fmt === "usd")    return usd(v);
    if (col.fmt === "pct")    return p1(v) + "%";
    if (col.fmt === "x")      return r1(v) + "x";
    if (col.fmt === "int")    return Math.round(v).toLocaleString("es-CL");
    if (col.fmt === "pp")     return v === 0 ? "—" : (v > 0 ? "+" : "") + p1(v) + "pp";
    return v;
  };
  const cellColor = (col, r) => {
    if (col.key === "enJuego") return C.amber;   // el $ del detector = ámbar (vara/atención — mismo código de la Mesa)
    if (col.fmt === "pp")     return r._ref || r[col.key] === 0 ? C.textMuted : (r[col.key] >= 0 ? C.green : C.red);
    if (col.tone === "margen")return r._ref ? C.textSub : (r.gap >= 0 ? C.green : r.gap <= -3 ? C.red : C.amber);
    if (col.tone === "inmov") return r._ref ? C.textSub : (r.gap < 0 ? C.amber : C.textSub);
    if (col.fmt === "money" || col.fmt === "moneyk") return C.text;
    return C.textSub;
  };
  // BÚSQUEDA (owner 2026-07-10 · "datas con muchos más SKU/familias — todo debe sentirse ordenado"): filtra por
  // nombre, insensible a mayúsculas y tildes. Aparece cuando el eje tiene más filas de las que se leen de un golpe.
  const [busca, setBusca] = useState("");
  /* ── EMISIÓN DEL CONTEXTO · el Cuadro de vuelta (owner 2026-08-09, decisión 12) ────────────────────────────
   * UNA ENTRADA POR PESTAÑA, y no es burocracia: la columna «En juego $» cambia de UNIVERSO con la dimensión —en
   * clientes es margen no capturado y en SKU/marcas/bodegas es capital inmovilizado, dos magnitudes bajo la misma
   * etiqueta—, así que un solo componentId para las cuatro le diría a ADI que está mirando algo que no está
   * mirando. Con una entrada por pestaña el contexto emitido declara el universo real, y su `concordancia` dice
   * en qué no cierra. Las cuatro llamadas van SIN condición (regla de hooks): la de la pestaña activa recibe la
   * grilla, las otras reciben null y no emiten. Al cambiar de pestaña, la anterior se limpia sola. */
  const _oCM = {
    scenario, onAsk,
    controles: { dim, orden: sortKey, modo: mode, busca: busca.trim() || null, solosel: onlySel ? "1" : null },
    seleccion: sel.length ? { modo: "explicita", entidades: sel } : null,
  };
  useViewContext("comercial/otro/cuadro-mando", dim === "cliente" ? cm : null, { ..._oCM, ambient: dim === "cliente" });
  useViewContext("comercial/otro/cuadro-mando-sku", dim === "sku" ? cm : null, { ..._oCM, ambient: dim === "sku" });
  useViewContext("comercial/otro/cuadro-mando-marca", dim === "marca" ? cm : null, { ..._oCM, ambient: dim === "marca" });
  useViewContext("capital/otro/cuadro-mando-bodega", dim === "bodega" ? cm : null, { ..._oCM, ambient: dim === "bodega" });
  const _normB = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const sortCol = cols.find((c) => c.key === sortKey) || primary;
  let rows = cm.rows.slice().sort((a, b) => (sortCol.sort === "asc" ? -1 : 1) * ((b[sortKey] || 0) - (a[sortKey] || 0)));
  if (busca.trim()) rows = rows.filter((r) => _normB(r.name).includes(_normB(busca)));
  if (onlySel && sel.length) rows = rows.filter((r) => sel.includes(r.name));   // el filtro ES una acción aparte (no al seleccionar)
  else if (mode === "top") rows = rows.slice(0, 10);
  else if (mode === "bottom") rows = rows.slice(-10);
  else if (mode === "alert") rows = rows.filter((r) => r.alert);
  const toggleSel = (n) => setSel((s) => (s.includes(n) ? s.filter((x) => x !== n) : [...s, n]));
  const minWBase = 40 + cols.length * 66 + 120;
  const GRID = `20px 1.4fr ${cols.map(() => "1fr").join(" ")}`;
  const pill = (active, label, onClick, key) => (
    <button key={key} onClick={onClick} style={{ padding:"4px 10px", borderRadius:6, fontSize:11.5, cursor:"pointer", fontFamily:"'DM Sans', system-ui, sans-serif", whiteSpace:"nowrap",
      background: active ? "rgba(255,255,255,0.1)" : "transparent", border:`1px solid ${active ? "rgba(255,255,255,0.35)" : C.border}`, color: active ? C.text : C.textMuted }}>{label}</button>
  );
  const actionColor = (a) => (/revisar|renegociar|liquidar|acelerar|precio|mix|lento|investigar/.test(a) ? C.amber : /referencia/.test(a) ? C.green : C.textMuted);
  // ICONO DE ESTADO del margen (owner: el margen con icono, no color en el número · identifica rojo/ámbar/verde) ·
  // MESA 2.0 (owner 2026-07-14): el semáforo es contra TU VARA (benchmarkOf · criterio C.2 · misma brecha material
  // del detector — viene calculado del módulo cuadro.js, cero cálculo acá) · fallback vs-prom para filas sin vara.
  const statusOf = (r) => (r.vara ? { verde: "g", ambar: "a", rojo: "r" }[r.vara] : r.gap == null ? null : r.gap >= 0 ? "g" : r.gap <= -3 ? "r" : "a");
  const varaTitle = (r) => (r.varaGap == null ? undefined : `${Math.abs(r.varaGap)} pp ${r.varaGap >= 0 ? "sobre" : "bajo"} tu benchmark (${r.varaRef}%)${mesa && onAsk ? " · click y ADI lo abre" : ""}`);
  const statusCol = { g: C.green, a: C.amber, r: C.red };
  const MargenIcon = ({ st }) => (st ? (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke={statusCol[st]} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ filter:`drop-shadow(0 0 3px ${statusCol[st]}88)`, flexShrink:0 }}>
      {st === "g" ? <polyline points="3 8 6 4.5 9 8"/> : st === "r" ? <polyline points="3 4.5 6 8 9 4.5"/> : <line x1="3" y1="6" x2="9" y2="6"/>}
    </svg>
  ) : null);
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
      {/* PASE 1c/1d/1e · EL COMPARADO ARRIBA DE TODO (owner 2026-07-15): reacciona a la tabla — sin selección,
          EL NEGOCIO (la suma del eje: cierra con la fila Total); UNA fila, esa entidad vs su año anterior; DOS,
          las dos lado a lado. Sirve para cualquier eje con serie (clientes/SKU/marcas); bodega sin serie → sin
          gráfico (honesto). */}
      {(() => {
        const selRows = sel.map((nm) => cm.rows.find((r) => r.name === nm)).filter(Boolean);
        const aRow = selRows[0] || null;
        const bRow = selRows.length >= 2 ? selRows[1] : null;
        // RESUMEN COMERCIAL: la evolución de UNA entidad sale de la cara Comercial (owner 2026-08-07) — con una
        // sola fila seleccionada la tabla ofrece su Ficha en vez de dibujar acá su año contra el anterior. El
        // comparado del NEGOCIO (sin selección) y el MULTI-ENTIDAD (dos filas) se conservan: son alcance global
        // y comparación, no el perfil de una entidad.
        if (resumen && selRows.length === 1) {
          return (
            <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", fontSize:11.5, color:C.textMuted, lineHeight:1.5, padding:"9px 12px", border:`1px dashed ${C.border}`, borderRadius:10 }}>
              <span><b style={{ color:C.text }}>{aRow.name}</b> seleccionado. Su evolución, composición y brecha viven en la Ficha; selecciona una segunda fila para compararlas acá.</span>
              {onFicha && dim === "cliente" ? (
                <button onClick={() => onFicha(aRow.name)} title={`Abrir la Ficha de ${aRow.name}`}
                  style={{ marginLeft:"auto", padding:"4px 11px", borderRadius:7, border:"1px solid rgba(47,184,218,0.5)", background:"rgba(47,184,218,0.08)", color:C.text, fontSize:11, fontWeight:600, cursor:"pointer", fontFamily:"'DM Sans', system-ui, sans-serif", whiteSpace:"nowrap" }}>
                  Ver Ficha de {aRow.name} <span style={{ color:C.celeste }}>→</span>
                </button>
              ) : null}
            </div>
          );
        }
        return <ComparadoCard negocio={!aRow} dim={dim} a={aRow ? aRow.name : null} rowA={aRow} b={bRow ? bRow.name : null} rowB={bRow} onAsk={mesa ? onAsk : null}/>;
      })()}
      {/* PASE 1d · el 80/20 DEBAJO del comparado — mismo comportamiento: eje + selección. En la cara Comercial el
          80/20 ES el bloque de concentración de arriba (clientes, alcance global), así que el Pareto por eje —con
          sus bodegas— no se repite acá (owner 2026-08-07). */}
      {mesa && !resumen && <MesaPareto dim={dim} scenario={scenario} sel={sel.length === 1 ? sel[0] : null} onAsk={onAsk}/>}
      {/* PASE 1e (owner): los FILTROS pertenecen a la TABLA — viven pegados a ella, debajo de los gráficos.
          Los gráficos igual los siguen (eje + selección): sin filas seleccionadas muestran el negocio. */}
      {/* dimensión + alcance */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:8 }}>
        <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
          {/* RESUMEN COMERCIAL: las BODEGAS salen de la cara Comercial (owner 2026-08-07) — su grilla es de
              capital (stock, inmovilizado, rotación), no de comercio, y vive completa en la cara Capital. Los
              tres ejes comerciales quedan intactos con todos sus filtros. */}
          {(resumen ? CUADRO_DIMS.filter((d) => d.key !== "bodega") : CUADRO_DIMS).map((d) => pill(dim === d.key, d.label, () => { setDim(d.key); setSel([]); setSortKey(primary.key); }, d.key))}
        </div>
        <div style={{ display:"flex", gap:5 }}>
          {pill(scope === "global", "Global", () => setScope("global"), "g")}
          {_isDev && pill(scope === "fecha", "Por fecha", () => setScope("fecha"), "f")}
        </div>
      </div>
      {_isDev && scope === "fecha" && (
        <div style={{ fontSize:11, color:C.amber, opacity:0.85, lineHeight:1.4 }}>
          <span style={{ fontFamily:MONO, fontSize:8.5, letterSpacing:"0.6px", border:`1px solid ${C.amber}55`, borderRadius:4, padding:"1px 6px", marginRight:6 }}>EJEMPLO</span>
          El corte por fecha por entidad se enciende con el histórico del ERP · hoy el dato es del período <b>{scenario}</b>.
        </div>
      )}
      {/* filtros rápidos · seleccionar RESALTA (todas visibles) · "solo seleccionados" filtra */}
      <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
        <span style={{ fontSize:11, color:C.textMuted }}>Ver</span>
        {pill(mode === "all" && !onlySel, "Todos", () => { setMode("all"); setOnlySel(false); }, "all")}
        {pill(mode === "top" && !onlySel, "Top 10", () => { setMode("top"); setOnlySel(false); }, "top")}
        {pill(mode === "bottom" && !onlySel, "Peores 10", () => { setMode("bottom"); setOnlySel(false); }, "bot")}
        {pill(mode === "alert" && !onlySel, "En alerta", () => { setMode("alert"); setOnlySel(false); }, "al")}
        {cm.rows.length > 12 && (
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={`buscar ${cm.plural}…`}
            style={{ padding:"4px 10px", borderRadius:6, border:`1px solid ${busca ? "rgba(47,184,218,0.5)" : C.border}`, background:"transparent", color:C.text, fontSize:11.5, fontFamily:"'DM Sans', system-ui, sans-serif", outline:"none", width:130 }}/>
        )}
        {sel.length > 0 && (
          <span style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:6, fontSize:11.5, color:C.celeste }}>
            {sel.length} seleccionado{sel.length > 1 ? "s" : ""}
            {pill(onlySel, "Solo seleccionados", () => setOnlySel((v) => !v), "only")}
            <button onClick={() => { setSel([]); setOnlySel(false); }} style={{ padding:"3px 8px", borderRadius:5, fontSize:11, cursor:"pointer", background:"transparent", border:`1px solid ${C.border}`, color:C.textSub, fontFamily:"'DM Sans', system-ui, sans-serif" }}>limpiar</button>
          </span>
        )}
      </div>
      {/* la grilla */}
      <div style={{ overflowX:"auto" }}>
        <div style={{ minWidth: minWBase }}>
          {/* header */}
          <div style={{ display:"grid", gridTemplateColumns:GRID, gap:"0 8px", alignItems:"center", fontSize:9, color:C.textMuted, fontFamily:MONO, letterSpacing:"0.4px", textTransform:"uppercase", padding:"0 8px 7px", borderBottom:`1px solid ${C.border}` }}>
            <span/><span>{cm.label}</span>
            {cols.map((c) => (
              <span key={c.key} onClick={() => c.key !== "accion" && setSortKey(c.key)} style={{ textAlign: c.key === "accion" ? "left" : "right", cursor: c.key === "accion" ? "default" : "pointer", color: sortKey === c.key ? C.text : C.textMuted, whiteSpace:"nowrap" }}>
                {c.label}{sortKey === c.key ? " ↓" : ""}{c.defKey && METRIC_DEFS[c.defKey] ? <InfoDot def={METRIC_DEFS[c.defKey]} align="right"/> : null}
              </span>
            ))}
          </div>
          {/* filas */}
          {rows.map((r, i) => {
            const on = sel.includes(r.name);
            return (
              <div key={r.name} onClick={() => toggleSel(r.name)} style={{ display:"grid", gridTemplateColumns:GRID, gap:"0 8px", alignItems:"center", padding:"8px", borderRadius:6, cursor:"pointer",
                background: on ? "rgba(47,184,218,0.08)" : "transparent", border:`1px solid ${on ? "rgba(47,184,218,0.25)" : "transparent"}`, borderBottom:`1px solid ${on ? "rgba(47,184,218,0.25)" : "rgba(255,255,255,0.03)"}` }}>
                <span style={{ display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <span style={{ width:13, height:13, borderRadius:3, border:`1px solid ${on ? C.celeste : "rgba(255,255,255,0.25)"}`, background: on ? C.celeste : "transparent", display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, color:"#000" }}>{on ? "✓" : ""}</span>
                </span>
                <span style={{ display:"flex", alignItems:"center", gap:7, minWidth:0 }}>
                  {r.alert && <span style={{ width:6, height:6, borderRadius:"50%", background:C.red, flexShrink:0 }}/>}
                  {/* WATCHLIST (PASE 2) · la estrella sigue esta fila en "Lo que yo sigo" de la Mesa (solo informa — no dispara) */}
                  {mesa && onWatch ? (() => { const onW = (watch || []).some((w) => w.dim === dim && w.name === r.name); return (
                    <span onClick={(e) => { e.stopPropagation(); onWatch(dim, r.name); }}
                      title={onW ? "Dejar de seguir" : 'Seguir en "Lo que yo sigo"'}
                      style={{ color: onW ? C.celeste : "rgba(255,255,255,0.22)", fontSize:11, lineHeight:1, flexShrink:0, cursor:"pointer", transition:"color 0.15s" }}
                      onMouseEnter={(e) => { if (!onW) e.currentTarget.style.color = "rgba(47,184,218,0.7)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = onW ? C.celeste : "rgba(255,255,255,0.22)"; }}>{onW ? "★" : "☆"}</span>
                  ); })() : null}
                  <span style={{ color:"#eef2f6", fontWeight:600, fontSize:12.5, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{r.name}</span>
                  {/* PASE 1 · dot de MOVIMIENTO 80/20 (solo informa — conecta con "Qué cambió" de la Mesa) */}
                  {r.mov && <span title={r.mov === "entra" ? "Entró al bloque 80/20 de la venta (vs año anterior)" : "Salió del bloque 80/20 de la venta (vs año anterior)"}
                    style={{ width:5, height:5, borderRadius:"50%", background: r.mov === "entra" ? C.celeste : C.amber, flexShrink:0, opacity:0.9 }}/>}
                  {mesa && onAsk ? (
                    <button onClick={(e) => { e.stopPropagation(); onAsk(`Profundiza en ${r.name}`); }} title={`Pregúntale a ADI: Profundiza en ${r.name}`}
                      style={{ padding:"1px 7px", borderRadius:5, border:`1px solid ${C.border}`, background:"transparent", color:C.textMuted, fontSize:8.5, fontFamily:MONO, letterSpacing:"0.5px", cursor:"pointer", flexShrink:0, transition:"all 0.15s" }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = C.celeste; e.currentTarget.style.borderColor = "rgba(47,184,218,0.45)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = C.textMuted; e.currentTarget.style.borderColor = C.border; }}>ADI</button>
                  ) : null}
                  {/* VER FICHA por fila (owner 2026-08-07): seleccionar = comparar dentro de Comercial · "Ver Ficha"
                      = profundizar. Navega, nunca dispara a ADI. Solo en el eje cliente: la Ficha Ejecutiva es de
                      cliente y prometer una que no existe sería peor que no ofrecerla. */}
                  {onFicha && dim === "cliente" ? (
                    <button onClick={(e) => { e.stopPropagation(); onFicha(r.name); }} title={`Abrir la Ficha de ${r.name}`}
                      style={{ padding:"1px 7px", borderRadius:5, border:"1px solid rgba(47,184,218,0.3)", background:"transparent", color:C.celeste, fontSize:8.5, fontFamily:MONO, letterSpacing:"0.5px", cursor:"pointer", flexShrink:0, transition:"all 0.15s" }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(47,184,218,0.1)"; e.currentTarget.style.borderColor = "rgba(47,184,218,0.6)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "rgba(47,184,218,0.3)"; }}>VER FICHA</button>
                  ) : null}
                </span>
                {cols.map((c) => c.key === "accion" ? (
                  // PASE 1 · la Acción como CHIP: click = la pregunta del detector a ADI (anti-BI: pregunta, nunca dispara)
                  mesa && onAsk && r.accionAsk ? (
                    <span key={c.key}>
                      <button onClick={(e) => { e.stopPropagation(); onAsk(r.accionAsk); }} title={`Pregúntale a ADI: ${r.accionAsk}`}
                        style={{ padding:"2px 8px", borderRadius:5, border:`1px solid ${C.border}`, background:"transparent", color:actionColor(r.accion), fontSize:10.5, cursor:"pointer", fontFamily:"'DM Sans', system-ui, sans-serif", whiteSpace:"nowrap", transition:"all 0.15s" }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(47,184,218,0.5)"; e.currentTarget.style.background = "rgba(47,184,218,0.06)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = "transparent"; }}>{r.accion}</button>
                    </span>
                  ) : (
                    <span key={c.key} style={{ fontSize:11, color:actionColor(r.accion), whiteSpace:"nowrap" }}>{r.accion}</span>
                  )
                ) : c.key === "margen" ? (
                  // estado contra el benchmark: tooltip "X pp bajo tu benchmark" + click = pregunta a ADI por esa cuenta (Mesa 2.0)
                  <span key={c.key} title={varaTitle(r)}
                    onClick={mesa && onAsk && r.varaGap != null ? (e) => { e.stopPropagation(); onAsk(r.varaGap < 0 ? `¿Por qué ${r.name} cede margen?` : `Profundiza en ${r.name}`); } : undefined}
                    style={{ display:"flex", alignItems:"center", justifyContent:"flex-end", gap:6, ...(mesa && onAsk && r.varaGap != null ? { cursor:"pointer" } : {}) }}>
                    <MargenIcon st={statusOf(r)}/><Num color={C.text}>{fmt(c, r[c.key])}</Num>
                  </span>
                ) : (
                  <span key={c.key} style={{ textAlign:"right" }}><Num color={cellColor(c, r)}>{fmt(c, r[c.key])}</Num></span>
                ))}
                {/* PASE 1 · MICROLECTURA: la historia del detector bajo el nombre — SOLO cuando el detector afirma
                    algo de esta fila (honesta: sin señal no hay línea) · PASE 1b (owner 2026-07-15: "se debería
                    activar solo cuando el cliente hace click en alerta — así le das sentido al botón alerta"):
                    visible únicamente en el modo "En alerta"; en Todos/Top/Peores la tabla queda limpia. */}
                {mode === "alert" && !onlySel && r.lectura && (
                  <span style={{ gridColumn:"2 / -1", fontSize:10.5, color:C.textMuted, lineHeight:1.4, paddingTop:2, minWidth:0 }}>{r.lectura}</span>
                )}
              </div>
            );
          })}
          {/* fila TOTALES · el resumen operativo (sumas · margen ponderado) */}
          {!onlySel && cm.total && (
            <div style={{ display:"grid", gridTemplateColumns:GRID, gap:"0 8px", alignItems:"center", padding:"10px 8px", marginTop:4, borderTop:`1px solid ${C.borderLight}`, background:"rgba(255,255,255,0.02)" }}>
              <span/><span style={{ fontFamily:MONO, fontSize:9, fontWeight:600, letterSpacing:"0.6px", textTransform:"uppercase", color:C.text }}>Total</span>
              {cols.map((c) => c.key === "accion" ? <span key={c.key}/> : (
                <span key={c.key} style={{ textAlign:"right" }}><Num color={c.key === "enJuego" ? C.amber : c.key === "margen" ? C.text : c.fmt === "pp" ? C.textMuted : C.text}>{cm.total[c.key] == null ? "—" : fmt(c, cm.total[c.key])}</Num></span>
              ))}
            </div>
          )}
          {/* nota de referencia: el promedio (la ley de las lentes) queda en el pie */}
          {!onlySel && cm.avg && (
            <div style={{ fontSize:10.5, color:C.textMuted, padding:"6px 8px 0", fontFamily:MONO }}>
              Promedio {cm.label.toLowerCase()}: margen {p1(cm.avg.margen)}%{cm.avg.inmovPct != null ? ` · inmov ${p1(cm.avg.inmovPct)}%` : ""}
            </div>
          )}
        </div>
      </div>
      {/* al seleccionar UNA fila → la FICHA (perfil vs promedio). PASE 1f (owner): el "Perfil comparado" por ejes
          se ELIMINÓ — con DOS seleccionadas la comparación es el comparado temporal de ARRIBA (dual); en la lente
          Control (sin Mesa) sigue el dumbbell original de clientes. */}
      {/* RESUMEN COMERCIAL (owner 2026-08-07): el bloque inline "perfil vs promedio" SALE de la cara Comercial —
          esa historia vive completa en la Ficha, a la que llevan el "Ver Ficha" de cada fila y el aviso de arriba.
          El resto de las lentes lo conservan intacto. */}
      {sel.length === 1 && mesa && !resumen && (
        <MesaFicha name={sel[0]} row={cm.rows.find((r) => r.name === sel[0])} columns={cm.columns} allRows={cm.rows} dim={dim} dimLabel={cm.label} onAsk={onAsk}/>
      )}
      {sel.length === 2 && !mesa && dim === "cliente" ? <ComparacionChart a={sel[0]} b={sel[1]} scenario={scenario}/> : null}
      <div style={{ fontSize:11, color:C.textMuted, lineHeight:1.5 }}>
        Toca una fila para seleccionar{resumen ? " y comparar (2 → el comparado de arriba las muestra lado a lado) · \"Ver Ficha\" abre su Ficha Ejecutiva" : mesa ? " (1 → su perfil vs promedio · 2 → el comparado de arriba las muestra lado a lado)" : dim === "cliente" ? " y comparar (2 → gráfico)" : " y comparar"} · ordena por cualquier columna{cols.some((c) => c.key === "margen") ? <> · el chevron del margen marca tu benchmark (verde en línea · ámbar cerca · rojo {POLICY.margenBrechaMaterial}+ pp bajo{mesa && onAsk ? " · click = preguntarle a ADI" : ""})</> : null} · el "En juego $" es la lectura del detector (solo cuando hay señal) · en <span style={{ color:C.textSub }}>En alerta</span> cada fila trae su microlectura · el comparado de arriba sigue tu selección (sin selección = tu negocio · una fila = vs año anterior · dos = lado a lado){mesa && onAsk ? <> · la Acción es un chip: tocalo y ADI te dice cómo ejecutarla · el botón <span style={{ fontFamily:MONO, fontSize:9.5, color:C.textSub }}>ADI</span> le pregunta por esa fila</> : null}{mesa && onWatch ? <> · la ★ la sigue en "Lo que yo sigo"</> : null} · <span style={{ color:C.textSub }}>{cm.n} {cm.plural}</span> · escenario {scenario}.
      </div>
    </div>
  );
}

// ── placeholder honesto de las lentes aún no construidas (Evidencia / Control) · próximos bricks ──
function LensPlaceholder({ tab, focus }) {
  const map = {
    evidencia: { t: "Evidencia", d: `La cuenta exacta de ${focus || "esta lectura"} — cada cifra con su fuente, la confianza y los límites.` },
    control: { t: "Control", d: `La mesa operable — ${focus || "el foco"} contra el promedio y el modelo, con columnas y acciones.` },
  };
  const m = map[tab] || { t: tab, d: "" };
  return (
    <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:9, textAlign:"center", padding:24, minHeight:200 }}>
      <div style={{ fontFamily:MONO, fontSize:10.5, letterSpacing:"1.2px", color:C.text, textTransform:"uppercase" }}>{m.t}</div>
      <div style={{ fontSize:12.5, color:C.textSub, lineHeight:1.55, maxWidth:300 }}>{m.d}</div>
      <div style={{ fontSize:11, color:C.textMuted, opacity:0.8 }}>Disponible pronto.</div>
    </div>
  );
}

// ── TIRA DE DATOS · todo el dato poderoso de la entidad, a la mano (anticipa la pregunta) · brick 2a ──
function DataStrip({ focusType, focus, scenario }) {
  const kpis = buildEntityKPIs(focusType, focus, scenario);
  if (!kpis.length) return null;
  const valColor = (t) => (t === "down" ? C.red : t === "warn" ? C.amber : C.text);
  const subColor = (t) => (t === "up" ? C.green : t === "down" ? C.red : C.textMuted);
  return (
    <div>
      <Eyebrow tone={C.textMuted}>Todo el dato · a la mano</Eyebrow>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:9 }}>
        {kpis.map((k, i) => { const def = METRIC_DEFS[k.label]; return (
          <div key={i} style={{ position:"relative", background:"rgba(255,255,255,0.022)", ...CARD_SIDES, borderRadius:9, padding:"10px 12px" }}>
            {def && <span className="adi-i">i<span className="adi-tip">{def}</span></span>}
            <div style={{ fontSize:10.5, color:C.textMuted, marginBottom:4, paddingRight:14 }}>{k.label}</div>
            <Num color={valColor(k.tone)} size="1.05em">{k.value}</Num>
            {k.sub && <div style={{ fontSize:10, color:subColor(k.tone), marginTop:2 }}>{k.sub}</div>}
          </div>
        ); })}
      </div>
    </div>
  );
}

// ── LA BRECHA DESCOMPUESTA · el gap del margen partido en sus palancas (costo vs carga) · brick 2b ──
// La tesis la elige el DATO: la palanca dominante. La cuenta cierra (costoComp + cargaComp = gap).
function BrechaCard({ decomp }) {
  const d = decomp;
  const fp = (n) => (n >= 0 ? "+" : "−") + p1(Math.abs(n)) + "pp";
  const rows = [
    { label: "Estructura de costo", comp: d.costoComp, share: d.costoShare, color: C.red },
    { label: "Carga comercial",     comp: d.cargaComp, share: d.cargaShare, color: C.amber },
  ];
  return (
    <Card>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
        <Eyebrow def={METRIC_DEFS["La brecha descompuesta"]}>La brecha, descompuesta</Eyebrow>
        <span style={{ fontSize:11, color:C.textMuted, fontFamily:MONO }}>vs promedio {p1(d.avgM)}%</span>
      </div>
      {rows.map((r, i) => (
        <div key={i} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
          <div style={{ width:128, fontSize:12, color:C.textSub, flexShrink:0 }}>{r.label}</div>
          <div style={{ flex:1, height:13, background:"rgba(255,255,255,0.04)", borderRadius:3, overflow:"hidden" }}>
            <div style={{ width:`${Math.max(r.share, 2)}%`, height:"100%", background:r.color, borderRadius:3, transition:"width 0.4s ease" }}/>
          </div>
          <div style={{ width:92, textAlign:"right", fontFamily:MONO, fontSize:12, color:r.color, flexShrink:0 }}>{fp(r.comp)} · {p1(r.share)}%</div>
        </div>
      ))}
      <div style={{ fontSize:11.5, color:C.textMuted, lineHeight:1.5, marginTop:8 }}>
        El gap de <Num color={d.gap < 0 ? C.red : C.green}>{fp(d.gap)}</Num> lo explica <span style={{ color:C.textSub }}>{d.dominant === "costo" ? "la estructura de costo" : "la carga comercial"}</span> ({p1(d.dominant === "costo" ? d.costoShare : d.cargaShare)}%) — la tesis la elige el dato, no un molde.
      </div>
    </Card>
  );
}

// ── LA BRECHA EN EL TIEMPO · clic-para-sumar-curvas (2c) · VISTA DE EJEMPLO honesta ──
// NO hay histórico mes a mes por entidad (sintético) → esto es ILUSTRATIVO, rotulado sin ambigüedad (badge + copy +
// curvas PUNTEADAS). El "hoy" (último punto) es el dato REAL. Sumás Costo/Carga y ves la palanca dominante trepar
// mientras el margen se erosiona → la tesis, en el tiempo. El ERP lo enciende con la serie real.
function BrechaFilm({ film }) {
  const [show, setShow] = useState({ costo: false, carga: false });
  const [hov, setHov] = useState(null);                                   // mes bajo el cursor (tooltip · igual que el evolutivo)
  if (!film) return null;
  const W = 520, H = 156, padL = 30, padR = 14, padT = 12, padB = 22;
  const series = [   // PALETA BASE de gráficos (owner): eléctrico / turquesa / lavanda
    { key: "margen", label: "Margen", color: C.elec, data: film.margen, on: true },
    { key: "costo",  label: "Costo",  color: C.teal, data: film.costo,  on: show.costo },
    { key: "carga",  label: "Carga",  color: C.lav,  data: film.carga,  on: show.carga },
  ];
  const shown = series.filter((s) => s.on);
  const vals = shown.flatMap((s) => s.data);
  const lo = Math.min(...vals) - 2, hi = Math.max(...vals) + 2;           // rango AJUSTADO → el drift se ve
  const n = film.meses.length, stepX = (W - padL - padR) / (n - 1);
  const xAt = (i) => padL + i * stepX;
  const yAt = (v) => padT + (1 - (v - lo) / (hi - lo || 1)) * (H - padT - padB);
  // curva SUAVE (Catmull-Rom → bézier) · premium, no-Excel
  const smooth = (data) => {
    const p = data.map((v, i) => [xAt(i), yAt(v)]);
    let d = `M${p[0][0].toFixed(1)},${p[0][1].toFixed(1)}`;
    for (let i = 0; i < p.length - 1; i++) {
      const p0 = p[i - 1] || p[i], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2] || p2;
      const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
      const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
      d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
    }
    return d;
  };
  const chip = (label, active, color, onClick) => (
    <button onClick={onClick} style={{ display:"flex", alignItems:"center", gap:5, padding:"3px 9px", borderRadius:5, cursor: onClick ? "pointer" : "default", fontSize:10.5, fontFamily:"'DM Sans', system-ui, sans-serif",
      background: active ? "rgba(255,255,255,0.06)" : "transparent", border:`1px solid ${active ? color + "88" : C.border}`, color: active ? C.text : C.textMuted }}>
      <span style={{ width:8, height:8, borderRadius:2, background: active ? color : "transparent", border:`1px solid ${color}` }}/>{label}
    </button>
  );
  const TW = 100, TH = 18 + shown.length * 13;
  return (
    <Card>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:8, marginBottom:8 }}>
        <Eyebrow def={METRIC_DEFS["La brecha en el tiempo"]}>La brecha en el tiempo</Eyebrow>
        <span style={{ fontFamily:MONO, fontSize:8.5, letterSpacing:"0.9px", textTransform:"uppercase", color:C.amber, border:`1px solid ${C.amber}55`, borderRadius:4, padding:"2px 7px" }}>Vista de ejemplo</span>
      </div>
      <div style={{ display:"flex", gap:6, marginBottom:6 }}>
        {chip("Margen", true, C.elec, null)}
        {chip("Costo", show.costo, C.teal, () => setShow((s) => ({ ...s, costo: !s.costo })))}
        {chip("Carga", show.carga, C.lav, () => setShow((s) => ({ ...s, carga: !s.carga })))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width:"100%", height:"auto", display:"block" }} onMouseLeave={() => setHov(null)}>
        <defs>
          <linearGradient id="filmArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3d74f5" stopOpacity="0.16"/>
            <stop offset="100%" stopColor="#3d74f5" stopOpacity="0"/>
          </linearGradient>
        </defs>
        {[hi, (hi + lo) / 2, lo].map((p, k) => (
          <g key={k}>
            <line x1={padL} y1={yAt(p)} x2={W - padR} y2={yAt(p)} stroke={C.border} strokeWidth="1" strokeDasharray="3 4"/>
            <text x={padL - 5} y={yAt(p) + 3} fill={C.textMuted} fontSize="8" fontFamily={MONO} textAnchor="end">{p1(p)}%</text>
          </g>
        ))}
        {/* área bajo el margen (el foco) · sutil */}
        <path d={`${smooth(film.margen)} L${xAt(n - 1).toFixed(1)},${(H - padB).toFixed(1)} L${xAt(0).toFixed(1)},${(H - padB).toFixed(1)} Z`} fill="url(#filmArea)" stroke="none"/>
        {/* curvas suaves con glow */}
        {shown.map((s) => (
          <path key={s.key} d={smooth(s.data)} fill="none" stroke={s.color} strokeWidth={s.key === "margen" ? 2.4 : 1.8} strokeLinecap="round" strokeLinejoin="round" style={{ filter:`drop-shadow(0 0 5px ${s.color}66)` }}/>
        ))}
        {/* un punto en CADA mes (para ver todos los datos) · tono MÁS CLARO que la curva · el último (HOY · dato real) más grande con glow */}
        {shown.map((s) => s.data.map((v, i) => (
          <circle key={"pt" + s.key + i} cx={xAt(i)} cy={yAt(v)} r={i === n - 1 ? 3.2 : 2.1} fill={_lighten(s.color)} stroke={C.bg} strokeWidth={i === n - 1 ? 1.5 : 0.8}
            style={i === n - 1 ? { filter:`drop-shadow(0 0 4px ${s.color}88)` } : undefined}/>
        )))}
        {film.meses.map((m, i) => <text key={"x" + i} x={xAt(i)} y={H - padB + 12} fill={C.textMuted} fontSize="7" fontFamily={MONO} textAnchor="middle">{m}</text>)}
        {/* hitboxes de hover (uno por mes) · igual que el evolutivo */}
        {film.meses.map((m, i) => <rect key={"hb" + i} x={xAt(i) - stepX / 2} y={padT} width={stepX} height={H - padT - padB} fill="transparent" onMouseEnter={() => setHov(i)}/>)}
        {/* guía + puntos + tooltip al situarse en la curva */}
        {hov != null && (<>
          <line x1={xAt(hov)} y1={padT} x2={xAt(hov)} y2={H - padB} stroke={C.text} strokeWidth="1" strokeDasharray="2 3" opacity="0.4"/>
          {shown.map((s) => <circle key={"hv" + s.key} cx={xAt(hov)} cy={yAt(s.data[hov])} r="4.5" fill={C.red} stroke={C.bg} strokeWidth="1.5" style={{ filter:`drop-shadow(0 0 5px ${C.red}aa)` }}/>)}
          {(() => { const tx = Math.min(Math.max(xAt(hov) - TW / 2, 2), W - TW - 2); return (
            <g transform={`translate(${tx},4)`}>
              <rect width={TW} height={TH} rx="6" fill="#0a0a09" stroke={C.borderLight} strokeWidth="1"/>
              <text x="9" y="13" fill={C.textSub} fontSize="9" fontFamily={MONO} fontWeight="600">{film.meses[hov]}</text>
              {shown.map((s, k) => <text key={s.key} x="9" y={27 + k * 13} fill={s.color} fontSize="9" fontFamily={MONO}>{s.label}: {p1(s.data[hov])}%</text>)}
            </g>
          ); })()}
        </>)}
      </svg>
      <div style={{ fontSize:11, color:C.textMuted, lineHeight:1.5, marginTop:8, paddingTop:8, borderTop:`1px solid ${C.border}` }}>
        Ilustrativo — todavía no tengo el histórico mes a mes de <span style={{ color:C.textSub }}>{film.focus}</span> (el ERP lo enciende). El <span style={{ color:C.textSub }}>hoy</span> es el dato real; suma <span style={{ color:C.teal }}>Costo</span> y <span style={{ color:C.lav }}>Carga</span> y vas a ver el componente dominante (<span style={{ color:C.textSub }}>{film.thesis}</span>) trepar mientras el margen se erosiona.
      </div>
    </Card>
  );
}

// ── COMPARACIÓN CONTROLADA · el GRÁFICO que faltaba al comparar (dumbbell) · dos entidades en cada métrica ──
// Escala AJUSTADA por métrica → la distancia entre los puntos ES la diferencia real (aunque sea 0.5pp se ve). Dato
// real (buildMarginDecomposition de A y B) · cliente·margen. Revela la palanca que los separa.
function ComparacionChart({ a, b, scenario }) {
  const dA = buildMarginDecomposition(a, scenario), dB = buildMarginDecomposition(b, scenario);
  if (!dA || !dB) return null;
  const rows = [
    { label: "Margen", va: dA.margen,   vb: dB.margen,   hiBetter: true  },
    { label: "Carga",  va: dA.cargaPct, vb: dB.cargaPct, hiBetter: false },   // menos carga = mejor
    { label: "Costo",  va: dA.costoPct, vb: dB.costoPct, hiBetter: false },   // menos costo = mejor
  ];
  const W = 520, padL = 62, padR = 54, rowH = 34, H = rows.length * rowH + 14;
  const colA = C.elec, colB = C.teal;
  // la palanca que separa: la métrica no-margen con mayor diferencia (a favor del que gana margen)
  const bWins = dB.margen >= dA.margen;
  const lever = Math.abs(dA.costoPct - dB.costoPct) >= Math.abs(dA.cargaPct - dB.cargaPct) ? "estructura de costo" : "carga comercial";
  return (
    <Card>
      <Eyebrow def={METRIC_DEFS["Comparación controlada"]}>Comparación controlada</Eyebrow>
      <div style={{ display:"flex", gap:16, marginBottom:4 }}>
        {[[a, colA], [b, colB]].map(([nm, col]) => (
          <span key={nm} style={{ display:"flex", alignItems:"center", gap:6, fontSize:11.5, color:C.textSub }}>
            <span style={{ width:9, height:9, borderRadius:"50%", background:col }}/>{nm}
          </span>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width:"100%", height:"auto", display:"block" }}>
        {rows.map((r, i) => {
          const y = 16 + i * rowH;
          const lo = Math.min(r.va, r.vb), hi = Math.max(r.va, r.vb), rng = Math.max(hi - lo, 1);
          const axLo = lo - rng * 0.9, axHi = hi + rng * 0.9;
          const x = (v) => padL + (v - axLo) / (axHi - axLo) * (W - padL - padR);
          const xa = x(r.va), xb = x(r.vb);
          return (
            <g key={i}>
              <text x={padL - 10} y={y + 4} textAnchor="end" fill={C.textSub} fontSize="11.5" fontFamily="'DM Sans', system-ui, sans-serif">{r.label}</text>
              <line x1={Math.min(xa, xb)} y1={y} x2={Math.max(xa, xb)} y2={y} stroke={C.borderLight} strokeWidth="2.5" strokeLinecap="round"/>
              <circle cx={xa} cy={y} r="5" fill={colA} stroke={C.bg} strokeWidth="1.5" style={{ filter:`drop-shadow(0 0 4px ${colA}88)` }}/>
              <circle cx={xb} cy={y} r="5" fill={colB} stroke={C.bg} strokeWidth="1.5" style={{ filter:`drop-shadow(0 0 4px ${colB}88)` }}/>
              <text x={xa} y={y - 9} textAnchor="middle" fill={colA} fontSize="9.5" fontFamily={MONO}>{p1(r.va)}%</text>
              <text x={xb} y={y + 16} textAnchor="middle" fill={colB} fontSize="9.5" fontFamily={MONO}>{p1(r.vb)}%</text>
            </g>
          );
        })}
      </svg>
      <div style={{ fontSize:11.5, color:C.textMuted, lineHeight:1.5, marginTop:8, paddingTop:8, borderTop:`1px solid ${C.border}` }}>
        <span style={{ color: bWins ? colB : colA, fontWeight:600 }}>{bWins ? b : a}</span> saca mejor margen — lo que los separa es la <span style={{ color:C.textSub }}>{lever}</span>.
      </div>
    </Card>
  );
}

// ── StationPeriodo · la estación VENTAS en el tiempo (owner 2026-07-08 · "período que elija el usuario") ──
// Serie GLOBAL mensual REAL (buildGlobalEvolution · misma verdad que La Historia) con selector 12/24 meses. El corte
// mensual POR ENTIDAD no existe todavía (se enciende con el ERP) → se dice, no se dibuja (regla madre: no fingir series).
// ── StationCompareFilm · las DOS curvas de la comparación (owner 2026-07-08: "son datos y clientes diferentes") ──
// Serie mensual POR ENTIDAD desde historialMargen (el dato del dataset, mismo origen que la película de la brecha).
// Mismos colores que el Perfil (A elec · B teal), puntito por mes, pico verde / valle rojo parpadeando, hover con
// mes + ambos datos, y abajo la LECTURA del período: meses de alzas/caídas, dónde se abre la brecha, cruces.
function StationCompareFilm({ cmp }) {
  const [hov, setHov] = useState(null);
  const { a: A, b: B, meses, n } = cmp;
  const colA = C.elec, colB = C.teal;
  const W = 560, H = 118, padL = 8, padR = 8, padT = 14, padB = 18;
  const all = [...A.serie, ...B.serie];
  const lo = Math.min(...all), hi = Math.max(...all), rng = Math.max(hi - lo, 1);
  const x = (i) => padL + i * (W - padL - padR) / Math.max(1, n - 1);
  const y = (v) => padT + (1 - (v - lo) / rng) * (H - padT - padB);
  const dOf = (s) => s.map((v, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(v)}`).join(" ");
  const fmV = (v) => Math.abs(v) >= 1000 ? "$" + (v / 1000).toFixed(1) + "M" : "$" + Math.round(v) + "K";
  const tipW = 128, tipH = 38;
  const tipX = hov == null ? 0 : Math.max(padL, Math.min(W - padR - tipW, x(hov) - tipW / 2));
  const tipY = hov == null ? 0 : (Math.min(y(A.serie[hov]), y(B.serie[hov])) < tipH + 16 ? H - padB - tipH - 2 : padT - 4);
  // las alzas y bajas de cada curva, en PUNTOS SEPARADOS y en lenguaje de negocio (owner 2026-07-08: sin "pico/valle")
  const tray = (E, col) => (
    <div style={{ marginBottom: 4 }}>
      <span style={{ color: col, fontWeight: 600 }}>{E.name}</span>{E.sinCaidas
        ? <> — sube sostenido de {fmV(E.first)} ({meses[0]}) a {fmV(E.last)} ({meses[n - 1]}), sin retrocesos.</>
        : <> — la subida fuerte llega {E.growth.from}→{E.growth.mes} (+{fmV(E.growth.delta)}) y el freno {E.drop.from}→{E.drop.mes} (−{fmV(Math.abs(E.drop.delta))}); su mejor mes es <span style={{ color:C.green }}>{E.maxMes}</span> ({fmV(E.max)}) y el más bajo <span style={{ color:C.red }}>{E.minMes}</span> ({fmV(E.min)}).</>}
    </div>
  );
  const lider = cmp.aArribaTodo ? A : cmp.bArribaTodo ? B : null;
  const brechaAbre = Math.abs(cmp.gapHoy) > Math.abs(cmp.gapInicio);
  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", gap:5, marginBottom:7 }}>
        <span style={{ fontFamily:MONO, fontSize:10, color:C.textMuted }}>12 meses · mes a mes del dataset</span>
        <span style={{ marginLeft:"auto", fontFamily:MONO, fontSize:10, color:C.textMuted }}>
          brecha hoy <span style={{ color: cmp.gapHoy >= 0 ? colA : colB }}>{fmV(Math.abs(cmp.gapHoy))}</span> · más ancha en {cmp.wideMes}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width:"100%", height:"auto", display:"block" }}>
        <path d={dOf(A.serie)} fill="none" stroke={colA} strokeWidth="5" strokeLinejoin="round" opacity="0.14"/>
        <path d={dOf(B.serie)} fill="none" stroke={colB} strokeWidth="5" strokeLinejoin="round" opacity="0.14"/>
        <path d={dOf(A.serie)} fill="none" stroke={colA} strokeWidth="1.8" strokeLinejoin="round" opacity="0.95"/>
        <path d={dOf(B.serie)} fill="none" stroke={colB} strokeWidth="1.8" strokeLinejoin="round" opacity="0.95"/>
        {A.serie.map((v, i) => <circle key={"a" + i} cx={x(i)} cy={y(v)} r="2" fill={colA} stroke="#000" strokeWidth="0.8" opacity="0.9"/>)}
        {B.serie.map((v, i) => <circle key={"b" + i} cx={x(i)} cy={y(v)} r="2" fill={colB} stroke="#000" strokeWidth="0.8" opacity="0.9"/>)}
        {/* pico VERDE y valle ROJO de cada curva, parpadeando (SMIL · sin filtros) */}
        {[A, B].map((E, k) => (
          <g key={"pv" + k}>
            <circle cx={x(E.serie.indexOf(E.max))} cy={y(E.max)} r="3.4" fill={C.green} stroke="#000" strokeWidth="1">
              <animate attributeName="opacity" values="1;0.25;1" dur="1.5s" repeatCount="indefinite"/>
            </circle>
            <circle cx={x(E.serie.indexOf(E.min))} cy={y(E.min)} r="3.4" fill={C.red} stroke="#000" strokeWidth="1">
              <animate attributeName="opacity" values="1;0.25;1" dur="1.5s" repeatCount="indefinite"/>
            </circle>
          </g>
        ))}
        <text x={padL} y={H - 4} fill={C.textMuted} fontSize="8" fontFamily={MONO}>{meses[0]}</text>
        <text x={W - padR} y={H - 4} textAnchor="end" fill={C.textMuted} fontSize="8" fontFamily={MONO}>{meses[n - 1]}</text>
        <rect x={padL - 4} y={0} width={W - padL - padR + 8} height={H} fill="transparent"
          onMouseMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); const rel = (e.clientX - r.left) / Math.max(1, r.width); const i = Math.round(rel * (n - 1)); setHov(Math.max(0, Math.min(n - 1, i))); }}
          onMouseLeave={() => setHov(null)}/>
        {hov != null && (
          <g pointerEvents="none">
            <line x1={x(hov)} x2={x(hov)} y1={padT - 6} y2={H - padB + 4} stroke="rgba(255,255,255,0.22)" strokeWidth="1"/>
            <circle cx={x(hov)} cy={y(A.serie[hov])} r="4" fill={colA} stroke="#000" strokeWidth="1.3"/>
            <circle cx={x(hov)} cy={y(B.serie[hov])} r="4" fill={colB} stroke="#000" strokeWidth="1.3"/>
            <rect x={tipX} y={tipY} width={tipW} height={tipH} rx="6" fill="#181818" stroke={C.borderLight} strokeWidth="1"/>
            <text x={tipX + 8} y={tipY + 11} fill={C.textSub} fontSize="8.5" fontFamily={MONO}>{meses[hov]}</text>
            <text x={tipX + 8} y={tipY + 22} fill={colA} fontSize="9" fontWeight="600" fontFamily={MONO}>{A.name.slice(0, 10)} {fmV(A.serie[hov])}</text>
            <text x={tipX + 8} y={tipY + 33} fill={colB} fontSize="9" fontWeight="600" fontFamily={MONO}>{B.name.slice(0, 10)} {fmV(B.serie[hov])}</text>
          </g>
        )}
      </svg>
      {/* LECTURA DEL PERÍODO (owner: alzas y bajas por cliente en puntos separados · la brecha en punto aparte) */}
      <div style={{ fontSize:11, color:C.textSub, lineHeight:1.55, marginTop:8 }}>
        {tray(A, colA)}
        {tray(B, colB)}
        <div>
          La brecha va de {fmV(Math.abs(cmp.gapInicio))} ({meses[0]}) a {fmV(Math.abs(cmp.gapHoy))} ({meses[n - 1]}) — {brechaAbre ? "se abre" : "se cierra"} con el año, más ancha en {cmp.wideMes} ({fmV(Math.abs(cmp.wideGap))}).{" "}
          {lider
            ? <>Sin cruces: <span style={{ color: lider === A ? colA : colB, fontWeight:600 }}>{lider.name}</span> va arriba los {n} meses.</>
            : cmp.cruces.length
            ? <>Cruces: {cmp.cruces.map((c) => `${c.arriba} pasa arriba en ${c.mes}`).join(" · ")}.</>
            : null}
        </div>
      </div>
      <div style={{ fontSize:10.5, color:C.textMuted, lineHeight:1.5, marginTop:6 }}>
        Tendencia del historial de cada cuenta con la estacionalidad real del negocio (curva global de ventas) — el total del año cierra exacto. El mes a mes fino por entidad y el año anterior se afinan con el histórico del ERP.
      </div>
    </div>
  );
}

function StationPeriodo({ a, b }) {
  const [per, setPer] = useState("12");
  const [hov, setHov] = useState(null);   // índice bajo el cursor → tooltip mes + dato (owner 2026-07-08)
  const ev = buildGlobalEvolution();
  const serie = per === "24" ? ev.seq24.map((x) => x.v) : ev.actual;
  const labels = per === "24" ? ev.seq24.map((x) => x.mes + (x.anio === "anterior" ? " (año ant.)" : "")) : ev.meses;
  const W = 560, H = 98, padL = 8, padR = 8, padT = 14, padB = 18;
  const lo = Math.min(...serie), hi = Math.max(...serie), rng = Math.max(hi - lo, 1);
  const x = (i) => padL + i * (W - padL - padR) / Math.max(1, serie.length - 1);
  const y = (v) => padT + (1 - (v - lo) / rng) * (H - padT - padB);
  const d = serie.map((v, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(v)}`).join(" ");
  const iMax = serie.indexOf(hi), iMin = serie.indexOf(lo);
  const fmV = (v) => "$" + (v / 1000).toFixed(1) + "M";
  // lectura del período: mayor alza / mayor caída CON SUS MESES, derivada de la serie MOSTRADA (12 o 24) — cierra con la curva
  let gDrop = { delta: 0, i: 0 }, gRise = { delta: 0, i: 0 };
  for (let i = 1; i < serie.length; i++) {
    const dd = serie[i] - serie[i - 1];
    if (dd < gDrop.delta) gDrop = { delta: dd, i };
    if (dd > gRise.delta) gRise = { delta: dd, i };
  }
  // tooltip clampeado al viewBox (no se corta en los extremos)
  const tipW = 108, tipX = hov == null ? 0 : Math.max(padL, Math.min(W - padR - tipW, x(hov) - tipW / 2));
  const tipY = hov == null ? 0 : (y(serie[hov]) < 42 ? y(serie[hov]) + 12 : y(serie[hov]) - 34);
  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", gap:5, marginBottom:7 }}>
        {[["12", "12 meses"], ["24", "24 meses"]].map(([k, l]) => (
          <button key={k} onClick={() => setPer(k)} style={{ padding:"3px 9px", borderRadius:6, fontSize:10.5, fontWeight:600, cursor:"pointer", fontFamily:"'DM Sans', system-ui, sans-serif",
            border:`1px solid ${per === k ? "rgba(47,184,218,0.5)" : C.border}`, background: per === k ? "rgba(47,184,218,0.10)" : "transparent", color: per === k ? C.celeste : C.textMuted }}>{l}</button>
        ))}
        <span style={{ marginLeft:"auto", fontFamily:MONO, fontSize:10, color:C.textMuted }}>mejor mes <span style={{ color:C.green }}>{ev.maxMes} {fmV(ev.max)}</span> · más bajo <span style={{ color:C.red }}>{ev.minMes} {fmV(ev.min)}</span></span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width:"100%", height:"auto", display:"block" }}>
        <path d={d} fill="none" stroke={C.celeste} strokeWidth="5" strokeLinejoin="round" opacity="0.15"/>
        <path d={d} fill="none" stroke={C.celeste} strokeWidth="1.8" strokeLinejoin="round" opacity="0.95"/>
        {/* puntito en CADA mes de la curva (owner 2026-07-08) */}
        {serie.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r="2" fill={C.celeste} stroke="#000" strokeWidth="0.8" opacity="0.9"/>)}
        {/* pico en VERDE y valle en ROJO, parpadeando (SMIL · sin filtros) */}
        <circle cx={x(iMax)} cy={y(hi)} r="3.6" fill={C.green} stroke="#000" strokeWidth="1">
          <animate attributeName="opacity" values="1;0.25;1" dur="1.5s" repeatCount="indefinite"/>
        </circle>
        <circle cx={x(iMin)} cy={y(lo)} r="3.6" fill={C.red} stroke="#000" strokeWidth="1">
          <animate attributeName="opacity" values="1;0.25;1" dur="1.5s" repeatCount="indefinite"/>
        </circle>
        <text x={padL} y={H - 4} fill={C.textMuted} fontSize="8" fontFamily={MONO}>{per === "24" ? "Ene (año ant.)" : labels[0]}</text>
        <text x={W - padR} y={H - 4} textAnchor="end" fill={C.textMuted} fontSize="8" fontFamily={MONO}>{per === "24" ? "Dic (actual)" : labels[labels.length - 1]}</text>
        {/* HOVER: mes + dato del punto bajo el cursor (owner 2026-07-08 · "pasá por la curva y aparece el mes con el dato") */}
        <rect x={padL - 4} y={0} width={W - padL - padR + 8} height={H} fill="transparent"
          onMouseMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); const rel = (e.clientX - r.left) / Math.max(1, r.width); const i = Math.round(rel * (serie.length - 1)); setHov(Math.max(0, Math.min(serie.length - 1, i))); }}
          onMouseLeave={() => setHov(null)}/>
        {hov != null && (
          <g pointerEvents="none">
            <line x1={x(hov)} x2={x(hov)} y1={padT - 6} y2={H - padB + 4} stroke="rgba(255,255,255,0.22)" strokeWidth="1"/>
            <circle cx={x(hov)} cy={y(serie[hov])} r="4.2" fill={C.celeste} stroke="#000" strokeWidth="1.3"/>
            <rect x={tipX} y={tipY} width={tipW} height={26} rx="6" fill="#181818" stroke={C.borderLight} strokeWidth="1"/>
            <text x={tipX + 8} y={tipY + 11} fill={C.textSub} fontSize="8.5" fontFamily={MONO}>{labels[hov]}</text>
            <text x={tipX + 8} y={tipY + 21} fill={C.celeste} fontSize="9.5" fontWeight="600" fontFamily={MONO}>{fmV(serie[hov])}</text>
          </g>
        )}
      </svg>
      {/* LECTURA DEL PERÍODO (owner: los MESES de alzas/desvíos, en lenguaje de negocio) — derivada de la serie mostrada */}
      <div style={{ fontSize:11, color:C.textSub, lineHeight:1.55, marginTop:8 }}>
        El mejor mes es <span style={{ color:C.green }}>{labels[iMax]}</span> ({fmV(hi)}) y el más bajo <span style={{ color:C.red }}>{labels[iMin]}</span> ({fmV(lo)}).
        {gRise.delta > 0 && <> La subida más fuerte llega {labels[gRise.i - 1]}→{labels[gRise.i]} (+{fmV(gRise.delta)}).</>}
        {gDrop.delta < 0 && <> El freno más fuerte, {labels[gDrop.i - 1]}→{labels[gDrop.i]} (−{fmV(Math.abs(gDrop.delta))}).</>}
      </div>
      <div style={{ fontSize:10.5, color:C.textMuted, lineHeight:1.5, marginTop:6 }}>
        La película GLOBAL de tu venta ({per} meses · dato real mensual) — pasa el cursor por la curva para ver cada mes. El corte mensual de {a} y {b} por separado se enciende con el histórico del ERP — no te dibujo una serie que no existe.
      </div>
    </div>
  );
}

/* ── PERFIL COMPARADO · el gráfico de líneas de la MESA (owner 2026-07-07/08 · EN PLENITUD: todas las dimensiones) ──
 * Dos entidades = dos LÍNEAS que recorren las estaciones del EJE. UNA regla de lectura: ARRIBA = MEJOR (donde menos es
 * mejor, la escala se invierte y lo dice). CLIENTE usa las 5 estaciones estructurales (venta→contribución→margen→carga→
 * costo); SKU/MARCA/BODEGA derivan sus estaciones de LAS COLUMNAS DEL CUADRO (data-driven: mismo fmt, misma dirección —
 * el gráfico espeja la tabla que el usuario ve). Estación CLICKEABLE → detalle por período (la serie global real cuando
 * existe; el corte por entidad se enciende con el ERP — honesto). "Que ADI los compare a fondo" precarga la comparación. */
// ── MESA PERFIL (owner 2026-07-09: "también debería individual" + "como el modelo del chat — se entiende mejor") ·
// la entidad SOLA contra el PROMEDIO de su eje, en la GRAMÁTICA de los gráficos del chat (card negra premium +
// eje central estilo movers): el spine ES el promedio; derecha (verde) = mejor, izquierda (rojo) = peor — la
// geometría dice la calidad aunque la métrica sea "menos = mejor". La vara (piso/target de POLICY) queda declarada. ──
// ── FICHA DE ENTIDAD (owner 2026-07-10 · "panel de Sentrix único"): click en UNA fila del cuadro → TODO lo de esa
// entidad, gráfico: (1) el 80/20 de su eje con SU columna destacada · (2) el Perfil vs promedio. El COMPARADO
// contra el año anterior (ex evolutivo de la ficha) subió ARRIBA de la tabla en el PASE 1c (owner 2026-07-15:
// "por encima de la tabla, reaccionando a sus filtros") — ComparadoCard, métricas Ventas · Contribución · Margen.
// Modelo del chat en todo · hover con dato en todo · explicativo "i" en cada bloque · honesto donde la serie no
// existe (margen mensual plano → se dice, no se dibuja · año anterior sin ancla → no se fabrica). ──
// PASE 1c (owner 2026-07-15): fuera "Acciones de precios" — con Ventas · Contribución · Margen el comparado sirve
// para clientes y SKU por igual (las tres existen en todos los ejes con serie).
const _FICHA_ESTACIONES = [
  { key: "venta",        label: "Ventas" },
  { key: "contribucion", label: "Contribución" },
  { key: "margen",       label: "Margen" },
];
// BOTÓN "QUE ADI LO EXPLIQUE" (owner 2026-07-10: cada gráfico lleva a ADI para que cuente LA HISTORIA de contratos
// —lectura→porqué→palanca—, no una lectura de datos). Cada pregunta es una PROMESA: está en el gate de promesas
// (emisor ui:ficha) — garantizado que responde su historia bajo cualquier parse del LLM.
const _FICHA_STORY_Q = {
  venta:        (name) => `Profundiza en ${name}`,                       // dive causal: tesis + brecha + palanca
  contribucion: (name) => `¿De dónde saca ${name} su contribución?`,     // origen: volumen vs calidad
  margen:       (name) => `¿Por qué ${name} cede margen?`,               // causa del margen
};
// EL PARETO ES REFLEJO DE LA TABLA (owner 2026-07-10): eje = el del cuadro · filtro Ventas/Contribución · sin
// selección = el 80/20 del negocio · con selección = la COMPOSICIÓN de esa entidad cuando el cruce existe
// (marca/familia → sus SKU, dato real); cliente/SKU no tienen matriz transaccional → dónde pesa + se declara.
// El botón ADI (esquina derecha) interpreta EXACTAMENTE lo que el gráfico muestra en ese momento.
const _PARETO_PLURAL = { cliente: "clientes", marca: "marcas", familia: "familias", sku: "SKU" };
// el botón pregunta LO QUE EL GRÁFICO MUESTRA (owner 2026-07-15: "que ADI explique lo que ve" — el 80/20, no un
// ranking): en ventas, el foco concentracion del composer de ventas responde con LA MISMA cuenta del gráfico.
const _PARETO_NEG_Q = {
  ventas:       { cliente: "¿Qué clientes explican el 80% de mi venta?", marca: "¿Qué marcas explican el 80% de mi venta?", familia: "¿Qué familias explican el 80% de mi venta?", sku: "¿Qué SKU explican el 80% de mi venta?" },
  contribucion: { cliente: "¿En cuántos clientes se concentra mi contribución?", marca: "¿En cuántas marcas se concentra mi contribución?", familia: "¿En cuántas familias se concentra mi contribución?", sku: "¿En cuántos SKU se concentra mi contribución?" },
};
const _btnADI = (onClick, label) => (
  <button onClick={onClick} style={{ background:"transparent", border:"none", color:C.celeste, fontSize:10.5, fontWeight:600, cursor:"pointer", padding:0, fontFamily:"'DM Sans', system-ui, sans-serif", whiteSpace:"nowrap" }}>{label}</button>
);
const _fmDin = (v) => (Math.abs(v) >= 1000 ? "$" + (v / 1000).toFixed(1) + "M" : "$" + Math.round(v) + "K");

function MesaPareto({ dim, scenario, sel = null, onAsk = null }) {
  const [met, setMet] = useState("ventas");
  // AGRUPAR POR FAMILIA (owner 2026-08-06, "familias que más compran, productos — ese es el juego de Sentrix"):
  // SOLO tiene sentido para la composición de UN cliente (marca/familia ya componen por SKU; SKU compone por
  // clientes, que no tienen familia). Default "sku" — el detalle fino que ya existía — "familia" es la nueva
  // vista agregada, mismo cierre exacto (ver composicionClientePorFamilia en clienteSkuMatrix.js).
  const [agrupar, setAgrupar] = useState("sku");
  if (!_PARETO_PLURAL[dim]) return null;   // bodega: sin pareto comercial (su historia es de inventario)
  const metLabel = met === "ventas" ? "venta" : "contribución";
  const porFamilia = dim === "cliente" && sel && agrupar === "familia";
  // COMPOSICIÓN de la entidad seleccionada (owner 2026-07-10: "click en ABC → cómo se compone SU venta/contribución"):
  // marca/familia → sus SKU (skusMargen) · CLIENTE → sus SKU o, si se pide, sus FAMILIAS (matriz cliente×SKU,
  // cierra exacto con el cuadro) · SKU → la transpuesta (quiénes lo compran). Todo dato del set — el gate de
  // conexión lo sella.
  const compRows = !sel ? null
    : (dim === "marca" || dim === "familia")
      ? skusMargen.filter((s) => (dim === "marca" ? s.marca : s.sfamilia) === sel)
          .map((s) => ({ name: s.nombre, value: Number(met === "ventas" ? s.venta : s.contribucion) || 0 }))
          .filter((r) => r.value > 0).sort((a, b) => b.value - a.value)
      : dim === "cliente" ? (porFamilia ? composicionClientePorFamilia(sel, met) : composicionCliente(sel, met))
      : dim === "sku" ? compradoresSku(sel, met)
      : null;
  const compPlural = dim === "sku" ? "clientes" : porFamilia ? "familias" : "SKU";
  let con, modo;
  if (compRows && compRows.length >= 2) {
    const total = compRows.reduce((s, r) => s + r.value, 0) || 1;
    let cum = 0;
    const allBars = compRows.map((r) => { cum += r.value; return { name: r.name, value: r.value, pct: (r.value / total) * 100, cumPct: (cum / total) * 100 }; });
    let bc = allBars.findIndex((b) => b.cumPct >= 80) + 1; if (bc <= 0) bc = allBars.length;
    con = { bars: allBars, n: allBars.length, blockCount: bc, blockPct: Math.round(allBars[bc - 1].cumPct), plural: compPlural };
    modo = "composicion";
  } else {
    con = buildConcentration(dim, scenario, met);
    modo = sel ? "posicion" : "negocio";
  }
  const bars = (con.bars || []).slice(0, 10);
  if (bars.length < 2) return null;
  const idxEnt = sel && modo === "posicion" ? (con.bars || []).findIndex((b) => b.name === sel) : -1;
  const entBar = idxEnt >= 0 ? con.bars[idxEnt] : null;
  // el botón ADI interpreta EL ESTADO del gráfico (cada pregunta = promesa del gate · emisor ui:ficha):
  // composición de cliente/SKU → ADI cuenta TODO de esa entidad en ventas y contribución (multi-análisis C.1 —
  // "es lo que está mostrando el gráfico") · marca/familia → sus SKU top · negocio → concentración/principales.
  const q = modo === "composicion"
    ? (dim === "cliente" || dim === "sku"
      ? `¿Cómo está ${sel} en ventas y contribución?`
      : met === "ventas" ? `¿Cuáles son los SKU que más venden de ${sel}?` : `Top SKU por contribución de ${sel}`)
    : modo === "posicion"
      ? (met === "ventas" ? `Profundiza en ${sel}` : `¿De dónde saca ${sel} su contribución?`)
      : _PARETO_NEG_Q[met][dim];
  const titulo = modo === "composicion" ? `Cómo se compone ${sel}` : modo === "posicion" ? `Dónde pesa ${sel} en el 80/20` : "El 80/20 · cómo se compone";
  const pill = (k, label, active, onClick) => (
    <button key={k} onClick={onClick}
      style={{ padding:"3px 9px", borderRadius:6, border:`1px solid ${active ? "rgba(47,184,218,0.5)" : C.border}`, background: active ? "rgba(47,184,218,0.10)" : "transparent", color: active ? C.celeste : C.textMuted, fontSize:10.5, fontWeight:600, cursor:"pointer", fontFamily:"'DM Sans', system-ui, sans-serif" }}>{label}</button>
  );
  return (
    <div style={{ padding:"14px 16px 10px", borderRadius:12, border:"1px solid rgba(47,184,218,0.25)",
      background:"radial-gradient(140% 90% at 50% 0%, rgba(47,184,218,0.05) 0%, rgba(47,184,218,0) 55%), #0b0b0b",
      boxShadow:"inset 0 1px 0 rgba(255,255,255,0.05)" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:8, flexWrap:"wrap", marginBottom:6 }}>
        <span style={{ fontFamily:MONO, fontSize:9.5, letterSpacing:"0.7px", color:C.celeste, textTransform:"uppercase", display:"flex", alignItems:"center", minWidth:0 }}>
          <span style={{ width:5, height:5, borderRadius:3, background:C.celeste, flexShrink:0, marginRight:6, display:"inline-block" }}/>
          <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{titulo}</span>
          {/* el límite lo DECLARA el módulo (concentration.js `_limite`), no este componente: acá solo se concatena.
              Antes la frase afirmaba «SUMA EXACTO … (una sola verdad)» en todos los ejes, y en dos no suma —marca
              (una marca sin cliente no entra al gráfico y sí al Cuadro) y SKU (dato sin ajuste por escenario)—.
              Una limitación se declara en pantalla; afirmar el cierre donde no cierra es el defecto, no el texto. */}
          <InfoDot def={"El Pareto es un reflejo de la tabla: el eje es el del cuadro y el filtro elige la métrica (venta o contribución). Sin selección ves el 80/20 del negocio. Seleccionando: una marca o familia se compone por sus SKU; un cliente, por sus familias o sus SKU (eliges la vista); un SKU, por los clientes que lo compran — y cada composición suma la cifra del cuadro. El punto ámbar marca el corte real. El botón de ADI explica exactamente lo que el gráfico está mostrando." + (con && con.limite ? ` · ${con.limite.texto}` : "")} align="left"/>
        </span>
        <span style={{ display:"flex", alignItems:"center", gap:8 }}>
          {dim === "cliente" && sel && (
            <span style={{ display:"flex", gap:3 }}>
              {pill("familia", "Por familia", agrupar === "familia", () => setAgrupar("familia"))}
              {pill("sku", "Por SKU", agrupar === "sku", () => setAgrupar("sku"))}
            </span>
          )}
          <span style={{ display:"flex", gap:3 }}>{pill("ventas", "Ventas", met === "ventas", () => setMet("ventas"))}{pill("contribucion", "Contribución", met === "contribucion", () => setMet("contribucion"))}</span>
          {onAsk ? _btnADI(() => onAsk(q), "Que ADI lo explique →") : null}
        </span>
      </div>
      <div style={{ fontSize:12, color:C.text, lineHeight:1.5, marginBottom:8, paddingLeft:10, borderLeft:`2px solid ${C.celeste}` }}>
        <b style={{ color:C.celeste }}>{con.blockCount} de {con.n} {con.plural || _PARETO_PLURAL[dim]}</b> explican el <b>{con.blockPct}%</b> de {modo === "composicion" ? <>la {metLabel} de <b>{sel}</b></> : <>tu {metLabel}</>}.
      </div>
      <MiniPareto showTakeaway={false} showCum={false} onPick={onAsk ? (nombre) => onAsk(`Profundiza en ${nombre}`) : null}
        panel={{ totalPct: con.blockPct, cutoff: Math.min(con.blockCount, bars.length), of: con.n,
          rows: bars.map((b) => ({ nombre: b.name, part: +b.pct.toFixed(1), acum: +b.cumPct.toFixed(1), sub: "$" + (b.value / 1000).toFixed(1) + "M" })) }}/>
      {modo === "posicion" && entBar && (
        <div style={{ fontSize:11, color:C.textSub, marginTop:4 }}>
          {entBar.inBlock !== false && idxEnt < con.blockCount
            ? <>{sel} está en el <b style={{ color:C.text }}>bloque que sostiene la {metLabel}</b>: puesto #{idxEnt + 1} de {con.n}, {p1(entBar.pct)}% del total.</>
            : <>{sel} está en la <b style={{ color:C.text }}>cola</b>: puesto #{idxEnt + 1} de {con.n}, {p1(entBar.pct)}% del total{idxEnt >= bars.length ? " (fuera de las 10 columnas de arriba)" : ""}.</>}
        </div>
      )}
      {con.n > bars.length ? <div style={{ fontSize:10.5, color:C.textMuted, marginTop:4 }}>+{con.n - bars.length} más en el cuadro.</div> : null}
    </div>
  );
}

// ── EL COMPARADO (PASE 1b/1c · owner 2026-07-15: "el gráfico debe estar POR ENCIMA de la tabla y reaccionar a sus
// filtros") ── la card gráfica que vive ARRIBA de la grilla del cuadro y reacciona a la selección: sin selección,
// el líder del orden actual; UNA fila, esa entidad COMPARADA contra su año anterior; DOS filas, las dos entidades
// lado a lado (mismo eje: clientes, SKU, marcas — cualquier fila con serie; bodega sin serie → sin gráfico).
// Este año en CELESTE (nuestra base) con reflejo premium (doble trazo, sin filtros SVG) · año anterior en PERLAS
// SOLO donde el dato declara su total por entidad (ventas de clientes/marcas — sin ancla no se fabrica) · mes más
// bajo en ROJO parpadeando (adiBlink bajo prefers-reduced-motion: no-preference → fijo con movimiento reducido) ·
// más alto en VERDE · el benchmark de ESTA entidad en ámbar (margen · benchmarkOf con criterio C.2) con el de
// CARTERA en la leyenda (se diferencian) · hover = tooltip con el dato del mes en TODAS las series (regla de todos
// los gráficos). Filtros de métrica en el encabezado: Ventas · Contribución · Margen (sirven igual en todos los ejes).
function ComparadoCard({ a = null, rowA = null, b = null, rowB = null, negocio = false, dim = "cliente", onAsk = null }) {
  const [est, setEst] = useState("venta");
  const [hov, setHov] = useState(null);
  const dual = !!b;
  // MARGEN CONECTADO (owner 2026-07-10): margen del mes = contribución ÷ venta de las mismas curvas; el año cierra
  // exacto con el margen del período del perfil/cuadro (una verdad · el cálculo vive en buildEntityEvolution/Comparado).
  // MODO NEGOCIO (pase 1d): sin selección, la suma del eje — cierra con la fila Total de la tabla de abajo.
  const ev = dual ? null : negocio ? buildNegocioEvolution(dim, est) : buildEntityEvolutionComparado(a, est);
  const cmp = dual ? buildCompareEvolution(a, b, est) : null;
  if (dual ? !cmp : (!ev || ev.n < 2)) return null;   // sin serie → sin gráfico (bodega hoy · honesto)
  const ant = !dual && ev.anterior && ev.anterior.serie;
  const isPct = est === "margen";
  // el benchmark: por entidad (criterio C.2 · varaRef de la fila) · negocio = el de CARTERA · dual solo si AMBAS lo comparten
  const benchA = rowA && typeof rowA.varaRef === "number" ? rowA.varaRef : null;
  const bench = isPct ? (dual ? (benchA != null && rowB && rowB.varaRef === benchA ? benchA : null) : negocio ? benchmarkOf(null) : benchA) : null;
  const aLabel = negocio ? "Tu negocio" : a;
  const fmtV = isPct ? (v) => p1(v) + "%" : _fmDin;
  const fmtD = isPct ? (v) => p1(v) + "pp" : _fmDin;
  const colB = C.lav;   // la segunda entidad en lavanda (paleta base de gráficos · el teal queda para "año anterior")
  const W = 620, H = 120, padL = 12, padR = 12, padT = 14, padB = 10;
  const meses = dual ? cmp.meses : ev.meses;
  const n = dual ? cmp.n : ev.n;
  const serieA = dual ? cmp.a.serie : ev.serie;
  const serieB = dual ? cmp.b.serie : (ant || null);
  const all = [...serieA, ...(serieB || []), ...(bench != null ? [bench] : [])];   // el benchmark entra al rango: la distancia ES el dato
  const lo = Math.min(...all), hi = Math.max(...all), rng = Math.max(hi - lo, 1);
  const xs = serieA.map((_, i) => padL + i * (W - padL - padR) / Math.max(1, n - 1));
  const y = (v) => padT + (1 - (v - lo) / rng) * (H - padT - padB);
  const ys = serieA.map(y);
  const dPath = _mono(xs, ys);
  const dB = serieB ? _mono(xs, serieB.map(y)) : null;
  const iMax = serieA.indexOf(dual ? cmp.a.max : ev.max), iMin = serieA.indexOf(dual ? cmp.a.min : ev.min);
  // el año contra el anterior — dos totales DECLARADOS (la serie anclada suma exacto · el eje puso el anterior)
  const totAct = serieA.reduce((s, v) => s + v, 0);
  const vsAnt = ant && ev.anterior.total ? Math.round((totAct - ev.anterior.total) / ev.anterior.total * 1000) / 10 : null;
  const up = vsAnt != null && vsAnt >= 0;
  const body = (
      <>
        <div style={{ display:"flex", alignItems:"baseline", gap:8, margin:"8px 0 6px", flexWrap:"wrap" }}>
          {/* sin pill "+% Ene→Dic": el punta-a-punta ENGAÑA con estacionalidad (Ene es mes débil — regla 2026-07-08);
              el chip honesto es AÑO contra AÑO (dos totales declarados) — y la historia fina, la lectura de abajo */}
          {dual ? (
            <>
              <span style={{ fontFamily:MONO, fontSize:13, fontWeight:600, color:C.celeste, fontVariantNumeric:"tabular-nums" }}>{a} {fmtV(cmp.a.last)}</span>
              <span style={{ fontFamily:MONO, fontSize:13, fontWeight:600, color:colB, fontVariantNumeric:"tabular-nums" }}>{b} {fmtV(cmp.b.last)}</span>
              <span style={{ fontSize:10, color:C.textMuted }}>último mes ({meses[n - 1]})</span>
            </>
          ) : (
            <>
              <span style={{ fontFamily:MONO, fontSize:14, fontWeight:600, color:C.text, fontVariantNumeric:"tabular-nums" }}>{fmtV(ev.last)}</span>
              <span style={{ fontSize:10, color:C.textMuted }}>último mes ({meses[n - 1]})</span>
              {vsAnt != null && (
                <span style={{ fontFamily:MONO, fontSize:10.5, padding:"1px 7px", borderRadius:4, fontVariantNumeric:"tabular-nums",
                  background: up ? "rgba(16,185,129,0.08)" : "rgba(244,63,94,0.08)", color: up ? C.green : C.red }}>
                  {up ? "+" : ""}{vsAnt}% vs año anterior
                </span>
              )}
            </>
          )}
          {negocio && <span style={{ fontSize:10, color:C.textMuted }}>· el negocio completo ({dim === "sku" ? "todos tus SKU" : dim === "marca" ? "todas tus marcas" : "todos tus clientes"}) — toca una fila para ver una entidad, dos para comparar</span>}
        </div>
        <div style={{ position:"relative", touchAction:"pan-y" }}>
          <svg viewBox={`0 0 ${W} ${H}`} style={{ width:"100%", height:"auto", display:"block" }}>
            <defs>
              <linearGradient id={`fev-${est}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={C.celeste} stopOpacity="0.16"/><stop offset="100%" stopColor={C.celeste} stopOpacity="0"/>
              </linearGradient>
            </defs>
            <path d={`${dPath} L${xs[n - 1]},${H - padB} L${xs[0]},${H - padB} Z`} fill={`url(#fev-${est})`}/>
            <line x1={padL} x2={W - padR} y1={H - padB} y2={H - padB} stroke="rgba(255,255,255,0.08)" strokeWidth="1"/>
            {/* el benchmark de la entidad (ámbar · solo margen) — si queda lejos, la curva se ve lejos: ESE es el dato */}
            {bench != null && <line x1={padL} x2={W - padR} y1={y(bench)} y2={y(bench)} stroke={C.amber} strokeWidth="1.2" strokeDasharray="4 3" opacity="0.65"/>}
            {/* la segunda serie: en modo entidad, el año anterior en perlas (solo donde el dato lo declara);
                en modo comparación, la entidad B en lavanda con su propio reflejo */}
            {dB && (dual
              ? <>
                  <path d={dB} fill="none" stroke={colB} strokeWidth="5" strokeLinejoin="round" opacity="0.15"/>
                  <path d={dB} fill="none" stroke={colB} strokeWidth="2" strokeLinejoin="round" opacity="0.95"/>
                </>
              : <path d={dB} fill="none" stroke={C.teal} strokeWidth="1.6" strokeDasharray="0.1 6" strokeLinecap="round" opacity="0.55"/>)}
            <path d={dPath} fill="none" stroke={C.celeste} strokeWidth="5" strokeLinejoin="round" opacity="0.15"/>
            <path d={dPath} fill="none" stroke={C.celeste} strokeWidth="2" strokeLinejoin="round" opacity="0.95"/>
            {/* puntos por mes en las curvas (owner 2026-07-15 · como el gráfico de evidencia · mismos colores) */}
            {xs.map((x, i) => <circle key={"pma" + i} cx={x} cy={ys[i]} r="2" fill="#0b0b0b" stroke={C.celeste} strokeWidth="1.5"/>)}
            {dual && serieB && xs.map((x, i) => <circle key={"pmb" + i} cx={x} cy={y(serieB[i])} r="2" fill="#0b0b0b" stroke={colB} strokeWidth="1.5"/>)}
            {/* mejor/peor mes MÁS GRUESOS, con el glow del gráfico de evidencia (owner 2026-07-15) */}
            {!dual && <>
              <circle cx={xs[iMax]} cy={ys[iMax]} r="4.2" fill={C.green} stroke="#0b0b0b" strokeWidth="1.5" style={{ filter:`drop-shadow(0 0 4px ${C.green}88)` }}/>
              <circle cx={xs[iMin]} cy={ys[iMin]} r="4.2" fill={C.red} stroke="#0b0b0b" strokeWidth="1.5" style={{ filter:`drop-shadow(0 0 4px ${C.red}88)`, animation:"adiBlink 1.5s ease-in-out infinite" }}/>
            </>}
            <circle cx={xs[n - 1]} cy={ys[n - 1]} r="5" fill={C.celeste} opacity="0.22"/>
            <circle cx={xs[n - 1]} cy={ys[n - 1]} r="2.6" fill={C.celeste}/>
            {dual && <circle cx={xs[n - 1]} cy={y(serieB[n - 1])} r="2.6" fill={colB}/>}
            {hov != null && (
              <g pointerEvents="none">
                <line x1={xs[hov]} x2={xs[hov]} y1={padT - 5} y2={H - padB} stroke="rgba(255,255,255,0.18)" strokeWidth="1"/>
                {serieB && <circle cx={xs[hov]} cy={y(serieB[hov])} r="3" fill={dual ? colB : C.teal} stroke="#0b0b0b" strokeWidth="2"/>}
                <circle cx={xs[hov]} cy={ys[hov]} r="3.6" fill={C.celeste} stroke="#0b0b0b" strokeWidth="2"/>
              </g>
            )}
            <rect x="0" y="0" width={W} height={H} fill="transparent"
              onPointerMove={(e) => { const bx = e.currentTarget.getBoundingClientRect(); const rel = (e.clientX - bx.left) / Math.max(1, bx.width); setHov(Math.max(0, Math.min(n - 1, Math.round(rel * (n - 1))))); }}
              onPointerLeave={() => setHov(null)}/>
          </svg>
          {hov != null && (
            <div style={{ position:"absolute", top:-2, left:`${(xs[hov] / W) * 100}%`, transform: hov > n / 2 ? "translateX(calc(-100% - 8px))" : "translateX(8px)",
              pointerEvents:"none", background:"#161616", border:`1px solid ${C.borderLight}`, borderRadius:6, padding:"3px 9px",
              fontFamily:MONO, fontSize:10.5, fontVariantNumeric:"tabular-nums", whiteSpace:"nowrap", color:C.textMuted }}>
              <span style={{ color:C.textSub }}>{meses[hov]}</span>{dual
                ? <> <b style={{ color:C.celeste }}>{fmtV(serieA[hov])}</b> · <b style={{ color:colB }}>{fmtV(serieB[hov])}</b></>
                : <> <b style={{ color:C.text }}>{fmtV(serieA[hov])}</b>{ant ? <> · ant {fmtV(ant[hov])}</> : null}</>}
            </div>
          )}
          <div style={{ display:"flex", justifyContent:"space-between", marginTop:2, fontFamily:MONO, fontSize:9.5, color:C.textMuted }}>
            <span>{meses[0]}</span><span>{meses[n - 1]}</span>
          </div>
        </div>
        {dual ? (
          <div style={{ fontSize:11, color:C.textSub, lineHeight:1.55, marginTop:6 }}>
            {cmp.aArribaTodo ? <><span style={{ color:C.celeste }}>{a}</span> queda arriba los 12 meses</>
              : cmp.bArribaTodo ? <><span style={{ color:colB }}>{b}</span> queda arriba los 12 meses</>
              : cmp.cruces.length ? <>Se cruzan en {cmp.cruces[0].mes}{cmp.cruces.length > 1 ? ` (y ${cmp.cruces.length - 1} vez${cmp.cruces.length > 2 ? "es" : ""} más)` : ""} — hoy va arriba <span style={{ color: cmp.gapHoy >= 0 ? C.celeste : colB }}>{cmp.gapHoy >= 0 ? a : b}</span></>
              : null}
            {" "}· la brecha más ancha es en {cmp.wideMes} ({fmtD(Math.abs(cmp.wideGap))}) y la más corta en {cmp.narrowMes} ({fmtD(Math.abs(cmp.narrowGap))}).
          </div>
        ) : (
          <div style={{ fontSize:11, color:C.textSub, lineHeight:1.55, marginTop:6 }}>
            El mejor mes es <span style={{ color:C.green }}>{ev.maxMes}</span> ({fmtV(ev.max)}) y el más bajo <span style={{ color:C.red }}>{ev.minMes}</span> ({fmtV(ev.min)}).
            {ev.growth.mes && ev.growth.delta > 0 && <> La subida más fuerte llega {ev.growth.from}→{ev.growth.mes} (+{fmtD(ev.growth.delta)}).</>}
            {ev.drop.mes && <> La caída más fuerte, {ev.drop.from}→{ev.drop.mes} (−{fmtD(Math.abs(ev.drop.delta))}).</>}
          </div>
        )}
        {!dual && !ant && (
          <div style={{ fontSize:10, color:C.textMuted, lineHeight:1.5, marginTop:4 }}>
            El año anterior de esta {est === "venta" ? "entidad" : "métrica"} no viene declarado en el dato — ADI no lo dibuja.
          </div>
        )}
        {isPct && (
          <div style={{ fontSize:10, color:C.textMuted, lineHeight:1.5, marginTop:4 }}>
            margen del mes = contribución ÷ venta del mes (las mismas curvas) · el agregado del año cierra con el margen del período del perfil.
          </div>
        )}
        {onAsk && !dual && !negocio && (
          <div style={{ display:"flex", justifyContent:"flex-end", marginTop:6 }}>
            {_btnADI(() => onAsk(_FICHA_STORY_Q[est](a)), "Que ADI te cuente esta historia →")}
          </div>
        )}
      </>
    );
  return (
    <div style={{ padding:"14px 16px 12px", borderRadius:12, border:"1px solid rgba(47,184,218,0.25)",
      background:"radial-gradient(140% 90% at 50% 0%, rgba(47,184,218,0.05) 0%, rgba(47,184,218,0) 55%), #0b0b0b",
      boxShadow:"inset 0 1px 0 rgba(255,255,255,0.05)" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:8, flexWrap:"wrap" }}>
        <span style={{ fontFamily:MONO, fontSize:9.5, letterSpacing:"0.7px", color:C.celeste, textTransform:"uppercase", display:"flex", alignItems:"center", minWidth:0 }}>
          <span style={{ width:5, height:5, borderRadius:3, background:C.celeste, flexShrink:0, marginRight:6, display:"inline-block" }}/>
          <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{dual ? `Comparado · ${a} vs ${b}` : `Comparado · ${aLabel} · 12 meses`}</span>
          <InfoDot def={"La película mensual comparada, sobre la tabla y conectada a ella: sin selección ves TU NEGOCIO — la suma de todas las entidades del eje, que cierra exacto con la fila Total de la tabla; toca UNA fila y ves esa entidad contra su año anterior (perlas — se dibujan solo donde el dato declara ese total: ventas de clientes y marcas; ADI no lo inventa); toca DOS y las ves lado a lado. El filtro del encabezado elige la métrica (Ventas · Contribución · Margen) y sirve igual en clientes, SKU y marcas. El punto verde es el mejor mes y el rojo parpadeante el más bajo; en margen, la línea ámbar es el benchmark (el de la entidad, o el de cartera cuando miras el negocio). Pasa el cursor y ves el dato del mes en todas las series. TODO CIERRA: el total del año de cada curva es exactamente el dato del período del cuadro y el perfil, el año anterior suma exacto el que ya usan los movers, y el margen mensual se deriva de contribución ÷ venta de estas mismas curvas — una sola verdad."} align="left"/>
        </span>
        <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
          {/* leyenda honesta: cada serie se nombra · el benchmark ámbar solo cuando se dibuja · cartera para diferenciar */}
          <span style={{ display:"flex", alignItems:"center", gap:8, fontSize:10, color:C.textSub }}>
            <span style={{ display:"flex", alignItems:"center", gap:4 }}><span style={{ width:12, height:2.5, borderRadius:2, background:C.celeste }}/>{dual ? a : "este año"}</span>
            {dual ? <span style={{ display:"flex", alignItems:"center", gap:4 }}><span style={{ width:12, height:2.5, borderRadius:2, background:colB }}/>{b}</span>
              : ant ? <span style={{ display:"flex", alignItems:"center", gap:4 }}><span style={{ width:12, height:0, borderTop:`2px dotted ${C.teal}` }}/>año anterior</span> : null}
            {bench != null ? <span style={{ display:"flex", alignItems:"center", gap:4 }}><span style={{ width:12, height:0, borderTop:`1.5px dashed ${C.amber}` }}/>{negocio ? <>benchmark cartera {p1(bench)}%</> : <>benchmark {p1(bench)}% <span style={{ color:C.textMuted }}>· cartera {p1(benchmarkOf(null))}%</span></>}</span> : null}
          </span>
          <div style={{ display:"flex", gap:3, flexWrap:"wrap" }}>
            {_FICHA_ESTACIONES.map((e) => (
              <button key={e.key} onClick={() => { setEst(e.key); setHov(null); }}
                style={{ padding:"3px 9px", borderRadius:6, border:`1px solid ${est === e.key ? "rgba(47,184,218,0.5)" : C.border}`, background: est === e.key ? "rgba(47,184,218,0.10)" : "transparent", color: est === e.key ? C.celeste : C.textMuted, fontSize:10.5, fontWeight:600, cursor:"pointer", fontFamily:"'DM Sans', system-ui, sans-serif" }}>{e.label}</button>
            ))}
          </div>
        </div>
      </div>
      {body}
    </div>
  );
}

// curva monotónica local (Fritsch–Carlson · misma técnica del chat: suave SIN overshoot — la forma no fabrica)
function _mono(xs, ys) {
  const n = xs.length;
  if (n < 3) return xs.map((x, i) => `${i ? "L" : "M"}${x},${ys[i]}`).join(" ");
  const dx = [], m = [];
  for (let i = 0; i < n - 1; i++) { dx.push(xs[i + 1] - xs[i]); m.push((ys[i + 1] - ys[i]) / dx[i]); }
  const t = [m[0]];
  for (let i = 1; i < n - 1; i++) t.push(m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2);
  t.push(m[n - 2]);
  for (let i = 0; i < n - 1; i++) {
    if (!m[i]) { t[i] = 0; t[i + 1] = 0; continue; }
    const a = t[i] / m[i], b = t[i + 1] / m[i], h = Math.hypot(a, b);
    if (h > 3) { t[i] = 3 * (a / h) * m[i]; t[i + 1] = 3 * (b / h) * m[i]; }
  }
  let d = `M${xs[0]},${ys[0]}`;
  for (let i = 0; i < n - 1; i++)
    d += ` C${(xs[i] + dx[i] / 3).toFixed(2)},${(ys[i] + t[i] * dx[i] / 3).toFixed(2)} ${(xs[i + 1] - dx[i] / 3).toFixed(2)},${(ys[i + 1] - t[i + 1] * dx[i] / 3).toFixed(2)} ${xs[i + 1]},${ys[i + 1]}`;
  return d;
}

// ── FICHA EJECUTIVA DE CLIENTE (owner 2026-08-07, "no quiero otro mockup, debe quedar integrada, navegable y
// desplegada") — construida SOLO con TOOLS.entityProfile/entityComposicion/entityCapitalLigado/trend
// (toolRegistry.js): la MISMA boleta, políticas y cálculos que consume ADI por el chat. Cero cálculo paralelo acá
// — todo lo que se ve es un `.fmt`/`.value` ya autorizado por el motor, nunca una cuenta nueva en React. Funciona
// para CUALQUIER cliente/tenant (name es un parámetro, nunca un literal) — degrada honesto módulo por módulo si
// falta cobertura, nunca inventa ni rellena.
const _panelStyle = {
  padding: "14px 16px 12px", borderRadius: 12, border: "1px solid rgba(47,184,218,0.25)",
  background: "radial-gradient(140% 90% at 50% 0%, rgba(47,184,218,0.05) 0%, rgba(47,184,218,0) 55%), #0b0b0b",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
};
const _panelTitle = { fontFamily: MONO, fontSize: 9.5, letterSpacing: "0.7px", color: C.celeste, textTransform: "uppercase", display: "flex", alignItems: "center" };
const _dot = <span style={{ width: 5, height: 5, borderRadius: 3, background: C.celeste, flexShrink: 0, marginRight: 6, display: "inline-block" }}/>;
// $ CRUDO (no $K-escalado) — capitalLigado.usd/subtotal vienen en dólares reales (stockUSD), NO en miles como
// venta/contribución del cuadro comercial: _fmDin de arriba asume input en $K y aquí duplicaría ×1000. Mismo
// criterio que el formatter local `usd()` de CuadroMando, factoreado para reusar acá.
const _fmUsd = (v) => { const a = Math.abs(v); return a >= 1e6 ? "$" + (a / 1e6).toFixed(1) + "M" : a >= 1e3 ? "$" + Math.round(a / 1e3) + "K" : "$" + Math.round(a); };

function _KPI({ label, value, sub, tone, def }) {
  if (value == null) return null;
  return (
    <div style={{ minWidth: 108 }}>
      <div style={{ fontSize: 10, color: C.textMuted, display: "flex", alignItems: "center", gap: 3 }}>{label}{def && <InfoDot def={def} align="left"/>}</div>
      <div style={{ fontFamily: MONO, fontSize: 15, fontWeight: 600, color: tone || C.text, fontVariantNumeric: "tabular-nums", marginTop: 2 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: C.textMuted, marginTop: 1 }}>{sub}</div>}
    </div>
  );
}

function FichaEjecutivaCliente({ name, scenario, onAsk }) {
  const prof = TOOLS.entityProfile({ dimension: "cliente", entity: name, scenario });
  if (!prof || !prof.coverage || !prof.coverage.supported) {
    return (
      <div style={_panelStyle}>
        <span style={_panelTitle}>{_dot}Ficha Ejecutiva · {name}</span>
        <div style={{ fontSize: 12, color: C.textMuted, marginTop: 8 }}>
          No tengo datos suficientes para armar la ficha ejecutiva de {name} en este escenario — {(prof && prof.coverage && prof.coverage.reason) || "sin cobertura"}.
        </div>
      </div>
    );
  }
  const f = prof.facts;
  const metric = (label) => (Array.isArray(f.metrics) ? f.metrics.find((m) => m.label === label) : null);
  const mVentas = metric("Ventas"), mMargen = metric("Margen"), mContrib = metric("Contribución"), mCarga = metric("Carga comercial");
  const comp = TOOLS.entityComposicion({ dimension: "cliente", entity: name });
  const cap = TOOLS.entityCapitalLigado({ dimension: "cliente", entity: name, scenario });
  const trV = TOOLS.trend({ metric: "ventas", dimension: "cliente", entity: name });
  const trC = TOOLS.trend({ metric: "contribucion", dimension: "cliente", entity: name });
  const trM = TOOLS.trend({ metric: "margen", dimension: "cliente", entity: name });

  const familias = (comp && comp.coverage && comp.coverage.supported) ? comp.facts.composicion.familias : [];
  const skus = (comp && comp.coverage && comp.coverage.supported) ? comp.facts.composicion.skus : [];
  const topFamilia = familias[0] || null;   // composicion.familias ya viene ordenada por venta desc (specRetrieval.js)
  // familia de margen REAL más bajo — comparando TODAS, nunca asumiendo que la de más peso lo es (owner 2026-08-07,
  // "no debe llamarse 'el margen más bajo'" — mismo candado que ya se reforzó en narratePromptC.js para el chat).
  const minMargenFamilia = familias.reduce((min, x) => (typeof x.margen === "number" && (!min || x.margen < min.margen) ? x : min), null);
  const topEsElPeor = topFamilia && minMargenFamilia && topFamilia.nombre === minMargenFamilia.nombre;

  // CAPITAL LIGADO · decisión 9 del owner (2026-08-09): la tool ya no atribuye inventario a un cliente cuando el
  // dato no sostiene esa relación — declina con la razón medida. La Ficha la MUESTRA en vez de rellenar: sin
  // relación válida no hay tabla ni acción por cliente, hay una limitación declarada.
  const _capSup = !!(cap && cap.coverage && cap.coverage.supported);
  const _capRazon = (cap && cap.coverage && cap.coverage.reason) || null;
  const items = _capSup ? cap.facts.capitalLigado.items : [];
  const _capRelacion = _capSup ? cap.facts.capitalLigado.relacion : ((cap && cap.coverage && cap.coverage.relacion) || null);
  const _capObservada = _capRelacion === "observada";
  const _capSujeto = _capObservada ? `productos que le vendes a ${name}` : `SKU asociados al surtido de ${name} por afinidad estimada`;
  const _capTitulo = !_capSup
    ? `Inventario inmovilizado y ${name}`
    : _capObservada ? `Inventario de baja rotación en productos que compra ${name}`
    : `Inventario inmovilizado asociado al surtido de ${name}`;
  const pos = f.posicionCartera || null;

  // IMPORTANCIA EN LA CARTERA + CLASIFICACIÓN (owner 2026-08-07, "diréctamente, sin jerga"): un 2×2 de VOLUMEN
  // (¿está en el grupo que concentra el 80% de la venta?) × MARGEN (¿sobre o bajo tu benchmark, la vara
  // autorizada?). Los 4 roles son los que el owner pidió, en lenguaje de dueño de negocio. El margen se juzga
  // contra el benchmark (POLICY/benchmarkOf, la MISMA vara del resto de la Ficha) — no un promedio inventado.
  const _benchNum = f.benchmarkMargen ? parseFloat(f.benchmarkMargen) : null;
  const _margenNum = mMargen && typeof mMargen.value === "number" ? mMargen.value : null;
  const _vendeMucho = !!(pos && pos.enBloque8020);
  const _buenMargen = _margenNum != null && _benchNum != null && _margenNum >= _benchNum;
  const _claseOK = pos && _margenNum != null && _benchNum != null;
  const clase = !_claseOK ? null
    : _vendeMucho && _buenMargen ? { label: "CUIDAR", desc: "Vende mucho y deja buen margen", color: C.green }
    : _vendeMucho && !_buenMargen ? { label: "RECUPERAR", desc: "Vende mucho, pero deja poco margen", color: C.amber }
    : !_vendeMucho && _buenMargen ? { label: "CRECER", desc: "Vende poco, pero deja buen margen", color: C.celeste }
    : { label: "REVISAR", desc: "Vende poco y deja poco margen", color: C.red };
  const _cierreCartera = !clase ? null
    : clase.label === "CUIDAR" ? `${name} es una cuenta importante y rentable. Protegé estas condiciones y usala de referencia para negociar con el resto.`
    : clase.label === "RECUPERAR" ? `${name} mueve mucho volumen, pero su margen está bajo tu estándar. Acá está la mayor oportunidad de recuperar rentabilidad — empieza por revisar sus acciones comerciales.`
    : clase.label === "CRECER" ? `${name} deja buen margen pero todavía pesa poco. Si sus condiciones se sostienen, es una cuenta sana para hacer crecer en volumen.`
    : `Hoy ${name} no es una cuenta importante por volumen y tampoco compensa con rentabilidad. Antes de buscar más ventas, conviene revisar si sus condiciones permiten mejorar el margen.`;

  // CAPITAL · separo lo DETENIDO (crítico) de lo de ROTACIÓN LENTA (atención) — owner pidió nombrarlo distinto.
  const _criticos = items.filter((it) => it.critico);
  const _lentos = items.filter((it) => !it.critico);
  const _sumUsd = (arr) => arr.reduce((s, it) => s + (typeof it.usd === "number" ? it.usd : 0), 0);
  const _capTopMonto = items.length ? items.slice().sort((a, b) => (b.usd || 0) - (a.usd || 0))[0] : null;
  const _capConDias = items.filter((it) => typeof it.diasSinVenta === "number");
  const _capTopDias = _capConDias.length ? _capConDias.slice().sort((a, b) => b.diasSinVenta - a.diasSinVenta)[0] : null;

  const _ask = (q) => {
    setUISignal({ ficha: { cliente: name, dimension: "cliente", scenario, origen: "ficha_ejecutiva" } });
    if (onAsk) onAsk(q);
  };
  const _btn = (label, q) => onAsk ? (
    <button onClick={() => _ask(q)} style={{ background: "transparent", border: "none", color: C.celeste, fontSize: 10.5, fontWeight: 600, cursor: "pointer", padding: 0, fontFamily: "'DM Sans', system-ui, sans-serif", whiteSpace: "nowrap" }}>{label}</button>
  ) : null;

  // TABLA DE COMPOSICIÓN alineada (owner 2026-08-07, "son los mismos campos pero están desordenados"): familia y
  // SKU comparten EL MISMO colgroup de anchos fijos (tableLayout:fixed) → las columnas caen en la misma posición.
  // + Unidades y Rotación (conecta con el inventario inmovilizado: rotación bajo tu piso, en rojo, es la que se
  // detiene). Rotación baja = C.red (mismo criterio POLICY.rotacionMin que el detector de capital).
  const _compTh = { color: C.textMuted, fontFamily: MONO, fontSize: 9.5, textTransform: "uppercase", letterSpacing: "0.5px", borderBottom: `1px solid ${C.border}`, padding: "4px 6px" };
  const _compTd = { padding: "5px 6px", textAlign: "right", fontFamily: MONO, fontVariantNumeric: "tabular-nums", overflow: "hidden", textOverflow: "ellipsis" };
  const _compCols = ["19%", "12%", "12%", "14%", "11%", "15%", "17%"];
  const _compTable = (rows, firstLabel, sub) => (
    <div style={{ marginTop: 10, overflowX: "auto" }}>
      <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 5 }}>{sub}</div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5, minWidth: 560, tableLayout: "fixed" }}>
        <colgroup>{_compCols.map((w, i) => <col key={i} style={{ width: w }}/>)}</colgroup>
        <thead><tr>
          <th style={{ ..._compTh, textAlign: "left" }}>{firstLabel}</th>
          {["Participación", "Venta", "Contribución", "Margen", "Unidades", "Rotación"].map((h) => <th key={h} style={{ ..._compTh, textAlign: "right" }}>{h}</th>)}
        </tr></thead>
        <tbody>{rows.map((row) => {
          const bajoBench = typeof row.margen === "number" && f.benchmarkMargen && row.margen < parseFloat(f.benchmarkMargen);
          const rotBaja = typeof row.rotacion === "number" && row.rotacion < POLICY.rotacionMin;
          return (
            <tr key={row.nombre}>
              <td style={{ padding: "5px 6px", color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.nombre}</td>
              <td style={{ ..._compTd, color: C.textSub }}>{row.share}%</td>
              <td style={{ ..._compTd, color: C.textSub }}>{row.venta}</td>
              <td style={{ ..._compTd, color: C.textSub }}>{row.contribucion}</td>
              <td style={{ ..._compTd, color: bajoBench ? C.amber : C.text }}>{row.margen != null ? `${row.margen}%` : "—"}</td>
              <td style={{ ..._compTd, color: C.textSub }}>{typeof row.unidades === "number" ? row.unidades.toLocaleString("es-CL") : "—"}</td>
              <td style={{ ..._compTd, color: rotBaja ? C.red : C.textSub }}>{typeof row.rotacion === "number" ? `${row.rotacion}x` : "—"}</td>
            </tr>
          );
        })}</tbody>
      </table>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* 1 · ENCABEZADO EJECUTIVO */}
      <div style={_panelStyle}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
          <span style={_panelTitle}>{_dot}Ficha Ejecutiva · {name}</span>
          {_btn("Preguntar a ADI sobre esta cuenta →", `Muéstrame el perfil de ${name}`)}
        </div>
        <div style={{ fontSize: 12.5, color: C.textSub, lineHeight: 1.6, marginTop: 8 }}>
          {name} vende {mVentas ? mVentas.fmt : "—"}
          {trV && trV.facts && trV.facts.variacionAnual ? <> ({trV.facts.variacionAnual.pct} vs año anterior)</> : null}
          {mMargen ? <>, con margen {mMargen.fmt}</> : null}
          {f.brechaMargen ? <> — {f.brechaMargen} bajo tu benchmark de {f.benchmarkMargen}</> : (f.benchmarkMargen ? <> — sobre tu benchmark de {f.benchmarkMargen}</> : null)}.
        </div>
      </div>

      {/* 2 · KPIs */}
      <div style={_panelStyle}>
        <span style={_panelTitle}>{_dot}Cifras clave · 12 meses</span>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 18, marginTop: 10 }}>
          <_KPI label="Ventas (12 meses)" value={mVentas && mVentas.fmt} sub={trV && trV.facts && trV.facts.variacionAnual ? `${trV.facts.variacionAnual.pct} vs año anterior` : "sin año anterior declarado"}/>
          <_KPI label="Margen" value={mMargen && mMargen.fmt} tone={f.brechaMargen ? C.red : C.green} sub={f.benchmarkMargen ? `benchmark ${f.benchmarkMargen}` : null}/>
          <_KPI label="Contribución" value={mContrib && mContrib.fmt}/>
          <_KPI label="Acciones comerciales" value={mCarga && mCarga.fmt} sub={f.targetCarga ? `meta ${f.targetCarga}` : null}/>
          <_KPI label="Ticket promedio" value={f.ticketPromedio} def="Precio promedio realizado (venta ÷ unidades) — no es un ticket transaccional real, el dato no trae número de operaciones."/>
        </div>
      </div>

      {/* 3 · QUÉ EXPLICA LA BRECHA — probado / indicado / abierto (nunca confunde el mecanismo con el total) */}
      {f.brechaMargen && (
        <div style={_panelStyle}>
          <span style={_panelTitle}>{_dot}Qué explica la brecha de margen</span>
          <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 9, fontSize: 12, color: C.textSub, lineHeight: 1.55 }}>
            {f.excesoAccionesComerciales && (
              <div><span style={{ color: C.green, fontFamily: MONO, fontSize: 9.5, fontWeight: 600, letterSpacing: "0.5px", textTransform: "uppercase", marginRight: 6 }}>Probado</span>
                Cerrar el exceso de acciones comerciales sobre tu meta ({f.targetCarga}) libera <b style={{ color: C.text }}>{f.excesoAccionesComerciales}</b> — hoy tu carga comercial es {mCarga ? mCarga.fmt : "—"}.</div>
            )}
            {topFamilia && (
              <div><span style={{ color: C.amber, fontFamily: MONO, fontSize: 9.5, fontWeight: 600, letterSpacing: "0.5px", textTransform: "uppercase", marginRight: 6 }}>Indicado</span>
                La familia con más peso, <b style={{ color: C.text }}>{topFamilia.nombre}</b> ({topFamilia.share}% de la compra), tiene margen {topFamilia.margen}%{f.benchmarkMargen ? <> — {topFamilia.margen < parseFloat(f.benchmarkMargen) ? "bajo" : "sobre"} tu benchmark de {f.benchmarkMargen}</> : null}{topEsElPeor ? <>, la más baja de sus {familias.length} familias</> : null}.</div>
            )}
            <div><span style={{ color: C.textMuted, fontFamily: MONO, fontSize: 9.5, fontWeight: 600, letterSpacing: "0.5px", textTransform: "uppercase", marginRight: 6 }}>Abierto</span>
              La brecha total contra tu benchmark es {f.brechaMargen}. El exceso de acciones comerciales explica una parte comprobada; el resto no tiene una causa aislada en el dato disponible (la combinación de productos, el costo u otros factores no separables con lo que hay).</div>
          </div>
        </div>
      )}

      {/* 4 · EVOLUCIÓN MENSUAL — venta con año anterior (única serie con ancla), contribución/margen honestos sin ella */}
      <ComparadoCard a={name} rowA={{ varaRef: f.benchmarkMargen ? parseFloat(f.benchmarkMargen) : null }} dim="cliente" onAsk={onAsk}/>

      {/* 5 · COMPOSICIÓN — familia y SKU con LAS MISMAS columnas alineadas (colgroup fijo compartido) +
          Unidades + Rotación (conecta con el inventario inmovilizado de abajo) */}
      <div style={_panelStyle}>
        <span style={_panelTitle}>{_dot}Composición de la compra</span>
        {familias.length === 0 && skus.length === 0 ? (
          <div style={{ fontSize: 12, color: C.textMuted, marginTop: 8 }}>
            No tengo la composición de la compra de {name} por familia o SKU en este escenario — queda abierto.
          </div>
        ) : (
          <>
            {familias.length > 0 && _compTable(familias, "Familia", "Por familia")}
            {skus.length > 0 && _compTable(skus.slice(0, 10), "SKU", `Por SKU (top ${Math.min(10, skus.length)} de ${skus.length})`)}
            <div style={{ fontSize: 10.5, color: C.textMuted, marginTop: 8, lineHeight: 1.5 }}>
              Unidades = reparto de las unidades del cliente según su venta (cierran con su total). Rotación = veces al año que rota el producto en tu inventario; <span style={{ color: C.red }}>en rojo</span> la que está bajo tu piso de {POLICY.rotacionMin}x — es la que después aparece inmovilizada abajo.
            </div>
            {_btn(`Pídele a ADI que profundice en la composición de ${name} →`, `¿Cómo se compone ${name}?`)}
          </>
        )}
      </div>

      {/* 6 · IMPORTANCIA EN LA CARTERA + CLASIFICACIÓN (owner 2026-08-07): el veredicto de 2 dimensiones
          (volumen × margen) en lenguaje directo — la chip del rol arriba, la lectura y los 3 datos que la
          respaldan debajo, y el cierre ejecutivo. Sin "rezagado"/"relevancia": ranking directo + sobre/bajo
          benchmark. */}
      <div style={_panelStyle}>
        <span style={_panelTitle}>{_dot}Importancia de {name} en tu cartera</span>
        {!pos ? (
          <div style={{ fontSize: 12, color: C.textMuted, marginTop: 8 }}>
            No tengo la posición de {name} en la cartera en este escenario — queda abierto.
          </div>
        ) : (
          <>
            {clase && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: "0.8px", color: "#0b0b0b", background: clase.color, padding: "3px 10px", borderRadius: 6 }}>{clase.label}</span>
                <span style={{ fontSize: 12.5, color: C.text, fontWeight: 600 }}>{clase.desc}</span>
                <InfoDot def={"El rol de la cuenta en un cuadro simple: CUIDAR (vende mucho y deja buen margen) · RECUPERAR (vende mucho, pero deja poco margen) · CRECER (vende poco, pero deja buen margen) · REVISAR (vende poco y deja poco margen). Volumen = si la cuenta está en el grupo que concentra el 80% de tu venta; margen = si está sobre o bajo tu benchmark."} align="left"/>
              </div>
            )}
            <div style={{ fontSize: 12.5, color: C.textSub, lineHeight: 1.6, marginTop: 9 }}>
              {name} {_vendeMucho ? "es una de tus cuentas de mayor volumen" : "vende poco frente al resto de tu cartera"}
              {_margenNum != null && _benchNum != null ? <> y {_buenMargen ? "su margen supera tu benchmark" : "su margen está por debajo de tu benchmark"}</> : null}.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 9, fontSize: 12, color: C.textSub, lineHeight: 1.5 }}>
              <div><span style={{ color: C.textMuted }}>Ventas:</span> {pos.rankingVenta}º de {pos.totalClientes} clientes.</div>
              <div><span style={{ color: C.textMuted }}>Peso en la cartera:</span> {_vendeMucho ? "dentro" : "fuera"} del grupo que concentra el 80% de las ventas.</div>
              {_margenNum != null && _benchNum != null && (
                <div><span style={{ color: C.textMuted }}>Margen:</span> {_buenMargen ? "sobre" : "bajo"} tu benchmark de {f.benchmarkMargen}{pos.rankingMargenDesdeAbajo ? ` (${pos.rankingMargenDesdeAbajo}º más bajo de ${pos.totalConMargen})` : ""}.</div>
              )}
            </div>
            {_cierreCartera && (
              <div style={{ fontSize: 12, color: C.text, lineHeight: 1.55, marginTop: 10, paddingLeft: 10, borderLeft: `2px solid ${clase ? clase.color : C.celeste}` }}>{_cierreCartera}</div>
            )}
          </>
        )}
      </div>

      {/* 7 · INVENTARIO INMOVILIZADO Y ESTE CLIENTE — SKU/bodega/valorizado/unidades/estado, severidad
          detenido/crítico(rojo) vs rotación lenta/atención(ámbar). Owner 2026-08-07: título directo, lectura que
          separa lo detenido de lo de rotación lenta, cierre con la prioridad concreta.
          DECISIÓN 9 (owner 2026-08-09): el título y la lectura los manda la RELACIÓN que declara la tool, no el
          supuesto de que exista. Sin relación válida en el dato no hay tabla ni prioridad por cliente: se declara
          la limitación con la razón medida y se remite a la cara Capital, que es donde ese inventario sí tiene
          dueño (el negocio). Antes esta tarjeta mostraba el inventario global con el nombre de cada cliente
          encima — el mismo subtotal y los mismos SKU para las 13 cuentas. */}
      <div style={_panelStyle}>
        <span style={_panelTitle}>{_dot}{_capTitulo}</span>
        {!_capSup ? (
          <div style={{ fontSize: 12, color: C.textMuted, marginTop: 8, lineHeight: 1.55 }}>
            {_capRazon ? <>{_capRazon}.</> : <>El dato disponible no permite atribuir inventario inmovilizado a {name}.</>}
            {" "}El capital inmovilizado del negocio se lee completo en la cara Capital, por bodega y por antigüedad.
          </div>
        ) : items.length > 0 ? (
          <>
            <div style={{ marginTop: 10, overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5, minWidth: 420 }}>
                <thead><tr>{["SKU", "Bodega", "Valorizado", "Unidades", "Estado"].map((h, i) => (
                  <th key={h} style={{ textAlign: i === 0 ? "left" : "right", color: C.textMuted, fontFamily: MONO, fontSize: 9.5, textTransform: "uppercase", letterSpacing: "0.5px", borderBottom: `1px solid ${C.border}`, padding: "4px 6px" }}>{h}</th>
                ))}</tr></thead>
                <tbody>{items.map((it) => (
                  <tr key={it.sku}>
                    <td style={{ padding: "5px 6px", color: C.text }}>{it.sku}</td>
                    <td style={{ padding: "5px 6px", textAlign: "right", color: C.textSub }}>{it.bodega}</td>
                    <td style={{ padding: "5px 6px", textAlign: "right", fontFamily: MONO, color: C.text, fontVariantNumeric: "tabular-nums" }}>{_fmUsd(it.usd)}</td>
                    <td style={{ padding: "5px 6px", textAlign: "right", fontFamily: MONO, color: C.textSub, fontVariantNumeric: "tabular-nums" }}>{it.unidades ?? "—"}</td>
                    <td style={{ padding: "5px 6px", textAlign: "right" }}>
                      <span style={{ fontFamily: MONO, fontSize: 10.5, color: it.critico ? C.red : C.amber }}>
                        {it.critico ? "crítico" : "atención"}{typeof it.diasSinVenta === "number" ? ` · ${it.diasSinVenta}d sin venta` : ""}
                      </span>
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            <div style={{ fontSize: 12, color: C.textSub, lineHeight: 1.55, marginTop: 8 }}>
              {_criticos.length > 0 && _lentos.length > 0
                ? <>Tienes <b style={{ color: C.text }}>{_fmUsd(_sumUsd(_criticos))}</b> inmovilizados y otros <b style={{ color: C.text }}>{_fmUsd(_sumUsd(_lentos))}</b> con rotación lenta en {_capSujeto}.</>
                : _criticos.length > 0
                  ? <>Tienes <b style={{ color: C.text }}>{_fmUsd(_sumUsd(_criticos))}</b> inmovilizados en {_capSujeto}.</>
                  : <>Tienes <b style={{ color: C.text }}>{_fmUsd(_sumUsd(_lentos))}</b> con rotación lenta en {_capSujeto}.</>}
              {" "}Es capital de tu negocio, no de {name}.
              {!_capObservada ? <> La asociación con {name} es una estimación de afinidad, no una venta registrada.</> : null}
            </div>
            {_capTopMonto && (
              <div style={{ fontSize: 12, color: C.text, lineHeight: 1.55, marginTop: 8, paddingLeft: 10, borderLeft: `2px solid ${C.celeste}` }}>
                {_capTopDias && _capTopDias.sku !== _capTopMonto.sku
                  ? <>Prioriza <b>{_capTopMonto.sku}</b> por el monto ({_fmUsd(_capTopMonto.usd)}) y <b>{_capTopDias.sku}</b> por llevar {_capTopDias.diasSinVenta} días sin venta.</>
                  : <>Prioriza <b>{_capTopMonto.sku}</b>: es el mayor monto ({_fmUsd(_capTopMonto.usd)}){typeof _capTopMonto.diasSinVenta === "number" ? <> y lleva {_capTopMonto.diasSinVenta} días sin venta</> : null}.</>}
              </div>
            )}
            {_btn(`Pídele a ADI el detalle de este inventario →`, `¿Qué capital tienes inmovilizado en ${_capSujeto}?`)}
          </>
        ) : (
          <div style={{ fontSize: 12, color: C.textMuted, marginTop: 8 }}>
            Ningún SKU de los {_capSujeto} está hoy inmovilizado ni con rotación lenta según tu benchmark de rotación y días de inventario.
          </div>
        )}
      </div>
    </div>
  );
}

// ── CARA FICHA (owner 2026-08-07, "no debe ir mezclada con lo que ya teníamos — debe ser su propia pestaña"):
// la Ficha Ejecutiva de cliente vive en su PROPIA cara de la Mesa, junto a Comercial/Capital/Resultado —
// selector de cliente + SOLO FichaEjecutivaCliente, sin el Cuadro de Mando/Pareto/Comparado genéricos de la
// cara Comercial encima. El deep-link del perfil único (clientMesaLink, "dame el perfil de X") abre esta cara
// directo con el cliente ya elegido — ver el switch de `cara` en MesaPanel.
function MesaFichaCara({ entity, scenario, onAsk, onSelect }) {
  const cm = React.useMemo(() => buildCuadroMando("cliente", scenario), [scenario]);
  const names = cm.rows.map((r) => r.name);
  /* ── EMISIÓN DEL CONTEXTO · cara Ficha ────────────────────────────────────────────────────────────────────
   * Acá el contexto lleva algo que ninguna otra cara lleva: UNA entidad. Se deriva de la lectura del módulo
   * (buildReadingFromSignals sobre las señales de contribución del cliente) — el mismo builder que el manifiesto
   * declara —, así que el sujeto sale del dato y no de la UI. Sin cliente elegido no hay contexto de ficha: no
   * hay ficha que explicar. */
  const rdFicha = React.useMemo(() => {
    if (!entity) return null;
    try { return buildReadingFromSignals(buildClientContribSignals(entity, scenario)); } catch { return null; }
  }, [entity, scenario]);
  const { ask: askFicha } = useViewContext("ficha/otro/ficha-cliente", rdFicha, {
    scenario, onAsk, ambient: true,
    seleccion: entity ? { modo: "explicita", n: 1, entidades: [entity] } : null,
  });
  const [busca, setBusca] = useState("");
  const _normB = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const filtered = busca.trim() ? names.filter((n) => _normB(n).includes(_normB(busca))) : names;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <div style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: "0.7px", color: C.textMuted, textTransform: "uppercase", marginBottom: 8 }}>Elige un cliente</div>
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="buscar cliente…"
          style={{ width: "100%", maxWidth: 280, padding: "6px 10px", borderRadius: 7, border: `1px solid ${C.border}`, background: "rgba(255,255,255,0.02)", color: C.text, fontSize: 12, fontFamily: "'DM Sans', system-ui, sans-serif", outline: "none", marginBottom: 9 }}/>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {filtered.map((n) => (
            <button key={n} onClick={() => onSelect(n)}
              style={{ padding: "5px 12px", borderRadius: 7, border: `1px solid ${n === entity ? "rgba(47,184,218,0.5)" : C.border}`, background: n === entity ? "rgba(47,184,218,0.1)" : "transparent", color: n === entity ? C.celeste : C.textSub, fontSize: 11.5, fontWeight: n === entity ? 600 : 400, cursor: "pointer", fontFamily: "'DM Sans', system-ui, sans-serif" }}>
              {n}
            </button>
          ))}
          {filtered.length === 0 && <span style={{ fontSize: 11.5, color: C.textMuted }}>Sin coincidencias.</span>}
        </div>
      </div>
      {entity ? <FichaEjecutivaCliente name={entity} scenario={scenario} onAsk={askFicha || onAsk}/> : (
        <div style={{ fontSize: 12, color: C.textMuted }}>Elige un cliente arriba para ver su Ficha Ejecutiva.</div>
      )}
    </div>
  );
}

function MesaFicha({ name, row, columns, allRows, dim, dimLabel, onAsk }) {
  // el Pareto vive AFUERA (MesaPareto · reflejo de la tabla, owner 2026-07-10) — la ficha suma perfil + evolutivo.
  // La FICHA EJECUTIVA real de cliente (owner 2026-08-07: "no debe ir mezclada con lo que ya teníamos, debe ser
  // su propia pestaña") vive en su PROPIA cara de la Mesa (MesaFichaCara, ver el selector "Ficha" del
  // encabezado) — acá, dentro del Cuadro de Mando, la selección de fila sigue mostrando SOLO el perfil genérico
  // vs-promedio (mismo comportamiento para cliente/marca/familia/SKU, sin mezclar vistas).
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:8, flexWrap:"wrap" }}>
        <div style={{ fontFamily:MONO, fontSize:10, letterSpacing:"0.8px", color:C.text, textTransform:"uppercase" }}>
          <span style={{ color:C.celeste }}>Ficha</span> · {name} <span style={{ color:C.textMuted }}>({dimLabel})</span>
        </div>
        {onAsk ? (
          <button onClick={() => onAsk(`Profundiza en ${name}`)} style={{ background:"transparent", border:"none", color:C.celeste, fontSize:11, fontWeight:600, cursor:"pointer", padding:0, fontFamily:"'DM Sans', system-ui, sans-serif" }}>
            Pídele a ADI que profundice en {name} →
          </button>
        ) : null}
      </div>
      {/* PASE 1c: el comparado (ex FichaEvolutivo) subió ARRIBA de la tabla (owner) — la ficha queda perfil + composición */}
      <MesaPerfil name={name} row={row} columns={columns} allRows={allRows} dim={dim} onAsk={onAsk}/>
    </div>
  );
}

// (los keyframes adi* los inyecta el import de InlineChart.jsx — set completo, una sola fuente)
function MesaPerfil({ name, row, columns = null, allRows = [], dim = "cliente", onAsk }) {
  const fm = (v) => "$" + (v / 1000).toFixed(1) + "M";
  const fmk = (v) => "$" + (Math.abs(v) / 1000).toFixed(1) + "K";
  const fp = (v) => p1(v) + "%";
  const fmtOf = { money: fm, moneyk: fmk, pct: fp, x: (v) => r1(v) + "x", int: (v) => Math.round(v).toLocaleString("es-CL"), pp: (v) => p1(v) + "pp" };
  if (!row) return null;
  // filas = columnas numéricas del cuadro (sin acción/gap/pp ni la capa del asesor — "En juego $" no es una métrica
  // de la entidad, es la lectura del detector · el "vs prom" es redundante: el promedio ES el eje)
  const axes = (columns || []).filter((c) => c.key !== "accion" && c.key !== "gap" && c.fmt !== "pp" && !c.adv).map((c) => {
    const vs = allRows.map((r) => r[c.key]).filter((v) => typeof v === "number");
    return { key: c.key, label: c.label, va: row[c.key], vp: vs.length ? vs.reduce((s, v) => s + v, 0) / vs.length : null,
      fmt: fmtOf[c.fmt] || ((v) => String(v)), hiBetter: c.sort !== "asc",
      ...(c.key === "margen" ? { ref: benchmarkOf(null), refLabel: "piso" } : {}),
      ...(c.key === "rotacion" ? { ref: POLICY.rotacionMin, refLabel: "piso" } : {}) };
  }).filter((ax) => typeof ax.va === "number" && typeof ax.vp === "number" && Math.abs(ax.vp) > 0);
  if (axes.length < 2) return null;
  const filas = axes.map((ax) => {
    const dev = ((ax.va - ax.vp) / Math.abs(ax.vp)) * 100;      // % de desvío vs promedio
    const mejor = ax.hiBetter ? dev >= 0 : dev <= 0;            // geometría normalizada a CALIDAD
    return { ...ax, dev, mejor, mag: Math.abs(dev) };
  });
  const maxMag = Math.max(...filas.map((f) => f.mag), 1);
  const score = filas.filter((f) => f.mejor && f.dev !== 0).length;
  const varas = filas.filter((f) => f.ref != null);
  const MONOF = "'JetBrains Mono', ui-monospace, monospace";
  const hdr = { fontFamily: MONOF, fontSize: 8.5, letterSpacing: "0.8px", color: C.textMuted, textTransform: "uppercase", textAlign: "right", borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: 3 };
  return (
    <div style={{ padding: "14px 16px 12px", borderRadius: 12, border: "1px solid rgba(47,184,218,0.25)",
      background: "radial-gradient(140% 90% at 50% 0%, rgba(47,184,218,0.05) 0%, rgba(47,184,218,0) 55%), #0b0b0b",
      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
        <span style={{ fontFamily: MONOF, fontSize: 9.5, letterSpacing: "0.7px", color: C.celeste, textTransform: "uppercase", display: "flex", alignItems: "center" }}>
          <span style={{ width: 5, height: 5, borderRadius: 3, background: C.celeste, flexShrink: 0, marginRight: 6, display: "inline-block" }}/>
          Perfil vs promedio
          <InfoDot def={"El perfil de la entidad contra el PROMEDIO de su eje. El eje central es el promedio: barra a la derecha (verde) = mejor que el promedio, a la izquierda (rojo) = peor — vale también para métricas donde menos es mejor (la geometría ya lo considera). Tu benchmark (piso/target) queda declarado abajo. Selecciona una segunda fila y pasa a la comparación A vs B."} align="left"/>
        </span>
        <span style={{ fontFamily: MONOF, fontSize: 10, color: C.textMuted }}>
          <span style={{ color: C.elec, fontWeight: 600 }}>{name}</span> sobre el promedio en {score} de {filas.length}
        </span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(80px, 128px) minmax(40px, 1fr) auto auto", columnGap: 8, rowGap: 5, alignItems: "center", marginTop: 6 }}>
        <span style={hdr}/>
        <span style={{ ...hdr, textAlign: "center" }}>← peor · prom · mejor →</span>
        <span style={hdr}>{name.length > 10 ? "Valor" : name}</span>
        <span style={hdr}>Prom</span>
        {filas.map((f, i) => {
          const w = Math.max(1.5, (f.mag / maxMag) * 50);
          const grad = f.mejor
            ? "linear-gradient(90deg, rgba(16,185,129,0.6), rgba(16,185,129,0.18))"
            : "linear-gradient(270deg, rgba(244,63,94,0.6), rgba(244,63,94,0.18))";
          return (
            <React.Fragment key={f.key}>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 11.5, color: C.textSub, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.label}</span>
                {!f.hiBetter && <span style={{ display: "block", fontFamily: MONOF, fontSize: 8, color: C.textMuted, whiteSpace: "nowrap" }}>menos = mejor</span>}
              </span>
              <div style={{ position: "relative", alignSelf: "stretch", minHeight: 17 }}>
                <div style={{ position: "absolute", left: "50%", top: -3, bottom: -3, width: 1, background: "rgba(255,255,255,0.18)" }}/>
                <div style={{ position: "absolute", top: "50%", marginTop: -4, height: 8, borderRadius: 2,
                  width: `${w}%`, left: f.mejor ? "50%" : `${50 - w}%`, background: grad,
                  transformOrigin: f.mejor ? "left center" : "right center", animation: `adiRise 420ms cubic-bezier(.2,.7,.3,1) ${i * 40}ms both` }}/>
              </div>
              <span style={{ fontFamily: MONOF, fontSize: 11, fontWeight: 600, color: f.dev === 0 ? C.text : f.mejor ? C.green : C.red, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{f.fmt(f.va)}</span>
              <span style={{ fontFamily: MONOF, fontSize: 10, color: C.textMuted, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{f.fmt(f.vp)}</span>
            </React.Fragment>
          );
        })}
      </div>
      {/* la VARA del owner declarada (POLICY · una verdad) — el promedio no reemplaza tu piso */}
      {varas.length > 0 && (
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 7, fontSize: 10.5, color: C.textMuted, flexWrap: "wrap" }}>
          {varas.map((f) => (
            <span key={"v" + f.key} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 12, height: 0, borderTop: `1.5px dashed ${C.amber}`, opacity: 0.9 }}/>
              <span style={{ color: C.amber }}>{f.label.toLowerCase()} {f.refLabel} {f.fmt(f.ref)}</span>
              <span>· {name} {(f.hiBetter ? f.va >= f.ref : f.va <= f.ref) ? "sobre" : "bajo"} el benchmark</span>
            </span>
          ))}
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
        <span style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 10.5, color: C.textMuted }}>
          el eje central es el promedio del eje · <span style={{ color: C.green }}>derecha = mejor</span> · <span style={{ color: C.red }}>izquierda = peor</span>
        </span>
        {onAsk ? (
          <button onClick={() => onAsk(`Profundiza en ${name}`)} style={{ background: "transparent", border: "none", color: C.celeste, fontSize: 10.5, fontWeight: 600, cursor: "pointer", padding: 0, fontFamily: "'DM Sans', system-ui, sans-serif", whiteSpace: "nowrap" }}>
            Pídele a ADI que profundice en {name} →
          </button>
        ) : null}
      </div>
    </div>
  );
}

// ── LA HISTORIA · evolutivo GLOBAL de ventas (dato real) · honestidad aplicada al tiempo (paso 4) ──
// Dibuja SOLO lo que el dato sostiene: la película global de ventas (ventasMensuales). Cada cifra cierra con su
// serie (regla madre). El por-entidad se bloquea honesto (nota al pie). SVG custom · sin librería gráfica.
function Stat({ label, v, sub, color }) {
  return (
    <div>
      <div style={{ fontSize:10.5, color:C.textMuted }}>{label}</div>
      <div style={{ display:"flex", alignItems:"baseline", gap:6, marginTop:2 }}>
        <Num color={color || C.text} size="1.05em">{v}</Num>
        {sub && <span style={{ fontSize:9.5, color:C.textMuted, fontFamily:MONO }}>{sub}</span>}
      </div>
    </div>
  );
}

function EvolutivoCard() {
  const ev = buildGlobalEvolution();
  const [view, setView] = useState("comp");                                  // "comp" 12m·3 series · "seq" 24m
  const [show, setShow] = useState({ actual:true, anterior:false, presupuesto:true });
  const [hov, setHov] = useState(null);                                      // mes bajo el cursor (tooltip)
  const W = 540, H = 172, padL = 36, padR = 12, padT = 12, padB = 22;

  const SER = [
    { key:"actual",      label:"Este año",     color:C.elec, data:ev.actual,      dashed:false },
    { key:"anterior",    label:"Año anterior", color:C.teal, data:ev.anterior,    dashed:true  },
    { key:"presupuesto", label:"Presupuesto",  color:C.lav,  data:ev.presupuesto, dashed:true  },
  ];
  const comp = view === "comp";
  const lines = comp ? SER.filter((s) => show[s.key])
                     : [{ key:"seq", label:"Ventas · 24 meses", color:C.elec, data:ev.seq24.map((p)=>p.v), dashed:false }];
  const xlabels = comp ? ev.meses : ev.seq24.map((p) => p.mes);
  const allVals = lines.flatMap((l) => l.data);
  const lo0 = allVals.length ? Math.min(...allVals) : 0, hi0 = allVals.length ? Math.max(...allVals) : 1;
  const niceLo = Math.floor(lo0 / 1000) * 1000, niceHi = Math.ceil(hi0 / 1000) * 1000;
  const padY = (niceHi - niceLo) * 0.08 || 1, ylo = niceLo - padY, yhi = niceHi + padY;
  const npts = xlabels.length || 1;
  const xAt = (i) => padL + (npts <= 1 ? 0 : (i / (npts - 1)) * (W - padL - padR));
  const yAt = (v) => padT + (1 - (v - ylo) / (yhi - ylo)) * (H - padT - padB);
  const dPath = (data) => data.map((v, i) => `${i === 0 ? "M" : "L"}${xAt(i).toFixed(1)},${yAt(v).toFixed(1)}`).join(" ");

  const aIdxMax = ev.actual.indexOf(ev.max), aIdxMin = ev.actual.indexOf(ev.min);
  const xi = (mi) => comp ? mi : ev.n + mi;                                   // en seq, el año actual arranca tras los 12
  const showMarks = comp ? show.actual : true;
  const grid = [niceHi, (niceHi + niceLo) / 2, niceLo];
  const stepX = (W - padL - padR) / Math.max(npts - 1, 1);

  // tooltip al PARAR EN LA CURVA (hover) · mes, valor, vs mes ant., vs ppto, lectura si el dato la sostiene
  let tip = null;
  if (hov != null && comp && show.actual) {
    const i = hov, v = ev.actual[i];
    const dPrev = i > 0 ? v - ev.actual[i - 1] : null;
    const dPrevPct = (i > 0 && ev.actual[i - 1]) ? r1((v - ev.actual[i - 1]) / ev.actual[i - 1] * 100) : null;
    const dPpto = v - ev.presupuesto[i], dPptoPct = ev.presupuesto[i] ? r1((v - ev.presupuesto[i]) / ev.presupuesto[i] * 100) : 0;
    let lect = "";
    if (i === aIdxMax) lect = "pico del año"; else if (i === aIdxMin) lect = "piso del año";
    else if (ev.meses[i] === ev.drop.mes) lect = "mayor caída"; else if (ev.meses[i] === ev.growth.mes) lect = "mayor salto";
    tip = { i, v, dPrev, dPrevPct, dPpto, dPptoPct, lect, mes: ev.meses[i] };
  }
  const TW = 134, TH = tip ? (35 + (tip.dPrev != null ? 13 : 0) + (tip.lect ? 13 : 0)) : 0;
  const tipX = tip ? Math.min(Math.max(xAt(tip.i) - TW / 2, 2), W - TW - 2) : 0;
  const tipY = tip ? Math.max(yAt(tip.v) - TH - 10, 2) : 0;

  const Chip = ({ on, color, label, onClick }) => (
    <button onClick={onClick} style={{ display:"flex", alignItems:"center", gap:5, padding:"3px 8px", borderRadius:5, cursor:"pointer", fontSize:10.5, fontFamily:"'DM Sans', system-ui, sans-serif", background: on ? "rgba(255,255,255,0.05)" : "transparent", border:`1px solid ${on?C.borderLight:C.border}`, color: on?C.textSub:C.textMuted, opacity: on?1:0.55 }}>
      <span style={{ width:9, height:2.5, borderRadius:2, background:color, flexShrink:0 }}/>{label}
    </button>
  );

  return (
    <Card>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:8, marginBottom:8 }}>
        <Eyebrow def={METRIC_DEFS["Evolución del negocio"]}>Evolución del negocio · ventas</Eyebrow>
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <span style={{ fontFamily:MONO, fontSize:8.5, fontWeight:600, color:C.green, textTransform:"uppercase", letterSpacing:"0.7px", padding:"2px 6px", borderRadius:4, background:"rgba(16,185,129,0.08)", border:"1px solid rgba(16,185,129,0.16)" }}>dato real</span>
          {["comp","seq"].map((vv) => (
            <button key={vv} onClick={()=>{setView(vv);setHov(null);}} style={{ padding:"3px 8px", borderRadius:5, cursor:"pointer", fontSize:10.5, fontFamily:"'DM Sans', system-ui, sans-serif", background: view===vv?"rgba(255,255,255,0.1)":"transparent", border:`1px solid ${view===vv?"rgba(255,255,255,0.4)":C.border}`, color: view===vv?C.text:C.textMuted }}>{vv==="comp"?"12 meses":"24 meses"}</button>
          ))}
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} style={{ width:"100%", height:"auto", display:"block" }} onMouseLeave={()=>setHov(null)}>
        <defs>
          <linearGradient id="evoArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3d74f5" stopOpacity="0.18"/>
            <stop offset="100%" stopColor="#3d74f5" stopOpacity="0"/>
          </linearGradient>
        </defs>
        {grid.map((gv,i)=>(
          <g key={"g"+i}>
            <line x1={padL} y1={yAt(gv)} x2={W-padR} y2={yAt(gv)} stroke={C.border} strokeWidth="1" strokeDasharray="3 4"/>
            <text x={padL-5} y={yAt(gv)+3} fill={C.textMuted} fontSize="8" fontFamily={MONO} textAnchor="end">{fMon(gv)}</text>
          </g>
        ))}
        {comp && show.actual && (
          <path d={`${ev.actual.map((v,i)=>`${i===0?"M":"L"}${xAt(i).toFixed(1)},${yAt(v).toFixed(1)}`).join(" ")} L${xAt(ev.actual.length-1).toFixed(1)},${(H-padB).toFixed(1)} L${xAt(0).toFixed(1)},${(H-padB).toFixed(1)} Z`} fill="url(#evoArea)" stroke="none"/>
        )}
        {!comp && (   // 24 meses · misma sombra (área bajo la curva) que la vista de 12m
          <path d={`${lines[0].data.map((v,i)=>`${i===0?"M":"L"}${xAt(i).toFixed(1)},${yAt(v).toFixed(1)}`).join(" ")} L${xAt(lines[0].data.length-1).toFixed(1)},${(H-padB).toFixed(1)} L${xAt(0).toFixed(1)},${(H-padB).toFixed(1)} Z`} fill="url(#evoArea)" stroke="none"/>
        )}
        {lines.map((l) => (
          <path key={l.key} d={dPath(l.data)} fill="none" stroke={l.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={l.dashed?"5 3":"none"} opacity={l.dashed?0.65:1} style={{ filter: l.dashed ? "none" : `drop-shadow(0 0 5px ${l.color}66)` }}/>
        ))}
        {comp && show.actual && ev.actual.map((v,i)=>(
          <circle key={"d"+i} cx={xAt(i)} cy={yAt(v)} r={hov===i?3.5:2} fill={hov===i?C.elec:C.surface} stroke={C.elec} strokeWidth="1.5"/>
        ))}
        {showMarks && [{i:aIdxMax,v:ev.max,up:true},{i:aIdxMin,v:ev.min,up:false}].map((p,k)=>(
          <g key={"m"+k}>
            <circle cx={xAt(xi(p.i))} cy={yAt(p.v)} r="3.5" fill={p.up?C.green:C.red} stroke={C.bg} strokeWidth="1.5" style={{ filter:`drop-shadow(0 0 4px ${(p.up?C.green:C.red)}88)` }}/>
            {hov==null && <text x={xAt(xi(p.i))} y={yAt(p.v)+(p.up?-8:14)} fill={p.up?C.green:C.red} fontSize="9" fontFamily={MONO} textAnchor="middle">{fMon(p.v)}</text>}
          </g>
        ))}
        {xlabels.map((m,i)=> ((comp || i%3===0) ? (
          <text key={"x"+i} x={xAt(i)} y={H-6} fill={C.textMuted} fontSize="8.5" fontFamily={MONO} textAnchor="middle">{m}</text>
        ) : null))}
        {comp && ev.meses.map((m,i)=>(
          <rect key={"h"+i} x={xAt(i)-stepX/2} y={padT} width={stepX} height={H-padT-padB} fill="transparent" onMouseEnter={()=>setHov(i)}/>
        ))}
        {tip && (<>
          <line x1={xAt(tip.i)} y1={padT} x2={xAt(tip.i)} y2={H-padB} stroke={C.text} strokeWidth="1" strokeDasharray="2 3" opacity="0.5"/>
          <g transform={`translate(${tipX},${tipY})`}>
            <rect width={TW} height={TH} rx="6" fill="#0a0a09" stroke={C.borderLight} strokeWidth="1"/>
            <text x="9" y="16" fill={C.text} fontSize="10" fontFamily={MONO} fontWeight="600">{tip.mes} · {fMon(tip.v)}</text>
            {tip.dPrev!=null && <text x="9" y="30" fill={tip.dPrev>=0?C.green:C.red} fontSize="8.5" fontFamily={MONO}>vs mes ant: {tip.dPrev>=0?"+":""}{fMon(tip.dPrev)} ({tip.dPrevPct>=0?"+":""}{p1(tip.dPrevPct)}%)</text>}
            <text x="9" y={tip.dPrev!=null?43:30} fill={tip.dPpto>=0?C.green:C.red} fontSize="8.5" fontFamily={MONO}>vs ppto: {tip.dPpto>=0?"+":""}{fMon(tip.dPpto)} ({tip.dPptoPct>=0?"+":""}{p1(tip.dPptoPct)}%)</text>
            {tip.lect && <text x="9" y={(tip.dPrev!=null?43:30)+13} fill={C.textSub} fontSize="8.5" fontFamily="'DM Sans', system-ui, sans-serif" fontStyle="italic">{tip.lect}</text>}
          </g>
        </>)}
      </svg>

      {comp && (
        <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginTop:8 }}>
          {SER.map((s)=>(<Chip key={s.key} on={show[s.key]} color={s.color} label={s.label} onClick={()=>setShow((x)=>({...x,[s.key]:!x[s.key]}))}/>))}
        </div>
      )}

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"7px 14px", marginTop:12 }}>
        <Stat label="Mayor caída"        v={fMon(ev.drop.delta)}                          sub={ev.drop.from?`${ev.drop.from}→${ev.drop.mes}`:""}     color={C.red}/>
        <Stat label="Mayor crecimiento"  v={`+${fMon(ev.growth.delta)}`}                  sub={ev.growth.from?`${ev.growth.from}→${ev.growth.mes}`:""} color={C.green}/>
        <Stat label="vs presupuesto"     v={`${ev.vsPresupuesto>=0?"+":""}${p1(ev.vsPresupuesto)}%`} sub={`${fMon(ev.totAct)} vs ${fMon(ev.totPpto)}`}      color={ev.vsPresupuesto>=0?C.green:C.red}/>
        <Stat label="vs año anterior"    v={`${ev.vsAnterior>=0?"+":""}${p1(ev.vsAnterior)}%`}       sub={`${fMon(ev.totAct)} vs ${fMon(ev.totAnt)}`}       color={ev.vsAnterior>=0?C.green:C.red}/>
      </div>

      <div style={{ fontSize:11, color:C.textMuted, lineHeight:1.5, marginTop:12, paddingTop:10, borderTop:`1px solid ${C.border}` }}>
        Histórico <span style={{color:C.textSub}}>global real</span> (12 meses + año anterior + presupuesto). La película <span style={{color:C.textSub}}>por entidad</span> (cliente/SKU) se enciende cuando conectes histórico real — hoy ADI no inventa una tendencia por entidad.
      </div>
    </Card>
  );
}

// ── EL PARETO · concentración 80/20 (dato real · data-driven) · barras + acumulado + referencia 80% ──
// El % que muestra es el REAL del dato (no se fuerza 80). Honesto sin bloqueos (sumas acumuladas punto-en-tiempo).
function ConcentracionCard({ scenario, spec }) {
  const sp = spec || { metric:"ventas", dims:CONCENTRATION_DIMS, defaultDim:"cliente", verb:"explican", ofNoun:"de las ventas", byNoun:"por ventas" };
  const [dim, setDim] = useState(sp.defaultDim);
  const [hov, setHov] = useState(null);
  const con = buildConcentration(dim, scenario, sp.metric);
  const bars = con.bars, nb = Math.max(bars.length, 1);
  const W = 540, H = 190, padL = 34, padR = 30, padT = 14, padB = 46;
  const maxV = bars.length ? bars[0].value : 1;
  // 3 tiers premium: bloque 80% azul eléctrico · cola alta turquesa ahumado · cola baja lavanda metálico (gradiente + glow por tier)
  const tierOf = (b, i) => b.inBlock ? "c" : ((i - con.blockCount) / Math.max(con.n - con.blockCount, 1) < 0.5 ? "a" : "r");
  const fillFor = (t) => (t === "c" ? "url(#barAzul)" : t === "a" ? "url(#barTurq)" : "url(#barLav)");
  const glowFor = (t) => (t === "c" ? "drop-shadow(0 0 5px rgba(61,116,245,0.42))" : t === "a" ? "drop-shadow(0 0 4px rgba(91,158,160,0.32))" : "drop-shadow(0 0 4px rgba(164,155,208,0.32))");
  const niceHi = Math.ceil(maxV / 1000) * 1000 || 1;
  const bw = (W - padL - padR) / nb;
  const xC = (i) => padL + i * bw + bw / 2;
  const barW = Math.min(bw * 0.62, 32);
  const yBar = (v) => (H - padB) - (v / niceHi) * (H - padT - padB);
  const yCum = (pct) => padT + (1 - pct / 100) * (H - padT - padB);
  // acumulada en curva monotónica (pase 1e · owner: premium, color propio) — pasa EXACTO por cada punto (no fabrica)
  const cumPath = _mono(bars.map((_, i) => xC(i)), bars.map((b) => yCum(b.cumPct)));
  const trunc = (s) => (s && s.length > 7 ? s.slice(0, 6) + "…" : s);

  return (
    <Card>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:8, marginBottom:6 }}>
        <Eyebrow def={METRIC_DEFS["Concentración"]}>Concentración · regla 80/20</Eyebrow>
        <div style={{ display:"flex", alignItems:"center", gap:4 }}>
          {sp.dims.map((d)=>(
            <button key={d.key} onClick={()=>{setDim(d.key);setHov(null);}} style={{ padding:"3px 8px", borderRadius:5, cursor:"pointer", fontSize:10, fontFamily:"'DM Sans', system-ui, sans-serif", background: dim===d.key?"rgba(255,255,255,0.1)":"transparent", border:`1px solid ${dim===d.key?"rgba(255,255,255,0.4)":C.border}`, color: dim===d.key?C.text:C.textMuted }}>{d.label}</button>
          ))}
        </div>
      </div>

      <div style={{ fontSize:13, color:C.textSub, lineHeight:1.5, marginBottom:6 }}>
        Los primeros <Num color={C.text}>{con.blockCount}</Num> {con.blockCount===1?con.label.toLowerCase():con.plural} {sp.verb} el <Num color={C.amber}>{p1(con.blockPct)}%</Num> {sp.ofNoun}.
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} style={{ width:"100%", height:"auto", display:"block" }} onMouseLeave={()=>setHov(null)}>
        <defs>
          <linearGradient id="barAzul" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#5a8cff" stopOpacity="1"/>
            <stop offset="100%" stopColor="#2f56d8" stopOpacity="0.74"/>
          </linearGradient>
          <linearGradient id="barTurq" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#74b6b8" stopOpacity="1"/>
            <stop offset="100%" stopColor="#487f81" stopOpacity="0.74"/>
          </linearGradient>
          <linearGradient id="barLav" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#bcb2e2" stopOpacity="1"/>
            <stop offset="100%" stopColor="#877dba" stopOpacity="0.74"/>
          </linearGradient>
        </defs>
        {[100,80,50,25,0].map((p)=>(
          <g key={"p"+p}>
            <line x1={padL} y1={yCum(p)} x2={W-padR} y2={yCum(p)} stroke={p===80?C.amber:C.border} strokeWidth="1" strokeDasharray={p===80?"5 3":"3 4"} opacity={p===80?0.55:1}/>
            <text x={W-padR+4} y={yCum(p)+3} fill={p===80?C.amber:C.textMuted} fontSize="8" fontFamily={MONO}>{p1(p)}%</text>
          </g>
        ))}
        {bars.map((b,i)=>{ const t=tierOf(b,i); return (
          <rect key={"b"+i} x={xC(i)-barW/2} y={yBar(b.value)} width={barW} height={Math.max((H-padB)-yBar(b.value),0)} rx="3"
            fill={fillFor(t)} opacity={hov==null||hov===i?1:0.55}
            style={{ filter: glowFor(t) }} onMouseEnter={()=>setHov(i)}/>
        ); })}
        <path d={cumPath} fill="none" stroke={C.lav} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" opacity="0.18"/>
        <path d={cumPath} fill="none" stroke={C.lav} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" opacity="0.95"/>
        {bars.map((b,i)=>(<circle key={"c"+i} cx={xC(i)} cy={yCum(b.cumPct)} r={hov===i?3:1.4} fill={hov===i?C.lav:"#0a0a09"} stroke={C.lav} strokeWidth="1" opacity="0.9" onMouseEnter={()=>setHov(i)}/>))}
        {con.blockCount>=1 && con.blockCount<=bars.length && (
          <g>
            <circle cx={xC(con.blockCount-1)} cy={yCum(bars[con.blockCount-1].cumPct)} r="5.5" fill="none" stroke={C.red} strokeWidth="1.5" style={{ filter:`drop-shadow(0 0 5px ${C.red}aa)` }}/>
            <circle cx={xC(con.blockCount-1)} cy={yCum(bars[con.blockCount-1].cumPct)} r="2.5" fill={C.red}/>
          </g>
        )}
        {bars.map((b,i)=> (nb<=14 || i%2===0) ? (
          <text key={"x"+i} x={xC(i)} y={H-padB+12} fill={hov===i?C.text:C.textMuted} fontSize="7.5" fontFamily={MONO} textAnchor="end" transform={`rotate(-40 ${xC(i)} ${H-padB+12})`}>{trunc(b.name)}</text>
        ) : null)}
        {hov!=null && bars[hov] && (() => { const b=bars[hov], TW=130, TH=46, tx=Math.min(Math.max(xC(hov)-TW/2,2),W-TW-2), ty=Math.max(yCum(b.cumPct)-TH-8,2); return (
          <g transform={`translate(${tx},${ty})`}>
            <rect width={TW} height={TH} rx="6" fill="#0a0a09" stroke={C.borderLight} strokeWidth="1"/>
            <text x="9" y="16" fill={C.text} fontSize="10" fontFamily={MONO} fontWeight="600">{trunc(b.name)} · {fMon(b.value)}</text>
            <text x="9" y="30" fill={C.textSub} fontSize="8.5" fontFamily={MONO}>{p1(b.pct)}% del total</text>
            <text x="9" y="41" fill={C.amber} fontSize="8.5" fontFamily={MONO}>acumulado: {p1(b.cumPct)}%</text>
          </g>
        ); })()}
      </svg>

      <div style={{ fontSize:11, color:C.textMuted, lineHeight:1.5, marginTop:10, paddingTop:10, borderTop:`1px solid ${C.border}` }}>
        Concentración {sp.byNoun} ($) · escenario {con.scenario} · <span style={{color:C.elec}}>barras azules</span> = el bloque que explica el 80.0% · <span style={{color:C.lav}}>línea lavanda</span> = acumulado, <span style={{color:C.red}}>punto rojo</span> = corte del 80.0%.
      </div>
    </Card>
  );
}

function TemporalSlot({ evidence }) {
  const hasReal = evidence && evidence.availability && evidence.availability.history && evidence.availability.history.perEntity === true;
  return (
    <div style={{ padding:"13px 15px", borderRadius:10, border:`1px dashed ${C.border}`, background:"rgba(255,255,255,0.012)" }}>
      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink:0 }}>
          <circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/>
        </svg>
        <span style={{ fontFamily:MONO, fontSize:9.5, fontWeight:600, color:C.textMuted, textTransform:"uppercase", letterSpacing:"1px" }}>Por qué en el tiempo · próximo ángulo</span>
      </div>
      <div style={{ fontSize:11.5, color:C.textMuted, lineHeight:1.5, marginTop:8 }}>
        {hasReal
          ? "Hay histórico real por entidad — abrir la película de 24 meses."
          : "La película por entidad se enciende cuando se conecte histórico real (tu Excel). Hoy ADI no inventa una tendencia."}
      </div>
    </div>
  );
}

function IconBtn({ children, onClick, title }) {
  if (!onClick) return null;
  return (
    <button onClick={onClick} title={title} style={{
      width:26, height:26, borderRadius:6, border:`1px solid ${C.border}`, background:"transparent",
      color:C.textMuted, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", transition:"all 0.15s",
    }}
      onMouseEnter={e=>{ e.currentTarget.style.background=C.surfaceAlt; e.currentTarget.style.color=C.text; }}
      onMouseLeave={e=>{ e.currentTarget.style.background="transparent"; e.currentTarget.style.color=C.textMuted; }}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{children}</svg>
    </button>
  );
}

export default SentrixPanel;
