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
import { ADI_SENTRIX_TEMPORAL_ENABLED } from "../config/voiceFlags.js";

const MONO = "'JetBrains Mono', ui-monospace, monospace";

function Eyebrow({ children, tone = C.blue }) {
  return (
    <div style={{ fontFamily:MONO, fontSize:9.5, fontWeight:600, color:tone, textTransform:"uppercase", letterSpacing:"1.4px", marginBottom:10 }}>
      {children}
    </div>
  );
}

function Card({ children, accent = false }) {
  return (
    <div style={{
      background: accent ? "linear-gradient(180deg, rgba(0,176,212,0.05), rgba(0,176,212,0.015))" : "rgba(255,255,255,0.018)",
      border: `1px solid ${accent ? "rgba(0,176,212,0.18)" : C.border}`,
      borderRadius:10, padding:"16px 18px",
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

// ══════════════════════════ PACKS (espejo del renderer · kind → {title, Hero, Evidence}) ══════════════════════════

// ── cliente · carga comercial · héroe = barra de PLATA recuperable, evidencia = la cuenta de la carga ──
function ClientLoadHero({ rd }) {
  const recK = rd.recoverableK || 0, recBPK = rd.recoverableBPK || 0;
  const pctAtProm = recBPK > 0 ? Math.max(4, Math.round((recK / recBPK) * 100)) : 100;
  return (
    <>
      <div style={{ display:"flex", alignItems:"baseline", gap:10, marginBottom:4, flexWrap:"wrap" }}>
        <Num color={C.amber} size="2.1em">{rd.montoFmt}</Num>
        <span style={{ fontSize:12.5, color:C.textMuted }}>margen · carga comercial <Num color={C.amber}>{rd.carga}%</Num> · <Num color={C.amber}>+{rd.vsPromedio}pp</Num> sobre el promedio ({rd.targetCarga}%)</span>
      </div>
      <div style={{ marginTop:14 }}>
        <div style={{ fontSize:11, color:C.textMuted, marginBottom:8 }}>Margen recuperable renegociando la carga (anual):</div>
        <div style={{ display:"flex", height:10, borderRadius:5, overflow:"hidden", background:"rgba(255,255,255,0.04)", border:`1px solid ${C.border}` }}>
          <div style={{ width:`${pctAtProm}%`, background:C.blue, transition:"width 0.4s ease" }}/>
          <div style={{ width:`${100-pctAtProm}%`, background:"rgba(0,176,212,0.22)", transition:"width 0.4s ease" }}/>
        </div>
        <div style={{ display:"flex", flexWrap:"wrap", gap:"6px 16px", marginTop:10 }}>
          <Legend color={C.blue} label="al promedio interno" v={fmtK(recK)}/>
          <Legend color="rgba(0,176,212,0.5)" label="a mejor práctica" v={fmtK(recBPK)}/>
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
    { k:"Recuperable al promedio (anual)", v:fmtK(rd.recoverableK), color:C.blue },
    { k:`Recuperable a mejor práctica (${(rd.bestPracticeCarga||3).toFixed(1)}%)`, v:fmtK(rd.recoverableBPK), color:C.blue },
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
        <Num color={C.blue} size="2.1em">{rd.montoFmt}</Num>
        <span style={{ fontSize:12.5, color:C.textMuted }}><Num color={C.blue}>{rd.pct}%</Num> del capital inmovilizado{rd.totalInmovFmt ? <> (<Num>{rd.totalInmovFmt}</Num> total)</> : null}</span>
      </div>
      <div style={{ marginTop:14 }}>
        <StackBar segments={[
          { label: rd.focus, pct: rd.pct, color:C.blue },
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
              <span style={{ color:"#7fdef0", fontWeight:500, fontSize:12.5, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{r.sku}</span>
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
      <Num color={C.blue} size="2.1em">{rd.montoFmt}</Num>
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
      <div style={{ fontSize:12, color:"#7fdef0", fontWeight:500, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", marginBottom:6 }}>{entity}</div>
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
                  background: on ? "rgba(0,194,232,0.15)" : "transparent", border:`1px solid ${on ? C.blue : C.border}`, color: on ? C.blue : C.textSub }}>
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
  useEffect(() => { if (baseRd) setStack([mkBase(baseRd)]); }, [baseFocus]);   // nueva respuesta → estado limpio
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
    <div style={{ display:"flex", flexDirection:"column", height:"100%", minHeight:0, background:C.surface, borderLeft:`1px solid ${C.border}` }}>
      {/* ── header del panel ── */}
      <div style={{ flexShrink:0, padding:"14px 18px", borderBottom:`1px solid ${C.border}`, background:"linear-gradient(180deg, rgba(0,176,212,0.03), transparent)" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
          <div style={{ display:"flex", alignItems:"center", gap:7, fontFamily:MONO, fontSize:9.5, letterSpacing:"0.8px", color:C.textMuted, textTransform:"uppercase", minWidth:0 }}>
            <span style={{ color:C.blue, fontWeight:600 }}>Sentrix</span>
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
          <span style={{ color:C.textMuted }}>Demostrando: </span>{rd.reframe}
        </div>
      </div>

      {/* ── cuerpo (scroll) ── */}
      <div style={{ flex:1, overflowY:"auto", minHeight:0, padding:18, display:"flex", flexDirection:"column", gap:14 }}>

        <Card accent>
          <Eyebrow>{pack.title(rd)}</Eyebrow>
          <Hero rd={rd}/>
        </Card>

        {Evidence && (
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
                <div key={i} style={{ background:"rgba(255,255,255,0.018)", border:`1px solid ${C.border}`, borderRadius:8, padding:"11px 13px" }}>
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
                El caso más sensible: <span style={{ color:"#7fdef0", fontWeight:500 }}>{rd.sensitive}</span>
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
                style={{ padding:"6px 12px", borderRadius:6, fontSize:12, cursor:"pointer", fontFamily:"'DM Sans', system-ui, sans-serif", background:"rgba(0,194,232,0.08)", border:`1px solid rgba(0,176,212,0.5)`, color:C.blue }}>
                {e.entity} →
              </button>
            ))}
          </div>
        )}
        {!current.compareWith && curExplorable && (canCompare || (metricOptions && metricOptions.length > 1)) && (
          <ExplorarBar explorable={curExplorable} onCompare={opCompare}
            metricOptions={metricOptions} currentMetric={current.metric} onMetric={setMetric}/>
        )}
        {/* LA HISTORIA (paso 4) · evolutivo global real cuando el flag está ON · slot honesto si OFF · solo en base */}
        {atBase && !current.compareWith && (
          ADI_SENTRIX_TEMPORAL_ENABLED
            ? <EvolutivoCard/>
            : (current.metric === "margen" && <TemporalSlot evidence={evidence}/>)
        )}
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
  const W = 520, H = 150, padL = 10, padR = 12, padT = 12, padB = 20;

  const SER = [
    { key:"actual",      label:"Este año",     color:C.blue,      data:ev.actual,      dashed:false },
    { key:"anterior",    label:"Año anterior", color:C.textMuted, data:ev.anterior,    dashed:true  },
    { key:"presupuesto", label:"Presupuesto",  color:C.amber,     data:ev.presupuesto, dashed:true  },
  ];
  const comp = view === "comp";
  const lines = comp ? SER.filter((s) => show[s.key])
                     : [{ key:"seq", label:"Ventas · 24 meses", color:C.blue, data:ev.seq24.map((p)=>p.v), dashed:false }];
  const xlabels = comp ? ev.meses : ev.seq24.map((p) => p.mes);
  const allVals = lines.flatMap((l) => l.data);
  const lo0 = allVals.length ? Math.min(...allVals) : 0, hi0 = allVals.length ? Math.max(...allVals) : 1;
  const span = (hi0 - lo0) || 1, ylo = lo0 - span * 0.14, yhi = hi0 + span * 0.14;
  const npts = xlabels.length || 1;
  const xAt = (i) => padL + (npts <= 1 ? 0 : (i / (npts - 1)) * (W - padL - padR));
  const yAt = (v) => padT + (1 - (v - ylo) / (yhi - ylo)) * (H - padT - padB);
  const dPath = (data) => data.map((v, i) => `${i === 0 ? "M" : "L"}${xAt(i).toFixed(1)},${yAt(v).toFixed(1)}`).join(" ");

  const aIdxMax = ev.actual.indexOf(ev.max), aIdxMin = ev.actual.indexOf(ev.min);
  const xi = (mi) => comp ? mi : ev.n + mi;                                   // en seq, el año actual arranca tras los 12
  const showActualMarks = comp ? show.actual : true;
  const fK = (n) => { const a = Math.abs(n), s = n < 0 ? "−" : ""; return a < 1000 ? s + "$" + Math.round(a) : s + "$" + (a / 1000).toFixed(a >= 10000 ? 0 : 1) + "K"; };

  const Chip = ({ on, color, label, onClick }) => (
    <button onClick={onClick} style={{ display:"flex", alignItems:"center", gap:5, padding:"3px 8px", borderRadius:5, cursor:"pointer", fontSize:10.5, fontFamily:"'DM Sans', system-ui, sans-serif", background: on ? "rgba(255,255,255,0.05)" : "transparent", border:`1px solid ${on?C.borderLight:C.border}`, color: on?C.textSub:C.textMuted, opacity: on?1:0.55 }}>
      <span style={{ width:9, height:2.5, borderRadius:2, background:color, flexShrink:0 }}/>{label}
    </button>
  );

  return (
    <Card>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:8, marginBottom:6 }}>
        <Eyebrow>La historia · ventas en el tiempo</Eyebrow>
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <span style={{ fontFamily:MONO, fontSize:8.5, fontWeight:600, color:C.green, textTransform:"uppercase", letterSpacing:"0.7px", padding:"2px 6px", borderRadius:4, background:"rgba(16,185,129,0.08)", border:"1px solid rgba(16,185,129,0.16)" }}>dato real · alta confianza</span>
          {["comp","seq"].map((v) => (
            <button key={v} onClick={()=>setView(v)} style={{ padding:"3px 8px", borderRadius:5, cursor:"pointer", fontSize:10.5, fontFamily:"'DM Sans', system-ui, sans-serif", background: view===v?"rgba(0,176,212,0.1)":"transparent", border:`1px solid ${view===v?"rgba(0,176,212,0.4)":C.border}`, color: view===v?C.blue:C.textMuted }}>{v==="comp"?"12 meses":"24 meses"}</button>
          ))}
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} style={{ width:"100%", height:"auto", display:"block" }}>
        {[yhi, (yhi+ylo)/2, ylo].map((gv,i)=>(
          <line key={i} x1={padL} y1={yAt(gv)} x2={W-padR} y2={yAt(gv)} stroke={C.border} strokeWidth="1"/>
        ))}
        {lines.map((l) => (
          <path key={l.key} d={dPath(l.data)} fill="none" stroke={l.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={l.dashed?"4 3":"none"} opacity={l.dashed?0.7:1}/>
        ))}
        {showActualMarks && [{i:aIdxMax,v:ev.max,up:true},{i:aIdxMin,v:ev.min,up:false}].map((p,k)=>(
          <g key={k}>
            <circle cx={xAt(xi(p.i))} cy={yAt(p.v)} r="3.5" fill={p.up?C.green:C.red} stroke={C.bg} strokeWidth="1.5"/>
            <text x={xAt(xi(p.i))} y={yAt(p.v)+(p.up?-8:14)} fill={p.up?C.green:C.red} fontSize="9" fontFamily={MONO} textAnchor="middle">{fK(p.v)}</text>
          </g>
        ))}
        {xlabels.map((m,i)=> ((comp || i%3===0) ? (
          <text key={i} x={xAt(i)} y={H-6} fill={C.textMuted} fontSize="8.5" fontFamily={MONO} textAnchor="middle">{m}</text>
        ) : null))}
      </svg>

      {comp && (
        <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginTop:8 }}>
          {SER.map((s)=>(<Chip key={s.key} on={show[s.key]} color={s.color} label={s.label} onClick={()=>setShow((x)=>({...x,[s.key]:!x[s.key]}))}/>))}
        </div>
      )}

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"7px 14px", marginTop:12 }}>
        <Stat label="Mayor caída"        v={fK(ev.drop.delta)}                          sub={ev.drop.from?`${ev.drop.from}→${ev.drop.mes}`:""}     color={C.red}/>
        <Stat label="Mayor crecimiento"  v={`+${fK(ev.growth.delta)}`}                  sub={ev.growth.from?`${ev.growth.from}→${ev.growth.mes}`:""} color={C.green}/>
        <Stat label="vs presupuesto"     v={`${ev.vsPresupuesto>=0?"+":""}${ev.vsPresupuesto}%`} sub={`${fK(ev.totAct)} vs ${fK(ev.totPpto)}`}      color={ev.vsPresupuesto>=0?C.green:C.red}/>
        <Stat label="vs año anterior"    v={`${ev.vsAnterior>=0?"+":""}${ev.vsAnterior}%`}       sub={`${fK(ev.totAct)} vs ${fK(ev.totAnt)}`}       color={ev.vsAnterior>=0?C.green:C.red}/>
      </div>

      <div style={{ fontSize:11, color:C.textMuted, lineHeight:1.5, marginTop:12, paddingTop:10, borderTop:`1px solid ${C.border}` }}>
        Histórico <span style={{color:C.textSub}}>global real</span> (12 meses + año anterior + presupuesto). La película <span style={{color:C.textSub}}>por entidad</span> (cliente/SKU) se enciende cuando conectes histórico real — hoy ADI no inventa una tendencia por entidad.
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
