# Fase 2.1c — Plano + Red-team (combinado marca+cliente → AVISAR consistente)

> Último cabo de la Fase 2.1. El dato NO sostiene el cruce marca×cliente (`clientesMargen.marca` es la
> marca DOMINANTE por cliente, decorativa). El objetivo NO es responderlo: es que ADI **AVISE claro y
> honesto** que no tiene ese cruce —conservando lo que SÍ puede ofrecer (la marca sola o el cliente solo)—,
> de forma CONSISTENTE para todos los fraseos. Hoy ya avisa parcial (solo "en"); 2.1c lo formaliza.
> Plano puro — se aprueba y recién ahí se construye. Flag default OFF.

---

## 0 · El estado de hoy (qué ya hay, qué falta)
La rama combinado AVISAR **YA existe** (la construí en 2.1b, con su payload `cross_dimension` en 2.1d):
```js
const specificClient = (detectAllClientsInText(text, { strict: true }) || []).find(c => _afterConnector(norm, c));
if (specificClient) { return { route: "spine_filter_combinado_avisar", opener: "...", evidence: {...cross_dimension} }; }
```
Pero `_afterConnector` usa el conector `de/del/en` **y NO incluye "para"**. Resultado:

| Pregunta | HOY | CON 2.1c |
|---|---|---|
| ventas de Samsung **en** Falabella | 🟡 AVISA combinado (ya anda) | 🟡 AVISA (consistente) |
| margen de Bosch **para** Lider | 🔴 cae al viejo (pierde el combinado, "para" no matchea) | 🟡 AVISA combinado |

**2.1c = formalizar:** ampliar el conector (para/con) + hacer el mensaje consistente, sin pisar los filtros simples.

---

## 1 · Qué construye exactamente
1. **Conector ampliado** para la detección del combinado: `de/del/en` **+ `para/con`** → caza "margen de Bosch **para** Lider".
2. **Mensaje consistente y connector-agnóstico** (no asume "en"): nombra POR QUÉ no puede (no hay cruce real marca×cliente en el dato) y **conserva lo ofrecible** (la marca sola, o el detalle del cliente). Ej:
   > *"Cruzar Bosch (marca) con Lider (cliente) no lo tengo: el dato guarda una marca dominante por cliente, no el detalle por marca dentro del cliente. Te puedo dar Bosch sola, o el detalle de Lider. ¿Cuál?"*
3. **El payload** (`cross_dimension` en `unsupported_clauses`) ya se emite (2.1d) — se mantiene.

Todo gated por **`ADI_SPINE_COMBINED_ENABLED`** (requiere `ADI_SPINE_FILTER_ENABLED`). Flag OFF → exactamente la rama 2.1b (conector `en`, mensaje viejo) → reversible byte-exacto a 2.1b.

---

## 2 · Cómo distingue el combinado real del filtro simple (la trampa central)
**El combinado dispara SOLO cuando hay DOS entidades de ejes distintos: un filtro marca/familia Y un cliente ESPECÍFICO nombrado.**
- `el peor margen de Bosch` → marca Bosch, **sin cliente específico** → NO combinado → RESPONDE (BOS-SANDER). ✅
- `qué cliente Samsung vende más` → marca Samsung + **"cliente" genérico** (no un nombre) → NO combinado → RESPONDE (Falabella). ✅
- `carga comercial de los clientes de Bosch` → marca Bosch + **"clientes" genérico** → NO combinado → RESPONDE (tabla). ✅
- `margen de Bosch para Lider` → marca Bosch + **cliente "Lider" (nombre específico)** → SÍ combinado → AVISA. ✅

El discriminador es **`detectAllClientsInText(strict)` = un nombre de cliente real** (Falabella/Lider/…), NO el sustantivo genérico "cliente/clientes". Los filtros simples nunca traen un nombre de cliente específico → imposible que el combinado los pise. El shadow-diff lo prueba.

---

## 3 · El oráculo (lenguaje humano)
**Combinado → AVISAR consistente:**
- ventas de Samsung en Falabella · margen de Bosch para Lider · contribución de LG para Jumbo · ventas de Philips en Tottus

**Simple → RESPONDE intacto (la trampa):**
- el peor margen de Bosch → BOS-SANDER (NO avisa) · qué cliente Samsung vende más → Falabella · carga comercial de los clientes de Bosch → tabla · qué SKU de LG más débil en margen → LG-DRYER8KG

**Payload del combinado:** `{filtros:{marcas:[Samsung]}, query_plan:{operacion:"avisar"}, unsupported_clauses:[{kind:"cross_dimension", raw:"Samsung×Falabella"}]}` (ya emitido en 2.1d).

---

## 4 · Shadow-diff anti-overshadow
Probe set: combinados + filtros simples + controles, flag ON vs OFF. **Lo único que puede cambiar:** los combinados con "para"/"con" (de viejo → AVISAR) y el wording del mensaje. **Controles que DEBEN quedar byte-idénticos (la trampa):**
- `el peor margen de Bosch` → **sigue RESPONDE BOS-SANDER**, NO avisa. ← **si avisa "no tengo el cruce" → ROJO.**
- `qué cliente Samsung vende más` → sigue Falabella.
- `carga comercial de los clientes de Bosch` → sigue tabla.
- todos los de 2.1a/2.1b/2.1b-2/Fix/Cabo → byte-idénticos.

---

## 5 · Flags · Blast radius
**Flag:** `ADI_SPINE_COMBINED_ENABLED = false` (requiere `ADI_SPINE_FILTER_ENABLED`). Flag OFF → rama combinado 2.1b exacta. **Blast radius:** el conector ampliado + el mensaje refinado en UNA rama de `resolveFilteredRetrieval` + 1 flag. Cero archivos nuevos, cero cambio en composeRetrieval/applyFiltros/_finalize. Reversible byte-exacto a 2.1b.

---

## 6 · Reporte crítico — dónde será frágil
1. **Pisar los filtros simples (riesgo CENTRAL).** Mitigación: el combinado exige un **nombre de cliente específico** (strict), que los filtros simples no tienen. "el peor margen de Bosch" (sin cliente) → RESPONDE. El shadow-diff con "el peor margen de Bosch" como control es la prueba: si avisa → rojo, freno.
2. **Cliente no-ambiguo detectado sin conector** (Falabella/Lider se detectan en cualquier lado). Riesgo: una query de marca que mencione un cliente incidentalmente → AVISA combinado de más. Mitigación: para el combinado mantengo el **conector** (de/del/en/para/con) — el cliente tiene que estar tras un conector, no suelto. Acota a combinaciones reales.
3. **El degenerado "Samsung en Falabella" (Falabella ES Samsung-tagged).** Aunque el dato "coincide" (Falabella es Samsung), igual AVISA — porque "LG en Falabella" daría 0/engañoso, y la regla es consistente: el cruce marca×cliente no es dato firme, nunca. (No respondemos el caso que "coincide" para no inducir que el cruce existe.)
4. **Doble entidad del mismo eje** ("margen de Samsung y LG" = dos marcas) — NO es marca×cliente, queda fuera de 2.1c (cae al filtro simple sobre la primera, o al viejo). Lo declaro como límite (es otro patrón).
5. **El follow-up** ("dame el detalle de Lider") tras el AVISAR es Fase 2.2 (multi-turno). Acá ADI ofrece las dos salidas; resolver la elección del usuario es 2.2.

---

## 7 · Para aprobar
1. ¿El **alcance** (2.1c = AVISAR consistente el combinado marca+cliente, ampliando a "para/con"; NO responder el cruce)?
2. ¿La **conducta visible** (timón #1: "margen de Bosch para Lider" pasa de caer-al-viejo a AVISAR claro)?
3. ¿El **flag** `ADI_SPINE_COMBINED_ENABLED` (flag-off = 2.1b exacto)?

Con eso construyo 2.1c, corro todas las pruebas (shadow-diff con "el peor margen de Bosch" como control anti-trampa + el payload del combinado), dejo el flag OFF, y reporto.
