# FRENTE: Datos del cliente — Supabase + carga de archivos

> **La regla central, textual del owner (2026-08-16):**
> «No vamos a permitir que "subir un archivo" vuelva a convertir ADI en un chat con Excel adjunto.
> Subir un archivo debe significar: **archivo → datos gobernados → evidencia versionada → notario verificable →
> conversación segura**.»

Documento de DISEÑO BASE. No es implementación y no la autoriza: fija el mapa para que el frente nuevo arranque
sin re-discutir lo ya decidido, y separa lo resuelto de lo que decide el owner.

---

## 0 · Por qué esto no es un contrato nuevo

Casi todo lo que hace falta **ya existe**, y el frente nuevo lo EXTIENDE (regla de la casa: no se crea un
contrato paralelo). Tres piezas que ya están y que definen la forma de la solución:

| lo que hay hoy | qué aporta al frente nuevo |
|---|---|
| `src/config/contract/sourceManifest.js` | cada fuente declara `origin: { kind: "static", module, export }`, su `keyField` y su `schema` con unidades (`money(K)`, `pct`, `count`). **La ingesta no necesita un contrato nuevo: necesita un `kind: "upload"`.** |
| `src/adi/oracle/datoProyectado.js` | ya produce EL FACT PACK: `figs` (cifra + dueños + universo), `estados`, `rankings` (universo · dirección · polaridad · empate · campo fuente · términos), `dias`, `counts`. **La ingesta tiene que producir ESA forma, no una nueva.** |
| `guardC` + la constitución | ya verifica contra ese fact pack. Si el archivo produce el mismo objeto, **el notario funciona sin tocarlo**. Ese es el criterio de éxito del diseño. |

⚠️ **El riesgo mayor NO es el parser.** Hoy el dato de cada tenant viaja en el bundle de JS a TODOS los
navegadores; `initTenant()` solo elige cuál mostrar. Con datos ficticios es aceptable; **con archivos de
clientes reales es inaceptable** — el P&L de la Empresa A llega al navegador de la Empresa B y la UI
simplemente no lo pinta. Servir el dato por fetch autenticado y scopeado por sesión es la pieza más grande y
más riesgosa del frente, y es PREVIA a cualquier piloto real (ver `adi-identity-data-boundary-supabase`).

---

## 1 · El pipeline

archivo → staging → validación → normalización → fact pack → versión activa → conversación

| etapa | qué garantiza | dónde vive |
|---|---|---|
| **archivo** | se guarda el original, intacto y con su hash. Nunca se sobrescribe. | Supabase Storage |
| **staging** | filas crudas, sin interpretar. Nada del archivo toca al motor todavía. | tabla `upload_rows` |
| **validación** | separa **error bloqueante** de **advertencia** y lo declara EN PANTALLA. Con error bloqueante no avanza. | código, contra `validationRules` |
| **normalización** | unidades a la escala del contrato, ejes a entidades conocidas, alias resueltos. **El mapeo lo PROPONE el modelo y lo CONFIRMA el humano** — nunca en silencio. | código + Haiku solo sobre encabezados |
| **fact pack** | el objeto que ADI lee. Determinístico: mismo archivo + mismo mapeo → mismo pack, byte a byte. | el mismo recorrido de `datoProyectado` |
| **versión activa** | una sola versión vigente por tenant. El pack anterior no se borra. | tabla `fact_pack_versions` |
| **conversación** | ADI responde sobre la versión activa; el notario verifica contra ESA versión. | sin cambios en el muro |

**Cada etapa es reversible y auditable.** Rollback = activar la versión anterior; no se recalcula nada.

---

## 2 · Contrato de ingesta

**2.1 Formatos.** `.xlsx`, `.xls`, `.csv`. El archivo se lee con librería (`xlsx`/`csv`), **jamás con un LLM**:
es caro y va contra la regla madre (el LLM propone, el motor calcula, el muro sella).

**2.2 Columnas obligatorias.** Por eje, y salen de `sourceManifest[].schema` — no de una lista nueva:

- venta comercial: identificador de entidad + venta del período. El resto (anterior, presupuesto, unidades,
  carga) es opcional y **su ausencia se declara**, no se rellena.
- inventario: SKU + capital + rotación + días de inventario + estado.

**2.3 Unidades.** El contrato ya las declara (`money(K)` vs money crudo). **Es la lección más cara del proyecto**
(miles vs dólares, CLAUDE.md §4): la unidad se DECLARA en el mapeo y se confirma; nunca se infiere del rango.

**2.4 Períodos.** Cada dataset declara su período y su tipo (foto vs acumulado). Dos períodos distintos son
**dos universos** y no se comparan sin decirlo — la maquinaria de universos ya existe y los veta.

**2.5 Ejes, métricas, estados, alias.** Ejes: cliente · SKU · bodega · punto de venta. Los estados **no se
importan como texto**: se derivan del umbral declarado por el cliente (piso de rotación, techo de días), igual
que hoy. Los alias son de ENTRADA (el usuario escribe como quiere) y nunca cambian el rótulo visible.

**2.6 Duplicados, faltantes, y el corte entre error y advertencia.**

| caso | veredicto | por qué |
|---|---|---|
| dos filas con la misma clave y distinto valor | 🔴 **bloqueante** | no hay forma de elegir sin inventar |
| columna obligatoria ausente | 🔴 **bloqueante** | el eje no existe |
| unidad no confirmada | 🔴 **bloqueante** | es el error de los miles otra vez |
| entidad sin mapear | 🔴 **bloqueante** para esa fila; la carga sigue con el resto, declarado |
| columna opcional ausente | 🟡 advertencia | se declara como límite: «este dato no tiene presupuesto» |
| celda vacía en fila válida | 🟡 advertencia | la fila entra sin esa métrica; ADI declina esa pregunta |
| valor fuera de rango razonable | 🟡 advertencia | se muestra para que el humano decida |

**Nada se corrige en silencio.** Un archivo se acepta con sus límites escritos, o no se acepta.

---

## 3 · Supabase y multi-cliente

Extiende el diseño ya escrito en `adi-identity-data-boundary-supabase` (tenants · memberships · invitations ·
conversations · access_audit). **Lo que agrega este frente:**

- `uploads` — archivo original, hash, quién lo subió, cuándo, estado del pipeline.
- `upload_rows` — el staging crudo.
- `upload_mappings` — el mapeo propuesto y **quién lo confirmó** (es evidencia, no configuración).
- `fact_pack_versions` — el pack generado, su versión, y cuál está ACTIVA. Append-only.

**`tenant_id` en todas.** RLS en todas: el aislamiento vive en la BASE DE DATOS, no en un `if` de JavaScript —
`assertTenantContext` depende de que el código no tenga un bug; RLS lo hace estructuralmente imposible.

**Rollback** = marcar activa la versión anterior. Una operación, sin recálculo, auditada.

---

## 4 · La evidencia que cada archivo debe producir

| campo | de dónde sale |
|---|---|
| `fact_id` | cifra + dueño + universo (hoy: `figs[]`) |
| `state_id` | estado derivado del umbral declarado (hoy: `estados[]`) |
| `calc_id` | solo cuando ADI calcula, con el contrato `[[CALCULO]]` que ya existe |
| dueño · métrica · unidad · período · universo | ya son campos del fact pack |
| **fuente** | archivo + hoja + fila. **Es lo único nuevo, y es lo que hace auditable una respuesta hasta la celda.** |
| **versión de carga** | qué pack la autorizó |

Con esos dos campos nuevos, una cifra en pantalla se rastrea hasta **la celda del Excel que la originó**.

---

## 5 · Integración con ADI (lo que NO cambia)

- ADI **no lee el archivo**. Lee el fact pack, igual que hoy lee `datoProyectado`.
- El notario verifica contra **la versión activa**, nunca contra memoria ni texto suelto.
- La conversación no cambia de forma: mismas reglas, mismo contrato de cálculo, mismos vetos.
- **Criterio de éxito del diseño:** si la ingesta está bien hecha, `guardC` no necesita una línea nueva.

---

## 6 · Pendientes que viajan a este frente

1. 🔴 **Causalidad sin respaldo** — abierto por decisión del owner (2026-08-16: no cerrarla sin más casos).
   Con datos reales el riesgo sube: el usuario va a preguntar «¿por qué cayó?» sobre su propio negocio.
2. 🟡 **Juicio asesor vs hecho** — cerrado en el muro (`juicio-sin-marcar`), pero su costo real está sin medir:
   35 de 46 textos guardados quedarían vetados. Medirlo en vivo antes de sumar carga de archivos.
3. 🟡 **Impacto seguro vs supuesto** — se separa bien hoy; con datos del cliente hay que sostenerlo.
4. **Estrategia de modelos** — ya resuelta y hay que respetarla: leer archivo = CÓDIGO (0 tokens) · mapear =
   HAIKU sobre encabezados y muestra (~500 tokens) · narrar = SONNET sobre el pack. Un Excel de 5.000 filas son
   ~100k tokens si se alimenta crudo, contra ~500 con este reparto.
5. **Observabilidad** — hoy **el repo no registra consumo**: no hay contador de llamadas, gasto, vetos ni
   reparaciones. Con clientes reales deja de ser tolerable. Es trabajo propio de este frente.

---

## 7 · Las cinco decisiones del owner — TOMADAS (2026-08-20)

Se traían como opciones y quedaron resueltas. **No se re-discuten; se implementan.**

**7.1 · La carga es de DOS tipos, con nombres distintos desde el principio.**

| tipo | qué hace | caso del owner | quién lo sube |
|---|---|---|---|
| **dato del negocio** | REEMPLAZA la versión activa del tenant. Queda versionado y con rollback. | el ERP mensual | **solo el administrador** del tenant |
| **archivo de referencia** | NUNCA reemplaza. Entra declarado como universo aparte y sirve para proyectar. | el Excel de precios del proveedor | **cualquier usuario** |

⚠️ **Corrección al diseño base:** §7.1 del borrador decía que el universo aparte se sella «como escenario».
**No.** El concepto de escenario se está eliminando de la superficie del producto (pendiente
`adi-colapsar-escenarios`, disparado porque «bonanza» se filtró a la guía de inicio). El universo aparte se
llama **archivo de referencia** y se sella con ese rótulo — no se reintroduce una palabra que se está sacando.

**7.2 · Quién sube: separado por tipo** (ver la tabla de 7.1). La proyección sobre un archivo de referencia
**no toca el dato de nadie más**: vive en la sesión de quien lo subió y no entra a la versión activa del tenant.
Es lo que sostiene la visión del owner («muchos serán gerentes») sin darle a un usuario la capacidad de cambiar
la base sobre la que ADI le responde a toda la empresa.

**7.3 · Conversación anterior: congelada y marcada.** Al activarse una carga nueva, los hilos anteriores quedan
**de solo lectura**, declaran en pantalla de qué carga son, y para continuar hay que volver a preguntar sobre la
versión vigente. **Ni se borran ni se recalculan** — recalcular sería reescribir lo que ADI ya dijo, y el usuario
ya decidió sobre eso.

**7.4 · Retención: archivo original 12 meses · versiones del pack, siempre.** El original es lo que permite
auditar una cifra hasta la celda; el pack pesa poco y no se descarta. Si un cliente se va, se borra todo a
pedido.

**7.5 · El orden: el canal primero, el mapeo en paralelo.**

- **Vía 1 — el canal (lo grande).** El servidor entrega el dato de UNA empresa por fetch autenticado; el
  navegador deja de recibir todos los tenants. Es el piso común del login, del aislamiento y de la carga.
- **Vía 2 — en paralelo, NO depende de la vía 1.** Leer el archivo con código, validarlo, y proponer el mapeo
  para confirmación humana. Es la parte novedosa del frente y la que conviene probar temprano; **no se rehace**
  cuando llegue el canal.
- **Lo que ESPERA al canal:** entregar el fact pack generado, la versión activa, y cualquier dato real de
  cliente. Ningún archivo de un cliente real entra antes de que la vía 1 esté cerrada.

---

## 8 · Lo que estas cinco decisiones dejan fijado (consecuencias, no opciones)

1. **Dos tipos de carga desde la primera migración.** `uploads.tipo ∈ {negocio, referencia}` nace con la tabla;
   no se agrega después. Reemplazo y referencia tienen permisos, ciclo de vida y visibilidad distintos.
2. **El archivo de referencia NO entra a `fact_pack_versions` activo.** Su proyección es por (tenant, usuario,
   sesión). Un gerente proyectando precios de proveedor no puede mover lo que ADI le responde a su jefe.
3. **Cada respuesta guardada lleva la versión que la produjo.** Es el campo «versión de carga» de §4, y es lo
   que hace posible el 7.3: sin él, «congelada y marcada» no se puede ni dibujar.
4. **El pack tiene que ser autosuficiente.** Como el archivo original se borra a los 12 meses y el pack vive
   para siempre, **el pack no puede depender del original para responder** — la fuente (archivo · hoja · fila)
   se guarda DENTRO del pack como texto, no como puntero a un archivo que puede no existir.
5. **El orden de trabajo queda declarado**: vía 1 y vía 2 avanzan a la par; nada de dato real cruza antes de
   que la vía 1 cierre.

---

## 9 · El plan de ejecución

Las cinco decisiones de arriba se convierten en trabajo en **`_FRENTE_DATOS_PLANO_VIAS.md`**: las dos vías
(seguridad/tenant e ingesta), qué se toca en cada paso, los tres candados que las prueban sin gastar
(`_bundle_sin_datos_gate`, `_tenant_gate`, `_ingesta_espejo_gate`) y el único punto donde hay gasto,
con su monto. Ahí también está la **medición** que ordena la prioridad: la fuga del bundle no es teórica —
se buscó en el paquete publicado y las filas de la segunda empresa están adentro.
