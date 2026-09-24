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
 * rótulo fijo "Esto no excluye:" para leerse como oración. */
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

/** servirPieza(pieza, entidad, medicion) → { texto, fuente, alcance, fecha, vigencia, firma, hechoId } | null
 *  Nunca sirve si `pieza.estado !== "firmada"` (candado del gate — ver `seleccionar.js`, que es quien filtra
 *  ANTES de llegar acá; este módulo no vuelve a chequear el gobierno, solo redacta con la forma fija). */
export function servirPieza(pieza, entidad, medicion) {
  if (!pieza || !medicion) return null;
  const oficio = `El oficio mira: ${pieza.enunciado}`;
  const sector = _sectorDe(pieza);
  let cuerpo = "";
  let hechoId = null;

  if (medicion.estado === "ocurre") {
    const cifraTxt = medicion.cifra ? medicion.cifra.texto : "(cifra no disponible)";
    const refTxt = medicion.referencia && medicion.referencia.texto ? medicion.referencia.texto : null;
    // el "no implica" que se sirve en "ocurre" es el de la PIEZA (el conocimiento), no el de la medición — ver
    // corrección 2026-09-23 en la cabecera de este archivo. Se sirve TAL CUAL (ya es una oración completa, "No
    // implica que…" — igual que el ejemplo del documento): agregarle el rótulo "No implica:" la duplicaría.
    const noImplica = typeof pieza.no_implica === "string" && pieza.no_implica.trim() ? pieza.no_implica.trim() : null;
    cuerpo = `En ${entidad} está ocurriendo: ${cifraTxt}${refTxt ? ` contra ${refTxt}` : ""} (${_procTxt(medicion)}).${_bordeTxt(medicion)}${noImplica ? ` ${noImplica}` : ""}`;
    hechoId = medicion.cifra ? medicion.cifra.id : null;
  } else if (medicion.estado === "senal" || medicion.estado === "bajo_piso") {
    // ★ PRI-04 (owner 2026-09-23, Aclaración 2 del diseño sellado, corregido en la segunda vuelta): las TRES
    // partes fijas, en orden, TAMBIÉN para señal — hecho con cifra · piso con su dueño (ADI) · veredicto. El
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
    const negativa = medicion.estado === "senal"
      ? (typeof pieza.no_implica === "string" && pieza.no_implica.trim() ? ` ${pieza.no_implica.trim()}` : "")
      : (medicion.noExcluye ? ` Esto no excluye: ${medicion.noExcluye}.` : "");
    cuerpo = `${cifraTxt}${refTxt ? ` ${refTxt}` : ""} Veredicto: ${veredictoTxt}.${_bordeTxt(medicion)}${negativa}`;
    hechoId = medicion.cifra ? medicion.cifra.id : null;
  } else if (medicion.estado === "no_ocurre") {
    const cifraTxt = medicion.cifra ? medicion.cifra.texto : "(cifra no disponible)";
    const refTxt = medicion.referencia && medicion.referencia.texto ? medicion.referencia.texto : null;
    cuerpo = `ADI lo midió: en ${entidad} NO está ocurriendo: ${cifraTxt}${refTxt ? ` contra ${refTxt}` : ""}.${medicion.noExcluye ? ` Esto no excluye: ${medicion.noExcluye}.` : ""}`;
    hechoId = medicion.cifra ? medicion.cifra.id : null;
  } else {
    cuerpo = `Con estos datos no se puede saber en ${entidad}: falta ${medicion.motivo || "el insumo necesario"}.${medicion.resolveria ? ` Lo resolvería: ${medicion.resolveria}.` : ""}`;
    hechoId = null;
  }

  return {
    texto: `${oficio} (en ${sector}). ${cuerpo}`,
    fuente: pieza.fuente || null,
    alcance: pieza.alcance || null,
    fecha: pieza.fecha || null,
    vigencia: pieza.vigencia || null,
    firma: pieza.firma || null,
    piezaId: pieza.id,
    entidad,
    estado: medicion.estado,
    hechoId,
  };
}
