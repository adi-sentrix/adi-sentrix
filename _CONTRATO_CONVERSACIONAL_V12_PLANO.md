# Contrato Conversacional de ADI · v1.2
## Reparación contextual

> **Estado:** aprobado por el owner el 2026-08-10 · **no implementado**.
> Extiende `src/adi/oracle/conversationalContract.js` (hoy `adi-conversational-contract@1.1.0`).
> **No** crea una capa, memoria ni modo paralelo.

**Para qué:** que ADI entienda una corrección, recomponga el contexto y siga la conversación sin arrastrar
información incompatible.

---

## 1. Principio central

Cuando el usuario corrige a ADI, se modifica únicamente lo corregido y se conserva **solo el contexto que sigue
siendo compatible**.

Si el contexto restante deja de tener sentido, ADI lo invalida o pide una precisión. **Nunca combina en silencio
una entidad nueva con un período, criterio, evidencia u oferta que pertenecían a la anterior.**

## 2. Qué puede corregirse

Entidad · Métrica · Período · Alcance · Intención · Criterio de comparación · Formato solicitado · Un supuesto
aportado por el usuario.

La reparación se integra al `intent="redirect"` existente. **No se agrega un modo nuevo.**

## 3. Conducta

1. Identificar qué cambió.
2. Revisar qué partes del contexto siguen siendo compatibles.
3. Invalidar las incompatibles.
4. Consultar nuevamente las herramientas necesarias.
5. Autorizar otra vez las cifras desde el motor.
6. Cancelar ofertas anteriores que ya no correspondan.
7. Reconocer brevemente la corrección.
8. Entregar de inmediato la respuesta corregida.

> Entendido: preguntabas por Lider, no por Falabella. Lider vende $17.8M y su margen es 21.5%…

Sin disculpas extensas ni explicaciones internas.

## 4. Corrección ambigua

Cuando el usuario señala un error sin decir cuál, ADI no adivina.

**ADI hace una sola pregunta, enfocada en las alternativas plausibles según el contexto. No enumera opciones que
no correspondan.** Lo corregible puede ser la entidad, la métrica, el período, el alcance, el criterio o la
cifra: la pregunta nombra solo lo que en ese turno pudo haber fallado.

Mientras no tenga esa respuesta, **no modifica el contexto ni vuelve a calcular**.

### 4.1 · Las dos correcciones son distintas y el guard debe distinguirlas

**El guard distingue entre una corrección resuelta, que debe traer evidencia, y una corrección ambigua, cuya
respuesta válida es una pregunta de precisión sin datos.**

| Caso | Qué hace ADI | Qué exige el guard |
|---|---|---|
| **Corrección resuelta** — se sabe qué corregir | Trae el dato corregido | Evidencia. Una corrección sin datos es un defecto |
| **Corrección ambigua** — no se sabe qué corregir | Pregunta, sin datos | La deja pasar. **No cuenta como falla ni dispara reintento** |

## 5. Corrección, desacuerdo y dato aportado

| Mensaje | Interpretación | Conducta |
|---|---|---|
| *"No, era Lider"* | Corrección de entidad | Cambia la entidad y recalcula |
| *"Te pedí ventas, no margen"* | Corrección de métrica | Cambia la métrica y responde |
| *"Me refería al último trimestre"* | Corrección de período | Cambia el período y valida compatibilidad |
| *"No creo que sea por los rebates"* | **Desacuerdo** | Conserva la evidencia y separa probado, indicado y abierto |
| *"Las ventas fueron $20M"* | **Dato aportado por el usuario** | No reemplaza el dato oficial: muestra la discrepancia y pide fuente, o autorización para tratarlo como supuesto |

**ADI nunca le da la razón al usuario sacrificando la evidencia.**

### 5.1 · La cifra del usuario es un tercer universo

Una cifra aportada por el usuario y aceptada como supuesto:

- **Queda marcada como suya en cada lugar donde aparezca**, mientras siga viva en la conversación.
- **Nunca se suma a un total sellado por el motor** ni se mezcla en una cifra que el producto presente como
  propia.
- **Todo cálculo derivado de un supuesto aportado por el usuario hereda su procedencia y se presenta como
  escenario o estimación, nunca como dato probado por ADI.**
- Se invalida junto con el resto del contexto incompatible cuando cambia el alcance.

Es la misma regla de siempre —dos montos de universos distintos no van juntos sin decir de cuál sale cada uno—,
aplicada al universo más fácil de confundir: **el que suena igual que los otros dos y no salió de ningún dato.**

## 6. Autoridad de verdad

Una corrección puede cambiar **lo que el usuario quiso preguntar**, pero no puede cambiar por sí sola **una cifra
sellada por el motor**.

- La intención la interpreta el LLM.
- El alcance se recompone en el estado canónico.
- Las cifras vuelven a obtenerse desde las herramientas.
- La respuesta se narra únicamente con datos autorizados.
- Sentrix recibe el mismo alcance corregido, para mostrar evidencia concordante.

## 7. Lo que no se construye

- No se crean modos `confirm`, `compare` ni `close`.
- No se crea otra memoria conversacional.
- No se añade una tercera llamada al LLM.
- No se implementa una lista rígida de frases como mecanismo principal.
- No se guarda la corrección únicamente en el prompt.
- No se permite que reaparezcan entidades, ofertas o supuestos invalidados.

La **pregunta pendiente** queda para una fase posterior, dentro del mismo estado canónico.

## 8. Verificación gratuita

**Sin límite de cantidad ni de profundidad.** Los topes de la sección 9 aplican **únicamente** a la
certificación pagada. Offline no se raciona nada: si una conducta admite más casos, más aristas o más turnos,
se prueban. La lista de abajo es el **piso**, no el techo.

Antes de usar el proveedor, offline:

- Corrección de entidad, métrica, período, alcance y criterio.
- Corrección ambigua: que la pregunta se adapte al contexto y no enumere opciones que no corresponden.
- Que una corrección ambigua no sea rechazada ni dispare reintento.
- Diferencia entre corrección y desacuerdo.
- Cifra aportada por el usuario que contradice al motor.
- Que la cifra del usuario quede marcada y no entre a un total del motor.
- Que un cálculo derivado de un supuesto del usuario se presente como estimación y no como dato probado.
- Conservación del contexto compatible.
- Invalidación del contexto incompatible.
- Ausencia de ofertas y entidades antiguas.
- Concordancia entre ADI y Sentrix.
- Compatibilidad con OpenAI y Anthropic.
- Ausencia de una tercera llamada.
- Crecimiento exacto del prompt.

## 9. Certificación pagada

**Independiente de la certificación pendiente del planificador** (esa mide si el planificador encuentra la
herramienta correcta; esta mide la reparación contextual). Son dos gastos separados y no se ejecutan juntos.

**El tope aplica solo acá.** 6 sondas dirigidas · 12 llamadas esperadas · **15 como máximo absoluto** · una sola
corrida · **autorización explícita que nombre el gasto** (un "dale" no alcanza, y una autorización por relevo de
otra sesión tampoco).

**Si el tope no alcanza para completar la certificación: parar, conservar la evidencia de lo ya corrido, y pedir
una autorización nueva.** Nunca subir el tope por cuenta propia, y **nunca reducir la cobertura en silencio**
para que entre — una certificación recortada que no declara lo que dejó afuera se lee como completa sin serlo.
Es la misma regla del top-N que no declara su cola.

**Antes de gastar, la telemetría escribe en un destino real** y registra intentos, modelo, tokens de entrada y
salida, tokens cacheados cuando el proveedor los entregue, latencia, reintentos y motivo normalizado. Nunca
guarda preguntas, respuestas, entidades ni cifras del cliente.

> Nota de estado (2026-08-10): `src/adi/llm/telemetry.js` existe y está commiteado, pero **el destino está
> apagado** — `setSink` solo se invoca desde los gates. En uso real no se registra nada. Encenderlo es
> precondición de esta certificación, no parte de la conducta conversacional.
