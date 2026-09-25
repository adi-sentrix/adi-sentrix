# Contrato del Encargo v1 · la Solicitud tipada que el LLM le hace a ADI (Fable, 2026-09-25 · Etapa 0)

> Estado: ESPECIFICACIÓN para la etapa 1 (`_ADI_PLAN_PRODUCTO_V2.md`, B4 · corte 2 de `_ADI_DISENO_FLUJO_V2.md` §F).
> Solo lectura del repo (dev `5a27b0b8`); nada ejecutado. La implementa Sonnet en `src/adi/encargo/{esquema,validar}.js`
> detrás de `ADI_ENTREGA`, con el candado `_encargo_gate` sobre `fixtures/encargos-desarrollo.json`. Sin commitear.

---

## 0 · Las leyes que este contrato obedece (owner)

1. **La comprensión del lenguaje es del LLM** (`adi-no-desviarse-deterministico`). ADI recibe un objeto tipado ya
   interpretado. **`preguntaOriginal` viaja solo para auditoría y NUNCA se parsea, se compara, ni se tokeniza.**
   Ningún validador lee prosa: ni la pregunta, ni un nombre de entidad «parecido», ni una cita de documento.
2. **Cero reconocedores de frases.** Este contrato no define vocabulario, sinónimos, modismos ni cierres por palabra.
   Todo valor válido es un **id** de una tabla que YA existe en el Core (§3). Un valor que no es id exacto es inválido.
3. **Temas reconocidos se cubren TODOS** (`adi-piso-sin-modelo`): cada parte del encargo es independiente; una parte
   inválida no anula a las demás; **nada se sustituye por un vecino** (ni entidad, ni concepto, ni tema, ni período).
4. **Lo no soportado vuelve declarado, nunca en silencio** (CLAUDE.md §5 «declina honestamente cuenta como éxito»).
5. **Determinismo**: mismo tenant + misma versión de datos + mismo encargo ⇒ misma resolución, byte a byte.
6. **La conclusión es del procedimiento**: el encargo dice QUÉ se pide; qué lecturas corren y qué se concluye lo
   decide ADI (`lecturasDe`, etapa 1), nunca el encargo ni el LLM.

---

## 1 · El objeto `Encargo` v1

Notación: `tipo?` = opcional · `enum` = lista cerrada · `id de X` = tiene que existir en la tabla X del Core (§3).

```
Encargo {
  version:          "encargo/v1"                       // obligatorio, literal
  conversacionId?:  string | null                       // id EMITIDO POR ADI (etapa 2); null o ausente = conversación nueva
  preguntaOriginal?: string | null                      // AUDITORÍA. Se guarda tal cual en el rastro. Prohibido leerla.
  partes:           Parte[]                             // 1 … PARTES_MAX (6). Cada una independiente.
  criterio?:        Criterio                            // la lente que ordena una decisión (ley «el criterio del usuario manda»)
  supuestos?:       Supuesto[]                          // 0 … SUPUESTOS_USUARIO_MAX (3, `conversationScope.js`)
  premisas?:        Premisa[]                           // lo que el usuario da por hecho; ADI las verifica, nunca las adopta
  usar?:            "medido" | "declarado"              // default "medido": sobre qué realidad calcula el Core si un declarado colisiona
  profundidad?:     "breve" | "completa"                // default "completa"
  contexto?:        Contexto                            // referencias por id a lo ya entregado (etapa 2)
}

Parte {
  id:         string                                    // "p1", "p2"… único dentro del encargo (si falta, ADI lo asigna por posición)
  tema:       id de DOMINIOS_REGISTRO                   // "comercial" | "inventario" | "cobranza" | "tesoreria"
  cierre:     enum CIERRES                              // "cifra" | "lectura" | "decision" | "comparacion" | "simulacion" | "definicion"
  conceptos?: (id de CLAVES_DE_METRICA)[]               // claves del léxico de la casa que pertenecen a `tema` (§3.2); [] = «lo que el procedimiento del tema sirva»
  entidades?: EntidadRef[]                              // sujetos puntuales; [] = el eje entero / el negocio
  eje?:       enum EJES                                 // el eje del listado cuando no hay entidades ("por marca"); default: `DOMINIOS_REGISTRO[tema].sujeto`
  universo?:  Universo                                  // el universo TIPADO de `notario/hechos.js` (validarUniverso) — «los clientes en mora», «top 3 por venta»
  periodo?:   Periodo                                   // default { tipo: "vigente" }
  concepto?:  string                                    // SOLO cierre "definicion": id de CONCEPT_DEFS o clave de CLAVES_DE_METRICA
  supuestos?: string[]                                  // SOLO cierre "simulacion": ids de `Encargo.supuestos` que esta parte aplica
}

EntidadRef { nombre: string, eje?: enum EJES }          // `eje` es opcional: lo resuelve el ÍNDICE (entityIndex), nunca la frase
Periodo    { tipo: "vigente" | "mes" | "rango", valor?: string | { desde: string, hasta: string } }
                                                        // "vigente" = lo que el pack declara (año cerrado para comercial; foto al corte para
                                                        // inventario y cobranza). "mes" = "aaaa-mm". "rango" = { desde, hasta } ISO.
                                                        // Las COMPARACIONES temporales NO son período: son conceptos (variacion, vs_presupuesto).
Criterio   { lente: id de CRITERIOS }                   // "riesgo" | "contribucion" | "credito" | "ventas" | "crecimiento" | "capital"
         | { referencia: { concepto: id de REFERENCIAS_DE_LA_CASA, valor: number, unidad: string } }
                                                        // el usuario trae SU vara para esta consulta («mi benchmark real es 25 %»): origen "declarado"
Supuesto   { id: string, tipo: id de ASSUMPTIONS, valor: number, unidad: string,   // unidad ∈ ASSUMPTIONS[tipo].units
             alcance: { eje: enum EJES, nombre: string } | "negocio",
             origen: "supuesto" | "declarado", cita?: string }                   // "documento" NO entra por el encargo (§7)
Premisa    { id: string, tipo: enum TIPOS_DE_PREMISA, …campos del hecho tipado de `notario/hechos.js` }   // §1.3
Contexto   { entregaRef?: string, hechosRef?: string[], universoRef?: string }    // ids "E3", "E3.h7", "E3.u1" emitidos por ADI
Universo   = el objeto de `validarUniverso` (hechos.js): { eje, base?, estados?, no_estados?, bodega?, filtros?, top?, excluir?, union? }
```

### 1.1 · Reglas por cierre (lo que cada cierre EXIGE de la parte)

| cierre | exige | prohíbe | productor en el Core (etapa 1) |
|---|---|---|---|
| `cifra` | ≥ 1 concepto **o** universo con `top`; entidades 0…N | — | `queryMetric` / `entityRecord` / `gridTable` / `mesaFlujo` / `mesaCapital` |
| `lectura` | tema | — | rutas de `componer.js` (comercial · cobranza · inventario · multidominio), `contratoComercial`, playbooks |
| `decision` | tema (1…N partes) | — | `prioridadIntegrada` (+ lente alternativa declarada); sin `criterio` ⇒ «riesgo integrado (criterio de ADI)» |
| `comparacion` | **exactamente 2** entidades del **mismo eje** | 1 o 3+ entidades; ejes mezclados | `compareEntities` (`multiCardinality {2,2}`) |
| `simulacion` | ≥ 1 id en `Parte.supuestos`, cada uno con productor para (tema, eje) — §3.5 | — | `simulateGeneral` / `simulateCarga` / `simulateCapital` / `simulateCosto` |
| `definicion` | `concepto` | entidades, conceptos, período, universo | `defineConcept` (CONCEPT_DEFS / METRIC_DEFS) |

### 1.2 · Independencia y sustitución (la regla de oro)

- Cada `Parte` se valida y se resuelve **sola**. El estado de una parte es `resuelta` · `parcial` · `no_resuelta`.
- `parcial` = la parte tiene un campo-lista (conceptos, entidades) con elementos válidos e inválidos: corre con los
  válidos, **declara** los inválidos en `noResuelto`, y **no** rellena el hueco con nada. Ejemplo: entidades
  `[Jumbo, Cencosud]` ⇒ corre Jumbo, `noResuelto` nombra Cencosud. NUNCA corre «Cencosud ≈ Jumbo».
- `no_resuelta` = falla un campo esencial: `tema`, `cierre`, la única entidad de una `cifra`/`comparacion`, el único
  concepto de una `cifra`, el `concepto` de una `definicion`, todos los supuestos de una `simulacion`, o la
  cardinalidad de `comparacion`. La parte no corre; las demás sí.
- Un `Encargo` es **inválido entero** SOLO si: `version` ≠ "encargo/v1", `partes` vacío o > `PARTES_MAX`, o un campo
  desconocido en la raíz (`campo_desconocido`). Todo lo demás se resuelve parte por parte.
- `criterio`, `supuestos` y `premisas` inválidos **no** invalidan ninguna parte: se declaran y se ignoran (una decisión
  sin criterio válido corre con el criterio de ADI y lo dice; una simulación cuyo único supuesto es inválido queda
  `no_resuelta` por §1.1).

### 1.3 · Premisas tipadas (esquema de `TIPOS_DE_HECHO`)

`TIPOS_DE_PREMISA` = `["cifra", "orden", "relacion", "grupo", "conteo", "variacion", "estado", "razon", "derivada"]` —
el subconjunto **factual** de `TIPOS_DE_HECHO` (`hechos.js`). Quedan fuera: `ref` (el LLM no conoce ids de fig),
`lectura` y `propuesta` (no son hechos verificables). Los campos son **los mismos** que `validarHecho` exige
(`sujeto`, `metrica` = clave de CLAVES_DE_METRICA, `valor`, `orden{forma,k,direccion,vs}`, `relacion{forma,k,vs}`,
`estado` = canon de `ESTADOS_CANON` (o `"no <canon>"`), `conteo{n,m}`, `de`/`universo` tipado, `variacion{direccion,valor}`,
`periodo` ∈ anterior|presupuesto|actual, `num`/`den`/`de` como `{sujeto, metrica}` — nunca por id de fig).
Veredicto: `libroDeHechos(premisas, { indice de la Entrega })` ⇒ `verdadera` | `falsa` (+ la verdad con id, `hNa…`) |
`no-verificable` (esquema inválido ⇒ `noResuelto.premisa_mal_formada` con el texto de `validarHecho`). Una premisa
`falsa` **nunca** cambia la conclusión (`premisa-adoptada`); la Entrega la declara en «Sobre lo que usted da por hecho».

---

## 2 · La salida del validador: `Resolucion`

```
Resolucion {
  ok:        boolean                                    // true si ≥ 1 parte quedó resuelta o parcial
  encargo:   Encargo                                    // el recibido, con ids de parte asignados; preguntaOriginal intacta
  partes:    ParteResuelta[]                            // una por parte recibida, en el mismo orden
  criterio:  { lente, origen: "usuario" | "adi", alternativa: lente | null } | { referencia, origen: "usuario" }
  supuestos: SupuestoResuelto[]                         // solo los válidos, con su productor
  premisas:  Premisa[]                                  // solo las bien formadas (el veredicto lo pone la Entrega)
  noResuelto: NoResuelto[]                              // TODO lo declinado, de todas las partes y de la raíz
  avisos:    Aviso[]                                    // lo que se resolvió con una nota (ej. decisión sin criterio → criterio de ADI)
}
ParteResuelta {
  id, tema, cierre, estado: "resuelta" | "parcial" | "no_resuelta",
  conceptos:  (clave)[],                                // los válidos para (tema, eje)
  entidades:  [{ nombre: canónico del índice, eje }],   // resueltas por `resolveCanonical` / `guessDimensionDetallado`
  eje, universo (validado), periodo (resuelto: { tipo, valor, marco: "cerrado"|"foto"|"serie" }),
  ausencias:  (id de AUSENCIAS_DEL_DATO)[]              // las que aplican al tema (`ausenciasDe`) — viajan a la Entrega como límites
}
NoResuelto {
  parte:        string | null                           // id de la parte, o null si es de la raíz (criterio, supuestos, premisas, contexto)
  campo:        enum CAMPOS                             // "version"|"partes"|"tema"|"cierre"|"concepto"|"entidad"|"eje"|"universo"|"periodo"|
                                                        //  "criterio"|"supuesto"|"premisa"|"usar"|"profundidad"|"contexto"|"raiz"
  valor:        any                                     // EXACTAMENTE lo recibido (el objeto o el string), sin normalizar
  motivo:       enum MOTIVOS                            // §2.1 — lista cerrada, es lo que el gate compara
  detalle:      string                                  // texto de la casa (de validarUniverso/validarHecho/ausencia.texto/BLOQUEADOS.porque); sin cifras
  alternativas: Alternativa[]                           // tipadas, nunca prosa: lo que SÍ existe
}
Alternativa = { tipo: "entidad", nombre, eje } | { tipo: "concepto", clave, tema } | { tipo: "eje", eje }
            | { tipo: "tema", tema } | { tipo: "cierre", cierre } | { tipo: "periodo", periodo }
            | { tipo: "ausencia", id, alternativa: texto de ausencias.js } | { tipo: "lente", lente }
            | { tipo: "supuesto", tipo_supuesto, units } | { tipo: "bloqueado", id, paraAbrirlo }
```

### 2.1 · `MOTIVOS` (lista cerrada; agregar uno exige tocar este contrato y el gate)

| motivo | cuándo | alternativas obligatorias |
|---|---|---|
| `version_invalida` | `version` ≠ "encargo/v1" | — |
| `encargo_vacio` | `partes` ausente o `[]` | — |
| `partes_tope` | `partes.length` > PARTES_MAX | — |
| `campo_desconocido` | clave fuera del esquema (raíz o parte) | — |
| `tema_desconocido` | `tema` ∉ ids de DOMINIOS_REGISTRO | `{tipo:"tema"}` × ids activos |
| `tema_ausente` | `tema` con `estado:"ausente"` (tesorería) | `{tipo:"ausencia", id: dominio.ausencia.id, alternativa}` |
| `cierre_desconocido` | `cierre` ∉ CIERRES | `{tipo:"cierre"}` × CIERRES |
| `cierre_incompleto` | el cierre exige algo que falta (§1.1) | lo que falta, tipado |
| `cardinalidad` | `comparacion` con ≠ 2 entidades, o simulación con más entidades que el cupo (6) | `{tipo:"cierre", cierre:"cifra"}` (ranking) |
| `ejes_mezclados` | `comparacion` con entidades de dos ejes | `{tipo:"eje"}` de cada una |
| `concepto_desconocido` | clave ∉ CLAVES_DE_METRICA ni CONCEPT_DEFS | `{tipo:"concepto"}` × claves del tema |
| `concepto_de_otro_tema` | clave existe, pero `dominio` ≠ `tema` | `{tipo:"tema", tema: dominio de la clave}` |
| `concepto_sin_productor` | clave del tema, pero ningún productor la sirve en ese eje (§3.3) | `{tipo:"eje"}` donde sí · `{tipo:"concepto"}` que sí |
| `entidad_inexistente` | `resolveCanonical` = null en el eje dado, o `guessDimension` = null sin eje | hasta 3 `{tipo:"entidad"}` del fuzzy de `entityIndex` (como OFERTA) |
| `entidad_ambigua` | sin `eje` y `guessDimensionDetallado.colision` | `{tipo:"entidad", nombre, eje}` por cada colisión |
| `entidad_eje_incompatible` | la entidad existe en OTRO eje que el declarado | `{tipo:"entidad", nombre, eje: el real}` |
| `eje_no_soportado` | `eje` ∉ EJES, o no disponible para ese tema/concepto (`axisAvailable`, `sourceByAxis`) | `{tipo:"eje"}` disponibles |
| `cruce_bloqueado` | la parte pide un cruce de `BLOCKED_CROSSES` (cliente×sku, marca×cliente) | `offer` del cruce como `{tipo:"concepto"}` |
| `universo_invalido` | `validarUniverso` devuelve texto | — (detalle = ese texto) |
| `periodo_mal_formado` | `tipo` ∉ enum, o `valor` no ISO | `{tipo:"periodo", periodo:{tipo:"vigente"}}` |
| `periodo_no_disponible` | `mes`/`rango` sin serie real para esa entidad/eje (`serieRealDe`), o `rango` (sin productor en v1) | `{tipo:"periodo", periodo:{tipo:"vigente"}}` + la ausencia `sin_serie` si aplica |
| `criterio_desconocido` | `lente` ∉ CRITERIOS o `referencia.concepto` ∉ REFERENCIAS_DE_LA_CASA | `{tipo:"lente"}` × CRITERIOS |
| `criterio_tesoreria` | reservado: NO existe una lente de caja; una `lente` inexistente cae en `criterio_desconocido` con alternativa `credito` | `{tipo:"lente", lente:"credito"}` + ausencia `sin_datos_tesoreria` |
| `supuesto_mal_formado` | `assumptionValid` falla, o `alcance` no resuelve | `{tipo:"supuesto", tipo_supuesto, units}` |
| `supuesto_sin_productor` | tipo válido, pero sin productor para (tema, eje) — §3.5 | `{tipo:"supuesto"}` con productor |
| `supuesto_tope` | más de SUPUESTOS_USUARIO_MAX | — |
| `origen_no_admitido` | `origen` = "documento" (o fuera del enum) | — (§7) |
| `premisa_mal_formada` | `tipo` ∉ TIPOS_DE_PREMISA o `validarHecho` devuelve texto | — (detalle = ese texto) |
| `usar_invalido` / `profundidad_invalida` | fuera del enum | — |
| `contexto_no_disponible` | ids de contexto con formato válido pero sin libro de conversación (etapa 2) o inexistentes en él | — |
| `contexto_mal_formado` | ids que no siguen `E<n>` / `E<n>.h<k>` / `E<n>.u<k>` | — |

---

## 3 · Los valores válidos, DERIVADOS del Core (nada se escribe a mano)

| tabla | fuente (símbolo real) | valores hoy (demo) |
|---|---|---|
| `TEMAS` | `config/contract/dominios.js` · `DOMINIOS_REGISTRO[].id` + `estado` | comercial · inventario · cobranza (activos) · tesoreria (ausente) |
| `CIERRES` | este contrato (enum) | cifra · lectura · decision · comparacion · simulacion · definicion |
| `EJES` | `oracle/entityIndex.js` · `AXES` | sku · cliente · marca · familia · bodega · canal |
| `CLAVES_DE_METRICA` | `notario/lexico.js` · `CLAVES_DE_METRICA[].clave` (con `dominio`) | 39 claves (ver §3.2) |
| conceptos por tema | `DOMINIOS_REGISTRO[tema].metricas` | comercial 21 · inventario 10 · cobranza 7 · tesoreria 0 |
| `REFERENCIAS_DE_LA_CASA` | `lexico.js` claves con `referencia: true` | benchmark · nivel_carga · umbral_materialidad · piso_rotacion · techo_cobertura |
| `CRITERIOS` | `agente/prioridadIntegrada.js` · `CRITERIOS` | riesgo · contribucion · credito · ventas · crecimiento · capital |
| `ASSUMPTIONS` | `config/contract/assumptionRegistry.js` · `ASSUMPTIONS` + `assumptionValid` | growth · price · margin · inventory · custom |
| `ESTADOS_CANON` | `notario/estados.js` · `ESTADOS_CANON` | inmovilizado · frenado · sobrestock · riesgo de quiebre · en quiebre · capital sano · critico · sin venta · rota bien · rota lento (sku) · al dia · en mora · sin deuda · buen pagador · mal pagador · sin contribucion · sin margen · sin pagos (cliente) |
| `TIPOS_DE_HECHO` | `notario/hechos.js` · `TIPOS_DE_HECHO`, `validarHecho`, `validarUniverso` | ver §1.3 |
| `AUSENCIAS` | `config/contract/ausencias.js` · `AUSENCIAS_DEL_DATO`, `ausenciasDe(tema)` | 19 entradas |
| `BLOQUEADOS` | `ingesta/plantilla/motorKpi.js` · `BLOQUEADOS` | transforms de simulación · presupuesto (v1 plantilla) · perfil estratégico |
| `BLOCKED_CROSSES` | `config/contract/surfaceContract.js` | marca×cliente · cliente×sku |
| métrica × eje | `config/contract/metricRegistry.js` · `METRICS[m].axes` / `sourceByAxis` | ver §3.3 |
| cardinalidades | `oracle/toolContracts.js` · `TOOL_CONTRACTS[tool].multiCardinality`, `dimensionesSoportadas` | compareEntities {2,2} · simulateGeneral {1,6} |
| conceptos de definición | `sentrix/glossary.js` · `CONCEPT_DEFS` (ids) + `METRIC_DEFS` (rótulos) | no_capturada · carga · acciones · rebate · benchmark · margen · margen_bruto · contribucion · resultado · gastos · ventas · costo · rotacion · doh · capital · unidades · stock · capital_inmovilizado · riesgo_quiebre · sobrestock · estado · universo · negocio · cola · eje · seleccion · en_juego · brecha · vara · meta · presupuesto · anterior · promedio_cartera · probado · indicado · abierto |
| entidades | `entityIndex.js` · `resolveCanonical(eje, nombre)`, fuzzy solo como alternativa | 13 clientes · 13 SKU · 5 marcas · 4 familias · 4 bodegas · 2 canales |
| período vigente | `tenant.hechos.parametros.periodo_actual` (comercial, año cerrado) · `flujoComercial.fechaCorte` (cobranza, foto) · inventario: foto sin fecha declarada (límite `faltaRango`) | 2025-12-31 · 2026-08-31 · — |
| serie mensual | `sentrix/capability.js` · `serieRealDe(nombre)` (por entidad) · `ventasMensuales` (negocio, 12 meses) | demo: por entidad `real:false` («sin-periodo») · negocio: 12 meses sin año |
| topes | `PARTES_MAX = 6` (técnico, ajustable) · `SUPUESTOS_USUARIO_MAX` (`conversationScope.js` = 3) | — |

### 3.2 · Conceptos por tema (copiados de `DOMINIOS_REGISTRO[].metricas`; el implementador NO los reescribe, los importa)

- **comercial**: ventas · ventas_anterior · margen · margen_promedio · contribucion · no_capturada · carga · carga_alta ·
  brecha · brecha_precio_costo · unidades · markup · peso_costo · costo · variacion · variacion_usd · vs_presupuesto ·
  vs_presupuesto_usd · benchmark · nivel_carga · umbral_materialidad
- **inventario**: capital · capital_frenado · capital_inmovilizado · rotacion · dias_inventario · dias_sin_venta ·
  unidades_stock · margen_inventario · piso_rotacion · techo_cobertura
- **cobranza**: venta_credito · saldo_vencido · saldo_pendiente · saldo_por_vencer · abonado · recuperado · dias_vencido
- **tesoreria**: (ninguno) — toda parte con este tema es `tema_ausente`.
- `participacion` (dominio null en el léxico) es válida en cualquier tema activo como concepto DERIVADO (tentación
  precalculada), nunca como concepto principal de una `cifra`.

### 3.3 · Productor por (concepto, eje) — la tabla que decide `concepto_sin_productor` y `eje_no_soportado`

El implementador la **genera** desde el código (no la copia de acá); este cuadro es lo que verifiqué leyendo
`metricRegistry.js`, `toolContracts.js`, `mesaFlujo.js`, `mesaCapital.js`, `specRetrieval.js` y `entityRegistry.js`,
y es lo que el catálogo de desarrollo espera:

| concepto (léxico) | eje(s) con productor | productor | notas |
|---|---|---|---|
| ventas | cliente · marca · familia · sku · canal | `METRICS.ventas.sourceByAxis` | bodega NO |
| margen | cliente · sku · marca · familia | `METRICS.margen` | canal y bodega NO |
| contribucion | cliente · sku · marca · familia · canal | `METRICS.contribucion` | |
| costo | cliente · sku · marca · familia | `METRICS.costo` | |
| carga | cliente · sku · marca · familia | `METRICS.carga` | canal NO |
| carga_alta · no_capturada · brecha · brecha_precio_costo | cliente (detector) · sku (diagnose capital NO: solo comercial por cliente) | `diagnose` / `descomposicionDeBrecha` | **por cliente**; otros ejes ⇒ `concepto_sin_productor` |
| unidades | cliente · sku · marca · familia | `METRICS.unidades` | |
| variacion · variacion_usd · ventas_anterior | cliente · marca · familia · canal · negocio | `salesRead` (vs_anterior) | **sku NO** (`skusMargen` no trae anterior) |
| vs_presupuesto · vs_presupuesto_usd | cliente · negocio | `clientesVentas.presupuesto`, `ventasKPI` | marca/familia/sku NO |
| markup · peso_costo | cliente · sku · marca · familia | `marginRead` (causa_precio/causa_costo) | |
| benchmark · nivel_carga · umbral_materialidad | negocio (referencias) | POLICY / perfil | se citan, no se ordenan |
| capital · unidades_stock | sku · bodega · marca · familia (capital) · sku · bodega (stock) | `METRICS.capital` / `METRICS.stock` | **cliente NO** (`BLOCKED_CROSSES`) |
| capital_frenado · capital_inmovilizado | sku · bodega · familia | `mesaCapital` / `inventoryStatus{frenado}` | |
| rotacion · dias_inventario | sku · bodega | `METRICS.rotacion` / `METRICS.doh` | cliente/marca/familia NO |
| dias_sin_venta | sku | `skuInventario.diasSinVenta` | |
| margen_inventario | sku | `skuInventario.margenPct` | |
| piso_rotacion · techo_cobertura | negocio (referencias) | POLICY | |
| venta_credito · saldo_vencido · saldo_pendiente · saldo_por_vencer · abonado · recuperado · dias_vencido | cliente · negocio | `mesaFlujo` (`flujoComercial`) | **solo cliente**: marca/familia/sku/canal/bodega ⇒ `concepto_sin_productor` |

### 3.4 · Cierres por tema (lo que hoy tiene ruta)

| tema | cifra | lectura | decision | comparacion | simulacion | definicion |
|---|---|---|---|---|---|---|
| comercial | sí | sí (`componerEntregaBrechaComercial` + contrato comercial) | sí | sí (2 entidades, mismo eje) | sí (§3.5) | sí |
| inventario | sí | sí (`componerEntregaInventario`) | sí | sí (2 SKU / 2 bodegas) | `simulateCapital` (sku) | sí |
| cobranza | sí | sí (`componerEntregaCobranza`) | sí | 2 clientes (por `mesaFlujo`, no por `compareEntities`) — **decision_pendiente**: no hay composer de comparación de cobranza | **no** (sin productor) | sí |
| multi-tema | — | sí (`componerEntregaMultidominio`) | sí (cierre integrado siempre) | — | — | — |

### 3.5 · Supuestos con productor (para `simulacion`)

| tipo (ASSUMPTIONS) | unidad | productor | tema · eje | condición |
|---|---|---|---|---|
| price | pct | `simulateGeneral` (variableA) | comercial · cliente/sku/marca/familia | `perfil.costModel` declarado (demo: `variable_total`) |
| growth | pct · money | `simulateGeneral` (variableB volumen) / `simulate` | comercial · cliente/sku/marca/familia | idem |
| margin | pct (pp) | `simulateCosto` (vía costo medio) / `calcular.margen_objetivo` | comercial · sku/cliente/marca/familia | — |
| custom con `perturbs: carga` (delta_pp) | pp | `simulateCarga` | comercial · cliente | — |
| custom capital | — | `simulateCapital` (liberar capital frenado, sin parámetro) | inventario · sku | el supuesto es «liberar»; no toma valor |
| inventory | days · pct | **ninguno** (`assumptionRegistry.js`: «la simulación paramétrica todavía NO tiene productor») | — | ⇒ `supuesto_sin_productor` |
| cualquiera sobre cobranza | — | **ninguno** | — | ⇒ `supuesto_sin_productor` |

---

## 4 · La validación, paso a paso (sin prosa, en este orden, todo puro)

```
validarEncargo(encargo, ctx) → Resolucion          ctx = { tenant, versionId, indice: entityIndex, libro?: libroDeConversacion }
 0. raíz: version · partes (vacío/tope) · claves desconocidas → si falla, Resolucion { ok:false, noResuelto:[…] } y PARA.
 1. por cada parte, en orden y SIN mirar a las demás:
    a. claves desconocidas de la parte → campo_desconocido (la parte sigue: es aviso, no veto)     ← decisión: aviso
    b. tema → TEMAS (desconocido | ausente ⇒ no_resuelta)
    c. cierre → CIERRES; reglas de §1.1
    d. eje → EJES ∩ ejes con productor del tema (default: DOMINIOS_REGISTRO[tema].sujeto)
    e. entidades → resolveCanonical(eje|guess) por cada una; las no resueltas van a noResuelto; parte parcial/no_resuelta por §1.2
       · si dos entidades resueltas tienen ejes distintos y el cierre es comparacion ⇒ ejes_mezclados
       · si una entidad resuelve en un eje sin productor para algún concepto ⇒ ese concepto ⇒ concepto_sin_productor (no la entidad)
    f. conceptos → CLAVES_DE_METRICA ∩ DOMINIOS_REGISTRO[tema].metricas; luego productor por (concepto, eje) (§3.3)
    g. universo → validarUniverso(universo, indice, sujeto) ; el eje del universo tiene que ser el de la parte
    h. periodo → enum; "mes"/"rango" ⇒ serieRealDe(entidad) (o negocio) ; sin serie ⇒ periodo_no_disponible
    i. cruce: si (tema, eje, conceptos) cae en BLOCKED_CROSSES ⇒ cruce_bloqueado
    j. ausencias: ausenciasDe(tema) → ParteResuelta.ausencias (siempre; no es error)
 2. criterio → CRITERIOS | REFERENCIAS_DE_LA_CASA ; inválido ⇒ noResuelto + criterio de ADI ("riesgo", origen "adi") + aviso
 3. supuestos → assumptionValid + alcance resuelto + productor (§3.5) + tope ; los válidos se ligan a las partes que los citan
 4. premisas → tipo ∈ TIPOS_DE_PREMISA + validarHecho(premisa, indice) ; el veredicto NO se calcula acá (lo pone la Entrega con el libro)
 5. usar · profundidad → enum
 6. contexto → formato ; sin libro ⇒ contexto_no_disponible (etapa 2 lo resuelve)
 7. ok = alguna parte resuelta o parcial
```

Prohibiciones del validador (candado en el gate): no importa `dominiosDeTexto`, `claveDeMetrica(texto)`,
`criterioDeLaPregunta`, `detectors.js`, `intentLayer.js`, ni ningún regex sobre `preguntaOriginal` ni sobre
`Supuesto.cita`; no usa fuzzy para RESOLVER (solo para ofrecer); no reordena partes; no elimina partes.

---

## 5 · Cómo se expresa lo no soportado (una sola forma, tres lugares)

1. **`Resolucion.noResuelto`** (§2): campo · valor recibido · motivo cerrado · detalle de la casa · alternativas tipadas.
2. **La Entrega** (etapa 1): cada `noResuelto` de una parte se imprime como un **límite con título** (`limites[]`,
   nunca una excusa ni un «no puedo»), y las alternativas van a `queMasPuedoCalcular.puedo`; una `tema_ausente`
   imprime la `ausencia` del registro con su `alternativa` (tesorería ⇒ «la exposición de crédito por cliente…»).
3. **El catálogo** (etapa 3, `capacidad/catalogo.js`): las mismas tablas de §3 se sirven al LLM ANTES de que pida,
   para que la primera vez ya sepa qué existe. Candado: cada entrada del catálogo tiene productor; cada `motivo`
   de §2.1 aparece al menos una vez en el catálogo de desarrollo.

Regla de redacción del `detalle`: texto de la casa que YA existe (`ausencia.texto`, `BLOQUEADOS.porque`,
`validarUniverso`/`validarHecho`, `composeCardinalityExceeded` sin dígitos) — nunca un texto nuevo por caso.

---

## 6 · Ejemplos

**6.1 · Encargo válido, dos temas, decisión con criterio, supuesto, dos premisas**
```json
{ "version": "encargo/v1", "conversacionId": null,
  "preguntaOriginal": "¿me conviene seguir empujando a Lider? mira margen y lo que me debe; yo creo que es el que más me compra",
  "partes": [
    { "id": "p1", "tema": "comercial", "cierre": "decision", "conceptos": ["ventas", "margen", "contribucion", "carga"], "entidades": [{ "nombre": "Lider" }] },
    { "id": "p2", "tema": "cobranza",  "cierre": "decision", "conceptos": ["saldo_vencido", "dias_vencido"], "entidades": [{ "nombre": "Lider", "eje": "cliente" }] }
  ],
  "criterio": { "lente": "credito" },
  "premisas": [
    { "id": "q1", "tipo": "orden", "sujeto": "Lider", "metrica": "ventas", "orden": { "forma": "max" }, "universo": { "eje": "cliente" } },
    { "id": "q2", "tipo": "estado", "sujeto": "Lider", "estado": "al dia" }
  ],
  "profundidad": "completa" }
```
Resolución esperada: p1 y p2 `resuelta`; criterio `credito` (origen usuario, alternativa `riesgo`); q1 ⇒ `falsa`
(la verdad con id: Falabella es la de mayor venta); q2 ⇒ `falsa` (Lider tiene saldo vencido al corte).

**6.2 · Parte con entidad inexistente y otra válida (parcial), más un tema ausente**
```json
{ "version": "encargo/v1",
  "partes": [
    { "id": "p1", "tema": "comercial", "cierre": "cifra", "conceptos": ["ventas"], "entidades": [{ "nombre": "Jumbo" }, { "nombre": "Cencosud" }] },
    { "id": "p2", "tema": "tesoreria", "cierre": "lectura" }
  ] }
```
Resolución: p1 `parcial` (corre Jumbo; `noResuelto` { parte:"p1", campo:"entidad", valor:{nombre:"Cencosud"},
motivo:"entidad_inexistente", alternativas:[…hasta 3 del índice…] }); p2 `no_resuelta` ({ campo:"tema",
valor:"tesoreria", motivo:"tema_ausente", alternativas:[{tipo:"ausencia", id:"sin_datos_tesoreria", …}] }).
Prohibido: que la Entrega imprima una cifra de Cencosud o de «otro cliente parecido».

**6.3 · Comparación mal armada**
```json
{ "version": "encargo/v1", "partes": [ { "id": "p1", "tema": "comercial", "cierre": "comparacion", "conceptos": ["margen"],
  "entidades": [{ "nombre": "Falabella" }, { "nombre": "Lider" }, { "nombre": "Jumbo" }] } ] }
```
Resolución: p1 `no_resuelta`, motivo `cardinalidad`, alternativa `{tipo:"cierre", cierre:"cifra"}` (ranking de los
tres); las tres entidades se declaran resueltas en `ParteResuelta.entidades` aunque la parte no corra.

---

## 7 · Decisiones de producto que este contrato PROPONE y no cierra (para el supervisor / owner)

1. **`campo_desconocido` en una parte es aviso, no veto** (§4.1a). Alternativa: veto de la parte. Propongo aviso: un
   LLM que agrega un campo extra no debería perder la consulta entera.
2. **`parcial` corre con los elementos válidos** (§1.2). Alternativa: toda parte con un elemento inválido no corre.
   Propongo parcial: es «temas reconocidos se cubren todos» aplicado dentro de la parte, sin sustituir nada.
3. **`origen: "documento"` no entra por el encargo** (solo por «aportar contexto», etapa 2, con sus tres sellos —
   REVISIÓN 3 §4). Un LLM que ya leyó un PDF debe declararlo primero y consultar después.
4. **`comparacion` en cobranza** (§3.4): no hay composer; propongo servirla como dos `cifra` de `mesaFlujo` lado a
   lado en la etapa 1, o declararla `cierre_incompleto` hasta que exista. Marcado `decision_pendiente` en el catálogo.
5. **Un mes del negocio como `cifra`** (`periodo.tipo:"mes"`, sin entidad): `trend` sirve la serie completa de 12
   meses de `ventasMensuales`, pero ningún productor devuelve UN mes suelto; y la serie del demo no declara año.
   Propongo `periodo_no_disponible` con alternativa «la serie de 12 meses» hasta que el compositor lo extraiga.
6. **`criterio.referencia`** (la vara del usuario para esta consulta): origen "declarado", vale para la conversación,
   no persiste (persistir es «aportar contexto»). La Entrega la imprime con dueño (`adi-referencia-de-quien`).
7. **`PARTES_MAX = 6`** es técnico (3 dominios activos × 2 cierres cabe de sobra); ajustable tras medir.

---

### 7.1 · Cerradas por el supervisor (arquitecto, 2026-09-25) — el owner delegó los mecanismos

1. Aviso, no veto. 2. `parcial` corre con lo válido (ley del owner: cada concepto se resuelve independiente, nunca
sustitución). 3. Documentos solo por «aportar contexto». 4. Comparación en cobranza = dos `cifra` de `mesaFlujo`
lado a lado + la diferencia como hecho `derivada` del libro (capacidad real del Core, no inventada). 5. Mes suelto =
`periodo_no_disponible` con alternativa «la serie de 12 meses» mientras la serie no declare año. 6. `criterio.referencia`
vale para la conversación y la guarda el libro de conversación (etapa 2); persistir en la empresa es «aportar
contexto». 7. `PARTES_MAX = 6`, ajustable tras medir.
Además: `ASSUMPTIONS` gana `carga` (pp) y `costo` (pct) como entradas ADITIVAS en la etapa 1 (el productor sale del
tipo, nunca de la cita); `definicion` de `recuperado` se sirve desde la definición canónica de `tasas.js` (abonado ÷
venta a crédito, ley del owner).

---

## 8 · Lo que el gate `_encargo_gate` comprueba (formato del fixture en `fixtures/encargos-desarrollo.json`)

Cada caso: `{ id, titulo, encargo, esperado }` con `esperado`:
```
{ valido: bool,
  partes: { resueltas: [ids], parciales: [ids], noResueltas: [ids] },
  temasCubiertos: [ids de tema que la Entrega DEBE cubrir],
  entidadesResueltas: [{ parte, nombre: canónico, eje }],
  noResuelto: [{ parte, campo, motivo, valorIncluye?: string, alternativasIncluyen?: [Alternativa parcial] }],   // subconjunto: cada uno debe existir
  criterio?: { lente, origen },
  premisas?: [{ id, veredicto }],
  limitesEsperados?: [ids de AUSENCIAS_DEL_DATO o títulos fijos],
  prohibido?: { entidades: [nombres que NO pueden tener cifra], conceptos: [claves que NO pueden imprimirse], temas: [ids que NO pueden aparecer] },
  decision_pendiente?: string }
```
El gate corre SOLO por `npm run gates:offline`; cero red; el tenant es el demo (`bonanza`). Los casos con
`decision_pendiente` se cuentan aparte y no ponen rojo hasta que el supervisor fije la decisión.
