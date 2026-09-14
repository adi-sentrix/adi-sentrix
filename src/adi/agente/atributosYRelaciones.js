/* === src/adi/agente/atributosYRelaciones.js · DOS JUECES DEL REGISTRO (owner 2026-09-14, corrida en vivo del cruce) ====
 *
 * EL ESTÁNDAR, textual:
 *   · «una cifra correcta no puede quedar asociada a un atributo incorrecto, como bodega, sucursal, marca o entidad»;
 *   · «cualquier relación cuantitativa expresada en palabras ("el doble", "cuatro veces", "la mitad") debe ser
 *      consistente con las cifras».
 *
 * LO MEDIDO (respuesta 1 de la corrida, servida como «reparado»): «cada uno vive en su propia bodega (Valparaíso el
 * primero, Antofagasta el segundo)» después de nombrar MAK-COMP-AIR y LG-DRYER8KG — al revés: MAK-COMP-AIR está en
 * Antofagasta y LG-DRYER8KG en Valparaíso. Y «una cobertura de 95 días — cuatro veces más lenta que el Shaver9», con
 * el Shaver9 en 15 días: son 6,3 veces. Las cifras eran todas reales; el muro verifica cifras, no atributos ni
 * relaciones dichas con palabras. Dos huecos del notario, cerrados acá con el mismo criterio de la casa: falso
 * negativo antes que falso positivo — ante la duda (sin dueño claro, sin dos cifras de la misma unidad), no se juzga.
 *
 * PURO · determinístico · lee el tenant activo (los atributos SON del dato: la bodega de un SKU no es opinión). */
import { getTenantData } from "../../data/tenantStore.js";
import { axisEntityNames } from "../oracle/entityIndex.js";
import { parseFigures } from "../boleta.js";

const _norm = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const _esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const _limpio = (t) => String(t || "").replace(/\*\*/g, "");   // las negritas del modelo no son texto
const _oraciones = (t) => _limpio(t).split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter(Boolean);

/* ── LOS ATRIBUTOS DEL DATO · quién está en qué bodega, de qué marca y familia es cada SKU, en qué canal vende cada cliente ── */
function _atributos() {
  const d = getTenantData() || {};
  const porSku = new Map();
  for (const r of d.skuInventario || []) {
    if (!r || !r.sku) continue;
    const a = porSku.get(r.sku) || { bodega: new Set(), marca: new Set(), familia: new Set() };
    if (r.bodega) a.bodega.add(String(r.bodega));
    if (r.marca) a.marca.add(String(r.marca));
    if (r.sfamilia) a.familia.add(String(r.sfamilia));
    porSku.set(r.sku, a);
  }
  for (const r of d.skusMargen || []) {
    if (!r || !r.nombre) continue;
    const a = porSku.get(r.nombre) || { bodega: new Set(), marca: new Set(), familia: new Set() };
    if (r.marca) a.marca.add(String(r.marca));
    if (r.sfamilia) a.familia.add(String(r.sfamilia));
    porSku.set(r.nombre, a);
  }
  const porCliente = new Map();
  for (const r of d.clientesVentas || []) if (r && r.nombre && r.canal) porCliente.set(r.nombre, { canal: new Set([String(r.canal)]) });
  const nombres = (eje, min = 3) => { try { return (axisEntityNames(eje) || []).map(String).filter((n) => n.length >= min); } catch { return []; } };
  /* los VALORES pueden ser cortos («LG» es una marca): 2 letras alcanzan porque se buscan con el texto ya sin las entidades */
  return { porSku, porCliente, skus: nombres("sku"), clientes: nombres("cliente"), valores: { bodega: nombres("bodega", 2), marca: nombres("marca", 2), familia: nombres("familia", 2), canal: nombres("canal", 2) } };
}
/* menciones de una lista de nombres en un texto normalizado: [{ nombre, ini, fin }] en orden de aparición */
function _menciones(tn, nombres) {
  const out = [];
  for (const n of nombres) {
    const re = new RegExp(`(?<![\\p{L}\\p{N}])${_esc(_norm(n))}(?![\\p{L}\\p{N}])`, "gu");
    let m; while ((m = re.exec(tn))) out.push({ nombre: n, ini: m.index, fin: m.index + m[0].length });
  }
  /* un nombre contenido en otro («LG» dentro de «LG-DRYER8KG») no es una mención propia */
  return out.filter((a) => !out.some((b) => b !== a && b.ini <= a.ini && b.fin >= a.fin && b.nombre.length > a.nombre.length)).sort((a, b) => a.ini - b.ini);
}
const _NEGADA = /\b(?:no|nunca|jam[aá]s|ni)\b[^.\n]{0,25}$|\bfuera de\b[^.\n]{0,15}$|\b(?:salvo|excepto|distint[oa]s? (?:a|de))\b[^.\n]{0,15}$/i;
const _ORDINALES = [/\b(?:el|la)\s+primer[oa]\b/i, /\b(?:el|la)\s+segund[oa]\b/i, /\b(?:el|la)\s+tercer[oa]\b/i, /\b(?:el|la)\s+cuart[oa]\b/i];
const _TIPO_TXT = { bodega: "bodega", marca: "marca", familia: "familia", canal: "canal" };
/* el verbo con el que se le devuelve el atributo al modelo: «está en» solo vale para la bodega */
const _VERBO = { bodega: "está en", canal: "vende por", marca: "es de la marca", familia: "es de la familia" };
const _CON_ART = { bodega: "la bodega", marca: "la marca", familia: "la familia", canal: "el canal" };
/* las entidades se BLANQUEAN antes de buscar valores: «LG» dentro de «LG-DRYER8KG» no es una mención de la marca */
const _sinEntidades = (tn, menciones) => { let s = tn; for (const m of menciones) s = s.slice(0, m.ini) + " ".repeat(m.fin - m.ini) + s.slice(m.fin); return s; };

/** atributoMalAsociado(texto) → multa | null. Solo asociaciones inequívocas: la cifra/entidad y el atributo en la misma
 *  oración con una sola entidad candidata, o el reparto ordinal («X el primero, Y el segundo») sobre las entidades que
 *  la prosa acaba de nombrar. Ante ambigüedad, calla. */
export function atributoMalAsociado(texto) {
  const t = _limpio(texto);
  if (!t.trim()) return null;
  const A = _atributos();
  if (!A.porSku.size && !A.porCliente.size) return null;
  const oraciones = _oraciones(t);
  const vistasAntes = [];   // entidades nombradas en oraciones previas (orden de primera aparición), para «el primero / el segundo»
  for (const o of oraciones) {
    const on = _norm(o);
    const skus = _menciones(on, A.skus), clientes = _menciones(on, A.clientes);
    const onSinEnt = _sinEntidades(on, [...skus, ...clientes]);
    for (const tipo of ["bodega", "marca", "familia", "canal"]) {
      const vals = _menciones(onSinEnt, A.valores[tipo]);
      if (!vals.length) continue;
      const entidades = tipo === "canal" ? clientes : skus;
      const tabla = tipo === "canal" ? A.porCliente : A.porSku;
      /* (a) el reparto ordinal: «(Valparaíso el primero, Antofagasta el segundo)» → las últimas N entidades nombradas */
      const ords = _ORDINALES.map((re) => { const m = re.exec(o); return m ? m.index : -1; });
      const nOrd = ords.filter((i) => i >= 0).length;
      if (nOrd >= 2 && vals.length >= nOrd) {
        const candidatas = entidades.length >= nOrd ? entidades.map((e) => e.nombre) : vistasAntes.slice(-nOrd);
        const distintas = [...new Set(candidatas)];
        if (distintas.length === nOrd) {
          for (let k = 0; k < nOrd; k++) {
            const pos = ords[k];
            /* el valor que acompaña al ordinal k: el más cercano ANTES del ordinal en la oración */
            const val = [...vals].reverse().find((vv) => vv.fin <= pos + 1);
            if (!val) continue;
            const real = tabla.get(distintas[k]);
            if (real && real[tipo] && real[tipo].size && !real[tipo].has(val.nombre)) {
              return `«${distintas[k]}» ${_VERBO[tipo]} ${[...real[tipo]].join("/")}, no ${val.nombre}: el reparto «${o.slice(Math.max(0, pos - 30), pos + 14).trim()}» invierte el atributo (${_TIPO_TXT[tipo]}) — un atributo del dato no se intercambia entre entidades; nombra a cada una con su ${_TIPO_TXT[tipo]} real.`;
            }
          }
        }
        continue;
      }
      /* (b) la asociación directa: UNA entidad en la oración y, pegado a ella, el valor MÁS CERCANO de ese atributo —
       * «LG-DRYER8KG (Valparaíso, $14K…)», «MAK-COMP-AIR … $8K frenados en Antofagasta». Solo el valor más cercano se
       * juzga: en «LG-DRYER8KG tiene $14K; por bodega, Valparaíso $25K y Antofagasta $8K» el segundo nombre es de una
       * enumeración por bodega, no un atributo del SKU — y una enumeración así («por bodega», «;») no se juzga. */
      const distintas = [...new Set(entidades.map((e) => e.nombre))];
      if (distintas.length !== 1) continue;
      const ent = distintas[0];
      const real = tabla.get(ent);
      if (!real || !real[tipo] || !real[tipo].size) continue;
      const e = entidades.find((x) => x.nombre === ent);
      const dist = (val) => (e.ini < val.ini ? val.ini - e.fin : e.ini - val.fin);
      const val = vals.slice().sort((x, y) => dist(x) - dist(y))[0];
      if (real[tipo].has(val.nombre) || dist(val) > 60) continue;
      const entre = on.slice(Math.min(e.fin, val.fin), Math.max(e.ini, val.ini));
      if (/;|\bpor (?:bodega|marca|familia|canal)\b|\b(?:frente a|contra|versus|vs)\b/.test(entre)) continue;
      const antes = o.slice(0, Math.max(0, val.ini));
      if (_NEGADA.test(antes)) continue;   // «no está en Valparaíso», «fuera de Santiago»
      return `«${ent}» ${_VERBO[tipo]} ${[...real[tipo]].join("/")}, no ${val.nombre}: ${_CON_ART[tipo]} es un atributo del dato y viaja con la entidad — no la cambies («${o.slice(Math.max(0, Math.min(e.ini, val.ini) - 10), Math.max(e.fin, val.fin) + 10).trim()}»).`;
    }
    for (const s of skus) if (!vistasAntes.includes(s.nombre)) vistasAntes.push(s.nombre);
    for (const c of clientes) if (!vistasAntes.includes(c.nombre)) vistasAntes.push(c.nombre);
  }
  return null;
}

/* ── LAS RELACIONES DICHAS CON PALABRAS ───────────────────────────────────────────────────────────────────────────── */
const _NUM = { un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, veinte: 20, treinta: 30, cuarenta: 40, cincuenta: 50, cien: 100 };
/* «más DEL doble», «menos DE LA mitad», «cerca DEL triple»: la contracción va con el multiplicador (medido: «más del doble
 * que Lider ($17.8M)» con 1.09× pasaba porque «del doble» no se leía como «el doble») */
const _MULT = [
  { re: /\b(?:el|al|del)\s+doble\b/i, k: 2 }, { re: /\b(?:el|al|del)\s+triple\b/i, k: 3 }, { re: /\b(?:el|al|del)\s+cu[aá]druple\b/i, k: 4 },
  { re: /\b(?:la|a la|de la)\s+mitad\b/i, k: 0.5 }, { re: /\b(?:la|a la|de la)\s+tercera\s+parte\b|\bun\s+tercio\b/i, k: 1 / 3 }, { re: /\bdos\s+tercios\b/i, k: 2 / 3 },
  { re: /\b(?:la|a la|de la)\s+cuarta\s+parte\b|\bun\s+cuarto\b/i, k: 0.25 }, { re: /\btres\s+cuartos\b/i, k: 0.75 },
  { re: /\b(un|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|veinte|treinta|cuarenta|cincuenta|cien|\d+(?:[.,]\d+)?)\s+veces\b/i, k: null },
];
/* el matiz que precede a la relación fija el RANGO admitido de r/k (r = cociente real, k = el dicho): «más del doble» es
 * cierto de 1.9× a 3.2× (más allá se dice «el triple»); «casi el doble» de 1.3× a 2.1×; «el doble» a secas, ±15 %. Medido:
 * $19.4M contra $8.2M (2.37×) NO es «el doble» pero sí «más del doble»; $14K contra $8K (1.75×) es «casi el doble». */
const _MATIZ = [   // el «de» es opcional porque «del»/«de la» ya quedaron dentro del multiplicador
  { re: /\b(?:poco|algo)\s+m[aá]s(?:\s+de)?\s*$/i, lo: 0.95, hi: 1.35 },
  { re: /\b(?:poco|algo)\s+menos(?:\s+de)?\s*$/i, lo: 0.65, hi: 1.05 },
  { re: /\bm[aá]s(?:\s+de)?\s*$/i, lo: 0.95, hi: 1.6 },
  { re: /\bmenos(?:\s+de)?\s*$/i, lo: 0.5, hi: 1.05 },
  { re: /\b(?:casi|apenas|pr[aá]cticamente)\s*$/i, lo: 0.65, hi: 1.05 },
  { re: /\b(?:cerca|alrededor)(?:\s+de)?\s*$|\b(?:aproximadamente|unas?|como)\s*$/i, lo: 0.7, hi: 1.3 },
];
const _RANGO_PLANO = { lo: 0.85, hi: 1.15 };
const _NO_NUMERICO = /\b(?:a|muchas|varias|pocas|algunas|tantas|otras|repetidas)\s+veces\b/i;

/** relacionEnPalabrasNoCierra(texto) → multa | null. Toma la relación dicha con palabras y la contrasta con las cifras de la
 *  MISMA unidad en su PÁRRAFO hasta esa oración (el término de comparación suele vivir dos oraciones antes: «…de 95 días —
 *  cuatro veces más lenta que el Shaver9», con el Shaver9 en 15 días al abrir el párrafo). Si algún par de cifras cierra con
 *  la relación (±15 %; el matiz que la precede —«casi», «más de», «cerca de»— fija su propio rango, ver _MATIZ), pasa; sin
 *  dos cifras comparables, calla. */
export function relacionEnPalabrasNoCierra(texto) {
  const t = _limpio(texto);
  if (!t.trim()) return null;
  const figsDe = (o) => parseFigures(o).map((f) => ({ ...f, unit: f.unit === "pp" ? "pct" : f.unit })).filter((f) => Number.isFinite(f.raw) && f.raw !== 0);
  const parrafos = t.split(/\n{2,}/).map((x) => x.trim()).filter(Boolean);
  for (const parrafo of parrafos) {
  const oraciones = _oraciones(parrafo);
  for (let i = 0; i < oraciones.length; i++) {
    const o = oraciones[i];
    if (_NO_NUMERICO.test(o)) continue;
    for (const M of _MULT) {
      const m = M.re.exec(o);
      if (!m) continue;
      let k = M.k;
      if (k === null) { const w = _norm(m[1]); k = _NUM[w] !== undefined ? _NUM[w] : parseFloat(w.replace(",", ".")); }
      if (!Number.isFinite(k) || k <= 0) continue;
      const antes = o.slice(0, m.index);
      let matiz = null;
      for (const x of _MATIZ) { const mm = x.re.exec(antes); if (mm) { matiz = { ...x, dicho: mm[0].trim() }; break; } }
      const rango = matiz || _RANGO_PLANO;
      const pool = oraciones.slice(0, i + 1).flatMap(figsDe);   // el párrafo hasta esta oración
      /* LA CIFRA DE REFERENCIA es la más cercana ANTES de la relación en su oración («…de 95 días — cuatro veces más
       * lenta»): la relación es de ESA unidad y la referencia es uno de los dos operandos. Sin cifra antes, la más cercana
       * después; sin ninguna en la oración, no se juzga. Medido: con «cualquier par de cualquier unidad» un par de montos
       * ($12.3M/$3.4M ≈ 3.6) tapaba el «cuatro veces» que hablaba de días (95/15 = 6.3). */
      const enOracion = figsDe(o).map((f) => ({ ...f, pos: o.indexOf(f.text) }));
      const antesDe = enOracion.filter((f) => f.pos >= 0 && f.pos < m.index).sort((a, b) => b.pos - a.pos)[0];
      const despuesDe = enOracion.filter((f) => f.pos > m.index).sort((a, b) => a.pos - b.pos)[0];
      const ref = antesDe || despuesDe;
      if (!ref) continue;
      const xs = pool.filter((f) => f.unit === ref.unit);
      if (xs.length < 2) continue;
      let cierra = false, mejor = null;
      for (const otro of xs) {
        if (otro.raw === ref.raw && otro.text === ref.text) continue;
        for (const r of [ref.raw / otro.raw, otro.raw / ref.raw]) {
          const q = r / k;
          if (q >= rango.lo && q <= rango.hi) cierra = true;
          if (!mejor || Math.abs(Math.log(r / k)) < Math.abs(Math.log(mejor.r / k))) mejor = { r, a: r === ref.raw / otro.raw ? ref : otro, b: r === ref.raw / otro.raw ? otro : ref };
        }
      }
      if (cierra) continue;
      const dicho = (matiz ? matiz.dicho + " " : "") + m[0].trim();   // «más del doble», no «del doble»
      const realTxt = mejor ? `${mejor.a.text} contra ${mejor.b.text} son ${mejor.r >= 1 ? `${(Math.round(mejor.r * 10) / 10).toFixed(1).replace(/\.0$/, "")} veces` : `${Math.round(mejor.r * 100)}%`}` : "las cifras de la oración no lo sostienen";
      return `«${dicho}» no cierra con las cifras (${realTxt}): una relación dicha en palabras vale lo mismo que una cifra — o es consistente con los números que la rodean, o no se dice. Di la relación exacta o quítala.`;
    }
  }
  }
  return null;
}
