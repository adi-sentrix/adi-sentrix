/* === src/ui/ScenarioSelector.jsx ===
 * Chips Bonanza/Tensión/Crisis · extraído de 41cc33d8 · verbatim.
 * SCENARIOS ya vive sellado en config (mismos valores que el piso). */
import React from "react";
import { C } from "./theme.js";
import { SCENARIOS } from "../config/scenarios.js";

export function ScenarioSelector({ scenario, onChange }) {
  return (
    <div style={{
      display:"flex", alignItems:"center", gap:6,
      padding:"4px 8px",
      borderRadius:999,
      background:C.surface,
      border:`1px solid ${C.border}`
    }}>
      <span className="hdr-esc-label" style={{
        fontSize:9, fontWeight:700,
        color:C.textMuted, letterSpacing:"0.08em",
        marginRight:4, textTransform:"uppercase"
      }}>
        Escenario
      </span>
      {Object.values(SCENARIOS).map(s => {
        const active = scenario === s.id;
        return (
          <button key={s.id}
            onClick={() => onChange(s.id)}
            title={s.sublabel}
            style={{
              display:"flex", alignItems:"center", gap:5,
              padding:"5px 11px",
              borderRadius:999,
              fontSize:11, fontWeight: active ? 700 : 600,
              border:"none", cursor:"pointer",
              background: active ? `${s.color}22` : "transparent",
              color: active ? s.color : C.textSub,
              transition:"all 0.18s ease"
            }}
            onMouseEnter={e=>{ if(!active){ e.currentTarget.style.color = s.color; } }}
            onMouseLeave={e=>{ if(!active){ e.currentTarget.style.color = C.textSub; } }}>
            <span style={{
              width:7, height:7, borderRadius:"50%",
              background:s.dotColor,
              boxShadow: active ? `0 0 8px ${s.dotColor}` : "none",
              transition:"box-shadow 0.18s ease"
            }}/>
            <span className={active ? undefined : "hdr-esc-word"}>{s.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export default ScenarioSelector;
