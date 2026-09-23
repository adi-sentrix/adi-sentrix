# Fichas de validación · las seis piezas que ya miden

> Material para la sesión de validación de contenido (owner + socio). **Todos los textos de ejemplo son literales: los
> produjo el código corriendo sobre el dato de demostración**, no están redactados para este documento. Donde el código
> no produce algo, está dicho.
>
> **Cómo usar cada ficha:** los campos «qué realidad mira · qué cálculo usa · cómo se ve» los contesta el código y no
> admiten discusión. Los campos «qué conocimiento aporta · para qué empresas · qué fuente necesita» los contestan
> ustedes: ahí está la experiencia que no tenemos.

---

## ⚠️ TRES DEFECTOS QUE HAY QUE DECIDIR ANTES DE FIRMAR

Aparecieron al volcar el texto real. **Cambian qué significa firmar una pieza**, así que van primero.

### 1 · El «no implica» que ustedes escriban NO LLEGA AL USUARIO

El validador **obliga** a que cada pieza declare su negativa propia (`no_implica`) y rechaza la pieza si falta. Pero el
módulo que sirve el texto **nunca lee ese campo**. Lo que se imprime bajo «No implica:» es **otro campo distinto**, que
vive dentro de la medición.

Ejemplo real de CAU-01: la pieza declara *«no implica que la carga sea la causa del margen bajo»*. Lo que el usuario lee
es *«descuentos aplicados en el pago sin registrar»*. **Son dos frases distintas, y la que ustedes firmarían no se
sirve.**

**Consecuencia:** firmar una pieza hoy es firmar una salvaguarda que no existe. Hay que arreglarlo antes de firmar nada.

### 2 · El tope de tamaño descarta piezas pertinentes EN SILENCIO

El comentario del propio módulo afirma que lo que no entra «no se pierde: queda para *Qué más puedo calcular*».
**Verificado con sonda: no es así.** Lo que no entra **se descarta por completo** — no aparece como ítem, ni como línea
con conteo, ni enlazado a ninguna parte.

Ya está ocurriendo: con solo dos cuentas nombradas y seis piezas, el total dio 2.206 caracteres contra un tope de 2.000,
y **CAU-03 desapareció sin dejar rastro** en Falabella y en Lider — donde sí era pertinente y sí tenía algo que decir
(«no se puede saber», con su motivo).

**Es exactamente lo que el proyecto prohíbe:** un recorte que no declara qué recortó. Y con más piezas firmadas, pasaría
más seguido.

### 3 · La línea del recuento se lee mal

Texto literal que produce hoy: *«De las 6 cosas que el oficio mira en un distribuidor, ADI midió 17: 5 están
ocurriendo.»* **Mezcla piezas con mediciones** — seis cosas, diecisiete mediciones. Un ejecutivo lee eso dos veces.

---

## 🟢 CAU-01 · La carga comercial de la cuenta contra el resto

| | |
|---|---|
| **Qué conocimiento aporta** | Cuando una cuenta cadena está bajo el benchmark de margen, el oficio mira primero si su carga comercial —convenio, rappel, aporte publicitario, descuento logístico— pesa más que la del resto de la cartera, antes de tocar precios. |
| **Para qué empresas** | Distribución · Chile · cuentas grandes. *(A confirmar por ustedes: ¿vale igual para un fabricante que le vende a cadenas?)* |
| **Qué realidad mira** | Que la cuenta esté **bajo el benchmark de margen**. En el demo enciende en **8 de 13 cuentas**. |
| **Qué cálculo usa** | `cargaCuentaVsResto` — **existe en el motor**, y cada cifra es un hecho verificado por separado. |
| **Cómo se ve · OCURRE** | *«El oficio mira: cuando una cuenta cadena está bajo el benchmark de margen, el oficio mira primero si su carga comercial pesa más que la del resto de la cartera. **En Falabella está ocurriendo: 4,5 % contra 3,9 %** (promedio de 12 cuentas verificadas, cada una un hecho por separado).»* |
| **Cómo se ve · NO OCURRE** | *«ADI lo midió: **en Jumbo NO está ocurriendo: 3,8 % contra 4,0 %.** Esto no excluye: descuentos aplicados en el pago sin registrar.»* |
| **Resultado real en el demo** | **5 ocurre · 3 no ocurre · 0 sin medir**, sobre 8 cuentas pertinentes. |
| **Por qué GPT solo no lo tendría** | **Fuerte.** GPT puede decir «revise los descuentos de esa cuenta». No puede decir que la carga de Falabella es 4,5 % contra 3,9 % del resto, ni que la de Jumbo **no** lo es. El conocimiento es genérico; **el valor está en la cifra, y la cifra necesita los datos.** |
| **Qué necesita para firmarse** | Confirmar que el orden de revisión es el correcto (carga antes que precio) y si aplica fuera de distribución. **Grado hoy: «usual» — es una afirmación sobre la práctica, no un hecho medido.** |

---

## 🟡 CAU-03 · El vencido repartido por antigüedad

| | |
|---|---|
| **Qué conocimiento aporta** | Cuando una cuenta cadena tiene vencido, el oficio mira **cómo se reparte por antigüedad** antes de decidir si es un problema de cobranza o una disputa puntual. |
| **Para qué empresas** | Distribución · Chile · cuentas grandes. |
| **Qué realidad mira** | Vencido mayor que cero **y** que la cuenta esté nombrada en la Respuesta. |
| **Qué cálculo usa** | `vencidoPorTramoDeAntiguedad` — **NO existe en el motor, y no es un derivado barato.** Confirmado en el código: el dato no trae tramos de antigüedad. |
| **Cómo se ve** | Siempre el tercer estado: *«Con estos datos no se puede saber en Falabella: falta el cálculo. **Lo resolvería:** el vencido por tramo de antigüedad — no existe en este dato.»* |
| **Resultado real en el demo** | **Nunca mide. Siempre «no se puede saber».** Y hoy, además, **se descarta en silencio** por el defecto 2. |
| **Por qué GPT solo no lo tendría** | **Débil hoy.** Lo único que aporta es que ADI **miró y declaró que no puede saberlo**, con el motivo. Eso vale —es honestidad activa, no silencio— pero no es una ventaja de análisis. |
| **Qué necesita para firmarse** | **Nada de ustedes: necesita el dato.** Mi recomendación: **mantenerla sembrada pero sin firmar**, como marcador de lo que falta. El día que la ingesta traiga la antigüedad, se firma y empieza a medir. |

---

## 🟠 CAU-06 · RSG-06 · MOV-05 · Las tres que son la misma medición

**Tres piezas distintas, un solo predicado y un solo cálculo.** Las tres encienden con «SKU frenado» y las tres usan
`skuFrenadoVsTopSeller`. Lo que cambia es la lectura: una pregunta por la causa, otra por el riesgo, otra por el
siguiente movimiento.

| | |
|---|---|
| **Qué conocimiento aporta** | Un SKU frenado no es lo mismo si es de los que más venden —entonces es **stock de cobertura**, el costo de sostener a la cadena— que si no vende —entonces es **exceso real**. La recomendación se invierte según el caso. |
| **Qué realidad mira** | Que el SKU esté frenado. En el demo: **3 de 8** (LG-DRYER8KG, BOS-SANDER, MAK-COMP-AIR). |
| **Qué cálculo usa** | `skuFrenadoVsTopSeller` — **existe en el motor**. |
| **Cómo se ve · NO OCURRE** | *«ADI lo midió: **en LG-DRYER8KG NO está ocurriendo:** fuera de los SKU que más venden. Esto no excluye: que además haya un error de compra dentro del grupo de cobertura.»* |
| **Resultado real en el demo** | Los tres SKU dan **«no ocurre» en las tres piezas**. |
| **Por qué GPT solo no lo tendría** | **El conocimiento es fuerte** —y contradice el prior: GPT diría «liquide el stock parado», que en este sector puede ser la recomendación equivocada. **Pero la ejecución hoy es ruido:** una sola medición produce **tres líneas casi iguales** en la Entrega. |
| **Qué necesita para firmarse** | **Mi recomendación: colapsarlas en una sola pieza con tres lecturas**, no tres piezas. Es la misma medición; que se sirva una vez y diga lo que implica para la causa, el riesgo y la acción. |

---

## 🟢 PRI-04 · Exposición contra participación

| | |
|---|---|
| **Qué conocimiento aporta** | Cuánto pesa una cuenta en lo vencido **no es lo mismo** que cuánto pesa en la venta. Esa diferencia es la exposición real, y ordena la prioridad de cobranza distinto que el monto. |
| **Para qué empresas** | Distribución · Chile · cuentas grandes. **Grado hoy: «establecido en el oficio»** — el más alto de los seis. |
| **Qué realidad mira** | Vencido mayor que cero **y** cuenta nombrada en la Respuesta. |
| **Qué cálculo usa** | `participacionCruzada` — no es una fig del motor, **pero se declara como hecho y el verificador lo comprueba.** ⚠️ Fue justamente acá donde el verificador corrigió una cifra: **36,3 % calculado por la capa contra 36,1 % verificado contra el dato.** |
| **Cómo se ve · OCURRE** | *«**En Lider está ocurriendo: 36,1 % contra 17,8 %** de participación en la venta. No implica: vencido documental en facturas puntuales; que la diferencia sea un plazo pactado.»* |
| **Resultado real en el demo** | **Falabella 19,8 % contra 19,4 % · Lider 36,1 % contra 17,8 %.** Las dos ocurren, con intensidad muy distinta. |
| **Por qué GPT solo no lo tendría** | **La más fuerte de las seis.** GPT diría «priorice a Lider porque debe más». No puede decir que Lider concentra el **doble** de lo vencido que de la venta, ni que Falabella está casi en equilibrio. Es un cambio de criterio, no un adorno. |
| **Qué necesita para firmarse** | Confirmar que la exposición cruzada es criterio suyo de priorización de cobranza, y si tiene un umbral práctico («me preocupa cuando dobla»). **Ese umbral sería del motor, nunca de la pieza.** |

---

## Cómo se ve la sección completa, con los acotadores puestos

Texto real, para la pregunta *«¿dónde estoy perdiendo plata?»*:

> **Referencia del oficio** *(general, no es un dato ni un objetivo tuyo).*
> - *El oficio mira… En **Falabella** está ocurriendo: 4,5 % contra 3,9 %…*
> - *El oficio mira… En **Lider** está ocurriendo: 4,2 % contra 3,9 %…*
> - *La segunda mide la exposición… En **Falabella** está ocurriendo: 19,8 % contra 19,4 %…*
> - *La segunda mide la exposición… En **Lider** está ocurriendo: 36,1 % contra 17,8 %…*
> - *Y en **6 cuentas más** del mismo conjunto: 3 ocurre, 3 no.*
> - *Y en **3 SKU más** del mismo conjunto: 0 ocurre, 3 no.* **(repetida tres veces — defecto de las tres piezas gemelas)**

**Lo que entra:** las dos cuentas que la Respuesta ya nombra, para las dos piezas que miden.
**Lo que se resume:** las otras seis cuentas y los SKU, en una línea con conteo.
**Lo que desaparece sin avisar:** CAU-03 (defecto 2).

---

## Mi veredicto, escrito en contra de las piezas

| Pieza | Veredicto |
|---|---|
| **PRI-04** | **Entra.** La más fuerte. Cambia un criterio, no adorna. |
| **CAU-01** | **Entra**, si ustedes confirman que el orden de revisión es el correcto. |
| **CAU-06 + RSG-06 + MOV-05** | **Se corrigen: una sola pieza, tres lecturas.** El conocimiento es bueno; servirlo tres veces es ruido. |
| **CAU-03** | **No se firma todavía.** No mide nada; es un marcador de lo que falta en el dato. |

**De seis piezas quedan, en rigor, tres.** Prefiero decirlo así antes de la sesión: **una capa con tres piezas que miden
vale más que una con seis que suenan bien.**

---

## Las once preguntas para la sesión

**Números** · margen normal por tipo de cuenta · qué convenios cobra cada cadena y cuánto · días reales de pago por
cadena · de lo vencido con cadenas, cuánto es factura rechazada, cuánto descuento sin nota de crédito y cuánto impago
real · tasa de factoring que usan.

**Prácticas** · qué pasa después de un descuento en el pago · si alguna vez cobraron mora a una cadena · multas por
quiebre de stock · cómo registran el rappel · si liquidan por otro canal.

**Identidad** · **cuáles de sus clientes son cadenas y de qué grupo** — destraba once piezas de golpe.

**Y la de cierre:** ¿cuál de estas piezas les hizo pensar «eso no es así»? Esa es la que más vale.
