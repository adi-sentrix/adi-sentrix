# Notario semántico · Fase 3 (en vivo, 2026-09-15) — el modelo real declara

**Autorización del owner:** máximo 30 llamadas externas y US$3 de gasto total; sin deploy. **Consumo real: 30 llamadas · US$2,38**
(24 del agente Sonnet 5, 6 del extractor independiente Opus 5; costo contando el caché, con la tabla de precios de la casa).
Los cerrojos de la corrida viven en `_fase3_vivo.mjs` (la llamada que excedería un tope no sale). La medición es offline:
`node --import ./scripts/offline-guard.mjs _fase3_medir.mjs [--veredictos] [--omisiones] [--detalle]`.

**Qué se corrió:** 12 prompts NUEVOS (`fixtures/notario-fase3-prompts-2026-09-15.json`; ninguno está en los corpus anteriores) por el
bucle real con el cerebro de producción; corpus crudo en `fixtures/notario-fase3-vivo-2026-09-15.json` (por llamada: la prosa y el
bloque del modelo, la boleta con la que se juzgó, uso de tokens, costo, latencia; por turno: el expediente del Notario). El turno 12 se
cortó en el tope del agente después de su primer cierre (sin texto servido). Etiquetado manual en
`fixtures/notario-fase3-etiquetas-2026-09-15.json`.

## 1 · Los números

| Medida | Resultado | Criterio del owner |
|---|---|---|
| Omisión real del modelo (extractor independiente Opus 5 sobre la prosa del modelo, revisada a mano) | **14,8 %** (47 de 317 afirmaciones de hecho sin declarar; cruda 20,5 %) | ≤ 5 % → **no cumple** |
| Omisión según el detector de presencia (puntos de la prosa sin declarar) | 34,9 % en total (cierre 41,9 % · reparación 25,0 %) | — |
| Declaraciones correctas del modelo (verdaderas + selladas) / declaradas | 79,6 % (383 declaradas; 266 verdaderas · 12 falsas · 66 no verificables · 39 selladas) | — |
| FN del Notario (falsa dictada verdadera) | **0 %** (0 de 335) | ≤ 5 % → cumple |
| FP del Notario, estricto (declaración bien formada, evidencia en la boleta, veredicto errado) | **2,7 %** (9 de 335) | ≤ 5 % → cumple |
| FP + rigidez (hechos verdaderos bloqueados por la forma de la declaración) | 11,3 % (38 de 335) | ≤ 5 % → **no cumple** si se cuenta la rigidez |
| Contradicciones prosa ↔ declaración | 31 en 23 piezas (11 piezas con alguna): 16 fragmentos declarados que no están literalmente en la prosa, 6 declaraciones que dicen otra cosa que la frase, 9 hechos declarados como lectura | — |
| Respuestas que requirieron reparación | **11 de 11** (los 11 cierres fueron vetados; las 11 reparaciones también) | — |
| Cómo se sirvió | 0 verde · 0 reparado · **1 podado** (la prosa del modelo sin las oraciones vetadas) · **7 respaldo** (playbook) · **3 línea honesta** | «respuesta premium servida en ≥ 90 %» → **no cumple** |
| Hechos servidos sin declaración válida | **0 de 11** (todo lo servido: declarado y verificado; 0 falsas, 0 no verificables, 0 omisiones) | 0 → cumple |
| Afirmaciones falsas del modelo | 7 reales, **7 cazadas, 0 servidas** | 0 servidas → cumple |
| Costo y latencia | agente: US$0,058 por llamada · **US$0,128 por turno** · 15,3 s por llamada · **32 s por turno** (2 llamadas por turno); extractor Opus 5: US$0,15 por llamada | — |

Tokens del agente: 211K de entrada sin caché + 324K leídos del caché (el system y el catálogo se cachean) · 41K de salida.

## 2 · Lo que dice la corrida

1. **El modelo declara siempre (23/23 bloques) pero declara menos de lo que afirma.** Declara bien las CIFRAS (la mayoría verdaderas) y
   omite lo que dice en palabras: las relaciones («por encima del nivel de referencia», «bajo el benchmark», «supera el máximo de 120
   días», «la mitad no está sano»), los superlativos («la mayor», «los que más», «la que más deja sobre la mesa») y las cifras que deriva
   (las brechas por familia). Es la clase de afirmación que la fase 1 identificó como la más sensible, y es la que falta.
2. **El Notario cazó las 7 falsedades reales y no sirvió ninguna.** Ejemplos: «Cuidado Personal: venta $29,4M — la más alta de las
   cuatro» (Electrodomésticos vende $33,2M); «Falabella es una de las 6 cuentas bajo el benchmark» (son 8); «LG-DRYER8KG … la más
   lejana a la referencia» (MAK-COMP-AIR tiene 190d); «$655K sobre esas seis cuentas» con Paris en la lista (el subtotal es de otras
   seis). Ninguna falsa dictada verdadera.
3. **El Notario tiene 9 defectos propios (2,7 %) y 29 rigideces (8,7 %).** Defectos: «Markup promedio · los que caen / sanos» no se
   casó con «Markup sobre costo» (4); «Cost share» no es sinónimo de «Peso del costo» (2); un ranking de carga mezcló % con $ (1); una
   variación dicha en $ y % (1); «la mayor brecha de las 5 marcas» con la brecha de 4 (1). Rigideces: el modelo escribe el benchmark o el
   nivel de carga como SUJETO («Benchmark de margen», 7 veces), pone el universo dentro de la métrica («Contribución no capturada · 5
   cuentas materiales», 10 veces), declara un grupo con la lista de valores de cada cuenta (3), una fracción contra «el total frenado» (3),
   una rotación sin unidad (3): hechos verdaderos que el verificador podría tolerar con reglas baratas.
4. **La consecuencia de producto: la respuesta premium no se sirvió ni una vez.** Cada cierre trajo omisiones (y a veces una falsa o una
   no verificable), la reparación mejoró (omisión 42 % → 25 %) pero nunca quedó limpia, y el turno cayó al respaldo (7), a la poda (1) o a
   la línea honesta (3). Lo servido fue siempre verdadero y completo, pero en 10 de 11 turnos no fue lo que el modelo escribió.
5. **Dos definiciones de «carga alta» conviven** (hallazgo lateral): «6 de las 8 bajo el benchmark pagan carga alta» es verdadero con
   el umbral crudo (> 3,5 %) y falso según el subtotal de diagnose (5 de ellas). Una sola verdad por eje exige unificarlo.

## 3 · Dónde está el problema y qué costaría cerrarlo (sin decidir por el owner)

- **La instrucción de declaración** (`instruccionDeDeclaracion()`, contrato de ADI: no se toca sin autorización): hoy el modelo no
  declara relaciones ni superlativos dichos en palabras, usa conceptos como sujeto, mete el universo en la métrica y agrupa listas de
  valores. Un ejemplo por tipo en la instrucción y la regla «toda comparación en palabras es una relación» apuntan a la omisión real.
- **La tolerancia del verificador** (`verificar.js`, `evidencia.js`; offline, medible contra los corpus): sinónimos (markup promedio ·
  peso del costo), sujeto = concepto del negocio → «negocio», universo dentro de la métrica, grupo con lista → cifras por entidad, unidad
  implícita por la métrica, brecha derivable de margen + benchmark. Cierra la rigidez (8,7 %) y los 9 defectos sin aflojar la verdad.
- **Deudas de evidencia nuevas:** el estado «crítico» y los subtotales de «quiebre próximo» / «sobrestock» de la Mesa Capital no viajan
  como figs; `inventoryStatus` narra rotaciones que la boleta sí trae pero el modelo cita sin unidad.

Ninguna de las tres se hizo: la corrida se trae tal cual, con sus fallos, para decidir.
