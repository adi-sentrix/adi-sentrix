/* === src/ui/SentrixPanel.jsx · Etapa 5 · Sentrix · PANEL RESOLVER (registry de packs) ===
 * La "mesa de trabajo" que DEMUESTRA la lectura ejecutiva de ADI (no un dashboard fijo).
 * RESOLVER GENERAL (refactor 2026-06-29): el panel resuelve QUÉ mostrar por `reading.kind` contra una matriz
 * PANEL_PACKS (kind → {title, Hero, Evidence}) — ESPEJO del renderer buildReadingFromSignals. Un kind sin pack
 * cae al pack GENÉRICO (monto + reframe + drivers · sin tarjeta de evidencia vacía) → honesto, nunca en blanco.
 * Agregar una métrica = registrar su pack acá (+ su rama en el renderer). El armazón (header/drivers/lectura/slot)
 * es común. Regla madre: cada card sale de un claim de la lectura, y cada claim del dato. Presentación pura. */
import React, { useState, useEffect } from "react";
import { C } from "./theme.js";
import { buildComparisonReading, buildReadingFromSignals, buildClientContribSignals, buildSkuContribSignals, buildSkuMarginSignals } from "../adi/sentrix/reading.js";   // paso 3 · operaciones
import { entityExplorable, temporalCapability } from "../adi/sentrix/capability.js";   // explorable del frame + regla temporal
import { buildGlobalEvolution } from "../adi/sentrix/temporal.js";   // paso 4 · la historia (evolutivo global real)
import { buildConcentration, CONCENTRATION_DIMS } from "../adi/sentrix/concentration.js";   // paso 4b · Pareto 80/20
import { buildEntityKPIs, buildMarginDecomposition, buildMarginReceipt, buildCapitalReceipt, buildBrechaFilm } from "../adi/sentrix/kpis.js";   // brick 2a/2b/6/2c · tira + descomposición + recibo + película de la brecha
import { METRIC_DEFS } from "../adi/sentrix/glossary.js";   // brick 4 · catálogo de definiciones (el "i" de cada card · determinístico)
import { diagnosisCharts } from "../adi/sentrix/surface.js";   // brick 5 · el motor decide qué gráficos según el foco (LLM-ready)
import { buildControlRing } from "../adi/sentrix/control.js";   // brick 7 · Control · la tabla-ring (foco vs promedio vs par vs mejor)
import { ADI_SENTRIX_TEMPORAL_ENABLED, ADI_SENTRIX_PARETO_ENABLED, ADI_SENTRIX_SHELL_ENABLED } from "../config/voiceFlags.js";

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
          <div key={i} title={`${s.label} ${s.pct}%`} style={{ width:`${s.pct}%`, background:s.color, transition:"width 0.4s ease" }}/>
        ))}
      </div>
      <div style={{ display:"flex", flexWrap:"wrap", gap:"6px 16px", marginTop:10 }}>
        {segments.map((s, i) => (
          <div key={i} style={{ display:"flex", alignItems:"center", gap:6, fontSize:11.5, color:C.textSub }}>
            <span style={{ width:8, height:8, borderRadius:2, background:s.color, flexShrink:0 }}/>
            <span>{s.label}</span>
            <span style={{ fontFamily:MONO, fontWeight:600, color:C.text }}>{s.pct}%</span>
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
// aclara un color hex hacia el blanco (para puntos de gráfico más claros que su curva)
const _lighten = (hex, amt = 0.45) => {
  const h = (hex || "").replace("#", ""); if (h.length < 6) return hex;
  const c = (i) => { const v = parseInt(h.slice(i, i + 2), 16); return Math.round(v + (255 - v) * amt); };
  return `rgb(${c(0)},${c(2)},${c(4)})`;
};

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
          ? <span style={{ fontSize:12.5, color:C.textMuted }}>margen · la brecha vive en la <Num color={C.red}>estructura de costo</Num> · la carga (<Num color={C.amber}>{rd.carga}%</Num>) es el quick-win</span>
          : <span style={{ fontSize:12.5, color:C.textMuted }}>margen · carga comercial <Num color={C.amber}>{rd.carga}%</Num> · <Num color={C.amber}>+{rd.vsPromedio}pp</Num> sobre el promedio ({rd.targetCarga}%)</span>}
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
    { k:"Margen actual", v:`${rd.pct}%`, color:C.amber },
    { k:`Carga comercial (promedio ${rd.targetCarga}%)`, v:`${rd.carga}%`, color:C.amber },
    ...(rd.targetMargen != null ? [{ k:"Si baja la carga al promedio → margen", v:`${rd.targetMargen}%`, color:C.green }] : []),
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
        <span style={{ fontSize:12.5, color:C.textMuted }}>margen · <Num color={C.amber}>{rd.gap}pp</Num> bajo el benchmark (<Num>{rd.benchmark}%</Num>)</span>
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
    { k:"Precio de venta (100%)", v:"base", color:C.textSub },
    { k:"− Costo", v:`${rd.decomposition.costo}%`, color:C.red },
    { k:"− Rebate (carga comercial)", v:`${rd.decomposition.rebate}%`, color:C.amber },
    { k:"= Margen que queda", v:`${rd.decomposition.margen}%`, color:C.green, strong:true },
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
        <span style={{ fontSize:12.5, color:C.textMuted }}><Num color={C.text}>{rd.pct}%</Num> del capital inmovilizado{rd.totalInmovFmt ? <> (<Num>{rd.totalInmovFmt}</Num> total)</> : null}</span>
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
        <Num color={C.text} size="1.05em">{rd.gapFmt || `${rd.gap}pp`}</Num>
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
            <option value="">elegí una entidad…</option>
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
        <span style={{ fontSize:12.5, color:C.textMuted }}>margen unitario · <Num color={C.amber}>{rd.gap}pp</Num> bajo el benchmark (<Num>{rd.benchmark}%</Num>)</span>
      </div>
      <div style={{ marginTop:14 }}>
        <div style={{ height:10, borderRadius:5, overflow:"hidden", background:"rgba(244,63,94,0.2)", border:`1px solid ${C.border}` }}>
          <div style={{ width:`${fillPct}%`, height:"100%", background:C.amber, transition:"width 0.4s ease" }}/>
        </div>
        <div style={{ display:"flex", justifyContent:"space-between", marginTop:8, fontSize:11.5, color:C.textSub }}>
          <span>margen <Num color={C.amber}>{rd.pct}%</Num></span>
          <span>benchmark <Num>{rd.benchmark}%</Num></span>
        </div>
      </div>
      {rec && <div style={{ marginTop:12, fontSize:12.5, color:C.textSub }}>Contribución recuperable al benchmark: <Num color={C.green} size="1.1em">{rec.v}</Num> anual</div>}
    </>
  );
}
function MarginCompressionEvidence({ rd }) {
  const rows = [
    { k: "Margen unitario actual", v: `${rd.pct}%`, color: C.amber },
    { k: "Benchmark de cartera", v: `${rd.benchmark}%`, color: C.textSub },
    { k: "Brecha de margen unitario", v: `${rd.gap}pp`, color: C.red, strong: true },
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

export function SentrixPanel({ evidence, onClose, onToggleMax, maximized = false }) {
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
    const hasLens = l === "diagnostico" || rd.focusType === "client" || rd.focusType === "bodega";
    return hasLens ? l : "diagnostico";
  };
  const [tab, setTab] = useState(() => _routedTab(baseRd || {}, evidence && evidence.lens));   // shell · lente activa (Diagnóstico|Evidencia|Control)
  useEffect(() => { if (baseRd) { setStack([mkBase(baseRd)]); setTab(_routedTab(baseRd, evidence.lens)); } }, [baseFocus]);   // nueva respuesta → lente ruteada
  if (!baseRd) return null;

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
  // CONTROL · la tabla-ring (foco vs promedio vs par instructivo vs mejor-en-clase) · cliente + bodega · null → placeholder.
  const ring = ((current.focusType === "client" || current.focusType === "bodega") && !current.compareWith)
    ? buildControlRing(current.focusType, current.focus, evidence.periodo) : null;

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
      </div>

      {/* SHELL · 3 tabs sobre el estado compartido (mismo caso, distinta lente) · gated · OFF = sin tabs (byte-exacto) */}
      {ADI_SENTRIX_SHELL_ENABLED && (
        <div style={{ flexShrink:0, display:"flex", gap:2, padding:"0 14px", borderBottom:`1px solid ${C.border}`, background:"#000000" }}>
          {[["diagnostico", "Diagnóstico"], ["evidencia", "Evidencia"], ["control", "Control"]].map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)}
              style={{ padding:"9px 13px", background:"transparent", border:"none", borderBottom:`2px solid ${tab === k ? C.text : "transparent"}`, color: tab === k ? C.text : C.textMuted, fontSize:12.5, fontWeight: tab === k ? 600 : 400, cursor:"pointer", fontFamily:"'DM Sans', system-ui, sans-serif" }}>
              {label}
            </button>
          ))}
        </div>
      )}

      {/* ── cuerpo (scroll) · la lente activa · Diagnóstico = el contenido actual ── */}
      <div style={{ flex:1, overflowY:"auto", minHeight:0, padding:18, display:"flex", flexDirection:"column", gap:14 }}>
        {(!ADI_SENTRIX_SHELL_ENABLED || tab === "diagnostico") && (<>

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
        {ADI_SENTRIX_SHELL_ENABLED && tab === "evidencia" && (
          receipt
            ? <EvidenciaRecibo receipt={receipt}/>
            : <div>
                <Eyebrow>La cuenta de {rd.focus}</Eyebrow>
                {Evidence
                  ? <Card><Evidence rd={rd}/></Card>
                  : <div style={{ fontSize:12.5, color:C.textMuted, lineHeight:1.6, padding:"4px 2px" }}>Sin cuenta detallada para esta lectura.</div>}
              </div>
        )}

        {ADI_SENTRIX_SHELL_ENABLED && tab === "control" && (
          ring ? <ControlRing ring={ring} rd={rd}/> : <LensPlaceholder tab="control" focus={rd.focus}/>
        )}
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
        <Num color={up ? C.green : C.red}>{(up ? "+" : "") + r1(gap) + unit}</Num>
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
                <div style={{ fontFamily:MONO, fontSize:11, color:pctColor[l.tone], marginTop:4 }}>{r1(l.pct)}%</div>
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
  // unidad de la plata: cliente en $K (contribución) · bodega en $ (stockUSD) → formateo distinto para no errar ×1000.
  const money = ring.entityType === "bodega"
    ? (v) => (Math.abs(v) >= 1e6 ? "$" + (v / 1e6).toFixed(1) + "M" : Math.abs(v) >= 1000 ? "$" + (v / 1000).toFixed(1) + "K" : "$" + Math.round(v))
    : (v) => (Math.abs(v) >= 1000 ? fMon(v) : fmtK(v));
  const roleTag = { focus:{ t:"Foco", c:C.celeste }, peer:{ t:"Par", c:C.textMuted }, avg:{ t:"Promedio", c:C.textMuted }, best:{ t:"Mejor", c:C.green } };
  const cellVal = (r, col) => {
    if (col.key === "gap")   return r.role === "avg" ? "—" : (r.gap >= 0 ? "+" : "") + r1(r.gap) + "pp";
    if (col.fmt === "money") return money(r[col.key]);
    if (col.fmt === "x")     return r1(r[col.key]) + "x";
    return r1(r[col.key]) + "%";
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
        </Card>
      </div>

      {/* ADI · ELEGÍ UN CAMINO · las palancas con $ honesto */}
      <div>
        <Eyebrow>ADI · elegí un camino</Eyebrow>
        <div style={{ fontSize:12.5, color:C.textSub, lineHeight:1.5, marginBottom:10 }}>
          {ring.focus} {ring.framingVerb || "pierde por"} <span style={{ color:C.text, fontWeight:600 }}>{ring.leverLabel}</span>. Dos palancas, distinto esfuerzo:
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:9 }}>
          {ring.entityType === "bodega" ? (
            <>
              {ring.quickWinK > 0 && (
                <PathCard tag="Rápido" tagColor={C.green}
                  title="Liquidar el stock crítico"
                  value={`+${money(ring.quickWinK)}`}
                  detail="lo marcado crítico (120d+ / sin venta) · liberás ese capital ahora"/>
              )}
              {ring.estructuralK > 0 && (
                <PathCard tag="Estructural" tagColor={C.amber}
                  title="Rotar / transferir el stock lento"
                  value={`hasta +${money(ring.estructuralK)}`}
                  detail="todo el capital inmovilizado · mover lo lento a donde se vende o rebajar · la palanca dominante, más lenta"/>
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
                  detail="si el costo llegara al promedio interno · la palanca dominante, la más difícil (proveedores · mix · volumen)"/>
              )}
            </>
          )}
        </div>
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
      <div style={{ fontSize:11, color:C.textMuted, opacity:0.8 }}>En construcción · próximo brick.</div>
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
  const fp = (n) => (n >= 0 ? "+" : "−") + Math.abs(n) + "pp";
  const rows = [
    { label: "Estructura de costo", comp: d.costoComp, share: d.costoShare, color: C.red },
    { label: "Carga comercial",     comp: d.cargaComp, share: d.cargaShare, color: C.amber },
  ];
  return (
    <Card>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
        <Eyebrow def={METRIC_DEFS["La brecha descompuesta"]}>La brecha, descompuesta</Eyebrow>
        <span style={{ fontSize:11, color:C.textMuted, fontFamily:MONO }}>vs promedio {d.avgM}%</span>
      </div>
      {rows.map((r, i) => (
        <div key={i} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
          <div style={{ width:128, fontSize:12, color:C.textSub, flexShrink:0 }}>{r.label}</div>
          <div style={{ flex:1, height:13, background:"rgba(255,255,255,0.04)", borderRadius:3, overflow:"hidden" }}>
            <div style={{ width:`${Math.max(r.share, 2)}%`, height:"100%", background:r.color, borderRadius:3, transition:"width 0.4s ease" }}/>
          </div>
          <div style={{ width:92, textAlign:"right", fontFamily:MONO, fontSize:12, color:r.color, flexShrink:0 }}>{fp(r.comp)} · {r.share}%</div>
        </div>
      ))}
      <div style={{ fontSize:11.5, color:C.textMuted, lineHeight:1.5, marginTop:8 }}>
        El gap de <Num color={d.gap < 0 ? C.red : C.green}>{fp(d.gap)}</Num> lo explica <span style={{ color:C.textSub }}>{d.dominant === "costo" ? "la estructura de costo" : "la carga comercial"}</span> ({d.dominant === "costo" ? d.costoShare : d.cargaShare}%) — la tesis la elige el dato, no un molde.
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
            <text x={padL - 5} y={yAt(p) + 3} fill={C.textMuted} fontSize="8" fontFamily={MONO} textAnchor="end">{Math.round(p)}%</text>
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
              {shown.map((s, k) => <text key={s.key} x="9" y={27 + k * 13} fill={s.color} fontSize="9" fontFamily={MONO}>{s.label}: {r1(s.data[hov])}%</text>)}
            </g>
          ); })()}
        </>)}
      </svg>
      <div style={{ fontSize:11, color:C.textMuted, lineHeight:1.5, marginTop:8, paddingTop:8, borderTop:`1px solid ${C.border}` }}>
        Ilustrativo — todavía no tengo el histórico mes a mes de <span style={{ color:C.textSub }}>{film.focus}</span> (el ERP lo enciende). El <span style={{ color:C.textSub }}>hoy</span> es el dato real; sumá <span style={{ color:C.teal }}>Costo</span> y <span style={{ color:C.lav }}>Carga</span> y vas a ver la palanca dominante (<span style={{ color:C.textSub }}>{film.thesis}</span>) trepar mientras el margen se erosiona.
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
              <text x={xa} y={y - 9} textAnchor="middle" fill={colA} fontSize="9.5" fontFamily={MONO}>{r1(r.va)}%</text>
              <text x={xb} y={y + 16} textAnchor="middle" fill={colB} fontSize="9.5" fontFamily={MONO}>{r1(r.vb)}%</text>
            </g>
          );
        })}
      </svg>
      <div style={{ fontSize:11.5, color:C.textMuted, lineHeight:1.5, marginTop:8, paddingTop:8, borderTop:`1px solid ${C.border}` }}>
        <span style={{ color: bWins ? colB : colA, fontWeight:600 }}>{bWins ? b : a}</span> saca mejor margen — la palanca que los separa es la <span style={{ color:C.textSub }}>{lever}</span>.
      </div>
    </Card>
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
            {tip.dPrev!=null && <text x="9" y="30" fill={tip.dPrev>=0?C.green:C.red} fontSize="8.5" fontFamily={MONO}>vs mes ant: {tip.dPrev>=0?"+":""}{fMon(tip.dPrev)} ({tip.dPrevPct>=0?"+":""}{tip.dPrevPct}%)</text>}
            <text x="9" y={tip.dPrev!=null?43:30} fill={tip.dPpto>=0?C.green:C.red} fontSize="8.5" fontFamily={MONO}>vs ppto: {tip.dPpto>=0?"+":""}{fMon(tip.dPpto)} ({tip.dPptoPct>=0?"+":""}{tip.dPptoPct}%)</text>
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
        <Stat label="vs presupuesto"     v={`${ev.vsPresupuesto>=0?"+":""}${ev.vsPresupuesto}%`} sub={`${fMon(ev.totAct)} vs ${fMon(ev.totPpto)}`}      color={ev.vsPresupuesto>=0?C.green:C.red}/>
        <Stat label="vs año anterior"    v={`${ev.vsAnterior>=0?"+":""}${ev.vsAnterior}%`}       sub={`${fMon(ev.totAct)} vs ${fMon(ev.totAnt)}`}       color={ev.vsAnterior>=0?C.green:C.red}/>
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
  const cumPath = bars.map((b, i) => `${i === 0 ? "M" : "L"}${xC(i).toFixed(1)},${yCum(b.cumPct).toFixed(1)}`).join(" ");
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
        Los primeros <Num color={C.text}>{con.blockCount}</Num> {con.blockCount===1?con.label.toLowerCase():con.plural} {sp.verb} el <Num color={C.amber}>{con.blockPct}%</Num> {sp.ofNoun}.
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
            <text x={W-padR+4} y={yCum(p)+3} fill={p===80?C.amber:C.textMuted} fontSize="8" fontFamily={MONO}>{p}%</text>
          </g>
        ))}
        {bars.map((b,i)=>{ const t=tierOf(b,i); return (
          <rect key={"b"+i} x={xC(i)-barW/2} y={yBar(b.value)} width={barW} height={Math.max((H-padB)-yBar(b.value),0)} rx="3"
            fill={fillFor(t)} opacity={hov==null||hov===i?1:0.55}
            style={{ filter: glowFor(t) }} onMouseEnter={()=>setHov(i)}/>
        ); })}
        <path d={cumPath} fill="none" stroke={C.celeste} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" style={{ filter:`drop-shadow(0 0 3px ${C.celeste}55)` }}/>
        {bars.map((b,i)=>(<circle key={"c"+i} cx={xC(i)} cy={yCum(b.cumPct)} r={hov===i?3:1.4} fill={hov===i?C.celeste:"#0a0a09"} stroke={C.celeste} strokeWidth="1" opacity="0.9" onMouseEnter={()=>setHov(i)}/>))}
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
            <text x="9" y="30" fill={C.textSub} fontSize="8.5" fontFamily={MONO}>{r1(b.pct)}% del total</text>
            <text x="9" y="41" fill={C.amber} fontSize="8.5" fontFamily={MONO}>acumulado: {r1(b.cumPct)}%</text>
          </g>
        ); })()}
      </svg>

      <div style={{ fontSize:11, color:C.textMuted, lineHeight:1.5, marginTop:10, paddingTop:10, borderTop:`1px solid ${C.border}` }}>
        Concentración {sp.byNoun} ($) · escenario {con.scenario} · <span style={{color:C.elec}}>barras azules</span> = el bloque que explica el 80% · <span style={{color:C.celeste}}>línea celeste</span> = acumulado, <span style={{color:C.red}}>punto rojo</span> = corte del 80%.
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
