# INFORME · Paso 3b «ADI pierde el hilo» — los tres hallazgos de la certificación en vivo, cerrados

**Worker** · 2026-08-13 · base `dev = 07f5a85` · rama `claude/magical-meitner-89068d` · SIN push · commits locales archivo por archivo.
**Candados de gasto respetados**: cero llamadas a proveedor; verificación solo `npm run gates:offline` y probes con `node --import ./scripts/offline-guard.mjs`. Los archivos nuevos no contienen marcadores del clasificador (el gate nuevo ENTRÓ a la suite: header 135→136 OFFLINE, la trampa conocida, verificada por el conteo).
**Nota de arranque:** el worktree estaba en `61afd50` (ancestro de dev); fast-forward local a `07f5a85` antes de tocar nada.

---

## 1 · EL DIAGNÓSTICO EXACTO del hallazgo 1 — por qué el descarte D1 (:1711) no matcheó

**La hipótesis del encargo era la equivocada, y eso es la mitad del hallazgo.** El encargo apuntaba a `reparacion.pregunta` saliendo por el corte de corrección ambigua (~:1737). Reproducido offline con el plan sintético, ese camino **ya estaba cerrado**: si el plan crudo trae `intent:"clarify"` + `reparacion:{tipo:"correccion", ambigua:true, pregunta:"¿qué parte no entendiste?"}`, `coerceVocabularioPlan` coerciona el intent a `redirect` por la tabla de tipos, `normalizeReparacion` la sella como ambigua, y el descarte D1 de :1711 **SÍ dispara** (`_CLARIFY_RE` ✓, `respuestaYaEsEspecifica("no entiendo que me quieres decir")` = false ✓) → el turno re-enseña. Esa variante además habría invocado al narrador (2 llamadas) — y la evidencia viva dice **1 llamada, deterministic=true**.

**El estado real de `_reparacion`/intent en el camino vivo:** `_reparacion = null` en :1711 — no había NADA que descartar. Con `intent:"clarify"` y sin `reparacion.tipo` reconocible, `normalizeIntent` no tiene tabla por la que reparar (traza `intent-invalido-sin-tipo`) y el intent **queda "clarify"**; `normalizeReparacion` devuelve null; el respaldo estructural (`_puedeInferir`) exige `intent==="redirect"` y tampoco corre. D1 y el corte de :1737 pasan de largo sin tocar nada.

**El tercer generador: `plan.supuestos_faltantes`** — el mecanismo de request_clarification de simulate v2 (schema en planPrompt.js:97: «la pregunta EXACTA que hace falta responder…, calls debe quedar vacío»). El planificador, ante «no entiendo», clasificó fuera de enum y escribió su contrapregunta en ese campo. El bloque de answerViaOracle (~:1906-1963 en la base) la emite **verbatim** por `_composedBypassResult`: deterministic=true, cero narrador, sin mirar intent, sin mirar `_CLARIFY_RE`, y **antes** de la rama data_only — por eso en el hilo C el mensaje D2 nunca se alcanzó. `_hasCompleteSimulateVars([])` devuelve false (no hay call a simulateGeneral), así que el campo se consumía sin ninguna condición de contexto de simulación.

**Reproducción (offline, plan sintético, base 07f5a85 sin fixes):**

| Variante del plan crudo | Resultado en la base | ¿Calza con la evidencia viva? |
|---|---|---|
| V1 · clarify + reparación declarada ambigua con pregunta, sin calls | D1 dispara → re-enseña vía narrador | NO (2 llamadas, sin contrapregunta) |
| V2 · clarify + `supuestos_faltantes:["¿qué parte no entendiste?"]`, sin calls | **«¿qué parte no entendiste?» · deterministic=true · narrador=0** | **SÍ — byte a byte (hilo A t2)** |
| V3 · ídem bajo data_only («no entiendo» pelado) | **la contrapregunta · el D2 nunca se alcanza** | **SÍ (hilo C t3)** |
| V4 · clarify + reparación con tipo inválido, sin supuestos | sigue al narrador (re-enseña) | NO (2 llamadas) |
| V5 · redirect + supuestos_faltantes | la contrapregunta, verbatim | (misma familia que V2) |

El probe `_probe_paso3b_hallazgos.mjs` se commiteó **ANTES** que los fixes (`64fcacb`): corrido sobre ese commit, **19 aserciones fallan mostrando la contrapregunta emitida** — la reproducción vive en la historia y un bisect la encuentra. Sobre el árbol final: 37/37.

---

## 2 · Qué cambió, archivo:línea

### `src/adi/oracle/answerViaOracle.js` (h1 motor + h2 cableado + h3 caller) · commit `89b0c0b`
- **:22** import suma `INTENT_KEYS` (el enum ya existía en conversationalContract — no se inventa una lista).
- **:1711** `_confusionPelada` = `_CLARIFY_RE && !respuestaYaEsEspecifica` — computada UNA vez; el descarte D1 existente la reutiliza sin cambio de lógica.
- **:1731-1738** los DOS cierres nuevos, solo bajo confusión pelada: (a) un intent fuera de enum que sobrevivió a `coerceVocabularioPlan` baja a `"answer"` (el narrador entra por `_coerceMode`, que ya fuerza clarify); (b) `supuestos_faltantes` se descarta **limpiándolo EN el plan** — `buildSupuestos` (narrationContract.js:373) re-lee el objeto crudo, y sin la limpieza la contrapregunta descartada viajaría al payload del narrador como «supuesto faltante» listo para salir en eco (la misma lección del §5.b del Paso 3). Ambos descartes trazan en `planCoerciones`.
- **:2270** `metricaLabelsPreguntadas` — las métricas que el turno nombra, resueltas con `_extractTensionMetrics` (la tabla texto→token que YA existía en este archivo, con verbos y sustantivos) + `fieldLabel` (el diccionario token→etiqueta de entityRecord.js, ya importado). Cero matchers nuevos.
- **:2316 · :2552 · :2661** los tres sitios de `componerPorForma` con forma variable reciben `metricaLabels`. Los dos sitios con `forma:"tabla"` fija (:2485, :2607) NO la reciben, a propósito: la tabla no tiene fila que encabece y su lectura mínima es de magnitud (§5.d).
- **:2325-2335** `desdeAckPref` (h3): en la rama data_only/results_only, ANTES de `composeNoDataMessage` — exige `plan.intent==="ack"` + `turnPref.contentScope` (la preferencia declarada POR ESTE turno, nunca la sesión heredada) + calls vacío + sin cifra/definición/confusión. Precedencia: `desdeLedger || desdeTexto || desdeConfusion || desdeAckPref || composeNoDataMessage`.

### `src/adi/oracle/narrationBlocks.js` (h2 compositor + h3 mensaje) · commit `d65e9ed`
- **:262** `_oracionDeCifra(list, lider=null)` — sin líder es byte-idéntica a la versión previa.
- **:278-283** `_figsDeMetricaPedida` — matchea la etiqueta pedida contra SEGMENTOS «·» completos del label: «Sodimac · Margen» matchea «Margen»; «Benchmark de margen» NO (un solo segmento: es la referencia, no la métrica) — probado en el probe.
- **:299-301** `componerPorForma` gana `metricaLabels`; `top` = la fig de la métrica pedida si está (entre ésas, la de mayor magnitud), si no `topMagnitud` de siempre.
- **:330** la lectura mínima de la tabla usa SIEMPRE `topMagnitud` («la fila de mayor magnitud es…» tiene que seguir siendo verdad).
- **:334** data_only encabeza con `top`.
- **:382-385** el cierre AUTO dice el criterio VERDADERO: «…la métrica por la que preguntaste» cuando encabezó la pedida; «…la magnitud mayor de las autorizadas» solo cuando ese fue el criterio (medido en vivo: «explícame ese margen» cerraba señalando Ventas «por magnitud» — ahora ni abre ni cierra con esa mentira).
- **:487-499** `composeAckPreferenciaMessage(contentScope)` — texto fijo, misma familia que sus vecinas: confirma («Listo: te entrego solo los datos/resultados, sin análisis ni recomendaciones»), invita al reset con «análisis completo» (la frase EXACTA de `_PREF_RESET_RE` — ejecutable) y al dato puntual.

### Archivos nuevos
- **`_probe_paso3b_hallazgos.mjs`** (`64fcacb`, ANTES de los fixes) — A1-A3, **37 PASS / 0 FAIL** post-fix · **18/19 FAIL** pre-fix (la reproducción).
- **`_hallazgos_cert_vivo_gate.mjs`** (`a356f51`) — blindaje permanente de los tres, **13 PASS / 0 FAIL**, DENTRO de la suite (header 135→136). Inyección por keys computadas, sin marcadores del clasificador.

### Lo que NO se tocó (A5, verificado por `git status` + diff)
`guardC.js`, `hiloBudget.js`, `glossary.js`, adapters, `modelPricing.js`, `modelDefaults.js`, `planPrompt.js`, `narratePromptC.js`, `conversationalContract.js`, `persona.js`, `dialogueState.js`, `responsePreference.js`, `conversationScope.js`, `narrationContract.js`. Los 4 archivos Falcon no aparecen en este worktree. **El fix es 100% de MOTOR — ningún prompt necesitó tocarse** (ver §5.a para la propuesta de doctrina que se documenta sin implementar).

---

## 3 · Salidas A1-A3 (probe `_probe_paso3b_hallazgos.mjs`, offline, tools reales)

```
[A1] la matriz: cada forma en que el plan puede traer la contrapregunta, y ninguna la emite
  ✓ V1 · intent=clarify (fuera de enum) + reparación declarada ambigua CON pregunta, sin calls → sin contrapregunta
  ✓ V2 · EL CAMINO VIVO (hilo A turno 2): intent=clarify + supuestos_faltantes con la pregunta, sin calls
  ✓ V3 · intent=redirect + supuestos_faltantes · ✓ V4 · intent=answer + supuestos_faltantes
  ✓ V5 · intent=clarify + supuestos_faltantes + CON calls · ✓ V6 · redirect con reparación INFERIDA
  ✓ V7 · redirect + reparación ambigua SIN pregunta escrita
  (las 7 re-enseñan vía narrador; V2 traza los dos descartes: supuestos-faltantes-descartados + intent-fuera-de-enum)
[A1b] «eso no es así» → la pregunta de precisión SÍ se emite, sin narrador (garantía vieja intacta)
[A1c] bajo solo-datos, el «no entiendo» del hilo C (intent=clarify crudo, mode=seguimiento, supuestos escritos)
      → EXACTAMENTE el mensaje D2, sin narrador; y sin supuestos también
[A2] «margen de Sodimac» → encabeza Sodimac · Margen: 23.5% · «dame Sodimac» → Ventas $8.2M (magnitud de siempre)
     · «ventas de Sodimac» → Ventas · narrador=0 en todos
[A2b] forma auto con métrica pedida: abre con Margen y cierra «…la métrica por la que preguntaste»; sin métrica:
      byte-compatible con la conducta previa; «Margen» pedido NO matchea «Benchmark de margen»; la lectura mínima
      de la tabla sigue nombrando la fila de mayor magnitud REAL
[A3] el ack de preferencia puro → EXACTAMENTE la confirmación (narrador=0, sin /\w_\w/, sin palabras prohibidas,
     sin nombres de tools, con «análisis completo» como reset ejecutable, preferencia persistida igual que antes)
[A3b] ack + pedido de dato → EL DATO (y encabeza la métrica pedida) · un ack cualquiera bajo la sesión solo-datos
      NO recibe la confirmación
── _probe_paso3b_hallazgos: 37 PASS · 0 FAIL ──
```

Pre-fix (mismo probe, árbol sin los fixes — la corrida del diagnóstico): `18 PASS · 19 FAIL`, con V2-V5 mostrando `¿qué parte no entendiste?` como texto de respuesta.

---

## 4 · Las dos corridas de gates (A4)

| Corrida | Resultado |
|---|---|
| ANTES (base 07f5a85 limpia, vía stash -u) | `135 PASS · 0 FAIL · 0 TOCARON LA RED · 0 CON CREDENCIAL VIVA (de 135 offline)` |
| DESPUÉS (h1+h2+h3+probe+gate) | `136 PASS · 0 FAIL · 0 TOCARON LA RED · 0 CON CREDENCIAL VIVA (de 136 offline)` |

**Gates movidos: NINGUNO.** El único delta 135→136 es `_hallazgos_cert_vivo_gate.mjs` entrando a la suite. Ningún gate de preferencia/forma/clarify existente cambió de estado — el análisis garantía-vs-formato no tuvo casos que analizar: `componerPorForma` sin `metricaLabels` es byte-idéntica, y los gates existentes la llaman sin el argumento.

---

## 5 · Decisiones no obvias

a) **A5 · la doctrina del PLAN queda con una deuda DOCUMENTADA, sin implementar.** El planificador usó `supuestos_faltantes` para una pregunta que no es de simulación e inventó `intent:"clarify"`. La doctrina de planPrompt.js podría decir explícito «`supuestos_faltantes` es SOLO para simulaciones de 2 variables; una confusión del usuario es mode=clarify, nunca una pregunta tuya» — pero tocar el prompt exige re-medir en vivo y el fix del motor ya lo hace inocuo venga como venga. Se FRENA acá y se deja la propuesta al arquitecto. (Nota: el enum de intents NO necesita crecer — «clarify» como intent seguiría siendo un modo, no una intención, y el motor ya lo normaliza.)

b) **El descarte de supuestos es por CONFUSIÓN PELADA, no por intent.** Un turno de simulación real jamás matchea la condición: «¿y si le subo el precio a Falabella 5%?» nombra cifra y métrica (`respuestaYaEsEspecifica` = true) — el gate lo afirma con un caso de simulate v2 vivo. Y una corrección ambigua real («eso no es así») no matchea `_CLARIFY_RE`, así que si un plan de corrección trajera supuestos escritos, la conducta previa se conserva. Red angosta, como todo `_coerce*` del archivo.

c) **El intent fuera de enum solo se normaliza bajo confusión pelada.** Fuera de ella, un intent inválido sin `reparacion.tipo` sigue quedando como está (traza `intent-invalido-sin-tipo`, conducta de siempre) — normalizarlo en general sería una decisión de vocabulario que no pidió este paso y que otros consumidores podrían estar leyendo.

d) **La lectura mínima de la tabla y el compositor de `action_only` conservan la magnitud.** «La fila de mayor magnitud es X» es una afirmación DE MAGNITUD: señalarse a la métrica pedida la volvería falsa. Y «La prioridad: X» de action_only es un juicio de prioridad (magnitud), no una respuesta a «qué métrica preguntaste» — el hallazgo 2 es sobre turnos de DATO. Por lo mismo, los dos call-sites con `forma:"tabla"` fija no reciben `metricaLabels`.

e) **La justificación del cierre AUTO cambia de frase cuando cambia el criterio.** Antes: «…que es la magnitud mayor de las autorizadas» SIEMPRE. Si la fig que encabeza es la métrica preguntada, esa frase sería mentira — ahora dice «…que es la métrica por la que preguntaste». Formato-vs-garantía: es la MISMA garantía («la justificación dice la verdad») con el texto que la cumple.

f) **`desdeAckPref` exige `turnPref` (la declaración DE ESTE turno), no la sesión.** Un «ok, gracias» bajo una sesión solo-datos ya activa NO recibe la confirmación (probado): seguiría el genérico de siempre. La confirmación es para el turno que CONFIGURA. Y el mensaje no dice «desde ahora»: la persistencia es del eje `_PREF_PERSIST_RE` y prometerla sin mirarla sería afirmar de más — el texto confirma el formato, no su duración.

g) **El mensaje de confirmación no pasa por el narrador ni abre superficie lingüística** — texto fijo en la familia `composeNoDataMessage`/`composeSoloDatosConfusionMessage`, y guardC lo valida como al resto de los candidatos de esa rama (sin cifras: pasa).

h) **`metricaLabelsPreguntadas` usa `_extractTensionMetrics` tal cual**, con su límite conocido: léxico cerrado de ~11 tokens (margen/venta/costo/contribución/rotación/…). Una métrica fuera de ese léxico no encabeza por nombre — cae a magnitud, que es el fallback honesto. Ampliar el léxico es una decisión aparte (ese mapa alimenta también la coerción de tensión).

---

## 6 · Commits (locales, SIN push, archivo por archivo)

| Hash | Archivo | Qué |
|---|---|---|
| `64fcacb` | `_probe_paso3b_hallazgos.mjs` | el probe ANTES del arreglo — sobre este commit falla 19 mostrando la contrapregunta (la reproducción, bisecteable) |
| `d65e9ed` | `src/adi/oracle/narrationBlocks.js` | h2 (métrica preguntada encabeza + criterio verdadero) + h3 (mensaje de confirmación) |
| `89b0c0b` | `src/adi/oracle/answerViaOracle.js` | h1 (descarte de supuestos_faltantes + intent fuera de enum bajo confusión pelada) + cableado h2 + caller h3 |
| `a356f51` | `_hallazgos_cert_vivo_gate.mjs` | blindaje permanente (13/13, suite 135→136) |
| `(este archivo)` | `_INFORME_PASO_3B.md` | el informe |

Nunca se usó `git add -A` ni `commit -a`. Los 4 archivos Falcon no aparecen en este worktree. `_cert_vivo_openai.mjs` no se corrió, no se tocó y no se commiteó.

**Para la certificación viva #2:** re-medir los 3 turnos exactos (hilo A t2, hilo C t1/t2/t3/t4) + verificar que el planificador real no encuentre un CUARTO canal (la matriz del probe cubre reparación, supuestos e intent — si el PLAN inventara otro campo con la pregunta escrita, el único emisor restante de texto libre del plan es `reparacion.pregunta` vía :1760, que D1 ya regula).
