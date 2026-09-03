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
 * PURO · determinístico · sin red. Cifras VERBATIM de la boleta; selecciona y ordena, jamás calcula. */

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

const _TEMA = /\briesgo[s]?\b|\bs[ií]ntesis ejecutiva\b/i;
const _EJECUTIVO = /\bdirectorio\b|\bboard\b|\bgerencia\b|\bgerente\b|\bgg\b|\bejecutiv[oa]s?\b|\bs[ií]ntesis ejecutiva\b/i;

/* el locator de cada riesgo: el mayor «Entidad · <concepto>» de su familia, para el DÓNDE y el PRIMERO */
const _topDe = (figs, re) => _all(figs, re)
  .filter((f) => !/· subtotal$/i.test(_lab(f)))
  .map((f) => ({ entidad: _entidadDe(_lab(f)), usd: _num(f), fmt: _val(f) }))
  .filter((x) => x.entidad && Number.isFinite(x.usd))
  .sort((a, b) => b.usd - a.usd)[0] || null;

export const sintesisEjecutiva = {
  nombre: "sintesis-ejecutiva",

  cuandoAplica(pregunta) {
    const q = String(pregunta || "");
    if (!q.trim() || _SIMULA.test(q)) return false;
    return _TEMA.test(q) && _EJECUTIVO.test(q);
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
    partes.push(n >= 3 ? "Los 3 riesgos, por materialidad:" : `Tu dato sostiene ${n === 1 ? "un riesgo material" : `${n} riesgos materiales`}${_umbral() ? ` (el resto queda ${_umbral()})` : ""} — no invento el que falta:`);
    // LA VOZ (2026-09-03): el telegrama «QUÉ. Dónde: X. Primero: Y.» se cuenta como lo contaría un asesor —
    // mismas cifras, mismos dueños, misma estructura de tres, y las ofertas siguen siendo ofertas.
    let i = 1;
    if (ventaCae) {
      partes.push(`\n${i++} · La venta viene cayendo: ${_val(ventaCae)} contra el año anterior. Dónde se cae por cliente no está en esta síntesis — si quieres, abro esa lectura primero.`);
    }
    for (const c of elegidos) {
      partes.push(`\n${i++} · ${c.nombre}: ${_val(c.f)}${c.top ? ` — encabeza ${c.top.entidad} con ${c.top.fmt}` : ""}. Si quieres, abrimos ${c.top ? c.top.entidad : c.abrir}.`);
    }
    if (fuera > 0 && n >= 3) partes.push(`\n(${fuera} foco${fuera > 1 ? "s quedan" : " queda"} ${_umbral() || "bajo el umbral de materialidad"}.)`);
    /* «Cada» al inicio de oración casi-matchea «Casa Belgrano» y el corruptor de entidades lo veta (medido en
     * la parcial y en la completa real): el cierre arranca en «El porqué» a propósito. */
    partes.push("\n" + variante(semilla, [
      "El porqué de cada riesgo no está en este dato: queda localizado, no explicado. ¿Cuál abrimos primero?",
      "El porqué de cada riesgo no está en este dato: queda localizado, no explicado. ¿Por cuál entramos?",
      "El porqué de cada riesgo no está en este dato: queda localizado, no explicado. Dime cuál abrimos y entro ahí.",
    ]));
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
