# CONTRATO · el ask que nace de un CUADRO (siembra 2026-09-05)

**Palabra del owner:** *«el botón que está en Sentrix en cuadros o tablas, ADI debe explicar exactamente lo que
ve ahí la foto… lo importante es ADI y el agente y su calidad de respuesta. Pero puedes sembrar el camino».*

**Estado: SEMBRADO, no construido.** Lo que existe hoy es el cable y el contrato escrito. El pulido —que la
respuesta se ancle campo por campo a lo que ese cuadro pinta— lo difirió el owner a propósito.

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
