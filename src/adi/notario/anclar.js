/* anclar.js · LA CASA ANCLA LO SUYO (verdad finita, prosa infinita · etapa E4 · owner 2026-09-17) ═══════════════════════════════════════
 * «Todos los caminos que puedan terminar frente al usuario deben quedar bajo el mismo contrato de verdad.» Los peldaños de la escalera
 * (playbook, encargo compuesto, línea honesta, límite) escriben desde figs y ya DECLARAN tipado mientras escriben (`declarar.js`). Acá la casa
 * convierte eso en lo mismo que emite el cerebro —el libro de hechos con ids y la prosa anclada— sin tocar ningún composer: el tramo declarado
 * es el ancla, la declaración es el hecho, y las cifras verbatim de la boleta se anclan por su id. Lo servido es el RENDER de la casa, que para
 * un composer que imprime en canon es byte-igual a lo que escribió (lo mide `_anclar_composers_gate`). Reemplaza a `declaracionDeRespaldo` (re-leer
 * la prosa del composer con regex) en el flujo v3. Puro: sin I/O, sin red. */
import { normalizar } from "./afirmacion.js";

const _es = (x) => x && typeof x === "object" && !Array.isArray(x);
/* plegado de acentos que CONSERVA el largo (las posiciones del texto original siguen valiendo) */
const _PLANO = { á: "a", é: "e", í: "i", ó: "o", ú: "u", ü: "u", ñ: "n", Á: "a", É: "e", Í: "i", Ó: "o", Ú: "u", Ü: "u", Ñ: "n" };
const _plano = (t) => String(t || "").replace(/[áéíóúüñÁÉÍÓÚÜÑ]/g, (c) => _PLANO[c] || c).toLowerCase();
const _n = (t) => normalizar(t);

/** hechoDeDeclaracion(a, id) → el hecho v3 de una declaración tipada de un composer (la forma de `declarar.js`) */
export function hechoDeDeclaracion(a, id) {
  const tipo = _n(a && a.tipo);
  const ev = Array.isArray(a.evidencia) && a.evidencia.length === 1 && typeof a.evidencia[0] === "string" ? a.evidencia[0] : null;
  switch (tipo) {
    case "cifra":
      /* una cifra con UNA fig de evidencia es esa fig: se referencia por su rótulo (id de la boleta o rótulo único) */
      if (ev && !a.universo && !a.periodo) return { id, tipo: "ref", de: ev };
      return { id, tipo: "cifra", sujeto: a.sujeto, metrica: a.metrica, valor: a.valor, ...(a.universo ? { universo: a.universo } : {}), ...(a.periodo ? { periodo: a.periodo } : {}), evidencia: Array.isArray(a.evidencia) && a.evidencia.length ? a.evidencia : (a.sujeto && a.sujeto !== "negocio" && a.metrica ? [`${a.sujeto} · ${a.metrica}`] : []) };
    case "grupo":
      if (ev) return { id, tipo: "ref", de: ev };
      return { id, tipo: "grupo", miembros: Array.isArray(a.sujeto) ? a.sujeto : (a.sujeto ? [a.sujeto] : []), metrica: a.metrica, agregado: "suma", ...(a.valor != null ? { valor: a.valor } : {}), ...(a.universo ? { universo: a.universo } : {}) };
    case "orden": { const u = a.universoV3 || a.universo; return { id, tipo: "orden", sujeto: a.sujeto, metrica: a.metrica, orden: _es(a.orden) ? a.orden : {}, ...(u ? { universo: u } : {}) }; }
    case "relacion": return { id, tipo: "relacion", sujeto: a.sujeto, metrica: a.metrica, relacion: _es(a.relacion) ? a.relacion : {}, ...(a.valor != null ? { valor: a.valor } : {}) };
    case "conteo": { const c = _es(a.conteo) ? a.conteo : {}; return { id, tipo: "conteo", n: c.n, ...(c.m != null ? { m: c.m } : {}), ...(c.predicado ? { predicado: c.predicado } : {}), ...(a.universo ? { de: a.universo } : {}), ...(a.sujeto ? { sujeto: a.sujeto } : {}) }; }
    case "variacion": return { id, tipo: "variacion", sujeto: a.sujeto, metrica: a.metrica, variacion: _es(a.variacion) ? a.variacion : {}, ...(a.periodo ? { periodo: a.periodo } : {}) };
    case "estado": { const e = _es(a.estado) ? a.estado : { estado: a.estado }; return { id, tipo: "estado", sujeto: a.sujeto, estado: e.estado, ...(e.bodega ? { bodega: e.bodega } : {}) }; }
    case "lectura": return { id, tipo: "lectura", ...(a.sello ? { sello: a.sello } : {}), apoyo: [] };
    default: { const { texto, ...resto } = a || {}; void texto; return { id, tipo, ...resto }; }
  }
}

/* la primera aparición del tramo en el texto (exacta; si no, plegando acentos y mayúsculas) */
function _ubicar(s, frag, desde = 0) {
  const f = String(frag || "");
  if (!f.trim()) return -1;
  const fs = f.trim();
  let p = s.indexOf(fs, desde); if (p >= 0) return p;
  const S = _plano(s), Fp = _plano(fs);
  return S.indexOf(Fp, desde);
}
const _celdas = (linea) => { const out = []; const re = /\|([^|]*)/g; let m; while ((m = re.exec(linea))) { const t = m[1]; const lead = t.length - t.trimStart().length; const txt = t.trim(); if (txt) out.push({ ini: m.index + 1 + lead, fin: m.index + 1 + lead + txt.length, texto: txt }); } return out; };

/** anclarDeclaracion(texto, declaraciones, {prefijo}) → { prosa, hechos } · cada tramo declarado pasa a ser un ancla de su hecho; tramos que se
 *  solapan se funden en un ancla con varios ids; una fila de tabla declarada se ancla celda por celda (el id cuyo valor es la celda); las lecturas
 *  se apoyan en todos los hechos declarados por el mismo composer. */
export function anclarDeclaracion(texto, declaraciones, { prefijo = "d" } = {}) {
  const s = String(texto || "");
  const hechos = [], spans = [];
  let n = 0;
  for (const a of Array.isArray(declaraciones) ? declaraciones : []) {
    if (!a || typeof a.texto !== "string" || !a.texto.trim()) continue;
    const textoAncla = typeof a.textoV3 === "string" && a.textoV3.trim() && s.includes(a.textoV3.trim()) ? a.textoV3 : a.texto;   // el puente v3: el tramo con que se ancla
    const pos = _ubicar(s, textoAncla);
    if (pos < 0) continue;
    n++;
    const id = `${prefijo}${n}`;
    const h = hechoDeDeclaracion(a, id);
    hechos.push(h);
    const tramo = textoAncla.trim();
    let ini = pos, fin = pos + tramo.length;
    const tipo = _n(a.tipo);
    const valor = a.valor != null ? String(a.valor).trim() : "";
    const pv = (tipo === "cifra" || tipo === "grupo") && valor ? s.indexOf(valor, ini) : -1;
    if (pv >= 0 && pv + valor.length <= fin) {
      /* la cifra ancla SU VALOR: el dueño lo da la viñeta, la fila o la oración (comprobación 8), como a un placeholder suelto del cerebro */
      ini = pv; fin = pv + valor.length;
    } else {
      /* un tramo de varias líneas (una lista rankeada) ancla su primera línea; el enumerador o la viñeta quedan fuera del ancla */
      const salto = s.indexOf("\n", ini);
      if (salto >= 0 && salto < fin) fin = salto;
      const enum_ = /^\s*(?:[-*•]|\d{1,2}\s*[.)·])\s*/.exec(s.slice(ini, fin));
      if (enum_) ini += enum_[0].length;
      while (fin > ini && /[\s:]/.test(s[fin - 1])) fin--;
      if (fin <= ini) { ini = pos; fin = pos + tramo.length; }
    }
    spans.push({ ini, fin, ids: [id], valor: valor || null });
  }
  const factuales = hechos.filter((h) => h.tipo !== "lectura" && h.tipo !== "propuesta").map((h) => h.id);
  for (const h of hechos) if (h.tipo === "lectura") h.apoyo = factuales.slice();
  /* las lecturas se evalúan después de los hechos que las apoyan */
  hechos.sort((a, b) => (a.tipo === "lectura" ? 1 : 0) - (b.tipo === "lectura" ? 1 : 0));
  spans.sort((a, b) => a.ini - b.ini || b.fin - a.fin);
  const merged = [];
  for (const sp of spans) {
    const last = merged[merged.length - 1];
    if (last && sp.ini < last.fin) { last.fin = Math.max(last.fin, sp.fin); last.ids.push(...sp.ids); last.valores.push([sp.ids[0], sp.valor]); }
    else merged.push({ ini: sp.ini, fin: sp.fin, ids: [...sp.ids], valores: [[sp.ids[0], sp.valor]] });
  }
  const _num = (id) => parseInt(String(id).replace(/^[a-z]+/i, ""), 10) || 0;
  for (const m of merged) m.ids.sort((a, b) => _num(a) - _num(b));
  let out = "", pos = 0;
  for (const m of merged) {
    out += s.slice(pos, m.ini);
    const frag = s.slice(m.ini, m.fin);
    const lineas = frag.split("\n");
    out += lineas.map((linea) => {
      if (!linea.trim()) return linea;
      if (/^\s*\|/.test(linea) || linea.includes("|")) {
        /* fila de tabla: cada celda con dígitos es un ancla del id cuyo valor es esa celda (si ninguno coincide, de todos los ids de la fila) */
        const celdas = _celdas(linea).filter((c) => /\d/.test(c.texto));
        let o = "", p = 0;
        for (const c of celdas) { const ids = m.valores.filter(([, v]) => v != null && _n(v) === _n(c.texto)).map(([id]) => id); o += linea.slice(p, c.ini) + `{{${(ids.length ? ids : m.ids).join(" ")}: ${c.texto}}}`; p = c.fin; }
        return o + linea.slice(p);
      }
      const lead = linea.length - linea.trimStart().length, trail = linea.length - linea.trimEnd().length;
      return linea.slice(0, lead) + `{{${m.ids.join(" ")}: ${linea.trim()}}}` + (trail ? linea.slice(linea.length - trail) : "");
    }).join("\n");
    pos = m.fin;
  }
  out += s.slice(pos);
  return { prosa: out, hechos };
}

/* la entidad del rótulo «Entidad · Concepto» (la misma lectura que declarar.js) */
const _entidadDeLabel = (label) => { const p = String(label || "").split(/\s+·\s+/); return p.length >= 2 && !/^(?:contribuci|carga|capital|brecha|peso|markup|medida|clientes|umbral|estado|saldo|abonado|recuperado|resto)/i.test(p[0]) ? p[0] : null; };
const _lineaDe = (s, pos) => { const a = s.lastIndexOf("\n", pos) + 1; let b = s.indexOf("\n", pos); if (b < 0) b = s.length; return s.slice(a, b); };

/** anclarPorFigs(texto, figs, {prefijo}) → { prosa, hechos } · para los peldaños que no declaran: cada cifra de la boleta (con id) que aparece
 *  verbatim en el texto pasa a ser un placeholder de su `ref` (su propia ancla). Con el mismo valor en varias figs decide la entidad nombrada en
 *  la misma línea; sin decisión no se ancla (y el Notario lo cobra como cifra sin ancla, igual que al cerebro). */
export function anclarPorFigs(texto, figs, { prefijo = "r" } = {}) {
  const s = String(texto || "");
  const hechos = [], spans = [];
  const porValor = new Map();
  for (const f of Array.isArray(figs) ? figs : []) {
    if (!f || !f.label || f.source === "user_supuesto") continue;
    const v = String(f.text || f.value || "").trim();
    if (!v || !/\d/.test(v)) continue;
    if (!porValor.has(v)) porValor.set(v, []);
    porValor.get(v).push(f);
  }
  const usado = (ini, fin) => spans.some((x) => ini < x.fin && fin > x.ini);
  let n = 0;
  for (const [v, fs] of [...porValor.entries()].sort((a, b) => b[0].length - a[0].length)) {
    let desde = 0;
    while (desde < s.length) {
      const p = s.indexOf(v, desde);
      if (p < 0) break;
      desde = p + v.length;
      const antes = s[p - 1] || " ", despues = s[p + v.length] || " ";
      const despues2 = s[p + v.length + 1] || " ";
      if (/[\d.,$%\w]/.test(antes) || /[\d%\w]/.test(despues) || (/[.,]/.test(despues) && /\d/.test(despues2)) || usado(p, p + v.length)) continue;
      let f = null;
      if (fs.length === 1) f = fs[0];
      else {
        const linea = _plano(_lineaDe(s, p));
        const con = fs.filter((g) => { const e = _entidadDeLabel(g.label); return e && linea.includes(_plano(e)); });
        if (con.length === 1) f = con[0];
        else if (con.length === 0 && new Set(fs.map((g) => _n(g.label))).size === 1) f = fs[0];
        else if (con.length === 0 && fs.some((g) => !_entidadDeLabel(g.label))) {
          /* la línea no nombra a ninguna dueña: entre las figs del negocio con ese valor, la que la línea nombra por su rótulo entero («capital frenado
           * total»), o por todas sus palabras */
          const sinEnt = fs.filter((g) => !_entidadDeLabel(g.label));
          const porRotulo = sinEnt.filter((g) => { const r = _plano(String(g.label).replace(/\s*·\s*/g, " ")); return r && linea.includes(r); });
          const porPalabras = porRotulo.length ? porRotulo : sinEnt.filter((g) => _plano(String(g.label)).split(/[\s·]+/).filter((w) => w.length > 2).every((w) => linea.includes(w)));
          if (porPalabras.length === 1) f = porPalabras[0];
          else if (porPalabras.length > 1 && new Set(porPalabras.map((g) => _n(g.label))).size === 1) f = porPalabras[0];
        }
        else if (con.length > 1 && new Set(con.map((g) => _n(_entidadDeLabel(g.label)))).size === 1) {
          /* misma entidad, misma cifra: decide el concepto que la línea nombra; si ninguno, cualquiera (el dueño y el número son los mismos) */
          const porConcepto = con.filter((g) => { const c = String(g.label).split(/\s+·\s+/).slice(1).join(" "); return c && linea.includes(_plano(c)); });
          f = porConcepto.length === 1 ? porConcepto[0] : con[0];
        }
      }
      if (!f) continue;
      n++;
      const id = `${prefijo}${n}`;
      hechos.push({ id, tipo: "ref", de: f.id || f.label });
      /* el ancla cubre la cláusula «métrica de Entidad, valor» (desde el último : ; . — o el inicio de la línea), sin el enumerador; si la
       * cláusula ya tiene otra ancla o no cabe, se ancla solo el valor */
      let ini = p;
      const corte = Math.max(...[":", ";", ".", "—", "\n", "(", "·"].map((c) => s.lastIndexOf(c, p - 1)));
      const cand = corte + 1;
      const pre = s.slice(cand, p);
      if (!/[{}]/.test(pre) && !usado(cand, p) && pre.trim().length && pre.trim().length <= 70) { ini = cand + (pre.length - pre.trimStart().length); const en = /^(?:[-*•]|\d{1,2}\s*[.)·])\s*/.exec(s.slice(ini, p)); if (en) ini += en[0].length; }
      spans.push({ ini, fin: p + v.length, id, valor: ini < p });
    }
  }
  spans.sort((a, b) => a.ini - b.ini);
  let out = "", pos = 0;
  for (const sp of spans) { out += s.slice(pos, sp.ini) + (sp.valor ? `{{${sp.id}: ${s.slice(sp.ini, sp.fin)}}}` : `{${sp.id}}`); pos = sp.fin; }
  out += s.slice(pos);
  return { prosa: out, hechos };
}
