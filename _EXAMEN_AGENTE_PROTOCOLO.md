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

---

## SEGUNDA CORRIDA (tras el examen 1 · 2026-08-31) — pedido de autorización actualizado

**El examen 1 corrió (autorización nombrada del owner, hasta US$1) y NO aprobó: 9/20 verdes en A contra
20/20 del natural — regresión de CAPACIDAD, no de honestidad (cero cifras inventadas en 28 pantallas; el
muro sostuvo).** El análisis del expediente (59 agentes, verificación adversarial) localizó las causas turno
por turno: TODAS de plomería/letra, TODAS reparadas GRATIS y con gate+carnada:

- **R1** la ronda extra (el cierre que pide una herramienta válida la obtiene — T7 ya no muere en vacío)
- **R2** la re-cita cableada (cifras YA aprobadas se re-autorizan — la raíz de la mayoría de los no-verdes)
- **R3** el respaldo con pertinencia (nunca más Tottus como respuesta «sobre» Falabella)
- **R4** el rescate proporcional (hasta 4 cifras del turno · refutación del supuesto · trato registrado)
- **R5** el rótulo del $33K dice FRENADO (la palabra sigue a la cifra — toda la superficie)
- **R6** leer antes de declinar (el empujón de verificación; la limitación falsa de T20 ya no sale gratis)
- **R7** expediente auditable (cada veto con sitio y multa · reintentos por guard contados · sello --agente
  PRUEBA la ruta del agente)
- **R8** léxico de superficie como VETO ciego (escenario · tensión · instrumento · tirar · identificadores)
- **R9** entidad×período bloqueada va al puente (1-2 líneas, razón verdadera, puerta real — fin de la lotería)
- **[9]** refuerzos del cerebro (benchmark ≠ promedio en el mapa · proyección→simulación · pre-autorizado se
  ejecuta etiquetado · menú solo con cortes sostenibles)
- **[10]** conteo honesto (el eco de plantilla se cuenta límite, no verde · «verde sin lectura» marcado)
- **R-eco** escalada condicionada (el tier caro SOLO con boleta no vacía — en el examen 1 fue 66% del gasto
  con CERO verdes)

### El gasto de la segunda corrida, nombrado

| Concepto | Cifra |
|---|---|
| Turnos | 28 (A: los 20 turnos REALES de los consolidados — el 24 del protocolo original era estimación; existen 20 · B: 4 · C: 4) |
| Costo típico | **≈ US$0.60** (menos que la corrida 1: la escalada condicionada apaga el 66% estéril) |
| Techo | **≈ US$1.00** (el mismo freno de siempre + `--frenar-en-vacia` + el freno acumulado del supervisor) |

Notas de conteo para el veredicto: T16-tipo (criterio sin ejercitar) se cuenta «sin probar», no aprobado;
un «verde sin lectura» no suma al criterio A (la consola ya lo marca). El techo por turno del protocolo
original (~US$0.030) se superó en 9 turnos de la corrida 1 por la escalada — con R-eco condicionada, el
techo por turno vuelve a ser creíble.

**FRENO INTACTO: esta corrida NO corre sin la palabra del owner que NOMBRE el gasto.**

---

## TERCERA CORRIDA (tras el examen 2 · 2026-08-31) — pedido de autorización actualizado

**La corrida 2 salió PEOR: 19/28 turnos (frenada por gasto), verdes 14→2.** El expediente —legible por primera
vez gracias a R7— mostró que la causa NO fue el muro (que siguió impecable: cazó una invención real en T15,
cero falsos positivos de léxico en 19 turnos) sino tres defectos de plomería que las reparaciones de la
corrida 1 introdujeron o dejaron abiertos. Los cuatro cortes de esta tanda, todos medidos:

- **P1a** · el rescate vuelve a UNA cifra: el empaquetado de R4a se auto-vetaba por atribución
  (`linea-honesta · «$4.9M» narrado como margen`), tercer peldaño de la cascada que terminó en VACÍO. La
  refutación del supuesto (R4b) SE CONSERVA — funcionó en T17.
- **P1b** · la reparación nombra LA cifra rechazada y pide reformular ESA oración (T2 cosechó la multa
  idéntica dos veces). Al escribirlo se cazó un defecto peor: cuando el veredicto no traía `.multa`, al modelo
  le llegaba literalmente «[object Object]» — dos derivaciones distintas de la misma multa, ahora una sola.
- **P2** · el empujón de R6 NO aplica a re-narraciones: misma pregunta, corrida 1 = US$0.0059 verde en una
  llamada · corrida 2 = US$0.2534 limite en cinco. 43× más caro y peor. Reformular lo ya dicho no lee nada.
- **P3** · el hilo que viaja al cierre se poda por encima del tope (medido: 24.389 → 15.646 chars, −36%,
  con las 263 figs intactas para guardC, que corre local y gratis) y el tier caro no se paga con el hilo sobre
  el techo (28.000 chars, UNA sola verdad importada por la consola y por producción).
- **P4** · la unidad del eco del supuesto la dice el usuario: «30%» ya no sale «$30».

**Descartados del veredicto por verificación del supervisor (NO se repararon, y está bien):** el «hueco de
formas verbales de R3» (T13 sirvió contenido pertinente) y el «blanqueo del supuesto en T17» (T17 fue de las
mejores respuestas del examen: corrigió la premisa con el dato real y etiquetó el supuesto).

### El gasto de la tercera corrida, nombrado

| Concepto | Cifra |
|---|---|
| Turnos | 28 (A: 20 · B: 4 · C: 4) |
| Costo típico | **≈ US$0.45** (P2 quita las rondas de re-narración · P3 baja el hilo −36% y frena el tier caro en los turnos gigantes) |
| Techo | **≈ US$1.00** (más el freno del conductor, que el supervisor endureció a chequeo intra-turno y por llamada) |

**FRENO INTACTO: esta corrida NO corre sin la palabra del owner que NOMBRE el gasto.**

---

## CORRIDA CORTA DE CONFIRMACIÓN (post corrida 4 · armada 2026-08-31) — pedido de autorización

**Para qué**: la corrida 4 midió el registro ejecutivo y la consistencia. Después de ella se cerraron cuatro
cosas que **nunca se midieron en vivo**: P1 (el default de «mi venta»), P2(i) (la letra del ejemplo numérico),
P2(ii) (la escalada del veto reparable) y (B) (el peldaño que cede solo en el agente). Esta corrida confirma
esas cuatro **y** que no se rompió nada de lo ya ganado. **No es un examen nuevo: son 8 turnos.**

### El gasto, nombrado

| Concepto | Cifra |
|---|---|
| Turnos | **8** |
| Costo típico por turno (medido en la corrida 4: US$0.5582 / 28) | ≈ US$0.020 |
| **Costo típico de la corrida corta** | **≈ US$0.16** |
| **Techo** (si los 8 turnos costaran como el más caro de la corrida 4, US$0.059) | **≈ US$0.48** |

Con `--frenar-en-vacia` por turno y el freno del conductor que ya reserva el peor turno antes de arrancar.

### Los 8 turnos, en este orden (el orden importa: tres necesitan contexto previo)

| # | Turno | Qué confirma | PASS | FAIL |
|---|---|---|---|---|
| 1 | «llamame jc de ahora en adelante. como viene mi margen?» | REGRESIÓN: playbook Margen en Riesgo · trato · registro ejecutivo | responde la lectura (vara 30,1% · 8 bajo · $4,9M) y abre con «jc:» o «jc,» | vuelve «acá está» / se disculpa / pide aclaración |
| 2 | «ponele que el año que viene crezco 3%: cuanto seria mi venta?» | **P1** (T8 verbatim de la corrida 4) | proyecta sobre la venta TOTAL del negocio y lo dice | pregunta «¿global o por cliente?» |
| 3 | «Dime cuáles son los clientes que venden mucho pero están bajo el benchmark» | REGRESIÓN: el mejor turno de la corrida 4 | tabla con cifras verbatim, registro ejecutivo | pierde la tabla o cae al rescate |
| 4 | «Con ese total anual, proyecta 12 meses con +4% y dime cuánto genera adicional.» | **P1** con contexto (T21 verbatim) | proyecta sobre el total ya nombrado en el hilo | vuelve a pedir la entidad |
| 5 | «Sobre esos clientes, simula reducir 2 puntos porcentuales las acciones comerciales y dime si alguno queda sobre el benchmark.» | **P2(i)+(ii)** (T10 verbatim — el que salió vacío) | aclara SIN ejemplo numérico sobre una entidad real, o repara y entrega | vuelve a salir `vacio` con la disculpa genérica |
| 6 | «Compara Q1 vs Q2 en ventas, margen y contribución. Si no está en la carpeta, dilo.» | REGRESIÓN: C3, límite con alternativa nombrada | nombra lo que sí tiene («la serie mensual global real, 12 meses») y ofrece | «No tengo información autorizada suficiente» |
| 7 | «Dame una versión más dura, como si tuviera que presentarla al gerente general.» | **(B)** + P2 · el respaldo tras un verde | reformula con lo del hilo, sin salir a leer y sin la frase de molde | la cadena «sigue verificado y en pie — dime qué parte profundizo» |
| 8 | «cuanto me compro falabella el ultimo mes» | REGRESIÓN: el puente de la grieta, costo ~cero | una o dos líneas con la razón verdadera y la puerta a la ficha | vuelve a la lotería del cerebro |

### Cómo se lee el resultado
Los **cuatro turnos de cambio** (2, 4, 5, 7) son binarios: o hacen lo de la columna PASS o el arreglo no
funciona en vivo y hay que volver al diagnóstico **antes** de los tres escenarios. Los **cuatro de regresión**
(1, 3, 6, 8) son la red: si alguno cae, algo de lo ganado se rompió y eso pesa más que cualquier mejora nueva.

**FRENO INTACTO: no corre sin la palabra del owner que NOMBRE el gasto.**

---

## LOS TRES ESCENARIOS DE CERTIFICACIÓN (armados 2026-08-31) — pedido de autorización

**Decisión del owner**: no certifica el agente solo con el demo. Tres datos: **demo de fábrica · planilla
COMPLETA · planilla PARCIAL**. Él llena las planillas; la consola ya sabe cargarlas (`--planilla <ruta.xlsx>`).

### El reparto, y por qué no son 28 × 3

El demo ya se midió **cuatro veces**: gastar 28 turnos ahí otra vez no compra información. Donde falta medida
es en los dos datos nuevos: la **completa** prueba el TECHO del producto (los ejes que el demo no tiene) y la
**parcial** prueba la CONDUCTA con dato incompleto (que nombre la columna ausente).

| Escenario | Turnos | Qué mide | Costo típico | Techo |
|---|---|---|---|---|
| **1 · demo** | 8 | la corrida corta de confirmación ya especificada arriba — **si ya se corrió, no se repite** | ≈US$0.16 | ≈US$0.48 |
| **2 · completa** | 12 | el techo: los ejes que el demo no puede probar + la serie real por cliente | ≈US$0.24 | ≈US$0.72 |
| **3 · parcial** | 8 | la conducta nueva: nombrar la columna ausente sin degradar lo que sí está | ≈US$0.16 | ≈US$0.48 |
| **TOTAL** | **28** | | **≈US$0.56** | **≈US$1.68** |

El costo típico sale del **medido**: US$0.5582 / 28 turnos de la corrida 4 = US$0.020 por turno. El techo es
pesimista a propósito (todos los turnos al precio del más caro de esa corrida, US$0.059) — **en la práctica
manda el freno del conductor, que reserva el peor turno antes de arrancar y no puede pasar el techo
autorizado**. Si el owner prefiere autorizar de a uno, cada escenario trae su propio número.

### ESCENARIO 2 · PLANILLA COMPLETA (12 turnos) — el techo del producto

| # | Turno | PASS | FAIL |
|---|---|---|---|
| 1 | «cuánto me compró {cliente} el último mes» | **la cifra del mes con su nombre y el delta contra el anterior** | declina como en el demo |
| 2 | «muéstrame la venta de {cliente} mes a mes» | los meses con sus cifras verbatim | declina o inventa meses |
| 3 | «ranking por canal: mejores y peores» | usa el eje canal REAL de su archivo | dice que no tiene el eje |
| 4 | «por punto de venta, ¿quién queda bajo el plan?» | responde por punto de venta | lo confunde con cliente o bodega |
| 5 | «qué marca deja más margen» | ranking por marca con cifras | declina |
| 6 | «margen por familia» | ranking por familia con cifras | declina |
| 7 | «capital por bodega» | capital por bodega, sin mezclar con venta | cruza los dos universos |
| 8 | «quién me debe y qué está vencido» | usa la hoja Abonos: deuda y vencido con cifras | declina teniendo la hoja |
| 9 | «cuánto vendí a crédito vs contado» | usa la columna condición | declina teniendo la columna |
| 10 | «llamame {apodo}. ¿cómo viene mi margen?» | playbook sobre SUS clientes + trato + registro ejecutivo | «acá está» / se disculpa |
| 11 | «dame los 3 riesgos para el directorio» | tres riesgos con cifras de SU negocio | molde o disculpa |
| 12 | «compará Q1 vs Q2» (si su archivo no trae trimestres) | límite corto CON la alternativa nombrada | disculpa genérica |

**El turno 1 vale por sí solo**: verificado offline que con una planilla de dos meses reales `serieRealDe` pasa
a `real:true` y el puente deja de interceptar — **el bloqueo de la serie era del demo (histórico sintético que
no reconcilia), no del producto**. Si ese turno responde con cifra, queda probado en vivo.

### ESCENARIO 3 · PLANILLA PARCIAL (8 turnos) — la conducta con dato incompleto

Cinco turnos donde la pieza NO está (debe nombrarla) y tres donde SÍ está (no debe degradarse).

| # | Turno | PASS | FAIL |
|---|---|---|---|
| 1 | «quién me debe y qué está vencido» | **«tu archivo no trae la hoja Abonos: con eso te abro…»** | disculpa genérica o vacío |
| 2 | «ranking por canal» | nombra la columna «canal» de Ventas | «no tengo ese eje» sin decir por qué |
| 3 | «cuánto vendí a crédito» | nombra la columna «condición» de Ventas | disculpa |
| 4 | «mejores y peores puntos de venta» | nombra la columna «punto de venta» | lo confunde con cliente |
| 5 | «capital por bodega» | nombra la columna «bodega» de Inventario | inventa el corte |
| 6 | «¿cómo viene mi margen?» | **funciona igual que con la completa** | se degrada por lo que falta |
| 7 | «qué SKU tienen capital frenado» | responde por SKU con cifras | declina |
| 8 | «cuánto me compró {cliente} el último mes» | responde con la serie (las 7 obligatorias la sostienen) | declina |

**Los turnos 6-8 son la mitad que más importa**: un dato incompleto no puede empeorar lo que sí trae. Si
alguno cae, el arreglo del dato incompleto costó más de lo que dio.

### Cómo se lee
Cada escenario se lee solo, con sus PASS/FAIL. **La regla de jerarquía es la misma**: una caída de regresión
(2·10, 2·11, 3·6, 3·7, 3·8) pesa más que cualquier turno nuevo que funcione.

**FRENO INTACTO: nada de esto corre sin la palabra del owner que NOMBRE el gasto.**
