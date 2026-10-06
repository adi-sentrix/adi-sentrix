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
import { extraerNumerosEnPalabras, relacionesEnPalabras } from "./numerosEnPalabras.mjs";

/* ── EL CONTRATO DEL ANFITRIÓN (owner 2026-10-05, `_ADI_DISENO_CONTRATO_ANFITRION.md` §3): TRES casos por cifra empresarial ───────────────────────────────────────────────────────────────
 * «Toda cifra empresarial que el anfitrión diga —en números o en palabras— debe ser un hecho que ADI le entregó en esta conversación.» El rastreo ya no pregunta solo «¿es verdad?»: clasifica cada cifra.
 *   hecho_de_adi      coincide, a la precisión impresa, con una cifra entregada en ESE hilo (`cifras`, `apoyo`, `fueraDelTexto`, `retomar.hechos` y los `D` de `derivar`), con el dueño y la métrica de la oración;
 *                     o la declaró la persona (no es verdad nueva del anfitrión).
 *   fuera_de_contrato NO está entregada pero es aritméticamente demostrable con lo entregado (una suma de hasta cinco cifras, una diferencia, un cociente sobre una base entregada, un conteo o una relación en
 *                     palabras que cierran): es VERDAD, no es falso —no cuenta contra la verdad—, pero rompe el contrato: queda registrada la derivación que debió pedirse a ADI (`derivacionQueDebioPedirse`).
 *   error_material    ni entregada ni demostrable; o entregada a otro dueño o métrica; o un conteo o una relación que no cierra.
 * Es MEDICIÓN, no producto: por eso el rastreo SÍ lee números en palabras y SÍ lee la prosa con reglas (`numerosEnPalabras.mjs`); ADI no lo hace nunca. */
export const CASOS_DEL_CONTRATO = Object.freeze(["hecho_de_adi", "fuera_de_contrato", "error_material"]);

/* ── LAS REGLAS DE LA RECLASIFICACIÓN (owner 2026-10-05, tras el ensayo 2) ─────────────────────────────────────────
 * El ensayo 2 marcó 169 errores materiales; el clasificador (`ensayo-2/clasificacion.md`) demostró cuáles eran fallas del VERIFICADOR (la afirmación era
 * verdadera según lo entregado o lo dicho por la persona) y cuáles errores reales. Cada regla de abajo cierra UN patrón demostrado, no un caso:
 *   dias_d          «269d» es como la casa imprime los días: la Entrega los trae así y el rastreo no los leía como días.
 *   libro_numerico  las cifras que ADI entrega como DATO y no como texto (criterio declarado y el que desplaza, rango aceptado del criterio) también son lo entregado.
 *   persona         lo que la PERSONA declaró en el hilo (en una oración declarativa, no una pregunta) es suyo: citarlo no es inventarlo (con su origen).
 *   referencia      la referencia de la empresa (el benchmark) no es de una cuenta: vale dicha junto a cualquiera; y una cifra de la empresa vale en una oración que no nombra cuenta.
 *   alias           «Maipo», «Andes del Sur»: el nombre abreviado e inequívoco de una cuenta es la cuenta (el dueño de la cifra no se pierde).
 *   entero          un entero sin unidad (puesto «2», «los 13 clientes», «15 unidades») no tiene dueño ni métrica que juzgar: se lista, no se juzga.
 *   metrica         la métrica de la oración se lee en SU cláusula; «unidades» solo es de un conteo; «bajo/sobre el benchmark» compara un margen (o lo que se mide contra él).
 *   derivacion      la suma o diferencia de DOS cifras (entregadas o declaradas por la persona) que cierra exacto, también cuando el valor coincide por azar con la cifra de otra cuenta.
 *   contraparte     «Norvik (24.2% frente a 24.0%)»: tras «frente a/contra/vs» o antes de nombrar la cuenta («Sus ventas son…»), la cifra puede ser de la contraparte que el hilo ya nombró.
 *   cruce_persona   un nombre que la PERSONA escribió en el hilo no es un cruce cuando el anfitrión lo repite (para decir que no está, o para contestarle).
 *   colectivo       «El resto está entre 15 y 58 días»: el sujeto es un conjunto, no la última cuenta nombrada; sus cifras no tienen un dueño que juzgar.
 *   apoyo           las cuentas que ADI calcula y entrega en `apoyo` («Andes del Sur · Ventas = $40.8M − Costa Verde · Ventas = $31.1M = $9.8M») son lo entregado: la diferencia ya viene hecha.
 *   tema            «Su margen es 28%» (viñeta bajo «Cadena Quillay quedó 5.º…»): una oración sin cuenta habla de la última cuenta nombrada O del tema con que abrió el párrafo.
 * `REGLAS` es mutable SOLO para el análisis (el clasificador y el gate apagan una regla a la vez para demostrar que cada una hace falta). En producción de la medición: todas encendidas. */
export const REGLAS = { dias_d: true, libro_numerico: true, persona: true, referencia: true, alias: true, entero: true, metrica: true, derivacion: true, contraparte: true, cruce_persona: true, colectivo: true, tema: true, apoyo: true };

const _STOP_ALIAS = new Set(["mayor", "norte", "libre", "verde", "claro", "sur", "personal", "blanca", "cocina", "lavado", "aseo", "obras", "construccion", "almacenes", "comercial", "centro", "casa", "hogar", "grandes", "tiendas", "cadena", "mercado", "oeste", "este", "nuevo", "nueva", "grande", "constructor", "mercantil", "distribuidora", "mayorista", "supermercados", "bazar", "ferreteria"]);
const _ART_ALIAS = new Set(["el", "la", "los", "las", "de", "del", "y"]);
/** Los alias inequívocos de un nombre de varias palabras: sus sufijos sin el rótulo genérico del comienzo («Centro Constructor Maipo» → «Maipo», «Constructor Maipo»; «Mayorista El Roble» → «El Roble», «Roble»). Un alias vale solo si es de UN nombre y no es una palabra corriente. */
export function aliasesDe(nombres, sinAcento) {
  const cuenta = new Map();
  const candidatos = [];
  const completos = new Set(nombres.map(sinAcento));
  for (const n of nombres) {
    const pal = String(n).trim().split(/\s+/);
    if (pal.length < 2) continue;
    for (let i = 1; i < pal.length; i++) {
      if (_ART_ALIAS.has(sinAcento(pal[i]))) continue;                       // un alias no empieza en un artículo… (se agrega abajo con él)
      const suf = pal.slice(i).join(" ");
      const variantes = [suf];
      if (i >= 1 && _ART_ALIAS.has(sinAcento(pal[i - 1])) && ["el", "la", "los", "las"].includes(sinAcento(pal[i - 1]))) variantes.push(`${pal[i - 1]} ${suf}`);
      for (const v of variantes) {
        const k = sinAcento(v);
        if (k.length < 5 || (!k.includes(" ") && _STOP_ALIAS.has(k)) || completos.has(k)) continue;
        candidatos.push([k, n]);
        cuenta.set(k, new Set([...(cuenta.get(k) || []), sinAcento(n)]));
      }
    }
  }
  const out = new Map();
  for (const [k, n] of candidatos) if ((cuenta.get(k) || new Set()).size === 1) out.set(k, n);
  return out;
}

/* ── números ──────────────────────────────────────────────────────────────────────────────────────────────────── */
const _ESCALA = { k: 1e3, mil: 1e3, m: 1e6, mm: 1e6, mill: 1e6, millon: 1e6, millones: 1e6 };
const RX_NUM = /(\$\s?)?(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d+)?|\d+(?:[.,]\d+)?)(\s?(?:millones|millón|mill\.?|MM|M|K|mil)(?![A-Za-zÁÉÍÓÚÜÑáéíóúüñ])|\s?%|\s?pp\b|\s?puntos?\b|\s?d[ií]as?\b|d(?![A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9]))?/gi;

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
  if (/^d[ií]a/.test(s) || s === "d") return "days";      // «269d»: los días como los imprime la casa
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
    const [crudo, dolar, num, sufRaw] = m;
    const suf = (sufRaw && sufRaw.trim().toLowerCase() === "d" && !REGLAS.dias_d) ? undefined : sufRaw;     // (interruptor de análisis: sin la regla, «269d» es un entero)
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
  if (/\bE\d+(\.h\d+)*(\.\d+)?\s?$/i.test(antes + tok.crudo) || /^\.h\d/i.test(despues) || /\bD\d+\s?$/.test(antes + tok.crudo)) return "id";   /* un id de la casa: E3.h2 (cifra entregada) o D1 (derivación de ADI) */
  if (/(carga|versi[oó]n|entrega|turno|n[.º°]|n[uú]mero|hecho|punto|paso|opci[oó]n|figura|tabla|secci[oó]n)\s?#?$/i.test(antes) && tok.sinUnidad) return "numeracion";
  if (/(^|\n)\s*$/.test(antes) && /^[.)]/.test(despues) && tok.sinUnidad) return "viñeta";
  if (/[0-9a-f]{8}-[0-9a-f]{4}-/i.test(t.slice(Math.max(0, tok.indice - 10), tok.fin + 20))) return "id";
  return null;
}

/* ── entidades y métricas ─────────────────────────────────────────────────────────────────────────────────────── */
const _sinAcento = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const _esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function crearBuscadorDeNombres(nombres, { alias = false } = {}) {
  const lista = [...new Set(nombres.filter((n) => n && String(n).trim().length >= 2))].sort((a, b) => b.length - a.length);
  const original = new Map(lista.map((n) => [_sinAcento(n), n]));
  if (alias) for (const [k, n] of aliasesDe(lista, _sinAcento)) if (!original.has(k)) original.set(k, n);       // el nombre abreviado e inequívoco de una cuenta es la cuenta
  const claves = [...original.keys()].sort((a, b) => b.length - a.length);
  const rx = claves.length ? new RegExp(`(?<![\\p{L}\\p{N}])(?:${claves.map((k) => _esc(k)).join("|")})(?![\\p{L}\\p{N}])`, "gu") : null;
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
  ["inventario", /\binventario|\bstock\b|\bcapital\b/i], ["brecha", /\bbrecha/i],
];
/* la métrica se lee sin acentos: «los márgenes más bajos» nombra el margen (el regex de la métrica no entendía «márgenes» y la cifra de margen quedaba «métrica distinta» de la venta que la oración también nombra) */
const _metricasDe = (t) => { const x = REGLAS.metrica ? _sinAcento(t) : String(t); return new Set(METRICAS.filter(([, rx]) => rx.test(x)).map(([k]) => k)); };
const _claveDeMetrica = (rotulo) => { const r = String(rotulo || ""); const x = METRICAS.find(([, rx]) => rx.test(r)); return x ? x[0] : null; };

/* ── el LIBRO DEL HILO: todo lo que ADI entregó, con dueño y métrica ───────────────────────────────────────────── */
/** construirLibro(llamadas, buscar) → { hechos[], entidades:Set, hechosRetomar[] }
 *   llamadas: [{ herramienta, args, resultado, sesion?, turno? }] en orden (todas las sesiones del hilo hasta ese turno) */
export function construirLibro(llamadas, buscar) {
  const hechos = [];
  const entidades = new Set();
  const empresas = new Set();                  // los nombres con que la casa llama a la empresa (su marco, su ficha): una cifra suya no es de una cuenta
  const retomares = [];
  /* `metrica`: el rótulo de UNA cifra (una fila de la tabla, un hecho tipado) → su clave; `metricas`: las claves que NOMBRA la línea donde se imprimió (una línea de prosa dice varias: «el margen de 21.5% contra
   * el benchmark de 30.1%»): la cifra queda asociada a todas — la entrega no dice cuál de las que nombra es la suya, y el anfitrión que la cita bajo cualquiera de ellas no se equivoca de métrica */
  const agregarCifra = ({ entidades: ents = [], metrica = null, metricas = null, texto, origen, ref = null, tabla = false }) => {
    const clave = _claveDeMetrica(metrica);
    const claves = metricas ? [...new Set(metricas)] : (clave ? [clave] : []);
    for (const tok of extraerNumeros(texto)) {
      for (const c of tok.candidatos) hechos.push({ unidad: tok.unidad, valor: c.valor, unc: c.unc, entidades: ents, metrica: clave || claves[0] || null, metricas: claves, origen, ref, texto: tok.crudo, rotulo: String(metrica || ""), tabla });
    }
  };
  const recorrer = (nodo, origen, ctx = {}) => {
    if (typeof nodo === "string") {
      for (const linea of nodo.split("\n")) {
        const ents = buscar(linea).map((x) => x.nombre);
        ents.forEach((e) => entidades.add(e));
        agregarCifra({ entidades: ents, metricas: [..._metricasDe(linea)], texto: linea, origen });
      }
      return;
    }
    if (Array.isArray(nodo)) { nodo.forEach((x) => recorrer(x, origen, ctx)); return; }
    if (nodo && typeof nodo === "object") {
      // un objeto con {raw, unidad}: el valor EXACTO (la unidad de la casa decide la escala)
      for (const k of Object.keys(nodo)) { if (k === "uso" || k === "rv") continue; recorrer(nodo[k], origen, ctx); }
    }
  };

  /* LO ENTREGADO COMO DATO (no como texto): el criterio declarado y el valor que desplaza («Antes de su declaración ADI usaba 30.1%»), y el rango que ADI acepta para cada criterio (min/max). Solo porcentajes, puntos y días:
   * son cifras con la unidad dicha (el dinero de un campo crudo no se lee sin su escala) */
  const ingerirNumericos = (nodo, origen, ctx = {}, deCatalogo = false) => {
    if (Array.isArray(nodo)) { nodo.forEach((x) => ingerirNumericos(x, origen, ctx, deCatalogo)); return; }
    if (!nodo || typeof nodo !== "object") return;
    const unidad = nodo.unidad === "pct" ? "pct" : nodo.unidad === "pp" ? "pp" : nodo.unidad === "days" ? "days" : (ctx.unidad || null);
    const metricasDe = (nodo.rotulo || nodo.concepto) ? [..._metricasDe(`${nodo.rotulo || ""} ${nodo.concepto || ""}`)] : (ctx.metricas || []);
    const metrica = metricasDe[0] || null;
    if (REGLAS.libro_numerico && unidad) {
      for (const campo of ["valor", "min", "max"]) {
        const v = nodo[campo];
        if (typeof v === "number" && Number.isFinite(v)) {
          const dec = (String(v).split(".")[1] || "").length;
          hechos.push({ unidad, valor: v, unc: 0.5 * Math.pow(10, -dec), entidades: [], metrica, metricas: metricasDe, exacto: true, deCatalogo, origen, ref: nodo.id || null, texto: String(v) + (unidad === "days" ? "d" : "%") });
        }
      }
    }
    for (const k of Object.keys(nodo)) if (nodo[k] && typeof nodo[k] === "object" && k !== "uso" && k !== "fuente" && k !== "sello") ingerirNumericos(nodo[k], origen, k === "desplaza" ? { unidad, metricas: metricasDe } : {}, deCatalogo);
  };

  for (const ll of llamadas) {
    const r = ll.resultado;
    if (!r || typeof r !== "object") continue;
    const origen = `${ll.herramienta}@${ll.sesion ?? "?"}.${ll.turno ?? "?"}`;
    if (r.empresa && r.empresa.nombre) empresas.add(r.empresa.nombre);
    if (r.entrega && r.entrega.marco && r.entrega.marco.empresa) empresas.add(r.entrega.marco.empresa);
    if (r.entrega && r.entrega.json && r.entrega.json.marco && r.entrega.json.marco.empresa) empresas.add(r.entrega.json.marco.empresa);
    if (r.declarado) ingerirNumericos(r.declarado, origen);
    if (r.declarable) ingerirNumericos(r.declarable, origen, {}, true);
    if (ll.herramienta === "consultar" && r.entrega && !r.entrega.json) {
      // LA RESPUESTA COMPACTA (`capacidad/compacto.js`, lo que viaja al anfitrión): cifras con su id · apoyo (otras cifras que el texto imprime) · lo que quedó fuera del texto · el texto íntegro
      const e = r.entrega;
      for (const c of [...(e.cifras || []), ...((e.detalle && e.detalle.fueraDelTexto) || [])]) {
        if (c.entidad) entidades.add(c.entidad);
        agregarCifra({ entidades: c.entidad ? [c.entidad] : [], metrica: c.metrica, texto: String(c.valor || ""), origen, ref: c.id || null, tabla: true });
        if (c.supuesto) recorrer(c.supuesto, origen);
      }
      /* `apoyo`: las cuentas de ADI (una diferencia entre dos cuentas, un subtotal) y las referencias del negocio. Un valor de apoyo NO siempre está impreso en el texto (la diferencia «$9.8M» entre dos ventas, no): se indexa por su `hecho`, con las cuentas que ese
       * hecho nombra (la diferencia es de las DOS) o «negocio» (la referencia de la empresa) */
      if (REGLAS.apoyo) for (const a of (e.apoyo || [])) {
        const hecho = String(a.hecho || "");
        const delNegocio = String(a.entidad || "").trim().toLowerCase() === "negocio";
        const todas = delNegocio ? ["negocio"] : [...new Set(buscar(hecho).map((x) => x.nombre))];
        todas.forEach((x) => { if (x !== "negocio") entidades.add(x); });
        /* «A · Ventas = $40.8M − B · Ventas = $31.1M = $9.8M»: cada operando es de SU cuenta (el valor de A no es de B); el resultado (lo último tras «=») es de las cuentas del hecho */
        const partes = hecho.split(/\s+[−+÷×]\s+/);
        partes.forEach((p) => {
          const segs = p.split(/\s=\s/);
          const propias = delNegocio ? ["negocio"] : [...new Set(buscar(segs[0]).map((x) => x.nombre))];
          if (segs.length >= 2) agregarCifra({ entidades: propias.length ? propias : todas, metricas: [..._metricasDe(segs[0])], texto: segs[1], origen, ref: a.id || null });
          if (segs.length >= 3) agregarCifra({ entidades: todas, metricas: [..._metricasDe(hecho)], texto: segs.slice(2).join(" = "), origen, ref: a.id || null });
        });
      }
      recorrer(e.texto, origen);
      if (e.marco) recorrer({ empresa: e.marco.empresa, periodo: e.marco.periodo, universo: e.marco.universo }, origen);
      if (e.detalle) recorrer(e.detalle.oraciones, origen);
    } else if (ll.herramienta === "consultar" && r.entrega) {
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
    } else if (ll.herramienta === "derivar") {
      /* UNA DERIVACIÓN de ADI (`derivar`): el hecho nuevo `D<k>` con su valor, su métrica y las cuentas que nombra; y sus operandos, base y referencia, tal como se entregaron. Es lo que el anfitrión puede decir sin salirse del contrato. */
      if (r.ok === true && r.hecho) {
        const d = r.hecho;
        const entsD = [...new Set(buscar(String(d.entidad || "")).map((x) => x.nombre))];
        entsD.forEach((e) => entidades.add(e));
        agregarCifra({ entidades: entsD, metricas: [..._metricasDe(String(d.metrica || ""))], metrica: d.metrica, texto: String(d.valor || ""), origen, ref: d.id || null });
        for (const o of [...(r.operandos || []), ...(r.base ? [r.base] : []), ...((r.condicion && r.condicion.referencia) ? [r.condicion.referencia] : [])]) {
          if (o.entidad) entidades.add(o.entidad);
          agregarCifra({ entidades: o.entidad ? [o.entidad] : [], metrica: o.metrica, texto: String(o.valor || ""), origen, ref: o.id || null });
        }
      }
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
  return { hechos, entidades, empresas, retomares };
}

/* ── coincidencia ─────────────────────────────────────────────────────────────────────────────────────────────── */
const _compatibles = (a, b) => a === b || (a === "pct" && b === "pp") || (a === "pp" && b === "pct");
function _coincide(tok, hecho) {
  if (!_compatibles(tok.unidad, hecho.unidad) && !(tok.unidad === "count" && hecho.unidad !== "count")) return false;
  // un entero sin unidad solo coincide con un conteo (no con «$17.3M»); con unidad, con la misma unidad
  if (tok.unidad === "count" && hecho.unidad !== "count") return false;
  if (hecho.exacto) return tok.candidatos.some((c) => Math.abs(c.valor - hecho.valor) <= (hecho.unc || 0) + 1e-9);      // un dato entregado como número se cita a su precisión: «30 %» no es el 30.1 que ADI usaba
  return tok.candidatos.some((c) => Math.abs(c.valor - hecho.valor) <= Math.max(c.unc, hecho.unc || 0) + 1e-9);
}
/** el valor que la PERSONA declaró, citado igual (a la precisión más gruesa de los dos: «18%» es 18%, no «18,4%») */
const _mismoValorExacto = (tok, h) => tok.candidatos.some((c) => Math.abs(c.valor - h.valor) <= Math.min(c.unc, h.unc || c.unc) + 1e-9);

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

/* ── DERIVACIONES ARITMÉTICAS DEMOSTRABLES (owner 2026-10-05, tras el ensayo: «aceptar solo derivaciones aritméticas demostrables con las cifras entregadas; si una suma, resta o diferencia no cierra exactamente,
 * debe seguir marcándose como error»). Una cifra de la prosa que NO traza directo se acepta SOLO si es la SUMA o la DIFERENCIA de DOS cifras entregadas en este hilo —de la misma unidad y de la misma métrica— que
 * cierra EXACTAMENTE a la precisión con que la prosa la imprime (el valor impreso es el mismo: «37,2» = 19,4 + 17,8; «37,3» no). Las dos cifras son las que el propio anfitrión citó en el turno (nadie suma lo que no dijo) o las
 * de las dos entidades que la oración nombra bajo la métrica que nombra. A lo más dos operandos; ni porcentaje de porcentaje, ni producto, ni cociente, ni tres sumandos: cualquier otra cuenta sigue siendo `no_traza`.
 * Cada derivación aceptada queda registrada (qué cifras, qué operación) en la afirmación y en el informe: la acepta la regla, no la suerte. */
const _UNIDADES_DERIVABLES = new Set(["money", "pct", "pp", "days"]);
const _firmaDeOperando = (h) => `${h.unidad === "pp" ? "pct" : h.unidad}|${h.valor}|${[...(h.entidades || [])].map(_sinAcento).sort().join(",")}`;
const _metricasSolapan = (a, b) => (a.metricas || []).some((m) => (b.metricas || []).includes(m));
/** derivacionDe(tok, { citados, delaOracion, nombradas, cuentas }) → { operacion, operandos:[...], descripcion } | null
 *  CONTRATO DEL ANFITRIÓN: ya no ABSUELVE, CLASIFICA — la cifra que sale de aquí es `fuera_de_contrato` (verdadera, demostrable, pero que el anfitrión debió pedir a ADI). Además de la suma o diferencia de DOS cifras, entran la suma de
 *  hasta CINCO cifras de la misma métrica y el COCIENTE de una cifra entregada sobre otra base entregada (una participación: `cuentas` = las cifras de dinero o de cantidad de las cuentas que la oración nombra y las de la empresa).
 *  Siguen fuera: más de cinco sumandos, el producto, el «porcentaje de porcentaje». */
export function derivacionDe(tok, { citados = [], delaOracion = [], nombradas = [], cuentas = [] } = {}) {
  if (!_UNIDADES_DERIVABLES.has(tok.unidad)) return null;
  const buenos = (lista) => { const v = new Map(); for (const h of lista) if (_UNIDADES_DERIVABLES.has(h.unidad) && _compatibles(h.unidad, tok.unidad === "pp" ? "pct" : tok.unidad) && !v.has(_firmaDeOperando(h) + "|" + (h.metricas || []).join(",") + "|" + h.texto)) v.set(_firmaDeOperando(h) + "|" + (h.metricas || []).join(",") + "|" + h.texto, h); return [...v.values()].slice(0, 80); };
  for (const grupo of [buenos(citados), buenos(delaOracion)]) {
    for (let i = 0; i < grupo.length; i++) for (let j = i + 1; j < grupo.length; j++) {
      const a = grupo[i], b = grupo[j];
      if (_firmaDeOperando(a) === _firmaDeOperando(b) || Math.abs(a.valor - b.valor) < 1e-9 || !_compatibles(a.unidad, b.unidad) || !_metricasSolapan(a, b)) continue;      // (la misma cifra dos veces no es una derivación: x + x / x − x)
      // si la oración nombra una entidad, la cuenta es SOBRE ella: al menos un operando es suyo (una cifra de otras cuentas no la explica)
      if (nombradas.length && ![a, b].some((h) => (h.entidades || []).some((e) => nombradas.some((d) => _sinAcento(d) === _sinAcento(e))))) continue;
      for (const [operacion, signo, d] of [["suma", "+", a.valor + b.valor], ["diferencia", "−", Math.abs(a.valor - b.valor)]]) {
        if (operacion === "suma" && (a.esDePersona || b.esDePersona)) continue;      // lo que la persona declaró (su piso, su mínimo) entra en una DIFERENCIA (holgura, exceso), no en una suma
        /* «cierra exactamente a lo impreso»: el resultado, impreso con la precisión de la prosa, es el MISMO valor — a menos de media unidad de la última cifra (4.5 impreso con un entero es 5, no 4: el empate NO cierra) */
        if (!tok.candidatos.some((c) => Math.abs(c.valor - d) < c.unc * (1 - 1e-9))) continue;
        const rotulo = (h) => `${h.texto}${h.entidades && h.entidades.length ? ` (${h.entidades.join("/")})` : ""}`;
        const [x, y] = operacion === "diferencia" && a.valor < b.valor ? [b, a] : [a, b];
        return { operacion, operandos: [x, y].map((h) => ({ texto: h.texto, entidades: h.entidades || [], metrica: h.metrica || null, ref: h.ref || null, origen: h.origen || null })), descripcion: `${tok.crudo} = ${rotulo(x)} ${signo} ${rotulo(y)}` };
      }
    }
  }
  const rotuloDe = (h) => `${h.texto}${h.entidades && h.entidades.length ? ` (${h.entidades.join("/")})` : ""}`;
  const operandoDe = (h) => ({ texto: h.texto, entidades: h.entidades || [], metrica: h.metrica || null, ref: h.ref || null, origen: h.origen || null });
  /* la suma de TRES a CINCO cifras de la misma unidad y métrica (el anfitrión suma lo que él mismo citó o las cuentas que la oración nombra); un solo operando de la cuenta nombrada basta, como en la de dos */
  /* de TRES en adelante la regla es más estricta que la de dos (una suma de muchas cifras acierta por azar con facilidad): solo cifras de la TABLA entregada, de UNA cuenta cada una, positivas, de cuentas DISTINTAS (los sumandos de un total son cuentas) */
  const soloDeLaTabla = (lista) => lista.filter((h) => h.tabla && (h.entidades || []).length === 1 && h.valor > 0);
  if (tok.unidad === "money" || tok.unidad === "days") for (const grupo of [soloDeLaTabla(buenos(citados)).slice(0, 14), soloDeLaTabla(buenos(delaOracion)).slice(0, 14)]) {
    let visitadas = 0, hallada = null;
    const elegir = (desde, escogidas) => {
      if (hallada || visitadas > 30000) return;
      if (escogidas.length >= 3) {
        visitadas += 1;
        const suma = escogidas.reduce((s, h) => s + h.valor, 0);
        const firmas = new Set(escogidas.map(_firmaDeOperando));
        if (firmas.size === escogidas.length && new Set(escogidas.map((h) => _sinAcento(h.entidades[0]))).size === escogidas.length && !escogidas.some((h) => h.esDePersona) && escogidas.every((h) => _metricasSolapan(escogidas[0], h)) && (!nombradas.length || escogidas.some((h) => (h.entidades || []).some((e) => nombradas.some((d) => _sinAcento(d) === _sinAcento(e)))))
          && tok.candidatos.some((c) => Math.abs(c.valor - suma) < c.unc * (1 - 1e-9))) { hallada = escogidas.slice(); return; }
      }
      if (escogidas.length >= 5) return;
      for (let i = desde; i < grupo.length && !hallada; i++) elegir(i + 1, [...escogidas, grupo[i]]);
    };
    elegir(0, []);
    if (hallada) return { operacion: "suma", operandos: hallada.map(operandoDe), descripcion: `${tok.crudo} = ${hallada.map(rotuloDe).join(" + ")}` };
  }
  /* el cociente: una participación (la cifra entregada sobre otra base entregada: un total, o otra métrica de la misma cuenta). Solo cifras de dinero o de cantidad; el resultado, un porcentaje */
  if (tok.unidad === "pct") {
    const pool = [];
    const vistos = new Set();
    for (const h of [...citados, ...delaOracion, ...cuentas]) { const k = `${h.unidad}|${h.valor}|${(h.entidades || []).map(_sinAcento).sort().join(",")}|${h.texto}`; if ((h.unidad === "money" || h.unidad === "count") && h.valor > 0 && !vistos.has(k) && !h.esDePersona) { vistos.add(k); pool.push(h); } }
    const ref = pool.slice(0, 60);
    for (const a of ref) for (const b of ref) {
      if (a === b || a.unidad !== b.unidad || !(a.valor < b.valor)) continue;
      const mismaCuenta = (a.entidades || []).some((e) => (b.entidades || []).some((f) => _sinAcento(e) === _sinAcento(f)));
      const baseEsTotal = !(b.entidades || []).length || /total del listado/i.test(b.rotulo || "");
      if (!mismaCuenta && !baseEsTotal) continue;
      if (nombradas.length && ![a, b].some((h) => (h.entidades || []).some((e) => nombradas.some((d) => _sinAcento(d) === _sinAcento(e))))) continue;
      const q = (100 * a.valor) / b.valor;
      if (tok.candidatos.some((c) => Math.abs(c.valor - q) < c.unc * (1 - 1e-9))) return { operacion: "participacion", operandos: [operandoDe(a), operandoDe(b)], descripcion: `${tok.crudo} = ${rotuloDe(a)} ÷ ${rotuloDe(b)}` };
    }
  }
  return null;
}

/* ── LO QUE LA PERSONA DECLARÓ EN EL HILO (reclasificación del ensayo 2) ──────────────────────────────────────────────────────────────────────────────
 * Una cifra que la persona escribió en una oración DECLARATIVA («mi piso es 45 días», «mi mínimo es 18%», «cobro a 30 días») es suya: el anfitrión que la repite no la inventó. Una oración con pregunta («creció 50% ¿verdad?») no
 * declara nada: es una premisa por verificar, y su eco sigue siendo `eco_persona` (lo juzga el supervisor). Lo que la persona RETIRÓ («es a 45 días, no a 60») deja de ser declarado. Cada cifra declarada guarda su origen
 * (el turno de la persona). */
const _RX_NEGADA = /\b(no|y no|en vez de|en lugar de|ni)\s+(a\s+|de\s+|es\s+|un\s+|el\s+|los\s+)?$/i;
const _mismoValor = (a, b) => _compatibles(a.unidad, b.unidad) && Math.abs(a.valor - b.valor) <= Math.max(a.unc || 0, b.unc || 0) + 1e-9;
/** hechosDeLaPersona([{ texto, sesion, turno }]) → { declarados:[{unidad, valor, unc, metricas, texto, origen}], preguntados:[...], numeros:[tokens] } */
export function hechosDeLaPersona(personas) {
  const declarados = [], preguntados = [], retirados = [], numeros = [];
  personas.forEach((p, orden) => {
    for (const u of partirEnUnidades(String(p.texto || ""))) {
      const declarativa = !/[?¿]/.test(u.texto);
      const metricas = [..._metricasDe(u.texto)];
      let unidadPrevia = null;      // «es a 45 días, no a 60»: el 60 sin unidad es de la unidad del número anterior de la oración
      for (const tok of extraerNumeros(u.texto)) {
        numeros.push(tok);
        if (_ignorable({ ...tok }, tok.unidad, u.texto)) continue;
        const negada = _RX_NEGADA.test(u.texto.slice(Math.max(0, tok.indice - 14), tok.indice));
        if (tok.sinUnidad) {
          if (negada && unidadPrevia) for (const c of tok.candidatos) retirados.push({ unidad: unidadPrevia, valor: c.valor, unc: c.unc, orden });
          continue;
        }
        unidadPrevia = tok.unidad;
        for (const c of tok.candidatos) {
          const h = { unidad: tok.unidad, valor: c.valor, unc: c.unc, metricas, texto: tok.crudo, origen: `persona@${p.sesion ?? "?"}.${p.turno ?? "?"}`, orden };
          (negada ? retirados : declarativa ? declarados : preguntados).push(h);
        }
      }
    }
  });
  return { declarados: declarados.filter((h) => !retirados.some((r) => r.orden >= h.orden && _mismoValor(r, h))), preguntados, numeros };
}

/* ── lo que dice la cláusula, no la oración entera: «Los $115K de Lampa rotan en 29d, así que ahí el costo de oportunidad es menor» son dos afirmaciones; el «costo» es de la segunda ── */
const _RX_CONECTOR = /(?:,\s*)?(?:as[ií] que|por lo que|por eso|por lo tanto|pero|aunque|mientras|sin embargo|ya que|porque|de modo que)\s+|;\s*/gi;
export function clausulaDe(texto, indice) {
  let ini = 0, fin = texto.length;
  const rx = new RegExp(_RX_CONECTOR.source, "gi");
  let m;
  while ((m = rx.exec(texto))) {
    if (m.index >= indice) { fin = m.index; break; }
    ini = m.index + m[0].length;
  }
  return texto.slice(ini, fin);
}
/** Las métricas con que se juzga UNA cifra: «unidades» solo es de un conteo; «bajo/sobre el benchmark» compara un margen (y lo que se mide contra él: brecha, contribución, carga, costo). */
const _CONTRA_BENCHMARK = ["margen", "brecha", "contribucion", "carga", "costo"];
function _metricasParaJuicio(mets, unidad) {
  if (!REGLAS.metrica) return mets;
  const out = new Set(mets);
  if (out.has("benchmark")) for (const k of _CONTRA_BENCHMARK) out.add(k);
  if (unidad !== "count") out.delete("unidades");
  return out;
}
const _RX_CRITERIO = /\b(criterio|umbral|techo|piso|l[ií]mite|referencia|vara|objetivo|m[ií]nimo|m[aá]ximo|meta)\b/i;
const _RX_COMPARADOR = /\b(frente a|contra|versus|vs\.?|comparad[oa]s? con|respecto (?:a|de)|en comparaci[oó]n con)\b/i;

/** los números del texto: en cifras Y en palabras («ocho», «cuatro millones», «tres días»), en orden de aparición (Contrato del Anfitrión: «en números o en palabras») */
export function numerosDelTexto(texto) {
  return [...extraerNumeros(texto), ...extraerNumerosEnPalabras(texto)].sort((a, b) => a.indice - b.indice);
}

/* ── LOS CONTEOS (en palabras o en cifras): «Ocho de los 13 clientes tienen saldo pendiente», «5 de las 9», «cinco están al día» ───────────────────────────────────────────────────────────────────
 * Un entero sin unidad que cuenta cuentas de un universo ENTREGADO y un estado de la casa (vencido > 0 · al día = vencido 0 · saldo pendiente > 0, las definiciones de `estados.js`) se compara con el conteo REAL sobre las
 * cifras de la tabla que ADI entregó de esa métrica: SOLO si el listado entregado es completo (el total del listado dice cuántas cuentas son, o la oración dice «de los M» y M cierra). Si cierra: es verdad pero no es un hecho de
 * ADI (el conteo debió pedirse con `derivar`) → fuera de contrato; si ya estaba entregado (un `D` de conteo, o «N de M» en el apoyo) → hecho de ADI. Si no cierra: `conteo_no_cierra`, error material. Lo que no se puede
 * verificar con lo entregado (listado incompleto, otra métrica) no se juzga: se lista. */
const _ESTADOS_DE_CONTEO = [
  { rx: /\b(?:al dia|sin (?:saldo |deuda )?vencid[oa]s?|no tienen? (?:saldo |deuda )?vencid[oa]s?|sin mora)\b/, clave: "vencido", op: "=", valor: 0, dicho: "al día (vencido = 0)" },
  { rx: /\bsin (?:saldo )?pendiente\b|\bno (?:tienen?|adeudan?) (?:saldo )?pendiente\b/, clave: "saldo_pendiente", op: "=", valor: 0, dicho: "sin saldo pendiente" },
  { rx: /\b(?:vencid[oa]s?|en mora|atrasad[oa]s?|moros[oa]s?)\b/, clave: "vencido", op: ">", valor: 0, dicho: "con saldo vencido (> 0)" },
  { rx: /\b(?:saldo pendiente|pendientes?|adeudan?|deben?|con deuda|tienen? deuda)\b/, clave: "saldo_pendiente", op: ">", valor: 0, dicho: "con saldo pendiente (> 0)" },
];
const _UNIVERSO_DE_CONTEO = "(?:clientes?|cuentas?|skus?|productos?|bodegas?|marcas?|familias?|ellos|ellas)";
const _VERBO_DE_CONTEO = "(?:estan|tienen|tiene|quedan|presentan|registran|figuran|aparecen|son|hay|deben|adeudan|esta)";
export function juzgarConteo({ tok, u, libro, base }) {
  if (!tok.sinUnidad || !tok.candidatos.length) return null;
  const n = tok.candidatos[0].valor;
  if (!Number.isInteger(n) || n < 0) return null;
  const t = u.texto;
  const antes = _sinAcento(t.slice(Math.max(0, tok.indice - 22), tok.indice));
  if (/(puesto|lugar|top|posicion|n[.º°]|numero|paso|opcion|version|entrega|turno|carga)\s?#?$/.test(antes) || /\bde\s+(?:los|las|esos|esas)\s*$/.test(antes)) return null;     // un puesto o el M de «de los M»: no es el conteo
  const despues = _sinAcento(t.slice(tok.fin, tok.fin + 90));
  const deLosM = /^\s+de\s+(?:los|las|esos|esas)?\s*([a-z0-9]+(?:\s+y\s+[a-z]+)?)\b/.exec(despues);
  const directo = new RegExp(`^\\s*(?:${_UNIVERSO_DE_CONTEO}\\s+)?(?:\\w+\\s+){0,2}?${_VERBO_DE_CONTEO}\\b`).test(despues) || new RegExp(`^\\s*${_UNIVERSO_DE_CONTEO}\\b`).test(despues);
  if (!deLosM && !directo) return null;
  const clausula = _sinAcento(clausulaDe(t, tok.indice));
  const estado = _ESTADOS_DE_CONTEO.find((e) => e.rx.test(clausula));
  if (!estado) return null;
  const rotulos = { vencido: "Saldo vencido", saldo_pendiente: "Saldo pendiente" };
  const unaOracion = { ...base, tipo: "conteo", token: tok.crudo, unidad: "count" };
  /* ¿ADI ya entregó este conteo? (un `D` de `derivar`, o «N de M» en el apoyo): entonces es un hecho de ADI */
  const yaEntregado = libro.hechos.find((h) => h.unidad === "count" && Math.abs(h.valor - n) < 0.5 && (h.metricas || []).includes(estado.clave) && /^(derivar|consultar)@/.test(h.origen || "") && h.ref);
  if (yaEntregado) return { ...unaOracion, veredicto: "traza", material: false, origen: yaEntregado.origen, hecho: { ref: yaEntregado.ref, texto: yaEntregado.texto, entidades: yaEntregado.entidades } };
  /* el universo entregado: una cifra por cuenta en la TABLA, de esa métrica */
  const filas = libro.hechos.filter((h) => h.tabla && h.unidad === "money" && h.entidades.length === 1 && (h.metricas || [h.metrica]).includes(estado.clave) && !/total del listado/i.test(h.rotulo || ""));
  const porCuenta = new Map();
  for (const h of filas) { const k = _sinAcento(h.entidades[0]); if (!porCuenta.has(k)) porCuenta.set(k, []); if (!porCuenta.get(k).some((x) => Math.abs(x.valor - h.valor) < 1e-9)) porCuenta.get(k).push(h); }
  if (!porCuenta.size || [...porCuenta.values()].some((v) => v.length > 1)) return null;     // sin cifras o con dos valores para una misma cuenta: no hay verdad que comparar
  const total = libro.hechos.find((h) => h.tabla && h.unidad === "money" && (h.metricas || [h.metrica]).includes(estado.clave) && /total del listado completo \((\d+)/i.test(h.rotulo || ""));
  const K = total ? Number(/total del listado completo \((\d+)/i.exec(total.rotulo)[1]) : null;
  const M = deLosM ? (/^\d+$/.test(deLosM[1]) ? Number(deLosM[1]) : ((extraerNumerosEnPalabras(deLosM[1])[0] || {}).valorEntero ?? null)) : null;
  const completo = (K != null && porCuenta.size === K) || (M != null && porCuenta.size === M);
  if (!completo) return null;
  const cumple = (v) => (estado.op === "=" ? Math.abs(v) < 1e-9 : v > 1e-9);
  const cumplen = [...porCuenta.values()].filter((v) => cumple(v[0].valor));
  const refs = [...porCuenta.values()].map((v) => v[0].ref).filter(Boolean);
  const descripcion = `${cumplen.length} de ${porCuenta.size} cuentas ${estado.dicho}`;
  if (cumplen.length !== n) return { ...unaOracion, veredicto: "conteo_no_cierra", material: true, motivo: `el conteo no cierra: la prosa dice ${tok.crudo} y las cifras entregadas dan ${descripcion}`, confianza: "alta" };
  return { ...unaOracion, veredicto: "traza", material: false, rescate: "conteo", motivo: `conteo demostrable con lo entregado: ${descripcion}`, derivacion: { operacion: "conteo", operandos: [...porCuenta.values()].map((v) => ({ texto: v[0].texto, entidades: v[0].entidades, metrica: rotulos[estado.clave], ref: v[0].ref || null, origen: v[0].origen || null })), descripcion: `${tok.crudo} = ${descripcion}` }, derivacionQueDebioPedirse: { operacion: "conteo", sobre: refs, condicion: { op: estado.op, valor: estado.valor }, resultado: `${cumplen.length} de ${porCuenta.size}` } };
}

/* ── LAS RELACIONES EN PALABRAS: «la mitad», «un cuarto», «el doble», «casi duplica» ──────────────────────────────────────────────────────────────────────────────────────────────────────
 * Solo se juzgan con DOS cuentas nombradas y una cifra entregada de la misma métrica de cada una: la razón entre las dos tiene que caer en el rango que la casa fija para esa palabra (`COTAS_DE_PROPORCION`; un múltiplo a
 * secas ±15 %). Cae: verdad, pero no era un hecho de ADI (debió pedirse una participación) → fuera de contrato. No cae: `relacion_no_cierra`, error material. Sin dos cifras que comparar: no se juzga (va al juez). */
export function juzgarRelacion({ rel, u, libro, ents, mets, base, personas }) {
  if (ents.length !== 2) return null;
  const eq = (a, b) => _sinAcento(a) === _sinAcento(b);
  if ((personas || []).some((p) => _sinAcento(p.texto || "").includes(_sinAcento(rel.frase)))) return null;     // la dijo la persona
  const delaCuenta = (e) => {
    const hs = libro.hechos.filter((h) => h.tabla && h.entidades.length === 1 && eq(h.entidades[0], e) && (h.unidad === "money" || h.unidad === "count" || h.unidad === "pct" || h.unidad === "days") && mets.size && (h.metricas || [h.metrica]).some((m) => mets.has(m)));
    const distintos = []; for (const h of hs) if (!distintos.some((x) => Math.abs(x.valor - h.valor) < 1e-9 && x.unidad === h.unidad)) distintos.push(h);
    return distintos.length === 1 ? distintos[0] : null;
  };
  const [a, b] = [delaCuenta(ents[0]), delaCuenta(ents[1])];
  if (!a || !b || a.unidad !== b.unidad || !(a.valor > 0) || !(b.valor > 0)) return null;
  const r = rel.tipo === "fraccion" ? Math.min(a.valor, b.valor) / Math.max(a.valor, b.valor) : Math.max(a.valor, b.valor) / Math.min(a.valor, b.valor);
  const cae = r >= rel.lo - 1e-9 && r <= rel.hi + 1e-9;
  const aBase = { ...base, tipo: "relacion", token: rel.frase, unidad: "count" };
  if (!cae) return { ...aBase, veredicto: "relacion_no_cierra", material: true, motivo: `la relación no cierra: «${rel.frase}» pide una razón entre ${rel.lo.toFixed(2)} y ${Number.isFinite(rel.hi) ? rel.hi.toFixed(2) : "más"}, y las cifras entregadas (${a.texto} de ${a.entidades[0]}, ${b.texto} de ${b.entidades[0]}) dan ${r.toFixed(2)}`, confianza: "alta" };
  const [menor, mayor] = a.valor <= b.valor ? [a, b] : [b, a];
  return { ...aBase, veredicto: "traza", material: false, rescate: "relacion", motivo: `relación demostrable con lo entregado: ${menor.texto} (${menor.entidades[0]}) y ${mayor.texto} (${mayor.entidades[0]}) = razón ${r.toFixed(2)}, dentro de «${rel.nombre}»`, derivacion: { operacion: "participacion", operandos: [menor, mayor].map((h) => ({ texto: h.texto, entidades: h.entidades, metrica: h.metrica, ref: h.ref || null, origen: h.origen || null })), descripcion: `${rel.frase} = ${menor.texto} ÷ ${mayor.texto}` }, derivacionQueDebioPedirse: { operacion: "participacion", sobre: [menor.ref].filter(Boolean), base: mayor.ref || null, resultado: r.toFixed(2) } };
}

/** el caso del contrato de una afirmación de la clase 1 (una cifra empresarial): hecho_de_adi · fuera_de_contrato · error_material · null (no es una cifra que se juzgue: un año, un entero suelto, el eco de la persona) */
export function casoDeLaAfirmacion(a) {
  if (!a || a.clase !== 1) return null;
  if (a.veredicto === "traza") return a.rescate === "derivacion" || a.rescate === "conteo" || a.rescate === "relacion" ? "fuera_de_contrato" : "hecho_de_adi";
  if (VEREDICTOS_FALSOS.has(a.veredicto)) return "error_material";
  return null;
}

/**
 * rastrearTurno({ texto, persona, personaDelHilo, llamadasDelHilo, buscarNombres, empresaId, prevHuboEntregas }) → { afirmaciones[], cruces[], flags[] }
 *   llamadasDelHilo: todas las llamadas de herramienta HASTA ESTE TURNO (inclusive), de todas las sesiones del hilo.
 *   llamadasDelTurno: las de este turno (para la clase 2).
 *   personaDelHilo: lo que la persona dijo en este turno y los anteriores ([{ texto, sesion, turno }]): sus cifras declaradas y los nombres que ella escribió.
 */
export function rastrearTurno({ texto, persona = "", personaDelHilo = null, llamadasDelHilo, llamadasDelTurno = [], empresaId, buscarTodos, nombresAjenos }) {
  const afirmaciones = [];
  const flags = [];
  const t = String(texto || "");
  const libro = construirLibro(llamadasDelHilo, buscarTodos);
  const personas = personaDelHilo && personaDelHilo.length ? personaDelHilo : [{ texto: persona, sesion: null, turno: null }];
  const dePersona = hechosDeLaPersona(personas);
  const numerosPersona = REGLAS.persona ? dePersona.numeros : extraerNumeros(persona);      // (sin la regla, la persona de ESTE turno: lo que se medía antes)
  const entsDeLaPersona = [...new Set(buscarTodos(String(persona || "")).map((x) => x.nombre))];     // las cuentas que la persona nombró en ESTE turno
  const entsDelHiloDeLaPersona = [...new Set(buscarTodos(personas.map((p) => p.texto).join("\n")).map((x) => x.nombre))];
  const empresasEsc = new Set([...libro.empresas, "negocio"].map(_sinAcento));
  const esDeLaEmpresa = (h) => h.entidades.length > 0 && h.entidades.every((e) => empresasEsc.has(_sinAcento(e)));
  const unidades = partirEnUnidades(t);
  /* las cifras entregadas que la prosa de este turno CITÓ, con el párrafo donde las dijo: los operandos de una derivación son cifras que el anfitrión puso a la vista cerca de la que deriva */
  const citas = [];
  for (const u of unidades) for (const tk of numerosDelTexto(u.texto)) if (!tk.sinUnidad) for (const h of libro.hechos) if (_coincide(tk, h)) citas.push({ h, parrafo: u.parrafo, u });
  const tokensDeParrafo = new Map();
  for (const u of unidades) tokensDeParrafo.set(u.parrafo, [...(tokensDeParrafo.get(u.parrafo) || []), ...numerosDelTexto(u.texto).filter((x) => !x.sinUnidad)]);
  const _RX_REF_PERSONA = /\b(su|tu|el|del|ese|esa)\s+(m[ií]nimo|piso|l[ií]mite|umbral|vara|objetivo|meta|benchmark)\b/i;
  /* los operandos que la persona declaró son operandos posibles de una derivación (281 días − su piso de 45 = 236): con su origen, y con las métricas de SU oración */
  const operandosPersona = REGLAS.persona && REGLAS.derivacion ? dePersona.declarados.filter((h) => _UNIDADES_DERIVABLES.has(h.unidad)).map((h) => ({ ...h, entidades: [], esDePersona: true })) : [];

  // ── clase 1 · cada cifra de la prosa
  const derivadasDelTurno = [];
  const benchmarkEnParrafo = new Set(unidades.filter((x) => _metricasDe(x.texto).has("benchmark")).map((x) => x.parrafo));
  const entidadesDeParrafo = new Map();      // parrafo → última lista de entidades vista
  const temaDeParrafo = new Map();           // parrafo → las cuentas con que abrió
  for (const u of unidades) {
    const hits = buscarTodos(u.texto);
    const ents = [...new Set(hits.map((x) => x.nombre))];
    const prevEnts = entidadesDeParrafo.get(u.parrafo) || [];
    const entsAjenasALaPersona = ents.filter((e) => !entsDelHiloDeLaPersona.some((p) => _sinAcento(p) === _sinAcento(e)));      // («distribuidores de línea blanca»: la categoría que la persona nombró no es una cuenta que atribuya la cifra)
    const colectivo = REGLAS.colectivo && !ents.length && /^[\s\-*•]*(el resto|los (otros|dem[aá]s|restantes)|las (otras|dem[aá]s|restantes))\b/i.test(u.texto);
    const dueñas = ents.length ? ents : colectivo ? [] : (REGLAS.tema && prevEnts.length ? [...new Set([...prevEnts, ...(temaDeParrafo.get(u.parrafo - 1) || [])])] : prevEnts);
    if (ents.length) entidadesDeParrafo.set(u.parrafo, ents);
    if (ents.length && !temaDeParrafo.has(u.parrafo)) temaDeParrafo.set(u.parrafo, ents);
    const mets = _metricasDe(u.texto);
    const eq = (a, b) => _sinAcento(a) === _sinAcento(b);
    /* las RELACIONES dichas con letras de esta oración («la mitad», «el doble», «casi duplica»): se juzgan contra las dos cuentas que la oración nombra */
    for (const relacion of relacionesEnPalabras(u.texto)) {
      const j = juzgarRelacion({ rel: relacion, u, libro, ents, mets, base: { clase: 1, oracion: u.texto.trim().slice(0, 240) }, personas });
      if (j) afirmaciones.push(j);
    }
    for (const tok of numerosDelTexto(u.texto)) {
      const rel = { ...tok, indice: tok.indice, fin: tok.fin };
      const ign = _ignorable(rel, tok.unidad, u.texto);
      const base = { clase: 1, tipo: "numero", token: tok.crudo, oracion: u.texto.trim().slice(0, 240), unidad: tok.unidad };
      if (ign) { afirmaciones.push({ ...base, veredicto: "ignorado", motivo: ign, material: false }); continue; }
      /* un entero sin unidad (en cifras o en palabras) que CUENTA cuentas de un universo y un estado entregados se compara con el conteo real; el número en palabras que no cuenta nada que ADI haya entregado no se juzga (diseño §3) */
      if (tok.sinUnidad) {
        /* el M de «N de los M clientes tienen…» es el tamaño del universo del conteo, no una cifra aparte: lo juzga el N */
        if (/des+(?:los|las|esos|esas)s*$/.test(_sinAcento(u.texto.slice(Math.max(0, tok.indice - 22), tok.indice))) && _ESTADOS_DE_CONTEO.some((e) => e.rx.test(_sinAcento(clausulaDe(u.texto, tok.indice))))) { afirmaciones.push({ ...base, veredicto: "ignorado", motivo: "el tamaño del universo de un conteo («de los M»): lo juzga el conteo", material: false }); continue; }
        const conteo = juzgarConteo({ tok, u, libro, base });
        if (conteo) { afirmaciones.push(conteo); continue; }
        if (tok.enPalabras) { afirmaciones.push({ ...base, veredicto: "ignorado", motivo: "un número en palabras que no cuenta un universo ni un estado entregados: no se juzga (el diseño §3 lo deja al juez)", material: false }); continue; }
      }
      const coinciden = libro.hechos.filter((h) => _coincide(tok, h) && (!h.deCatalogo || (h.metricas || []).some((m) => mets.has(m))));
      const esEcoDePersona = numerosPersona.some((p) => p.unidad === tok.unidad && p.candidatos.some((a) => tok.candidatos.some((b) => Math.abs(a.valor - b.valor) <= Math.max(a.unc, b.unc) + 1e-9)));
      /* lo que la persona DECLARÓ: la oración no nombra una cuenta (es de la empresa) y la cifra la escribió la persona en una oración declarativa */
      const declaradoPorLaPersona = () => (REGLAS.persona && !tok.sinUnidad && !entsAjenasALaPersona.length) ? (dePersona.declarados.find((h) => _compatibles(h.unidad, tok.unidad) && _mismoValorExacto(tok, h)) || null) : null;
      const intentarDerivacion = ({ estricta = false } = {}) => {
        if (!REGLAS.derivacion) return null;
        /* tras un valor que SÍ coincide con una cifra (de otra cuenta o de otra métrica), la derivación solo vale con operandos que la MISMA oración cita: la coincidencia casual de una cuenta chica no se rescata con cifras de otra parte */
        if (estricta) return derivacionDe(tok, { citados: [...new Set(citas.filter((c) => c.u === u).map((c) => c.h))], delaOracion: [], nombradas: ents });
        const personaALaVista = operandosPersona.filter((h) => _RX_REF_PERSONA.test(u.texto) || [u.parrafo, u.parrafo - 1].some((p) => (tokensDeParrafo.get(p) || []).some((x) => _compatibles(x.unidad, h.unidad) && _mismoValorExacto(x, h))));
        /* las cifras de las cuentas que la oración nombra, bajo la métrica que nombra; si no nombra ninguna (una fila de tabla: «| Casa Lomas | 281 | 236 días |»), las de esas cuentas en la unidad de la cifra */
        const delaOracion = mets.size && dueñas.length ? libro.hechos.filter((h) => h.entidades.some((e) => dueñas.some((d) => eq(d, e))) && (h.metricas || []).some((m) => mets.has(m)))
          : (ents.length ? libro.hechos.filter((h) => _compatibles(h.unidad, tok.unidad === "pp" ? "pct" : tok.unidad) && h.entidades.some((e) => ents.some((d) => eq(d, e)))) : []);
        const citados = [...new Set(citas.filter((c) => c.parrafo === u.parrafo || c.parrafo === u.parrafo - 1 || (ents.length && c.h.entidades.some((e) => ents.some((d) => eq(d, e))))).map((c) => c.h))];
        const cuentasBase = tok.unidad === "pct" ? libro.hechos.filter((h) => (h.unidad === "money" || h.unidad === "count") && (!h.entidades.length || h.entidades.some((e) => dueñas.some((d) => eq(d, e))))) : [];
        return derivacionDe(tok, { citados: [...citados, ...personaALaVista], delaOracion: [...delaOracion, ...personaALaVista], nombradas: ents, cuentas: cuentasBase });
      };
      const repetida = REGLAS.derivacion && !tok.sinUnidad ? derivadasDelTurno.find((d) => _compatibles(d.unidad, tok.unidad) && tok.candidatos.some((c) => Math.abs(c.valor - d.valor) <= Math.max(c.unc, d.unc) + 1e-9)) : null;
      const debioPedirse = (deriv) => ({ operacion: deriv.operacion, sobre: deriv.operandos.map((o) => o.ref).filter(Boolean), operandos: deriv.operandos.map((o) => o.texto), descripcion: deriv.descripcion });
      const comoDerivada = (deriv) => ({ ...base, veredicto: "traza", material: false, derivacion: deriv, rescate: "derivacion", derivacionQueDebioPedirse: debioPedirse(deriv), motivo: `derivación aritmética demostrable: ${deriv.descripcion}` });
      const comoDeclarada = (h) => ({ ...base, veredicto: "traza", material: false, origen: h.origen, declaradoPor: "persona", rescate: "persona", motivo: `la cifra la declaró la persona (${h.origen}: «${h.texto}»): es suya, no una cifra de ADI` });
      const sinJuicio = (porQue) => ({ ...base, veredicto: "sin_unidad", material: false, rescate: "entero", motivo: `entero sin unidad (${porQue}): no tiene dueño ni métrica que juzgar; se lista, no se juzga` });
      if (!coinciden.length) {
        const decl = declaradoPorLaPersona();
        if (decl) { afirmaciones.push(comoDeclarada(decl)); continue; }
        if (tok.sinUnidad) { afirmaciones.push({ ...base, veredicto: esEcoDePersona ? "eco_persona" : "sin_unidad", material: false, motivo: "entero sin unidad que no coincide con ninguna cifra entregada: se lista, no se juzga" }); continue; }
        if (esEcoDePersona) { afirmaciones.push({ ...base, veredicto: "eco_persona", material: false, motivo: "la cifra la dijo la persona: no es una cifra de ADI (el supervisor juzga si el anfitrión la aceptó)" }); continue; }
        if (repetida) { afirmaciones.push({ ...base, veredicto: "traza", material: false, rescate: "derivacion", derivacionQueDebioPedirse: repetida.debioPedirse || null, motivo: `la misma cifra que el anfitrión derivó antes en este turno: ${repetida.descripcion}` }); continue; }
        const deriv = intentarDerivacion();
        if (deriv) { derivadasDelTurno.push({ unidad: tok.unidad, valor: tok.candidatos[0].valor, unc: tok.candidatos[0].unc, descripcion: deriv.descripcion, debioPedirse: debioPedirse(deriv) }); afirmaciones.push(comoDerivada(deriv)); continue; }
        afirmaciones.push({ ...base, veredicto: "no_traza", material: true, motivo: "ninguna cifra entregada en este hilo coincide con este valor" });
        continue;
      }
      // dueño
      const delDueño = (lista, quienes) => lista.filter((h) => !h.entidades.length || h.entidades.some((e) => quienes.some((d) => eq(d, e))) || (REGLAS.referencia && esDeLaEmpresa(h) && tok.candidatos.some((c) => Math.abs(c.valor - h.valor) <= (h.unc || 0) + 1e-9) && (!ents.length || mets.has("benchmark") || benchmarkEnParrafo.has(u.parrafo) || benchmarkEnParrafo.has(u.parrafo - 1) || _RX_CRITERIO.test(u.texto.slice(Math.max(0, tok.indice - 45), tok.indice)))));
      let dueño = dueñas.length ? delDueño(coinciden, dueñas) : coinciden;
      let rescate = null;
      if (!dueño.length && REGLAS.contraparte && ents.length && !tok.sinUnidad) {
        /* la contraparte que el hilo ya nombró (la oración previa del párrafo o la pregunta de la persona), y no una de las que esta oración nombra: «Norvik (24.2% frente a 24.0%)», «Sus ventas son $59.0M y las de Alsen $51.6M» */
        const primero = Math.min(...hits.map((x) => x.indice));
        const antesDelPrimero = tok.indice < primero;
        const trasComparador = _RX_COMPARADOR.test(u.texto.slice(primero, tok.indice));
        if (antesDelPrimero || trasComparador) {
          const ctx = [...new Set([...prevEnts, ...entsDeLaPersona])].filter((c) => !ents.some((e) => eq(e, c)));
          dueño = ctx.length ? coinciden.filter((h) => h.entidades.some((e) => ctx.some((c) => eq(c, e)))) : [];
          if (dueño.length) rescate = "contraparte";
        }
      }
      if (!dueño.length) {
        if (tok.sinUnidad && REGLAS.entero) { afirmaciones.push(sinJuicio("el valor coincide solo con conteos de otras cuentas")); continue; }
        const decl = declaradoPorLaPersona();
        if (decl) { afirmaciones.push(comoDeclarada(decl)); continue; }
        const deriv = intentarDerivacion({ estricta: true });
        if (deriv) { afirmaciones.push(comoDerivada(deriv)); continue; }
        afirmaciones.push({ ...base, veredicto: "dueno_distinto", material: true, motivo: `el valor está entregado, pero a otro dueño (${[...new Set(coinciden.flatMap((h) => h.entidades))].slice(0, 3).join(", ")}) y la oración habla de ${dueñas.join(", ")}`, dueñas });
        continue;
      }
      // métrica
      const metricasDeLasCoincidentes = new Set(dueño.flatMap((h) => (h.metricas && h.metricas.length ? h.metricas : [h.metrica])).filter(Boolean));
      const metsJuicio = _metricasParaJuicio(REGLAS.metrica ? _metricasDe(clausulaDe(u.texto, tok.indice)) : mets, tok.unidad);
      if (metsJuicio.size && metricasDeLasCoincidentes.size && ![...metricasDeLasCoincidentes].some((m) => metsJuicio.has(m))) {
        if (tok.sinUnidad && REGLAS.entero) { afirmaciones.push(sinJuicio("el valor coincide con un conteo de otra métrica")); continue; }
        const decl = declaradoPorLaPersona();
        if (decl) { afirmaciones.push(comoDeclarada(decl)); continue; }
        const deriv = intentarDerivacion({ estricta: true });
        if (deriv) { afirmaciones.push(comoDerivada(deriv)); continue; }
        afirmaciones.push({ ...base, veredicto: "metrica_distinta", material: true, motivo: `la cifra existe pero es de ${[...metricasDeLasCoincidentes].join("/")} y la oración habla de ${[...metsJuicio].join("/")}`, confianza: "media" });
        continue;
      }
      afirmaciones.push({ ...base, veredicto: "traza", material: false, origen: dueño[0].origen, hecho: { ref: dueño[0].ref || null, texto: dueño[0].texto, entidades: dueño[0].entidades }, ...(rescate ? { rescate } : {}) });
    }
  }

  // ── cruces entre empresas · un nombre que la PERSONA escribió en el hilo no es un cruce cuando el anfitrión lo repite (se registra aparte)
  const cruces = [];
  const ajenosDeLaPersona = REGLAS.cruce_persona ? new Set(nombresAjenos(personas.map((p) => p.texto).join("\n")).map((h) => _sinAcento(h.nombre))) : new Set();
  for (const h of nombresAjenos(t)) {
    if (ajenosDeLaPersona.has(_sinAcento(h.nombre))) { flags.push({ tipo: "nombre_ajeno_dicho_por_la_persona", nombre: h.nombre, indice: h.indice }); continue; }
    cruces.push({ nombre: h.nombre, indice: h.indice });
  }

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
  for (const a of afirmaciones) { const caso = casoDeLaAfirmacion(a); if (caso) a.caso = caso; }     /* el contrato: hecho de ADI · fuera de contrato · error material */
  return { afirmaciones, cruces, flags, libro: { hechos: libro.hechos.length, entidades: [...libro.entidades] } };
}

/** El buscador de nombres por empresa: `buscarTodos` (para dueños) y `nombresAjenos` (para cruces). */
export function crearBuscadores({ empresaId, entidadesExtra = [] }) {
  const demo = nombresDelDemo();
  const noDemo = nombresDeLaEmpresaNoDemo();
  const propios = empresaId === "demo" ? demo : noDemo;
  const ajenos = empresaId === "demo" ? noDemo : demo;
  const buscarTodos = crearBuscadorDeNombres([...demo, ...noDemo, ...entidadesExtra], { alias: REGLAS.alias });
  const _ajenos = crearBuscadorDeNombres(ajenos.filter((n) => !propios.some((p) => _sinAcento(p) === _sinAcento(n))));
  const nombresAjenos = (texto) => _ajenos(texto).filter((h) => !(empresaId === "demo" && h.nombre === "ADI Demo"));
  return { buscarTodos, nombresAjenos, EMPRESA_NO_DEMO };
}

/** resumenDeRastreo(afirmaciones) → conteos y % de verdad sobre lo EVALUABLE (traza + falsas; excluye ignorado/sin_unidad/eco/revisar) */
export const VEREDICTOS_FALSOS = new Set(["no_traza", "dueno_distinto", "metrica_distinta", "pasado_reescrito", "cambio_no_avisado", "conteo_no_cierra", "relacion_no_cierra"]);
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
  const personasAcum = [];
  const out = [];
  for (const t of hilo.turnos || []) {
    const delTurno = (t.llamadas || []).map((l) => ({ ...l, sesion: t.sesion, turno: t.turno }));
    acum.push(...delTurno);
    personasAcum.push({ texto: t.textoEnviado || t.persona, sesion: t.sesion, turno: t.turno });
    const r = rastrearTurno({ texto: t.texto, persona: t.textoEnviado || t.persona, personaDelHilo: personasAcum.slice(), llamadasDelHilo: acum, llamadasDelTurno: delTurno, empresaId: hilo.empresa, buscarTodos, nombresAjenos });
    out.push({ sesion: t.sesion, turno: t.turno, ...r });
  }
  return out;
}
