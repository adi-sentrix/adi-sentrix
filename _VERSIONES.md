# Versiones de ADI

**La regla (owner 2026-08-16):** cada vez que el owner dice **«deployalo»**, el deploy sale con las cuatro cosas
en el mismo momento — **número de versión · tag en el repo · `/api/version` actualizado · nota corta**. Puestas
después, se abandonan: ya pasó una vez (`v1.0-demo-privada` quedó 533 commits atrás de su propio producto).

**Formato.** Cambios normales suben el segundo número (1.1 · 1.2 · 1.3). Un cambio grande sube el primero (2.0).
**Supabase + carga de archivos ya está reservado como 2.0.**

**Dónde vive cada cosa.** El número: `src/config/version.js` (una sola fuente). La nota: este archivo. El tag:
el repo. Que los tres digan lo mismo lo verifica `_version_gate.mjs`.

---

## 1.2 — producción · tag `v1.2`

La versión que saca de producción la **lotería de la respuesta vacía**. Cuatro veces, en sesiones distintas, el
cerebro devolvió CERO texto: se pagaba la llamada entera y el usuario recibía el suplente. Es la falla que el owner
fotografió. Se instrumentó primero y la causa apareció en el primer turno medido: el proveedor gastaba **el tope
completo de tokens razonando** y no llegaba a escribir la respuesta, porque el pedido **no declaraba nada** sobre
razonamiento y decidía el default del proveedor. Ahora el presupuesto se declara siempre, y si se enciende, el tope
sube por encima: al texto le queda su espacio.

- **Seguridad multiempresa (vía 1).** El navegador deja de recibir el dato de las demás empresas: el servidor
  entrega el de UNA por pedido y la app arranca vacía hasta que llega. Medido en el bundle publicado:
  `NevadaFoods` 9→0, los clientes de la segunda empresa 8/8→0. La empresa sale de la firma del código de acceso.
- **Guard de nombres inventados, por fin en producción.** Cazaba «Falcon» por Falabella con las cifras correctas —
  ningún control de cifras lo veía. Vivía sin publicar desde el 14 de julio: **la protección no existía**. Entra
  adaptado al dato por empresa: arma su catálogo del tenant activo y juzga a la empresa que está mirando.
- **Tres falsos positivos del notario, cerrados.** Mandaban al suplente respuestas que eran CORRECTAS: el sujeto
  detrás del verbo («el que más capital tiene ES X»), «días de inventario» leído como si declarara el universo, y
  un título de sección pegado a la viñeta siguiente.
- **El suplente dejó de tirar lo que la conversación ya validó**, y su escalón intermedio ofrece la última
  respuesta APROBADA — nunca un respaldo anterior disfrazado de respuesta verificada.
- **Voseo fuera de pantalla.** «resolvé» llegó a producción: de las cinco posiciones donde se lava una orden, solo
  dos funcionaban, y eran justo las dos que el gate probaba.
- **Observabilidad.** ADI registra por turno cómo se portó —ruta, estado, vetos, reparaciones, llamadas, latencia—
  sin guardar dato de negocio. Es la tabla que Supabase va a heredar.
- **Candado nuevo**: nadie vuelve a derivar el dato de empresa en tiempo de import, el defecto que dejó MUDO al
  guard de entidades. Se prueba a sí mismo con una copia del defecto real.

**No incluye carga de archivos** — eso sigue reservado para la 2.0.

Verificado antes de subir: **167 PASS · 0 FAIL · 0 tocaron la red**, en árbol limpio.

---


## 1.1 — tag `v1.1` (estuvo en producción del 2026-08-20 al 2026-08-21)

Todo lo que `dev` acumuló desde la 1.0: el trabajo del notario y el de la interfaz, juntos.

- **«Vara» fuera de pantalla**: los 4 textos de producto, el glosario (la palabra queda como alias de ENTRADA,
  el concepto visible pasa a «tu referencia») y 5 razones del manifiesto que terminaban en el prompt.
- **Los dos cierres del Examen 4**: los superlativos se verifican contra el conjunto y la métrica («el peor
  margen» es una clasificación, y una clasificación es evidencia), y ADI marca qué es dato duro y qué es
  criterio suyo cuando recomienda, aunque no se lo pidan.
- **La etiqueta de los días**: «días sin rotar» no existe en el dato — hay días de inventario y días sin venta.
- **Cada ranking se declara entero**: universo · dirección · polaridad · regla de empate · campo fuente ·
  términos. Incluye el eje SKU, que antes no tenía contra qué verificarse.
- **Un total del conjunto se declara**: «$X en la cartera» o sale del dato con ese dueño, o va declarado como
  cuenta. Cierra el agujero por el que un titular dijo «brecha de $4.16M en la cartera» sumando 3 de 8 clientes
  — la brecha real es $5.37M. Medido en producción y reproducido antes de arreglar.

### Y la interfaz

- **La pantalla de inicio nueva** (diseño del owner, variante A del mockup del 2026-08-20). La anterior estaba
  vacía: título, una línea y el campo abajo del todo. Ahora el hexágono de la marca abre la pantalla sobre el
  campo de hexágonos de la landing, **el campo de pregunta sube al centro** mientras no hay conversación y baja
  a anclarse al primer mensaje, las cuatro preguntas quedan a la vista, y una banda muestra **el pulso del
  negocio**: cuántos clientes, cuántos bajo el benchmark, el margen promedio y el capital inmovilizado, cada
  cifra clickeable hacia su pregunta. Las cifras las arma el motor (`pulsoInicio.js`), no la pantalla.
  Al implementarla se corrigieron tres palabras que el mockup traía y la casa no usa: «vara» → **benchmark**,
  «detenido» → **inmovilizado**, «margen consolidado» → **margen promedio**.
- **La barra superior se eliminó** (diseño del owner, 2026-08-20). La marca, las dos acciones (Mesa de control
  y ¿Cómo funciona?) y los cuatro indicadores de estado se mudaron a una **barra de barritas en el borde
  derecho**: contraída mide 44 px y solo se ven las barritas; las opciones aparecen al pasar el cursor —o al
  tabular con el teclado— y se van solas. La barrita de lo que está activo queda más larga y encendida.
  No tiene fondo ni borde y va fuera del flujo, así que **el campo de hexágonos pasa por debajo hasta el
  borde**: las barritas flotan sobre el lienzo, no en una franja aparte. El chat gana los 56 px del header y
  desaparece el corte horizontal que partía la pantalla.
  Nota: el selector de escenarios —apagado en todos los perfiles desde el 2026-08-07— se quedó sin punto de
  montaje; el componente y el eje `scenario` siguen intactos.
- **La Mesa abre al 50/50**, siempre, en cada apertura (antes: 460 px fijos). Las tablas de la cara Comercial
  piden entre 620 y 640 px, así que con 460 un tercio de las columnas nacía fuera de la vista. Sigue siendo
  arrastrable y «agrandar» sigue llevándola al 72%.
- **El versionado**: esto mismo.

⚠️ **Y lo que venga del frente de UX entra acá también.** Esta versión no es «lo del notario» ni «lo de la
interfaz»: es TODO lo que `dev` acumuló desde la 1.0. Antes de desplegar se corren los gates sobre el árbol
COMBINADO, no sobre cada parte por su lado.

---

## 1.0 — tag `v1.0` · commit `b9c552e` (estuvo en producción hasta el 2026-08-20)

ADI privado con camino natural, notario calibrado, contrato `[[CALCULO]]`, reparación, suplente seguro, carpeta
única, preguntas reales del «Cómo funciona» y controles anti-invento para cifras, estados, rankings, universos y
cálculos.

---

## v0.1-demo-privada — *legacy* · commit `500165c`

La demo privada con código compartido, **antes** del camino natural, del notario y del contrato de cálculo.
Se llamaba `v1.0-demo-privada`; se renombró para que no hubiera dos «1.0» confundiendo el producto con la demo.
No comparte línea de numeración con la de arriba: es otra época del producto.
