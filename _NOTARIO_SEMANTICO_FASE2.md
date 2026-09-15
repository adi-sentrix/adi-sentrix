# Notario semántico · Fase 2 (offline, 2026-09-15)

**El principio** (fase 1, aprobado por el owner): *el modelo redacta; el modelo declara qué está afirmando; el Notario verifica la
afirmación contra la evidencia estructurada; la redacción no determina la verdad.*

**Los criterios de producto de la fase 2** (owner, textuales): la respuesta y sus declaraciones representan exactamente la misma
realidad · ninguna afirmación relevante queda fuera de las declaraciones · una declaración incompleta o sin evidencia suficiente sigue
siendo `no verificable`, nunca verdadera · la multa señala exactamente qué afirmación falló y cuál es la verdad de la boleta · el
respaldo declara y se verifica con el mismo estándar, sin camino privilegiado · las leyes de la casa siguen operando sobre
interpretación, causalidad, intención, prioridad y cobertura del encargo · `lectura` no es un refugio para hechos.

## 1 · Qué quedó construido

| Pieza | Archivo | Qué hace |
|---|---|---|
| El protocolo | `src/adi/notario/declaracion.js` | El cerebro devuelve la respuesta + el bloque `<<AFIRMACIONES>> … <<FIN>>` (una afirmación JSON por línea: tipo, sujeto, métrica, valor, orden, relación, grupo, conteo, variación, estado, universo, período, evidencia, sello, `texto` = fragmento literal). `instruccionDeDeclaracion()` viaja en el system (`sistemaAgente.js`); `extraerDeclaracion()` separa respuesta y bloque; `declaracionDeRespaldo()` deriva una declaración desde las figs para los peldaños que no componen con colector. El tope de tokens del modo libre sube la cuota del bloque (`agenteBudget()` en los adaptadores: un tope, no un gasto). |
| El juez | `src/adi/notario/juez.js` | `juzgarDeclaracion(prosa, afirmaciones, ctx)`: consistencia prosa↔declaración (`declaracion-ajena`, `declaracion-inconsistente`), veredictos del verificador (`afirmacion-falsa` con la verdad al lado, `afirmacion-no-verificable`, `lectura-encubre-hecho`), omisiones (`afirmacion-no-declarada`), y `sin-declaracion` cuando no hay bloque. Saca el `[[CALCULO]]` de la prosa antes de juzgar. `CHEQUEOS_DE_HECHO`: los 28 kinds del muro que el verificador reemplaza. |
| El colector | `src/adi/notario/declarar.js` | `crearDeclarador()` para que un composer determinístico declare MIENTRAS escribe (cifra · deFig · orden · relación · grupo · conteo · variación · estado · lectura); `declaradorDe()` es mudo sin colector → texto byte-idéntico. |
| El bucle | `src/adi/agente/bucleAgente.js` | `juzgar(t, sitio, afirmaciones)`: guardC primero (sus chequeos de hecho pasan a detectores; sus leyes de la casa siguen vetando), después el juez semántico con el índice del turno (boleta + proyección/KPIs + ejes + re-cita + figs del pack); el índice se rearma si la boleta crece en la ronda extra; los `[[CALCULO]]` que el muro autorizó son evidencia; el cerebro recibe `figs` en cada llamada; la multa al modelo pide re-declarar; la poda corta por fragmento; expediente `agente.notario {pasos[{sitio, derivada, medidas, vetos, multas, detectores, leyes}], servido}`; el rastro nombra las leyes que ardieron con su multa. |
| Los composers | `src/adi/agente/playbooks/*.js`, `encargoCompuesto.js`, `prioridadIntegrada.js` | Los 22 playbooks, el ensamblador del encargo y la prioridad integrada declaran con el colector (texto byte-idéntico, verificado composer por composer con `_verificar_composer.mjs`). |
| La evidencia | `evidencia.js`, `verificar.js`, `presencia.js` | Índice con identidad VERBATIM (una cifra dicha como la boleta la trae es la de la boleta), rótulos con significado (`headline`/`headlineSub` y «Valor» del panel vs año anterior/presupuesto, «Ventas del año anterior», «Ventas totales», «Techo de días», «Piso de rotación» como KPIs del negocio), entidades solo del catálogo del eje (más el MES como sujeto del cuadro «el año mes a mes»), conjuntos con su eje («bajo el benchmark» de clientes no resuelve SKU; «con capital frenado» por bodega; «bajo/sobre el presupuesto»), signo dicho en palabras, «Venta» ≠ «Ventas del año anterior»; detector de omisiones con colas «(y N más)», k del top-k, números de estructura, enumeradores, nombres de variación sin cifra ni dirección, fragmentos repetidos, rótulos de corte entre guillemets, ofertas y preguntas al dueño con opciones (no afirman). |
| La boleta | `src/adi/oracle/ledger.js`, `specRetrieval.js` | La identidad de una fig es ENTIDAD + cifra: dos cuentas con la misma variación son dos hechos (antes el segundo se perdía por repetir el canon y un hecho verificable quedaba no verificable); la venta del año anterior viaja con rótulo propio; un eco de la referencia del negocio por entidad («targetCarga») no se camina. El muro autoriza por canon igual que siempre. |
| Los guiones de los gates | `_guion_declara.mjs` | `declarando(guion, scenario)`: un guion de gate declara desde la boleta como lo haría un cerebro que declara (derivación desde `figs`); lo que la derivación no alcanza se declara a mano en el guion. Vive fuera de `src/`: NO es un camino del producto. |

## 2 · Las medidas (offline, con los 12 borradores reales como cerebro fijo)

`_notario_semantico_flujo_gate.mjs` (turno entero, `answerViaAgente`, cerebro = guion con las declaraciones manuales del fixture; línea
base fijada en `fixtures/notario-semantico-2026-09-15.json → linea_base_flujo`):

| Medida pedida por el owner | Resultado al cierre (2026-09-15) |
|---|---|
| Tasa de declaraciones correctas | **95,5 %** (874 verdaderas + 176 selladas, 0 inconsistentes, de 1.099 declaradas; 923 de hecho) |
| Tasa de afirmaciones relevantes omitidas | **2,9 %** (28 de 950 puntos de la prosa sin declarar) |
| FP / FN del verificador dentro del flujo | **0 / 0** (31 falsas, todas esperadas; 18 no verificables, ninguna servida como verdadera) |
| Reparaciones provocadas por declaraciones falsas/incompletas | **6 de 6** turnos (los 6 cierres reales traían falsas u omisiones) |
| Servido sin pasar por el nuevo Notario | **0 de 6** · servido con falsas u omisiones: **0 de 6** (los 6 terminan en el ensamblador, que declara y se verifica) |
| Detección de afirmaciones quitadas (fase 1) | 595/667 = 89,2 % (no es criterio de salida; la fase 2 mide lo de arriba) |
| Exactitud del verificador sobre las 1.099 afirmaciones manuales | 1.096/1.099 = **99,7 %** (fase 1: 99,5 %; 3 «no verificables» pasaron a verdaderas al saldar las deudas de evidencia) |

Lo que NO mide: cuánto declara el MODELO real. La declaración manual es el proxy de un cerebro que declara bien; la tasa del modelo
solo se mide en vivo (fase 3), con gasto autorizado que lo nombre. La instrumentación ya lo registra por turno (`agente.notario`).

Suite completa al cierre: `npm run gates:offline` → **266 PASS · 0 FAIL · 0 TOCARON LA RED · 0 CON CREDENCIAL VIVA**.

## 3 · Qué conserva el Notario antiguo (guardC + contrato)

1. Las **leyes de la casa** siguen vetando: registro, formato de informe, intención inferida, deterioro no medido, jerarquía causal sin
   medida, coincidencia como razón, parte del encargo omitida, alcance heredado, referente cambiado, premisa adoptada, mecanismo sin
   sello, ganancia no comparada, juicio sin marcar, cobertura del encargo, prioridad integrada cambiada. En los 12 borradores ardieron:
   intención inferida (3), deterioro no medido (2), juicio sin marcar (3), formato de informe (4), parte del encargo omitida (1),
   jerarquía causal sin medida (1), coincidencia como razón (1), etiqueta de días (1).
2. Sus **28 chequeos de hecho** (`CHEQUEOS_DE_HECHO`) ya no dictan veredicto: quedan en el expediente como detectores (en los 12
   borradores: superlativo no sostenido 10, cifra de grupo mal repartida 9, conteo de lista falso 1).
3. **Recomputa el `[[CALCULO]]`** y expone los resultados que autorizó (`calculos` en su retorno): el juez semántico los toma como
   evidencia de una cifra declarada.
4. Conserva el juicio entero en los dos sitios que **re-citan un texto ya aprobado** (`respaldo` · `reformular-piso`): ese texto pasó
   el Notario cuando se produjo.
5. El **lavado** de registro y la escalera del suplente digno no cambian.

## 4 · Hallazgos reales (afirmaciones falsas de los composers, encontradas por el Notario)

Regla aplicada: el texto de un composer solo se toca para corregir una FALSEDAD real, y cada corrección queda anotada acá.

**Corregidas** (cada una con su universo real):

- `margen-en-riesgo` / prioridad: «de $4.9M no capturados en toda la cartera» → «en las 5 cuentas materiales» (los $4.9M son ese subtotal);
  cabecera «los 3 de los 8 que más pesan» → «los 3 que más pesan de las 5 cuentas materiales (de 8 bajo el benchmark)».
- `hipotesis-del-usuario` (acciones comerciales): «Donde más pesa: …» ordenaba un universo parcial (las 8 bajo el benchmark) y lo
  anunciaba como cartera → «Donde más pesa, entre las 8 cuentas bajo el benchmark: …».
- `cobranza`: «(y 2 más)» contaba la boleta (8 filas), no la deuda (13 deudores) → «(y otras cuentas más)».
- `cliente-perdiendo-contribucion`: «las otras 2 caen bajo el umbral» medía la materialidad solo en las 5 figs `· YoY` → sobre la
  variación en $ de todas las cuentas. En la plantilla real de 25 clientes la boleta además perdía dos cuentas (Obras del Sur, Ferretería
  Aurora) por repetir una cifra ya publicada: con la boleta corregida, las 13 que caen son materiales y el texto ya no dice «la otra cae
  bajo el umbral».
- `ask-de-cuadro`: «la 1ª bodega de 17 por capital» mezclaba 4 bodegas con 13 SKU → «de 4»; el «de M» se declara como las que traen
  capital en la boleta.
- `cuadro-explicado`: «4 de 4 bodegas concentran su capital en quiebre próximo» (la boleta cuenta 1: agrupaba por la clave «estado» y
  no por el veredicto) → «1 que concentra su capital en quiebre próximo — Santiago $64K»; «2 de 3 SKU … pasa en casi todas tus SKU»
  tomaba las 3 filas del cuadro por las 13 SKU de la cartera → «2 de las 3 SKU que muestra … casi todas las que muestra» y
  «Las 3 SKU que muestra el cuadro suman $33K».
- `lectura-de-ventas`: «el panel publica el margen de 10 de los 12» era un artefacto de la boleta (dos SKU con el mismo margen se
  perdían): ahora publica los 12; contra el plan, la lectura trae el par «$100.0M contra $97.0M».
- `limite-honesto`: el universo de los comparables, dicho.

**Cerradas por decisión del owner antes de la fase 3 (2026-09-15):**

- `plan-de-accion` e `inventario-inmovilizado`: la cifra de «Capital frenado · subtotal/total» ($33K, 3 SKU) se llama **capital frenado**
  —estado crítico, subconjunto del inmovilizado amplio ($55.8K, 5 SKU)—; «capital inmovilizado» ya no nombra esa cifra en ningún composer.
- `resumen-del-negocio`: sin variación de la venta en la boleta la tesis no afirma «no está creciendo»: «El margen viene por debajo de lo
  que debería; si el negocio está creciendo o no, no lo dice este dato».
- `cobranza`: la lista dice su universo —«Quién te debe con saldo vencido, de mayor a menor vencido» (orden declarado sobre los clientes
  con saldo vencido, cada línea con su pendiente y su vencido)— y las cuentas que deben sin vencido van aparte con su saldo («Con saldo
  pendiente y sin vencido: Jumbo $5.1M · Mercado Libre $1.2M»): Jumbo queda fuera del ranking de vencido y dentro de la deuda. Sin plazo
  declarado, la lista es «de mayor a menor saldo» y el orden también se declara.

**Anotada, sin corregir:** `contradiccion-de-metricas`: la inversión (deja más contribución vendiendo menos) se afirma sin que el
verificador la cierre.

Deudas de emisores que el Notario destapó (mitigadas en el índice, no en el emisor): `serieEntidad` imprime «$22.560» (miles con punto)
contra el canon decimal; `proyectar` publicaba `raw` en miles (corregido: moneda cruda); `simulateCarga`/`diagnose` rotulan «Supuesto»,
«Liberado», «Medida» con `dimension=cliente`; el movimiento de carga viaja sin signo; `Easy · Monto` (exceso de carga) llega sin rótulo;
el perfil de entidad emite «Ventas · Fmt» y «Target Carga» (ecos sin dueño ni vocabulario: la boleta ya no los toma).

## 5 · Cómo se mide y se corre

- Suite: `npm run gates:offline` (la prueba: «0 TOCARON LA RED · 0 CON CREDENCIAL VIVA»).
- Un composer: `node _verificar_composer.mjs <playbook|encargo> [pregunta|P1|P2] [--texto] [--decl]`.
- Gates propios: `_notario_semantico_gate.mjs` (fase 1: verificador, presencia, tres redacciones) y `_notario_semantico_flujo_gate.mjs`
  (fase 2: el turno entero; secciones A-E, con la línea base del flujo).
- Fase 3 (pendiente, exige gasto nombrado): corridas vivas para medir cuánto declara el modelo real y cuánto de lo que dice queda sin
  declarar; el expediente `agente.notario` ya lo registra por turno.
