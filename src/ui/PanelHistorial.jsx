/* === src/ui/PanelHistorial.jsx · LA COLUMNA IZQUIERDA · el historial de conversaciones ======================
 *
 * PROPUESTA EN REVISIÓN (owner 2026-08-20) · se monta SOLO con `?historial=1`. Sin el parámetro la app queda
 * exactamente como está: esto todavía no decidió nada.
 *
 * LA IDEA: tres columnas — historial a la izquierda · ADI al centro · Sentrix a la derecha.
 *
 * EL TONO · el claro de papel se PROBÓ Y SE DESCARTÓ. Primero se montó con la escalera clara de la landing
 * (#fafafa · #f5f5f6 · #efeff1), que era lo que el owner había pedido; al verlo dijo que no: lo quiere
 * **oscuro**, «como lo que te mostré, eso hará contraste». Así que va en GRAFITO — el negro de la app con un
 * punto más de luz, para que se despegue del lienzo del centro sin encender la pantalla.
 * ⚠️ El tono definitivo NO está cerrado: hay tres candidatos (grafito · violeta · tinta) y dos formas de que
 * el color «vaya cambiando» (que respire, o que siga a la cara abierta de Sentrix) en el mockup
 * `ADI_historial_oscuro.html`. Grafito es el que se deja mientras tanto porque es el único que no agrega un
 * color nuevo al producto. Cambiarlo es tocar SOLO el bloque `P` de acá abajo.
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

/* GRAFITO · un solo bloque, a propósito: cambiar el tono del panel es cambiar SOLO esto.
 * `bg1` es el lienzo (#111113, apenas por encima del #0a0a0a del centro — ahí está el contraste, en el punto
 * de luz, no en un color). `bg`/`bg3` son la tarjeta y el hover. El acento sigue siendo el celeste de la casa. */
const P = {
  bg: "#17171a", bg1: "#111113", bg2: "#17171a", bg3: "#1e1e22",
  text: "#f5f5f5", text2: "#c9c9c9", text3: "#969696", text4: "#7c8085",
  line: "rgba(255,255,255,0.07)", cel: "#2fb8da",
};
const SANS = "'DM Sans', system-ui, sans-serif";
export function PanelHistorial({ onNueva, hayConversacion, usuario, demoDias, onToggleColapso }) {
  /* PLEGADO = NO MONTADO (owner 2026-08-20). Este componente ya no tiene variante angosta: cuando se pliega,
   * simplemente no se renderiza, y quien lo trae de vuelta es la barrita «Conversaciones» de la barra del
   * borde izquierdo. Antes había una tira propia de 52 px, pero con la barra mudada a ese mismo borde eran
   * dos columnas angostas haciendo el mismo trabajo. Es el reparto de Code: barra · panel · centro.
   *
   * `paddingLeft` = la franja donde flotan las barritas. La barra está fuera del flujo y se apoya sobre el
   * borde izquierdo de la app, así que cae encima de ESTE panel: sin el colchón, el cubo y el botón de plegar
   * quedaban debajo de ellas. */
  return (
    <aside style={{ flex:"none", width:250, display:"flex", flexDirection:"column", minHeight:0, paddingLeft:44,
      background:P.bg1, borderRight:`1px solid ${P.line}`, color:P.text, fontFamily:SANS }}>

      <div style={{ flex:"none", padding:"14px 14px 10px", display:"flex", flexDirection:"column", gap:11 }}>
        <div style={{ display:"flex", alignItems:"center", gap:9 }}>
          {/* LA MARCA, ESCRITA COMO EN TODA LA CASA (owner 2026-08-20): «ADI» en sans, peso 700, y «Sentrix» en
              mono, mayúsculas y con tracking. Acá decía «CONVERSACIONES», que nombraba la columna y no el
              producto — el nombre de la sección ya lo dice la barrita encendida al lado. */}
          <span style={{ display:"flex", alignItems:"baseline", gap:7, minWidth:0, flex:1 }}>
            <span style={{ fontSize:14, fontWeight:700, letterSpacing:"-0.02em", color:P.text }}>ADI</span>
            <span style={{ fontFamily:"'JetBrains Mono', ui-monospace, monospace", fontSize:10, fontWeight:500,
              color:P.text3, letterSpacing:"1.2px", textTransform:"uppercase" }}>Sentrix</span>
          </span>
          <button onClick={onToggleColapso} title="Plegar el historial" aria-label="Plegar el historial"
            style={{ width:24, height:24, borderRadius:6, border:"none", background:"transparent", color:P.text4,
              cursor:"pointer", display:"grid", placeItems:"center", padding:0, flexShrink:0 }}
            onMouseEnter={(e) => { e.currentTarget.style.background = P.bg3; e.currentTarget.style.color = P.text2; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = P.text4; }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="4" width="18" height="16" rx="2"/><line x1="9" y1="4" x2="9" y2="20"/>
            </svg>
          </button>
        </div>

        <button onClick={onNueva} title="Empezar una conversación nueva"
          style={{ display:"flex", alignItems:"center", gap:8, width:"100%", padding:"9px 12px", borderRadius:10,
            cursor:"pointer", border:`1px solid ${P.line}`, background:P.bg, color:P.text, fontFamily:SANS,
            fontSize:12.5, fontWeight:600, boxShadow:"0 1px 2px rgba(0,0,0,0.04)", transition:"background 0.14s, border-color 0.14s" }}
          onMouseEnter={(e) => { e.currentTarget.style.background = P.bg3; e.currentTarget.style.borderColor = P.cel; }}
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
        <span style={{ width:26, height:26, borderRadius:"50%", background:P.cel, color:"#0a0a0a", display:"grid",
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
