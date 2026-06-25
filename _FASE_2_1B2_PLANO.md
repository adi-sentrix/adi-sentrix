# Fase 2.1b-2 — Plano + Red-team (filtro + superlativo SIN métrica → ACLARAR)

> Afinamiento de 2.1b (mismo slice `resolveFilteredRetrieval`). Cierra el boundary que mostró el re-test:
> "el mejor SKU de Bosch" / "el peor cliente de Philips" (filtro + superlativo, SIN métrica explícita) hoy
> caen al viejo, que IGNORA el filtro. Con 2.1b-2, ADI **PREGUNTA cuál métrica** (regla madre: ante lo
> ambiguo, aclara — nunca elige en silencio), con las métricas disponibles del dominio tomadas del Semantic
> Layer. Plano puro — se aprueba y recién ahí se construye. Flag default OFF.

---

## 0 · Numeración (decisión de método)
**Entra como 2.1b-2**, no como pieza con número propio. Razón: es la MISMA función `resolveFilteredRetrieval`, una rama nueva en el punto donde hoy hace `if (!metricKey) return null`. 2.1c queda para el combinado marca+cliente (otra cosa). Tablero ordenado: 2.1a → 2.1b → **2.1b-2** → 2.1c → 2.1d.

---

## 1 · El pago de conducta

| Pregunta (filtro + superlativo, SIN métrica) | HOY (2.1b) | CON 2.1b-2 |
|---|---|---|
| **el mejor SKU de Bosch** | 🔴 brand_dive (lista los SKUs de Bosch, ignora "mejor") | ✅ "¿El mejor SKU de Bosch en qué: ventas, margen o contribución?" |
| **cuál es el peor cliente de Philips** | 🔴 brand_dive (overview de Philips, ignora "peor cliente") | ✅ "¿El peor cliente de Philips en qué: ventas, margen o contribución?" |

ADI deja de ignorar el filtro en silencio. Pregunta lo que falta.

---

## 2 · Qué construye exactamente

UNA rama nueva en `resolveFilteredRetrieval` (spine.js), donde hoy está `if (!metricKey) return null`:

```
detecta filtro (marca/familia) → detecta superlativo → detecta métrica
  · CON métrica   → RESPONDE (camino 2.1b actual · INTACTO)
  · SIN métrica:
      · + superlativo + filtro  → ACLARAR (rama nueva, gated)   ← 2.1b-2
      · sin superlativo          → return null (cae al viejo · como hoy)
```

- **Reordeno** la detección (superlativo + dimensión ANTES del check de métrica) — técnico, mío.
- **La rama ACLARAR** arma: `¿{mejor/peor} {dimensión} de {filtro} en qué: {métricas del dominio}?`
  - `{mejor/peor}` ← la dirección detectada · `{dimensión}` ← SKU/cliente/familia (explícita o inferida) · `{filtro}` ← la marca/familia nombrada.
  - **`{métricas del dominio}` se toman del Semantic Layer** (NO hardcodeadas): las métricas del `domainRegistry` de los dominios DISPONIBLES (Availability Map) que tienen `qiKey` → ventas, margen, contribución. **Nunca lista métricas de inventario** (bloqueadas) → cero Cabo-2 leak.
- Ruta: `spine_filter_clarify`. Devuelve `{ opener, suggestions: [las métricas como opciones], _spine }`.

---

## 3 · Cómo distingue de los casos CON métrica (la trampa central)

**El discriminador es `metricKey`** — el MISMO que ya usa 2.1b:
- "el peor margen **de Bosch**" → detecta `margen` → metricKey set → **RESPONDE (intacto)**, nunca llega a la rama ACLARAR.
- "qué cliente Samsung **vende** más" → detecta `ventas` (vía "vende") → RESPONDE.
- "qué SKU de LG más débil **en margen**" → detecta `margen` → RESPONDE.
- "el mejor SKU de Bosch" → metricKey **null** + superlativo + filtro → **ACLARAR**.

La rama ACLARAR vive DENTRO del `if (!metricKey)`. Si hay métrica, ni se evalúa. **Imposible que robe un caso que responde** — para llegar a ACLARAR, la métrica tiene que ser null, y si es null, 2.1b ya caía al viejo (no respondía). El shadow-diff lo prueba byte a byte.

---

## 4 · El oráculo (lenguaje humano)

**ACLARAR (vago · sin métrica):**
- el mejor SKU de Bosch → ¿en qué: ventas, margen o contribución?
- cuál es el peor cliente de Philips → ¿en qué: …?
- el peor producto de LG → ¿en qué: …?

**RESPONDE — siguen INTACTOS (con métrica explícita):**
- el peor margen de Bosch → BOS-SANDER 18% (NO pregunta)
- qué cliente Samsung vende más → Falabella (NO pregunta)
- qué SKU de LG más débil en margen → LG-DRYER8KG (NO pregunta)
- qué producto de Samsung rinde menos en margen → SAM-TV55 (NO pregunta)

**Cae al viejo — sin cambio:**
- el margen de Bosch (métrica pero SIN superlativo) → brand_dive (como hoy)
- el mejor cliente (superlativo SIN filtro) → ranking_extremes (no es esta rama)

---

## 5 · Shadow-diff anti-overshadow

Corpus 47 + extendida 19 + re-test, flag ON vs OFF. **Lo único que puede cambiar son los casos {filtro + superlativo + SIN métrica}** (V1/V4 del re-test → de brand_dive a spine_filter_clarify). Controles que DEBEN quedar byte-idénticos:
- "el peor margen de Bosch" (con métrica) → **sigue RESPONDE BOS-SANDER**, no pregunta. ← **si pregunta, es ROJO** (la trampa que marcaste).
- "qué cliente Samsung vende más" → sigue Falabella.
- "el mejor cliente" → sigue ranking_extremes.
- todos los de 2.1a/2.1b/Fix/Cabo → byte-idénticos.

---

## 6 · Flags · Blast radius

**Flag:** `ADI_SPINE_FILTER_CLARIFY_ENABLED = false` (bajo el paraguas · requiere `ADI_SPINE_FILTER_ENABLED` ON). Default OFF. Así se puede tener 2.1b sin la rama, o con ella.

**Blast radius:** una rama nueva dentro de `resolveFilteredRetrieval` + 1 flag. Cero archivos nuevos, cero cambio en `composeRetrieval`/`applyFiltros`. Flag OFF → `resolveFilteredRetrieval` se comporta exactamente como 2.1b (la rama no existe). Reversible byte-exacto.

---

## 7 · Reporte crítico — dónde será frágil

1. **La trampa (robar RESPONDE) — riesgo #1.** Mitigación estructural: la rama vive dentro de `if (!metricKey)`. Si la métrica se detecta (vocab de 2.1b, sin cambio), nunca se llega a ACLARAR. El shadow-diff con "el peor margen de Bosch" como control es la prueba: si ese empieza a preguntar → rojo, freno.
2. **Métrica presente pero NO detectada (vocab gap) → ACLARAR equivocado.** Si un sinónimo de métrica falta en el registry, el query iría a ACLARAR en vez de RESPONDE. Mitigación: el vocab es el de 2.1b (no lo toco); si 2.1b ya responde un caso, 2.1b-2 no lo toca. Los que hoy caen al viejo por vocab-gap, igual mejoran (ACLARAR > ignorar el filtro).
3. **La lista de métricas NO puede ofrecer inventario** (Cabo 2). Mitigación: se toma del `domainRegistry` de dominios DISPONIBLES (Availability Map) → solo ventas/margen/contribución. Test: "el mejor SKU de Bosch" → la pregunta NO menciona rotación/DOH/stock.
4. **El follow-up es 2.2, no esto.** 2.1b-2 PREGUNTA (single-turn). Si el usuario responde "margen" suelto, resolver eso (recordar filtro+superlativo del turno anterior) es **multi-turno = Fase 2.2**. Acá la UX es: ADI pregunta → el usuario re-pregunta completo ("el mejor SKU de Bosch en margen") → 2.1b responde. Lo declaro como boundary (no auto-resuelve la respuesta del usuario; eso es 2.2).
5. **Superlativo sin filtro NO debe entrar.** La rama exige `filterValue` (marca/familia). "el mejor cliente" (sin filtro) → no entra, cae a ranking_extremes. Mitigación: el guard de filtro.

---

## 8 · Para aprobar
1. ¿La numeración **2.1b-2** (afinamiento de 2.1b)?
2. ¿El **pago de conducta** (filtro+superlativo sin métrica → ACLARAR con ventas/margen/contribución)?
3. ¿La **conducta visible nueva** (timón #1: "el mejor SKU de Bosch" pasa de brand_dive a una pregunta)?

Con eso construyo 2.1b-2 (rama + flag), shadow-diff verde con "el peor margen de Bosch" como control anti-trampa, flag OFF, y reporto.
