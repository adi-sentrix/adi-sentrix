# ADI LLMBusiness — la Entrega, el plan y las derogaciones

> Marco aprobado por el owner (2026-09-22). **Tres capas:** ADI Core (hechos, cálculos, causalidad demostrada,
> prioridades, impactos, límites y qué NO puede concluirse) · ADI Business Knowledge (contexto sectorial, benchmarks,
> heurísticas, conocimiento de oficio reusable) · el LLM (juicio, conversación, matiz, explicación).
> **Dos canales, un cerebro:** en el Complemento el modelo anfitrión redacta DESPUÉS de ADI; en ADI directo
> controlamos la última milla.
> ⚠️ **ADI ya tiene definido su perfil de razonamiento CFO/controller senior.** El Business Knowledge lo POTENCIA con
> contexto y benchmarks; **no crea otro criterio ni duplica esa capa**.
>
> Reemplaza a `_ADI_PRODUCTO_FINAL_PLAN.md`. Estado: diseño, nada implementado, sin gasto.

## 0 · Lo que cambia de fondo

1. **La verdad se garantiza ANTES de que hable el modelo, no después.** Hoy ADI escribe con el modelo y después revisa.
   Ahora ADI escribe primero —sin modelo, todo verificado— y el modelo habla sobre eso. La verificación posterior pasa a
   ser segunda línea, y liviana.
2. **La escalera de respaldo deja de ser el plan B y pasa a ser el producto.** Las piezas que hoy solo escriben cuando el
   modelo falla son justamente las que saben escribir desde los hechos. Cambian de rol: escriben siempre.
3. **En el Complemento ADI no gasta un centavo en modelos ni espera a nadie.** La Entrega es determinística. La latencia
   deja de ser siete llamadas y pasa a ser un cálculo de segundos.

⚠️ **Advertencia que atraviesa todo:** ninguna forma de texto OBLIGA a otro modelo a respetarla. Se puede hacer tres
cosas: que copiar bien sea lo más fácil, que reescribir mal sea difícil, y **medir cuánto sobrevive**. Ese número no
existe todavía y es el primer número creíble del marco.

## 1 · LA ENTREGA — la pieza que faltaba

Un documento corto, siempre con la misma estructura, **escrito por ADI sin modelo y verificado contra los datos antes de
salir**. Siete partes:

| Parte | Qué contiene | Para qué sirve |
|---|---|---|
| **Marco** | Empresa, período, universo, moneda, definiciones, la referencia declarada. Una vez. | Todo lo que sigue lo hereda. |
| **Respuesta** | La conclusión del procedimiento en 2-3 oraciones. Cada una es un hecho completo. | Es lo que el anfitrión copia primero, porque es lo más barato de copiar. |
| **Cifras** | Tabla: quién · qué métrica · qué período · cuánto · de qué tipo (medido, estimado, supuesto suyo). | La fila es la unidad que no se puede partir. |
| **Lo que NO se puede concluir** | Hallazgos negativos, cada uno con su motivo. | La única forma de decirle a un modelo que no controlamos qué no debe decir. |
| **Referencia del oficio** | Lo que sabe el negocio, **nunca sobre este cliente**: sobre el sector. Con fuente, alcance, fecha y firma. | El conocimiento que un GPT tiene y ADI hoy no puede dar. |
| **Para su juicio** | Preguntas que solo el dueño puede responder, hipótesis por verificar, dónde mirar primero. Cada una con su hecho de apoyo. | Le da al modelo un lugar legítimo donde ejercer criterio, para que no lo ejerza inventando datos. |
| **Qué más puedo calcular** | Lo que ADI puede responder a continuación, y lo que no. | Si el anfitrión sabe que puede pedir el detalle, no lo inventa. |

### Los nueve mecanismos que la hacen resistente a la paráfrasis

1. **Cada cifra viaja dos veces**: en una oración completa y en una fila de tabla. Para perder el dueño hay que romper las dos.
2. **La fila es indivisible.** Quién, qué, cuándo y cuánto en la misma línea. Los modelos conservan rótulos de tabla.
3. **Las comparables viajan juntas** (este año y el anterior; su cifra y el benchmark): el anfitrión está obligado a decir cuál es cuál.
4. **La salvedad no es un adjetivo: es un hallazgo con título.** Los modelos conservan hallazgos titulados y borran paréntesis al final de una frase.
5. **Dos sujetos, nunca uno.** El dato tiene por sujeto a la empresa; el oficio, al sector. La frase puente la escribe ADI una vez.
6. **ADI precalcula las tentaciones** (totales, participaciones, diferencias, múltiplos). **Un modelo que calcula por su cuenta es la forma más silenciosa de inventar.**
7. **Lo que no está en los datos se dice como hallazgo, no como excusa.** El anfitrión transmite hallazgos; omite excusas.
8. **El juicio tiene combustible**: preguntas, hipótesis y orientaciones con sus apoyos. El modelo tiene qué decir sin inventar.
9. **La Entrega tiene enlace propio.** Si el anfitrión distorsiona, hay contra qué comparar.

### Decisiones tomadas
- **Es prosa y datos en capas.** Prosa porque es lo que un modelo copia; tabla porque no se parte; estructura por debajo para ADI directo y para medir.
- **Si el anfitrión cita un pedazo**, cada parte se sostiene sola. Residuo declarado: una celda tomada sin su fila pierde el período (lo cubre el marco).
- **Si preguntan algo que la Entrega no cubre**: si es calculable, «Qué más puedo calcular» ya lo ofrece; si no está en los datos, las negativas ya lo dijeron; si el anfitrión responde con lo suyo, es residuo del canal y **se mide**.

## 2 · ADI directo sobre la misma Entrega — se simplifica mucho

El redactor propio recibe la Entrega y escribe con voz de asesor. Como la Entrega ya es verdadera, **el verificador solo
comprueba que cada cifra del texto exista en la Entrega con ese dueño y esa métrica. Es una búsqueda, no un juicio.**

**Lo que desaparece del diseño anterior:**
- El modelo ya no escribe hechos. «Ningún dígito lo escribió el modelo» pasa de verificación a **consecuencia del diseño**.
- El protocolo de anclaje deja de ser obligatorio.
- Las 55 comprobaciones de forma se derogan: la casa ya escribió período, universo, base y cola.
- La llamada de re-anclaje desaparece. **Quedan dos llamadas máximo por turno.**
- El respaldo deja de ser una máquina sin voz: si el redactor falla dos veces, **se sirve la Entrega**, que es legible.

**Lo que queda del verificador: tres comprobaciones.** Cifras con dueño · órdenes (quién va primero) · que la conclusión
del procedimiento esté presente. Menos de 200 líneas, sin texto español literal.

**Decidido (no requiere al owner):** se construye **«una voz»** —el redactor reescribe todo— con la Entrega como red.
La variante «dos capas» (Entrega + lectura del asesor sin cifras) queda como su clase D natural y se compara en la
prueba a ciegas.

## 3 · ADI Business Knowledge — combustible, no cerebro

**La capa 2 no piensa. Alimenta.** El perfil CFO/controller ya define qué mira ADI: impacto económico, prioridades,
riesgos, causalidad demostrable, siguiente movimiento. **Esa forma de pensar no se toca.** Lo que le falta a ese perfil
es material: con qué comparar, qué esperar del sector, dónde buscar la evidencia, qué suele funcionar.

**Cada pieza lleva un campo obligatorio que dice a cuál de las cinco alimenta.** Una pieza que no engancha a ninguna no
sirve y no entra — ese es el filtro de aplicabilidad, y resuelve solo el problema del «conocimiento bonito que no se
sabe dónde usar»:

| Alimenta a… | Qué le da al perfil | Forma | Dónde entra en la Entrega |
|---|---|---|---|
| **Impacto económico** | Con qué comparar: un rango usual | Benchmark con definición y unidad | Junto a la cifra, con el puente calculado por el motor |
| **Prioridades** | Qué suele agravar o atenuar en el sector | Señal de contexto | Al lado de la prioridad ya calculada, **sin cambiarla** |
| **Riesgos** | Qué esperar: estacionalidad, dependencias, patrones de deterioro | Expectativa sectorial | En «Para su juicio», como contexto |
| **Causalidad demostrable** | Dónde buscar la evidencia que demostraría o descartaría una causa | Heurística de diagnóstico: qué cálculo pediría un controller | Si el motor puede calcularlo, lo hace y pasa a Cifras; si no, queda como «dónde mirar» |
| **Siguiente movimiento** | Qué suele funcionar, con qué condición y cuándo no | Opción con contraindicación | En «Para su juicio», como opción, **nunca como decisión** |

⚠️ **Frontera dura:** ninguna pieza puede cambiar un parámetro del procedimiento (un umbral, un orden, una lente). Si
alguien propone una que lo haga, no es conocimiento: es un cambio del motor y va por otro camino. Candado: la respuesta
del procedimiento es **idéntica** con la capa encendida y apagada.

**La unidad de conocimiento: nueve campos.** A los cuatro acordados (fuente · alcance · fecha · firma) se agregan cinco,
o el conocimiento no se puede aplicar sin riesgo:

| Campo | Por qué |
|---|---|
| **Tipo** | Un benchmark, un principio, una heurística y una señal se aplican distinto. |
| **Vigencia** (≠ fecha) | La fecha dice cuándo se supo; la vigencia, hasta cuándo vale. Sin vigencia nada caduca. |
| **Grado** | Establecido en el oficio · usual · opinión de la casa. No es lo mismo un estándar que una intuición. |
| **Cómo se compara** | Contra qué métrica del motor, con qué definición y unidad. **Si la definición no coincide, no se compara.** |
| **Qué NO implica** | «No es una meta suya», «no implica que la causa sea esa». Viaja pegado. |

**Su régimen de verdad:** un conocimiento no es verdadero ni falso sobre esta empresa. Se entrega solo si es **vigente ∧
aplicable ∧ comparable**. Se entrega siempre con el sector por sujeto. **La palabra «alto» o «preocupante» no la escribe
ADI: eso es juicio, y es del modelo.**

**Se retiró del boceto los «marcos de decisión» como método propio:** eso era duplicar el perfil. Lo que quedó es la
**heurística de diagnóstico** (fila 4), que dice **dónde buscar la evidencia, nunca qué concluir**. Cuatro partes —
disparador · orientación · lo que NO afirma · qué lo confirmaría.

**Y acá está el cambio de comportamiento de fondo de todo el plan:** si el motor puede hacer ese cálculo, **lo hace en el
momento, sin que nadie lo pida**, y la heurística se convierte en un hecho medido. Si no puede, queda como orientación
en «Para su juicio». Una heurística o produce un hecho verificado o queda declarada como orientación: **jamás una
causa.** Candado: ningún hecho de tipo `razon` puede tener una pieza de conocimiento como premisa.

**Cómo se pega al cliente:** el motor necesita un perfil (sector, subsector, tamaño, país, moneda, modelo comercial) que
se captura en la ingesta. **Sin perfil no se entrega nada de esta capa: falla cerrado.**

**Cómo crece sin pudrirse:** ningún ítem lo firma un modelo (puede proponer, firma una persona) · sin los nueve campos no
entra · lo vencido deja de entregarse solo · revisión trimestral de lo que vence, lo más usado y lo nunca usado ·
**la fuente de crecimiento es el uso**: los criterios «fuera del dato» recurrentes son la lista de candidatos.

## 4 · El plan · siete etapas · las cuatro primeras no gastan nada

| Etapa | Qué resuelve | Qué se reusa | Medición offline | Gasto |
|---|---|---|---|---|
| **0 · Doctrina** | Leyes ajustadas, estructura de la Entrega, ficha de conocimiento, presupuesto de turno | Todo lo decidido | — | Gratis |
| **1 · El compositor** | ADI escribe la Entrega sola desde el libro | **La escalera completa** (playbooks, ensamblador de encargos, línea honesta, límites): cambian de rol | Sobre los 888 libros existentes: cero cifras sin dueño, cero hechos omitidos, cada hueco declarado como negativa | Gratis |
| **2 · El libro más rico** | Procedencia en cada cifra, ausencias como hechos, universo como objeto, referencia, perfil del cliente | El esquema actual | Validación de esquema sobre todos los libros | Gratis |
| **3 · Knowledge v0** | Primeros 20-30 ítems, emparejamiento con el perfil, heurísticas que planifican cálculo | El motor de lecturas, que ya calcula lo que las heurísticas piden | Por escenario: qué aplica, qué puentes se calculan, ninguno vencido, ninguno con la empresa por sujeto | **Horas del owner y el socio** |
| **4 · Prueba de paráfrasis** | **El primer número creíble.** 60 Entregas × 3 anfitriones × 3 formas de preguntar = 540 salidas, grabadas para siempre | Las Entregas de la etapa 1 | Tras grabar: cuántas cifras llegan con dueño, métrica y período; cuántas negativas se respetan; **cuánta aritmética inventó el anfitrión** | **Gasto nombrado, una vez** |
| **5 · ADI directo** | Redactor propio, verificador liviano, dos llamadas máximo. Se retiran las 55, las 64, la poda y la cirugía de voz | Lo que ya verifica cifras | Las 540 salidas de la etapa 4 sirven para probar el verificador | Gratis |
| **6 · Conversación** | La Entrega recuerda: alcance vigente, propuestas en pie, premisas del usuario con veredicto | El estado de conversación existente | Estructural | Parcial |
| **7 · Prueba a ciegas y piloto** | ADI «una voz» · ADI «dos capas» · frontier crudo · **frontier con la Entrega** | — | — | Gasto nombrado |

**En paralelo y por delante de todo: la ingesta.** Sin archivo no hay libro, sin libro no hay Entrega, y **sin perfil no
hay conocimiento aplicable**.

**Umbrales propuestos para la etapa 4:** valor + dueño ≥ 90 % · período ≥ 80 % · negativas respetadas ≥ 80 % · cifras
inventadas = 0 en ≥ 95 % de las salidas · aritmética del anfitrión ≤ 5 % · referencia convertida en «meta» ≤ 5 %.

## 5 · Las leyes heredadas, con ojos nuevos

| Restricción | Veredicto anterior | **Veredicto nuevo** | Por qué |
|---|---|---|---|
| El verificador de redacción (64 comprobaciones) | Se muda | **SE DEROGA** | No hay texto final que verificar en el Complemento; en directo lo reemplaza una búsqueda. Sus leyes se cumplen en la Entrega por construcción. |
| Las 55 comprobaciones de forma | Se transforma en resolvedor | **SE DEROGA** | La casa ya escribe todo lo que exigían. |
| El protocolo de anclaje | Base del diseño | **Deja de ser obligatorio** | El modelo ya no escribe hechos. |
| Las cuatro garantías | Ley se queda, mecanismo se muda | **Ley se queda; el mecanismo es la parte de negativas** | Ya no se veta «se deteriora»: se entrega el hallazgo «no hay serie; no se puede afirmar dirección». |
| La ley del socio | Se angosta | **Se reescribe** | El Notario se muda al principio: verifica la Entrega antes de que salga. La paráfrasis se mide, no se verifica. |
| Topes de forma (90, 120, tabla por modo) | Se muda / angosta | **SE DEROGAN TODOS** | La forma es del anfitrión. En directo se pide y se reintenta; nunca se corta. |
| Cirugía de voz | Se muda a detector | **SE DEROGA** | No hay texto ajeno que operar. |
| Escalera de respaldo | Se angosta | **SE TRANSFORMA: es el compositor** | Cambia de rol, no se tira. |
| El atajo sin pago | Se deroga | **Parecía deuda y resulta necesario** | Responder sin modelo es exactamente lo que ADI hace en el Complemento. |
| La Poda («un solo camino») | Se queda | **Se reescribe: un cerebro, dos entregas** | Dos últimas millas no son dos ADIs si el compositor es uno. |
| «Sentrix muestra el 01 y el 02» | Se queda | **Se amplía** | En el Complemento no está Sentrix: la Entrega lleva el qué pasa y el dónde, no solo el qué hacer. |
| Una sola verdad por eje | Se queda | **Se queda y crece** | Ahora son tres superficies y las tres usan la misma función. |
| La ley de la conclusión | Se angosta | **Confirmada; el mecanismo es la posición** | Va primera, en oración propia, escrita por la casa. |

**No cambian:** no hay causalidad sin respaldo · una sola verdad · la referencia no puede parecer meta · cero llamadas sin
autorización nombrada · ADI asesora, no gestiona.

## 6 · Los huecos, del más peligroso al menos

1. ⚠️ **El anfitrión que calcula por su cuenta.** Recibe «venta 21,5 y margen 12 %» y escribe «es decir, 2,6 de
   contribución». **Ese dígito no lo escribió ADI y sale con la autoridad de ADI.** Es el más peligroso porque no tiene
   ninguna palabra sospechosa. Mitigación: precalcular las tentaciones. **Es detectable mecánicamente** (cualquier cifra
   que sea suma, resta o cociente de dos cifras de la Entrega) y se mide en la etapa 4.
2. **Quién es el usuario en el Complemento.** Sin identidad, cualquiera con el enlace ve datos ajenos. **No es calidad:
   es seguridad, y bloquea el piloto.** El tenant se deriva del token, nunca de un argumento.
3. **Los datos viajando al modelo del usuario.** Nunca viaja el archivo: solo hechos calculados y solo los que la
   pregunta necesita. Requiere consentimiento al cargar y acuerdo de tratamiento de datos. Bloqueo comercial.
4. **La ingesta.** Ahora pesa más: el perfil del cliente se captura ahí.
5. **La conversación que vive en el anfitrión.** Mitigación: identificador de sesión obligatorio, libro propio, la
   Entrega abre con «lo que ya entregué». Residuo: la memoria del anfitrión.
6. **El tamaño de la Entrega.** Los anfitriones cortan sin avisar. Tope explícito y detalle aparte.
7. **Cuando el anfitrión ignora los límites.** Se mide, se declara, se mitiga por forma. No se impide.
8. **La caducidad de la medición.** Los anfitriones cambian de modelo sin avisar: el número envejece y hay que repetirlo.
9. **El conocimiento vacío.** Horas de personas, no de código.

## 7 · Un ejemplo completo de la Entrega

Pregunta en ChatGPT: **«¿Dónde estoy perdiendo plata?»** (cifras de la distribuidora de demostración)

> **ENTREGA ADI · ¿Dónde deja de ganar?**
> *Uso: las oraciones marcadas ▸ pueden citarse tal cual. Las cifras nuevas no se calculan: se piden a ADI. La
> «Referencia del oficio» es general, no un dato de la empresa.*
>
> **Marco.** Distribuidora Demo, acumulado enero–agosto 2026, 14 clientes, millones de pesos (MM$). Margen =
> contribución sobre venta neta. Benchmark de margen: 28 %, declarado por usted. La cobranza y el inventario son una
> foto al 31 de agosto y no se suman con la venta.
>
> **Respuesta.**
> ▸ Donde más contribución deja de capturar es en Lider: vende MM$ 21,5, el mayor cliente, con un margen de 12,0 %
> contra su benchmark de 28 %; la brecha estimada es MM$ 3,4, el 71 % de la brecha total estimada de MM$ 4,8.
> ▸ El segundo es Cencosud: MM$ 11,3 de venta, 22,0 % de margen, brecha estimada MM$ 0,7.
> ▸ De la brecha total de MM$ 4,8, la carga comercial alta explica MM$ 0,6 en 6 cuentas; los MM$ 4,2 restantes son
> precio y costo, que los datos no separan.
> ▸ Aparte, y sin sumarse a lo anterior: MM$ 3,9 de saldo vencido (9 clientes) y MM$ 1,18 de inventario sin movimiento
> (37 productos), ambos al 31 de agosto.
> ▸ Prioridad del procedimiento, por riesgo integrado: Lider, porque concentra la mayor brecha estimada y el mayor
> saldo vencido, MM$ 1,6. Por contribución total el orden sería otro: Falabella va primera.
>
> **Cifras · acumulado enero–agosto 2026 · 14 clientes · MM$**
>
> | Cliente | Venta | Margen | Contribución | Brecha estimada vs 28 % | Vencido al 31-08 | Tipo |
> |---|---|---|---|---|---|---|
> | Lider | 21,5 | 12,0 % | 2,6 | 3,4 | 1,6 | medido / brecha estimada |
> | Falabella | 14,2 | 31,0 % | 4,4 | 0 (sobre el benchmark) | 0,4 | medido |
> | Cencosud | 11,3 | 22,0 % | 2,5 | 0,7 | 0,7 | medido / brecha estimada |
> | Tottus | 9,8 | 24,0 % | 2,4 | 0,4 | 0,3 | medido / brecha estimada |
> | La Polar | 6,1 | 34,0 % | 2,1 | 0 (sobre el benchmark) | 0 | medido |
> | Otros 9 clientes | 35,5 | 24,5 % | 8,7 | 0,3 | 0,9 | medido / brecha estimada |
> | **Total 14** | **98,4** | **23,2 %** | **22,8** | **4,8** | **3,9** | |
>
> Partición de la brecha: carga comercial alta MM$ 0,6 · precio y costo MM$ 4,2.
> Venta de Falabella, enero–agosto 2026 contra 2025: MM$ 14,2 contra MM$ 16,1, −12 %. Es la única variación disponible.
> Inventario sin movimiento al 31-08: MM$ 1,18 en 37 productos; los 12 mayores concentran MM$ 0,42.
>
> **Lo que no se puede concluir con estos datos.**
> - **No hay serie mensual de margen por cliente.** No se puede afirmar que el margen de Lider haya caído, subido o se
>   mantenga: solo que está en 12,0 % en el acumulado.
> - **La brecha de MM$ 4,8 es una estimación contra su benchmark.** No es dinero perdido ni recuperable en su totalidad.
> - **La causa de la caída de Falabella (−12 %) no está en los datos.**
> - **El saldo vencido no es una pérdida.** Es capital retenido; sería pérdida solo si se incobra.
> - **El inventario sin movimiento y la brecha comercial son universos distintos.** No se suman.
> - **No se sabe qué clientes dejaron de comprar qué productos**: no hay historial cliente por producto.
>
> **Referencia del oficio** (general, no es un dato ni un objetivo suyo).
> - En distribución a grandes cadenas de retail en Chile, el margen de contribución de las cuentas mayores suele ser el
>   más bajo de la cartera, porque el volumen se negocia con descuentos y rebates. *Práctica de la casa · alcance:
>   distribución a retail, Chile, ventas 1–30 MM USD · 2026-06 · vigente hasta 2027-06 · firma: jc.*
> - Cuando una cuenta grande está muy por debajo del benchmark y concentra la venta, el oficio recomienda revisar
>   primero su estructura de descuentos y rebates antes que la lista de precios general. **Esto no afirma que los
>   descuentos sean la causa.** Lo que lo confirmaría: la carga comercial de esa cuenta contra el resto. **ADI lo
>   calculó:** la carga de Lider es 9,8 % de su venta contra 5,1 % del promedio de los otros 13 (medido).
>
> **Para su juicio.**
> - Solo usted puede responder: ¿el margen de Lider responde a un rebate anual pactado o a una erosión no negociada? La
>   respuesta cambia la acción: renegociar o corregir.
> - Hipótesis no demostrada: parte de la brecha de Lider está en la carga comercial (apoyo: 9,8 % contra 5,1 %).
> - Dónde mirar primero, por orientación del oficio: los términos comerciales de Lider.
> - Qué preguntarle al equipo sobre Falabella: si la caída de −12 % tiene explicación conocida. Los datos no la tienen.
>
> **Qué más puedo calcular.** Margen por producto dentro de Lider · carga cuenta por cuenta · ranking por contribución ·
> vencidos por antigüedad · simular un cambio de descuento en Lider. **No puedo:** quién dejó de comprar qué · por qué
> se detuvo un producto · costo de financiamiento del vencido (sin tasa declarada).
>
> *Ver esta Entrega completa en ADI: [enlace]*

**Así podría reescribirlo un anfitrión** (reescritura posible, no medida):

> *Tu mayor fuga de contribución está en Lider: es tu cliente más grande (MM$ 21,5 de venta) pero deja apenas 12 % de
> margen frente a tu benchmark de 28 %. Eso equivale a una brecha estimada de MM$ 3,4, casi tres cuartos del total
> (MM$ 4,8). Cencosud es el segundo, con MM$ 0,7. Ojo: no hay serie mensual, así que no sabemos si el margen de Lider
> viene cayendo o siempre fue así. Aparte hay MM$ 3,9 vencidos y MM$ 1,18 de inventario parado, que no se suman a lo
> anterior. ADI calculó que Lider tiene una carga comercial de 9,8 % contra 5,1 % del resto: yo empezaría revisando los
> términos de ese contrato antes de tocar precios. ¿Ese margen bajo es un rebate pactado o se fue erosionando?*

**Sobrevivió:** todas las cifras con su dueño, la negativa sobre la serie, la separación de universos, la prioridad, la
heurística como orientación y la pregunta al usuario. **Se perdió:** el período (queda implícito) y la palabra
«estimada» en una de dos menciones. **Eso es exactamente lo que la etapa 4 va a medir sobre cientos de casos.**
