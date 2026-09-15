# Notario semántico · el esquema de la afirmación declarada (fase 1, 2026-09-15)

**Principio (owner):** el modelo redacta; el modelo declara qué está afirmando; Notario verifica la afirmación contra la evidencia
estructurada; la redacción no determina la verdad.

Este documento fija la forma cerrada de una afirmación. Vive en código en `src/adi/notario/afirmacion.js` (esquema y normalización),
`src/adi/notario/evidencia.js` (índice de la boleta y la proyección), `src/adi/notario/verificar.js` (veredictos) y
`src/adi/notario/presencia.js` (lo que la prosa afirma y no fue declarado).

## 1. Los campos

Toda afirmación lleva `tipo` y `texto` (el fragmento de la prosa que la expresa, tal cual, para que el detector de presencia sepa qué
cubre). El resto depende del tipo. El vocabulario es el de la BOLETA: `metrica` es el concepto del rótulo (`Entidad · Concepto`) y
`sujeto` un nombre del tenant, una lista de nombres, `"negocio"` (los totales) o `{ "descripcion": "las 5 cuentas materiales" }` (un
agregado descrito).

| Campo | Qué es | Ejemplo |
|---|---|---|
| `tipo` | `cifra` · `orden` · `relacion` · `grupo` · `conteo` · `variacion` · `estado` · `lectura` | `"cifra"` |
| `texto` | el fragmento de la prosa (obligatorio) | `"Lider acumula $4.6M vencidos"` |
| `sujeto` | entidad, lista, `"negocio"` o `{descripcion}` | `"Lider"` · `["Falabella","Lider","Jumbo"]` · `"negocio"` |
| `metrica` | concepto del rótulo de la boleta | `"Saldo vencido"`, `"Contribución"`, `"Brecha al benchmark"`, `"Capital frenado"` |
| `valor` | la cifra dicha, con su unidad, tal como se escribe | `"$4.6M"` · `"47%"` · `"8.6 pp"` · `"269 días"` · `"1.0x"` · `"1.194 unidades"` |
| `universo` | de qué conjunto es (orden, conteo, agregados) | `"los 13 clientes"` · `"las 5 cuentas materiales"` · `"los SKU frenados"` · una lista |
| `periodo` | el marco temporal cuando importa (variación siempre) | `"vs año anterior"` · `"año cerrado"` · `"foto de hoy"` |
| `evidencia` | rótulos de la boleta que la respaldan (opcional; obligatorio para una cifra DERIVADA) | `["Lider · Saldo vencido"]` |
| `sello` | solo `lectura`: `probado` · `indicado` · `abierto` · `criterio mío` | `"criterio mío"` |

Campos propios de cada tipo:

- **orden** → `orden: { forma, k?, direccion?, vs? }` · `forma`: `max` (el que más) · `min` (el que menos) · `puesto` (el k-ésimo, con `k`)
  · `topk` (entre los k primeros / la lista son los k primeros, con `k`) · `comparativo` (A antes que B, con `vs`). `direccion`: `mayor` ·
  `menor` · `peor` · `mejor` (peor/mejor se resuelven con la polaridad declarada del ranking). `universo` obligatorio salvo en comparativo.
- **relacion** → `relacion: { forma, k?, matiz?, vs }` · `forma`: `veces` (k× — «el doble» = 2, «el triple» = 3) · `fraccion` (parte de un
  todo: «la mitad» = 0.5, «el 47 %» → `valor: "47%"`) · `mayor` · `menor` · `igual` · `diferencia` (con `valor`). `matiz`: `"más de"`,
  `"casi"`, `"cerca de"`, `"poco más de"`, `"menos de"` (fija el rango admitido, la misma tabla del juez de la prosa). `vs`: la otra
  entidad, `"negocio"` (el total), o `{ "sujeto": "negocio", "metrica": "Capital frenado" }` cuando la métrica del otro lado es distinta.
- **grupo** → una cifra AGREGADA (suma, promedio, participación) de un conjunto entero: `sujeto` = la lista completa (o `grupo: {entidades}`
  / una `descripcion`), `metrica`, `valor`. Si la lista es un subconjunto del grupo real del agregado, es falsa (cifra de grupo mal repartida).
- **conteo** → `conteo: { n, m?, predicado }` + `universo`: «5 cuentas materiales de las 8 bajo el benchmark» = `{n: 5, m: 8, predicado:
  "cuentas materiales"}`, `universo: "las 8 bajo el benchmark"`.
- **variacion** → `variacion: { direccion: sube|baja|estable, valor? }` + `periodo` (obligatorio) + `metrica` (lo que varía).
- **estado** → `estado: { estado, bodega? }` (inmovilizado · frenado · sobrestock · riesgo de quiebre · capital sano).
- **lectura** → `sello`. Una lectura NO puede llevar dentro un hecho verificable (una cifra, un orden o una variación sobre una métrica
  de la boleta): si lo lleva, es «no-verificable» con motivo `lectura-encubre-hecho` — se declara como el hecho que es.

## 2. Los veredictos

`verificarAfirmaciones(afirmaciones, {figs, datoProyectado, ejesDelTenant})` devuelve, por afirmación:

- **verdadera** — la evidencia la sostiene: cifra dentro de la tolerancia del muro (mismo canon o `tolCalculo`; para tasas, además media
  unidad de la precisión dicha), posición correcta en el ranking (empates cuentan), relación que cierra con el matiz, agregado del grupo
  entero, conteo exacto (y su «de m»), variación con su signo y magnitud, estado declarado.
- **falsa** — la evidencia dice otra cosa; `verdad` trae la cifra o el orden real, para una multa exacta.
- **no-verificable** — no hay evidencia en la boleta, o la declaración no cubre el significado completo (`declaracion-incompleta`: falta
  universo, período, el otro lado de la relación…), o una lectura encubre un hecho. **Nunca se sirve como verdadera.**
- **sellada** — una lectura con sello, sin hecho encubierto.

## 3. Campos obligatorios por tipo (el candado del significado completo)

| tipo | obligatorio |
|---|---|
| cifra | sujeto · metrica · valor |
| orden | sujeto · metrica · orden.forma · universo (salvo comparativo: orden.vs) · orden.k en puesto/topk · direccion en puesto/topk/comparativo |
| relacion | sujeto · metrica · relacion.forma · relacion.vs · k o valor en veces/fraccion/diferencia |
| grupo | metrica · valor · las entidades (o una descripción del conjunto) |
| conteo | conteo.n · predicado · m o universo |
| variacion | sujeto · metrica · variacion.direccion · periodo |
| estado | sujeto · estado.estado |
| lectura | texto · sello |

Lo que falte convierte la afirmación en «no-verificable» (motivo `declaracion-incompleta`).

## 4. Ejemplos (con la prosa que sea)

```json
{"tipo":"cifra","sujeto":"Lider","metrica":"Saldo vencido","valor":"$4.6M","texto":"Lider acumula $4.6M vencidos"}
{"tipo":"cifra","sujeto":{"descripcion":"las 5 cuentas materiales"},"metrica":"Contribución no capturada","valor":"$4.9M","texto":"La brecha estimada de las 5 cuentas materiales es $4.9M"}
{"tipo":"orden","sujeto":"Falabella","metrica":"Contribución","orden":{"forma":"max"},"universo":"los 13 clientes","texto":"Falabella es la cuenta que más contribución aporta"}
{"tipo":"orden","sujeto":["Falabella","Lider","Jumbo"],"metrica":"Ventas","orden":{"forma":"topk","k":3,"direccion":"mayor"},"universo":"los 13 clientes","texto":"los tres motores más grandes"}
{"tipo":"orden","sujeto":"Lider","metrica":"Brecha al benchmark","orden":{"forma":"comparativo","direccion":"peor","vs":"Falabella"},"texto":"8.6 pp (peor que Falabella)"}
{"tipo":"relacion","sujeto":"Falabella","metrica":"Ventas","relacion":{"forma":"veces","k":2,"matiz":"más de","vs":"Ripley"},"texto":"vende más del doble que Ripley"}
{"tipo":"relacion","sujeto":"Valparaíso","metrica":"Capital frenado","relacion":{"forma":"fraccion","vs":{"sujeto":"negocio","metrica":"Capital frenado"}},"valor":"75%","texto":"Valparaíso concentra el 75% del capital frenado"}
{"tipo":"grupo","sujeto":["Falabella","Lider","Jumbo"],"metrica":"Contribución","valor":"49%","universo":"participación en la contribución del negocio","texto":"los tres grandes concentran el 49 % de la contribución"}
{"tipo":"conteo","conteo":{"n":5,"m":8,"predicado":"cuentas materiales"},"universo":"las 8 bajo el benchmark","texto":"5 cuentas materiales de las 8 bajo el benchmark"}
{"tipo":"variacion","sujeto":"Mercado Libre","metrica":"Ventas","variacion":{"direccion":"sube","valor":"25.3%"},"periodo":"vs año anterior","texto":"Mercado Libre crece 25.3 %"}
{"tipo":"estado","sujeto":"LG-DRYER8KG","estado":{"estado":"frenado","bodega":"Valparaíso"},"texto":"LG-DRYER8KG está frenado en Valparaíso"}
{"tipo":"lectura","texto":"Yo miraría primero a Lider","sello":"criterio mío"}
```

## 5. El detector de presencia

`omisiones(texto, afirmaciones)` recorre la prosa buscando puntos de afirmación (cifras, marcadores de orden, relaciones en palabras,
grupos/conteos, verbos de variación, estados) y exige que cada punto caiga dentro del `texto` de una afirmación del tipo que le
corresponde (una cifra también queda cubierta si alguna afirmación la declara como valor). Un punto bajo negación («no hay serie para
decir si cae») no cuenta. Una lectura no cubre hechos: un hecho declarado solo como lectura es la omisión `hecho-como-lectura`; un
orden dentro de una afirmación de cifra es `significado-no-declarado:orden`. La cobertura de la declaración = cubiertos / afirmados.
