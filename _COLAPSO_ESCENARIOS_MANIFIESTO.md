# MANIFIESTO · Colapso del eje de escenarios

**Insumo para la revisión ultracode multi-agente del chat principal.** El colapso NO se declara cerrado hasta
que esa revisión pase (condición del encargo).

## El encuadre, palabra del owner (2026-08-07, ejecutado 2026-08-30)

> «al final el escenario bonanza es el que usó la realidad de los datos, es mantener ese y eliminar el concepto
> escenario. La lógica está bien, al final quedaremos con uno solo, la realidad.»

- El dato de `bonanza` ES la realidad → se elimina el CONCEPTO visible y multivaluado, no la lógica ni los datos.
- **NO** es cambiar el default a `actual` (cambiaría los datos que ve el usuario — error ya corregido una vez).
- **Simulate v2 QUEDA**: su sustrato es el mismo motor de transforms (`resolveTransform(scenarioId, override)`
  mezcla el supuesto del usuario sobre la base). El motor no se toca.
- Autorización adicional del owner para C7 («si autorizado!»): decisión (B) — narrativas guionadas del overview
  colapsadas a data-driven para TODOS los tenants, demo incluido.

## Los cortes (cada uno con commit en dev, suite verde tras cada uno)

| Corte | Commit | Qué murió |
|---|---|---|
| C1 · elegibilidad | `976397c` | `ScenarioSelector.jsx` BORRADO · flag `ADI_SCENARIO_SWITCHER_ENABLED` retirado (voiceFlags+flagProfile) · App: `useState` → `const scenario = ESCENARIO_INICIAL` (ni estado ni setter) |
| C2 · ramas-por-nombre | `0bb9121` | Guard SKU-margen×escenario completo (`_esSkuMargenNoBonanza`+`_SCN_LABEL`+`_skuMargenScenarioMsg`+dispatch+flag `ADI_SKU_SCENARIO_GUARD_ENABLED`) · `surfaceContract.blockedWhen` (26 entradas) + sus 2 callers + `surfaceBlock` sin parámetro de escenario |
| C3 · defaults | `f709c8f` | 35 literales `\|\| "bonanza"` / `= "bonanza"` en 17 módulos → `ESCENARIO_INICIAL` (byte-idéntico) |
| C4 · superficie | `134b701` | Headers qi sin «· escenario X» · diagnose+3 openers emiten «· base real» directo · executiveReport sin favorable/de tensión/crítico · honestFallback «del negocio» · viewContext/progressiveDisclosure dejan de VERBALIZAR el escenario · mapa del agente sin «escenario actual» + defaults del agente a `ESCENARIO_INICIAL` |
| C5 · defaults «actual» | `c259a9e` | 28 defaults de conveniencia `scenario = "actual"` en 12 módulos oráculo/sentrix/composers → `ESCENARIO_INICIAL` (prod no los usaba: ChatADI pasa la constante; disparaban en gates que omitían) |
| C6 · scrub y labels | `1b8772f`+fix `938ec3a` | `_scrubScenario` retirado del seam (no atajaba nada — sucesor: el lock de emisión del gate, sin exenciones) · `SCENARIOS` (labels UI) retirado de config · 3 gates re-fuenteados a `SCENARIO_TRANSFORMS` |
| C7 · narrativa | `cadfa70` | Las 6 cadenas if-bonanza/tension/crisis de `composeModuleOverview`/V2 + 6 bloques `suggestionsByScenario` → UNA narrativa data-driven |

## Ramas desarmadas y qué hacían

1. **`answerADI.js` guard SKU-margen×escenario** — bloqueo honesto de margen-por-SKU SOLO fuera de bonanza.
   Con la base constante, ese «fuera» no existe: guard inalcanzable = concepto muerto en el camino de la
   respuesta. Nadie lo gateaba.
2. **`surfaceContract.blockedWhen(scn)`** — disponibilidad condicional por escenario (margen@sku/@marca «fuera
   de bonanza»). En vivo AMBOS callers pasaban `"bonanza"` → devolvía `null` SIEMPRE. Los pares no declarados
   siguen cayendo honestos por el camino de «no inventariado».
3. **`executiveReport._composeReportIntro`** — etiqueta favorable/de tensión/crítico por nombre.
4. **`qiRetrieval` scenarioLabel** — «· escenario Bonanza/Tensión/Crisis» en headers de tabla.
5. **Las 6 cadenas narrativas del overview** — guiones de la película del demo (ver hallazgo 3).

## Hallazgos EN VIVO durante el barrido (no por inspección)

1. **El usuario VEÍA «· escenario Bonanza» en cada tabla ranked**: el camino 16/0 (answerADI) no pasa por el
   scrub del seam (que solo cubría answerADIFromSpec). Verificado ejecutando `answerADI("dame el top 5…")`
   antes de cortar. La fuga exacta que disparó el colapso, viva en producción.
2. **Dos carpetas agente/pantalla**: los módulos NUEVOS del agente (mapa, bucle, sistema, herramientas)
   defaulteaban `scenario = "actual"` (la base cruda NO declarada) mientras la pantalla sirve `bonanza` — la
   clase de defecto del 2026-08-15, reintroducida en la superficie nueva. Muerta en C4/C5 + lock repo-wide.
3. **La narrativa guionada mentía sobre packs reales**: un pack con venta −0.9% recibía «Las ventas crecen
   −0.9% YoY» (dirección invertida — la falta sagrada) y reparto inventado («Tier 1», «canal digital»,
   «e-commerce», «Materiales de Construcción»/«Línea Blanca» en sugerencias). Cerrado en C7 con las dos
   carnadas del owner.

## Expectativas de gates actualizadas, con su porqué (escrito en cada gate)

| Gate | Cambio | Porqué |
|---|---|---|
| `_una_sola_carpeta_gate` | `useState(ESCENARIO_INICIAL)` → `const scenario = ESCENARIO_INICIAL` · declarado = SCENARIO_TRANSFORMS | la propiedad se volvió MÁS fuerte (ya no hay setter); el registro de lo declarado son los transforms |
| `_spec_gate` #40 | ya no exige VER «base real» (la reescritura del scrub) | el emisor no dice nada que scrubear; la propiedad real es cero lenguaje de escenario |
| `_oracle_venta_d8_gate` | `buildEntityRecord`/`buildGrid` con mundo explícito `"actual"` | viajaban gratis en el default; la regla del propio gate es UNA voz = UN mundo declarado |
| `_simulate_general_gate` | el ancla declara `scenario: "actual"` | sus cifras hardcodeadas (19433/15158) son del mundo crudo; el mundo del ancla va explícito |
| `_concordancia_numerica_gate` | ids desde `SCENARIO_TRANSFORMS` | certifica que las tools no queden ciegas al motor de transforms (sustrato de Simulate v2), no los labels de UI |
| `_totales_cabecera_gate` | ídem | ídem |
| `_vocabulario_vara_gate` | regex de la banda calculada actualizado | la frase movió palabras en C7; la propiedad (promedio CALCULADO, no clavado) quedó — se exige la interpolación |

## Candados nuevos

- **`_colapso_eje_gate` (48 PASS · 14 carnadas)** — patrón `_poda_anti_resurreccion_gate`: lista explícita,
  DEFINICIÓN-no-mención (scan sin comentarios), sucesor vivo por cada retirado, ni un import colgando, detector
  auto-probado. Locks: elegibilidad muerta · ramas-por-nombre no renacen · cero defaults literales (bonanza Y
  actual, repo-wide) · **lock de EMISIÓN** («escenario ${…}» y etiquetas por nombre → rojo, sin exenciones).
- **`_narrativa_del_dato_gate` (13 PASS · 3 carnadas)** — las DOS carnadas del owner: dirección invertida
  («crecen» incondicional → el pack en caída lo delata) · «Tier 1» sobre un pack que no lo tiene · categoría
  del demo hardcodeada en el opener (las sugerencias tienen defensa propia: `filterTextualSuggestions` filtra
  entidades ajenas — verificado empíricamente).

## VIVO A PROPÓSITO, y por qué

1. **`ESCENARIO_INICIAL = "bonanza"`** (config/scenarios.js) — el único valor del eje colapsado, declarado una
   vez. Renombrarlo (p.ej. «BASE_REAL») es churn de identificadores internos sin valor de producto; el
   vocabulario visible ya no dice «escenario».
2. **El motor de transforms** (`engine/scenarios.js`, incluidas sus ramas por nombre en inventario y el
   fast-path `bonanza ? clientesMargen : apply(...)` de contribution.js) — sustrato de Simulate v2
   (`resolveTransform(scenarioId, override)`) y de la identidad bonanza≡base. «La lógica está bien.»
3. **`SCENARIO_TRANSFORMS`** en los tenants de fábrica (demo, empresa2) — dato del tenant; alimenta el motor y
   los gates que certifican que las tools NO están ciegas a los transforms.
4. **`figureType.js`** (`ESCENARIO_BASE = "actual"`, `ESCENARIOS_CON_TRANSFORM`, `ESCENARIOS_QUE_ALTERAN_TASAS`,
   `escenarioReDeriva`/`escenarioAlteraTasas`) — tipado de la cifra de la BOLETA: vecindario del notario
   (guardrail del owner: el notario y la boleta no se tocan). Colapsarlo exige al notario mirando — fuera del
   alcance de este barrido, dicho explícito.
5. **El parámetro interno `scenario`** (~121 archivos lo threading) — es la ranura por la que la constante y los
   overrides de simulación viajan. Quitarlo de las firmas es cirugía masiva sin cambio observable (el valor ya
   es constante en la app); si la revisión lo ordena, es un barrido propio.
6. **`vc.escenario`** en viewContext — campo de maquinaria (`dataSnapshotId`); dejó de VERBALIZARSE.
7. **Gates que ejercitan tension/crisis** (concordancia, capital_ligado, marca_reconciliation, figfor,
   materialidad, carga_delta, tipado_cifra…) — certifican el sustrato de simulación, no la UI.

## Notas para la revisión (cosas vistas y NO tocadas, a propósito)

- **`spine.js:52` `periodo: scenario || ESCENARIO_INICIAL`** — un campo llamado «periodo» que guarda un nombre
  de escenario (cruce de vocabulario heredado). Se pinneó el default (C3) sin renombrar el campo: renombrarlo
  toca el shape del spine (consumidores aguas abajo). Candidato a limpieza dirigida.
- **`filterTextualSuggestions` deja las sugerencias del overview del demo en `[]`** (ventas e inventario) —
  PREEXISTENTE al colapso (la lista que colapsé es byte-igual a la rama bonanza vieja). No es regresión mía;
  candidato a diagnóstico propio.
- **`executiveReport.COMPLIANCE_SCENARIOS`** — homónimo: catálogo de 4 casos de compliance, NO el eje de
  escenarios. Sin relación; se deja.
- **`_capital_ligado_cliente_gate`** define su lista local `["actual","bonanza","tension","crisis"]` — ejercita
  los valores contra el motor (legítimo, sección «gates que ejercitan»).
- Los `.tmp` bundles huérfanos en la raíz (`_capital_ligado_cliente_gate_bundle.tmp*.mjs`) son basura de
  corridas de otra sesión — no tocados (no son míos).

## Conteo final

**205 PASS · 0 FAIL · 0 TOCARON LA RED · 0 CON CREDENCIAL VIVA (de 205 offline)** — la suite entera, con los
dos candados nuevos adentro, tras el último corte. Deploy actual: v2.15 (`29c4e5c`); los cortes del colapso
están en dev, sin sello de versión (decisión del chat principal/owner).
