# CENSO DE RUTAS · qué pregunta tiene piso y cuál depende de la suerte del cerebro (2026-09-05)

**Qué se midió.** 135 fraseos con **cerebro MUDO** sobre el demo. El cerebro mudo es el instrumento: lo que
responde bien con el cerebro apagado tiene **piso determinístico**; lo que sale `vacio` depende de que el
modelo acierte. No significa «roto en producción» — significa **sin garantía**.

**De dónde salieron los fraseos:** 65 `ask` de las superficies (los botones que la pantalla le ofrece al
usuario) · 19 turnos de la certificación · 9 preguntas reales del owner de esta semana · 42 variantes
naturales por familia (formal, coloquial, elíptica).

---

## 1 · La foto

| clase | cuántos | qué significa |
|---|---|---|
| **playbook** | 49 | camino garantizado, con su composer y su lista notarial |
| **piso sin playbook** | 2 | el puente de serie (entidad×período) responde sin playbook |
| **sin piso (`vacio`)** | 84 | depende del cerebro vivo |

**Cero secuestros vivos** tras cerrar el que este censo encontró (abajo). **Cero turnos con vetos** entre los
que sí tienen piso: lo que responde, responde limpio.

## 2 · El secuestro que había — CERRADO en esta vuelta

`«cómo viene Falabella»` caía en **la foto del negocio**. La foto excluía la palabra literal «cliente» pero no
un NOMBRE propio, así que una pregunta de entidad se colaba. Cerrado: si la pregunta nombra una entidad del
tenant, la foto se retira (el índice se usa solo para saber SI nombra a alguien — nunca para resolver un
parecido). Es la clase que el supervisor llamó más cara que un hueco, y salió del censo, no de una corrida
afortunada.

## 3 · Los huecos, rankeados por probabilidad de que el owner los pise

### 🔴 ALTA — el usuario los clickea o los escribe corto
1. **Los `ask` de la cara Capital (≈40 botones).** «¿Cuánto capital tengo en Santiago?» · «Profundiza en
   SAM-REF500L» · «¿Cómo libero el capital de LG-DRYER8KG?» · «¿Dónde está frenado mi capital?» · «¿Qué
   reponer por quiebre?». **Son promesas de pantalla**: el usuario hace click y hoy no hay piso. Es el bloque
   más grande y el más barato de cerrar en tanda (son cuatro formas, no cuarenta preguntas distintas).
2. **Fraseos cortos de familias que YA tienen playbook** — el detector pide más de lo que la gente escribe:
   · «los 3 riesgos» y «resumen para el directorio» → la síntesis exige tema **y** audiencia juntos;
   · «cuánto me compró Falabella» (sin período) → el puente exige el período;
   · «qué clientes están mal» / «mis peores clientes por margen» → margen exige la palabra «margen»;
   · «y el margen?» / «necesito ver márgenes» → margen exige un verbo de lectura;
   · «mantenés lo que dijiste» → el seguimiento no cubre esa forma.
   **Barato y de alto rendimiento: es ampliar léxico, no escribir composers.**
3. **`ask` de la Mesa comercial**: «¿Cómo van las ventas contra el presupuesto?» · «¿Cuánta contribución no
   estoy capturando?» · «¿Quiénes son mis principales clientes por venta?».

### 🟠 MEDIA — preguntas naturales sin familia propia
4. **La lectura simple de ventas**: «cómo van las ventas» · «cuánto vendimos» · «la venta cómo viene». Hoy
   solo hay `caida-de-ventas`, que exige señal de caída. Falta la lectura neutra.
5. **La serie mes a mes**: «como viene la venta mes a mes» (ya anotada por el supervisor). El deslinde
   funciona —la foto no la secuestra— pero la serie global no tiene piso propio en el demo.
6. **La ficha de una entidad**: «dame la ficha de Lider» · «qué pasa con Jumbo» · «cómo viene Falabella»
   (esta última quedó sin dueño al cerrar el secuestro: el hueco es real y ahora está a la vista).
7. **El inventario en fraseo natural**: «cómo está el inventario» · «qué stock no rota» · «capital
   inmovilizado» a secas.

### 🟡 BAJA — formas raras o ya cubiertas por otra vía
8. «qué pasa si subo precios 3%» · «proyectá 12 meses» (la proyección cubre las formas con tasa explícita).
9. «explicame el margen» · «cuál es la causa» sueltas (el porqué las cubre cuando nombran el tema).

## 4 · Lo que el censo dice del método

- **Los `ask` son el corpus más valioso y nadie los estaba midiendo contra el agente**: son las únicas
  preguntas que el producto *promete*. Un hueco ahí no es una pregunta que el usuario podría hacer: es un
  botón que ofrecimos.
- El patrón de los huecos de alta prioridad no es «falta un playbook»: es **el detector pide una frase más
  larga que la que la gente escribe**. Nueve de los diez casos de la categoría 2 se cierran ampliando léxico
  con los excluyentes ya probados.
- Regla para las tandas de cierre, del supervisor y confirmada por este censo: **ante la duda, false** — el
  único secuestro encontrado nació de un detector una pizca más ancho de lo necesario.

## 5 · Propuesta de tandas (para priorizar con el supervisor)

| tanda | qué cierra | costo | riesgo |
|---|---|---|---|
| **T1** | léxico corto de familias existentes (categoría 2) | bajo | bajo — es ampliar detectores con sus excluyentes |
| **T2** | los `ask` de Capital (4 formas) | medio | bajo — el motor ya tiene todo, falta el camino |
| **T3** | lectura neutra de ventas + serie global | medio | medio — deslinde con caída y con la foto |
| **T4** | ficha de entidad | medio | medio — cruza con el puente y con lectura por eje |

*Nada de esto se tocó todavía: el encargo era el informe. La poda del camino viejo espera a que se cierren
los huecos que se declaren graves.*

---

---

## 6 · VUELTA 1 · lo cerrado (2026-09-05)

**Mapa antes → después: 84 fraseos sin piso → 74 · 49 con playbook → 59.** Suite 232·0 en cada paso, cero
composers nuevos.

### T1 · léxico corto — el detector pedía más de lo que la gente escribe

| fraseo que no tenía camino | ahora lo atiende | cómo se abrió |
|---|---|---|
| «los 3 riesgos» · «resumen para el directorio» · «qué le digo al directorio» | síntesis ejecutiva | dos puertas nuevas y angostas: riesgos **como conjunto** · entrega **a comité** |
| «qué clientes están mal» · «mis peores clientes por margen» | margen en riesgo | la cartera nombrada por su **estado**, cediendo si aparece otra métrica |
| «y el margen?» · «necesito ver márgenes» | margen en riesgo | tema + **pregunta corta** (en una frase larga, el margen al pasar no es el pedido) |
| «mantenés lo que dijiste» | seguimiento del diario | las **tres personas** del verbo (tuteo · voseo · tercera) |
| «cuánto me compró X» **sin período** | entidad × período | detector **propio del playbook**: `detectSerieIntent` es del camino natural y §7 dice que no se mejora |

El último se verificó contra la planilla real: responde la película mes a mes en vez de inventar un mes que
nadie pidió. Cada ampliación se probó con sus **casos negativos**: cero secuestros en los siete controles.

### T2 · los asks de Capital, en las dos clases de la adenda

- **Libres** — «¿Dónde está frenado mi capital?» · «¿Dónde está inmovilizado mi capital?» · «¿Dónde sobra
  inventario?» → piso determinístico. El detector exigía una señal de asesoría («qué hago», «liberar») que un
  botón no trae; se sumó la **forma locativa**, que es literalmente lo que el botón pregunta.
- **De cuadro** — **sembrados, no construidos**, como ordenó el owner. Contrato en
  `_CONTRATO_ASK_DE_CUADRO.md`.

### El hallazgo de la siembra

**El emisor ya sembraba y el receptor no escuchaba.** La UI arma el contexto de la pieza tocada desde el
Contrato de Concordancia (agosto) y se lo pasaba **solo al camino natural**: `answerViaAgente` no lo recibía.
Cableado: entra, viaja y queda en el expediente del turno (`r.agente.viewContext`), con su caso congelado en la
certificación — llega · no se inventa cuando falta · no trae cifras. Los `ask` de Sentrix **no se tocaron**:
son contrato congelado; el receptor aprende, el emisor no cambia.

### Lo que sigue sin piso, y por qué no se forzó

- «qué stock no rota» · «cómo está el inventario» — tema sin estado ni ubicación. Entran en **T3** con la
  lectura neutra; forzarlos acá habría sido ensanchar un detector sin necesidad.
- Los ~35 **asks de cuadro** de Capital («¿Cuánto capital tengo en Santiago?» · «Profundiza en SAM-REF500L» ·
  «¿Cómo libero el capital de LG-DRYER8KG?»): **esperan el pulido del anclaje**, que el owner difirió. Su
  contexto ya llega al agente, así que el pulido tiene de dónde agarrarse.
- **T3** (lectura neutra de ventas · serie mes a mes) y **T4** (ficha de entidad) siguen abiertos, como estaba
  previsto en la priorización.

### Dos checks se movieron, y los dos eran mejoras

- «resumen ejecutivo para el directorio» **ya no necesita el empujón de R6**: tiene camino garantizado. El
  empujón se sigue midiendo, pero con una lectura que sí sigue sin playbook.
- La carnada del «detector ancho» se re-apuntó a la línea que hoy decide el caso general de margen.

*Y el `\b` imposible mordió por tercera vez, en el detector nuevo de «cuánto me compró X» — «compró» termina en
vocal acentuada. Corregido con el cierre unicode del §5g.*


---

## 7 · EL RE-CENSO (vuelta 2, 2026-09-05) — el examen para decidir LA PODA

**Mismo instrumento, mismas condiciones**: los 135 fraseos, demo, cerebro MUDO. Y encima del conteo, un
examen que el primer censo no tenía: cada camino nuevo por el turno completo × tres largos de hilo (todas las
semillas de variación), los caminos nuevos también en el **tenant plantilla** (el pack de planilla real), y el
no-secuestro re-medido contra los dueños de siempre.

### El arco completo

| clase | censo original | vuelta 1 | **vuelta 2** |
|---|---|---|---|
| **camino garantizado (playbook)** | 49 | 59 | **76** |
| **puente (serie entidad×período)** | 2 | 2 | **2** |
| **sin piso (`vacio`)** | 84 | 74 | **57** |

De los 65 `ask` de pantalla —los botones que el producto ofrece—, quedaron sin piso **49**, y **41 de esos
son los `ask` de cuadro que el owner difirió** (capital por bodega/familia/tramo, «Profundiza en <SKU>»,
«¿Cómo libero…?», el cobro por cliente): esperan el pulido del anclaje, y su contexto ya viaja al agente
(`viewContext`, vuelta 1). Del resto del corpus: certificación 17/19 con piso (las 2 sin piso son por diseño,
ver abajo) · owner 7/9 · naturales 38/42.

### Lo que la vuelta 2 cerró, con la línea que ve el usuario

- **La lectura neutra de ventas** («cómo van las ventas» · «cuánto vendimos» · «¿Cuánto vendí en el
  período?») → *«Tu venta del período viene en $100.0M y viene creciendo contra el año anterior: 7.6% sobre
  los $92.9M del año pasado.»* — y abre con la lectura, no con el desmentido de una caída que nadie afirmó.
- **Contra el presupuesto** (ask de la Mesa comercial que caía a `vacio`) → por encima / bajo / **«en línea
  con el presupuesto comprometido»** cuando la cifra publicada es 0.0% — el empate no toma partido.
- **La serie global mes a mes** → declina con la razón técnica (los valores mensuales no están en la boleta;
  los totales de `trend` son computed vetados) y entrega la lectura del período + dónde se ve el cuadro.
- **El inventario en castellano** («cómo está el inventario» · «qué stock no rota» · «capital inmovilizado»)
  → la única lectura que el motor publica (lo frenado), **con el recorte declarado** cuando el usuario no lo
  pidió: *«De tu inventario, lo que este dato publica es el capital que quedó frenado — no una foto del stock
  completo.»*
- **La ficha de entidad** (7 formas; y el puente ya la prometía: «pídemela o ábrela en su ficha») → *«Falabella
  · cliente. Venta del período: $19.4M — 1º de 13 por venta. Su margen es 22%, bajo el benchmark declarado
  (30.1%).»* — un solo paso, una sola fuente, la vara siempre al lado, y «la ficha localiza, no explica».
- **El declive honesto** de «cuánto me compró Falabella» en el demo → *«Este dato no trae la serie mensual por
  cliente. Lo que sí tengo es su año cerrado: …»* (era el declive genérico).
- **Los otros dos ask comerciales**: «¿Cuánta contribución no estoy capturando?» es margen-en-riesgo dicho con
  otras palabras; «¿Quiénes son mis principales clientes por venta?» es el eje cliente (solo por venta).

### El examen, y lo que cazó (esto es lo que le da peso)

El examen no fue un conteo: **cazó cuatro defectos e impidió dos secuestros** antes de que llegaran a nadie.

1. **«cómo viene LG» era un secuestro VIVO**: la foto del negocio se lo llevaba porque el guardia de entidades
   salteaba nombres de menos de 3 letras. Cerrado unificando el guardia (una copia, no dos) con capitalización
   exacta para los cortos.
2. **«cuánto vendí a crédito vs contado»**: al ampliar las conjugaciones, la lectura de ventas se lo llevó a
   cobranza — **los gates existentes lo cazaron** y se devolvió el turno. Ídem **«cuánto vendí el año
   pasado»**: el pasado a secas es otra pregunta (el gate de proyección lo tenía congelado) y la lectura se
   retira; la comparación «contra el año pasado» sí es suya.
3. **El muro tenía un falso positivo estructural**: localizaba cada cifra con `indexOf`, y «3.5%» (la meta de
   carga) se encontraba **dentro** de «23.5%» (el margen de Sodimac) — la ficha de Sodimac, correcta, salía
   vetada como «3.5% narrado como margen». Arreglado con frontera numérica; la carnada demuestra que con el
   `indexOf` de vuelta el veto **reaparece** sobre el par real del turno.
4. **El gate del bundle cazó datos del tenant en el código**: los `ejemplos` del playbook de ficha metían
   «Lider» y «Jumbo» al grafo de esbuild. Las muestras viven ahora en el gate.

Más el patrón que este examen confirmó como **defecto de clase**: detectores escritos para una sola
conjugación — `cu[aá]nto` no veía «cuánta/cuántos», «vendimos» no veía «vendí», «venimos» no veía «vamos».
Tres cierres de una palabra cada uno, y los tres eran fraseos reales (dos de ellos, botones de pantalla).

**Variantes × hilos**: 8 caminos nuevos × 3 largos de hilo, turno completo — cero vetos, cero registro
prohibido, cero jerga interna, cero imperativos. **Plantilla**: la lectura neutra reporta la caída real del
pack (−0.9%) con su voz; el inventario declina honesto («no hay señal de inventario para estos filtros»); la
ficha sirve a «Depósito Riachuelo» sin tropezar con la trampa histórica del eje bodega.

### Hallazgos de fondo que el owner debe conocer (no bloquean, no se taparon)

- **La misma herramienta da cifras distintas llamada directo que dentro del turno** (`entityProfile` de Lider:
  $17.9M directo, $17.8M en el turno — raw 17.857.000 vs 17.843.000). El escenario entra por un canal que la
  llamada directa no usa. La ficha es coherente consigo misma (cita verbatim lo que el turno le da), pero esto
  **conecta con la deuda ya anotada** («10 gates afirman cifras contra un escenario no declarado») y significa
  que una sonda directa no prueba lo que el usuario ve.
- **`entityRecord` y `entityProfile` difieren en 1 de 13 clientes** (Lider, redondeo $17.8M vs $17.9M). La
  ficha usa una sola fuente justamente por esto.
- El motor publica el margen de la ficha como «22%» donde otras superficies dicen «22.0%» — mismo valor,
  formato distinto; se cita verbatim, pero es una segunda forma visible del mismo número.
- En el foco `vs_presupuesto` el motor no publica el par de cifras del headline (sí en `vs_anterior`): la
  lectura contra el plan da el porcentaje y la brecha por cliente, sin los dos totales.

### Los 57 sin piso, clasificados

| grupo | cuántos | qué son | qué costaría |
|---|---|---|---|
| **`ask` de cuadro diferidos** | 41 | capital por bodega/familia/tramo · «Profundiza en <SKU>» · «¿Cómo libero…?» · cobro por cliente | esperan el pulido del anclaje (decisión del owner); el contexto ya llega |
| **simulaciones de `ask`** | 5 | «¿Qué pasa si llevo la carga al target?» · «…si libero el capital?» · «¿Qué reponer por quiebre?» · «¿Qué SKU libero primero?» | familia propia (simulación guiada); el motor tiene simulateCarga/simulateCapital |
| **el porqué elíptico** | 4 | «por qué pasa eso» · «cuál es la causa» · «profundiza en el porqué» · «¿y qué harías primero?» — **caen a `vacio` aun con hilo de margen** | candidata T5 barata: las puertas angostas del seguimiento, misma nota («hoy la única tesis es la del margen»); riesgo: cambio de tema si la última lectura no fue de margen |
| **comparación entidad×año** | 1 | «¿Cómo viene Lider vs el año pasado?» (ask) | el dato la trae (Lider · YoY en salesRead); forma nueva chica |
| **con dueño imposible, por diseño** | 4 | «quiénes me están dejando de comprar» (sin historial cliente×SKU — hueco declarado del dato) · «Dame una versión más dura» (re-narración: es del cerebro por diseño) · «¿De dónde saca Hites su contribución?» (composición cliente×SKU es afinidad modelada) · «entrada de caja mes a mes» (sin serie de caja) | lo honesto acá es el declive con razón — hoy caen al rescate genérico, no al declive específico |
| **proyección sin tasa** | 2 | «proyectá 12 meses» · «qué pasa si subo precios 3%» | 🟡 del censo original, sin cambio |

### La lectura para LA PODA — los números, y una opinión marcada como opinión

Lo que la poda retira es **el rollback**: la cascada agente → natural → oráculo pierde el peldaño del medio.
Con esta vuelta, el turno libre queda así: **76 de 135 con camino garantizado y examinado** (era 49 al abrir
el censo), 2 en el puente, y de los 57 restantes **41 son botones que hoy sirve el natural con su anclaje de
cuadro** — es la única familia donde el natural todavía hace un trabajo que el agente no tiene garantizado.

**Criterio mío, para decidir con esto:** la poda del turno LIBRE es defendible hoy — todo lo que el owner
preguntó esta semana tiene camino o declive honesto, y la certificación está congelada en verde. Lo que no
está listo para quedarse sin red son los **`ask` de cuadro**: podar antes del pulido del anclaje deja 41
botones de pantalla al criterio del cerebro, sin garantía y sin rollback. Si la poda urge, el orden que no
rompe promesas es: primero el pulido del anclaje (o re-apuntar esos botones al agente con su `viewContext`,
que ya llega), después La Poda. Esa secuencia es decisión del owner; los números de arriba son el estado
verificado.

*Suite tras cada cierre de esta vuelta: 232 PASS · 0 FAIL · 0 TOCARON LA RED · 0 CON CREDENCIAL VIVA. Cada
camino nuevo con su caso de certificación (la línea textual) y su carnada en ROJO. Los tres gates que se
movieron se re-apuntaron sin perder lo que reclamaban — y el contraste del empujón R6, que ya se había movido
en T1, ahora se busca su pregunta solo: si un día no queda ninguna lectura sin playbook, se pone rojo para
avisar que el empujón se quedó sin dominio.*

---

## 8 · CODA · el pulido del anclaje (GO del owner, 2026-09-05)

Con la palabra del owner —*«cada botón debe responder sobre el cuadro exacto que el usuario está mirando»*—
los 41 `ask` de cuadro diferidos se cerraron el mismo día en `askDeCuadro.js` + T5 (el porqué elíptico, que
abre SOLO con hilo de margen). **El censo queda: 118 de 135 con camino garantizado · 2 en el puente · 15 sin
piso** — y esos 15 son las simulaciones de ask (5), la proyección sin tasa (2), las elípticas del porqué
medidas sin hilo (4 — CON hilo de margen ya abren, que es como llegan en vivo), los imposibles por diseño
(3: re-narración, «quiénes dejaron de comprar», la caja mes a mes) y la comparación entidad×año (1).

El anclaje se prueba **contra el cuadro vivo** (`buildMesaCapital` en el gate, fila por fila), la frontera de
universos quedó como regla notarial con carnada, y el corte por edad —que el motor no publica— se declara en
vez de servirse el más parecido. Detalle de reglas y decisiones: `_CONTRATO_ASK_DE_CUADRO.md` §5.
