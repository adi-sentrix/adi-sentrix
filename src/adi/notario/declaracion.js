/* === src/adi/notario/declaracion.js · EL PROTOCOLO DE LA DECLARACIÓN (Notario semántico, fase 2 · owner 2026-09-15) ═══════
 * «El modelo redacta; el modelo declara qué está afirmando.» Este archivo es el CABLE entre la prosa del cerebro y el verificador:
 *   · la INSTRUCCIÓN que viaja en el system (qué es una afirmación, los tipos, los campos, el formato);
 *   · el PARSEO de la salida del cerebro: la respuesta y, al final, el bloque cerrado entre <<AFIRMACIONES>> y <<FIN>> (una afirmación
 *     por línea, en JSON) — el bloque se quita antes de servir; una salida sin bloque se reporta como tal (nunca se supone);
 *   · la DECLARACIÓN DEL RESPALDO: los peldaños determinísticos escriben desde figs; su declaración se deriva de LAS MISMAS figs con
 *     las que compusieron (por el canon de cada cifra dentro de ese pool, no de la boleta entera), y se verifica con el mismo verificador
 *     y el mismo detector que la del cerebro — el mismo estándar, sin camino privilegiado.
 * Puro: sin I/O, sin red. */
import { parseFigures } from "../boleta.js";
import { normalizar, TIPOS } from "./afirmacion.js";
import { indiceDeEvidencia, estadoCanon } from "./evidencia.js";
import { posicionDeCifra } from "./presencia.js";
import { tolCalculo } from "../oracle/calculoCatalogo.js";
const _U = { pct: "tasa", pp: "tasa", money: "money", days: "days", ratio: "ratio", count: "count" };
const _mismo = (f, g) => (_U[f.unit] || f.unit) === (_U[g.unidad] || g.unidad) && Number.isFinite(g.raw) && (Math.abs(g.raw - f.raw) <= (g.unidad === "count" ? 0 : tolCalculo(g.raw, g.unidad)) || (g.canon && g.canon.replace(/\$/g, "") === f.canon.replace(/\$/g, "")));

export const MARCA_INICIO = "<<AFIRMACIONES>>";
export const MARCA_FIN = "<<FIN>>";

/** instruccionDeDeclaracion() → el bloque del system que enseña a declarar (byte-estable) */
export function instruccionDeDeclaracion() {
  return [
    "TUS AFIRMACIONES — el Notario verifica LO QUE DECLARAS contra tus resultados, no cómo lo redactas:",
    `Después de tu respuesta, en la MISMA salida, agrega un bloque que declare CADA afirmación de hecho que hiciste, una por línea, en JSON, entre las marcas ${MARCA_INICIO} y ${MARCA_FIN}. El usuario no ve el bloque. Una afirmación que no declares se te devuelve («declara o quita»); una declarada sin evidencia en tus resultados no se sirve.`,
    "- Es afirmación de hecho: cada cifra que citas; cada orden (el que más/menos, el mayor/peor, segundo, top 3, A antes que B); cada relación entre cifras (el doble, la mitad, el 47 % de, más que); cada cifra de un grupo (los tres grandes suman/promedian…); cada conteo (8 de 13, 5 cuentas); cada variación (crece, cae, vs año anterior); cada estado (frenado, inmovilizado).",
    "- Tipos y campos: cifra{sujeto, metrica, valor} · orden{sujeto, metrica, orden:{forma: max|min|puesto|topk|comparativo, k, direccion: mayor|menor|peor|mejor, vs}, universo} · relacion{sujeto, metrica, relacion:{forma: veces|fraccion|parte|mayor|menor|diferencia, k, matiz, vs}, valor} · grupo{sujeto: la lista completa, metrica, valor} · conteo{conteo:{n, m, predicado}, universo} · variacion{sujeto, metrica, variacion:{direccion: sube|baja|estable, valor}, periodo} · estado{sujeto, estado:{estado, bodega}} · lectura{sello: probado|indicado|abierto|criterio mío}.",
    "- sujeto: el nombre exacto de la entidad tal como está en tus resultados; \"negocio\" para los totales; una lista para grupos y top-k. metrica: el concepto tal como está en el rótulo del resultado (lo que sigue a «Entidad · »): \"Saldo vencido\", \"Contribución no capturada\", \"Brecha al benchmark\", \"Capital frenado\"… valor: la cifra tal como la escribiste. universo: de qué conjunto es un orden, un conteo o un subtotal (\"los 13 clientes\", \"las 5 cuentas materiales\"). periodo: \"vs año anterior\" en toda variación. texto: el fragmento literal de tu respuesta (hasta 80 caracteres) donde está esa afirmación.",
    "- lectura es SOLO para interpretaciones y recomendaciones sin cifra ni orden sobre una métrica; una frase con una cifra, un orden o una variación NO es lectura: declárala como el hecho que es.",
    `Ejemplo:\n${MARCA_INICIO}\n{"tipo":"cifra","sujeto":"Lider","metrica":"Saldo vencido","valor":"$4,6M","texto":"acumula $4,6M vencidos"}\n{"tipo":"orden","sujeto":"Falabella","metrica":"Contribución","orden":{"forma":"max"},"universo":"los 13 clientes","texto":"la que más contribución aporta"}\n{"tipo":"conteo","conteo":{"n":8,"m":13,"predicado":"bajo el benchmark"},"universo":"los 13 clientes","texto":"8 de 13 bajo el benchmark"}\n{"tipo":"lectura","sello":"criterio mío","texto":"Yo miraría primero a Lider"}\n${MARCA_FIN}`,
  ].join("\n");
}

/* _parsearLineas(bloque) → [afirmaciones] + errores · JSON por línea; tolera un arreglo JSON entero, viñetas y cercas ``` */
function _parsearLineas(bloque) {
  const afirmaciones = [], errores = [];
  const limpio = String(bloque || "").replace(/```(?:json)?/gi, "").trim();
  if (!limpio) return { afirmaciones, errores };
  /* un arreglo JSON entero */
  if (/^\s*\[/.test(limpio)) {
    try { const arr = JSON.parse(limpio); if (Array.isArray(arr)) { for (const a of arr) if (a && typeof a === "object") afirmaciones.push(a); return { afirmaciones, errores }; } } catch { /* sigue por líneas */ }
  }
  for (const linea0 of limpio.split(/\r?\n/)) {
    const linea = linea0.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").replace(/,\s*$/, "").trim();
    if (!linea || !/^\{/.test(linea)) continue;
    try { const a = JSON.parse(linea); if (a && typeof a === "object") afirmaciones.push(a); else errores.push(`no es un objeto: ${linea.slice(0, 60)}`); }
    catch (e) { errores.push(`línea inválida: ${linea.slice(0, 80)}`); }
  }
  return { afirmaciones, errores };
}

/** extraerDeclaracion(salida) → { respuesta, afirmaciones: [...] | null, errores, bloque: bool }
 *  `afirmaciones` es null cuando la salida NO trae bloque (el cerebro no declaró); el bloque —con o sin cierre— se quita de la respuesta. */
export function extraerDeclaracion(salida) {
  const s = String(salida == null ? "" : salida);
  const i = s.indexOf(MARCA_INICIO);
  if (i < 0) {
    /* sin marca de inicio: si igual viene un tramo final de líneas JSON con «tipo», se lee (el modelo olvidó la marca, no la declaración) */
    const m = /\n\s*(\{"tipo"[\s\S]*)$/.exec(s);
    if (m && /"tipo"\s*:/.test(m[1])) { const p = _parsearLineas(m[1].replace(new RegExp(MARCA_FIN.replace(/[<>]/g, "\\$&") + "\\s*$"), "")); if (p.afirmaciones.length) return { respuesta: s.slice(0, m.index).trim(), afirmaciones: p.afirmaciones, errores: [...p.errores, "bloque sin marca de inicio"], bloque: true }; }
    return { respuesta: s.trim(), afirmaciones: null, errores: [], bloque: false };
  }
  const j = s.indexOf(MARCA_FIN, i + MARCA_INICIO.length);
  const bloque = j >= 0 ? s.slice(i + MARCA_INICIO.length, j) : s.slice(i + MARCA_INICIO.length);
  const respuesta = (s.slice(0, i) + (j >= 0 ? s.slice(j + MARCA_FIN.length) : "")).trim();
  const p = _parsearLineas(bloque);
  return { respuesta, afirmaciones: p.afirmaciones, errores: j >= 0 ? p.errores : [...p.errores, "bloque sin marca de cierre"], bloque: true };
}

/** quitarDeclaracion(salida) → la respuesta sin el bloque (para todo lo que se sirve o se guarda) */
export function quitarDeclaracion(salida) { return extraerDeclaracion(salida).respuesta; }

/* ── LA DECLARACIÓN DEL RESPALDO ─────────────────────────────────────────────────────────────────────────────────────── */
const _ORACIONES = (t) => { const out = []; const re = /[^.\n;]+(?:\.\d+[^.\n;]*)*[.\n;]?/g; let m; while ((m = re.exec(t))) { if (m[0].trim()) out.push({ pos: m.index, fin: m.index + m[0].length, texto: m[0] }); } return out; };
const _MARCAS_ORDEN = /\b(?:(?:el|la|los|las)\s+(?:[a-záéíóúñ0-9]+\s+){0,2}que\s+(?:[a-záéíóúñ]+\s+)?(?:m[aá]s|menos)|(?:el|la)\s+(?:mayor|menor|peor|mejor)|m[aá]s\s+(?:alt[oa]|baj[oa]|grande|pesad[oa])|primer[oa]?|segund[oa]|tercer[oa]?|encabeza|lidera)\b/i;
/** declaracionDeRespaldo(texto, figs, {ejesDelTenant, datoProyectado}) → afirmaciones derivadas de las figs con que se compuso:
 *  · cada cifra del texto cuyo canon esté en UNA fig del pool (o en varias con la misma entidad nombrada en la oración) → cifra
 *    (o grupo, si la fig es un agregado con grupo);
 *  · «N de M» y «N cuentas/SKU» con una fig de conteo o un grupo de tamaño N → conteo;
 *  · un estado del inventario nombrado junto a un SKU con estado declarado → estado;
 *  · una variación con su signo en una fig «Variación vs año anterior» → variacion.
 *  Lo que no se pueda derivar queda sin declarar — y el detector de presencia lo cobra, como al cerebro. */
export function declaracionDeRespaldo(texto, figs, { ejesDelTenant = null, datoProyectado = null } = {}) {
  const s = String(texto || "");
  const I = indiceDeEvidencia({ figs: Array.isArray(figs) ? figs : [], datoProyectado, ejesDelTenant });
  const out = [];
  const oraciones = _ORACIONES(s);
  const oracionEn = (pos) => oraciones.find((o) => pos >= o.pos && pos < o.fin) || { pos: 0, fin: s.length, texto: s };
  const nombresEn = (t) => { const enc = []; for (const [k, v] of I.entidades) if (new RegExp(`(?<![\\wáéíóúñ])${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\wáéíóúñ])`, "i").test(normalizar(t))) enc.push(v.nombre); return enc; };
  const usados = new Map();
  /* el fragmento: el tramo de la oración que contiene la cifra, cortado en «·», «;», «—» y paréntesis (no cruza a la cifra vecina) */
  const fragmento = (o, pos, largo) => {
    const antes = s.slice(o.pos, pos), despues = s.slice(pos + largo, o.fin);
    const iniRel = Math.max(antes.lastIndexOf(" · "), antes.lastIndexOf(";"), antes.lastIndexOf(" — "), antes.lastIndexOf("("), antes.lastIndexOf(")"), -1);
    const cortes = [despues.indexOf(" · "), despues.indexOf(";"), despues.indexOf(" — "), despues.indexOf(")"), despues.indexOf("(")].filter((x) => x >= 0);
    const finRel = cortes.length ? Math.min(...cortes) : despues.length;
    return s.slice(o.pos + iniRel + 1, pos + largo + finRel).replace(/^[\s·—;:,)]+|[\s·—;:,(]+$/g, "").trim() || s.slice(pos, pos + largo);
  };
  for (const f of parseFigures(s)) {
    const desde = usados.has(f.text) ? usados.get(f.text) + 1 : 0;
    let pos = posicionDeCifra(s, f.text, desde); if (pos < 0) pos = posicionDeCifra(s, f.text, 0); if (pos < 0) continue;
    usados.set(f.text, pos);
    const cands = I.figs.filter((g) => _mismo(f, g));
    if (!cands.length) continue;
    const o = oracionEn(pos);
    const nombres = nombresEn(o.texto);
    let elegida = cands.length === 1 ? cands[0] : (cands.find((g) => g.entidad && nombres.some((n) => normalizar(n) === normalizar(g.entidad))) || cands.find((g) => !g.entidad && !nombres.length) || null);
    if (!elegida && cands.every((g) => g.unidad === cands[0].unidad && Math.abs(g.raw - cands[0].raw) < 1e-9) && !cands.some((g) => g.entidad && nombres.length && !nombres.some((n) => normalizar(n) === normalizar(g.entidad)))) elegida = cands[0];
    if (!elegida) continue;
    const texto = fragmento(o, pos, f.text.length);
    const base = { texto, valor: f.text, evidencia: [elegida.label], derivada: true };
    if (elegida.agregado && elegida.entidadesDelGrupo.length) out.push({ tipo: "grupo", sujeto: elegida.entidadesDelGrupo.slice(), metrica: elegida.base, universo: elegida.calificador || elegida.concepto, ...base });
    else if (elegida.agregado) out.push({ tipo: "cifra", sujeto: elegida.entidad || "negocio", metrica: elegida.base, universo: elegida.calificador || elegida.concepto, ...base });
    else if (/variacion vs ano anterior|^crecimiento$|^yoy$|vs ano anterior/.test(elegida.conceptoNorm)) out.push({ tipo: "variacion", sujeto: elegida.entidad || "negocio", metrica: "Ventas", variacion: { direccion: elegida.raw > 0 ? "sube" : elegida.raw < 0 ? "baja" : "estable", valor: f.text }, periodo: "vs año anterior", ...base });
    else out.push({ tipo: "cifra", sujeto: elegida.entidad || "negocio", metrica: elegida.concepto, ...base });
  }
  /* conteos: «N de M», «N cuentas/clientes/SKU» → una fig de conteo o un agregado de ese tamaño */
  const reConteo = /\b(\d{1,2})\s+(?:de\s+(?:las?\s+|los\s+)?(\d{1,2})\s+)?(cuentas?|clientes?|skus?|sku|bodegas?|marcas?)\b|\b(\d{1,2})\s+de\s+(?:las?\s+|los\s+)?(\d{1,2})\b/gi;
  let m;
  while ((m = reConteo.exec(s))) {
    const n = +(m[1] || m[4]), mm = m[2] || m[5] ? +(m[2] || m[5]) : null;
    const o = oracionEn(m.index);
    const cont = I.figs.find((g) => (g.unidad === "count" && g.raw === n && !g.agregado)) || I.figs.find((g) => g.agregado && g.n === n && (mm == null || g.m == null || g.m === mm));
    if (!cont) continue;
    const pred = cont.agregado ? (cont.calificador.replace(/^·\s*subtotal\s*·\s*/, "").replace(/^\d+\s+\w+\s+/, "").replace(/\(.*?\)/g, "").trim() || cont.base) : (cont.concepto.replace(/^clientes?\s*·\s*/i, "").trim());
    out.push({ tipo: "conteo", conteo: { n, m: mm, predicado: pred }, universo: mm != null ? `de ${mm}` : "los 13 clientes", texto: fragmento(o, m.index, m[0].length), evidencia: [cont.label], derivada: true });
  }
  /* estados: un SKU con estado declarado, nombrado junto a la palabra del estado en la misma oración */
  for (const o of oraciones) {
    const em = /\b(inmoviliz[a-záéíóúñ]*|frenad[oa]s?|sobrestock|riesgo\s+de\s+quiebre|capital\s+sano)\b/i.exec(o.texto);
    if (!em || /\bcapital\s+frenad/i.test(o.texto) && !/\best[aá]n?\s+frenad|\bfrenad[oa]s?\s+en\b/i.test(o.texto)) continue;
    for (const n of nombresEn(o.texto)) { const est = I.estadosDe(n); if (est.length && est.some((x) => estadoCanon(x.estado) === estadoCanon(em[1]))) out.push({ tipo: "estado", sujeto: n, estado: { estado: estadoCanon(em[1]) }, texto: o.texto.trim().slice(0, 80), evidencia: ["estados del inventario"], derivada: true }); }
  }
  return out;
}

export const TIPOS_DECLARABLES = TIPOS;
