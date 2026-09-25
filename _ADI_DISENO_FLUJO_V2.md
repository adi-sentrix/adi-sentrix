# Diseño detallado v2 · orígenes · continuidad · perfil · conocimiento · la capacidad (Fable, 2026-09-25)

> ⚠️ HISTORIA (2026-09-25): el plan vigente es `_ADI_PLAN_PRODUCTO_V2.md`, aprobado por el owner.

> Para el supervisor y para Sonnet, por cortes. Base: `_ADI_PROPUESTA_FLUJO_PRODUCTO.md` + REVISIÓN 2, las leyes del
> owner de hoy (`adi-flujo-producto-complemento`) y lectura del código en dev. Sin ejecutar nada. Todo offline,
> detrás de `ADI_ENTREGA`; ningún reconocedor de frases en ninguna pieza.

**Cuatro hallazgos que cambian el diseño anterior (verificados en código):**
1. `pieza.alcance` **nunca se compara con el perfil**: solo se imprime («en distribución», `servir.js:55`, `recuento.js:21`). La única puerta es `perfil.completo` (`seleccionar.js:316`). Universal/localizado exige construir ese emparejamiento, no solo abrir la puerta.
2. `contexto` (011) y `diario` (007) viven **dentro de la versión de datos** (`fact_pack_versions.pack.perfil`), no en la empresa: cambian al activar otra versión. La memoria de empresa no puede colgarse ahí.
3. Los checks de 012–014 admiten solo `medido|derivado` como procedencia del perfil: el origen «declarado por el usuario» no cabe sin migración.
4. `fig()` ya lleva `source/formula/context` y `conversationScope` ya guarda `supuestos` con alcance y `origen:"usuario"`: hay dónde colgar el origen sin una segunda verdad.

---

## A · Modelo de orígenes

**Separación.** Hoy `PROCEDENCIAS` mezcla dos ejes. Se separan:

- **ORIGEN** (de dónde viene el insumo): `medido` · `documento` · `declarado` · `supuesto`.
- **NATURALEZA** (qué operación lo produjo): `directo` · `derivado` · `estimacion_referencia` · `propuesta`.

```
hecho.origen = {
  titular: "medido"|"documento"|"declarado"|"supuesto",   // el peor de la lista (orden abajo)
  lista:   ["medido","supuesto"],                          // TODOS los orígenes de los insumos, sin repetir
  fuentes: [{ origen, ref }]                               // ref = id de fig / id de hechos_empresa / id de documento
}
hecho.naturaleza = "directo"|"derivado"|"estimacion_referencia"|"propuesta"
hecho.confirmacion = null | { por, cuando, medio: "chat-anfitrion"|"pantalla", sobre: {concepto, entidad, periodo, valor, unidad} }
hecho.procedencia  = LEGADO, calculado desde los dos ejes (tabla fija) — se conserva para `_textoDeTipo`, gates y `perfilCliente`.
```

Tabla legado (una función, un archivo): `directo+medido→"medido"` · `derivado→"derivado"` · `estimacion_referencia→"estimacion_referencia"` · `propuesta→"propuesta"` · cualquier origen ≠ medido con naturaleza directo → `"supuesto_usuario"`. Así las cuatro rutas fijas (solo insumos medidos) siguen **byte a byte** iguales; el texto nuevo aparece solo cuando participa un origen no medido.

**Orden de firmeza para el titular** — decisión propuesta, no ley: `medido > documento > declarado > supuesto`. Solo esta tabla decide «peor» (hoy `_peorProcedencia`, se amplía a `peorOrigen`).

**Dónde se estampa.** En la fig: `fig(label, value, { origen: {...} })` → `deriveFigureType` lo pasa tal cual; sin declarar = `{titular:"medido", lista:["medido"]}` (el archivo). `_procedenciaDeFig` lee primero `f.fig.origen`; la razón/derivada une las listas de sus operandos (`_procedenciaDeOperando` ya recorre los insumos: se le agrega la unión). Una `lectura` hereda como hoy. Productores nuevos de origen ≠ medido: solo la acción «aportar contexto» (declarado, documento) y el motor de escenarios (supuesto). Nadie más.

**Un declarado nunca pisa un medido.** Misma llave `(concepto, entidad, eje, periodo, unidad)` con dos figs de origen distinto → las dos entran al libro; el libro emite un hecho `discrepancia` (tipo nuevo, factual): `{ id, tipo:"discrepancia", de:[idMedido, idDeclarado], diferencia: derivada }`. La Entrega imprime las dos con dueño: «Margen · Jumbo: 21,5 % (medido, datos v7) · 25 % (declarado por el usuario el 25-09, sin confirmar)». **El Core calcula siempre sobre el medido**; el declarado alimenta escenarios, contraste o lo que el usuario pida explícitamente en el encargo (`usar: "declarado"`, y la Entrega lo dice en el Marco). Un **criterio** (benchmark, piso, lente) no es un hecho: no colisiona; el del usuario manda para la conversación con su dueño nombrado (`referenciaEsDelNegocio`, ley `adi-referencia-de-quien`).

**Ley de simulación, cinco piezas distinguibles** (ya casi existen en `simulateGeneral`; se etiquetan):
```
base:      origen medido, naturaleza directo · ids de las figs reales
supuesto:  origen supuesto, directo · {concepto, delta, alcance, dueño: usuario} (las figs "Precio propuesto")
resultado: naturaleza derivado, origen.lista ["medido","supuesto"], titular "supuesto"
delta:     derivada resultado − base (misma lista)
limites:   lo que NO se movió (modelo de costo, volumen) → ausencias/límites con id
```

**Qué ve el LLM por cada cifra.** Cada fila de `cifras` y cada hecho de `respuesta` lleva `origen.titular`, `origen.lista`, `naturaleza`, `confirmacion`. La columna «Tipo» pasa a redactarse desde los dos ejes (`_textoDeTipo`): «medido» · «derivado de medidos» · «estimación contra referencia (referencia de la empresa)» · «declarado por el usuario · sin confirmar» · «extraído de documento: Contrato Jumbo 2026, cláusula 4 · confirmado por jc el 25-09» · «escenario: supuesto del usuario, sobre datos medidos». El Marco abre con un recuento: «Esta Entrega usa 14 cifras medidas, 2 declaradas (1 sin confirmar), 1 escenario». La cabecera de uso dice: *nombre el origen cuando no sea medido; nunca sume orígenes distintos*.

**Documentos.** ADI registra: `{ documento: {nombre, tipo, fecha?, huella? si el anfitrión la da}, parte: "cláusula 4 / p. 3" (texto corto, no se parsea), extraidoPor: "anfitrión", valor, unidad, concepto, entidad?, periodo?, confirmacion }`. **Garantiza**: que quedó tal cual, con fecha y dueño; que nunca se funde con lo medido; que sale con su cita cada vez. **No garantiza**: que el documento exista, que la cita sea fiel, que el valor sea el del documento, que otra cláusula no lo modifique. Eso se imprime en el límite fijo `documento_no_verificable` (ausencia nueva del catálogo).

---

## B · Continuidad factual en ADI

**Capa a · determinismo.** `versionId = fact_pack_versions.id` + `version` + `sello` (existe). Toda Entrega estampa `datos: {versionId, version, activadaEn}`. Candado: misma versión + mismo encargo + mismo criterio → mismos ids y cifras.

**Capa b · memoria de empresa.** Tabla nueva bajo RLS (no en `pack.perfil`, hallazgo 2):
```
hechos_empresa { id uuid, tenant_id, clase: "perfil"|"criterio"|"hecho"|"documento",
  concepto, eje?, entidad?, periodo?, valor jsonb {raw, unidad, texto}, origen: "declarado"|"documento",
  documento jsonb?, confirmacion jsonb?, estado: "pendiente"|"vigente"|"retirado"|"omitido",
  declarado_en, actor_label, conversacion_id?, reemplaza uuid? }
```
Funciones: `adi_aportar_hecho` · `adi_confirmar_hecho` · `adi_retirar_hecho` · `adi_leer_hechos_empresa` (mismo patrón que 006/014: `adi.tenant_actual()`, security definer). El perfil sigue en las columnas de `tenants` (012/013); ver C por la procedencia. Los hechos vigentes entran al índice de evidencia del turno como figs con `origen` (nunca reemplazan una fig medida; ver A).

**Capa c · libro de conversación.** Tabla propia (`conversaciones` de 009 guarda prosa; esta no guarda ni una frase):
```
libro_conversacion { id uuid (EMITIDO POR ADI), tenant_id, version_id_inicial, actor_label?, creado_en, actualizado_en,
  estado jsonb }
estado = {
  turno: n,
  criterioVigente: { lente: clave de CRITERIOS | null, referencias: [{concepto, valor, origen, hechoId}], desdeTurno },
  supuestosVivos:  [{ id, concepto, entidad?, eje?, delta|valor, unidad, alcance, turno }],     // ≤ 3, como SUPUESTOS_USUARIO_MAX
  entregas: [{ n, turno, versionId, temas, entidades, cierre, hechos: [{ id:"E3.h7", sujeto, metrica, valor, unidad, periodo, universoId?, origen }], universos: [...] }], // ≤ 12
  premisas: [{ id, hecho tipado, veredicto, verdadId? , turno }],
  ofertasEnPie: [{ texto, encargoSugerido }],
  hechosAportados: [ids de hechos_empresa] }
```
Ids de hecho estables en la conversación: `E<n>.h<k>`. Tope del `estado`: 16 KB; al superarlo se recortan las Entregas más viejas (queda `n`, `temas`, `versionId`), nunca las premisas ni el criterio.

**Id de conversación.** ADI lo emite en la primera Entrega (`meta.conversacionId`) y lo exige en cada acción. Si el anfitrión no lo devuelve: se abre uno nuevo, la Entrega marca `continuidad: "nueva — el anfitrión no devolvió el id"`, y se pierde solo la capa c; a y b intactas. Se mide en `uso.continuidadDevuelta`. Nada de reconstruirla desde la prosa.

**Estado vigente** (abre cada Entrega; ≤ 900 caracteres en texto, ≤ 2 KB en JSON):
```
estadoVigente: { conversacionId, turno, datos: {version, activadaEn, cambio: null|{de, a, desdeEntrega}},
  criterio: "riesgo integrado (criterio de ADI)" | "contribución (pedido por usted en E2)",
  supuestosVivos: ["Jumbo · precio +5 % (E3)"], loEntregado: ["E1 · comercial+cobranza · Jumbo · decisión · E1.h1–h9", …≤6],
  premisasPendientes: [...], hechosAportados: ["benchmark 25 % · declarado · sin confirmar"] }
```

**Retomar.** Entrada `{conversacionId}`; salida: estado vigente completo + los hechos de las últimas N Entregas **re-verificados contra la versión activa** (`igual` | `cambió: valor nuevo` | `ya no existe`). No se recompone prosa: se devuelven hechos con id.

**Premisas tipadas.** `encargo.premisas: [{ id, tipo: cifra|orden|estado|relacion|variacion|conteo, sujeto, metrica, valor?, ... }]` — el mismo esquema de `hechos.js` (`TIPOS_DE_HECHO`). ADI las pasa por `libroDeHechos` → `verdadera` | `falsa` (+ la verdad con id) | `no-verificable`. La Entrega abre con «Sobre lo que usted da por hecho: …» y la conclusión sale del análisis, no de la premisa (`premisa-adoptada`). Se guardan en `estado.premisas`.

**Cambio de versión a mitad.** En cada acción se compara `versionId` activa con la última del libro. Si difiere: `datos.cambio` en la Entrega, línea fija en el estado vigente («los datos cambiaron desde la Entrega 2: v7 → v8»), los ids anteriores quedan con su versión (`E2.h4 · v7`), una referencia a ellos devuelve «en la v8 vale X»; sobreviven criterio, supuestos vivos y hechos de empresa; las premisas se re-verifican.

**Criterio/lente vigente.** Solo cambia por `encargo.criterio` explícito (clave de `CRITERIOS` o referencia declarada); se imprime en toda Entrega con su dueño; jamás se infiere.

---

## C · Perfil conversando

**Qué le dice la capacidad al LLM.** «Conocer la empresa» devuelve:
```
perfil: { campos: { sector: {valor|null, origen, confirmacion}, tipoProducto, tamano (derivado, nunca se pregunta), pais, moneda, modeloComercial },
  faltantes: ["sector","pais"],
  preguntas: [{ campo, pregunta: texto canónico de la casa, opciones: [{codigo, rotulo}], aplicaSi: "sector ∈ distribucion|fabricacion|minorista" }] }
```
Textos y opciones salen de `taxonomiaPerfil.js` + una tabla de rótulos (`ROTULOS_PERFIL`, nueva, junto a la taxonomía). El LLM redacta la pregunta libremente; el código es lo único que vuelve.

**Cuándo es pertinente preguntar.** Nunca como ficha previa. Cada Entrega que dejó fuera algo localizado declara `necesitaPerfil: [{ campo, para: "aplicar la referencia del oficio sobre carga comercial (CAU-01)" }]` junto al límite `perfil_incompleto`. La cabecera de uso instruye: *pregunte solo lo listado en `necesitaPerfil`, en su momento, una vez*. Sin `necesitaPerfil` no hay pregunta.

**Cómo se guarda.** «Aportar contexto» con `clase:"perfil"`, `{campo, codigo}` → `codigoValido` + `validarTipoProductoDeSector` → escritura en `tenants` (la función que escribe el par código/procedencia; verificar que 012 la trae completa). Origen `declarado`, sello `{por: actor, medio: "chat-anfitrion", cuando}`. Hallazgo 3: los checks admiten solo `medido|derivado`. **Decisión para el owner:** migración 015 agrega `'declarado'` a los checks y `perfilCliente.js` lo acepta (el `medido` heredado se lee como «declarado por la empresa»); o se guarda `medido` y el origen se traduce al leer (dos verdades, no lo recomiendo).

**No volver a preguntar.** Campo con valor → sale de `preguntas`. «Ninguna de estas» es respuesta y se guarda. «Prefiero no decirlo» → `hechos_empresa {clase:"perfil", estado:"omitido"}` → no vuelve a `preguntas`; queda como oferta en «Qué más puedo calcular». Cambiar un valor exige aporte explícito con `reemplaza`.

**Qué se limita si falta.** Solo lo localizado (D) y la banda de tamaño (que depende de período + UF, no del perfil). El Core, el libro, las ausencias y lo universal funcionan igual. El límite nombra el campo exacto.

---

## D · Conocimiento universal vs localizado — solo el mecanismo

Ninguna pieza se reclasifica: las cuatro nacen `sin_revisar`.

**Declaración en la pieza.**
```
pieza.universalidad = { estado: "universal"|"localizada"|"sin_revisar", motivo, revisadoPor, fecha }   // sin_revisar ≡ localizada
pieza.lecturas = [ { alcance: {sector:[…], tipoProducto, modeloComercial:[…], pais, banda}, enunciado?, no_implica?, referencia? } ]  // opcional
```
El **núcleo** es la pieza como está (enunciado, medición, no_implica). `universal` afirma que el criterio del núcleo vale sin sector, modelo, tamaño ni país (definición del owner). Una **lectura** solo agrega o reemplaza texto y referencia para un perfil que calce; nunca cambia la medición.

**Emparejamiento (nuevo, hallazgo 1).** `alcanceCalza(alcance, perfil) → { calza, faltan: [campos], no_calza: [campos] }`: cada campo del alcance es `"*"` o una lista que debe contener el código del perfil; un campo del perfil ausente con exigencia ≠ `"*"` → `faltan`. Se aplica al `alcance` de la pieza y al de cada lectura.

**Candado (puerta 2 de `seleccionar.js`, `perfilAutorizaConocimiento` deja de ser binaria).**
```
si universalidad.estado ≠ "universal"  → exige alcanceCalza(pieza.alcance, perfil).calza; si no: fuera + límite perfil_incompleto con `faltan`
si universal                            → núcleo entra siempre; cada lectura entra solo si su alcance calza; con perfil incompleto, ninguna lectura
```
`validarPieza.js`: una lectura con todo `"*"` es inválida (sería núcleo); `universal` exige `motivo` y `revisadoPor`. Gate: pieza localizada + perfil vacío → nada, límite con el campo; universal + perfil vacío → solo núcleo; universal con lectura y perfil que calza → núcleo + lectura; las cuatro sembradas en `sin_revisar` → comportamiento idéntico a hoy.

---

## E · La capacidad única ante el LLM

Una sola presentación: *«ADI es el asesor de negocio de esta empresa: conoce sus datos, verifica cada cifra y responde cualquier consulta soportada por lo que calcula. Cuatro acciones.»* Sin nombres de herramientas internas.

```
conocerEmpresa({ conversacionId? }) → {
  empresa, datos: {version, periodo, moneda}, perfil (C), estadoVigente (B),
  catalogo: { temas: [{ id, nombre, definicion, conceptos: [{clave, rotulo, unidad, ejes}], lentes }],
              ejes: [{ eje, n, ejemplos: 3 nombres del índice }], periodos: [...],
              cierres: { cifra, lectura, decision, comparacion, simulacion: {variables, conMargen: bool}, definicion },
              supuestosAdmitidos: [...], noCalcula: [{ que, porque, paraAbrirlo }], ausencias: [...] },
  hechosAportados: [...] }

consultar(encargo) → { entrega: {texto, json}, noResuelto: [{campo, valor, motivo, alternativas}], estadoVigente, uso, meta: {conversacionId, versionId, turno} }
  encargo = Encargo v1 de la propuesta + conversacionId + premisas (B) + supuestos con origen (A) + usar?: "medido"|"declarado"

aportarContexto({ conversacionId?, aportes: [{ clase, concepto, entidad?, periodo?, valor, unidad, documento?, parte? }], confirmar?: [ids] })
  → por aporte: { id, estado: "pendiente"|"vigente"|"rechazado", entendido: {…canónico…}, conflictoCon?: hechoId medido, paraConfirmar: true }

retomar({ conversacionId }) → estadoVigente + hechos re-verificados (B)
```

**El catálogo se GENERA, no se escribe:** temas/conceptos/lentes ← `DOMINIOS_REGISTRO` (`metricas`, `lentes`, `estado`); unidad y ejes ← `METRICS` + `axisAvailable`; cardinalidad y qué cierre soporta cada eje ← `TOOL_CONTRACTS` (comparación ⇔ `compareEntities`; simulación ⇔ `simulateGeneral` con `costModelOf`); definiciones ← `motorKpi.CALCULOS.formula`; `noCalcula` ← `BLOQUEADOS`; `ausencias` ← `ausenciasDe(dominios)`; `supuestosAdmitidos` ← `ASSUMPTIONS`; lentes ← `CRITERIOS`; períodos ← el pack (`serieRealDe`). `contractMenu.js`/`capabilities.js` ya hacen una versión de esto para el narrador: se reutilizan sus lecturas, no se duplica la lista. Candado: cada entrada del catálogo apunta a un símbolo existente (cierre × tema → ruta del compositor); una entrada sin productor pone el gate rojo. «Cualquier solicitud» = cualquiera que el catálogo derive; lo demás vuelve en `noResuelto`, cada parte independiente.

---

## F · Cortes de implementación (Sonnet, por orden, todo `npm run gates:offline`)

| # | Corte | Archivos | Candado offline |
|---|---|---|---|
| 0 | Catálogo de encargos sellado por quien no implementa | `fixtures/encargos-sellados.json` | — |
| 1 | Orígenes: `origen`/`naturaleza` en el libro, `fig({origen})`, `peorOrigen`, hecho `discrepancia`, `_textoDeTipo`, ausencia `documento_no_verificable` | `notario/hechos.js`, `boleta.js`, `figureType.js`, `entrega/componer.js`, `contract/ausencias.js` | `_origenes_gate`: declarado ≠ medido → ambos; derivada une listas; simulación en 5 piezas; 4 rutas byte-iguales |
| 2 | Encargo tipado + validador + `lecturasDe` + premisas tipadas | `adi/encargo/{esquema,validar,lecturasDe}.js` | `_encargo_gate`: 60 válidos/20 defectuosos, 0 adivinanza, premisas con veredicto |
| 3 | Compositor general (`componerEntrega(encargo)`) | `entrega/componer.js` | `_entrega_general_gate` + equivalencia byte a byte |
| 4 | Continuidad en memoria detrás de interfaz: memoria de empresa, libro, estado vigente, retomar, cambio de versión | `adi/continuidad/{empresa,libro,estadoVigente}.js` | `_continuidad_gate`: mismos ids dos veces; versión cambia; id no devuelto; tope 16 KB |
| 5 | Persistencia: migración 015 (`hechos_empresa`, `libro_conversacion`, `'declarado'` en checks) — escrita, NO aplicada | `db/migraciones/015_*.sql`, `data/*.server.js` | gate de texto (como el de 013) + doble en memoria |
| 6 | Perfil conversando: `ROTULOS_PERFIL`, `preguntasDelPerfil`, `necesitaPerfil`, aporte clase perfil | `contract/taxonomiaPerfil.js`, `perfilCliente.js`, `entrega/componer.js` | `_perfil_conversando_gate`: pregunta solo con `necesitaPerfil`; omitido no vuelve |
| 7 | Universal/localizado: `universalidad`, `lecturas`, `alcanceCalza`, puerta 2 | `conocimiento/{piezas,validarPieza,seleccionar}.js`, `perfilCliente.js` | `_conocimiento_gate` extendido; 4 piezas `sin_revisar` = hoy |
| 8 | Catálogo generado + las cuatro acciones (puras) | `adi/capacidad/{catalogo,acciones}.js` | `_capacidad_gate`: cada entrada con productor; tenant ajeno rechazado |
| 9 | La Puerta HTTP sobre el pase existente; medición con modelo | `api/`, gateway | seguridad offline; gasto **nombrado** por el owner |

**Decisiones que quedan para el owner**
1. Orden de firmeza del titular: `medido > documento > declarado > supuesto`.
2. Migración 015 con `'declarado'` en los checks del perfil (o traducir al leer).
3. Memoria de empresa en tabla propia; `contexto`/`diario` (007/011) siguen en la versión o se mueven.
4. «Prefiero no decirlo»: no volver a preguntar nunca, o pasado un plazo.
5. Con conflicto medido/declarado, el Core calcula sobre medido salvo `usar:"declarado"` explícito.
6. Tope del estado vigente (900 caracteres) y del libro (16 KB, 12 Entregas).
7. Aplicar 012–014 cuando la puerta vaya a probarse (ya dicho: con su palabra).
8. Revisar el contenido de PRI-04 y CAU-01 antes de marcar `universal` (prohibido hasta entonces).

**Lo que no sé.** Si 012 trae completa la función que escribe el par código/procedencia del perfil (no la vi debajo del trigger). Qué identificador de sesión exponen ChatGPT Actions y los conectores de Claude (afecta solo cuánto se pierde la capa c). Cuánto cuesta la equivalencia byte a byte del corte 3 (no leí las ~800 líneas de las cuatro rutas).

---

## Revisión del supervisor (Opus, 2026-09-25)

- Hallazgos 1-3 VERIFICADOS en código: `alcance` solo se imprime (`servir.js:55`, `recuento.js:21`); diario (007) y
  contexto (011) viven en `pack.perfil` de la versión activa; los checks de 012 admiten solo `medido|derivado`.
- Duda de Fable resuelta: `adi_declarar_perfil_empresa` existe completa en 012 (línea 200) y 013 la redefine.
- ⚠️ CLAUDE.md §5 «no crear una memoria paralela; se extiende lo que hay»: `hechos_empresa` sería la TERCERA memoria
  de empresa (junto a diario y contexto) y `libro_conversacion` una segunda tabla de conversación (junto a 009).
  Recomendación: UNA memoria de empresa que absorbe diario y contexto (salen de la versión, con migración de datos), y
  el libro como columna `estado` de `conversaciones` (009). Decisión del owner.
- Decididas por el supervisor con las palabras del owner (no se le preguntan): «prefiero no decirlo» no se vuelve a
  preguntar en la misma conversación; en otra, solo si una Entrega lo necesita y dice para qué («sin motivo»). Topes
  (900 caracteres / 16 KB / 12 Entregas) son técnicos, ajustables tras medir. `'declarado'` en los checks (015) es
  consecuencia de la ley de los cuatro orígenes: no es decisión nueva; aplicar la migración sí lo es.

---

## REVISIÓN 3 · los cuatro criterios del owner (2026-09-25) — propuesta del supervisor

1. **Composición y fuerza, por separado.** Cada cifra lleva (a) su COMPOSICIÓN completa: cada insumo con su origen,
   su id y su rol («venta medida v7 × margen declarado E2.d1») — nunca se resume; y (b) su FUERZA de afirmación,
   calculada aparte: ADI garantiza SIEMPRE su aritmética; la fuerza la pone el insumo más débil —
   **verificada** (solo insumos medidos o documento verificado por ADI) · **condicionada** (algún insumo declarado,
   extraído o confirmado: «vale si su dato es correcto», nombra de qué dato depende) · **hipotética** (algún supuesto).
   La naturaleza (medida directa / calculada / estimada contra referencia) es un tercer rótulo, independiente.
   Reemplaza la «etiqueta titular = peor origen» de §A.
2. **Una realidad canónica de empresa.** Tres dueños, sin copias: los DATOS MEDIDOS viven en las cargas (cada carga
   rige su período; una nueva no borra la historia); LO QUE LA EMPRESA ES Y DECLARA (perfil, criterios, hechos
   declarados, documentos) vive en la empresa, sobrevive a las cargas, con vigencia y período, y se reemplaza con
   historia, nunca en silencio; las CONVERSACIONES solo guardan referencias (ids + versión) a lo anterior más lo que es
   propio de la conversación (criterio vigente, supuestos de escenario). Candado: ninguna cifra servida sale de otro
   lugar. Diario (007) y contexto (011) se integran a la memoria de empresa. Una declaración con período no se estira
   a otro; si una carga nueva cubre ese período y difiere, es discrepancia visible.
3. **Continuidad invisible.** El estado vigente viaja en la capa estructurada para el LLM (con la instrucción de no
   narrarlo), no en el texto. ADI mantiene la coherencia por sí sola (mismos números, mismos ids). Al texto narrable
   solo sale UNA línea y solo ante un evento: los datos cambiaron · una cifra ya entregada ahora vale otra cosa · una
   premisa del usuario contradice lo entregado · cambió el criterio · un supuesto de escenario sigue vivo y afecta la
   respuesta. Medición: turnos sin evento = cero texto de continuidad; con evento = una línea.
4. **Documentos: tres sellos que no se mezclan.** Extraído (por el asistente o por un modelo: «según la extracción,
   el documento X dice Y en Z») · Confirmado (testimonio del usuario sobre esa extracción: fuerza «condicionada», igual
   que un declarado, con la traza del documento) · **Verificado** (solo si ADI tiene el ORIGINAL y comprueba por código
   que el valor está en la parte citada; guarda la huella del archivo). «Evidencia documental» se reserva para el
   verificado. Un escaneo sin capa de texto no se puede verificar por código: queda extraído/confirmado. Traza siempre:
   documento, parte, quién extrajo, quién confirmó, si se verificó y contra qué huella.
   Decisión de producto abierta: que ADI reciba y guarde el original (necesario para verificar; toca privacidad).
