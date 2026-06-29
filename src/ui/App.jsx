/* === src/ui/App.jsx · ADISentric (shell mínimo) ===
 * Raíz de la app. Por ahora: header (logo + LIVE + escenario) + ChatADI corriendo como app real.
 * SIN panel de datos / módulos todavía (entran en el próximo paso de Fase 5).
 * Estado UI mínimo: escenario. La UI no calcula nada · el chat consume answerADI. */
import React, { useState } from "react";
import { C } from "./theme.js";
import { ScenarioSelector } from "./ScenarioSelector.jsx";
import { ChatADI } from "./ChatADI.jsx";
import { SentrixPanel } from "./SentrixPanel.jsx";   // Etapa 5 · Sentrix · panel de evidencia (se abre con la lectura)

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
          <div style={{ width:32, height:32, borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, background:"linear-gradient(135deg, rgba(0,176,212,0.08), rgba(14,127,168,0.04))", border:"1px solid rgba(0,176,212,0.18)", boxShadow:"inset 0 1px 0 rgba(255,255,255,0.06), 0 0 0 1px rgba(0,176,212,0.06), 0 4px 12px -3px rgba(0,176,212,0.2)" }}>
            <svg width="20" height="20" viewBox="0 0 200 200" fill="none" stroke="#00b0d4" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="100,15 173.6,57.5 173.6,142.5 100,185 26.4,142.5 26.4,57.5" strokeWidth="3.2"/>
              <circle cx="100" cy="100" r="55" strokeWidth="1.7" opacity="0.65"/>
              <ellipse cx="100" cy="100" rx="55" ry="22" strokeWidth="1.5" opacity="0.5"/>
              <ellipse cx="100" cy="100" rx="22" ry="55" strokeWidth="1.5" opacity="0.5"/>
              <circle cx="100" cy="100" r="6" fill="#00b0d4" stroke="none"/>
            </svg>
          </div>
          <div style={{ display:"flex", alignItems:"baseline", gap:7 }}>
            <span style={{ fontWeight:700, fontSize:14, letterSpacing:"-0.3px", color:C.text }}>ADI</span>
            <span style={{ fontWeight:500, fontSize:10.5, color:C.textMuted, fontFamily:"'JetBrains Mono', ui-monospace, monospace", letterSpacing:"1.2px", textTransform:"uppercase" }}>Sentrix</span>
          </div>
        </div>

        <div style={{ display:"flex", alignItems:"center", gap:14, flexShrink:0 }}>
          <ScenarioSelector scenario={scenario} onChange={setScenario}/>
          <div style={{ display:"flex", alignItems:"center", gap:7, paddingLeft:14, borderLeft:`1px solid ${C.border}`, flexShrink:0, whiteSpace:"nowrap" }}>
            <span style={{ position:"relative", width:6, height:6, borderRadius:"50%", background:C.green, flexShrink:0 }}>
              <span style={{ position:"absolute", inset:-3, borderRadius:"50%", border:"1px solid rgba(16,185,129,0.5)", animation:"livePulse 1.8s ease-out infinite" }}/>
            </span>
            <span style={{ fontSize:9.5, color:C.textMuted, fontFamily:"'JetBrains Mono', ui-monospace, monospace", letterSpacing:"1px" }}>LIVE</span>
            <span style={{ fontSize:10.5, color:C.text, fontWeight:500, fontFamily:"'JetBrains Mono', ui-monospace, monospace", letterSpacing:"0.3px" }}>{getCurrentDateString()}</span>
          </div>
        </div>
      </header>

      {/* ── MAIN · ADI centro con atmósfera ── */}
      <main style={{ flex:1, minWidth:0, display:"flex", flexDirection:"column", position:"relative", background:C.bg, overflow:"hidden" }}>
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
                onMouseEnter={e=>{ e.currentTarget.style.background = "rgba(0,176,212,0.25)"; }}
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
        @keyframes auroraBreathe { 0%,100%{opacity:0.6} 50%{opacity:1} }
        @keyframes livePulse {
          0%  { box-shadow: 0 0 0 0 rgba(0,176,212,0.5); transform:scale(1); }
          60% { box-shadow: 0 0 0 8px rgba(0,176,212,0); transform:scale(1.15); }
          100%{ box-shadow: 0 0 0 0 rgba(0,176,212,0);  transform:scale(1); }
        }
        @keyframes adiAurora {
          0%, 100% { transform: scale(1)   translate(0, 0);     opacity: 0.7; }
          25%      { transform: scale(1.06) translate(-3%, 2%);  opacity: 0.85; }
          50%      { transform: scale(1.1)  translate(2%, -2%);  opacity: 1; }
          75%      { transform: scale(1.04) translate(3%, 3%);   opacity: 0.8; }
        }
        @keyframes adiSpark {
          0%, 100% { transform: scale(1);   box-shadow: 0 0 0 1px rgba(0,176,212,0.4), 0 0 16px rgba(0,176,212,0.55), 0 0 32px rgba(0,176,212,0.2); }
          50%      { transform: scale(1.1); box-shadow: 0 0 0 1px rgba(0,176,212,0.7), 0 0 28px rgba(0,176,212,0.85), 0 0 56px rgba(0,176,212,0.4); }
        }
      `}</style>
    </div>
  );
}
