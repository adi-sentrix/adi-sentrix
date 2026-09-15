/* === src/adi/notario/juez.js · EL JUEZ SEMÁNTICO DEL TURNO (Notario semántico, fase 2 · owner 2026-09-15) ═════════════════
 * «Notario verifica la afirmación contra la evidencia estructurada; la redacción no determina la verdad.» Acá se juntan, para UN
 * texto y SU declaración, las cuatro cosas que el turno necesita saber — y salen como vetos en la forma que el bucle ya entiende
 * ({kind, detail, texto}):
 *   1 · CONSISTENCIA: la respuesta y sus declaraciones representan la misma realidad. Cada afirmación declarada tiene que estar en la
 *       prosa (su `texto`), con su cifra en la frase, con el sujeto de la cláusula (el lector de cláusula, en su nuevo papel: contrasta
 *       la prosa con lo declarado, no dicta veredictos) y con una métrica que la frase no contradiga. Una declaración que no se
 *       corresponde con la frase es `declaracion-inconsistente`: la puerta por la que una prosa falsa se colaría con una declaración
 *       verdadera está cerrada.
 *   2 · VEREDICTO: verificar.js sobre cada afirmación → `afirmacion-falsa` (con la verdad de la boleta al lado: la multa exacta) y
 *       `afirmacion-no-verificable` (sin evidencia, incompleta, o una lectura que encubre un hecho). Nunca verdadera por defecto.
 *   3 · OMISIONES: presencia.js sobre la prosa contra lo declarado → `afirmacion-no-declarada` («declara o quita»).
 *   4 · SIN DECLARACIÓN: una salida del cerebro sin bloque, con hechos en la prosa → `sin-declaracion`.
 * Y las MEDIDAS del turno para el expediente: cuánto se declaró, cuánto quedó sin declarar, cuántas correctas, cuántas falsas.
 * Puro: sin I/O, sin red. */
import { extraerCalculos } from "../oracle/narrationBlocks.js";   // el bloque [[CALCULO]] se saca de la prosa antes de juzgar
import { verificarAfirmaciones } from "./verificar.js";
import { omisiones, puntosDeAfirmacion } from "./presencia.js";
import { normalizarAfirmaciones, normalizar } from "./afirmacion.js";
import { leerClausula } from "../oracle/lectorDeClausula.js";
import { metricasEn } from "../oracle/guardC.js";
import { parseFigures } from "../boleta.js";
import { conceptosDe } from "./evidencia.js";
const _PUNTOS = /(\d+(?:[.,]\d+)?)\s+puntos?\b/gi;
/* las cifras de un tramo: las del canon (parseFigures) + «N puntos» (pp) + los enteros con separador de miles («1.194») como conteos */
function _cifrasDe(t) {
  const out = parseFigures(t).map((f) => ({ canon: f.canon.replace(/\$/g, ""), raw: f.raw, unit: f.unit }));
  let m; _PUNTOS.lastIndex = 0;
  while ((m = _PUNTOS.exec(t))) { const raw = parseFloat(m[1].replace(",", ".")); out.push({ canon: `pp:${raw}pp`, raw, unit: "pp" }); }
  /* la moneda sin símbolo («330K», «34.5M»): dinero con su escala */
  for (const mk of t.matchAll(/(?<![\d.,$%\w-])([+-]?\d+(?:[.,]\d+)?)\s?([KMB])(?![a-záéíóúñ0-9])/g)) { const r = parseFloat(mk[1].replace(",", ".")) * ({ K: 1e3, M: 1e6, B: 1e9 })[mk[2].toUpperCase()]; out.push({ canon: `money:${mk[1].replace("+", "")}${mk[2].toUpperCase()}`, raw: r, unit: "money" }); }
  for (const mm of t.matchAll(/(?<![\d.,$])(\d{1,3}(?:\.\d{3})+|\d+)(?![\d.,]*\s*(?:%|pp|d\b|x\b|[KMB]\b))/g)) { const raw = parseInt(mm[1].replace(/\./g, ""), 10); out.push({ canon: `count:${raw}`, raw, unit: "count" }); }
  return out;
}

const FACTUALES = new Set(["cifra", "orden", "relacion", "grupo", "conteo", "variacion", "estado"]);
const _dec = (s) => s.replace(/(\d),(\d)/g, "$1.$2");

/* _ubicar(prosaN, textoN) → posición del fragmento declarado en la prosa normalizada (entero, o por su cabeza/cola de 30) */
function _ubicar(prosaN, textoN) {
  if (!textoN) return -1;
  let i = prosaN.indexOf(textoN);
  if (i >= 0) return i;
  if (textoN.length > 30) { i = prosaN.indexOf(textoN.slice(0, 30)); if (i >= 0) return i; const j = prosaN.indexOf(textoN.slice(-30)); if (j >= 0) return Math.max(0, j - (textoN.length - 30)); }
  return -1;
}

/** consistencia(prosa, afirmaciones, {nombres}) → [{id, motivo, texto}] · lo declarado contra lo escrito */
const _VERBO_DIRECCION = /\b(?:crec|ca(?:e|en|y)|sub(?:e|en|i)|baj(?:a|an|ó|aron|ando)|deterior|mejor|empeor|retroced|avanz|aument|disminu|descend|desplom|repunt|pierde|gana)/i;
export function consistencia(prosa, afirmaciones, { nombres = [] } = {}) {
  const s = String(prosa || "");
  const sN = _dec(normalizar(s));
  const out = [];
  const norm = normalizarAfirmaciones(afirmaciones);
  for (const { afirmacion: a } of norm) {
    if (!a.texto) continue;
    const tN = _dec(normalizar(a.texto));
    const pos = _ubicar(sN, tN);
    if (pos < 0) { out.push({ id: a.id, motivo: `declaracion-ajena: el fragmento «${a.texto.slice(0, 60)}» no está en la respuesta`, texto: a.texto }); continue; }
    if (!FACTUALES.has(a.tipo)) continue;
    /* la oración de la prosa donde cae el fragmento (sobre el texto original, por posición aproximada) */
    const posOrig = Math.min(s.length - 1, Math.round(pos * (s.length / Math.max(1, sN.length))));
    const ini = Math.max(s.lastIndexOf(". ", posOrig), s.lastIndexOf("\n", posOrig), 0);
    let fin = s.indexOf(". ", posOrig + Math.max(1, a.texto.length)); if (fin < 0) fin = s.length;
    const oracion = s.slice(ini, fin);
    /* (a) la cifra declarada tiene que estar en la frase (misma cifra: el canon), si la frase trae cifras */
    const valores = [a.valor, a.variacion && a.variacion.valor, a.relacion && a.relacion.valor].filter((v) => v && v.canon);
    if (valores.length) {
      const cifras = [..._cifrasDe(oracion), ..._cifrasDe(a.texto)];
      const enFrase = new Set(cifras.map((f) => f.canon));
      for (const v of valores) {
        const c = String(v.canon).replace(/\$/g, "");
        const mismoRaw = cifras.some((f) => Number.isFinite(v.raw) && Math.abs(f.raw - v.raw) < 1e-9 && (f.unit === v.unidad || (/^(?:pct|pp)$/.test(f.unit) && /^(?:pct|pp)$/.test(v.unidad)) || f.unit === "count" || v.unidad === "count"));
        if (enFrase.size && !enFrase.has(c) && !mismoRaw) out.push({ id: a.id, motivo: `declaracion-inconsistente: declaraste ${v.texto} y la frase «${a.texto.slice(0, 60)}» no la trae`, texto: a.texto });
      }
    }
    /* (b) el sujeto de la cláusula no puede ser OTRA entidad del tenant que la declarada */
    const sujetoDecl = typeof a.sujeto === "string" && a.sujeto !== "negocio" ? normalizar(a.sujeto) : null;
    if (sujetoDecl && nombres.length) {
      let c = null;
      try { c = leerClausula(oracion, Math.max(0, Math.min(oracion.length - 1, posOrig - ini)), { nombres }); } catch { c = null; }
      const sujetoClausula = c && c.sujeto && c.sujeto.nombre ? normalizar(c.sujeto.nombre) : null;
      const anterior = s.slice(Math.max(0, ini - 220), ini);
      const nombradoEnTexto = normalizar(a.texto).includes(sujetoDecl) || normalizar(oracion).includes(sujetoDecl) || normalizar(anterior).includes(sujetoDecl);
      const comparacion = /\bcontra\b|\bvs\.?(?![a-z])|\bfrente a\b|\bque\s+(?:el|la|los|las)\b|\bversus\b/i.test(oracion) && parseFigures(oracion).length >= 2;
      if (sujetoClausula && sujetoClausula !== sujetoDecl && !nombradoEnTexto && !comparacion && !sujetoDecl.includes(sujetoClausula) && !sujetoClausula.includes(sujetoDecl)) {
        out.push({ id: a.id, motivo: `declaracion-inconsistente: la frase habla de ${c.sujeto.nombre} y la declaración dice ${a.sujeto}`, texto: a.texto });
      }
    }
    /* (c) la métrica: si el fragmento nombra métricas de la boleta, la declarada tiene que ser una de ellas (o una emparentada:
     * ventas ~ unidades vendidas, capital ~ frenado/stock/cobertura, contribución ~ brecha ~ margen) */
    if (a.metrica) {
      const conDinero = parseFigures(a.texto).some((f) => f.unit === "money");
      const todas = [...metricasEn(a.texto)];
      const enFrase = todas.filter((k) => k !== "participacion" && k !== "variacion" && !(k === "recuperado" && conDinero));   // «recuperas $22K» es el idioma comercial (ver _METRIC_VOCAB)
      if (enFrase.length) {
        const decl = new Set([...metricasEn(a.metrica), ...conceptosDe(a.metrica).flatMap((c) => [...metricasEn(c)])].filter((k) => k !== "participacion"));
        const familia = (k) => (/^unidades/.test(k) || k === "ventas" || k === "sinventa" ? "venta" : /capital|frenado|cobertura|rotacion/.test(k) ? "capital" : /contribucion|brecha|margen|markup|costo|carga/.test(k) ? "margen" : /vencido|pendiente|abonado|recuperado|diasvencido/.test(k) ? "cobranza" : k);
        const enOracion = [...metricasEn(oracion)];   // «la supera solo en contribución» declara también lo que el «solo» niega: las métricas que la misma oración enumera
        const cruza = decl.size === 0 || enFrase.some((k) => decl.has(k)) || enFrase.some((k) => [...decl].some((d) => familia(k) === familia(d))) || (todas.includes("variacion") && decl.has("ventas")) || enOracion.some((k) => decl.has(k)) || ((decl.has("variacion") || decl.has("ventas")) && _VERBO_DIRECCION.test(a.texto));   // «el crecimiento» es el de la venta · «el que más cae» es una variación aunque la frase nombre otra métrica
        if (!cruza) out.push({ id: a.id, motivo: `declaracion-inconsistente: la frase «${a.texto.slice(0, 60)}» habla de ${enFrase.join("/")} y la declaración dice «${a.metrica}»`, texto: a.texto });
      }
    }
  }
  return out;
}
/** juzgarDeclaracion(prosa, afirmaciones, ctx) → { ok, violations: [{kind, detail, texto}], veredictos, omisiones, medidas }
 *  ctx: { indice | figs+datoProyectado+ejesDelTenant, nombres: [entidades del tenant], sitio, derivada: bool } */
export function juzgarDeclaracion(prosa, afirmaciones, ctx = {}) {
  /* el bloque [[CALCULO]] es una declaración para el muro, no prosa: no se le buscan afirmaciones (sus resultados autorizados llegan en ctx.calculos) */
  const s = extraerCalculos(String(prosa || "")).limpio;
  const violations = [];
  const nombres = Array.isArray(ctx.nombres) ? ctx.nombres : [];
  const puntos = puntosDeAfirmacion(s);
  const afirmados = puntos.filter((p) => !p.negado).length;
  /* 4 · sin declaración: solo cuenta si la prosa afirma algo */
  if (afirmaciones == null) {
    const medidas = { declaradas: 0, factuales: 0, verdaderas: 0, falsas: 0, noVerificables: 0, selladas: 0, inconsistentes: 0, puntos: afirmados, cubiertos: 0, omitidos: afirmados, sinDeclaracion: true };
    if (!afirmados) return { ok: true, violations: [], veredictos: [], omisiones: [], medidas };
    violations.push({ kind: "sin-declaracion", detail: `sin-declaracion: tu respuesta afirma hechos (${afirmados} cifras, órdenes o relaciones) y no trae el bloque <<AFIRMACIONES>> … <<FIN>>: declara cada afirmación de hecho con su tipo, sujeto, métrica, valor/orden, universo y período, y su fragmento literal.`, texto: "" });
    return { ok: false, violations, veredictos: [], omisiones: [], medidas };
  }
  /* 1 · consistencia (lo derivado de las figs por el propio peldaño no se contrasta consigo mismo) */
  const incons = ctx.derivada ? [] : consistencia(s, afirmaciones, { nombres });
  for (const x of incons) violations.push({ kind: /ajena/.test(x.motivo) ? "declaracion-ajena" : "declaracion-inconsistente", detail: x.motivo, texto: x.texto, id: x.id });
  /* 2 · veredictos */
  const { veredictos, resumen } = verificarAfirmaciones(afirmaciones, { ...(ctx.indice ? { indice: ctx.indice } : { figs: ctx.figs, datoProyectado: ctx.datoProyectado, ejesDelTenant: ctx.ejesDelTenant }), calculos: Array.isArray(ctx.calculos) ? ctx.calculos : [] });
  for (const v of veredictos) {
    if (v.veredicto === "falsa") violations.push({ kind: "afirmacion-falsa", detail: `afirmacion-falsa: declaraste «${v.texto.slice(0, 70)}» (${_resumenDe(v, afirmaciones)}) y es FALSA: ${v.motivo}${v.verdad ? ` · La boleta: ${v.verdad}` : ""}. Corrige esa frase con la cifra o el orden de la boleta, o quítala.`, texto: v.texto, id: v.id });
    else if (v.veredicto === "no-verificable") violations.push({ kind: /lectura-encubre-hecho/.test(v.motivo) ? "lectura-encubre-hecho" : "afirmacion-no-verificable", detail: /lectura-encubre-hecho/.test(v.motivo) ? `${v.motivo}.` : `afirmacion-no-verificable: «${v.texto.slice(0, 70)}» no se puede verificar: ${v.motivo}. Sin evidencia en tus resultados no se sirve: quítala, o dila como lectura con sello y sin la cifra ni el orden.`, texto: v.texto, id: v.id });
  }
  /* 3 · omisiones */
  const O = omisiones(s, afirmaciones);
  for (const o of O.omisiones) violations.push({ kind: "afirmacion-no-declarada", detail: `afirmacion-no-declarada: «${o.span}» ${o.clase.startsWith("hecho-como-lectura") ? "está declarado solo como lectura y es un hecho" : o.clase.startsWith("significado") ? `es ${o.clase.split(":")[1]} y no está declarado como tal` : "no está declarado"}: decláralo (con su tipo, sujeto, métrica, universo y período) o quítalo.`, texto: o.span, clase: o.clase });
  const medidas = {
    declaradas: veredictos.length, factuales: veredictos.filter((v) => FACTUALES.has(v.tipo)).length,
    verdaderas: resumen.verdaderas, falsas: resumen.falsas, noVerificables: resumen.noVerificables, selladas: resumen.selladas,
    inconsistentes: incons.length, puntos: O.afirmados, cubiertos: O.cubiertos, omitidos: O.omisiones.length, sinDeclaracion: false, derivada: !!ctx.derivada,
  };
  return { ok: violations.length === 0, violations, veredictos, omisiones: O.omisiones, medidas };
}

function _resumenDe(v, afirmaciones) {
  const a = (Array.isArray(afirmaciones) ? afirmaciones : []).find((x, i) => String(x.id || `a${i + 1}`) === v.id) || {};
  const s = Array.isArray(a.sujeto) ? a.sujeto.join(", ") : a.sujeto && typeof a.sujeto === "object" ? a.sujeto.descripcion : a.sujeto;
  return [v.tipo, s, a.metrica, a.valor && (typeof a.valor === "object" ? a.valor.texto : a.valor), a.orden && `orden ${a.orden.forma}${a.orden.k ? " " + a.orden.k : ""}${a.orden.vs ? " vs " + a.orden.vs : ""}`, a.universo].filter(Boolean).join(" · ");
}

/** los kinds del muro que el verificador REEMPLAZA (quedan como detectores; no dictan veredicto) */
export const CHEQUEOS_DE_HECHO = new Set([
  "cifra-no-autorizada", "cifra-de-boleta-sin-dueno", "cifra-de-dato-sin-dueno", "cifra-calculada-mal-atribuida", "calculo-no-verificable",
  "entidad-mal-atribuida", "metrica-mal-atribuida", "total-mal-atribuido", "total-sin-declarar", "total-no-reconcilia", "alcance-promovido",
  "superlativo-no-sostenido", "ranking-no-sostenido", "ranking-sin-cola", "extremo-sin-sustento", "comparacion-no-sostenida", "relacion-contradictoria",
  "estado-no-declarado", "conteo-no-autorizado", "conteo-de-lista-falso", "cifra-de-grupo-mal-repartida", "nivel-financiero-no-autorizado", "temporal-sin-variacion",
  /* del contrato del agente */
  "atributo-mal-asociado", "relacion-en-palabras-no-cierra", "subtotal-de-otro-universo", "variacion-no-medida", "cuenta-derivada-no-cierra",
]);
