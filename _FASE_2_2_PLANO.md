# Fase 2.2 — Conversación real (multi-turno) · Plano + Red-team + Lectura de tamaño

> ADI conversa: el hilo se mantiene (continúa lo anterior cuando corresponde), se limpia (no arrastra
> fantasmas), y respeta el muro de inventario igual que el single-turn. Plano puro — se aprueba el split
> y el orden, y recién ahí se construye sub-ladrillo por sub-ladrillo. Flags default OFF.

---

## 0 · LECTURA DE TAMAÑO (lo que pediste primero) → RECOMIENDO PARTIR

**2.2 es la pieza más grande de todo ADI Core hasta ahora.** Toca 4 concerns distintos, con riesgos distintos, sobre código multi-turno YA committeado (la cascada ECL-CONT del [5], los deícticos, el threading). Meterlo de un saque es exactamente lo que el método dice no hacer.

**Recomiendo partirla en 3 sub-ladrillos** (el owner decide):

| Sub-ladrillo | Qué cierra | Tamaño | Riesgo | Por qué |
|---|---|:--:|:--:|---|
| **2.2a · Red de seguridad** (anti-fuga + anti-contaminación) | El leak de inventario por ECL-CONT ("los tres peores") + el arrastre indebido (fantasmas) | Medio | **ALTO** | Toca `eclCont`/`_threadContext` committeados; es SEGURIDAD → va **primero** (los otros construyen memoria encima de un piso limpio) |
| **2.2b · Resolver ACLARAR + AVISAR combinado** | Los follow-ups del spine ("¿en qué?"→"margen"; "Samsung en Falabella"→"el detalle de Falabella") | Medio | Medio | Conducta NUEVA sobre el spine (no toca lo viejo); guarda un "contexto pendiente" |
| **2.2c · Refinamiento deíctico** | "y por margen" · "solo Bosch" · "los tres peores" (continuar el resultado previo) | **Grande** | **ALTO** | Toca deícticos/composers committeados; el más enredado |

**Orden:** 2.2a (seguridad) → 2.2b (spine, bajo riesgo) → 2.2c (deíctico, el más duro). **Cada sub-ladrillo trae su propio plano + red-team detallado al llegar** (como 2.1a→d). Este plano es el mapa de la fase + el split.

---

## 1 · El alcance (los casos declarados "pendiente 2.2")
- **A · Resolver el ACLARAR (2.2b):** "el mejor SKU de Bosch" → [¿en qué: ventas, margen, contribución?] → "margen" → "BOS-SANDER…" (recordando Bosch+SKU+superlativo).
- **B · Resolver la elección tras AVISAR combinado (2.2b):** "ventas de Samsung en Falabella" → [marca sola o detalle del cliente] → "el detalle de Falabella" → client_dive de Falabella.
- **C · Refinamiento deíctico (2.2c):** "ventas por cliente de Samsung" → "y por margen" (cambia métrica, mantiene filtro) · "solo Bosch" (re-filtra) · "los tres peores" (deíctico plural sobre la lista previa).
- **Trampas (2.2a):** anti-contaminación (el hilo se limpia en pregunta nueva) + anti-fuga (la continuación ECL-CONT respeta el muro de inventario).

---

## 2 · El andamiaje existente (qué REUSO, qué FALTA) — anclado al barrido

**REUSO (probado, no reinvento):**
- `_threadContext` (answerADI 136-223): escribe lastClient/Sku/List + investigation + activeResult. Estructura sólida.
- `eclContIsPureContinuation` (eclCont 19-31): la defensa actual contra contaminación ("si hay intent nuevo, NO continúa"). + `composeSkuDevelopment` (la clasificación del [5]).
- Deícticos: `detectDeicticReference`/`resolvePluralDeictic` (router 1044-1110) · `detectClientMetricFollowUp` (router 1214) · `applyInvestigationContext` (deepThreading).
- El `turnCount` + `lastXMentionedTurn` (single entities) → la base del age-check.

**FALTA (los GAPs que 2.2 cierra):**
- **Fuga (2.2a):** `composeSkuDevelopment` (eclCont 36-93) lee `skuInventario` (capital/rotación/DOH) **sin consultar el Availability Map**; `activeResult.domain` YA trae la info (answerADI 199-212) pero no se consume. La continuación corre DESPUÉS del muro (L565), y el muro chequea el TEXTO ("los tres peores" no tiene keywords de inventario) → esquiva.
- **Contaminación (2.2a):** sin política de limpieza; las **listas plurales `lastClientList`/`lastSkuList` NO tienen age-check** (a diferencia de las single entities), así que un deíctico plural en N+10 puede resucitar una lista de hace 10 turnos. `investigationDomain` se preserva "si no hay match" (audaz con pregunta nueva).
- **Contexto pendiente del spine (2.2b):** el spine (`_plainWrap`) **no escribe contexto**; ACLARAR/AVISAR no guardan un "pendiente" → N+1 no sabe que era Bosch+SKU+superlativo, ni la elección marca/cliente.
- **Continuación del resultado (2.2c):** "solo Bosch" dispara un `brand_dive` NUEVO (pierde el pivot SKU); "y por margen" arranca de cero (no carga el filtro); el deíctico plural resuelto no sube a `investigationEntidades`.

---

## 3 · El split en detalle

### 2.2a · Red de seguridad (anti-fuga + anti-contaminación) — VA PRIMERO
- **Anti-fuga:** la continuación ECL-CONT consulta el **Availability Map** antes de surfacear. Defensa en profundidad: (1) `composeSkuDevelopment` chequea `activeResult.domain` → si bloqueado, re-ancla con `unavailableMessage`; (2) `answerADI` guarda el guardrail antes de invocar. **El muro multi-turno = el mismo Availability Map del single-turn.**
- **Anti-contaminación:** age-check en las listas plurales (validar `lastClientListTurn === turnCount`, espejo de las single entities) + una marca `_isNewQuestion` cuando el intent es nuevo (espejo de `eclContIsPureContinuation`) para que los detectores ignoren foco viejo.
- **Pago de conducta:** "qué SKUs atrapan capital" [muro AVISA] → "los tres peores" → **AVISA (no fuga capital/rotación)** · y un cambio de tema limpia el hilo (no resucita listas viejas).

### 2.2b · Resolver ACLARAR + AVISAR combinado — el spine conversa
- El spine escribe un **`pendingSpineDecision`** en el contexto (vía `_plainWrap`): `{ kind: 'clarify'|'combined', filterValue, filterAxis, dimension, direction, pendingMetrics, option1, option2, turn }`.
- N+1 lee ese pendiente ANTES de re-detectar: "margen" suelto → resuelve `margen por sku de Bosch (peor)`; "el detalle de Falabella" → client_dive de Falabella.
- **Pago:** los ACLARAR/AVISAR del spine dejan de ser callejones — se completan en el turno siguiente.

### 2.2c · Refinamiento deíctico — continuar el resultado previo
- Distinguir **refinamiento** ("solo Bosch" re-filtra, "y por margen" cambia métrica manteniendo filtro, "los N peores" rebana la lista) de **intent nuevo**.
- Cargar el resultado previo (filtro/lista/dimensión) en el refinamiento en vez de arrancar de cero.
- **Pago:** "ventas por cliente de Samsung" → "y por margen" → margen por cliente de Samsung (mismo filtro) · "solo Bosch" continúa el pivot · "los tres peores" rebana la lista previa.

---

## 4 · El oráculo (cadenas reales encadenadas · lenguaje humano)
- **2.2a anti-fuga:** `qué SKUs atrapan capital` → `los tres peores` → AVISA Fase 2.5 (cero capital/rotación).
- **2.2a anti-contaminación:** `cómo está Falabella` → `cuál es el margen global` → margen global (NO contaminado por Falabella) · `ventas por cliente de Samsung` → `cómo va el negocio` → panorama limpio (no arrastra la lista Samsung).
- **2.2b ACLARAR:** `el mejor SKU de Bosch` → `margen` → "BOS-SANDER…".
- **2.2b AVISAR combinado:** `ventas de Samsung en Falabella` → `el detalle de Falabella` → client_dive Falabella.
- **2.2c deíctico:** `ventas por cliente de Samsung` → `y por margen` → margen por cliente de Samsung · `solo Bosch` · `los tres peores`.

Cada cadena: el hilo continúa cuando corresponde, se limpia cuando no, y nunca fuga inventario.

---

## 5 · Shadow-diff + single-turn byte-idéntico (el blindaje)
- **Single-turn byte-idéntico (el más importante):** todo lo que hoy anda en un solo turno (ctx `{}`) sigue byte-idéntico — 2.2 SOLO cambia conducta MULTI-turno (cuando hay contexto previo). El piso 47/canónica/extendida (single-turn) intacto.
- **Shadow-diff por sub-ladrillo:** flag ON vs OFF → solo cambian las CADENAS multi-turno de ese sub-ladrillo; el single-turn y las otras cadenas byte-idénticas.
- **Anti-fuga verificado:** la cadena de inventario NUNCA muestra un número de inventario.

---

## 6 · Flags · Blast radius (por sub-ladrillo)
- `ADI_MT_SAFETY_ENABLED` (2.2a) · `ADI_MT_SPINE_FOLLOWUP_ENABLED` (2.2b) · `ADI_MT_DEICTIC_REFINE_ENABLED` (2.2c). Todos default OFF, bajo el paraguas multi-turno.
- **Blast radius:** 2.2a toca `eclCont` + `_threadContext` + los detectores deícticos (age-check); 2.2b toca el spine + `_plainWrap` + un campo de contexto nuevo; 2.2c toca los deícticos/composers. Flag OFF cada uno → comportamiento previo exacto.

---

## 7 · Reporte crítico — los riesgos grandes
1. **Romper el single-turn (riesgo CENTRAL).** Todo el multi-turno corre SOLO con contexto previo; en sesión fresca (ctx `{}`) no dispara. Mitigación: el gate `eclContIsPureContinuation`-style (sin foco → no continúa) + el piso byte-exacto single-turn como prueba dura.
2. **La fuga de inventario (2.2a, SEGURIDAD).** Si la continuación surfacea capital/rotación, es la regresión de Cabo 2/muro a nivel multi-turno. Mitigación: defensa en profundidad (Availability Map en composeSkuDevelopment + el guardrail en answerADI) + el oráculo anti-fuga como gate rojo.
3. **La contaminación silenciosa (2.2a).** Listas viejas resucitando. Mitigación: age-check (turnCount) + `_isNewQuestion`. El oráculo de cambio-de-tema lo prueba.
4. **El refinamiento que pisa un intent nuevo (2.2c).** "solo Bosch" como refinamiento vs "Bosch" como pregunta nueva. Mitigación: distinguir refinamiento (deíctico/conector "solo"/"y") de intent puro; shadow-diff con controles.
5. **El tamaño (2.2c).** El deíctico-refinamiento es el más grande/enredado; su propio plano + red-team al llegar puede revelar que conviene partirlo más (2.2c-1/c-2). Lo declaro: **si al diseñar 2.2c resulta más grande, vuelvo a pedir split** (timón #2).
6. **El follow-up clicable (2.2b).** Si el usuario CLICKEA una sugerencia (vs tipear), el contexto debe saber qué eligió. Mitigación: la sugerencia tipeada ya contiene la métrica (el spine la detecta); el clic poblaría el `pendingSpineDecision` — detalle de UI, parte de 2.2b.

---

## 8 · Para aprobar
1. ¿El **split** en 2.2a (seguridad) / 2.2b (spine follow-ups) / 2.2c (deíctico-refinamiento)?
2. ¿El **orden** 2.2a → 2.2b → 2.2c (seguridad primero)?
3. ¿Arranco con el **plano detallado + red-team de 2.2a** (anti-fuga + anti-contaminación) como primer sub-ladrillo?

Con eso aprobado, traigo el plano detallado de 2.2a, lo aprobás, y recién ahí construyo. **No toqué `src/` — plano puro.**
