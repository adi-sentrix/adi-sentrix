# EL VIGÍA · diseño para decisión del owner (nivel 4 · 2026-09-03)

**Qué es.** Hoy ADI responde cuando le preguntan. El motor ya detecta estados sin que nadie pregunte
(capital frenado, clientes cayendo, margen bajo el benchmark, contribución no capturada); el vigía es que
ADI **hable primero**. Este documento trae opciones, no supuestos: el owner decide la UX.

**La regla de oro, heredada de todo lo construido:** el vigía **no calcula nada nuevo y no inventa causas**.
Habla solo de estados que el motor YA declara, elegidos por la materialidad del piso relativo (0,05% de la
venta real — la misma vara del diagnóstico), localiza (quién y cuánto) y ofrece el primer paso. Es,
literalmente, la síntesis ejecutiva certificada («los 3 riesgos, por materialidad») servida sin que nadie
la pida. Esa pieza ya existe, ya pasa el muro y ya está congelada en la certificación.

---

## 1 · Qué habla y qué calla (igual en las tres opciones)

**Habla** — solo lo que el motor declara HOY, con el piso relativo mandando:

| Estado | De dónde sale (ya existe) | Ejemplo real (planilla del owner) |
|---|---|---|
| Venta cayendo vs año anterior | lectura del período (salesRead) | «Venta contra el año anterior: −40.5%» |
| Capital frenado | diagnóstico de inventario | «$38.1M frenado — encabeza ELE-CAB25 (165d)» |
| Contribución no capturada | diagnóstico de margen | «$2.0M — encabeza Comercial Valparaiso» |
| Carga comercial alta | diagnóstico comercial | (en su dato actual: bajo el piso → calla) |
| Margen bajo el benchmark | panel de margen | «15 clientes bajo el 30.1%» |
| Cobro estancado | mesa de flujo comercial | **solo si hay plazo declarado**; sin plazo, el vencido es «—» y el vigía no lo grita |

**Calla** — y esto es tan importante como lo que habla:
- Todo lo que quede **bajo el piso relativo**. Ejemplo medido: en el demo, el capital frenado es $33K y el
  piso $50K → el vigía del demo NO menciona inventario. *El vigía que grita por $33K bajo el piso es peor
  que ninguno.*
- **Causas.** «Dónde: encabeza X con $Y» sí; «porque X negocia mal» jamás — la regla 2 del contrato.
- Todo estado que el dato del tenant no sostiene (sin hoja Abonos no hay estado de cobro; sin plazo no hay
  vencido). El vigía se retira por pieza, igual que los playbooks.
- Máximo **3 estados** por aparición (la síntesis certificada). Un vigía de 8 alertas es un tablero con
  otro nombre.

**Registro:** ejecutivo siempre — cifras verbatim, una por oración, ofertas y no órdenes. El mismo composer
que ya pasó la certificación.

---

## 2 · Las tres opciones de UX

### (a) El resumen al abrir la Mesa
Al entrar a Sentrix, arriba del tablero, una franja de 2-4 líneas:

> **ADI vigila** — 3 focos materiales hoy:
> venta −40.5% contra el año anterior · $38.1M frenados en ELE-CAB25 · $2.0M de contribución no capturada (encabeza Comercial Valparaiso).
> *Umbral: bajo el 0,05% de tu venta no se lista.* → [Abrir con ADI]

- **Costo de construcción: MEDIO.** Un componente de UI nuevo en el panel + un llamado al composer
  determinístico existente. Sin llamadas al modelo.
- **Riesgo de ruido: BAJO.** Vive donde el usuario ya va a mirar números; no interrumpe nada.
- **Riesgo real: ceguera por costumbre.** Una franja fija se deja de leer a la semana. Mitigación barata:
  solo pintarla cuando el contenido CAMBIÓ desde la última visita.

### (b) Sección propia: «Lo que ADI vigila»
Una pestaña/pantalla dedicada: los focos materiales con su detalle, cada uno con QUÉ · DÓNDE · PRIMERO y
su botón («abrir la cuenta», «ver el SKU»), más el registro de cuándo apareció cada uno.

- **Costo de construcción: ALTO.** Pantalla nueva, navegación, estados vacíos, quizá historial de focos.
  El contenido sigue siendo determinístico, pero la UI es la más cara de las tres.
- **Riesgo de ruido: EL MÁS BAJO.** El usuario entra cuando quiere; el vigía nunca interrumpe.
- **Riesgo real: que nadie entre.** Una sección que hay que visitar reproduce el problema que el vigía
  viene a resolver (el dato estaba, nadie lo miró).

### (c) Proactivo en el chat al entrar
Al abrir el chat, ADI abre la conversación (una sola vez por sesión/carga):

> Antes de tu pregunta: hoy veo 3 focos materiales. La venta viene −40.5% contra el año anterior; hay
> $38.1M frenados en ELE-CAB25; y $2.0M de contribución no capturada, encabeza Comercial Valparaiso.
> ¿Abro alguno? También podemos seguir con lo tuyo.

- **Costo de construcción: BAJO.** El chat ya renderiza texto; es inyectar el composer existente como
  primer turno. Sin modelo (prosa determinística) o con UNA llamada si el owner quiere redacción variable.
- **Riesgo de ruido: EL MÁS ALTO.** Habla sin que le pregunten, cada sesión. Si los focos no cambian, el
  usuario escucha lo mismo tres días seguidos — mitigación necesaria: hablar solo cuando algo CAMBIÓ
  (nuevo foco, foco que cruzó el piso, foco que se resolvió) y callar el resto de las veces.
- **Riesgo real: tono.** Un asistente que abre la boca antes que el usuario define la relación. Bien
  hecho (corto, material, con oferta) es el vigía más vivo de los tres; mal calibrado es el clip de Office.

**No excluyentes:** (a) y (c) comparten el 100% del contenido; una combinación natural es (a) siempre +
(c) solo-cuando-cambia. Se puede empezar por una y sumar la otra sin rehacer nada: el contenido es el
mismo composer.

---

## 3 · La economía (medida, no estimada)

- **Detección: $0.** Los estados ya se calculan al cargar el dato (diagnóstico, panel de margen, mesa de
  flujo, lectura del período). El vigía no agrega ninguna corrida.
- **Selección: $0.** La materialidad por el piso + top 3 es la lógica ya certificada de la síntesis
  ejecutiva (determinística).
- **Prosa: $0 por defecto.** El composer determinístico ya produce el texto y ya pasa el muro. **Cero
  llamadas al modelo por sesión** en las tres opciones.
- **Opcional (decisión aparte):** si el owner quiere redacción variable («que no suene igual cada día»),
  UNA llamada de narración por aparición, con el muro de siempre encima. Costo por sesión: el de un turno
  normal (~US$0.005-0.02). Mi recomendación: lanzar determinístico; la prosa variable se decide después
  de verlo en uso.

---

## 4 · El silencio como estado válido — las dos posturas

Cuando no hay nada material, ¿el vigía dice «todo en orden» o no dice nada?

**Postura A — decir «en orden», con el umbral:**
> ADI vigila: sin focos materiales hoy (umbral: bajo el 0,05% de tu venta — $37K).

- A favor: la doctrina ya escrita en la casa — *«un silencio sin su umbral es inauditable desde afuera»*.
  «En orden» con umbral es información: alguien miró, con esta vara, y no encontró. El demo hoy sería
  exactamente este caso para inventario.
- En contra: en la opción (c) es un mensaje más que el usuario no pidió; «todo en orden» dicho a diario
  se vuelve ruido de fondo y devalúa el día que el vigía sí habla.

**Postura B — callar:**
- A favor: el silencio absoluto hace que cada aparición del vigía SIGNIFIQUE algo. Cero fatiga.
- En contra: indistinguible de «no miré» / «está roto». El usuario que no ve nada no sabe si está sano o
  si el vigía murió.

**Mi recomendación (para discutir, no decidida):** depende de la superficie — en (a)/(b) postura A (la
franja/sección existe igual; que diga «en orden» con el umbral). En (c) postura B (el chat solo abre la
boca cuando hay algo o algo cambió). Las dos conviven sin contradicción.

---

## 5 · La pregunta exacta para el owner

> **¿Dónde querés que ADI hable primero — (a) franja al abrir la Mesa, (b) sección propia, (c) proactivo
> en el chat, o una combinación (a)+(c) solo-cuando-cambia? Y cuando no haya nada material: ¿«todo en
> orden» con el umbral a la vista, o silencio total?**
>
> (El contenido en cualquier caso es el mismo: los focos materiales que el motor ya declara, top 3 por el
> piso relativo, sin causas inventadas, cero costo por sesión. La prosa variable con modelo es una
> decisión aparte y puede esperar.)
