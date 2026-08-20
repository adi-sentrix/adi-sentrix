/* === src/ui/PanelHistorial.jsx · LA COLUMNA IZQUIERDA · el historial de conversaciones ======================
 *
 * PROPUESTA EN REVISIÓN (owner 2026-08-20) · se monta SOLO con `?historial=1`. Sin el parámetro la app queda
 * exactamente como está: esto todavía no decidió nada.
 *
 * LA IDEA: tres columnas — historial a la izquierda · ADI al centro · Sentrix a la derecha.
 *
 * EL TONO NO SE INVENTÓ. El owner pidió «un panel blanco pero no extremo, algo lindo con toque… transmitir
 * similitud con la página y los colores», así que los claros son LITERALMENTE los de la landing v2
 * (`landing-v2/src/styles/global.css`): lienzo #fafafa · tarjeta #f5f5f6 · hover #efeff1 · línea #e9e8ea ·
 * y el texto en #17181c, que a propósito NO es negro puro. El celeste se oscurece a #0f7290 porque el #2fb8da
 * de la app no contrasta sobre claro. Copiarlos a mano acá es deuda: si la landing mueve su escalera, esto
 * queda desincronizado — y por eso están todos juntos en un solo bloque, para portarlos de una sola vez.
 *
 * ⚠️ LO QUE ESTE PANEL TODAVÍA NO PUEDE HACER, y hay que decidirlo antes de prometerlo:
 * **las conversaciones no se guardan**. Hoy el hilo vive en memoria y al recargar se pierde. Un historial de
 * verdad pide (a) dónde se persiste —navegador o Supabase, que es el frente de la 2.0— y (b) qué pasa con la
 * MEMORIA de ADI al saltar de hilo: `conversationScope` es su estado vivo, y cambiar de conversación sin
 * reiniciarlo haría que arrastre el contexto del hilo anterior y conteste sobre la entidad equivocada. Eso es
 * comportamiento de ADI, no maquetado. Mientras tanto la lista muestra SOLO la conversación en curso: no se
 * dibujan conversaciones de ejemplo, porque un historial falso en pantalla es una promesa que el producto no
 * cumple.
 */
import React from "react";

const P = {   // la escalera de papel de la landing · un solo bloque, a propósito
  bg: "#ffffff", bg1: "#fafafa", bg2: "#f5f5f6", bg3: "#efeff1",
  text: "#17181c", text2: "#3c4149", text3: "#6f6e77", text4: "#8c8b93",
  line: "#e9e8ea", cel: "#0f7290",
};
const SANS = "'DM Sans', system-ui, sans-serif";

export function PanelHistorial({ onNueva, hayConversacion, usuario, demoDias }) {
  return (
    <aside style={{ flex:"none", width:250, display:"flex", flexDirection:"column", minHeight:0,
      background:P.bg1, borderRight:`1px solid ${P.line}`, color:P.text, fontFamily:SANS }}>

      <div style={{ flex:"none", padding:"14px 14px 10px", display:"flex", flexDirection:"column", gap:11 }}>
        <div style={{ display:"flex", alignItems:"center", gap:9 }}>
          <span style={{ width:28, height:28, borderRadius:8, background:"#131313", display:"grid", placeItems:"center", flexShrink:0 }}>
            <svg width="17" height="17" viewBox="0 0 200 200" fill="none" stroke="#cfd5db" strokeWidth="3" aria-hidden="true">
              <polygon points="100,15 173.6,57.5 173.6,142.5 100,185 26.4,142.5 26.4,57.5"/>
              <circle cx="100" cy="100" r="55" strokeWidth="1.7" opacity="0.65"/>
              <ellipse cx="100" cy="100" rx="55" ry="22" strokeWidth="1.5" opacity="0.5"/>
              <circle cx="100" cy="100" r="7" fill="#2fb8da" stroke="none"/>
            </svg>
          </span>
          <span style={{ display:"flex", alignItems:"baseline", gap:7, minWidth:0 }}>
            <span style={{ fontSize:14, fontWeight:700, letterSpacing:"-0.02em", color:P.text }}>ADI</span>
            <span style={{ fontSize:10, fontWeight:500, color:P.text3, letterSpacing:"0.14em", textTransform:"uppercase" }}>Sentrix</span>
          </span>
        </div>

        <button onClick={onNueva} title="Empezar una conversación nueva"
          style={{ display:"flex", alignItems:"center", gap:8, width:"100%", padding:"9px 12px", borderRadius:10,
            cursor:"pointer", border:`1px solid ${P.line}`, background:P.bg, color:P.text, fontFamily:SANS,
            fontSize:12.5, fontWeight:600, boxShadow:"0 1px 2px rgba(0,0,0,0.04)", transition:"background 0.14s, border-color 0.14s" }}
          onMouseEnter={(e) => { e.currentTarget.style.background = P.bg3; e.currentTarget.style.borderColor = "#dcdbde"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = P.bg; e.currentTarget.style.borderColor = P.line; }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Nueva conversación
        </button>
      </div>

      <div style={{ flex:1, minHeight:0, overflowY:"auto", padding:"4px 8px 10px", display:"flex", flexDirection:"column", gap:1 }}>
        <div style={{ fontSize:10, fontWeight:600, letterSpacing:"0.09em", textTransform:"uppercase", color:P.text4, padding:"12px 6px 5px" }}>
          Hoy
        </div>
        {hayConversacion ? (
          <div style={{ display:"flex", flexDirection:"column", gap:2, padding:"8px 10px", borderRadius:9,
            background:P.bg, border:`1px solid ${P.line}`, boxShadow:"0 1px 2px rgba(0,0,0,0.05)" }}>
            <span style={{ fontSize:12.5, fontWeight:600, color:P.cel, lineHeight:1.35 }}>Conversación en curso</span>
            <span style={{ fontSize:10.5, color:P.text4 }}>Ahora</span>
          </div>
        ) : (
          <div style={{ padding:"8px 10px", fontSize:11.5, color:P.text4, lineHeight:1.5 }}>
            Todavía no empezaste a hablar con ADI.
          </div>
        )}
        {/* NO se dibujan conversaciones anteriores: no existen. Ver la nota de arriba — un historial de ejemplo
            en pantalla sería prometer algo que el producto no guarda. */}
        <div style={{ marginTop:14, padding:"9px 10px", borderRadius:9, background:P.bg2,
          border:`1px solid ${P.line}`, fontSize:10.5, color:P.text3, lineHeight:1.5 }}>
          Las conversaciones anteriores aparecerán acá cuando el producto empiece a guardarlas.
        </div>
      </div>

      <div style={{ flex:"none", padding:"10px 12px", borderTop:`1px solid ${P.line}`, display:"flex", alignItems:"center", gap:9 }}>
        <span style={{ width:26, height:26, borderRadius:"50%", background:P.cel, color:"#fff", display:"grid",
          placeItems:"center", fontSize:10.5, fontWeight:700, flexShrink:0 }}>
          {(usuario || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?"}
        </span>
        <span style={{ flex:1, minWidth:0 }}>
          <b style={{ display:"block", fontSize:12, fontWeight:600, color:P.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
            {usuario || "Invitado"}
          </b>
          <span style={{ display:"block", fontSize:10, color:P.text4 }}>
            {demoDias != null ? (demoDias <= 1 ? "Demo · último día" : `Demo · quedan ${demoDias} días`) : "Datos actuales"}
          </span>
        </span>
      </div>
    </aside>
  );
}

export default PanelHistorial;
