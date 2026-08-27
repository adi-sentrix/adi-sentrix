# Versiones de ADI

**La regla (owner 2026-08-16):** cada vez que el owner dice **«deployalo»**, el deploy sale con las cuatro cosas
en el mismo momento — **número de versión · tag en el repo · `/api/version` actualizado · nota corta**. Puestas
después, se abandonan: ya pasó una vez (`v1.0-demo-privada` quedó 533 commits atrás de su propio producto).

**Formato.** Cambios normales suben el segundo número (1.1 · 1.2 · 1.3). Un cambio grande sube el primero (2.0).
**Supabase + carga de archivos ya está reservado como 2.0.**

**Dónde vive cada cosa.** El número: `src/config/version.js` (una sola fuente). La nota: este archivo. El tag:
el repo. Que los tres digan lo mismo lo verifica `_version_gate.mjs`.

---

## 1.8 — producción · tag `v1.8`

**La app cambia de cara.** ADI pasa a papel claro; Sentrix se queda en negro. El corte del medio deja de ser un
defecto y pasa a ser el mensaje: **a la izquierda se conversa, a la derecha se mide.**

Es el rediseño que subió apagado en la 1.7. El owner lo miró y lo encendió.

- **Lo que se ve.** El lienzo de la conversación en papel, el historial un paso más adentro, las tarjetas en
  blanco puro: la jerarquía se hace con el papel y no con líneas. El campo de hexágonos se invierte —de luz
  tenue sobre negro a tinta tenue sobre papel— y late. La respuesta de ADI **pierde la burbuja**: queda el
  hexágono al costado y el texto sobre la hoja, de modo que se lee como algo escrito y no encajonado.
- **Lo que sigue en negro, y por qué.** Sentrix entero, los gráficos que ADI dibuja dentro de sus respuestas y
  el pulso del inicio. La regla es *todo lo que mide viene en oscuro*, y la costura entre los dos mundos es una
  **sombra**: el tablero se apoya sobre la hoja en vez de cortarla. Gracias a eso no se recalibró ni una serie,
  ni un semáforo, ni un sello — siguen sobre el fondo donde ya funcionaban.
- **El pulso del inicio se queda** y pasa a ser una tarjeta oscura apoyada sobre la hoja. Sus cuatro cifras
  siguen siendo botones que mandan una pregunta ya verificada al chat: son puertas de entrada, no datos
  repetidos de la Mesa.
- **La vuelta atrás, en la dirección.** Agregar **`?papel=0`** devuelve la app oscura completa, sin tocar una
  línea ni desplegar nada. Es el mismo interruptor de la 1.7, dado vuelta.

Verificado antes de subir en los dos sentidos: sin parámetro el lienzo queda en `#fafafa` con el texto en
`#17181c` y el pulso como tarjeta negra; con `?papel=0` vuelve a `#0a0a0a` con el pulso en banda. **181 PASS ·
0 FAIL · 0 tocaron la red.**

⚠️ **El defecto de la 1.7 que quedó cerrado antes de encender esto:** el hexágono de la marca, en la barra
lateral, tenía su trazo en blanco escrito a mano y sobre papel desaparecía. Con el rediseño apagado nadie lo
habría notado; encendido, es lo primero que se ve. Se cazó con un barrido de contraste sobre la app corriendo.

**Sin decidir todavía**, y ninguna bloquea: el tono del panel de historial y los tres modos de la barra lateral.

## 1.7 — tag `v1.7` (estuvo en producción el 2026-08-26)

**Nada cambia de aspecto al entrar.** Esta versión sube dos cosas que están apagadas o que no se ven: el
rediseño «papel y tablero» detrás de un interruptor, y un candado que protege la estructura de la plantilla.
Es una versión de andamio, y vale la pena que quede dicho así.

- **«Papel y tablero», completo pero apagado.** El rediseño de la interfaz —ADI en papel claro, Sentrix en
  negro, y una sombra como única costura entre los dos— viaja entero detrás de **`?papel=1`**. Sin ese
  parámetro en la dirección, la app queda **exactamente** como estaba: mismo negro, misma tipografía, mismos
  colores. Se puede mirar en vivo agregando el parámetro, y se apaga sacándolo.
- **La regla que lo hace barato:** *todo lo que mide viene en oscuro; el papel es donde se conversa*. Sentrix,
  los gráficos que ADI dibuja dentro de sus respuestas y el pulso del inicio viven en un juego de tokens
  aparte que el interruptor no toca. Por eso no hubo que recalibrar ni una serie, ni un semáforo, ni un sello:
  siguen sobre negro, que es donde ya funcionaban.
- **El pulso del inicio se queda**, por decisión del owner, y sobre papel pasa a ser una tarjeta oscura
  apoyada sobre la hoja. Sus cuatro cifras siguen siendo **botones** que mandan una pregunta ya verificada al
  chat: son puertas de entrada a la conversación, no datos repetidos de la Mesa.
- **La estructura de la plantilla queda congelada.** Un candado nuevo compara el contrato vivo contra un sello
  con la estructura aprobada: agregar una columna opcional al final pasa; quitar, renombrar, reordenar o volver
  obligatoria una columna se pone rojo y exige subir la versión de la plantilla con su razón escrita. No impide
  romper la compatibilidad — impide romperla **en silencio**, que es lo que hizo falta después de que la
  estructura cambiara dos veces en dos versiones.

Verificado antes de subir: **181 PASS · 0 FAIL · 0 tocaron la red**, con dos candados nuevos
(`_plantilla_congelada_gate` y `_papel_y_tablero_gate`). El segundo existe para sostener la promesa de arriba:
compara la paleta apagada contra un sello con los valores anteriores, token por token, y se pone rojo si
alguien mueve uno creyendo que «solo afecta al modo papel».

⚠️ **Un defecto que solo apareció mirando la pantalla:** el hexágono de la marca, en la barra lateral, tenía su
trazo en blanco escrito a mano. Sobre el negro se ve; sobre papel desaparecía. Se cazó con un barrido de
contraste sobre la app corriendo —buscar todo elemento casi blanco que esté sobre una superficie clara— y no
leyendo el código. De nueve coincidencias, ocho eran correctas y esa no.

**Sin decidir todavía**, y ninguna bloquea: el tono del panel de historial y los tres modos de la barra lateral.
Los dos son andamios que en algún momento hay que cerrar.

## 1.6 — tag `v1.6` (estuvo en producción el 2026-08-26)

**La plantilla se explica sola, y la vara dice de quién es.** El usuario abre el archivo y sabe qué llenar sin
leer un manual; y cuando ADI compara su margen contra una referencia, dice si esa referencia la puso él o la
pone ADI.

- **Cuatro pestañas, no dos.** `Empresa` (identidad y período, sola, sin mezclarse con los datos) · `Ventas` ·
  `Inventario` · `Ejemplo`, que viaja **dentro del mismo archivo**: se acabó la descarga aparte. Un archivo, un
  botón.
- **Los campos obligatorios van en amarillo**, y arriba de cada columna está su explicación en minúscula: qué es
  ese dato y cómo se llena. Se puso a la vista y no como comentario de Excel a propósito — un comentario hay que
  descubrirlo pasando el mouse por una esquinita, así que resuelve mal justo lo que había que resolver.
- **La hoja dice, escrito, qué pasa si dejas una columna opcional vacía**: el archivo entra igual, pero ADI no va
  a poder responder sobre eso.
- **La fecha reemplaza al período.** Se pide día completo (aaaa-mm-dd) aunque hoy se agrupe por mes: el día queda
  guardado para cuando haga falta.
- **Entra «punto de venta»**, opcional, para los clientes con varias sucursales. Se guarda desde ya y queda
  **declarado como dato disponible, no como métrica**: la preview dice cuántas sucursales se guardaron y que ADI
  todavía no analiza por ahí. Declarar que se guarda no es prometer que se puede preguntar.
- **Sale «bodega» de Ventas**: ya se pide en Inventario, y pedir dos veces el mismo hecho invita a que difieran.

**LA VARA DICE DE QUIÉN ES.** Al sacar el benchmark de la plantilla para reducir fricción apareció un riesgo que
estaba en seis lugares del producto: todos decían «tu benchmark», y con razón mientras el campo se pedía. Sin él,
esa frase le atribuye al usuario un objetivo que nunca fijó. Ahora la procedencia se resuelve junto al valor, y:

- un negocio que declara su referencia lee **«bajo tu benchmark (30,1%)»** — igual que siempre;
- uno que no la declara lee **«bajo la referencia general de ADI (30,1%)»**, y la preview lo dice con todas las
  letras: *no es tu meta, es la vara con la que ADI compara cuando no hay otra*.

El negocio de demostración declara la suya, así que en producción no cambia ni una palabra: el cambio solo
aparece cuando alguien sube un archivo sin benchmark propio.

Verificado antes de subir: **179 PASS · 0 FAIL · 0 tocaron la red**, con dos candados nuevos
(`_referencia_de_quien_gate`, 36 chequeos con carnada · y el bloque que prueba el amarillo sobre el archivo real
que el generador produce, no sobre una reconstrucción).

⚠️ **Los archivos llenados con la plantilla anterior ya no validan.** Se resuelve bajando la nueva desde la misma
pantalla. Es la segunda vez en dos versiones: la estructura de la plantilla quedó fijada acá.

⚠️ **Dos defectos propios en el camino, los dos de la misma familia**: «punto de venta» como clave opcional
rechazaba toda fila de un cliente sin sucursales —un vacío en una clave opcional es un valor legítimo—, y el
aviso de columna vacía salía por fila, enterrando con diez líneas idénticas a los avisos que sí importan.

## 1.5 — tag `v1.5` (estuvo en producción el 2026-08-26)

**La plantilla deja de pedir cuentas hechas a mano.** La hoja Inventario pasa de ocho columnas a tres: **SKU**
y **Stock (unidades)** obligatorias, **Bodega** opcional. El cliente entrega stock físico; capital, días de
inventario y rotación los calcula ADI.

- **Lo que salió, y por qué cada una.** *Fecha de corte*: era idéntica en todas las filas — eso es metadato, no
  columna; la fecha relevante es la de carga y la pone ADI. *Stock valorizado*: es stock × costo unitario, y el
  costo unitario sale de la hoja Ventas. *Fecha de la última venta*: ya está en Ventas, y se deriva con
  precisión mensual, que es lo que esa hoja informa. *Días* y *Rotación*: son cuentas nuestras.
- **Lo que ADI no puede, lo declara.** Un SKU con stock pero sin venta en el período no se valoriza: capital,
  días y rotación quedan sin valor, la fila lo dice, y el SKU aparece nombrado en los avisos. Un cero ahí diría
  «no tiene capital inmovilizado», que es lo contrario de «no lo sé».
- **La bodega dejó de ser obligatoria.** Si viene, todo se calcula por SKU y bodega. Si no viene, por SKU total
  — y eso se declara en pantalla en vez de disimularse. Un negocio de una sola bodega estaba llenando una
  columna que no le decía nada.
- **La pantalla declara de quién es cada cifra.** El capital que se muestra ahora dice que lo calculó ADI y con
  qué cuenta; sin eso, un número derivado se lee como si viniera del sistema del usuario.

⚠️ **Los archivos llenados con la plantilla anterior ya no validan**: su hoja Inventario empieza con «Fecha de
corte» y ahora se espera «SKU». Se resuelve bajando la plantilla nueva desde la misma pantalla. Y las cifras de
capital cambian un poco respecto de las tipeadas a mano — la diferencia es que ahora la cuenta cierra.

Verificado antes de subir: **178 PASS · 0 FAIL · 0 tocaron la red**, con la corrida en vivo hecha con el gateway
sin proveedor declarado (el gasto queda impedido por estructura, no por promesa).

⚠️ **Un candado dependía de un archivo suelto en una carpeta de Descargas** y se puso rojo por un disco, no por
código: al cambiar el contrato, aquel .xlsx dejó de validar. Ahora usa el ejemplo que genera el propio contrato
y corre igual en cualquier máquina. Un gate que depende de un archivo que no está en el repo mide ese archivo.

## 1.4 — tag `v1.4` (estuvo en producción el 2026-08-26)

**La versión en que ADI deja de hablar solo del negocio de demostración.** El usuario sube su planilla, ve qué
leyó ADI, decide, y desde ahí las respuestas son sobre sus datos. Es la primera vez que el producto acepta
información de afuera.

- **La pantalla de carga.** Cuarta puerta permanente en la barra: **Tus datos**. Se descarga la plantilla, se
  sube el archivo, ADI muestra qué entendió —empresa, período, venta, capital, cuántos clientes y SKU— y recién
  ahí el usuario activa. Reemplaza al demo, con vuelta atrás en un clic. Es permanente y no un paso de arranque
  a propósito: probar con datos propios es subir, mirar, corregir y volver a subir.
- **ADI lee el archivo como asesor, no como lector.** Antes de cualquier análisis, si algo no cuadra lo dice y
  **pregunta**: *«Acabo de leer tu archivo. Antes de analizarlo, hay algo que me llama la atención: un período
  trae 3 filas de venta y el otro 12…»*. No bloquea — los errores del cliente son del cliente; la
  interpretación es nuestra. Si el usuario decide seguir igual, se sigue.
- **Y la observación no se olvida.** Cuando una respuesta usa una métrica que esa observación toca, ADI lo
  nombra una vez y sigue normal. Solo la intersección: un archivo con tres observaciones y una lectura de
  inventario nombra la de inventario y nada más. **No suena en saludos, menús, declinaciones ni preguntas de
  vuelta** — un aviso que suena siempre es un aviso que se ignora.
- **Dos parámetros nuevos en la plantilla**, opcionales: el techo de días de inventario y la rotación mínima. Un
  archivo llenado antes sigue siendo válido.

**El archivo se procesa en el servidor**, y no es una preferencia de arquitectura: leer un `.xlsx` exige
descomprimir (`node:zlib`), y ni el navegador ni el runtime edge lo tienen. Endpoint nuevo `/api/adi-ingesta` en
runtime node. Todo el camino es determinístico: **la carga no gasta ni una llamada al modelo**.

Verificado antes de subir: **177 PASS · 0 FAIL · 0 tocaron la red**, con dos candados nuevos
(`_pantalla_carga_gate` · `_sello_en_respuesta_gate`). La corrida en vivo se hizo con el gateway **sin proveedor
declarado**: el gasto quedó impedido por estructura, no por promesa.

⚠️ **Cuatro defectos propios cazados al cablear, y los cuatro eran silencios, no errores.** Dos alarmas **nacían
muertas**: la de «período cargado a medias» no podía dispararse nunca porque le faltaba un conteo que el motor no
emitía, y la principal —«todo el inventario sobre 90 días», el ejemplo del propio owner— era inalcanzable porque
la plantilla no dejaba declarar ese techo. Y dos falsos positivos en el sello: *nombrar* una métrica no es
*usarla* (el menú de bienvenida disparaba el aviso), y una tabla es **una** unidad de lectura, no varias frases
sueltas —el rótulo vive en la cabecera y la cifra en otra fila—, así que la forma más común de usar una métrica
era justo la que no se sellaba. Ninguno de los cuatro habría dado error: habrían dado silencio.

**Lo que queda declarado y no medido:** que el modelo redacte la mención del sello con sus propias palabras. El
cerrojo determinístico garantiza que aparezca igual; probar la prosa exigía una corrida paga y el owner decidió
que la garantía determinística alcanza.

## 1.3 — tag `v1.3` (estuvo en producción del 2026-08-22 al 2026-08-26)

La versión que endurece **la base del asesor** antes de conectarle archivos reales. Cuatro cosas, y tres de ellas
cierran huecos donde una garantía existía en el papel pero no en el producto.

- **El voseo, cortado de raíz.** El lavador corregía la SALIDA, pero los textos que le enseñan a ADI a hablar
  estaban escritos en voseo — incluidas las MULTAS del notario, que se le mandan justo antes de pedirle que
  reescriba. La red corría detrás de una fuente que nunca se apagó: 322 formas en los cinco archivos que guían al
  modelo. Se respetaron los ejemplos de lo que escribe el USUARIO («dale, seguí»): ese vocabulario de entrada es
  contrato suyo y ADI tiene que seguir reconociéndolo.
- **Observabilidad que sirve.** El producto ya sabe POR QUÉ una respuesta vino vacía: el motivo de corte del
  proveedor viaja hasta el registro del turno. Antes eso vivía solo en la consola del examen, y entender una
  respuesta vacía costaba una corrida paga. Y el registro se puede LEER: antes se escribía y no lo abría nadie.
- **Causalidad sin respaldo, con cerrojo.** La regla 2 del proyecto («no hay causalidad sin respaldo») descansaba
  solo en el prompt: cuatro causas inventadas —«porque el proveedor subió los costos»— pasaban el muro enteras,
  porque los chequeos que las cazan viven de la boleta y el camino natural no la trae. Ahora hay un chequeo que no
  la necesita. **No veta declinar, ni hipotetizar marcado, ni localizar, ni explicar con el dato**: ADI ya hacía
  bien esas cuatro cosas y vetarlas habría sido peor que el defecto.
- **La Ficha se alcanza escribiendo.** «explicame falabela» —con el tipeo— ofrece «Ver la ficha de Falabella».
  Antes el camino natural devolvía `sentrixAction: null` fijo: llegar a la Ficha exigía venir de un botón de la
  Mesa. Sentrix es apoyo, no requisito. El botón OFRECE; no abre solo — el usuario decide.

Verificado antes de subir: **170 PASS · 0 FAIL · 0 tocaron la red**, y cada pieza con su candado nuevo
(`_prompts_sin_voseo_gate` · `_causalidad_gate` · `_ficha_texto_libre_gate` · 11 controles más de telemetría).

⚠️ **Cuatro veces en esta versión un chequeo mío daba VERDE estando ciego** — un borde de palabra perdido, un
inventario que no conocía la cola larga, un detector sin su punto ciego, una verificación demasiado floja que
habría dejado pasar un botón que abría la Mesa en vez de la Ficha. Los cuatro candados nuevos se prueban a sí
mismos contra una copia del defecto real antes de afirmar que hay cero.

**No incluye carga de archivos ni Supabase vía 2** — eso sigue reservado para la 2.0.

---


## 1.2 — tag `v1.2` (estuvo en producción el 2026-08-21)

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
