# Contrato del Encargo v1 · la Solicitud tipada que el LLM le hace a ADI (Fable, 2026-09-25 · Etapa 0)

> Estado: ESPECIFICACIÓN para la etapa 1 (`_ADI_PLAN_PRODUCTO_V2.md`, B4 · corte 2 de `_ADI_DISENO_FLUJO_V2.md` §F).
> Solo lectura del repo (dev `5a27b0b8`); nada ejecutado. La implementa Sonnet en `src/adi/encargo/{esquema,validar}.js`
> detrás de `ADI_ENTREGA`, con el candado `_encargo_gate` sobre `fixtures/encargos-desarrollo.json`. Sin commitear.
>
> **PUESTA AL DÍA 2026-09-26 (Fable, sobre dev `9bf39d71`, tras la medición ciega de cierre de la etapa 1).** Varias
> decisiones posteriores al 2026-09-25 vivían solo en el código (`esquema.js`, `validar.js`, `lecturasDe.js`,
> `assumptionRegistry.js`) o en el diagnóstico de la medición, y el catálogo sellado v1 se escribió contra el texto
> viejo. Cada cambio de esta puesta al día lleva la marca **[2026-09-26]** en su sitio: §1 (`iniciativa`), §1.2 (tope de
> supuestos · universo único inválido · `campo_desconocido` de parte), §1.3 (ley de premisas con universo propio), §2 y
> §2.1 (motivos y campos), §3.3 (`markup` · `peso_costo` · `vs_presupuesto` · `margen_promedio`), §3.5 (`carga` · `costo` ·
> `custom`), §4 (orden de validación), §7.1 (cerradas) y §7.2 (abiertas, NO decididas) y §8 (regla del catálogo).

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
  iniciativa?:      "completa" | "ninguna"              // [2026-09-26] default "completa": el interruptor del LLM sobre la iniciativa de CFO
                                                        // (`_ADI_DISENO_CORTE_3D.md` §A.2c, corte 3d.1). "ninguna" la apaga entera; lo PEDIDO
                                                        // queda byte-idéntico con o sin ella (§A.6). Un valor fuera del enum ⇒ `iniciativa_invalida`
                                                        // (se declara, no bloquea, el compositor cae al default — mismo patrón que `profundidad`).
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
- **[2026-09-26] El tope de supuestos rechaza el CONJUNTO entero.** Con más de `SUPUESTOS_USUARIO_MAX` supuestos
  declarados, se declara `supuesto_tope` y **ningún** supuesto de ese encargo se valida ni se liga a una parte — nunca se
  eligen «los tres primeros» en silencio. Consecuencia: toda `simulacion` que los cite queda `cierre_incompleto` ⇒
  `no_resuelta`; las partes de otros cierres siguen corriendo (la regla de oro no cambia).
- **[2026-09-26] Una `cifra` sin entidades cuyo ÚNICO universo es inválido queda `no_resuelta`**, no `parcial`: el
  universo era la única forma en que la parte acotaba su población, y sin él no hay población sobre la que correr el
  concepto. Servir el listado global «como si» sería la sustitución silenciosa que la ley del owner prohíbe (medido en
  la etapa 1: una `cifra` de cobranza «clientes de Santiago» servía el ranking de los 13). Con entidades resueltas, un
  universo inválido sigue siendo `parcial` (corre sobre las entidades y declara el universo).
- **[2026-09-26] `campo_desconocido` dentro de una parte** es aviso (la parte corre) **y además** se declara en
  `noResuelto` como `{ parte: id, campo: "raiz", valor: <la clave>, motivo: "campo_desconocido" }` — lo mismo que ya
  hacía la raíz, para que lo no reconocido nunca quede solo en `avisos` (§7.1, ya cerrado; el código había
  implementado solo la mitad raíz). No cambia el estado de la parte.

### 1.3 · Premisas tipadas (esquema de `TIPOS_DE_HECHO`)

`TIPOS_DE_PREMISA` = `["cifra", "orden", "relacion", "grupo", "conteo", "variacion", "estado", "razon", "derivada"]` —
el subconjunto **factual** de `TIPOS_DE_HECHO` (`hechos.js`). Quedan fuera: `ref` (el LLM no conoce ids de fig),
`lectura` y `propuesta` (no son hechos verificables). Los campos son **los mismos** que `validarHecho` exige
(`sujeto`, `metrica` = clave de CLAVES_DE_METRICA, `valor`, `orden{forma,k,direccion,vs}`, `relacion{forma,k,vs}`,
`estado` = canon de `ESTADOS_CANON` (o `"no <canon>"`), `conteo{n,m}`, `de`/`universo` tipado, `variacion{direccion,valor}`,
`periodo` ∈ anterior|presupuesto|actual, `num`/`den`/`de` como `{sujeto, metrica}` — nunca por id de fig).
Veredicto: `libroDeHechos(premisas, { indice de la Entrega })` ⇒ `verdadera` | `falsa` (+ la verdad con id, `hNa…`) |
`no-verificable` (esquema inválido ⇒ `noResuelto.premisa_mal_formada` con el texto de `validarHecho`). Una premisa
`falsa` **nunca** cambia la conclusión (`premisa-adoptada`); la Entrega la declara en «Sobre la premisa planteada en la consulta» (§7.3·15).

**[2026-09-26] Ley de premisas con universo propio.** Una premisa trae SU PROPIO universo tipado (`universo`/`de`),
independiente del universo de la parte. Verificarla exige nombrar lo que ese universo contiene: el veredicto de
«hay 3 SKU en riesgo de quiebre» (universo global) nombra a PHI-HAIR-PRO aunque la parte pidiera solo Santiago; el
de «Falabella está al día» (falsa) nombra a Falabella con su saldo vencido aunque la parte fuera «los clientes al
día». Por eso: (1) una entidad que una premisa necesita nombrar **puede aparecer** en la Entrega aunque quede fuera del
universo de la parte — en «Sobre la premisa planteada en la consulta» (§7.3·15), nunca como sujeto de una cifra pedida; (2) el catálogo
(§8) **nunca** pone en `prohibido.entidades` una entidad que una premisa del mismo caso necesite nombrar (tres casos
del catálogo v1 se contradecían así); (3) lo que SÍ sigue prohibido es que una entidad fuera del universo de la parte
reciba una cifra propia en «Cifras» o en la oración de la respuesta pedida — eso es sustitución, no verificación.

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
                                                        //  "criterio"|"supuesto"|"premisa"|"usar"|"profundidad"|"iniciativa"|"contexto"|"raiz"
                                                        //  [2026-09-26] "iniciativa" agregado (corte 3d.1)
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
| `campo_desconocido` | clave fuera del esquema (raíz o parte). [2026-09-26] En la raíz invalida el encargo (§1.2); en una parte va a `noResuelto` con `parte: id`, `campo: "raiz"` y la parte corre (aviso + declaración) | — |
| `tema_desconocido` | `tema` ∉ ids de DOMINIOS_REGISTRO | `{tipo:"tema"}` × ids activos |
| `tema_ausente` | `tema` con `estado:"ausente"` (tesorería) | `{tipo:"ausencia", id: dominio.ausencia.id, alternativa}` |
| `cierre_desconocido` | `cierre` ∉ CIERRES | `{tipo:"cierre"}` × CIERRES |
| `cierre_incompleto` | el cierre exige algo que falta (§1.1) | lo que falta, tipado |
| `cardinalidad` | `comparacion` con ≠ 2 entidades, o simulación con más entidades que el cupo (6) | `{tipo:"cierre", cierre:"cifra"}` (ranking) |
| `ejes_mezclados` | `comparacion` con entidades de dos ejes | `{tipo:"eje"}` de cada una |
| `concepto_desconocido` | clave ∉ CLAVES_DE_METRICA ni CONCEPT_DEFS | `{tipo:"concepto"}` × claves del tema |
| `concepto_de_otro_tema` | clave existe, pero `dominio` ≠ `tema` | `{tipo:"tema", tema: dominio de la clave}` |
| `concepto_sin_productor` | clave del tema, pero ningún productor la sirve en ese eje (§3.3). [2026-09-26, regla del supervisor tras RC6] Es el motivo **por concepto** (campo `concepto`, uno por clave que falla) siempre que el eje salió **por defecto** (de una entidad o del sujeto del tema), y también cuando el eje fue **explícito** pero AL MENOS otro concepto de la misma parte sí tiene productor en ese eje (prueba de que el eje es válido; lo que falla es el concepto) | `{tipo:"eje"}` donde sí · `{tipo:"concepto"}` que sí |
| `entidad_inexistente` | `resolveCanonical` = null en el eje dado, o `guessDimension` = null sin eje | hasta 3 `{tipo:"entidad"}` del fuzzy de `entityIndex` (como OFERTA) |
| `entidad_ambigua` | sin `eje` y `guessDimensionDetallado.colision` | `{tipo:"entidad", nombre, eje}` por cada colisión |
| `entidad_eje_incompatible` | la entidad existe en OTRO eje que el declarado | `{tipo:"entidad", nombre, eje: el real}` |
| `eje_no_soportado` | `eje` ∉ EJES; o [2026-09-26, regla del supervisor tras RC6] `Parte.eje` **explícito** y **ningún** concepto pedido tiene productor en ese eje (ahí falla el eje, no un concepto): UN solo `noResuelto` con campo `eje`, nunca uno por concepto. Con eje por defecto este motivo no se usa (es `concepto_sin_productor`) | `{tipo:"eje"}` disponibles |
| `cruce_bloqueado` | la parte pide un cruce de `BLOCKED_CROSSES` (cliente×sku, marca×cliente) | `offer` del cruce como `{tipo:"concepto"}` |
| `universo_invalido` | `validarUniverso` devuelve texto | — (detalle = ese texto) |
| `periodo_mal_formado` | `tipo` ∉ enum, o `valor` no ISO | `{tipo:"periodo", periodo:{tipo:"vigente"}}` |
| `periodo_no_disponible` | `mes`/`rango` sin serie real para esa entidad/eje (`serieRealDe`), o `rango` (sin productor en v1) | `{tipo:"periodo", periodo:{tipo:"vigente"}}` + la ausencia `sin_serie` si aplica |
| `criterio_desconocido` | `lente` ∉ CRITERIOS o `referencia.concepto` ∉ REFERENCIAS_DE_LA_CASA | `{tipo:"lente"}` × CRITERIOS |
| `criterio_tesoreria` | reservado: NO existe una lente de caja; una `lente` inexistente cae en `criterio_desconocido` con alternativa `credito` | `{tipo:"lente", lente:"credito"}` + ausencia `sin_datos_tesoreria` |
| `supuesto_mal_formado` | `assumptionValid` falla, o `alcance` no resuelve; [2026-09-26] o `tipo:"custom"` en una parte comercial sobre cliente/sku/marca/familia — «custom» no nombra un concepto de negocio y la Entrega no puede rotularlo (§3.5): se declina con las alternativas de concepto nombrado (`carga`, `costo`) | `{tipo:"supuesto", tipo_supuesto, units}` · `{tipo:"concepto", concepto:"carga"\|"costo"}` |
| `supuesto_sin_productor` | tipo válido, pero sin productor para (tema, eje) — §3.5 | `{tipo:"supuesto"}` con productor |
| `supuesto_tope` | más de SUPUESTOS_USUARIO_MAX. [2026-09-26] Rechaza el conjunto ENTERO: ningún supuesto del encargo se valida ni se liga (§1.2); `valor` = la cantidad recibida | — |
| `origen_no_admitido` | `origen` = "documento" (o fuera del enum) | — (§7) |
| `premisa_mal_formada` | `tipo` ∉ TIPOS_DE_PREMISA o `validarHecho` devuelve texto | — (detalle = ese texto) |
| `usar_invalido` / `profundidad_invalida` / `iniciativa_invalida` | fuera del enum ([2026-09-26] `iniciativa_invalida` agregado, corte 3d.1: se declara y el compositor cae a "completa") | — |
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
| vs_presupuesto · vs_presupuesto_usd | cliente · marca · familia · canal · negocio | `salesRead{focus:"vs_presupuesto"}` (`_pptoByDim`, presupuesto real por marca/familia/canal agregado desde `clientesVentas.presupuesto`), `ventasKPI` | **[2026-09-26, corregido con evidencia en el corte 3a]** antes decía «marca/familia/sku NO». Lo que sí declina: **sku** («por SKU no tengo presupuesto propio») y **bodega** (el dato no baja a ese eje) |
| markup | **cliente** (cobertura PARCIAL) | `herramientasAgente.js:rolesCartera()` — «{cliente} · Markup sobre costo» con `raw` real, solo para las cuentas del recorte de cartera (las que caen bajo el benchmark, tope 8 por venta, y los sanos con huella de precio) | **[2026-09-26, corregido en el corte 3d — «una sola verdad», error material]** antes decía «cliente · sku · marca · familia» vía `marginRead`. `marginRead`/`entityRecord` NO publican el cociente: una `cifra` puntual de markup sobre una cuenta fuera del recorte de `rolesCartera` no tiene fig ese turno (gap reportado de `lecturasDe`). Marca/familia/sku ⇒ `concepto_sin_productor` |
| peso_costo | **ninguno** (`[]`) | — | **[2026-09-26, corte 3d.3/3d.4, opción B]** `costShare` se calcula en al menos dos sitios sin relación declarada (`specRetrieval._costShare` por SKU · `sentrix/reading.js`) y la única fig viva salía del auto-walk de `ledger.js`, no de un productor deliberado: declarar uno sería inventar una segunda verdad. La Entrega dejó de servirlo (`_planCifraEntidad` filtra por `productorDe`) y toda parte que lo pida ⇒ `concepto_sin_productor` en cualquier eje |
| margen_promedio | negocio (escalar, `lexico.js: negocio:true`) | `margenKPI.pct` | [2026-09-26] sin eje de entidad propio: por cliente/marca/etc. ⇒ `concepto_sin_productor` |
| benchmark · nivel_carga · umbral_materialidad | negocio (referencias) | POLICY / perfil | se citan, no se ordenan |
| capital · unidades_stock | sku · bodega · marca · familia (capital) · sku · bodega (stock) | `METRICS.capital` / `METRICS.stock` | **cliente NO** (`BLOCKED_CROSSES`) |
| capital_frenado · capital_inmovilizado | sku · bodega · familia | `mesaCapital` / `inventoryStatus{frenado}` | |
| rotacion · dias_inventario | sku · bodega | `METRICS.rotacion` / `METRICS.doh` | cliente/marca/familia NO |
| dias_sin_venta | sku | `skuInventario.diasSinVenta` | |
| margen_inventario | sku | `skuInventario.margenPct` | |
| piso_rotacion · techo_cobertura | negocio (referencias) | POLICY | |
| umbral_frenado (días) | negocio (referencia) | perfil de la empresa · o `criterio.referencia` del encargo, con origen «planteado en la consulta» (vale solo para esa consulta, nunca es criterio de la empresa; §7.3·35, `_REFERENCIA_FAMILIAS`) | «se cita, no se ordena»: ninguna parte lo pide como cifra |
| venta_credito · saldo_vencido · saldo_pendiente · saldo_por_vencer · abonado · recuperado · dias_vencido | cliente · negocio | `mesaFlujo` (`flujoComercial`) | **solo cliente**: marca/familia/sku/canal/bodega ⇒ `concepto_sin_productor` |

### 3.4 · Cierres por tema (lo que hoy tiene ruta)

| tema | cifra | lectura | decision | comparacion | simulacion | definicion |
|---|---|---|---|---|---|---|
| comercial | sí | sí (`componerEntregaBrechaComercial` + contrato comercial) | sí | sí (2 entidades, mismo eje) | sí (§3.5) | sí |
| inventario | sí | sí (`componerEntregaInventario`) | sí | sí (2 SKU / 2 bodegas) | `simulateCapital` (sku) | sí |
| cobranza | sí | sí (`componerEntregaCobranza`) | sí | sí, 2 clientes por `mesaFlujo` (no por `compareEntities`): las dos cifras de la mesa + su diferencia derivada, con el mismo `_planComparacion` (§7.3·40c) | **no** (sin productor) | sí |
| multi-tema | — | sí (`componerEntregaMultidominio`) | sí (cierre integrado siempre) | — | — | — |

### 3.5 · Supuestos con productor (para `simulacion`)

| tipo (ASSUMPTIONS) | unidad | productor | tema · eje | condición |
|---|---|---|---|---|
| price | pct | `simulateGeneral` (variableA) | comercial · cliente/sku/marca/familia | `perfil.costModel` declarado (demo: `variable_total`) |
| growth | pct · money | `simulateGeneral` (variableB volumen) / `simulate` | comercial · cliente/sku/marca/familia | idem |
| margin | pct (pp) | `simulateCosto` (vía costo medio) / `calcular.margen_objetivo` | comercial · sku/cliente/marca/familia | — |
| **carga** (tipo NUEVO, §7.1) | pp | `simulateCarga` (`delta_pp`) | comercial · **cliente** | **[2026-09-26]** reemplaza a «custom con `perturbs: carga`» de la tabla original: el productor sale del TIPO, nunca de la `cita`. `alcance` con otro eje ⇒ `supuesto_sin_productor` |
| **costo** (tipo NUEVO, §7.1) | pct | `simulateCosto` (`scope:"all"` sobre la entidad del alcance) | comercial · sku/cliente/marca/familia | **[2026-09-26]** idem: entrada aditiva de `ASSUMPTIONS` |
| custom en comercial | — | **ninguno**: se declina ANTES de buscar productor | comercial · cliente/sku/marca/familia | **[2026-09-26, corte 3d — «custom es jerga del sistema»]** ⇒ `supuesto_mal_formado` con alternativas `{tipo:"concepto", concepto:"carga"}` (solo cliente) y `{tipo:"concepto", concepto:"costo"}`. Antes la Entrega componía «supuesto: custom −1 %» sin decir de qué era el −1 % |
| custom capital | — | `simulateCapital` (liberar capital frenado, sin parámetro) | inventario · sku | el supuesto es «liberar»; no toma valor (se mantiene: acá «custom» nunca produjo jerga porque no hay cifra que nombrar) |
| inventory | days · pct | **ninguno** (`assumptionRegistry.js`: «la simulación paramétrica todavía NO tiene productor») | — | ⇒ `supuesto_sin_productor` |
| cualquiera con `alcance: "negocio"` | — | **ninguno** hoy (los cuatro productores exigen una entidad del alcance) | — | [2026-09-26] ⇒ `supuesto_sin_productor` |
| cualquiera sobre cobranza | — | **ninguno** | — | ⇒ `supuesto_sin_productor` |
| más de SUPUESTOS_USUARIO_MAX (3) | — | — | — | [2026-09-26] `supuesto_tope` y el conjunto entero se rechaza (§1.2) |

---

## 4 · La validación, paso a paso (sin prosa, en este orden, todo puro)

```
validarEncargo(encargo, ctx) → Resolucion          ctx = { tenant, versionId, indice: entityIndex, libro?: libroDeConversacion }
 0. raíz: version · partes (vacío/tope) · claves desconocidas → si falla, Resolucion { ok:false, noResuelto:[…] } y PARA.
 1. por cada parte, en orden y SIN mirar a las demás:
    a. claves desconocidas de la parte → campo_desconocido (la parte sigue: es aviso, no veto)     ← decisión: aviso
       [2026-09-26] …y ADEMÁS un noResuelto { parte, campo:"raiz", valor: clave, motivo:"campo_desconocido" } (§1.2)
    b. tema → TEMAS (desconocido | ausente ⇒ no_resuelta)
    c. cierre → CIERRES; reglas de §1.1
    d. eje → EJES ∩ ejes con productor del tema (default: DOMINIOS_REGISTRO[tema].sujeto)
    e. entidades → resolveCanonical(eje|guess) por cada una; las no resueltas van a noResuelto; parte parcial/no_resuelta por §1.2
       · si dos entidades resueltas tienen ejes distintos y el cierre es comparacion ⇒ ejes_mezclados
       · si una entidad resuelve en un eje sin productor para algún concepto ⇒ ese concepto ⇒ concepto_sin_productor (no la entidad)
    f. conceptos → CLAVES_DE_METRICA ∩ DOMINIOS_REGISTRO[tema].metricas; luego productor por (concepto, eje) (§3.3)
       [2026-09-26, regla del supervisor (RC6)] el motivo cuando falta productor:
         · eje POR DEFECTO (entidad o sujeto del tema)            ⇒ `concepto_sin_productor` por cada concepto que falla
         · eje EXPLÍCITO y ≥ 1 concepto pedido SÍ produce en él   ⇒ `concepto_sin_productor` por cada concepto que falla
         · eje EXPLÍCITO y NINGÚN concepto pedido produce en él   ⇒ UN `eje_no_soportado` (campo "eje"), sin entradas por concepto
       (cierra la ambigüedad «D36» que el código dejó escrita; el cruce bloqueado sigue siendo `cruce_bloqueado`)
    g. universo → validarUniverso(universo, indice, sujeto) ; el eje del universo tiene que ser el de la parte
       [2026-09-26] `cifra` SIN entidades cuyo único universo es inválido ⇒ estado `no_resuelta` (§1.2)
    h. periodo → enum; "mes"/"rango" ⇒ serieRealDe(entidad) (o negocio) ; sin serie ⇒ periodo_no_disponible
    i. cruce: si (tema, eje, conceptos) cae en BLOCKED_CROSSES ⇒ cruce_bloqueado
    j. ausencias: ausenciasDe(tema) → ParteResuelta.ausencias (siempre; no es error)
 2. criterio → CRITERIOS | REFERENCIAS_DE_LA_CASA ; inválido ⇒ noResuelto + criterio de ADI ("riesgo", origen "adi") + aviso
 3. supuestos → tope PRIMERO ([2026-09-26] si se excede, `supuesto_tope` y ningún supuesto se valida ni se liga) ;
    luego assumptionValid + alcance resuelto + «custom» comercial ⇒ supuesto_mal_formado + productor (§3.5) ;
    los válidos se ligan a las partes que los citan
 4. premisas → tipo ∈ TIPOS_DE_PREMISA + validarHecho(premisa, indice) ; el veredicto NO se calcula acá (lo pone la Entrega con el libro)
 5. usar · profundidad · iniciativa → enum ([2026-09-26] `iniciativa_invalida` declara y no bloquea)
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

**[2026-09-26] Cerradas después (supervisor / owner, cortes 3a–3d y medición de cierre de la etapa 1):**
8. `iniciativa` ∈ {"completa","ninguna"} en la raíz del encargo (§1); lo pedido queda byte-idéntico con o sin ella.
9. `custom` en una parte comercial ya no compone: `supuesto_mal_formado` con alternativas de concepto nombrado (§3.5).
10. Regla de RC6 (supervisor): eje explícito sin ningún concepto productor ⇒ un `eje_no_soportado`; con algunos ⇒
    `concepto_sin_productor` por concepto; eje por defecto ⇒ siempre `concepto_sin_productor` (§2.1, §4f).
11. El tope de supuestos rechaza el conjunto entero (§1.2, §4·3).
12. `cifra` sin entidades con su único universo inválido ⇒ `no_resuelta` (§1.2, §4g).
13. `campo_desconocido` dentro de una parte también va a `noResuelto` con `campo:"raiz"` (§1.2, §4·1a).
14. Ley de premisas con universo propio: una premisa puede nombrar entidades fuera del universo de la parte, y el
    catálogo no las prohíbe (§1.3, §8).
15. La tabla §3.3 se corrigió con evidencia: `markup` solo cliente (parcial), `peso_costo` sin productor,
    `vs_presupuesto` por cliente/marca/familia/canal, `margen_promedio` solo negocio.

### 7.2 · Abiertas tras la medición (2026-09-26) — CERRADAS por el supervisor el mismo día (ver 7.3)

### 7.3 · Decisiones del supervisor sobre 7.2 (2026-09-26, arquitecto; el owner delegó los mecanismos)

1. RC9 · `lectura`/`decision` con TODOS los conceptos pedidos sin productor → `no_resuelta` (misma regla que `cifra`).
2. `lectura`/`decision` sin entidades cuyo ÚNICO universo es inválido → `no_resuelta` (misma regla que `cifra`, 7.1·12):
   nunca se sirve la cartera entera en lugar del recorte pedido.
3. RC12 · entidad puntual de eje `bodega`/`canal` con concepto que SÍ produce en ese eje → se SIRVE por el listado del
   eje filtrado a esa entidad (la promesa del validador se cumple); sin productor → `concepto_sin_productor`.
4. RC14 · `definicion` sin `concepto` → `cierre_incompleto`, `campo: "concepto"`.
5. RC15 · `ejes_mezclados` → `campo: "cierre"` (igual que `cardinalidad`).
6. RC13 · `entidad_inexistente` con eje EXPLÍCITO de ≤ 5 miembros y sin ningún parecido → se ofrecen TODOS los
   miembros como alternativas (solo en el validador; el escaneo de texto libre no lo usa).
7. Comparación en cobranza: cerrada por la §7.3·40(c) (composer = `_planComparacion` sobre las figs de `mesaFlujo`; medida en el catálogo v16, V45).
8. [2026-09-26, tras la medición v6] `top` combinado con `estados`/`filtros` en el MISMO universo: por defecto el top se
   calcula DENTRO del conjunto ya filtrado («los 3 deudores más grandes entre los que están en mora»), que es la
   pregunta de negocio más común. Para la lectura inversa («de los 3 de menor venta, cuántos están en mora») el
   universo declara `top.sobre: "eje"`: el top se toma sobre el eje entero y los filtros actúan DENTRO de él. El LLM
   elige la forma según lo que entendió; ADI nunca adivina cuál quiso decir.
9. [2026-09-26] `supuestos` es un campo-lista como `conceptos` y `entidades`: una simulación con algunos supuestos
   válidos y otros no corre con los válidos, declara los inválidos y queda `parcial`; sin ninguno válido, `no_resuelta`.
10. [2026-09-26, tras la medición v6] «De M» con `top.sobre:"eje"`: el conjunto que el top toma sobre el eje entero
    (ANTES de `estados`/`filtros`) es un M admisible para un `conteo` sobre ese mismo universo — el mismo rol que ya
    cumple `base`. Con el sentido por defecto (top DENTRO del filtro) no cambia nada: ahí `k` ya es el tamaño del
    universo filtrado, no una restricción previa nueva.
11. [2026-09-26] `universo.base` no identificable → lo declina el VALIDADOR (`validarUniverso`, no el compositor):
    un `base` que no es un conjunto de la casa, o que es un conjunto de OTRO eje (p. ej. «carga comercial alta» —de
    cliente— con `eje:"sku"`), cae en `noResuelto {campo:"universo", motivo:"universo_invalido"}`; la parte queda
    `no_resuelta` y nunca se sirven todas las entidades del eje en su lugar. **Cobertura completa (2026-09-27)**:
    SABER qué conjuntos existen (nombre · eje · familia) es conocimiento estático de la casa y vive en UN registro,
    `notario/conjuntosDeLaCasa.js` (familias carga, benchmark y estado; los nombres son las mismas constantes que
    escriben `datoProyectado.js` y leen `_conjuntosConocidos`); quiénes son MIEMBROS sigue exigiendo las figs del turno
    y no cambió. El validador consulta el registro, puro y sin tenant: declina un nombre que no es conjunto de la casa
    («clientes grandes») o uno de otro eje («bajo el benchmark» con `eje:"sku"`). (Una primera versión, del
    2026-09-26, cubría solo la familia de carga.)
12. [2026-09-27 · DECISIÓN DEL OWNER: «con el benchmark de la empresa, como recomiendas»] Una referencia declarada por
    el usuario (`criterio.referencia`, §7.1·6) NO recalcula los conjuntos de la casa. «Bajo el benchmark» y «sobre el
    benchmark» se resuelven siempre con el benchmark que declaró la EMPRESA: la pantalla y ADI dicen la misma cifra (una
    sola verdad por eje). La referencia del usuario se RESPETA y se DECLARA junto a la de la empresa, con lo que cambiaría:
    «con su referencia de 25 %, serían 4», con su propia cifra y las cuentas, calculadas por la misma función de la casa
    contra ese valor. Nunca reemplaza a la oficial en silencio ni se presenta como objetivo de la empresa.
13. [2026-09-27, diagnóstico v7] Un ranking parcial es un problema de LECTURA, no de verificación. La regla del
    Notario no cambia: lo ausente no vale 0, y un extremo «menor/peor/mejor» no se decide sobre un ranking incompleto.
    Pero si el Core tiene la métrica para todo el eje, la lectura del encargo tiene que TRAER el ranking completo cada
    vez que un universo o una premisa necesite un extremo o un orden sobre el eje. Solo cuando el Core de verdad no
    tiene el dato (por ejemplo, una marca sin año anterior) se declina con `universo-incompleto`.
14. [2026-09-27] Un `criterio.lente` desconocido NO se traduce: entender el lenguaje le toca al LLM, no al
    validador. Queda `criterio_desconocido` y como alternativas se ofrecen TODAS las lentes existentes (`CRITERIOS`),
    para que el LLM elija. La alternativa «exposición de crédito» + `sin_datos_tesoreria` es exclusiva de la palabra
    reservada de tesorería («caja»/«liquidez», §2.1).
15. [2026-09-27] El dueño de una premisa es QUIEN CONSULTA, no la empresa. Para mantener la tercera persona se
    escribe «Sobre la premisa planteada en la consulta». «Declarado por la empresa» solo vale para la configuración de
    la empresa (el benchmark, el nivel de carga) y nunca para lo que alguien da por hecho en una pregunta.
16. [2026-09-27] Los conjuntos de la casa cuyo eje se conoce de antemano van TODOS en el registro estático
    (`notario/conjuntosDeLaCasa.js`), también los que dependen del estado de cada entidad: «con saldo vencido»
    (cliente), «con capital frenado» (sku) y cualquier otro que `_conjuntosConocidos` sepa resolver. Un nombre que no
    está en el registro es inválido; no hay listas de «dejar pasar».
17. [2026-09-27, diagnóstico v8] Una parte `lectura`/`decision` sin entidades pero con universo PROPIO (`top`, `base`,
    `estados`, `no_estados`, `filtros`, `bodega` o `union`) se compone sobre ESE universo, con el mismo mecanismo que
    `cifra`: primero el conjunto (con la misma resolución que usa el Notario) y después las cifras de lo pedido,
    ordenadas por la métrica que la parte pidió. En una `decision`, la prioridad integrada (la conclusión del
    procedimiento) se calcula DENTRO de ese universo y nunca fuera. El camino multitema, «quién pesa más» con la lente de
    negocio, queda SOLO para partes sin restricción propia. Invariante que la Entrega verifica y que falla cerrado: el
    conjunto declarado de cada parte con universo propio es exactamente el que resuelve el universo (o su cola
    declarada). Si no coincide, esa parte se declina con un límite y no se sirve otra respuesta en su lugar.
18. [2026-09-27] Si la RAÍZ del encargo es inválida y sus partes se pueden leer, cada parte aparece en `R.partes` como
    `no_resuelta`, con el motivo de la raíz. Quien consulta sabe así qué partes no se atendieron y por qué. Solo si las
    partes no se pueden leer, `R.partes` queda vacío.
19. [2026-09-27] §7.3·12 vale para toda referencia que define un conjunto de la casa (benchmark, nivel declarado de
    carga, piso de rotación), no solo para el benchmark, y también para el universo de una PREMISA. Lo alternativo se
    declara con la cifra Y los nombres de las cuentas.
20. [2026-09-27, diagnóstico v9; precisa la 18] «Con el motivo de la raíz» se refiere a CADA parte: cada parte legible
    lleva en `R.partes[i].motivo` el motivo de la raíz, y además queda la declaración única en `noResuelto` con
    `parte:null`.
21. [2026-09-27] Cuando un universo propio excede el tope de tamaño de la Entrega, las filas que el gobernador de tamaño
    retira pasan a `entrega.detalle` con los mismos ids (`tamano.js`) y siguen SERVIDAS: una entidad del universo está
    servida si tiene fila en `cifras` o en `detalle`. La tabla tiene que declarar que el resto está en el detalle (la
    cola se declara, nunca se omite). Nunca se recorta el CONJUNTO (`entrega.universos`).
22. [2026-09-27, diagnóstico v9; precisa la 17] Toda parte `lectura`/`decision` con universo propio se compone sobre SU
    universo, aunque el encargo tenga varias partes así, sean del mismo dominio o de dominios distintos. La prioridad
    cruzada entre dominios (multitema) se AGREGA encima, calculada sobre la unión de esos universos, y nunca reemplaza
    el contenido de cada parte.
23. [2026-09-27, diagnóstico v9 · W28] Un umbral de dinero («saldo pendiente > $1.000.000») se juzga con la cifra
    EXACTA, nunca con su redondeo impreso: Ripley, con $1.048.700, está sobre $1M aunque se imprima «$1.0M». La cifra
    exacta la DECLARA el Core. La proyección publica el crudo de cada fila de dinero de cobranza con el MISMO factor de
    escala que ya usa la tool `cobranza()` (`fx`, la escala declarada del dataset), y el verificador nunca deduce la
    escala por el nombre de la clave. Por eso se corrige la etiqueta `n4` del fixture `hechos-tipados-2026-09-17` (fue
    calibrada contra el texto redondeado): la cuenta verdadera es 3, no 2 (decisión del supervisor, con esta evidencia).
    Por el mismo hecho y con la misma evidencia se corrigen también `u18-m-de-la-cadena.h2` y
    `t02-control-cobranza-2.h4` de `fixtures/ronda5-2026-09-17/hechos.json` (n 2 → 3).
    **Alcance (precisado el 2026-09-28, diagnóstico v11):** el principio vale para TODO umbral de dinero, en cobranza, en
    comercial (ventas, contribución…) y en inventario (capital…). Cada ranking de dinero de la proyección publica su
    crudo con la escala declarada de su fuente.
24. [2026-09-27, diagnóstico v10; precisa la 22] En la prioridad cruzada participan las partes `decision` con universo
    propio (también un universo solo de estados); las `lectura` y las `cifra` no participan. Se cruza en la CLAVE REAL
    compartida (ley de la prioridad integrada: señal por señal en el cliente; los SKU van aparte). Si las decisiones
    no comparten eje (por ejemplo, inventario por SKU y cobranza por cliente), NO se inventa un ganador entre ejes: la
    Entrega declara que no se establece una prioridad entre esos dominios porque se miden sobre ejes distintos, y cada
    parte conserva su prioridad dentro de su universo. Nunca silencio.
25. [2026-09-27] Un hecho OPCIONAL de la casa (la tentación precalculada, una derivada de apoyo) nunca tumba la
    Entrega: si no puede declararse con su crudo, no se declara. Solo lo que se va a IMPRIMIR tiene que verificar.
26. [2026-09-27, catálogo v11; precisa la 24] (a) Forma MIXTA: las decisiones que comparten eje cruzan entre sí (hay un
    ganador en la unión de sus universos) y la Entrega declara que las de otro eje no entran en esa prioridad; cada
    una conserva la suya. (b) Dos decisiones por SKU (comercial por SKU e inventario) comparten la clave real (el SKU):
    cruzan y hay ganador. **(b) queda REVISADA el 2026-09-27 por la decisión 27.** (c) Si los ejes pedidos son distintos, la declaración de que no se establece una prioridad
    entre esos dominios se mantiene, aunque una de las partes haya resuelto vacía o se haya declinado: depende de los
    ejes pedidos, no del resultado.
27. [2026-09-27, supervisor; corrige la 26(b) según la ley del owner de la prioridad integrada] La prioridad integrada
    del procedimiento se define señal por señal EN EL CLIENTE, y «los SKU van aparte» (CLAUDE.md, prioridad integrada).
    Por eso dos decisiones por SKU NO cruzan: se declara que no se establece una prioridad entre esos dominios y cada
    una conserva la suya. Además, si en el mismo eje uno de los dominios resuelve vacío, no hay nada que cruzar: cada
    parte conserva su prioridad y no hace falta declarar nada.
28. [2026-09-27, supervisor; ley de registro del owner] La Entrega nunca repite una palabra de la lista de registro
    prohibida («dormido», «plata»…), aunque venga de lo que escribió quien consulta. Al declinar, nombra el campo y ofrece
    los valores válidos de la casa como alternativas, sin reproducir la palabra y sin traducirla (entender el lenguaje le
    toca al LLM).
29. [2026-09-28, supervisor; ley «declinar honestamente cuenta como éxito»] Si TODAS las partes resueltas se declinan
    al componer (ranking incompleto, universo que no coincide…), la Entrega sale igual (`ok:true`), con un límite por
    parte en lenguaje de negocio, el marco y las premisas verificadas. Nunca una Entrega vacía: quien consulta tiene
    que saber qué no se pudo responder y por qué. `ok:false` queda solo para una raíz inválida o un error interno.
30. [2026-09-28, supervisor; ley «una definición por estado»] Cada estado de inventario tiene UNA definición
    (`notario/estados.js`, la misma que la Mesa Capital), y «inmovilizado» y «frenado» son estados DISTINTOS que pueden
    convivir con «capital sano» (Notario v3.1). Todo miembro de un universo por estado recibe la cifra pedida de la
    MISMA fuente del Core que la pantalla usa para ese SKU. Si el Core no define esa cifra para un miembro, la Entrega lo
    DECLARA como límite (miembro sin esa cifra); nunca lo omite en silencio ni inventa la cifra. Antes de cambiar una
    definición de estado, se reporta al supervisor.
31. [2026-09-28 · DECISIÓN DEL OWNER: «Apruebo inmovilizado = frenado + sobrestock con los umbrales de la empresa»]
    Capital INMOVILIZADO = los SKU en estado frenado o sobrestock según `diagnoseInventarioSku`, con los umbrales de la
    empresa (POLICY: rotación mínima, días máximos, sobrestock desde N días). FRENADO = el subconjunto crítico dentro de
    él. Se retiran la regla por el texto crudo del dato (`estado ≠ Activo`) y el indicador escrito a mano. La pestaña
    sigue llamándose «Capital inmovilizado», muestra el universo completo y distingue lo frenado como subconjunto
    crítico (UX del owner). El indicador, la pantalla y la Entrega leen UNA sola función de jerarquía.
    **Precisada por el owner el mismo día («Apruebo completamente la separación entre inmovilizado, inmovilizado
    crítico y frenado»):** INMOVILIZADO = capital atrapado por permanencia o rotación insuficiente (capital_frenado ∪
    sobrestock) · INMOVILIZADO CRÍTICO = el tramo capital_frenado (la palabra «frenado» deja de nombrar esta regla en
    superficie; la clave interna no cambia) · FRENADO = venta interrumpida, medida por los días sin venta. La relación
    entre frenado e inmovilizado se MIDE (intersección); nunca se asume que uno contiene al otro.
32. [2026-09-28 · DECISIÓN DEL OWNER: «ningún veredicto debe esconder de dónde proviene su criterio»; alcance:
    procedencia y transparencia, sin reabrir la lógica de inmovilizado salvo una contradicción material]
    (a) FRENADO: los días sin venta son un HECHO y se usan siempre (ranking, contraste con el ritmo propio del SKU, el
    estado «sin venta»). El VEREDICTO «frenado» exige un umbral declarado, por la empresa (en su perfil) o planteado en
    la consulta (vale para esa pregunta y se atribuye a quien consulta). Sin umbral, queda «sin evaluar», con el
    ofrecimiento de fijarlo; nunca «no hay frenados», nunca tramos inventados y nunca 60 días como verdad de ADI.
    (b) Todo veredicto que depende de un umbral (inmovilizado, crítico, sobrestock, frenado, y el piso de materialidad
    por coherencia) declara el ORIGEN de su criterio: «declarado por la empresa», «criterio general de ADI, ajustable
    por la empresa» o «planteado en la consulta». La misma procedencia llega al indicador, a la pantalla y a la Entrega.
33. [2026-09-28, supervisor; diagnóstico v11] Tamaño con contenido obligatorio: si en «breve» el contenido que no se
    recorta (premisas, conclusiones) supera el tope porque hay una prioridad cruzada ENCIMA de las prioridades por
    parte, las oraciones de prioridad DENTRO de cada universo pasan a `entrega.detalle.oraciones` con los mismos ids
    (siguen servidas; «Ver el detalle» las declara) y la respuesta conserva las premisas y la prioridad cruzada. Si
    aun así no cabe, la Entrega se sirve igual, sin cortar nada obligatorio, y lo declara en `meta`
    (`excedeTope: true`). El tope nunca se cumple borrando una conclusión ni una premisa.
34. [2026-09-28 · DECISIONES DEL OWNER, cerradas; no se reabren salvo una contradicción material nueva]
    (a) El tramo se llama **«inmovilizado crítico»** (= capital_frenado). La alerta del archivo (`alerta === "crit"`)
    deja de llamarse «crítico» en superficie y pasa a «con alerta en el archivo»: una palabra, un significado.
    (b) Los corpus viejos de «frenado» (con el significado de la regla de rotación) se CONGELAN como registro histórico,
    y se crean pruebas NUEVAS para la definición vigente.
    (c) La experiencia de la cara Capital, aprobada: el ranking por días sin venta; el total del período y la fecha de
    la última venta como HECHOS históricos (sin promedios ni frecuencias); el capital acumulado sin cortes; el cruce con
    inmovilizado, con la procedencia de su umbral; y la nota que invita a declarar el umbral de frenado. Se retiran los
    tramos fijos de días y la frase «más de 60 días».
    (d) El estándar es SEMÁNTICO, no una lista de palabras: estos datos viajan como hechos tipados «históricos», con su
    período y sus fechas. Una afirmación sobre el futuro exige una simulación con supuestos. Las pruebas usan
    redacciones variadas de las dos clases (pronósticos que tienen que caer y formas históricas que tienen que pasar).
    Nada revisa después la prosa del modelo.
    (e) [supervisor, dentro de «perfil conversando»] La empresa declara su umbral de frenado conversando (camino B del
    perfil); eso cuenta como «declarado por la empresa». Un parámetro en la plantilla queda para después (plantilla
    congelada: decisión del owner).
35. [2026-09-29 · DECISIÓN DEL OWNER: «Apruebo A. La garantía "histórico, no pronóstico" queda en lo que ADI entrega
    antes del LLM. No abras B.»] Precisa la 34(d): la garantía NO es un veredicto sobre la prosa del modelo (ningún
    policía después del LLM). Vive en lo que ADI ENTREGA: los días sin venta, las unidades del período y la última venta
    viajan como hechos tipados «históricos», con su período y sus fechas (o los días hasta la fecha de corte), y el límite
    «describe lo que pasó; no es un pronóstico» va DENTRO del dato. Nada de lo que ADI entrega autoriza un pronóstico
    sin una simulación con supuestos. Las pruebas verifican ESO sobre la Entrega y la boleta, no sobre el texto del
    modelo. Un tipo de afirmación «proyección» en el Notario (la opción B) NO se abre.
    La referencia `umbral_frenado` (días) entra por `criterio.referencia` del encargo, con origen «planteado en la
    consulta» (§7.3·12 y ·19), y vale solo para esa consulta.
36. [2026-09-29, supervisor; diagnóstico v12, precisa decisiones ya aprobadas por el owner]
    (a) Una parte que pide «frenado» SIN umbral se declina como VEREDICTO (límite «sin evaluar» con el ofrecimiento), y
    SIRVE el ranking de días sin venta como HECHO histórico, bajo su propio universo. No es «sin filas»: las filas son el
    hecho, nunca el veredicto (aprobado por el owner el 2026-09-29).
    (b) La 32(b) cubre TODO veredicto que depende de un umbral: inmovilizado, inmovilizado crítico, sobrestock, frenado,
    rota bien/lento (piso de rotación), riesgo de quiebre y el piso de materialidad. Cada uno lleva su origen junto a su
    umbral en la Entrega (en `marco.definiciones`, una cláusula por umbral).
    (c) El techo de cobertura (días de inventario máximo) es una referencia que define un conjunto de la casa: cae en la
    decisión 19 (la referencia del usuario se declara al lado, con su cifra y sus nombres).
37. [2026-09-29, supervisor; diagnóstico v13, precisa decisiones ya aprobadas por el owner]
    (a) El veredicto de una premisa FALSA dice la verdad del procedimiento con su dueño: la entidad, su cifra propia (de la
    métrica pedida, nunca de otra) y, si la premisa era sobre un top o un orden, su PUESTO real. Nunca claves internas
    (`capital_frenado`, «los 1 de mayor»), y nunca el k del top como cifra.
    (b) El veredicto de una premisa sobre un estado que depende de un umbral (rota lento, riesgo de quiebre, inmovilizado,
    sobrestock, frenado, capital sano) imprime el VALOR del umbral con que se juzgó, igual que la regla de las referencias;
    el ORIGEN va en `marco.definiciones`, con su valor (la 36b).
    (c) «capital sano» entra en la 36(b): depende de los mismos umbrales que los demás estados.
    (d) Los estados de la Mesa Capital (inmovilizado crítico, sobrestock, rota lento…) son conjuntos que define una
    referencia (piso de rotación, techo de días), así que la referencia del usuario sobre ellos se declara al lado (la 19 y
    la 36c).
38. [2026-09-29, supervisor; diagnóstico v14, precisa decisiones ya aprobadas]
    (a) La 37(a) vale para TODA premisa falsa: grupo, orden, relación y conteo. Una premisa de orden falsa dice el puesto
    real del sujeto y quién ocupa el puesto afirmado, con sus cifras. Una relación falsa dice las dos cifras. Un conteo
    falso dice el n real. Nunca claves internas ni notas técnicas («ausente = 0»); si una cifra vale 0 porque la entidad
    no pertenece al conjunto, se dice en palabras de negocio.
    (b) La 37(b) incluye la materialidad: el veredicto sobre «carga comercial alta» imprime el umbral de materialidad con
    que se juzgó. «Sobrestock» y «riesgo de quiebre» declaran solo sus propios umbrales (se mantiene la lectura de v12).
    (c) Un supuesto de crecimiento en DINERO en una simulación («+$500.000») se interpreta como volumen adicional a precio
    constante sobre la venta del período cerrado de esa entidad, y la Entrega DECLARA esa conversión como supuesto
    («equivale a X % de su venta del año cerrado, a precio constante»). Nunca se pasa un monto como porcentaje.
    (d) Dos conceptos con clave exacta distinta nunca casan por vocabulario («Capital inmovilizado» ≠ «Capital inmovilizado
    crítico»).
39. [2026-09-29, supervisor; diagnóstico v15]
    (a) Un porcentaje se escribe con el formato de la casa (`formatoDeLaCasa`) en toda superficie; ninguna tool arma su
    propio formato. La cuenta usa el valor CRUDO, nunca el redondeado.
    (b) El `valor` numérico de una premisa `cifra` sin unidad toma la unidad de su métrica (el léxico).
    (c) En el veredicto de una premisa, un cero se dice en palabras de negocio junto a su cifra («no tiene saldo vencido
    ($0)», «no tiene capital inmovilizado ($0)»), sea cero medido o por ausencia del conjunto. Mismo criterio para toda
    métrica.
    (d) Un universo con solo `excluir` (entidades o conjuntos) es un universo PROPIO: restringe lo servido y lleva la
    procedencia y la referencia de sus conjuntos.
    (e) En una tabla que mezcla partes, toda fila tiene su dueño (entidad) y su tema.
40. [2026-09-29, supervisor; diagnóstico v16]
    (a) Un conjunto de la casa que ES un estado (p. ej. «con capital inmovilizado crítico») declara los umbrales de ese
    estado, esté en `base`, en `excluir.conjuntos` o en una premisa.
    (b) El formato de la casa conserva el significado de la cifra: un porcentaje chico no se redondea a otro valor
    («0.05 %» nunca es «0.1 %»). Una misma cifra se escribe de UNA forma en toda la Entrega; si la boleta trae dos figs con el
    mismo rótulo y formatos distintos, la Entrega usa una sola. La boleta del agente vivo no cambia en esta etapa.
    (c) Cierra la §7.3·7: una comparación en COBRANZA entre dos cuentas se compone con las dos cifras de la mesa de flujo
    (la misma fuente que la pantalla) más su diferencia derivada, y las premisas se juzgan sobre ellas.
    (d) Un UMBRAL DECLARADO (por la empresa, la consulta o como criterio de ADI) se escribe con su valor declarado
    exacto («0.75%», nunca «0.8%»), en el Marco, en el veredicto y en la referencia: es un número declarado, no una medición.
    El formato de la casa con redondeo vale para las cifras MEDIDAS.
41. [2026-09-30, supervisor; diagnóstico v17]
    (a) Precisa la 40(a): un conjunto que es un estado SIN umbral (p. ej. «con saldo vencido» = «en mora», definido
    como saldo vencido > 0) no declara umbrales; en la Entrega puede nombrarse como el conjunto o como el estado.
    (b) Precisa la 40(d) junto con la 12, la 19 y la 37(b): una referencia planteada en la consulta que NO reemplaza a
    la oficial se escribe exacta en su declaración al lado (la referencia declarada o el límite), no en el Marco ni en el
    veredicto; esos llevan la oficial con que se juzgó. Cuando la referencia de la consulta ES la operativa
    (`umbral_frenado` sin umbral oficial), va exacta en las tres.
    (c) La verdad propia de una premisa falsa de grupo trae la entidad, su cifra propia (o su estado propio) y la
    referencia. NO se exige la fórmula «lo deja fuera <conjunto>» con esas palabras; con `top`, si la entidad está fuera
    del top, su puesto es una razón verdadera y suficiente.
    (d) Las referencias de la consulta sobre el piso de materialidad caen en la 19: se declaran al lado del piso oficial
    con su origen y nunca lo reemplazan en silencio.
42. [2026-09-30, supervisor; diagnóstico v18]
    (a) Un EMPATE en la verdad propia: el puesto es el compartido (el del primero del empate) y la oración nombra con quién
    empata. Un puesto que depende del orden de la lista nunca se imprime como si fuera único.
    (b) El Marco declara TODAS las referencias oficiales con que se juzgó (p. ej. el benchmark y el nivel de carga oficial
    cuando un conjunto de la casa lo define), no solo la primera.
    (c) Una cifra de cobranza sin restricción de universo se sirve sobre el eje COMPLETO (toda la cartera; lo ausente vale
    cero), nunca sobre un top fijo del productor. La boleta del agente sin encargo tipado no cambia.
    (d) Un filtro que cita una referencia (`ref`) la pone en juego igual que una `base`: la referencia de la consulta
    sobre ese filtro se declara al lado de la oficial (19, 41b), con la dirección que da su `op`.
    (e) Una pregunta abierta que presupone un estado (p. ej. «¿plazo pactado o atraso real?» presupone mora) solo se formula
    sobre una entidad que está en ese estado; si no lo está, no se formula.
43. [2026-09-30, supervisor; diagnóstico v19]
    (a) Se mantiene el Notario v3.1 (plan aprobado por el owner): una premisa «es la k.ª» o «el más/menos» cuyo puesto
    está COMPARTIDO no es verificable como puesto único. Se declara el empate, con los empatados y el puesto compartido,
    y no se da por verdadera ni por falsa. La 42(a) no se extiende a las premisas verdaderas.
    (b) Un orden servido con empate declara el puesto compartido y quiénes lo comparten.
    (c) Una relación juzgada (verdadera o falsa) dice la cifra de CADA lado en la oración (garantía transversal 4 de la
    Constitución: comparaciones con la cifra de cada lado).
    (d) Una parte `no_resuelta` no reporta entidades resueltas.
    (e) El Marco comercial cita el benchmark con que se juzga el margen, aunque la consulta no lo nombre.
    (f) Una cifra sobre un eje completo, sin orden pedido, se exhibe de mayor a menor. En una métrica donde más es peor
    (días o saldo vencido), así va primero lo que pide atención, y si el tope de tamaño manda filas al Detalle, nunca van
    las peores. En una métrica donde más es mejor (venta, margen) se conserva el orden de siempre.
44. [2026-09-30, supervisor; diagnóstico v20]
    (a) Un top cuyo filo cae DENTRO de un empate sirve a TODOS los empatados del filo y lo declara («top 8: 9 cuentas,
    Paris y Tottus empatan en el puesto 8»); nunca elige a uno ni declina el top. Una premisa de pertenencia a ese top sobre
    un empatado del filo es verdadera y declara el empate. Una premisa de PUESTO único sigue la 43(a).
    (b) Una definición comercial sola no es un Marco comercial: no cita benchmark. Un concepto que el validador acepta pero
    que no tiene definición curada se declara como límite, nunca queda `resuelta` sin contenido.
    (c) La 42(c) (el eje completo) rige para la `cifra`. Una `lectura` o una `decision` sin universo sirven su foto y su
    prioridad, no la cartera completa.
    (d) El «de M» de un conteo es el tamaño del universo de la PREMISA, el mismo que la premisa planteó, no el de otra base.
    (e) Cada premisa lleva UNA sola traza de su verdad; nunca se repite.
45. [2026-09-30, supervisor; diagnóstico v21] Reemplaza la 44(c).
    (a) LA FOTO. Una `lectura` o `decision` sin universo ni entidades sirve el universo que su productor publica, en su
    orden, con la prioridad del procedimiento encima. Lo declarado ES lo servido; la cola se declara («8 de 13 cuentas») y
    una cuenta sana lleva su cero. En cobranza son las cuentas de la mesa; en inventario y comercial, el eje que sus conceptos
    sostienen.
    (b) El orden exhibido de la 43(f) rige DENTRO de cada parte `cifra`; una tabla que comparten dos partes no fija un orden
    común.
    (c) Una BODEGA pedida acota el universo servido, también el del hecho histórico de los días sin venta cuando no hay
    umbral de frenado: «los frenados de Valparaíso» sirve los SKU de Valparaíso, nunca los de todas las bodegas.
    (d) Una verdad propia puede llevar, además del estado propio, la cifra que lo define («está en mora, saldo vencido $2.5M»).
    (e) Una lente se nombra con su nombre visible («por exposición de crédito»), nunca con su id interno.
46. [2026-09-30, supervisor; diagnóstico v22]
    (a) Un `criterio` puede traer lente y referencia a la vez; conviven. Una referencia inválida junto a una lente válida
    se declara y conserva la lente.
    (b) `ejes_mezclados` rige solo la comparación. Una `cifra` con entidades de dos ejes se sirve con el productor de cada
    una, y cada cifra conserva su unidad (una venta en unidades nunca se imprime como venta en dinero).
    (c) El «de M» admisible de un conteo es cualquier eslabón de la cadena del universo de la premisa. La verdad de un conteo
    falso por su M imprime el más ajustado.
    (d) EL CRITERIO DEL USUARIO MANDA (ley del owner): la lente pedida gobierna la prioridad de la parte. La prioridad
    cruzada entre dominios sigue en riesgo integrado, dicho como tal. Una oración nombra SIEMPRE la lente que de verdad
    ordenó su lista; nunca nombra una lente que no la ordenó.
    (e) La foto declara las cuentas que no traen la cifra de un concepto pedido.
    (f) El empate en el filo en cero dice su cifra (39c).
47. [2026-09-30, supervisor; diagnóstico v23]
    (a) Una lente que APLICA al dominio de la parte ordena con SU medida: exposición de crédito en cobranza = saldo
    vencido, con desempate por días; capital en inventario = capital inmovilizado crítico; contribución en comercial =
    contribución no capturada. Si esa medida no distingue a nadie (todo en cero, empate total o sin dato), se declara
    que ninguna cuenta queda primera por esa lente; nunca se corona a la primera de la lista ni se cambia de criterio en
    silencio. Un total en cero no tumba la Entrega.
    (b) La 45(d) se mantiene: la verdad propia PUEDE llevar la cifra del estado; no está obligada.
    (c) En una simulación con más supuestos que el tope, el campo del motivo `cierre_incompleto` es «cierre».
    (d) Una lente de OTRO dominio se declara y el grupo se ordena por su propia medida, que se nombra (46d).
    (e) Pendiente del OWNER: la lente «contribución» sobre un grupo sin brecha al benchmark. Hoy: «ninguna cuenta queda
    primera», declarado. Alternativa: caer a la contribución medida, declarándolo.
48. [2026-09-30, supervisor; diagnóstico v24 y barrido por familia]
    (a) Lo declarado ES lo servido, también cuando el empate es en cero: cada entidad que un top sirve lleva su fila. Un top
    se lee con el productor de su familia de métricas.
    (b) Una lente sin dominio (riesgo, crecimiento, ventas) sobre un grupo que no ordena se DECLARA y el grupo se ordena por
    la medida que se nombra (46d, 47d); «riesgo» sobre un grupo se declara como el criterio entre dominios.
    (c) El «de M» de un conteo recorre la cadena completa del universo (antes de excluir, antes del top) y la falsa por su M
    imprime el eslabón más ajustado.
    (d) Toda oración que compone la Entrega pasa `verificarEntrega`; composer y verificador no se contradicen.
    (e) Una definición sola no cita benchmark (44b) y la cola de la foto se declara también en profundidad breve.
49. [2026-09-30, supervisor; mediciones v25 y v26]
    (a) La referencia de la consulta se declara al lado de la oficial en CADA parte que usa ese conjunto, con su conteo y
    sus entidades en el eje de esa parte (12, 19); nunca solo en una de ellas.
    (b) Una `decision` con entidades nombradas DECIDE: da la prioridad entre ellas por la lente pedida o, sin lente, por la
    de ADI, nombrada. Si la lente no distingue, se declara (47a).
    (c) LA FOTO (45a): toda entidad de su universo tiene fila o se nombra con su cero; en comercial la foto es el eje entero.
    Si un productor publica menos que el universo, lo que falta se declara.
    (d) Una premisa carga su evidencia aunque ninguna parte pida su concepto; nunca queda no verificable por eso.
    (e) La lente «ventas» APLICA a todo eje donde el dato publica venta (cliente, marca, familia, SKU): ordena por ventas.
    (f) Una cifra conserva el rótulo de su concepto: ventas nunca se rotula «venta a crédito», aunque coincidan en valor.
    (g) El corte entre Cifras y Detalle nunca parte una entidad: sus filas van juntas.
50. [2026-09-30, supervisor; corrección v25/v26]
    (a) LA PRIORIDAD PIDE ATENCIÓN. Con la medida de una LENTE (saldo vencido, capital inmovilizado crítico, contribución
    no capturada, ventas), la prioridad va de mayor a menor: quien más pesa. Cuando el grupo se ordena por su medida
    PROPIA, porque la lente no aplica, va primero lo que pide atención según la polaridad del léxico: donde más es peor
    (carga, días), el mayor; donde más es mejor en una TASA o RAZÓN (margen, rotación), el menor. Una MAGNITUD (dinero o
    unidades: ventas, contribución, unidades) va de mayor a menor: quien más pesa. Una prioridad nunca corona al mejor por
    una tasa. La 50(a) rige la ORACIÓN de prioridad; el orden de la lista de una foto es el de su productor (45a).
    (b) La 49(e) queda firme: una lente sin dominio ordena todo eje donde el dato publica su medida; donde no la publica
    (inventario por SKU para ventas), se declara.
    (c) Si el tope de tamaño no alcanza para las entidades enteras que citan las oraciones de una `lectura` con varias
    partes, la cabeza cita solo las que caben enteras y declara que hay más en el Detalle (49g).
51. [2026-09-30, supervisor; mediciones v27 y v28]
    (a) Precisa la 45(a) y la 50(a): la LISTA de una foto se ordena por el primer concepto pedido que su productor publica,
    y la Entrega DICE por cuál («ordenado por …»). La oración de prioridad sigue la 50(a).
    (b) Una entidad que el usuario NOMBRA, o que un top sirve, tiene su fila en cada concepto pedido que su productor
    publica. Si no la tiene, se declara con verdad. Un límite nunca niega una cifra que la misma Entrega imprime.
    (c) La 48(d) rige en TODAS las oraciones, incluidas las de puesto («Easy, 7.° de 13»): la cifra pertenece a su dueño
    y el verificador la acepta.
    (d) La 48(b) rige en TODOS los caminos: «riesgo» pedido sobre un grupo se declara como el criterio entre dominios y se
    nombra la medida que ordenó; nunca «por riesgo integrado: X» sobre un grupo.
    (e) Una `decision` o `lectura` sobre el eje BODEGA sirve las bodegas (45a), no un SKU.
    (f) La 49(f) en filas: cada concepto pedido lleva SU rótulo del léxico. Capital inmovilizado ≠ capital inmovilizado
    crítico; saldo por vencer ≠ saldo pendiente; venta a crédito se rotula «Venta a crédito».
    (g) La 49(a) sobre una parte que EXCLUYE un conjunto: la referencia se declara sobre el conjunto de la casa (forma de la
    12), con su conteo contra el oficial.
52. [2026-09-30, OWNER; consolidación, inventario del paso 1]
    (a) LA VENTA EN COBRANZA (owner): en cobranza el único dato de venta es la venta a crédito; la lente «ventas» se dice
    «por venta a crédito», nunca «ventas» a secas.
    (b) EL CERO SOLO SI EL DATO LO DEMUESTRA (owner). Hay dos ceros reales: el MEDIDO (la fuente tiene la fila de la entidad
    y el valor es 0) y el de COBERTURA DECLARADA (la fuente declara que cubre a todo el grupo; no figurar = nada, y se dice
    por qué: «no figura en la cartera de crédito»). Todo lo demás es DATO AUSENTE: «sin dato de X para Y», nunca un número;
    no se ordena, no se cuenta ni se suma como 0, y se declara aparte. Una tasa sin denominador es «sin dato», nunca 0 %.
    Cada cifra lleva su origen (medido · cobertura declarada · ausente). «Ausente = cero» deja de ser una lista por métrica:
    pasa a ser la declaración de cobertura de cada fuente. El verificador rechaza un 0 sin uno de los dos orígenes.
    Reemplaza a AUSENTE_VALE_CERO y precisa la 39(c), la 45(a), la 49(c) y la 51(b).
    (c) COBRANZA (owner): la foto de una lectura o decision de cobranza son las cuentas de la mesa, en el orden de la mesa,
    con la cola «N de 13» declarada; una `cifra` sin restricción cubre las 13 (42c). Las cuentas fuera de la foto que la
    mesa sí mide pueden darse con su cero medido.
    (d) LA 47(e) (owner): la lente «contribución» sobre un grupo sin brecha dice «ninguna queda primera», declarado.
    (e) Técnicas (supervisor):
        · un criterio que solo trae una referencia nombra la medida que ordenó y la referencia como tal;
        · la referencia de la consulta se declara una vez por conjunto y eje (precisa la 49a). Si la usan DOS o más partes,
          la declaración nombra las partes que cubre; si la usa una sola, no hace falta nombrarla (precisión de la consolidación
          F3, 2026-10-01). Con cero miembros se dice «ninguno», nunca una lista en blanco;
        · la decisión 30 (miembro sin la cifra) rige en todos los temas;
        · una oración que el verificador rechaza se retira de la Entrega y se declara el límite;
        · las filas de la tabla de señales de la prioridad conservan el rótulo de su señal;
        · una fig sin clave en el léxico se declara, no se imprime con un rótulo crudo.
53. [2026-10-01, supervisor; consolidación F1] Corrige la 48(b) y la 51(d) a la luz de la ley del owner sobre la prioridad
    integrada («tres lentes por dominio con señales; dentro del dominio cada lente ordena»). «Por riesgo integrado: X» sobre
    un grupo de UN dominio es válido cuando X es el primero del plan de señales de ese dominio (materialidad + severidad +
    urgencia): es la prioridad del procedimiento, no un criterio inventado. Lo que se prohíbe es nombrar riesgo cuando el
    plan de señales no ordenó esa lista, o coronar a alguien distinto del primero del plan. Cuando la lente pedida no ordena el
    grupo, se declara y sigue la lectura de riesgo con la misma condición.
54. [2026-10-01, supervisor; mediciones v31 y v32] Precisa la 46(c), la 48(c) y la 50(b).
    (a) LOS ESLABONES DE UN CONTEO. La cadena del universo de una premisa tiene un eslabón por cada restricción, en orden: el
    eje entero, la base, CADA estado, CADA filtro, el top y la exclusión. El universo FINAL también es un eslabón. Un «de M»
    es admisible si M es el tamaño de cualquiera de ellos, así que «n de n» sobre el universo final es verdadero. La verdad de
    un conteo falso por su M imprime el eslabón más ajustado distinto del final.
    (b) Un concepto sin productor en el eje pedido siempre declina CON alternativas (§2.1): el eje donde sí se publica y el
    concepto que sí se publica en ese eje. Nunca se declina con una lista de alternativas vacía.
    (c) La 50(b) se aplica igual en todos los caminos: la lente «ventas» sobre una parte de INVENTARIO por SKU se declara y
    no ordena, aunque el universo de la parte use un top por ventas.
55. [2026-10-02, supervisor; mediciones v33 y v34] Corrige la 54(c) y precisa la 50(a) y la 52(a).
    (a) Corrige la 54(c): si el universo de la parte YA viene ordenado por venta (un top por ventas que pidió el usuario), lo
    que ordenó la lista es la venta, y la oración lo nombra así («por venta, el top que se pidió»), sin declarar «ventas no
    ordena este grupo». Una oración nunca dice que una medida no ordena y a la vez ordena por ella. Sin ese top, la lente
    «ventas» sobre inventario se declara como dice la 50(b).
    (b) La 52(a) es por PARTE: «por venta a crédito» se dice solo en una parte de COBRANZA. En una parte comercial la lente
    «ventas» ordena por la venta del período y se dice «por ventas», aunque el mismo encargo tenga una parte de cobranza.
    (c) Tras «ninguna cuenta queda primera» (47a), la lista conserva el orden del top o del universo que se pidió; la 50(a)
    rige la oración de prioridad, no esa lista.
56. [2026-10-02, supervisor; implementación de la 55] LA LENTE «CRECIMIENTO». Su medida es la variación contra el año
    anterior. Donde el dato publica esa variación para el eje de la parte, la lente APLICA y ordena; la oración se dice «por
    crecimiento» y no declara que no ordena (la no contradicción de la 55a). Por ser la medida de una LENTE (50a), va primero
    la de mayor variación. Donde el dato no publica la variación, se declara como dice la 50(b), y si alguien no tiene dato se
    aplica la 52(b).
57. [2026-10-02, supervisor; mediciones v37 y v38] Precisa la 56, la 55(b) y la 54(a).
    (a) La base de «crecimiento» es la VARIACIÓN PORCENTUAL contra el año anterior, en todos los ejes. La variación en dinero
    puede acompañar como cifra de apoyo, pero no decide quién va primero.
    (b) La 56 rige en TODOS los caminos: grupo, foto, universo con miembros, entidades nombradas y partes de un encargo mixto.
    Va primero quien tiene la mayor variación, y quien no tiene dato se declara aparte (52b) en ese mismo camino.
    (c) En un encargo mixto, cada parte que decide lleva SU oración de prioridad con el nombre de su lente (52a por parte),
    aunque comparta entidades con otra parte.
    (d) En la 54(a), la bodega, cada no_estado y cada rama de una unión también son eslabones de la cadena.
    (e) Un concepto de otro dominio pedido en una parte se declina como `concepto_de_otro_tema` antes de evaluar su productor
    (§4, el orden de la validación).
58. [2026-10-03, owner; Etapa 2 · bloque 3, certificación de la procedencia] LA PROCEDENCIA DE LO DECLARADO Y DE LO DOCUMENTAL.
    El defecto (verificado por el supervisor): `referencias.js` escribía «declarado por la empresa» FIJO en el benchmark, el
    nivel de carga y la referencia oficial, y `componer.js` escribía «Simulación declarada por la empresa». Con el demo era
    verdad (su perfil declara esos valores); con una empresa que no los declaró (una cargada por la plantilla v2, que ya no
    pide políticas) era una procedencia FALSA. Criterio de cierre del owner: cero atribuciones falsas y sin regresiones materiales.
    (a) UNA SOLA FUNCIÓN DE ORIGEN. `businessPolicy.js:procedenciaDeLlave(llave)` devuelve `{ origen, fuente, confirmado }` y es la
        misma resolución que `umbral()` (nunca dos); la frase sale de UNA tabla (`ETIQUETA_ORIGEN`, con su forma femenina) a través de
        `etiquetaDeProcedencia`. Ningún composer escribe «declarado/a por la empresa» a mano: el candado `_procedencia_gate` barre
        `src/` (sin comentarios) y se pone en rojo si la frase aparece fuera de la tabla (con su carnada).
    (b) SOLO DOS DEFINICIONES SE AJUSTAN —la frontera entre ellas—; nada más se reclasifica (lo medido sigue como está, `doh` NO se
        reclasifica ahora, el criterio general de ADI y lo planteado en la consulta conservan su frase).
        · DECLARADO («declarado por la empresa») solo cuando hubo un acto explícito de declaración: (1) el perfil de la empresa
          (`tenant.perfil`; en el Complemento, el perfil o los criterios confirmados, `conCriteriosDeEmpresa`); (2) un criterio dicho
          en el chat y confirmado; (3) un PARÁMETRO de la plantilla oficial cuyo contrato le pregunta a la empresa su decisión,
          llenado por ella, con rastro (plantilla · hoja · celda) —hoy, en la v2, solo identidad, período y moneda: ninguna
          política—; (4) un valor documental que la empresa confirmó adoptar: pasa a declarado conservando el rastro («declarado por
          la empresa, tomado de <documento>»).
        · DOCUMENTAL («según <documento>», y «, sin confirmar» si no se confirmó): un valor que dice un documento o un archivo que NO
          es la plantilla oficial (el Excel de un proveedor, un contrato, un PDF), AUNQUE la columna se llame «meta», «benchmark» u
          «objetivo». Nunca «declarado por la empresa» mientras no se confirme; y lo pendiente NO se usa (igual que en el bloque 3):
          no llega a `POLICY` (`valorUsableDelPerfil`; el perfil anota el rastro en `perfil.procedenciaDeLlaves`).
        · La frontera de archivos: «viene de un archivo» NUNCA se convierte automáticamente en «declarado por la empresa».
        · Sin declaración y sin documento: «criterio general de ADI, ajustable por la empresa».
    (c) LA SIMULACIÓN. El supuesto de una simulación sale del encargo, no de una declaración de la empresa: «Simulación declarada por
        la empresa» pasa a «Simulación planteada en la consulta» (la etiqueta de consulta de siempre, en femenino; el rótulo corto de
        la columna en «breve», «Declarada», pasa a «Planteada»). No hay una taxonomía nueva de supuestos.
    (d) EL PLAZO DE COBRO DECLARADO, opción A: visible en «Lo declarado» con su procedencia y citado por la pregunta abierta de
        cobranza de esa cuenta («¿plazo pactado o atraso real?»), SIN modificar ningún cálculo (las cifras, la respuesta y el Marco
        de la Entrega son los de antes de declararlo). Si en el futuro se mide el atraso contra el plazo pactado, será una MÉTRICA
        EXPLÍCITA nueva, con su contrato; no se construye aquí.
    (e) DOS PRINCIPIOS.
        · Un declarado y un medido SE COMPARAN solo si ADI puede demostrar mismo concepto, misma unidad y, si es dinero, misma moneda
          y misma escala; si no, se muestran por separado, sin restar (`loDeclarado.js:comparabilidad`). La prohibición fija «el
          dinero declarado no se compara» se reemplazó por esta función; con el dato de hoy el resultado es el mismo (lo declarado
          no trae moneda ni escala), y respeta «símbolo declarado sí, escala JAMÁS»: la escala no se infiere.
        · NO es regla universal «nunca calcular con declarados»: un declarado participa en un cálculo solo si el contrato de ESA
          métrica lo permite explícitamente (`metricRegistry.js:admiteDeclarado`, por defecto falso), con su procedencia y sin
          sustituir silenciosamente un medido (`loDeclarado.js:insumoDeCalculo`). Hoy ninguna métrica lo permite.
    (f) ABIERTO (a decisión; no se tocó por ser vocabulario de la casa o texto de instrucción): los nombres «benchmark de la
        empresa», «techo de cobertura de la empresa», «nivel declarado de carga» y «piso de rotación declarado» (léxico y conjuntos
        del Notario) siguen diciendo «de la empresa»/«declarado» aunque la referencia oficial sea el criterio general de ADI; y
        la cabecera de uso de `consultar` (`CABECERA_DE_USO`) dice «el benchmark es el que declaró la empresa».

(Texto original de 7.2, conservado como historia:)
- **`lectura`/`decision` con TODOS los conceptos pedidos sin productor** (RC9): hoy queda `parcial` con
  `conceptos: []`; ¿debe ser `no_resuelta`, como ya lo es en `cifra`? Alcanza también a `temasCubiertos`.
- **`lectura`/`decision` sin entidades cuyo único universo es inválido**: la decisión 12 se tomó para `cifra`; ¿la
  misma regla para los otros dos cierres?
- **Entidad puntual de eje `bodega`/`canal` en una `cifra`** (RC12): el validador la acepta (`productorDe` es true
  para capital@bodega, ventas@canal) pero `entityRecord` no cubre esos ejes; ¿se enruta por el group-by filtrado o se
  declina con `eje_no_soportado`? El catálogo v2 espera que se SIRVA (el validador ya lo promete).
- **`definicion` sin el campo `concepto`** (RC14): ¿`cierre_incompleto` (campo ausente) o `concepto_desconocido`
  (valor fuera de catálogo)? El contrato §2.1 distingue las dos; el código usa la segunda.
- **`ejes_mezclados`: campo `eje` o `cierre`** (RC15): su hermano `cardinalidad` usa `cierre` (ejemplo 6.3).
- **Alternativas de `entidad_inexistente` en un eje chico** (RC13): con un eje de ≤ N miembros sin ningún parecido,
  ¿se ofrecen todos los miembros? (`findCandidates` hoy devuelve `[]`).
- **Comparación en cobranza**: cerrada como «dos `cifra` de `mesaFlujo` + `derivada`» (7.1·4) pero sin composer
  medido todavía — sigue `decision_pendiente` en el catálogo. [Cerrada por la §7.3·40(c): `_pasosComparacion` la lee de `cobranza` (mesaFlujo)
  con las dos cuentas y `_planComparacion` compone los pares y la diferencia derivada.]

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

**[2026-09-26] Reglas de redacción del catálogo (aprendidas de la medición v1):**
- `prohibido.entidades` **nunca** incluye una entidad que una premisa del mismo caso necesite nombrar para
  verificarse (§1.3, ley de premisas con universo propio): si la parte restringe el universo y una premisa mira el
  universo global, las entidades que el veredicto nombra quedan fuera de la prohibición. Lo que se prohíbe es que
  reciban una cifra propia como sujeto de lo pedido.
- Las expectativas se escriben contra el CÓDIGO vigente y este contrato ya puesto al día (§3.3, §3.5), nunca contra
  una tabla que el código corrigió después: un caso que pida `capital_frenado` por marca o `markup` por marca espera
  `concepto_sin_productor`, no `resuelta`.
- Un supuesto de carga/costo se escribe con `tipo:"carga"`/`"costo"` (§7.1), nunca `custom` + `cita`.
- `supuestosResueltos: [{ id, productor }]` y `avisosIncluyen: [tipos]` son campos opcionales adicionales del
  `esperado`, ya usados por el catálogo de desarrollo.
