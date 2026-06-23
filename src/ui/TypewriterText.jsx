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

  // ── Tick por tick · velocidad estilo Claude · burst 2-4 chars · pausas semánticas
  useEffect(() => {
    if (!started || done) return;
    if (displayed.length >= text.length) {
      setDone(true);
      if (completeRef.current) completeRef.current();
      return;
    }
    const burst = 2 + Math.floor(Math.random() * 3);
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

    let nextDelay = speed + (Math.random() * 4 - 2) + extra;
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
          background:C.blue, marginLeft:2,
          verticalAlign:"text-bottom",
          animation:"blink 1s infinite"
        }}/>
      )}
    </span>
  );
}
