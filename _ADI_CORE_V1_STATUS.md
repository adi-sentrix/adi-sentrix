# ADI Core Fase 1+2 v1 — Estado y runbook de la prueba acotada del owner

**Estado:** `ADI_QI_FILTER_ENABLED = false` (**default OFF · reversible**). Incluye v1 + **Fix A** (Escape rotación/filtro) + **Fix B** (narrativa global fuera del filtro) + **Fix C** (MURO de inventario: toda pregunta de inventario/capital por el chat → AVISAR Fase 2.5, una sola voz) + **Cabo 1** (suffix proactivo "un punto que no saliste…" APAGADO del todo con flag ON · Postura A) + **Cabo 2** (capability-gate de inventario en TODA sugerencia/ángulo/CTA: nada ofrece rotación/DOH/stock/cobertura/capital/bodega). El encendido para re-test del owner es **decisión del owner** (poner el flag en `true`).
**Alcance v1:** las 24 queries con "por" — filtro marca/familia/cliente/SKU × las 8 métricas QI, sobre datasets de ventas/márgenes. **+ Fix A:** "qué SKU de {marca} rota peor" (rotación/inventario CON filtro, sin "por") → AVISA conservando el filtro, nunca un SKU global. **+ Fix B:** la narrativa proactiva global se omite cuando la respuesta está filtrada (superseado por Cabo 1: ahora se omite SIEMPRE con flag ON). **+ Cabo 1:** el suffix proactivo no se emite en NINGUNA respuesta con flag ON (sobrio). **+ Cabo 2:** el honest_fallback no ofrece ángulos de inventario, ningún CTA usa `moduleChip:"Inventario"`, y el "próximo ángulo" RIL de contribución reemplaza "validar rotación…" por "validar la composición de la contribución…" (comercial).
**Criterio de cierre:** ADI puede decir "no llego a eso" pero **nunca** responde otra pregunta como si fuera la original. **Y no menciona ni ofrece lo que no puede entregar.**

---

## 1 · APAGADO (reversibilidad garantizada · el owner lo hace solo, al instante)

El apagado restaura el **baseline original byte-exacto** (probado: corpus 47/47 con flag OFF).

**Procedimiento (1 línea):**
1. Abrir `src/config/voiceFlags.js`.
2. Buscar la línea: `export const ADI_QI_FILTER_ENABLED = true;`
3. Cambiar `true` → `false`.
4. Guardar. **Listo** — el filtro queda inerte y el comportamiento vuelve al piso byte-exacto.

**Alternativa git (si preferís revertir el commit):**
`git revert <hash-del-commit-de-encendido>`  → vuelve el flag a `false`.

**Verificación opcional del baseline** (desde `ADI_PROYECTO/`):
`node _parity_battery.mjs`  → debe imprimir `PARITY 47` (sin mismatches).

> Por qué es seguro: TODO el código nuevo está gateado por `ADI_QI_FILTER_ENABLED`. Con el flag en
> `false`, `composeRetrieval` no aplica filtros (pasa `undefined` → `applyFiltros` devuelve las filas
> intactas), no computa verdictos, y `queryInterpreter` no adjunta los campos nuevos. `applyFiltros`
> (`engine/metrics.js`) **nunca se modificó**. Apagar el flag = baseline exacto. Nada más que tocar.

---

## 2 · EVIDENCIA DE LOS GATES (preservada · NO hace falta re-correr)

Todos verdes con el flag **ON**, validados antes del encendido:

| Gate | Resultado | Harness (re-correr si hace falta) |
|---|---|---|
| **Blindada Cabo 1+2 (66 = 47 + extendida · byte-exacta)** · modular-ON === piso − {suffix + sustitución RIL documentada}, cero diff escondido | **VERDE** · 50 suffix-off · 2 suffix+RIL · 5 sin-cambio · 11 inventario · **0 fallas** | `node _cabo1_armor.mjs` |
| **Cabo 2** · ninguna respuesta ofrece inventario (ángulo/sugerencia/CTA) + comercial intacto | **12/0** | `node _cabo2_inventory.mjs` |
| Corpus 47 OFF (modular vs piso · rollback) | **PARITY 47** | `node _parity_battery.mjs` |
| Extendida OFF (D0 + combos · rollback) | **PARITY 19** | `node _parity_extended.mjs` |
| Canónica OFF (10 básicos + 6 anclas · rollback) | **10/10 + 6/6** | `node _bateria_canonica.mjs` |
| Corpus 47 ON (norm) · suffix-off → CORE_OK, no MISMATCH oculto | **36 PARITY/CORE · 11 inv re-baseline** | (usar la blindada, no substring) |
| **Oráculo 30** (cada query → su rama) | **30/30** | `node _piece4_oracle30.mjs` |
| **Mordida** (cada APLICAR filtra de verdad) | **13/13** | `node _piece3_mordida.mjs` |
| **Multi-turno post-AVISAR** (limpio · no contamina) | **7/7** | `node _piece4_multiturn.mjs` |
| Controles #26-28 byte vs piso | **3/3** | `node _piece3_controls.mjs` |
| Extracción de filtro (las "por" + no-resuelto) | **21/21** | `node _piece2_extract.mjs` |
| **Fix A** · Escape rotación/filtro (AVISAR · sin SKU global) · contrato ACTUAL: rotación SIN filtro → muro (Fix C), ya no se preserva el ranking global | **8/8** | `node _fixA_rotation.mjs` |
| **Fix B** · Escape narrativa (scope sobre texto completo · 4 listas) · contrato ACTUAL: suffix APAGADO del todo con flag ON (Cabo 1 superseó el mecanismo _filtered) | **12/12** | `node _fixB_scope.mjs` |
| **Fix C** · MURO de inventario (barrido AVISAR + Fix A intacto + preservados márgenes/comercial) | **28/0** | `node _fixC_inventory.mjs` |
| **Fix C** · re-baseline documentado (12 queries inventario del corpus → AVISAR · 1 voz) | **12/12** | `node _fixC_rebaseline.mjs` |
| Reproducción escapes + mapa de puertas de inventario (diagnóstico) | — | `node _diag_escape.mjs` · `node _diag_inventory.mjs` |

**RE-BASELINE (cambio intencional de contrato con flag ON · todo revierte byte-exacto con flag OFF):**
- **Fix C · inventario:** las **11 queries de inventario del corpus** divergen del piso a **AVISAR** (route `qi_inventory_avisar`): el 47 da **MISMATCH 11** (los 11 son inventario), la canónica **8/10 + 4/6** (los inventario). Lista completa en `_fixC_rebaseline.mjs`.
- **Cabo 1 · suffix:** las **50 respuestas turn-0** que el piso remataba con el suffix proactivo "Un punto que no saliste a buscar: Mercado Libre…" (146 chars) quedan SIN esa cola. La blindada prueba **byte-exacto** que el único cambio es la remoción de esa cola (NO substring): `modular-ON === piso − cola_exacta`.
- **Cabo 2 · sustitución RIL:** **2 queries** de contribución ("ranking de clientes por contribución", "contribución por familia") cambian el "próximo ángulo" de "validar rotación y disponibilidad operativa del líder" → "validar la composición de la contribución del líder" (comercial). La blindada lo verifica como diff EXACTO documentado (cero cambio escondido alrededor).
- **No-inventario:** fuera de esas dos transformaciones, sigue **byte-idéntico** al piso (las 5 sin-suffix quedan byte-iguales). Con flag OFF: 47 PARITY 47 · extendida 19 · canónica 10/10+6/6.
| Endurecimiento de extractores | **19/19** | `node _piece1_harden.mjs` |
| **Rollback** (flag OFF → baseline) | **PARITY 47** byte-exacto | poner flag `false` + `node _parity_battery.mjs` |

> Nota operativa: correr DOS baterías a la vez puede corromper `_oracle_bundle.mjs` (lo reconstruyen
> ambas) y dar falsos mismatches. Correlas **de a una**.

---

## 3 · PROTOCOLO DEL OWNER si encontrás algo raro

1. **Apagar el flag** (sección 1) — volver al baseline.
2. **Registrar la pregunta exacta** (copiar/pegar el texto tal cual lo escribiste).
3. **Registrar la respuesta exacta** (copiar/pegar lo que ADI respondió, completo).
4. **Clasificar el fallo** en UNA de estas seis categorías:
   - **extracción** — leyó mal el filtro del texto (resolvió una marca/familia/cliente/SKU que no era, o no detectó uno que sí estaba).
   - **filtro** — extrajo bien pero la tabla no quedó filtrada (o filtró de más/menos), o dio "no hay datos" cuando sí había.
   - **dimensión** — agrupó por la dimensión equivocada, o dropeó una dimensión nombrada.
   - **AVISAR** — dijo "no llego" sobre algo que SÍ debería responder (o respondió algo que debería haber avisado).
   - **multi-turno** — un "no llego" o una tabla filtrada envenenó el turno siguiente.
   - **narrativa** — el texto/lectura/foco salió raro, mal formateado, o con una cifra inconsistente.
5. **Corregir antes de avanzar** (no exponer a otros usuarios hasta cerrar el caso).

---

## 4 · DEUDA ABIERTA DECLARADA (fuera del bridge · queda igual que el piso)

No empeoraron con el flag ON (no son retrieval con "por" → caen a su composer de siempre):
- **Fase 2.1** (guard B / Lista-B-sin-"por", con diseño+red-team propios): promedio, cuántos, "menor a" (umbral), capital, Tier, stock-por-bodega.
- **Fase 2.5** (inventario): rotación/DOH/capital/bodega como consulta directa.

La fase NO se considera cerrada hasta que Fase 2.1 cierre esos 6.

**Fragilidad residual declarada (Cabo 2):** el capability-gate de inventario es por **fuente** (gatea en el productor) y por **concepto** (rotación/DOH/stock/cobertura/capital/bodega/sucursal/liquidar/quiebre), no borra palabras a ciegas. Un **productor de sugerencia/CTA NUEVO** que ofrezca inventario y no pase por `_gateInvCTA` / `_generateContextualAlternatives` / `rilPickNextAngle` podría fugar — al agregar composers, respetar la regla "no ofrecer lo bloqueado". El `b5` ejecutivo y el opener de mechanism con "inventario" hoy son inalcanzables (sus triggers caen al muro); si Fase 2.1 cambia ese ruteo, revisar que no reaparezcan. Cuando Fase 2.5 habilite inventario, **revertir Cabo 1 + Cabo 2** (el suffix y los ángulos de inventario vuelven a ser legítimos).
