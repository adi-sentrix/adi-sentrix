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
import { leerClausula, compilarNombres, entidadesConPosicion, normalizar as _normalizarL } from "../oracle/lectorDeClausula.js";   // el sujeto y la comparada de la relación, por estructura (owner 2026-09-14)
import { metricasEn } from "../oracle/guardC.js";   // el vocabulario de métricas del muro: qué métrica compara la frase (una sola tabla, nunca una segunda)

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
  { re: /\b(?:el|al|del)\s+doble\b|\bduplic(?:a|an|ando|ó|o)\b|\bdobl(?:a|an|ando|ó)\b/i, k: 2 }, { re: /\b(?:el|al|del)\s+triple\b|\btriplic(?:a|an|ando|ó)\b/i, k: 3 }, { re: /\b(?:el|al|del)\s+cu[aá]druple\b|\bcuadruplic(?:a|an|ando|ó)\b/i, k: 4 },   // «duplica los días de…» es «el doble» con verbo (owner 2026-09-14)
  { re: /\b(?:la|a la|de la)\s+mitad\b/i, k: 0.5 }, { re: /\b(?:la|a la|de la)\s+tercera\s+parte\b|\bun\s+tercio\b/i, k: 1 / 3 }, { re: /\bdos\s+tercios\b/i, k: 2 / 3 },
  { re: /\b(?:la|a la|de la)\s+cuarta\s+parte\b|\bun\s+cuarto\b/i, k: 0.25 }, { re: /\btres\s+cuartos\b/i, k: 0.75 },
  { re: /\b(un|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|veinte|treinta|cuarenta|cincuenta|cien|\d+(?:[.,]\d+)?)\s+veces\b/i, k: null },
];
/* el matiz que precede a la relación fija el RANGO admitido de r/k (r = cociente real, k = el dicho): «más del doble» es
 * cierto de 1.9× a 3.2× (más allá se dice «el triple»); «casi el doble» de 1.3× a 2.1×; «el doble» a secas, ±15 %. Medido:
 * $19.4M contra $8.2M (2.37×) NO es «el doble» pero sí «más del doble»; $14K contra $8K (1.75×) es «casi el doble». */
const _MATIZ = [   // el «de» es opcional porque «del»/«de la» ya quedaron dentro del multiplicador
  { re: /\b(?:exactamente|justo|exacto)\s*$/i, lo: 0.98, hi: 1.02 },   // «exactamente el doble» es el doble (ronda 5)
  { re: /\b(?:poco|algo)\s+m[aá]s(?:\s+de)?\s*$/i, lo: 0.95, hi: 1.35 },
  { re: /\b(?:poco|algo)\s+menos(?:\s+de)?\s*$/i, lo: 0.65, hi: 1.05 },
  { re: /\bm[aá]s(?:\s+de)?\s*$/i, lo: 0.95, hi: 1.6 },
  { re: /\bmenos(?:\s+de)?\s*$/i, lo: 0.5, hi: 1.05 },
  /* «casi» CALIBRADO con el conjunto adversarial (owner 2026-09-14, grupos, conteos, universos e inventos): «casi la mitad» con 0.54 (2.5/4.6) es verdadera y
   * «casi el doble» con 1.41 (8.6/6.1) es falsa — el rango de 0.65 a 1.05 absolvía la segunda y condenaba la primera; 0.8 a 1.1 separa las dos y conserva
   * «casi el doble» = 1.83 (4.6/2.5) y «casi la mitad» = 0.496 (35/70.5) */
  { re: /\b(?:casi|apenas|pr[aá]cticamente)\s*$/i, lo: 0.8, hi: 1.1 },
  { re: /\b(?:cerca|alrededor)(?:\s+de)?\s*$|\b(?:aproximadamente|unas?|como)\s*$/i, lo: 0.7, hi: 1.3 },
];
const _RANGO_PLANO = { lo: 0.85, hi: 1.15 };   // el múltiplo a secas, ±15 %: la cota calibrada de la casa (fase 3: «2×» para 1.83; cuatro puntos: «seis veces» para 6.33). La cota estricta de la propuesta v3.1 (1.9–2.1) queda a decisión del owner
/** rangoDeMatiz(matiz) → el rango admitido de r/k para un matiz dicho («más de», «casi», «cerca de», «poco más de»…; vacío = plano ±15 %).
 *  La MISMA tabla que usa el juez de la prosa, expuesta para el Notario semántico (verificar.js): una relación declarada por su
 *  significado {veces, k, matiz} se juzga con el rango que fija el matiz, sin una segunda tabla (owner 2026-09-15). */
export function rangoDeMatiz(matiz) {
  const t = String(matiz || "").trim();
  if (!t) return { ..._RANGO_PLANO, dicho: "" };
  for (const x of _MATIZ) if (x.re.test(t)) return { lo: x.lo, hi: x.hi, dicho: t };
  return { ..._RANGO_PLANO, dicho: t };
}
const _NO_NUMERICO = /\b(?:a|muchas|varias|pocas|algunas|tantas|otras|repetidas)\s+veces\b/i;

/** relacionEnPalabrasNoCierra(texto) → multa | null. Toma la relación dicha con palabras y la contrasta con las cifras de la
 *  MISMA unidad en su PÁRRAFO hasta esa oración (el término de comparación suele vivir dos oraciones antes: «…de 95 días —
 *  cuatro veces más lenta que el Shaver9», con el Shaver9 en 15 días al abrir el párrafo). Si algún par de cifras cierra con
 *  la relación (±15 %; el matiz que la precede —«casi», «más de», «cerca de»— fija su propio rango, ver _MATIZ), pasa; sin
 *  dos cifras comparables, calla. */
/* ── LA RELACIÓN VERIFICADA CONTRA EL DATO (owner 2026-09-14, grupos, conteos, universos e inventos) ─────────────────────────────
 * «Falabella aporta un tercio de la contribución del negocio» (4.3 de 25.0: 17 %), «Lider y Falabella explican dos tercios del vencido» (7.1 de
 * 12.6: 56 %), «Lider concentra más de la mitad del vencido total» (36 %), «Falabella vende casi el doble que Jumbo» (1.12×), «Lider debe el doble
 * que Falabella»: sin cifras en el texto, la relación se verificaba contra nada. Y con las cifras de una LISTA («Falabella, Lider y Jumbo —$19.4M,
 * $17.8M y $17.3M— son más de la mitad de la venta») se comparaba par contra par, no la suma contra el total (fp-listas P11). Dos lecturas más,
 * ambas contra la boleta del turno (`figs`): (a) la FRACCIÓN DE UN TODO —la relación seguida de «de/del <métrica>»: el numerador son las
 * cifras del sujeto (una cuenta o la lista coordinada; si la prosa trae las cifras pegadas a los nombres, esas) en esa métrica, el denominador
 * el total de la métrica (el dicho tras «de los $X» o el total de la boleta)—; (b) el PAR SIN CIFRAS —sujeto y comparada, cada uno con su cifra
 * de la boleta en la métrica que la cláusula nombra—. Sin sujeto, sin métrica o sin las dos cifras, calla (falso negativo antes que positivo). */
const _partesDe = (label) => String(label || "").split("·").map((x) => x.trim()).filter(Boolean);
/* el crudo de una fig, o el número de su valor impreso cuando el emisor no lo trae (la cobranza publica «Saldo vencido · total» sin raw) */
const _rawDe = (f) => { if (Number.isFinite(f.raw) && f.raw !== 0) return f.raw; const p = parseFigures(String(f.value || f.text || ""))[0]; return p && Number.isFinite(p.raw) && p.raw !== 0 ? p.raw : NaN; };
const _conRaw = (f) => { const r = _rawDe(f); return Number.isFinite(r) ? { ...f, raw: r, unit: f.unit === "pp" ? "pct" : f.unit } : null; };
function _cifraDe(figs, entidad, claves, unidad) {
  const e = _normalizarL(entidad).trim();
  for (const f0 of figs) {
    if (!f0) continue;
    const p = _partesDe(f0.label);
    if (p.length !== 2 || _normalizarL(p[0]).trim() !== e) continue;
    const f = _conRaw(f0);
    if (!f) continue;
    if (unidad && f.unit !== unidad) continue;
    const ms = metricasEn(p[1]);
    if ([...ms].some((k) => claves.has(k))) return f;
  }
  return null;
}
function _totalDe(figs, claves, unidad) {
  for (const f0 of figs) {
    if (!f0) continue;
    const p = _partesDe(f0.label);
    const esTotal = (p.length === 1 && !/^\d/.test(p[0])) || (p.length === 2 && /^total$/i.test(p[1]));
    if (!esTotal) continue;
    const f = _conRaw(f0);
    if (!f) continue;
    if (unidad && f.unit !== unidad) continue;
    const ms = metricasEn(p[0]);
    if (ms.size && [...ms].some((k) => claves.has(k)) && !ms.has("participacion")) return f;
  }
  return null;
}
export function relacionEnPalabrasNoCierra(texto, figs = null) {
  const t = _limpio(texto);
  if (!t.trim()) return null;
  const figsDe = (o) => parseFigures(o).map((f) => ({ ...f, unit: f.unit === "pp" ? "pct" : f.unit })).filter((f) => Number.isFinite(f.raw) && f.raw !== 0);
  /* los ENTEROS sin unidad («1.194 contra 894» unidades, «190 contra 165» días sin la «d») entran al par cuando van los dos pelados */
  const enterosDe = (o) => [...String(o).matchAll(/(?<![\d.,$%])(\d{1,3}(?:\.\d{3})+|\d{2,4})(?![\d.,]*\s?(?:%|[KMB]\b|pp\b|d\b|d[ií]as?\b|x\b))/g)].map((m) => ({ unit: "count", raw: parseInt(m[1].replace(/\./g, ""), 10), text: m[1], pos: m.index })).filter((f) => Number.isFinite(f.raw) && f.raw > 0);
  const F = Array.isArray(figs) ? figs : [];
  const nombresF = [...new Set(F.map((f) => _partesDe(f && f.label)).filter((p) => p.length === 2 && !/^(?:total|subtotal)$/i.test(p[1])).map((p) => p[0]))];
  const nombresRe = nombresF.length ? compilarNombres(nombresF) : null;
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
      /* LA RELACIÓN SE VERIFICA EN LAS DOS DIRECCIONES (owner 2026-09-14, el orden en todas sus formas · fp-comparaciones 8): «Lider debe casi
       * el doble que Falabella ($4.6M contra $2.5M)» pasaba (1.84×) y «Falabella debe casi la mitad que Lider ($2.5M contra $4.6M)» ardía —
       * la misma relación, dicha desde el otro lado. Una fracción (k < 1) admite DOS lecturas: la literal («casi la mitad» = un poco menos de
       * la mitad: 47 % de $9.8M) y la del lado grande («casi la mitad» es «casi el doble» al revés: $2.5M contra $4.6M), con el matiz de
       * más/menos invertido en esa segunda. Cierra con cualquiera de las dos. */
      const inverso = Number.isFinite(k) && k > 0 && k < 1;
      const lecturas = [{ rango: matiz || _RANGO_PLANO, q: (r) => r / k }];
      if (inverso) {
        let espejo = matiz;
        if (matiz && /\bm[aá]s\b/i.test(matiz.dicho) && !/menos/i.test(matiz.dicho)) espejo = { ...matiz, ..._MATIZ.find((x) => x.re.test(matiz.dicho.replace(/m[aá]s/i, 'menos') + ' ')) };
        else if (matiz && /\bmenos\b/i.test(matiz.dicho)) espejo = { ...matiz, ..._MATIZ.find((x) => x.re.test(matiz.dicho.replace(/menos/i, 'más') + ' ')) };
        lecturas.push({ rango: espejo || _RANGO_PLANO, q: (r) => k / r });
      }
      const cierraCon = (r) => lecturas.some((l) => { const q = l.q(r); return q >= l.rango.lo && q <= l.rango.hi; });
      /* la fracción de un TODO (a/total) se lee solo en su sentido literal: su rango es el del matiz dicho (fusión orden + grupos, 2026-09-15) */
      const rango = matiz || _RANGO_PLANO;
      const dicho = (matiz ? matiz.dicho + " " : "") + m[0].trim();   // «más del doble», no «del doble»
      const relTxt = (r) => (r >= 1 ? `${(Math.round(r * 10) / 10).toFixed(1).replace(/\.0$/, "")} veces` : `${Math.round(r * 100)}%`);
      /* EL PAR QUE LA FRASE COMPARA (encargo en vivo, 2026-09-14): «vencido casi el doble ($4.6M vs $2.5M)» se juzgaba contra
       * la cifra más cercana de ANTES («8.1 pp», otra métrica) y ardía con 1.1 veces. Regla del owner: «una relación como
       * "casi el doble" debe juzgarse contra las cifras que realmente está comparando la frase». Si justo después de la
       * frase vienen dos cifras de la misma unidad unidas por «vs», «contra», «frente a» o «y» (con o sin paréntesis),
       * ESE es el par: decide él, y la multa lo cita. */
      const finFrase = m.index + m[0].length;
      const trasFrase = o.slice(finFrase, finFrase + 70).split(/[.;](?!\d)/)[0];   // el punto DECIMAL («$4.6M») no cierra la oración
      const par = figsDe(trasFrase).map((f) => ({ ...f, pos: trasFrase.indexOf(f.text) })).filter((f) => f.pos >= 0).sort((a, b) => a.pos - b.pos).slice(0, 2);
      /* …el par también puede venir entre paréntesis tras la comparada («un tercio del frenado de Valparaíso ($8K contra $25K)») — owner 2026-09-14 */
      if (par.length === 2 && par[0].unit === par[1].unit && (par[0].pos <= 20 || /\(\s*$/.test(trasFrase.slice(0, par[0].pos))) && /^\s*(?:vs\.?|contra|frente a|y|e|a|–|—|-)\s*$/i.test(trasFrase.slice(par[0].pos + par[0].text.length, par[1].pos))) {
        const rs = [par[0].raw / par[1].raw, par[1].raw / par[0].raw];
        if (rs.some(cierraCon)) continue;
        return `«${dicho}» no cierra con las cifras que compara (${par[0].text} contra ${par[1].text} son ${relTxt(Math.max(...rs))}): una relación dicha en palabras vale lo mismo que una cifra — o es consistente con los números que compara, o no se dice. Di la relación exacta o quítala.`;
      }
      /* el par de ENTEROS pelados («1.194 contra 894», «190 contra 165»): la misma lectura del par inmediato */
      {
        const ent = enterosDe(trasFrase).sort((a, b) => a.pos - b.pos).slice(0, 2);
        if (ent.length === 2 && (ent[0].pos <= 20 || /\(\s*$/.test(trasFrase.slice(0, ent[0].pos))) && /^\s*(?:vs\.?|contra|frente a|y|e|a|–|—|-)\s*$/i.test(trasFrase.slice(ent[0].pos + ent[0].text.length, ent[1].pos))) {
          const rs = [ent[0].raw / ent[1].raw, ent[1].raw / ent[0].raw];
          if (rs.some(cierraCon)) continue;
          return `«${dicho}» no cierra con las cifras que compara (${ent[0].text} contra ${ent[1].text} son ${relTxt(Math.max(...rs))}): una relación dicha en palabras vale lo mismo que una cifra — o es consistente con los números que compara, o no se dice. Di la relación exacta o quítala.`;
        }
      }
      /* CONTRA EL DATO (ver la cabecera): la fracción de un todo y el par sin cifras */
      if (nombresRe && F.length) {
        const posO = t.indexOf(o);
        const L = posO >= 0 ? leerClausula(t, posO + m.index, { nombresRe }) : null;
        const tras = o.slice(finFrase, finFrase + 90);
        const mDe = /^\s*(?:de\s+(?:l[oa]s\s+|la\s+|el\s+|su\s+|tu\s+)?|del\s+)((?:[^.;,()]|\.(?=\d)|\([^)]*\)){1,60}?)(?=[;,]|\.(?!\d)|\s+(?:que|con|y|e|en|sobre|contra|frente)\b|$)/iu.exec(tras);   // el punto decimal («$99.9M») no cierra el complemento
        const clavesTras = mDe ? metricasEn(mDe[1]) : new Set();
        const esFraccion = k <= 1 || (matiz && /m[aá]s|menos/.test(matiz.dicho) && k <= 1);
        /* «del frenado DE VALPARAÍSO»: con una entidad en el complemento no es la fracción de un todo, es la comparación con ella (el par) */
        const compConEntidad = mDe ? entidadesConPosicion(_normalizarL(mDe[1]), nombresRe).length > 0 : false;
        if (L && mDe && clavesTras.size && esFraccion && !compConEntidad && !/(?:que|de\s+l[oa]s?\s+de|del\s+de)\b/i.test(mDe[1])) {
          /* (a) la fracción de un todo: numerador = sujeto (cuenta o lista), denominador = el total de la métrica */
          const sujetos = L.sujetoPropio && Array.isArray(L.coordinadas) && L.coordinadas.length >= 2 && L.listaCerrada ? L.coordinadas : (L.sujeto ? [L.sujeto.nombre] : []);
          const unidad = /\$/.test(mDe[1]) ? "money" : null;
          const enDe = figsDe(mDe[1]).filter((f) => f.unit === "money");
          /* «($4.6M de $12.6M)»: las dos cifras dichas — la parte y el todo; con una sola, es el todo */
          if (enDe.length >= 2 && /\bde\s+(?:l[oa]s\s+)?\$/i.test(mDe[1])) {
            const r = enDe[0].raw / enDe[enDe.length - 1].raw;
            const q = r / k;
            if (q >= rango.lo && q <= rango.hi) continue;
            return `«${dicho}» no cierra con las cifras que trae (${enDe[0].text} sobre ${enDe[enDe.length - 1].text} es ${Math.round(r * 100)} %): una relación dicha en palabras vale lo mismo que una cifra — o es consistente con los números que la rodean, o no se dice. Di la proporción exacta o quítala.`;
          }
          const dichoTotal = enDe[0] || null;
          const totalFig = dichoTotal ? { raw: dichoTotal.raw, text: dichoTotal.text, unit: "money" } : _totalDe(F, clavesTras, unidad);
          /* (a0) el NUMERADOR DICHO junto a la fracción (corrida en vivo Q2, 2026-09-14): «liberar esos dos suma $22K, casi dos tercios del capital
           * frenado total ($33K)» — la cifra de la misma unidad que precede a la fracción, separada solo por una coma, un guion o «es decir / o sea /
           * esto es / equivale a», ES la parte; juzgarla contra la cifra del sujeto ($8K de MAK-COMP-AIR, 24 %) era leer otra relación y tumbar un
           * borrador correcto. Regla (owner 2026-09-14): una cifra que no está en la boleta solo vale por una cuenta MOSTRADA — y acá la cuenta está */
          if (totalFig) {
            const cola = matiz ? antes.replace(matiz.re, "") : antes;
            const previa = figsDe(cola).map((f) => ({ ...f, pos: cola.lastIndexOf(f.text) })).filter((f) => f.pos >= 0 && f.unit === totalFig.unit).sort((a, b) => b.pos - a.pos)[0] || null;
            const numDicho = previa && /^\s*(?:[,—–-]|es decir|o sea|esto es|equival(?:e|ente)\s+a|lo que es|que es)?\s*(?:es decir|o sea|esto es|equival(?:e|ente)\s+a)?\s*,?\s*$/i.test(cola.slice(previa.pos + previa.text.length)) ? previa : null;
            if (numDicho && numDicho.raw !== totalFig.raw) {
              const r = numDicho.raw / totalFig.raw;
              const q = r / k;
              if (q >= rango.lo && q <= rango.hi) continue;
              return `«${dicho}» no cierra con las cifras que trae (${numDicho.text} sobre ${totalFig.text || totalFig.value} es ${Math.round(r * 100)} %): una relación dicha en palabras vale lo mismo que una cifra — o es consistente con los números que la rodean, o no se dice. Di la proporción exacta o quítala.`;
            }
          }
          if (sujetos.length && totalFig) {
            const cifras = sujetos.map((n) => _cifraDe(F, n, clavesTras, totalFig.unit === "pp" ? "pct" : totalFig.unit));
            if (cifras.every(Boolean)) {
              const num = cifras.reduce((a, f) => a + f.raw, 0);
              const r = num / totalFig.raw;
              const q = r / k;
              if (q >= rango.lo && q <= rango.hi) continue;
              return `«${dicho}» no cierra con el dato: ${sujetos.length > 1 ? "la suma de " : ""}${cifras.map((f) => `${_partesDe(f.label)[0]} ${f.text || f.value}`).join(" + ")} sobre ${totalFig.text || totalFig.value} es ${Math.round(r * 100)} %: una relación dicha en palabras vale lo mismo que una cifra — o es consistente con las cifras de la boleta, o no se dice. Di la proporción exacta o quítala.`;
            }
          }
        }
        /* (a') el total DICHO sin métrica («concentran más de la mitad de los $99.9M», «…y Jumbo $17.3M sobre $99.9M»): el numerador son las cifras de la
         * misma unidad pegadas a la lista del sujeto (o las de su lista tras los dos puntos), la suma contra ese total */
        const mTotalDicho = mDe && !clavesTras.size ? figsDe(mDe[1]).filter((f) => f.unit === "money")[0] || null : (/\b(?:sobre|de un total de)\s+\$/i.test(o) ? figsDe(o.slice(o.search(/\b(?:sobre|de un total de)\s+\$/i))).filter((f) => f.unit === "money")[0] || null : null);
        if (L && esFraccion && mTotalDicho) {
          const todas = figsDe(o).filter((f) => f.unit === "money" && !(f.raw === mTotalDicho.raw && f.text === mTotalDicho.text));
          if (todas.length >= 2) {
            /* «Falabella ($19.4M), Lider ($17.8M) y Jumbo ($17.3M) suman $54.5M, más de la mitad de los $99.9M»: si una cifra es la suma de las demás, ella es el numerador */
            const sumaDicha = todas.find((f) => { const otras = todas.filter((g) => g !== f); return otras.length >= 2 && Math.abs(otras.reduce((a, g) => a + g.raw, 0) - f.raw) <= Math.max(1000, Math.abs(f.raw) * 0.02); });
            const numerador = sumaDicha ? sumaDicha.raw : todas.reduce((a, f) => a + f.raw, 0);
            const r = numerador / mTotalDicho.raw;
            const q = r / k;
            if (q >= rango.lo && q <= rango.hi) continue;
            return `«${dicho}» no cierra con las cifras que trae (${sumaDicha ? sumaDicha.text : todas.map((f) => f.text).join(" + ")} sobre ${mTotalDicho.text} es ${Math.round(r * 100)} %): una relación dicha en palabras vale lo mismo que una cifra — o es consistente con los números que la rodean, o no se dice. Di la proporción exacta o quítala.`;
          }
        }
        /* (b) el par sin cifras: «Falabella vende casi el doble que Jumbo», «Lider debe el doble que Falabella» */
        const mQue = /^\s*(?:de\s+\p{L}+\s+)?(?:que|de|a|al)\s+(?:l[oa]s?\s+(?:de\s+)?|el\s+de\s+|la\s+de\s+|lo\s+(?:de|que)\s+)?/iu.exec(tras);
        if (L && L.sujeto && mQue && !figsDe(o).length && !enterosDe(o).length) {
          /* la comparada es la primera entidad tras el «que/de/a» de la relación, en la misma cláusula */
          const tramoComp = _normalizarL(tras.slice(mQue[0].length)).split(/[.;:,()]/)[0];
          const primera = entidadesConPosicion(tramoComp, nombresRe)[0] || null;
          const comparada = primera && primera.nombre !== L.sujeto.nombre ? primera : (L.comparada || null);
          const claves = metricasEn(o);
          if (comparada && claves.size) {
            /* «vende» es la venta en dinero salvo que la frase hable de unidades: las figs de conteo («Unidades vendidas») solo entran con esa palabra */
            const unidadA = /\bunidades\b/i.test(o) ? "count" : (claves.has("recuperado") || claves.has("margen") || claves.has("carga") || claves.has("brecha") ? "pct" : "money");
            const a = _cifraDe(F, L.sujeto.nombre, claves, unidadA) || (unidadA === "money" ? _cifraDe(F, L.sujeto.nombre, claves, "pct") : null), b = a ? _cifraDe(F, comparada.nombre, claves, a.unit === "pp" ? "pct" : a.unit) : null;
            if (a && b) {
              const r = a.raw / b.raw;
              const q = r / k;
              if (q >= rango.lo && q <= rango.hi) continue;
              return `«${dicho}» no cierra con el dato: ${_partesDe(a.label)[0]} ${a.text || a.value} contra ${_partesDe(b.label)[0]} ${b.text || b.value} son ${relTxt(r)}: una relación dicha en palabras vale lo mismo que una cifra — o es consistente con las cifras de la boleta, o no se dice. Di la relación exacta o quítala.`;
            }
          }
        }
      }
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
          if (cierraCon(r)) cierra = true;
          if (!mejor || Math.abs(Math.log(r / k)) < Math.abs(Math.log(mejor.r / k))) mejor = { r, a: r === ref.raw / otro.raw ? ref : otro, b: r === ref.raw / otro.raw ? otro : ref };
        }
      }
      if (cierra) continue;
      const realTxt = mejor ? `${mejor.a.text} contra ${mejor.b.text} son ${relTxt(mejor.r)}` : "las cifras de la oración no lo sostienen";
      return `«${dicho}» no cierra con las cifras (${realTxt}): una relación dicha en palabras vale lo mismo que una cifra — o es consistente con los números que la rodean, o no se dice. Di la relación exacta o quítala.`;
    }
  }
  }
  return null;
}
