# El voseo fuera del camino vigente — la clase cerrada, y por qué sobrevivió con dos gates en verde

**Worktree** sobre `dev` = `9d7bfa0` · commits locales SIN push · `npm run gates:offline`: **148 PASS · 0 FAIL · 0 TOCARON LA RED · 0 CON CREDENCIAL VIVA**.

---

## 1. Conclusión primero

La frase de la captura ya sale en registro formal:

> «…¿Sobre qué cliente, SKU, marca o familia **quieres** simular este escenario?»

Se corrigieron **48 textos de salida** en 15 archivos del camino vigente. El barrido no fue una lista: fue un detector
corrido sobre **10.984 literales** de 21 archivos, y encontró **12 sitios que el grep del encargo no nombraba**.

**Lo que importa más que los 48 sitios:** el defecto no pasó porque nadie mirara voseo. Pasó porque **había TRES
listas de formas voseantes** —`_registro_gate`, `_registro_boleta_gate` y `voiceGuard._VOSEO`—, las tres incompletas
y ninguna con las mismas entradas. Los dos gates estaban en **verde** el día de la captura. Ahora la lista es **una
sola** (`detectVoseo`, en `voiceGuard`) y los dos gates la consumen.

---

## 2. El defecto de la captura

`src/adi/oracle/answerViaOracle.js:1473` — bypass de simulación sin entidad. Sale **verbatim**, sin narrador y sin
pasar por `stripLanguageLeaks`. Corregido.

**Por qué ningún gate lo vio.** `_registro_boleta_gate` (Poda 2B) audita labels de boleta, dos textos verbatim, el
glosario y la Mesa — esta frase no es ninguno de esos. `_registro_gate` audita el seam **legado** y los `.jsx`. La
frase vive inline en el oráculo: tierra de nadie. Y aunque la hubieran barrido, la lista de `_registro_boleta_gate`
sí traía `quer[eé]s`… pero no `referís`, `liberás`, `entregás`, `recuperás`, `quedás`, `retenés` ni `concedés`, que
son las vecinas que encontró este barrido.

---

## 3. Sitios corregidos (48)

### Oráculo — bypasses que responden el turno sin narrador (13)
| Archivo | Antes → después |
|---|---|
| `answerViaOracle.js:1473` | «querés simular» → **quieres simular** ← *la captura* |
| `answerViaOracle.js:877, 1169` | «¿cuánto esperás que cambie…?» → **esperas** (2 sitios, 4 redacciones) |
| `answerViaOracle.js:1607` | «Si querés, te muestro» → **Si quieres** |
| `answerViaOracle.js:1611` | «te referís… ¿Cuáles querés» → **te refieres… ¿Cuáles quieres** |
| `dialogueState.js:300-301` | «te referís… Decime… Contame qué querés» → **te refieres… Dime… Cuéntame qué quieres** |
| `dialogueState.js:320-321` | «¿querés que simule… o preferís…?» · «¿Cuál preferís?» → **quieres / prefieres** |
| `dialogueState.js:385` | «¿A cuál te referís?» → **te refieres** |
| `conversationScope.js:877, 879` | «te referís — decime» · «¿A cuál te referís?» → **te refieres — dime** |
| `conversationScope.js:884-886` | 3× «Decime… te referís» → **Dime… te refieres** |

### Tools (4)
`toolContracts.js:715` «lo querés, decímelo» → **lo quieres, dímelo** · `toolContracts.js:709` «Decime con cuáles» →
**Dime con cuáles** *(no estaba en el encargo)* · `toolRegistry.js:789` «probá un rango» → **prueba** ·
`toolRegistry.js:1042` «decime de dónde sale» → **dime**.

> `toolRegistry.js:1032` ya declaraba en un comentario que esos `razon` son «texto de pantalla … **sin voseo**». La
> línea 1042 violaba la invariante que su propia función se había escrito. Llegan a pantalla verbatim vía
> `narrationBlocks.js:716`.

### Respaldo determinístico — `specRetrieval.js` (7)
`recuperás`→**recuperas** (733, 1387) · `priorizá`→**prioriza** (1217) · `corregís`→**corriges** (1265) ·
`Bajá el costo`→**Baja** (2430, sugerencia) · `liquidá`→**liquida** (936) · `reponé`→**repón** (982) ·
`medí el punto`→**mide** (2011).

### Sentrix (10)
`mesa.js` «Si liberás»→**liberas**, `askLabel:"Armame el plan"`→**Ármame** · `mesaCapital.js` «Si liberás»→**liberas**,
2× «Si reponés»→**repones** · `glossary.js` (definiciones servidas verbatim por `defineConcept`) «quedás»→**quedas**,
«retenés»→**retienes**, «concedés»→**concedes** · `resumenComercial.js` 2× «entregás»→**entregas**,
2× «Empezá por»→**Empieza por**, «que vendés»→**vendes**.

### UI vigente (14 + 22 tooltips)
`SentrixPanel.jsx`: «elegí una entidad»→**elige**, 2× «Elegí un cliente»→**Elige**, «ADI · elegí un camino»→**elige**,
«lo que entregás»→**entregas**, «liberás ese capital»→**liberas**, «sumá Costo»→**suma**, «marcá la estrella»→**marca**,
2× chip «Olvidá el X»→**Olvida el X**, y **22× tooltip «Preguntale a ADI»→«Pregúntale a ADI»** ·
`ChatADI.jsx:1051`: «abrí la Mesa… seguí el hilo»→**abre… sigue** · `GuiaInicio.jsx:208`: «Preguntale algo de tu
negocio»→**Pregúntale** · `AccessGate.jsx`: «revisá… pedí uno nuevo»→**revisa… pide**, «lo emitís»→**lo emites**,
«Pedí una extensión»→**Pide**, «Probá de nuevo»→**Prueba**.

**Los 12 que el encargo no nombraba** (el barrido propio los encontró): `toolContracts:709` · `specRetrieval` 936,
982, 2011, 2430 · `mesa.js` askLabel · `resumenComercial` ×2 «Empezá» · `SentrixPanel` «marcá», «Elegí un cliente»,
tooltips «Preguntale» · `GuiaInicio` «Preguntale» · `AccessGate` «Pedí/Probá».

---

## 4. Sitios RESPETADOS a propósito

### 4.1 Vocabulario de ENTRADA — sigue aceptando voseo
La regla del owner es sobre lo que ADI **dice**, nunca sobre lo que **entiende** (mismo principio que las
`etiquetas` del glosario en la Poda 2B). **Intactos:**
`progressiveDisclosure.js:671` `_PEDIDO_DATO_RE` («decime|mostrame») · `coerceChain.js:278` `_CONTINUE_RE` ·
`criteria.js:116,127` («olvid[aá]», «record[aá]», «fijate») · `answerViaOracle.js:538` `_PIDE_SUMAR_RE`, `:599`
`_SEGUIMIENTO_VERB_RE`, `:718` `_PREF_DATA_ONLY_RE`, `:1017` `_PELADA_OK` («poneme», «ponele», «dale») ·
`router.js:2503,2512` («no podes calcular») · `routerData.js:132` («mostrame erosion comercial») ·
`responsePreference.js:97` `_DATO_PELADO` · `pnl.js:427,630`.

> **Verificado antes de tocar cada chip:** el chip «Olvida el margen mínimo» sigue entendiéndose porque
> `criteria.js:116` matchea `/olvid[aá]/` — las dos formas. Cambiar el rótulo no rompe el parseo.

### 4.2 Prompts internos — texto PARA el modelo
No se tocaron: `planPrompt.js` · `persona.js` · `narratePromptC.js` · `conversationalContract.js` (whenToUse/narrate) ·
`progressiveDisclosure.js` (instrucciones) · `responsePreference.js` · `datoProyectado.js` (el dossier del dato) ·
`contractMenu.js` · `specTool.js` · `guardC.js` (los `violations[].detail` van al `repairSpec` del reintento, no a
pantalla).

**🔎 Corrección al encargo — `dialogueState.js:289` NO es pantalla.** El encargo lo listaba como sitio de salida
(«podés retomar»). Leído el código, vive en `buildOrientacionInstruction`, y `answerViaOracle.js:2496` dice textual:
*«su único consumidor es el payload de NARRAR»*. Es una **instrucción al narrador**, redactada en voseo como el
resto de los prompts. **No se tocó**, y queda como una de las 3 exenciones declaradas del gate nuevo.

### 4.3 Camino legado — se migra aparte
`answerADIFromSpec` · `composers/*` · `conversation.js` · `intentLayer` · `smartGuide` · `honestFallback` ·
`d0Cascade` · `qiRetrieval`.

**Un residual quedó declarado y contado:** `contracts/contractCloser.js:87` («recuperás margen sin resignar venta»).
Su único importador es `answerADIFromSpec.js`. Al pasar `_registro_gate` al detector completo, apareció; corregirlo
sería tocar el camino excluido. Está en `LEGADO_VOSEO_DECLARADO` con un check que **se pone rojo si la lista crece
o si queda huérfana**.

### 4.4 Comentarios de código
No son pantalla; quedan en voseo. Excepción: se actualizó **una** cita en `toolContracts.js:545` que reproducía
verbatim un texto que sí cambié — un comentario que cita mal la salida es documentación falsa.

---

## 5. El candado

### 5.1 Una sola lista (la corrección de raíz)
`src/adi/llm/voiceGuard.js` — nuevo `detectVoseo(texto)` + `VOSEO_FORMAS` (**247 entradas**). Vive ahí porque
`voiceGuard` ya es la autoridad de voseo del repo (tiene el stripper de runtime). `_registro_gate` y
`_registro_boleta_gate` borraron sus listas propias y ahora lo consumen. **Sumar una forma es tocar un archivo.**

Dos niveles, por la ambigüedad del español:
- **Nivel 1 · inequívoco.** Tilde obligatoria salvo donde la forma pelada no existe («querés», «referís»). Sin ese
  cuidado el detector marcaría «marcas», «entregas», «retenes», «necesitas» — prosa correcta.
- **Nivel 2 · imperativo en `-í` sólo en posición de orden.** «pedí/elegí/seguí/abrí» son orden **y** pretérito de
  primera. Se exige complemento detrás y ningún clítico delante: caza «abrí la Mesa» (salió a pantalla) y deja pasar
  «me dejaste sin la tabla que te pedí».

Sin lookbehind, como el resto del archivo (Safari viejo de invitados mobile).

### 5.2 `_registro_boleta_gate.mjs` extendido — 2.607 → **13.677 PASS · 0 FAIL**
- **[2b] Compositores de bypass** — 17 llamadas: `composeOrphanAcceptance`, `composeVagueOfferAcceptance`,
  `composeSubjectAmbiguity`, `composeReferenceAmbiguity`, `composeReferenceDecline`, `composeVacioPorEje`,
  `composeVacioPorCardinalidad`, `composeMultiEntityUnsupported`, `composeCardinalityExceeded`,
  `composeFanOutCapped`, `composeDimensionUnsupported` — **cada rama con sus argumentos** (con entidad y sin
  entidad devuelven textos distintos). Cada uno con un check de que no devolvió vacío: un compositor mudo dejaría
  el gate barriendo aire.
- **[2c] Barrido estático de literales** — **10.984 literales en 21 archivos** del camino vigente. Un mini-scanner
  saltea **comentarios** (voseo legítimo) y **literales de regex** (voseo deliberado de entrada). Necesario porque
  la frase de la captura vive **inline** en `answerViaOracle` y no la devuelve ningún compositor exportado: un gate
  que sólo ejercita ramas audita lo que su matriz supo disparar.
- **[2d] El detector no puede encogerse** — 36 formas **medidas en pantalla en este barrido** deben seguir
  cazándose, + **14 controles de falso positivo** (condicionales «recuperarías», futuros «verás/podrás»,
  «Las marcas del período», «Pásame el número», «yo pedí el dato ayer»).

Verificado que el clasificador **no lo excluye**: 0 tokens `callPlan|callNarrate|handlePlan|fetch(|gatewayCore`.

### 5.3 Alcance de [2c]: voseo sí, `VETADAS` no — y por qué
El barrido estático usa `checkVoseo`, **no** `check`. Al leer *todo* literal apareció una clase distinta:
**~16 literales con «detenido» y uno con «vara» en `specRetrieval.js`** que ningún gate auditaba. Son hallazgos
reales (§7), pero pertenecen a la clase de la **Poda 2B**, donde el renombre de `vara` está **frenado esperando al
owner**. Meterlos acá habría abierto en silencio una decisión de producto ajena a este pase.

---

## 6. Gates movidos — análisis comportamiento vs. formato

| Gate | Qué se movió | Veredicto |
|---|---|---|
| `_dialogue_state_gate:350` | `/contame\|qué querés revisar/` → acepta **las dos** formas | **FORMATO.** Prueba que *pide precisión activamente*, no cómo se conjuga. Atarlo a una redacción lo vuelve test de ortografía. |
| `_resumen_comercial_gate:438` | `/lo que le entregás/` → `entreg[aá]s` | **FORMATO.** Prueba que la lectura *nombra lo que se entrega y su carga*. |
| `_resumen_comercial_ui_gate:839` | `"Elegí un cliente"` → `/(?:Elegí\|Elige) un cliente/` | **FORMATO.** Prueba que *la cara Ficha rinde su selector*. |
| `_voice_gate:94` | esperado `«…recuperás $194K»` → `«…recuperas $194K»` | **FORMATO, con matiz honesto.** L6 prueba *preservación de mayúscula inicial* («If»→«Si»), y eso no cambió. Lo que cambió es incidental: la fixture **afirmaba que «recuperás» sobrevivía al lavado**, porque esa forma no estaba en `_VOSEO`. Ahora sí está. El esperado se actualizó a la garantía nueva, más fuerte. |
| `_registro_gate` | lista propia → `detectVoseo`; + `LEGADO_VOSEO_DECLARADO` | **GARANTÍA REFORZADA** (detector más ancho) **+ una carve-out declarada** del camino legado, con check de tamaño y de orfandad. |

Ningún gate se aflojó para pasar. Los cuatro primeros ya no dependen de una conjugación; el quinto exige más que antes.

---

## 7. Lo que encontré y NO toqué — para el arquitecto

1. **🔴 El stripper de runtime cubre menos que el detector.** Medido: de **316 variantes**, `stripLanguageLeaks`
   neutraliza **150** en prosa neutra y **10** sólo en posición de orden (gateado a propósito) — quedan **~156 que
   no conoce**, entre ellas `entendés`, `ponés`, `resolvés`, `subís`, `abrís`, `pedís`, y **todos los enclíticos**
   (`avisame`, `hablame`, `armame`, `pasame`, `quedate`, `contanos`). **Qué significa:** un literal con esas formas
   lo caza el gate, pero **si el narrador las escribe libre, salen a pantalla sin lavar** — y los prompts que lo
   guían están en voseo a propósito. Agregué al stripper las **15 formas** que este barrido midió en literales
   reales (`referís`, `liberás`, `entregás`, `recuperás`, `quedás`, `retenés`, `concedés`, `reponés`, `emitís`,
   `corregís`, `priorizás`, `declarás`, `marcás`, `ejecutás`, `confirmás`, + `elegí` a la red con contexto).
   Cerrar las ~156 restantes **cambia la narración viva de todos los turnos**: es decisión tuya, no de este pase.
   *Camino sugerido: una red morfológica para `-ás` con las exclusiones de siempre (futuros en `-rás`, «estás»,
   «jamás», «quizás», «además», topónimos), igual a la que ya existe para `-á`. Cubriría ~42 de un saque.*

2. **«detenido» y «vara» en `specRetrieval.js`.** ~16 literales con «detenido» (ej. «El capital detenido en
   detalle», «¿Dónde está detenido mi capital?», «Qué SKU detenidos libero») y uno con «vara» («de clientes están
   bajo la vara»). CLAUDE.md §4 fija **inmovilizado**. Ningún gate los auditaba; los vio el barrido nuevo. **No los
   toqué**: son la clase de la Poda 2B y `vara` está frenada esperando tu decisión. Para activarlos, `[2c]` sólo
   necesita usar `check` en vez de `checkVoseo` — está documentado en el gate.

3. **`mesa.js:202` sigue diciendo «capital detenido»** en el mismo texto donde corregí «liberás». Mismo caso que (2).

4. **`ChatADI.jsx:1051` dice «fija tu vara»** en el tip de primer uso — palabra prohibida por el sello ejecutivo,
   en la UI vigente, y `_registro_gate` no la caza porque «vara» no está en su `BANNED`. Corregí el voseo de esa
   línea; la palabra la dejé por lo mismo que (2).

5. **El scanner de literales no ve texto JSX.** `«Elegí un cliente»` y `«Preguntale algo de tu negocio»` son nodos
   de texto JSX, no strings entrecomillados: `[2c]` no los ve. **Los caza `_registro_gate`**, que barre los `.jsx`
   en crudo — las dos cobertutas son complementarias y así quedó documentado. Si mañana se agrega un `.jsx` al
   producto, hay que sumarlo a la lista de `_registro_gate`, no sólo a la de `[2c]`.

6. **Ningún eco de prompt a pantalla detectado.** Busqué el caso que pedías reportar (texto de prompt que se ecoe
   al usuario): no encontré ninguno. `buildOrientacionInstruction` viaja en el payload de NARRAR y el narrador
   redacta a partir de él, no lo copia.

---

## 8. Verificación

```bash
npm run gates:offline
```

- **148 PASS · 0 FAIL** · **0 TOCARON LA RED · 0 CON CREDENCIAL VIVA** (líneas textuales).
- `_registro_boleta_gate`: **2.607 → 13.677 PASS** (677 figs · 10.984 literales · 17 compositores · 50 checks de
  detector). No lo excluyó el clasificador (verificado: 0 tokens de red).
- Barrido final de verificación: **0 formas de voseo** en literales de salida del camino vigente y **0** en el
  crudo de los 6 `.jsx` vigentes. Los únicos 3 restantes son las exenciones declaradas de
  `buildOrientacionInstruction` (prompt, §4.2).
- **No se tocó ni commiteó** `numberGuard.js`, `entityGuard.js`, `_guard_gate.mjs`, `_evidence_spec_views_gate_entry.jsx`.
  Sin `git add -A`, sin `commit -a`, sin push, `main` intacto.
