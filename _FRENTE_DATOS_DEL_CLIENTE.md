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

## 7 · Lo que decide el owner (no se asume)

1. **¿La carga reemplaza el dato del tenant o convive como universo aparte?** El caso que él describió
   (el Excel de precios del proveedor) es un universo APARTE sellado como escenario. Un ERP mensual es
   reemplazo. Probablemente hagan falta los dos, y hay que nombrarlos distinto desde el principio.
2. **¿Quién puede subir?** ¿Solo el administrador del tenant, o cualquier usuario?
3. **¿Qué pasa con la conversación anterior cuando cambia la versión activa?** Una respuesta de ayer citó
   cifras que hoy podrían no existir.
4. **Retención**: ¿cuánto se guardan los archivos originales y las versiones viejas?
5. **El orden**: ¿primero el aislamiento real (sacar los datos del bundle) o primero el pipeline sobre el
   tenant demo? El aislamiento es más grande y más riesgoso, y es previo al primer piloto real.
