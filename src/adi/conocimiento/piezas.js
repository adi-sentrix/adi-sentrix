/* === src/adi/conocimiento/piezas.js · LAS SEIS PIEZAS QUE YA MIDEN, COMO BORRADOR (v0.2 §9, siembra 2) ═══════════
 * «Sembralas con estado: "borrador" (sin firma), porque el owner todavía no validó el contenido. Y que el
 * candado demuestre que una pieza en borrador NO se sirve. Así queda probada la infraestructura y el gobierno
 * al mismo tiempo, sin adelantarse a su validación.»
 *
 * Las seis del documento (§9, siembra 2 — «las 6 que miden hoy»): CAU-01 · CAU-06 · CAU-03 · RSG-06 · MOV-05 ·
 * PRI-04. Esquema exacto de la Parte B §5 del documento. `estado: "borrador"` en las seis, ninguna con `firma`:
 * el owner NO validó el enunciado todavía — `_conocimiento_gate.mjs` prueba que ninguna se sirve así.
 *
 * ⚠️ CAU-03 se siembra DISTINTA de lo que el documento supuso (verificado antes de escribir, como pide el
 * encargo — «medí antes de afirmar, mostrá la sonda»): el documento la marca "existe hoy: sí" para el vencido
 * POR TRAMO de antigüedad. `src/adi/agente/playbooks/cobranza.js` (línea ~151) declara lo CONTRARIO como límite
 * textual: «no hay conducta de pago en el dato: ni retraso medio, ni antigüedad por tramos». El dato solo trae
 * "Saldo vencido" por cliente (un número, no un tramo). Por eso acá `existe_en_motor: false` y `decisivo: false`
 * — CAU-03 siempre mide «no se puede saber», honesto con lo que el dato realmente tiene, no con lo que el
 * documento supuso. Es una corrección de verificación, no una decisión de significado: se reporta al owner.
 *
 * Sin lógica: este archivo es DATA. `validarPieza.js` la audita antes de que cualquier otra cosa la use. */

const _ALCANCE_BASE = { sector: ["distribucion"], tipoProducto: "*", modeloComercial: ["cuentas_grandes", "comercios"], pais: "*", banda: "*" };

export const PIEZAS_CONOCIMIENTO = [
  {
    id: "CAU-01", version: 1, tipo: "senal", alimenta: "causalidad", etiqueta: ["B"], grado: "usual",
    enunciado: "Cuando una cuenta cadena está bajo el benchmark de margen, el oficio mira primero si su carga comercial (convenio, rappel, aporte publicitario, descuento logístico) pesa más que la del resto de la cartera.",
    sujeto: "sector",
    fuente: { tipo: "principio-del-oficio", detalle: "controller senior; validación owner + socio pendiente" },
    alcance: { ..._ALCANCE_BASE },
    fecha: "2026-09-23", vigencia: "2027-09-23", firma: null, estado: "borrador",
    no_implica: "No implica que la carga sea la causa del margen bajo: localiza dónde mirar primero, no explica por qué.",
    pertinencia: { todo: ["cuenta.bajo_benchmark"] },
    medicion: {
      calculo: "cargaCuentaVsResto", existe_en_motor: true, derivado_barato: true,
      por_entidad: "cuenta", comparador: "mayor", referencia: "promedio_resto",
      decisivo: true, no_excluye: "descuentos aplicados en el pago sin registrar (hipótesis de CAU-04, no sembrada todavía)",
      insumos: ["carga % por cuenta (descomposicionDeBrecha)", "carga % de las demás cuentas del mismo dato"],
    },
    efecto: { sobre: "causalidad", sentido: "orienta", condicion: "estado = ocurre" },
  },
  {
    id: "CAU-06", version: 1, tipo: "senal", alimenta: "causalidad", etiqueta: ["B"], grado: "usual",
    enunciado: "Cuando un SKU está frenado (capital inmovilizado), el oficio mira si ese SKU está entre los que más venden: si lo está, el capital frenado es probablemente cobertura de nivel de servicio; si no vende, es más probable que sea exceso de compra.",
    sujeto: "sector",
    fuente: { tipo: "principio-del-oficio", detalle: "controller senior; validación owner + socio pendiente" },
    alcance: { ..._ALCANCE_BASE },
    fecha: "2026-09-23", vigencia: "2027-09-23", firma: null, estado: "borrador",
    no_implica: "No afirma por qué se frenó: solo distingue cobertura de exceso por su posición en el ranking de venta.",
    pertinencia: { todo: ["sku.frenado"] },
    medicion: {
      calculo: "skuFrenadoVsTopSeller", existe_en_motor: true, derivado_barato: true,
      por_entidad: "sku", comparador: "pertenece", referencia: "top_seller",
      decisivo: true, no_excluye: "que además haya un error de compra dentro del grupo de cobertura",
      insumos: ["SKU frenados (inventoryStatus focus frenado)", "SKU que más venden (inventoryStatus focus top_sellers)"],
    },
    efecto: { sobre: "causalidad", sentido: "orienta", condicion: "estado = ocurre o estado = no_ocurre" },
  },
  {
    id: "CAU-03", version: 1, tipo: "senal", alimenta: "causalidad", etiqueta: ["B"], grado: "usual",
    enunciado: "Cuando una cuenta cadena tiene vencido, el oficio mira la antigüedad del vencido para orientar si es más probable que sea un documento en trámite (rechazo, retención, nota de crédito pendiente) o una disputa de cobranza real.",
    sujeto: "sector",
    fuente: { tipo: "principio-del-oficio", detalle: "controller senior; validación owner + socio pendiente" },
    alcance: { ..._ALCANCE_BASE },
    fecha: "2026-09-23", vigencia: "2027-09-23", firma: null, estado: "borrador",
    no_implica: "No afirma cuál de los dos es: la antigüedad orienta, no decide.",
    pertinencia: { todo: ["cuenta.vencido_positivo", "cuenta.en_respuesta"] },
    medicion: {
      // verificado, no supuesto (ver la nota de cabecera): el dato NO trae tramos de antigüedad — solo un saldo
      // vencido total por cliente. `existe_en_motor: false` es la verdad medida, no una copia del documento.
      calculo: "vencidoPorTramoDeAntiguedad", existe_en_motor: false, derivado_barato: false,
      por_entidad: "cuenta", comparador: "mayor", referencia: "tramo_corto_vs_largo",
      decisivo: false, no_excluye: "que sea documental Y disputa a la vez, en distintas facturas de la misma cuenta",
      insumos: ["vencido por tramo de antigüedad (NO existe en este dato — verificado en cobranza.js: «ni retraso medio, ni antigüedad por tramos»)"],
    },
    efecto: { sobre: "causalidad", sentido: "orienta", condicion: "nunca decide con este dato" },
  },
  {
    id: "RSG-06", version: 1, tipo: "senal", alimenta: "riesgos", etiqueta: ["C"], grado: "usual",
    enunciado: "Las cadenas exigen nivel de servicio y multan la entrega incompleta: parte del capital frenado en un distribuidor a cadenas es cobertura de ese nivel de servicio, no error de compra — liquidarlo puede costar más de lo que libera.",
    sujeto: "sector",
    fuente: { tipo: "principio-del-oficio", detalle: "controller senior; validación owner + socio pendiente" },
    alcance: { ..._ALCANCE_BASE },
    fecha: "2026-09-23", vigencia: "2027-09-23", firma: null, estado: "borrador",
    no_implica: "No implica que la cobertura esté exigida contractualmente por una cadena en particular: eso lo confirma usted.",
    pertinencia: { todo: ["sku.frenado"] },
    medicion: {
      // el MISMO cruce que CAU-06 (frenado × top seller): decisivo para la PARTICIÓN (cuánto es cobertura y
      // cuánto exceso), nunca para el motivo (por qué la cadena exige ese nivel de servicio).
      calculo: "skuFrenadoVsTopSeller", existe_en_motor: true, derivado_barato: true,
      por_entidad: "sku", comparador: "pertenece", referencia: "top_seller",
      decisivo: true, no_excluye: "que además haya exceso real dentro del grupo de cobertura",
      insumos: ["SKU frenados (inventoryStatus focus frenado)", "SKU que más venden (inventoryStatus focus top_sellers)"],
    },
    expectativa: "una parte del capital frenado, la que corresponde a SKU que más venden, es cobertura y no error de compra",
    condicion: "sku.frenado y sku.top_seller a la vez, en al menos un SKU",
  },
  {
    id: "MOV-05", version: 1, tipo: "senal", alimenta: "siguiente_movimiento", etiqueta: ["A", "C"], grado: "usual",
    enunciado: "Cuando hay SKU frenados que no están entre los que más venden, el oficio sugiere liquidar ese exceso por un canal que la cadena principal no vea como competencia directa de precio — y dejar quietos los SKU frenados que sí son cobertura de nivel de servicio.",
    sujeto: "sector",
    fuente: { tipo: "principio-del-oficio", detalle: "controller senior; validación owner + socio pendiente" },
    alcance: { ..._ALCANCE_BASE },
    fecha: "2026-09-23", vigencia: "2027-09-23", firma: null, estado: "borrador",
    no_implica: "No implica que exista hoy un canal alternativo disponible: eso lo evalúa usted.",
    pertinencia: { todo: ["sku.frenado"] },
    medicion: {
      calculo: "skuFrenadoVsTopSeller", existe_en_motor: true, derivado_barato: true,
      por_entidad: "sku", comparador: "pertenece", referencia: "top_seller",
      decisivo: true, no_excluye: "que liquidar por ese canal tenga un costo mayor al capital liberado",
      insumos: ["SKU frenados (inventoryStatus focus frenado)", "SKU que más venden (inventoryStatus focus top_sellers)"],
    },
    opcion: "liquidar el exceso (SKU frenados fuera del top de venta) por un canal que la cadena principal no vea como competencia",
    condicion: { medicion: "sku.frenado y no sku.top_seller — el exceso, con su capital" },
    contraindicacion: { medicion: "sku.frenado y sku.top_seller — la cobertura, que no se toca" },
  },
  {
    id: "PRI-04", version: 1, tipo: "senal", alimenta: "prioridades", etiqueta: ["B"], grado: "establecido",
    enunciado: "La participación de una cuenta en la venta y su participación en el vencido son dos cifras distintas. La segunda mide la exposición: una cuenta puede vender poco y deber desproporcionadamente, o vender mucho y deber poco.",
    sujeto: "sector",
    fuente: { tipo: "principio-del-oficio", detalle: "controller senior; validación owner + socio pendiente" },
    alcance: { ..._ALCANCE_BASE },
    fecha: "2026-09-23", vigencia: "2027-09-23", firma: null, estado: "borrador",
    no_implica: "No implica que la cuenta sea mala pagadora: la diferencia puede ser un plazo pactado más largo, o vencido documental en facturas puntuales.",
    pertinencia: { todo: ["cuenta.vencido_positivo", "cuenta.en_respuesta"] },
    medicion: {
      calculo: "participacionCruzada", existe_en_motor: false, derivado_barato: true,
      por_entidad: "cuenta", comparador: "mayor", lados: ["participacion_vencido", "participacion_venta"],
      decisivo: true, no_excluye: "vencido documental en facturas puntuales; que la diferencia sea un plazo pactado",
      insumos: ["vencido por cuenta (cobranza)", "venta por cuenta (comercial)", "vencido total de la cartera", "venta total de la cartera"],
    },
    efecto: { sobre: "prioridades", sentido: "agrava", condicion: "estado = ocurre" },
  },
];

/** piezaPorId(id) → la pieza, o null. */
export function piezaPorId(id) {
  return PIEZAS_CONOCIMIENTO.find((p) => p.id === id) || null;
}
