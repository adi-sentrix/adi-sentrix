# PLANO — Las dos vías del frente «Datos del cliente»

> Extiende `_FRENTE_DATOS_DEL_CLIENTE.md` (diseño base + las cinco decisiones del owner, §§7-8).
> Este documento es **el plan de trabajo**: qué se toca, en qué orden, cómo se prueba sin gastar,
> y cuál es el único punto donde hay que pedir autorización de gasto.
>
> **Orden del owner (2026-08-20):** la vía 1 es **bloqueante** para datos reales. La vía 2 se
> **diseña y se construye**, pero **no se usa con datos reales de clientes** mientras el navegador
> siga recibiendo datos de todas las empresas.

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
