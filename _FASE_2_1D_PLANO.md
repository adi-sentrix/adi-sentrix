# Fase 2.1d — Plano + Red-team (Evidence Payload)

> Cada respuesta del spine (2.1a/2.1b/2.1b-2) emite su **evidence payload** —el respaldo trazable— desde
> el MISMO cálculo que produjo la respuesta. Aditivo: campo hermano `evidence`, null en el camino viejo,
> ignorado por la UI hasta Fase 4, **texto byte-idéntico**. Es la infraestructura que conecta ADI con
> Sentrix desde el cálculo. Plano puro — se aprueba y recién ahí se construye. Flag default OFF.

---

## 0 · El pago de conducta (no es plomería invisible)
Hoy los casos del spine responden bien pero **sin respaldo verificable** — el número sale, pero no hay
forma de auditar cómo. Con 2.1d, cada respuesta del spine trae su **trazabilidad completa**:

| Pregunta | Respuesta (HOY, intacta) | + Evidence (2.1d, NUEVO) |
|---|---|---|
| el peor margen de Bosch | "BOS-SANDER es el SKU de Bosch con menor margen · 18.0%." | `{metrica:"margen", dimension:"sku", filtros:{marcas:["Bosch"]}, periodo:"bonanza", formula:"(venta−costo−rebates)/venta", fuente:"skusMargen", filas_usadas:2, confianza:"determinística", unsupported_clauses:[]}` |

**Mejora verificable:** los casos del spine pasan de "respondé y confiá" a "respondé y acá está la cuenta".
Se prueba con un test que valida el payload completo y correcto por caso. **No es plomería suelta — viaja
dentro de respuestas que ya funcionan y las hace auditables.**

---

## 1 · Qué construye exactamente

Cada slice del spine ya produce un **`_plan`** (semilla evidence-ready: metric/dimension/filtros/direction/
domain/formula/rows_used). 2.1d lo **completa** a los 10 campos del NORTE y lo **emite** en el retorno:

```js
evidence: {
  query_plan:   { metrica, dimension, filtros, operacion },   // la intención estructurada resuelta
  metrica:      "margen",
  dimension:    "sku",
  filtros:      { marcas: ["Bosch"] },        // {} si sin filtro
  periodo:      "bonanza",                     // el escenario activo (state.scenario)
  formula:      "(venta − costo − rebates) / venta",   // del Semantic Layer (metricRegistry.formula)
  fuente:       "skusMargen",                  // el dataset REAL que usó el cálculo (mapa dim→dataset)
  filas_usadas: 2,                             // rows del cómputo (materialMetrics.length / tabla)
  confianza:    "determinística",
  unsupported_clauses: [],                     // [] si RESPONDE; poblado si AVISÓ/ACLARÓ
}
```

- **`operacion`** = rank_bottom / rank_top (superlativo) · retrieve (tabla) · clarify · avisar.
- **`fuente`** = mapa dim→dataset (cliente/marca→clientesMargen · sku/producto→skusMargen · familia→sfamiliasMargen · métrica inventario→skuInventario).
- **TODAS las ramas del spine emiten payload** (NORTE: "si una respuesta no puede emitir su payload, no está terminada"):
  - RESPONDE (superlativo/tabla) → `unsupported_clauses: []`.
  - ACLARAR (sin métrica) → `[{kind:"metric_missing", options:["ventas","margen","contribucion"]}]`.
  - AVISAR inventario → `[{kind:"domain_unavailable", raw:"inventario", phase:"2.5"}]`.
  - AVISAR combinado → `[{kind:"cross_dimension", raw:"marca×cliente"}]`.

---

## 2 · Cómo lo hace ADITIVO (la trampa central: cero cambio de texto)

- **Campo hermano `evidence` en el retorno**, NUNCA concatenado al `.text`. El texto visible no cambia ni un carácter.
- **El spine arma `evidence` y `_plainWrap` lo pasa al retorno** (gateado por `ADI_SPINE_EVIDENCE_ENABLED`). Si no hay `_plan` (camino viejo / AVISAR no-spine / inversa) → `evidence: null`.
- **Solo toca el camino del spine** (`_plainWrap` + los slices). `_finalize` (los N composers) NO se toca — su evidence es Fase 4 / follow-up.
- **La UI lo ignora** hasta Fase 4 (no lee el campo nuevo).

---

## 3 · Cómo reusa `buildResponseContract`

`buildResponseContract` (helpers.js L31-58) **ya tiene el slot `evidence`** (default null) + `confidence` + `materialMetrics`. 2.1d **usa ese mismo slot como schema canónico**: el `evidence` del spine vive en el mismo campo que el contrato ya define → forma consistente con el resto del sistema. `materialMetrics` (que el spine ya recibe de `composeRetrieval`) entra como las filas-evidencia. No invento un schema nuevo: pueblo el que existe.

---

## 4 · El oráculo (cada caso del spine trae su payload completo y correcto)

| Caso | metrica/dim/filtros | fuente · filas · fórmula | unsupported_clauses |
|---|---|---|---|
| el peor margen de Bosch | margen / sku / {marcas:[Bosch]} | skusMargen · 2 · (v−c−r)/v | [] |
| qué cliente Samsung vende más | ventas / cliente / {marcas:[Samsung]} | clientesMargen · 4 · Σv | [] |
| carga comercial de los clientes de Bosch | carga / cliente / {marcas:[Bosch]} | clientesMargen · 2 · r/v | [] |
| qué marca tiene peor contribución (2.1a) | contribucion / marca / {} | clientesMargen(agr) · 4 · v−c−r | [] |
| el mejor SKU de Bosch (2.1b-2 ACLARAR) | — / sku / {marcas:[Bosch]} | — | [{metric_missing}] |
| qué SKU de Bosch rota peor (AVISAR inv) | rotacion / sku / {marcas:[Bosch]} | skuInventario | [{domain_unavailable: inventario}] |
| ventas de Samsung en Falabella (AVISAR comb) | ventas / — / {marcas:[Samsung]} | — | [{cross_dimension}] |

Cada uno: el payload **coincide con la respuesta** (mismo número de filas, misma métrica, mismo filtro) — se construye del **mismo `_plan`**, no se recalcula.

---

## 5 · Shadow-diff (el texto NO cambió mientras el payload viaja al lado)

Dos pruebas:
1. **Texto byte-idéntico:** evidence **ON vs OFF** (ambos con spine ON), sobre todo el probe set (oráculo + controles + corpus) → el **`.text` byte-idéntico** en TODAS; lo único que aparece es el campo `evidence`. **Si un solo carácter del texto cambia → ROJO.**
2. **Piso byte-exacto:** todos los flags OFF → 47 PARITY 47 + canónica + extendida (la batería compara `.text`).

Además, el camino viejo (non-spine) → `evidence: null` (no se cuela payload donde no hay `_plan`).

---

## 6 · Flags · Blast radius

**Flag:** `ADI_SPINE_EVIDENCE_ENABLED = false` (bajo el paraguas · independiente de los otros spine flags · default OFF). Así el spine puede responder sin emitir, o emitir.

**Blast radius:** los slices arman `evidence` (extienden `_plan`) + `_plainWrap` pasa `evidence` al retorno + 1 flag + 1 mapa dim→dataset. **Cero cambio en `composeRetrieval`/`applyFiltros`/`_finalize`/la UI.** Flag OFF → `evidence` ausente/null → idéntico a 2.1a/b/b-2. El `.text` nunca cambia (con o sin flag).

---

## 7 · Reporte crítico — dónde será frágil

1. **El texto cambia (riesgo CENTRAL).** Mitigación: `evidence` es campo hermano, jamás tocado al armar `.text`. El shadow-diff de texto (evidence ON vs OFF → `.text` idéntico) + la batería byte-exacta son la prueba. Si aparece UN carácter de diff en el texto → rojo, freno.
2. **El payload incorrecto** (presente pero miente). Ej: `filas_usadas` no coincide con las filas reales, o `fuente` equivocada. Mitigación: se construye del **mismo `_plan`/`materialMetrics`** que produjo la respuesta (single source) — no se recalcula. Test que valida cada campo contra el valor conocido por caso.
3. **`fuente` mal mapeada** (dim→dataset). Mitigación: el mapa deriva del MISMO `dimKey` que usó `composeRetrieval` para resolver el dataset. Test: la fuente de "el peor margen de Bosch" es `skusMargen`, no `clientesMargen`.
4. **AVISAR/ACLARAR sin payload** (olvidar emitir en esas ramas). Mitigación: armar `evidence` en TODAS las ramas del spine (RESPONDE + ACLARAR + AVISAR), con `unsupported_clauses` poblado. Test que cada ruta `spine_*` trae evidence.
5. **La UI lo lee antes de Fase 4** y rompe. Mitigación: el campo es nuevo, la UI no lo consume; `buildResponseContract` ya tenía `evidence` como slot ignorado. Cero cambio de UI en 2.1d.
6. **Acoplar evidence a un flag mal** (que apagar evidence cambie el texto). Mitigación: el flag SOLO decide si el campo `evidence` se emite; el cálculo y el texto son idénticos con o sin él.

---

## 8 · Para aprobar
1. ¿El **alcance** (2.1d = los casos del SPINE emiten payload; los N composers y la UI de Sentrix quedan para Fase 4)?
2. ¿La **forma del payload** (los 10 campos del NORTE en el slot `evidence` de `buildResponseContract`)?
3. ¿El **flag** `ADI_SPINE_EVIDENCE_ENABLED` independiente (se puede tener spine respondiendo sin emitir, o emitiendo)?

> **Nota de timón:** 2.1d **no cambia qué responde ADI de cara al usuario** (el texto es byte-idéntico; el payload es un campo que la UI ignora hasta Fase 4). Así que **no toca timón #1** — es infraestructura aditiva, reversible. La apruebo igual como pieza (plano + red-team) por método.

Con eso construyo 2.1d, corro todas las pruebas (incluido el shadow-diff de texto-idéntico + la validación del payload por caso), dejo el flag OFF, y reporto.
