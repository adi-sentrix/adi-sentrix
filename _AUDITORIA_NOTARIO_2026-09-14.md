# Auditoría focalizada del Notario · 2026-09-14

**Encargo del owner:** «Agente y Notario tienen que avanzar juntos. Antes de otra prueba en vivo, una auditoría del
Notario sobre el producto actual, con los borradores reales de las seis corridas como conjunto de referencia. Medir por
separado: (1) errores reales que debe detener; (2) respuestas correctas que bloquea por falso positivo. Buscar el patrón
común de los falsos positivos. Objetivo de producto: detener afirmaciones falsas sin degradar sistemáticamente
respuestas correctas del agente.»

**Conjunto de referencia:** los 12 borradores reales (6 corridas × cierre + reparación) de las dos pruebas de la v2.31,
leídos a mano contra la boleta del turno. La verdad de referencia vive en `fixtures/auditoria-notario-2026-09-14.json`
y el candado que la mide es `_auditoria_notario_gate.mjs` (en la suite; se pone rojo solo por regresión; lista los
pendientes hasta que la auditoría quede limpia).

## La medida, hoy (producto actual, tras los 14 cierres de hoy)

| | |
|---|---|
| Errores reales en los 12 borradores | **21** (en 10 de los 12; dos borradores limpios: P2·3 cierre y reparación) |
| Detectados por el Notario actual | **4** → cobertura **19 %** |
| Vetos de hecho correctos / (correctos + falsos positivos vigentes) | 4 / (4 + 3) → precisión **57 %** |
| Falsos positivos medidos en las corridas | **17** · cerrados hoy 14 · vigentes 3 |
| Leyes de la casa aplicadas (intención, densidad, juicio sin marcar, vocabulario) | 15 vetos — no son errores de hecho; 2 en el límite de la ley («la cobranza más deteriorada», «el deterioro es más profundo»: adjetivo / comparación de niveles, no cambio en el tiempo) |

**Lo que muestran las seis corridas:** el agente escribió 12 borradores; **todas sus cifras están en la boleta**
(cero cifras inventadas: la verificación de «cifra + dueño» funciona). Lo que se equivoca el agente son las **palabras
de ORDEN, GRUPO y CONTEO alrededor de cifras correctas** — y ahí es exactamente donde el Notario menos mira. A la vez,
lo que el Notario cobró de más fueron atribuciones por **cercanía**. En números: de 10 borradores bloqueados en vivo,
7 cayeron por falsos positivos; y 3 de esos 7 traían errores reales que nadie vio (P1·2 cierre y reparación, P1·3
reparación) — cerrar falsos positivos uno por uno habría servido esas afirmaciones.

## Los errores reales que no detiene (17 pendientes) — el patrón

| Familia | Casos | Ejemplos | Por qué no lo ve |
|---|---|---|---|
| **Cifra de grupo repartida a un subgrupo** | 8 | «ese mismo grupo (4 cuentas) tiene markup promedio 41.4%» (es de 8); «57.3% en Easy, La Polar, Hites» (es de 5); «su precio de lista… 41.4%» | Solo los pesos de `rolesCartera` llevan su grupo declarado; los promedios y subtotales no. Y las referencias por pronombre («ese grupo», «su», «estos cuatro») no se juzgan. |
| **Orden no verificado** | 7 | «carga 4.5% — la más alta de la cartera» (Easy 5.5, Sodimac 5.4, Ripley 4.8); «con más unidades y más contribución» (Jumbo, falso); «los tres… los que tienen el margen más bajo» (Sodimac queda fuera); «la más urgente (269 días), peor recuperación» (Easy 270 d, Sodimac 35 %); «la segunda en brecha» tapada por «entre los tres dominios» | La métrica debe estar pegada al marcador; «y más X» encadenado no cuenta; un grupo plural no se verifica como top-N; cobranza no tiene rankings declarados; el candado del plural mira toda la oración. |
| **Conteos** | 2 | «Cayendo (2 de 13 cuentas)» (caen 3); «6 cuentas: cinco nombres y una quinta» | Un «N de M» no se compara con el conteo declarado; una lista no se compara con su N. |

## Los falsos positivos (17) — el patrón común

| Familia | Casos | Ejemplos |
|---|---|---|
| **Dueño por cercanía, no por cláusula** | 9 | «Falabella es…, y Lider es… (8.6 pp contra 8.1 pp de Falabella)»; «Lider pesa más: 8.6 pp (peor que Falabella), … 269 días»; «lo que más vende: LG-DRYER8KG ($14K frenados…)» ⏳; «$9.8M pendiente, de eso $4.6M» (el «eso» buscado en otro párrafo); «(SAM-TV55 $13.3M, LG-WASH11KG $12.4M)» leído como «de los $13.3M, $12.4M»; «Falabella solo LA supera ($1.6M contra $1.5M)»; «$33K … concentrados en Valparaíso (75%)» ⏳; «libéralo junto con MAK-COMP-AIR y recuperas $22K» |
| **Una palabra leída sin su gramática** | 6 | «carga baja» (adjetivo, no verbo); «carga de solo 1.8%»; «cambia el orden»; «mayor QUE la de Falabella» (comparativo); «no porque coincidir…» (negación); «Falabella, Jumbo y Lider concentran la mayor…» (sujeto plural) |
| **Hecho ausente de la boleta / rótulo** | 2 | «6 cuentas con 73.8%» (la herramienta no publicaba el peso); «la brecha total … de esas 5 cuentas» (la palabra «total» pesa más que el alcance dicho) ⏳ |

⏳ = vigente (3). **La raíz común:** el Notario decide «de quién es esta cifra / quién reclama este extremo / a qué se
refiere esta palabra» con **ventanas de caracteres y listas de palabras**, no con la **estructura de la frase**
(sujeto, objeto, paréntesis, dos puntos, coordinación, negación). Cada cierre de hoy agregó una excepción local a un
chequeo; el siguiente borrador trae otra forma. No se corrige uno por uno: se corrige poniendo un solo lector de
cláusula debajo de todos los chequeos de atribución.

## Los dos residuales conocidos

- **«$14K frenados» después de «lo que más vende:»** — vigente. Es el caso puro de la raíz común: la métrica del otro
  lado de los dos puntos no puede atarse a una cifra que trae su propio descriptor pegado. «frenados» no puede entrar
  como vocabulario de capital («75% del frenado total» es una participación y ardería): lo resuelve el lector de
  cláusula (los dos puntos abren otra cláusula), no una palabra más.
- **Porcentajes derivados/inventados por coincidencia aritmética** — medido en los 12 borradores: **hoy la exposición
  es cero** (todo porcentaje de los 12 está en la boleta; el único caso real, 73.8 %, entraba por ahí porque la
  herramienta no lo publicaba, y ya se publica con su grupo). El riesgo sigue latente: un porcentaje inventado pasa
  si coincide con la razón entre dos montos cualesquiera de la boleta («68.4%» pasa). Cerrarlo exige que los
  emisores publiquen los porcentajes de corrido que hoy no publican (YoY del negocio, participaciones) y que el
  catálogo exija los operandos dichos, como ya hace el nivel 1: **15 gates** dependen de esas cuentas de corrido — es
  un trabajo acotado y mecánico, no un parche.

## Qué haría, en este orden (para dejar la auditoría limpia)

1. **Lector de cláusula compartido** en el muro: para cualquier cifra o marcador devuelve su cláusula (cortada por
   `. ; : —` y paréntesis), el sujeto, el referente de un pronombre objeto (hasta dos oraciones atrás), las listas
   coordinadas y el alcance de una negación. Lo consumen los ocho chequeos de atribución (cifra sin dueño, total mal
   atribuido, métrica mal atribuida, alcance promovido, reclamante del superlativo, «de eso», variación, coincidencia).
   Cierra los 3 falsos positivos vigentes y la familia entera.
2. **Cobertura de orden:** rankings declarados de cobranza (vencido, recuperado, días) en la proyección; el
   superlativo con la cifra entre la métrica y el marcador; «y más X» encadenado; el grupo plural verificado como
   top-N; el candado del plural solo pegado al marcador.
3. **Cobertura de grupos:** `grupo` en todo agregado de la boleta (promedios de markup, subtotales «5 materiales»,
   «6 sobre el nivel», top-N); las referencias por pronombre juzgadas cuando la lista está en el mismo párrafo;
   «N de M» contra el conteo declarado.
4. **La lotería del catálogo:** publicar los porcentajes de corrido y exigir operandos dichos (15 gates).

Medida de salida: `_auditoria_notario_gate` sin pendientes (cobertura y precisión sobre los 12 borradores en 100 %),
suite verde sin red. Después, una única corrida final de los dos prompts.
