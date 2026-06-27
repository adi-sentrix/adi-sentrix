# Fase 2.5b — DOH / Cobertura (2ª métrica de inventario modelada) · Plano fino + Red-team

> Con el andamio de 2.5a construido y validado, esto es LIVIANO: reusa el resolver del spine, el Availability
> Map per-métrica, y composeRetrieval leyendo skuInventario. Solo agrega la métrica DOH/cobertura (una sola
> métrica, dos nombres) + dos piezas chicas de cuidado. Plano puro — se aprueba y recién ahí se construye. Flag OFF.

---

## 0 · LECTURA DE TAMAÑO → LIVIANA · ENTERA (el andamio ya está · confirmado)
2.5a trajo TODO el camino (Availability Map per-métrica, composeRetrieval→skuInventario, el resolver con
evidence, los guards, 2.1a/2.1b per-métrica). 2.5b **reusa el andamio entero** y agrega solo la métrica. **Va entera.**

**Dos piezas chicas de cuidado (las marqué en 2.5a · acá se resuelven):**
1. **cobertura ≡ DOH** (una métrica, dos nombres) — reconciliar el key (registro usa `doh`, QI_VOCAB usa `cobertura`) → ambos → el mismo flag, el mismo campo.
2. **POLARIDAD** (pieza NUEVA, no estaba en rotación) — en DOH **más alto = PEOR** (más días detenido); en rotación más alto = mejor. "peor DOH" debe tomar el MÁS ALTO, no el más bajo. Hay que declarar la polaridad por métrica.

Ambas son chicas y declarativas. Si la polaridad se enreda al construir, freno (timón #2) — pero es un campo + un if.

---

## 1 · QUÉ CONSTRUYE — DOH/cobertura como UNA métrica modelada (dos nombres)
- **Una sola métrica** "DOH/Cobertura" (días de inventario). Vocabulario cubre `doh`, `cobertura`, `días de cobertura`, `sobre-cobertura`. El campo del dato: `doh` (canónico · `cobertura` es un duplicado redondeado → single source = `doh`).
- **Reconciliación de key:** `_INV_METRIC_AVAILABLE` mapea **ambos** `doh` Y `cobertura` → `ADI_INV_DOH_ENABLED` (el resolver detecta key `doh` del registro; composeRetrieval recibe key `cobertura` del QI_VOCAB — los dos apuntan al mismo flag). metricMap agrega la entrada `cobertura: { field:"doh", label:"DOH", formatter:(v)=>Math.round(v)+"d" }`.
- **POLARIDAD declarada:** METRIC_REGISTRY.doh gana un campo `higherIsWorse: true`. El resolver lo lee: si `higherIsWorse`, "peor"→extremo ALTO (mm[0]), "mejor"→extremo BAJO. Si no (rotación), "peor"→bajo (como 2.5a). Reusa el sort DESC de composeRetrieval; solo invierte qué extremo es "peor".
- **Dataset/dimensión/filtros:** idénticos a rotación (skuInventario · dim SKU · filtro marca/familia).
- **Evidence:** `_evidence(invMetric → fuente:skuInventario, formula:"stock / venta diaria", operacion:rank_top/bottom)` — sale gratis del resolver.

**Flag:** `ADI_INV_DOH_ENABLED` (default OFF).

---

## 2 · EL ORÁCULO (lenguaje humano · dato REAL)
| Pregunta | Resuelve | Resultado (bonanza) |
|---|---|---|
| **"qué SKU tiene peor DOH"** | rank · peor=más alto | **MAK-COMP-AIR · 190d** (+ evidence) |
| **"qué SKU tiene mejor DOH"** | peor=bajo invertido | **PHI-SHAVER9 · 15d** |
| **"cuántos días de cobertura tiene Bosch"** | filtro marca | tabla Bosch por DOH (BOS-SANDER 115d, BOS-DRILL18V 22d) |
| **"qué SKU de Bosch tiene peor DOH"** | filtro + peor | **BOS-SANDER · 115d** |

**Las que NO son rotación/DOH → siguen AVISANDO (disolución métrica por métrica):**
| **"dónde tengo capital detenido"** (capital · 2.5c) | muro | **AVISA** |
| **"qué bodega está complicada"** (bodega · 2.5d) | muro | **AVISA** |

---

## 3 · LA SUPERSESIÓN ESPERADA (DOH: AVISA → RESPONDE) — la listo como en rotación
Los casos de DOH en los harnesses viejos pasan a RESPONDE (estimados · la build confirma cada uno con su dato + evidence + cero fuga):
- Fix A: "qué SKU de Bosch tiene peor DOH" (GATE 1) · "el SKU con más DOH" (GATE 2) → RESPONDE.
- Fix C: "qué SKU tiene más DOH" (BARRIDO) · "qué productos tienen sobre-cobertura" → RESPONDE.
- spine 2.1b: "qué SKU de Bosch tiene peor DOH" → RESPONDE (filtrado).
- (2.1a "qué familia tiene peor doh" → familia es dim no-SKU → **sigue AVISANDO** vía el dim-guard · NO supersede.)

**Capital/bodega/cobertura-agregada siguen AVISANDO.** Cada supersesión: dato real de DOH, cero número de capital. Harnesses → flag-aware (DOH ON→RESPONDE / OFF→AVISA; capital→AVISA).

---

## 4 · 🚨 LA TRAMPA — encender DOH NO destapa capital ni bodega (igual que 2.5a)
1. **Granular nativo:** el resolver ordena por UNA métrica (DOH) → emite solo días, cero capital.
2. **Atomicidad:** "DOH y capital por SKU" (mezcla DOH-disponible + capital-no-modelado) → **AVISA** (el `_INV_OTHER_METRIC` ya cubre capital/inmoviliz). Y "rotación y DOH" (ambas modeladas) → responde la primera (o se decide al construir; ambas disponibles, sin fuga).
3. **Bundles gated:** sku_operational/warehouse (capital+DOH+rotación juntos) **siguen AVISANDO** (consultan `isAvailable("inventario")` dominio-level, false hasta 2.5d).
4. **🚨 RED GATE:** la respuesta de DOH se barre con el regex de fuga → **cero $ de capital, cero inmovilizado**. Un número de capital → FALLA.

---

## 5 · EL BLINDAJE
- **🛡️ GATE PRINCIPAL (el inequívoco · ahora con rotación en el baseline):** régimen muro (15 flags) **+ rotación ON + DOH OFF** == HEAD (5a78a2f, 2.5a) → byte-idéntico (git-stash). Encender DOH es lo único que cambia el comportamiento de DOH.
- **Piso byte-exacto (todo OFF):** 47/47 + 10/10+6/6 + 19 (DOH OFF → composeRetrieval lee skusMargen → null → legacy).
- **Single-turn comercial intacto** + **shadow-diff** (DOH ON vs OFF → solo cambian las cadenas de DOH · 0 overshadow · rotación + capital + comercial idénticos).
- **Combinado (17 flags · +DOH):** Fix A/B/C + Cabo + spine 2.1a-d + 2.2a-c + 2.5a rotación → todo intacto (rotación sigue respondiendo, capital sigue avisando).
- **Blast radius:** availabilityMap (`_INV_METRIC_AVAILABLE` +doh/cobertura) · metricRegistry (`higherIsWorse`) · qiRetrieval (metricMap cobertura) · spine (la polaridad en el pick) · voiceFlags (flag). ~5 archivos, todos chicos.

---

## 6 · REPORTE CRÍTICO — dónde será frágil
1. **🚨 Fuga de capital al encender DOH (SEGURIDAD).** Mitigación: granular + atomicidad + bundles gated + RED gate.
2. **La polaridad (pieza nueva).** Que "peor DOH" tome el más alto. Mitigación: campo declarado + oráculo (peor=190d MAK / mejor=15d PHI) + control de dirección.
3. **La reconciliación doh↔cobertura.** Que ambos nombres → el mismo flag + campo. Mitigación: `_INV_METRIC_AVAILABLE` mapea ambos + oráculo con las dos palabras ("DOH" y "cobertura").
4. **Romper el GATE PRINCIPAL (rotación en el baseline).** Que DOH OFF == 2.5a exacto. Mitigación: git-stash contra HEAD (5a78a2f).
5. **Tamaño.** Si la polaridad o la reconciliación crecen, timón #2 (improbable · son declarativas).

---

## 7 · Para aprobar
1. ¿**Liviana, entera** (reusa el andamio · agrega DOH/cobertura + polaridad + reconciliación)?
2. ¿DOH/cobertura como **UNA métrica, dos nombres** (campo `doh`, vocabulario cubre ambos)?
3. ¿La **polaridad declarada** (`higherIsWorse` · "peor DOH" = más alto)?
4. ¿El **flag `ADI_INV_DOH_ENABLED`** default OFF?
5. ¿La **triple defensa + RED gate** (DOH responde, capital/bodega cero número) + el **GATE PRINCIPAL** (rotación en el baseline)?

Con tu OK construyo, corro TODAS las pruebas (sobre todo el RED gate de fuga + el GATE PRINCIPAL), dejo el flag OFF, listo las supersesiones de DOH, limpio tareas colgadas, y reporto. **No toqué `src/` — plano puro.**
