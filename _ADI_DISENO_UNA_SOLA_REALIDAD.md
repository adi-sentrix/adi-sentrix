# Una sola realidad · consolidar el «escenario» en las tablas del tenant (diseño + medición, sin implementar)

> Fable, 2026-10-06 · rama `dev` HEAD `98ad5c03` · prod `main` = v2.31. Solo diseño y medición: nada de esto corre en el repo ni se commitea.
> Medido en una COPIA (worktree `wt-consolidacion`, prototipo de 3 archivos: `SCENARIO_TRANSFORMS = {}` en demo y empresa2 + motor null-safe) contra
> una copia limpia del mismo HEAD, con los sondeos del scratchpad `consolidacion/` (`sondeo-cifras.mjs`, `sondeo-532.mjs`, `cuadre-tablas.mjs`,
> `clasificar-532.mjs`) bajo `scripts/offline-guard.mjs`, y la suite `npm run gates:offline` en ambas copias. 0 red, 0 LLM. Hermano de
> `_ADI_DISENO_RECONCILIACION_EJES.md` (queda EN ESPERA: el caso Makita del demo desaparece de raíz; la regla general sigue valiendo para planillas).

## §0 · La decisión del owner (textual, 2026-10-06)

«Nosotros habíamos decidido eliminar los escenarios como fuentes paralelas de la verdad real y quedarnos con una sola realidad vigente de la empresa…
no quiero resolverlo reconciliando dos versiones que conceptualmente no deberían coexistir. Distingo esto de las simulaciones explícitas, que sí pueden
tener escenarios separados. Revisa qué representa hoy exactamente “escenario” … y si podemos llegar a una sola fuente de verdad real sin romper las
simulaciones.» Antecedente 2026-08-07: «el escenario bonanza es el que usó la realidad de los datos… quedaremos con uno solo, la realidad». El colapso
C1–C7 (2026-08-30, `_COLAPSO_ESCENARIOS_MANIFIESTO.md`) retiró el CONCEPTO de la UI; **el DATO sigue partido en dos**: este documento cierra eso.

## §1 · Qué es hoy «escenario» (inventario medido en el código)

**Resto (fuente paralela de la verdad real) — se retira:**
- `SCENARIO_TRANSFORMS.bonanza` (tenants `demo.js:356-384`, `empresa2.js:321-331`): 13 `growth` literales por cliente + `kpis` literales (ventas 99.999 ·
  margen 25,6 % / 25.559 · pctAnt 23,8). `ESCENARIO_INICIAL = "bonanza"` (`config/scenarios.js:19`) hace que TODA lectura pase por ellos.
- `engine/scenarios.js`: `applyScenarioToClientesVentas` (l.9-31) **recalcula** `actual = anterior × (1+growth)` y `unidades = unidadesAnt × (1+0,7·growth)`
  → Σ venta $99.887K vs tabla $100.000K; `applyScenarioToMarcasVentas` / `Sfamilias*` (l.33-57, 86-110) **rearman** marca y familia sumando clientes por su
  marca DOMINANTE (no es partición: Samsung tabla 31.600 vs servido 33.158; Makita queda fuera, `applyScenarioToMarcasMargen` l.70-77 `?? m.venta` la
  reinyecta con su cifra de tabla → marca Σ 104.687); `applyScenarioToSfamiliasMargen` re-agrega contribución desde clientes; `deriveKpis` (l.196-233) lee
  `pctAnt`/`totalPresupuesto` del literal; `engine/metrics.js` `getVentasKPI`/`getMargenKPI` (l.15-69) pisan `ventasKPI`/`margenKPI` con `kpis` del transform.
- `tension` / `crisis` (demo y empresa2) + las ramas por nombre de `applyScenarioToSkuInventario` (l.170-201): **ningún uso de producto** — solo gates que
  ejercitan «otro mundo» (`_escenario_del_turno`, `_concordancia_numerica`, `_capital_ligado_cliente`, `_tipado_cifra`…). Verificado: ningún archivo de
  `src/` fuera del motor y los tenants nombra `"tension"`/`"crisis"` como escenario (`numberGuard` solo los veta como palabra).
- `figureType.js:561-582` (`ESCENARIO_BASE = "actual"`, `ESCENARIOS_CON_TRANSFORM`, `ESCENARIOS_QUE_ALTERAN_TASAS`, `escenarioReDeriva`, `escenarioAlteraTasas`,
  `ejesSoloConEscenario`): tipado de la boleta que distingue «literal almacenado» de «re-derivado por el escenario». Con una sola realidad, familia/marca se
  sirven literales (probado) y la contribución del cliente sigue re-derivada por D8 (indicado), en todos los casos: la rama «con escenario» queda muerta.
- Candados que FIJAN el resto: `_una_sola_carpeta_gate:30` exige `SCENARIO_TRANSFORMS[ESCENARIO_INICIAL]`; `_colapso_eje_gate:139` exige el string
  `"bonanza"`; `_tipado_cifra_gate:187-196` espeja la lista desde los transforms; `_escenario_del_turno_gate` recorre `["bonanza","tension","crisis"]`.
- El parámetro `scenario` enhebrado por ~120 archivos (App → ChatADI → answerADI/agente/oráculo → tools → motor; Entrega/Complemento `componer.js:366,466`;
  `ESCENARIO_INICIAL` como default en 60+ módulos): es la RANURA por la que viaja la constante y el override de simulación. Se conserva (cirugía masiva sin
  cambio observable); solo cambia qué hay en la ranura.

**Simulación legítima — se conserva:** `resolveTransform(scenarioId, override)` / `mergeTransform` (l.236-263), el `override` de Simulate v2
(`composers/simulation.js`: `marginErosion` delta, `__remove__`, `rebateDelta`; `extractGrowthSimulation`/`composePriceLever` proyectan sobre la fila sin
override), `simulateCarga/Capital/Costo` del oráculo (sobre las filas servidas), la «mesa del supuesto» de Sentrix (`SentrixPanel.jsx:537`: «sobre el dato
REAL · NO es un escenario»). Las planillas reales ya viven así: `normalizar.js:151,171` y `motorKpi.js:470` traen `SCENARIO_TRANSFORMS: {}` y declaran
ausentes «las simulaciones». Rioclaro (`scripts/medicion-anfitrion/empresa-no-demo.mjs`) es el demo renombrado: hereda el resto tal cual.

## §2 · La realidad única: la fuente de cada eje y el cuadre medido

**Fuente por eje (como una planilla real):** cliente → `clientesVentas` (venta oficial D8, anterior, presupuesto, unidades) + `clientesMargen` (margen %,
re-derivando contribución/costo/rebates sobre la venta oficial, como hoy en `applyScenarioToClientesMargen`); marca → `marcasVentas`/`marcasMargen`;
familia → `sfamiliasVentas`/`sfamiliasMargen`; SKU comercial → `skusMargen`; inventario → `skuInventario`; mes → `ventasMensuales`; KPIs de cabecera →
**derivados de las filas** (`deriveKpis` ya lo hace: venta, anterior, presupuesto, contribución, margen %, inventario); el margen del AÑO ANTERIOR no es
derivable de filas (no hay costo anterior por cliente): lo DECLARA el pack como `margenKPI.pctAnt` (la planilla lo mide en `motorKpi.js:359`; el demo lo
declara 23,8). `ventasKPI`/`margenKPI` literales del tenant → se derivan de las mismas filas (`getVentasKPI`/`getMargenKPI` dejan de leer literales).

**Cuadre de las TABLAS CRUDAS del demo (`cuadre-tablas.mjs`), por métrica aditiva:**

| métrica | cliente | marca | familia | SKU | mensual | KPI literal | veredicto |
|---|---|---|---|---|---|---|---|
| venta (K) | 100.000 | 100.000 | 100.000 | 100.000 | 100.000 | 100.000 | **cuadra en todos los ejes** (marca y familia = Σ SKU exacta) |
| venta año anterior | 92.900 | 92.900 | 92.900 | — | 93.000 | 92.900 | cuadra; el mensual difiere $100K (0,1 %, redondeo de 12 filas) |
| presupuesto | 97.000 | — | — | — | 97.000 | 97.000 | cuadra (ya calibrado, owner 2026-07-15) |
| contribución | **25.057** (D8) | 25.559 | 25.559 | 23.738 | **25.057** | 25.559 | cliente = mensual; marca/familia +$502K (2 %); SKU −$1.319K |
| unidades | **5.520** | 5.703 | 5.703 | 674 (otro universo, CLAUDE.md §4) | 5.703 | 5.703 | **Δ 183 = exactamente las unidades de Makita** |
| acciones comerciales | 4.075 (D8) | 4.084 | 4.084 | 4.130 | 4.075 | — | cliente = mensual; marca +$9K |
| capital inventario | — | 135.000 (por marca) | — | 135.000 | — | — | cuadra por SKU, bodega y marca |

Lectura: la venta cuadra EXACTA en los cuatro ejes sin ningún transform — el resto es lo único que hoy la descuadra (99.887 / 104.687). Lo que NO cuadra
en las tablas es la **tajada de Makita**: $4,8M de venta están dentro de los clientes, pero sus 183 unidades y parte de su contribución no (el diseño
original pre-D8 era clientesMargen Σ 95.200 + Makita 4.800 = 100.000, con unidades 5.520 + 183 = 5.703 y contribución 23.854 + 1.705 = 25.559 — todo
cerraba; D8 (2026-07-29) hizo oficial `clientesVentas` = 100.000 y ese universo quedó con 25.057 / 5.520). Además `marcasVentas.pctRebate` ≠
`marcasMargen.pctRebate` en 3 de 5 marcas (Samsung 4,2/4,4 · LG 3,5/3,6 · Philips 3,5/3,6) y 3 de 4 familias; la de `*Margen` es la coherente
(rebates ÷ venta). **Corrección mínima propuesta del dato sintético (precedente: presupuesto 2026-07-15, meses 2026-09-09):** (a) `pctRebate` de
`marcasVentas`/`sfamiliasVentas` = el de `*Margen` (6 filas); (b) margen/contribución de `marcasMargen` y `sfamiliasMargen` escalados ×0,9804 para que
Σ = 25.057 (9 filas; Samsung 7.643→7.493, LG 5.907→5.791, Philips 7.447→7.301, Bosch 2.857→2.801, Makita 1.705→1.671; familias igual); (c) unidades de
`marcasVentas`/`sfamiliasVentas`/`ventasMensuales`/`ventasKPI` ×0,9679 para Σ = 5.520 (o alternativa (c′): +183 unidades repartidas en los 13 clientes
por su venta de Materiales — no la recomiendo: toca el universo oficial); (d) `ventasMensuales.anterior` −100 en un mes. Alternativa sin tocar datos:
dejar los Δ y que la reconciliación general los DECLARE («marca difiere en $502K, no atribuible») — honesto, pero en un demo se lee como defecto.
⚠️ (b) y (c) —el escalado a mano de marca y familia— quedaron DESHECHOS por §2-bis: marca y familia ya no se escriben, se derivan de los SKU. Lo que NO se propone: materializar bonanza en las tablas (obligaría a inventar la partición marca↔cliente y perdería la venta exacta por SKU).

## §2-bis · La base del demo son dos átomos: cliente y producto (decisión del owner, 2026-10-06 · segunda consolidación)

**La decisión (textual en lo esencial).** En un negocio real la verdad es cada fila de venta; **cliente y producto son dos formas de sumar las mismas filas**; marca y familia son
**grupos de productos** (el contrato ya lo decía: `entityRegistry` `ENTITIES.sku.parents`, `motorKpi` «marca y familia = suma de sus SKU»). El demo no trae filas de venta, así que su base
son DOS tablas: `clientesVentas`/`clientesMargen` (el universo oficial, D8) y `skusMargen` (13 SKU, el universo completo de la venta: Σ venta = $100.000K y cada marca suma exacto su venta).
**Marca y familia no se escriben: se derivan.** Donde cliente y producto discrepan, **manda el cliente**; el producto se ajusta con **un solo factor por métrica, idéntico para los 13 SKU**
(ninguna marca ni SKU se eligió a mano), con redondeo de mayor resto para que cada suma sea exacta. Esto deshace el escalado a mano de marca y familia de §2 (b)(c).

**Qué se hizo (todo en `src/data/tenants/demo.js`; los clientes, `skuInventario`, cobranza, `ventasMensuales`, los KPI y la lógica de las simulaciones no se tocaron).**

| métrica (Σ) | SKU antes | cliente (manda) | factor único | SKU ahora |
|---|---|---|---|---|
| contribución | 23.738 | 25.057 (venta oficial × margen por cliente = `margenKPI.totalUSD`) | × 1,0556 | 25.057 |
| acciones comerciales (rebates) | 4.130 | 4.075 (universo cliente = serie mensual) | × 0,9867 | 4.075 |
| unidades | 674 | 5.520 | × 8,19 | 5.520 |
| venta | 100.000 | 100.000 | — | 100.000 (sin tocar) |

`costo = venta − rebates − contribución` · `margen = contribución ÷ venta` · `pctRebate = rebates ÷ venta` · `costoMedio = costo ÷ unidades` · `precioLista = venta ÷ unidades` (las definiciones de siempre).
`benchmark` no se toca. **Marca y familia** (`marcasVentas`, `marcasMargen`, `sfamiliasVentas`, `sfamiliasMargen`) son ahora funciones de `skusMargen`: Σ venta, costo, rebates, contribución y
unidades; margen y carga salen de esas sumas, como las calcula el motor de planillas (`motorKpi.js` `bloqueMargen`; el demo suma la contribución de los SKU en vez de recalcular
venta × margen redondeado, para cerrar al peso). **Lo único que sigue DECLARADO por marca** es lo que ningún SKU trae —la venta y las unidades del año anterior—: Σ $92.900K · Σ 5.222
unidades, iguales a las del universo cliente; la familia suma las de sus marcas.

**Impacto medido (antes = HEAD `cd16580a`, ya calibrado ayer; ahora = esta consolidación).**

| | antes | ahora |
|---|---|---|
| margen de marca | Samsung 23,7 · LG 23,5 · Philips 26,1 · Bosch 25,5 · **Makita 34,8 (la mejor)** | Samsung 23,4 · LG 22,8 · **Philips 28,8 (la mejor)** · Bosch 24,9 · Makita 26,1 |
| margen de familia | Materiales 28,3 (la mejor) · Cuidado 26,1 · Electro 23,7 · Línea Blanca 23,5 | **Cuidado 28,8** · Materiales 25,3 · Electro 23,4 · Línea Blanca 22,8 |
| contribución de marca | Samsung $7.493K · Philips 7.301 · LG 5.791 · Bosch 2.801 · Makita 1.671 | **Philips $8.066K** · Samsung 7.379 · LG 5.620 · Bosch 2.737 · Makita 1.255 |
| carga de marca | Samsung 4,4 · LG 3,6 · Philips 3,6 · Bosch 5,4 · Makita 4,2 | Samsung 4,3 · LG 3,9 · Philips 3,5 · Bosch 5,0 · Makita 4,6 |
| unidades de marca | Samsung 1.747 · LG 1.268 · Philips 1.892 · Bosch 436 · Makita 177 | Samsung 1.056 · LG 754 · Philips 3.088 · Bosch 466 · Makita 156 |
| SKU | PHI-HAIR-PRO 30,0 % (bajo el benchmark 30,1) | **31,7 % (lo cruza)**; los rankings de SKU por contribución y por margen no cambian |

**Conclusiones que cambian por esto** (medidas, no ajustadas; cada una con su causa): `marca-desde-sku` (Philips pasa a primera en contribución de marca y de familia; Cuidado Personal a primera en
margen de familia; sobre el nivel de carga quedan 4 de 5 marcas y 3 de 4 familias, porque Philips pasa a 3,5 %) · `makita-deja-de-ser-mejor-margen` (ya no es la de mejor margen ni supera el benchmark:
0 de 5 marcas lo superan) · `phi-hair-cruza-benchmark` (11 de 13 SKU bajo el benchmark, antes 12) · `unidades-de-sku-calibradas` (LG-WASH11KG y BOS-DRILL18V ya no empatan en unidades: 328 contra 327) ·
**`unidades-de-marca-desde-sku`** (consecuencia declarada, no ajustada: las unidades de marca salen del SKU y las del año anterior siguen declaradas por marca, así que la lectura volumen/precio por
marca y familia cambia de verdad —«empuja el volumen» pasa de LG +11,7 % a Philips +72,7 %; el precio realizado de LG sube +74,0 % y el de Samsung +67,9 % contra +3,5 % y +1,5 % antes—: cifras que
el dato de fábrica ya no sostiene con sentido de negocio y que el owner debe mirar; **RESUELTA el 2026-10-07 con la Opción A, abajo**). El nuevo estado de las 532 está sellado por `_una_sola_realidad_gate` §5 y §8.

**Notas que dejan de ser verdad y se retiran.** `concentration.js` `_limite` ya no dice que el eje SKU «muestra la cifra BASE… su total no coincide con el de los otros ejes» ni que una marca «sin cliente»
desaparece «con transforms de simulación aplicados»: lo único que conserva es el caso estructural «una marca que el Cuadro muestra y el gráfico no tiene como fila de venta», sin lenguaje de escenarios.
La declaración `reconcilian` del demo (`compatibilidad` y `DIVERGENCIAS`, byte-iguales) decía «unidades del mismo SKU difieren entre 4x y 35x» contra `skuInventario`: recalculada con las unidades nuevas
(ritmo de venta de la foto × 365 contra las unidades del año) es **entre 0,5x y 4,4x**; el par sigue `divergent` por escala y período. El concordancia del «ring de marca» del manifiesto ya no afirma
que su margen y su contribución no coinciden con `marginRead{marca}`: coinciden (Samsung 23,4 % y $7.379K). Lo que no cambia: inventario y venta siguen sin reconciliar, y los SKU siguen sin
unidades comparables con el inventario.

**Qué queda abierto (para el owner).** (1) ~~Las unidades del año anterior por marca (y por familia) siguen declaradas a mano~~ → resuelto el 2026-10-07 (Opción A, abajo). (2) `historialMargen` por marca, familia y SKU es la serie sintética
que ya declaraba «margen plano» y no se toca: su margen y su contribución anual ya no son los de la tabla (Samsung 24,2 contra 23,4); la capability sigue bloqueando esa evolución por entidad.
(3) `CLAUDE.md` §4 todavía dice «entre 4x y 35x» y «los dos universos que no reconcilian» sin la excepción de que cliente, SKU, marca y familia ya cuadran: no se tocó (regla del repo).

### §2-bis · Decisión del owner 2026-10-07 (Opción A): las unidades del año anterior por marca son el CRECIMIENTO DECLARADO, a la escala nueva

**El problema.** Al derivar las unidades de la marca desde sus SKU (Σ 5.520), las del año anterior seguían declaradas contra la tabla VIEJA de marca (Σ 5.222, otra escala: Samsung 1.703 contra 1.056 de ahora, Philips 1.788 contra 3.088…).
La lectura volumen/precio por marca y por familia salía absurda: precio realizado Samsung +67,9 %, LG +74,0 %; volumen Philips +72,7 %, Samsung −38,0 %, LG −33,6 %.

**La decisión (Opción A, aprobada).** Lo único que la tabla vieja declaraba por marca sobre las unidades del año anterior es su **crecimiento en unidades** (unidades ÷ unidadesAnt de la tabla vieja: Samsung 1.747/1.703 · Philips 1.892/1.788 · LG 1.268/1.135 · Bosch 436/434 · Makita 177/162).
Se respeta a la escala nueva con **UNA regla para las cinco marcas**:

> unidadesAnt(marca) = unidades(marca, Σ SKU) × (unidadesAnt vieja ÷ unidades vieja) × **f**, con UN factor uniforme f = 5.222 ÷ Σ crudo (≈ × 0,9986) para que Σ siga siendo la del universo cliente, y redondeo de mayor resto para que sume exacto.

El par viejo (unidades, unidadesAnt) es el **único insumo declarado** (`_CRECIMIENTO_UNIDADES_DECLARADO` en `src/data/tenants/demo.js`); el factor y los resultados se CALCULAN (`_unidadesAntDeMarca`), no se escriben. La familia suma las de sus marcas. La venta del año anterior por marca (Σ $92.900K) no se toca.

| marca | unidades ahora (Σ SKU) | unidadesAnt antes | **unidadesAnt ahora** | volumen antes → ahora | precio realizado antes → ahora |
|---|---|---|---|---|---|
| Samsung | 1.056 | 1.703 | **1.028** | −38,0 % → **+2,7 %** | +67,9 % → **+1,4 %** |
| Philips | 3.088 | 1.788 | **2.914** | +72,7 % → **+6,0 %** | −38,0 % → **+1,1 %** |
| LG | 754 | 1.135 | **674** | −33,6 % → **+11,9 %** | +74,0 % → **+3,3 %** |
| Bosch | 466 | 434 | **463** | +7,4 % → **+0,6 %** | −4,9 % → **+1,5 %** |
| Makita | 156 | 162 | **143** | −3,7 % → **+9,1 %** | +14,3 % → **+0,9 %** |
| Σ | 5.520 | 5.222 | **5.222** | | |

Familias (suman sus marcas): Electrodomésticos 1.028 (vol +2,7 · precio +1,4) · Cuidado Personal 2.914 (+6,0 · +1,1) · Línea Blanca 674 (+11,9 · +3,3) · Materiales de Construcción 606 (+2,6 · +1,7; antes +4,4 · +0,1).
El crecimiento resultante coincide con el declarado dentro de ±0,3 pp en las cinco marcas (el redondeo a unidad entera de Makita, 143, da +9,1 % contra +9,3 % declarado). El total del negocio no cambia (volumen +5,7 %, precio realizado +1,8 %: es el universo cliente).

**Qué se movió.** Solo la tabla de marca y de familia: `unidadesAnt`. Los 532 encargos v13–v40 no leen ese campo: 0 textos cambian (ni `sha` de caso ni sha256 completo), no hubo que re-sellar nada ni sumar causa nueva a `_una_sola_realidad_gate` §5.
**Candado:** `_una_sola_realidad_gate` §8 (Σ unidadesAnt marca = familia = cliente = 5.222; la regla única reproducida con mayor resto; cada crecimiento dentro de ±0,3 pp del declarado; lectura volumen/precio creíble leída por el motor; carnadas: la tabla vieja
—que sigue sumando 5.222 pero en otra escala—, +5 a mano en una marca, una familia que no suma sus marcas).

## §3 · Las simulaciones sobre la realidad

- Hoy `applyScenarioToClientesVentas` solo sabe `anterior × (1+growth)`; sin base, `growth` undefined → `actual = NaN`. **Regla nueva:** `growth` es un DELTA
  sobre la cifra real (`actual × (1+g)`, `unidades × (1+0,7g)`); sin `growth` en el override, la fila real queda intacta. `marginErosion`, `rebateDelta`,
  `__remove__`, `__set__` ya son deltas/filtros sobre la fila: no cambian. `mergeTransform(undefined, override)` ya funciona (`Object.assign({}, undefined)`).
- Medido con el prototipo (antes → después): margen Falabella +2 pp: contribución simulada 25.416 → 25.446 (base 25.028 → 25.057; el Δ de la simulación es
  +388K/+389K: igual); perder Lider: venta 82.044 → 82.143 (= 100.000 − 17.857), margen 25,8 % igual; «Falabella crece 10 %»: +$427K → +$428K;
  precio Jumbo +5 %: +$865K → +$867K; `simulateCarga −1 pp`: $998.870 → $1.000.000; `simulateCapital`/`simulateCosto`: byte-idénticos (inventario no
  cambia). **Ninguna simulación cambia de signo, de orden ni de conclusión**; cambian solo las cifras de partida (las de §4a). 0 NaN tras el null-safe.
- `tension`/`crisis`: se retiran del dato (ningún consumidor de producto); las ramas por nombre de `applyScenarioToSkuInventario` y `_seededRand` mueren con
  ellos; los gates que los usaban para «otro mundo» pasan a construir su mundo con un `override` explícito (eso es exactamente Simulate v2). Candado
  anti-resurrección (patrón `_poda_natural_anti_resurreccion_gate`/`_colapso_eje_gate`): ningún tenant ni `src/` declara una clave en `SCENARIO_TRANSFORMS`
  distinta de `{}`; ningún `=== "bonanza"|"tension"|"crisis"` fuera de comentarios; `ESCENARIOS_CON_TRANSFORM` no se redefine.
- Planillas reales: con `growth` como delta sobre la realidad, las simulaciones dejan de depender de un transform base → `motorKpi.js:63` /
  `normalizar.js:171` podrían dejar de declarar «las simulaciones» ausentes. **Solo se anota; no se diseña aquí.**

## §4 · Impacto medido (prototipo en la copia; demo salvo donde se indica)

**(a) Cifras visibles que cambian** (Sentrix y ADI leen el MISMO motor: Mesa, Cuadro, tools, Entrega cambian a la vez):

| dónde | hoy (bonanza) | con la realidad única |
|---|---|---|
| Ventas totales (Mesa Comercial, KPI, Entrega, kpisDelNegocio) | $99,9M · +7,5 % vs año ant. · +3,0 % vs ppto (y a la vez $100,0M/+7,6 % en `getVentasKPI`/Mesa Estado) | **$100,0M · +7,6 % · +3,1 %** en todas las superficies |
| Contribución / margen de la cartera | $25,0M · 25,1 % (y 25,6 %/$25,6M en `getMargenKPI` → overview) | **$25,1M · 25,1 %** (una sola) |
| Clientes (13) | Falabella $19.413K · Lider 17.843 · Jumbo 17.306 … | $19.433K · **17.857 ($17,9M, antes $17,8M)** · 17.332 …; Δ por cliente $2–26K (≤0,15 %); variación +0,1 pp |
| Marcas (Cuadro, Pareto, tools) | 4 marcas rearmadas (Samsung $33,2M · Philips 29,4 · LG 25,8 · Bosch 11,5) + Makita 4,8 fuera del gráfico, Σ $104,7M | **5 marcas de tabla: Samsung $31,6M · Philips 28,0 · LG 24,6 · Bosch 11,0 · Makita 4,8 = $100,0M**; desaparece el límite «población incompleta» |
| Familias | Materiales de Construcción $11,5M · margen 26,0 % | **$15,8M · 28,9 %** (+37 %: entra Makita); las otras tres bajan 4–5 % |
| Mesa Estado «cambios» | «Ripley es quien más cede (−$422K, −8,2 %)» | **«La Polar es quien más cede (−$417K, −12,4 %)»** (Ripley −$414K) |
| Diagnose / brecha vs benchmark | $4,94M no capturado · $655K carga sobre el nivel | $4,95M · $656K (Δ +0,1 %) |
| Rioclaro (arnés) | cliente $176.052K · marca $184.512K | cliente $176.248K · marca $176.247K (Δ 1K de redondeo) |
| Empresa2 | venta por cliente idéntica (`_growthExacto`) | igual; unidades por cliente ±3 %, marcas/familias pasan a tabla (+NevadaFoods $2,6M) |

**(f) Conclusiones del procedimiento que CAMBIAN (crítico):** ① «quién más cede en venta»: Ripley → La Polar (empate técnico: −422 vs −420 hoy; −414 vs
−417 con la tabla); ② conteos sobre el nivel de carga por marca/familia: «3 de 5 marcas sobre 3,5 %» → **5 de 5** (LG y Philips 3,6 %) y «2 de 4
familias» → **4 de 4** (`v27:M45`) — consecuencia de la inconsistencia `pctRebate` de §2 (con la corrección (a) sigue siendo 5/5: es la verdad de la
tabla `*Margen`); ③ ranking de familias: por variación el 3.º pasa de Electrodomésticos (4,1 %) a Materiales (4,4 %) y por margen Materiales pasa de 2.º
(26 %) a 1.º (28,9 %); por contribución LG/Philips **no** cambian de orden (defecto aparte: sin transform el motor devuelve la tabla SIN ordenar y el
Cuadro por marca la pinta en orden de tabla — hay que ordenar en la rama identidad); ④ Makita gana «variación vs año anterior 10,1 %» (antes declarada
ausente). **No cambian:** el top 3 de clientes y su orden, la prioridad integrada (Lider antes que Falabella), las cuentas sobre el nivel de carga por
cliente (6), el bloque 80/20, los estados de inventario y cobranza, los veredictos de las simulaciones.

**(c) Los 532 textos de encargos v13–v40 (`sondeo-532.mjs` + `clasificar-532.mjs`):** 312 idénticos · **220 cambian**: 125 solo cifras (misma frase,
p. ej. Lider $17,8M → $17,9M), 16 cifras + la línea de premisa, **79 con estructura** — y de esos, la mayoría es ARTEFACTO DEL FIXTURE: 194 de los 220
encargos traen premisas numéricas («lo que usted da por hecho: Lider · Ventas = $17,8M») generadas desde el dato de ENTONCES, que ahora «no coinciden» y
agregan una línea. Cambios reales de contenido: las 5 marcas con Makita en los listados por marca, los conteos/rankings de (f), «se mantiene» por
redondeo en una simulación (`v17:W23`). Rioclaro no está en los 532 (el gate §2 es demo).

**(d) Fixtures congeladas afectadas:** `fixtures/total-del-listado/textos-v13-v40.sha256.json` (220 hashes) y `fixtures/procedencia/muestra-v13-v40.json`
(premisas con valores de entonces → se REFRESCAN por script desde el dato vigente, no a mano); `_total_del_listado_gate:98,120` fija «$176.1M» para rioclaro
(→ $176.2M); `_medicion_anfitrion_gate` F2 y `_prioridad_integrada_gate` citan $17,8M/$19,4M dentro de prosa real archivada (fixtures de producción:
se comparan contra sus propias Entregas archivadas o contra figs vivas — ver §4b); `_certificacion_congelada_gate` (replay del expediente) y
`fixtures/encargos-desarrollo.json`: ver §4b. `_capital_ligado_cliente_gate_bundle:332-344` copia los 13 `growth` de bonanza a mano.

**(b) Gates rojos con el prototipo (`npm run gates:offline` en las dos copias, 0 TOCARON LA RED · 0 CON CREDENCIAL VIVA):** §4b (abajo).

**(e) Rioclaro y el arnés:** `packRenombrado` renombra claves dentro de `SCENARIO_TRANSFORMS` (hoy un no-op con `{}`); la empresa deja de arrastrar el
descuadre marca/cliente (Kestrel = Makita renombrada); su total pasa a $176,2M; los fixtures `ensayo-1/2-compacto.json` guardan prosa Y Entregas de
entonces (se juzgan entre sí), por lo que el rastreo no depende del dato vivo.

## §4b · Suite offline: rojos atribuibles al prototipo (medido)

Línea base (copia limpia del HEAD): **317 PASS · 0 FAIL**. Con el prototipo: **269 PASS · 48 FAIL** (ambas: 0 TOCARON LA RED · 0 CON CREDENCIAL
VIVA, de 317 offline). Los 48 son atribuibles al cambio (0 preexistentes); uno es espejo (`_voz_etapa3_gate` relanza la suite y lista los otros 47).
Clasificación de los 47, leyendo cada ✗:

- **Cifra fijada del demo en el gate o en una prosa archivada (32) — se re-fija, no es defecto:** `_atribucion_y_significado` (28 ✗, «Lider vende $17.8M»),
  `_orden_en_todas_sus_formas` (9, ídem), `_grupos_conteos_universos` (12, «$655K», «Ripley cae $422K»), `_anclas`, `_notario_v3_flujo`, `_hechos`
  («Lider variación 15,0 %» vs 14,9), `_binding_guard`, `_lever` («+$655K»), `_agente_contrato`, `_encargo_compuesto` (11, «de eso, $655K»),
  `_prioridad_integrada` (7, borradores reales con «+7.5%»), `_cobertura_del_encargo` (fixture de producción: «Ripley −$422K», «Jumbo 1194»),
  `_capacidad_continuidad`/`_retomar_revalida`/`_puerta_compacta` («antes $17.8M (17.843.000)»), `_display_k` («$99.9M · $25.0M»), `_pnl_canonico`
  (resultado $18,5M → $18,6M), `_agente_bucle`/`_densidad_ejecutiva`/`_agente_playbooks`/`_iniciativa`/`_entrega_general` (prosa guionada con «$99.9M»,
  «+7.5%», «36,3 %»), `_medicion_anfitrion` (participación 20,2 % de rioclaro), `_agente_adapter` (techo 4.700 tok, hoy 4.711), `_reformular`,
  `_total_del_listado` («$176.1M» → $176.2M), `_narrativa_del_dato` (literales del overview), `_adversarial_notario`/`_notario_semantico(_flujo)`/
  `_notario_adversarial`/`_ronda5` (sus fixtures de prosa dicen $17,8M/+7,5 %: el Notario los juzga —correctamente— falsos contra la boleta nueva; el
  «FP 3 → 200» es eso, no una regresión del juez: se re-generan las etiquetas o se refrescan las cifras de la prosa por script).
- **Por diseño — el gate certificaba que el escenario existía (10):** `_una_sola_carpeta` («bonanza declarado en los transforms»), `_tipado_cifra`
  (espejo de `ESCENARIOS_CON_TRANSFORM`), `_escenario_del_turno`, `_carga_delta_alcance`/`_jerarquia_inventario`/`_materialidad_relativa`/
  `_resumen_comercial`/`_evidence_spec_marca_reconciliation`/`_amplitud_dato_narrador` (tension/crisis → «otro texto»), `_pnl_canonico` («distinta en los
  tres escenarios»), `_venta_oficial_una_verdad` (carnada que supone el rearme). Se reescriben con `override` o se retiran con nota (§6.4).
- **Sello de los 532 (3, más `_total_del_listado` §2):** `_procedencia` §1, `_tamano_general`, `_universal_localizado` («311 de 532 idénticas»): §4c/§6.5.
- **Conducta que CAMBIA y hay que mirar (2):** `_v12_correcciones` (16 ✗: «la foto por marca trae 5 marcas y al menos una sin variación» — Makita ya la
  tiene; «2 de 4 familias sobre el nivel de carga» → 4 de 4, el conteo de (f)②) e `_invariantes_consolidacion` (22 ✗: K57 «LG tiene la mayor variación»
  ya no es «extremo sobre ranking incompleto» porque el ranking está completo; las secuencias del generador cambian porque las premisas toman cifras
  del dato). Ambos son la verdad nueva, no un defecto; sus expectativas se reescriben con el owner mirando (f).
- **Defecto real destapado (1, fuera de los 48 porque ningún gate lo mira):** el Cuadro por marca/familia se pinta en orden de TABLA cuando no hay
  transform (§6.1). Hoy una planilla real ya lo sufre.

## §5 · Qué cambia para el usuario (en lenguaje de negocio)

- Deja de haber dos cifras para lo mismo: hoy la Mesa dice «$99,9M · +7,5 %» y el KPI de cabecera/ADI dicen «$100,0M · +7,6 %»; margen 25,1 % en la Mesa y
  25,6 % en el resumen. Con la realidad única todas dicen **$100,0M · +7,6 % · 25,1 %**.
- Las marcas y las familias vuelven a sumar lo mismo que los clientes ($100,0M) y Makita entra al gráfico de concentración con su cifra: desaparece la
  nota «una marca no aparece en este gráfico». Materiales de Construcción pasa de $11,5M a $15,8M porque Makita ES de esa familia.
- Las cifras por cliente se mueven ≤ 0,15 % (Lider se lee $17,9M en vez de $17,8M); dos lecturas de borde cambian (quién cede más: La Polar; cuántas
  marcas superan el nivel de carga: todas). No cambia quién es prioritario ni ninguna simulación.
- Pregunta de fondo para el owner: el 2026-08-07 se dijo «bonanza es la realidad»; medido, bonanza es la TABLA con redondeo de 13 porcentajes (Δ ≤ $26K
  por cliente) más un rearme de marcas que inventaba una partición. La realidad es la tabla.

## §6 · Plan para Sonnet (pasos chicos, suite verde entre pasos, todo offline)

1. **Motor null-safe (sin cambio observable):** `applyScenarioToClientesVentas` con `growth` como delta sobre `actual` y sin `growth` → fila intacta;
   `deriveKpis.pctAnt` cae a `margenKPI.pctAnt` cuando no hay literal; rama identidad de `applyScenarioToMarcas*/Sfamilias*/MarcasMargen` devuelve la tabla
   **ordenada** (venta desc / contribución desc, igual que la rama con transform). Carnadas: override solo `marginErosion` → 0 NaN; Cuadro marca ordenado.
2. **Dato del demo:** corrección mínima §2 (a)(b)(c)(d) en `demo.js` con comentario de calibración; `cuadre-tablas` como gate nuevo
   `_una_sola_realidad_gate` §1: Σ venta/contribución/unidades/acciones iguales en cliente·marca·familia·mensual·KPI (tolerancia = redondeo medido, nunca
   un literal). Antes de este paso, §4b dice qué gates cambian de cifra: se re-fijan SOLO los que citen cifras del demo (cifra fijada), nunca una ley.
3. **Retiro del resto:** `SCENARIO_TRANSFORMS = {}` en demo y empresa2 (+ `_growthExacto`, `_T_*`, `_kpisDe` fuera); `getVentasKPI`/`getMargenKPI` derivan de
   filas (`deriveKpis`) y dejan de leer `kpis`; `ESCENARIO_INICIAL` se conserva como la única ranura (renombrar es churn) pero `_una_sola_carpeta_gate` deja
   de exigir que esté «declarado en los transforms» (exige lo contrario: transforms vacíos); `applyScenarioToSkuInventario` pierde las ramas tension/crisis y
   `_seededRand`; `figureType.js` fija `ESCENARIOS_CON_TRANSFORM = []`, `ESCENARIOS_QUE_ALTERAN_TASAS = []` (las reglas `ejesSoloConEscenario` quedan sin
   disparador: la boleta sella familia/marca como literal — verificar con `_tipado_cifra_gate` y el Notario mirando).
4. **Gates que ejercitaban tension/crisis** → construyen su «otro mundo» con un `override` explícito (`_escenario_del_turno`, `_concordancia_numerica`,
   `_capital_ligado_cliente_bundle`, `_tipado_cifra`, `_oracle_venta_d8` «actual» pasa a ser la realidad misma). Un gate cuya propiedad era «dos mundos dan dos
   textos» se reescribe con override; uno cuya propiedad era «bonanza existe» se retira con nota.
5. **Re-fijar líneas base, legítimamente:** (i) los catálogos v13–v40 son sellados a mano (no salen de una semilla): un script refresca en
   `muestra-v13-v40.json` el VALOR de cada premisa numérica desde el dato vigente (`publica()` de `scripts/consolidacion/base.mjs`, lo mismo que hizo quien
   las escribió) sin tocar el encargo, y luego se re-sella
   `textos-v13-v40.sha256.json`; exigir en el gate que el diff contra el sello viejo sea SOLO cifras + premisas + los casos de (f) listados por id (diff por
   líneas, como propuso `_ADI_DISENO_RECONCILIACION_EJES.md` §3); (ii) `$176.1M` → `$176.2M` y cifras análogas en gates (fijadas, no leyes); (iii) `_certificacion_congelada`
   y `encargos-desarrollo.json`: re-fijar solo si el cambio es de cifra; un cambio de orden/veredicto se trae al owner antes. **Lo que sería esconder un
   defecto:** aflojar una tolerancia, quitar una aserción de orden, o re-sellar un texto cuyo cambio no esté en (f).
6. **Candado anti-resurrección** (§3) + nota en `CLAUDE.md §4` («el escenario ya no existe: las tablas del tenant son la realidad; las simulaciones son
   deltas») + memoria `adi-colapsar-escenarios` cerrada. Luego retomar `_ADI_DISENO_RECONCILIACION_EJES.md` para planillas (SKU sin marca).

## §7 · Decisiones para el owner (pocas, con recomendación)

1. **¿La tabla es la realidad, aun cuando cambia cifras que hoy ve el usuario (≤0,15 % por cliente, Materiales +37 %, dos lecturas de borde)?**
   Recomiendo **sí**: es la única fuente que cuadra en venta en los cuatro ejes y la que ya usan las planillas reales; «bonanza» era la tabla redondeada.
2. **Corrección del dato sintético (§2 a–d) vs declarar los Δ de Makita.** Recomiendo **corregir** (9+6+4 filas, con precedente) para que el demo cumpla
   «una sola verdad por eje»; la reconciliación general queda para planillas.
3. **Las dos conclusiones que cambian (La Polar «cede más»; 5/5 marcas sobre el nivel de carga).** No hay nada que decidir si se acepta 1: son la verdad de
   la tabla; se declaran en la nota de versión. Alternativa: ajustar La Polar/Ripley para conservar la lectura de hoy — no la recomiendo (inventa).
4. **Alcance del retiro:** solo el dato + motor + gates (recomendado) · o también renombrar `ESCENARIO_INICIAL`/`scenario` (~120 archivos, sin valor visible).

## §8 · Decisiones del owner (2026-10-06)

Aprobadas las cinco como se recomiendan: (1) las TABLAS del tenant son la realidad · (2) corregir el dato sintético del demo (§2 a–d) ·
(3) las conclusiones que cambian se aceptan como verdad de la tabla, sin ajustar el dato · (4) alcance: dato + motor + gates, sin renombrar
`ESCENARIO_INICIAL`/`scenario` · (5) la reconciliación general entre ejes (`_ADI_DISENO_RECONCILIACION_EJES.md`) queda ANOTADA para la etapa
de Ingesta/piloto: NO entra a este cierre (el §6 paso 6 «luego retomar» no se ejecuta ahora).
