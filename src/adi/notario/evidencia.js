/* === src/adi/notario/evidencia.js · EL ÍNDICE DE LA EVIDENCIA ESTRUCTURADA (Notario semántico, fase 1 · owner 2026-09-15) ═══
 * La boleta YA es evidencia estructurada: cada fig trae rótulo «Entidad · Concepto», unidad, crudo, canon, tipo (universo, período),
 * `grupo {n, entidades}` en los agregados y `cobertura`; la proyección del dato trae los rankings por eje (universo, dirección, filas),
 * los estados del inventario y los días. Este módulo no inventa un modelo de datos: indexa lo que hay para que el verificador pregunte
 * por SIGNIFICADO —«¿cuánto vale Lider en Saldo vencido?», «¿quién es el máximo de Ventas entre los 13 clientes?», «¿cuántas cuentas
 * cumplen “bajo el benchmark”?»— sin leer una línea de prosa.
 *
 * La métrica declarada se casa con el CONCEPTO del rótulo (exacto → sinónimo del catálogo → contención, la más corta → claves del muro
 * `metricasEn`), nunca al revés: «contribución» encuentra «Contribución», no «Contribución no capturada». La entidad se resuelve contra
 * los ejes del tenant (`ejesDelTenant`); «negocio» son las figs sin entidad (los totales).
 * Puro: sin I/O. */
import { parseFigures } from "../boleta.js";
import { tolCalculo } from "../oracle/calculoCatalogo.js";
import { metricasEn as _metricasDelMuro } from "../oracle/guardC.js";

/* ── EL VOCABULARIO DEL NOTARIO = el del muro + las métricas DERIVADAS que la proyección publica (fase 4, ronda 3) ──────────────────────────
 * «$9,8M sin vencer», «$9,8M vigentes», «saldo por vencer»: el muro no tiene clave para lo que debe y aún no vence, así que la cifra se leía como
 * el pendiente. La mesa de cobranza calcula `porVencerK` (saldo − vencido) y la proyección lo publica como ranking; acá se nombra. */
const _VOCABULARIO_DERIVADO = [
  { clave: "porvencer", re: /\bpor\s+vencer\b|\bsin\s+vencer\b|\bvigentes?\b|\bdentro\s+de(?:l)?\s+plazo\b|\ba[uú]n\s+no\s+vence[n]?\b|\bno\s+vencid[oa]s?\b/i },
];
export function metricasEn(texto) {
  const out = _metricasDelMuro(texto);   // un Set (el muro lo devuelve así y quien lo lee usa .has)
  const s = String(texto || "");
  for (const m of _VOCABULARIO_DERIVADO) if (m.re.test(s)) { out.add(m.clave); if (m.clave === "porvencer" && out.has("vencido") && /\bno\s+vencid/i.test(s) && !/(?<!\bno\s)\bvencid/i.test(s)) out.delete("vencido"); }
  return out;
}
import { normalizar, menosAscii } from "./afirmacion.js";

/* ── LA COMPARACIÓN DE UNA CIFRA DICHA CON UNA FIG (una sola tolerancia para el verificador y el resolutor) ──────────────────────
 * unidadCompatible: % y pp comparan entre sí («tasa»); el resto, consigo mismo.
 * mismoValor(valorDeclarado, raw, unidad, textoFig) → true si la cifra dicha es la de la boleta: dicha verbatim como la boleta la trae,
 * mismo canon (el formateador de la casa: «$10K» es $9.8K) o dentro de la tolerancia del muro (tolCalculo). Una cifra DIRECTA de la boleta
 * se dice como la boleta la trae («21.5%», no «22%» — que es la de Falabella); el redondeo a media unidad solo se admite en lo CALCULADO. */
/* un agregado que NECESITA universo declarado: un subtotal, un grupo, un «resto de» — no el promedio o el total del negocio entero */
export const necesitaUniverso = (f, sujeto = "negocio") => {
  if (/(?:^|· )total$/.test(f.conceptoNorm) || (sujeto === "negocio" && /promedio/.test(f.conceptoNorm) && !/subtotal/.test(f.conceptoNorm))) return false;   // «Saldo vencido · total», «Margen promedio»: el todo
  /* «Capital frenado · subtotal» a secas (sin «N SKU», sin grupo, sin cobertura) es el total de su categoría: no hay conjunto que declarar */
  if (/(?:^|· )subtotal$/.test(f.conceptoNorm) && !f.grupo && f.n == null && !f.cobertura) return false;
  return !!(f.grupo || f.n != null || /subtotal|resto de/.test(f.conceptoNorm) || (f.cobertura && f.cobertura.alcance && !/total|negocio|global/i.test(String(f.cobertura.alcance))));
};
/* el universo que un subtotal lleva en su propio rótulo («· subtotal · 5 cuentas materiales (de 8 bajo el benchmark)» → «5 cuentas
 * materiales (de 8 bajo el benchmark)»; «de los grandes» → «los grandes») */
export const universoDeFig = (f) => String(f.calificador || "").replace(/^[\s·]*(?:subtotal|promedio)?[\s·]*/i, "").replace(/^de\s+/, "").trim() || (f.grupo && f.grupo.n ? `${f.grupo.n} ${f.eje || "entidades"}` : "");
const _COMPAT = { pct: "tasa", pp: "tasa", money: "money", days: "days", ratio: "ratio", count: "count" };
export const unidadCompatible = (x) => _COMPAT[x || "count"] || x;
export function mismoValor(v, raw, unidad, textoFig = "") {
  /* la identidad verbatim: dicha EXACTAMENTE como la boleta la trae, es la de la boleta (una serie del pack imprime «$22.560» para 22 560
   * y el canon del punto la leería como 22,56) */
  if (textoFig && v && v.texto && menosAscii(String(v.texto)).trim() === menosAscii(String(textoFig)).trim()) return true;
  if (!v || !Number.isFinite(v.raw) || !Number.isFinite(raw)) return false;
  const ud = v.unidad || "count", uf = unidad || "count";
  if (unidadCompatible(ud) !== unidadCompatible(uf)) return false;
  /* una magnitud sin signo en la boleta («2.0pp» del supuesto de carga, que el emisor publica sin dirección) es la cifra dicha con el signo del
   * usuario («-2pp»): en pp y % se compara el valor absoluto cuando la fig no trae signo */
  if ((uf === "pp" || uf === "pct") && v.raw < 0 && raw > 0 && textoFig && !/^\s*[-+−]/.test(String(textoFig)) && Math.abs(Math.abs(v.raw) - raw) <= tolCalculo(raw, uf)) return true;
  if (uf === "money" || uf === "days" || uf === "ratio") {
    const c = parseFigures(uf === "money" ? `$${raw}` : uf === "days" ? `${raw}d` : `${raw}x`);
    if (c.length && v.canon && c[0].canon.replace(/\$/g, "") === String(v.canon).replace(/\$/g, "")) return true;
  }
  /* una cifra DIRECTA se dice como la boleta la trae: la cifra dicha, redondeada a SU precisión, tiene que ser el valor de la boleta («$1,57M» y
   * «$1,6M» valen para 1.572.313; «$19,7M» por $19.4M y «21,7%» por 21.5% no), y no puede ser más gruesa que el texto de la boleta («22%» por
   * 21.5%, «$0,7M» por $655K). La tolerancia de cálculo queda para lo CALCULADO (sumas, participaciones, derivadas), que no pasa por acá. */
  if (uf === "count") return v.raw === raw;
  const pv = _precisionDe(v.texto), pf = textoFig ? _precisionDe(textoFig) : null;
  if (pv != null) {
    /* más gruesa que la boleta solo si vale EXACTAMENTE lo impreso («5 puntos» por «5.0 pp», «24%» por «24.0%» — nunca «22%» por «21.5%») */
    if (pf != null && pv > pf * 1.0001) { const vf = _valorTexto(textoFig, uf); return vf != null && Math.abs(vf - v.raw) <= 1e-9; }
    /* a su propia precisión, la cifra dicha es un redondeo válido del valor (media unidad: «+7,5%» y «+7,6%» valen para 7.55) */
    return Math.abs(raw - v.raw) <= pv / 2 + pv * 1e-6 + 1e-9;
  }
  return Math.abs(v.raw - raw) <= tolCalculo(raw, uf);
}
/* el valor numérico de un texto de cifra en las unidades de la fig («5.0 pp» → 5; «$1.6M» → 1.600.000; «24.0%» → 24) */
function _valorTexto(texto, unidad) {
  const t = menosAscii(String(texto || "")).trim().replace(/(\d)[.,](\d{3})(?!\d)/g, "$1$2");
  const m = /(-?\d+(?:[.,]\d+)?)\s*([KMB])?/i.exec(t);
  if (!m) return null;
  const n = parseFloat(m[1].replace(",", "."));
  const esc = m[2] ? { K: 1e3, M: 1e6, B: 1e9 }[m[2].toUpperCase()] : 1;
  void unidad;
  return n * esc;
}
/* la precisión ABSOLUTA con que está escrita una cifra: (10^−decimales) × escala («21.5%» → 0.1; «$1.6M» → 100.000; «$655K» → 1.000; «269d» → 1;
 * «$22.560» —miles con punto— → 1) */
function _precisionDe(texto) {
  const t = menosAscii(String(texto || "")).trim().replace(/(\d)[.,](\d{3})(?!\d)/g, "$1$2");
  const m = /-?\d+(?:[.,](\d+))?\s*([KMB])?/i.exec(t);
  if (!m) return null;
  const dec = (m[1] || "").length;
  const esc = m[2] ? { K: 1e3, M: 1e6, B: 1e9 }[m[2].toUpperCase()] : 1;
  return Math.pow(10, -dec) * esc;
}

/* SINÓNIMOS · lo que el modelo (o quien etiqueta) puede escribir como métrica → los conceptos del rótulo que la nombran, en orden de
 * preferencia. Se casan por igualdad normalizada; el resto de la casación es genérica (ver conceptosDe). */
export const SINONIMOS = [
  /* «venta (flujo)»/«venta a crédito» SIGUEN como sinónimo de «ventas» acá a propósito (owner 2026-09-24 —
   * medido con `_ronda5_gate`: un negocio 100 % a crédito, como el demo, tiene el MISMO número en «Ventas
   * totales» y en «Venta del período (flujo)», y un genérico «¿cuánto vendí?» sigue aceptando cualquiera de
   * las dos figs cuando UNA SOLA existe). Lo que cambió no es esta lista: es que PRI-04 (medir.js) YA NO
   * pide la métrica «ventas» — pide la clave separada `venta_credito` (la entrada de abajo), así que un
   * cliente con las DOS figs (venta comercial y venta a crédito distintas, ej. mayormente al contado) nunca
   * más diluye su participación de cobranza mezclando la comercial — ver la carnada «Contado» en
   * `_piso_materialidad_gate.mjs` §15. */
  [/^(?:ventas?|facturaci[oó]n|venta\s+comercial|venta\s+del\s+per[ií]odo|ventas\s+del\s+per[ií]odo)$/i, ["venta", "ventas", "ventas del periodo", "ventas totales", "venta (flujo)", "venta del periodo (flujo)"]],
  /* «caja ≠ cobranza» (owner 2026-09-24): la venta A CRÉDITO es también su propio concepto — quien pida
   * explícitamente «Venta a crédito» (PRI-04, vía `venta_credito`) la encuentra por nombre exacto, sin
   * depender de que la comercial esté ausente (la entrada de arriba solo la ofrece como ÚLTIMO recurso). */
  [/^(?:venta\s+a\s+cr[eé]dito(?:\s+del\s+per[ií]odo)?|venta\s*\(flujo\)|venta\s+del\s+per[ií]odo\s*\(flujo\))$/i, ["venta (flujo)", "venta a credito", "venta a credito del periodo", "venta del periodo (flujo)"]],
  [/^ventas?\s+del\s+a[ñn]o\s+(?:anterior|pasado)$|^venta\s+(?:del\s+)?a[ñn]o\s+(?:anterior|pasado)$|^base\s+del\s+a[ñn]o\s+anterior$/i, ["ventas del ano anterior"]],   // la base del crecimiento, con fila propia
  [/^(?:saldo\s+)?vencidos?$|^(?:deuda\s+)?(?:en\s+)?mora$|^saldo\s+en\s+mora$|^deuda\s+vencida$/i, ["saldo vencido"]],
  [/^(?:saldo\s+)?pendientes?$|^por\s+cobrar$|^deuda$|^saldo$/i, ["saldo pendiente"]],
  /* lo que debe y aún no vence (la mesa lo calcula: saldo − vencido); «vigente» y «sin vencer» son sus nombres en la prosa */
  [/^(?:saldo\s+|deuda\s+|monto\s+)?(?:por\s+vencer|sin\s+vencer|vigentes?|no\s+vencid[oa]s?|dentro\s+de(?:l)?\s+plazo|a[uú]n\s+no\s+vencid[oa]s?)$/i, ["saldo por vencer"]],
  [/^d[ií]as?\s+(?:de\s+)?(?:atraso|mora|retraso|vencid[oa]s?)$|^atraso$|^dias?\s+vencido$/i, ["dias vencido"]],
  [/^recuperaci[oó]n$|^recuperad[oa]$|^cobranza\s+recuperada$|^tasa\s+de\s+recuperaci[oó]n$/i, ["recuperado"]],
  [/^abonad[oa]s?$|^abonos?$|^pagad[oa]$|^cobrad[oa]$/i, ["abonado"]],
  [/^contribuci[oó]n$|^contribuci[oó]n\s+comercial$|^ganancia$/i, ["contribucion"]],
  [/^(?:contribuci[oó]n\s+)?(?:no\s+capturada|sin\s+capturar)$/i, ["contribucion no capturada"]],
  [/^m[aá]rgen(?:es)?$|^margen\s+comercial$|^margen\s+bruto$/i, ["margen", "margen promedio"]],   // el margen del negocio es su «Margen promedio»
  [/^margen\s+promedio$|^margen\s+de\s+la\s+cartera$/i, ["margen promedio"]],
  [/^cargas?(?:\s+comercial)?$|^acciones\s+comerciales$|^rebates?$|^descuentos?$/i, ["carga comercial", "carga"]],
  /* la referencia de la carga, como la nombra la prosa («nivel de referencia», «nivel declarado», «referencia de carga») */
  [/^nivel(?:\s+de\s+(?:carga(?:\s+comercial)?|referencia))?(?:\s+(?:declarado|de\s+referencia))?$|^referencia\s+de\s+(?:la\s+)?carga$|^nivel\s+de\s+carga\s+(?:comercial\s+)?declarado$/i, ["nivel de carga declarado", "nivel de carga comercial declarado", "nivel de carga"]],
  [/^(?:carga\s+comercial\s+alta|carga\s+alta|exceso\s+de\s+carga|carga\s+excedente|carga\s+sobre\s+el\s+nivel)$/i, ["carga comercial alta"]],
  [/^brechas?(?:\s+(?:al\s+benchmark|de\s+margen|contra\s+el\s+benchmark|al\s+margen|en\s+puntos|en\s+pp))?$|^distancia\s+al\s+benchmark$|^puntos\s+bajo\s+el\s+benchmark$/i, ["brecha al benchmark"]],
  [/^brecha\s+por\s+precio\s+y\s+costo$|^precio\s+y\s+costo$|^brecha\s+de\s+precio\s+y\s+costo$/i, ["brecha por precio y costo"]],
  /* «Markup promedio · los que caen / sanos» es el agregado de «Markup sobre costo» (fase 3: cuatro veces no-verificable por el nombre) */
  [/^mark-?up(?:\s+sobre\s+costo)?$|^markup\s+promedio$|^precio\s+de\s+lista\s+sobre\s+costo$/i, ["markup sobre costo", "markup promedio"]],
  [/^peso\s+del\s+costo$|^costo$|^costos$|^cost\s*share$|^participaci[oó]n\s+del\s+costo$/i, ["peso del costo"]],
  [/^unidades(?:\s+vendidas)?$|^volumen$|^volumen\s+vendido$/i, ["unidades vendidas"]],
  [/^unidades\s+en\s+stock$|^stock\s+en\s+unidades$|^unidades\s+en\s+inventario$/i, ["unidades en stock"]],
  [/^capital(?:\s+en\s+inventario)?$|^valor\s+de\s+inventario$|^stock$|^inventario$|^capital\s+total$/i, ["capital", "valor de inventario", "stock", "capital en inventario"]],
  /* el owner (2026-08-15): «capital inmovilizado = categoría amplia (todo lo no activo); frenado = estado crítico DENTRO de inmovilizado». Dos
   * conceptos: la ronda adversarial sirvió «capital inmovilizado $33K» (el frenado) cuando la proyección trae «Capital inmovilizado · subtotal · 5 SKU» */
  [/^capital\s+frenado$|^frenado$/i, ["capital frenado"]],
  [/^capital\s+(?:detenido|inmovilizado|parado|bloqueado|estancado)$|^inmovilizado$|^parado$|^detenido$/i, ["capital inmovilizado"]],
  [/^rotaci[oó]n$/i, ["rotacion"]],
  [/^d[ií]as\s+(?:de\s+)?inventario$|^cobertura(?:\s+\(doh\))?$|^doh$/i, ["dias de inventario", "cobertura (doh)"]],
  [/^d[ií]as\s+sin\s+venta$/i, ["dias sin venta"]],
  [/^(?:variaci[oó]n|crecimiento|yoy|variaci[oó]n\s+vs\s+a[ñn]o\s+anterior|variaci[oó]n\s+de\s+(?:la\s+)?ventas?|crecimiento\s+de\s+(?:la\s+)?ventas?)$/i, ["variacion vs ano anterior", "crecimiento", "ventas vs ano anterior"]],
  [/^(?:yoy|yoy\s+en\s+dinero|variaci[oó]n\s+en\s+dinero|variaci[oó]n\s+en\s+\$|variaci[oó]n\s+vs\s+a[ñn]o\s+anterior\s+en\s+\$|d[oó]lares\s+nuevos)$/i, ["yoy", "variacion vs ano anterior en $"]],
  /* contra el PLAN, con el mismo estándar que contra el año anterior: la brecha en dinero por cliente («vs ppto» es la destacada y «Variación vs
   * presupuesto en $» la fila del panel: la misma cifra) y la variación de la venta del negocio contra el plan (la cabecera) */
  [/^(?:vs\s+ppto|vs\s+presupuesto|variaci[oó]n\s+vs\s+presupuesto\s+en\s+\$|brecha\s+(?:al|contra\s+el)\s+presupuesto(?:\s+en\s+\$)?|(?:sobre|contra|bajo)\s+el\s+plan(?:\s+en\s+\$)?)$/i, ["vs ppto", "variacion vs presupuesto en $"]],
  [/^(?:variaci[oó]n\s+vs\s+presupuesto|variaci[oó]n\s+contra\s+el\s+presupuesto|ventas?\s+vs\s+presupuesto|crecimiento\s+vs\s+presupuesto)$/i, ["variacion vs presupuesto", "ventas vs presupuesto"]],
  [/^(?:participaci[oó]n|%\s+del\s+total|peso|porcentaje\s+del\s+total|participaci[oó]n\s+en\s+el\s+total)$/i, ["% del total"]],
  [/^(?:benchmark|benchmark\s+de\s+margen|referencia|referencia\s+de\s+margen|objetivo\s+de\s+margen)$/i, ["benchmark de margen", "piso de margen"]],
  [/^(?:nivel\s+de\s+carga(?:\s+comercial)?(?:\s+declarado)?|carga\s+declarada|referencia\s+de\s+carga)$/i, ["nivel de carga comercial declarado"]],
  [/^valor\s+en\s+juego$/i, ["valor en juego"]],
];

/* los rankings de la proyección, por concepto (normalizado) → clave del ranking en cada eje */
export const CLAVES_DE_RANKING = {
  /* «ventas» del RANKING (no del léxico de figs) sigue aceptando «venta (flujo)» a propósito: el criterio de
   * prioridad `ordenPorCriterio(..., "ventas")` (prioridadIntegrada.js) cae a la venta del flujo de cobranza
   * cuando cubre más clientes que la comercial —para ORDENAR, nunca para PRI-04 (que usa la clave separada
   * `venta_credito`, con su propio bloque de SINONIMOS arriba)— y el Notario necesita reconocer esa métrica
   * declarada contra el ranking proyectado (que cubre el eje ENTERO) para no marcar «universo-incompleto»
   * cuando la boleta del turno trae menos filas de cobranza que clientes tiene el negocio (tope de 8 filas de
   * `herramientasAgente.js:cobranza()`). owner 2026-09-24: no tocar esto es parte de «cero cálculo de las
   * piezas cambia salvo la base de PRI-04» — este ranking no es una pieza, y revertirlo evita una regresión. */
  cliente: { ventas: ["venta", "ventas", "venta (flujo)"], margen: ["margen"], contribucion: ["contribucion"], carga: ["carga comercial", "carga"], unidades: ["unidades vendidas", "unidades"], brecha: ["brecha al benchmark", "brecha"], no_capturada: ["contribucion no capturada"], saldo_vencido: ["saldo vencido"], saldo_por_vencer: ["saldo por vencer"], recuperado: ["recuperado"], dias_vencido: ["dias vencido"], saldo_pendiente: ["saldo pendiente"] },
  marca: { ventas: ["venta", "ventas"], margen: ["margen"], contribucion: ["contribucion"], carga: ["carga comercial", "carga"] },
  sku: { ventas: ["venta", "ventas"], contribucion: ["contribucion"], capital: ["capital", "valor de inventario", "stock", "capital en inventario"], capital_inmovilizado: ["capital inmovilizado"], capital_frenado: ["capital frenado"], rotacion: ["rotacion"], dias_inventario: ["dias de inventario", "cobertura (doh)"], dias_sin_venta: ["dias sin venta"], margen_inventario: ["margen de inventario"] },
  bodega: { capital: ["capital", "capital en inventario"], capital_frenado: ["capital frenado"], capital_inmovilizado: ["capital inmovilizado"] },
};

/* los estados de la casa (inventario Y cobranza) viven en estados.js — una sola fuente para presencia, juez, verificador y resolutor */
export { ESTADOS, estadoCanon } from "./estados.js";

const _NEGOCIO_FIG = /^(?:el\s+negocio|negocio|total|cartera|global)$/i;
/* un mes, como lo rotula el cuadro «el año mes a mes» (abreviado o entero) */
const _MES_RE = /^(?:ene(?:ro)?|feb(?:rero)?|mar(?:zo)?|abr(?:il)?|may(?:o)?|jun(?:io)?|jul(?:io)?|ago(?:sto)?|sep(?:t(?:iembre)?)?|oct(?:ubre)?|nov(?:iembre)?|dic(?:iembre)?)(?:\s+\d{4})?$/i;
/* qué palabras de un universo/descripción NO distinguen nada (se descartan al casar con el rótulo) */
const _VACIAS = new Set(["de", "del", "la", "las", "el", "los", "un", "una", "y", "o", "en", "con", "que", "a", "al", "por", "para", "su", "sus", "es", "son", "ese", "esa", "esos", "esas", "este", "esta", "estos", "estas", "cuentas", "clientes", "cuenta", "cliente", "sku", "skus", "bodegas", "bodega", "marcas", "marca", "entre", "solo", "sólo", "todas", "todos", "toda", "todo", "grupo", "conjunto"]);
export const tokens = (t) => normalizar(t).replace(/[()·,;:%$]/g, " ").split(/\s+/).filter((w) => w && !_VACIAS.has(w) && !/^\d+$/.test(w));
export const numerosEn = (t) => (String(t || "").match(/(?<![A-Za-z\d-])\d+(?:[.,]\d+)?(?![A-Za-z\d])/g) || []).map((x) => parseFloat(x.replace(",", ".")));   // «LG-DRYER8KG» no trae un 8

/* las palabras que dicen «el todo» en un universo declarado (un subtotal narrado así es alcance promovido) */
export const ES_TODO = /\b(?:total(?:es)?|totalidad|negocio|cartera|global|todos?(?:\s+los|\s+las)?|todas?|entera?|completa?|los\s+13|las\s+13|13\s+clientes|13\s+cuentas|el\s+conjunto|en\s+(?:su\s+)?conjunto|sumad[oa]s|entre\s+tod[oa]s|tod[oa]s\s+junt[oa]s|nadie\s+se\s+salva|ning[uú]n[ao]?\s+se\s+salva|no\s+hay\s+(?:cuenta|cliente|sku|marca)\s+que\s+se\s+salve)\b(?!\s+(?:bajo|sobre|con|que|de|en)\b)/i;
/* los números EN PALABRAS de un universo o de un fragmento («los trece clientes», «las seis que cargan de más») pasan a dígitos antes de leer
 * conjuntos: «los 13 clientes» */
const _NUMS_EN_PALABRAS = { un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, veinte: 20, treinta: 30 };
/* el todo dicho con fuerza («la totalidad de las cuentas», «en conjunto, los clientes», «sumadas», «entre todos», «nadie se salva»): vale aunque
 * siga «de» (ES_TODO frena «total de <conjunto>») */
export const ES_TODO_FUERTE = /\b(?:totalidad|en\s+(?:su\s+)?conjunto|sumad[oa]s|entre\s+tod[oa]s|tod[oa]s\s+junt[oa]s|nadie\s+se\s+salva|ning[uú]n[ao]?\s+se\s+salva|no\s+hay\s+(?:cuenta|cliente|sku|marca)\s+que\s+se\s+salve)\b/i;
export const conDigitos = (t) => String(t || "").replace(/\b(un|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|veinte|treinta)\b(?=\s+(?:cuentas?|clientes?|skus?|marcas?|familias?|bodegas?|canales?|que\b|m[aá]s\b|de\s+(?:las|los|ellas|ellos)\b))/gi, (m) => String(_NUMS_EN_PALABRAS[m.toLowerCase()] ?? m));

/** conceptosDe(metrica) → los conceptos normalizados que la nombran, en orden de preferencia (vacío si no hay sinónimo: se casa genérico) */
export function conceptosDe(metrica) {
  const m = String(metrica || "").trim();
  for (const [re, lista] of SINONIMOS) if (re.test(m)) return lista;
  return [];
}

/** indiceDeEvidencia({figs, datoProyectado, ejesDelTenant}) → el índice con el que pregunta verificar.js */
export function indiceDeEvidencia({ figs = [], datoProyectado = null, ejesDelTenant = null } = {}) {
  /* ── las entidades del tenant ── */
  const entidades = new Map();   // normalizado → {nombre, eje}
  const porEje = ejesDelTenant && typeof ejesDelTenant === "object" ? ejesDelTenant : {};
  for (const [eje, lista] of Object.entries(porEje)) for (const n of lista || []) { const k = normalizar(n); if (!entidades.has(k)) entidades.set(k, { nombre: String(n), eje }); }
  /* …y las que la boleta nombra aunque el índice de ejes no las traiga (familias, bodegas del demo) */
  const _agregarDeRotulo = (nombre, eje) => { const k = normalizar(nombre); if (k && !entidades.has(k)) entidades.set(k, { nombre, eje: eje || null }); };
  const resolverEntidad = (nombre) => {
    if (nombre == null) return null;
    if (typeof nombre === "object") return null;
    const k0 = normalizar(nombre);
    if (!k0) return null;
    if (entidades.has(k0)) return entidades.get(k0);   // «La Polar» entera, antes de quitar el artículo
    const k = k0.replace(/^(?:el|la|los|las)\s+/, "");
    if (entidades.has(k)) return entidades.get(k);
    /* sin tilde, sin puntuación (Valparaiso · «Mercado libre» · «lider») */
    const k2 = k.replace(/[^a-z0-9 ]/g, "");
    for (const [kk, v] of entidades) if (kk.replace(/[^a-z0-9 ]/g, "") === k2) return v;
    /* un nombre PARCIAL que identifica a UNA sola entidad: «Polar» por La Polar, «MercadoLibre» / «ML» por Mercado Libre; dos candidatas = ninguna */
    /* solo entidades de un EJE del tenant (no los rótulos de la boleta) y solo palabras («2026», «julio», «total» no nombran a nadie) */
    if (k2 && !/\s/.test(k2) && /[a-z]/.test(k2) && !/^(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre|total|totales|negocio|cartera|subtotal)$/.test(k2)) {
      const cands = [];
      for (const [kk, v] of entidades) { if (!v.eje) continue; const palabras = kk.replace(/[^a-z0-9 ]/g, "").split(/\s+/).filter(Boolean); if (palabras.length >= 2 && ((k2.length >= 4 && palabras.includes(k2)) || palabras.join("") === k2 || palabras.map((w) => w[0]).join("") === k2)) cands.push(v); }
      if (cands.length === 1) return cands[0];
    }
    return null;
  };

  /* ── las figs, leídas por significado ── */
  const F = [];
  /* LA QUINTA FUENTE CON SIGNIFICADO: los KPIs del negocio de la proyección (lo que el cerebro lee en su mapa) entran como figs del negocio
   * cuando la boleta no trae ese concepto — «Ventas totales $100.0M» vale por lo que es, no por el valor y un dueño vago */
  const _kpis = datoProyectado && Array.isArray(datoProyectado.kpis) ? datoProyectado.kpis : [];
  const _conceptosBoleta = new Set(figs.filter((g) => g && g.label && !/\s·\s/.test(String(g.label))).map((g) => normalizar(String(g.label))));
  const figsConKpis = [...figs, ..._kpis.filter((k) => k && k.label && !_conceptosBoleta.has(normalizar(k.label)))];
  for (const fig of figsConKpis) {
    if (!fig || !fig.label) continue;
    const label = String(fig.label);
    const partes = label.split(/\s+·\s+/);
    let entidad = null, eje = null, concepto = label;
    const t = fig.tipo || {};
    const ent0 = partes.length > 1 ? resolverEntidad(partes[0]) : null;
    if (ent0) { entidad = ent0.nombre; eje = ent0.eje; concepto = partes.slice(1).join(" · "); }
    else if (partes.length > 1 && t.entidad && t.dimension && !(porEje[t.dimension] && porEje[t.dimension].length) && normalizar(t.entidad) === normalizar(partes[0])) {
      /* una entidad de un eje SIN catálogo (familia, bodega) que el clasificador de la fig sí trae; con catálogo, lo que no está en él no es una
       * entidad («Supuesto · movimiento de carga», «Liberado · total», «Medida · cerrar brecha» vienen con dimension=cliente y no son clientes) */
      entidad = String(t.entidad); eje = t.dimension || null; concepto = partes.slice(1).join(" · "); _agregarDeRotulo(entidad, eje);
    }
    else if (partes.length > 1 && /^(?:el\s+)?negocio$/i.test(partes[0])) { entidad = null; concepto = partes.slice(1).join(" · "); }
    /* las cabeceras del panel de ventas viajan con nombre de campo («headline», «headlineSub») y su significado en `context` */
    else if (/^headline(?:Sub)?$/.test(label) && fig.context) { entidad = null; concepto = label === "headline" ? (/presupuesto/i.test(fig.context) ? "Variación vs presupuesto" : "Variación vs año anterior") : "Ventas del período"; }
    /* «El año mes a mes · Nov · margen» → el MES es la entidad (eje «mes») y el concepto es «<cuadro> · margen»: doce filas por campo, y un
     * orden entre meses («el mejor del año») se verifica como cualquier ranking ad hoc */
    if (!entidad && partes.length === 3 && _MES_RE.test(partes[1])) { entidad = partes[1]; eje = "mes"; concepto = partes[0] + " · " + partes[2]; _agregarDeRotulo(entidad, "mes"); }
    /* «Materiales de Construcción · Familia» → la familia es la entidad y el concepto es el capital de la familia */
    if (!entidad && partes.length === 2 && /^familia$/i.test(partes[1])) { entidad = partes[0]; eje = "familia"; concepto = "capital"; _agregarDeRotulo(entidad, "familia"); }
    let raw = Number.isFinite(+fig.raw) && fig.raw !== "" && fig.raw != null ? +fig.raw : NaN;
    let unidad = fig.unit || null;
    /* EL CRUDO Y SU RECONSTRUCCIÓN, DISTINGUIDOS (owner 2026-09-23 — arreglo del verificador). `crudo` es la
     * bandera: true cuando `raw` es el valor que el motor calculó; false cuando ninguna fig.raw existía y este
     * fallback reparseó `fig.value` —el TEXTO ya redondeado para mostrar, p. ej. «$12.6M»— como si fuera el
     * dato. Reconstruir así es LEGÍTIMO para comprobar que un texto repite lo que la pantalla muestra (`raw`
     * sigue sirviendo para eso, `mismoValor` no cambia); es ILEGÍTIMO usarlo como operando exacto de una cuenta
     * nueva (una razón, una derivada) — ahí un redondeo se haría pasar por un dato, y `raw` solo no alcanza para
     * distinguir los dos usos. `hechos.js` (`_razon`/`_derivada`) lee esta bandera antes de dividir o sumar: sin
     * crudo, el hecho sale «no verificable: falta el valor crudo», nunca un cociente calculado sobre el texto. */
    let crudo = Number.isFinite(raw);
    if (!Number.isFinite(raw)) { const p = parseFigures(menosAscii(String(fig.value || ""))); if (p.length) { raw = p[0].raw; unidad = unidad || p[0].unit; } else if (/^-?\d+$/.test(String(fig.value || "").trim())) { raw = parseInt(fig.value, 10); unidad = unidad || "count"; } }
    /* «5.0 pp» viene con unit «pct» en alguna fig: la unidad del canon manda */
    if (unidad === "pct" && /\bpp\b/.test(String(fig.value || ""))) unidad = "pp";
    const conceptoNorm = normalizar(concepto);
    const grupo = fig.grupo && typeof fig.grupo === "object" ? { n: Number.isFinite(+fig.grupo.n) ? +fig.grupo.n : null, entidades: Array.isArray(fig.grupo.entidades) ? fig.grupo.entidades.map(String) : [] } : null;
    const cobertura = fig.cobertura && typeof fig.cobertura === "object" ? fig.cobertura : null;
    const agregado = !!grupo || !!cobertura || /\b(?:subtotal|total|promedio)\b|\(\d+\s+de\s+\d+\)|\b\d+\s+cuentas\b/i.test(concepto) || /^peso en la venta/i.test(conceptoNorm) || /^resto de/i.test(conceptoNorm);
    /* el concepto «base» del agregado: «Contribución no capturada · subtotal · 5 cuentas materiales (…)» → «contribucion no capturada»;
     * «Contribución de los grandes» → «contribucion»; «Markup promedio · los que caen» → «markup promedio»; «Resto de Contribución (3 de 13)» → «contribucion» */
    let base = conceptoNorm.split(" · ")[0].replace(/\s*\(.*\)\s*$/, "").trim();
    base = base.replace(/^resto de\s+/, "").replace(/\s+(?:de los grandes|del resto|de los que caen|de los sanos|sanos|los que caen)$/, "").trim();
    const calificador = conceptoNorm.slice(base.length).trim();
    const universoTexto = [calificador, fig.context ? String(fig.context) : ""].filter(Boolean).join(" · ");
    const entidadesDelGrupo = grupo ? grupo.entidades : [];
    const n = grupo && grupo.n != null ? grupo.n : cobertura && Number.isFinite(+cobertura.n) ? +cobertura.n : (() => { const m = /(\d+)\s+(?:cuentas|clientes|sku|skus)/i.exec(concepto) || /\((\d+)\s+de\s+\d+\)/.exec(concepto); return m ? +m[1] : null; })();
    const m = cobertura && Number.isFinite(+cobertura.m) ? +cobertura.m : (() => { const mm = /\(\s*de\s+(\d+)\b/i.exec(concepto) || /\(\d+\s+de\s+(\d+)\)/.exec(concepto); return mm ? +mm[1] : null; })();
    F.push({ fig, label, entidad, eje, concepto, conceptoNorm, base, calificador, universoTexto, raw, crudo, unidad, canon: String(fig.canon || "").replace(/\$/g, ""), texto: menosAscii(String(fig.value ?? fig.text ?? "")).trim(), agregado, grupo, cobertura, n, m, entidadesDelGrupo, periodo: t.periodo || "", universo: t.universoEtiqueta || t.universo || "", claves: metricasEn(concepto), source: fig.source || "", formula: fig.formula || "", context: fig.context || "" });
  }

  /* ── la casación de la métrica declarada con el concepto de la fig ── */
  const _casa = (metrica, f) => {
    const m = normalizar(metrica);
    if (!m) return 0;
    const c = f.base || f.conceptoNorm;
    if (c === m || f.conceptoNorm === m) return 4;
    const sin = conceptosDe(metrica);
    if (sin.length) { const i = sin.indexOf(c); if (i >= 0) return 3.5 - i * 0.01; if (sin.includes(f.conceptoNorm)) return 3.4; }
    /* un concepto de la casa NUNCA casa con OTRO concepto de la casa por contención: «carga comercial» (la tasa) no es «carga comercial alta» (el
     * exceso en $), «contribución» no es «contribución no capturada», «capital» no es «capital frenado» (ronda adversarial 2026-09-16) */
    if (sin.length) { const otro = conceptosDe(c); if (otro.length && !otro.some((x) => sin.includes(x))) return 0; }
    /* contención: «vencido» dentro de «saldo vencido»; se prefiere el concepto más corto (ver buscarFigs) */
    if (m.length >= 4 && c.includes(m)) return 2;   // «vencido» está en «saldo vencido»; lo declarado MÁS específico que el rótulo («capital frenado» vs «capital») no casa
    /* último recurso: el mismo vocabulario del muro */
    const km = metricasEn(metrica);
    if (km.size && f.claves.size && [...km].every((k) => f.claves.has(k)) && [...f.claves].every((k) => km.has(k))) return 1;
    return 0;
  };
  /* buscarFigs(sujeto, metrica) → las figs de ese sujeto con esa métrica, mejor casación primero (y el concepto más corto antes) */
  const buscarFigs = (sujeto, metrica, { agregados = false } = {}) => {
    const ent = sujeto === "negocio" || sujeto == null ? null : (typeof sujeto === "string" ? resolverEntidad(sujeto) : null);
    const cands = [];
    for (const f of F) {
      if (sujeto === "negocio") { if (f.entidad) continue; if (!agregados && f.agregado && !/total/.test(f.conceptoNorm)) continue; }
      else if (ent) { if (!f.entidad || normalizar(f.entidad) !== normalizar(ent.nombre)) continue; }
      else if (agregados) { if (f.entidad || !f.agregado) continue; }
      else continue;
      const s = _casa(metrica, f);
      if (s > 0) cands.push({ f, s });
    }
    /* A IGUAL CASACIÓN, GANA EL CRUDO (owner 2026-09-23 — arreglo del verificador): entre dos figs que casan
     * igual de bien con la métrica pedida —p. ej. «Lider · Venta (flujo)» (cobranza, `raw` genuino) y «Lider ·
     * Venta» (auto-enriquecida por `enrichFromFacts`, sin `raw`)—, la que SÍ trae el dato del motor gana sobre
     * la que este índice tuvo que reconstruir desde el texto. Antes el desempate era solo «el concepto más
     * corto», y «Venta» (5) le ganaba a «Venta (flujo)» (13) aunque la primera no tuviera crudo: una razón
     * quedaba dividiendo por un redondeo pudiendo dividir por el dato real. */
    cands.sort((a, b) => b.s - a.s || (a.f.crudo === false) - (b.f.crudo === false) || a.f.conceptoNorm.length - b.f.conceptoNorm.length);
    /* solo la mejor capa: exacto y sinónimos van juntos (4 · 3.5 · 3.4); la contención (2) y las claves del muro (1) solo si no hay nada mejor */
    const top = cands.length ? cands[0].s : 0;
    return cands.filter((c) => c.s >= top - 0.6).map((c) => c.f);
  };
  /* figsDeMetrica(metrica, eje) → todas las figs con entidad de un eje para esa métrica (para rankings ad hoc y grupos) */
  const figsDeMetrica = (metrica, eje = null) => {
    const out = [];
    for (const f of F) { if (!f.entidad || f.agregado) continue; if (eje && f.eje && f.eje !== eje) continue; const s = _casa(metrica, f); if (s > 0) out.push({ f, s }); }
    const top = out.length ? Math.max(...out.map((x) => x.s)) : 0;
    return out.filter((x) => x.s === top).map((x) => x.f);
  };

  /* ── los rankings de la proyección ── */
  const rankings = datoProyectado && datoProyectado.rankings ? datoProyectado.rankings : {};
  const rankingDe = (eje, metrica) => {
    const R = rankings[eje] || {};
    const m = normalizar(metrica);
    const sin = conceptosDe(metrica);
    const tabla = CLAVES_DE_RANKING[eje] || {};
    for (const [clave, nombres] of Object.entries(tabla)) if (R[clave] && (nombres.includes(m) || sin.some((s) => nombres.includes(s)))) return { clave, r: R[clave] };
    for (const [clave, r] of Object.entries(R)) if (Array.isArray(r.terminos) && r.terminos.some((t) => { try { return new RegExp(`^(?:${t})$`, "i").test(m) || sin.some((s) => new RegExp(`^(?:${t})$`, "i").test(s)); } catch { return false; } })) return { clave, r };
    return null;
  };
  const tamanoDelEje = (eje) => (porEje[eje] || []).length || null;
  const estados = datoProyectado && Array.isArray(datoProyectado.estados) ? datoProyectado.estados : [];
  const estadosDe = (entidad) => { const e = resolverEntidad(entidad); const k = normalizar(e ? e.nombre : entidad); return estados.filter((x) => normalizar(x.entidad) === k); };
  const dias = datoProyectado && datoProyectado.dias ? datoProyectado.dias : {};

  /* los conjuntos OFICIALES de la proyección («carga comercial alta» = el detector): una definición por métrica/eje */
  const conjuntos = datoProyectado && datoProyectado.conjuntos && typeof datoProyectado.conjuntos === "object" ? datoProyectado.conjuntos : {};
  return { entidades, resolverEntidad, figs: F, buscarFigs, figsDeMetrica, rankingDe, rankings, conjuntos, tamanoDelEje, estados, estadosDe, dias, casa: _casa };
}
