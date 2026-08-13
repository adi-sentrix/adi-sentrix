# INFORME · Paso 1b «ADI pierde el hilo» — la boleta del turno anterior como cuarta fuente de autorización

**Worker** · 2026-08-13 · base `dev = 0db6787` (Pasos 0-2 + prep Anthropic) · rama `claude/wizardly-hugle-8b2932` · SIN push.
**Candados de gasto respetados**: cero llamadas a proveedor; verificación solo `npm run gates:offline` y probes con `node --import ./scripts/offline-guard.mjs`. Los archivos nuevos no contienen ningún marcador de red del clasificador (verificado con grep: exit 1 = limpio).

**El defecto que cierra.** Desde el Paso 1 el narrador VE el texto completo del turno anterior (hilo_reciente, tabla y cifras incluidas), pero si re-citaba una de esas cifras al explicar —«los $17.8M de Lider que te mostré»— guardC la vetaba como `cifra-no-autorizada`: la boleta del turno actual no la traía. Costo real: reintentos pagados de más y explicaciones sin números en turnos clarify/seguimiento. El Paso 1 le dio los ojos; este paso le da el permiso.

---

## 1 · Qué cambió, archivo:línea

### `src/adi/oracle/guardC.js` (Pieza 2)
- **:65** `export const conteosAutorizadosDelTurno = _authorizedCounts;` — alias exportado del derivador privado de conteos, para que answerViaOracle persista los conteos con LA MISMA derivación que usa el chequeo 2 (nunca una segunda paralela).
- **:2397** firma de `guardC`: opt NUEVO y OPCIONAL `boletaAnterior = null`. Default null → comportamiento byte-idéntico (ningún caller existente cambia).
- **:2415-2419** la cuarta fuente: los `value` de `boletaAnterior.figs` se parsean con `parseFigures` (el MISMO parser del chequeo 1, nunca un segundo) y sus canon/text entran a `authCanon`/`authVerbatim` — la cifra re-citada queda con el MISMO estatus que el eco de la pregunta (`qFigs`), ni más ni menos.
- **:2443** chequeo 2: `boletaAnterior.counts` (números finitos) entra a `authCounts`.
- **NADA MÁS**: `authCanon`/`authVerbatim` solo se leen en el chequeo 1 (verificado por grep — usos en :2426/:2427/:2443 de la versión nueva); los chequeos 3-21 (dueño, subtotal-como-total, mecanismo, binding de métrica, proporcionalidad…) siguen operando SOLO sobre las figs del turno actual (`figs`/`ledger`), que no se tocaron. Ningún chequeo existente se relajó: solo se SUMÓ una fuente de autorización a los chequeos 1 y 2.

### `src/adi/oracle/narrationContract.js` (Pieza 4)
- **:621-634** `_memoriaSinVista` ahora excluye TAMBIÉN `boletaAnterior`, por el MISMO filtro y la misma razón que `viewContext`: es permiso para el muro, no dato para el narrador (que ya ve esas cifras EN EL TEXTO de hilo_reciente). Las DOS proyecciones del payload (`projectNarratePayload` y `projectClaimsOnlyPayload`) leen `c.memoria` ya filtrada, así que un solo punto cubre ambas. Cuando `mem` no trae ninguna de las dos keys devuelve la MISMA referencia → contrato byte-idéntico en el 100% de los turnos existentes. `renderInteractionMemory` (persona.js, el bloque de memoria del system de PLAN y NARRAR) solo rinde keys conocidas — verificado con probe que no rinde la boleta.
- Prompts/doctrina intactos: `narratePromptC.js`, `planPrompt.js`, `conversationalContract.js` sin un solo cambio (diff limpio).

### `src/adi/oracle/answerViaOracle.js` (Piezas 1 y 3)
- **:14** import de `conteosAutorizadosDelTurno`.
- **:1197-1202** `BOLETA_ANTERIOR_FIGS_MAX = 24` — mismo criterio y mismo valor que `MEMORY_SCOPE_ENTITIES_MAX` (persona.js), el precedente de cap que el diseño nombró.
- **:2119-2139** PERSISTENCIA (Pieza 1): al cierre del batch, `mem2.boletaAnterior = { scenario, figs, counts }` — key HERMANA de conversationScope, escrita en el MISMO punto que `viewContext` (el patrón ViewContext que pidió el diseño). `figs` = las figs del ledger PODADO del turno (label+value verbatim como strings, cap 24 — ver §5.d); `counts` = `[...conteosAutorizadosDelTurno(ledger, results)]`. **Solo escribe un turno CON datos** (`if (figs.length)`): un «no entiendo» intermedio no pisa la boleta que el próximo turno necesita explicar (la key sobrevive por el spread de `mem` en `mem2`). Se REEMPLAZA entera en cada turno con datos, nunca se acumula.
- **:2146-2154** LOS TRES CANDADOS (Pieza 3): `boletaAnteriorAutorizada` se computa UNA vez, leyendo `mem.boletaAnterior` (la memoria ENTRANTE — la del turno actual recién se escribió en `mem2` y es para el próximo): (a) `scenario` igual al del turno; (b) el turno NO es corrección — se juzgan la reparación CRUDA (`_reparacion`, incluye las inferidas) Y la SELLADA (`reparacionSellada`): basta que cualquiera declare `tipo:"correccion"` para no inyectar; (c) existe. Null en cualquier otro caso.
- **9 sitios de guardC** reciben `boletaAnterior: boletaAnteriorAutorizada` (ver §4).

### Archivos nuevos
- **`_probe_paso1b_recita.mjs`** — probe A1-A5, 29 PASS / 0 FAIL (salidas en §2).
- **`_recita_turno_anterior_gate.mjs`** — el blindaje permanente, 14 PASS / 0 FAIL, DENTRO de la suite: header 133→134 (la trampa del clasificador, verificada — §3).
- Ambos ejercitan `answerViaOracle` ENTERO con las dos pasadas inyectadas por **key computada**: ninguno contiene los strings que el clasificador estático usa como marcador de red (verificado con grep).

---

## 2 · Salidas de A1-A5 (probe `_probe_paso1b_recita.mjs`, offline, runPlan real)

```
[A1a] TURNO 1 · marginRead real deja mem.boletaAnterior escrita
  ✓ el turno 1 responde (compositor determinístico sobre la boleta real)
  ✓ mem.boletaAnterior quedó escrita
  ✓ …con el scenario del turno («actual»)
  ✓ …con figs del ledger (24)
  ✓ …cada fig con label+value verbatim (strings)
  ✓ …y el cap de 24 se respeta (24 ≤ 24)
  ✓ …con los conteos autorizados del turno (3)
  ✓ hay una fig re-citable en la boleta («Lider · Margen» = 21.5%)
[A1b] TURNO 2 · con la boleta en memoria, la re-cita SALE al usuario
  ✓ la narración que re-cita la cifra del turno 1 PASA guardC y llega al usuario
  ✓ …al PRIMER intento (narró 1 vez/veces)
  ✓ un turno SIN datos NO pisa la boleta guardada (misma referencia)
[A1c] TURNO 2 · SIN la boleta en memoria, la MISMA narración es VETADA (garantía vieja intacta)
  ✓ sin permiso, la cifra re-citada NO llega al usuario
  ✓ …los 2 intentos que la política permite fueron vetados (narró 2)   ← ver §5.b
  ✓ guardC sin el opt: cifra-no-autorizada (byte-idéntico al comportamiento de siempre)
  ✓ guardC con el opt: la MISMA narración pasa
[A2a] ✓ cifra INVENTADA ($987.6M) vetada aun con la boleta presente
[A2b] ✓ scenario «bonanza» sobre boleta «actual» → la re-cita se veta (el caller no inyecta)
[A2c] ✓ reparación tipo corrección → la re-cita se veta (el caller no inyecta)
[A3]  ✓ «8 clientes» re-citado pasa · ✓ sin boleta se veta · ✓ «20 clientes» inventado se veta
[A5a] ✓ el motor SÍ tiene la boleta en su memoria interna en ese instante (el caso no es trivial)
      ✓ memoria_interaccion del payload NO trae boletaAnterior (mismo filtro que viewContext)
      ✓ la palabra no aparece en NINGUNA parte del payload proyectado
      ✓ el bloque de memoria del system tampoco la rinde
[A5b] (figs autorizadas del turno grande: 119 · persistidas: 24)
      ✓ la boleta persistida respeta el cap · ✓ con >24 figs persiste EXACTAMENTE 24
── _probe_paso1b_recita: 29 PASS · 0 FAIL ──
```

El gate permanente reproduce las mismas garantías en versión condensada: `── LA RE-CITA DEL TURNO ANTERIOR · 14 PASS · 0 FAIL ──`.

---

## 3 · Las dos corridas de gates (A4)

| Corrida | Resultado |
|---|---|
| ANTES (base 0db6787, sin tocar nada) | `133 PASS · 0 FAIL · 0 TOCARON LA RED · 0 CON CREDENCIAL VIVA (de 133 offline)` |
| DESPUÉS (motor + probe + gate nuevo) | `134 PASS · 0 FAIL · 0 TOCARON LA RED · 0 CON CREDENCIAL VIVA (de 134 offline)` |

133→134: el único delta es `_recita_turno_anterior_gate.mjs`, que ENTRÓ a la suite (no fue excluido en silencio por el clasificador — la trampa que el encargo pidió verificar por el conteo del header). Ningún gate existente cambió de estado (0 FAIL en ambas; exit 0). Ningún fixture se movió por la firma nueva: el opt es opcional con default null.

---

## 4 · El mapa de los puntos de guardC y por qué

`answerViaOracle` invoca guardC en 10 sitios. Los **9 del camino post-batch** reciben el opt (líneas de la versión nueva):

| Línea | Sitio | Por qué se pasa |
|---|---|---|
| :2190 | ruta determinística (`_rutaDeterministica`) | camino narrado; el texto compone solo figs del turno, el opt no cambia nada — se pasa por uniformidad (un solo criterio para todo el camino narrado) |
| :2276 | rama `data_only`/`results_only` | composición determinística desde la boleta ACTUAL — el opt no cambia el resultado (verificado: la suite no movió ningún gate de preferencia); se pasa por uniformidad, como pidió el encargo |
| :2395 | veredicto principal del loop de NARRAR | **el sitio del defecto** — acá se vetaba la re-cita |
| :2422 | salida determinística tras `tabla-faltante`/`tabla-no-autorizada` | repara el MISMO texto del loop; sin el opt, una reparación de forma podría vetar lo que el loop ya autorizó |
| :2491 | reparación controlada (full/action_only, 3 intentos agotados) | mismo criterio |
| :2504 | `ensureDeclinacionDeSuma` sobre narración aceptada | el envoltorio no puede ser más estricto que el texto que envuelve |
| :2511 | `ensureCoberturaDeclarada` sobre narración aceptada | ídem |
| :2574 | recorte `solo_conclusion` | el recorte de una narración con re-cita autorizada no puede vetarse por conservarla |
| :2596 | recomposición sin-cuerpo (forma garantizada) | ídem |

**El sitio 10 (:1139, `_composedBypassResult`) NO recibe el opt, deliberadamente**: es un helper PRE-plan de los bypasses (aceptación huérfana, retorno ambiguo, pregunta de precisión) que valida prosa FIJA sin cifras ni entidades, con ledger vacío, ANTES de que existan `scenario`-check, `_reparacion` o `reparacionSellada` (los candados no se pueden computar ahí). Sus textos jamás re-citan cifras; pasarle la boleta sería autorizar de más en un camino que no lo necesita.

---

## 5 · Decisiones no obvias y desvíos del diseño

a) **`figs` persistidas = el ledger PODADO (`_podaLedger.figs`), no el crudo.** Es la lista que el turno usó para componer, autorizar claims y proyectar `cifras_autorizadas` al narrador. Una columna podada por divulgación progresiva («podadas del ledger = NO autorizadas») no debe volverse citable un turno después por la puerta de la boleta. Nota de auditoría en frío: guardC recibe `ledger` (crudo) en los 9 sitios — eso es PREEXISTENTE, no lo introduje ni lo toqué.

b) **A1 esperaba «3 intentos vetados»; son 2.** La política del reintento económico (owner 2026-08-11): `cifra-no-autorizada` es veredicto DE REDACCIÓN — al segundo rechazo el motor deja de gastar y resuelve el compositor determinístico. El probe afirma `narró 2` con la explicación en comentario. La garantía pedida (la MISMA narración sin el opt NO sale al usuario) queda demostrada igual, de punta a punta.

c) **Candado (b) juzga la reparación cruda Y la sellada.** `buildReparacion` puede descartar por inconsistencia una corrección que el plan sí declaró (y `inferirCorrige` puede inferir una que el plan no declaró). Ante cualquiera de las dos señales, no se inyecta: en un turno de corrección, antes falso negativo (una re-cita legítima vetada un turno) que falso positivo (autorizar una cifra de un alcance que el usuario acaba de corregir).

d) **`counts` = la derivación real de `_authorizedCounts`, exportada como alias (`conteosAutorizadosDelTurno`).** El diseño ofrecía caer a `parseCounts` sobre los values si extraerla era invasivo — no lo fue (una línea de export). Diferencia a favor: el set incluye los conteos derivables de los facts (largos de arrays), que es EXACTAMENTE lo que el chequeo 2 aceptó ese turno; `parseCounts` sobre los values habría capturado menos (los values son montos/porcentajes, casi nunca «N clientes»). Sin cap propio: es un set de enteros chicos (3 elementos en el turno medido).

e) **El filtro de la Pieza 4 exigió UNA edición en `narrationContract.js`** (el diseño decía «verificá que quede excluida por el mismo filtro»): `_memoriaSinVista` filtraba SOLO `viewContext` por destructuring explícito, así que sin la edición la boleta entraba entera a `memoria_interaccion` (el probe A5a lo demuestra por la negativa: el motor la tiene en `mem2` en el instante de narrar). Se extendió EL MISMO filtro, no se creó uno nuevo. Prompts intactos.

f) **Los archivos nuevos usan keys computadas** para inyectar las dos pasadas del oráculo: el mandato prohibía los strings-marcador aunque existe el escape oficial `@inyeccion-simulada`. Con keys computadas el gate ni siquiera necesita el escape: el clasificador no ve ningún marcador y lo corre como offline pleno (header 134 lo confirma).

g) **Residual que dejo anotado (no es de este paso):** el candado (a) compara `scenario` del turno contra el de la boleta; si el owner ejecuta «colapsar escenarios» (memoria `adi-colapsar-escenarios`), este check queda trivialmente verdadero y habrá que decidir si la boleta sobrevive al colapso o se invalida en la migración.

---

## 6 · Commits (locales, SIN push, archivo por archivo)

| Hash | Archivo | Qué |
|---|---|---|
| `8ba8af5` | `src/adi/oracle/guardC.js` | la cuarta fuente (chequeos 1-2) + export del derivador de conteos |
| `b83503c` | `src/adi/oracle/narrationContract.js` | boletaAnterior excluida de memoria_interaccion por el filtro de viewContext |
| `f3153b4` | `src/adi/oracle/answerViaOracle.js` | persistencia de la boleta + tres candados + opt en los 9 sitios |
| `d44e9af` | `_probe_paso1b_recita.mjs` | probe A1-A5 (29/29) |
| `00695d6` | `_recita_turno_anterior_gate.mjs` | blindaje permanente (14/14, suite 133→134) |
| `(el commit de este archivo)` | `_INFORME_PASO_1B.md` | el informe |

Los 4 archivos ajenos de la sesión Falcon no aparecen en este worktree (status limpio al empezar) y no se tocaron ni commitearon. Nunca se usó `git add -A` ni `commit -a`.
