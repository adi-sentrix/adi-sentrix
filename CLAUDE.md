# ADI · Sentrix — reglas del proyecto

Este archivo lo lee **todo chat abierto sobre este repo**, incluidos los worktrees. Es corto a propósito:
se relee en cada turno. Lo que no es regla dura vive en la memoria (ver el final).

Idioma: **español**, registro formal (LatAm, sin chilenismos). El owner es **jc**; decide producto y negocio,
no lee código. Hablarle **sencillo y corto**: conclusión primero, sin jerga.

---

## 1. Qué es esto

Dos piezas de un mismo producto, con reparto de trabajo que no se cruza:

- **Sentrix MUESTRA.** La superficie: Mesa de Control con cuatro caras (Comercial, Capital, Resultado, Ficha),
  cuadros y gráficos. Vive en `src/ui/SentrixPanel.jsx` y `src/adi/sentrix/`.
- **ADI EXPLICA.** El asesor que responde sobre lo que Sentrix muestra. Vive en `src/adi/`.

La tesis: **Comercial DETECTA → la Ficha EXPLICA → Sentrix DEMUESTRA.**

**La promesa**, y gobierna el producto: toda pregunta se responde con las tres cosas, en orden —
**01 QUÉ ESTÁ PASANDO · 02 POR QUÉ / DÓNDE · 03 QUÉ HACER PRIMERO.**

⚠️ **Y SE CUMPLE ENTRE LAS DOS SUPERFICIES, NO DENTRO DE CADA UNA** (owner 2026-09-08, al retirar el bloque 03
de la cara Comercial): *«al final Sentrix muestra dato, el que te dice qué hacer es ADI; por lo tanto eso no
aportará y puede confundir al usuario»*. **Sentrix muestra el 01 y el 02; el 03 es de ADI.** Un tablero que
ordena acciones sin poder explicarlas ni escuchar el contexto del dueño es la mitad de un asesor — y dos
superficies diciendo qué hacer son dos verdades. El módulo sigue calculando el cruce de deterioros: es la
evidencia con la que ADI arma la prioridad cuando se la piden.

Corolario de vocabulario: **ADI asesora, no gestiona.** Nada de *«recuperar margen»* ni *«recuperar venta»* como
si fueran tareas del sistema — palabra del owner: *«no somos un sistema que gestiona cosas, es asesor»*.

Que afirma el porqué sin evidencia, **miente**.

---

## 2. Las tres reglas

1. **Proporcionalidad semántica.** Nunca afirmar más de lo que la evidencia autorizada demuestra. Cada
   afirmación lleva sello: `probado` (medido), `indicado` (derivado) o `abierto`. Las limitaciones **se
   declaran en pantalla** — no se disimulan reescalando ni se omiten.
2. **No hay causalidad sin respaldo.** Localizar dónde pasa algo **no** es explicar por qué. Por eso el
   bloque 02 de Capital se llama "Dónde ocurre" y dice en pantalla que la bodega localiza pero no explica.
3. **Nada hardcodeado.** Ninguna cifra, umbral ni rótulo se escribe a mano. Todo sale del motor o de la
   configuración declarada por el cliente. Corolario: **cero cálculo en React** — la frase y el número se
   arman en el módulo, la vista solo pinta. Una cuenta dentro de un componente es un defecto.

4. **La conclusión es del procedimiento, no del narrador** (owner 2026-09-10). El LLM decide cómo explicarlo,
   cuánto resumir, cómo adaptarlo al destinatario. **No puede cambiar**: el cliente prioritario, la cifra
   relevante, el ranking, la causalidad demostrada, el veredicto, ni la primera acción que el procedimiento
   determinó.
5. **La red de respaldo no es un segundo cerebro** (owner 2026-09-10). Puede ser un segundo camino de
   *entrega*, jamás re-analizar y decidir distinto. El respaldo intenta primero EL MISMO procedimiento sin
   cerebro (`respaldo-piso` en ChatADI); el oráculo queda como red final y obedece **las mismas leyes de
   registro** (`vetosDeRegistro`, contratoAgente — una regla, un archivo). Y toda respuesta declara qué
   mecanismo la produjo (`via`/`caida` en el rastro): nunca se evalúa una respuesta sin saber quién la escribió.
   Vocabulario de la referencia: se dice **«objetivo»** («meta»/«target» vetadas; «nivel declarado» le pareció
   técnico al owner). El sello de período («datos del año cerrado») va UNA vez, no estampado en cada respuesta.

Derivadas que se rompen seguido:
- **Una sola verdad.** Mismo concepto = misma palabra y mismo número en toda superficie, del mismo campo.
- **La verdad es cifra + dueño + SIGNIFICADO** (owner 2026-09-12, ley en `_CONSTITUCION_ADI.md`). Una cifra real
  narrada como otra métrica («% del total» dicho como «crece») es falsa; el rótulo de la boleta declara lo que la
  cifra es y el muro lo verifica (`_METRIC_VOCAB` en guardC, con `participacion` y `variacion`).
- **Dos montos parecidos de universos distintos NUNCA van juntos** sin decir de cuál sale cada uno.
- **Cuatro garantías transversales** (owner 2026-09-13, ley en `_CONSTITUCION_ADI.md`; viven en guardC y en
  `vetosDeRegistro`, para los dos caminos): (1) evolución temporal solo con evidencia temporal — «cae»,
  «se deteriora», «calidad deteriorada» exigen la variación o la serie de ESA métrica en la boleta; (2) una brecha
  contra referencia es una ESTIMACIÓN, nunca «dinero que ya se perdió»; (3) cada cifra conserva su naturaleza
  económica — la contribución no es caja ni capital; (4) comparaciones solo entre métricas equivalentes y
  disponibles, con la cifra de cada lado en la oración. Y la conclusión del procedimiento (prioridad oficial,
  definición de sus subtotales) se le declara al cerebro ANTES de escribir (`conclusiones(figs)` del playbook).
- **Lo descartado, lo indicado, lo abierto y lo que cambió en el tiempo no se mezclan** (owner 2026-09-13, tras la
  corrida 5; ley en `_CONSTITUCION_ADI.md`): «no ganamos más» exige la variación de contribución/resultado/margen;
  un mecanismo INDICADO o ABIERTO no se descarta («…, no a precio ni a mix» se juzga por su propia cláusula — la marca
  de la afirmación de al lado no lo cubre); «se deterioró» con cualquier sujeto exige serie, y la hipótesis no absuelve
  esa palabra. Todo en `vetosDeRegistro` (`ganancia-no-comparada`, `mecanismo-sin-sello`, `deterioro-no-medido`) y
  en la doctrina `conclusiones(figs)`, con el sello de cada mecanismo tomado de la boleta.
- **Lo demostrado se describe sin causa ni jerarquía causal** (owner 2026-09-13, corrida 6; ley en
  `_CONSTITUCION_ADI.md`): la causa dicha de paso («con mejor costo relativo», «gracias a su mix») vale solo con el
  mecanismo PROBADO (`mecanismo-sin-sello`, atribución); y «dominante / principal / sobre todo / la mayor parte / pesa
  más» exigen la parte del efecto medida en la boleta (`jerarquia-causal-sin-medida`, con o sin huellas). Un mecanismo
  probado es «un mecanismo probado», no «la causa dominante».
- **El contrato comercial** (owner 2026-09-13, ley en `_CONSTITUCION_ADI.md`; `src/adi/agente/contratoComercial.js`):
  «toda pregunta comercial parte de la misma realidad comercial; la pregunta determina el foco de la respuesta, no qué
  evidencia tiene disponible ADI». Si el tema es comercial, cinco lecturas corren SIEMPRE antes del cerebro, unidas a las
  del procedimiento (salesRead · marginRead bajo benchmark · contributionRead · diagnose · rolesCartera; la serie de
  margen solo con histórico real), y viaja la doctrina comercial (las conclusiones del procedimiento). Medido:
  22 preguntas comerciales pasaron de 3,0/10 capítulos a 10/10, ~15K chars por turno bajo el techo de 28K
  (`_contrato_comercial_gate`). Fuera del contrato: inventario, cobranza, otros ejes (marca/familia/canal), definiciones
  y reformular. Y **la brecha se parte contra el BENCHMARK, una sola vez** (`descomposicionDeBrecha` en specRetrieval):
  contribución no capturada = carga comercial alta + brecha por precio y costo, exacto en el universo declarado —
  diagnose la publica al agente (como gancho) y la pestaña Comercial la pinta desde la misma función.
- **Universos consistentes** (owner 2026-09-13, ley en `_CONSTITUCION_ADI.md`): una cifra solo es parte de otra si
  pertenece a su universo — «de eso / de los cuales / $Y de los $X» entre subtotales exige el mismo universo declarado
  en el rótulo (`subtotal-de-otro-universo`); cada subtotal lleva su universo («Carga comercial alta · subtotal · 6
  cuentas sobre el nivel declarado (5 de ellas bajo el benchmark)»); la partición medida se usa («de los $4,9M, $588K
  carga y $4,4M precio y costo») y con ella «pesa más» en dinero cuenta como medido; «precio y costo» no se separa
  (`precio-y-costo-no-se-separan`).
- **El contrato de dominios** (owner 2026-09-14, ley en `_CONSTITUCION_ADI.md`; `src/adi/agente/contratoDeDominios.js`):
  «la pregunta determina qué dominios participan; cada dominio aporta su realidad suficiente; ADI solo relaciona
  aquello que el archivo demuestra que puede relacionarse» — composición, no exclusión. Comercial (+ unidades vendidas,
  métrica `unidades`), Inventario (la foto completa: `inventoryStatus{estado|frenado}`, capital/días/stock por SKU,
  capital por bodega —y por marca/familia si la pregunta las nombra—, más el cruce por SKU `top_sellers` +
  `tensionRead` cuando Comercial participa) y Cobranza (`cobranza{}`). La compatibilidad entre universos la declara
  el PACK (`compatibilidad`, medida en `motorKpi`; el demo la declara divergente a mano) y `reconcilian` la lee:
  «comparable» = se relaciona nombrando los dos marcos, jamás se suma (`marco-temporal-no-declarado` en guardC).
  Clave única Comercial↔Inventario: el SKU. Cliente×inventario y `clientesPorSku` (afinidad estimada) APAGADOS hasta
  que las filas cliente×SKU entren al pack. Con dos dominios, los playbooks de uno solo se retiran (`multidominio`)
  y el cruce por SKU tiene piso propio (`cruce-por-sku`). Medido: dominios en la boleta 2/20 → 19/20 en tres datasets.
- **El estándar de los cuatro puntos** (owner 2026-09-14, tras la corrida en vivo del cruce; ley en `_CONSTITUCION_ADI.md`,
  fixtures reales en `fixtures/cruce-vivo-2026-09-14.json`, candado `_cuatro_garantias_del_cruce_gate`): (1) una cifra
  correcta no queda asociada a un atributo incorrecto —bodega, marca, familia, canal, entidad— (`atributo-mal-asociado`);
  (2) una relación dicha en palabras («el doble», «cuatro veces», «la mitad») cierra con las cifras o no se dice
  (`relacion-en-palabras-no-cierra`, con el rango que fija el matiz); (3) en los cruces la conclusión sale del análisis,
  no de la premisa del usuario: el piso abre «No: …» cuando lo medido lo contradice, la doctrina lo declara y
  `premisa-adoptada` veta el «Sí» complaciente; (4) una respuesta buena del modelo no se degrada por falsos positivos:
  el sujeto de la oración es el dueño por defecto, la coordinación «A y B … (x y y)» asigna por orden y «17 días» se lee
  entero. Ambos jueces nuevos viven en `src/adi/agente/atributosYRelaciones.js` y se cobran en `vetosDeRegistro`.
- **La cobertura del encargo multidominio** (owner 2026-09-14, tras la prueba real en producción v2.28; ley en
  `_CONSTITUCION_ADI.md`, fixture `fixtures/encargo-produccion-2026-09-14.json`, candado `_cobertura_del_encargo_gate`):
  «si el usuario pide Comercial + Inventario + Cobranza, la respuesta final debe cubrir los tres, responda el modelo o el
  respaldo»; «en un encargo múltiple, foco significa ordenar y jerarquizar, no eliminar dominios pedidos»; «una sola
  lectura… con una prioridad común»; «el respaldo puede ser menos elegante, nunca menos completo». Las partes del encargo
  (con su dominio) viven en `src/adi/agente/partesDelEncargo.js` —la hoja que comparten el ensamblador
  (`encargoCompuesto.js`) y el contrato (`parte-del-encargo-omitida` en `vetosDeRegistro`, cobrada al cerebro y al
  ensamblador)—; el cerebro recibe la doctrina del encargo y el cruce ya no le dice «SOLO cuando cambie la lectura». Una
  pregunta simple de dos dominios no es un encargo: la selectividad sigue permitida. ⚠️ El 20×3 no vio este caso porque
  ninguna de las 20 es un encargo compuesto y medía dominios en la BOLETA, no en la RESPUESTA.
- **La prioridad integrada por señales** (owner 2026-09-14; ley en `_CONSTITUCION_ADI.md`, `src/adi/agente/prioridadIntegrada.js`,
  candado `_prioridad_integrada_gate`, caso permanente: el mismo prompt de producción): «materialidad + severidad + urgencia
  de cada señal, no solo cuántos dominios coinciden». Tres lentes por dominio con señales de la boleta; dentro del dominio
  cada lente ordena (prioridad por dominio); entre dominios, señal por señal en la clave real (el cliente), nunca por suma
  de montos; coincidir agrava, no decide; los SKU van aparte; el criterio se dice con las cifras. Es la conclusión del
  procedimiento: viaja al cerebro y `prioridad-integrada-cambiada` veta que la cambie. Medido: Lider antes que Falabella.
  **Y el cierre integrado va siempre** en un encargo multidominio que pide una sola lectura, aunque el usuario no diga
  «prioridad» («mayor riesgo», «qué debería preocuparme», «prioritario», «lo más grave», «merece atención primero» son la
  misma decisión); ninguna prioridad local («Yo miraría primero Falabella, criterio mío») sobrevive como global; el Notario
  verifica que el último párrafo con prioridad sobre las cuentas nombre a la primera. Dos casos permanentes.
  **El criterio del usuario manda** (owner 2026-09-14): explícito («prioriza caja/ventas/riesgo», «quiero recuperar
  contribución», «ahora ordénamelo por…») → manda; implícito claro («mayor riesgo económico») → se interpreta; realmente
  ambiguo → el cerebro puede preguntar qué lente; lectura ejecutiva general → ADI entrega la suya (riesgo integrado) con el
  criterio DECLARADO y la nota de que otra lente cambia quién va primero. Lider primero es del criterio de riesgo integrado,
  no universal (por contribución/ventas, Falabella). Lentes en `CRITERIOS`; el cambio de criterio en un turno siguiente lo
  atiende `prioridad-por-lente` con los mismos hechos.

- **El Notario semántico (owner 2026-09-15, fases 1 y 2, offline).** Decisión del owner tras la ronda fuera de muestra (38 % FP · 44 % FN
  con patrones de palabras): «Notario verifica la afirmación y su evidencia, no la redacción». *El modelo redacta; el modelo declara qué
  está afirmando (bloque `<<AFIRMACIONES>> … <<FIN>>`, una afirmación JSON por línea: cifra · orden · relacion · grupo · conteo ·
  variacion · estado · lectura, con su `texto` literal); el Notario verifica la afirmación contra la evidencia estructurada; la redacción
  no determina la verdad.* Reglas duras: sin bloque → `sin-declaracion` y nunca verde; lo incompleto o sin evidencia es
  `no-verificable`, nunca verdadera; `lectura` no es refugio para hechos; la multa nombra la afirmación que falló y la verdad de la
  boleta; el respaldo y los composers determinísticos declaran con el mismo estándar (colector `declarar.js`, texto byte-idéntico);
  guardC conserva las LEYES DE LA CASA (vetan) y sus chequeos de hecho quedan como detectores. Un hecho verificable no puede quedar
  no-verificable por una limitación de la boleta: la venta del año anterior, los KPIs del negocio y las cifras repetidas en otra entidad
  viajan con rótulo. Medidas (`_notario_semantico_flujo_gate`): 95.5 % declaraciones correctas, 2.9 % omitidas, 0 FP · 0 FN, 0/6
  servido sin Notario. La tasa del MODELO real se mide en vivo (fase 3, gasto nombrado). Documentos: `_NOTARIO_SEMANTICO_FASE1.md`,
  `_NOTARIO_SEMANTICO_FASE2.md`. Los guiones de los gates declaran con `_guion_declara.mjs` (fuera de `src/`, no es producto).
- **Fase 4, etapa A (owner 2026-09-16, offline): la casa canoniza la FORMA de la declaración.** «Cambiar la forma de escribir una afirmación no
  puede cambiar su verdad; el modelo no debería necesitar conocer convenciones internas de ADI». `src/adi/notario/resolutor.js` traduce cada
  declaración a la forma canónica ANTES del veredicto (reglas en su cabecera; tres reglas duras: única-o-no-se-resuelve, el VALOR es el
  comprobante, solo se rellena lo que el fragmento dice) y `ubicar.js` ubica el fragmento con tolerancia escalonada. **Una sola definición
  por métrica/eje:** «carga comercial alta» es la del DETECTOR (6 cuentas), publicada por la proyección desde la misma función que la boleta
  (`datoProyectado.conjuntos`); las que solo exceden el nivel se llaman «sobre el nivel declarado de carga». **Inventario verificable como
  Comercial:** la proyección declara el estado de la Mesa Capital de cada SKU (misma función) y la alerta «crítico». Candado
  `_resolutor_gate` («tres formas de la declaración, un veredicto» sobre 1.482 afirmaciones; la fase 3 re-juzgada; carnadas).
- **Fase 4, etapa B (owner 2026-09-16, offline): la omisión no cuesta la premium.** Si el cierre falla SOLO por la declaración, el bucle pide
  únicamente el bloque con la lista exacta de lo que falta (`_MENSAJE_DECLARACION`), re-juzga la MISMA prosa (sitio «declaracion») y sirve la
  premium original; una falsedad destapada sigue a la reparación completa. La casa asiste la identidad mecánica (`asistirIdentidad`: cifra
  verbatim con una sola fig, verificada y consistente; nunca órdenes, relaciones, conteos, variaciones ni estados). La carta de hechos del
  turno (`src/adi/notario/carta.js`) viaja con los resultados de cada ronda. Protocolo v2 de la instrucción (`declaracion.js`). Candado:
  `_notario_semantico_flujo_gate` §F. Pendientes (`_NOTARIO_SEMANTICO_FASE4_DISENO.md` §11): la ronda adversarial (UltraCode, offline, con
  `_adversarial_notario_harness.mjs`) y la medición en vivo (etapa C, gasto a nombrar).
- **Fase 4, ronda adversarial (2026-09-16, offline): 69 roturas confirmadas fuera de muestra, 69 cerradas, 23 controles.** Las reglas que quedaron
  (cada una con su carnada en `_notario_adversarial_gate`, 92): un concepto de la casa NUNCA casa con otro por contención (`_casa`); el universo de un
  subtotal se casa con el rótulo del grupo y el vocabulario de conjuntos («(de M …)» describe a todo el grupo, «(K de ellas …)» a una parte), si
  nombra otro conjunto decide el conjunto que identifica, y el superconjunto vale solo si la métrica no tiene valores fuera del grupo (sin evidencia:
  «incierto» = no verificable); los conteos se rankean y el mejor decide (una enumeración se juzga por los nombrados); un estado lo cubre solo un
  estado o una métrica que lo nombra; la cobertura de una cifra por su canon respeta al dueño; la negación factual de un orden o variación es un
  hecho (solo la epistémica exime); las cifras en palabras y los superlativos libres son puntos. Etiqueta 3.reparacion.3 de la fase 3 reetiquetada
  verdadera con la definición del owner (bajo el benchmark ∩ sobre el nivel = 6). `_NOTARIO_SEMANTICO_FASE4_DISENO.md` §12.
- **Fase 4, ronda adversarial 2 (2026-09-16, offline): 91 roturas confirmadas sobre la versión cerrada, 91 cerradas, 16 controles** (gate 199).
  Lo que quedó como ley: el valor es el comprobante a la precisión de lo impreso («+7,5%» vale por 7.55 impreso 7.6%; «58%» por 57.7% NO); el
  universo de un conteo se casa por lo que dice («todas salvo Lider» = |U| − 1 o su complemento, «ninguna» = 0 o |U|, la negación conserva el verbo,
  bodega + estado restringe a ese estado); la cobertura es por SIGNIFICADO («bajo el benchmark» lo cubre la brecha, «sobre el nivel» un predicado o
  métrica que lo diga, por pares; «equivale a $X» es la cifra; «como Lider» solo por relación; «el más crítico» es superlativo; «31 de agosto» es
  fecha; «vs.» no cierra la oración); el dueño de la cifra con las mismas reglas en presencia y juez (el negocio no cubre la cifra de una cuenta
  salvo referencia o total; las entidades de referencia —«más que X», «después de X», «contra X», «igual que X,»— no son dueñas; «respectivamente»
  reparte solo su lista; la bodega dicha como lugar no es dueña); la consistencia lee el FRAGMENTO (tres lados de un comparativo, lados al revés,
  «no es la que más» = comparativo menor, meses abreviados, el estado del tramo del sujeto, «recuperó $X» = abonado); y la bodega de la prosa se
  juzga: un estado sin bodega la toma de la prosa antes de verificar (`completarBodegas`). Nombres parciales únicos se resuelven («Polar»).
  Línea base del flujo: 20 omisiones (las 8 que se fueron eran la fecha «31»). La suite completa destapó 25 gates rojos por falsos positivos sobre los
  composers (derivación por tolerancia, período pegado a la cifra, «mientras» ≠ «tras», «se completa en X» es lugar, «las 3 SKU del cuadro», el 0x08 de
  un heredoc en un regex): cerrados en juez/presencia/verificar/declaracion, ningún composer tocado. Suite 268/268 · 0 red. Pendiente: ronda 3 sobre
  esta versión; después la etapa C en vivo (gasto a nombrar). §13.
- **Fase 4, ronda adversarial 3 y cierre de raíz (2026-09-17, offline): 100 roturas confirmadas, seis familias de diseño cerradas por
  significado, 0/100 y 29 controles nuevos (gate 328).** Mandato del owner: «no quiero parches caso a caso ni reglas para frases específicas»;
  «ADI sí puede hablar en estados naturales, pero cada estado debe tener una definición empresarial verificable»; «ADI sí puede responder con
  tablas»; «toda tasa o porcentaje debe conservar su significado completo: valor + base/denominador + universo + período». Lo que la casa sabe
  ahora: `src/adi/notario/tasas.js` (cada tasa con su BASE; la base dicha junto a la cifra se contrasta, se calcula con la boleta o es falsa —
  «recuperó el 45 % de su saldo pendiente» es falsa: recuperado = abonado ÷ venta a crédito—; el ledger y el cuadro estampan la base de toda
  participación), `estados.js` (una definición por estado: inventario y cobranza —«al día» = saldo vencido 0—, sus formas, su contrario y sus
  dueños coordinados; «saldo por vencer» = pendiente − vencido, calculado por `mesaFlujo` y publicado por la proyección), el VALOR de un
  orden/relación/conteo/variación es comprobante, los universos negados/excluidos y los umbrales son conjuntos (el sujeto fuera del conjunto es
  FALSO), `estructura.js` (tablas, listas anidadas y encabezados dan dueño y columna), la gramática del dueño (coordinados con reparto
  distributivo, aposiciones, elipsis, anáfora ordinal, doble negación, cláusula continuada) y la envoltura por SIGNIFICADO (misma métrica y mismo
  sujeto; «caer» sin métrica pegada es «bajo el benchmark», el verbo de la casa). La suite destapó 18 gates rojos por falsos positivos sobre
  composers y guiones: cerrados en el Notario, ningún composer tocado. Suite 268/268 · 0 red. Decisión de producto abierta: exigir la base de toda
  participación en la prosa. Sigue: ronda 4 (formas nuevas y cruces Comercial · Cobranza · Inventario) y después la etapa C (gasto a nombrar). §14-15.
- **Fase 4, ronda adversarial 4 (2026-09-17, offline): el cierre de raíz generaliza A MEDIAS — 108 roturas confirmadas (105 estructurales) en
  OCHO raíces nuevas y 44 % de lo verdadero verde a la primera; SIN cerrar, a decisión del owner.** Las seis familias de la ronda 3 no se
  reabrieron; lo cerrado por ESTRUCTURA aguanta formas nuevas y cruces. Lo que no: el léxico de los estados (dos regex desiguales: «buen pagador»,
  «sin vencidos», «no rota» no son punto), umbrales en palabras/meses/rango y de la POLICY sin número, el álgebra de universos (exclusión por bodega,
  «fuera del top 3», unión/negación), la posición de la base (antes de la cifra, cabecera de columna, anafórica, posesiva, declarada ≠ dicha), el
  dueño en sintaxis nuevas (inversión predicativa, dueño pospuesto, viñeta padre, elipsis paralela), «lidera en X y en Y», el puente de cobranza
  entre columnas y la poda huérfana entre párrafos. Falsos positivos gemelos («vende $17,8M con un margen de 21,5 %» cae por la ventana del juez).
  Definiciones de producto por fijar antes de cerrar: buen pagador = vencido 0; «no deja contribución» = contribución ≤ 0; cuantificadores vagos;
  participación sin base. §16.
- **Notario v3 · «verdad finita, prosa infinita» (owner 2026-09-17, plan aprobado: `_NOTARIO_VERDAD_FINITA_PLAN.md`; offline, detrás de
  `ADI_NOTARIO_V3`, APAGADO en todos los perfiles hasta el piloto).** Decisión del owner tras la ronda 4: «no quiero seguir resolviendo frases una por
  una… la prosa puede ser infinita; la verdad de ADI debe ser finita, gobernada y verificable». *ADI entiende y razona → trabaja sobre verdades
  verificables → interpreta → redacta libremente; Notario verifica hechos identificados, no reconstruye la verdad desde la prosa.* El cerebro emite
  `<<HECHOS>> … <<FIN>>` (un hecho JSON por línea con id: ref · cifra · orden · relacion · grupo · conteo · variacion · estado · razon · derivada ·
  propuesta · lectura; universos TIPADOS) y prosa anclada `{{ids: tramo}}` con placeholders `{id}`/`{id.campo}`; la casa evalúa el libro
  (`src/adi/notario/hechos.js` sobre `verificar.js`), comprueba las anclas con una lista cerrada (`anclas.js`: entidad · número · métrica · estado ·
  dirección · lados · base · universo visible · sujeto estructural · dominio · período · modalidad · proporción · tablas · predicación sin hecho),
  RENDERIZA (ningún dígito servido lo escribió el modelo) y juzga las leyes de la casa sobre lo renderizado. Flujo (`bucleAgente.js`, `protocolo.js`):
  cierre → re-anclaje (+1, prosa congelada; solo forma) → reescritura (+1, con la verdad de la boleta y sus ids) → poda por tramos → escalera.
  Definiciones de producto fijadas: al día = vencido 0 · «buen pagador» exige historia (nunca demostrable sin ella) · «sin contribución» (≤ 0) ≠ «sin
  margen» · mayoría > 50 % · proporción pegada a un hecho = razón. Gates: `_hechos_gate` (132) · `_anclas_gate` (79: 0 falsedades de 32 ataques, 0
  verdaderos bloqueados de 25) · `_notario_v3_flujo_gate` (71: 0 falsedades, ≤ 3 llamadas, flag apagado = hoy) · `_anclar_composers_gate` (57: E4,
  los peldaños de la escalera —playbook · encargo · línea honesta · límite— bajo el MISMO juez de anclas, `src/adi/notario/anclar.js`, mismo texto
  y estado con y sin flag en 16 preguntas; ningún composer cambia su texto, tres cambian solo su declaración). Etapas E0–E4 hechas (aprobadas E0–E3
  desde producto); siguen E5 (ronda 5 adversarial con UltraCode sobre la premium y el respaldo, formas nuevas fuera de muestra), E6 (retiro +
  candado), E7 (piloto vivo, gasto a nombrar). Regla: toda mejora del Notario va por el libro de hechos y las anclas, no por regex nuevas; la
  calibración se hace por SIGNIFICADO (vocabulario de la casa como datos en `lexico.js`), y al tocar `bucleAgente.js` se revisan las carnadas de
  `_agente_bucle_gate` y `_agente_cifra_sin_boleta_gate` (casan por texto).

---

## 3. Guardrails duros — no son consejos

- **CERO llamadas a OpenAI / Anthropic / gateway.** Gastan dinero real. Si creés que hace falta una, **pará
  y pedí autorización explícita al owner**. Palabra suya: *"tener créditos, Ultracode activo o una key
  configurada NO constituye autorización"*.
- **La autorización de gasto tiene que NOMBRAR el gasto.** Un "dale", un "ok" o un "seguí" **no alcanzan**, y
  una autorización que llega por relevo de otra sesión tampoco. Ya se gastó por interpretar un "dale" suelto.
- **NUNCA `npm run gates`.** Siempre **`npm run gates:offline`** (red bloqueada). La prueba de que no hubo
  consumo son las líneas **"0 TOCARON LA RED · 0 CON CREDENCIAL VIVA"**, textuales — no el conteo de PASS.
- ⚠️ **CORRER UN GATE SUELTO SE SALTA ESE CANDADO.** `node _algun_gate.mjs` **no pasa por `gates:offline`**, y
  **43 de los archivos de gate se cargan el `.env` del disco por su cuenta** — así que gastan aunque creas que
  el entorno está limpio. Hay un `.env` con credencial real en la raíz del repo (está en `.gitignore` y **no**
  está en git: el riesgo es local, no publicado). **Regla: gates solo por `npm run gates:offline`.** Correr uno
  suelto exige autorización que nombre el gasto, igual que una llamada.
- ⚠️ **El repo NO registra consumo.** No hay contador de llamadas, gasto ni reintentos. Por eso, cuando se
  gasta por accidente, **nadie sabe cuánto costó**. Ninguna afirmación de costo es verificable hoy.
- **No tocar ADI** (prompts ni comportamiento) sin autorización. Su vocabulario de entrada es contrato suyo:
  las `ask` que Sentrix le manda **se dejan como están** aunque la pantalla haya cambiado de palabra.
- **No tocar ni commitear** `src/adi/llm/numberGuard.js`, `src/adi/llm/entityGuard.js`, `_guard_gate.mjs`.
  Es trabajo sin commitear de otra sesión. Aparecen sucios: es normal. **Nunca `git commit -a` ni `git add -A`.**
- **`main` no se mueve sin la palabra del owner** (la palabra es *"deployalo"* o *"deploy"*). Se trabaja y se
  empuja a **`dev`**.
- **El hosting DESPLIEGA SOLO al mover `main`** — verificado dos veces el 2026-09-08: el commit apareció en
  `/api/version` ~30 segundos después del push. Acá decía lo contrario («el deploy es manual, el repo no tiene
  Vercel enlazado, `main` al día ≠ sitio publicado») y eso hacía pedirle al owner un paso que no existe.
  ⚠️ Lo que sí es cierto y no cambia: **mover `main` PUBLICA**, así que la palabra del owner sigue siendo la
  única puerta — y la verificación oficial es `curl app.adiai.cl/api/version` mostrando el commit esperado, no
  el push. Un build roto en el hosting deja el sitio en el commit anterior sin avisar (ya pasó: ver
  `adi-edge-vs-node-bundle` en la memoria).
- Decisiones de **diseño y UX son del owner**. Traer opciones, no asumir.

---

## 4. El dato — lo que hay y lo que no

Saber esto evita inventar. Todo verificado.

**Los dos universos que NO reconcilian — EN EL DATO DE FÁBRICA.** `skusMargen` (venta comercial) y `skuInventario`
no son el mismo negocio medido dos veces: la venta viene en **miles** ($100.0M anuales), `stockUSD` en **dólares
crudos** ($135.000 totales), y las unidades declaradas difieren **entre 4x y 35x** por SKU.
`src/adi/sentrix/mesaCapital.js` **NO importa `skusMargen`**, y ese es el sello: lo que no entra al módulo no
se cuela a un texto. **Una cifra que haga cerrar esos dos universos es una alarma, no un logro.**
⚠️ **Esa divergencia la declara el PACK, no el contrato** (owner 2026-09-14): el demo la declara a mano en su
tenant (`compatibilidad`, byte-igual a `DIVERGENCIAS`); un pack de planilla la mide en la ingesta —las dos puntas
en moneda cruda, el stock valorizado con el costo de Ventas, los días con sus unidades— y declara **comparable**:
se relacionan por SKU nombrando los dos marcos (período cerrado / foto de inventario) y **nunca se suman**. Un pack
sin la llave cae a `DIVERGENCIAS`. Lo que NO cambia en ningún archivo: venta y stock no se consolidan, y los días
de inventario se citan del dato, no se recalculan.

**«Cobertura» quedó resuelta POR ELIMINACIÓN, no por renombre.** El dato trae `doh` y `cobertura`, ambos
declarados y **distintos** (difieren en 8 de 13 SKU, hasta 28 días). `cobertura` es un duplicado redondeado:
**no entra a la boleta, se declina.** No se le buscó nombre nuevo. En pantalla se dice **"Días de inventario"**
y se usa `doh`. Gate: `_ambiguedad_terminos_gate.mjs` se pone rojo si un término visible vuelve a apuntar a dos
cosas.

**Un rótulo visible no puede nombrar dos campos.** Error real y caro: «Margen» y «Ventas» estaban declarados
dos veces con la misma etiqueta, el mapa se armaba con `Object.fromEntries` y **ganaba el último**. Resultado:
*"mis 5 clientes de mejor margen"* devolvía Falabella 22% cuando el real es La Polar 34%, **sellado como
"descendente"** sobre una lista que no lo estaba. Ya corregido. La lección: **una colisión de etiqueta se
declara, no se resuelve en silencio**; y si el campo no existe en ese eje, se **declina** en vez de sellar un
orden que no se aplicó.

**Los días son un valor declarado, no una cuenta.** `doh` no se recomputa: `stockUnd ÷ ventaDiaria` coincide
con `doh` en **2 de 13 filas**. Se usa porque es el campo con el que `diagnoseInventario` asigna los estados.

**Huecos verificados** — quien prometa responder esto, inventa: no hay historial cliente×SKU (por eso "quiénes
dejaron de comprar" no es respondible) · no hay entradas ni recepciones (por eso "Entradas y Salidas" no es
dibujable) · no hay lead time de proveedor · no hay estado de orden de compra · no hay causa de la detención ·
no hay meta de rotación por familia · **ningún SKU está en más de una bodega**, así que transferir stock no es
evaluable.

**Benchmark ≠ promedio ≠ meta.** Nunca como equivalentes. El benchmark lo declara el cliente. La meta **no
existe** en este dato: *"las metas las fija el cliente, no nosotros"*.

**Registro ejecutivo.** Prohibidas en superficie: *plata, vara, dormido, guita, palanca, apretar*. Hay un gate
que las barre (`_registro_gate`). Se dice **capital**, **benchmark**. También: **"inmovilizado"**, no
"detenido".

---

## 5. Cómo trabajar

- **Verificar antes de afirmar.** Una opinión que no fue a mirar el código o el dato termina confirmando lo
  que ya se pensaba.
- **Una fila no es una muestra.** Error real y caro de este proyecto: se verificó un SKU, se generalizó, y el
  owner decidió sobre un motivo falso.
- **Decir que no.** Cuando el dato no sostiene lo que se quiere mostrar, el trabajo es decirlo — no buscar la
  forma de mostrarlo igual.
- **Si la orden no tiene objeto**, una línea y parar.
- **"Declina honestamente" cuenta como éxito**, no como falla. Un límite declarado vale más que un verde
  apretado.
- **Impedir el consumo técnicamente, no por instrucción.** Una regla escrita no frena un gasto; un cerrojo sí.
- **Al abrir o delegar a otro chat, pasarle el ESTADO del producto** (qué está desplegado, qué es legado, qué
  escenario está activo), no solo el diseño y las restricciones.
- **No crear un contrato ni una memoria paralela.** Se extiende lo que hay.
- **Anotar lo que se pierde por el camino** y recordárselo al owner cuando pregunte por pendientes.
- **Preferir el desacuerdo antes de ejecutar**, no después.
- **Un top-N que no declara su cola miente por omisión** aunque cada barra sea correcta.
- Frenar en decisiones no obvias y traérselas al owner.

---

## 6. La memoria — leerla al empezar

El fondo del proyecto (decisiones, historia, pendientes) está en:

```
C:\Users\jcnav\.claude\projects\C--Users-jcnav-ADI-Sentrix\memory\MEMORY.md
```

⚠️ **Esa carpeta es la única con contenido.** Un chat abierto desde `ADI_PROYECTO`, desde un worktree o desde
`landing` recibe una carpeta de memoria **vacía** y arranca ciego. Si estás en una de esas, **leé el
`MEMORY.md` de la ruta de arriba** antes de opinar, y escribí ahí lo que valga la pena guardar.

---

## 7. El agente es EL camino — y el natural ya no existe (La Poda, owner 2026-09-05)

**«No quiero mantener dos ADIs.»** El turno libre lo atiende **ADI Agente** (certificación congelada en
`_certificacion_congelada_gate`). El **camino natural se retiró del código** el 2026-09-05 con la palabra del
owner («poda inmediata», tras el pulido del anclaje): no existe `caminoNatural.js`, ni `naturalPrompt.js`, ni
la rama `modoNatural` del gateway, ni el flag `ADI_CAMINO_NATURAL`.

- La cascada del turno libre es **agente → oráculo** (dos peldaños, probada con carnada en
  `_cascada_resiliencia_gate`). Apagado manual del agente: comentar `"ADI_AGENTE"` en FEATURE — eso deja el
  turno en el oráculo, la red más profunda.
- **El rollback de La Poda es `git revert`** del commit del retiro (ver `_PODA_NATURAL_PLAN.md`). No hay flag
  que lo devuelva: revivir el natural es una decisión humana con commit propio.
- ⛔ **Lo retirado no vuelve por accidente**: `_poda_natural_anti_resurreccion_gate` barre imports,
  re-definiciones y el flag (sin contar comentarios — la historia del repo se conserva). Si necesitás nombrar
  al natural en un comentario nuevo, adelante; re-declararlo en código pone la suite en rojo.
