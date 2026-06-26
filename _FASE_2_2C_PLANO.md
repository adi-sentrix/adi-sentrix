# Fase 2.2c — Refinamientos deícticos · Plano + Red-team (el último ladrillo de la Etapa 2)

> Sobre la conversación-con-memoria ya construida (2.2a + 2.2a-2 + 2.2b). Acá ADI refina la vista anterior:
> "y por margen" (cambia métrica), "solo Bosch" (re-filtra), "los tres peores" (acota). El más enredado de
> los tres. Plano puro — se aprueba el split y recién ahí se construye sub-ladrillo por sub-ladrillo. Flags OFF.

---

## 0 · LECTURA DE TAMAÑO → 2.2c es GRANDE, RECOMIENDO PARTIR EN 3
2.2c es **el más enredado de la Fase 2.2** (lo marcamos así). Tiene un mecanismo compartido nuevo + tres refinamientos de naturaleza distinta + la trampa central (refinamiento vs pregunta nueva) + composición con TODA la red. Construirlo entero es exactamente lo que la regla dice no hacer.

| Sub-ladrillo | Qué cierra | Tamaño | Riesgo |
|---|---|:--:|:--:|
| **2.2c-1 · Mecanismo + refinamiento de MÉTRICA** | el `lastRetrievalContext` (la base compartida) + el detector elíptico-vs-autónomo + "y por margen" | Medio-grande | **ALTO** (la base + la trampa central) |
| **2.2c-2 · Refinamiento de FILTRO** | "solo Bosch" re-filtra la vista anterior | Medio | Medio (reusa la base + el spine filter) |
| **2.2c-3 · Refinamiento de CORTE** | "los tres peores"/"top 3" acota · **compone con la anti-fuga** ("los tres peores" tras inventario sigue AVISANDO) | Medio | **ALTO** (el RED gate de inventario; toca la slice committeada) |

**Orden:** 2.2c-1 (la base + la métrica, prueba el end-to-end) → 2.2c-2 (filtro) → 2.2c-3 (corte, el del RED gate). **Cada sub-ladrillo trae su plano detallado + red-team al llegar.** **El escape:** si al diseñar cualquiera crece más de lo previsto, **freno y propongo el split adicional** (timón #2). **Flags:** 3 sub-flags `ADI_MT_REFINE_METRIC/FILTER/SLICE_ENABLED`, **default OFF** (no-negociable · reversible byte-exacto; descarto la sugerencia de "default ON" del barrido).

---

## 1 · El alcance (los 3 refinamientos)
- **A · métrica:** `ventas por cliente de Samsung` → `y por margen` → cambia la métrica, **MANTIENE** el filtro Samsung + la dimensión cliente → "margen por cliente de Samsung".
- **B · filtro:** `ventas por cliente` → `solo Bosch` → re-filtra la vista anterior a Bosch.
- **C · corte:** `los tres peores` / `el top 3` → acota la vista anterior.

---

## 2 · El mecanismo — `lastRetrievalContext` (gemelo de `pendingSpineDecision` de 2.2b · anclado)
**Hoy** el contexto NO guarda el spec del retrieval: `composeRetrieval` opera `qi.filtros`/`qi.metrics`/`dim` internamente pero solo persiste `resp.entities` + `lastModuleAsked` (answerADI 152-154). El filtro Samsung y la métrica/dimensión se pierden tras el turno.

**2.2c-1 agrega:**
1. **`composeRetrieval` retorna `_qiContext = { metric, dimension, filtro, domain }`** (qiRetrieval ~L1029, junto a `materialMetrics`).
2. **`_plainWrap`/`_threadContext` lo escribe** como `lastRetrievalContext = { ..._qiContext, turn }` (gemelo exacto de cómo 2.2b escribe `pendingSpineDecision`, answerADI 236-238).
3. **El refinamiento (N+1) lo lee, modifica el spec, y reusa el pipeline:** "y por margen" → recompone `margen por cliente de Samsung` y reusa `queryInterpreter`+`composeRetrieval` (cero recálculo nuevo · gemelo de cómo 2.2b recompone y reusa `resolveFilteredRetrieval`).

---

## 3 · La trampa central — refinamiento (elíptico) vs pregunta nueva (autónoma)
**El criterio (anclado al barrido):** un refinamiento **REUTILIZA** dimensión/entidad del turno anterior (presupone contexto = elíptico); una pregunta nueva **NOMBRA la dimensión completa** (self-contained = autónoma).

| Entrada (tras "ventas por cliente de Samsung") | Señal | Acción |
|---|---|---|
| `y por margen` / `y margen` | "y" + métrica, SIN dimensión nueva | **REFINA** (mantiene cliente+Samsung) |
| `solo Bosch` | "solo" + marca/familia, SIN dimensión nueva | **REFINA** (re-filtra) |
| `los tres peores` / `top 3` | cuantificador suelto sobre la lista previa | **REFINA** (acota) |
| `ventas por familia` | nombra métrica **Y** dimensión completa | **PREGUNTA NUEVA** (retrieval nuevo) |
| `cómo está Lider` | nombra entidad nueva autónoma | **PREGUNTA NUEVA** |

**Cómo los separo:** el refinamiento es ELÍPTICO (arranca con "y"/"solo"/un cuantificador suelto, sin un intent autónomo) **Y** hay un `lastRetrievalContext` fresco. Si la frase es una pregunta completa por sí sola (nombra dimensión: "por familia/cliente/marca"), es nueva. Un solo detector `_detectRefinement(text, ctx)` al tope, disjunto de los detectores autónomos.

---

## 4 · Respeta TODA la red ya construida (no la contradice · se apoya en ella)
- **Freshness (2.2a):** el `lastRetrievalContext` solo se usa si es del turno inmediato anterior (`turn === turnCount`, gemelo del age-check de listas). Stale → no refina.
- **Descarte por topic-change (2.2a-2):** el `_detectTopicChange` cleanup (answerADI 465-468) **también limpia `lastRetrievalContext`** (`ctx.lastRetrievalContext = null`). Cambio de tema → el refinamiento se descarta.
- **Prioridad del spine (2.2b):** `_resolvePending` corre ANTES; si hay un `pendingSpineDecision` fresco, el spine gana (el refinamiento corre después).
- **Anti-fuga (2.2a · el RED gate de 2.2c-3):** la **slice no conoce el dominio hoy** (`applyQuantifierSlice` solo recibe la lista). 2.2c-3 le pasa el `domain` (de `lastRetrievalContext`): si la vista previa era **inventario** → "los tres peores" **AVISA** (no corta a rotación/capital). Esto **2.2a ya lo cierra**; 2.2c-3 NO lo puede reabrir — compone con el mismo Availability Map.

---

## 5 · El oráculo (cadenas encadenadas reales + controles ROJOS)
**Refinamientos (gates):**
- `ventas por cliente de Samsung` → `y por margen` → margen por cliente de Samsung (mantiene Samsung+cliente).
- `ventas por cliente` → `solo Bosch` → re-filtra a Bosch.
- `ventas por cliente` → `los tres peores` → los 3 peores clientes (comercial).

**Controles ROJOS (los candados):**
- **pregunta nueva NO es refinamiento:** `ventas por cliente de Samsung` → `ventas por familia` → retrieval NUEVO (familia), NO "ventas por familia de Samsung" inventado.
- **refinamiento tras topic-change se descarta:** `ventas por cliente de Samsung` → `cómo va el negocio` → `y por margen` → margen GLOBAL (no resucita Samsung).
- **🚨 corte tras inventario sigue AVISANDO:** `SKUs por rotación` → `los tres peores` → **AVISA, cero rotación/capital** (compone con 2.2a · el refinamiento no reabre la fuga).
- **refinamiento sin vista previa fresca:** `y por margen` en sesión fresca → pregunta nueva (no inventa refinamiento).

---

## 6 · El blindaje (single-turn byte-idéntico · shadow-diff)
- **Single-turn byte-idéntico (el más importante):** `lastRetrievalContext` solo se escribe/lee en multi-turno; sesión fresca (los 47 + canónica + extendida · sin contexto previo) → no dispara → **piso byte-exacto OFF y ON**. (2.2c-1 valida corpus-safe que `_qiContext` no ensombrezca.)
- **Shadow-diff por sub-ladrillo:** flag ON vs OFF → solo cambian las cadenas de refinamiento de ese sub-ladrillo; el turno 1 (el retrieval/inventario) + las preguntas nuevas + lo demás byte-idéntico.
- **Compone con la red:** el oráculo corre también con 2.2a/2.2a-2/2.2b ON → los candados se respetan.

---

## 7 · Flags · Blast radius (por sub-ladrillo)
- **Flags:** `ADI_MT_REFINE_METRIC_ENABLED` (2.2c-1) · `ADI_MT_REFINE_FILTER_ENABLED` (2.2c-2) · `ADI_MT_REFINE_SLICE_ENABLED` (2.2c-3). **Default OFF.**
- **Blast radius 2.2c-1:** `composeRetrieval` (retorna `_qiContext`) + `_plainWrap`/`_threadContext` (escribe `lastRetrievalContext`) + topic-change cleanup (lo limpia) + `_detectRefinement` (helper) + el recomposer de métrica + 1 wire al tope. **2.2c-2:** el recomposer de filtro (reusa el spine filter). **2.2c-3:** el `domain` a `applyQuantifierSlice` + el guard de inventario (compone con 2.2a). Flag OFF cada uno → byte-idéntico.

---

## 8 · Reporte crítico — dónde será frágil
1. **Romper el single-turn (riesgo CENTRAL).** El refinamiento solo vive en multi-turno; sin `lastRetrievalContext` fresco no dispara. Mitigación: piso byte-exacto single-turn + el corpus-safe de `_qiContext` (que no toque el texto del retrieval).
2. **El refinamiento que pisa una pregunta nueva (la trampa).** "ventas por familia" tratado como refinamiento de Samsung. Mitigación: el criterio elíptico-vs-autónomo (nombra dimensión completa = nueva) + el control ROJO.
3. **🚨 Reabrir la fuga de inventario por la slice (2.2c-3, SEGURIDAD).** "los tres peores" cortando una lista de inventario. Mitigación: pasarle el `domain` a la slice + el guard del Availability Map (compone con 2.2a, no duplica) + el control ROJO como gate.
4. **El `_qiContext` ensombreciendo el retrieval (2.2c-1).** Si agregar el campo cambia el texto. Mitigación: es metadata (como `_pending` de 2.2b), invisible al texto; el corpus-safe 47 lo prueba.
5. **Coordinación de los 3 detectores.** Métrica vs filtro vs corte vs autónomo. Mitigación: jerarquía única en `_detectRefinement` (reutiliza-contexto → refinamiento; nombra-dimensión-completa → nueva).
6. **El tamaño.** Es el más grande. Si 2.2c-1 (la base + la trampa) crece al diseñarlo en detalle, **freno y propongo más split** (timón #2).

---

## 9 · Para aprobar
1. ¿El **split** en 2.2c-1 (mecanismo + métrica) / 2.2c-2 (filtro) / 2.2c-3 (corte + anti-fuga)?
2. ¿El **orden** 2.2c-1 → 2.2c-2 → 2.2c-3?
3. ¿Arranco con el **plano detallado + red-team de 2.2c-1** (el mecanismo `lastRetrievalContext` + el detector elíptico-vs-autónomo + el refinamiento de métrica) como primer sub-ladrillo?

Con eso aprobado traigo el plano detallado de 2.2c-1, lo aprobás, y recién ahí construyo. **No toqué `src/` — plano puro.**
