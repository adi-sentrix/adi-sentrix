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
