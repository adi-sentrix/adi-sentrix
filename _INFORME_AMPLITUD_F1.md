# AMPLITUD · FASE 1 — El dato completo al narrador, con el muro subido de nivel

**2026-08-13 · worker sobre dev=46bc587 · rama `claude/gracious-wu-65522e` · NO pusheado.**
Suite: **antes 137 PASS · 0 FAIL · 0 TOCARON LA RED · 0 CON CREDENCIAL VIVA → después 138 · 0 · 0 · 0** (el gate
nuevo entra a la suite). Cero llamadas a proveedor: todo bajo `gates:offline` / `offline-guard`.

**Piezas frenadas: NINGUNA.** Las tres tareas entraron completas sin chocar con el código real. Las decisiones
no obvias que tomé (y por qué) están en §6 — dos de ellas merecen la mirada del arquitecto.

---

## 1 · Qué cambió, archivo por archivo

| Archivo | Qué |
|---|---|
| `src/adi/oracle/datoProyectado.js` (**nuevo**, 226 líneas) | La proyección curada: función pura `proyectarDatoNegocio(scenario)` → texto (14,6KB) y `cifrasDelDato(scenario)` → las 308 cifras con canon+dueño para el muro. Texto y autorizaciones salen del MISMO recorrido — jamás dos listas. Memo por tenant+escenario, invalidado en `initTenant`. |
| `src/adi/oracle/narratePromptC.js` (:54-66, :68-83, :74, :208-214) | `buildNarrateSystemC`/`buildNarrateSystemSegments` ganan el 7º argumento OPCIONAL `datoNegocio` (default null → byte-idéntico para los ~30 callers viejos). `DOCTRINA_DATO_NEGOCIO` nueva (7 líneas de texto, 4 reglas) — el fijo queda `[persona+doctrina | DOCTRINA DEL DATO + EL DATO | cola variable]`: el dato EXTIENDE el prefijo cacheable, nunca lo parte. |
| `src/adi/llm/gatewayCore.js` (:378-384, :428-431) | `handleNarrateC` acepta `datoNegocio` del body (campo hermano de `payload`) y lo pasa al builder segmentado. El corte del caché no se mueve: el dato queda bajo `cache:true`. El gateway NO importa el dato ni lo interpreta — sigue platform-neutral. |
| `src/ui/ChatADI.jsx` (:27, :254-268) | `_fetchNarrateC` recibe `scenario` y manda `datoNegocio: proyectarDatoNegocio(scenario)` como campo PROPIO del body — el `payload` del narrador no crece un byte. |
| `src/adi/oracle/answerViaOracle.js` (:15, :2208-2213, :2432-2435, :2421-2423, 9 sitios de guardC) | `cifrasDelDato(scenario)` se computa una vez por turno y viaja como `datoProyectado` a los MISMOS 9 sitios de guardC que la cuarta fuente (1b). `scenario` viaja en los args de la pasada de narrar (el fetcher lo necesita). `cifra-de-dato-sin-dueno` entra a `_VERDICTOS_DE_REDACCION` (reintento mismo tier + instrucción — la cifra es real, lo que falta es nombrar al dueño). |
| `src/adi/oracle/guardC.js` (:2397-2445 aprox: `_indiceDelDato`, `_duenoEnVentana`, chequeo 1, conteos) | LA QUINTA FUENTE. Solo se consulta cuando las cuatro de siempre YA rechazaron la cifra → aditiva por construcción (ninguna narración que hoy pasa puede empezar a fallar). Cifra del dato + dueño en la MISMA oración (mismo `_localWindow`/`_maskFigures` de los chequeos de dueño, ventana 90) → pasa; sin dueño o con dueño equivocado → veto `cifra-de-dato-sin-dueno` con el dueño verdadero en el detalle. Conteos declarados de la proyección → mitad de conteos del chequeo 2. Chequeos 3-25 intactos. Default null → byte-idéntico. |
| `_probe_amplitud_f1.mjs` (**nuevo**) | 48 PASS · 0 FAIL — las cinco letras del encargo (§3). |
| `_amplitud_dato_narrador_gate.mjs` (**nuevo**) | 17 PASS · 0 FAIL — entra a la suite (137→138) vía `@inspeccion-estatica` (lee gatewayCore/ChatADI como TEXTO, no importa gateway ni adapters, no invoca nada). |
| `_probe_paso0_prefijo.mjs` (:77-81), `_probe_anthropic_dosmodelos.mjs` (:82), `_reparacion_cableado_gate.mjs` (:112-118) | Regex `payload\.reparacion \|\| null\)` → `[,)]`: el builder ganó un 7º argumento DESPUÉS de la reparación. **Análisis garantía-vs-formato**: la garantía (la reparación entra al system desde el payload sellado; el corte del caché declarado) NO cambió — solo el cierre textual de la llamada. Documentado en cada archivo. Re-corridos: 19/19 y 21/21. |

## 2 · Mediciones

| Qué | Valor |
|---|---|
| Proyección (escenario actual) | **14.646 bytes · 13.931 chars · ≈3.850 tokens** (≈3,8 bytes/token es) |
| Ídem, tensión / crisis | 14.756 / ~14.7KB — mismo orden |
| System FIJO de NARRAR — antes | 41.273 bytes (40.103 chars) ≈ **10.860 tok** — 99,9% cacheable (Paso 0 intacto) |
| System FIJO — después (con dato) | 57.528 bytes ≈ **15.140 tok** (+16.255 bytes = dato 14.646 + doctrina ~1.600) — sigue 100% byte-estable entre modos y turnos |
| Payload por turno | **sin cambio** (turno de prueba: 13.823 bytes ≈3.640 tok; no contiene la proyección) |
| El body HTTP por llamada | crece los ~14,6KB del campo `datoNegocio` (tráfico a NUESTRO server, no tokens facturables nuevos por-turno gracias al caché) |

**Nota sobre el tamaño esperado**: el encargo anticipaba ~30-45KB (el demo.js crudo pesa 39KB). La proyección
CURADA quedó en 14,6KB ≈ 3.850 tokens porque no arrastra la sintaxis JS, los transforms de escenario ni los
perfiles estratégicos — es la mitad de costo de lo presupuestado, con el dato de negocio completo.

### Costo incremental por el dato (input extra ≈ 4.280 tok en el fijo, por LLAMADA de narrar)

Tarifas de `modelPricing.js` (mini in $0,15 · sonnet in $3,00 /MTok) + descuentos de caché documentados de cada
proveedor (OpenAI cached input 0,5× · Anthropic cache read 0,1× / write 1,25×):

| Modelo | caché 50% | caché 90% |
|---|---|---|
| gpt-4o-mini (hoy) | $0,00048 /llamada | $0,00035 /llamada |
| claude-sonnet-5 (espejo) | $0,00866 /llamada | $0,00276 /llamada |

Con ~1,33 llamadas de NARRAR por turno (33% reintentos, medido): **sonnet ≈ $0,0037/turno con caché 90%**
(≈ $4,4/mes extra para el conversador de 40 turnos/día — contra los ~$26/mes ya modelados) y ≈ $0,0115/turno
si el caché solo pega al 50%. Con mini es ruido (<$0,001/turno en ambos casos). El PLAN no recibe el dato
(el planificador sigue igual — ver §7), así que Haiku no cambia.

## 3 · Probes y gate (salidas)

- **`_probe_amplitud_f1.mjs` → 48 PASS · 0 FAIL**, las cinco letras:
  (a) proyección byte-estable (dos llamadas idénticas; otro escenario → otro texto también estable) + las DOS
  secciones obligatorias con sus contenidos + «cobertura» ausente / «Días de inventario» presente + 308 cifras
  todas con canon y dueño.
  (b) fijo byte-idéntico entre los 7 modos y 5 variantes de turno CON el dato · el fijo viejo es PREFIJO
  ESTRICTO del nuevo · doctrina (4 reglas) pegada al bloque · `fijo+variable === system` · sin 7º argumento
  todo byte-idéntico · gateway verificado por fuente.
  (c) la garantía madre bidireccional: «Lider vendió $17.9M» PASA · «Jumbo vendió $17.9M» VETO
  `cifra-de-dato-sin-dueno` (el detalle nombra a Lider) · «$17.9M» sin dueño VETO · «$77.7M» inventada VETO
  `cifra-no-autorizada` · sin la fuente el muro es byte-idéntico · fuente ADITIVA (boleta del turno pasa
  idéntico con o sin dato) · inventario con dueño SKU/bodega · la vara solo con sus nombres (benchmark/meta).
  (d) huecos: transferencia+lead time con «14d» inventado → VETO · «dejaron de comprar $9.9M» → VETO — y la
  sección del system declina de antemano (doctrina + muro, dos capas).
  (e) payload sin la proyección (medidos ambos) · `datoNegocio` hermano de `payload` en el fetcher ·
  **data_only/results_only: CERO invocaciones al narrador** (la rama no aplica — afirmado con arnés inyectado).
- **`_amplitud_dato_narrador_gate.mjs` → 17 PASS · 0 FAIL**, corrido DENTRO de la suite.
- `_probe_paso0_prefijo.mjs` 19/19 · `_probe_anthropic_dosmodelos.mjs` 21/21 (post-ajuste de regex).

## 4 · Suite completa

- **Antes** (base 46bc587, este worktree): `137 PASS · 0 FAIL · 0 TOCARON LA RED · 0 CON CREDENCIAL VIVA` (log `_suite_antes_amplitud.log`, no commiteado).
- **Después de los cambios de motor, antes del gate nuevo**: `137 · 0 · 0 · 0` — ningún gate existente se movió
  por guardC/answerViaOracle/narratePromptC (la aditividad no es un dicho: se midió).
- **Final con el gate nuevo**: `138 PASS · 0 FAIL · 0 TOCARON LA RED · 0 CON CREDENCIAL VIVA`.
- Gates ajustados: SOLO `_reparacion_cableado_gate.mjs` (regex de formato, §1) — ningún otro se movió.

## 5 · La doctrina nueva (dentro del punto de freno)

`DOCTRINA_DATO_NEGOCIO` son 7 líneas de texto (~1.600 bytes), condicional al 7º argumento, SIN tocar ninguna
sección existente de narratePromptC — muy por debajo del freno de ~25 líneas. Contenido: qué es el bloque
(conocimiento para entender/contextualizar) + las tres prohibiciones del encargo (no calcules hacia la
pantalla — decí qué cuenta falta; no cruces los dos universos; no afirmes lo ausente) + una cuarta regla que
agregué: **«cada cifra con su dueño, en la misma oración»** — el narrador tiene que SABER la condición que el
muro le va a cobrar, o la aprendería a golpes a un reintento por turno (la lección del caso afinidad,
2026-08-12).

## 6 · Decisiones no obvias (para la revisión del arquitecto)

1. **La proyección se computa en el CLIENTE y viaja en el body** (campo `datoNegocio`, hermano de `payload`) en
   vez de computarse en el gateway. Por qué: el tenant activo VIVE en el cliente (tenantStore es global de
   módulo del browser; el server no corre `initTenant`), y el gateway declara «no toca el motor sellado» —
   importarle el dato lo acoplaría al dataset. El costo es ~14,6KB de body por llamada hacia nuestro server
   (no son tokens nuevos). Es el mismo modelo de confianza actual: el cliente ya manda el payload entero con
   todas las cifras, y el muro corre client-side.
2. **El formateador de la boleta, sin exportarlo ni copiarlo**: `_fmtC` es privado de `boleta.js` (intocable).
   La proyección formatea dándole el crudo a `parseFigures` (exportado del MISMO archivo) y leyendo el canon —
   que se construye con ese mismo `_fmtC`. Cero segundo formateador; matching por canon garantizado.
3. **Colisión de canon entre filas** (límite conocido, no defecto nuevo): el canon es `unit:valor`, así que
   «$17.9M» tiene DOS dueños legítimos (Lider·Ventas y Falabella·año anterior) y cualquiera valida la ventana.
   Es la MISMA tolerancia que el ledger ya tiene (falso negativo antes que falso positivo). El binding de
   métrica (chequeo 9) sigue juzgando solo las figs del turno — extenderlo al dato es refuerzo posible de fase
   posterior si la certificación lo pide.
4. **La vara y el target tienen dueños de CONCEPTO, no de entidad**: benchmark → «benchmark/referencia/piso»;
   target de carga → «meta/target/objetivo» (deliberadamente NO «carga»: «la carga comercial de Falabella es
   3.5%» sería falso y habría pasado). Probe lo afirma.
5. **La serie mensual NO se proyecta**: `trend` la sirve ANCLADA al escenario y reconciliada
   (`buildGlobalEvolutionAnclada`); proyectar la cruda de `ventasMensuales` sería una segunda verdad que
   diverge mes a mes. El mes a mes sigue llegando por su tool, como hoy. Tampoco se proyectan agregados por
   canal (los computa el motor en sus tools — este módulo no suma nada).
6. **Los 9 sitios de guardC** reciben la fuente (los mismos de la cuarta), incluidos los de texto
   determinístico — inofensivo (el compositor solo cita figs del ledger) y evita un tercer criterio de
   inyección. El bypass pre-plan (`_composedBypassResult`) deliberadamente NO — igual que en 1b.
7. **Kind en ASCII**: `cifra-de-dato-sin-dueno` (sin ñ), consistente con todos los kinds existentes.
8. **Los huecos como constante del módulo**: no existe un registro de huecos en `src/config/contract/` — la
   lista sale de CLAUDE.md §4 (verificada) + los límites que los composers ya declaran en pantalla. Si mañana
   se quiere un `gapRegistry` declarativo, la constante `_HUECOS` es el contenido listo para migrar.

## 7 · Lo que NO se hizo (por encargo)

Ni calculadora ni contexto general (fases 2). `planPrompt`/el PLAN intactos — **propuesta para el informe**: el
planificador hoy elige tools sin ver el mapa; con el dato en su segmento fijo (mismo mecanismo, ~3.850 tok
sobre Haiku ≈ $0,0004/llamada con caché 90%) probablemente alucine menos calls (el hallazgo C3 de la cert #2
era exactamente eso). Es decisión de producto+costo del owner para una fase posterior.
`glossary/hiloBudget/adapters/modelPricing/modelDefaults` intactos. `data_only/results_only` intactos y
afirmados en probe. NO push. `_cert_vivo_openai.mjs` ni tocado ni corrido.

## 8 · Commits (rama del worktree, base 46bc587, NO pusheado)

1. `0b9abf8` — `datoProyectado.js`, el módulo nuevo.
2. `9867b18` — `narratePromptC.js`: el 7º argumento + la doctrina del dato en el fijo.
3. `8a4d467` — `gatewayCore.js`: el dato del body al segmento cacheable.
4. `5e4401f` — `ChatADI.jsx`: el fetcher arma y manda la proyección (hermana del payload).
5. `e448fa3` — `guardC.js` + `answerViaOracle.js`: la quinta fuente con dueño por cercanía (motor, una pieza).
6. `1f6a0ba` — `_probe_amplitud_f1.mjs` (48/48).
7. `c8dbf0e` — `_amplitud_dato_narrador_gate.mjs` (137→138).
8. `35abdb7` — los tres verificadores ajustados (regex de formato con su análisis).
9. este informe.
