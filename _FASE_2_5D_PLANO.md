# Fase 2.5d — Bodega (la última métrica · cierra la Etapa 3) · Plano + Red-team

> Bodega NO es una métrica: es una DIMENSIÓN NUEVA (un eje para agrupar: capital por bodega, rotación por
> bodega) + un filtro ("stock de Antofagasta"). Es la pieza más grande del inventario y el momento donde la
> red de "avisar lo no modelado" se queda sin métricas de inventario que bloquear. Plano puro — se aprueba y
> recién ahí se construye. Flag default OFF.

---

## 0 · LECTURA DE TAMAÑO → MEDIO-GRANDE (dimensión nueva · cruza TODAS las métricas) · recomiendo ENTERA con escape
Las anteriores (rotación/DOH/capital) eran MÉTRICAS sobre el eje SKU (reusaban dim=sku). Bodega es un **EJE nuevo**: composeRetrieval **NO tiene dim=sucursal** (cae a null) y applyFiltros **no filtra por bodega**. Hay que construir el group-by-bodega (cruza capital/rotación/DOH × bodega) + el filtro. **Mi lean: ENTERA** (es la última, las piezas son un concepto: bodega), **con escape:** si el group-by × todas las métricas crece, freno y propongo 2.5d-1 (bodega dimensión + la transición) / 2.5d-2 (bodega filtro + "complicada"). Vos confirmás.

| Pieza | Tamaño |
|---|:--:|
| dim=sucursal (group-by bodega · agregación por unidad: $ suma, x/d promedio) | Medio |
| bodega como filtro ("stock de Antofagasta") | Chico |
| "qué bodega está complicada" (definición) | Chico |
| 🔑 La transición (atomicidad inerte · 2.2c-3 RED · regla madre) | Conceptual |

---

## 1 · BODEGA = DIMENSIÓN (no métrica) · cómo se cruza con las métricas
- **"capital por bodega"** = la métrica `capital` sobre el eje `bodega` → bodegas rankeadas por Σ stockUSD. **"rotación/DOH por bodega"** = el promedio por bodega. (Reusa la def de `_aggregateBySucursal` warehouse.js:33-57: totalStock suma, dohPromedio avg.)
- **Mecanismo:** composeRetrieval gana un branch `dim==="sucursal"` → agrupa `skuInventario` por bodega → agrega la métrica según su unidad (`$`/capital → suma · `x`/`d` → promedio · vía `METRIC_REGISTRY[m].unit`). Es el espejo del branch dim=marca (que ya agrupa+agrega dinámicamente). 4 bodegas: Santiago/Valparaíso/Concepción/Antofagasta.
- **Bodega como FILTRO:** "stock de Antofagasta" → `detectAllWarehousesInText` ya detecta "Antofagasta" → filtra skuInventario por bodega → ranking de SKUs en esa bodega por capital.
- **`QI_DIMENSION_VOCAB.sucursal` ya tiene bodega/sucursal** → queryInterpreter ya la detecta; falta el branch en composeRetrieval + el filtro. Agrego `sucursal` al `DIMENSION_REGISTRY` (reachableByLegacy:false · para el dim-target guard).

---

## 2 · "qué bodega está más complicada" (la definición · confirmá)
"complicada" es vago — hay que elegir la métrica que lo define. **Mi propuesta: la bodega con más CAPITAL INMOVILIZADO (Def2 · la plata atrapada · el lente más accionable para un dueño)** → **Valparaíso $24.8K** (LG-DRYER $13.6K + BOS-SANDER $11.2K). (Alternativa: el peor DOH promedio → Antofagasta ~111d. Reusa `inmovilizadoDef2USD`/`dohPromedio` de `_aggregateBySucursal`.) **Decime si "complicada" = capital inmovilizado (mi propuesta) o DOH.**

---

## 3 · EL ORÁCULO (lenguaje humano · dato REAL)
| Pregunta | Resuelve | Resultado |
|---|---|---|
| **"capital por bodega"** | dim=sucursal · capital | Valparaíso $X, Santiago $Y... (ranking de bodegas) |
| **"qué bodega está más complicada"** | dim=sucursal · inmovilizado | **Valparaíso** ($24.8K inmovilizado) |
| **"stock de Antofagasta"** | filtro bodega | SKUs de Antofagasta por capital (MAK-COMP-AIR $8.4K, MAK-SAW18V $4.4K) |
| **"rotación por bodega"** | dim=sucursal · rotación avg | bodegas por rotación promedio |

---

## 4 · 🔑 LA TRANSICIÓN (el momento donde la red se queda sin qué bloquear en inventario)
Con bodega modelada, **TODAS las métricas/ejes de inventario están disponibles** (rotación, DOH, capital, inmovilizado, bodega). Qué pasa con los guards:
- **El guard de atomicidad** (`_INV_CONCEPTS`: AVISA si una métrica nombrada NO está disponible) → **se vuelve INERTE para inventario** (todas disponibles → nunca dispara). Es CORRECTO: cuando todo está modelado, no hay "mezcla modelada + no-modelada". No lo borro — queda como red para futuros dominios bloqueados; simplemente no tiene qué bloquear en inventario.
- **El control de 2.2c-3 RED** usaba bodega como métrica-bloqueada-de-prueba. Bodega ya responde → cambio T1 a una **query NO SOPORTADA** (un cruce que el dato no sostiene · ej. "rotación por canal" — canal no es eje de inventario) → AVISA. La anti-fuga del corte sigue probándose, ahora contra lo no-soportado (no lo no-modelado).
- **La regla madre NO desaparece** — su "avisa el resto" PASA de "métrica no modelada" a "**dimensión/cruce no soportado por el dato**". El dim-target guard + la validación del QI (unsupported_clauses) la sostienen.

---

## 5 · 🔑 LA REGLA MADRE — inventario disponible ≠ "responde cualquier cosa" (la verificación que pediste)
"Disponible" = responde lo que el dato sostiene · **avisa el resto.** Con inventario entero, lo que SIGUE AVISANDO:
| Query no soportada | Por qué | Resuelve |
|---|---|---|
| **"rotación por canal"** | canal no es eje de inventario (skuInventario no tiene canal) | **AVISA** |
| **"rotación por marca"** | rotación-agregada-por-marca no la sostiene el dato (rotación es por SKU; el group-by marca es comercial) | **AVISA** |
| **"inventario por cliente"** | cliente no es eje de inventario | **AVISA** |
| cruces marca+cliente (2.1c) | el dato no tiene el cruce | **AVISA** |

**El RED de la regla madre:** estas devuelven AVISA honesto, cero número inventado. Inventario disponible = "responde lo que el dato de inventario sostiene (las métricas × SKU/bodega + filtros marca/familia/bodega), avisa el resto".

---

## 6 · 🚨 LA TRAMPA + RED GATE
1. La respuesta de bodega ($ / x / d) → coherente con la métrica · cero cruce con otra.
2. **🚨 RED GATE:** "rotación por canal"/"inventario por cliente" (no soportado) → **AVISA** (la regla madre). Un número inventado para un cruce no soportado → FALLA.
3. La atomicidad inerte NO abre fugas (todo inventario disponible es legítimo).

---

## 7 · EL BLINDAJE
- **🛡️ GATE PRINCIPAL:** régimen + rotación/DOH/capital/inmovilizado ON + **bodega OFF == HEAD (467c58c)** byte-idéntico (git-stash · "capital por bodega"/"qué bodega" → AVISA como hoy).
- **Piso byte-exacto (todo OFF):** 47/47 + 10/10+6/6 + 19.
- **Comercial + las otras métricas intactas** + **shadow-diff** (solo cadenas de bodega · 0 overshadow) + **combinado (20 flags)**.
- **Regla madre:** los no-soportados AVISAN con bodega ON y OFF (no es que bodega los abra).
- **Blast radius:** voiceFlags (flag) + qiRetrieval (dim=sucursal branch + filtro bodega) + spine (resolver dim=sucursal + "complicada") + dimensionRegistry (sucursal) + el 2.2c-3 RED control. ~4-5 archivos.

---

## 8 · LA SUPERSESIÓN DE BODEGA (AVISA → RESPONDE) — la listo
Casos de bodega en los harnesses viejos: Fix C "cómo está el inventario"/"cómo está Santiago"/"Santiago vs Valparaíso" + "qué bodega está complicada". **Atención:** "cómo está Santiago" hoy rutea a `warehouse_dive` (un bundle operacional) — confirmar si lo reclamo por el camino modelado (dim=sucursal) o sigue gated. Lo listo cada uno con dato + evidence + cero fuga.

---

## 9 · REPORTE CRÍTICO — dónde será frágil
1. **El group-by-bodega × todas las métricas** (suma vs promedio por unidad). Mitigación: por `unit` ($ suma · x/d avg) + reusa `_aggregateBySucursal`.
2. **🔑 La transición (regla madre).** Que lo no-soportado siga AVISANDO cuando ya no hay métrica bloqueada. Mitigación: el RED de la regla madre (rotación por canal → AVISA) + el dim-target guard.
3. **"complicada" mal definida.** Mitigación: definición explícita (inmovilizado · confirmás).
4. **warehouse_dive (bundle)** vs el camino modelado. Decisión al construir; lo reporto.
5. **El tamaño.** Si el group-by crece, timón #2 → split.

---

## 10 · Para aprobar
1. ¿Bodega = DIMENSIÓN (group-by · capital/rotación/DOH por bodega) + FILTRO ("stock de Antofagasta")?
2. ¿"complicada" = **capital inmovilizado** (mi propuesta · Valparaíso) o DOH?
3. ¿La **transición**: atomicidad inerte (queda como red para futuros dominios) + 2.2c-3 RED → no-soportado?
4. ¿La **regla madre** verificada (rotación por canal / inventario por cliente → AVISA · inventario ≠ "responde cualquier cosa")?
5. ¿Flag `ADI_INV_BODEGA_ENABLED` OFF + el GATE PRINCIPAL + RED gate?
6. ¿**ENTERA** (con escape a split si el group-by crece)?

Con tu OK construyo, corro TODAS las pruebas (el RED de la regla madre · el GATE PRINCIPAL · la distinción bodega), dejo el flag OFF, listo la supersesión, limpio tareas, y reporto. Y al cerrar bodega, armo el **balance de la Etapa 3** + la **verificación de la regla madre** que pediste. **No toqué `src/` — plano puro.**
