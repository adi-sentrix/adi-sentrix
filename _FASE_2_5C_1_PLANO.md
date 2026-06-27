# Fase 2.5c-1 — Capital (stock en valor) + desambiguación de "stock" · Plano fino + Red-team

> El primer pedazo del wrinkle: el capital de inventario (stockUSD) como métrica modelada, SIN pisar el
> "stock = unidades vendidas" comercial. El inmovilizado Def2 queda para 2.5c-2. El cuidado central: la
> intactez comercial. Plano puro — se aprueba y recién ahí se construye. Flag default OFF.

---

## 0 · ALCANCE Y TAMAÑO → el más cuidadoso de las c (el wrinkle) · ENTERO (2.5c-1)
Cubre: la métrica **`capital` = stockUSD** (todos los SKUs) + **la desambiguación de "stock"**. NO cubre el filtro Def2 del inmovilizado (eso es 2.5c-2). Reusa el andamio; lo nuevo es la separación stock-comercial vs capital-inventario. **Va entero** (2.5c-1); si la desambiguación crece, timón #2.

**Decisión de borde (la transparento):** en 2.5c-1, "capital detenido"/"inmovilizado" RESPONDEN con el ranking de capital de TODOS los SKUs (la vista amplia · "el SKU con más capital"). **2.5c-2 los REFINA al subconjunto Def2** (los verdaderamente inmovilizados). Es la progresión del split que aprobaste — 2.5c-1 amplio, 2.5c-2 preciso.

---

## 1 · 🎯 LA DESAMBIGUACIÓN DE "stock" (el cuidado central · intactez comercial)
**El estado real (la colisión que confirmé):**
- `METRIC_REGISTRY.stock` → domain **inventario**, "Σ stockUSD" (vocab "stock"/"capital inmovilizado"/"capital detenido").
- `QI_METRIC_VOCAB.stock`=`["stock"]` + `metricMap.stock`=`{field:"unidades"}` → **comercial** (unidades vendidas).
- `ambiguousStock = /\bstock\b/.test(norm)` (qiRetrieval.js:336) → cualquier "stock" → ACLARAR (línea 773-774).

**La separación (key NUEVO, comercial INTACTO):**
1. **Rename** `METRIC_REGISTRY.stock` (inventario) → **`capital`** + `domainRegistry.inventario.exposes` "stock"→"capital". (Evita la colisión con el QI "stock"=unidades; el consistency test lo verifica.) `capital`: `domain:"inventario"`, `unit:"$"`, `higherIsWorse:true`, `formula:"Σ stockUSD"`, vocab `["capital","capital inmovilizado","capital detenido","inmovilizado","detenido","atrapado","en valor","stock en valor","capital atrapado"]` — **SIN el "stock" pelado**.
2. **`QI_METRIC_VOCAB.capital`** (key nuevo) = el mismo vocab (sin "stock" pelado). `QI_METRIC_VOCAB.stock`=`["stock"]` **INTACTO**.
3. **`metricMap.capital`** = `{field:"stockUSD", label:"Capital", formatter:(v)=>"$"+(v/1000).toFixed(1)+"K"}`. `metricMap.stock`=`{field:"unidades"}` **INTACTO**.
4. **`_INV_METRICS`** += `"capital"` (qiRetrieval · ya tiene "stockUSD", agrego "capital").
5. **`ambiguousStock` refinado:** `/\bstock\b/ && !(/\bcapital\b|en\s+valor|inmoviliz|detenid|atrapad|stock\s*usd/)`. Bare "stock" → sigue ACLARANDO; "stock en valor"/"capital" → NO ambiguo (→ capital); "unidades de stock" → comercial intacto.

| Entrada | Resuelve |
|---|---|
| "stock de LG en valor" / "capital de LG" | **capital de LG** (stockUSD · key `capital`) |
| **"stock" (pelado)** | **ACLARAR** "¿unidades o capital?" (mecanismo existente · intacto) |
| **"unidades de stock" / "stock disponible" (comercial)** | **unidades** (key `stock` · INTACTO) |

---

## 2 · LA MÉTRICA `capital` (stockUSD · polaridad · anchor "detenido")
- **Campo:** `stockUSD`. **Formato:** `$N.NK` (18600 → $18.6K). **Polaridad:** `higherIsWorse:true` (más capital detenido = peor).
- **Anchor "estado-malo":** las palabras `inmovilizado`/`detenido`/`atrapado`/`estancado` implican el extremo PEOR (para `higherIsWorse` → el más alto) Y cuentan como ancla. Así "dónde tengo capital detenido" (sin "más"/"peor", sin SKU explícito) RESPONDE: el SKU con más capital. ("más capital"→top · "menos capital"→bottom · idéntico patrón valor/calidad de 2.5b.)
- **Evidence:** `_evidence(invMetric → fuente:skuInventario, formula:"Σ stockUSD", operacion:rank_top/bottom)`.
- **Flag:** `ADI_INV_CAPITAL_ENABLED` (default OFF · `_INV_METRIC_AVAILABLE.capital`).

---

## 3 · EL ORÁCULO (lenguaje humano · dato REAL)
| Pregunta | Resuelve | Resultado |
|---|---|---|
| **"qué SKU tiene más capital"** | capital · más alto | **SAM-REF500L · $18.6K** |
| **"capital de LG" / "stock de LG en valor"** | capital + filtro LG | tabla LG (LG-WASH $15.2K, LG-DRYER $13.6K, LG-AIR $5.8K) |
| **"dónde tengo capital detenido"** | capital · anchor "detenido" → más alto | **SAM-REF500L · $18.6K** (vista amplia · 2.5c-2 lo refina a Def2) |
| **"stock" (pelado)** | ACLARAR | "¿unidades o capital?" |
| **"unidades de stock" (comercial)** | unidades | intacto |
| **"qué bodega está complicada"** (2.5d) | muro | **AVISA** |

---

## 4 · LA SUPERSESIÓN DE CAPITAL (AVISA → RESPONDE) — la listo como las anteriores
Casos de capital en los harnesses viejos (estimados · la build confirma cada uno con dato+evidence+cero fuga):
- Fix C BARRIDO "capital": "cuánto capital inmovilizado tengo", "dónde está concentrado mi capital detenido", "qué SKUs atrapan más capital", "qué SKUs están atrapando más capital" → RESPONDE (vista amplia · refinado en 2.5c-2).
- "capital inmovilizado por marca" → **sigue AVISANDO** (dim no-SKU marca).
- 🚨 **2.2c-3 RED:** su T1 de prueba pasa de **capital → bodega** (capital ya responde · bodega sigue bloqueada). Lo actualizo.
**Bodega sigue AVISANDO.** Cada supersesión: dato de capital ($), cero rotación/DOH ajeno.

---

## 5 · 🚨 LA TRAMPA (RED gate DOBLE)
1. **Granular nativo** + **atomicidad future-proof:** `_INV_CONCEPTS` ya tiene el concepto capital (`m:"capital"`); agrego el de **bodega** (`{re:/\bbodegas?\b|sucursal/, m:"bodega"}`) → "capital y bodega" → bodega NO disponible → **AVISA**. (Capital, ahora disponible, deja de disparar la atomicidad para sí mismo.)
2. **Bundles gated** (sku_operational/warehouse · siguen AVISANDO hasta 2.5d).
3. **🚨 RED GATE DOBLE:** (a) la respuesta de capital ($) → **cero rotación (x) / DOH (d) ajeno**; (b) **el "stock comercial"=unidades NUNCA se cruza con stockUSD** — "stock" pelado → ACLARA, "unidades de stock" → unidades, jamás stockUSD. Un cruce stock↔capital → FALLA.

---

## 6 · EL BLINDAJE
- **🛡️ GATE COMERCIAL-STOCK (el que más cuidás):** el "stock=unidades" comercial **byte-idéntico con capital ON y OFF** — controles explícitos: "stock" pelado (ACLARA igual), "unidades de stock"/"stock disponible" (unidades igual), y cualquier ruta comercial que toque `metricMap.stock`. Shadow-diff + el GATE PRINCIPAL lo prueban.
- **🛡️ GATE PRINCIPAL:** régimen muro + **rotación ON + DOH ON + capital OFF == HEAD (8988040)** byte-idéntico (git-stash).
- **Piso byte-exacto (todo OFF):** 47/47 + 10/10+6/6 + 19 (capital OFF → lee skusMargen → null → legacy).
- **Shadow-diff (capital ON vs OFF):** solo cambian las cadenas de capital · 0 overshadow (rotación/DOH/bodega/**comercial-stock** intactos).
- **Combinado (18 flags):** Fix/Cabo + spine 2.1a-d + 2.2a-c + 2.5a/b + comercial → todo intacto.
- **Blast radius:** voiceFlags + availabilityMap + metricRegistry (rename stock→capital + higherIsWorse) + domainRegistry + qiRetrieval (QI_VOCAB capital + metricMap capital + ambiguousStock refinado + _INV_METRICS) + spine (anchor "detenido" + _INV_CONCEPTS bodega). ~6 archivos.

---

## 7 · REPORTE CRÍTICO — dónde será frágil
1. **🚨 Cruzar "stock comercial" con capital (el wrinkle · el riesgo #1).** Mitigación: key separado (capital≠stock), `ambiguousStock` refinado, el GATE COMERCIAL-STOCK dedicado + controles de "stock" pelado/unidades.
2. **La colisión registry stock(inv) vs QI stock(comercial).** Rename a `capital` + domainRegistry + el consistency test verde.
3. **El anchor "detenido" sin dirección.** Que "dónde tengo capital detenido" responda (el más alto). Mitigación: el worst-imply + oráculo.
4. **La vista amplia de "inmovilizado" en 2.5c-1** (SAM-REF, no Def2). Transparente: 2.5c-2 lo refina.
5. **GATE PRINCIPAL (rotación+DOH en baseline).** git-stash contra 8988040.

---

## 8 · Para aprobar
1. ¿Capital = stockUSD (key NUEVO `capital`, rename registry stock→capital), **sin pisar el "stock=unidades" comercial**?
2. ¿La **desambiguación** (bare "stock"→ACLARA · "en valor"/"capital"→capital · "unidades de stock"→comercial)?
3. ¿El anchor **"detenido"/"inmovilizado" → vista amplia** en 2.5c-1 (refinado a Def2 en 2.5c-2)?
4. ¿Polaridad `higherIsWorse`? ¿Flag `ADI_INV_CAPITAL_ENABLED` OFF?
5. ¿El **GATE COMERCIAL-STOCK** + el **RED gate doble** + el **GATE PRINCIPAL**?

Con tu OK construyo, corro TODAS las pruebas (**sobre todo el GATE COMERCIAL-STOCK + el RED gate doble + el GATE PRINCIPAL**), dejo el flag OFF, listo la supersesión de capital, actualizo el control de 2.2c-3 (→ bodega), limpio tareas, y reporto. **No toqué `src/` — plano puro.**
