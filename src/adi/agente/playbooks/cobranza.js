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

import { esPorQue } from "../porque.js";   // la ley del porqué es de la casa (owner 2026-09-09)
import { axisEntityNames } from "../../oracle/entityIndex.js";   // el tamaño del eje, para el universo de un orden («los 13 clientes») sin escribirlo a mano
import { declaradorDe } from "../../notario/declarar.js";   // el Notario semántico (fase 2): el composer declara MIENTRAS escribe, sin tocar el texto

const _FIN = "(?![a-záéíóúüñ])";
const _lab = (f) => String((f && f.label) || "");
const _val = (f) => String((f && (f.text || f.value)) || "");
const _find = (figs, re) => (Array.isArray(figs) ? figs : []).find((f) => re.test(_lab(f))) || null;
const _all = (figs, re) => (Array.isArray(figs) ? figs : []).filter((f) => re.test(_lab(f)));
const _entidadDe = (label) => { const p = String(label || "").split("·").map((s) => s.trim()); return p.length >= 2 ? p[0] : null; };
/* el universo de un orden, con el tamaño del eje del tenant («los 13 clientes»); sin índice, el eje entero por su nombre («los clientes»),
 * que el verificador también lee como el conjunto completo */
const _universoClientes = () => { let n = 0; try { n = (axisEntityNames("cliente") || []).length; } catch { n = 0; } return n ? `los ${n} clientes` : "los clientes"; };

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
  multidominio: true,   // compone su parte aunque la pregunta haga participar a dos dominios (contrato de dominios, owner 2026-09-14)
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
  componer({ figs, pregunta, declarar } = {}) {
    const c = _caso(pregunta);
    if (!c) return null;
    const venta = _find(figs, /^Venta (?:a crédito del período|del período \(flujo\))$/i);
    const abonado = _find(figs, /^Abonado · total$/i);
    const saldo = _find(figs, /^Saldo pendiente · total$/i);
    if (!saldo || !venta) return null;
    const vencidoTotal = _find(figs, /^Saldo vencido · total$/i);
    const esCredito = /a crédito/i.test(_lab(venta));
    /* EL NOTARIO SEMÁNTICO (fase 2): los totales son cifras del negocio (universo «total»); lo abonado y el saldo son PARTE de la venta
     * («de eso ya entró…», «de una venta de…») y el vencido es parte del saldo; la venta viaja con el rótulo exacto del emisor (en la
     * planilla dice «a crédito», en el demo «del período (flujo)»); cada saldo con su dueño; «el más pesado» es un orden máximo de
     * Saldo vencido sobre el eje entero. */
    const D = declaradorDe(declarar);
    const declaraTotales = (texto) => {
      D.deFig(venta, texto);
      if (abonado) { D.cifra({ sujeto: "negocio", metrica: "Abonado", valor: _val(abonado), universo: "total", texto }); D.relacion({ sujeto: "negocio", metrica: "Abonado", forma: "parte", vs: { sujeto: "negocio", metrica: _lab(venta) }, texto }); }
      D.cifra({ sujeto: "negocio", metrica: "Saldo pendiente", valor: _val(saldo), universo: "total", texto });
      D.relacion({ sujeto: "negocio", metrica: "Saldo pendiente", forma: "parte", vs: { sujeto: "negocio", metrica: _lab(venta) }, texto });
    };

    if (c.forma === "credito") {
      const l0 = `Vendiste ${esCredito ? "a crédito " : ""}${_val(venta)} en el período. De eso ya entró ${_val(abonado)} (abonado) y queda un saldo pendiente de ${_val(saldo)}.`;
      declaraTotales(l0);
      return [
        l0,
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
    declaraTotales(partes[0]);
    /* EL UNIVERSO DE LA LISTA, EXPLÍCITO (owner 2026-09-15): la mesa del cobro ordena «vencido primero» — la lista de arriba son las cuentas
     * CON saldo vencido, de mayor a menor vencido; las que deben sin vencido van aparte con su saldo (Jumbo queda fuera del ranking de
     * vencido y dentro de la deuda). Sin vencido calculado, la lista es por saldo pendiente. */
    const vencidoDe = new Map(vencidos.map((x) => [x.entidad, x.fmt]));
    const conVencido = porCliente.filter((x) => vencidoDe.has(x.entidad));
    const sinVencido = porCliente.filter((x) => !vencidoDe.has(x.entidad));
    if (vencidoTotal && conVencido.length) {
      const cab = `Quién te debe con saldo vencido, de mayor a menor vencido:`;
      partes.push(cab);
      const listados = conVencido.slice(0, 6);
      D.orden({ sujeto: listados.map((x) => x.entidad), metrica: "Saldo vencido", forma: "topk", k: listados.length, direccion: "mayor", universo: "los clientes con saldo vencido", texto: cab });
      for (const x of listados) { const l = `- ${x.entidad}: ${x.fmt} pendiente · ${vencidoDe.get(x.entidad)} vencido`; partes.push(l); D.cifra({ sujeto: x.entidad, metrica: "Saldo pendiente", valor: x.fmt, texto: l }); D.cifra({ sujeto: x.entidad, metrica: "Saldo vencido", valor: vencidoDe.get(x.entidad), texto: l }); }
      if (sinVencido.length) {
        const l = `Con saldo pendiente y sin vencido: ${sinVencido.slice(0, 4).map((x) => `${x.entidad} ${x.fmt}`).join(" · ")}.`;
        partes.push(l);
        for (const x of sinVencido.slice(0, 4)) { D.cifra({ sujeto: x.entidad, metrica: "Saldo pendiente", valor: x.fmt, texto: l }); D.estado({ sujeto: x.entidad, estado: "sin vencido", texto: l }); }
      }
    } else {
      const cab = `Quién te debe, de mayor a menor saldo:`;
      partes.push(cab);
      D.orden({ sujeto: porCliente.slice(0, 6).map((x) => x.entidad), metrica: "Saldo pendiente", forma: "topk", k: Math.min(6, porCliente.length), direccion: "mayor", universo: _universoClientes(), texto: cab });
      for (const x of porCliente.slice(0, 6)) { const l = `- ${x.entidad}: ${x.fmt}`; partes.push(l); D.cifra({ sujeto: x.entidad, metrica: "Saldo pendiente", valor: x.fmt, texto: l }); }
    }
    /* la cola «(y N más)» no se declara: N es lo que la boleta trae y no cabe en la lista (el emisor publica 8 filas), no cuántos deben —
     * la mesa del flujo tiene más deudores que la boleta; se anota como hallazgo, no se declara como conteo */
    /* …y por eso la cola NO trae número (Notario semántico, fase 2, 2026-09-15): «(y 2 más)» contaba filas de la boleta, no deudores — era falso */
    if (porCliente.length >= 8) partes.push(`(y otras cuentas más)`);   // la mesa publica hasta 8 filas: con 8, hay más deudores que los listados
    if (vencidoTotal) {
      const l = `De eso, ${_val(vencidoTotal)} ya está vencido${vencidos.length ? ` — el más pesado es ${vencidos[0].entidad} con ${vencidos[0].fmt}` : ""}.`;
      partes.push(l);
      D.cifra({ sujeto: "negocio", metrica: "Saldo vencido", valor: _val(vencidoTotal), universo: "total", texto: l });
      D.relacion({ sujeto: "negocio", metrica: "Saldo vencido", forma: "parte", vs: { sujeto: "negocio", metrica: "Saldo pendiente" }, texto: l });
      if (vencidos.length) {
        D.orden({ sujeto: vencidos[0].entidad, metrica: "Saldo vencido", forma: "max", universo: _universoClientes(), texto: l });
        D.cifra({ sujeto: vencidos[0].entidad, metrica: "Saldo vencido", valor: vencidos[0].fmt, texto: l });
      }
    } else {
      /* la regla del owner, con palabras: sin plazo no hay vencido que mostrar — y se dice por qué */
      partes.push(`Qué parte está vencida no se puede saber: tu empresa no declaró plazo de pago. Cuando lo declares, el vencido se calcula solo — sin volver a subir el archivo.`);
    }
    /* LA LEY DEL PORQUÉ (owner 2026-09-09): «¿por qué me deben tanto?» es una causa, y el flujo NO la mide —no
     * hay conducta de pago en el dato: ni retraso medio, ni antigüedad por tramos—. Se dice el límite y se le
     * pregunta a él, que es quien sabe si cambió un plazo, si hubo una negociación o si alguien dejó de pagar. */
    if (esPorQue(pregunta)) {
      partes.push(`\nPor qué te deben eso no está en este dato: el flujo localiza cuánto y de quién, no explica la conducta de pago.`);
      partes.push(`¿Cambiaste el plazo con alguien, hubo una negociación grande, o hay un cliente que dejó de pagar como antes?`);
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
    /* (2) la deuda con nombre: si la boleta trae clientes con saldo y la respuesta no nombra a ninguno. EXCEPCIÓN
     * (owner 2026-09-25, ley del piso sin modelo, obligatorio C): cuando la PREGUNTA nombra una cuenta puntual
     * («cómo está SU deuda» de La Polar) no es «quién me debe» de toda la cartera — es una respuesta SOBRE ESA
     * cuenta, y exigirle que enumere a las demás la empujaría de vuelta a la cartera entera (justo lo que la ley
     * prohíbe: una cuenta nombrada recibe SU cifra, no la de la cartera disfrazada de respuesta completa).
     * Nombrar a la cuenta pedida basta; no hace falta nombrar a las otras. */
    const _normCob = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    const _pregNombraCliente = (() => {
      try { const qn = _normCob(pregunta); return (axisEntityNames("cliente") || []).find((e) => e && String(e).length >= 3 && qn.includes(_normCob(e))) || null; } catch { return null; }
    })();
    const clientes = _all(figs, /· Saldo pendiente$/i).map((f) => _entidadDe(_lab(f))).filter(Boolean);
    if (_caso(pregunta).forma === "deuda" && clientes.length >= 2 && !clientes.some((n) => t.includes(n))
      && !(_pregNombraCliente && t.includes(_pregNombraCliente))) {
      v.push({ regla: "deuda-sin-nombre", multa: `la boleta trae ${clientes.length} clientes con saldo pendiente y la respuesta no nombra a ninguno: la pregunta es QUIÉN debe — cada saldo con su cliente.` });
    }
    /* (3) crédito vs contado no se deriva: un monto de «contado» que la mesa no declaró es una resta propia */
    if (/contado[^.\n]*\$\s?[\d.,]|(?:\$\s?[\d.,]+[KMB]?)[^.\n]*\bal contado/i.test(t)) {
      v.push({ regla: "contado-derivado", multa: "el dato no declara un monto de ventas al contado: derivarlo restando cruza dos fuentes. Di la venta a crédito declarada y que el contado no genera deuda." });
    }
    return v;
  },
};
