# Fase 2.2c-3 — Refinamiento de CORTE ("los tres peores" / "el top 3") + anti-fuga · Plano + Red-team

> El ÚLTIMO ladrillo de la Etapa 2. "los tres peores" / "el top 3" / "los dos mejores" → acota la vista
> anterior al corte pedido, reusando el lastRetrievalContext (cambia el límite/orden, mantiene métrica,
> dimensión y filtro). El RED gate es el anti-fuga — el caso original que abrió toda la red (2.2a).
> Plano puro — se aprueba y recién ahí se construye. Flag default OFF.

---

## 0 · LECTURA DE TAMAÑO → MEDIO-GRANDE, va ENTERO (con una nota honesta)
Reusa el mecanismo `lastRetrievalContext` (construido en 2.2c-1). Lo nuevo: el detector de cuantificador + el corte. **Nota honesta sobre el render:** `composeRetrieval` solo ordena DESC + slice top N (L862-864), **no tiene ASC** → "el top 3" reusa el pipeline limpio, pero **"los N peores" (bottom N) NO** lo reusa directo. Por eso el corte guarda el resultado ordenado en el `lastRetrievalContext` y rebana arriba/abajo + renderiza (cero recálculo). Esa pieza del render es la de riesgo.

| Pieza | Tamaño | Riesgo |
|---|:--:|:--:|
| Detector de cuantificador (elíptico vs autónomo) | Chico | Bajo (misma línea que c-1/c-2) |
| El corte top/bottom N + render (one-liner del ranking guardado) | Medio | Medio (el "peores"/render) |
| **🚨 Anti-fuga (el RED gate)** | — | **ALTO** (el corazón de seguridad · se apoya en 2.2a) |

**Mi lean: ENTERO** (reusa el mecanismo; el detector + el corte son acotados). **El escape:** si el render del corte crece (querés la tabla sliceada byte-fiel en vez de un one-liner, o el "peores" se enreda), **freno y propongo partirlo** (timón #2 · ej. 2.2c-3a "top N" reusa composeRetrieval · 2.2c-3b "peores"). Flag `ADI_MT_REFINE_CUT_ENABLED` default OFF.

---

## 1 · El alcance
`ventas por cliente de Samsung` → `los tres peores` → los 3 peores clientes (Samsung-filtrados), manteniendo métrica ventas + dimensión cliente + filtro Samsung. Igual con `el top 3` / `los dos mejores`.

---

## 2 · El mecanismo (reusa 2.2c-1 · cambia el corte/orden)
**Ya existe:** `lastRetrievalContext = {metric, dimension, filterValue, domain, turn}`.

**2.2c-3 agrega:**
1. **`composeRetrieval` guarda también el resultado ordenado** en `_qiContext.ranking = materialMetrics` (la lista `{entity, value}` DESC ya computada · cero recálculo · metadata).
2. **`_detectCutRefinement(text, ctx)`:** parsea el cuantificador (N + dirección) de "los tres peores"/"el top 3" → rebana `lastRetrievalContext.ranking`: top N = `slice(0,N)`, peores N = `slice(-N)` → renderiza un one-liner ("Los 3 peores en ventas de Samsung: Paris $X, Hites $Y, La Polar $Z"). Cero recálculo (reusa los valores ya formateados).
   - "el top N" alternativamente reusa el pipeline (`top N {dim} por {metric} {filtro}` → queryInterpreter+composeRetrieval); "los N peores" rebana el ranking guardado (composeRetrieval no hace ASC). **El render exacto (one-liner vs tabla sliceada) se confirma al construir** — si crece, timón #2.

---

## 3 · El discriminador (misma línea que c-1/c-2) + los casos límite
**Un cuantificador de corte ELÍPTICO** ("los tres peores"/"el top 5"/"los dos mejores") sobre una vista fresca, **SIN nombrar dimensión/métrica/filtro nuevo** → refina. Una pregunta autónoma → nueva.

| Entrada (tras "ventas por cliente de Samsung") | Análisis | Acción |
|---|---|---|
| `los tres peores` / `el top 3` / `los dos mejores` | cuantificador suelto | **REFINA** (corta la vista) |
| `los tres peores SKU de Bosch` | nombra DIMENSIÓN (SKU) **Y** filtro (Bosch) | **PREGUNTA NUEVA** (autónoma, self-contained) |
| `dame menos` / `muéstrame más` | sin N explícito (corte relativo vago) | **PREGUNTA NUEVA** (conservador · no adivina el delta) |
| `los tres peores clientes` | nombra la dimensión (cliente) que YA era la vista | **borde:** lo trato como autónomo (nombra dimensión · misma regla c-1/c-2) |

**`_detectCutRefinement`:** (1) requiere `lastRetrievalContext` fresco; (2) si nombra dimensión/métrica/marca nueva → null (autónoma); (3) si es un cuantificador de corte con N explícito → rebana; (4) si no → null.

---

## 4 · Coordinación con TODO lo construido (el orden completo · que ninguno se pise)
Orden al TOPE de answerADI (cada uno disjunto):
1. **`_resolvePending` (2.2b)** — spine pending gana.
2. **topic-change cleanup (2.2a-2)** — limpia foco + `lastRetrievalContext`.
3. **`_detectMetricRefinement` (c-1)** — métrica.
4. **`_detectFilterRefinement` (c-2)** — marca/familia.
5. **`_detectCutRefinement` (c-3)** — cuantificador.
**Disjuntos:** c-1=métrica, c-2=marca, c-3=cuantificador. "los tres peores" no es métrica ni marca → c-1/c-2 dan null → c-3 lo agarra. Va en el mismo bloque unificado (la limpieza de `lastRetrievalContext` al FINAL, tras los tres detectores).

---

## 5 · 🚨 EL ANTI-FUGA (el RED gate · el corazón de seguridad · se apoya en 2.2a)
**"los tres peores" tras una vista de INVENTARIO sigue AVISANDO, cero número.** Es el caso original que abrió toda la red (2.2a). **El corte NO lo reabre, y se apoya en 2.2a:**
- **Doble red, igual que c-2:** (a) las queries de inventario rutean a `sku_operational` (NO qi_retrieval) → **no escriben `lastRetrievalContext`** → el corte NO se activa → "los tres peores" cae a la **continuación ECL-CONT de 2.2a** (`composeSkuDevelopment` → guard `isAvailable("inventario")` → **AVISA**). (b) belt-and-suspenders: `_detectCutRefinement` chequea `lastRetrievalContext.domain === "inventario"` → AVISA.
- **El corte es inherentemente comercial** (solo opera sobre rankings comerciales del `qi_retrieval`). Compone con MT_SAFETY (2.2a) — el RED gate corre con 2.2a ON.

---

## 6 · El oráculo (cadenas reales + controles ROJOS)
**Corte (gate):**
- `ventas por cliente de Samsung` → `los tres peores` → los 3 peores clientes (Samsung).
- `ventas por cliente` → `el top 3` → los 3 mejores · `los dos mejores` → top 2.
- Cadena: `ventas por cliente de Samsung` → `y por margen` (c-1) → `los tres peores` (c-3) → los 3 peores por margen de Samsung (refinamientos encadenados).

**Controles ROJOS:**
- pregunta nueva NO es corte: `los tres peores SKU de Bosch` → retrieval nuevo (no corta la vista de Samsung).
- corte tras topic-change se descarta · sin vista fresca → nueva.
- vago: `dame menos` → no corta (conservador).
- **🚨 ANTI-FUGA (el RED gate):** `SKUs por rotación` → `los tres peores` → **AVISA, cero rotación/capital** (vía 2.2a · el corte no se activa, no reabre la fuga).

---

## 7 · El blindaje (single-turn byte-idéntico · shadow-diff)
- **Single-turn byte-idéntico (el más importante):** el corte solo vive con `lastRetrievalContext` fresco; sesión fresca (los 47 + canónica + extendida) → no dispara → **piso byte-exacto OFF y ON**. El `_qiContext.ranking` es metadata (invisible al texto).
- **Shadow-diff:** flag ON vs OFF → solo cambian las cadenas de corte; el turno 1 + las preguntas nuevas + lo demás byte-idéntico.
- **Compone con la red:** el oráculo corre con 2.2a/2.2a-2/2.2b/2.2c-1/c-2 ON → los candados + el anti-fuga (2.2a) + la coordinación.

---

## 8 · Flags · Blast radius
- **Flag:** `ADI_MT_REFINE_CUT_ENABLED` (default OFF).
- **Blast radius:** `composeRetrieval` (`_qiContext.ranking` · metadata) + `_detectCutRefinement` (helper nuevo, en el bloque unificado de 2.2c) + el render del corte. Reusa `lastRetrievalContext`. Flag OFF → el detector no corre, `ranking` no se usa → byte-idéntico.

---

## 9 · Reporte crítico — dónde será frágil
1. **Romper el single-turn (riesgo CENTRAL).** El corte solo vive con vista fresca. Mitigación: piso byte-exacto single-turn + el `_qiContext.ranking` corpus-safe.
2. **🚨 Reabrir la fuga de inventario (SEGURIDAD · el RED gate).** "los tres peores" sobre inventario. Mitigación: doble red (sku_operational no escribe lastRetrievalContext → cae a 2.2a que AVISA + el domain-check) + el RED gate como prueba dura, con MT_SAFETY ON.
3. **El render del "peores" (bottom N).** composeRetrieval no hace ASC → rebano el ranking guardado. Si el render (one-liner vs tabla sliceada) crece, timón #2.
4. **El cuantificador mal parseado.** "los tres peores" vs "los tres peores SKU de Bosch" (autónoma). Mitigación: el discriminador (nombra dimensión → autónoma) + los controles.
5. **El vago ("dame menos").** Mitigación: requerir N explícito → no adivina (conservador).
6. **El tamaño.** Si el corte + el render crecen, timón #2 → split (3a top N / 3b peores).

---

## 10 · Para aprobar
1. ¿2.2c-3 **entero** (cuantificador + corte top/bottom + anti-fuga)?
2. ¿La **conducta nueva** (timón #1): "los tres peores" tras un retrieval acota la vista?
3. ¿El **discriminador** (cuantificador elíptico → corta; nombra dimensión / vago → nueva) + la **prioridad** (2.2b > topic-change > c-1 > c-2 > c-3) + el **anti-fuga** (inventario → AVISA vía 2.2a)?
4. ¿El **render** del corte como one-liner del ranking guardado (vs tabla sliceada)? — si preferís la tabla, lo digo en el reporte y puede ser timón #2.

Con tu OK construyo, corro todas las pruebas (**sobre todo el RED gate anti-fuga**, con MT_SAFETY ON + el oráculo de inventario), dejo el flag OFF, limpio tareas colgadas, y reporto. **No toqué `src/` — plano puro.**
