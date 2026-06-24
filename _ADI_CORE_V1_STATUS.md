# ADI Core Fase 1+2 v1 — Estado y runbook de la prueba acotada del owner

**Estado:** `ADI_QI_FILTER_ENABLED = true` (encendido para la **prueba acotada del owner** · **NO producción general**).
**Commit del encendido:** ver `git log` (mensaje "ENCENDIDO prueba acotada del owner").
**Alcance v1:** las 24 queries con "por" — filtro marca/familia/cliente/SKU × las 8 métricas QI, sobre datasets de ventas/márgenes.
**Criterio de cierre:** ADI puede decir "no llego a eso" pero **nunca** responde otra pregunta como si fuera la original.

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
| Corpus 47 (modular vs piso) | **PARITY 47** | `node _parity_battery.mjs` |
| Extendida (D0 + combos) | **PARITY 19** | `node _parity_extended.mjs` |
| Canónica (10 básicos + 6 anclas) | **10/10 + 6/6** | `node _bateria_canonica.mjs` |
| **Oráculo 30** (cada query → su rama) | **30/30** | `node _piece4_oracle30.mjs` |
| **Mordida** (cada APLICAR filtra de verdad) | **13/13** | `node _piece3_mordida.mjs` |
| **Multi-turno post-AVISAR** (limpio · no contamina) | **7/7** | `node _piece4_multiturn.mjs` |
| Controles #26-28 byte vs piso | **3/3** | `node _piece3_controls.mjs` |
| Extracción de filtro (las "por" + no-resuelto) | **21/21** | `node _piece2_extract.mjs` |
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
