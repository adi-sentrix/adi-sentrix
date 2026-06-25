# Fase 2.1b — Plano + Red-team (filtros sin "por")

> Extiende el spine para entender un **filtro nombrado** en lenguaje natural sin "por" (filtro por intención, no por sintaxis). Reusa el Semantic Layer + Availability Map + los detectores strict + **el escudo anti-no-op del puente QI**. NO es un parser nuevo: es el pipeline (pregunta → intención → validación → consulta determinística → respuesta), extendido a filtros. Plano puro — se aprueba y recién ahí se construye. Flag default OFF.

---

## 0 · El pago de conducta

| Pregunta (lenguaje humano) | HOY | CON 2.1b |
|---|---|---|
| **el peor margen de Bosch** | 🔴 "Lider 21.5%" (cliente global, ignora Bosch) | ✅ "BOS-SANDER · 18%" (el peor SKU de Bosch) |
| **qué cliente Samsung vende más** | 🔴 brand_dive (overview de Samsung) | ✅ "Falabella · $19.4M" (top de los clientes Samsung) |
| **qué SKU de LG es más débil en margen** | 🔴 brand_dive ("LG 24%") | ✅ "LG-DRYER8KG · 11.1%" |
| **carga comercial de los clientes de Bosch** | (cae a genérico) | ✅ tabla carga por cliente filtrada a Bosch (Sodimac 5.4% · Easy 5.5%) |

Cierra los huecos de filtro-sin-"por" del re-test (cat 1) — los que más importan.

---

## 1 · Qué construye exactamente

Un segundo slice del spine: **`resolveFilteredRetrieval(text, scenario)`** (en `adi/core/spine.js`, junto a `resolveDimensionalSuperlative`). Detecta y resuelve un **filtro nombrado** sin "por", lo distingue de la dimensión, y reusa el cómputo+escudo del puente QI.

### Detección de la firma (intención, no sintaxis)
La firma de 2.1b: **métrica + filtro NOMBRADO ("de/en" + entidad específica) + dimensión (explícita o inferida) + superlativo OPCIONAL + SIN "por" + SIN "vs"**.

- **Filtro = entidad ESPECÍFICA tras conector "de/en"** (Bosch, Samsung, Falabella, LG…). Detección: `detectBrandInText` / `detectAllFamiliesInText(strict)` / `detectAllClientsInText` **+ el conector `_afterDe` de Fix A** (answerADI L487) — el conector es el discriminador, NO el detector pelado (ver red-team #1).
- **Dimensión = sustantivo GENÉRICO** ("cliente", "SKU", "marca", "familia") o **inferida** si no hay: filtro marca/familia + métrica → dimensión por defecto **SKU** (el grano del producto). "el peor margen de Bosch" → el peor SKU de Bosch. Si hay dimensión explícita ("qué CLIENTE Samsung…", "los CLIENTES de Bosch") → se usa esa.
- **Superlativo** (peor/mejor/más/menos) → opcional: si está, se elige el extremo; si no, se devuelve la tabla filtrada.

### La distinción filtro-vs-dimensión (la precedencia que empezó el dimensionRegistry)
- **2.1a (corre primero):** dimensión GENÉRICA marca/familia + **SIN entidad nombrada** + superlativo. ("qué marca tiene peor contribución")
- **2.1b (corre después):** **entidad NOMBRADA** vía "de/en" + métrica. ("el peor margen **de Bosch**")
- **Disjuntas por construcción:** 2.1a exige que NO haya entidad nombrada (su guard ya rechaza si `detectBrandInText`/clients/families); 2.1b exige que SÍ la haya. Una query con dimensión genérica + entidad ("contribución por marca de Bosch") tiene "por" → ninguna la reclama (cae a QI).

### Resolución → reuso del cómputo (cero recálculo)
El slice arma la string canónica **"{métrica} por {dimensión} de {filtro}"** (ej "margen por sku de Bosch") y llama al `queryInterpreter` + `composeRetrieval` EXISTENTES con `opts={spineFilter:true}` (ver §2). El escudo + `applyFiltros` + el render salen del código probado. Si hay superlativo, toma el extremo de `materialMetrics` (como 2.1a). Si no, devuelve la tabla filtrada de `composeRetrieval`. Produce el objeto-plan evidence-ready (no emitido hasta 2.1d).

---

## 2 · El escudo, otra vez (reuso, NO reinvención)

El escudo anti-no-op YA vive en `composeRetrieval` (Piece 2/3 del puente QI), pero está **gateado por `ADI_QI_FILTER_ENABLED`** (una feature separada, committeada en `false`). Para reusarlo sin encender esa feature ni acoplarme a ella:

**Cambio MÍNIMO y ADITIVO — un `opts` threadeado (backward-compatible):**
1. `queryInterpreter(text, scenario, semanticContext, opts)` — L228: `if (ADI_QI_FILTER_ENABLED || (opts && opts.spineFilter))` ← OR con el flag.
2. `composeRetrieval(qi, scenario, opts)` — L726: `_filterOn = (ADI_QI_FILTER_ENABLED || opts?.spineFilter) && qi.filtros…` + threadear `opts` a `_filterTag` (L888) y `rilPickNextAngle` (L553/559/561) para que el tag "filtrado por: Bosch" y el wording salgan coherentes.
3. El spine pasa `{ spineFilter: true }`; **los callers existentes (answerADI L535, etc.) pasan `undefined` → comportamiento byte-idéntico.**

**Lo que el escudo me da automáticamente (sin reimplementar nada):**
- **filtro no reconocido** → `_qiVerdict("avisar","unrecognized")` (L737-739).
- **filtro inaplicable** (cross-grano/decorativo) → `_qiVerdict("avisar","inapplicable")` (L744-746) · `_filterApplicable` (L703).
- **filtrar la fuente ANTES de agrupar** (marca → filtra clientesMargen pre-group, L797) — el patrón del puente.
- **0 filas con campo verificado** → `_qiVerdict("avisar","absent")` (L823-827).
- **métrica de inventario bajo filtro** → AVISAR Fase 2.5 (L849-851).
- **tag "filtrado por: X" VISIBLE** (L888) — si la extracción se equivoca, se ve.

**Verificación de mordida:** el slice NO renderiza si el filtro no se pobló (qi.filtros vacío) — el escudo devuelve su verdicto AVISAR antes. Reuso, no reinvento.

---

## 3 · La línea anti-overshadow (los guards + el shadow-diff)

El spine reclama una query sin "por" **SOLO cuando puede resolverla mejor que el viejo** (mismatch). Los 7 guards (del red-team), en orden:

1. **Rechazar si "por"** → es QI. 2. **Rechazar si "vs"/"versus"** → es comparación (Falabella vs Lider · Samsung vs LG). 3. **Exigir métrica explícita** → "mejor cliente" sin métrica NO se reclama (cae a ranking_extremes, que tiene su heurística). 4. **Exigir filtro NOMBRADO "de/en"** → "mejor margen" sin filtro NO se reclama. 5. **Ceder a 2.1a si es dimensión genérica marca/familia SIN entidad** → 2.1a corre primero y la toma. 6. **Orden:** 2.1b corre DESPUÉS de 2.1a, al tope de `answerADI` (antes de simulación — que mal-clasifica "peor margen"). 7. **El shadow-diff es la prueba:** corpus 47 + extendida 19 + re-test 42, flag ON vs OFF → lo único que puede cambiar es la firma de 2.1b; si una query que el viejo respondía bien cambia → ROJO.

**El mismatch garantizado:** "el peor margen de Bosch" → el viejo da Lider (ranking_extremes global, ignora Bosch); "qué cliente Samsung vende más" → brand_dive (overview, no ranking de clientes). En ambos el viejo DROPEA el filtro → mismatch → el spine reclama. Donde el viejo respeta (no hay filtro nombrado, o tiene "por"/"vs") → cae al viejo.

---

## 4 · El oráculo (lenguaje humano real)

| Query | Veredicto | Resultado esperado |
|---|---|---|
| el peor margen de Bosch | ✅ RESPONDE | BOS-SANDER · 18% (peor SKU de Bosch) |
| qué cliente Samsung vende más | ✅ RESPONDE | Falabella · $19.4M (top cliente Samsung) |
| qué SKU de LG es más débil en margen | ✅ RESPONDE | LG-DRYER8KG · 11.1% |
| carga comercial de los clientes de Bosch | ✅ RESPONDE | tabla: Sodimac 5.4% · Easy 5.5% |
| **ventas de Samsung en Falabella** (marca+cliente combinado) | 🟡 **AVISA / → 2.1c** | ver timón abajo |

Cada una con su **objeto-plan evidence-ready** (metric/dimension/filtros/domain/formula/rows_used). Cada una: responde / avisa / pregunta — **nunca adyacente**.

---

## 5 · DECISIÓN DE TIMÓN (#2 · tamaño de la etapa) — RECOMIENDO SPLIT

**Hallazgo del dato (verificado en `demoData.js`):** `clientesMargen` tiene **UNA marca por cliente — la dominante** (Falabella→Samsung, Lider→LG, Sodimac→Bosch…). Es el **campo decorativo** que el escudo ya conoce. Consecuencia para el combinado marca×cliente:
- "ventas de Samsung en Falabella" → Falabella YA está tagueada Samsung, así que da el total de Falabella (1 fila) — pero **"ventas de LG en Falabella" → 0 filas → AVISAR** (Falabella no es LG). **El cruce real marca×cliente NO existe en el dato.**
- Es comportamiento DISTINTO (AVISA, o disclaimer honesto "solo te doy el total de Falabella, cuya marca dominante es Samsung") y más delicado que el filtro simple.

**Recomiendo: 2.1b = filtro SIMPLE de un eje (marca/familia/cliente/SKU) — los 4 que computan; 2.1c = combinado marca+cliente — AVISA/disclaimer, con su propio plano.** Es exactamente la bifurcación que ofreciste. El filtro simple cierra los 3 casos que más te importaban ("el peor margen de Bosch", "qué cliente Samsung vende más", "qué SKU de LG"); el combinado ("Samsung en Falabella") queda para 2.1c porque el dato no lo sostiene como cruce real.

**Necesito tu OK al split** (timón #2). Si preferís meterlos juntos, lo digo: 2.1b se hace más grande y el combinado igual termina en AVISAR.

---

## 6 · Flags · Gates · Blast radius

**Flag:** `ADI_SPINE_FILTER_ENABLED = false` (bajo el paraguas `ADI_CORE_SPINE_ENABLED`). Default OFF.

**Gates innegociables (cada uno verde antes de cerrar):**
1. **Flag OFF → piso byte-exacto** (47/47 + canónica + extendida). El `opts` aditivo no cambia los callers existentes → byte-idéntico.
2. **Flag ON → los 4 RESPONDE** dan el resultado correcto (BOS-SANDER 18%, Falabella $19.4M, LG-DRYER8KG 11.1%, tabla Bosch) con número idéntico al cómputo QI filtrado.
3. **Flag ON → inventario bajo filtro AVISA** ("rotación de Bosch" → Fase 2.5, cero fuga).
4. **Flag ON → combinado AVISA** ("ventas de Samsung en Falabella" → AVISAR, no un número adyacente).
5. **🛡️ SHADOW-DIFF: 0 overshadow** — corpus/extendida/re-test byte-idénticas salvo la firma de 2.1b. Incluye los controles del red-team: "Falabella vs Lider", "Samsung vs LG", "mejores clientes", "clientes con bajo margen", "ventas por marca" (con "por") → **NINGUNA cambia**.
6. **Combinado (QI_FILTER + spine ON):** Fix A/B/C + Cabo 2 + 2.1a intactos; el `opts` no rompe el puente QI con su flag ON.

**Blast radius:** `resolveFilteredRetrieval` nuevo en spine.js + el `opts` aditivo en `queryInterpreter`/`composeRetrieval` (2 funciones probadas · backward-compatible) + 1 flag + 1 wire (después de 2.1a). Flag OFF → cero cambio. No toca `applyFiltros`, ni el muro, ni los composers.

---

## 7 · Reporte crítico — dónde será frágil

1. **El conector como discriminador (riesgo #1).** Los detectores strict de cliente son inconsistentes (clientes no-ambiguos no exigen conector). Mitigación: 2.1b exige el conector **"de/en"** explícito (reuso de `_afterDe` de Fix A) — el filtro es "lo que está DESPUÉS de de/en". Sin conector → no es filtro → cae al viejo. El shadow-diff lo prueba.
2. **La dimensión implícita ("el peor margen de Bosch" = ¿SKU o cliente?).** Default: marca/familia filtro + sin dimensión explícita → **SKU** (el grano del producto). Si el testing muestra ambigüedad real, el fallback es **ACLARAR** ("¿por SKU o por cliente?"). Lo marco como punto a vigilar.
3. **El `opts` cosmético (`_filterTag`/RIL).** Si no threadeo `opts` al tag, la tabla filtrada saldría sin "filtrado por: Bosch" → el escudo visible se pierde. Mitigación: threadear `opts` también ahí (en el plano). Gate: la tabla de "carga de los clientes de Bosch" debe mostrar el tag.
4. **Semántica decorativa cliente×marca (heredada).** "qué cliente Samsung vende más" → los clientes tagueados Samsung (Falabella…), ranked por venta total — es la semántica YA aceptada del puente QI ("ventas por cliente de Samsung"). 2.1b la hereda, no la inventa. El combinado (2.1c) es donde esa semántica se rompe → split.
5. **Overshadow de comparaciones/simulaciones.** Guards explícitos ("vs"→comparación, métrica obligatoria, filtro obligatorio). El shadow-diff con los controles del red-team es la red.
6. **Si la firma resulta más ancha de lo previsto** (toca queries que no debía) → **timón #2, freno y consulto**, no la ensancho.

---

## 8 · Para aprobar
1. ¿El **pago de conducta** de 2.1b (filtro simple sin "por": "el peor margen de Bosch" → BOS-SANDER, etc.)?
2. ¿La **conducta visible nueva** (timón #1: los 4 RESPONDE)?
3. ¿El **split 2.1b/2.1c** (timón #2: combinado marca+cliente → su propio sub-paso, AVISA)?

Con eso, construyo 2.1b flag por flag, gate verde (incluido el shadow-diff), revierto el flag, y reporto.
