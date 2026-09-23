# ADI producto final — el plan del resolvedor

> Encargo del owner (2026-09-22): «planifiquemos ADI como producto final, no como una suma de mecanismos… no quiero una
> arquitectura que necesite una regla nueva cada vez que el modelo encuentra una forma nueva de expresarse… no quiero
> elegir entre naturalidad y seguridad, quiero ambas… explicame cómo sabremos que ADI finalmente se siente premium».
> Ley del socio, permanente: **ADI y Notario evolucionan juntos** — ninguna capacidad nueva está terminada hasta que el
> Notario pueda verificarla con candado propio.
>
> Estado: PLAN, sin implementar. Nada de esto está en código. Sin deploy ni gasto vivo.

## 1 · El diagnóstico (medido, no opinado)

**El trinquete no es de una arquitectura: le pasa a cualquier módulo que se ponga a JUZGAR PROSA.** Juzgar redacción
obliga a enumerar redacciones; las redacciones son infinitas; cada regla captura también prosa verdadera; cada falso
positivo exige una excepción; cada excepción abre un hueco. La cuenta solo sube: rondas 1→4 dieron 69 → 91 → 100 → 108
roturas, y la ronda 4 quedó SIN CERRAR. Se cambió de arquitectura, y la ronda 5 sobre el diseño nuevo volvió a dar 58 %.
**La misma forma dos veces.**

Inventario completo de las tres capas (2026-09-22):

| Capa | Tamaño | Qué es realmente |
|---|---|---|
| `guardC.js` (v2, EN PROD) | 8.034 líneas · 64 códigos | **Anti-mentira**, no rígida. Solo 2-3 códigos son forma pura (`tabla-no-autorizada`, `clarify-con-tabla`). Compara cifras en prosa contra la boleta → con el libro + render esa tarea queda VACÍA: los dígitos servidos los escribe la casa. Es **redundante**, no rígida. |
| `hechos.js` (v3, 1ª mitad) | 610 líneas | **La pieza correcta.** Verifica verdad en un espacio finito y tipado. Medido: 0/440 falsos que salen verdaderos · 0/440 verdaderos bloqueados. |
| `anclas.js` (v3, 2ª mitad) | 1.118 líneas · **55 códigos** | **Aquí vive la rigidez.** Vuelve a juzgar CÓMO se escribió un hecho que `hechos.js` ya probó cierto: posición, léxico cerrado, pronombres, negación, modalidad, geometría de tabla. Su propia cabecera: «ninguna de estas comprobaciones es gramática» y «lista CERRADA… (residuo declarado)». |
| `contratoAgente.js` | — | La de **mejor trazabilidad** (casi cada veto cita al owner con fecha). Rigidez acotada: 13 entradas de léxico sin respaldo + `formato-de-informe` + vetos de modo verbal. |

`src/adi/notario/` es **≈10 % dato / ≈90 % lógica** (420 líneas contra 3.805). Los datos escalan; los condicionales no.

**La causa raíz, formulada:** en las dos arquitecturas la casa asumió que, después de saber la verdad, su trabajo era
**juzgar si la redacción la respeta**. No es un error de método (ventanas, listas): es un error de **ROL**. Por eso el
diagnóstico de 2026-09-14 («ventanas y listas en vez de estructura») corrigió el método sin corregir el rol, y el
síntoma reapareció en el módulo siguiente.

## 2 · El arreglo: `anclas.js` deja de ser juez y pasa a ser RESOLVEDOR

Si `hechos.js` ya probó que el hecho es cierto, lo único que hace falta saber es **a qué hecho corresponde cada tramo de
prosa**. Eso es RESOLUCIÓN de referencias (texto → id), no veto. El resolvedor hace tres cosas y solo una puede multar:

1. **Resolver** el mapeo tramo→hecho. Si el modelo ancló, ya está. Si no: la casa resuelve por valor o clase → pide el
   mapeo con prosa congelada → marca el tramo.
2. **Renderizar** desde el hecho todo lo que el hecho sabe: valor, dueño, métrica pegada a cada valor, universo, base,
   período, rótulo de tabla, cola de top-N, marca de propuesta. **Todo lo que hoy se exige al modelo por veto y la casa
   puede escribir sola.** Es el patrón que ya funcionó con el sello de período (de veto con ~33 % de caída → frase
   agregada en silencio).
3. **Detectar contradicción** entre lo que la oración dice y lo que el hecho verificado dice, solo en los **grados de
   libertad** que el render no puede fijar porque son verbos o adjetivos del modelo.

**Tope duro que NO se toca:** un dígito, una dirección temporal, un orden o un período **no se degradan a opinión**. Si
no se resuelven, no se sirven (regeneración o render del libro). *«Ningún dígito servido lo escribió el modelo»* se
mantiene íntegra.

### Destino de los 55 códigos

| Destino | N | Qué significa |
|---|---|---|
| **A** · la casa resuelve o renderiza sola | 20 | 0 llamadas, invisible |
| **B** · pide el mapeo con prosa congelada | 10 | 1 llamada, invisible (prosa byte a byte) |
| **C** · contradicción real → regeneración desde el libro corregido | 24 | 1 llamada |
| **D** · migra al libro/esquema | 2 | — |

Los 8 más reveladores (`universo-invisible`, `base-invisible`, `periodo-invisible`, `base-sin-metrica`,
`rotulo-sin-metrica`, `celda-sin-estado`, `columna-mezclada`, `ancla-ambigua`) dicen textualmente «el ancla tiene que
escribirlo con `{h.universo}`»: **la casa sabe el valor, tiene el placeholder, y en vez de escribirlo multa al modelo por
no haberlo escrito.** Es la obligación del producto puesta sobre el narrador — el defecto que el equipo ya identificó y
corrigió una vez.

Y lo decisivo: **los 24 C no son 24 funciones.** Se reducen a una matriz `tipo de hecho × grado de libertad` (~19
celdas) con ~12 lexicones de clase (dirección · lados · operación · estado · ordinal · cota · multiplicador · período ·
universo · métrica · bodega · negación/modalidad), todos como DATOS en `lexico.js`. La lista vieja era cerrada **por
declaración** y tenía 55 entradas; la matriz es cerrada **porque se deriva del esquema**.

`lectura-con-hecho` (la «decisión 4» del owner) pasa a clase A: una lectura puede llevar cifras **si señala su hecho**.
Lo que no puede es afirmar sin declarar. **La decisión 4 queda disuelta por diseño.**

## 3 · La doctrina de la reparación invisible

| Clase | Condición | Costo | Qué ve el usuario |
|---|---|---|---|
| **A** · autocorrección silenciosa | la casa sabe el valor y el arreglo es local | 0 llamadas | **nada** |
| **B** · re-anclaje | prosa correcta, mapeo incompleto | 1 llamada | **nada** (prosa congelada byte a byte) |
| **C** · regeneración desde el libro corregido | el libro contiene un hecho falso | 1 llamada | casi nada |
| **D** · entrega desde el libro | el modelo no responde o agotó el presupuesto | 0 llamadas | perceptible pero **fiel a SU análisis** |

Cambios de diseño respecto de hoy:
- **La poda se elimina del camino v3.** Hoy borra hasta 2 oraciones y rejunta con un espacio, sin marca de elisión y sin
  reparación de discurso: puede servir un texto cojo y nadie lo lee. En v3 no hace falta: A, B, C o D lo cubren.
- **Una lectura cuyo apoyo cite un id vetado NO se borra**: se le quita ese apoyo; si conserva uno válido, sobrevive. Hoy
  se borra aunque esté impecable — destruye justo lo que el owner más pide.
- **La reescritura por tramos se reemplaza por regeneración completa** desde el libro corregido, con la misma voz y sin
  mención del error. Hoy la costura de estilo nace de redactar bajo la multa a la vista.
- **Se retira** el peldaño «respaldo = re-cita de lo último aprobado»: responde a otra pregunta; es peor que declinar.
- **Presupuesto de turno** (hoy NO existe): máximo 3 llamadas del ciclo notarial y un timeout de turno completo. Hoy el
  peor caso estructural son **7 llamadas** y solo hay timeout por llamada (90 s).

## 4 · El estándar premium — «cómo sabremos que se siente premium»

**Siete dimensiones.** Seis por rúbrica 1–5 con descriptor anclado por nivel, fijada y versionada ANTES de medir:
comprensión · hilo · criterio · honestidad epistémica · naturalidad · profundidad ejecutiva. La séptima, **verdad**, es
binaria (0 falsedades materiales) y la juzga el Notario más auditoría humana de muestra, nunca el juez de calidad.

**El juez:** un modelo **de otra familia** que el narrador, con prompt congelado, **ciego al expediente** (no sabe si
hubo reparación). Recibe pregunta, historial, respuesta servida y la boleta. Razón: el sistema que produce lleva sus
preferencias de estilo en sus propios prompts; un juez de la misma familia premia esas preferencias.

**El comparador:** un modelo de primer nivel con los mismos datos y sin casa. Comparación por pares.
**La vara: ADI igual o mejor en comprensión, hilo, criterio, naturalidad y profundidad; ESTRICTAMENTE mejor en
honestidad y verdad.** Esa es la definición operativa de «un Claude de negocios que además respeta la verdad económica».

**Prueba de invisibilidad:** tarea aparte, el juez adivina si hubo reparación. Si acierta por encima del azar (> 55 %
sobre corpus balanceado), la reparación es visible → falla.

**Contra el interés de aprobar:** rúbrica, corpus y prompt del juez se hashean antes de cada corrida; una PR que toca al
agente no puede tocarlos (candado). Partición reservada del corpus. **Calibración humana:** owner, socio y dos externos
califican 30 casos con la misma rúbrica; acuerdo juez-humano ≥ 80 % o el juez se invalida.

**Umbral propuesto** (~120 conversaciones multi-turno): mediana ≥ 4 por dimensión · ninguna dimensión < 3 en más del
10 % de los casos · preferencia vs comparador ≥ 50 % en las cinco y > 60 % en honestidad · 0 falsedades materiales ·
invisibilidad ≤ 55 %.

## 5 · El plan por etapas

| Etapa | Qué resuelve | Se mide offline | Candado | Pre-piloto |
|---|---|---|---|---|
| **0 · Medir antes de mover** | ronda 6 (atribución modelo/casa, los 10 sin categorizar) · **shadow run**: el resolvedor contra el juez actual, y v2 en sombra con v3 decidiendo · telemetría **con agregación** (llamadas, tokens, latencia, modo de cierre, p50/p95) | tabla código por código | gate que falla si el promedio de llamadas supera el presupuesto | **sí** |
| **1 · Las 20 de clase A** | auto-anclaje, hecho `empate`, completado de esquema, cola automática, normalizador de superficie, dueño por render, lecturas con apoyo parcial | verdes 60 % → ≥ 80 % · respaldo 29 % → ≤ 12 % · falsedades ≤ 0,3 % | cada corrección A con un caso verdadero y uno falso | **sí** |
| **2 · «v3 decide, v2 opina» + migración de leyes al esquema** | v2 pierde el veto en el camino v3; un candado **por ley del owner** expresado contra el LIBRO | 0 falsedades con v2 apagado sobre 888 + corpus nuevo | cuenta de códigos solo baja · ninguna regex de frase nueva | **primera mitad** |
| **3 · Reparación invisible** | B y C rediseñadas · poda fuera · escalera colapsada · presupuesto de turno | estructural (ver limitación) | «la poda nunca corre en v3» · «ninguna lectura con apoyo válido se pierde» | **sí** |
| **4 · Vara premium** | corpus versionado multi-turno · juez congelado · comparador crudo | línea base | hash de rúbrica, corpus y prompt del juez | línea base |
| **5 · Piloto vivo** | obediencia real, latencia, costo, calidad percibida | — | tope de gasto diario · flag de retorno a v2 en un paso | — |

⚠️ **Limitación honesta de la etapa 3:** la reparación NO se puede medir con el cerebro mudo. Hace falta un **corpus de
repetición**: una corrida con gasto autorizado (una vez, cifra nombrada) que grabe las respuestas del modelo a los
pedidos B y C; después se repite offline para siempre.

**Orden de retiro:** primero `anclas.js` (resolvedor) → después `guardC.js` (cae por redundancia, no por decisión) →
último `contratoAgente.js` (el que menos molesta y más ley lleva).

## 6 · Por qué no va a pasar una tercera vez

Las dos veces anteriores la lista se «cerró» **por declaración**. Esta vez se **deriva**, y seis candados estructurales
lo vigilan sin depender del criterio de nadie:

1. **Nacimiento por esquema, nunca por frase.** Una comprobación nueva solo puede existir como celda de la matriz
   `tipo de hecho × grado de libertad`. Agregar una celda exige agregar un grado de libertad al esquema del libro y su
   verificación en `hechos.js`, con caso verdadero y falso. **Esto convierte la ley del socio en mecánica: no hay dónde
   poner una regla de frase.**
2. **El léxico solo crece en DATOS.** Toda palabra nueva entra en un lexicón de clase de `lexico.js`. Gate: el
   resolvedor no contiene expresiones regulares literales con texto español propio.
3. **Sin excepciones de ronda.** Una falla se cierra por un campo de render, una entrada de lexicón o un grado de
   libertad. Jamás por una excepción dentro de una función. Gate: el resolvedor no puede citar una ronda, una fecha de
   owner ni un caso — esas citas viven en los candados, no en el código.
4. **Cuenta monótona.** Códigos emitidos ≤ los del commit anterior. Proporción lógica/dato bajo el umbral de la primera
   versión (propuesta: el resolvedor no supera 400 líneas de lógica).
5. **Salidas finitas.** La respuesta a una falla es A, B, C o D. Una quinta salida es cambio de diseño con palabra del owner.
6. **La alarma temprana.** El indicador que se reporta por ronda deja de ser «roturas cerradas» y pasa a ser
   **«roturas cerradas SIN código nuevo»**.

Lo que estos candados NO impiden, y hay que decirlo: que `hechos.js` acumule reglas de esquema ad hoc. Ahí el freno es
más débil — cada tipo de hecho declara sus grados de libertad en un solo lugar y el gate compara esa declaración con la
matriz. Si el esquema crece, **crece a la vista**.

## 7 · Las tensiones entre natural y seguro

**Falsos dilemas que el diseño disuelve:**
- **Lecturas con léxico de hecho (decisión 4).** La prohibición existía porque el v2 no distinguía una lectura que
  declara de una que inventa. El ancla lo distingue. Una lectura puede llevar cifras si están ancladas.
- **Vocabulario del usuario.** Si el usuario dice «meta», ADI usa su palabra en eco y el hecho se tipa como benchmark.
  Vetar la palabra castiga la naturalidad sin proteger la verdad.
- **Reconocer lo que no puede demostrar.** Exige un tipo de hecho `limite` de primera clase: «no lo puedo demostrar con
  estos datos; lo que sí veo es…» es la respuesta premium, no un peldaño de rescate.
- **Sello de período una vez.** Ya disuelta por estado de conversación.

**Tensiones genuinas — decisión del owner:**
1. **Cero falsedades vs. fluidez.** Con reparación invisible el costo NO es naturalidad: es **latencia y gasto por
   turno**. El owner fija los segundos y los centavos aceptables.
2. **Conclusión del procedimiento vs. criterio del asesor.** La ley prohíbe cambiar cliente prioritario, veredicto y
   primera acción. Diseño que la suaviza sin violarla: un hecho `propuesta` con marca `criterio-asesor` que **agrega**
   una consideración sin sustituir el veredicto. ¿Se permite la segunda opinión marcada?
3. **Piso de modelo vs. protocolo.** El router arranca hoy en el modelo más económico y solo escala en reintento.
   Premium puede exigir subir ese piso. Decisión de costo.
4. **Registro formal vs. cero robótico.** Formal no es robótico, pero una lista de palabras vetadas que crece por
   sensación termina siendo un uniforme. Propuesta: la lista se limita a registro, no a calidez.
5. **Respaldo determinístico vs. una sola voz.** Se achica con el render del libro (dice lo que el modelo analizó).
   Queda perceptible solo en el playbook, que debería ser raro (≤ 3 %).

## 8 · Riesgos

- **Que el plan sea otra ronda de parches.** El riesgo principal, porque pasó dos veces con gente que sabía que estaba
  pasando. Mitigación: los seis candados de §6, que son estructurales y no de voluntad.
- **Medir reparación sin modelo.** Sin corpus de repetición (gasto autorizado una vez), las etapas 3 y 4 se verifican
  solo estructuralmente.
- ⚠️ **La obediencia real del modelo NUNCA se midió.** El banco corre con el cerebro MUDO; los 888 son prosa adversarial
  sintetizada. El «38 % de incumplimiento del modelo» **no es una tasa de obediencia de ningún modelo**: es la
  composición del corpus. Es una de las razones fuertes del piloto.
- **Latencia en el Complemento.** 7 llamadas en el peor caso sin timeout de turno es inaceptable para usuarios que vienen
  de GPT. **Sin presupuesto de turno no hay piloto.**
- **Sin boleta no hay Notario.** Si el archivo del usuario no entra bien al contrato de datos, no hay verdad contra la
  cual verificar y el libro queda vacío. **El frente «datos del cliente» pesa tanto como este plan.**
- **Corpus adversarial ≠ producción.** Los 888 sobrerrepresentan falsedades; el 60 % verde puede ser mejor o peor en
  tráfico real.
- **Juez capturado.** Si los prompts del narrador se ajustan al gusto del juez, la nota sube sin que suba el producto.
- **Flip v2→v3 en producción.** Debe ser un flag de un paso con retorno; «v3 decide, v2 opina» es el puente.

## 9 · Preguntas abiertas

- **Del owner:** decisiones 1-3 (total parcial · «el doble» · «el grueso») · segunda opinión marcada · alcance de la
  lista de registro · umbral de aprobación de la vara · segundos y centavos por turno · si acepta inserciones de la casa
  como etiquetas dentro de oraciones del modelo o prefiere placeholders explícitos (afecta a los 20 de clase A).
- **Técnicas:** qué códigos aportaron la caída 58 % → 0,3 % (sin eso, el shadow run es el único juez) · si la ronda extra
  de herramientas y el cierre forzado entran en el presupuesto de turno · qué señales de usuario captura el canal del
  Complemento.
