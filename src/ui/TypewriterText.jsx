/* === src/ui/TypewriterText.jsx ===
 * Typewriter estilo Claude · extraído de 41cc33d8 · verbatim · solo import de React + C. */
import React, { useState, useRef, useEffect } from "react";
import { C } from "./theme.js";

export function TypewriterText({ text, speed = 8, startDelay = 0, showCursor = true, onComplete }) {
  const [displayed, setDisplayed] = useState("");
  const [started,   setStarted]   = useState(false);
  const [done,      setDone]      = useState(false);
  const completeRef = useRef(onComplete);
  completeRef.current = onComplete;

  // ── Reset al cambiar el texto fuente
  useEffect(() => {
    setDisplayed(""); setStarted(false); setDone(false);
  }, [text]);

  // ── Delay inicial antes de empezar a escribir
  useEffect(() => {
    const t = setTimeout(() => setStarted(true), startDelay);
    return () => clearTimeout(t);
  }, [startDelay, text]);

  // PESTAÑA OCULTA → texto completo de una (mejora 9 · 2026-07-26): el browser estrangula los timers de una
  // pestaña oculta (~1 tick/s) — quien cambia de pestaña mientras ADI escribe volvía a una respuesta tipeándose
  // a cuentagotas. Nadie mira la animación oculta: al ocultarse, se muestra el texto entero y listo.
  useEffect(() => {
    if (!started || done) return;
    const complete = () => { if (document.hidden) setDisplayed(text); };
    complete();
    document.addEventListener("visibilitychange", complete);
    return () => document.removeEventListener("visibilitychange", complete);
  }, [started, done, text]);

  // RITMO ADAPTATIVO (mejora 9 · velocidad percibida 2026-07-26): en respuestas largas (P&L · tablas ·
  // 1.500+ chars) la cadencia fija tardaba ~17s en terminar de escribir — y el gráfico y las sugerencias
  // recién aparecen al final. Hasta ~350 chars el ritmo es EL MISMO de siempre; de ahí el burst crece y las
  // pausas se achican en proporción al largo (tope 4×). Solo presentación: el texto no cambia ni un byte.
  const boost = text.length <= 350 ? 1 : Math.min(4, 1 + (text.length - 350) / 400);

  // ── Tick por tick · velocidad estilo Claude · burst 2-4 chars · pausas semánticas
  useEffect(() => {
    if (!started || done) return;
    if (displayed.length >= text.length) {
      setDone(true);
      if (completeRef.current) completeRef.current();
      return;
    }
    const burst = Math.round((2 + Math.floor(Math.random() * 3)) * boost);
    let nextEnd = Math.min(displayed.length + burst, text.length);
    if (nextEnd < text.length && text[nextEnd] !== " ") {
      const nextSpace = text.indexOf(" ", nextEnd);
      if (nextSpace !== -1 && nextSpace - nextEnd <= 3) {
        nextEnd = nextSpace;
      }
    }
    const prevChar = text[nextEnd - 1] || "";
    let extra = 0;
    if (prevChar === ",")        extra = 28;
    else if (prevChar === ":")   extra = 30;
    else if (prevChar === ";")   extra = 35;
    else if (prevChar === ".")   extra = 55;
    else if (prevChar === "?" || prevChar === "!") extra = 60;
    else if (prevChar === "\n")  extra = 40;
    if (text.slice(nextEnd-2, nextEnd) === "\n\n") extra = 90;

    let nextDelay = speed + (Math.random() * 4 - 2) + extra / boost;
    const t = setTimeout(() => {
      setDisplayed(text.slice(0, nextEnd));
    }, Math.max(4, nextDelay));
    return () => clearTimeout(t);
  }, [started, displayed, text, speed, done]);

  return (
    <span>
      {displayed}
      {showCursor && !done && (
        <span style={{
          display:"inline-block", width:2, height:"1em",
          background:C.celeste, marginLeft:2,
          verticalAlign:"text-bottom",
          animation:"blink 1s infinite"
        }}/>
      )}
    </span>
  );
}
