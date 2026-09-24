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
/* "A, B y C" — la coordinación de la casa (nunca "A, B, y C" con coma antes de "y"). */
const _listaConY = (arr) => (arr.length <= 1 ? (arr[0] || "") : `${arr.slice(0, -1).join(", ")} y ${arr[arr.length - 1]}`);
/* la línea única de "bajo el piso": primero las que tienen exceso (con "al borde" si corresponde), separadas
 * por punto y coma de las que cargan/pesan menos (agrupadas, sin repetir cifra — la cifra es lo que las hace
 * señal o borde; cargar menos no tiene "exceso" que mostrar, owner 2026-09-23). `null` si no hay ninguna cuenta
 * bajo el piso (pieza sin veredictos negativos este turno — el bloque simplemente no trae esta línea). */
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
/* CUENTAS NOMBRADAS → línea completa; SEÑALES NO NOMBRADAS, cuando la pieza es contexto adicional (no responde
 * el tema de la pregunta) → compactadas por nombre y monto, nunca ocultas (owner 2026-09-24, defecto 4). El
 * criterio de "responde la pregunta" lo decide el LLAMADOR (`seleccionar.js`, con `dominiosDe(pregunta)` — el
 * contrato de dominios que ya existe, ningún clasificador nuevo) y llega ya resuelto en `respondeLaPregunta`. */
function _despliegaCompleta(entidad, nombradas, respondeLaPregunta) {
  return respondeLaPregunta || nombradas.has(entidad);
}

/** servirBloqueCargaVsResto(pieza, porEntidad, cierreTexto, opts) → { texto, ... } | null — el bloque de CAU-01.
 *  `porEntidad`: Map(entidad → medicion), en el orden natural de la cartera (`medir.js:resultadosCargaVsResto`).
 *  `cierreTexto`: el texto YA armado por `medir.js:coberturaCargaVsResto` (piso + cobertura, una sola verdad —
 *  este módulo no lo recalcula). `opts.nombradas` (Set, default vacío) y `opts.respondeLaPregunta` (boolean,
 *  default true — desplegar todo si el llamador no lo declara, el comportamiento de siempre). `null` si no hay
 *  ninguna medición con `.partes` (defensivo: nada que redactar). */
export function servirBloqueCargaVsResto(pieza, porEntidad, cierreTexto, { nombradas = new Set(), respondeLaPregunta = true } = {}) {
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
      if (_despliegaCompleta(entidad, nombradas, respondeLaPregunta)) {
        /* «$X sobre el piso ($Y)» se leía como si superara el piso POR $X: el monto es la diferencia contra el resto,
         * y el piso se nombra aparte («supera»), nunca como punto de partida del monto (supervisor 2026-09-24). */
        señalLineas.push(`${entidad}: ${p.propio} de su venta en carga comercial contra ${p.resto} del resto de la cartera; ${p.puntos}, ${p.monto} por encima del resto; supera ${pisoDe} (${p.pisoTexto}). Señal.`);
      } else {
        señalesCompactas.push(`${entidad} (${p.monto})`);
      }
    } else if (m.estado === "bajo_piso") {
      if (p.sentido === "mas") conExceso.push(`${entidad} (${p.monto} por encima del resto${m.borde ? ", al borde" : ""})`);
      else sinExceso.push(entidad);
    }
  }
  if (!señalLineas.length && !señalesCompactas.length && !conExceso.length && !sinExceso.length) return null;
  const señalCompactaLinea = señalesCompactas.length ? `También superan ${pisoDe}: ${señalesCompactas.join(", ")}.` : null;
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
export function servirBloquePisoDeCobranza(pieza, porEntidad, cierreTexto, { nombradas = new Set(), respondeLaPregunta = true } = {}) {
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
      if (_despliegaCompleta(entidad, nombradas, respondeLaPregunta)) {
        señalLineas.push(`${entidad}: ${p.propio} del vencido contra ${p.resto} de la venta; ${p.puntos}, ${p.monto} de diferencia; supera ${pisoDe} (${p.pisoTexto}). Señal.`);
      } else {
        señalesCompactas.push(`${entidad} (${p.monto})`);
      }
    } else if (m.estado === "bajo_piso") {
      if (p.sentido === "mas") conExceso.push(`${entidad} (${p.monto} de diferencia${m.borde ? ", al borde" : ""})`);
      else sinExceso.push(entidad);
    }
  }
  if (!señalLineas.length && !señalesCompactas.length && !conExceso.length && !sinExceso.length) return null;
  const señalCompactaLinea = señalesCompactas.length ? `También superan ${pisoDe}: ${señalesCompactas.join(", ")}.` : null;
  const bajoPisoLinea = pisoDe ? _lineaBajoPiso(conExceso, sinExceso, pisoDe, "pesa menos en el vencido que en la venta", "pesan menos en el vencido que en la venta") : null;
  const negativa = _oracionDeLimite(pieza);
  const texto = [_headerDeBloque(pieza), ...señalLineas, señalCompactaLinea, bajoPisoLinea, negativa, cierreTexto].filter((s) => s && s.trim()).join(" ");
  return { texto, piezaId: pieza.id, fuente: pieza.fuente || null, alcance: pieza.alcance || null, fecha: pieza.fecha || null, vigencia: pieza.vigencia || null, firma: pieza.firma || null, estado: "bloque" };
}
