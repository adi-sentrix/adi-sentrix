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
  { clave: "ventas", nombre: "Venta", conceptos: ["venta", "ventas", "ventas del periodo", "venta del periodo", "ventas totales", "venta (flujo)"], dominio: "comercial", polaridad: "mayor", unidad: "money", muro: ["ventas"] },
  { clave: "ventas_anterior", nombre: "Ventas del año anterior", conceptos: ["ventas del ano anterior"], dominio: "comercial", polaridad: null, unidad: "money", muro: ["ventas"] },
  { clave: "margen", nombre: "Margen", conceptos: ["margen"], dominio: "comercial", polaridad: "mayor", unidad: "pct", muro: ["margen"], tasa: true },
  { clave: "margen_promedio", nombre: "Margen promedio", conceptos: ["margen promedio"], dominio: "comercial", polaridad: "mayor", unidad: "pct", muro: ["margen"], tasa: true, negocio: true },
  { clave: "contribucion", nombre: "Contribución", conceptos: ["contribucion", "contribucion total"], dominio: "comercial", polaridad: "mayor", unidad: "money", muro: ["contribucion"] },
  { clave: "no_capturada", nombre: "Contribución no capturada", conceptos: ["contribucion no capturada"], dominio: "comercial", polaridad: "menor", unidad: "money", muro: ["contribucion"] },
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
  { clave: "saldo_vencido", nombre: "Saldo vencido", conceptos: ["saldo vencido"], dominio: "cobranza", polaridad: "menor", unidad: "money", muro: ["vencido"] },
  { clave: "saldo_pendiente", nombre: "Saldo pendiente", conceptos: ["saldo pendiente"], dominio: "cobranza", polaridad: "menor", unidad: "money", muro: ["pendiente"] },
  { clave: "saldo_por_vencer", nombre: "Saldo por vencer", conceptos: ["saldo por vencer"], dominio: "cobranza", polaridad: null, unidad: "money", muro: ["porvencer"] },
  { clave: "abonado", nombre: "Abonado", conceptos: ["abonado"], dominio: "cobranza", polaridad: "mayor", unidad: "money", muro: ["abonado"] },
  { clave: "recuperado", nombre: "Recuperado", conceptos: ["recuperado"], dominio: "cobranza", polaridad: "mayor", unidad: "pct", muro: ["recuperado"], tasa: true },
  { clave: "dias_vencido", nombre: "Días vencido", conceptos: ["dias vencido"], dominio: "cobranza", polaridad: "menor", unidad: "days", muro: ["diasvencido", "vencido"] },   // «269 días de mora», «lleva 269 días vencido»
  /* ── inventario ── */
  { clave: "capital", nombre: "Capital", conceptos: ["capital", "valor de inventario", "stock", "capital en inventario"], dominio: "inventario", polaridad: null, unidad: "money", muro: ["capital"] },
  { clave: "capital_frenado", nombre: "Capital frenado", conceptos: ["capital frenado"], dominio: "inventario", polaridad: "menor", unidad: "money", muro: ["frenado", "capital"] },
  { clave: "capital_inmovilizado", nombre: "Capital inmovilizado", conceptos: ["capital inmovilizado"], dominio: "inventario", polaridad: "menor", unidad: "money", muro: ["capital"] },
  { clave: "rotacion", nombre: "Rotación", conceptos: ["rotacion"], dominio: "inventario", polaridad: "mayor", unidad: "ratio", muro: ["rotacion"] },
  { clave: "dias_inventario", nombre: "Días de inventario", conceptos: ["dias de inventario", "cobertura", "cobertura (doh)"], dominio: "inventario", polaridad: "menor", unidad: "days", muro: ["cobertura"] },
  { clave: "dias_sin_venta", nombre: "Días sin venta", conceptos: ["dias sin venta"], dominio: "inventario", polaridad: "menor", unidad: "days", muro: ["sinventa"] },
  { clave: "stock", nombre: "Unidades en stock", conceptos: ["unidades en stock"], dominio: "inventario", polaridad: null, unidad: "count", muro: ["unidades_stock"] },
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
  const sin = conceptosDe(String(texto));
  for (const m of CLAVES_DE_METRICA) if (sin.some((c) => m.conceptos.includes(c))) return m.clave;
  for (const m of CLAVES_DE_METRICA) if (m.conceptos.some((c) => c.length >= 4 && s.includes(c))) return m.clave;
  return null;
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
export const NUMEROS_EN_PALABRAS = { cero: 0, un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19, veinte: 20, veintiuno: 21, veintidos: 22, veinticinco: 25, treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90, cien: 100, ciento: 100, doscientos: 200, trescientos: 300, quinientos: 500, mil: 1000, millon: 1e6, millones: 1e6 };
export const FRACCIONES_EN_PALABRAS = { mitad: 0.5, tercio: 1 / 3, cuarto: 0.25, quinto: 0.2, "tres cuartos": 0.75, "dos tercios": 2 / 3, doble: 2, triple: 3, cuadruple: 4 };
export const NUMERO_PALABRA_SRC = "(?:" + Object.keys(NUMEROS_EN_PALABRAS).join("|") + ")";
/* unidades y sustantivos de la casa que hacen de un número (en palabras o en cifras) un HECHO: «tres cuentas», «dos millones», «ocho por ciento» */
export const UNIDADES_DE_HECHO_SRC = "(?:millones?|mil|por\\s+ciento|puntos?(?:\\s+porcentuales)?|pp|d[ií]as?|semanas?|meses|mes|trimestres?|semestres?|a[ñn]os?|cuentas?|clientes?|skus?|sku|bodegas?|marcas?|familias?|unidades?|facturas?|referencias?|productos?|veces|x|%|\\$|k|m)";
/* ordinales: solo son hecho junto a algo de la casa («la segunda cuenta», «el tercer SKU», «va segundo en venta») */
export const ORDINAL_SRC = "(?:primer[oa]?s?|segund[oa]s?|tercer[oa]?s?|cuart[oa]s?|quint[oa]s?|sext[oa]s?|s[eé]ptim[oa]s?|octav[oa]s?|noven[oa]s?|d[eé]cim[oa]s?|[uú]ltim[oa]s?|pen[uú]ltim[oa]s?|\\d{1,2}\\.?[ºª°])";
/* comparativos y superlativos (clase cerrada del idioma; con adjetivo/verbo de la casa o con entidad son hecho) */
export const ADJETIVOS_DE_LA_CASA_SRC = "(?:alt[oa]s?|baj[oa]s?|grandes?|chic[oa]s?|peque[ñn][oa]s?|pesad[oa]s?|car[oa]s?|barat[oa]s?|r[aá]pid[oa]s?|lent[oa]s?|viej[oa]s?|antigu[oa]s?|nuev[oa]s?|atrasad[oa]s?|vencid[oa]s?|san[oa]s?|rentables?|delgad[oa]s?|fuertes?|d[eé]biles?|expuest[oa]s?|apalancad[oa]s?|moros[oa]s?|larg[oa]s?|cort[oa]s?|cercan[oa]s?|lejan[oa]s?|concentrad[oa]s?|fren[ao]d[oa]s?|crític[oa]s?)";
export const VERBOS_DE_LA_CASA_SRC = "(?:vend[eióa]" + _L + "*|factur" + _L + "+|deb[eéií]" + _L + "*|adeud" + _L + "+|pag[aóo]" + _L + "*|abon[aóo]" + _L + "*|cobr[aóo]" + _L + "*|recuper" + _L + "+|rot[aóo]" + _L + "*|crec[eií]" + _L + "*|ca[eíy]" + _L + "*|sub[eií]" + _L + "*|baj[aóo]" + _L + "*|fren[aóo]" + _L + "*|concentr" + _L + "+|aport" + _L + "+|dej[aóo]" + _L + "*|pes[aóo]" + _L + "*|margin" + _L + "+|contribuy" + _L + "+|compr[aóo]" + _L + "*|gan[aóo]" + _L + "*|pierd" + _L + "+|acumul" + _L + "+|arrastr" + _L + "+|lidera" + _L + "*|encabez" + _L + "+|super" + _L + "+|domin" + _L + "+|expon" + _L + "+|inmoviliz" + _L + "+|mueve" + _L + "*|agot" + _L + "+)";
export const SUPERLATIVO_SRC = "(?:(?:el|la|los|las|lo|quien(?:es)?)\\s+que\\s+(?:m[aá]s|menos)|(?:el|la|los|las|tu|tus|su|sus|mi|mis|nuestr[oa]s?)\\s+(?:mayor(?:es)?|menor(?:es)?|peor(?:es)?|mejor(?:es)?|m[aá]s|menos|principal(?:es)?|primer[oa]?s?|[uú]ltim[oa]s?)\\b|n[uú]mero\\s+uno|nadie\\s+le\\s+(?:gana|hace\\s+sombra)|le\\s+pisa\\s+los\\s+talones|\\btop\\s*\\d*|lidera" + _L + "*|encabeza" + _L + "*|a\\s+la\\s+cabeza|en\\s+cabeza|a\\s+la\\s+zaga|cierra\\s+la\\s+(?:tabla|lista)|completa\\s+el\\s+podio|puntero|dominante)";
export const COMPARATIVO_SRC = "(?:m[aá]s\\s+(?:que|de)|menos\\s+(?:que|de)|mayor(?:es)?\\s+(?:que|a)|menor(?:es)?\\s+(?:que|a)|peor(?:es)?\\s+que|mejor(?:es)?\\s+que|por\\s+(?:encima|debajo|sobre)\\s+de|(?:muy\\s+)?por\\s+(?:arriba|abajo)\\s+de|supera" + _L + "*|excede" + _L + "*|duplica" + _L + "*|triplica" + _L + "*|dobla" + _L + "*|iguala" + _L + "*|empata" + _L + "*|el\\s+doble|el\\s+triple|la\\s+mitad|un\\s+tercio|un\\s+cuarto|\\d+(?:[.,]\\d+)?\\s*(?:veces|x)\\b|(?:dos|tres|cuatro|cinco|diez)\\s+veces|parecid[oa]s?|similar(?:es)?|a\\s+la\\s+par|casi\\s+(?:igual|lo\\s+mismo)|igual\\s+que|tanto\\s+como|lejos\\s+de|cerca\\s+de|(?:no\\s+)?(?:alcanza|llega)\\s+a\\s+cubrir|(?:no\\s+)?cubre|se\\s+queda\\s+cort[oa]|a\\s+la\\s+zaga|le\\s+saca\\s+ventaja|viene\\s+detr[aá]s|le\\s+sigue|seguid[oa]\\s+(?:de|por))";
export const VARIACION_SRC = "(?:crec[eií]" + _L + "*|ca[eíy]" + _L + "*|sub[eií]" + _L + "*|baj[aóo]" + _L + "*|aument" + _L + "+|disminu" + _L + "+|retroced" + _L + "+|avanz" + _L + "+|repunt" + _L + "+|se\\s+dispar" + _L + "+|se\\s+desplom" + _L + "+|se\\s+hund" + _L + "+|merm" + _L + "+|afloj" + _L + "+|se\\s+enfr[ií]" + _L + "+|en\\s+picada|mejor[aóo]" + _L + "*|empeor" + _L + "+|deterior" + _L + "+|se\\s+contra[ej]" + _L + "*|recort" + _L + "+|expandi" + _L + "*|interanual|yoy|a[ñn]o\\s+anterior|a[ñn]o\\s+pasado)";
export const DURACION_SRC = "(?:desde\\s+hace|hace\\s+(?:m[aá]s\\s+de\\s+)?(?:\\d+|" + NUMERO_PALABRA_SRC + ")\\s+(?:d[ií]as?|semanas?|meses|mes|trimestres?|semestres?|a[ñn]os?)|llev[aó]" + _L + "*\\s+(?:m[aá]s\\s+de\\s+)?(?:\\d+|" + NUMERO_PALABRA_SRC + "|medio|un|una)\\s+(?:d[ií]as?|semanas?|meses|mes|trimestres?|semestres?|a[ñn]os?)|(?:medio|un|una)\\s+(?:a[ñn]o|semestre|trimestre|mes)\\s+(?:sin|de|en|atrasad))";
/* proporciones: pegadas a un hecho exigen una razón/conteo; sueltas y subjetivas («casi toda», «un puñado») son lectura (decisión del owner) */
export const PROPORCION_SRC = "(?:la\\s+mayor[ií]a|la\\s+mayor\\s+parte|el\\s+grueso|casi\\s+tod[oa]s?|pr[aá]cticamente\\s+tod[oa]s?|buena\\s+parte|gran\\s+parte|la\\s+mitad|un\\s+tercio|dos\\s+tercios|un\\s+cuarto|tres\\s+cuartos|casi\\s+nada|un\\s+pu[ñn]ado|(?:muy\\s+)?poc[oa]s|(?:uno|dos|tres)\\s+de\\s+cada\\s+(?:dos|tres|cuatro|cinco|diez))";
export const PROPORCION_SUBJETIVA_SRC = "(?:casi\\s+tod[oa]s?|pr[aá]cticamente\\s+tod[oa]s?|buena\\s+parte|gran\\s+parte|el\\s+grueso|casi\\s+nada|un\\s+pu[ñn]ado|(?:muy\\s+)?poc[oa]s)";
/* proformas de continuación: heredan el predicado de al lado (por eso no pueden quedar sueltas ni vacías) */
export const PROFORMA_SRC = "(?:tambi[eé]n|tampoco|igual(?:mente)?|lo\\s+mismo|[ií]dem|asimismo|ni\\s+hablar\\s+de|otro\\s+tanto|del\\s+mismo\\s+modo|en\\s+la\\s+misma\\s+l[ií]nea|de\\s+igual\\s+forma)";
/* operadores que cambian el valor de verdad de lo que tocan: viven DENTRO del ancla o no viven */
export const NEGACION_SRC = "(?:no|ni|nunca|jam[aá]s|tampoco|nadie|nada|ning[uú]n[oa]?|lejos\\s+de|dista\\s+de|es\\s+falso\\s+que|no\\s+es\\s+cierto\\s+que|ser[ií]a\\s+un\\s+error\\s+(?:pensar|creer|decir)|(?:ya\\s+)?dej[oó]\\s+de|ya\\s+no)";
export const TIEMPO_SRC = "(?:antes|ya\\s+no|dej[oó]\\s+de|hasta\\s+(?:hace|el|la)|era|eran|sol[ií]a|este\\s+mes|el\\s+mes\\s+pasado|la\\s+semana\\s+pasada|el\\s+a[ñn]o\\s+pasado|el\\s+a[ñn]o\\s+anterior|el\\s+trimestre\\s+pasado|en\\s+el\\s+presupuesto|seg[uú]n\\s+el\\s+presupuesto|contra\\s+el\\s+presupuesto|vs\\.?\\s+presupuesto|acumulado|ytd|a\\s+la\\s+fecha|al\\s+corte|hoy|ayer|en\\s+(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\\b|en\\s+20\\d\\d)";
export const MODALIDAD_SRC = "(?:si\\s+(?:[a-záéíóúñ0-9\\-]+\\s+){0,3}(?:fuera|fuese|estuviera|tuviera|llegara|vendiera|pagara|cobrara|subiera|bajara|creciera|cayera|debiera)|deber[ií]a|podr[ií]a|supuestamente|hipot[eé]ticamente|ser[ií]a|tendr[ií]a\\s+que|en\\s+teor[ií]a|(?:vender|comprar|cobrar|pagar|subir|bajar|crecer|caer|ganar|perder|quedar|tener|haber|hacer|dar|ir|llegar|liberar|recuperar|ampliar|mantener|cerrar|abrir|priorizar|empezar|dejar|estar|frenar|rotar|deber)[ií]a(?:n|s|mos)?)";
/* los períodos con que un marcador de tiempo casa (dentro de un ancla) */
export const PERIODO_DE_MARCADOR = [[/presupuesto|ppto|\bplan\b/, "presupuesto"], [/pasad[oa]|anterior|antes|ya no|dej[oó] de|era|sol[ií]a/, "anterior"], [/hoy|al corte|a la fecha|acumulado|ytd|este mes|actual/, "actual"]];
/* pronombres de tercera que atan un hecho a OTRA parte (un solo rol no los admite) */
export const PRONOMBRE_AJENO_SRC = "(?:le|les|de\\s+[eé]l|de\\s+ella|de\\s+ellos|de\\s+ellas)";
/* preposiciones de base: lo que sigue tiene que ser la base del hecho (con vocabulario de la casa) o {id.base} */
export const PREPOSICION_DE_BASE_SRC = "(?:sobre|de\\s+lo|del|de\\s+la|de\\s+su|de\\s+sus|respecto\\s+(?:de|a|al)|en\\s+relaci[oó]n\\s+(?:a|con)|por\\s+cada|de\\s+cada)";
/* palabras de cada dominio (con las de sus métricas y estados): la predicación sobre una entidad se juzga por DOMINIO, no por palabra */
export const DOMINIO_PALABRAS = {
  cobranza: "(?:pag[oa]s?|pag" + _L + "+|cobr" + _L + "+|cobranza|mora|moros" + _L + "*|deud" + _L + "+|adeud" + _L + "+|vencid" + _L + "*|atras" + _L + "+|plazos?|cupos?|cr[eé]dito|abon" + _L + "+|facturas?|recuper" + _L + "+|puntual" + _L + "*|saldos?|por\\s+cobrar|calendario\\s+de\\s+pago|despach" + _L + "+)",
  inventario: "(?:stock|inventario|bodegas?|rotaci[oó]n|rota" + _L + "*|frenad" + _L + "*|inmoviliz" + _L + "+|sobrestock|quiebre|agot" + _L + "+|mercader[ií]a|existencias|capital\\s+frenado|d[ií]as\\s+sin\\s+venta|cobertura|dormid" + _L + "+|parad" + _L + "+|reponer|liquidar|reposici[oó]n)",
  comercial: "(?:ventas?|facturaci[oó]n|m[aá]rgen(?:es)?|contribuci[oó]n|carga\\s+comercial|benchmark|precios?|costos?|descuentos?|markup|unidades\\s+vendidas|rentabilidad|presupuesto)",
};
/* modismos con «más/menos/primero» que NO son hecho (clase cerrada) */
export const MODISMOS_SRC = "(?:adem[aá]s|m[aá]s\\s+bien|nada\\s+m[aá]s|una\\s+vez\\s+m[aá]s|cada\\s+vez\\s+m[aá]s|m[aá]s\\s+all[aá]|es\\s+m[aá]s|m[aá]s\\s+a[uú]n|por\\s+lo\\s+menos|al\\s+menos|a\\s+lo\\s+m[aá]s|m[aá]s\\s+tarde|m[aá]s\\s+adelante|m[aá]s\\s+temprano|de\\s+m[aá]s|en\\s+primer\\s+lugar|en\\s+segundo\\s+lugar|primero\\s+que\\s+nada|lo\\s+m[aá]s\\s+(?:importante|urgente|sano|prudente|claro|simple|razonable|sensato|delicado|relevante|cr[ií]tico)|(?:el|la)\\s+m[aá]s\\s+(?:urgente|importante|prudente|delicad[oa]|relevante|sensat[oa]|razonable))";
/* los días de una cifra que no es hecho: enumeradores, años, fechas, ids del libro */
export const NUMERO_LIBRE_SRC = "(?:^\\s*\\d{1,2}[.)]\\s|\\b(?:19|20)\\d\\d\\b|\\b\\d{1,2}\\s+de\\s+(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\\b|\\b[hcr]\\d+[a-z]?\\b)";

/* las métricas con que se habla de cada estado (dentro de un ancla de estado esas palabras no son «métrica ajena») */
export const METRICAS_DE_ESTADO = {
  "al dia": ["saldo_vencido", "dias_vencido"], "en mora": ["saldo_vencido", "dias_vencido"], "sin deuda": ["saldo_pendiente", "saldo_vencido"], "sin pagos": ["abonado", "recuperado"],
  "buen pagador": ["saldo_vencido", "dias_vencido", "abonado", "recuperado"], "mal pagador": ["saldo_vencido", "dias_vencido", "abonado", "recuperado"],
  "sin contribucion": ["contribucion", "margen"], "sin margen": ["margen", "contribucion"],
  frenado: ["capital_frenado", "capital", "dias_sin_venta"], inmovilizado: ["capital_inmovilizado", "capital", "stock"], sobrestock: ["capital_inmovilizado", "capital", "stock", "dias_inventario"],
  "riesgo de quiebre": ["stock", "dias_inventario"], "en quiebre": ["stock"], "capital sano": ["capital"], critico: [], "sin venta": ["dias_sin_venta", "ventas"], "rota bien": ["rotacion", "piso_rotacion"], "rota lento": ["rotacion", "piso_rotacion"],
};
/* las palabras genéricas de cobranza («debe», «deuda», «saldo», «por cobrar») nombran cualquier saldo; las específicas («pendiente», «vencido») uno solo */
export const CLAVES_GENERICAS_DE_COBRANZA = ["saldo_pendiente", "saldo_vencido", "saldo_por_vencer"];
