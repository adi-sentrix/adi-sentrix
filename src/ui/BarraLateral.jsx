/* === src/ui/BarraLateral.jsx · LA BARRA DE BARRITAS · reemplaza a la barra superior ==========================
 *
 * DISEÑO DEL OWNER (2026-08-20, aprobado sobre mockup: «listo, eso es»). Sustituye por completo al header
 * blanco: la marca, las dos acciones y los cuatro indicadores de estado viven ahora acá.
 *
 * CÓMO SE COMPORTA:
 *   · Contraída —el estado normal— mide 44 px y **solo se ven las barritas**. Nada de texto.
 *   · Las opciones aparecen al pasar el cursor y se van solas al salir.
 *   · La barrita de lo que está activo queda más larga y encendida en celeste, contraída o desplegada.
 *
 * ⚠️ NO TIENE FONDO NI BORDE, y es una orden explícita del owner: «esa línea divisora no debería estar, así se
 * sienten como flotando en el panel». Un `border-left` o un fondo propio la convertían en una franja aparte,
 * que es exactamente lo contrario de lo que se buscaba. La separación entre grupos es AIRE, no un trazo.
 *
 * ⚠️ VA FUERA DEL FLUJO (`position:absolute`). Mientras fue una columna más del layout seguía RESERVANDO su
 * franja: el campo de hexágonos y el halo se cortaban antes de llegar al borde y las barritas quedaban
 * flotando sobre una tira vacía, no sobre el lienzo. Quien la vuelva al flujo reintroduce ese defecto.
 * El contenido de abajo se aparta con su propio padding — el FONDO pasa por debajo, el TEXTO no.
 *
 * ⚠️ SE DESPLIEGA TAMBIÉN CON EL FOCO DEL TECLADO (`:focus-within`), no solo con el mouse. Contraída, los
 * nombres no se leen: si abriera únicamente por hover, tabular por la barra sería navegar a ciegas. Por eso
 * el despliegue vive en CSS y no en estado de React — `:hover` y `:focus-within` en la misma regla.
 *
 * Lo que NO está acá y hay que recordar: el selector de escenarios (`ADI_SCENARIO_SWITCHER_ENABLED`) está
 * APAGADO en todos los perfiles por decisión del owner, así que la barra muestra el estado neutro «Datos
 * actuales». Si alguna vez se reenciende, necesita un lugar propio acá — no vuelve solo.
 */
import React, { useMemo } from "react";
import { C } from "./theme.js";

const MONO = "'JetBrains Mono', ui-monospace, monospace";
const SANS = "'DM Sans', system-ui, sans-serif";

/* Una fila de la barra. `activo` alarga y enciende la barrita — es lo único que se lee estando contraída. */
function Fila({ activo, titulo, onClick, icono, testid, children }) {
  return (
    <button className="adi-rail-item" onClick={onClick} title={titulo} aria-label={titulo}
      data-testid={testid} aria-pressed={activo ? "true" : "false"}
      style={{ display:"flex", alignItems:"center", justifyContent:"flex-start", gap:11, width:"100%",
        padding:"0 10px 0 13px", height:37, background:"transparent", border:"none", cursor:"pointer", font:"inherit" }}>
      <span className="adi-rail-dash" style={{ flex:"none", width: activo ? 30 : 16, height:3, borderRadius:99,
        background: activo ? C.celeste : "#6b6f74",
        boxShadow: activo ? "0 0 10px rgba(47,184,218,0.7)" : "none" }}/>
      <span className="adi-rail-pill" style={{ flex:1, minWidth:0, display:"flex", alignItems:"center", gap:9,
        height:35, padding:"0 12px", borderRadius:10, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis",
        fontFamily:SANS, fontSize:12.5, fontWeight:600, letterSpacing:"-0.006em",
        border:`1px solid ${activo ? C.celeste : C.borderLight}`,
        background: activo ? "rgba(47,184,218,0.10)" : C.surface,
        color: activo ? C.text : C.textSub,
        boxShadow: activo ? "inset 0 0 0 1px rgba(47,184,218,0.35)" : "none" }}>
        {icono}{children}
      </span>
    </button>
  );
}

/* Un indicador de estado. No se hace click: informa. Contraída se lee su COLOR; desplegada, su nombre. */
function Estado({ color, titulo, children }) {
  return (
    <div className="adi-rail-st" title={titulo}
      style={{ display:"flex", alignItems:"center", justifyContent:"flex-start", gap:11, width:"100%", padding:"0 10px 0 13px", height:29 }}>
      <span className="adi-rail-dash" style={{ flex:"none", width:12, height:3, borderRadius:99, background:color }}/>
      <span className="adi-rail-stpill" style={{ flex:1, minWidth:0, display:"flex", alignItems:"center", gap:7,
        height:25, padding:"0 12px", borderRadius:99, whiteSpace:"nowrap", overflow:"hidden",
        border:`1px solid ${C.border}`, background:"rgba(255,255,255,0.02)",
        fontFamily:SANS, fontSize:10.5, fontWeight:600, color:C.textMuted }}>
        <span style={{ width:5, height:5, borderRadius:"50%", background:color, flexShrink:0 }}/>
        {children}
      </span>
    </div>
  );
}

/* ══ INTERRUPTOR DE COMPARACIÓN · TEMPORAL, SALE CUANDO EL OWNER ELIJA ══════════════════════════════════════
 * El owner marcó el defecto (2026-08-20): «cuando pasas el cursor, las cosas que muestra se superponen a la
 * Mesa central, es poco fino» — y pidió verlo EN LA APP, sobre el dato real, no sobre un mockup.
 *   ?barra=velo      · velo oscuro con desenfoque detrás de las pastillas + sombra. Nada se mueve de lugar.
 *   ?barra=empuja    · la Mesa se achica lo mismo que crece la barra. Cero superposición, pero el dato salta.
 *   ?barra=apuntada  · la barra no se abre entera: al apuntar una barrita aparece SOLO su nombre.
 *   sin parámetro    · el comportamiento de hoy, sin tocar. El default NO decide nada.
 * Mismo patrón que los overrides de prueba que ya usa el repo (?oracle=1 / ?claims=1): vive en la dirección,
 * no en el perfil, y no cambia lo que ve nadie que no lo escriba. Al elegir, quedan el modo ganador y se van
 * el parámetro y los otros dos. */
function _modoBarra() {
  try { return new URLSearchParams(window.location.search).get("barra") || ""; } catch { return ""; }
}

export function BarraLateral({ mesaAbierta, onMesa, guiaAbierta, onGuia, onInicio, modoIA, demoDias, fecha,
  historialAbierto = false, onConversaciones = null }) {
  const modo = useMemo(_modoBarra, []);
  // «empuja» es el ÚNICO modo que necesita JavaScript: CSS no puede, desde el :hover de la barra, ensanchar el
  // colchón de un panel que es su hermano. Los otros dos son CSS puro.
  const empujar = (on) => {
    if (modo !== "empuja") return;
    try { document.documentElement.style.setProperty("--adi-rail-pad", on ? "236px" : "44px"); } catch {}
  };
  return (
    <div className={`adi-rail${modo ? ` adi-rail--${modo}` : ""}`} aria-label="Barra de ADI"
      onMouseEnter={() => empujar(true)} onMouseLeave={() => empujar(false)}
      onFocus={() => empujar(true)} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) empujar(false); }}
      style={{ position:"absolute", top:0, left:0, bottom:0, width:44, zIndex:20, background:"transparent",
        display:"flex", flexDirection:"column", alignItems:"flex-start", justifyContent:"center", gap:3, padding:"14px 0" }}>
      {/* EL VELO · solo en ?barra=velo. Detrás de las pastillas, se disuelve hacia la izquierda: el dato de
          abajo no se va, se atenúa, y la superposición se lee como una capa a propósito y no como un choque. */}
      {modo === "velo" && <div className="adi-rail-velo" aria-hidden="true"/>}
      <style>{`
        .adi-rail{ transition: width .2s ease; }
        .adi-rail:hover, .adi-rail:focus-within{ width:236px !important; }
        .adi-rail .adi-rail-pill, .adi-rail .adi-rail-stpill{
          opacity:0; transform:translateX(-10px); pointer-events:none;
          transition:opacity .18s ease, transform .18s ease, border-color .15s, color .15s, background .15s; }
        .adi-rail:hover .adi-rail-pill, .adi-rail:focus-within .adi-rail-pill,
        .adi-rail:hover .adi-rail-stpill, .adi-rail:focus-within .adi-rail-stpill{
          opacity:1; transform:none; pointer-events:auto; }
        .adi-rail .adi-rail-marca-txt{ opacity:0; transform:translateX(-10px); transition:opacity .18s ease, transform .18s ease; }
        .adi-rail:hover .adi-rail-marca-txt, .adi-rail:focus-within .adi-rail-marca-txt{ opacity:1; transform:none; }
        .adi-rail .adi-rail-dash{ transition:width .18s ease, background .18s ease; }
        .adi-rail-item:hover .adi-rail-pill{ border-color:rgba(47,184,218,0.55) !important; color:${C.text} !important; }
        .adi-rail-item:hover .adi-rail-dash{ background:#a7abb0; }
        .adi-rail-item:focus-visible{ outline:2px solid ${C.celeste}; outline-offset:-2px; border-radius:10px; }

        /* ── A · VELO Y SOMBRA (?barra=velo) ── */
        .adi-rail-velo{ position:absolute; top:0; left:0; bottom:0; width:236px; z-index:-1; pointer-events:none;
          opacity:0; transition:opacity .18s ease; backdrop-filter:blur(3px); -webkit-backdrop-filter:blur(3px);
          background:linear-gradient(90deg, rgba(5,5,6,0.96) 0%, rgba(5,5,6,0.90) 46%, rgba(5,5,6,0.62) 76%, transparent 100%);
          -webkit-mask-image:linear-gradient(90deg,#000 0%,#000 60%,transparent 100%);
                  mask-image:linear-gradient(90deg,#000 0%,#000 60%,transparent 100%); }
        .adi-rail--velo:hover .adi-rail-velo, .adi-rail--velo:focus-within .adi-rail-velo{ opacity:1; }
        .adi-rail--velo .adi-rail-pill, .adi-rail--velo .adi-rail-stpill{ box-shadow:0 8px 26px -8px rgba(0,0,0,0.9); }

        /* ── C · SOLO LA APUNTADA (?barra=apuntada) · la barra NO se abre entera ── */
        .adi-rail--apuntada:hover, .adi-rail--apuntada:focus-within{ width:44px !important; }
        .adi-rail--apuntada .adi-rail-pill, .adi-rail--apuntada .adi-rail-stpill,
        .adi-rail--apuntada .adi-rail-marca-txt{ opacity:0 !important; transform:translateX(-10px) !important; }
        .adi-rail--apuntada .adi-rail-item:hover .adi-rail-pill,
        .adi-rail--apuntada .adi-rail-item:focus-visible .adi-rail-pill,
        .adi-rail--apuntada .adi-rail-st:hover .adi-rail-stpill{
          opacity:1 !important; transform:none !important; pointer-events:auto;
          position:absolute; left:34px; top:50%; margin-top:-17px; width:max-content; flex:none;
          box-shadow:0 8px 26px -8px rgba(0,0,0,0.9); }
        .adi-rail--apuntada .adi-rail-st:hover .adi-rail-stpill{ margin-top:-12px; }
        .adi-rail--apuntada .adi-rail-item, .adi-rail--apuntada .adi-rail-st{ position:relative; }

        @media (prefers-reduced-motion: reduce){ .adi-rail, .adi-rail *{ transition:none !important; } }
      `}</style>

      {/* LA MARCA · es además el botón de volver al inicio, como era el cubo del header */}
      <button className="adi-rail-item" onClick={onInicio} title="Volver al inicio" aria-label="Volver al inicio"
        style={{ display:"flex", alignItems:"center", justifyContent:"flex-start", gap:10, width:"100%",
          padding:"0 10px 0 13px", height:34, marginBottom:6, background:"transparent", border:"none", cursor:"pointer", font:"inherit" }}>
        <svg width="19" height="19" viewBox="0 0 200 200" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="12" style={{ flexShrink:0 }} aria-hidden="true">
          <polygon points="100,15 173.6,57.5 173.6,142.5 100,185 26.4,142.5 26.4,57.5"/>
        </svg>
        <span className="adi-rail-marca-txt" style={{ flex:1, minWidth:0, display:"flex", alignItems:"baseline", gap:7, whiteSpace:"nowrap", overflow:"hidden" }}>
          <span style={{ fontFamily:SANS, fontSize:13, fontWeight:700, color:C.text, letterSpacing:"-0.01em" }}>ADI</span>
          <span style={{ fontFamily:MONO, fontSize:10, fontWeight:500, color:C.textMuted, letterSpacing:"1.2px", textTransform:"uppercase" }}>Sentrix</span>
        </span>
      </button>

      {/* LA PRINCIPAL · abre y cierra el panel de conversaciones (orden del owner: «una de ellas, la principal,
          permita abrir el panel izquierdo»). Va primera porque es la que gobierna la columna que tiene al lado. */}
      {onConversaciones && (
        <Fila activo={historialAbierto} onClick={onConversaciones}
          titulo="Tus conversaciones con ADI"
          icono={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink:0 }}><path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9.9 9.9 0 0 1-4.2-.9L3 20.5l1.6-4.6A8.3 8.3 0 0 1 3.6 11.5a8.4 8.4 0 0 1 8.4-8.4 8.4 8.4 0 0 1 9 8.4z"/></svg>}>
          Conversaciones
        </Fila>
      )}

      <Fila activo={mesaAbierta} onClick={onMesa}
        titulo="Tu negocio en vivo: cifras, focos y el 80/20 a la mano, con ADI al lado"
        icono={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink:0 }}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>}>
        Mesa de control
      </Fila>

      {/* `guia-abrir` es el ancla de `_guia_inicio_gate`: prueba que la puerta PERMANENTE a la guía existe y
          que sigue viva detrás del panel (la garantía de que la guía no bloquea). Vino del botón del header
          y se muda con él — el identificador no se toca aunque cambie el lugar. */}
      <Fila activo={guiaAbierta} onClick={onGuia} testid="guia-abrir"
        titulo="Cómo se reparten el trabajo ADI y Sentrix, y qué le puedes preguntar"
        icono={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink:0 }}><circle cx="12" cy="12" r="9.5"/><path d="M9.2 9.2a2.9 2.9 0 0 1 5.6 1c0 1.9-2.8 2.4-2.8 2.4"/><line x1="12" y1="17" x2="12" y2="17"/></svg>}>
        ¿Cómo funciona?
      </Fila>

      {/* la separación entre acciones y estado es AIRE (ver la nota de arriba) */}
      <div style={{ height:14, flexShrink:0 }} aria-hidden="true"/>

      <Estado color={C.green} titulo="Estás viendo los datos actuales del negocio">Datos actuales</Estado>
      <Estado color={modoIA ? C.celeste : "#5a5e63"}
        titulo={modoIA ? "Modo IA · el LLM traduce tu pregunta a un spec; ADI calcula, valida y decide (no inventa cifras)" : "Modo demo · motor determinístico, sin LLM ni gasto"}>
        {modoIA ? "IA" : "Demo"}
      </Estado>
      {demoDias != null && (
        <Estado color="#5a5e63" titulo={`Tu demo vence en ${demoDias <= 1 ? "menos de un día" : `${demoDias} días`}`}>
          {demoDias <= 1 ? "Demo · último día" : `Demo · quedan ${demoDias} días`}
        </Estado>
      )}
      <Estado color={C.green} titulo="Datos en vivo">{`Live · ${fecha}`}</Estado>
    </div>
  );
}

export default BarraLateral;
