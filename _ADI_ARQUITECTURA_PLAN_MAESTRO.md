# ADI Core — Plano Maestro de Arquitectura

> Plano puro. Mapea **dónde estamos** (anclado a `src/` real) → **dónde vamos** (los 10 componentes del contrato + el NORTE). Define la decisión de fondo, qué se preserva, la secuencia y los riesgos. **No es construcción.** Se aprueba la arquitectura y el orden; recién ahí arranca la Fase 2.1.

---

## 0 · Resumen ejecutivo (la posición, en 6 líneas)

- **Ninguno de los 10 componentes existe limpio. 9 son PARCIALES (las piezas existen, dispersas y acopladas); 1 (LLM Governance) NO EXISTE — y está bien, porque hoy ADI es 100% determinístico.**
- **La decisión: Camino C — Strangler del núcleo.** Construir el *pipeline* nuevo (Intent→Validación→Planner→Evidence) como entrada flag-gated que **reusa los motores probados intactos** y atiende una rebanada creciente; lo que no atiende **cae al camino probado** (byte-exacto, flag OFF). NO evolución-en-caliente (rompe el núcleo acoplado), NO big-bang (cae al vacío sin red).
- **Es el mismo método que ya funcionó 4 veces** (puente QI, Fix A/B/C, muro, cabos). No es una apuesta nueva: es el strangler probado aplicado al corazón.
- **El Evidence Payload nace en 2.1, aditivo** (campo hermano, null en el camino viejo, ignorado por la UI hasta Fase 4).
- **El motor de inventario YA está construido** (`engine/inventory.js`): la Fase 2.5 es modelar+conectar+validar, no calcular de cero.
- **Honestidad: es grande (meses).** Cada fase entrega valor usable medido con el lenguaje del owner. Lo que no se promete todavía, se declara.

---

## 1 · Mapeo estado actual → arquitectura objetivo (los 10 componentes)

| # | Componente | Estado | Vive HOY en (ancla real) |
|---|---|:--:|---|
| 1 | **Semantic Layer** | 🟡 PARCIAL · disperso en 9 archivos | `routerData.js:SEMANTIC_METRICS` (227-299) · `ontology.js:CONCEPT_ONTOLOGY` (40+ conceptos) · `primitives.js:PRIMITIVES` (14 calculadoras) · `qiRetrieval.js:QI_METRIC_VOCAB/QI_DIMENSION_VOCAB` (97-118) · `cognitiveData.js` · `labels.js` · `intentsRegistry.js` · `data/skusMargen.js`+`baseKpis.js` |
| 2 | **Availability Map** | 🟡 PARCIAL · solo en negativo | `answerADI.js:_esPreguntaInventarioChat` (243-254) · `_inventarioAvisarMsg` (262-265) · `_gateInvCTA` (257-260) · 3 puntos de muro (462,483,506) · flag `ADI_QI_FILTER_ENABLED` |
| 3 | **Intent Resolver** | 🟡 PARCIAL · atado a "por" | `intentLayer.js:resolveIntentLayerEarly/Late` · `router.js:resolveSemanticIntent`+`detectIntent`+`extractConcepts`+`scoreIntents` · `qiRetrieval.js:queryInterpreter` (129-240, **exige `/\bpor\b/`**) · `intentsRegistry.js` |
| 4 | **Planner** | 🟡 PARCIAL · fundido con ejecución | `qiRetrieval.js:queryInterpreter` (genera plan) + `composeRetrieval` (718-1028, mezcla dataset+ejecución+formato+RIL) |
| 5 | **Composers Paramétricos** | 🟡 PARCIAL · 1 isla de 19 | `ranking.js:composeRankingExtremes` (paramétrico, lee `RANKING_EXTREMES_METRICS`) **vs** 18 composers hardcodeados ruteados por if-chain `answerADI.js` (289-381) |
| 6 | **Query Engine** | 🟢 SÓLIDO (sin permisos) | `metrics.js:applyFiltros` (168-188, agnóstico a fuente) + `getVentasKPI`/`getMargenKPI` + `scenarios.js` + `inventory.js` + `signals.js` |
| 7 | **Validation Engine** | 🟡 PARCIAL · scatter, solo en QI | `qiRetrieval.js` verdictos G1-G5 (714-772) + `extractFilterPredicate` (301-336) + `_filterApplicable` (703-709) + `answerADI.js:_plainWrap` (225-232) |
| 8 | **Evidence Payload** | 🔴 CASI INEXISTENTE | Schema correcto en `helpers.js:buildResponseContract` (31-57) pero **QI lo ignora** y **`_finalize` no lo pasa al retorno** — el output es `{text,suggestions,sentrixAction,intent,route,context}`, **sin `evidence`** |
| 9 | **Conversation Memory** | 🟡 PARCIAL · sin limpieza | `answerADI.js:_threadContext` (135-222) · `deepThreading.js:applyInvestigationContext` · `eclCont.js:eclContIsPureContinuation` · `router.js:detectDeicticReference`+`resolvePluralDeictic` |
| 10 | **LLM Governance** | ⚪ NO EXISTE (no hay LLM) | Gobernanza de TEXTO determinística: `voiceContract.js` (regex) · `narrativeLayer.js` (6 posturas) · `etlg.js` (templates). **Cero `fetch`/anthropic/openai — verificado.** |

---

## 2 · La brecha por componente (sin maquillar)

1. **Semantic Layer** — las fórmulas **no están declaradas en ningún lado**: margen = (venta−costo−rebates)/venta vive *implícito* en los datos; `benchmark=30.1` está hardcodeado en **6+ archivos**; "cliente" como dimensión está en 4 archivos. Falta: registry central de métricas (fórmula+unidad+fuente+benchmark), de dimensiones, de dominios ("dominio X expone [métricas]"), y de entidades.

2. **Availability Map** — **solo declara lo NO disponible** (inventario), de forma dispersa (flag + regex + intent.type). No hay mapa declarativo de qué métricas/dimensiones expone cada dominio, ni metadata de "conectado+modelado+validable+consultable+trazable". El motor de inventario existe pero su disponibilidad es implícita.

3. **Intent Resolver** — **`queryInterpreter` exige la palabra "por"** (L171-176): "dame ventas clientes" o "el peor margen de Bosch" caen a legacy. Tres resolvers (early-gate, semántico, QI) con **salidas distintas, sin un `IntentResolution` canónico**. No emite **operación** explícita (rank/compare/sum/avg) ni resuelve filtros combinados (marca+cliente).

4. **Planner** — `queryInterpreter` genera el plan pero `composeRetrieval` **funde plan + dataset + ejecución + formato + RIL** en 300 líneas. El plan es un objeto JS inline sin schema; nadie puede *entender* el plan sin ejecutarlo (no hay logging/caché/auditoría posible).

5. **Composers Paramétricos** — **19 archivos hardcodeados ruteados por if-chain manual**; solo `composeRankingExtremes` es paramétrico (vía `RANKING_EXTREMES_METRICS`). Firmas inconsistentes, el arquetipo (ranking/dive/comparison/mechanism) está **horneado en la detección de intent**, no es un parámetro. El objetivo (~12 universales × métrica × dimensión × arquetipo) requiere registry + interfaz uniforme.

6. **Query Engine** — **sólido y reusable** (`applyFiltros` es agnóstico a la fuente). La única brecha vs el contrato es **permisos/multi-tenant/auditoría** (datos hoy globales demo). *No es bloqueante para el asesor de un dueño sobre sus datos* → deuda diferida, no de 2.1.

7. **Validation Engine** — existe como **scatter de guardrails solo en el camino QI**. `client_dive`/`ranking_extremes`/`mechanisms` **NO pasan por validación central** (por eso "ventas de Samsung en Falabella" dropea Samsung sin avisar). La regla madre ("nunca responder adyacente") está **comentada, no es un paso arquitectónico verificable**.

8. **Evidence Payload** — **el más lejano.** Faltan `query_plan`, `fórmula`, `periodo` estructurado, `filas_usadas`, `fuente`, `confianza` estructurada; los `unsupported_clauses` existen como verdictos binarios, no como array; y **el evidence se pierde en `_finalize`** (nunca llega al output). `buildResponseContract` ya es el schema correcto — pero solo lo usan 4 de los composers.

9. **Conversation Memory** — **sin política de limpieza**: las entidades persisten indefinidamente ("fantasmas de turno anterior"). No soporta el deíctico **"solo X"** como re-filtro (el hueco de "solo Bosch"). No hay lógica de "qué NO arrastra". La continuación ECL-CONT **no consulta el Availability Map** (por eso "los tres peores" fugó inventario).

10. **LLM Governance** — **no aplica todavía** (no hay LLM). Cuando se agregue: faltan prompt-guardrails, response-validator (que la salida respete "solo datos core, no inventa"), fallback determinístico, audit trail. **El sistema determinístico de hoy es exactamente el "fallback" que ese LLM tendría debajo.**

---

## 3 · LA DECISIÓN DE FONDO

### Las tres opciones, sin esquivar

**Camino A — Evolución en caliente** (mutar `queryInterpreter`→Intent Resolver, `composeRetrieval`→Planner+Validation, los 19 composers→12 paramétricos, *in situ*).
- **Costo:** parece barato (no hay sistema paralelo). **Es trampa.** El mapa muestra por qué: las piezas están **dispersas y cruzadas** (Semantic Layer en 9 archivos; "por" horneado; benchmark en 6 archivos; if-chain de dispatch). Mutar cualquiera **ondula** a las demás.
- **Riesgo:** ALTO. Es el **espejo de [39] a escala de arquitectura**: tocar el resolver para que entienda sin "por" puede ensombrecer composers que hoy resuelven bien. Y **no hay rollback** — no podés flag-off una función que reescribiste.
- **Veredicto: rechazado como camino primario.**

**Camino B — Núcleo nuevo al lado + migración big-bang.** Construir Semantic+Availability+Intent+Planner+Validation+Evidence limpios y *cortar* a los composers de un saque.
- **Costo:** alto y diferido (todo el valor llega al final).
- **Riesgo:** el **"arquitectura limpia que nunca termina ni entrega" (riesgo d)** + el **"sistema a medias sin red" (riesgo c)**. El cutover es un acantilado.
- **Veredicto: rechazado como camino primario.**

### ✅ Camino C — Strangler del núcleo (RECOMENDADO)

Construir el **spine nuevo** (el pipeline: Intent Resolver → Validation → Planner → Query Engine → Composer → Evidence) como **nueva entrada flag-gated**, con tres invariantes:

1. **Reusa los motores probados INTACTOS** debajo: `applyFiltros`, los agregadores, los scenario-transforms, los detectores strict, `CONCEPT_ONTOLOGY`, los kernels de cálculo de los composers. El spine **orquesta**, no recalcula.
2. **Atiende una rebanada creciente, verificada por oráculo.** Lo que el spine **todavía no reclama, cae al camino probado** (byte-exacto). En ningún momento el sistema queda roto a medias.
3. **Cada rebanada es un flag, default OFF.** Flag OFF = base probada byte-exacta — **la red de rollback que ya probamos 4 veces.**

**Por qué C y no A/B — la defensa:**

| Eje | A (evolución) | B (big-bang) | **C (strangler)** |
|---|---|---|---|
| **Costo** | Engañoso (ondula) | Alto, diferido | **Incremental · reusa ~65% del núcleo** |
| **Riesgo** | Alto ([39] a escala, sin rollback) | Alto (cutover acantilado) | **Mínimo (flag OFF = base probada · shadow-diff antes de flipear)** |
| **Velocidad de valor** | Lenta (todo acoplado) | Todo al final | **Cada fase entrega (2.1 cierra los huecos del owner)** |
| **Red de rollback** | No hay | No hay | **Byte-exacta, por flag** |

C **no es una apuesta nueva** — es el método que el propio NORTE exige ("Reversible siempre · cada flag vuelve byte por byte"). Es el strangler que ya corrió en el puente QI, Fix A/B/C, el muro y los cabos, **aplicado al corazón en vez de a las hojas.**

**El costo honesto de C:** el spine y el dispatch viejo **coexisten** durante 2.1–3. Eso es aceptable **porque el invariante flag-OFF-byte-exacto garantiza que nunca hay un medio-estado roto** — el camino viejo siempre está entero. La coexistencia termina cuando el spine **demostradamente subsume** cada composer (migración a paramétrico en Fase 3). Aceptamos duplicación temporal como el precio de nunca-roto.

---

## 4 · Qué se preserva (la base probada NO se tira)

| Pieza probada en vivo | Encaja en | Cómo |
|---|---|---|
| `applyFiltros` + agregadores (`metrics.js`) | **Query Engine** | **Verbatim.** Es el ejecutor del Planner. Agnóstico a la fuente. |
| Detectores strict (`detectors.js`, `router.js`) | **Intent Resolver** (entrada) | **Verbatim.** El resolver los orquesta en un intent estructurado. |
| `CONCEPT_ONTOLOGY` + `extractConcepts` + `scoreIntents` | **Intent Resolver** (comprensión) | **Verbatim.** *Ya reconoce* "qué cliente vende más" — es la llave para soltar el "por". |
| `PRIMITIVES` (14 calculadoras) | **Semantic Layer** | **Verbatim** como "metric calculators". |
| Muro `_esPreguntaInventarioChat`/`_inventarioAvisarMsg`/`_gateInvCTA` | **Availability Map** | La **lógica** se preserva; se generaliza a un mapa declarativo (el muro pasa a ser el primer *consumidor* del mapa). |
| Verdictos G1-G5 + `_plainWrap` + ruteo AVISAR | **Validation Engine** | La lógica se preserva; se **extrae a módulo** y se aplica a TODAS las rutas (no solo QI). |
| `queryInterpreter`/`composeRetrieval` | **Intent Resolver + Planner** (semilla) | Se **extiende** más allá de "por" y se **separa** plan↔ejecución. No se tira: es la semilla. |
| `buildResponseContract` (`helpers.js`) | **Evidence Payload** | **Es el schema correcto.** Se aplica a TODAS las rutas y se completa (query_plan/fórmula/fuente/filas/confianza). |
| Threading (`_threadContext`/`deepThreading`/`eclCont`/deícticos) | **Conversation Memory** | La lectura se preserva; se le **agrega política de limpieza** y el re-filtro "solo X". |
| `voiceContract`/`narrativeLayer`/`etlg` | **(futuro) LLM Governance** | Determinístico hoy = el **fallback + post-procesador** del LLM mañana. |

**Qué hay que reescribir (y por qué):** el **acople a "por"** en `queryInterpreter` (el resolver debe ser agnóstico al conector); la **fusión plan↔ejecución** en `composeRetrieval` (separar para que el plan sea auditable/reusable); el **if-chain de dispatch** (→ registry paramétrico, Fase 3); y **emitir el evidence en `_finalize`** (hoy se pierde). Todo detrás de flag, todo reversible.

---

## 5 · La secuencia de construcción (fases → componentes)

> **Clave:** el corazón de 2.1 es **Semantic Layer + Availability Map + Intent Resolver + Planner + Validation operando como pipeline** — NO un parser nuevo. El **Evidence Payload nace en 2.1**, transversal. El **LLM NO entra en 2.1** (la comprensión por intención se logra determinísticamente con la ontología que ya reconoce los conceptos).

```
                 ┌─────────────────────── FASE 2.1 · EL PIPELINE (el spine) ───────────────────────┐
   pregunta  →   Intent Resolver  →  Validation  →  Planner  →  Query Engine  →  Composer  →  Evidence
   natural        (sin "por")        (regla madre)   (plan)     (applyFiltros)   (reuso)      Payload
                 [comp 3 + Sem.L]     [comp 7 + Av.Map] [comp 4]   [comp 6 ✓]      [comp 5]    [comp 8 NACE]
                       ↑ usa CONCEPT_ONTOLOGY (ya existe)                              ↑ default OFF · cae al
                                                                                        camino viejo si no reclama
```

| Fase | Construye | Reusa | Depende de |
|---|---|---|---|
| **2.1** Comprensión por intención | Intent Resolver (sin "por") · Validation (módulo, todas las rutas) · Planner (plan↔ejecución) · **Semantic Layer** (registry central) · **Availability Map** (declarativo) · **Evidence Payload** (nace) | Query Engine, ontología, detectores, kernels | — (es la base) |
| **2.2** Multi-turno | Conversation Memory (limpieza + "solo X" + continuación vía Availability Map) | El spine de 2.1, threading actual | 2.1 (el intent estructurado + el evidence) |
| **2.5** Inventario disponible | Modela inventario en Semantic Layer + Availability Map (flip blocked→available) | **`engine/inventory.js` (¡ya existe!)** + el spine | 2.1 (Semantic Layer + Validation) |
| **3** Composición y cruces | Composers Paramétricos (~12 universales) · cruces multi-dimensión | Kernels de los 19 composers, el Planner | 2.1 (Planner) + 2.5 (dominios completos) |
| **4** Sentrix | Experiencia de evidencia (tablas/gráficos/fórmulas/auditoría) | **El Evidence Payload que se emite desde 2.1** | 2.1–3 (el payload acumulado) |

---

## 6 · Cada fase: oráculo (lenguaje humano), flags, preservación, fuera-de-scope

### FASE 2.1 — Comprensión por intención
- **Oráculo (lenguaje del owner):** `el peor margen de Bosch` · `qué cliente Samsung vende más` · `ventas de Samsung en Falabella` · `quién me está dañando el margen` · `qué cuenta vende mucho pero aporta poco` · `qué marca está rara` · `qué producto está erosionando margen`. Cada una: **responde / avisa / pregunta — nunca adyacente**, y **trae su evidence payload**.
- **Sub-hitos (cada uno un flag, default OFF):** 2.1a Semantic Layer + Availability Map formalizados (sin cambio de conducta — substrato) · 2.1b Intent Resolver sin "por", filtro simple (**mueve el oráculo**) · 2.1c filtros combinados marca+cliente (**mueve el oráculo**) · 2.1d evidence payload emitido en el camino spine.
- **Preserva:** flag OFF → base byte-exacta; lo que el spine no reclama cae al dispatch viejo intacto.
- **Fuera de scope:** la consolidación a ~12 composers (Fase 3); inventario (2.5); el LLM.

### FASE 2.2 — Conversación real
- **Oráculo:** `qué SKU de Samsung rota peor` → `ok, ventas por cliente de Samsung` → `y ahora margen por SKU` → `solo Bosch` → `los tres peores` (encadenado, hilo limpio; "solo Bosch" re-filtra la vista previa; "los tres peores" no fuga inventario).
- **Flags:** memoria + limpieza + re-filtro "solo X", cada uno OFF por default.
- **Preserva:** el threading actual sigue; se le agrega política de expiración.
- **Fuera de scope:** memoria de sesión persistente entre sesiones; el "y su rotación" depende de 2.5.

### FASE 2.5 — Inventario disponible
- **Oráculo:** `el peor SKU por rotación` · `dónde tengo capital detenido` · `stock de LG en Santiago` · `qué bodega está complicada` — **ahora responden con su payload** (lo que hoy avisa).
- **Flags:** un flag por métrica modelada (rotación, DOH, stock, cobertura, capital, bodega).
- **Preserva:** hasta que cada métrica esté modelada+validada, **sigue avisando** (el muro se disuelve métrica por métrica, no de golpe).
- **Honestidad:** el motor (`inventory.js`) ya calcula todo → 2.5 es **modelar + conectar + validar + emitir evidence**, no calcular.
- **Fuera de scope:** se detalla con su propio plano + red-team al llegar.

### FASE 3 — Composición y cruces
- **Oráculo:** `dónde vendo más pero gano menos` (cruce ventas×margen) · `qué cuenta vende mucho pero aporta poco` (cruce volumen×contribución, *respondido* no avisado) · `compará la rotación de Bosch contra Makita`.
- **Flags:** un flag por arquetipo migrado a paramétrico.
- **Preserva:** cada composer viejo sigue hasta que su equivalente paramétrico pasa shadow-diff.
- **Fuera de scope:** se detalla con plano + red-team al llegar.

### FASE 4 — Sentrix
- **Oráculo:** toda respuesta de 2.1+ **muestra su evidencia** (tabla, fórmula, fuente, filas, confianza, alcance) reconstruida del payload.
- **Fuera de scope:** se detalla con plano + red-team al llegar.

---

## 7 · Reporte crítico — los riesgos grandes a escala

**(a) El espejo de [39] a nivel arquitectónico** — introducir el spine sin ensombrecer composers que hoy resuelven bien.
- **Contención:** (1) el spine **reclama solo clases de query verificadas por oráculo**; (2) **shadow-mode** — correr spine + camino viejo, *diff*, flipear el flag **solo cuando el spine ≥ el viejo** en el oráculo; (3) la **batería byte-exacta sigue siendo el gate** (flag OFF = base probada); (4) **fall-through** al camino viejo para todo lo no reclamado. El spine nunca "gana" una query por descuido — la gana por prueba.

**(b) El Evidence Payload transversal sin romper lo existente.**
- **Contención:** el payload es **aditivo** (campo hermano `evidence`), **null en el camino viejo**, **ignorado por la UI hasta Fase 4**. La **batería byte-exacta de TEXTO** prueba que el texto no cambió mientras el payload viaja al lado. `buildResponseContract` (ya existe) es el schema; el cambio en `_finalize` solo *agrega* el campo, no toca el texto.

**(c) Migrar sin big-bang (que no quede a medias entre dos arquitecturas).**
- **Contención:** el invariante **flag-OFF = byte-exacto** ES la red. El camino viejo queda **entero** hasta que el spine lo subsume demostradamente. La coexistencia no es "a medias rota" — es "dos enteros, uno default-OFF". Cada rebanada es un flag; el rollback es byte-exacto. **Nunca existe un commit donde apagar todos los flags no devuelva el piso.**

**(d) Que "arquitectura limpia" se vuelva reescritura que nunca entrega.**
- **Contención:** **cada fase entrega un hito usable, medido con el lenguaje humano del owner + prueba en vivo.** Regla dura: **ningún refactor aterriza sin un pago de conducta ese turno** (no hay fases "solo infraestructura" que no muevan el oráculo). El substrato 2.1a (Semantic Layer) se justifica **solo porque es el piso del Intent Resolver sin "por"** — viaja *dentro* de 2.1b, que sí mueve el oráculo. Si una pieza no acerca a "ADI responde más como asesor", se reformula (la prueba del NORTE).

---

## 8 · Honestidad de tamaño

- **Esto es grande — realista en meses, no semanas.** El plano maestro fija arquitectura y orden; **cada fase trae su propio plano + red-team al llegar** (no se prediseñan acá los internos de 2.5/3/4).
- **2.1 es el lift más grande** (el spine + el payload). Por eso se parte en 2.1a→d, cada uno un flag con su gate. **El primer pago real es 2.1b** (filtro sin "por" funciona = el owner pregunta natural y ADI responde). El segundo es **2.5** (inventario responde).
- **Hitos que entregan valor de verdad:** 2.1b (comprensión natural) · 2.2 (conversa limpio) · 2.5 (la otra mitad de los datos) · 3 (compone cruces) · 4 (demuestra).
- **Qué NO prometo todavía:**
  - La profundidad de los **~12 composers paramétricos** (Fase 3 — su plano).
  - La **profundidad del modelado de inventario** (2.5 — su plano).
  - El **LLM en el loop** (posterior, opcional — acelera comprensión/redacción, *no* es fuente de verdad ni dependencia de 2.1).
  - **Permisos/multi-tenant** (brecha del Query Engine — no la necesita el asesor de un dueño; deuda diferida).
  - **Sentrix como experiencia completa** (Fase 4).
- **El compromiso que sí hago:** cada flag default OFF, cada fase reversible byte-exacta, cada cierre contra su oráculo en lenguaje humano + prueba del owner. **Prefiero este plan largo y honesto a uno optimista que se rompe.**

---

## 9 · Para aprobar

1. **¿Camino C (strangler del núcleo)** como decisión de fondo?
2. **¿El orden** 2.1 (spine + evidence) → 2.2 (memoria) → 2.5 (inventario) → 3 (composición) → 4 (Sentrix)?
3. **¿El Evidence Payload aditivo desde 2.1** (campo hermano, UI lo ignora hasta Fase 4)?
4. **¿El LLM declarado fuera de 2.1** (comprensión por intención = determinística con la ontología existente)?

Con esto aprobado, arranca **Fase 2.1a** con su plano + red-team propios.
