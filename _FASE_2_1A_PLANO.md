# Fase 2.1a — Plano + Red-team

> Substrato del Intent Resolver sin "por": **Semantic Layer + Availability Map formalizados**, montados como fuente de verdad de UN slice que **mueve el oráculo** (no plomería suelta). Plano puro — se aprueba y recién ahí se construye. Flag default OFF, reversible byte-exacto.

---

## 0 · El pago de conducta (por qué NO es plomería invisible)

2.1a no aterriza como substrato mudo. Viaja dentro de **un arreglo de conducta verificable**:

| Pregunta (lenguaje humano) | HOY | CON 2.1a |
|---|---|---|
| **qué marca tiene peor contribución** | 🔴 "Unimarc · $750K" (un **cliente** — adyacente) | ✅ "Bosch · $3M" (la **marca** real, consistente con la tabla de "contribución por marca") |

El dato YA existe ("contribución por marca" computa la tabla Samsung/Philips/LG/Bosch). Lo único roto es la **resolución de la dimensión** ("marca" cae a un ranking de clientes). Ese es exactamente el trabajo del substrato: el **Semantic Layer** dice "marca es una dimensión de primera clase, distinta de cliente"; el **Availability Map** confirma "contribución/márgenes está disponible"; y se reusa el cómputo probado. **Un 🔴 del re-test → ✅**, con la pieza de arquitectura que sostiene 2.1b/c/2.5 después.

---

## 1 · Qué construye exactamente

### A. Semantic Layer (registros declarativos · fuente única ensamblada, no reinventada)
Tres registros nuevos en `src/config/semantic/` que **consolidan** lo disperso (sin recalcular nada):
- **`metricRegistry.js`** — cada métrica: `{ key, label, domain, formula, unit, vocabulary[], field_mapping, benchmark }`. Se **ensambla desde** `SEMANTIC_METRICS` (routerData) + `QI_METRIC_VOCAB` (qiRetrieval) + `RANKING_EXTREMES_METRICS` (rankingData) + la ontología. Por primera vez la fórmula queda **declarada** (margen = (venta−costo−rebates)/venta, etc.).
- **`dimensionRegistry.js`** — cada dimensión: `{ key, label, vocabulary[], source_dataset, precedence }`. Unifica el vocab de "cliente/marca/familia/sku" hoy disperso en 4 archivos, con **precedencia explícita** (la pieza que arregla "marca→cliente").
- **`domainRegistry.js`** — cada dominio: `{ key, exposes: [metricKeys], dimensions: [dimKeys] }` (ventas/márgenes/inventario).

> Estos registros **no cambian conducta por sí solos** — son leídos por el slice. Quedan listos para que 2.1b/c/2.5 los consuman.

### B. Availability Map (declarativo · generaliza el muro)
- **`src/adi/core/availabilityMap.js`** — `AVAILABILITY = { ventas:{status:'available'}, margenes:{status:'available'}, inventario:{status:'blocked', reason:'Fase 2.5', alternatives:['ventas','margenes']} }` + `isAvailable(domain, metric?)` + `unavailableMessage(domain, {filterName})`. Lee `ADI_QI_FILTER_ENABLED`/el flag spine. **El muro actual pasa a ser su primer cliente** (la lógica de `_inventarioAvisarMsg` se centraliza acá; el muro existente queda intacto hasta que lo migremos — coexistencia).

### C. El consumer slice (el que mueve el oráculo)
- **`src/adi/core/spine.js`** — orquesta el mini-pipeline SOLO para la firma "superlativo por dimensión SIN filtro": `qué/cuál [DIMENSIÓN] [peor/mejor/más/menos] [MÉTRICA]`. Pasos: resolver dimensión+métrica (Semantic Layer) → validar disponibilidad (Availability Map) → si disponible, armar plan y reusar el cómputo existente (la ruta marca/familia de QI o `composeRankingExtremes`) tomando el extremo pedido → si bloqueado, AVISAR vía el map. Produce internamente un **objeto-plan evidence-ready** (semilla del payload), pero **no lo emite todavía** (la emisión es 2.1d).
- **Wire:** un punto pre-dispatch en `answerADI.js`, gateado por flag, que **reclama la query SOLO si la dimensión pedida ≠ la dimensión que el camino viejo respondería** (el guard anti-overshadow). Si no, cae al camino de siempre.

---

## 2 · Cómo reusa lo que ya funciona

| Pieza probada | Uso en 2.1a |
|---|---|
| `SEMANTIC_METRICS`, `QI_METRIC_VOCAB`, `RANKING_EXTREMES_METRICS`, ontología | **Fuente** de los registros (ensamblados, no reinventados) |
| Detectores strict (`detectors.js`/`router.js`) | Distinguen la dimensión genérica ("marca") de un nombre de entidad ("Bosch") |
| El cómputo de "contribución por marca" (QI) / `composeRankingExtremes` | **El cálculo** del slice — mismo número, solo elige el extremo |
| Muro / `_inventarioAvisarMsg` | Su mensaje se centraliza en el Availability Map (lógica preservada) |
| Patrón flag maestro + sub-flag (Cabos/QI) | Idéntico: spine OFF = piso byte-exacto |

**Nada de cálculo se reescribe.** El slice es resolución + validación + selección del extremo sobre el cómputo existente.

---

## 3 · El oráculo (lenguaje humano real)

**RESPONDE** (disponible · era 🔴 o ausente):
- qué marca tiene peor contribución → **Bosch** (la peor)
- qué marca tiene mejor margen · qué familia aporta menos · cuál es la marca que menos contribuye

**AVISA** (dominio bloqueado · vía Availability Map, sin fuga):
- qué bodega tiene peor rotación · qué familia tiene peor DOH → "eso vive en inventario, Fase 2.5…"

**NO ROMPE** (cae al camino viejo, byte-idéntico):
- el cliente con peor margen (cliente pedido = cliente respondido ✅) · cuál es el SKU con peor rotación (ya avisa el muro) · todo lo demás

Cada una: **responde / avisa — nunca adyacente.**

---

## 4 · Flags (default OFF)

- **`ADI_CORE_SPINE_ENABLED = false`** — paraguas de toda la Fase 2.1 (como fue `ADI_QI_FILTER_ENABLED` para el puente).
- **`ADI_SPINE_DIM_SUPERLATIVE_ENABLED = false`** — el slice de conducta de 2.1a. Requiere el paraguas ON.

Ambos OFF → el spine es inerte, el piso vuelve byte por byte.

---

## 5 · Los gates (evidencia que voy a ejecutar)

1. **Flag OFF → piso byte-exacto:** 47 PARITY 47 · canónica 10/10+6/6 · extendida 19. (El spine no agrega nada apagado.)
2. **Flag ON · RESPONDE:** las 4 del oráculo responden la dimensión correcta; "qué marca tiene peor contribución" = **Bosch**, número idéntico a la fila de "contribución por marca".
3. **Flag ON · AVISA:** las de inventario → AVISAR vía Availability Map, **cero dato de inventario**.
4. **Flag ON · NO ROMPE (anti-overshadow):** las que ya andaban (el cliente con peor margen, etc.) **byte-idénticas** al flag OFF (shadow-diff: el spine cae al viejo).
5. **Corpus intacto flag-ON:** ninguna de las 47/19/canónicas matchea la firma del slice → byte-idénticas (lo verifico explícito).
6. **Consistencia del Semantic Layer:** test que asegura que los registros ensamblados **coinciden** con los configs vivos para el slice cubierto (sin drift).
7. **Availability Map:** test unitario de `isAvailable` por dominio/métrica.

---

## 6 · Blast radius

Archivos NUEVOS (3 registros + availabilityMap + spine) + **1 punto de wire** en `answerADI.js` (pre-dispatch, gateado) + 2 flags. **Flag OFF = cero cambio.** Flag ON = solo cambian las queries que matchean la firma "superlativo por dimensión sin filtro con mismatch de dimensión" (los 🔴→✅ + el inventario-AVISA). Reversible byte-exacto. No toca ningún composer, ni `applyFiltros`, ni el muro existente.

---

## 7 · Reporte crítico — dónde será frágil (red-team)

1. **Colisión dimensión-genérica vs nombre-de-entidad.** "marca"/"familia" como palabra-dimensión vs "Bosch"/"Makita" como valor. Si la precedencia se equivoca, "qué marca…" podría leerse como un filtro. *Mitigación:* el slice exige el **sustantivo de dimensión genérico**; los detectores strict ya separan genérico de específico; lo cubre el gate #2 con variantes.
2. **Overshadow (el espejo de [39]).** Si la firma es muy ancha, roba queries que ya andan ("el cliente con peor margen"). *Mitigación dura:* el slice reclama **SOLO cuando la dimensión pedida ≠ la que el camino viejo respondería** (mismatch). Shadow-diff (gate #4) lo prueba: si el viejo ya acierta, cae. **Este es el riesgo #1 — el guard de mismatch es la red.**
3. **Inconsistencia con "contribución por marca".** El extremo elegido debe dar el mismo número que la tabla existente. *Mitigación:* reusar el **mismo cómputo**, solo elegir el bottom; gate #2 compara números.
4. **Drift del registro ensamblado.** Si el Semantic Layer nuevo discrepa de los 4 configs dispersos que consolida, la conducta cambia sutil. *Mitigación:* ensamblar **desde** ellos (unión) + test de consistencia (gate #6).
5. **Granularidad del Availability Map.** "márgenes disponible" pero alguna métrica borde se cuela. *Mitigación:* el map es **a nivel métrica**, default-deny para lo no modelado.
6. **Cobertura de sinónimos** ("aporta"/"rinde"/"contribución"). Si falta un sinónimo, esa query **cae al viejo** (seguro — no gana esa, no rompe nada). *Mitigación:* reusar el vocab de la ontología.

**Honestidad:** el riesgo real de 2.1a es el **overshadow** (#2). Por eso el slice es deliberadamente angosto (sin filtro, solo mismatch de dimensión) y el guard cae-al-viejo es la red. Si en build descubro que la firma es más ancha de lo creído (roza queries que andan), **es timón #2 (cambio de alcance) → freno y consulto**, no fuerzo.

---

## 8 · Qué queda FUERA de 2.1a (declarado)

- **Filtros** ("el peor margen **de** Bosch", "ventas de Samsung **en** Falabella") → 2.1b/c.
- **Retrieval general sin "por"** → 2.1b.
- **Emisión del Evidence Payload** al envelope → 2.1d (2.1a produce el plan internamente, no lo emite).
- **~12 composers paramétricos** → Fase 3. **Inventario modelado** → Fase 2.5.

---

## 9 · Decisiones de timón (para que apruebes) vs las que decido solo

**Timón — necesito tu OK (decisión #1: cambia lo que ADI responde de cara al usuario):**
- "qué marca tiene peor contribución" pasa de **"Unimarc" (cliente, adyacente)** a **"Bosch" (la peor marca)**, y simétricas (mejor/peor × marca/familia × las métricas comerciales). Es un **arreglo** (un 🔴→✅), reversible, flag-gated — pero es conducta visible nueva, así que lo apruebo con vos antes de construir. *No hay bifurcación de producto acá: hay una sola respuesta correcta.*

**Decido solo (técnico · listado por transparencia, no para que opines):** nombres y estructura de archivos, cómo ensamblo los registros, la detección de la firma, el mecanismo del guard anti-overshadow, los nombres de flags, la forma del objeto-plan interno.

**Timón #2/#3/#4: no aplican en 2.1a** — el alcance es el planeado, no hay fork de producto, y nada se enciende en vivo (el flag queda OFF; producción la decidís vos más adelante). Si alguno aparece en build, freno en el acto.

---

## 10 · Para aprobar
1. ¿El **pago de conducta** de 2.1a (el slice "superlativo por dimensión sin filtro", "qué marca tiene peor contribución" → Bosch)?
2. ¿La **conducta visible nueva** (timón #1 de §9)?

Con eso, construyo 2.1a flag por flag, gate verde tras cada uno, y reporto al cierre. **Cero `src/` hasta tu OK.**
