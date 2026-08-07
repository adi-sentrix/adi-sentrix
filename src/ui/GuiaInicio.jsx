/* === src/ui/GuiaInicio.jsx · LA GUÍA DE INICIO (owner 2026-08-07) ===
 * El problema: la app abría en un chat vacío. El usuario no sabía qué preguntar ni para qué servía el panel.
 *
 * EL VACÍO NO SE LLENA CON UN TOUR DE FEATURES. Se llena explicando la DIVISIÓN DEL TRABAJO, que es lo único
 * que el usuario no puede deducir solo mirando la pantalla:
 *     "Sentrix muestra el dato. ADI lo interpreta."
 * Tres pasos, no más: (1) qué hace cada uno + el ida y vuelta · (2) qué se puede preguntar, con ejemplos REALES
 * y clickeables · (3) dónde está la evidencia.
 *
 * DOS INVARIANTES DURAS DE ESTE ARCHIVO:
 *
 *   1. LOS EJEMPLOS NO SE INVENTAN. `GUIA_EJEMPLOS` no declara preguntas propias: las DERIVA de HERO_CHIPS
 *      (ChatADI.jsx) buscándolas por texto exacto. HERO_CHIPS son specs curados y verificados — si la guía
 *      prometiera algo que el motor no contesta, el primer turno del usuario sería un decline, peor que no
 *      haber guiado. Si mañana alguien renombra un chip, la guía muestra UNO MENOS (degrada honesto, no
 *      revienta la app) y `_guia_inicio_gate` falla en CI diciendo exactamente cuál se perdió.
 *
 *   2. CERO LLAMADAS AL PROVEEDOR. La guía es texto estático + los specs que ya existen. No pide plan, no pide
 *      narración, no toca el gateway. El único efecto lateral de un ejemplo es ejecutar el MISMO camino que
 *      tocar ese chip en el hero (submitSpec), que es donde vive la decisión de cómo resolverlo.
 *
 * FORMA: panel que NO bloquea (se puede saltar en cualquier paso, la app sigue clickeable detrás) · en móvil
 * baja a hoja inferior a ancho completo. Primera visita se abre sola; después, solo desde el botón permanente
 * "¿Cómo funciona?" del header.
 *
 * REGISTRO: mismo que ADI ([[adi-lenguaje-formal]] · [[adi-perfil-persona]]) — ejecutivo sencillo, una idea por
 * frase, sin coloquialismos. Este archivo está en el barrido estático de `_registro_gate`. Y sin sobreafirmar:
 * ADI interpreta y enmarca la decisión ([[adi-contrato-de-respuesta]]), no decide por el usuario.
 */
import React, { useEffect, useState } from "react";
import { C } from "./theme.js";
import { HERO_CHIPS } from "./ChatADI.jsx";

// ── PERSISTENCIA · mismo patrón que el resto de la app (adi_hint_v1 · adi_mesa_cara_v1 · adi_watchlist_v1) ──
// DOS valores, no un booleano, porque son dos hechos distintos:
//   "vista" → la guía ya se mostró sola una vez. No vuelve a abrirse sola (owner: "primera visita se abre sola;
//             después, solo si la piden"). Se escribe AL CERRAR.
//   "nunca" → el usuario pidió explícitamente no volver a verla. Se escribe EN EL MOMENTO de marcar la casilla,
//             no al cerrar: si cierra la pestaña con la guía abierta, su decisión ya quedó guardada igual.
// Ambos suprimen la apertura automática; el botón del header abre siempre, con cualquiera de los dos puesto.
export const GUIA_KEY   = "adi_guia_v1";
export const GUIA_VISTA = "vista";
export const GUIA_NUNCA = "nunca";

export function leerGuiaMarca() {
  try { return typeof localStorage !== "undefined" ? localStorage.getItem(GUIA_KEY) : null; } catch { return null; }
}
export function marcarGuia(valor) {
  try { if (typeof localStorage !== "undefined") localStorage.setItem(GUIA_KEY, valor); } catch { /* sin storage → sesión */ }
}
/** ¿Se abre sola? Solo en la primera visita: sin marca guardada. */
export function guiaAbreSola() { return !leerGuiaMarca(); }

// ── LOS EJEMPLOS · derivados de HERO_CHIPS por texto exacto (ver invariante 1 arriba) ──
// Se eligen 3 de los 4 chips del hero. Queda afuera "¿Cuánto me queda después de gastos?" porque sin líneas de
// gasto declaradas abre el flujo guiado del P&L ("nombrame tus gastos") — respuesta legítima, pero como PRIMER
// turno de alguien que recién llega pide trabajo antes de mostrar valor. Los otros tres devuelven lectura con
// cifras de entrada. La bajada de cada uno describe lo que el motor DEVUELVE, sin prometer de más.
const _GLOSA = {
  "¿Cómo viene el P&L de mi negocio?":  "De la venta a la contribución, con las fugas nombradas.",
  "¿Qué clientes ceden más margen?":    "Las cuentas que quedan bajo tu benchmark, una por una.",
  "¿Dónde tengo capital inmovilizado?": "Dónde está el capital del inventario, bodega por bodega.",
};
export const GUIA_EJEMPLOS = Object.keys(_GLOSA)
  .map((q) => {
    const chip = HERO_CHIPS.find((c) => c.q === q);
    return chip ? { ...chip, glosa: _GLOSA[q] } : null;
  })
  .filter(Boolean);

const _PASOS = 3;

// ── piezas de estilo compartidas (inline · el proyecto no usa CSS modules) ──
const _eyebrow = { fontSize: 9.5, fontFamily: "'JetBrains Mono', ui-monospace, monospace", letterSpacing: "1.1px", textTransform: "uppercase", color: C.celeste, fontWeight: 600 };
const _titulo  = { fontSize: 16, fontWeight: 600, color: C.text, letterSpacing: "-0.01em", lineHeight: 1.35, marginTop: 7 };
const _bajada  = { fontSize: 12.5, color: C.textSub, lineHeight: 1.55, marginTop: 7 };

// PASO 1 · el ida y vuelta. Las dos direcciones son SIMÉTRICAS a propósito: el usuario tiene que ver que el
// puente se cruza en los dos sentidos, que es justo lo que no se deduce mirando la pantalla quieta.
function PasoQuienHaceQue() {
  const fila = (origen, destino, texto) => (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 12px", borderRadius: 9, background: "rgba(255,255,255,0.03)", border: `1px solid ${C.border}` }}>
      <span style={{ fontSize: 9.5, fontFamily: "'JetBrains Mono', ui-monospace, monospace", letterSpacing: "0.4px", color: C.celeste, fontWeight: 600, whiteSpace: "nowrap", flexShrink: 0, paddingTop: 1 }}>
        {origen} <span style={{ color: C.textMuted }}>→</span> {destino}
      </span>
      <span style={{ fontSize: 12, color: C.textSub, lineHeight: 1.5 }}>{texto}</span>
    </div>
  );
  return (
    <div data-testid="guia-paso" data-paso="1">
      <div style={_eyebrow}>Quién hace qué</div>
      <div style={_titulo}>Sentrix muestra el dato. ADI lo interpreta.</div>
      <div style={_bajada}>Sentrix demuestra de dónde sale cada cifra. ADI te dice qué hacer con ella.</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}>
        {fila("ADI", "SENTRIX", "Cuando ADI nombra una cuenta, Sentrix la pinta en el cuadro.")}
        {fila("SENTRIX", "ADI", "Cuando tocás una fila del cuadro, se la podés preguntar a ADI.")}
      </div>
    </div>
  );
}

// PASO 2 · los ejemplos. Clickear uno CIERRA la guía y ejecuta la pregunta: la explicación se convierte en el
// primer turno de la conversación, en vez de quedar como un folleto que hay que recordar.
function PasoQuePreguntar({ onEjecutar }) {
  return (
    <div data-testid="guia-paso" data-paso="2">
      <div style={_eyebrow}>Qué podés preguntar</div>
      <div style={_titulo}>Preguntale algo de tu negocio.</div>
      <div style={_bajada}>Estas tres las responde con los datos actuales. Tocá una y arrancamos.</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}>
        {GUIA_EJEMPLOS.map((ej, i) => (
          <button key={ej.q} data-testid={`guia-ejemplo-${i}`} onClick={() => onEjecutar(ej.spec, ej.q)}
            style={{ display: "flex", alignItems: "flex-start", gap: 9, width: "100%", padding: "11px 13px", borderRadius: 10, border: "1px solid rgba(47,184,218,0.35)", background: C.card, fontFamily: "'DM Sans', system-ui, sans-serif", textAlign: "left", cursor: "pointer", transition: "background 0.15s, border-color 0.15s" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = C.surfaceHover; e.currentTarget.style.borderColor = "rgba(47,184,218,0.6)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = C.card; e.currentTarget.style.borderColor = "rgba(47,184,218,0.35)"; }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.celeste, flexShrink: 0, marginTop: 6 }}/>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: C.text, lineHeight: 1.35 }}>{ej.q}</span>
              <span style={{ display: "block", fontSize: 11.5, color: C.textMuted, lineHeight: 1.45, marginTop: 3 }}>{ej.glosa}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// PASO 3 · la evidencia. Es el cierre honesto del producto: ADI no pide que le crean.
function PasoDondeEstaLaEvidencia() {
  const item = (n, texto) => (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
      <span style={{ width: 17, height: 17, borderRadius: "50%", flexShrink: 0, marginTop: 1, border: "1px solid rgba(47,184,218,0.5)", color: C.celeste, fontSize: 9.5, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}>{n}</span>
      <span style={{ fontSize: 12.5, color: C.textSub, lineHeight: 1.55 }}>{texto}</span>
    </div>
  );
  return (
    <div data-testid="guia-paso" data-paso="3">
      <div style={_eyebrow}>Dónde está la evidencia</div>
      <div style={_titulo}>Cada cifra cierra con su cuenta.</div>
      <div style={_bajada}>ADI no te pide que le creas. Todo lo que afirma se puede abrir y revisar.</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 11, marginTop: 14 }}>
        {item("1", <>Debajo de cada respuesta aparece un botón que abre <b style={{ color: C.text, fontWeight: 600 }}>Sentrix</b> con la evidencia de esa respuesta.</>)}
        {item("2", <>En el cuadro, tocá una fila y se abre su <b style={{ color: C.text, fontWeight: 600 }}>Ficha</b>: ahí vive el detalle de esa entidad.</>)}
        {item("3", <>El botón <b style={{ color: C.text, fontWeight: 600 }}>Mesa de control</b>, arriba, abre todas tus cifras a la vez.</>)}
      </div>
    </div>
  );
}

/**
 * La guía. NO bloquea: sin overlay opaco detrás, la app sigue viva y clickeable.
 *   onEjecutar(spec, label) → ejecuta un ejemplo (el llamador cierra la guía y dispara la pregunta)
 *   onCerrar()              → saltar / cerrar / terminar
 */
export function GuiaInicio({ onEjecutar, onCerrar }) {
  const [paso, setPaso]   = useState(0);
  const [nunca, setNunca] = useState(() => leerGuiaMarca() === GUIA_NUNCA);

  // CERRAR es siempre el mismo hecho, venga del ✕, de "Saltar", de "Empezar", de Escape o de tocar un ejemplo:
  // la guía ya se mostró → no vuelve a abrirse sola. Si el usuario marcó "no volver a mostrar", esa marca es más
  // fuerte y no se pisa.
  const cerrar = () => {
    if (leerGuiaMarca() !== GUIA_NUNCA) marcarGuia(GUIA_VISTA);
    if (onCerrar) onCerrar();
  };

  // Escape cierra · un panel que no se puede sacar de encima con el teclado es un panel que bloquea.
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") cerrar(); };
    if (typeof window !== "undefined") window.addEventListener("keydown", onKey);
    return () => { if (typeof window !== "undefined") window.removeEventListener("keydown", onKey); };
  }, []);

  const ultimo = paso === _PASOS - 1;
  const avanzar = () => { if (ultimo) cerrar(); else setPaso((p) => p + 1); };
  const ejecutar = (spec, label) => { cerrar(); if (onEjecutar) onEjecutar(spec, label); };

  // la casilla persiste EN EL ACTO (ver la nota de los dos valores arriba)
  const toggleNunca = () => {
    const v = !nunca;
    setNunca(v);
    marcarGuia(v ? GUIA_NUNCA : GUIA_VISTA);
  };

  return (
    <aside className="adi-guia" data-testid="guia-inicio" role="dialog" aria-modal="false" aria-label="Guía de inicio">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "12px 16px", borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, minWidth: 0 }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: C.text, whiteSpace: "nowrap" }}>¿Cómo funciona?</span>
          <span style={{ fontSize: 10, color: C.textMuted, fontFamily: "'JetBrains Mono', ui-monospace, monospace", letterSpacing: "0.5px" }}>{paso + 1} / {_PASOS}</span>
        </div>
        <button data-testid="guia-cerrar" onClick={cerrar} aria-label="Cerrar la guía" title="Cerrar la guía"
          style={{ background: "transparent", border: "none", color: C.textMuted, cursor: "pointer", fontSize: 14, lineHeight: 1, padding: 4, flexShrink: 0 }}
          onMouseEnter={(e) => { e.currentTarget.style.color = C.text; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = C.textMuted; }}>✕</button>
      </div>

      <div className="adi-guia-cuerpo" style={{ padding: "16px", overflowY: "auto", minHeight: 0 }}>
        {paso === 0 && <PasoQuienHaceQue/>}
        {paso === 1 && <PasoQuePreguntar onEjecutar={ejecutar}/>}
        {paso === 2 && <PasoDondeEstaLaEvidencia/>}
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "11px 16px", borderTop: `1px solid ${C.border}`, flexWrap: "wrap" }}>
        <label style={{ display: "flex", alignItems: "center", gap: 7, cursor: "pointer", userSelect: "none" }}>
          <input type="checkbox" data-testid="guia-nunca" checked={nunca} onChange={toggleNunca}
            style={{ width: 13, height: 13, accentColor: C.celeste, cursor: "pointer", margin: 0 }}/>
          <span style={{ fontSize: 11, color: C.textMuted }}>No volver a mostrar</span>
        </label>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          {/* SALTAR en TODOS los pasos (owner: "un panel que se puede saltar en cualquier paso") */}
          <button data-testid="guia-saltar" onClick={cerrar}
            style={{ background: "transparent", border: "none", color: C.textMuted, fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 12, cursor: "pointer", padding: "7px 9px" }}
            onMouseEnter={(e) => { e.currentTarget.style.color = C.textSub; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = C.textMuted; }}>Saltar</button>
          <button data-testid="guia-siguiente" onClick={avanzar}
            style={{ border: "none", borderRadius: 9, padding: "7px 15px", background: C.celeste, color: "#ffffff", fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "background 0.15s", whiteSpace: "nowrap" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "#28a9c9"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = C.celeste; }}>{ultimo ? "Empezar" : "Siguiente"}</button>
        </div>
      </div>

      <style>{`
        .adi-guia {
          position: fixed; right: 24px; bottom: 24px; z-index: 70;
          width: 400px; max-height: 78vh;
          display: flex; flex-direction: column;
          background: ${C.surface}; border: 1px solid rgba(47,184,218,0.4); border-radius: 14px;
          box-shadow: 0 18px 48px -12px rgba(0,0,0,0.75), 0 0 0 1px rgba(0,0,0,0.35);
          font-family: 'DM Sans', system-ui, sans-serif;
          animation: adiGuiaEntra 0.22s ease-out;
        }
        @keyframes adiGuiaEntra { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        /* MÓVIL · hoja inferior a ancho completo (una tarjeta de 400px no entra en un viewport de 375) */
        @media (max-width: 760px) {
          .adi-guia { right: 10px; left: 10px; bottom: 10px; width: auto; max-height: 82vh; }
        }
        @media (prefers-reduced-motion: reduce) { .adi-guia { animation: none; } }
      `}</style>
    </aside>
  );
}

export default GuiaInicio;
