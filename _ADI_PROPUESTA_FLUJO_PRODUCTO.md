# Propuesta de producto · el flujo ADI para el Complemento (Fable, 2026-09-25)

> ⚠️ HISTORIA (2026-09-25): el plan vigente es `_ADI_PLAN_PRODUCTO_V2.md`, aprobado por el owner.

> Estado: PROPUESTA pendiente de evaluación del owner. Escrita por Fable (subagente), revisada por el supervisor
> (Opus) contra las leyes vigentes; las correcciones del supervisor van marcadas. Reemplazaría a
> `_ADI_PLAN_FLUJO_ENTREGA.md` si se aprueba. Sin commitear.

Base: brief del supervisor, memorias citadas, los dos planes vigentes y lectura del código en dev (HEAD f5fc501c). Sin ejecutar nada.

---

## PARTE A · Para el owner

### La conclusión

ADI ya tiene el cerebro: cálculo, verificación exacta, perfil, dos piezas de conocimiento firmadas. Le faltan dos cosas: **una forma de recibir lo que el LLM entendió** y **una forma de entregar una respuesta para cualquier pregunta**, no para cuatro fijas. Hoy, antes de responder, ADI vuelve a leer la frase del usuario con reglas de texto — justo lo que usted pidió dejar de construir. Propongo: una sola puerta que recibe un **encargo tipado**, un compositor que arma la Entrega para cualquier encargo válido, un **libro de sesión** para que la conversación no cuente una historia falsa, y una prueba en dos capas: gratis primero, con modelo al final.

### 1 · Qué falta hoy

Por peso, lo que rompería la experiencia premium:

1. **No existe la puerta.** Ningún ChatGPT ni Claude puede hablar con ADI. Sin puerta, nada se prueba en el canal real.
2. **ADI no recibe lo que el LLM entendió.** El anfitrión entiende «¿me conviene seguir vendiéndole a Jumbo?», pero ADI no tiene dónde recibir «comercial + cobranza · Jumbo · cierre: decisión». Volvería a leer la frase con reglas y a fallar como en la medición ciega: cifra ajena, tema perdido.
3. **La Entrega responde cuatro preguntas.** Un gerente hace cuarenta clases. Lo que ya está bien se conserva: libro de hechos, procedencia, ausencias declaradas, perfil, verificador.
4. **Sin memoria de sesión en el Complemento.** Nueve de once conversaciones armadas engañaban sin una frase falsa; en ese canal hoy nada lo impide.
5. **El conocimiento del oficio está vacío para todos.** Sin perfil de empresa la capa falla cerrado y la «Referencia del oficio» sale vacía: **el anfitrión la llena con su conocimiento genérico, con la autoridad de ADI**. Es el hueco que más se parece a inventar.
6. **El usuario no puede declararle datos a ADI** («mi benchmark real es 25 %», un PDF con condiciones): la categoría «supuesto del usuario» existe en el diseño y nadie la produce.

### 2 · ¿Solicitud, Entrega, Uso e Ingesta son los conceptos correctos?

Tres sí con ajuste, uno no, y faltan dos.

- **Solicitud → «Catálogo + Encargo».** El anfitrión necesita saber **qué puede pedir** (temas, conceptos, cuentas y ejes de esta empresa, lo que no existe) y un encargo tipado: temas · conceptos · entidades · período · cierre (cifra, lectura, decisión, comparación, simulación) · criterio. Decisión clave: **una sola puerta a nivel de negocio**, no las 23 herramientas internas; con 23, el anfitrión heredaría treinta páginas de doctrina que no va a leer. ADI decide por dentro qué lecturas corren, **sin leer la frase**, que viaja solo para auditoría.
- **Entrega → correcta, y crece.** Se agregan identidad (cada Entrega, universo y hecho con su número), un modo breve para cifras puntuales, y una regla: ADI **precalcula las tentaciones** (totales, participaciones, diferencias) para que el anfitrión no las calcule.
- **Uso → no es un contrato.** Es una cabecera de instrucciones dentro de la Entrega más **una medición**. ADI no puede obligar al anfitrión; puede hacer fácil copiar bien y medir cuánto sobrevive.
- **Ingesta → «Registro de lo que ADI sabe».** Cuatro entradas: plantilla (existe), **perfil de empresa** (espera su decisión), **hechos declarados por el usuario** (nuevo, barato, alto valor) y archivo fuera de plantilla (mapeo propuesto por un modelo, confirmado por una persona, como ya aprobó). Los PDF y Word **no necesitan lector propio**: el anfitrión ya los lee, y lo extraído entra como hecho declarado, nunca como medido.
- *(Agregado del supervisor)* **Un dato declarado o leído de un documento se devuelve para confirmar.** Si el anfitrión extrae cifras de un PDF, puede extraer mal; ADI valida concepto, unidad, período y entidad, y devuelve «entendí esto, ¿lo confirma?» antes de usarlo. Es la misma regla ya aprobada para los archivos: proponer es del modelo, confirmar es de la persona.
- *(Agregado del supervisor)* **Sin perfil, la Referencia del oficio no sale vacía: sale declarada** («no hay referencia del sector porque falta el perfil de la empresa»), como una parte de «Lo que no se puede concluir». Así el anfitrión recibe un hallazgo, no un hueco que llenar.
- **Falta 1: la Puerta** (identidad, sesión, el esquema que ve el anfitrión).
- **Falta 2: el libro de sesión.** Todo hecho servido queda con su número; la siguiente Entrega reusa los mismos números y abre con «lo ya entregado»; si los datos cambiaron, lo dice. La coherencia se garantiza sobre **lo que ADI sirvió**; lo que el anfitrión recuerde se mide.

### 3 · Qué va primero y por qué

1. **El encargo tipado y su validador** (gratis). Es la bisagra: sin él no hay compositor general ni puerta, y el mismo encargo lo emitirá el planificador de ADI directo (un cerebro, dos canales). Lo que no resuelve **se devuelve declarado**, cada tema independiente, nunca sustituido por un vecino.
2. **El compositor general + el libro de sesión** (gratis). Reusa los procedimientos que ya certifican en vivo. Primera prueba creíble: cuarenta Entregas de preguntas de un controller, verificadas, sin gastar.
3. **La Puerta** y **la primera medición con modelo** (gasto nombrado): anfitrión real, frases naturales, Entregas reales.
4. **En paralelo, con sus horas:** perfil de empresa y piezas de conocimiento 3 en adelante.
5. **Después:** ADI directo se apoya en la misma Entrega y se aligera, como ya aprobó.

### 4 · Qué sobra o interfiere

En el Complemento **ADI no lee la frase del usuario**. Se apaga en ese canal todo lo que hoy la lee antes del cerebro: detectores de intención, temas por palabras, cobertura corta, ensamblador de encargos, «de esos…», disparadores léxicos de cada procedimiento. Sus **procedimientos** se conservan y pasan a activarse por el encargo. No se borran: ADI directo los usa hasta que migre.

También se apaga lo que juzga **prosa de un modelo** (64 códigos del muro, vetos de registro, 55 chequeos de anclas, cirugía de voz): no hay prosa ajena que juzgar. Las leyes de la casa se cumplen por construcción y las revisa el verificador de la Entrega. En ADI directo se reducen después a tres búsquedas (cifra con dueño, orden, conclusión presente).

Se **conserva tal cual**: motor de cálculo, libro de hechos y verificador, procedencia, ausencias, perfil, conocimiento, prioridad integrada, identidad por empresa. El piso sin modelo queda congelado y **fuera** del Complemento.

### 5 · Cómo se demuestra el estándar

**Offline y gratis (lo que ADI garantiza sola):**
- Catálogo de encargos tipados, no frases: ~60 válidos y ~20 defectuosos (entidad inexistente, período no disponible, tesorería). Umbrales: 0 adivinanzas, 0 cifras de otro concepto u otra entidad, 100 % de temas cubiertos, cada hueco declarado, verificador en verde.
- Encargos generados automáticamente desde los registros: ninguna cifra sin dueño, ningún dígito fuera del libro, tentaciones precalculadas presentes.
- Sesión: dos encargos seguidos dan los mismos números con los mismos identificadores; datos cambiados se declaran.
- *(Agregado del supervisor)* El catálogo de encargos lo escribe quien no implementa, y queda sellado antes de construir, para que ADI no se corrija a sí misma.
- No medible offline: si el anfitrión entiende la frase y si respeta la Entrega.

**Con modelo (gasto nombrado, autorizado por usted):**
- A · Comprensión: un set NUEVO y sellado de ~70 frases naturales con sus conceptos y entidades esperados (el v3 ya se leyó el 2026-09-25 y quedó como regresión: no sirve de prueba ciega), escrito por quien no implementa → el anfitrión emite encargos → ≥ 90 % con temas y entidades correctos, 0 cifra ajena. ~70 llamadas. *(Corrección del supervisor.)*
- B · Paráfrasis: 60 Entregas × 1 modelo × 3 formas = 180 narraciones + 180 juicios de un árbitro de otra familia. Umbrales del plan: valor + dueño ≥ 90 %, período ≥ 80 %, negativas ≥ 80 %, cifras inventadas 0 en ≥ 95 %, aritmética del anfitrión ≤ 5 %, referencia convertida en meta ≤ 5 %.
- C · Conversaciones: 12 hilos × 6 turnos; 0 hilos con historia falsa (cada número del turno existe en el libro de sesión).
- Orden de magnitud: ~700 llamadas y ~3 millones de tokens; **decenas de dólares, no cientos** (cotizar al momento). Antes de gastar, **agregar el contador de llamadas y tokens que el repo no tiene**, o el costo real no será verificable.

### Decisiones que necesito de usted

1. **Puerta única a nivel de negocio** (recomendada) en vez de exponer las 23 herramientas al anfitrión.
2. **Aplicar las migraciones del perfil** y aprobar la lista de sectores; sin eso la Referencia del oficio queda vacía y el anfitrión la inventa.
3. **Aprobar el canal de hechos declarados** como vía de entrada de contexto y documentos (procedencia «declarado por el usuario», nunca «medido»).
4. **Aceptar el residuo de la conversación:** ADI garantiza coherencia sobre lo que sirvió; la memoria del anfitrión se mide, no se controla.
5. **Autorizar, cuando llegue, el gasto de la medición A–C** con su cifra.

---

## PARTE B · Anexo técnico para el supervisor

### 1 · El contrato de intención (Encargo)

```
Encargo v1 {
  sesion_id, turno_id, pregunta_original (auditoría; NUNCA se parsea),
  partes: [ { tema: id de DOMINIOS_REGISTRO,
              conceptos: [claves de `metricas` del dominio],
              entidades: [{ nombre, eje? }],          // eje opcional: lo resuelve el índice, no la frase
              periodo?: { tipo: "cerrado"|"mes"|"rango"|"foto", valor? },
              cierre: "cifra"|"lectura"|"decision"|"comparacion"|"simulacion"|"definicion" } ],
  criterio?: { lente: clave de CRITERIOS } | { texto_del_usuario },
  supuestos?: [{ concepto, valor, unidad, cita }],   // producen procedencia supuesto_usuario
  contexto?: { entrega_ref?, universo_ref?, hechos_ref?: [ids] },
  profundidad?: "breve"|"completa"
}
```

**Validación sin prosa:** `tema` contra el registro (activo | ausente → hecho de ausencia + alternativa, ya existe); `conceptos` contra `metricas`/`metricRegistry`; `entidades` con `resolveCanonical` por eje (sin eje: `guessDimension` sobre el índice — un hecho del dato); `periodo` contra `serieRealDe`; `cierre` y `lente` por enumeración; `contexto` contra el libro de sesión. Salida: `{ resuelto, no_resuelto: [{campo, valor, motivo, alternativas}] }`. Cada parte se resuelve independiente; una inválida no anula las demás; nada se sustituye por vecino. `decision` sin `criterio` → `prioridadIntegrada` con criterio declarado y la lente alternativa (ya lo hace). Continuidad: el anfitrión resuelve la deixis (tiene la conversación); ADI recibe nombres o referencias por id.

### 2 · Del encargo a las lecturas (planificador determinístico)

`lecturasDe(encargo)` = tabla (tema × cierre) → pasos. Reusa `contratoComercial` (5 lecturas), `pasosDeDominios`, los `pasos` de los playbooks (`margenEnRiesgo`, `cobranza`, `inventarioInmovilizado`, `crucePorSku`, `prioridadPorLente`) y las heurísticas de Knowledge que planifican cálculo. `cuandoAplica` (30 detectores léxicos) sale del camino del Complemento; `pasosDe(playbook, pregunta)` pasa a recibir el encargo. Ejecuta con `runPlan` sin cambios. Cero texto.

### 3 · Generalizar el compositor

Las cuatro funciones de `componer.js` ya comparten `_correrPlaybook`, `_indiceDelTenant`, el libro (`libroDeHechos`/`asignarIds`), universos, perfil, `referenciaDelOficioConOfertas`, ausencias, `_textoDeLaEntrega` y `verificarEntrega`. Difieren en qué figs seleccionan y qué oraciones escriben. Generalización en dos ejes:
- **Lectura por tema**: comercial (`lecturaDeMargen`/`prioridadDe`), cobranza (`mesaFlujo` + piso PRI-04), inventario (`mesaCapital`); `entityRecord`/`gridTable` para `cifra`.
- **Forma por cierre**: `cifra` (Marco + 1–2 oraciones + filas + límites) · `lectura` (siete partes) · `decision` (+ `prioridadIntegrada` y lente alternativa) · `comparacion` (`compareEntities`) · `simulacion` (`simulate*` con `supuestos`).
- Multi-tema: partes independientes + cierre integrado (lo hace `componerEntregaMultidominio`).
- `_entidadesDeLaPregunta` (texto) → `encargo.partes[].entidades`; sujeto = usuario + procedimiento (pertinencia sin cambios).
- Nuevo: hechos `derivada` de tentaciones (total, participación, diferencia, múltiplo) para toda cifra servida.
- Candado de equivalencia: las cuatro preguntas fijas, como encargo, producen **el mismo texto byte a byte** que hoy.

### 4 · El libro de sesión (Complemento)

`libroDeSesion[tenant][sesion_id] = { entregas: [{ id, encargo, hechosIds, universos }], criterioVigente, supuestos, premisasConVeredicto, ofertasEnPie, cargaId }`. Persistencia por empresa (tabla nueva bajo RLS o KV con TTL). Cada Entrega reusa ids, abre con «Lo ya entregado» (una línea por Entrega previa) y declara «los datos cambiaron desde la Entrega N» si `cargaId` difiere. `conversationScope` (deixis, ordinales) queda solo en ADI directo.

### 5 · La Puerta

Servidor MCP (HTTP) + OpenAPI equivalente para Actions de ChatGPT, con **tres herramientas**: `adi_catalogo()` → lo que esta empresa tiene (dominios activos/ausentes, conceptos por dominio, ejes con nombres, períodos, ausencias, cierres y lentes; sin cifras); `adi_consultar(encargo)` → `{ entrega: {markdown, json}, no_resuelto, uso }`; `adi_declarar(hecho)` → hecho declarado con cita. Identidad: bearer con el pase HMAC/JWT existente, tenant desde el token, RLS; nunca viaja el archivo. `sesion_id` obligatorio (MCP tiene sesión; en Actions, por cabecera — a confirmar). `adi-spec.js` y `adi-narrate*` no se tocan.

### 6 · Ingesta ampliada

(a) Perfil: migraciones 012–014 + captura camino B (decisión del owner). (b) Hechos declarados: primer productor real de `supuesto_usuario`; valida concepto/unidad/período/entidad contra `metricRegistry`, guarda la cita, entra al libro con procedencia; jamás se consolida. (c) Archivo fuera de plantilla: `leerLibro` (código) → `mapeoDeterministico` → `sin resolver` → propuesta por modelo con encabezados + muestra (gasto nombrado, ~500 tokens) → confirmación humana → tercer universo con `compatibilidad` declarada. (d) Documentos: sin parser propio; entran por (b) vía el anfitrión.

### 7 · Riesgos

Anfitrión que llena mal el encargo (medir con el set v3; el catálogo reduce el error) · anfitrión que ignora «uso» (medir, mitigar por forma) · nombres ambiguos (el índice devuelve opciones) · tamaño de la Entrega (tope + detalle por referencia) · sin contador de consumo (agregarlo antes de medir) · `raw` faltante en figs nuevas (vigilar en lecturas nuevas) · la generalización toca ~1.000 líneas de rutas específicas: el candado de equivalencia es obligatorio · la tentación de «ayudar» al anfitrión con reglas de texto: prohibida por ley del owner.

### 8 · Primer corte (Sonnet)

1. `src/adi/encargo/esquema.js` + `validar.js` + `lecturasDe.js` (puros, sin texto). Gate `_encargo_gate`: ~60 encargos JSON válidos y ~20 defectuosos → 0 adivinanza, `no_resuelto` declarado, plan determinístico. Sin red.
2. `componerEntrega(encargo)` en `entrega/componer.js`; las cuatro funciones actuales pasan a fixtures de equivalencia byte a byte. Gate `_entrega_general_gate`: ~40 encargos CFO → `verificarEntrega` ok, 0 dígito fuera del libro, cobertura de temas, tentaciones presentes.
3. `libroDeSesion` en memoria (persistencia detrás de interfaz) + gate de coherencia.
4. Después: la Puerta sobre el pase existente, con gate de seguridad offline (tenant ajeno rechazado).
Todo detrás de `ADI_ENTREGA`; solo `npm run gates:offline`; cero llamadas.

### Dudas honestas

No leí las ~800 líneas restantes de las cuatro rutas: la equivalencia byte a byte puede costar más de lo estimado. No verifiqué qué identificador de sesión exponen hoy ChatGPT Actions y los conectores de Claude. El costo de la medición es orden de magnitud, no cotización. La puerta única pierde finura frente a las 23 herramientas (ej. `calcular` con umbral numérico): propongo cubrirlo con `cierre: "cifra"` + `supuestos`, a probar con el set v3 antes de cerrarlo.

---

## REVISIÓN 2 · precisiones del owner (2026-09-25) y lo que cambian

Dirección aprobada por el owner con precisiones. Lo que cambia (supervisor, verificado en código):

1. **Capacidad coherente.** ADI se presenta al LLM como UN asesor con cuatro acciones de negocio: conocer la empresa ·
   consultar · aportar contexto · retomar la conversación. Nunca herramientas internas. El catálogo se GENERA desde lo
   que el Core calcula de verdad (contratos de herramientas, registro de métricas, cálculos y bloqueados, ausencias);
   «cualquier solicitud» = cualquiera soportada; lo demás vuelve declarado.
2. **Perfil.** Se incorpora lo aprobado sin reabrir (taxonomía de la migración 013). Nuevo: en el Complemento no hay
   pantalla de Sentrix → las preguntas del perfil las hace el LLM y ADI las guarda en la EMPRESA (camino B). Aplicar
   migraciones: con la palabra del owner, cuando la puerta vaya a probarse.
3. **Procedencias que no se mezclan — CAMBIA EL DISEÑO.** Cuatro orígenes: medido · extraído de documento (documento +
   parte citada) · declarado por el usuario · supuesto («¿y si…?»). La confirmación es un sello aparte (quién, cuándo)
   que NO cambia el origen. Una derivada conserva la LISTA de orígenes de sus insumos (hoy `hechos.js` los resume en
   una escala lineal con `_peorProcedencia`; se amplía, la «peor» queda como titular). Un declarado nunca pisa un
   medido: si difieren, van los dos con su dueño.
4. **Continuidad sin depender de la memoria del LLM — SE REFUERZA.** Tres capas: (a) mismos datos, mismas cifras
   (determinismo por empresa + versión de carga); (b) memoria de la EMPRESA en ADI (perfil, declarados, documentos
   confirmados); (c) libro de la conversación en ADI con id emitido por ADI (criterio vigente, supuestos, lo entregado,
   premisas con veredicto). Cada Entrega abre con un «estado vigente» compacto; acción «retomar» devuelve la realidad
   canónica. El encargo trae las PREMISAS del usuario tipadas para que ADI las verifique. Residuo: si el anfitrión no
   devuelve el id de conversación, se pierde (c), no (a) ni (b); se mide.
5. **Knowledge universal sin perfil — cambia la ley del 2026-09-23 («sin perfil no se entrega nada»).** Cada pieza
   declara si es universal (datos + criterio con dueño) o localizada (sector, tamaño, país). Sin perfil: universales sí,
   localizadas no, y se declara la falta. Hallazgo: `piezas.js` marca las cuatro piezas con alcance distribución +
   cuentas grandes/comercios (`_ALCANCE_BASE`), aunque PRI-04 y CAU-01 miden algo universal → reclasificar exige la
   confirmación del owner (son su firma). Puerta a cambiar: `seleccionar.js:316` y `perfilCliente.js:202`.

El ORDEN no cambia. Antes de construir, Fable diseña en detalle: modelo de orígenes · libro de la conversación y
estado vigente · separación universal/localizado; el esquema del encargo los incluye desde el día uno.
