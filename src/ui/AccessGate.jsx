/* === src/ui/AccessGate.jsx · DEMO PRIVADA · pantalla de acceso + panel admin (owner 2026-07-08) ===
 * La puerta del producto cuando ADI_TOKEN_SECRET está seteado en el server:
 *   · AccessGate  — el invitado pega su código (3 días) · valida contra /api/adi-access (server = la verdad)
 *                   · sin código → botones "Solicitar demo" (email/WhatsApp del owner, config en demoAccess.js)
 *   · AdminAccess — #admin · el owner emite códigos (nombre + días) con su ADI_ADMIN_KEY · copiar/compartir
 * El piso determinístico corre en el cliente, pero la UI completa queda detrás de la puerta; el LLM además
 * se niega server-side sin código vigente (la protección real de la key). Voz del producto: honesta, sin jerga. */
import React, { useState } from "react";
import { C } from "./theme.js";
import { DEMO_CONTACT } from "../config/demoAccess.js";
import { setAccessCode } from "../adi/accessClient.js";

const MONO = "'JetBrains Mono', ui-monospace, monospace";

const _fecha = (ms) => { try { return new Date(ms).toLocaleDateString("es-CL", { day: "numeric", month: "long" }); } catch { return ""; } };

function LogoMark() {
  return (
    <div style={{ width:44, height:44, borderRadius:11, display:"flex", alignItems:"center", justifyContent:"center", background:"linear-gradient(135deg, rgba(255,255,255,0.07), rgba(255,255,255,0.02))", border:"1px solid rgba(255,255,255,0.12)", boxShadow:"inset 0 1px 0 rgba(255,255,255,0.06), 0 4px 12px -3px rgba(0,0,0,0.4)" }}>
      <svg width="27" height="27" viewBox="0 0 200 200" fill="none" stroke="#cfd5db" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="100,15 173.6,57.5 173.6,142.5 100,185 26.4,142.5 26.4,57.5" strokeWidth="3.2"/>
        <circle cx="100" cy="100" r="55" strokeWidth="1.7" opacity="0.65"/>
        <ellipse cx="100" cy="100" rx="55" ry="22" strokeWidth="1.5" opacity="0.5"/>
        <ellipse cx="100" cy="100" rx="22" ry="55" strokeWidth="1.5" opacity="0.5"/>
        <circle cx="100" cy="100" r="6" fill="#2fb8da" stroke="none"/>
      </svg>
    </div>
  );
}

function Shell({ children }) {
  return (
    <div style={{ height:"100vh", background:C.bg, color:C.text, fontFamily:"'DM Sans','Segoe UI',sans-serif", display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
      <div style={{ width:"100%", maxWidth:440 }}>{children}</div>
    </div>
  );
}

// ── la puerta del invitado ──────────────────────────────────────────────────────────────────────────────────────
export function AccessGate({ onGranted, reason = null, expiresAt = null }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(reason);   // "invalid" | "expired" | "network" | null

  const entrar = async () => {
    const c = code.trim();
    if (!c || busy) return;
    setBusy(true); setErr(null);
    try {
      const res = await fetch("/api/adi-access", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ op: "check", access: c }) });
      const d = await res.json();
      if (d && d.ok) { setAccessCode(c); onGranted({ name: d.name || "invitado", expiresAt: d.expiresAt || null }); }
      else setErr((d && d.reason) || "invalid");
    } catch { setErr("network"); }
    setBusy(false);
  };

  const mailBody = encodeURIComponent(`Hola, quiero probar la demo de ADI · Sentrix (${DEMO_CONTACT.demoDays} días).\n\nNombre:\nEmpresa:\nRol:`);
  const mailHref = `mailto:${DEMO_CONTACT.email}?subject=${encodeURIComponent("Solicitud demo ADI · Sentrix")}&body=${mailBody}`;
  const waHref = DEMO_CONTACT.whatsapp ? `https://wa.me/${DEMO_CONTACT.whatsapp}?text=${encodeURIComponent("Hola, quiero probar la demo de ADI · Sentrix")}` : null;

  const msgs = {
    invalid: "Ese código no abre — revisá que esté completo (empieza con ADI-) o pedí uno nuevo.",
    expired: `Tu demo venció${expiresAt ? ` el ${_fecha(expiresAt)}` : ""}. Pedí una extensión y te mandamos un código nuevo.`,
    network: "No pude validar el código (sin conexión con el servidor). Probá de nuevo en un momento.",
  };

  return (
    <Shell>
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:26 }}>
        <LogoMark/>
        <div>
          <div style={{ display:"flex", alignItems:"baseline", gap:7 }}>
            <span style={{ fontWeight:700, fontSize:17, letterSpacing:"-0.3px" }}>ADI</span>
            <span style={{ fontWeight:500, fontSize:11, color:C.textMuted, fontFamily:MONO, letterSpacing:"1.2px", textTransform:"uppercase" }}>Sentrix</span>
          </div>
          <div style={{ fontFamily:MONO, fontSize:9.5, letterSpacing:"1px", color:C.celeste, textTransform:"uppercase", marginTop:2 }}>Demo privada</div>
        </div>
      </div>

      <div style={{ fontSize:21, fontWeight:600, lineHeight:1.3, marginBottom:8, letterSpacing:"-0.3px" }}>Tu asesor digital te está esperando.</div>
      <div style={{ fontSize:13, color:C.textSub, lineHeight:1.55, marginBottom:22 }}>
        El acceso es con código personal — {DEMO_CONTACT.demoDays} días completos, con todo habilitado. ADI no inventa: cada cifra cierra con su cuenta.
      </div>

      <div style={{ border:`1px solid ${C.border}`, borderLeft:"2px solid rgba(47,184,218,0.6)", borderRight:"2px solid rgba(47,184,218,0.6)", borderRadius:12, background:C.surface, padding:"16px 16px 14px" }}>
        <label style={{ display:"block", fontFamily:MONO, fontSize:9.5, letterSpacing:"0.8px", color:C.textMuted, textTransform:"uppercase", marginBottom:7 }}>Tu código de acceso</label>
        <div style={{ display:"flex", gap:8 }}>
          <input value={code} onChange={(e) => { setCode(e.target.value); setErr(null); }} onKeyDown={(e) => e.key === "Enter" && entrar()}
            placeholder="ADI-…" spellCheck={false} autoFocus
            style={{ flex:1, minWidth:0, padding:"10px 12px", borderRadius:9, border:`1px solid ${err ? "rgba(244,63,94,0.5)" : C.borderLight}`, background:C.bg, color:C.text, fontFamily:MONO, fontSize:12.5, outline:"none" }}/>
          <button onClick={entrar} disabled={busy || !code.trim()}
            style={{ padding:"10px 18px", borderRadius:9, border:"1px solid rgba(47,184,218,0.5)", background: busy ? "rgba(47,184,218,0.06)" : "rgba(47,184,218,0.12)", color:C.celeste, fontSize:13, fontWeight:600, cursor: busy || !code.trim() ? "default" : "pointer", fontFamily:"'DM Sans', system-ui, sans-serif", whiteSpace:"nowrap", opacity: code.trim() ? 1 : 0.55 }}>
            {busy ? "Validando…" : "Entrar →"}
          </button>
        </div>
        {err && <div style={{ marginTop:9, fontSize:11.5, color:C.red, lineHeight:1.45 }}>{msgs[err] || msgs.invalid}</div>}
      </div>

      <div style={{ marginTop:22, paddingTop:16, borderTop:`1px solid ${C.border}` }}>
        <div style={{ fontSize:12.5, color:C.textSub, marginBottom:10 }}>¿Sin código? Solicitá tu demo de {DEMO_CONTACT.demoDays} días:</div>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          <a href={mailHref} style={{ display:"inline-flex", alignItems:"center", gap:7, padding:"8px 14px", borderRadius:9, border:`1px solid ${C.borderLight}`, background:C.surface, color:C.textSub, fontSize:12, fontWeight:600, textDecoration:"none" }}>
            ✉ Por email
          </a>
          {waHref && (
            <a href={waHref} target="_blank" rel="noreferrer" style={{ display:"inline-flex", alignItems:"center", gap:7, padding:"8px 14px", borderRadius:9, border:`1px solid ${C.borderLight}`, background:C.surface, color:C.textSub, fontSize:12, fontWeight:600, textDecoration:"none" }}>
            ◦ Por WhatsApp
            </a>
          )}
        </div>
        <div style={{ marginTop:14, fontSize:10.5, color:C.textMuted, lineHeight:1.5 }}>
          Respondemos con tu código el mismo día. Datos de demostración — tu información no se usa para nada más.
        </div>
      </div>
    </Shell>
  );
}

// ── #admin · el owner emite códigos (requiere ADI_ADMIN_KEY del server) ─────────────────────────────────────────
export function AdminAccess() {
  const [adminKey, setAdminKey] = useState(() => { try { return sessionStorage.getItem("adi_admin_key") || ""; } catch { return ""; } });
  const [name, setName] = useState("");
  const [days, setDays] = useState(String(DEMO_CONTACT.demoDays));
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState(null);    // { code, name, expiresAt } | { error }
  const [hist, setHist] = useState([]);

  const emitir = async () => {
    if (busy || !adminKey.trim() || !name.trim()) return;
    setBusy(true); setOut(null);
    try { sessionStorage.setItem("adi_admin_key", adminKey.trim()); } catch { /* opcional */ }
    try {
      const res = await fetch("/api/adi-access", { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ op: "mint", adminKey: adminKey.trim(), name: name.trim(), hours: (Number(days) || DEMO_CONTACT.demoDays) * 24 }) });
      const d = await res.json();
      if (d && d.ok) { setOut(d); setHist((h) => [d, ...h].slice(0, 12)); setName(""); }
      else setOut({ error: (d && d.error) || "no se pudo emitir" });
    } catch { setOut({ error: "sin conexión con el servidor" }); }
    setBusy(false);
  };

  const shareText = (o) => `Hola ${o.name}! Acá va tu acceso a la demo de ADI · Sentrix (${DEMO_CONTACT.demoDays} días, vence el ${_fecha(o.expiresAt)}):\n\n${window.location.origin}\n\nTu código:\n${o.code}\n\nPegalo en la pantalla de entrada y listo.`;
  const copiar = (t) => { try { navigator.clipboard.writeText(t); } catch { /* selección manual */ } };

  const inp = { width:"100%", padding:"9px 11px", borderRadius:8, border:`1px solid ${C.borderLight}`, background:C.bg, color:C.text, fontFamily:MONO, fontSize:12, outline:"none", boxSizing:"border-box" };
  const lbl = { display:"block", fontFamily:MONO, fontSize:9, letterSpacing:"0.8px", color:C.textMuted, textTransform:"uppercase", marginBottom:5 };

  return (
    <Shell>
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20 }}>
        <LogoMark/>
        <div>
          <div style={{ fontWeight:700, fontSize:16 }}>Códigos de acceso</div>
          <div style={{ fontFamily:MONO, fontSize:9.5, letterSpacing:"1px", color:C.celeste, textTransform:"uppercase" }}>Admin · demo privada</div>
        </div>
      </div>
      <div style={{ border:`1px solid ${C.border}`, borderRadius:12, background:C.surface, padding:16, display:"flex", flexDirection:"column", gap:12 }}>
        <div><label style={lbl}>Tu clave de admin (ADI_ADMIN_KEY)</label><input type="password" value={adminKey} onChange={(e) => setAdminKey(e.target.value)} style={inp} spellCheck={false}/></div>
        <div style={{ display:"flex", gap:10 }}>
          <div style={{ flex:1 }}><label style={lbl}>Para quién (nombre o empresa)</label><input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && emitir()} style={inp} placeholder="Juan · Empresa X"/></div>
          <div style={{ width:86 }}><label style={lbl}>Días</label><input value={days} onChange={(e) => setDays(e.target.value.replace(/[^0-9]/g, ""))} style={inp}/></div>
        </div>
        <button onClick={emitir} disabled={busy || !adminKey.trim() || !name.trim()}
          style={{ padding:"10px 16px", borderRadius:9, border:"1px solid rgba(47,184,218,0.5)", background:"rgba(47,184,218,0.12)", color:C.celeste, fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"'DM Sans', system-ui, sans-serif", opacity: adminKey.trim() && name.trim() ? 1 : 0.55 }}>
          {busy ? "Emitiendo…" : "Emitir código →"}
        </button>
        {out && out.error && <div style={{ fontSize:11.5, color:C.red }}>{out.error}</div>}
        {out && out.code && (
          <div style={{ border:`1px solid rgba(47,184,218,0.35)`, borderRadius:10, background:"rgba(47,184,218,0.05)", padding:12 }}>
            <div style={{ fontSize:11.5, color:C.textSub, marginBottom:6 }}><b style={{ color:C.text }}>{out.name}</b> · vence el {_fecha(out.expiresAt)}</div>
            <div style={{ fontFamily:MONO, fontSize:11, color:C.celeste, wordBreak:"break-all", lineHeight:1.5, marginBottom:9 }}>{out.code}</div>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
              <button onClick={() => copiar(out.code)} style={{ padding:"6px 12px", borderRadius:8, border:`1px solid ${C.borderLight}`, background:"transparent", color:C.textSub, fontSize:11.5, fontWeight:600, cursor:"pointer" }}>Copiar código</button>
              <button onClick={() => copiar(shareText(out))} style={{ padding:"6px 12px", borderRadius:8, border:`1px solid ${C.borderLight}`, background:"transparent", color:C.textSub, fontSize:11.5, fontWeight:600, cursor:"pointer" }}>Copiar mensaje de invitación</button>
            </div>
          </div>
        )}
        {hist.length > 1 && (
          <div style={{ fontSize:10.5, color:C.textMuted, lineHeight:1.6 }}>
            Emitidos en esta sesión: {hist.map((h) => `${h.name} (${_fecha(h.expiresAt)})`).join(" · ")}
          </div>
        )}
      </div>
      <div style={{ marginTop:12, fontSize:10.5, color:C.textMuted, lineHeight:1.5 }}>
        El código corre desde que lo emitís. Esta página no guarda nada en el servidor — el código lleva su vencimiento firmado adentro.
      </div>
    </Shell>
  );
}
