/* === src/ui/PanelNegocio.jsx · «TU NEGOCIO» — LO QUE ADI SABE DE TI, VISIBLE Y EDITABLE ================
 *
 * EL GO DEL OWNER (2026-09-08), textual: «Sí, construirlo como Pro. Me gusta el concepto "Tu negocio":
 * contexto visible, criterios y diario en un solo lugar.»
 *
 * TRES CAJONES, UNA PANTALLA — y solo el primero es nuevo:
 *   1. TU CONTEXTO (nuevo) · el negocio en tus palabras, editable acá. Orienta la lectura de ADI, jamás sus
 *      cifras — esa frontera vive en el notario y en el marco con que viaja al cerebro, no en esta vista.
 *   2. TUS CRITERIOS (ya existía) · los números que declaraste por chat («mi margen mínimo es 25%»).
 *   3. LO QUE LE HAS RESPONDIDO (ya existía — el diario) · tu tesis y tus declaraciones, con fecha y cita.
 *
 * NADA DE MEMORIA SECRETA: esta pantalla es la respuesta al gris del diario que quedó abierto en septiembre —
 * el usuario ve TODO lo que ADI recuerda de él, y cómo borrarlo. Los cajones 2 y 3 se editan por el chat
 * («recuerda que…», «olvida…») y la vista lo dice: dos escritores para el mismo dato serían dos verdades.
 *
 * CERO CÁLCULO ACÁ (regla 3): esta vista pinta lo que los módulos ya tienen. El guardado va por la puerta de
 * siempre (`op: "contexto"`) con la sesión firmada; sin plan pro el SERVIDOR rechaza y acá se declara.
 */
import React, { useEffect, useMemo, useState } from "react";
import { C } from "./theme.js";
import { getTenantData, actualizarContextoDelPack } from "../data/tenantStore.js";
import { activeCriteria, CRITERIA } from "../adi/criteria.js";
import { getAccessCode } from "../adi/accessClient.js";

const SANS = "'DM Sans', system-ui, sans-serif";
const MONO = "'JetBrains Mono', ui-monospace, monospace";
const TOPE = 2000;


function Cajon({ titulo, nota, children }) {
  return (
    <section style={{ marginBottom: 18 }}>
      <div style={{ fontFamily: SANS, fontSize: 11, fontWeight: 700, color: C.textSub, letterSpacing: "0.05em",
        textTransform: "uppercase", marginBottom: 6 }}>{titulo}</div>
      {children}
      {nota && <div style={{ fontFamily: SANS, fontSize: 10.5, lineHeight: 1.45, color: C.textMuted, marginTop: 6 }}>{nota}</div>}
    </section>
  );
}

export function PanelNegocio({ abierto, onCerrar }) {
  const [texto, setTexto] = useState("");
  const [guardadoComo, setGuardadoComo] = useState("");   // lo último confirmado por el servidor
  const [estado, setEstado] = useState("");               // "" · guardando · guardado · <motivo>
  const pack = abierto ? getTenantData() : null;

  useEffect(() => {
    if (!abierto) return;
    const c = (pack && pack.perfil && pack.perfil.contexto) || {};
    setTexto(c.texto || ""); setGuardadoComo(c.texto || ""); setEstado("");
  }, [abierto]);   // eslint-disable-line react-hooks/exhaustive-deps

  const criterios = useMemo(() => (abierto ? Object.entries(activeCriteria() || {}) : []), [abierto]);
  const diario = (pack && pack.perfil && pack.perfil.diario) || {};

  if (!abierto) return null;

  const guardar = async () => {
    setEstado("guardando");
    try {
      const r = await fetch("/api/adi-ingesta", { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ op: "contexto", contexto: { texto }, access: getAccessCode() }) });
      const d = await r.json();
      if (d && d.ok) {
        actualizarContextoDelPack(d.contexto);   // el pack en memoria, al día con lo confirmado — el patrón del diario
        setGuardadoComo((d.contexto && d.contexto.texto) || "");
        setEstado("guardado");
        return;
      }
      /* la razón en lenguaje de negocio, jamás el error crudo (la lección del panel de historial) */
      console.warn("[ADI] el contexto no se guardó:", d && d.motivo);
      setEstado(/plan pro/i.test(String(d && d.motivo)) ? "Esta función es del plan Pro."
        : /sin sesión/i.test(String(d && d.motivo)) ? "El contexto se guarda por empresa — entra con tu código de acceso."
        : /supera el tope|tamaño/i.test(String(d && d.motivo)) ? `Supera el tope de ${TOPE} caracteres — recórtalo: ADI necesita el criterio, no el detalle.`
        : "No se pudo guardar — vuelve a intentar en un momento.");
    } catch (e) { console.warn("[ADI] el contexto no se guardó:", e && e.message); setEstado("No se pudo guardar — vuelve a intentar en un momento."); }
  };

  return (
    <aside aria-label="Tu negocio: lo que ADI sabe de ti" data-testid="negocio-panel"
      style={{ width: 340, flex: "none", display: "flex", flexDirection: "column", minHeight: 0,
        borderRight: `1px solid ${C.border}`, background: "rgba(0,0,0,0.22)", overflowY: "auto", padding: "12px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <span style={{ fontFamily: SANS, fontSize: 12.5, fontWeight: 700, color: C.text }}>Tu negocio</span>
        <button onClick={onCerrar} aria-label="Cerrar" title="Cerrar"
          style={{ background: "transparent", border: "none", color: C.textMuted, cursor: "pointer", font: "inherit", fontSize: 15, padding: "2px 6px" }}>×</button>
      </div>
      <div style={{ fontFamily: SANS, fontSize: 11, lineHeight: 1.5, color: C.textMuted, marginBottom: 14 }}>
        Todo lo que ADI sabe de tu negocio, en un lugar. Nada de esto cambia tus cifras — cambia cómo ADI las lee.
      </div>

      <Cajon titulo="Tu contexto, en tus palabras"
        nota="ADI lo usará citándolo — «según lo que me declaraste» — y nunca como fuente de cifras. Cada edición queda auditada.">
        <textarea value={texto} onChange={(e) => { setTexto(e.target.value.slice(0, TOPE)); setEstado(""); }}
          data-testid="negocio-contexto" rows={7}
          placeholder={"Ej.: Somos distribuidores B2B. El volumen en las cuentas grandes es criterio estratégico de ventas —da rotación y liquidez—, no lo cuentes como fuga. Este año me importa la caja más que el margen."}
          style={{ width: "100%", boxSizing: "border-box", resize: "vertical", fontFamily: SANS, fontSize: 12.5,
            lineHeight: 1.5, color: C.text, background: "rgba(255,255,255,0.04)", border: `1px solid ${C.border}`,
            borderRadius: 9, padding: "9px 11px" }}/>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 6 }}>
          <span style={{ fontFamily: MONO, fontSize: 10, color: C.textMuted }}>{texto.length}/{TOPE}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {estado && <span style={{ fontFamily: SANS, fontSize: 10.5, color: estado === "guardado" ? C.celeste : C.textMuted }}>
              {estado === "guardando" ? "Guardando…" : estado === "guardado" ? "Guardado" : estado}</span>}
            <button onClick={guardar} disabled={estado === "guardando" || texto === guardadoComo}
              data-testid="negocio-guardar"
              style={{ fontFamily: SANS, fontSize: 11.5, fontWeight: 600, color: texto === guardadoComo ? C.textMuted : C.text,
                background: "rgba(255,255,255,0.05)", border: `1px solid ${C.border}`, borderRadius: 8,
                padding: "5px 12px", cursor: texto === guardadoComo ? "default" : "pointer" }}>
              Guardar
            </button>
          </div>
        </div>
      </Cajon>

      <Cajon titulo="Tus criterios"
        nota="Se declaran por el chat: «recuerda que mi margen mínimo es 25%» — y se borran igual: «olvida mi margen mínimo».">
        {criterios.length === 0
          ? <div style={{ fontFamily: SANS, fontSize: 11.5, color: C.textMuted }}>Todavía no has declarado criterios.</div>
          : criterios.map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontFamily: SANS,
              fontSize: 12, color: C.text, padding: "4px 0", borderBottom: `1px solid ${C.border}` }}>
              <span style={{ color: C.textSub }}>{(CRITERIA[k] && CRITERIA[k].label) || k}</span>
              <span style={{ fontFamily: MONO, fontSize: 11.5 }}>{String(v)}</span>
            </div>))}
      </Cajon>

      <Cajon titulo="Lo que le has respondido"
        nota="Es el diario de la relación: tu palabra, citada con su fecha. Se borra por el chat: «olvida todo lo que guardaste».">
        {(!diario.tesis && !(Array.isArray(diario.intenciones) && diario.intenciones.length))
          ? <div style={{ fontFamily: SANS, fontSize: 11.5, color: C.textMuted }}>Todavía no hay nada guardado — aparece cuando ADI te pregunte algo y le respondas.</div>
          : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {diario.tesis && (
                <div style={{ fontFamily: SANS, fontSize: 11.5, lineHeight: 1.5, color: C.text }}>
                  <span style={{ color: C.textMuted }}>Su lectura vigente{diario.tesis.fecha ? ` (${diario.tesis.fecha})` : ""}: </span>
                  {diario.tesis.resumen || diario.tesis.clave}
                </div>
              )}
              {(diario.intenciones || []).map((x, i) => (
                <div key={i} style={{ fontFamily: SANS, fontSize: 11.5, lineHeight: 1.5, color: C.text }}>
                  <span style={{ color: C.textMuted }}>{(x.entidades || []).join(", ") || "—"}{x.fecha ? ` (${x.fecha})` : ""}: </span>
                  «{x.cita}»
                </div>
              ))}
            </div>
          )}
      </Cajon>
    </aside>
  );
}

export default PanelNegocio;
