/* === src/adi/notario/lexico.js · EL LÉXICO DE LA CASA COMO DATOS (verdad finita · etapa E0 · owner 2026-09-17) ═══════════════════
 * «La prosa puede ser infinita; la verdad de ADI debe ser finita, gobernada y verificable.» Este archivo es la parte FINITA que se puede
 * escribir como tabla: las claves de métrica que el modelo usa para identificar un hecho (en vez de describirlo con palabras), a qué
 * concepto de la boleta corresponde cada una, de qué dominio es, qué polaridad tiene (más es mejor / más es peor) y con qué claves del
 * vocabulario del muro se nombra en la prosa. Nada acá es una regla de sintaxis: son datos que consumen el libro de hechos (hechos.js) y,
 * en la etapa E2, las comprobaciones de las anclas.
 * Puro: sin I/O, sin red. */
import { normalizar } from "./afirmacion.js";
import { conceptosDe } from "./evidencia.js";

/* polaridad: «mayor» = más es mejor (margen, venta, rotación) · «menor» = más es peor (vencido, brecha, días sin venta) · null = sin polaridad
 * (capital, stock, participación) · «referencia» = un umbral de la POLICY o del negocio (benchmark, nivel de carga, piso de rotación) */
export const CLAVES_DE_METRICA = [
  /* ── comercial ── */
  { clave: "ventas", nombre: "Venta", conceptos: ["venta", "ventas", "ventas del periodo", "venta del periodo", "ventas totales", "vende", "venden", "vendio", "vendiste", "vendieron", "te compro", "te compraron", "le vendiste", "les vendiste", "facturado", "facturaste"], dominio: "comercial", polaridad: "mayor", unidad: "money", muro: ["ventas"] },
  { clave: "ventas_anterior", nombre: "Ventas del año anterior", conceptos: ["ventas del ano anterior"], dominio: "comercial", polaridad: null, unidad: "money", muro: ["ventas"] },
  { clave: "margen", nombre: "Margen", conceptos: ["margen"], dominio: "comercial", polaridad: "mayor", unidad: "pct", muro: ["margen"], tasa: true },
  { clave: "margen_promedio", nombre: "Margen promedio", conceptos: ["margen promedio"], dominio: "comercial", polaridad: "mayor", unidad: "pct", muro: ["margen"], tasa: true, negocio: true },
  { clave: "contribucion", nombre: "Contribución", conceptos: ["contribucion", "contribucion total"], dominio: "comercial", polaridad: "mayor", unidad: "money", muro: ["contribucion"] },
  { clave: "no_capturada", nombre: "Contribución no capturada", conceptos: ["contribucion no capturada", "sin capturar", "no capturada", "valor en juego", "contribucion en juego"], dominio: "comercial", polaridad: "menor", unidad: "money", muro: ["contribucion"] },
  { clave: "carga", nombre: "Carga comercial", conceptos: ["carga comercial", "carga"], dominio: "comercial", polaridad: "menor", unidad: "pct", muro: ["carga"], tasa: true },
  { clave: "carga_alta", nombre: "Carga comercial alta", conceptos: ["carga comercial alta"], dominio: "comercial", polaridad: "menor", unidad: "money", muro: ["carga"] },
  { clave: "brecha", nombre: "Brecha al benchmark", conceptos: ["brecha al benchmark"], dominio: "comercial", polaridad: "menor", unidad: "pp", muro: ["brecha"] },
  { clave: "brecha_precio_costo", nombre: "Brecha por precio y costo", conceptos: ["brecha por precio y costo"], dominio: "comercial", polaridad: "menor", unidad: "money", muro: ["brecha"] },
  { clave: "unidades", nombre: "Unidades vendidas", conceptos: ["unidades vendidas"], dominio: "comercial", polaridad: "mayor", unidad: "count", muro: ["unidades_vendidas", "unidades"] },
  { clave: "markup", nombre: "Markup sobre costo", conceptos: ["markup sobre costo", "markup promedio"], dominio: "comercial", polaridad: "mayor", unidad: "pct", muro: ["markup"], tasa: true },
  { clave: "peso_costo", nombre: "Peso del costo", conceptos: ["peso del costo"], dominio: "comercial", polaridad: "menor", unidad: "pct", muro: ["costo"], tasa: true },
  { clave: "costo", nombre: "Costo", conceptos: ["costo"], dominio: "comercial", polaridad: null, unidad: "money", muro: ["costo"] },
  { clave: "variacion", nombre: "Variación vs año anterior", conceptos: ["variacion vs ano anterior", "crecimiento", "ventas vs ano anterior"], dominio: "comercial", polaridad: "mayor", unidad: "pct", muro: ["variacion", "crecen", "caen"], tasa: true, periodo: "anterior" },
  { clave: "variacion_usd", nombre: "Variación vs año anterior en $", conceptos: ["variacion vs ano anterior en $", "yoy"], dominio: "comercial", polaridad: "mayor", unidad: "money", muro: ["variacion", "crecen", "caen"], periodo: "anterior" },
  { clave: "vs_presupuesto", nombre: "Variación vs presupuesto", conceptos: ["variacion vs presupuesto", "ventas vs presupuesto"], dominio: "comercial", polaridad: "mayor", unidad: "pct", muro: ["variacion"], tasa: true, periodo: "presupuesto" },
  { clave: "vs_presupuesto_usd", nombre: "Variación vs presupuesto en $", conceptos: ["vs ppto", "variacion vs presupuesto en $"], dominio: "comercial", polaridad: "mayor", unidad: "money", muro: ["variacion"], periodo: "presupuesto" },
  { clave: "participacion", nombre: "Participación", conceptos: ["% del total", "participacion", "peso en la venta", "participacion en la venta"], dominio: null, polaridad: null, unidad: "pct", muro: ["participacion"], tasa: true },
  /* ── referencias (umbrales del negocio y de la POLICY): sin dueño, sin polaridad; se citan, se comparan, no se ordenan ── */
  { clave: "benchmark", nombre: "Benchmark de margen", conceptos: ["benchmark de margen", "piso de margen"], dominio: "comercial", polaridad: "referencia", unidad: "pct", muro: ["margen"], referencia: true },
  { clave: "nivel_carga", nombre: "Nivel de carga declarado", conceptos: ["nivel de carga comercial declarado", "nivel de carga declarado", "nivel de carga"], dominio: "comercial", polaridad: "referencia", unidad: "pct", muro: ["carga"], referencia: true },
  { clave: "umbral_materialidad", nombre: "Umbral de materialidad", conceptos: ["umbral de materialidad"], dominio: "comercial", polaridad: "referencia", unidad: "pct", muro: [], referencia: true },
  { clave: "piso_rotacion", nombre: "Piso de rotación", conceptos: ["piso de rotacion"], dominio: "inventario", polaridad: "referencia", unidad: "ratio", muro: ["rotacion"], referencia: true },
  { clave: "techo_cobertura", nombre: "Techo de cobertura", conceptos: ["techo de cobertura", "techo de dias de inventario"], dominio: "inventario", polaridad: "referencia", unidad: "days", muro: ["cobertura"], referencia: true },
  /* ── cobranza ── */
  /* «caja ≠ cobranza» (owner 2026-09-24, ADI_CAJA_NO_ES_COBRANZA): la venta A CRÉDITO del flujo de cobranza —
   * «Venta a crédito» (planilla) / «Venta (flujo)» (demo) — es una clave DISTINTA de la venta comercial total
   * («ventas», arriba): solo la venta a crédito genera exposición de cobranza; la venta de contado no. */
  { clave: "venta_credito", nombre: "Venta a crédito", conceptos: ["venta a credito", "venta a credito del periodo", "venta (flujo)", "venta del periodo (flujo)"], dominio: "cobranza", polaridad: "mayor", unidad: "money", muro: ["ventas"] },
  { clave: "saldo_vencido", nombre: "Saldo vencido", conceptos: ["saldo vencido", "deuda vencida", "deuda en mora", "monto vencido"], dominio: "cobranza", polaridad: "menor", unidad: "money", muro: ["vencido"] },
  { clave: "saldo_pendiente", nombre: "Saldo pendiente", conceptos: ["saldo pendiente", "deuda", "deuda total", "por cobrar", "sin cobrar", "saldo por cobrar", "pendiente de cobro", "debe", "te debe", "le debe", "deben", "te deben", "adeuda", "adeudan", "lo que te debe", "lo que debe"], dominio: "cobranza", polaridad: "menor", unidad: "money", muro: ["pendiente"] },
  { clave: "saldo_por_vencer", nombre: "Saldo por vencer", conceptos: ["saldo por vencer"], dominio: "cobranza", polaridad: null, unidad: "money", muro: ["porvencer"] },
  { clave: "abonado", nombre: "Abonado", conceptos: ["abonado"], dominio: "cobranza", polaridad: "mayor", unidad: "money", muro: ["abonado"] },
  { clave: "recuperado", nombre: "Recuperado", conceptos: ["recuperado"], dominio: "cobranza", polaridad: "mayor", unidad: "pct", muro: ["recuperado"], tasa: true },
  { clave: "dias_vencido", nombre: "Días vencido", conceptos: ["dias vencido"], dominio: "cobranza", polaridad: "menor", unidad: "days", muro: ["diasvencido", "vencido"] },   // «269 días de mora», «lleva 269 días vencido»
  /* ── inventario ── */
  { clave: "capital", nombre: "Capital", conceptos: ["capital", "valor de inventario", "stock", "capital en inventario", "inventario"], dominio: "inventario", polaridad: null, unidad: "money", muro: ["capital"] },
  { clave: "capital_frenado", nombre: "Capital frenado", conceptos: ["capital frenado"], dominio: "inventario", polaridad: "menor", unidad: "money", muro: ["frenado", "capital"] },
  { clave: "capital_inmovilizado", nombre: "Capital inmovilizado", conceptos: ["capital inmovilizado"], dominio: "inventario", polaridad: "menor", unidad: "money", muro: ["capital"] },
  { clave: "rotacion", nombre: "Rotación", conceptos: ["rotacion"], dominio: "inventario", polaridad: "mayor", unidad: "ratio", muro: ["rotacion"] },
  { clave: "dias_inventario", nombre: "Días de inventario", conceptos: ["dias de inventario", "cobertura", "cobertura (doh)"], dominio: "inventario", polaridad: "menor", unidad: "days", muro: ["cobertura"] },
  { clave: "dias_sin_venta", nombre: "Días sin venta", conceptos: ["dias sin venta", "antiguedad", "tiempo sin vender", "sin moverse", "dias sin moverse", "sin vender", "sin rotar", "sin rotacion", "sin movimiento", "dias sin rotar", "sin venta", "sin ventas"], dominio: "inventario", polaridad: "menor", unidad: "days", muro: ["sinventa"] },
  { clave: "unidades_stock", nombre: "Unidades en stock", conceptos: ["unidades en stock", "unidades de stock", "stock en unidades"], dominio: "inventario", polaridad: null, unidad: "count", muro: ["unidades_stock"] },
  { clave: "margen_inventario", nombre: "Margen de inventario", conceptos: ["margen de inventario"], dominio: "inventario", polaridad: "mayor", unidad: "pct", muro: ["margen"], tasa: true },
];
const _porClave = new Map(CLAVES_DE_METRICA.map((m) => [m.clave, m]));
export const claves = () => CLAVES_DE_METRICA.map((m) => m.clave);
export const metricaPorClave = (clave) => _porClave.get(normalizar(clave).replace(/\s+/g, "_")) || null;
/** metricaDeClave(clave) → el nombre con que la verificación busca la fig («saldo_vencido» → «Saldo vencido»); una métrica escrita con
 *  palabras (no una clave) vuelve tal cual: la casación por sinónimos de la evidencia sigue valiendo como tolerancia */
export function metricaDeClave(clave) {
  if (clave == null) return "";
  const m = metricaPorClave(clave);
  return m ? m.nombre : String(clave).trim();
}
/** claveDeMetrica(texto) → la clave de una métrica dicha con palabras («Saldo vencido», «deuda vencida», «Venta (flujo)») o null */
export function claveDeMetrica(texto) {
  if (texto == null) return null;
  const s = normalizar(String(texto)).replace(/\s*\(.*?\)\s*$/, "").trim();
  if (!s) return null;
  const directa = _porClave.get(s.replace(/\s+/g, "_"));
  if (directa) return directa.clave;
  for (const m of CLAVES_DE_METRICA) if (m.conceptos.includes(s)) return m.clave;
  /* el concepto MÁS LARGO que casa decide («capital frenado · total» → capital_frenado, no capital) */
  const sin = conceptosDe(String(texto)).slice().sort((a, b) => b.length - a.length);
  for (const c of sin) for (const m of CLAVES_DE_METRICA) if (m.conceptos.includes(c)) return m.clave;
  let mejor = null;
  const _enPalabra = (c) => new RegExp("(?<![a-záéíóúñ])" + c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?![a-záéíóúñ])").test(s);   // por palabra: «inventario» no contiene «venta»
  for (const m of CLAVES_DE_METRICA) for (const c of m.conceptos) if (c.length >= 4 && _enPalabra(c) && (!mejor || c.length > mejor.c.length)) mejor = { m, c };
  return mejor ? mejor.m.clave : null;
}
export const dominioDeClave = (clave) => { const m = metricaPorClave(clave); return m ? m.dominio : null; };
export const polaridadDeClave = (clave) => { const m = metricaPorClave(clave); return m ? m.polaridad : null; };
export const unidadDeClave = (clave) => { const m = metricaPorClave(clave); return m ? m.unidad : null; };
export const esReferencia = (clave) => { const m = metricaPorClave(clave); return !!(m && m.referencia); };
/** clavesDelMuro(clave) → las claves del vocabulario del muro con que la prosa nombra esa métrica */
export const clavesDelMuro = (clave) => { const m = metricaPorClave(clave); return m ? m.muro.slice() : []; };
/** clavesPorPalabraDelMuro(claveDelMuro) → las claves de métrica que esa palabra del muro puede nombrar («vencido» → saldo_vencido) */
export function clavesPorPalabraDelMuro(k) { return CLAVES_DE_METRICA.filter((m) => m.muro.includes(k)).map((m) => m.clave); }

/* ── los dominios de la casa y cómo se nombran en la prosa (para la comprobación de predicación por dominio, etapa E2) ── */
export const DOMINIOS = ["comercial", "cobranza", "inventario"];

/* ── unidades de tiempo en días (los umbrales dichos en meses o trimestres se convierten con esta tabla, nunca se leen de la prosa) ── */
export const UNIDADES_DE_TIEMPO = { dia: 1, dias: 1, semana: 7, semanas: 7, quincena: 15, quincenas: 15, mes: 30, meses: 30, bimestre: 60, bimestres: 60, trimestre: 90, trimestres: 90, cuatrimestre: 120, cuatrimestres: 120, semestre: 180, semestres: 180, ano: 365, anio: 365, anos: 365, anios: 365 };
export const diasDe = (valor, unidad) => { const u = UNIDADES_DE_TIEMPO[normalizar(unidad || "").replace(/ñ/g, "n")]; return Number.isFinite(+valor) && u ? +valor * u : null; };

/* ── períodos con que un hecho puede ir fechado (un enum, no una frase) ── */
export const PERIODOS = ["actual", "anterior", "presupuesto", "corte"];
export const periodoDe = (p) => {
  const s = normalizar(p);
  if (!s) return "";
  if (PERIODOS.includes(s)) return s;
  if (/anterior|pasado|previo|yoy|interanual/.test(s)) return "anterior";
  if (/presupuesto|ppto|plan\b/.test(s)) return "presupuesto";
  if (/corte|hoy|foto|a la fecha/.test(s)) return "corte";
  if (/actual|periodo|ano cerrado|anual/.test(s)) return "actual";
  return s;   // lo que no es del enum sigue faltando (la normalización lo cobra)
};

/* ── los ejes del tenant y sus nombres en plural (para nombrar universos) ── */
export const EJES = ["cliente", "sku", "marca", "familia", "bodega", "canal", "mes"];
export const PLURAL_DE_EJE = { cliente: "clientes", sku: "SKU", marca: "marcas", familia: "familias", bodega: "bodegas", canal: "canales", mes: "meses" };
export const ARTICULO_DE_EJE = { cliente: "los", sku: "los", marca: "las", familia: "las", bodega: "las", canal: "los", mes: "los" };

/* ── operadores de comparación de un filtro tipado ── */
export const OPS = [">", ">=", "<", "<=", "==", "entre"];
export const opDe = (op) => { const s = String(op || "").trim().toLowerCase(); if (OPS.includes(s)) return s; if (/^(?:mas|más|mayor|superior|sobre|encima)$/.test(s)) return ">"; if (/^(?:menos|menor|inferior|bajo|debajo)$/.test(s)) return "<"; if (/^(?:al menos|desde|>=|≥)$/.test(s)) return ">="; if (/^(?:hasta|<=|≤)$/.test(s)) return "<="; if (/^(?:=|igual)$/.test(s)) return "=="; return null; };

/* ═══ EL LÉXICO DE LAS ANCLAS (etapa E2) ═══════════════════════════════════════════════════════════════════════════════════════════
 * Clases CERRADAS del idioma (no crecen): números, símbolos, ordinales, comparativos y superlativos, proformas de continuación, operadores de
 * alcance. Vocabulario DE LA CASA (crece con sinónimos, como datos): estados (estados.js), métricas (arriba), adjetivos y verbos con que se habla
 * de una métrica, palabras de cada dominio. Ninguna de estas listas atribuye dueños ni lee sintaxis: solo dicen «esto es léxico de hecho». */
const _L = "[a-záéíóúñ]";
export const NUMEROS_EN_PALABRAS = { medio: 0.5, media: 0.5, decena: 10, docena: 12, cero: 0, un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19, veinte: 20, veintiuno: 21, veintidos: 22, veinticinco: 25, treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90, cien: 100, ciento: 100, doscientos: 200, trescientos: 300, quinientos: 500, mil: 1000, millon: 1e6, millones: 1e6 };
export const FRACCIONES_EN_PALABRAS = { mitad: 0.5, tercio: 1 / 3, cuarto: 0.25, quinto: 0.2, "tres cuartos": 0.75, "dos tercios": 2 / 3, doble: 2, triple: 3, cuadruple: 4 };
export const NUMERO_PALABRA_SRC = "(?:" + Object.keys(NUMEROS_EN_PALABRAS).join("|") + ")";
/* unidades y sustantivos de la casa que hacen de un número (en palabras o en cifras) un HECHO: «tres cuentas», «dos millones», «ocho por ciento» */
export const UNIDADES_DE_HECHO_SRC = "(?:millones?|mil|por\\s+ciento|puntos?(?:\\s+porcentuales)?|pp|d[ií]as?|semanas?|meses|mes|trimestres?|semestres?|a[ñn]os?|cuentas?|clientes?|skus?|sku|bodegas?|marcas?|familias?|unidades?|facturas?|productos?|docenas?|decenas?|veintenas?|centenas?|veces|x|%|\\$|k|m)";
/* ordinales: solo son hecho junto a algo de la casa («la segunda cuenta», «el tercer SKU», «va segundo en venta») */
export const ORDINAL_SRC = "(?:viene\\s+despu[eé]s|va\\s+despu[eé]s|le\\s+sigue|lo\\s+sigue|la\\s+sigue|primer[oa]?s?|segund[oa]s?|tercer[oa]?s?|cuart[oa]s?|quint[oa]s?|sext[oa]s?|s[eé]ptim[oa]s?|octav[oa]s?|noven[oa]s?|d[eé]cim[oa]s?|[uú]ltim[oa]s?|pen[uú]ltim[oa]s?|\\d{1,2}\\.?[ºª°])";
/* comparativos y superlativos (clase cerrada del idioma; con adjetivo/verbo de la casa o con entidad son hecho) */
export const ADJETIVOS_DE_LA_CASA_SRC = "(?:alt[oa]s?|baj[oa]s?|grandes?|chic[oa]s?|peque[ñn][oa]s?|pesad[oa]s?|car[oa]s?|barat[oa]s?|r[aá]pid[oa]s?|lent[oa]s?|viej[oa]s?|antigu[oa]s?|nuev[oa]s?|atrasad[oa]s?|vencid[oa]s?|san[oa]s?|rentables?|delgad[oa]s?|fuertes?|d[eé]biles?|expuest[oa]s?|apalancad[oa]s?|moros[oa]s?|larg[oa]s?|cort[oa]s?|cercan[oa]s?|lejan[oa]s?|concentrad[oa]s?|fren[ao]d[oa]s?|crític[oa]s?)";
export const VERBOS_DE_LA_CASA_SRC = "(?:vend[eióa]" + _L + "*|factur" + _L + "+|deb[eéií]" + _L + "*|adeud" + _L + "+|pag[aóo]" + _L + "*|abon[aóo]" + _L + "*|cobr[aóo]" + _L + "*|recuper" + _L + "+|rot[aóo]" + _L + "*|crec[eií]" + _L + "*|ca[eíy]" + _L + "*|sub[eií]" + _L + "*|baj[aóo]" + _L + "*|fren[aóo]" + _L + "*|concentr" + _L + "+|aport" + _L + "+|dej[aóo]" + _L + "*|pes[aóo]" + _L + "*|margin" + _L + "+|contribuy" + _L + "+|compr[aóo]" + _L + "*|gan[aóo]" + _L + "*|pierd" + _L + "+|acumul" + _L + "+|arrastr" + _L + "+|lidera" + _L + "*|encabez" + _L + "+|super" + _L + "+|domin" + _L + "+|expon" + _L + "+|inmoviliz" + _L + "+|mueve" + _L + "*|agot" + _L + "+)";
export const SUPERLATIVO_SRC = "(?:(?:el|la|los|las)\\s+[a-záéíóúñ]+\\s+con\\s+(?:m[aá]s|menos)\\b|(?:el|la)\\s+de\\s+(?:mayor|menor)\\s+[a-záéíóúñ]+|quien(?:es)?\\s+m[aá]s\\s+[a-záéíóúñ]+|(?:lo\\s+)?completan?\\s+el\\s+podio|antes\\s+que\\s+(?:con\\s+)?nadie|primero\\s+que\\s+nadie|(?:la\\s+cuenta|el\\s+cliente|el\\s+sku|la\\s+marca|la\\s+bodega)\\s+m[aá]s\\s+(?:importante|relevante|grande|pesad[oa])|(?:cedi[oó]|perdi[oó]|tom[oó])\\s+(?:la\\s+punta|el\\s+mando|el\\s+liderazgo)|(?:el|la|los|las|lo|quien(?:es)?)\\s+(?:\\d{1,2}\\s+)?(?:(?:clientes?|skus?|marcas?|familias?|bodegas?|canales?|cuentas?|productos?)\\s+)?que\\s+(?:m[aá]s|menos)|(?:el|la|los|las|tu|tus|su|sus|mi|mis|nuestr[oa]s?)\\s+(?:mayor(?:es)?|menor(?:es)?|peor(?:es)?|mejor(?:es)?|m[aá]s|menos|principal(?:es)?|primer[oa]?s?|[uú]ltim[oa]s?)\\b|n[uú]mero\\s+uno|donde\\s+(?:hay\\s+)?m[aá]s\\b|donde\\s+menos\\b|nadie\\s+le\\s+(?:gana|hace\\s+sombra)|le\\s+pisa\\s+los\\s+talones|\\btop\\s*\\d*|lidera" + _L + "*|encabeza" + _L + "*|a\\s+la\\s+cabeza|en\\s+cabeza|a\\s+la\\s+zaga|cierra\\s+la\\s+(?:tabla|lista)|completa\\s+el\\s+podio|puntero|dominante)";
export const COMPARATIVO_SRC = "(?:algo\\s+m[aá]s|algo\\s+menos|un\\s+poco\\s+m[aá]s|un\\s+poco\\s+menos|ligeramente\\s+m[aá]s|ligeramente\\s+menos|bastante\\s+m[aá]s|bastante\\s+menos|rebasa" + _L + "*|deja" + _L + "*\\s+atr[aá]s|se\\s+impone" + _L + "*\\s+a|aventaja" + _L + "*|m[aá]s\\s+[a-záéíóúñ]+\\s+que|menos\\s+[a-záéíóúñ]+\\s+que|m[aá]s\\s+del\\s+(?:doble|triple)|(?:casi|apenas|justo)\\s+el\\s+(?:doble|triple)|m[aá]s\\s+(?:que|de)|menos\\s+(?:que|de)|mayor(?:es)?\\s+(?:que|a)|menor(?:es)?\\s+(?:que|a)|peor(?:es)?\\s+que|mejor(?:es)?\\s+que|por\\s+(?:encima|debajo|sobre)\\s+de|(?:muy\\s+)?por\\s+(?:arriba|abajo)\\s+de|supera" + _L + "*|excede" + _L + "*|duplica" + _L + "*|triplica" + _L + "*|dobla" + _L + "*|iguala" + _L + "*|empata" + _L + "*|el\\s+doble|el\\s+triple|la\\s+mitad|un\\s+tercio|un\\s+cuarto|\\d+(?:[.,]\\d+)?\\s*(?:veces|x)\\b|(?:dos|tres|cuatro|cinco|diez)\\s+veces|parecid[oa]s?|similar(?:es)?|a\\s+la\\s+par|casi\\s+(?:igual|lo\\s+mismo)|igual\\s+que|tanto\\s+como|lejos\\s+de|cerca\\s+de|(?:no\\s+)?(?:alcanza|llega)\\s+a\\s+cubrir|(?:no\\s+)?cubre|se\\s+queda\\s+cort[oa]|a\\s+la\\s+zaga|le\\s+saca\\s+ventaja|viene\\s+detr[aá]s|le\\s+sigue|seguid[oa]\\s+(?:de|por))";
export const VARIACION_SRC = "(?:cada\\s+vez\\s+(?:m[aá]s|menos)|crec[eií]" + _L + "*|(?<!(?:que|quienes)\\s)ca[eíy]" + _L + "*|sub[eií]" + _L + "*|baj[aó]" + _L + "*|bajo(?!\\s+(?:el|la|los|las|del|de|un|una|su|sus|tu|tus|ese|esa|este|esta|esos|esas)\\b)|aument" + _L + "+|disminu" + _L + "+|retroced" + _L + "+|avanz" + _L + "+|repunt" + _L + "+|se\\s+dispar" + _L + "+|se\\s+desplom" + _L + "+|se\\s+hund" + _L + "+|merm" + _L + "+|afloj" + _L + "+|se\\s+enfr[ií]" + _L + "+|en\\s+picada|mejor[aóo]" + _L + "*|empeor" + _L + "+|deterior" + _L + "+|se\\s+contra[ej]" + _L + "*|recort" + _L + "+|expandi" + _L + "*|interanual|yoy|a[ñn]o\\s+anterior|a[ñn]o\\s+pasado)";
export const DURACION_SRC = "(?:llev[aó]" + _L + "*\\s+(?:a[ñn]os|meses|semanas)\\s+sin|desde\\s+hace|hace\\s+(?:m[aá]s\\s+de\\s+)?(?:\\d+|" + NUMERO_PALABRA_SRC + ")\\s+(?:d[ií]as?|semanas?|meses|mes|trimestres?|semestres?|a[ñn]os?)|llev[aó]" + _L + "*\\s+(?:m[aá]s\\s+de\\s+)?(?:\\d+|" + NUMERO_PALABRA_SRC + "|medio|un|una)\\s+(?:d[ií]as?|semanas?|meses|mes|trimestres?|semestres?|a[ñn]os?)|(?:medio|un|una)\\s+(?:a[ñn]o|semestre|trimestre|mes)\\s+(?:sin|de|en|atrasad))";
/* proporciones: pegadas a un hecho exigen una razón/conteo; sueltas y subjetivas («casi toda», «un puñado») son lectura (decisión del owner) */
/* las cotas de proporción de la casa (v3.1, decisión de producto 2): lo dicho en palabras se contrasta con la razón, el conteo o el grupo que lo respalda */
export const COTAS_DE_PROPORCION = [
  { re: /^(?:pr[aá]cticamente|casi)\s+tod[oa]s?$|^casi\s+(?:toda|todo)\s+(?:tu|su|la|el)\b/i, lo: 0.8, hi: 0.9999, nombre: "casi todo (≥ 80 %)" },
  { re: /^(?:la\s+)?mayor[ií]a$|^la\s+mayor\s+parte$|^el\s+grueso$|^m[aá]s\s+de\s+la\s+mitad$|^buena\s+parte$|^gran\s+parte$/i, lo: 0.5001, hi: 1, nombre: "la mayoría (> 50 %)" },
  { re: /^casi\s+la\s+mitad$/i, lo: 0.4, hi: 0.5, nombre: "casi la mitad (40–50 %)" },
  { re: /^la\s+mitad$/i, lo: 0.45, hi: 0.55, nombre: "la mitad (45–55 %)" },
  { re: /^(?:un|el)\s+tercio$|^la\s+tercera\s+parte$/i, lo: 0.28, hi: 0.38, nombre: "un tercio (28–38 %)" },
  { re: /^dos\s+tercios$/i, lo: 0.62, hi: 0.72, nombre: "dos tercios (62–72 %)" },
  { re: /^(?:un|el)\s+cuarto$|^la\s+cuarta\s+parte$/i, lo: 0.2, hi: 0.3, nombre: "un cuarto (20–30 %)" },
  { re: /^tres\s+cuartos$/i, lo: 0.7, hi: 0.8, nombre: "tres cuartos (70–80 %)" },
  { re: /^casi\s+nada$|^un\s+pu[ñn]ado$|^una\s+minor[ií]a$|^(?:muy\s+)?poc[oa]s?$/i, lo: 0, hi: 0.1, nombre: "casi nada (≤ 10 %)" },
];
export function cotaDeProporcion(texto) { const t = String(texto || "").trim().replace(/\s+/g, " "); for (const c of COTAS_DE_PROPORCION) if (c.re.test(t)) return c; return null; }
export const PROPORCION_SRC = "(?:la\\s+mayor[ií]a|la\\s+mayor\\s+parte|el\\s+grueso|casi\\s+tod[oa]s?|pr[aá]cticamente\\s+tod[oa]s?|buena\\s+parte|gran\\s+parte|la\\s+mitad|un\\s+tercio|dos\\s+tercios|un\\s+cuarto|tres\\s+cuartos|casi\\s+nada|un\\s+pu[ñn]ado|(?:muy\\s+)?poc[oa]s|(?:uno|dos|tres)\\s+de\\s+cada\\s+(?:dos|tres|cuatro|cinco|diez))";
export const PROPORCION_SUBJETIVA_SRC = "(?:casi\\s+tod[oa]s?|pr[aá]cticamente\\s+tod[oa]s?|buena\\s+parte|gran\\s+parte|el\\s+grueso|casi\\s+nada|un\\s+pu[ñn]ado|(?:muy\\s+)?poc[oa]s)";
/* proformas de continuación: heredan el predicado de al lado (por eso no pueden quedar sueltas ni vacías) */
export const PROFORMA_SRC = "(?:tambi[eé]n|tampoco|igual(?:mente)?|lo\\s+mismo|[ií]dem|asimismo|ni\\s+hablar\\s+de|otro\\s+tanto|del\\s+mismo\\s+modo|en\\s+la\\s+misma\\s+l[ií]nea|de\\s+igual\\s+forma)";
/* operadores que cambian el valor de verdad de lo que tocan: viven DENTRO del ancla o no viven */
export const NEGACION_SRC = "(?:no|ni|nunca|jam[aá]s|tampoco|nadie|nada|ning[uú]n[oa]?|lejos\\s+de|dista\\s+(?:mucho\\s+|bastante\\s+|lejos\\s+)?de|falso\\s*[:,]|es\\s+falso\\s+que|no\\s+es\\s+cierto\\s+que|ser[ií]a\\s+un\\s+error\\s+(?:pensar|creer|decir)|(?:ya\\s+)?dej[oó]\\s+de|ya\\s+no)";
export const TIEMPO_SRC = "(?:este\\s+a[ñn]o|(?:el\\s+)?(?:ejercicio|per[ií]odo|periodo|cierre)\\s+anterior|(?:el|al)\\s+pr[oó]ximo\\s+(?:mes|trimestre|a[ñn]o)|llegar[aá]\\s+a|cerrar[aá]\\s+en|antes|ya\\s+no|dej[oó]\\s+de|hasta\\s+(?:hace|el|la)|era|eran|sol[ií]a|este\\s+mes|el\\s+mes\\s+pasado|la\\s+semana\\s+pasada|el\\s+a[ñn]o\\s+pasado|el\\s+a[ñn]o\\s+anterior|el\\s+trimestre\\s+pasado|en\\s+el\\s+presupuesto|seg[uú]n\\s+el\\s+presupuesto|contra\\s+el\\s+presupuesto|vs\\.?\\s+presupuesto|(?:por\\s+encima\\s+de(?:l)?|por\\s+debajo\\s+de(?:l)?|sobre|bajo|frente\\s+a(?:l)?|respecto\\s+(?:de|a)l?)\\s+(?:el\\s+)?(?:presupuesto|ppto|plan)(?![a-záéíóúñ])|acumulado|ytd|a\\s+la\\s+fecha|al\\s+corte|hoy|ayer|en\\s+(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\\b|en\\s+20\\d\\d)";
export const MODALIDAD_SRC = "(?:(?!mercader|librer|cafeter|panader|carnicer|ferreter)[a-záéíóúñ]{2,}(?:ar|er|ir|har|dir|sabr|podr|tendr|vendr|pondr|saldr|querr|cabr|habr)[ií]a(?:n|s|mos)?|habr[ií]a|llegar[aá]n?|ser[aá]n?|estar[aá]n?|cerrar[aá]n?|quedar[aá]n?|si\\s+(?:[a-záéíóúñ0-9\\-]+\\s+){0,3}(?:fuera|fuese|estuviera|tuviera|llegara|vendiera|pagara|cobrara|subiera|bajara|creciera|cayera|debiera)|deber[ií]a|podr[ií]a|supuestamente|hipot[eé]ticamente|ser[ií]a|tendr[ií]a\\s+que|en\\s+teor[ií]a|(?:vender|comprar|cobrar|pagar|subir|bajar|crecer|caer|ganar|perder|quedar|tener|haber|hacer|dar|ir|llegar|liberar|recuperar|ampliar|mantener|cerrar|abrir|priorizar|empezar|dejar|estar|frenar|rotar|deber)[ií]a(?:n|s|mos)?)";
/* los períodos con que un marcador de tiempo casa (dentro de un ancla) */
export const PERIODO_DE_MARCADOR = [[/pr[oó]ximo|llegar[aá]|cerrar[aá]/, "futuro"], [/presupuesto|ppto|\bplan\b/, "presupuesto"], [/pasad[oa]|anterior|antes|ya no|dej[oó] de|era|sol[ií]a/, "anterior"], [/hoy|al corte|a la fecha|acumulado|ytd|este mes|actual/, "actual"]];
/* pronombres de tercera que atan un hecho a OTRA parte (un solo rol no los admite) */
export const PRONOMBRE_AJENO_SRC = "(?:le|les|de\\s+[eé]l|de\\s+ella|de\\s+ellos|de\\s+ellas)";
/* preposiciones de base: lo que sigue tiene que ser la base del hecho (con vocabulario de la casa) o {id.base} */
export const PREPOSICION_DE_BASE_SRC = "(?:sobre|de\\s+tod[oa]\\s+lo\\s+que|de\\s+lo|del|de\\s+la|de\\s+su|de\\s+sus|de\\s+(?:tu|tus|mi|mis|nuestr[oa]s?)|respecto\\s+(?:de|a|al)|en\\s+relaci[oó]n\\s+(?:a|con)|por\\s+cada|de\\s+cada)";
/* palabras de cada dominio (con las de sus métricas y estados): la predicación sobre una entidad se juzga por DOMINIO, no por palabra */
export const DOMINIO_PALABRAS = {
  cobranza: "(?:pag[oa]s?|pag" + _L + "+|cobr" + _L + "+|cobranza|mora|demora" + _L + "*|moros" + _L + "*|deud" + _L + "+|adeud" + _L + "+|vencid" + _L + "*|atras" + _L + "+|plazos?|cupos?|cr[eé]dito|abon" + _L + "+|facturas?|recuper" + _L + "+|puntual" + _L + "*|saldos?|por\\s+cobrar|calendario\\s+de\\s+pago|despach" + _L + "+)",
  inventario: "(?:stock|inventario|ubicaci[oó]n|ubicad[oa]s?|almacenad[oa]s?|bodegas?|rotaci[oó]n|rota" + _L + "*|frenad" + _L + "*|inmoviliz" + _L + "+|sobrestock|quiebre|agot" + _L + "+|mercader[ií]a|existencias|capital\\s+frenado|d[ií]as\\s+sin\\s+venta|cobertura|dormid" + _L + "+|parad" + _L + "+|reponer|liquidar|reposici[oó]n)",
  comercial: "(?:compr(?!esor)" + _L + "+|ventas?|facturaci[oó]n|m[aá]rgen(?:es)?|contribuci[oó]n|carga\\s+comercial|benchmark|precios?|costos?|descuentos?|markup|unidades\\s+vendidas|rentabilidad|presupuesto)",
};
/* modismos con «más/menos/primero» que NO son hecho (clase cerrada) */
export const MODISMOS_SRC = "(?:de\\s+mayor\\s+a\\s+menor|de\\s+menor\\s+a\\s+mayor|de\\s+m[aá]s\\s+a\\s+menos|de\\s+menos\\s+a\\s+m[aá]s|adem[aá]s|m[aá]s\\s+bien|nada\\s+m[aá]s|una\\s+vez\\s+m[aá]s|m[aá]s\\s+all[aá]|es\\s+m[aá]s|m[aá]s\\s+a[uú]n|por\\s+lo\\s+menos|al\\s+menos|a\\s+lo\\s+m[aá]s|m[aá]s\\s+tarde|m[aá]s\\s+adelante|m[aá]s\\s+temprano|de\\s+m[aá]s|en\\s+primer\\s+lugar|en\\s+segundo\\s+lugar|primero\\s+que\\s+nada|lo\\s+m[aá]s\\s+(?:importante|urgente|sano|prudente|claro|simple|razonable|sensato|delicado|relevante|cr[ií]tico)|(?:el|la)\\s+m[aá]s\\s+(?:urgente|importante|prudente|delicad[oa]|relevante|sensat[oa]|razonable))";
/* los días de una cifra que no es hecho: enumeradores, años, fechas, ids del libro */
export const NUMERO_LIBRE_SRC = "(?:(?:^|\\n)\\s*\\d{1,2}\\s*[.)·]\\s|\\b(?:19|20)\\d\\d\\b|\\b\\d{1,2}\\s+de\\s+(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\\b|\\b[hcr]\\d+[a-z]?\\b)";

/* los nombres con que la casa dice un CONJUNTO de la evidencia (el verbo de la casa «caer» = bajo el benchmark, ronda 3) */
export const SINONIMOS_DE_CONJUNTO = {
  "bajo el benchmark": ["los que caen", "las que caen", "quienes caen", "caen", "bajo la referencia", "bajo esa referencia", "bajo tu benchmark", "bajo el benchmark"],
  "carga comercial alta": ["carga comercial alta", "carga alta"],
  materiales: ["materiales", "cuentas materiales", "sobre el umbral de materialidad", "sobre el umbral"],
};
/* métricas cuyo ranking solo trae a quien tiene valor: lo ausente vale 0 (capital frenado = 0 si el SKU no está frenado); en las demás, un mínimo sobre
 * un ranking parcial no se responde */
export const AUSENTE_VALE_CERO = ["capital_frenado", "capital_inmovilizado", "no_capturada", "carga_alta", "dias_sin_venta", "saldo_vencido", "saldo_pendiente", "abonado"];
/* las métricas con que se habla de cada estado (dentro de un ancla de estado esas palabras no son «métrica ajena») */
export const METRICAS_DE_ESTADO = {
  "al dia": ["saldo_vencido", "dias_vencido"], "en mora": ["saldo_vencido", "dias_vencido"], "sin deuda": ["saldo_pendiente", "saldo_vencido"], "sin pagos": ["abonado", "recuperado"],
  "buen pagador": ["saldo_vencido", "dias_vencido", "abonado", "recuperado"], "mal pagador": ["saldo_vencido", "dias_vencido", "abonado", "recuperado"],
  "sin contribucion": ["contribucion", "margen"], "sin margen": ["margen", "contribucion"],
  frenado: ["capital_frenado", "capital", "dias_sin_venta"], inmovilizado: ["capital_inmovilizado", "capital", "unidades_stock"], sobrestock: ["capital_inmovilizado", "capital", "stock", "dias_inventario"],
  "riesgo de quiebre": ["unidades_stock", "dias_inventario"], "en quiebre": ["unidades_stock"], "capital sano": ["capital"], critico: [], "sin venta": ["dias_sin_venta", "ventas"], "rota bien": ["rotacion", "piso_rotacion"], "rota lento": ["rotacion", "piso_rotacion"],
};
/* las palabras genéricas de cobranza («debe», «deuda», «saldo», «por cobrar») nombran cualquier saldo; las específicas («pendiente», «vencido») uno solo */
export const CLAVES_GENERICAS_DE_COBRANZA = ["saldo_pendiente", "saldo_vencido", "saldo_por_vencer"];
