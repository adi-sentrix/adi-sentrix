# El respaldo digno — informe

**Qué pasó.** El respaldo (el texto que arma el motor cuando el narrador libre se cae o el muro lo veta) ahora
responde la pregunta en vez de volcar la boleta. Con la pregunta textual del owner, donde antes salía una tabla de
una sola columna con doce clientes mezclados, ahora sale **venta y margen juntos, sólo los clientes al caso, con
apertura de lectura, la cola declarada y el monto en juego en el cierre**.

**Estado.** `npm run gates:offline` → **144 PASS · 0 FAIL · 0 TOCARON LA RED · 0 CON CREDENCIAL VIVA**
(la suite venía de 143: el gate nuevo entró y el conteo subió, así que no quedó excluido en silencio).
Trabajado sobre `dev`=8373074, commit local, sin push. Cero llamadas a proveedor.

---

## 1 · El defecto, y cuál era la causa de verdad

Reproducido offline con `_diag_respaldo_offline.mjs`, forzando el veto del muro. El respaldo producía:

```
| Entidad | Margen |          ← doce clientes, incluidos los que están POR ENCIMA del benchmark de 30.1%
| Lider | 21.5% | … | Hites | 33.0% |

El resto de lo autorizado en este turno: Medida · cerrar brecha al piso: $4.9M · …

Por dónde partir: Lider · Margen, que es la métrica por la que preguntaste.
```

Palabras del owner: *«¿qué es eso de en este turno?»* y *«antes aparecía la venta, era mucho más completo»*.

**La causa no era la que se ve.** La venta no faltaba en la boleta ni estaba desautorizada: los trece clientes
traían su venta (`Falabella · Venta = $19.4M`). Lo que pasaba es que el léxico determinístico resuelve el verbo
*«venden»* a la etiqueta **«Ventas»** —como se llama la columna del registro— mientras la boleta la etiqueta
**«Venta»**, como la nombra el composer. El matcheo exigía que el segmento fuera idéntico, así que la métrica más
pedida del producto no coincidía nunca y la tabla quedaba con la única columna que sí coincidía. **Un plural.**

Eso también explica por qué el defecto parecía de "autorización" y no lo era: nada estaba bloqueado.

---

## 2 · Qué compone ahora

Misma boleta, mismo veto, mismo turno:

```
Lider encabeza la lectura, con Venta $17.9M y Margen 21.5%.

| Cliente | Venta | Margen |
|---|---:|---:|
| Lider | $17.9M | 21.5% |
| Falabella | $19.4M | 22.0% |
| Sodimac | $8.2M | 23.5% |
| Jumbo | $17.3M | 24.0% |
| Ripley | $4.7M | 25.0% |

Fuera de la tabla quedan Paris, Tottus, Mercado Libre, ABC, Easy, Unimarc, Hites y La Polar: están en el dato de
la lectura, pero no es lo que la pregunta señala.

El marco del negocio: Benchmark de margen: 30.1% · clientes bajo el benchmark: 8 · Margen promedio: 25.1%.

El dato no registra la causa: para explicarla hace falta evidencia que esta lectura no trae.

Por dónde partir: Falabella, con $1.6M de Valor en juego. Sobre el conjunto, cerrar brecha al piso: $4.9M.
```

Los tres actos de la promesa, cada uno con su fuente: **01** apertura + tabla + cola declarada · **02** el límite
declarado, porque el dato trae cifras y no causas · **03** por dónde partir, con el monto.

### De dónde sale cada cosa (ninguna cifra es nueva, ninguna lista está escrita a mano)

| Pieza | Se deriva de |
|---|---|
| Columnas | Las métricas que la pregunta nombra (el mismo léxico de siempre) que la boleta trae. El encabezado sale del segmento de la propia fig, no de la etiqueta del léxico: la boleta manda. |
| Orden de las filas | El ranking que la tool ya selló. Nunca se re-ordena acá. |
| Qué filas entran | Las figs que el composer emitió traen `context`; las que agrega el enriquecimiento del ledger vienen con `context: null`. Las primeras son la respuesta de la tool, las segundas el panel de atrás. |
| La cola | Las entidades del mismo eje que quedaron fuera, nombradas una por una. |
| El nombre del eje | `tipo.dimension` de la boleta — Cliente, Bodega, SKU. Nunca «Entidad». |
| El monto del cierre | Sólo montos que el composer selló como valor de la medida. Si cuelga de una fila es de esa cuenta; si cuelga de otra cosa es del conjunto y se enmarca así. |
| Celda sin dato | Una raya. Nunca se rellena. |

---

## 3 · Las otras cinco familias

Todas medidas en el mismo probe (`node _diag_respaldo_offline.mjs` muestra ANTES y DESPUÉS de las seis).

| Familia | Resultado |
|---|---|
| **Capital por bodega** | Degrada a prosa (ver §6: la lectura de inventario no declara su eje). Ya sin vocabulario de máquina. |
| **Entidad puntual** (`¿Cómo viene Falabella?`) | Prosa, correcto: una sola cuenta no tiene eje que tabular. Cierre limpio. |
| **Eje sin segunda métrica** (`rotación por SKU`) | Tabla de una columna, encabezado **SKU** (antes «Sku»), y ahora **declara que MAK-COMP-AIR quedó fuera** — antes eran trece SKU en el dato y doce en la tabla, sin decirlo. |
| **Una cuenta dentro del eje** (`margen de Sodimac`) | Ancla en Sodimac y no en otra cuenta del eje. |
| **Boleta pobre** (2 figs) | No promete tabla: degrada a la prosa de tres actos. |
| **Boleta vacía** | El compositor se abstiene y deja hablar a la garantía anti-null (44 casos, sigue en 44 PASS · 0 FAIL). |

---

## 4 · Los gates

**Nuevo: `_respaldo_digno_gate.mjs`** — 39 comprobaciones, en la suite offline. Fija: las métricas de la pregunta
cuando están autorizadas (incluido el puente singular/plural) · el filtrado y la cola declarada · apertura y cierre
con monto · **cero vocabulario de máquina en las cinco familias** · **cero cifra nueva** (cada monto, porcentaje y
ratio del texto existe verbatim en la boleta) · degradación digna en todas.

**Dos gates viejos movidos de formato a comportamiento.** Los dos fijaban la *frase textual* que había que retirar,
no la garantía. En los dos casos dejé escrito en el archivo qué protegía y por qué la redacción cambió:

- `_cierre_cert_amplia_gate.mjs` fijaba `«Por dónde partir: Lider · Margen, que es la métrica por la que
  preguntaste.»`. Lo que protegía es que **el ancla sea la peor brecha y no la magnitud mayor** (que en margen es
  Ripley 25.0%, la cuenta menos urgente). Ahora se verifica eso, más el contrapositivo explícito.
- `_fallback_por_forma_gate.mjs` fijaba `«no aísla la causa»`; la frase nueva dice «no registra la causa» porque la
  vieja terminaba en *«…que este turno no trae»*. Sigue verificando que el acto 02 declare el límite y que ninguna
  fórmula causal se cuele.

---

## 5 · Lo que hay que saber, aunque no lo pediste

**`_fallback_por_forma_gate.mjs` no corre en la suite.** El clasificador lo excluye por nombrar la inyección del
oráculo — y es justo el gate que prueba el compositor más de cerca (48 comprobaciones). No es cosa mía: ya estaba
excluido en la línea base. Lo corrí a mano bajo el candado offline: **48 PASS · 0 FAIL**. Vale la pena que alguien
lo saque de esa lista, porque hoy una regresión ahí no pone nada en rojo.

---

## 6 · Qué no pude, y por qué

- **Capital por bodega no se tabula.** La lectura de inventario mete en una misma boleta bodegas, familias y SKU,
  todos sin declarar su eje (`dimension: null`). Agrupar por entidad ahí armaría una tabla que mezcla bodegas con
  SKU — peor que lo que hay. Arreglarlo es que el composer declare el eje de cada cifra, y eso vive en
  `specRetrieval.js`, que está tomado por otro worker. **Degrada a prosa, que es honesto pero pobre.**
- **«Días de inventario» no llega como métrica.** El léxico resuelve la palabra *inventario* a `stockUSD` («Valor
  de inventario»), así que `¿cuáles son los días de inventario por SKU?` tabula el valor de inventario en vez de los
  días. **Es anterior a este pase** (el ANTES tiene el mismo defecto) y no lo toqué: esa tabla también gobierna la
  corrección de `tensionRead`, así que cambiarla es un pase propio con su propia medición.
- **Si la boleta no declara ningún eje, el encabezado cae a «Concepto».** No inventé un nombre. «Entidad» no vuelve
  a aparecer en ningún caso.
- **No toqué el muro** (`guardC` intacto), ni `data_only`/`results_only`/`action_only`: sus contratos los fijaste
  aparte y no son de este encargo. El filtrado por entidad pedida sólo actúa en las ramas narrativas.

---

## 7 · Decisiones de producto — te las traigo, no las tomo

1. **¿Por dónde partir: el peor o el que más plata mueve?** Hoy el cierre nombra **Falabella** (donde está el
   `Valor en juego`, $1.6M) mientras la apertura nombra **Lider** (la peor brecha). Los dos salen sellados de la
   lectura y ninguno se oculta, pero es una decisión de criterio: un directorio puede querer siempre el monto, o
   siempre la peor brecha. **Elegí el monto para el cierre.** Decime si va al revés.
2. **La cola: ¿nombrada o contada?** Hoy se nombran hasta ocho ("Fuera de la tabla quedan Paris, Tottus, …"). La
   alternativa es decir cuántos quedaron sin nombrarlos. Nombrarlos es más honesto y más largo.
3. **Cinco filas, no ocho.** La tabla muestra las que la lectura priorizó, que son cinco; el marco dice que hay 8
   clientes bajo el benchmark. Si preferís ver los ocho, eso se pide del lado de la lectura (cuántas filas empuja
   `marginRead` a la boleta), no del respaldo — el respaldo no puede mostrar lo que no le llega.

---

## Archivos

| Archivo | Qué |
|---|---|
| `src/adi/oracle/narrationBlocks.js` | La composición por eje: matriz, cola declarada, apertura, cierre con monto, y la purga del vocabulario de máquina. |
| `src/adi/oracle/answerViaOracle.js` | Pasa al compositor las entidades que el turno puso en juego (13 líneas, sin lógica nueva). |
| `_respaldo_digno_gate.mjs` | **Nuevo.** 39 comprobaciones, en la suite. |
| `_diag_respaldo_offline.mjs` | El probe ANTES/DESPUÉS de las seis familias. Cero red. |
| `_cierre_cert_amplia_gate.mjs` · `_fallback_por_forma_gate.mjs` | Aserciones movidas de formato a comportamiento. |
