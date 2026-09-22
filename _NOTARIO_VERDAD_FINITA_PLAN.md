# El Notario de verdad finita — plan de fondo (arquitecto, 2026-09-17)

> Mandato del owner: «La prosa puede ser infinita; la verdad de ADI debe ser finita, gobernada y verificable. Una tabla, una lista, un
> párrafo o una forma nueva de decir algo no deberían crear una nueva forma de mentir. ADI entiende y razona → trabaja sobre verdades
> empresariales verificables → interpreta → redacta libremente. Y Notario verifica esas verdades, no intenta reconstruirlas después desde
> cualquier forma posible de lenguaje.» Metas: ADI natural y premium · 0 falsedades servidas · muy pocos falsos positivos · omisión de
> hechos ≤ 5 % · respuesta premium como camino normal · Comercial, Cobranza e Inventario bajo el mismo estándar · una redacción nueva no
> obliga a crear una nueva regla de seguridad. Primero el plan; sin implementar; sin deploy; sin gasto vivo.

Cómo se hizo este plan: tres lectores levantaron el mapa del código con evidencia (archivo:línea), cuatro arquitectos propusieron diseños
independientes con lentes distintos (prosa anclada · la casa renderiza · el menor cambio · abogado del diablo del diseño actual) y cuatro
escépticos atacaron cada diseño con prosa concreta contra la boleta real del demo (22 ataques por diseño). Todo offline, sin tocar código.
El plan es la síntesis del arquitecto: el diseño elegido, corregido con lo que los escépticos demostraron.

---

## 0 · La conclusión en una página

**Dónde está la dependencia equivocada.** Hoy la verdad se **reconstruye** desde la prosa, después de que el modelo ya la declaró. El
turno produce tres textos —la prosa, la declaración (sujeto, métrica, universo, base, fragmento) y la boleta (rótulos)— y el Notario los
enlaza leyendo lenguaje en los tres: (1) `presencia.js` busca en la prosa todo lo que parece un hecho y quién es su dueño (774 líneas,
240 expresiones regulares, 62 excepciones «no es punto si…»); (2) `juez.js` ubica el fragmento declarado y lee alrededor de qué métrica
habla y de quién es (739 líneas, 173 regex, un lector de cláusula de 466 líneas); (3) hasta el lado «finito» vuelve a leer texto: el
universo es una frase que 15 regex convierten en conjunto, la base de una tasa se lee en 90 caracteres tras la cifra, el predicado de un
conteo se casa por tokens, cada estado tiene dos regex distintas, la métrica se casa por 44 familias de sinónimos. Cada forma nueva de
redactar —una tabla, una elipsis, una base antes de la cifra, un universo compuesto, un estado con otra palabra— abre un caso en alguna
de las tres lecturas. Cuatro rondas adversariales lo midieron: 69 → 91 → 100 → 108 roturas, y en la ronda 4 el 44 % de los hechos
verdaderos bien declarados se frenó por la forma. **La unidad de verificación es el tramo de prosa; tendría que ser el hecho.**

**La solución.** Invertir la relación: **la verdad se identifica, no se describe.** Cada hecho que el modelo puede afirmar existe antes
como un objeto con identidad en el *libro de hechos* del turno (`h12`: Lider · Saldo vencido = $4,6M) o como una expresión tipada sobre
esos objetos que la casa evalúa (`razon(h3, h1)`, `orden(saldo_pendiente, universo{…})`, `estado(Sodimac, al_dia)`). La prosa es libre,
pero cada hecho va **anclado en su sitio** con la marca de su identidad: `⟦h8 h3: el que más te debe es Lider, con {h3} pendientes⟧`.
El Notario deja de buscar puntos, dueños, métricas, universos y bases en la prosa. Comprueba una lista cerrada de catorce cosas, ninguna
de las cuales es gramática: que todo hecho anclado existe y es verdadero; que fuera de las anclas no hay léxico de hecho (números,
comparativos, estados, direcciones: una clase cerrada); que dentro de cada ancla no hay nada que el hecho no diga (entidades, números,
métricas, estados, dirección, base, universo, período — por pertenencia y adyacencia, no por sintaxis); que el dueño estructural (fila,
viñeta, oración con una sola entidad) es el del hecho o el ancla lo nombra; que los operadores que cambian el valor de verdad (negación,
tiempo, modalidad, proporción, continuación «también») están dentro del ancla y no fuera; y renderiza los valores desde el hecho.

**Qué gana el producto.** ADI escribe libre —tablas, listas, comparaciones, inversiones, elipsis— y ninguna de esas formas necesita una
regla: la forma es del modelo, la verdad es de la casa. Cinco de las ocho raíces de la ronda 4 se cierran *por construcción* (dueño en
tabla/lista/inversión/pospuesto, posición y forma de la base, álgebra de universos, columnas de cobranza, poda huérfana) y los falsos
positivos de ventana («vende $17,8M con un margen de 21,5 %») desaparecen porque ya no hay ventana. Lo que queda de lenguaje son
**listas de palabras** (datos, no mecanismos): comparativos y ordinales (clase cerrada del idioma), números en palabras (tabla), estados
y métricas de la casa (gobernados por producto), operadores de alcance (lista de ~30). Y su modo de fallo es acotado: una mentira solo
puede pasar si el modelo **no ancla** un hecho **y** la palabra no está en la lista. Eso se mide, se cierra con datos y no vuelve a ser
una regla de sintaxis. El Notario baja de ~6.300 líneas / ~1.000 regex a menos de la mitad.

**Qué NO resuelve, con honestidad.** Una calificación de una entidad con palabras que no son de la casa y sin número («es de fiar»),
si el modelo no la ancla, se sirve. La interpretación (lecturas, prioridades, causas) no se juzga: sigue bajo las leyes del contrato.
La obediencia del modelo a la sintaxis de anclas solo se mide en vivo (gasto a nombrar, más adelante). Todo lo demás se mide offline.

**Qué pido al owner (§8):** aprobar el cambio de arquitectura (en vez de seguir cerrando raíces sobre el diseño actual); aceptar tres
rigideces de producto que compran verdad (los universos restringidos los escribe la casa; los rótulos de tablas y listas usan vocabulario
de la casa; una recomendación de crédito o cobranza sobre un cliente exige un hecho de cobranza anclado); y confirmar dos definiciones
(«la mayoría» y las proporciones pegadas a un hecho se calculan; «casi toda / un puñado» sueltas son lectura).

---

## 1 · Dónde está hoy la dependencia equivocada (evidencia)

### 1.1 El flujo del turno y sus tres lecturas de lenguaje
`bucleAgente.js`: rondas de herramientas → cierre (prosa + bloque `<<AFIRMACIONES>>`) → `juzgar` = muro (`guardC`, chequeos de hecho ya
degradados a detectores) + juez semántico (`juzgarDeclaracion`, juez.js:668-719) → si solo falla la declaración, «declaración sola» con la
prosa congelada (+1 llamada) → reparación completa (+1) → poda por conectores → escalera de respaldo (playbook, línea honesta). Verde =
1-4 llamadas; con los reintentos de hoy, hasta 7.

| Capa | Archivo | Tamaño | Qué lee de la prosa | Por qué no converge |
|---|---|---|---|---|
| Presencia (¿qué se afirma y de quién?) | `presencia.js` | 774 líneas · 240 regex · 4 macro-alternancias de 105-232 formas · 62 puertas «no es punto si…» · 323 frases ejemplo en comentarios | superlativos, relaciones en palabras, grupos, variaciones, estados, duraciones, enteros pelados, números en palabras; el dueño por 17 sub-reglas ordenadas (`_duenoDelPunto`), coordinados, distributiva, aposición, elipsis, ordinal, referida, base; la «envoltura por significado» (`_cubrePorClase`) | es un parser del español ejecutivo escrito como cadena de casos: cada metáfora de posición («le pisa los talones»), cada sintaxis del dueño (inversión predicativa, dueño pospuesto, viñeta padre con texto, elipsis paralela) y cada coordinación («lidera en X y en Y») es una línea nueva |
| Juez (¿la declaración habla de lo que dice la prosa?) | `juez.js` + `ubicar.js` + `lectorDeClausula.js` | 739 + 115 + 466 líneas · 173 regex · `consistencia()` 307 líneas / 86 regex / 31 vetos · `_masCercana` 19 salidas | ubica el fragmento con 5 escalones de tolerancia; lee dueño por cercanía, métrica en ventana ±30/45 chars, período, dirección, negación, estructura, estados/bodega; asiste identidad | la ventana produce los falsos positivos de la ronda 4 («vende $17,8M con un margen de 21,5 %» → `la frase habla de margen`); la cercanía produce las roturas de dueño |
| Verificación «finita» | `verificar.js` · `resolutor.js` · `tasas.js` · `estados.js` · `evidencia.js` | 1.301 + 464 + 293 + 99 + 318 líneas · 276 regex literales en la verificación | `universo` como frase (`_conjuntoDeUniverso`, 80 líneas, 15 regex), `base` en 90 chars tras la cifra (`leerBase`), predicado del conteo por tokens, `re` y `prosa` distintas por estado, dirección/signo/«juntos» leídos del fragmento (R10/R14), período por regex, matiz por regex, métrica por 44 familias de sinónimos + 120 líneas de vocabulario del muro, el rótulo de la boleta re-parseado por el índice | el lado que debía ser finito recibe strings y los interpreta; las raíces 2, 3 y 4 de la ronda 4 (umbrales en palabras, álgebra de universos, posición de la base) viven aquí |

### 1.2 La verdad finita que YA existe (y se reutiliza entera)
29 rankings tipados de la proyección (12 cliente · 5 marca · 9 SKU · 3 bodega) · 6 estados de la Mesa Capital SKU por SKU con bodega ·
8 estados con definición numérica (`estados.js`: al día = vencido 0, en mora, sin deuda, sin pagos, en quiebre, sin venta, rota bien/lento)
· 9 tasas con base declarada (`tasas.js`) · 16 familias de conjuntos derivados · ~18 fórmulas (cocientes, sumas, diferencias, pp,
variaciones) · el valor como comprobante · el juicio por tipo (`_cifra`, `_orden`, `_topk`, `_relacion`, `_grupo`, `_conteo`,
`_variacion`, `_estado`) · el índice de evidencia (figs con entidad/eje/concepto/unidad/grupo/cobertura, `resolverEntidad`, `estadosDe`,
`dias`) · la geometría de tablas/listas/encabezados (`estructura.js`) · el colector tipado de los composers (`declarar.js`) · la carta de
hechos (`carta.js`) · el precedente del owner de agosto: el bloque `[[CALCULO]]` («la respuesta puede ser natural; el contrato de
verificación debe ser estructurado», con id, operación, inputs y cascada). **Nada de esto se tira: cambia de dónde recibe sus entradas
(objetos con id en vez de strings) y deja de leer prosa.**

### 1.3 Lo que la ronda 4 demostró, en estos términos
De 108 roturas confirmadas, **0 fueron veredictos falsos del verificador sobre una declaración**: todas viven en la frontera (qué es
punto, quién es dueño, cómo se lee universo/base/estado) — es decir, en las tres lecturas de lenguaje. Y el 56 % de lo verdadero se
frenó por esas mismas lecturas. El diseño actual ya hace bien lo finito; falla en reconstruir lo infinito.

---

## 2 · El diseño: libro de hechos + prosa anclada

### 2.1 El libro de hechos del turno (la verdad, con identidad)
Cada resultado de herramienta ya produce figs («Lider · Saldo vencido = $4,6M»). Se les da **identidad estable** dentro del turno
(`h1…hN`) y el modelo las ve así en `[HERRAMIENTAS] Resultados` (`cifras: [{id, label, valor}]`). Los rankings, conjuntos, estados y
referencias (benchmark, techo de cobertura, piso de rotación, umbral de materialidad) también son direccionables por clave. La carta de
hechos (`carta.js`) pasa de publicar *nombres* a publicar **claves e ids**: las 20 claves de métrica de la casa (`ventas · margen ·
contribucion · carga · brecha · no_capturada · saldo_vencido · saldo_pendiente · saldo_por_vencer · abonado · recuperado · dias_vencido ·
capital · capital_frenado · capital_inmovilizado · rotacion · dias_inventario · dias_sin_venta · stock · costo …`), los 14 estados
canónicos con su definición, los conjuntos con id y tamaño, los rankings por eje, las referencias con id, las cuentas permitidas.
Ninguna cadena libre viaja hacia la verificación: el modelo **elige** entre lo que la carta publica.

### 2.2 El álgebra de hechos (derivaciones tipadas; los universos como filtros)
Los tipos de hoy (cifra · orden · relacion · grupo · conteo · variacion · estado · lectura) se conservan; cambian sus campos: todo
campo semántico es obligatorio y enumerado (lo que falte → `faltas` → no-verificable; nada se adivina desde la prosa). Nuevos:
- **`ref`** — un hecho de la boleta por id: `{"id":"h2","tipo":"ref","de":"c17"}` (o directamente el id de la fig si la casa los emite
  como `h`). No hay casado de métrica ni resolución de nombre: es la fig.
- **`razon`** — `{num:{sujeto, metrica | id}, den:{sujeto, metrica | id}, valor?}` → cociente evaluado por la casa con las dos lecturas
  (cruda e impresa) de `_cuentaSobreBase`. Sin lista blanca de pares: «Lider debe el 55 % de lo que compró» = `razon(pendiente, ventas)`;
  «tiene frenado el 64 % de su capital» = `razon(Valparaíso·capital_frenado, Valparaíso·capital)`. **La base deja de ser un campo
  libre**: una tasa de la casa (`cifra` con clave `margen`) trae su base por catálogo (`TASAS_DE_LA_CASA`); cualquier otra base es una
  `razon` con denominador explícito.
- **`derivada`** — `{op: suma|diferencia|pp|variacion_relativa|producto, de:[ids], valor?}` (los `[[CALCULO]]` del muro siguen siendo
  evidencia).
- **`universo` tipado** — `{eje, base?: id-de-conjunto|todos, estados?:[canon], no_estados?:[canon], bodega?, filtros?:[{metrica, op:
  > >= < <= == entre, valor|ref, unidad: days|money|pct|pp|count|ratio}], top?:{metrica, k, direccion}, excluir?:{entidades?, conjuntos?,
  estados?, bodega?, top?}, union?:[…]}` → conjunto = (base ∩ estados ∩ ¬no_estados ∩ bodega ∩ filtros) − excluir, ∪ union. La casa lo
  evalúa con las primitivas que ya existen (`_conjuntosConocidos`, `_conjuntoPorUmbral`, `_topKDe`, `_skusEnBodega`, `_todosDelEje`).
  «Fuera del top 3», «sin mora y bajo el benchmark», «fuera de Santiago» sobre SKU, «ni frenados ni en sobrestock», «entre 200 y 300
  días», «más de un trimestre de mora» (la instrucción publica la tabla mes = 30 · trimestre = 90 · semestre = 180 · año = 365 días)
  son objetos, no frases. **La raíz 3 y la raíz 2 desaparecen por construcción.**
- **`conteo`** `{n, m?, de: universo}`, **`grupo`** `{miembros|de: universo, metrica, agregado: suma|promedio|participacion, valor?}`,
  **`orden`** `{sujeto, metrica, orden:{forma, k?, direccion OBLIGATORIA}, universo}`, **`relacion`** `{sujeto, metrica, relacion:{forma,
  k?, matiz: enum, direccion}, vs:{sujeto|grupo, metrica?}, suma?}`, **`variacion`** `{…, periodo: anterior|presupuesto}`, **`estado`**
  `{sujeto, estado: canon del enum, bodega?}` — con las decisiones de producto: «al día / sin vencidos / sin mora» = vencido 0 al corte;
  «buen pagador / paga bien / cumple plazos» NO es un estado declarable (exige historia): existe en el catálogo como estado *sin
  verificador* → siempre no-verificable → no puede anclarse ni servirse como hecho; «no deja contribución» = contribución ≤ 0 y «no deja
  margen» = margen ≤ 0 (dos estados, dos métricas); «mayoría» = razon o conteo con n/m > 50 %; polaridad por métrica en una tabla de la
  casa (rotación, margen, ventas, recuperado: más es mejor; días vencido, vencido, carga, brecha, días sin venta: más es peor).
- **`propuesta`** (injerto del diseño 2) — un número del asesor que no es de la boleta (un abono del 30 %, bajar el plazo de 60 a 30
  días, «si le subes 2 puntos»): `{valor, unidad, de?: metrica}` sellado «criterio mío», renderizado con el sello y juzgado solo por el
  contrato de conducta, nunca contra la boleta. Sin esto, cuantificar una recomendación quedaría prohibido para siempre.
- **`lectura`** `{sello, apoyo?:[ids]}` — sin cifras dentro; el apoyo es el grafo de dependencia (para la poda residual).
- **El libro devuelve la verdad de lo falso como hechos nuevos con id**: si el modelo pide `estado(Sodimac, al_dia)` y es falso, el
  libro responde «✗ h13 — falso: h13a Sodimac · en mora ✓ · h13b Saldo vencido = $1,9M ✓ · h13c Días vencido = 251 ✓», usables en la
  misma reescritura. Sin esto, el modelo descubre verdades sin id y no puede escribirlas (lo señaló un escéptico).

### 2.3 La prosa anclada (contrato v3)
Una sola salida por turno, **el bloque primero y la prosa después** (así el modelo escribe sabiendo qué hechos usará):

```
<<HECHOS>>
{"id":"h1","tipo":"ref","de":"c04"}                       ← Lider · Ventas = $17,8M (id de la boleta)
{"id":"h3","tipo":"ref","de":"c09"}                       ← Lider · Saldo pendiente = $9,8M
{"id":"h8","tipo":"orden","sujeto":"Lider","metrica":"saldo_pendiente","orden":{"forma":"max","direccion":"mayor"},"universo":{"eje":"cliente"}}
{"id":"h9","tipo":"razon","num":{"id":"h3"},"den":{"id":"h1"}}
{"id":"h12","tipo":"estado","sujeto":"Jumbo","estado":"al_dia"}
{"id":"h14","tipo":"conteo","n":3,"de":{"eje":"cliente","filtros":[{"metrica":"dias_vencido","op":">","valor":90,"unidad":"days"}]}}
{"id":"h20","tipo":"lectura","sello":"criterio mío","apoyo":["h3","h8"]}
<<FIN>>
Te va bien en venta y mal en cobranza, y el problema tiene nombre.

| Cliente | Venta | Vencido | Pendiente |
|---|---|---|---|
| Lider | {h1} | {h2} | {h3} |
| Falabella | {h4} | {h5} | {h6} |

⟦h7: Falabella es la que más vende⟧, pero ⟦h8 h3: el que más te debe es Lider, con {h3} pendientes⟧: ⟦h9: el {h9} de lo que le vendiste⟧.
⟦h10: Su vencido casi duplica el de Falabella⟧ y ⟦h11: lleva {h11} de atraso⟧. ⟦h12: Jumbo está al día⟧; ⟦h14: {h14.n} cuentas superan
{h14.umbral} de mora⟧. ⟦h20: Yo llamaría hoy a Lider y le pediría un calendario de pago antes de venderle más.⟧
```

Lo que el usuario ve es la misma prosa sin marcas y con los valores renderizados por la casa (`{h1}` → «$17,8M» en el canon de la
boleta; `{h14.umbral}` → «90 días»; `{h9}` → «55 %»). Reglas de la sintaxis: ancla = `⟦ids: tramo⟧` (alias tolerado `[[ids: …]]`);
placeholders `{id}`, `{id.n}`, `{id.m}`, `{id.k}`, `{id.umbral}`, `{id.universo}`, `{id.rel}`, `{id.estado}`, `{id.base}`; un
placeholder suelto es su propia ancla (por eso una celda de tabla es solo `{h1}`); un ancla puede llevar varios ids (sujeto coordinado,
superlativo con cifra) y un id varias anclas; sin anidar; el modelo puede escribir el valor dentro del ancla («con $9,8M pendientes») —
la casa lo contrasta con el hecho y lo reemplaza por el canon— o dejar el placeholder. Las lecturas se anclan como `lectura` (sin cifras
dentro; los hechos que citan van en su propia ancla). Todo lo demás es texto libre.

### 2.4 Lo que el Notario comprueba (la lista cerrada: catorce comprobaciones, ninguna es sintaxis)
Cada comprobación dice de qué está hecha: **[S]** sintaxis de las anclas · **[V]** verdad tipada · **[L]** lista cerrada de palabras ·
**[P]** posición (adyacencia, orden en el tramo) · **[G]** geometría (tabla, viñeta, encabezado, oración cortada por «. » y «\n»).

1. **Forma [S]** — anclas balanceadas, sin anidar, ids existentes, placeholders válidos; la prosa servida = prosa sin marcas + valores
   renderizados, byte a byte.
2. **Verdad [V]** — cada hecho del bloque se evalúa con `verificar.js` sobre objetos tipados (sin texto): falso o no-verificable = veto
   con la verdad al lado (y con la verdad como hechos nuevos, §2.2). Un ancla de un hecho falso es imposible: no llega a existir.
3. **Fuera de las anclas no hay léxico de hecho [L]** — dígitos, `%`, `$`, `pp`, K/M/B; números en palabras y fracciones (tabla cerrada
   0-999, mil, millón, mitad, tercio, cuarto, «uno de cada»); ordinales y comparativos/superlativos (clase cerrada del idioma: más/menos
   + que|de|adjetivo de la casa, mayor/menor/peor/mejor, el/la que más, primero…último, lidera, encabeza, supera, duplica, doble, mitad,
   veces, parecido, a la par, similar, principal, número uno, top); estados de la casa (UNA lista por estado: `re` = `prosa`); verbos
   de variación (crece, cae, sube, baja…); duraciones (desde hace, lleva N, meses, trimestre); palabras de proporción («la mayoría»,
   «casi todo», «buena parte», «un puñado», «la mitad»). Excepciones finitas: enumeradores al inicio de línea, años, fechas, y los
   comparativos/números en palabras que **no** van con una entidad, un sustantivo de la casa o una unidad en la misma oración («dos
   cosas que haría», «lo más urgente», «en primer lugar» son retórica, no hecho). Un hit = `hecho-sin-ancla` → re-anclaje. Aquí vive el
   residuo (§2.7): la lista puede tener huecos, y solo importa si además el modelo no ancló.
4. **Dentro del ancla, solo lo que dicen sus hechos [L+P]** — (a) entidades nombradas ⊆ roles de los hechos (sujeto, vs, miembros,
   bodega, sujeto de num/den) — con el **catálogo de alias** que publica la casa desde el dato (marca + familia + descripción: «la
   secadora de LG» = LG-DRYER8KG), no con alias heurísticos; (b) cada número, a su precisión, ∈ valores del hecho (valor, lados, k, n,
   m, umbral); un pp dicho como % es otro canon; (c) cada palabra de métrica de la casa ∈ métricas de los hechos (numerador,
   denominador, filtros, columna), y **adyacente** (≤ 2 tokens) a un placeholder o número de un hecho que la tenga — así «{h3}
   vencidos y {h2} pendientes» con los ids cruzados es veto aunque los dos hechos sean verdaderos; (d) cada palabra de estado = el estado
   del hecho o su complemento bajo negación (paridad de negadores; las formas negativas del catálogo —«nada vencido», «no tiene mora»—
   ya son al día); (e) dirección (más/menos/peor/mejor, sube/baja) compatible con el hecho según la polaridad de la métrica; (f) en una
   relación, la primera entidad del tramo es el sujeto y la segunda el `vs`, o se usa `{id.rel}` (la casa escribe «Lider debe casi el
   doble que Falabella» con los dos nombres); (g) las **preposiciones de base** («sobre», «de lo», «del», «respecto de», «en relación
   a», «por cada», «de cada») exigen, dentro del ancla, una palabra de métrica de la casa igual a la base del hecho o `{id.base}` —
   «sobre lo que le cuesta» no pasa, «sobre el costo» se contrasta (margen tiene base venta → veto); (h) **los universos restringidos
   los escribe la casa**: si el universo tiene filtros, exclusiones, top o estados, el ancla lleva `{id.universo}` y no puede traer
   otras palabras de universo (números, «fuera/salvo/entre/sin», estados, adjetivos de rango) — así «entre las tres que más te
   compran» siempre se ve y siempre es el universo evaluado; (i) las palabras de estado dentro de un conteo/grupo/orden ∈ estados del
   universo (un conteo por días > 90 no puede decir «en mora»); (j) los roles de un cociente son visibles: nombre, posesivo («su»,
   «sus» → el sujeto del ancla) o `{id.base}`; (k) sin pronombres de tercera («le, les, lo, la, su, sus») en un ancla cuyo hecho tiene
   un solo rol (el cruce de dominios por pronombre no cabe); (l) en un ancla de orden, cada «en + sustantivo» es la métrica del hecho
   o una entidad/bodega (universo): «lidera en venta y en volumen» exige dos órdenes; (m) sin dominio cruzado: cada hecho lleva su
   dominio (comercial · cobranza · inventario, lo da la carta) y un ancla no trae palabras de otro dominio salvo que ancle también un
   hecho de ese dominio («$4,6M en mercadería que no se mueve» sobre un vencido: veto).
5. **Núcleo del ancla [L]** — un ancla de estado/orden/relación/variación/conteo contiene su núcleo: un placeholder del hecho o una
   palabra de la clase del hecho. «⟦h12: también Jumbo⟧» no afirma nada por sí misma y hereda lo de al lado: veto `ancla-sin-nucleo`.
6. **Continuación [L+P]** — una proforma de continuación («también», «tampoco», «igual», «lo mismo», «ídem», «asimismo», «ni hablar de»)
   dentro de un ancla, o en un tramo que sigue a un ancla, hereda la clase del ancla anterior de la misma oración: el ancla debe traer un
   hecho de esa clase para su sujeto («Falabella lidera en venta, y en deuda también» exige un orden de deuda para Falabella → falso →
   no se escribe).
7. **Operadores fuera del ancla [L]** — en una oración con anclas no puede quedar fuera de ellas un operador que cambie el valor de
   verdad: negación («no, ni, nunca, jamás, tampoco, nadie, nada, lejos de, dista de, no es cierto que, es falso que, sería un error
   pensar que»), tiempo («antes, ya no, dejó de, hasta, era, solía, este mes, el año pasado, en el presupuesto» y los marcadores de
   período), modalidad («si + subjuntivo, debería, podría, supuestamente») y proporción. Dentro del ancla se juzgan: negación → 4(d);
   período → debe ser el del hecho (`actual | anterior | presupuesto | corte`); modalidad → veto (un hecho no es hipotético);
   proporción → exige una `razon`/`conteo` en el ancla («casi todo vencido» junto a un pendiente exige la razón, y la casa la calcula).
8. **Dueño estructural [G]** — el sujeto de cada hecho anclado está nombrado en el ancla, o es el dueño de la fila / columna
   transpuesta / viñeta padre («- Lider: …», «- **Lider** — …», «1. Lider —») / encabezado («### Lider», «**Lider**», «Lider:»), o
   el ancla es un placeholder suelto en una oración cuya única entidad del eje es ese sujeto. Si no, `sujeto-invisible`. Una entidad
   nombrada en un tramo con anclas y sin hecho propio en ellas es `entidad-sin-hecho` (el dueño pospuesto falso, la inversión
   predicativa falsa y la aposición falsa caen aquí sin leer sintaxis).
9. **Columnas y rótulos [G+L]** — en una tabla todas las anclas de una columna tienen la misma métrica (y base y período); la cabecera
   es una palabra de métrica de la casa, un estado o `{col:metrica}`, y esa métrica es la de la columna (sin puentes: «Vencido» no
   acepta el pendiente); bajo una cabecera de estado o booleana («¿Al día?») cada celda es un ancla de estado renderizada («Sí»/«No»
   libres = veto). En una viñeta o celda «rótulo: cifra», el rótulo contiene una palabra de métrica de la casa igual a la del hecho
   («ya te entró: {h3}» = veto; «abonado: {h21}» pasa).
10. **Predicación sobre una entidad [L]** — una oración (o tramo) que nombra a un cliente, un SKU o una bodega y contiene una palabra
    del **dominio** de la casa (cobranza: pago/pagar/paga/cobro/cobranza/mora/deuda/vencido/atraso/plazo/cupo/crédito/abono/factura/
    puntual; inventario: stock/inventario/bodega/rotación/frenado/parado/dormido/agotado/quiebre/mercadería/existencias; comercial:
    venta/vende/compra/margen/contribución/precio/costo/descuento) debe contener un ancla de un hecho de ese dominio para esa entidad.
    Cambia la unidad de la regla: no la palabra del estado («impecable», «como un reloj», «tranquila») sino el dominio del que se
    habla. «Sodimac es impecable en pagos» → «pagos» + Sodimac sin hecho de cobranza → veto → el modelo ancla el estado de Sodimac →
    es «en mora» → reescribe. Costo: un re-anclaje cuando el modelo olvida; nunca una falsedad.
11. **Recomendación con apoyo [L+V]** — ley de producto: una recomendación de crédito o cobranza que nombra a un cliente (ampliar/
    mantener/soltar cupo, seguir despachando, no llamar, priorizar, apurar, plan de pago) es una `lectura` con `apoyo` que incluye al
    menos un hecho de cobranza verdadero de ese cliente en la respuesta; una lectura de inventario, uno de inventario. Sin apoyo del
    dominio: `recomendacion-sin-apoyo`. Así «yo le subiría el cupo a Sodimac: se lo ha ganado» no puede escribirse sin haber anclado
    que Sodimac está en mora.
12. **Render [V]** — cada placeholder se sustituye por el valor del hecho verificado en el canon de la casa (decimal con punto, escala
    de la boleta); un valor escrito por el modelo dentro del ancla se contrasta a su precisión y se reemplaza; los estados por su
    nombre; los universos restringidos por plantilla («fuera de las 3 cuentas que más venden»); las relaciones por `{id.rel}` cuando
    el modelo lo pide. **Ningún dígito de la pantalla lo escribió el modelo** — propiedad medible por diff.
13. **Leyes de la casa que no son de hecho** — registro formal, formato-de-informe, causalidad sin respaldo, criterio marcado, el
    contrato de dominios: corren sobre el texto renderizado, como hoy. El muro (`guardC`) queda solo con sus leyes de conducta; sus
    chequeos de hecho (ya degradados a detectores) se retiran.
14. **Poda residual [G]** — solo en el camino excepcional (el modelo no arregla tras un reintento): se quitan los tramos con anclas
    inválidas y las lecturas cuyo `apoyo` las cite; sobrevive si queda al menos un hecho de la boleta; si no, respaldo. No hay poda por
    conectores: la dependencia está declarada en `apoyo`, no se lee.

### 2.5 El flujo del turno (una llamada en el camino normal)
1. Rondas de herramientas como hoy (la boleta llega con ids).
2. **Cierre**: el modelo emite `<<HECHOS>>` + prosa anclada en una sola salida. La casa evalúa el bloque (comprobación 2), corre 1 y
   3-11 sobre la prosa, renderiza (12) y juzga las leyes (13). Verde → se sirve. **1 llamada** (más las rondas), como hoy.
3. **Re-anclaje** (+1, prosa congelada salvo los tramos señalados): solo fallaron 1, 3-11 (léxico sin ancla, ancla inconsistente, sujeto
   invisible, rótulo sin métrica, operador fuera, recomendación sin apoyo…). El mensaje lleva ids y tramos exactos; el modelo devuelve
   la misma prosa con las anclas corregidas (puede agregar hechos al bloque). Reemplaza a la «declaración sola» de hoy, con una
   diferencia: sí puede arreglar lo que se cobra.
4. **Reescritura** (+1): un hecho es falso o no verificable. La multa lleva el id, la verdad y **la verdad como hechos nuevos con id**;
   la prosa se reescribe solo en los tramos afectados (el resto congelado). Reemplaza a la reparación completa.
5. Poda residual (0 llamadas) y escalera de respaldo como hoy — pero los composers de la escalera **emiten anclas nativas** (ya
   declaran tipado con `crearDeclarador`): un solo camino de verificación para el cerebro y para la casa; `declaracionDeRespaldo`
   (re-leer la prosa del composer con regex) desaparece.
6. Máximo teórico de llamadas: igual o menor que hoy (≈ 6). Esperado: media menor, porque desaparecen las llamadas que hoy se gastan
   sin poder arreglar nada (el 56 % de verdaderos frenados por ventana). **Modo de dos emisiones** (hechos → libro → prosa, +1 llamada
   siempre) queda como opción por tipo de turno (encargo triple) si la medición de E3 muestra reescrituras frecuentes: se decide con
   datos, no ahora.

### 2.6 Lo que desaparece, lo que queda, lo que nace
**Desaparece (≈ 3.400 líneas y ≈ 800 regex):** `presencia.js` entero salvo sus listas de palabras (que pasan a `lexico.js` como
datos); `juez.consistencia()`, `_masCercana`, `asistirIdentidad`, `completarBodegas`, ventanas y lecturas de período/dirección/
negación; `ubicar.js` (las anclas se ubican solas); `lectorDeClausula.js` en el camino del Notario; en `verificar.js` el parseo de texto
de universos, umbrales, exclusiones, negaciones, top-k y predicados de conteo, la lista blanca de pares de razón, el signo/dirección/
«juntos» leídos del fragmento; en `resolutor.js` R9, R10 y R14 (lecturas del fragmento); en `tasas.js` `leerBase`/`_leerExpresion`; en
`estados.js` la segunda regex por estado; en `declaracion.js` el campo `texto`, la instrucción v2 y `declaracionDeRespaldo`; en
`bucleAgente.js` la poda por conectores, la multa leída con regex y la «declaración sola»; los chequeos de hecho del muro.
**Queda (entradas tipadas, sin leer prosa):** el juicio por tipo de `verificar.js`, los constructores de conjuntos, `tasas.js` como
catálogo y evaluador de `razon`, `estados.js` como catálogo (una regex por estado + verificador + polaridad), el índice de evidencia,
`estructura.js` (ampliado: viñeta padre con texto, encabezado con estado, columnas homogéneas), `declarar.js`, `carta.js` (con ids y
claves), el bucle (rondas, reintentos, escalera), los gates y el banco adversarial (con protocolo v3).
**Nace:** `hechos.js` (libro con ids, álgebra tipada, evaluación de universos, `razon`, `derivada`, `propuesta`, la verdad de lo falso
como hechos), `anclas.js` (parser, comprobaciones 1 y 3-11, render, medida), `lexico.js` (todas las listas como datos: métricas por
dominio, estados, comparativos, proporción, operadores, proformas, números en palabras, alias por tenant), el protocolo v3 en
`declaracion.js` (más corto que el v2: no enseña a reconocer formas, enseña a anclar), `anclar(fig)` para los composers, un conversor
de fixtures v2 → v3, y telemetría por comprobación.

### 2.7 La NLU residual, con honestidad
Queda lenguaje en tres sitios, todos **listas de palabras** (datos), ninguno sintaxis ni dueños ni ventanas:
1. La lista de léxico de hecho fuera de anclas (comprobación 3) y de dominio (10). Números, símbolos, ordinales, comparativos,
   proformas y operadores son clases **cerradas del idioma**: no crecen. Estados, métricas y palabras de dominio son vocabulario **de la
   casa**: crecen con sinónimos («volumen» por unidades, «exposición» por vencido) y se cierran con una línea de datos. **Una mentira
   solo pasa si el modelo no ancla Y la palabra no está**: es una doble falla, se cuenta como residuo y se mide (ronda 5).
2. Las listas dentro del ancla (4c-4m): métricas, estados, dirección, base, dominio. Se aplican sobre un tramo corto con el hecho ya
   conocido: la pregunta es «¿este tramo dice algo que su hecho no dice?», nunca «¿de quién es esto?».
3. Los alias de entidades: los publica el dato del tenant (marca, familia, descripción), no se infieren de la prosa.
Lo que la casa decide **no** leer: la interpretación («Jumbo es el contraste», una prioridad mal razonada), la ironía, la causa sin
«porque» explícito. Siguen bajo las leyes del contrato (causalidad sin respaldo, criterio marcado), como hoy. Y una calificación con
cero vocabulario de la casa y sin número («es de fiar»), no anclada, se sirve: es el residuo declarado; la instrucción al modelo («todo
hecho se ancla») y la regla de dominio son la red, y la ronda 5 lo cuantifica.

---

## 3 · Cómo se comporta con las ocho raíces de la ronda 4 y con los falsos positivos

| Raíz (ronda 4) | Hoy | Con verdad finita + anclas |
|---|---|---|
| 1 · Léxico de estados (`re` ≠ `prosa`; «buen pagador», «sin vencidos», «no rota») | dos listas por estado; lo no listado no es punto | una lista por estado (datos); «buen pagador» es estado sin verificador (no se sirve); y la comprobación 10 (dominio) caza «impecable en pagos» sin conocer «impecable». Residuo: calificación sin vocabulario de la casa. |
| 2 · Umbrales en palabras/meses/rango/POLICY | `_UMBRAL_RE` solo lee dígitos | el umbral es `{metrica, op, valor, unidad}`; meses/trimestre se convierten por tabla; las referencias de la POLICY son ids (`ref: techo_cobertura`). Cerrada por construcción. |
| 3 · Álgebra de universos | 15 regex sobre una frase | universo tipado con exclusión por bodega, top-k, unión, negación, compuestos; y **visible**: `{id.universo}` obligatorio. Cerrada por construcción. |
| 4 · Posición y forma de la base (antes, cabecera, anafórica, posesiva, declarada ≠ dicha) | ventana de 90 chars | la base es el denominador de una `razon` o el catálogo de la tasa; la prosa solo puede nombrarla con vocabulario de la casa junto a una preposición de base (4g) o con `{id.base}`; la columna la fija la cabecera (9). Cerrada por construcción. |
| 5 · Dueño en sintaxis nuevas (inversión, pospuesto, viñeta padre, elipsis paralela, «ni A ni B») | 17 sub-reglas | contención de entidades por ancla (4a), dueño estructural (8), adyacencia métrica↔placeholder (4c), núcleo (5): la posición del sujeto deja de importar. Cerrada por construcción. |
| 6 · Envoltura («lidera en X y en Y», «supera X», «parecido», pp≠%, cifra en universo ajeno, polaridad) | ventana del superlativo | dos métricas = dos hechos (4l); comparadores y «parecido» son léxico cerrado (3) que exige un hecho de relación; pp≠% por canon (4b); una cifra dentro de un universo ajeno cae por 4i/4h; polaridad por tabla (4e). Cerrada salvo vocabulario. |
| 7 · Puente de cobranza entre columnas | el juez exime pendiente/vencido/abonado entre sí | columnas homogéneas y cabecera = métrica de la columna (9). Cerrada por construcción. |
| 8 · Poda huérfana entre párrafos | conectores | un hecho falso no llega a la prosa (2); la recomendación declara su apoyo (11, 14). Cerrada por construcción. |
| FP · «vende $17,8M con un margen de 21,5 %» | ventana del juez lee «margen» | dos anclas; no hay ventana. |
| FP · «vende $A y está frenado en Santiago con $B» | la bodega se lleva la cifra | tres anclas; la bodega es rol del estado (4a); el sujeto único de la oración es el SKU (8). |
| FP · «al día» como universo, estado negado con declaración correcta | no resoluble / se lee sin negación | `universo.estados:[al_dia]` evaluado por definición; negación por paridad (4d). |
| FP · umbral de la POLICY junto al SKU («supera el techo de 120 días») | el 120 se atribuye al negocio | `relacion(h_dias, ref:techo_cobertura)`; 120 ∈ números del hecho (4b). |
| FP · tasa cruzada («debe el 55 % de lo que compró»), fracciones y cifras en palabras («uno de cada cuatro», «casi diez millones») | lista blanca / sin dígito no se lee | `razon` sin lista blanca; tabla de números y fracciones en palabras (4b) con matiz. |
| FP · retórica del asesor («dos cosas», «lo más urgente») | punto por regex | excepción finita de la comprobación 3: sin entidad, sustantivo de la casa ni unidad en la oración, es retórica. |

Ataques de los escépticos sobre el diseño elegido (22): 15 «mienten» en su versión original; cada uno tiene su cierre en §2.4 (núcleo 5,
continuación 6, operadores 7, alias 4a, dominio 10, apoyo 11, universo visible 4h, estado en conteo 4i, roles visibles 4j, pronombre
4k, «en + métrica» 4l, dominio cruzado 4m, adyacencia 4c, lados 4f, período 7, columnas 9, rótulos 9, números en palabras 4b, la verdad
de lo falso con id §2.2). Los que quedan abiertos están en §2.7.

---

## 4 · Cómo se mide cada meta (definiciones operativas, todas offline salvo una)

| Meta | Medida | Hoy | Objetivo |
|---|---|---|---|
| 0 falsedades servidas | `harness turno` (ROMPE = fragmento falso en verde/re-anclado/reescrito) sobre los corpus 1-4 reconvertidos a v3 (328 + 1.042 casos) y la ronda 5; más la propiedad «0 dígitos copiados» (todo número servido proviene de un render) | 108/1.042 en la ronda 4 | 0 en corpus 1-4; en la ronda 5, 0 por sintaxis y el residuo léxico listado por id |
| Muy pocos falsos positivos | % de prosas verdaderas bien ancladas que salen verdes a la primera; % que terminan en respaldo | 44 % verdes · 12 % respaldo (417 verdaderos) | ≥ 90 % verdes · ≤ 3 % respaldo; reportado por comprobación para calibrar las listas con datos |
| Omisión de hechos ≤ 5 % | (hechos afirmados en el primer borrador que no llegan a pantalla por el Notario) ÷ (hechos afirmados) sobre corpus con verdad conocida; aparte, hits de la comprobación 3 (claims sin ancla) como «omisión de ancla» | no medido así (la medida de hoy es «puntos sin declarar»: 2,1 % con declaración manual) | ≤ 5 % |
| Premium como camino normal | % de turnos servidos desde la prosa del modelo (verde · re-anclado · reescrito) vs respaldo; llamadas por turno | 12 % de los verdaderos al respaldo | ≥ 95 % premium · media de llamadas ≤ hoy |
| Mismo estándar en 3 dominios | corpus estratificado por dominio y por cruce; un enum de estados, una `razon`, un álgebra de universos para los tres | tres léxicos desiguales | metas iguales por estrato |
| Redacción nueva sin regla nueva | cada rotura de la ronda 5 se clasifica por lo que la cierra: (i) una línea de datos en `lexico.js`, (ii) una definición de producto, (iii) una regla de sintaxis/ventana/dueño | (iii) fue lo normal en las rondas 1-4 | (iii) = 0; (i) contado y cayendo; líneas y regex del Notario bajan y no vuelven a subir |
| Obediencia del modelo a las anclas | solo en vivo: % de salidas con anclas bien formadas a la primera | — | pilot con gasto nombrado (E6), no ahora |

---

## 5 · Migración por etapas (offline, sin gasto, aprovechando lo que hay)

| Etapa | Alcance | Riesgo | Cómo se mide (gate offline) |
|---|---|---|---|
| **E0 · Esquema y léxico como datos** | `hechos.schema.js` (tipos, enums, universo/razon/derivada/propuesta tipados, obligatoriedad, polaridad por métrica), `lexico.js` (las listas de `presencia.js`/`juez.js`/`guardC` extraídas como datos, por clase y por dominio; alias por tenant desde el dato), ids en la boleta y en la carta, conversor de fixtures v2 → v3 (usa el `texto` declarado como ancla y el bloque como hechos) | el conversor no cubre lo que el v2 dejaba ambiguo (se lista) | `_hechos_esquema_gate`: los 108 + 417 casos de la ronda 4 re-expresados como hechos tipados; conversión ≥ 90 % de los corpus 1-4 |
| **E1 · Verificación tipada** | `hechos.js`: evaluación de universos tipados sobre las primitivas de `verificar.js`, `razon` sin lista blanca, `derivada` con operandos por id, estado/período/matiz por enum, la verdad de lo falso como hechos nuevos; `verificar.js` deja de leer `a.texto`, `universo`/`base` como string | regresión en `_resolutor_gate` (45) y `_notario_semantico_gate` (31): se mantienen con el conversor | modo `hechos` del banco: las raíces 2, 3, 4 y los FP c/d/f/g de la ronda 4 como hechos tipados → 0 falsos «verdaderos», 0 verdaderos bloqueados |
| **E2 · `anclas.js`** | parser, comprobaciones 1 y 3-11, render (12), medida; `estructura.js` ampliado | falsos positivos de las listas (retórica, «más» inocente): se calibran con el corpus de verdaderos | `_anclas_gate`: (a) los 108 cierres de la ronda 4 reescritos con anclas —«la misma mentira dicha con anclas»— 0 servidos; (b) los 417 verdaderos + los 12 borradores + las 24 salidas reales de la fase 3 re-ancladas ≥ 90 % verdes a la primera; (c) «tres redacciones, un veredicto» sobre anclas |
| **E3 · El bucle detrás de un flag** | `ADI_NOTARIO_V3`: protocolo v3 en el system (≤ 1.000 tok, bajo el techo de 4.700), cierre = hechos + prosa anclada, re-anclaje, reescritura con la verdad, render, poda residual, telemetría por comprobación; el camino de hoy byte-idéntico con el flag apagado | latencia y tamaño de salida (+10-20 % de tokens por las marcas) | `_notario_semantico_flujo_gate` v3 con guiones: 0 falsedades, ≥ 90 % de verdaderos verdes, llamadas por turno ≤ hoy |
| **E4 · La casa ancla lo suyo** | los composers de la escalera (playbook, encargo compuesto, línea honesta, reformular, respaldo) emiten anclas con `anclar(fig)`; se retira `declaracionDeRespaldo` | 27+ composers con plantilla congelada: se toca solo la envoltura del valor | gates de composers byte-exactos sobre el texto renderizado; `_anclas_gate` sobre sus salidas |
| **E5 · Ronda 5 adversarial offline** | UltraCode ataca los dos canales del contrato nuevo: hechos tipados falsos (¿alguna estructura pasa?) y prosa anclada mentirosa (por diseño, elipsis, inversión, tablas raras, léxico nuevo sin ancla, cruces de dominio) en Comercial · Cobranza · Inventario, más un corpus de prosas verdaderas con voz de asesor senior | que las listas muestren huecos (residuo esperado): se cierran con datos y se cuentan | los criterios de §4; clasificación (i)/(ii)/(iii) de cada rotura; (iii) = 0 |
| **E6 · Retiro y candado** | se borran `presencia.js`, `ubicar.js`, `juez.consistencia` y los parsers de texto de `verificar/resolutor/tasas`; candado anti-resurrección; los chequeos de hecho del muro se retiran | ninguno si E5 pasó | suite `gates:offline` completa; conteo de líneas/regex del Notario como aserción («no vuelve a subir») |
| **E7 · Piloto vivo (gasto a nombrar)** | medir la obediencia real del modelo a las anclas y las llamadas por turno sobre las preguntas de la certificación | el único riesgo que offline no mide | % de salidas bien formadas a la primera; llamadas y costo por turno; 0 falsedades en la muestra |

Cada etapa deja el producto exactamente como estaba con el flag apagado; nada se publica hasta E7 y la decisión del owner.

---

## 6 · Riesgos y cómo se mitigan

| Riesgo | Mitigación |
|---|---|
| El modelo no respeta la sintaxis (olvida marcas, anida, inventa ids, escribe el número fuera) | parser tolerante (alias `[[…]]`, placeholders sueltos), un re-anclaje con los tramos exactos, ejemplo completo en la instrucción; se mide con guiones en E3 y en vivo en E7; el flag deja el camino de hoy |
| Rigidez donde la casa escribe (universos restringidos, rótulos con vocabulario de la casa, relaciones con `{id.rel}`) | son tres sitios chicos, elegidos porque ahí vivían 12 + 4 + 3 roturas; el modelo conserva la oración entera alrededor; se revisa la voz de las plantillas con el owner |
| Listas con falsos positivos («más» inocente, «primero», «la mayor parte» como lectura) | excepción finita por ausencia de entidad/sustantivo/unidad; calibración con los 417 verdaderos y con prosa real; el costo de un FP es un re-anclaje, nunca un respaldo |
| Huecos en las listas (sinónimos nuevos) | doble falla necesaria (sin ancla + sin palabra); la regla de dominio (10) cubre la mayoría; la ronda 5 los cuenta; se cierran con una línea de datos |
| Dos Notarios conviviendo durante E1-E4 | flag; el camino viejo byte-idéntico; candado al retirar |
| El libro tienta a volcar todos los hechos (respuesta densa) | la instrucción pide anclar solo lo que se usa; `formato-de-informe` y el contrato de dominios siguen sobre el render |
| Tokens de salida (+10-20 %) y techo del system | el protocolo v3 es más corto que el v2 (no enseña formas); las reglas de prosa viajan con la carta (no en el caché); se mide en E3 |
| Boleta semi-texto (rótulos que el índice re-parsea) | fuera de este plan; compatible con tiparla después (universo/base/período en la fig) |

---

## 7 · Por qué no seguir cerrando raíces sobre el diseño actual
El abogado del diablo lo defendió con el mejor argumento posible («0 de las 108 roturas son veredictos falsos del verificador; las
raíces son cañería») y su propio escéptico lo tumbó: con las ocho raíces cerradas del modo que él propone, **8 de 24 ataques nuevos
siguen sirviendo una falsedad** (elipsis de estado sin cifra, «lejos de ser», «; en vencido, Sodimac», lectura que implica un hecho,
«impecable / paga como un reloj», la base declarada que pisa la dicha, la relación inventada entre hechos verdaderos de dos ejes) y
5 hechos verdaderos quedan bloqueados. Porque el problema no es cañería: la unidad de verificación sigue siendo el tramo de prosa, y
el tramo se reescribe de infinitas maneras. Cerrar raíces sobre ese diseño es la quinta ronda del mismo ciclo.

---

## 8 · Decisiones del owner
1. **Aprobar el cambio de arquitectura** (libro de hechos + prosa anclada) en lugar de una quinta ronda de cierre sobre el diseño
   actual. Recomendación del arquitecto: sí.
2. **Tres rigideces que compran verdad**: (a) los universos restringidos («fuera del top 3», «entre las que no están en mora») los
   escribe la casa dentro de la frase del modelo; (b) los rótulos de tablas y listas usan vocabulario de la casa («Vencido»,
   «Abonado»; no «Exposición», «ya te entró»); (c) una recomendación de crédito o cobranza sobre un cliente exige un hecho de cobranza
   anclado de ese cliente (y una de inventario, uno de inventario). Recomendación: aceptar las tres.
3. **Dos definiciones**: «la mayoría» = más del 50 % (ya decidido) y, además, **toda proporción pegada a un hecho** («casi todo
   vencido», «buena parte», «la mitad») se calcula como razón; sueltas, «casi toda / un puñado» siguen siendo lectura. Y confirmar que
   «buen pagador / paga bien / cumple plazos» no se sirve como hecho (ni en prosa ni en tabla) hasta que exista historia.
4. **El piloto vivo (E7)** queda para después de E5, con gasto nombrado; no se pide ahora.
5. Orden de trabajo propuesto: E0-E2 primero (todo puro, sin tocar el bucle), medición, y recién ahí E3. Ninguna etapa se publica.

---

## 9 · Estado de las etapas (aprobado por el owner el 2026-09-17; ejecución offline, sin deploy ni gasto)

| Etapa | Estado | Dónde | Medida |
|---|---|---|---|
| **E0 · Léxico como datos + ids** | ✅ dev `28a94311` | `src/adi/notario/lexico.js` (claves de métrica con nombre, conceptos, dominio, polaridad, unidad, muro; unidades de tiempo, períodos, ejes, operadores, listas de modalidad/superlativo/dominio); `asignarIds` en `hechos.js` | reutilizado por E1–E3 |
| **E1 · Verificación tipada** | ✅ dev `28a94311` | `hechos.js` (`libroDeHechos`: ref · cifra · orden · relacion · grupo · conteo · variacion · estado · razon · derivada · propuesta · lectura; universo tipado evaluado en `verificar.js`; la verdad de lo falso como hechos nuevos con id; render de la casa) | `_hechos_gate` 132/132 |
| **E2 · Prosa anclada** | ✅ dev `28a94311` | `anclas.js` (parser `{{ids: tramo}}` / `⟦…⟧`, placeholders `{id.campo}`, render, comprobaciones 1 y 3-11 + tablas + predicación sin hecho) | `_anclas_gate` 79/79: 0 falsedades servidas de 32 ataques · 0 verdaderos bloqueados de 25 formas |
| **E3 · El bucle detrás del flag** | ✅ dev (commit de E3) | `protocolo.js` (instrucción v3: el fijo del agente baja de 4.431 a 4.141 tok; carta de claves; mensajes de re-anclar / reescribir; poda por tramos), `bucleAgente.js` (ids en boleta y resumen, `_juezDeAnclas`, cierre → re-anclaje → reescritura → poda → escalera, telemetría `notario.modo = "anclas"`), `sistemaAgente.js`, `voiceFlags.js` (`ADI_NOTARIO_V3`, apagado en todos los perfiles), `ChatADI.jsx` | `_notario_v3_flujo_gate` 71/71: 0 falsedades · verde a la primera · ≤ 3 llamadas · todo número servido lo escribió la casa · flag apagado = el turno de hoy |
| **E4 · La casa ancla lo suyo** | ✅ dev (commit de E4) | `anclar.js` (`anclarDeclaracion`: el tramo declarado por el composer es el ancla, sin tocar su texto; `anclarPorFigs`: cifras verbatim → placeholders de su ref), `_juzgarPeldano` en el bucle (playbook · encargo · línea honesta · límite bajo el juez de anclas, servidos renderizados); `declaracionDeRespaldo` queda solo en el v2 (se retira en E6); tres composers cambian su DECLARACIÓN, ninguno su texto; calibraciones por significado del texto de la casa (ver §9 abajo) | `_anclar_composers_gate` 57/57: mismo texto y estado con y sin flag en 16 preguntas; 15 peldaños bajo el juez de anclas sin vetos; 140 hechos anclados |
| **E5 · Ronda 5 adversarial + v3.1 «cada palabra tiene dueño»** | ✅ dev (commit de E5) | 888 casos de UltraCode fuera de muestra (`fixtures/ronda5-2026-09-17/`, banco `_ronda5_banco.mjs`, candado `_ronda5_gate.mjs`); la ronda destapó 16 raíces (`_NOTARIO_V31_PROPUESTA.md`) y v3.1 las cerró por diseño: el libro exige lo que la prosa podrá decir (validación de esquema, empates, rankings parciales, razones y derivadas tipadas), cada palabra con carga de verdad dentro de un ancla tiene un dueño de su clase (cotas de proporción, matiz, exclusión, eje, bodega, grupo, operando, sujeto, recomendación, proforma, fuera de las anclas nada), la casa se reconoce a sí misma (cláusula, rótulo, estado del SKU, bodega de la proyección) | turno (888 completos): falsedades 58 % → 0.3 % (1 aceptada de 317) · verdes a la primera 60 % → 60 % · respaldo 31 % → 29 % · libro 0/440 · casa 0/46 · `_ronda5_gate` 9/9 |
| E6 · Retiro y candado | pendiente | `presencia.js`, `ubicar.js`, `juez.consistencia`, parsers de texto | suite completa; conteo de líneas/regex como aserción |
| E7 · Piloto vivo | pendiente (gasto a nombrar por el owner) | obediencia real del modelo a las anclas; llamadas y costo por turno | 0 falsedades en la muestra |

Lo que E3 dejó escrito para E4–E5: la ley del criterio marcado sigue siendo del texto (`juicio-sin-marcar` en guardC): el modelo escribe «criterio
mío» en la prosa de su `lectura`, el `sello` del hecho no lo sustituye; un valor escrito por el modelo dentro del ancla que no coincide con el hecho es
`numero-ajeno` (se cobra, no se corrige en silencio); y dos falsos positivos por significado cerrados en `anclas.js` (la frase de un estado que es el
nombre de una métrica —«sin venta» en «Días sin venta»—; la palabra de dominio dentro del nombre de una métrica de otro dominio).
