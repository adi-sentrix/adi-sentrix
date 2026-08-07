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
// ══ POLÍTICA DE PRESENTACIÓN (owner 2026-08-07) ════════════════════════════════════════════════════════════════
// NO es un booleano global "tablas sí / tablas no". La tabla es una decisión de PRESENTACIÓN del turno, y tiene
// tres estados — el guard valida EL QUE SE DECIDIÓ, no una prohibición general:
//   · forbidden  consulta general de perfil ("Falabella"): el detalle no viajó, tabular lo que queda sería
//                reconstruirlo con MENOS información que la Ficha. Se bloquea la tabla.
//   · required   el usuario pidió explícitamente una tabla, la serie mes a mes o un desglose tabular. Acá la
//                tabla es OBLIGATORIA: responder en prosa una pregunta que pidió tabla también es incumplir.
//   · auto       el resto — comparaciones y listados donde la tabla mejora la lectura. Decide el narrador con
//                los detectores de forma que ya existían (_needsTableFormat); el guard no juzga.
// Pedido EXPLÍCITO de tabla: la forma se nombra ("en una tabla", "tabulá", "en formato tabla", "en columnas").
const _PIDE_TABLA = /\b(en (?:una )?tabla|en formato tabla|tabulad[oa]|tabul[aá]\w*|en columnas|como tabla|arm[aá]\w* una tabla|una tabla con)\b/i;
export function pideTablaExplicita(text) { return _PIDE_TABLA.test(String(text || "")); }

// resolveTablePolicy({text, podado}) → "forbidden" | "required" | "auto"
// PRECEDENCIA: `required` gana sobre `forbidden`. Si el usuario pidió la tabla, la pidió — aunque el turno sea un
// perfil general y solo queden las cifras de cabecera: se le tabula lo que hay, no se le niega lo que pidió.
export function resolveTablePolicy({ text = "", podado = [] } = {}) {
  if (pideTablaExplicita(text) || pideDetalleTemporal(text) || pideDetalleComposicion(text)) return "required";
  if (podado.length) return "forbidden";
  return "auto";
}

// ── SALIDA DETERMINÍSTICA EN PROSA · sin otra llamada al LLM ───────────────────────────────────────────────────
// Si el narrador arma una tabla donde no está permitida, NO se reintenta: reintentar cuesta otra llamada y el
// problema no es de suerte, es de forma. Se compone la respuesta desde los claims YA autorizados, en prosa, con
// el mismo arco qué pasa / por qué / qué hacer primero. Cada cifra sale VERBATIM del claim, así que este texto
// pasa guardC por construcción — no hay ninguna cifra que no estuviera autorizada.
// Respeta la Regla de Proporcionalidad: nombra "tu benchmark" (nunca sectorial), dice "una causa comprobada"
// (nunca "la principal"), y no afirma rentabilidad.
const _M = (claims, re) => claims.find((c) => c && re.test(String(c.metrica || "")));
const _cap = (s) => (s ? String(s).charAt(0).toUpperCase() + String(s).slice(1) : s);
export function composeProsaEjecutiva(claims, { entidad = null, hayDetalleEnFicha = true } = {}) {
  const cs = (Array.isArray(claims) ? claims : []).filter(Boolean);
  const dueño = entidad || (cs.find((c) => c.sujetoTipo === "entidad") || {}).entidad || null;
  if (!dueño) return null;
  const míos = cs.filter((c) => c.entidad === dueño);
  if (!míos.length) return null;
  const ventas = _M(míos, /^ventas?\b/i), margen = _M(míos, /^margen$/i), contrib = _M(míos, /^contribuci[oó]n$/i);
  const rank = _M(míos, /^ranking por venta$/i), brecha = _M(míos, /brecha de margen/i);
  const bench = _M(cs, /^benchmark de margen$/i);
  const palanca = míos.find((c) => c.coberturaCausal === "parcial" && c.explica);
  const capital = míos.find((c) => /capital detenido/i.test(String(c.metrica || "")) && /subtotal/i.test(String(c.metrica || "")));

  const p = [];
  // QUÉ PASA
  const qué = [];
  if (ventas) qué.push(`${dueño} vendió ${ventas.valor}`);
  if (rank) qué.push(`y está ${rank.valor} por venta`);
  if (qué.length) p.push(_cap(qué.join(" ")) + ".");
  else if (contrib) p.push(`${dueño} aporta ${contrib.valor} de contribución.`);
  // POR QUÉ
  if (margen && bench && brecha) p.push(`Su margen es ${margen.valor}, ${brecha.valor} de brecha contra tu benchmark de ${bench.valor}.`);
  else if (margen) p.push(`Su margen es ${margen.valor}.`);
  // QUÉ HACER PRIMERO — la prioridad es una frase con su monto, nunca una tabla
  if (palanca) {
    const resto = palanca.explica.fraccion
      ? ` Explica ${palanca.explica.monto} de ${palanca.explica.universo} (${palanca.explica.fraccion}); el resto permanece abierto.`
      : " Es una parte comprobada; el resto de la brecha permanece abierto.";
    // artículo: las métricas de palanca son sustantivos ("exceso de acciones comerciales", "capital detenido") —
    // sin "el/la" la frase queda agramatical ("es exceso de acciones comerciales").
    const m = String(palanca.metrica).toLowerCase();
    const art = /^(brecha|carga|meta|contribuci)/.test(m) ? "la" : "el";
    p.push(`Una causa comprobada es ${art} ${m}: ${palanca.valor}.${resto}`);
  }
  if (capital) p.push(`Además tenés ${capital.valor} de capital detenido en el inventario del mix que le vendés — es capital de tu negocio, no de ${dueño}.`);
  if (!p.length) return null;
  if (hayDetalleEnFicha) p.push(`El detalle está en la ficha de ${dueño} en Sentrix.`);
  return p.join(" ");
}

export function buildDisclosureInstruction({ podado = [], entidad = null } = {}) {
  if (!podado.length) return "";
  const quien = entidad ? `de ${entidad}` : "de esta entidad";
  return `DIVULGACIÓN PROGRESIVA — esta es una consulta GENERAL ${quien}: respondé QUÉ PASA, POR QUÉ y QUÉ HACER PRIMERO, en prosa ejecutiva. NO armes ninguna tabla: no tenés autorizado el detalle (${podado.join(" · ")}) porque el usuario no lo pidió, y ese detalle vive en la Ficha de Sentrix. La prioridad SÍ se nombra concreta y con su monto (eso es una frase, no una tabla). Cerrá ofreciendo la Ficha —"Ver ficha en Sentrix"— para el detalle, nunca prometiendo que "podés profundizar" sin decir dónde. Si el usuario después pide la evolución, el mes a mes o la composición, ahí sí se la traés.`;
}
