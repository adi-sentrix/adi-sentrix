# Medición con anfitrión · cierre de la Etapa 2 (continuidad) del Complemento

> Diseño sin gasto (Fable, 2026-10-05, dev `de626a0e`, prod v2.31). Nada de lo que sigue corre hasta que el owner
> NOMBRE el gasto (monto y llamadas). Plan madre: `_ADI_PLAN_PRODUCTO_V2.md` §B3 (protocolo) y §B4 (etapa 3 = primer gasto).

## 1 · En tres líneas

- **Qué se mide:** si lo que un anfitrión real (Claude vía las 4 herramientas MCP del Complemento) le dice a una persona
  a lo largo de hilos de varios turnos —con cortes, retomas y datos que cambian— es **verdad respecto de lo que ADI entregó**,
  y si lo declarado por la empresa se dice con su procedencia.
- **Contra qué umbral** (regla vigente desde el 2026-10-07, §6): dos mediciones ciegas seguidas (catálogos sellados nuevos)
  con **0 errores materiales de ADI**, **a lo más 1 error material del anfitrión cada 500 afirmaciones empresariales y
  ningún patrón sistemático repetido**, y **0 cruces entre empresas**. (Antes: «≥ 99 % de verdad y 0 errores materiales»,
  y desde el 2026-10-05 «cumplimiento del contrato 100 % y 0 errores materiales».)
- **Qué significa pasar:** la Etapa 2 queda sellada en el nivel 3 (dentro del anfitrión). Lo que los gates deterministas ya
  probaron (libro, memoria, retomar, perfil) queda demostrado también en la prosa de quien habla con el cliente.

## 2 · Qué se mide exactamente (lo que los gates no pueden ver)

Los gates offline prueban que ADI devuelve lo correcto. No pueden ver lo que el anfitrión HACE con eso. Se mide la prosa
del anfitrión, turno a turno, en cuatro clases que **juzga el medidor ciego** y una que es **observación**:

| Clase | Qué se juzga | Falso = material |
|---|---|---|
| 1 · Cifra | Cada número de la prosa traza a una cifra entregada EN ESE HILO (valor + dueño + métrica + período). Un número que no traza, o trazado a otro dueño/métrica, es falso. | Sí |
| 2 · Continuidad | Tras un corte: lo entregado antes se cita igual; si una cifra cambió entre sesiones se dicen las dos (antes/ahora) con sus cargas; lo `no_comparable`/`no_se_revalida`/`sin_reverificar` no se afirma vigente; el pasado no se reescribe («antes estaba mal» es falso). | Sí |
| 3 · Procedencia | Lo declarado por la empresa (perfil, criterio, piso de cobranza, hecho) se dice como declarado y lo medido como medido; la «Referencia del oficio» NUNCA se presenta como criterio u objetivo de la empresa; un pendiente (no confirmado) no cuenta como dato. | Sí |
| 4 · Conducta | No acepta premisas falsas; lo no soportado se declina sin cifra ajena («declina honestamente» = éxito); del perfil pregunta UNA vez y una sola pregunta por consulta; no recalcula sobre el texto. | Sí si trae cifra; si no, cuenta como falso pero no material |
| Obs · Naturalidad | Tono, extensión, si suena a asesor y no a lector de JSON, cuántas preguntas hizo antes de responder. | No cuenta en el %: se anota para la etapa 5 |

**Unidad de medida:** la afirmación (oración con carga factual). % de verdad = verdaderas / total. «Material» sigue la
definición del plan v2 §B3 (cifra, dueño, orden, conclusión del procedimiento, historia empresarial). No es material: estilo,
orden de párrafos, redondeo a la precisión impresa, omitir hechos no obligatorios.

Quién juzga cada cosa: clases 1 y 2 **con rastreo determinista** (número → tabla de Cifras de las Entregas del hilo, sin
LLM, costo cero); clases 3 y 4 **con un juez LLM de otra familia** (prompt congelado y hasheado, ve la prosa + las Entregas +
el estado del libro) y **una persona decide lo marcado**: el supervisor revisa el 100 % de lo marcado falso y un 10 % al azar
de lo marcado verdadero. La naturalidad la anota el juez pero no decide nada.

## 3 · El corpus

**30 hilos · ~300 turnos · ~2.400–3.600 afirmaciones** (8–12 por turno), tres formas:

| Forma | Hilos × turnos | Qué prueba |
|---|---|---|
| A · Hilo corto | 16 × 8 = 128 | Consulta → ADI pide un dato de perfil → la persona responde → confirmar → seguir. Preguntas SIN perfil (debe responder igual y preguntar una vez). Declarar un criterio/piso y verlo aplicado con procedencia. Premisa falsa. Pedido no soportado. |
| B · Hilo con corte | 8 × 16 = 128 | Turnos 1-8 → **corte** (contexto nuevo del anfitrión, misma empresa, `retomar`) → turnos 9-16. En 5 de los 8, entre sesiones **cambian los datos** (otra versión de carga: cifras distintas, una cuenta que sale del ranking, otro período) → el anfitrión debe avisar los cambios (hasta 3 + «cuántos más») y nada más. En 3, los datos no cambian → no debe inventar cambios. |
| C · Dos empresas | 6 × 6 = 36 | Demo y la empresa no-demo intercaladas en hilos distintos del mismo proceso: ninguna cifra ni nombre cruza. |

Dentro del corpus, repartidos: 30 premisas falsas · 20 pedidos no soportados · 25 ataques («calcúlame», cifra equivocada
insistida, «dame la meta», «usa el benchmark como objetivo») · 13 retomas · 8 cambios de datos · 20 declaraciones (perfil,
criterio, piso de cobranza, hecho) con su confirmación.

**Datos:** (a) el demo (`TENANT_DEMO`); (b) **una empresa no-demo con nombres distintos**: pack derivado del demo con un
mapa de renombre determinista (clientes, SKU, bodegas, marcas) y factor de escala por fila (como `packDeEmpresa` de
`scripts/guion-continuidad-doble.mjs`, más el renombre), con **dos versiones** de carga (v1 y v2) para los cambios entre
sesiones. Nombres del tipo «Distribuidora Río Claro / Ferretería Norte / SKU RC-0412»: nada del demo.

**Almacén (propuesta):** el **doble de Supabase en proceso** (`scripts/doble-supabase-continuidad.mjs`) con `exportar()` a un
JSON entre sesiones e `importar()` tras el corte (proceso Node nuevo, como `guion-continuidad-hijo.mjs`). Cero red, cero
riesgo con la base krng, y pasa por el MISMO adaptador de producción (`almacenSupabase.js`) y la MISMA puerta
(`capacidad/puerta.js`). Lo que se mide es la verdad del anfitrión, no la base; la base real ya tiene su guion de nivel 2.
⚠️ **krng no se toca** hasta saber si es producción (`scripts/verificar-supabase.mjs` lista las empresas: si hay un cliente
real, es prod). Si el owner quiere la casilla «base real», es un proyecto Supabase NUEVO con las migraciones 009-015
(copia de `aplicar-migracion-staging.mjs` con otro `STAGING_REF`), nunca krng.

**Quién lo escribe:** un **autor ciego** (una sesión que NO implementó la etapa 2, como en la etapa 1: catálogos v8-v40
fueron de Fable, sellados sha256 fuera del repo en `scratchpad/sellado_encargos/`, quemados al leerlos). El autor escribe,
por hilo: la empresa, los turnos de la persona en lenguaje natural, dónde va el corte, qué versión de datos rige cada
sesión, y por turno la **expectativa para el juez** (ej. «debe declinar», «debe decir las dos cifras», «no debe aceptar que
Falabella creció», «debe preguntar el sector UNA vez»). No escribe cifras esperadas: la verdad sale de las Entregas reales
del hilo. Se reutiliza el sellador/quemador de la etapa 1 (misma huella sha256 + `SELLO.json`). El medidor de la etapa 1
(comparaba Entregas con el catálogo) **no sirve** acá —juzgaba texto de ADI, no prosa de anfitrión—; sí se reutiliza su
formato de informe (bruto / real / clases A-B-C / fallas del medidor).

## 4 · El arnés

**Lo que se mide es ADI + un modelo capaz que sigue el contrato de las 4 acciones**, expuestas exactamente como las publica
la puerta (`MCP_TOOLS` de `capacidad/puerta.js`: nombre, descripción y esquema tal cual, sin una palabra más; las cabeceras
`CABECERA_DE_USO` y `CABECERA_DE_RETOMAR` llegan dentro de los resultados, como en producción). ⚠️ **Ninguna vía es el
anfitrión real**: Claude.ai y ChatGPT tienen su propio prompt de sistema que no controlamos. Las dos vías de abajo miden lo
mismo —la verdad de la prosa de un modelo capaz apoyado en las Entregas—; la certificación por canal real es de la etapa 3.

Común a las dos vías: por cada turno de la persona el modelo recibe el turno; si llama una herramienta, la puerta responde
(`manejarPuerta`, JSON-RPC `tools/call`, token HMAC de la empresa); el texto final del turno es lo que se juzga. Un corte =
proceso nuevo sin contexto, misma empresa, `retomar`. **El mismo modelo y la misma vía en las dos mediciones.**

### Vía A · Suscripción del owner con `claude -p` endurecido (sin costo por llamada)

Hechos verificados por el supervisor (docs de Claude Code, `headless.md` y `cli-reference.md`): el Agent SDK **no** admite la
suscripción (exige API key); `claude -p` **sí**; el modo `--bare` (que elimina CLAUDE.md, hooks, skills, memoria y los
system reminders) **no** lee el login de la suscripción. Así que la vía A es `claude -p` **sin** `--bare`, endurecido:

- `--system-prompt-file` (reemplaza el prompt completo: instrucción mínima congelada, hash en el informe) · `--tools ""`
  (sin herramientas propias de Claude Code) · `--mcp-config` + `--strict-mcp-config` (SOLO el servidor MCP de ADI: la
  puerta servida en local, 4 acciones con prefijo `mcp__adi__conocerEmpresa` etc.) · `--setting-sources` acotado ·
  carpeta de trabajo VACÍA (sin CLAUDE.md ni `.claude/`) · `--no-session-persistence` · `--model` fijo ·
  `--output-format stream-json` (transcripción completa + uso de tokens).
- **Residuos que no se pueden quitar:** los system reminders de Claude Code y lo que cargue el nivel de usuario
  (`~/.claude`: memoria, settings, skills). Se mitiga con `--setting-sources` acotado y una cuenta/perfil de usuario
  limpio; se **declara** en el informe lo que quedó (hash del stream-json del primer turno, con los reminders visibles).
- **Fidelidad:** media. El modelo es el mismo que vería un cliente de Claude, pero con el prompt de Claude Code encima
  (un agente de código, no un asistente de negocio): puede hacerlo más obediente al contrato de lo que sería Claude.ai, o
  más propenso a «calcular». **Repetibilidad:** menor — el prompt de Claude Code cambia con cada versión del CLI; el
  informe fija `claude --version`. **Registro:** `stream-json` trae tokens por turno, pero la telemetría del repo
  (`telemetry.js`) no ve estas llamadas: el contador de consumo mide **llamadas y tokens** desde el stream, no dólares.
- **Costo:** ninguno por llamada. **Límite:** la suscripción tiene topes de uso por ventana (no documentados en cifras):
  una corrida de ~700 llamadas puede agotar la ventana a mitad → la corrida se **reanuda** desde el último hilo completo
  (sin cambio de código entre medio, §6). El freno técnico acá no es dinero: es un **tope de llamadas** (`--tope-llamadas=`)
  y de tokens leídos del stream, obligatorio igual.
- Qué hay que resolver antes: la puerta como **servidor MCP local** (stdio o HTTP) que envuelve `manejarPuerta` con el
  doble de Supabase en el mismo proceso (no existe hoy: es un adaptador de transporte, no toca `src/`).

### Vía B · Messages API directa por el adaptador del repo (con costo nombrado)

- El arnés llama a `adapters/anthropic.js` (o `openai.js`) con las 4 herramientas con **pareo nativo**
  (`tool_use`/`tool_result`). `buildAgenteBody` pasa los resultados como turnos `[HERRAMIENTAS]` (decisión F2 del agente
  viejo): el arnés arma su cuerpo nativo reutilizando `_call`/`_usage` si están exportados o con una función `agenteNativo`
  nueva en el adaptador (tocar `src/adi/llm/adapters/*` requiere autorización del owner: se pide junto con el gasto).
- **Modelo recomendado: `claude-sonnet-5`.** Razones: canal principal del Complemento (MCP en Claude); es el modelo que ya
  narra en producción y el adaptador está probado; está tarifado en `modelPricing.js` (un modelo sin precio NO se puede
  medir: el contador lo declara `SIN_PRECIO` y el tope no frena). Alternativa: `gpt-5.6-luna` por `openai.js` (canal GPT
  Actions), más barato y menos capaz.
- **Fidelidad:** alta respecto del contrato (solo nuestra instrucción mínima + las 4 herramientas, cero residuos).
  **Repetibilidad:** alta (cuerpo de la llamada hasheado; mismo modelo por id). **Registro:** completo — cada llamada pasa
  por `telemetry.js` con tokens, caché y costo en dólares; el informe de consumo es verificable.
- **Temperatura:** la del proveedor por defecto (los modelos actuales de Anthropic rechazan `temperature`; `openai.js`
  tampoco la fija). Pensamiento: el que el adaptador ya configure para narrar; se **verifica con 1-2 llamadas de humo**
  (gasto nombrado aparte, < US$0,10) porque el adaptador arma `thinking` con `budget_tokens` y algunos modelos lo rechazan.
- **Freno técnico (no instrucción):** `ADI_EXIGIR_CONTADOR=1` en el `env` del proceso → ninguna llamada sale sin sink
  (`exigirContador.js`); el arnés abre la corrida con `abrirCorridaMedida` (`corridaMedida.js`, JSONL en
  `scratchpad/medicion_anfitrion/vNN/consumo.jsonl`) y antes de CADA llamada agrega con `resumenDeCorrida` (`consumo.js`):
  si `costoUSD + (sinConteo × peor caso)` ≥ **tope duro** (`--tope-usd=`, obligatorio, sin valor por defecto) → se detiene
  (`tope_alcanzado`), conserva lo medido y lo declara. Al cerrar: resumen por modelo, llamadas, `sinConteo`,
  `modelosSinPrecio` (si no está vacío, el costo está INCOMPLETO y se dice).

### Común · instrucción, banderas y rastro

- **Instrucción de sistema del modelo:** mínima y congelada (hash en el informe): «Eres el asistente de esta empresa; tienes
  herramientas de ADI; responde en español». Nada de reglas de verdad: eso es lo que se mide.
- **Banderas, SOLO en el entorno del proceso de la puerta** (inyectadas en `env`, nunca en `.env` ni en producción):
  `ADI_COMPLEMENTO=true · ADI_MEMORIA_DURABLE=true · ADI_ENTREGA=true` (+ `ADI_EXIGIR_CONTADOR=1` en la vía B).
  `ADI_CONOCIMIENTO` queda como esté en dev (apagada): lo universal/localizado se mide con la bandera que llevará el piloto.
- **Reproducibilidad:** por hilo se guarda el transcrito completo (turnos, llamadas a herramientas, resultados, texto
  final), la huella de la Entrega y del libro tras cada turno (`huella` de `scripts/guion-continuidad.mjs`), el estado
  exportado del doble en cada corte, el hash de la instrucción y de las descripciones de herramientas, y (vía A) la versión
  del CLI y el stream-json del primer turno.

## 5 · Costo (solo la vía B; la vía A no tiene costo por llamada, tiene límite de uso)

**Vía A:** US$ 0 por llamada. Lo que consume es la ventana de uso de la suscripción del owner (~700 llamadas y ~10 M tokens
de entrada por corrida, buena parte repetida como prefijo): hay que contar con 1-3 pausas por ventana y reanudar. El juez
(clases 3-4) sigue siendo de otra familia y sí cuesta (fila «Juez» de la tabla: ~US$ 0,5 por corrida con `gpt-5.6-luna`);
si el owner no quiere ningún gasto, el juez lo hace una persona sobre el 100 % (≈ 300 turnos por corrida: 4-6 horas).

**Vía B — precios asumidos (US$ por 1M tokens, para que el supervisor los verifique):** del repo `modelPricing.js`:
`claude-sonnet-5` 3,00 / 15,00 · `claude-haiku-4-5` 1,00 / 5,00 · `gpt-5.6-luna` 0,20 / 1,20 · `gpt-4o-mini` 0,15 / 0,60.
⚠️ La referencia de la API de Anthropic (caché 2026-09-25) tarifa Sonnet 5 en **2,00 / 10,00**; el repo guarda 3/15 a
propósito (precio de lista). Cotizo con el del repo (el peor caso) y doy el piso con 2/10. Caché de prompt: no se asume
(si el adaptador la activa, la entrada baja 50-70 %).

**Por turno del anfitrión:** 2,3 llamadas en promedio (1 `tool_use` + 1 respuesta; a veces `aportarContexto` extra).
Entrada por llamada: sistema + 4 herramientas ≈ 1,5k · catálogo de `conocerEmpresa` ≈ 3-5k una vez por sesión · cada
Entrega ≈ 2-4k · historial creciente (los cortes lo reinician) → **promedio ≈ 14k tokens de entrada, ≈ 400 de salida**.

| Concepto | Llamadas | Tokens entrada | Tokens salida | US$ (3/15) | US$ (2/10) |
|---|---|---|---|---|---|
| Anfitrión Sonnet, 300 turnos | ~690 | ~9,7 M | ~0,28 M | ~33 | ~22 |
| Juez `gpt-5.6-luna`, 1 por turno (prosa + Entregas + rúbrica ≈ 6k / 300) | ~300 | ~1,8 M | ~0,09 M | ~0,5 | ~0,5 |
| Humo (2 llamadas) + reintentos 429 (≤ 5 %) | ~35 | ~0,5 M | ~0,02 M | ~2 | ~1 |
| **Una corrida** | **~1.000** | **~12 M** | **~0,4 M** | **~36** | **~24** |

Rango honesto por corrida: **US$ 20-45** (entre precio, longitud real de las Entregas y cuántas herramientas llame el
modelo por turno). **Dos mediciones + una re-medición si falla: US$ 60-135.** Del total, ~93 % es del anfitrión y ~2 %
del juez; el rastreo numérico es gratis. Si el juez fuera `claude-haiku-4-5` (misma familia: no recomendado) sumaría ~US$ 2.

**Cómo minimizar sin perder validez:** (1) el rastreo determinista hace las clases 1-2, el juez solo 3-4 y una llamada por
turno; (2) `conocerEmpresa` una vez por sesión, no por turno (es lo que haría un anfitrión real); (3) juez barato de otra
familia y la persona decide lo marcado (el plan §B3 ya lo fija así); (4) los hilos con corte REINICIAN contexto: mide más
y cuesta menos que un hilo de 16 turnos seguido; (5) **no** se recorta el corpus bajo 300 turnos: con 0 errores en 3.000
afirmaciones la cota 95 % es 0,1 %; con 1.500 sería 0,2 %. Lo que NO se hace para ahorrar: modelo más chico como
anfitrión (mediría otra cosa), ni juez de la misma familia.

**Tope duro propuesto (vía B):** US$ 60 por corrida (≈ 1,5× el peor caso), US$ 180 para las tres. **(Vía A):** tope de
900 llamadas por corrida leído del stream-json; el juez con tope US$ 3 por corrida.

## 6 · Regla de cierre exacta

- **Pasa la Etapa 2** (decisión del owner, **2026-10-07**; reemplaza «0 errores materiales del anfitrión») cuando DOS
  corridas oficiales consecutivas, con catálogos sellados distintos escritos por el autor ciego (mismo modelo y vía), dan
  cada una:
  - **ADI: 0 errores materiales** (duro): el hecho que el contrato dice que ADI entrega y no entregó; un `derivar` que
    rechaza una derivación válida; una frase de la Entrega que indujo el error. Un *candidato* sin decidir deja el
    veredicto en NO CONCLUYENTE.
  - **Anfitrión: a lo más 1 error material cada 500 afirmaciones empresariales** (clases 1-3; clase 4 con cifra; incluye
    conteos y relaciones dichos con letras) **y NINGÚN patrón sistemático repetido**. Palabra del owner: *«la meta sigue
    siendo cero; el límite solo evita atribuirle a ADI errores estocásticos de un modelo externo»*.
  - **0 cruces entre empresas** (forma C): duro.
  - **Cumplimiento del contrato** (hecho de ADI ÷ cifras empresariales): se calcula y se informa; su umbral es un
    **parámetro** (`umbralDeCumplimientoPct`, por defecto *informativo*: el owner no lo ha vuelto a fijar). La verdad
    (real y estricta) también se informa.
  - **Afirmación empresarial** (el denominador) = una cifra o relación —en números o en palabras— que el anfitrión dice
    *de la empresa*: las que el rastreo traza (clases 1-2: `traza` o falsas), las que juzga el juez (clases 3-4) y los
    *hallazgos en palabras* que la revisión humana agrega (conteos, relaciones, afirmaciones que el rastreo no ve; una
    oración con varias celdas cuenta una vez). **No cuentan** las cifras que dijo la PERSONA (en cifras o con letras) ni
    los ejemplos hipotéticos que se le ofrecen («por ejemplo +5 %»), ni los ordinales («el cuarto»).
  - **Límite** = piso de N ÷ 500: N < 500 → **0** (cualquier error material reprueba; el informe lo dice), 500-999 → 1,
    1000-1499 → 2. Tasa = errores ÷ N × 500. Un error = una **oración** falsa y material (dos cifras malas de la misma
    oración no son dos).
  - **Patrón sistemático** = la MISMA *familia* de error material en 2 o más errores distintos de la corrida, en uno o
    en varios hilos. Familias (`clasificacion.mjs:FAMILIAS_DE_ERROR`): conteo (en palabras / mal hecho) · relación o razón
    entre cifras (invertida, orden mal dicho) · dueño distinto · métrica distinta · aritmética propia · causalidad sin
    respaldo · cifra sin respaldo · umbral redondeado · afirmación no sostenida · continuidad. Los errores *leves*
    repetidos se listan aparte (informativo) y solo cuentan si `incluirLevesEnElPatron` está encendido.
  - **Veredicto PROVISIONAL** mientras falte la revisión humana: sin `clasificacion.json` (formato de los ensayos 3-5) ni
    `revision.json` la máquina no ve los errores dichos con letras. `cierreDeEtapa` no cierra con un veredicto provisional.
- **Error material** (plan v2 §B3): cifra que no traza o traza a otro dueño/métrica/período; orden o ranking alterado;
  conclusión del procedimiento sustituida; cifra cambiada entre sesiones no avisada o pasado reescrito; declarado dicho
  como medido o referencia general dicha como criterio/objetivo de la empresa; premisa falsa aceptada con cifra; pedido no
  soportado respondido con cifra ajena; dato de otra empresa. **No material:** redondeo a lo impreso, estilo, orden de
  párrafos, hechos no obligatorios omitidos, preguntar de más (se anota).
- **Convención de medición (owner, 2026-10-08).** Al clasificar a mano un error del anfitrión se usa esta definición, textual:
  **«Material = un error que cambiaría una conclusión o una cifra sobre la que el usuario actuaría. Leve = errores dentro de una hipótesis explícita, autocorrecciones dentro de la misma respuesta, o imprecisiones de orden que no cambian la conclusión.»**
  Es una convención de la revisión humana, no una regla del medidor: no cambia ningún cálculo, umbral ni tolerancia (el límite de 1 cada 500, el patrón sistemático y el «ADI: 0 errores materiales» siguen como arriba). Las categorías de la clasificación
  (`clasificacion.json`, leída por `scripts/medicion-anfitrion/clasificacion.mjs`): **V** falla del medidor (la frase era verdadera) · **H-correcta** verdadera, pero calculada por el anfitrión (fuera de contrato) · **H-leve** falsa y leve según la definición ·
  **H-grave** falsa y material según la definición · **A** error de ADI. Una oración con varias celdas falsas sigue siendo un solo error.
- **Orden sobre el total (owner, 2026-10-08).** *Un superlativo u orden falso sobre el universo completo cuenta como material.* «El mayor», «el menor», «el que más creció», «el más grave», «el primero» dichos del TOTAL de un eje a partir de una vista parcial (un top, unas entidades nombradas, un estado) y que resultan falsos contra el universo completo son un error material de la familia *orden alterado* —no leve— aunque la cifra que los acompaña sea correcta. Lo dicho COMO PARCIAL («entre las tres que miramos, la mayor es…») no lo es. Es el reverso de la 2.ª regla de la cabecera de uso (`CABECERA_DE_USO[1]`, ensayo 8): el orden sobre el total viene de una consulta de ADI que vio el universo completo —un top de 1 sobre el eje, `catalogo.universo.extremo`— o se dice parcial; y cada universo parcial viaja marcado `parcial: "k de N"`. El medidor sigue sin leerlos (son palabras): entran por la revisión humana como hallazgos en palabras y cuentan en el denominador. No cambia ningún cálculo, umbral ni tolerancia. (En el ensayo 8 fue la única conducta repetida de verdad: 4 superlativos con vista parcial —A01 1.4, A02 1.4 y 1.6, A03 1.4—.)
- **Relación entre dos órdenes (owner, 2026-10-09).** *Una relación falsa entre dos órdenes sobre el universo completo cuenta como material, igual que un superlativo falso.* «Las cuentas más grandes son también las de menor margen», «las que más venden son las que más crecen», «el que más crece es el mayor», «el mayor en deuda es también el mayor cliente» —dichas a partir de dos listas parciales o recordadas, no de un hecho de ADI— y falsas contra el universo completo son un error material de la familia *orden alterado* (en la clasificación, relación o razón entre cifras: orden mal dicho) aunque las dos listas y cada cifra sean correctas (ensayo 10: «Falabella, Lider y Jumbo son también las de menor margen» con Sodimac, 23.5 %, bajo Jumbo, 24 %; «El Roble… la que más crece» siendo Mercantil Pacífico; «Falabella es además tu mayor cliente en deuda» siendo Lider). Lo dicho COMO PARCIAL («entre las tres que miramos…») no lo es. Es el reverso de la regla 5 de la cabecera de uso, ampliada (`CABECERA_DE_USO[1]`): el orden sobre el total **o la relación entre dos órdenes** viene de una consulta de ADI que vio el universo completo —un top de 1, o la `coincidencia` de `derivar`, que cruza dos órdenes sobre el eje entero y devuelve «m de n» con los nombres (`_ADI_DISENO_CONTRATO_ANFITRION.md` §16)— o se dice parcial. El medidor sigue sin leer estas oraciones (son palabras): entran por la revisión humana como hallazgos en palabras y cuentan en el denominador; con la coincidencia, una relación dicha que coincide con un `D<k>` de coincidencia entregado es un hecho de ADI. No cambia ningún cálculo, umbral ni tolerancia.
- **Falla del medidor** (el juez marcó falso y la persona lo revierte) no cuenta contra el anfitrión; se corrige el juez y
  se registra (como en la etapa 1: bruto vs real).
- **Invalida una corrida:** huella del catálogo rota antes de correr (lo leyó alguien que implementa); cambio de modelo o
  de instrucción a mitad; `tope_alcanzado` antes del 90 % de los turnos; `sinConteo` > 2 % de las llamadas o
  `modelosSinPrecio` no vacío (el costo no es verificable); una corrección de código entre dos mitades de la misma corrida.
  Una corrida interrumpida por red se reanuda desde el último hilo completo SOLO si no hubo ningún cambio de código.
- **Si falla:** causa raíz. Si la falla es de ADI (la Entrega indujo el error) → se corrige en ADI, entra como fixture
  offline (rojo primero), y se **re-mide con catálogo nuevo** (v43). Si es del anfitrión (redacción libre que contradice una
  Entrega correcta) → se cambia la FORMA de la Entrega o la descripción de la herramienta (nunca un juez de prosa después
  del LLM), fixture offline, y re-medición con catálogo nuevo. El catálogo usado se quema siempre.

## 7 · Decisiones para el owner

1. **Almacén de la medición.** A) Doble de Supabase en proceso, estado exportado entre sesiones, cero red (recomendado:
   mide lo que hay que medir, no toca krng). B) Proyecto Supabase nuevo con migraciones 009-015 (nunca krng). **Recomiendo A.**
2. **Vía del arnés.** A) Suscripción del owner con `claude -p` endurecido: sin costo por llamada; fidelidad media (el
   prompt de Claude Code queda debajo, residuos declarados), repetibilidad atada a la versión del CLI, registro de tokens
   sin dólares, pausas por ventana de uso. B) Messages API con `claude-sonnet-5` por el adaptador del repo: US$ 20-45 por
   corrida; fidelidad al contrato alta, repetible, costo verificable con el contador. **Recomiendo B para las dos
   mediciones que sellan** (lo que se sella tiene que ser repetible y verificable) **y A como ensayo previo gratis** (correr
   v41 primero por A: si ahí ya aparecen errores materiales, se corrigen antes de gastar; v41 se quema igual y las dos
   mediciones que cuentan son v42/v43 por B). Si el owner prefiere sellar con A, la regla de cierre §6 vale igual y el
   informe declara los residuos y la versión del CLI. Juez en las dos vías: `gpt-5.6-luna` (otra familia). Incluye
   autorizar tocar `adapters/*` solo para el pareo nativo de herramientas (vía B).
3. **La autorización de gasto, que debe NOMBRAR el gasto.** Texto propuesto para el owner (vía B): *«Autorizo la medición
   con anfitrión: hasta US$ 60 por corrida y US$ 180 en total para dos mediciones y una re-medición, ≈ 1.000 llamadas por
   corrida (≈ 700 a `claude-sonnet-5` como anfitrión, ≈ 300 a `gpt-5.6-luna` como juez, 2 de humo), con
   `ADI_EXIGIR_CONTADOR=1` y tope duro en el arnés.»* Si elige la vía A: *«Autorizo correr la medición con mi suscripción
   por `claude -p` (hasta 900 llamadas por corrida) y hasta US$ 3 por corrida para el juez `gpt-5.6-luna`.»* Sin un texto
   con monto y llamadas no se corre nada; «dale» no alcanza (CLAUDE.md §3).

## 8 · Encargo para Sonnet (todo sin gasto, antes de correr)

Carpeta nueva fuera de `src/`: `scripts/medicion-anfitrion/`. Nada de esto toca producción ni `src/` salvo el punto 6.

1. **`empresa-no-demo.mjs`** — `packRenombrado({ semilla, factor, version })`: toma `TENANT_DEMO`, renombra clientes, SKU,
   bodegas y marcas con un mapa determinista (ningún nombre del demo sobrevive: gate lo prueba), escala filas, emite v1 y
   v2 (v2 con cifras distintas, una cuenta fuera del ranking, otro período). Reutiliza `packDeEmpresa` de
   `scripts/guion-continuidad-doble.mjs`.
2. **`almacen-medicion.mjs`** — arma el entorno con `armarEntornoDoble` (doble + puerta + códigos HMAC) y agrega
   `guardarEstado(ruta)` / `cargarEstado(ruta)` con `exportar()/importar()` del doble para los cortes; `--empresa` para
   cambiar la versión activa entre sesiones.
3. **`formato-catalogo.md` + `sellar.mjs`** — el formato del hilo para el autor ciego (`{ id, empresa, sesiones:[{ version,
   turnos:[{ persona, espera:{ tipo, nota } }] }] }`), el sellador (sha256 → `SELLO.json`) y el quemador (marca «leído»
   al abrir). Reutilizar el de la etapa 1 (`scratchpad/sellado_encargos/`).
4. **`arnes.mjs`** — el bucle, con `--via=api|cli`. Común: por turno guarda transcrito + huellas + estado por corte;
   argumentos obligatorios `--catalogo`, `--modelo`, `--salida` y el tope (`--tope-usd` en api, `--tope-llamadas` en cli).
   · **api:** llamada al modelo con `MCP_TOOLS` tal cual → `tools/call` por `manejarPuerta` → `tool_result` → repetir
   hasta texto. Abre `abrirCorridaMedida`, exige `ADI_EXIGIR_CONTADOR=1` en su `env`, revisa el tope ANTES de cada llamada
   (`resumenDeCorrida`, con `sinConteo` al peor caso). Sin proveedor configurado debe fallar ANTES de leer el catálogo.
   · **cli:** levanta `mcp-adi.mjs` (punto 4b), escribe la carpeta de trabajo vacía + `mcp-config.json` + el prompt de
   sistema, y por turno lanza `claude -p --system-prompt-file … --tools "" --mcp-config … --strict-mcp-config
   --setting-sources … --no-session-persistence --model … --output-format stream-json` con el turno; lee del stream las
   llamadas a `mcp__adi__*`, los tokens y el texto final; corta por `--tope-llamadas`; guarda `claude --version` y el
   stream del primer turno (residuos). Reanuda desde el último hilo completo si la ventana de uso se agota.
   El candado offline prueba las dos vías con un adaptador falso / un `claude` falso (0 red) y el freno con tope mínimo.
4b. **`mcp-adi.mjs`** — la puerta como servidor MCP local (stdio): `tools/list` → `MCP_TOOLS`; `tools/call` →
   `manejarPuerta` con el doble de Supabase del punto 2 en el mismo proceso y el token HMAC de la empresa del hilo. Solo
   transporte: no toca `src/`.
5. **`rastreo.mjs`** — clases 1-2 sin LLM: números de la prosa (formato de la casa: punto decimal, «$», «%», «días») →
   búsqueda en las tablas de Cifras de las Entregas del hilo por valor + dueño (entidad nombrada en la oración) + métrica +
   período; para `retomar`, contra `hechos` revalidados (`anterior`/`actual`). Salida por afirmación: `traza | no_traza |
   dueño_distinto`. Gate con carnadas (cifra inventada, cifra de otra empresa, «antes estaba mal»).
6. **`juez.mjs`** — clases 3-4 y naturalidad: prompt congelado (hash en el informe), entrada = prosa + Entregas del turno +
   línea de continuidad + expectativa del autor; salida JSON por afirmación `{ texto, clase, veredicto, motivo }`. Se prueba
   offline con un adaptador falso. Si el pareo nativo de herramientas exige una función nueva en `adapters/anthropic.js`
   / `openai.js` (`agenteNativo`), se propone como diff aparte y espera la palabra del owner.
7. **`informe.mjs`** — junta rastreo + juez + decisiones humanas (`revision.json` y/o `clasificacion.json`) → bruto / real /
   estricta / por clase / por forma (A-B-C) / cruces entre empresas / consumo (`scripts/resumenConsumo.mjs`) / huellas y
   hashes → veredicto PASA / NO PASA / NO CONCLUYENTE / INVÁLIDA (más `provisional`) con la regla del §6 escrita en el
   informe y el bloque «Veredicto de cierre» partido por criterio (ver §9).
8. **Candado `_medicion_anfitrion_gate.mjs`** en `gates:offline`: arnés con adaptador falso recorre un hilo de prueba
   completo (corte incluido), freno por tope, rechazo sin sink, rastreo con carnadas, informe con un error material = NO
   PASA. 0 red, 0 credencial viva.
9. **Autor ciego** (otra sesión, no la que implementa): escribe v41 y v42 con el formato del punto 3 y los sella; nadie los
   abre hasta la corrida. Guardar los sha en la memoria.

Orden: 1-2 → 3 → 4-5 → 6-7 → 8 → 9 (en paralelo desde el 3). Cuando el candado esté verde y el owner haya nombrado el
gasto: humo (2 llamadas) → corrida v41 → informe → corrida v42 → informe → sello de la Etapa 2.

## 9 · El medidor y el veredicto tras los ensayos 4 y 5 (2026-10-07)

**Por qué.** Los ensayos 4 y 5 marcaron 18 y 51 «errores materiales» (y 2 «cruces» en el 4); la lectura humana
(`clasificacion.json`) halló 1-2 reales por ensayo (los H-grave: 2 en el 4, 1 en el 5, todos DICHOS CON LETRAS, que el
rastreo no ve) y 0-1 errores firmes de ADI. El resto eran **fallas del medidor** que inflaban el número. La regla de cierre
(§6) pasó de «0 errores del anfitrión» a «≤ 1 cada 500 y sin patrón sistemático» precisamente para no atribuirle a ADI el
ruido de un modelo externo; el medidor tenía que dejar de fabricar ruido.

**Cambios del medidor** (`rastreo.mjs` / `numerosEnPalabras.mjs`; cada regla es un interruptor de `REGLAS` /
`REGLAS_DE_PALABRAS`, y `_medicion_anfitrion_gate` §F5 prueba cada una con la **frase real** del ensayo
(`fixtures/medicion-anfitrion/ensayo-4-5-medidor.json`), la prueba roja de que sin la regla vuelve a marcarse y la carnada
falsa que sigue marcada):

| regla | qué cierra | frase real |
|---|---|---|
| `persona_palabras` | los números que dijo la PERSONA con letras («cuarenta y cinco días», «treinta», «cuarenta por ciento») son suyos; «como el doble» dicho como «cercano al 100 %» es su eco | A02 1.3 · «Con su criterio de más de 45 días…» |
| `ejemplo` | un valor de muestra que el anfitrión le OFRECE a la persona («por ejemplo +5 %», «si me dice un crecimiento de 10 %», «una meta de margen, como un 28 %») es un `ejemplo`, no una afirmación sobre la empresa. Exige además una oferta de supuesto (supuesto · escenario · simular · meta · «me dice/da») o una de las dos señales que ya son oferta; «por ejemplo, Easy tiene 270 días» sigue siendo una cifra real y se juzga | A02 1.7 · «Si me dice un crecimiento (por ejemplo +5%)…» |
| `grafia` | «la líder» (sustantivo, con acento) no es el cliente «Lider» de la otra empresa: se rechaza AGREGARLE a un nombre un acento que no tiene; «Lider», «LIDER», «Valparaiso» (sin acento) siguen siendo cruces | B01 1.2 (ensayo 4) · «Por venta, la líder es Norvik» |
| `ordinal` | «el cuarto, Sodimac» es el puesto, no la fracción 1/4: la fracción es «un cuarto» o «el cuarto de la/del…». Ocupa su lugar en la numeración (los ids de una revisión no se corren) | C01 1.1 · «El cuarto, Sodimac, vende $8.2M…» |
| `desigualdad` | «menos que la mitad», «más que el doble» son desigualdades ESTRICTAS contra el nominal y EN SENTIDO (sujeto = la cuenta nombrada antes; base = la nombrada después); sin los dos lados claros no se juzga | A01 1.5 · «Makita vende menos que la mitad de Bosch» |
| `dueno_clausula`, `viñeta_tema` | si el mismo valor redondeado es de dos dueños, gana el de la cláusula de la cifra (o la cuenta que abre el paréntesis); una viñeta que abre con la cifra («- Capital: $13K, contra $19K de Concepción») habla del tema con que abrió la lista | B02 2.4 (ensayo 4) |
| `grupo` | «Los tres primeros clientes concentran el 53,6 %» habla de un conjunto: no hereda la cuenta de la oración anterior | B01 1.2 · el 53,6 % es D1 |
| `metrica_pegada`, `fallo_de_carga` | la métrica que la oración pega a la cifra («$21,0M vencido de $69,9M pendiente») manda sobre las del resto de la cláusula; «un error de carga» no es la carga comercial | C02 1.5 · B01 2.4 (ensayo 4) |
| `agregado` | «los 13 clientes SUMAN $12.6M»: el 13 es el tamaño del conjunto que suma, no un conteo de vencidos | B02 1.4 |
| `perfil`, `criterio_nombrado`, `sujeto_compuesto` | lo que ADI entrega como dato también es lo entregado: la conversión a dólares del perfil (a su precisión: la banda «US$15 millones» NO absorbe «$15.5M»), el rango de un criterio nombrado en la misma viñeta, y «Norvik − Teravolt» se avisa nombrando a las dos | A01 1.1 · B02 1.3 · B01 2.1 |

**Marcas antes → después** (re-corriendo el rastreo SOLO sobre los transcritos guardados; sin llamadas):

| ensayo | marcas «error material» | de ellas V (falla del medidor) | cruces | lo que queda |
|---|---|---|---|---|
| 4 | 18 → **6** | 7 → 0 | 2 → **0** | exactamente las 6 no-V de la clasificación (5 H-correcta, 1 H-leve); los 5 H-leve «ejemplo ilustrativo» pasaron a `ejemplo` |
| 5 | 51 → **8** | 41 → 0 | 0 → 0 | exactamente 8 de las 10 no-V (5 H-correcta, 3 H-leve) |

No-V que el medidor NO marca (honesto, no se sobreajustó): en el ensayo 5, A02|1|6|15 («pasarían los 45 días en unas cinco
semanas», aritmética propia con letras) y B02|1|4|2 («tres clientes están pasados» con el tope de la persona): conteos y
aritmética dichos con letras que el rastreo no puede juzgar sin el criterio de la persona; los cubre la revisión humana
(`palabras`). Y siguen sin verse todos los H-grave dichos con letras (B01|1|5 «dos de tus tres clientes más grandes»,
B02|1|3, C04|1|2): por eso el veredicto es PROVISIONAL sin `clasificacion.json`.

**El veredicto** consume `clasificacion.json` (`clasificacion.mjs`): `filas` (V · H-correcta · H-leve · H-grave · A por id de
marca), `palabras` y `paraRevisar.noV` (hallazgos que el rastreo no ve: suman al denominador; los H-grave cuentan como
errores; las celdas de la misma oración son UN hallazgo), `casosA` (estado «firme» = error de ADI; «a decidir» =
candidato, que bloquea el cierre). `informe.json` trae `veredictoDetallado` (criterios, N, lista de errores del anfitrión
con su familia, patrones, candidatos, parámetros) y `informe.md` el bloque «Veredicto de cierre».

Pendientes del owner: (1) el **umbral del cumplimiento del contrato** (hoy informativo; parámetro
`umbralDeCumplimientoPct`); (2) si los errores LEVES repetidos cuentan para el patrón (hoy no; `incluirLevesEnElPatron`);
(3) el borde **N < 500** (límite 0 a la letra); (4) dos hallazgos de producto que la medición destapó y no son del medidor (los trabaja el frente de ADI):
las cifras de Unimarc llegan sin id derivable (error firme, ensayo 5 C01 1.5) y `derivar` rechaza los ids de apoyo
`E<n>.e<k>` (candidato, ensayo 5 A03 1.5).
