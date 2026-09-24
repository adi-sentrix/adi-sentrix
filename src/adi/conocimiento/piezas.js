/* === src/adi/conocimiento/piezas.js · LAS CUATRO PIEZAS QUE YA MIDEN, COMO BORRADOR (v0.2 §9, siembra 2) ═══════
 * «Sembralas con estado: "borrador" (sin firma), porque el owner todavía no validó el contenido. Y que el
 * candado demuestre que una pieza en borrador NO se sirve. Así queda probada la infraestructura y el gobierno
 * al mismo tiempo, sin adelantarse a su validación.»
 *
 * Las seis del documento (§9, siembra 2 — «las 6 que miden hoy»): CAU-01 · CAU-06 · CAU-03 · RSG-06 · MOV-05 ·
 * PRI-04. Esquema exacto de la Parte B §5 del documento. Quedan CUATRO piezas sembradas, no seis: RSG-06 y
 * MOV-05 se colapsaron dentro de CAU-06 el 2026-09-23 (defecto 4, ver más abajo) — medían exactamente lo mismo.
 * `estado: "borrador"` en las que el owner todavía no validó; PRI-04 FIRMADA por el owner el 2026-09-23 —
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
    // === CAU-01 · LA CARGA COMERCIAL DE LA CUENTA CONTRA EL RESTO DE LA CARTERA (owner 2026-09-23, diseño
    // aprobado — ver la cabecera de `medir.js:cargaCuentaVsResto`). Sigue sin firmar: `estado`/`firma` no se
    // tocan acá, esta actualización es de CONTENIDO (medición), la firma es del owner. Reemplaza el promedio
    // simple de porcentajes (`promedio_resto`, retirado — no es verificable: `hechos.js` no suma porcentajes)
    // por la TASA REAL PONDERADA del resto (carga $ del resto ÷ venta del resto), comparada contra el piso de
    // materialidad del Core (`pisoFocosUSD()`, el mismo que decide "Carga comercial alta"). Como PRI-04, ya
    // NUNCA mide "no_ocurre": el veredicto negativo es "bajo_piso" — afirma la diferencia y el piso, nunca "no
    // ocurre" (misma ley del diseño sellado de PRI-04, Aclaración 2). ===
    id: "CAU-01", version: 2, tipo: "senal", alimenta: "causalidad", etiqueta: ["B"], grado: "usual",
    // enunciado sin el paréntesis de ejemplos ni "más allá del piso de materialidad" (owner 2026-09-24, cierre
    // de presentación): el bloque de servicio ya declara el piso en su propia línea de cierre — repetirlo acá
    // era ruido. El encabezado del bloque se arma como "En {sector}, {enunciado en minúscula}" (servir.js).
    enunciado: "Cuando una cuenta cadena está bajo el benchmark de margen, el oficio mira primero si su carga comercial pesa más que la del resto de la cartera.",
    sujeto: "sector",
    fuente: { tipo: "principio-del-oficio", detalle: "controller senior; firmada por el owner 2026-09-24 (el principio es del oficio; el piso es el piso canónico de materialidad comercial del Core, criterio general de ADI, ajustable por la empresa)" },
    alcance: { ..._ALCANCE_BASE },
    fecha: "2026-09-23", vigencia: "2027-09-23",
    /* FIRMA DEL OWNER (2026-09-24), textual: «Firmo la pieza 2». Lo firmado: el resto de la cartera es la tasa
     * real ponderada; el piso es el piso canónico de materialidad comercial del Core (el mismo de la pestaña
     * Comercial); cada texto nombra su referencia; presentación en bloque y pertinencia por encargo (principal ·
     * mención · oferta). */
    firma: { por: "owner (jc)", fecha: "2026-09-24" }, estado: "firmada",
    // ═══ CORRECCIÓN 2026-09-24 (owner, cierre de presentación) — UNA sola oración de límite, no tres ═══════════
    // Antes: dos oraciones acá ("No implica…" + "Tampoco implica que una cuenta bajo el piso cargue poco…") más
    // una tercera servida aparte desde `medicion.no_excluye` ("Esto no excluye: descuentos…") — tres avisos por
    // bloque. La segunda oración ya la cubre la línea del piso (el bloque ya dice "Bajo el piso de ADI…"); la
    // tercera se funde ACÁ, en una sola oración, que es lo único que el bloque imprime (`servir.js`: el bloque
    // usa `pieza.no_implica` tal cual, ya no lo concatena con `medicion.no_excluye`). El texto también corrige
    // el defecto de raíz (owner): «hipótesis de CAU-04, no sembrada todavía» filtraba un id de pieza al usuario
    // — ya no se nombra ninguna pieza, ni sembrada ni hipotética.
    no_implica: "No implica que la carga sea la causa del margen bajo: indica dónde mirar primero; tampoco descarta descuentos aplicados en el pago que no quedaron registrados.",
    pertinencia: { todo: ["cuenta.bajo_benchmark"] },
    medicion: {
      calculo: "cargaCuentaVsResto", existe_en_motor: true, derivado_barato: true,
      por_entidad: "cuenta", comparador: "mayor", referencia: "tasa_ponderada_resto",
      decisivo: true, no_excluye: "descuentos aplicados en el pago que no quedaron registrados",
      insumos: [
        "carga % y venta por cuenta, propia y del resto de la cartera (descomposicionDeBrecha)",
        "venta y carga % de TODAS las demás cuentas de la cartera completa (nunca solo las bajo benchmark)",
        "piso de materialidad de focos comerciales (el mismo del detector del Core — specRetrieval.js:pisoFocosUSD)",
      ],
    },
    efecto: { sobre: "causalidad", sentido: "orienta", condicion: "estado = senal" },
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
    // === PRI-04 · EL PISO DE MATERIALIDAD DE COBRANZA (owner 2026-09-23, diseño SELLADO — cinco reglas; ver la
    // cabecera de `medir.js:pisoMaterialidadCobranza` y `config/contract/pisoMaterialidadCobranza.js`). Sigue
    // sin firmar: `estado`/`firma` no se tocan acá — esta actualización es de CONTENIDO (enunciado, no_implica,
    // medición), la firma es del owner. Reemplaza `participacionCruzada` (una comparación sin piso, retirada)
    // por el cálculo con umbral estructural: D_c = (participación en el vencido − participación en la venta) ×
    // vencido total, comparado contra k × saldo pendiente del universo evaluable. Ya NUNCA mide "no_ocurre"
    // (medir.js: `estadoFalso: "bajo_piso"`) — el veredicto negativo afirma la diferencia y el piso, nunca "no
    // ocurre" (Aclaración 2 del diseño: «nombrar la pregunta hace verdadero el "no"... la forma segura no
    // responde "no": afirma dos hechos»). ===
    id: "PRI-04", version: 2, tipo: "senal", alimenta: "prioridades", etiqueta: ["B"], grado: "establecido",
    // ═══ CORRECCIÓN 2026-09-24 (coordinador, con autorización expresa para tocar campos de una pieza FIRMADA —
    // «hacelo sin cambiar su significado… solo se une el texto de sus dos campos existentes») ═══════════════════
    // ANTES: enunciado en forma de PREGUNTA («¿Alguna cuenta pesa más…?»), distinto de la forma AFIRMATIVA de
    // las demás piezas — el encabezado del bloque quedaba desparejo (CAU-01 afirma, PRI-04 pregunta). AHORA: la
    // MISMA idea, en afirmación — el principio no cambia (participación en el vencido vs. participación en la
    // venta, la brecha localiza exposición), solo la forma gramatical. El encabezado del bloque antepone
    // "En {sector}, " (servir.js) — acá va solo la cláusula, igual que en CAU-01.
    /* ═══ owner 2026-09-24, textual: «Apruebo las dos decisiones» (ley ADI_CAJA_NO_ES_COBRANZA: caja ≠ cobranza;
     * solo la venta A CRÉDITO genera exposición, la de contado no) — cambio de BASE aprobado sobre esta pieza
     * FIRMADA: «la venta» pasa a «la venta a crédito» en el enunciado y en los insumos declarados. El principio,
     * el cálculo (`medir.js:pisoMaterialidadCobranza`) y el veredicto no cambian — solo la métrica contra la que
     * se mide la participación en venta, que ahora es la del mismo flujo de cobranza, nunca la venta comercial
     * total (que incluye ventas de contado, que no generan exposición). ═══ */
    enunciado: "el oficio compara la participación de cada cuenta en el vencido con su participación en la venta a crédito: una cuenta puede vender poco a crédito y deber mucho.",
    sujeto: "sector",
    fuente: { tipo: "principio-del-oficio", detalle: "controller senior; firmada por el owner 2026-09-23 (el principio es del oficio; el piso es criterio general de ADI, ajustable por la empresa)" },
    alcance: { ..._ALCANCE_BASE },
    fecha: "2026-09-23", vigencia: "2027-09-23",
    /* FIRMA DEL OWNER (2026-09-23), textual: «Sí, fírmala así». Lo firmado: (1) el principio —exposición ≠
     * participación— es del oficio y el piso es criterio de ADI, cada uno con su rótulo; (2) la pregunta del oficio
     * una vez arriba, las cuentas en el orden de prioridad que ya usa ADI, la cobertura al cierre; (3) la rama sin
     * señal se prueba con carteras de prueba, sin alterar el demo (`_piso_materialidad_gate`). */
    /* RECONFIRMACIÓN DEL OWNER (2026-09-24), textual: «reconfirmo la pieza 1 con su nueva redacción» — el
     * enunciado en afirmación, una sola oración de límite, y también en preguntas abiertas de cobranza. */
    firma: { por: "owner (jc)", fecha: "2026-09-23", reconfirmada: "2026-09-24" }, estado: "firmada",
    // ANTES: "No implica que la cuenta sea mala pagadora: la diferencia puede ser un plazo pactado más largo, o
    // vencido documental en facturas puntuales. Tampoco implica que una cuenta bajo el piso esté al día: el piso
    // mide si la desproporción es grande, no si el vencido existe." (dos oraciones; una tercera se sumaba aparte
    // desde `medicion.no_excluye` en el bloque viejo). AHORA: una sola oración — la segunda («Tampoco implica…
    // bajo el piso») la cubre la línea del piso del bloque, y su contenido YA está dentro de la primera oración
    // (plazo pactado / vencido documental) — unir los dos campos no agrega texto nuevo: `medicion.no_excluye`
    // (abajo) NO se toca, sigue declarado tal cual para quien lo consulte aparte; el bloque nuevo solo imprime
    // `no_implica`. Cero cambio de significado: mismo principio, misma salvaguarda, sin la repetición.
    no_implica: "No implica que la cuenta sea mala pagadora: la diferencia puede ser un plazo pactado más largo o vencido documental en facturas puntuales.",
    // ═══ CORRECCIÓN 2026-09-24 (owner, pertinencia por encargo) — textual: «Sí, apruebo la regla y el cambio en
    // preguntas abiertas.» ═══════════════════════════════════════════════════════════════════════════════════════
    // ÚNICO cambio sobre PRI-04 firmada (ver la cabecera de esta pieza, arriba): ni el enunciado, ni `no_implica`,
    // ni `medicion` (el cálculo, el veredicto) se tocan — solo se agrega una TERCERA rama a la pertinencia (cuándo
    // se enciende). Con sujeto abierto (el usuario no nombró ninguna cuenta — `pregunta.sujeto_abierto`) y encargo
    // de cobranza (`pregunta.tema_cobranza`), PRI-04 se sirve como principal con TODAS sus señales, aunque el
    // procedimiento no haya nombrado (`cuenta.en_respuesta`) una cuenta con vencido positivo. Antes de esta rama,
    // una pregunta genuinamente abierta de cobranza podía dejar PRI-04 sin encender si el procedimiento nombraba
    // solo cuentas al día — la exposición de cobranza no puede desaparecer con un sujeto vacío (regla del diseño,
    // ejemplo C: «la cobranza NO desaparece con sujeto vacío»). Las dos ramas originales (arriba) no cambian.
    pertinencia: {
      alguno: [
        { todo: ["cuenta.vencido_positivo", "cuenta.en_respuesta"] },
        { todo: ["cuenta.sin_plazo_declarado", "cuenta.en_respuesta"] },
        { todo: ["pregunta.tema_cobranza", "pregunta.sujeto_abierto"] },
      ],
    },
    medicion: {
      calculo: "pisoMaterialidadCobranza", existe_en_motor: false, derivado_barato: true,
      por_entidad: "cuenta",
      decisivo: true, no_excluye: "vencido documental en facturas puntuales; que la diferencia sea un plazo pactado",
      insumos: [
        "vencido por cuenta (cobranza)", "venta a crédito por cuenta (cobranza)",
        "vencido total del universo evaluable (cuentas con plazo de pago declarado)",
        "venta a crédito y saldo pendiente del universo evaluable",
        "piso de materialidad (criterio de ADI, o declarado por la empresa — config/contract/pisoMaterialidadCobranza.js)",
      ],
    },
    efecto: { sobre: "prioridades", sentido: "agrava", condicion: "estado = ocurre" },
  },
];

/** piezaPorId(id) → la pieza, o null. */
export function piezaPorId(id) {
  return PIEZAS_CONOCIMIENTO.find((p) => p.id === id) || null;
}
