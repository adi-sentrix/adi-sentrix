# Brief · los composers declaran lo que escriben (Notario semántico, fase 2 · 2026-09-15)

## Qué es esto
ADI verifica hoy las respuestas con un **Notario semántico**: el que escribe DECLARA cada afirmación de hecho (cifra, orden, relación,
grupo, conteo, variación, estado) en una forma cerrada, y el verificador la juzga contra la boleta y la proyección del dato. El cerebro
(el modelo) lo hace en su salida. Los **composers determinísticos** (playbooks, ensamblador del encargo, prioridad integrada) escriben
desde figs y tienen que declarar con el MISMO estándar, sin camino privilegiado: por eso reciben un colector `declarar` y declaran
MIENTRAS escriben cada línea.

Tu trabajo: instrumentar el/los composer(s) que se te asignan para que declaren TODO lo que afirman, **sin cambiar ni un byte del texto
que producen**.

## Reglas duras (guardrails del proyecto — no negociables)
- **Cero llamadas a modelos ni red.** No ejecutes `npm run gates`, ningún `_*_gate.mjs` suelto, nada que toque OpenAI/Anthropic/gateway.
  La única herramienta que corres es `node _verificar_composer.mjs …` (offline, sin red).
- No toques `src/adi/llm/numberGuard.js`, `src/adi/llm/entityGuard.js`, `_guard_gate.mjs`. No uses `git add -A` ni `git commit -a`.
- **El texto compuesto queda byte-idéntico.** Solo se AGREGAN llamadas al colector; no se cambia una coma de lo que se escribe. La
  herramienta lo verifica («byte-idéntico con colector: SÍ»).
- Español, registro formal. Comentarios en el estilo del archivo (por qué, no qué).

## El colector (`src/adi/notario/declarar.js`)
En el composer: `import { declaradorDe } from "../../notario/declarar.js";` (desde `playbooks/`; desde `src/adi/agente/` es
`"../notario/declarar.js"`). Al principio de `componer({ figs, …, declarar })`: `const D = declaradorDe(declarar);` — sin colector,
`D` es mudo y todo queda como estaba. Métodos (todos reciben `texto`: la LÍNEA o el tramo tal como se escribió, literal):

- `D.cifra({ sujeto, metrica, valor, texto, universo?, periodo? })` — `sujeto`: el nombre exacto de la entidad (o `"negocio"` para un
  total del negocio); `metrica`: el concepto del rótulo de la fig (lo que sigue a «Entidad · »: `"Venta"`, `"Contribución no
  capturada"`, `"Brecha al benchmark"`, `"Capital frenado"`, `"Saldo vencido"`, `"Dias Vencido"`…); `valor`: la cifra tal como se
  imprimió. `universo` obligatorio si la cifra es un subtotal/agregado («las 5 cuentas materiales»).
- `D.deFig(fig, texto, extra?)` — atajo: cifra desde una fig de la boleta (sujeto y métrica salen del rótulo).
- `D.orden({ sujeto, metrica, forma, k?, direccion?, vs?, universo, texto })` — `forma`: `max` | `min` | `puesto` (con `k`) | `topk`
  (con `k`; `sujeto` = la LISTA de los k) | `comparativo` (con `vs`); `direccion`: `mayor` | `menor` | `peor` | `mejor`; `universo`
  obligatorio salvo comparativo («los 13 clientes», «los 13 SKU», «las 4 bodegas», «los SKU frenados», «las 5 cuentas materiales»).
  Una lista impresa «los N que más X» ES un orden top-k: se declara con los N nombres.
- `D.relacion({ sujeto, metrica, forma, k?, matiz?, vs, valor?, texto })` — `forma`: `veces` (k×) | `fraccion` (parte de un todo; con
  `valor` en % o `k`) | `parte` (A es parte de B, sin cociente) | `mayor` | `menor` | `diferencia` (con `valor`); `vs`: la otra entidad,
  `"negocio"`, o `{ sujeto, metrica }` si la métrica del otro lado es otra.
- `D.grupo({ sujeto: [lista completa], metrica, valor, universo?, texto })` — una cifra agregada (suma, promedio, participación) de un
  conjunto entero.
- `D.conteo({ n, m?, predicado, universo, sujeto?, texto })` — «N de M que cumplen P»; `predicado` con las palabras del rótulo de la
  boleta («bajo el benchmark», «materiales», «frenados», «erosión por acciones comerciales»…); `universo`: de qué conjunto («los 13
  clientes», «los 13 SKU»); si la línea enumera a los contados, `sujeto` = la lista.
- `D.variacion({ sujeto, metrica, direccion, valor?, periodo?, texto })` — `direccion`: `sube` | `baja` | `estable`; `periodo` por
  defecto «vs año anterior»; `metrica` por defecto «Ventas».
- `D.estado({ sujeto, estado, bodega?, texto })` — `estado`: `frenado` | `inmovilizado` | `sobrestock` | `riesgo de quiebre` |
  `capital sano` | `sin vencido` | `sin venta`.
- `D.lectura({ texto, sello })` — SOLO para una interpretación o recomendación sin cifra ni orden sobre una métrica (`sello`:
  `probado` | `indicado` | `abierto` | `criterio mío`). Una línea con una cifra, un orden o una variación NO es lectura.

Patrón (ya hecho en `src/adi/agente/encargoCompuesto.js`: `_crecimiento`, `_unidades`, `_cobranzaCruzada`): guarda la línea en una
variable, haz `L.push(l)` y declara con `texto: l`. Un mismo `texto` puede llevar varias declaraciones (una por cifra u orden). Las
cabeceras con marcador de orden («— los que más mueven:», «Quién cae:») se declaran como orden top-k o como variación/conteo, con esa
cabecera como `texto`. Una oración con dos cifras de dos entidades son dos declaraciones.

## Cómo verificar (offline)
```
node _verificar_composer.mjs <nombre-del-playbook>            # con su pregunta canónica
node _verificar_composer.mjs <nombre-del-playbook> "pregunta" # con otra pregunta
node _verificar_composer.mjs encargo P1   ·   node _verificar_composer.mjs encargo P2
```
Agrega `--texto` para ver el texto y `--decl` para ver lo declarado. Meta: **«✓ cumple el estándar · vetos: 0»** y **byte-idéntico: SÍ**.
Lee cada veto: `afirmacion-no-declarada` = falta declarar ese tramo; `afirmacion-falsa` = lo declarado no coincide con la boleta
(revisa sujeto/métrica/universo — el composer no miente, la declaración está mal armada; si de verdad el composer escribe algo falso,
NO lo tapes: anótalo en tu informe); `afirmacion-no-verificable` = falta universo/período o la métrica no existe en la boleta (elige
la métrica del rótulo correcto; si es una cuenta del composer sin fig, decláralo con `evidencia: [rótulos]` en `D.cifra`);
`declaracion-inconsistente` = el `texto` no contiene la cifra o habla de otra entidad/métrica. Un residuo que no puedas cerrar se
documenta en el informe con el veto y el motivo.

## Entrega
Solo los archivos asignados (y nada más). Al terminar: informe corto — por composer: declaraciones agregadas, resultado de la
herramienta (vetos 0 / residuales con motivo), y cualquier afirmación FALSA real que el composer escriba (eso es un hallazgo, no se
tapa). No corras la suite completa.
