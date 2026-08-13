# Informe · Cierre de la certificación amplia — 4 arreglos de motor (2026-08-13)

**Base:** dev = `81638bf` (la certificación amplia corrió ahí). **Evidencia:** `_cert_amplia_openai.ABCD.json` y
`_cert_amplia_openai.EFGH.json` (leídos completos antes de tocar nada). **Todo offline:** cero llamadas a proveedor;
probes bajo `node --import ./scripts/offline-guard.mjs`; suite solo por `npm run gates:offline`.

**Suite antes:** `140 PASS · 0 FAIL · 0 TOCARON LA RED · 0 CON CREDENCIAL VIVA`
**Suite después:** `141 PASS · 0 FAIL · 0 TOCARON LA RED · 0 CON CREDENCIAL VIVA` (el +1 es el gate nuevo del cierre)

---

## Arreglo 1 · El compositor de respaldo compone digno (hallazgo 1, el central)

### El diagnóstico: POR QUÉ la forma degradó en B1 (la investigación pedida)

En la cert #2 (pre-amplitud) «dame el margen por cliente» narró una tabla de 8 filas porque **el narrador libre
acertó**. En la amplia, con el dato completo, mini citó cifras que el muro vetó 3 veces (`repaired: true` en el
transcript) y el turno cayó al **camino de reparación** — y ahí está la regresión, que no es de la amplitud sino
del 2026-08-12: cuando la reparación empezó a **respetar la forma pedida** (owner, punto 3), `componerPorForma`
reemplazó a `composeFromLedger` en ese camino. `composeFromLedger` imprimía SIEMPRE una tabla; el AUTO nuevo de
`componerPorForma` compone SIEMPRE la prosa qué-pasa/por-qué/qué-hacer, **sin mirar la forma del ledger**. Una
pregunta de eje («por cliente») cuya boleta trae N filas de la misma métrica ES una tabla — la oración-líder +
choclo en línea es la misma información en la peor forma. La forma no la pidió mal el usuario ni la decidió mal
`resolveOutputForm` (correctamente `auto`): la perdió el compositor de emergencia al mapear `auto` → prosa fija.

El **ancla** era el segundo defecto, independiente: `_bestByMagnitude(pedidas)` — y para una métrica de tasa la
magnitud mayor es el margen MÁS ALTO, es decir la entidad **menos** urgente (Ripley 25.0%). El hallazgo clave de
la investigación: **la boleta de `marginRead` ya llega ordenada peor-brecha-primero** (`composeSpecMargin`
bajo_benchmark: `below` ordenado por `benchmark − margen` desc, `pushMarginFigs(below)`, y su propio titular es
`below[0]` — «El más lejos del piso es…»). O sea: el ranking correcto ya estaba SELLADO en el orden del ledger, y
`_bestByMagnitude` elegía exactamente el ÚLTIMO de ese ranking. El criterio de los composers reales no había que
copiarlo — había que **leerlo**.

### Qué cambió

- `src/adi/oracle/narrationBlocks.js`
  - `_ejeCompletoDeMetrica` / `_segmentoMetrica` (~:290): detección estructural del eje completo — la métrica que
    la pregunta nombra (el léxico determinístico de siempre, `metricaLabels`) tiene ≥4 figs con entidades
    distintas. Red angosta: sin métrica nombrada, o con <4 entidades, nada cambia.
  - Ancla (~:335): `top = pedidas.length ? pedidas[0] : (topEfecto || topMagnitud)` — la PRIMERA fig de la métrica
    pedida en el orden del ledger (= el ranking sellado por la tool: peor brecha si hay referencia, mayor magnitud
    si el ranking es de magnitud). `topEfecto`: sin métrica nombrada y CON supuesto declarado (reparación de
    simulación, el caso E4), ancla la primera fig `source:"computed"` — el EFECTO, no un insumo. La justificación
    del «Por dónde partir» dice el criterio verdadero en las tres ramas (la del 3b intacta byte a byte).
  - Rama AUTO (~:400): eje completo → tabla `| Cliente | Margen |` con las filas EN EL ORDEN del ledger (jamás
    re-rankeadas: `_sealedOrderBroken` de guardC compara contra el orden sellado), + resto autorizado + honestidad
    causal + «por dónde partir».
- `src/adi/oracle/responsePreference.js:42` — `_REDUCCION_LARGO` acepta el adjetivo intensificador: «en una
  **sola** frase» (G6 medido) resuelve `solo_conclusion`. Lookahead «de» intacta («línea de crédito» no dispara).

### Salida (reproducción exacta de B1, probe [1])

```
| Cliente | Margen |
|---|---:|
| Lider | 21.5% |
| Falabella | 22.0% |
| Sodimac | 23.5% |
… (12 filas)

El resto de lo autorizado en este turno: Medida · cerrar brecha al piso: $4.9M · …

Por dónde partir: Lider · Margen, que es la métrica por la que preguntaste. (Datos del año cerrado.)
```

### Decisiones no obvias

- **Se descartó anclar en la fig `mandatory`** (mi primer intento para E4): los perfiles enriquecidos traen figs
  mandatory laterales («exceso de acciones comerciales») y el ancla rompía la garantía 3b de «dame Sodimac» →
  Ventas (lo cazó el propio probe). El criterio quedó acotado a reparaciones CON supuesto (fig computed).
- G6 («resúmeme TODO en una sola frase») mejora por la vía de FORMA (una línea), no por el ancla: su ledger es un
  perfil de una entidad, no un eje.

## Arreglo 2 · Las razones de la calculadora hablan en palabras de usuario (hallazgo 3)

**Diagnóstico:** `coverage.reason` de `calcular` es texto de pantalla (`composeNoDataMessage` lo cita verbatim) y
las razones venían del contrato interno (`ejecutarCalculo` → aridad/unidades con nombres de operación y conteos).
La misma familia del Paso 2. Además el PLAN eligió `escalar` para «¿y si mi venta subiera 10%?» — y el catálogo
**no tenía** ninguna operación que compute monto×(1+%): `escalar` rechaza `%` a propósito (cierra «venta×margen»).

**Qué cambió:**
- `src/adi/oracle/calculoCatalogo.js:109` — operación nueva `variacion_aplicada` (monto $ × tasa %) → `delta` y
  `proyectado`, cada uno con su fórmula declarada. Entra por la puerta que D1 dejó abierta (catálogo cerrado
  AMPLIABLE con gate). **El PLAN no la conoce** (prompts intactos): solo la resuelve el rescate.
- `src/adi/oracle/toolRegistry.js` (~:1027) — (a) `_razonCalcEnPalabras`: traducción EN LA FRONTERA de la tool
  (las razones internas de `calculoCatalogo` quedan intactas y precisas); regla verificable por gate: sin
  `/\w_\w/`, sin nombres de operación del catálogo, sin «insumos». (b) rescate determinístico: operación que no
  calza + exactamente UN monto del dato + UNA tasa DEL USUARIO con procedencia (el pool incluye `objetivo`, el
  canal donde el plan medido dejó el 10%; jamás entra a la ejecución de otra operación) → `variacion_aplicada`,
  sellada como hipótesis (`conCifraDeUsuario` → `ensureHypothesisFraming`), con `facts.operacionPedida` trazable.
  (c) los reasons de `_resolverInsumoCalc` también en registro (JSON, camelCase y voseo fuera).
- `_amplitud_calculadora_gate.mjs` — la lista exacta de operaciones se movió POR SU PROPIO punto de ampliación
  declarado («una operación futura = una entrada + sus casos bidireccionales ACÁ»); casos nuevos adentro.

**Decisiones no obvias:**
- **El muro NO espeja el `proyectado`** — y esto fue MEDIDO, no elegido a priori: mi primer intento agregó
  `monto×(1+%)` a `esCalculoDelCatalogo` y `_amplitud_dato_narrador_gate` se puso rojo en una GARANTÍA («la misma
  cifra con dueño equivocado → veto»): con la densidad real del dato (F1 §7.1: 134 montos, tolerancia money 2%),
  la expresión colisionaba con cifras ajenas y las autorizaba. Se revirtió: los resultados del rescate SIEMPRE
  llegan sellados en la boleta (el muro los autoriza por la vía de siempre); un narrador que haga esa cuenta por
  su cuenta se veta y repara — conservador a propósito, documentado en el propio código y en el gate F2.
- Una tasa DEL DATO (margen, carga) jamás se rescata — «venta × margen» disfrazado sigue cerrado (probe [5]).
- Con más de un monto candidato, la razón ES la pregunta («¿sobre cuál lo aplico?») — el patrón supuestos_faltantes.

## Arreglo 3 · Registro (hallazgo 4)

- **(a) `src/adi/llm/voiceGuard.js:104`** — bigrama `capital|inventario (total)? detenido(s)` → «inmovilizado»,
  DESPUÉS de dormido→detenido (encadena en la misma pasada). El VERBO sobre SKU/proceso queda intacto («se detuvo
  el SKU», «MAK-COMP-AIR está detenido» — H3/H4 legítimos). Verificado además que el texto reescrito sigue
  pasando guardC con la boleta real de diagnose (label histórico «Capital detenido · subtotal») — probe [3].
- **(b) `src/adi/oracle/narratePromptC.js:496`** — el doble cierre de B2 diagnosticado: el narrador escribió ÉL
  MISMO «(Datos del año cerrado.)» después de su pregunta guía → `ensurePeriodoDeclared` fue no-op (período ya
  declarado) → `ensureClarifyClosingQuestion` no veía el «?» final (tapado por el paréntesis) y agregaba la
  genérica. Ahora el cierre se evalúa sobre el núcleo sin los paréntesis finales sin pregunta. El caso sin
  pregunta sigue ganando la suya (garantía original intacta).
- **(c) «meta de 30.1%» (G1) NO se tocó** — es vocabulario del MODELO (el motor jamás emite «meta» por el
  benchmark; un regex barrería falsos positivos con la meta real de carga). **Va al espejo Anthropic**: si Sonnet
  también confunde benchmark≠meta, será doctrina.

**Gates movidos (formato, documentado en cada uno):** `_voice_gate` L12/L16 y `_registro_gate` (una muestra
«limpia») fijaban el registro VIEJO — «capital detenido» como destino del barrido de dormido y como muestra
correcta. CLAUDE.md §4 manda «inmovilizado»; las garantías (dormido jamás sale, number-safe, idempotencia) quedan
intactas y se agregaron los casos del bigrama y del verbo-de-SKU intacto.

**Anotado, fuera de alcance:** el camino LEGACY del motor tiene ~20 literales determinísticos con «capital
detenido» (answerADIFromSpec, composers, contractCloser, etlg) que no pasan por voiceGuard. El camino del oráculo
queda limpio; el barrido legacy es un encargo aparte si el owner lo pide.

## Arreglo 4 · «El nuestro» no hereda la entidad del hilo (hallazgo 2, la parte de motor)

**Diagnóstico:** la doctrina «del negocio nunca hereda entidad» existe en el prompt del PLAN (REGLA DE ALCANCE:
el modelo emite `scope.level="global"`) — pero es doctrina del MODELO, y «el nuestro» sin la palabra «negocio» no
la disparó: el PLAN heredó Falabella del hilo y `resolveConversationReference` la respetó («PLAN ya lo resolvió
bien por comprensión»). No existía ningún piso determinístico para el posesivo de negocio.

**Qué cambió:** `src/adi/oracle/answerViaOracle.js` (~:660) — `_coerceAlcanceNegocio`, aplicado ANTES de la
resolución deíctica (mismo patrón y precedencia que `_coerceMode`/`_coercePref`): marcadores de posesivo de
NEGOCIO («el nuestro», «nuestro margen/venta/…», «del negocio», «de mi negocio», «en general», «en total») →
`scope.level="global"` + limpieza de los anclajes de entidad heredados en las calls (filters de eje, entityScope,
entity opcional). Con el scope global, `updateConversationScope` retira el tema-entidad a history (cartera queda
como tema — verificado en probe) y las etapas de entityScope no re-inyectan nada. Trazado como
`alcance-negocio(global)` en `retryTrace.coerciones`.

**Los tres candados de la red angosta (documentados en el código):**
1. Marcadores enumerados, jamás una regla gramatical.
2. Si el texto del turno NOMBRA una entidad que también está en las calls («¿cuánto le vendí a Falabella en
   total?»), no se toca nada — el usuario ancló él mismo.
3. Una call cuyo contrato EXIGE entidad (entityProfile/entityRecord/compareEntities/…) no se fuerza — falso
   negativo antes que una call inválida. El caso medido (marginRead, filtro opcional) queda cubierto.

**Documentado (pedido del encargo):** «¿y el nuestro?» comparando dos clientes del hilo **no existe como caso** —
en este producto el usuario es el dueño y sus contrapartes son clientes: un posesivo de primera persona plural
nunca nombra a un cliente. «Nuestro» ES el negocio del usuario.

## Lo que va al espejo Anthropic (NO tocado, a propósito)

Los hallazgos probablemente-del-modelo se RE-MIDEN con Sonnet antes de tocar motor:
- **rep=true masivo en turnos ricos** (dueño-en-oración inconsistente con el dato completo) — el arreglo 1 hace
  digno el paracaídas; si Sonnet no gatilla los vetos, el paracaídas casi no se abre.
- **Bloque [[CONTEXTO_GENERAL]] jamás usado** en 35 turnos (mini ignora la doctrina F3 — F1 «¿es normal para el
  rubro?» era la ocasión).
- **«meta de 30.1%»** (benchmark≠meta) y **portuñol** («aprofundizáramos», B2).
- **G5** (inyección): seguro pero descolocado — el bypass de criterio contestó otra cosa.

## Aceptación

- **A1** ✓ probe `_probe_cert_cierre_a1.mjs` 18/18 (B1 reproducido con boleta real de marginRead + 3 rechazos →
  tabla con margen protagonista; ancla = peor brecha; G6 en una línea; E4 ancla el efecto; 3b intacto).
- **A2** ✓ probe `_probe_cert_cierre_a2.mjs` 25/25 (E5 exacto rescatado como hipótesis O declinación que pregunta
  la variable; regla de registro en 8 familias de declinación; unidades/universos conservan honestidad).
- **A3** ✓ probe `_probe_cert_cierre_a3.mjs` 19/19 (bigramas barridos + «se detuvo el SKU» intacto + guardC pasa
  el texto reescrito + UNA pregunta de cierre + el caso sin pregunta gana la suya).
- **A4** ✓ probe `_probe_cert_cierre_a4.mjs` 9/9 («el nuestro» → global con el hilo anclado a Falabella; «¿y
  Lider?» hereda; candados 2 y 3).
- **A5** ✓ suite 140 → **141 PASS · 0 FAIL · 0 TOCARON LA RED · 0 CON CREDENCIAL VIVA**. Gates movidos, todos con
  análisis garantía-vs-formato escrito EN el gate: `_amplitud_calculadora_gate` (ampliación declarada del
  catálogo + el muro deliberadamente conservador), `_voice_gate` (L12/L16 fijaban el registro viejo),
  `_registro_gate` (muestra limpia en registro viejo). `_amplitud_dato_narrador_gate` se puso rojo DURANTE el
  desarrollo (garantía) y se resolvió revirtiendo mi espejo del muro, no moviendo el gate.
- **A6** ✓ `guardC.js` sin una línea tocada · `planPrompt.js`/doctrina/prompts intactos · archivos Falcon
  intactos · `_cert_vivo_openai.mjs`/`_cert_amplia_openai.mjs` ni corridos ni tocados.

## Commits (sobre 81638bf, rama `claude/affectionate-snyder-eb04ef`, NO pusheado)

- `bcc5aaa` El respaldo compone digno: el eje completo se tabula y el ancla lee el ranking sellado
- `d494209` La calculadora habla en palabras de usuario y rescata la proyeccion inequivoca
- `da6206d` Registro: inmovilizado (solo el bigrama) y una sola pregunta de cierre
- `20b1886` «El nuestro» es el negocio: el posesivo de negocio no hereda la entidad del hilo
- `34d6249` Los cuatro arreglos del cierre entran a la suite: 140 se vuelven 141
- (este informe: commit siguiente)
