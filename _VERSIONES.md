# Versiones de ADI

**La regla (owner 2026-08-16):** cada vez que el owner dice **«deployalo»**, el deploy sale con las cuatro cosas
en el mismo momento — **número de versión · tag en el repo · `/api/version` actualizado · nota corta**. Puestas
después, se abandonan: ya pasó una vez (`v1.0-demo-privada` quedó 533 commits atrás de su propio producto).

**Formato.** Cambios normales suben el segundo número (1.1 · 1.2 · 1.3). Un cambio grande sube el primero (2.0).
**Supabase + carga de archivos ya está reservado como 2.0.**

**Dónde vive cada cosa.** El número: `src/config/version.js` (una sola fuente). La nota: este archivo. El tag:
el repo. Que los tres digan lo mismo lo verifica `_version_gate.mjs`.

---

## 1.1 — producción · tag `v1.1`

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

## 1.0 — producción · commit `b9c552e` · tag `v1.0`

ADI privado con camino natural, notario calibrado, contrato `[[CALCULO]]`, reparación, suplente seguro, carpeta
única, preguntas reales del «Cómo funciona» y controles anti-invento para cifras, estados, rankings, universos y
cálculos.

---

## v0.1-demo-privada — *legacy* · commit `500165c`

La demo privada con código compartido, **antes** del camino natural, del notario y del contrato de cálculo.
Se llamaba `v1.0-demo-privada`; se renombró para que no hubiera dos «1.0» confundiendo el producto con la demo.
No comparte línea de numeración con la de arriba: es otra época del producto.
