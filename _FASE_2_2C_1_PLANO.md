# Fase 2.2c-1 — Mecanismo `lastRetrievalContext` + detector elíptico-vs-autónomo + refinamiento de MÉTRICA · Plano + Red-team

> Primer sub-ladrillo de 2.2c (el más enredado). Trae la BASE compartida de los tres refinamientos (el
> `lastRetrievalContext`) + el corazón (distinguir refinamiento de pregunta nueva) + el primer refinamiento
> (métrica: "y por margen"). Plano puro — se aprueba y recién ahí se construye. Flag default OFF.

---

## 0 · LECTURA DE TAMAÑO de 2.2c-1
**2.2c-1 es MEDIO-GRANDE.** Tres piezas:
- **Mecanismo `lastRetrievalContext`** (la base): chico · riesgo BAJO (metadata, gemelo del `_pending` de 2.2b · invisible al texto).
- **Detector elíptico-vs-autónomo** (el CORAZÓN, la trampa): medio · riesgo **ALTO** (el discriminador fino; es lo que decide si ADI "recuerda de más").
- **Recomposer de métrica** ("y por margen" → recompone + reusa el pipeline): chico · riesgo BAJO (reusa `queryInterpreter`+`composeRetrieval`).

**Mi lectura: va ENTERO** — el mecanismo + el recomposer son chicos; el detector es el riesgo, pero acá solo cubre el refinamiento de MÉTRICA (filtro/corte son 2.2c-2/c-3), así que está acotado. **El escape:** si al construir el detector la distinción elíptico-vs-autónomo crece más de lo previsto (más casos límite de los que la métrica necesita), **freno y propongo partirlo** (timón #2). Flag `ADI_MT_REFINE_METRIC_ENABLED`, **default OFF**.

---

## 1 · El alcance
- **Mecanismo:** guardar el spec del retrieval previo (`{ metric, dimension, filtro, domain }`) para que un refinamiento lo cargue.
- **Detector:** `y por margen` → refina; `ventas por familia` → pregunta nueva.
- **Refinamiento de métrica:** `ventas por cliente de Samsung` → `y por margen` → margen por cliente de Samsung (cambia métrica, MANTIENE filtro+dimensión).

---

## 2 · El mecanismo `lastRetrievalContext` (gemelo del `pendingSpineDecision` de 2.2b · anclado)
**Hoy** `composeRetrieval` opera `qi.metrics[0]`/`dim`/`_filtrosArg` internamente pero solo persiste `entities`+`lastModuleAsked` (answerADI 152-154); el spec se pierde.

**2.2c-1 agrega (3 pasos, espejo de 2.2b):**
1. **`composeRetrieval` retorna `_qiContext`** (qiRetrieval ~L1029, junto a `materialMetrics` · metadata, cero formato nuevo):
   `_qiContext = { metric: qi.metrics[0], dimension: dim, filtro: _filtrosArg, domain }` (domain del Semantic Layer · metricRegistry).
2. **`_plainWrap`/`_finalize` lo escribe** estampado con turn (gemelo de cómo 2.2b escribe `pendingSpineDecision`):
   `if (ADI_MT_REFINE_METRIC_ENABLED) nextCtx.lastRetrievalContext = resp._qiContext ? { ...resp._qiContext, turn: nextTurn } : null;` — SIEMPRE setea el campo (vive un turno por construcción).
3. **El refinamiento (N+1) lo lee, modifica el spec, reusa el pipeline:** "y por margen" → recompone `margen por cliente de Samsung` → `queryInterpreter`+`composeRetrieval` (cero recálculo nuevo · gemelo de cómo 2.2b recompone y reusa `resolveFilteredRetrieval`).

---

## 3 · La trampa central — elíptico (refina) vs autónomo (pregunta nueva) · EL CORAZÓN
**El criterio (el discriminador):** una frase **NOMBRA una DIMENSIÓN** (cliente/familia/marca/sku/bodega) → es **AUTÓNOMA** (pregunta nueva), aunque parezca elíptica. Si referencia **SOLO una métrica** (ventas/margen/contribución), sin dimensión nueva, y es elíptica (arranca con "y" o es una métrica suelta corta) → es **REFINAMIENTO de métrica**.

**Por qué la dimensión es el discriminador:** en "ventas **por cliente**", `cliente` es la DIMENSIÓN; en "y **por margen**", `margen` es una MÉTRICA (no dimensión). El "por" es el mismo, pero lo que sigue es de tipo distinto (el Semantic Layer ya separa DIMENSION_REGISTRY de METRIC_REGISTRY).

### Los casos límite (los que pediste)
| Entrada (tras "ventas por cliente de Samsung") | Análisis | Acción |
|---|---|---|
| `y por margen` | métrica (margen), SIN dimensión, "y" | **REFINA** (margen por cliente de Samsung) |
| `y las ventas` | métrica (ventas), SIN dimensión, "y" | **REFINA** (vuelve a ventas, mismo filtro+dim) |
| `ventas por familia` | métrica (ventas) **+ DIMENSIÓN (familia)** | **PREGUNTA NUEVA** (retrieval familia) |
| `margen por cliente` (a secas) | métrica (margen) **+ DIMENSIÓN (cliente)** | **PREGUNTA NUEVA** (autónoma, self-contained) |
| `margen` suelto | métrica, SIN dimensión | depende del pending → ver §4 (coordinación 2.2b) |
| `y por cliente` | nombra DIMENSIÓN (cliente), sin métrica nueva | **PREGUNTA NUEVA** (refinamiento de dimensión = fuera de 2.2c-1 · autónomo por ahora) |

**El detector `_detectMetricRefinement(text, ctx)`:** (1) requiere `lastRetrievalContext` fresco; (2) si la frase nombra una DIMENSIÓN → null (autónoma); (3) si referencia una métrica-eje SIN dimensión y es elíptica → refina; (4) si no → null.

---

## 4 · Coordinación con el pending del spine (2.2b) — explícita, que no se pisen
El caso compartido: un **`margen` suelto**. Lo puede querer 2.2b (resolver un ACLARAR) o 2.2c (refinar el retrieval). **Prioridad por orden de evaluación al tope de answerADI:**
1. **`_resolvePending` (2.2b) corre PRIMERO.** Si hay un `pendingSpineDecision` fresco (un ACLARAR pendiente), el spine GANA — su pregunta directa ("¿en qué?") es más específica. `margen` → resuelve el ACLARAR.
2. **topic-change cleanup (2.2a-2)** — limpia el foco + `lastRetrievalContext`.
3. **`_detectMetricRefinement` (2.2c) corre DESPUÉS.** Si NO hubo pending pero hay `lastRetrievalContext` fresco, `margen` → refina el retrieval.
4. Sin pending NI lastRetrieval fresco → `margen` es pregunta nueva (lo de hoy).

**Disjuntos:** 2.2b consume `pendingSpineDecision`; 2.2c consume `lastRetrievalContext`. Son campos distintos; el orden (2.2b > 2.2c) resuelve el empate. **La regla: el spine pending gana al lastRetrieval si ambos están frescos.**

---

## 5 · Respeta la red ya construida
- **Freshness (2.2a):** `lastRetrievalContext.turn === turnCount` (turno inmediato anterior). Stale → no refina.
- **Topic-change (2.2a-2):** el `_detectTopicChange` cleanup (answerADI 465-468) **también limpia `lastRetrievalContext`** (`= null`). Cambio de tema → el refinamiento se descarta.
- **Prioridad (2.2b):** el spine pending gana (§4).
- **Anti-fuga:** el refinamiento de métrica usa métricas-eje (ventas/margen/contribución · NUNCA inventario) → cero superficie de fuga. (El corte/inventario es 2.2c-3.)

---

## 6 · El oráculo (cadenas reales + controles ROJOS)
**Refinamiento (gate):**
- `ventas por cliente de Samsung` → `y por margen` → margen por cliente de Samsung (mantiene Samsung+cliente).
- `ventas por cliente de Samsung` → `y por margen` → `y las ventas` → vuelve a ventas (cadena de 2 refinamientos).

**Controles ROJOS (los candados):**
- **pregunta nueva NO es refinamiento:** `ventas por cliente de Samsung` → `ventas por familia` → retrieval NUEVO (familia), NO "ventas por familia de Samsung" inventado.
- **autónoma a secas:** `ventas por cliente de Samsung` → `margen por cliente` → retrieval nuevo (margen por cliente, global), NO refina con Samsung.
- **refinamiento tras topic-change se descarta:** `ventas por cliente de Samsung` → `cómo va el negocio` → `y por margen` → margen global (no resucita Samsung).
- **refinamiento sin vista fresca:** `y por margen` en sesión fresca → pregunta nueva (no inventa refinamiento).
- **coordinación 2.2b:** `el mejor SKU de Bosch` → [ACLARA] → `margen` → resuelve el ACLARAR (2.2b gana, NO refina un retrieval inexistente).

---

## 7 · El blindaje (single-turn byte-idéntico · shadow-diff)
- **Single-turn byte-idéntico (el más importante):** `lastRetrievalContext` solo se lee en multi-turno; sesión fresca (los 47 + canónica + extendida) → no dispara → **piso byte-exacto OFF y ON**. El `_qiContext` es metadata (no toca el texto del retrieval · corpus-safe 47/47).
- **Shadow-diff:** flag ON vs OFF → solo cambian las cadenas de refinamiento de métrica; el turno 1 (el retrieval) + las preguntas nuevas + lo demás byte-idéntico.
- **Compone con la red:** el oráculo corre también con 2.2a/2.2a-2/2.2b ON → los candados se respetan + la coordinación 2.2b.

---

## 8 · Flags · Blast radius
- **Flag:** `ADI_MT_REFINE_METRIC_ENABLED` (default OFF).
- **Blast radius:** `composeRetrieval` (retorna `_qiContext` · metadata) + `_plainWrap`/`_finalize` (escribe `lastRetrievalContext`) + topic-change cleanup (lo limpia) + `_detectMetricRefinement` (helper) + el recomposer + 1 wire al tope (después de 2.2b/topic-change). Flag OFF → `_qiContext` no se escribe al contexto, el detector no corre → byte-idéntico a 2.1/2.2a/2.2a-2/2.2b.

---

## 9 · Reporte crítico — dónde será frágil
1. **Romper el single-turn (riesgo CENTRAL).** El refinamiento solo vive con `lastRetrievalContext` fresco; sin él no dispara. Mitigación: piso byte-exacto single-turn + el `_qiContext` corpus-safe.
2. **El refinamiento que pisa una pregunta nueva (la trampa, el corazón).** "ventas por familia" o "margen por cliente" tratados como refinamiento de Samsung. Mitigación: el discriminador de DIMENSIÓN (nombra dimensión = autónoma) + los 2 controles ROJOS.
3. **El empate con el pending del spine (2.2b).** Un "margen" suelto. Mitigación: prioridad por orden (2.2b corre primero, gana) + el control ROJO de coordinación.
4. **El `_qiContext` ensombreciendo el retrieval.** Si el campo cambia el texto. Mitigación: es metadata (como `_pending`), invisible al texto; 47/47 lo prueba.
5. **El recomposer perdiendo el filtro.** Si "margen por cliente de Samsung" no se reconstruye bien (filtro multi-valor, etc.). Mitigación: arranco con el filtro simple (marca/familia · el caso del oráculo); si el multi-filtro crece, timón #2.
6. **El tamaño del detector.** Si la distinción elíptico-vs-autónomo necesita más que el discriminador de dimensión, crece → timón #2.

---

## 10 · Para aprobar
1. ¿2.2c-1 **entero** (mecanismo + detector + refinamiento de métrica)?
2. ¿La **conducta nueva** (timón #1): "y por margen" tras un retrieval ahora refina (mantiene filtro+dimensión)?
3. ¿El **discriminador** (nombra DIMENSIÓN → pregunta nueva; SOLO métrica elíptica → refinamiento) + la **prioridad** (spine pending 2.2b > lastRetrieval 2.2c)?

Con tu OK construyo, corro todas las pruebas (los controles ROJOS + single-turn byte-idéntico + shadow-diff + el combinado con la red), dejo el flag OFF, y reporto. **No toqué `src/` — plano puro.**
