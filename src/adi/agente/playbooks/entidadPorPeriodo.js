/* === src/adi/agente/playbooks/entidadPorPeriodo.js · PLAYBOOK 3 · ENTIDAD × PERÍODO (forma) ==================
 *
 * LA PREGUNTA INSIGNIA DEL OWNER —«cuánto me compró Falabella el último mes»— es la que motivó el frente entero.
 * Hoy tiene DOS caminos y un hueco entre ellos:
 *   · serie BLOQUEADA (no reconcilia / de muestra) o nombre ambiguo → el PUENTE (determinístico, aprobado):
 *     declina con la razón verdadera. Cubierto.
 *   · serie REAL reconciliada → «el cerebro corre con su herramienta». Ese es el hueco: nada garantiza que
 *     la llame, ni que narre el mes que se pidió, ni que no invente un delta.
 * Este playbook cierra el segundo caso. Los dos usan EL MISMO detector (`detectSerieIntent`): son
 * complementarios por construcción —el puente toma `!serieRealDe(x).real`, este toma `.real`— y jamás compiten,
 * porque el bucle resuelve el puente ANTES de mirar los playbooks.
 *
 * ⚠️ EN EL DEMO NO SE ACTIVA NUNCA (medido: los 13 clientes están «sin-periodo», el histórico es de muestra). Se
 * activa en el pack de la PLANTILLA —la forma de un cliente real— donde las series reconcilian con la cifra
 * oficial. Por eso su gate corre contra ese pack, y por eso el playbook se retira sin ruido en el demo: no hay
 * nada que prometer donde el dato no lo sostiene.
 *
 * EL MÉTODO: un paso, `serieEntidad{entity, metrica}` — la serie mensual REAL de esa entidad, reconciliada.
 * El entregable depende del CORTE que el detector ya identificó (jamás de comprensión):
 *   ultimo   → el último mes con su cifra y el delta contra el anterior, con las dos cifras a la vista
 *   pelicula → todos los meses, uno por línea
 *   punto    → ese mes, con su cifra
 *
 * PURO · determinístico · sin red. Cifras VERBATIM de la boleta. El delta se dice con sus dos bases («$X en
 * julio → $Y en agosto») y el porcentaje se declara como cálculo sobre esas dos cifras verbatim. */

import { detectSerieIntent } from "../../oracle/serieIntent.js";
import { serieRealDe } from "../../sentrix/capability.js";
import { axisEntityNames } from "../../oracle/entityIndex.js";   // SOLO nombre exacto (ley del único buscador): la entidad sin período

const _esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const _lab = (f) => String((f && f.label) || "");
const _val = (f) => String((f && (f.text || f.value)) || "");
const _num = (f) => (f && Number.isFinite(f.raw) ? f.raw : NaN);

/** el detector del puente, y la condición que este playbook agrega: la serie es REAL. Sin eso, no aplica. */
/* ⚠️ LA ENTIDAD SIN PERÍODO (censo de rutas T1, 2026-09-05): «cuánto me compró Falabella» —sin decir cuándo—
 * no tenía camino: `detectSerieIntent` exige el corte temporal. Ese detector es del CAMINO NATURAL, que corre
 * en producción como rollback y no se mejora (§7), así que NO se toca: el playbook resuelve su propio caso.
 * Cuando la pregunta nombra una entidad EXACTA del tenant y pide su compra/venta sin decir el período, el
 * corte honesto es la PELÍCULA (mes a mes, que es lo que el dato tiene) — no se inventa un mes que nadie pidió.
 * La ley del único buscador se respeta: solo el nombre EXACTO resuelve; un parecido no entra por acá. */
/* ⚠️ SIN `\b` DESPUÉS DE VOCAL ACENTUADA (el `\b` imposible del §5g — me mordió acá al estrenarlo): «compró»
 * termina en «ó» y `\b` no cierra ahí, así que el patrón con `\b` no veía la forma que la gente escribe. */
const _FIN_PALABRA = "(?![a-záéíóúüñ])";
const _PIDE_COMPRA = new RegExp(`\\bcu[aá]nto\\b[^.\\n]{0,20}(?:me\\s+)?(?:compr[oó]|compra|vendi[oó]|factur[oó])${_FIN_PALABRA}|\\bcu[aá]nto (?:lleva|le vend)`, "i");
function _sinPeriodo(pregunta) {
  const q = String(pregunta || "");
  if (!_PIDE_COMPRA.test(q)) return null;
  for (const eje of ["cliente", "sku", "marca", "familia"]) {
    let nombres = [];
    try { nombres = axisEntityNames(eje) || []; } catch { nombres = []; }
    for (const n of nombres) {
      if (String(n).length < 3) continue;
      if (new RegExp(`\\b${String(n).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(q)) {
        return { entidad: n, metrica: "venta", corte: { tipo: "pelicula" }, ambiguo: false };
      }
    }
  }
  return null;
}
function _caso(pregunta) {
  let det = null;
  try { det = detectSerieIntent(String(pregunta || "")); } catch { return null; }
  if (!det || det.ambiguo || !det.entidad || !det.metrica) det = _sinPeriodo(pregunta);
  if (!det || det.ambiguo || !det.entidad || !det.metrica) return null;
  let estado = null;
  try { estado = serieRealDe(det.entidad); } catch { return null; }
  if (!estado || !estado.real) return null;   // la serie bloqueada es del puente, no de este playbook
  return det;
}

/** los puntos de la serie de ESA entidad y ESA métrica, en el orden de la boleta (el motor los emite por mes). */
function _puntos(figs, det) {
  const re = new RegExp(`^${_esc(det.entidad)} · ${_esc(det.metrica)} · (.+)$`, "i");
  return (Array.isArray(figs) ? figs : [])
    .map((f) => { const m = re.exec(_lab(f)); return m ? { mes: m[1].trim(), fmt: _val(f), raw: _num(f) } : null; })
    .filter(Boolean);
}
const _METRICA_TXT = { venta: "venta", margen: "margen", contribucion: "contribución", unidades: "unidades", acciones: "acciones comerciales" };

export const entidadPorPeriodo = {
  nombre: "entidad-por-periodo",
  ejemplos: ["cuánto me compró Depósito Riachuelo el último mes", "muéstrame la venta de Depósito Riachuelo mes a mes"],
  /* el pack donde sus ejemplos ACTIVAN el playbook: en el demo no hay serie real y `pasos` resuelve a cero. El
   * gate lo lee para cargar el tenant correcto antes de verificar el patrón — declarado, no adivinado. */
  tenantDeMuestra: "plantilla",

  cuandoAplica(pregunta) { return _caso(pregunta) !== null; },

  pasos(pregunta) {
    const d = _caso(pregunta);
    return d ? [{ tool: "serieEntidad", args: { entity: d.entidad, metrica: d.metrica },
      para: `la serie mensual REAL y reconciliada de ${d.entidad} (${_METRICA_TXT[d.metrica] || d.metrica}), mes por mes con su cifra` }] : [];
  },
  obligatorias(pregunta) {
    const d = _caso(pregunta);
    return d ? [new RegExp(`^${_esc(d.entidad)} · ${_esc(d.metrica)} · `, "i")] : [];
  },

  entregable: "la cifra del mes que se pidió, con el nombre del mes y de la entidad; si es «el último mes», también el mes anterior con su cifra, para que el delta tenga sus dos bases a la vista; si es «mes a mes», cada mes con su cifra. Nada de otro mes ni de otra entidad.",

  /* ── EL ENTREGABLE DETERMINÍSTICO ─────────────────────────────────────────────────────────────────────────
   * Cifras verbatim. Con menos de un punto no hay nada que servir; con «último» y un solo punto, se sirve el
   * punto sin delta (no se inventa un anterior). El % del delta es un CÁLCULO sobre dos cifras verbatim y se
   * declara como tal, en su bloque, para que el muro lo recompute. */
  componer({ figs, pregunta } = {}) {
    const d = _caso(pregunta);
    if (!d) return null;
    const p = _puntos(figs, d);
    if (!p.length) return null;
    const txt = _METRICA_TXT[d.metrica] || d.metrica;
    if (d.corte && d.corte.tipo === "pelicula") {
      return [`${txt.charAt(0).toUpperCase() + txt.slice(1)} de ${d.entidad}, mes a mes:`, ...p.map((x) => `- ${x.mes}: ${x.fmt}`)].join("\n");
    }
    if (d.corte && d.corte.tipo === "punto") {
      const mesNum = d.corte.mes;
      const nombres = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
      const x = p.find((q) => new RegExp(`^${nombres[mesNum - 1]}\\b`, "i").test(q.mes));
      return x ? `${d.entidad} en ${x.mes}: ${txt} de ${x.fmt}.` : null;
    }
    // ultimo
    const u = p[p.length - 1], a = p.length >= 2 ? p[p.length - 2] : null;
    if (!a) return `${d.entidad} en ${u.mes}: ${txt} de ${u.fmt}. Es el único mes con serie en tu archivo.`;
    const lineas = [`${d.entidad} te compró ${u.fmt} en ${u.mes}; en ${a.mes} habían sido ${a.fmt}.`];
    if (Number.isFinite(u.raw) && Number.isFinite(a.raw) && a.raw !== 0) {
      const pct = ((u.raw - a.raw) / Math.abs(a.raw)) * 100;
      /* ⚠️ EL SIGNO ES EL GUION ASCII, no el «−» tipográfico (U+2212). La primera versión escribía «−6.1%» y el
       * `_num` del muro solo acepta `-?`: el campo `resultado` no se parseaba, el [[CALCULO]] no cerraba y el
       * turno caía a la escalera con dos vetos. Medido en la sonda, no supuesto.
       * ⚠️ Y EL «+» TAMBIÉN ROMPE (cazado al congelar la certificación, 2026-09-02): el mismo parser `-?` no
       * lee «+43.6%», así que el recompute daba 43.6% contra un declarado «+43.6%» y el muro vetaba la cuenta
       * QUE CERRABA — la insignia de la completa (Mercado Norte, delta positivo) moría en el peldaño. El caso
       * negativo del demo (−6.1%) jamás lo mostró: media suerte, no cobertura. El positivo va SIN signo en el
       * resultado y con el alza dicha en palabras; el negativo queda como estaba (verificado). */
      const signo = pct >= 0 ? "" : "-";
      lineas.push(pct >= 0
        ? `Eso es ${Math.abs(pct).toFixed(1)}% más contra el mes anterior.`
        : `Eso es -${Math.abs(pct).toFixed(1)}% contra el mes anterior.`);
      /* ⚠️ EL ORDEN DE LOS INPUTS ES (NUEVO; VIEJO): guardC recompone `variacion_pct` como (v[0] − v[1]) / v[1].
       * Escribí (viejo; nuevo) y el muro obtuvo +6.5% contra mi −6.1%: veto, y el turno a la escalera. No es
       * un formato que se adivina: se lee del recompute (guardC:3056). */
      /* …y CON DUEÑO: el muro exige que un resultado atribuible declare de quién es («la cuenta cierra, pero no
       * declara dueño» — medido). El dueño tiene que ser una entidad REAL del tenant, y acá lo es. */
      lineas.push(`\n[[CALCULO]]\nid=c1 · op=variacion_pct · inputs=${u.fmt}; ${a.fmt} · formula=(${u.fmt} - ${a.fmt}) / ${a.fmt} · resultado=${signo}${Math.abs(pct).toFixed(1)}% · unidad=pct · dueno=${d.entidad}\n`);
    }
    return lineas.join("\n");
  },

  /* ── LA LISTA NOTARIAL ─────────────────────────────────────────────────────────────────────────────────── */
  listaNotarial(texto, { figs, pregunta } = {}) {
    const v = [];
    const d = _caso(pregunta);
    if (!d) return v;
    const t = String(texto || "");
    const p = _puntos(figs, d);
    // (1) el mes que se pidió es el que se responde: para «último», el último mes de la serie tiene que estar
    if (d.corte && d.corte.tipo === "ultimo" && p.length && !t.includes(p[p.length - 1].mes.split(" ")[0])) {
      v.push({ regla: "mes-equivocado", multa: `pidió el último mes y el último mes de la serie es ${p[p.length - 1].mes}: nómbralo con su cifra (${p[p.length - 1].fmt}).` });
    }
    // (2) la entidad de la pregunta es la que se responde
    if (!t.includes(d.entidad)) {
      v.push({ regla: "entidad-ausente", multa: `la pregunta es sobre ${d.entidad} y la respuesta no lo nombra: cada cifra de su serie va con su nombre.` });
    }
    return v;
  },
};
