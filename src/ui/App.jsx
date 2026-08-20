/* === src/ui/App.jsx · ADISentric (shell mínimo) ===
 * Raíz de la app. Por ahora: header (logo + LIVE + escenario) + ChatADI corriendo como app real.
 * SIN panel de datos / módulos todavía (entran en el próximo paso de Fase 5).
 * Estado UI mínimo: escenario. La UI no calcula nada · el chat consume answerADI. */
import React, { useState, useRef, useEffect, Suspense } from "react";
import { C } from "./theme.js";
/* ⚠️ `ScenarioSelector` SE QUEDÓ SIN LUGAR EN LA PANTALLA (2026-08-20, al reemplazar el header por la barra
 * lateral). No se borró nada: el componente sigue en `ScenarioSelector.jsx` y el eje `scenario` sigue vivo en el
 * motor. Lo que desapareció es su único punto de montaje, que era el header blanco. En la práctica no cambia lo
 * que se ve: `ADI_SCENARIO_SWITCHER_ENABLED` está APAGADO en todos los perfiles por decisión del owner del
 * 2026-08-07, así que hace meses que nadie lo veía. Queda anotado porque volver a encenderlo ahora pide, además
 * del flag, decidir dónde vive dentro de la barra — una barrita no puede colapsar un selector de tres estados. */
import { BarraLateral } from "./BarraLateral.jsx";   // la barra de barritas del borde derecho · reemplaza al header blanco (owner 2026-08-20)
import { ChatADI } from "./ChatADI.jsx";
// Etapa 5 · Sentrix · panel de evidencia (se abre con la lectura). MEJORA 9 (2026-07-26): LAZY — el panel es la
// pieza más pesada de la UI y no hace falta para el primer paint del chat; se parte del bundle principal y se
// PREFETCHEA en idle apenas monta la app (ver useEffect abajo) → cuando el usuario abre la Mesa ya está cargado.
const SentrixPanel = React.lazy(() => import("./SentrixPanel.jsx"));
import { GuiaInicio, guiaAbreSola } from "./GuiaInicio.jsx";   // guía de inicio (owner 2026-08-07) · la división del trabajo ADI/Sentrix, no un tour de features
import { AccessGate, AdminAccess } from "./AccessGate.jsx";   // demo privada · puerta + emisión de códigos (owner 2026-07-08)
import { getAccessCode, clearAccessCode } from "../adi/accessClient.js";
import { ADI_LLM_ENABLED } from "../config/voiceFlags.js";
import { ESCENARIO_INICIAL } from "../config/scenarios.js";   // el escenario inicial se DECLARA una vez (ver el comentario allá): la app y la consola del examen tienen que arrancar en el mismo   // Paso 5 · badge de modo + selector de escenarios (dev)
import { initCriteria } from "../adi/criteria.js";   // C.2 · memoria de criterio · re-aplica lo persistido (localStorage) al boot
import { initPnl } from "../adi/pnl.js";   // P&L COMERCIAL (owner 2026-07-15) · re-aplica las líneas de gasto declaradas al boot
import { parseAddress, evidenceForAddress } from "../adi/sentrix/address.js";   // dirección canónica ADI↔Sentrix (owner 2026-08-09) · el CTA de una respuesta abre vista+sección+entidad+filtro exactos

initCriteria();   // ANTES del primer render: el hero/resumen ya miden contra la vara del owner si hay criterios guardados
initPnl();        // ídem: la cara Resultado de la Mesa ya arranca con el P&L declarado del owner (localStorage)

// MEJORA 9 · skeleton del panel (percepción sin saltos): bloques que respiran mientras el chunk lazy de
// SentrixPanel termina de bajar — con el prefetch en idle esto casi nunca se ve, pero si se ve, la Mesa
// aparece como estructura estable en vez de un hueco en blanco. Sin texto: nada que prometa contenido.
function PanelSkeleton() {
  const blk = (h, w) => (
    <div style={{ height: h, width: w, borderRadius: 8, background: "rgba(255,255,255,0.05)", animation: "auroraBreathe 1.6s ease-in-out infinite" }}/>
  );
  return (
    <div style={{ height: "100%", background: C.bg, borderLeft: `1px solid ${C.border}`, padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
      {blk(28, "55%")}
      <div style={{ display: "flex", gap: 10 }}>{blk(64, "33%")}{blk(64, "33%")}{blk(64, "33%")}</div>
      {blk(120, "100%")}
      {blk(88, "100%")}
      {blk(88, "100%")}
    </div>
  );
}

const getCurrentDateString = () => {
  const now = new Date();
  const day   = String(now.getDate()).padStart(2, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const year  = now.getFullYear();
  return `${day}-${month}-${year}`;
};

export default function App({ animate = true }) {
  const [scenario, setScenario] = useState(ESCENARIO_INICIAL);
  // ── DEMO PRIVADA (owner 2026-07-08): con ADI_TOKEN_SECRET en el server la app pide código de 3 días. Sin secret
  // (dev/backcompat) el status dice required:false y no cambia nada. El server es LA verdad (el cliente solo pregunta).
  const [access, setAccess] = useState({ checked: false, required: false, granted: null, reason: null, expiresAt: null });
  // MOBILE (owner 2026-07-08: "la primera impresión desde el celular"): en pantallas chicas el panel Sentrix
  // pasa de columna lateral a OVERLAY a pantalla completa (460px fijos no entran en un viewport de 375).
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 760px)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 760px)");
    const on = (e) => setIsMobile(e.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  // MEJORA 9 · prefetch del panel en idle: el chunk lazy de SentrixPanel se baja en segundo plano apenas la app
  // pinta — al abrir la Mesa el panel ya está en memoria (el skeleton de Suspense solo se vería en el caso raro
  // de un click antes de que termine la descarga).
  useEffect(() => { import("./SentrixPanel.jsx").catch(() => {}); }, []);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/adi-access", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ op: "check", access: getAccessCode() }) });
        const d = await res.json();
        if (!alive) return;
        if (!d || d.required === false) setAccess({ checked: true, required: false, granted: null, reason: null, expiresAt: null });
        else if (d.ok) setAccess({ checked: true, required: true, granted: { name: d.name, expiresAt: d.expiresAt }, reason: null, expiresAt: d.expiresAt });
        else { const had = !!getAccessCode(); clearAccessCode(); setAccess({ checked: true, required: true, granted: null, reason: had ? d.reason : null, expiresAt: d.expiresAt || null }); }
      } catch { if (alive) setAccess({ checked: true, required: false, granted: null, reason: null, expiresAt: null }); }   // gateway caído → no bloquear el piso
    })();
    const onDenied = (ev) => { clearAccessCode(); setAccess({ checked: true, required: true, granted: null, reason: (ev && ev.detail) || "expired", expiresAt: null }); };
    window.addEventListener("adi-access-denied", onDenied);
    return () => { alive = false; window.removeEventListener("adi-access-denied", onDenied); };
  }, []);
  // Etapa 5 · Sentrix · estado del panel de evidencia (la "mesa de trabajo" estilo Code, a la derecha).
  const [openEv, setOpenEv]   = useState(null);   // la boleta abierta (con reading{}) · null = panel cerrado
  const [openId, setOpenId]   = useState(null);   // id del mensaje cuya evidencia está abierta (highlight del botón)
  /* LA MESA ABRE SIEMPRE AL 50/50 (owner 2026-08-20). Antes abría en 460 px fijos, y ahí empezaba el problema
   * que el propio owner cazó al recorrerla: las dos tablas de la cara Comercial piden entre 620 y 640 px, así
   * que un tercio de las columnas nacía fuera de la vista y había que arrastrar antes de poder leer nada.
   * Medio y medio es el reparto honesto entre la conversación y el dato — «el usuario verá cuál agranda más
   * después, o la deja así». Sigue siendo arrastrable y el botón de agrandar sigue llevándola al 72%. */
  const [panelW, setPanelW]   = useState(() => (typeof window !== "undefined" ? Math.round(window.innerWidth / 2) : 460));
  const [maxed, setMaxed]     = useState(false);  // agrandado

  const closePanel = () => { setOpenEv(null); setOpenId(null); setMaxed(false); };
  /* ── EL CABLE QUE FALTABA (owner 2026-08-09 · Contrato de Concordancia ADI ↔ Sentrix) ──────────────────────────
   * `sentrixAction` estaba INERTE por dos motivos a la vez: answerViaOracle lo devolvía en null y, aunque lo
   * hubiera devuelto, este componente montaba <ChatADI> SIN `onSentrixAction`, así que el botón no se renderizaba
   * en ninguna ruta. Acá se cierra la segunda mitad: el CTA de una respuesta abre la DIRECCIÓN EXACTA que la
   * respalda —vista, sección, entidad y filtro—, no "la Mesa" a secas.
   * `payload.address` es la gramática canónica (`sentrix://<vista>/<seccion>/<slug>?…`, address.js). Si no viene o
   * no parsea, se abre la Mesa como siempre: un CTA nunca deja al usuario en una pantalla rota. */
  const openFromAddress = (payload, msgId) => {
    const addr = payload && payload.address ? parseAddress(payload.address) : null;
    const ev = addr ? evidenceForAddress(addr, scenario) : null;
    setOpenEv(ev || { lens: "mesa", periodo: scenario });
    setOpenId(msgId || "mesa");
    setMaxed(false);
  };
  // B.2 · BIDIRECCIONAL (la mesa habla): Sentrix pre-carga una pregunta en el input de ADI (click en una fila del panel).
  // ChatADI registra su handler acá; el panel lo invoca. Prefill + focus — el usuario confirma con Enter (sin gasto por misclick).
  const askRef = useRef(null);
  const resetRef = useRef(null);   // el cubo del header = volver al halo central (resetea el chat al inicio)
  // GUÍA DE INICIO (owner 2026-08-07) · se abre SOLA en la primera visita (sin marca en localStorage) y después solo
  // desde el botón "¿Cómo funciona?" del header. El estado inicial se lee UNA vez, en el lazy initializer: leerlo en
  // cada render reabriría la guía apenas otro estado del header cambie.
  const [guiaAbierta, setGuiaAbierta] = useState(() => guiaAbreSola());
  // ejecuta un ejemplo de la guía por el MISMO camino que un chip del hero (ChatADI registra su submitSpec acá)
  const runRef = useRef(null);
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

  // DEMO PRIVADA · returns condicionales DESPUÉS de todos los hooks (rules of hooks): puerta/admin/splash.
  const _hash = typeof window !== "undefined" ? window.location.hash : "";
  if (_hash === "#admin") return <AdminAccess/>;                        // el owner emite códigos (la clave la valida el server)
  if (_hash === "#acceso" && !access.granted) return <AccessGate onGranted={(g) => { setAccess((a) => ({ ...a, checked: true, granted: g })); window.location.hash = ""; }} reason={access.reason} expiresAt={access.expiresAt}/>;   // vista previa de la puerta
  if (!access.checked) return <div style={{ height:"100vh", background:C.bg }}/>;   // sin flash del producto antes del veredicto
  if (access.required && !access.granted) return <AccessGate onGranted={(g) => setAccess((a) => ({ ...a, granted: g }))} reason={access.reason} expiresAt={access.expiresAt}/>;

  return (
    <div className="app-root" style={{ height:"100vh", background:C.bg, fontFamily:"'DM Sans','Segoe UI',sans-serif", color:C.text, display:"flex", flexDirection:"column", overflow:"hidden" }}>

      {/* ── MAIN · ADI centro con atmósfera ──
          LA BARRA BLANCA DE ARRIBA YA NO EXISTE (owner 2026-08-20): la marca, las dos acciones y los cuatro
          indicadores de estado se mudaron a `BarraLateral`, al borde derecho. El lienzo empieza arriba de todo:
          se recuperan los 56 px que ocupaba el header y desaparece el corte horizontal que partía la pantalla. */}
      <main style={{ flex:1, minWidth:0, display:"flex", flexDirection:"column", position:"relative", background:C.bg, overflow:"hidden" }}>
        {/* glow sutil ESTÁTICO (sin animación) · da vida a la esquina del chat · efecto tipo panel lateral de Code */}
        <div style={{ position:"absolute", left:0, bottom:0, width:"58%", height:"62%", zIndex:0, pointerEvents:"none", background:"radial-gradient(ellipse 75% 75% at 0% 100%, rgba(47,184,218,0.06), transparent 70%)" }}/>
        {/* la barra flota SOBRE el lienzo, fuera del flujo: el campo de hexágonos pasa por debajo hasta el borde */}
        <BarraLateral
          mesaAbierta={!!(openEv && openEv.lens === "mesa")}
          onMesa={() => { if (openEv && openEv.lens === "mesa") closePanel(); else {
            // «SIEMPRE» al 50/50: se repone en CADA apertura, no solo en la primera del arranque. Si el usuario
            // la agrandó ayer y hoy abre en otra pantalla, arranca pareja igual — y desde ahí la mueve.
            setPanelW(Math.round(window.innerWidth / 2)); setMaxed(false);
            setOpenEv({ lens: "mesa", periodo: scenario }); setOpenId("mesa"); } }}
          guiaAbierta={guiaAbierta}
          onGuia={() => setGuiaAbierta((v) => !v)}
          onInicio={() => { closePanel(); if (resetRef.current) resetRef.current(); }}
          modoIA={ADI_LLM_ENABLED}
          demoDias={access.granted && access.granted.expiresAt ? Math.max(0, Math.ceil((access.granted.expiresAt - Date.now()) / 86400000)) : null}
          fecha={getCurrentDateString()}/>
        <div style={{ position:"relative", zIndex:1, display:"flex", flexDirection:"row", flex:1, minHeight:0 }}>
          <div style={{ flex:1, minWidth:0, display:"flex", flexDirection:"column" }}>
            <ChatADI scenario={scenario} animate={animate}
              onOpenEvidence={(ev, id) => { setOpenEv(ev && !ev.periodo ? { ...ev, periodo: scenario } : ev); setOpenId(id); }}   // periodo = el escenario vivo (la Mesa deep-linkeada desde una respuesta P&L lee el mismo dato que el chat)
              onSentrixAction={openFromAddress}
              openEvidenceId={openId}
              registerAsk={(fn) => { askRef.current = fn; }}
              registerReset={(fn) => { resetRef.current = fn; }}
              registerRun={(fn) => { runRef.current = fn; }}/>
          </div>
          {openEv && (isMobile ? (
            /* MOBILE: overlay a pantalla completa — el ✕ del panel vuelve al chat (sin divisor ni resize) */
            <div style={{ position:"fixed", inset:0, zIndex:60, background:C.bg, display:"flex", flexDirection:"column" }}>
              <Suspense fallback={<PanelSkeleton/>}>
                {/* el `vc` es el contexto de pantalla que emitió la pieza tocada (Contrato de Concordancia): viaja
                    junto a la pregunta, sin cifras y sin tablas — solo dice QUÉ estaba mirando el usuario. */}
                <SentrixPanel evidence={openEv} onClose={closePanel} onToggleMax={null} maximized={true} onAsk={(q, vc) => { closePanel(); if (askRef.current) askRef.current(q, vc); }}/>
              </Suspense>
            </div>
          ) : (
            <>
              {/* divisor arrastrable (estilo Code) */}
              <div onMouseDown={startResize} title="Arrastrar para redimensionar"
                style={{ width:6, flexShrink:0, cursor:"col-resize", background:"transparent", borderLeft:`1px solid ${C.border}`, transition:"background 0.15s" }}
                onMouseEnter={e=>{ e.currentTarget.style.background = "rgba(47,184,218,0.25)"; }}
                onMouseLeave={e=>{ e.currentTarget.style.background = "transparent"; }}/>
              <div style={{ width: maxed ? "72%" : panelW, flexShrink:0, minWidth:0, minHeight:0 }}>
                <Suspense fallback={<PanelSkeleton/>}>
                  <SentrixPanel evidence={openEv} onClose={closePanel} onToggleMax={() => setMaxed(m=>!m)} maximized={maxed} onAsk={(q, vc) => { if (askRef.current) askRef.current(q, vc); }}/>
                </Suspense>
              </div>
            </>
          ))}
        </div>
      </main>

      {/* GUÍA DE INICIO · fuera del <main> porque es `position:fixed` sobre toda la app y no debe heredar el
          `overflow:hidden` del layout. Tocar un ejemplo la cierra y ejecuta la pregunta: la explicación se
          convierte en el primer turno, en vez de quedar como un folleto que hay que recordar. */}
      {guiaAbierta && (
        <GuiaInicio
          onCerrar={() => setGuiaAbierta(false)}
          // la guía manda el PROMPT EXACTO al chat normal (owner 2026-08-15): sin spec, sin atajo, sin ruta demo
          onEjecutar={(q) => { setGuiaAbierta(false); if (runRef.current) runRef.current(q); }}/>
      )}

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
        @keyframes adiThink { 0%,80%,100%{ opacity:0.2; transform:translateY(0); } 40%{ opacity:1; transform:translateY(-2px); } }
        .adi-think { display:inline-flex; gap:3px; align-items:center; }
        .adi-dot { width:4px; height:4px; border-radius:50%; background:#2fb8da; display:inline-block; animation:adiThink 1.2s ease-in-out infinite; }
        .adi-dot:nth-child(2){ animation-delay:0.15s; }
        .adi-dot:nth-child(3){ animation-delay:0.30s; }
        /* responsive del header · ocultar progresivamente lo menos esencial (deja escenario + badge de modo) */
        @media (max-width: 1040px) { .hdr-date { display:none !important; } }
        @media (max-width: 900px)  { .hdr-live-text { display:none !important; } }
        /* el botón de la guía sobrevive SIEMPRE (es la puerta a la ayuda) · en angosto queda solo el "?" */
        @media (max-width: 900px)  { .hdr-guia-label { display:none !important; } }
        /* teléfonos de 360px: los hijos del header son flexShrink:0, así que lo único que cede es la separación.
           Medido con el header de producción (sin el selector de escenarios, que es dev-only): 370px a gap:14 —
           entra en 375 pero no en 360. A gap:8 baja a ~346 y entra en los dos. */
        @media (max-width: 420px)  { .hdr-acciones { gap:8px !important; } }
        @media (max-width: 620px)  { .hdr-esc-label, .hdr-esc-word, .hdr-live, .hdr-datos { display:none !important; } }
        /* MOBILE (owner 2026-07-08 · primera impresión desde el celular): header lean (logo + Mesa + IA) ·
           inputs a 16px para que iOS no haga zoom-jump al tocar el campo */
        @media (max-width: 480px)  {
          .hdr-demo, .hdr-sub { display:none !important; }
          header { padding: 0 12px !important; }
        }
        @media (max-width: 760px)  {
          input, textarea { font-size: 16px !important; }
        }
        /* Safari/Chrome móvil: 100vh incluye la barra de URL y esconde el input — dvh mide el viewport REAL */
        @supports (height: 100dvh) {
          .app-root { height: 100dvh !important; }
        }
        @keyframes auroraBreathe { 0%,100%{opacity:0.6} 50%{opacity:1} }
        @keyframes livePulse {
          0%  { box-shadow: 0 0 0 0 rgba(16,185,129,0.5); transform:scale(1); }
          60% { box-shadow: 0 0 0 8px rgba(16,185,129,0); transform:scale(1.15); }
          100%{ box-shadow: 0 0 0 0 rgba(16,185,129,0);  transform:scale(1); }
        }
        @keyframes adiAurora {
          0%, 100% { transform: scale(1)   translate(0, 0);     opacity: 0.7; }
          25%      { transform: scale(1.06) translate(-3%, 2%);  opacity: 0.85; }
          50%      { transform: scale(1.1)  translate(2%, -2%);  opacity: 1; }
          75%      { transform: scale(1.04) translate(3%, 3%);   opacity: 0.8; }
        }
        /* el cubo solo GIRA cuando ADI responde (owner 2026-07-14: sin brillo ni borde reflectante) */
        @keyframes adiGiro {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes sentrixSweep {
          0%   { transform: translateX(-220px) skewX(-14deg); opacity: 0; }
          12%  { opacity: 1; }
          88%  { opacity: 1; }
          100% { transform: translateX(2200px) skewX(-14deg); opacity: 0; }
        }
        .sentrix-sweep { position:absolute; top:0; left:0; height:100%; width:170px; z-index:6; pointer-events:none; background:linear-gradient(100deg, transparent, rgba(60,200,235,0.09), transparent); mix-blend-mode:screen; animation: sentrixSweep 8s ease-in-out infinite; }
        /* "i" de ayuda en cada card · lee el catálogo de definiciones (determinístico, cero tokens) · tooltip en hover */
        .adi-i { position:absolute; top:7px; right:8px; width:14px; height:14px; border-radius:50%; border:1px solid rgba(255,255,255,0.18); color:rgba(255,255,255,0.4); font-size:9px; font-style:italic; line-height:12px; text-align:center; cursor:help; font-family:Georgia,'Times New Roman',serif; user-select:none; transition:color .15s, border-color .15s; z-index:4; }
        .adi-i:hover { color:#2fb8da; border-color:rgba(47,184,218,0.6); }
        .adi-tip { position:absolute; bottom:calc(100% + 7px); right:-3px; width:198px; background:#0b0b0d; border:1px solid rgba(47,184,218,0.4); border-radius:8px; padding:8px 11px; font-size:11px; line-height:1.5; color:#c4c2bd; opacity:0; transform:translateY(3px); pointer-events:none; transition:opacity .15s, transform .15s; z-index:60; box-shadow:0 6px 20px rgba(0,0,0,0.55); text-align:left; font-style:normal; font-weight:400; letter-spacing:0; }
        .adi-i:hover .adi-tip { opacity:1; transform:translateY(0); }
        /* "i" inline · misma ayuda determinística, para headers de tabla/columna (ring) · no absolute */
        .adi-i2 { position:relative; display:inline-flex; align-items:center; justify-content:center; width:12px; height:12px; border-radius:50%; border:1px solid rgba(255,255,255,0.18); color:rgba(255,255,255,0.4); font-size:8px; font-style:italic; line-height:1; cursor:help; font-family:Georgia,'Times New Roman',serif; user-select:none; vertical-align:middle; margin-left:4px; text-transform:none; transition:color .15s, border-color .15s; }
        .adi-i2:hover { color:#2fb8da; border-color:rgba(47,184,218,0.6); }
        /* header del ring al TOPE → tooltip abre HACIA ABAJO · alineación horizontal SEGÚN la columna para que encuadre
           en TODAS (cliente e inventario): centro = centrado en el "i" · derecha = abre a la izquierda (no se sale) */
        .adi-i2 .adi-tip { top:calc(100% + 7px); bottom:auto; width:172px; white-space:normal; transform:translateY(-3px); }
        .adi-i2 .adi-tip.tip-l { left:-6px; right:auto; margin-left:0; }
        .adi-i2 .adi-tip.tip-c { left:50%; right:auto; margin-left:-86px; }
        .adi-i2 .adi-tip.tip-r { left:auto; right:-6px; margin-left:0; }
        .adi-i2:hover .adi-tip { opacity:1; transform:translateY(0); }
      `}</style>
    </div>
  );
}
