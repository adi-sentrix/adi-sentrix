# ADI Business Knowledge v0 · propuesta de piezas con pertinencia medida

> Propuesta para que el owner apruebe o rechace **pieza por pieza**. Nada implementado, sin gasto. Sigue el §3 de
> `_ADI_LLMBUSINESS_PLAN.md` y la taxonomía de `_ADI_PERFIL_VOCABULARIOS_PROPUESTA.md`.
> **v0.2 (2026-09-23):** incorpora la condición del owner: *«no debe seleccionarse solo por perfil de empresa; también
> debe aterrizarse sobre la realidad que el Core conoce… ADI sabe qué mirar por oficio y además puede calcular si eso
> está ocurriendo realmente en esta empresa»*. Reemplaza a la v0.1 del mismo día.
> Redactó: el arquitecto (usando Fable). Firma: ninguna pieza queda firmada hasta que una persona la valide.

---

# PARTE A · para el owner

## Conclusión primero

1. **La condición nueva es correcta y deja 22 piezas de 27.** Cinco se van porque el oficio las diría pero ADI no
   puede medir si están pasando en esta empresa: eran contexto sin cifra, justo lo que un GPT ya da.
2. **Cada pieza que se sirve trae ahora un veredicto de tres, y sale de un cálculo:** *está ocurriendo* (con la cifra)
   · *no está ocurriendo* (con la cifra) · *no se puede saber* (con el motivo y qué dato lo resolvería).
3. **El segundo veredicto no está sobrevalorado, con una condición.** Descartar una hipótesis del oficio con una
   cifra vale tanto como confirmarla **cuando la medición decide de verdad**. Cuando la cifra solo "no apoya" pero
   no descarta, decir «no está ocurriendo» es una falsa tranquilidad. Por eso cada medición declara si es decisiva
   y qué no excluye. Con esa regla, es la ventaja más difícil de copiar: un GPT puede decirle «mire la carga»; solo
   ADI puede decirle «la miré: la de Cencosud está en línea con el resto».
4. **La pertinencia reemplaza a la cuota como filtro.** La cuota recortaba por número; la pertinencia recorta por
   relevancia. Pero la cuota no desaparece del todo: queda como tope de tamaño, aplicado después, porque los
   anfitriones cortan textos largos sin avisar.
5. **En una empresa sana la capa no queda vacía: cambia de forma.** En vez de alertas, entrega el recuento de lo
   que el oficio mira y ADI revisó: «de las 7 cosas que el oficio mira en su sector, ADI midió 6; ninguna está
   ocurriendo». Eso es contexto con cifra, no relleno.
6. **Lo que hace falta del motor:** una tabla de señales por entidad (publicar como predicados lo que el Core ya
   calcula) y cuatro cálculos derivados baratos. Nada de umbrales nuevos. El detalle ordena el trabajo (§4).
7. **Ningún número de mercado está inventado.** Las casillas siguen vacías, y una casilla vacía no se sirve.

Etiquetas: **(A)** lo local y concreto · **(B)** dispara un cálculo del motor · **(C)** contradice lo que un modelo
diría por intuición. Grado: **establecido** · **usual** · **casa** (pendiente de validación).

---

## 1 · La regla nueva, en una página

**Antes:** una pieza se servía si era vigente, aplicable al perfil (sector, tamaño, país) y enganchada a una de las
cinco cosas que mira el perfil CFO/controller.

**Ahora, dos filtros más, para las cinco clases:**

**Pertinencia — ¿le importa hoy?** Cada pieza declara con qué señal del Core se enciende: una cuenta bajo su
benchmark, una carga sobre el resto, una variación negativa, un SKU frenado, un vencido, una coincidencia de señales
en la misma cuenta, o **el tema que el usuario pregunta**. Si ninguna señal está presente en el libro del turno, la
pieza no se sirve aunque le corresponda por sector. **La pieza nunca define qué es "alto" o "bajo": lee el veredicto
del Core.** Así no puede colar un umbral.

**Medición — ¿está ocurriendo?** Cada pieza pertinente nombra el cálculo que lo decide y se sirve en uno de tres
estados. La forma es fija, para que resista la paráfrasis:

| Estado | Cómo se sirve | Ejemplo con cifras del demo |
|---|---|---|
| **Ocurre** | «El oficio mira X en [sector]. En esta empresa **está ocurriendo**: [cuenta] [cifra] contra [referencia] (medido). No implica: …» | «El oficio mira la carga comercial de la cuenta mayor cuando está bajo el benchmark. Está ocurriendo: Lider 9,8 % de su venta contra 5,1 % del promedio de las otras 13. No implica que sea la causa del margen.» |
| **No ocurre** | «El oficio mira X. ADI lo midió y **no está ocurriendo**: [cifra] contra [referencia]. Esto no excluye: …» | «El oficio mira si la cuenta pesa más en el vencido que en la venta. En Falabella no está ocurriendo: 10 % del vencido contra 14 % de la venta. Esto no excluye vencido documental en facturas puntuales.» |
| **No se puede saber** | «El oficio mira X. **Con estos datos no se puede saber**: falta [dato]. Lo resolvería: [cálculo o pregunta].» | «El oficio mira si el margen bajo de una cadena es rappel anual. No se puede saber: no hay carga por mes. Lo resuelve usted: ¿hay rappel pactado con Lider?» |

**Tres cosas que no cambian:** la conclusión del procedimiento es idéntica con la capa encendida o apagada · la
pieza tiene por sujeto al sector, la medición a la empresa, y la frase puente la escribe la casa · «no ocurre» nunca
se convierte en «está bien»: dice que *esa* hipótesis no se sostiene con *esa* cifra.

---

## 2 · Las 27 revisadas contra el filtro nuevo

| Veredicto | Piezas | Por qué |
|---|---|---|
| **Mejoran: traen su medición con lo que el motor ya calcula** (6) | CAU-01 · CAU-06 · CAU-03 · RSG-06 · MOV-05 · PRI-04* | Su cálculo existe (*PRI-04 necesita una razón entre dos cifras que ya están). |
| **Sobreviven: pertinencia medible hoy, medición cuando llegue el dato** (11) | PRI-01 · RSG-03 · RSG-04 · RSG-05 · CAU-02 · CAU-04 · CAU-05 · MOV-01 · MOV-02 · MOV-03 · MOV-06 | Se encienden con señales que el Core ya tiene; su veredicto hoy es «no se puede saber» con el motivo, o depende de que el usuario confirme qué clientes son cadenas. |
| **Sobreviven en espera de casilla** (5) | IMP-01 · IMP-02 · IMP-03 · IMP-04 · IMP-05 | Pertinentes por señal o por pregunta; sin el número de ustedes (o sin el mapa confirmado) no se sirven. |
| **Se van: el oficio lo diría, ADI no puede medirlo** (5) | RSG-01 · RSG-02 · PRI-02 · PRI-03 · MOV-07 | RSG-01 (calendario) necesita serie mensual que no existe. RSG-02 (riesgo binario de cadena) no es medible por naturaleza. PRI-02 y PRI-03 no tenían medición propia: su parte medible ya vive en CAU-03 y CAU-05, donde quedan como orientación. MOV-07 (acuerdo inscrito, Sello ProPyme) es información sin cifra. |

**Resultado: 22 piezas. Hoy, sin ningún trabajo de motor ni de datos, 6 sirven con cifra y 11 sirven como «no se
puede saber» honesto.** Con la tabla de señales y los cuatro derivados baratos (§4), pasan a medir 12. Con la sesión
de ustedes (casillas + qué clientes son cadenas), 20. Las dos restantes esperan datos de ingesta (cliente × SKU,
abonos por factura).

Ser duro con esto era el encargo: **el filtro deja afuera 5 y deja "mudas" 16 hasta que llegue un cálculo o un
número.** Es un resultado, y es el correcto: el valor de la capa es exactamente el valor de lo que puede medir.

---

## 3 · Las 22 piezas, con su pertinencia y su medición

Formato: **enunciado** · etiqueta · grado · **se enciende cuando** (señal del Core) · **ADI mide** · **hoy puede
decir** · no implica / no excluye. Alcance por defecto: `distribucion` · `durable` · `cuentas_grandes` · `CL` ·
`Micro`+`Pequeña`.

### Impacto económico (con qué comparar)

**IMP-01 · Margen de contribución usual por tipo de cuenta** · (B) · casa
«En distribución de durables a cadenas en Chile, el margen de contribución usual en cuenta cadena está entre [__] y
[__] %; en comercios, entre [__] y [__] %.»
Se enciende cuando: una cuenta está bajo su benchmark declarado, **o** la pregunta es sobre margen.
ADI mide: margen de la cuenta contra el rango del sector. Decisivo.
Hoy puede decir: nada (casilla vacía). Con casilla: los tres estados.
No implica: «no es un objetivo suyo; estar fuera del rango no es pérdida».

**IMP-02 · Carga comercial usual en cuentas cadena** · (B) · casa
«En distribución a cadenas en Chile, la carga comercial (convenio, rappel, aporte publicitario, descuento logístico,
devoluciones) suele sumar entre [__] y [__] % de la venta de la cuenta; con comercios, entre [__] y [__] %.»
Se enciende cuando: la cuenta está en el conjunto «carga alta» del detector, **o** la pregunta es sobre carga.
ADI mide: carga % de la cuenta contra el rango. Decisivo.
Hoy: nada. Con casilla: tres estados.
No implica: «una carga sobre el rango no implica que sea evitable».

**IMP-03 · Plazo real de pago por cadena** · (A+B) · casa (la ley: establecido)
«En Chile la ley fija 30 días por defecto; un plazo mayor exige acuerdo escrito e inscrito. Cada cadena paga en su
calendario: [tabla cadena → días].»
Se enciende cuando: cuenta cadena con vencido, **o** pregunta sobre plazos.
ADI mide: días de cobro de la cuenta contra la tabla (si el motor los calcula) o vencido por tramo contra el plazo.
Hoy: nada. Con casilla + verificación del cálculo de días: tres estados.
No implica: «pagar después de la tabla no es morosidad: puede haber acuerdo o factura retenida».

**IMP-04 · Qué parte del vencido con cadenas es documental** · (B/C) · casa
«En distribución a cadenas en Chile, una parte usual del vencido con una cadena —[__] a [__] %— es factura rechazada,
retenida o descuento pendiente de nota de crédito, no impago.»
Se enciende cuando: cuenta cadena con vencido.
ADI mide: vencido de tramo corto ÷ vencido total de la cuenta, contra el rango. No decisivo (el tramo es indicio).
Hoy: nada. Con casilla: «ocurre» / «no se puede saber»; nunca «no ocurre» (no es decisivo).
No implica: «no implica que el vencido de esta cuenta sea documental: se concilia».

**IMP-05 · Mapa de grupos del retail chileno** · (A+B) · establecido
«Lider, Express y Central Mayorista (Walmart Chile) · Jumbo, Santa Isabel, Paris, Easy (Cencosud) · Falabella,
Sodimac, Tottus (Falabella) · Unimarc, Alvi, Mayorista 10 (SMU) · Ripley · La Polar · Hites · abcdin. La
concentración por grupo puede superar la concentración por cliente.»
Se enciende cuando: la cartera tiene dos o más clientes del mismo grupo (confirmado por el usuario).
ADI mide: participación por grupo contra participación por cliente; ocurre si el orden por grupo difiere del orden
por cliente. Decisivo.
Hoy: nada (falta confirmación). Con confirmación: tres estados. En el demo: Grupo Falabella (Falabella + Tottus)
MM$ 24,0 supera a Lider MM$ 21,5 → **ocurre**.
No implica: «no implica compra centralizada ni negociación conjunta».

### Prioridades (qué agrava, sin cambiar el orden)

**PRI-01 · Margen bajo + vencido alto en la misma cadena pueden ser UN problema** · (C) · usual
«Cuando una cadena descuenta en el pago y el proveedor no registró la nota de crédito, el mismo dinero aparece como
vencido y como margen que ya no existe. Coincidir margen bajo y vencido en una cadena agrava el diagnóstico de
margen, no el de cobranza.»
Se enciende cuando: la misma cuenta cadena está bajo el benchmark **y** tiene vencido.
ADI mide: (1) la coincidencia, con las dos cifras — existe; (2) la hipótesis (descuentos sin NC) — requiere abonos
por factura (CAU-04).
Hoy: «la coincidencia ocurre: Lider 12,0 % y MM$ 1,6 vencido; si son un solo problema, no se puede saber: faltan
abonos por factura».
No implica: «no implica que el vencido sean descuentos».

**PRI-04 · Exposición no es participación** · (B) · establecido
«La participación de una cuenta en la venta y su participación en el vencido son dos cifras distintas. La segunda
mide la exposición.»
Se enciende cuando: la cuenta tiene vencido **y** está nombrada en la Respuesta.
ADI mide: participación en vencido contra participación en venta, por cuenta. Decisivo.
Hoy (con la razón de dos cifras existentes): **Lider ocurre (41 % vs 22 %) · Cencosud ocurre (18 % vs 11 %) ·
Falabella no ocurre (10 % vs 14 %) · Tottus no ocurre (8 % vs 10 %)**.
No excluye: «vencido documental en facturas puntuales; que la diferencia sea plazo pactado».

### Riesgos (qué esperar, con condición)

**RSG-03 · Las devoluciones por garantía llegan con rezago** · (A+B) · ley / usual
«En Chile la garantía legal de un durable es de seis meses. La cadena devuelve el producto fallado con notas de
crédito meses después. Un margen acumulado a fecha intermedia no incluye las devoluciones de esas ventas.»
Se enciende cuando: el período es acumulado abierto (menos de doce meses cerrados) **y** hay cuentas bajo benchmark.
ADI mide: participación de devoluciones en la carga de la cuenta, si el archivo las separa. No decisivo.
Hoy: «no se puede saber: el archivo no separa devoluciones dentro de la carga».
No implica: «no implica sobreestimación de un monto conocido».

**RSG-04 · El rappel anual se devenga en otro momento que la venta** · (B) · usual
«Con cadenas es usual un rappel anual que se liquida al cierre o con la nota de débito de la cadena. Un margen
acumulado lo incluye completo, en parte o nada, según cómo esté registrado.»
Se enciende cuando: cuenta cadena bajo el benchmark, período abierto.
ADI mide: carga de la cuenta por mes, si hay serie. Decisivo si hay serie.
Hoy: «no se puede saber: no hay carga por mes. Lo resuelve usted: ¿hay rappel pactado con esa cuenta?»
No implica: «no implica que el margen bajo sea por rappel».

**RSG-05 · En un importador los días de inventario se leen con el lote** · (C) · usual
«Un distribuidor de durables importa por contenedor. Un SKU con muchos días en la foto puede ser un lote recién
recibido. Sin fecha de recepción, los días no distinguen los dos casos.»
Se enciende cuando: hay SKU frenados en la foto.
ADI mide: nada posible (hueco verificado: sin recepciones).
Hoy: siempre «no se puede saber: el archivo no trae recepciones; lo resolvería la fecha de recepción por SKU».
Esta pieza existe para impedir la conclusión fácil, y su estado honesto es el tercero.
No implica: «no implica que el stock frenado sea lote fresco».

**RSG-06 · El stock de cobertura es costo de la relación con la cadena** · (C) · usual
«Las cadenas exigen nivel de servicio y multan la entrega incompleta. Parte del capital frenado en un distribuidor a
cadenas es cobertura, no error de compra; liquidarlo puede costar más que mantenerlo.»
Se enciende cuando: hay SKU frenados.
ADI mide: cruce SKU frenado × ranking de venta (existe). Decisivo para la partición, no para el motivo.
Hoy: «ocurre en [n] SKU (frenados y entre los más vendidos: cobertura); no ocurre en [m] (sin venta: exceso)».
No implica: «no implica que la cobertura sea exigida por la cadena: lo confirma usted».

### Causalidad demostrable (dónde buscar la evidencia)

**CAU-01 · Margen bajo en cadena → la carga de esa cuenta contra el resto** · (B) · usual
Se enciende cuando: cuenta bajo el benchmark. ADI mide: carga % de la cuenta contra el promedio de las demás
(existe). Decisivo para «la carga explica parte»; no para «es la causa».
Hoy: **Lider ocurre (9,8 % vs 5,1 %)**; Cencosud: [cifra del motor] → ocurre o no ocurre.
No afirma: la causa. No excluye: descuentos aplicados en el pago sin registrar (CAU-04).

**CAU-02 · Margen bajo con carga normal → el mix de SKU vendido a la cuenta** · (B) · usual
Se enciende cuando: cuenta bajo el benchmark **y** CAU-01 dio «no ocurre». ADI mide: margen por SKU dentro de la
cuenta contra el mismo SKU en el resto. Requiere cliente × SKU (no está en el demo).
Hoy: «no se puede saber: el archivo no trae venta por cliente y producto».
No afirma: que el mix sea la causa.

**CAU-03 · Vencido alto en cadena → la antigüedad dice si es documento o disputa** · (B) · usual
(Absorbe a PRI-02 como orientación: el vencido de una cadena suele ser operacional; el de un comercio, crédito.)
Se enciende cuando: cuenta con vencido nombrada en la Respuesta. ADI mide: vencido por tramo de antigüedad
(existe) y facturas por tramo (requiere filas por factura). Decisivo para la distribución; no para la causa.
Hoy: «Lider: [vencido por tramo, cifras del motor]».
No afirma: cuál de los dos es.

**CAU-04 · Saldo residual tras abono → descuento sin nota de crédito** · (C+B) · usual
Se enciende cuando: cuenta cadena con vencido. ADI mide: facturas con residuo pequeño respecto del total, por cuenta.
Requiere abonos por factura (verificar grano de la hoja Abonos). Decisivo para el patrón.
Hoy: «no se puede saber: faltan abonos por factura».
No afirma: que el residuo sea descuento.

**CAU-05 · Caída de venta en cadena → ¿unidades o precio?** · (A+B) · usual
(Absorbe a PRI-03 como orientación: causas usuales del sector: SKU descodificados, cambio de locales, menos despacho.)
Se enciende cuando: variación interanual negativa de venta en una cuenta (existe). ADI mide: variación de unidades
contra variación de venta. Requiere unidades del año anterior (verificar).
Hoy: «Falabella −12 %: no se puede saber si es unidades o precio: faltan unidades del año anterior. Pregunta al
equipo: ¿hubo SKU descodificados?»
No afirma: la causa.

**CAU-06 · SKU frenado → ¿cobertura o exceso?** · (B) · usual
Se enciende cuando: SKU frenado. ADI mide: posición del SKU en el ranking de venta (existe). Decisivo.
Hoy: tres estados por SKU, agregados: «[n] cobertura · [m] exceso · [k] sin dato de venta».
No afirma: por qué se frenó.

### Siguiente movimiento (opción con contraindicación)

Para esta clase los tres estados significan: **opción abierta** (la condición se cumple, con cifra) · **opción
contraindicada** (la contraindicación está presente, con cifra) · **no evaluable** (falta el dato).

**MOV-01 · Mirar el portal de proveedores antes de gestionar cobranza** · (A) · usual
Se enciende cuando: cuenta cadena con vencido. Condición medida: el vencido de la cuenta (existe). Contraindicación:
cuenta sin portal (comercio).
Hoy: requiere saber que la cuenta es cadena → «no evaluable» hasta la confirmación.

**MOV-02 · Conciliar descuentos y emitir las NC pendientes antes de renegociar** · (C) · usual
Se enciende cuando: PRI-01 encendida. Condición medida: vencido ÷ pendiente de la cuenta (existe). Contraindicación:
vencido marginal frente al pendiente.
Hoy: «opción abierta para Lider: vencido MM$ 1,6 sobre pendiente [cifra del motor]» (tras confirmar que es cadena).

**MOV-03 · Factoring o pronto pago sobre facturas de cadenas aceptadas** · (A+B) · usual
Se enciende cuando: pendiente no vencido en cuentas cadena. Condición medida: pendiente no vencido por cuenta
(existe). Contraindicación: costo contra contribución de la cuenta → requiere tasa declarada.
Hoy: «opción abierta sobre [pendiente no vencido]; su costo no se puede saber sin tasa: va a "Qué más puedo calcular"».

**MOV-04 · Cambiar el mix ofrecido, no el precio** · (C+B) · usual
Se enciende cuando: CAU-02 «ocurre». Contraindicación: retirar un SKU de la cadena es casi irreversible.
Hoy: «no evaluable: depende de CAU-02 (cliente × SKU)».

**MOV-05 · Liquidar el exceso por un canal que la cadena no vea como competencia** · (A+C) · usual
Se enciende cuando: CAU-06 marca SKU en exceso. Condición medida: los [m] SKU sin venta y su capital (existe).
Contraindicación medida: los [n] de cobertura, que no se tocan.
Hoy: **los dos estados con cifra**, sin dato nuevo.

**MOV-06 · La vía legal por mora existe, y con una cadena no se usa** · (C) · usual / ley
Se enciende cuando: vencido en comercios. Condición medida: vencido de comercios vs vencido de cadenas (tras
confirmación de contraparte). Contraindicación: aplicarla a cadenas.
Hoy: «no evaluable» hasta saber qué cuentas son cadenas. Con eso: «opción abierta sobre MM$ [x] de comercios;
contraindicada sobre MM$ [y] de cadenas».

---

## 4 · Tres ejemplos, antes y después, con la regla nueva

Cifras del demo (`_ADI_LLMBUSINESS_PLAN.md` §7). Las participaciones son dos cifras de ese ejemplo divididas (1,6 ÷
3,9; 21,5 ÷ 98,4): las «tentaciones precalculadas». Lo que el motor calcularía y no está en el ejemplo va entre
corchetes: **no lo invento**.

### Ejemplo 1 · «¿Dónde estoy perdiendo plata?»

| | **HOY, sin la capa** | **CON la capa y la regla nueva** |
|---|---|---|
| **Respuesta** | Lider: MM$ 21,5 de venta, 12,0 % contra 28 %; brecha estimada MM$ 3,4 (71 % de MM$ 4,8). Segundo Cencosud, MM$ 0,7. Carga alta explica MM$ 0,6 en 6 cuentas; MM$ 4,2 precio y costo. Aparte: MM$ 3,9 vencidos, MM$ 1,18 inmovilizados. | **Idéntica.** |
| **Referencia del oficio, con veredicto** | Vacía. | **CAU-01 · Lider · ocurre.** «El oficio mira primero la carga de una cuenta mayor bajo el benchmark. Está ocurriendo: 9,8 % de su venta contra 5,1 % del promedio de las otras 13 (medido). No implica que sea la causa del margen; no excluye descuentos aplicados en el pago sin registrar.» · **CAU-01 · Cencosud · [según cifra del motor]:** si su carga está en línea con el resto → «**no está ocurriendo**: [c %] contra [p %]. Esto no excluye el mix (CAU-02), que con estos datos no se puede medir». · **PRI-01 · Lider · la coincidencia ocurre:** «margen 12,0 % y vencido MM$ 1,6 en la misma cadena. El oficio dice que pueden ser un solo problema (descuentos sin nota de crédito). Si lo son, no se puede saber: faltan abonos por factura.» · **RSG-04 · no se puede saber:** «si el 12,0 % incluye un rappel anual, no hay carga por mes. Lo resuelve usted.» · **RSG-03 · no se puede saber:** «el margen enero–agosto no incluye devoluciones por garantía de esas ventas (seis meses en Chile); el archivo no las separa.» |
| **Lo que no se sirve, y por qué** | — | CAU-01 para Falabella y La Polar: **no pertinente** (están sobre el benchmark). IMP-01, IMP-02: casilla vacía. CAU-02: encendida solo si CAU-01 de Cencosud da «no ocurre», y aun así «no se puede saber». |
| **Para su juicio** | Genérico. | La pregunta de RSG-04 · la opción MOV-02: «conciliar los descuentos de Lider antes de renegociar; abierta si Lider es cadena (confirme en la Ficha); contraindicada si su vencido fuera marginal frente a su pendiente: [cifra]». |
| **Qué más puedo calcular** | Igual. | Más: costo del capital retenido en Lider con tasa declarada (MOV-03). |

**Lo que gana:** una hipótesis confirmada con cifra (Lider), posiblemente una descartada con cifra (Cencosud), dos
que no se pueden saber y por qué, y qué no se sirvió porque no venía al caso.

### Ejemplo 2 · «¿Quién me debe más?» — con una hipótesis del oficio DESCARTADA con cifra

| | **HOY, sin la capa** | **CON la capa y la regla nueva** |
|---|---|---|
| **Respuesta** | Al 31 de agosto: Lider MM$ 1,6; Cencosud 0,7; Falabella 0,4; Tottus 0,3; otros 9 clientes 0,9. Total MM$ 3,9 en 9 clientes. | **Idéntica. Lider sigue primero.** |
| **Cifras** | Tabla de vencido y pendiente por cliente. | La misma **más** la fila de PRI-04 por cuenta nombrada: participación en venta / en vencido: Lider 22 % / 41 % · Cencosud 11 % / 18 % · Falabella 14 % / 10 % · Tottus 10 % / 8 % · La Polar 6 % / 0 %. Dos universos, no se suman. |
| **Referencia del oficio, con veredicto** | Vacía. | **PRI-04 · Lider · ocurre:** «El oficio mira si una cuenta pesa más en el vencido que en la venta: esa es su exposición. En Lider está ocurriendo: 41 % del vencido contra 22 % de la venta.» · **PRI-04 · Cencosud · ocurre:** «18 % contra 11 %.» · **PRI-04 · Falabella · NO ocurre:** «ADI lo midió: 10 % del vencido contra 14 % de la venta. Falabella pesa menos en el vencido que en la venta. Esto no excluye facturas puntuales retenidas; no implica que esté al día (debe MM$ 0,4).» · **PRI-04 · Tottus · NO ocurre:** «8 % contra 10 %.» · **CAU-03 · Lider:** «el oficio mira la antigudad para saber si es documento o disputa: [vencido por tramo, cifras del motor]. Orientación: en cadenas suele ser operacional; en comercios, crédito. Cuál es, no lo afirma.» |
| **Lo que no se sirve** | — | IMP-03, IMP-04: casilla vacía. MOV-01, MOV-06: no evaluables hasta confirmar qué cuentas son cadenas. |
| **Para su juicio** | Genérico. | «Lider concentra la exposición; el oficio la resuelve primero por conciliación (MOV-02, abierta si es cadena). Los MM$ 0,9 de los otros 9 clientes son, por orientación del oficio, el riesgo de crédito real; ADI no puede medirlo sin saber cuáles son comercios.» |

**Lo que gana:** la ordenación por monto no cambió, pero dos cuentas quedaron **descartadas como problema de
exposición con su cifra**. Un GPT sin ADI puede decir «revise si alguna cuenta pesa más en el vencido que en la
venta». No puede decir «Falabella no».

### Ejemplo 3 · «¿Qué debería preocuparme primero?»

| | **HOY, sin la capa** | **CON la capa y la regla nueva** |
|---|---|---|
| **Respuesta** | Prioridad por riesgo integrado: Lider (brecha MM$ 3,4 y vencido MM$ 1,6). Por contribución, Falabella iría primera. Falabella cae −12 %, única variación. MM$ 1,18 inmovilizados en 37 SKU. | **Idéntica, con el mismo criterio declarado.** |
| **Referencia del oficio, con veredicto** | Vacía. | **PRI-01 · Lider · la coincidencia ocurre** (12,0 % y MM$ 1,6); si son un solo problema, no se puede saber. · **PRI-04 · Lider · ocurre** (41 % vs 22 %). · **CAU-05 · Falabella · no se puede saber:** «el oficio pregunta si la caída es en unidades o en precio; faltan unidades del año anterior. Causas usuales del sector: SKU descodificados, cambio de locales, menos despacho. Pregunta al equipo: ¿hubo SKU descodificados?» · **CAU-06 · inventario · medido:** «de los 37 SKU inmovilizados, [n] están entre los más vendidos (cobertura) y [m] no registran venta (exceso): MM$ [x] y MM$ [y]». · **RSG-06:** «el oficio dice que la cobertura es costo de la relación con la cadena, no error de compra; que la cadena la exija, no se puede saber: lo confirma usted». · **RSG-05 · no se puede saber:** «los días de inventario de los [m] en exceso no distinguen un lote recién importado; sin recepciones». |
| **Lo que no se sirve** | — | CAU-01 para Falabella: no pertinente (31 % sobre el benchmark). IMP-*: casilla vacía. |
| **Para su juicio** | Genérico. | MOV-02 (conciliar antes de renegociar) · MOV-05: «liquidar solo los [m] SKU en exceso (MM$ [y]) y por un canal que la cadena no vea como competencia de precio; contraindicada sobre los [n] de cobertura (MM$ [x])». |

**Lo que gana:** el mismo orden, pero con el inventario partido en dos con cifra (una hipótesis confirmada y otra
descartada por SKU), la pregunta correcta para Falabella y el primer movimiento correcto.

---

## 5 · ¿Está sobrevalorado el segundo veredicto? Respuesta directa

**No, con dos condiciones que si no se cumplen lo vuelven peligroso.**

1. **Solo cuando la medición decide.** «La carga de Cencosud está en línea con el resto» descarta que la carga
   explique su margen. «El vencido de Lider está en tramo corto» **no** descarta una disputa: solo la hace menos
   probable. Si ADI dijera «no está ocurriendo» en el segundo caso, daría tranquilidad falsa con sello de oficio.
   Por eso cada pieza declara si su cálculo es decisivo, y solo las decisivas pueden dar «no ocurre». Las demás dan
   «ocurre» o «no se puede saber».
2. **Solo sobre hipótesis que alguien iba a levantar.** Descartar 15 cosas que nadie sospechaba es ruido. La
   pertinencia lo evita: «no ocurre» se dice sobre la cuenta bajo benchmark, no sobre toda la cartera.

Con esas dos, el segundo veredicto es la ventaja más nítida de la capa, por tres razones: un GPT no puede producirlo
de ninguna forma · es lo que evita que el usuario (o el anfitrión) persiga la hipótesis genérica · y **es lo que
llena la capa en una empresa sana** (§6). Un matiz honesto: un GPT que reciba la Entrega sí podría formular el
descarte, porque la cifra viene en ella. La ventaja es de ADI que la calculó, no de la redacción; eso es exactamente
lo que el plan quiere.

## 6 · El riesgo de la capa vacía en una empresa sana, y qué haría

**Pasa, y en parte es correcto.** Si ninguna cuenta está bajo su benchmark, ninguna tiene vencido y ningún SKU está
frenado, las 22 piezas se apagan por pertinencia. Y ese silencio es más honesto que rellenar con «los distribuidores
suelen tener márgenes bajos».

**Pero el usuario sano también quiere contexto, y hay tres formas de dárselo sin ruido:**

1. **La pregunta enciende pertinencia.** Si pregunta «¿está bien mi margen?», IMP-01 se enciende aunque no haya
   desviación, y responde con cifra: «el oficio mira el margen contra el rango del sector: 24 % está dentro de [__] y
   [__] %». Es el segundo veredicto trabajando a favor.
2. **El recuento de lo revisado.** En vez de silencio, una línea: «De las 7 cosas que el oficio mira en distribución
   a cadenas, ADI pudo medir 6 en su archivo: ninguna está ocurriendo. La séptima (rappel) no se puede saber sin
   carga por mes.» Eso es contexto con cifra, y es lo que un controller le diría a su gerente en un mes tranquilo.
3. **Las piezas de riesgo con condición de calendario o período** (período abierto, foto en la temporada) siguen
   encendidas en una empresa sana, porque su pertinencia no depende de una desviación sino del momento.

**Lo que no haría:** bajar el filtro para que "algo salga". Una pieza servida sin pertinencia es el relleno que el
owner rechazó en el primer encargo.

## 7 · Lo que necesitan el owner y su socio (sin cambios)

Una sesión, once preguntas. Números: margen normal por tipo de cuenta · convenios por cadena y su % · días reales
por cadena · partición del vencido con cadenas (rechazada / descuento sin NC / impago) · tasa de factoring.
Prácticas: qué pasa tras un descuento en el pago · si cobraron mora alguna vez · multas por fill rate y stock de
cobertura · cómo registran el rappel · liquidaciones por otro canal. Identidad: **cuáles clientes son cadenas y de qué
grupo** (habilita 8 piezas). Cierre: ¿cuál pieza les hizo pensar «eso no es así»?

---

# PARTE B · nota técnica

## 1 · El campo de pertinencia: vocabulario y evaluación

**Principio:** la pertinencia se evalúa contra el **libro de hechos del turno** (Notario v3: hechos tipados con id),
nunca contra prosa. **La pieza no trae umbrales:** solo lee veredictos que el Core ya emitió (estados, conjuntos,
rankings, signos de variación, ausencias) y relaciones de orden entre dos hechos. Una pieza puede parametrizar **su
propio alcance** (meses, tipo de producto) pero nunca **qué cuenta como alto o bajo**.

### Sujetos
`cuenta` · `sku` · `grupo` · `cartera` · `inventario` · `cobranza` · `periodo` · `foto` · `pregunta`

### Predicados atómicos (lista cerrada v0; cada uno mapea a un hecho o conjunto que el Core publica)

| Predicado | Fuente en el Core | Existe hoy |
|---|---|---|
| `cuenta.bajo_benchmark` | `marginRead` (brecha > 0 vs benchmark declarado) | sí |
| `cuenta.carga_alta` | conjunto del detector `diagnose` (`datoProyectado.conjuntos`) | sí |
| `cuenta.carga_sobre_resto` | carga % cuenta > promedio del resto | sí (cifra), publicar como predicado |
| `cuenta.vencido_positivo` / `cuenta.al_dia` | `cobranza`, estado «al día» = vencido 0 (`estados.js`) | sí |
| `cuenta.variacion_venta ∈ {neg, pos, sin_serie}` | variación interanual por cliente | sí |
| `cuenta.en_respuesta` | entidades nombradas por la conclusión del procedimiento | sí (implícito), publicar |
| `cuenta.prioridad_primera` | `prioridadIntegrada` | sí |
| `cuenta.contraparte ∈ {cadena, comercio, publico, null}` | Ficha (confirmación del usuario) | **no** |
| `cuenta.grupo` | Ficha + mapa IMP-05 | **no** |
| `sku.estado ∈ {estados de la Mesa Capital}` | `inventoryStatus` | sí |
| `sku.top_seller` | `top_sellers` | sí |
| `cartera.tiene(contraparte)` | derivado de `cuenta.contraparte` | no |
| `periodo.abierto` | `periodo_actual` < 12 meses cerrados | sí (hoja Empresa) |
| `foto.mes` | fecha de la foto de inventario/cobranza | sí |
| `falta(insumo)` | ausencias como hechos (plan §4 etapa 2) | parcial |
| `pregunta.tema ∈ {comercial, cobranza, inventario, prioridad}` · `pregunta.metrica` | contrato de dominios / partes del encargo | sí |

### Relaciones entre dos hechos (sin umbral)
`mayor(a, b)` · `menor(a, b)` · `coincide(cuenta, p1, p2)` (dos predicados en la misma entidad) · `rank_difiere(u1, u2)`.

### Composición
`todo: [...]` (∧) · `alguno: [...]` (∨) · `no: {...}`. Sin aritmética, sin literales numéricos. Un validador de
esquema rechaza cualquier pieza con un número dentro de `pertinencia`.

### Evaluación
```
evaluarPertinencia(pieza, libro, perfil, pregunta) → { pertinente: bool, entidades: [...], motivo }
```
Función pura. Devuelve **las entidades** sobre las que la pieza se enciende (por ejemplo, las cuentas bajo
benchmark), no solo un booleano. El compositor acota esas entidades a las que la Respuesta nombra, más un
agregado («y en 4 cuentas más del conjunto») cuando sobran.

## 2 · El campo de medición: los tres estados

```json
"medicion": {
  "calculo": "cargaCuentaVsResto",
  "existe_en_motor": true,
  "por_entidad": "cuenta",
  "comparador": "mayor",
  "referencia": "promedio_resto",
  "decisivo": true,
  "no_excluye": "descuentos aplicados en el pago sin registrar (CAU-04)",
  "insumos": ["carga por cuenta", "venta por cuenta"]
}
```

```
medir(pieza, entidad, libro) → { estado: "ocurre" | "no_ocurre" | "indeterminable", cifra, referencia, motivo, hechos: [ids] }
```
Reglas duras:
- `indeterminable` si falta cualquier insumo o si `existe_en_motor: false`. El `motivo` nombra el insumo y el
  campo `resolveria` dice qué cálculo o qué pregunta lo cerraría.
- `no_ocurre` **solo si `decisivo: true`**. Si `decisivo: false` y el comparador da falso → `indeterminable` con
  motivo «la cifra disponible no decide».
- Toda cifra servida es un hecho del libro con id: la pieza no calcula, **pide** el cálculo por nombre y el motor lo
  publica como hecho `derivada` antes de componer. **Ningún dígito lo escribe la capa.**
- Para `siguiente_movimiento`: se miden `condicion` y `contraindicacion` por separado; el estado es `abierta` (condición
  ocurre, contraindicación no ocurre), `contraindicada` (contraindicación ocurre) o `no_evaluable`.
- Para `impacto`: `referencia` es el rango de la casilla; `valor: null` → la pieza es `casilla-abierta` y no se evalúa.

Las tres formas de servicio (§1 de la Parte A) son plantillas de la casa con placeholders `{id}`/`{id.campo}`,
iguales a la prosa anclada del Notario v3: la referencia se renderiza, no se redacta.

## 3 · Pertinencia contra cuota: contraste

**La sospecha del coordinador es correcta como principio e incompleta como mecanismo.**

- La cuota (≤ 3 · ≤ 2 · ≤ 2) recorta por número: en una empresa con dos señales serviría tres piezas (una de relleno)
  y en una empresa con doce señales dejaría nueve afuera sin criterio. **Como filtro, es peor.**
- La pertinencia recorta por relevancia. Pero es booleana **por entidad**: en el demo hay 6 cuentas con carga alta,
  9 con vencido y 37 SKU frenados. CAU-03 encendida en 9 cuentas produce 9 mediciones; PRI-04 en 9, otras 9. Sin un
  segundo mecanismo, **la pertinencia inunda en una empresa enferma**, que es cuando más importa la claridad.

**Propuesta: pertinencia como filtro, tres acotadores después, y la cuota solo como tope de tamaño.**
1. **Acotar por entidad:** se sirve la medición sobre las entidades que la Respuesta nombra; el resto se agrega en una
   línea con conteo («y en 4 cuentas más: [suma]»).
2. **Ordenar por valor informativo:** `ocurre` con cifra > `no_ocurre` decisivo > `indeterminable` con resolución
   disponible > `indeterminable` sin resolución; dentro de cada grupo, (C) > (B) > (A).
3. **Deduplicar por hipótesis:** si dos piezas miden la misma cosa (PRI-01 y CAU-04), se sirve una con las dos
   lecturas.
4. **Tope de tamaño de la sección**, por el hueco 6 del plan (los anfitriones cortan): lo que no cabe va a «Qué más
   puedo calcular» con su id, no se pierde. El tope es en caracteres de la sección, no en número de piezas.

## 4 · Qué le exige al motor, ordenado

**A · Existe (la pieza solo lo pide por nombre):** brecha vs benchmark por cliente · carga % por cuenta y promedio del
resto · conjunto «carga alta» · participación en venta y contribución · variación interanual de venta por cliente ·
pendiente / vencido / por vencer / abonado por cliente · vencido por tramo de antigüedad · estados por SKU ·
`top_sellers` × `inventoryStatus` · prioridad integrada con sus señales por entidad · universo de grupos (v2.31 dev,
**verificar estado**).

**B · Derivado barato (funciones puras sobre el pack; el trabajo es publicar, no calcular):**
1. **La tabla de señales por entidad** — el corazón de todo: publicar como predicados tipados lo que el Core ya
   decide (`bajo_benchmark`, `carga_alta`, `vencido_positivo`, `variacion.neg`, `sku.estado`, `top_seller`,
   `en_respuesta`). Es una proyección del libro de hechos, no lógica nueva.
2. `participacionCruzada(cuenta)`: participación en venta / vencido / pendiente. Tres razones.
3. Relaciones de orden entre dos hechos y `coincide(entidad, p1, p2)`.
4. `vencidoSobrePendiente(cuenta)` para la contraindicación de MOV-02.
5. `particionPorContraparte(vencido)` y `participacionPorGrupo` — puras, pero **esperan el tag de la Ficha**.
6. `evaluarPertinencia` y `medir` (§1, §2): dos funciones, un validador de esquema, un gate.

**C · No existe; depende de ingesta o del usuario:** `cliente_es_cadena` y `grupo` (Ficha, confirmación sin
pre-marcar) · cliente × SKU (`clientesPorSku` apagado) · abonos por factura (verificar grano de la hoja Abonos v2) ·
unidades del año anterior (verificar) · serie mensual de carga/margen (`historialMargen` sale vacío del pack) ·
recepciones por SKU (hueco verificado; no se promete) · tasa de financiamiento (pregunta al usuario) · devoluciones
separadas dentro de la carga (verificar plantilla).

**Lo que NO se le pide al motor:** ningún umbral, ninguna lente, ningún cambio en `prioridadIntegrada`, `diagnose` ni
`POLICY`. Candado: la capa importa del motor; el motor nunca importa de la capa.

## 5 · Esquema completo de una pieza (v0.2)

```json
{
  "id": "PRI-04", "version": 2, "tipo": "senal", "alimenta": "prioridades", "etiqueta": ["B"],
  "enunciado": "La participación de una cuenta en la venta y su participación en el vencido son dos cifras distintas. La segunda mide la exposición.",
  "sujeto": "sector",
  "fuente": { "tipo": "principio-del-oficio", "detalle": "controller senior; validación owner + socio pendiente" },
  "alcance": { "sector": ["distribucion"], "tipoProducto": "*", "modeloComercial": ["cuentas_grandes", "comercios"], "pais": "*", "banda": "*" },
  "fecha": "2026-09-23", "vigencia": "2027-09-23", "firma": null, "grado": "establecido",
  "no_implica": "No implica que la cuenta sea mala pagadora: la diferencia puede ser plazo pactado.",
  "pertinencia": { "todo": ["cuenta.vencido_positivo", { "alguno": ["cuenta.en_respuesta", "pregunta.tema = cobranza"] }] },
  "medicion": {
    "calculo": "participacionCruzada", "existe_en_motor": false, "derivado_barato": true,
    "por_entidad": "cuenta", "comparador": "mayor", "lados": ["participacion_vencido", "participacion_venta"],
    "decisivo": true, "no_excluye": "vencido documental en facturas puntuales",
    "insumos": ["vencido por cuenta", "venta por cuenta", "totales"]
  },
  "efecto": { "sobre": "cobranza", "sentido": "agrava", "condicion": "estado = ocurre" },
  "servicio": { "ocurre": "referencia_del_oficio + cifras", "no_ocurre": "referencia_del_oficio", "indeterminable": "para_su_juicio" },
  "estado": "propuesta"
}
```

Campos por clase, además de `pertinencia` y `medicion` (obligatorios en las cinco):
`impacto` → `comparacion {metrica_motor, definicion, unidad, valor|null, universo}` ·
`prioridades` → `efecto {sobre, sentido, condicion}` (sin números; nunca leído por el ordenador) ·
`riesgos` → `expectativa`, `condicion` ·
`causalidad` → `disparador` (= pertinencia), `orientacion`, `no_afirma`, `confirmaria` (= medicion) ·
`siguiente_movimiento` → `opcion`, `condicion {medicion}`, `contraindicacion {medicion}` (obligatoria).

## 6 · Las 22 en tabla

| id | alimenta | etiq. | pertinencia (resumen) | medición | existe | decisivo | hoy dice |
|---|---|---|---|---|---|---|---|
| IMP-01 | impacto | B | bajo_benchmark ∨ pregunta=margen | margen vs rango | casilla | sí | nada |
| IMP-02 | impacto | B | carga_alta ∨ pregunta=carga | carga % vs rango | casilla | sí | nada |
| IMP-03 | impacto | A,B | cadena ∧ vencido ∨ pregunta=plazos | días de cobro vs tabla | casilla + verificar días | sí | nada |
| IMP-04 | impacto | B,C | cadena ∧ vencido | tramo corto ÷ vencido vs rango | casilla | no | nada |
| IMP-05 | impacto | A,B | ≥2 cuentas mismo grupo | rank grupo ≠ rank cliente | tag grupo | sí | nada |
| PRI-01 | prioridades | C | coincide(cuenta, bajo_benchmark, vencido) ∧ cadena | coincidencia (existe) + CAU-04 | parcial | parcial | coincidencia + indeterminable |
| PRI-04 | prioridades | B | vencido ∧ en_respuesta | participación cruzada | derivado | sí | tres estados |
| RSG-03 | riesgos | A,B | periodo.abierto ∧ bajo_benchmark | devoluciones ÷ carga | no (plantilla) | no | indeterminable |
| RSG-04 | riesgos | B | cadena ∧ bajo_benchmark ∧ periodo.abierto | carga por mes | no (serie) | sí | indeterminable + pregunta |
| RSG-05 | riesgos | C | sku.frenado | — (sin recepciones) | no | — | indeterminable |
| RSG-06 | riesgos | C | sku.frenado | frenado × top_seller | sí | partición sí | ocurre/no ocurre por SKU |
| CAU-01 | causalidad | B | bajo_benchmark | carga vs resto | sí | sí | tres estados |
| CAU-02 | causalidad | B | bajo_benchmark ∧ CAU-01=no_ocurre | margen por SKU en cuenta | no (cliente×SKU) | sí | indeterminable |
| CAU-03 | causalidad | B | vencido ∧ en_respuesta | vencido por tramo (+ facturas) | sí (+ filas) | partición sí | ocurre con cifra |
| CAU-04 | causalidad | C,B | cadena ∧ vencido | facturas con residuo | no (grano) | sí | indeterminable |
| CAU-05 | causalidad | A,B | variacion_venta.neg | Δ unidades vs Δ venta | verificar | sí | indeterminable + pregunta |
| CAU-06 | causalidad | B | sku.frenado | posición en ranking | sí | sí | tres estados por SKU |
| MOV-01 | movimiento | A | cadena ∧ vencido | vencido cuenta / contraparte | tag | — | no evaluable |
| MOV-02 | movimiento | C | PRI-01 | vencido ÷ pendiente (contraind.) | derivado | sí | abierta (tras tag) |
| MOV-03 | movimiento | A,B | cadena ∧ pendiente_no_vencido | costo con tasa | tasa | sí | abierta, costo indeterminable |
| MOV-04 | movimiento | C,B | CAU-02=ocurre | — | cliente×SKU | — | no evaluable |
| MOV-05 | movimiento | A,C | CAU-06 | exceso vs cobertura | sí | sí | abierta/contraindicada por SKU |
| MOV-06 | movimiento | C | vencido en comercios | partición por contraparte | tag | sí | no evaluable |

## 7 · Gate propuesto: `_conocimiento_gate` (offline, sobre los 888 libros)

Por libro y por pieza: (1) ninguna pieza servida sin pertinencia verdadera · (2) toda pieza servida tiene estado y,
si `ocurre`/`no_ocurre`, una cifra con id del libro; si `indeterminable`, un motivo con insumo nombrado · (3)
`no_ocurre` solo con `decisivo: true` · (4) la conclusión del procedimiento (prioridad, ranking, cifras de la
Respuesta) es byte-idéntica con la capa encendida y apagada · (5) ninguna pieza con literal numérico en
`pertinencia` ni en `efecto` · (6) `sujeto: sector` y ningún nombre del tenant en `enunciado` (excepción: tipo
`mapa`) · (7) carnadas: pieza con umbral escondido, benchmark con `valor: null`, pieza sin `no_implica`, pieza
`no decisiva` forzada a `no_ocurre`. Métrica de salida por escenario: piezas pertinentes, medidas, descartadas,
indeterminables.

## 8 · Riesgos

- **Falsa tranquilidad.** El `no_ocurre` de una medición no decisiva. Cerrado por regla (§2) y carnada (§7).
- **Inundación en empresa enferma.** Cerrado por acotadores (§3), no por cuota.
- **Umbral disfrazado de pertinencia.** Cerrado por el validador (sin literales numéricos) y por lista cerrada de
  predicados.
- **Inferencia disfrazada.** `cliente_es_cadena` sugiere sin pre-marcar; el usuario confirma. `null` apaga.
- **Prosa que reescribe el estado.** El anfitrión convierte «no ocurre» en «está bien» o «no se puede saber» en
  «no hay problema». Es residuo de canal: la forma fija con título («No está ocurriendo», «No se puede saber») es la
  mitigación, y la etapa 4 lo mide.
- **Piezas (C) sin validar.** No se sirven hasta la firma; v0 puede correr con las (B) puras.
- **Texto legal de memoria** (Ley 21.131, garantía 6 meses, mérito ejecutivo): verificar contra fuente oficial antes
  de firmar IMP-03, RSG-03, MOV-03, MOV-06.
- **Lo que no verifiqué en código:** días de cobro por cliente; grano de Abonos; unidades del año anterior;
  universo de grupos en v2.31; si la plantilla separa devoluciones. Cinco lecturas antes de sembrar.

## 9 · Orden de siembra sugerido

1. Tabla de señales por entidad + `evaluarPertinencia` + `medir` + validador + gate (§4 B1, B6, §7). Sin piezas
   todavía: se prueba con carnadas.
2. Las 6 que miden hoy: CAU-01, CAU-06, CAU-03, RSG-06, MOV-05, PRI-04 (con `participacionCruzada`).
3. Las 5 indeterminables con resolución declarada: RSG-03, RSG-04, RSG-05, CAU-05, MOV-03. Sirven el tercer estado.
4. Sesión con el owner y el socio: casillas (IMP-01..04), mapa confirmado (IMP-05), firma o rechazo de las (C).
5. `cliente_es_cadena` en la Ficha: habilita PRI-01, CAU-04, MOV-01, MOV-02, MOV-06 e IMP-03/04.
6. Cliente × SKU y abonos por factura, cuando la ingesta los traiga: CAU-02, CAU-04, MOV-04.
