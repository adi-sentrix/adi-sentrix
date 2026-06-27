# Fase 2.5c — Capital / Stock en valor / Inmovilizado (3ª métrica de inventario) · Plano fino + Red-team

> La métrica del wrinkle que marqué desde el principio: "stock" ya significa UNIDADES en comercial; el capital
> de inventario usa stockUSD (entrada NUEVA), sin pisar la comercial. Reusa el andamio, pero la ambigüedad de
> "stock" + la def del inmovilizado agregan cuidado. Plano puro — se aprueba y recién ahí se construye. Flag OFF.

---

## 0 · LECTURA DE TAMAÑO → MEDIA (la más pesada de las c) · RECOMIENDO SPLIT (vos confirmás)
El andamio carga el camino, PERO hay DOS wrinkles reales y separables:
1. **La ambigüedad de "stock"** (riesgo #1 · intactez comercial): el capital usa un key NUEVO (`capital`→stockUSD), separado del `stock`→unidades comercial. Toca la desambiguación (`ambiguousStock` + el ACLARAR).
2. **El inmovilizado Def2** (mecanismo aparte): "inmovilizado"/"detenido" no es todo el stockUSD — es el subconjunto `alerta crit/warn O rotación<2` (la def que YA existe en `_capitalInmovilizado`/`_aggregateInventario`). Es un FILTRO derivado, no un campo.

**Mi recomendación: SPLIT en 2 —**
| Sub-ladrillo | Qué cubre | Riesgo |
|---|---|:--:|
| **2.5c-1 · Capital (stock en valor)** | la métrica `capital`=stockUSD + **la desambiguación de "stock"** (el wrinkle · comercial intacto) | Alto (la ambigüedad) |
| **2.5c-2 · Inmovilizado (Def2)** | "inmovilizado"/"detenido" = capital + filtro Def2 (reusa `_capitalInmovilizado`) | Medio |

**Por qué split:** aísla el riesgo de intactez comercial (2.5c-1, con su propio GATE de "stock=unidades") del mecanismo del filtro Def2 (2.5c-2). Cada uno con su GATE PRINCIPAL limpio. **Entero es posible** (≈9 edits, como 2.5b + el cuidado del stock), pero el wrinkle que vos marcaste merece su validación aislada. **Vos confirmás: split o entero.** (Si entero, construyo capital+desambiguación primero, valido el "stock comercial", y recién ahí agrego el Def2.)

> El resto del plano describe el alcance COMPLETO (2.5c-1 + 2.5c-2); si aprobás el split, traigo el plano fino de 2.5c-1 solo.

---

## 1 · LA AMBIGÜEDAD DE "stock" — cómo separo capital de unidades (el wrinkle · 2.5c-1)
**El estado real (colisión de nombre):**
- `METRIC_REGISTRY.stock` → domain **inventario**, "Σ stockUSD" (es la métrica de capital · vocab "stock"/"capital inmovilizado"/"capital detenido").
- `QI_METRIC_VOCAB.stock` = `["stock"]` + `metricMap.stock` = `{field:"unidades"}` → **comercial** (unidades vendidas).
- `ambiguousStock = /\bstock\b/` → cualquier "stock" → **ACLARAR** ("¿unidades vendidas o capital en inventario?").

**La separación (key NUEVO, sin pisar lo comercial):**
- **Nuevo key `capital`** (domain inventario): metricMap `capital:{field:"stockUSD", label:"Capital", formatter:$K}`, `higherIsWorse:true` (más capital detenido = peor). Vocab: `capital`, `capital inmovilizado`, `capital detenido`, `inmovilizado`, `detenido`, `en valor`, `stock en valor`, `capital atrapado`. **NO incluye el "stock" pelado.**
- Renombro el `METRIC_REGISTRY.stock` (inventario) → `capital` + `domainRegistry.inventario.exposes` "stock"→"capital" (evita la colisión con el QI "stock"=unidades). El consistency test lo verifica.
- **El "stock" comercial (unidades) queda INTACTO:** `QI_METRIC_VOCAB.stock`/`metricMap.stock`=unidades sin tocar.
- **La desambiguación:** `ambiguousStock` se refina → NO dispara si hay `capital`/`en valor`/`inmoviliz`/`detenid`/`stock usd` (ya desambiguado a capital). Bare "stock" → sigue ACLARANDO. "stock en valor"/"capital" → capital. "stock disponible" (comercial unidades) → intacto.

| Entrada | Resuelve |
|---|---|
| "stock de LG en valor" / "capital de LG" | **capital de LG** (stockUSD · key `capital`) |
| "stock" (pelado) | **ACLARAR** "¿unidades o capital?" (mecanismo existente) |
| "cuántas unidades de stock vendió X" (comercial) | **unidades** (intacto · key `stock`) |

---

## 2 · CAPITAL vs INMOVILIZADO — una métrica + un sub-filtro (2.5c-1 + 2.5c-2)
- **`capital` / "stock en valor"** = stockUSD de TODOS los SKUs. "qué SKU tiene más capital" → ranking por stockUSD (más alto = SAM-REF500L $18.6K). [2.5c-1]
- **"inmovilizado" / "detenido"** = capital del SUBCONJUNTO Def2 (`alerta==="crit" || alerta==="warn" || rotacion<2`) — la def canónica que YA usa el motor (`_capitalInmovilizado` warehouse.js:45,366). NO es un campo nuevo: es un FILTRO derivado sobre skuInventario antes de rankear. "qué SKU tiene más capital inmovilizado" → solo los Def2 → **LG-DRYER8KG $13.6K** (crit, rotación 1.0), NO SAM-REF500L (que es Activo). [2.5c-2]
- **Mecanismo del filtro:** el resolver detecta "inmovilizado"/"detenido" → pasa `{invInmovilizado:true}` a composeRetrieval → filtra `rows` al subconjunto Def2 antes de rankear. Predicado chico (2 campos), reusa la def del motor. Sin "inmovilizado" → todos los SKUs (capital a secas).

---

## 3 · EL ORÁCULO (lenguaje humano · dato REAL)
| Pregunta | Resuelve | Resultado | Brick |
|---|---|---|:--:|
| **"stock de LG en valor"** | capital + filtro LG | LG SKUs por stockUSD (LG-WASH $15.2K, LG-DRYER $13.6K, LG-AIR $5.8K) | 2.5c-1 |
| **"qué SKU tiene más capital"** | capital · más alto | **SAM-REF500L $18.6K** | 2.5c-1 |
| **"qué SKU tiene más capital inmovilizado"** | capital + Def2 | **LG-DRYER8KG $13.6K** | 2.5c-2 |
| **"dónde tengo capital detenido"** | capital + Def2 · más alto | **LG-DRYER8KG $13.6K** (el SKU más detenido) | 2.5c-2 |

**Las que NO son rotación/DOH/capital → siguen AVISANDO:**
| **"qué bodega está complicada"** (bodega · 2.5d) | muro | **AVISA** |
| **"stock"** (pelado) | ACLARAR | "¿unidades o capital?" |

---

## 4 · LA SUPERSESIÓN DE CAPITAL (AVISA → RESPONDE) — la listo como las anteriores
Casos de capital/inmovilizado en los harnesses viejos (estimados · la build confirma cada uno con dato+evidence+cero fuga):
- Fix C BARRIDO "capital": "cuánto capital inmovilizado tengo", "dónde está concentrado mi capital detenido", "qué SKUs atrapan más capital", "qué SKUs están atrapando más capital" → RESPONDE (2.5c-2 los inmovilizado · 2.5c-1 los de capital a secas).
- "capital inmovilizado por marca" → **sigue AVISANDO** (dim no-SKU marca · igual que rotación/DOH por marca).
- 🚨 **2.2c-3 RED:** su T1 de prueba pasa de **capital → bodega** (capital ya responde · bodega sigue bloqueada). Lo actualizo.
**Bodega sigue AVISANDO.** Cada supersesión: dato de capital, cero rotación/DOH ajeno.

---

## 5 · 🚨 LA TRAMPA (atención especial al "stock" comercial)
1. **Granular nativo** (una métrica, cero bundle) + **atomicidad future-proof** (`_INV_CONCEPTS`: agrego `{re:/capital.../, m:"capital"}` → al modelarla, se apaga sola para capital; bodega queda como la no-modelada → "capital y bodega" AVISA).
2. **Bundles gated** (sku_operational/warehouse · capital+DOH+rotación juntos · siguen AVISANDO hasta 2.5d).
3. **🚨 RED GATE doble:** (a) la respuesta de capital → cero rotación/DOH ajeno; (b) **el "stock comercial"=unidades INTACTO** — "stock" pelado → ACLARA, "unidades de stock" comercial → unidades, NUNCA se cruza con stockUSD. Un cruce stock↔capital → FALLA.

---

## 6 · EL BLINDAJE
- **🛡️ GATE PRINCIPAL:** régimen muro + **rotación ON + DOH ON + capital OFF == HEAD (8988040)** byte-idéntico (git-stash · ahora con rotación+DOH en el baseline).
- **🛡️ GATE COMERCIAL-STOCK (el que pediste):** el "stock=unidades" comercial byte-idéntico con capital ON y OFF — el shadow-diff + el piso lo prueban; foco explícito en "stock" pelado (ACLARA) y "unidades de stock" (unidades).
- **Piso byte-exacto (todo OFF):** 47/47 + 10/10+6/6 + 19 (capital OFF → composeRetrieval lee skusMargen → null → legacy).
- **Shadow-diff (capital ON vs OFF):** solo cambian las cadenas de capital/inmovilizado · 0 overshadow (rotación/DOH/bodega/comercial intactos).
- **Combinado (18-19 flags):** Fix/Cabo + spine 2.1a-d + 2.2a-c + 2.5a/b + comercial → todo intacto.
- **Blast radius:** voiceFlags + availabilityMap + metricRegistry (rename stock→capital + higherIsWorse) + domainRegistry + qiRetrieval (QI_VOCAB capital + metricMap + ambiguousStock refinado + Def2 filter) + spine (detección inmovilizado). ~6 archivos — el más amplio de las c (por el wrinkle).

---

## 7 · REPORTE CRÍTICO — dónde será frágil
1. **🚨 Cruzar "stock comercial" con capital (el wrinkle · SEGURIDAD comercial).** Mitigación: key separado, ambiguousStock refinado, el GATE comercial-stock dedicado, controles de "stock" pelado + unidades.
2. **La colisión registry "stock"(inv) vs QI "stock"(comercial).** Rename a `capital` + domainRegistry + el consistency test.
3. **El filtro Def2 (inmovilizado).** Que "inmovilizado" rankee solo los Def2 (LG-DRYER, no SAM-REF). Mitigación: reusa la def del motor + oráculo (LG-DRYER $13.6K).
4. **GATE PRINCIPAL (rotación+DOH en baseline).** git-stash contra 8988040.
5. **Tamaño/wrinkle.** Por eso recomiendo el split (aísla la ambigüedad).

---

## 8 · Para aprobar
1. ¿**SPLIT** (2.5c-1 capital+desambiguación / 2.5c-2 inmovilizado Def2) **o ENTERO**? (recomiendo split por el wrinkle de "stock".)
2. ¿Capital = stockUSD (key NUEVO `capital`), **sin pisar el "stock=unidades" comercial** (rename registry stock→capital, ambiguousStock refinado)?
3. ¿Inmovilizado = capital + filtro Def2 (reusa `_capitalInmovilizado`)?
4. ¿Polaridad `higherIsWorse` (más capital detenido = peor)? ¿Flag(s) default OFF?
5. ¿El **GATE COMERCIAL-STOCK** (unidades intacto) + el RED gate + el GATE PRINCIPAL (rotación+DOH en baseline)?

Con tu OK (y la decisión split/entero) traigo el plano fino del primer sub-ladrillo (o construyo entero), corro TODAS las pruebas (**sobre todo el GATE comercial-stock + el RED gate + el GATE PRINCIPAL**), dejo el flag OFF, listo la supersesión, limpio tareas, y reporto. **No toqué `src/` — plano puro.**
