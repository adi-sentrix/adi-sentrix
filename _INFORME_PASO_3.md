# INFORME · Paso 3 (final) «ADI pierde el hilo» — «no entiendo» re-enseña (D1) y el candado de solo-datos aprende a decir la verdad útil (D2)

**Worker** · 2026-08-13 · base `dev = 24f29ff` (Pasos 0-2 + prep Anthropic + 1b) · rama `claude/pensive-hellman-727043` · SIN push.
**Candados de gasto respetados**: cero llamadas a proveedor; verificación solo `npm run gates:offline` y probes con `node --import ./scripts/offline-guard.mjs`. Los archivos nuevos no contienen ningún marcador de red del clasificador (verificado con grep: exit 1 = limpio) y el gate nuevo ENTRÓ a la suite (header 134→135 OFFLINE — la trampa del clasificador, verificada por el conteo).

**Nota de arranque:** el worktree estaba en `61afd50` (detrás de la base); se hizo fast-forward local a `24f29ff` antes de tocar nada.

---

## 1 · EL MAPA — de dónde salía la repregunta (quién decidía, quién redactaba)

La frase de la foto del owner («¿qué parte de la información te genera confusión?») **no existe literal en el código**: la redactó un LLM. El mapeo previo al cambio encontró **dos generadores posibles y un juicio documentado**, y los tres puntos quedaron resueltos:

**(a) El generador determinístico — el corte por corrección AMBIGUA (el camino fuerte).**
`answerViaOracle.js` corta el turno ANTES del narrador cuando hay una reparación ambigua (Contrato v1.2 §4, el corte vivía en ~:1713-1737 de la versión base):
- **Quién decide**: el PLAN (LLM), desclasificando el «no entiendo» como `intent="redirect"` — con `reparacion:{ambigua:true}` **declarada** (y muchas veces con su `pregunta` ya escrita), o **inferida** por el motor (`:1690` base: redirect sin reparación y sin cambio estructural → ambigua; `:1688`: redirect que repite la misma tool → también corta). Nada en el motor impedía esa desclasificación: la doctrina de reparación de planPrompt dice que ambigua es para «eso no es así», pero el enum no se cumple solo (lección ya pagada en este repo).
- **Quién redacta**: la `reparacion.pregunta` del propio PLAN (verbatim, con `stripLanguageLeaks`) — el estilo de la frase medida en prod calza con esto — o, si el PLAN no la trae, la red determinística `composePrecisionQuestion` (conversationScope.js:401-421: «Antes de rehacerlo, dime qué corrijo: ¿…?» / «Dime qué parte está mal…»).
- El corte devuelve la pregunta como respuesta del turno **sin batch y sin narrador**: la contrapregunta como PRIMERA respuesta, exactamente el comportamiento de la foto.

**(b) El narrador libre bajo mode=clarify (el camino débil).**
`_CLARIFY_RE` (answerViaOracle.js:588) + `_coerceMode` (:626) fuerzan `mode=clarify` ante «no entiendo» inequívoco. La doctrina clarify (conversationalContract.js MODES, que viaja al system del narrador vía `buildModeDispatch()` — narratePromptC.js:83, segmento FIJO desde el Paso 0) decía «re-enseñá» y regulaba el CIERRE (pregunta guía), pero **no regulaba la APERTURA**: nada le prohibía al narrador abrir preguntando qué parte confunde.

**(c) El juicio documentado que D1 revierte.**
dialogueState.js:247 documentaba «no entiendo» → «¿qué parte no entendés?» ← **CORRECTO** (nota del 2026-08-12, «la segunda aclaración no existe»). Es un comentario, no código: la función de ese bloque (`debeResponderSinRepreguntar`) solo actúa con una aclaración YA pedida (streak≥1) y **no era el generador** del primer turno. `needsOrientacion`/`confusion_persistente` (dialogueState.js:239-243) dispara con streak≥3 y tampoco genera contrapreguntas — sin cambios.

**D2 — el flujo bajo solo-datos.** La rama `data_only/results_only` (answerViaOracle.js, garantía por construcción: el narrador JAMÁS se invoca) resolvía en cascada: `componerPorForma` (cifras) → `composeFromTextualEvidence` (definición curada — **verificado**: el Paso 2 la alimenta, probe A3b) → `composeNoDataMessage` (genérico). Un «no entiendo» sin concepto caía al genérico «No tengo información autorizada suficiente…».

---

## 2 · Qué cambió, archivo:línea

### `src/adi/oracle/conversationalContract.js` (D1 — la doctrina)
- **:16** `CONTRACT_VERSION` 1.2.0 → **1.3.0**, con la entrada de historial (:24-29) que documenta D1.
- **:71** (dentro de `MODES` clarify.narrate) bullet NUEVO de APERTURA, primero de la lista: «NUNCA abras con una contrapregunta … re-enseñá DE INMEDIATO el mensaje central … ÚNICA EXCEPCIÓN — MULTI-TEMA REAL: … (una respuesta larga de UN solo tema NO cuenta), ahí sí podés preguntar cuál de esos temas retomar, nombrándolos». **El resto de la doctrina intacto**: escalera de niveles 1/2, cero jerga, pregunta guía de cierre (el probe lo afirma byte a byte).

### `src/adi/oracle/answerViaOracle.js` (D1 plomería + D2 caller)
- **:26** import suma `respuestaYaEsEspecifica` (la vara de especificidad que YA existía en dialogueState.js — no se inventó un segundo detector).
- **:1693-1717** el descarte D1: si `_reparacion` es corrección **ambigua** (declarada o inferida) Y el texto matchea `_CLARIFY_RE` Y NO es específico (`!respuestaYaEsEspecifica`), la reparación se descarta como desclasificación (`planCoerciones` traza `confusion-pelada→clarify(reparacion-ambigua-descartada)`), `plan.reparacion` se limpia TAMBIÉN en el plan (narrationContract.js:688 re-lee el objeto crudo — ver §5.b) y el intent baja a `answer`. El turno sigue de largo: `_coerceMode` fuerza clarify y el narrador re-enseña. **Red angosta**: «eso no es así» no matchea `_CLARIFY_RE` → el corte de precisión sigue intacto; una corrección RESUELTA (`corrige` no vacío) no se toca nunca.
- **:2290-2298** la rama data_only/results_only gana el cuarto candidato D2: `desdeConfusion` — SOLO si no hubo cifra ni definición Y el texto matchea `_CLARIFY_RE` (el detector existente). Precedencia: `desdeLedger || desdeTexto || desdeConfusion || composeNoDataMessage`.

### `src/adi/oracle/narrationBlocks.js` (D2 — el mensaje)
- **:441-460** `composeSoloDatosConfusionMessage(results)` NUEVA, junto a `composeNoDataMessage` (misma familia, texto fijo, cero narrador). Devuelve **null si alguna tool declinó con razón real** (esa razón manda — §5.c). El texto: registro formal LatAm, tuteo neutro como sus vecinas, sin chilenismos, sin `\w_\w`, sin nombres de tools; dice que la preferencia de solo-datos está activa e invita a «pídeme el análisis completo» (frase que `_PREF_RESET_RE` YA reconoce como reset — la invitación es ejecutable, no decorativa) o a nombrar «qué dato o concepto puntual» falta.

### `src/adi/oracle/dialogueState.js` (documentación)
- **:247 y :253-258** NOTA D1: el «← CORRECTO» del caso del 2026-08-12 queda revertido por escrito; la regla de la segunda aclaración sigue vigente sin cambios (solo comentario — cero código).

### Archivos nuevos
- **`_probe_paso3_clarify.mjs`** — A1-A3, **39 PASS / 0 FAIL** (§3).
- **`_clarify_reensena_gate.mjs`** — blindaje permanente D1+D2, **17 PASS / 0 FAIL**, DENTRO de la suite (header 134→135). Inyección por keys computadas, sin marcadores del clasificador.

### Lo que NO se tocó (A5 verificado por diff)
`planPrompt.js`, `persona.js`, `narratePromptC.js`, `guardC.js`, `hiloBudget.js`, `glossary.js`, `defineConcept`, adapters, `modelPricing.js`, `modelDefaults.js` — diff limpio. El flujo mapeado no exigió tocar narratePromptC: la doctrina clarify entra al system por `buildModeDispatch()` desde el contrato, que es exactamente el lever previsto. Los 4 archivos Falcon no aparecen en este worktree.

---

## 3 · Salidas A1-A3 (probe `_probe_paso3_clarify.mjs`, offline, marginRead real)

```
[A1] «no entiendo» tras un turno con datos → modo clarify + instrucciones de re-enseñar sin contrapregunta
  ✓ la re-enseñanza del narrador SALE al usuario tal cual (plomería completa)
  ✓ el narrador SÍ fue invocado — narró 1
  ✓ el payload declara modo=clarify · ✓ nivel_aclaracion=1 (la escalera intacta)
  ✓ el payload NO trae ninguna contrapregunta «¿qué parte…?» (byte a byte) · ✓ ni la frase medida en prod
  ✓ el system PROHÍBE abrir con contrapregunta · ✓ exige re-enseñar DE INMEDIATO el mensaje central
  ✓ la excepción multi-tema real declarada · ✓ distingue multi-tema de una respuesta larga de un solo tema
  ✓ la prohibición de APERTURA va antes que la pregunta guía de CIERRE
  ✓ el system NO contiene la contrapregunta medida en prod (byte a byte)
  ✓ escalera 1/2 intacta · ✓ pregunta guía de cierre intacta · ✓ contrato @1.3.0
[A2a] PLAN desclasifica con la contrapregunta ESCRITA → NO se emite; el turno re-enseñó; coerción trazada
[A2b] «eso no es así» (ambigüedad real) → la pregunta de precisión SÍ se emite, sin narrador (garantía vieja)
[A2c] variante INFERIDA (redirect que repite la tool) → tampoco repregunta; re-enseña vía narrador
[A3a] data_only + «no entiendo» sin concepto → EXACTAMENTE el mensaje nuevo (byte a byte), narrador=0,
      registro verificado (sin \w_\w, sin plata/vara/dormido/palanca/apretar, sin nombres de tools),
      invita al reset («análisis completo») o al dato puntual
[A3b] «qué significa la carga comercial» (curado) → la definición, narrador=0
[A3c] «cuál es el margen por cliente» → cifras de la boleta, sin el mensaje nuevo, narrador=0
[A3d] concepto identificado pero DESCONOCIDO → la razón declinada real se cita, no el mensaje nuevo, narrador=0
── _probe_paso3_clarify: 39 PASS · 0 FAIL ──
```

OJO (pedido del encargo): el probe afirma la **plomería** — la CALIDAD de la re-explicación es del LLM y se mide en la certificación en vivo.

---

## 4 · Las dos corridas de gates (A4) y el análisis de cada gate movido

| Corrida | Resultado |
|---|---|
| ANTES (base 24f29ff limpia) | `134 PASS · 0 FAIL · 0 TOCARON LA RED · 0 CON CREDENCIAL VIVA (de 134 offline)` |
| DESPUÉS (D1+D2+probe+gate) | `135 PASS · 0 FAIL · 0 TOCARON LA RED · 0 CON CREDENCIAL VIVA (de 135 offline)` |

(Una primera corrida «antes» se descartó por contaminada: este worker editó archivos mientras corría — se repitió con el working tree limpio vía stash. El único delta 134→135 es `_clarify_reensena_gate.mjs`, que entró a la suite.)

**Gates movidos, garantía-vs-formato:**
- **`_reparacion_contextual_gate.mjs`** (2 chequeos):
  1. Pin `CONTRACT_VERSION === "@1.2.0"` → **formato** (fija QUE el contrato versione, no congela un número; el propio gate nació subiéndolo a 1.2.0). Actualizado a 1.3.0 documentando D1 en el gate.
  2. `BASE.narrarDefault` 39524 → **40152** → **formato/presupuesto**: la garantía real del chequeo es «la doctrina de reparación es CONDICIONAL — NARRAR no crece POR TURNO», y sigue verde sin tocar. La suba (+628 car ≈ 157 tokens, UNA vez) es la doctrina D1 en el segmento **FIJO** cacheable (el chequeo «toda la doctrina nueva cae del lado FIJO» lo verifica en la misma corrida) — mismo precedente que la suba del Paso 0 documentada en el propio gate («el presupuesto existe para que el costo se DECIDA, no para impedir la mejora»).
- **`_segunda_aclaracion_gate.mjs`**: **cero aserciones cambiadas** — solo rótulos/comentarios (NOTA D1): el gate fija `debeResponderSinRepreguntar` (la segunda aclaración), que no es el generador de la apertura; su rótulo viejo bendecía la contrapregunta y eso era formato desactualizado.
- **Ningún gate de GARANTÍA se puso rojo** (data_only sin narrador, guardC, preferencias, clarify-sin-tabla): no hubo nada que frenar.

---

## 5 · Decisiones no obvias

a) **D1 se cerró en DOS frentes, no en uno.** El mapeo no puede probar cuál de los dos generadores redactó la frase de la foto (ambos son LLM). Cerrar solo la doctrina dejaba vivo el corte determinístico (que ni siquiera llega al narrador); cerrar solo el corte dejaba al narrador libre de abrir preguntando. Se cerraron ambos; el multi-tema quedó como **criterio de doctrina** (el narrador ve el hilo y puede juzgar «varios temas»; el motor no) — el camino determinístico para confusión pelada quedó CERRADO, no condicionado.

b) **Al descartar la reparación se limpia TAMBIÉN `plan.reparacion` y el intent baja a `answer`.** No alcanza con anular la variable local: `narrationContract.js:688` re-lee el objeto crudo del plan vía `normalizeReparacion` — sin la limpieza, el narrador recibiría doctrina de corrección, guardC juzgaría una corrección inexistente y el candado (b) de `boletaAnterior` (Paso 1b) bloquearía la re-cita de la cifra que justamente hay que re-explicar. El descarte es la MISMA filosofía que `_coerceMode`: ante la frase inequívoca, el piso determinístico manda sobre la clasificación del LLM.

c) **La razón declinada real le gana al mensaje D2.** «No entiendo qué significa el factor zeta» identifica un concepto; defineConcept declina con razón honesta (Paso 2). Prometer ahí que desactivar la preferencia traería la explicación sería falso — no hay definición curada. Por eso `composeSoloDatosConfusionMessage` devuelve null si alguna tool declinó con razón, y `composeNoDataMessage` la cita como siempre. «Sin concepto identificable» se cumple literal.

d) **La invitación del mensaje D2 es ejecutable**: «pídeme el análisis completo» usa adrede la frase que `_PREF_RESET_RE` ya reconoce como reset de la preferencia — el usuario que obedece la invitación efectivamente sale del modo solo-datos en el turno siguiente, sin mecanismo nuevo.

e) **Un turno de confusión bajo data_only cuyo plan SÍ re-trae cifras sigue devolviendo la tabla** (desdeLedger manda). Es deliberado: D2 no relaja el contrato «turno con dato = turno de dato»; el mensaje nuevo es solo para el caso sin cifra y sin definición.

f) **Detalle del probe**: en A2c el texto sale con «(Datos del año cerrado.)» antepuesto — es la garantía de período de siempre (ese turno SÍ trae figs), no un efecto de este paso; la aserción usa `includes` y lo documenta.

g) **`respuestaYaEsEspecifica` como definición de «pelado»**: «no entiendo el 3.5% de logística» NO es pelado (nombra cifra/línea) y no activa el descarte D1 — si el PLAN lo declarara ambiguo, el corte de siempre decide. Red angosta a propósito; el caso del owner («no entiendo que me quieres decir») sí es pelado.

---

## 6 · Commits (locales, SIN push, archivo por archivo)

| Hash | Archivo | Qué |
|---|---|---|
| `70d16b5` | `src/adi/oracle/conversationalContract.js` | doctrina D1 (apertura + multi-tema) · contrato 1.3.0 |
| `1e1905a` | `src/adi/oracle/dialogueState.js` | NOTA D1: el juicio del 2026-08-12 revertido por escrito |
| `9d082ba` | `src/adi/oracle/narrationBlocks.js` | `composeSoloDatosConfusionMessage` (D2) |
| `dc93e6c` | `src/adi/oracle/answerViaOracle.js` | descarte de la ambigua desclasificada (D1) + candidato D2 en la rama solo-datos |
| `4de21d6` | `_probe_paso3_clarify.mjs` | probe A1-A3 (39/39) |
| `7f986a6` | `_clarify_reensena_gate.mjs` | blindaje permanente (17/17, suite 134→135) |
| `5df0f9a` | `_segunda_aclaracion_gate.mjs` | rótulos D1 (aserciones intactas) |
| `a35bae2` | `_reparacion_contextual_gate.mjs` | pin 1.3.0 + base de NARRAR 40152 (análisis en §4) |
| `(este archivo)` | `_INFORME_PASO_3.md` | el informe |

Nunca se usó `git add -A` ni `commit -a`. Los 4 archivos Falcon no aparecen en este worktree.

**Pendiente que queda para la certificación en vivo:** la calidad de la re-explicación (D1) y que el PLAN real, con la doctrina sin tocar de planPrompt, no sobre-produzca redirects ante confusión — la plomería ya lo absorbe si pasa, pero conviene mirarlo en los turnos medidos.
