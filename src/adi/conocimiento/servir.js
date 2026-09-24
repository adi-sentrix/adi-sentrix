/* === src/adi/conocimiento/servir.js · LAS TRES FORMAS FIJAS DE SERVICIO (Business Knowledge v0.2, Parte A §1) ═══
 * «La forma es fija, para que resista la paráfrasis.» Tres plantillas de la casa, con placeholders — la
 * referencia se RENDERIZA, no se redacta (mismo principio que la prosa anclada del Notario v3). Este módulo no
 * decide nada: solo arma el texto de la pieza+entidad YA medida por `medir.js`.
 *
 *   ocurre          → «El oficio mira X. En [entidad] está ocurriendo: [cifra] contra [referencia] (medido).
 *                      [no_implica de la pieza, ya escrito como "No implica que…"]»
 *   no_ocurre       → «El oficio mira X. ADI lo midió y no está ocurriendo en [entidad]: [cifra] contra
 *                      [referencia]. Esto no excluye: …»
 *   indeterminable  → «El oficio mira X. Con estos datos no se puede saber: [motivo]. Lo resolvería: [resolveria].»
 *
 * Sujeto de la pieza siempre "el oficio" + el sector declarado — nunca el nombre de la empresa. La MEDICIÓN
 * (la parte «en Lider…») es la única que nombra la entidad — regla del documento: «la pieza tiene por sujeto al
 * sector, la medición a la empresa, y la frase puente la escribe la casa».
 *
 * ═══ CORRECCIÓN 2026-09-23 (owner, defecto 1) — «el "no implica" que ustedes escriban no llega al usuario» ═══════
 * Hay dos negativas distintas y las dos son legítimas: `pieza.no_implica` es sobre el CONOCIMIENTO («que el
 * oficio diga que mires acá no implica que esta sea la causa») y `medicion.no_excluye` es sobre ESTA MEDICIÓN
 * («que no esté ocurriendo no descarta X»). La versión anterior servía SIEMPRE `medicion.no_excluye` bajo el
 * rótulo «No implica:», también en "ocurre" — la salvaguarda que el owner firma (`pieza.no_implica`) nunca
 * llegaba al usuario. Ahora cada veredicto sirve la negativa que le corresponde, una sola por ítem: "ocurre" →
 * `pieza.no_implica`; "no_ocurre" → `medicion.no_excluye` (el descarte — para que no suene a tranquilidad
 * total). "indeterminable" no cambia: motivo + resolvería.
 *
 * Las dos negativas se redactan distinto y NO se combinan con el mismo conector: `pieza.no_implica` se escribe
 * como oración completa, exactamente como en el documento (§1: «No implica que sea la causa del margen.») — se
 * sirve TAL CUAL, sin agregarle un rótulo "No implica:" por delante (eso duplicaría la frase: "No implica: No
 * implica que…"). `medicion.no_excluye` se escribe como frase nominal («descuentos aplicados…») y sí necesita el
 * rótulo fijo "Esto no excluye:" para leerse como oración.
 *
 * ═══ CORRECCIÓN 2026-09-23 (owner, cierre de CAU-01) — «cero ruido: la pregunta del oficio UNA vez, el "no
 * implica" UNA vez» ═══════════════════════════════════════════════════════════════════════════════════════════
 * Con una sola pieza sirviendo UNA entidad, el encabezado ("El oficio mira: …") y la negativa nunca se repetían.
 * Con DOS piezas firmadas y una Entrega que nombra VARIAS cuentas de la misma pieza (CAU-01 en 3+ cuentas bajo
 * benchmark, por ejemplo), cada ítem servido volvía a imprimir el mismo encabezado y la misma negativa — el
 * defecto que el owner cerró para PRI-04 («la pregunta del oficio una vez arriba») se veía roto apenas una pieza
 * tenía más de una entidad pertinente. `servirPieza` ahora acepta `{ incluirEncabezado, incluirNegativa }`
 * (default `true` los dos — el comportamiento de siempre, byte-idéntico para una pieza con una sola entidad
 * servida) para que el LLAMADOR (`seleccionar.js`, tras acotadores) decida, por pieza, cuál de los ítems
 * servidos lleva el encabezado y cuáles negativas ya se sirvieron — sin tocar `acotadores.js` ni tocar el orden
 * ni el contenido de lo que cada cuenta mide. El texto devuelve además `negativaTexto` (la negativa exacta que
 * ESTE ítem aportaría, o `null`) para que el llamador sepa si ya la vio. */
const _SECTOR_TXT = { distribucion: "distribución", fabricacion: "fabricación", minorista: "minorista", servicios: "servicios", obras: "obras" };
/* el nombre de cada procedencia, EXACTO al de `notario/hechos.js:NOMBRE_DE_PROCEDENCIA` — declarado acá en vez
 * de importado a propósito: `conocimiento/` no depende de `notario/` para texto de prosa (solo `medir.js` lo
 * hace, para VERIFICAR). Un candado (`_piso_materialidad_gate.mjs`) compara los dos textos. `medicion.procedencia`
 * es `null` para todo cálculo que no lo declare (CAU-01/CAU-06/CAU-03) — el texto cae a "medido", byte-idéntico
 * a como servía este archivo antes de esta corrección (owner 2026-09-23, PRI-04: una cifra derivada o estimada
 * nunca puede decir "(medido)" — la verdad es cifra + dueño + significado, CLAUDE.md §2). */
const _NOMBRE_DE_PROCEDENCIA = { medido: "medido", derivado: "derivado", estimacion_referencia: "estimación contra referencia", supuesto_usuario: "supuesto del usuario", propuesta: "propuesta" };
const _procTxt = (medicion) => (medicion.procedencia && _NOMBRE_DE_PROCEDENCIA[medicion.procedencia]) || "medido";
const _bordeTxt = (medicion) => (medicion.borde === true ? " Esta cuenta queda al borde del piso: con un criterio algo más exigente o más laxo cambiaría de lado." : "");

function _sectorDe(pieza) {
  const s = pieza && pieza.alcance && pieza.alcance.sector;
  const lista = Array.isArray(s) ? s : s ? [s] : [];
  if (!lista.length || lista[0] === "*") return "el sector";
  return lista.map((x) => _SECTOR_TXT[x] || x).join(" y ");
}

/** servirPieza(pieza, entidad, medicion, { incluirEncabezado, incluirNegativa }) → { texto, fuente, alcance,
 *  fecha, vigencia, firma, hechoId, negativaTexto } | null
 *  Nunca sirve si `pieza.estado !== "firmada"` (candado del gate — ver `seleccionar.js`, que es quien filtra
 *  ANTES de llegar acá; este módulo no vuelve a chequear el gobierno, solo redacta con la forma fija).
 *  `incluirEncabezado`/`incluirNegativa` (default `true` los dos): el llamador los pone en `false` para no
 *  repetir el encabezado o una negativa ya servida por OTRO ítem de la misma pieza en la misma sección (ver la
 *  corrección 2026-09-23 en la cabecera). `negativaTexto` siempre se devuelve (aunque `incluirNegativa` sea
 *  `false`) para que el llamador sepa cuál negativa "vio" este ítem. */
export function servirPieza(pieza, entidad, medicion, { incluirEncabezado = true, incluirNegativa = true } = {}) {
  if (!pieza || !medicion) return null;
  const sector = _sectorDe(pieza);
  const encabezado = incluirEncabezado ? `El oficio mira: ${pieza.enunciado} (en ${sector}). ` : "";
  let cuerpo = "";
  let hechoId = null;
  let negativaTexto = null;

  if (medicion.estado === "ocurre") {
    const cifraTxt = medicion.cifra ? medicion.cifra.texto : "(cifra no disponible)";
    const refTxt = medicion.referencia && medicion.referencia.texto ? medicion.referencia.texto : null;
    // el "no implica" que se sirve en "ocurre" es el de la PIEZA (el conocimiento), no el de la medición — ver
    // corrección 2026-09-23 en la cabecera de este archivo. Se sirve TAL CUAL (ya es una oración completa, "No
    // implica que…" — igual que el ejemplo del documento): agregarle el rótulo "No implica:" la duplicaría.
    const noImplica = typeof pieza.no_implica === "string" && pieza.no_implica.trim() ? pieza.no_implica.trim() : null;
    negativaTexto = noImplica;
    cuerpo = `En ${entidad} está ocurriendo: ${cifraTxt}${refTxt ? ` contra ${refTxt}` : ""} (${_procTxt(medicion)}).${_bordeTxt(medicion)}${(incluirNegativa && noImplica) ? ` ${noImplica}` : ""}`;
    hechoId = medicion.cifra ? medicion.cifra.id : null;
  } else if (medicion.estado === "senal" || medicion.estado === "bajo_piso") {
    // ★ PRI-04/CAU-01 (owner 2026-09-23, Aclaración 2 del diseño sellado, corregido en la segunda vuelta): las
    // TRES partes fijas, en orden, TAMBIÉN para señal — hecho con cifra · piso con su dueño (ADI) · veredicto. El
    // veredicto negativo ("bajo_piso") NUNCA niega un hecho: afirma que la diferencia existe, con su cifra, y
    // muestra el piso. No hay ningún "no" que un anfitrión pueda podar; y en el libro de hechos no existe un
    // hecho "diferencia = 0", así que "no ocurre" no tiene dueño (regla estructural, no un veto léxico).
    // `medicion.cifra.texto` YA nombra la entidad y la dirección de la diferencia (medir.js la construye, con
    // magnitud siempre positiva) — esta forma NO antepone "En {entidad}" para no duplicarlo. Y NO agrega la
    // procedencia entre paréntesis: «piso de ADI» / «declarado por tu empresa» ya declara quién lo puso — la
    // jerga de procedencia ("estimación contra referencia") no llega al usuario en esta pieza (queda solo como
    // dato estructural en `medicion.procedencia`, nunca "medido").
    const cifraTxt = medicion.cifra ? medicion.cifra.texto : "(cifra no disponible)";
    const refTxt = medicion.referencia && medicion.referencia.texto ? medicion.referencia.texto : null;
    const veredictoTxt = medicion.estado === "senal" ? "señal" : "bajo el piso";
    negativaTexto = medicion.estado === "senal"
      ? (typeof pieza.no_implica === "string" && pieza.no_implica.trim() ? pieza.no_implica.trim() : null)
      : (medicion.noExcluye ? `Esto no excluye: ${medicion.noExcluye}.` : null);
    const negativa = (incluirNegativa && negativaTexto) ? ` ${negativaTexto}` : "";
    cuerpo = `${cifraTxt}${refTxt ? ` ${refTxt}` : ""} Veredicto: ${veredictoTxt}.${_bordeTxt(medicion)}${negativa}`;
    hechoId = medicion.cifra ? medicion.cifra.id : null;
  } else if (medicion.estado === "no_ocurre") {
    const cifraTxt = medicion.cifra ? medicion.cifra.texto : "(cifra no disponible)";
    const refTxt = medicion.referencia && medicion.referencia.texto ? medicion.referencia.texto : null;
    negativaTexto = medicion.noExcluye ? `Esto no excluye: ${medicion.noExcluye}.` : null;
    cuerpo = `ADI lo midió: en ${entidad} NO está ocurriendo: ${cifraTxt}${refTxt ? ` contra ${refTxt}` : ""}.${(incluirNegativa && negativaTexto) ? ` ${negativaTexto}` : ""}`;
    hechoId = medicion.cifra ? medicion.cifra.id : null;
  } else {
    cuerpo = `Con estos datos no se puede saber en ${entidad}: falta ${medicion.motivo || "el insumo necesario"}.${medicion.resolveria ? ` Lo resolvería: ${medicion.resolveria}.` : ""}`;
    hechoId = null;
  }

  return {
    texto: `${encabezado}${cuerpo}`,
    fuente: pieza.fuente || null,
    alcance: pieza.alcance || null,
    fecha: pieza.fecha || null,
    vigencia: pieza.vigencia || null,
    firma: pieza.firma || null,
    piezaId: pieza.id,
    entidad,
    estado: medicion.estado,
    hechoId,
    negativaTexto,
  };
}

/* ═══ EL BLOQUE, POR PIEZA CON VEREDICTO SEÑAL/BAJO_PISO (owner 2026-09-24, cierre de presentación de CAU-01)
 * ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
 * El listado por ítem (`servirPieza` + `acotadores.js`) sirve bien a CAU-06/CAU-03 (estados "ocurre"/
 * "no_ocurre", pocas entidades pertinentes por turno), pero para una pieza que mide TODA la cartera bajo un
 * mismo criterio —señal/bajo_piso, PRI-04 y CAU-01— el owner encontró tres defectos reales en la muestra en
 * vivo: (1) una SEÑAL (lo material) podía quedar escondida en la línea de "no entraron por espacio" — nunca
 * aceptable; (2) el id interno de la pieza ("(CAU-01)") se filtraba al texto del usuario; (3) redacción
 * robótica ("El oficio mira: Cuando…", paréntesis colgando).
 *
 * La forma nueva, UN bloque por pieza, nunca cortado por `acotadores.js` (bypassa ese pipeline entero — ver
 * `seleccionar.js:_BLOQUE_POR_CALCULO`): encabezado (una vez, lenguaje de negocio) → una línea POR CADA señal,
 * siempre, con nombre → una línea con las cuentas bajo el piso (primero las que tienen exceso, con "al borde"
 * si corresponde; después las que cargan/pesan menos, agrupadas) → el "no implica" (una vez) → el cierre
 * (piso + cobertura, ya armado por `coberturaCargaVsResto`/`coberturaPisoDeCobranza`). Cada cifra sigue siendo
 * la que ya verificó `medir.js` — este módulo solo redacta, nunca inventa un número: lee `medicion.partes`
 * (crudo, sin parsear texto) para cada cuenta. */
const _minuscula = (s) => { const t = String(s || "").trim(); return t ? t.charAt(0).toLowerCase() + t.slice(1) : t; };
function _headerDeBloque(pieza) {
  const sector = _sectorDe(pieza);
  const e = String(pieza.enunciado || "").trim();
  // una pregunta ("¿…?") no se empalma en minúscula tras una coma — se dos-puntea, tal cual, para que se lea
  // como pregunta y no como una frase mal cortada. Owner 2026-09-24: las piezas del catálogo hoy afirman, no
  // preguntan (PRI-04 se unificó); esta rama queda por si una futura pieza sí lo hace.
  return e.startsWith("¿") ? `En ${sector}: ${e}` : `En ${sector}, ${_minuscula(e)}`;
}
/* ═══ REINSTALADA 2026-09-24 (owner, corrección tras revisión: «abierta → todas las SEÑALES, no todas las
 * cuentas») ═══════════════════════════════════════════════════════════════════════════════════════════════════
 * Se había retirado esta línea (ver el historial: «una cuenta bajo el piso fuera del sujeto desaparece por
 * completo, solo cuenta en el cierre») porque el ejemplo A/B del diseño no la muestra — CORRECTO para esos dos
 * (sujeto cerrado, sin pregunta abierta). Pero el ejemplo C (pregunta ABIERTA) sí la necesita: el diseño dice
 * «todas las SEÑALES completas», no «todas las cuentas» — una cuenta bajo el piso que no es del sujeto sigue
 * agrupándose por nombre (con monto y "al borde" si corresponde la que tiene exceso; solo por nombre la que
 * carga/pesa menos), tal como esta línea ya lo hacía antes del rediseño. La diferencia con el comportamiento
 * PRE-rediseño: acá SOLO se agrupa cuando la pregunta es abierta (`abierta`) — sin pregunta abierta y sin
 * sujeto, la cuenta bajo el piso sigue desapareciendo de la prosa (queda solo en el conteo del cierre, como en
 * A/B) — ver el bucle de `servirBloqueCargaVsResto`/`servirBloquePisoDeCobranza` más abajo. */
/* "A, B y C" — la coordinación de la casa (nunca "A, B, y C" con coma antes de "y"). */
const _listaConY = (arr) => (arr.length <= 1 ? (arr[0] || "") : `${arr.slice(0, -1).join(", ")} y ${arr[arr.length - 1]}`);
/* la línea única de "bajo el piso" (fuera del sujeto, con pregunta abierta): primero las que tienen exceso (con
 * "al borde" si corresponde), separadas por punto y coma de las que cargan/pesan menos (agrupadas, sin repetir
 * cifra — la cifra es lo que las hace señal o borde; cargar menos no tiene "exceso" que mostrar, owner
 * 2026-09-23). `null` si no hay ninguna cuenta en esa situación (el bloque simplemente no trae esta línea). */
function _lineaBajoPiso(conExceso, sinExceso, pisoDe, verboMenosSing, verboMenosPlural) {
  const partes = [];
  if (conExceso.length) partes.push(`Bajo ${pisoDe}: ${conExceso.join(", ")}`);
  if (sinExceso.length) {
    const verbo = sinExceso.length === 1 ? verboMenosSing : verboMenosPlural;
    const frase = `${_listaConY(sinExceso)} ${verbo}`;
    partes.push(conExceso.length ? `; ${frase}` : frase.charAt(0).toUpperCase() + frase.slice(1));
  }
  if (!partes.length) return null;
  return `${partes.join("")}.`;
}
/* la oración de límite ÚNICA del bloque (owner 2026-09-24, defecto 2 — «tres avisos por bloque»): el campo
 * `pieza.no_implica` YA es la oración completa que se sirve, tal cual, sin concatenar `medicion.no_excluye` —
 * lo que antes agregaba una tercera oración ahora vive DENTRO de `no_implica` (una decisión de contenido, en
 * `piezas.js`, no de este módulo: acá solo se imprime UNA vez). */
const _oracionDeLimite = (pieza) => (typeof pieza.no_implica === "string" && pieza.no_implica.trim()) ? pieza.no_implica.trim() : null;
/* ═══ REDISEÑO 2026-09-24 (owner, pertinencia por encargo) — SUJETO + ABIERTA reemplazan NOMBRADAS + RESPONDE-LA-
 * PREGUNTA ═══════════════════════════════════════════════════════════════════════════════════════════════════
 * Esta función solo se llama para una pieza que YA es "principal" (su dominio ES el del encargo — lo decide el
 * LLAMADOR, `seleccionar.js`, antes de invocar el bloque; una pieza de OTRO dominio nunca llega acá, se sirve
 * como mención/oferta — ver `servirMencion*`/`servirOferta*` más abajo). Dentro de una pieza principal:
 *   · CADA CUENTA DEL SUJETO (las que el USUARIO nombró en la pregunta + las que nombra el PROCEDIMIENTO —
 *     `seleccionar.js` arma el Set) lleva línea completa, SIEMPRE — incluso bajo el piso, incluso si carga/pesa
 *     menos que el resto (antes: solo una cuenta "señal" tenía chance de línea completa; una cuenta bajo el piso
 *     nunca se individualizaba, quedaba agrupada — regla nueva del diseño, ejemplo "Jumbo: 3.8%… en esta cuenta
 *     la carga no pesa más.").
 *   · PREGUNTA ABIERTA (el usuario no nombró ninguna cuenta — `abierta`, ver `tabla.pregunta.sujetoAbierto`) →
 *     TODAS las señales del dominio van completas, en el orden del procedimiento (nadie queda compactado).
 *   · el resto (señal fuera del sujeto, con pregunta NO abierta) → compactado por nombre y monto (nunca oculto). */
function _despliegaCompleta(entidad, sujeto, abierta) {
  return abierta || sujeto.has(entidad);
}

/** servirBloqueCargaVsResto(pieza, porEntidad, cierreTexto, opts) → { texto, ... } | null — el bloque de CAU-01,
 *  para una pieza ya decidida PRINCIPAL por el llamador (ver la nota de `_despliegaCompleta` arriba).
 *  `porEntidad`: Map(entidad → medicion), en el orden natural de la cartera (`medir.js:resultadosCargaVsResto`).
 *  `cierreTexto`: el texto YA armado por `medir.js:coberturaCargaVsResto` (piso + cobertura, una sola verdad —
 *  este módulo no lo recalcula). `opts.sujeto` (Set, default vacío — las cuentas del usuario + del procedimiento)
 *  y `opts.abierta` (boolean, default `true` — sin opciones, desplegar todo; el llamador real, `seleccionar.js`,
 *  siempre las pasa explícitas). `null` si no hay ninguna medición con `.partes` (defensivo: nada que redactar). */
export function servirBloqueCargaVsResto(pieza, porEntidad, cierreTexto, { sujeto = new Set(), abierta = true } = {}) {
  if (!pieza || !porEntidad || !porEntidad.size || !cierreTexto) return null;
  const señalLineas = [];
  const señalesCompactas = [];
  const conExceso = [];
  const sinExceso = [];
  let pisoDe = null;
  for (const [entidad, m] of porEntidad) {
    if (!m || !m.partes) continue;
    const p = m.partes;
    if (pisoDe == null) pisoDe = p.declaradoPorLaEmpresa ? "el piso declarado por tu empresa" : "el piso de ADI";
    if (m.estado === "senal") {
      // ★ owner 2026-09-24 (corrección de la corrección) — "pregunta abierta → todas las SEÑALES completas" es
      // literal del diseño: solo señales, nunca cuentas bajo el piso (ver la rama de abajo). Acá `abierta` SÍ
      // amplía el despliegue completo, como siempre.
      if (_despliegaCompleta(entidad, sujeto, abierta)) {
        /* «$X sobre el piso ($Y)» se leía como si superara el piso POR $X: el monto es la diferencia contra el resto,
         * y el piso se nombra aparte («supera»), nunca como punto de partida del monto (supervisor 2026-09-24). */
        señalLineas.push(`${entidad}: ${p.propio} de su venta en carga comercial contra ${p.resto} del resto de la cartera; ${p.puntos}, ${p.monto} por encima del resto; supera ${pisoDe} (${p.pisoTexto}). Señal.`);
      } else {
        señalesCompactas.push(`${entidad} (${p.monto})`);
      }
    } else if (m.estado === "bajo_piso") {
      // ═══ owner 2026-09-24 (segunda corrección tras revisión: «abierta → todas las SEÑALES, no todas las
      // cuentas» — «en una pregunta abierta, ninguna cuenta bajo el piso lleva línea completa») ═══════════════
      // Las DOS reglas del diseño son alternativas, no acumulables: "cada cuenta del sujeto lleva línea
      // completa, incluso bajo el piso" describe la pregunta CERRADA (sujeto real — ejemplo A/B); "pregunta
      // abierta → todas las SEÑALES completas" es la regla de la pregunta ABIERTA, y ahí NINGUNA cuenta bajo el
      // piso se individualiza — ni siquiera una que el procedimiento haya nombrado para OTRO dominio (ejemplo C:
      // Lider es sujeto por ser líder de cobranza, pero en el bloque de CARGA es bajo el piso y NO sujeto de
      // carga — va agrupada, igual que Falabella en el bloque de cobranza). Por eso `abierta` decide primero:
      // solo SIN pregunta abierta un miembro del sujeto individualiza su bajo-piso; con pregunta abierta, toda
      // cuenta bajo el piso va a la línea agrupada (con nombre y monto la que tiene exceso, agrupada por nombre
      // la que carga menos) — nunca oculta, nunca cortada, nunca la MISMA información dos veces.
      if (!abierta && sujeto.has(entidad)) {
        if (p.sentido === "mas") {
          señalLineas.push(`${entidad}: ${p.propio} de su venta en carga comercial contra ${p.resto} del resto de la cartera; ${p.puntos}, ${p.monto} por encima del resto; bajo ${pisoDe} (${p.pisoTexto})${m.borde ? ", al borde" : ""}.`);
        } else {
          señalLineas.push(`${entidad}: ${p.propio} de su venta en carga comercial contra ${p.resto} del resto de la cartera; ${p.monto} menos que el resto: en esta cuenta la carga no pesa más.`);
        }
      } else if (abierta) {
        if (p.sentido === "mas") conExceso.push(`${entidad} (${p.monto} por encima del resto${m.borde ? ", al borde" : ""})`);
        else sinExceso.push(entidad);
      }
    }
  }
  if (!señalLineas.length && !señalesCompactas.length && !conExceso.length && !sinExceso.length) return null;
  const señalCompactaLinea = señalesCompactas.length
    ? `Fuera de ${sujeto.size === 1 ? "la nombrada" : "las nombradas"}, también ${señalesCompactas.length === 1 ? "supera" : "superan"} ${pisoDe}: ${señalesCompactas.join(", ")}.`
    : null;
  const bajoPisoLinea = pisoDe ? _lineaBajoPiso(conExceso, sinExceso, pisoDe, "carga menos que el resto de la cartera", "cargan menos que el resto de la cartera") : null;
  const negativa = _oracionDeLimite(pieza);
  const texto = [_headerDeBloque(pieza), ...señalLineas, señalCompactaLinea, bajoPisoLinea, negativa, cierreTexto].filter((s) => s && s.trim()).join(" ");
  return { texto, piezaId: pieza.id, fuente: pieza.fuente || null, alcance: pieza.alcance || null, fecha: pieza.fecha || null, vigencia: pieza.vigencia || null, firma: pieza.firma || null, estado: "bloque" };
}

/** servirBloquePisoDeCobranza(pieza, porEntidad, cierreTexto, opts) → { texto, ... } | null — el bloque de
 *  PRI-04, la MISMA forma que `servirBloqueCargaVsResto` (ver la cabecera de arriba), con el vocabulario propio
 *  de PRI-04 (participación en el vencido vs. en la venta — "pesa", no "carga"). `porEntidad`:
 *  `medir.js:resultadosPisoDeCobranza`. `opts` igual que en `servirBloqueCargaVsResto`. Sin cambiar ningún
 *  veredicto ni la pertinencia sellada de PRI-04. */
export function servirBloquePisoDeCobranza(pieza, porEntidad, cierreTexto, { sujeto = new Set(), abierta = true } = {}) {
  if (!pieza || !porEntidad || !porEntidad.size || !cierreTexto) return null;
  const señalLineas = [];
  const señalesCompactas = [];
  const conExceso = [];
  const sinExceso = [];
  let pisoDe = null;
  for (const [entidad, m] of porEntidad) {
    if (!m || !m.partes) continue;
    const p = m.partes;
    if (pisoDe == null) pisoDe = p.declaradoPorLaEmpresa ? "el piso declarado por tu empresa" : "el piso de ADI";
    if (m.estado === "senal") {
      if (_despliegaCompleta(entidad, sujeto, abierta)) {
        señalLineas.push(`${entidad}: ${p.propio} del vencido contra ${p.resto} de la venta; ${p.puntos}, ${p.monto} de diferencia; supera ${pisoDe} (${p.pisoTexto}). Señal.`);
      } else {
        señalesCompactas.push(`${entidad} (${p.monto})`);
      }
    } else if (m.estado === "bajo_piso") {
      // ═══ owner 2026-09-24 (segunda corrección tras revisión) — ver la nota gemela en
      // servirBloqueCargaVsResto: las dos reglas son alternativas, no acumulables — con pregunta abierta,
      // NINGUNA cuenta bajo el piso individualiza (ni siquiera una del sujeto de OTRO dominio, como Falabella
      // -líder de comercial- en el bloque de cobranza del ejemplo C); solo sin pregunta abierta un miembro del
      // sujeto individualiza su bajo-piso. ═══
      if (!abierta && sujeto.has(entidad)) {
        if (p.sentido === "mas") {
          señalLineas.push(`${entidad}: ${p.propio} del vencido contra ${p.resto} de la venta; ${p.puntos}, ${p.monto} de diferencia; bajo ${pisoDe} (${p.pisoTexto})${m.borde ? ", al borde" : ""}.`);
        } else {
          señalLineas.push(`${entidad}: ${p.propio} del vencido contra ${p.resto} de la venta; ${p.monto} de diferencia a su favor: en esta cuenta no pesa más en el vencido.`);
        }
      } else if (abierta) {
        if (p.sentido === "mas") conExceso.push(`${entidad} (${p.monto} de diferencia${m.borde ? ", al borde" : ""})`);
        else sinExceso.push(entidad);
      }
    }
  }
  if (!señalLineas.length && !señalesCompactas.length && !conExceso.length && !sinExceso.length) return null;
  const señalCompactaLinea = señalesCompactas.length
    ? `Fuera de ${sujeto.size === 1 ? "la nombrada" : "las nombradas"}, también ${señalesCompactas.length === 1 ? "supera" : "superan"} ${pisoDe}: ${señalesCompactas.join(", ")}.`
    : null;
  const bajoPisoLinea = pisoDe ? _lineaBajoPiso(conExceso, sinExceso, pisoDe, "pesa menos en el vencido que en la venta", "pesan menos en el vencido que en la venta") : null;
  const negativa = _oracionDeLimite(pieza);
  const texto = [_headerDeBloque(pieza), ...señalLineas, señalCompactaLinea, bajoPisoLinea, negativa, cierreTexto].filter((s) => s && s.trim()).join(" ");
  return { texto, piezaId: pieza.id, fuente: pieza.fuente || null, alcance: pieza.alcance || null, fecha: pieza.fecha || null, vigencia: pieza.vigencia || null, firma: pieza.firma || null, estado: "bloque" };
}

/* ═══ MENCIÓN Y OFERTA — LA PIEZA DE OTRO DOMINIO (owner 2026-09-24, pertinencia por encargo) ═══════════════════
 * Cuando el dominio de la pieza NO es el del encargo (`seleccionar.js` ya lo decidió antes de llamar acá: estas
 * funciones nunca se invocan para una pieza principal), el diseño sellado separa dos cosas, nunca combinadas:
 *   · MENCIÓN — una sola oración por cuenta (nombre + cifra), SIN encabezado de bloque ni cierre (piso/cobertura):
 *     solo sobre cuentas que el USUARIO nombró en la pregunta (`nombradas` = `entidadesDeLaPregunta`, NUNCA las
 *     que solo nombra el procedimiento — esa es la diferencia con `sujeto`, que sí las incluye para el bloque
 *     principal). Cierra con el "no implica" de la pieza, una vez.
 *   · OFERTA — EXACTAMENTE una por pieza, para «Qué más puedo calcular»: cuenta el resto de las señales (las que
 *     la mención no cubrió) con una cifra-gancho VERIFICADA (`medicion.cifra`, el mismo hecho que ya certificó
 *     `libroDeHechos` — nunca un número nuevo) y una cola de conteo. `gancho.hechoId` es lo que un futuro enlace
 *     real podría citar; hoy es solo texto (ver `componer.js`: se funde en `queMasPuedoCalcular`, un menú sin
 *     verificación numérica hasta hoy — con esto, cada oferta SÍ trae una cifra dueña).
 * Ninguna señal se repite entre bloque/mención/oferta: la mención toma las cuentas nombradas por el usuario, la
 * oferta cuenta las DEMÁS (nunca las mismas dos veces — `excluir`, el mismo Set que ya usó la mención). */
export const introDeMencion = (tabla) => {
  const met = (tabla && tabla.pregunta && tabla.pregunta.metricas) || [];
  if (met.includes("margen")) return "Aparte del margen";
  if (met.includes("carga")) return "Aparte de la carga comercial";
  if (met.includes("plazos")) return "Aparte de los plazos";
  const dom = (tabla && tabla.pregunta && tabla.pregunta.temas) || [];
  if (dom.includes("comercial")) return "Aparte de lo comercial";
  if (dom.includes("inventario")) return "Aparte del inventario";
  if (dom.includes("cobranza")) return "Aparte de la cobranza";
  return "Además";
};

/** servirMencionCargaVsResto(pieza, porEntidad, { nombradas, intro }) → { texto, ... } | null — la mención breve
 *  de CAU-01 cuando su dominio (comercial) NO es el del encargo. Solo señales ("estado === senal") sobre cuentas
 *  nombradas por el USUARIO — una bajo el piso no es una señal digna de mención fuera de su dominio (el diseño
 *  la reserva para el bloque principal o el conteo del cierre). `intro`: el encabezado corto ("Aparte de…"),
 *  calculado por el llamador sobre `tabla.pregunta` — `introDeMencion`. */
export function servirMencionCargaVsResto(pieza, porEntidad, { nombradas = new Set(), intro = "Además" } = {}) {
  if (!pieza || !porEntidad || !porEntidad.size || !nombradas.size) return null;
  const clausulas = [];
  for (const [entidad, m] of porEntidad) {
    if (!m || !m.partes || m.estado !== "senal" || !nombradas.has(entidad)) continue;
    const p = m.partes;
    const pisoDe = p.declaradoPorLaEmpresa ? "el piso declarado por tu empresa" : "el piso de ADI";
    clausulas.push(`${entidad} carga más en comercial que el resto de la cartera — ${p.propio} contra ${p.resto} del resto; ${p.puntos}, ${p.monto} por encima del resto; supera ${pisoDe} (${p.pisoTexto})`);
  }
  if (!clausulas.length) return null;
  const negativa = _oracionDeLimite(pieza);
  const texto = [`${intro}: ${clausulas.join("; ")}.`, negativa].filter((s) => s && s.trim()).join(" ");
  return { texto, piezaId: pieza.id, fuente: pieza.fuente || null, alcance: pieza.alcance || null, fecha: pieza.fecha || null, vigencia: pieza.vigencia || null, firma: pieza.firma || null, estado: "mencion" };
}

/** servirMencionPisoDeCobranza — la gemela de arriba, vocabulario de PRI-04 (vencido vs. venta). */
export function servirMencionPisoDeCobranza(pieza, porEntidad, { nombradas = new Set(), intro = "Además" } = {}) {
  if (!pieza || !porEntidad || !porEntidad.size || !nombradas.size) return null;
  const clausulas = [];
  for (const [entidad, m] of porEntidad) {
    if (!m || !m.partes || m.estado !== "senal" || !nombradas.has(entidad)) continue;
    const p = m.partes;
    const pisoDe = p.declaradoPorLaEmpresa ? "el piso declarado por tu empresa" : "el piso de ADI";
    clausulas.push(`${entidad} pesa más en el vencido que en la venta — ${p.propio} del vencido contra ${p.resto} de la venta; ${p.puntos}, ${p.monto} de diferencia; supera ${pisoDe} (${p.pisoTexto})`);
  }
  if (!clausulas.length) return null;
  const negativa = _oracionDeLimite(pieza);
  const texto = [`${intro}: ${clausulas.join("; ")}.`, negativa].filter((s) => s && s.trim()).join(" ");
  return { texto, piezaId: pieza.id, fuente: pieza.fuente || null, alcance: pieza.alcance || null, fecha: pieza.fecha || null, vigencia: pieza.vigencia || null, firma: pieza.firma || null, estado: "mencion" };
}

/** servirOfertaCargaVsResto(pieza, porEntidad) → { piezaId, dominio, texto, gancho, cola } | null — EXACTAMENTE
 *  una oferta por pieza (documento §5), con TODAS las señales de la pieza este turno — el conteo/exposición es un
 *  RESUMEN de la pieza entera, no una repetición del detalle que ya vio una mención (owner 2026-09-24: medido
 *  contra el ejemplo A del diseño — la oferta de cobranza cuenta las 5 señales del turno, Lider incluida, aunque
 *  Lider ya tenga su propia mención — «exactamente uno» rige el DETALLE individual, no el conteo agregado).
 *  `gancho` es un hecho YA verificado (`medicion.cifra`, de `medir.js` — nunca un número que esta capa calcule);
 *  `cola` cuenta señal/bajo el piso del universo bajo benchmark que YA midió `porEntidad` (owner 2026-09-24,
 *  corrección tras revisión: «la oferta miente por omisión sin su cola» — estructural, tamaños de lista, ningún
 *  dígito reparseado de texto). Con 3 cuentas o menos, el cuerpo nombra cada señal con su monto (igual que la
 *  línea compacta del bloque); con más, se resume al conteo — nunca una lista que empuje el techo de la sección. */
export function servirOfertaCargaVsResto(pieza, porEntidad) {
  if (!pieza || !porEntidad || !porEntidad.size) return null;
  const señales = [];
  let nBajoPiso = 0;
  for (const [entidad, m] of porEntidad) {
    if (!m || !m.partes) continue;
    if (m.estado === "senal") señales.push({ entidad, m });
    else if (m.estado === "bajo_piso") nBajoPiso++;
  }
  if (!señales.length) return null;
  const pisoDe = señales[0].m.partes.declaradoPorLaEmpresa ? "el piso declarado por tu empresa" : "el piso de ADI";
  const n = señales.length;
  /* la cola sin repetir el conteo de señales ya dicho (y el verbo concuerda con n: «1 cuenta supera»). */
  const verbo = n === 1 ? "cuenta supera" : "cuentas superan";
  const cuerpo = n <= 3
    ? `La carga comercial contra el resto de la cartera: ${n} ${verbo} ${pisoDe} (${señales.map(({ entidad, m }) => `${entidad} ${m.partes.monto}`).join(", ")} por encima del resto)`
    : `La carga comercial contra el resto de la cartera: ${n} ${verbo} ${pisoDe}`;
  const texto = nBajoPiso ? `${cuerpo}; ${nBajoPiso} más bajo el benchmark quedan bajo el piso.` : `${cuerpo}.`;
  const top = señales[0].m.cifra;
  return { piezaId: pieza.id, dominio: "comercial", texto, gancho: { hechoId: top ? top.id : null, texto: top ? top.texto : null }, cola: { n, nBajoPiso } };
}

/** servirOfertaPisoDeCobranza(pieza, porEntidad, cierre) → { piezaId, dominio, texto, gancho, cola } | null — la
 *  gemela de arriba, vocabulario propio de PRI-04. `cierre` (owner 2026-09-24, corrección tras revisión — «la
 *  oferta describe mal la pieza y le falta la cola»): el resultado de `medir.js:coberturaPisoDeCobranza(tabla)`,
 *  pasado por el llamador (`seleccionar.js`) — su campo `.vencidoTotal` es el MISMO hecho ya verificado que
 *  arma el cierre («Vencido total: …») — se REUSA acá, nunca se declara un hecho nuevo ni se reparsea su texto.
 *  Sin `cierre`/`vencidoTotal` (defensivo — no debería pasar si la pieza es pertinente), la oferta se sirve
 *  igual, sin esa cola. */
export function servirOfertaPisoDeCobranza(pieza, porEntidad, cierre) {
  if (!pieza || !porEntidad || !porEntidad.size) return null;
  const señales = [];
  for (const [entidad, m] of porEntidad) { if (m && m.estado === "senal" && m.partes) señales.push({ entidad, m }); }
  if (!señales.length) return null;
  const pisoDe = señales[0].m.partes.declaradoPorLaEmpresa ? "el piso declarado por tu empresa" : "el piso de ADI";
  const n = señales.length;
  // ★ PRI-04 compara la participación en el vencido con la participación en la venta — NUNCA "contra el resto
  // de la cartera" (esa es la comparación de CAU-01; la corrección del owner tras revisar la oferta anterior).
  const cuerpo = n <= 3
    ? `La exposición de cobranza de toda la cartera (participación en el vencido contra participación en la venta): ${n} cuenta${n === 1 ? "" : "s"} superan ${pisoDe} (${señales.map(({ entidad, m }) => `${entidad} ${m.partes.monto}`).join(", ")} de diferencia)`
    : `La exposición de cobranza de toda la cartera (participación en el vencido contra participación en la venta): ${n} cuentas superan ${pisoDe}`;
  const vt = cierre && cierre.vencidoTotal;
  const texto = vt ? `${cuerpo}; ${vt.texto} vencido (${vt.pctTexto} del saldo pendiente).` : `${cuerpo}.`;
  const top = señales[0].m.cifra;
  return { piezaId: pieza.id, dominio: "cobranza", texto, gancho: { hechoId: top ? top.id : null, texto: top ? top.texto : null }, cola: { n, vencidoTotal: vt || null } };
}
