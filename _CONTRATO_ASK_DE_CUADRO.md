# CONTRATO · el ask que nace de un CUADRO (siembra 2026-09-05)

**Palabra del owner:** *«el botón que está en Sentrix en cuadros o tablas, ADI debe explicar exactamente lo que
ve ahí la foto… lo importante es ADI y el agente y su calidad de respuesta. Pero puedes sembrar el camino».*

**Estado: CONSTRUIDO.** La siembra (2026-09-05) fue el cable; el pulido de las 4 formas de Capital, el §5; y el
ancla completa y transversal de todos los botones «Que ADI lo explique», **el §6 (2026-09-08) — empezá por ahí
si venís a tocar esto**. Lo que sigue abierto está declarado al final del §6, con su razón.

---

## 1 · Las dos clases de ask, que NO tienen el mismo contrato

| clase | ejemplo | qué debe responder |
|---|---|---|
| **pregunta libre** | «¿Dónde está frenado mi capital?» | el dominio: la lectura del motor, completa. Un ask libre **jamás puede caer a `vacio`** — es un click sobre una promesa. |
| **ask de cuadro** | «¿Cuánto capital tengo en Santiago?» (fila del cuadro de bodegas) · «Profundiza en SAM-REF500L» (fila de la tabla de SKU) | **exactamente lo que ese cuadro muestra.** El usuario está MIRANDO la foto: una respuesta correcta del dominio pero de otro corte no honra el click. |

## 2 · El hallazgo de la siembra

**El emisor ya sembraba; el receptor no escuchaba.** La UI arma el contexto de la pieza tocada desde el
Contrato de Concordancia (2026-08-09) y se lo pasaba al camino natural — pero **`answerViaAgente` no lo
recibía**. Cableado el 2026-09-05: el agente lo acepta y lo deja en el expediente del turno
(`r.agente.viewContext`).

Los `ask` de Sentrix **no se tocaron** y no se tocan: son contrato congelado (CLAUDE.md). El receptor aprende;
el emisor no cambia.

## 3 · La forma del contexto (lo que viaja hoy)

```
{ vista, seccion, eje, entidad }
```

- **DESCRIBE la superficie, jamás trae cifras.** Lo que no entra por el módulo no se cuela al texto: una sola
  verdad. Si el contexto trajera montos, habría dos fuentes para la misma cifra — exactamente lo que la casa
  persigue.
- Campos ausentes van `null`: un contexto parcial es válido y se declara, no se completa adivinando.

## 4 · La regla del pulido futuro (cuando el owner lo pida)

1. **El anclaje es por MÓDULO, no por texto**: la respuesta a un ask de cuadro se compone con el **mismo
   builder y el mismo campo** que pinta ese cuadro. No se «reconstruye» la fila leyendo otra fuente.
2. **Si el corte del cuadro no existe como lectura del motor, se declara** — no se sirve el corte más parecido.
   Un ask de cuadro respondido con otro corte es peor que un límite honesto: el usuario está mirando la
   diferencia.
3. **El contexto no autoriza cifras**: sigue rigiendo la boleta. El cuadro dice QUÉ mirar, el módulo dice
   CUÁNTO.

## 5 · EL PULIDO, HECHO (GO del owner 2026-09-05)

**La palabra del owner que lo ordenó, textual:** *«Vamos con el pulido del anclaje de los 41 botones de
cuadro y después poda inmediata. No quiero podar dejando promesas clickeables sin piso. Cada botón debe
responder sobre el cuadro exacto que el usuario está mirando, no sobre el negocio general ni sobre otro eje.»*

Vive en `src/adi/agente/playbooks/askDeCuadro.js`, y las tres reglas del §4 se cumplieron así:

1. **Anclaje por módulo**: capital por bodega/familia sale de `queryMetric{capital,·}`, que agrupa
   `skuInventario.stockUSD` por el MISMO campo que `mesaCapital` (familia se declaró en el contrato de
   métricas con `groupByField: "sfamilia"` — el campo exacto del cuadro). El gate lo prueba **contra el
   cuadro VIVO**: recorre `buildMesaCapital().cortes` y exige que la respuesta diga la cifra de cada fila —
   si el dato cambia, cuadro y respuesta se mueven juntos o el gate se pone rojo.
2. **El corte sin lectura del motor se declara**: los tramos de EDAD («0–30 días»…) son un derivado de
   mesaCapital (días sin venta tramados), no un campo del dato — declararlos en el motor habría sido una
   segunda verdad del tramo. La respuesta lo dice y ofrece la alternativa CON cifra. Con carnada.
3. **El contexto no autoriza cifras**: `viewContext` viaja al detector (`playbookPara(q, {history, viewContext})`)
   solo para desambiguar; las formas nombran su corte en la frase del botón, y un nombre fuera del índice
   **no se adivina** (gateado: «Rancagua» no abre nada; «capital en Falabella» no se sirve por otro eje).

**La frontera de universos, gateada**: la respuesta de un cuadro de Capital no cita venta comercial ni margen
— y el margen del SKU existe DOS veces con el mismo rótulo (drill del cuadro: margen de inventario 22%;
skusMargen: comercial 11.1% — medido en SAM-REF500L), así que no se cita ninguno. Regla notarial
`universo-cruzado` + carnada.

**Cobertura**: las 4 formas × sus variantes (12 casos de turno completo en el gate, incluidos los declives:
el SKU no frenado con el estado que la carpeta declara, el cliente sin fila publicada en la mesa del cobro,
el tramo de edad declarado). El emisor sigue sin sembrar viewContext en los cuadros de Capital — ya no
bloquea: las formas se anclan por la frase del botón; la siembra del emisor queda como mejora de
desambiguación para catálogos con nombres repetidos entre ejes.

---

## 6 · EL ANCLA COMPLETA, TRANSVERSAL (GO del owner 2026-09-08)

**Su palabra, textual:** *«Sí, hazlo una vez para todos los botones "Que ADI lo explique". Regla: el botón no
manda solo texto. Manda el ancla completa del cuadro que el usuario está viendo. Debe incluir: cara/módulo ·
nombre del cuadro · métrica principal · eje o entidad · período · filtros aplicados · cifras visibles · qué
pregunta concreta debe explicar. ADI debe responder ese cuadro, no una pregunta libre ni un ranking genérico. Si
el cuadro muestra un 80/20, explica el 80/20. Si el cuadro muestra presupuesto, explica presupuesto. Si no
existe dato suficiente para ese cuadro, debe decir exactamente qué falta. Hazlo transversal para todas las
caras, no parche por cuadro.»*

**Lo que se midió antes de construir** (los 5 botones de la cara Comercial, con el cerebro mudo): **2 caían en
«no tengo información autorizada suficiente»** —incluido el que el owner clickeó— y los otros 3 devolvían un
ranking del negocio. El del 80/20 contestaba *«Así viene tu venta por cliente, de mayor a menor»*: correcto
como lectura, y no era la pregunta.

### Las cuatro piezas

| pieza | qué aporta |
|---|---|
| `src/adi/sentrix/lecturaDeCuadro.js` | lee LO QUE ESA PIEZA PINTA: su identidad declarada (del manifiesto) y sus **cifras visibles**, del mismo módulo que la pinta. |
| `cuadroSentrix` (`herramientasAgente.js` + `catalogoAgente.js`) | la herramienta: esa lectura convertida en boleta, con unidad y crudo derivados por los **lectores del propio muro** (`parseFigures` + `parseCounts`). |
| `src/adi/agente/playbooks/cuadroExplicado.js` | el playbook: lo abre el CLICK, sus pasos corren antes del cerebro, su entregable NOMBRA ese cuadro, y su lista notarial exige que la respuesta no se suelte del ancla. |
| `_ancla_de_cuadro_gate.mjs` | 109 chequeos: los 8 campos del ancla, el barrido del manifiesto, cada botón contra el **cuadro vivo**, el 80/20 con su conmutador, el presupuesto, el «qué falta», un-click-un-turno, el muro intacto, el inventario del emisor y 4 carnadas. |

### Las cuatro decisiones que hay que conocer antes de tocar esto

1. **`cuadro` es un campo DISTINTO de `viewContext`, y no es duplicación.** `viewContext` es lo que el turno
   tiene delante (el click si lo hubo, si no el **ambiente** de la vista abierta). `cuadro` es **solo el
   click**, y se consume una vez. El ambiente sigue publicado mientras la Mesa está abierta: abrir la
   explicación de cuadro por ambiente haría que la siguiente pregunta escrita a mano se respondiera como si
   fuera un botón. *Un click, un turno.* Gateado con carnada.
2. **Un solo paso: `cuadroSentrix`.** La primera versión sumaba la `evidencia` declarada del manifiesto y salió
   ROJA con razón: en el cuadro del año mes a mes quedaban dos figs del mismo valor y distinta procedencia —el
   total del cuadro (medido) y el de `trend` (derivado, que el manifiesto declara `divergent`)— y el muro vetó
   el turno entero. Con el cuadro anclado la respuesta correcta es **una sola fuente: la que el usuario mira**.
   El cerebro conserva la caja completa para la ronda siguiente.
3. **El diccionario de campos NO es un parche por cuadro.** El lector traduce el campo del builder (`ventaFmt`,
   `usdFmt`, `doh`…) al rótulo del negocio con **un** diccionario compartido por todas las caras — que es la
   aplicación literal de «una sola verdad: mismo concepto, misma palabra». Un campo que no está, no se lee: una
   cifra con rótulo inventado es peor que una cifra ausente. El gate exige que ni el lector ni el playbook
   nombren un solo `componentId`.
4. **`sin-cifras` es un límite MÍO, no del dato.** El lector distingue tres motivos: `sin-modulo` y `sin-campo`
   son del DATO y se le DICEN al usuario; `sin-cifras` —la pieza pinta números pero no los publica en forma
   citable— **no abre el playbook**, porque declararlo como límite del negocio sería mentirle al usuario sobre
   su propia carga.

### Lo que queda declarado como deuda (y vive en el gate, §9)

Las dos superficies de **nivel 2** cuyo botón todavía manda la pregunta sin ancla, cada una con su razón:
- **`CapitalDrill`** — la tabla de drill de Capital no está declarada en el manifiesto: anclarla pide entrada
  nueva + emisor propio.
- **`MesaPareto`** — el Pareto del Cuadro cambia de universo con la selección (negocio · posición ·
  composición): son tres piezas, no una.

Y las **21 piezas `sin-cifras`** (los cuadros de mando, los rings, los recibos, las simulaciones, la Ficha):
publican sus números crudos y los formatea la vista, así que no hay cadena que citar verbatim. El día que sus
builders publiquen sus `*Fmt`, quedan explicadas sin tocar una línea de este camino.
