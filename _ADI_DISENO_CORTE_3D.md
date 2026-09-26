# Corte 3d · Iniciativa de CFO y tamaño gobernado (Fable, 2026-09-25 · solo lectura de dev `3ca77b25`)

> Para Sonnet. Todo detrás de `ADI_ENTREGA`, offline, cero prosa leída. Se apoya en lo que ya existe: las cinco lecturas del contrato comercial (`pasosDeDominios` ya las corre para `lectura`/`decision`), los cruces del contrato de dominios (`_INV_CRUCE`: `top_sellers` + `tensionRead`), `descomposicionDeBrecha` (ya llega en las figs de `diagnose`), `prioridadIntegrada`, y las mediciones de Knowledge (`medir.js`). No depende del corte 3c (universo por estado): si 3c cambia `componerEntrega`, 3d se cuelga DESPUÉS de la fase 1 (declarar) y ANTES del render.

## 0 · Dos hallazgos que condicionan el diseño

1. **La pertinencia de Knowledge hoy se lee de la prosa.** `tablaSenales.js:_preguntaDeLaTabla` deriva `temas`, `metricas` («margen/carga/plazos» por regex) y «prioridad» de `pregunta`. `componerEntrega` pasa `pregunta: ""` ⇒ `temas = []` ⇒ **ninguna pieza es principal** en el camino general: PRI-04 en un encargo de cobranza saldría como oferta. Choca con `adi-no-desviarse-deterministico`. 3d lo corrige por FORMA (§A.4), sin tocar las 4 rutas fijas (siguen pasando texto, byte a byte).
2. **La iniciativa ya existe a pedazos** (participación del primero, resto de la brecha, `versusLider`, CAU-01, `idShare`), solo en rutas fijas o multitema; nada distingue lo pedido de lo calculado. 3d la vuelve un catálogo único.

## A · Iniciativa

### A.1 · El catálogo (derivado, no inventado)

Cada entrada nombra el productor real y el tipo de hecho del libro. Nada corre si el productor no está en `plan.calls` de ESA parte (`porParte`), salvo lo marcado ➕ (llamada adicional que `lecturasDe` agrega **solo si** el cierre lo permite, §A.2).

```
INICIATIVA = {
  comercial: [
    { id:"partición-brecha",   hecho:["ref total","ref carga alta total","derivada diferencia"], de:"diagnose (descomposicionDeBrecha)", cuando:"hay ≥1 cuenta bajo benchmark" },
    { id:"participación-líder",hecho:"razon pct (líder ÷ total no capturada)",                 de:"diagnose",  cuando:"≥2 cuentas en juego" },
    { id:"vs-benchmark",       hecho:"derivada pp (margen − benchmark)",                        de:"marginRead", cuando:"entidad nombrada con margen" },
    { id:"variación-anterior", hecho:"ref (variacion)",                                         de:"salesRead vs_anterior ➕", cuando:"entidad nombrada, eje ≠ sku" },
    { id:"carga-vs-resto",     hecho:"CAU-01 (medir.js:cargaCuentaVsResto)",                   de:"Knowledge (solo firmada)", cuando:"cuenta bajo benchmark" },
    { id:"prioridad-comercial",hecho:"orden top-1 por no_capturada (prioridadDe)",             de:"diagnose",  cuando:"cierre lectura/decision" },
  ],
  cobranza: [
    { id:"participación-vencido", hecho:"razon pct (vencido ÷ vencido total)",                  de:"cobranza",  cuando:"≥2 cuentas con vencido" },
    { id:"por-vencer",            hecho:"derivada diferencia (pendiente − vencido)",            de:"cobranza",  cuando:"cuenta con pendiente" },
    { id:"recuperado",            hecho:"razon (abonado ÷ venta a crédito, tasas.js)",          de:"cobranza",  cuando:"fig no viene ya" },
    { id:"exposición-vs-participación", hecho:"PRI-04 (pisoMaterialidadCobranza)",             de:"Knowledge (firmada)", cuando:"pertinencia sellada de PRI-04" },
    { id:"antigüedad-vencido",    hecho:"AUSENCIA (CAU-03 marcador → límite, sin cifra)",      de:"—",         cuando:"cobranza principal con vencido > 0" },
  ],
  inventario: [
    { id:"participación-frenado", hecho:"razon pct (capital frenado SKU ÷ capital frenado total)", de:"inventoryStatus frenado", cuando:"≥2 SKU frenados" },
    { id:"frenado-y-vende",       hecho:"grupo/conteo (SKU en frenado ∩ top_sellers)",            de:"_INV_CRUCE ➕ (tensionRead/top_sellers)", cuando:"comercial participa o entidad SKU nombrada" },
  ],
  cruce: [
    { id:"señales-otro-dominio",  hecho:"ref de materialidad/severidad/urgencia (LENTES)",     de:"cobranza|diagnose ➕", cuando:"entidad NOMBRADA por el usuario con señal en otro tema (ley: mención breve)" },
    { id:"integrada",             hecho:"prioridadIntegrada (ya en _planMultiTema)",            de:"—",         cuando:"≥2 temas con lectura/decision" },
  ],
}
```

Frontera dura (plan §3): ningún hecho de iniciativa es causa ni `lectura`; solo `ref · razon(pct) · derivada · orden · conteo`. Todo pasa por `libroDeHechos`; si no verifica, **no se sirve y no tumba la Entrega** (un hecho pedido roto sí la tumba, como hoy): los rotos de iniciativa se declaran en `entrega.detalle.iniciativaNoVerificada` (id + motivo).

### A.2 · Proporcionalidad: cuándo NO corre

| cierre | en el TEXTO | solo en estructura/oferta |
|---|---|---|
| `cifra` 1 entidad × 1 concepto | nada | `vs-benchmark`/`variación-anterior` como oferta con cifra-gancho |
| `cifra` entidad × N conceptos | ≤ 2 hechos de iniciativa del MISMO tema (vs-benchmark, variación) | el resto |
| `cifra` grupo/top | `participación-líder` + diferencia 1º−2º (ya existe) | partición |
| `lectura` / `decision` | catálogo completo del tema (principal) + cruces | — |
| `comparacion` | diferencias (existen) + «peor en» por lente si ambos tienen señal | — |
| `simulacion` | delta (existe) | nada más: un escenario no se convierte en informe |
| `definicion` | nada | nada |

Reglas transversales: (a) la iniciativa **nunca agrega un tema** que el encargo no pidió salvo la mención breve sobre una entidad nombrada por el usuario (`resolucion.partes[].entidades`, nunca las del procedimiento); (b) ➕ (llamadas extra) solo en `lectura`/`decision` y en `cifra` con entidad nombrada, con tope `INICIATIVA_CALLS_MAX = 3` por Entrega; (c) el LLM puede apagarla: `encargo.iniciativa?: "completa"|"ninguna"` (default `completa`; campo aditivo al contrato v1, validado por enum — un valor inválido ⇒ aviso, default).

### A.3 · Cómo entra (ley de pertinencia, tres niveles)

- **Principal** (mismo tema que la parte): oraciones-hecho al final de `respuesta` de ESA parte, marcadas `solicitud:"iniciativa"`, y sus filas en `cifras` con Tipo `… · por iniciativa` (`_textoDeTipo(p, {extra})`, ya existe).
- **Mención breve** (otro tema, entidad nombrada por el usuario): UNA oración por (tema, entidad), nombre + cifra, `solicitud:"iniciativa"`, `nivel:"mencion"`.
- **Oferta**: todo lo demás va a `queMasPuedoCalcular.puedo` con cifra-gancho verificada y cola (`servirOferta*` ya lo hace para Knowledge; para el Core, `{ texto, gancho:{hechoId}, encargoSugerido: Encargo válido }` — el LLM puede pedirlo tal cual).
- **Una señal nunca desaparece**: candado — cada hecho de iniciativa verificado está en `respuesta`, en una mención, en una oferta o en `entrega.detalle` (§B.3), con id.

### A.4 · Pertinencia por FORMA (corrige el hallazgo 1)

`construirTablaDeSenales` y `referenciaDelOficioConOfertas` ganan un parámetro aditivo `encargo` (objeto tipado). Con él, `_preguntaDeLaTabla` **no lee `pregunta`**:

```
encargo: { temas: partes.map(p=>p.tema), metricas: conceptos ∩ {margen,carga,dias_vencido→plazos},
           prioridad: cierre==="decision" || temas.length>=2, sujetoAbierto: !entidadesDelUsuario.length }
```

Sin `encargo`, comportamiento de hoy (las 4 rutas fijas byte-idénticas). Candado: D09-like de cobranza por el camino general ⇒ PRI-04 principal.

### A.5 · Distinguir PEDIDO de INICIATIVA para el LLM

Tres marcas, una por capa, para que sobreviva a la paráfrasis:
1. Estructura: `hecho.solicitud`, `respuesta[i].solicitud`, `fila.solicitud` ∈ `"pedido"|"iniciativa"`; `entrega.iniciativa = { ids:[…], calls:[…], nivelPorId }`.
2. Ids con prefijo: pedidos `e1…ek` (numeración de hoy, intacta), iniciativa `i1…im`, asignados DESPUÉS de todos los pedidos. Así apagar la iniciativa no mueve ningún id.
3. Texto: dentro de **Respuesta**, tras las oraciones pedidas, una línea fija de la casa: `**Por iniciativa de ADI (no lo pidió; un controller lo revisaría antes de responder):**` seguida de sus oraciones `▹`. Las siete partes no cambian; la marca es una línea y un glifo distinto (`▹` vs `▸`). La cabecera de uso agrega: «lo marcado ▹ es contexto calculado por ADI, cítelo como tal».

### A.6 · Candado (la conclusión no cambia)

`componerEntrega(resolucion, { iniciativa:false })` vs `{ iniciativa:true }`: (i) `respuesta.filter(pedido)` byte-idéntica; (ii) misma lista de ids `e*` y mismo `renderDe` por id; (iii) la oración con `Prioridad del procedimiento` idéntica; (iv) `limites` pedidos idénticos (los de iniciativa se anexan, marcados); (v) `universos` idénticos. Además: ningún hecho `i*` es premisa de un `razon`-causa (no existe el tipo, pero el gate lo barre por si 3c lo agrega).

## B · Tamaño gobernado

Medido: multidominio 948 > 900 (`verificar.js:TOPE_PALABRAS`), D27 1.623. `profundidad` se valida y no se lee. Hoy todo se imprime en orden de aparición y la tabla larga dispara filas.

### B.1 · Dos profundidades, un solo libro

| parte | `breve` | `completa` |
|---|---|---|
| Marco | íntegro | íntegro |
| Respuesta | conclusión + ≤ 3 oraciones pedidas + ≤ 1 iniciativa | conclusión + todas las pedidas + iniciativa principal (≤ 6) + menciones |
| Cifras | ≤ 8 filas | ≤ 24 filas |
| Límites | obligatorios (§B.4) | obligatorios + los de iniciativa |
| Referencia del oficio | bloque principal en forma compacta (nombre + cifra por señal) | bloques completos, menciones |
| Para su juicio | ≤ 1 | todos |
| Qué más puedo calcular | ofertas | ofertas + menú |
| **tope** | `TOPE_BREVE = 350` palabras | `TOPE_COMPLETA = 900` |

Los topes son constantes exportadas de `verificar.js` (una fuente). La **estructura** (`entrega.cifras.filas`, `libro`, `universos`) es SIEMPRE completa en las dos profundidades: lo que gobierna es el TEXTO. Candado: `breve` ⊂ `completa` — mismos ids, mismos renders, cada oración de breve existe en completa.

### B.2 · Qué entra cuando hay que recortar: por prioridad, no por aparición

Cada oración y cada fila lleva `prioridad` (número), asignado en fase 1 por el procedimiento:

```
prioridad = [ nunca_recortable(0), conclusion(1), señal_top_del_procedimiento(2 … n según prioridadIntegrada.integrada / prioridadDe / orden del ranking),
              cola_declarada(0), iniciativa_principal(rango + 100), mencion(200 + rango), oficio_bloque(300 + señal_rango) ]
```

Algoritmo (`gobernarTamano(entrega, profundidad)`, puro, en `entrega/tamano.js`): ordena por `prioridad` asc, acumula palabras con `_PALABRAS` (la de `verificar.js`), corta donde supera el tope, **devuelve al orden original de aparición** lo que quedó (el lector no ve el ranking, ve la Entrega en su orden). Carnada del gate: una fila de prioridad 900 puesta primera debe ser la primera en salir.

### B.3 · Detalle por referencia

Lo recortado no desaparece: va a `entrega.detalle` (parte estructural, sin texto renderizado):

```
entrega.meta    = { entregaRef: "E:<sha1(tenant, versionId, encargoCanonico)>", profundidad, palabras, tope }
entrega.detalle = { filas:[{...fila, id}], oraciones:[{texto,hechos,solicitud}], universos:[id], iniciativaNoVerificada:[{id,motivo}],
                    comoPedirlo: { contexto:{ entregaRef, hechosRef:["e14","e15"], universoRef:"p1" } } }
```

El texto lo declara UNA vez, en Cifras: `+ 16 filas en el detalle (e14–e29; pídalas por referencia)`, cifras registradas en `cifrasImpresas`. El LLM pide `{ partes:[la misma parte], contexto:{ entregaRef, hechosRef } , profundidad:"completa" }`: ADI resuelve `hechosRef` **sin cálculo nuevo** porque la composición es determinística (contrato §0.5) — misma versión + mismo encargo canónico ⇒ mismo libro, mismos ids (candado de equivalencia byte a byte, ya existe). En 3d la resolución vive en `contexto.js` (memo en proceso por `entregaRef`, tope 12); en la etapa 2 esa memo ES el libro de conversación (`E<n>.h<k>` = `entregaRef` + id). `validar.js` cambia `contexto_no_disponible` por resolución solo cuando `entregaRef` casa con el sello vigente; si no casa, sigue declinando (ley: nunca en silencio). `universoRef` devuelve el universo declarado (`entrega.universos[id]`) con sus entidades: el LLM puede pedir «de esos, X» por id, no por deixis.

### B.4 · Lo que NUNCA se recorta (prioridad 0, ni con `breve`)

- La conclusión del procedimiento (`respuesta` con `Prioridad del procedimiento` / la primera oración de la parte `decision`).
- Las negativas obligatorias: límites `_ausencia`, los ligados a un hecho impreso (brecha ≠ pérdida, sin serie, escenario hipotético, delta no aislado), `perfil_incompleto`, y los `noResuelto`.
- El Marco completo (empresa, período, universo, referencia declarada).
- La cola de todo top-N (`El top k de N`) y la línea de detalle.
- Las premisas con veredicto (cuando 3c las traiga).
- El `no_implica` de cada pieza de Knowledge servida.
- ⚠️ Las **señales** de un bloque de Knowledge: nunca desaparecen; bajo `breve` (o si el bloque solo no cabe en `completa`) se sirven en la forma compacta que ya existe (`señalesCompactas`: nombre + monto), nunca solo un conteo. Ver decisión 1.

## C · Cortes, candado y decisiones

| # | corte | archivos | candado |
|---|---|---|---|
| 3d.1 | `solicitud` + prefijo `i*` + catálogo `INICIATIVA` + `iniciativa` en el encargo + línea `▹` | `entrega/iniciativa.js` (nuevo), `componer.js` (enganche fase 1→2), `encargo/esquema.js`, `verificar.js` (regla 12: todo `i*` verificado y ubicado) | `_iniciativa_gate`: A.6 sobre TODO el catálogo de desarrollo; proporcionalidad A.2 (cifra 1×1 ⇒ 0 `▹`, ≥1 oferta); ningún tema no pedido en `▸`; ≤3 calls ➕ |
| 3d.2 | pertinencia por forma | `conocimiento/tablaSenales.js`, `seleccionar.js`, `componer.js` | `_conocimiento_gate` extendido: 4 rutas byte-iguales; cobranza general ⇒ PRI-04 principal; con `pregunta:""` y `encargo` ⇒ cero regex evaluada (carnada: pregunta con «margen» + encargo de cobranza ⇒ `metricas` sin margen) |
| 3d.3 | `gobernarTamano` + `prioridad` + `detalle` + `meta` + topes | `entrega/tamano.js` (nuevo), `componer.js`, `esquema.js`, `verificar.js` (regla 8 por profundidad; regla 13: detalle ⊇ recortado) | `_tamano_gate`: D11 ≤ 900, D27 ≤ 900, breve ≤ 350 en todo el catálogo; breve ⊂ completa (ids/renders); B.4 nunca recortado (carnada: tope artificial 60 palabras ⇒ conclusión + marco + negativas intactos); orden por prioridad (carnada B.2) |
| 3d.4 | `contexto.hechosRef`/`universoRef` por sello | `encargo/contexto.js` (nuevo), `validar.js` | `_contexto_gate`: misma versión ⇒ mismo render por id; sello distinto ⇒ `contexto_no_disponible`; nunca una cifra nueva |

Todo con `node --import ./scripts/offline-guard.mjs`, cero red, ningún nombre de cuenta del demo en `src/`.

**Decisiones para el owner (pocas; el resto es mecanismo del arquitecto):**
1. **Señal de Knowledge vs tope.** Con carteras grandes el bloque completo no cabe en 900. Propongo: bajo el tope, cada señal se sirve compacta (nombre + monto, forma que ya existe) y las líneas completas van al detalle por referencia. Alternativa: el bloque manda y la Entrega excede el tope. Roza «una señal nunca se corta por espacio» (2026-09-24): la señal no se corta, se compacta — pero es él quien lo dijo.
2. **La palabra visible** de la marca: «Por iniciativa de ADI (no lo pidió; un controller lo revisaría antes de responder)». Es texto de la casa que llega al usuario: se le muestra; los mecanismos (`solicitud`, `i*`) no dependen de la frase.
3. **CAU-03 como límite**: «no hay antigüedad del vencido en el dato» impreso en toda cobranza principal con vencido > 0. Es contenido de una pieza en borrador: ¿entra como ausencia del Core (sin firmar la pieza) o espera la firma?

**Fuera de 3d, reportado:** `tablaSenales` corre los tres playbooks con preguntas canónicas en PROSA (`pasosDe(margenEnRiesgo, "¿dónde estoy…")`); migrarlo a `pasosDeDominios` es un corte propio.
