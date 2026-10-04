# Etapa 2 · bloque 4 — Retomar una conversación REVALIDANDO sus cifras

Arquitecto (Fable), 2026-10-04 · rama `dev`, HEAD `6ed94230` · diseño, sin implementar. Implementa Sonnet con el §6.

## 0 · En una frase

Días después, con datos recargados, la persona retoma el hilo y el anfitrión le dice —en una sola línea y solo si pasó algo— qué cifras de lo que ADI ya le entregó siguen valiendo, cuáles cambiaron (con las dos cifras y sus cargas) y cuáles ya no están; lo dicho antes queda tal cual, nunca reescrito.

## 1 · Qué falta hoy (verificado en código)

La re-verificación está diseñada pero vacía: la acción `retomar` existe, recibe un verificador inyectado y hoy se le pasa `null`.

- `src/adi/capacidad/acciones.js:647` — `reverificarConversacion(libro, { versionIdActual, reverificar: null })`; y `:656-658` declara el límite («este corte no re-verifica…»). `src/adi/continuidad/retomar.js:30-31` → sin verificador, todo hecho sale `sin_reverificar` (falla cerrado, correcto).
- El libro no guarda el valor crudo: `acciones.js:191-202` (`_hechosDeLaEntrega`) toma la tabla de Cifras y guarda `valor` = el TEXTO impreso (`"$12,3M"`), `unidad: null`, `periodo: null`. `libro.js:117` tampoco lo contempla. Sin crudo no hay comparación honesta (la casa ya lo sabe: `notario/hechos.js:104-109`, «sin crudo, nunca medido»).
- El libro no guarda el Encargo de cada Entrega (solo `temas`, `entidades`, `cierre`): no hay con qué volver a preguntarle hoy al Core lo mismo que se preguntó entonces.
- El libro no guarda la referencia con que se calculó una brecha (benchmark/criterios declarados aplicados, `acciones.js:350` los tiene como `criteriosAplicados` y no los conserva): una brecha de ayer y una de hoy pueden no ser comparables sin que nadie lo sepa.
- El libro no guarda de qué empresa es (`libro.js:52-67`): el aislamiento hoy lo da solo la llave del almacén (`almacen.js:36-40`).
- El bloque 3 ya avisa, al citar `contexto: E1`, que «esas cifras no se volvieron a verificar» (`loDeclarado.js:337`): es exactamente el hueco que este bloque cierra.

Lo que SÍ existe y se reutiliza sin tocar: el verificador inyectable (`retomar.js`), los eventos `datos_cambiaron`/`cifra_cambio` y la línea única (`estadoVigente.js:79-112`), la llave de comparación medido-contra-medido (`loDeclarado.js:212-226`, `_medidoDe`: clave de métrica · sujeto · unidad, sobre `procedencia.libro.hechos`), la comparabilidad por unidad/moneda/escala (`loDeclarado.js:59-70`) y el formato de la casa (`notario/hechos.js:311`).

## 2 · El mecanismo (mínimo y suficiente)

**Idea central:** revalidar = volver a hacerle al Core HOY la misma pregunta tipada que se le hizo entonces, y comparar hecho por hecho, por llave y con crudos. Ni un camino nuevo de evidencia ni una segunda verdad: la cifra «actual» es la que `consultar` daría hoy (una sola verdad por eje). `entrega/componer.js` no se toca.

### 2.1 Qué guarda el libro (todo ADITIVO; lo guardado antes sigue leyéndose)

Por **hecho** (`_hechosDeLaEntrega`, leyendo `salida.entrega.procedencia.libro.porId.get(ref)`): `raw` (número o null), `unidad`, `clave` (la clave canónica de la métrica, `H.claves`), `titular` (`H.origen.titular`: medido · declarado · documento · supuesto) y `procedencia` (medido · derivado · estimacion_referencia · supuesto_usuario · propuesta). ⚠️ El campo `origen` de hoy guarda la PROCEDENCIA (`acciones.js:199`): no se renombra —hay libros guardados y gates que lo leen—; se agregan los dos campos nuevos al lado.

Por **Entrega** (`registrarEntrega`): `encargo` (el Encargo v1 recibido, sin `conversacionId`), `referencias` (los `criteriosAplicados`: llave → valor, origen; más `marco.referenciaDeclarada` si existe), `moneda` (`marco.moneda`), y `revalidable: true`. `periodo`, `versionId` y `entregadaEn` ya se guardan.

Por **libro**: `empresaId` (el `tenant.id` que lo creó).

Tamaño: ~60 bytes más por hecho y ~300 por Entrega. El tope de 16 KB (`LIBRO_TOPE_BYTES`, «ajustable tras medir») ya esqueletiza Entregas viejas hoy; medir en el gate y, si hace falta, subir a 32 KB (decisión técnica del supervisor, no de producto). Una Entrega esqueleto no se revalida (ya no tiene hechos): se declara.

### 2.2 Cómo se compara

En `retomar({tenant, conversacionId})`:
1. Leer el libro (base) y la memoria de empresa (lo declarado vigente, como hace `consultar` en `acciones.js:339-351`). Si `libro.empresaId` existe y no es `tenant.id` → `{ok:false, motivo:"esta conversación es de otra empresa"}`.
2. Un solo tramo del Core (`conTenantActivo`, síncrono): por cada Entrega no recortada y `revalidable`, `componerEntrega(validarEncargo(entrega.encargo, { libro }))` con el dataset ACTIVO de hoy. Es cómputo determinístico, cero LLM, cero red.
3. Comparar (módulo puro nuevo `src/adi/continuidad/revalidar.js`): para cada hecho guardado se busca en el libro de hechos de la re-corrida el hecho con la MISMA llave (clave · sujeto normalizado · unidad), cita directa de un solo insumo —la misma regla de `_medidoDe`—. «Igual» = el formato de la casa imprime lo mismo (`formatoDeLaCasa(raw, unidad)`), la regla que ya usa `contrastarHechos` (`loDeclarado.js:249`). Si difiere, ADI calcula la diferencia (crudo, texto, sentido). Nunca el LLM.
4. El resultado entra a `retomar.js` por el verificador inyectado que ya existe (`reverificar(h, ctx)`; el `n` de `E<n>.h<k>` dice a qué re-corrida mirar). `retomar` sigue siendo de SOLO LECTURA: no registra la re-corrida como Entrega ni escribe el libro.

### 2.3 Estados (tipados, cerrados)

| estado | cuándo | qué viaja |
|---|---|---|
| `igual` | misma llave, mismo valor impreso | `anterior` |
| `cambio` | misma llave, otro valor | `anterior`, `actual`, `diferencia`, `cargaAnterior`, `cargaActual` |
| `ya_no_existe` | la parte RESOLVIÓ hoy y la llave no aparece (la entidad o la métrica salió de los datos) | `anterior` |
| `no_comparable` | `motivo`: `otro_periodo` (el Marco de hoy cubre otro período: TODA la Entrega) · `otra_moneda` · `otra_unidad` · `otra_referencia` (procedencia `estimacion_referencia` y las `referencias` cambiaron) · `otro_universo` (el universo declarado de la Entrega cambió de entidades) | `anterior`, `actual` si lo hay, SIN diferencia |
| `no_se_revalida` | `titular` ≠ medido (un supuesto, un declarado, un documento) o procedencia `supuesto_usuario`/`propuesta`: lo que no se midió no se revalida contra los datos | `anterior`, `motivo` |
| `sin_reverificar` | no hay crudo o no hay encargo (libro anterior a este bloque), la Entrega está recortada, o la parte no resolvió hoy (`noResuelto`) | `motivo` en palabras de negocio |

Reglas duras: `sin_reverificar` y `no_se_revalida` jamás traen `actual`; `igual` jamás se declara sin haber comparado crudos; `ya_no_existe` jamás se declara si la parte no resolvió (eso es `sin_reverificar`). Un `derivado` del motor (una suma, una razón) SÍ se revalida: lo calculó ADI entonces y lo calcula ADI hoy.

### 2.4 Cómo viaja el aviso al anfitrión

- **Tipado, siempre:** `retomar` devuelve `hechos[]` con `revalidacion: {estado, motivo?, anterior, actual?, diferencia?}`, un `resumen` con el conteo por estado, `entregas[]` tal cual, `estadoVigente`, `eventos` y una cabecera `uso` (como `CABECERA_DE_USO`): «lo entregado antes se cita tal como se dijo, nunca se reescribe» · «si una cifra cambió, se dicen las dos con su carga» · «lo marcado sin revalidar no se afirma como vigente» · «no se recalcula sobre el texto».
- **Una línea, solo ante evento, en tercera persona, redactada por la casa:** `datos_cambiaron` (ya existe) + `cifra_cambio` para `cambio` y `ya_no_existe` (ya existe; se le agrega «antes X, carga v3»). `igual`, `no_comparable` y `no_se_revalida` NO generan texto: el cambio de período ya lo dice `datos_cambiaron`, y lo demás es información tipada para el anfitrión. Si cambian más de 3 cifras, la línea dice el conteo («7 de las 12 cifras entregadas ya no valen lo mismo») y el detalle va tipado (decisión 2).

### 2.5 Qué NO se hace

No se reescribe ninguna Entrega guardada (comparación profunda antes/después en el gate). No se recalcula nada con declarados: lo declarado vigente entra a la re-corrida igual que entra a cualquier `consultar` (umbrales de la empresa), pero un declarado nunca se compara contra un medido ni lo sustituye. No se adivina: sin crudo, sin encargo o sin resolución, `sin_reverificar` con motivo. No hay policía de lenguaje: nada lee la prosa del anfitrión. La Entrega y el Encargo de la etapa 1 quedan congelados: sin retomar, `consultar` sale byte-idéntico (los campos nuevos viven solo en el libro).

## 3 · Casos borde

- **Carga nueva de datos, mismo período:** `datos_cambiaron` + revalidación completa; lo típico es mezcla de `igual`/`cambio`.
- **Carga nueva con OTRO período (el caso real de «meses después»):** toda la Entrega `no_comparable: otro_periodo`, con el valor actual rotulado con su período, sin diferencia; la línea es solo `datos_cambiaron`. Nunca «cambió» entre períodos distintos.
- **Empresa distinta:** el almacén ya aísla por empresa; además `empresaId` en el libro y rechazo explícito. Carnada en el gate.
- **Simulación / supuestos:** los supuestos del usuario y lo derivado de ellos → `no_se_revalida` («un supuesto es de quien lo planteó; no se revalida contra los datos»). Un supuesto vivo sigue en `estadoVigente` como hasta hoy.
- **Lo declarado que cambió** (benchmark o criterio nuevo confirmado): medidos `igual`; brechas `no_comparable: otra_referencia` con la referencia de entonces y la de hoy. No es un `cambio` de la realidad, es un cambio de la vara.
- **Hechos sin crudo** (procedencia derivada desde texto, `crudo:false`): `sin_reverificar`, motivo «se entregó sin valor exacto».
- **Conversaciones guardadas ANTES de este bloque:** sin `revalidable` → todos `sin_reverificar` con motivo «esta Entrega se guardó antes de que ADI conservara el valor exacto y la pregunta»; `datos_cambiaron` sí se declara. No se migran libros viejos.
- **Entrega recortada por tope:** se declara como hoy (`estadoVigente.loEntregado`), sin hechos que revalidar.
- **Mismo `versionId`, cifra distinta:** se informa igual (`cambio`): puede ser un criterio declarado nuevo (→ `otra_referencia`) o un cambio del motor; ADI no lo esconde.
- **Falla la base:** `ErrorDeAlmacen` → `{ok:false, memoria:"no_disponible"}`, como las otras acciones.

## 4 · Prueba de aceptación y evidencia (cierre del bloque)

Gate nuevo `_retomar_revalida_gate.mjs`, offline, almacén en memoria y `TENANT_DEMO` por `crearAcciones` (el mismo molde de `_capacidad_continuidad_gate.mjs`). Guion: hilo de 3 Entregas (comercial con ranking · cobranza · simulación con supuesto), luego `retomar` en cuatro escenarios de datos:
1. Mismo dataset, misma versión → 100 % `igual`, `eventos = []`, `lineaContinuidad = null` (continuidad invisible), `resumen` consistente.
2. Copia del dataset con la venta de un cliente cambiada y otro cliente retirado, `version: 2` → ese cliente `cambio` (valores y diferencia exactos), el retirado `ya_no_existe`, el resto `igual`, los hechos de la simulación `no_se_revalida`; eventos `datos_cambiaron` + `cifra_cambio`; UNA línea en tercera persona con «antes … carga 1».
3. Copia con otro período en el Marco → toda la Entrega `no_comparable: otro_periodo`; línea = solo `datos_cambiaron`.
4. Benchmark declarado y confirmado por `aportarContexto` → medidos `igual`, brechas `no_comparable: otra_referencia`.

Carnadas (rojo si no se cumplen): libro sin crudo/encargo → ningún `igual`; libro de otra empresa → rechazado; `igual` con crudos que imprimen distinto → rojo; `actual` presente en `sin_reverificar`/`no_se_revalida` → rojo; libro byte-idéntico antes y después de `retomar` → obligatorio; `advertencias` «no re-verifica» ausente cuando sí revalidó; la línea nunca contiene «yo», «te», «usted»; más de 3 cambios → conteo, no lista.

Invariantes: `_capacidad_continuidad_gate.mjs` §6 (hoy afirma el límite, `:158-159`) se reescribe para exigir la revalidación real; `_continuidad_gate`, `_usar_lo_declarado_gate`, `_procedencia_gate`, `_guardado_durable_gate` y los catálogos v13–v40 siguen verdes sin cambiar un byte de texto de Entrega. Umbral: determinístico, cero tolerancia (todos los estados esperados, 0 veredicto inventado) y `npm run gates:offline` con «0 TOCARON LA RED · 0 CON CREDENCIAL VIVA». Decisión §7.3·59 anotada en `_ADI_CONTRATO_ENCARGO_V1.md`. Este gate es el insumo offline de los «10 retomar tras corte» del protocolo B3 del plan v2; la medición ciega de la etapa 2 (≥ 99 %) es aparte.

## 5 · Decisiones para el owner (máx. 3)

1. **¿Dónde se revalida?** A) Solo al **retomar** (una acción, un lugar, cómputo acotado). B) También en cada consulta tras un cambio de carga y al citar `contexto: E1`. **Recomiendo A ahora**; B queda escrita como extensión natural (reutiliza `revalidar.js` tal cual) para después de medir.
2. **¿Qué oye la persona cuando cambiaron varias cifras?** A) Una línea que nombra cada cifra cambiada (puede alargarse). B) Hasta 3 con nombre; de 4 en adelante el conteo, y el detalle tipado para que el anfitrión lo cuente si se lo piden. **Recomiendo B** (una línea de verdad).
3. **¿Cuándo una cifra «sigue igual»?** A) Solo si el valor exacto no cambió. B) Si se muestra igual con el formato de la casa (lo que la persona vio); una diferencia por debajo de lo impreso no es un aviso. **Recomiendo B**: coherente con «verificado no es exacto» y con cómo ya se contrasta lo declarado.

### 5b · APROBADO POR EL OWNER (2026-10-04) — manda sobre §2.4 y §5 donde choquen

1. **Dónde:** A — solo al retomar.
2. **Varios cambios:** ajuste del owner — la línea nombra **hasta 3 cambios** y dice **cuántos adicionales** existen; el detalle completo queda tipado y disponible. Nunca solo el conteo. **SIN sistema nuevo de materialidad ni scoring** (owner 2026-10-04: «dinero primero» NO es regla de producto). Selección = **la prioridad que la Entrega original ya trae** (función pura `elegirCambiosANombrar` en `revalidar.js`):
   - (a) orden por la `.prioridad` de la fila de Cifras de la que salió el hecho (la MISMA que usa `entrega/tamano.js:gobernarTamano`: menor = más prioritaria; 0 = nunca recortable). Se GUARDA en el libro por hecho al registrar la Entrega (campo `prioridad`). Si la fila servida no la trae, el fallback es el de `tamano.js`: el orden de aparición en la tabla.
   - (b) la magnitud SOLO desempata: dos cambios con la MISMA prioridad y la MISMA unidad → mayor |actual − anterior| primero. Nunca se compara entre unidades distintas (dinero vs. %); ahí manda el orden de aparición.
   - (c) resto del empate → orden de aparición en la Entrega original.
   - Solo `cambio` y `ya_no_existe` entran; `no_comparable`/`no_se_revalida`/`sin_reverificar` jamás. Ningún umbral.
3. **«Sigue igual»:** B — igual si el formato de la casa imprime lo mismo.
4. **Lenguaje:** nada de «carga v3» ni «versión»: la línea dice «con los datos anteriores» / «con los datos actuales» (o la fecha de la carga si el libro la tiene). Tercera persona, lenguaje empresarial. Ej.: «Desde la entrega anterior cambiaron: venta de Lider (antes $12,3M, ahora $11,1M), …, y 4 cambios más; el detalle está disponible».

## 6 · Encargo para Sonnet (pegar tal cual)

Contexto: rama `dev` desde `6ed94230`. Etapa 1 congelada: NO tocar `src/adi/entrega/componer.js`, `src/adi/encargo/*`, ni ningún texto de Entrega. Nada de LLM ni red. Gates solo por `npm run gates:offline`. Diseño: `_ADI_DISENO_BLOQUE_4.md` (este archivo). Leyes: el pasado no se reescribe · sin crudo no hay veredicto · un declarado nunca pisa un medido · una línea solo ante evento · tercera persona.

1. `src/adi/continuidad/libro.js` — aditivo: `libroNuevo({ empresaId })` guarda `empresaId`; `registrarEntrega` acepta y conserva `encargo`, `referencias`, `moneda`, `revalidable` y, por hecho, `raw`, `unidad`, `clave`, `titular`, `procedencia` (no renombrar `origen`). Actualizar la cabecera (§B) y medir el tamaño en el gate; si hace falta, `LIBRO_TOPE_BYTES` a 32 KB con nota.
2. `src/adi/capacidad/acciones.js` — en `consultar`: `_hechosDeLaEntrega(entrega)` enriquece cada fila con `procedencia.libro.porId.get(ref)` (`numeros[última].raw/unidad`, primera `clave` de `H.claves`, `H.origen.titular`); `registrarEntrega` recibe `encargo: resolucion.encargo` sin `conversacionId`, `referencias` desde `criteriosAplicados` (+ `marco.referenciaDeclarada`), `moneda: marco.moneda`, `revalidable: true`; `libroNuevo({ versionId, empresaId: tenantId })`. La salida de `consultar` NO cambia (texto y json byte-idénticos).
3. Nuevo `src/adi/continuidad/revalidar.js` (puro, sin I/O): `revalidarEntrega(entregaGuardada, { libroActual, marcoActual, referenciasActuales, versionIdActual, parteResuelta })` → `{ hechos: Map id → revalidacion, resumen }` con los seis estados de §2.3 y sus reglas duras; `igual` por `formatoDeLaCasa`; diferencia calculada por ADI; `reverificadorDe(resultadosPorEntrega)` que cumple la firma `reverificar(h, ctx)` de `retomar.js`.
4. `src/adi/continuidad/retomar.js` — aditivo: admitir `no_comparable` y `no_se_revalida` (línea 31), adjuntar `revalidacion` completa por hecho y `resumen`; `cifrasReverificadas` sigue saliendo solo de `cambio`/`ya_no_existe`.
5. `src/adi/continuidad/estadoVigente.js` — aditivo: `eventosDeContinuidad` acepta `cargaAnterior` en cada cifra («antes X, carga v3») y, con más de 3 cambios, una sola entrada de conteo (decisión 2·B). Textos de la casa, tercera persona.
6. `acciones.js:retomar` — leer libro y memoria (mismo patrón que `consultar` 1b); rechazar empresa distinta; un solo `conTenantActivo` que re-corre cada Entrega `revalidable` con `validarEncargo(entrega.encargo, { libro })` + `componerEntrega`, con los criterios declarados vigentes (`conCriteriosDeEmpresa`, `setBenchmarkOverride`) como en `consultar`; construir el verificador; devolver `hechos`, `resumen`, `eventos`, `lineaContinuidad`, `uso: CABECERA_DE_RETOMAR`; `advertencias` solo para lo que no pudo revalidar. `retomar` sigue sin escribir el libro.
7. `src/adi/capacidad/puerta.js` — solo la descripción de la herramienta `retomar` (qué devuelve ahora); sin cambios de esquema.
8. Gate nuevo `_retomar_revalida_gate.mjs` según §4 (cuatro escenarios + carnadas + libro byte-idéntico antes/después). Para mutar el dataset: clonar `TENANT_DEMO`, cambiar la venta oficial de un cliente (`clientesVentas.actual`, verificar el campo) y retirar otro; para el período, mutar el campo que lee `_periodoDelMarco` en `componer.js` (verificar). Registrar el gate en la lista de `gates:offline` como los demás.
9. Ajustar `_capacidad_continuidad_gate.mjs` §6 (`:148-160`): ahora exige revalidación real, no el límite.
10. `_ADI_CONTRATO_ENCARGO_V1.md` §7.3 — agregar la decisión 59 (bloque 4): los seis estados, «igual = mismo valor impreso», «otro período = no comparable», «un supuesto no se revalida», «retomar no escribe». Y actualizar la nota de `_ADI_CONTINUIDAD_INTEGRACION.md` §2 «retomar».
11. No tocar: `componer.js`, `encargo/*`, `numberGuard.js`, `entityGuard.js`, `_guard_gate.mjs`, migraciones, `almacenSupabase.js` (el libro es jsonb: los campos nuevos no exigen migración). Evidencia de cierre: `npm run gates:offline` completo verde con «0 TOCARON LA RED · 0 CON CREDENCIAL VIVA», catálogos v13–v40 byte-idénticos.
