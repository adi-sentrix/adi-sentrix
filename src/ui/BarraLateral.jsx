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
      {/* BARRITAS MÁS CHICAS (owner 2026-08-20: «haz las líneas un poco más pequeñas»): 12 px en reposo y 24 al
          estar activa, con 2,5 de grosor. Antes eran 16/30×3 y pesaban demasiado para lo que son — una marca. */}
      <span className="adi-rail-dash" style={{ flex:"none", width: activo ? 24 : 12, height:2.5, borderRadius:99,
        background: activo ? C.celeste : C.dashInactivo,
        boxShadow: activo ? "0 0 9px rgba(47,184,218,0.7)" : "none" }}/>
      {/* ⚠️ CAJA NEGRA Y OPACA (owner 2026-08-20: «al mostrarlas deben estar en cuadro negro, notarse»; antes:
          «no debe ser transparente… es una opción, por lo tanto después se quitará»). El fondo es negro —más
          oscuro que el lienzo— y la sombra la despega: una opción que se abre sobre el contenido tiene que
          TAPARLO y leerse como una pieza suelta, no como una mancha. La ACTIVA se distingue por el celeste en
          el borde y en su resplandor, no por un fondo distinto: así el bloque se ve parejo y lo que canta es
          el estado, no el relleno. */}
      <span className="adi-rail-pill" style={{ flex:1, minWidth:0, display:"flex", alignItems:"center", gap:9,
        height:35, padding:"0 12px", borderRadius:10, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis",
        fontFamily:SANS, fontSize:12.5, fontWeight:600, letterSpacing:"-0.006em",
        border:`1px solid ${activo ? C.celeste : C.borderLight}`,
        background: C.pastillaBg,
        color: activo ? C.text : C.textSub,
        boxShadow: activo
          ? "0 0 0 1px rgba(47,184,218,0.45), 0 0 20px -2px rgba(47,184,218,0.55), 0 10px 26px -10px rgba(0,0,0,0.95)"
          : C.pastillaSombra }}>
        {icono}{children}
      </span>
    </button>
  );
}

/* ⚠️ LAS TRES VARIANTES DE LA BARRA SE FUERON (owner 2026-08-27: «consolidar la experiencia elegida como
 * comportamiento normal de la app; sacar las variantes que ya no vamos a usar si no cumplen función real
 * de producción»). Vivían detrás de `?barra=velo|empuja|apuntada` desde el 2026-08-20, para poder elegir
 * entre ellas mirando la app real y no un mockup. Nunca se eligió ninguna — y una exploración que no se
 * cierra deja de ser exploración: pasa a ser código que nadie ejecuta y que el próximo lector tiene que
 * descifrar antes de poder tocar nada. Queda el comportamiento que la app tenía y sigue teniendo: la barra
 * se ensancha al apuntarla, por encima de lo que hay debajo.
 *
 * ⚠️ EL DEFECTO QUE LAS ORIGINÓ SE ARREGLÓ EL 2026-08-27, y con el camino que ninguna de las tres tomaba del
 * todo: el VELO, pero atado a la superficie. Ver la nota del elemento, más abajo. Lo que se descartó y por qué
 * queda escrito ahí, porque es la parte que sirve dentro de seis meses. */

/* LOS CUATRO INDICADORES DE ESTADO SE FUERON (owner 2026-08-20: «la fecha no es necesaria, datos actuales
 * tampoco y demo tampoco, quítalos»). Eran «Datos actuales», «Demo/IA», el vencimiento de la demo y
 * «Live · fecha»: heredados del header blanco, informaban de la sesión, no del negocio. La barra queda solo
 * con lo que se HACE. Nada de eso se perdió del producto — el modo y el acceso siguen en su lógica; lo que
 * se quitó es su vitrina. */
export function BarraLateral({ mesaAbierta, onMesa, guiaAbierta, onGuia, onInicio,
  datosAbiertos = false, onDatos = null }) {
  return (
    <div className="adi-rail" aria-label="Barra de ADI"
      style={{ position:"absolute", top:0, left:0, bottom:0, width:44, zIndex:20, background:"transparent",
        display:"flex", flexDirection:"column", alignItems:"flex-start", justifyContent:"center", gap:3, padding:"14px 0" }}>
      {/* ⚠️ EL VELO · LA CORRECCIÓN DEL DEFECTO QUE EL OWNER MARCÓ EL 2026-08-20 y quedó abierto un mes:
          «cuando pasas el cursor, las cosas que muestra se superponen a la Mesa central, es poco fino».
          QUÉ PASABA, medido: la barra no tiene fondo. Al abrirse pasaba de 44 a 236 px por ENCIMA del contenido,
          y como lo único opaco eran las pastillas, entre una y otra seguía viéndose el texto de abajo y cada
          pastilla caía sobre una palabra distinta. No era una capa: era un choque.
          POR QUÉ ESTE ARREGLO Y NO CORRER LA MESA. Se probaron tres caminos en agosto (velo · empujar el panel ·
          mostrar solo el nombre apuntado) y ninguno se eligió. Empujar el panel obliga a que TODO el dato salte
          de lugar cada vez que el cursor roza el borde izquierdo, y en un tablero eso es peor que la
          superposición: se pierde el punto que estabas mirando. El velo no mueve nada — hace que la
          superposición se lea como lo que es, una capa que se apoya encima y deja ver que abajo sigue habiendo
          algo, atenuado. El owner pidió que no se superpusiera FEO, no que no se superpusiera.
          ⚠️ VA DETRÁS (`zIndex:-1`) Y NO RECIBE CLICKS: es fondo, no superficie interactiva. */}
      <div className="adi-rail-velo" aria-hidden="true"/>
      <style>{`
        .adi-rail{ transition: width .2s ease; }
        /* EL VELO · aparece con la barra y se disuelve hacia la derecha. El desenfoque hace que lo de abajo se
           lea como profundidad y no como suciedad; la máscara evita el corte vertical en el borde. */
        .adi-rail-velo{ position:absolute; top:0; left:0; bottom:0; width:236px; z-index:-1; pointer-events:none;
          opacity:0; transition:opacity .18s ease;
          backdrop-filter:blur(4px); -webkit-backdrop-filter:blur(4px);
          background:${C.veloBarra};
          -webkit-mask-image:linear-gradient(90deg,#000 0%,#000 62%,transparent 100%);
                  mask-image:linear-gradient(90deg,#000 0%,#000 62%,transparent 100%); }
        .adi-rail:hover .adi-rail-velo, .adi-rail:focus-within .adi-rail-velo{ opacity:1; }
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
        /* RESPLANDOR AL SITUARSE ENCIMA (owner 2026-08-20: «si nos situamos en una debe tener resplandor»).
           El halo es del MISMO celeste del estado activo pero más tenue: al pasar el cursor la opción se
           enciende, y al soltarla vuelve — el encendido fuerte queda reservado para la que está activa. */
        .adi-rail-item:hover .adi-rail-pill{ border-color:${C.celeste} !important; color:${C.text} !important;
          box-shadow:0 0 0 1px rgba(47,184,218,0.30), 0 0 18px -3px rgba(47,184,218,0.42), 0 10px 26px -10px rgba(0,0,0,0.95) !important; }
        .adi-rail-item:hover .adi-rail-dash{ background:${C.celeste}; box-shadow:0 0 9px rgba(47,184,218,0.6); }
        .adi-rail-item:focus-visible{ outline:2px solid ${C.celeste}; outline-offset:-2px; border-radius:10px; }

        @media (prefers-reduced-motion: reduce){ .adi-rail, .adi-rail *{ transition:none !important; } }
      `}</style>

      {/* LA MARCA · es además el botón de volver al inicio, como era el cubo del header */}
      <button className="adi-rail-item" onClick={onInicio} title="Volver al inicio" aria-label="Volver al inicio"
        style={{ display:"flex", alignItems:"center", justifyContent:"flex-start", gap:10, width:"100%",
          padding:"0 10px 0 13px", height:34, marginBottom:6, background:"transparent", border:"none", cursor:"pointer", font:"inherit" }}>
        <svg width="19" height="19" viewBox="0 0 200 200" fill="none" stroke={C.logoTrazo} strokeWidth="12" style={{ flexShrink:0 }} aria-hidden="true">
          <polygon points="100,15 173.6,57.5 173.6,142.5 100,185 26.4,142.5 26.4,57.5"/>
        </svg>
        <span className="adi-rail-marca-txt" style={{ flex:1, minWidth:0, display:"flex", alignItems:"baseline", gap:7, whiteSpace:"nowrap", overflow:"hidden" }}>
          <span style={{ fontFamily:SANS, fontSize:13, fontWeight:700, color:C.text, letterSpacing:"-0.01em" }}>ADI</span>
          <span style={{ fontFamily:MONO, fontSize:10, fontWeight:500, color:C.textMuted, letterSpacing:"1.2px", textTransform:"uppercase" }}>Sentrix</span>
        </span>
      </button>

      {/* LA PRINCIPAL · abre y cierra el panel de conversaciones (orden del owner: «una de ellas, la principal,
          permita abrir el panel izquierdo»). Va primera porque es la que gobierna la columna que tiene al lado. */}
      {/* ⚠️ ACÁ IBA «CONVERSACIONES», la puerta al panel de historial. Se fue con el panel el 2026-08-27:
          el panel se veía pero no guardaba nada — mostraba la conversación en curso y una línea diciendo que
          las anteriores aparecerían «cuando el producto empiece a guardarlas». Un vacío honesto sigue siendo
          un vacío. Cuando el historial exista de verdad, la barrita vuelve con él. */}

      <Fila activo={mesaAbierta} onClick={onMesa}
        titulo="Tu negocio en vivo: cifras, focos y el 80/20 a la mano, con ADI al lado"
        icono={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink:0 }}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>}>
        Mesa de control
      </Fila>

      {/* TUS DATOS (v1.4) · la cuarta puerta. Es PERMANENTE y no un paso de arranque a propósito: probar con
          datos propios no es algo que se hace una vez: se sube un archivo, se mira, se corrige y se vuelve a
          subir. Una puerta que solo aparece al principio obligaría a recargar la app para reintentar.
          `datos-abrir` es el ancla del gate. */}
      <Fila activo={datosAbiertos} onClick={onDatos} testid="datos-abrir"
        titulo="Sube la planilla de tu negocio y prueba ADI con tus propios datos"
        icono={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink:0 }}><path d="M21 15v3.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5V15"/><polyline points="7.5 8.5 12 4 16.5 8.5"/><line x1="12" y1="4" x2="12" y2="15"/></svg>}>
        Tus datos
      </Fila>

      {/* `guia-abrir` es el ancla de `_guia_inicio_gate`: prueba que la puerta PERMANENTE a la guía existe y
          que sigue viva detrás del panel (la garantía de que la guía no bloquea). Vino del botón del header
          y se muda con él — el identificador no se toca aunque cambie el lugar. */}
      <Fila activo={guiaAbierta} onClick={onGuia} testid="guia-abrir"
        titulo="Cómo se reparten el trabajo ADI y Sentrix, y qué le puedes preguntar"
        icono={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink:0 }}><circle cx="12" cy="12" r="9.5"/><path d="M9.2 9.2a2.9 2.9 0 0 1 5.6 1c0 1.9-2.8 2.4-2.8 2.4"/><line x1="12" y1="17" x2="12" y2="17"/></svg>}>
        ¿Cómo funciona?
      </Fila>

    </div>
  );
}

export default BarraLateral;
