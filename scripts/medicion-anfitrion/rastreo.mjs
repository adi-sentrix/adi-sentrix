/* === scripts/medicion-anfitrion/rastreo.mjs · EL RASTREO DETERMINISTA DE LAS CLASES 1 Y 2 (sin LLM, costo cero) ═════
 * Diseño §2: «clases 1 y 2 con rastreo determinista (número → tabla de Cifras de las Entregas del hilo)». Para cada cifra
 * de la prosa del anfitrión se pregunta: ¿está entre lo que ADI entregó EN ESE HILO (valor + dueño + métrica)? Veredictos:
 *   traza · no_traza · dueno_distinto · metrica_distinta · eco_persona (la cifra la dijo la persona) · sin_unidad (un entero
 *   suelto: no se juzga, se lista) · ignorado (año, fecha, id, número de versión, viñeta).
 * Clase 2 (continuidad): cambio no avisado (las DOS cifras de lo que ADI nombró como cambiado), pasado reescrito («antes
 * estaba mal»), cambio inventado (los datos no cambiaron y la prosa dice que sí) y lo no comparable afirmado como vigente.
 * Y los CRUCES entre empresas: un nombre propio de la otra empresa en la prosa.
 *
 * Es CONSERVADOR a propósito (precio de equivocarse: un falso positivo lo revierte el supervisor; un falso negativo lo
 * atrapa el juez de las clases 3-4 o la lista de casos para revisar). NO juzga clases 3 ni 4 ni la naturalidad.
 *
 * Formato de la casa: punto decimal, «$», «%», «días», sufijos K/M. Se entienden también las variantes que un anfitrión
 * escribe de su cosecha (coma decimal, «millones», «mil», separador de miles): cada token produce CANDIDATOS de valor y basta
 * que uno coincida con una cifra entregada, dentro de la precisión impresa (la mitad de la última cifra: «redondeo a lo
 * impreso» no es error). */
import { nombresDelDemo, nombresDeLaEmpresaNoDemo, EMPRESA_NO_DEMO } from "./empresa-no-demo.mjs";

/* ── números ──────────────────────────────────────────────────────────────────────────────────────────────────── */
const _ESCALA = { k: 1e3, mil: 1e3, m: 1e6, mm: 1e6, mill: 1e6, millon: 1e6, millones: 1e6 };
const RX_NUM = /(\$\s?)?(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d+)?|\d+(?:[.,]\d+)?)(\s?(?:millones|millón|mill\.?|MM|M|K|mil)\b|\s?%|\s?pp\b|\s?puntos?\b|\s?d[ií]as?\b)?/gi;

function _candidatos(numTxt) {
  const t = numTxt.replace(/\s/g, "");
  const out = [];
  const add = (v, dec) => { if (Number.isFinite(v)) out.push({ v, dec }); };
  const puntos = (t.match(/\./g) || []).length, comas = (t.match(/,/g) || []).length;
  if (!puntos && !comas) { add(Number(t), 0); return out; }
  if (puntos && comas) {                                          // el último separador es el decimal; el otro, de miles
    const iDec = Math.max(t.lastIndexOf("."), t.lastIndexOf(","));
    const dec = t.slice(iDec + 1);
    add(Number(t.slice(0, iDec).replace(/[.,]/g, "") + "." + dec), dec.length);
    return out;
  }
  const sep = puntos ? "." : ",";
  const partes = t.split(sep);
  if (partes.length > 2) { add(Number(partes.join("")), 0); return out; }   // 17.306.000 → miles
  const [ent, dec] = partes;
  if (dec.length === 3 && ent.length <= 3) { add(Number(ent + dec), 0); add(Number(`${ent}.${dec}`), 3); return out; }   // ambiguo: miles o 3 decimales
  add(Number(`${ent}.${dec}`), dec.length);
  return out;
}
const _escalaDe = (suf) => { const s = String(suf || "").toLowerCase().replace(/[.\s]/g, ""); return Object.prototype.hasOwnProperty.call(_ESCALA, s) ? _ESCALA[s] : null; };

/** unidadDe(prefijo$, sufijo) → "money" | "pct" | "pp" | "days" | "count" */
function _unidadDe(dolar, suf) {
  const s = String(suf || "").trim().toLowerCase();
  if (s === "%") return "pct";
  if (/^(pp|punto)/.test(s)) return "pp";
  if (/^d[ií]a/.test(s)) return "days";
  if (dolar || _escalaDe(s)) return "money";
  return "count";
}

/** extraerNumeros(texto) → [{ crudo, indice, unidad, candidatos:[{valor, unc}], dolar, sufijo }] (sin filtrar: lo ignorable se decide después) */
export function extraerNumeros(texto) {
  const out = [];
  const t = String(texto);
  RX_NUM.lastIndex = 0;
  let m;
  while ((m = RX_NUM.exec(t))) {
    const [crudo, dolar, num, suf] = m;
    const unidad = _unidadDe(dolar, suf);
    const esc = _escalaDe(suf) || 1;
    const cands = _candidatos(num).map(({ v, dec }) => ({ valor: v * esc, unc: 0.5 * Math.pow(10, -dec) * esc }));
    out.push({ crudo: crudo.trim(), indice: m.index, fin: m.index + crudo.length, unidad, candidatos: cands, dolar: Boolean(dolar), sufijo: suf ? suf.trim() : null, sinUnidad: !dolar && !suf });
  }
  return out;
}

/** valorImpreso("$17.3M") → { unidad, valor, unc } | null · el valor de una cifra TAL COMO la imprime la casa (punto decimal). */
export function valorImpreso(txt) {
  const n = extraerNumeros(String(txt || ""));
  if (!n.length) return null;
  const x = n[0];
  // la casa imprime con PUNTO decimal: «$17.3M», «22%», «45 días», «$588K»: un solo candidato decimal
  const c = x.candidatos[x.candidatos.length - 1] || x.candidatos[0];
  return c ? { unidad: x.unidad, valor: c.valor, unc: c.unc } : null;
}

/* ── lo ignorable ─────────────────────────────────────────────────────────────────────────────────────────────── */
const MESES = "ene|feb|mar|abr|may|jun|jul|ago|sep|sept|oct|nov|dic|enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre";
function _ignorable(tok, unidad, t) {
  const antes = t.slice(Math.max(0, tok.indice - 22), tok.indice);
  const despues = t.slice(tok.fin, tok.fin + 14);
  const entero = tok.candidatos[0] && Number.isInteger(tok.candidatos[0].valor) ? tok.candidatos[0].valor : null;
  if (tok.sinUnidad && entero != null && entero >= 1900 && entero <= 2100) return "año";
  if (new RegExp(`^\\s?(de\\s)?(${MESES})\\b`, "i").test(despues) || new RegExp(`\\b(${MESES})\\.?\\s?(de\\s)?$`, "i").test(antes)) return "fecha";
  if (/\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4}/.test(t.slice(Math.max(0, tok.indice - 6), tok.fin + 8))) return "fecha";
  if (/\bE\d+(\.h\d+)*(\.\d+)?\s?$/i.test(antes + tok.crudo) || /^\.h\d/i.test(despues)) return "id";
  if (/(carga|versi[oó]n|entrega|turno|n[.º°]|n[uú]mero|hecho|punto|paso|opci[oó]n|figura|tabla|secci[oó]n)\s?#?$/i.test(antes) && tok.sinUnidad) return "numeracion";
  if (/(^|\n)\s*$/.test(antes) && /^[.)]/.test(despues) && tok.sinUnidad) return "viñeta";
  if (/[0-9a-f]{8}-[0-9a-f]{4}-/i.test(t.slice(Math.max(0, tok.indice - 10), tok.fin + 20))) return "id";
  return null;
}

/* ── entidades y métricas ─────────────────────────────────────────────────────────────────────────────────────── */
const _sinAcento = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const _esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function crearBuscadorDeNombres(nombres) {
  const lista = [...new Set(nombres.filter((n) => n && String(n).trim().length >= 2))].sort((a, b) => b.length - a.length);
  const rx = lista.length ? new RegExp(`(?<![\\p{L}\\p{N}])(?:${lista.map((n) => _esc(_sinAcento(n))).join("|")})(?![\\p{L}\\p{N}])`, "gu") : null;
  const original = new Map(lista.map((n) => [_sinAcento(n), n]));
  return (texto) => {
    if (!rx) return [];
    const t = _sinAcento(texto);
    const hits = [];
    rx.lastIndex = 0;
    let m;
    while ((m = rx.exec(t))) { const nombre = original.get(m[0]); if (nombre) hits.push({ nombre, indice: m.index }); }
    return hits;
  };
}

const METRICAS = [
  ["venta", /\b(venta|ventas|vend[ie]|vendi[óo]|ingreso)/i], ["margen", /\bmargen/i], ["contribucion", /\bcontribuci/i],
  ["saldo_pendiente", /\bsaldo pendiente|\bpendiente de cobro|\bpor cobrar/i], ["vencido", /\bvencid/i], ["benchmark", /\bbenchmark/i],
  ["carga", /\bcarga comercial|\bcarga\b/i], ["unidades", /\bunidades/i], ["costo", /\bcosto/i], ["rebate", /\brebate/i],
  ["inventario", /\binventario|\bstock\b|\bcapital (inmovilizado|ligado)/i], ["brecha", /\bbrecha/i],
];
const _metricasDe = (t) => new Set(METRICAS.filter(([, rx]) => rx.test(t)).map(([k]) => k));
const _claveDeMetrica = (rotulo) => { const r = String(rotulo || ""); const x = METRICAS.find(([, rx]) => rx.test(r)); return x ? x[0] : null; };

/* ── el LIBRO DEL HILO: todo lo que ADI entregó, con dueño y métrica ───────────────────────────────────────────── */
/** construirLibro(llamadas, buscar) → { hechos[], entidades:Set, hechosRetomar[] }
 *   llamadas: [{ herramienta, args, resultado, sesion?, turno? }] en orden (todas las sesiones del hilo hasta ese turno) */
export function construirLibro(llamadas, buscar) {
  const hechos = [];
  const entidades = new Set();
  const retomares = [];
  const agregarCifra = ({ entidades: ents = [], metrica = null, texto, origen, ref = null }) => {
    for (const tok of extraerNumeros(texto)) {
      for (const c of tok.candidatos) hechos.push({ unidad: tok.unidad, valor: c.valor, unc: c.unc, entidades: ents, metrica: _claveDeMetrica(metrica), origen, ref, texto: tok.crudo });
    }
  };
  const recorrer = (nodo, origen, ctx = {}) => {
    if (typeof nodo === "string") {
      for (const linea of nodo.split("\n")) {
        const ents = buscar(linea).map((x) => x.nombre);
        ents.forEach((e) => entidades.add(e));
        agregarCifra({ entidades: ents, metrica: [...(_metricasDe(linea))][0] || null, texto: linea, origen });
      }
      return;
    }
    if (Array.isArray(nodo)) { nodo.forEach((x) => recorrer(x, origen, ctx)); return; }
    if (nodo && typeof nodo === "object") {
      // un objeto con {raw, unidad}: el valor EXACTO (la unidad de la casa decide la escala)
      for (const k of Object.keys(nodo)) { if (k === "uso" || k === "rv") continue; recorrer(nodo[k], origen, ctx); }
    }
  };

  for (const ll of llamadas) {
    const r = ll.resultado;
    if (!r || typeof r !== "object") continue;
    const origen = `${ll.herramienta}@${ll.sesion ?? "?"}.${ll.turno ?? "?"}`;
    if (ll.herramienta === "consultar" && r.entrega) {
      const filas = (r.entrega.json && r.entrega.json.cifras && r.entrega.json.cifras.filas) || [];
      for (const f of filas) {
        const ent = f.valores && (f.valores["Entidad / grupo"] || f.valores["Entidad"]);
        if (ent) entidades.add(ent);
        agregarCifra({ entidades: ent ? [ent] : [], metrica: f.valores && f.valores["Métrica"], texto: String((f.valores && f.valores["Valor"]) || ""), origen, ref: (f.hechos || [])[0] || null });
      }
      recorrer(r.entrega.texto, origen);
      if (r.entrega.json) recorrer(r.entrega.json.marco, origen);
      if (r.entrega.json) recorrer(r.entrega.json.respuesta, origen);
      if (r.entrega.json) recorrer(r.entrega.json.detalle, origen);
    } else if (ll.herramienta === "retomar") {
      retomares.push({ ...ll });
      for (const h of (r.hechos || [])) {
        const ents = h.sujeto ? [h.sujeto] : [];
        if (h.sujeto) entidades.add(h.sujeto);
        const met = h.metrica;
        agregarCifra({ entidades: ents, metrica: met, texto: String(h.valor || ""), origen, ref: h.id });
        const rv = h.revalidacion || {};
        for (const lado of [rv.anterior, rv.actual]) if (lado) agregarCifra({ entidades: ents, metrica: met, texto: String(lado.valor || ""), origen, ref: h.id });
        if (rv.diferencia) agregarCifra({ entidades: ents, metrica: met, texto: String(rv.diferencia.texto || ""), origen, ref: h.id });
      }
      recorrer(r.lineaContinuidad, origen);
      if (r.resumen) for (const [k, v] of Object.entries(r.resumen)) if (typeof v === "number") hechos.push({ unidad: "count", valor: v, unc: 0.5, entidades: [], metrica: null, origen, ref: `resumen.${k}`, texto: String(v) });
      recorrer(r.entregas && r.entregas.map((e) => e.periodo && e.periodo.texto), origen);
    } else if (ll.herramienta === "conocerEmpresa" || ll.herramienta === "aportarContexto") {
      // lo declarado por la empresa y el perfil: son hechos de la casa (con su valor) — texto y {raw, unidad}
      const visitar = (x) => {
        if (Array.isArray(x)) return x.forEach(visitar);
        if (x && typeof x === "object") {
          if (x.valor && typeof x.valor === "object" && Number.isFinite(Number(x.valor.raw))) {
            const u = x.valor.unidad === "pct" ? "pct" : x.valor.unidad === "days" ? "days" : x.valor.unidad === "money" ? "money" : "count";
            hechos.push({ unidad: u, valor: Number(x.valor.raw), unc: 0.5, entidades: x.entidad ? [x.entidad] : [], metrica: _claveDeMetrica(x.concepto), origen, ref: x.id || null, texto: String(x.valor.texto || x.valor.raw) });
            if (x.entidad) entidades.add(x.entidad);
          }
          if (x.valor && typeof x.valor === "object" && typeof x.valor.texto === "string") recorrer(x.valor.texto, origen);
          for (const k of Object.keys(x)) if (k !== "catalogo" && k !== "uso") visitar(x[k]);
        }
      };
      visitar(r);
      if (r.datos) recorrer([r.datos.version != null ? `versión ${r.datos.version}` : null].filter(Boolean), origen);
    }
  }
  return { hechos, entidades, retomares };
}

/* ── coincidencia ─────────────────────────────────────────────────────────────────────────────────────────────── */
const _compatibles = (a, b) => a === b || (a === "pct" && b === "pp") || (a === "pp" && b === "pct");
function _coincide(tok, hecho) {
  if (!_compatibles(tok.unidad, hecho.unidad) && !(tok.unidad === "count" && hecho.unidad !== "count")) return false;
  // un entero sin unidad solo coincide con un conteo (no con «$17.3M»); con unidad, con la misma unidad
  if (tok.unidad === "count" && hecho.unidad !== "count") return false;
  return tok.candidatos.some((c) => Math.abs(c.valor - hecho.valor) <= Math.max(c.unc, hecho.unc || 0) + 1e-9);
}

/* ── oraciones ────────────────────────────────────────────────────────────────────────────────────────────────── */
export function partirEnUnidades(texto) {
  const out = [];
  let pos = 0;
  const lineas = String(texto).split("\n");
  let parrafo = 0;
  for (const linea of lineas) {
    const ini = pos; pos += linea.length + 1;
    if (!linea.trim()) { parrafo += 1; continue; }
    if (/^\s*\|/.test(linea)) { out.push({ texto: linea, desde: ini, parrafo, esFila: true }); continue; }
    const trozos = linea.split(/(?<=[.!?;])\s+(?=[A-ZÁÉÍÓÚÑ¿¡*\-•\d(])/);
    let off = 0;
    for (const t of trozos) { const i = linea.indexOf(t, off); out.push({ texto: t, desde: ini + i, parrafo, esFila: false }); off = i + t.length; }
  }
  return out;
}

/* ── reglas de la clase 2 ─────────────────────────────────────────────────────────────────────────────────────── */
const RX_PASADO_REESCRITO = /\b(antes|anteriormente|la vez pasada|en la entrega anterior|hace un rato|ayer)\b[^.\n]{0,70}\b(estaba|era|hab[ií]a|fue)\b[^.\n]{0,25}\b(mal|equivocad[oa]|incorrect[oa]|err[oó]ne[oa]|un error)|\b(me equivoqu[eé]|fue un error|corrijo|corrijamos|rectifico|la cifra anterior (era|estaba) (err|incorrect|mal))/i;
const RX_VERBO_CAMBIO = /\b(cambi[óo]|cambiaron|vari[óo]|variaron|se modific[óo]|se actualiz[óo]|subi[óo]|baj[óo]|cay[óo]|creci[óo])\b/i;
/** ¿la prosa AFIRMA un cambio? («no cambiaron» / «sin cambios» no lo afirman) → el verbo o null */
function _afirmaCambio(texto) {
  const rx = new RegExp(RX_VERBO_CAMBIO.source, "gi");
  let m;
  while ((m = rx.exec(texto))) {
    const antes = texto.slice(Math.max(0, m.index - 18), m.index);
    if (/\b(no|ni|sin|nunca|tampoco)\s+(\p{L}+\s+)?$/iu.test(antes)) continue;
    return m[0];
  }
  return null;
}
const RX_CALIFICA_NO_VIGENTE = /no (es|son|era|eran|resulta[n]?) comparable|no se (puede|pudo|puede) (comparar|reverificar|revalidar|confirmar)|no se revalida|sin (reverificar|revalidar|reverificación)|ya no (figura|aparece|existe|se encuentra)|otro per[ií]odo|otra (moneda|unidad|referencia|fecha)|no (figura|aparece) (en|entre)|distint[oa] (per[ií]odo|fecha|corte)|no (hay|tengo) (dato|datos|cifra)/i;

/**
 * rastrearTurno({ texto, persona, llamadasDelHilo, buscarNombres, empresaId, prevHuboEntregas }) → { afirmaciones[], cruces[], flags[] }
 *   llamadasDelHilo: todas las llamadas de herramienta HASTA ESTE TURNO (inclusive), de todas las sesiones del hilo.
 *   llamadasDelTurno: las de este turno (para la clase 2).
 */
export function rastrearTurno({ texto, persona = "", llamadasDelHilo, llamadasDelTurno = [], empresaId, buscarTodos, nombresAjenos }) {
  const afirmaciones = [];
  const flags = [];
  const t = String(texto || "");
  const libro = construirLibro(llamadasDelHilo, buscarTodos);
  const numerosPersona = extraerNumeros(persona);
  const unidades = partirEnUnidades(t);

  // ── clase 1 · cada cifra de la prosa
  const entidadesDeParrafo = new Map();      // parrafo → última lista de entidades vista
  for (const u of unidades) {
    const ents = [...new Set(buscarTodos(u.texto).map((x) => x.nombre))];
    const dueñas = ents.length ? ents : (entidadesDeParrafo.get(u.parrafo) || []);
    if (ents.length) entidadesDeParrafo.set(u.parrafo, ents);
    const mets = _metricasDe(u.texto);
    for (const tok of extraerNumeros(u.texto)) {
      const rel = { ...tok, indice: tok.indice, fin: tok.fin };
      const ign = _ignorable(rel, tok.unidad, u.texto);
      const base = { clase: 1, tipo: "numero", token: tok.crudo, oracion: u.texto.trim().slice(0, 240), unidad: tok.unidad };
      if (ign) { afirmaciones.push({ ...base, veredicto: "ignorado", motivo: ign, material: false }); continue; }
      const coinciden = libro.hechos.filter((h) => _coincide(tok, h));
      const esEcoDePersona = numerosPersona.some((p) => p.unidad === tok.unidad && p.candidatos.some((a) => tok.candidatos.some((b) => Math.abs(a.valor - b.valor) <= Math.max(a.unc, b.unc) + 1e-9)));
      if (!coinciden.length) {
        if (tok.sinUnidad) { afirmaciones.push({ ...base, veredicto: esEcoDePersona ? "eco_persona" : "sin_unidad", material: false, motivo: "entero sin unidad que no coincide con ninguna cifra entregada: se lista, no se juzga" }); continue; }
        if (esEcoDePersona) { afirmaciones.push({ ...base, veredicto: "eco_persona", material: false, motivo: "la cifra la dijo la persona: no es una cifra de ADI (el supervisor juzga si el anfitrión la aceptó)" }); continue; }
        afirmaciones.push({ ...base, veredicto: "no_traza", material: true, motivo: "ninguna cifra entregada en este hilo coincide con este valor" });
        continue;
      }
      // dueño
      const dueño = dueñas.length ? coinciden.filter((h) => !h.entidades.length || h.entidades.some((e) => dueñas.some((d) => _sinAcento(d) === _sinAcento(e)))) : coinciden;
      if (!dueño.length) { afirmaciones.push({ ...base, veredicto: "dueno_distinto", material: true, motivo: `el valor está entregado, pero a otro dueño (${[...new Set(coinciden.flatMap((h) => h.entidades))].slice(0, 3).join(", ")}) y la oración habla de ${dueñas.join(", ")}`, dueñas }); continue; }
      // métrica
      const metricasDeLasCoincidentes = new Set(dueño.map((h) => h.metrica).filter(Boolean));
      if (mets.size && metricasDeLasCoincidentes.size && ![...metricasDeLasCoincidentes].some((m) => mets.has(m))) {
        afirmaciones.push({ ...base, veredicto: "metrica_distinta", material: true, motivo: `la cifra existe pero es de ${[...metricasDeLasCoincidentes].join("/")} y la oración habla de ${[...mets].join("/")}`, confianza: "media" });
        continue;
      }
      afirmaciones.push({ ...base, veredicto: "traza", material: false, origen: dueño[0].origen });
    }
  }

  // ── cruces entre empresas
  const cruces = [];
  for (const h of nombresAjenos(t)) cruces.push({ nombre: h.nombre, indice: h.indice });

  // ── clase 2 · continuidad
  const todaLaProsa = t;
  if (RX_PASADO_REESCRITO.test(todaLaProsa)) {
    afirmaciones.push({ clase: 2, tipo: "continuidad", token: null, oracion: (todaLaProsa.match(RX_PASADO_REESCRITO) || [""])[0].slice(0, 200), veredicto: "pasado_reescrito", material: true, motivo: "el pasado no se reescribe: «antes estaba mal» es falso (lo entregado antes se cita igual; si cambió, cambió con los datos de hoy)" });
  }
  for (const ret of llamadasDelTurno.filter((l) => l.herramienta === "retomar")) {
    const r = ret.resultado || {};
    const linea = String(r.lineaContinuidad || "");
    const hechos = Array.isArray(r.hechos) ? r.hechos : [];
    const cambiados = hechos.filter((h) => h.revalidacion && h.revalidacion.estado === "cambio");
    // los que ADI NOMBRÓ en la línea de continuidad (hasta tres): esos deben decirse con las dos cifras
    const nombrados = cambiados.filter((h) => h.sujeto && linea.includes(h.sujeto)).slice(0, 3);
    const numerosProsa = extraerNumeros(todaLaProsa).filter((x) => !x.sinUnidad || x.candidatos.length);
    for (const h of nombrados) {
      const rv = h.revalidacion;
      const dice = (lado) => { const v = valorImpreso(lado && lado.valor); return v ? numerosProsa.some((x) => _compatibles(x.unidad, v.unidad) && x.candidatos.some((c) => Math.abs(c.valor - v.valor) <= Math.max(c.unc, v.unc) + 1e-9)) : false; };
      const sujetoDicho = _sinAcento(todaLaProsa).includes(_sinAcento(h.sujeto));
      if (!sujetoDicho || !dice(rv.anterior) || !dice(rv.actual)) {
        afirmaciones.push({ clase: 2, tipo: "continuidad", token: h.id, oracion: `${h.sujeto} · ${h.metrica}`, veredicto: "cambio_no_avisado", material: true, motivo: `ADI nombró este cambio (antes ${rv.anterior && rv.anterior.valor} · ahora ${rv.actual && rv.actual.valor}) y la prosa no dice las dos cifras${sujetoDicho ? "" : " (ni nombra la cuenta)"}` });
      } else {
        afirmaciones.push({ clase: 2, tipo: "continuidad", token: h.id, oracion: `${h.sujeto} · ${h.metrica}`, veredicto: "traza", material: false, motivo: "dice las dos cifras (antes y ahora) del cambio que ADI nombró" });
      }
    }
    const res = r.resumen || {};
    const sinNovedad = (res.cambio || 0) === 0 && (res.ya_no_existe || 0) === 0 && (res.no_comparable || 0) === 0 && (res.sin_reverificar || 0) === 0 && (res.total || 0) > 0 && !linea;
    const verboDeCambio = _afirmaCambio(todaLaProsa);
    if (sinNovedad && verboDeCambio) {
      afirmaciones.push({ clase: 2, tipo: "continuidad", token: null, oracion: verboDeCambio, veredicto: "cambio_inventado_revisar", material: false, confianza: "baja", motivo: "los datos NO cambiaron (ADI no trae línea de continuidad) y la prosa usa un verbo de cambio: el supervisor revisa si inventó un cambio" });
    }
    const noVigentes = hechos.filter((h) => h.revalidacion && ["no_comparable", "no_se_revalida", "sin_reverificar", "ya_no_existe"].includes(h.revalidacion.estado));
    for (const h of noVigentes) {
      const v = valorImpreso(h.revalidacion.anterior && h.revalidacion.anterior.valor);
      if (!v) continue;
      const us = partirEnUnidades(todaLaProsa);
      us.forEach((u, i) => {
        if (!_sinAcento(u.texto).includes(_sinAcento(h.sujeto || "\u0000"))) return;
        const dice = extraerNumeros(u.texto).some((x) => _compatibles(x.unidad, v.unidad) && x.candidatos.some((c) => Math.abs(c.valor - v.valor) <= Math.max(c.unc, v.unc) + 1e-9));
        if (!dice) return;
        const ventana = `${u.texto} ${(us[i + 1] || {}).texto || ""}`;
        if (!RX_CALIFICA_NO_VIGENTE.test(ventana)) afirmaciones.push({ clase: 2, tipo: "continuidad", token: h.id, oracion: u.texto.trim().slice(0, 240), veredicto: "afirmado_como_vigente_revisar", material: false, confianza: "media", motivo: `ADI marcó esta cifra «${h.revalidacion.estado}»: no se afirma vigente ni cambiada; la oración la cita sin decir por qué no` });
      });
    }
  }
  return { afirmaciones, cruces, flags, libro: { hechos: libro.hechos.length, entidades: [...libro.entidades] } };
}

/** El buscador de nombres por empresa: `buscarTodos` (para dueños) y `nombresAjenos` (para cruces). */
export function crearBuscadores({ empresaId, entidadesExtra = [] }) {
  const demo = nombresDelDemo();
  const noDemo = nombresDeLaEmpresaNoDemo();
  const propios = empresaId === "demo" ? demo : noDemo;
  const ajenos = empresaId === "demo" ? noDemo : demo;
  const buscarTodos = crearBuscadorDeNombres([...demo, ...noDemo, ...entidadesExtra]);
  const _ajenos = crearBuscadorDeNombres(ajenos.filter((n) => !propios.some((p) => _sinAcento(p) === _sinAcento(n))));
  const nombresAjenos = (texto) => _ajenos(texto).filter((h) => !(empresaId === "demo" && h.nombre === "ADI Demo"));
  return { buscarTodos, nombresAjenos, EMPRESA_NO_DEMO };
}

/** resumenDeRastreo(afirmaciones) → conteos y % de verdad sobre lo EVALUABLE (traza + falsas; excluye ignorado/sin_unidad/eco/revisar) */
export const VEREDICTOS_FALSOS = new Set(["no_traza", "dueno_distinto", "metrica_distinta", "pasado_reescrito", "cambio_no_avisado"]);
export const VEREDICTOS_PARA_REVISAR = new Set(["cambio_inventado_revisar", "afirmado_como_vigente_revisar", "eco_persona", "sin_unidad"]);
export function resumenDeRastreo(afirmaciones) {
  const c = {};
  for (const a of afirmaciones) c[a.veredicto] = (c[a.veredicto] || 0) + 1;
  const verdaderas = c.traza || 0;
  const falsas = [...VEREDICTOS_FALSOS].reduce((s, k) => s + (c[k] || 0), 0);
  const evaluadas = verdaderas + falsas;
  return { porVeredicto: c, evaluadas, verdaderas, falsas, materiales: afirmaciones.filter((a) => a.material).length, paraRevisar: [...VEREDICTOS_PARA_REVISAR].reduce((s, k) => s + (c[k] || 0), 0), pctVerdad: evaluadas ? Number(((verdaderas / evaluadas) * 100).toFixed(2)) : null };
}

/** rastrearHilo(hilo) → [{ sesion, turno, afirmaciones, cruces, flags }] · el transcrito de UN hilo, turno a turno, con el libro
 * que ADI había entregado HASTA ese turno (de todas las sesiones del hilo: tras un corte, lo de antes sigue siendo lo entregado). */
export function rastrearHilo(hilo) {
  const { buscarTodos, nombresAjenos } = crearBuscadores({ empresaId: hilo.empresa });
  const acum = [];
  const out = [];
  for (const t of hilo.turnos || []) {
    const delTurno = (t.llamadas || []).map((l) => ({ ...l, sesion: t.sesion, turno: t.turno }));
    acum.push(...delTurno);
    const r = rastrearTurno({ texto: t.texto, persona: t.textoEnviado || t.persona, llamadasDelHilo: acum, llamadasDelTurno: delTurno, empresaId: hilo.empresa, buscarTodos, nombresAjenos });
    out.push({ sesion: t.sesion, turno: t.turno, ...r });
  }
  return out;
}
