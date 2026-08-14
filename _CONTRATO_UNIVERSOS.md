# El contrato de cruce de universos — para la decisión del owner

**Escrito 2026-08-14 a pedido del owner**, antes de implementar nada: *«antes de implementarlo, quiero que me
definas el contrato exacto… no quiero un candado demasiado amplio que mate análisis útil.»*

**Nada de esto es nuevo.** El contrato de universos ya existe (`src/config/contract/figureType.js`) y el muro ya
lo aplica al camino actual (chequeo 17, `cruce-de-universos`, escrito 2026-08-09). Lo que falta es que funcione
también en el camino natural, donde no hay boleta y las cifras no llegan con su universo declarado.

---

## 1 · Qué universos existen (los declara el contrato, no yo)

| Universo | Qué mide | Escala real |
|---|---|---|
| `venta_comercial` | venta, costo, contribución, acciones comerciales | **miles** de USD |
| `inventario` | capital en stock (`stockUSD`) | dólares **crudos** |
| `precio_unitario` | precio de lista, costo medio | USD **por unidad** |
| `resultado_pnl` | líneas del P&L | miles, año cerrado |
| `tasa_comercial` | margen %, carga % | porcentaje |
| `tasa_inventario` | margen de inventario % | porcentaje |
| `rotacion` · `dias_inventario` · `unidades` · `brecha_pp` | ratios, días, conteos, puntos | propios |

## 2 · Qué cruces están PERMITIDOS

Todo lo que el contrato **no** declara divergente. En particular, y esto es lo que hay que proteger:

- **Dentro del mismo universo**: venta contra costo, contribución contra venta, margen contra benchmark,
  capital de un SKU contra capital de otro. Es el 95% del análisis útil.
- **Una tasa aplicada a su propio universo**: margen % sobre venta comercial · rotación sobre inventario.
- **Nombrar dos universos en la misma respuesta, sin relacionarlos**: «La venta del año fue $100.0M. Por
  separado, el inventario de hoy suma $135K.» — legítimo y necesario para un panorama.
- **Enumerar** una entidad con datos de los dos mundos: «SAM-TV55: vende $13.3M · stock 18 unidades ($13K) ·
  58 días de inventario.» — es una ficha, no una afirmación relacional. **El motor mismo emite estas listas.**

## 3 · Qué cruces están PROHIBIDOS

**Solo cuatro pares**, los que el contrato declara divergentes, y **solo cuando se los ata con una relación**:

| Par prohibido | Por qué |
|---|---|
| venta_comercial ↔ inventario | la venta va en miles y el stock en dólares crudos (×1000), y las unidades del mismo SKU difieren 4x–35x |
| venta_comercial ↔ precio_unitario | unidades × precio no cierra contra la venta declarada |
| resultado_pnl ↔ inventario | el P&L es del año cerrado; el inventario es la foto de hoy |
| precio_unitario ↔ inventario | el mismo SKU no trae la misma cantidad en los dos mundos |

**«Atarlos con una relación»** significa: dividir, comparar, cubrir, sostener, «por cada», «equivale a»,
«fracción de», «múltiplo de», «días de cobertura», «proporción», «ratio», «frente a», «versus». La lista ya
existe y está medida (`_CRUCE_RELACIONAL`).

**El caso canónico que esto mata** (medido en 2026-08-09):
> «SAM-TV55 factura $13.3M y sostiene ese volumen con $13K de inventario: menos de un día de cobertura.»
Las dos cifras son verdaderas. La **relación** es basura, y suena a hallazgo.

**El caso que la pre-auditoría del examen encontró abierto en el camino natural:**
> «LG-DRYER8KG tiene $14K de capital inmovilizado y su margen es 11%.»
Capital (inventario) y margen (tasa comercial) del mismo SKU, en una frase. Hoy **pasa**.

## 4 · Cómo se expresa un cruce legítimo

Cuando el usuario pregunta algo que exige mirar los dos mundos, la respuesta correcta **separa y declara**:

> «En venta comercial, SAM-TV55 factura $13.3M al año. Por separado, en la foto de inventario de hoy tiene $13K
> de capital en stock. **No son comparables entre sí**: la venta se mide en miles y el stock en dólares crudos, y
> las unidades declaradas difieren entre las dos fuentes — por eso no puedo darte días de cobertura con este dato.»

Tres rasgos: cada cifra con **su universo nombrado**, **ninguna operación** entre ellas, y el **límite declarado**
cuando el usuario pedía justamente el cruce.

## 5 · El control negativo (lo que el candado NO puede matar)

Si el candado mata alguna de estas, está mal calibrado y se descarta:

| Debe PASAR | Por qué |
|---|---|
| «La venta del año fue $100.0M. Por separado, el inventario suma $135K.» | dos universos nombrados, cero relación |
| «SAM-TV55: vende $13.3M · stock $13K · 58 días de inventario» | ficha enumerada — la emite el propio motor |
| «Falabella vende $19.4M con margen 22.0%, 8.1 puntos bajo el benchmark» | todo dentro del universo comercial |
| «LG-DRYER8KG tiene $14K inmovilizados con rotación 1.0x y 165 días» | todo dentro del universo inventario |
| «No puedo darte cobertura en días de venta: la venta y el inventario no reconcilian en este dato» | el límite declarado |

| Debe MORIR | Por qué |
|---|---|
| «$13.3M sostenidos con $13K: menos de un día de cobertura» | relación entre universos divergentes |
| «El stock es una fracción de su venta» | la misma división, dicha en prosa |
| «LG-DRYER8KG: $14K de capital y su margen es 11%» ligados como causa/efecto | inventario ↔ tasa comercial atados |
| «El inventario de $135K cubre 1.4 meses de la venta anual» | cobertura cruzada |

---

## Lo que costaría implementarlo en el camino natural

**Una pieza, del lado del dato, no del muro**: hoy las cifras de la carpeta (`datoProyectado`) viajan con su
**dueño** pero no con su **universo**. Darles universo es el mismo recorrido que ya las genera —cada sección de
la carpeta sabe de qué universo es— y el chequeo 17, que ya existe y está probado, empezaría a funcionar en el
camino natural sin tocar su lógica.

**Riesgo declarado**: el chequeo 17 exige la construcción relacional, así que su superficie de falso positivo es
angosta por diseño. El riesgo real está en asignar mal el universo a una cifra de la carpeta — se cubre con los
controles negativos de arriba, que van al gate el mismo día.

## La decisión que le corresponde al owner

1. ¿El contrato de arriba es el correcto, o hay algún cruce que él quiera permitir/prohibir distinto?
2. ¿Se implementa antes del examen ejecutivo, o el examen se corre con este hueco declarado y medido?
