# INFORME · Paso 2 del plan "ADI pierde el hilo" (sesión worker, 2026-08-13)

Encargo: arquitecto (sesión Falcon-heredero) · plan aprobado por el owner · alcance ESTRICTO Paso 2.
Base: `dev` = `8765920` (incluye Pasos 0 y 1) · trabajado en el worktree `relaxed-swanson-8f2903`, commits
locales SIN push (los autoriza el arquitecto) · 100% offline: toda verificación con `npm run gates:offline`
y probes bajo `scripts/offline-guard.mjs` (red físicamente bloqueada, cero llamadas a proveedor).

El defecto que se cierra, medido en prod: el PLAN emitió `defineConcept({concept:"bajo_benchmark"})` — un
token interno — y la definición de benchmark, que EXISTÍA, se perdió por un guion bajo; la excusa interna
(`no tengo una definición curada para 'bajo_benchmark'`) salió VERBATIM a pantalla por composeNoDataMessage.
El fix es del MOTOR: cero cambios de prompts/doctrina.

---

## 1 · Qué cambió, archivo por archivo

| Archivo | Qué cambió |
|---|---|
| `src/adi/oracle/toolRegistry.js` (defineConcept, líneas ~943-975) | **PIEZA 1 · la escalera de resolución**, parando en el primer hit: (a) `resolveGlossary(concept)` tal cual — como siempre; (b) el concept con `"_"→" "` (cierra el caso real por sí solo: «bajo_benchmark» → «bajo benchmark»); (c) la frase LITERAL del usuario (`args._preguntaUsuario`, la inyecta el runner); (d) null → declina honesto, sin fuzzy ni fallback a LLM. El orden está documentado en el código: (c) va ÚLTIMA porque una frase entera pasa por CONCEPT_MATCHERS (regex por orden) y si nombra DOS conceptos resuelve al primero del orden de matchers — el concept del plan, aunque sucio, es la señal más específica. **PIEZA 3 · el reason cita palabras de usuario**: `no tengo una definición curada para «bajo benchmark»` (término des-tokenizado; si no hay concept, la frase del usuario también des-tokenizada; si no hay nada, un genérico). Regla dura: el reason JAMÁS matchea `/\w_\w/`. |
| `src/adi/oracle/toolRunner.js` (líneas 79-80 y 160-167) | **PIEZA 2 · un solo punto de inyección**: `runPlan` acepta `opts.preguntaUsuario` y la inyecta como `args._preguntaUsuario` SOLO cuando `name === "defineConcept"` — el mismo patrón del período (comentario de toolRunner.js:25-29): un punto, todas las tools intactas, el schema del PLAN sin tocar. Sin el opt (gates/callers viejos), byte-idéntico a antes — verificado por A2.3. |
| `src/adi/oracle/answerViaOracle.js` (líneas 2037-2040) | El caller: `runPlan(..., { scenario, maxCalls, preguntaUsuario: q })`. **El flujo verificado de dónde sale la pregunta**: `answerViaOracle({ text, ... })` → `q = (text || "").trim()` (línea 1199, la frase literal del turno actual) → `runPlan` (línea 2040) → inyección del runner (toolRunner.js:167) → peldaño (c) de defineConcept. El substring `runPlan({ intent: plan.intent, calls }` que `_reparacion_cableado_gate.mjs:92` fija por indexOf se preservó. |
| `_probe_paso2_definir.mjs` (nuevo) | El probe de A2.1/A2.2/A2.3 (ver §2). |
| `_glosario_cobertura_gate.mjs` (nuevo) | **PIEZA 4 · el gate permanente** (ver §3): round-trip del catálogo, etiquetas visibles, escalera peldaño por peldaño, regresión del caso del owner por `runPlan`, y reason sin identificadores internos. 345 aserciones internas. |

NO se tocó (A2.5, verificado con `git diff` limpio): `guardC.js`, `narratePromptC.js`, `planPrompt.js`,
`hiloBudget.js`, `glossary.js`. Tampoco: composeNoDataMessage/narrationBlocks.js (Paso 3), conversationalContract,
modelos/tiers/modelRouter, ni los 4 archivos ajenos de la sesión Falcon (el worktree ni los tiene sucios; todo
`git add` fue archivo por archivo).

---

## 2 · Salidas de los probes (A2.1 · A2.2 · A2.3)

`node --import ./scripts/offline-guard.mjs _probe_paso2_definir.mjs` → **24 PASS · 0 FAIL**:

```
── A2.1 · el caso del owner: «bajo_benchmark» ya no pierde la definición ──
  ✓ resolveGlossary('bajo_benchmark') sigue siendo null (glossary.js SIN cambios — la tolerancia vive en la tool)
  ✓ resolveGlossary('bajo benchmark') resuelve (como siempre)
  ✓ peldaño (b) SOLO · defineConcept('bajo_benchmark') SIN pregunta → supported:true
  ✓ peldaño (b) · y la definición es LA de benchmark, byte-igual al catálogo
  ✓ peldaño (b) · concepto = «benchmark»
  ✓ caso completo · token sucio + pregunta inyectada → supported:true
  ✓ caso completo · la definición de benchmark viaja en facts
  ✓ peldaño (c) SOLO · concept irrecuperable + pregunta del owner → resuelve POR LA FRASE
  ✓ peldaño (c) · y también llega a benchmark
  ✓ peldaño (c) · control: el mismo concept SIN pregunta declina (la frase era la señal)
  ✓ orden de la escalera · concept válido GANA a la pregunta (margen bruto, no carga)

── A2.2 · lo desconocido declina honesto y la excusa habla en palabras de usuario ──
  ✓ concepto sin entrada curada → supported:false (no hay fuzzy, no hay invento)
  reason: "no tengo una definición curada para «flujo de caja proyectado»"
  ✓ el reason NO contiene identificadores con guion bajo (/\w_\w/)
  ✓ el reason cita el término EN PALABRAS («flujo de caja proyectado»)
  ✓ y conserva el prefijo honesto de siempre
  a pantalla: "No tengo información autorizada suficiente: no tengo una definición curada para
              «flujo de caja proyectado». Dime el nombre exacto o el dato que buscas y lo reviso."
  ✓ composeNoDataMessage: el mensaje que ve el usuario tampoco trae /\w_\w/
  ✓ ni nombres de tools ni vocabulario del contrato interno
  ✓ el caso del owner ya NI llega a tener excusa: ahora responde
  ✓ sin concept ni pregunta → declina con genérico limpio

── A2.3 · queryMetric y marginRead: byte-idéntico, la inyección es SOLO de defineConcept ──
  ✓ results de queryMetric+marginRead BYTE-IDÉNTICOS con y sin preguntaUsuario
  ✓ y el ledger completo también byte-idéntico
  ✓ control: queryMetric respondió con datos reales (no es un empate de vacíos)
  ✓ control: marginRead también
  ✓ en el ledger, NINGUNA de esas dos calls recibió _preguntaUsuario
```

Las dos tools elegidas para A2.3: `queryMetric` (la lectura genérica más usada) y `marginRead` con
`focus:"bajo_benchmark"` — a propósito la tool cuyo arg interno contiene el MISMO token del caso, para probar
que ese uso legítimo del token (como arg de foco, no como concepto) no se tocó. La comparación es
`JSON.stringify` de `results` y del `ledger` completo entre `runPlan` sin `preguntaUsuario` y con ella.

---

## 3 · Las dos corridas de gates:offline (A2.4)

**BASE, antes de tocar nada** (`8765920`):

```
132 PASS · 0 FAIL · 0 TOCARON LA RED · 0 CON CREDENCIAL VIVA (de 132 offline)
```

**DESPUÉS del Paso 2** (con el gate nuevo):

```
── npm run gates:offline · 195 gates en la raíz → 133 OFFLINE · 62 LIVE (no se corren) ──
133 PASS · 0 FAIL · 0 TOCARON LA RED · 0 CON CREDENCIAL VIVA (de 133 offline)
```

**La prueba de que el gate nuevo CORRIÓ (la trampa conocida no mordió)**: el header de la corrida pasó de
132 a 133 OFFLINE, `▶ _glosario_cobertura_gate.mjs` aparece en el log de ejecución y `✓ _glosario_cobertura_gate.mjs`
en el resumen. El gate no contiene ninguno de los strings que el clasificador estático usa para excluir en
silencio (verificado contra la lista `LIVE` de `scripts/gates-offline.mjs`). Corrido suelto bajo el candado:
**345 PASS · 0 FAIL** internos.

**Diff gate por gate entre las dos corridas** (estados ✓/✗ normalizados, sin tiempos): la ÚNICA diferencia es
la línea nueva `✓ _glosario_cobertura_gate.mjs`. Ningún gate preexistente cambió de estado y ningún fixture
necesitó actualización.

---

## 4 · Barrido COMPLETO de coverage.reason en toolRegistry.js (reportado, NO tocado)

Pregunta del barrido: ¿qué reasons interpolan un arg CRUDO del plan, sabiendo que composeNoDataMessage
(narrationBlocks.js:437) imprime el primer reason declinado VERBATIM a pantalla? Veredictos (línea = post-fix):

| Línea | Tool/helper | Interpola | Veredicto |
|---|---|---|---|
| 69 | `_pack` (reasonIfNull) | nada — string literal por caller | **limpio** |
| 90 | `_crossGuard` (filters no-objeto) | nada | **limpio** |
| 93 | `_crossGuard` | `${bad.join("/")}` = KEYS del `filters` del plan | ⚠️ **interpola arg crudo** — una key inventada tipo `sub_familia` saldría a pantalla con guion bajo |
| 164 | `_ejeNoAbierto` (queryMetric/salesRead/…) | `'${eje}'` = dimension del plan canonizada (minúsculas/sin acento); si no es eje declarado viaja TAL CUAL | ⚠️ **interpola arg crudo** (mitigado por `_ejeCanon`, pero un eje inventado `sub_canal` pasaría) |
| 337 | `entityCapitalLigado` | `r.reason` del motor (clientCapitalRelacion) | **limpio** (texto curado del motor) |
| 372 | `clientesPorSku` | nada | **limpio** |
| 430 | `clientesPorSku` | `${faltantes.join(", ")}` = nombres de SKU de los args | ⚠️ **interpola arg crudo** (suelen ser las palabras del usuario, pero nada lo garantiza si el plan tokeniza) |
| 464 | `entityRecord` | `'${entity}'` y `'${dimension}'` de los args | ⚠️ **interpola arg crudo** |
| 494 | `tensionRead` | `'${dimension}'` | ⚠️ **interpola arg crudo** |
| 495 | `tensionRead` | `r.unsupported` del motor | **limpio** |
| 509, 520 | `gridTable` | `'${dimension}'` | ⚠️ **interpola arg crudo** |
| 513 | `gridTable` | `r.unsupported` del motor | **limpio** |
| 697 | `simulateCosto` | `r.unsupported` del motor | **limpio** |
| 733, 737 | `simulateGeneral`/`_simVar` | nada | **limpio** |
| 741 | `simulateGeneral` | `${v.pct}` (numérico) + label interno («precio»/«volumen») | **limpio en la práctica** (un número no puede formar `/\w_\w/`) |
| 751 | `simulateGeneral` | `'${entity}'` y `'${dimension}'` | ⚠️ **interpola arg crudo** |
| 972 | `defineConcept` | el término DES-TOKENIZADO / la frase del usuario | ✅ **arreglado en este paso** |
| 1000, 1005 | `trend` | textos honestos compuestos por el motor | **limpio** |

Adyacente (fuera del encargo literal pero mismo riesgo, en `toolRunner.js`): línea 101 `tool desconocida: '${name}'`
(el nombre de tool que el plan alucinó — un identificador camelCase directo a pantalla) y línea 174
`error en tool '${_nombre}': ${e.message}` (nombre de tool + mensaje de excepción JS). El 176 es literal, limpio.

**Nada de esto se tocó** (alcance): la decisión de cuáles cerrar y cómo es del arquitecto. Nota de contexto: en
la mayoría de los ⚠️ el arg interpolado son las palabras del propio usuario (un nombre de cliente, un eje) y el
mensaje resulta natural; el riesgo es exactamente el del caso `bajo_benchmark` — cuando el plan tokeniza o
alucina, el token viaja a pantalla. Si el arquitecto quiere una regla general, el punto único donde TODOS los
reasons pasan antes del ledger es `runPlan` (toolRunner.js, donde ya corre `_veraz`).

---

## 5 · Términos del catálogo que hoy NO resuelven (deuda preexistente)

**Ninguno.** El barrido del 2026-08-13 midió, bajo el candado offline:

- Round-trip de CONCEPT_DEFS (35 conceptos × slug + aka + etiquetas): **0 nulls, 0 desvíos** — cada nombre
  declarado resuelve a SU propio concepto.
- Etiquetas del viewManifest (56 piezas), labels de METRICS y entradas de METRIC_DEFS: **0 sin respuesta**.
- `vocabularioSinConcepto()`: las 7 familias derivadas, **todas vacías**.
- Los términos del caso real: «bajo benchmark»→benchmark · «brecha»→brecha · «benchmark»→benchmark ·
  «vs benchmark»→benchmark · «bajo_benchmark»→benchmark (vía escalera de defineConcept, no del glosario).

Por eso el gate afirma cobertura PLENA sin lista de TODOs: la cobertura plena existe (el `_glosario_gate`
preexistente ya obligaba a cero huérfanas; este gate agrega el round-trip a slug propio, la escalera y la
regla del reason).

---

## 6 · Decisiones no obvias que dejo al arquitecto

1. **El peldaño (c) puede resolver "de rebote" un turno que nombra dos conceptos.** Si el PLAN manda un
   concept irrecuperable Y la pregunta nombra dos conceptos («qué es la carga y el rebate»), (c) resuelve al
   primero por orden de CONCEPT_MATCHERS. Lo mitigué con el ORDEN (el concept del plan gana cuando resuelve)
   y está documentado en el código; la alternativa (declinar si la frase matchea >1 concepto) la descarté
   porque reintroduce el defecto para el caso de UN concepto mal tokenizado — pero es una política discutible.
2. **Los ⚠️ del barrido de §4** — cuáles cerrar, y si la regla `/\w_\w/` debería aplicarse como filtro general
   en `runPlan` (el estrangulamiento donde ya corre `_veraz`) en vez de reason por reason.
3. **`tool desconocida: '${name}'` (toolRunner.js:101)** llega a pantalla con el nombre camelCase que el plan
   alucinó — mismo defecto de familia, fuera del encargo literal (no es toolRegistry.js).
4. **`args._preguntaUsuario` queda grabada en `ledger.calls[].args` de la call de defineConcept** (los args
   definitivos son los que se graban — coherente con cómo el ledger registra todo). Verificado que NO afecta
   boleta, tipado ni a las demás calls; si el arquitecto prefiere excluirla del registro del ledger, es un
   cambio de una línea en la meta que se le pasa a `recordCall`.
5. **Propuestas de glosario: ninguna necesaria.** No hizo falta ni una entrada ni un matcher nuevo — el
   vocabulario actual cubre el caso completo. glossary.js quedó intacto.

---

## 7 · Commits locales (sin push — lo autoriza el arquitecto)

Rama del worktree `claude/relaxed-swanson-8f2903`, basada en `dev` = `8765920`:

- `244fa21` — «El guion bajo deja de perder la definicion: escalera en defineConcept y la pregunta del turno
  viaja al motor» (toolRegistry.js · toolRunner.js · answerViaOracle.js · _probe_paso2_definir.mjs).
- `5244523` — «ADI no emite termino que no sabe definir: el gate de cobertura del glosario»
  (_glosario_cobertura_gate.mjs).
- (este informe va en un tercer commit)

Verificación reproducible, sin gastar:

```
npm run gates:offline
node --import ./scripts/offline-guard.mjs _probe_paso2_definir.mjs
```
