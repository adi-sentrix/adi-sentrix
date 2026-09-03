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

## 5 · Qué falta para cerrarlo (inventario honesto)

- **Cobertura del emisor**: hay que verificar cuáles de los ~40 asks de la cara Capital viajan hoy con
  `viewContext` completo y cuáles no. Los que no, **esperan la siembra del emisor** y así quedan listados en el
  censo — mejor hueco declarado que promesa a medias.
- **Composer por corte**: ninguno todavía, y es deliberado.
- **Carnada del anclaje**: cuando exista el pulido, su gate debe probar que una respuesta anclada a OTRO corte
  se pone roja. Hoy solo está la carnada de que el contexto llega y queda registrado.
