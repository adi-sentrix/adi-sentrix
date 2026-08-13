# AMPLITUD · FASE 2 — La calculadora de catálogo cerrado

**2026-08-13 · worker sobre dev=70da36f (incluye F1) · rama `claude/interesting-chatterjee-44717e` · NO pusheado.**
Suite: **antes 138 PASS · 0 FAIL · 0 TOCARON LA RED · 0 CON CREDENCIAL VIVA → después 139 · 0 · 0 · 0** (el gate
nuevo entra a la suite). Cero llamadas a proveedor: todo bajo `gates:offline` / `offline-guard`.
`_cert_vivo_openai.mjs` ni tocado ni corrido. Archivos Falcon intactos. NO push.

**Piezas frenadas: NINGUNA.** Los dos puntos de freno del encargo se transitaron dentro de sus límites (§5).

---

## 1 · Qué cambió, archivo por archivo

| Archivo | Qué |
|---|---|
| `src/adi/oracle/calculoCatalogo.js` (**nuevo**, 246 líneas) | EL CATÁLOGO (D1): módulo PURO con las 7 operaciones iniciales — `suma`, `resta`, `variacion_pct`, `participacion`, `brecha_pp`, `escalar` (regla de tres), `margen_objetivo` (el caso canónico). `ejecutarCalculo(operacion, insumos)` ejecuta sobre insumos YA resueltos; `esCalculoDelCatalogo(raw, unit, pool)` es el verificador que consume el muro; `tolCalculo` es LA tolerancia de `_isCalc` (verbatim, verificada por gate); `formatearCanon` formatea vía `parseFigures`/canon (el patrón F1 de datoProyectado — cero segundo formateador). Sin `eval`/`Function` (el gate lo fija). Importa SOLO `parseFigures` (boleta) y `reconcilian` (figureType). |
| `src/adi/oracle/toolRegistry.js` (:22-28, :36, :963-1101, :1177) | La tool `calcular{operacion, insumos, objetivo?}`. Resuelve insumos POR REFERENCIA: `{entidad, metrica}` → `rawRecordFor`+`guessDimension` (los resolvedores de siempre; `benchmark` vía `benchmarkOf`, que respeta el criterio del owner C.2) · métrica sin entidad → `deriveKpis` (los agregados de la Mesa, jamás una re-suma) · `{usuario: "cifra con su origen"}` → `parseFigures` con las normalizaciones acotadas de `cifrasDelUsuario` (puntos→pp, millones→M) y **procedencia obligatoria** (sin origen declina). Azúcar para el planificador: `margen_objetivo` con `insumos:[{entidad:"X"}]` se expande solo a venta+contribución. Entra al registro `TOOLS` (23→24). |
| `src/adi/oracle/toolContracts.js` (:285-297) | La entrada `calcular` en TOOL_CONTRACTS: `aceptaEntidadPuntual:false` (las entidades viajan DENTRO de los insumos — el scope multi-entidad heredado no la toca, como defineConcept). |
| `src/adi/oracle/planPrompt.js` (:34, :85) | **El punto de freno 1, dentro del límite**: UNA línea nueva en TOOL_CATALOG (675 caracteres, estilo idéntico a las vecinas) + `"calcular"` en el enum de `calls[].tool` (+11 car — el cableado mínimo sin el cual la línea describe una tool inexistente, el defecto que `_tools_alcanzables_gate` veta). TOOL_CATALOG quedó en 17.996 de los 18.000 del presupuesto de ese gate — NO se movió su tope. |
| `src/adi/oracle/narratePromptC.js` (:458-467) | `ensureHypothesisFraming` gana un disparador estructurado: `calcular` con `facts.conCifraDeUsuario === true` → el MISMO marco de hipótesis que simulate*. Sin cifra del usuario NO dispara (la cuenta sobre datos del motor es del dato, no un supuesto). |
| `src/adi/oracle/guardC.js` (:16-19, :2515-2548, :2568-2571) | TAREA 3: el muro verifica cuentas del catálogo. Extensión ADITIVA del chequeo 1 (ver §3). |
| `_probe_amplitud_f2.mjs` (**nuevo**) | 58 PASS · 0 FAIL — cada operación bidireccional + tool vía runPlan + muro + hipótesis + byte-identidad (§4). |
| `_amplitud_calculadora_gate.mjs` (**nuevo**) | 26 PASS · 0 FAIL — las cuatro garantías, DENTRO de la suite (138→139). |
| `_reparacion_contextual_gate.mjs` (:460-478, :489-493, :502-507) | El ÚNICO gate movido, con análisis garantía-vs-formato (§6). |

## 2 · El catálogo final y sus reglas de unidades

| Operación | Acepta | Produce | Nota |
|---|---|---|---|
| `suma` / `resta` | misma unidad: $/$ · pp/pp · unidades/unidades | la unidad de entrada | jamás $ con % — la tasa no es un monto |
| `variacion_pct` | de A hacia B, dos montos misma unidad ($ o unidades) | % | declina desde cero |
| `participacion` | A sobre B, dos montos misma unidad | % | declina sobre total 0 |
| `brecha_pp` | dos tasas (%) | pp | «una DIFERENCIA, nunca un % de algo» (figureType) |
| `escalar` | un monto $ × un factor pp/unidades | $ | regla de tres; NO acepta % como factor (sería venta×margen disfrazado) |
| `margen_objetivo` | venta ($) · contribución ($) · tasa objetivo (%) | pct+pp+$ ×4 resultados | la misma cuenta que marginRead sella (`venta × vara − contribución`), con la vara parametrizada |

**Reglas duras transversales**: (1) insumos solo por referencia — la cifra del usuario exige procedencia o declina;
(2) unidades verificadas por operación — declina con la razón, jamás convierte; (3) todo par de insumos con universo
declarado pasa por `reconcilian` (figureType) — «divergent» declina NOMBRANDO la regla y su razón medida (venta
comercial ↔ inventario incluida, verbatim del contrato); (4) resultado con formateador canónico + fórmula declarada
(«$776K = $194K × 4pp» — viaja en `fig.formula` y en `facts.formula`).

**Qué se revisó ANTES de escribir** (el encargo lo pedía): `inverse.js` resuelve el problema TRANSPUESTO (qué VENTA
hace falta para un target de contribución en $, a margen constante) — sigue siendo su dueño, el catálogo no lo
duplica. `simulate*` mueven palancas sobre ejes/entidades con su propio contrato — intactas. `margen_objetivo` es la
generalización de la fórmula que `marginRead` YA sella como «Valor en juego» (`venta × benchmark − contribución`,
specRetrieval) con la vara parametrizada — misma aritmética, un solo concepto, documentado en el módulo.

## 3 · El muro (Tarea 3) — cómo quedó la extensión

En el chequeo 1, DESPUÉS de `_isCalc`/`_isCalc2`/`_derivadaDeSupuesto` (el nivel actual queda como subset intacto:
esas tres corren igual, sobre los mismos pools) y ANTES de la quinta fuente (una cuenta legítima que coincida con
una cifra del dato no debe caer al veto de dueño), la cifra se recomputa contra el catálogo con `esCalculoDelCatalogo`
y la MISMA tolerancia de `_isCalc`. El pool se arma PEREZOSO (solo si alguna cifra llegó hasta esa vía) y se ACOTA
como `_isCalc2` acota:

- figs del ledger por el MISMO `_scopedCalcPool` del nivel 1 (fig con dueño solo si su entidad está mencionada en la narración);
- eco de la pregunta (`qFigs`) + **conteos de la pregunta** como factor de `escalar` (ver §7.1) + boleta anterior 1b (cap 24) + cifras del usuario — enteras: pocas por construcción y ya son fuentes del chequeo 1;
- de la proyección del dato (quinta fuente F1), SOLO las cifras cuyo dueño está nombrado en la narración — el principio de cercanía de esa fuente, aplicado como scope del pool.

Qué recomputa cada unidad: `pct` → variación (ambos sentidos) y participación · `pp` → brecha de tasas (re-verificada
sobre el pool amplio: `_isCalc` solo ve el ledger) · `money` → escalar ($×pp/unidades) y el trío de `margen_objetivo`
(venta×obj% y venta×obj%−contribución). Cota dura `_CAP=48` valores por unidad (falso negativo antes que costo);
jamás recursivo — un resultado del catálogo NO opera como operando de otro.

**Aditivo por construcción**: la vía solo agrega `continue` (aceptaciones); jamás un veto nuevo. Sin material del
catálogo, byte-idéntico — probe y gate lo fijan con narraciones autorizadas (idénticas) e inventadas (mismo kind).
**El costo combinatorio NO explotó** (el punto de freno 2 no se activó): pools scopeados reales traen ~10-30 valores;
el único nivel-3 (el trío de margen_objetivo) queda bajo la misma cota.

## 4 · Probes y gate (salidas)

- **`_probe_amplitud_f2.mjs` → 58 PASS · 0 FAIL**:
  §1 catálogo puro operación por operación (correcta con fórmula exacta · torcida/unidades/universos/catálogo-cerrado
  declinan · tolerancia idéntica a _isCalc en las 5 unidades · sin eval · sin imports de dato/motor).
  §2 la tool vía `runPlan` contra el DATO REAL: el caso canónico (insumos probados $19.4M/$4.3M · vara del usuario
  INDICADO con procedencia · faltante $583K computed+mandatory con fórmula · ledger completo con canon) · variación
  del negocio +7.6% desde deriveKpis · las 5 declinaciones honestas una por una.
  §3 el muro bidireccional: escalar $194K×4pp=$776K pasa / $920K veta · participación 17.9% pasa / 24.5% veta ·
  variación 7.6% pasa · margen_objetivo $583K pasa / $1.2M veta · aditividad (inventada→mismo kind; autorizada→idéntica) ·
  el scope: una participación que necesita la fig de una entidad NO mencionada se veta, y con ambas nombradas pasa.
  §3b las otras fuentes del pool: participación entre DOS cifras de la proyección del dato (dueños nombrados) pasa /
  torcida veta · brecha_pp entre tasas de la boleta anterior (1b) pasa / torcida veta.
  §4 hipótesis: con cifra del usuario dispara · sin ella no · mode=simulacion intacto.
  §5 byte-identidad: registro = las 23 de siempre + calcular · marginRead y queryMetric byte-iguales a sus composers.
- **`_amplitud_calculadora_gate.mjs` → 26 PASS · 0 FAIL**, corrido DENTRO de la suite.
- Suite completa: **antes 138·0·0·0** (`_suite_antes_f2.log`) → **tras el motor 137·1·0·0** (el 1 = los presupuestos
  de `_reparacion_contextual_gate`, ver §6) → **final 139 PASS · 0 FAIL · 0 TOCARON LA RED · 0 CON CREDENCIAL VIVA**
  (`_suite_despues_f2.log`). Logs no commiteados, como en F1.

## 5 · Los dos puntos de freno, transitados sin frenar

1. **La doctrina del PLAN**: la línea de `calcular` es UNA (675 car), con el estilo exacto de sus vecinas. Lo único
   adicional fue `"calcular"` en el enum (+11 car) — sin eso la línea describe una tool que el modelo no puede emitir
   (el defecto medido de clientesPorSku, que `_tools_alcanzables_gate` convierte en rojo). Lo cuento como cableado de
   la tool, no como doctrina: cero reglas nuevas en el system fuera de esa línea. Costó recortar la línea 3 veces para
   NO mover el tope de 18.000 de `_tools_alcanzables_gate` (quedó 17.996/18.000).
2. **La extensión de _isCalc**: no requirió reestructurar nada — `_isCalc`/`_isCalc2` quedaron byte-idénticos y la
   vía nueva es un `if (…) continue` + un pool perezoso. El costo combinatorio quedó acotado (§3).

## 6 · Gates antes/después — el único movido, con análisis

**`_reparacion_contextual_gate.mjs`** fija el CRECIMIENTO del system de PLAN contra una línea base. Tres topes
movidos (3.000→3.500 car · 1.200→1.210 car · 1.010→1.180 tok), y es FORMATO/PRESUPUESTO, no garantía: sus chequeos
de garantía (fijo+variable byte-idéntico · toda la doctrina del lado FIJO del caché · las 19 reglas sobreviven)
siguen corriendo idénticos y verdes. Lo que crece es el presupuesto declarado, por la clase exacta que el propio
gate autorizó al subir a 3.000 («enlaces de catálogo MEDIDOS — declarar capacidades que ya funcionan»): la línea de
la calculadora. Medido, no estimado: 3.461/3.500 · 1.203/1.210 · 1.166/1.180. Todo cae del lado cacheable — sobre
Haiku, ~172 tokens extra ≈ $0,00017/llamada sin caché y ~$0,00002 con caché 90%: ruido.
**Ningún otro gate se movió** (la aditividad del muro y la byte-identidad de las tools se midieron, no se declamaron:
la suite tras los cambios de motor fue 137·1 con SOLO ese gate en rojo).

## 7 · Decisiones no obvias (para la revisión del arquitecto)

1. **Los conteos del eco de la pregunta entran al pool del muro como factor de `escalar`** — «¿cuánto valen 4
   puntos?» trae el 4 como conteo pelado (invisible a `parseFigures` por diseño sellado del rePP). Ya eran fuente
   autorizada del chequeo 2; acá solo cambian de rol. Los conteos DECLARADOS del ledger (largos de filas, top-N)
   deliberadamente NO entran: montos × 13-clientes sería ruido combinatorio, no una cuenta que alguien pidió.
2. **La tolerancia heredada de `_isCalc` (2% en money) acepta desvíos chicos**: $790K donde la cuenta da $776K
   pasaría (1,8%). Es la calibración EXISTENTE del muro (necesaria por el redondeo de los values formateados) — el
   encargo prohibía inventar otra. El probe usa torcidos reales (fuera de tolerancia). Si la certificación amplia
   pide apretar money, es una decisión sobre `_isCalc` entero, no sobre el catálogo.
3. **La expresión de tolerancia vive dos veces** (guardC no importaba nada del catálogo y el catálogo no puede
   importar guardC sin ciclo): el gate verifica que ambas fuentes contienen la MISMA expresión verbatim — si una
   cambia sola, rojo. Alternativa descartada: exportarla desde el catálogo hacia guardC implicaba editar las 4
   funciones de guardC que la usan (reestructurar lo que el freno pedía no reestructurar).
4. **`escalar` no acepta % como factor**: $ × % es participación inversa/margen_objetivo; aceptarlo en la regla de
   tres habría abierto «venta × margen» como cuenta genérica — exactamente la clase de cuenta que marginRead
   prohíbe hacer a mano («NUNCA multipliques brecha% × venta vos mismo»). El % solo opera donde la operación lo
   declara (margen_objetivo, con sus cuatro resultados sellados).
5. **`margen_objetivo` azucarado**: `insumos:[{entidad:"X"}]` se expande a venta+contribución de X. El planificador
   emite menos args y no puede elegir mal los montos de la cuenta madre. `objetivo` acepta `{usuario}` (el caso
   canónico) o una referencia (`{metrica:"benchmark"}`).
6. **La cifra del usuario entra a la boleta con `sello:"indicado"` explícito** y `verificabilidadRazon` con la
   procedencia (fig() lo respeta desde el fix del 2026-08-12). No pasa por `reparacion`/`cifrasDelUsuario` (ese
   carril sigue siendo del contrato v1.2): acá la procedencia viaja en la referencia misma del plan.
7. **`aceptaEntidadPuntual:false` en el contrato**: las entidades de `calcular` viven DENTRO de `insumos`, donde
   `applyMultiEntityScope` no mira. Declararla `true` habría hecho que un scope heredado la declinara o poblara
   `entityScope` sin efecto. El PLAN arma los insumos por comprensión — mismo tratamiento que defineConcept.
8. **El pool de la proyección exige dueño NOMBRADO en la narración** (no solo mencionable): mismo principio de
   cercanía de la quinta fuente, reutilizado como scope. Sin eso, 308 cifras del dato entrarían a toda cuenta.

## 8 · Lo que NO se hizo (por encargo)

Ni contexto general (F3), ni el dato al PLAN (propuesta pendiente del owner), ni fórmula libre/evaluador (D1 lo
prohíbe y el gate lo fija). `glossary/hiloBudget/adapters/modelPricing/modelDefaults/datoProyectado` intactos
(datoProyectado se LEE en el probe, no se toca). Nada de guardC se relajó: la extensión es aditiva y medida.
`numberGuard/entityGuard/_guard_gate` ni mirados. NO push.

## 9 · Commits (rama del worktree, base 70da36f, NO pusheado)

1. `964453f` — `calculoCatalogo.js`, el catálogo cerrado (módulo puro).
2. `a0cdfe5` — `toolRegistry.js`: la tool `calcular` resuelve insumos por referencia.
3. `73250db` — `toolContracts.js`: el contrato de la tool.
4. `5867e05` — `planPrompt.js`: la línea del catálogo + el enum (punto de freno 1, dentro del límite).
5. `58927f7` — `narratePromptC.js`: el marco de hipótesis para cuentas con cifra del usuario.
6. `4f486f4` — `guardC.js`: el muro verifica cuentas del catálogo (extensión aditiva).
7. `36f4e5b` — `_probe_amplitud_f2.mjs` (54/54 en ese momento).
8. `c906055` — `_reparacion_contextual_gate.mjs`: los tres topes con su análisis garantía-vs-formato.
9. `5e3ac66` — `_amplitud_calculadora_gate.mjs` (138→139).
10. `db3ffda` — el probe gana las fuentes dato+1b del pool (58/58).
11. este informe.
