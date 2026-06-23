# ADI · Proyecto de modularización — arranque en Claude Code

## Qué hay acá
- `_REFERENCIA_PISO_41cc33d8.jsx` — el monolito sellado (MD5 41cc33d8). VERDAD DE REFERENCIA. No se edita. Todo se compara contra él.
- `src/` — el motor ya extraído y auditado byte-idéntico al piso (Fases 2-4 completas: datos, config, engine, adi conversacional con answerADI).
- `HANDOFF.md` — el plan completo: estado, fases 5-6 pendientes, regla madre, criterios, orden de trabajo.

## Primer paso (antes de tocar nada)
1. Leé HANDOFF.md entero.
2. Confirmá que el camino crítico corre byte-idéntico:
   ```js
   import { answerADI } from "./src/adi/answerADI.js";
   const r = answerADI("cómo están las ventas", {}, { scenario: "bonanza" });
   console.log(r.route, r.text); // early_gate + texto del piso
   ```
   Probá los 10 básicos + 6 anclas (lista en HANDOFF.md §4). Todos deben dar el texto del piso.
3. Recién con eso verde → Fase 5 (UI) y Fase 6 (Vite · navegable).

## Regla madre (innegociable)
Misma entrada → misma salida que el piso 41cc33d8. La UI consume answerADI, no recalcula. No se agregan features ni se cambian cifras durante el refactor.

## Cómo se dirige
El arquitecto (en chat) audita cada fase contra 41cc33d8 y aprueba antes de avanzar. Llevá las entregas al chat. Nunca aprobar sobre reporte — siempre sobre la corrida real.
