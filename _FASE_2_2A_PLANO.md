# Fase 2.2a — Red de seguridad (anti-fuga + anti-contaminación) · Plano detallado + Red-team

> El primer sub-ladrillo de 2.2: que la conversación corra sobre un piso LIMPIO antes de agregarle memoria.
> Dos cierres: (1) anti-fuga — la continuación respeta el muro de inventario; (2) anti-contaminación — el hilo
> no resucita contexto viejo. Plano puro — se aprueba y recién ahí se construye. Flag default OFF.

---

## 0 · LECTURA DE TAMAÑO de 2.2a (lo que pediste)
**2.2a es MEDIO.** Dos mitades de naturaleza distinta:
- **Anti-fuga** (composeSkuDevelopment + guardrail): **chica · riesgo bajo · seguridad OBSERVADA** (el leak del re-test). Cierre quirúrgico.
- **Anti-contaminación** (age-check + `_isNewQuestion`): **chica-media · riesgo MEDIO** (toca los deícticos committeados) · riesgo LATENTE (lo encontró el barrido, no un re-test fallido).

**Mi lectura/recomendación:** las dos son chicas y comparten el tema "red de seguridad" + un flag → **van juntas en 2.2a, está bien**. PERO si preferís separar el riesgo, la división natural es **2.2a-1 (anti-fuga, la seguridad urgente) → 2.2a-2 (anti-contaminación)**. **Mi lean: juntas** (medio, cohesivo, un solo flag, validan juntas) — pero si el age-check resulta más enredado de lo previsto al construir, **freno y propongo 2.2a-2** (timón #2). **Vos decidís juntas o partidas.**

---

## 1 · ANTI-FUGA ECL-CONT (el corazón · seguridad)

### El hueco (anclado)
`composeSkuDevelopment` (eclCont.js 36-93) es un **drilldown de inventario inherente**: lee `skuInventario` y surfacea `stockUSD/doh/rotacion/diasSinVenta`. Se invoca en la continuación (answerADI L585-588, R4 sku-dev) y en MODE 2 (`composeModuleOverview(investigationDomain)` L591 puede dar overview de inventario). **Esquiva el muro** porque: el muro (`_esPreguntaInventarioChat` L526) chequea el TEXTO de la query, y "los tres peores" no tiene keywords de inventario; la continuación corre DESPUÉS (L569) y trae el dato por su cuenta vía `activeResult`.

### El cierre (defensa en profundidad · gateado por el flag)
**Principio: ninguna continuación surfacea inventario mientras el Availability Map lo tenga bloqueado** (igual que el single-turn).
1. **Dentro de `composeSkuDevelopment`** (el punto robusto · cualquier caller queda protegido): tras el null-check, `if (ADI_MT_SAFETY_ENABLED && !isAvailable("inventario")) return reanchor(unavailableMessage("inventario"));`. Reusa el `reanchor()` que YA existe (L37) + el `unavailableMessage` del Availability Map. Import: `{ isAvailable, unavailableMessage }` desde `./core/availabilityMap.js`.
2. **Guardrail en `answerADI`** (antes de invocar · cubre R4 + MODE 2): en L585 (R4) y L589-591 (MODE 2), si `ADI_MT_SAFETY_ENABLED` y el dominio de la continuación es inventario y `!isAvailable("inventario")` → re-anclar con `unavailableMessage("inventario")` en vez del composer.

### El pago de conducta
`qué SKUs atrapan capital` [muro AVISA] → `los tres peores` → **AVISA Fase 2.5 · CERO capital/rotación/DOH.** (Hoy: leak de "$11.2K inmovilizados, rotación 1.6x…".)

---

## 2 · ANTI-CONTAMINACIÓN

### El hueco (anclado)
- **Listas plurales sin age-check:** `resolvePluralDeictic`→`pickPluralList` (router 1069-1110) reusa `context.lastClientList`/`lastSkuList` **sin verificar frescura**. Solo las single-entities tienen age (`lastXMentionedTurn === turnCount`, answerADI L573); las listas NO. → un deíctico en N+10 resucita una lista de hace 10 turnos.
- **Sin política de limpieza:** el contexto persiste indefinido; `investigationDomain` se preserva "si no hay match" (deepThreading L122) aunque el usuario cambie de tema.

### El cierre (gateado por el flag)
1. **Age-stamp en las listas:** en `_threadContext` (answerADI 146-153), al escribir `lastClientList`/`lastSkuList`, escribir también `lastClientListTurn`/`lastSkuListTurn = nextCtx.turnCount` (espejo de las single-entities).
2. **Age-check en el deíctico:** `pickPluralList`/`resolvePluralDeictic` solo reusan la lista si es del hilo activo (`lastClientListTurn === ctx.turnCount` = la del turno inmediato anterior). Stale → no resuelve (cae a aclarar/viejo). Ventana exacta = detalle técnico (arranco estricto = turno inmediato; aflojo si una cadena legítima de 2+ pasos lo pide).
3. **Marca `_isNewQuestion`:** cuando el intent es NUEVO (no continuación · espejo de `eclContIsPureContinuation`), marcar `nextCtx._isNewQuestion = true`; los detectores deícticos/continuación lo honran para ignorar foco viejo. (Reusa la lógica "si hay intent nuevo, ignora foco" que ya existe en eclCont.)

### El pago de conducta
`cómo está Falabella` → `cuál es el margen global` → **margen global** (no contaminado por Falabella). `ventas por cliente de Samsung` → `cómo va el negocio` → **panorama limpio** (no resucita la lista Samsung).

---

## 3 · Cómo reusa lo existente / qué agrega

| Reusa (intacto) | Agrega 2.2a |
|---|---|
| `reanchor()` de composeSkuDevelopment (el AVISAR limpio) | el check `isAvailable("inventario")` adentro |
| `Availability Map` (isAvailable/unavailableMessage) de 2.1a | lo consume la continuación (antes no) |
| `eclContIsPureContinuation` (la defensa "intent nuevo → no continúa") | la marca `_isNewQuestion` que la generaliza a los deícticos |
| `turnCount` + el patrón `lastXMentionedTurn` (single) | el age-stamp `lastXListTurn` (plural) |
| `pickPluralList`/`resolvePluralDeictic` | el age-check antes de reusar |

**Cero reescritura de cálculo.** Es un escudo (gates) sobre rutas existentes.

---

## 4 · El oráculo (cadenas encadenadas reales)
**Anti-fuga (gate ROJO):**
- `qué SKUs atrapan capital` → `los tres peores` → AVISA, **cero número de inventario**.
- `dónde tengo capital detenido` → `profundizá en esos` → AVISA.

**Anti-contaminación:**
- `cómo está Falabella` → `cuál es el margen global` → margen global (sin Falabella).
- `ventas por cliente de Samsung` → `cómo va el negocio` → panorama (sin la lista Samsung).
- `margen por SKU de Bosch` → (5 turnos no relacionados) → `los tres peores` → NO resucita los SKUs de Bosch (lista stale).

**Continúa lo que SÍ corresponde (no rompe la continuación legítima):**
- `margen por SKU` → `los tres peores` (turno inmediato) → rebana la lista fresca (cuando NO es inventario; si es inventario → AVISA por el anti-fuga).

---

## 5 · El blindaje (single-turn byte-idéntico · gate ROJO anti-fuga)
- **Single-turn byte-idéntico (el más importante):** 2.2a SOLO cambia conducta con **contexto previo** (ctx con foco). En sesión fresca (ctx `{}`, los 47) ni la continuación ni los deícticos disparan → **piso 47/47 + canónica + extendida byte-exacto**.
- **Gate ROJO anti-fuga:** el oráculo de inventario NUNCA muestra un número de inventario. **Un solo `$X inmovilizado`/`rotación Nx` en la cadena → FALLA.**
- **Shadow-diff:** flag ON vs OFF → solo cambian las CADENAS de inventario (leak→AVISA) y las de contaminación (stale→limpio); todo lo demás byte-idéntico.

---

## 6 · Flags · Blast radius
- **Flag:** `ADI_MT_SAFETY_ENABLED` (default OFF · paraguas multi-turno). (Si se parte: `ADI_MT_ANTILEAK_ENABLED` + `ADI_MT_ANTICONTAM_ENABLED`.)
- **Blast radius:** `composeSkuDevelopment` (1 check) + guardrail en answerADI (R4/MODE 2) + `_threadContext` (2 age-stamps) + `pickPluralList`/`resolvePluralDeictic` (1 age-check) + `_isNewQuestion` (1 marca + su lectura). Imports de `availabilityMap` en eclCont. Flag OFF → conducta previa EXACTA (la cascada ECL-CONT [5] + los deícticos corren como hoy). Cero cambio en composeRetrieval/applyFiltros/el spine/la UI.

---

## 7 · Reporte crítico — dónde será frágil
1. **Romper el single-turn (riesgo CENTRAL).** El multi-turno corre solo con foco previo; en sesión fresca el gate da false. Mitigación: el piso byte-exacto single-turn como prueba dura; el flag OFF deja todo como hoy.
2. **El leak por OTRA puerta (seguridad).** Además de R4, MODE 2 (overview de inventario) y futuras rutas de continuación podrían surfacear inventario. Mitigación: el check DENTRO de composeSkuDevelopment (robusto a cualquier caller) + el guardrail; + un test que barre todas las cadenas de continuación buscando un número de inventario.
3. **Age-check demasiado estricto rompe una cadena legítima** (deíctico de 2+ pasos sin re-escribir lista). Mitigación: arrancar estricto (turno inmediato), medir con el oráculo de cadenas legítimas, aflojar la ventana si una cadena real falla. Si resulta enredado → 2.2a-2 (timón #2).
4. **`_isNewQuestion` mal clasificado** (marcar nuevo cuando era continuación, o viceversa). Mitigación: reusar el criterio YA probado de `eclContIsPureContinuation` (derived* no-null = nuevo); shadow-diff con cadenas de continuación legítima.
5. **Coexistencia con el muro/ADI_QI_FILTER.** Con ADI_QI_FILTER ON (muro activo) la continuación de inventario ya debería avisar; con OFF (piso) el [5] corría. El anti-fuga (gateado por su propio flag) los unifica vía el Availability Map. Verificar el combinado (ADI_QI_FILTER + ADI_MT_SAFETY ON) no rompe Fix/Cabo/spine.

---

## 8 · Para aprobar
1. ¿2.2a **juntas** (anti-fuga + anti-contaminación, un flag) o **partidas** (2.2a-1 anti-fuga primero, 2.2a-2 anti-contaminación)? — mi lean: juntas, pero es tu decisión.
2. ¿El **pago de conducta** (anti-fuga: "los tres peores" tras inventario → AVISA cero número; anti-contaminación: cambio de tema limpia el hilo)?
3. ¿La **conducta visible nueva** (timón #1: la continuación de inventario ahora AVISA en vez de mostrar capital/rotación)?

Con eso construyo 2.2a, corro todas las pruebas (gate ROJO anti-fuga + single-turn byte-idéntico + shadow-diff + el combinado), dejo el flag OFF, y reporto. **No toqué `src/` — plano puro.**
