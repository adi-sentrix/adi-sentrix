# Fase 2.2b — Los follow-ups del spine (resolver ACLARAR + elección tras AVISAR combinado) · Plano + Red-team

> Segundo ladrillo de la Fase 2.2, sobre piso limpio (la red de seguridad 2.2a/2.2a-2 ya está). Acá ADI
> empieza a seguir el hilo de verdad: cuando el spine PREGUNTA (ACLARAR) u OFRECE (AVISAR combinado), el
> turno siguiente puede responder suelto ("margen", "el detalle de Falabella") y ADI lo resuelve recordando.
> Plano puro — se aprueba y recién ahí se construye. Flag default OFF.

---

## 0 · LECTURA DE TAMAÑO
2.2b es **MEDIO** (~60 líneas). Tres piezas: el **mecanismo** del contexto pendiente (compartido) + dos **resoluciones** (ACLARAR y combinado) que se apoyan en él.

| Pieza | Qué hace | Tamaño | Riesgo |
|---|---|:--:|:--:|
| Mecanismo `pendingSpineDecision` | el spine escribe el pendiente vía `_plainWrap` · N+1 lo lee con freshness + descarte por topic-change | Chica-media | Medio (toca `_plainWrap` + tope de answerADI) |
| Resolver ACLARAR | "margen" suelto → recompone "el peor SKU de Bosch en margen" y reusa el spine | Chica | Bajo (reusa `resolveFilteredRetrieval`) |
| Resolver combinado | "el detalle de Falabella" → client_dive · "Samsung sola" → filtro marca | Chica-media | Medio (detección de la elección puede crecer) |

**Mi lean: ENTERO** — el mecanismo es compartido (partirlo duplicaría infraestructura), y las dos resoluciones son chicas una vez que existe. Orden de construcción: **mecanismo + ACLARAR primero** (el caso primario, valida el lifecycle del pendiente) → **combinado después**. **El escape:** si la detección de la elección del combinado ("el detalle de X" vs "X sola" vs fraseos varios) crece más de lo previsto, **freno y propongo 2.2b-2** (timón #2). **Flag:** `ADI_MT_SPINE_FOLLOWUP_ENABLED` (compone con `ADI_SPINE_FILTER_CLARIFY_ENABLED` para ACLARAR y `ADI_SPINE_COMBINED_ENABLED` para combinado).

---

## 1 · El alcance (los casos)
- **A · Resolver el ACLARAR:** `el mejor SKU de Bosch` → ADI `¿en qué: ventas, margen o contribución?` → usuario `margen` (suelto) → ADI `BOS-SANDER…` (recordando Bosch + SKU + superlativo "mejor").
- **B · Resolver la elección tras AVISAR combinado:** `ventas de Samsung en Falabella` → ADI `Samsung sola, o el detalle de Falabella. ¿Cuál?` → usuario `el detalle de Falabella` → ADI client_dive de Falabella.

---

## 2 · El mecanismo — el spine escribe el pendiente, N+1 lo consume (anclado)
**Hoy:** `_plainWrap` es wrap LIMPIO (`context: {...ctx, turnCount+1}`) — no hila contexto. Las ramas del spine (`spine_filter_clarify` L205-208, `spine_filter_combinado_avisar` L172-174) no escriben nada para el turno siguiente.

**2.2b agrega:**
1. **El spine adjunta `_pending`** a su respuesta cuando ACLARA u OFRECE:
   - ACLARAR → `_pending = { kind:"clarify", filterValue, filterAxis, dimension:dimKey, direction, pendingMetrics:_ms, turn }`.
   - Combinado → `_pending = { kind:"combined", filterValue, filterAxis, specificClient, turn }` (option1 = filtro marca sola · option2 = detalle del cliente).
2. **`_plainWrap` lo escribe** al contexto: `context: { ...ctx, turnCount+1, pendingSpineDecision: resp._pending || null }`. Como SIEMPRE setea el campo (a `null` si no hay `_pending`), un `_plainWrap` posterior sin pendiente lo LIMPIA → el pendiente vive un solo turno por construcción.
3. **N+1 lo consume al TOPE de answerADI** (`_resolvePending`, ANTES de que el spine re-detecte y antes de detectIntent):
   - ACLARAR fresco + el usuario tipeó una métrica-eje de `pendingMetrics` → recompone `"{dir} {dim} de {filterValue} en {métrica}"` y **reusa `resolveFilteredRetrieval`** → la respuesta sellada (cero recálculo nuevo).
   - Combinado fresco + el usuario eligió → "el detalle de {specificClient}"/"{cliente}" → client_dive · "{filterValue} sola"/"la marca" → filtro marca. 

---

## 3 · La trampa — el pendiente respeta la red de 2.2a/2.2a-2 (no la contradice)
**Reglas duras del lifecycle del pendiente:**
- **Freshness (apoyado en 2.2a):** el pendiente solo se consume si es del **turno inmediato anterior** (`pendingSpineDecision.turn === ctx.turnCount`, espejo del age-check de listas). Un pendiente viejo → ignorado.
- **Descarte por topic-change (apoyado en 2.2a-2):** si entre el ACLARAR y la respuesta el usuario **cambia de tema** (`_detectTopicChange`, o nombra otra entidad/módulo, o hace una pregunta completa nueva) → el pendiente se **descarta, no se fuerza**. La pregunta nueva gana.
- **Continuación SOLO con pendiente activo:** una respuesta suelta ("margen") se interpreta como continuación **únicamente si hay un pendiente fresco**. Sin pendiente → "margen" es **pregunta nueva** (lo que hace hoy), NO se inventa una continuación.
- **Respeta el muro (regla madre):** las métricas del ACLARAR son ejes del Semantic Layer (ventas/margen/contribución · NUNCA inventario); el combinado resuelve a client_dive/filtro marca (comercial). Cero superficie de fuga.

---

## 4 · El oráculo (cadenas encadenadas reales + controles)
**A · ACLARAR → respuesta:**
- `el mejor SKU de Bosch` → [ACLARA] → `margen` → BOS-SANDER (mejor margen de Bosch).
- `el peor SKU de LG` → [ACLARA] → `contribución` → resuelve recordando LG+SKU+peor.

**B · combinado → elección:**
- `ventas de Samsung en Falabella` → [AVISA combinado] → `el detalle de Falabella` → client_dive Falabella.
- `margen de Bosch para Lider` → [AVISA] → `Bosch sola` → filtro marca Bosch.

**Controles (gates ROJOS · NO inventar continuación):**
- `margen` SUELTO sin pendiente (sesión fresca) → pregunta nueva (lo de hoy · NO recompone un ACLARAR fantasma).
- ACLARAR → (cambia de tema) `cómo va el negocio` → panorama limpio, el pendiente se descarta · y un `margen` posterior NO resucita el ACLARAR viejo.
- ACLARAR → `el mejor SKU de Samsung` (otra marca) → pregunta nueva (no la mezcla con Bosch).

---

## 5 · El blindaje (single-turn byte-idéntico · shadow-diff)
- **Single-turn byte-idéntico (el más importante):** `_resolvePending` solo dispara con un `pendingSpineDecision` fresco en el contexto. Sesión fresca (los 47 + canónica + extendida · sin pendiente) → no dispara → **piso byte-exacto OFF y ON**.
- **Shadow-diff:** flag ON vs OFF → solo cambian las CADENAS de ACLARAR-resuelto y combinado-resuelto; todo lo demás (incluido el ACLARAR/AVISAR del turno 1, que ya existe en 2.1) byte-idéntico.
- **Compone con la red:** el oráculo corre también con 2.2a/2.2a-2 ON → el pendiente respeta la limpieza (cadena topic-change descarta el pendiente).

---

## 6 · Flags · Blast radius
- **Flag:** `ADI_MT_SPINE_FOLLOWUP_ENABLED` (default OFF). Compone con `ADI_CORE_SPINE_ENABLED` + `ADI_SPINE_FILTER_CLARIFY_ENABLED`/`ADI_SPINE_COMBINED_ENABLED` (el ACLARAR/AVISAR del turno 1 los necesita).
- **Blast radius:** spine.js (las 2 ramas adjuntan `_pending`) + `_plainWrap` (escribe `pendingSpineDecision`) + `_resolvePending` (helper nuevo) + 1 wire al tope de answerADI. Flag OFF → `_plainWrap` no escribe el campo, `_resolvePending` no corre → comportamiento de 2.1/2.2a/2.2a-2 byte-idéntico.

---

## 7 · Reporte crítico — dónde será frágil
1. **Romper el single-turn (riesgo CENTRAL).** El pendiente solo vive en multi-turno; sin pendiente fresco no dispara. Mitigación: el piso byte-exacto single-turn como prueba dura; flag OFF deja todo como hoy.
2. **La respuesta suelta mal interpretada.** "margen" como continuación cuando NO debía (sin pendiente fresco, o tras topic-change). Mitigación: continuación SOLO con pendiente fresco + descarte por topic-change (reusa 2.2a-2) + el control "margen sin pendiente → pregunta nueva".
3. **El pendiente que sobrevive de más.** Si `_plainWrap` no limpia el campo, un pendiente viejo contamina. Mitigación: `_plainWrap` SIEMPRE setea `pendingSpineDecision` (a null si no hay) + la freshness (`turn === turnCount`) lo hace inerte tras un turno.
4. **La detección de la elección del combinado crece.** "el detalle de Falabella" vs "Falabella" vs "el cliente" vs "Samsung sola" vs "la marca"… Mitigación: arranco con el léxico del oráculo; si crece, timón #2 → 2.2b-2. Lo declaro de antemano.
5. **El orden con detectIntent.** `_resolvePending` debe correr ANTES de que detectIntent/el spine re-detecten "margen". Mitigación: wire al TOPE de answerADI (después del topic-change cleanup, antes del spine).
6. **Coexistencia con la limpieza de foco (2.2a-2).** El topic-change cleanup limpia el foco de CLIENTE; el pendiente es del SPINE (filtro/superlativo). Son campos distintos — pero el pendiente debe descartarse en el MISMO trigger de topic-change. Mitigación: `_resolvePending` consulta `_detectTopicChange` y cede.

---

## 8 · Para aprobar
1. ¿2.2b **entero** (mecanismo + ACLARAR + combinado, sub-paso ACLARAR primero) o partido? — mi lean: entero.
2. ¿La **conducta nueva** (timón #1): una respuesta suelta tras un ACLARAR/AVISAR ahora continúa el hilo del spine?
3. ¿La **forma del pendiente** (`pendingSpineDecision` con kind/filterValue/filterAxis/dimension/direction/pendingMetrics/specificClient/turn), escrito por `_plainWrap`, leído al tope con freshness + descarte por topic-change?

Con tu OK construyo (ACLARAR primero, después combinado), corro todas las pruebas (los gates ROJOS de control + single-turn byte-idéntico + shadow-diff + combinado con la red 2.2a/2.2a-2), dejo el flag OFF y reporto. **No toqué `src/` — plano puro.**
