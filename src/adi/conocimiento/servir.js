/* === src/adi/conocimiento/servir.js · LAS TRES FORMAS FIJAS DE SERVICIO (Business Knowledge v0.2, Parte A §1) ═══
 * «La forma es fija, para que resista la paráfrasis.» Tres plantillas de la casa, con placeholders — la
 * referencia se RENDERIZA, no se redacta (mismo principio que la prosa anclada del Notario v3). Este módulo no
 * decide nada: solo arma el texto de la pieza+entidad YA medida por `medir.js`.
 *
 *   ocurre          → «El oficio mira X. En [entidad] está ocurriendo: [cifra] contra [referencia] (medido).
 *                      No implica: …»
 *   no_ocurre       → «El oficio mira X. ADI lo midió y no está ocurriendo en [entidad]: [cifra] contra
 *                      [referencia]. Esto no excluye: …»
 *   indeterminable  → «El oficio mira X. Con estos datos no se puede saber: [motivo]. Lo resolvería: [resolveria].»
 *
 * Sujeto de la pieza siempre "el oficio" + el sector declarado — nunca el nombre de la empresa. La MEDICIÓN
 * (la parte «en Lider…») es la única que nombra la entidad — regla del documento: «la pieza tiene por sujeto al
 * sector, la medición a la empresa, y la frase puente la escribe la casa». */
const _SECTOR_TXT = { distribucion: "distribución", fabricacion: "fabricación", minorista: "minorista", servicios: "servicios", obras: "obras" };

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
    cuerpo = `En ${entidad} está ocurriendo: ${cifraTxt}${refTxt ? ` contra ${refTxt}` : ""} (medido).${medicion.noExcluye ? ` No implica: ${medicion.noExcluye}.` : ""}`;
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
