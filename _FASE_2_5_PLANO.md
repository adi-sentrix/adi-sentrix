# Fase 2.5 — Inventario disponible (Etapa 3) · Plano + Red-team

> Volver inventario un dominio que RESPONDE con respaldo (evidence + validación), igual que ventas y márgenes.
> Modelar + conectar + validar — NO calcular de cero: el motor ya computa, las métricas están precalculadas,
> los registros ya declaran las fórmulas. Esto es ENSAMBLE + FLIP + VALIDACIÓN, métrica por métrica.
> Plano puro — se aprueba y recién ahí se construye. Flags default OFF. Fundado en el mapeo de 10 agentes del dominio.

---

## 0 · LECTURA DE TAMAÑO → GRANDE POR AMPLITUD, NO POR PROFUNDIDAD · SPLIT en 4 (métrica por métrica)
Un dominio entero (5 métricas + 1 dimensión nueva + la trampa de seguridad). Pero el hallazgo de fondo lo vuelve manejable: **es composición, no reconstrucción.** El cambio núcleo (andamio + 1ª métrica end-to-end) son ~50-70 líneas en 5 archivos; cada métrica siguiente reusa el andamio (pocas líneas). Grande por la cantidad de piezas a coser, no por la dificultad de cada una.

**Mi recomendación (alineada con tu instinto + el auditor de trampa + el estratega):** split en 4, **métrica por métrica**, andamio + rotación primero (la más simple e independiente, prueba el camino completo con la menor superficie de fuga).

| Ladrillo | Qué cubre | Tamaño | Riesgo |
|---|---|:--:|:--:|
| **2.5a · Andamio + Rotación** | Availability Map per-métrica + wire rotación end-to-end (QI/spine + evidence) + el muro per-métrica + el guard de atomicidad | Grande | **ALTO** (el andamio · prueba todo el camino) |
| **2.5b · DOH / Cobertura** | reusa el andamio + resuelve el choque `cobertura`↔`carga` | Chico | Medio |
| **2.5c · Stock / Capital / Inmovilizado** | el valor (Σ stockUSD) + desambiguar `stock`↔`unidades` + Def2 inmovilizado + filtro de marca ("stock de LG") | Medio | Medio-Alto (la mayor superficie de fuga) |
| **2.5d · Bodega + composers operacionales** | la dimensión bodega + reconciliar los *bundles* de sku_operational/warehouse con el camino modelado + evidence | Medio | Alto (los bundles · la trampa) |

**Mi lean: 2.5a primero, lo construyo y validás el camino entero antes de seguir.** Si el andamio crece más de lo previsto, freno y propongo partir 2.5a (andamio / rotación). Te traigo el plano detallado de CADA sub-ladrillo antes de construirlo (como en la Etapa 2).

---

## 1 · EL HALLAZGO DE FONDO — composición, no reconstrucción (la prueba en el código)
- **El motor ya computa.** `_aggregateInventario` (engine/metrics.js), `_familyInventoryAgg` (engine/inventory.js), `_aggregateBySucursal` + `_capitalInmovilizado` (warehouse.js) ya calculan capital total, capital atrapado, DOH promedio, SKUs críticos, inmovilizado. **Funciones puras, byte-exactas, se reusan sin tocar.**
- **Las métricas están PRECALCULADAS por SKU.** `skuInventario` (demoData.js, 13 SKUs · 4 bodegas) ya trae `rotacion`, `doh`, `cobertura`, `stockUSD`, `diasSinVenta`, `alerta`, `estado` como campos almacenados. Modelar ≈ agregar/ordenar, ni siquiera derivar.
- **Los registros ya declaran las fórmulas.** `metricRegistry.js` ya tiene `rotacion`/`doh`/`stock` con `domain:"inventario"`, `unit`, `formula` y `vocabulary` — solo `qiKey: null` (no enchufadas). `rankingData.js` ya mapea las 4 a `source:"skuInventario"`. `domainRegistry.js` ya expone `["rotacion","doh","stock","cobertura"]`. `QI_METRIC_VOCAB` ya reconoce los términos.
- **Lo que FALTA es el ensamble:** (a) entradas en el `metricMap` de `composeRetrieval` (hoy `rotacion:null, cobertura:null`); (b) `composeRetrieval` no lee `skuInventario` (solo lee las vistas comerciales); (c) `isAvailable("inventario")=false`; (d) `qiKey:null` corta el camino del spine; (e) el evidence payload de inventario; (f) la validación.

**Traducción:** Fase 2.5 = **coser** (metricMap + dataset + qiKey) + **flip** (Availability Map) + **validar** (oráculo + evidence). El cálculo ya existe.

---

## 2 · QUÉ MÉTRICAS SE MODELAN (fórmula declarada · dataset · dimensión · filtros)
Todas leen `skuInventario` (scenario-aware vía `applyScenarioToSkuInventario`). `entityType:"sku"` → dimensión natural SKU; marca/familia/bodega como filtro.

| Métrica | Fórmula (declarada) | Campo en dato | Dimensión | Filtros | Ladrillo |
|---|---|---|---|---|:--:|
| **Rotación** | COGS / stock promedio (precalc) | `rotacion` (x) | SKU | marca · familia | 2.5a |
| **DOH / Cobertura** | stock / venta diaria (precalc) | `doh` / `cobertura` (d) | SKU · bodega | marca · familia | 2.5b |
| **Stock (capital)** | Σ stockUSD | `stockUSD` ($) | SKU · bodega · familia | marca | 2.5c |
| **Capital inmovilizado** | Σ stockUSD donde (alerta crit/warn O rotación<2) · Def2 canónica | derivado (Def2) | bodega · familia | marca | 2.5c |
| **Días sin venta** (submétrica >60d) | Σ stockUSD donde diasSinVenta>60 | `diasSinVenta` | bodega · SKU | — | 2.5c |
| **Bodega (agregación)** | Σ stockUSD · DOH promedio por bodega | `bodega` (dim) | bodega | marca · familia | 2.5d |

**Notas honestas (decisiones de modelado para cada ladrillo):**
- **`cobertura` ≈ `doh`** (mismo concepto, días). Hay que elegir el key canónico y desambiguar (`QI_METRIC_VOCAB.cobertura=["cobertura","doh"]` hoy convive con `carga`). 2.5b lo resuelve.
- **`stock` es ambiguo y el QI YA lo sabe**: en el metricMap `stock→field:"unidades"` (ventas), y hay un ACLARAR vivo *"¿unidades vendidas o capital en inventario?"*. El capital de inventario = `stockUSD`, key distinto (propongo `capital`). 2.5c lo modela SIN pisar el `stock` comercial — reusa el ACLARAR como puente.
- **Rotación agregada no ponderada** hoy (solo promedio de DOH por bodega/familia). Para 2.5a la dimensión es SKU (ranking directo, sin agregación) → cero ambigüedad. La agregación por bodega/familia se decide en 2.5d.

---

## 3 · EL FLIP DEL AVAILABILITY MAP — per-MÉTRICA (tu preferencia · el muro se disuelve de a una)
**Hoy:** `AVAILABILITY = { inventario: { status:"blocked" } }` · `isAvailable("inventario")` es booleano todo-o-nada (consultado en ~15 sitios).

**Propuesta (cambio mínimo, viable y seguro — confirmado por el auditor):**
1. Extender la entrada inventario a **per-métrica**: `inventario: { status:"blocked", metrics: { rotacion:{...}, doh:{...}, capital:{...} } }`.
2. **`isAvailable(domain, metric?)`** — si se pasa `metric`, consulta el estado per-métrica; si no, el dominio (fallback · coexistencia byte-exacta). **El estado per-métrica lo maneja el flag de esa métrica** (`isAvailable("inventario","rotacion")` ≡ `ADI_INV_ROTACION_ENABLED`). El flag ES la disponibilidad.
3. Los ~15 callsites: los que ya tienen la métrica a mano (spine, los refinamientos) pasan `metric`; los de dominio entero (el drilldown operacional, el overview de módulo) pasan el dominio. Cambio de 1-2 líneas por sitio.

**Byte-exacto OFF:** con todos los flags de inventario OFF, `isAvailable("inventario", *)` = false (igual que hoy) y `isAvailable("inventario")` = false → el camino viejo intacto.

**De a una, NO de golpe:** cada métrica se enciende con su flag, validada sola, mientras las demás siguen bloqueadas. Ese es el corazón de la disolución controlada.

---

## 4 · CÓMO SE REAPROVECHA (composición · el wire, no el rebuild)
- **El camino QI/spine (el mismo de ventas/márgenes):** wirear una métrica = (a) entrada en el `metricMap` (`rotacion:{field:"rotacion",label:"Rotación",formatter:v=>v.toFixed(1)+"x"}`); (b) `qiKey:"rotacion"` en el registro; (c) que `composeRetrieval` lea `applyScenarioToSkuInventario(scenario)` cuando la métrica es de inventario y dim=sku (hoy lee solo las vistas comerciales). Con eso, **"el peor SKU por rotación" entra por el MISMO pipeline** que "el peor cliente por ventas".
- **El spine YA está listo:** `resolveDimensionalSuperlative`/`resolveFilteredRetrieval` recomponen `"{qiKey} por {dim}"` y chequean `isAvailable(metric.domain)`. El único bloqueo es `qiKey:null` + `isAvailable=false`. Con el flip + el qiKey, el spine resuelve inventario **sin reescribir una línea** (spine.js:91,99,227,238).
- **Los refinamientos (Etapa 2) operan igual:** `lastRetrievalContext.domain="inventario"` ya viaja; el anti-fuga (c-2/c-3) hoy AVISA si domain=inventario · con el flip, **deja pasar** y "y por DOH"/"los tres peores" refinan sobre inventario — el mismo mecanismo, cero código nuevo (answerADI.js:499,537).
- **El evidence payload (2.1d) sale gratis:** toda respuesta del spine emite su `evidence` (`_evidence` en spine.js) con `fuente:"skuInventario"`, fórmula, filas usadas. El camino QI/spine **ya lo lleva** — modelar por ahí da el respaldo automáticamente.
- **El muro deja de avisar per-métrica:** las 8 puertas ya consultan `isAvailable`. Cambiar el chequeo a `isAvailable(domain, metric)` → la métrica modelada pasa, la no modelada sigue avisando. **No se reescribe la anti-fuga; se la hace granular.**

**Mostrá que es composición:** la única pieza realmente nueva es que `composeRetrieval` lea el dataset de inventario. Todo lo demás es enchufar registros que ya existen + flip + el guard de atomicidad.

---

## 5 · 🚨 LA TRAMPA CENTRAL — habilitar sin romper la red (nada de "medio disponible")
El auditor de trampa encontró el riesgo real: **hay 6-7 rutas que YA emiten números de inventario en BUNDLE** (sku_operational, warehouse_dive, overview de módulo, brand físico, executiveReport, el motor `_aggregateInventario`). Emiten capital + DOH + rotación JUNTOS, sin guard per-métrica. Si encendés rotación, esas rutas podrían filtrar capital. **Triple defensa:**

**(a) El camino modelado es el QI/spine — granular por construcción.** "el peor SKU por rotación" entra por composeRetrieval, que ordena por UNA métrica (`metrics[0]`) y emite solo esa. Cero bundle. Per-métrica nativo.

**(b) El guard de atomicidad (en queryInterpreter, ANTES de componer):** si una query mezcla una métrica de inventario modelada con una NO modelada (ej. "rotación y capital por SKU"), **AVISA explícito** ("no puedo mezclar rotación con capital hasta que las dos estén habilitadas"). Atomicidad: todas las métricas de inventario de una query deben tener el mismo status, o AVISA. Esto cierra la fuga de multi-métrica parcial.

**(c) Los composers operacionales (los bundles) quedan GATED hasta que su bundle esté modelado.** sku_operational/warehouse/overview emiten capital+doh+rotación juntos → siguen avisando (en el régimen del muro) hasta 2.5d, cuando se reconcilian: o se refactorizan para emitir solo métricas modeladas, o se los reemplaza por el camino QI/spine. **2.5a-c NO tocan esas rutas — entran por el QI/spine limpio.** Un guard explícito en el dispatch (sku_operational/warehouse_dive) consulta `isAvailable("inventario")` a nivel dominio: mientras el bundle no esté completo, AVISA.

**El muro se disuelve métrica por métrica, controlado:** rotación modelada → "el peor SKU por rotación" RESPONDE; capital no modelado → "dónde tengo capital detenido" AVISA; la mezcla → AVISA. Nunca un número sin respaldo.

---

## 6 · EL ORÁCULO (tus 4 ejemplos en lenguaje humano → RESPONDEN con payload)
| Pregunta real | Hoy (régimen muro) | Tras su ladrillo | Ladrillo |
|---|---|---|---|
| **"el peor SKU por rotación"** | AVISA | **BOS-SANDER, 1.8x** (ranking SKU + evidence) | 2.5a |
| **"stock de LG"** | AVISA | **Capital de LG: $X** (filtro marca + evidence) | 2.5c |
| **"dónde tengo capital detenido"** | AVISA | **Bodega X concentra $Y inmovilizado** (bodega + Def2) | 2.5c→d |
| **"qué bodega está complicada"** | AVISA | **Antofagasta: DOH Z, $W atrapado** (overview bodega) | 2.5d |

**Controles ROJOS (la red intacta):**
- métrica NO modelada sigue AVISANDO ("capital" mientras solo rotación esté ON).
- mezcla modelada+no-modelada → AVISA (atomicidad).
- el camino viejo (flags OFF) byte-exacto.
- los composers operacionales (bundle) AVISAN hasta 2.5d.

---

## 7 · EL BLINDAJE — los DOS niveles de "OFF" (aclaración importante)
**El OFF de inventario tiene dos capas — las separo para que no haya confusión:**
1. **Piso (TODOS los flags ADI Core OFF):** el monolito responde inventario **operacionalmente** (sku_operational, overview) — byte-exacto, la red de rollback profunda. (Acá inventario NO avisa: así fue siempre el piso.)
2. **Régimen del muro (los 15 flags de la Etapa 2 ON) + flags 2.5 OFF:** inventario **AVISA** (no modelado). **Este es el baseline donde "inventario avisa".**

**Las pruebas de blindaje de cada ladrillo:**
- **Single-turn byte-idéntico (piso, todos OFF):** 47/47 + 10/10+6/6 + 19 — los flags 2.5 OFF no tocan el piso.
- **Régimen muro intacto (15 flags Etapa 2 ON + 2.5 OFF):** inventario sigue AVISANDO en las 8 puertas — el muro de la Etapa 2 byte-idéntico.
- **Flag 2.5 ON (ej. rotación):** rotación RESPONDE con evidence; las demás métricas AVISAN; la mezcla AVISA; lo comercial intacto.
- **Shadow-diff:** flag ON vs OFF → solo cambian las respuestas de la métrica modelada; todo lo demás byte-idéntico.
- **Flags per-métrica default OFF · reversible.**
- **Blast radius (2.5a):** availabilityMap.js (per-métrica), metricRegistry.js (qiKey rotación), qiRetrieval.js (metricMap + lectura de skuInventario + guard atomicidad), spine (cero — solo el flip lo activa). ~5 archivos, núcleo acotado.

---

## 8 · EL SPLIT DETALLADO (qué construye cada ladrillo · validable solo)
- **2.5a · Andamio + Rotación** — el Availability Map per-métrica + `isAvailable(domain,metric)` + el flag `ADI_INV_ROTACION_ENABLED` + el metricMap de rotación + `composeRetrieval` lee `skuInventario` para inventario+sku + el guard de atomicidad + el evidence. Valida "el peor SKU por rotación" RESPONDE, todo lo demás AVISA. **Prueba el camino entero.**
- **2.5b · DOH / Cobertura** — flag `ADI_INV_DOH_ENABLED`; reusa el andamio; resuelve el key canónico doh/cobertura + el choque con carga.
- **2.5c · Stock / Capital / Inmovilizado** — flags `ADI_INV_CAPITAL_ENABLED` (+ inmovilizado); reusa; desambigua stock↔unidades (vía el ACLARAR), modela Def2, habilita el filtro de marca ("stock de LG").
- **2.5d · Bodega + composers operacionales** — flag `ADI_INV_BODEGA_ENABLED`; la dimensión bodega + reconcilia los bundles (sku_operational/warehouse) con el camino modelado + evidence en los composers directos. Cierra "dónde/qué bodega".

---

## 9 · REPORTE CRÍTICO — dónde será frágil
1. **🚨 La fuga por bundle (SEGURIDAD · el RED gate de 2.5a-d).** sku_operational/warehouse emiten capital+doh+rotación juntos. Mitigación: el camino modelado es el QI/spine granular; los bundles quedan gated hasta 2.5d; el guard de atomicidad; un RED gate por ladrillo (métrica modelada responde, las demás cero número).
2. **Romper el piso byte-exacto.** El piso responde inventario operacional; los flags 2.5 OFF no deben tocarlo. Mitigación: single-turn piso + el wire detrás de los flags.
3. **El choque cobertura↔carga + stock↔unidades.** Colisiones de vocabulario reales. Mitigación: 2.5b/2.5c los resuelven explícitos (key canónico + el ACLARAR existente); controles dedicados.
4. **Consistencia scenario-aware.** `getInvKPI` vs `applyScenarioToSkuInventario` — verificar que el escenario (crisis sube DOH) se refleje parejo. Mitigación: oráculo en los 3 escenarios.
5. **Evidence en composers directos.** sku_operational no emite evidence (no pasa por spine). Mitigación: el camino modelado (QI/spine) lo lleva gratis; los operacionales se atienden en 2.5d.
6. **El tamaño del andamio (2.5a).** Si crece, timón #2 → partir 2.5a (andamio / rotación).

---

## 10 · 🛑 Aclaraciones de timón (para que decidas con el panorama)
- **Timón #1 — la conducta cambia (es el objetivo, lo confirmás):** inventario pasa de AVISAR a RESPONDER, métrica por métrica. Cada ladrillo es un cambio de conducta visible aprobado por vos.
- **Timón #1 — el alcance de "disponible":** "disponible de verdad" = el camino MODELADO (QI/spine + evidence + validación), NO simplemente destapar los composers operacionales del piso (que emiten bundles sin respaldo). Confirmame que querés el camino modelado (mi fuerte recomendación, es lo que da "respaldo igual que ventas/márgenes").
- **Timón #2 — los composers operacionales:** sku_operational/warehouse (los bundles) los dejo GATED hasta 2.5d y ahí decidimos si se refactorizan o se reemplazan por el camino QI/spine. Si querés atacarlos antes, lo decís.

---

## 11 · Para aprobar
1. ¿El **split en 4** (andamio+rotación → doh → capital → bodega), **métrica por métrica**, rotación primero?
2. ¿El **flip per-métrica** del Availability Map (`isAvailable(domain,metric)` manejado por un flag por métrica)?
3. ¿El **camino modelado** (QI/spine + evidence), no destapar los bundles operacionales (timón #1 alcance)?
4. ¿La **triple defensa** de la trampa (QI granular + guard de atomicidad + bundles gated)?
5. ¿Arranco con el **plano detallado de 2.5a** (andamio + rotación) para aprobarlo y recién ahí construir?

Con tu OK traigo el plano fino de 2.5a, lo aprobás, construyo, corro TODAS las pruebas (sobre todo el RED gate de fuga por bundle), dejo los flags OFF, reporto, y recién ahí seguimos a 2.5b. **No toqué `src/` — plano puro.**
