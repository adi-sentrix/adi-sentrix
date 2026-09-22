# Notario v3.1 · «cada palabra tiene dueño» — lo que la ronda 5 enseñó y cómo se cierra de raíz (2026-09-17)

Para el owner (jc). Conclusión primero; el detalle técnico va al final y es mío.

## 0 · Conclusión en una página

La ronda 5 (888 casos, 17 agentes, offline) mostró dos cosas a la vez:
- **Una verdad parcial le presta verdad a una afirmación falsa.** Si el cerebro ancla una cifra verdadera y en el mismo tramo escribe «más que
  Falabella», «el mayor», «en caída», «tercero», el Notario aprueba el tramo porque la cifra es verdadera. 183 de 314 mentiras llegaron a pantalla
  (58 %); 66 de ellas por esa sola grieta. El libro, además, acepta hechos que dicen menos de lo que la prosa dirá (un orden sin dirección, una
  proporción sin cota, un hecho de otro período sin su marca).
- **El Notario frena lo verdadero cuando la forma cambia.** 57 % de las respuestas verdaderas salió verde a la primera y 34 % cayó al respaldo,
  y las causas principales no son de idioma: la casa no se reconoce a sí misma (el nombre «Capital frenado» leído como un estado suelto; «Variación
  vs año anterior» leído como una tendencia sin ancla), lee «más de ocho meses» como una cifra exacta y mira negaciones a tres palabras de distancia
  en vez de en la frase.

Las dos cosas tienen la misma raíz: el Notario v3 comprobaba el ancla con una **lista de reglas parciales** (una por clase de palabra), y una lista
siempre deja huecos. La solución no es agregar reglas ni restringir cómo habla ADI: es cambiar el principio.

**Principio v3.1 — cada palabra con carga de verdad tiene un dueño.** Dentro de un ancla, todo lo que afirma algo (una cifra, «el mayor», «más
que», «en caída», «en mora», «desde hace seis meses», «la mayoría», «Falabella», «en Valparaíso», «el año pasado», «no») tiene que estar
respaldado por UNO de los hechos anclados que lo diga. Lo que no tiene dueño no se sirve; y el reintento le dice al cerebro exactamente qué
palabra quedó sin hecho, para que agregue el hecho (una comparación → una relación), no para que escriba distinto. Una verdad ya no presta nada:
solo cubre sus propias palabras.

Y su espejo: **la casa se reconoce a sí misma primero.** Antes de buscar afirmaciones, el Notario marca sus propios nombres (métricas, estados,
conjuntos, títulos y menús de la casa) como unidades enteras; así «Capital frenado» es una métrica y no un estado suelto, y «Variación vs año
anterior» es un nombre y no una tendencia. Eso quita la mayoría de los frenos falsos y deja de tumbar al propio respaldo.

Lo que NO cambia: ADI sigue escribiendo libre (tablas, rankings, comparaciones, tendencias, recomendaciones, ironía); el protocolo que recibe el
cerebro es el mismo; no hay reglas nuevas de lenguaje. Cambia lo que el Notario exige del libro y cómo lee el ancla.

## 1 · Qué falta en el diseño, según la ronda 5 (16 raíces → 4 faltas)

| Falta de diseño | Raíces de la ronda 5 | Roturas | Ejemplo servido en verde |
|---|---|---|---|
| **A · Verdad prestada**: el ancla no exige que cada palabra de afirmación tenga un hecho de su clase; una lectura es refugio; las cifras escritas no se reparten por sujeto | R1, R1b, R3, R5, R10, R11 | ≈ 97 | «Sodimac vende $8.2M, más que Falabella con $19.4M» (cifras verdaderas, comparación falsa) |
| **B · El libro dice menos que la prosa**: orden sin dirección, proporción/cota sin tabla, período sin marca, contrato tipado sin validación, ranking parcial leído como eje entero | R2, R6, R7, R8, R13, R12 | ≈ 60 | «Lider es el que MENOS te debe, con $9.8M» (orden `max` sin dirección: 4e no corre) |
| **C · La casa no se reconoce**: nombres de métrica con palabra de estado, «año anterior» en un nombre, cotas leídas como exactas, operadores por ventana de 3 palabras | falsos positivos §3 del informe (87 formas) + degradaciones del respaldo | 108 verdaderos al respaldo | «¿Cómo vienen las ventas contra el año anterior?» → respaldo VACÍO con 170 cifras en la boleta |
| **D · Léxico como datos** | R16 (+ R9 bodega) | 43 | «Sodimac es de fiar» sin hecho de cobranza («de fiar» no está en el catálogo de estados) |

## 2 · La solución (cinco piezas, una idea)

1. **Atribución total dentro del ancla** (reemplaza a las 13 comprobaciones parciales 4a–4m, 5, 6 y la parte interna de la 7 por UNA): el ancla se
   parte en unidades con carga de verdad —cifras y números en palabras, cotas («más de», «casi»), fracciones, marcas de clase (superlativo, ordinal,
   comparativo, variación, duración, proporción, matiz), estados, métricas, entidades, universos y bodegas, período, negación, modalidad— y cada
   unidad tiene que ser propiedad de un hecho anclado que la porte (la cifra ∈ sus números; «el mayor» ∈ un orden con esa dirección y ese puesto;
   «casi el doble» ∈ una relación con ese matiz; «en mora» ∈ un estado; «Falabella» ∈ sus roles; «el año pasado» = su período; «no» solo por un
   estado complementario o un conteo cero; hipotético jamás). Un hecho anclado aporta al menos una unidad (el núcleo). Lo sin dueño = un solo veto,
   `sin-dueño`, con la palabra y el hecho que falta. Una **lectura** no porta unidades de hecho de ninguna clase (solo su sello, la entidad de su
   apoyo y palabras de recomendación); una **propuesta** solo se sirve con su sello o en condicional.
2. **El libro exige lo que la prosa podrá decir**: validación de esquema al entrar (tipos, enums exactos, listas, `k` entero, ejes, sujeto del eje,
   unidad del valor de una razón); dirección obligatoria en un orden (por definición `max` = mayor, `min` = menor); un hecho de período distinto del
   vigente lleva su marca en el ancla; **tabla de cotas y proporciones de la casa** («la mayoría» > 50 %, «casi todo» ≥ 80 %, «buena parte / el
   grueso» ≥ 50 %, «casi la mitad» 40–50 %, «más de N» = cota, «el doble» 1.9–2.1, «casi el doble» 1.6–2.0…) contra n/m, razón o k; un ranking que
   solo trae parte del eje contesta mínimos y «menor que» solo si la métrica declara que lo ausente vale 0 (capital frenado, no capturada) — si no,
   no verificable; `{id.m}` solo junto a `{id.n}`; partitivos («de esos», «de los cuales») exigen razón o universo anidado.
3. **La casa se reconoce a sí misma primero**: en todas las lecturas (dentro y fuera del ancla, rótulos y cabeceras) los nombres de la casa se
   marcan como unidades enteras por coincidencia más larga —métricas (incluidas «Estado del inventario: capital frenado» como claves propias),
   estados, conjuntos, títulos y menús que la propia casa escribe—; el alcance de un operador (negación, tiempo, modalidad) es su **cláusula**
   (cortada por `;` `:` `—` y punto), no una ventana de tres palabras; los adjetivos de la casa traen dirección («más nuevo» = menos días).
4. **El render sustituye lo escrito**: toda cifra escrita por el cerebro dentro de un ancla se reemplaza por el canon del hecho que la porta (hoy solo
   los placeholders); ninguna marca `{{ }}`/`⟦ ⟧` puede quedar en pantalla (veto). La propiedad «ningún dígito lo escribió el modelo» pasa a ser
   verdad medible en los 888 casos.
5. **El respaldo bajo la misma regla, sin degradarse**: la casa ancla «métrica + valor» (no solo el valor); sus composers dejan de caer por su propio
   léxico gracias a la pieza 3; la comprobación 11 (recomendación de crédito/cobranza con apoyo del dominio) se implementa; las 32 líneas de datos
   de la ronda (§4.1 del informe) entran a `lexico.js`/`estados.js`.

## 3 · Cómo se mide (antes de tocar una línea)

Los 888 casos de la ronda 5 pasan a ser un fixture y un gate (`_ronda5_gate`): 0 falsedades servidas (las 183 confirmadas + las 22 familias del
libro), verdaderos verdes a la primera ≥ 90 % (hoy 57 %), verdaderos al respaldo ≤ 3 % (hoy 34 %), degradaciones del respaldo con flag = 0 (hoy 7
de 34), dígitos del modelo en pantalla = 0, llamadas por turno ≤ 3. Después, ronda 6 fuera de muestra con UltraCode (formas nuevas), y solo con
eso en verde: E6 (retiro del Notario viejo) y E7 (piloto vivo, gasto a nombrar).

## 4 · Decisiones de producto (mi recomendación entre paréntesis; si no dice lo contrario, avanzo así)

1. Una lectura (interpretación o recomendación) no contiene léxico de hecho de ninguna clase: ni cifras, ni superlativos, ni «viene cayendo» (sí).
2. Tabla de cotas y proporciones de la casa (sí, con los valores de la pieza 2; cualquier ajuste es una línea de datos).
3. «Debe» a secas = saldo pendiente; «deuda total» y «por cobrar» = pendiente (sí).
4. Una propuesta o supuesto («si cobraras $5.0M») nunca se sirve en indicativo como si fuera un hecho (sí).
5. Lo ausente en un ranking parcial vale 0 solo para las métricas que lo declaren (capital frenado, capital inmovilizado, contribución no capturada);
   en las demás, un mínimo sobre un ranking parcial no es verificable (sí).

## 5 · Nota técnica (mía)

- `anclas.js` pasa de trece comprobaciones internas a un atributor (`unidadesDe(ancla)` → `dueñoDe(unidad, hechos)`), con las listas que ya existen
  como datos; las comprobaciones externas (3, 8, 9, 10) siguen, pero leen el texto con la casa enmascarada primero (pieza 3).
- `hechos.js`: `validarHecho`/`validarUniverso`, dirección por defecto, `periodoExigido`, `COTAS` de `lexico.js`, `ausenteVale0` por clave, `m` con
  `n`, operandos por id de hecho, `derivada.op` alineada con el protocolo.
- `anclar.js`: la cifra de la casa ancla «métrica + valor»; `renderizar` reemplaza cifras escritas; veto de marcas residuales.
- Datos: §4.1 del informe entero (lexico, estados, claves de estado del inventario, tabla adjetivo→dirección, complementos).
- Orden: gate de los 888 → pieza 3 (quita los frenos falsos) → pieza 1 (cierra la verdad prestada) → pieza 2 (el libro) → 4 y 5 → ronda 6.

## 6 · Lo hecho (2026-09-22, offline; sin deploy ni gasto)

Las cinco piezas están en `dev` sin publicar, detrás de `ADI_NOTARIO_V3` (apagado). Medido con los 888 casos de la ronda 5
(`_ronda5_banco.mjs`; el candado `_ronda5_gate.mjs` corre el libro y la casa enteros y 1 de cada 4 casos de turno):

| Canal | Antes (E4) | Ahora |
|---|---|---|
| Turno (el modelo): falsedades servidas | 183/317 = 58 % | 1/317 = 0.3 % (la divergencia aceptada A37) · 0 fuera de las aceptadas |
| Turno: verdaderos verdes a la primera | 178/298 = 60 % | 178/298 = 60 % (64 % en la muestra 1/4 del gate) |
| Turno: al respaldo | 31 % | 29 % |
| Libro (canal 1): falsos que salen verdaderos · verdaderos bloqueados | 105 · 21 | 0 · 0 (de 440) |
| Casa (respaldo): falsedades servidas · verdaderos bloqueados | 21 de 46 · — | 0 · 0 |

La meta de verdad (§3: 0 falsedades servidas) se cumple salvo la divergencia aceptada; las metas de fluidez (verdes a la primera ≥ 90 %,
al respaldo ≤ 3 %) NO se alcanzan todavía: 60 % y 29 %. De los 65 verdaderos que no salen verdes a la primera, 30 son «hecho-invalido» (el
libro rechaza el hecho declarado por el propio agente: empates reales del dato, esquemas incompletos), 14 lecturas con léxico de hecho (decisión 1)
y 11 hechos fuera de ancla; el bucle los re-ancla en +1 llamada, y la ronda 6 medirá cuánto de eso es del protocolo y cuánto de la casa.

Lo que cambió, por pieza:

- **El libro exige lo que la prosa podrá decir** (`hechos.js`, `verificar.js`): validación de esquema antes del veredicto (universos vacuos, uniones
  de un solo eje, estados contradictorios, filtros con unidad o referencia de otra familia —benchmark↔margen, nivel de carga↔carga, umbral↔dinero
  comercial, piso↔rotación, techo↔cobertura—, métricas genéricas fuera, ejes sin entidades); empates en el extremo, en el puesto y en el corte de un
  top; rankings parciales también por figs; razón sin lista de pares (solo vacua, unidades y universos que no reconcilian —inventario contra
  comercial/cobranza—); derivadas: operandos por resultado de otra derivada, parte-y-todo entre métricas contenidas, total-y-parte solo en sumas,
  «cociente», signo, la cuenta sobre los operandos tal como se muestran; grupo con universo tipado y «promedio»; «no_<estado>» = negación; el
  «de M» de un conteo = el eje, la base o el conjunto por estados con una restricción más; «debe» a secas = pendiente (decisión 3; un vencido se dice «tiene vencido»), «deuda total»,
  «por cobrar», «sin cobrar» = pendiente; verbos de la casa como conceptos («vende», «te compró»); el léxico casa por palabra («inventario» no
  contiene «venta»).
- **Cada palabra tiene dueño** (`anclas.js`): la cláusula muda tras una coordinación hereda el verbo; el multiplicador y el MATIZ escritos fijan el
  rango («más del doble» con 1.83× no cierra); la proporción dicha se contrasta con la cota de la casa (tabla `COTAS_DE_PROPORCION` en `lexico.js`);
  «todos tus clientes» sobre un conteo parcial es falso; el k escrito de una exclusión y el sustantivo de eje junto a `{n}` son los del universo;
  una bodega dicha (o un encabezado de bodega) exige el hecho con esa bodega; un grupo no se atribuye a uno solo; el operando de una razón no se
  viste de la otra métrica; el sujeto de un superlativo coordinado es el de la cláusula; una recomendación dentro de un ancla de hecho no es un
  hecho, y una recomendación de crédito en una lectura necesita apoyo de cobranza; la proforma continúa el hecho de la oración anterior del mismo
  párrafo; fuera de las anclas no hay retractación, ni métrica pegada a un ancla, ni bodega, ni pertenencia con entidad, ni nota al pie con
  período, ni la base de una tasa; la fila «Total» con un grupo que no suma lo que la tabla muestra; las menciones se resuelven primero por
  concepto exacto del léxico (sole owner) y después por el muro; la base de una participación es el universo de su fig.
- **La casa se reconoce a sí misma** (`anclar.js`): la cifra de la casa ancla su CLÁUSULA (hasta la conjunción, el corte o la siguiente cifra);
  el rótulo antes de los dos puntos es el nombre del valor; varias entidades con la misma cifra y el mismo concepto se anclan juntas; un estado de
  la casa dicho en la cláusula de un SKU se declara y el libro lo verifica; una bodega que la proyección declara para el SKU no es «ajena».
- **Falsos positivos por significado**: «compresor» no es «compra»; una forma del catálogo («ni una factura vencida» = al día) manda sobre la
  palabra negada; «un/una» es artículo; una fracción en palabras se contrasta con la proporción real (±10 puntos); las palabras de variación las
  cubre la cifra de una métrica de variación; un superlativo lo cubre un conteo cuyo universo es un top; en una lectura, una entidad que algún
  hecho nombra no es ajena y «el primero que liquidaría» es criterio; dos valores de la misma familia con unidades distintas (% y $) no son
  ambiguos; una VARIACIÓN nombra su métrica («la venta crece {h}»), una tasa no se viste de su base («lidera en venta» con un orden de margen).

Gates: `_hechos_gate` 132/132 · `_anclas_gate` 79/79 · `_notario_v3_flujo_gate` 71/71 · `_anclar_composers_gate` 57/57 · `_ronda5_gate` 9/9 ·
`_agente_playbooks_gate` 455/455 (el complemento «capital sano» de «frenado» salió del catálogo compartido: vive en `COMPLEMENTO_V3`, porque el
juez v2 leía «no está frenado» como un punto de «capital sano» sin declarar). Suite completa offline: ver `_VERSIONES.md`.

## 7 · Divergencias aceptadas y decisiones pendientes (para el owner)

Aceptadas (documentadas en las notas `nota_v31` de `fixtures/ronda5-2026-09-17/hechos.json`):

1. Un empate en el extremo, en el puesto o en el corte de un top no es verificable («Hites es el que menos debe» con siete cuentas en $0).
2. Un universo con un estado y su complemento está vacío por construcción: no es un hecho («0 clientes en mora y al día»).
3. Lo ausente en un ranking de capital frenado vale 0 (decisión 5): «las 2 bodegas con menos capital frenado» son las dos sin capital frenado.
4. «Inmovilizado» (estado ≠ Activo) convive con «capital sano» (= no frenado): no hay contradicción en la proyección.
5. La cuenta sobre los operandos tal como se muestran también vale ($9.8M − $4.6M = $5.2M aunque el exacto sea $5.3M; la casa renderiza el canon).
6. La fila «Total» de una tabla suma lo que la tabla muestra (A37 sigue siendo una falsedad para el agente de la ronda 5; aquí se acepta).

Pendientes de decisión (hoy conservan la calibración vigente):

- **El múltiplo a secas**: la propuesta decía «el doble» = 1.9–2.1; la cota calibrada de la casa es ±15 % («2×» para 1.83 en la línea base de la
  fase 3; «seis veces» para 6.33 en los cuatro puntos) y se conserva. Con el matiz escrito («más del doble», «casi el doble») manda el rango del matiz.
- **«Buena parte» y «el grueso»** quedaron en > 50 % (decisión 2); un caso verdadero de la ronda decía «buena parte» con 46 %.
- **Las lecturas con léxico de hecho** («más caro que», «un tercio», «caída», «el primer») siguen vetadas por el contrato (decisión 1): son el 10
  de los 30 verdaderos que no salen verdes a la primera; el bucle los re-ancla en +1 llamada.
