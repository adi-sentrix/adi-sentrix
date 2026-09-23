/* === src/adi/conocimiento/piezas.js · LAS CUATRO PIEZAS QUE YA MIDEN, COMO BORRADOR (v0.2 §9, siembra 2) ═══════
 * «Sembralas con estado: "borrador" (sin firma), porque el owner todavía no validó el contenido. Y que el
 * candado demuestre que una pieza en borrador NO se sirve. Así queda probada la infraestructura y el gobierno
 * al mismo tiempo, sin adelantarse a su validación.»
 *
 * Las seis del documento (§9, siembra 2 — «las 6 que miden hoy»): CAU-01 · CAU-06 · CAU-03 · RSG-06 · MOV-05 ·
 * PRI-04. Esquema exacto de la Parte B §5 del documento. Quedan CUATRO piezas sembradas, no seis: RSG-06 y
 * MOV-05 se colapsaron dentro de CAU-06 el 2026-09-23 (defecto 4, ver más abajo) — medían exactamente lo mismo.
 * `estado: "borrador"` en las cuatro, ninguna con `firma`: el owner NO validó el enunciado todavía —
 * `_conocimiento_gate.mjs` prueba que ninguna se sirve así.
 *
 * ⚠️ CAU-03 se siembra DISTINTA de lo que el documento supuso (verificado antes de escribir, como pide el
 * encargo — «medí antes de afirmar, mostrá la sonda»): el documento la marca "existe hoy: sí" para el vencido
 * POR TRAMO de antigüedad. `src/adi/agente/playbooks/cobranza.js` (línea ~151) declara lo CONTRARIO como límite
 * textual: «no hay conducta de pago en el dato: ni retraso medio, ni antigüedad por tramos». El dato solo trae
 * "Saldo vencido" por cliente (un número, no un tramo). Por eso acá `existe_en_motor: false` y `decisivo: false`
 * — CAU-03 siempre mide «no se puede saber», honesto con lo que el dato realmente tiene, no con lo que el
 * documento supuso. Es una corrección de verificación, no una decisión de significado: se reporta al owner.
 *
 * ═══ CORRECCIÓN 2026-09-23 (owner, defecto 4) — «CAU-06 · RSG-06 · MOV-05 son la misma medición servida tres
 * veces» ═══════════════════════════════════════════════════════════════════════════════════════════════════════
 * Las tres piezas declaraban el MISMO predicado de pertinencia (`sku.frenado`) y el MISMO cálculo
 * (`skuFrenadoVsTopSeller`): una sola medición, servida como tres ítems casi idénticos por SKU (y, cuando el SKU
 * no está nombrado en la Respuesta, como tres líneas de agregado repetidas — ver `_ADI_FICHAS_VALIDACION_
 * CONOCIMIENTO.md` §"CAU-06 · RSG-06 · MOV-05"). Quedan colapsadas en UNA pieza (conserva el id CAU-06,
 * `alimenta: "causalidad"` — recomendación del owner: la medición reparte cobertura de exceso, que es causal;
 * las lecturas de riesgo (RSG-06) y de siguiente movimiento (MOV-05) viajan en el TEXTO de esta misma pieza, no
 * en `pertinencia`/`medicion` — esos campos no admiten una lista de "alimenta" sin convertirla en un cambio de
 * esquema que el owner no pidió). El cálculo ya distingue los dos casos por estado, así que cada estado sirve
 * la lectura que le corresponde, una sola vez:
 *   · "ocurre"    (SKU frenado Y entre los que más venden → cobertura) — `no_implica` carga la lectura de RIESGO
 *     (RSG-06: no está exigida contractualmente por ninguna cadena en particular, y no se toca sin confirmarlo)
 *     y es exactamente el estado donde MÁS hace falta frenar la conclusión de "liquídelo" (regla del defecto 1).
 *   · "no_ocurre" (SKU frenado Y fuera del ranking de venta → exceso) — `medicion.no_excluye` carga la lectura
 *     de SIGUIENTE MOVIMIENTO (MOV-05: liquidar por un canal que la cadena principal no vea como competencia
 *     directa de precio, sin dar por hecho que ese canal existe hoy ni que cueste menos de lo que libera — la
 *     CONTRAINDICACIÓN de MOV-05 sobre no tocar la cobertura no se pierde: ya vive en el "no_implica" del caso
 *     "ocurre" de arriba, que es justamente el SKU que MOV-05 pedía dejar quieto).
 * `RSG-06` y `MOV-05` YA NO se siembran como piezas propias — sus ids no aparecen más en `PIEZAS_CONOCIMIENTO`
 * ni en `piezaPorId`; el conocimiento que aportaban sigue completo, dentro de CAU-06.
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
    // === pieza colapsada 2026-09-23 (owner, defecto 4): antes CAU-06 · RSG-06 · MOV-05 — mismo predicado, mismo
    // cálculo (`skuFrenadoVsTopSeller`), tres ítems casi idénticos. Conserva el id CAU-06 y `alimenta:
    // "causalidad"`; las lecturas de riesgo (ex RSG-06) y de siguiente movimiento (ex MOV-05) viajan en el
    // enunciado y en `no_implica`/`medicion.no_excluye` — ver la nota completa en la cabecera del archivo. ===
    id: "CAU-06", version: 2, tipo: "senal", alimenta: "causalidad", etiqueta: ["B", "C"], grado: "usual",
    enunciado: "Cuando un SKU está frenado (capital inmovilizado), el oficio mira si ese SKU está entre los que más venden. Si lo está, el capital frenado es probablemente cobertura de nivel de servicio: las cadenas exigen ese nivel y multan la entrega incompleta, así que liquidarlo puede costar más de lo que libera, y el oficio sugiere dejarlo quieto. Si no vende, es más probable que sea exceso de compra, y ahí el oficio sugiere liquidarlo por un canal que la cadena principal no vea como competencia directa de precio.",
    sujeto: "sector",
    fuente: { tipo: "principio-del-oficio", detalle: "controller senior; validación owner + socio pendiente" },
    alcance: { ..._ALCANCE_BASE },
    fecha: "2026-09-23", vigencia: "2027-09-23", firma: null, estado: "borrador",
    no_implica: "No implica que esta cobertura esté exigida contractualmente por esta cadena en particular, ni que deba tocarse: liquidar un SKU de cobertura puede costar más de lo que libera. Confírmelo usted.",
    pertinencia: { todo: ["sku.frenado"] },
    medicion: {
      calculo: "skuFrenadoVsTopSeller", existe_en_motor: true, derivado_barato: true,
      por_entidad: "sku", comparador: "pertenece", referencia: "top_seller",
      decisivo: true,
      no_excluye: "que además haya un error de compra dentro del grupo de cobertura, y que liquidar este exceso por un canal alternativo cueste más de lo que libera (no hay hoy un canal alternativo confirmado)",
      insumos: ["SKU frenados (inventoryStatus focus frenado)", "SKU que más venden (inventoryStatus focus top_sellers)"],
    },
    efecto: { sobre: "causalidad", sentido: "orienta", condicion: "estado = ocurre o estado = no_ocurre" },
    // la CONTRAINDICACIÓN de la ex MOV-05 ("no tocar la cobertura") no se pierde: ya está en `no_implica` de
    // arriba, servido justo en el estado "ocurre" — que es el SKU que la contraindicación pedía dejar quieto.
    contraindicacion: { medicion: "sku.frenado y sku.top_seller — la cobertura, que no se toca" },
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
