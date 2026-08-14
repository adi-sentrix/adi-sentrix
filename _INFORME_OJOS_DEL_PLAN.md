# LOS OJOS DEL PLAN — el dato y el pendiente al planificador

**2026-08-14 · worker sobre dev=9d7bfa0 · rama `claude/elegant-swirles-2529b0` · NO pusheado · 6 commits.**
Suite: **antes 148 PASS · 0 FAIL · 0 TOCARON LA RED · 0 CON CREDENCIAL VIVA → después 149 · 0 · 0 · 0.**
La lista LIVE se queda en **61** (verificado por diff): ningún gate cambió de clasificación en silencio.
Cero llamadas a proveedor: todo bajo `gates:offline` / `offline-guard`.

**Las dos piezas del encargo entraron completas.** Lo que traigo frenado —y es lo importante de este
informe— son **dos decisiones de costo y de conducta que no son mías**: §5.

---

## 1 · La conclusión, primero

El planificador ya ve el mapa del negocio y la simulación a medias. Las dos entran por el camino que F1
dejó abierto, sin tocar el muro ni el contrato de narración.

**Pero el costo no es el que F1 proyectó, y se puede demostrar sin gastar un centavo: es 1,94× más.**
F1 tarifó el bloque con la convención del repo (~3,8 bytes por token) y estimó 3.850 tokens ≈ US$0,00039
por llamada. La corrida pagada del owner (`_experimento_claude_negocios.json`, 5 llamadas del 2026-08-14)
trae los `input_tokens` que **el proveedor contó** sobre un system que es exactamente persona + esta misma
proyección. Con ese ancla, el dato son **6.572 tokens medidos**, no 3.483. El punto de freno del encargo
**se activa**, así que la alternativa reducida está construida y medida (§5.1).

---

## 2 · Qué cambió, archivo por archivo

| Archivo | Qué |
|---|---|
| `src/adi/oracle/planPrompt.js` (:151-163 doctrina · :204/:214 builders · :247 el bloque) | `buildPlanSystem`/`buildPlanSystemSegments` ganan el **5º argumento OPCIONAL** `datoNegocio` (default null). El bloque entra **justo antes de la línea de escenario**, que es el corte del caché: cae entero del lado FIJO y queda **al final** de él. `DOCTRINA_DATO_PLAN` nueva (1.875 chars, 4 reglas), condicional al argumento. Sin él: system byte-idéntico. |
| `src/adi/llm/gatewayCore.js` (:281-286, :340-344) | `handlePlan` acepta `datoNegocio` del body (campo hermano de `text`/`history`, mismo modelo de confianza que el de `handleNarrateC`) y lo pasa al builder segmentado. El corte del caché no se mueve: el bloque queda bajo `cache:true`. El gateway no lo interpreta ni lo valida. |
| `src/ui/ChatADI.jsx` (:229-236) | `_fetchPlan` —que ya recibía `scenario`— manda `datoNegocio: proyectarDatoNegocio(scenario)`. **Misma función y mismo memo por tenant+escenario que el narrador**: no hay una segunda construcción del dato ni un segundo criterio de cuándo cambia. |
| `src/adi/oracle/persona.js` (:9-13 import · :99-125 la línea · :158-164 el render) | `renderInteractionMemory` surfacea `mem.pendingSimulation` como **señal**, con la forma de `lastOffer`. El plazo NO se juzga acá: se consulta `pendingSimulationVigente` (conversationScope.js) para no abrir una segunda fuente de verdad sobre qué pendiente está vivo. |
| `_dato_al_plan_gate.mjs` (**nuevo**) | 37 PASS · 0 FAIL — entra a la suite (148→149) vía `@inspeccion-estatica`. |
| `_probe_dato_al_plan.mjs` (**nuevo**) | La medición del punto de freno + la proyección reducida construida y tarifada. No entra a la suite (mide, no afirma). |

**No se tocó**: `guardC`, el contrato de narración, `numberGuard`, `entityGuard`, `_guard_gate`,
`answerViaOracle.js` (ni una línea — el encargo lo pedía y no hizo falta ni para pasar datos),
`datoProyectado.js`, `PLAN_TOOL`. Cero `git add -A`, cero `commit -a`, sin push, `main` intacto.

---

## 3 · Qué ve ahora el PLAN, y qué sigue sin ver

### Ve
- **El mapa de entidades con su nombre exacto y su eje real** — 13 clientes, las marcas, las familias, los
  SKU comerciales, los SKU de inventario con su bodega, los canales. Era el hueco que hacía que el eje se
  adivinara por el fraseo, contra lo que el propio catálogo declara («es un HECHO del dato, no algo que se
  adivina»).
- **Qué métrica tiene de verdad cada eje** y las cifras de cada fila.
- **Las dos secciones que impiden planificar contra un hueco**: «LOS DOS UNIVERSOS QUE NO RECONCILIAN» y
  «LO QUE ESTE DATO NO TIENE».
- **La simulación abierta**: entidad, eje, la variable que el usuario ya declaró con su valor y su signo, y
  cuál falta.

### Sigue sin ver (declarado, no disimulado)
- **La serie mensual.** `datoProyectado.js` no la proyecta a propósito (la sirve `trend`, anclada y
  reconciliada). El PLAN sigue eligiendo `trend` por el calificador temporal del turno, no por ver los meses.
- **Los agregados por canal.** Los computa el motor en sus tools; el bloque solo declara que el eje existe.
- **La boleta del turno anterior.** El PLAN sigue viendo el hilo recortado (`buildPlanUserMessage`), no las
  cifras que ya se mostraron en pantalla.
- **El ViewContext completo.** Sigue viajando como UNA línea sin cifras, sin cambios.

---

## 4 · El costo, medido

### 4.1 · El ancla: el ratio real de este corpus

El repo venía tarifando con `chars/4`. Sobre este corpus eso **subestima 1,89×**:

| Medición | Valor | Cómo |
|---|---|---|
| Ratio de prosa española de ADI | **2,12 chars/token** | Δ de `input_tokens` entre turnos del mismo hilo (397 y 374 tok) — la diferencia es exactamente la respuesta previa + la pregunta nueva. Nada estimado. |
| **El dato (13.931 chars)** | **6.572 tokens** | Por resta sobre el system medido de la 1ª llamada (9.327 tok), descontando persona y cabecera. |
| Lo que daría `chars/4` | 3.483 tokens | La convención vieja. |

Una tabla densa de cifras y códigos de SKU (`$17.9M`, `LG-DRYER8KG`, `165d`) tokeniza al doble que la prosa.

### 4.2 · El system de PLAN, antes y después

| | chars | tokens (ratio medido) |
|---|---|---|
| PLAN system HOY | 34.491 | ~16.270 |
| PLAN system CON el dato | 50.302 | ~23.725 |
| **El bloque** (doctrina 1.875 + dato 13.931) | **+15.811** | **+7.455** |

### 4.3 · Costo incremental por llamada de PLAN (Haiku, `modelPricing.js`: US$1,00/MTok entrada)

| Escenario | Costo | Cuándo |
|---|---|---|
| Lectura de caché (0,1×) | **US$0,000745** | El caso normal: el bloque es estable por tenant+escenario |
| Sin caché (1,0×) | US$0,007455 | Si el prefijo no pegara |
| Escritura de caché (1,25×) | US$0,009319 | Una vez por ventana de caché, no por turno |

**Contra F1 (US$0,00039 con caché): 1,94×.** A 40 turnos/día con 1 llamada de PLAN por turno:
**US$0,90/mes** con caché (US$8,95/mes si el caché no pegara nunca).

> **Una observación que excede este encargo y conviene no perder.** Con el mismo ratio medido, el system de
> PLAN que HOY viaja (sin mi cambio) son **~16.300 tokens**, no los ~8.880 que midió la certificación del
> 2026-08-10 — porque esa corrida fue con **gpt-4o-mini** y hoy PROD es **Anthropic**, con otro tokenizador.
> Es una **derivación**, no una medición directa sobre una llamada de PLAN, y el arquitecto la confirma
> **gratis**: `usage.input_tokens` vuelve en cada llamada. Si se confirma, todos los presupuestos de
> `_reparacion_contextual_gate` están expresados en una unidad que ya no corresponde al proveedor vivo.

---

## 5 · Lo que frené (no lo decidí solo)

### 5.1 · FRENO 1 — el costo se pasó de lo proyectado: la alternativa reducida está lista y medida

El encargo dice: si el dato completo mueve el costo más de lo que F1 proyectó, traer la proyección reducida
con su medición. **Se pasó (1,94×), así que acá está.**

`_probe_dato_al_plan.mjs` construye **el ÍNDICE**: los nombres exactos de las entidades por eje, los 6 ejes,
qué métrica sirve cada eje, qué hay mensual — y **las dos secciones de límites textuales** (no re-redactadas:
serían una segunda verdad sobre los límites del dato). **Sin una sola cifra.**

| | Completo | Índice |
|---|---|---|
| chars | 13.931 | 3.929 |
| tokens | 6.572 | **1.854** (−72%) |
| costo/llamada con caché | US$0,000745 | **US$0,000274** |

**Qué conserva el índice:** los dos casos que motivaron el encargo. El hilo de 3 turnos se resuelve con
**nombres y ejes**; la sobre-planificación G1 también (es saber cuántas entidades hay y qué tool cubre el par).
**Qué pierde:** que el PLAN reconozca una **premisa numérica falsa** del usuario («el margen de X es 30%»,
cuando es 22%) y replantee, en vez de pedir el dato que la confirme.

**Mi lectura, y es una recomendación, no una decisión:** el completo, porque US$0,90/mes es ruido contra los
~US$26/mes ya modelados, y porque la premisa falsa es el caso donde ADI se distingue de un tablero. Si el
owner prefiere el índice, la función del probe es el contenido listo para mudar a `datoProyectado.js`
(la construí ahí y no en el producto a propósito: un export que nadie llama sería sembrar la clase de código
muerto que La Poda acaba de sacar).

### 5.2 · FRENO 2 — el pendiente también lo ve el NARRADOR: el impacto, medido en el código

`renderInteractionMemory` es compartido, así que la línea nueva llega a las dos pasadas. **Fui a mirar la
exposición real en vez de suponerla**, y es más angosta de lo que parece (`answerViaOracle.js:1622` y `:2127`):

- **PLAN recibe `mem`** — el pendiente ya juzgado, con su plazo completo. Es donde tiene que estar.
- **NARRAR recibe `mem2`** — donde el pendiente ya es **`null` si este turno lo resolvió** y está
  **envejecido** si sobrevivió. O sea: **el narrador nunca ve un pendiente que acaba de ejecutar.** Solo lo ve
  en un turno que habla de otra cosa y lo deja abierto.
- **Ni un prefijo cacheable se mueve**: la memoria ya viajaba en el segmento VARIABLE de las dos pasadas.
  El gate lo afirma para PLAN y para NARRAR, con el dato adentro.

Aun así, es un cambio de conducta del narrador que **no se puede verificar offline**. Lo mitigué dentro de la
propia línea: cierra con *«si el turno habla de otra cosa, la simulación sigue esperando: no la des por hecha,
no la ejecutes a medias y no la traigas vos»* — el recordatorio determinístico ya existe
(`_recordatorioPendiente`) y es de quien corresponde.

**La opción, si el arquitecto prefiere no arriesgar el narrador**: surfacearlo solo a PLAN. Es un argumento
más en `renderInteractionMemory(mem, paraPlan = false)` y el `false` en la llamada de `handleNarrateC` —
6 líneas, sin tocar nada más. **No la tomé porque el pendiente es contexto de desambiguación legítimo para
quien redacta**, y porque el narrador que sabe que hay una simulación abierta no cierra con una oferta que la
ignore. Es una decisión de producto.

---

## 6 · La lista exacta de turnos para medir en vivo

Los probes con PLAN mockeado **no prueban que Haiku elija mejor** — solo que el dato llega. Esto es lo que hay
que medir en vivo, con el «antes» ya registrado para que la comparación sea contra un hecho, no un recuerdo.

### A · El hilo de 3 turnos de la captura (obligatorio — es el que motivó el encargo)

| # | Turno | Qué mirar en el PLAN emitido |
|---|---|---|
| A1 | «Si subo ventas 4%, ¿qué cambia?» | Que arme el pendiente sobre **volumen** (la lectura «ventas = volumen» ya integrada) y pregunte por el precio, sin inventar el 0%. |
| A2 | «sobre las ventas» | Que **NO** abra un tema nuevo: es alcance del mismo supuesto. Con el pendiente surfaceado, PLAN debería reconocerlo. |
| A3 | «simula sobre el total de ventas» | **EL TURNO QUE ROMPIÓ A ADI EN PRODUCCIÓN**: corrió `simulateCosto`, que el usuario nunca pidió. La medida es binaria: ¿sigue apareciendo `simulateCosto` en `calls`? |

**El «antes» está registrado**: Sonnet con el mismo dato y sin ningún objeto de estado sostuvo los tres turnos
sin perder el hilo ni una vez (`_experimento_claude_negocios.json`).

### B · La sobre-planificación multi-entidad G1 (obligatorio — anotado en la memoria)

| Turno | Antes (medido, espejo Anthropic 2026-08-13) | Qué mirar |
|---|---|---|
| «dame todo lo de falabela y lider y dime cual es peor y por qe» (con los typos) | **6 calls**: `entityProfile ×2 + trend ×2 + diagnose ×2`, donde `compareEntities` existía | ¿Baja el conteo de calls? El bloque declara cuántas entidades hay y el catálogo declara que `compareEntities` es la forma canónica para exactamente 2 entidades nombradas. |

### C · Recomendados (baratos, y son donde el bloque debería pagar solo)

1. **Eje equivocado** — una entidad cuyo eje no se deduce del fraseo («el costo medio de Bosch»): ¿acierta
   `dimension:"marca"` en vez de caer al default `cliente`?
2. **Premisa falsa** — «¿por qué Falabella tiene 30% de margen?» (el real es 22,0%): ¿replantea, o pide el dato
   que confirme la premisa? **Este es el turno que distingue el bloque completo del índice reducido** (§5.1) —
   si el owner elige el índice, este caso no debería mejorar.
3. **Planificar contra un hueco** — «¿quiénes dejaron de comprar?»: ¿emite el plan mínimo para declinar
   honesto, o una batería de calls que no lo van a encontrar?
4. **Nombre difuso de SKU** — que el nombre exacto salga del bloque y no de una reconstrucción.

**Qué registrar en cada turno**: `plan.calls` (tools y args), `plan.scope`, y `usage.input_tokens` /
`cache_read_input_tokens` — este último confirma de una vez el ratio derivado de §4 y que el prefijo pega.

---

## 7 · Decisiones no obvias (para la revisión del arquitecto)

1. **El bloque va justo ANTES de la línea de escenario, no al final del archivo.** El corte fijo/variable de
   PLAN se busca **por marcador de texto** (`buildPlanSystemSegments` hace `indexOf`), así que el único lugar
   donde el bloque cae entero del lado FIJO y además lo cierra es ese. El gate afirma además que **ningún
   marcador de corte aparece dentro de la proyección** — si apareciera, el corte caería adentro del dato y lo
   partiría en dos. Es la clase de falla que no se ve hasta que el caché deja de pegar.
2. **El plazo del pendiente se consulta, no se reescribe.** Importar `pendingSimulationVigente` en `persona.js`
   agrega una dependencia (verificado: no hay ciclo — `conversationScope.js` no importa `persona.js`), pero la
   alternativa era escribir `restan > 0` a mano y tener dos reglas sobre qué pendiente está vivo.
3. **El vocabulario del pendiente es el del producto, no uno nuevo**: «el precio» / «el volumen (unidades
   vendidas)» son las mismas palabras con que el motor pregunta por el supuesto faltante. Es un mapa de dos
   entradas en `persona.js`; **la pregunta al usuario se sigue redactando en un solo lugar**, en
   `answerViaOracle.js`. Lo declaro porque es la clase de duplicación que este repo ya pagó caro.
4. **Un pendiente a medias no se surfacea** (sin entidad, sin variable conocida, vencido): el render devuelve
   `""`. Una señal incompleta es peor que ninguna, porque el modelo la completaría inventando.
5. **No toqué `answerViaOracle.js`.** El encargo lo autorizaba solo para pasar datos al gateway, y ni para eso
   hizo falta: `_fetchPlan` ya recibía `scenario`, y el pendiente ya viajaba dentro de `mem`. Cero superficie
   de choque con los dos workers en paralelo.
6. **El presupuesto de PLAN no se movió.** `_reparacion_contextual_gate` mide
   `buildPlanSystem(persona, "", "actual", false)` — 4 argumentos, sin dato → byte-idéntico. **No hubo que
   subir ningún tope**, y por eso este informe no trae un análisis garantía-vs-formato: ningún gate viejo se
   tocó.

---

## 8 · Verificación

- **`_dato_al_plan_gate.mjs` → 37 PASS · 0 FAIL**, corrido DENTRO de la suite.
- **Suite completa**: `149 PASS · 0 FAIL · 0 TOCARON LA RED · 0 CON CREDENCIAL VIVA` (antes: 148 · 0 · 0 · 0).
- **La trampa del clasificador, verificada de las dos formas**: el gate aparece en la lista de corridos
  (`▶ _dato_al_plan_gate.mjs`) y el conteo subió 148→149. El diff de la lista LIVE antes/después es **vacío**:
  61 gates antes, 61 después.
- **Ningún gate existente se movió** — cero ajustes de topes, cero regex retocadas.
- **Cero red**: los 6 commits son offline; el probe y la medición corrieron con
  `node --import ./scripts/offline-guard.mjs` (el candado mata el proceso ante cualquier `fetch`).

## 9 · Commits (rama del worktree, base 9d7bfa0, NO pusheado)

1. `f1fa967` — `planPrompt.js`: el 5º argumento + la doctrina del dato en el fijo.
2. `fa2a679` — `gatewayCore.js`: el dato del body al segmento cacheable de PLAN.
3. `2c8e8ec` — `ChatADI.jsx`: el fetcher de PLAN manda la misma proyección que el de narrar.
4. `a37f4cb` — `persona.js`: el pendiente como señal, con el plazo de su dueño.
5. `ee3d75a` — `_dato_al_plan_gate.mjs` (148→149).
6. `6bbf4ee` — `_probe_dato_al_plan.mjs`: la medición del freno + la alternativa reducida.
7. este informe.
