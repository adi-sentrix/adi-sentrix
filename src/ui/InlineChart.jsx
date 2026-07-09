/* === src/ui/InlineChart.jsx · GRÁFICO EMBEBIDO EN LA RESPUESTA (I1 · owner 2026-07-09) ===
 * Renderiza la plantilla que eligió chartSpec (determinístico) DEBAJO del texto de ADI, dentro de la burbuja:
 * pregunta → respuesta → gráfico → "Ampliar en Sentrix". Variantes COMPACTAS de los gráficos que ya viven en
 * Sentrix (misma verdad: buildGlobalEvolution · rows del contrato · panel pareto). SVG viewBox → escala en mobile.
 * Sin filtros SVG (drop-shadow cuelga compositores lentos — lección 2026-07-07): glow por doble trazo. */
import React, { useState } from "react";
import { C } from "./theme.js";
import { buildGlobalEvolution } from "../adi/sentrix/temporal.js";

const MONO = "'JetBrains Mono', ui-monospace, monospace";

// ── mini evolutivo · 12 meses actual (sólido) vs año anterior (punteado) · pico/valle · hover mes+dato ──
function MiniEvolutivo() {
  const [hov, setHov] = useState(null);
  const ev = buildGlobalEvolution();
  const W = 560, H = 96, padL = 8, padR = 8, padT = 12, padB = 16;
  const all = [...ev.actual, ...ev.anterior];
  const lo = Math.min(...all), hi = Math.max(...all), rng = Math.max(hi - lo, 1);
  const x = (i) => padL + i * (W - padL - padR) / Math.max(1, ev.n - 1);
  const y = (v) => padT + (1 - (v - lo) / rng) * (H - padT - padB);
  const d = (s) => s.map((v, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(v)}`).join(" ");
  const iMax = ev.actual.indexOf(ev.max), iMin = ev.actual.indexOf(ev.min);
  const fmV = (v) => "$" + (v / 1000).toFixed(1) + "M";
  const tipX = hov == null ? 0 : Math.max(padL, Math.min(W - padR - 116, x(hov) - 58));
  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
        <path d={d(ev.anterior)} fill="none" stroke={C.teal} strokeWidth="1.4" strokeDasharray="4 3" strokeLinejoin="round" opacity="0.75"/>
        <path d={d(ev.actual)} fill="none" stroke={C.elec} strokeWidth="4.5" strokeLinejoin="round" opacity="0.15"/>
        <path d={d(ev.actual)} fill="none" stroke={C.elec} strokeWidth="1.9" strokeLinejoin="round" opacity="0.95"/>
        {ev.actual.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r="1.7" fill={C.elec} opacity="0.85"/>)}
        <circle cx={x(iMax)} cy={y(ev.max)} r="3.2" fill={C.green} stroke="#000" strokeWidth="1"/>
        <circle cx={x(iMin)} cy={y(ev.min)} r="3.2" fill={C.red} stroke="#000" strokeWidth="1"/>
        <text x={padL} y={H - 3} fill={C.textMuted} fontSize="8" fontFamily={MONO}>{ev.meses[0]}</text>
        <text x={W - padR} y={H - 3} textAnchor="end" fill={C.textMuted} fontSize="8" fontFamily={MONO}>{ev.meses[ev.n - 1]}</text>
        <rect x={padL - 4} y={0} width={W - padL - padR + 8} height={H} fill="transparent"
          onMouseMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); const rel = (e.clientX - r.left) / Math.max(1, r.width); setHov(Math.max(0, Math.min(ev.n - 1, Math.round(rel * (ev.n - 1))))); }}
          onMouseLeave={() => setHov(null)}/>
        {hov != null && (
          <g pointerEvents="none">
            <line x1={x(hov)} x2={x(hov)} y1={padT - 4} y2={H - padB + 3} stroke="rgba(255,255,255,0.2)" strokeWidth="1"/>
            <circle cx={x(hov)} cy={y(ev.actual[hov])} r="3.6" fill={C.elec} stroke="#000" strokeWidth="1.2"/>
            <rect x={tipX} y={padT - 6} width={116} height={24} rx="5" fill="#181715" stroke={C.borderLight} strokeWidth="1"/>
            <text x={tipX + 8} y={padT + 4} fill={C.textSub} fontSize="8.5" fontFamily={MONO}>{ev.meses[hov]}</text>
            <text x={tipX + 8} y={padT + 14} fill={C.elec} fontSize="9" fontWeight="600" fontFamily={MONO}>{fmV(ev.actual[hov])} · ant {fmV(ev.anterior[hov])}</text>
          </g>
        )}
      </svg>
      <div style={{ display: "flex", gap: 12, marginTop: 6, fontSize: 10.5, color: C.textMuted, flexWrap: "wrap" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 12, height: 3, borderRadius: 2, background: C.elec }}/>este año</span>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 12, height: 0, borderTop: `2px dashed ${C.teal}` }}/>año anterior</span>
        <span style={{ marginLeft: "auto", fontFamily: MONO, color: ev.vsAnterior >= 0 ? C.green : C.red }}>{ev.vsAnterior >= 0 ? "+" : ""}{ev.vsAnterior}% vs anterior</span>
      </div>
    </>
  );
}

// ── mini barras horizontales · ranking/overview del contrato (rows con fmt de una verdad) ──
function MiniBarras({ rows, polarity }) {
  const max = Math.max(...rows.map((r) => Math.abs(r.value)), 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      {rows.map((r, i) => (
        <div key={r.name} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 108, flexShrink: 0, fontSize: 11, color: i === 0 ? C.text : C.textSub, fontWeight: i === 0 ? 600 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
          <div style={{ position: "relative", flex: 1, height: 9, background: "rgba(255,255,255,0.05)", borderRadius: 4, overflow: "hidden" }}>
            <div style={{ width: `${Math.max(2, Math.abs(r.value) / max * 100)}%`, height: "100%", borderRadius: 4, background: C.celeste, opacity: i === 0 ? 0.95 : 0.6 }}/>
          </div>
          <span style={{ fontFamily: MONO, fontSize: 11, color: i === 0 ? C.text : C.textSub, fontVariantNumeric: "tabular-nums", width: 62, textAlign: "right", flexShrink: 0 }}>{r.fmt}</span>
        </div>
      ))}
      {polarity === "lowerIsBetter" && <div style={{ fontSize: 9.5, color: C.textMuted, fontFamily: MONO, marginTop: 2 }}>menos = mejor</div>}
    </div>
  );
}

// ── mini movers · barras divergentes "quién mueve la aguja" (verde suma · rojo resta · como en Sentrix) ──
function MiniMovers({ panel }) {
  const rows = panel.rows;
  const max = Math.max(...rows.map((r) => Math.abs(r.val || 0)), 1);
  const conPct = rows.some((r) => typeof r.pct === "number");
  // títulos de columna (owner 2026-07-09: "el usuario no sabe de qué son los números")
  const valHdr = panel.pctMode ? "YOY %" : "VARIACIÓN $";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      {panel.headlineSub && <div style={{ fontFamily: MONO, fontSize: 10, color: C.textMuted, marginBottom: 2 }}>{panel.headlineSub}</div>}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ width: 104, flexShrink: 0 }}/>
        <div style={{ flex: 1 }}/>
        <span style={{ fontFamily: MONO, fontSize: 8.5, letterSpacing: "0.5px", color: C.textMuted, textTransform: "uppercase", width: 66, textAlign: "right", flexShrink: 0 }}>{valHdr}</span>
        {conPct && <span style={{ fontFamily: MONO, fontSize: 8.5, letterSpacing: "0.5px", color: C.textMuted, textTransform: "uppercase", width: 46, textAlign: "right", flexShrink: 0 }}>VAR %</span>}
      </div>
      {rows.map((r, i) => (
        <div key={r.nombre} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 104, flexShrink: 0, fontSize: 11, color: i === 0 ? C.text : C.textSub, fontWeight: i === 0 ? 600 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.nombre}</span>
          <div style={{ position: "relative", flex: 1, height: 9, background: "rgba(255,255,255,0.05)", borderRadius: 4, overflow: "hidden" }}>
            <div style={{ width: `${Math.max(2, Math.abs(r.val || 0) / max * 100)}%`, height: "100%", borderRadius: 4, background: r.pos ? C.green : C.red, opacity: 0.8 }}/>
          </div>
          <span style={{ fontFamily: MONO, fontSize: 11, color: r.pos ? C.green : C.red, fontVariantNumeric: "tabular-nums", width: 66, textAlign: "right", flexShrink: 0 }}>{r.valFmt}</span>
          {typeof r.pct === "number" && <span style={{ fontFamily: MONO, fontSize: 10, color: C.textMuted, fontVariantNumeric: "tabular-nums", width: 46, textAlign: "right", flexShrink: 0 }}>{r.pct >= 0 ? "+" : ""}{r.pct}%</span>}
        </div>
      ))}
      <div style={{ fontSize: 9.5, color: C.textMuted, fontFamily: MONO, marginTop: 2 }}>verde = suma · rojo = resta</div>
    </div>
  );
}

// ── mini pareto · barras de participación + acumulada + corte 80/20 real ──
function MiniPareto({ panel }) {
  const rows = panel.rows;
  const W = 560, H = 110, padL = 8, padR = 8, padT = 10, padB = 24;
  const n = rows.length;
  const bw = Math.min(34, (W - padL - padR) / n - 8);
  const xc = (i) => padL + (i + 0.5) * (W - padL - padR) / n;
  const maxPart = Math.max(...rows.map((r) => r.part || 0), 1);
  const yBar = (p) => (H - padB) - (p / maxPart) * (H - padT - padB) * 0.82;
  const yCum = (p) => padT + (1 - p / 100) * (H - padT - padB);
  const cumPath = rows.map((r, i) => `${i === 0 ? "M" : "L"}${xc(i)},${yCum(r.acum)}`).join(" ");
  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
        <line x1={padL} x2={W - padR} y1={yCum(80)} y2={yCum(80)} stroke={C.amber} strokeWidth="1" strokeDasharray="5 3" opacity="0.55"/>
        <text x={W - padR} y={yCum(80) - 3} textAnchor="end" fill={C.amber} fontSize="8" fontFamily={MONO} opacity="0.9">80%</text>
        {rows.map((r, i) => (
          <g key={r.nombre}>
            <rect x={xc(i) - bw / 2} y={yBar(r.part)} width={bw} height={(H - padB) - yBar(r.part)} rx="2" fill={C.celeste} opacity={i < panel.cutoff ? 0.85 : 0.35}/>
            <text x={xc(i)} y={H - 12} textAnchor="middle" fill={i < panel.cutoff ? C.textSub : C.textMuted} fontSize="7.5" fontFamily={MONO}>{String(r.nombre).slice(0, 8)}</text>
            <text x={xc(i)} y={H - 3} textAnchor="middle" fill={C.textMuted} fontSize="7" fontFamily={MONO}>{r.part}%</text>
          </g>
        ))}
        <path d={cumPath} fill="none" stroke={C.celeste} strokeWidth="1.4" opacity="0.9"/>
        {rows.map((r, i) => <circle key={"c" + r.nombre} cx={xc(i)} cy={yCum(r.acum)} r="1.8" fill="#0a0a09" stroke={C.celeste} strokeWidth="1"/>)}
        {panel.cutoff > 0 && panel.cutoff <= n && (
          <circle cx={xc(panel.cutoff - 1)} cy={yCum(rows[panel.cutoff - 1].acum)} r="4.5" fill="none" stroke={C.red} strokeWidth="1.4"/>
        )}
      </svg>
      <div style={{ fontSize: 10.5, color: C.textMuted, marginTop: 4, fontFamily: MONO }}>
        {panel.cutoff} de {panel.of} explican el {Math.round(panel.totalPct)}% <span style={{ color: C.textSub }}>· el aro rojo marca el corte real</span>
      </div>
    </>
  );
}

// ── contenedor: eyebrow + gráfico + "Ampliar en Sentrix" (deep-link a la evidencia que ya existe) ──
export function InlineChart({ spec, onAmpliar }) {
  if (!spec) return null;
  // PREMIUM Sentrix (owner 2026-07-09: "fondo negro, como los de Sentrix"): negro profundo + borde celeste suave —
  // el mismo lenguaje del detalle por período de la Mesa.
  return (
    <div style={{ marginTop: 12, padding: "12px 14px", borderRadius: 10, border: "1px solid rgba(47,184,218,0.25)", background: "#0b0a09" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 9 }}>
        <span style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: "0.7px", color: C.celeste, textTransform: "uppercase" }}>{spec.titulo}</span>
        {onAmpliar && (
          <button onClick={onAmpliar} style={{ background: "transparent", border: "none", color: C.celeste, fontSize: 10.5, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', system-ui, sans-serif", padding: 0, whiteSpace: "nowrap", opacity: 0.9 }}>
            Ampliar en Sentrix →
          </button>
        )}
      </div>
      {spec.tipo === "evolutivo" && <MiniEvolutivo/>}
      {spec.tipo === "movers" && <MiniMovers panel={spec.panel}/>}
      {spec.tipo === "barras" && <MiniBarras rows={spec.rows} polarity={spec.polarity}/>}
      {spec.tipo === "pareto" && <MiniPareto panel={spec.panel}/>}
    </div>
  );
}
