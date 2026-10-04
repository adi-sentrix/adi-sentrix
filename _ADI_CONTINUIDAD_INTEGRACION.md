> Estado: ETAPA 2 (Carril B) entregada, sin conectar. Este documento es la interfaz EXACTA que el supervisor
> conecta a `entrega/componer.js` y a la puerta del Complemento (Etapa 3). Nada de lo descrito acá corre hoy:
> `src/adi/continuidad/` no tiene un solo import desde `entrega/` ni desde `encargo/` — se construyó detrás de
> una interfaz de almacenamiento inyectable, ejercitada solo por los gates offline de esta pieza.

# Continuidad factual — qué entra, qué sale, dónde se llama

## 0 · Los cinco módulos

| Archivo | Qué es | Toca I/O |
|---|---|---|
| `src/adi/continuidad/almacen.js` | La interfaz de almacenamiento (contrato) + `crearAlmacenEnMemoria()` | No (memoria) |
| `src/adi/continuidad/almacenSupabase.js` | El mismo contrato sobre Supabase, vía `data/supabaseRest.js` | Sí — **no se usa hoy** |
| `src/adi/continuidad/empresa.js` | La memoria única de empresa (criterios·hechos·documentos) | No — recibe el almacén |
| `src/adi/continuidad/libro.js` | El libro de conversación (turno, criterio, supuestos, entregas, premisas, ofertas) | No |
| `src/adi/continuidad/estadoVigente.js` | El estado compacto para el LLM + los 5 eventos → 1 línea | No |
| `src/adi/continuidad/retomar.js` | La acción «retomar»: hechos re-verificados, sin recomponer prosa | No — recibe un verificador inyectado |

Ninguno de los cinco importa nada de `entrega/`, `encargo/` ni de la base. `empresa.js`/`libro.js`/`retomar.js`
importan de `notario/hechos.js` (formato, vocabulario), nunca al revés.

## 1 · El almacén — lo único que hay que decidir para conectar

Todas las funciones de `empresa.js` y `libro.js` reciben el almacén como PRIMER (empresa) o único (libro, vía
`store.leerLibro`/`guardarLibro` que el caller invoca directo) parámetro. Hoy existen dos implementaciones:

- `crearAlmacenEnMemoria()` — la que usan los gates. Sirve también como demo sin base configurada.
- `crearAlmacenSupabase({url, apikey, pase})` — escrita, siguiendo el patrón de `data/supabaseRest.js`, sobre
  las funciones RPC que la migración 015 define. **Requiere que el owner autorice aplicar la 015** contra un
  proyecto real antes de poder usarse — hoy fallaría toda llamada (las funciones no existen en ninguna base).

Conectar Etapa 3 es, en el punto de entrada del endpoint/puerta:
```js
const almacen = baseConfigurada(env) ? crearAlmacenSupabase({ url, apikey, pase }) : crearAlmacenEnMemoria();
```

> **ACTUALIZADO (Etapa 2, bloque 1 · guardado durable, 2026-10-02) — lo de arriba y los ejemplos de abajo se leen así:**
> 1. **La interfaz del almacén es UNA y es ASÍNCRONA** (memoria y Supabase): todo `almacen.*`, y toda función de
>    `empresa.js` que lo usa, se ESPERA con `await`. La nota que decía «ninguna línea cambia al enchufar Supabase» era
>    falsa (el adaptador era asíncrono y los consumidores síncronos: `.filter is not a function`); los ejemplos de abajo
>    están escritos en la forma síncrona original — léalos con `await` delante de cada llamada al almacén.
> 2. `leerLibro` y `guardarLibro` reciben la **empresa primero**: `leerLibro(tenantId, conversacionId)`,
>    `guardarLibro(tenantId, libro)` (en memoria es la llave de aislamiento).
> 3. **«No existe» y «no se pudo leer» son cosas distintas**: lo primero devuelve `null`/`[]`; lo segundo LANZA
>    `ErrorDeAlmacen`, y la acción responde `{ok:false, memoria:"no_disponible"}` (falla cerrado).
> 4. **El orden de cada acción** es leer (base) → tramo síncrono del Core (`capacidad/aislamiento.js:conTenantActivo`) →
>    escribir (base): ningún `await` entre `initTenant` y el cálculo, para que dos empresas atendidas a la vez no se mezclen.
> 5. **La puerta** usa la memoria del proceso salvo con `ADI_MEMORIA_DURABLE=true` (y la migración 015 aplicada), que arma
>    UN almacén de Supabase POR PEDIDO con el pase de la empresa de esa llamada.
> 6. **El libro es un hilo del Complemento** (`origen: "complemento"`, sellado por la base): el Historial de la app solo
>    lista `origen = 'app'` (migración 015, defecto D3).
> Candado: `_guardado_durable_gate.mjs`. Verificación contra la base real: `scripts/verificar-supabase.mjs` (secciones 6-7)
> y `scripts/guion_continuidad_staging.mjs`.

## 2 · Dónde se llama, por acción del diseño §E (`_ADI_DISENO_FLUJO_V2.md`)

### `consultar(encargo)` → `componerEntrega(resolucion, ctx)` (hoy en `entrega/componer.js`, SIN estos campos)

Antes de componer:
1. `const libro = encargo.conversacionId ? almacen.leerLibro(encargo.conversacionId) : null;`
2. Si `libro` es `null` (id no devuelto, o primera vez): `libro = libroNuevo({ versionId })` — **se declara**
   `continuidad: "nueva — el anfitrión no devolvió el id"` en el marco de la Entrega (campo nuevo, no existe hoy).
3. `const cambioVersion = detectarCambioVersion(libro, versionIdActivo);`
4. `const memoria = memoriaDeEmpresa(almacen, tenantId, { legado: { diario: pack.perfil?.diario, contexto: pack.perfil?.contexto } });`
   — los hechos vigentes de `memoria.hechos` (origen `"declarado"`/`"documento"`) se pliegan como FIGS con
   `.origen` colgado (la vía que `_origenes_gate.mjs` ya prueba: `fig()` no acepta `origen` en sus opts; se
   cuelga después, `con(fig(...), {origen})`), **antes** de correr `libroDeHechos` del turno — así, si el mismo
   concepto también tiene una fig medida del pack, el hecho `discrepancia` de `notario/hechos.js` (corte 1) se
   dispara SOLO, sin que esta pieza reimplemente esa comparación.
5. Si `encargo.criterio` viene resuelto por `validarEncargo`: `libro = actualizarCriterio(libro, resolucion.criterio)`.
6. Si `encargo.premisas` viene con veredictos ya calculados por la Entrega (el mismo `libroDeHechos` que hoy
   juzga las premisas, `entrega/componer.js:1978`): por cada una, `libro = registrarPremisa(libro, {id, hecho, veredicto, verdadId})`.
7. Por cada supuesto vivo que el encargo use: `libro = agregarSupuestoVivo(libro, supuesto)`.
8. Al terminar de componer, con los hechos/universos que la Entrega imprimió:
   `libro = registrarEntrega(libro, { versionId, temas, entidades, cierre, hechos, universos })`.
9. `almacen.guardarLibro(libro)`.
10. `entrega.marco.estadoVigente = estadoVigenteDe(libro, { versionIdActual: versionId });` (capa ESTRUCTURADA,
    con instrucción de no narrarla salvo evento).
11. Eventos del turno:
    ```js
    const eventos = eventosDeContinuidad({
      cambioVersion,
      cifrasReverificadas: [],          // solo lo llena `retomar()`, no un turno nuevo
      premisasFalsas: premisasDeEsteTurno.filter(p => p.veredicto === "falsa").map(p => ({id: p.id, texto: ...})),
      criterioCambio: criterioAnteriorDeLibro !== null && criterioNuevo !== criterioAnteriorDeLibro ? {de, a} : null,
      supuestosVivosRelevantes: libro.supuestosVivos.filter(s => /* el encargo de este turno los usa */),
    });
    entrega.marco.lineaContinuidad = lineaDeContinuidad(eventos);   // null → NO se imprime nada (ley: invisible sin evento)
    ```
12. Cada hecho de empresa que el encargo aportó vía `aportarContexto` (ver más abajo) en ESTE turno:
    `libro = registrarHechoAportado(libro, id)`.

### `retomar({conversacionId})` — CONECTADO en el bloque 4 de la Etapa 2 (2026-10-04)

El `reverificar` real ya existe: `capacidad/acciones.js:retomar` NO reconstruye el índice de evidencia del compositor —no hace falta—:
le vuelve a hacer al Core, hoy, la misma pregunta que se le hizo entonces (el Encargo que el libro guarda con cada Entrega, ver `libro.js`)
con `validarEncargo` + `componerEntrega` en UN solo tramo (`conTenantActivo`, sin esperas) y compara cifra por cifra
(`continuidad/revalidar.js`, puro): `reverificadorDe(resultadosPorEntrega)` cumple la firma `reverificar(hecho, ctx)` de `continuidad/retomar.js`.
Estados: igual · cambio · ya_no_existe · no_comparable · no_se_revalida · sin_reverificar. Devuelve `hechos` (con su `revalidacion`), `resumen`,
`eventos` y UNA línea de continuidad solo ante evento (hasta 3 cambios nombrados y cuántos más hay). `retomar` no escribe el libro.
Decisión §7.3·59 de `_ADI_CONTRATO_ENCARGO_V1.md`; candado `_retomar_revalida_gate.mjs`. Lo que sigue en este documento de `retomar` (el bloque de
código y el párrafo de «sin él devuelve sin_reverificar para todo») es el DISEÑO ORIGINAL, conservado como historia: `continuidad/retomar.js` sin un
verificador sigue fallando cerrado, pero la acción de la capacidad ya lo inyecta.

### `retomar({conversacionId})` (acción nueva de la Etapa 3, hoy no existe)

```js
const libro = almacen.leerLibro(conversacionId);
if (!libro) return { ok:false, motivo: "conversación no encontrada" };
const reverificar = (hechoRegistrado) => {
  // usa el índice de evidencia de la versión ACTIVA (el mismo que arma `entrega/componer.js` para el turno):
  // busca la fig con la misma (sujeto,metrica,periodo); compara con `mismoValor`/tolerancia; construye {estado,valorNuevo}.
};
const { estadoVigente, hechos, eventos, lineaContinuidad } = retomar(libro, { versionIdActual, reverificar });
```
El `reverificar` es OBLIGATORIO para que el resultado sea significativo: sin él, `retomar()` devuelve
`"sin_reverificar"` para todo (falla cerrado — nunca inventa un veredicto). Construirlo es responsabilidad de
quien conecte esta pieza al índice de evidencia real (`notario/evidencia.js:indiceDeEvidencia`), no de
`continuidad/`.

### `aportarContexto({conversacionId?, aportes, confirmar?})` (acción nueva de la Etapa 3)

Por cada aporte:
```js
const r = declararHecho(almacen, tenantId, { clase, concepto, eje, entidad, periodo, valor, origen, documento }, { actorLabel, conversacionId });
// r = {ok, id, estado, entendido, conflictoCon?, reemplazo?, duplicado?, motivo?} — YA es la forma exacta que
// el diseño §E pide devolver al LLM: {id, estado, entendido, conflictoCon?, paraConfirmar}.
```
Por cada id en `confirmar`: `confirmarHecho(almacen, tenantId, id, { actorLabel, resolverConflicto: true })`.
`clase:"perfil"` se rechaza (`declararHecho` lo bloquea): el perfil sigue por `adi_declarar_perfil_empresa`
(012/013), no por esta vía — el endpoint que atienda `aportarContexto` tiene que ramificar ANTES de llamar acá
si el aporte trae `clase:"perfil"`.

### `conocerEmpresa({conversacionId?})` (acción nueva de la Etapa 3)

```js
const memoria = memoriaDeEmpresa(almacen, tenantId, { legado });
const perfil = perfilCliente(tenant);               // YA existe, sin tocar
const perfilPlegado = Object.entries(perfil.campos).map(([campo, v]) => hechoDePerfilCampo(campo, v)).filter(Boolean);
const estadoVigente = libro ? estadoVigenteDe(libro) : null;
```

## 3 · Lo que esta pieza NO decide (y a quién le toca)

- **Cuándo preguntar un campo del perfil** (`necesitaPerfil`, `ROTULOS_PERFIL`, `preguntasDelPerfil`) — Etapa 3,
  corte 6 de `_ADI_DISENO_FLUJO_V2.md` §F. `empresa.js` solo expone `yaFueOmitido`/`omitirCampo` como primitivas.
- **Cómo se construye el `reverificar` real de `retomar()`** — depende del índice de evidencia del compositor. [Resuelto en el bloque 4 de la Etapa 2 (2026-10-04): no hace falta el índice de evidencia del compositor; `retomar` vuelve a preguntarle al Core la misma pregunta con el Encargo que el libro guarda, ver arriba y la decisión §7.3·59.]
- **Cómo se pliega `memoriaDeEmpresa().hechos` en figs con `.origen`** — la vía ya existe (`_origenes_gate.mjs`),
  conectarla es trabajo de `entrega/componer.js`, congelado durante esta etapa.
- **Universal/localizado del perfil** (`alcanceCalza`, `pieza.universalidad`) — Etapa 3, corte 7.

## 4 · Decisiones tomadas sin volver al owner (con su respaldo textual)

1. `moneda_procedencia` (012) no gana `'declarado'`: su check estructural («SOLO `medido`») es una ley aparte, y
   en ese vocabulario `'medido'` YA significa «lo declaró el usuario» — ver la cabecera de la migración 015 §0.
2. El perfil (`clase:"perfil"`) se RECHAZA en `empresa.js:declararHecho`: vive en `tenants` (012/013), no en
   `memoria_empresa`. `hechoDePerfilCampo` es un traductor de SOLO LECTURA para la vista unificada, nunca escribe.
3. El tope de `ENTREGAS_TOPE=12` recorta el ARREGLO (quita las más viejas enteras); el tope de `LIBRO_TOPE_BYTES`
   (16 KB) esqueletiza de más vieja a más nueva DENTRO de las que quedan — dos mecanismos, uno de cantidad y
   uno de tamaño, ninguno toca `premisas` ni `criterioVigente` (ver la cabecera de `libro.js:recortarATope`).
4. `criterioVigente` se fija también con el default de ADI (origen `"adi"`) cuando todavía no hay ninguno — no
   es una inferencia sobre prosa: es el mismo valor determinístico que `validarEncargo` ya resuelve.

## 5 · Los gates de esta pieza

- `_continuidad_gate.mjs` (86/0) — la lógica de `empresa.js`/`libro.js`/`estadoVigente.js`/`retomar.js` con el
  almacén en memoria.
- `_migracion_015_gate.mjs` (38/0) — la migración 015 no diverge del vocabulario de `empresa.js`/`libro.js`, de
  los nombres que `almacenSupabase.js` asume, ni de la ley «no se crea una tabla `libro_conversacion`».

Ambos clasifican `offline` por `scripts/clasificarGates.mjs:clasificarFuente()` (verificado, ver el informe al
supervisor).
