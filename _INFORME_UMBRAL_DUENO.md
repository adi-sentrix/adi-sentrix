# UMBRAL DEL USUARIO + DUEÑO POR FILA — el último encargo de motor antes del espejo

**2026-08-13 · worker sobre dev=4b79a54 · rama `claude/cool-montalcini-f996ab` · NO pusheado.**
Suite: **antes 141 PASS · 0 FAIL · 0 TOCARON LA RED · 0 CON CREDENCIAL VIVA → después 142 · 0 · 0 · 0**
(el gate nuevo entra a la suite). Cero llamadas a proveedor: todo bajo `gates:offline` / `offline-guard`.
Los arneses vivos (`_cert_vivo_openai.mjs`, `_cert_amplia_openai.mjs`, `_ask_vivo.mjs`) ni corridos ni tocados.

**Piezas frenadas: NINGUNA.** Las dos tareas entraron completas. El punto de freno GRANDE de T2 se ejerció como
manda el encargo: la suite completa corrió ANTES de sellar la regla, marcó 2 narraciones legítimas, y la regla
se REFINÓ con esos casos medidos (§4) en vez de entregarse rota o relajar el resto.

---

## 1 · El diagnóstico (los dos huecos, verificados contra el dato)

El hallazgo vivo del owner: «¿Cuánto capital tengo inmovilizado en inventario parado hace más de 90 días?».

**Hueco 1 — el umbral del usuario no existía como operación.** El plan cayó a `inventoryStatus` (foco por
estados), cuyo total es el del criterio INTERNO del motor: `capital_frenado` por rotación/DOH = **$33.2K en 3
SKU — con BOS-SANDER (68 días sin venta) adentro** — y la respuesta lo presentó como «>90 días». El real con
`diasSinVenta > 90` son **2 SKU ≈ $22K** (LG-DRYER8KG 94d · MAK-COMP-AIR 112d, demo.js:77/82). Dos agravantes
de motor: (a) ninguna operación del catálogo sabía filtrar-y-sumar con un umbral del usuario; (b) el foco
`stale` de `composeSpecInventory` SÍ aplica el corte por días… pero el catálogo del PLAN nunca lo declaró
(`inventoryStatus{filters?,focus?}` — sin `stale` ni `staleDays`), así que era una capacidad muda.

**Hueco 2 — la primera fuente del muro no exige dueño.** Las cifras de MAK-COMP-AIR salieron atribuidas a
LG-DRYER8KG y el muro entero las dejó pasar: el chequeo 1 autoriza por canon SIN condición de dueño, y el
chequeo 10 (atribución) solo marca cuando el dueño real no aparece en NINGUNA parte del texto — en una
respuesta que lista varios SKU, el dueño real siempre aparece en alguna parte. La quinta fuente (F1) ya había
cerrado exactamente este hueco para el dato proyectado; faltaba generalizarlo a la boleta del turno.

## 2 · Qué cambió, archivo por archivo

| Archivo | Qué |
|---|---|
| `src/adi/oracle/calculoCatalogo.js` (:140-156 op nueva · :196-201 aridad "1+" · :168-173 fórmula Σ · :225-230 nota del muro) | **`suma_filtrada`** entra al catálogo D1 (cerrado, ampliable con gate): suma N-aria de montos $ del mismo universo, una fila filtrada = un insumo. El verificador del muro (`esCalculoDelCatalogo`) **NO la espeja**, deliberado y documentado: una suma N-aria sobre el pool es combinatoria pura (con 134 montos casi cualquier cifra sería «una suma posible») — los resultados llegan SIEMPRE sellados en la boleta de la tool, la misma decisión medida que el `proyectado` de `variacion_aplicada`. |
| `src/adi/oracle/toolRegistry.js` (:1141-1216 `_calcSumaFiltrada` · :1217-1222 despacho · :580-589 `_umbralDiasPedido` · :590, :617-643 `inventoryStatus`) | La rama de la tool: registro DECLARADO de campos (sumar: capital en inventario/`stockUSD`; umbral: días sin venta/días de inventario/rotación), filas del escenario activo (`applyScenarioToSkuInventario`), operadores `>`/`>=`/`<`/`<=` y en palabras. **El criterio COMPLETO es parte del resultado**: fórmula «$22K = capital en inventario de los 2 SKU con más de 90 días sin venta: LG-DRYER8KG ($14K, 94 días sin venta) + MAK-COMP-AIR ($8K, 112 días sin venta)», `facts.criterio` estructurado + `facts.filas` + cada fila en boleta con su monto Y su valor del campo filtrado; top-8 + «Resto (k de n)» reconciliado (jamás filas que suman menos que el total). El umbral entra sellado INDICADO (del usuario: se declara, no se mide). Cruce de universos / campo inexistente / corte faltante → declinan en palabras de usuario (regla A2: sin `/\w_\w/`, sin nombres de operación, sin «insumos»). **Y la regla de honestidad del camino viejo**: `inventoryStatus` con umbral de días en la pregunta (o `staleDays`) que su foco NO aplica → `facts.umbral_no_aplicado` con la declaración lista para pantalla + nota-doctrina (patrón `limite_transferencia` C1). `focus:"stale"` aplica el corte → nada que declarar (y su total ES $22K). |
| `src/adi/oracle/toolRunner.js` (:167-172) | La pregunta literal del turno se inyecta TAMBIÉN a `inventoryStatus` (el mecanismo del Paso 2, mismo punto único; sin `preguntaUsuario` todo byte-idéntico). |
| `src/adi/oracle/planPrompt.js` (:35) | La señal mínima del PLAN, dentro de la línea de `calcular` (+496 car, medidos): la operación con su ejemplo del caso del owner, los campos del umbral, y el enrutamiento que evita repetir el defecto («USALA siempre que la pregunta traiga un corte numérico explícito — inventoryStatus NO aplica ese corte: responde por estados del motor»). |
| `src/adi/oracle/narratePromptC.js` (:539-563 `ensureUmbralDeclarado`) | El backstop determinístico: si algún resultado declara `umbral_no_aplicado` y el texto no lo dice, la declaración se ANTEPONE (el criterio va primero — mismo criterio que la transferencia C1). Cero texto inventado: la oración viene armada desde la tool, y cita el número de días SOLO si estaba en la pregunta (eco autorizado). Idempotente. |
| `src/adi/oracle/answerViaOracle.js` (:2306-2321 `duenosTenantTodosLosEjes` · 9 sitios de guardC · 5 sitios de ensure · :2529 verdictos) | Cableado: `ensureUmbralDeclarado` en los MISMOS 5 puntos que `ensureTransferenciaDeclarada` (det, reparación, narración, alternativa, compositor final). Los dueños de fila viajan con los SEIS ejes (`axisEntityNames` cliente/sku/marca/familia/bodega/canal) como opción NUEVA `duenosDelTenant` — lista DISTINTA de la de 3 ejes de F3 a propósito (aquella es de contenido, esta de estructura; §4). `cifra-de-boleta-sin-dueno` entra a `_VERDICTOS_DE_REDACCION` (reintento mismo tier con instrucción — la cifra es real, falta el dueño). |
| `src/adi/oracle/guardC.js` (:2436-2534 `_duenosDeBoleta` · :2536-2556 `_atribucionAjenaEnBoleta` · :2630-2634 índice · :2670-2694 chequeo en paso 1 · :2480 firma) | **T2, el corazón**: índice de dueños de la boleta del turno — label «Entidad · Concepto» contra los nombres reales (6 ejes ∪ entidades del turno), agrupado por CONCEPTO estructural (el label sin su segmento de entidad — jamás un vocabulario nuevo: el léxico del chequeo 9 no se toca). SOLO con **2+ dueños distintos en la misma métrica** el grupo se activa; el canon se **re-deriva del value con parseFigures** (la técnica de 1b — ver §4.3); toda lectura sin dueño libera el valor (colisión de canon F1 §3: cualquiera valida). El veto: **mis-atribución ACTIVA** — en toda aparición de la cifra falta un dueño legítimo en la oración Y alguna de esas oraciones nombra otra entidad real. Ventana de oración = LA de F1 (`_localWindow` 90 sobre texto enmascarado). Eco de pregunta / cifra del usuario / boleta anterior (1b) / derivada de supuesto liberan; la coincidencia aritmética NO (§4.2). Default sin fuentes → byte-idéntico. |
| `_probe_umbral_dueno.mjs` (**nuevo**) | 50 PASS · 0 FAIL — las 7 letras del encargo (§3). |
| `_umbral_dueno_gate.mjs` (**nuevo**) | 22 PASS · 0 FAIL — entra a la suite (141→142). |
| `_probe_amplitud_f2.mjs` (:33-38) | Lista exacta del catálogo actualizada — **deuda del cierre encontrada**: el probe F2 quedó con la lista SIN `variacion_aplicada` y fallaba 1 en la propia base 4b79a54 (verificado con stash); ahora fija las 9 operaciones. |
| `_amplitud_calculadora_gate.mjs` · `_tools_alcanzables_gate.mjs` · `_reparacion_contextual_gate.mjs` | Los tres movidos POR SU PROPIO punto declarado, con análisis escrito EN cada gate (§5). |

## 3 · Probes y gate (salidas)

- **`_probe_umbral_dueno.mjs` → 50 PASS · 0 FAIL**, las siete letras:
  [1] `suma_filtrada` exacta: >90 → **$22K** (jamás $33K), fórmula con criterio completo + filas, `facts.criterio`/`filas`,
  cada fila con su monto y sus días, umbral sellado INDICADO. [2] bidireccional contra el muro: la narración
  exacta PASA · «$33.2K parado hace más de 90 días» → VETO `cifra-no-autorizada` · $25K inventado → VETO · el
  muro NO recomputa la suma N-aria · aridad variable/unidades en el catálogo. [3] declinaciones A2: cruce de
  universos NOMBRANDO la regla · campo inexistente · corte faltante — todas en palabras de usuario (sin tokens,
  sin nombres de operación, sin «insumos»). [4] variantes: rotación bajo 2x → $33.2K con SU criterio · umbral
  sin filas → $0 declarando que nadie cumple · operador en palabras · DOH>100. [5] camino viejo: la pregunta
  LITERAL del owner dispara `umbral_no_aplicado` (dias:90 + declaración) · el backstop ANTEPONE · idempotente ·
  texto que ya declara no se toca · pregunta sin umbral = byte-idéntico · `focus:stale` aplica el corte (sin
  declaración, total $22K). [6] el caso del owner LITERAL como regresión: cifra de MAK pegada a LG → **VETO
  `cifra-de-boleta-sin-dueno` nombrando a MAK-COMP-AIR** (aunque MAK aparezca en otra oración — el hueco del
  chequeo 10) · bien atribuidas → PASAN · suelta y anáfora pasan (§4.1) · colisión de canon valida con
  cualquiera (Antofagasta = subtotal de bodega) · eco y 1b conservan su estatus. [7] aditividad: boleta
  mono-entidad **byte-idéntica** con y sin la referencia de dueños · tabla · prosa con dueño · totales sin
  dueño · Medida — todo intacto.
- **`_umbral_dueno_gate.mjs` → 22 PASS · 0 FAIL**, corrido DENTRO de la suite (las 4 garantías + el kind en la
  familia de redacción, verificado contra el fuente).
- Regresiones re-corridas en verde: `_probe_amplitud_f1` 48/48 · `_probe_amplitud_f2` 58/58 · `_probe_amplitud_f3`
  65/65 · `_probe_paso1b_recita` 29/29 · `_probe_cert_cierre_a1..a4` 18/25/19/9 · `_probe_paso0_prefijo` 19/19 ·
  `_probe_paso2_definir` 24/24 · `_proporcionalidad_semantica_gate` 75/75.

## 4 · El punto de freno GRANDE, ejercido — y las tres decisiones que salieron de MEDIR

**La secuencia fue la que el encargo manda**: primera versión de T2 (dueño-en-oración estricto, calco de F1) →
suite ENTERA temprano → `_proporcionalidad_semantica_gate` marcó **2 narraciones legítimas** («Su margen es
22%, con 8.1% de brecha contra tu benchmark de 30.1%» — la anáfora del producto) → la regla se refinó con los
casos medidos. Nada se entregó roto y nada se relajó de más:

1. **Se veta la mis-atribución ACTIVA, no la cifra suelta.** La regla final: la oración nombra OTRA entidad
   real y ningún dueño legítimo está a la vista. La cifra suelta («Hay $8.4K parados…») y la anáfora («Su
   capital detenido es $8.4K», dueño en la oración anterior) pasan HOY por la primera fuente y siguen pasando —
   es la propia regla de aditividad del encargo («cero turnos que hoy pasan pueden empezar a fallar salvo los
   que contengan una mis-atribución REAL») decidiendo el diseño. F1 sí veta la suelta y la diferencia es de
   fuente, documentada en el código: las cifras del dato jamás estuvieron autorizadas sin condición; las de la
   boleta llevan meses pasando sueltas.
2. **La coincidencia aritmética NO libera** (a diferencia del resto de lecturas alternativas), y la razón está
   MEDIDA con la boleta real de inventoryStatus: en una boleta PARTICIONADA toda parte ES «total menos el
   resto» ($33.2K − $24.8K de Valparaíso = los $8.4K de MAK) y todo % de composición es una participación
   recomputable — liberar por `_isCalc`/catálogo anulaba el chequeo por construcción, exactamente sobre las
   boletas que más lo necesitan (mi primera versión lo liberaba y la mis-atribución del caso literal PASÓ).
   El costo es acotado: una resta legítima que colisione exige nombrar al dueño, y es veto de REDACCIÓN.
3. **El canon del índice se re-deriva con el parser** (jamás el canon guardado del fig): medido, el ledger
   guarda `pct:25.0%` donde parseFigures canoniza `pct:25%` — con dos espacios de canon, el dueño real (Ripley ·
   Margen 25.0%) quedaba invisible mientras la colisión (% del total = 25%) sí indexaba, y el compositor
   DETERMINÍSTICO del turno de 4 tools se vetaba a sí mismo (lo cazó la regresión `_probe_paso1b_recita` A5b —
   el turno grande persistía boleta null). Es la misma técnica que 1b usa para la boleta anterior.
4. **Los dueños son los SEIS ejes, no los 3 de F3** (`duenosDelTenant`, lista nueva): sin bodegas/familias
   reconocidas como dueñas, «Antofagasta · Capital detenido» ($8.4K) quedaba como fig sin dueño y LIBERABA por
   colisión la cifra de MAK — el caso literal no se podía vetar. Es deliberadamente otra lista que la del
   chequeo 26: aquella decide qué nombres el bloque de contexto general no puede tocar (contenido — con 6 ejes
   se vetaban 4/5 frases legítimas del rubro, F3 §7.1); esta decide qué segmento de label ES una entidad
   (estructura — más ejes = más precisión, no más vetos).

## 5 · Gates antes/después, con análisis

- **Antes** (base 4b79a54): `141 PASS · 0 FAIL · 0 TOCARON LA RED · 0 CON CREDENCIAL VIVA` (`_suite_antes_umbral.log`, reproducida acá).
- **Después**: `142 PASS · 0 FAIL · 0 TOCARON LA RED · 0 CON CREDENCIAL VIVA` (`_suite_despues_umbral.log`).
- Gates movidos, cada uno por su punto declarado y con el análisis EN el gate:
  - `_amplitud_calculadora_gate` — la lista exacta de operaciones es su punto de AMPLIACIÓN declarado («una
    operación futura = una entrada + sus casos bidireccionales ACÁ»): entra `suma_filtrada` con sus casos
    (la suma exacta con fórmula · unidades declinan · aridad 1+ · el muro NO la espeja). 31→35 chequeos.
  - `_tools_alcanzables_gate` — TOPE_CAR 18.000 → **18.550** («subí TOPE_CAR y dejá escrito por qué», dice el
    gate): la línea de `calcular` gana la capacidad + el enrutamiento; costo EXACTO 496 car (~124 tok de PLAN,
    ~12 efectivos con caché 90%), medido 18.492 — el tope queda pegado a lo medido, no aflojado.
  - `_reparacion_contextual_gate` — presupuesto de PLAN system <3.500 → **<3.990** (medido +3.957) y total
    <1.180 tok → **<1.300** (medido 1.290): la MISMA clase autorizada por el propio gate (enlace de catálogo
    medido), garantía fijo/variable intacta.
- `_proporcionalidad_semantica_gate` se puso rojo DURANTE el desarrollo (garantía, 2 casos) y volvió a verde
  refinando la REGLA nueva (§4.1) — el gate no se tocó.
- **Deuda del cierre saldada de paso**: `_probe_amplitud_f2` fallaba 1 en la base (lista sin `variacion_aplicada`
  — el cierre actualizó el gate pero no el probe). Actualizado y anotado en el archivo.

## 6 · Residuales anotados (ninguno bloquea)

- **«días sin venta» dispara el vocabulario de VENTAS del chequeo 9** (preexistente: la palabra «venta»): una
  narración que ponga «94 días sin venta» al lado de un monto de capital SIN la palabra «capital» cerca se
  marca `metrica-mal-atribuida` (redacción → reintento con instrucción; en tabla no pasa). Por eso el label del
  fig del umbral no nombra métricas («Criterio del filtro · umbral pedido» — commit 295d76b). Si la
  certificación viva muestra reintentos frecuentes acá, el ajuste fino sería declarar «días sin venta» en
  `_METRIC_VOCAB` — se dejó FUERA a propósito (tocar el léxico del chequeo 9 cambia sus ambigüedades).
- **`focus:"stale"` sigue sin señal en el catálogo del PLAN**: la vía nueva (suma_filtrada) cubre el caso con
  el criterio declarado y además lista las filas; exponer `stale` sería una segunda señal para lo mismo —
  decisión de catálogo para el owner si quiere el formato narrativo de inventario con umbral.
- **El tradeoff conocido de 1b queda igual** (cert #2, residual iii): una cifra re-citada del turno ANTERIOR
  conserva estatus de eco y no exige dueño — el refuerzo de dueño para re-citas sigue siendo decisión futura.
- **La declaración de umbral convive con la afirmación del narrador, no la reescribe**: si el narrador abre con
  «$33.2K parados >90 días», la declaración antepuesta lo contradice visiblemente pero la frase queda (la vía
  fuerte —vetar la equivalencia falsa— exigiría un chequeo léxico de negación frágil; con el PLAN enrutando a
  `suma_filtrada` el caso queda doblemente cubierto). Documentado como pedía el encargo; no hizo falta frenar.

## 7 · Commits (sobre 4b79a54, NO pusheado)

1. `79af833` calculoCatalogo.js — `suma_filtrada` declarada (aridad variable, fórmula Σ, muro conservador).
2. `ffa61e9` toolRegistry.js — la rama de la tool + la regla de honestidad de inventoryStatus.
3. `6375068` planPrompt.js — la señal mínima del PLAN.
4. `20d32c5` toolRunner/narratePromptC/answerViaOracle — pregunta inyectada + `ensureUmbralDeclarado` cableado.
5. `04ea0b5` guardC.js + answerViaOracle.js — dueño por fila (T2, una pieza).
6. `295d76b` toolRegistry.js — el label del criterio no nombra métricas.
7. `a3301d1` probe del encargo (50/50) + lista del probe F2 (deuda del cierre).
8. `9b5596d` gate nuevo (141→142) + los tres presupuestos movidos con análisis.
9. este informe.
