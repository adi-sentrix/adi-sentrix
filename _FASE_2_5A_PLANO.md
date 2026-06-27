# Fase 2.5a — Andamio + Rotación (1ª métrica de inventario modelada) · Plano fino + Red-team

> El ladrillo grande de la Etapa 3: trae el ANDAMIO que las 4 sub-fases reusan + rotación de punta a punta
> (fórmula declarada → dataset → dimensión → filtro → evidence). Camino MODELADO (spine + QI + evidence),
> NO los bundles operacionales. Plano puro — se aprueba y recién ahí se construye. Flag default OFF.

---

## 0 · LECTURA DE TAMAÑO → ENTERO (andamio + rotación juntos · son inseparables)
El andamio sin una métrica es andamiaje muerto (no se puede validar). **Rotación ES la prueba del andamio** — construirlos por separado deja scaffolding sin oráculo. Mi lean: **ENTERO**.

| Pieza | Tamaño | Reuso |
|---|:--:|:--:|
| Availability Map → per-métrica (`isAvailable(domain, metric)`) | Chico (~6 líneas + ~12 callsites de 1 línea) | 2.5b/c/d |
| composeRetrieval lee skuInventario + metricMap rotación + G1 per-métrica | Medio (~15 líneas) | 2.5b/c/d |
| El resolver de inventario en el spine (recompose + extremo + evidence) | Medio (~40 líneas) | 2.5b/c/d |
| El guard de atomicidad (mezcla modelada+no-modelada → AVISA) | Chico (~10 líneas) | 2.5b/c/d |
| Rotación: metricMap + flag + oráculo | Chico | — |

**El escape (timón #2):** si el refactor per-métrica del Availability Map (los ~12 callsites) o el resolver crecen más de lo previsto al construir, **freno y propongo partir: 2.5a-1 (andamio + availability) / 2.5a-2 (wire rotación)**. Pero el andamio-solo no se valida solo → por eso arranco ENTERO y parto solo si crece.

---

## 1 · EL ANDAMIO (lo que reusan las 4 sub-fases)

### 1.1 · Availability Map → per-métrica (`core/availabilityMap.js`)
Hoy `isAvailable(domain)` es booleano todo-o-nada (consultado en ~12 sitios: spine.js:91,142,173,227 · answerADI.js:499,537,785,794 · eclCont.js:46 · brand.js:42,57 · overview.js:19).
**Cambio:** firma `isAvailable(domain, metric?)`:
- Sin `metric` → consulta el dominio (igual que hoy · fallback · coexistencia byte-exacta).
- Con `metric` → consulta el estado per-métrica, **manejado por el flag de esa métrica** (`isAvailable("inventario","rotacion")` ≡ `ADI_INV_ROTACION_ENABLED`). El flag ES la disponibilidad.
- **Byte-exacto OFF:** con todos los flags de inventario OFF, `isAvailable("inventario", *)` = false y `isAvailable("inventario")` = false → idéntico a hoy.
- Callsites: los que tienen la métrica a mano (el resolver nuevo, los refinamientos c-2/c-3) pasan `metric`; los de dominio entero (los bundles · overview · brand) pasan el dominio (siguen bloqueados todo-o-nada hasta 2.5d).

### 1.2 · composeRetrieval lee skuInventario + metricMap rotación (`composers/qiRetrieval.js`)
**(a) metricMap (L833-844)** — hoy `rotacion:null, cobertura:null`. Agregar la entrada de rotación:
```
rotacion: { field: "rotacion", label: "Rotación", formatter: (v) => v.toFixed(1) + "x" },
```
**Los dos wrinkles que marcaste — RESERVADOS en el andamio, NO wireados hasta su ladrillo:**
- **`stock`/capital usa stockUSD SIN pisar el comercial:** el `stock:{field:"unidades"}` comercial (L840) queda INTACTO; el capital de inventario será un key NUEVO (`capital:{field:"stockUSD"}`) en 2.5c — entrada nueva, no reescritura. El ACLARAR vivo ("¿unidades o capital?") es el puente.
- **cobertura ≡ DOH:** se tratan como la misma métrica (mismo campo días); el key canónico se fija en 2.5b. En 2.5a NO se tocan (siguen `null` → AVISAN).

**(b) Lectura del dataset (L786-788)** — hoy `dim==="sku"` lee `skusMargen` (comercial). Branch por dominio de la métrica:
```
} else if (dim === "sku" || dim === "producto") {
  rows = (_invMetric && isAvailable("inventario", qi.metrics[0]))
    ? applyFiltros(applyScenarioToSkuInventario(scenario), _filtrosArg)   // inventario · scenario-aware
    : applyFiltros(skusMargen, _filtrosArg);                              // comercial (intacto)
  dimLabel = "SKU";
}
```
donde `_invMetric` = el dominio de `qi.metrics[0]` es "inventario" (vía METRIC_REGISTRY). **Con el flag OFF, `isAvailable` es false → lee skusMargen (que NO tiene campo `rotacion`) → L856 `return null` → cae a legacy, idéntico a hoy.**

**(c) Validación G1 (L847-857)** — generalizar el AVISO de inventario a per-métrica: una métrica de inventario NO disponible → AVISAR (Fase 2.5); disponible → resuelve. (Hoy hardcodea rotacion/cobertura → AVISA siempre.)

### 1.3 · El resolver de inventario en el spine (`core/spine.js`) — el camino modelado con evidence
**Nuevo `resolveInventoryRetrieval(text, scenario)`**, gemelo de `resolveDimensionalSuperlative` (L81) pero para métricas de inventario por SKU (que el guard 2.1a evita a propósito, L61). Reusa TODO el patrón probado:
1. **Firma:** métrica de inventario (rotación) + dim SKU (explícita o vía "por sku") + dirección opcional (peor/mejor). A diferencia de 2.1a, NO rechaza "por" (el QI lo maneja).
2. **VALIDATION:** `isAvailable("inventario", metricKey)` — no disponible → null (cae al muro, que AVISA) o AVISA con evidence (según régimen). Disponible → sigue.
3. **PLANNER + QUERY ENGINE:** recompone `"rotación por sku"` → `queryInterpreter` + `composeRetrieval` (con el andamio 1.2 leyendo skuInventario) · cero recálculo.
4. **Selección:** superlativo ("el peor/mejor") → toma el extremo de `materialMetrics` (como L106); tabla ("SKUs por rotación") → la tabla de composeRetrieval.
5. **EVIDENCE:** `_evidence(scenario, {metricKey, dimKey, operacion:"rank_bottom"/"rank_top", formula: metric.formula, invMetric:true, rowsUsed})` → **fuente:"skuInventario", fórmula declarada, filas usadas** (el helper L31-45 YA soporta invMetric). Sale gratis cuando `ADI_SPINE_EVIDENCE_ENABLED` está ON.
6. **Wire:** al TOPE de `answerADI` (en la zona del spine, ANTES del muro), gated por `ADI_INV_ROTACION_ENABLED`. Resuelve la métrica disponible antes de que el muro la cace.

**Por qué un resolver nuevo y no destapar ranking_extremes:** ranking_extremes (composeRankingExtremes) ya lee skuInventario (rankingData mapea rotación→skuInventario) PERO es un composer legacy SIN evidence. El camino modelado del NORTE exige evidence → el spine. El resolver reusa composeRetrieval + _evidence; ranking_extremes (de inventario) sigue gated por el muro (no se toca).

---

## 2 · ROTACIÓN DE PUNTA A PUNTA
| Aspecto | Valor |
|---|---|
| **Fórmula declarada** | "COGS / stock promedio" (METRIC_REGISTRY.rotacion · campo precalculado en el dato) |
| **Dataset** | `skuInventario` (13 SKUs · scenario-aware vía `applyScenarioToSkuInventario`) |
| **Dimensión** | SKU (una fila por SKU) |
| **Filtros** | marca · familia (skuInventario tiene `marca`+`sfamilia` → `applyFiltros` los aplica; `_filterApplicable` ya permite marca/familia sobre dim sku) |
| **Unidad/formato** | `x` (ej. 0.8x) |
| **Flag** | `ADI_INV_ROTACION_ENABLED` (default OFF) |
| **Evidence** | `{metrica:"rotacion", dimension:"sku", formula:"COGS / stock promedio", fuente:"skuInventario", operacion:"rank_bottom"/"rank_top", filas_usadas:13, confianza:"determinística"}` |

---

## 3 · EL ORÁCULO (lenguaje humano · dato REAL)
| Pregunta | Resuelve | Resultado (escenario bonanza) |
|---|---|---|
| **"el peor SKU por rotación"** | resolver inventario · rank_bottom | **MAK-COMP-AIR · 0.8x** (+ evidence) |
| **"el mejor SKU por rotación"** | rank_top | **PHI-SHAVER9 · 11.2x** |
| **"rotación de Bosch"** (filtro marca) | filtrado skuInventario marca=Bosch | el peor Bosch (BOS-SANDER 1.6x) |
| **"SKUs por rotación"** | tabla | ranking de los 13 por rotación |

**Las que NO son rotación todavía → AVISAN (la disolución métrica por métrica):**
| **"dónde tengo capital detenido"** (capital, no modelado) | muro | **AVISA** (Fase 2.5) |
| **"cuántos días de cobertura"** (DOH, no modelado) | muro | **AVISA** |

---

## 4 · 🚨 LA TRAMPA — encender rotación NO destapa capital/DOH (el RED gate)
**Triple defensa, ejercida en el oráculo:**
1. **Granular nativo:** el resolver/composeRetrieval ordena por UNA métrica (`metrics[0]`) y emite SOLO esa. "el peor SKU por rotación" → solo rotación, cero capital/DOH en el texto.
2. **Guard de atomicidad:** "rotación y capital por SKU" (mezcla rotación-disponible + capital-no-modelado) → **AVISA** ("no puedo mezclar rotación con capital hasta que las dos estén habilitadas"). En el resolver, antes de recomponer: si la query nombra ≥2 métricas de inventario con status distinto → AVISA.
3. **Bundles gated:** sku_operational / warehouse_dive (que emiten capital+DOH+rotación juntos) **NO se tocan** — siguen AVISANDO (consultan `isAvailable("inventario")` a nivel dominio, que es false hasta 2.5d).

**🚨 RED GATE (la prueba dura):** la respuesta de "el peor SKU por rotación" se barre con el regex de fuga de inventario (capital/stockUSD/DOH/días) → **cero número que no sea rotación**. Un solo $ de capital o "d" de DOH → FALLA.

---

## 5 · COORDINACIÓN (el orden · que no se pise)
El resolver de inventario corre en la zona del spine, ANTES del muro:
1. `_resolvePending` (2.2b) · refinamientos (c-1/c-2/c-3) — multi-turno, primero.
2. spine 2.1a/2.1b (marca/familia comercial).
3. **`resolveInventoryRetrieval` (2.5a)** — métrica de inventario disponible + SKU.
4. El muro (`_esPreguntaInventarioChat`) — caza lo no resuelto (métricas no modeladas, formas no soportadas) → AVISA.
**Disjunto:** el resolver reclama SOLO métricas de inventario DISPONIBLES (rotación con flag ON). Comercial → no es inventario → no dispara. Inventario no modelado → no disponible → cae al muro.

---

## 6 · EL BLINDAJE (los DOS niveles de OFF · el gate que pediste inequívoco)
- **🛡️ GATE PRINCIPAL (tu pedido) — régimen muro ON + rotación OFF:** con los 15 flags de la Etapa 2 ON y `ADI_INV_ROTACION_ENABLED` OFF → **inventario AVISA byte-idéntico a la Etapa 2** (el resolver es inerte, el muro caza "rotación" como siempre). El andamio (Availability per-métrica, metricMap rotación, branch skuInventario) es inerte con el flag OFF (`isAvailable` false → lee skusMargen → null → legacy).
- **🛡️ Piso byte-exacto — todos los flags OFF:** 47/47 + 10/10+6/6 + 19 (el andamio no toca el piso).
- **Rotación ON:** "el peor SKU por rotación" RESPONDE con evidence; capital/DOH AVISAN; la mezcla AVISA; **lo comercial (ventas/márgenes single-turn) intacto**.
- **Shadow-diff (rotación ON vs OFF · base régimen muro):** solo cambian las cadenas de rotación (AVISA→RESPONDE); todo lo demás byte-idéntico · **0 overshadow**.
- **Flag default OFF · reversible. Evidence compone con `ADI_SPINE_EVIDENCE_ENABLED` (texto byte-idéntico, campo hermano).**
- **Blast radius:** availabilityMap.js (per-métrica) · qiRetrieval.js (metricMap + branch skuInventario + G1) · spine.js (resolver nuevo + atomicidad) · answerADI.js (wire) · voiceFlags.js (flag). 5 archivos, núcleo acotado.

---

## 7 · REPORTE CRÍTICO — dónde será frágil
1. **🚨 Fuga por bundle (SEGURIDAD).** Mitigación: el camino modelado es granular; los bundles no se tocan (gated dominio-level); el guard de atomicidad; el RED gate como prueba dura.
2. **El refactor per-métrica del Availability Map (~12 callsites).** Riesgo de tocar un callsite comercial. Mitigación: fallback domain-level (sin `metric` = hoy) → los callsites comerciales no cambian de conducta; consistencia + byte-exacto OFF.
3. **El branch del dataset en composeRetrieval.** Que el OFF lea skusMargen exacto. Mitigación: gate por `isAvailable` + el null-path idéntico; single-turn comercial.
4. **El muro textual (C) cazando "rotación".** El resolver corre ANTES → resuelve la disponible; el muro caza la no-disponible. Mitigación: el orden + el gate régimen-muro.
5. **Evidence en el camino nuevo.** Mitigación: reusa `_evidence` (invMetric ya existe); compone con 2.1d; texto byte-idéntico.
6. **Scenario-awareness.** Que rotación respete bonanza/tensión/crisis. Mitigación: `applyScenarioToSkuInventario` (el resolver ya pasa scenario); oráculo en los 3.
7. **El tamaño del andamio.** Si crece, timón #2 → 2.5a-1 / 2.5a-2.

---

## 8 · Para aprobar
1. ¿El **andamio** (Availability per-métrica + composeRetrieval lee skuInventario + el resolver con evidence), con los dos wrinkles RESERVADOS pero NO wireados (solo rotación)?
2. ¿**Rotación** como 1ª métrica (SKU · marca/familia filtro · evidence con fórmula+fuente)?
3. ¿El **camino modelado vía el spine** (con evidence), NO destapar ranking_extremes/bundles?
4. ¿La **triple defensa** + el **RED gate** (rotación responde, capital/DOH cero número)?
5. ¿El **gate régimen-muro** (15 flags ON + rotación OFF → AVISA byte-exacto) como blindaje principal?
6. ¿**ENTERO** (andamio+rotación), con el escape a 2.5a-1/2.5a-2 si el andamio crece?

Con tu OK construyo, corro TODAS las pruebas (sobre todo el RED gate de fuga + el gate régimen-muro), dejo el flag OFF, limpio tareas colgadas, y reporto. **No toqué `src/` — plano puro.**
