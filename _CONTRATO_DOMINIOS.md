# El contrato de dominios — especificación antes de implementar

**Escrito 2026-09-14 a pedido del owner**, después de la auditoría de preguntas que cruzan dominios (2/20 con los
dos dominios en la boleta; ver memoria `adi-cruce-de-dominios`). Decisiones del owner que esta especificación
ejecuta, textuales:

1. «Venta ↔ inventario se valida contra el archivo real, no contra una constante del demo… Si hay una diferencia
   temporal —ventas del período cerrado e inventario como foto— debe declararla y limitar la interpretación, no
   fingir que son el mismo tipo de medida.»
2. «Apaga la afinidad estimada cliente ↔ inventario. Si el archivo no contiene una relación determinística entre
   ambos, ADI no debe construirla.»
3. «Unidades/volumen pertenece al contexto comercial y no debe quedar en 0 cifras.»
4. **La ley:** «La pregunta determina qué dominios participan; cada dominio aporta su realidad suficiente; ADI cruza
   únicamente sobre relaciones que el archivo realmente demuestra.» — «Quiero composición, no exclusión.»

Todo lo de abajo reutiliza piezas que ya existen; lo nuevo son tres declaraciones y una regla de unión.

---

## 1 · Qué contiene la realidad completa de Inventario

Diez capítulos, como los diez del contrato comercial. Nueve salen de herramientas que ya existen; el décimo
(unidades en stock por SKU) es una métrica declarativa nueva sobre un campo que el dato ya trae (`stockUnd`).

| # | Capítulo | De dónde sale hoy | Estado |
|---|---|---|---|
| 1 | Capital total en inventario y **fecha de la foto** | `queryMetric{capital, sku}` (fig «Capital · total») · fecha: `hechos.inventarioDe` del pack (el demo no la tiene → «foto a hoy») | existe |
| 2 | Estados: frenado · riesgo de quiebre · sobrestock · sano, con monto | `inventoryStatus{frenado}` publica los 4 totales («Estado del inventario: …») | existe, **salvo inventario sano**: con cero SKU frenados la herramienta declina «no hay señal» (medido en la plantilla de ejemplo) — se extiende la rama que ya existe para alcances con nombre («En X tienes $Y y nada inmovilizado») al caso global |
| 3 | SKU con capital, días de inventario y rotación | `queryMetric{capital, sku}` + `queryMetric{doh, sku}` + los SKU frenados con su rotación | existe |
| 4 | Capital por bodega | `queryMetric{capital, bodega}` | existe |
| 5 | Capital por familia y **por marca** | familia: existe · marca: **una línea** en `metricRegistry` (`skuInventario` trae `marca` en los tres datasets medidos) | marca falta |
| 6 | Las varas declaradas (días máximos, rotación mínima) y de quién son | `POLICY` / perfil del pack — la doctrina las nombra como referencias declaradas, igual que el benchmark en comercial | existe el dato, falta decirlo |
| 7 | Unidades en stock por SKU | métrica declarativa `stock` (count) sobre `skuInventario.stockUnd` | falta (una entrada) |
| 8 | Límites del dato, dichos | sin entradas ni órdenes de compra, sin lead time, ningún SKU en dos bodegas (`transferenciaCapability`), procedencia informado/calculado de días y rotación | existe, se declara en la doctrina |
| 9 | Cruce con Comercial por SKU — **solo cuando Comercial participa** | `inventoryStatus{top_sellers}` (venta × stock por SKU) + `tensionRead{sku}` (contribución vs capital) | existe, sin ruta ni descripción |
| 10 | Evolución | no existe: es una foto única — se declara | límite honesto |

**Tamaño medido** (chars que ve el modelo, compactado como en el bucle): inventario solo 6–13K; comercial +
inventario con el cruce 16–27K en los tres datasets, bajo el techo de 28K del cierre.

Lo que NO entra a la base y por qué: la grilla completa de SKU (75–101 figs — se pide con `gridTable` cuando la
pregunta la exige), los SKU de quiebre y sobrestock uno por uno (sus totales sí; el detalle entra cuando la pregunta
nombra el estado), y cualquier cifra por cliente (no hay relación cliente×inventario en el archivo — decisión 2).

## 2 · Cómo se declara la compatibilidad entre dominios

**Principio:** la compatibilidad la declara el PACK, no el contrato. Es el mismo movimiento que ya hizo la escala
comercial (`escalaComercial: "raw" | "K"`, owner 2026-08-30): un campo declarado que viaja con el dato, con el
fallback conservador para packs que no lo traen.

### 2.1 Las claves de unión, medidas en el archivo

| Clave | Une | Cómo se verifica | Hoy (3 datasets) |
|---|---|---|---|
| SKU | venta/contribución del período ↔ stock de la foto | mismo `sku` en `skusMargen` y `skuInventario` | 100 % de los SKU con venta tienen stock |
| marca / familia | comercial por marca ↔ capital por marca | `skuInventario` trae `marca`/`sfamilia` (atributos del SKU) | sí en los tres |
| bodega | solo inventario | `Ventas` no trae bodega (punto de venta capturado, sin analizar) | sin venta por bodega — se declara |
| cliente ↔ cobranza | venta/margen por cuenta ↔ saldo por cuenta | mismo nombre de cliente en `clientesVentas` y en la mesa del Flujo | 8/8 |
| cliente ↔ inventario | — | solo con filas atómicas cliente×SKU agregadas al pack (`hechos.Ventas` las tiene; nadie las agrega) | **no existe → no se construye** (decisión 2) |
| período | comercial = período cerrado · inventario = foto fechada · cobranza = corte | `ventasKPI` / `hechos.inventarioDe` / `flujoComercial.fechaCorte` | los tres declarados |

### 2.2 La declaración en el pack

```
compatibilidad: {
  "venta_comercial|inventario": {
    escala:       "misma" | "distinta",        // las dos en moneda cruda, o miles contra crudos
    valorizacion: "costo del período" | "informada",   // el stock se valorizó con el costo de Ventas, o lo trajo el archivo
    unidades:     "misma fuente" | "informadas",       // días y rotación salen de las unidades de Ventas, o los informó el ERP
    periodo:      "distinto",                  // siempre: período cerrado contra foto
    estado:       "comparable" | "divergent",  // el veredicto, con su razón en palabras
    razon:        "…"
  },
  "resultado_pnl|inventario": …, "precio_unitario|inventario": …, "venta_comercial|precio_unitario": …
}
```

- **La ingesta la calcula** (`motorKpi`), porque es quien sabe con qué costo valorizó el stock y de dónde salieron
  los días: en la plantilla, capital = stock × costo unitario de Ventas y días = stock ÷ unidades de Ventas →
  `escala: misma · valorizacion: costo del período · unidades: misma fuente · estado: comparable`.
- **El demo la declara a mano** en su tenant, con la verdad que hoy vive en `DIVERGENCIAS`: miles contra crudos y
  unidades que difieren 4x–35x → `divergent`. El demo no cambia de conducta.
- **Un pack sin la llave** (guardado antes de esto) cae al contrato de siempre: `divergent`. Nunca se adivina por la
  pinta del dato.

### 2.3 Los cuatro estados y lo que cada uno permite

`reconcilian(a, b)` deja de leer una constante y lee la declaración del pack activo. Devuelve:

| Estado | Cuándo | Enumerar | Relacionar («frente a», «por cada», «equivale», «fracción») | Sumar / consolidar |
|---|---|---|---|---|
| `reconciled` | mismo universo o misma escala, fuente y período | sí | sí | sí |
| `comparable` | misma escala y valorización, **período distinto** | sí | **sí, declarando los dos marcos** («del período» / «foto al 31-08») | **nunca** |
| `divergent` | escala o valorización distintas (el demo) | sí | no — con la razón declarada | nunca |
| `unsupported` | unidades de medida distintas (dinero vs conteo, dinero vs días) | sí | no hay operación declarada | nunca |

Quién lo consume, sin cambiar de forma: el muro (chequeo 17 `cruce-de-universos` solo bloquea `divergent`; la
consolidación bloquea `divergent` y `comparable`), `calcular` (solo opera `reconciled`: la relación stock÷venta ya
está medida por el motor como días de inventario — no se fabrica una segunda), el oráculo, la carpeta
(`datoProyectado`), el manifiesto de Sentrix y el mapa del dato (su línea «los universos no reconcilian» pasa a
decir lo que el pack declara).

**Una regla nueva, chica:** `marco-temporal-no-declarado` — si la respuesta RELACIONA una cifra del período con una
de la foto y en ningún lugar nombra los dos marcos, se multa. Es la forma técnica de «declararla y limitar la
interpretación». El vocabulario ya existe (`PERIODO_TXT`, `PERIODO_MIXTO_ETIQUETA`).

## 3 · La composición: la pregunta determina qué dominios participan

`contratoDeDominios.js` generaliza `contratoComercial.js`. Tres dominios, cada uno con lo que ya tiene:

| Dominio | Detector (léxico, ya existente) | Pasos | Doctrina |
|---|---|---|---|
| Comercial | `_COMERCIAL` de `contratoComercial` (sin la exclusión `_OTRO_UNIVERSO`) | los de hoy + unidades (§4) | `doctrinaComercial` |
| Inventario | la mitad de inventario de `_OTRO_UNIVERSO` + `_B_TEMA` de asesoría | §1 (el cruce por SKU solo si Comercial participa) | nueva: fecha de la foto, varas, límites, compatibilidad |
| Cobranza | `_DEUDA` / `_CREDITO` del playbook + «cobrado / por cobrar / pendiente de pago» | `cobranza{}` | la del playbook (vencido en «—» sin plazo) |

- **Composición, no exclusión:** una palabra de inventario ya no saca la base comercial; suma la de inventario. Una
  pregunta que solo nombra inventario trae solo inventario (la base comercial no viaja gratis: 15–18K chars).
- **Unidades no es un dominio:** viaja dentro de Comercial (decisión 3).
- **Por otro eje** (marca/familia/canal): la realidad comercial de esa pregunta es su lectura por eje, como hoy; lo
  nuevo es que inventario se suma por ese mismo eje (`queryMetric{capital, marca|familia}`).
- **`unirPasos`:** hoy une por herramienta (dos `salesRead` con distinto foco mezclaban referencias — el procedimiento
  gana). Se mantiene para las lecturas con foco (`salesRead`/`marginRead`/`contributionRead`) y se une por
  herramienta+argumentos para las que sirven cortes distintos (`queryMetric`, `inventoryStatus`, `tensionRead`).
- **Doctrina de cruce**, una por turno multi-dominio: qué claves unen a los dominios presentes, el estado de
  compatibilidad del pack con su razón, los dos marcos temporales, y qué relación NO existe (cliente×inventario,
  bodega×venta) — para que el cerebro no la invente y el muro no tenga que atajarla.
- **El piso determinístico:** los playbooks de un solo dominio se retiran cuando participan dos, salvo los que ya
  componen su mitad sin responder otra pregunta (`cobranza`, `plan-de-accion`). `lectura-por-eje` deja de tomar
  «inventario/stock» a secas cuando hay otro dominio (hoy responde capital frenado a «¿los SKU que más vendo son los
  que tienen más capital?»). Para el cruce por SKU se reutiliza el texto que `inventoryStatus{top_sellers}` ya
  compone («Tus 5 SKU que más venden, con su inventario disponible: …», enumeración con marcos) como piso cuando
  el cerebro calla.
- **El catálogo del cerebro:** `tensionRead`, `inventoryStatus` (con sus focos), `entityRecord` y `gridTable`
  reciben la nota de negocio que hoy no tienen (`tensionRead` se describe como «Etapa 2: entityScope generalizado»).

## 4 · Unidades en Comercial

- `METRICS.unidades` (conteo; ejes cliente/SKU/marca/familia; las fuentes ya existen: `clientesVentas.unidades`,
  `skusMargen.unidades`, `marcasMargen.unidades`, `sfamiliasMargen.unidades`) → `queryMetric{unidades, eje}` sirve
  el ranking y el total sin tocar el motor.
- La base comercial suma `queryMetric{unidades, cliente}` (unidades por cuenta + total del período) y
  `salesRead{descomposicion_vol_precio}` (efecto volumen vs efecto precio realizado) cuando hay año anterior con
  unidades. `entityProfile` ya trae unidades y ticket por cuenta nombrada.
- Doctrina: «precio realizado = venta ÷ unidades; no es ticket ni lista de precios» (nota que el composer ya
  escribe). Sello: unidades PROBADAS; el mix sigue ABIERTO.

## 5 · Apagar la afinidad estimada cliente ↔ inventario

`clientCapitalRelacion` sirve hoy el estado `afinidad_modelada` como «indicado» (medido en la completa del owner:
`entityCapitalLigado` devolvía capital «por afinidad estimada» para Mercado Norte). Pasa a declinar: sin relación
determinística cliente×SKU en el archivo, no hay capital ligado a una cuenta. La razón nombra la puerta: la clave
existe en `hechos.Ventas`; el día que la ingesta agregue cliente×SKU al pack, `crosses.atomic` se enciende y la
relación pasa a «observada» sin tocar la herramienta.

**Queda a decisión del owner:** `clientesPorSku` (qué clientes podrían comprar un SKU) sigue siendo la misma matriz
estimada, dentro de Comercial. El mismo principio diría apagarla; no está en la orden.

## 6 · La prueba de producto

Las mismas 20 preguntas × 3 datasets, offline (cerebro mudo, cero red), y la suite completa:

1. **Dominios en la boleta = los que la pregunta nombra** — hoy 2/20; objetivo 20/20 donde el dato existe.
2. **Cero secuestros:** el piso no responde otra pregunta (hoy 7/20 responden capital frenado).
3. **Tamaño:** todo turno bajo el techo de 28K.
4. **El muro con la compatibilidad del pack:** en los packs de plantilla la relación por SKU con los dos marcos
   pasa y la suma se bloquea; en el demo la relación se bloquea con la razón del demo; en ningún dataset pasa una
   relación cliente×inventario ni bodega×venta.
5. **Unidades:** toda pregunta comercial trae al menos las unidades del período; «¿vendí más unidades o solo subió
   el precio?» sale con efecto volumen y efecto precio.
6. **Una verdad por cifra:** el capital y los días que ve el agente son los de la cara Capital de Sentrix.

La corrida en vivo, si hace falta, va después y solo con autorización que nombre el gasto.

## Lo que se toca y lo que no

Se toca: `figureType.js` (`reconcilian` lee el pack; `DIVERGENCIAS` queda como fallback), `motorKpi.js` y
`tenants/demo.js` (la declaración), `metricRegistry.js` (unidades, stock, capital×marca), `contratoComercial.js`
→ `contratoDeDominios.js`, `bucleAgente.js` (la unión y las doctrinas), `guardC.js` (chequeo 17 por estado +
`marco-temporal-no-declarado`), `calculoCatalogo.js`, `mapaDelDato.js`, `toolContracts.js` (notas y focos),
`lecturaPorEje.js`, `specRetrieval.js` (inventario sano, `clientCapitalRelacion`), CLAUDE.md §4 y
`_CONTRATO_UNIVERSOS.md` (la constante deja de ser ley universal; queda como la verdad del demo).

No se toca: `boleta.js` (Falcon), `numberGuard.js`, `entityGuard.js`, `_guard_gate.mjs`, la plantilla (ninguna
columna nueva), la pestaña Capital de Sentrix (misma función, mismas cifras).
