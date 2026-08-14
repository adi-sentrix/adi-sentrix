# La Poda · Fase 2B — El registro prohibido no llega a pantalla por el camino vigente

**Rama** `claude/beautiful-wilbur-563c85`, un commit sobre `dev` en **8373074** · local, sin push.

> **Nota para el merge:** `dev` avanzó mientras corría este trabajo (**8373074 → 6e59147**, «El wrapper node de
> NARRAR…»). Ese commit toca `api/adi-narrate-c.js` y tres probes de raíz: **cero solapamiento** con los 16
> archivos de esta rama, verificado con `git diff --name-only`. El merge no tiene conflicto.
**Estado** `npm run gates:offline`: **144 PASS · 0 FAIL · 0 TOCARON LA RED · 0 CON CREDENCIAL VIVA** (de 144
offline). La línea base, medida sobre `dev` antes de tocar nada, era **143 PASS de 143 offline**: el conteo sube en
exactamente 1 porque entra el candado nuevo — la prueba de que **no** quedó excluido en silencio por el
clasificador.

---

## 1. Conclusión primero

El turno de la captura ya no puede imprimir «Capital detenido». Lo que la pantalla del owner mostró —
`Valparaíso · **Capital detenido** marca $25K` — hoy sale `Valparaíso · **Capital inmovilizado** marca $25K`,
con la misma cifra y la misma estructura. Está demostrado con un probe offline que reproduce ese turno por las
**dos** puertas del respaldo determinístico (el airbag y la reparación), y medido contra el código de `dev`:
antes el probe se pone rojo, después verde.

La causa no era un literal suelto: era un **hueco de arquitectura**. El barrido de voz (`stripLanguageLeaks`)
lava la narración VIVA del modelo; los **labels de la boleta** no pasan por ahí, y el respaldo determinístico los
imprime verbatim. Cuando el narrador no llega, el label ES la respuesta. Ningún gate miraba esa superficie, y el
vocabulario que sí se vigilaba (`_registro_gate.BANNED`) no incluía las dos palabras que se colaron: «detenido» y
«vara». Se corrigió el registro en el origen y se cerró el hueco con un candado nuevo.

**El candado destapó dos fugas más que el inventario de Fase 1 no había pegado**, las dos en superficie vigente y
las dos en verde hasta hoy:

- `evidence.margin.title` = **«Margen · el costo aprieta»** — «apretar» está vetada desde 2026-07-26. El título lo
  pinta el panel de Sentrix y viaja al prompt. `_registro_gate` corre ese foco, pero solo mira `text`/`opener`/
  sugerencias: nunca miró el título del panel.
- `buildResumenEjecutivo` = **«$33K de capital detenido en 3 SKU»**, la primera línea de la **Mesa de Control**
  (`SentrixPanel.jsx:1331`). `_registro_gate` sí barre esa lectura — pero contra un `BANNED` que no tiene
  «detenido», así que pasaba en verde.

---

## 2. El punto de freno: qué consume cada label, y qué elegí

El arquitecto marcó esto como el riesgo real: **el label de boleta es la vara con la que `guardC` autoriza cifras
y con la que el narrador atribuye dueños**. Lo mapeé antes de tocar nada.

### Quién consume `"Capital detenido"` / `_ESTADO_LABEL` / `_CONCEPTO`

| Consumidor | Qué hace con el label | Qué pasaba si lo rompía |
|---|---|---|
| `narrationBlocks.js` `_tabla`/`_enLinea` | lo **imprime verbatim** (respaldo determinístico) | es el defecto mismo |
| `narratePromptC.js:782` `_CONCEPTOS_INVENTARIO` | detecta el patrón `Entidad · <Concepto>` e **impone el encabezado literal** de la tabla | el narrador dejaría de recibir el encabezado fijado → vuelve la variación de columnas medida en 2026-08-02 |
| `narrationContract.js:397` `_PALANCAS` | `/capital detenido/i` sobre `claim.metrica` → **acción permitida** con su monto | la acción «liberar el capital…» dejaría de estar autorizada → el narrador no podría proponerla |
| `progressiveDisclosure.js:532` | `/capital detenido/i` + `/subtotal/i` → la frase de capital de la prosa ejecutiva | esa frase desaparecería de la reparación |
| `guardC.js:495` `_PALANCA_N` | ventana de «brecha mal adjudicada» | **ya aceptaba las dos formas** — no hubo que tocarlo |
| `guardC` · dueño por fila | parte el label por `·`; el dueño es el **prefijo**, no el concepto | insensible al cambio |
| `conversationScope.js` `buildEntityList` | idem: usa el prefijo antes de `·` | insensible |
| `entityGuard.js` | **no existe en `dev`** (trabajo sin commitear de otra sesión) — no se tocó ni se leyó de más | — |
| gates | 12 gates de la suite nombran el literal | ver §6 |

### La decisión: renombrar el canónico (no un label de presentación)

Consideré las dos opciones que pidió el encargo:

**(A) Renombrar el label canónico** — `_ESTADO_LABEL.capital_frenado: "capital inmovilizado"` — y hacer que los
consumidores que matchean por texto acepten **ambas** formas.

**(B) Separar label canónico de label de presentación**: la boleta sigue diciendo «Capital detenido» para el
guard, y se traduce al imprimir.

**Elegí (A), y (B) no era viable:**

1. **(B) parte en dos la única verdad, que es justo lo que autoriza.** `guardC` liga la cifra a la **etiqueta**
   (por eso existe el comentario largo de `_CONCEPTO`: con la etiqueta equivocada, «Santiago tiene $30K de capital
   detenido» pasaba el guard entero). Con dos strings, el guard autoriza contra uno y la pantalla muestra el otro.
2. **(B) obliga al narrador a escribir la palabra vetada.** `CAPITAL_COLUMNS_INSTRUCTION` le pide el encabezado
   **literal** de la etiqueta. Si el canónico es «Capital detenido», el prompt le ordena imprimir la vetada.
3. **(B) toca un archivo prohibido.** El punto de impresión es `narrationBlocks.js`, del worker paralelo.
4. **(A) no pierde nada**: los tres consumidores que matcheaban por texto ahora reconocen las dos formas, así que
   **una boleta del camino legado —que sigue emitiendo la etiqueta vieja— se sigue reconociendo igual**. El cambio
   es aditivo en el reconocimiento y sustitutivo solo en lo que se emite.
5. El ruteo no depende de la palabra: `inventoryFocus.INV_INTENT_RE` ya incluye `inmoviliz\w*` y el foco por
   defecto es `frenado`, así que el chip «El capital inmovilizado en detalle» rutea idéntico al viejo.

---

## 3. Qué cambié, y qué consume cada cosa

### 3.1 Los labels del ledger — `src/adi/specRetrieval.js`

| Sitio | Antes → Después | Quién lo consume |
|---|---|---|
| `_ESTADO_LABEL.capital_frenado` | `capital detenido` → **`capital inmovilizado`** | figs `Estado del inventario: …`, `_CONCEPTO`, `_contrapunta` |
| `_diagFoco("capital", …)` | `Capital detenido` → **`Capital inmovilizado`** | figs `<Foco> · subtotal` y `<entidad> · <Foco>` del diagnose |
| `_LBL_E.capital_frenado` | `detenido` → **`inmovilizado`** | línea de reparto del estado del inventario |
| `_CONCEPTO` (fallback) | literal → `_ESTADO_LABEL.capital_frenado` | una sola fuente, sin segundo diccionario |
| `_contrapunta` labels | literales → `_ESTADO_LABEL[…]` | idem (el de quiebre es byte-idéntico) |
| `B.title` (foco frenado) | `… dónde está **detenido** tu capital` → `… **inmovilizado** …` | fig `Capital inmovilizado · total` + `evidence.inventory.title` → panel de Sentrix |
| `_MFOCUS_TITLE.causa_costo` | `Margen · el costo **aprieta**` → `… **presiona**` | `facts.panel.title` → panel de Sentrix + prompt |
| `buildResumenEjecutivo` | `capital **detenido** en N SKU` → `**inmovilizado**` | **lectura de apertura de la Mesa de Control** |
| boleta de `simulateCapital`/`Carga` | `context`/`formula` con «detenido»/«vara» → registro correcto | procedencia autorizada → prompt + evidencia |
| figs `Piso de margen`/`Target de carga` | `context: "la vara"` → `"la referencia declarada"` | idem |

### 3.2 Los consumidores (cambio aditivo — reconocen las dos formas)

- `narratePromptC.js` — `_CONCEPTOS_INVENTARIO` ahora lista **«Capital inmovilizado» y «Capital detenido»**: el
  encabezado que se impone es siempre el que el ledger trae, así que una boleta legada sigue recibiendo el suyo.
- `narrationContract.js` — `_PALANCAS` matchea `/capital (?:detenido|inmovilizado)/i`; la `accion` propuesta pasa a
  «liberar el capital **inmovilizado** en inventario» porque **viaja al prompt** y el narrador la ecoa.
- `progressiveDisclosure.js` — el buscador del claim de capital acepta las dos formas.

### 3.3 Textos verbatim del camino vigente

- **`dialogueState.js` `_MECHANISM_LABEL`** — «de liberar el capital **inmovilizado**», y **«¿Querés…» → «¿Quieres…»
  en las dos ramas**. Este texto sale por el bypass de mecanismo agotado **sin pasar por el narrador ni por el
  lavado de voz**: era el propio motor emitiendo la palabra vetada y el voseo.
- **`progressiveDisclosure.js` `composeProsaEjecutiva`** — el literal corregido **y la salida lavada con
  `stripLanguageLeaks`**. Arreglar el literal no alcanzaba: la frase de la causa interpola `palanca.metrica`
  **cruda**, o sea un label de boleta que ese archivo no controla. Lavar la salida cierra la **clase**, no el caso;
  es la lección ya documentada en `adi-lenguaje-formal` («cuando aparece una ruta de narración nueva, la garantía
  runtime hay que wirearla ahí TAMBIÉN»). `voiceGuard` es number-safe e idempotente: ninguna cifra se toca.

### 3.4 `toolRegistry.js`

- `simulateCapital` `coverage.reason`: «no hay capital **inmovilizado** para liberar» — **es texto de pantalla**
  cuando la tool no trae dato, no un log.
- `umbral_no_aplicado.declaracion`: «lo **inmovilizado** por rotación…» — está **diseñada para citarse textual en la
  primera frase** de la narración.
- `context` de las figs de referencia (`:233`, `:317`, `:483`): «la vara» → **«la referencia declarada»**. Mismo
  concepto (`_vocabulario_vara_gate` la sigue clasificando como palabra de vara, no de promedio): cambia la palabra
  que se lee, no lo que la cifra significa.
- Notas que viajan al prompt con riesgo de eco: `otro_estado_del_inventario.nota`, `nota_criterio` de
  `suma_filtrada`, y `nota` del perfil («compará» → «compara», voseo).

### 3.5 Superficies vigentes de Sentrix

| Archivo | Qué |
|---|---|
| `sentrix/resumenComercial.js` | «No son **plata** a capturar» → «**capital**» · «Es la **vara** realista» → «la **referencia** realista» · «comparándote con **vos** mismo» → «**contigo** mismo» |
| `sentrix/mesaCapital.js` | «nunca en **plata**» → «nunca en **dinero**» (nota de compradores, cara Capital) |
| `sentrix/glossary.js` | `meta.distingue` «más **plata**» → «más **capital**» · `capital.distingue`, `capital_inmovilizado.def`/`.distingue` y el `METRIC_DEF` «Inmovilizado» decían «clasifica como **detenida**» → «**inmovilizada**» · `indicado.def` «una **vara** del usuario» → «una **referencia declarada** por el usuario» |
| `ui/SentrixPanel.jsx` | fallback del título (`:1206`) · «Tienes $X **detenidos**» ×2 (`:5416`) · «Ningún SKU … está hoy **detenido**» (`:5434`) · y **dos voseos que ningún gate veía**: «**Priorizá**» → «**Prioriza**» |

> Las `etiquetas` del glosario **no se tocaron y no se barren**: son el vocabulario de **entrada** con el que el
> usuario nombra el concepto («capital detenido», «capital frenado»). La regla del owner es sobre lo que ADI
> **dice**, nunca sobre lo que **entiende**.

---

## 4. El candado nuevo — `_registro_boleta_gate.mjs`

**2607 PASS · 0 FAIL.** Cubre exactamente el hueco por el que se coló el defecto: **los labels de la boleta y los
textos verbatim del camino vigente**, no la narración del modelo.

Cinco frentes:

1. **Los labels de la boleta.** Ejecuta **43 llamadas** a las tools reales del catálogo (los 6 focos de inventario,
   los 7 de margen, diagnose, resumen, las simulaciones, perfiles, fichas, el glosario servido) y audita **677
   figs**: `label`, `context` y `formula` de cada una, más `coverage.reason`.
2. **`facts`, recursivo.** La primera versión auditaba una lista de campos escrita a mano — y por eso **no vio**
   `panel.title`. Una lista solo caza lo que su autor ya sospechaba. Ahora se barre `facts` entero, excluyendo por
   nombre las claves que son **identificadores de máquina** (`focus`, `estado`, `lens`, `dimension`…): vetarlas
   obligaría a renombrar el motor para cumplir una regla de vocabulario de pantalla.
3. **Los textos verbatim**: `composeExhaustedMechanismAcceptance` (4 mecanismos) y `composeProsaEjecutiva` — este
   último **alimentado a propósito con una boleta que trae la etiqueta VIEJA**, para fijar que el lavado de salida
   la neutraliza igual. Si alguien saca ese lavado, el gate cae.
4. **El glosario curado y la Mesa de Control**: `CONCEPT_DEFS` (35 conceptos) y `buildResumenEjecutivo` en los 4
   escenarios.
5. **El origen y el turno de la captura**: lee `_ESTADO_LABEL` del archivo (para que reintroducir la palabra en la
   fuente se ponga rojo aunque esa rama no corra) y exige que la fila exacta del owner **siga existiendo, siga
   trayendo su cifra y diga «Capital inmovilizado»**.

**Trampa del clasificador, evitada:** el gate llega a los labels **sin pasar por el oráculo**, así que no nombra
los símbolos de inyección ni importa el gateway — entra a la suite sin necesitar ningún escape. Verificado en el
encabezado del runner: **143 → 144 OFFLINE**, y el conteo PASS subió con él (143 → 144). Si hubiera quedado mal
clasificado, el conteo se habría quedado en 143 sin ponerse rojo — que es exactamente la trampa.

El probe de demostración (`_probe_registro_boleta_offline.mjs`) **sí** usa esos símbolos, y por eso **no termina en
`_gate.mjs` a propósito**: la suite lo clasificaría LIVE y lo dejaría fuera en silencio. Se corre a mano.

---

## 5. La prueba — el turno de la captura, offline

`node _probe_registro_boleta_offline.mjs` (cero red, cero `.env`, corrido bajo `scripts/offline-guard.mjs`).
Reproduce el turno «¿Cuánto capital tengo inmovilizado en inventario?» por las dos puertas del respaldo: el
**airbag** (el narrador lanza, como el timeout que le pasó al owner) y la **reparación** (el borrador no pasa el
muro). Medido contra el código de `dev` y contra el de esta rama:

| | Antes (dev 8373074) | Después |
|---|---|---|
| Fila de la captura | `Valparaíso · Capital detenido = $25K` | `Valparaíso · Capital inmovilizado = $25K` |
| Texto en pantalla | «Valparaíso · **Capital detenido** marca $25K» | «Valparaíso · **Capital inmovilizado** marca $25K» |
| Labels con palabra vetada | **6 por puerta** | **0** |
| Cifra y bodega | presentes | presentes |
| Exit | **1** | **0** |

---

## 6. Gates que se movieron

Tres, y ninguno fijaba comportamiento que se haya perdido.

| Gate | Qué fijaba | Análisis |
|---|---|---|
| `_resumen_comercial_gate.mjs:410` | que la lectura **declare explícito** que esas cuentas no son un monto a capturar (la trampa: calcularles un «recuperable» sería invitar a darles MÁS) | **COMPORTAMIENTO**, y sigue exigido igual. Lo que cambió es el **FORMATO**: el literal `No son plata a capturar` → `No son capital a capturar`. El check hermano (`!("recuperable" in …)`) quedó intacto. |
| `_resumen_comercial_ui_gate.mjs:452` | lo mismo, para cuando la sección vuelva a la vista | idéntico: COMPORTAMIENTO intacto, literal actualizado |
| `_vague_offer_gate.mjs:328` | que la rama de **costo** no reuse el mensaje de **capital** | **COMPORTAMIENTO**. Era un check **negativo** (`!/capital detenido/`) — habría seguido verde por accidente aunque la rama se rompiera, porque el label cambió de forma. Se **reforzó** a `/capital (?:detenido|inmovilizado)/`. |

Los otros 9 gates que nombran el literal siguen verdes sin tocarse: o apuntan al camino legado (que no se movió) o
usan el prefijo de entidad, no el concepto.

---

## 7. Frenado para decisión del owner

### 7.1 El concepto «vara» del glosario — **NO lo decidí**

`glossary.js` · `CONCEPT_DEFS.vara`. El problema es real: la palabra está vetada en superficie y la entrada la usa
en su `aka`, su `def` y su `distingue`, texto curado que `defineConcept` imprime verbatim. Pero acá el registro
choca con otra regla de la casa: **el glosario existe para definir la palabra que el usuario usó**, y el usuario
dice «vara». Las dos opciones, con su costo:

**Opción 1 — renombrar el concepto a `referencia`, conservando «vara» como alias de entrada.**
La definición pasa a hablar de «la referencia que tú declaras»; «vara» queda solo en `etiquetas`, así que el
usuario la puede seguir escribiendo y ADI la sigue entendiendo.
*Costo:* el slug `vara` viaja en índices derivados (`_ETIQUETAS`, `conceptForLabel`) y `criteria.js` parsea «vara»
del input del usuario. Hay que verificar los tres. Es la opción **coherente con el registro**.

**Opción 2 — dejar el concepto y reescribir solo lo que no necesita la palabra.**
`def` y `distingue` se redactan sin decir «vara» (ya lo hice para `indicado`, donde la palabra era prescindible);
el `aka` queda como está porque es el nombre por el que se pregunta.
*Costo:* la entrada sigue mostrando «vara» en su título. Es la opción **de menor riesgo técnico**.

**Mi recomendación: opción 1**, pero es decisión de producto y de UX, así que no la tomé. Mientras tanto la entrada
está declarada como **excepción nombrada** en `_registro_boleta_gate.mjs`, que además verifica que **siga siendo la
única**: si mañana aparece otro concepto con palabra vetada, el gate se pone rojo. El hueco queda **medido y
visible**, no tapado.

### 7.2 Lo demás que frené

- **`stripLanguageLeaks` sobre la rama de TABLA del respaldo.** Lavé `composeProsaEjecutiva` (en mi alcance). La
  otra rama determinística (`componerPorForma`, forma tabla) hoy queda limpia **por origen** —los labels ya no
  traen la palabra— pero **no está lavada**. El punto natural para lavarla es una línea en
  `answerViaOracle.js:2634`/`:2718`, que cubriría las dos ramas de una vez. No lo hice porque `answerViaOracle.js`
  está fuera del alcance que se me dio y el barrido de voseo morfológico puede reescribir un nombre de entidad
  terminado en `-á` dentro de una celda de tabla (riesgo hoy aceptado en la narración, pero nuevo en una tabla).
  **Lo cubre el candado**: si un label vuelve a traer la palabra, el gate se pone rojo antes de llegar a pantalla.
- **`_registro_gate.BANNED` no se amplió.** Sumarle «detenido» y «vara» pondría rojo el camino legado entero
  (~24 literales solo en `specRetrieval`, más `answerADIFromSpec` y los composers). El vocabulario ampliado vive en
  el candado nuevo, acotado al camino vigente. Ampliar `BANNED` es el **cierre natural de la migración del legado**.

---

## 8. Lo que queda para la migración del camino legado

Nada de esto se tocó: son textos que sirven al seam legado (`answerADIFromSpec` → `opener`/`suggestions`), y el
oráculo los descarta (`_pack` se queda solo con `evidence`, así que `opener` y `suggestions` **no** llegan al
camino vigente).

| Dónde | Cuánto | Qué |
|---|---|---|
| `specRetrieval.js` · `opener`/`lines` | ~15 literales | «capital detenido», «$X detenidos», «bajo la vara», «nada detenido», el contrato completo de `simulateCapital` |
| `specRetrieval.js` · `suggestions` | 6 chips | «El capital detenido en detalle», «¿Dónde está detenido mi capital?», «Qué SKU detenidos libero», … |
| `answerADIFromSpec.js` | 5 (inventario F1) | degrades que van **directo a pantalla sin lavado** |
| `composers/*`, `narrativeLayer.js`, `intentLayer.js`, `contractCloser.js`, `etlg.js`, `conversation.js` | ~30 | «palanca» sobre todo, más voseo en `contractCloser:377` y `simulation.js:445` |
| `ChatADI.jsx:1087` | 1 | «fija tu **vara**» — hint de primer uso, **en producción, todos los modos** (del worker paralelo) |

**Nota de método para quien migre:** el orden correcto es **primero migrar el consumidor, después limpiar el
literal**. Los tres consumidores que toqué aceptan hoy las dos formas justamente para que el legado siga
funcionando durante la transición; cuando el legado deje de emitir la etiqueta vieja, se pueden simplificar a una
sola forma y ampliar `_registro_gate.BANNED`.

---

## 9. Candados respetados

- **Cero llamadas a proveedor / gateway / red.** Todo offline. Ni un gate suelto de los que se cargan el `.env`:
  la suite se corrió **solo** por `npm run gates:offline`, y el probe y el candado nuevo se corrieron bajo
  `--import scripts/offline-guard.mjs` (el mismo cerrojo que usa el runner, exit 97 ante cualquier salida).
- **No se tocó** `numberGuard.js`, `_guard_gate.mjs`, `_evidence_spec_views_gate_entry.jsx`. `entityGuard.js` **no
  existe en `dev`** (trabajo sin commitear de otra sesión) — no se creó ni se referenció.
- **No se tocó** el camino legado (`answerADIFromSpec.js`, `composers/*`, `answerADI.js`, `narrativeLayer.js`,
  `contractCloser.js`, `intentLayer.js`, `etlg.js`) ni los 4 archivos del worker paralelo (`narrationBlocks.js`,
  `conversation.js`, `conversationalContract.js`, `ChatADI.jsx`). `narrationBlocks.js` se **leyó** para entender el
  punto de impresión; no se modificó.
- **Nunca `git add -A` ni `commit -a`**: los archivos se agregaron uno por uno.
- `main` intacto, sin push.

---

## 10. Archivos

**Modificados (10 de producto + 3 gates viejos)**

```
src/adi/specRetrieval.js
src/adi/oracle/dialogueState.js
src/adi/oracle/progressiveDisclosure.js
src/adi/oracle/toolRegistry.js
src/adi/oracle/narratePromptC.js
src/adi/oracle/narrationContract.js
src/adi/sentrix/glossary.js
src/adi/sentrix/mesaCapital.js
src/adi/sentrix/resumenComercial.js
src/ui/SentrixPanel.jsx
_resumen_comercial_gate.mjs · _resumen_comercial_ui_gate.mjs · _vague_offer_gate.mjs
```

**Nuevos**

```
_registro_boleta_gate.mjs                 (candado permanente · entra a la suite)
_probe_registro_boleta_offline.mjs        (demostración del turno de la captura · se corre a mano)
_INFORME_PODA_2B.md
```
