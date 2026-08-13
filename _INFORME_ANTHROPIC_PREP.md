# INFORME · Preparación del motor para Anthropic (sesión worker, 2026-08-13)

Encargo: arquitecto (sesión Falcon-heredero) · decisión de proveedor del owner (2026-08-13) · alcance
ESTRICTO: preparar el motor SIN encenderlo — todo queda INERTE hasta que las variables de entorno se
cambien en el deploy. Base: `dev` = `82de087` (incluye Pasos 0-2) · worktree `compassionate-fermi-1bb074`,
commits locales SIN push (los autoriza el arquitecto) · 100% offline: cero llamadas a proveedor por diseño
(este encargo tocó EL módulo que llama al proveedor; ninguna verificación invocó `parse()`/`narrate()` —
solo se construyeron y compararon cuerpos/args), toda verificación con `npm run gates:offline` y probes
bajo `scripts/offline-guard.mjs`.

La decisión que se implementa (owner 2026-08-13): proveedor Anthropic, DOS modelos exactos —
PLAN=`claude-haiku-4-5` ($1/$5 por MTok) · NARRAR=`claude-sonnet-5` ($3/$15 de LISTA; el intro $2/$10
expira 2026-08-31 y la tabla tarifa costos reales). El reintento tras rechazo de guardC se queda en
Sonnet: NO hay tercer tier. `claude-opus-5` ($5/$25) queda TARIFADO como escalón futuro de certificación,
sin cablear a nada.

---

## 1 · Qué cambió, archivo por archivo

| Archivo | Qué cambió |
|---|---|
| `src/adi/llm/modelPricing.js` (líneas 34-42) | **TAREA 1**: entran `claude-haiku-4-5` {in:1.00, out:5.00}, `claude-sonnet-5` {in:3.00, out:15.00} y `claude-opus-5` {in:5.00, out:25.00}, con el porqué del precio de lista documentado en la tabla. **Ninguna regla nueva de lookup**: la forma fechada real de Haiku (`claude-haiku-4-5-20251001`) resuelve por `_SUFIJO_DE_SNAPSHOT` (ya aceptaba `\d{8}` compacto, además de `\d{4}-\d{2}-\d{2}` y `-latest`) — la MISMA regla que ya servía a `gpt-4o-mini-2024-07-18`. El header del archivo (alias exacto + snapshot, JAMÁS prefijo libre) se respetó: `claude-haiku-4-5-turbo` sigue quedando SIN precio. |
| `src/adi/llm/adapters/anthropic.js` (líneas 25-31, 81-102, 135, 151) | **TAREA 2**: el `max_tokens` de `narrate()` pasa de 1024 fijo a `LLM_NARRATE_MAX_TOKENS` con default **2048** (leída POR LLAMADA, no al importar — el override por deploy no depende del orden de carga). El de `parse()` NO se tocó: sigue 1024 fijo. Además, la construcción de los dos bodies se extrajo a funciones puras exportadas `buildParseBody`/`buildNarrateBody` que `parse()`/`narrate()` consumen — el patrón providerConfig: lo que no se puede ejercer sin gastar se separa de lo que sí, y el probe compara los objetos byte a byte sin llamar a nadie. La razón del 2048 está documentada en el código (estilo del archivo: la razón, no la mecánica). |
| `src/adi/llm/modelDefaults.js` (NUEVO, módulo puro sin imports) | **TAREA 3**: `resolverModelos(env, proveedor) → {model, narrateModel}`. Con `proveedor="anthropic"`: `LLM_MODEL_PARSE \|\| ANTHROPIC_MODEL \|\| "claude-haiku-4-5"` para parse y `LLM_MODEL_NARRATE \|\| ANTHROPIC_MODEL \|\| "claude-sonnet-5"` para narrar — `OPENAI_MODEL` NO entra a esa rama (un sobrante del deploy openai ya no puede viajar a la API de Anthropic). Con openai/stubs/sin proveedor: la cadena de SIEMPRE, byte-igual (`LLM_MODEL_PARSE \|\| OPENAI_MODEL \|\| ANTHROPIC_MODEL \|\| "gpt-4o-mini"`, narrar hereda de parse). Es módulo propio por la trampa documentada en la memoria del proyecto: un gate/probe que importa gatewayCore queda LIVE y no corre offline — acá la decisión se EJERCE de verdad. |
| `src/adi/llm/gatewayCore.js` (líneas 16, 36-48) | **TAREA 3 (cableado)**: `_config` consume `resolverModelos(e, proveedor)`; no queda ningún default de modelo escrito a mano en el gateway. El freno de `LLM_PROVIDER` sin declarar (d4ab496) NO se debilitó: sigue en los cuatro handlers, y el default consciente aplica solo DESPUÉS del proveedor declarado. |
| `_tarifa_familia_modelo_gate.mjs` (líneas 160-168) | ÚNICO fixture que exigió actualización (ver §3): el conteo de familias de la tabla, 4 → 7, documentado en el propio gate con la historia de la suba y qué la paga. Es fixture de CONTENIDO (nadie toca la tabla sin pasar por ahí), no de garantía — la garantía (regla de familia, nunca inventar precio) cubrió a las 3 familias nuevas sola: +18 aserciones automáticas, 0 reglas nuevas. |
| `.env.example` | Documenta los defaults de anthropic y `LLM_NARRATE_MAX_TOKENS` (comentados — los valores activos del ejemplo no cambian: el switch es del deploy, no de este encargo). |
| `_probe_anthropic_tarifas.mjs` · `_probe_anthropic_adapter.mjs` · `_probe_anthropic_defaults.mjs` · `_probe_anthropic_dosmodelos.mjs` (nuevos) | Los probes de A1-A4 (§2). Ninguno importa gatewayCore ni contiene los marcadores del clasificador; el gateway se verifica leyendo su fuente como texto. |

**NO se tocó** (verificado con `git diff 82de087..HEAD --stat`): `modelRouter.js` (la garantía de dos
modelos ES su comportamiento actual — solo se demostró por probe) · el adapter de openai · prompts /
doctrina / guardC / glosario / hiloBudget · `LLM_PROVIDER` y todo default de PROVEEDOR · los 4 archivos
ajenos de la sesión Falcon (este worktree ni los tiene sucios; todo `git add` fue archivo por archivo).

**Por qué queda INERTE**: producción corre con `LLM_PROVIDER=openai` y `LLM_MODEL_PARSE/NARRATE=gpt-4o-mini`
declarados — lo declarado gana siempre, así que ninguna de estas líneas cambia una sola llamada hasta que
el deploy cambie esas variables. La rama anthropic de `resolverModelos` y el tope 2048 del adapter solo se
alcanzan con `LLM_PROVIDER=anthropic`.

---

## 2 · Salidas de A1-A4 (probes bajo el candado, cero llamadas)

### A1 · tarifas — `node --import ./scripts/offline-guard.mjs _probe_anthropic_tarifas.mjs` → **17 PASS · 0 FAIL**

```
  ✓ MODEL_PRICING["claude-haiku-4-5"] = {in:1, out:5}   · alias exacto resuelve
  ✓ MODEL_PRICING["claude-sonnet-5"] = {in:3, out:15}   · alias exacto resuelve
  ✓ MODEL_PRICING["claude-opus-5"]  = {in:5, out:25}    · alias exacto resuelve
  ✓ sonnet lleva el precio de LISTA ($3/$15), no el intro que expira
  ✓ "claude-haiku-4-5-20251001" (snapshot \d{8}) → familia "claude-haiku-4-5"
  ✓ …y es la MISMA regla que ya servía a "gpt-4o-mini-2024-07-18"
  ✓ 1M in + 1M out del snapshot fechado de Haiku = US$6.00 exactos
  ✓ la entrada de "gpt-4o-mini" es byte-igual — {"in":0.15,"out":0.6} · 1M+1M sigue US$0.75
  ✓ "claude-haiku-4-5-turbo" y "claude-sonnet-5.5" quedan SIN precio (jamás prefijo libre)
```

### A2 · el body del adapter — `_probe_anthropic_adapter.mjs` → **13 PASS · 0 FAIL**

```
  ✓ buildParseBody === construcción vieja, byte por byte (JSON idéntico) · max_tokens 1024 intacto
  ✓ la env de narrar NO alcanza a parse (con LLM_NARRATE_MAX_TOKENS=4096 sigue en 1024)
  ✓ narrate SIN la env → max_tokens 2048 · todo lo demás del body byte-igual al de siempre
  ✓ CON LLM_NARRATE_MAX_TOKENS=3000 → 3000 · basura → 2048 · "0" → 2048 (nunca NaN)
  ✓ al borrar la env vuelve el default (se lee POR LLAMADA, no al importar)
  ✓ parse()/narrate() usan ESTOS builders (fuente leída como texto: no hay segundo cuerpo inline)
```

Sin llamar a la API: el probe construye los objetos con los builders puros y los compara contra la réplica
literal de la construcción vieja — el patrón de extracción que el repo ya usa (providerConfig.js).

### A3 · defaults conscientes del proveedor — `_probe_anthropic_defaults.mjs` → **21 PASS · 0 FAIL**

```
  ✓ anthropic + env vacío → parse=claude-haiku-4-5 · narrar=claude-sonnet-5 (jamás gpt-4o-mini)
  ✓ un OPENAI_MODEL sobrante del deploy anterior NO viaja a la API de anthropic
  ✓ lo declarado gana: LLM_MODEL_PARSE/NARRATE se usan tal cual · ANTHROPIC_MODEL cubre las dos pasadas
  ✓ opus se puede DECLARAR por env — pero nadie lo elige solo (no es default de nada)
  ✓ openai + env vacío → gpt-4o-mini en las dos pasadas, herencia narrar←parse intacta
  ✓ la config de producción actual (parse y narrar declarados) resuelve idéntica a hoy
  ✓ sin LLM_PROVIDER → sigue fallando nombrando la variable (el freno de d4ab496, intacto)
  ✓ el gateway consume resolverModelos del módulo puro; no queda default de modelo a mano en su código
```

### A4 · dos modelos + caché segmentado — `_probe_anthropic_dosmodelos.mjs` → **21 PASS · 0 FAIL**

```
  ✓ chooseModel(anthropic, plan/narrate, attempt=0/1/2) → null las 6 — el reintento repite el modelo
    estático (Sonnet en narrar): NO hay escalada, NO hay tercer tier
  ✓ ni el flag del router ni los overrides TIER2/TIER3 lo despiertan (la puerta es el PROVEEDOR)
  ✓ el ladder de openai intacto: mini → terra → sol, attempt=999 acotado a tier3
  ✓ builder REAL de narratePromptC → {fijo: 39.475 chars, variable: 249} · el body Anthropic conserva
    los 2 segmentos byte-iguales · cache_control SOLO en el fijo · el variable viaja sin cache_control
  ✓ lo que el proveedor lee es byte-idéntico a fijo+variable · con varios cacheables, el corte va en el ÚLTIMO
  ✓ el gateway declara [{fijo, cache:true}, {variable, cache:false}] (fuente leída como texto)
```

---

## 3 · Las dos corridas de gates:offline (A5)

**BASE, antes de tocar nada** (`82de087`):

```
133 PASS · 0 FAIL · 0 TOCARON LA RED · 0 CON CREDENCIAL VIVA (de 133 offline)
```

**DESPUÉS** (todos los cambios + fixture actualizado):

```
133 PASS · 0 FAIL · 0 TOCARON LA RED · 0 CON CREDENCIAL VIVA (de 133 offline)
```

Diff de ESTADOS gate por gate entre las dos corridas: **ninguno cambió de estado**. El diff completo de
logs (sin tiempos) tiene solo líneas informativas: los +18 ✓ internos del gate de tarifas (62→80 PASS
internos, las 3 familias nuevas cubiertas por la regla existente), la línea del fixture (4→7 familias) y
`_vocabulario_vara_gate` contando 174 archivos / 29.214 literales por el módulo nuevo (sigue PASS).

**Análisis del único gate que cambió de estado en el camino**: la primera corrida post-cambios dio
`132 PASS · 1 FAIL` — `_tarifa_familia_modelo_gate.mjs`. No es una garantía rota: su sección [6] fija por
NÚMERO el contenido de la tabla (`length === 4`) para que nadie agregue ni saque una familia sin revisión
deliberada — exactamente lo que este encargo hizo. El diff completo de logs (sin tiempos) mostró además que
la sección [1] del mismo gate cubrió SOLA a las 3 familias nuevas (+18 ✓ automáticos: snapshot fechado,
compacto, latest, prefijo, caja — para haiku/sonnet/opus), y `_vocabulario_vara_gate` contó 174 archivos /
29.214 literales (antes 173 / 29.204) por el módulo nuevo `modelDefaults.js` — línea informativa, sigue
PASS. El fixture se actualizó a 7 documentando en el propio gate qué paga la suba (commit `bb101e9`), y la
suite se re-corrió ENTERA (nunca un gate suelto).

---

## 4 · RECETA del deploy (para el arquitecto — variables verificadas por grep, no de memoria)

Todo es **server-side** (panel de la plataforma / env del server). Nada del bundle cambia: el switch no
toca variables `VITE_*`. Producción HOY declara `LLM_PROVIDER=openai` y los modelos gpt — **lo declarado
gana siempre**, así que hay que CAMBIAR las tres variables, no solo agregar la key.

### Encender Anthropic

| Variable | Valor | Nota |
|---|---|---|
| `LLM_PROVIDER` | `anthropic` | Obligatoria. Sin ella el gateway FALLA nombrándola (no elige solo). |
| `ANTHROPIC_API_KEY` | la key real | El adapter la manda como `x-api-key`. (Alternativa para proxy: `ANTHROPIC_AUTH_TOKEN` como Bearer; `ANTHROPIC_BASE_URL` opcional, default `https://api.anthropic.com`.) |
| `LLM_MODEL_PARSE` | `claude-haiku-4-5` | Recomendado explícito. Si se BORRA la variable, el default consciente resuelve lo mismo. **Dejarla en `gpt-4o-mini` rompería**: lo declarado viaja tal cual. |
| `LLM_MODEL_NARRATE` | `claude-sonnet-5` | Ídem. |
| `LLM_NARRATE_MAX_TOKENS` | (no setear) | Solo si se quiere otro tope de salida de NARRAR. Default 2048. `parse` no se configura (1024 fijo). |

`OPENAI_API_KEY` puede QUEDARSE seteada: el adapter de Anthropic no la mira, y tenerla viva es lo que hace
posible el rollback en 1 minuto. Con `LLM_PROVIDER=anthropic`, un `OPENAI_MODEL` sobrante tampoco molesta
(verificado por probe: no entra a la rama anthropic).

### Rollback a OpenAI (1 minuto)

| Variable | Valor |
|---|---|
| `LLM_PROVIDER` | `openai` |
| `LLM_MODEL_PARSE` | `gpt-4o-mini` |
| `LLM_MODEL_NARRATE` | `gpt-4o-mini` |
| `OPENAI_API_KEY` | (ya estaba — no tocar) |

En ambos sentidos: las env del server aplican al próximo deploy/restart de la plataforma (el deploy al
hosting es manual en este repo). Verificación post-switch sin leer código: `/api/version` confirma el
commit; el campo `modelo`/`modelFamilia`/`costUSD` de la telemetría del gateway confirma qué modelo
respondió de verdad y a qué tarifa (los snapshots fechados de Anthropic ya tarifan por familia).

---

## 5 · Decisiones no obvias (anotadas, no consultadas — seguí con lo claro)

1. **Bajo anthropic, declarar SOLO `LLM_MODEL_PARSE` no arrastra ese modelo a narrar** (narrar conserva su
   default `claude-sonnet-5`). La herencia narrar←parse de la cadena legada habría puesto a Haiku a narrar
   en silencio con una config a medias — deshaciendo la decisión de dos modelos sin que nadie lo pida. Quien
   quiera UN solo modelo para todo lo declara en `ANTHROPIC_MODEL` (que sí cubre las dos pasadas, como
   siempre hizo) o setea las dos variables. Bajo openai la herencia sigue intacta, byte-igual. Es una
   asimetría deliberada y está documentada en el módulo; si el arquitecto prefiere herencia también en
   anthropic, es un cambio de una línea en `resolverModelos` + su probe.
2. **`OPENAI_MODEL` quedó excluido de la rama anthropic** (la trampa del encargo, cerrada también por esa
   variable), pero la inversa NO se tocó: bajo openai, un `ANTHROPIC_MODEL` sobrante sigue entrando a la
   cadena legada como siempre (tercera posición). Cerrar la inversa cambiaría comportamiento existente de
   la rama que hoy corre en producción; lo dejo nombrado por simetría, no lo hice.
3. **El tope de salida se lee POR LLAMADA y `"0"` cae al default**: `Number("0") || 2048` trata el cero
   como tope imposible, no como "sin límite". Anthropic exige `max_tokens ≥ 1`, así que no existe un uso
   legítimo de 0; lo anoto porque difiere de cómo alguien podría leer "configurable".
4. **Ningún gate de la suite fija los PRECIOS nuevos por valor** (el fixture del gate de tarifas fija el
   CONTEO de familias; los valores $1/$5 · $3/$15 · $5/$25 los fija el probe A1, que no corre en la suite).
   Si el arquitecto quiere el valor pineado permanente, es agregar 3 aserciones a la sección [6] del gate
   de tarifas — no lo hice para no engordar un fixture ajeno sin encargo.
5. **`openai.js` narra con el mismo techo 1024** (2048 solo para modelos con reasoning). Fuera de alcance
   (el encargo lo excluye salvo extracción compartida, que no hizo falta); si el hilo largo del Paso 1
   empuja respuestas más largas TAMBIÉN bajo openai, el mismo ajuste aplicaría allá.

---

## 6 · Commits locales (sin push — lo autoriza el arquitecto)

Rama del worktree `claude/compassionate-fermi-1bb074`, basada en `dev` = `82de087`:

- `4ad9a57` — «Anthropic entra a la tabla de tarifas: haiku y sonnet a precio de lista, opus tarifado sin
  cablear» (modelPricing.js · _probe_anthropic_tarifas.mjs).
- `4385728` — «narrate() deja de chocar con el techo de 1024: tope 2048 configurable, y el cuerpo del
  request se vuelve verificable offline» (adapters/anthropic.js · _probe_anthropic_adapter.mjs).
- `bb101e9` — «El fixture de contenido de la tabla de tarifas aprende las 7 familias»
  (_tarifa_familia_modelo_gate.mjs).
- `a33bb15` — «El default de modelo conoce a su proveedor: anthropic sin config ya no recibe gpt-4o-mini»
  (modelDefaults.js NUEVO · gatewayCore.js · _probe_anthropic_defaults.mjs · .env.example).
- `05aad98` — «La garantia de dos modelos, demostrada offline: sin escalada con anthropic y el corte del
  cache al final del fijo» (_probe_anthropic_dosmodelos.mjs).
- (este informe va en un commit final)

Verificación reproducible, sin gastar:

```
npm run gates:offline
node --import ./scripts/offline-guard.mjs _probe_anthropic_tarifas.mjs
node --import ./scripts/offline-guard.mjs _probe_anthropic_adapter.mjs
node --import ./scripts/offline-guard.mjs _probe_anthropic_defaults.mjs
node --import ./scripts/offline-guard.mjs _probe_anthropic_dosmodelos.mjs
```
