# ADI AGENTE · F1 — el diseño, antes de una línea de código

**2026-08-30 · frente de ingesta/arreglos · para revisión del owner vía chat principal.**
Todo lo medido acá salió de correr el código real offline (cero llamadas al modelo). Los supuestos están
marcados como supuestos.

La decisión que lo origina, textual del owner: **«vamos con todo eso, esta vez quiero ADI agente»** — sobre la
síntesis del experimento `adi-experimento-claude-negocios`: un cerebro con agencia resolvió el hilo que ADI
rompió, pero violó 3 reglas de la casa porque no tenía muro. ADI Agente = esa agencia, CON el muro.

---

## 1 · La forma del bucle

**Un solo cerebro · el hilo entero · la caja completa de herramientas con contrato · bucle corto · la boleta se
acumula · guardC sella al final.**

```
usuario → [RONDA 1..N]  el cerebro ve: persona + invariantes + MAPA del dato + hilo + boleta acumulada
                        y decide: pedir herramientas (una o varias EN PARALELO) · o responder
          herramientas → las ejecuta EL MOTOR (client-side, puro, cero red) → resultados + figs A LA BOLETA
          → vuelve al cerebro como tool_result
[CIERRE]  el texto final pasa por guardC con la boleta acumulada + las fuentes de siempre
          veto → UNA reparación con multa (misma mecánica de cicloNotarial) → segundo juicio
          → escalera INVERTIDA del suplente (línea honesta primero — ver §5)
```

**Hechos de arquitectura que mandan la forma:**
- El dato del tenant vive EN EL CLIENTE (tenantStore); el gateway es un proxy sin estado. ⇒ **el bucle se
  orquesta client-side**: cada ronda es un round-trip al gateway, y las herramientas corren locales entre
  rondas. Es EXACTAMENTE la forma de `answerViaOracle` (PLAN → runPlan client → NARRAR), generalizada de «2
  pasos fijos» a «N rondas decididas por el cerebro».
- El ejecutor ya existe: `runPlan` (toolRunner) ejecuta un lote de calls contra `TOOLS`, cap 8 por lote,
  construye `ledger.figs` con dueño/unidad/contexto. El agente lo REUSA por ronda — no se escribe un ejecutor
  nuevo. La boleta del turno = acumulación de los ledgers de todas las rondas.
- Los adapters del gateway ya hablan tool-calling nativo (anthropic `tools`/`tool_choice`, openai function
  calling) — hoy solo en modo FORZADO (parse). El agente necesita el modo LIBRE (tools opcionales, el modelo
  elige) + los bloques `tool_use`/`tool_result` en messages. Es extensión de los adapters, no reescritura.

**Topes (el «bucle corto»):**
- **3 rondas de herramientas + 1 de cierre** = máx. 4 llamadas al modelo por turno (típico: 1-2).
- **8 calls por ronda** (cap vigente de runPlan) · **12 calls por turno** en total.
- Herramienta desconocida o args inválidos: se le devuelve el error de contrato UNA vez (el cerebro corrige);
  a la segunda, esa ronda se pierde y cuenta contra el tope. Nunca un reintento infinito.
- Ronda que no pide herramientas ni responde (texto vacío): cuenta como ronda perdida.
- Agotado el tope sin texto final → escalera invertida (§5). El tope es del CLIENTE, no una promesa del prompt.

**La caja de herramientas:** las 24 de `TOOLS` (toolRegistry) con sus contratos de `toolContracts.js`, MÁS:
- `registrarSupuesto` (nueva): el usuario ofrece una cifra propia → entra a la boleta etiquetada
  `source:"user_supuesto"` — el notario ya vigila supuestos (contexto `supuestoPendiente` de guardC); esto
  convierte la etiqueta en un acto de primera clase en vez de un parseo del hilo.
- `serieEntidad` (nueva, chica): la serie mensual por entidad REAL RECONCILIADA que este frente acaba de
  construir (`serieRealDe` + `historialMargen` del pack). `trend` sirve la global; el cruce entidad×mes no
  tenía herramienta — era el hueco raíz del diagnóstico. Devuelve la serie o el motivo del bloqueo
  («histórico de muestra no reconcilia» · «no reconcilia con la cifra oficial» · «un solo mes cargado») para
  que el cerebro decline honesto EN UNA LÍNEA leyendo lo que la herramienta le dijo.
  El interceptor-puente de serieIntent (congelado, en consulta) es la semilla de esta herramienta: misma
  lectura del dato, mismo contrato de honestidad — cambia quién decide invocarla.

## 2 · Qué modelo hace qué (el router existente, sin router nuevo)

| paso | modelo | por qué |
|---|---|---|
| rondas de herramientas (1..N) | **tier PLAN** (anthropic: haiku · openai: gpt-4o-mini) | elegir herramientas es clasificación con contrato — el trabajo que el mini ya hace en PLAN hoy |
| ronda de cierre (narra) | **tier NARRATE** (anthropic: sonnet) | la prosa con persona es el trabajo caro y visible |
| reparación tras veto | **escalación vigente** (attempt=1 → tier2 · attempt=2 → tier3) | `chooseModel` ya lo hace; el freno de presupuesto por tenant (`_resolveModel`) aplica igual |

Regla práctica: si el mini elige mal las herramientas (medible en calibración), el interruptor es subir SOLO
las rondas de herramientas a sonnet — una variable de entorno, no un rediseño.

## 3 · Costo por pregunta · hoy vs agente (medido + supuestos declarados)

**Medido hoy (offline, chars reales / ≈3.7 chars por token):**
- system del camino natural (persona+doctrina+proyección+contrato): 24.5K chars ≈ **6.6K tok** — FIJO, cacheable.
- proyección del dato adentro: 14.4K chars ≈ 3.9K tok.
- system de PLAN (catálogo 22 tools): 34.5K chars ≈ 9.3K tok · system de NARRAR-C: 36.9K chars ≈ 10K tok.
- precios (modelPricing, verificados): haiku $1/$5 · sonnet $3/$15 por 1M in/out.

**Supuestos declarados:** hilo medio 1K tok · salida final 400 tok · tool_use 120 tok por ronda · resultados de
herramientas 800 tok por ronda · caché de prefijo del proveedor sobre el segmento fijo (90% desc. en lo cacheado,
como hoy) · pregunta típica = 1 ronda de herramientas + cierre.

| camino | llamadas | costo SIN caché | costo CON caché de prefijo |
|---|---|---|---|
| natural hoy (sin tools) | 1× sonnet | ≈ $0.029 | ≈ **$0.011** |
| oráculo viejo (PLAN+NARRAR) | 1× haiku + 1× sonnet | ≈ $0.056 | ≈ $0.019 |
| **agente típico (1 ronda + cierre)** | 1× haiku + 1× sonnet | ≈ $0.061 | ≈ **$0.021** |
| agente pesado (3 rondas + cierre) | 3× haiku + 1× sonnet | ≈ $0.083 | ≈ $0.030 |
| agente + 1 reparación (tier2) | + 1× tier2 | + $0.02–0.09 según proveedor | ídem |

Lectura honesta: **el agente típico cuesta ≈2× el natural de hoy y ≈1× el oráculo viejo** — con techo conocido
(tope de rondas) y dos compensaciones: (a) la **foto fija se achica** (§4): la proyección de 3.9K tok deja de
viajar entera y queda un mapa de ~1.2K tok ⇒ el fijo baja de 6.6K a ~4K tok; (b) mueren los turnos de doble
camino (natural falla → oráculo entero de nuevo). El número a certificar en el examen vivo, no antes.

## 4 · La foto fija se achica; el muro no

- Al cerebro viaja un **MAPA de existencia** (~1.2K tok): ejes y entidades que existen, métricas por eje,
  períodos cargados, límites declarados (sello de carga, moneda/escala, «sin presupuesto declarado») — lo
  suficiente para ELEGIR herramientas sin adivinar. El detalle lo trae la herramienta cuando hace falta.
- `datoProyectado` NO se retira: sigue siendo la quinta fuente de guardC (`cifrasDelDato` — client-side, cero
  costo por usarla) y el insumo del suplente. Lo que cambia es cuánto viaja al proveedor, no la verdad local.
- **El notario no se toca. La boleta no se toca.** guardC juzga el texto final con la boleta ACUMULADA de las
  rondas + proyección + supuestos + alcance heredado + re-cita — su contexto de siempre, con más figs.

## 5 · Cuando el bucle no llega: la escalera INVERTIDA

Hoy el suplente vuelca ~12 KPIs (el caso Falabella). Dentro de la bandera, el orden se invierte:
1. **La línea honesta del límite** con la cifra más cercana que SÍ está en la boleta acumulada o en la
   proyección — «No tengo el mes a mes de X; su venta del período es $N. Me falta [lo que la herramienta
   declaró].» Una línea, verificada por el muro como cualquier texto.
2. El respaldo de lo ya aprobado en el hilo (`_respaldoDeLoYaAprobado`, tal cual existe).
3. El genérico pelado (`composeNoDataMessage`) — último recurso absoluto, como siempre.
El volcado completo de KPIs deja de ser primer recurso: queda disponible SOLO si el usuario lo pide
(«¿qué datos tienes?» — y eso, en el agente, es una herramienta más: `mapaDelDato`).

## 6 · Bandera, contrato y retiro de los 7 modos

- **`ADI_AGENTE` en flagProfile, apagada por defecto.** ChatADI: agente → catch → natural → catch → oráculo.
  El camino de producción queda byte-intacto hasta certificar (mismo patrón con que nació ADI_CAMINO_NATURAL).
- El contrato del agente = **persona (5 C) + invariantes pocas y duras**: cifras verbatim de boleta · período y
  alcance declarados · registro formal · declinar honesto en una línea con la cifra más cercana · supuesto
  jamás mezclado con verificado sin etiqueta · proporcionalidad real (pregunta chica → respuesta chica).
- Los 7 modos de `conversationalContract.js` se retiran SOLO DENTRO de la bandera; el contrato viejo sigue
  siendo el de producción y no se edita.

## 7 · Certificación (cero gasto hasta que el owner nombre el gasto)

1. **Gates offline con cerebro inyectado** (`callAgente` se inyecta, como `callNatural` en los gates de hoy).
   Guiones falsos, cada uno con carnada que prueba el rojo:
   - feliz: 1 ronda de herramientas + cierre → boleta con figs → verde;
   - malicioso: el guion narra una CIFRA INVENTADA → guardC veta → multa → reparación → o suplente;
   - herramienta inexistente / args rotos → error de contrato una vez → tope → escalera invertida;
   - ronda infinita (el guion pide herramientas por siempre) → el TOPE corta en 3 → escalera invertida;
   - supuesto del usuario → entra etiquetado por `registrarSupuesto` → el texto que lo mezcle sin etiqueta, vetado.
2. **Calibración contra borradores guardados** (`_calibracion_borradores.mjs`, gratis): el contrato nuevo
   contra los borradores reales rechazados/aprobados de los exámenes previos — antes de gastar un centavo.
3. **Examen vivo**: SOLO con autorización del owner que nombre el gasto; protocolo de los exámenes 1-5
   (presupuesto declarado, sello de versión `--sello`, expediente).

## 8 · Qué NO hace la F2 (los bordes, para no descubrirlos tarde)

- No toca guardC, parseFigures, numberGuard, entityGuard (los dos últimos, trabajo ajeno sin commitear).
- No toca el bloqueo del histórico sintético — la herramienta `serieEntidad` LEE `serieRealDe`; no lo relaja.
- No retira el P&L guiado: `detectPnlIntent` sigue cediendo el turno ANTES (es un contrato multi-turno que el
  agente v1 no reemplaza).
- No cambia el contrato de respuesta (`normalizeResponse`): el agente devuelve la misma forma con
  `route:"agente"`.
- Pendientes que la F2 hereda de este frente y siguen abiertos: el barrido ×1000 de las superficies (decisión
  A/B en el owner) y el destino del interceptor-puente (congelado, en consulta).

## 9 · Agregados de la revisión (chat principal, 2026-08-30 — aceptados)

1. **El MAPA lleva candado propio con carnada**: «mapa fiel al dato» — lo que declara existir existe y lo que
   existe está declarado, medido contra el pack real (demo Y planilla); y el tope de tamaño (~1.2K tok) se
   PRUEBA en el gate, no se promete. Un mapa que drifea hace que el cerebro pida herramientas que no van a
   responder — o no pida las que sí. Diseño en seco aprobado (2026-08-30): fidelidad en las DOS direcciones
   (mapa→dato y dato→mapa) · límites declarados sin inventar (sello de carga, sin presupuesto, escala, huecos
   de la historia) · tope medido sobre demo Y sobre un pack de planilla con 6 meses de historia · carnadas:
   entidad fantasma → rojo ida; eje borrado del mapa → rojo vuelta; 500 entidades inyectadas → rojo tamaño;
   sello presente y mapa mudo → rojo límites.
   **Y DETERMINÍSTICO BYTE A BYTE** (mismo pack + mismo escenario → mismo texto exacto), igual que
   `datoProyectado` hoy y por la misma razón: el caché de prefijo del proveedor. Toda la tabla de costos del
   §3 descansa en ese descuento sobre el segmento fijo — un mapa que ordene entidades distinto entre turnos o
   meta un timestamp rompe el caché EN SILENCIO y el «$0.021 típico» se va a ~$0.06 sin que ningún gate
   funcional se entere. Quinta carnada: generar el mapa dos veces con el mismo pack → igualdad byte a byte;
   y con el mismo dato en OTRO orden de inserción → también idéntico, porque el orden lo fija el mapa, no
   el dato.
2. **Borde edge al extender los adapters**: 5 endpoints corren en EDGE e importan la cadena del gateway
   (lección `adi-edge-vs-node-bundle`: 3 builds de Vercel rotos con la suite verde). La extensión
   tool_use/tool_result es JS puro, pero el candado que EMPAQUETA de verdad tiene que cubrir cada archivo
   que la F2 toque.
3. **El peldaño 1 de la escalera invertida hereda la lección del suplente actual**: la «cifra más cercana»
   sale de la boleta acumulada y se VERIFICA con `juzgar()` antes de adoptarse — nunca compuesta libre. El
   gate lo prueba con carnada: un guion que deja una cifra falsa en la boleta de ronda no puede terminar
   citada por el peldaño 1 sin veto.

## 10 · Doctrina bajo demanda (encargo del owner, 2026-08-30 — aprobado)

**El principio: la instrucción no viaja hasta que hace falta.** Hoy el system del narrador lleva TODA la
doctrina junta (~10K tok: arco P&L, series, simulación, sello) use lo que use el turno — el propio dispatch de
modos ya lo anotaba («los otros 6 modos es puro costo de tokens»). En el agente:
- **Núcleo chico y fijo**: persona + invariantes + mapa (§4).
- **Cada doctrina viaja pegada a su herramienta**: el turno que usa `trend`/`serieEntidad` recibe la doctrina
  de series EN el tool_result (o como bloque adjunto de esa ronda); el que no toca P&L no carga su arco.
- **Ganancia principal: CALIDAD** — menos instrucción impertinente = mejor obediencia. La de tokens es
  CONDICIONAL al caché: los bloques de doctrina tienen que ser ESTABLES byte a byte y llegar en ORDEN
  consistente (la misma disciplina del mapa), y la calibración MIDE el efecto caché, no lo supone.

**Candado en seco** (`_agente_doctrina_gate`, para F2b): (1) cada bloque de doctrina es byte-estable entre
turnos (dos generaciones idénticas); (2) el orden de bloques dentro de una ronda es fijo (alfabético por
herramienta); (3) fidelidad: la doctrina de una herramienta viaja SOLO en turnos que la usan — carnada: una
doctrina que viaja sin su herramienta → rojo; una herramienta usada cuya doctrina no llegó → rojo; (4) tope
de tamaño por bloque, probado.

## 11 · Mapa de fases posterior: los PLAYBOOKS (decisión del owner, 2026-08-30 — para el documento, no es
trabajo de F2)

- **Registro de playbooks una vez** (el patrón habilidad: detección→investigación→decisión, cada uno con
  candado, carnada y calibración) · **la Mesa como puerta**: cada card invoca su playbook.
- **Principio de registro (palabra del owner, 2026-08-30)**: cada playbook nace con su **LISTA NOTARIAL
  PROPIA** — chequeos mecánicos específicos de sus promesas, con carnada, que EXTIENDEN el notario POR REGLAS,
  jamás por comprensión (el juez no opina: compara; un juez que entiende es un juez al que se le discute). Del
  lado que sí «entiende»: los MOTIVOS DE VETO pueden ganar precisión por tipo de análisis para que el cerebro
  repare mejor a la primera — el juez sigue ciego, sus multas más finas. Ningún playbook futuro nace sin su
  lista.
- SUMAR en orden (actualizado 2026-08-30): **Margen en Riesgo** (1º — dato completo hoy) · **Directorio**
  (formalizar el arco existente) · **Revisión de cobranza** (Flujo Comercial + plazos + vencido: «quién debe,
  qué está vencido, a quién llamar primero y con qué cifra») · **Cierre del mes** (viable recién ahora: la
  carga histórica le da el mes anterior) · **Cliente perdiendo contribución** (exige historia real; declina
  corto sin ella) · **Caída de ventas** · **Inventario inmovilizado** (límite declarado: el dato no trae la
  causa) · **Desviación presupuestaria** (condicional a presupuesto declarado; absorbe la lectura de
  ritmo/run-rate).
- **Deslinde**: la mejora conversacional NO es un playbook — es el contrato del agente (F3). Carriles
  separados a propósito.
- REFORMULADO: «Oportunidad de precio» → **«Brecha de precio y descuentos vs lista»** (elasticidad/mercado no
  existen en el dato; no se promete).
- DESCARTADO hoy: «Forecast deteriorándose» — no hay forecast en el dato; nace solo el día que un cliente lo
  cargue.

## 12 · Mapa de fases posterior: los PROYECTOS (decisión del owner, 2026-08-30 — para el documento, no es
trabajo de F2/F3)

**El mandato central, textual del owner: «me interesa que eso sea para todo.»** El proyecto es un MECANISMO
UNIVERSAL, no un catálogo por tema: no existe «proyecto de compras» y «proyecto de márgenes» como features
separadas — existe UNO general que sirve para cualquier métrica, cualquier eje, cualquier supuesto.

- **Qué es**: trabajo con nombre y memoria. Cualquier conversación del agente —traer series, tabular, jugar
  con porcentajes— puede volverse proyecto con un «guardalo». Lo que se guarda es un **artefacto ANALÍTICO**:
  `{referencias al dato real + supuestos etiquetados + cuentas del motor + nombre}`. Números, supuestos y
  seguimiento — no tareas.
- **Qué NO es (línea roja del foco)**: NO es un gestor de tareas ni un Gantt. Si el proyecto deriva en
  asignaciones, responsables y fechas de entrega, perdimos el foco — el producto sigue siendo el análisis del
  negocio, no la administración del trabajo ajeno.
- **Plan contra real** (la razón de ser del mecanismo): al llegar una carga nueva, ADI compara lo real contra
  los supuestos del proyecto activo y lo dice con cifras — «asumiste 3% de crecimiento; septiembre vino 1.8%
  abajo; sugerencia a evaluar: X». Esto además **hace nacer legítimo el forecast que el §11 descartó**: el
  «Forecast deteriorándose» no existía porque el dato no traía forecast — con proyectos, el forecast EXISTE
  porque el usuario lo DECLARÓ. El descarte del §11 no se revierte: se cumple su condición de nacimiento.
- **Etiquetado sagrado, también en tablas**: cuando una tabla del proyecto mezcla columnas reales con
  simuladas, CADA COLUMNA declara cuál es. La mezcla sin etiqueta es el pecado capital — la misma invariante
  del contrato del agente (`registrarSupuesto` / etiqueta en la boleta), extendida a la superficie tabular.
  Carnada obvia para su gate: una tabla con columna simulada sin declarar → rojo.
- **Persistencia**: el patrón de los plazos de pago (v2.13) — el proyecto vive EN EL PACK, server-side, con
  arrastre entre cargas y firma de quién lo declaró. **Roles**: quién crea/edita un plan es la MISMA pregunta
  que quién activa versiones del pack (memberships ya preparado) — no nace un sistema de permisos nuevo.
- **Las invariantes de siempre**: el motor calcula, ADI SUGIERE con la cifra, y la decisión es del usuario —
  el arco qué/porqué/qué-hacer del contrato aplica igual dentro de un proyecto.
- **Cuándo**: después de certificar el agente (F4) y del registro de playbooks (§11) — comparten
  infraestructura, y **un playbook puede sembrar un proyecto** (la Revisión de cobranza que termina en «seguir
  estas 3 cuentas» es un proyecto naciendo de un playbook).

---
*Preparado por el frente de ingesta; revisado por el chat principal (verificación independiente de cifras y
afirmaciones contra el código). Las cifras de costo son estimaciones con supuestos declarados; el número real
lo da el examen vivo. Nada de este documento es código — salvo lo ya construido de F2: mapa (`mapaDelDato`),
herramientas nuevas (`serieEntidad`, `registrarSupuesto`), bucle (`answerViaAgente`) y sus tres candados.*
