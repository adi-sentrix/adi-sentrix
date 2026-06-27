# Fase 2.5c-2 — Inmovilizado fino (Def2) · Plano + Red-team

> El segundo pedazo del capital: que "capital inmovilizado"/"capital detenido" pase de la VISTA AMPLIA (todos
> los SKUs por stockUSD, 2.5c-1) al SUBCONJUNTO Def2 (solo los realmente detenidos · alerta crit/warn O
> rotación<2), reusando la def de `_capitalInmovilizado`. Plano puro — se aprueba y recién ahí se construye. Flag OFF.

---

## 0 · LECTURA DE TAMAÑO → CHICA (un filtro sobre lo ya construido) · ENTERA · confirmado
2.5c-1 ya trae el camino completo del capital (resolver, anchor "detenido", metricMap, evidence). 2.5c-2 agrega
SOLO un filtro Def2 sobre las filas, gateado por su flag. **Va entera.** El mecanismo: cuando el anchor es
"inmovilizado"/"detenido", el resolver pasa `{invInmovilizado:true}` a composeRetrieval → filtra skuInventario al
Def2 antes de rankear. ~1 predicado + el wire.

---

## 1 · QUÉ CONSTRUYE — el anchor "inmovilizado"/"detenido" filtra a Def2
- **Hoy (2.5c-1):** "capital inmovilizado"/"detenido" → ranking de **TODOS** los SKUs por stockUSD (vista amplia · top = SAM-REF500L $18.6K).
- **2.5c-2:** esos anchors filtran al **subconjunto Def2** (`alerta === "crit" || alerta === "warn" || rotacion < 2`) antes de rankear → top = **LG-DRYER8KG $13.6K** (el verdaderamente detenido). **La def es la canónica del motor** (`_capitalInmovilizado` · warehouse.js:45,355,366) — se reusa el mismo predicado, cero cálculo nuevo.
- **"capital" a secas → SIGUE dando la vista amplia** (todos). Solo cambian los anchors inmovilizado/detenido/atrapado.

---

## 2 · 🎯 LA DISTINCIÓN (lo que le sirve al dueño: "tenés plata" vs "tenés plata QUIETA")
| Pregunta | Subconjunto | Resultado |
|---|---|---|
| **"qué SKU tiene más capital"** | TODOS | **SAM-REF500L $18.6K** (mucho capital, pero rota 9.8x = Activo) |
| **"qué SKU tiene más capital inmovilizado"** | Def2 | **LG-DRYER8KG $13.6K** (rotación 1.0, alerta crit = detenido) |

**SAM-REF500L NO aparece como inmovilizado** (rota bien, Activo) · **LG-DRYER SÍ** (no rota, crit). Esa es la diferencia que importa: tener capital ≠ tener capital QUIETO. (Def2 por stockUSD: LG-DRYER $13.6K > SAM-TV55 $12.8K > BOS-SANDER $11.2K > PHI-IRON-PRO $9.8K > MAK-COMP-AIR $8.4K.)

---

## 3 · EL MECANISMO (un filtro · reusa todo)
- **El resolver** (spine): ya detecta el anchor "estado-malo" (inmovilizado/detenido/atrapado · 2.5c-1). En 2.5c-2, si `ADI_INV_INMOVILIZADO_ENABLED` Y el anchor está presente → pasa `{invInmovilizado:true}` a composeRetrieval. Sin el flag → vista amplia (2.5c-1 exacto).
- **composeRetrieval:** cuando `opts.invInmovilizado` Y lee skuInventario → filtra `rows` al Def2 (`alerta crit/warn || rotacion<2`) antes de rankear. Predicado canónico (cita warehouse.js).
- **Flag `ADI_INV_INMOVILIZADO_ENABLED`** (default OFF · refina el anchor · **requiere `ADI_INV_CAPITAL_ENABLED` ON** — si capital OFF, "inmovilizado" AVISA como cualquier capital bloqueado).
- **Evidence:** el payload refleja el filtro — `operacion:"rank_top_inmovilizado"` (o `filtros:{subconjunto:"inmovilizado Def2"}` + formula "Σ stockUSD · subconjunto Def2: alerta crit/warn O rotación<2"). Que el respaldo DIGA que es el subconjunto, no todos.

---

## 4 · EL ORÁCULO (lenguaje humano · dato REAL)
| Pregunta | Resuelve | Resultado |
|---|---|---|
| **"qué SKU tiene más capital inmovilizado"** | Def2 · top | **LG-DRYER8KG $13.6K** |
| **"dónde tengo capital detenido"** | Def2 · anchor | **LG-DRYER8KG $13.6K** |
| **"qué SKU tiene más capital"** (sin inmovilizado) | TODOS | **SAM-REF500L $18.6K** (vista amplia · sin cambios) |
| **"capital de LG"** (sin inmovilizado) | TODOS LG | tabla LG amplia (sin cambios) |
| **"qué bodega está complicada"** (2.5d) | muro | **AVISA** |

---

## 5 · CÓMO SE RELACIONA CON 2.5c-1 (solo los anchors cambian)
- Cambia: SOLO "inmovilizado"/"detenido"/"atrapado" → filtran a Def2.
- NO cambia: "capital"/"stock en valor"/"más capital"/"capital de X" → vista amplia (todos). El "stock comercial"=unidades intacto. Rotación/DOH/bodega intactos.
- Es la progresión del split: 2.5c-1 amplio, 2.5c-2 fino — sin tocar nada más.

---

## 6 · 🚨 LA TRAMPA
1. **El filtro Def2 solo aplica al anchor inmovilizado del capital** — NO toca capital amplio, ni rotación/DOH, ni bodega, ni el comercial.
2. **🚨 RED GATE:** la respuesta de inmovilizado ($) → cero rotación/DOH ajeno · cero cruce con el comercial · y **SAM-REF500L (Activo) NO aparece** (la prueba de que el filtro mordió).
3. **Atomicidad** intacta (bodega sigue siendo la no-modelada).

---

## 7 · EL BLINDAJE
- **🛡️ GATE PRINCIPAL:** régimen + rotación/DOH/capital ON + **inmovilizado OFF == HEAD (a93de7e)** byte-idéntico (git-stash) — con inmovilizado OFF, "detenido" da la vista amplia (2.5c-1 exacto).
- **Piso byte-exacto (todo OFF):** 47/47 + 10/10+6/6 + 19.
- **Comercial + capital amplio intactos** (inmovilizado ON no cambia "capital"/"stock"/rotación/DOH).
- **Shadow-diff (inmovilizado ON vs OFF):** solo cambian las cadenas con anchor inmovilizado/detenido (amplia→Def2) · 0 overshadow.
- **Combinado (19 flags):** Fix/Cabo + spine + 2.2 + 2.5a/b/c-1 → todo intacto.
- **Blast radius:** voiceFlags (flag) + spine (pasar `invInmovilizado` cuando el anchor + flag) + qiRetrieval (filtro Def2 en composeRetrieval). ~3 archivos, chico.

---

## 8 · REPORTE CRÍTICO — dónde será frágil
1. **Que el filtro Def2 sea el correcto** (LG-DRYER, no SAM-REF). Mitigación: predicado canónico (warehouse.js) + oráculo (SAM-REF NO aparece).
2. **Que no toque la vista amplia** ("capital" a secas sigue dando todos). Mitigación: el filtro solo con el anchor inmovilizado + el flag; shadow-diff.
3. **GATE PRINCIPAL (capital en baseline).** git-stash contra a93de7e (inmovilizado OFF == 2.5c-1 vista amplia).
4. **Supersesión/cascada:** los casos "detenido"/"inmovilizado" de los harnesses (Fix C, _inv_2_5c) refinan de amplia (SAM-REF) → Def2 (LG-DRYER) · flag-aware (la mayoría de los checks son SKU-agnósticos · ajusto los que fijan SKU).

---

## 9 · Para aprobar
1. ¿"inmovilizado"/"detenido" → Def2 (reusa `_capitalInmovilizado`), "capital" a secas → vista amplia?
2. ¿La distinción (SAM-REF amplia / LG-DRYER inmovilizado · "plata" vs "plata quieta")?
3. ¿Flag `ADI_INV_INMOVILIZADO_ENABLED` (default OFF · requiere capital ON)? ¿El evidence reflejando el Def2?
4. ¿El RED gate (SAM-REF NO aparece) + el GATE PRINCIPAL (inmovilizado OFF == HEAD a93de7e)?
5. ¿**ENTERA** (es un filtro chico)?

Con tu OK construyo, corro TODAS las pruebas (el RED gate · el GATE PRINCIPAL · la distinción amplia-vs-Def2), dejo el flag OFF, listo la supersesión, limpio tareas, y reporto. **No toqué `src/` — plano puro.** Después de esto, solo bodega (2.5d) y la Etapa 3 cierra.
