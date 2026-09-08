/* === src/ui/PanelHistorial.jsx · EL HISTORIAL DE CONVERSACIONES ========================================
 *
 * LA ORDEN DEL OWNER (2026-09-08), textual: «falta el panel donde estará el historial… tienes una idea como
 * la segunda foto» — y la foto era la columna de Codex: «Nuevo chat» arriba, «Recientes» debajo, cada
 * conversación a un clic.
 *
 * ⚠️ POR QUÉ ESTE PANEL SÍ Y EL DE AGOSTO NO. El owner retiró la columna de conversaciones el 2026-08-27 con
 * una regla que sigue vigente: «el panel se veía pero no guardaba nada… un vacío honesto sigue siendo un
 * vacío». La diferencia no es de diseño, es de dato: ahora hay una tabla detrás (migración 009), con su muro
 * por empresa y su rastro de borrado. El panel vuelve PORQUE el historial existe, no al revés.
 *
 * QUÉ MUESTRA Y QUÉ NO. Títulos y fechas — el contenido no viaja para pintar una lista. Y lo que se reabre es
 * un REGISTRO FIEL DE LO QUE SE DIJO, no un turno vivo: los botones a Sentrix y la evidencia desplegable son
 * propiedades del turno que los produjo, no de la conversación. El panel lo dice en una línea en vez de
 * dejar que el usuario descubra solo que los botones no están.
 *
 * CERO CÁLCULO ACÁ (regla 3 de la casa): las fechas se formatean, nada se deriva. La lista llega armada del
 * servidor, ordenada por la base.
 */
import React, { useEffect, useState, useCallback } from "react";
import { C } from "./theme.js";

const SANS = "'DM Sans', system-ui, sans-serif";

/* «hoy», «ayer» y la fecha corta — el mismo criterio que un asesor usaría al nombrar cuándo hablaron. */
function cuando(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const hoy = new Date();
  const dia = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const dif = Math.round((dia(hoy) - dia(d)) / 86400000);
  if (dif <= 0) return "hoy";
  if (dif === 1) return "ayer";
  if (dif < 7) return `hace ${dif} días`;
  return d.toLocaleDateString("es-CL", { day: "numeric", month: "short" });
}

export function PanelHistorial({ abierto, hiloActivo, rev = 0, onAbrirConversacion, onNuevo, onCerrar, cargar }) {
  const [filas, setFilas]   = useState([]);
  const [estado, setEstado] = useState("cargando");   // cargando · listo · sinBase · error

  const refrescar = useCallback(async () => {
    setEstado("cargando");
    try {
      const r = await cargar();
      if (r && r.ok) { setFilas(Array.isArray(r.conversaciones) ? r.conversaciones : []); setEstado("listo"); return; }
      /* SE DECLARA QUE NO SE PUDO, no un vacío mudo: una lista vacía se lee como «no tengo conversaciones»,
       * que es una afirmación FALSA cuando lo que pasó es que no se pudo preguntar.
       * ⚠️ PERO EL MOTIVO CRUDO NO SALE A PANTALLA. La primera versión de esto interpolaba el error tal cual y
       * el panel llegó a mostrar «Failed to execute 'json' on 'Response'» — jerga de navegador en la cara del
       * dueño, contra la regla del registro. El detalle técnico va a la consola, que es de quien lo necesita. */
      if (r && r.motivo) console.warn("[ADI] el historial no se pudo leer:", r.motivo);
      setEstado("sinBase");
    } catch (e) { console.warn("[ADI] el historial no se pudo leer:", (e && e.message) || e); setEstado("error"); }
  }, [cargar]);

  /* `rev` sube cada vez que una conversación se guarda: sin esa dependencia el panel listaba al abrirse y no
   * se enteraba de ninguna nueva — el owner vio la primera en Recientes y ninguna después, con las cuatro ya
   * guardadas en la base. Un índice que no se entera de lo que se indexa miente por omisión. */
  useEffect(() => { if (abierto) refrescar(); }, [abierto, hiloActivo, rev, refrescar]);

  if (!abierto) return null;

  return (
    <aside aria-label="Historial de conversaciones" data-testid="historial-panel"
      style={{ width: 264, flex: "none", display: "flex", flexDirection: "column", minHeight: 0,
        borderRight: `1px solid ${C.border}`, background: "rgba(0,0,0,0.22)" }}>
      <style>{`
        .adi-hist-item{ transition: background 140ms ease, color 140ms ease; }
        .adi-hist-item:hover{ background: rgba(255,255,255,0.055); }
        .adi-hist-item:focus-visible{ outline:2px solid ${C.celeste}; outline-offset:-2px; }
        .adi-hist-x{ opacity:0; transition: opacity 120ms ease; }
        .adi-hist-fila:hover .adi-hist-x{ opacity:1; }
        @media (prefers-reduced-motion: reduce){ .adi-hist-item, .adi-hist-x{ transition:none !important; } }
      `}</style>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
        padding: "12px 10px 8px 14px" }}>
        <span style={{ fontFamily: SANS, fontSize: 12.5, fontWeight: 700, color: C.text, letterSpacing: "-0.01em" }}>
          Conversaciones
        </span>
        <button onClick={onCerrar} aria-label="Cerrar el historial" title="Cerrar el historial"
          style={{ background: "transparent", border: "none", color: C.textMuted, cursor: "pointer", font: "inherit", fontSize: 15, lineHeight: 1, padding: "2px 6px" }}>×</button>
      </div>

      <button className="adi-hist-item" onClick={onNuevo} data-testid="historial-nuevo"
        title="Empieza una conversación nueva"
        style={{ display: "flex", alignItems: "center", gap: 9, margin: "0 8px 8px", padding: "8px 10px",
          borderRadius: 9, background: "rgba(255,255,255,0.035)", border: `1px solid ${C.border}`,
          color: C.text, cursor: "pointer", font: "inherit", fontFamily: SANS, fontSize: 12.5, fontWeight: 600 }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        Nuevo chat
      </button>

      <div style={{ fontFamily: SANS, fontSize: 10.5, fontWeight: 600, color: C.textMuted, letterSpacing: "0.06em",
        textTransform: "uppercase", padding: "2px 14px 6px" }}>Recientes</div>

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "0 8px 10px" }}>
        {estado === "cargando" && (
          <div style={{ fontFamily: SANS, fontSize: 12, color: C.textMuted, padding: "6px 6px" }}>Buscando…</div>
        )}

        {/* SIN EMPRESA FIRMADA NO HAY HISTORIAL, y se dice con la razón: el demo no guarda conversaciones
            porque no hay a nombre de quién guardarlas. Es la misma honestidad del «Tus datos» vacío. */}
        {estado !== "cargando" && estado !== "listo" && (
          <div style={{ fontFamily: SANS, fontSize: 11.5, lineHeight: 1.5, color: C.textMuted, padding: "6px 6px" }}>
            El historial se guarda por empresa. Todavía no puedo leerlo — vuelve a intentar en un momento.
          </div>
        )}

        {estado === "listo" && filas.length === 0 && (
          <div style={{ fontFamily: SANS, fontSize: 11.5, lineHeight: 1.5, color: C.textMuted, padding: "6px 6px" }}>
            Todavía no hay conversaciones guardadas. La de ahora aparece acá en cuanto le hagas la primera pregunta.
          </div>
        )}

        {estado === "listo" && filas.map((f) => (
          <div key={f.hilo} className="adi-hist-fila" style={{ position: "relative" }}>
            <button className="adi-hist-item" onClick={() => onAbrirConversacion(f.hilo)}
              title={f.titulo || "Conversación sin título"}
              aria-current={f.hilo === hiloActivo ? "true" : undefined}
              style={{ display: "block", width: "100%", textAlign: "left", padding: "7px 26px 7px 10px",
                borderRadius: 8, border: "none", cursor: "pointer", font: "inherit",
                background: f.hilo === hiloActivo ? "rgba(255,255,255,0.07)" : "transparent" }}>
              <span style={{ display: "block", fontFamily: SANS, fontSize: 12.5, color: C.text,
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {f.titulo || "Conversación sin título"}
              </span>
              <span style={{ display: "block", fontFamily: SANS, fontSize: 10.5, color: C.textMuted, marginTop: 2 }}>
                {cuando(f.actualizado)}
              </span>
            </button>
          </div>
        ))}
      </div>

      {/* LA LÍNEA QUE EVITA UNA SORPRESA: al reabrir se lee lo que se dijo, no se revive el turno. Decirlo
          acá cuesta una línea; que el usuario lo descubra buscando un botón que no está, cuesta confianza. */}
      <div style={{ fontFamily: SANS, fontSize: 10.5, lineHeight: 1.45, color: C.textMuted,
        borderTop: `1px solid ${C.border}`, padding: "8px 14px 10px" }}>
        Al abrir una conversación se lee lo que se dijo. Para seguir trabajando, pregunta de nuevo.
      </div>
    </aside>
  );
}

export default PanelHistorial;
