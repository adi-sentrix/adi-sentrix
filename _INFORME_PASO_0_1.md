# INFORME · Pasos 0 y 1 del plan "ADI pierde el hilo" (sesión worker, 2026-08-13)

Encargo: arquitecto (sesión Falcon-heredero) · plan aprobado por el owner · alcance ESTRICTO Pasos 0 y 1.
Rama: `dev` · base `c133dc3` · 100% offline (cero llamadas a proveedor; toda verificación con
`npm run gates:offline` y probes corridos bajo `scripts/offline-guard.mjs`, red físicamente bloqueada).

---

## 1 · Qué cambió, archivo por archivo

### Paso 0 — prefijo estable para el caché de NARRAR (commit `4f2998b`)

| Archivo | Qué cambió |
|---|---|
| `src/adi/oracle/narratePromptC.js` (~línea 42-90) | `buildNarrateSystemC` se reestructuró en `_narrateSystemParts` → `{fijo, variable}`. El segmento FIJO: persona + tarea + regla de cifras + **los 7 modos completos** (`buildModeDispatch()` sin argumento — el fallback documentado; el payload ya trae `modo` y el header del dispatch declara que ese campo decide) + toda la doctrina estable hasta HONESTIDAD. La cola VARIABLE (al final): doctrina de reparación, preferencia de respuesta, CONTEXTO DE PANTALLA (extraído a la const `DOCTRINA_CONTEXTO_VISTA_NARRAR`, texto intacto) y memoria de interacción + la instrucción de cierre. Nueva export `buildNarrateSystemSegments` (mismo patrón que `buildPlanSystemSegments`). `buildNarrateSystemC` devuelve `fijo + variable` — los ~30 callers/gates viejos siguen funcionando; el argumento `mode` queda en la firma y ya no se lee. **El contenido de la doctrina no se tocó: mismos textos, otro orden.** |
| `src/adi/llm/gatewayCore.js` (línea 23 y ~420-435) | `handleNarrateC` arma el system SEGMENTADO: `[{text: fijo, cache: true}, {text: variable, cache: false}]` — la misma segmentación que PLAN usa en la línea ~332. El adapter ya sabía concatenar segmentos (`_systemText`), así que lo que el proveedor lee es byte-idéntico a `buildNarrateSystemC`. |
| `_reparacion_contextual_gate.mjs` (~línea 405) | Fixture de MEDICIÓN actualizado: `BASE.narrarDefault` 36.096 → 39.524, documentado en el propio gate con el mismo criterio de sus subas anteriores ("el presupuesto existe para que el costo se DECIDA"). La garantía del gate no cambió: NARRAR sigue sin crecer POR TURNO (la doctrina de reparación sigue condicional y el gate lo sigue midiendo). |
| `_reparacion_cableado_gate.mjs` (~línea 112) | Fixture de CABLEADO actualizado: el regex exigía `buildNarrateSystemC(...payload.reparacion \|\| null)` en el gateway; ahora exige `buildNarrateSystemSegments(...)`. La garantía protegida es la misma: la reparación entra al system desde el payload sellado, nunca del plan crudo. El segundo chequeo del gate (la doctrina condicional `doctrinaReparacion ? ...`) se preservó usando la MISMA expresión literal en la cola variable — ese fixture no se tocó. |
| `_probe_paso0_prefijo.mjs` (nuevo) | El probe de A0.1/A0.2 (ver §2). |

### Paso 1 — la conversación completa (commit: ver §6)

| Archivo | Qué cambió |
|---|---|
| `src/adi/oracle/hiloBudget.js` (nuevo) | LA política, una sola para los dos embudos: `aplicarPresupuestoHilo(turnos, presupuesto)` — el último turno de ADI SIEMPRE entero; hacia atrás turnos completos mientras quepa el presupuesto; el que no cabe se resume a su primera oración + "…" (`primeraOracion`: la frontera de oración ignora el punto entre dígitos — "34.2%" y "$4.207.331" no cortan; una oración kilométrica o una tabla sin puntuación se corta en el último ESPACIO antes de `RESUMEN_TURNO_MAX_CHARS`=280, nunca dentro de una cifra). Constantes nombradas: `PLAN_HILO_PRESUPUESTO_CHARS`=8.000 · `NARRAR_HILO_PRESUPUESTO_CHARS`=6.000 · `RESUMEN_TURNO_MAX_CHARS`=280. Prioridad de campo INVERTIDA: `textoDeTurno` = `m.text \|\| m.gist` (el gist era la adaptación al corte de 220; queda como fallback para callers/gates que mandan turnos solo-gist — verificado por grep y por probe que nada se rompe). |
| `src/adi/oracle/planPrompt.js` (líneas ~9-11 y ~233-245) | `buildPlanUserMessage`: el `.slice(0,220)` por turno se reemplaza por `aplicarPresupuestoHilo(h, PLAN_HILO_PRESUPUESTO_CHARS)`. El `slice(-8)` NO se tocó. |
| `src/adi/oracle/narrationContract.js` (líneas ~70 y ~660-670) | `hiloReciente`: mismo reemplazo con `NARRAR_HILO_PRESUPUESTO_CHARS`. El `slice(-4)` NO se tocó. |
| `_probe_paso1_hilo.mjs` (nuevo) | El probe de A1.1/A1.2 (ver §2). |

---

## 2 · Mediciones antes / después

### A0.1 · prefijo común del system de NARRAR entre modos

ANTES (medido sobre el archivo de HEAD `c133dc3`, mismo método):

```
ANTES · peor par: default<->clarify · prefijo 7679 de 37426 (20.5%)
ANTES · largos: default=36096 · diagnostico=36211 · decision=36382 · simulacion=36180
        · seguimiento=36287 · evidencia=36624 · clarify=37426
```

DESPUÉS (`node --import ./scripts/offline-guard.mjs _probe_paso0_prefijo.mjs` → 19 PASS · 0 FAIL):

```
── A0.1 · prefijo común par a par entre los 7 modos ──
  peor par: (todos idénticos) · prefijo común 39524 de 39524 chars (100.0%)
  ✓ prefijo común ≥ 95% del system en el PEOR par (obtuvo 100.0%)
  ✓ de hecho los 7 systems son BYTE-IDÉNTICOS (el modo del turno viaja en el payload, no en el system)

── A0.2 · la doctrina de CADA modo sigue en el system, byte-idéntica al contrato ──
  ✓ doctrina de "default" (135) · "diagnostico" (246) · "decision" (420) · "simulacion" (216)
    · "seguimiento" (322) · "evidencia" (661) · "clarify" (1465) — las 7 presentes byte-idénticas
  ✓ el dispatch COMPLETO (los 7 modos con su header) está embebido tal cual

── SEGMENTOS ──
  ✓ segmento FIJO idéntico (39.475 chars) en las 5 variantes: turno pelado · con memoria · con
    pantalla · con reparación · con preferencia no-default
  ✓ fijo + variable === system completo, byte por byte
  ✓ todo lo por-turno (reparación · pantalla · memoria) vive en la cola VARIABLE
  turno típico: fijo 39.475 chars · variable 49 chars · cacheable 99.9%
  ✓ el gateway arma el system de NARRAR con los segmentos y declara el corte al final del fijo
```

**Costo del cambio**: el system pasa de 36.096 a 39.524 chars en modo default (+3.428 chars ≈ +857
tokens ≈ +9,5% nominal — el arquitecto estimó +5%; la diferencia es que los modos grandes, clarify
1.465 chars, pesan más que el promedio). Ese costo se paga UNA vez por ventana de caché y el prefijo
100% estable lo descuenta en cada llamada; antes, cada cambio de modo pagaba el ~79% del system entero
sin descuento.

**Alternativa medida (dispatch por-modo en la cola variable)**: costaría 305–1.635 chars SIN caché en
cada llamada (según el modo), contra 3.733 chars CACHEADOS de los 7 modos completos. A precio de caché
(~10% del token normal) la opción elegida es además más barata, y la alternativa **viola A0.2** (exige
los 7 textos presentes). Se descartó con medición, no por preferencia.

### A1.1 · el caso real del owner

`node --import ./scripts/offline-guard.mjs _probe_paso1_hilo.mjs` → 18 PASS · 0 FAIL:

```
── A1.1 · el caso del owner: la tabla completa sobrevive al hilo ──
  respuesta larga reconstruida: 1189 chars (el caso real medía 1.191)
  ✓ PLAN recibe las 8 filas de la tabla, verbatim
  ✓ PLAN recibe la respuesta larga ENTERA (prosa + tabla + cierre)
  ✓ y el turno actual viaja completo por su canal
  ✓ hiloReciente de NARRAR trae las 8 filas de la tabla, verbatim
  ✓ la respuesta larga viaja ENTERA como un turno del hilo
  ✓ la ventana por cantidad no cambió: slice(-4) → 4 turnos
```

Antes, de esa respuesta sobrevivían 220 de 1.191 chars (18,5%) en los dos embudos.

### A1.2 · el presupuesto acota (20 turnos de 3.000 chars)

```
  PLAN: ventana 8 turnos · presupuesto 8000 · hilo resultante 6621 chars · enteros 2/8
  ✓ el hilo nunca supera presupuesto+10% (6621 ≤ 8800)
  ✓ el último turno de ADI va ENTERO (3.000 chars)
  ✓ el recorte empezó por lo más viejo (turno 1 resumido a 104 chars + "…")
  ✓ los turnos enteros son un tramo contiguo al FINAL del hilo
  NARRAR: ventana 4 turnos · presupuesto 6000 · hilo resultante 6207 chars · enteros 2/4
  ✓ (los mismos 4 chequeos, todos verdes)

── extra ──
  ✓ un turno SOLO-gist (gates/callers viejos) sigue usando gist como fallback
  ✓ con text Y gist, gana el TEXTO (prioridad invertida: text || gist)
  ✓ la primera oración respeta "22.1%" y "$4.207.331" (el punto entre dígitos NO corta)
```

Nota estructural para el arquitecto: el acotamiento garantizado es `presupuesto + resúmenes (≤281
c/u) + el último turno de ADI si ÉL SOLO excede el presupuesto` (ese turno jamás se trunca, por
diseño — es la tabla que "eso" señala). En el peor caso teórico (turnos enteros que llenan justo el
presupuesto + 6 resúmenes en PLAN) el total puede llegar a ~+21% del presupuesto; en los escenarios
medidos queda holgadamente bajo +10%. Si se quiere una cota dura del 10% hay que decidir entre
achicar `RESUMEN_TURNO_MAX_CHARS` o descontar los resúmenes del presupuesto — decisión de producto,
no la tomé.

---

## 3 · Las corridas de gates:offline

**(A0.3) BASE, antes de tocar nada** (`dev` = `c133dc3` + archivos ajenos sin commitear):

```
132 PASS · 0 FAIL · 0 TOCARON LA RED · 0 CON CREDENCIAL VIVA (de 132 offline)
```

**(A0.3) DESPUÉS del Paso 0**:

```
132 PASS · 0 FAIL · 0 TOCARON LA RED · 0 CON CREDENCIAL VIVA (de 132 offline)
```

Diff línea a línea entre las dos corridas: ningún gate cambió de estado. Las únicas diferencias son
informativas: dos mediciones de tamaño del cuerpo aislado de `handleNarrateC` que crecieron por el
nuevo cableado (5.979→6.402 y 6.487→6.914 chars — son `console.log` de un gate, no aserciones) y
tiempos de corrida.

Dos gates exigieron actualización de FIXTURE para seguir verdes tras el Paso 0 — ambos afirman el
formato, no una garantía, y los dos quedaron documentados en el propio gate (ver §1):

1. `_reparacion_contextual_gate.mjs` — fija por número el largo medido del system (36.096). Es el
   fixture de contabilidad de costo; el gate mismo documenta el procedimiento de subirlo declarando
   qué lo paga. Diff: `narrarDefault: 36096` → `39524` + bloque de justificación.
2. `_reparacion_cableado_gate.mjs` — fija por regex el NOMBRE del builder que recibe
   `payload.reparacion` en el gateway. La garantía (la reparación viaja del payload sellado al
   system) se re-afirma idéntica sobre el nombre nuevo. Diff: `buildNarrateSystemC\(` →
   `buildNarrateSystemSegments\(` + comentario.

**(A1.3) DESPUÉS del Paso 1**:

```
132 PASS · 0 FAIL · 0 TOCARON LA RED · 0 CON CREDENCIAL VIVA (de 132 offline)
```

Análisis gate por gate contra la corrida del Paso 0: **ningún gate cambió de estado** — el diff
completo de los dos logs (excluidos los tiempos de corrida) tiene UNA sola línea de diferencia, y es
informativa: `_vocabulario_vara_gate` ahora cuenta `29245` literales en vez de `29244` (el barrido
estático de prosa incluyó los strings del módulo nuevo `hiloBudget.js`) y sigue PASS. Los 16 «✗» que
aparecen dentro de los logs son negativos de control preexistentes (idénticos en las tres corridas:
base, Paso 0 y Paso 1). Ningún fixture necesitó actualización por el Paso 1 — ningún gate offline
fijaba por string el payload con turnos de 220 chars, y los gates que mandan turnos solo-gist siguen
cubiertos por el fallback `text || gist`.

---

## 4 · Lo que NO toqué y por qué

- **guardC.js** (A1.4): intacto, ni una línea. Hallazgo esperable para el arquitecto: con el hilo
  completo, el narrador ahora VE en `hilo_reciente` las cifras de sus respuestas anteriores; si las
  re-cita sin que estén en `cifras_autorizadas` del turno actual, guardC las vetará igual que hoy.
  Eso no es un defecto de este cambio — es exactamente el análisis que el plan reserva para el Paso
  1b (la boleta del turno anterior al narrador), que NO hice por estar fuera de alcance.
- **La boleta del turno anterior al narrador** — Paso 1b, del arquitecto.
- **Glosario / resolveGlossary / defineConcept / composeNoDataMessage** — Pasos 2/3.
- **Modelos, tiers, modelRouter** — Paso 4 (decisión tomada, se implementa después de medir 0-1).
- **Los 4 archivos ajenos de la sesión Falcon** (`src/adi/llm/numberGuard.js`,
  `src/adi/llm/entityGuard.js`, `_guard_gate.mjs`, `_evidence_spec_views_gate_entry.jsx`): siguen
  sucios en el árbol, sin tocar y sin commitear (todo `git add` fue archivo por archivo).
- **El tercer embudo de 220/200/160 chars** que existe en `conversation.js`
  (`buildConversationContext`, para el LLM #1 de la ruta vieja) — NO estaba en el encargo (que nombra
  exactamente dos embudos) y no lo toqué; queda anotado como decisión para el arquitecto (§5).
- **La ventana por cantidad** (`slice(-8)` / `slice(-4)`): intactas, decisión del owner.

## 5 · Decisiones no obvias que encontré y dejo al arquitecto

1. **`buildConversationContext` (conversation.js:93-99) tiene el mismo patrón de recorte** (user
   200 chars, gist de ADI 160 chars) para el LLM #1 de la ruta legacy/spec. Si la ruta vieja sigue
   viva en producción, "explícame eso" por esa ruta sigue ciego. Fuera de alcance del encargo; lo
   dejo nombrado.
2. **La cota dura del +10% en A1.2 no es estructural en el peor caso teórico** (ver la nota de §2,
   A1.2). Los escenarios de aceptación pasan con margen; la cota absoluta exige una decisión (resumen
   más corto vs. descontar resúmenes del presupuesto).
3. **El costo nominal del Paso 0 es +9,5% de chars del system, no +5%** como estimaba el plan (la
   doctrina de clarify pesa 1.465 chars ella sola). El neto sigue siendo muy favorable con caché
   (§2); lo dejo medido para que la decisión quede sobre el número real.
4. **`mode` quedó como argumento muerto en la firma de `buildNarrateSystemC`** (se conserva por los
   ~30 callers/gates). Si el arquitecto prefiere retirarlo, es un barrido mecánico de firmas que no
   quise hacer unilateralmente por el radio de cambio.

## 6 · Commits locales en `dev` (sin push — lo autoriza el arquitecto)

- `4f2998b` — «El system de NARRAR deja de romper su propio caché: prefijo estable, los 7 modos
  siempre» (Paso 0: narratePromptC.js · gatewayCore.js · 2 fixtures de gate documentados ·
  _probe_paso0_prefijo.mjs).
- `21858fb` — «La conversación deja de caber en 220 caracteres: presupuesto de hilo, el último turno
  de ADI entero» (Paso 1: hiloBudget.js · planPrompt.js · narrationContract.js ·
  _probe_paso1_hilo.mjs).

Verificación reproducible, sin gastar:

```
npm run gates:offline
node --import ./scripts/offline-guard.mjs _probe_paso0_prefijo.mjs
node --import ./scripts/offline-guard.mjs _probe_paso1_hilo.mjs
```
