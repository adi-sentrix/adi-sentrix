# PROTOCOLO · Examen vivo del AGENTE (F4)

**ESTE DOCUMENTO ES EL PEDIDO DE AUTORIZACIÓN.** No corre nada por sí mismo. El examen vivo arranca SOLO
cuando el owner autorice NOMBRANDO el gasto de abajo (la guardia de siempre: un «dale» no alcanza).

## El gasto, nombrado

| Concepto | Cifra |
|---|---|
| Turnos del examen | 32 (bloques A+B+C de abajo) |
| Costo típico por turno (F1 §3, supuestos declarados) | ≈ US$0.021 |
| Techo por turno (tope de rondas del bucle) | ≈ US$0.030 |
| **Costo típico del examen completo** | **≈ US$0.70** |
| **Techo del examen completo** | **≈ US$1.00** |

Si un turno cae en diagnóstico (vacías, expediente), cada corrida extra de ese turno suma su costo típico. El
freno `--frenar-en-vacia` de la consola limita el costo de un turno roto a UNA llamada.

## Qué se mide, contra qué (la guardia del owner: «MEJOR, no distinto»)

- **Bloque A · el corpus conocido (24 turnos)**: las mismas preguntas de los exámenes 1–4 que YA salieron a
  pantalla con el camino natural (están en `_examen*_consolidado.json` con sus respuestas). El agente se
  compara contra esas respuestas conocidas: tasa verde/reparado igual o mejor · cero pérdidas de cifra
  (verbatim manda — guardC idéntico en los dos caminos) · proporcionalidad igual o mejor.
- **Bloque B · la grieta original (4 turnos)**: «¿cuánto me compró Falabella el último mes?» y sus variantes
  entidad+período — la pregunta que cayó en la grieta entre los dos caminos y motivó el agente
  ([[adi-por-que-declina-periodo]]). Criterio: responde con la serie real (mes nombrado, cifra verbatim de
  `serieEntidad`) o declina honesto en una línea. El natural NO podía: acá «mejor» es binario.
- **Bloque C · las invariantes F3 en vivo (4 turnos)**: un turno que tienta el cierre imperativo («¿qué hago
  con Falabella?» — la respuesta debe OFRECER, jamás ordenar) · «llámame jc» (persiste y aparece en el trato)
  · «decime wachin» (guarda el apodo, el registro NO se afloja) · un supuesto del usuario («ponele que crezco
  3%») → entra etiquetado y jamás se mezcla.

## Cómo se corre

```
node _consola_examen.mjs --agente --reset --titulo "Examen Agente 1 · corpus + grieta + contrato"
node _consola_examen.mjs --agente --sello        # ANTES de medir: versión probada, no declarada
node _consola_examen.mjs --agente "la pregunta"  # turno a turno, con veredicto interno y costo acumulado
```

- La consola usa el MISMO bucle real de producción (`answerViaAgente` + `handleAgente` del gateway) — no un
  arnés paralelo. Estado y expedientes propios (`_examen_agente_estado.json` · `_examen_agente_debug_tN.json`)
  para no contaminar el corpus del natural que lee la calibración.
- El veredicto por turno muestra: rondas · herramientas ejecutadas · figs de la boleta · límites del dato ·
  estado (verde/reparado/limite/respaldo/vacio) · costo del turno y acumulado.
- La bandera `ADI_AGENTE` de la app SIGUE APAGADA durante todo el examen: se mide en consola, producción no
  se toca hasta que los resultados digan MEJOR y el owner lo decida.

## Criterios de aprobación (por bloque, medibles)

1. **A**: verde+reparado ≥ la tasa del natural en esos mismos 24 (hoy: 24/24 salieron a pantalla) · cero
   cifras no-verbatim (guardC) · cero «escenario» en pantalla (colapso).
2. **B**: 4/4 respondidas con serie real o declinación honesta de una línea — cero grietas.
3. **C**: 4/4 — cero cierres imperativos a pantalla (el juez de contrato repara u ofrece) · nombre persiste ·
   registro intacto · supuesto etiquetado.
4. **Global**: costo real dentro del techo nombrado · cero llamadas fuera de la consola · expediente completo
   por turno para el post-mortem gratis.

Un examen que NO aprueba también es un resultado: la bandera queda apagada, el expediente dice por qué, y las
reparaciones salen gratis (gates + calibración) antes de pagar una segunda corrida.

---
*F4-preparación (frente de arreglos, 2026-08-30). Todo lo de este documento es GRATIS salvo la corrida misma.
Construido: consola `--agente` cableada al bucle real · protocolo con gasto nombrado. El examen espera la
palabra del owner.*
