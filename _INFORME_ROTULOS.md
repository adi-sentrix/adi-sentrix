# Los rótulos de la boleta — lo corregido y la decisión que queda abierta

**Fecha:** 2026-09-10 · **Origen:** medición del owner sobre `entityProfile` y `rolesCartera` con el pack de
demostración (escenario «bonanza»). No salió de leer código: salió de mirar lo que la boleta publica.

---

## 1. Qué estaba mal (medido, no supuesto)

Un **rótulo** de la boleta es superficie: el narrador lo cita textual y el respaldo determinístico lo imprime
verbatim cuando el narrador no llega. Ningún barredor lo miraba, porque un rótulo no es prosa.

| # | Lo que publicaba | Qué estaba mal | Cómo se llama ahora |
|---|---|---|---|
| 1 | `Meta de carga comercial = 3.5%` | «meta» está prohibida en superficie (CLAUDE.md §4 y el cerrojo `lexico-meta`): las metas las fija el cliente, no nosotros | `Nivel de carga comercial declarado` |
| 2 | `Clientes del tramo alto bajo la vara = 3` | «vara» está prohibida en superficie desde el sello ejecutivo | `Clientes del tramo alto bajo el benchmark` |
| 3 | `Falabella · Ranking Margen Desde Abajo = 2.0%` | es un **puesto** (2º de 13) sellado como porcentaje — y ya estaba publicado bien al lado | se retiró: la buena (`2º de 13`, unidad `rank`) queda sola |
| 4 | `Falabella · Total Con Margen = 13.0%` | es un **conteo** (13 clientes) sellado como porcentaje | se retiró: es el denominador del ranking, que ya viaja entero |

**Los otros cuatro que aparecieron al barrer.** El mismo defecto de #1 vivía en cuatro rótulos más, con la
palabra en inglés: `Target de carga comercial` (`entityRecord`), `Target de carga` (`rolesCartera`,
`executiveSummary`, `simulateCarga`) y `De esos, los que además exceden el target de carga`. Es la misma cifra
—3,5%— bajo tres nombres distintos, uno de ellos prohibido. Quedaron todos con **un solo nombre**, que sale de
un solo lugar (`REFERENCIA_CAMPO.pctRebate.label`, en `entityRecord.js`).

**La raíz de #3 y #4** no era un composer: era el **ledger**. Al enriquecer la boleta desde los `facts`, decide
la unidad de un número crudo mirando si la CLAVE contiene la palabra de una métrica — y
`rankingMargenDesdeAbajo` y `totalConMargen` contienen «margen». Ahora la **naturaleza manda sobre la palabra**:
un puesto o un conteo no se sellan como tasa. No se les inventa la unidad buena; se dejan pasar, porque un
ordinal sin su universo («2» sin «de 13») no significa nada suelto — y el composer que sí conoce el universo ya
los publica enteros.

**El candado.** `_registro_boleta_gate.mjs` se extendió (no se creó uno nuevo) en tres frentes: barre la boleta
**tipada** —la que ve el turno, donde nacen los rótulos que ningún composer escribió—, incluye la caja del
**agente** (que no miraba: por eso «vara» convivió en verde con un gate que la veta desde agosto), y suma dos
chequeos: «meta»/«target» sobre el benchmark o la carga (consumiendo la **misma** regla `lexico-meta` que multa
la prosa, no una copia) y la **unidad contra el rótulo**. Con carnadas: los cuatro rótulos medidos ponen el
candado rojo.

---

## 2. La decisión que queda abierta — NO se cambió

> **`entityProfile` publica el nivel de carga comercial declarado SOLO cuando la cuenta lo excede.**

Verificado en el pack de demostración: aparece en Falabella (4,5%), Sodimac (5,4%), Easy (5,5%), La Polar
(3,9%), Jumbo (3,8%), Ripley (4,8%) — y **no** aparece en Mercado Libre (1,8%).

**Por qué importa.** El usuario está decidiendo si concede más acciones comerciales en una cuenta, y justo en
esa conversación —la de la cuenta que todavía tiene margen bajo la referencia— la referencia no está en
pantalla. Sin ella no hay contra qué medir cuánto más se puede ceder.

**Por qué es así hoy.** La fig se emite dentro del mismo bloque que calcula el *exceso* de acciones comerciales
en dólares, y ese bloque sólo corre si `carga > nivel declarado`. La referencia viaja de acompañante del
exceso, no por derecho propio.

**Las tres salidas, para que jc elija:**

**A — Publicarla siempre (recomendada).** La referencia sale del bloque del exceso y se emite en toda ficha de
cliente que tenga carga comercial. El exceso en dólares se sigue emitiendo sólo cuando existe.
· *A favor:* la referencia es contexto, no un veredicto; el usuario la necesita más cuando todavía hay espacio.
· *En contra:* una fig más en cada ficha de cliente (hoy son 11-13). Cambia la boleta de un turno que no se
pidió cambiar, así que hay que volver a medir que no desplace nada.

**B — Publicarla siempre, y decir de qué lado está.** Lo de (A) más una segunda fig con la distancia contra la
referencia, en los dos sentidos: `Mercado Libre · margen de holgura en carga = 1.7 pp`.
· *A favor:* responde la pregunta que el usuario trae («¿cuánto más puedo ceder?») en vez de dejársela de tarea.
· *En contra:* es una cifra NUEVA. Hay que decidir si «holgura» es una lectura que el dato autoriza o una
sugerencia disfrazada — y el asesor no gestiona: informa para que el dueño decida.

**C — Dejarlo como está.** La referencia aparece cuando hay algo que juzgar.
· *A favor:* cero riesgo, cero trabajo.
· *En contra:* es la situación que el owner encontró.

Nada de esto se tocó. Está declarado acá para que no se pierda por el camino.

---

## 3. Lo que se declara y NO se hizo

- **`criteria.js` · `target_carga.label = "Target de carga comercial"`.** Es el rótulo del criterio que el
  usuario declaró («recordá que mi target de carga es 3%»), no una fig de boleta, y va a la lista de criterios
  activos de la pantalla. Cae en la misma familia de palabra, pero es vocabulario de la **cara de criterios** y
  es decisión de UX del owner. El barredor de rótulos no lo mira: barre boletas de herramientas.
- **`voiceGuard`** sigue **sin** barrer «target» del texto narrado. Su exención está documentada («es label vivo
  del dato») y esa justificación se debilitó con este pase, pero sacarla reescribiría prosa en vivo y eso es
  tocar comportamiento de ADI. Se declara; no se cambió.
- **`datoProyectado.js`** escribe «Meta de carga comercial 3,5%» en la **carpeta que el cerebro lee** (no es
  pantalla). El comentario de ese mismo archivo dice que una palabra prohibida ahí «se la está ENSEÑANDO». Es
  prompt de ADI: no se toca sin la palabra del owner.
- **`METRICAS_DE_REFERENCIA`** (`businessPolicy.js`) sigue trayendo sólo `Benchmark de margen`. Agregarle el
  nivel de carga le cambiaría la **procedencia** a esas cifras en el contrato de narración — es otro frente.
