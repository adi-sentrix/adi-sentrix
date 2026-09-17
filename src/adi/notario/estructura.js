/* estructura.js · EL DUEÑO EN LA ESTRUCTURA — la verdad se protege igual en prosa, listas y tablas ═══════════════════════════════════════
 *
 * Decisión del owner (2026-09-17, ronda adversarial 3): «ADI sí puede responder con tablas; no quiero limitar la experiencia por una carencia del
 * Notario. La verdad debe protegerse igual en prosa, listas y tablas». Medido en la ronda: una tabla markdown con los días cruzados entre dos
 * filas, una tabla transpuesta (entidades en columnas), una lista con sub-viñetas bajo cada cuenta y un encabezado «Lider:» con la cifra en la
 * línea siguiente se servían con cifras cruzadas, porque el dueño de una cifra se buscaba solo en su oración.
 *
 * Acá se lee la estructura del texto y se le da dueño (y columna) a cada tramo:
 *   · tabla markdown  — fila = entidad y columna = métrica («| Lider | $4,6M | 251 |» bajo «| Cliente | Vencido | Días de atraso |»), o la
 *                       transpuesta (entidades en la cabecera: «| | Falabella | Lider |» y filas «| Margen | 22,0% | 22,0% |»)
 *   · lista anidada   — la viñeta padre que es una entidad («- Lider») es dueña de sus sub-viñetas («  - $4,6M vencidos»)
 *   · encabezado      — la línea que es solo una entidad («Lider:», «### Lider», «**Lider**») es dueña de las líneas que siguen hasta el
 *                       siguiente encabezado, línea en blanco o línea con otra entidad al inicio
 * presencia (el dueño del punto) y el juez (la consistencia prosa↔declaración) preguntan acá antes de mirar la oración. Puro: sin I/O. */
import { normalizar } from "./afirmacion.js";

const _SEPARADOR = /^\s*\|?\s*:?-{2,}:?\s*(?:\|\s*:?-{2,}:?\s*)*\|?\s*$/;
const _limpiaCelda = (c) => c.replace(/\*\*|__|`/g, "").trim();

/* resuelve un texto de celda / línea a una entidad de la lista de nombres (exacta, o el nombre con «:» / «(…)» / «—» detrás) */
function _entidadDe(texto, nombres) {
  const t = normalizar(_limpiaCelda(String(texto || "")).replace(/\s*[:—–-]\s*$/, "").replace(/\s*\(.*\)\s*$/, "").replace(/^#+\s*/, "").replace(/^[-*•]\s+/, "").trim());
  if (!t) return null;
  for (const n of nombres) { const k = normalizar(n); if (k && (t === k || t === k.replace(/[^a-z0-9 ]/g, ""))) return n; }
  return null;
}
/* ¿la línea empieza con una entidad (y la cifra no va antes)? — para cortar el alcance de un encabezado */
function _empiezaConEntidad(linea, nombres) {
  const t = normalizar(linea).replace(/^[-*•#\s]+/, "");
  return nombres.some((n) => { const k = normalizar(n); return k && (t === k || t.startsWith(k + " ") || t.startsWith(k + ":") || t.startsWith(k + " (")); });
}

/** duenosEstructurales(texto, nombres) → [{ ini, fin, dueno, metrica, tipo }] · tramos del texto con dueño estructural (tablas, listas, encabezados) */
export function duenosEstructurales(texto, nombres = []) {
  const s = String(texto || "");
  if (!s || !Array.isArray(nombres) || !nombres.length) return [];
  const out = [];
  const lineas = [];
  { let off = 0; for (const l of s.split("\n")) { lineas.push({ texto: l, ini: off, fin: off + l.length }); off += l.length + 1; } }
  /* ── tablas markdown ── */
  let i = 0;
  while (i < lineas.length) {
    if (!/^\s*\|/.test(lineas[i].texto)) { i++; continue; }
    const filas = [];
    while (i < lineas.length && /^\s*\|/.test(lineas[i].texto)) { filas.push(lineas[i]); i++; }
    if (filas.length < 2) continue;
    const celdasDe = (l) => { const out2 = []; const re = /\|([^|]*)/g; let m; while ((m = re.exec(l.texto))) { const crudo = m[1]; const lead = crudo.length - crudo.trimStart().length; const txt = crudo.trim(); if (m.index + 1 + crudo.length >= l.texto.length && !txt) break; out2.push({ texto: txt, ini: l.ini + m.index + 1 + lead, fin: l.ini + m.index + 1 + lead + txt.length }); } return out2; };
    const cuerpo = filas.filter((l) => !_SEPARADOR.test(l.texto));
    if (cuerpo.length < 2) continue;
    const cab = celdasDe(cuerpo[0]);
    const datos = cuerpo.slice(1).map(celdasDe);
    const entFila = datos.map((c) => (c.length ? _entidadDe(c[0].texto, nombres) : null));
    const entCol = cab.slice(1).map((c) => _entidadDe(c.texto, nombres));
    const porFila = entFila.filter(Boolean).length, porCol = entCol.filter(Boolean).length;
    if (porFila && porFila >= porCol) {
      /* fila = entidad · columna = métrica */
      datos.forEach((celdas, r) => { const dueno = entFila[r]; if (!dueno) return; celdas.slice(1).forEach((c, k) => { if (!c.texto) return; out.push({ ini: c.ini, fin: c.fin, dueno, metrica: cab[k + 1] ? _limpiaCelda(cab[k + 1].texto) : null, tipo: "tabla" }); }); });
      out.push({ ini: cuerpo[0].ini, fin: cuerpo[0].fin, dueno: null, metrica: null, tipo: "cabecera" });
    } else if (porCol) {
      /* transpuesta: columna = entidad · fila = métrica */
      datos.forEach((celdas) => { const metrica = celdas.length ? _limpiaCelda(celdas[0].texto) : null; celdas.slice(1).forEach((c, k) => { const dueno = entCol[k]; if (!dueno || !c.texto) return; out.push({ ini: c.ini, fin: c.fin, dueno, metrica, tipo: "tabla" }); }); });
      out.push({ ini: cuerpo[0].ini, fin: cuerpo[0].fin, dueno: null, metrica: null, tipo: "cabecera" });
    }
  }
  /* ── listas anidadas y encabezados ── */
  const nivel = (l) => (/^(\s*)[-*•]\s+/.exec(l) || /^(\s*)\d+[.)]\s+/.exec(l) || [null, null])[1];
  for (let j = 0; j < lineas.length; j++) {
    const l = lineas[j];
    if (/^\s*\|/.test(l.texto)) continue;
    const ind = nivel(l.texto);
    const cuerpoLinea = l.texto.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, "");
    const ent = _entidadDe(cuerpoLinea, nombres);
    if (!ent) continue;
    if (ind != null) {
      /* viñeta padre: sus sub-viñetas (más sangría) hasta la siguiente viñeta del mismo nivel o menos */
      for (let k = j + 1; k < lineas.length; k++) {
        const lk = lineas[k]; if (!lk.texto.trim()) break;
        const indK = nivel(lk.texto);
        if (indK == null) { if (/^\s+/.test(lk.texto) && lk.texto.search(/\S/) > ind.length) { out.push({ ini: lk.ini, fin: lk.fin, dueno: ent, metrica: null, tipo: "lista" }); continue; } break; }
        if (indK.length <= ind.length) break;
        out.push({ ini: lk.ini, fin: lk.fin, dueno: ent, metrica: null, tipo: "lista" });
      }
    } else if (/^\s*(?:#{1,6}\s+|\*\*)?[^\n]*?(?::|\*\*|—|–)?\s*$/.test(l.texto) && !/\d/.test(cuerpoLinea)) {
      /* encabezado «Lider:» / «### Lider» / «**Lider**»: las líneas que siguen, hasta un blanco, otro encabezado u otra entidad al inicio */
      for (let k = j + 1; k < lineas.length; k++) {
        const lk = lineas[k]; if (!lk.texto.trim()) break;
        if (/^\s*\|/.test(lk.texto) || /^\s*#/.test(lk.texto) || _empiezaConEntidad(lk.texto, nombres)) break;
        out.push({ ini: lk.ini, fin: lk.fin, dueno: ent, metrica: null, tipo: "encabezado" });
      }
    }
  }
  return out;
}

/** duenoEstructural(texto, pos, nombres) → el tramo estructural que contiene la posición (o null) */
export function duenoEstructural(texto, pos, nombres = []) {
  for (const t of duenosEstructurales(texto, nombres)) if (pos >= t.ini && pos < t.fin && t.dueno) return t;
  return null;
}
/** esCabeceraDeTabla(texto, pos, nombres) → true si la posición cae en la fila de cabecera de una tabla (no es una afirmación) */
export function esCabeceraDeTabla(texto, pos, nombres = []) {
  return duenosEstructurales(texto, nombres).some((t) => t.tipo === "cabecera" && pos >= t.ini && pos < t.fin);
}
