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
