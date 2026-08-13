# INFORME · Paso 3c «ADI pierde el hilo» — los 2 pulidos finos de la certificación viva #2

**Worker** · 2026-08-13 · base `dev = 929a504` · rama `claude/focused-spence-91932a` · SIN push · commits locales archivo por archivo.
**Candados de gasto respetados**: cero llamadas a proveedor; verificación solo `npm run gates:offline` y probes con `node --import ./scripts/offline-guard.mjs`. `_cert_vivo_openai.mjs` no se corrió, no se tocó y no se commiteó. Los 4 archivos Falcon no aparecen en este worktree. Nunca se usó `git add -A` ni `commit -a`.
**Nota de arranque:** el worktree estaba en `61afd50` (ancestro de dev); fast-forward local a `929a504` antes de tocar nada.

---

## 1 · PULIDO 1 — la confusión pelada bajo solo-datos le gana a la call alucinada (hilo C turno 3)

**El corner medido en vivo:** «no entiendo» bajo `data_only` → el PLAN alucinó una call (`entityProfile`) que nadie pidió, la boleta trajo cifras, y la regla deliberada «turno con dato = turno de dato» (Paso 3 §5.e) hizo salir «Sodimac · Ventas: $8.2M (venta comercial, anual). Alcance: todo el eje cliente. (Datos del año cerrado.)» donde correspondía el mensaje D2. Reproducido offline byte a byte con plan sintético (la corrida pre-fix del probe muestra ese texto exacto).

**El cierre, en `src/adi/oracle/answerViaOracle.js` (commit `d91110d`):**
- **:2332** — en la rama solo-datos, `desdeLedger` no se compone cuando el turno es **confusión pelada**: `_confusionPelada` (:1711), **la MISMA vara del 3b** (`_CLARIFY_RE` + `!respuestaYaEsEspecifica`), no un detector nuevo. La regla «turno con dato = turno de dato» presume que el dato fue PEDIDO; en una confusión pelada nadie pidió ningún dato — la call es ruido del planificador. La precedencia queda: bajo confusión pelada, `desdeTexto` (definición curada, si el turno la trae) → `desdeConfusion` (mensaje D2) → `composeNoDataMessage` (si una tool declinó con razón, la razón sigue mandando — `composeSoloDatosConfusionMessage` ya devuelve null en ese caso, sin cambio).
- **:2364** — el mensaje de confusión queda **exento de los envoltorios** de período/transferencia (misma exención que ya tenía la definición): con la call alucinada `periodos` no viene vacío, y sin la exención el D2 salía con «(Datos del año cerrado.)» pegado — marco de dato en un texto que explica que no va a mostrar ninguno. Con calls vacías (el caso D2 previo) esto es un no-op byte-idéntico: `periodos` era `[]`.
- **:2182-2183** — la **boleta del turno (Paso 1b) no se escribe** bajo confusión pelada + solo-datos: esas figs jamás salieron a pantalla, y persistirlas (a) daría permiso de re-cita sobre cifras que el usuario nunca vio y (b) pisaría la boleta del último turno con datos realmente mostrados — rompiendo la promesa del 1b («la boleta = lo que te mostré»). Bajo alcance `full` la confusión sigue al narrador y la escritura queda como siempre.

**Lo que NO cambia (probado):** pregunta de datos real (`«margen de Sodimac»`) → byte-idéntica, y su boleta se escribe como siempre · confusión que NOMBRA algo concreto (`«no entiendo el margen de Sodimac»` — `respuestaYaEsEspecifica` true) → no es pelada, el dato manda · confusión pelada sin calls → el mismo D2 de antes · `desdeAckPref` y toda la Pasada 2 intactos.

## 2 · PULIDO 2 — el barrido de registro atrapa anglicismos (hilo B turno 2)

**La fuga medida en vivo:** «La brecha es la **distancia** entre tu margen actual y ese reference point.»

**El cierre, en `src/adi/llm/voiceGuard.js` (commit `205e6ac`):** 7 entradas nuevas en `_LEAKS` (:115-128), en la MISMA tabla y la misma pasada donde ya corren if/insight/palanca — cero capa nueva:

| Entrada | Reemplazo | Cuidado |
|---|---|---|
| `reference points` / `reference point` | puntos/punto de referencia | la fuga medida; el glosario ya define benchmark como «punto de referencia» — mismo vocabulario |
| `drivers` / `driver` | factores / factor | ambos masculinos, concordancia intacta. **`driver interno` se excluye** con lookahead `(?!\s+intern)`: es el marcador de `_NOTAS_INTERNAS_RE`, que elimina la oración ENTERA de notas de analista y corre DESPUÉS del barrido — traducirlo le sacaría el marcador a esa red y la nota saldría a pantalla en español en vez de eliminada (probado en gate y probe) |
| `la performance` / `una performance` / `performance` | el desempeño / un desempeño / desempeño | el artículo se enumera porque cambia de género (mismo cuidado que «la pasta → el capital»). Límite conocido, comentado en el archivo: un adjetivo femenino pospuesto poco frecuente («performance financiera») quedaría discorde — se prefirió eso al inglés en registro de directorio |

**Los que quedaron FUERA, y por qué (la decisión pedida por el encargo):**
- **`benchmark`** y **`rebate`** — entradas propias del glosario (`CONCEPT_DEFS.benchmark` / `.rebate`): SON la palabra oficial del producto. Verificado intactos en probe y gate.
- **`target`** — NO es solo ambiguo: es **label vivo del dato**. «Target de carga comercial» está declarado en `criteria.js:26` y `entityRecord.js:82` (con `frase: "tu target de carga comercial"`) y sale narrado en boletas y tablas (fixtures de certificación). Barrerlo reescribiría una etiqueta autorizada de la boleta y guardC leería la versión reescrita como cifra/entidad ajena. Aunque el glosario tiene entrada `meta`, «target» en este producto NO mapea a ella (la meta es el umbral de carga de POLICY; el target ES ese label) — mapearlo a «meta» habría chocado además con «Benchmark ≠ promedio ≠ meta» (CLAUDE.md). Queda fuera; si el owner quiere renombrar el label, es una decisión de vocabulario del producto, no del barrido runtime.
- **`gap`** — está **adoptado por el glosario como etiqueta declarada del concepto `brecha`** (glossary.js, `etiquetas: ["brecha","gap","brecha de margen"]`) y aparece en texto CURADO del propio glosario («El gap de margen partido en sus dos componentes…», METRIC_DEFS «La brecha descompuesta»). Barrerlo reescribiría texto curado, y además cambia de género (el gap → la brecha): la sustitución de palabra sola daría «El brecha» o dejaría concordancias rotas («La brecha … partido»). Mismo criterio de la casa: falso negativo antes que falso positivo. El narrador libre igual dice «brecha» de forma dominante (medido en la propia cert #2).
- **`insight`/`insights`** — **ya estaban** en `_LEAKS` (voiceGuard.js:86, →hallazgo/hallazgos) desde antes de este paso; no había nada que agregar.

## 3 · Salidas (A1-A2) — probe `_probe_paso3c_pulidos.mjs`, offline, tools reales

- **Pre-fix (commit `e10c459`, ANTES de los arreglos — la reproducción bisecteable): 13 PASS · 12 FAIL**, con el corner mostrando «Sodimac · Ventas: $8.2M … (Datos del año cerrado.)» donde correspondía el D2, y «ese reference point» pasando entero.
- **Post-fix: 25 PASS · 0 FAIL.** P1: corner C3 → EXACTAMENTE el mensaje D2 (data_only Y results_only), sin narrador, boleta anterior intacta · con definición curada → la definición (sin las cifras de la call) · pregunta real / confusión específica / D2 sin calls → conducta previa. P2: «ese reference point» → «ese punto de referencia» (y plural, y mayúscula inicial) · driver/performance barridos · «driver interno» sigue eliminándose como oración entera · benchmark/rebate/target/gap intactos · narración limpia byte-idéntica · idempotente.

## 4 · Las dos corridas de gates (A3)

| Corrida | Resultado |
|---|---|
| ANTES (base 929a504 limpia) | `136 PASS · 0 FAIL · 0 TOCARON LA RED · 0 CON CREDENCIAL VIVA (de 136 offline)` |
| DESPUÉS (P1+P2+probe+gate) | `137 PASS · 0 FAIL · 0 TOCARON LA RED · 0 CON CREDENCIAL VIVA (de 137 offline)` |

**Gates movidos: NINGUNO.** El único delta 136→137 es `_residuales_cert_vivo2_gate.mjs` entrando a la suite (11 PASS standalone bajo offline-guard; inyección por keys computadas, sin marcadores del clasificador). El análisis garantía-vs-formato no tuvo casos: ningún gate existente ejercita confusión pelada con calls bajo solo-datos (el caso no existía hasta esta cert), y los textos determinísticos del repo no contienen los anglicismos barridos (verificado por la corrida: 0 FAIL).

## 5 · Decisiones no obvias

a) **La vara es UNA sola.** No se inventó un segundo detector: `desdeLedger` se anula con el `_confusionPelada` de :1711 (el del 3b). `desdeConfusion` conserva su condición previa (`_CLARIFY_RE` solo) — cambiarla habría movido el caso «confusión con algo concreto y sin figs», que no es de este encargo.

b) **El skip de la boleta (:2182) es una adición mía al encargo**, con esta justificación: sin él, el turno D2 persistía como «permiso de re-cita» las figs de la call alucinada (cifras que el usuario jamás vio) y PISABA la boleta del último turno con datos mostrados — exactamente la familia del residual (iii) de la cert (mis-atribución de re-citas). Es una línea, condicionada al corner exacto, con aserción en probe y gate. Si el arquitecto prefiere el alcance mínimo, se revierte sola sin tocar lo demás.

c) **La exención de envoltorios (:2364) es formato-vs-garantía:** la garantía es «el período se declara cuando hay dato con marco»; el D2 no presenta dato, así que estamparle período era el error, no la regla. Para el caso previo (sin calls) es un no-op probado.

d) **`performance` entra con límite documentado** (adjetivo femenino pospuesto discorde, caso raro del dominio) — la alternativa era dejar el inglés, que es el defecto medido. El comentario del archivo lo declara para el que venga después.

e) **El gate nuevo no re-verifica el ack de preferencia ni la métrica-preguntada** — eso ya lo blinda `_hallazgos_cert_vivo_gate.mjs` (3b); este gate cubre SOLO los dos residuales de la cert #2. Cero solapamiento, cero duplicación de garantías.

## 6 · Commits (locales, SIN push, archivo por archivo)

| Hash | Archivo | Qué |
|---|---|---|
| `e10c459` | `_probe_paso3c_pulidos.mjs` | el probe ANTES del arreglo — sobre este commit falla 12 mostrando las cifras de la call alucinada y el inglés intacto (la reproducción, bisecteable) |
| `d91110d` | `src/adi/oracle/answerViaOracle.js` | P1: la confusión pelada anula el ledger bajo solo-datos + exención de envoltorios del D2 + skip de boleta en el corner |
| `205e6ac` | `src/adi/llm/voiceGuard.js` | P2: anglicismos de negocio en `_LEAKS` (misma pasada), con `driver interno` protegido |
| `f994423` | `_residuales_cert_vivo2_gate.mjs` | blindaje permanente (11/11, suite 136→137) |
| `(este archivo)` | `_INFORME_PASO_3C.md` | el informe |

**A4 verificado por diff:** el paso tocó exactamente 4 archivos (+ este informe). `guardC.js`, `planPrompt.js`, `narratePromptC.js`, `conversationalContract.js`, `glossary.js`, `dialogueState.js`, `hiloBudget.js`, `narrationContract.js`, adapters y prompts: **intactos**.

**Para el espejo con Anthropic:** re-medir hilo C t3 («no entiendo» bajo data_only) e hilo B t2 (la narración de la brecha) + una pasada de ojo por anglicismos NO listados (la tabla es curada y angosta a propósito: lo que no está en la lista pasa — p. ej. «forecast», «pipeline» — y se agrega con una línea si aparece medido).
