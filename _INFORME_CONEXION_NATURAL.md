# Informe · La conexión del camino natural como principal

**2026-08-14 · rama `claude/goofy-sutherland-c3a9a5` (fast-forward a dev=6632753 antes de empezar) · commits locales, sin push.**

## Conclusión primero

El camino natural quedó conectado como principal, detrás del flag `ADI_CAMINO_NATURAL` (ON en dev y prod,
OFF en el piso de gates), con caída automática al camino actual ante cualquier error, y con el camino actual
**sin un byte tocado**. La suite offline pasó **156 PASS · 0 FAIL · 0 TOCARON LA RED · 0 CON CREDENCIAL VIVA**
(subió de 155: el gate nuevo corre adentro), la matriz de la constitución sigue **33/33**, y el probe del
adapter (extendido con el modo natural) dio **19/19** bajo el candado offline. Queda listo para la prueba de
humo en vivo del arquitecto.

Hay **un hallazgo que no toqué y que el arquitecto debe mirar** (sección «Lo que frené»): con dos textos
vetados no-vacíos, el ciclo notarial deja el **segundo texto vetado** en pantalla (estado `suplente`,
`aprobado:false`) — no invoca al suplente digno, que solo entra ante el vacío. Es el comportamiento MEDIDO de
la corrida doble y `cicloNotarial` está en la lista de NO TOCAR, así que lo cableé tal cual y lo reporto.

## El cableado, archivo por archivo

### Nuevos
- **`src/adi/oracle/naturalPrompt.js`** — `buildNaturalSystemSegments(persona, datoNegocio, memBlock)` →
  `{fijo, variable}`. `fijo` = persona + carpeta + doctrina del notario + contrato `[[CALCULO]]`; `variable` =
  el bloque de memoria de interacción. La doctrina y el contrato son **byte por byte** los del `SYSTEM_NATURAL`
  de `_corrida_doble.mjs` (condición 3: el gate los compara contra el propio archivo del arnés, no contra una
  copia). El fijo es byte-estable por tenant+escenario → mismo corte de caché que PLAN/NARRAR.
- **`src/adi/oracle/caminoNatural.js`** — `answerViaNatural({text, history, mem, scenario, callNatural})` →
  `{r, mem}`. Puro, sin red, sin gateway: el cerebro entra por `callNatural`. Hace exactamente lo del
  `armNatural` medido: criteria primero (el único bypass conservado) · contexto del notario (cifrasDelDato +
  axisEntityNames 3/6 ejes + parseFigures de los turnos del USUARIO + `alcanceHeredadoDe` sobre
  `mem.recentNarrations[0]` + `mem.recitaAprobada`) · `responderConNotario` con `stripLanguageLeaks` de lavador
  y `suplenteDignoDelDato` de suplente (el ciclo NO se reimplementó: se le inyectan las piezas) · pantalla con
  `extraerCalculos(...).limpio` + `stripAllMarks` · memoria (`recentNarrations` con el texto limpio;
  `recitaAprobada` SOLO si `aprobado:true`, cap 24 del propio `recitaAprobadaDe`) · `r.route="natural"` +
  `r.natural = {estado, vetos, vacias, suplenteDigno, reparaciones, calculosDeclarados}` (condición 5, campos
  expuestos, cero telemetría nueva).
- **`_camino_natural_conexion_gate.mjs`** — 45 asserts, `@inyeccion-simulada` (cerebro = función local, cero
  red). Fija: flag OFF en floor / ON en prod y dev / rollback de una línea · doctrina byte-idéntica al arnés ·
  verde/reparado/suplente/vacío con `[[CALCULO]]` jamás visible en NINGUNO · alcance heredado desde
  `mem.recentNarrations` con la multa como turno del NOTARIO · texto vetado no presta re-cita · criteria
  byte-idéntico al camino actual y sin llamar al cerebro · el fallo del gateway lanza (y el candado estático
  verifica que en ChatADI el catch cae al oráculo) · candados estáticos sobre ChatADI/gateway/adapters.

### Modificados
- **`src/adi/llm/gatewayCore.js`** — `handleNarrateC` acepta `payload.modoNatural` + `payload.mensajes`:
  frena con error TIPADO si faltan mensajes o falta `datoNegocio` (el cliente lanza y cae al camino actual), y
  arma el system natural segmentado `[{fijo,cache:true},{variable,cache:false}]` con
  `renderInteractionMemory(mem)` en el variable. **Sin `modoNatural`, el system y todo el handler son
  byte-idénticos a hoy** (misma telemetría, mismo router de modelo, mismos frenos — nada se duplicó).
- **`src/adi/llm/adapters/anthropic.js`** — PUNTO DE FRENO del encargo verificado: el adapter NO soportaba
  messages múltiples (narrate mandaba un único mensaje user con el payload serializado). Se extendió el cuerpo
  puro `buildNarrateBody`: con `modoNatural` + `mensajes` válidos (roles user/assistant, contents no vacíos,
  usuario al final) manda el hilo como `messages`; en cualquier otro caso el body es **byte-igual al de
  siempre**. Timeout, errores tipados (429/`rate_limited`), `usage`/`cachedTokens` y el corte de caché no se
  tocaron: todo fluye por el mismo `_call`. Probado con `_probe_anthropic_adapter` (A2.e nuevo, 19/19, corrido
  con `node --import ./scripts/offline-guard.mjs` — cero red posible).
- **`src/adi/llm/adapters/openai.js`** — el mismo contrato, barato: bajo `modoNatural` el hilo va tras el
  mensaje system; sin el modo, byte-idéntico.
- **`src/config/voiceFlags.js` + `src/config/flagProfile.js`** — `ADI_CAMINO_NATURAL = P("ADI_CAMINO_NATURAL")`
  (patrón de ADI_BYPASS_SIN_PAGO) + la línea en FEATURE → ON en demo/prod/dev, OFF en floor (gates byte-exactos).
  **Apagarlo en todas partes = borrar UNA línea de FEATURE.**
- **`src/ui/ChatADI.jsx`** — dentro del bloque del oráculo (después de `responderPorQueCifra` y de la cesión al
  P&L, que quedaron como estaban), `if (ADI_CAMINO_NATURAL)` intenta `answerViaNatural` con `_fetchNatural`
  (el MISMO endpoint `/api/adi-narrate-c`, `payload.modoNatural`, `datoNegocio` con la misma proyección
  memoizada). Éxito → `_turnFromResult(..., "natural")` con la memoria persistida. **Cualquier excepción →
  `catch` → el turno sigue por `answerViaOracle`, en el mismo turno** (red de resiliencia, condición 2).
  A diferencia de `_fetchNarrateC`, `_fetchNatural` NO lanza ante narración vacía: el vacío es un veredicto del
  ciclo (`narracion-vacia`), no un error de transporte.
- **`_probe_anthropic_adapter.mjs`** — sección A2.e (modo natural + candados de no-regresión del body).

## Qué verifiqué de cada supuesto del encargo

| Supuesto | Verificación |
|---|---|
| `_corrida_doble.mjs` es el prototipo con `armNatural`/`SYSTEM_NATURAL` | Leído entero; el flujo productizado es el suyo (mismas fuentes de contexto, mismo mensaje del NOTARIO textual, mismo lavador y suplente). |
| `responderConNotario` ya hace el ciclo y no hay que reimplementarlo | Confirmado (cicloNotarial.js, puro e inyectable, gateado por `_garantia_anti_null_gate` y `_alcance_heredado_natural_gate`). Solo se le inyectan piezas. |
| `alcanceHeredadoDe` con `mem.recentNarrations[0]` | Confirmado que `recentNarrations` YA existe (answerViaOracle la escribe, ventana de 2). El gate prueba el veto `alcance-heredado-cambiado` alimentado desde esa memoria. |
| `recitaAprobadaDe` con cap 24 y solo `aprobado:true` | Confirmado en cicloNotarial (cap default 24; `aprobado` lo devuelve el ciclo). Persistida en `mem.recitaAprobada`; `applyMemoryUpdate` la preserva (spread de `base` primero). |
| `extraerCalculos(texto).limpio` existe | Confirmado (narrationBlocks.js, gateado por `_contrato_calculo_gate`). Se aplica en TODOS los estados + `stripAllMarks` de red. |
| criteria en answerViaOracle ~línea 1502 | Está en ~1561; replicado con los MISMOS imports (`detectCriteriaIntent`/`composeCriteria`/`envejecerPendingSimulation`/`withOfertaPendiente`) y el mismo retorno. El gate prueba byte-igualdad entre rutas. |
| ChatADI ~línea 379 llama a answerViaOracle | Confirmado (línea ~407 hoy); la rama natural quedó dentro del mismo `if (_oracleOn() && !detectPnlIntent(q))`, después de armar `requestContext`. |
| El adapter podría no soportar messages múltiples | NO los soportaba — extendido como pide el freno (ver arriba) y probado offline. |
| `handleNarrateC` acepta campos nuevos sin tocar wrappers | Confirmado: los wrappers enrutаn por `GATEWAY_ROUTES` y pasan el body entero; no hizo falta tocar server.js/api/. |

## El mapa: qué quedó en cada camino

- **Camino natural (flag ON)** — el turno libre: cerebro único con el hilo completo → notario con contexto
  natural → una reparación → suplente digno → pantalla limpia. Con la memoria de criterio como único bypass
  (persiste en el motor ANTES del cerebro, respuesta byte-idéntica a la actual).
- **Interceptores (ANTES del camino, sin tocar)** — `responderPorQueCifra` (procedencia de una cifra ya
  sellada) · la cesión al P&L guiado (`detectPnlIntent`) · el bypass sin pago (`ADI_BYPASS_SIN_PAGO`, sigue
  apagado). Son features con estado propio, no narración.
- **Camino actual (entero, sin tocar)** — flag OFF: todo, byte-idéntico · flag ON: la red de resiliencia (el
  natural lanza → answerViaOracle responde el mismo turno) · y las capacidades que el natural v1 no tiene
  (tools, serie mensual): el natural las declara como límite — MEDIDO que declina bien; no se le agregó
  ninguna herramienta (decisión del encargo).

## Qué frené / decisiones que el arquitecto debe conocer

1. **HALLAZGO — el estado `suplente` deja el texto VETADO en pantalla.** En `responderConNotario`, cuando los
   dos intentos vuelven vetados pero NO vacíos, `texto` queda siendo el segundo borrador vetado (estado
   `suplente`, `aprobado:false` — no presta cifras, ese candado sí está). El suplente digno solo entra ante el
   VACÍO. La constitución dice «reincide → suplente digno», pero este es el comportamiento MEDIDO de la corrida
   (H4/H9: los transcripts muestran el texto vetado como salida) y `cicloNotarial` está en NO TOCAR — así que
   **no lo cambié**. Si el owner quiere que «reincide» también invoque al suplente digno, es un cambio de una
   rama en cicloNotarial + su gate, con su decisión.
2. **La re-cita se alimenta del texto LIMPIO, no del crudo.** El arnés le pasaba `r.texto` crudo (con el bloque
   `[[CALCULO]]` adentro) a `recitaAprobadaDe`; acá le paso el texto que el usuario VIO (sin bloque). Razón: la
   regla del owner dice «cifras que ADI ya MOSTRÓ y el muro aprobó» — una cifra que solo vivió dentro del bloque
   nunca se mostró. Las cifras del bloque normalmente duplican las de la prosa, así que en la práctica es lo
   mismo; lo declaro porque es la única divergencia consciente con el arnés.
3. **El bypass de criteria conserva su identidad** (`route:"oracle"`, `deterministic:true`, mismo texto): es el
   MISMO bypass conservado, no un turno del cerebro — así flag ON/OFF responden idéntico y el gate lo fija.
   Nota menor: answerViaOracle filtra el pendiente por su regex interna de abandono antes de envejecerlo; esa
   regex no es exportada y una frase de criteria no la matchea, así que el resultado es el mismo.
4. **El natural v1 no escribe `lastOffer`/`conversationScope`** (solo `recentNarrations` y `recitaAprobada`,
   como pide el encargo: cero memoria nueva, cero reglas nuevas). El cerebro natural ve el hilo completo y
   resuelve las aceptaciones por contexto — es lo que la corrida midió. Si un hilo alterna natural → actual
   (por la red de resiliencia), el camino actual verá el `conversationScope` de su último turno propio; lo
   anoto como límite conocido de la transición, no lo «arreglé» porque sería una política nueva.
5. **Cero política de «calcular directo vs pedir confirmación»** (condición 3 textual del owner): no agregué
   ninguna doctrina; el system es el del arnés, byte por byte, y el gate lo compara contra el propio arnés.
6. **Un solo caso borde propio**: si el cerebro escribe SOLO el bloque `[[CALCULO]]` (prosa vacía tras la
   limpieza), sale el MISMO piso absoluto del ciclo (`composeNoDataMessage(null)`), nunca una pantalla en
   blanco ni el bloque. No es una regla nueva: es la garantía anti-vacío existente aplicada al texto visible.

## Evidencia

- `npm run gates:offline` → **156 PASS · 0 FAIL · 0 TOCARON LA RED · 0 CON CREDENCIAL VIVA (de 156 offline)**
  — el conteo subió de 155 a 156 y `_camino_natural_conexion_gate.mjs` aparece corrido (45/45).
- `_constitucion_matriz_gate`: **33 PASS · 0 FAIL (de 33)** — intacta.
- Todos los gates del camino actual: verdes (el camino no se tocó; los candados estáticos del gate nuevo
  además fijan que `answerViaNatural` vive SOLO dentro del flag y antes del oráculo).
- `_probe_anthropic_adapter` bajo `offline-guard`: **19 PASS · 0 FAIL** (incluye A2.e modo natural + candados
  de no-regresión del body de narrate).
- CERO llamadas a proveedores/gateway/red en toda la sesión (todo mockeado o bajo el candado).

## Para la prueba de humo en vivo (arquitecto)

Flag ya ON en dev. Qué mirar por turno: `r.route === "natural"` y `r.natural` (`estado`, `vetos`, `vacias`,
`suplenteDigno`, `reparaciones`, `calculosDeclarados`) en el objeto de respuesta; en la telemetría del gateway,
los reintentos naturales viajan con `attempt:1` y `motivoReintento` = el primer veredicto de la multa. Para
probar la red de resiliencia en vivo: apagar el gateway (o quitar `LLM_PROVIDER`) y verificar que el turno
responde igual por el camino actual, sin error visible. Rollback: borrar `"ADI_CAMINO_NATURAL",` de FEATURE en
`flagProfile.js`.
