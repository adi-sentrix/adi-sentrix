# Versiones de ADI

**La regla (owner 2026-08-16):** cada vez que el owner dice **«deployalo»**, el deploy sale con las cuatro cosas
en el mismo momento — **número de versión · tag en el repo · `/api/version` actualizado · nota corta**. Puestas
después, se abandonan: ya pasó una vez (`v1.0-demo-privada` quedó 533 commits atrás de su propio producto).

**Formato.** Cambios normales suben el segundo número (1.1 · 1.2 · 1.3). Un cambio grande sube el primero (2.0).
**Supabase + carga de archivos ya está reservado como 2.0.**

**Dónde vive cada cosa.** El número: `src/config/version.js` (una sola fuente). La nota: este archivo. El tag:
el repo. Que los tres digan lo mismo lo verifica `_version_gate.mjs`.

---

## 2.12 — producción · tag `v2.12`

**Flujo Comercial: columnas parejas, cada columna explica su cuenta, y el gráfico responde al cursor.** Tres
cosas que pidió el owner mirando la pantalla.

**Uno · las columnas se veían desparejas, y la causa era medible.** Con el ancho automático, el navegador reparte
el espacio sobrante **en proporción al contenido de cada columna** — y en esta tabla el contenido más ancho de
varias no es la cifra, es el **título**. Medido en pantalla: «Días vencidos» ocupaba 89 px de título contra 32 px
de dato, así que se llevaba la columna más ancha de la tabla para mostrar «269d», mientras «Saldo» —que sí lleva
dinero— se quedaba con 38. El ritmo lo estaba fijando el largo de las palabras. Ahora los anchos se **declaran**:
las siete columnas de cifras miden exactamente lo mismo a cualquier ancho de pantalla, y el nombre del cliente se
queda con lo que necesita «Mercado Libre».

**Dos · cada columna explica qué mide y cómo se calcula.** Una «i» en el encabezado — la misma que ya usan las
tablas de las otras caras, no un invento nuevo. Están las siete, no solo las cuatro que se pidieron. Las
definiciones dicen **la cuenta**, no una paráfrasis: quien las lee puede rehacer el número a mano. «Recuperado»
dice *abonado ÷ venta*; «Saldo», *venta menos abonado*; «Plazo» aclara que recién al día siguiente de cumplido el
plazo empieza a contar como vencida. **Y el pie de la tabla dejó de repetirlas**: el mismo dato en dos lugares
envejece mal — se corrige uno y el otro queda mintiendo.

**Tres · el gráfico tiene tooltip.** Apuntando cualquier mes aparece el mes con su año, cuánto entró y qué parte
de la caja del período fue. La zona sensible es una **banda por mes**, del alto completo: apuntarle a un punto de
4 px es una pelea. Los rótulos fijos **se apagan** mientras se apunta, o el globo caería justo encima de su propio
número. Y el globo **se da vuelta solo** en los bordes en vez de salirse de la tarjeta.

**Un defecto que apareció midiendo y no se veía:** el globo de ayuda de la última columna se apoyaba 6 px más
allá del borde de la tabla y, aunque está invisible, ocupa lugar — hacía aparecer una **barra de scroll
horizontal bajo una tabla que cabía entera**. Corregido.

**Verificado en pantalla, columna por columna.** Los siete anchos idénticos (177 px a 1600 px de ventana), ningún
encabezado cortado, ningún globo fuera de la tarjeta, el tooltip probado en seis meses distintos —incluidos el
primero y el último, donde tiene que darse vuelta— y nada saliéndose del lienzo del gráfico.

**El registro lo corrigió el gate, no yo:** una de las definiciones decía «plata», que es de las palabras que el
producto no usa. `_registro_gate` la encontró entre 1.295 textos.

**Candados nuevos:** `_flujo_comercial_gate` pasa de 47 a 70 comprobaciones. Las que importan atan **la frase al
cálculo**: si alguien cambia la fórmula en `mesaFlujo.js` y no toca la definición, el tooltip empieza a mentir y
en pantalla no se nota, porque el número se sigue viendo bien. Se probó que saben ponerse rojas: cinco sabotajes
deliberados, ocho fallos.

**No se tocó la plantilla ni la hoja Abonos.**

---

## 2.11 — producción · tag `v2.11`

**El gráfico de caja de Flujo Comercial ahora cabe en su tarjeta.** El owner lo dijo mirando la pantalla: «eso
no se ve bien encajado». Tenía razón, y no era una cosa: eran tres, y las tres se ven en la misma imagen.

**Uno · no había aire arriba.** La escala terminaba justo en el mes más alto, así que ese punto quedaba pegado
al borde de arriba y el número que lo acompaña —que se dibuja *encima* del punto— se salía del dibujo. Un SVG no
avisa cuando eso pasa: recorta y sigue. Ahora la escala deja un 18% de holgura sobre el pico, que es lo que
necesita su rótulo para tener dónde ponerse.

**Dos · el último mes caía contra el borde derecho**, con su marcador partido al medio. Y justamente el último
mes es el que se mira: es la caja que acaba de entrar. El margen pasó de 16 a 44 px.

**Tres · el mismo número estaba escrito dos veces.** El eje rotulaba su tope con el valor del mes más alto, y ese
mes llevaba además su propio rótulo, a diez píxeles de distancia. Leído rápido parecen dos cifras distintas. El
eje se queda solo con el **$0** —que es la referencia que de verdad hace falta— y los números van sobre los
puntos que significan algo: **el último mes siempre**, y el pico solo si no se pisan.

**Verificado en pantalla, no en el código.** Se midió cada texto, cada punto y la línea contra el borde del
dibujo: **nada se sale**. Es la lección que ya nos costó una vez — «corre» y «se ve» no son lo mismo.

**El encuadre queda con candado.** `_flujo_comercial_gate` gana cuatro comprobaciones y se probó que saben
ponerse rojas: al deshacer el aire y el margen, el gate cayó a 45/2. Un gate no ve una pantalla, pero sí impide
que esto se deshaga solo la próxima vez que alguien toque el dibujo.

**No se tocó nada más.** Ni la plantilla descargable, ni la hoja Abonos, ni el resto de Sentrix. Ese frente
—folio, días de crédito y abonos como dato real— sigue cerrado hasta que el owner lo abra.

---

## 2.10 — producción · tag `v2.10`

**La barra lateral deja de chocar con lo que hay debajo.** Es el pendiente que quedó anotado en la 2.9 y que
estuvo abierto un mes: el owner lo marcó el 2026-08-20 —«cuando pasas el cursor, las cosas que muestra se
superponen a la Mesa central, es poco fino»— y ahora está cerrado.

**Qué pasaba, medido:** la barra **no tiene fondo**. Al pasar el cursor se abre de 44 a 236 px por encima del
contenido, y como lo único opaco eran las pastillas, entre una y otra se seguía viendo el texto de abajo y cada
pastilla caía sobre una palabra distinta. No se leía como una capa: se leía como un choque.

**El arreglo es un velo**, y la elección tiene razón. En agosto se habían probado tres caminos y ninguno se
eligió: el velo, empujar la Mesa, o mostrar solo el nombre de la barrita apuntada. **Empujar la Mesa se
descarta**: obliga a que todo el dato salte de lugar cada vez que el cursor roza el borde izquierdo, y en un
tablero eso es peor que la superposición — se pierde el punto que estabas mirando. El velo **no mueve nada**:
hace que la superposición se lea como lo que es, una capa apoyada encima que deja ver que abajo sigue habiendo
algo, atenuado. El owner pidió que no se superpusiera **feo**, no que no se superpusiera.

**Tres detalles que hacen la diferencia entre un velo y una mancha:**

- **Desenfoque de 4 px** detrás: lo de abajo se lee como profundidad, no como suciedad.
- **Se disuelve hacia la derecha** con una máscara: sin ese degradado, el borde del velo es una línea vertical
  a mitad de pantalla — cambiar un choque por una línea no era arreglarlo.
- **El color sale de la paleta**, no del CSS. Es la misma superficie viniendo hacia adelante: si el fondo
  cambia, el velo cambia con él. Escrito a mano, el día que se toque el fondo el velo queda flotando.

Va **detrás** (`z-index:-1`) y **no recibe clicks**: es fondo, no superficie interactiva.

El gate lo sella en cinco líneas —que el velo exista, con desenfoque, con máscara, detrás y sin clicks, y que su
color venga del token—, para que el defecto no pueda volver sin que nadie se entere.

Verificado con la barra forzada abierta: el velo mide 236 px por el alto completo, cubre las cuatro pastillas,
está en opacidad 0 en reposo y su regla de apertura existe. Sin errores en consola.
Gates **189 PASS · 0 FAIL · 0 TOCARON LA RED**, árbol limpio.

**Con esto queda cerrado el frente de UX.** El siguiente es Flujo Comercial con dato real: folio, días de
crédito y hoja de Abonos.

---

## 2.9 — producción · tag `v2.9`

**La experiencia elegida deja de ser una variante y pasa a ser la app.** El owner cerró la exploración:
«la UX ya está definida y aprobada. Deja de tratar los interruptores como exploración. Consolidar la
experiencia elegida como comportamiento normal de la app».

**Se retiraron tres interruptores y todo lo que colgaba de ellos:**

- **`?papel`** — con él vivían TRES superficies: la pizarra, la hoja blanca y el **diseño viejo completo**, con
  su burbuja, su titular largo y su pulso. Queda una. Se fue `TEMA_PAPEL`, se fueron `esPapel()` y
  `esSuperficieADI()`, y las cuatro decisiones que colgaban de ellos —respuesta sin burbuja, titular corto, hero
  sin bajada, hexágonos al costado— quedaron escritas derecho, cada una con la orden que la fijó.
- **`?barra`** — las tres variantes de la barra lateral (velo · empuja · apuntada). Nunca se eligió ninguna.
- **`?historial`** — la columna de conversaciones, con su componente. Se veía, pero no guardaba nada.

**Y también el pulso de inicio**, que desde el 26 de agosto solo se pintaba en el diseño viejo: al retirarlo no
quedaba una sola superficie que lo dibujara. Se fue con su módulo.

⚠️ **EL TABLERO NO SE FUE**, y la distinción es la que sostiene el diseño. Se retiró como **superficie de
conversación**; sigue entero como **`T`**, la paleta de todo lo que MIDE —Sentrix, los gráficos, los semáforos,
los sellos—. «A la izquierda se conversa, a la derecha se mide»: eso nunca fue una variante, es la mitad del
producto. El gate lo sella token por token, congelado.

**Los sellos PROBADO / INDICADO / ABIERTO salieron del Perfil Ejecutivo.** El owner los mandó sacar el
2026-08-20 —«el usuario no entenderá»— y se aplicó entonces a Comercial, que era la cara que estaba mirando;
ésta se quedó con los suyos un mes. **Se fue la etiqueta, no la frase**: la oración que venía detrás dice algo
—sobre todo la tercera, que declara lo que el dato NO permite afirmar— y queda entera. La graduación sigue viva
en el dato, que es de donde ADI la toma.

**Flujo Comercial pasa a ser pestaña estable.** Nació detrás de `?flujo=1` y ahí vivió lo que tenía que vivir:
hasta que el owner la miró en producción, la corrigió y la aprobó. El interruptor se fue. **`?flujo=demo`
sobrevive**, y no como resto: es un modo de demostración con función real — sin él no habría forma de mostrarle
la lectura a una empresa que aún no carga abonos sin inventarle cifras sobre su propio negocio.

**Un gate cambió de trabajo, no desapareció.** `_papel_y_tablero_gate` existía para comprobar que las variantes
NO se vieran; con la decisión cerrada, eso dejó de tener objeto. Lo reemplaza `_superficie_unica_gate`, que
comprueba lo contrario: que hay UNA superficie, que no queda puerta trasera —pedirle «papel» o «tablero» a
`aplicarTema` devuelve la misma—, que las decisiones del owner ya no cuelgan de ninguna condición, y que no
sobrevive ningún resto. **Su parte más valiosa viaja intacta: el sello del tablero, con su carnada.**

⚠️ **UN DEFECTO QUEDA ABIERTO Y ESTÁ ESCRITO EN EL CÓDIGO**, no en la memoria de nadie: las tres variantes de la
barra nacieron de una queja —«cuando pasas el cursor, las cosas que muestra se superponen a la Mesa central, es
poco fino»— que **sigue sin resolverse**. Retirarlas no lo arregla: lo deja pendiente y a la vista, que es mejor
que tres intentos dormidos fingiendo que está en marcha.

**No se tocó la plantilla ni los Abonos**, según lo pedido: ese frente se abre después, como dato.

Verificado en pantalla: sin parámetros, la pizarra con sus cinco pestañas y sin la barrita de conversaciones;
el Perfil Ejecutivo sin sellos; `?papel=1&barra=velo&historial=1` no hace absolutamente nada; y `?flujo=demo`
sigue abriendo el negocio de demostración con su banda. Build de producción correcto (1,14 MB + 366 KB).
Gates **189 PASS · 0 FAIL · 0 TOCARON LA RED**, árbol limpio.

---

## 2.8 — producción · tag `v2.8`

**La columna se llama «Días vencidos».** Se llamaba «Días» y obligaba a bajar al pie para saber qué medía. El
rótulo ahora lo dice solo.

**Y queda confirmado de dónde arranca el reloj**, porque el owner preguntó y vale dejarlo escrito: el plazo
corre desde **la fecha de la venta que el usuario escribe en la planilla** —la única fecha que el producto
tiene—, y una factura recién está vencida **cumplido el plazo**. Con 60 días de crédito, el día 60 todavía no
está vencida y la columna marca «—»; el 61 marca «1d». Cero días vencidos significa que venció justo hoy, no
que está atrasada.

Verificado sobre la factura real que produce el número más grande del demo: **F-LID-001, emitida el 6 oct 2025,
vencía el 5 dic 2025, y al corte del 31 ago 2026 van 269 días.** Desde la emisión serían 329 — no es lo que se
muestra.

**Se comprobó que el rótulo más largo no rompe la tabla.** Sospecha razonable: «Días vencidos» suma 58 px. A
ancho real (1440) el contenedor mide 641 y la tabla 641: **entra sin scroll**. El desborde que apareció en la
primera medición era el split de la Mesa quedándose desactualizado tras un cambio de tamaño programático —le
pasa a todas las caras por igual y no lo introduce esta versión.

Gates **189 PASS · 0 FAIL · 0 TOCARON LA RED**. La plantilla sigue sin tocarse.

---

## 2.7 — producción · tag `v2.7`

**La antigüedad del vencido pasa a ser una columna.** El owner lo vio mirando la tabla: «creo que le falta una
columna que diga los días vencidos». Tenía razón, y el defecto era de lectura, no de dato: el número existía,
pero iba **pegado al nombre del cliente** —«Lider 269 días»— y ahí se leía como si fuera parte del nombre en vez
de la cifra que es. Ahora tiene su columna, **Días**, al lado del monto vencido.

Puestos uno junto al otro, los dos números dicen algo que por separado no dicen: **si esa plata es de la semana
pasada o del año pasado.** Falabella debe $2.5M vencidos hace **8 días** —paga tarde pero corto—; Lider debe
$4.6M hace **269**. Son dos conversaciones distintas con el cliente, y ahora se distinguen de un vistazo.

**Y el pie explica qué mide**, porque no se explica solo: «Días» es hace cuánto venció **la factura más vieja
que sigue sin pagarse** — no un promedio, no la suma. La más antigua que sigue abierta.

El gate lo sella en tres partes: que la columna exista, que la antigüedad **ya no cuelgue del nombre**, y que el
pie diga qué mide. `_flujo_comercial_gate` · **49 comprobaciones**.

Gates **189 PASS · 0 FAIL · 0 TOCARON LA RED**. La plantilla sigue sin tocarse.

---

## 2.6 — producción · tag `v2.6`

**Flujo Comercial se puede mirar con cifras, sin tocar el dato de nadie.** El owner abrió la cara en producción
con `?flujo=1` y vio —correctamente— un recuadro vacío: su empresa todavía no carga abonos, y la cara declara
la ausencia en vez de inventar. Pero así no se puede decidir el diseño.

**`?flujo=demo`** abre la app sobre el **negocio de demostración**, que sí tiene el dato de cobro declarado, con
una **banda ámbar arriba de todo** que dice las dos cosas: qué estás viendo y qué no. Cambia la empresa entera,
no solo esa cara — no se puede mezclar el cobro de un negocio con la venta de otro.

⚠️ **EL EJEMPLO SE PIDE AL SERVIDOR, NO SE ESCRIBE EN EL CÓDIGO**, y esto no era opcional. Escribir un dataset de
ejemplo en un módulo del navegador es exactamente la fuga que `_bundle_sin_datos_gate` existe para cerrar: ese
candado exige que ningún módulo de `src/data/tenants/` sea alcanzable desde `main.jsx`, y además **cuenta** los
literales del demo que quedan en el bundle y solo tolera que el número baje. El servidor ya sabía entregar el
demo por su propia puerta (`op: "demo"`), así que el dato llega por donde corresponde.

**El texto del estado vacío dejó de pedir lo que no existe.** Decía que hacía falta «el folio en la hoja de
Ventas, los días de crédito y una hoja de Abonos» — ninguna de las tres está en la plantilla, porque se decidió
no tocarla. Mandar a alguien a llenar columnas que no existen es peor que no decir nada. Ahora declara el estado
—«habilitarlo es el siguiente paso»— y ofrece el camino que sí existe hoy.

⚠️ **LA PLANTILLA SIGUE SIN TOCARSE.** El gate lo comprueba en las dos direcciones: que la hoja de Abonos NO
esté, y que las dos columnas nuevas NO estén. Si alguien las agrega antes de tiempo, se pone rojo.

**Dos cosas que cazaron los gates y que valen más que el cambio:**

- **`_registro_gate`**: el texto nuevo estaba escrito en **voseo** («podés», «agregá») y el producto habla de
  «tú». Se me coló del registro con el que converso, no del que el producto usa. 1.295 textos limpios.
- **Dos afirmaciones mías del gate nuevo estaban mal escritas**, no el código: una comparaba la banda contra la
  *definición* del encabezado en vez de contra su *uso*, y la otra se ponía roja por su propio comentario —el
  que nombra las tres columnas justamente para decir que ya no se piden—. Un chequeo que se dispara con su
  propia explicación no sirve.

`_flujo_comercial_gate` · **46 comprobaciones**. Gates **189 PASS · 0 FAIL · 0 TOCARON LA RED** — la suite
entera verde, incluido el `_esquema_datos_gate` que se arregló antes.

---

## 2.5 — producción · tag `v2.5`

**Flujo Comercial: la cara del cobro, apagada.** Sube el código, no la pantalla. Sin `?flujo=1` la app es la
de siempre: la pestaña no se dibuja, la rama que la pinta lo vuelve a exigir y el módulo ni siquiera se llama.

**Qué contesta**, con las palabras del owner: «mostrar la venta del cliente, abonos y saldo pendiente, de esa
forma se puede controlar si es que a algún cliente se le da crédito». De todo lo que vendiste: cuánto entró en
caja, cuánto falta, y quién te está financiando con tu propia plata.

**Con el demo, la cara abre así:** $99.9M vendidos · $58.7M cobrados · $41.2M pendientes · **$12.6M vencidos**.
Y arriba de la tabla queda **Lider: te debe $9.8M, te pagó el 45%, y $4.6M están vencidos hace 269 días.**

**Sin recuadro de recomendación** (owner: «las recomendaciones no van, eso ya lo tenemos con ADI, ese es su
labor»). La tabla llega ordenada por saldo vencido: **el orden ES la prioridad**, y hasta ahí llega el tablero.

⚠️ **LA PLANTILLA NO SE TOCÓ, y se comprobó por bytes.** El owner lo pidió explícito: «que la plantilla
descargable siga igual por ahora». El folio, los días de crédito y la hoja Abonos están diseñados y discutidos,
pero no entran hasta que la cara se apruebe — la plantilla es lo único de todo esto que el cliente DESCARGA.
Verificado generando el .xlsx en esta rama y en producción: **sha256 `c960d07cde3b0e02` en las dos.**
Y la sección 5 del gate nuevo pasó de comprobar que las columnas ESTÁN a comprobar que **NO** están: si alguien
las agrega antes de tiempo, se pone rojo.

**El demo se alimenta de su propio dato declarado** —fecha de corte y tres números por cliente— sin pasar por
la plantilla. Las facturas se DERIVAN de la venta y no se escriben a mano: así su suma ES la venta, exacta, y
no aparecen dos cifras para lo mismo. En un cliente real nada de esto se deriva.

**Tres defectos aparecieron construyendo, y los tres quedaron anotados en el código:**

1. **Las facturas cubrían cinco meses de un año** — el gráfico tenía siete meses en cero debajo de un título
   que dice «venta del período».
2. **El cliente moroso salía «por vencer».** El cobro se aplicaba siempre de la factura más vieja a la más
   nueva, así que al que debe le quedaban sin pagar las **nuevas** y en pantalla se veía sano. La deuda de
   quien no te devuelve el crédito es **vieja**. El gate ahora exige 90 días o más.
3. **Las columnas nuevas iban en el MEDIO de la hoja Ventas** — lo cazó `_plantilla_congelada_gate`: correr
   una columna rompe los archivos que el cliente ya llenó. (Ese cambio quedó fuera de esta versión igual.)

**`_flujo_comercial_gate` · 38 comprobaciones**, entre ellas la que más importa: el módulo **no puede consultar
el reloj**. Si alguien reemplaza la fecha de corte declarada por `new Date()`, todo lo demás sigue en verde
—las sumas cierran igual— pero «vencido hace 269 días» cambiaría cada mañana.

Gates **188 PASS · 0 FAIL** de los propios. Sigue rojo `_esquema_datos_gate`, del frente de datos, desde la 2.0.

---

## 2.4 — producción · tag `v2.4`

**Ya se le puede entregar su código a un cliente.** Hasta esta versión no se podía: todo el que entrara,
entraba al negocio de demostración.

**El defecto, y por qué no se veía.** La vía 1 hizo que la empresa viajara **firmada adentro del código de
acceso**. La vía 3 le dio a cada empresa su pack en Supabase. Las dos funcionaban y estaban probadas — y las
dos eran **inalcanzables desde el producto**, porque el servidor emitía con `makeAccessCode(name, hours,
secret)`: sin empresa. La capacidad multiempresa estaba entera y no había forma de usarla.

No rompía nada. Emitías un código y funcionaba: abría el demo. Por eso sobrevivió a la vía 1, a la vía 3 y a
dos despliegues.

⚠️ **Y EL PRODUCTO INVITABA AL ERROR.** El único campo del formulario se llamaba «Para quién (nombre o
empresa)». El owner emitió dos códigos «para prueba» escribiendo el nombre de la compañía ahí —que es lo que
el rótulo pedía— y los dos abrieron el demo. El error era del rótulo, no suyo. Ahora el nombre es el nombre y
la empresa tiene su propio campo, con su explicación: es el identificador, no el nombre comercial, y viaja
firmado.

**Qué cambia**

- `#admin` tiene campo **Empresa**, con el aviso de que en blanco significa demo.
- El servidor pasa esa empresa a la firma, después de limpiarla: un identificador inválido cae a demo en vez
  de producir un código que nadie puede usar.
- **Compatibilidad intacta**: un código sin empresa queda **byte-idéntico** al histórico —el campo no se
  escribe cuando es demo— así que todo lo ya repartido sigue valiendo y sigue abriendo el demo.

**Candado nuevo · `_emision_por_empresa_gate` (24).** Su sección 4 es la que habría cazado esto: todo lo demás
ya funcionaba antes —`makeAccessCode` SIEMPRE supo firmar la empresa—, lo que faltaba era que alguien se la
pasara. Un candado que solo probara la primitiva habría estado verde durante todo el tiempo que el producto
fue incapaz de emitir un código real. La carnada reproduce la llamada vieja y comprueba que el código abre
demo aunque el nombre diga otra cosa.

Tres de sus chequeos nacieron rojos por errores míos y quedan anotados: un nombre con acento que fallaba por
codificación del propio archivo, una expresión regular que no admitía un argumento con paréntesis, y una
carnada que golpeaba la línea del `import` en vez de la llamada.

**188 PASS · 0 FAIL · 0 TOCARON LA RED · 0 CON CREDENCIAL VIVA.**

---

## 2.3 — producción · tag `v2.3`

**ADI deja de suponer en qué moneda está tu dinero, y de qué período habla.** Los dos supuestos venían del
negocio de demostración —que está en pesos y trae un año completo— y eran falsos para la primera planilla real
que se cargó.

**Qué cambia para el cliente**

- Si su archivo no declara la moneda, **ADI se la pregunta una vez**, después de mostrarle lo que leyó y antes
  de activar nada. Ninguna opción viene marcada: preseleccionar una es suponerla, y la mayoría confirmaría sin
  leer. Sin responder no se puede confirmar.
- Esa respuesta queda **dentro del pack**, así que sobrevive a recargar y a cerrar sesión. Quien la declare en
  la hoja Empresa —campo nuevo, opcional— no verá la pregunta nunca.
- **Ya no dice «año cerrado» cuando el archivo trae dos meses.** Dice «el período cargado» o «el mes
  informado», según lo que el dato sostenga.
- **El presupuesto que nadie declaró dice que no está**, en vez de mostrarse como `$0`. Un cero afirmaba que el
  plan del cliente era no vender, y de paso lo dejaba «cumpliendo» cualquier venta.

⚠️ **LO QUE NO SE VEÍA: EL SUPUESTO VIVÍA EN EL MURO, NO EN LA PANTALLA.** Parecía un pedido de formato. Pero
`boleta.parseFigures` reconocía una cifra de dinero exigiendo un `$` literal: con un negocio en euros, «€4.1M»
**no se extraía, y lo que no se extrae no se verifica** — una cifra inventada en esa moneda pasaba entera. Lo
mismo en `guardC`, donde el chequeo del orden sellado se saltaba sin ponerse rojo. **Ninguna de las dos
fallaba: se volvían ciegas**, que es peor, porque el rechazo se ve y la ceguera no. Cambiar el formato sin
cerrar eso habría abierto un agujero en la garantía central del producto.

La garantía no se relajó, se extendió: el símbolo pasa a ser el declarado (o ninguno) y `$` se sigue
aceptando. Y hay una asimetría deliberada: en `guardC` el símbolo puede faltar —el nombre de la columna ya dijo
que la cifra es dinero—, pero al leer texto libre **no puede**, porque entonces todo número suelto sería un
monto: los años, los conteos, los códigos.

**Cambia el símbolo, nunca la escala.** El valor de la boleta es el que el texto repite verbatim: si se
formatearan distinto, el notario dejaría de reconciliarlos y empezaría a vetar cifras correctas.

**Cómo se verificó**

- **187 PASS · 0 FAIL · 0 TOCARON LA RED.** Candados nuevos: `_moneda_en_el_muro_gate` (24), con la carnada de
  una cifra inventada en euros, y `_marco_y_presupuesto_gate` (19), que no mira la pantalla sino lo que
  `manifestFor` entrega — de donde salen el contexto y la boleta.
- **En vivo contra Supabase**, con un archivo en euros y dos meses: la moneda quedó guardada en el pack,
  sobrevivió a la recarga, la Mesa mostró **48 montos en euros y cero con signo peso**, no apareció «año
  cerrado» y el presupuesto dijo que no estaba declarado.

⚠️ **Y EL CLICK VOLVIÓ A ENCONTRAR LO QUE LOS CANDADOS NO.** El primer barrido cubrió los 11 formateadores
locales y quedó por cerrado: faltaban **21 archivos, 144 sitios**. En pantalla eran tres montos con `$` entre
51 en euros — una proporción que no se nota mirando por encima, y que un cliente en euros habría leído como dos
monedas mezcladas. Ningún candado compara lo que se PINTA contra la moneda declarada.

🧹 **De paso**: la raíz del repo acumulaba **1242 bundles temporales, 2,2 GB**, que un candado leía enteros —
así que la suite se degradaba sola con el uso hasta morir sin memoria. Borrados y excluidos. Ese candado pasó
de morir a los 93 segundos a correr en **0,7**.

**Requiere** la migración `004` aplicada (ya lo está) y las tres variables de Supabase en Vercel.

---

## 2.2 — producción · tag `v2.2`

**El celeste vuelve a ser solo de lo que se toca, también en el Perfil Ejecutivo.** El owner lo pidió mirando
esa cara: «dejaríamos solo el botón de ADI lo explica, el resto blanco, así existe la diferenciación». Sus
cuatro rótulos —PERFIL EJECUTIVO · nombre, CIFRAS CLAVE, QUÉ EXPLICA LA BRECHA, COMPOSICIÓN DE LA COMPRA— iban
en celeste y competían con el único enlace de la tarjeta. Ahora van en blanco.

**Por qué esta cara se había quedado fuera**, que es lo que importa para que no se repita: la regla se fijó el
2026-08-20 y se selló SOBRE LA CARA COMERCIAL, que era la que el owner estaba mirando ese día. El Perfil
Ejecutivo nunca entró al sello. **Lo cazó el owner, no el gate** — así que ahora hay una afirmación que cubre
esta cara: ningún rótulo puede ir en celeste, y el enlace a ADI sigue siendo el que lo lleva.

**Y dos textos que decían «Ficha» y sobrevivieron al renombre de la 2.1.** El rótulo de cabecera decía todavía
«Ficha Ejecutiva · nombre». Dos motivos, encadenados:

- El barrido buscaba texto JSX **sin variables adentro**, y este las lleva (`{_dot}` y `{name}`), así que no
  entró en el reemplazo.
- El control posterior tampoco lo cazó: la pantalla pinta ese rótulo **en mayúsculas por CSS**, así que buscar
  «Ficha» en el texto visible daba cero. El barrido ahora va sin distinguir mayúsculas.

El segundo era la frase de la rama sin datos («…para armar la ficha ejecutiva de X»), en minúscula.

**El punto celeste de cada rótulo se queda.** Es la decoración que las otras caras también llevan y no se lee
como algo que se pueda tocar; lo que competía era el TEXTO.

Verificado en pantalla con una cuenta abierta: los cuatro rótulos en **blanco (245,245,245)**, el botón de ADI
en **celeste (47,184,218)**, y **cero apariciones de «ficha»** —en cualquier combinación de mayúsculas— en las
cuatro caras, texto y tooltips. Gates **184 PASS · 0 FAIL** de los propios.

⚠️ Sigue rojo `_esquema_datos_gate`, del frente de datos, desde la 2.0. No se tocó: ese archivo y los SQL que
lee son idénticos a los publicados por ese frente.

---

## 2.1 — producción · tag `v2.1`

> ⚠️ **Esta nota se escribió como 1.16 y se renumeró a 2.1 al publicarla.** Mientras el frente UX trabajaba, el
> frente de datos subió la **2.0** —Supabase, la persistencia del dato del cliente—, que era el número que el
> formato tenía reservado para el cambio grande. La 1.16 nunca existió en producción: su contenido es éste.
> Las 1.13 a 1.15 sí están, y viajaron dentro de la 2.0.

**«Ficha» pasa a «Perfil Ejecutivo» en todo lo que se lee, y Resultado pierde su última frase interpretativa.**
Las dos cosas las pidió el owner al cerrar la 1.15: la primera para que el nombre nuevo no conviviera con el
viejo, y la segunda por consistencia — «si estamos quitando esas frases interpretativas de entrada, que sea
consistente en Capital y Resultado».

**La línea de Resultado.** Fuera «ADI · De $99.9M de ingreso… quedan $18.3M de resultado comercial». Es la
gemela exacta de la que salió de Capital: cuenta en prosa lo que la cascada de abajo muestra línea por línea.
La cuenta sigue viva en `mesaResultado.js`; lo que se fue es que el tablero la narrara.

**El renombre: 42 textos en 8 archivos.** Botones («Abrir Perfil Ejecutivo», «Ver Perfil Ejecutivo»), tooltips,
rótulos, la guía de inicio, el enlace del chat y hasta las instrucciones que viajan al narrador — porque si a
ADI se le dice «Ficha», ADI va a decir «Ficha».

⚠️ **Y SOLO en lo que se lee.** El reemplazo se hizo dentro de literales de cadena y texto JSX, nunca en
comentarios ni en código: `MesaFichaCara`, `onFicha`, `fichaIntent` y —sobre todo— las direcciones internas
(`ficha/otro/vista`, `ficha/otro/ficha-cliente`, que van en minúscula y son llaves del manifiesto) siguen
intactas. Un reemplazo a lo bruto habría renombrado componentes y roto las direcciones que ADI usa para saber
qué pieza le estás señalando.

⚠️ **En español el artículo cambia de género**, y eso no lo resuelve un buscar-y-reemplazar: «la Ficha» → «el
Perfil Ejecutivo», «de la Ficha» → «del Perfil Ejecutivo», «a la Ficha» → «al Perfil Ejecutivo». Las reglas van
ordenadas de más específica a más general por esa razón.

**Se escaparon tres y se cazaron después**: dos textos que decían «ficha» en minúscula (el enlace del chat y una
frase del oráculo) y el rótulo de un botón cuyo texto JSX empezaba en la línea anterior, que el barrido no vio.
El inventario final da **cero** apariciones visibles.

**14 afirmaciones de gate actualizadas en 19 archivos** — ninguna borrada: siguen probando lo mismo (que cada
fila lleva al detalle de su cuenta, que el narrador nombra el destino, que la guía dice dónde vive el detalle),
con el nombre que corresponde.

**Comprobado que el nombre largo NO rompe la fila.** Sospecha razonable: «Abrir Perfil Ejecutivo» es 70 px más
largo que «Abrir Ficha», y a 768 px el bloque de decisiones ya desbordaba. Se midió en vivo cambiando el texto
del botón en el DOM y volviendo a medir: **849 px con el nombre nuevo y 849 px con el viejo — el renombre suma
0 px**. Ese scroll horizontal ya existía y es el que el owner aceptó («si la pantalla es más pequeña tendrá
scroll»). Cero botones desbordados, cero elementos fuera del panel.

Barrido en pantalla de las cuatro caras: **0 apariciones de «Ficha» en texto y en tooltips**.
Gates **181 PASS · 0 FAIL · 0 TOCARON LA RED · 0 CON CREDENCIAL VIVA**.

---

## 2.0 — producción · tag `v2.0`

**Los datos del cliente dejan de vivir en la memoria del navegador.** Es el número que estaba reservado para
esto desde la 1.2: hasta hoy el usuario podía subir su planilla, verla y activarla, pero **si recargaba, se
perdía**. Ahora queda guardada, versionada y vuelve sola.

**Qué trae**

- **Cuatro tablas y un depósito privado en Supabase** (`db/migraciones/`). Cuatro garantías viven en la BASE y
  no en una comprobación del servidor: una sola versión activa por empresa (índice único parcial) · **no existe
  permiso de borrado en ningún lado**, y esa ausencia es el append-only · borrar el rastro de un archivo no
  puede llevarse el pack que produjo · sin pase válido la base devuelve **cero filas**, nunca las de otra empresa.
- **Pase corto firmado con la empresa adentro** (`src/data/paseTenant.js`). La puerta con código HMAC sigue
  igual; el servidor la verifica y emite un pase de 5 minutos que RLS usa para filtrar. **La llave de servicio
  no se usa para leer**: con ella el muro sería decorativo. Se firma con las mismas primitivas Web Crypto que ya
  usaba la puerta, así que no entró ninguna dependencia.
- **Cliente PostgREST escrito a mano** (`src/data/supabaseRest.js`), sin SDK: el endpoint que lee el pack corre
  en **edge**, y meter algo de Node en ese camino ya costó tres builds rotos. Reconoce la llave de servicio y se
  niega a usarla.
- **La carga guarda** (`persistirCarga.server.js`): archivo con su huella, original al depósito, versión del
  pack con su sello. **Guardar no es activar** — la versión nace inactiva y adoptarla es del usuario.
- **Confirmar y adoptar son un solo acto**, dentro de la base (`003_activar_version.sql`): apagar la anterior y
  encender la nueva o no pasa ninguna. Partido en dos, un fallo dejaba a la empresa sin ninguna versión activa.
- **La empresa sin archivo se declara** (decisión del owner): «Todavía no hay datos cargados para esta empresa.
  Puedes subir una planilla o mirar el demo.» Sin dataset — nunca el ejemplo disfrazado de dato suyo.
- **El demo pasa a ser una empresa más**, sembrado en la base: un solo camino de código.
- **`getTenantId()` devuelve `null`** sin empresa cargada. El `"demo"` por defecto era una afirmación falsa con
  clientes reales; un identificador equivocado es peor que ninguno.

**Cómo se probó**

- **185 PASS · 0 FAIL · 0 TOCARON LA RED · 0 CON CREDENCIAL VIVA.** Cinco candados nuevos: `_esquema_datos_gate`
  (85) · `_pase_tenant_gate` (54) · `_persistir_carga_gate` (72) · `_empresa_sin_datos_gate` (15) ·
  `_edge_bundle_gate` extendido.
- **19 de 19 contra la base real** (`node scripts/verificar-supabase.mjs`), incluido lo único que un doble no
  puede simular: **el muro probado atacándolo** — un pase de otra empresa no lee, no escribe y no activa.
- **El circuito completo en el navegador**: subir → preview → confirmar → recargar → ADI sigue leyendo desde
  Supabase. Y la segunda carga probó el relevo: v2 activa, v1 inactiva, siempre una sola.

⚠️ **Lo que encontró el click en vivo y no vio ningún candado.** Con los 184 en verde y el servidor
respondiendo perfecto, el usuario veía **una pantalla negra**: un `return` temprano que cortaba antes de la
pantalla, y una bandera que nadie marcaba al confirmar. Ninguna prueba de servidor ve el árbol de React.
Quedó cubierto por `_empresa_sin_datos_gate`, que monta la pantalla de verdad.

⚠️ **Requiere tres variables en Vercel** —`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_JWT_SECRET`— y las
tres migraciones aplicadas. **Sin ellas no se rompe nada: la app se comporta exactamente como en la 1.15**, pero
tampoco guarda. La llave de servicio no va a Vercel: no hace falta.

---

## 1.15 — producción · tag `v1.15`

**Capital y Resultado quedan sin conclusiones, y la Ficha cambia de nombre.** Segunda pasada de la misma orden
del owner —«quitarle conclusiones a Sentrix, ADI lo hará»— ahora sobre las dos caras que faltaban.

**Cara CAPITAL** — fuera tres piezas:
- **El veredicto**: «Tu capital está donde no se vende, y escasea donde sí», con su soporte y su cierre
  recomendando qué proteger primero.
- **La línea «ADI · De tus $135K en inventario: …»**, que narraba en prosa los cuatro tramos que las cards de
  abajo ya dan en cifra. La misma información dos veces, una contada y otra mostrada.
- **El recuadro «Lo que este dato no permite afirmar»**. ⚠️ Los límites siguen declarados en `capability.js`,
  que es de donde ADI los toma: los dice cuando la pregunta los toca, que es cuando sirven. Impresos de entrada
  eran un descargo legal encima del dato.

Las cuatro cards de capital se quedan: son cifras.

**Cara RESULTADO** — fuera cuatro:
- **«02 · Por qué pasa»**, la tarjeta que nombraba la línea de gasto más pesada y la declaraba culpable.
- **«03 · Qué hacer primero»**, con «Revisar la línea logística» y el botón «Probar el ajuste» — la conclusión
  más fuerte de todas: no describe, aconseja.
- **«¿Y si…?»**, las dos líneas de supuesto sugerido. **No es criterio nuevo**: el owner ya las había sacado de
  Comercial y de Capital el 2026-08-09 («no aporta»). Resultado era la última cara que las conservaba; ahora
  las tres van igual.
- **El párrafo del pie** que explicaba la cara entera — un manual impreso debajo de una pantalla que se explica
  sola.

Queda la **cascada** y el **cuadro**, que es lo que se muestra. Y el ajuste sigue siendo posible por dos
caminos: el % de cada línea punteada se edita en la propia cascada, y la simulación se le pide a ADI.

**La pestaña «Ficha» pasa a llamarse «Perfil Ejecutivo».** Sólo el rótulo de la pestaña: dentro de la cara los
botones cortos («Abrir Ficha», «Ver Ficha») siguen diciendo Ficha — son 28 textos y alinearlos es una decisión
aparte, pendiente de que el owner la pida.

**Restos quitados**: los contextos `capital/01/veredicto` y `capital/01/mapa` del manifiesto, y la variable que
sólo alimentaba la línea narrada.

**Cinco afirmaciones de gate movidas, ninguna borrada**: la que apuntaba al veredicto del capital como destino
de `inventoryStatus` ahora apunta a los focos (misma cara, pieza viva); la que usaba `capital/01/mapa` para
probar que dos componentes no comparten key toma el KPI de capital; y la que hacía click en la pestaña «Ficha»
ahora la busca por su nombre nuevo.

⚠️ **Un desliz que costó una pasada y quedó anotado**: el primer corte buscaba el cierre de cada bloque sólo por
texto (`</div>`) y encontraba el primer div ANIDADO, cortando media pieza y dejando la cola huérfana. El bundle
no compiló y seis gates se pusieron rojos de una. El corte ahora exige que el cierre esté **a la misma
indentación** que la apertura.

Verificado en pantalla las tres caras, con la Mesa abierta y —sembrando un P&L de prueba— también la cara
Resultado con datos, que en el demo arranca vacía. Gates **181 PASS · 0 FAIL · 0 TOCARON LA RED**.

---

## 1.14 — producción · tag `v1.14`

**Sentrix deja de sacar conclusiones.** La orden del owner, textual: «no es hacer cosas nuevas, sino quitarle
conclusiones — no hay necesidad, si dejamos botones que expliquen lo que está en Sentrix y ADI lo hará. Es
duplicar cosas». Se quitaron dos piezas de la cara **Comercial**, y nada más:

- **La «Lectura ejecutiva»**, con el titular del veredicto («El volumen crece, pero el margen no acompaña»), su
  soporte («7 clientes explican el 81.4%…») y la línea que reconciliaba cartera y plano.
- **El botón flotante «Preguntar a ADI sobre esta vista»**, que era un segundo camino para lo que cada pieza ya
  ofrece: cada KPI, cada fila y cada tira se preguntan solas, y con el contexto de ESA pieza — que apunta mejor
  que «la vista entera».

**Los cuatro KPI se quedan.** Son cifras, no conclusiones. La cara ahora abre en «01 · QUÉ ESTÁ PASANDO» y va
directo a las cifras.

⚠️ **El veredicto NO se borró del motor.** `buildResumenComercial` lo sigue emitiendo entero —titular, soporte,
reconciliación— y su gate de datos lo sigue probando: es de donde ADI lo toma para responder. Lo que se fue es
su **impresión** en el tablero. Si mañana hiciera falta, se vuelve a pintar sin recalcular nada.

**Y el contexto de la vista tampoco se perdió**: `useVistaContext("comercial", …)` lo sigue publicando como
ambiente, que es el requisito de que ADI sepa qué pantalla estás mirando aunque escribas directo en el chat sin
tocar ningún botón. Lo que se fue es el botón.

**Se quitaron también los restos**, que es donde suele quedar la basura: los dos contextos del manifiesto que
describían piezas que ya no se pintan (la cobertura es biyectiva a propósito), y los **74 px de colchón** que el
scroll reservaba para que el botón flotante no se posara encima.

**22 afirmaciones del gate cambiaron de plano, ninguna se borró.** Las que exigían el veredicto en el DOM ahora
exigen **que no esté impreso Y que el módulo lo siga emitiendo** — borrarlas habría dejado al motor sin red. Las
que contaban «aparece una sola vez» ahora exigen **cero**. La del botón está invertida. La del colchón exige que
el padding vuelva a ser parejo. El gate de la cara comercial pasó de **428 a 430** comprobaciones.

Verificado en pantalla con la Mesa abierta: la cara arranca en «01 · QUÉ ESTÁ PASANDO» y sigue con los cuatro
KPI; ni el titular, ni la lectura ejecutiva, ni el 80/20 en prosa, ni la reconciliación, ni el botón.
Gates **181 PASS · 0 FAIL · 0 TOCARON LA RED · 0 CON CREDENCIAL VIVA**.

---

## 1.13 — producción · tag `v1.13`

**ADI pasa a pizarra.** El owner lo dijo mirando la pantalla partida: «el contraste blanco y negro es un poco
pesado para la vista». Tenía la medida a favor — la hoja en #fafafa contra el tablero en #0a0a0a es un salto de
**19,2 a 1**, el rango entero en un pixel, y ese pixel cae justo en el medio, por donde el ojo cruza cien veces
mientras lee una respuesta y mira el dato. **Ahora ese salto es de 1,10 a 1.**

Se le llevaron dos propuestas y eligió **B · pizarra**, la de la vuelta fría, no la neutra: gris del lado del
celeste, casi a la misma profundidad que Sentrix, con los dos lados separados por **un filete de luz en la
junta** en vez de por un salto de color. La pantalla se lee como un instrumento con dos caras, no como dos
pantallas pegadas.

**Su condición fue «solo cambiar ese lado de ADI, mantener todo el resto, incluyendo los hexágonos».** Eso es
lo que gobierna esta versión:

- **Sentrix no se tocó.** Pinta su propio negro y sigue en él — verificado en pantalla: 720 px de panel en
  `rgb(0,0,0)`, igual que antes.
- **Los once colores que SIGNIFICAN son los del tablero, byte por byte** — verde, rojo, ámbar, celeste. Y el
  celeste queda en **#2fb8da, el mismo de Sentrix**: la propuesta lo mostraba un punto más vivo (#35bfdd) y se
  descartó a propósito, porque el acento lo comparten los dos lados y el otro lado no cambia.
- **Los hexágonos siguen, con el mismo peso en pantalla.** No se eligió a ojo: sobre papel eran tinta al 0,203;
  acá son luz sobre gris, que es el gesto al revés. Se rasterizaron las dos y se buscó el alfa que iguala la
  tinta: **retícula 0,23 (desvío 0,2%)** y **latido 0,37 (0,7%)**.
- **Y toda la estructura que el owner fue decidiendo se mantiene**: sin burbuja en las respuestas de ADI,
  titular corto, sin pulso, hexágonos corridos al costado, centro limpio al conversar.

⚠️ **Lo que casi se pierde solo.** Esas decisiones de estructura colgaban de `esPapel()` — o sea, **del color**.
Al pasar la hoja de blanca a gris se habrían apagado todas de golpe, sin que nadie tocara nada. Ahora cuelgan de
`esSuperficieADI()`, que pregunta otra cosa: si estamos en el diseño nuevo del lado que conversa. **`esPapel`
decide color; `esSuperficieADI` decide estructura.** El gate lo sella con una afirmación que se pone roja si
alguien vuelve a mezclarlas.

**Tres superficies, un interruptor** — sin parámetro **pizarra**; `?papel=1` la hoja blanca; `?papel=0` el
diseño viejo COMPLETO (vuelven la burbuja, el titular largo y el pulso). Las tres verificadas en pantalla.

Contraste medido sobre el gris: **15,1 : 1** en el texto y **7,7 : 1** en las cifras celestes.
Gates **181 PASS · 0 FAIL · 0 TOCARON LA RED · 0 CON CREDENCIAL VIVA** (el de papel y tablero pasó de 30 a 45
comprobaciones).

---

## 1.12 — producción · tag `v1.12`

**Las líneas de los hexágonos, todas del mismo grosor.** El owner lo vio de una: «hay unas líneas que no
cuadran con el diseño». No era el color ni el tamaño — era que **la misma retícula se dibujaba mal**.

Dos defectos, uno encima del otro:

- **La misma línea se pintaba entre 2 y 6 veces.** El dibujo eran cinco hexágonos **cerrados**, y en una
  retícula cada lado lo comparten dos hexágonos vecinos, así que se pintaba dos veces. Encima, tres de esos
  cinco eran la baldosa que el mosaico ya repetía solo. Con trazo translúcido eso no es "un poco más marcado":
  al 8,5% de tinta, seis pasadas dan 41%.
- **La línea vertical de una de las dos filas salía a la mitad.** Caía justo sobre el borde del mosaico; la
  mitad que se salía quedaba recortada y nadie la pintaba del otro lado. Medido: pesaba **26 contra 53**.
- Y la misma línea estaba escrita con dos números distintos (45,03 y 45,04; 90,06 y 90,07), así que además de
  repetirse, se repetía **corrida**: dos rayas paralelas a una centésima.

**Cómo quedó.** Un hexágono tiene 6 lados pero sólo 3 son suyos —los otros se los pone el vecino—, así que la
retícula se dibuja con dos trazos abiertos en vez de cinco hexágonos cerrados, más el tramo que completa la
junta del borde. Números exactos (R·√3/2 = 45,0333), no redondeados.

**El grosor se recalibró para que el peso en pantalla no se moviera:** papel 0,085→0,203, tablero 0,036→0,084.
No es a ojo — se rasterizó la retícula vieja y la nueva y se buscó el alfa que iguala la tinta total:
**308.250 vs 307.864** en papel (0,1% de diferencia) y **133.408 vs 132.660** en tablero (0,6%). Lo que cambió
no es cuánto se ve, es que **el desnivel entre unas líneas y otras pasó de 1,85 y 2,25 a 1,00**.

Verificado sobre lo que el navegador dibuja de verdad, no sobre el código: seis líneas medidas, las seis pesan
46. Gates **181 PASS · 0 FAIL · 0 TOCARON LA RED · 0 CON CREDENCIAL VIVA**.

---

## 1.11 — producción · tag `v1.11`

**Lo que se lee, se lee sobre papel limpio.** La 1.10 despejó el centro de la **portada**, pero el campo de
hexágonos —y su halo— seguían montados **también detrás de la conversación**. El owner lo cazó de una:
«la conversación debe salir con un halo limpio».

Por qué el arreglo anterior no alcanzaba: las máscaras de la portada son **radiales**, despejan un óvalo. Eso
sirve para un titular y cuatro botones. Un hilo de chat es una **columna alta** — baja más que el óvalo y se le
sale por abajo, así que a partir de cierto largo el texto volvía a cruzar la retícula.

- **El halo no va mientras se conversa.** Es una mancha de color en el medio de la pantalla, justo donde caen
  los párrafos. Detrás de un titular sostiene; detrás de texto es papel sucio. Al primer mensaje se apaga.
- **Máscara nueva, en banda vertical:** limpia el centro de arriba a abajo y deja hexágonos sólo en los dos
  márgenes — que era la orden original, «por el costado así no se interponen».
- **En píxeles, no en porcentaje.** Con la banda al 26/74% el texto se salía 10 px: la columna del hilo no está
  centrada, la corre la barra lateral, y un despejado simétrico en porcentaje nunca le calza. Medido sobre
  1440: el texto va de −268 a +356 del centro; la banda despeja ±420.
- **Con la Mesa abierta no queda ningún hexágono.** El panel baja de 1000 px, los topes del `calc()` se vuelven
  negativos y el borde se apaga solo. Es el lado correcto del error: si no sobra margen, no se dibuja.
- **La portada no se movió**: halo encendido, seis hexágonos, máscara radial de siempre.

**De paso, la portada se centró a lo alto.** Al sacarle el pulso quedó pegada al techo con el **42%** de la
pantalla vacío abajo (terminaba a los 518 px de 900) — volvía por la ventana el problema del primer día. Ahora
apoya en el medio: 232 px arriba, 237 abajo.

Verificado en pantalla, no leyendo código: halo apagado y **0 hexágonos detrás del texto** con la Mesa abierta
y cerrada. Gates **181 PASS · 0 FAIL · 0 TOCARON LA RED · 0 CON CREDENCIAL VIVA**.

---

## 1.10 — producción · tag `v1.10`

**El centro queda para el halo.** Sobre papel los hexágonos se van al costado, que es la regla del anillo de
siempre — sólo que el anillo del tablero no alcanzaba acá.

Medido a 1440: despejaba hasta **228 px** del centro y la columna de conversación llega a **356**, así que
entre medio la retícula quedaba **debajo del texto**. Sobre negro nunca se notó (el trazo es luz al 3,6% y el
ojo no la registra bajo una palabra); sobre papel es tinta al 8,5% y compite con lo que se está leyendo.

- El hueco limpio pasa de 228 a **446 px**: el texto entra entero y los hexágonos arrancan donde la
  conversación termina.
- Los seis hexágonos que se encienden se mudan a los bordes. Los del tablero caían dentro de la columna.
- `?papel=0` conserva el anillo y las posiciones de siempre.

⚠️ **La 1.9 nunca llegó a producción**: se etiquetó pero no se empujó a GitHub, que es de donde se publica. La
1.10 sale con las dos cosas juntas. La lección queda escrita en [[adi-entornos]]: **mover `main` en local no es
publicar** — falta el `push`, y hasta que ese paso no ocurre el sitio sigue en la versión anterior.

## 1.9 — *incluida en la 1.10* · tag `v1.9`

**El inicio se saca lo que sobraba.** Tres correcciones del owner sobre el papel ya encendido, las tres
mirando la pantalla y no el código.

- **El titular se acorta a «¿Por dónde empezamos?»** y la bajada larga se va con él. El texto anterior servía
  para explicar el producto la primera vez; a la décima mañana cansa — palabras del owner: *«eso es muy robot,
  hay que pensar en el día a día»*. Y la bajada sobraba por una razón simple: las cuatro preguntas de abajo
  **son** la respuesta a «por dónde», así que contarlo además era decir dos veces lo mismo.
- **El pulso del inicio sale de la pantalla, y esto REVIERTE lo que dijo la 1.8.** Ahí quedó escrito que se
  quedaba; el owner lo miró montado y sostuvo lo que ya había pedido antes: *«son datos que tiene Sentrix, es
  repetirlo»*. Repetir en el hero de ADI lo que la Mesa ya muestra es el olor a BI que la estructura por
  función salió a matar. ⚠️ `pulsoInicio.js` **no se borra**: sigue siendo la forma correcta de que la vista no
  calcule, y la app oscura (`?papel=0`) lo sigue mostrando.
- **El latido de los hexágonos ahora se ve.** El owner reportó que estaban quietos; **corría de verdad** —seis
  animaciones activas— pero era invisible: medido, el pico movía el pixel **18 unidades** durante menos de un
  segundo. Sobre negro ese salto se nota; sobre papel el ojo no lo registra. Dos arreglos medidos: el color del
  encendido sube (**el pico pasa de 18 a 70 unidades**) y el papel estrena su propio ritmo, que **enciende y se
  queda** en vez de parpadear. El halo sube por la misma física.

La lección que deja: *«corre» y «se ve» no son lo mismo*, y sobre claro esa diferencia es enorme. Ningún
cambio de este tipo se da por bueno sin medir el pixel.

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
