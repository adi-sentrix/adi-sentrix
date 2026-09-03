/* === src/adi/agente/playbooks/askDeCuadro.js · EL ASK DE CUADRO, ANCLADO (pulido del anclaje, 2026-09-05) ====
 *
 * LA ESPECIFICACIÓN DEL OWNER, textual: «Cada botón debe responder sobre el cuadro exacto que el usuario está
 * mirando, no sobre el negocio general ni sobre otro eje.»
 *
 * LAS FORMAS (los ask que la cara Capital y el cobro de Flujo generan, contrato congelado — el emisor no se
 * toca, el receptor aprende):
 *   A · «¿Cuánto capital tengo en <bodega|familia|tramo>?»   → la fila de ESE corte
 *   B · «Profundiza en <SKU>»                                 → la fila de ESE SKU, lado inventario
 *   C · «¿Cómo libero el capital de <SKU>?» · «…inmovilizado en <bodega>?» · «¿Qué SKU libero primero?»
 *   D · «¿Cómo viene el cobro de <cliente>?»                  → la fila de ESE cliente en el cobro
 *
 * EL ANCLAJE ES POR MÓDULO Y CAMPO (regla 1 del contrato de la siembra): las cifras salen de la MISMA fuente
 * que pinta el cuadro — capital por bodega/familia agrupa `skuInventario.stockUSD` por el MISMO campo que
 * `mesaCapital` (verificado cifra por cifra: Santiago $64K, Electrodomésticos $39K = el cuadro). El corte por
 * EDAD («0–30 días»…) NO tiene lectura del motor —sus tramos son un derivado de mesaCapital, no un campo del
 * dato— así que SE DECLARA (regla 2): servir «el corte más parecido» sería responder otro cuadro.
 *
 * LA FRONTERA DE UNIVERSOS, que acá es ley: la respuesta de un cuadro de CAPITAL no cita venta comercial ni
 * margen. El margen, además, existe DOS veces con el mismo rótulo (el drill del cuadro pinta el margen de
 * inventario; skusMargen trae el comercial — SAM-REF500L: 22% vs 11.1%, medido) y citar cualquiera de los dos
 * acá sería pegar universos con una palabra. No se cita margen. Punto.
 *
 * SIN ADIVINACIÓN: las formas nombran su corte en la propia frase. Si el nombre no está en el índice, o está
 * en DOS ejes y no hay `viewContext` que desambigüe, se declara — no se elige por parecido. El viewContext
 * DESCRIBE la superficie (jamás trae cifras) y solo se usa para desambiguar; si contradice el nombre de la
 * pregunta, manda la pregunta, que es el texto del botón congelado.
 *
 * PURO · determinístico · sin red. Cifras VERBATIM de la boleta: selecciona y ordena, jamás calcula. */

import { entidadNombrada } from "./indiceEntidades.js";
import { variante } from "../variacion.js";

const _val = (f) => String((f && (f.text || f.value)) || "");
const _lab = (f) => String((f && f.label) || "");
const _num = (f) => (f && Number.isFinite(f.raw) ? f.raw : NaN);
const _find = (figs, re) => (Array.isArray(figs) ? figs : []).find((f) => re.test(_lab(f))) || null;
const _all = (figs, re) => (Array.isArray(figs) ? figs : []).filter((f) => re.test(_lab(f)));
const _esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const _FIN = "(?![a-záéíóúüñ])";

/* los tramos de EDAD del cuadro, para reconocer la forma y declararla — el rótulo exacto que pinta la vista */
const _TRAMO = /\b(?:0\s*[–-]\s*30|31\s*[–-]\s*60|61\s*[–-]\s*90)\s*d[ií]as\b|\bm[aá]s de 90 d[ií]as\b/i;

const _F_CAPITAL_EN = new RegExp(`\\bcu[aá]nto capital tengo en\\b`, "i");
const _F_PROFUNDIZA = new RegExp(`\\bprofundiza en\\b`, "i");
const _F_LIBERO = new RegExp(`\\bc[oó]mo libero el capital\\b`, "i");
const _F_LIBERO_PRIMERO = new RegExp(`\\bqu[eé] sku libero primero${_FIN}`, "i");
const _F_COBRO_DE = new RegExp(`\\bc[oó]mo viene el cobro de\\b`, "i");

/** el caso del turno: { forma, eje, nombre } — o null si esta pregunta no es un ask de cuadro. */
function _caso(pregunta, ctx) {
  const q = String(pregunta || "");
  if (!q.trim()) return null;
  const vc = ctx && ctx.viewContext && typeof ctx.viewContext === "object" ? ctx.viewContext : null;
  if (_F_LIBERO_PRIMERO.test(q)) return { forma: "libero", eje: "sku", nombre: null };   // sin nombre: el ranking frenado decide
  const ent = entidadNombrada(q);
  if (_F_CAPITAL_EN.test(q)) {
    if (_TRAMO.test(q)) return { forma: "capital_en", eje: "edad", nombre: (q.match(_TRAMO) || [""])[0] };
    if (!ent) return null;                                       // nombre fuera del índice: no se adivina
    if (ent.eje === "bodega" || ent.eje === "familia") return { forma: "capital_en", eje: ent.eje, nombre: ent.nombre };
    /* nombre de OTRO eje (un cliente, un SKU): ese corte no es del cuadro de capital — que lo tome su dueño */
    return null;
  }
  if (_F_PROFUNDIZA.test(q)) {
    if (!ent || ent.eje !== "sku") return null;
    return { forma: "profundiza", eje: "sku", nombre: ent.nombre };
  }
  if (_F_LIBERO.test(q)) {
    if (ent && ent.eje === "sku") return { forma: "libero", eje: "sku", nombre: ent.nombre };
    if (ent && ent.eje === "bodega") return { forma: "libero", eje: "bodega", nombre: ent.nombre };
    /* sin nombre y sin «primero»: la asesoría general del inmovilizado tiene su playbook — no es de acá */
    return null;
  }
  if (_F_COBRO_DE.test(q)) {
    if (!ent || ent.eje !== "cliente") return null;
    return { forma: "cobro", eje: "cliente", nombre: ent.nombre };
  }
  /* el viewContext NO abre formas por sí solo: describe la superficie; el turno lo abre la pregunta */
  void vc;
  return null;
}

export const askDeCuadro = {
  nombre: "ask-de-cuadro",

  cuandoAplica(pregunta, ctx) { return _caso(pregunta, ctx) !== null; },

  pasos(pregunta, ctx) {
    const c = _caso(pregunta, ctx);
    if (!c) return [];
    if (c.forma === "capital_en" && (c.eje === "bodega" || c.eje === "familia")) {
      return [{ tool: "queryMetric", args: { metric: "capital", dimension: c.eje },
        para: `el capital en inventario por ${c.eje} — la MISMA agrupación que pinta el cuadro de Capital, para citar la fila de ${c.nombre} con su cifra` }];
    }
    if (c.forma === "capital_en" && c.eje === "edad") {
      /* el corte por edad NO existe en el motor y se DECLARA — pero el turno igual trae el corte que sí
       * existe, para que la alternativa ofrecida lleve cifra y no promesa (y porque un playbook sin pasos se
       * retira del bucle: la lección medida del declive de entidad×período, esta vez en pasos). */
      return [{ tool: "queryMetric", args: { metric: "capital", dimension: "bodega" },
        para: "el corte por bodega — la alternativa CON cifra que se ofrece al declinar el corte por edad, que el motor no publica" }];
    }
    if (c.forma === "profundiza") {
      return [{ tool: "entityProfile", args: { entity: c.nombre },
        para: `la fila de ${c.nombre}: su capital en inventario, su rotación y sus días de inventario — el lado que el cuadro de Capital muestra` }];
    }
    if (c.forma === "libero") {
      return [{ tool: "inventoryStatus", args: { focus: "frenado" },
        para: `el corte frenado del cuadro: qué SKU (y qué bodega) tienen capital sin rotar, con su monto, sus días de inventario y su rotación` }];
    }
    if (c.forma === "cobro") {
      return [{ tool: "cobranza", args: {},
        para: `el cobro por cliente: la venta del período (flujo), lo abonado, el saldo pendiente y el vencido — para citar la fila de ${c.nombre}` }];
    }
    return [];
  },

  obligatorias(pregunta, ctx) {
    const c = _caso(pregunta, ctx);
    if (!c) return [];
    if (c.forma === "capital_en" && (c.eje === "bodega" || c.eje === "familia")) return [new RegExp(`^${_esc(c.nombre)} · Capital$`, "i")];
    if (c.forma === "capital_en" && c.eje === "edad") return [/· Capital$/i];   // la promesa es la ALTERNATIVA con cifra
    if (c.forma === "profundiza") return [new RegExp(`^${_esc(c.nombre)} · Capital$`, "i")];
    if (c.forma === "libero") return [/^Capital frenado · total$/i];
    /* la promesa del cobro es el TOTAL vencido (siempre publicado): si la fila del cliente no vino, el
     * composer declina nombrando a los publicados en vez de retirarse a un rescate mudo. */
    if (c.forma === "cobro") return [/^Saldo vencido · total$/i];
    return [];
  },

  entregable: "la respuesta del cuadro que el usuario está mirando: SU fila, con la cifra del mismo módulo que la pinta — el corte por bodega o familia, la fila de inventario del SKU, el frenado a liberar, o el cobro de esa cuenta. Si el corte no existe como lectura del motor (los tramos de edad), se declara. Jamás el total del negocio ni otro eje en su lugar.",

  componer({ figs, pregunta, semilla, ctx } = {}) {
    const c = _caso(pregunta, ctx);
    if (!c) return null;
    const p = [];

    if (c.forma === "capital_en" && c.eje === "edad") {
      /* el corte que el cuadro pinta y el motor no publica: la regla 2 — declarar, no aproximar. La
       * alternativa va CON cifra (el corte por bodega vino en los pasos). */
      const todas = _all(figs, /· Capital$/i).map((f) => ({ nombre: _lab(f).split("·")[0].trim(), raw: _num(f), fmt: _val(f) }))
        .filter((x) => Number.isFinite(x.raw)).sort((a, b) => b.raw - a.raw);
      p.push(`El corte «${c.nombre}» lo arma el cuadro de Capital tramando los días sin venta, y ese tramado no está publicado como lectura del motor: no tengo una cifra verificada para dictarte por ese corte.`);
      if (todas.length) p.push(`Lo que sí tengo con cifra verificada es el corte por bodega: ${todas.map((x) => `${x.nombre} ${x.fmt}`).join(" · ")}. También puedo abrirte una familia o un SKU puntual.`);
      return p.join("\n");
    }

    if (c.forma === "capital_en") {
      const mia = _find(figs, new RegExp(`^${_esc(c.nombre)} · Capital$`, "i"));
      if (!mia) return null;
      const todas = _all(figs, /· Capital$/i).map((f) => ({ nombre: _lab(f).split("·")[0].trim(), raw: _num(f), fmt: _val(f) }))
        .filter((x) => Number.isFinite(x.raw)).sort((a, b) => b.raw - a.raw);
      const lugar = todas.findIndex((x) => x.nombre.toLowerCase() === c.nombre.toLowerCase());
      p.push(`En ${c.nombre} tienes ${_val(mia)} de capital en inventario${lugar >= 0 && todas.length > 1 ? ` — la ${lugar + 1}ª ${c.eje} de ${todas.length} por capital` : ""}.`);
      if (todas.length > 1) p.push(`El corte completo, de mayor a menor: ${todas.map((x) => `${x.nombre} ${x.fmt}`).join(" · ")}.`);
      p.push(variante(semilla, [
        `\nSi quieres, te abro qué parte de ese capital está frenada y en qué SKU.`,
        `\n¿Te abro lo frenado de ${c.nombre}, SKU por SKU?`,
        `\nPuedo abrirte el estado de ese capital (qué rota y qué está frenado) cuando digas.`,
      ]));
      return p.join("\n");
    }

    if (c.forma === "profundiza") {
      const cap = _find(figs, new RegExp(`^${_esc(c.nombre)} · Capital$`, "i"));
      if (!cap) return null;
      const rot = _find(figs, new RegExp(`^${_esc(c.nombre)} · Rotaci[oó]n$`, "i"));
      const doh = _find(figs, new RegExp(`^${_esc(c.nombre)} · Cobertura \\(DOH\\)$`, "i"));
      const partes = [`${_val(cap)} de capital en inventario`];
      if (rot) partes.push(`rotación ${_val(rot)}`);
      if (doh) partes.push(`${_val(doh)} de días de inventario`);
      p.push(`${c.nombre}, en el cuadro de Capital: ${partes.join(" · ")}.`);
      /* la frontera: el lado comercial de ese SKU existe pero NO se cita acá — es otro universo y otra vista */
      p.push(`Su lado comercial vive en su ficha — este cuadro mira el inventario.`);
      p.push(variante(semilla, [
        `¿Te abro la ficha completa de ${c.nombre}?`,
        `Si quieres, te abro su ficha completa.`,
        `Dime y te abro la ficha entera de ${c.nombre}.`,
      ]));
      return p.join("\n");
    }

    if (c.forma === "libero") {
      const total = _find(figs, /^Capital frenado · total$/i);
      if (!total) return null;
      /* los SKU del corte frenado: los que traen además rotación/días (la pertenencia medida en lecturaPorEje) */
      const esSku = new Set(_all(figs, /· (?:Rotaci[oó]n|D[ií]as de inventario)$/i).map((f) => _lab(f).split("·")[0].trim()));
      const frenados = _all(figs, /· Capital frenado$/i)
        .map((f) => ({ nombre: _lab(f).split("·")[0].trim(), raw: _num(f), fmt: _val(f) }))
        .filter((x) => esSku.has(x.nombre) && Number.isFinite(x.raw)).sort((a, b) => b.raw - a.raw);
      const deBodega = c.eje === "bodega" ? _find(figs, new RegExp(`^${_esc(c.nombre)} · Capital frenado$`, "i")) : null;

      if (c.nombre && c.eje === "sku") {
        const mio = frenados.find((x) => x.nombre.toLowerCase() === c.nombre.toLowerCase());
        if (!mio) {
          /* la forma NEGADA CANÓNICA («no está frenado»), y EN SU PROPIA ORACIÓN — el juez del estado lee la
           * negación solo pegada a la palabra Y evalúa oración por oración: si el no-frenado y la lista de
           * frenados comparten oración, la segunda mención (no negada) vuelve a atribuir. Medido dos veces. */
          p.push(`${c.nombre} no está frenado en el corte de este turno.`);
          p.push(`Los SKU frenados declarados son ${frenados.length ? frenados.map((x) => x.nombre).join(" · ") : "ninguno"}, y el capital frenado suma ${_val(total)}.`);
          p.push(`Si lo que buscas es la fila de ${c.nombre} en el inventario, te la abro.`);
          return p.join("\n");
        }
        const rot = _find(figs, new RegExp(`^${_esc(c.nombre)} · Rotaci[oó]n$`, "i"));
        const doh = _find(figs, new RegExp(`^${_esc(c.nombre)} · D[ií]as de inventario$`, "i"));
        p.push(`${c.nombre} tiene ${mio.fmt} frenados${doh ? ` — ${_val(doh)} de días de inventario` : ""}${rot ? `, rotación ${_val(rot)}` : ""}.`);
        p.push(`Por qué se frenó no está en este dato: el cuadro localiza el capital, no la causa.`);
        p.push(variante(semilla, [
          `Para moverlo, lo que se puede evaluar con este dato: revisar su precio o su exhibición, o simular qué libera bajarle el stock. ¿Te abro la simulación?`,
          `Con este dato se puede simular cuánto capital libera bajarle el stock, o revisar su precio. Dime por cuál seguimos.`,
          `Lo evaluable acá: precio, exhibición, o simular la baja de stock. ¿Abrimos alguna?`,
        ]));
        return p.join("\n");
      }
      if (c.nombre && c.eje === "bodega") {
        if (!deBodega) {
          p.push(`${c.nombre} no aparece en el corte frenado del cuadro.`);
          p.push(`El capital frenado del negocio suma ${_val(total)}.`);
          return p.join("\n");
        }
        const mios = frenados.length ? ` Los SKU frenados del negocio, de mayor a menor: ${frenados.map((x) => `${x.nombre} ${x.fmt}`).join(" · ")}.` : "";
        p.push(`En ${c.nombre} hay ${_val(deBodega)} de capital frenado.${mios}`);
        p.push(`Por qué se frenó no está en este dato: el cuadro localiza el capital, no la causa.`);
        return p.join("\n");
      }
      /* sin nombre: «¿Qué SKU libero primero?» — el primero del corte, con el criterio dicho */
      if (!frenados.length) return null;
      p.push(`El capital frenado suma ${_val(total)}. De mayor a menor: ${frenados.map((x) => `${x.nombre} ${x.fmt}`).join(" · ")}.`);
      p.push(`Si el criterio es capital frenado —criterio mío, el del cuadro—, el primero es ${frenados[0].nombre}: es donde más capital hay sin rotar.`);
      p.push(`Por qué se frenó cada uno no está en este dato.`);
      return p.join("\n");
    }

    if (c.forma === "cobro") {
      const venc = _find(figs, new RegExp(`^${_esc(c.nombre)} · Saldo vencido$`, "i"));
      if (!venc) {
        /* la fila de ese cliente no vino en la mesa del cobro: se declina nombrando lo publicado */
        const conFila = [...new Set(_all(figs, /· Saldo vencido$/i).map((f) => _lab(f).split("·")[0].trim()))];
        const total = _find(figs, /^Saldo vencido · total$/i);
        p.push(`La mesa del cobro de este turno no publica la fila de ${c.nombre}.`);
        if (conFila.length) p.push(`Los clientes con fila publicada son ${conFila.join(" · ")}${total ? `, y el vencido total del negocio es ${_val(total)}` : ""}. Si quieres, seguimos por alguno de ellos.`);
        return p.join("\n");
      }
      const venta = _find(figs, new RegExp(`^${_esc(c.nombre)} · Venta \\(flujo\\)$`, "i"));
      const abon = _find(figs, new RegExp(`^${_esc(c.nombre)} · Abonado$`, "i"));
      const pend = _find(figs, new RegExp(`^${_esc(c.nombre)} · Saldo pendiente$`, "i"));
      const partes = [];
      if (venta) partes.push(`venta del período (flujo) ${_val(venta)}`);
      if (abon) partes.push(`abonado ${_val(abon)}`);
      if (pend) partes.push(`saldo pendiente ${_val(pend)}`);
      partes.push(`vencido ${_val(venc)}`);
      p.push(`El cobro de ${c.nombre}: ${partes.join(" · ")}.`);
      p.push(variante(semilla, [
        `¿Quieres que lo ponga contra el resto de la cartera de cobro?`,
        `Te lo comparo contra el resto de la cartera de cobro si quieres.`,
        `Si te sirve, lo abrimos contra la cartera de cobro completa.`,
      ]));
      return p.join("\n");
    }
    return null;
  },

  listaNotarial(texto, { figs, pregunta, ctx } = {}) {
    const t = String(texto || "");
    if (!t.trim()) return [];
    const v = [];
    const c = _caso(pregunta, ctx);
    /* (1) EL ANCLAJE NO SE SUELTA: si el turno es de UN corte y el texto sirve el TOTAL del negocio como si
     * fuera la respuesta (sin la fila pedida), responde otro cuadro. */
    if (c && c.forma === "capital_en" && c.eje !== "edad" && c.nombre) {
      const nombraSuFila = new RegExp(`\\b${_esc(c.nombre)}\\b`, "i").test(t);
      if (!nombraSuFila) v.push({ regla: "cuadro-desanclado", multa: `la pregunta es por ${c.nombre} y la respuesta no nombra esa fila: responde el corte pedido, no otro.` });
    }
    /* (2) LA FRONTERA DE UNIVERSOS: en un turno del cuadro de capital no se citan venta comercial ni margen —
     * el margen además existe dos veces con el mismo rótulo (inventario vs comercial). */
    if (c && c.forma !== "cobro" && new RegExp(`\\bm[aá]rgen(?:es)?${_FIN}|\\bventa[s]? del per[ií]odo${_FIN}|\\bcontribuci[oó]n${_FIN}`, "i").test(t.replace(/venta del per[ií]odo \(flujo\)/gi, ""))) {
      v.push({ regla: "universo-cruzado", multa: "estás citando venta comercial o margen en la respuesta de un cuadro de capital: ese es el otro universo y esta respuesta no lo carga." });
    }
    /* (3) LA CAUSA, la regla de siempre: liberar/frenar no tiene porqué en este dato */
    if (c && c.forma === "libero") {
      for (const o of t.split(/[.!?\n]+/)) {
        if (new RegExp(`\\bporque${_FIN}|\\bse debe a${_FIN}|\\bla causa (?:es|est[aá])${_FIN}`, "i").test(o)) {
          v.push({ regla: "causa-sin-respaldo", multa: "afirmas por qué está frenado y este dato no trae la causa: localiza y ofrece, no expliques lo no medido." });
          break;
        }
      }
    }
    return v;
  },
};
