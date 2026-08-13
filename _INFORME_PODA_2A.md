# La Poda · Fase 2A — Se van las rutas muertas

**Rama** `claude/bold-chandrasekhar-1d1050`, sobre `dev`=8373074 · **2026-08-14** · commits locales, sin push · cero llamadas a proveedor, cero gasto.

## Conclusión

Se borraron las **cuatro** rutas muertas del encargo. Las cuatro se verificaron una por una antes de tocarlas, y **la verificación encontró algo que el inventario no había visto**: `composeCompareNotYet` seguía re-exportado desde `_conversation_gate.mjs`, así que borrarlo a ciegas —confiando en el "ninguno encontrado" del inventario— **habría puesto ese gate en rojo**. Está comprobado abajo con un probe, no supuesto.

- `npm run gates:offline` → **144 PASS · 0 FAIL · 0 TOCARON LA RED · 0 CON CREDENCIAL VIVA** (de 144 offline), exit 0.
- El conteo de gates que corren **subió de 143 a 144**: el candado nuevo entró a la suite, no quedó excluido en silencio por el clasificador.
- **−63 líneas de código ejecutable en `src/`** (+40 líneas netas de comentario que explican por qué ya no está).
- No se tocó `main`. No se tocó ninguno de los archivos vedados.

---

## 1 · Qué se borró, y con qué se verificó

El barrido base fue el mismo para los cuatro, sobre el worktree completo —`src/`, `api/`, `server.js`, los 206 gates de la raíz, los `.md`, los entries `.jsx` y los archivos ignorados por git— excluyendo solo `node_modules`:

```bash
rg -uu --no-heading -n "<símbolo>" -g '!node_modules' .
```

`-uu` es lo que hace que el barrido cuente: incluye lo que está en `.gitignore`, que es donde viven los bundles y las copias sueltas. Sobre eso, cada símbolo llevó su verificación propia.

### 1.1 `composeFromLedger` — `src/adi/oracle/narrationBlocks.js:170`

La reparación tabular vieja: tabla de hasta 12 filas, o «La prioridad: …» bajo `action_only`.

**Verificado:**
- Cero callers en `src/`. El motor importa de `narrationBlocks.js` doce símbolos (`answerViaOracle.js:26`) y `composeFromLedger` **no está entre ellos**; las seis reparaciones vivas llaman a `componerPorForma`.
- `componerPorForma` **no delega** en él: arma la tabla con su propio `_tabla` (leído, no inferido).
- Los tres únicos importadores de `narrationBlocks.js` en `src/` son `answerViaOracle.js`, `dialogueState.js` (solo `parseBlocks`) y `guardC.js` (solo `rangoContextoGeneral`).
- `api/`, `server.js` y `src/ui/`: cero referencias.

**Lo que quedó:** las cuatro funciones que él usaba para decidir —`_isEntityAttributed`, `_bestByMagnitude`, `_findSupuestoContext`, `_formatSupuestoLine`— **siguen vivas**, porque `componerPorForma` las ejecuta. Se borró el compositor, no su criterio. Verificado con `rg -n "_findSupuestoContext|_formatSupuestoLine|_bestByMagnitude|_isEntityAttributed" src/`.

### 1.2 `composeCompareNotYet` — `src/adi/conversation.js:366`

El placeholder V1 («la comparación llega en el próximo paso»), superado por `composeCompare` desde 2026-07-06. Traía un `eslint-disable no-unused-vars` encima, que es la firma de una ruta muerta.

**Verificado:** cero callers en `src/`, `api/`, `server.js`. **Pero** aparecía dos veces en `_conversation_gate.mjs` — ver §2, es la corrección más importante de este informe.

### 1.3 `repairField` + los ocho `REPAIR_FIELDS[].pregunta` — `src/adi/oracle/conversationalContract.js:186`

**Verificado:**
- `rg -uu -n "REPAIR_FIELDS|camposQueSobreviven|_repairByKey"` → `repairField()` no tiene un solo caller; el único consumidor real de la tabla es `camposQueSobreviven`, que lee el índice `_repairByKey` directo.
- `rg -uu -n "\.pregunta\b"` → los 15 lectores de `.pregunta` que hay en el repo leen **`reparacion.pregunta`** (la que redacta PLAN), que es otra cosa y está viva. **Ninguno** lee la fila de `REPAIR_FIELDS`.
- `composePrecisionQuestion` (`conversationScope.js:401`), que es la red determinística real de la pregunta de precisión, no importa `REPAIR_FIELDS`.
- `_reparacion_contextual_gate.mjs` sí importa `REPAIR_FIELDS`, pero solo lee `f.conserva` (línea 88) — no se rompe.

**Lo que quedó:** la matriz `conserva`, intacta. Era el punto fino del encargo y se respetó.

### 1.4 `_HeroInicioLegacy` — `src/ui/ChatADI.jsx:788`

**Verificado:** definición única, cero montajes (`<HeroInicio />` en la línea 1001 es el hero nuevo). `HERO_CHIPS` y `_SPEC` **no se tocaron**: `GuiaInicio.jsx` deriva sus ejemplos de `HERO_CHIPS` por texto exacto, y `_SPEC` sigue armando dos de esos chips. Se fue el render viejo, no la fuente.

---

## 2 · Donde mi verificación contradijo al inventario

**Esta sección es el motivo por el que la regla era verificar antes de borrar.**

### 2.1 El inventario habría roto un gate (`composeCompareNotYet`)

El inventario dice: *"no encontré caller: grep en todo src/ solo devuelve su definición"*. Es cierto **para `src/`** — y por eso mismo se le escapó lo que estaba afuera:

```
_conversation_gate.mjs:10  'export { …, composeCompareNotYet, … } from "./src/adi/conversation.js";'
_conversation_gate.mjs:21  const { …, composeCompareNotYet, … } = M;
```

Ese gate arma un entry temporal y lo bundlea con esbuild. El símbolo se re-exportaba y se desestructuraba, pero **ninguna aserción lo llamaba nunca**. Probado offline con un probe (`esbuild.build` sobre un entry que re-exporta el símbolo ya borrado):

```
RESULTADO: esbuild LANZA → Build failed with 1 error:
_probe_reexport.tmp.js:1:31: ERROR: No matching export in "src/adi/conversation.js" for import "composeCompareNotYet"
```

Con `logLevel:"silent"`, ese throw revienta el gate entero antes de la primera aserción. **Un borrado a ciegas sobre la evidencia del inventario dejaba `_conversation_gate.mjs` en rojo, y el rojo no habría dicho «falta un símbolo»: habría dicho que el gate del parse conversacional falla.** Se sacó el re-export junto con la definición.

### 2.2 A `composeFromLedger` lo usaban CUATRO gates, no dos

El inventario dice: *"sigue exportado porque **dos gates vivos** lo importan"* y nombra `_concordancia_semantica_gate.mjs` y `_response_preference_gate.mjs`. El barrido `-uu` encontró **cuatro**, con llamada real:

| Gate | Llamadas | ¿Corre en `gates:offline`? |
|---|---|---|
| `_concordancia_semantica_gate.mjs` | :300 | Sí |
| `_reparacion_pipeline_gate.mjs` | :48, :113, :120 | Sí (escape `@inyeccion-simulada`) |
| `_response_preference_gate.mjs` | :247 | **No — clasificado LIVE** (`handlePlan`) |
| `_response_contract_parte2_gate.mjs` | :140, :148 | **No — clasificado LIVE** (`callPlan`/`callNarrate`) |

`_reparacion_pipeline_gate.mjs` no figura en el inventario y **es uno de los que sí corren**. Los cuatro se migraron (§3).

### 2.3 El inventario cuenta `composeFromLedger` dos veces

Aparece como dos entradas distintas (líneas 18 y 33 del inventario), con evidencia distinta y el mismo archivo y la misma línea. Las **"6 muertas"** del resumen son en realidad **5 rutas distintas**, de las cuales una —el bypass sin pago— no es residuo sino dormancia deliberada (§4). Podables de verdad: **4**. Es exactamente lo que se podó.

### 2.4 Una evidencia citada apunta a un archivo que no existe

El inventario cita `_guia_inicio_gate_bundle.mjs:44577+` como caller. Ese archivo **no está en el repo** (`ls` → no existe, y tampoco aparece en el barrido `-uu`): es un bundle temporal que un gate escribe y borra en la misma corrida. No cambia la conclusión —sigue siendo un arnés, no producción—, pero como evidencia no es verificable hoy.

---

## 3 · Los gates que se movieron, y por qué

La regla del encargo era: si un gate lo usa, **no es muerto para efectos de borrado** — hay que decidir y explicar. La decisión fue **migrar los cuatro**, y el criterio para no aflojar nada fue mirar, en cada uno, si la aserción probaba **comportamiento vivo** o **la existencia del símbolo**.

Ninguno de los cuatro probaba la existencia de `composeFromLedger`. Los cuatro lo usaban como *stand-in de la composición determinística del motor* — que hoy es `componerPorForma`. Es decir: **estaban probando una forma que producción ya no sirve**. Migrarlos no relaja la prueba, la vuelve verdadera.

| Gate | Qué probaba de verdad | Migración | Equivalencia |
|---|---|---|---|
| `_concordancia_semantica_gate.mjs` | Que bajo `data_only` la respuesta lleve dato + período + alcance y pase `guardC` | `componerPorForma({figs, contentScope:"data_only"})` | El motor bajo `data_only` compone **una oración**, no una tabla. La aserción (entidad + `$` presentes) se cumple igual, y ahora sobre la forma que el usuario recibe. Se corrigió el rótulo de la aserción («las cifras» → «la cifra»), que había quedado describiendo la tabla vieja |
| `_reparacion_pipeline_gate.mjs` | Costo real de un turno de corrección (cuántas llamadas) y qué memoria ve el narrador. El compositor es el **narrador simulado**, no el objeto de la prueba | `componerPorForma({figs, contentScope:"full", forma:"tabla"})` vía un helper local | El gate exige que el turno base componga una **tabla** (si compusiera prosa, el turno siguiente repetiría un tramo verbatim y `guardC` lo marcaría «degradado» por un artefacto del arnés). `forma:"tabla"` lo pide explícito en vez de heredarlo. Verde en la corrida |
| `_response_preference_gate.mjs` §9 | Que bajo `action_only` la prioridad **nunca** sea un subtotal ni un KPI sin entidad | `componerPorForma({figs, contentScope:"action_only"})` | Byte-idéntico: los dos emiten `La prioridad: label (value).` y eligen con las **mismas dos funciones** (`_isEntityAttributed` + `_bestByMagnitude`), que siguen en el archivo |
| `_response_contract_parte2_gate.mjs` GAP 3 | Que una simulación bajo `results_only` **nunca** oculte el supuesto | `componerPorForma({figs, contentScope:"results_only"})` | Byte-idéntico: los dos arman la misma tabla y la misma línea `Supuesto: …` con `_findSupuestoContext` + `_formatSupuestoLine` |

**Lo que NO pude verificar corriendo, y lo digo:** los dos últimos están clasificados **LIVE** — `_response_preference_gate.mjs` importa `gatewayCore`, `_response_contract_parte2_gate.mjs` nombra las dos pasadas del oráculo. `gates:offline` no los corre, y correrlos exige `npm run gates`, que gasta. **Su migración está razonada línea por línea, no ejecutada.** Si no se migraban, quedaban rotos en el import el día que el owner corra la suite paga: dejarlos así era peor que migrarlos sin poder correrlos.

También se actualizaron rótulos y comentarios que afirmaban en **presente** que la respuesta «sale de `composeFromLedger`» (en `_solo_acento_gate.mjs`, `_simulate_general_gate.mjs` y los dos de arriba) y once comentarios de `src/` que lo nombraban como el mecanismo vigente. Es corrección de documentación, no de conducta.

---

## 4 · Qué NO se borró, contra el inventario

**`bypassConfianza` / `puedeResponderSinPagar`** (`src/ui/ChatADI.jsx:351`, `src/adi/bypassConfianza.js`) — el inventario lo adjudica **muerto**. **No se tocó**, por instrucción del encargo y porque la lectura correcta es otra: no es residuo, es **dormancia deliberada** gateada por `ADI_BYPASS_SIN_PAGO`, con una decisión del owner pendiente (41% de las preguntas se responderían con cero llamadas). Es inalcanzable hoy, no muerto. El candado nuevo lo deja **anotado en verde** para que el próximo que lea el inventario no lo confunda con algo que quedó a medias.

**`src/adi/specRetrieval.js:2186` y `:2374`** siguen nombrando a `composeFromLedger` en dos comentarios. **Archivo vedado** (worker paralelo). Son referencias a un símbolo que ya no existe: quedan para el arquitecto o para quien cierre el otro frente.

**Residuo declarado.** Siete gates conservan menciones históricas del símbolo en sus cabeceras («agotaba los 3 intentos y caía a `composeFromLedger`»): `_repair_decision_clarify_gate.mjs`, `_forma_manda_sobre_el_alcance_gate.mjs`, `_guardc_repetition_degraded_gate.mjs`, `_definicion_alcance_restringido_gate.mjs`, `_count_authorized_gate.mjs`, `_extremo_y_total_sin_falsos_positivos_gate.mjs` y el propio `narrationBlocks.js`. Son relatos en pasado de por qué el mecanismo de hoy es como es, y son ciertos. No se tocaron a propósito: un barrido cosmético sobre siete arneses vivos no es riesgo bajo, y borrar la memoria del repo tiene su propio costo.

---

## 5 · El candado anti-resurrección

`_poda_anti_resurreccion_gate.mjs` — **31 aserciones, 0 FAIL**, dentro de `gates:offline` (verificado: el conteo pasó de 143 a 144, no quedó excluido por el clasificador). No importa un solo módulo del producto: lee archivos como texto.

Es **por lista explícita de nombres**, y está documentado por qué. No existe forma honesta de detectar «código muerto en general» sin falsos positivos —una función sin caller hoy puede ser el entrypoint de mañana—; lo que sí se puede afirmar sin ambigüedad es que estos cuatro nombres fueron adjudicados, verificados y borrados, así que su reaparición es un hecho comprobable. Agregar un nombre a la lista es una decisión humana, igual que borrarlo lo fue.

Cinco cosas verifica, y las dos últimas son las que lo separan de un grep:

1. **Definición, no mención.** El scan corre sobre el código **con los comentarios quitados** y busca solo formas de *definir o exportar* (`function`, `const/let/var`, `class`, `export {…}`, `export default function`, `propiedad: function`). Sin esto, los comentarios históricos de §4 lo pondrían rojo el primer día y el candado terminaría borrándose por molesto.
2. **Ni un import colgando**, en todo el repo (`src/` + `api/` + `server.js` + los 206 arneses de la raíz), no solo en `src/`. Es justo la clase de hallazgo de §2.1: un import huérfano no revienta al compilar, revienta al enlazar.
3. **Lo que los reemplazó sigue vivo.** Un candado que solo mira ausencias se queda verde el día que alguien borra las dos piezas. Por cada podado se exige que su sucesor (`componerPorForma`, `composeCompare`, `camposQueSobreviven`, `HeroInicio`) siga definido donde el motor lo importa.
4. **El detector se prueba a sí mismo.** Un candado que nunca vio rojo no es un candado: doce controles le pasan fuentes sintéticas donde el símbolo **sí** está definido (tiene que detectarlas: 7 formas) y donde solo está **nombrado** en comentario, string, regex o template literal (no puede detectarlas: 5 formas). Si esa sección falla, todo lo de abajo es decorativo — y lo dice en el archivo.
5. **`REPAIR_FIELDS` no vuelve a cargar sus `pregunta`**, y en el mismo movimiento **cada fila conserva su `conserva`** — sin eso, borrar la tabla entera pasaría en verde.

**Su límite, declarado:** el quitador de comentarios es un tokenizador simple (respeta strings, template literals y literales de regex, pero puede equivocarse en expresiones exóticas). Si se equivocara, deja de más o de menos *texto de comentario*; **no puede inventar una definición donde no la hay**, porque las formas que busca exigen palabras clave reales. Y no detecta una resurrección con **otro nombre** —eso ningún gate lo puede hacer—: detecta que estos cuatro no vuelvan.

---

## 6 · Los números

| | Código ejecutable | Comentario |
|---|---|---|
| `src/` | **−63** (−71 / +8) | +34 |
| Arneses de la raíz | +1 (−22 / +23, puros renombres) | +23 |
| **Total del diff** | **−62** | +40 |

Desglose de lo borrado: `_HeroInicioLegacy` −39 · `composeFromLedger` −16 · `composeCompareNotYet` −7 · los ocho `pregunta:` −1 neto (las filas se reescribieron sin el campo) · `repairField` −1.

El neto de comentario es **positivo a propósito**: cada borrado dejó en su lugar la razón por la que se fue y qué hace hoy ese trabajo. Un símbolo que desaparece sin explicación vuelve.

**Archivos tocados (15 + 1 nuevo).** Ninguno de los vedados: `numberGuard.js`, `entityGuard.js`, `_guard_gate.mjs`, `_evidence_spec_views_gate_entry.jsx`, `specRetrieval.js`, `dialogueState.js`, `progressiveDisclosure.js` quedaron intactos. Todo se agregó archivo por archivo — ni un `git add -A`, ni un `commit -a`.

## 7 · Lo que queda para el arquitecto

1. **Los dos gates LIVE migrados no se corrieron** (§3). Se verifican en la próxima `npm run gates` autorizada.
2. **`specRetrieval.js`** conserva dos comentarios que nombran el símbolo borrado (§4) — archivo del worker paralelo.
3. **El inventario de la Fase 1 tiene cuatro correcciones** (§2): un caller que faltaba y que habría roto un gate, dos gates de más para `composeFromLedger`, una ruta contada dos veces, y una evidencia que apunta a un archivo que no existe. Vale revisarlas antes de usar el mismo inventario para las 27 rutas de «legado en uso», donde el costo de un dato así es bastante más alto que acá.
