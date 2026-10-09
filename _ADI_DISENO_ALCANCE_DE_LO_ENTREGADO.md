# El alcance de lo entregado · propuesta de producto para la frontera ADI ↔ anfitrión (diseño, sin implementar)

> Fable, 2026-10-09 · solo diseño: nada de esto corre ni se commitea. Evidencia: ensayos 9-12 (`scratchpad/ensayo-9..12/clasificacion.md` y
> `transcritos/*.json`), el Contrato del Anfitrión (`_ADI_DISENO_CONTRATO_ANFITRION.md` §1-§3, §10-§17), la medición (`_ADI_DISENO_MEDICION_ANFITRION.md` §6)
> y la forma real de lo que viaja (`src/adi/capacidad/compacto.js`, `acciones.js:CABECERA_DE_USO`, `continuidad/estadoVigente.js`, `continuidad/retomar.js`).

## En corto

1. Los 11 errores materiales del anfitrión en los ensayos 9-12 (1 · 5 · 2 · 3, sobre ~3 900 afirmaciones) **son una sola familia en 9 casos: ADI entregó una verdad correcta y dejó IMPLÍCITO su alcance** (de qué conjunto sale, cuánto cubre, qué orden tiene, qué no establece), y el anfitrión lo completó. Los otros 2 son deslices de lectura con la verdad entera a la vista: ningún cambio de entrega los evita.
2. **Propuesta: que cada lista, tabla y respuesta de ADI lleve su alcance como DATO** (universo · cobertura · selección · orden · resto no evaluado · métricas ordenadas vs. solo mostradas) y que cada respuesta traiga un digesto compacto de **«lo establecido»** en la conversación (universos, órdenes, relaciones, criterios vigentes, estado de la memoria). Nada de frases prohibidas ni de reglas nuevas: la cabecera **baja de 5 a 4 reglas**.
3. `retomar` se arregla: resumen y cambios primero, hechos paginados con «página k de n», nunca más grande que lo que el anfitrión muestra.
4. Impacto honesto: de los 11 errores, 6 muy probablemente no habrían ocurrido (uno ya está cerrado), 3 solo en parte (el anfitrión tenía todo y aun así ordenó mal por su cuenta), 2 no (deslices).
5. Se demuestra con un ensayo pareado A/B (mismo corpus sellado, con y sin el mecanismo) medido por **tasa de sobre-alcance** (toda afirmación más allá de lo entregado, correcta o no: es la forma FRECUENTE de la familia), sobre un corpus de generalización escrito a ciegas para provocar formas que los ensayos 9-12 no tuvieron. Regla de parada incluida.
6. Lo que cuesta: ~150 B por universo y ~1 KB por respuesta, pagados con campos que hoy repiten o confunden; los 532 textos sellados no cambian un byte.

## 1 · La familia: alcance implícito, sobre-completado

| Ensayo · turno | Lo que dijo (resumen) | Lo que ADI había entregado (correcto) | Alcance implícito que el anfitrión completó |
|---|---|---|---|
| 9 · C02 1.3 | «las dos más vendidas: Norvik y Teravolt; Alsen, la tercera» | las 5 marcas completas, tabla ordenada por margen | **ninguno** — tenía las 5 ventas a la vista y las leyó mal (desliz) |
| 10 · B02 1.2 | «LG, 2.7 pp por debajo de Philips» | apoyo E2.e11 rotulado «Philips − Makita = 2.7 pp» | **ninguno** — cifra correcta con el par equivocado (desliz) |
| 10 · A01 1.6 | «las 3 cuentas más grandes son también las 3 de menor margen» | los 13 márgenes (fuera del texto), tabla ordenada por venta | *una tabla ordenada por A parece ordenable por B sin pedirlo*: la relación entre dos órdenes nunca fue evaluada; el anfitrión la armó él |
| 10 · C04 1.3 | la misma afirmación, otro hilo | ídem | ídem |
| 10 · B01 1.5 | «El Roble… la que más crece» | la variación solo de las 5 mayores por venta | *una métrica que acompaña a un top por OTRA métrica parece ordenada sobre el eje*: la variación de las otras 8 no estaba |
| 10 · C01 1.2 | «Falabella es tu mayor cliente en deuda» | la cobranza de Falabella sola (1 de 13) | *una entidad consultada parece el extremo*: nunca se ordenó el eje |
| 11 · C02 1.6 | «con un filtro de días aparecerían El Roble y Maipo» | top 3 por saldo vencido (3 de 13) con sus días | *los días de los 3 parecen los días de todos*: Casa Lomas (281 d) no estaba |
| 11 · A02 1.1 | «le sigue Andes del Sur» | solo el 1.º de la prioridad; un conjunto SIN orden que se leía como orden | *un puesto 1 parece el inicio de un ranking*: el 2.º lo puso el anfitrión (cerrado en §17 del contrato: la prioridad viaja completa y ordenada; 0 fallos en el ensayo 12) |
| 12 · A02 1.5 | «hoy no hay ningún benchmark de margen cargado» | `conocerEmpresa` lista `benchmark` como declarable sin su valor; el 30.1 % solo aparece al consultar margen | *lo que la conversación no ha visto parece lo que la empresa no tiene*: ausencia en la entrega leída como ausencia en el dato |
| 12 · B01 1.5 | «las 2 que más aportan al crecimiento son las 2 que más contribución dejan sin capturar» | las 13 cuentas con ambas métricas, tabla por venta | *tabla completa sin orden declarado*: la relación la armó él y la armó mal (coinciden 1 de 2) |
| 12 · B01 2.7 | «los que sí tienen vencido son: El Roble, Maipo, Casa Lomas» | el filtro «días vencido > 90» (3 de 12) | *un filtro parece el conjunto entero de la condición madre*: Andes del Sur ($5.2M) y Alerce no estaban; y venía de un `retomar` que vio 2 KB de 235 |

**Lectura.** Cada arreglo anterior (regla de superlativos, `coincidencia`, prioridad ordenada, pertenencia a un conjunto) cerró UNA forma y la siguiente apareció con otra palabra, porque todas nacen de lo mismo: **la entrega dice qué ES verdad, pero no dice hasta dónde llega esa verdad**. Un universo trae `parcial: "3 de 13"` (bien), pero no dice que de los otros 10 no se sabe NADA, ni que de las tres métricas de la tabla solo UNA está ordenada sobre el eje. Un modelo de lenguaje rellena lo implícito con lo verosímil: ese es su oficio. La solución no es describirle cada forma de rellenar; es **no dejar nada implícito que valga la pena rellenar**.

Hipótesis del orquestador, contrastadas: (a) *la causa raíz es el alcance implícito* — **se acepta, con un matiz**: en 9 de 11; los 2 deslices (9·C02, 10·B02) no son de alcance y ningún mecanismo de entrega los toca. (b) *un alcance estructural por entrega* — **se acepta y se afina**: hay que declarar el alcance POR MÉTRICA dentro del universo (la trampa más repetida —10·B01, 10·C01, 11·C02— es la métrica que acompaña a un top por otra métrica). (c) *«lo establecido» por conversación* — **se acepta con una ley propia**: el digesto no puede listar nombres parciales sin cobertura; ya lo hizo (`loEntregado` imprime 3 dueños por métrica) y provocó el H-leve 12·B01 2.3 («Mercantil y Bío no estaban»): el índice cayó en la misma familia que quiere prevenir. (d) y (e) se aceptan y se detallan en §4 y §6.

## 2 · El mecanismo: el alcance viaja como dato, al lado de los hechos

Principio único, que gobierna todo lo que sale de ADI hacia un anfitrión: **ninguna lista sin su alcance, ninguna respuesta sin lo establecido**. Alcance = cinco preguntas respondidas como campos, no como prosa de reglas: ¿de qué conjunto sale? · ¿cuánto cubre? · ¿qué regla eligió a estos? · ¿en qué orden están y por qué métrica? · ¿qué pasa con el resto? Lo que ADI no evaluó se dice con un valor (`evaluado: false`), no con silencio: el modelo tiene un objeto que dice «desconocido» donde hoy tiene un hueco.

### 2.1 En cada universo (`entrega.universos[]`)

**Antes** (real, ensayo 11 · C02, Entrega E3; y la forma de todo universo hoy):
```json
{ "id": "E3.u1", "eje": "cliente", "texto": "los 3 de mayor saldo vencido", "n": 3, "parcial": "3 de 13",
  "entidades": ["Mayorista El Roble", "Centro Constructor Maipo", "Supermercados Andes del Sur"] }
```
**Después** (lo nuevo en negrita conceptual; `n` + `parcial` se funden en `cobertura`):
```json
{ "id": "E3.u1", "eje": "cliente", "texto": "los 3 de mayor saldo vencido", "cobertura": "3 de 13",
  "seleccion": { "tipo": "top", "metrica": "Saldo vencido", "direccion": "mayor", "k": 3 },
  "orden": "por Saldo vencido, de mayor a menor, entre estos 3",
  "metricas": { "Saldo vencido": "ordenada sobre los 13: el 1.º es el mayor del eje",
                "Días vencido": "solo de estos 3; el resto no evaluado",
                "Saldo pendiente": "solo de estos 3; el resto no evaluado" },
  "resto": { "n": 10, "evaluado": false },
  "entidades": ["Mayorista El Roble", "Centro Constructor Maipo", "Supermercados Andes del Sur"] }
```
Con esto, «con un filtro de días aparecerían El Roble y Maipo» tiene delante `"Días vencido": "solo de estos 3; el resto no evaluado"` y `resto: 10 no evaluados`. No se le dicta la respuesta: se le muestra el borde. `seleccion.tipo` es una lista cerrada: `top` · `filtro` · `nombradas` · `completo` · `prioridad` · `estado` — las formas que `consultar` ya resuelve; no se inventa ninguna. `resto.evaluado` es un HECHO, no una regla: en un filtro sobre el eje completo vale `true` («los otros 9 no cumplen»), en un top vale `false` para las métricas que acompañan y `true` para la métrica del orden (están por debajo del k-ésimo). Ejemplo con el filtro del ensayo 12 (B01, E6): `cobertura: "3 de 12"`, `seleccion: {tipo: "filtro", metrica: "Días vencido", op: ">", valor: 90}`, `resto: {n: 9, evaluado: true, nota: "no cumplen la condición"}`, `metricas: {"Días vencido": "evaluada sobre los 12", "Saldo vencido": "solo de estos 3; el resto no evaluado"}` — y «los que sí tienen vencido son estos tres» queda sin base: el saldo vencido del resto está marcado no evaluado.

### 2.2 En cada tabla de cifras (`entrega.cifras`)

Una línea por tabla, al lado de las cifras: `tablas: [{ cifras: "E1.h1–E1.h26", orden: "por Venta, de mayor a menor (13 de 13)", ordenadaPor: ["Venta"], soloMostradas: ["Margen"] }]`. Es el caso 10·A01/C04 y 12·B01 1.5: trece filas completas, ordenadas por venta, con el margen al lado. El anfitrión ve que el margen **no está ordenado** y que la relación «las más grandes son las de menor margen» no está evaluada; el camino para evaluarla ya existe (`coincidencia`). Si igual la arma de cabeza, es el residuo de §5.

### 2.3 En cada respuesta: «lo establecido» (`establecido`, ≤ 1 KB)

Un digesto por conversación, que ADI mantiene y devuelve en TODA respuesta (consultar, derivar, aportarContexto, retomar, conocerEmpresa con conversación), antes de la Entrega, junto a `memoria`:
```json
"establecido": {
  "universos":  ["E3.u1 top 3 por Saldo vencido (3 de 13)", "E6.u1 filtro Días vencido > 90 (3 de 12)"],
  "ordenes":    ["E2.u6 prioridad por riesgo, 1.º–4.º, completa", "E1 tabla por Venta (13 de 13)"],
  "extremos":   ["mayor Saldo vencido: Mayorista El Roble E3.h5 (sobre 13)"],
  "relaciones": ["D2 coincidencia top 3 venta × top 3 saldo vencido: 2 de 3"],
  "criterios":  ["Benchmark de margen 30.1 % · declarado por la empresa · no consultado aún en esta conversación",
                 "Piso de rotación 2.0x · declarado por la empresa", "Plazo de cobranza 60 d · declarado por usted · pendiente de confirmar"],
  "memoria":    "íntegra · 4 Entregas · 213 cifras · esta respuesta: completa" }
```
Qué resuelve: las negaciones («no hay benchmark cargado»: la línea de `criterios` lo contradice en la misma respuesta de donde el anfitrión iba a contestar), las referencias a turnos anteriores («como vimos antes, Falabella es tu mayor deudor»: `extremos` dice quién es el mayor y sobre cuántos; si no está, no se estableció) y la memoria incompleta (`memoria` dice si esta respuesta trae todo). Cada línea es un hecho con id que el libro ya tiene: no se calcula nada nuevo. **Ley del digesto:** nunca una lista parcial de nombres sin su «k de N»; el índice actual por métrica («Venta: Falabella E1.h1, Lider E1.h3, Jumbo E1.h5 (+9)») se reemplaza por «E1 · 13 clientes (13 de 13) · Venta, Margen · E1.h1–E1.h26»: los nombres los trae `retomar`, los ids sí se indexan.

### 2.4 `conocerEmpresa`: lo vigente, no solo lo declarable

`declarable.criterios` hoy trae rótulo, unidad y rango (benchmark 5–60 %). Se agrega `vigente: { valor: "30.1 %", origen: "declarado por la empresa" }` o `vigente: null` («sin declarar»). Es el mismo dato que el Marco imprime en una Entrega de margen; solo se dice antes.

### 2.5 La cabecera: de 5 reglas a 4

Con el alcance en la estructura, la regla 2 (388 B, la que creció tres veces) deja de enumerar formas. Las reglas 1 y 2 se funden en una:

> «Toda cifra, orden, extremo, relación o conjunto que usted afirme debe ser un hecho que ADI le entregó (con su alcance) o estar en lo establecido de esta conversación. Lo que ADI marca como no evaluado no se completa: pídalo (consultar, derivar) o dígalo como no evaluado.»

Las otras tres (hallazgos negativos · referencia del oficio · libertad de redacción) no cambian una letra. La cabecera pasa de 1 369 B a ~1 100 B. No hay frases prohibidas ni casos: la frontera sigue siendo una (entregado o pedido), ahora con el alcance como parte de «entregado».

### 2.6 Cómo paga sus bytes

| Qué entra | Costo | Con qué se paga |
|---|---|---|
| `seleccion` · `orden` · `metricas` · `resto` por universo | +120–180 B por universo (1-3 por Entrega) | `n` + `parcial` → `cobertura` (−10 B); el `alcance` actual de la Entrega (profundidad, palabras, tope, filas…, ~150 B de mecanismo de texto) se reduce a `recorte` solo cuando recortó algo, y el nombre `alcance` pasa a significar lo de negocio |
| `tablas[]` (una línea por tabla) | +80 B | ídem |
| `establecido` (≤ 1 KB) | +600–1 000 B | reemplaza el índice de dueños de `loEntregado` (~600–900 B hoy, dentro del mismo tope de 2 KB de `estadoVigente`) |
| cabecera de 4 reglas | −270 B por respuesta | — |
| `vigente` en `conocerEmpresa` | +60 B por criterio | una vez por conversación |

Neto por `consultar`: entre −100 y +400 B. El caso máximo de los 532 (19.95 KB, v38:A45) queda por debajo de la referencia de 20.0 KB si se recorta el mecanismo de texto como se indica; si no alcanzara, `metricas` se omite cuando la tabla tiene una sola métrica (la mayoría). Descripciones de herramientas: no cambian (`derivar` 2 393/2 400 B, `consultar` 2 231 B, `catalogo.universo` 3 486/3 500 B): el mecanismo vive en las respuestas, no en las descripciones. Los 532 textos sellados: byte-idénticos (todo viaja al lado del texto, como en §16-§17). Core, Notario, Encargo: intactos.

## 3 · Qué garantiza ADI y qué es variabilidad del anfitrión

**ADI garantiza (determinístico, con gate):** (1) *completitud del alcance*: ninguna lista de entidades, tabla, índice ni página de `retomar` sale hacia el anfitrión sin cobertura, selección, orden y resto; (2) *veracidad del alcance*: N, k, la regla de selección, el orden declarado y qué métricas están ordenadas se comprueban contra una recomputación independiente desde las filas del tenant (demo y Río Claro v1/v2), en los 532 encargos sellados; (3) *veracidad de lo establecido*: cada línea resuelve a un id del libro; los criterios coinciden con el perfil del tenant y con el Marco de las Entregas; (4) *suficiencia*: lo que el anfitrión necesita para no completar está en la MISMA respuesta desde la que redacta (no en una llamada anterior); (5) *compacidad*: dentro de los topes vigentes.

**Variabilidad del anfitrión (se mide, no se garantiza):** que lea el alcance y lo use; que no reordene de cabeza una tabla completa; que no confunda dos filas de su propia respuesta. ADI no lo revisa ni lo reescribe (el owner lo descartó: «verifica la afirmación, no la redacción») — se MIDE por modelo, como ya dice el contrato §4. Para no deformar el producto, los deslices (9·C02, 10·B02: la verdad entera a la vista en la misma respuesta) se clasifican en su propia familia, «desliz de lectura con la verdad a la vista», distinta de «sobre-alcance». Siguen contando como materiales (cambian una conclusión), pero no se confunden con un defecto de la entrega y no arman «patrón» junto con otra familia.

## 4 · `retomar`: completo, en páginas, con lo importante primero

Lo que pasó (12 · B01 2.1): 235 KB, `hechos` (213, con su revalidación anidada) ANTES de `resumen` y `lineaContinuidad`; el CLI guardó un archivo y el modelo vio 2 KB. Consecuencia: «una cifra ya cambió» (eran 26 + 4 que ya no existen), tres H-leve de continuidad y el terreno del material 2.7. Con el libro en 64 KB es lo esperable, no un accidente. Propuesta:

1. **Orden fijo de la respuesta:** `memoria` → `establecido` → `estadoVigente` → `resumen` (conteo por estado) → `lineaContinuidad` → `cambios[]` (solo `cambio` y `ya_no_existe`, con antes/ahora y diferencia; es lo que `retomar` existe para decir) → `entregas[]` → `hechos[]` (lo que quepa) → `pagina`.
2. **Paginación con presupuesto:** `retomar { conversacionId, pagina?: k }` o `{ desde: "E3.h1" }`; cada respuesta ≤ el mismo tope de referencia de `consultar` (20 KB). `pagina: { k: 1, de: 4, hechos: "E1.h1–E2.h40 de E1.h1–E4.h35", completa: false, siguiente: 2 }`. La página 1 trae siempre `resumen`, `cambios` completos y los hechos que quepan; las siguientes solo hechos. La unión de las páginas es exactamente `hechos` de hoy: nada se pierde ni se repite.
3. **La incompletitud se declara en dato:** `establecido.memoria: "íntegra · esta respuesta: página 1 de 4 (faltan 173 hechos)"`. El anfitrión que diga «solo vi el inicio» ya no adivina: sabe qué le falta y cómo pedirlo. La cabecera de `retomar` no cambia.
4. **Decisión pendiente del owner (12 · B01|2|1, candidato):** recomiendo contarlo como **error de ADI de forma** («una entrega que indujo el error»: el contrato de `retomar` —decir qué cambió sin reescribir— no se cumplió de cara al anfitrión) y cerrarlo ANTES de las corridas oficiales: los hilos B repiten exactamente este escenario, y por API son ~60 mil tokens por llamada.

## 5 · Impacto esperado, error por error (honesto)

| Error | ¿Lo habría evitado? | Por qué |
|---|---|---|
| 11 · A02 1.1 (le sigue Andes) | **Sí** (ya cerrado en §17; 6 de 6 bien en el ensayo 12) | el orden viaja completo con puestos citables |
| 11 · C02 1.6 (filtro de días desde el top por vencido) | **Sí, muy probable** | `"Días vencido": "solo de estos 3; el resto no evaluado"` + `resto: 10 no evaluados`, en la misma respuesta |
| 12 · B01 2.7 (los que tienen vencido = los del filtro > 90) | **Sí, muy probable** | `seleccion: filtro días > 90` y `"Saldo vencido": "solo de estos 3"`; además `retomar` paginado habría dado la lista de los 5 en mora |
| 10 · C01 1.2 (Falabella mayor deudor con 1 de 13) | **Sí, muy probable** | `cobertura: "1 de 13"`, `seleccion: nombradas`, `extremos` sin «mayor saldo vencido»: no está establecido |
| 10 · B01 1.5 (la que más crece con la variación de 5) | **Sí, probable** | `"Variación": "solo de estas 5; el resto no evaluado"` (borde: arrastraba «del grupo» del turno 1.1) |
| 12 · A02 1.5 (no hay benchmark cargado) | **Sí, probable** | `establecido.criterios` con el 30.1 % en la respuesta de 1.4, y `vigente` en `conocerEmpresa` |
| 10 · A01 1.6 y C04 1.3 (3 más grandes = 3 de menor margen) | **En parte** | la tabla dirá `soloMostradas: ["Margen"]` y `relaciones: []`; el anfitrión tenía las 13 y ordenó mal de cabeza: el alcance le quita la licencia, no la tentación. Esperable: baja, no cero |
| 12 · B01 1.5 (las 2 que más aportan = las 2 que más dejan sin capturar) | **En parte** | ídem: tabla completa, relación no evaluada, leyó mal su propia tabla |
| 9 · C02 1.3 (Alsen la tercera) | **No** | las 5 ventas a la vista, tabla propia contradictoria: desliz |
| 10 · B02 1.2 (2.7 pp con el par equivocado) | **No** | el apoyo rotula sus dos dueños: desliz |

Cuenta: 6 sí (contando el ya cerrado), 3 en parte, 2 no. Lo que el mecanismo NO arregla y conviene decirlo: el anfitrión que REORDENA una tabla completa por una métrica no ordenada, y el que confunde filas de su propia respuesta. Lo primero se reduce (tiene un camino claro y un borde declarado); lo segundo es variabilidad pura y es la evidencia con la que, si persiste, se discute el criterio (§6.4).

## 6 · Cómo demostrar que se resolvió la FAMILIA y no los ejemplos

**6.1 Métrica de la familia: tasa de sobre-alcance.** Los errores materiales son raros (≈ 1.4 por 500): con ~1 400 afirmaciones por corrida, una mitad de reducción no se distingue del azar en una o dos corridas. La familia tiene una forma FRECUENTE que ya se registra en la clasificación: toda afirmación más allá de lo entregado, **sea correcta o no** (H-correcta sin camino, superlativos con vista parcial no declarada, conteos propios, «como vimos antes» sin id, negaciones sin consulta). En el ensayo 9 fueron 15 cálculos propios + 2 órdenes con vista parcial; en el 12, 48 H-correcta en palabras. Esa es la señal con densidad para medir: **sobre-alcance = afirmaciones de orden, extremo, conjunto, relación, existencia o cifra que ningún id ni línea de `establecido` sostiene y que no se dicen como parciales o no evaluadas**, por 500 afirmaciones. Los materiales se siguen contando aparte: son el criterio de certificación, no el del mecanismo.

**6.2 A/B pareado.** Mismo catálogo sellado, mismo modelo y vía, dos brazos: A = entrega de hoy, B = entrega con alcance + establecido + cabecera de 4 (+ `retomar` paginado en los dos brazos, porque es un arreglo de ADI, no del experimento). Dos repeticiones por brazo (vía A, sin costo por llamada; si se quiere sellar por API, el gasto se nombra como en la medición §7.3). Se informa la tasa de sobre-alcance por brazo con intervalo (Wilson), por hilo y por tipo (orden · conjunto · relación · existencia · continuidad), y los materiales por familia.

**6.3 Corpus de generalización, escrito a ciegas.** El autor ciego recibe la LISTA DE PROVOCACIONES, no los errores de 9-12 ni sus frases: «¿y el resto?» tras un top-k · «¿alguien más?» tras un filtro · «¿todos están bien?» tras una lista parcial · «¿quién es el segundo?» tras un extremo · «¿no tengo benchmark/piso/plazo?» sin haber consultado margen · «¿los que más venden son los que peor pagan?» con dos tablas completas sin orden · «como vimos antes, X era el mayor» con X consultado solo · un corte con `retomar` de libro grande (≥ 150 hechos) y después tres preguntas sobre lo retomado · una tabla completa ordenada por A seguida de «¿cuáles tienen el peor B?». Diez provocaciones × tres formas de pedirlas, repartidas en 8 hilos (uno de cada tipo A/B/C al menos), sin cifras esperadas (la verdad sale de las Entregas reales, como en la medición §3). Si el mecanismo solo cerrara las frases de 9-12, este corpus lo mostraría.

**6.4 Regla de parada.** Tras A/B × 2 sobre el corpus de generalización: (i) si B reduce la tasa de sobre-alcance **≥ 50 % respecto de A y el intervalo excluye la no-reducción**, la familia está resuelta como producto → se corren las dos corridas oficiales con la regla de cierre vigente, sin tocarla; (ii) si la reducción es menor o no se distingue, el residuo es variabilidad del anfitrión y **el owner revisa el criterio con esa evidencia** (por ejemplo: límite por familia, o la familia «desliz de lectura» contada aparte del patrón); (iii) si B reduce el sobre-alcance pero los materiales que quedan son deslices con la verdad a la vista, es la evidencia de (ii) aplicada solo a esa familia. En los tres casos el producto no se deforma: no entra una regla por frase ni un juez de prosa.

**6.5 Lo que se mide de ADI, antes de medir al anfitrión:** los gates de §3 (completitud, veracidad, suficiencia, compacidad del alcance; la unión de páginas de `retomar`). Un ensayo con anfitrión no empieza con un gate rojo.

## 7 · Impacto en el plan (cierre de la Etapa 2)

Secuencia propuesta, sin abrir la Etapa 3: (1) `retomar` paginado + gates (chico; cierra el candidato 12·B01|2|1); (2) alcance por universo y tabla + `establecido` + `vigente` en `conocerEmpresa` + cabecera de 4 (mediano: `compacto.js`, `estadoVigente.js`, `acciones.js`, el catálogo de `conocerEmpresa`; nada del Core ni de `entrega/componer.js`; 532 textos byte-idénticos; expectativas de `_puerta_compacta_gate`, `_capacidad_continuidad_gate`, `_forma_del_encargo_gate` movidas por intención, con su causa escrita); (3) ensayo 13 = A/B sobre el corpus de generalización (vía A; medidor arreglado para el cluster «métrica distinta» del ensayo 12 o clasificación humana obligatoria); (4) decisión por la regla de parada; (5) las dos corridas oficiales. Lo que NO cambia: la regla de cierre (ADI 0 · anfitrión ≤ ⌊N/500⌋ sin patrón), la convención material/leve, la medición por modelo. Riesgo declarado: el ensayo 13 agrega una corrida antes de las oficiales; a cambio, las oficiales dejan de ser una lotería en el borde (el ensayo 12 pasaba en 5 de 10 lecturas).

## Decisiones para el owner

1. **Adoptar el mecanismo** (alcance por universo/tabla + `establecido` + `vigente`) en lugar de una regla más por forma de error. *Recomiendo sí:* es la única opción que cubre las cinco formas pedidas con un solo principio y sin tocar la redacción del anfitrión.
2. **Cabecera de 4 reglas**, fundiendo la 1 y la 2 en la frontera única «entregado con su alcance, o pedido». *Recomiendo sí:* si el alcance es estructural, enumerar formas en la regla es la lista creciente que usted no quiere.
3. **`retomar`:** paginado con presupuesto y cambios primero; y contar 12·B01|2|1 como error de ADI de forma, cerrado antes de las corridas oficiales. *Recomiendo sí a las dos.*
4. **Medición:** la tasa de sobre-alcance como métrica de la familia, el A/B a ciegas con regla de parada (≥ 50 %), y la familia «desliz de lectura con la verdad a la vista» separada de «sobre-alcance» desde ya (sigue siendo material; no arma patrón con otra familia). *Recomiendo sí:* es lo que permite decidir con evidencia si lo que queda es del producto o del modelo, sin bajar hoy el estándar.
