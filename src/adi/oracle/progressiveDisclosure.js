/* === src/adi/oracle/progressiveDisclosure.js · DIVULGACIÓN PROGRESIVA (owner 2026-08-07) =============
 * LA REGLA: ante una consulta GENERAL de una entidad ("Falabella", "perfil de Falabella", "¿cómo va
 * Falabella?"), ADI responde QUÉ PASA, POR QUÉ y QUÉ HACER PRIMERO — sin tablas de detalle. El detalle vive en la
 * Ficha de Sentrix, y la respuesta cierra con el enlace, no con la tabla.
 * Las tablas TEMPORALES aparecen SOLO si el usuario las pidió: "mes a mes", "evolución", "tendencia",
 * "comparación por período" o su equivalente semántico.
 *
 * DÓNDE SE RESUELVE — y por qué acá y no en la UI. Esconder la tabla en la interfaz no ahorra NADA: el costo ya se
 * pagó cuando la serie viajó al LLM. Esto corre ANTES del BATCH: las tools de detalle NO SE LLAMAN, así que sus
 * cifras nunca existen, nunca entran al ledger y nunca llegan al narrador. Medido sobre el turno real
 * "perfil de Falabella" (eje cliente): 134 cifras autorizadas → 16. La composición sola aportaba 85.
 *
 * QUÉ ES DETALLE Y QUÉ NO (el criterio, no una lista de tools):
 *   · DETALLE  · lo que se lee fila por fila: la serie mes a mes (13 filas), la composición por familia/SKU
 *                (85 cifras), el desglose SKU por SKU del capital. Eso es la Ficha.
 *   · LECTURA  · lo que responde qué pasa / por qué / qué hacer primero: las métricas de cabecera, la brecha
 *                contra la referencia, la palanca cuantificada y SU monto, el subtotal de capital y el SKU
 *                puntual que lo encabeza (la prioridad concreta NO es una tabla — es una frase con un número).
 *
 * APLICA A LOS CUATRO EJES (cliente, familia, marca, sku): el criterio es la FORMA de la consulta, no el eje.
 * Puro, sin estado, sin red — gate-testable como el resto de los detectores de este directorio.
 */

// ── ¿PIDIÓ LA SERIE TEMPORAL? ──────────────────────────────────────────────────────────────────────────────────
// No es una lista cerrada de frases: son las FAMILIAS de pedido temporal que el producto reconoce. Cubre la forma
// canónica ("mes a mes"), la nominal ("evolución", "tendencia", "trayectoria", "histórico", "serie"), la
// comparativa por período ("contra el año pasado", "vs el trimestre", "mes contra mes") y la coloquial
// ("cómo viene", "cómo venía", "en qué meses"). Un pedido temporal SIEMPRE nombra el tiempo de alguna de estas
// formas — si no lo nombra, no lo pidió, y ahí es donde entra la regla.
const _TEMPORAL = [
  /\bmes a mes\b|\bmes por mes\b|\bmes contra mes\b/i,
  /\bevoluci[oó]n\b|\bevolutivo\b|\btendencia\b|\btrayectoria\b|\bhist[oó]ric[oa]\b|\bserie\b/i,
  /\b(por|entre|contra|vs\.?)\s+(mes|meses|per[ií]odos?|trimestres?|semestres?|a[ñn]os?)\b/i,
  /\bcomparaci[oó]n\s+(por|entre)\s+(per[ií]odo|mes|trimestre|a[ñn]o)/i,
  /\b(mensual(?:es|mente)?|trimestral(?:es)?|interanual(?:es)?|estacional(?:idad)?)\b/i,
  /\b(a lo largo del|durante el|en el transcurso del)\s+(a[ñn]o|per[ií]odo|trimestre)\b/i,
  /\bc[oó]mo (?:viene|ven[ií]a|vino|evolucion[oó]|se movi[oó])\b/i,
  /\b(qu[eé]|cu[aá]l(?:es)?)\s+mes(?:es)?\b|\bmejor mes\b|\bpeor mes\b/i,
  // OJO sin `\b` inicial: en JavaScript `\b` es ASCII, así que NO reconoce la "ú" — con `\b[uú]ltimos` la frase
  // "últimos 6 meses" NO matcheaba (cazado en la prueba del detector). Mismo cuidado en el bloque de desglose.
  /[uú]ltimos?\s+(?:\d+\s+)?(?:meses|trimestres|a[ñn]os)/i,
  /\b(a[ñn]o (?:anterior|pasado)|mismo per[ií]odo)\b/i,
];
export function pideDetalleTemporal(text) {
  const t = String(text || "");
  return _TEMPORAL.some((re) => re.test(t));
}

// ── ¿PIDIÓ EL DESGLOSE? ────────────────────────────────────────────────────────────────────────────────────────
// La composición por familia/SKU y el desglose del capital SKU por SKU son la Ficha. Solo viajan si se piden.
const _DESGLOSE = [
  // sin `\b` de cierre donde la palabra puede terminar en vocal acentuada ("desglosá", "abrí"): `\b` es ASCII y
  // no cierra después de "á"/"í", así que esas formas imperativas —las que un usuario escribe de verdad— fallaban.
  /\bcomposici[oó]n|\bdesglos|\bdetalle\b|\bdetallad|\babrir\b|\babr[íi]/i,
  /\bqu[eé]\s+(?:productos?|sku|familias?|marcas?|categor[ií]as?)\b/i,
  /\bpor\s+(?:familia|sku|producto|categor[ií]a|marca)\b/i,
  /\bqu[eé]\s+(?:me\s+)?(?:compra|vende|lleva)\b/i,
  /\bmix\b|\bcanasta\b/i,
];
export function pideDetalleComposicion(text) {
  const t = String(text || "");
  return _DESGLOSE.some((re) => re.test(t));
}

// ── ¿ES UNA CONSULTA GENERAL DE ENTIDAD? ───────────────────────────────────────────────────────────────────────
// La señal es del PLAN, no del texto: el turno resolvió `entityProfile` para UNA entidad. Ese es exactamente el
// turno "contame de X" — el plan ya hizo la comprensión, acá no se vuelve a adivinar. Si el usuario pidió una
// métrica puntual el plan resuelve queryMetric/marginRead, no entityProfile, y esta regla no toca ese turno.
export function esConsultaGeneralDeEntidad(plan) {
  const calls = plan && Array.isArray(plan.calls) ? plan.calls : [];
  const ep = calls.find((c) => c && c.tool === "entityProfile");
  if (!ep) return null;
  const entity = ep.entity || (ep.args && ep.args.entity) || null;
  const dimension = ep.dimension || (ep.args && ep.args.dimension) || null;
  return entity ? { entity, dimension } : null;
}

// ── LA PODA · ANTES DEL BATCH ──────────────────────────────────────────────────────────────────────────────────
// Devuelve el plan sin las llamadas de DETALLE que el usuario no pidió, y la lista de lo que se podó (para que la
// respuesta pueda ofrecer la Ficha con honestidad: "esto está en la Ficha", no "no lo tengo").
// NUNCA poda si el usuario lo pidió, ni si el plan no es una consulta general de entidad.
export function podarPlanProgresivo(plan, text) {
  const general = esConsultaGeneralDeEntidad(plan);
  if (!general) return { plan, podado: [] };
  const quiereTemporal = pideDetalleTemporal(text);
  const quiereDesglose = pideDetalleComposicion(text);
  if (quiereTemporal && quiereDesglose) return { plan, podado: [] };
  const podado = [];
  const calls = plan.calls.filter((c) => {
    if (!c) return false;
    if (!quiereTemporal && c.tool === "trend") { podado.push("evolución mes a mes"); return false; }
    if (!quiereDesglose && c.tool === "entityComposicion") { podado.push("composición por familia y producto"); return false; }
    return true;
  });
  return { plan: { ...plan, calls }, podado, entidad: general.entity, eje: general.dimension };
}

// ── LA PODA · DESPUÉS DEL BATCH (cinturón y tirantes) ──────────────────────────────────────────────────────────
// El capital ligado NO se poda entero: su SUBTOTAL y el SKU que lo encabeza son el "qué hacer primero" (una frase
// con un número, no una tabla). Lo que se poda es el resto del desglose SKU por SKU — 9 cifras que solo se leen
// en la Ficha. Esto corre sobre el LEDGER, no sobre el texto: las cifras podadas dejan de estar autorizadas, así
// que el narrador no puede citarlas ni aunque quisiera (guardC las rechaza).
const _CAPITAL_DETALLE = /·\s*(unidades detenidas|d[ií]as sin venta)\s*$/i;
export function podarLedgerProgresivo(figs, { quiereDesglose = false } = {}) {
  const lista = Array.isArray(figs) ? figs : [];
  if (quiereDesglose) return { figs: lista, podadas: 0 };
  // se conserva el subtotal y el capital de CADA SKU (la prioridad se nombra con su monto); se van las columnas
  // que solo tienen sentido leídas en tabla.
  const out = lista.filter((f) => !(f && _CAPITAL_DETALLE.test(String(f.label || ""))));
  return { figs: out, podadas: lista.length - out.length };
}

// ── LO QUE LA RESPUESTA DEBE DECIR EN VEZ DE LA TABLA ──────────────────────────────────────────────────────────
// Instrucción de NIVEL DE TURNO: solo viaja cuando de verdad se podó algo. Nombra la Ficha como el lugar del
// detalle (no como una promesa vaga de "puedo profundizar"), y prohíbe explícitamente reconstruir la tabla.
export function buildDisclosureInstruction({ podado = [], entidad = null } = {}) {
  if (!podado.length) return "";
  const quien = entidad ? `de ${entidad}` : "de esta entidad";
  return `DIVULGACIÓN PROGRESIVA — esta es una consulta GENERAL ${quien}: respondé QUÉ PASA, POR QUÉ y QUÉ HACER PRIMERO, en prosa ejecutiva. NO armes ninguna tabla: no tenés autorizado el detalle (${podado.join(" · ")}) porque el usuario no lo pidió, y ese detalle vive en la Ficha de Sentrix. La prioridad SÍ se nombra concreta y con su monto (eso es una frase, no una tabla). Cerrá ofreciendo la Ficha —"Ver ficha en Sentrix"— para el detalle, nunca prometiendo que "podés profundizar" sin decir dónde. Si el usuario después pide la evolución, el mes a mes o la composición, ahí sí se la traés.`;
}
