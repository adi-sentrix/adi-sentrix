# Fase 2.2a-2 — Limpieza de foco (topic-change) + cobertura de inventario en conversación · Plano + Red-team

> Segundo ladrillo de seguridad de 2.2. Dos cierres: (1) **topic-change** — una pregunta nueva (alcance
> global / cambio de tema) limpia el foco de cliente en TODAS las puertas, sin romper el follow-up legítimo;
> (2) **2 fugas pre-existentes del muro** — el "stock" elíptico que hoy se escapa por early_gate/late_layer.
> Plano puro — se aprueba y recién ahí se construye. Flags default OFF.

---

## 0 · LECTURA DE TAMAÑO (lo que pediste)
2.2a-2 tiene **dos partes independientes** (código distinto, mecanismo distinto):

| Parte | Qué cierra | Tamaño | Riesgo |
|---|---|:--:|:--:|
| **A · Topic-change cleanup** | "cuál es el margen global" deja de quedarse pegado al cliente | Medio (~45 líneas) | **MEDIO-ALTO** — la trampa fina: distinguir "cambié de tema" de "sigo en el cliente"; toca detectClientMetricFollowUp + ECL-CONT MODO1 (committeados) |
| **B · Fugas del muro (stock elíptico)** | "el que más stock"/"ese stock" → AVISA en vez de surfacear inventario | Chica-media | **BAJO-MEDIO** — cierre por semántica (intent/módulo inventario), cuidado con over-trigger |

**Mi lectura/recomendación: JUNTAS en 2.2a-2, construidas como dos sub-pasos** — **B primero** (chica, contenida, cierra una fuga real rápido, valida el harness del RED gate) → **A después** (el corazón, la trampa). Mismo tema (seguridad de inventario/foco en conversación), validan juntas. **El escape:** si al diseñar A la distinción anafórica crece más de lo previsto, **freno y propongo 2.2a-3** (timón #2) — no lo fuerzo. **Flags:** propongo dos sub-flags (`ADI_MT_TOPIC_CLEAN_ENABLED` para A, `ADI_MT_INV_COVERAGE_ENABLED` para B) para reversibilidad por-parte; vos decidís uno o dos.

---

## 1 · PARTE A — Topic-change cleanup (el corazón · la trampa a blindar)

### El bug (anclado · confirmado en 2.2a)
`cómo está Falabella` (T1 client_dive · setea lastClientMentioned=Falabella) → `cuál es el margen global` (T2) → **se queda pegado a Falabella** ("Falabella opera con margen 22%"). Se cuela por **DOS puertas independientes, sin coordinación**:
- **Puerta 1 · `detectClientMetricFollowUp`** (router 1219-1253): matchea "cuál es el margen" + métrica + lastClientMentioned. **NO tiene anaphoric-strictness** (a diferencia de `detectFamilyFollowUp` que sí defiere): "cuál es **el** margen global" matchea igual que "cuál es **su** margen".
- **Puerta 2 · ECL-CONT MODO1** (answerADI 575-581): si se defiere la puerta 1, `_clientCentric` reusa lastClientMentioned **incondicionalmente** vía `getClientDeepDive(Falabella)`. (Esto es lo que pasó en 2.2a cuando probé el guard suelto en la puerta 1 — se coló por la puerta 2.)

### El cierre (política coordinada · UN chokepoint, las DOS puertas)
**Principio: una pregunta nueva limpia el foco — en el origen, antes de ambas puertas.**
- **`_detectTopicChange(text)`** (helper nuevo · gateado): detecta tema-nuevo = **señal explícita de alcance global** (`global`/`general`/`de la cartera`/`del portafolio`/`del negocio`/`promedio`/`total`) **+ métrica** Y **ausencia de referencia anafórica al cliente** (`su`/`sus`/nombre de cliente explícito).
- **Inyección ANTES de detectIntent** (answerADI, al tope): si `_detectTopicChange` → invalidar el foco de cliente (lastClientMentioned + activeResult-cliente) para ESTE turno → ambas puertas lo ven limpio:
  - Puerta 1 → sin lastClientMentioned → `detectClientMetricFollowUp` devuelve null.
  - Puerta 2 → sin foco de cliente → `eclContIsPureContinuation` hasFocus=false → no re-agarra.
- **Resultado:** "cuál es el margen global" → ruta normal de margen global (limpio).

### La trampa blindada (legítimo vs limpieza · CONSERVADOR)
**Por defecto PRESERVA; limpia SOLO ante señal explícita de tema-nuevo.** Los follow-ups legítimos siguen intactos:
- `y su margen` · `y la carga` · `y sus ventas` · `qué tal su margen` → anafórico "su/sus" → **PRESERVA** (sigue dando Falabella).
- `cuál es el margen` (sin "global", sin "su") → ambiguo → **PRESERVA** (el usuario sigue en el cliente · no rompemos el follow-up).
- `cuál es el margen GLOBAL` / `de la cartera` / `general` → señal explícita → **LIMPIA**.

El léxico de tema-nuevo es CERRADO y la condición es doble (alcance-global Y no-anafórico) → bajo riesgo de pisar un follow-up legítimo. El control del oráculo lo prueba.

---

## 2 · PARTE B — Fugas del muro (stock elíptico)

### El bug (anclado · de la barrida adversaria)
Misma raíz: `_esPreguntaInventarioChat` (answerADI 245-256) caza inventario por **densidad textual** (keyword explícito rotación/doh/bodegas, O "stock"+estado), no por **semántica de módulo**. El "stock" elíptico se escapa:
- `el que más stock` → ranking_extremes (metric inventario) → el muro L527 no lo caza (regex falla) → late_layer surfacea inventario.
- `y cómo está ese stock?` → el early-gate muro L483 (`_esPreguntaInventarioChat(null)`) no caza el deíctico "ese stock" → early_gate (módulo inventario) surfacea.

### El cierre (por SEMÁNTICA, no por texto frágil · evita over-trigger)
Aplico el **mismo principio del Availability Map de 2.2a**, ahora a las dos rutas donde se escapan:
- **`el que más stock`** (ranking_extremes + `intent.metric` domain=inventario): guard temprano en el muro L527 que AVISA por INTENT (no por texto) cuando el ranking es de dominio inventario. Cero over-trigger (solo dispara si el intent resuelto YA es inventario).
- **`ese stock`** (early_gate · módulo resuelto inventario): chequear el módulo resuelto del early-gate contra `isAvailable("inventario")` → si bloqueado, AVISA en vez de `_finalize(early)`.
- **Anti over-trigger:** NO meto bare `\bstock\b` al regex (cazaría "stock disponible de Falabella" comercial). El cierre dispara por el dominio/módulo resuelto = inventario, que es lo correcto. Mensaje byte-idéntico al muro (`_inventarioAvisarMsg`/`unavailableMessage`).

### El pago de conducta
`qué SKUs tienen capital atrapado` [muro AVISA] → `el que más stock` → **AVISA, cero número**. `cómo está Falabella` → `y cómo está ese stock?` → **AVISA, cero número**.

---

## 3 · Cómo distingue legítimo de limpieza (el equilibrio fino · resumen)
| Entrada (tras "cómo está Falabella") | Señal | Acción |
|---|---|---|
| `y su margen` / `y la carga` | anafórico "su" | **PRESERVA** Falabella (follow-up) |
| `cuál es el margen` | ni global ni anafórico | **PRESERVA** (conservador) |
| `cuál es el margen global` / `de la cartera` | alcance global, no anafórico | **LIMPIA** → margen global |
| `el que más stock` / `ese stock` | dominio inventario | **AVISA** (Parte B) |

---

## 4 · El oráculo (cadenas encadenadas reales)
**Parte A · topic-change (gate principal):**
- `cómo está Falabella` → `cuál es el margen global` → margen global **limpio, sin Falabella por ninguna ruta** (ni puerta 1 ni puerta 2).
- `cómo está Lider` → `cuál es el margen general de la cartera` → margen general limpio.

**Parte A · controles (follow-up legítimo NO se rompe · gate ROJO si se rompe):**
- `cómo está Falabella` → `y su margen` → margen **de Falabella** (sigue andando) · `y la carga` → carga de Falabella.

**Parte B · fugas del muro (gate ROJO anti-fuga):**
- `qué SKUs tienen capital atrapado` → `el que más stock` → AVISA, cero número.
- `cómo está Falabella` → `y cómo está ese stock?` → AVISA, cero número.

---

## 5 · El blindaje (single-turn byte-idéntico · gates ROJOS)
- **Single-turn byte-idéntico (el más importante):** ambas partes cambian conducta SOLO con contexto previo / cuando hay foco de cliente o el muro activo. Sesión fresca (los 47 + canónica + extendida) no dispara → **piso byte-exacto OFF y ON**.
- **Gate ROJO #1 (topic-change):** "cuál es el margen global" tras Falabella NO menciona Falabella, por ninguna ruta.
- **Gate ROJO #2 (follow-up legítimo):** "y su margen" tras Falabella SIGUE dando Falabella — si se anula, FALLA (la trampa).
- **Gate ROJO #3 (anti-fuga):** las cadenas de stock elíptico → AVISA, cero número de inventario.
- **Shadow-diff:** flag ON vs OFF → solo cambian las cadenas de topic-change (limpian) y de stock-elíptico (AVISAN); follow-ups legítimos y todo lo demás byte-idéntico.

---

## 6 · Flags · Blast radius
- **Flags (propongo 2 · reversibilidad por-parte):** `ADI_MT_TOPIC_CLEAN_ENABLED` (A) · `ADI_MT_INV_COVERAGE_ENABLED` (B). Default OFF. Componen con `ADI_MT_SAFETY_ENABLED` (2.2a) y `ADI_QI_FILTER_ENABLED` (el muro, para la parte B).
- **Blast radius A:** `_detectTopicChange` (helper nuevo) + 1 inyección al tope de answerADI (invalida foco) + el gating en las dos puertas. Flag OFF → lastClientMentioned se reusa como hoy (byte-idéntico a 2.2a).
- **Blast radius B:** guard por-intent en el muro L527 (ranking inventario) + chequeo de módulo en el early-gate L483-487. Flag OFF → muro como hoy. Cero cambio en composeRetrieval/spine/UI.

---

## 7 · Reporte crítico — dónde será frágil
1. **Romper el follow-up legítimo (la trampa CENTRAL).** Si `_detectTopicChange` es muy agresivo, "y su margen" se anula. Mitigación: condición DOBLE (alcance-global Y no-anafórico) + léxico cerrado + el gate ROJO #2 del control. Conservador por defecto (preserva).
2. **Tema-nuevo no detectado.** Si una frase de cambio de tema no tiene el léxico ("¿y el portafolio entero?"), no limpia. Mitigación: arranco con el léxico del oráculo, amplío si el re-test muestra un hueco. No fuerzo cobertura total (timón #2 si crece).
3. **Over-trigger del muro (Parte B).** Cazar "stock" por texto pisaría "stock disponible" comercial. Mitigación: cierre por SEMÁNTICA (dominio/módulo resuelto = inventario), no por bare regex.
4. **La coordinación de las dos puertas.** Si la limpieza solo toca una puerta, se cuela por la otra (lo vivido en 2.2a). Mitigación: invalidar el foco en el ORIGEN (antes de detectIntent) → ambas puertas lo ven limpio. El oráculo prueba que NO se cuela por ninguna.
5. **El tamaño de A.** Si la distinción anafórica resulta más enredada (más casos límite de los previstos), es timón #2 → freno y propongo 2.2a-3.

---

## 8 · Para aprobar
1. ¿2.2a-2 **juntas** (A topic-change + B muro stock, dos sub-pasos · B primero) o **separadas**? — mi lean: juntas.
2. ¿Las **dos conductas nuevas** (timón #1): la continuación de cliente se limpia ante pregunta global; el stock elíptico AVISA?
3. ¿Arranco la construcción con **B (muro stock) primero** y después **A (topic-change)**, o preferís A primero?

Con tu OK construyo, corro todas las pruebas (los 3 gates ROJOS + single-turn byte-idéntico + shadow-diff + combinado), dejo los flags OFF, y reporto. **No toqué `src/` — plano puro.**
