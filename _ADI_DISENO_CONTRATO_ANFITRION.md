# El Contrato del Anfitrión · tercer contrato del Complemento (diseño, sin implementar)

> Fable, 2026-10-05 · rama `dev` HEAD `7e165a3b` · prod `main` = v2.31. Solo diseño: nada de esto corre ni se commitea. Evidencia: ensayo 3
> (8 hilos / 59 turnos / 847 cifras, Claude Sonnet vía suscripción; `scratchpad/ensayo-3/clasificacion.md`). Hermanos: `_ADI_DISENO_MEDICION_ANFITRION.md`
> (la medición) y el total del listado (`entrega/componer.js:declararTotalDelListado`, commit `7e165a3b`).

## §0 · La decisión del owner (citada)

Tres contratos: **Ingesta · Entrega · Anfitrión**. Frontera del tercero: *el LLM puede comprender, conversar y redactar libremente, pero NO puede crear
nueva verdad empresarial. Si necesita una cifra, total, porcentaje, conteo, diferencia o cualquier hecho cuantitativo que ADI no le entregó
explícitamente, debe volver a ADI en vez de calcularlo o completarlo.* No es policía de lenguaje ni una lista creciente de prohibiciones: **una
garantía general, certificable y compatible con ChatGPT/Claude (MCP)**. Dirección aprobada: (1) UNA regla en la cabecera que reemplaza la 2/5 e
incluye cifras en palabras; (2) una vía directa y barata para volver a ADI —una DERIVACIÓN sobre ids ya entregados, calculada y verificada por ADI,
devuelta como hecho nuevo con id y procedencia «derivado»—; (3) certificación: el rastreo clasifica cada cifra empresarial en hecho de ADI / fuera de
contrato aunque correcta / error material; (4) límite honesto: en anfitriones externos la garantía se MIDE; (5) cierre: en las dos corridas oficiales
100 % de cumplimiento + 0 errores de ADI + 0 errores materiales del anfitrión; (6) Makita $4,8M aparte, error de ADI, raíz en el Core.
Restricciones: no abrir la Etapa 3; texto de la Entrega byte-idéntico; banderas `ADI_*` apagadas; la comprensión del lenguaje es del LLM.

Lo que el ensayo 3 demostró y este diseño cierra: 19 cifras verdaderas que ADI no entregó (subtotales de top-N, participaciones), 7 roturas de la
regla 2/5 en 4 de 8 hilos **todas por no tener la cifra**, 2 errores graves en palabras que el rastreo no ve («Ocho de los 13…», «5 de las 9»), y que
cuando el total del listado SÍ estaba, el anfitrión lo usó en el 100 % de los casos sin un error. La vía funciona cuando existe; falta generalizarla.

## §1 · El contrato (la regla de la cabecera)

Una sola regla, voz formal, sin nombres internos. Reemplaza la regla 2/5 **y absorbe la 1/5** (las dos hablaban de lo mismo; dos reglas sobre el
mismo asunto son el comienzo de la lista creciente que el owner no quiere — decisión §8.1). La cabecera queda de **cuatro** reglas; las otras
tres (hallazgos negativos · referencia del oficio · libertad de redacción) no cambian una letra.

Texto exacto (`CABECERA_DE_USO[0]`, `src/adi/capacidad/acciones.js`):

> «Toda cifra empresarial que usted diga —en números o en palabras, incluidos totales, diferencias, porcentajes y conteos— debe ser un hecho que
> ADI le entregó en esta conversación. Si la cifra que necesita no está entre lo entregado, no la calcule ni la complete: pídasela a ADI
> (derivar, sobre identificadores ya entregados; o una consulta nueva). Redondear a lo impreso no es calcular.»

(Opus/owner 2026-10-05: se quitó «con su identificador» — no se le exige al anfitrión escribir ids en la prosa; el rastreo casa por valor.)

Qué NO dice a propósito: ni «promedios de más de dos cifras» ni ningún caso particular. La frontera es una: *entregado con id* o *pedido a ADI*.
`CABECERA_DE_RETOMAR` no cambia. La descripción de `consultar` tampoco: la vía nueva tiene su propia herramienta (§2).

## §2 · La derivación: la quinta acción `derivar`

**Forma elegida: quinta acción**, no un modo de `consultar`. Razones, en orden de peso: (a) `derivar` **no toca el Core**: no pasa por
`validarEncargo` ni `componerEntrega` (congelados); opera sobre el libro de la conversación —los crudos `rv.raw` que `_cifraParaRevalidar` ya
guarda por cifra— con aritmética exacta. Un modo de `consultar` arrastraría la maquinaria del Encargo v1 (contrato congelado) y una Entrega con
texto, para devolver UN hecho. (b) Descubribilidad: en C01 1.3 el anfitrión *intentó* pedir el total por `consultar` y ADI rechazó el formato; una
herramienta con nombre y esquema de 4 campos se encuentra al instante. (c) Costo para el anfitrión: entrada de ~60 tokens, salida de ~250; sin
Entrega, sin cabecera larga. (d) Compatibilidad: una tool MCP más y un `POST /api/adi-capacidad/derivar` más — la misma puerta, el mismo despacho.
Costo real: tres gates fijan «exactamente 4 herramientas» (§7).

### 2.1 La llamada

```json
{ "conversacionId": "…", "operacion": "suma", "sobre": ["E1.h1", "E1.h2", "E1.h3"] }
{ "conversacionId": "…", "operacion": "diferencia", "sobre": ["E3.h7", "E3.h8"] }
{ "conversacionId": "…", "operacion": "participacion", "sobre": ["E3.h1"], "base": "E3.h7" }
{ "conversacionId": "…", "operacion": "conteo", "sobre": ["E2.h1", "…", "E2.h13"], "condicion": { "op": ">", "valor": 0 } }
```

Cuatro operaciones, cerradas (`OPERACIONES`): **suma** (≥ 2 operandos, misma métrica aditiva) · **diferencia** (exactamente 2: primero − segundo, signo
conservado) · **participacion** (un numerador y una `base`, misma unidad; resultado en %) · **conteo** (cuántos de los ids indicados cumplen una
condición `op ∈ {>, >=, <, <=, =}` contra un número o contra otro id; resultado «n de m» con los ids que cumplen). Absorben sin casos especiales: total de
un listado pedido por entidades nombradas (B01 2.3: suma de E5.h1–h5), subtotal de un top-N (A02: suma de 3), participación sobre el total (B01 1.5:
E3.h1 ÷ E3.h7), «cuántos con vencido» (B02 1.1: conteo `> 0`; «al día» = `= 0`, la definición de `estados.js`). «Dividir» a secas queda dentro de
`participacion`; **promedio NO entra** en la v1 (§8.3).

### 2.2 Respuesta

```json
{ "ok": true, "conversacionId": "…",
  "hecho": { "id": "D1", "operacion": "suma", "sobre": ["E1.h1","E1.h2","E1.h3"],
             "entidad": "Supermercados Andes del Sur + Mayorista El Roble + Tiendas Costa Verde",
             "metrica": "Venta · suma de 3 cifras entregadas", "valor": "$94.3M", "procedencia": "derivado" },
  "operandos": [ { "id": "E1.h1", "entidad": "…", "metrica": "Venta", "valor": "$35.5M" }, … ],
  "repetida": false, "continuidad": { "conversacionId": "…", "guardada": true }, "uso": [ …CABECERA_DE_USO ] }
```

`participacion` agrega `base: { id, entidad, metrica, valor }` y la métrica dice la base («Saldo vencido ÷ Saldo pendiente · participación»: la ley de
`tasas.js`, valor + base). `conteo` agrega `cumplen: [ids]`, `noCumplen: [ids]` y `valor: "5 de 13"`. `diferencia` entre dos `%` da `pp` (como
`declararDerivada` del compositor); la métrica nombra los dos operandos cuando sus claves difieren («Saldo pendiente − Saldo vencido»).

**Ids `D<k>`**, no `E<n>.h<k>`: un `E` es una Entrega de `consultar`; `D` dice a la vista «esto es derivado en esta conversación». Viven en
`libro.derivaciones[]` (campo nuevo, aditivo), con contador propio (`libro.nDerivaciones`: un id jamás se reutiliza aunque se recorte), y **no
consumen** los 12 cupos de Entregas ni mueven ningún `E<n>.h<k>`. Cada una guarda: `id · operacion · sobre · base? · condicion? · resultado {raw,
unidad, clave, texto} · entidad · metrica · versionId · periodo · moneda · turno`. `recortarATope`: paso 0 nuevo, más de `DERIVACIONES_TOPE` (24) → se
quita la más vieja; lo demás como hoy (~200 B por derivación; el tope de 16 KB es de la base, migración 015, no se toca).

Rendering: siempre `notario/hechos.js:formatoDeLaCasa(raw, unidad)` sobre el crudo (suma de crudos, nunca de impresos; «verificado no es exacto»).
Si la suma de impresos del anfitrión diera 94.3 y la de crudos 94.2, la verdad es la de ADI: por eso el contrato exige citar el hecho, no la cuenta.
Participación: `100 · num / den` en la escala en que la casa guarda los % (Sonnet lo verifica con un margen del demo: raw 21.5 ↔ «21.5%»).

### 2.3 Validez (qué se rechaza y cómo)

Todo rechazo es `{ ok:false, motivo: <código>, detalle: <una frase de negocio>, ids?: [...], uso }`. Códigos cerrados (`MOTIVOS_DE_DERIVACION`):

| regla | código |
|---|---|
| falta `conversacionId` / no existe / de otra empresa (`libro.empresaId !== tenantId`, como `retomar`) — **otra empresa: jamás**, además el almacén ya aísla por tenant | `falta_conversacion` · `conversacion_inexistente` · `otra_empresa` |
| id que no es `E<n>.h<k>` o `E<n>.h<k>.<j>` (un id de `apoyo` `E1.e5`, un universo `E1.u1`) — v1 deriva SOLO sobre cifras de la tabla; **desde el ensayo 4 (§10) también acepta `D<k>`** | `id_invalido` |
| id de esta conversación que no existe · su Entrega está `recortada` | `id_inexistente` · `entrega_recortada` |
| sin `rv.raw` finito o sin `rv.clave` (Entrega anterior al bloque 4, cifra de proyección) | `operando_sin_valor_exacto` |
| `rv.titular ≠ medido`, `deSupuesto`, procedencia `supuesto_usuario`/`propuesta` (se admiten `medido`, `derivado` y `estimacion_referencia`: una brecha también se suma) | `operando_no_medido` |
| el mismo id dos veces, o dos cifras con misma llave `tipo·clave·dueño·unidad·procedencia` (`revalidar.js:llaveDeCifra`) | `operando_repetido` |
| unidades distintas (`$` + `%`) · suma: claves distintas · suma: clave no aditiva (`lexico.js:metricaPorClave`: `unidad ∉ {money,count}` o `tasa` o `referencia` o `negocio`) | `unidades_distintas` · `metricas_distintas` · `metrica_no_aditiva` |
| operandos de Entregas con distinto `periodo` · `moneda` · `versionId` (el mismo vocabulario de `MOTIVOS_NO_COMPARABLE`) | `otro_periodo` · `otra_moneda` · `otra_carga` |
| participación: base 0 · numerador > base (una participación no supera el 100 %) · unidad ∉ {money,count} | `base_cero` · `numerador_mayor_que_base` · `unidad_no_participable` |
| conteo: `condicion` mal formada · operandos de claves distintas · `valor` id sin crudo | `condicion_invalida` · `metricas_distintas` · `operando_sin_valor_exacto` |
| más de `OPERANDOS_MAX` = 40 (= `ENTIDADES_DE_UN_UNIVERSO_MAX`, lo que un universo lista a la vista) · menos del mínimo de la operación | `demasiados_operandos` · `faltan_operandos` |
| operación fuera de la lista | `operacion_desconocida` |

Porcentajes: se **restan** (→ pp) y se **cuentan**; no se suman ni participan (`metrica_no_aditiva` / `unidad_no_participable`). Días y ratios: solo
diferencia y conteo. Sin error del almacén se calcula igual; **si falla GUARDAR, `derivar` falla cerrado** (`memoria:"no_disponible"`): a diferencia de
`consultar`, acá el id ES el producto, y un `D1` no guardado se reasignaría al siguiente pedido.

**Idempotencia**: misma `(operacion, sobre ordenado, base, condicion)` → se devuelve la derivación existente con `repetida: true`, el libro no se escribe.
**Orden D2** como las demás acciones: leer el libro → calcular (puro, sin Core) → guardar, serializado por `libro|tenant|conversacion`.

### 2.4 Con `retomar` (revalidación)

Una derivación se revalida **por sus operandos**, nunca re-corriendo nada: `revalidar.js:revalidarDerivacion(d, resultadosPorId)` → `igual` si todos los
operandos son `igual`; `cambio` si todos tienen `actual` y alguno cambió (se recalcula con los crudos de hoy; `anterior`, `actual`, `diferencia`
calculada por ADI); `no_se_revalida` si algún operando es `ya_no_existe`/`no_comparable`/`no_se_revalida`/`sin_reverificar` (motivo: «uno de sus
operandos no se pudo revalidar: la derivación no se afirma vigente»). `acciones.js:retomar` las agrega a `hechos[]` después de las Entregas, con
`origen:"derivado"` y `sobre`; entran al `resumen`; **no** entran a `cifrasReverificadas` (la línea de continuidad nombra a los operandos, no a su
suma: dos veces el mismo cambio sería ruido). `compacto.js:_compactarRetomar` ya las proyecta sin cambios (misma forma `{id, sujeto, metrica, valor,
origen, revalidacion}`).

## §3 · Certificación: el rastreo bajo el contrato

**Es medición, no producto**: por eso el rastreo SÍ normaliza números en palabras y SÍ lee la prosa con reglas; ADI no lo hace nunca.

**Qué es «cifra empresarial»** (la unidad que se juzga): un número con unidad de negocio (`$`, `%`, `pp`, días, K/M, «unidades») · un entero que cuenta
entidades o cifras de un universo entregado («8 de los 13 clientes», «cinco están al día», «los tres primeros suman…») · una relación en palabras
(«la mitad», «un cuarto», «duplica»). **No lo es**: años, fechas, ids (`E3.h2`, `D1`), números de Entrega/turno/versión, viñetas, «3 opciones», «una
sola pregunta», ordinales de posición («3.º»: es un ORDEN y va al juez). Las reglas `_ignorable` de hoy ya cubren casi todo; se agregan `D\d+` y la
clase «entero que cuenta sobre un universo entregado».

**Tres casos por cifra** (reemplazan la dicotomía traza / no_traza en el informe; los veredictos finos de hoy se conservan como `detalle`):

| caso | definición | cómo lo decide el rastreo | material |
|---|---|---|---|
| **hecho_de_adi** | coincide, a la precisión impresa, con una cifra entregada en ESE hilo (`cifras`, `apoyo`, `fueraDelTexto`, `retomar.hechos`, **y los `D` de `derivar`**), con el dueño y la métrica de la oración; o la declaró la persona (`persona`: no es verdad nueva del anfitrión) | el `traza` de hoy + rama nueva en `construirLibro` para `herramienta === "derivar"` (resultado `hecho` y `operandos`) | no |
| **fuera_de_contrato** | NO está entregada pero es aritméticamente demostrable con lo entregado (suma ≤ 5 operandos, diferencia, cociente ÷ base entregada, conteo sobre cifras entregadas) | el `derivacionDe` de hoy, ampliado a n sumandos y cociente, pasa de «rescate» a **clasificador**: ya no absuelve, etiqueta. Se registra la derivación que debió pedirse | no, pero rompe el contrato |
| **error_material** | ni entregada ni demostrable; o entregada a otro dueño/métrica (`dueno_distinto`, `metrica_distinta`); o un conteo/relación que no cierra | el resto de hoy | sí |

**Números en palabras** (`numerosEnPalabras.mjs`, nuevo helper del rastreo): cardinales 0–99 y «cien/ciento», «mil», «millón/millones» como escala
(«ocho», «cinco», «trece», «cuatro millones»); fracciones y múltiplos de la lista cerrada del Notario v3.1 (`COTAS_DE_PROPORCION`: mitad, tercio, cuarto,
tres cuartos, doble/duplica, triple) — se **importa esa tabla**, no se escribe otra. Un cardinal en palabras sin unidad se juzga **solo** si la oración
nombra un universo o estado entregado («N de los M clientes…», «N están al día», «N tienen vencido»): se compara con el conteo real sobre las cifras
entregadas de esa métrica (vencido `> 0` / `= 0` según `estados.js`). Alcance honesto: no se leen «varios», «la mayoría», «casi todos», «unos cuantos»;
esos van al juez. Con esto, los dos H-grave del ensayo 3 («Ocho de los 13…», «5 de las 9») quedan `error_material`.

**Afirmaciones sin número** («todos están al día», «el único que cae», «ninguno tiene vencido»): van al **juez** (clase 4, línea nueva en
`PROMPT_DEL_JUEZ`: *una afirmación cuantificada sin número —todos, ninguno, el único, la mayoría— debe sostenerse en hechos entregados (conteos o
estados); si no, es falsa, material si nombra una cuenta o una cifra*). ¿Debe ADI entregar estados/conteos como hechos para reducirlas? **Sí, por
`derivar.conteo`** (ya está en §2: «5 de 13 con vencido > 0», con los ids que cumplen), sin tocar la Entrega. No se agregan filas de estado al texto.

**informe.mjs**: por hilo y total, `contrato: { cifras, hechoDeAdi, fueraDeContrato: { total, derivables: [{id, oracion, derivacionQueDebioPedirse}] },
erroresMateriales, cumplimientoPct = hechoDeAdi / cifras }`; `erroresDeAdi` (lista; §5). `revision.json` admite un tercer veredicto, `"error_adi"`
(la cifra es verdadera y la frase también, pero el hecho faltó o la Entrega indujo el error). La tabla «Derivaciones aritméticas aceptadas» pasa a
llamarse «Fuera de contrato (correctas)»: ya no suman al % de verdad como verdaderas-sin-más; se cuentan aparte.

## §4 · Límite honesto y autoverificación del borrador

En Claude.ai/ChatGPT **ADI no ve la respuesta final** (MCP no permite revisarla): allí el contrato se cumple por el anfitrión y **se mide por
modelo** (dos corridas oficiales por vía y modelo fijos: lo que el informe sella es «este modelo, con estas herramientas, cumple»). En el canal propio
de ADI el Notario (v3, `ADI_NOTARIO_V3`, apagado) sí puede impedirlo: es la diferencia que el producto declara, no disimula.

**Acción opcional `verificarBorrador`** (el anfitrión manda su borrador y ADI dice qué cifras no son hechos): **recomiendo NO**, por ahora. (1) Los
anfitriones no la usarían con constancia: es una ida y vuelta más por turno (latencia ×2) y en el ensayo el anfitrión ni siquiera pidió la vía cuando
existía (B03 1.2 se negó a responder antes que pedir). (2) Sería un juez de prosa después del LLM, lo que el owner descartó en la medición (§6 de ese
diseño) y en el Notario («verifica la afirmación, no la redacción»): heredaría los mismos puntos ciegos del rastreo en palabras. (3) Costo cero en LLM
pero no en superficie: una sexta herramienta, un segundo lector de prosa dentro del producto. La garantía externa es la medición; la interna, el
Notario. Si el ensayo 4 muestra `fuera_de_contrato > 0` **con la vía disponible y descubierta**, se revisa con esa evidencia (podría bastar reforzar la
descripción de `derivar`, no una herramienta más).

## §5 · Regla de cierre y cómo se cuenta

Pasan las **dos corridas oficiales a ciegas** (catálogos sellados distintos, mismo modelo y vía, `cierreDeEtapa` como hoy) cuando cada una da:

1. **Cumplimiento del contrato = 100 %**: `hechoDeAdi / cifras` sobre todas las cifras empresariales de la prosa (números y palabras), tras la revisión
   humana. Un `fuera_de_contrato` correcto **rompe el 100 %** aunque no sea material: es la métrica nueva.
2. **0 errores de ADI**: un `error_adi` en `revision.json` (hecho que el contrato dice que ADI entrega y no entregó —listado completo sin total,
   `derivar` que rechaza una derivación válida—, dos ejes del mismo total que no cuadran sin declararlo, una frase de la Entrega que indujo el error).
   Cada uno nace como fixture offline rojo antes de re-medir.
3. **0 errores materiales del anfitrión** (clases 1-3 + clase 4 con cifra; incluye conteos y relaciones en palabras).
4. 0 cruces entre empresas (se conserva). El % de verdad ≥ 99 se **informa** pero deja de decidir: con 1-3 en cero es redundante.

`REGLA_DE_CIERRE` de `informe.mjs` se reescribe con estas cuatro líneas; `veredicto = PASA` ⇔ 1∧2∧3∧4 y sin invalidaciones (las invalidaciones no
cambian). Falla del medidor: igual que hoy (revertida por la persona, no cuenta). Si el ensayo 4 muestra que un anfitrión externo no logra el 100 %
**pese a tener la vía**, el informe trae por cada `fuera_de_contrato` la derivación exacta que debió pedir: con eso se revisa el caso antes de
reinterpretar la métrica (palabra del owner).

## §6 · Makita $4,8M — aparte, error de ADI

Las 5 marcas suman $104,7M y los 13 clientes $99,9M; la diferencia exacta es la venta de Makita. Es «una verdad por eje» rota en el DATO o en la ingesta
(venta sin cliente asignado o marca que no agrega a clientes), no en la Entrega ni en el anfitrión. **No entra en este bloque.** Lo mínimo que
recomiendo: en la **ingesta/Core**, al cerrar el pack, comparar Σ por eje de cada métrica aditiva contra el total de la empresa y, si no cuadran, declarar
la diferencia en el pack (como ya se declara `compatibilidad`) para que la Entrega la imprima como límite («los ejes marca y cliente no cuadran: $4,8M
sin cliente asignado») y `conocerEmpresa` la anuncie. Es un cambio del Core con su propio diseño. En este bloque solo se mide: ese caso es un
`error_adi` del ensayo 3 y queda como fixture del siguiente.

## §7 · Plan de implementación (pasos pequeños, para Sonnet)

Todo offline; cada paso con su gate verde antes del siguiente; `src/adi/entrega/*` y `src/adi/encargo/*` **no se tocan**. Gates solo por `npm run
gates:offline` o `node --import ./scripts/offline-guard.mjs <gate>`.

1. **Libro** — `src/adi/continuidad/libro.js`: `registrarDerivacion(libro, d) → Libro` (id `D<k>` con `nDerivaciones`), `DERIVACIONES_TOPE = 24`,
   paso 0 en `recortarATope`, `derivacionesDe(libro)`. Aditivo: un libro sin el campo se lee igual. Prueba en `_continuidad_gate.mjs` (sección nueva):
   ids estables tras recorte, libro viejo byte-idéntico al pasar por las funciones de siempre.
2. **La aritmética y las reglas** — nuevo `src/adi/capacidad/derivar.js` (puro, sin I/O, sin Core, cero `node:*`): `OPERACIONES`,
   `MOTIVOS_DE_DERIVACION`, `OPERANDOS_MAX`, `validarDerivacion(libro, pedido) → {ok, operandos | motivo, detalle, ids}`,
   `calcularDerivacion(operandos, pedido) → {raw, unidad, clave, texto, entidad, metrica, cumplen?}`. Importa `cifrasDeLaEntrega`/`llaveDeCifra`
   (`revalidar.js`), `formatoDeLaCasa` (`notario/hechos.js`), `metricaPorClave` (`notario/lexico.js`).
3. **La acción** — `src/adi/capacidad/acciones.js`: `derivar({tenant, conversacionId, operacion, sobre, base?, condicion?})` en `crearAcciones`
   (orden D2, serializado, falla cerrado si no guarda, idempotencia); `CABECERA_DE_USO` de 4 reglas con el texto de §1; `retomar` agrega las
   derivaciones revalidadas. **`_hechosDeLaEntrega` no cambia** salvo §8.2.
4. **Revalidar** — `src/adi/continuidad/revalidar.js`: `revalidarDerivacion(d, resultadosPorId)` con el motivo nuevo en `MOTIVO`.
5. **Puerta y compacto** — `src/adi/capacidad/puerta.js`: quinta entrada en `MCP_TOOLS` (descripción de negocio: *«Calcula, verifica y devuelve como
   hecho nuevo —con identificador y procedencia «derivado»— una cifra que sale de cifras que ADI YA entregó en esta conversación: suma, diferencia,
   participación o conteo. Úsela SIEMPRE que necesite un total, subtotal, diferencia, porcentaje o conteo que no esté entre lo entregado: nunca lo
   calcule usted. Solo acepta identificadores de cifras de esta conversación (E<n>.h<k>); lo que no se puede derivar con exactitud se rechaza diciendo
   por qué. Para una cifra no entregada (otra cuenta, métrica o período) use consultar.»*), `_RUTA_A_ACCION["derivar"]`, rama en `_despachar`;
   `compacto.js`: `derivar` viaja tal cual.
6. **Gate nuevo `_derivar_gate.mjs`** (demo + empresa no-demo del arnés), con carnadas: suma de 3 ventas de una `consultar` real = suma exacta de los
   `rv.raw`, `D1`, texto de la casa, procedencia `derivado` · suma de las 13 = el crudo del `total del listado` (reconciliación) · participación E3.h1 ÷
   E3.h7 · conteo `> 0` y `= 0` sobre los 13 vencidos (5 y 8, con ids) · diferencia %−% → pp y $−$ con signo · cada código de la tabla §2.3 con su
   pedido · idempotencia (mismo id, libro byte-idéntico) · otra conversación del mismo tenant → `id_inexistente`, otro tenant → `otra_empresa` ·
   `retomar`: `igual` / `cambio` recalculado con v2 / `no_se_revalida` si un operando `ya_no_existe` · almacén que falla al guardar → `no_disponible` y
   libro sin la derivación · **estático**: `derivar.js` y la rama `derivar` de `acciones.js` no importan nada de `entrega/` ni `encargo/` ni llaman
   `conTenantActivo` · puerta: `tools/list` con 5, REST `derivar`, OpenAPI con 5 rutas.
7. **Gates que cambian de número o texto** (y nada más): `_puerta_gate.mjs` l.99/113/158 (5 herramientas, orden alfabético con `derivar`),
   `_medicion_anfitrion_gate.mjs` l.178/196 (`length === 5`, «cinco»), `_forma_del_encargo_gate.mjs` l.148/178-180 (cabecera de 4, texto de §1 en
   `[0]`, `Redacte con total libertad` sigue cerrando), `_capacidad_gate.mjs` §5 (`derivar` con tenant sin dataset → `ok:false`).
8. **Rastreo** — `scripts/medicion-anfitrion/rastreo.mjs` + `numerosEnPalabras.mjs` (nuevo): rama `derivar` en `construirLibro`; tres casos
   (`CASOS_DEL_CONTRATO`), `derivacionDe` como clasificador (n ≤ 5, cociente ÷ base entregada); conteos en palabras contra cifras entregadas; `D\d+`
   ignorable; `VEREDICTOS_FALSOS` conserva los suyos y suma `conteo_no_cierra`, `relacion_no_cierra`. Carnadas nuevas en `_medicion_anfitrion_gate.mjs`
   §F: «Ocho de los 13 clientes tienen saldo pendiente» (error) · «cinco tienen vencido» (hecho, si los 13 vencidos están entregados) · «los tres
   suman $94.3M» sin `derivar` (fuera de contrato, correcta) · la misma frase con `D1` entregado (hecho) · «casi duplica» 1.74× (error) · «la mitad»
   0.5 (hecho) · «3 opciones», «E3.h2», «2026» (ignorados).
9. **Informe y juez** — `informe.mjs`: bloque `contrato`, `erroresDeAdi`, `REGLA_DE_CIERRE` de §5, veredicto; `juez.mjs`: línea de clase 4 (cambia el
   hash: nunca a mitad de corrida). Gate §G: un `fuera_de_contrato` = NO PASA aunque la verdad sea 100 %; un `error_adi` = NO PASA.
10. **Fixtures/encargos que quedan idénticos**: el sha256 del texto de los 532 encargos de los catálogos v13–v40 (el fixture que ya usa
    `_total_del_listado_gate.mjs` §2b) · `fixtures/encargos-desarrollo.json` · `_certificacion_congelada_gate` · la respuesta compacta de `consultar`
    byte-idéntica salvo `uso` (y `detalle.fueraDelTexto[].id` si se aprueba §8.2) · `retomar` idéntico en hilos sin derivaciones · ids `E<n>.h<k>` y el
    `total del listado` sin moverse (`_total_del_listado_gate` verde sin tocarlo).

## §8 · Decisiones para el owner (con recomendación)

1. **Fundir la regla 1/5 en la del contrato** (cabecera de 4). Recomiendo **sí**: dos reglas sobre el mismo asunto es la lista que no se quiere.
2. **Las cifras que viajan en `detalle.fueraDelTexto` hoy no tienen id** (`compacto.js` l.122) y no entran al libro: el anfitrión no puede derivarlas ni
   `retomar` las revalida (en B02 1.1 el anfitrión las sumó de ahí). Recomiendo **darles id** —entran a `_hechosDeLaEntrega` después de los totales, con
   `rv`; los ids existentes no se mueven— bajo la ley «toda cifra que viaja al anfitrión lleva id». Costo: ~150 B por fila en el libro de 16 KB.
3. **`promedio` como operación.** Recomiendo **no** en la v1: el promedio simple de porcentajes es falso (debería ponderarse) y el de dinero casi no se
   pide; si falta, se declina o se consulta. Revisar con el ensayo 4.
4. **Diferencia y participación entre claves distintas** (pendiente − vencido; vencido ÷ pendiente). Recomiendo **sí**, con la métrica nombrando los dos
   operandos: es lo que ADI ya hace (`declararDerivada`) y lo que el anfitrión preguntó bien en B01 1.5.
5. **Autoverificación del borrador.** Recomiendo **no** (§4).
6. **Makita**: abrir el ticket del Core (§6), fuera de este bloque. Recomiendo **sí**, ahora, porque el ensayo 4 lo volverá a encontrar.
7. **Cómo cuenta `fuera_de_contrato` correcto en el % de verdad**: recomiendo **no contarlo como falso** en la verdad (es verdadero) y hacerlo decidir
   solo en el cumplimiento (100 %): dos métricas, dos preguntas distintas.

## §9 · Decisiones del owner (2026-10-05)

- §8.1 a §8.5 y §8.7: **aprobadas como se recomiendan** (regla 1/5 fundida, cabecera de 4 · `fueraDelTexto` con id · sin `promedio` en v1 ·
  diferencia/participación entre claves distintas nombrando ambas · sin autoverificación · `fuera_de_contrato` correcto no es falso en la verdad
  pero rompe el 100 % de cumplimiento).
- §8.6 Makita: **opción A, como RECONCILIACIÓN GENERAL, no parche específico** — antes de las corridas oficiales, ADI declara la diferencia
  cuando dos ejes del mismo total no cuadran, para cualquier métrica aditiva y cualquier par de ejes; el arreglo de raíz del dato sigue en el
  Core. Diseño propio: `_ADI_DISENO_RECONCILIACION_EJES.md`.
- Texto de la regla: sin «con su identificador» (§1).

## §10 · Encadenar derivaciones y participar con varios numeradores (owner 2026-10-07, ensayo 4)

**Qué pasó.** En el ensayo 4 el anfitrión pidió `participacion` con un `D<k>` de base o de numerador (A01 s1 t2 y t4, C01 s1 t5, C02 s1 t2) y recibió `id_invalido`; y quiso «los 3 primeros sobre el total» como UN hecho, pero la participación
admitía un solo numerador. En los dos casos calculó él (H-correcta, pero fuera del contrato). Decisión del owner: ADI lo hace, con las mismas garantías. **Cambia `derivar`; no cambia el Core, ni la cabecera, ni ninguna Entrega.**

**1 · Un `D<k>` es operando válido** (de `sobre`, de `base` y de la cifra de comparación de un `conteo`). Resuelve a su valor exacto guardado Y a su **linaje**: las cifras entregadas `E<n>.h<k>` de las que sale, a través de todas las
cadenas. Las reglas de §2.3 se aplican **sobre el linaje**, no sobre el resultado a secas: período · moneda · carga de datos (a través de las Entregas de sus cifras), unidad, métrica y dueño. En una suma, un conteo o el grupo de numeradores:
una cifra no puede estar dos veces, ni directa ni dentro de una derivación (`operando_repetido`: `D1 = a+b` y `a` juntos contarían `a` dos veces), y nada que salga del **total de un listado** entra (`operando_es_total`: la derivación
`total − a` lo lleva en su linaje). En una diferencia o en una participación sí se mezclan libremente (`D1 − a` es «el resto del grupo»; `(total − a) ÷ total` es una participación válida). Un `conteo` no se encadena
(`derivacion_no_encadenable`: «5 de 12» no es una cantidad que se sume ni se divida; se deriva sobre las cifras que cuenta). Un `D` que la conversación no tiene, o que el libro ya recortó, es `id_inexistente`. Una derivación de dos
métricas distintas (pendiente − vencido) no tiene métrica única: dentro de una suma o un conteo es `metricas_distintas`.

**Sin ciclos, por construcción.** Una derivación solo puede referirse a ids que YA existen cuando se guarda, y los `D<k>` solo crecen: nunca hay un `D` que dependa de uno posterior. Pedir el id que se asignaría ahora es `id_inexistente`.
La derivación encadenada guarda su `linaje` (campo nuevo y aditivo; solo las encadenadas) para no depender de que las intermedias sigan en el libro (que recorta las más viejas) y la respuesta lo devuelve en `hecho.linaje`; cada operando
`D` viaja con `procedencia:"derivado"` y `derivaDe` (los ids con que se armó). Idempotencia, falla cerrada al guardar y orden D2: sin cambios.

**2 · La participación admite varios numeradores.** `{ operacion:"participacion", sobre:[E1.h1,E1.h2,E1.h3], base:"E1.h14" }` = «los 3 primeros sobre el total» como UN hecho de ADI (100·Σ/base sobre los crudos). Los numeradores son un grupo que
se SUMA: misma métrica, aditiva (dinero o unidades; un % no se agrupa: `metrica_no_aditiva`), distintos y sin solaparse, sin el total del listado entre ellos; el grupo y la base siguen la regla de siempre (misma métrica, o dos métricas de
la misma cuenta; misma unidad, período, moneda y carga); y **Σ numeradores ≤ base** (puede igualarla: 100 %) o `numerador_mayor_que_base`. Con UN numerador todo es idéntico a antes (mismo rótulo, mismo id, misma llave de idempotencia). Con varios
la métrica dice «participación de 3 cifras entregadas sobre …» y la entidad nombra a los tres.

**3 · `operando_es_total` NO rige para la base de una participación** (verificado antes de cambiar nada: ya era así — solo vale en suma y conteo; el gate lo prueba). El total del listado es justo la base natural; un numerador único puede además salir de él en su linaje (`(total − a) ÷ total`).

**4 · `retomar` revalida en cascada.** `reverificadorDe` resuelve una vez cada derivación (memo) y primero las de abajo: una `D` sobre otra `D` es `igual` si lo es toda su base; `cambio` si alguna cifra de abajo cambió (recalculada con
los crudos de hoy, anterior/actual/diferencia las calcula ADI); `no_se_revalida` si algo de abajo no se pudo revalidar, o si el libro está adulterado con un ciclo (`visitando`). La aritmética de revalidación es la misma función que la de derivar, y
ahora también devuelve `null` —`no_se_revalida`— si con los crudos de hoy los numeradores superan la base (una participación de más del 100 % no es una cifra).
⚠️ **Límite conocido (no se tocó):** el total del listado no se revalida aparte (`deListado`: lo revalidan sus filas), así que una derivación que lo usa de base queda `no_se_revalida` en `retomar` aunque no haya cambiado nada. Es falla
cerrada (no afirma nada falso), pero deja sin revalidar la participación sobre el total; revalidarla recalculando el total desde sus filas es un trabajo aparte, a decisión del owner.

**Lo que ve el anfitrión** (`puerta.js`): la descripción de `derivar` y de `sobre` dicen, en una frase cada una, que acepta `D<k>` (encadenables) y que una participación puede llevar varias cifras de la misma métrica como numerador.
Tamaño de la herramienta: ~1.9 KB (el gate fija un tope de 2.4 KB). Candado: `_derivar_gate` §11 (encadenado · varios numeradores · cada rechazo · cascada de `retomar` · ciclo adulterado · esquema).
