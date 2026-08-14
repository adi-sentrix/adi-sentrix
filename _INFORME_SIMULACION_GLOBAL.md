# Informe · El alcance del pendiente: «el total» se resuelve, la herramienta ajena se frena, el supuesto del usuario pasa el muro

**Worktree** `claude/vigilant-faraday-010044` sobre `dev` (9d7bfa0) · commits locales, sin push · 2026-08-14
(encargo del owner: cerrar los dos defectos medidos en vivo en el hilo `_medir_sesion_owner.json`).

**Resultado en una línea:** el turno 3 del hilo medido ya no puede ejecutar `simulateCosto` — «simula sobre el total
de ventas» se resuelve sin PLAN y corre la simulación global correcta; y el «4%» que el propio usuario declaró
dejó de morir contra el muro. `npm run gates:offline`: **149 PASS · 0 FAIL · 0 TOCARON LA RED · 0 CON CREDENCIAL
VIVA** (subió de 148 con el gate nuevo, 59/59).

---

## 1 · Los dos defectos, y por qué pasaron

Reproducidos offline contra el código, coinciden con el diagnóstico del arquitecto.

**(1) EL GRAVE — el escenario fabricado.** El arm `no_entity` de `answerViaOracle.js` hacía la pregunta («¿sobre qué
cliente, SKU, marca o familia?») y **no guardaba absolutamente nada**: los arms `future`/`future_multi` persisten
`pendingSimulation`, este no. Así que el turno siguiente llegaba sin ningún estado que resolver, y el que sigue
también. Cuando el usuario contestó «simula sobre el total de ventas», el turno cayó entero a PLAN — Haiku vio una
frase con «simula» y «ventas» y eligió `simulateCosto`, que simuló **costo medio +4% sobre todos los SKU** y lo
presentó como el supuesto del usuario. Dos huecos encadenados: no había pendiente que persistir, y no había red que
reconociera «el total» como respuesta de alcance.

**(2) El falso positivo del muro.** En «sobre las ventas», el narrador ecoó el «4%» que el usuario había declarado
dos turnos antes. Ese 4% vivía en `pendingSimulation`, no en el texto de ese turno — y `guardC` solo conoce cuatro
fuentes de eco (boleta del turno, pregunta del turno, cifra del usuario en una reparación, boleta anterior).
Ninguna lo cubría, así que el chequeo 1 lo clasificó como cifra del dato sin dueño (`4%` existe como `pctRebate` de
Paris y otros), vetó dos intentos y el turno cayó al genérico «No tengo información autorizada suficiente». **Dos
llamadas a Anthropic gastadas para terminar sin responder.**

---

## 2 · La decisión de producto: qué corre en global y qué se declina, con la evidencia del motor

El encargo pedía mirar qué soporta el motor antes de elegir. Lo que encontré, verificado en el código:

| Tool | ¿Global sin entidad? | Evidencia |
|---|---|---|
| `simulateGeneral` (precio + volumen) | **NO** | `toolRegistry.js:793` llama `rawRecordFor(dim, entity, …)` y sin registro devuelve `supported:false` («no encuentro '…' en el eje»). `toolContracts.js:254` declara `inputsObligatorios: ["entity","variableA","variableB"]`. No existe la versión global. |
| `simulate` genérico (1 métrica × eje) | **SÍ** | `composeSpecSimulate` (`specRetrieval.js:2087`) corre sobre el eje completo: total actual/supuesto sellados, impacto absoluto, y el 80/20 real del impacto. `ventas` está en su allow-list. |

**La decisión: correr, no declinar — pero solo cuando el motor lo puede responder sin estimar nada.** Con una de las
dos variables **confirmada en 0 por el usuario**, la venta escala exactamente lineal con la otra (venta = Σ
precio×unidades: con el precio quieto, +4% de volumen **es** +4% de venta). No es una aproximación: es la misma
aritmética que `simulateGeneral` hace por entidad, con un factor en 1. Así que el escenario global se responde con
el simulador genérico, sobre `dimension:"cliente"` — la venta oficial por cliente es la única fuente sancionada del
total del negocio (D8).

Y **cuando las dos variables se mueven, se declina**, porque ahí no hay equivalencia lineal ni tool que lo soporte:

> «Esa combinación —precio y volumen cambiando a la vez— la corro sobre una entidad puntual (un cliente, SKU, marca
> o familia), no sobre el total del negocio: es un límite del motor y prefiero declararlo antes que estimarlo. Si te
> sirve, **Jumbo y Falabella** son los clientes con más volumen y puedo correrla sobre cualquiera de los dos.»

Los dos candidatos salen del **dato real** (los dos clientes con más unidades vendidas, leídos con `rawRecordFor`),
nunca de una lista escrita a mano — y la declinación no trae ni una cifra del negocio: declinar no es excusa para
mostrar dato. Tercer caso, ambas en 0: se dice que no hay escenario que proyectar (el motor mismo rechaza el delta
cero) y el pendiente se cierra.

**El resultado medido del hilo, turno 4:** `simulate{metric:"ventas", dimension:"cliente", transform:+4%}` → boleta
con `Supuesto % = +4%`, `Total actual $100.0M`, `Total supuesto $104.0M`, `Impacto $4.0M`, concentración real 81%.

---

## 3 · Qué se cambió

### 3a · El pendiente de ALCANCE existe (`conversationScope.js` + `answerViaOracle.js`)

`_pendienteBienFormado` aceptaba solo pendientes con entidad. Ahora también son pendientes legítimos dos estados
nuevos: `faltaAlcance:true` (el arm `no_entity` declaró la variable y espera el «¿sobre qué?») y
`alcance:"global"` (el usuario contestó «el total», deliberadamente sin entidad puntual). El arm `no_entity`
persiste el primero — **solo si no había ya un pendiente vivo**, para que un turno de paréntesis no pise el
pendiente viejo. `repararPendingSimulation` limpia esos dos campos cuando una corrección le pone entidad: dejar
`faltaAlcance` vivo junto a una entidad haría que ADI volviera a preguntar lo que ya tiene.

### 3b · La red del alcance (`_resuelveAlcancePendiente`)

**Misma prudencia falla-cerrada del guard de pertinencia, no un criterio nuevo.** No alcanza con que el turno
*contenga* una palabra de total: se poda el vocabulario de total (`total/todo/global/general/cartera/negocio/…`),
el de eje (`clientes/SKU/marcas/familias`), los verbos de orden (`simula/corre/hazlo/…`) y el de las dos variables
del escenario — y **lo que sobra tiene que pasar por la MISMA lista blanca cerrada** (`_esRespuestaPelada`) que ya
gobierna las respuestas peladas. Si sobra un solo sustantivo de contenido, no es una respuesta de alcance y PLAN
corre normal con el pendiente envejeciendo.

La rama de entidad usa la misma vara contra el catálogo real del tenant (`axisEntityNames`), con dos candados: dos
ejes distintos a la vez → ambiguo, no se resuelve; más de 6 entidades → excede el cupo de fan-out, no se resuelve.

Medido (sección 2 del gate): **10 positivos** («el total», «el total de ventas», «todo el negocio», «toda la
cartera», «global», «en general», «todos los clientes», «sobre el total del negocio», «hazlo sobre el total»,
«simula sobre todo») y **5 negativos** que siguen yendo a PLAN («¿cuál es el total de ventas?» es una *lectura*;
«dame el total» pide el dato; «el total de la competencia» trae sujeto ajeno; «todos los clientes que compran
Bosch» trae criterio nuevo; «el margen total» nombra otra métrica). Más: «sobre Falabella» resuelve, «¿qué margen
tiene Falabella?» no — nombrar la entidad no alcanza si sobra contenido. **Y sin pendiente vivo la red no existe**:
«el total» suelto es un turno normal.

### 3c · El freno anti-simulación-ajena — la regla exacta

> **Con un `pendingSimulation` de precio/volumen vivo y sin resolver, una call de `simulateCosto` / `simulateCarga`
> / `simulateCapital` / `simulate` genérico se descarta, SALVO que el texto de ESTE turno nombre la palanca de esa
> tool.** Si tras el descarte el plan queda sin calls, se re-pregunta el dato que falta. `simulateGeneral` nunca se
> frena. El freno corre solo sobre planes **reales de PLAN** (un plan sintético lo armó el motor y no puede
> fabricar palancas) y se registra en `retryTrace.coerciones` como `freno-sim-ajena(...)`.

El vocabulario de cada palanca es cerrado y angosto: costo → `costo(s)`; carga → `carga`/`acciones comerciales`/
`rebate`; capital → `capital`/`inventario`/`stock`/`inmovilizado`. Para el `simulate` genérico se mira su `metric`,
y una métrica desconocida con pendiente vivo se trata como sospechosa (falla cerrada).

**El punto de freno se probó, no se prometió** (sección 3 del gate): «y si además el costo sube 2%» → `simulateCosto`
**corre**; «¿y si bajamos la carga comercial al target?» → `simulateCarga` corre; «¿cuánto capital liberamos…?» →
`simulateCapital` corre. Y sin pendiente vivo, `simulateCosto` corre normal aunque el turno no lo nombre: el freno
existe **solo** en la ventana donde hay un supuesto declarado que podría fabricarse.

### 3d · El supuesto del usuario, autorizado quirúrgicamente (`guardC.js`)

`guardC` recibe un parámetro nuevo, `supuestoPendiente`: un array de 1-2 strings con **el valor+unidad exactos** del
supuesto que vive en el pendiente (con signo y en valor absoluto — la narración escribe «baja 4%», nunca «-4%»).
Esas cifras se parsean con **el mismo parser de siempre** (`parseFigures`, jamás un segundo) y se empujan a `qFigs`,
la fuente de eco de la pregunta que ya existía. **Ningún chequeo se tocó, ni uno.** El caller las pasa solo mientras
el pendiente vive.

Por qué es quirúrgico, y está probado en el gate (sección 5, guardC aislado):

- sin el parámetro, el «4%» **sigue vetado** — el chequeo 1 no se relajó para nadie;
- con el supuesto pendiente, el «4%» del usuario pasa;
- la autorización **no alcanza a ninguna otra cifra**: un monto del dato (`$19.4M`) sigue vetado;
- **ni siquiera a un % vecino**: con el supuesto en 4%, un «5%» narrado sigue vetado;
- y en el circuito completo (sección 1): con el pendiente vivo, una cifra del dato sin dueño («4.5%», la carga de
  Falabella) **sigue cayendo** al genérico, exactamente como antes.

---

## 4 · El hilo medido, reproducido offline (`_alcance_pendiente_gate.mjs`, 59/59)

| Turno | Antes (producción, medido) | Ahora |
|---|---|---|
| t1 «Si subo ventas 4%, ¿qué cambia?» | declara volumen, pide entidad, **no guarda nada** | igual texto + **pendiente de alcance persistido** (volumen +4, falta precio) |
| t2 «sobre las ventas» | narrador vetado 2× por el 4% **del usuario** → genérico | PLAN corre (la frase no contesta el alcance), **el eco del 4% pasa**, 1 solo intento del narrador |
| t3 «simula sobre el total de ventas» | → PLAN → **`simulateCosto` sobre todos los SKU** | **sin PLAN**: alcance global tomado, pregunta solo el precio; la palabra «costo» no aparece |
| t4 «el precio queda igual» | (no existía) | `simulate` global de ventas +4%, boleta con el supuesto declarado, pendiente muerto **resuelto** |

El gate declara `@inyeccion-simulada` y cumple las 4 condiciones del escape (mocks locales de PLAN/NARRAR, sin
gateway, sin adapter, sin `src/ui/`, sin `fetch(`). **No carga `.env` a propósito**: no lo necesita y así no puede
gastar ni por accidente.

## 5 · Suite

`npm run gates:offline` completo: **149 PASS · 0 FAIL · 0 TOCARON LA RED · 0 CON CREDENCIAL VIVA (de 149
offline)** — el conteo subió de 148 a 149 y se verificó que el gate nuevo **aparece corrido** en la lista (✓
`_alcance_pendiente_gate.mjs`), no excluido en silencio. Regresiones del pase de hoy y del pendiente, todas verdes:
`_scenario_intent_gate` 61/61 · `_guia_promesas_gate` 30/30 · `_pendiente_pertinencia_gate` 86/86 ·
`_pendiente_por_estado_gate` 41/41 · `_pendiente_secuestro_por_sinonimo_gate` 58/58 · `_simulate_general_gate`
59/59 · `_guard_gate` 25/25 · `_umbral_dueno_gate` 22/22 · `_amplitud_*` verdes. **Cero llamadas a proveedor o
gateway en todo el turno**; el transcript se leyó como dato, nunca se re-midió.

## 6 · Qué frené para el owner (decisiones no obvias, todas reversibles)

1. **No inventé una simulación global de 2 variables.** Habría sido fácil promediar o aplicar el factor combinado
   sobre el total, y habría dado un número creíble. El motor no lo sostiene, así que se declina declarando el
   límite. Un límite declarado vale más que un verde apretado.
2. **La red del alcance NO se activa sin pendiente vivo.** Podría haberla hecho global («el total» siempre significa
   cartera), pero eso le cambiaría el comportamiento a turnos que hoy funcionan. Vive solo en la ventana donde ADI
   dejó la pregunta abierta.
3. **El freno exige que el turno nombre la palanca, no una lista negra de tools.** Una lista negra falla abierta con
   la primera tool nueva; esto falla cerrado y deja vivo el caso legítimo.
4. **No toqué los strings de voseo** de `answerViaOracle`/`dialogueState`/`conversationScope`/`toolContracts` (el
   worker paralelo los está reescribiendo). Los textos nuevos que sí escribí van en tuteo neutro — «Tomo el
   escenario sobre el total del negocio», «la corro sobre una entidad puntual» — salvo donde reutilicé
   `_preguntaPorFaltante`, que es el string existente y no me correspondía editar.

## 7 · Hallazgos reportados SIN tocar

1. **La pregunta del pendiente sale con minúscula pegada a la anterior**: «Tomo el escenario sobre el total del
   negocio. **¿c**uánto esperás que cambie el precio?» — `_preguntaPorFaltante` devuelve la frase en minúscula
   porque hoy siempre abre la oración. Es cosmético y el string es del worker paralelo; no lo toqué.
2. **`simulateGeneral` global sigue sin existir.** Si el owner quiere el escenario de dos variables sobre el total
   del negocio, es una tool nueva (agregar la venta de los 13 clientes y aplicar los dos factores es aritmética que
   el motor ya sabe hacer, pero es una decisión de producto, no un fix).
3. **PLAN sigue sin conocer el estado del pendiente.** El freno lo corrige *después* de que PLAN respondió: la
   llamada ya se pagó. Enseñarle el pendiente en el prompt ahorraría esa llamada — los prompts de ADI no se tocan
   sin autorización, y estaba fuera del encargo.

## 8 · Archivos del commit

- `src/adi/oracle/conversationScope.js` — los dos estados nuevos del pendiente (`faltaAlcance` / `alcance:"global"`)
  y la limpieza en `repararPendingSimulation`.
- `src/adi/oracle/answerViaOracle.js` — la red del alcance, la persistencia del pendiente en `no_entity`, el plan
  sintético global (correr o declinar), el freno anti-simulación-ajena, y el cableado del supuesto a guardC.
- `src/adi/oracle/guardC.js` — el parámetro `supuestoPendiente` (aditivo sobre `qFigs`; ningún chequeo tocado).
- `_alcance_pendiente_gate.mjs` — el candado permanente (59 aserciones).
- `_INFORME_SIMULACION_GLOBAL.md` — este informe.
