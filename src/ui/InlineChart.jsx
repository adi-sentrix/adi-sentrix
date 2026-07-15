/* === src/ui/InlineChart.jsx · GRÁFICO EMBEBIDO EN LA RESPUESTA (I1 · owner 2026-07-09 · restyle premium I1.5) ===
 * Renderiza la plantilla que eligió chartSpec (determinístico) DEBAJO del texto de ADI, dentro de la burbuja:
 * pregunta → respuesta → gráfico → "Ampliar en Sentrix". Variantes COMPACTAS de los gráficos que ya viven en
 * Sentrix (misma verdad: buildGlobalEvolution · rows del contrato · panel pareto).
 *
 * REGLAS DEL RESTYLE (owner: "más premium, se ven muy BI" · panel de diseño 2026-07-09):
 *   · SVG dibuja geometría, HTML pone texto — el viewBox 560 escala a ~320px en mobile y cualquier <text> SVG muere.
 *   · Sin filtros SVG (drop-shadow cuelga compositores — incidente 2026-07-07): glow = doble trazo / gradiente.
 *   · Curvas = monotone cubic SIN overshoot (la forma de la curva tampoco fabrica: el pico visible ES el dato).
 *   · Animación solo compositor (opacity/transform/dash-offset one-shot) · estado base = estado final →
 *     con prefers-reduced-motion el gráfico se ve completo desde el primer frame. Nunca draw-in sobre punteadas.
 *   · Color semántico pleno SOLO en la cifra; la barra susurra en gradiente. Ámbar = plata y corte 80/20 (no rojo).
 *   · Cifras verbatim de la única verdad (r.fmt / valFmt) — acá jamás se re-formatea. */
import React, { useState, useId } from "react";
import { C } from "./theme.js";
import { buildGlobalEvolution } from "../adi/sentrix/temporal.js";

const MONO = "'JetBrains Mono', ui-monospace, monospace";
const SANS = "'DM Sans', system-ui, sans-serif";
const KO = "#0b0b0b";   // knockout = el material del card (nunca #000: el negro absoluto delata calcomanía)

// keyframes globales UNA vez (no un <style> por instancia) · dentro de reduced-motion:no-preference → si la
// animación no existe, el estado base (final) queda y el gráfico jamás se ve vacío.
const KF = `@media (prefers-reduced-motion: no-preference){
@keyframes adiDraw{from{stroke-dashoffset:1}}
@keyframes adiRise{from{transform:scaleX(0)}}
@keyframes adiRiseY{from{transform:scaleY(0)}}
@keyframes adiFade{from{opacity:0}}
@keyframes adiBlink{0%,100%{opacity:1}50%{opacity:0.12}}
}`;
if (typeof document !== "undefined" && !document.getElementById("adi-chart-kf")) {
  const s = document.createElement("style"); s.id = "adi-chart-kf"; s.textContent = KF; document.head.appendChild(s);
}

// id seguro para <defs> por instancia (useId emite ":" — inválido dentro de url(#…))
const useSvgId = () => "adi" + useId().replace(/[^a-zA-Z0-9]/g, "");

// curva monotónica (Fritsch–Carlson): suave sin overshoot — máx/mín visibles coinciden EXACTO con el dato.
function monoPath(xs, ys) {
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

const EASE = "cubic-bezier(.2,.7,.3,1)";

// ── mini evolutivo · hero stat + curva suave con área · año anterior en perlas · la serie se nombra donde termina ──
function MiniEvolutivo() {
  const [hov, setHov] = useState(null);
  const uid = useSvgId();
  const ev = buildGlobalEvolution();
  const W = 560, H = 88, padL = 10, padR = 10, padT = 10, padB = 8;
  const all = [...ev.actual, ...ev.anterior];
  const lo = Math.min(...all), hi = Math.max(...all), rng = Math.max(hi - lo, 1);
  const xs = ev.actual.map((_, i) => padL + i * (W - padL - padR) / Math.max(1, ev.n - 1));
  const y = (v) => padT + (1 - (v - lo) / rng) * (H - padT - padB);
  const yA = ev.actual.map(y), yP = ev.anterior.map(y);
  const dAct = monoPath(xs, yA), dAnt = monoPath(xs, yP);
  const iMax = ev.actual.indexOf(ev.max), iMin = ev.actual.indexOf(ev.min);
  const fmV = (v) => "$" + (v / 1000).toFixed(1) + "M";
  const up = ev.vsAnterior >= 0;
  // riel de labels: cada serie se nombra donde termina (sin leyenda de swatches). Columna flex centrada en el
  // promedio de los endpoints y ORDENADA por altura — en mobile el SVG se achica pero el texto HTML no, así que
  // una posición absoluta por % colisiona; el flujo natural de la columna garantiza que jamás se pisen.
  const endA = yA[ev.n - 1], endP = yP[ev.n - 1];
  const railTop = Math.max(6, Math.min(94, ((endA + endP) / 2 / H) * 100));
  const actualArriba = endA <= endP;
  return (
    <>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
        <span style={{ fontFamily: MONO, fontSize: 15, fontWeight: 600, color: C.text, fontVariantNumeric: "tabular-nums" }}>{fmV(ev.actual[ev.n - 1])}</span>
        <span style={{ fontFamily: SANS, fontSize: 10, color: C.textMuted }}>último mes</span>
        <span style={{ fontFamily: MONO, fontSize: 10.5, padding: "1px 7px", borderRadius: 4, fontVariantNumeric: "tabular-nums",
          background: up ? "rgba(16,185,129,0.08)" : "rgba(244,63,94,0.08)", color: up ? C.green : C.red }}>
          {up ? "+" : ""}{ev.vsAnterior}% vs año anterior
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "stretch" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 0, touchAction: "pan-y" }}>
          <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
            <defs>
              <linearGradient id={`${uid}a`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={C.elec} stopOpacity="0.18"/>
                <stop offset="100%" stopColor={C.elec} stopOpacity="0"/>
              </linearGradient>
            </defs>
            <path d={`${dAct} L${xs[ev.n - 1]},${H - padB} L${xs[0]},${H - padB} Z`} fill={`url(#${uid}a)`} style={{ animation: "adiFade 500ms 200ms both" }}/>
            <line x1={padL} x2={W - padR} y1={H - padB} y2={H - padB} stroke="rgba(255,255,255,0.08)" strokeWidth="1"/>
            <path d={dAnt} fill="none" stroke={C.teal} strokeWidth="1.6" strokeDasharray="0.1 6" strokeLinecap="round" opacity="0.55" style={{ animation: "adiFade 400ms 250ms both" }}/>
            <path d={dAct} fill="none" stroke={C.elec} strokeWidth="4.5" strokeLinejoin="round" opacity="0.15" pathLength="1" strokeDasharray="1" style={{ animation: `adiDraw 700ms ${EASE} both` }}/>
            <path d={dAct} fill="none" stroke={C.elec} strokeWidth="1.9" strokeLinejoin="round" opacity="0.95" pathLength="1" strokeDasharray="1" style={{ animation: `adiDraw 700ms ${EASE} both` }}/>
            <g style={{ animation: "adiFade 300ms 650ms both" }}>
              <circle cx={xs[iMax]} cy={yA[iMax]} r="3" fill={C.green} stroke={KO} strokeWidth="2"/>
              <circle cx={xs[iMin]} cy={yA[iMin]} r="3" fill={C.red} stroke={KO} strokeWidth="2"/>
              <circle cx={xs[ev.n - 1]} cy={yA[ev.n - 1]} r="5" fill={C.elec} opacity="0.22"/>
              <circle cx={xs[ev.n - 1]} cy={yA[ev.n - 1]} r="2.6" fill={C.elec}/>
            </g>
            {hov != null && (
              <g pointerEvents="none">
                <line x1={xs[hov]} x2={xs[hov]} y1={padT - 4} y2={H - padB} stroke="rgba(255,255,255,0.18)" strokeWidth="1"/>
                <circle cx={xs[hov]} cy={yA[hov]} r="3.6" fill={C.elec} stroke={KO} strokeWidth="2"/>
              </g>
            )}
            <rect x="0" y="0" width={W} height={H} fill="transparent"
              onPointerMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); const rel = (e.clientX - r.left) / Math.max(1, r.width); setHov(Math.max(0, Math.min(ev.n - 1, Math.round(rel * (ev.n - 1))))); }}
              onPointerLeave={() => setHov(null)}/>
          </svg>
          {hov != null && (
            <div style={{ position: "absolute", top: -2, left: `${(xs[hov] / W) * 100}%`, transform: hov > ev.n / 2 ? "translateX(calc(-100% - 8px))" : "translateX(8px)",
              pointerEvents: "none", background: "#161616", border: `1px solid ${C.borderLight}`, borderRadius: 6, padding: "3px 9px",
              fontFamily: MONO, fontSize: 10.5, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", color: C.textMuted }}>
              <span style={{ color: C.textSub }}>{ev.meses[hov]}</span> <b style={{ color: C.text }}>{fmV(ev.actual[hov])}</b> · ant {fmV(ev.anterior[hov])}
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2, fontFamily: MONO, fontSize: 9.5, color: C.textMuted }}>
            <span>{ev.meses[0]}</span><span>{ev.meses[ev.n - 1]}</span>
          </div>
        </div>
        <div style={{ position: "relative", width: 54, flexShrink: 0 }}>
          <div style={{ position: "absolute", top: `${railTop}%`, transform: "translateY(-50%)", left: 6, display: "flex", flexDirection: "column", gap: 1, lineHeight: 1.15 }}>
            <span style={{ order: actualArriba ? 0 : 1, fontFamily: SANS, fontSize: 10, fontWeight: 500, color: C.elec, whiteSpace: "nowrap" }}>este año</span>
            <span style={{ order: actualArriba ? 1 : 0, fontFamily: SANS, fontSize: 10, fontWeight: 500, color: C.teal, opacity: 0.8, whiteSpace: "nowrap" }}>anterior</span>
          </div>
        </div>
      </div>
    </>
  );
}

// ── mini barras horizontales · ranking/overview del contrato · sin track: barra desnuda que muere en gradiente ──
function MiniBarras({ rows, polarity, unit }) {
  const max = Math.max(...rows.map((r) => Math.abs(r.value)), 1);
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(64px, 108px) minmax(24px, 1fr) auto", columnGap: 8, rowGap: 5, alignItems: "center" }}>
        {rows.map((r, i) => (
          <React.Fragment key={r.name}>
            <span style={{ fontFamily: SANS, fontSize: 11, color: i === 0 ? C.text : C.textSub, fontWeight: i === 0 ? 600 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
            <div style={{ position: "relative", alignSelf: "stretch", minHeight: 16, borderLeft: "1px solid rgba(255,255,255,0.12)" }}>
              <div style={{ position: "absolute", top: "50%", marginTop: -4, left: 0, height: 8, borderRadius: 2,
                width: `${Math.max(2, Math.abs(r.value) / max * 100)}%`,
                background: "linear-gradient(90deg, rgba(47,184,218,0.9), rgba(47,184,218,0.3))",
                opacity: Math.max(0.4, 0.95 - i * 0.07),
                transformOrigin: "left center", animation: `adiRise 420ms ${EASE} ${i * 40}ms both` }}/>
            </div>
            {/* líder: la plata en ámbar (única aparición de ámbar en este mini) */}
            <span style={{ fontFamily: MONO, fontSize: 11, fontVariantNumeric: "tabular-nums", textAlign: "right",
              color: i === 0 ? (unit === "money" ? C.amber : C.text) : C.textSub, fontWeight: i === 0 ? 600 : 400 }}>{r.fmt}</span>
          </React.Fragment>
        ))}
      </div>
      {polarity === "lowerIsBetter" && <div style={{ fontFamily: SANS, fontSize: 10, color: C.textMuted, marginTop: 4, textAlign: "right" }}>↓ menos = mejor</div>}
    </>
  );
}

// ── mini movers · eje CERO real (la geometría dice suma/resta) · color pleno solo en la cifra ──
function MiniMovers({ panel }) {
  const rows = panel.rows;
  const conPct = rows.some((r) => typeof r.pct === "number");
  // columnas ELÁSTICAS (mobile 2026-07-09: con anchos fijos la columna de barras colapsaba a 0px en 375px):
  // nombre cede primero (ellipsis), cifras en auto (las dimensiona el dato, no el header — el header spanea).
  const cols = conPct ? "minmax(64px, 104px) minmax(24px, 1fr) auto auto" : "minmax(64px, 104px) minmax(24px, 1fr) auto";
  const maxPos = Math.max(...rows.map((r) => (r.val > 0 ? r.val : 0)), 0);
  const maxNeg = Math.max(...rows.map((r) => (r.val < 0 ? -r.val : 0)), 0);
  const span = Math.max(maxPos + maxNeg, 1);
  const X0 = maxNeg / span * 100;   // todo-positivo → 0 (el spine es el rail izquierdo) · todo-negativo → 100
  // títulos de columna (owner 2026-07-09: "el usuario no sabe de qué son los números") — thead intencional
  const valHdr = panel.pctMode ? "YOY %" : "VARIACIÓN $";
  const hdr = { fontFamily: MONO, fontSize: 8.5, letterSpacing: "0.8px", color: C.textMuted, textTransform: "uppercase", textAlign: "right", borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: 3 };
  const dot = (c) => <span style={{ width: 5, height: 5, borderRadius: 3, background: c, display: "inline-block", marginRight: 4 }}/>;
  return (
    <>
      {(panel.headline || panel.headlineSub) && (
        <div style={{ marginBottom: 8 }}>
          {panel.headline && <div style={{ fontFamily: MONO, fontSize: 13, fontWeight: 600, color: C.text, fontVariantNumeric: "tabular-nums" }}>{panel.headline}</div>}
          {panel.headlineSub && <div style={{ fontFamily: SANS, fontSize: 10, color: C.textMuted, marginTop: 1 }}>{panel.headlineSub}</div>}
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: cols, columnGap: 8, rowGap: 5, alignItems: "center" }}>
        {/* el header del $ spanea barra+cifra: su texto largo no ensancha la columna de la cifra (mobile) */}
        <span style={hdr}/>
        <span style={{ ...hdr, gridColumn: "2 / span 2" }}>{valHdr}</span>
        {conPct && <span style={hdr}>VAR %</span>}
        {rows.map((r, i) => {
          const w = Math.max(1.5, Math.abs(r.val || 0) / span * 100);
          const hiOp = i === 0;   // el mayor mover habla un poco más fuerte
          const grad = r.pos
            ? `linear-gradient(90deg, rgba(16,185,129,${hiOp ? 0.7 : 0.55}), rgba(16,185,129,${hiOp ? 0.25 : 0.18}))`
            : `linear-gradient(270deg, rgba(244,63,94,${hiOp ? 0.7 : 0.55}), rgba(244,63,94,${hiOp ? 0.25 : 0.18}))`;
          return (
            <React.Fragment key={r.nombre}>
              <span style={{ fontFamily: SANS, fontSize: 11, color: i === 0 ? C.text : C.textSub, fontWeight: i === 0 ? 600 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.nombre}</span>
              <div style={{ position: "relative", alignSelf: "stretch", minHeight: 16 }}>
                <div style={{ position: "absolute", left: `${X0}%`, top: -3, bottom: -3, width: 1, background: "rgba(255,255,255,0.16)" }}/>
                <div style={{ position: "absolute", top: "50%", marginTop: -4, height: 8, borderRadius: 2,
                  width: `${w}%`, left: r.pos ? `${X0}%` : `${X0 - w}%`, background: grad,
                  transformOrigin: r.pos ? "left center" : "right center", animation: `adiRise 420ms ${EASE} ${i * 40}ms both` }}/>
              </div>
              <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 600, color: r.pos ? C.green : C.red, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{r.valFmt}</span>
              {conPct && <span style={{ fontFamily: MONO, fontSize: 10, color: C.textMuted, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{typeof r.pct === "number" ? `${r.pct >= 0 ? "+" : ""}${r.pct}%` : ""}</span>}
            </React.Fragment>
          );
        })}
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 10, marginTop: 5, fontFamily: SANS, fontSize: 10, color: C.textMuted }}>
        <span style={{ display: "flex", alignItems: "center" }}>{dot(C.green)}suma</span>
        <span style={{ display: "flex", alignItems: "center" }}>{dot(C.red)}resta</span>
      </div>
    </>
  );
}

// ── mini pareto · el bloque que importa en gradiente, la cola ghost · acumulada en curva monotónica LAVANDA con
//    reflejo (owner 2026-07-15: "la línea se ve de dibujo mal hecho — mejorala y dale un color diferente, premium";
//    la monotónica pasa EXACTO por cada punto acumulado — el hover muestra el dato real, la curva no fabrica) ·
//    corte en ÁMBAR (donde está la plata — el rojo queda reservado a "resta") · takeaway arriba, no censo abajo ──
// EXPORTADO (owner 2026-07-09: "el 80% de Sentrix cambialo por el de columnas") — la Mesa reusa ESTA pieza (una
// sola verdad visual). Props opcionales: showTakeaway=false cuando el shell ya trae el titular · onPick(nombre)
// hace cada columna clickeable (la Mesa pregunta "Profundiza en X") · rows[i].sub reemplaza el "part%" bajo el
// nombre (la Mesa pone la PLATA) · highlight=nombre destaca ESA columna (la Ficha de entidad). El uso del chat
// queda byte-igual con los defaults. HOVER CON DATO (owner 2026-07-10: "cuando paso por la curva del 80% debe
// mostrar el dato — eso con todos los gráficos"): overlay de puntero → tooltip HTML con nombre · $ · part · acum.
export function MiniPareto({ panel, showTakeaway = true, onPick = null, highlight = null }) {
  const uid = useSvgId();
  const [hov, setHov] = useState(null);
  const rows = panel.rows;
  const n = rows.length;
  const W = 560, H = 96, padL = 10, padR = 10, padT = 8, padB = 6;
  const bw = Math.min(34, (W - padL - padR) / n - 8);
  const xc = (i) => padL + (i + 0.5) * (W - padL - padR) / n;
  const maxPart = Math.max(...rows.map((r) => r.part || 0), 1);
  const yBar = (p) => (H - padB) - (p / maxPart) * (H - padT - padB) * 0.82;
  const yCum = (p) => padT + (1 - p / 100) * (H - padT - padB);
  const dCum = monoPath(rows.map((_, i) => xc(i)), rows.map((r) => yCum(r.acum)));
  const kAmber = { fontFamily: MONO, fontWeight: 600, color: C.amber, fontVariantNumeric: "tabular-nums" };
  const iCut = Math.min(Math.max(panel.cutoff, 1), n) - 1;
  return (
    <>
      {showTakeaway && (
        <div style={{ fontFamily: SANS, fontSize: 11, color: C.textSub, marginBottom: 8 }}>
          <b style={kAmber}>{panel.cutoff}</b> de <b style={kAmber}>{panel.of}</b> explican el <b style={kAmber}>{Math.round(panel.totalPct)}%</b>
        </div>
      )}
      <div style={{ position: "relative", touchAction: "pan-y" }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
          <defs>
            <linearGradient id={`${uid}pb`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={C.celeste} stopOpacity="0.8"/>
              <stop offset="100%" stopColor={C.celeste} stopOpacity="0.35"/>
            </linearGradient>
          </defs>
          <line x1={padL} x2={W - padR} y1={yCum(80)} y2={yCum(80)} stroke={C.amber} strokeWidth="1" strokeDasharray="5 3" opacity="0.35"/>
          {rows.map((r, i) => (
            <rect key={r.nombre} x={xc(i) - bw / 2} y={yBar(r.part)} width={bw} height={(H - padB) - yBar(r.part)} rx="2"
              fill={i < panel.cutoff ? `url(#${uid}pb)` : "rgba(47,184,218,0.16)"}
              stroke={r.nombre === highlight ? C.amber : "none"} strokeWidth={r.nombre === highlight ? 1.5 : 0}
              opacity={hov == null || hov === i ? 1 : 0.55}
              style={{ transformBox: "fill-box", transformOrigin: "center bottom", animation: `adiRiseY 420ms ${EASE} ${i * 30}ms both` }}/>
          ))}
          <path d={dCum} fill="none" stroke={C.lav} strokeWidth="4.5" strokeLinejoin="round" opacity="0.18" pathLength="1" strokeDasharray="1" style={{ animation: `adiDraw 600ms ${EASE} 200ms both` }}/>
          <path d={dCum} fill="none" stroke={C.lav} strokeWidth="1.8" strokeLinejoin="round" opacity="0.95" pathLength="1" strokeDasharray="1" style={{ animation: `adiDraw 600ms ${EASE} 200ms both` }}/>
          <g style={{ animation: "adiFade 300ms 800ms both" }}>
            <circle cx={xc(iCut)} cy={yCum(rows[iCut].acum)} r="5.5" fill={C.amber} opacity="0.2"/>
            <circle cx={xc(iCut)} cy={yCum(rows[iCut].acum)} r="2.8" fill={C.amber}/>
          </g>
          {hov != null && (
            <circle cx={xc(hov)} cy={yCum(rows[hov].acum)} r="3.4" fill={C.lav} stroke={KO} strokeWidth="1.5" pointerEvents="none"/>
          )}
          <rect x="0" y="0" width={W} height={H} fill="transparent" style={{ cursor: onPick ? "pointer" : "default" }}
            onPointerMove={(e) => { const b = e.currentTarget.getBoundingClientRect(); const rel = (e.clientX - b.left) / Math.max(1, b.width); setHov(Math.max(0, Math.min(n - 1, Math.floor((rel * W - padL) / ((W - padL - padR) / n))))); }}
            onPointerLeave={() => setHov(null)}
            onClick={onPick && hov != null ? () => onPick(rows[hov].nombre) : undefined}/>
        </svg>
        {hov != null && (
          <div style={{ position: "absolute", top: -2, left: `${(xc(hov) / W) * 100}%`, transform: hov > n / 2 ? "translateX(calc(-100% - 8px))" : "translateX(8px)",
            pointerEvents: "none", background: "#161616", border: `1px solid ${C.borderLight}`, borderRadius: 6, padding: "3px 9px",
            fontFamily: MONO, fontSize: 10.5, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", color: C.textMuted }}>
            <b style={{ color: C.text }}>{rows[hov].nombre}</b>{rows[hov].sub ? <> · <span style={{ color: C.textSub }}>{rows[hov].sub}</span></> : null} · {rows[hov].part}% · <span style={{ color: rows[hov].acum <= 80 ? C.green : C.textMuted }}>acum {rows[hov].acum}%</span>
          </div>
        )}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${n}, 1fr)`, padding: "0 1.8%", marginTop: 4, columnGap: 2 }}>
        {rows.map((r, i) => (
          <div key={r.nombre} onClick={onPick && (i < panel.cutoff || r.nombre === highlight) ? () => onPick(r.nombre) : undefined}
            style={{ textAlign: "center", overflow: "hidden", cursor: onPick && (i < panel.cutoff || r.nombre === highlight) ? "pointer" : "default" }}>
            {(i < panel.cutoff || r.nombre === highlight) && (
              <>
                <div style={{ fontFamily: MONO, fontSize: 9.5, color: r.nombre === highlight ? C.amber : C.textSub, fontWeight: r.nombre === highlight ? 600 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.nombre}</div>
                <div style={{ fontFamily: MONO, fontSize: 9, color: C.textMuted, fontVariantNumeric: "tabular-nums" }}>{r.sub || `${r.part}%`}</div>
              </>
            )}
          </div>
        ))}
      </div>
      <div style={{ fontFamily: SANS, fontSize: 10, color: C.textMuted, marginTop: 4, textAlign: "right" }}>el punto ámbar marca el corte real · la curva <span style={{ color: C.lav }}>lavanda</span> es el acumulado (la punteada, el umbral del 80%) · pasá el cursor para ver cada dato</div>
    </>
  );
}

// ── contenedor: eyebrow con dot de identidad + gráfico + "Ampliar en Sentrix" (deep-link a la evidencia) ──
export function InlineChart({ spec, onAmpliar }) {
  if (!spec) return null;
  // movers: el eyebrow usa el título limpio del panel (el headline pasa al hero de adentro) — chartSpec intacto
  const eyebrow = spec.tipo === "movers" ? ((spec.panel && spec.panel.title) || spec.titulo) : spec.titulo;
  return (
    <div style={{ marginTop: 12, padding: "14px 16px 12px", borderRadius: 12, border: "1px solid rgba(47,184,218,0.25)",
      background: `radial-gradient(140% 90% at 50% 0%, rgba(47,184,218,0.05) 0%, rgba(47,184,218,0) 55%), ${KO}`,
      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
        <span style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: "0.7px", color: C.celeste, textTransform: "uppercase", display: "flex", alignItems: "center", minWidth: 0 }}>
          <span style={{ width: 5, height: 5, borderRadius: 3, background: C.celeste, flexShrink: 0, marginRight: 6, display: "inline-block" }}/>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{eyebrow}</span>
        </span>
        {onAmpliar && (
          <button onClick={onAmpliar} style={{ background: "transparent", border: "none", color: C.celeste, fontSize: 10.5, fontWeight: 600, cursor: "pointer", fontFamily: SANS, padding: 0, whiteSpace: "nowrap", opacity: 0.9 }}>
            Ampliar en Sentrix →
          </button>
        )}
      </div>
      {spec.tipo === "evolutivo" && <MiniEvolutivo/>}
      {spec.tipo === "movers" && <MiniMovers panel={spec.panel}/>}
      {spec.tipo === "barras" && <MiniBarras rows={spec.rows} polarity={spec.polarity} unit={spec.unit}/>}
      {spec.tipo === "pareto" && <MiniPareto panel={spec.panel}/>}
    </div>
  );
}
