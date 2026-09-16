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
import { normalizar, TIPOS, menosAscii } from "./afirmacion.js";
import { indiceDeEvidencia, estadoCanon } from "./evidencia.js";
import { posicionDeCifra } from "./presencia.js";
import { mismoValor } from "./evidencia.js";
const _U = { pct: "tasa", pp: "tasa", money: "money", days: "days", ratio: "ratio", count: "count" };
/* la cifra de la prosa es la de una fig si la dice verbatim, con el mismo canon, o —a la precisión con que está escrita— es ese valor (la regla de
 * la casa, `mismoValor`): la tolerancia de cálculo del muro ($1.000 en dinero) no vale acá, casaba «$24.029» con un KPI en $0 */
const _mismo = (f, g) => (g.texto && g.texto === menosAscii(String(f.text || "")).trim()) || (_U[f.unit] || f.unit) === (_U[g.unidad] || g.unidad) && Number.isFinite(g.raw) && ((g.canon && g.canon.replace(/\$/g, "") === f.canon.replace(/\$/g, "")) || mismoValor({ texto: f.text, raw: f.raw, unidad: f.unit, canon: f.canon }, g.raw, g.unidad, g.texto));

export const MARCA_INICIO = "<<AFIRMACIONES>>";
export const MARCA_FIN = "<<FIN>>";

/** instruccionDeDeclaracion() → el bloque del system que enseña a declarar (byte-estable) · PROTOCOLO v2 (fase 4, etapa B · 2026-09-16) */
export function instruccionDeDeclaracion() {
  return [
    "TUS AFIRMACIONES — el Notario verifica LO QUE DECLARAS contra tus resultados, no cómo lo redactas:",
    `Después de tu respuesta, en la MISMA salida, agrega un bloque que declare CADA afirmación de hecho que hiciste, una por línea, en JSON, entre las marcas ${MARCA_INICIO} y ${MARCA_FIN}. El usuario no ve el bloque. Una afirmación que no declares se te devuelve («declara o quita»); una declarada sin evidencia en tus resultados no se sirve. Si el Notario te pide SOLO la declaración, devuelve solo el bloque: tu respuesta queda como está.`,
    "- Es afirmación de hecho, y se declara SIEMPRE: cada cifra que citas (también las que van dentro de un orden o una comparación, y las derivadas: una brecha en puntos, una diferencia, una variación en dinero — con su evidencia); cada superlativo u orden (el que más/menos, la más alta, el mayor/peor, segundo, top 3, encabeza, A antes que B); cada comparación en palabras (más que, por encima de, lejos de, más pegado al costo, el doble, casi la mitad, el 47 % de); cada cifra de un grupo (los tres grandes suman/promedian…); cada conteo (8 de 13, 5 cuentas); cada variación (crece, cae, vs año anterior); cada estado (frenado, inmovilizado, en riesgo de quiebre, crítico).",
    "- Tipos y campos: cifra{sujeto, metrica, valor, evidencia?} · orden{sujeto, metrica, orden:{forma: max|min|puesto|topk|comparativo, k, direccion: mayor|menor|peor|mejor, vs}, universo} · relacion{sujeto, metrica, relacion:{forma: veces|fraccion|parte|mayor|menor|igual|diferencia, k, matiz, vs}, valor: \"A vs B\"} · grupo{sujeto: la lista completa, metrica, valor} · conteo{conteo:{n, m, predicado}, universo} · variacion{sujeto, metrica, variacion:{direccion: sube|baja|estable, valor}, periodo} · estado{sujeto, estado:{estado, bodega}} · lectura{sello: probado|indicado|abierto|criterio mío}.",
    "- sujeto: el nombre exacto de la entidad tal como está en tus resultados; \"negocio\" para los totales y las referencias; una lista para grupos y top-k. metrica: el concepto tal como está en el rótulo del resultado (lo que sigue a «Entidad · »): \"Saldo vencido\", \"Contribución no capturada\", \"Brecha al benchmark\", \"Capital frenado\"… valor: la cifra tal como la escribiste; en una comparación, los dos lados: \"A vs B\". universo: de qué conjunto es un orden, un conteo o un subtotal — con el nombre de la CARTA DE HECHOS que acompaña tus resultados (\"los 13 clientes\", \"bajo el benchmark\", \"carga comercial alta\", \"las 5 cuentas materiales\"). periodo: \"vs año anterior\" en toda variación. evidencia: en una cifra derivada, los rótulos con los que se calcula. texto: el fragmento literal de tu respuesta (hasta 80 caracteres) donde está esa afirmación.",
    "- lectura es SOLO para interpretaciones y recomendaciones sin cifra ni orden sobre una métrica; una frase con una cifra, un orden, una comparación o una variación NO es lectura: declárala como el hecho que es.",
    `Ejemplo (uno por tipo):\n${MARCA_INICIO}\n{"tipo":"cifra","sujeto":"Distribuidora Norte","metrica":"Saldo vencido","valor":"$4,6M","texto":"acumula $4,6M vencidos"}\n{"tipo":"cifra","sujeto":"Distribuidora Norte","metrica":"Brecha al benchmark","valor":"8,1 pp","evidencia":["Distribuidora Norte · Margen","Benchmark de margen"],"texto":"8,1 puntos bajo el benchmark"}\n{"tipo":"orden","sujeto":"Comercial Sur","metrica":"Contribución","orden":{"forma":"max"},"universo":"los 13 clientes","texto":"la que más contribución aporta"}\n{"tipo":"relacion","sujeto":"Distribuidora Norte","metrica":"Saldo vencido","relacion":{"forma":"veces","k":2,"matiz":"casi","vs":"Comercial Sur"},"valor":"$4,6M vs $2,5M","texto":"debe casi el doble que Comercial Sur"}\n{"tipo":"grupo","sujeto":["Distribuidora Norte","Comercial Sur","Ferretería Centro"],"metrica":"Ventas","valor":"$38,0M","texto":"las tres grandes suman $38,0M"}\n{"tipo":"conteo","conteo":{"n":8,"m":13,"predicado":"bajo el benchmark"},"universo":"los 13 clientes","texto":"8 de 13 bajo el benchmark"}\n{"tipo":"variacion","sujeto":"Comercial Sur","metrica":"Ventas","variacion":{"direccion":"baja","valor":"-8,2%"},"periodo":"vs año anterior","texto":"cae 8,2% contra el año anterior"}\n{"tipo":"estado","sujeto":"SKU-0001","estado":{"estado":"frenado","bodega":"Bodega Central"},"texto":"está frenado en Bodega Central"}\n{"tipo":"lectura","sello":"criterio mío","texto":"Yo miraría primero a Distribuidora Norte"}\n${MARCA_FIN}`,
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
  /* la moneda sin símbolo («330K», «-2.1M»): dinero con su escala, como cifra más de la prosa */
  const _figsSinSimbolo = [];
  { const rx = /(?<![\d.,$%\w-])([+-]?\d+(?:[.,]\d+)?)\s?([KMB])(?![a-záéíóúñ0-9])/g; let mk; const sN = menosAscii(s); while ((mk = rx.exec(sN))) { if (parseFigures(sN).some((f) => sN.indexOf(f.text) >= 0 && mk.index >= sN.indexOf(f.text) && mk.index < sN.indexOf(f.text) + f.text.length)) continue; const raw = parseFloat(mk[1].replace(",", ".")) * ({ K: 1e3, M: 1e6, B: 1e9 })[mk[2].toUpperCase()]; _figsSinSimbolo.push({ text: mk[0], unit: "money", raw, canon: `money:${mk[1].replace("+", "")}${mk[2].toUpperCase()}` }); } }
  for (const f of [...parseFigures(menosAscii(s)), ..._figsSinSimbolo]) {
    const desde = usados.has(f.text) ? usados.get(f.text) + 1 : 0;
    let pos = posicionDeCifra(s, f.text, desde); if (pos < 0) pos = posicionDeCifra(s, f.text, 0); if (pos < 0) continue;
    usados.set(f.text, pos);
    const cands = I.figs.filter((g) => _mismo(f, g));
    if (!cands.length) continue;
    const o = oracionEn(pos);
    const nombres = nombresEn(o.texto);
    /* la única candidata también tiene que ser coherente con la oración: una fig de Ripley no explica un «$4.7M … en Falabella, Lider y Jumbo» */
    const coherente = (g) => !g.entidad || !nombres.length || nombres.some((n) => normalizar(n) === normalizar(g.entidad));
    let elegida = cands.length === 1 ? (coherente(cands[0]) ? cands[0] : null) : (cands.find((g) => g.entidad && nombres.some((n) => normalizar(n) === normalizar(g.entidad))) || cands.find((g) => !g.entidad && !nombres.length) || null);
    if (!elegida && cands.every((g) => g.unidad === cands[0].unidad && Math.abs(g.raw - cands[0].raw) < 1e-9) && !cands.some((g) => g.entidad && nombres.length && !nombres.some((n) => normalizar(n) === normalizar(g.entidad)))) elegida = cands[0];
    if (!elegida) continue;
    const texto = fragmento(o, pos, f.text.length);
    const base = { texto, valor: f.text, evidencia: [elegida.label], derivada: true };
    if (elegida.agregado && elegida.entidadesDelGrupo.length) out.push({ tipo: "grupo", sujeto: elegida.entidadesDelGrupo.slice(), metrica: elegida.base, universo: elegida.calificador || elegida.concepto, ...base });
    else if (elegida.agregado) out.push({ tipo: "cifra", sujeto: elegida.entidad || "negocio", metrica: elegida.base, universo: elegida.calificador || elegida.concepto, ...base });
    else if (/^variacion vs ano anterior|^crecimiento$|^yoy$|^ventas vs ano anterior$/.test(elegida.conceptoNorm)) out.push({ tipo: "variacion", sujeto: elegida.entidad || "negocio", metrica: "Ventas", variacion: { direccion: elegida.raw > 0 ? "sube" : elegida.raw < 0 ? "baja" : "estable", valor: f.text }, periodo: "vs año anterior", ...base });
    else out.push({ tipo: "cifra", sujeto: elegida.entidad || "negocio", metrica: elegida.concepto, ...base });
  }
  /* conteos: «N de M», «N cuentas/clientes/SKU» → una fig de conteo o un agregado de ese tamaño */
  const reConteo = /\b(\d{1,2})\s+(?:de\s+(?:las?\s+|los\s+)?(\d{1,2})\s+)?(cuentas?|clientes?|skus?|sku|bodegas?|marcas?)\b|\b(\d{1,2})\s+de\s+(?:las?\s+|los\s+)?(\d{1,2})\b/gi;
  let m;
  while ((m = reConteo.exec(s))) {
    const n = +(m[1] || m[4]), mm = m[2] || m[5] ? +(m[2] || m[5]) : null;
    const o = oracionEn(m.index);
    /* las candidatas por valor; si hay más de una, gana la que comparte palabras con lo que sigue al número («5 cuentas materiales» →
     * «· 5 cuentas materiales (de 8 bajo el benchmark)», no «Clientes · sobre el benchmark = 5»); sin palabra en común y con varias, no se deriva */
    const candsC = [...I.figs.filter((g) => g.unidad === "count" && g.raw === n && !g.agregado), ...I.figs.filter((g) => g.agregado && g.n === n && (mm == null || g.m == null || g.m === mm))];
    const tras = new Set(normalizar(s.slice(m.index + m[0].length, m.index + m[0].length + 48)).split(/[^a-z0-9]+/).filter((w) => w.length >= 4));
    const puntaje = (g) => normalizar(g.conceptoNorm + " " + (g.calificador || "")).split(/[^a-z0-9]+/).filter((w) => w.length >= 4 && tras.has(w)).length;
    const cont = candsC.length === 1 ? candsC[0] : (candsC.length ? ([...candsC].sort((x, y) => puntaje(y) - puntaje(x)).filter((g) => puntaje(g) > 0)[0] || null) : null);
    if (!cont) continue;
    const pred = cont.agregado ? (cont.calificador.replace(/^·\s*subtotal\s*·\s*/, "").replace(/^\d+\s+\w+\s+/, "").replace(/\(.*?\)/g, "").trim() || cont.base) : (cont.concepto.replace(/^clientes?\s*·\s*/i, "").trim());
    out.push({ tipo: "conteo", conteo: { n, m: mm, predicado: pred }, universo: mm != null ? `de ${mm}` : (cont.m != null ? `de ${cont.m}` : `los ${I.tamanoDelEje(/sku/.test(String(m[3] || "").toLowerCase()) ? "sku" : "cliente") || ""} ${/sku/.test(String(m[3] || "").toLowerCase()) ? "SKU" : "clientes"}`.replace(/\s+/g, " ")), /* el universo: el «de M» de la fig, o el eje entero del tenant (nunca un 13 a mano) */ texto: fragmento(o, m.index, m[0].length), evidencia: [cont.label], derivada: true });
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
