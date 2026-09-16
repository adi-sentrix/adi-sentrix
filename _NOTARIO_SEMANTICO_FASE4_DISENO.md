# Notario semántico · Fase 4 — DISEÑO PROPUESTO (2026-09-16, pendiente de revisión del owner; nada implementado)

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
