# Fase 2.2c-2 — Refinamiento de FILTRO ("solo Bosch") · Plano + Red-team

> Segundo sub-ladrillo de 2.2c. Reusa el mecanismo `lastRetrievalContext` (construido y validado en 2.2c-1):
> "ventas por cliente" → "solo Bosch" → re-filtra la vista anterior a Bosch (cambia el FILTRO del spec,
> mantiene métrica y dimensión). Plano puro — se aprueba y recién ahí se construye. Flag default OFF.

---

## 0 · LECTURA DE TAMAÑO → va ENTERO
**2.2c-2 es MEDIO, más chico que 2.2c-1** (que ya pasó verde). **Reusa el mecanismo `lastRetrievalContext` + el recompose ya construidos** — lo único nuevo es el detector de filtro ("solo Bosch") y cambiar QUÉ parte del spec se modifica (el filtro en vez de la métrica). **Va ENTERO.** El escape: si el detector de filtro crece (más fraseos de los previstos), timón #2. Flag `ADI_MT_REFINE_FILTER_ENABLED` default OFF.

---

## 1 · El alcance
`ventas por cliente` → `solo Bosch` → "ventas por cliente de Bosch" (re-filtra a Bosch, mantiene métrica ventas + dimensión cliente). Reusa el mismo `lastRetrievalContext` de 2.2c-1: cambia `filterValue`, recompone, reusa el pipeline.

---

## 2 · El mecanismo (reusa 2.2c-1 · cambia el filtro en vez de la métrica)
**Ya existe** (2.2c-1): `composeRetrieval` retorna `_qiContext={metric,dimension,filterValue,domain}` → `_threadContext` lo escribe como `lastRetrievalContext` estampado con turn → topic-change lo limpia.

**2.2c-2 agrega `_detectFilterRefinement(text, ctx, scenario)`** (gemelo de `_detectMetricRefinement`): cambia el `filterValue` al nuevo (Bosch) y recompone `${lrc.metric} por ${lrc.dimension} de ${newFilter}` → `queryInterpreter`+`composeRetrieval` (cero recálculo nuevo). **El QI filter decide la aplicabilidad** (responde si el cruce es válido — ej. "ventas por SKU de Bosch"; AVISA si es decorativo — ej. marca×cliente, que 2.1c ya maneja). 2.2c-2 NO reinventa eso, lo reusa.

---

## 3 · El discriminador (misma lógica que 2.2c-1)
**El refinamiento de filtro es ELÍPTICO:** "solo"/"y" + una marca/familia nombrada (sin métrica ni dimensión nueva). Una pregunta que nombra todo de nuevo es AUTÓNOMA.

| Entrada (tras "ventas por cliente") | Análisis | Acción |
|---|---|---|
| `solo Bosch` | "solo" + marca, SIN métrica/dim nueva | **REFINA** (filtra a Bosch) |
| `y Bosch` / `y LG` | "y" + marca | **REFINA** |
| `solo la familia Electrodomésticos` | "solo" + familia | **REFINA** (filtro de familia) |
| `ventas de Bosch por familia` | nombra DIMENSIÓN (familia) | **PREGUNTA NUEVA** (autónoma) |
| `Bosch` a secas | marca SIN "solo"/"y" elíptico | **PREGUNTA NUEVA** (no es refinamiento · cae a brand_dive/viejo) |
| `cómo está Bosch` | query completa autónoma | **PREGUNTA NUEVA** |

**`_detectFilterRefinement`:** (1) requiere `lastRetrievalContext` fresco; (2) detecta marca/familia (`detectBrandInText`/`detectAllFamiliesInText` strict) + señal elíptica ("solo"/"y"/"solamente"); (3) si nombra una DIMENSIÓN o métrica nueva → null (autónoma); (4) si no → recompone con el filtro nuevo.

---

## 4 · Coordinación con lo ya construido (el orden de prioridad · que no se pisen)
Orden al TOPE de answerADI (cada uno disjunto del anterior):
1. **`_resolvePending` (2.2b)** — el spine pending gana (un ACLARAR fresco es lo más específico).
2. **topic-change cleanup (2.2a-2)** — limpia el foco + `lastRetrievalContext`.
3. **`_detectMetricRefinement` (2.2c-1)** — refina si es métrica-eje elíptica.
4. **`_detectFilterRefinement` (2.2c-2)** — refina si es marca/familia elíptica.
**Disjuntos:** c-1 detecta una MÉTRICA (ventas/margen/contribución); c-2 detecta una MARCA/FAMILIA. "solo Bosch" no es una métrica → c-1 da null → c-2 lo agarra. "y por margen" no es una marca → c-2 da null. No se pisan. (El orden c-1 antes de c-2 es indiferente por ser disjuntos.)

---

## 5 · Respeta la red (freshness + anti-fuga)
- **Freshness (2.2a):** `lastRetrievalContext.turn === turnCount`. Stale → no refina.
- **Topic-change (2.2a-2):** ya limpia `lastRetrievalContext` → el refinamiento de filtro se descarta tras cambio de tema.
- **🚨 Anti-fuga (el gate de seguridad):** un "solo Bosch" sobre una vista de **INVENTARIO** NO puede surfacear rotación/capital. **Doble red:** (a) con el muro activo (QI_FILTER) la vista de inventario AVISA en turno 1 → no escribe `lastRetrievalContext` → no hay base para refinar; (b) belt-and-suspenders: `_detectFilterRefinement` chequea `lastRetrievalContext.domain === "inventario"` → AVISA (`unavailableMessage`, compone con el Availability Map de 2.2a) en vez de recomponer. **El refinamiento NO reabre la fuga.**

---

## 6 · El oráculo (cadenas reales + controles ROJOS)
**Refinamiento (gate):**
- `ventas por SKU` → `solo Bosch` → "ventas por SKU de Bosch" (re-filtra, mantiene ventas+SKU).
- `ventas por cliente` → `solo Bosch` → AVISA/ACLARA (cruce marca×cliente decorativo · lo reusa de 2.1c).

**Controles ROJOS (el discriminador):**
- **pregunta nueva NO es refinamiento:** `ventas por cliente` → `ventas de Bosch por familia` → retrieval nuevo (familia), NO refina.
- **marca a secas no es refinamiento:** `ventas por cliente` → `Bosch` → pregunta nueva (brand_dive/viejo), NO re-filtra silenciosamente.
- **refinamiento tras topic-change se descarta:** `ventas por cliente` → `cómo va el negocio` → `solo Bosch` → no resucita la vista vieja.
- **🚨 anti-fuga:** `SKUs por rotación` → `solo Bosch` → AVISA (cero rotación/capital · no reabre la fuga).
- **sin vista fresca:** `solo Bosch` en sesión fresca → pregunta nueva.
- **coord 2.2b:** `el mejor SKU de Bosch` → [ACLARA] → (una respuesta) → el spine pending gana primero.

---

## 7 · El blindaje (single-turn byte-idéntico · shadow-diff)
- **Single-turn byte-idéntico (el más importante):** el refinamiento de filtro solo vive con `lastRetrievalContext` fresco; sesión fresca (los 47 + canónica + extendida) → no dispara → **piso byte-exacto OFF y ON**.
- **Shadow-diff:** flag ON vs OFF → solo cambian las cadenas de refinamiento de filtro; el turno 1 + las preguntas nuevas + lo demás byte-idéntico.
- **Compone con la red:** el oráculo corre con 2.2a/2.2a-2/2.2b/2.2c-1 ON → los candados + la coordinación.

---

## 8 · Flags · Blast radius
- **Flag:** `ADI_MT_REFINE_FILTER_ENABLED` (default OFF).
- **Blast radius:** `_detectFilterRefinement` (helper nuevo · gemelo de `_detectMetricRefinement`) + 1 wire al tope (después de 2.2c-1). Reusa el `lastRetrievalContext` (cero cambio en composeRetrieval/_threadContext). Flag OFF → el detector no corre → byte-idéntico.

---

## 9 · Reporte crítico — dónde será frágil
1. **Romper el single-turn (riesgo CENTRAL).** El refinamiento solo vive con vista fresca. Mitigación: piso byte-exacto single-turn.
2. **El refinamiento que pisa una pregunta nueva.** "ventas de Bosch por familia" tratado como filtro de la vista vieja. Mitigación: el discriminador (nombra dimensión/métrica nueva → autónoma) + el control ROJO.
3. **🚨 Reabrir la fuga de inventario (SEGURIDAD).** "solo Bosch" sobre inventario. Mitigación: doble red (el muro bloquea la base + el `domain==="inventario"` AVISA) + el control ROJO como gate.
4. **La marca a secas ("Bosch") ambigua** (brand_dive vs filtro). Mitigación: requerir señal elíptica explícita ("solo"/"y") → "Bosch" a secas NO es refinamiento (conservador).
5. **El empate con c-1.** Si una frase tuviera marca Y métrica. Mitigación: disjuntos por tipo; si ambos matchean (raro), el orden decide (c-1 primero). Lo verifico en el shadow.
6. **El tamaño.** Si el detector de filtro crece, timón #2.

---

## 10 · Para aprobar
1. ¿2.2c-2 **entero** (reusa el mecanismo de c-1 + el detector de filtro)?
2. ¿La **conducta nueva** (timón #1): "solo Bosch" tras un retrieval re-filtra la vista?
3. ¿El **discriminador** ("solo"/"y" + marca/familia elíptica → refina; nombra dimensión/métrica nueva o marca a secas → pregunta nueva) + la **prioridad** (2.2b > c-1 > c-2) + el **anti-fuga** (inventario → AVISA)?

Con tu OK construyo, corro todas las pruebas (los controles ROJOS + el anti-fuga + single-turn byte-idéntico + shadow-diff + el combinado), dejo el flag OFF, limpio tareas colgadas, y reporto. **No toqué `src/` — plano puro.**
