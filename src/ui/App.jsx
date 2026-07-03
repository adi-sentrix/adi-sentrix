/* === src/ui/App.jsx · ADISentric (shell mínimo) ===
 * Raíz de la app. Por ahora: header (logo + LIVE + escenario) + ChatADI corriendo como app real.
 * SIN panel de datos / módulos todavía (entran en el próximo paso de Fase 5).
 * Estado UI mínimo: escenario. La UI no calcula nada · el chat consume answerADI. */
import React, { useState } from "react";
import { C } from "./theme.js";
import { ScenarioSelector } from "./ScenarioSelector.jsx";
import { ChatADI } from "./ChatADI.jsx";
import { SentrixPanel } from "./SentrixPanel.jsx";   // Etapa 5 · Sentrix · panel de evidencia (se abre con la lectura)
import { ADI_LLM_ENABLED } from "../config/voiceFlags.js";   // Paso 5 · badge de modo (demo vs IA) en el header

const getCurrentDateString = () => {
  const now = new Date();
  const day   = String(now.getDate()).padStart(2, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const year  = now.getFullYear();
  return `${day}-${month}-${year}`;
};

export default function App({ animate = true }) {
  const [scenario, setScenario] = useState("bonanza");
  // Etapa 5 · Sentrix · estado del panel de evidencia (la "mesa de trabajo" estilo Code, a la derecha).
  const [openEv, setOpenEv]   = useState(null);   // la boleta abierta (con reading{}) · null = panel cerrado
  const [openId, setOpenId]   = useState(null);   // id del mensaje cuya evidencia está abierta (highlight del botón)
  const [panelW, setPanelW]   = useState(460);    // ancho arrastrable
  const [maxed, setMaxed]     = useState(false);  // agrandado

  const closePanel = () => { setOpenEv(null); setOpenId(null); setMaxed(false); };
  const startResize = (e) => {
    e.preventDefault();
    const move = (ev) => {
      const w = Math.min(Math.max(window.innerWidth - ev.clientX, 360), Math.round(window.innerWidth * 0.72));
      setPanelW(w);
    };
    const up = () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); document.body.style.userSelect = ""; };
    window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
    document.body.style.userSelect = "none";
  };

  return (
    <div style={{ height:"100vh", background:C.bg, fontFamily:"'DM Sans','Segoe UI',sans-serif", color:C.text, display:"flex", flexDirection:"column", overflow:"hidden" }}>

      {/* ── HEADER ── */}
      <header style={{ position:"relative", display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 24px", height:56, borderBottom:`1px solid ${C.border}`, background:C.surface, flexShrink:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, flexShrink:0 }}>
          <div style={{ width:32, height:32, borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, background:"linear-gradient(135deg, rgba(255,255,255,0.07), rgba(255,255,255,0.02))", border:"1px solid rgba(255,255,255,0.12)", boxShadow:"inset 0 1px 0 rgba(255,255,255,0.06), 0 0 0 1px rgba(255,255,255,0.04), 0 4px 12px -3px rgba(0,0,0,0.4)" }}>
            <svg width="20" height="20" viewBox="0 0 200 200" fill="none" stroke="#cfd5db" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="100,15 173.6,57.5 173.6,142.5 100,185 26.4,142.5 26.4,57.5" strokeWidth="3.2"/>
              <circle cx="100" cy="100" r="55" strokeWidth="1.7" opacity="0.65"/>
              <ellipse cx="100" cy="100" rx="55" ry="22" strokeWidth="1.5" opacity="0.5"/>
              <ellipse cx="100" cy="100" rx="22" ry="55" strokeWidth="1.5" opacity="0.5"/>
              <circle cx="100" cy="100" r="6" fill="#2fb8da" stroke="none"/>
            </svg>
          </div>
          <div style={{ display:"flex", alignItems:"baseline", gap:7 }}>
            <span style={{ fontWeight:700, fontSize:14, letterSpacing:"-0.3px", color:C.text }}>ADI</span>
            <span style={{ fontWeight:500, fontSize:10.5, color:C.textMuted, fontFamily:"'JetBrains Mono', ui-monospace, monospace", letterSpacing:"1.2px", textTransform:"uppercase" }}>Sentrix</span>
          </div>
        </div>

        <div style={{ display:"flex", alignItems:"center", gap:14, flexShrink:0 }}>
          <ScenarioSelector scenario={scenario} onChange={setScenario}/>
          {/* Modo demo vs IA · lee ADI_LLM_ENABLED (build-time) · nunca expone la key */}
          <div title={ADI_LLM_ENABLED ? "Modo IA · el LLM traduce tu pregunta a un spec; ADI calcula, valida y decide (no inventa cifras)" : "Modo demo · motor determinístico, sin LLM ni gasto"}
            style={{ display:"flex", alignItems:"center", gap:6, padding:"3px 9px", borderRadius:20, flexShrink:0, whiteSpace:"nowrap",
              border:`1px solid ${ADI_LLM_ENABLED ? "rgba(47,184,218,0.45)" : C.border}`, background: ADI_LLM_ENABLED ? "rgba(47,184,218,0.10)" : "rgba(255,255,255,0.03)" }}>
            <span style={{ width:5, height:5, borderRadius:"50%", background: ADI_LLM_ENABLED ? "#2fb8da" : "rgba(255,255,255,0.35)", flexShrink:0 }}/>
            <span style={{ fontSize:9.5, fontWeight:600, fontFamily:"'JetBrains Mono', ui-monospace, monospace", letterSpacing:"0.8px", color: ADI_LLM_ENABLED ? "#2fb8da" : C.textMuted, textTransform:"uppercase" }}>
              {ADI_LLM_ENABLED ? "IA" : "Demo"}
            </span>
          </div>
          <div className="hdr-live" style={{ display:"flex", alignItems:"center", gap:7, paddingLeft:14, borderLeft:`1px solid ${C.border}`, flexShrink:0, whiteSpace:"nowrap" }}>
            <span style={{ position:"relative", width:6, height:6, borderRadius:"50%", background:C.green, flexShrink:0 }}>
              <span style={{ position:"absolute", inset:-3, borderRadius:"50%", border:"1px solid rgba(16,185,129,0.5)", animation:"livePulse 1.8s ease-out infinite" }}/>
            </span>
            <span className="hdr-live-text" style={{ fontSize:9.5, color:C.textMuted, fontFamily:"'JetBrains Mono', ui-monospace, monospace", letterSpacing:"1px" }}>LIVE</span>
            <span className="hdr-date" style={{ fontSize:10.5, color:C.text, fontWeight:500, fontFamily:"'JetBrains Mono', ui-monospace, monospace", letterSpacing:"0.3px" }}>{getCurrentDateString()}</span>
          </div>
        </div>
      </header>

      {/* ── MAIN · ADI centro con atmósfera ── */}
      <main style={{ flex:1, minWidth:0, display:"flex", flexDirection:"column", position:"relative", background:C.bg, overflow:"hidden" }}>
        {/* glow sutil ESTÁTICO (sin animación) · da vida a la esquina del chat · efecto tipo panel lateral de Code */}
        <div style={{ position:"absolute", left:0, bottom:0, width:"58%", height:"62%", zIndex:0, pointerEvents:"none", background:"radial-gradient(ellipse 75% 75% at 0% 100%, rgba(47,184,218,0.06), transparent 70%)" }}/>
        <div style={{ position:"relative", zIndex:1, display:"flex", flexDirection:"row", flex:1, minHeight:0 }}>
          <div style={{ flex:1, minWidth:0, display:"flex", flexDirection:"column" }}>
            <ChatADI scenario={scenario} animate={animate}
              onOpenEvidence={(ev, id) => { setOpenEv(ev); setOpenId(id); }}
              openEvidenceId={openId}/>
          </div>
          {openEv && (
            <>
              {/* divisor arrastrable (estilo Code) */}
              <div onMouseDown={startResize} title="Arrastrar para redimensionar"
                style={{ width:6, flexShrink:0, cursor:"col-resize", background:"transparent", borderLeft:`1px solid ${C.border}`, transition:"background 0.15s" }}
                onMouseEnter={e=>{ e.currentTarget.style.background = "rgba(47,184,218,0.25)"; }}
                onMouseLeave={e=>{ e.currentTarget.style.background = "transparent"; }}/>
              <div style={{ width: maxed ? "72%" : panelW, flexShrink:0, minWidth:0, minHeight:0 }}>
                <SentrixPanel evidence={openEv} onClose={closePanel} onToggleMax={() => setMaxed(m=>!m)} maximized={maxed}/>
              </div>
            </>
          )}
        </div>
      </main>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&display=swap');
        * { box-sizing:border-box; margin:0; padding:0; }
        ::-webkit-scrollbar { width:8px; height:8px; }
        ::-webkit-scrollbar-track { background:transparent; }
        ::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.06); border-radius:4px; }
        ::-webkit-scrollbar-thumb:hover { background:rgba(255,255,255,0.12); }
        * { scrollbar-width:thin; scrollbar-color:rgba(255,255,255,0.06) transparent; }
        button:focus { outline:none; }
        input::placeholder { color:#9a9a9a; }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes adiThink { 0%,80%,100%{ opacity:0.2; transform:translateY(0); } 40%{ opacity:1; transform:translateY(-2px); } }
        .adi-think { display:inline-flex; gap:3px; align-items:center; }
        .adi-dot { width:4px; height:4px; border-radius:50%; background:#2fb8da; display:inline-block; animation:adiThink 1.2s ease-in-out infinite; }
        .adi-dot:nth-child(2){ animation-delay:0.15s; }
        .adi-dot:nth-child(3){ animation-delay:0.30s; }
        /* responsive del header · ocultar progresivamente lo menos esencial (deja escenario + badge de modo) */
        @media (max-width: 1040px) { .hdr-date { display:none !important; } }
        @media (max-width: 900px)  { .hdr-live-text { display:none !important; } }
        @media (max-width: 620px)  { .hdr-esc-label, .hdr-esc-word, .hdr-live { display:none !important; } }
        @keyframes auroraBreathe { 0%,100%{opacity:0.6} 50%{opacity:1} }
        @keyframes livePulse {
          0%  { box-shadow: 0 0 0 0 rgba(16,185,129,0.5); transform:scale(1); }
          60% { box-shadow: 0 0 0 8px rgba(16,185,129,0); transform:scale(1.15); }
          100%{ box-shadow: 0 0 0 0 rgba(16,185,129,0);  transform:scale(1); }
        }
        @keyframes adiAurora {
          0%, 100% { transform: scale(1)   translate(0, 0);     opacity: 0.7; }
          25%      { transform: scale(1.06) translate(-3%, 2%);  opacity: 0.85; }
          50%      { transform: scale(1.1)  translate(2%, -2%);  opacity: 1; }
          75%      { transform: scale(1.04) translate(3%, 3%);   opacity: 0.8; }
        }
        @keyframes adiSpark {
          0%, 100% { transform: scale(1);   box-shadow: 0 0 0 1px rgba(47,184,218,0.4), 0 0 16px rgba(47,184,218,0.55), 0 0 32px rgba(47,184,218,0.2); }
          50%      { transform: scale(1.1); box-shadow: 0 0 0 1px rgba(47,184,218,0.7), 0 0 28px rgba(47,184,218,0.85), 0 0 56px rgba(47,184,218,0.4); }
        }
        @keyframes sentrixSweep {
          0%   { transform: translateX(-220px) skewX(-14deg); opacity: 0; }
          12%  { opacity: 1; }
          88%  { opacity: 1; }
          100% { transform: translateX(2200px) skewX(-14deg); opacity: 0; }
        }
        .sentrix-sweep { position:absolute; top:0; left:0; height:100%; width:170px; z-index:6; pointer-events:none; background:linear-gradient(100deg, transparent, rgba(60,200,235,0.09), transparent); mix-blend-mode:screen; animation: sentrixSweep 8s ease-in-out infinite; }
        /* "i" de ayuda en cada card · lee el catálogo de definiciones (determinístico, cero tokens) · tooltip en hover */
        .adi-i { position:absolute; top:7px; right:8px; width:14px; height:14px; border-radius:50%; border:1px solid rgba(255,255,255,0.18); color:rgba(255,255,255,0.4); font-size:9px; font-style:italic; line-height:12px; text-align:center; cursor:help; font-family:Georgia,'Times New Roman',serif; user-select:none; transition:color .15s, border-color .15s; z-index:4; }
        .adi-i:hover { color:#2fb8da; border-color:rgba(47,184,218,0.6); }
        .adi-tip { position:absolute; bottom:calc(100% + 7px); right:-3px; width:198px; background:#0b0b0d; border:1px solid rgba(47,184,218,0.4); border-radius:8px; padding:8px 11px; font-size:11px; line-height:1.5; color:#c4c2bd; opacity:0; transform:translateY(3px); pointer-events:none; transition:opacity .15s, transform .15s; z-index:60; box-shadow:0 6px 20px rgba(0,0,0,0.55); text-align:left; font-style:normal; font-weight:400; letter-spacing:0; }
        .adi-i:hover .adi-tip { opacity:1; transform:translateY(0); }
        /* "i" inline · misma ayuda determinística, para headers de tabla/columna (ring) · no absolute */
        .adi-i2 { position:relative; display:inline-flex; align-items:center; justify-content:center; width:12px; height:12px; border-radius:50%; border:1px solid rgba(255,255,255,0.18); color:rgba(255,255,255,0.4); font-size:8px; font-style:italic; line-height:1; cursor:help; font-family:Georgia,'Times New Roman',serif; user-select:none; vertical-align:middle; margin-left:4px; text-transform:none; transition:color .15s, border-color .15s; }
        .adi-i2:hover { color:#2fb8da; border-color:rgba(47,184,218,0.6); }
        /* header del ring al TOPE → tooltip abre HACIA ABAJO · alineación horizontal SEGÚN la columna para que encuadre
           en TODAS (cliente e inventario): centro = centrado en el "i" · derecha = abre a la izquierda (no se sale) */
        .adi-i2 .adi-tip { top:calc(100% + 7px); bottom:auto; width:172px; white-space:normal; transform:translateY(-3px); }
        .adi-i2 .adi-tip.tip-l { left:-6px; right:auto; margin-left:0; }
        .adi-i2 .adi-tip.tip-c { left:50%; right:auto; margin-left:-86px; }
        .adi-i2 .adi-tip.tip-r { left:auto; right:-6px; margin-left:0; }
        .adi-i2:hover .adi-tip { opacity:1; transform:translateY(0); }
      `}</style>
    </div>
  );
}
