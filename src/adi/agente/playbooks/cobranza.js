/* === src/adi/agente/playbooks/cobranza.js · PLAYBOOK 5 · EL COBRO (owner 2026-09-01) ========================
 *
 * LAS DOS PREGUNTAS QUE GARANTIZA, del protocolo de certificación:
 *   «quién me debe y qué está vencido»       — incontestable hasta hoy: ninguna herramienta leía el flujo
 *   «cuánto vendí a crédito vs contado»      — la columna condición existía y nadie la servía
 *
 * EL MÉTODO: un paso, `cobranza{}` — la MISMA mesa que la pestaña Flujo Comercial. En la PARCIAL (sin hoja
 * Abonos) la herramienta declina, `promesasCumplidas` falla y el playbook se retira sin ruido: el turno sigue
 * por el camino de siempre y el mapa nombra la hoja que falta. Eso ya estaba y no cambia.
 *
 * ⚠️ LA REGLA DEL VENCIDO ES DEL OWNER Y ES TEXTUAL: «Mantén el vencido en raya mientras no exista plazo
 * declarado. No mostrar cero». Su planilla ES ese caso. El composer lo dice con palabras y la lista notarial
 * VETA al que escriba el vencido como cifra cuando la mesa dijo «—».
 *
 * ⚠️ «CRÉDITO VS CONTADO» NO RESTA: la cifra declarada es la venta a crédito; el contado no genera deuda y no
 * está como monto. Se responde el crédito con su alcance — que ya dice que el contado no entra.
 *
 * PURO · determinístico · sin red. Cifras VERBATIM de la boleta. */

const _FIN = "(?![a-záéíóúüñ])";
const _lab = (f) => String((f && f.label) || "");
const _val = (f) => String((f && (f.text || f.value)) || "");
const _find = (figs, re) => (Array.isArray(figs) ? figs : []).find((f) => re.test(_lab(f))) || null;
const _all = (figs, re) => (Array.isArray(figs) ? figs : []).filter((f) => re.test(_lab(f)));
const _entidadDe = (label) => { const p = String(label || "").split("·").map((s) => s.trim()); return p.length >= 2 ? p[0] : null; };

/* ── EL DETECTOR · léxico y conservador: ante la duda, false ────────────────────────────────────────────────
 * Dos sub-formas. La DEUDA: quién debe, qué está vencido, la mora, el saldo por cobrar. El CRÉDITO: cuánto se
 * vendió a crédito (con o sin «contado» al lado). Fuera: simulaciones, proyecciones y el capital de inventario
 * («capital frenado» no es deuda de nadie). */
const _DEUDA = new RegExp(`\\bqui[eé]n(?:es)? me debe|\\bme deben${_FIN}|\\bdeuda[s]?${_FIN}|\\bvencid[oa]s?${_FIN}|\\bmora${_FIN}|\\bcobranza${_FIN}|\\bpor cobrar${_FIN}|\\bsaldo[s]? pendiente|\\bcu[aá]nto (?:me )?(?:han |me han )?(?:pagado|abonado)${_FIN}`, "i");
const _CREDITO = new RegExp(`\\b(?:vend[ií]|venta[s]?|vendido) (?:a )?cr[eé]dito${_FIN}|\\ba cr[eé]dito vs\\.? contado${_FIN}|\\bcr[eé]dito (?:vs\\.?|versus|o|y) contado${_FIN}|\\bcontado (?:vs\\.?|versus|o|y) cr[eé]dito${_FIN}`, "i");
const _FUERA = new RegExp(`\\bsimul|\\bproyect|\\bpon[eé]le que${_FIN}|\\bqu[eé] pasa si${_FIN}|\\bfrenad|\\binmoviliz|\\binventario${_FIN}|\\bstock${_FIN}`, "i");

const _caso = (pregunta) => {
  const q = String(pregunta || "");
  if (!q.trim() || _FUERA.test(q)) return null;
  if (_DEUDA.test(q)) return { forma: "deuda" };
  if (_CREDITO.test(q)) return { forma: "credito" };
  return null;
};

export const cobranza = {
  nombre: "cobranza",
  ejemplos: ["quién me debe y qué está vencido", "cuánto vendí a crédito vs contado"],
  /* activa en la PLANTILLA (con hoja Abonos) — el demo también tiene flujo, pero la muestra canónica es la
   * forma de un cliente real, que es donde vive la regla del vencido en «—». */
  tenantDeMuestra: "plantilla",

  cuandoAplica(pregunta) { return _caso(pregunta) !== null; },

  pasos(pregunta) {
    return _caso(pregunta) ? [{ tool: "cobranza", args: {},
      para: "la venta a crédito, lo abonado y el saldo pendiente —total y por cliente— de la misma mesa que la pestaña Flujo Comercial, con la fecha de corte y si el vencido se puede calcular o no" }] : [];
  },
  obligatorias(pregunta) {
    return _caso(pregunta) ? [/^Saldo pendiente · total$/i] : [];
  },

  entregable: "para la deuda: el saldo pendiente total con su fecha de corte, quiénes deben (cada cliente con su saldo), y el vencido SOLO si la mesa lo calculó — sin plazo declarado se dice «no se puede saber qué parte está vencida» con el porqué, jamás $0. Para crédito vs contado: la venta a crédito declarada, cuánto entró (abonado) y el saldo, diciendo que las ventas de contado no generan deuda y no entran en este corte.",

  /* ── EL ENTREGABLE DETERMINÍSTICO ──────────────────────────────────────────────────────────────────────── */
  componer({ figs, pregunta } = {}) {
    const c = _caso(pregunta);
    if (!c) return null;
    const venta = _find(figs, /^Venta (?:a crédito del período|del período \(flujo\))$/i);
    const abonado = _find(figs, /^Abonado · total$/i);
    const saldo = _find(figs, /^Saldo pendiente · total$/i);
    if (!saldo || !venta) return null;
    const vencidoTotal = _find(figs, /^Saldo vencido · total$/i);
    const esCredito = /a crédito/i.test(_lab(venta));

    if (c.forma === "credito") {
      return [
        `Vendiste ${esCredito ? "a crédito " : ""}${_val(venta)} en el período. De eso ya entró ${_val(abonado)} (abonado) y queda un saldo pendiente de ${_val(saldo)}.`,
        `Las ventas de contado no generan deuda y no entran en este corte: la cifra declarada de tu archivo es la venta a crédito (columna condición).`,
      ].join("\n");
    }

    // deuda
    const porCliente = _all(figs, /· Saldo pendiente$/i)
      .map((f) => ({ entidad: _entidadDe(_lab(f)), fmt: _val(f) }))
      .filter((x) => x.entidad);
    if (!porCliente.length) return null;
    const vencidos = _all(figs, /· Saldo vencido$/i).map((f) => ({ entidad: _entidadDe(_lab(f)), fmt: _val(f) })).filter((x) => x.entidad);
    // LA VOZ (2026-09-03): un asesor cuenta la deuda, no la lista un ledger — mismas cifras, mismos dueños.
    const partes = [`Tienes ${_val(saldo)} por cobrar, de una venta ${esCredito ? "a crédito " : ""}de ${_val(venta)} — ya te abonaron ${_val(abonado)}.`];
    partes.push(`Quién te debe:`);
    for (const x of porCliente.slice(0, 6)) partes.push(`- ${x.entidad}: ${x.fmt}`);
    if (porCliente.length > 6) partes.push(`(y ${porCliente.length - 6} más)`);
    if (vencidoTotal) {
      partes.push(`De eso, ${_val(vencidoTotal)} ya está vencido${vencidos.length ? ` — el más pesado es ${vencidos[0].entidad} con ${vencidos[0].fmt}` : ""}.`);
    } else {
      /* la regla del owner, con palabras: sin plazo no hay vencido que mostrar — y se dice por qué */
      partes.push(`Qué parte está vencida no se puede saber: tu empresa no declaró plazo de pago. Cuando lo declares, el vencido se calcula solo — sin volver a subir el archivo.`);
    }
    return partes.join("\n");
  },

  /* ── LA LISTA NOTARIAL ─────────────────────────────────────────────────────────────────────────────────── */
  listaNotarial(texto, { figs, pregunta } = {}) {
    const v = [];
    if (!_caso(pregunta)) return v;
    const t = String(texto || "");
    const hayVencidoCalculado = !!_find(figs, /^Saldo vencido · total$/i);
    /* (1) LA REGLA DEL OWNER: sin plazo, el vencido no es una cifra — ni $0 ni ninguna otra */
    if (!hayVencidoCalculado && /vencid[oa]s?\b[^.\n]*(?:\$\s?[\d.,]|(?<![\d.,])0(?![\d.,])[^%])|(?:\$\s?0|\$0\b)[^.\n]*vencid/i.test(t)) {
      v.push({ regla: "vencido-inventado", multa: "sin plazo de pago declarado el vencido NO se puede calcular: va «—» con su porqué, jamás $0 ni otra cifra. Di que no se puede saber y por qué." });
    }
    /* (2) la deuda con nombre: si la boleta trae clientes con saldo y la respuesta no nombra a ninguno */
    const clientes = _all(figs, /· Saldo pendiente$/i).map((f) => _entidadDe(_lab(f))).filter(Boolean);
    if (_caso(pregunta).forma === "deuda" && clientes.length >= 2 && !clientes.some((n) => t.includes(n))) {
      v.push({ regla: "deuda-sin-nombre", multa: `la boleta trae ${clientes.length} clientes con saldo pendiente y la respuesta no nombra a ninguno: la pregunta es QUIÉN debe — cada saldo con su cliente.` });
    }
    /* (3) crédito vs contado no se deriva: un monto de «contado» que la mesa no declaró es una resta propia */
    if (/contado[^.\n]*\$\s?[\d.,]|(?:\$\s?[\d.,]+[KMB]?)[^.\n]*\bal contado/i.test(t)) {
      v.push({ regla: "contado-derivado", multa: "el dato no declara un monto de ventas al contado: derivarlo restando cruza dos fuentes. Di la venta a crédito declarada y que el contado no genera deuda." });
    }
    return v;
  },
};
