# EL DIARIO DE LA RELACIÓN · diseño para decisión del owner (2026-09-03)

**Qué es.** Hoy ADI recuerda dentro de una conversación (el hilo, la memoria de criterio, el trato «jc») y
el vigía recuerda una sola cosa entre sesiones (qué focos ya mostró, en este navegador). El diario es la
memoria **entre sesiones y con contenido**: qué le preocupa a este usuario, qué decidió, qué prometió ADI
vigilar. Es lo que convierte «un asesor que responde bien» en «MI asesor, que sabe dónde íbamos».

**Qué NO es.** No es un log de conversaciones (eso es vigilancia, no relación), no es una segunda base de
datos del negocio (el dato ya tiene su dueño), y no es un cuaderno del modelo (el modelo no escribe libre:
escribiría inventos con tinta permanente).

**Estado: SOLO DISEÑO.** Nada de esto está construido. El owner decide sobre este documento.

---

## 1 · Qué se guarda — y la regla que manda

**La regla de oro: al diario solo entra lo que pasó por un turno VERIFICADO.** La memoria no puede contener
inventos: si una cifra o un hecho no sobrevivió al muro en su momento, no existe para el diario. Cada
entrada lleva su fecha y su origen (qué turno la produjo).

Las **cuatro familias** de entradas, de menor a mayor riesgo:

| Familia | Ejemplo | De dónde sale | Riesgo |
|---|---|---|---|
| **Preferencias declaradas** | «llámame jc» · «mi benchmark es 25%» | el usuario lo DIJO (trato · memoria de criterio — ya existen en el motor, hoy sin persistencia entre sesiones en servidor) | mínimo: es literal |
| **Focos que ADI mostró** | «el 2026-09-03 vio la brecha de margen (5,0 pp) y el capital frenado» | la huella del vigía + la síntesis servida (turnos verificados) | bajo: son cifras selladas con fecha |
| **Decisiones del usuario** | «dijo que primero ataca la carga de Falabella» | el usuario lo escribió en un turno; se guarda COMO CITA, con fecha | medio: hay que citarlo, no resumirlo |
| **Promesas de vigilancia** | «pidió que le avise si Lider sigue cayendo» | el usuario lo pidió explícito | medio: una promesa guardada obliga — ver §6 |

**Formato de cada entrada:** `{ fecha, tipo, texto (cita o cifra sellada), origen (id del turno) }`. Texto
corto, verificable, con dueño. **Nunca prosa libre del modelo.**

## 2 · Qué NO se guarda jamás

- **Nada que el muro no haya aprobado.** Un borrador vetado, una reparación, un rescate: no existen.
- **Causas.** El diario hereda la regla 2: localiza, no explica. «Le preocupa el margen» sí (lo dijo);
  «el margen le preocupa porque su socio lo presiona» jamás (nadie lo midió).
- **Conversación cruda.** Ni transcripciones ni resúmenes del hilo completo. Entradas puntuales o nada.
- **Datos personales más allá del trato.** El nombre que pidió («jc») sí; correos, teléfonos, terceros, no.
- **Nada de otro tenant.** Obvio y aun así se escribe: el diario ni siquiera puede LEER fuera de su tenant.
- **Estados de ánimo inferidos.** «Estaba molesto» es diagnóstico de persona, no de negocio. Fuera.

## 3 · Dónde vive

**Per-tenant, en el servidor, detrás del mismo muro de identidad que el dato.** La razón: la relación es
con la EMPRESA que carga su dato, no con un navegador. El trato «jc» hoy vive en localStorage y se pierde
al cambiar de máquina — el diario que valga la pena tiene que seguir al usuario.

- Misma puerta que ya existe para escribir política del lado del servidor (el precedente es el plazo de
  pago: `op: "plazos"` en `/api/adi-ingesta`, con `access`). El diario sería otra `op` de la misma puerta,
  con el mismo control de acceso. **Ninguna puerta nueva.**
- El dataset no se toca: el diario es un objeto aparte del pack (`perfil.diario` o colección propia — la
  decisión fina es de implementación, no de este documento).
- **Tope duro de tamaño** (p. ej. 50 entradas): un diario infinito es un log con otro nombre. Al llegar al
  tope, las más viejas de la familia menos valiosa salen primero (preferencias nunca salen solas: las
  renueva el uso).

## 4 · Cómo se usa al saludar — y la política de silencio

El diario alimenta **el primer turno**, no todos: el saludo puede nombrar dónde quedamos y qué cambió
desde entonces. Después de eso, el diario calla y el turno manda (si el usuario pregunta otra cosa, ADI
responde otra cosa — el diario no secuestra la conversación).

La política hereda la del vigía, ya aprobada: **hablar solo cuando hay algo** (una promesa pendiente, un
foco que cambió desde la última visita, una decisión con novedad). Un saludo con memoria vacía es un
saludo normal — jamás «no tengo nada guardado sobre ti».

### Los 3 ejemplos (con diario vs sin)

**Caso 1 — el usuario vuelve a los 4 días; había decidido atacar la carga de Falabella.**
> **Sin diario:** «Hola. ¿Qué quieres mirar hoy?»
> **Con diario:** «Hola jc. La última vez decidiste empezar por la carga de Falabella ($194K sobre el
> target). Sigue en el mismo nivel en tu dato actual. ¿Retomamos ahí o vemos otra cosa?»

**Caso 2 — pidió que ADI vigilara a Lider; Lider se recuperó.**
> **Sin diario:** (nada — nadie recuerda la promesa)
> **Con diario:** «jc, me pediste seguir a Lider: en el dato que cargaste hoy ya no está bajo tu
> benchmark. Esa vigilancia queda cerrada — dime si quieres que siga a alguien más.»

**Caso 3 — primera visita de la semana, sin promesas ni decisiones pendientes, focos iguales.**
> **Sin diario:** «Hola. ¿Qué quieres mirar hoy?»
> **Con diario:** «Hola jc. ¿Qué quieres mirar hoy?» — *el diario aporta EL NOMBRE y nada más. El silencio
> es la respuesta correcta cuando no hay novedad: esa es la diferencia entre memoria y muletilla.*

## 5 · Cómo se borra — el usuario manda sobre su memoria

- **Ver:** «¿qué recuerdas de mí?» lista las entradas tal cual, con fecha — sin maquillaje. Es SU diario.
- **Borrar una:** «olvida lo de Falabella» borra esa entrada y ADI lo confirma en una línea.
- **Borrar todo:** «olvida todo lo que sabes de mí» vacía el diario, confirmación mediante. Sin recuperación
  y se dice («borrado; no lo puedo deshacer»).
- **El borrado es del servidor**, no cosmético: borrar = borrar. Y una carga nueva del dato NO resucita
  entradas borradas.
- Lo que el usuario dicta («recuerda que…») entra por la familia de preferencias con la misma puerta que
  la memoria de criterio de hoy — el mismísimo detector, extendido, no uno nuevo.

## 6 · Los grises que el owner tiene que decidir (no los decido yo)

1. **¿Las promesas de vigilancia obligan?** «Avísame si Lider sigue cayendo» guardado crea la expectativa
   de que ADI avise SOLO. Hoy ADI no corre sin que lo abran (no hay backend activo mirando el dato). La
   opción honesta v1: la promesa se revisa AL ABRIR (como el caso 2). La opción fuerte (notificar afuera
   de la app) es otra liga — correo, jobs — y va aparte si algún día se quiere.
2. **¿El saludo con diario gasta?** El caso 1/2 son componibles determinísticos (cita + cifra sellada del
   dato de hoy): **$0, sin modelo**, mismo patrón del vigía. Si el owner quiere que el saludo suene menos
   armado, UNA llamada con el muro encima — decisión aparte, como la prosa variable del vigía.
3. **¿Quién es «el usuario» dentro de un tenant?** Hoy un tenant = un acceso. Si mañana hay varios
   usuarios por empresa, el diario es POR PERSONA (el trato y las decisiones no se comparten) — y eso
   exige identidad por persona, que hoy no existe. v1 honesta: diario por tenant, dicho tal cual.
4. **El tope y la poda del diario** (§3): ¿50 entradas está bien? ¿Las decisiones viejas expiran (p. ej.
   90 días) o quedan hasta que el usuario las borre?

## 7 · Orden de construcción propuesto (cuando el owner dé luz verde)

1. **Persistir lo que ya existe y hoy se pierde** (el trato + la memoria de criterio, al servidor): valor
   inmediato, cero concepto nuevo, y estrena la puerta y el borrado.
2. Los focos vistos del vigía (mover la huella del navegador al diario — el vigía deja de ser amnésico
   entre máquinas).
3. Decisiones y promesas (las familias con cita), con «¿qué recuerdas de mí?» y el borrado completo.
4. El saludo (caso 1/2/3), determinístico, con su gate y sus carnadas (el saludo que inventa → ROJO; el
   que habla sin novedad → ROJO — las mismas dos del vigía, en su versión de diario).

*Cada paso con su gate antes de pasar al siguiente; el 1 solo ya paga el proyecto.*
