# La garantía anti-vacío del camino natural

**Worker · rama `claude/jolly-saha-92d37f` · base `dev` = 2f4d83a · 2026-08-14 · commits locales, sin push.**

---

## La conclusión, primero

El hueco no estaba en el arnés: estaba en el muro. **`guardC("")` devolvía `{ok:true, verdict:"fiel"}`** — y
los **11 sitios** que llaman al muro leen `ok` como *«adoptá este texto»*. Un muro que aprueba el vacío le da
pase libre a la pantalla en blanco por cualquiera de esos once, no solo por el arnés.

Se cerró en el principio, no en el síntoma: **el muro trata la narración vacía como veredicto propio**
(`narracion-vacia`, bloqueante). Con eso, el brazo natural del arnés no necesitó una rama especial para el
vacío — una respuesta en blanco entra al ciclo de reparación por **la misma puerta que cualquier veto**, y si
vuelve en blanco responde el **suplente digno con las cifras verificadas** del negocio.

Elegí **(c)**: la opción (a) —el veredicto en `guardC`— **medida y ejecutada**, más la garantía del consumidor
como cinturón. El punto de freno de (a) **no se sostuvo al medirlo**: la premisa era que hay callers que hoy le
pasan texto vacío esperando `ok`, y no los hay. El detalle está abajo.

`npm run gates:offline` → **151 PASS · 0 FAIL · 0 TOCARON LA RED · 0 CON CREDENCIAL VIVA**.
`_constitucion_matriz_gate` **20/20**. `_garantia_anti_null_gate` **verde, 44 → 87 asserts**.
**Cero llamadas a proveedor.** El arnés de la corrida doble **no se corrió**.

---

## 1 · Qué medía antes, qué mide ahora, y por qué la métrica estaba inflada

### El defecto, reproducido

En la corrida del 2026-08-14, el brazo NATURAL, turno
*«reduce en 2 puntos las acciones comerciales de esos clientes y dime si quedan sobre el benchmark»*:

| campo | valor en `_corrida_doble.json` |
|---|---|
| `texto` | `""` |
| `estado` | `"reparado"` |
| `vetos` | `["cifra-no-autorizada"]` |
| `calls` | 2 |

El primer intento se vetó con razón. El segundo volvió **vacío**. El arnés se lo pasó a `guardC`, `guardC` no
encontró violaciones —una cadena vacía no afirma nada que cobrarle— y devolvió `ok`. El arnés leyó ese `ok`
como *«el modelo se corrigió»* y estampó **`reparado`**.

### La cuenta antes y después

El balance que imprimió esa corrida:

```
NATURAL: 26 llamadas · verde 1er intento 6/16 · reparados 7 · suplente 3 · errores 0
```

La cuenta real de esos mismos datos:

```
NATURAL: 26 llamadas · verde 1er intento 6/16 · reparados 6 · suplente 3 · VACÍAS 1 · errores 0
         censo del vacío: 1/16 turnos con una respuesta en blanco del modelo …
```

**Por qué estaba inflada, con precisión:** no es que el arnés contara de más. Es que la única categoría de
éxito parcial que tenía —`reparado`— se define como *«el segundo intento pasó el muro»*, y el muro aprobaba el
vacío. La pantalla en blanco entró por la definición de éxito, no por un error de conteo. Un 7 sobre 16 que en
realidad era 6, con el 7º siendo el peor resultado posible: nada.

> El mensaje del commit 2f4d83a **sí** nombraba el vacío en prosa («3 suplente + 1 respuesta VACIA»). Lo que
> estaba inflado era la **salida del arnés** — la línea que un lector futuro toma como la medición.

### Qué mide ahora

Estados **excluyentes** que suman el total: `verde · reparado · suplente · vacio · error`. `vacio` es
categoría propia — el turno terminó en el suplente digno porque el cerebro volvió en blanco.

Y una segunda línea, el **censo del vacío**, porque los estados excluyentes solos vuelven a esconder un caso:
el vacío que la reparación **sí** rescata queda clasificado `reparado`, que es correcto y a la vez incompleto.
El censo declara cuántos turnos vieron una pantalla en blanco en *algún* intento, cuántos se rescataron y
cuántos terminaron en suplente. En el transcript, cada turno lleva `vacias: [1|2]` y `suplenteDigno`.

### La prueba, con el modelo mockeado (cero red)

Corrí el **código real del arnés** —`armNatural`, el balance y la escritura del transcript, sin tocar una
línea— con `askNatural` reemplazado por un mock que devuelve `""`, espacios, `null`, solo puntuación, markdown
pelado y `undefined`, y con `armActual` en stub. Todo bajo el candado `scripts/offline-guard.mjs`:

```
NATURAL: 32 llamadas · verde 1er intento 0/16 · reparados 1 · suplente 0 · VACÍAS 15 · errores 0
         censo del vacío: 16/16 turnos con una respuesta en blanco del modelo (intentos vacíos: 31) ·
                          rescatados por la reparación 1 · terminados en suplente digno 15
         ✓ los 16 turnos salieron con texto
```

Ninguna respuesta vacía se reportó como buena. La única `reparado` es el turno donde el guion devolvió vacío
en el intento 1 y texto bueno en el 2 — y ahí el transcript igual deja `"vacias": [1]`, `"vetos":
["narracion-vacia"]`. Los archivos de ese ensayo se borraron; no quedan en el árbol.

> **Nota de conteo:** el set probatorio son **16** turnos, no 17. La cabecera del arnés y el mensaje del commit
> 2f4d83a decían 17; los 9 hilos suman 16 y el transcript de esa corrida trae 16 por brazo. Corregido en el
> código y contado por el gate, no a mano.

---

## 2 · Dónde vive la garantía de principio — recomendación y la medición completa

### La medición (el punto de freno de (a))

Instrumenté `guardC` para registrar **cada** invocación con texto en blanco, con su traza de llamada, y corrí
la suite completa. Es la censo empírico sobre todo lo que el proyecto ejercita.

**Universo:** 61 archivos `.mjs` de la raíz llaman a `guardC`, de los cuales **44 son gates de la suite**, más
los **11 sitios de producción** en `src/adi/oracle/answerViaOracle.js`.

**Resultado del censo — 151 gates corridos, 2 invocaciones con texto en blanco, 1 solo caller:**

| caller | qué pasa | ¿espera `ok`? | ¿se rompe con (a)? |
|---|---|---|---|
| `_amplitud_contexto_general_gate.mjs:167` (×2) | `""`, dentro de una batería de aditividad | **NO** | **NO** |

Ese único caller no lee `ok`: compara **dos veredictos entre sí** —
`JSON.stringify(guardC(t, BASE)) === JSON.stringify(guardC(t, sinPiezas))` — para certificar que las piezas
del bloque de contexto general son aditivas. Con el veredicto nuevo los dos lados devuelven el **mismo**
objeto, así que la aserción sigue pasando. Verificado en la corrida final: ese gate está en verde.

**Los 11 sitios de producción, uno por uno** (`src/adi/oracle/answerViaOracle.js`):

| línea | qué juzga | qué hace con `ok:true` | ¿puede llegarle vacío? |
|---|---|---|---|
| 1337 | `_composedBypassResult(text…)` | adopta `text` como LA respuesta del turno | **sí** — 22 callers; el de la línea 2292 arma el texto con `stripFiller(stripLanguageLeaks(…))`, un lavado que puede dejarlo en nada |
| 2598 | ruta determinística `det` | `narration = det` | sí — `truncateToBriefBudget` puede recortar a nada |
| 2728 | candidato de reparación | `narration = c` | sí (compositor) |
| 2873 | narración del modelo `n` | sigue a los chequeos | **no** — protegido por `!n.trim()` en 2872 y por `!n \|\| typeof n !== "string" \|\| !n.trim()` antes |
| 2901 · 2989 | escalera de reparación | `narration = c` | sí (compositor) |
| 3003 · 3010 | declinación / cobertura | `narration = …` | no (parten de `narration` no vacía) |
| 3029 | mensaje honesto de ausencia | `narration = c` | no (texto fijo) |
| 3094 · 3116 | recorte de conclusión / cuerpo | `narration = candidato` | sí — se arman partiendo y recortando el texto |

**En los 11, `ok` significa exactamente lo mismo: adoptá este texto.** Ninguno quiere `ok` para el vacío; seis
podrían recibirlo por un compositor o un lavado que se lleva todo. El pase libre era real, no teórico.

### La recomendación

**(c) = (a) medida y ejecutada, con (b) como cinturón.** El argumento:

1. **La premisa del freno no se sostuvo.** El riesgo declarado era «hay callers que le pasan vacío esperando
   `ok`». Medido: hay **uno**, y no espera `ok`. El costo de (a) resultó ser cero.
2. **(a) es la única que arregla el principio.** El defecto no es del arnés: es que la definición de *«pasó el
   muro»* admitía la nada. Con (b) —la garantía en cada consumidor— hay que acordarse en los 11 sitios de hoy
   y en cada uno que se agregue mañana, y el gate que los vigila persigue la lista para siempre. Eso es un
   contrato distribuido, que es la clase de arreglo que este proyecto ya pagó por hacer y rehacer.
3. **(a) no relaja nada, y no puede.** Es un veredicto **nuevo** que solo convierte un `ok` en bloqueo, nunca
   al revés. Los 26 chequeos quedan intactos y ven exactamente el mismo texto. La matriz de la constitución
   sigue 20/20, sin tocarla.
4. **(a) no puede crear un silencio nuevo.** El último recurso absoluto de la escalera anti-null
   (`composeNoDataMessage(null)`, answerViaOracle:3032) se adopta **sin veredicto**, por diseño. Que el muro
   empiece a bloquear el vacío no le quita el piso a nadie.
5. **El criterio es deliberadamente angosto:** vacía = *no hay una sola letra ni dígito*. Cubre `null`,
   `undefined`, `""`, espacios y el armazón que puede quedar tras el lavado (puntuación suelta, `**`, `---`,
   una tabla sin celdas). Cualquier respuesta real tiene al menos una letra, así que **no puede vetar prosa
   legítima**: no juzga contenido, juzga que *haya* contenido. Fijado por gate en las dos direcciones.

El cinturón (b) también está puesto, porque un muro no alcanza cuando el texto ni siquiera llega a él: el
ciclo del camino natural garantiza texto **por sí mismo**, y termina en el mismo genérico pelado aunque el
suplente que le pasen viniera vacío.

---

## 3 · Qué cambió

| archivo | cambio |
|---|---|
| `src/adi/oracle/guardC.js` | **+ `esNarracionVacia(texto)`** exportado (el predicado, una sola verdad) y **chequeo 0**: la narración vacía devuelve `{ok:false, verdict:"narracion-vacia"}`. Nada más se toca. |
| `src/adi/oracle/datoProyectado.js` | **+ `kpisDelNegocio(scenario)`** — las líneas de KPI de la proyección, verbatim (tercera vista del mismo recorrido que ya produce `texto` y `figs`). **+ `suplenteDignoDelDato({scenario, juzgar})`** — el suplente para un cerebro **sin boleta**: los KPIs verificados por el muro y, si el muro los vetara, el mismo `composeNoDataMessage(null)` del recurso absoluto. |
| `src/adi/oracle/cicloNotarial.js` **(nuevo)** | `responderConNotario({pedir, juzgar, suplente, lavar})` — el flujo que la constitución acordó para el camino natural (cerebro → notario → una devolución → suplente digno), **puro e inyectable**, con la garantía adentro: no puede devolver texto vacío. |
| `_corrida_doble.mjs` | `armNatural` delega el ciclo en `responderConNotario`; solo aporta el modelo real y el hilo de mensajes. Balance con `VACÍAS` como categoría propia + censo del vacío + verificación final. Transcript con `vacias` y `suplenteDigno`. Conteo corregido a 16 turnos. |
| `_corrida_doble_casos.mjs` **(nuevo)** | El set probatorio (9 hilos · 16 turnos), compartido entre el arnés y el gate. Mismo patrón que `_calibracion_casos.mjs`. |
| `_garantia_anti_null_gate.mjs` | **Extendido**, no duplicado: bloques [3]–[8]. 44 → **87** asserts. |

### Por qué un módulo nuevo, y por qué no es un contrato paralelo

`_corrida_doble.mjs` abre sockets y lee `.env` en su cuerpo de módulo: **no se puede importar desde un gate**,
así que mientras el ciclo viviera adentro, la garantía del brazo natural no tenía forma de quedar fijada. Un
arnés que solo se prueba a sí mismo no prueba nada. Sacar el ciclo a `cicloNotarial.js` hace que **el gate
ejercite exactamente el mismo código** que corre contra el modelo real — una implementación, cero divergencia.
No es un contrato nuevo: es el flujo que `_CONSTITUCION_ADI.md` ya declara («El flujo», puntos 1–4) y la
garantía anti-silencio que ya declara («si el cerebro falla dos veces, responde el suplente digno… la pantalla
nunca queda en blanco»), escritos una vez en vez de prototipados dentro de un script.

Lo mismo con `_corrida_doble_casos.mjs`: si el gate copiara los 16 turnos, el día que el arnés agregue un hilo
el gate seguiría certificando el viejo.

---

## 4 · El gate

`_garantia_anti_null_gate.mjs`, **extendido** (instrucción 4: no crear un gate hermano). Es la misma garantía
—*«nunca una pantalla en blanco»*—; lo que cambió es que el bloque original **dependía de un supuesto falso**:
que si algo llega vacío al muro, el muro lo frena.

| bloque | qué fija |
|---|---|
| [1] [2] | (originales, intactos) el caso E4 del espejo · matriz 8 planes × 4 alcances × 2 vetos |
| **[3]** | el muro bloquea las **6 formas** del vacío con kind propio · y el texto real sigue juzgándose igual (aditividad) · y el criterio es angosto (una letra o un dígito ya es contenido) |
| **[4]** | **camino ACTUAL**: el narrador devolviendo cada forma de vacío → la escalera responde igual |
| **[5]** | **camino NATURAL**: los **16 turnos** del set probatorio × las **6 formas** → texto siempre, estado `vacio` nunca `reparado`, suplente digno con cifras verificadas que pasa el mismo muro |
| **[6]** | el **lavado** que deja el texto en nada cuenta como vacío (incluido un lavador que devuelve `null`) |
| **[7]** | un vacío **rescatado** por la reparación queda registrado — no vuelve a esconderse en «reparado» |
| **[8]** | el **piso absoluto**: aunque el suplente viniera vacío (o no haya suplente), sale el genérico pelado |

---

## 5 · Verificación

```
151 PASS · 0 FAIL · 0 TOCARON LA RED · 0 CON CREDENCIAL VIVA (de 151 offline)
  ✓ _garantia_anti_null_gate.mjs      → 87 PASS · 0 FAIL   (baseline: 44)
  ✓ _constitucion_matriz_gate.mjs     → 20 PASS · 0 FAIL (de 20)
```

**Sobre el conteo de la suite: 151 → 151, y es lo correcto.** Ese número cuenta **archivos de gate**, no
aserciones. La instrucción 4 pedía extender en vez de duplicar, así que no hay archivo nuevo. Lo que subió es
el conteo interno del gate: **44 → 87**. La trampa del clasificador (un gate que se cae de la suite sin
ponerse rojo) queda descartada por otra vía, que es la que importa: `_garantia_anti_null_gate.mjs` **aparece
corrido y en ✓** en el resumen, y verifiqué a mano que no introduje ningún marcador LIVE ni en el gate ni en
`_corrida_doble_casos.mjs`.

**Sobre el gasto:** cero llamadas. El arnés de la corrida doble **no se ejecutó**. Todo lo que corrí fue
`npm run gates:offline` y dos ensayos con el modelo mockeado bajo `--import scripts/offline-guard.mjs`. En el
primer intento de ese ensayo un stub mío no aplicó y `armActual` intentó salir a la red: **el candado lo mató
antes de abrir el socket** (`exit 97`, `fetch() → api.anthropic.com` bloqueado). Sin gasto, y con la prueba de
que el cerrojo funciona.

---

## 6 · Lo que dejo anotado (no lo toqué)

1. **`estado: "suplente"` del brazo natural es un rótulo que miente.** Cuando los dos intentos vuelven con
   texto **vetado**, el arnés marca `suplente` pero **conserva el texto del modelo** — no compone ningún
   suplente. En la corrida del 2026-08-14 son 3 turnos así: lo que el transcript muestra como respuesta es
   texto que el notario rechazó. No lo cambié porque queda fuera del encargo y porque tocarlo altera lo que la
   corrida doble mide sobre la vía del veto, que es calibración del arquitecto. **Ahora es fácil:**
   `responderConNotario` ya recibe `suplente`; alcanza con llamarlo también en la rama `"suplente"`.
2. **El conteo del set era 17 y son 16** — cabecera del arnés y mensaje del commit 2f4d83a. Corregido en el
   código; el mensaje del commit ya está escrito y queda como está.
3. **`_corrida_doble.json` sigue siendo el transcript viejo** (el de la corrida pagada). No lo regeneré: eso
   exige plata. La próxima corrida autorizada lo escribirá con los campos nuevos.
4. **La garantía del camino natural existe pero el camino natural no está en producción.** `cicloNotarial.js`
   hoy solo lo usan el arnés y el gate. Es la pieza lista para cuando el flujo de la constitución se cablee.

---

## Candados respetados

- ✅ Cero llamadas a proveedor / gateway / red. El arnés de la corrida doble **no se corrió**.
- ✅ Gates solo por `npm run gates:offline` (líneas «0 TOCARON LA RED · 0 CON CREDENCIAL VIVA» textuales).
- ✅ No se tocó `_calibracion_casos.mjs` ni `_constitucion_matriz_gate.mjs`; la matriz sigue **20/20**.
- ✅ No se relajó ningún chequeo del muro: el chequeo 0 solo puede convertir un `ok` en bloqueo.
- ✅ No se tocó `numberGuard.js`, `entityGuard.js`, `_guard_gate.mjs`, `_evidence_spec_views_gate_entry.jsx`.
- ✅ No se tocó `toolRegistry.js`, `specRetrieval.js` ni `conversationScope.js` (worker paralelo).
- ✅ Sin `git add -A`, sin `commit -a`, sin `main`, sin push. Archivos agregados uno por uno.
