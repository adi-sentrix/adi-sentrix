# CONTRATO · el ask que nace de un CUADRO (siembra 2026-09-05)

**Palabra del owner:** *«el botón que está en Sentrix en cuadros o tablas, ADI debe explicar exactamente lo que
ve ahí la foto… lo importante es ADI y el agente y su calidad de respuesta. Pero puedes sembrar el camino».*

**Estado: CONSTRUIDO.** La siembra (2026-09-05) fue el cable; el pulido de las 4 formas de Capital, el §5; y el
ancla completa y transversal de todos los botones «Que ADI lo explique», **el §6 (2026-09-08) — empezá por ahí
si venís a tocar esto**. Lo que sigue abierto está declarado al final del §6, con su razón.

---

## 1 · Las dos clases de ask, que NO tienen el mismo contrato

| clase | ejemplo | qué debe responder |
|---|---|---|
| **pregunta libre** | «¿Dónde está frenado mi capital?» | el dominio: la lectura del motor, completa. Un ask libre **jamás puede caer a `vacio`** — es un click sobre una promesa. |
| **ask de cuadro** | «¿Cuánto capital tengo en Santiago?» (fila del cuadro de bodegas) · «Profundiza en SAM-REF500L» (fila de la tabla de SKU) | **exactamente lo que ese cuadro muestra.** El usuario está MIRANDO la foto: una respuesta correcta del dominio pero de otro corte no honra el click. |

## 2 · El hallazgo de la siembra

**El emisor ya sembraba; el receptor no escuchaba.** La UI arma el contexto de la pieza tocada desde el
Contrato de Concordancia (2026-08-09) y se lo pasaba al camino natural — pero **`answerViaAgente` no lo
recibía**. Cableado el 2026-09-05: el agente lo acepta y lo deja en el expediente del turno
(`r.agente.viewContext`).

Los `ask` de Sentrix **no se tocaron** y no se tocan: son contrato congelado (CLAUDE.md). El receptor aprende;
el emisor no cambia.

## 3 · La forma del contexto (lo que viaja hoy)

```
{ vista, seccion, eje, entidad }
```

- **DESCRIBE la superficie, jamás trae cifras.** Lo que no entra por el módulo no se cuela al texto: una sola
  verdad. Si el contexto trajera montos, habría dos fuentes para la misma cifra — exactamente lo que la casa
  persigue.
- Campos ausentes van `null`: un contexto parcial es válido y se declara, no se completa adivinando.

## 4 · La regla del pulido futuro (cuando el owner lo pida)

1. **El anclaje es por MÓDULO, no por texto**: la respuesta a un ask de cuadro se compone con el **mismo
   builder y el mismo campo** que pinta ese cuadro. No se «reconstruye» la fila leyendo otra fuente.
2. **Si el corte del cuadro no existe como lectura del motor, se declara** — no se sirve el corte más parecido.
   Un ask de cuadro respondido con otro corte es peor que un límite honesto: el usuario está mirando la
   diferencia.
3. **El contexto no autoriza cifras**: sigue rigiendo la boleta. El cuadro dice QUÉ mirar, el módulo dice
   CUÁNTO.

## 5 · EL PULIDO, HECHO (GO del owner 2026-09-05)

**La palabra del owner que lo ordenó, textual:** *«Vamos con el pulido del anclaje de los 41 botones de
cuadro y después poda inmediata. No quiero podar dejando promesas clickeables sin piso. Cada botón debe
responder sobre el cuadro exacto que el usuario está mirando, no sobre el negocio general ni sobre otro eje.»*

Vive en `src/adi/agente/playbooks/askDeCuadro.js`, y las tres reglas del §4 se cumplieron así:

1. **Anclaje por módulo**: capital por bodega/familia sale de `queryMetric{capital,·}`, que agrupa
   `skuInventario.stockUSD` por el MISMO campo que `mesaCapital` (familia se declaró en el contrato de
   métricas con `groupByField: "sfamilia"` — el campo exacto del cuadro). El gate lo prueba **contra el
   cuadro VIVO**: recorre `buildMesaCapital().cortes` y exige que la respuesta diga la cifra de cada fila —
   si el dato cambia, cuadro y respuesta se mueven juntos o el gate se pone rojo.
2. **El corte sin lectura del motor se declara**: los tramos de EDAD («0–30 días»…) son un derivado de
   mesaCapital (días sin venta tramados), no un campo del dato — declararlos en el motor habría sido una
   segunda verdad del tramo. La respuesta lo dice y ofrece la alternativa CON cifra. Con carnada.
3. **El contexto no autoriza cifras**: `viewContext` viaja al detector (`playbookPara(q, {history, viewContext})`)
   solo para desambiguar; las formas nombran su corte en la frase del botón, y un nombre fuera del índice
   **no se adivina** (gateado: «Rancagua» no abre nada; «capital en Falabella» no se sirve por otro eje).

**La frontera de universos, gateada**: la respuesta de un cuadro de Capital no cita venta comercial ni margen
— y el margen del SKU existe DOS veces con el mismo rótulo (drill del cuadro: margen de inventario 22%;
skusMargen: comercial 11.1% — medido en SAM-REF500L), así que no se cita ninguno. Regla notarial
`universo-cruzado` + carnada.

**Cobertura**: las 4 formas × sus variantes (12 casos de turno completo en el gate, incluidos los declives:
el SKU no frenado con el estado que la carpeta declara, el cliente sin fila publicada en la mesa del cobro,
el tramo de edad declarado). El emisor sigue sin sembrar viewContext en los cuadros de Capital — ya no
bloquea: las formas se anclan por la frase del botón; la siembra del emisor queda como mejora de
desambiguación para catálogos con nombres repetidos entre ejes.

---

## 6 · EL ANCLA COMPLETA, TRANSVERSAL (GO del owner 2026-09-08)

**Su palabra, textual:** *«Sí, hazlo una vez para todos los botones "Que ADI lo explique". Regla: el botón no
manda solo texto. Manda el ancla completa del cuadro que el usuario está viendo. Debe incluir: cara/módulo ·
nombre del cuadro · métrica principal · eje o entidad · período · filtros aplicados · cifras visibles · qué
pregunta concreta debe explicar. ADI debe responder ese cuadro, no una pregunta libre ni un ranking genérico. Si
el cuadro muestra un 80/20, explica el 80/20. Si el cuadro muestra presupuesto, explica presupuesto. Si no
existe dato suficiente para ese cuadro, debe decir exactamente qué falta. Hazlo transversal para todas las
caras, no parche por cuadro.»*

**Lo que se midió antes de construir** (los 5 botones de la cara Comercial, con el cerebro mudo): **2 caían en
«no tengo información autorizada suficiente»** —incluido el que el owner clickeó— y los otros 3 devolvían un
ranking del negocio. El del 80/20 contestaba *«Así viene tu venta por cliente, de mayor a menor»*: correcto
como lectura, y no era la pregunta.

### Las cuatro piezas

| pieza | qué aporta |
|---|---|
| `src/adi/sentrix/lecturaDeCuadro.js` | lee LO QUE ESA PIEZA PINTA: su identidad declarada (del manifiesto) y sus **cifras visibles**, del mismo módulo que la pinta. |
| `cuadroSentrix` (`herramientasAgente.js` + `catalogoAgente.js`) | la herramienta: esa lectura convertida en boleta, con unidad y crudo derivados por los **lectores del propio muro** (`parseFigures` + `parseCounts`). |
| `src/adi/agente/playbooks/cuadroExplicado.js` | el playbook: lo abre el CLICK, sus pasos corren antes del cerebro, su entregable NOMBRA ese cuadro, y su lista notarial exige que la respuesta no se suelte del ancla. |
| `_ancla_de_cuadro_gate.mjs` | 109 chequeos: los 8 campos del ancla, el barrido del manifiesto, cada botón contra el **cuadro vivo**, el 80/20 con su conmutador, el presupuesto, el «qué falta», un-click-un-turno, el muro intacto, el inventario del emisor y 4 carnadas. |

### Las cuatro decisiones que hay que conocer antes de tocar esto

1. **`cuadro` es un campo DISTINTO de `viewContext`, y no es duplicación.** `viewContext` es lo que el turno
   tiene delante (el click si lo hubo, si no el **ambiente** de la vista abierta). `cuadro` es **solo el
   click**, y se consume una vez. El ambiente sigue publicado mientras la Mesa está abierta: abrir la
   explicación de cuadro por ambiente haría que la siguiente pregunta escrita a mano se respondiera como si
   fuera un botón. *Un click, un turno.* Gateado con carnada.
2. **Un solo paso: `cuadroSentrix`.** La primera versión sumaba la `evidencia` declarada del manifiesto y salió
   ROJA con razón: en el cuadro del año mes a mes quedaban dos figs del mismo valor y distinta procedencia —el
   total del cuadro (medido) y el de `trend` (derivado, que el manifiesto declara `divergent`)— y el muro vetó
   el turno entero. Con el cuadro anclado la respuesta correcta es **una sola fuente: la que el usuario mira**.
   El cerebro conserva la caja completa para la ronda siguiente.
3. **El diccionario de campos NO es un parche por cuadro.** El lector traduce el campo del builder (`ventaFmt`,
   `usdFmt`, `doh`…) al rótulo del negocio con **un** diccionario compartido por todas las caras — que es la
   aplicación literal de «una sola verdad: mismo concepto, misma palabra». Un campo que no está, no se lee: una
   cifra con rótulo inventado es peor que una cifra ausente. El gate exige que ni el lector ni el playbook
   nombren un solo `componentId`.
4. **`sin-cifras` es un límite MÍO, no del dato.** El lector distingue tres motivos: `sin-modulo` y `sin-campo`
   son del DATO y se le DICEN al usuario; `sin-cifras` —la pieza pinta números pero no los publica en forma
   citable— **no abre el playbook**, porque declararlo como límite del negocio sería mentirle al usuario sobre
   su propia carga.

### Lo que queda declarado como deuda (y vive en el gate, §9)

Las dos superficies de **nivel 2** cuyo botón todavía manda la pregunta sin ancla, cada una con su razón:
- **`CapitalDrill`** — la tabla de drill de Capital no está declarada en el manifiesto: anclarla pide entrada
  nueva + emisor propio.
- **`MesaPareto`** — el Pareto del Cuadro cambia de universo con la selección (negocio · posición ·
  composición): son tres piezas, no una.

Y las **21 piezas `sin-cifras`** (los cuadros de mando, los rings, los recibos, las simulaciones, la Ficha):
publican sus números crudos y los formatea la vista, así que no hay cadena que citar verbatim. El día que sus
builders publiquen sus `*Fmt`, quedan explicadas sin tocar una línea de este camino.

---

## 7 · INTERPRETAR, NO RECITAR (owner 2026-09-08, segunda regla — tras ver el §6 en su pantalla)

**Su palabra, textual:** *«El anclaje del botón está bien, pero "Que ADI lo explique" no debe repetir el
cuadro. De hecho al hacer click no debería ir una pregunta sino el título de la tabla… "Explicando el negocio
por cliente", algo así. Nueva regla: el botón debe usar el cuadro como evidencia, no como texto a recitar. Debe
explicar la historia que hay detrás del cuadro: evolución, caídas, puntos altos, variaciones, concentración,
gaps o anomalías. Debe decir qué implica para el negocio y qué mirar primero. Puede citar 2-4 cifras clave, no
todas las filas. Si el cuadro ya muestra la tabla, ADI debe aportar interpretación, no duplicarla. Objetivo:
que el usuario entienda algo que no veía solo mirando el cuadro.»*

**Lo que estaba mal del §6, dicho sin vueltas:** la primera versión respondía el cuadro recitando sus filas —
al lado de la tabla que las muestra. Anclado, sí; útil, no.

### Cómo se interpreta SIN calcular (la pieza técnica que lo hace posible)

Los builders **ya clasificaron cada fila**: `bajoBenchmark`, `critico`, `sobreMeta`, `estado`, y la dirección
`sube`/`baja` de cada delta. `lecturaDeCuadro` ahora lee esas **SEÑALES** junto a las cifras, y el composer
**agrupa filas por el veredicto del módulo** — agrupar no es calcular. De ahí salen las historias que la tabla
tiene y no dice: *«3 caen contra su presupuesto — y son las mismas que caen contra el año anterior, salvo
Unimarc, que cae pero cumple su plan»*, *«el total sube mientras esas cuentas bajan: lo que crece tapa lo que
cae, y por eso el número de arriba no te avisa»*. Los CONTEOS de cada grupo se autorizan como figs (`cuántas
caen vs presupuesto = 3`): un conteo no autorizado es un conteo inventado y el muro lo mata con razón.

### El título del click

`tituloDeExplicacion(componentId)` deriva del label del manifiesto («Explicando el negocio, cliente por
cliente») y `useViewContext` expone `explicar()` junto a `ask()`. Los 6 botones «Que ADI lo explique» de la
Mesa llaman a `explicar()`: **la intención ya no viaja en la pregunta — viaja en el ancla**, así que el texto
del botón dejó de cargar información y pasó a decirle al usuario qué está leyendo. ⚠️ Esto ES un cambio a un
`ask` congelado, con la palabra del owner que lo ordena (arriba, textual); los `ask` de FILA (Profundiza en X,
el cobro de X, los KPI) siguen congelados.

### Los dos vetos nuevos de la lista notarial

- `cuadro-recitado` — nombrar más de 5 filas de un cuadro que tiene 8+ es servir la tabla otra vez.
- `cuadro-calcado` — copiar textual la frase que el módulo ya pinta bajo el cuadro es duplicar, no interpretar.

Los dos con carnada en `_ancla_de_cuadro_gate` (121 chequeos tras esta tanda).

### Dos defectos mecánicos que costaron una tarde, para no repetirlos

1. **`facts.cuadro.nombre` convertía al cuadro en ENTIDAD**: el muro cosecha toda clave `nombre|name|entidad|
   entity` de los facts como entidad del turno, y exigía «nombrar» al cuadro como si fuera un cliente. La clave
   es `titulo`, y las figs de cabecera declaran `entidad: null`.
2. **El enum `por_vencer` salía a pantalla**: el estado se lee por su RÓTULO (`estadoLabel`); sin rótulo se
   acepta solo la palabra limpia («vencido») y se calla el identificador. `dominante` no es el estado de la
   bodega: es dónde CONCENTRA su capital, y se dice así.

---

## 8 · EL RESUMEN EJECUTIVO POR DIMENSIÓN, Y «PROFUNDIZA EN…» (owner 2026-09-08, tercera entrega)

**Su palabra, textual:** *«tienes participación, tienes venta y contribución, tienes el margen, año anterior y
presupuesto si existe — no todos tendrán ese dato. En la participación podrías decirme breve qué está pasando,
lo mismo con el resto, explicarme caídas: lo que debe entenderse es un RESUMEN EJECUTIVO de esa tabla. Y si el
usuario quiere profundizar debes seguir: te podría decir "profundiza en la contribución, o en la
participación".»*

**El resumen recorre las dimensiones QUE EXISTEN en el cuadro** (las ausentes ni se nombran): marco (total y
sus deltas) · participación/concentración · contribución **con la inversión** («Jumbo, con venta $17.3M, deja
$4.2M de contribución; Lider vende $17.9M y deja $3.8M») · margen (el rango) · la señal (caídas + intersección
+ excepción) · por dónde empezar. El material nuevo del lector: **el CRUDO del builder viaja junto al
formateado** (`venta`/`pesoPct`/`ventaK` según la cara), así que ordenar y leer posiciones no re-parsea nada.

**«Profundiza en…» sigue sobre el mismo cuadro sin click nuevo:** el bucle guarda `mem.cuadroAbierto`
(dirección + controles, jamás cifras) al cerrar un turno de cuadro; SOLO una forma de profundización
(verbo + dimensión del vocabulario) la reabre — una pregunta libre jamás (gateado). Caduca a las 8 entradas de
hilo, el criterio del contexto de pantalla. Encadena («profundiza en la contribución» → «…en la
participación») y cada drill da extremos + señaladas + la inversión, no la columna recitada.

**Tres lecciones del muro en esta tanda** (todas medidas):
1. *Binding de métrica*: «Jumbo deja $4.2M … vendiendo menos» hizo leer el $4.2M como VENTA — cada cifra va
   pegada a su métrica, con las cuatro cifras de la inversión.
2. *Total-sin-declarar*: «$135K en total» detrás de la cifra reclama el conjunto, y una coincidencia de canon
   con un crudo de la carpeta le dio dueño (un SKU) — se dice «$135K de capital», la métrica en vez de la
   coletilla.
3. *Desanclado*: la serie que no nombraba ningún mes quedó desanclada de su propio cuadro — el pico y el piso
   se dicen con su mes («jul, $11.9M»).

`_ancla_de_cuadro_gate`: **131 chequeos** — §5c mide el resumen por dimensión contra las banderas vivas del
builder, la cadena T1 click → T2/T3 profundizaciones → T4 pregunta libre que NO se responde como cuadro, y la
caducidad de la memoria.

---

## 9 · EL MURO SUPERVISA, EL AGENTE REDACTA (owner 2026-09-08, cuarta entrega)

**Su palabra, textual:** *«lo que debes lograr es que el agente pueda hacer esa calidad de análisis… el muro
debe corroborar que nada se invente. Nuestro trabajo es buscar el cómo: que el muro siga siendo supervisor, no
permita inventos, y que el agente pueda redactar — de lo contrario lo volvemos a privar y vuelve a salir malo.
Busca la manera sin perder calidad.»*

**El diagnóstico que lo precedió, medido:** el agente SÍ escribía la lectura ejecutiva — el muro se la mataba,
y el entregable determinístico (más pobre) salía en su lugar. La prueba: el texto que el owner escribió a mano
como estándar, alimentado como respuesta del cerebro, moría en dos reglas.

### Las dos calibraciones del notario (guardC.js) — ninguna afloja, las dos se miden

1. **La mención tomada no liga** (`_todasLasMencionesTomadas`): en «…con $17.3M **de venta**, genera
   prácticamente lo mismo: $4.2M», la palabra «venta» pertenece a $17.3M (la tiene pegada y la describe bien
   según la boleta) — no puede reclamar además al $4.2M. Criterio direccional: «$X de venta» toma hacia atrás
   solo con conector puro (de/del/en/coma — «y su» abre afirmación nueva y NO toma); «vende $X» toma hacia
   adelante a ≤15 caracteres. El infinitivo suelto («entre vender más y aportar más») no afirma y no cuenta.
   **Corpus: 5 frases legítimas pasan · 5 venenos mueren** — incluido un agujero PREEXISTENTE que la
   calibración destapó: «Jumbo facturó $4.2M» pasaba el muro entero porque ni `\w` ni `\b` de JS funcionan con
   la ó acentuada («facturó» nunca fue vocabulario). Cerrado por lookahead.
2. **El posesivo del superlativo** («el menor margen relativo **de Lider y Falabella**»): el español cuelga el
   dueño del extremo detrás con «de», y la regla vieja miraba hacia atrás y le cobraba a la vecina (Ripley) una
   frase que hablaba de otros dos. Posesivo con UNA entidad → esa es la reclamante (y se verifica); con DOS o
   más → es de un grupo y no se adivina — el candado del plural, ahora también por detrás.

### La aceptación (gate §5d, con carnadas g/h)

**EL TEXTO DEL OWNER, verbatim con cifras del demo, pasa el muro sin un solo veto** — y en el turno completo
sale VERDE a la primera. El arnés juzga con `datoProyectado` (los rankings declarados de la carpeta): sin eso
el juez de superlativos ni corre y la aceptación mediría a medias — cazado en la propia calibración.

### Y el piso subió al mismo estándar

La rama ejecutiva del composer sigue el arco del owner: tesis → desempeño y quién impulsa → concentración (el
acumulado 54.6% LEÍDO de la curva de la misma cara, jamás sumado — `L.concentracion` busca la pieza hermana
POR DECLARACIÓN en el manifiesto) → vender ≠ aportar CON su razón (el margen) → la calidad del mix contra el
promedio de la cartera → el deterioro PONDERADO por margen (La Polar: 2.9% de la venta, 34.0% de margen — «la
más cara de perder») → síntesis con las dos tensiones → por dónde profundizar, con el criterio dicho. Los
cuadros sin comparaciones (el corte de Capital, Qué liquidar, el saldo del Flujo) conservan su señal de estado.

---

## 10 · DOS DEFECTOS QUE EL OWNER ENCONTRÓ EN SU PANTALLA (2026-09-08, tras el deploy de `c2628b1`)

**Su observación:** *«mejoró un montón, ese es el agente hablando? esto está con el resto de los botones?
fíjate en la segunda foto es el botón del gráfico, de dónde sale ese 103%, es el agente? le pregunté y dice que
lo inventó?»*

**Lo que se confirmó de sus capturas:** el cuadro del año mes a mes **lo respondió EL AGENTE** (prosa con
subtítulos, hipótesis marcadas, «es criterio mío» — nada de eso lo escribe el piso determinístico). La cartera,
en cambio, salió del PISO: el cerebro no llegó a pantalla. Y el 103% **no fue inventado**: es el
`cumplimientoFmt` que publica el módulo del cuadro, y viaja en la boleta del turno como fig **obligatoria**.

### Defecto 1 · ADI se desdijo de una cifra correcta

Al preguntarle «¿de dónde sale ese 103%?», contestó *«esa cifra la saqué sin verificarla… déjame corregir»*.
**La causa no fue el muro: fue que ese turno YA NO TENÍA el cuadro.** El click se consume en su turno, y «de
dónde sale» no era forma de profundización — el cerebro quedó sin la boleta y prefirió retractarse.
**Desdecirse de lo cierto cuesta más confianza que no haberlo dicho.**

Arreglo: **la reapertura por CIFRA CITADA.** Si la pregunta nombra un número que el cuadro abierto publica,
está hablando de ese cuadro — sin ambigüedad que resolver. Se pide además que sea corta o traiga marca de
procedencia («de dónde», «cómo sale», «por qué», «qué es ese»). La respuesta dice qué ES esa cifra, de qué
cuadro sale, **que la publica el módulo y no es una cuenta de ADI**, y las otras cifras del mismo cuadro.

⚠️ **Y de paso apareció uno peor: la memoria no guardaba el ESCENARIO.** Sin él, la reapertura leía el cuadro
con `ESCENARIO_INICIAL` —que es `bonanza`, no la carpeta del turno— y devolvía **otras cifras** ($99.9M y
103.0% en vez de $100.0M y 103.1%). Al preguntar por una cifra, ADI habría contestado con la de otro mundo.
`mem.cuadroAbierto` guarda ahora `{componentId, escenario, controles, turno}`.

### Defecto 2 · MI regla mataba la lectura buena

La cartera caía al piso porque `cuadro-recitado` contaba **NOMBRES**, y una lectura ejecutiva rica menciona a
las que crecen, a las que caen y a las sanas — nueve cuentas con propósito — y quedaba vetada. **Contar nombres
medía la FORMA.** Lo que hay que impedir es servir la TABLA, y una tabla se reconoce porque cada fila viene con
su cifra pegada, una tras otra: ahora se cuentan las filas cuyo nombre aparece a ≤40 caracteres de su valor
principal, y el umbral es 6. «Ripley, Easy y La Polar caen» no cuenta; «Falabella $19.4M · Lider $17.8M · …» sí.

Gate: **§5e** (la procedencia, el escenario en la memoria, y la pregunta libre que sigue libre) y **§5f** (la
lectura rica de nueve cuentas pasa · ocho filas con su cifra pegada siguen siendo la tabla). 156 chequeos.

### Un tercero, cazado por un candado ajeno

`_agente_contrato_gate` rechazó mi `\bqu[eé]\b`: **el `\b` no cierra tras una vocal acentuada**. Es la misma
lección que el proyecto ya pagó dos veces (`\b[uú]ltimo mes\b`, y el «facturó» del §9). Se usa lookaround
explícito. El candado hizo exactamente su trabajo.

---

## 11 · EL GAP MANDA, Y NINGÚN PORCENTAJE SIN DECIMAL (owner 2026-09-08, quinta entrega)

**Su palabra, textual:** *«decir cumplimiento de 103, ojo con eso, porque es mejor DECIR CON UN gap sobre
ventas, es más ejecutivo. Y si preguntan por cumplimiento… lo redondeo en 103, prefiero al menos un decimal,
es mejor.»*

**Dos reglas de presentación con consecuencia real:**

1. **El GAP abre la lectura, no el cumplimiento.** Un gerente lee «+3.1% sobre tu presupuesto» de una;
   «103.1% del plan» lo obliga a restar 100 de cabeza. El módulo ya publicaba las dos formas (`vsPresupuestoFmt`
   y `cumplimientoFmt`) — lo que faltaba era que el lector viera la escalar: `vsPresupuesto`/`vsAnterior` no
   estaban en el diccionario de campos, así que el gap del cuadro del año **no se leía**. El cumplimiento no se
   pierde: se contesta cuando lo preguntan.
2. **Un porcentaje medido va con su decimal.** El cerebro escribió «103%» donde el cuadro publica «103.0%»: el
   muro lo dejó pasar porque el VALOR es el mismo —y para el muro lo es—, pero en pantalla un entero pelado se
   lee como aproximación y le quita precisión a una cifra que está medida. Veto nuevo `porcentaje-redondeado`,
   solo en el caso inequívoco (el cuadro publica `N.d%` y el texto trae `N%`).

**Y dos huecos que la entrega destapó:**
- **«¿Y el cumplimiento?» caía a vacío.** Es una continuación, no una pregunta nueva. Abrir por «pregunta corta
  que nombra una columna» habría secuestrado turnos libres —«¿cómo viene mi margen?» son cuatro palabras y
  nombra una columna—, así que el marcador es la conjunción de apertura: **nadie empieza una pregunta nueva con
  «y»**. Determinístico, y el control sigue verde.
- **Se declinaba con el dato en la mano.** La profundización buscaba la columna solo en las FILAS, y el
  cumplimiento vive en la CABECERA: contestaba «este cuadro no trae esa columna» teniendo la cifra al lado.
  Declinar con el dato en la mano es el peor de los errores honestos.

**La cifra, para que quede escrita:** en la carpeta del owner el gap es **+3.0% · +$2.9M** (venta $99.9M contra
presupuesto declarado $97.0M); en la carpeta `actual`, **+3.1% · +$3.0M**. No 2,1% — si su presupuesto declarado
fuera otro, la cifra se mueve con él.

---

## 12 · LA TABLA LA PONE SENTRIX, NO ADI (owner 2026-09-08, sexta entrega)

**Su palabra, textual:** *«hay que afinar estas respuestas porque al final la idea no es que ADI vuelva a hacer
las tablas; si ese es el caso, por ejemplo, los agregamos a Sentrix y que sea permanente. Imagina, hace dos
tablas diferentes repitiendo datos: lo que el usuario quiere es entender qué ve. Ahora, se puede dar que el
usuario le pida a ADI "hazme una tabla con la venta mes por mes" y podría hacerlo, pero acá está leyendo
directo de Sentrix.»*

**La regla:** en un turno nacido de un cuadro, **la tabla está al lado**. Redibujarla sirve dos veces el mismo
dato y gasta el espacio de la interpretación — lo único que ADI aporta ahí. El playbook lo declara
(`tablaProhibida: true`) y el bucle lo traduce a `tablePolicy: "forbidden"`, la política que **ya existía en el
muro**: no hizo falta una regla nueva, hacía falta cableársela. Y **no es una prohibición general**: si el
usuario pide una tabla, ese turno no nace de un cuadro y ADI puede hacerla.

### Tres defectos que esta entrega destapó — los tres MÍOS, los tres bloqueando al cerebro en producción

1. **Mi regla del decimal multaba prosa correcta.** Exigía «22.0%» donde **la propia tabla de Sentrix muestra
   «22%»**: le pedía a ADI una precisión que la pantalla no usa. Ahora solo arde cuando **se pierde
   información** (decimal ≠ 0): «103.1%» escrito «103%» sí esconde de qué lado del número está; «22.0%»
   escrito «22%» no esconde nada.
2. **El muro ligaba una métrica que estaba en otra cláusula.** «Los 13 clientes cierran el año en $100.0M, y
   los más grandes son los que más presionan **el margen**» → *«$100.0M narrado como margen»*. La palabra está
   en la ventana, sí, pero con su propio verbo y hablando de otra cosa. Ahora la métrica tiene que estar
   **atribuyendo**: a ≤25 caracteres de la cifra, que cubre todas las formas del español («$X de margen», «el
   margen es $X», «margen: $X») y excluye la otra cláusula.
3. **Mi regla de anclaje vetaba una lectura anclada.** En el cuadro del año las «filas» son las tres series, y
   una lectura que habla de meses y montos no nombra ninguna. **Citar sus cifras también es estar anclado.**

### Y el piso escribía tabla sin saberlo

`Etiqueta: cifra` en líneas seguidas **es una tabla escrita con dos puntos** — el detector la cazó, y tenía
razón: era exactamente lo que el owner rechaza. El entregable determinístico pasó a prosa en los nueve cuadros,
y el gate lo verifica cuadro por cuadro (§5h).

## 13 · EL PORQUÉ DEL ELEMENTO NOMBRADO (owner 2026-09-09, séptima entrega — en su pantalla)

**Su palabra, textual:** *«hice click en el del gráfico, el año mes a mes: eso es una lectura de los datos,
pero no cuenta causas. Ejemplo: ¿por qué febrero es el mes más bajo? La venta fue evolucionando, ¿por qué?
¿Qué hicimos bien en los meses más altos? Por último, dime por qué ADI, cuando le pregunto por qué febrero es
el mes más bajo, me dice que no puede completar… esas cosas ya no nos deberían pasar.»*

**Lo que pasaba, medido:** con el cuadro del año abierto, «febrero es el mes mas bajo, por que?» no la tomaba
**ningún** playbook — «febrero» no es una cifra ni una columna, y esas eran las únicas dos puertas de
reapertura. El turno quedaba libre, el cerebro improvisó una herramienta equivocada, y la declinación interna
(«la métrica venta no está declarada para el eje cliente») salió a pantalla.

**La regla:** el ELEMENTO nombrado es la tercera puerta de reapertura del cuadro — una **fila** del cuadro, o
un **mes que el propio cuadro nombra**. Determinística como las otras dos: si el cuadro abierto no lo nombra,
la pregunta sigue libre (la cartera no nombra meses; «febrero» con la cartera abierta no secuestra nada).

**La respuesta tiene tres partes, en este orden:**

1. **El lugar del elemento, con su cifra del builder.** «Febrero es el piso del año ($6.5M).» Un mes que no es
   extremo se ubica sin drama — y con las cifras de los extremos al lado, porque sin ellas la respuesta
   quedaba desanclada del cuadro y el propio veto (1) la mataba (medido con «y julio, ¿por qué?»).
2. **La ley de la casa, primero:** *la causa no está en este dato* — la serie trae el cuánto, no el porqué.
   Jamás se afirma una causa como hecho.
3. **El hecho que la serie SÍ sostiene — `patronAnual`:** ¿el mismo mes fue también el extremo del año
   anterior? Es un hecho de **orden sobre los crudos del builder** (cero cifras nuevas): extremo repetido dos
   años apunta a **estacionalidad del negocio**; extremo nuevo, a algo **de este año**. Cierra con la puerta
   («te lo comparo contra el mismo mes del año anterior»).

**El cerebro recibe lo mismo:** `patronAnual` viaja en los `facts` de la herramienta (meses y booleanos), y el
entregable del porqué le exige el arco del asesor — la ley primero, hipótesis **marcadas como criterio**
(«es criterio mío», «el dato no lo confirma»), el patrón si viene, y la verificación concreta que haría.

**De paso, dos defectos míos que esta tanda destapó:** el mes no extremo respondía sin citar una sola cifra y
mi propio veto de desanclaje lo mataba (el turno caía al rescate); y `_PIDE_PORQUE` cerraba con `\b` después
de vocal acentuada — la familia de «facturó» — así que **«¿por qué?» con tilde ni siquiera casaba**. Lo cazó
`_agente_contrato_gate` §5g.

**Gate:** `_ancla_de_cuadro_gate.mjs` §5i (13 chequeos: el caso del owner contra crudos vivos, la ley primero,
el patrón, el mes no extremo anclado, el no-secuestro con la cartera, la fila nombrada, los facts y el
entregable) + carnada (i): quitada la puerta del elemento, la pregunta del owner vuelve a caer al vacío.

## 14 · EL MES POR DENTRO (owner 2026-09-09, octava entrega — corrigiendo la séptima el mismo día)

**Su palabra, textual:** *«pero como no está en el dato, el agente ADI lo que debe entender es: el mes más bajo
fue porque hubo un incremento en acciones comerciales, por ejemplo, aumentó el costo, bajó la contribución
porque ganamos volumen pero perdimos margen, etc. Esas son las cosas que debemos saber, y eso SÍ está en los
datos.»*

**Y tiene razón, verificado columna por columna:** la hoja Ventas de la plantilla trae **fecha, costo,
unidades y acciones comerciales** en cada fila. De ahí sale, mes por mes, todo lo que su ejemplo pide: venta,
contribución (venta − costo − acciones, la fórmula declarada), margen, volumen y acciones. La ley «la causa no
está en el dato» quedó REPARTIDA en dos: el **porqué interno** (qué componente del mes se movió) SÍ está y se
afirma con cifras; el **detonante de fondo** (calendario, un cliente que cambió) sigue sin estar, y se sigue
diciendo.

**Las piezas:**

1. **La ingesta** (`motorKpi.js`) suma costo, unidades y acciones **por período** desde las filas — el mismo
   bucle que ya armaba la venta mensual. El archivo real del cliente alimenta esto sin pedirle nada nuevo.
2. **El demo lo declara igual** (`ventasMensuales` con los tres campos): hechos mensuales autorizados, NO
   derivados de la curva de venta. **Las sumas cierran exacto** con lo que la cara Comercial ya publica:
   contribución $25.1M (la formación del margen), acciones 4,075 (pctRebate × venta), unidades 5,703 (el KPI).
3. **El builder** publica `evolutivo.porDentro`: cada mes con unidades, contribución, margen, acciones y carga,
   **anclado con `anchorSerie` a la formación del margen de su propia cara** — la técnica de las tres series.
   Un tenant sin los tres campos → `null`, jamás una curva inventada.
4. **El playbook** lee el cruce con **umbral declarado** (±0.8pp del año): margen y acciones acompañan + unidades
   mínimas → «muestra menos volumen»; carga arriba y margen abajo → «cediste más en acciones y el margen lo
   pagó»; unidades máximas con margen bajo el año → **«ganaste volumen cediendo margen»** (la frase del owner,
   con sus cifras). Un mes no extremo con historia interna (margen mínimo / carga máxima del año) la cuenta.
5. **La boleta** lleva los 12 meses por dentro (el turno no sabe cuál va a nombrar el usuario) y el cerebro
   recibe `mesPorDentro` en facts + la doctrina: **leer el mes por dentro ANTES de hipotetizar**.
6. El eje de meses del cuadro (`mesesDelCuadro`) hace citable **cualquier** mes de la serie («¿y abril?»),
   no solo los que la microlectura nombra.

**Lo que responde hoy el piso** (cerebro mudo, escenario actual): Febrero → «no muestra un problema de margen
ni de acciones — muestra menos volumen» + estacionalidad. Julio → «el margen más bajo del año (22.9%) con la
carga de acciones más alta (5.5%)». Noviembre → «bien ganado: el mejor margen del año con la carga más baja».
Diciembre → «ganaste volumen (560 unidades, las más del año) cediendo margen». Cero vetos del muro.

**Gate:** §5j (11 chequeos: el cierre exacto contra la formación, el cruce en la respuesta con las cifras del
builder, la lectura por umbral, la ley en pie, la boleta con los 12 meses, la doctrina del cerebro, la ingesta
real) + carnada (j): sin el ancla, la contribución mensual deriva y el cierre exacto arde.

## 15 · EL MÉTODO DEL PORQUÉ (owner 2026-09-09, novena entrega — viendo la v2.20 en su pantalla)

**Su palabra, textual:** *«No quiero prohibir que ADI mezcle criterio de mundo; eso es aporte. Pero debe
hacerlo con método. Orden esperado: (1) primero el mecanismo medido del negocio. (2) Después la hipótesis del
asesor, marcada. (3) Después una pregunta para corroborar con el usuario. ADI no necesita saber todo. Si falta
contexto, debe consultar bien al usuario para cerrar la lectura. Eso es asesoría: medir, proponer hipótesis y
validar con el dueño. Además: si afirma "fue volumen y no margen/acciones", debe mostrar las cifras que
sostienen esa lectura · evitar frases sectoriales fuertes como "el sector históricamente cae" salvo que haya
fuente o contexto declarado · las preguntas al usuario deben ser concretas, no genéricas.»*

**Qué lo disparó.** En producción ADI escribió, con el rótulo «criterio mío» puesto: *«los clientes retail
típicamente reducen compras después de enero»* y *«el sector electrodomésticos y línea blanca históricamente
cae en febrero»* — sin fuente. Y afirmó *«el volumen cayó, no es margen cedido»* **sin mostrar una sola cifra**,
teniéndolas todas en la boleta del turno. El rótulo salvaba la honestidad; el método faltaba.

**Los tres pasos, en este orden** — el piso los compone y el cerebro los recibe como doctrina, con los ejemplos
textuales del owner como estándar:

1. **El mecanismo medido, con sus cifras.** «Fue por volumen: 360 unidades contra un promedio de 475 en el año.
   El margen se mantuvo en línea (25.2% contra 25.1%) y las acciones comerciales no saltaron (3.6% contra 4.1%).»
   Las **tres** componentes con su referencia del año — una conclusión sin sus cifras es una opinión con cara de
   medición.
2. **La hipótesis, marcada y declarada no probada.** «Mi hipótesis es que hay estacionalidad, porque febrero
   también fue el más bajo el año anterior. Con este dato solo no está probado.»
3. **La pregunta concreta al dueño.** «¿Febrero suele ser un mes bajo en tu negocio, o ese año pasó algo puntual
   con clientes grandes, stock o campañas?» Con opciones y nombrando cosas de su negocio.

**Tres vetos nuevos, solo en el turno del porqué** (una lectura normal del cuadro no se toca):

- `mecanismo-sin-cifras` — afirmar qué movió el mes sin citar al menos dos cifras de ese mes.
- `sectorial-sin-fuente` — «el sector / la industria / los clientes retail + históricamente / típicamente /
  suelen». **El rótulo «criterio mío» NO lo salva**: la frase llega al lector como estadística de industria.
  Hipotetizar sobre el **negocio del usuario** sigue siendo bienvenido — eso es el aporte.
- `porque-sin-pregunta` — cerrar sin pedirle al dueño el contexto que falta. «¿Seguimos?» no cuenta.

**Un falso positivo mío, cazado midiendo:** el veto de anclaje no conocía las cifras del mes por dentro, así
que exigir el respaldo y a la vez vetar por citarlo — la casa contra sí misma. Corregido: el mes por dentro
también es «sus cifras».

**Gate:** §5k (20 chequeos) mide **el orden de los tres pasos por posición**, no solo su presencia; usa como
veneno **el texto real que salió en producción** (arde en los tres vetos) y el mismo texto con método (pasa
limpio); comprueba que la hipótesis de mundo sobre el negocio del usuario NO se toca. Carnada (k): apagadas las
tres reglas, vuelve a pantalla el texto que el owner rechazó. §5i y §5j quedaron actualizados a la forma nueva
sin perder su garantía. De paso, el candado del registro cazó **«palanca»** en mi doctrina — palabra prohibida
en superficie desde siempre.

## 16 · LA LEY DEL PORQUÉ, TRANSVERSAL (owner 2026-09-09, décima entrega)

**Su palabra, textual:** *«No quiero que el método del porqué dependa de venir desde un cuadro. Si el usuario
pregunta "por qué" desde cualquier lugar —cuadro, ficha, chat libre, cliente, margen, ventas, inventario o
cobranza— ADI debe seguir la misma doctrina: medir primero · hipótesis marcada después · pregunta concreta al
dueño para completar la causa. Y los tres vetos deben aplicar transversalmente.»*

**Un módulo, no trece parches.** `src/adi/agente/porque.js` tiene el detector único (`esPorQue`), la letra
(`doctrinaDelPorque`, byte-estable, ≤900 chars) y los tres vetos (`vetosDelPorque`). El bucle la aplica: la
doctrina como mensaje antes de la primera ronda **con playbook o sin él**, y los vetos como cuarto juez en
`juzgar()`, acotados al cerebro (a los peldaños de rescate no se les cobra lo que ellos arreglan). Los tres
vetos SALIERON del playbook del cuadro en el mismo commit: dos jueces con la misma regla sobre la misma oración
es un turno partido en dos cerebros.

**Lo que la ley NO toca**, y cada exclusión salió de un falso positivo medido: la **procedencia** («¿por qué
103.1%?» = de dónde sale la cifra — el propio veto del cuadro se lo cobraba a su respuesta correcta), el
**límite del instrumento** («¿por qué no me muestras el vencido?» — ahí la causa ya se dice entera) y la
**simulación**. Y no exige cifras donde el dato no tiene mecanismo: en inventario y cobranza obligar respaldo
empuja al cerebro a rellenar con mundo, que es el defecto que esto cierra.

### El método reprobó su primera versión — y eso es el método funcionando

Tres agentes mapearon el código, uno implementó, seis auditaron adversarialmente. La certificación salió
**NO CERTIFICADA** con defectos reproducidos en el bucle real. Los seis, corregidos:

1. **REGRESIÓN mía (bloqueante).** La exención que le puse a la ficha era tan ancha que *«Falabella cede margen
   porque su equipo negocia mal»* salía **verde** — HEAD lo vetaba. Causa: «margen» está en toda oración de un
   porqué de margen. Ahora la exención pide **marca de hipótesis** o **mecanismo + dos cifras**; y «creo que» /
   «sospecho» salieron de las marcas: son muletillas, no proporcionalidad.
2. **Inventario y cobranza contestaban con una lista (bloqueante).** «¿Por qué tengo capital frenado?» lo
   secuestraba la lectura por eje —por el «qué» de «por qué»— y devolvía un ranking de tres SKU: **cero de tres
   pasos y cero vetos**. Se retiró de ahí, se le dio dueño al porqué del capital, y cobranza declara su límite
   y pregunta. Además el veto (c) ya no exige «lectura causal» previa: **esquivar la pregunta también arde**.
3. **El detector era ciego al castellano corriente.** «¿Cómo se explica?», «¿qué hay detrás?», «¿cuál fue el
   motivo?» no activaban nada. Trece formas más, medidas.
4. **Dos exclusiones se tragaban porqués reales:** «¿por qué **es** el margen de Lider tan bajo?» (acotada a la
   cifra) y «¿por qué **no está** creciendo Falabella?» (acotada al instrumento).
5. **`getTenantData` no estaba importado** en el bucle: el contexto declarado era siempre null dentro de un
   try/catch mudo, así que «si él ya te lo declaró, cítalo» estaba muerto.
6. **Un byte `backspace` dentro de un regex** (`\b` comido por el shell) apagaba media exención en silencio.

**Gate:** `_agente_porque_gate.mjs`, 89 chequeos. El §8 recorre **los ocho lugares que el owner nombró por el
bucle real** y exige que cada uno cierre preguntándole al dueño algo concreto de su negocio, con el muro
limpio; y comprueba que una **lectura** en esos mismos lugares sigue intacta. Cinco carnadas.

**Queda abierto y declarado** (no entró, es decisión del owner): el **peldaño oráculo** —la red de respaldo si
el agente falla— no tiene la ley; y **ventas** no puede cumplir el paso 1 con cifras porque la descomposición
precio/volumen existe en el módulo pero ninguna herramienta la sirve (hoy localiza, declara el límite y
pregunta).

## 17 · DESCOMPONER, NO SOLO LOCALIZAR (owner 2026-09-09, ampliación del alcance)

**Su palabra:** *«Para todo "por qué" de ventas o margen, ADI debe intentar descomponer con las dimensiones que
existan en el pack… Si el usuario pide una dimensión específica y existe, debe usarla. Si no existe, debe
declararlo y ofrecer el corte más cercano. Objetivo: que ADI no diga solo "margen bajo por Falabella", sino que
pueda explicar si viene de precio, costo, carga comercial, mix, canal o sucursal cuando el dato lo permita.»*

**EL HALLAZGO QUE CAMBIÓ EL TAMAÑO DEL TRABAJO: casi todo ya estaba construido.** El motor calcula desde antes
el efecto volumen vs precio, el mix por familia, el precio realizado, quién cede margen por precio y quién por
costo, y el margen por canal — con boleta y con sus salvedades escritas (incluida «precio realizado no es un
ticket»). El catálogo que ve el agente **no lo mencionaba**: el asesor pedía la lectura por defecto y respondía
*quién*, nunca *por qué*. Esto fue **conectar**, no construir.

**Lo conectado** (`toolContracts.lecturasSoportadas` → el catálogo lo describe y lo expone como enum, así que
el cerebro pide la clave exacta en vez de adivinar una cadena — un `focus` inventado caía a la lectura por
defecto EN SILENCIO, respondiendo otra cosa sin avisar):

| Pregunta | Lectura |
|---|---|
| ¿La venta se movió por volumen o por precio? | `salesRead focus=descomposicion_vol_precio` |
| ¿Qué familia ganó o perdió participación? | `salesRead focus=mix_familia` |
| ¿Cómo viene el precio? | `precio_realizado` · **`precio_neto`** |
| ¿Quiénes ceden margen por precio? ¿por costo? | `marginRead focus=causa_precio` · `causa_costo` |
| ¿Y por canal? | los dos lectores aceptan `dimension=canal` |

**Las dos decisiones del owner, cumplidas:**

1. **«Precio neto = (venta − acciones comerciales) / unidades. Llámalo "precio neto después de acciones".»**
   Construido, con ese nombre exacto — el nombre era parte de la orden: la casa ya encadenaba *precio de lista*
   y *precio realizado*, y un tercer «precio» sin apellido es una ambigüedad de rótulo. ⚠️ **Los tres términos
   salen de la MISMA fila de ventas**: la venta de la tabla de ventas y la de la tabla de margen son cifras
   distintas para la misma cuenta ($19.4M vs $18.5M), y cruzarlas produciría un precio que no existe en ningún
   universo. El gate lo mide: el neto es el realizado menos su carga, con el dato al lado.
2. **«Apaga mix por cliente estimado.»** `entityComposicion` ya no sirve la composición por familia dentro de
   una cuenta: salía de una matriz repartida por ajuste iterativo, y sobre un archivo real le asignaba a un
   cliente una familia **que nunca compró**. No se borró — **declina con su motivo y ofrece el corte que sí es
   dato** (el mix por familia del negocio). Se enciende el día que la ingesta agregue el cruce desde las filas.

**Lo que NO se promete, y la letra se lo dice al cerebro con esas palabras:** el corte por **punto de venta /
sucursal**. El archivo del cliente lo trae y el motor no lo lee ni una vez — queda como **trabajo de ingesta**,
declarado por orden del owner.

**Gate:** `_agente_porque_gate.mjs` §9 (34 chequeos): cada lectura declarada **existe en el motor** (una lista
que prometa un `focus` inexistente haría que el motor sirva otra cosa en silencio) y **responde con cifras
autorizadas**; el precio neto lleva el nombre pedido y su cuenta cierra; el mix estimado declina sin colar una
sola cifra; y el punto de venta no aparece como eje. De paso, la línea base del gate de divulgación bajó de 100
a 30 cifras — no porque la poda ahorre menos, sino porque el mix estimado dejó de aportar.

## 18 · LOS CINCO CIERRES DE LA CERTIFICACIÓN (owner 2026-09-09)

Siete auditores adversariales atacaron la descomposición. Cuatro focos fallaron y el owner ordenó cerrar cinco
cosas. **Y la propia certificación tuvo dos falsos positivos que casi reporto como reales** — la lección de la
casa otra vez: cuando todo sale rojo a la vez, sospechar del instrumento.

**Los falsos positivos, para que no se re-descubran:** (a) «las tres cifras de la descomposición nunca pasan el
muro, 12/12» — falso: la sonda del auditor (y la mía en el primer intento) omitía `datoProyectado`, sin el cual
guardC ni siquiera corre bien. Con el arnés completo, la cifra principal pasa. (b) «la frase que el owner
rechazó vuelve a salir verde» — falso: recibe veto, y el composer además la corrige con el dato real.

**Los cinco cierres:**

1. **Una bodega no es una sucursal.** *Reproducido:* «¿cómo viene la sucursal Santiago?» se resolvía con la
   ficha de la **bodega** Santiago — capital de inventario servido como la lectura de un local. En este dato
   hay bodegas con nombre de ciudad. Ahora la ficha se retira ante una pregunta de punto de venta, y cuando
   otra lectura responde por cliente **declara qué corte pidió el usuario y por qué no existe todavía**.
   Preguntar por la *bodega* sigue funcionando: se cerró la confusión, no el eje.
2. **La descomposición se cita en paquete.** Medido: «el efecto volumen es +5.7%» **sola se veta** —ese +1.8%
   coincide con la cifra de otra cuenta y sin el total al lado no se puede atribuir—; las tres juntas pasan.
   La ley se lo dice al cerebro en vez de que lo descubra a golpes de veto.
3. **La advertencia del mix llega a ADI.** El «precio realizado» es venta÷unidades y **sube si cambia la
   mezcla de quién compra, sin que se haya movido ningún precio**. El motor escribe la salvedad pero se pierde
   antes de llegar; ahora la lleva la ley: decir «subiste precios» a partir de él es una causa inventada.
4. **Un canal «—» no es un canal.** ⚠️ **Este defecto lo abrió esta tanda**: al habilitar el eje canal, un
   archivo sin esa columna (es opcional) metía a todos los clientes en el grupo `"—"` y la lectura respondía
   *«el canal — tiene margen 25.1%, recuperar 1pp vale $1.0M»*. Ahora, sin un solo canal declarado, el eje no
   existe y la herramienta declina. Con la columna puesta, sigue respondiendo.
5. **La divergencia de marca: verificada, declarada, NO tocada.** En el escenario que muestra la app, la tabla
   de ventas dice Samsung **33.158** y la de margen **31.600** — y `entityProfile`, `queryMetric` y
   `entityRecord` publican **la segunda**. O sea: ADI y la pantalla darían cifras distintas para la misma
   marca, en 4 de 4 marcas. **No se arregla acá a propósito**: `entityRecord.js` ya lo declara como pendiente
   del owner con su razón (*«cablear el eje MARCA completo mueve cifras de producto y sigue siendo decisión del
   owner»*) y la función que reconcilia existe sin usar. El gate no exige que coincidan: exige que el pendiente
   **siga declarado** donde alguien lo vaya a leer, y publica la medición.

**Gate:** `_agente_porque_gate.mjs` §10 (15 chequeos). Total del gate: 149.

## 19 · UNA SOLA VERDAD PARA EL EJE MARCA (owner 2026-09-09)

**Su palabra:** *«No quiero dos verdades para el eje marca. Si el usuario ingresa marca en la planilla, Sentrix
y ADI deben decir lo mismo, en lo que sea. La decisión es una sola verdad: pantalla y agente usan la misma
cifra reconciliada.»*

### Antes y después, las cuatro marcas del demo

| Marca | Pantalla | ADI (antes) | ADI (ahora) |
|---|---|---|---|
| Samsung | $33.2M | $31.6M | **$33.2M** |
| Philips | $29.4M | $28.0M | **$29.4M** |
| LG | $25.8M | $24.6M | **$25.8M** |
| Bosch | $11.5M | $11.0M | **$11.5M** |

### Por qué se movieron

Cada marca tiene **dos tablas**: la de venta (que pinta la pantalla) y la de margen (que respondía ADI). La
primera se ajustaba con el escenario; la segunda estaba **declarada ciega** (`scenarioLoad: null`), así que se
quedaba con el número base. No era un error de cálculo: era una **declaración** en el contrato de datos. La
función que reconcilia —`applyScenarioToMarcasMargen`— existía **sin usar** desde 2026-08-03.

Ahora esa función está cableada en el manifiesto: toma la venta de la misma fuente que pinta la pantalla y
**re-deriva** contribución y costo conservando el margen% de cada marca (el margen es su eficiencia, no se
recalcula). El arreglo va en **el contrato, no en cada herramienta**: todo consumidor que pase por el
manifiesto recibe la misma cifra — que es la definición de «una sola verdad» de esta casa.

**Las cifras que se movieron son las de ADI, no las de la pantalla.** La pantalla ya decía lo correcto.

### Consecuencia que el candado del tipado obligó a declarar

Al reconciliar, la contribución de marca deja de ser un literal y pasa a ser **derivada** en los escenarios con
transformación — igual que ya pasaba con familia. Su sello cambió de `probado` a `indicado` ahí, y sigue
`probado` en «actual», donde la función hace bypass y sirve el literal. Lo cazó `_tipado_cifra_gate`, que es
exactamente para lo que existe: **si una cifra cambia de naturaleza, su sello tiene que decirlo.**

### Con la planilla de un cliente

Un pack de ingesta no declara transformaciones de escenario, así que la reconciliación **hace bypass y sirve la
tabla tal como vino del archivo — ni un número cambiado.** Verificado también en el segundo tenant del repo
(5 marcas, cero divergencias).

### El candado: `_una_verdad_por_eje_gate.mjs` (21 chequeos)

No verifica el arreglo, verifica **la propiedad**, que es lo que hace que no vuelva:
1. Para **cada eje** (marca, familia, cliente) y **cada escenario**, la tabla de ventas y la de margen dicen la
   misma cifra.
2. Lo que **ADI publica** coincide con la fuente que pinta la pantalla — una tabla reconciliada que ninguna
   herramienta usa no sirve de nada.
3. **Ningún eje agregado se declara ciego al escenario** — persigue la raíz en la declaración, no el síntoma.
   `skusMargen` es la excepción declarada: es la base de la que se derivan los agregados, no un agregado.
4. Con planilla, la tabla sale intacta.

Probado revirtiendo el arreglo: **8 chequeos se ponen rojos**.
