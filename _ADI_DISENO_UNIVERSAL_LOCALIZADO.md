# ADI · Business Knowledge — bloque «UNIVERSAL / LOCALIZADO» (Etapa 2, bloque 6)

Diseño del arquitecto, 2026-10-04. Sin implementar, sin commit. Rama `dev`, HEAD `c621516e`, prod v2.31.
Capa `src/adi/conocimiento/` detrás de `ADI_CONOCIMIENTO` (APAGADA en todos los perfiles).

---

## 0 · Aprobado por el owner (2026-10-04)

Estas decisiones mandan sobre el resto del documento donde choquen (en particular §3.5, §6-A/B/C y el encargo del §7). Implementado en `dev` por el bloque 6; certificado por `_universal_localizado_gate.mjs`.

1. **Clasificación.** PRI-04 = **UNIVERSAL**, entendido como «no depende del perfil» (su `alcance` sin dependencias). CAU-01 = **LOCALIZADA por modelo comercial** (cuentas grandes / cadenas), no por sector. CAU-06 y CAU-03 = localizadas pero **borradores: siguen sin servirse**; el bloque no activa conocimiento nuevo ni crea piezas.
2. **Mecanismo** (§3): cada pieza exige solo los campos del perfil de los que depende; solo cuenta lo **confirmado** (lo pendiente no cuenta); si el perfil confirmado la descarta, no aparece y no se dice nada. Corrige el defecto de `evaluarPertinencia.js` (recibía `perfil` y nunca lo leía): la aplicabilidad la decide `conocimiento/alcance.js:aplicaAlPerfil`, aguas arriba, en la selección.
3. **Límite explícito cuando falta el contexto localizado:** una línea en la Entrega, en tercera persona, p. ej. «Hay una referencia del oficio para empresas que venden a cadenas; la empresa no ha declarado su modelo comercial.» Se redacta desde datos de la pieza y del campo (no a mano por pieza) y reutiliza `necesitaPerfil`/`preguntasDelPerfil` para que el anfitrión pregunte aparte.
4. **Formulación neutral** (el owner RECHAZÓ «Para toda empresa» porque sobreafirma): encabezado universal = **«Criterio general, independiente del perfil de la empresa:»**; localizada servida = **«Aplica por el modelo comercial declarado por la empresa»** (el campo que corresponda). Ambos en UNA tabla de datos (`alcance.js:ENCABEZADOS`); «declarado por la empresa» sale de `ETIQUETA_ORIGEN`, nunca escrito a mano. Esto reemplaza al §6-C (A y B).
5. **Procedencia:** una referencia general nunca dice ser criterio de la empresa (el piso de PRI-04 sin declarar sigue «criterio general de ADI…»). Los textos firmados de PRI-04 conservan su voz actual («tu empresa»; la voz se revisa al activar la capa): solo cambia lo que este bloque agrega.
6. **Nada de esto cambia cifras ni mediciones.** No se tocan Core, Notario, `componer.js`, `encargo/*`, `medir.js`, `perfilCliente.js`, migraciones, `numberGuard.js`, `entityGuard.js`, `_guard_gate.mjs`.

7. **CAU-01 aplica SOLO a cuentas grandes / cadenas** (owner 2026-10-04, confirmado): `modeloComercial: ["cuentas_grandes"]` (antes `["cuentas_grandes", "comercios"]` por herencia del lote v0).
8. **Opción A para las dos frases de la ley vieja en `componer.js`, con FRONTERA ESTRICTA** (owner 2026-10-04): «no quiero reabrir la Entrega de Etapa 1 ni tocar su comportamiento cuando la capa está apagada; solo dejar coherente el texto cuando la capa de conocimiento esté activa.» Con la capa apagada `componer.js` produce exactamente lo mismo (byte-idéntico al HEAD c621516e). Con la capa activa, `_coherenciaConLaCapa`: (a) «Sin perfil completo del cliente todavía» deja de afirmar que ADI «no aplica conocimiento del oficio» y dice la regla nueva (`alcance.js:textoDePerfilIncompletoConCapa`); (b) «Sin conocimiento del sector cargado todavía» se retira cuando «Referencia del oficio» trae contenido (se conserva si la sección queda vacía: sigue siendo verdad). Los límites por campo de las referencias localizadas siguen saliendo de este bloque (`textoDeFaltaDeContexto`), sin duplicarlos.

**Cómo quedó implementado (donde difiere del §3/§7):**
- `alcance.js` (nuevo): `LLAVE_DE_ALCANCE`, `listaDeAlcance` (único lugar que lee `pieza.alcance[...]`), `descartaElCampo`, `camposDeLosQueDepende`, `esUniversal`, `aplicaAlPerfil`, `ENCABEZADOS`, `encabezadoDePieza`. El texto del límite (`textoDeFaltaDeContexto`) y las poblaciones (`empresasQue` por opción) viven en `perfilConversando.js`, junto a `ROTULOS_PERFIL` y `textoDeLimitacion`, para no crear un ciclo de imports.
- El límite se declara solo para piezas **firmadas, del tema de lo pedido** (la misma regla con la que `necesitaPerfil` decide qué pregunta el anfitrión: `esDelTemaDelEncargo`), una línea por campo faltante.
- `seleccionar.js`: se retira la puerta del perfil completo; el filtro por pieza vive en `_procesar` (`filtrarPorPerfil`; `_evaluarInfraestructura` no filtra y devuelve `noAplican`). `perfilAutorizaConocimiento` queda solo para el camino de la bandera apagada.
- `recuento.js`: no nombra un sector que ninguna pieza contada exige.
- `piezas.js`: único cambio, el `alcance` de PRI-04 y de CAU-01 (la firma, el contenido y los textos firmados no se tocan).
- Alcance de CAU-01: `modeloComercial: ["cuentas_grandes"]` (antes `["cuentas_grandes", "comercios"]` por herencia del lote v0): «cadenas» es `cuentas_grandes`.

---

## 1 · La propuesta, en tres líneas

1. Cada pieza ya declara, campo por campo, de qué contexto depende (`alcance`: una lista = depende; `"*"` = no depende). **Universal = ninguna lista.** No se cambia el esquema: se le da efecto al que ya existe.
2. La selección deja de exigir el perfil completo: exige **solo los campos de los que esa pieza depende**, y solo cuenta lo **declarado y confirmado**. Si falta un campo, esa pieza no se sirve, el límite se declara una vez por campo, y el anfitrión ya tiene la pregunta (`necesitaPerfil`). Si el campo declarado la descarta («servicios» para una pieza de distribución), no se sirve y no se dice nada.
3. En superficie, el encabezado dice **«Para toda empresa, …»** o **«En distribución, …»** con la procedencia del contexto tomada de la tabla única de origen. Ninguna cifra cambia; ninguna pieza existente se reclasifica hasta que el owner revise la tabla del §6.

---

## 2 · Qué hay hoy (archivo:línea)

**Cómo se declara el alcance.** `src/adi/conocimiento/piezas.js:44` define `_ALCANCE_BASE = { sector: ["distribucion"], tipoProducto: "*", modeloComercial: ["cuentas_grandes","comercios"], pais: "*", banda: "*" }`, y las cuatro piezas lo copian tal cual (`:63`, `:104`, `:128`, `:169`). Es el «alcance por defecto» del lote v0 (`_ADI_BUSINESS_KNOWLEDGE_V0_PROPUESTA.md:502`, el ejemplo del esquema §5), no una decisión pieza por pieza. El esquema ya es tipado por campo: lista = restringe, `"*"` = indiferente.

**Por qué hoy todo falla cerrado.** `src/adi/conocimiento/seleccionar.js:318` — puerta 2: `if (!perfilAutorizaConocimiento(perfil)) return { salida: [] }`. Esa función (`src/config/contract/perfilCliente.js:246-248`) devuelve `perfil.completo === true`, y `completo` (`perfilCliente.js:237-238`) exige los **seis** campos de `CAMPOS_DEL_PERFIL` (`:72`): sector, tipoProducto, tamaño, país, **moneda** y modelo comercial. Basta que falte uno —incluso la moneda o el país, de los que ninguna pieza depende— para que la capa entera devuelva vacío. Es la ley vieja del 2026-09-23 («sin perfil no se entrega nada»), que el owner cambió el 2026-09-25.

**El hueco que hoy nadie ve.** El `alcance` declarado **no se compara contra el perfil en el camino que sirve**: `src/adi/conocimiento/evaluarPertinencia.js:54` recibe `perfil` y nunca lo lee (solo evalúa predicados de señal); `seleccionar.js` tampoco lo mira. Consecuencia: con la bandera encendida y un perfil completo de sector «servicios», una pieza con `sector: ["distribucion"]` se serviría igual. El único lugar que hoy lee `alcance` contra la empresa es el que decide **qué preguntar**: `src/adi/capacidad/perfilConversando.js:188-194` (`necesitaPerfil`: `restringidos = campos cuyo alcance es lista`; si lo declarado no está en la lista, la pieza se descarta; si falta, se pregunta). La regla correcta ya está escrita — pero del lado de la pregunta, no del lado del servicio.

**Cómo se nombra el límite y el contexto hoy.** `src/adi/conocimiento/servir.js:54-59` (`_sectorDe`): el encabezado dice «En distribución, …» leyendo `alcance.sector`; con `"*"` cae a «En el sector, …» — una frase que para una pieza universal confunde (¿qué sector?). `servir.js:150-157` (`_headerDeBloque`) y `servir.js:72` (`servirPieza`) son los dos únicos sitios que redactan ese encabezado. El `alcance` viaja en cada ítem servido (`servir.js:121`, `seleccionar.js:227-229`) pero `componer.js:4849` imprime solo `r.texto` — nunca llega al usuario como dato. La procedencia del **piso** ya está resuelta y no se toca: `servir.js:225` / `:286` (`p.declaradoPorLaEmpresa` → «el piso declarado por tu empresa» / «el piso de ADI», decidido en `medir.js`).

**Lo confirmado vs lo pendiente.** `perfilConversando.js:211-223` (`conPerfilDeclarado`) solo mezcla en el dataset lo **vigente** (confirmado); lo pendiente cuenta para no volver a preguntar (`necesitaPerfil`, parámetro `conocidos`, `:170-171`) pero no para servir. `perfilCliente.js:110-113` solo acepta procedencia «declarado» (legado «medido») para los cuatro campos declarables; la banda, solo «derivado» (`:106`). Esta parte ya cumple la ley del owner y se reutiliza sin cambios.

**La función única de origen.** `src/config/businessPolicy.js:295-314` (`ETIQUETA_ORIGEN` / `ADJETIVO_DE_ORIGEN`, «declarado por la empresa» · «criterio general de ADI, ajustable por la empresa») y `:341` (`procedenciaDeLlave`). `_procedencia_gate.mjs` §5 pone en rojo cualquier frase de origen escrita a mano fuera de esa tabla.

---

## 3 · El mecanismo mínimo

### 3.1 · Cómo cada pieza declara de qué depende (sin cambiar el esquema)
`alcance` queda como está. Una función nueva y única, `camposDeLosQueDepende(pieza)` (nuevo `src/adi/conocimiento/alcance.js`), devuelve los campos cuyo valor en `alcance` es una **lista** (hoy la misma lógica vive inline en `perfilConversando.js:188`, con la tabla `_LLAVE_DE_ALCANCE` en `:160` — se mueve a `alcance.js` y `necesitaPerfil` la importa: una verdad, dos usos). `esUniversal(pieza)` = lista vacía. `banda` (tamaño) cuenta como dependencia posible pero **nunca se pregunta**: se calcula (`bandaTamano.js`), y si falta es porque falta venta o UF.

### 3.2 · La selección exige SOLO esos campos
`aplicaAlPerfil(pieza, perfil)` (mismo `alcance.js`) lee `perfil.campos[c].valor` (la forma de `construirPerfilCliente`, ya filtrada por procedencia válida) y devuelve uno de tres:
- `{ aplica: true }` — universal, o todos sus campos declarados y dentro de la lista;
- `{ aplica: false, motivo: "fuera_de_alcance", campo }` — un campo declarado la descarta → **no se sirve y no se declara nada** (la pieza no es de esta empresa; misma regla que `necesitaPerfil:190`);
- `{ aplica: false, motivo: "falta_contexto", campos: [...] }` — le falta al menos un campo del que depende → **no se sirve y se declara el límite**.

En `seleccionar.js:_referenciaDelOficioInterna`, la puerta 2 se reemplaza por este filtro **por pieza**, después del filtro de firma (`:320-322`): `aplicables = firmadas.filter(aplica)`. `perfilAutorizaConocimiento` no se borra (la usa `seleccionarConocimientoDelOficio`, el camino legado de la puerta 1 con la bandera apagada — byte-idéntico).

### 3.3 · Qué pasa si falta un campo
- **Una línea por campo faltante, no por pieza**, al final de `referenciaDelOficio` con `fuente: null` (el mismo patrón de la línea de recuento, `seleccionar.js:328`): «Sin el sector declarado, ADI no aplica las referencias del oficio que dependen de él. El resto de la consulta se responde igual, con los datos de la empresa.» Es hermana de `textoDeLimitacion` (`perfilConversando.js:227-231`), sin el «(se prefirió no decirlo)», con el rótulo del campo desde `ETIQUETA_DEL_CAMPO` (`perfilCliente.js:75`) para no crear ciclo de imports. Tercera persona: la Entrega no pregunta.
- **Ofrecer completar el perfil es trabajo ya hecho**: `necesitaPerfil(encargo)` devuelve `siguiente` (una pregunta) y `preguntasDelPerfil` la redacta con las opciones de la taxonomía; `armarPerfilConversando` la pone en el bloque `perfil` de `consultar`. Al compartir `camposDeLosQueDepende`, lo que la Entrega declara como límite y lo que el anfitrión pregunta son **el mismo conjunto de campos**, por construcción.
- Si una omisión ya fue registrada en la conversación, `necesitaPerfil` ya la trata como limitación y no vuelve a preguntar; la Entrega igual declara el límite (una señal nunca desaparece en silencio).

### 3.4 · Cómo se aprovecha lo confirmado sin que el usuario lo repita
Sin cambios de mecánica: ficha de la empresa (`tenants`, camino B) → `construirPerfilCliente`; memoria conversacional confirmada → `conPerfilDeclarado(dataset, vigentes)` antes de componer. Lo **pendiente** (dicho pero no confirmado) no entra al dataset, así que `aplicaAlPerfil` no lo ve: no cuenta. Sonnet debe **verificar** (no asumir) que el camino `consultar` pasa el dataset por `conPerfilDeclarado` antes de `construirPerfilCliente` (`acciones.js:78` lo importa; confirmar el orden).

### 3.5 · Cómo se dice en superficie
`_sectorDe` se reemplaza por `contextoDe(pieza)` → `{ universal, texto }`, usado en los dos sitios (`servirPieza`, `_headerDeBloque`):
- Universal: **«Para toda empresa, {enunciado}»** (redacción a decidir por el owner, §6-C).
- Localizada: **«En distribución, {enunciado}»** (como hoy) + una cláusula de cierre del bloque, una sola vez: «Aplica por el sector declarado por la empresa.» — la frase «declarado por la empresa» sale de `ETIQUETA_ORIGEN` (`businessPolicy.js:295`), nunca escrita a mano (así `_procedencia_gate` §5 la cubre).
- Menciones y ofertas (otro dominio): no llevan encabezado; no se les agrega nada (la mención es breve por ley).
- La procedencia del **piso** no se toca: ya la escribe `medir.js` y la imprime `servir.js:225/286`.

### 3.6 · Qué pasa el día 1
Con `_ALCANCE_BASE` intacto en las cuatro piezas, **sin perfil declarado no se sirve ninguna** (las cuatro dependen de sector y modelo comercial): el comportamiento visible es el de hoy, más la línea de límite. Lo universal empieza a servirse **solo** cuando el owner firme la tabla del §6-A. El mecanismo se certifica con piezas de prueba firmadas pasadas por `catalogo` (el mismo recurso que ya usa `_conocimiento_gate`, `seleccionar.js:296-298`).

---

## 4 · Qué NO se hace
- No se reclasifica PRI-04, CAU-01, CAU-06 ni CAU-03: `piezas.js` **no se toca** (ni `alcance`, ni enunciados, ni firmas). La tabla del §6-A es para que el owner revise el contenido; el cambio de `alcance` de cada pieza es un encargo posterior, con su palabra.
- No cambia ninguna cifra: `medir.js`, `hechos.js`, `specRetrieval.js`, `pisoFocosUSD`, `pisoMaterialidadCobranza` quedan intactos. Nada entra a Core ni a Notario.
- No se amplía el esquema de pieza (`validarPieza.js` no cambia). No se agrega ningún reconocedor de frases: el único texto nuevo son dos plantillas fijas (encabezado universal, línea de límite) y una cláusula desde la tabla de origen.
- No se toca `perfilCliente.js` (ni `completo`, ni `perfilAutorizaConocimiento`), ni `componer.js` (la sección ya imprime lo que la capa devuelve), ni la bandera.

---

## 5 · Certificación

Nuevo `_universal_localizado_gate.mjs` (offline, solo por `npm run gates:offline`; cero LLM, cero red), sobre `TENANT_DEMO` y las cuatro rutas de `componer.js`, con un catálogo de prueba firmado: `U-TEST` (alcance todo `"*"`), `L-TEST` (sector `["distribucion"]`), `LM-TEST` (sector + modelo comercial). Perfiles: vacío · sector declarado y confirmado «distribucion» · sector «servicios» · sector pendiente (no vigente) · sector omitido en la conversación.

Carnadas y verdes exigidos:
1. Localizada sin su contexto → **no se sirve** y aparece **una** línea de límite por campo (no una por pieza).
2. Universal sin ningún perfil → **se sirve** (y la vieja puerta 2 reinstalada a mano hace rojo este punto).
3. Contexto confirmado → se sirve **sin** que `necesitaPerfil` devuelva `siguiente` (no pregunta lo que ya sabe).
4. Contexto pendiente / no confirmado → **no cuenta**: no se sirve la localizada; `necesitaPerfil` tampoco la vuelve a preguntar.
5. Sector declarado que la descarta («servicios» para `L-TEST`) → no se sirve **y no hay línea de límite**.
6. Localizada presentada como universal = **rojo**: oráculo de texto — todo ítem de una pieza con dependencias lleva el nombre del contexto y la cláusula de origen; ningún ítem universal lleva «declarado por la empresa» ni nombra un sector.
7. Referencia general dicha como criterio propio = **rojo**: con la empresa que no declara nada (el mismo patrón de las tres empresas de `_procedencia_gate` §1, misma muestra `fixtures/procedencia/muestra-v13-v40.json`), cero «declarado por la empresa» en `referenciaDelOficio`; con la que declara, la frase aparece exactamente donde corresponde.
8. Cifras idénticas: la Entrega completa **menos** `referenciaDelOficio` es byte-idéntica con perfil vacío, parcial y completo (misma técnica que `_conocimiento_gate` §8).
9. Catálogos v13–v40 byte-idénticos con la capa apagada (puerta 1 intacta: ya lo cubre la certificación existente; este gate lo reafirma sobre la muestra).
10. `camposDeLosQueDepende` es la única fuente: barrido de código que pone rojo si `Array.isArray(pieza.alcance[` vuelve a aparecer fuera de `alcance.js`.

Ajustes a gates existentes: `_conocimiento_gate.mjs` candado 7 («perfil incompleto apaga la capa entera», cabecera `:16`) se reescribe a la ley nueva («perfil incompleto apaga solo lo localizado»); `_perfil_conversando_gate` debe seguir verde sin cambios (refactor byte-equivalente de `necesitaPerfil`). Encaje con `_procedencia_gate`: no se modifica; el gate nuevo reutiliza su fixture y su oráculo de atribuciones (lee el TEXTO, no el código).

---

## 6 · Decisiones para el owner (máx. 3)

### A · Clasificación de cada pieza existente — para TU revisión del contenido (no decido por ti)
| Pieza | De qué contexto depende su CRITERIO según su texto actual | Propuesta y por qué |
|---|---|---|
| **PRI-04** (firmada) | Compara participación en el vencido con participación en la venta a crédito; el piso es «criterio general de ADI, ajustable por la empresa». El texto **no nombra** sector, modelo comercial, país ni tamaño. | **Candidata a universal.** Solo exige venta a crédito y vencido por cuenta, que son del dato. Hoy declara distribución + cuentas grandes/comercios por herencia del lote v0, no por su criterio. Sigue localizada hasta tu palabra. |
| **CAU-01** (firmada) | «Cuando una **cuenta cadena** está bajo el benchmark…, mira si su carga comercial pesa más que la del resto». El criterio presupone **cadenas** (modelo comercial cuentas grandes); no presupone sector ni país. | **Localizada por modelo comercial**, no por sector: un fabricante que vende a cadenas enfrenta lo mismo. Dejar `sector` en `"*"` sería una AMPLIACIÓN — por eso te la traigo y no la hago. Alternativa: dejarla como está. |
| **CAU-06** (borrador) | «Las **cadenas** exigen ese nivel y multan la entrega incompleta»; habla de SKU inmovilizados (empresas con inventario de producto). | **Localizada**: modelo comercial cuentas grandes + sector con producto (distribución, fabricación, minorista; nunca servicios/obras). |
| **CAU-03** (borrador) | «Cuenta cadena… documento en trámite (rechazo, retención, nota de crédito pendiente)»: prácticas de cadenas y, en parte, del **país** (retenciones, rechazo de documento). Además, su medición no existe en el dato (`existe_en_motor: false`). | **Localizada** por modelo comercial y probablemente país. Baja prioridad: hoy siempre mide «no se puede saber». |

**Recomendación:** revisar PRI-04 primero (es la única candidata a universal y ya está firmada); el resto puede esperar a su firma.

### B · Qué se dice cuando falta el contexto de una pieza localizada
- (A) **Una línea de límite por campo faltante** en la sección de referencia del oficio, en tercera persona, y el anfitrión pregunta aparte (ya existe). — *Recomendada*: cumple «procedencia y límites claros» y «una señal nunca desaparece», sin repetir por pieza.
- (B) No decir nada: solo el anfitrión pregunta. — Más corto, pero el usuario no sabe que hay una referencia que le aplicaría si declarara el sector.

### C · Redacción del encabezado universal y de la cláusula de origen (decisión de superficie, tuya)
- (A) «**Para toda empresa**, {enunciado}» / cierre localizado: «Aplica por el sector declarado por la empresa.» — *Recomendada*: dice de frente a quién aplica.
- (B) «**En cualquier sector**, {enunciado}» / cierre: «Referencia del oficio para distribución (sector declarado por la empresa).»
Cualquiera de las dos toma «declarado por la empresa» de `ETIQUETA_ORIGEN`, nunca a mano.

---

## 7 · Encargo para Sonnet (después de las decisiones B y C; la A no bloquea)

Contexto obligatorio: rama `dev`, flag `ADI_CONOCIMIENTO` apagada; prod v2.31; **cero llamadas a LLM/gateway; gates solo por `npm run gates:offline`** (la prueba son las líneas «0 TOCARON LA RED · 0 CON CREDENCIAL VIVA»). Nunca `git add -A`. No commitear `numberGuard.js`, `entityGuard.js`, `_guard_gate.mjs`.

1. **Nuevo `src/adi/conocimiento/alcance.js`** (puro): `LLAVE_DE_ALCANCE` (movida desde `perfilConversando.js:160`), `camposDeLosQueDepende(pieza)`, `esUniversal(pieza)`, `aplicaAlPerfil(pieza, perfil)` → `{aplica, motivo, campo|campos}`, `textoDeFaltaDeContexto(campo)` con `ETIQUETA_DEL_CAMPO` de `perfilCliente.js`. `banda` lee `perfil.campos.tamano.valor`.
2. **`perfilConversando.js:188-194`**: `necesitaPerfil` usa `camposDeLosQueDepende` y `LLAVE_DE_ALCANCE` importadas. Comportamiento byte-idéntico; `_perfil_conversando_gate` verde.
3. **`seleccionar.js:318`**: quitar la puerta 2; tras `firmadas` (`:320-322`), filtrar con `aplicaAlPerfil`; juntar los campos `falta_contexto` en un Set; al final de `salida` agregar una línea por campo (`fuente: null`, igual que `:328`). La línea de recuento (`:325-329`) se arma sobre las **aplicables**. `_evaluarInfraestructura` registra en `detalle` las no aplicables con su motivo (no las filtra: es el informe del mecanismo). Actualizar la cabecera (`:9-18`: las tres puertas).
4. **`servir.js:54-59`**: `_sectorDe` → `contextoDe(pieza)`; aplicar en `servirPieza:72` y `_headerDeBloque:150-157` con la redacción que el owner elija en C; la cláusula de origen se compone con `ETIQUETA_ORIGEN[ORIGEN.EMPRESA]` importada de `config/businessPolicy.js`, una vez por bloque/ítem con encabezado. Menciones y ofertas sin cambios.
5. **Gate nuevo `_universal_localizado_gate.mjs`** con los 10 puntos del §5, registrado donde se registran los demás gates offline (ver cómo entra `_conocimiento_gate.mjs` a `gates:offline` y copiar el patrón). Reutiliza `fixtures/procedencia/muestra-v13-v40.json` y el oráculo de atribuciones de `_procedencia_gate.mjs` (copiar el patrón, no modificar ese gate).
6. **`_conocimiento_gate.mjs`** candado 7: reescribir a «perfil incompleto apaga solo lo localizado» (con `U-TEST`/`L-TEST` por `catalogo`).
7. Correr `npm run gates:offline` completo; verde total con las dos líneas de red en cero. Reportar al supervisor con archivo:línea y el texto exacto de las dos plantillas nuevas.

**No tocar:** `piezas.js` (ni `_ALCANCE_BASE` ni ninguna pieza), `medir.js`, `validarPieza.js`, `perfilCliente.js`, `componer.js`, `businessPolicy.js`, `_procedencia_gate.mjs`, nada de Core (`specRetrieval`, `diagnose`, `POLICY`) ni de Notario. Ningún número nuevo, ningún regex sobre texto del usuario.
