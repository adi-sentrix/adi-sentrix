# Notario semántico · fase 1, resultado (2026-09-15, offline, sin corridas ni deploy)

**Principio (owner):** el modelo redacta; el modelo declara qué está afirmando; Notario verifica la afirmación contra la evidencia
estructurada; la redacción no determina la verdad.

Lo construido (todo en `src/adi/notario/`, puro, sin red): el esquema de la afirmación y sus campos obligatorios por tipo
(`afirmacion.js`), el índice de la evidencia —la boleta y la proyección— (`evidencia.js`), el verificador (`verificar.js`) y el detector
de presencia/omisiones (`presencia.js`). Esquema documentado en `_NOTARIO_SEMANTICO_ESQUEMA.md`. Gate: `_notario_semantico_gate.mjs`
(31 aserciones, en la suite offline).

## Los cinco resultados pedidos

| Pedido | Resultado |
|---|---|
| Cobertura de las afirmaciones manuales de los 12 borradores | 1.099 afirmaciones declaradas a mano (923 de hecho, 176 lecturas) por seis etiquetadores independientes. Veredicto igual al esperado: **1.093/1.099 = 99,5 %**. Verificables (no «no-verificable») entre las de hecho: 97,3 %. Por tipo: cifra 463/467 · orden 147/147 · relación 61/62 · grupo 69/69 · conteo 52/53 · variación 85/85 · estado 40/40 · lectura 176/176. |
| FP / FN del verificador | **0 falsos positivos** (verdadera → falsa) · **0 falsos negativos** (falsa → verdadera). Los 18 errores reales de hecho de la auditoría se atrapan como falsa con la verdad al lado (18/18; el 19.º es una ley de la casa, «coincidencia como razón», que sigue en el Notario viejo). Los 17 falsos positivos de la auditoría se sirven como verdaderos (17/17). |
| No-verificables | 25 de 1.099. Donde se esperaba verdadera: 6 — 4 son «$100,0M vs $92,9M»: la venta del año anterior no tiene rótulo propio en la boleta (viaja como `headlineSub`); 1 referente ambiguo («estos clientes», que el propio borrador no cierra); 1 conteo de métricas comparadas («la supera en un punto»). Ninguno se sirve como verdadero. |
| Omisiones | Con la declaración manual, el detector cubre **96,0 %** de los 953 puntos de afirmación de la prosa (38 omisiones: 12 cifras de contexto no declaradas, 10 hechos dichos solo como lectura, 5 órdenes y 5 variaciones dentro de afirmaciones de otro tipo, 6 sueltas). Al QUITAR una afirmación de hecho de la declaración, el detector la extraña en **595/665 = 89,5 %**; otras 258 quitadas son redundantes (su hecho sigue declarado en otra afirmación). Lo que no extraña: órdenes y estados implícitos sin marca léxica («LG-DRYER8KG ($14K, 165 días)» bajo el título «capital frenado», «Es la misma cuenta empujando el crecimiento»). |
| Tres redacciones, un veredicto | Corpus de 96 afirmaciones × 3 redacciones (`fixtures/notario-tres-redacciones-2026-09-15.json`). Mismo veredicto en las tres: **96/96**, y el esperado: **96/96**. Punto de afirmación detectable en las tres: 96/96. El Notario viejo cambia de veredicto entre redacciones equivalentes en **36/96 (37,5 %)** — la medida de lo que el principio corrige. |
| Qué parte del Notario antiguo sigue haciendo falta | Sobre los 12 borradores el Notario viejo dicta 21 vetos DE HECHO (superlativo-no-sostenido 10, cifra-de-grupo-mal-repartida 9, conteo-de-lista-falso 1, coincidencia-como-razón 1): los reemplaza el verificador y sus chequeos quedan como detectores de presencia. Y 11 vetos de LEYES DE LA CASA (juicio-sin-marcar 3, intención-inferida 3, deterioro-no-medido 2, días-etiqueta-incorrecta 1, parte-del-encargo-omitida 1, jerarquía-causal-sin-medida 1): juzgan la respuesta entera, no una frase, y siguen como están. También siguen: el lavado de voz, el registro formal y la escalera del turno. |

## Los candados del owner, como aserciones del gate

- Declaración incompleta (orden sin universo, variación sin período, relación sin el otro lado, conteo sin universo, grupo sin
  entidades, lectura sin sello) → **no-verificable, nunca verdadera**.
- `lectura` no encubre un hecho: una cifra, un orden o una variación sobre una métrica de la boleta dentro de una lectura → `lectura-encubre-hecho`
  (salvo bajo negación, en una recomendación de orden de acción, o cuando otra afirmación de hecho lo declara).
- Lo no verificable no se transforma en verdadero: el veredicto «no-verificable» existe y no se sirve.
- Tres redacciones → un veredicto: por construcción, el verificador no lee la prosa para juzgar.
- Los tres corpus anteriores siguen como regresión en sus gates.

## Lo que la fase 1 dejó anotado para la fase 2 (deudas de la evidencia, no del verificador)

1. La variación de la venta en dinero por cliente viaja con el rótulo «Valor» (emisor `salesRead`), sin significado propio; el
   verificador la acepta solo cuando el cliente trae su variación en %. El emisor debería rotularla («Variación vs año anterior · $»).
2. La venta del año anterior del negocio viaja como `headlineSub` ($92,9M): no se puede verificar «$100,0M vs $92,9M» como venta del
   año anterior. El emisor debería publicar «Ventas del año anterior».
3. La fecha de corte de la cobranza («31 ago 2026») no es una fig; la referencia de días de inventario («120») tampoco.
4. Un rango («entre $6K y $19K») se declara como mínimo y máximo; un conteo de métricas comparadas («la supera en un punto») no es
   verificable estructuralmente.

## Método

Seis etiquetadores independientes declararon las afirmaciones de los 12 borradores con la evidencia a la vista (hojas de la boleta y de
los rankings); cada desacuerdo entre la etiqueta y el verificador se revisó a mano: 14 lotes de correcciones al verificador (ninguna
frase por frase: entidad con artículo, unidad del valor, período «al corte», universos por descripción, conteos dentro de subconjuntos,
enumeraciones, agregados por vocabulario, negación con subordinadas…) y 5 correcciones de etiqueta, todas anotadas en el fixture
(`revision`). Nada en vivo: cero llamadas, gates solo por `npm run gates:offline`.
