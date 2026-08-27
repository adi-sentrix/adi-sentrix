# PLANO — Las dos vías del frente «Datos del cliente»

> Extiende `_FRENTE_DATOS_DEL_CLIENTE.md` (diseño base + las cinco decisiones del owner, §§7-8).
> Este documento es **el plan de trabajo**: qué se toca, en qué orden, cómo se prueba sin gastar,
> y cuál es el único punto donde hay que pedir autorización de gasto.
>
> **Orden del owner (2026-08-20):** la vía 1 es **bloqueante** para datos reales. La vía 2 se
> **diseña y se construye**, pero **no se usa con datos reales de clientes** mientras el navegador
> siga recibiendo datos de todas las empresas.
>
> ⚠️ **AL 2026-08-27 HAY UNA TERCERA VÍA, AL FINAL DE ESTE ARCHIVO: PERSISTENCIA.** Las vías 1 y 2
> están cerradas, y la 2 quedó **distinta a como está descrita acá** (el mapeo libre se descartó).
> **Si algo de las vías 1 y 2 contradice a la vía 3, manda la vía 3.**

---

## 0 · Lo que se MIDIÓ antes de planificar (nada de esto es supuesto)

**0.1 · La fuga es real, y está probada en el paquete que se publica.** Se corrió `vite build` y se
buscaron literales dentro de `dist/assets/index-*.js`:

| literal buscado | de dónde sale | veces en el bundle |
|---|---|---|
| `NevadaFoods` | **solo** de `empresa2.js` | **9** |
| `Falabella` | del tenant demo | 30 |
| `SAM-TV55` | del tenant demo | 4 |
| `Distribuidora Andina` | de `empresa2.js` (objeto de cabecera) | 0 |

El objeto `TENANT_EMPRESA2` se elimina por tree-shaking, pero **las filas de negocio de la segunda
empresa sobreviven al build** — nombre, familia, venta, margen, unidades, todo. El `if (import.meta.env.DEV)`
de `main.jsx` **no protege el dato**. Hoy da igual porque los dos datasets son ficticios; con un cliente
real deja de dar igual.

**0.2 · La puerta del dato es UN solo archivo, y ya sabe cambiar de empresa en caliente.**
`src/data/tenantStore.js` es la única entrada; `demoData.js`, `skusMargen.js`, `baseKpis.js`,
`catalogs.js` y `scenarios.js` son **fachadas** de ese store. **17 módulos** registran un rebuild vía
`onTenantChange`, y `_tenant_gate.mjs` ya prueba de forma permanente que `initTenant(empresa2)` →
`initTenant(demo)` devuelve las respuestas **byte-idénticas**. La maquinaria que hace falta ya existe.

**0.3 · Solo DOS líneas meten dato en el bundle.**

- `src/main.jsx:9` — `import { TENANTS } from "./data/tenants/index.js"` (trae los dos).
- `src/data/tenantStore.js:13` — `import { TENANT_DEMO } from "./tenants/demo.js"` (el default).

Los 34 módulos que consumen `demoData` **no importan el dato crudo**: leen la fachada. Eso hace la vía 1
mucho más chica de lo que el diseño base temía.

**0.4 · No hay endpoint de dato.** `api/` tiene seis archivos y los cinco de ADI son envoltorios finos de
`gatewayFetch`. `server.js` (Node puro, sin dependencias) sirve `dist/` + el gateway: es el lugar natural
del endpoint nuevo fuera de Vercel.

**0.5 · La validación declarada YA EXISTE.** `src/config/contract/validationRules.js` trae `RULES` con
severidad **blocker / warning / info** y las tolerancias aprobadas por el owner (dinero ≤ $1K o 0.1% ·
porcentajes ≤ 0.1 pp · ratios ≤ 0.1 · salto de escala 1000× → advertir), y `validator.js` expone
`validateDataset(mode)`. La ingesta **no estrena** un validador: alimenta el que hay.

**0.6 · La forma exacta del fact pack.** `cifrasDelDato(scenario)` devuelve
`{ figs:[{canon,value,duenos}], counts, estados, rankings, dias }`, y `proyectarDatoNegocio` agrega
`texto` y `kpisLineas`. **Ese objeto es el contrato de salida de la vía 2.**

**0.7 · Dependencias.** Hoy: React, esbuild, jsdom, testing-library, `@vercel/functions`, vite.
**No hay librería de Excel.** La vía 2 estrena exactamente **una** dependencia de runtime (`xlsx`).

**0.8 · Los gates se descubren solos.** `gates:offline` escanea los `_*_gate.mjs` de la raíz, clasifica
LIVE por marcador de red, limpia credenciales del entorno hijo y mata el proceso ante cualquier
fetch/http/net/dns. Un gate nuevo entra a la suite con solo existir — y si toca la red, la suite lo caza.

---

# VÍA 1 — Seguridad / tenant · BLOQUEANTE

**Objetivo, en una línea:** que el servidor entregue el dato de UNA empresa y que ningún dato de otra
empresa llegue nunca al navegador.

### Paso 1.1 · El endpoint del dato (todavía sin login)

- `api/adi-data.js` (patrón idéntico a `adi-plan.js`: envoltorio de plataforma) + ruta gemela en `server.js`.
- Devuelve **un** dataset del tenant activo, en JSON, con `ETag` para caché.
- La fuente sigue siendo `src/data/tenants/*.js` **importado en el servidor**. No cambia el schema todavía.
- **Se verifica:** `curl /api/adi-data` devuelve un solo dataset; el de la otra empresa no aparece.

### Paso 1.2 · El arranque asíncrono (el corazón de la vía)

- `tenantStore.js` deja de importar `TENANT_DEMO`. Arranca con una **forma vacía** declarada, no con datos.
- `main.jsx` deja de importar `TENANTS`. Hace: `fetch` → `initTenant(dataset)` → `render`.
- **El riesgo, nombrado:** las fachadas leen `getTenantData()` en tiempo de import. Con el store vacío eso
  debe devolver la forma vacía sin romper; los 17 rebuilds disparan antes del primer render. Si algún
  módulo calcula sobre el dato **en el import** y no en el rebuild, se cae ahí — es el punto exacto a
  auditar, módulo por módulo, y es el trabajo real de este paso.
- **Los gates no se enteran:** corren en Node, llaman `initTenant(fixture)` directo, como ya hace
  `_tenant_gate`. De los 223 archivos de gate, **65** tocan dato de tenant y ninguno pasa por el navegador.
- **Se verifica con un candado nuevo, `_bundle_sin_datos_gate.mjs`:** construye (proceso hijo, como
  `_tenant_gate` hace con esbuild) y **se pone rojo si un literal de cualquier tenant aparece en `dist/`**.
  Es exactamente la búsqueda del §0.1, convertida en ley. Sin este gate, la fuga vuelve sola en tres meses.

### Paso 1.3 · La puerta: `tenant_id` sale de la SESIÓN

- Supabase auth con cookie httpOnly server-side (`@supabase/ssr`, compatible con las funciones de Vercel).
- El endpoint 1.1 resuelve el tenant **consultando `memberships` en vivo**, nunca de un parámetro del
  cliente ni de un token de larga duración: revocar una membresía corta el acceso en la **siguiente** request.
- `handlePlan` / `handleNarrateC` dejan de aceptar `tenantId` del cliente (hoy solo lo usan para
  rate-limit, `gatewayCore.js`) y lo resuelven server-side.
- El código firmado HMAC de la demo privada **se queda** para el modo demo. Conviven.

### Paso 1.4 · Permisos y RLS

- `memberships(user_id, tenant_id, rol: admin|usuario, estado)` — el rol vive en la membresía.
- **RLS en toda tabla con `tenant_id`.** `assertTenantContext` se queda como cinturón, pero la garantía
  estructural es la base de datos, no un `if` de JavaScript.
- Acá aterriza la decisión 2 del owner: **solo el administrador activa una versión de «dato del negocio»**.

**Definición de terminado (vía 1):** `_bundle_sin_datos_gate` verde · `_tenant_gate` sigue verde (la
reversibilidad byte-idéntica no se rompió) · un usuario de la Empresa A no puede obtener el dataset de la
Empresa B ni pidiéndolo a mano · `npm run gates:offline` con **0 tocaron la red · 0 con credencial viva**.

---

# VÍA 2 — Ingesta · SE DISEÑA Y SE CONSTRUYE, NO SE USA CON DATO REAL

**El candado de esta vía:** mientras la vía 1 no cierre, la ingesta corre **solo sobre el tenant demo y
sobre fixtures**. No es una recomendación: es la condición que puso el owner.

### Paso 2.1 · Subir (Excel / CSV)

- Formatos: `.xlsx`, `.xls`, `.csv`. **Se lee con librería `xlsx`, jamás con un modelo.** Cero tokens.
- Se guarda el original **intacto, con su hash**, y nunca se sobrescribe (Supabase Storage).
- Tabla `uploads` con **`tipo ∈ {negocio, referencia}` desde la primera migración** (§8.1 del diseño).
- Las filas crudas van a `upload_rows` — staging. Nada toca el motor todavía.

### Paso 2.2 · Validar

- Alimenta `validationRules.js`. La ingesta agrega sus propias reglas al mismo catálogo, con las mismas
  tres severidades:
  - **bloqueante:** dos filas con la misma clave y distinto valor · columna obligatoria ausente ·
    **unidad no confirmada**
  - **advertencia:** columna opcional ausente · celda vacía en fila válida · valor fuera de rango razonable
- **Nada se corrige en silencio.** Un archivo se acepta con sus límites escritos en pantalla, o no se acepta.

### Paso 2.3 · Mapear — **ÚNICO PASO QUE GASTA**

- Entrada al modelo: **solo encabezados + una muestra de filas**, nunca el archivo (§4 del diseño base).
- El modelo **PROPONE**; el humano **CONFIRMA**. `upload_mappings` guarda el mapeo y **quién lo confirmó**:
  es evidencia, no configuración.
- **La unidad se declara y se confirma. Jamás se infiere del rango** — miles-vs-dólares es la lección más
  cara del proyecto.
- **Antes de gastar un peso:** se calibra contra fixtures de encabezados guardados, con el método que ya
  existe (`_calibracion_borradores.mjs`). Primero se afina offline, después se mide en vivo.

### Paso 2.4 · Versión activa y rollback

- `fact_pack_versions`, append-only. Una sola versión vigente por tenant.
- **Rollback = marcar activa la anterior.** Una operación, sin recálculo, auditada.
- **El pack es autosuficiente** (§8.4): la fuente (archivo · hoja · fila) se guarda **dentro** del pack como
  texto, porque el original se borra a los 12 meses y el pack vive para siempre.
- Cada respuesta guardada lleva la versión que la produjo — sin ese campo, «congelada y marcada» (§7.3) no
  se puede ni dibujar.

### Paso 2.5 · Los dos tipos, separados de verdad

- **dato del negocio** → reemplaza la versión activa del tenant. Solo administrador.
- **archivo de referencia** → **no entra a `fact_pack_versions` activo**. Su proyección vive en la sesión de
  quien lo subió (tenant + usuario + sesión). Cualquier usuario.

### Qué de la vía 2 depende de la vía 1, y qué no

| paso | ¿depende del canal? |
|---|---|
| 2.1 subir · 2.2 validar · 2.3 mapear | **NO** — son servidor puro, se construyen ya |
| 2.4 entregar el pack al navegador | **SÍ** — viaja por el canal de la vía 1 |
| cualquier archivo de un cliente real | **SÍ** — bloqueado hasta que la vía 1 cierre |

---

## 3 · Cómo se prueba cada vía SIN gastar un centavo

**Vía 1** — `_bundle_sin_datos_gate` (nuevo) + `_tenant_gate` (ya existe) + `curl app.adiai.cl/api/version`
para confirmar qué commit sirve producción.

**Vía 2 — el espejo, y es la prueba que vale:** `_ingesta_espejo_gate.mjs` genera un `.xlsx` **a partir del
tenant demo**, lo pasa por el pipeline completo (2.1 → 2.2 → mapeo fijado a mano, sin modelo) y **exige que
el fact pack resultante sea igual al que produce `cifrasDelDato()`**. Determinístico, offline, cero tokens.

Es el criterio de éxito del diseño convertido en candado: **si ese gate pasa, `guardC` no necesita una línea
nueva**, porque el archivo produce exactamente el mismo objeto que produce el dato de hoy.

---

## 4 · El único punto de gasto, con el número por delante

Solo el paso **2.3** llama a un modelo. Precios vigentes al 2026-08-20:

| modelo | entrada (US$/millón) | salida (US$/millón) |
|---|---|---|
| **Claude Haiku 4.5** — mapear | 1.00 | 5.00 |
| **Claude Sonnet 5** — narrar | 3.00 (introductorio 2.00 hasta el 31-08) | 15.00 (introductorio 10.00) |

**Una llamada de mapeo** = encabezados + muestra (~800 tokens de entrada) y un mapeo propuesto (~400 de
salida) ≈ **US$0.003**. Menos de medio centavo de dólar por archivo.
**Una tanda de calibración** de ~40 llamadas (variantes de encabezados, idiomas, trampas) ≈ **US$0.12**;
con margen amplio, **por debajo de US$0.50**.

> Para contraste, lo que este reparto evita: un Excel de 5.000 filas alimentado crudo a Sonnet son
> ~100k tokens de entrada ≈ **US$0.20–0.30 por archivo, cada vez** — además de ir contra la regla madre.

**Cuando lleguemos ahí, se pide autorización nombrando el monto.** Hasta entonces: cero llamadas.

---

## 5 · Lo que NO se toca en ninguna de las dos vías

`guardC`, el notario, el contrato conversacional, los vetos, el contrato de cálculo `[[CALCULO]]`.
La conversación no cambia de forma. Si hay que tocar el muro, la ingesta está mal hecha.

---

# VÍA 3 — Persistencia · el dato del cliente deja de vivir en la memoria del navegador

**Escrito el 2026-08-27, después de que las vías 1 y 2 cerraran.** Lo de arriba se planificó cuando la ingesta
era un mapeo libre por confirmar; eso se descartó. **Si algo de las vías 1 y 2 contradice a esta, manda esta.**

## 3.0 · Qué cambió desde que se escribió lo de arriba

- **Vía 1: CERRADA.** El navegador ya no recibe el dato de otras empresas; `handleData` lo entrega por fetch.
- **Vía 2: CERRADA, pero distinta a como está descrita.** No hay mapeo libre: hay una **plantilla oficial
  congelada** (v1, 4 pestañas) que el usuario llena, y las columnas calculadas RECHAZAN el archivo. El paso 2.3
  —«el único que gasta»— **ya no existe**: la ingesta es 100% determinística y no llama al modelo. En
  consecuencia, `upload_mappings` deja de tener sentido como tabla de mapeo.
- **Lo que sí quedó igual, y es lo que esta vía persiste:** la ingesta produce un `dataset` con **las mismas
  llaves que un tenant** (hay un gate que lo comprueba), más una preview y un **sello de plausibilidad**.
- **Producción va en v1.12** y el pack sigue viviendo en la memoria del navegador: si el usuario recarga, se fue.

## 3.1 · La decisión que gobierna esta vía: el pase corto

**Aprobada por el owner el 2026-08-27.** Ni llave de servicio ni Supabase Auth:

1. la puerta actual con código firmado **sigue igual**;
2. el servidor verifica ese código, como hoy (`verifyAccessCode`);
3. con eso **emite un pase corto que lleva `tenant_id` adentro**, firmado con el secreto JWT de Supabase;
4. PostgREST recibe el pase y **las políticas de RLS leen el `tenant_id` del pase**;
5. **la llave de servicio NO se usa para lecturas normales.** Queda para migrar y sembrar, nada más.

⚠️ **POR QUÉ ESTO Y NO LA LLAVE DE SERVICIO.** Con la llave de servicio, RLS no protege: el servidor puede leer
todo y el aislamiento vuelve a depender de que el código no tenga un bug — exactamente lo que la vía 1 salió a
eliminar («`assertTenantContext` depende de que el código no tenga un bug; RLS lo hace estructuralmente
imposible», §3 del documento del frente). Con el pase, **un error de filtro devuelve cero filas, no las filas de
otra empresa**. Falla cerrada.

⚠️ **NO HACE FALTA UNA DEPENDENCIA NUEVA.** `src/adi/llm/accessToken.js` ya firma HMAC-SHA256 con **Web Crypto**
(`crypto.subtle`), que corre en edge y en node por igual. Emitir el pase es la misma primitiva que ya se usa.

**Compatibilidad hacia adelante**, que el owner pidió explícitamente: el pase lleva hoy solo `tenant_id`. Cuando
existan personas, suma `sub` y las políticas se extienden con un `OR`. **Las tablas no se rehacen**: las
columnas de persona (`subido_por`, `creado_por`) nacen ahora, nulas.

## 3.2 · El esquema

Cuatro tablas y un bucket. **Medido antes de decidir el tipo**: el fact pack pesa **10 KB** en un archivo chico
y **98 KB** el del demo. Eso es `jsonb` sin discusión — no hace falta almacenamiento de objetos para el pack.
El `.xlsx` original sí va a Storage.

```
tenants          id · slug · nombre · created_at
memberships      tenant_id · user_id · rol            ← vacía hoy; es el enganche para cuando haya personas
uploads          id · tenant_id · tipo · nombre_archivo · hash_sha256 · bytes
                 · storage_path · estado · subido_por(null) · created_at
fact_pack_versions
                 id · tenant_id · upload_id · version · pack(jsonb) · sello(jsonb)
                 · plantilla_version · activa · creado_por(null) · created_at
```

**`uploads.tipo ∈ {negocio, referencia}` NACE CON LA TABLA**, no se agrega después: es la decisión 1 del §7 y su
consecuencia declarada en el §8.

**Tres detalles que no son cosméticos:**

- **Una sola versión activa, garantizada por la base.** Un booleano invita a que haya dos. Un índice único
  parcial —`unique (tenant_id) where activa`— hace que tener dos sea **imposible**, no improbable. Misma idea
  que RLS: la garantía vive en la base, no en un `if`.
- **El sello de plausibilidad va DENTRO de `fact_pack_versions`**, no en `uploads`. Califica las lecturas de
  ESE pack: si el usuario asumió una observación, eso tiene que volver con el pack al recargar. En `uploads` se
  perdería.
- **Append-only.** Rollback = marcar activa la versión anterior. Una operación, sin recálculo, auditada.

**El hash** es sha-256 del archivo original. No es único: un cliente puede subir el mismo archivo dos veces a
propósito. Sirve para que la ingesta pueda decir «este archivo ya lo subiste el 12 de agosto» y para auditar.

**Retención** (decisión 4 del §7): el original **12 meses**, las versiones del pack **siempre**. Por eso el pack
tiene que ser **autosuficiente**: la fuente (archivo · hoja · fila) se guarda como texto DENTRO del pack, nunca
como puntero al archivo que se va a borrar.

## 3.3 · Las políticas

Toda tabla lleva `tenant_id` y **RLS activada**. La política es una sola idea, repetida:

> se ve y se escribe solo donde `tenant_id` sea igual al del pase.

En SQL, el `tenant_id` sale del claim del pase (`request.jwt.claims`). El rol de base es uno propio del
producto —no `service_role`, no los de Supabase Auth— para que no herede supuestos que todavía no existen.

**Storage** lleva su propia política: la ruta es `tenant_id/upload_id.xlsx` y solo se lee lo que empiece con el
`tenant_id` del pase.

⚠️ **El día que haya personas**, la política pasa de «mi empresa» a «mi empresa Y soy miembro». Se agrega, no se
reescribe.

## 3.4 · Los cinco puntos de integración, exactos

| # | Archivo | Qué cambia | Runtime |
|---|---|---|---|
| 1 | `src/ingesta/handleIngesta.server.js` | Tras ingestar, antes de devolver: guardar `uploads` + `fact_pack_versions` **inactiva** | **node** |
| 2 | *(nuevo)* `op: "activar"` | Hoy «Seguir con estos números» solo llama a `initTenant` en memoria. Marca la versión activa | node |
| 3 | `src/data/tenantService.server.js` → `handleData` | `TENANTS[tenantId]` pasa a ser la lectura del pack ACTIVO | **edge** |
| 4 | `src/data/tenantStore.js` → `getTenantId()` | Cierra el `"demo"` por defecto sin empresa cargada | navegador |
| 5 | `src/ui/App.jsx` + `src/ingesta/estadoCarga.js` | El sello vuelve del servidor al cargar, no vive solo en memoria | navegador |

**El punto 3 es una sustitución, no un rediseño**: el contrato de `handleData` ya tiene la forma correcta —
`{ ok, tenantId, origen, nombre, dataset }` — y `resolverTenantDeSesion` ya separa «qué empresa» de «entregar el
dato». Solo cambia de dónde sale el dataset.

⚠️ **EL PUNTO 3 CORRE EN EDGE.** Junto con `adi-access`, `adi-narrate`, `adi-plan` y `adi-spec`, son **cinco
endpoints** que importan `gatewayFetch`. **Nada que dependa de un módulo de Node puede entrar a ese camino**:
ignorarlo costó tres builds rotos y dejó producción atrás una tarde, con los 177 gates en verde porque ninguno
empaquetaba para edge. Hoy lo vigila `_edge_bundle_gate`.
**Por eso el cliente de Supabase se escribe acá**: unas 40 líneas sobre `fetch` contra PostgREST, sin
dependencias, sirviendo a los dos runtimes. Es la misma decisión que se tomó con el lector de `.xlsx`, y por la
misma razón.

## 3.5 · El orden de trabajo

Cada paso deja `dev` verde y **no cambia nada en producción hasta el último**. Todo lo que toca la base va
detrás de una bandera de entorno: **sin credenciales configuradas, el código no persiste y la app se comporta
exactamente como hoy.**

| Paso | Qué | Necesita el proyecto Supabase |
|---|---|---|
| 3.a | Esquema y migraciones como `.sql` en el repo | **no** |
| 3.b | El emisor del pase + el cliente REST propio | **no** |
| 3.c | `handleIngesta` guarda (detrás de bandera) | no para escribirlo · sí para probarlo en vivo |
| 3.d | `op: "activar"` + la pantalla | ídem |
| 3.e | `handleData` lee el pack activo, con respaldo al registro estático | ídem |
| 3.f | Sembrar el demo como tenant normal | **sí** |
| 3.g | Cerrar el `"demo"` de `getTenantId()` | no |

**El demo se siembra como una empresa más** (aprobado por el owner). Un solo camino de código: si el demo queda
como respaldo estático, el camino que van a usar los clientes no se ejerce hasta el primer cliente, y ahí es
tarde para descubrir que falla.

## 3.6 · Cómo se prueba cada paso sin gastar y sin credenciales

Esta vía **no llama al modelo en ningún punto**: la ingesta ya es determinística. El gasto de esta vía es cero.

- **El esquema** se prueba leyéndolo: un candado que exige que toda tabla tenga `tenant_id`, tenga RLS activada
  y tenga política — y que se ponga rojo si alguien agrega una tabla sin las tres cosas.
- **El pase** se prueba firmando y verificando en memoria, sin red: que lleve el `tenant_id`, que expire, y que
  un pase de otra empresa no valide. Con carnada, como el resto de los candados.
- **El cliente REST** se prueba contra un doble que responde en memoria: que arme la URL correcta, que mande el
  pase en la cabecera, y —lo que importa— que **nunca** mande la llave de servicio en una lectura.
- **Los endpoints edge** siguen cubiertos por `_edge_bundle_gate`: si el cliente nuevo arrastra algo de Node, se
  pone rojo antes del deploy y no en el build de Vercel.
- **Sin credenciales**, todo lo anterior corre igual: el candado del esquema lee SQL, el del pase firma en
  memoria y el del cliente habla con un doble.

## 3.7 · Lo que el owner tiene que hacer, y lo que no

**Suyo, porque no lo hago yo:** crear la cuenta y el proyecto de Supabase, y poner las variables en Vercel —
la URL del proyecto, el secreto JWT y la llave de servicio (esta última **solo** para migrar y sembrar).

⚠️ **Ninguna credencial entra al repo, y ninguna lleva prefijo `VITE_`**: ese prefijo las hornea en el paquete
que baja el navegador. Es la misma regla que ya rige para la llave del proveedor.

**Mío:** todo lo demás. Los pasos 3.a, 3.b y 3.g no necesitan el proyecto creado; se pueden escribir y probar
desde ya.
