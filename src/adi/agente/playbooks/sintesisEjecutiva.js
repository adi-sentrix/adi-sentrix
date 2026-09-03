/* === src/adi/agente/playbooks/sintesisEjecutiva.js · LOS 3 RIESGOS DEL DIRECTORIO (owner 2026-09-02) ========
 *
 * LA EVIDENCIA: «dame los 3 riesgos para el directorio» salió `vacio` en la corrida contaminada y `limite` con
 * menú en la limpia («Medida · liberar ELE-CAB25 = $38.1M. También tengo Capital frenado: dime cuál abro») —
 * el notario vetó tres cifras seguidas y el cerebro se quedó sin salida.
 *
 * EL MÉTODO — la doctrina fundadora de los playbooks: las lecturas de diagnóstico que YA existen corren ANTES
 * del cerebro (diagnose · executiveSummary · la de margen), la evidencia entra a la boleta, y si el cerebro no
 * compone, este entregable determinístico responde: EXACTAMENTE 3 riesgos, cada uno con QUÉ (cifra verbatim,
 * una por oración y con su dueño — la lección del veto de tres cifras seguidas) · DÓNDE (localiza, jamás
 * causas) · QUÉ HACER PRIMERO (ofrece, jamás ordena). La MATERIALIDAD del piso relativo elige los 3; si el
 * dato solo sostiene menos, se dice el número verdadero — inventar un tercer riesgo inmaterial para cumplir la
 * cuota sería la mentira con corbata.
 *
 * QUÉ NO CUBRE, a propósito: «dame una versión más dura» es una RE-NARRACIÓN (lo que hace falta ya está en el
 * hilo; medido: el empujón de herramientas ahí salió 43× más caro y PEOR) — este playbook exige que la
 * pregunta pida la síntesis ejecutiva en sus palabras (riesgos · directorio · síntesis ejecutiva); ante la
 * duda, false.
 *
 * PURO · determinístico · sin red. Cifras VERBATIM de la boleta; selecciona y ordena, jamás calcula.
 *
 * ═══ LA VARA DE VOZ EJECUTIVA (owner 2026-09-03 · PRIMER HALLAZGO DE USO REAL EN PRODUCCIÓN) ═══════════════
 * Probó «Dame los 3 riesgos principales para el directorio» y el defecto NO fue de cálculo: fue de FORMA. Lo
 * que aprobó y no se toca: no inventó el tercero · declaró el umbral · dio monto, foco y cliente · dijo que
 * el porqué no está. Los tres defectos que marcó, con su redacción esperada CITADA — esta es la vara para
 * TODOS los composers, no solo para este:
 *
 *   1 · DEFENSIVA. «no invento el que falta» suena a disculpa. «Un asesor no anuncia que no miente — lo
 *       demuestra callando lo inmaterial.» Su redacción: «Veo 2 riesgos materiales y dejaría el resto como
 *       monitoreo, no como tema de directorio» — EL LÍMITE COMO CRITERIO EJECUTIVO, que es lo que un
 *       directorio quiere oír.
 *   2 · JERGA DE UMBRAL. «bajo el 0,05% de tu venta: $50K» en la PRIMERA línea es lenguaje de ingeniería. La
 *       proporcionalidad se mantiene entera (regla 1), pero el umbral NO ABRE la respuesta: va al final, en
 *       frase de negocio. «Que sea auditable no significa que vaya en el titular.»
 *   3 · REPETICIÓN. «Si quieres, abrimos Falabella» dos veces: el cierre POR FOCO no escala (con tres focos
 *       serían tres). UNO solo, priorizado — y su clave: «abriría primero Falabella, porque concentra ambos
 *       focos», que es un HECHO de la boleta (la misma entidad encabezando dos focos), no una opinión.
 *
 * Su frase, que resume el encargo entero: «MISMO DATO, MEJOR FORMA DE PRESENTARLO». Ni una cifra cambió. */

import { pisoFocosUSD, declaracionUmbralFocos } from "../../specRetrieval.js";
import { variante } from "../variacion.js";   // el cierre varía por semilla («matar la repetición», 2026-09-03)

const _num = (f) => (f && Number.isFinite(f.raw) ? f.raw : NaN);
const _val = (f) => String((f && (f.text || f.value)) || "");
const _lab = (f) => String((f && f.label) || "");
const _find = (figs, re) => (Array.isArray(figs) ? figs : []).find((f) => re.test(_lab(f))) || null;
const _all = (figs, re) => (Array.isArray(figs) ? figs : []).filter((f) => re.test(_lab(f)));
const _entidadDe = (label) => {
  const p = String(label || "").split("·").map((s) => s.trim());
  return p.length >= 2 ? p[0] : null;
};
const _FIN = "(?![a-záéíóúüñ])";
const _SIMULA = new RegExp(`\\bsimul|\\bproyect|\\bqu[eé] pasa si${_FIN}|\\bpon[eé]le que${_FIN}`, "i");
const _piso = () => { try { return pisoFocosUSD() || 0; } catch { return 0; } };
const _umbral = () => { try { return declaracionUmbralFocos(); } catch { return ""; } };

const _CUENTA = ["", "un", "dos", "tres"];   // el conteo en palabras: un número suelto es un conteo sin boleta (el muro lo caza)
const _TEMA = /\briesgo[s]?\b|\bs[ií]ntesis ejecutiva\b/i;
const _EJECUTIVO = /\bdirectorio\b|\bboard\b|\bgerencia\b|\bgerente\b|\bgg\b|\bejecutiv[oa]s?\b|\bs[ií]ntesis ejecutiva\b/i;
/* las dos puertas del léxico corto (T1) — angostas a propósito: cada una pide una señal que un comentario al
 * pasar no tiene. «hay riesgo de quiebre en ese SKU» no es «los 3 riesgos»; «te mando el archivo al gerente»
 * no es «un resumen para el directorio». */
const _RIESGOS_COMO_CONJUNTO = /\b(?:los|mis|3|tres|principales)\s+(?:\d+\s+)?riesgos?\b|\briesgos?\s+(?:principales|del negocio|de la empresa)\b/i;
const _ENTREGA_A_COMITE = new RegExp([
  `\\b(?:resumen|s[ií]ntesis|informe|reporte)\\b[^.\\n]{0,30}\\b(?:para|al|del)\\s+(?:el\\s+)?(?:directorio|board|junta|comit[eé]|gerencia|gerente general)\\b`,
  /* «qué le digo al directorio» — la forma más natural de todas y la que el censo encontró sin camino */
  `\\bqu[eé]\\s+(?:le\\s+)?(?:digo|cuento|presento|muestro|llevo|reporto)\\b[^.\\n]{0,20}\\b(?:al|a la|para el|para la)\\s+(?:directorio|board|junta|comit[eé]|gerencia|gerente)\\b`,
].join("|"), "i");

/* el locator de cada riesgo: el mayor «Entidad · <concepto>» de su familia, para el DÓNDE y el PRIMERO */
const _topDe = (figs, re) => _all(figs, re)
  .filter((f) => !/· subtotal$/i.test(_lab(f)))
  .map((f) => ({ entidad: _entidadDe(_lab(f)), usd: _num(f), fmt: _val(f) }))
  .filter((x) => x.entidad && Number.isFinite(x.usd))
  .sort((a, b) => b.usd - a.usd)[0] || null;

export const sintesisEjecutiva = {
  nombre: "sintesis-ejecutiva",

  /* ⚠️ EL LÉXICO CORTO (censo de rutas 2026-09-05, tanda T1): el detector exigía TEMA **y** AUDIENCIA juntos, y
   * la gente escribe una de las dos. «los 3 riesgos» quedaba sin camino (tema sin audiencia) y «resumen para el
   * directorio» también (audiencia sin tema). Se abren las dos puertas, cada una con su guarda:
   *   · TEMA SOLO vale cuando los riesgos vienen ENUMERADOS o pedidos como conjunto («los 3 riesgos», «los
   *     riesgos principales») — «hay riesgo de quiebre en ese SKU» no es una síntesis y sigue afuera;
   *   · AUDIENCIA SOLA vale con una palabra de entrega («resumen/síntesis/informe para el directorio») — el
   *     deslinde con la foto se mantiene: «resumen ejecutivo de negocio» NO nombra audiencia de comité y es de
   *     `resumenDelNegocio`, que además corre después en el registro. */
  cuandoAplica(pregunta) {
    const q = String(pregunta || "");
    if (!q.trim() || _SIMULA.test(q)) return false;
    if (_TEMA.test(q) && _EJECUTIVO.test(q)) return true;
    if (_RIESGOS_COMO_CONJUNTO.test(q)) return true;
    if (_ENTREGA_A_COMITE.test(q)) return true;
    return false;
  },

  pasos: [
    { tool: "diagnose", args: {}, para: "dónde localiza el motor la contribución no capturada, la carga comercial alta y el capital frenado — los subtotales y quién encabeza cada uno" },
    { tool: "executiveSummary", args: {}, para: "la foto ejecutiva del período: venta contra el año anterior, contribución, margen contra el piso" },
    { tool: "marginRead", args: { dimension: "cliente" }, para: "el margen por cliente contra el benchmark declarado, para que el cerebro tenga la cartera a mano" },
  ],
  obligatorias: [/^Contribuci[oó]n no capturada · subtotal$/i],

  entregable: "exactamente 3 riesgos para el directorio, elegidos por materialidad (el piso relativo manda): cada uno con QUÉ (la cifra verbatim, con su dueño) · DÓNDE (localiza, sin causas que el dato no declara) · QUÉ HACER PRIMERO (una oferta, jamás una orden). Si el dato sostiene menos de 3 materiales, se dice el número verdadero.",

  componer({ figs, semilla } = {}) {
    const piso = _piso();
    /* los candidatos, cada uno con su cifra y su locator — SOLO familias que el diagnóstico declara */
    const candidatos = [];
    const mk = (re, nombre, reLoc, abrir) => {
      const f = _find(figs, re);
      if (f && Number.isFinite(_num(f)) && _num(f) > 0) candidatos.push({ nombre, f, usd: _num(f), top: _topDe(figs, reLoc), abrir });
    };
    mk(/^Contribuci[oó]n no capturada · subtotal$/i, "Contribución no capturada", /· Contribuci[oó]n no capturada$/i, "esa cuenta");
    mk(/^Carga comercial alta · subtotal$/i, "Carga comercial alta", /· Carga comercial alta$/i, "esa carga");
    mk(/^Capital frenado · subtotal$/i, "Capital frenado en inventario", /· Capital frenado$/i, "ese SKU");
    if (!candidatos.length) return null;

    const materiales = piso > 0 ? candidatos.filter((c) => c.usd >= piso) : candidatos;
    const fuera = candidatos.length - materiales.length;
    /* la venta cayendo, si el resumen la declara negativa, es el riesgo 1 — un negocio que se achica manda */
    const vsAnt = _find(figs, /^Ventas vs a[ñn]o anterior$/i);
    const ventaCae = vsAnt && Number.isFinite(_num(vsAnt)) && _num(vsAnt) < 0 ? vsAnt : null;

    const elegidos = materiales.sort((a, b) => b.usd - a.usd).slice(0, ventaCae ? 2 : 3);
    if (!elegidos.length && !ventaCae) return null;

    const partes = [];
    const n = elegidos.length + (ventaCae ? 1 : 0);
    /* EL TITULAR · EL LÍMITE COMO CRITERIO, NO COMO DESCARGO (owner 2026-09-03, primer hallazgo de uso real
     * en producción — su redacción esperada, citada en la cabecera de este archivo). «no invento el que falta»
     * sonaba a disculpa: un asesor no anuncia que no miente, lo demuestra callando lo inmaterial. Y el umbral
     * SALE DEL TITULAR: la proporcionalidad se mantiene entera (baja al final, en frase de negocio), pero un
     * directorio no abre con jerga de ingeniería. El conteo va en PALABRAS — el conteo-no-autorizado que el
     * muro le cazó al vigía el mismo día. */
    partes.push(n >= 3
      ? "Los 3 riesgos, por materialidad:"
      : `Veo ${_CUENTA[n] || n} ${n === 1 ? "riesgo material" : "riesgos materiales"} y dejaría el resto como monitoreo, no como tema de directorio:`);
    // LA VOZ (2026-09-03): el telegrama «QUÉ. Dónde: X. Primero: Y.» se cuenta como lo contaría un asesor —
    // mismas cifras, mismos dueños, misma estructura de tres, y las ofertas siguen siendo ofertas.
    let i = 1;
    if (ventaCae) {
      partes.push(`\n${i++} · La venta viene cayendo: ${_val(ventaCae)} contra el año anterior. Dónde se cae por cliente no está en esta síntesis.`);
    }
    for (const c of elegidos) {
      /* SIN OFERTA POR FOCO (owner 2026-09-03): «Si quieres, abrimos Falabella» salía una vez por riesgo —
       * con tres focos serían tres. El cierre es UNO, priorizado, y vive abajo. */
      partes.push(`\n${i++} · ${c.nombre}: ${_val(c.f)}${c.top ? ` — encabeza ${c.top.entidad} con ${c.top.fmt}` : ""}.`);
    }
    if (fuera > 0 && n >= 3) partes.push(`\n(${fuera} foco${fuera > 1 ? "s quedan" : " queda"} ${_umbral() || "bajo el umbral de materialidad"}.)`);

    /* ── EL CIERRE ÚNICO Y PRIORIZADO (owner 2026-09-03) ──────────────────────────────────────────────────
     * La repetición que él marcó: «Si quieres, abrimos Falabella» una vez por foco. Ahora es UNO, y la
     * prioridad se declara con su criterio — que es un HECHO DE LA BOLETA, no una opinión: si la misma
     * entidad encabeza más de un foco, se nombra POR ESO («concentra los dos focos» — sus palabras). Si
     * ninguna repite, manda el foco más pesado, y se dice cuál es. Cero cálculo: contar en cuántos focos
     * aparece un nombre que el motor ya publicó es selección, igual que ordenar. */
    const conDueno = elegidos.filter((c) => c.top && c.top.entidad);
    let lider = null, enCuantos = 0;
    for (const c of conDueno) {
      const k = c.top.entidad;
      const cuantos = conDueno.filter((x) => x.top.entidad === k).length;
      if (cuantos > enCuantos) { lider = c; enCuantos = cuantos; }
    }
    /* ⚠️ Y LA PRIORIDAD SE MARCA COMO CRITERIO (el muro me lo cazó al estrenar esta voz, con razón: la regla
     * `juicio-sin-marcar` de guardC — «el dato no ordena prioridades»). Priorizar es juicio del asesor aunque
     * el HECHO que lo sostiene sea de la boleta: se dice cuál es cada cosa. */
    const _CUANTOS = ["", "un", "dos", "tres"];
    const _MARCA = "—criterio mío, no una cifra del dato—";
    let prioridad = null;
    if (lider && enCuantos >= 2) {
      prioridad = `Empezaría por ${lider.top.entidad} ${_MARCA}: concentra ${enCuantos === elegidos.length ? `los ${_CUANTOS[enCuantos] || enCuantos} focos` : `${_CUANTOS[enCuantos] || enCuantos} de los ${_CUANTOS[elegidos.length] || elegidos.length} focos`}.`;
    } else if (lider) {
      prioridad = `Empezaría por ${lider.top.entidad} ${_MARCA}: encabeza el foco más pesado (${_val(lider.f)}).`;
    } else if (ventaCae) {
      prioridad = `Empezaría por la caída de venta ${_MARCA}: es lo que más pesa y todavía no está abierto por cliente.`;
    }
    /* «Cada» al inicio de oración casi-matchea «Casa Belgrano» y el corruptor de entidades lo veta (medido en
     * la parcial y en la completa real): el cierre arranca en «El porqué» a propósito. */
    const _oferta = variante(semilla, [
      "¿Lo abrimos?",
      "¿Entramos por ahí?",
      "Si te parece, entro por ahí.",
    ]);
    partes.push(`\n${prioridad ? `${prioridad} ` : ""}El porqué de cada riesgo no está en este dato: queda localizado, no explicado. ${_oferta}`);
    /* EL UMBRAL, FUERA DEL TITULAR pero PRESENTE (regla 1 intacta): la proporcionalidad no se negocia, su
     * lugar sí. Va al final y en frase de negocio — auditable no significa que abra la respuesta. */
    if (_umbral() && n < 3) partes.push(`Lo que dejo fuera del directorio queda ${_umbral()}.`);
    return partes.join("\n");
  },

  listaNotarial(texto, { figs } = {}) {
    const t = String(texto || "");
    if (!t.trim()) return [];
    const v = [];
    const CIFRA = /\$\s?[\d.,]+\s?[KMB]?|[\d.,]+\s*%/;
    /* 1 · un riesgo enumerado sin UNA cifra es opinión con número de orden */
    const enumerados = t.split(/\n/).filter((l) => /^\s*\d\s*[·.)]/.test(l));
    if (enumerados.length && enumerados.some((l) => !CIFRA.test(l))) {
      v.push({ regla: "riesgo-sin-cifra", multa: "enumeras un riesgo sin ninguna cifra del dato: cada riesgo lleva su cifra verbatim o no es un riesgo medido." });
    }
    /* 2 · «los 3 riesgos» son tres: cinco riesgos numerados es una lista, no una síntesis */
    if (enumerados.length > 3) {
      v.push({ regla: "sintesis-inflada", multa: `enumeras ${enumerados.length} riesgos: la síntesis ejecutiva es EXACTAMENTE 3, elegidos por materialidad — recorta y declara el criterio.` });
    }
    /* 3 · localizar no es explicar (la regla de la casa, con los mecanismos de este dominio) */
    const MEC = /contribuci[oó]n no capturada|carga comercial|capital frenado|benchmark|a[ñn]o anterior|piso/i;
    for (const o of t.split(/[.!?\n]+/)) {
      if (!new RegExp(`\\bporque\\b|\\bse debe a\\b|\\bla causa (?:es|est[aá])${_FIN}`, "i").test(o)) continue;
      if (!MEC.test(o) && !CIFRA.test(o)) {
        v.push({ regla: "causa-sin-respaldo", multa: "afirmas el porqué de un riesgo y este dato no lo declara: localiza (dónde y cuánto) o di que la causa no está medida." });
        break;
      }
    }
    return v;
  },
};
