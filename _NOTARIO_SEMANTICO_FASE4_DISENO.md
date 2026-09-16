# Notario semántico · Fase 4 — DISEÑO (2026-09-16) · ETAPAS A y B IMPLEMENTADAS en `dev` (§10, §11); ronda adversarial y etapa C pendientes

**Conclusión primero.** La fase 1 sacó la verdad de la redacción de la *prosa*: el veredicto depende de la afirmación, no de cómo se
escribió. Pero dejamos la verdad atada a la redacción de la *declaración*: hoy el modelo tiene que adivinar el idioma canónico de la
casa (cómo se llama el benchmark, dónde va el universo, qué puede ser un sujeto, qué unidad lleva una rotación). Ese conocimiento lo
tiene la casa —el índice de evidencia—, no el modelo. La fase 4 termina el movimiento de la fase 1: **la casa canoniza la forma; el
modelo aporta el significado y el ancla en la prosa; el estándar de verdad no se toca.** Cinco piezas, todas sobre módulos que ya
existen: (1) un **resolutor** que traduce la declaración del modelo a la forma canónica antes del veredicto; (2) una **carta de
hechos** por turno (las referencias, los conjuntos con su única definición, los rankings y las cuentas permitidas) para que declarar
relaciones y órdenes sea mecánico; (3) **derivadas de la casa** (brecha, diferencia, participación, suma de conjunto) verificables por
construcción; (4) el **protocolo del modelo v2** (bloque primero, un ejemplo por tipo, «toda comparación en palabras es una relación u
orden»); (5) **reparación de declaración con prosa congelada**: si la prosa no tiene falsedades y solo falta cobertura, se re-emite el
bloque sin reescribir el texto y se sirve la prosa premium original.

---

## 1 · El problema raíz (con la evidencia de la fase 3)

La fase 2 offline probó que el circuito funciona cuando la declaración es buena: 95,5 % correctas, 2,9 % omitidas, 0 FP, 0 FN.
La fase 3 en vivo probó que el modelo real no produce esa declaración bajo el protocolo actual — y que los errores **no son ruido,
son choques de convención**, siempre los mismos:

| Síntoma (fase 3) | Cuántas | Qué es en realidad |
|---|---|---|
| Sujeto = concepto («Benchmark de margen», «5 cuentas materiales», «los grandes», «total frenado») | 29 casos de rigidez (8,7 %) | El modelo nombra el hecho como lo VE en la boleta; la casa exige otra forma (entidad o «negocio» + métrica) |
| Universo escrito dentro de la métrica | 10 de esos 29 | Convención de campos, no un error de verdad |
| Grupo declarado con la lista de valores | 3 de esos 29 | Cinco cifras verdaderas comparadas contra un subtotal |
| Sinónimos que faltan («Markup promedio» ≠ «Markup sobre costo», «Cost share» ≠ «Peso del costo»), ranking que mezcla % con $ | 9 FP estrictos (2,7 %) | Vocabulario y unidades: trabajo del índice, no del modelo |
| Omisión real (extractor independiente): relaciones en palabras, superlativos, cifras derivadas | 14,8 % | Lo que no «parece» un hecho (sin dígitos) o no existe como fig (la brecha por familia) no se declara |
| 16 «declaración ajena» | — | El modelo parafrasea su propio fragmento en vez de copiarlo |
| Resultado de producto | premium servida 0/11 | Cada cierre vetado; el turno cae al respaldo aunque la prosa fuera esencialmente correcta |

**Raíz única:** el contrato de declaración obliga al modelo a hablar el canon de la casa, y castiga con `no-verificable` cada
desviación de forma. Es la imagen especular del defecto que mató al Notario viejo (38 % FP fuera de muestra por exigir que el muro
entendiera toda forma de *escribir* un hecho). La solución no es enseñar más canon al modelo a punta de reglas, sino dejar de exigirle
canon: **para un turno dado, los hechos verificables son un conjunto finito que la casa ya conoce** (boleta + proyección + referencias
+ conjuntos + rankings + cuentas permitidas). Declarar debe ser *señalar cuál de esos hechos se afirma y dónde*, no redactarlo en un
idioma nuevo.

## 2 · El diseño — cinco piezas y una opcional

### Pieza 1 · El resolutor (`src/adi/notario/resolutor.js`, invocado por `juez.js` antes del veredicto)
Traduce cada afirmación declarada a su forma canónica **sin tocar el estándar de verdad** (el veredicto sigue saliendo de
`verificar.js` contra la boleta):
- **Sujeto-concepto → negocio + métrica** (benchmark, nivel de carga, techo/piso, umbral), vía los sinónimos que ya existen.
- **Sujeto-conjunto → descripción + conjunto conocido** («5 cuentas materiales», «los que caen», «las sanas», «total frenado»), vía
  `_conjuntosConocidos` y los rótulos de agregados que el índice ya tiene.
- **Universo dentro de la métrica → se separa** en métrica + universo (mismos tokens que ya usa la casación).
- **Unidad implícita por la métrica** («rotación 1» → 1.0x; «115» en días de inventario → 115d), leída de la fig del índice.
- **Grupo con lista de valores → N cifras** (una por entidad, cada una verificada) + el subtotal si existe el agregado.
- **Relación contra un agregado o referencia** («75 % del total frenado») → el otro lado se resuelve a la fig del agregado.
- **Campos permutados** (entidad en `metrica`) → se enderezan; la verificación normal decide después.

**Regla dura de seguridad:** una resolución se acepta solo si es **única**; el valor declarado actúa de *checksum* (si el valor no
cierra con el candidato, no se resuelve). Empate o ambigüedad → `no-verificable` **con los candidatos nombrados en la multa**
(«¿quisiste decir Markup promedio · los que caen = 41,4 %?»), lo que hace la reparación casi mecánica. El resolutor a veces
**endurece**: «la más alta de toda la cartera» hoy queda NV porque el universo no resuelve; resuelto al eje entero, el veredicto
correcto es FALSA (Easy 5,5 % > Sodimac 5,4 %). Todo queda en el expediente: forma declarada + forma canónica + nota de resolución.

### Pieza 2 · La carta de hechos (por turno, junto a la boleta — no en el system: el caché no se toca)
Un bloque compacto (~300-600 tokens) generado del mismo índice: las **referencias** con su par métrico («Benchmark de margen 30,1 % —
se compara con Margen»), los **conjuntos** con su ÚNICA definición y tamaño («8 bajo el benchmark · 5 materiales (subtotal $4,9M) ·
6 sobre el nivel de carga»), los **rankings** disponibles por eje·métrica, y las **derivadas permitidas**. El generador exige
unicidad: si dos definiciones chocan (hoy: «carga alta» = umbral crudo > 3,5 % vs subtotal de diagnose), el gate se pone rojo y la
colisión sube como decisión de producto. La carta es una *vista* del índice — no un contrato paralelo.

### Pieza 3 · Derivadas de la casa (extensión de `_derivada` en `verificar.js`)
Cuatro cuentas estándar, verificables por construcción cuando sus insumos son figs únicas: **diferencia** (A−B), **brecha contra la
referencia del contrato** (métrica − su referencia, con el par de `REFERENCIA_CAMPO`/`benchmarkOf` — la ley de lectura mínima ya
define «la referencia autorizada por métrica»), **participación/razón** sobre un agregado o total, **suma de un conjunto declarado**.
Con la tolerancia de siempre (`tolCalculo`); la evidencia registrada son las figs de entrada. Esto convierte en verificables «brecha
de 3,5 pp» por familia, «$7,1M» (100,0−92,9), «$22K de los $33K» — hoy omitidas o NV. guardC sigue recomputando los `[[CALCULO]]`
explícitos; nada de esto lo reemplaza.

### Pieza 4 · Protocolo del modelo v2 (⚠️ toca la instrucción — contrato de ADI, exige tu autorización)
- **El bloque va PRIMERO, la prosa después** (el parser ya acepta el bloque en cualquier posición): el modelo declara mirando la
  boleta —copia rótulos reales— en vez de recordar su propia prosa. Riesgo de voz: se prueba A/B en la corrida de certificación.
- **Un ejemplo por tipo** y tres reglas nuevas: «toda comparación en palabras (mayor/menor/sobre/bajo/supera/el doble) es una
  relación u orden y SE DECLARA»; «el sujeto es una entidad del catálogo o "negocio" — una referencia del negocio va como métrica»;
  «`texto` es copia literal de tu prosa».
- La carta de hechos como vocabulario del turno.

### Pieza 5 · Reparación de declaración con prosa congelada (en el bucle)
Hoy la reparación reescribe la respuesta entera: prosa nueva → puntos nuevos → omisiones nuevas (medido: el ciclo no converge y el
turno cae al respaldo). Nuevo: si el cierre **no tiene falsedades ni inconsistencias graves** y los vetos son solo de cobertura o
forma, la reparación pide **solo el bloque** («declara estos N puntos; NO toques el texto»), con la lista exacta de puntos como
checklist. Se re-juzga la MISMA prosa con el bloque fusionado; si queda limpia, **se sirve la prosa premium original**. La checklist
es finita y monótona (prosa congelada = puntos fijos): converge. Tope: una vez; después, la escalera de siempre. Con una FALSA en la
prosa, la reparación completa actual sigue igual (la prosa debe cambiar). Nada se sirve sin verificar — la garantía no se mueve.

### Pieza 6 (OPCIONAL — decisión de producto) · Asistencia de identidad
Gran parte de la omisión de presencia son cifras planas que el modelo citó de paso («30,1 %», «3,5 %», «57,3 %») sin re-declarar.
`declaracionDeRespaldo` ya deriva declaraciones desde las figs para el respaldo (precedente aprobado en fase 2). Propuesta: extender
esa asistencia al cierre SOLO para **puntos-cifra verbatim con dueño único en su cláusula**, verificados VERDADEROS, marcados
`derivada-asistida` en el expediente. **Nunca** relaciones, órdenes, grupos ni conteos — esos cargan significado y los declara el
modelo. Si prefieres el principio estricto («el modelo declara todo»), la pieza se omite y la reparación de declaración absorbe esos
puntos con una llamada barata.

### Deudas de evidencia que la fase 3 destapó (emisores, misma clase que las saldadas en fase 2)
Los estados de la Mesa Capital como figs (quiebre próximo $36K, sobrestock $10K, «crítico»), y completar la tabla métrica↔referencia
del contrato para las derivadas. Sin esto, «la mitad no está sano» y «2 críticos» seguirán sin evidencia.

## 3 · Qué reutiliza (nada de contratos paralelos)

| Pieza nueva | Se apoya en |
|---|---|
| Resolutor | `evidencia.js` (catálogo, sinónimos, conjuntos, agregados, rankings, KPIs) · `verificar.js` intacto como juez de verdad |
| Carta de hechos | el mismo índice, renderizado por turno; viaja con la boleta (mensaje de herramientas), el system cacheado no cambia |
| Derivadas | `_derivada` + `tolCalculo` existentes · pares métrica↔referencia del contrato (`REFERENCIA_CAMPO`, `benchmarkOf`, ley de lectura mínima) |
| Protocolo v2 | `extraerDeclaracion` ya parsea el bloque en cualquier posición; `instruccionDeDeclaracion()` se versiona |
| Reparación de declaración | la escalera del bucle y las multas exactas del juez; `presencia.js` da la checklist |
| Asistencia de identidad (opcional) | `declaracionDeRespaldo` (ya en producción para el respaldo) |
| Medición | corpus fase 1 (1.099 manuales), fase 2 (flujo), fase 3 (vivo + etiquetas) como regresión; extractor independiente como instrumento de certificación (NUNCA en producción — no es un segundo cerebro) |

## 4 · Cómo cumple cada objetivo de producto

| Objetivo | Mecanismo |
|---|---|
| Seguridad actual y 0 FN | El resolutor solo renombra, jamás aproxima valores (checksum; único-o-NV); veredictos siguen saliendo de la boleta; los tres corpus exigen 0 FN como línea base; carnadas nuevas de resolución maliciosa |
| Omisión 14,8 % → ≤5 % | Carta de hechos + regla «comparación en palabras = relación/orden» + bloque primero + derivadas declarables + reparación-checklist (+ asistencia de identidad si la apruebas) |
| Rigidez fuera, verdad intacta | Las 6 formas de rigidez se canonizan (29 casos de fase 3 → ~0); tolerancia de VALORES no cambia un ápice; caso «la cartera»: NV → FALSA (más estricto) |
| Una definición por métrica/eje | La carta se genera del índice y el gate exige unicidad; «carga alta» sube como decisión tuya |
| Premium como camino normal | Prosa sin falsedades + cobertura completable ⇒ se sirve la prosa ORIGINAL del modelo; respaldo y poda quedan como red, no como destino |
| Prosa ≡ declaraciones | Ancla literal (con ubicación asistida antes de declarar «ajena»), cobertura por presencia, consistencia de cláusula intactas; la «puerta cerrada» (prosa falsa + declaración verdadera) se re-prueba con carnada |

## 5 · Por qué esto NO es volver a acumular reglas locales
El Notario viejo acumulaba léxico para *interpretar prosa libre* — espacio infinito, por eso no generalizó. Aquí el espacio es
**finito y de la casa** (las formas de una declaración estructurada: 6 clases de canonización, contadas y cerradas), y el vocabulario
nuevo entra como **datos** (sinónimos del índice, pares del contrato, conjuntos), no como ramas de código — con la disciplina de
siempre: cada adición se mide contra los tres corpus completos, jamás contra el caso suelto que la motivó.

## 6 · Riesgos y mitigaciones
1. **Resolución errada → FN oculto.** Checksum de valor, único-o-NV, carnadas adversariales (valor correcto/entidad equivocada,
   conjunto homónimo con otro n, métrica vecina), y 0 FN exigido sobre los 1.434 veredictos etiquetados (fase 1 + fase 3).
2. **Bloque primero degrada la voz.** A/B dentro de la corrida de certificación; si degrada, se mantiene bloque al final (la carta y
   el resolutor rinden igual) y se pierde solo parte de la mejora de omisión.
3. **La carta engorda el turno.** Tope de tamaño, orden determinista, medida contra el techo de 28K del cierre.
4. **Reparaciones en bucle.** La checklist es finita con prosa congelada; tope 1 y después la escalera actual.
5. **Asistencia de identidad malinterpreta la intención.** Restringida a cifras verbatim con dueño único en la cláusula, marcada en
   el expediente, y es OPCIONAL — decisión tuya.
6. **Los 12 prompts de fase 3 ya son «de entrenamiento».** La certificación usa prompts nuevos; fase 3 queda solo como regresión.

## 7 · Alternativas consideradas y descartadas
- **Que la casa infiera todas las declaraciones desde la prosa** — reintroduce el Notario viejo (interpretar redacción libre); viola «el modelo declara».
- **Solo mejorar el prompt** — necesario pero insuficiente: no arregla rigidez ni sinónimos ni derivadas; y se re-tunea con cada cambio de modelo.
- **Forzar el bloque con salida estructurada del proveedor** — cambia la arquitectura del modo libre y un esquema no codifica el canon (el problema no es la forma JSON, es el vocabulario).
- **Un segundo LLM que corrija declaraciones en producción** — costo/latencia por turno y la ley «el respaldo no es un segundo cerebro»; el extractor queda solo como instrumento de certificación.
- **Relajar tolerancias del verificador** — relaja la verdad; prohibido. (Distinción central: *resolución* cambia la PREGUNTA a su forma canónica; jamás cambia el ESTÁNDAR de la respuesta.)
- **Aceptar el respaldo como camino normal** — desperdicia la voz premium y contradice el mindset de producto final; el respaldo es red, no destino.

## 8 · Demostración de que generaliza (fuera de muestra, por etapas)
- **Etapa A (offline, sin gasto):** resolutor + derivadas + carta. Gate nuevo `_resolutor_gate`: (a) regresión fase 3 — de los 38
  casos etiquetados FP+rigidez, ≥35 pasan a veredicto correcto, las 7 falsas reales siguen falsas, 0 FN; (b) **«tres formas, un
  veredicto» de la DECLARACIÓN**: las 1.099 afirmaciones manuales de fase 1 re-expresadas mecánicamente en las formas de rigidez
  (sujeto-concepto, universo-en-métrica, grupo-lista) deben dar el MISMO veredicto 100 % — el espejo exacto del candado de fase 1,
  ahora en la capa de declaración; (c) carnadas de resolución maliciosa en rojo. Suite completa verde, líneas base intactas.
- **Etapa B (offline):** protocolo v2 + carta en el turno + reparación de declaración en el bucle; gates del flujo re-medidos. La
  omisión del MODELO no se puede medir offline — se dice, no se estima.
- **Etapa C (en vivo, con tu autorización nombrada):** 12-15 prompts NUEVOS, mismo protocolo de medición que fase 3 (extractor
  independiente + etiquetado manual). Estimación: ~35 llamadas · ~US$4. **Criterios:** omisión real ≤5 % · FN 0 · FP estricto ≤2 % y
  ≤5 % contando forma · 0 falsedades servidas · premium servida ≥8 de 12 en esta corrida — honesto: el ≥90 % original probablemente
  exige una segunda calibración con lo que la corrida enseñe; no lo prometo de una.

## 9 · Decisiones que son tuyas (antes de que Opus ejecute)
1. **Autorizar el cambio de la instrucción de declaración** (es contrato de ADI) y el orden bloque-primero (con A/B).
2. **Asistencia de identidad: sí o no** (pieza 6 — la casa asiste solo cifras verbatim, marcadas en el expediente).
3. **La definición canónica de «carga alta»** (umbral crudo > 3,5 % vs subtotal de diagnose) y cualquier otra colisión que el gate destape.
4. **Presupuesto de la etapa C** (~35 llamadas · ~US$4, a nombrar en su momento).
5. **La meta de «premium servida»** para dar por cumplida la fase: ¿90 % directo, o ≥8/12 ahora y 90 % tras una calibración?
6. **Prioridad de las deudas de la Mesa Capital** (estados como figs) — sin ellas, dos clases de frase del inventario seguirán NV.

**Esfuerzo estimado:** etapa A 1-2 sesiones · etapa B 1 sesión · etapa C media sesión + el gasto nombrado. Sin deploy en ninguna.

---

## 10 · Estado de implementación — Etapa A hecha (2026-09-16, `dev`, offline, sin deploy)

**Conclusión primero.** La casa ya canoniza la forma de la declaración. Con la corrida en vivo de la fase 3 re-juzgada offline (mismas
383 declaraciones del modelo, misma boleta de cada turno): **verdaderas 266 → 323, no verificables 66 → 25, fragmentos «ajenos» 16 → 0,
inconsistencias prosa↔declaración 22 → 1** (la que queda es un defecto real de la prosa: «29.8x» por 29.8 %). Las 7 falsedades reales
siguen falsas (0 FN) y aparecen 5 falsas más, todas correctas: dos falsedades reales que antes no se podían juzgar («la más alta de
toda la cartera» con Sodimac 5.4 % contra Easy 5.5 %; LG-WASH11KG «entre los SKU con más riesgo de quiebre» estando sano por la Mesa)
y tres declaraciones cuya forma contradice su propio valor («mayor» declarado con 41.4 % contra 57.3 %: la prosa era cierta, la
declaración no — la reparación se la pide al modelo). De los 38 hechos verdaderos que la forma bloqueaba, 33 pasan a verdadero; los 5
restantes son esas tres declaraciones mal formadas más dos que exigen decisión del modelo (una métrica ambigua y una dirección al revés).

**Lo construido (todo sobre módulos existentes; ningún contrato paralelo):**
- `src/adi/notario/resolutor.js` — el resolutor (pieza 1), con las tres reglas duras (única-o-no-se-resuelve; el valor es el
  comprobante; solo se rellena lo que el fragmento dice) y las reglas de forma R1/R3/R4/R5/R8/R9/R10 documentadas en su cabecera. En
  «A contra B» el sujeto se comprueba con A y el otro lado con B. Un subtotal sin universo toma el de la fig que la cifra identifica (si
  es única) — y si el fragmento dice el TODO, se declara el todo y el verificador dicta `alcance-promovido`: falsa.
- `src/adi/notario/ubicar.js` — el ubicador tolerante compartido por el juez y el detector de presencia (literal → sin marcas → con
  hueco → cabeza/cola → asistida), con el tramo cubierto acotado a lo casado (una oración entera tapaba los hechos de al lado).
- `verificar.js` / `evidencia.js` — una sola tolerancia (`mismoValor`, canon de la casa + muro) para el juicio y el comprobante;
  `necesitaUniverso` y `universoDeFig` compartidos; un sujeto descrito casa con el agregado cuyo GRUPO es ese conjunto; «la cartera
  (de clientes)» es el eje entero; el signo dicho en palabras («cayó $422K» → «-$422K») no es inconsistencia.
- **Una sola definición de «carga comercial alta»** (decisión de producto del owner): la del detector (carga > nivel declarado y exceso
  ≥ piso: 6 cuentas, $655K), publicada por la proyección desde la misma función que la boleta (`descomposicionDeBrecha` →
  `conjuntos`); el conjunto crudo (9 cuentas que exceden el nivel) se llama **«sobre el nivel declarado de carga»** y «carga alta» ya no
  resuelve a él. «6 cuentas con carga alta» es verdad; «9 cuentas con carga alta» es falsa; «9 sobre el nivel declarado» es verdad.
- **Inventario/Capital verificable como Comercial**: la proyección declara para cada SKU su estado de la Mesa Capital (frenado · riesgo
  de quiebre · sobrestock · capital sano, por `diagnoseInventarioSku`, la misma función que la Mesa) y la alerta del dato («crítico»);
  los $ por estado cierran exactos con los «Estado del inventario: …» de la boleta ($33.2K · $36.4K · $9.8K · $55.6K). Y la brecha al
  benchmark por marca entra a la proyección con la misma cuenta que por cliente.
- Las deudas de evidencia de la fase 3 (estados de la Mesa como evidencia, brecha por marca) quedan saldadas por esta vía.

**Candados** (`_resolutor_gate`, 38 verificaciones, en `gates:offline`): A · la fase 3 re-juzgada (≥ 33/38 hechos bloqueados por la
forma → verdaderos; las 7 falsas jamás verdaderas; las falsas fuera de las 7 nombradas una a una; 0 ajenos; ≤ 3 inconsistencias);
B · **tres formas de la declaración, un veredicto** sobre las 1.099 afirmaciones manuales de la fase 1 Y las 383 del modelo en la fase 3
(sujeto-concepto 105/105 · universo dentro de la métrica 157/157 · grupo con lista de valores 154/154); C · carnadas de resolución
maliciosa (un benchmark con otro valor no resuelve, una entidad mal escrita no se adivina, un grupo con los valores trocados es falso,
una dirección no se inventa); D · la definición única de «carga alta»; E · el inventario verificable. Seis expectativas de los corpus de
la fase 1 que codificaban una limitación de la evidencia («la proyección no declara qué SKU están en ese estado») se actualizaron con
nota. Suite completa: verde, «0 TOCARON LA RED · 0 CON CREDENCIAL VIVA».

**Una decisión de producto que dejo anotada, no tomada:** el rótulo del subtotal del detector dice «6 cuentas sobre el nivel declarado (5 de
ellas bajo el benchmark)», pero literalmente 9 cuentas exceden el nivel. El Notario lee «sobre el nivel declarado» de forma LITERAL (las 9)
y «carga (comercial) alta» como el detector (las 6): si el modelo copia el rótulo como conteo («6 cuentas están sobre el nivel declarado»),
la multa dirá «son 9». Propuesta: renombrar el descriptor del rótulo a «6 cuentas con exceso material sobre el nivel declarado» — cambia
texto que llega a pantalla (la pestaña Comercial pinta desde la misma función), así que es tuya.

**Lo que la Etapa A no resuelve (y sigue el plan):** la omisión del modelo (180 puntos afirmados sin declarar en los 23 textos de la
fase 3; es la Etapa B: protocolo v2, carta de hechos, reparación de declaración con prosa congelada), la ronda adversarial con UltraCode
sobre el resolutor/ubicador, y la medición fuera de muestra en vivo (Etapa C, con autorización nombrada del gasto).

---

## 11 · Etapa B hecha (2026-09-16, `dev`, offline, sin deploy) — el problema que quedaba: el modelo omite lo que sí escribe

**Decisión de producto aplicada (owner, 2026-09-16):** «carga alta» = las 6 cuentas del detector; las 9 que solo exceden el nivel son
otro conjunto y se llaman «sobre el nivel declarado de carga» (el Notario lee esa frase de forma literal: son 9).

**Conclusión primero.** La omisión ya no cuesta la respuesta premium. Cuando el cierre falla SOLO por la declaración —hechos escritos
sin declarar, declarados de una forma que no se pudo verificar, escondidos como lectura, o sin bloque—, el bucle **no reescribe**: le pide
al modelo únicamente el bloque con la lista exacta de lo que falta, re-juzga la MISMA prosa y sirve la prosa premium original (una
llamada en el tier base, sin escalar). Nada falso ni ninguna ley de la casa entra por esa vía: si la declaración nueva destapa una
falsedad, sigue la reparación completa de siempre, y la multa parte de ese juicio (el más informado). En la fase 3, 9 de los 12 cierres
fallaban solo por la declaración: los 9 habrían tomado esta vía en vez de caer al respaldo.

**Las cinco piezas:**
1. **Reparación de la declaración con la prosa congelada** (`bucleAgente.js`: `_soloDeclaracion`, `_MENSAJE_DECLARACION`, sitio
   «declaracion» con las mismas leyes que cierre y reparación; lo servido lleva el registro del sitio). Tope: una por turno.
2. **Asistencia de identidad** (`juez.js` · `asistirIdentidad`, `ctx.asistir` solo en los sitios del modelo): una cifra de la prosa sin
   declarar cuyo canon existe en UNA sola fig, o que cae dentro de una relación «A contra B» (la segunda cifra es del otro lado) o de otra
   afirmación con un solo sujeto y métrica, la declara la casa — pasa por el MISMO verificador (tiene que salir verdadera) y la MISMA
   consistencia (un fragmento que empieza con «Falabella» no se declara para Lider). Nada semántico se asiste. Medido en la fase 3: 15
   de 180 omisiones son de identidad mecánica; el resto es del modelo (órdenes 64, lecturas que esconden hechos 21, relaciones 22, grupos
   15, variaciones 10). Cada asistida queda en el expediente (`asistidas`).
3. **Carta de hechos del turno** (`src/adi/notario/carta.js`, pegada a los resultados de cada ronda; entera una vez, después solo los
   subtotales nuevos): referencias con su nombre y valor, conjuntos con su tamaño y única definición («carga comercial alta (6)» ·
   «sobre el nivel declarado de carga (9)» · «bajo el benchmark (8)» · los estados por SKU…), subtotales del turno con su universo, rankings
   verificables por eje, cuentas permitidas y la regla «toda comparación en palabras es una relación; todo superlativo, un orden». Junto a
   la boleta, no en el system: el caché no se toca. ~2,4K caracteres.
4. **Protocolo v2 de la instrucción** (`declaracion.js` · contrato de ADI, autorizado en el mensaje del owner): qué es una afirmación de
   hecho con los casos que la fase 3 mostró omitidos (comparaciones en palabras, superlativos, cifras derivadas y cifras dentro de un
   orden), un ejemplo por tipo, «A vs B» en las comparaciones, los nombres de la carta para el universo, y «si el Notario pide solo la
   declaración, devuelve solo el bloque».
5. **Más formas que el vocabulario libre revela** (el extractor de la fase 3 en sus propias palabras, 289 afirmaciones: verdaderas
   148 → 163 sin tocar el estándar): R12 el período implícito de una variación («Lider creció 14,9 %» → «vs año anterior» cuando es la
   única variación de la boleta para ese sujeto y métrica); R13 el otro lado que trae su cifra («nivel de referencia (3,5 %)») la usa de
   comprobante, y entre candidatos gana el de la unidad de la métrica del sujeto (la carga en % no se compara con un subtotal en $); un
   eje pelado como universo («familias», «marcas») es el eje entero; una ambigüedad entre conceptos queda no-verificable (no cae a un
   conjunto); un valor «A vs B» está en la frase si una de las dos cifras lo está; un fragmento que empieza con el nombre de una entidad
   tiene ese sujeto (el lector de cláusula no veía nada antes de la posición 0).

**Candados** (`_notario_semantico_flujo_gate` §F, 45 verificaciones; `_resolutor_gate`, 45): la prosa congelada se sirve byte a byte
con el sitio «declaracion» y una sola llamada más; sin bloque, el pedido de solo la declaración basta; una falsedad destapada por la
declaración nueva NO se sirve y la reparación completa parte de esa multa; la casa asiste la cifra verbatim con fig única y jamás la que
la oración atribuye a otra cuenta; una frase falsa no llega al usuario por ninguna vía (la poda puede servir el resto); el verificador no
revienta en ninguna de las 399 declaraciones de la fase 3 (un error se contaba como no-verificable y escondía una falsa). Los guiones de
los gates responden al pedido de solo la declaración (`_guion_declara.mjs`). Suite: verde, 0 red.

**Lo que sigue:** la ronda adversarial (UltraCode, offline, con `_adversarial_notario_harness.mjs`: la mesa de ataque que corre el turno
entero con un cerebro guionado y dice si una falsedad llegó a pantalla) y, si sobrevive, la estimación de la certificación viva. → §12.

## 12 · La ronda adversarial (UltraCode, offline, 2026-09-16) — 69 roturas confirmadas, 69 cerradas, 23 controles

**Conclusión primero.** Seis agentes atacaron fuera de muestra la relación agente ↔ Notario con el banco offline
(`_adversarial_notario_harness.mjs`: 637 casos en seis ángulos), un escéptico independiente confirmó 69 roturas re-corriendo cada una y
cotejando la verdad contra la boleta, y las 69 quedaron cerradas sin abrir ninguna de las puertas que la fase 3 ya tenía cerradas:
`_notario_adversarial_gate` 92/92 (69 roturas + 23 controles), `_notario_semantico_gate` 31/31, `_resolutor_gate` 45/45,
`_notario_semantico_flujo_gate` 45/45. La fase 3 re-juzgada: verdaderas 326 · no verificables 23 · falsas 11 · 0 FN · 2 inconsistencias
(las dos legítimas). Sin corridas ni deploy.

**Lo que rompieron, por familia, y cómo se cerró (cada regla con su carnada en el gate):**

1. **La cifra elegía el concepto.** «el benchmark queda en 5,0 pp» salía verdadera porque «benchmark» está contenido en «Brecha al
   benchmark» y la cifra cerraba ahí. Ahora el concepto identificado por el nombre se juzga ahí aunque la cifra no cierre (falsa), y un
   concepto de la casa **nunca** casa con otro concepto de la casa por contención («carga comercial» no es «carga comercial alta»;
   «contribución» no es «contribución no capturada»; «capital» no es «capital frenado») — `evidencia.js` `_casa`, `resolutor.js` R1.
2. **Universos y subtotales.** «las cuentas bajo el benchmark cargan $655K», «las 6 cuentas sobre el benchmark suman $655K», «el total
   de contribución no capturada llega a $4.9M» pasaban: el universo casaba por un número o por cualquier palabra del contexto (hasta la
   palabra «total» del diagnóstico de la fig). `_universoCasa` v2 (`verificar.js`): el universo declarado se casa con el RÓTULO del
   grupo — el número, las palabras principales del calificador («5 cuentas materiales»), el paréntesis «(de M …)» que describe a todo el
   grupo (las 5 están bajo el benchmark) y no el «(K de ellas …)» que describe a una parte (de las 6, 5 bajo el benchmark) — y solo cuentan
   las palabras del **vocabulario de conjuntos** de la evidencia (bajo/sobre el benchmark, materiales, sanos, los que caen, carga alta…);
   si esas palabras nombran otro conjunto o solo el superconjunto, decide el CONJUNTO que identifican (set o tamaño). El superconjunto
   nombrado por el propio rótulo («las cuentas bajo el benchmark» sobre «5 materiales (de 8 bajo el benchmark)») vale solo si la métrica
   no tiene valores fuera del grupo (conjunto oficial: fuera vale 0 → la carga alta de las 8 es $588K, verdadera; ranking que cubre el
   superconjunto → la contribución no capturada de las 8 no es $4.9M, falsa; sin evidencia → «incierto» = no verificable, jamás verdadera
   ni falsa a ciegas). «El total de <métrica>» es el todo (alcance promovido sobre un subtotal, salvo el subtotal que es el conjunto oficial
   entero). El número del grupo manda sobre el «todo» dicho al lado («las 6 cuentas … de los 13 clientes»: el denominador).
3. **Conteos.** Ganaba cualquier candidato que trajera el n declarado («5 de las 13 están bajo el benchmark» pasaba con el «(5 de ellas)»
   del rótulo de carga alta). Ahora los candidatos se **rankean** (conteo explícito de la boleta > intersección que cubre todo el
   predicado > el que trae el «de M» dicho > «(K de ellas …)», que cuenta dentro de su grupo) y el mejor decide; un predicado con dos
   conjuntos sin «y» («con carga alta bajo el benchmark») es su intersección; una enumeración («Falabella, Lider, Jumbo, Sodimac y Ripley
   cargan…») se juzga por los nombrados. «materiales» a secas ya no es «caen de forma material».
4. **Estados.** «LG-DRYER8KG está en riesgo de quiebre … con $14K de capital frenado» pasaba porque una cifra cubría el punto de estado.
   Un estado lo cubre solo un estado, o una cifra/conteo/grupo cuya métrica o predicado nombra ESE estado (`presencia.js` `_estadoCubierto`).
5. **Consistencia prosa ↔ declaración** (`juez.js` `consistencia` v2, reescrita): cobertura de una cifra por su canon **con dueño** («Lider
   deja 22,0%» no la cubre «Falabella … 22,0%»); el dueño después de la cifra («22,0% de margen tiene Lider»); la ocurrencia de la cifra que
   cuenta es la del fragmento declarado (no el «(+$1,5M)» de otra cuenta); «22% vs 24% de Jumbo» reparte los lados; el paréntesis
   comparativo «(8.6 pp contra 8.1 pp)»; la métrica por las palabras pegadas a la cifra (prefijo y postfijo) en fragmentos con varias cifras;
   la frase que NOMBRA otro concepto de la casa junto a la cifra («$1.6M de brecha por precio y costo» declarado como contribución no
   capturada; «$19.4M sin capturar» declarado como venta); las palabras propias de cada concepto («no capturado», «problema de margen»,
   «exceso», «debe» para lo vencido); un superlativo de daño («la que más te está costando», «más lejos», «más grave») no dice la dirección;
   la exclusividad («la supera SOLO en…», «en todos los ejes») declara lo implicado; una bodega y un SKU nombrados en la misma oración pueden
   compartir la cifra; los sujetos en lista («Easy y La Polar»).
6. **Negación.** «$4,6M vencidos no es lo que debe Lider» (la negación después de la cifra), «Mercado Libre no crece» (variación negada,
   antes eximida), «Lider no está bajo el benchmark» (relación negada) pasaban. Un orden o una variación bajo negación FACTUAL sigue siendo
   un hecho que declarar — solo la negación EPISTÉMICA («no hay serie para decir si cae», «sin evidencia de que crezca») y la copular de un
   sustantivo («no es un cliente chico creciendo rápido») eximen; la negación dentro del fragmento contradice la declaración de la misma
   dirección («no cae» declarado sube sí es compatible); la negación después de la cifra vale aunque medie la métrica, salvo los giros que
   afirman («no es poco»).
7. **Cifras en palabras y prosa libre.** «veintiocho por ciento», «casi dos millones», «cuarenta por ciento», «1,9 millones», «casi un año
   de atraso», «Easy, diez más», «veinte mil dólares», «siete puntos» no eran cifras para nadie; «completa el podio», «va en cabeza», «cierra
   la tabla» no eran órdenes. Ahora son puntos de afirmación (`presencia.js`), y una cifra declarada en dígitos está en la frase también
   cuando la frase la dice en palabras («ocho días» ↔ «8 días»).
8. **El ubicador.** En la asistida, el salto de línea cierra la oración (una lista con viñetas no es una sola oración) y cada cifra se casa por
   la ocurrencia más cercana al dueño («MAK-COMP-AIR: $8K» es el $8K de su línea, no el de Antofagasta de antes) — `ubicar.js`.

**Los 23 controles** (sección B del gate): la versión VERDADERA de cada familia sigue pasando — 13 declaraciones que tienen que salir
verdaderas («las cuentas con carga alta suman $655K», «la carga alta de las cuentas bajo el benchmark es $588K», «5 cuentas con carga alta
están bajo el benchmark», «el total de carga comercial alta es $655K», «9 de las 13 están sobre el nivel declarado de carga»…) y 10 turnos
correctos que se sirven verdes en UNA llamada, incluidos los falsos positivos que los propios atacantes reportaron: «cinco puntos bajo el
benchmark» declarado como 5.0 pp, «Falabella supera a Lider en venta» como relación mayor, «la bodega Valparaíso concentra $25K» con la
bodega como sujeto, «Valparaíso y Antofagasta suman $33K» como la suma de sus figs, «ocho días de atraso» declarado como 8 días, «Mercado
Libre no cae en ventas: crece 25.3%», «Falabella va en cabeza con $1.6M».

**Lo que la suite completa destapó (268 gates offline, 18 rojos antes de cerrar).** La consistencia v2 vetaba textos correctos de los
composers de la casa: «de mayor a menor» leído como superlativo, «el que más cae» / «el que más se aleja del plan» como dirección mayor
(un superlativo de caída no dice quién es el mayor), «no viene cayendo» sin arrastrar el auxiliar, «Lider sube, Ripley cae» en un
fragmento con las dos direcciones, «su carga comercial es 4.5% de su venta» (el prefijo cortado en «es»), «el 54.6% de la venta» (una
participación nombra su base), «se completa en Mercado Libre» (un lugar, no un dueño), «…MAK-COMP-AIR, y el capital frenado suma $33K» y
«Lider concentra $4.6M de $12.6M» (la cláusula coordinada y el partitivo separan a la cifra de la entidad de antes), «quién vende más» (una
pregunta indirecta no afirma), «más delgado que» (un comparativo de pequeñez es MENOR), y la segunda cifra de «(8.6 pp contra 8.1 pp)» que
es del otro lado de la afirmación que la envuelve. Todas cerradas en el juez o en presencia; un solo composer cambió su DECLARACIÓN (no su
prosa): «pesa varias veces lo otro» se declara con ese tramo, sin el nombre del frente («el margen»), que es un rótulo de la ruta
`comparar-alternativas`. Suite: 268/268 · 0 red.

**Una etiqueta de la fase 3 cambió con la definición del owner.** «Falabella es una de las 6 cuentas donde el margen está bajo el
benchmark y además la carga comercial está por sobre el nivel de referencia» (3.reparacion.3) se etiquetó FALSA el 15-09 asumiendo las 6 con
carga alta (de las que 5 están bajo el benchmark). Con la definición del 16-09 —«sobre el nivel declarado» es el conjunto crudo, con
nombre propio— es VERDADERA: bajo el benchmark (8) ∩ sobre el nivel (9) = 6, las mismas 6 del papel «erosión por acciones comerciales» de
la proyección. Reetiquetada (nota en `fixtures/notario-fase3-etiquetas-2026-09-15.json`); las falsedades reales de la corrida son 6.

**Decisión de producto pendiente (sin cambio de pantalla hasta que el owner decida).** El rótulo del subtotal dice «6 cuentas sobre el
nivel declarado (5 de ellas bajo el benchmark)» pero 9 exceden el nivel; el Notario lo lee como el conjunto oficial (6, materiales).
Propuesta: «6 cuentas con exceso material sobre el nivel declarado».

**Lo que sigue.** Volver a correr la ronda adversarial fuera de muestra (los atacantes contra la versión cerrada; misma mesa) y, si
sobrevive, estimar la certificación viva (etapa C, gasto a nombrar antes de gastar).

## 13 · La ronda adversarial 2 (UltraCode, offline, 2026-09-16) — 91 roturas confirmadas sobre la versión cerrada, 91 cerradas, 16 controles

**Qué se hizo.** Los mismos seis ángulos volvieron a atacar la versión que cerró la ronda 1 (script `scratchpad/notario-adversarial-ronda2.js`,
misma mesa `_adversarial_notario_harness.mjs`, cero llamadas de red). Un escéptico confirmó 91 roturas (27 al verificador, 64 al turno). Todas
viven en `fixtures/notario-adversarial-2026-09-16.json` (`casosRonda2`) y el gate `_notario_adversarial_gate` las replica: 199 PASS (69 + 91
roturas, 23 + 16 controles). Una sola quedó marcada `verdaderaEsperada`: «en conjunto, los clientes cargan $655K de más» — el atacante la dio
por falsa (alcance promovido), pero por la definición de la casa el exceso de carga del negocio lo aportan solo las 6 cuentas sobre el nivel
declarado: «Carga comercial alta · subtotal» ES el total del negocio. Queda como caso de control de esa definición.

**Las familias que cerró la ronda 2 (cada una con su carnada).**
- *El valor es el comprobante, con la precisión de lo impreso.* Una cifra directa admite el empate del redondeo a su propia precisión («+7,5%»
  por 7.55 impreso 7.6%) y una escritura más gruesa solo si vale exactamente lo impreso («5 puntos» por «5.0 pp»; nunca «22%» por «21.5%»,
  ni «58%» por «57.7%» — regla de la casa, queda falsa). Con dos emisores que redondean distinto, juzga la fig que cierra.
- *El universo de un conteo o un grupo se casa por lo que dice, no por su tamaño.* «Las 6 cuentas bajo el benchmark» no es «Carga comercial
  alta · 6 cuentas»; un predicado negado conserva su verbo («no superan el benchmark» es el complemento de «superan el benchmark»); «todas las
  cuentas salvo Lider» es |universo| − 1 (o su complemento, 1) y otra n es inconsistente; «ninguna familia le gana al benchmark» admite 0 o las 4;
  una bodega nombrada con un estado («los SKU frenados de Valparaíso») restringe a ese estado.
- *La cobertura es por SIGNIFICADO.* «Bajo el benchmark» lo cubre una cifra de «Brecha al benchmark» (la brecha es estar bajo), «sobre el
  nivel» un predicado o una métrica que lo diga (por pares dirección/referencia, uno por cada lado de «bajo el benchmark y sobre el nivel»);
  «equivale a $4.9M» introduce una cifra y la cubre esa cifra; «como Lider» / «igual que» solo por una relación declarada; un ordinal solo por
  su puesto; una razón en palabras solo por su k; «el más crítico» es un superlativo, no un estado; «ceden margen» no es una variación; «31 de
  agosto» es una fecha, no una cifra; «vs. año anterior» no cierra la oración.
- *El dueño de la cifra, en presencia y en el juez, con las mismas reglas.* Una declaración del NEGOCIO no cubre la cifra que la prosa pone a
  una cuenta («Lider: 5.0 pp bajo el benchmark» repetido tras el 5.0 pp del negocio), salvo referencia o total («sobre el 3,5% declarado»,
  «de los $12.6M», «$33K en total», «del total de $135K»). Las entidades de REFERENCIA no son dueñas («más severo que Falabella», «después de
  Jumbo y Falabella», «contra Lider», «Igual que Falabella, Sodimac lleva…»: la coma coordina solo dentro de una lista que sigue). «Respectivamente»
  reparte la lista que va antes o después del adverbio, y solo esa. La cabeza «Entidad:» / «Entidad (» abre la cláusula y no vale coordinada. La
  cola «en <bodega>» no cruza una coma, y la bodega dicha como lugar («frenado en Valparaíso con $14K») no es dueña si antes va la cuenta. La
  oración termina en el fin de línea (una viñeta no se come la siguiente). Y la posición de la cifra en la oración normalizada ya no pierde el
  espacio que la precede (`normalizar` recorta; ahora se normaliza sin recortar).
- *La consistencia lee el fragmento, no la oración entera.* Los lados de un comparativo se juzgan con el comparador DEL fragmento («aunque
  Falabella tenga más venta» no se juzga con el «más severo que» de antes); «más que Lider (21,5%) y que Jumbo (24,0%)» tiene tres lados y una
  declaración con uno solo es inconsistente (la coma decimal ya no corta la lista); «no es la que más contribución sin capturar tiene» declarado
  como comparativo MENOR (o puesto > 1) es lo mismo dicho al revés; «de agosto» casa con «31 ago 2026»; el estado de un fragmento con varias
  entidades es el del tramo del sujeto; «recuperó $1.9M» es dinero cobrado (abonado), no la tasa «Recuperado» ni el saldo vencido —y «recuperas
  $22K» de capital o «contribución recuperada» son otros conceptos—; «sin capturar» es métrica y un orden sobre ella es un punto.
- *La bodega de la prosa se juzga.* Un estado declarado SIN bodega toma la bodega que la prosa le pone (`completarBodegas`, antes de verificar):
  «LG-DRYER8KG está frenado en Antofagasta» se juzga en Antofagasta y es falso; en Valparaíso, verdadero, sin inconsistencia. Con dos bodegas
  en la oración vale la del fragmento; con ninguna en el fragmento y dos en la oración, ninguna.
- *Los nombres parciales que identifican a una sola entidad se resuelven* («Polar» → La Polar, «MercadoLibre» / «ML» → Mercado Libre); dos
  candidatas = ninguna.

**Lo que la suite completa destapó (268 gates offline; 25 rojos antes de cerrar).** Como en la ronda 1, las reglas nuevas vetaban textos correctos de los
composers y de los guiones de la casa; cada falso positivo se cerró en el juez o en presencia, ninguno tocó un composer:
- la derivación de la declaración de respaldo (`declaracionDeRespaldo`) casaba una cifra con cualquier fig a $1.000 de distancia (la tolerancia del muro):
  «$24.029» de una serie se declaraba como el KPI «Capital frenado · subtotal · 0 SKU = $0» y con la regla de precisión salía FALSA (antes salía verdadera
  por la misma tolerancia). Ahora la derivación casa con `mismoValor`, la misma regla de la casa que juzga;
- el período: la métrica de la casa lleva su período en el rótulo («venta · agosto 2026», «Ventas del año anterior»); un fragmento con dos meses declara
  cada cifra con el suyo; para una CIFRA solo cuenta el período pegado a su valor (sin otra cifra ni cláusula en medio: «$100.0M (+7.6% vs año anterior)»
  es del +7.6%); «contra tu presupuesto» ↔ «vs ppto» ↔ «plan»; «vs año anterior» y «YoY» son menciones;
- el conteo con predicado: «bajo el benchmark» declarado y «(… puntos sobre ese nivel)» en otra parte del fragmento no chocan (solo choca la dirección
  PEGADA al conteo); «por debajo de esa referencia» tras nombrar el benchmark es esa referencia (comodín), «nivel de referencia» es el nivel;
- el fragmento envuelve lo que su rango cubre (un punto adentro no lo corta: «Falabella · cliente. Venta del período: $19.4M — 1º de 13»); lo que cruza a
  la cifra de otra cuenta lo frena el dueño; «el primero» anafórico lo cubre una relación mayor/menor; «el negocio está sano en crecimiento» no es el estado
  «capital sano» (sin inventario ni SKU en la oración); «sin capturar», «contribución», «markup», «cobertura» atan un orden a su métrica;
- el dueño: «mientras Jumbo» no es «tras Jumbo» (`_REFERIDA` con frontera de palabra); «se completa en Mercado Libre» / «cae en Ripley» son lugares, no
  dueños (regla única y cola); «las 3 SKU del cuadro» son las entidades que la boleta del cuadro trae («Entidades en el cuadro = N»); el universo
  «subtotal» leído desde la métrica no es un universo distinto; la variación del negocio también la publica el cuadro anclado («… · vs año anterior (%) ·
  total = +7.5%») y la que cierra con la magnitud juzga; un top-k no cuenta a los nombrados tras una exclusión («no aparece …: el capital frenado está en
  X, Y», «fuera de los que más venden»); la negación de OTRA métrica no niega el orden declarado; «la cuenta más grande no es la que más te deja» declarada
  como comparativo (en cualquier sentido) es lo mismo dicho al revés; «$655K de carga comercial por sobre el nivel declarado» es el postfijo de la propia
  cifra; «entre las 8 cuentas bajo el benchmark» lo cubre el universo del orden.
⚠️ Trampa repetida de esta sesión: un heredoc convirtió `` en el byte 0x08 dentro de un regex (`/(?:cuadro…)/` nunca casa); revisar con
`grep -P "[ -]"` antes de commitear.

**Medido, sin regresión.** `_notario_semantico_gate` 31/31 · `_resolutor_gate` 45/45 (fase 3 re-juzgada: 3 inconsistencias, ≤ 3) ·
`_notario_semantico_flujo_gate` 45/45 con la línea base de omisiones en 20 (antes 28: las 8 que se fueron eran «31» de «al 31 de agosto», una
fecha) y 0 declaraciones inconsistentes en los 12 borradores · `_notario_adversarial_gate` 199/199.

**Lo que sigue.** La ronda 3 fuera de muestra sobre esta versión (misma mesa, cero red); si sobrevive, la estimación de la certificación
viva (etapa C, gasto a nombrar antes de gastar). Sigue pendiente la decisión de producto del rótulo «6 cuentas sobre el nivel declarado (5
de ellas bajo el benchmark)» → propuesta «6 cuentas con exceso material sobre el nivel declarado».
