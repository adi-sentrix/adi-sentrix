/* === src/adi/agente/playbooks/proyeccionDeclarada.js · PLAYBOOK 4 · PROYECCIÓN DECLARADA (forma) ===========
 *
 * LAS TRES PREGUNTAS DE LA CERTIFICACIÓN que quedaban a criterio del cerebro, y lo que les pasó en la corrida:
 *   T2 «ponele que el año que viene crezco 3%: cuánto sería mi venta?»       → preguntó en vez de proyectar
 *   T4 «Con ese total anual, proyecta 12 meses con +4% y dime cuánto genera» → hizo la cuenta en prosa: veto
 *   T5 «Sobre esos clientes, simula reducir 2 puntos porcentuales las acciones comerciales y dime si alguno
 *       queda sobre el benchmark»                                             → pidió `simulate` con un transform
 *                                                                              que el motor no tiene: vacío
 * Las tres tienen herramienta HOY (`proyectar` desde 1b; `simulateCarga{delta_pp}` desde 2026-08-14) y ninguna
 * tenía camino garantizado. Este playbook se lo da: la evidencia se calcula ANTES de que el cerebro decida, y
 * el resultado llega SELLADO en la boleta — que es la premisa que `calculoCatalogo.js` daba por cierta.
 *
 * DOS SUB-FORMAS, decididas por léxico (jamás por comprensión), y la HERRAMIENTA sale de cuál disparó:
 *   crecimiento sobre la VENTA  (% y sin otra medida)          → proyectar{tasa, horizonte}
 *   movimiento de CARGA en pp   (pp + acciones/carga/rebate)   → simulateCarga{dimension:"cliente", delta_pp}
 * El detector de la primera es EL MISMO que usa el juez P1 (`_PIDE_PROYECCION` · `_CIFRA_SUPUESTO` ·
 * `_OTRA_MEDIDA`, exportados del contrato): si el juez multa «no proyectaste», este playbook es el que proyecta.
 * Un detector, dos usos — o discrepan sobre la misma frase.
 *
 * LO QUE **NO** HACE, dicho: no inventa la tasa ni el horizonte (los lee de la pregunta; sin tasa, `proyectar`
 * devuelve la base y declara que falta el supuesto). Y «sobre ESOS clientes» no lo resuelve léxicamente: la
 * simulación de carga corre sobre la cartera completa, y el entregable lo dice.
 *
 * PURO · determinístico · sin red. Cifras VERBATIM de la boleta. */

import { _PIDE_PROYECCION, _CIFRA_SUPUESTO, _OTRA_MEDIDA } from "../contratoAgente.js";
import { axisEntityNames } from "../../oracle/entityIndex.js";

const _FIN = "(?![a-záéíóúüñ])";
const _lab = (f) => String((f && f.label) || "");
const _val = (f) => String((f && (f.text || f.value)) || "");
const _num = (f) => (f && Number.isFinite(f.raw) ? f.raw : NaN);
const _find = (figs, re) => (Array.isArray(figs) ? figs : []).find((f) => re.test(_lab(f))) || null;
const _all = (figs, re) => (Array.isArray(figs) ? figs : []).filter((f) => re.test(_lab(f)));
const _entidadDe = (label) => { const p = String(label || "").split("·").map((s) => s.trim()); return p.length >= 2 ? p[0] : null; };
const _pctDe = (f) => { const r = _num(f); if (Number.isFinite(r)) return r; const m = /^-?[\d.,]+\s*(?:%|pp)$/.exec(_val(f).trim()); return m ? parseFloat(m[0].replace(/[%p ]/g, "").replace(",", ".")) : NaN; };

/* ── LA CARGA EN PP ── «simula reducir 2 puntos porcentuales las acciones comerciales» */
const _CARGA = new RegExp(`\\bacciones comerciales${_FIN}|\\bcarga comercial${_FIN}|\\brebates?${_FIN}|\\bdescuentos?${_FIN}`, "i");
const _PP = /(\d+(?:[.,]\d+)?)\s*(?:pp|puntos? porcentuales?|puntos?)/i;
const _BAJA = new RegExp(`\\breduc|\\bbaj(?:a|ar|o)${_FIN}|\\brecort|\\bmenos${_FIN}|\\b-\\s*\\d`, "i");

/* ── EL HORIZONTE ── se LEE, jamás se inventa; sin horizonte en la pregunta, `proyectar` lo deja en blanco */
const _horizonteDe = (q) => {
  const m = /(\d{1,2})\s*mes(?:es)?/i.exec(q);
  if (m) return `${m[1]} meses`;
  if (/a[ñn]o que viene|pr[oó]ximo a[ñn]o|el a[ñn]o pr[oó]ximo/i.test(q)) return "12 meses";
  return null;
};
/* la tasa: el porcentaje de la pregunta (el primero) */
const _tasaDe = (q) => { const m = /([+-]?\d+(?:[.,]\d+)?)\s*%/.exec(q); return m ? parseFloat(m[1].replace(",", ".")) : null; };
/* ⚠️ LA DIRECCIÓN DEL SUPUESTO SE LEE, NO SE ASUME (cazado 2026-09-02 al ampliar el detector): «ponele que
 * baja 3%: ¿cuánto sería mi venta?» proyectaba **+3%** — el usuario declaraba una caída y recibía un
 * crecimiento, con la cifra bien formateada y MAL. El signo explícito («-3%») manda; sin signo, un verbo de
 * caída en la pregunta vuelve la tasa negativa. Sin «bajo» suelto (homógrafo de la preposición). */
const _CAE_VENTA = new RegExp(`\\bbaj(?:a|as|an|amos|ara|aran|e|en)${_FIN}|\\bca(?:e|en|igo|emos|yera)${_FIN}|\\breduc|\\breduzc|\\bdecrec|\\bpierd|\\bperd(?:emos|iera|i[eé]ramos)`, "i");
const _tasaConDireccion = (q) => {
  const tasa = _tasaDe(q);
  if (tasa === null) return null;
  if (/[+-]\s*\d[\d.,]*\s*%/.test(q)) return tasa;            // el signo explícito manda
  return _CAE_VENTA.test(q) ? -Math.abs(tasa) : tasa;
};
/* «esa manda»: con una entidad del tenant nombrada, la proyección no es sobre el total — se deja al cerebro */
const _nombraEntidad = (q) => {
  for (const eje of ["cliente", "sku", "marca", "familia"]) {
    let nombres = []; try { nombres = axisEntityNames(eje) || []; } catch { continue; }
    for (const n of nombres) { if (String(n).length >= 4 && new RegExp(`\\b${String(n).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(q)) return true; }
  }
  return false;
};

function _caso(pregunta) {
  const q = String(pregunta || "");
  if (!q.trim()) return null;
  // (b) la carga en pp — se mira PRIMERO: «reducir 2pp las acciones comerciales» también tiene un número y «simula»
  if (_CARGA.test(q) && _PP.test(q)) {
    const n = parseFloat(_PP.exec(q)[1].replace(",", "."));
    const delta = _BAJA.test(q) ? -Math.abs(n) : Math.abs(n);
    return { forma: "carga", delta };
  }
  // (a) el crecimiento sobre la venta — el MISMO detector del juez P1
  if (_PIDE_PROYECCION.test(q) && _CIFRA_SUPUESTO.test(q) && !_OTRA_MEDIDA.test(q) && !_nombraEntidad(q)) {
    const tasa = _tasaConDireccion(q);
    if (tasa === null) return null;
    return { forma: "venta", tasa, horizonte: _horizonteDe(q) };
  }
  return null;
}

export const proyeccionDeclarada = {
  nombre: "proyeccion-declarada",
  ejemplos: ["ponele que el año que viene crezco 3%: cuanto seria mi venta?", "Con ese total anual, proyecta 12 meses con +4% y dime cuánto genera adicional.",
    "Sobre esos clientes, simula reducir 2 puntos porcentuales las acciones comerciales y dime si alguno queda sobre el benchmark.",
    "Si crezco 3% los próximos 12 meses, ¿cuánto vendería?"],   // la forma del owner (orden textual 2026-09-02)

  cuandoAplica(pregunta) { return _caso(pregunta) !== null; },

  pasos(pregunta) {
    const c = _caso(pregunta);
    if (!c) return [];
    if (c.forma === "carga") return [{ tool: "simulateCarga", args: { dimension: "cliente", delta_pp: c.delta },
      para: `el margen de cada cliente si la carga comercial se mueve ${c.delta}pp, con su brecha contra el benchmark y lo que se libera` }];
    return [{ tool: "proyectar", args: c.horizonte ? { tasa: c.tasa, horizonte: c.horizonte } : { tasa: c.tasa },
      para: `la venta del período del negocio (la base, verificada) y la proyección con el ${c.tasa}% que declaró el usuario${c.horizonte ? ` a ${c.horizonte}` : ""}` }];
  },
  obligatorias(pregunta) {
    const c = _caso(pregunta);
    if (!c) return [];
    return c.forma === "carga" ? [/^Supuesto · movimiento de carga$/i, /· Margen supuesto$/i, /^Benchmark de margen$/i]
      : [/^Venta del período · el negocio$/i, /^Proyección · el negocio /i];
  },

  entregable: "para una proyección de venta: la base (dato) y la cifra proyectada (supuesto) en oraciones distintas, con la tasa y el horizonte que el usuario declaró, y el adicional. Para un movimiento de carga: qué clientes quedan sobre el benchmark con ese supuesto (o que ninguno), con su margen supuesto, y cuánto se libera en total. Ninguna de las dos es una cifra medida: se nombran como proyección o supuesto.",

  /* ── EL ENTREGABLE DETERMINÍSTICO ──────────────────────────────────────────────────────────────────────── */
  componer({ figs, pregunta } = {}) {
    const c = _caso(pregunta);
    if (!c) return null;
    if (c.forma === "venta") {
      const base = _find(figs, /^Venta del período · el negocio$/i);
      const proy = _find(figs, /^Proyección · el negocio /i);
      const adic = _find(figs, /^Proyección · adicional /i);
      if (!base) return null;
      if (!proy) return `Tu venta del período es ${_val(base)}. Para proyectarla necesito el supuesto de crecimiento: dime el porcentaje y te doy la cifra.`;
      const hz = c.horizonte ? ` a ${c.horizonte}` : "";
      return [`Sobre tu venta del período de ${_val(base)}, ${c.tasa < 0 ? `una caída de ${Math.abs(c.tasa)}%` : `un crecimiento de +${c.tasa}%`}${hz} te deja en ${_val(proy)}.`,
        adic ? (c.tasa < 0 ? `La diferencia contra tu base: ${_val(adic)}.` : `Adicional generado: ${_val(adic)}.`) : null,
        `Es una proyección sobre el supuesto que declaraste, no una cifra medida.`].filter(Boolean).join("\n");
    }
    // carga
    const mov = _find(figs, /^Supuesto · movimiento de carga$/i);
    const bench = _find(figs, /^Benchmark de margen$/i);
    const liberado = _find(figs, /^Liberado · total$/i);
    const sup = _all(figs, /· Margen supuesto$/i).map((f) => ({ entidad: _entidadDe(_lab(f)), pct: _pctDe(f), fmt: _val(f) })).filter((x) => x.entidad && Number.isFinite(x.pct));
    if (!mov || !bench || !sup.length) return null;
    const vara = _pctDe(bench);
    if (!Number.isFinite(vara)) return null;
    const sobre = sup.filter((x) => x.pct >= vara).sort((a, b) => b.pct - a.pct);
    const partes = [`Con la carga comercial ${c.delta}pp (tu supuesto: ${_val(mov)} de movimiento), el benchmark de margen sigue en ${_val(bench)}.`];
    /* ⚠️ SE DICE TAMBIÉN QUIÉNES QUEDAN POR DEBAJO, y no es cosmética: es la respuesta completa a «¿alguno queda
     * sobre?». Medido: el chequeo de estados del muro toma el PRIMER «· Margen» del ledger (Falabella, que
     * queda bajo) y, si una oración con «benchmark» dice «sobre» sin nombrar la brecha o el «por debajo», veta
     * — heurística global, no por entidad. Nombrar a los dos lados es lo honesto y lo que el muro reconoce. */
    if (!sobre.length) partes.push(`Ningún cliente queda sobre el benchmark con ese supuesto: los ${sup.length} siguen por debajo.`);
    else {
      partes.push(`Quedan sobre el benchmark ${sobre.length} de ${sup.length}:`);
      for (const x of sobre.slice(0, 6)) partes.push(`- ${x.entidad}: margen supuesto ${x.fmt}`);
      const bajo = sup.filter((x) => x.pct < vara);
      if (bajo.length) partes.push(`Los otros ${bajo.length} quedan por debajo del benchmark aun con ese supuesto${bajo.length <= 4 ? ` (${bajo.map((x) => x.entidad).join(", ")})` : ""}.`);
    }
    if (liberado) partes.push(`Se libera ${_val(liberado)} en total. Es una simulación sobre tu supuesto, no una cifra medida.`);
    return partes.join("\n");
  },

  /* ── LA LISTA NOTARIAL ─────────────────────────────────────────────────────────────────────────────────── */
  listaNotarial(texto, { figs, pregunta } = {}) {
    const v = [];
    const c = _caso(pregunta);
    if (!c) return v;
    const t = String(texto || "");
    // (1) lo proyectado se NOMBRA como proyección/supuesto/simulación: jamás con el tono de una cifra medida
    if (!/proyecci[oó]n|supuesto|simulaci[oó]n|proyectad[oa]|simulad[oa]/i.test(t)) {
      v.push({ regla: "proyeccion-sin-etiqueta", multa: "el resultado es una proyección sobre un supuesto del usuario: dilo con esa palabra («proyección», «supuesto», «simulación»), jamás como si ya hubiera pasado." });
    }
    // (2) en la forma carga, «queda sobre el benchmark» tiene que ser verdad contra las cifras del motor
    if (c.forma === "carga") {
      const bench = _find(figs, /^Benchmark de margen$/i); const vara = bench ? _pctDe(bench) : NaN;
      const sup = _all(figs, /· Margen supuesto$/i).map((f) => ({ entidad: _entidadDe(_lab(f)), pct: _pctDe(f) })).filter((x) => x.entidad && Number.isFinite(x.pct));
      if (Number.isFinite(vara) && /sobre el benchmark/i.test(t) && !/ning[uú]n/i.test(t)) {
        const nombrados = sup.filter((x) => t.includes(x.entidad));
        const falsos = nombrados.filter((x) => x.pct < vara);
        if (falsos.length) v.push({ regla: "sobre-benchmark-falso", multa: `${falsos.map((x) => x.entidad).join(", ")} NO queda sobre el benchmark con ese supuesto (margen supuesto bajo ${_val(bench)}): solo los que el motor deja arriba de la vara.` });
      }
    }
    return v;
  },
};
