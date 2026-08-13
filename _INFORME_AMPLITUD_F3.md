# AMPLITUD · FASE 3 — El contrato de contexto general

**2026-08-13 · worker sobre dev=8052a7f (incluye F1 + F2) · rama `claude/adoring-moser-06d535` · NO pusheado.**
Suite: **antes 139 PASS · 0 FAIL · 0 TOCARON LA RED · 0 CON CREDENCIAL VIVA → después 140 · 0 · 0 · 0** (el gate
nuevo entra a la suite). Cero llamadas a proveedor: todo bajo `gates:offline` / `offline-guard`.
`_cert_vivo_openai.mjs` ni tocado ni corrido. Archivos Falcon intactos. NO push.

**Piezas frenadas: NINGUNA.** El punto de freno del encargo (no reestructurar el chequeo 1) se respetó al pie: la
exención se implementó ENMASCARANDO el bloque, con el patrón `_maskFigures` que ya existía — cero líneas tocadas en
los 25 chequeos. Detalle en §5.

**Lo que hay que mirar sí o sí (§7.1): el veto (c) se refinó por una MEDICIÓN que refutó una premisa del encargo.**
La premisa era «un rango genérico no colisiona por canon». Es falsa contra la proyección del dato: sus porcentajes
ocupan **17 de los 26 enteros entre 15% y 40%**, en una corrida sin un solo hueco del 21 al 34. Con la vara literal
del encargo, las reglas 2 y 3 del propio contrato se contradecían y el bloque no podía decir nada.

---

## 1 · Qué cambió, archivo por archivo

| Archivo | Qué |
|---|---|
| `src/adi/oracle/narrationBlocks.js` (:40, :510-603) | **EL BLOQUE.** `MARCA_CONTEXTO_GENERAL` (:537) · `MARCO_CONTEXTO_GENERAL` (:540, el texto exacto) · `renderContextoGeneral(text)` (:559) — borra cualquier copia del marco, extrae el PRIMER bloque, descarta los demás enteros, colapsa el contenido a UN párrafo y lo inserta antes de la pregunta de cierre con el marco propio · `rangoContextoGeneral(text)` (:596) — el rango que consume el muro. `CONTEXTO_GENERAL` entra a `_MARK_STRIP_RE` (:40) pero **NO** a `_MARK_RE`/`BLOCK_KEYS`/`KEEP_BLOCKS` (§7.2). Cero funciones existentes tocadas. |
| `src/adi/oracle/narratePromptC.js` (:83-99, :240) | **LA DOCTRINA.** `DOCTRINA_CONTEXTO_GENERAL` (:90): 9 líneas, 2.203 caracteres (~551 tokens), en el segmento **FIJO** y **sin condición** (§7.3). Va después de HONESTIDAD; ninguna sección existente se tocó. El fijo sigue byte-idéntico entre los 7 modos, y el fijo sin dato sigue siendo prefijo estricto del fijo con dato (F1 intacto). |
| `src/adi/oracle/guardC.js` (:18-20, :2452-2486, :2702-2758) | **EL MURO.** Enmascarado del bloque antes de los 25 chequeos (:2483-2486) · opción nueva `entidadesDelTenant` (default null) · chequeo **26** (:2702) con los dos bloqueos: `contexto-general-con-entidad` y `contexto-general-con-cifra-del-cliente`. |
| `src/adi/oracle/answerViaOracle.js` (:26, :2214-2231, :2507, 9 sitios de guardC) | **EL CABLEADO.** `catalogoEntidadesTenant` (:2225) sale de `axisEntityNames` sobre `cliente`/`sku`/`marca` (§7.4) y viaja a los MISMOS 9 sitios de guardC que las fuentes de F1/1b · `renderContextoGeneral(n)` (:2507) corre en UN solo lugar: dentro del bucle de narración, **solo bajo `full`**, ANTES del tope de brevedad y ANTES del muro (§3). |
| `_probe_amplitud_f3.mjs` (**nuevo**) | 65 PASS · 0 FAIL — las nueve letras del encargo + las mediciones de falsos positivos (§4). |
| `_amplitud_contexto_general_gate.mjs` (**nuevo**) | 44 PASS · 0 FAIL — las cinco garantías, DENTRO de la suite (139→140). |
| `_reparacion_contextual_gate.mjs` (:408-435) | El ÚNICO gate movido: el presupuesto de NARRAR, con su análisis garantía-vs-formato (§6). |

## 2 · Los textos exactos

### El marco (lo pone el renderer, nunca el modelo)

```
Como contexto general — esto no viene de tu dato y no puedo verificarlo con tu información:
```

Se emite como **un párrafo propio**, `MARCO + " " + contenido`, después de la lectura del dato y de la acción, antes
de la pregunta de cierre.

### La doctrina (`narratePromptC.js`, segmento FIJO, 9 líneas / 2.203 car / ~551 tok)

```
CONTEXTO GENERAL DEL MUNDO (tu propio conocimiento, el que NO sale del dato del cliente): podés aportarlo, y en UN SOLO lugar — un bloque marcado. Escribí [[CONTEXTO_GENERAL]] en su propia línea y a continuación, en UN párrafo, lo que sepas del mundo o de la industria. El encabezado del bloque lo pone el motor, no vos: no lo escribas ni lo imites.
CUÁNDO USARLO: solo si el usuario pregunta por el mundo, la industria o lo normal ("¿esto es normal?", "¿cómo se compara con el mercado?", "¿es alto?"), o si un dato general breve ayuda DIRECTAMENTE a la decisión de este turno. JAMÁS de oficio: la respuesta habitual —y la mayoría— no lleva bloque. Un bloque en cada respuesta es un defecto, no una mejora.
CÓMO, dentro del bloque:
· EN RANGOS O CUALITATIVO, nunca con precisión falsa: "suele moverse entre X e Y", "tiende a ser más ajustado que en otros rubros". JAMÁS "la industria es 27.3%": una cifra exacta que no podés respaldar suena a dato y no lo es.
· DECLARÁ LA ÉPOCA: "según lo que conozco, que tiene fecha de corte". Tu conocimiento no está actualizado a hoy y el usuario tiene que saberlo para decidir cuánto pesarlo.
· JAMÁS NOMBRES UNA ENTIDAD DEL CLIENTE (ningún cliente, SKU ni marca de su cartera) NI REPITAS UNA CIFRA DE SU DATO adentro del bloque — las dos cosas se bloquean. Si querés comparar, la cifra del cliente va AFUERA y el rango general ADENTRO: "tu margen es X% (tu dato)." y recién después el bloque con "en este rubro suele moverse entre A y B".
· UNO SOLO POR RESPUESTA, y al final: después de la lectura del dato y de la acción, antes de tu pregunta de cierre. Un segundo bloque se descarta entero.
LA RECOMENDACIÓN SE FUNDA SOLO EN EL DATO SELLADO. El contexto general ILUSTRA, nunca DECIDE: "empezá por A, que tiene la mayor brecha" es válido; "empezá por A porque en la industria se hace así" no lo es. Y afuera del bloque no cambia NADA: todas las reglas de cifras de arriba siguen valiendo igual, así que una cifra general repetida afuera se bloquea como cualquier invento.
SI NO TENÉS CONOCIMIENTO ÚTIL DEL RUBRO, DECILO Y NO RELLENES: "no tengo una referencia confiable de la industria para este rubro" es una respuesta correcta, y mejor que un rango inventado.
```

**El system NO contiene el texto del marco** — a propósito: el modelo no puede copiar lo que no ve. Verificado en
probe y en gate.

## 3 · Cómo quedó el muro

**El enmascarado, antes de todo** (`guardC.js:2483-2486`). Si `contentScope === "full"` y el texto trae el marco, el
bloque se reemplaza por `#` de la MISMA longitud (los `\n` se conservan) y **los 25 chequeos reciben ese texto**, con
el mismo código y cero líneas cambiadas. El texto crudo del bloque queda aparte, solo para el chequeo 26.

- **Por qué enmascarar y no abrir una excepción en cada chequeo**: es el patrón que este archivo ya usa
  (`_maskFigures`), y es exactamente lo que el punto de freno pedía en vez de reestructurar el chequeo 1.
- **Por qué para los 25 y no solo el 1**: los 25 juzgan afirmaciones sobre el dato del cliente, y el bloque —por los
  vetos (b) y (c)— **no puede hablar del dato del cliente**. Un chequeo de atribución, de binding de métrica o de
  período corriendo sobre prosa de industria solo puede producir falsos positivos sobre texto que por construcción
  no habla de nadie del negocio.
- **Los saltos de línea se conservan**: las ventanas de oración de los chequeos de dueño siguen cortando donde
  cortaban, así que el bloque **no le presta contexto ni se lo quita** a una cifra de afuera. Demostrado con las dos
  violaciones en el mismo veredicto (probe §5).
- **Solo bajo `full`**: `data_only`/`results_only` componen texto determinístico que puede citar la razón de una
  tool, y esas razones citan palabras del usuario (Paso 2). Sin esta condición, escribir `[[CONTEXTO_GENERAL]]` en la
  pregunta sería una forma de **comprarse la exención**. `action_only` tampoco (§7.2).

**El chequeo 26**, sobre el texto crudo del bloque, los dos como BLOQUEO (una condición que no bloquea no es una
condición):

| Veto | Kind | Vara |
|---|---|---|
| (b) entidad del cliente adentro | `contexto-general-con-entidad` | `axisEntityNames` de `cliente`/`sku`/`marca` (catálogo del tenant) **unido** a las entidades del turno. Sin catálogo inyectado el chequeo NO se apaga: cae a las del turno. |
| (c) cifra del cliente adentro | `contexto-general-con-cifra-del-cliente` | **unidad+valor crudo** (no canon string: «21%» ≡ «21.0%») contra las CUATRO fuentes de la conversación — boleta del turno, eco de la pregunta, cifra del usuario, boleta anterior (1b) — **más la proyección del dato salvo las tasas** (§7.1). |

**Aditivo por construcción**: sin el marco en el texto, ninguna línea nueva se ejecuta — ni el enmascarado, ni el
chequeo 26. Medido, no declamado: 5 narraciones (válidas, vetadas, tabla, vacía) dan veredicto **JSON-idéntico** con
y sin las piezas nuevas, en probe y en gate.

## 4 · Probes y gate (salidas)

- **`_probe_amplitud_f3.mjs` → 65 PASS · 0 FAIL**:
  §1 el renderer (marco textual · el bloque entre la acción y la pregunta de cierre · un párrafo · el rango exacto) ·
  §1b uno solo (el segundo descartado ENTERO, y su contenido no reaparece como prosa) · marca vacía · **sin marca,
  byte-idéntico** · §2 el marco forjado por el modelo, suelto y dentro del bloque, borrado en los dos casos, y el
  system que no se lo muestra · §3 el muro bidireccional: (a) rango tolerado adentro / la MISMA cifra afuera vetada ·
  (b) entidad, entidad ausente del turno, marca y SKU · el anti-contrabando canónico · (c) cifra del turno, cifra
  escrita corta, **el lavado del caso canónico del gerente** (25% del usuario devuelto como industria), monto de la
  proyección · y **la forma CORRECTA del mismo turno pasa** · §3b `[[ACCION]]` estructural (la cifra repetida afuera
  cae al chequeo 1 con detalle `37%`) y sin exención fuera de `full` en los tres alcances · §4 las ramas restringidas
  (por fuente: el bucle las excluye · el renderer corre en UN lugar bajo `full` · **dónde muere la marca**: en
  `stripAllMarks`, sin haberse convertido nunca en marco) · §5 aditividad 7/7 · §6 y §6b las mediciones.
- **`_amplitud_contexto_general_gate.mjs` → 44 PASS · 0 FAIL**, corrido DENTRO de la suite.
- Regresiones reproducidas en frío: **F1 48/48 · F2 58/58 · Paso 0 (prefijo) 19/19 · Paso 1b 29/29 · Anthropic
  dos-modelos 21/21**.
- Suite completa: **antes 139·0·0·0** → **tras los cambios de motor 138·1·0·0** (el 1 = el presupuesto de
  `_reparacion_contextual_gate`, §6) → **final 140 PASS · 0 FAIL · 0 TOCARON LA RED · 0 CON CREDENCIAL VIVA**.
  Logs no commiteados, como en F1/F2.

## 5 · El punto de freno, transitado sin frenar

**La exención NO exigió reestructurar el chequeo 1.** Se implementó exactamente como el encargo autorizaba
—enmascarar el bloque antes del chequeo, patrón `_maskFigures`— y el chequeo 1 quedó **byte-idéntico**: ni una línea
suya se tocó. El costo total en `guardC` es (a) una función de 4 líneas, (b) tres líneas al entrar a `guardC`, (c) el
chequeo 26 nuevo al final. Los chequeos 1-25 no saben que el bloque existe.

## 6 · Gates antes/después — el único movido, con análisis

**`_reparacion_contextual_gate.mjs`** — `BASE.narrarDefault` **40.152 → 42.357** (+2.205 car ≈ 551 tokens, medido).

**Análisis garantía-vs-formato**: lo que ese bloque GARANTIZA no se movió, y se lee en las dos líneas que siguen a la
que cambió: (1) «NARRAR crece SOLO cuando el turno repara algo» sigue verde — la doctrina de reparación sigue siendo
condicional y el turno normal no la paga; (2) el chequeo de más arriba del mismo gate, que la doctrina cae del lado
FIJO del corte de caché, sigue verde. Lo que crece es el **presupuesto declarado**, y lo paga
`DOCTRINA_CONTEXTO_GENERAL`. Cae ENTERO del lado cacheable (el fijo sigue byte-idéntico entre los 7 modos), así que
sobre Sonnet son **~US$0,00017 por llamada sin caché y ~US$0,00002 con caché al 90%** — ruido. El número se declara
exacto igual, para que la próxima doctrina se justifique con la misma vara.

**Ningún otro gate se movió**: la suite tras los cambios de motor fue 138·1 con SOLO ese en rojo. En particular
`_tools_alcanzables_gate` y los presupuestos de PLAN quedaron intactos — el PLAN no se tocó.

## 7 · Decisiones no obvias (para la revisión del arquitecto)

**1 · La vara del veto (c) se refinó por una medición que refutó la premisa del encargo — y es la decisión que más
merece la mirada.** El encargo pedía vetar la cifra del bloque «cuyo canon coincida EXACTO con una cifra autorizada
del turno/**dato**», con la premisa de que «un rango genérico no colisiona por canon». **Medido sobre el dato real**
(probe §6b): la proyección tiene 308 cifras, 53 valores `pct` distintos, y ocupa **17 de los 26 enteros entre 15% y
40% — del 21 al 34 sin un solo hueco**. Cualquier rango de márgenes de este rubro cae adentro. Con la vara literal,
la regla 2 del contrato («en RANGOS, jamás precisión falsa») era **imposible de cumplir**: el bloque no podía emitir
un rango sin autovetarse. Dos reglas del mismo contrato se contradecían.
Lo que hice, sin relajar la prohibición:
- **Se endureció el matcher**: unidad+valor crudo en vez de canon string. Antes, «21%» escapaba cuando la boleta
  sellaba «21.0%» (dos canon, el mismo número). Ahora se caza. **Cierra un hueco que la vara del encargo tenía.**
- **Se acotó la fuente**: las CUATRO de la conversación (boleta del turno, eco de la pregunta, cifra del usuario,
  boleta anterior) valen para TODAS las unidades — son los números que el usuario tiene delante, y repetir uno
  adentro del bloque es exactamente el lavado. De la proyección entra todo **menos las tasas** (`pct`/`pp`): en
  montos hay 134 valores distintos entre $47 y $100M y una coincidencia exacta no es casualidad (se veta, probado);
  en tasas el rango está acotado y el negocio lo cubre casi entero, así que una coincidencia no es información.
- **El falso positivo que QUEDA, medido y documentado, no relajado**: si un extremo del rango cae exactamente sobre
  la cifra DEL TURNO («entre 21% y 34%» cuando el margen del turno es 21%), se veta. Es el comportamiento correcto
  —esa cifra sí está en pantalla— pero es un costo real y queda anotado.
- **REFINAMIENTO PROPUESTO (decisión del owner, no la tomé)**: que la vara sean las cifras que el usuario
  **realmente vio** (un registro de lo mostrado en el hilo) en vez del dato entero. Hoy la aproximación es «las
  cuatro fuentes de la conversación», que es lo más cercano que existe sin construir ese registro.

**2 · `CONTEXTO_GENERAL` NO entra a `parseBlocks`/`BLOCK_KEYS`/`KEEP_BLOCKS`.** Las cuatro marcas existentes
PARTICIONAN la respuesta por categoría y `KEEP_BLOCKS` las poda según `contentScope`; ésta es un **inset** dentro de
la prosa. Agregarle una quinta clave a `parseBlocks` habría cambiado la forma que consumen `extractOffer`
(dialogueState) y ~20 gates — eso es reestructurar el sistema de bloques, no agregarle un tipo, que es justo lo que
el encargo prohibía. **Consecuencia honesta bajo `action_only`**: el renderer de bloques no poda el aporte general
(su texto queda dentro del trozo `[[ACCION]]`), así que NO desaparece — queda como prosa cualquiera bajo el muro
ENTERO, sin exención, y se veta. Fail-closed, verificado en probe y gate; no es invisible, es vetado.

**3 · La doctrina viaja SIN condición** (a diferencia del dato del negocio de F1, que es condicional a `datoNegocio`).
El conocimiento general del modelo está siempre disponible —no depende de ninguna proyección— y una capacidad que
aparece y desaparece del system es una capacidad que el narrador usa de forma inconsistente. Cae entera del lado
cacheable, así que el costo es ruido (§6).

**4 · Tres ejes de entidades, no seis, y es una decisión de contenido con medición detrás.** `cliente`/`sku`/`marca`
son **contrapartes nombradas**: nombrarlas en un aporte general es atribuirle a alguien real una afirmación que ADI
no puede verificar. `familia`/`bodega`/`canal` son **clasificadores**, y en este dato sus nombres SON vocabulario
corriente de la industria: `["Electrodomésticos","Línea Blanca","Cuidado Personal","Materiales de Construcción"]`,
`["Santiago","Valparaíso","Concepción","Antofagasta"]`, `["Retail","E-commerce"]`. **Medido (probe §6): con los seis
ejes, 4 de 5 frases legítimas sobre el rubro se vetan; con los tres, 0 de 5** — y el contrabando sigue cerrado en las
cuatro formas probadas (cliente presente, cliente ausente del turno, marca, SKU). Un contenedor que no deja decir
nada no protege nada. **La lista vive en el caller** (`answerViaOracle`), declarada y comentada, no dentro del muro.

**5 · El render corre ANTES del muro, no después.** Si corriera después, mover el párrafo del bloque podría cambiar
las ventanas de oración con las que el muro juzgó dueños y atribuciones: habríamos validado un texto y entregado
otro. Va también **antes de `truncateToBriefBudget`**, que es un tope estructural («el resultado NO PUEDE exceder el
presupuesto»): el bloque compite por el presupuesto en vez de saltárselo. El marco no contiene ningún `.!?`, así que
el corte por oración no puede partirlo ni dejarlo encabezando la nada. Las dos precedencias están fijadas por gate.

**6 · El segundo bloque se descarta ENTERO** (marca + contenido), no se desmarca. Desmarcarlo dejaría su contenido
—con cifras no verificables— como prosa normal, el muro lo vetaría y el turno se perdería. Descartarlo es la
dirección segura y es lo que el contrato dice literalmente.

**7 · `entidadesDelTenant` viaja a los 9 sitios de guardC**, los mismos de las fuentes de F1/1b, incluidos los de
texto determinístico — inofensivo y evita un segundo criterio de inyección (mismo argumento que F1 §6.6).

**8 · Riesgo residual anotado, no cerrado**: `stripOutOfDataOffers`/`stripFiller` corren ANTES del render, sobre el
texto crudo. Si alguno borrara una oración del aporte general, el bloque sale más corto o no sale. Es fail-closed y
son garantías existentes que no toqué, pero queda dicho: el aporte general pasa por los mismos filtros de registro
que el resto del texto.

## 8 · Lo que NO se hizo (por encargo)

`planPrompt`/el PLAN **intactos** — el contexto general es del NARRADOR. **No concluí que el PLAN necesite señal**:
el bloque no cambia qué tools se piden, y el narrador decide el aporte con la pregunta que ya tiene delante. Si la
certificación amplia mostrara que el PLAN sobre-produce calls ante «¿esto es normal?», ahí sí habría que mirarlo —
queda anotado, sin implementar. `glossary`/`hiloBudget`/`adapters`/`modelPricing`/`modelDefaults`/`datoProyectado`/
`calculoCatalogo` intactos (`datoProyectado` se LEE en probe y gate, no se toca). **Nada de guardC se relajó**: el
enmascarado es condicional al bloque y el chequeo 26 solo agrega bloqueos. `numberGuard`/`entityGuard`/`_guard_gate`
ni mirados. Ningún marcador del clasificador en los archivos nuevos (el gate entra a `gates:offline` por su propio
mérito, sin escapes). NO push.

## 9 · Commits (rama del worktree, base 8052a7f, NO pusheado)

1. `79f4a55` — `narrationBlocks.js`: el bloque, su marco y el rango que consume el muro.
2. `cc6f7b1` — `narratePromptC.js`: la doctrina, en el segmento fijo.
3. `4e78dc7` — `guardC.js`: el enmascarado del contenedor y los dos bloqueos.
4. `ef57012` — `answerViaOracle.js`: el catálogo del tenant a los 9 sitios + el render antes del muro.
5. `72ee485` — `guardC.js`: el refinamiento medido del veto (c).
6. `c23c682` — `_probe_amplitud_f3.mjs` (65/65).
7. `0f723fc` — `_reparacion_contextual_gate.mjs`: el presupuesto de NARRAR con su análisis.
8. `7ec481d` — `_amplitud_contexto_general_gate.mjs` (139→140).
9. este informe.
