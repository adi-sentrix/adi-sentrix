/* === src/adi/agente/playbooks/fichaDeEntidad.js · PLAYBOOK · LA FICHA DE UNA ENTIDAD (censo T4) =============
 *
 * LA SEÑAL, medida: «dame la ficha de Lider» · «qué pasa con Jumbo» · «cómo viene Falabella» · «háblame de
 * Ripley» — las siete formas del censo caían a `vacio`. Y el producto YA la promete por su cuenta: cuando el
 * puente no puede dar la serie de un cliente, cierra con «pídemela o ábrela en su ficha». Una promesa del
 * propio sistema sin camino detrás es peor que un hueco.
 *
 * UN SOLO PASO, UNA SOLA FUENTE. `entityProfile` publica el cuadro entero de la entidad —venta, margen,
 * contribución, costo, acciones comerciales, carga, el BENCHMARK declarado, el ranking por venta y, si es un
 * SKU, su capital, su rotación y sus días de inventario—. No se mezcla con `entityRecord`: medido sobre los 13
 * clientes, las dos herramientas coinciden en 12 y difieren en Lider ($17.9M contra $17.8M, redondeo). Dos
 * cifras para lo mismo es exactamente lo que este proyecto llama defecto, así que se cita UNA sola.
 *
 * LO QUE NO CITA, a propósito:
 *   · la «brecha de margen», que el motor publica en % cuando compara dos tasas y por lo tanto debería ir en
 *     pp. Reescribirle la unidad a una cifra publicada es inventarla; decir «margen 22.0%, bajo el benchmark
 *     que declaraste (30.1%)» dice lo mismo con las dos cifras que sí son del dato.
 *   · «Cobertura (DOH)» con ese nombre: en pantalla el término es «Días de inventario» (la ambigüedad quedó
 *     resuelta por eliminación, no por renombre) y el valor citado es el de `doh`, que es el que corresponde.
 *   · la meta de carga: se nombra con `etiquetaDeLaCarga()`, que sabe si la declaró el negocio o es nuestra.
 *
 * LO QUE NO HACE: explicar por qué esa cuenta rinde así. La ficha LOCALIZA. La causa no está en este dato y el
 * 03 lo dice.
 *
 * PURO · determinístico · sin red. Cifras VERBATIM de la boleta: selecciona y ordena, jamás calcula. */

import { entidadNombrada } from "./indiceEntidades.js";
import { detectSerieIntent } from "../../oracle/serieIntent.js";   // la entidad×período es del puente, no de acá
import { etiquetaDeLaCarga } from "../../../config/businessPolicy.js";
import { variante } from "../variacion.js";

const _val = (f) => String((f && (f.text || f.value)) || "");
const _lab = (f) => String((f && f.label) || "");
const _num = (f) => (f && Number.isFinite(f.raw) ? f.raw : NaN);
const _pct = (f) => {
  const r = _num(f);
  if (Number.isFinite(r)) return r;
  const m = /^-?[\d.,]+\s*%$/.exec(_val(f).trim());
  return m ? parseFloat(m[0].replace("%", "").replace(",", ".")) : NaN;
};
const _find = (figs, re) => (Array.isArray(figs) ? figs : []).find((f) => re.test(_lab(f))) || null;
const _esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const _FIN = "(?![a-záéíóúüñ])";

/* ── EL DETECTOR ────────────────────────────────────────────────────────────────────────────────────────────
 * Dos condiciones: la pregunta NOMBRA una entidad del índice, y pide la lectura DE ESA entidad. La segunda es
 * la que evita el secuestro: «cuánto me compró Falabella» también nombra a alguien y es del puente.
 * Ante la duda, false — un detector que se activa de más le aplica a otro turno las promesas de este. */
const _PIDE_FICHA = new RegExp([
  `\\bficha${_FIN}`, `\\bcuadro de${_FIN}`, `\\bperfil${_FIN}`,
  `\\bqu[eé] pasa con${_FIN}`, `\\bqu[eé] onda${_FIN}`, `\\bh[aá]blame de${_FIN}`, `\\bcont[aá]me de${_FIN}`,
  `\\bc[oó]mo (?:viene|va|est[aá]|anda)${_FIN}`, `\\bqu[eé] tal (?:viene|va|est[aá])${_FIN}`,
  `\\bmu[eé]strame${_FIN}`, `\\bdame (?:todo|los datos|el detalle)${_FIN}`, `\\brev[ií]same${_FIN}`,
].join("|"), "i");
/* lo que NO es una ficha aunque nombre a alguien: la serie y el período (puente / entidad-por-período), la
 * simulación, el cobro, y las lecturas que piden UNA métrica cruzada por otro eje. */
const _FUERA = new RegExp([
  `\\bsimul`, `\\bproyect`, `\\bqu[eé] pasa si${_FIN}`, `\\bpon[eé]le que${_FIN}`,
  `\\bdeb[eo]n?${_FIN}`, `\\bvencid`, `\\bcobr`,
  /* sin `\b` delante de la «ú»: entre el espacio y una vocal acentuada NO hay frontera de palabra y la
   * exclusión no dispararía nunca (§5g del contrato — el barrido me lo cazó al estrenar este archivo). */
  `\\bmes a mes${_FIN}`, `\\bmensual${_FIN}`, `[uú]ltimo mes${_FIN}`, `\\bq[1-4]${_FIN}`, `\\btrimestr`,
  `\\bcompar[aá]`, `\\bversus${_FIN}`, `\\bvs\\.?${_FIN}`,
  `\\bcu[aá]nto me (?:compr[oó]|vendi[oó])${_FIN}`,
].join("|"), "i");

/** el caso: `{ nombre, eje }` de la entidad, o null. Una sola lectura de la pregunta para todo el playbook. */
function _caso(pregunta) {
  const q = String(pregunta || "");
  if (!q.trim() || _FUERA.test(q)) return null;
  try { if (detectSerieIntent(q)) return null; } catch { /* detector mudo: sigue */ }
  const ent = entidadNombrada(q);
  if (!ent) return null;
  /* el nombre SOLO (una palabra, la que nombra a alguien) es un pedido de ficha: así se escribe en un chat.
   * Con más texto alrededor, hace falta que ese texto pida la lectura — nombrar a alguien al pasar no la pide. */
  const soloElNombre = q.trim().replace(/[¿?¡!.,]/g, "").trim().toLowerCase() === ent.nombre.toLowerCase();
  if (!soloElNombre && !_PIDE_FICHA.test(q)) return null;
  return ent;
}

export const fichaDeEntidad = {
  nombre: "ficha-de-entidad",

  /* ⚠️ SIN `ejemplos` A PROPÓSITO: los pasos dependen de QUIÉN se nombra, y nombrar entidades del demo acá
   * mete datos del tenant al bundle del frontend (el gate del bundle lo cazó: «Lider» y «Jumbo» aparecían en
   * el grafo de esbuild). Las preguntas de muestra viven en `_agente_playbooks_gate.mjs`, que es quien las
   * necesita — el código de producción no carga nombres de nadie. */

  cuandoAplica(pregunta) { return _caso(pregunta) !== null; },

  pasos(pregunta) {
    const ent = _caso(pregunta);
    return ent ? [{ tool: "entityProfile", args: { entity: ent.nombre },
      para: `el cuadro completo de ${ent.nombre}: venta, margen, contribución, costo, acciones comerciales y carga, con el benchmark declarado y su ranking por venta` }] : [];
  },

  obligatorias(pregunta) {
    const ent = _caso(pregunta);
    return ent ? [new RegExp(`^${_esc(ent.nombre)} · Ventas?$`, "i"), new RegExp(`^${_esc(ent.nombre)} · Margen$`, "i")] : [];
  },

  entregable: "la ficha de esa entidad en una lectura: cuánto vende y qué lugar ocupa, con qué margen contra el benchmark declarado, cuánta contribución deja, qué le cuesta en acciones comerciales — y, si es un SKU, su capital, su rotación y sus días de inventario. Localiza; el porqué de su rendimiento no está en este dato.",

  componer({ figs, pregunta, semilla } = {}) {
    const ent = _caso(pregunta);
    if (!ent) return null;
    const de = (concepto) => _find(figs, new RegExp(`^${_esc(ent.nombre)} · ${concepto}$`, "i"));
    const venta = de("Ventas?");
    const margen = de("Margen");
    if (!venta || !margen) return null;                       // sin venta y margen no hay ficha
    const contrib = de("Contribuci[oó]n");
    const acciones = de("Acciones comerciales");
    const carga = de("Carga comercial");
    const ranking = de("ranking por venta");
    const bench = _find(figs, /^Benchmark de margen$/i);
    const metaCarga = _find(figs, /^Meta de carga comercial$/i);
    const capital = de("Capital");
    const rotacion = de("Rotaci[oó]n");
    const doh = de("Cobertura \\(DOH\\)");

    const QUE_ES = { cliente: "cliente", sku: "SKU", marca: "marca", familia: "familia", bodega: "bodega", canal: "canal" }[ent.eje] || ent.eje;
    const p = [];

    /* 1 · QUÉ ESTÁ PASANDO — cuánto pesa y cómo rinde, con la vara al lado (la ley de la vara única) */
    const bajoLaVara = bench && Number.isFinite(_pct(margen)) && Number.isFinite(_pct(bench)) && _pct(margen) < _pct(bench);
    p.push(`${ent.nombre} · ${QUE_ES}. Venta del período: ${_val(venta)}${ranking && _val(ranking) ? ` — ${_val(ranking)} por venta` : ""}.`);
    p.push(bench
      ? `Su margen es ${_val(margen)}, ${bajoLaVara ? "bajo" : "sobre"} el benchmark declarado (${_val(bench)}).`
      : `Su margen es ${_val(margen)}.`);

    /* 2 · DÓNDE — lo que deja y lo que cuesta, sin decir por qué (el dato no lo trae) */
    /* ⚠️ CADA CIFRA PEGADA A SU CONCEPTO, en oraciones cortas. La versión larga —«…una carga de 3.2% sobre su
     * venta contra tu nivel declarado (3.5%)»— la vetó el muro con razón: el porcentaje del final quedaba lejos
     * de la palabra que lo nombra y se leía como margen. Es la corrección de la VOZ, jamás del juez. */
    const dos = [];
    if (contrib) dos.push(`deja ${_val(contrib)} de contribución`);
    if (acciones) dos.push(`lleva ${_val(acciones)} en acciones comerciales`);
    if (dos.length) p.push(`\nEn el período ${dos.join(" y ")}.`);
    if (carga) {
      p.push(`Su carga comercial es ${_val(carga)} de su venta${metaCarga ? `, contra ${etiquetaDeLaCarga()} de ${_val(metaCarga)}` : ""}.`);
    }
    /* el SKU trae además su lado de inventario: se dice «días de inventario», que es el término de pantalla */
    if (capital || rotacion || doh) {
      const inv = [];
      if (capital) inv.push(`${_val(capital)} de capital en inventario`);
      if (rotacion) inv.push(`rotación ${_val(rotacion)}`);
      if (doh) inv.push(`${_val(doh)} de días de inventario`);
      p.push(`\nPor el lado del inventario: ${inv.join(" · ")}.`);
    }

    /* 3 · QUÉ HACER PRIMERO — ofrecido, y el límite dicho */
    p.push(`\nPor qué rinde así no está en este dato: la ficha localiza, no explica.`);
    p.push(variante(semilla, [
      `Si quieres, la comparo contra el resto de la cartera para ver si es un caso o un patrón.`,
      `¿La ponemos contra el resto de la cartera? Ahí se ve si es un caso aislado o un patrón.`,
      `Te la puedo contrastar con el resto de la cartera para ver si es la excepción o la regla.`,
    ]));
    return p.join("\n");
  },

  listaNotarial(texto, { figs, pregunta } = {}) {
    const t = String(texto || "");
    if (!t.trim()) return [];
    const v = [];
    const ent = _caso(pregunta);
    /* (1) LA VARA NO SE INVIERTE: si el texto dice que rinde sobre el benchmark y la boleta dice lo contrario
     * —o al revés—, miente. Es el signo de una comparación entre dos raw ya publicados, cero cálculo nuevo. */
    if (ent) {
      const margen = _find(figs, new RegExp(`^${_esc(ent.nombre)} · Margen$`, "i"));
      const bench = _find(figs, /^Benchmark de margen$/i);
      if (margen && bench && Number.isFinite(_pct(margen)) && Number.isFinite(_pct(bench))) {
        const bajo = _pct(margen) < _pct(bench);
        if (bajo && /\b(?:sobre|por encima de|supera)\b[^.\n]{0,30}\bbenchmark\b/i.test(t)) {
          v.push({ regla: "vara-invertida", multa: "dices que rinde sobre el benchmark y su margen publicado está por debajo: corrige la lectura." });
        }
        if (!bajo && /\bbajo\b[^.\n]{0,30}\bbenchmark\b|\bpor debajo del benchmark\b/i.test(t)) {
          v.push({ regla: "vara-invertida", multa: "dices que rinde bajo el benchmark y su margen publicado está por encima: corrige la lectura." });
        }
      }
    }
    /* (2) LA FICHA NO EXPLICA: una causa afirmada sobre una cuenta es la regla 2 del contrato, y este dato no
     * trae por qué una cuenta cede margen. Localizar no es explicar. */
    for (const o of t.split(/[.!?\n]+/)) {
      if (!new RegExp(`\\bporque${_FIN}|\\bse debe a${_FIN}|\\bla causa (?:es|est[aá])${_FIN}|\\bpor culpa de${_FIN}`, "i").test(o)) continue;
      v.push({ regla: "causa-sin-respaldo", multa: "afirmas por qué esa cuenta rinde así y este dato no lo declara: localiza (cuánto y dónde) o di que la causa no está medida." });
      break;
    }
    /* (3) EL TÉRMINO DE PANTALLA: «cobertura» quedó resuelto POR ELIMINACIÓN — el dato trae `doh` y `cobertura`
     * como campos distintos, y el que se muestra es `doh` bajo el nombre «días de inventario». */
    if (/\bcobertura\b/i.test(t)) {
      v.push({ regla: "termino-declinado", multa: "«cobertura» no es un término de pantalla: el dato trae dos campos distintos y el que se usa es días de inventario. Decílo así." });
    }
    return v;
  },
};
