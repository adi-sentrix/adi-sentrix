/* === src/adi/agente/playbooks/lecturaPorEje.js · PLAYBOOK 2 · LECTURA POR EJE (forma, no tema) ===============
 *
 * POR QUÉ UN PLAYBOOK DE FORMA. Medido por el supervisor sobre las 28 preguntas de la certificación (2026-09-01):
 * 19 quedaban «a criterio del cerebro», sin camino garantizado — y se agrupan por FORMA, no por tema. Once de
 * esas 19 son la misma pregunta con distinto eje: «ranking por canal», «qué marca deja más margen», «margen por
 * familia», «capital por bodega», «qué SKU tienen capital frenado». Siete playbooks de tema habrían cubierto
 * menos que este uno.
 *
 * EL MÉTODO. `cuandoAplica` detecta el EJE por léxico (canal · marca · familia · bodega · SKU frenado) y una
 * forma de pedir lectura (ranking, mejores/peores, qué X deja más, cuánto por X). `pasos` es una FUNCIÓN de la
 * pregunta: elige la herramienta que sirve ese eje —jamás «entiende» la pregunta, mira qué eje disparó—:
 *   canal      → queryMetric{ventas, canal}      (la única herramienta con el eje canal)
 *   marca      → marginRead{marca}               (margen + venta + benchmark por marca; salesRead filtra
 *   familia    → marginRead{familia}              «headline/headlineSub» a la boleta — medido, se evita)
 *   bodega     → queryMetric{capital, bodega}    (inventoryStatus NO toma `dimension`: se midió)
 *   sku frenado→ inventoryStatus{focus:"frenado"}
 *
 * LO QUE **NO** CUBRE, y se dice: «punto de venta» y «condición» no tienen herramienta (ninguna declara esos
 * ejes). Esas preguntas no entran acá: siguen su camino, que es `faltanteQueToca` nombrando la columna que el
 * archivo no trae, o la declinación honesta. Prometer un eje que el motor no sirve sería el defecto de siempre.
 *
 * PRECEDENCIA: va DESPUÉS de margen-en-riesgo en el registro. Ese playbook ya se retira ante canal/marca/familia
 * /bodega (`_OTRO_EJE`), así que no compiten; y «cómo viene mi margen» —sin eje— sigue siendo suyo.
 *
 * PURO · determinístico · sin red. Cifras VERBATIM de la boleta: este módulo selecciona y ordena, jamás calcula. */

import { detectSerieIntent } from "../../oracle/serieIntent.js";   // UN detector de entidad×período para el puente, entidad-por-período y este playbook
import { _sinNombresDeEntidad } from "../mapaDelDato.js";        // un nombre de entidad no es un eje — la función del mapa, compartida

const _FIN = "(?![a-záéíóúüñ])";
/* ⚠️ EL MOTOR SOLO PONE `raw` EN LAS FILAS DESTACADAS (la misma lección que margen-en-riesgo dejó escrita, y
 * que este playbook volvió a pagar en la sonda: «margen por marca» salía SIN ordenar porque de cinco marcas
 * solo algunas traían `raw`). Para ORDENAR hace falta el número de todas, así que cuando `raw` falta se lee
 * de la cifra que el motor YA publicó. La cifra que se cita sigue siendo la suya, verbatim; leerla para
 * ordenarla no es recalcularla. */
const _num = (f) => {
  if (f && Number.isFinite(f.raw)) return f.raw;
  const s = String((f && (f.text || f.value)) || "").trim();
  let m = /^-?[\d.,]+\s*%$/.exec(s);
  if (m) return parseFloat(m[0].replace("%", "").replace(",", "."));
  m = /^\$\s?(-?[\d.,]+)\s?([KMB])?$/.exec(s);
  if (m) { const n = parseFloat(m[1].replace(",", ".")); const k = { K: 1e3, M: 1e6, B: 1e9 }[m[2]] || 1; return Number.isFinite(n) ? n * k : NaN; }
  return NaN;
};
const _val = (f) => String((f && (f.text || f.value)) || "");
const _lab = (f) => String((f && f.label) || "");
const _all = (figs, re) => (Array.isArray(figs) ? figs : []).filter((f) => re.test(_lab(f)));
const _entidadDe = (label) => { const p = String(label || "").split("·").map((s) => s.trim()); return p.length >= 2 ? p[0] : null; };

/* ── LOS EJES · detector léxico por eje, en ORDEN de precedencia ────────────────────────────────────────────
 * «SKU frenado» va primero: «capital frenado por bodega» habla del estado del inventario, no del corte por
 * bodega. Los dos regex de cada eje usan `_FIN` y no `\b`: después de «á»/«ó» no hay frontera de palabra. */
const EJES = [
  { eje: "sku_frenado", re: new RegExp(`\\bfrenad|\\binmoviliz|\\bsin rotaci[oó]n|\\bstock (?:lento|muerto|parado)${_FIN}`, "i"),
    pasos: [{ tool: "inventoryStatus", args: { focus: "frenado" }, para: "qué SKU tienen el capital frenado, con su monto, sus días de inventario y su rotación" }],
    obligatorias: [/^Capital frenado · total$/i, /· Capital frenado$/i],
    metrica: /· Capital frenado$/i, unidad: "capital frenado" },
  { eje: "canal", re: new RegExp(`\\bcanal(?:es)?${_FIN}`, "i"),
    pasos: [{ tool: "queryMetric", args: { metric: "ventas", dimension: "canal" }, para: "la venta por canal, con el nombre de cada canal y su cifra" }],
    obligatorias: [/· Ventas$/i],
    metrica: /· Ventas$/i, unidad: "venta" },
  { eje: "marca", re: new RegExp(`\\bmarca[s]?${_FIN}`, "i"),
    pasos: [{ tool: "marginRead", args: { dimension: "marca" }, para: "el margen y la venta por marca, con el benchmark declarado y cuántas están bajo él" }],
    obligatorias: [/· Margen$/i, /^Benchmark de margen$/i],
    metrica: /· Margen$/i, unidad: "margen" },
  { eje: "familia", re: new RegExp(`\\bfamilia[s]?${_FIN}|\\bcategor[ií]a[s]?${_FIN}`, "i"),
    pasos: [{ tool: "marginRead", args: { dimension: "familia" }, para: "el margen y la venta por familia, con el benchmark declarado y cuántas están bajo él" }],
    obligatorias: [/· Margen$/i, /^Benchmark de margen$/i],
    metrica: /· Margen$/i, unidad: "margen" },
  { eje: "bodega", re: new RegExp(`\\bbodega[s]?${_FIN}|\\bdep[oó]sito[s]?${_FIN}|\\balmac[eé]n(?:es)?${_FIN}`, "i"),
    pasos: [{ tool: "queryMetric", args: { metric: "capital", dimension: "bodega" }, para: "el capital en inventario por bodega, con el nombre de cada bodega y su monto" }],
    obligatorias: [/· Capital$/i],
    metrica: /· Capital$/i, unidad: "capital" },
];

/* la forma de PEDIR una lectura: ranking, mejores/peores, cuál deja más, cuánto por. Sin esto, «la marca LG»
 * dentro de otra pregunta activaría el playbook por la sola palabra. */
const _PIDE_LECTURA = new RegExp(`\\branking${_FIN}|\\bmejor(?:es)?${_FIN}|\\bpeor(?:es)?${_FIN}|\\bcu[aá]l(?:es)?${_FIN}|\\bqu[eé]${_FIN}|\\bcu[aá]nto${_FIN}|\\bc[oó]mo${_FIN}|\\bdame${_FIN}|\\bmu[eé]stra|\\blista${_FIN}|\\bpor\\s+(?:canal|marca|familia|bodega|categor)`, "i");
/* lo que NO es una lectura por eje aunque nombre uno: simulaciones y proyecciones (tienen su playbook) y el
 * trato. La entidad×período NO va acá como regex: la decide `detectSerieIntent`, el MISMO detector del puente y
 * de entidad-por-período — un solo detector para las tres piezas, o se contradicen entre sí.
 * ⚠️ ACÁ HABÍA `\b[uú]ltimo mes`, Y ES EL `\b` IMPOSIBLE EN ESPEJO: `\b` se define sobre [A-Za-z0-9_], así que
 * entre el espacio y la «ú» de «el último» NO hay frontera y la exclusión nunca disparaba. Medido:
 * /\b[uú]ltimo mes/.test("el último mes") === false. El barrido §5g vigilaba el `\b` DESPUÉS de un no-\w; este
 * es el de ANTES. Se retira la regex y se usa el detector, que es lo correcto de todos modos. */
const _FUERA = new RegExp(`\\bsimul|\\bproyect|\\bqu[eé] pasa si${_FIN}|\\bpon[eé]le que${_FIN}|\\bllamame|\\bll[aá]mame`, "i");

const _ejeDe = (pregunta) => {
  const q = String(pregunta || "");
  if (_FUERA.test(q) || !_PIDE_LECTURA.test(q)) return null;
  /* entidad × período es de otros dos (puente / entidad-por-período): mismo detector, jamás una segunda regex */
  try { if (detectSerieIntent(q)) return null; } catch { /* detector mudo: sigue */ }
  /* ⚠️ UN NOMBRE DE ENTIDAD NO ES UN EJE (la misma lección que el mapa del dato ya pagó con «Depósito
   * Riachuelo»): el cliente se llama «Depósito…» y disparaba el eje bodega. El eje se busca en la pregunta SIN
   * los nombres del catálogo del tenant — con la función del mapa, compartida, no replicada. */
  const qSinNombres = (() => { try { return _sinNombresDeEntidad(q); } catch { return q; } })();
  return EJES.find((e) => e.re.test(qSinNombres)) || null;
};

export const lecturaPorEje = {
  nombre: "lectura-por-eje",
  /* las preguntas de muestra, una por eje: el gate resuelve `pasos` con cada una y verifica que la herramienta
   * exista y que la promesa se cumpla sobre el dato demo. Son las del protocolo, no inventadas. */
  ejemplos: ["ranking por canal: mejores y peores", "qué marca deja más margen", "margen por familia", "capital por bodega", "qué SKU tienen capital frenado"],

  cuandoAplica(pregunta) { return _ejeDe(pregunta) !== null; },

  pasos(pregunta) { const e = _ejeDe(pregunta); return e ? e.pasos : []; },
  obligatorias(pregunta) { const e = _ejeDe(pregunta); return e ? e.obligatorias : []; },

  entregable: "la lectura del eje que se pidió: cada entidad del eje con su cifra verbatim, ordenada de mayor a menor, y si el dato declara un benchmark, quiénes quedan bajo él. Nada de otro eje; nada que la boleta no traiga.",

  /* ── EL ENTREGABLE DETERMINÍSTICO ─────────────────────────────────────────────────────────────────────────
   * Una entidad por línea, cifras verbatim. Se AUTO-VERIFICA: si la boleta no trae al menos dos entidades del
   * eje con su métrica, no hay ranking que servir y cede al peldaño siguiente. */
  componer({ figs, pregunta } = {}) {
    const e = _ejeDe(pregunta);
    if (!e) return null;
    /* ⚠️ EN «SKU FRENADO» LA BOLETA MEZCLA EJES (medido en la sonda): `inventoryStatus` publica «Valparaíso ·
     * Capital frenado» (bodega) al lado de «LG-DRYER8KG · Capital frenado» (SKU), y el ranking salía con las
     * bodegas adentro. Solo los SKU traen además «· Rotación» y «· Días de inventario»: esa pertenencia es el
     * filtro — un hecho de la boleta, no un parser de nombres. */
    const esSku = e.eje !== "sku_frenado" ? null
      : new Set(_all(figs, /· (?:Rotaci[oó]n|D[ií]as de inventario)$/i).map((f) => _entidadDe(_lab(f))).filter(Boolean));
    const filas = _all(figs, e.metrica)
      .map((f) => ({ entidad: _entidadDe(_lab(f)), raw: _num(f), fmt: _val(f) }))
      .filter((x) => x.entidad && x.fmt && (!esSku || esSku.has(x.entidad)));
    if (filas.length < 2) return null;
    const conRaw = filas.every((x) => Number.isFinite(x.raw));
    if (conRaw) filas.sort((a, b) => b.raw - a.raw);
    const bench = _all(figs, /^Benchmark de margen$/i)[0] || null;
    // LA VOZ (2026-09-03): la apertura habla, el ranking sigue siendo un ranking — y «de mayor a menor»
    // se conserva textual: es la promesa de ORDEN que el muro verifica contra la tabla.
    const partes = [`Así viene tu ${e.unidad} por ${e.eje === "sku_frenado" ? "SKU" : e.eje}${conRaw ? ", de mayor a menor" : ""}:`];
    for (const x of filas.slice(0, 8)) partes.push(`- ${x.entidad}: ${x.fmt}`);
    if (filas.length > 8) partes.push(`(y ${filas.length - 8} más)`);
    if (bench) partes.push(`Tu benchmark de margen es ${_val(bench)}.`);
    return partes.join("\n");
  },

  /* ── LA LISTA NOTARIAL · sus promesas, por reglas ────────────────────────────────────────────────────────── */
  listaNotarial(texto, { figs, pregunta } = {}) {
    const v = [];
    const e = _ejeDe(pregunta);
    if (!e) return v;
    const t = String(texto || "");
    // (1) el eje pedido es el que se responde: nombrar OTRO eje como sujeto es cambiar de pregunta
    const otros = EJES.filter((x) => x.eje !== e.eje && x.eje !== "sku_frenado");
    for (const o of otros) {
      if (new RegExp(`\\bpor ${o.eje}${_FIN}`, "i").test(t)) {
        v.push({ regla: "eje-cambiado", multa: `el usuario pidió la lectura por ${e.eje} y la respuesta habla «por ${o.eje}»: responde el eje que pidió, con sus cifras.` });
        break;
      }
    }
    // (2) la evidencia trajo entidades del eje: una respuesta que no nombra NINGUNA es una disculpa con cifras
    //     (mismo filtro de SKU que el composer: en «frenado» la boleta trae bodegas al lado de los SKU)
    const soloSku = e.eje !== "sku_frenado" ? null
      : new Set(_all(figs, /· (?:Rotaci[oó]n|D[ií]as de inventario)$/i).map((f) => _entidadDe(_lab(f))).filter(Boolean));
    const entidades = _all(figs, e.metrica).map((f) => _entidadDe(_lab(f))).filter((n) => n && (!soloSku || soloSku.has(n)));
    if (entidades.length >= 2 && !entidades.some((n) => t.includes(n))) {
      v.push({ regla: "evidencia-sin-usar", multa: `la boleta trae ${entidades.length} ${e.eje === "sku_frenado" ? "SKU" : e.eje + "s"} con su ${e.unidad} y la respuesta no nombra ninguno: entrega la lectura que ya está en la mano.` });
    }
    return v;
  },
};
