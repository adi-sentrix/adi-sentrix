# Perfil del cliente · propuesta de vocabularios

> Para que el owner apruebe o corrija. Camino B aprobado (2026-09-23): el perfil se captura FUERA de la plantilla
> congelada, una sola vez, al cargar los datos.
> **Principio que gobierna toda la propuesta:** la taxonomía existe para decidir **qué conocimiento de oficio aplica a
> quién**. Su granularidad la dicta **dónde el oficio realmente cambia** —plazo de pago usual, margen esperado, rotación
> sana, poder de negociación—, nunca una clasificación oficial. Si dos rubros comparten las cuatro, para ADI son el
> mismo sector aunque el Estado los separe.
>
> **Cuatro preguntas** (tres para servicios y obras), una sola vez, menos de un minuto. **Si el usuario no responde, ADI
> funciona igual sobre sus datos** y dice una vez qué no incluye.

## 1 · Los sectores: cinco

**La pregunta que los separa es «¿qué haces con lo que vendes?», no «¿qué vendes?».** El producto es la misma lavadora;
el oficio cambia según si la compraste hecha, la fabricaste, la vendes al público o instalas la cocina completa.
Así el distribuidor y el fabricante de electrodomésticos **nunca caen juntos**, que era el caso de borde que más caro sale.

| Sector | Qué incluye | Qué cambia del oficio |
|---|---|---|
| **Distribución y venta mayorista** | Compra productos terminados y los revende a otras empresas. Importadores, distribuidores, mayoristas. | Margen bruto **bajo**: la ganancia está en el volumen y el costo de compra. Rotación **rápida**. Plazo de cobro **largo** con cliente grande. **El poder lo tiene el comprador.** La carga comercial (descuentos, rappels, devoluciones) es tema central y propio. |
| **Fabricación y producción** | Produce lo que vende. Industria, agroindustria, alimentos, envases, metalmecánica. | Margen bruto **más alto** (paga la planta). Inventario con **tres estados** y rotación sana **más lenta**. Los costos fijos hacen que el volumen importe más que el precio. |
| **Comercio minorista** | Vende al consumidor final, en tienda o en línea. | **Cobra al contado**: la cobranza casi no aplica. El eje «cliente» es débil; mandan producto, categoría e inventario. El poder está hacia el **proveedor**. |
| **Servicios** | Vende trabajo, tiempo o capacidad: consultoría, logística, software, servicios profesionales o técnicos. | **No hay inventario físico**: el capital frenado es trabajo hecho y no facturado. **La cobranza es el dominio central.** |
| **Obras y proyectos por contrato** | Construcción, montaje, ingeniería, instalaciones. | Se cobra **por hitos y con retenciones**; los plazos más largos de todos. El inventario es obra en curso, no SKU. Un benchmark de servicios acá sería **falso**. |

**Por qué cinco.** Con tres (bienes · servicios · retail) el distribuidor y el fabricante quedan juntos, y tienen margen y
rotación **opuestos**. Con diez, el usuario tiene que saber su rubro y la mayoría de esas divisiones no cambian ni plazo,
ni margen, ni rotación, ni poder. **Cinco es el número donde cada frontera cambia al menos dos de esas cuatro cosas.**

**Regla para que la lista no crezca por capricho:** un sector nuevo entra **solo cuando poner a esas empresas en uno
existente les entregaría conocimiento equivocado**. Un sector con catálogo vacío entrega nada, y eso es honesto; un
sector prestado entrega falsedades.

**Si hace más de una cosa:** elige la que explica la mayor parte de su venta. Se le dice en la pregunta.

**Sexta opción: «Ninguna de estas describe a mi empresa».** No es «Otro» disfrazado: se guarda como respuesta, la capa
queda apagada con aviso, y **se cuenta cuántos la eligen**. Es la señal para saber cuándo hace falta un sector nuevo.

## 2 · El subsector es «tipo de producto», no rubro

**Recomendación: un campo más, cerrado, cinco valores, y solo para Distribución, Fabricación y Minorista.** Servicios y
Obras no lo responden.

**Para qué sirve que el sector no cubre:** la rotación sana y el riesgo del capital frenado. Un distribuidor de yogur y
uno de refrigeradores **son el mismo sector** —comparten plazos, márgenes y poder— pero uno rota en días y el otro en
meses, y en uno el stock frenado **se pierde** mientras que en el otro solo cuesta capital. Sin este campo, el benchmark
de inventario sería falso para la mitad de los distribuidores.

| Tipo de producto | Qué cambia |
|---|---|
| **Con fecha de vencimiento** (alimentos, bebidas, farmacia) | Rotación en días o semanas. El stock frenado es **merma**, no solo capital. |
| **Consumo frecuente sin fecha crítica** (aseo, hogar, librería, ferretería) | Rotación rápida, margen bajo, poca obsolescencia. |
| **Bienes durables** (electrodomésticos, muebles, tecnología, repuestos) | Rotación en meses, ticket alto, **estacionalidad fuerte**, garantías. |
| **Vestuario, calzado y temporada** | El inventario vale **por temporada**; lo que no se vendió a tiempo se liquida. |
| **Insumos y equipos para otras empresas** | Venta técnica, plazos largos, tickets grandes, rotación irregular. |

**Cómo evitar que sea infinita:** el valor no es un rubro sino un **comportamiento del inventario** (vence · rota rápido ·
rota lento · es de temporada · es técnico). Cualquier producto cae en uno de esos cinco.

⚠️ Nombre: el plan lo llamaba `subsector` pero el contenido es **tipo de producto**. Se propone llamarlo así desde el
inicio, para no cargar un nombre que miente.

## 3 · Tamaño: tres bandas, derivadas, sin tipo de cambio

**No se pregunta.** Se calcula con la venta anual del archivo, en la moneda que el cliente ya declaró, contra una
**tabla de umbrales por moneda que la casa escribe, firma y fecha**.

Así se respeta la ley: **nada se infiere del cliente.** El cliente declara su moneda; la casa declara, por moneda, dónde
están los cortes. **No hay conversión en el momento.** Si el peso se mueve un 20 %, la tabla no cambia sola: cambia
cuando alguien la revisa, y queda registrado.

**Si la moneda declarada no tiene tabla, no hay banda** → el perfil queda incompleto y la capa no se entrega. Agregar la
tabla de una moneda es cosa de minutos y queda firmada.

### ✅ DECIDIDO POR EL OWNER (2026-09-23): la clasificación oficial chilena, cuatro bandas

Textual: «usemos como referencia la clasificación oficial chilena, expresada para el producto en pesos… Son equivalentes
aproximados al 23-sep-2026; **la clasificación oficial está definida en UF, por lo que ADI debe usar la referencia
oficial correspondiente al período para mantenerla vigente, pero el usuario trabaja y ve pesos.**»

| Banda | En pesos (aprox. al 2026-09-23) | En UF (el umbral real) |
|---|---|---|
| **Micro** | hasta ~$98 MM al año | hasta 2.400 UF |
| **Pequeña** | $98 MM – $1.025 MM | 2.400 – 25.000 UF |
| **Mediana** | $1.025 MM – $4.100 MM | 25.000 – 100.000 UF |
| **Grande** | sobre $4.100 MM | sobre 100.000 UF |

✅ **UMBRALES CONFIRMADOS POR EL OWNER (2026-09-23): 2.400 · 25.000 · 100.000 UF.** Son la verdad almacenada; las cifras
en pesos son su presentación al 2026-09-23 y se recalculan con la UF del período.

**Consecuencia de diseño: el umbral se guarda en UF; los pesos son presentación.** La tabla de UF por período es una
pieza de conocimiento con sus nueve campos (fuente, fecha, vigencia, firma…): **se escribe y se firma, nunca se consulta
en línea en tiempo de ejecución.** Así la banda sigue siendo determinística y auditable, y no depende de una red.

**Qué UF se usa:** la del **período que el cliente declara** en la hoja Empresa (`periodo_actual`). Sin período declarado
no hay UF aplicable → **no hay banda** → el perfil queda incompleto y la capa no se entrega (falla cerrado). La banda se
persiste con todos sus insumos: monto, moneda, UF usada, período, versión de la tabla y si se proporcionó a 12 meses.

**Fuera de Chile:** la clasificación es chilena. Otro país necesita su propia tabla firmada; sin ella no hay banda, y la
capa no se entrega para ese cliente. Es la misma regla, sin excepción.

⚠️ **Dato que conviene saber:** el archivo de demostración ($100 MM al año) queda en **Pequeña**, apenas un 2 % por
encima del corte de Micro. Cualquier movimiento de la UF lo puede cambiar de banda. Para un dato de demostración da
igual; para elegir qué benchmarks cargar primero, no.

**Y si el archivo trae ocho meses**, la venta se **proporciona a doce solo para elegir la banda**, nunca se muestra como
cifra.

## 4 · Modelo comercial: lista cerrada de cuatro

**Recomendación: lista, no texto libre.** Nadie puede emparejar conocimiento contra «vendemos a varios canales».
**La concentración no se pregunta: ADI la mide** con la venta por cliente. Lo que no está en el dato es **qué tipo de
contraparte** es ese cliente.

| A quién le vende la mayor parte | Qué cambia |
|---|---|
| **A pocas cuentas grandes** | El poder lo tiene el comprador. Plazos de 60 a 120 días impuestos. Descuentos, rappels y notas de crédito pesan. **Perder una cuenta es riesgo de continuidad.** |
| **A muchos comercios pequeños y medianos** | Poder equilibrado. Plazos de 30 a 60 días. Riesgo de crédito repartido; la cobranza es trabajo de volumen. |
| **A personas, como consumidor final** | Cobro inmediato. No hay eje «cliente». |
| **Al Estado o empresas públicas** | Licitaciones, plazo legal que no se cumple. Cobranza lenta y previsible. |

Sin «mixto»: se pregunta por **la mayor parte**; el resto lo muestra el dato.

## 5 · País: se pregunta, lista cerrada, sin sugerencia

**No se deduce de la moneda** —el dólar es la moneda de Ecuador, Panamá y El Salvador, y de exportadores chilenos que
llevan libros en dólares— **ni al revés**. Una sugerencia pre-marcada «Chile, porque declaraste pesos» **es una
inferencia con otro nombre**.

Qué cambia por país: el plazo legal de pago, el calendario (en Chile la vuelta a clases es en marzo), la práctica de
cobranza, los nombres de las cadenas y el benchmark local.

Lista: países de habla hispana de América más Brasil y España, con Chile primero (ordenar no es inferir).

## 6 · Las preguntas, textuales

> **Antes de leer tus datos, cuatro preguntas sobre tu empresa.**
> Sirven para que ADI compare tu negocio con el oficio que le corresponde, y no con otro. Se responden una sola vez;
> puedes cambiarlas después desde la Ficha.

**1 · ¿Qué hace tu empresa con lo que vende?** *(Si hace más de una cosa, elige la que explica la mayor parte de tu venta.)*
○ Compra productos terminados y los revende a otras empresas · ○ Fabrica o produce lo que vende · ○ Vende productos al
público, en tienda o en línea · ○ Vende servicios: trabajo, tiempo o capacidad, no productos · ○ Ejecuta obras o
proyectos por contrato · ○ Ninguna de estas describe a mi empresa

**2 · ¿Qué tipo de producto es la mayor parte de lo que vendes?** *(solo si eligió una de las tres primeras)*
○ Alimentos, bebidas, farmacia u otros con fecha de vencimiento · ○ Consumo frecuente sin fecha crítica: aseo, hogar,
librería, ferretería · ○ Bienes durables: electrodomésticos, muebles, tecnología, herramientas, repuestos · ○ Vestuario,
calzado y productos de temporada · ○ Insumos, materiales o equipos para otras empresas

**3 · ¿A quién le vendes la mayor parte?**
○ A pocas cuentas grandes: cadenas de retail o grandes empresas · ○ A muchos comercios y empresas pequeñas o medianas ·
○ A personas, como consumidor final · ○ Al Estado o a empresas públicas

**4 · ¿En qué país está la mayor parte de tu venta?** *(lista cerrada)*

Al pie, un solo enlace: **«Omitir por ahora. ADI analizará tus datos igual, sin referencias del oficio.»**

**Lo que NO se pregunta y por qué:** la moneda ya está declarada; el tamaño se deriva. No se pide nombre, rubro oficial,
RUT ni cantidad de empleados: **nada de eso cambia qué conocimiento aplica.**

## 7 · Si no sabe o no quiere responder

**No se bloquea.** Se entrega todo lo que sale del dato, sin la capa de oficio, y se dice **una vez**. Se puede completar
después desde la Ficha; en la carga siguiente se pregunta solo lo que falta.

**Lo que pierde, sin suavizarlo:** ninguna referencia del oficio — ADI le dirá que su margen es 21 % y que Lider está
bajo el benchmark que él declaró, pero **no podrá decirle si 21 % es normal para un distribuidor** ni si 75 días de cobro
son lo usual con una cadena. Ninguna expectativa sectorial. Ninguna pista de dónde buscar la causa que venga del oficio.
Ninguna opción con contraindicación.

**Lo que conserva:** todo lo demás. Qué pasa, dónde, qué hacer primero, con sus cifras y su benchmark declarado.
**Por ley, la capa encendida y apagada dan la misma conclusión del procedimiento.**

Cómo se dice, una sola vez, en la Entrega:
> *Sin perfil de empresa: esta entrega no incluye referencias del oficio. Se completa en un minuto desde la Ficha.*

Respuesta parcial vale lo mismo que no contestar, y la línea nombra lo que falta («Falta el país»). **Sin ventanas
emergentes ni recordatorios.**

## 8 · Nota técnica

Códigos estables e independientes del rótulo (**el rótulo es superficie y puede cambiar; el código no**):
`sector` ∈ {distribucion · fabricacion · minorista · servicios · obras · ninguno · null} · `tipoProducto` ∈ {vence ·
consumo · durable · temporada · insumos · null} · `modeloComercial` ∈ {cuentas_grandes · comercios · consumidor ·
publico · null} · `pais` ISO alfa-2 · `moneda` ISO 4217 (ya existe, no se toca).

`null` = no respondido. `'ninguno'` = respondido y fuera de la taxonomía. **Son distintos y los dos apagan la capa.**

**El tamaño no se guarda como respuesta:** se calcula y se persiste con sus insumos (monto, moneda, versión de la tabla,
período, si se proporcionó a 12 meses) **para poder auditar por qué se eligió ese benchmark**.

La tabla de bandas **es conocimiento**: lleva los nueve campos (fuente, alcance, fecha, vigencia, firma, grado…), vence y
se revisa como cualquier pieza. **Nunca se convierte en tiempo de ejecución.**

Emparejamiento: cada pieza lleva `aplicaA` con listas o `*`. **Una pieza nunca empareja contra `null`.**

**Cuando la taxonomía quede corta** (va a pasar): un valor entra **solo cuando existe una pieza que sería falsa para sus
hermanos** — la evidencia son las piezas que no se pueden etiquetar sin mentir y el conteo de `'ninguno'`. Un código
**nunca se renombra ni se borra**: se sube `PERFIL_VERSION` y se agrega. Partir un valor deja el viejo como padre y pide
**una pregunta de refinamiento** en la carga siguiente; **nunca se reasigna en silencio**.

## 9 · Lo que decide el owner

1. **Las cinco listas** de arriba: aprobar o corregir.
2. **Los umbrales en pesos** (1.000 y 10.000 millones) y las equivalencias para las demás monedas. Van redondos y los
   **firma una persona**.
3. **Si «Obras y proyectos» entra ahora** o cuando exista el primer cliente. Recomendación: ahora, por la regla de que un
   sector prestado entrega conocimiento falso.
4. **El grano del falla cerrado**: hoy, sin perfil completo no se entrega nada. Alternativa más fina: entregar la pieza si
   sus campos requeridos están aunque otros falten. Recomendación: **mantener la regla dura hasta el piloto** y revisarla
   con datos reales de omisión.
