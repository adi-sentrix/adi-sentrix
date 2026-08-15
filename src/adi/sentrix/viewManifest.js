/* === src/adi/sentrix/viewManifest.js · CONTRATO DE CONCORDANCIA ADI ↔ SENTRIX · EL INVENTARIO COMO DATO ========
 * (owner 2026-08-09 · frente NÚCLEO del Contrato de Concordancia)
 *
 * QUÉ ES. La traducción componente-de-pantalla → {métrica, eje, universo, período, comparación, sello, evidencia}
 * declarada como DATO PURO. Hasta hoy esa traducción no existía en ningún lado: vivía en la cabeza de quien
 * escribía el `onAsk("¿Qué clientes están por debajo de su presupuesto?")` a mano. Sin ella, "explicame este
 * gráfico" no tiene contra qué resolverse, y "Ver evidencia en Sentrix" no sabe qué abrir.
 *
 * TRES CAMPOS HACEN EL TRABAJO PESADO:
 *   · `campo`       ata el componentId a la SALIDA REAL del builder (`kpis[0]`, `sostiene.vistas[key='cliente']`).
 *                   No es documentación: `deriveViewContext` lo resuelve contra el objeto vivo, y si no resuelve,
 *                   NO se emite contexto (nunca uno inventado). El gate lo verifica corriendo el builder de verdad.
 *   · `evidencia`   la traducción componente → tools del oráculo. Es lo que permite que PLAN pida la evidencia de
 *                   ESE componente en vez de adivinar. Si un componente NO tiene equivalente en el oráculo se
 *                   declara `sinTool` con el motivo — el silencio está prohibido (el gate exige uno de los dos).
 *   · `concordancia` el ESTADO EXPLÍCITO de la relación entre lo que muestra Sentrix y lo que devuelve la tool.
 *                   El gate de concordancia no exige que la cifra coincida: exige que COINCIDA O ESTÉ DECLARADA.
 *                   Un desacuerdo declarado es honesto; uno silencioso es ADI contestando la cifra equivocada
 *                   creyendo que es la misma. Ver el bloque de abajo: NUNCA es `null`.
 *
 * REGLAS DURAS DE ESTE ARCHIVO:
 *   · DATO PURO · cero imports, cero cálculo, cero I/O, cero React.
 *   · CERO nombres de tenant. Ni un cliente, ni un SKU, ni una cifra del set demo. Vale para cualquier empresa.
 *   · CERO cifras. Un manifiesto que declara valores sería una segunda verdad; acá solo se declara ESTRUCTURA.
 *
 * `_provisional: true` marca las entradas cuyo inventario de componentes NO fue entregado a este frente y que se
 * derivaron leyendo el builder y su render. Están verificadas contra la salida real del builder (el `campo`
 * resuelve), pero su NOMBRE puede tener que alinearse cuando llegue el inventario de esa cara. Es una señal de
 * alcance honesta, no un placeholder: la entrada funciona.
 */

// ── VOCABULARIO CERRADO (lo consume la validación del ViewContext y la gramática de la dirección) ──────────────
export const VISTAS = ["comercial", "capital", "resultado", "ficha"];
export const SECCIONES = ["01", "02", "03", "otro"];
export const TIPOS = ["vista", "veredicto", "kpi", "tabla", "serie", "barra", "lista", "tira"];
export const COMPARACIONES = ["anterior", "presupuesto", "benchmark", "meta", "promedio_cartera", "vara_usuario", "estado"];
export const UNIVERSO_KINDS = ["negocio", "grupo80", "cola", "estado", "eje", "seleccion"];
// LA UNIDAD. Las cuatro primeras son EXACTAMENTE las de `metricRegistry` (money · pct · ratio · days): la unidad de
// un componente con métrica NO se vuelve a declarar acá, se LEE de ahí — declararla dos veces es la receta del
// desalineamiento que rompió Capital (`money(raw)` en un lado, `scale:"K"` en el otro). `conteo` y `texto` son las
// dos formas que el registro de métricas no puede responder: una pieza que cuenta cuentas y una que no autoriza
// ninguna cifra. `unidad` se declara SÓLO cuando el registro no alcanza (eje no-entidad, métrica nula) o cuando la
// pieza muestra otra unidad que su métrica — y en ese caso `unidadMotivo` dice por qué.
export const UNIDADES = ["money", "pct", "ratio", "days", "conteo", "texto"];

/* ── EL ESTADO DE CONCORDANCIA (owner 2026-08-09, decisión 11) ─────────────────────────────────────────────────
 * "Ningún componente puede declarar `null` si existe una divergencia conocida. Estado explícito
 *  `reconciled | divergent | unsupported`, con razón verificable."
 *
 * POR QUÉ UN NULL ES PEOR QUE UN HUECO. `null` no significaba "no sé": el motor lo leía como "no hay nada que
 * declarar", es decir «la cifra de la tool ES la de la pantalla». Media cara Capital y la Ficha entera decían eso
 * sin que nadie lo hubiera comprobado — y `progressiveDisclosure` inyecta justamente este campo en el prompt como
 * «LÍMITE DECLARADO de este componente», así que un null falso no era silencio: era una afirmación.
 *
 * LOS TRES ESTADOS, y qué significa cada uno EXACTAMENTE:
 *   · `reconciled`   la evidencia declarada devuelve LA MISMA cifra que la pantalla. No es una promesa: es lo que
 *                    `_concordancia_numerica_gate` cruza builder↔ledger en los tres escenarios. Si un componente
 *                    dice `reconciled` y el gate encuentra un solo desacuerdo, el gate FALLA.
 *   · `divergent`    las dos puntas producen una cifra del mismo concepto y NO coinciden (o coincidirían pero se
 *                    calculan con reglas distintas: otro ancla, otro piso de materialidad, otra escala). Es un
 *                    desacuerdo real, medido, que ADI tiene que nombrar en vez de tapar.
 *   · `unsupported`  no hay nada que reconciliar porque la evidencia declarada NO PRODUCE esa cifra: la pieza
 *                    pinta texto, o el concepto (una partición, una brecha en pp, un corte por un eje que la
 *                    métrica no declara) no existe en ninguna tool del oráculo.
 *
 * PRECEDENCIA. Una pieza puede ser las tres cosas a la vez (su tabla concuerda, su pie no existe). El estado nombra
 * LO PEOR que se sabe —divergent > unsupported > reconciled— y `campos` dice dónde; la `razon` cuenta las dos mitades.
 *
 * LA RAZÓN TIENE QUE SER VERIFICABLE. No "puede haber diferencias": qué cifra, contra qué tool, cuánto y dónde se
 * comprueba. Es el texto que ADI le va a decir al usuario cuando esa cifra no cierre. */
export const CONCORDANCIA_ESTADOS = ["reconciled", "divergent", "unsupported"];

export const VISTA_LABEL = { comercial: "Comercial", capital: "Capital", resultado: "Resultado", ficha: "Ficha" };
export const SECCION_LABEL = {
  "comercial/01": "Qué está pasando",
  "comercial/02": "Dónde se deteriora el margen",
  "comercial/03": "Qué hacer primero",
  "capital/01": "El capital, de una mirada",
  "resultado/01": "El resultado del negocio",
  "ficha/otro": "Ficha ejecutiva",
  // NIVEL 2 · lo que ADI abre cuando responde. Comparten sección "otro" con el contexto ambiente de su cara porque
  // no pertenecen a ningún movimiento numerado: no son un paso del razonamiento de la cara, son la superficie que
  // demuestra una respuesta.
  "comercial/otro": "Lo que ADI abre sobre la cara Comercial",
  "capital/otro": "Lo que ADI abre sobre la cara Capital",
};

// ── LOS BUILDERS · una entrada por cara. `fn` se importa PEREZOSAMENTE (el gate y quien derive ya tienen el
//    builder en la mano; este mapa existe para que el gate sepa QUÉ correr para verificar cada `campo`). ────────
export const VIEW_BUILDERS = {
  comercial: { modulo: "src/adi/sentrix/resumenComercial.js", fn: "buildResumenComercial", scenarioAware: true, args: "(scenario, {maxEntidades})" },
  capital:   { modulo: "src/adi/sentrix/mesaCapital.js",      fn: "buildMesaCapital",      scenarioAware: true, args: "(scenario)" },
  resultado: { modulo: "src/adi/sentrix/mesaResultado.js",    fn: "buildMesaResultado",    scenarioAware: true, args: "(scenario, cuadroEje, cascadaFoco)" },
  ficha:     { modulo: "src/adi/sentrix/reading.js",          fn: "buildReadingFromSignals", scenarioAware: true, args: "(signals)" },
};

/* ── LOS BUILDERS DE NIVEL 2 (owner 2026-08-09, decisión 12) ───────────────────────────────────────────────────
 * Las cinco superficies que ADI ABRE cuando responde no salen del builder de una cara: cada una tiene el suyo, y
 * dos de ellas ni siquiera son de Sentrix — son la evidencia del propio turno de ADI. Por eso `VIEW_BUILDERS` (una
 * entrada por cara) no alcanzaba y esta tabla existe: un componente de nivel 2 declara `builder: "<clave>"` y esa
 * clave dice EXACTAMENTE qué correr para obtener la salida contra la cual se deriva su contexto. Sigue siendo dato
 * puro: quien lo ejecuta es `viewBuilderRun.js` (un solo lugar), y los gates lo consumen de ahí — nunca cada uno
 * con su propia lista, que es como se desincronizan las dos puntas.
 *
 * `entidadArg` marca los builders que necesitan UNA entidad (el ring y el recibo son de un foco puntual): el
 * runner la resuelve del propio dato (la primera fila del eje), jamás de un nombre escrito a mano — el manifiesto
 * no puede nombrar una entidad del tenant.
 * `scenarioAware:false` NO es una omisión: es el LÍMITE MEDIDO de esa superficie, y su componente lo declara en
 * `concordancia` con la diferencia contra la pantalla en los tres escenarios. */
export const SUPERFICIE_BUILDERS = {
  "cuadro:cliente": { modulo: "src/adi/sentrix/cuadro.js",  fn: "buildCuadroMando", scenarioAware: true,  args: '("cliente", scenario)' },
  "cuadro:sku":     { modulo: "src/adi/sentrix/cuadro.js",  fn: "buildCuadroMando", scenarioAware: true,  args: '("sku", scenario)' },
  "cuadro:marca":   { modulo: "src/adi/sentrix/cuadro.js",  fn: "buildCuadroMando", scenarioAware: true,  args: '("marca", scenario)' },
  "cuadro:bodega":  { modulo: "src/adi/sentrix/cuadro.js",  fn: "buildCuadroMando", scenarioAware: true,  args: '("bodega", scenario)' },
  "ring:cliente":   { modulo: "src/adi/sentrix/control.js", fn: "buildControlRing", scenarioAware: true,  args: '("client", entidad, scenario)', entidadArg: "cliente" },
  "ring:sku":       { modulo: "src/adi/sentrix/control.js", fn: "buildControlRing", scenarioAware: false, args: '("sku", entidad)',   entidadArg: "sku" },
  "ring:marca":     { modulo: "src/adi/sentrix/control.js", fn: "buildControlRing", scenarioAware: false, args: '("marca", entidad)', entidadArg: "marca" },
  "ring:bodega":    { modulo: "src/adi/sentrix/control.js", fn: "buildControlRing", scenarioAware: true,  args: '("bodega", entidad, scenario)', entidadArg: "bodega" },
  "recibo:cliente": { modulo: "src/adi/sentrix/kpis.js",    fn: "buildMarginReceipt",  scenarioAware: true, args: "(entidad, scenario)", entidadArg: "cliente" },
  "recibo:bodega":  { modulo: "src/adi/sentrix/kpis.js",    fn: "buildCapitalReceipt", scenarioAware: true, args: "(entidad, scenario)", entidadArg: "bodega" },
  // LOS DOS QUE NO SON DE SENTRIX: su salida es la evidencia que ADI acaba de producir. Declararlos con el builder
  // de una cara sería describir OTRA cosa que la que el usuario tiene delante (es el defecto de integridad #1-bis
  // que ya se cazó en `_actionFrom`: la acción del portafolio bajo el turno de una entidad puntual).
  "decision":       { modulo: "src/adi/oracle/sentrixEvidence.js", fn: "buildOracleEvidence().evidenceSpec", scenarioAware: true, args: "({plan, results, figs, scenario})" },
  "simulacion:comercial": { modulo: "src/adi/specRetrieval.js", fn: "composeSpecSimulate().evidence", scenarioAware: false, args: '({metric:"ventas", dimension:"cliente", transform})' },
  "simulacion:capital":   { modulo: "src/adi/specRetrieval.js", fn: "composeSpecSimulate().evidence", scenarioAware: false, args: '({metric:"capital", dimension:"sku", transform})' },
};

// atajos de universo, para no repetir la misma declaración 15 veces (siguen siendo dato, no lógica)
const U_NEGOCIO = { kind: "negocio", label: "el negocio completo, cliente por cliente", cierraCon: "clientesVentas.actual con el escenario aplicado (venta oficial)" };
const U_GRUPO80 = { kind: "grupo80", label: "el grupo que explica el 80% de la venta del eje", cierraCon: "concentracion() sobre la venta del propio eje" };
const U_EJE = (eje) => ({ kind: "eje", label: `todas las filas del eje ${eje}`, cierraCon: null });

/* ══════════════════════════════════════════════════════════════════════════════════════════════════════════════
 * EL MANIFIESTO
 * ════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
export const VIEW_MANIFEST = {
  // ══ COMERCIAL · 01 · QUÉ ESTÁ PASANDO ════════════════════════════════════════════════════════════════════
  "comercial/otro/vista": {
    vista: "comercial", seccion: "otro", tipo: "vista", label: "La vista Comercial completa",
    campo: "veredicto", metrica: null, eje: "cliente",
    unidad: "texto",   // el contexto AMBIENTE de la pantalla no autoriza ninguna cifra: identifica, no afirma
    periodo: "año cerrado", universo: U_NEGOCIO, comparacion: null,
    estatusDefault: "indicado", estatusCampo: null, controles: [],
    evidencia: [{ tool: "executiveSummary", args: {} }],
    sinTool: null,
    concordancia: { estado: "unsupported", campos: ["veredicto"],
      razon: "el contexto ambiente de la vista no autoriza ninguna cifra (`unidad: texto`): el cruce builder↔ledger no produce un solo par comparable en los tres escenarios, así que no hay nada que reconciliar. Identifica la pantalla; las cifras las demuestran sus piezas" },
  },
  "comercial/01/veredicto": {
    vista: "comercial", seccion: "01", tipo: "veredicto", label: "El veredicto del negocio",
    campo: "veredicto", metrica: "margen", eje: "cliente",
    periodo: "año cerrado", universo: U_NEGOCIO, comparacion: "benchmark",
    // la ELECCIÓN de rama es una regla de decisión del módulo, no un dato directo → indicado, siempre.
    estatusDefault: "indicado", estatusCampo: null, controles: [],
    evidencia: [{ tool: "executiveSummary", args: {} }],
    sinTool: null,
    concordancia: { estado: "unsupported", campos: ["titular", "tension.n"],
      razon: "executiveSummary comparte la foto y la fuente, pero NO produce el titular ni la cuenta de cuentas con brecha material dentro del plano 80%: esa afirmación no existe como cifra en ninguna tool, es propia de esta pieza. El veredicto es texto, así que el cruce no encuentra ningún par que comparar" },
  },
  "comercial/01/reconciliacion-universos": {
    vista: "comercial", seccion: "01", tipo: "tira", label: "Cartera completa vs plano de decisión",
    campo: "tension", universoCampo: "tension.lista", metrica: "contribucion", eje: "cliente",
    periodo: "año cerrado", universo: { kind: "cola", label: "la cartera con brecha material, partida en plano 80% y cola", cierraCon: "plano + cola = cartera, por construcción" },
    comparacion: "benchmark", estatusDefault: "indicado", estatusCampo: null, controles: [],
    evidencia: [{ tool: "diagnose", args: {}, focus: "margen" }],
    sinTool: null,
    concordancia: { estado: "divergent", campos: ["concentraPct", "cartera"], toolsQueNoReconcilian: ["diagnose"],
      razon: "diagnose produce el mismo enJuego POR ENTIDAD, pero su subtotal no es el de esta tira: diagnose totaliza toda la cartera con brecha material y la tira sólo el plano 80%, y diagnose NO parte el universo en plano vs cola — esa reconciliación sólo existe en Sentrix. Medido en el total: $4.7M en pantalla vs $4.9M en el ledger (bonanza), $6.8M vs $7.2M (tensión), $8.3M vs $9.5M (crisis)" },
  },
  "comercial/01/kpi-ventas": {
    vista: "comercial", seccion: "01", tipo: "kpi", label: "Ventas del período",
    campo: "kpis[key='ventas']", metrica: "ventas", eje: "cliente",
    periodo: "año cerrado", universoCampo: "rows", universo: U_NEGOCIO, comparacion: "anterior",
    estatusDefault: "probado", estatusCampo: null, controles: [],
    evidencia: [{ tool: "queryMetric", args: { metric: "ventas", dimension: "cliente" } }],
    sinTool: null,
    // CERRADO 2026-08-09 (paso 2 · decisión 4): salesRead y trend YA reconcilian con la venta oficial del escenario
    // (salesRead entra por el contrato scenario-aware; trend ancla con la MISMA función que el evolutivo de Sentrix).
    // CERRADO 2026-08-09 (paso 4 · decisión 6): el TOTAL de ventas del negocio ya es una cifra propia —
    // `queryMetric{ventas, cliente}` la emite desde `sentrix/headline.js`, la MISMA función que pinta esta card, y
    // `_totales_cabecera_gate` la verifica carácter por carácter en los 3 escenarios. El motivo de acá se acota a lo
    // que SIGUE siendo cierto, y no es cosmético: `progressiveDisclosure` inyecta este texto en el prompt como
    // «LÍMITE DECLARADO de este componente», así que dejarlo tal cual hacía que ADI le dijera al usuario que no puede
    // contrastar la cabecera justo cuando ya puede. Lo que falta es el PIE — la variación vs el año anterior —:
    // la evidencia declarada de esta card entrega el valor, no el delta.
    concordancia: { estado: "unsupported", campos: ["pie"], toolsQueNoReconcilian: [],
      razon: "el VALOR ya cierra: `queryMetric{ventas, cliente}` devuelve el total oficial del negocio y concuerda exacto con la card en los tres escenarios. Lo que la evidencia declarada NO entrega es el PIE: la variación contra el año anterior — el delta no viaja con el ranking y ninguna tool lo emite como cifra propia" },
  },
  "comercial/01/kpi-contribucion": {
    vista: "comercial", seccion: "01", tipo: "kpi", label: "Contribución del período",
    campo: "kpis[key='contribucion']", metrica: "contribucion", eje: "cliente",
    periodo: "año cerrado", universoCampo: "rows", universo: U_NEGOCIO, comparacion: null,
    estatusDefault: "probado", estatusCampo: null, controles: [],
    evidencia: [{ tool: "contributionRead", args: { dimension: "cliente" }, focus: "rank" }],
    sinTool: null,
    concordancia: { estado: "reconciled",
      razon: "la contribución total de la card y la que autoriza `contributionRead{cliente}` son la misma cifra en los tres escenarios (cruce builder↔ledger de `_concordancia_numerica_gate`, sección 2)" },
  },
  "comercial/01/kpi-margen": {
    vista: "comercial", seccion: "01", tipo: "kpi", label: "Margen promedio ponderado",
    campo: "kpis[key='margen']", metrica: "margen", eje: "cliente",
    periodo: "año cerrado", universoCampo: "rows", universo: U_NEGOCIO, comparacion: "benchmark",
    // razón derivada + vara que el criterio del usuario puede haber pisado → indicado
    estatusDefault: "indicado", estatusCampo: null, controles: [],
    evidencia: [{ tool: "marginRead", args: { dimension: "cliente" }, focus: "bajo_benchmark" }],
    sinTool: null,
    // El margen ponderado del negocio SÍ lo devuelve `marginRead` desde la decisión 6 (cifra de cabecera). Lo que
    // sigue sin existir como una sola cifra es el PIE: la brecha en pp contra la vara del usuario.
    concordancia: { estado: "unsupported", campos: ["pie"],
      razon: "el VALOR ya cierra: `marginRead{cliente}` devuelve el margen ponderado del negocio y concuerda exacto con la card en los tres escenarios. Lo que no existe como cifra en ninguna tool es el PIE: la BRECHA en pp contra la vara — marginRead emite el margen y el benchmark por separado, nunca su diferencia" },
  },
  "comercial/01/kpi-acciones-comerciales": {
    vista: "comercial", seccion: "01", tipo: "kpi", label: "Acciones comerciales del período",
    // LA MÉTRICA YA EXISTE (owner 2026-08-09, decisión 6 · hallazgo E). Acá decía `metrica: "carga"` con una unidad
    // sobreescrita a mano, porque el registro declaraba la carga comercial SÓLO en pct (pctRebate) y el monto en
    // dinero que esta card muestra no tenía métrica detrás: era el KPI más visible de Comercial sin equivalente en
    // el oráculo. `acciones` ahora está declarada en `metricRegistry` (money · escala K · clientesMargen.rebates),
    // así que la unidad sale del registro como en cualquier otra pieza y el override desaparece. Las dos métricas
    // conviven a propósito: "carga comercial" es la tasa, "acciones comerciales" es el monto.
    campo: "kpis[key='acciones']", metrica: "acciones", eje: "cliente",
    periodo: "año cerrado", universoCampo: "rows", universo: U_NEGOCIO, comparacion: "meta",
    estatusDefault: "probado", estatusCampo: null, controles: [],
    evidencia: [{ tool: "queryMetric", args: { metric: "acciones", dimension: "cliente" } }],
    sinTool: null,
    // El `valor` ya cierra: `queryMetric{acciones}` devuelve el mismo total oficial que la card. Lo que sigue sin
    // cerrar es el PIE — cuánto de esas acciones está SOBRE la meta —, y ahí el piso de materialidad de $50.000 por
    // cuenta que aplican diagnose/simulateCarga hace que su subtotal sea ≤ el que la card afirma.
    concordancia: { estado: "divergent", campos: ["pie"], toolsQueNoReconcilian: ["diagnose", "simulateCarga"],
      razon: "el VALOR ya cierra: `queryMetric{acciones, cliente}` devuelve el mismo monto oficial que la card en los tres escenarios. El PIE no: cuánto de esas acciones está SOBRE la meta lo calculan diagnose y simulateCarga con un piso de materialidad de $50.000 por cuenta que este pie NO aplica, así que su subtotal es siempre ≤ el que la card afirma — la misma fórmula sobre distinto universo de cuentas" },
  },
  "comercial/01/tabla-cartera": {
    vista: "comercial", seccion: "01", tipo: "tabla", label: "El negocio, cliente por cliente",
    campo: "cartera", universoCampo: "cartera.filas", metrica: "ventas", eje: "cliente",
    periodo: "año cerrado", universo: U_NEGOCIO, comparacion: "presupuesto",
    estatusDefault: "indicado", estatusCampo: null, controles: ["todos"],
    evidencia: [
      { tool: "gridTable", args: { dimension: "cliente" } },
      { tool: "salesRead", args: { dimension: "cliente" }, focus: "vs_presupuesto" },
    ],
    sinTool: null,
    // CERRADO 2026-08-09 (paso 2 · decisión 4 · hallazgo A/B): "_ventasRows" ya carga por el contrato scenario-aware
    // y gridTable recibe el escenario del turno. Las 13 filas por cliente concuerdan EXACTO en los tres escenarios.
    // Lo único que queda es el TOTAL — ver el mismo motivo declarado en "comercial/01/tabla-cartera-total".
    concordancia: {
      estado: "divergent",
      razon: "el TOTAL de la tabla (no sus filas) sale de dos anclas distintas: la fila Total suma las filas del escenario y salesRead cita el KPI de ventas del escenario, la misma cifra que la card de la Mesa. Las dos son del escenario correcto y se separan por el ~0,1% que el dataset arrastra entre `ventasKPI` y Σ`clientesVentas` ($99.9M vs $100.0M en bonanza, $92.8M vs $92.9M en tensión, $81.1M vs $81.2M en crisis). Las filas por cliente sí cierran exacto",
      campos: ["total.venta"],
      toolsQueNoReconcilian: ["salesRead"],
    },
  },
  "comercial/01/tabla-cartera-total": {
    vista: "comercial", seccion: "01", tipo: "kpi", label: "Total cartera",
    campo: "cartera.total", universoCampo: "cartera.filas", metrica: "ventas", eje: "cliente",
    periodo: "año cerrado", universo: U_NEGOCIO, comparacion: "presupuesto",
    // la fila total se pinta DENTRO de la tabla: no tiene emisor propio y no lo necesita — viaja en el contexto de
    // su tabla, que sí está montada. Declararlo es lo que distingue "cubierto por su padre" de "quedó desconectado".
    _emitidoPor: "comercial/01/tabla-cartera",
    estatusDefault: "indicado", estatusCampo: null, controles: [],
    evidencia: [{ tool: "salesRead", args: { dimension: "cliente" }, focus: "vs_presupuesto" }],
    sinTool: null,
    // PASO 2 (decisión 4 · hallazgo B) — la CEGUERA está cerrada, la diferencia de ancla NO, y son dos cosas:
    // antes salesRead contestaba $100.0M en los tres escenarios (hasta 23% de error contra la pantalla); ahora se
    // mueve con el escenario y lo que queda es el ~0,1% estructural del dataset. Cuál de las dos anclas es LA venta
    // oficial del negocio es decisión del owner: hoy conviven tres y ninguna es "la mala".
    concordancia: {
      estado: "divergent",
      razon: "dos anclas del MISMO concepto, las dos del escenario correcto: esta fila Total suma las filas de la cartera (Σ clientesVentas del escenario) y salesRead cita el KPI de ventas del escenario — el mismo que muestra la card de ventas de la Mesa, por decisión del owner del 2026-07-15. Se separan por el ~0,1% que el dataset arrastra entre `ventasKPI` y Σ`clientesVentas`: $99.9M vs $100.0M en bonanza, $92.8M vs $92.9M en tensión, $81.1M vs $81.2M en crisis",
      campos: ["venta", "vsPresupuesto"],
      toolsQueNoReconcilian: ["salesRead"],
    },
  },
  "comercial/01/evolutivo-serie": {
    vista: "comercial", seccion: "01", tipo: "serie", label: "El año mes a mes",
    campo: "evolutivo", universoCampo: "evolutivo.meses", metrica: "ventas", eje: "tiempo",
    // el eje `tiempo` no es una entidad: `metricRegistry` declara la escala de ventas POR EJE DE ENTIDAD y no tiene
    // fila para él. La serie se ancla al total de clientesVentas, así que su escala es la MISMA de la venta oficial.
    unidad: "money", escala: "K",
    unidadMotivo: "eje tiempo: metricRegistry declara escala por eje de entidad y no cubre el eje temporal; la serie hereda la escala de la venta oficial a la que anchorSerie la ancla",
    periodo: "12 meses del año en foco", universo: { kind: "negocio", label: "el negocio completo, mes a mes", cierraCon: "series ancladas (anchorSerie) al total de clientesVentas del escenario" },
    comparacion: "anterior", estatusDefault: "probado", estatusCampo: null, controles: ["oculta", "hov"],
    evidencia: [{ tool: "trend", args: { metric: "ventas" } }],
    sinTool: null,
    // PASO 2 (decisión 4 · hallazgo C): el anclaje vive en UNA sola función ("temporal.buildGlobalEvolutionAnclada")
    // que consumen el gráfico y la tool "trend" — antes el gráfico anclaba y la tool no. La serie del AÑO ANTERIOR
    // ya cierra exacto en los tres escenarios (era $92.9M vs $93.0M); el residual es sólo el total de este año.
    concordancia: {
      estado: "divergent",
      razon: "el gráfico ancla la curva al total de la cartera (Σ clientesVentas del escenario) y trend la ancla al KPI de ventas del escenario: mismo anclaje, misma función, dos anclas. Diferencia medida ~0,1% ($99.9M vs $100.0M en bonanza, $92.8M vs $92.9M en tensión, $81.1M vs $81.2M en crisis); la forma del año y la serie del año anterior coinciden exacto",
      campos: ["series[key='actual'].total"],
      toolsQueNoReconcilian: ["trend"],
    },
  },
  "comercial/01/evolutivo-leyenda-totales": {
    vista: "comercial", seccion: "01", tipo: "lista", label: "Totales del año por serie",
    campo: "evolutivo.series", universoCampo: "evolutivo.series", metrica: "ventas", eje: "tiempo",
    unidad: "money", escala: "K",
    unidadMotivo: "eje tiempo: hereda la escala de la venta oficial, igual que la serie que resume",
    periodo: "año completo", universo: { kind: "negocio", label: "el total de cada serie tras el anclaje", cierraCon: "las dos series con contraparte oficial cierran con la venta por cliente" },
    _emitidoPor: "comercial/01/evolutivo-serie",   // la leyenda ES el control del gráfico: viaja en su contexto
    comparacion: "anterior", estatusDefault: "indicado", estatusCampo: null, controles: ["oculta"],
    evidencia: [{ tool: "trend", args: { metric: "ventas" } }],
    sinTool: null,
    // PASO 2 (decisión 4 · hallazgo C): trend lee la MISMA curva anclada que la leyenda. Los totales de "año
    // anterior" y "presupuesto" cierran exacto en los tres escenarios; queda el de "este año" — ver la serie.
    concordancia: {
      estado: "divergent",
      razon: "el total de la serie de este año se ancla al total de la cartera (Σ clientesVentas del escenario) y trend al KPI de ventas del escenario: ~0,1% de diferencia ($99.9M vs $100.0M en bonanza, $92.8M vs $92.9M en tensión, $81.1M vs $81.2M en crisis). Los totales de año anterior y presupuesto coinciden exacto",
      campos: ["total"],
      toolsQueNoReconcilian: ["trend"],
    },
  },
  "comercial/01/evolutivo-extremos": {
    vista: "comercial", seccion: "01", tipo: "tira", label: "Mes más alto, más bajo y mayor caída",
    campo: "evolutivo.caida", metrica: "ventas", eje: "tiempo",
    unidad: "money", escala: "K",
    unidadMotivo: "eje tiempo: hereda la escala de la venta oficial de la serie de la que son extremos",
    periodo: "12 meses del año en foco", universo: { kind: "negocio", label: "la serie del año en foco, ya anclada", cierraCon: "venta oficial del escenario" },
    _emitidoPor: "comercial/01/evolutivo-serie",   // la tira se pinta bajo el gráfico y describe SU serie
    comparacion: null, estatusDefault: "probado", estatusCampo: null, controles: [],
    evidencia: [{ tool: "trend", args: { metric: "ventas" } }],
    sinTool: null,
    concordancia: { estado: "unsupported", campos: ["caida"],
      razon: "trend devuelve el mejor mes y el mes más bajo de la MISMA serie anclada, pero 'la mayor caída mes a mes' no existe como concepto propio en ninguna tool: el ledger no autoriza esa cifra, así que la tira no tiene contra qué contrastarse" },
  },
  "comercial/01/pareto-ventas": {
    vista: "comercial", seccion: "01", tipo: "barra", label: "Dónde se concentra la venta",
    // el universo son TODAS las entidades reales (la curva acumulada se calcula sobre ellas); las barras están
    // agrupadas sólo para que se lean, y agrupar es decisión de dibujo, jamás de aritmética ni de alcance.
    campo: "pareto.ventas", universoCampo: "pareto.ventas.entidadesReales", metrica: "ventas", eje: "cliente",
    periodo: "año cerrado", universo: { kind: "negocio", label: "todas las entidades reales para la curva acumulada; las barras se agrupan sólo para que se lean", cierraCon: "las barras suman exacto el total" },
    comparacion: null, estatusDefault: "indicado", estatusCampo: null, controles: ["met", "hov"],
    evidencia: [{ tool: "salesRead", args: { dimension: "cliente" }, focus: "concentracion" }],
    sinTool: null,
    // CERRADO 2026-08-09 (paso 2 · decisión 4 · hallazgo B): "concentracion()" ya era la misma; lo que faltaba era que
    // las filas que recibe salieran del escenario.
    concordancia: { estado: "reconciled",
      razon: "`salesRead{cliente, concentracion}` corre la MISMA función `concentracion()` sobre las filas del mismo escenario: las barras y el ledger dan la misma cifra en los tres escenarios (18/18 pares en el cruce de `_concordancia_numerica_gate`)" },
  },
  "comercial/01/pareto-contribucion": {
    vista: "comercial", seccion: "01", tipo: "barra", label: "Dónde se concentra la contribución",
    campo: "pareto.contribucion", universoCampo: "pareto.contribucion.entidadesReales", metrica: "contribucion", eje: "cliente",
    periodo: "año cerrado", universo: { kind: "negocio", label: "las mismas entidades, rankeadas por contribución; la partición cabeza/cola sigue siendo la del plano 80% de ventas", cierraCon: "las barras suman exacto el total" },
    comparacion: null, estatusDefault: "indicado", estatusCampo: null, controles: ["met", "hov"],
    evidencia: [{ tool: "contributionRead", args: { dimension: "cliente" }, focus: "concentracion" }],
    sinTool: null,
    concordancia: { estado: "reconciled",
      razon: "misma función de concentración sobre las mismas filas del escenario: barras y ledger dan la misma cifra en los tres escenarios (18/18 pares en el cruce de `_concordancia_numerica_gate`)" },
  },
  "comercial/01/sostiene-clientes": {
    vista: "comercial", seccion: "01", tipo: "tabla", label: "Quién sostiene el negocio · clientes",
    campo: "sostiene.vistas[key='cliente']", universoCampo: "sostiene.vistas[key='cliente'].filas",
    metrica: "margen", eje: "cliente", periodo: "año cerrado", universo: U_GRUPO80,
    comparacion: "benchmark", estatusDefault: "indicado", estatusCampo: "sostiene.vistas[key='cliente'].reconcilia",
    controles: ["eje", "todos"],
    evidencia: [
      { tool: "marginRead", args: { dimension: "cliente" }, focus: "bajo_benchmark" },
      { tool: "gridTable", args: { dimension: "cliente" } },
    ],
    sinTool: null,
    concordancia: { estado: "unsupported", campos: ["grupoN", "colaN"],
      razon: "las cifras de la tabla (margen, venta y contribución por cuenta) concuerdan exacto con marginRead/gridTable en los tres escenarios. Lo que ninguna tool entrega es la PARTICIÓN grupo 80% / cola marcada en la misma respuesta: cuántas cuentas caen de cada lado no es una cifra que el oráculo emita" },
  },
  "comercial/01/sostiene-familias": {
    vista: "comercial", seccion: "01", tipo: "tabla", label: "Quién sostiene el negocio · familias",
    campo: "sostiene.vistas[key='familia']", universoCampo: "sostiene.vistas[key='familia'].filas",
    metrica: "margen", eje: "familia", periodo: "año cerrado", universo: U_GRUPO80,
    comparacion: "benchmark", estatusDefault: "indicado", estatusCampo: "sostiene.vistas[key='familia'].reconcilia",
    controles: ["eje", "todos"],
    evidencia: [
      { tool: "queryMetric", args: { metric: "ventas", dimension: "familia" } },
      { tool: "marginRead", args: { dimension: "familia" } },
    ],
    sinTool: null,
    concordancia: { estado: "unsupported", campos: ["reconcilia"],
      razon: "las cifras por familia concuerdan exacto con queryMetric/marginRead en los tres escenarios. Lo que no tiene equivalente es el campo `reconcilia`: esta vista es OTRO corte del mismo negocio (sfamiliasMargen), no un desglose de la tabla de clientes, y DECLARA si su suma cierra o no con la venta oficial — ninguna tool declara eso de sí misma" },
  },
  "comercial/01/sostiene-sku": {
    vista: "comercial", seccion: "01", tipo: "tabla", label: "Quién sostiene el negocio · SKU",
    campo: "sostiene.vistas[key='sku']", universoCampo: "sostiene.vistas[key='sku'].filas",
    metrica: "margen", eje: "sku", periodo: "año cerrado · dato base, sin escenario", universo: U_GRUPO80,
    comparacion: "benchmark", estatusDefault: "indicado", estatusCampo: "sostiene.vistas[key='sku'].reconcilia",
    controles: ["eje", "todos"],
    evidencia: [
      { tool: "queryMetric", args: { metric: "ventas", dimension: "sku" } },
      { tool: "marginRead", args: { dimension: "sku" } },
    ],
    sinTool: null,
    // RESUELTA (owner 2026-08-09, decisión 1): sourceManifest declara `money(K)` para skusMargen, igual que
    // metricRegistry — Σ venta = 100.000 = los $100.0M que Sentrix muestra. La divergencia que queda es OTRA y es
    // real: el precio/costo por unidad es crudo, así que unidades × precioLista no cierra contra la venta en miles.
    // Declarada en config/contract/figureType.js (DIVERGENCIAS), verificable, ya no "coinciden por convención".
    concordancia: { estado: "divergent", campos: ["costoMedio", "precioLista"],
      razon: "skusMargen: la venta se declara money(K) en las dos puntas del contrato (alineado 2026-08-09) y las cifras de la tabla concuerdan exacto en los tres escenarios. Queda la divergencia de PRECIO UNITARIO: costoMedio/precioLista son $ por unidad crudos y la venta viene en miles, así que unidades × precio no cierra contra la venta declarada — el par está declarado en `config/contract/figureType.js` (DIVERGENCIAS: venta_comercial ↔ precio_unitario)" },
  },
  "comercial/01/sostiene-canales": {
    vista: "comercial", seccion: "01", tipo: "tabla", label: "Quién sostiene el negocio · canales",
    campo: "sostiene.vistas[key='canal']", universoCampo: "sostiene.vistas[key='canal'].filas",
    metrica: "ventas", eje: "canal", periodo: "año cerrado", universo: U_GRUPO80,
    comparacion: "benchmark", estatusDefault: "probado", estatusCampo: "sostiene.vistas[key='canal'].reconcilia",
    controles: ["eje", "todos"],
    evidencia: [
      { tool: "queryMetric", args: { metric: "ventas", dimension: "canal" } },
      { tool: "contributionRead", args: { dimension: "canal" } },
    ],
    sinTool: null,
    concordancia: { estado: "reconciled",
      razon: "el eje canal es declarativo y sale de la misma fuente en las dos puntas: las cifras por canal concuerdan exacto en los tres escenarios (12/12 pares en el cruce de `_concordancia_numerica_gate`)" },
  },
  "comercial/01/porque-vende-mucho-deja-poco": {
    vista: "comercial", seccion: "01", tipo: "lista", label: "Por qué vende mucho y deja poco",
    campo: "deterioro.margen.porQue", universoCampo: "deterioro.margen.porQue.filas",
    metrica: "margen", eje: "cliente",
    periodo: "año cerrado · el contexto unitario, el último mes del historial",
    universo: { kind: "grupo80", label: "sólo las cuentas del grupo 80% por debajo del margen promedio ponderado de la cartera", cierraCon: "brecha = (acciones_prom − acciones_cuenta) + (costo%_prom − costo%_cuenta), sin residuo" },
    comparacion: "promedio_cartera", estatusDefault: "indicado", estatusCampo: "deterioro.margen.porQue.estatus",
    controles: ["abierto"],
    evidencia: [],
    sinTool: "nadie parte la brecha contra el promedio de la cartera en dos términos que sumen exacto, ni compara ticket/costo unitario contra el promedio ponderado. marginRead focus alto_volumen_bajo_margen lista las cuentas, pero no descompone la brecha.",
    concordancia: { estado: "unsupported", campos: ["filas"],
      razon: "sin evidencia declarada: ninguna tool descompone la brecha contra el promedio ponderado en dos términos que sumen exacto, así que no hay cifra del oráculo contra la cual reconciliar esta lista (ver `sinTool`)" },
  },

  // ══ COMERCIAL · 02 · DÓNDE SE DETERIORA EL MARGEN ═════════════════════════════════════════════════════════
  "comercial/02/acciones-vs-promedio-cartera": {
    vista: "comercial", seccion: "02", tipo: "lista", label: "Acciones comerciales contra el promedio de tu cartera",
    campo: "deterioro.margen.acciones.referencias[key='promedio']",
    universoCampo: "deterioro.margen.acciones.referencias[key='promedio'].filas",
    metrica: "carga", eje: "cliente", periodo: "año cerrado",
    universo: { kind: "negocio", label: "todas las cuentas cuya carga supera el promedio PONDERADO de la cartera, sin piso de materialidad", cierraCon: "promedio ponderado = Σ acciones ÷ Σ venta (el simple no reconcilia con el total)" },
    comparacion: "promedio_cartera", estatusDefault: "probado", estatusCampo: null, controles: ["varaAcc"],
    evidencia: [],
    sinTool: "simulateCarga y diagnose sólo conocen POLICY.targetCarga. El promedio ponderado de la cartera como VARA no existe en ninguna tool — y es la referencia que la vista muestra POR DEFECTO.",
    concordancia: { estado: "unsupported", campos: ["filas", "total"],
      razon: "sin evidencia declarada: la VARA de esta lista es el promedio PONDERADO de la cartera y ninguna tool la conoce (simulateCarga y diagnose sólo comparan contra POLICY.targetCarga). Contrastarla con la lista contra la meta sería reconciliar dos varas distintas" },
  },
  "comercial/02/acciones-vs-meta": {
    vista: "comercial", seccion: "02", tipo: "lista", label: "Acciones comerciales contra tu meta",
    campo: "deterioro.margen.acciones.referencias[key='meta']",
    universoCampo: "deterioro.margen.acciones.referencias[key='meta'].filas",
    metrica: "carga", eje: "cliente", periodo: "año cerrado",
    universo: { kind: "negocio", label: "todas las cuentas cuya carga supera la meta declarada, sin piso de materialidad", cierraCon: "(carga − meta)/100 × venta" },
    comparacion: "meta", estatusDefault: "indicado", estatusCampo: null, controles: ["varaAcc"],
    evidencia: [{ tool: "simulateCarga", args: {} }, { tool: "diagnose", args: {}, focus: "carga" }],
    sinTool: null,
    concordancia: { estado: "divergent", campos: ["n", "total"], toolsQueNoReconcilian: ["simulateCarga", "diagnose"],
      razon: "simulateCarga y diagnose calculan la MISMA fórmula pero con un piso de materialidad de $50.000 por cuenta que esta pill NO aplica: el n de filas y el total no coinciden. Medido en el total recuperable: $701K en pantalla vs $655K en el ledger (bonanza), $1.4M vs $1.3M (tensión), $2.4M vs $2.3M (crisis). DECISIÓN DE OWNER PENDIENTE: unificar el piso o declararlo en ambos lados" },
  },
  "comercial/02/costo-contra-precio": {
    vista: "comercial", seccion: "02", tipo: "lista", label: "Costo contra precio",
    campo: "deterioro.margen.costoPrecio", universoCampo: "deterioro.margen.costoPrecio.filas",
    metrica: "margen", eje: "cliente",
    periodo: "del primer al último mes del historial de cada cuenta", periodoCampo: null,
    universo: { kind: "negocio", label: "las cuentas con serie mensual que declaren costo medio y ticket en su primer y último mes", cierraCon: "delta de margen unitario × unidades del período" },
    comparacion: null, estatusDefault: "indicado", estatusCampo: "deterioro.margen.costoPrecio.estatus", controles: [],
    evidencia: [],
    sinTool: "marginRead focus causa_costo/causa_precio responde una pregunta PARECIDA con OTRA aritmética (markup y participación del costo sobre precioLista, corte anual) — no la variación intra-año de costoMedio contra ticket. Mapear ese focus acá sería contestar la cifra equivocada creyendo que es la misma.",
    concordancia: { estado: "unsupported", campos: ["filas"],
      razon: "sin evidencia declarada a propósito: la única tool cercana (marginRead causa_costo/causa_precio) mide OTRA cosa —markup anual sobre precioLista, no la variación intra-año de costoMedio contra ticket—, así que no hay par comparable. Declararla como evidencia sería reconciliar dos aritméticas distintas" },
  },

  // ══ COMERCIAL · 03 · QUÉ HACER PRIMERO ════════════════════════════════════════════════════════════════════
  "comercial/03/encabezado-cruce": {
    vista: "comercial", seccion: "03", tipo: "veredicto", label: "El cruce de los dos deterioros",
    campo: "prioridades", universoCampo: "prioridades.ambos", metrica: null, eje: "cliente",
    unidad: "conteo",   // lo que afirma es CUÁNTAS cuentas caen en la intersección, nunca un monto
    periodo: "año cerrado",
    universo: { kind: "seleccion", label: "la intersección de dos deterioros ya medidos: bajo su referencia de venta Y cediendo margen material", cierraCon: "deterioro.venta ∩ deterioro.margen" },
    comparacion: "presupuesto", estatusDefault: "indicado", estatusCampo: null, controles: [],
    evidencia: [],
    sinTool: "diagnose entrega los focos por separado y salesRead los que quedan cortos, pero el CRUCE de ambos deterioros sobre el mismo conjunto de cuentas no lo produce ninguna tool.",
    concordancia: { estado: "unsupported", campos: ["ambos"],
      razon: "sin evidencia declarada: lo que esta pieza cuenta es la INTERSECCIÓN de dos deterioros y ninguna tool la produce (diagnose y salesRead entregan cada lado por separado). Un conteo de la intersección armado a mano desde dos rankings distintos no sería la misma cifra" },
  },
  "comercial/03/grupos-prioridad": {
    vista: "comercial", seccion: "03", tipo: "lista", label: "Las cuentas priorizadas por grupo",
    campo: "prioridades.grupos", universoCampo: "prioridades.grupos", metrica: null, eje: "cliente",
    unidad: "conteo",   // agrupa cuentas por el problema que las trae acá; el monto lo pone la pieza que lo mide
    periodo: "año cerrado",
    universo: { kind: "seleccion", label: "las cuentas agrupadas por el problema que las trae acá; el grupo peligroso va primero", cierraCon: "deterioro.venta ∩ deterioro.margen" },
    comparacion: "presupuesto", estatusDefault: "indicado", estatusCampo: null, controles: [],
    evidencia: [{ tool: "diagnose", args: {}, focus: "margen" }],
    sinTool: null,
    concordancia: { estado: "divergent", campos: ["grupos"], toolsQueNoReconcilian: ["diagnose"],
      razon: "el orden y el agrupamiento son una regla de decisión del módulo y diagnose sólo aporta el enJuego por entidad, calculado contra OTRA vara y sin el piso de esta vista: para las mismas cuentas las dos puntas dan montos distintos (medido en bonanza: $82K en pantalla vs $194K en el ledger para la cuenta líder, $21K vs $125K para la siguiente). El conjunto de cuentas tampoco es el mismo — el ledger nombra SKU que esta lista no lista",
    },
    _provisional: true,
  },

  /* ══ CAPITAL ══════════════════════════════════════════════════════════════════════════════════════════════
   * LAS 14 ENTRADAS DE ESTA CARA DECÍAN `divergencia: null` (owner 2026-08-09, decisión 11). Ninguna lo había
   * comprobado: el null era una afirmación —«la cifra de la tool es la de la pantalla»— hecha por omisión sobre la
   * cara donde el dato es más traicionero. Ahora cada una declara su estado y su razón, y el gate las contrasta.
   *
   * EL LÍMITE QUE COMPARTEN TODAS, y por eso se dice una vez acá y se nombra en cada una: el capital de esta cara y
   * la venta de la cara Comercial NO RECONCILIAN. Están declarados como universos divergentes en
   * `config/contract/figureType.js` (DIVERGENCIAS: `inventario` ↔ `venta_comercial`) con razón verificable: la
   * venta se almacena en MILES y el stock en dólares CRUDOS (×1000), y las unidades del mismo SKU difieren entre 4x
   * y 35x entre `skusMargen` y `skuInventario`. Por eso `mesaCapital.js` no importa `skusMargen`: ninguna cifra de
   * esta cara se puede dividir por la venta, expresar como % de ella ni convertir en días de cobertura comercial.
   * Que las cifras de acá SÍ reconcilien con su tool no levanta ese límite — son dos preguntas distintas. */
  "capital/otro/vista": {
    vista: "capital", seccion: "otro", tipo: "vista", label: "La vista Capital completa",
    campo: "veredicto", metrica: "capital", eje: "sku", periodo: "foto de inventario a hoy",
    universo: { kind: "negocio", label: "todo el inventario del período", cierraCon: "skuInventario.stockUSD" },
    comparacion: null, estatusDefault: "indicado", estatusCampo: null, controles: [],
    evidencia: [{ tool: "inventoryStatus", args: {} }],
    sinTool: null,
    concordancia: { estado: "unsupported", campos: ["veredicto"],
      razon: "el contexto ambiente de la cara no autoriza ninguna cifra: el veredicto es texto y el cruce builder↔ledger no produce un solo par comparable. Además, ninguna cifra de esta cara reconcilia con la venta comercial (universos `inventario` ↔ `venta_comercial`, divergencia declarada en config/contract/figureType.js: miles vs dólares crudos y unidades que difieren entre 4x y 35x por SKU)" },
    _provisional: true,
  },
  "capital/01/veredicto": {
    vista: "capital", seccion: "01", tipo: "veredicto", label: "El veredicto del capital",
    campo: "veredicto", metrica: "capital", eje: "sku", periodo: "foto de inventario a hoy",
    universo: { kind: "negocio", label: "todo el inventario del período", cierraCon: "skuInventario.stockUSD" },
    comparacion: "estado", estatusDefault: "indicado", estatusCampo: null, controles: [],
    evidencia: [{ tool: "inventoryStatus", args: {} }],
    sinTool: null,
    concordancia: { estado: "unsupported", campos: ["veredicto"],
      razon: "el veredicto es TEXTO: localiza dónde está el capital y dónde falta, y no afirma ninguna cifra propia — el cruce builder↔ledger no encuentra un par que comparar. Las cifras que menciona son las de sus KPI, y cada uno declara su propio estado" },
    _provisional: true,
  },
  "capital/01/mapa": {
    vista: "capital", seccion: "01", tipo: "barra", label: "El mapa del capital por estado",
    campo: "mapa", universoCampo: "mapa.tramos", metrica: "capital", eje: "sku",
    periodo: "foto de inventario a hoy",
    universo: { kind: "estado", label: "los cuatro estados del detector de inventario", cierraCon: "los tramos suman el capital total" },
    comparacion: "estado", estatusDefault: "indicado", estatusCampo: null, controles: [],
    evidencia: [{ tool: "inventoryStatus", args: {} }],
    sinTool: null,
    concordancia: { estado: "reconciled",
      razon: "los cuatro tramos del detector y el total que suman concuerdan exacto con `inventoryStatus` en los tres escenarios: las dos puntas corren el MISMO `diagnoseInventario` sobre el MISMO inventario del escenario. El ledger además abre ese capital por bodega y por SKU — otro corte del mismo total, no otro universo. Sigue en pie el límite de la cara: este capital no reconcilia con la venta comercial (figureType.js)" },
    _provisional: true,
  },
  "capital/01/kpi-capital": {
    vista: "capital", seccion: "01", tipo: "kpi", label: "Capital en inventario",
    campo: "kpis[key='capital']", metrica: "capital", eje: "sku", periodo: "foto de inventario a hoy",
    universo: { kind: "negocio", label: "todo el inventario del período", cierraCon: "skuInventario.stockUSD" },
    comparacion: null, estatusDefault: "probado", estatusCampo: null, controles: ["drill"],
    // LA TOOL QUE DEVUELVE EL TOTAL, no la que devuelve el ranking (owner 2026-08-09, decisión 6 · hallazgo E).
    // Acá decía `queryMetric{capital, sku}`, que entrega el capital SKU por SKU y nunca su total: la cabecera que
    // esta card muestra no se podía contrastar contra su propia evidencia. `inventoryStatus{focus:"estado"}` es la
    // foto completa —el total y cómo se reparte en las cuatro puntas del motor— y ya emitía la cifra oficial.
    evidencia: [{ tool: "inventoryStatus", args: {}, focus: "estado" }],
    sinTool: null,
    concordancia: { estado: "reconciled",
      razon: "`inventoryStatus{focus:'estado'}` emite «Capital en inventario · total», la MISMA cifra que pinta la card, y concuerda exacto en los tres escenarios. Límite que la acompaña: es capital en dólares crudos de la foto de hoy — no se puede dividir por la venta ni expresar como % de ella, porque `inventario` y `venta_comercial` están declarados divergentes en config/contract/figureType.js" },
    _provisional: true,
  },
  // ⚠️ EL NOMBRE DE ESTE COMPONENTE OBEDECE EL CANDADO DE VOCABULARIO DEL OWNER (2026-08-09, `_mesa_capital_gate`):
  // en el producto este dinero se llama INMOVILIZADO, una sola palabra para una sola cosa. La llave `detenido` del
  // `campo` es la del builder (clave interna que nadie lee en pantalla) y por eso se conserva tal cual; lo que sí
  // se ve —el componentId, que viaja en la dirección y compone la etiqueta del CTA— usa la palabra del producto.
  "capital/01/kpi-inmovilizado": {
    vista: "capital", seccion: "01", tipo: "kpi", label: "Capital inmovilizado",
    campo: "kpis[key='detenido']", metrica: "capital", eje: "sku", periodo: "foto de inventario a hoy",
    universo: { kind: "estado", label: "los SKU que el detector clasifica como capital frenado", cierraCon: "diagnoseInventario sobre doh/rotación" },
    comparacion: "estado", estatusDefault: "indicado", estatusCampo: null, controles: ["drill"],
    // `frenado`, no `capital_frenado`: el VOCABULARIO del arg es {frenado|quiebre|sobrestock} y `capital_frenado` es
    // el nombre INTERNO del estado al que ese focus mapea (specRetrieval.js:_FOCUS_ESTADO). Escribir el estado en vez
    // del focus caía al default `|| "capital_frenado"` en SILENCIO — acá coincidía por casualidad, en kpi-quiebres no.
    evidencia: [{ tool: "inventoryStatus", args: {}, focus: "frenado" }],
    sinTool: null,
    concordancia: { estado: "reconciled",
      razon: "con el focus `frenado` la tool emite «capital inmovilizado», el mismo subconjunto que cuenta la card, y concuerda exacto en los tres escenarios. Con el focus mal escrito caía al default y respaldaba esta cabecera con otro estado — por eso el arg va declarado" },
    _provisional: true,
  },
  "capital/01/kpi-quiebres": {
    vista: "capital", seccion: "01", tipo: "kpi", label: "Riesgo de quiebre",
    campo: "kpis[key='quiebres']", metrica: "doh", eje: "sku", periodo: "foto de inventario a hoy",
    universo: { kind: "estado", label: "los SKU que el detector clasifica en riesgo de quiebre", cierraCon: "diagnoseInventario sobre doh/rotación" },
    comparacion: "estado", estatusDefault: "indicado", estatusCampo: null, controles: ["drill"],
    // `quiebre`, no `riesgo_quiebre` (ver la nota de kpi-inmovilizado): con el estado escrito en lugar del focus, la
    // tool caía al default y esta cabecera —riesgo de quiebre, $36.4K— quedaba respaldada por capital detenido, $33.2K.
    evidencia: [{ tool: "inventoryStatus", args: {}, focus: "quiebre" }],
    sinTool: null,
    concordancia: { estado: "reconciled",
      razon: "con el focus `quiebre` la tool emite «riesgo de quiebre», el mismo subconjunto que cuenta la card, y concuerda exacto en los tres escenarios. La cifra se apoya en `doh`, que es un valor DECLARADO por la fuente y no una cuenta derivada de stock ÷ venta diaria (esa cuenta no coincide con el dato en 11 de 13 filas): el estado del detector se decide con el declarado, y las dos puntas leen el mismo campo" },
    _provisional: true,
  },
  "capital/01/kpi-rotacion": {
    vista: "capital", seccion: "01", tipo: "kpi", label: "Rotación media",
    campo: "kpis[key='rotacion']", metrica: "rotacion", eje: "sku", periodo: "foto de inventario a hoy",
    universo: { kind: "negocio", label: "todo el inventario, ponderado por capital", cierraCon: "Σ rotación × capital ÷ Σ capital" },
    comparacion: "benchmark", estatusDefault: "indicado", estatusCampo: null, controles: ["drill"],
    evidencia: [{ tool: "queryMetric", args: { metric: "rotacion", dimension: "sku" } }],
    sinTool: null,
    concordancia: { estado: "reconciled",
      razon: "la rotación media tiene UNA sola implementación desde el 2026-08-09 —`sentrix/headline.js:rotacionPonderada`, ponderada por capital— y la consumen la card y la tool: concuerdan exacto en los tres escenarios. Antes convivían tres rotaciones medias distintas en el producto (la ponderada de esta card, la del drill y el promedio SIMPLE por SKU de queryMetric) con el mismo nombre, y esta cabecera no se podía contrastar contra su propia evidencia. La rotación es un valor declarado por la fuente: no se recalcula desde stock y unidades" },
    _provisional: true,
  },
  "capital/01/cortes": {
    vista: "capital", seccion: "01", tipo: "tabla", label: "El capital por corte",
    campo: "cortes", universoCampo: "cortes.vistas", metrica: "capital", eje: "bodega",
    periodo: "foto de inventario a hoy",
    universo: { kind: "eje", label: "el capital repartido por bodega, familia o edad", cierraCon: "cada corte declara si reconcilia con el total" },
    comparacion: null, estatusDefault: "indicado", estatusCampo: null, controles: ["corte"],
    evidencia: [{ tool: "queryMetric", args: { metric: "capital", dimension: "bodega" } }],
    sinTool: null,
    concordancia: { estado: "unsupported", campos: ["vistas[key='familia']", "vistas[key='edad']"],
      razon: "el corte por BODEGA concuerda exacto con `queryMetric{capital, bodega}` en los tres escenarios. Los otros dos cortes que este control ofrece no tienen equivalente en el oráculo: `metricRegistry` declara la métrica `capital` sólo sobre los ejes `sku` y `bodega`, mientras que Sentrix arma el corte por FAMILIA desde `skuInventario.sfamilia` y el corte por EDAD desde tramos de días sin venta. Los tres reparten el mismo total, pero ADI sólo puede demostrar uno" },
    _provisional: true,
  },
  "capital/01/focos": {
    vista: "capital", seccion: "01", tipo: "lista", label: "Los focos del capital",
    campo: "focos", universoCampo: "focos", metrica: "capital", eje: "sku",
    periodo: "foto de inventario a hoy",
    universo: { kind: "estado", label: "un foco por estado con señal", cierraCon: "diagnoseInventario" },
    // DECLARADO PERO HOY NO SE PINTA (owner 2026-08-09): la tira de focos salió de la cara junto con el "¿Y si…?" y
    // la tira de estados. No se le cablea emisor a propósito — un contexto de algo que no está en pantalla haría que
    // ADI resolviera "esto" contra una pieza que el usuario no está viendo. Queda declarado para cuando vuelva.
    _noMontado: "el owner sacó la tira de focos de la cara Capital el 2026-08-09; la entrada queda declarada para cuando vuelva",
    comparacion: "estado", estatusDefault: "indicado", estatusCampo: null, controles: [],
    evidencia: [{ tool: "inventoryStatus", args: {} }],
    sinTool: null,
    concordancia: { estado: "reconciled",
      razon: "el $ de cada foco es el de su estado en `diagnoseInventario`, la misma función que corre `inventoryStatus`: concuerdan exacto en los tres escenarios. Lo que ni la tira ni la tool afirman es la CAUSA (obsolescencia, sobrecompra, temporada): no se puede inferir sin historial de stock y ninguna de las dos puntas la emite" },
    _provisional: true,
  },
  "capital/01/reponer": {
    vista: "capital", seccion: "01", tipo: "lista", label: "Qué reponer",
    campo: "reponer", universoCampo: "reponer.filas", metrica: "doh", eje: "sku",
    periodo: "foto de inventario a hoy",
    universo: { kind: "estado", label: "los SKU de alta salida con cobertura corta", cierraCon: "diagnoseInventario" },
    comparacion: "estado", estatusDefault: "indicado", estatusCampo: null, controles: [],
    evidencia: [{ tool: "inventoryStatus", args: {}, focus: "quiebre" }],   // vocabulario del arg, no el estado
    sinTool: null,
    concordancia: { estado: "reconciled",
      razon: "las filas y sus días de inventario concuerdan exacto con `inventoryStatus{focus:'quiebre'}` en los tres escenarios: misma clasificación del detector sobre el mismo dato. La lista NO cuantifica la venta en riesgo ni el lead time del proveedor —no están en el dato— y ninguna de las dos puntas los emite" },
    _provisional: true,
  },
  "capital/01/liquidar": {
    vista: "capital", seccion: "01", tipo: "lista", label: "Qué liquidar",
    campo: "liquidar", universoCampo: "liquidar.filas", metrica: "capital", eje: "sku",
    periodo: "foto de inventario a hoy",
    universo: { kind: "estado", label: "los SKU con capital inmovilizado", cierraCon: "diagnoseInventario" },
    comparacion: "estado", estatusDefault: "indicado", estatusCampo: null, controles: [],
    evidencia: [{ tool: "inventoryStatus", args: {}, focus: "frenado" }],   // vocabulario del arg, no el estado
    sinTool: null,
    concordancia: { estado: "reconciled",
      razon: "el capital de cada fila concuerda exacto con `inventoryStatus{focus:'frenado'}` en los tres escenarios. LÍMITE DE LA ACCIÓN que esta lista propone: liquidar y rebajar sí; TRANSFERIR entre bodegas no se puede evaluar mientras ningún SKU aparezca en más de una (`capability.transferenciaCapability`, la misma cuenta que declara el límite en la vista)" },
    _provisional: true,
  },
  "capital/01/simulaciones": {
    vista: "capital", seccion: "01", tipo: "lista", label: "¿Y si…? del capital",
    campo: "simulaciones", universoCampo: "simulaciones", metrica: "capital", eje: "sku",
    periodo: "foto de inventario a hoy",
    universo: { kind: "estado", label: "supuestos declarados sobre el capital inmovilizado", cierraCon: null },
    _noMontado: "el «¿Y si…?» del capital salió de la cara el 2026-08-09; la entrada queda declarada para cuando vuelva",
    comparacion: null, estatusDefault: "indicado", estatusCampo: null, controles: [],
    evidencia: [{ tool: "simulateCapital", args: {} }],
    sinTool: null,
    concordancia: { estado: "unsupported", campos: ["simulaciones"],
      razon: "las líneas del «¿Y si…?» son PREGUNTAS con su supuesto declarado, no cifras: el cruce builder↔ledger no encuentra un par que comparar. Quien cuantifica es `simulateCapital` cuando el usuario acepta el supuesto, y esa cifra nace ahí — la pantalla no la afirma antes" },
    _provisional: true,
  },
  "capital/01/barras": {
    vista: "capital", seccion: "01", tipo: "barra", label: "Concentración del capital",
    campo: "barras", universoCampo: "barras.vistas", metrica: "capital", eje: "sku",
    periodo: "foto de inventario a hoy",
    universo: { kind: "negocio", label: "el capital por SKU, general o sólo el inmovilizado", cierraCon: "las barras suman el total de su vista" },
    comparacion: null, estatusDefault: "probado", estatusCampo: null, controles: ["barra"],
    evidencia: [{ tool: "queryMetric", args: { metric: "capital", dimension: "sku" } }],
    sinTool: null,
    concordancia: { estado: "reconciled",
      razon: "el capital por SKU de las barras y el que autoriza `queryMetric{capital, sku}` es el mismo campo (`skuInventario.stockUSD`) del mismo escenario: concuerdan exacto en los tres. El ledger lista más SKU que las barras porque la vista corta el top — mismo universo, distinto tope" },
    _provisional: true,
  },
  "capital/01/alertas": {
    vista: "capital", seccion: "01", tipo: "tira", label: "En alerta",
    campo: "alertas", metrica: "capital", eje: "sku", periodo: "foto de inventario a hoy",
    universo: { kind: "estado", label: "los SKU críticos del detector", cierraCon: "diagnoseInventario" },
    _noMontado: "la tira de estados salió de la cara Capital el 2026-08-09; la entrada queda declarada para cuando vuelva",
    comparacion: "estado", estatusDefault: "indicado", estatusCampo: null, controles: [],
    // `frenado` DECLARADO, no heredado del default (misma regla que kpi-inmovilizado/kpi-quiebres): el dinero que
    // esta tira muestra es el capital INMOVILIZADO de los SKU críticos, no el capital del inventario. Escrito, la
    // pieza dice de qué subconjunto habla; implícito, quedaba a merced del default de la tool.
    evidencia: [{ tool: "inventoryStatus", args: {}, focus: "frenado" }],
    sinTool: null,
    concordancia: { estado: "reconciled",
      razon: "el dinero de la tira es el capital INMOVILIZADO de los SKU críticos y `inventoryStatus{focus:'frenado'}` autoriza esa misma cifra: concuerdan exacto en los tres escenarios. Con el focus implícito la tira quedaba respaldada por el capital del inventario entero, que es otra cifra correcta del mismo nombre" },
    _provisional: true,
  },

  // ══ RESULTADO ════════════════════════════════════════════════════════════════════════════════════════════
  // El P&L se SELLA CONVERSANDO: si el tenant todavía no lo declaró, buildMesaResultado devuelve {defined:false}.
  // `campoOpcional` declara esa ausencia honesta: sin P&L no hay contexto de estos componentes, y eso NO es un bug.
  "resultado/otro/vista": {
    vista: "resultado", seccion: "otro", tipo: "vista", label: "La vista Resultado completa",
    campo: "cascada", campoOpcional: true, metrica: "contribucion", eje: "cliente",
    periodo: "año cerrado",
    universo: { kind: "negocio", label: "el negocio completo con sus gastos declarados", cierraCon: "buildPnlCascade" },
    comparacion: null, estatusDefault: "indicado", estatusCampo: null, controles: [],
    // decisión 3 (owner 2026-08-09): `pnlRead` ES la tool del oráculo del P&L — envuelve el MISMO `composePnl`
    // que construye esta cara, así que las dos puntas no pueden divergir por construcción. El `sinTool` que había
    // acá ("hoy ninguna tool del oráculo lo devuelve") dejó de ser cierto y por eso se retira: una declaración
    // falsa en el contrato es peor que la ausencia que declaraba.
    evidencia: [{ tool: "pnlRead", args: {} }],
    sinTool: null,
    concordancia: { estado: "reconciled",
      razon: "por construcción: `pnlRead` ENVUELVE el mismo `composePnl` que construye esta cara, así que las dos puntas no pueden emitir cifras distintas sin que el envoltorio deje de compilar. En este tenant el P&L todavía no está declarado (`campoOpcional`), así que no hay cifra viva que cruzar — la reconciliación es estructural, no medida sobre este dato" },
    _provisional: true,
  },
  "resultado/01/cascada": {
    vista: "resultado", seccion: "01", tipo: "lista", label: "La cascada del resultado",
    campo: "cascada", campoOpcional: true, universoCampo: "cascada", metrica: "contribucion", eje: "cliente",
    periodo: "año cerrado",
    universo: { kind: "negocio", label: "ingreso − costo − carga − gastos declarados", cierraCon: "buildPnlCascade" },
    comparacion: null, estatusDefault: "indicado", estatusCampo: null, controles: ["cascadaFoco"],
    // decisión 3: `pnlRead` devuelve ESTA cascada — es un envoltorio de `composePnl`, que es el mismo motor que
    // pinta la cara. El `sinTool` anterior ("ninguna tool del oráculo devuelve la cascada del P&L") ya no describe
    // el producto.
    evidencia: [{ tool: "pnlRead", args: {} }],
    sinTool: null,
    concordancia: { estado: "reconciled",
      razon: "por construcción: `pnlRead` devuelve ESTA cascada porque es un envoltorio de `composePnl`, el mismo motor que la pinta — ingreso, costo, carga, gastos declarados y resultado salen de la misma llamada. Sin P&L declarado en el tenant no hay cifra viva que cruzar (`campoOpcional`)" },
    _provisional: true,
  },
  "resultado/01/cuadro": {
    vista: "resultado", seccion: "01", tipo: "tabla", label: "El resultado por entidad",
    campo: "cuadro", campoOpcional: true, universoCampo: "cuadro.rows", metrica: "contribucion", eje: "cliente",
    periodo: "año cerrado",
    universo: { kind: "eje", label: "las filas del eje elegido con su gasto prorrateado", cierraCon: "el total del cuadro cierra con la cascada" },
    comparacion: null, estatusDefault: "indicado", estatusCampo: null, controles: ["pnlEje", "pnlFoco"],
    evidencia: [{ tool: "gridTable", args: { dimension: "cliente" } }],
    sinTool: null,
    concordancia: { estado: "unsupported", campos: ["gasto", "resultado", "resultadoPct"],
      razon: "gridTable no conoce los gastos declarados del P&L: entrega venta, contribución y margen por entidad, nunca el gasto prorrateado ni el resultado. Las columnas que ESTA tabla agrega —las que la convierten en un P&L por entidad— no existen en la evidencia declarada, así que no hay contra qué reconciliarlas" },
    _provisional: true,
  },

  // ══ FICHA ════════════════════════════════════════════════════════════════════════════════════════════════
  "ficha/otro/vista": {
    vista: "ficha", seccion: "otro", tipo: "vista", label: "La Ficha Ejecutiva",
    campo: "focus", entidadCampo: "focus", metrica: "contribucion", eje: "cliente", periodo: "año cerrado",
    universo: { kind: "seleccion", label: "una entidad puntual contra su cartera", cierraCon: "clientesVentas/clientesMargen del escenario" },
    // la Ficha es una cara de UNA entidad: su contexto ambiente y el de su pieza son el mismo (misma vista, misma
    // sección, misma entidad), así que el emisor de la cara es directamente la pieza — no hay ambiente aparte.
    _emitidoPor: "ficha/otro/ficha-cliente",
    comparacion: "promedio_cartera", estatusDefault: "indicado", estatusCampo: null, controles: [],
    evidencia: [{ tool: "entityProfile", args: {} }],
    sinTool: null,
    concordancia: { estado: "unsupported", campos: ["focus"],
      razon: "el `campo` de esta entrada es el SUJETO de la Ficha (el nombre de la entidad), no una medida: el cruce builder↔ledger no encuentra ninguna cifra que comparar. Las cifras de la Ficha las emiten sus piezas y `entityProfile` las autoriza; esta entrada sólo identifica de quién habla la pantalla" },
    _provisional: true,
  },
  "ficha/otro/ficha-cliente": {
    vista: "ficha", seccion: "otro", tipo: "veredicto", label: "Ficha Ejecutiva del cliente",
    campo: "focus", entidadCampo: "focus", metrica: "contribucion", eje: "cliente", periodo: "año cerrado",
    universo: { kind: "seleccion", label: "una entidad puntual contra el promedio de la cartera", cierraCon: "clientesMargen del escenario" },
    comparacion: "promedio_cartera", estatusDefault: "indicado", estatusCampo: null, controles: [],
    evidencia: [{ tool: "entityProfile", args: {} }],
    sinTool: null,
    concordancia: { estado: "unsupported", campos: ["focus"],
      razon: "igual que su vista: el `campo` es el sujeto, no la medida, y el cruce no produce ningún par comparable. Y hay un límite que la Ficha tiene que arrastrar: el capital que se le asocia a un cliente NO es capital del cliente — la matriz cliente×SKU se construye por AFINIDAD de marca y familia, no por transacciones observadas, así que esa asociación sale sellada `indicado` y el sujeto de la cifra sigue siendo el negocio" },
    _provisional: true,
  },

  /* ══ NIVEL 2 · LAS SUPERFICIES QUE ADI ABRE (owner 2026-08-09, decisión 12) ═══════════════════════════════════
   * EL BUCLE SE CERRABA EN UN SOLO SENTIDO. Las cuatro caras le pasan contexto al chat en 36 puntos, y el panel que
   * el chat ABRE cuando responde no devolvía ninguno: el usuario miraba el Cuadro de mando, la tabla-ring, el
   * recibo, la decisión priorizada o la proyección, escribía «y de esos, ¿cuál…?», y ADI resolvía ese «esos» contra
   * la última cara de la Mesa —o contra nada—. Estas trece entradas son la vuelta del bucle.
   *
   * POR QUÉ NO SON UNA QUINTA CARA. Una dirección `sentrix://` abre una CARA, y estas superficies no son una: son
   * lo que se abre SOBRE una cara. Cada una vive en la cara que la demuestra, y ahí es donde la vuelta aterriza.
   *
   * POR QUÉ HAY TRECE ENTRADAS PARA CINCO SUPERFICIES. Porque el UNIVERSO cambia dentro de la misma superficie, y
   * ése es exactamente el hallazgo que esta decisión viene a declarar: la columna «En juego $» del Cuadro es
   * margen no capturado en la pestaña de clientes y capital inmovilizado en las otras tres — dos magnitudes bajo
   * una sola etiqueta, medidas más abajo. Una entrada por pestaña es lo que hace que el contexto emitido diga cuál
   * de las dos está mirando el usuario. Donde el universo NO cambia (la métrica dentro de una misma cara) alcanza
   * un CONTROL, y por eso la proyección tiene dos entradas y no tres.
   *
   * `builder` dice qué correr para obtener la salida contra la cual se deriva el contexto (ver SUPERFICIE_BUILDERS).
   * ════════════════════════════════════════════════════════════════════════════════════════════════════════════ */

  // ── EL CUADRO DE MANDO · la grilla operable, una entrada por pestaña ────────────────────────────────────────
  "comercial/otro/cuadro-mando": {
    vista: "comercial", seccion: "otro", tipo: "tabla", label: "El Cuadro de mando · clientes",
    builder: "cuadro:cliente", campo: "rows", universoCampo: "rows",
    metrica: "ventas", eje: "cliente", periodo: "año cerrado",
    universo: { kind: "eje", label: "todas las cuentas del eje, con su acción derivada y su $ en juego", cierraCon: "la fila Total suma las filas del escenario" },
    comparacion: "benchmark", estatusDefault: "indicado", estatusCampo: null,
    controles: ["dim", "orden", "modo", "busca", "solosel"],
    evidencia: [{ tool: "gridTable", args: { dimension: "cliente" } }],
    sinTool: null,
    concordancia: { estado: "unsupported", campos: ["enJuego", "lectura", "accion"],
      razon: "las columnas del DATO (venta, unidades, acciones comerciales, contribución y margen por cuenta) salen de la misma fuente del mismo escenario que `gridTable{cliente}`. Lo que ninguna tool emite es la CAPA DEL ASESOR que esta grilla suma: «En juego $», la microlectura y la Acción son la salida de los detectores del diagnose sobre esa fila —no columnas de la entidad—, y el chip de Acción es una regla de decisión del módulo. En esta pestaña ese «En juego $» es margen no capturado y carga sobre el target: $5.0M en bonanza, $7.3M en tensión, $9.5M en crisis" },
  },
  "comercial/otro/cuadro-mando-sku": {
    vista: "comercial", seccion: "otro", tipo: "tabla", label: "El Cuadro de mando · SKU",
    builder: "cuadro:sku", campo: "rows", universoCampo: "rows",
    metrica: "margen", eje: "sku", periodo: "año cerrado · dato base, sin escenario",
    universo: { kind: "eje", label: "todos los SKU del catálogo: el margen del año y el capital de la foto de inventario, en la misma fila", cierraCon: null },
    comparacion: "benchmark", estatusDefault: "indicado", estatusCampo: null,
    controles: ["dim", "orden", "modo", "busca", "solosel"],
    evidencia: [{ tool: "gridTable", args: { dimension: "sku" } }],
    sinTool: null,
    concordancia: { estado: "unsupported", campos: ["enJuego", "lectura", "accion", "capital", "rotacion"],
      razon: "el margen por SKU concuerda con `gridTable{sku}`. Lo que la evidencia declarada NO entrega es el resto de la fila: «En juego $», la microlectura y la Acción son la capa del asesor (detectores del diagnose), y las columnas Capital y Rotación vienen del INVENTARIO, un universo que no reconcilia con la venta del mismo SKU (`inventario` ↔ `venta_comercial` en config/contract/figureType.js: miles vs dólares crudos y unidades que difieren entre 4x y 35x). En esta pestaña «En juego $» es capital inmovilizado: $33.2K en bonanza y tensión, $43.0K en crisis — no margen" },
  },
  "comercial/otro/cuadro-mando-marca": {
    vista: "comercial", seccion: "otro", tipo: "tabla", label: "El Cuadro de mando · marcas",
    builder: "cuadro:marca", campo: "rows", universoCampo: "rows",
    metrica: "ventas", eje: "marca", periodo: "año cerrado",
    universo: { kind: "eje", label: "todas las marcas del catálogo con su venta y su margen; el «En juego $» de esta pestaña es de otro universo", cierraCon: null },
    comparacion: "benchmark", estatusDefault: "indicado", estatusCampo: null,
    controles: ["dim", "orden", "modo", "busca", "solosel"],
    evidencia: [{ tool: "gridTable", args: { dimension: "marca" } }],
    sinTool: null,
    // ÉSTE ES EL CASO QUE EL OWNER NOMBRÓ. La misma columna, la misma etiqueta, el mismo formato, dos universos.
    concordancia: { estado: "unsupported", campos: ["enJuego", "lectura", "accion"],
      razon: "la venta, las acciones comerciales, la contribución y el margen por marca concuerdan con `gridTable{marca}`. La columna «En juego $» NO: en esta pestaña no es margen no capturado sino CAPITAL INMOVILIZADO agregado por marca desde el inventario —$33.2K en bonanza, contra $5.0M de la pestaña de clientes en el mismo escenario, 151 veces menos bajo la misma etiqueta—, y es capital que ninguna tool agrega por marca (el detector lo emite por SKU). Los dos universos están declarados divergentes en config/contract/figureType.js: la venta comercial se almacena en miles y el inventario en dólares crudos, así que la columna no se puede leer como parte de la misma fila" },
  },
  "capital/otro/cuadro-mando-bodega": {
    vista: "capital", seccion: "otro", tipo: "tabla", label: "El Cuadro de mando · bodegas",
    builder: "cuadro:bodega", campo: "rows", universoCampo: "rows",
    metrica: "capital", eje: "bodega", periodo: "foto de inventario a hoy",
    universo: { kind: "eje", label: "el capital repartido por bodega, con su parte inmovilizada y su rotación", cierraCon: "la fila Total suma el capital de las bodegas" },
    comparacion: "promedio_cartera", estatusDefault: "indicado", estatusCampo: null,
    controles: ["dim", "orden", "modo", "busca", "solosel"],
    // DOS tools y no una: el capital es la columna que abre la grilla, pero la rotación es la única cifra de esta
    // pestaña que el cruce builder↔ledger puede comparar hoy —las columnas de dinero salen del builder como número
    // pelado, sin su gemelo formateado, así que el gate no puede establecerles la escala y las excluye—. Declarar
    // sólo el capital dejaba a la pestaña sin un solo par contrastable: cobertura declarada, prueba ninguna.
    evidencia: [
      { tool: "queryMetric", args: { metric: "capital", dimension: "bodega" } },
      { tool: "queryMetric", args: { metric: "rotacion", dimension: "bodega" } },
    ],
    sinTool: null,
    // MEDIDO, no supuesto: el cruce builder↔ledger encuentra 6 de 12 rotaciones que no cierran, y son de redondeo.
    concordancia: { estado: "divergent", campos: ["rotacion"], toolsQueNoReconcilian: ["queryMetric"],
      razon: "el capital por bodega concuerda exacto con `queryMetric{capital, bodega}`. La ROTACIÓN no: esta grilla redondea el promedio de la bodega a un decimal ANTES de guardarlo y `queryMetric{rotacion, bodega}` conserva la precisión completa — 5,0x contra 5,025x y 5,3x contra 5,25x, en 6 de las 12 celdas de los tres escenarios (entre 0,5% y 0,9%). En pantalla las dos se ven iguales porque las dos se pintan con un decimal, y por eso el desacuerdo nunca iba a aparecer solo: ordenar por esa columna sí puede diferir. Lo que además la evidencia no entrega es la PARTICIÓN sano/inmovilizado ni su porcentaje —la definición de inmovilizado (en alerta o rotación < 2) vive en Sentrix—, ni «En juego $», la microlectura y la Acción, que son la capa del asesor. Esta pestaña es la única del Cuadro donde el «En juego $» y el resto de la fila comparten universo, porque las dos cifras son inventario" },
  },

  // ── LA TABLA-RING · el foco contra su promedio, su par instructivo y el mejor en clase ──────────────────────
  "comercial/otro/control-ring": {
    vista: "comercial", seccion: "otro", tipo: "tabla", label: "El Control · el ring de una cuenta",
    builder: "ring:cliente", campo: "rows", universoCampo: "rows", entidadCampo: "focus",
    metrica: "contribucion", eje: "cliente", periodo: "año cerrado",
    universo: { kind: "seleccion", label: "cuatro filas: el foco, el par que aísla la palanca, el promedio interno y el mejor en clase", cierraCon: null },
    comparacion: "promedio_cartera", estatusDefault: "indicado", estatusCampo: null, controles: [],
    evidencia: [{ tool: "marginRead", args: { dimension: "cliente" } }],
    sinTool: null,
    concordancia: { estado: "unsupported", campos: ["rows[role='peer']", "rows[role='avg']", "costoTechoK"],
      razon: "el margen, la carga y la contribución de las filas reales concuerdan con `marginRead{cliente}` del mismo escenario. Lo que ninguna tool produce es el RING: la ELECCIÓN del par instructivo (la cuenta de carga más parecida entre las que superan al foco) es una regla de decisión del módulo, la fila «Promedio interno» es un promedio simple de la cartera que el ledger no emite como cifra propia, y el techo de recuperación por costo es una cuenta de esta pieza. El ring es la lectura, no el dato" },
  },
  "comercial/otro/control-ring-sku": {
    vista: "comercial", seccion: "otro", tipo: "tabla", label: "El Control · el ring de un SKU",
    builder: "ring:sku", campo: "rows", universoCampo: "rows", entidadCampo: "focus",
    metrica: "contribucion", eje: "sku", periodo: "año cerrado · dato base, sin escenario",
    universo: { kind: "seleccion", label: "el foco contra su familia (o el catálogo entero si la familia es chica), su promedio y el mejor en clase", cierraCon: null },
    comparacion: "promedio_cartera", estatusDefault: "indicado", estatusCampo: null, controles: [],
    evidencia: [{ tool: "marginRead", args: { dimension: "sku" } }],
    sinTool: null,
    // LÍMITE DE PRESENTACIÓN MEDIDO, no una sospecha: es el mismo desalineamiento K-vs-raw que ya se corrigió una
    // vez en `metricRegistry` (ver el comentario de `ventas.scale.sku`) y que sobrevive en el formateador del ring.
    concordancia: { estado: "unsupported", campos: ["rows[role='peer']", "rows[role='avg']", "costoTechoK", "contribucion"],
      razon: "el margen y el costo del foco concuerdan con `marginRead{sku}`. Dos cosas no las entrega la evidencia declarada: el RING (el par instructivo y la fila de promedio son reglas de decisión del módulo, no cifras del ledger) y la ESCALA de la contribución en pantalla — el contrato declara `skusMargen` en miles (`metricRegistry`: contribucion.scale.sku = K) y esta pieza la formatea como dólares crudos, así que muestra $2.4K donde el contrato afirma $2.4M. La cifra del dato es correcta; lo que no cierra es cómo se pinta" },
  },
  "comercial/otro/control-ring-marca": {
    vista: "comercial", seccion: "otro", tipo: "tabla", label: "El Control · el ring de una marca",
    builder: "ring:marca", campo: "rows", universoCampo: "rows", entidadCampo: "focus",
    metrica: "contribucion", eje: "marca", periodo: "año cerrado · dato base, sin escenario",
    universo: { kind: "seleccion", label: "la marca contra las demás marcas, agregadas desde sus SKU", cierraCon: null },
    comparacion: "promedio_cartera", estatusDefault: "indicado", estatusCampo: null, controles: [],
    evidencia: [{ tool: "marginRead", args: { dimension: "marca" } }],
    sinTool: null,
    concordancia: { estado: "divergent", campos: ["contribucion", "margen", "rows[role='avg']"], toolsQueNoReconcilian: ["marginRead"],
      razon: "esta pieza NO lee la marca: la RECONSTRUYE sumando los SKU de `skusMargen` y ponderando su carga por venta, mientras `marginRead{marca}` (y el Cuadro de mando de la misma pantalla) leen la fila declarada de `marcasMargen`. Son dos agregaciones distintas del mismo concepto y no coinciden: en la marca líder el ring afirma 22,1% de margen y $6.99M de contribución donde la fila declarada dice 24,2% y $7.64M. Encima arrastra el mismo desalineamiento de escala que el ring de SKU: el contrato declara esa contribución en miles y la pieza la pinta como dólares crudos" },
  },
  "capital/otro/control-ring-bodega": {
    vista: "capital", seccion: "otro", tipo: "tabla", label: "El Control · el ring de una bodega",
    builder: "ring:bodega", campo: "rows", universoCampo: "rows", entidadCampo: "focus",
    metrica: "capital", eje: "bodega", periodo: "foto de inventario a hoy",
    universo: { kind: "seleccion", label: "la bodega contra el promedio de bodegas y la más sana, con su capital y su parte inmovilizada", cierraCon: null },
    comparacion: "promedio_cartera", estatusDefault: "indicado", estatusCampo: null, controles: [],
    evidencia: [
      { tool: "queryMetric", args: { metric: "capital", dimension: "bodega" } },
      { tool: "queryMetric", args: { metric: "rotacion", dimension: "bodega" } },
    ],
    sinTool: null,
    concordancia: { estado: "unsupported", campos: ["inmovilizado", "rows[role='peer']", "rows[role='avg']", "quickWinK", "estructuralK"],
      razon: "el capital y la rotación del foco concuerdan con `queryMetric{capital|rotacion, bodega}` del mismo escenario. Lo que la evidencia declarada no entrega es la partición inmovilizado/sano, la elección del par, la fila de promedio ni los dos caminos que la pieza cuantifica. Y arrastra el límite ya declarado de la cara: TRANSFERIR entre bodegas no es evaluable mientras ningún SKU aparezca en más de una — por eso el título de la tarjeta estructural lo emite el motor (`caminoEstructural`) y no la vista" },
  },

  // ── EL RECIBO FRÍO · «no me creas, acá está la cuenta» ──────────────────────────────────────────────────────
  "comercial/otro/evidencia-recibo": {
    vista: "comercial", seccion: "otro", tipo: "lista", label: "El recibo de la cuenta · margen de un cliente",
    builder: "recibo:cliente", campo: "lines", universoCampo: "lines", entidadCampo: "focus",
    metrica: "margen", eje: "cliente", periodo: "año cerrado",
    universo: { kind: "seleccion", label: "las cuatro líneas de la cuenta de una entidad, cada una con su fuente", cierraCon: "venta − costo − carga = margen, cierra exacto por identidad" },
    comparacion: "benchmark", estatusDefault: "probado", estatusCampo: null, controles: [],
    evidencia: [{ tool: "entityRecord", args: { dimension: "cliente" } }],
    sinTool: null,
    concordancia: { estado: "unsupported", campos: ["limites"],
      razon: "las cuatro líneas y sus dos bases de comparación salen del mismo registro de la entidad que devuelve `entityRecord{cliente}`, y la cuenta cierra por identidad (los $ se derivan de venta × %, no de una segunda fuente). Lo que ninguna tool declara de sí misma es el bloque «Lo que esta cuenta NO afirma»: esos límites los deriva `capability` de lo que el dato permite —y hoy son dos: no hay serie mensual real por cliente, y no existe granularidad cliente×SKU—, no son una cifra que el ledger pueda contrastar" },
  },
  "capital/otro/evidencia-recibo-bodega": {
    vista: "capital", seccion: "otro", tipo: "lista", label: "El recibo de la cuenta · capital de una bodega",
    builder: "recibo:bodega", campo: "lines", universoCampo: "lines", entidadCampo: "focus",
    metrica: "capital", eje: "bodega", periodo: "foto de inventario a hoy",
    universo: { kind: "seleccion", label: "las tres líneas del capital de una bodega, cada una con su fuente", cierraCon: "capital sin alerta + stock en alerta = capital, cierra exacto por construcción" },
    comparacion: "promedio_cartera", estatusDefault: "probado", estatusCampo: null, controles: [],
    evidencia: [{ tool: "inventoryStatus", args: {}, focus: "frenado" }],
    sinTool: null,
    concordancia: { estado: "unsupported", campos: ["lines[label='Capital sin alerta']", "comparison", "limites"],
      razon: "el capital inmovilizado de la bodega es el mismo subconjunto que autoriza `inventoryStatus{focus:'frenado'}` y usa la misma definición canónica (en alerta o rotación < 2). Lo que la tool no emite es el COMPLEMENTO —el capital que sí rota, que esta pieza obtiene por resta—, ni la comparación contra el promedio de bodegas, ni los límites: no hay serie mensual de stock, así que la evolución del capital de una bodega no existe en el dato y la fecha de venta de cada SKU tampoco" },
  },

  // ── LA DECISIÓN PRIORIZADA · el foco de mayor $ en juego del turno ──────────────────────────────────────────
  "comercial/03/decision-accion": {
    vista: "comercial", seccion: "03", tipo: "veredicto", label: "La acción priorizada",
    builder: "decision", campo: "action", universoCampo: "factors", entidadCampo: "scope.entityLabel",
    metrica: null, eje: "cliente", periodo: "año cerrado",
    // el $ de la acción es el subtotal del detector top del turno, en dólares crudos: puede venir del margen no
    // capturado, de la carga sobre el target o del capital detenido. Ninguna métrica del registro lo cubre sola.
    unidad: "money", escala: "raw",
    unidadMotivo: "el monto de la acción es el subtotal del detector que quedó primero en el turno (margen, carga o capital) y esos tres viven en métricas distintas: el registro no tiene una sola fila que lo declare, y la escala es dólares crudos porque así los emite el detector",
    universo: { kind: "seleccion", label: "los focos del diagnose de este turno, ordenados por $; la acción es el primero", cierraCon: "el $ de la acción es el subtotal del foco top, verbatim del detector" },
    comparacion: "benchmark", estatusDefault: "indicado", estatusCampo: null, controles: [],
    evidencia: [{ tool: "diagnose", args: {}, focus: "margen" }],
    sinTool: null,
    concordancia: { estado: "unsupported", campos: ["action.text", "action.askLabel"],
      razon: "el IMPACTO cierra por construcción: es el `subtotal_usd` del foco top, tomado verbatim del mismo `composeSpecDiagnose` que envuelve la tool `diagnose` — las dos puntas no pueden emitir cifras distintas sin dejar de compilar. Lo que ninguna tool produce es la PRESCRIPCIÓN: «recuperar el margen que cede tal cuenta» es una plantilla de decisión del módulo (mesa.js), no una cifra del ledger. Y arrastra un límite de alcance declarado: cuando el turno nombra UNA entidad la acción sale de los focos de ESA entidad, y sólo con alcance global cae al foco top del portafolio" },
  },

  // ── LA PROYECCIÓN · el supuesto sobre el dato real. Dos entradas: un universo cada una ──────────────────────
  "comercial/otro/simulacion-supuesto": {
    vista: "comercial", seccion: "otro", tipo: "tabla", label: "La proyección · el supuesto sobre la venta",
    builder: "simulacion:comercial", campo: "projection", universoCampo: "projection",
    metrica: "ventas", eje: "cliente", periodo: "año cerrado · dato base, sin escenario",
    universo: { kind: "eje", label: "todas las filas del eje con su valor actual, su valor bajo el supuesto y su impacto", cierraCon: "impacto = supuesto − actual, fila por fila" },
    comparacion: null, estatusDefault: "indicado", estatusCampo: null,
    controles: ["metrica", "eje", "pct"],
    // LA EVIDENCIA NO ES `simulate`, Y ESO ES EL HALLAZGO. `simulate` exige el SUPUESTO (`transform`) y sin él
    // declina: el supuesto lo trae la pregunta del usuario, no la pantalla, así que sembrarlo acá con un valor fijo
    // le estaría dictando al motor una proyección que nadie pidió. Lo que SÍ se puede contrastar es la columna
    // «Actual», que debería ser la venta del escenario — y ahí es donde no cierra.
    evidencia: [{ tool: "queryMetric", args: { metric: "ventas", dimension: "cliente" } }],
    sinTool: null,
    // EL LÍMITE MÁS CARO DE ESTA SUPERFICIE, y no se ve en el cruce builder↔ledger porque el gate no consigue
    // establecer la escala de estas columnas (el builder emite el número sin su gemelo formateado): está medido
    // aparte, contra la venta oficial del escenario. `composeSpecSimulate` no declara `scenario`, así que el que
    // `runPlan` inyecta en toda call se descarta en silencio — el mismo defecto que la decisión 4 cerró en `gridTable`.
    concordancia: { estado: "divergent", campos: ["projection[].actual", "total.actual"], toolsQueNoReconcilian: ["queryMetric"],
      razon: "la columna «Actual» no es la venta que muestra la pantalla: `composeSpecSimulate` no declara el parámetro `scenario`, así que carga la fuente base y descarta el escenario del turno. Afirma $100.0M en los tres escenarios contra los $99.9M que devuelve `queryMetric{ventas, cliente}` en bonanza (0,1%), $92.8M en tensión (7,7%) y $81.1M en crisis (23,3%). El supuesto y el impacto se calculan sobre esa base, así que el desvío viaja a todas las columnas. La tool `simulate` no se declara como evidencia a propósito: exige el supuesto, que sólo trae la pregunta del usuario" },
  },
  "capital/otro/simulacion-capital": {
    vista: "capital", seccion: "otro", tipo: "tabla", label: "La proyección · el supuesto sobre el capital",
    builder: "simulacion:capital", campo: "projection", universoCampo: "projection",
    metrica: "capital", eje: "sku", periodo: "foto de inventario a hoy",
    universo: { kind: "eje", label: "todos los SKU con su capital actual, el capital bajo el supuesto y su impacto", cierraCon: "impacto = supuesto − actual, fila por fila" },
    comparacion: null, estatusDefault: "indicado", estatusCampo: null,
    controles: ["metrica", "eje", "pct"],
    evidencia: [{ tool: "queryMetric", args: { metric: "capital", dimension: "sku" } }],
    sinTool: null,
    concordancia: { estado: "unsupported", campos: ["projection[].supuesto", "total.supuesto"],
      razon: "el capital actual por SKU coincide hoy con el que devuelve `queryMetric{capital, sku}` ($135.0K de total en los tres escenarios), pero por una coincidencia del dato y no por contrato: esta proyección corre sobre la fuente base porque `composeSpecSimulate` no declara `scenario`, y el inventario de este tenant no se mueve entre escenarios. El día que se mueva, la columna «Actual» dejará de ser la de la pantalla sin que nada avise — es el mismo defecto que en la proyección de venta ya se mide en 23,3%. Lo que además ninguna tool afirma es el SUPUESTO: es una proyección declarada, no un dato observado, y nace en esta pieza" },
  },
};

// ── ÍNDICE INVERSO tool(+focus) → componentId ──────────────────────────────────────────────────────────────────
// Es la tabla que traduce "qué tools corrió este turno" → "qué componente de Sentrix lo demuestra". Se CONSTRUYE
// del manifiesto (nunca se hardcodea en address.js): una tool nueva sin componente cae al default y el gate lo
// reporta como cobertura faltante, sin romper nada. La primera declaración gana; los choques se exponen para el
// gate en vez de resolverse en silencio.
//
// TRES NIVELES DE PRECISIÓN, del más específico al más grueso — y el más grueso SE ABSTIENE cuando no alcanza:
//   1. tool + focus            (`diagnose` con foco carga ≠ `diagnose` con foco margen)
//   2. tool + metric/dimension (`queryMetric` de capital por SKU ≠ `queryMetric` de ventas por cliente)
//   3. tool sola — SÓLO si todos los componentes que la declaran viven en la MISMA vista. Si la tool cruza vistas,
//      devuelve null en vez de adivinar: mandar a la cara Comercial una respuesta de inventario (que es lo que
//      hacía "la primera declaración gana") es peor que no ofrecer botón. La abstención cae al default honesto.
// Los componentes de tipo "vista" NO entran al índice: son el contexto AMBIENTE de la pantalla, no la evidencia de
// una afirmación. Si entraran, `<vista>/otro/vista` le ganaría a la pieza que de verdad demuestra la cifra.
const _porTool = new Map();
for (const [componentId, m] of Object.entries(VIEW_MANIFEST)) {
  if (m.tipo === "vista") continue;
  for (const ev of (m.evidencia || [])) {
    if (!ev || !ev.tool) continue;
    if (!_porTool.has(ev.tool)) _porTool.set(ev.tool, []);
    _porTool.get(ev.tool).push({
      componentId, vista: m.vista,
      focus: ev.focus || null,
      metric: (ev.args && ev.args.metric) || null,
      dimension: (ev.args && ev.args.dimension) || null,
    });
  }
}
export function componentIdForTool(tool, focus = null, args = null) {
  if (!tool) return null;
  const list = _porTool.get(tool);
  if (!list || !list.length) return null;
  if (focus) { const hit = list.find((x) => x.focus === focus); if (hit) return hit.componentId; }
  if (args && typeof args === "object") {
    const met = args.metric || null, dim = args.dimension || null;
    if (met || dim) {
      const exacto = list.find((x) => (!met || x.metric === met) && (!dim || x.dimension === dim) && (x.metric || x.dimension));
      if (exacto) return exacto.componentId;
    }
  }
  // sin focus ni args que desambigüen: sólo se resuelve si la tool NO cruza vistas.
  const vistas = new Set(list.map((x) => x.vista));
  if (vistas.size > 1) return null;
  const sinFocus = list.find((x) => !x.focus);
  return (sinFocus || list[0]).componentId;
}
// La lista de tools que NECESITAN focus/args para resolverse (cruzan vistas). No es un error: es la cobertura
// declarada del índice, y el gate la afirma explícitamente en vez de dejarla como sorpresa en producción.
export function toolIndexConflicts() {
  const out = [];
  for (const [tool, list] of _porTool) {
    const vistas = [...new Set(list.map((x) => x.vista))];
    if (vistas.length > 1) out.push({ tool, vistas, componentes: list.map((x) => x.componentId) });
  }
  return out;
}
// Qué tools del oráculo TIENEN componente declarado. Lo consume el gate para reportar cobertura faltante.
export function toolsConComponente() { return [..._porTool.keys()].sort(); }

// ── EL ESTADO DE CONCORDANCIA · lectura (decisión 11) ──────────────────────────────────────────────────────────
// Tres accesos, uno por pregunta, para que ningún consumidor tenga que interpretar el estado por su cuenta:
//   · `concordanciaDe`  el registro completo. NUNCA null para un componente declarado — si lo fuera, es un bug del
//                       manifiesto y el gate de cobertura lo caza antes de que llegue a producción.
//   · `divergenciaDe`   la forma legacy `{motivo, campos, toolsQueNoReconcilian}` SÓLO cuando el estado es
//                       `divergent`. Es la pregunta "¿hay un desacuerdo NUMÉRICO declarado acá?", que es distinta de
//                       "¿hay algo que declarar?": un `unsupported` no es una cifra que no cierra, es una cifra que
//                       no existe, y contarlo como divergencia declarada volvería vacío el candado del gate.
//   · `limiteDeclarado` la frase que ADI tiene que decir cuando esa cifra no cierre: vale para los DOS estados que
//                       no son `reconciled`, porque en los dos hay algo que el usuario merece oír.
const _CONC_VACIA = { estado: "unsupported", razon: "componente sin `concordancia` declarada en el manifiesto", campos: [] };
export function concordanciaDe(componentId) {
  const m = typeof componentId === "string" ? VIEW_MANIFEST[componentId] : componentId;
  if (!m) return null;
  return m.concordancia || _CONC_VACIA;
}
export function divergenciaDe(componentId) {
  const c = concordanciaDe(componentId);
  if (!c || c.estado !== "divergent") return null;
  return { motivo: c.razon, campos: c.campos || [], toolsQueNoReconcilian: c.toolsQueNoReconcilian || [] };
}
export function limiteDeclarado(componentId) {
  const c = concordanciaDe(componentId);
  return c && c.estado !== "reconciled" && c.razon ? c.razon : null;
}

// ── HELPERS de lectura del manifiesto (puros, sin estado) ──────────────────────────────────────────────────────
// `builderKeyOf` es la ÚNICA respuesta a «¿qué salida hay que construir para derivar el contexto de esta pieza?».
// Un componente de una cara la hereda de su vista; uno de nivel 2 la declara. Sin este helper cada gate volvía a
// escribir su propio mapa vista→builder, que es como las dos puntas se desincronizan.
export function builderKeyOf(componentId) {
  const m = typeof componentId === "string" ? VIEW_MANIFEST[componentId] : componentId;
  if (!m) return null;
  return m.builder || m.vista;
}
export function builderSpecOf(componentId) {
  const k = builderKeyOf(componentId);
  return k ? (SUPERFICIE_BUILDERS[k] || VIEW_BUILDERS[k] || null) : null;
}
// Los componentes de NIVEL 2: los que ADI abre. Se derivan de que declaren `builder` propio — no hay una segunda
// lista que mantener al día, y una superficie nueva entra sola en cuanto declara el suyo.
export function componentIdsNivel2() { return Object.keys(VIEW_MANIFEST).filter((id) => !!VIEW_MANIFEST[id].builder); }
export function manifestFor(componentId) { return VIEW_MANIFEST[componentId] || null; }
export function componentIds() { return Object.keys(VIEW_MANIFEST); }
export function componentIdsForVista(vista) { return Object.keys(VIEW_MANIFEST).filter((id) => VIEW_MANIFEST[id].vista === vista); }
// el componentId de "la vista entera" — el contexto que viaja cuando el usuario escribe SIN haber tocado nada
// puntual (requisito 2 del owner: ADI recibe el contexto aunque no se haya pulsado un CTA).
export function vistaComponentId(vista) { return VIEW_MANIFEST[`${vista}/otro/vista`] ? `${vista}/otro/vista` : null; }
