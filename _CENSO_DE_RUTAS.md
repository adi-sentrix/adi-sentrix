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
