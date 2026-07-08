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
import { buildGlobalEvolution, buildCompareEvolution } from "../adi/sentrix/temporal.js";   // paso 4 · la historia (evolutivo global real + dos curvas por entidad)
import { buildConcentration, CONCENTRATION_DIMS } from "../adi/sentrix/concentration.js";   // paso 4b · Pareto 80/20
import { buildEntityKPIs, buildMarginDecomposition, buildMarginReceipt, buildCapitalReceipt, buildBrechaFilm } from "../adi/sentrix/kpis.js";   // brick 2a/2b/6/2c · tira + descomposición + recibo + película de la brecha
import { METRIC_DEFS } from "../adi/sentrix/glossary.js";   // brick 4 · catálogo de definiciones (el "i" de cada card · determinístico)
import { diagnosisCharts } from "../adi/sentrix/surface.js";   // brick 5 · el motor decide qué gráficos según el foco (LLM-ready)
import { buildControlRing } from "../adi/sentrix/control.js";   // brick 7 · Control · la tabla-ring (foco vs promedio vs par vs mejor)
import { buildCuadroMando, CUADRO_DIMS } from "../adi/sentrix/cuadro.js";   // 4ª lente · Cuadro de mando · la grilla operable
import { ADI_SENTRIX_TEMPORAL_ENABLED, ADI_SENTRIX_PARETO_ENABLED, ADI_SENTRIX_SHELL_ENABLED, ADI_SENTRIX_CUADRO_ENABLED } from "../config/voiceFlags.js";
import { isNamedInBoleta } from "../adi/boleta.js";   // ESPEJO Sentrix↔ADI (Frente B) · el panel pinta lo que ADI nombró (la boleta = fuente de verdad de lo dicho)
import { buildResumenEjecutivo } from "../adi/specRetrieval.js";   // MESA DE CONTROL · KPIs + lectura + focos del diagnose (una verdad · lo mismo que el hero)
import { POLICY, benchmarkOf } from "../config/businessPolicy.js";   // Perfil comparado · la línea de benchmark/target (criterio-aware: si el owner fijó su vara, ES su vara)
import { setUISignal } from "../adi/uiSignals.js";   // memoria UI (owner 2026-07-08) · lo que el usuario hace en la Mesa informa el contexto de ADI
import { ADI_PROFILE } from "../config/flagProfile.js";   // perfil activo · sub-paths incompletos (placeholder Control · fecha por-entidad EJEMPLO) SOLO en dev
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
          <span style={{ color:C.textMuted }}>Demostrando: </span>el ranking completo — ordená, filtrá y compará en el Cuadro de mando.
        </div>
      </div>
      {ADI_SENTRIX_SHELL_ENABLED && (
        <div style={{ flexShrink:0, display:"flex", gap:2, padding:"0 14px", borderBottom:`1px solid ${C.border}`, background:"#000000" }}>
          <button style={{ padding:"9px 13px", background:"transparent", border:"none", borderBottom:`2px solid ${C.text}`, color:C.text, fontSize:12.5, fontWeight:600, cursor:"default", fontFamily:"'DM Sans', system-ui, sans-serif", whiteSpace:"nowrap" }}>Cuadro de mando</button>
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
      </div>
      <div style={{ flex:1, overflowY:"auto", minHeight:0, padding:18 }}>
        {proj.length === 0 ? (
          <div style={{ fontSize:13, color:C.textSub, lineHeight:1.6 }}>Ese supuesto no está habilitado para esta métrica. Hoy puedo proyectar <b>ventas</b>, <b>contribución</b> o <b>capital</b> con un +/−X% sobre el dato real.</div>
        ) : (
          <div style={{ overflowX:"auto" }}>
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
          <span style={{ color:C.textMuted }}>Diagnóstico · </span>dónde se te va o se te inmoviliza plata — los focos ordenados por impacto.
        </div>
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
          <div style={{ fontSize:10.5, color:C.textMuted, marginTop:2, lineHeight:1.5 }}>Cada foco es plata que se te va (contribución no capturada, carga) o se te inmoviliza (capital). {MIRROR_LEGEND}{onAsk ? ` ${ASK_LEGEND}` : ""} Cifras de dato real de tu cartera.</div>
        </>)}
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
    ? (escala === calidad ? `${escala} gana en escala y en calidad de margen — domina en ambos frentes.` : `${escala} gana escala (más volumen); ${calidad} captura mejor margen. Ahí está la palanca: escala vs. calidad.`)
    : null;
  const cell = (val, side, pr) => { const w = winner(pr), on = w === side; return <span style={{ fontFamily:MONO, fontSize:13, fontVariantNumeric:"tabular-nums", color: w ? (on ? C.green : C.textMuted) : C.text, fontWeight: on ? 700 : 500 }}>{val}</span>; };
  const head = { fontFamily:MONO, fontSize:9.5, letterSpacing:"0.5px", color:C.textMuted, textTransform:"uppercase" };
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
        {/* EL PERFIL (owner 2026-07-08): el mismo gráfico de líneas de la Mesa, acá abajo con LOS MISMOS DOS —
            la tabla prueba, el perfil cuenta la trayectoria. Sin botón de re-preguntar (ya estamos EN la comparación). */}
        {(() => {
          const dim = ({ client: "cliente", cliente: "cliente", clientes: "cliente", marca: "marca", bodega: "bodega", sucursal: "bodega", sku: "sku" })[String(evidence.entityType || "cliente").toLowerCase()] || "cliente";
          if (!CUADRO_DIMS.some((d) => d.key === dim)) return null;
          const cm = buildCuadroMando(dim, evidence.periodo);
          const rowA = cm.rows.find((r) => r.name === a), rowB = cm.rows.find((r) => r.name === b);
          if (!rowA || !rowB) return null;
          return <div style={{ marginTop: 14 }}><MesaCompare a={a} b={b} rowA={rowA} rowB={rowB} columns={cm.columns} dim={dim} scenario={evidence.periodo} onAsk={null}/></div>;
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
    title={onAsk ? `Preguntale a ADI: ${q}` : undefined}
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
  const head = { fontFamily: MONO, fontSize: 9.5, letterSpacing: "0.5px", color: C.textMuted, textTransform: "uppercase" };
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
        {list.length === 0 ? (
          <div style={{ fontSize:12.5, color:C.textSub, lineHeight:1.6 }}>Todavía no guardé ningún criterio tuyo — mido con los estándares. Podés fijar tu vara desde el chat: <span style={{ color:C.celeste }}>"recordá que mi margen mínimo es 28%"</span>.</div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:9 }}>
            <div style={{ ...head, marginBottom:2 }}>Tus varas · reemplazan al estándar en TODAS las lecturas</div>
            {list.map((c, i) => (
              <div key={i} style={{ display:"flex", alignItems:"center", gap:10, padding:"11px 13px", border:`1px solid rgba(47,184,218,0.25)`, borderRadius:10, background:"rgba(47,184,218,0.04)" }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:12.5, color:C.text, fontWeight:600 }}>{c.label}</div>
                  <div style={{ fontSize:11, color:C.textMuted, marginTop:2 }}>estándar: {c.standard}</div>
                </div>
                <div style={{ fontFamily:MONO, fontSize:15, color:C.celeste, fontWeight:700, whiteSpace:"nowrap" }}>{c.valueFmt}</div>
                {onAsk ? (
                  <button onClick={() => onAsk(`Olvidá el ${c.label.toLowerCase()}`)} title={`Preguntale a ADI: Olvidá el ${c.label.toLowerCase()}`}
                    style={{ padding:"5px 9px", borderRadius:7, border:`1px solid ${C.border}`, background:"transparent", color:C.textMuted, fontSize:11, cursor:"pointer", flexShrink:0 }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = "#f87171"; e.currentTarget.style.borderColor = "rgba(248,113,113,0.4)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = C.textMuted; e.currentTarget.style.borderColor = C.border; }}>olvidar</button>
                ) : null}
              </div>
            ))}
          </div>
        )}
        <div style={{ fontSize:10.5, color:C.textMuted, lineHeight:1.5, marginTop:14 }}>Tu criterio vive solo en este navegador (no sale de tu máquina). "Olvidar" precarga el pedido en el chat — vos confirmás con Enter. También podés preguntar "¿qué recordás?" cuando quieras.</div>
      </div>
    </div>
  );
}

function ContribucionPanel({ evidence, onClose, onToggleMax, maximized, onAsk = null }) {
  const p = (evidence && evidence.contribucion && evidence.contribucion.panel) || {};
  const kind = p.kind, rows = p.rows || [];
  const head = { fontFamily: MONO, fontSize: 9.5, letterSpacing: "0.5px", color: C.textMuted, textTransform: "uppercase" };
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
            <div style={{ ...head, marginBottom:11 }}>{kind === "gap" ? "Plata sobre la mesa, por cliente" : "Contribución, por cuenta"}</div>
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
  const head = { fontFamily: MONO, fontSize: 9.5, letterSpacing: "0.5px", color: C.textMuted, textTransform: "uppercase" };
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
  const head = { fontFamily: MONO, fontSize: 9.5, letterSpacing: "0.5px", color: C.textMuted, textTransform: "uppercase" };
  const p1 = (v) => (Math.round(v * 10) / 10).toFixed(1);
  const decomp = rows.filter((r) => typeof r.costShare === "number" && r.below).slice(0, 5);
  const nm = _named(evidence);   // espejo: lo que ADI nombró
  // B.3 · número PROTAGONISTA (unificación con ventas/inventario): el $ de la palanca ("cuánto vale") de la boleta —
  // misma fuente de verdad que el texto, cero recalculo. Sin palanca (huecos) → cae al conteo como antes.
  const lever = ((evidence && evidence.boleta) || []).find((f) => f && /^Palanca · /.test(f.label));
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
            ? <div title={`${lever.label} — cuánto vale la palanca`} style={{ fontFamily:MONO, fontSize:16, color:C.amber, fontWeight:700, whiteSpace:"nowrap" }}>{lever.value}<span style={{ fontSize:10.5, color:C.textMuted, fontWeight:400 }}> · {p.belowCount}/{p.total} bajo benchmark</span></div>
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
        <div style={{ fontSize:10.5, color:C.textMuted, lineHeight:1.5 }}>La línea vertical es el benchmark de margen ({p1(bench)}%). Ámbar = bajo la línea (margen delgado); verde = sobre el benchmark.{lever ? " El monto del encabezado es cuánto vale la palanca (lo que ganás si la ejecutás)." : ""} {MIRROR_LEGEND}{onAsk ? ` ${ASK_LEGEND}` : ""} Cifras de dato real.</div>
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
  const titleParts = String(inv.title || "Capital inmovilizado · dónde está frenada tu plata").split(" · ");
  const isStale = inv.focus === "stale";
  const _fm = (v) => { const a = Math.abs(v), s = v < 0 ? "-" : ""; if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(1)}M`; if (a >= 1e3) return `${s}$${Math.round(a / 1e3)}K`; return `${s}$${Math.round(a)}`; };
  const maxB = Math.max(1, ...byBodega.map((b) => b.usd));
  const head = { fontFamily:MONO, fontSize:9.5, letterSpacing:"0.5px", color:C.textMuted, textTransform:"uppercase" };
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
                  <span style={{ fontFamily:MONO, color:C.text }}>{_fm(cp.usd)}</span> ({cp.pct}%) en {cp.count} SKU{cp.estado === "riesgo_quiebre" ? " que rotan rápido con poca cobertura — se van a cortar" : " que no rotan y atrapan la plata"}.
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
                  title={onAsk ? `Preguntale a ADI: Profundiza en ${s.sku}` : undefined}
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
      </div>
    </div>
  );
}

/* ── MESA DE CONTROL · Sentrix EN OPERACIÓN (owner 2026-07-07) ────────────────────────────────────────────────────────
 * No es la evidencia de una respuesta: es el lugar donde el dueño VIVE sus cifras — ventas, márgenes, capital a la mano —
 * con ADI al lado. Anti-BI por diseño: cada bloque lleva la LECTURA de ADI (no cifras mudas), los FOCOS del día con su $,
 * el 80/20 SIEMPRE visible (el principio del owner: pocos explican la mayor parte), y cada fila es una PREGUNTA (click →
 * ADI lo desglosa al lado). Reusa todo lo construido: resumen ejecutivo, diagnose, buildConcentration, CuadroMando. */
const _MESA_FOCO_ASK = {
  margen:  "¿Quiénes están bajo el margen mínimo?",
  carga:   "¿Cuánto me come la carga comercial?",
  capital: "¿Dónde está frenada mi plata?",
};
function MesaPanel({ evidence, onClose, onToggleMax, maximized, onAsk = null }) {
  const scenario = (evidence && evidence.periodo) || "bonanza";
  const resumen = React.useMemo(() => buildResumenEjecutivo(scenario), [scenario]);
  const [conDim, setConDim] = useState("cliente");
  const con = React.useMemo(() => buildConcentration(conDim, scenario, "ventas"), [conDim, scenario]);
  const head = { fontFamily: MONO, fontSize: 9.5, letterSpacing: "0.5px", color: C.textMuted, textTransform: "uppercase" };
  const bars = (con.bars || []).slice(0, 6);
  const maxPct = bars.length ? bars[0].pct : 1;
  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", minHeight:0, background:"#000000", borderLeft:`1px solid ${C.border}`, position:"relative", overflow:"hidden" }}>
      <div className="sentrix-sweep"/>
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
        <div style={{ fontSize:13, color:C.text, fontWeight:500 }}>Tu negocio, en vivo <span style={{ color:C.textMuted, fontWeight:400 }}>· ADI al lado — cada fila es una pregunta</span></div>
      </div>
      <div style={{ flex:1, overflowY:"auto", minHeight:0, padding:18, display:"flex", flexDirection:"column", gap:18 }}>
        {/* KPIs del período (misma verdad que el hero) */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(120px, 1fr))", gap:9 }}>
          {resumen.kpis.map((k, i) => (
            <div key={i} style={{ background:"rgba(255,255,255,0.02)", border:`1px solid ${C.border}`, borderRadius:10, padding:"10px 12px" }}>
              <div style={{ fontSize:10.5, color:C.textMuted, marginBottom:4 }}>{k.label}</div>
              <div style={{ fontSize:16, fontWeight:600, color:C.text, fontFamily:MONO, letterSpacing:"0.2px", fontVariantNumeric:"tabular-nums" }}>{k.value}</div>
            </div>
          ))}
        </div>
        {/* la LECTURA de ADI + los focos del día (el diagnóstico vivo · click abre esa conversación) */}
        <div>
          <div style={{ fontSize:12, color:C.textSub, lineHeight:1.55, padding:"10px 12px", border:`1px solid ${C.border}`, borderRadius:10, background:"rgba(47,184,218,0.03)", marginBottom:9 }}>
            <span style={{ color:C.celeste, fontWeight:600 }}>ADI · </span>{resumen.lectura}
          </div>
          {(resumen.focos || []).length > 0 && (
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(150px, 1fr))", gap:8 }}>
              {resumen.focos.map((f, i) => (
                <button key={i} onClick={onAsk ? () => onAsk(_MESA_FOCO_ASK[f.detector] || "¿Dónde estoy perdiendo dinero?") : undefined}
                  title={onAsk ? `Preguntale a ADI: ${_MESA_FOCO_ASK[f.detector]}` : undefined}
                  style={{ display:"flex", flexDirection:"column", alignItems:"flex-start", gap:2, padding:"9px 12px", borderRadius:10, border:`1px solid ${C.border}`, borderLeft:"2px solid rgba(47,184,218,0.6)", borderRight:"2px solid rgba(47,184,218,0.6)", background:C.surface, color:C.text, fontFamily:"'DM Sans', system-ui, sans-serif", textAlign:"left", cursor: onAsk ? "pointer" : "default", transition:"background 0.15s" }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = C.surfaceHover; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = C.surface; }}>
                  <span style={{ fontSize:14.5, fontWeight:600, color:C.celeste, fontFamily:MONO, letterSpacing:"0.2px" }}>{f.usdFmt}</span>
                  <span style={{ fontSize:11, color:C.textSub, lineHeight:1.3 }}>{f.label} <span style={{ color:C.celeste }}>→</span></span>
                </button>
              ))}
            </div>
          )}
        </div>
        {/* el 80/20 · el principio del owner SIEMPRE visible (data-driven: el % real, nunca forzado) · EXPLICADO (2026-07-08) */}
        <div>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:9 }}>
            <div style={{ ...head, display:"flex", alignItems:"center", gap:4 }}>El 80/20 · cómo se compone tu venta<InfoDot def={"El principio de Pareto: pocas cuentas explican la mayor parte del resultado. El corte muestra el % REAL de tu dato (nunca se fuerza el 80). Para qué sirve: saber a quién blindar (el bloque que sostiene la venta) y qué decidir con la cola (crecerla o simplificarla)."} align="left"/></div>
            <div style={{ display:"flex", gap:3 }}>
              {CONCENTRATION_DIMS.map((d) => (
                <button key={d.key} onClick={() => setConDim(d.key)}
                  style={{ padding:"3px 9px", borderRadius:6, border:`1px solid ${conDim === d.key ? "rgba(47,184,218,0.5)" : C.border}`, background: conDim === d.key ? "rgba(47,184,218,0.10)" : "transparent", color: conDim === d.key ? C.celeste : C.textMuted, fontSize:10.5, fontWeight:600, cursor:"pointer", fontFamily:"'DM Sans', system-ui, sans-serif" }}>{d.label}</button>
              ))}
            </div>
          </div>
          <div style={{ fontSize:12.5, color:C.text, lineHeight:1.5, marginBottom:9, paddingLeft:10, borderLeft:`2px solid ${C.celeste}` }}>
            <b style={{ color:C.celeste }}>{con.blockCount} de {con.n} {con.plural}</b> explican el <b>{con.blockPct}%</b> de tu venta.
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
            {bars.map((b, i) => (
              <AskRow key={i} onAsk={onAsk} q={`Profundiza en ${b.name}`} style={{ display:"flex", alignItems:"center", gap:9 }}>
                <span style={{ fontSize:12, color: b.inBlock ? C.text : C.textMuted, fontWeight: b.inBlock ? 600 : 400, width:118, flexShrink:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{b.name}</span>
                <div style={{ flex:1, height:8, background:"rgba(255,255,255,0.05)", borderRadius:4, overflow:"hidden" }}>
                  <div style={{ width:`${Math.max(2, b.pct / maxPct * 100)}%`, height:"100%", background: b.inBlock ? C.blue : "rgba(255,255,255,0.2)", opacity:0.85 }}/>
                </div>
                <span style={{ fontFamily:MONO, fontSize:11, color: b.inBlock ? C.text : C.textMuted, width:40, textAlign:"right", flexShrink:0 }}>{p1(b.pct)}%</span>
                <span style={{ fontFamily:MONO, fontSize:10.5, color: b.cumPct <= 80 ? C.green : C.textMuted, width:42, textAlign:"right", flexShrink:0 }}>{p1(b.cumPct)}%</span>
              </AskRow>
            ))}
          </div>
          {con.n > bars.length ? <div style={{ fontSize:10.5, color:C.textMuted, marginTop:6 }}>+{con.n - bars.length} más en el cuadro de abajo.</div> : null}
          {/* la LECTURA del 80/20 (owner 2026-07-08: "si muestra el 80% también debe ser explicado") · qué significa y qué decisión habilita */}
          <div style={{ fontSize:11.5, color:C.textSub, lineHeight:1.55, marginTop:9, padding:"9px 11px", border:`1px solid ${C.border}`, borderRadius:9, background:"rgba(47,184,218,0.03)" }}>
            <span style={{ color:C.celeste, fontWeight:600 }}>ADI · </span>
            {con.blockCount <= Math.ceil(con.n / 2)
              ? <>Tu venta por {con.label.toLowerCase()} está <b>concentrada</b>: {con.blockCount} de {con.n} {con.plural} cargan el {con.blockPct}% — blindarlos es prioridad (perder uno pega directo), y la cola ({con.n - con.blockCount} {con.plural}) aporta solo el {100 - con.blockPct}%: decidí si la crecés o la simplificás.</>
              : <>Tu venta por {con.label.toLowerCase()} está <b>repartida</b>: hacen falta {con.blockCount} de {con.n} {con.plural} para juntar el {con.blockPct}% — el riesgo está distribuido; acá pesan más las palancas por {con.label.toLowerCase()} que el blindaje de unos pocos.</>}
          </div>
        </div>
        {/* el CUADRO DE MANDO · la grilla operable que ya existía (ordenar · filtrar · top-N · seleccionar) */}
        <div>
          <div style={{ ...head, marginBottom:9 }}>Cuadro de mando · todas tus cifras, operables</div>
          <CuadroMando key={"mesa-" + scenario} scenario={scenario} initialDim="cliente" mesa onAsk={onAsk}/>
        </div>
        <div style={{ fontSize:10.5, color:C.textMuted, lineHeight:1.5 }}>La Mesa es tu negocio en vivo: la lectura y los focos son de ADI (mismas cuentas que sus respuestas — una sola verdad), el 80/20 muestra el % real de tu dato (nunca forzado), y el cuadro se ordena y filtra. Click en una fila o un foco y ADI te lo desglosa al lado. Cifras de dato real.</div>
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
  if (!baseRd) {
    // RANKING PANORÁMICO → el Cuadro directo. "los N mejores/peores clientes/SKU" no tiene un foco ÚNICO (no hay reading
    // de UNA entidad), pero el Cuadro es una vista de dimensión COMPLETA que no necesita foco → abrimos el Cuadro solo,
    // en la dimensión del ranking. Sin esto el panel no renderiza (exige baseRd). Gated CUADRO · sin-lente/OFF = null (byte-exacto).
    // SIMULACIÓN · un supuesto sobre el dato real (transform) → la mesa Actual/Supuesto/Δ. Va ANTES que el Cuadro genérico.
    if (evidence && evidence.transform && Array.isArray(evidence.projection))
      return <SimulationPanel evidence={evidence} onClose={onClose} onToggleMax={onToggleMax} maximized={maximized}/>;
    // DIAGNÓSTICO · los FOCOS (evidence.findings) = la evidencia de lo que el texto dice · va ANTES del Cuadro genérico.
    if (evidence && Array.isArray(evidence.findings) && evidence.findings.length)
      return <DiagnosePanel evidence={evidence} onClose={onClose} onToggleMax={onToggleMax} maximized={maximized} onAsk={onAsk}/>;
    // COMPARACIÓN · evidencia LADO A LADO (A vs B, métrica por métrica) = lo que ADI afirma en el texto · antes del Cuadro.
    if (evidence && Array.isArray(evidence.pairs) && evidence.pairs.length && (evidence.compareB || evidence.entityB))
      return <ComparePanel evidence={evidence} onClose={onClose} onToggleMax={onToggleMax} maximized={maximized}/>;
    // MESA DE CONTROL · Sentrix EN OPERACIÓN (botón del header · no atada a una respuesta) — el modo "vivo mi negocio acá".
    if (evidence && evidence.lens === "mesa")
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
      </div>

      {/* SHELL · 3 tabs sobre el estado compartido (mismo caso, distinta lente) · gated · OFF = sin tabs (byte-exacto) */}
      {ADI_SENTRIX_SHELL_ENABLED && (
        <div style={{ flexShrink:0, display:"flex", gap:2, padding:"0 14px", borderBottom:`1px solid ${C.border}`, background:"#000000" }}>
          {[["diagnostico", "Diagnóstico"], ["evidencia", "Evidencia"], ...(showControl ? [["control", "Control"]] : []), ...(ADI_SENTRIX_CUADRO_ENABLED ? [["cuadro", "Cuadro de mando"]] : [])].map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)}
              style={{ padding:"9px 13px", background:"transparent", border:"none", borderBottom:`2px solid ${effTab === k ? C.text : "transparent"}`, color: effTab === k ? C.text : C.textMuted, fontSize:12.5, fontWeight: effTab === k ? 600 : 400, cursor:"pointer", fontFamily:"'DM Sans', system-ui, sans-serif", whiteSpace:"nowrap" }}>
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
            ? <EvidenciaRecibo receipt={receipt}/>
            : <div>
                <Eyebrow>La cuenta de {rd.focus}</Eyebrow>
                {Evidence
                  ? <Card><Evidence rd={rd}/></Card>
                  : <div style={{ fontSize:12.5, color:C.textMuted, lineHeight:1.6, padding:"4px 2px" }}>Sin cuenta detallada para esta lectura.</div>}
              </div>
        )}

        {ADI_SENTRIX_SHELL_ENABLED && effTab === "control" && (
          ring ? <ControlRing ring={ring} rd={rd}/> : <LensPlaceholder tab="control" focus={rd.focus}/>
        )}

        {ADI_SENTRIX_SHELL_ENABLED && ADI_SENTRIX_CUADRO_ENABLED && effTab === "cuadro" && (
          <CuadroMando scenario={evidence.periodo}/>
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

// ── CUADRO DE MANDO (4ª lente) · la GRILLA operable · cockpit: ver y manejar TODO el dato ──
// Dimensiones (clientes/SKU/marcas/bodegas) × columnas del catálogo · ordenar · top-N · en-alerta · seleccionar y
// comparar (filtra al resto) · fila promedio de referencia · acción derivada · alerta honesta. NO Power BI: premium.
function CuadroMando({ scenario, initialDim, initialSort, mesa = false, onAsk = null }) {
  const [dim, setDim] = useState(initialDim || "cliente");
  const [sel, setSel] = useState([]);                 // nombres seleccionados (resaltan · TODAS las filas quedan visibles)
  // memoria UI (owner 2026-07-08): la selección de la Mesa es contexto de ADI ("compará estos dos" la referencia)
  useEffect(() => { if (mesa) setUISignal({ mesaSel: sel, mesaDim: dim }); }, [mesa, sel, dim]);
  const [onlySel, setOnlySel] = useState(false);      // "solo seleccionados" → filtra al resto (el filtro del owner)
  const [mode, setMode] = useState("all");            // all | top | bottom | alert
  const [scope, setScope] = useState("global");       // global | fecha (honesto)
  const cm = buildCuadroMando(dim, scenario);
  const cols = cm.columns;
  const primary = cols.find((c) => c.key !== "accion") || cols[0];
  // si el overview trae una métrica que ES una columna (ej. "margen por cliente" → columna margen), abrimos ordenando por ahí.
  const [sortKey, setSortKey] = useState(initialSort && cols.some((c) => c.key === initialSort) ? initialSort : primary.key);
  const money = (v) => "$" + (v / 1000).toFixed(1) + "M";       // dato en $K → $M (columnas comerciales)
  const moneyk = (v) => "$" + (Math.abs(v) / 1000).toFixed(1) + "K";   // dato en $ → $K (inventario)
  const fmt = (col, v) => {
    if (v == null) return "—";
    if (col.fmt === "money")  return money(v);
    if (col.fmt === "moneyk") return moneyk(v);
    if (col.fmt === "pct")    return p1(v) + "%";
    if (col.fmt === "x")      return r1(v) + "x";
    if (col.fmt === "int")    return Math.round(v).toLocaleString("es-CL");
    if (col.fmt === "pp")     return v === 0 ? "—" : (v > 0 ? "+" : "") + p1(v) + "pp";
    return v;
  };
  const cellColor = (col, r) => {
    if (col.fmt === "pp")     return r._ref || r[col.key] === 0 ? C.textMuted : (r[col.key] >= 0 ? C.green : C.red);
    if (col.tone === "margen")return r._ref ? C.textSub : (r.gap >= 0 ? C.green : r.gap <= -3 ? C.red : C.amber);
    if (col.tone === "inmov") return r._ref ? C.textSub : (r.gap < 0 ? C.amber : C.textSub);
    if (col.fmt === "money" || col.fmt === "moneyk") return C.text;
    return C.textSub;
  };
  const sortCol = cols.find((c) => c.key === sortKey) || primary;
  let rows = cm.rows.slice().sort((a, b) => (sortCol.sort === "asc" ? -1 : 1) * ((b[sortKey] || 0) - (a[sortKey] || 0)));
  if (onlySel && sel.length) rows = rows.filter((r) => sel.includes(r.name));   // el filtro ES una acción aparte (no al seleccionar)
  else if (mode === "top") rows = rows.slice(0, 10);
  else if (mode === "bottom") rows = rows.slice(-10);
  else if (mode === "alert") rows = rows.filter((r) => r.alert);
  const toggleSel = (n) => setSel((s) => (s.includes(n) ? s.filter((x) => x !== n) : [...s, n]));
  const GRID = `20px 1.4fr ${cols.map(() => "1fr").join(" ")}`;
  const pill = (active, label, onClick, key) => (
    <button key={key} onClick={onClick} style={{ padding:"4px 10px", borderRadius:6, fontSize:11.5, cursor:"pointer", fontFamily:"'DM Sans', system-ui, sans-serif", whiteSpace:"nowrap",
      background: active ? "rgba(255,255,255,0.1)" : "transparent", border:`1px solid ${active ? "rgba(255,255,255,0.35)" : C.border}`, color: active ? C.text : C.textMuted }}>{label}</button>
  );
  const actionColor = (a) => (/revisar|renegociar|liquidar|acelerar|precio|mix|lento/.test(a) ? C.amber : /referencia/.test(a) ? C.green : C.textMuted);
  // ICONO DE ESTADO del margen (owner: el margen con icono, no color en el número · identifica rojo/ámbar/verde) ·
  // chevron ↑ verde (sobre el prom) · — ámbar (parejo) · ↓ rojo (bajo el prom) · con glow, premium.
  const statusOf = (r) => (r.gap == null ? null : r.gap >= 0 ? "g" : r.gap <= -3 ? "r" : "a");
  const statusCol = { g: C.green, a: C.amber, r: C.red };
  const MargenIcon = ({ st }) => (st ? (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke={statusCol[st]} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ filter:`drop-shadow(0 0 3px ${statusCol[st]}88)`, flexShrink:0 }}>
      {st === "g" ? <polyline points="3 8 6 4.5 9 8"/> : st === "r" ? <polyline points="3 4.5 6 8 9 4.5"/> : <line x1="3" y1="6" x2="9" y2="6"/>}
    </svg>
  ) : null);
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
      {/* dimensión + alcance */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:8 }}>
        <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
          {CUADRO_DIMS.map((d) => pill(dim === d.key, d.label, () => { setDim(d.key); setSel([]); setSortKey(primary.key); }, d.key))}
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
        <div style={{ minWidth: 40 + cols.length * 66 + 120 }}>
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
                  <span style={{ color:"#eef2f6", fontWeight:600, fontSize:12.5, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{r.name}</span>
                  {mesa && onAsk ? (
                    <button onClick={(e) => { e.stopPropagation(); onAsk(`Profundiza en ${r.name}`); }} title={`Preguntale a ADI: Profundiza en ${r.name}`}
                      style={{ padding:"1px 7px", borderRadius:5, border:`1px solid ${C.border}`, background:"transparent", color:C.textMuted, fontSize:8.5, fontFamily:MONO, letterSpacing:"0.5px", cursor:"pointer", flexShrink:0, transition:"all 0.15s" }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = C.celeste; e.currentTarget.style.borderColor = "rgba(47,184,218,0.45)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = C.textMuted; e.currentTarget.style.borderColor = C.border; }}>ADI</button>
                  ) : null}
                </span>
                {cols.map((c) => c.key === "accion" ? (
                  <span key={c.key} style={{ fontSize:11, color:actionColor(r.accion), whiteSpace:"nowrap" }}>{r.accion}</span>
                ) : c.key === "margen" ? (
                  <span key={c.key} style={{ display:"flex", alignItems:"center", justifyContent:"flex-end", gap:6 }}>
                    <MargenIcon st={statusOf(r)}/><Num color={C.text}>{fmt(c, r[c.key])}</Num>
                  </span>
                ) : (
                  <span key={c.key} style={{ textAlign:"right" }}><Num color={cellColor(c, r)}>{fmt(c, r[c.key])}</Num></span>
                ))}
              </div>
            );
          })}
          {/* fila TOTALES · el resumen operativo (sumas · margen ponderado) */}
          {!onlySel && cm.total && (
            <div style={{ display:"grid", gridTemplateColumns:GRID, gap:"0 8px", alignItems:"center", padding:"10px 8px", marginTop:4, borderTop:`1px solid ${C.borderLight}`, background:"rgba(255,255,255,0.02)" }}>
              <span/><span style={{ fontFamily:MONO, fontSize:9, fontWeight:600, letterSpacing:"0.6px", textTransform:"uppercase", color:C.text }}>Total</span>
              {cols.map((c) => c.key === "accion" ? <span key={c.key}/> : (
                <span key={c.key} style={{ textAlign:"right" }}><Num color={c.key === "margen" ? C.text : c.fmt === "pp" ? C.textMuted : C.text}>{cm.total[c.key] == null ? "—" : fmt(c, cm.total[c.key])}</Num></span>
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
      {/* al seleccionar EXACTAMENTE 2 → en la MESA el Perfil comparado para CUALQUIER dimensión (owner 2026-07-08: "en su
          plenitud" — las estaciones salen de las columnas del eje); en la lente Control, el dumbbell original (cliente). */}
      {sel.length === 2 && (mesa
        ? <MesaCompare a={sel[0]} b={sel[1]} rowA={cm.rows.find((r) => r.name === sel[0])} rowB={cm.rows.find((r) => r.name === sel[1])} columns={cm.columns} dim={dim} scenario={scenario} onAsk={onAsk}/>
        : (dim === "cliente" ? <ComparacionChart a={sel[0]} b={sel[1]} scenario={scenario}/> : null))}
      <div style={{ fontSize:11, color:C.textMuted, lineHeight:1.5 }}>
        Tocá una fila para seleccionar y comparar{mesa || dim === "cliente" ? " (2 → gráfico)" : ""} · ordená por cualquier columna{mesa && onAsk ? <> · el botón <span style={{ fontFamily:MONO, fontSize:9.5, color:C.textSub }}>ADI</span> le pregunta por esa fila</> : null} · <span style={{ color:C.textSub }}>{cm.n} {cm.plural}</span> · escenario {scenario}.
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
              <text x={xa} y={y - 9} textAnchor="middle" fill={colA} fontSize="9.5" fontFamily={MONO}>{p1(r.va)}%</text>
              <text x={xb} y={y + 16} textAnchor="middle" fill={colB} fontSize="9.5" fontFamily={MONO}>{p1(r.vb)}%</text>
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
        : <> — la subida fuerte llega {E.growth.from}→{E.growth.mes} (+{fmV(E.growth.delta)}) y el freno {E.drop.from}→{E.drop.mes} (−{fmV(Math.abs(E.drop.delta))}); su mejor mes es <span style={{ color:C.green }}>{E.maxMes}</span> ({fmV(E.max)}) y el más flojo <span style={{ color:C.red }}>{E.minMes}</span> ({fmV(E.min)}).</>}
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
            <rect x={tipX} y={tipY} width={tipW} height={tipH} rx="6" fill="#181715" stroke={C.borderLight} strokeWidth="1"/>
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
        <span style={{ marginLeft:"auto", fontFamily:MONO, fontSize:10, color:C.textMuted }}>mejor mes <span style={{ color:C.green }}>{ev.maxMes} {fmV(ev.max)}</span> · más flojo <span style={{ color:C.red }}>{ev.minMes} {fmV(ev.min)}</span></span>
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
            <rect x={tipX} y={tipY} width={tipW} height={26} rx="6" fill="#181715" stroke={C.borderLight} strokeWidth="1"/>
            <text x={tipX + 8} y={tipY + 11} fill={C.textSub} fontSize="8.5" fontFamily={MONO}>{labels[hov]}</text>
            <text x={tipX + 8} y={tipY + 21} fill={C.celeste} fontSize="9.5" fontWeight="600" fontFamily={MONO}>{fmV(serie[hov])}</text>
          </g>
        )}
      </svg>
      {/* LECTURA DEL PERÍODO (owner: los MESES de alzas/desvíos, en lenguaje de negocio) — derivada de la serie mostrada */}
      <div style={{ fontSize:11, color:C.textSub, lineHeight:1.55, marginTop:8 }}>
        El mejor mes es <span style={{ color:C.green }}>{labels[iMax]}</span> ({fmV(hi)}) y el más flojo <span style={{ color:C.red }}>{labels[iMin]}</span> ({fmV(lo)}).
        {gRise.delta > 0 && <> La subida más fuerte llega {labels[gRise.i - 1]}→{labels[gRise.i]} (+{fmV(gRise.delta)}).</>}
        {gDrop.delta < 0 && <> El freno más fuerte, {labels[gDrop.i - 1]}→{labels[gDrop.i]} (−{fmV(Math.abs(gDrop.delta))}).</>}
      </div>
      <div style={{ fontSize:10.5, color:C.textMuted, lineHeight:1.5, marginTop:6 }}>
        La película GLOBAL de tu venta ({per} meses · dato real mensual) — pasá el cursor por la curva para ver cada mes. El corte mensual de {a} y {b} por separado se enciende con el histórico del ERP — no te dibujo una serie que no existe.
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
function MesaCompare({ a, b, rowA, rowB, columns = null, dim = "cliente", scenario, onAsk }) {
  const [selSt, setSelSt] = useState(null);   // estación seleccionada (detalle por período) · hook SIEMPRE primero
  const fm = (v) => "$" + (v / 1000).toFixed(1) + "M";
  const fmk = (v) => "$" + (Math.abs(v) / 1000).toFixed(1) + "K";
  const fp = (v) => p1(v) + "%";
  const fmtOf = { money: fm, moneyk: fmk, pct: fp, x: (v) => r1(v) + "x", int: (v) => Math.round(v).toLocaleString("es-CL"), pp: (v) => p1(v) + "pp" };
  let axes = [], dA = null, dB = null;
  if (dim === "cliente") {
    dA = buildMarginDecomposition(a, scenario); dB = buildMarginDecomposition(b, scenario);
    if (dA && dB && rowA && rowB) axes = [
      { label: "Ventas",       va: rowA.ventas,       vb: rowB.ventas,       fmt: fm, hiBetter: true },
      { label: "Contribución", va: rowA.contribucion, vb: rowB.contribucion, fmt: fm, hiBetter: true },
      { label: "Margen",       va: dA.margen,         vb: dB.margen,         fmt: fp, hiBetter: true,  ref: benchmarkOf(null),    refLabel: "piso" },
      { label: "Carga",        va: dA.cargaPct,       vb: dB.cargaPct,       fmt: fp, hiBetter: false, ref: POLICY.targetCarga,   refLabel: "target" },
      { label: "Costo",        va: dA.costoPct,       vb: dB.costoPct,       fmt: fp, hiBetter: false },
    ];
  } else if (rowA && rowB) {
    // estaciones = las COLUMNAS del cuadro de ese eje (sin acción/gap) · sort "asc" = menos es mejor · refs de POLICY donde aplican
    axes = (columns || []).filter((c) => c.key !== "accion" && c.key !== "gap").map((c) => ({
      label: c.label, va: rowA[c.key], vb: rowB[c.key], fmt: fmtOf[c.fmt] || ((v) => String(v)), hiBetter: c.sort !== "asc",
      ...(c.key === "margen" ? { ref: benchmarkOf(null), refLabel: "piso" } : {}),
      ...(c.key === "rotacion" ? { ref: POLICY.rotacionMin, refLabel: "piso" } : {}),
    }));
  }
  axes = axes.filter((ax) => typeof ax.va === "number" && typeof ax.vb === "number");
  if (axes.length < 2) return null;
  const W = 620, H = 216, padT = 30, padB = 42, padL = 52, padR = 34;
  const n = axes.length;
  const xs = axes.map((_, i) => padL + i * (W - padL - padR) / Math.max(1, n - 1));
  const yOf = (ax, v) => {
    const lo = Math.min(ax.va, ax.vb), hi = Math.max(ax.va, ax.vb);
    const rng = Math.max(hi - lo, Math.abs(hi) * 0.06, 0.5);           // escala del PAR (la diferencia real siempre se ve)
    const axLo = lo - rng * 0.55, axHi = hi + rng * 0.55;
    let t = (v - axLo) / (axHi - axLo);
    if (!ax.hiBetter) t = 1 - t;                                        // menos carga/costo = mejor → ARRIBA
    return padT + (1 - t) * (H - padT - padB);
  };
  const colA = C.elec, colB = C.teal;
  const ptsA = axes.map((ax, i) => ({ x: xs[i], y: yOf(ax, ax.va) }));
  const ptsB = axes.map((ax, i) => ({ x: xs[i], y: yOf(ax, ax.vb) }));
  const path = (pts) => pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const winA = axes.map((ax) => (ax.va === ax.vb ? null : ax.hiBetter ? ax.va > ax.vb : ax.va < ax.vb));
  const scoreA = winA.filter((w) => w === true).length, scoreB = winA.filter((w) => w === false).length;
  // veredicto · cliente: la palanca estructural (margen/costo/carga) · otros ejes: el líder del perfil (genérico honesto)
  const bWins = dim === "cliente" && dA && dB ? dB.margen >= dA.margen : scoreB > scoreA;
  const lever = dim === "cliente" && dA && dB ? (Math.abs(dA.costoPct - dB.costoPct) >= Math.abs(dA.cargaPct - dB.cargaPct) ? "estructura de costo" : "carga comercial") : null;
  return (
    <Card>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:8 }}>
        <Eyebrow def={METRIC_DEFS["Comparación controlada"]}>Perfil comparado · arriba = mejor</Eyebrow>
        <span style={{ fontFamily:MONO, fontSize:10, color:C.textMuted }}>
          <span style={{ color:colA, fontWeight:600 }}>{a}</span> gana {scoreA} · <span style={{ color:colB, fontWeight:600 }}>{b}</span> gana {scoreB} de {n}
        </span>
      </div>
      <div style={{ display:"flex", gap:16, margin:"6px 0 2px", flexWrap:"wrap" }}>
        {[[a, colA], [b, colB]].map(([nm, col]) => (
          <span key={nm} style={{ display:"flex", alignItems:"center", gap:6, fontSize:11.5, color:C.textSub }}>
            <span style={{ width:14, height:3, borderRadius:2, background:col, boxShadow:`0 0 6px ${col}88` }}/>{nm}
          </span>
        ))}
        <span style={{ display:"flex", alignItems:"center", gap:6, fontSize:11, color:C.textMuted }}>
          <span style={{ width:14, height:0, borderTop:`1.5px dashed ${C.amber}`, opacity:0.9 }}/>tu piso / target
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width:"100%", height:"auto", display:"block" }}>
        {/* estaciones (ejes verticales suaves) + labels · CLICKEABLES → detalle por período (owner 2026-07-08: vida) */}
        {axes.map((ax, i) => (
          <g key={i} onClick={() => { const next = selSt === ax.label ? null : ax.label; setSelSt(next); setUISignal({ station: next }); }} style={{ cursor: "pointer" }}>
            <line x1={xs[i]} y1={padT - 8} x2={xs[i]} y2={H - padB + 8} stroke={selSt === ax.label ? "rgba(47,184,218,0.35)" : "rgba(255,255,255,0.07)"} strokeWidth={selSt === ax.label ? 1.5 : 1}/>
            <text x={xs[i]} y={H - padB + 26} textAnchor="middle" fill={selSt === ax.label ? C.celeste : C.textSub} fontSize="11" fontFamily="'DM Sans', system-ui, sans-serif" fontWeight="600" style={{ textDecoration: selSt === ax.label ? "underline" : "none" }}>{ax.label}</text>
            {!ax.hiBetter && <text x={xs[i]} y={H - padB + 38} textAnchor="middle" fill={C.textMuted} fontSize="8.5" fontFamily={MONO}>menos = mejor</text>}
          </g>
        ))}
        {/* guía de lectura */}
        <text x={padL - 40} y={padT + 2} fill={C.textMuted} fontSize="8.5" fontFamily={MONO}>mejor</text>
        <text x={padL - 40} y={H - padB} fill={C.textMuted} fontSize="8.5" fontFamily={MONO}>peor</text>
        {/* la LÍNEA DE BENCHMARK/TARGET por estación (owner 2026-07-07) · criterio-aware · si queda fuera del rango del
            par se ancla al borde con flecha ("piso 30.1% ↑" = el piso está aún más arriba que ambos → los dos abajo) */}
        {axes.map((ax, i) => {
          if (ax.ref == null) return null;
          const rawY = yOf(ax, ax.ref);
          const cTop = rawY < padT - 4, cBot = rawY > H - padB + 4;
          const y = Math.max(padT - 4, Math.min(H - padB + 4, rawY));
          return (
            <g key={"ref" + i}>
              <line x1={xs[i] - 17} x2={xs[i] + 17} y1={y} y2={y} stroke={C.amber} strokeWidth="1.4" strokeDasharray="3 3" opacity="0.9"/>
              <text x={xs[i] + 21} y={y + 3} fill={C.amber} fontSize="8.5" fontFamily={MONO} opacity="0.95">{ax.refLabel} {ax.fmt(ax.ref)}{cTop ? " ↑" : cBot ? " ↓" : ""}</text>
            </g>
          );
        })}
        {/* las dos líneas (el perfil) · glow premium BARATO (doble trazo, sin filtros SVG — no cuelga compositores lentos) */}
        <path d={path(ptsA)} fill="none" stroke={colA} strokeWidth="7" strokeLinejoin="round" opacity="0.16"/>
        <path d={path(ptsB)} fill="none" stroke={colB} strokeWidth="7" strokeLinejoin="round" opacity="0.16"/>
        <path d={path(ptsA)} fill="none" stroke={colA} strokeWidth="2.2" strokeLinejoin="round" opacity="0.95"/>
        <path d={path(ptsB)} fill="none" stroke={colB} strokeWidth="2.2" strokeLinejoin="round" opacity="0.95"/>
        {/* puntos + aro del ganador + cifras reales (el de arriba etiqueta arriba · el de abajo, abajo — sin choques) */}
        {axes.map((ax, i) => {
          const pa = ptsA[i], pb = ptsB[i];
          const aTop = pa.y <= pb.y;
          return (
            <g key={"p" + i}>
              {winA[i] === true  && <circle cx={pa.x} cy={pa.y} r="8.5" fill="none" stroke={colA} strokeWidth="1" opacity="0.5"/>}
              {winA[i] === false && <circle cx={pb.x} cy={pb.y} r="8.5" fill="none" stroke={colB} strokeWidth="1" opacity="0.5"/>}
              <circle cx={pa.x} cy={pa.y} r="4.5" fill={colA} stroke="#000" strokeWidth="1.5"/>
              <circle cx={pb.x} cy={pb.y} r="4.5" fill={colB} stroke="#000" strokeWidth="1.5"/>
              <text x={pa.x} y={aTop ? pa.y - 13 : pa.y + 21} textAnchor="middle" fill={colA} fontSize="10" fontFamily={MONO} fontWeight="600">{ax.fmt(ax.va)}</text>
              <text x={pb.x} y={aTop ? pb.y + 21 : pb.y - 13} textAnchor="middle" fill={colB} fontSize="10" fontFamily={MONO} fontWeight="600">{ax.fmt(ax.vb)}</text>
            </g>
          );
        })}
      </svg>
      <div style={{ fontSize:10, color:C.textMuted, fontFamily:MONO, marginTop:2 }}>tocá una estación para ver su período ↓</div>
      {/* DETALLE POR PERÍODO (owner 2026-07-08 · "darle vida al gráfico"): la estación elegida en el tiempo — la serie
          GLOBAL real cuando existe (ventas mensuales); el corte por entidad se enciende con el ERP (honesto, sin fingir). */}
      {selSt && (() => {
        const ax = axes.find((x) => x.label === selSt);
        if (!ax) return null;
        return (
          <div style={{ marginTop:10, padding:"11px 13px", border:"1px solid rgba(47,184,218,0.25)", borderRadius:10, background:"rgba(47,184,218,0.04)" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:7 }}>
              <span style={{ fontFamily:MONO, fontSize:9.5, letterSpacing:"0.6px", color:C.celeste, textTransform:"uppercase" }}>{ax.label} · por período</span>
              <button onClick={() => setSelSt(null)} style={{ background:"transparent", border:"none", color:C.textMuted, cursor:"pointer", fontSize:12 }}>✕</button>
            </div>
            <div style={{ fontSize:12, color:C.textSub, marginBottom:8 }}>
              Hoy (dato real): <span style={{ color:colA, fontFamily:MONO, fontWeight:600 }}>{a} {ax.fmt(ax.va)}</span> · <span style={{ color:colB, fontFamily:MONO, fontWeight:600 }}>{b} {ax.fmt(ax.vb)}</span>
            </div>
            {(() => {
              // dos curvas cuando la serie mensual POR ENTIDAD existe en el dataset (venta/contribución) — owner 2026-07-08
              const metric = /venta/i.test(ax.label) ? "venta" : /contribuci/i.test(ax.label) ? "contribucion" : null;
              const cmp = metric ? buildCompareEvolution(a, b, metric) : null;
              if (cmp) return <StationCompareFilm cmp={cmp}/>;
              if (metric === "venta") return <StationPeriodo a={a} b={b}/>;   // sin historial por entidad (p.ej. bodegas) → película GLOBAL
              return (
                <div style={{ fontSize:11, color:C.textMuted, lineHeight:1.5 }}>
                  El histórico mensual de {ax.label.toLowerCase()} se enciende con el ERP — hoy tengo el período actual (arriba, dato real). No te dibujo una serie que no existe.
                </div>
              );
            })()}
          </div>
        );
      })()}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:10, marginTop:8, paddingTop:9, borderTop:`1px solid ${C.border}` }}>
        <div style={{ fontSize:11.5, color:C.textMuted, lineHeight:1.5, minWidth:0 }}>
          {lever
            ? <><span style={{ color: bWins ? colB : colA, fontWeight:600 }}>{bWins ? b : a}</span> saca mejor margen — la palanca que los separa es la <span style={{ color:C.textSub }}>{lever}</span>. Donde las líneas se cruzan, cambia quién gana.</>
            : scoreA === scoreB
            ? <>Perfil parejo — <span style={{ color:colA, fontWeight:600 }}>{a}</span> y <span style={{ color:colB, fontWeight:600 }}>{b}</span> ganan las mismas estaciones. Donde las líneas se cruzan, cambia quién gana.</>
            : <><span style={{ color: bWins ? colB : colA, fontWeight:600 }}>{bWins ? b : a}</span> domina el perfil ({Math.max(scoreA, scoreB)} de {n} estaciones). Donde las líneas se cruzan, cambia quién gana.</>}
        </div>
        {onAsk ? (
          <button onClick={() => onAsk(`Compará ${a} vs ${b}`)} title={`Preguntale a ADI: Compará ${a} vs ${b}`}
            style={{ display:"flex", alignItems:"center", gap:6, padding:"6px 12px", borderRadius:8, border:"1px solid rgba(47,184,218,0.45)", background:"rgba(47,184,218,0.08)", color:C.celeste, fontSize:11.5, fontWeight:600, cursor:"pointer", fontFamily:"'DM Sans', system-ui, sans-serif", whiteSpace:"nowrap", flexShrink:0, transition:"background 0.15s" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(47,184,218,0.15)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(47,184,218,0.08)"; }}>
            Que ADI los compare a fondo →
          </button>
        ) : null}
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
            <text x="9" y="30" fill={C.textSub} fontSize="8.5" fontFamily={MONO}>{p1(b.pct)}% del total</text>
            <text x="9" y="41" fill={C.amber} fontSize="8.5" fontFamily={MONO}>acumulado: {p1(b.cumPct)}%</text>
          </g>
        ); })()}
      </svg>

      <div style={{ fontSize:11, color:C.textMuted, lineHeight:1.5, marginTop:10, paddingTop:10, borderTop:`1px solid ${C.border}` }}>
        Concentración {sp.byNoun} ($) · escenario {con.scenario} · <span style={{color:C.elec}}>barras azules</span> = el bloque que explica el 80.0% · <span style={{color:C.celeste}}>línea celeste</span> = acumulado, <span style={{color:C.red}}>punto rojo</span> = corte del 80.0%.
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
