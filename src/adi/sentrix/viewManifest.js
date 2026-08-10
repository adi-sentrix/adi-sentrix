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
};

// ── LOS BUILDERS · una entrada por cara. `fn` se importa PEREZOSAMENTE (el gate y quien derive ya tienen el
//    builder en la mano; este mapa existe para que el gate sepa QUÉ correr para verificar cada `campo`). ────────
export const VIEW_BUILDERS = {
  comercial: { modulo: "src/adi/sentrix/resumenComercial.js", fn: "buildResumenComercial", scenarioAware: true, args: "(scenario, {maxEntidades})" },
  capital:   { modulo: "src/adi/sentrix/mesaCapital.js",      fn: "buildMesaCapital",      scenarioAware: true, args: "(scenario)" },
  resultado: { modulo: "src/adi/sentrix/mesaResultado.js",    fn: "buildMesaResultado",    scenarioAware: true, args: "(scenario, cuadroEje, cascadaFoco)" },
  ficha:     { modulo: "src/adi/sentrix/reading.js",          fn: "buildReadingFromSignals", scenarioAware: true, args: "(signals)" },
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
    universo: { kind: "estado", label: "los SKU con capital detenido", cierraCon: "diagnoseInventario" },
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
    universo: { kind: "estado", label: "supuestos declarados sobre el capital detenido", cierraCon: null },
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
export function manifestFor(componentId) { return VIEW_MANIFEST[componentId] || null; }
export function componentIds() { return Object.keys(VIEW_MANIFEST); }
export function componentIdsForVista(vista) { return Object.keys(VIEW_MANIFEST).filter((id) => VIEW_MANIFEST[id].vista === vista); }
// el componentId de "la vista entera" — el contexto que viaja cuando el usuario escribe SIN haber tocado nada
// puntual (requisito 2 del owner: ADI recibe el contexto aunque no se haya pulsado un CTA).
export function vistaComponentId(vista) { return VIEW_MANIFEST[`${vista}/otro/vista`] ? `${vista}/otro/vista` : null; }
