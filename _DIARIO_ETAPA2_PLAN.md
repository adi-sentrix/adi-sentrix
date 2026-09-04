# DIARIO · ETAPA 2 — LA MEMORIA ENTRE SESIONES · plan para decisión (2026-09-05)

**El valor que el owner nombró:** que ADI llegue el lunes recordando la tesis del jueves y las respuestas
de intención del dueño («el volumen de Falabella es apuesta mía»), y que confirme o corrija en voz alta
**re-midiendo** — jamás repitiendo de memoria. Hoy la tesis vive en `mem` del hilo: cerrar el chat la borra.

**Estado: SOLO PLAN.** Nada implementado. Extiende `_DIARIO_DISENO.md` (aprobado como diseño el 03) — esta
etapa es su paso «tesis + intenciones»; el saludo con diario, los focos del vigía y las promesas siguen
siendo etapas posteriores.

---

## 1 · La puerta — ninguna nueva, y de qué depende

**El precedente exacto es el plazo de cobro** (la 006): política que vive DENTRO de la versión activa del
pack (`perfil.cobro`), escrita por `op:"plazos"` en `/api/adi-ingesta` con sesión firmada
(`sesionDeLaCarga(access)` → `tenantId + actor`), arrastrada a la versión siguiente en `persistirCarga`,
y con la razón del owner escrita en la migración: el pack es autosuficiente para siempre.

**Propuesta: el diario es `perfil.diario`, misma vía.**
- Una `op:"diario"` en la MISMA puerta (`accion: "guardar" | "olvidar"`), misma sesión, misma firma de actor.
- Una migración **007_diario.sql** con el patrón calcado de la 006: RPC idempotente que escribe
  `perfil.diario` en la versión ACTIVA (append-only intacto: lo inmutable es el hecho, no la relación con
  la que se lee — la doctrina de la 004/006). El arrastre entre versiones reutiliza el de `persistirCarga`.
- **La lectura no agrega NI UN fetch**: `perfil.diario` viaja dentro del pack que `/api/adi-data` ya sirve.
  ChatADI siembra `mem.diarioTesis`/`mem.intenciones` al armar el contexto — el motor del hilo ya sabe
  usarlas (el seguimiento re-mide contra la huella; eso NO cambia).
- **El muro**: el que ya existe — la sesión resuelve el tenant en el servidor; el gate nuevo lo prueba
  ATACÁNDOLO (el patrón de `_plazo_de_pago_gate`): sesión de la empresa B pidiendo/escribiendo el diario de
  A → rechazo. La memoria de un tenant jamás se lee desde otro.

**⚠️ LA DEPENDENCIA, sin vueltas:** la 007 va DESPUÉS de la 006, que va después de la **005 — que el frente
de datos declaró NO corrida**. Eso significa que TODO el canal servidor (los plazos incluidos) está sin
estrenar en la base real. **Blocker del owner, no nuestro:** correr `005 → 006 → 007` en el SQL Editor
(idempotentes, en orden, ~2 minutos). El código y sus gates se construyen y verifican OFFLINE con la RPC
mockeada (como ya se hace con plazos); la prueba en vivo espera esas migraciones.

## 2 · Qué persiste — mínimo y honesto (v1)

Dos cosas, y nada más:

| pieza | forma | regla |
|---|---|---|
| **La tesis** (0..1 por clave; v1 = solo `margen-roles`) | `{ clave, resumen, huella {caen, grandesQueCaen, mismaGente}, fecha, carga (hash/versión del pack), origenTurno }` | el `resumen` es el texto VERIFICADO que el muro aprobó (la regla de oro del diseño); la `huella` es la medición — confirmar será siempre re-medir contra ella |
| **Las intenciones del dueño** (0..N, tope 10) | `{ cita, preguntaQueRespondia, entidad, fecha, origenTurno }` | **CITA literal del usuario, jamás un resumen del modelo** |

**Hallazgo del diseño que esta etapa tiene que cerrar:** hoy NADIE captura la respuesta de intención —
`rolesCartera` emite `preguntaAlDueno` («¿el volumen de Falabella es una apuesta tuya…?») y ahí muere. El
capturador nuevo es ANGOSTO: solo se guarda cuando (a) el turno anterior del asistente emitió la pregunta,
y (b) el usuario responde afirmando o nombrando la entidad («es apuesta mía», «sí, lo decidí yo»). Ante la
duda, no se guarda. Se guarda SU frase, textual.

## 3 · La caducidad — una tesis vieja no se afirma

- La tesis lleva **la carga con la que se midió** (hash/versión del pack — el sello que ya existe).
- **Misma carga** → «esto confirma la lectura que guardamos el {fecha}: …» — y la huella se RE-MIDE igual
  (la conducta ya existe en el seguimiento; el diario solo la alimenta al abrir).
- **Otra carga** (planilla nueva) → la tesis se presenta como de la carga anterior y se re-mide contra la
  nueva; si la huella difiere: «la lectura cambió respecto de lo que vimos (antes: …) — lo corrijo con el
  dato de hoy» (la frase ya existe en el composer).
- **Regla propuesta al owner:** una tesis con **más de 30 días** sin re-confirmarse no se afirma — se
  ofrece: «¿retomamos la lectura del margen que dejamos el 4/9?». El número (30) lo decide él.
- Invariante de todas las ramas: **nada guardado se afirma sin re-medir en el turno.** La huella es la voz.

## 4 · Qué ve el usuario — y cómo se olvida

- **Sin saludo nuevo** (recomendación): el saludo con diario es la etapa del diseño grande y otra decisión.
  La memoria habla SOLO cuando el tema la toca: el primer turno de margen/seguimiento del hilo abre con UNA
  línea («Esto confirma la lectura que guardamos el jueves…» o su corrección). Al GUARDAR, también una
  línea, para que no sea memoria secreta: «(me guardo esta lectura para la próxima)».
- **El olvido es de v1, no opcional** (con persistencia real, «cerrar el chat» ya no borra): «olvida lo que
  guardaste del margen» / «olvida esa intención» / «olvida todo lo que guardaste» → extensión del MISMO
  bypass de criterio (su detector ya maneja el forget; cero detector nuevo) → `op:"diario"` con
  `accion:"olvidar"`. **Borrar = borrar en el servidor**, confirmado en una línea, y una carga nueva no
  resucita lo borrado (el arrastre arrastra el objeto ya borrado — el mecanismo de cobro).
- «¿Qué recuerdas de mí?» lista tesis e intenciones tal cual, con fecha (ya estaba en el diseño §5).

## 5 · Los grises del §6, con la opción conservadora para decidir de una vez

| gris | opción conservadora (recomendada) | la otra opción |
|---|---|---|
| ¿Las promesas de vigilancia obligan? | **FUERA de v1.** Cuando entren (etapa 3): se revisan AL ABRIR, jamás notificación externa | notificar afuera de la app = correo/jobs, otra liga |
| ¿El saludo/las líneas de memoria gastan? | **$0 — todo determinístico** (cita + huella re-medida), patrón vigía | prosa con modelo: NI se propone en v1 |
| ¿Quién es «el usuario» dentro del tenant? | **v1 = diario POR TENANT**, dicho tal cual («esto lo recuerdo de esta empresa») | por persona: espera memberships del boundary Supabase — diseñado allá, no se duplica acá |
| Tope y expiración | **1 tesis por clave · 10 intenciones · sin expiración automática** (la tesis vieja no afirma — §3; el usuario borra) | expiración dura a N días |

## 6 · Cómo se verifica

**Offline (cero gasto, todo antes de tocar la base):** gate nuevo `_diario_persistente_gate` —
(a) el capturador de intención con sus NEGATIVOS (una respuesta que no responde la pregunta emitida → no se
guarda; un turno sin pregunta previa → no se guarda); (b) round-trip con la RPC mockeada
(guardar → leer → mem → la línea de confirmación); (c) **el muro atacado**: sesión del tenant B contra el
diario de A → rechazo (el patrón del gate de plazos); (d) caducidad: tesis de carga vieja → se re-mide y
corrige, jamás se afirma; (e) carnadas: el capturador ancho que guarda un resumen del modelo → ROJO · el
diario que afirma sin re-medir → ROJO · el «olvidar» que no borra → ROJO.

**En vivo, lo que exige del owner (~5 minutos, sin gasto de modelo — todo es determinístico):**
1. SQL Editor: correr `005 → 006 → 007` en orden (idempotentes).
2. En su chat real: preguntar el porqué del margen (ADI guarda la tesis y lo dice en una línea) y responder
   la pregunta del dueño («el volumen de Falabella es apuesta mía»).
3. Cerrar el chat. Reabrir. «¿Cambia tu lectura?» → debe abrir «esto confirma la lectura que guardamos
   hoy…» y recordar su intención como cita.
4. «Olvida lo que guardaste del margen» → confirmación; repreguntar → ya no lo recuerda.

## 7 · Viabilidad esta semana — la respuesta directa

**El código y sus gates: SÍ** — la puerta existe, el patrón (006) existe, el motor del hilo ya re-mide; lo
nuevo es una RPC calcada, una `op`, el capturador angosto, la siembra de `mem` al abrir y el olvido.
**La prueba en vivo: depende SOLO de las migraciones** (005 pendiente → blocker del owner, declarado).
Y la línea roja que pediste explícita: **si el owner prefiere no correr migraciones aún, NO hay v1 en
localStorage** — una memoria que promete recordar y vive en un navegador es exactamente la promesa rota
que él nombró. En ese caso este frente espera, y lo que se puede adelantar sin promesa es solo el
capturador de intención alimentando el `mem` del hilo (que muere al cerrar, como hoy, y se dice).
