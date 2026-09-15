# Notario semántico · propuesta de diseño (2026-09-15)

**Decisión del owner:** «Notario verifica la afirmación y su evidencia, no la redacción superficial con la que el modelo decidió
expresarla. Una afirmación relevante debe poder gobernarse por su significado: entidad/sujeto, métrica, valor o relación, universo,
período, orden/ranking y evidencia que la respalda. La prosa puede variar sin cambiar esa verdad.»

**Lo medido que obliga al cambio:** sobre los conjuntos con los que se desarrolló, el Notario actual da 100/100 (12 borradores reales)
y 0.1 % · 2.6 % (3.173 frases); sobre 1.159 frases y párrafos nuevos, 38.3 % de falsos positivos (49 % en párrafos de asesor) y 44.3 %
de falsos negativos. Cinco fases de cierres por familia no aplanaron la curva: la verificación por ventanas y patrones de palabras tiene un
techo estructural.

## 1. El principio, en una línea

**El modelo declara sus afirmaciones con su evidencia; el Notario verifica las afirmaciones contra el dato; la prosa queda libre.**

Hoy el Notario intenta hacer tres cosas a la vez sobre la prosa: (1) descubrir que hay una afirmación, (2) entender qué afirma,
(3) comprobarla. Las dos primeras son lingüística y ahí está el techo; la tercera es aritmética sobre un dato que ADI ya tiene
estructurado. El diseño separa las tres: el que escribe la afirmación (el modelo) es el que la declara; el Notario solo comprueba.

## 2. La afirmación declarada

Cada afirmación relevante de la respuesta se declara en una forma cerrada, con vocabulario de la boleta (no del modelo):

| Campo | Contenido | De dónde sale |
|---|---|---|
| `tipo` | `cifra` · `orden` · `relacion` · `grupo` · `conteo` · `variacion` · `estado` · `lectura` | catálogo cerrado |
| `sujeto` | la entidad (o lista, o «negocio») | nombres del tenant (ejes declarados) |
| `metrica` | el concepto, con el rótulo de la boleta | `label` de las figs (`Entidad · Concepto`) |
| `valor` / `relacion` | la cifra dicha, o la relación (máximo, puesto k, top-k, «el doble», fracción, mayor que B) | la afirmación |
| `universo` · `periodo` | «los 13 clientes», «5 cuentas materiales», «foto de hoy», «año cerrado» | `tipo.universo` / `tipo.periodo` / `cobertura` / `grupo` de la fig |
| `evidencia` | el/los rótulos de la boleta que la respaldan | la boleta que el modelo ya tiene en su contexto |
| `sello` (solo `lectura`) | `probado` · `indicado` · `abierto` · `criterio mío` | los sellos que ya publica `rolesCartera` |

Ejemplos, con la prosa que sea: «Jumbo … con más unidades y más contribución» → `{orden, Jumbo, Contribución, máximo, los 13
clientes}` → la boleta dice Falabella $4.3M → **falsa**. «Ese mismo grupo tiene markup promedio 41.4 %» → `{grupo, [Falabella, Lider,
Jumbo, Sodimac], Markup promedio, 41.4 %}` → el grupo del agregado son 8 → **falsa**. «Lider pesa más: 8.6 pp (peor que Falabella), … y
269 días de atraso» → `{cifra, Lider, Dias Vencido, 269 d}` → **verdadera**, diga lo que diga el paréntesis.

## 3. Qué reutiliza de ADI (casi todo)

- **La boleta es la evidencia estructurada.** Cada fig ya trae `label`, `unit`, `raw`, `canon`, `tipo` (universo, período, escenario,
  fuente, dimensión), `cobertura {alcance, n, m}`, `grupo {n, entidades}`, `formula`, `source`. No hay que inventar el modelo de datos:
  la afirmación se verifica contra esto.
- **La proyección del dato y los rankings** (`datoProyectado.rankings` por eje, con universo, dirección, polaridad y fórmulas; la
  cobranza, las unidades, la brecha y la no capturada ya declaradas) → verificación de `orden`, `conteo` y `universo`.
- **Los verificadores que ya son aritmética** (no lingüística): tolerancias de cifra y canon, signo y dirección de una variación,
  relación en palabras contra dos cifras, suma de un grupo, conteo «N de M», estados declarados, período y universo de una fig,
  la partición de la brecha. Se llaman con la afirmación estructurada en vez de con la prosa.
- **La doctrina del procedimiento** (`conclusiones(figs)`: prioridad oficial, subtotales, sellos) → las afirmaciones de `lectura`
  se comprueban contra ella (la conclusión es del procedimiento, no del narrador).
- **Las leyes de la casa** que juzgan la respuesta entera (intención inferida, densidad, juicio sin marcar, cobertura del encargo,
  prioridad del cierre, causalidad sin respaldo) quedan como están: no dependen de la forma de una frase.
- **La escalera del turno** (cierre → reparación → poda → respaldo), la multa al modelo y el rastro: sin cambios de forma; cambia
  el contenido de la multa (ver 4).
- **El lector de cláusula y los chequeos actuales** no se tiran: dejan de dictar veredictos y pasan a dos papeles donde su recall
  sirve y su imprecisión no cuesta: (a) detectar que en la prosa HAY una afirmación relevante sin declarar; (b) extractor de respaldo
  para la regresión offline de los tres corpus.
- **El respaldo** (composers deterministas) escribe desde las figs: sus afirmaciones se declaran nativamente al componer, y el
  mismo verificador las juzga — una regla, un archivo, los dos caminos.

## 4. Qué cambia en el flujo

1. **El modelo entrega dos cosas en la misma llamada:** la respuesta y, al final, un bloque cerrado con sus afirmaciones declaradas
   (formato fijo, una por línea; el bloque se quita antes de servir). No es una llamada más: es la misma escritura con su sello.
2. **`juzgar` cambia de fuente de verdad:** el veredicto de hecho sale de verificar cada afirmación declarada contra la boleta, la
   proyección y la doctrina. Tres resultados por afirmación: **verdadera**, **falsa** (con la verdad al lado) o **no verificable**
   (evidencia que no está en la boleta, universo o período no declarado).
3. **La cobertura de la declaración:** un detector de presencia (los chequeos actuales, usados solo para «acá hay una cifra / un
   orden / un grupo / un conteo») exige que toda afirmación relevante de la prosa esté declarada. Lo no declarado no se sirve como
   verdadero: vuelve al modelo como «declara o quita». Esto cierra la puerta a mentir por omisión.
4. **La multa es exacta:** «Declaraste Jumbo · Contribución · máximo; la boleta: Falabella $4.3M, Jumbo $4.2M». El modelo repara la
   afirmación, no adivina qué frase molestó. Menos reparaciones fallidas, menos caídas al respaldo.
5. **Lo no verificable no se vuelve verdadero:** una afirmación sin evidencia en la boleta se sirve solo reescrita como `lectura` con
   sello (`indicado` / `abierto` / `criterio mío`) o se quita; nunca como hecho.
6. **La forma no cambia el veredicto:** el veredicto depende de la afirmación declarada, no de la frase. Dos redacciones de la misma
   afirmación reciben el mismo veredicto por construcción.

## 5. Los cinco guardrails del owner, uno por uno

| Guardrail | Cómo lo cumple el diseño |
|---|---|
| Una afirmación falsa conocida no se sirve | toda afirmación relevante se declara y se verifica contra el dato; la no declarada se detecta por presencia y vuelve al modelo |
| Lo no verificable no se vuelve verdadero | resultado explícito «no verificable» → solo se sirve como lectura sellada o se quita |
| Cambiar la forma no cambia el veredicto | el veredicto es función de la afirmación estructurada, no de la prosa |
| La respuesta premium no cae al respaldo por frases correctas | las afirmaciones correctas se verifican como verdaderas con cualquier redacción; desaparece la fuente de los falsos positivos |
| Regresión sobre los tres corpus, certificación siempre fuera de muestra | los corpus se juzgan offline con el extractor de respaldo (cota inferior conocida); la certificación es en vivo, con prompts nuevos, midiendo omisiones y veredictos |

**Riesgo residual y su medida:** el modelo puede omitir o declarar mal una afirmación. Se mide en certificación con un extractor
independiente (una llamada aparte, solo en certificación) que compara lo declarado con lo que la prosa afirma; la tasa de omisión es
la métrica nueva, con meta propia (≤ 5 %). En producción, la detección de presencia es la red.

## 6. Costo y latencia (estimación, a confirmar en la fase de certificación)

- **Llamadas por turno:** las mismas (cierre + una reparación cuando hace falta). La declaración va en la misma llamada.
- **Tokens:** +20 a 40 % de salida en el cierre (30-50 afirmaciones compactas para una respuesta de 700 palabras ≈ 1.500-2.500
  tokens); la entrada no cambia (la boleta ya viaja). Latencia estimada: +3 a 6 s por llamada de cierre.
- **Ahorro esperado:** menos reparaciones inútiles (la multa es exacta) y muchas menos caídas al respaldo: hoy 7 de 10 borradores
  cayeron por falsos positivos, cada uno con su reparación pagada. Neto por turno: igual o menor que hoy.
- **Certificación:** una llamada extra por respuesta (el extractor independiente), solo en corridas autorizadas.
- **CPU:** la verificación es aritmética sobre la boleta: milisegundos.

## 7. Plan por fases (nada en vivo hasta la fase 3)

1. **Verificador y esquema (offline, sin llamadas):** `src/adi/notario/afirmacion.js` (el esquema y su validación) y
   `verificarAfirmaciones(afirmaciones, {ledger, datoProyectado, doctrina})` reutilizando los verificadores aritméticos existentes.
   Medida: las afirmaciones de los 12 borradores reales, declaradas a mano como fixture, con veredicto 100 % correcto; y el candado
   de forma: la misma afirmación en tres redacciones distintas → el mismo veredicto.
2. **El flujo (offline, cerebro mudo):** el bloque de declaración en el system y su parseo; `juzgar` sobre afirmaciones; el detector
   de presencia como cobertura; la multa exacta; los composers del respaldo declarando lo suyo; los chequeos de forma retirados del
   veredicto. Los tres corpus como regresión con el extractor de respaldo. Suite verde.
3. **Certificación en vivo (con tu autorización de gasto, nombrada):** un conjunto NUEVO de prompts (no los dos de siempre), una corrida
   cada uno; métricas: omisión de declaración, falsos positivos y negativos sobre lo servido, caídas al respaldo, costo y latencia por
   turno. Meta: ≤ 5 % · ≤ 5 % · ≤ 5 % de omisión · la respuesta premium servida en ≥ 90 % de los turnos.
4. Recién ahí: las dos pruebas finales de siempre y la decisión de deploy de la v2.31.

Estimación de esfuerzo: fases 1-2 en dos o tres sesiones de trabajo (con ultracode, un día); fase 3 depende del gasto que autorices
(del orden de 10-15 llamadas de cierre + 10-15 de extractor).
