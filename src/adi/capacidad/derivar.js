/* === src/adi/capacidad/derivar.js · LA DERIVACIÓN: LA QUINTA ACCIÓN DEL COMPLEMENTO (Contrato del Anfitrión · owner 2026-10-05) ═════════════
 * `_ADI_DISENO_CONTRATO_ANFITRION.md` §2. La frontera del tercer contrato (Ingesta · Entrega · Anfitrión): «el LLM puede comprender, conversar y redactar libremente, pero NO puede crear nueva verdad
 * empresarial. Si necesita una cifra, total, porcentaje, conteo, diferencia o cualquier hecho cuantitativo que ADI no le entregó explícitamente, debe volver a ADI en vez de calcularlo». Esta es la vía
 * directa y barata para volver: una DERIVACIÓN sobre identificadores YA entregados (`E<n>.h<k>`), calculada y verificada por ADI y devuelta como un hecho nuevo con id (`D<k>`) y procedencia «derivado».
 *
 * CUATRO OPERACIONES, CERRADAS (`OPERACIONES`): suma · diferencia · participacion · conteo. Sin `promedio` (decisión del owner §8.3: el promedio simple de porcentajes es falso). Sin lenguaje: ninguna
 * función de este archivo lee prosa — el pedido es un objeto tipado y las cifras salen del libro de la conversación, con aritmética EXACTA sobre los CRUDOS que el libro guardó (`rv.raw`), nunca sobre lo impreso
 * («verificado no es exacto»: si la suma de lo impreso diera 94.3 y la de los crudos 94.2, la verdad es la de ADI).
 *
 * NO TOCA EL CORE: no pasa por `validarEncargo` ni `componerEntrega` (congelados) ni por `conTenantActivo`; no importa nada de `entrega/` ni de `encargo/`. Es PURO: sin I/O, sin red, cero `node:*` (corre en edge).
 * Lo que hace la acción (`acciones.js:derivar`) con el resultado —leer el libro, guardar, falla cerrada— no vive acá.
 *
 * ESCALAS (verificadas con el libro real, 2026-10-05): el dinero se guarda en la moneda tal cual (`35510000` ↔ «$35.5M»); los porcentajes en PUNTOS (`21.5` ↔ «21.5%», nunca `0.215`). Por eso una participación es
 * `100 · numerador / base` y se imprime con el formato de la casa; una diferencia de dos % se dice en `pp`.
 *
 * ENCADENAR Y AGRUPAR (owner 2026-10-07, ensayo 4; `_ADI_DISENO_CONTRATO_ANFITRION.md` §10): (1) un operando puede ser una DERIVACIÓN anterior (`D<k>`): resuelve a su valor con su LINAJE completo (las cifras `E<n>.h<k>` de las que sale, a
 * través de todas las cadenas) y las reglas de siempre se aplican sobre ese linaje —unidad, período, moneda, carga, métrica, duplicados, totales—; un `D` solo puede referirse a ids que YA existen, así que un ciclo es imposible por
 * construcción; el resultado de un `conteo` no se encadena (`derivacion_no_encadenable`: «5 de 12» no es una cantidad que se sume ni se divida); (2) una PARTICIPACIÓN admite VARIOS numeradores —«los 3 primeros sobre el total» es UN hecho de ADI—: se suman
 * (misma métrica, aditiva, sin repetirse ni solaparse, sin total del listado entre ellos) y su suma no puede superar la base.
 *
 * ENSAYO 5 (owner 2026-10-07; `_ADI_DISENO_CONTRATO_ANFITRION.md` §11): (1) un operando también puede ser una cifra de APOYO (`E<n>.e<k>`: la referencia con la que se compara, el benchmark) — el id que ADI entrega y antes
 * rechazaba—, con las mismas reglas de siempre (unidad, período, moneda, carga) y UNA más: una referencia se compara con la métrica de la que es referencia (el benchmark con el margen: una diferencia en puntos), nunca con
 * otra; y el hecho que sale lleva la procedencia de cada lado (lo medido y la referencia, con DE QUIÉN es: «declarado por la empresa» o «criterio general de ADI»), nunca una referencia presentada como criterio de la
 * empresa; (2) una quinta operación, `razon`: «cuántas veces es A respecto de B» (A ÷ B, misma métrica, misma unidad, ambas positivas; «2.3 veces»).
 *
 * ENSAYO 6 (owner 2026-10-08; `_ADI_DISENO_CONTRATO_ANFITRION.md` §12): (1) la VENTA NO SE ABRE POR BODEGA — `derivar` rechaza (`venta_por_bodega`) un agregado de métricas comerciales cuyas cifras salen de un universo definido por bodega
 * (la suma de «los SKU de Lampa» no es «la venta de Lampa»): el origen lo dice quien llama (`opciones.deBodega`, `universoDeLasCifras.js`, desde los universos del libro); (2) cada derivación lleva su DESCRIPCIÓN (`describirDerivacion`): qué operación es
 * y de qué cifras — para que quien la lee sin haberla pedido (`retomar`, otro anfitrión) no la confunda con otro conjunto.
 *
 * DECISIONES QUE EL DISEÑO NO CUBRÍA (la opción conservadora, a revisión del owner): (a) un TOTAL DEL LISTADO (`deListado`) no entra a una suma ni a un conteo —sumaría dos veces lo que ya contiene— pero sí a una
 * diferencia o a una participación, como numerador o COMO BASE (total − top-3 · una fila ÷ su total · los 3 primeros ÷ su total): `operando_es_total`; (b) una participación no se calcula con un numerador o una base NEGATIVOS: `operando_negativo`; (c) una diferencia o
 * participación entre métricas distintas exige el MISMO dueño («Saldo pendiente − Saldo vencido» de una cuenta): dos métricas y dos dueños a la vez no es una cifra del negocio — `metricas_distintas`; (d) el conteo de
 * DINERO contra una cantidad suelta solo admite 0 (la escala de «5» —¿$5 o $5M?— es ambigua): contra otra cifra entregada (su id) admite cualquier valor. */
import { cifrasDeLaEntrega, llaveDeCifra } from "../continuidad/revalidar.js";
import { formatoDeLaCasa } from "../notario/hechos.js";
import { metricaPorClave, metricaDeClave, CLAVES_DE_METRICA } from "../notario/lexico.js";
import { normalizar } from "../notario/afirmacion.js";
import { cifrasDeApoyo } from "./apoyo.js";
import { etiquetaDeProcedencia, ORIGEN } from "../../config/businessPolicy.js";
import { esMetricaComercial, textoDeLaLey, MOTIVO_VENTA_POR_BODEGA } from "./universoDeBodega.js";   // la hoja pura de la ley «la venta no se abre por bodega» (no importa nada del Core)

export const OPERACIONES = Object.freeze(["suma", "diferencia", "participacion", "conteo", "razon"]);
export const OPERADORES = Object.freeze([">", ">=", "<", "<=", "="]);
/** lo que un universo lista a la vista (= `compacto.js:ENTIDADES_DE_UN_UNIVERSO_MAX`; el gate lo iguala: acá no se importa para no cerrar un ciclo con `acciones.js`) */
export const OPERANDOS_MAX = 40;
export const MOTIVOS_DE_DERIVACION = Object.freeze([
  "falta_conversacion", "conversacion_inexistente", "otra_empresa",
  "operacion_desconocida", "faltan_operandos", "demasiados_operandos", "derivacion_no_encadenable",
  "id_invalido", "id_inexistente", "entrega_recortada",
  "operando_sin_valor_exacto", "operando_no_medido", "operando_repetido", "operando_es_total", "operando_negativo",
  "unidades_distintas", "metricas_distintas", "metrica_no_aditiva", "operando_no_positivo",
  "otro_periodo", "otra_moneda", "otra_carga", MOTIVO_VENTA_POR_BODEGA,
  "base_cero", "numerador_mayor_que_base", "unidad_no_participable", "condicion_invalida",
]);
const _PROCEDENCIAS_ADMITIDAS = new Set(["medido", "derivado", "estimacion_referencia"]);   /* una brecha también se suma; un supuesto o una propuesta no */
const _ID_DE_CIFRA = /^E(\d+)\.h(\d+)(?:\.(\d+))?$/;
/* una cifra de APOYO: `E<n>.<id del hecho en la Entrega>` (`e3`; una premisa o un dato de la iniciativa llevan otra letra). Un universo (`E1.u1`) no es una cifra. */
const _ID_DE_APOYO = /^E(\d+)\.((?![hu]\d)[A-Za-z][A-Za-z0-9_]*)$/;
const _esIdDeCifra = (id) => typeof id === "string" && (_ID_DE_CIFRA.test(id.trim()) || _ID_DE_APOYO.test(id.trim()));
const _ID_DE_DERIVACION = /^D(\d+)$/;
const _finito = (x) => typeof x === "number" && Number.isFinite(x);
const _limpio = (x) => Number((+x).toPrecision(12));   /* sin el ruido de coma flotante: 33.3 − 21.5 = 11.8, no 11.799999999999997 */
const _rechazo = (motivo, detalle, ids) => ({ ok: false, motivo, detalle, ...(ids && ids.length ? { ids } : {}) });
const _periodoClave = (p) => (p && typeof p === "object" ? `${p.texto || ""}|${p.rango || ""}` : p ? String(p) : "");
const _periodoTexto = (p) => (p && typeof p === "object" ? (p.texto || p.rango || null) : (p || null));
const _nombre = (clave) => (clave ? metricaDeClave(clave) : "");
const _dueno = (d) => String(d == null ? "negocio" : d).split(" + ").map((x) => normalizar(x)).join(" + ");
const _FRASE_DE_OPERADOR = { ">": "mayores que", ">=": "mayores o iguales que", "<": "menores que", "<=": "menores o iguales que", "=": "iguales a" };

/* ── LAS REFERENCIAS DE LA CASA Y LA MÉTRICA DE LA QUE SON REFERENCIA ─────────────────────────────────────────────────────────────────────────────────────────────────────
 * Una referencia (el benchmark, el nivel de carga, el piso de rotación…) no es una métrica medida de una cuenta: se compara con la métrica de la que es referencia — el benchmark con el margen, el nivel de carga con la
 * carga — y con ninguna otra. Es una tabla de DATOS (las claves del léxico) y un candado: cada referencia del léxico que dice a qué métrica apunta (`muro`) tiene que estar acá, o el módulo no carga. */
export const REFERENCIA_DE = Object.freeze({
  benchmark: Object.freeze(["margen", "margen_promedio"]),
  nivel_carga: Object.freeze(["carga"]),
  piso_rotacion: Object.freeze(["rotacion"]),
  techo_cobertura: Object.freeze(["dias_inventario"]),
  umbral_frenado: Object.freeze(["dias_sin_venta"]),
});
for (const m of CLAVES_DE_METRICA) {
  if (!m.referencia) continue;
  const sinLugar = (Array.isArray(m.muro) ? m.muro : []).length > 0 && !REFERENCIA_DE[m.clave];
  if (sinLugar) throw new Error(`derivar.js: la referencia «${m.clave}» del léxico no dice de qué métrica es referencia (REFERENCIA_DE)`);
}
/** ¿dos claves se pueden comparar? la misma, o una referencia con la métrica de la que es referencia (en cualquier orden) */
export function clavesComparables(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  return (REFERENCIA_DE[a] || []).includes(b) || (REFERENCIA_DE[b] || []).includes(a);
}
const _esReferencia = (clave) => Boolean(clave && Object.prototype.hasOwnProperty.call(REFERENCIA_DE, clave));

/* la procedencia de un operando, en palabras de negocio: lo medido, la estimación contra una referencia, la REFERENCIA con DE QUIÉN es (la empresa la declaró, o es el criterio general de ADI), lo derivado */
const _ROTULO_DE_PROCEDENCIA = Object.freeze({ medido: "medido", estimacion_referencia: "estimación contra una referencia", derivado: "derivado" });
const _ORIGENES = new Set(Object.values(ORIGEN));
export function rotuloDeProcedencia(op) {
  if (!op) return null;
  if (op.esReferencia) {
    const o = typeof op.origenRef === "string" && _ORIGENES.has(op.origenRef) ? etiquetaDeProcedencia({ origen: op.origenRef }) : null;
    return o ? `referencia, ${o}` : "referencia general (no es un criterio propio de la empresa)";
  }
  return _ROTULO_DE_PROCEDENCIA[op.procedencia] || op.procedencia || null;
}
/** ¿hay que decir la procedencia de cada lado? solo cuando algún operando NO es una medición a secas: una referencia o una estimación contra una referencia */
const _hayQueDecirProcedencia = (ops) => ops.some((x) => x && (x.esReferencia || x.procedencia === "estimacion_referencia"));

/** textoDeVeces(raw) → «2.3 veces» · una razón «cuántas veces es A respecto de B»: una decimal desde 1 (la precisión con la que la casa imprime un múltiplo, `notario/hechos.js`: «2.3x», y con la que el Notario lo verifica, ±0,05) y dos por debajo de 1 («0.87 veces»: una sola decimal diría «0.9»). */
export function textoDeVeces(raw) {
  if (!_finito(raw)) return "";
  return `${raw >= 1 ? (Math.round(raw * 10) / 10).toFixed(1) : (Math.round(raw * 100) / 100).toFixed(2)} veces`;   /* la MISMA cuenta con la que la casa imprime un múltiplo (`notario/hechos.js`: `(Math.round(q * 10) / 10).toFixed(1)`) */
}
/** el texto de una cifra derivada según su unidad: las de siempre con el formato de la casa; una razón, en «veces» */
export const textoDeDerivada = (raw, unidad) => (unidad === "veces" ? textoDeVeces(raw) : formatoDeLaCasa(raw, unidad));

/* ═══ 1 · EL PEDIDO ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
/** llaveDeDerivacion({operacion, sobre, base?, condicion?}) → string · la IDENTIDAD de una derivación (para la idempotencia): misma operación, mismos operandos, misma base, misma condición. La suma y el conteo no dependen del orden
 *  de los operandos; la diferencia sí (primero − segundo). */
export function llaveDeDerivacion(p) {
  const sobre = Array.isArray(p && p.sobre) ? p.sobre.map(String) : [];
  const orden = p && p.operacion === "diferencia" ? sobre : sobre.slice().sort();
  const c = p && p.condicion && typeof p.condicion === "object" ? `${p.condicion.op}|${typeof p.condicion.valor === "number" ? `n:${p.condicion.valor}` : `id:${p.condicion.valor}`}` : "";
  return [p && p.operacion, orden.join(","), p && (p.operacion === "participacion" || p.operacion === "razon") ? String(p.base || "") : "", p && p.operacion === "conteo" ? c : ""].join("¦");
}

/* ═══ 2 · LAS CIFRAS DEL LIBRO ════════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
/* el índice de lo entregable: Entrega n → { entrega, porId: Map id → cifra (una por cifra: las filas anchas ya vienen abiertas; y las de APOYO que guardaron su cifra exacta), apoyoSinCifra: Set de ids de apoyo que existen pero no traen una cifra sobre la que se derive } — solo de las Entregas que conservan sus hechos */
function _indiceDelLibro(libro) {
  const idx = new Map();
  for (const e of (libro && Array.isArray(libro.entregas) ? libro.entregas : [])) {
    if (!e || typeof e !== "object") continue;
    const porId = new Map();
    const apoyoSinCifra = new Set();
    if (!e.recortada) {
      for (const h of cifrasDeLaEntrega(e)) if (h && h.id) porId.set(h.id, h);
      for (const h of cifrasDeApoyo(e, { nombreDeClave: metricaDeClave, formato: formatoDeLaCasa })) porId.set(h.id, h);
      for (const a of (Array.isArray(e.apoyo) ? e.apoyo : [])) if (a && typeof a.id === "string" && !porId.has(a.id)) apoyoSinCifra.add(a.id);
    }
    idx.set(e.n, { entrega: e, porId, apoyoSinCifra });
  }
  return idx;
}

/** cifrasDeLosOperandos(libro, ids) → Map id → { entidad, metrica, valor } · cómo se entregó cada cifra (lo que el anfitrión ve de un operando); una cifra que el libro ya no conserva simplemente no está en el mapa */
export function cifrasDeLosOperandos(libro, ids) {
  const indice = _indiceDelLibro(libro);
  const out = new Map();
  for (const id of ids || []) {
    const m = typeof id === "string" ? (_ID_DE_CIFRA.exec(id) || _ID_DE_APOYO.exec(id)) : null;
    const h = m && indice.get(Number(m[1])) ? indice.get(Number(m[1])).porId.get(id) : null;
    if (h) out.set(id, { entidad: h.sujeto != null ? h.sujeto : null, metrica: h.metrica != null ? h.metrica : null, valor: h.valor != null ? h.valor : null, ...(h.rv && h.rv.procedencia ? { procedencia: h.rv.procedencia, esReferencia: _esReferencia(h.rv.clave), ...(h.rv.origenRef ? { origenRef: h.rv.origenRef } : {}) } : {}) });
    else if (typeof id === "string" && _ID_DE_DERIVACION.test(id)) {   /* una derivación anterior: viaja con su valor y de qué sale */
      const d = (libro && Array.isArray(libro.derivaciones) ? libro.derivaciones : []).find((x) => x && x.id === id);
      if (d) out.set(id, { entidad: d.entidad != null ? d.entidad : null, metrica: d.metrica != null ? d.metrica : null, valor: d.resultado && d.resultado.texto != null ? d.resultado.texto : null, procedencia: "derivado", derivaDe: _idsDeLaDerivada(d) });
    }
  }
  return out;
}
/* los ids con que se armó una derivación guardada (operandos, base y cifra de comparación) */
const _idsDeLaDerivada = (d) => [...(Array.isArray(d.sobre) ? d.sobre : []), ...(d.base ? [d.base] : []), ...(d.condicion && typeof d.condicion.valor === "string" ? [d.condicion.valor] : [])];

/* un id del pedido → un operando: una cifra entregada (`E<n>.h<k>`) o una derivación anterior (`D<k>`) */
function _resolverId(libro, indice, id) {
  if (typeof id === "string" && _ID_DE_DERIVACION.test(id.trim())) return _resolverDerivada(libro, indice, id.trim());
  return _resolverE(libro, indice, id);
}
/* una derivación guardada → un operando con su valor exacto Y su linaje: las cifras entregadas de las que sale (a través de todas las cadenas). Las reglas de la derivación se aplican sobre ese linaje, no sobre el resultado a secas. */
function _resolverDerivada(libro, indice, idc) {
  const k = Number(idc.slice(1));
  const d = (libro && Array.isArray(libro.derivaciones) ? libro.derivaciones : []).find((x) => x && x.id === idc);
  if (!d) {
    const nD = libro && Number.isInteger(libro.nDerivaciones) ? libro.nDerivaciones : 0;
    if (k >= 1 && k <= nD) return _rechazo("id_inexistente", `la derivación ${idc} ya no se conserva en la conversación (el libro recorta las más viejas): ${idc} no existe`, [idc]);
    return _rechazo("id_inexistente", `la conversación no tiene la derivación ${idc}: no existe (una derivación solo se encadena sobre una que ADI ya devolvió en esta conversación)`, [idc]);
  }
  const R = d.resultado && typeof d.resultado === "object" ? d.resultado : null;
  if (!R || !_finito(R.raw) || !R.unidad) return _rechazo("operando_sin_valor_exacto", `la derivación ${idc} no conserva su valor exacto: no se puede derivar sobre ella`, [idc]);
  if (d.operacion === "conteo") return _rechazo("derivacion_no_encadenable", `${idc} es un conteo («${R.texto}»): un conteo no se suma, no se resta ni se divide con otras cifras — derive sobre las cifras que cuenta`, [idc]);
  /* el linaje: lo que la derivación guardó (las encadenadas lo traen) o, si es de cifras entregadas, sus propios operandos */
  const ids = Array.isArray(d.linaje) && d.linaje.length ? d.linaje : _idsDeLaDerivada(d);
  const hojas = [];
  for (const hid of ids) {
    if (!_esIdDeCifra(hid)) return _rechazo("id_inexistente", `la derivación ${idc} no conserva de qué cifras sale: no se puede derivar sobre ella`, [idc]);
    const r = _resolverE(libro, indice, hid);
    if (!r.ok) return r;
    if (!hojas.some((h) => h.id === r.op.id)) hojas.push(r.op);
  }
  if (!hojas.length) return _rechazo("id_inexistente", `la derivación ${idc} no conserva de qué cifras sale: no se puede derivar sobre ella`, [idc]);
  const dueno = [...new Set(hojas.map((h) => _dueno(h.dueno)))].join(" + ");
  return {
    ok: true,
    op: {
      id: idc, derivada: true, entidad: d.entidad != null ? d.entidad : null, metrica: d.metrica != null ? d.metrica : null, valor: R.texto != null ? R.texto : null,
      raw: R.raw, unidad: R.unidad, clave: R.clave || null, dueno, llave: `D|${idc}`, deListado: false,
      hojas, entregaNs: [...new Set(hojas.map((h) => h.entregaN))], procedencia: "derivado", derivaDe: _idsDeLaDerivada(d),
    },
  };
}
/* las cifras entregadas de un operando: él mismo si es una cifra, su linaje si es una derivación */
const _hojasDe = (x) => (x.hojas && x.hojas.length ? x.hojas : [x]);
const _entregasDe = (x) => (x.entregaNs ? x.entregaNs : [x.entregaN]);

/* una cifra del libro → un operando con todo lo que la derivación necesita (y nada que haya que volver a calcular) */
function _resolverE(libro, indice, id) {
  const m = typeof id === "string" ? (_ID_DE_CIFRA.exec(id.trim()) || _ID_DE_APOYO.exec(id.trim())) : null;
  if (!m) return _rechazo("id_invalido", `«${typeof id === "string" ? id : JSON.stringify(id)}» no es el identificador de una cifra entregada (E<n>.h<k>), de una cifra de apoyo (E<n>.e<k>) ni de una derivación (D<k>): solo se deriva sobre lo que ADI ya entregó en esta conversación`, [String(id)]);
  const idc = id.trim();
  const n = Number(m[1]);
  const esApoyo = _ID_DE_APOYO.test(idc);
  const ent = indice.get(n);
  if (!ent) {
    const turno = libro && Number.isInteger(libro.turno) ? libro.turno : 0;
    if (!indice.size) return _rechazo("id_inexistente", `la conversación todavía no tiene ninguna Entrega: ${idc} no existe`, [idc]);
    if (n >= 1 && n <= turno) return _rechazo("id_inexistente", `la Entrega E${n} ya no se conserva en la conversación (el libro recorta las más viejas): ${idc} no existe`, [idc]);
    return _rechazo("id_inexistente", `la conversación no tiene la Entrega E${n}: ${idc} no existe`, [idc]);
  }
  if (ent.entrega.recortada) return _rechazo("entrega_recortada", `la Entrega E${n} se recortó por tamaño: ya no conserva sus cifras, así que no se puede derivar sobre ${idc}`, [idc]);
  const h = ent.porId.get(idc);
  if (!h && esApoyo && ent.apoyoSinCifra.has(idc)) return _rechazo("operando_sin_valor_exacto", `${idc} es un dato de apoyo sin una cifra sobre la que se derive (un resultado que ADI ya calculó, un conteo o una premisa): derive sobre las cifras de la tabla de las que sale`, [idc]);
  if (!h) return _rechazo("id_inexistente", esApoyo ? `la Entrega E${n} no tiene la cifra de apoyo ${idc}` : `la Entrega E${n} no tiene la cifra ${idc}`, [idc]);
  const v = h.rv && typeof h.rv === "object" ? h.rv : null;
  if (!v || !_finito(v.raw) || !v.clave || !v.unidad) return _rechazo("operando_sin_valor_exacto", `la cifra ${idc} se entregó sin valor exacto (es de antes de que ADI lo conservara, o es una cifra de proyección): no se puede derivar sobre ella`, [idc]);
  if (v.premisa === true) return _rechazo("operando_no_medido", `${idc} es una premisa planteada en la consulta, no una medición: no se deriva sobre ella`, [idc]);
  if (v.deSupuesto === true || (v.titular && v.titular !== "medido") || !_PROCEDENCIAS_ADMITIDAS.has(v.procedencia)) return _rechazo("operando_no_medido", `la cifra ${idc} no es una medición (es un supuesto, una propuesta o un dato declarado): no se deriva sobre ella`, [idc]);
  return {
    ok: true,
    op: {
      id: idc, entregaN: n, entidad: h.sujeto != null ? h.sujeto : (v.sujeto != null ? v.sujeto : null), metrica: h.metrica != null ? h.metrica : (v.metrica != null ? v.metrica : null), valor: h.valor != null ? h.valor : (v.valor != null ? v.valor : null),
      raw: v.raw, unidad: v.unidad, clave: v.clave, dueno: v.dueno || "negocio", llave: llaveDeCifra({ tipo: v.tipo || null, clave: v.clave, dueno: v.dueno, unidad: v.unidad, procedencia: v.procedencia }), deListado: v.deListado === true,
      procedencia: v.procedencia, esReferencia: _esReferencia(v.clave), ...(v.origenRef ? { origenRef: v.origenRef } : {}),
    },
  };
}

/* ═══ 3 · LA ARITMÉTICA (pura, sobre crudos) ══════════════════════════════════════════════════════════════════════════════════════════════════ */
/** aritmeticaDeDerivacion(operacion, { sobre, base?, condicion? }) → { raw, unidad, clave, texto, m?, cumplen? } · `sobre` y `base` son [{raw, unidad, clave}]; `condicion` = { op, valor: <número en la escala del crudo> }.
 *  `cumplen` son POSICIONES dentro de `sobre` (compacto para el libro). La usan tanto `calcularDerivacion` (cuando se pide) como `revalidar.js:revalidarDerivacion` (con los crudos de hoy): UNA sola cuenta. Devuelve null si la operación no se puede calcular. */
export function aritmeticaDeDerivacion(operacion, { sobre = [], base = null, condicion = null } = {}) {
  const S = Array.isArray(sobre) ? sobre : [];
  if (operacion === "suma") {
    if (S.length < 2 || !S.every((x) => _finito(x.raw))) return null;
    const raw = _limpio(S.reduce((a, x) => a + x.raw, 0));
    return { raw, unidad: S[0].unidad, clave: S[0].clave, texto: formatoDeLaCasa(raw, S[0].unidad) };
  }
  if (operacion === "diferencia") {
    if (S.length !== 2 || !S.every((x) => _finito(x.raw))) return null;
    const raw = _limpio(S[0].raw - S[1].raw);
    const unidad = S[0].unidad === "pct" ? "pp" : S[0].unidad;
    return { raw, unidad, clave: S[0].clave === S[1].clave ? S[0].clave : null, texto: formatoDeLaCasa(raw, unidad) };
  }
  if (operacion === "participacion") {
    if (!S.length || !base || !S.every((x) => _finito(x.raw)) || !_finito(base.raw) || !(base.raw > 0)) return null;
    const suma = _limpio(S.reduce((a, x) => a + x.raw, 0));
    if (suma > base.raw * (1 + 1e-9)) return null;   /* los numeradores no pueden superar la base (con los crudos de hoy tampoco: una participación de más de 100 % no es una cifra) */
    const raw = _limpio((100 * suma) / base.raw);
    return { raw, unidad: "pct", clave: "participacion", texto: formatoDeLaCasa(raw, "pct") };
  }
  if (operacion === "razon") {
    if (S.length !== 1 || !base || !_finito(S[0].raw) || !_finito(base.raw) || !(S[0].raw > 0) || !(base.raw > 0)) return null;
    const raw = _limpio(S[0].raw / base.raw);
    return { raw, unidad: "veces", clave: "razon", texto: textoDeVeces(raw) };
  }
  if (operacion === "conteo") {
    if (!S.length || !condicion || !OPERADORES.includes(condicion.op) || !_finito(condicion.valor) || !S.every((x) => _finito(x.raw))) return null;
    const e = 1e-9;
    const cumple = (a, b) => (condicion.op === ">" ? a - b > e : condicion.op === ">=" ? a - b >= -e : condicion.op === "<" ? b - a > e : condicion.op === "<=" ? b - a >= -e : Math.abs(a - b) <= e);
    const cumplen = [];
    S.forEach((x, i) => { if (cumple(x.raw, condicion.valor)) cumplen.push(i); });
    return { raw: cumplen.length, unidad: "count", clave: null, texto: `${cumplen.length} de ${S.length}`, m: S.length, cumplen };
  }
  return null;
}

/* ═══ 4 · VALIDAR ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
/** validarDerivacion(libro, pedido, { tenantId? }) → { ok:true, operacion, operandos, base, condicion, contexto } | { ok:false, motivo, detalle, ids? }
 *  pedido = { conversacionId, operacion, sobre:[id], base?:id, condicion?:{op, valor: número | id} } · `libro` = el libro de la conversación (o null: no existe). Puro: no escribe nada. Cada rechazo trae su motivo cerrado
 *  (`MOTIVOS_DE_DERIVACION`) y una frase de negocio. */
export function validarDerivacion(libro, pedido, { tenantId = null, deBodega = null } = {}) {
  const p = pedido && typeof pedido === "object" ? pedido : {};
  if (!p.conversacionId || typeof p.conversacionId !== "string") return _rechazo("falta_conversacion", "falta conversacionId: derivar se hace sobre cifras entregadas en una conversación con ADI");
  if (!libro) return _rechazo("conversacion_inexistente", "no existe una conversación con ese id: derive sobre cifras entregadas en una conversación abierta con consultar");
  if (libro.empresaId && tenantId && libro.empresaId !== tenantId) return _rechazo("otra_empresa", "esta conversación es de otra empresa");
  const operacion = p.operacion;
  if (!OPERACIONES.includes(operacion)) return _rechazo("operacion_desconocida", `la operación «${typeof operacion === "string" ? operacion : JSON.stringify(operacion)}» no existe: use ${OPERACIONES.join(", ")}`);

  const sobre = Array.isArray(p.sobre) ? p.sobre : [];
  const minimo = operacion === "suma" || operacion === "diferencia" ? 2 : 1;
  if (sobre.length < minimo) return _rechazo("faltan_operandos", `«${operacion}» pide ${operacion === "participacion" ? "al menos un identificador en «sobre» (el numerador; varios si es un grupo) y otro en «base»" : operacion === "razon" ? "un identificador en «sobre» (la cifra que se compara) y otro en «base» (aquella respecto de la cual se compara)" : operacion === "conteo" ? "al menos un identificador en «sobre»" : "al menos dos identificadores en «sobre»"}`);
  const maximo = operacion === "diferencia" || operacion === "razon" ? (operacion === "razon" ? 1 : 2) : OPERANDOS_MAX;
  if (sobre.length > maximo) return _rechazo("demasiados_operandos", operacion === "diferencia" ? "«diferencia» resta exactamente dos cifras (la primera menos la segunda)" : operacion === "razon" ? "«razon» compara UNA cifra (en «sobre») con otra (en «base»): cuántas veces es la primera respecto de la segunda" : `se pueden derivar hasta ${OPERANDOS_MAX} cifras a la vez (llegaron ${sobre.length})`);
  if ((operacion === "participacion" || operacion === "razon") && (typeof p.base !== "string" || !p.base.trim())) return _rechazo("faltan_operandos", `«${operacion}» necesita la base: el identificador de la cifra ${operacion === "razon" ? "respecto de la cual se compara" : "contra la que se calcula"}, en «base»`);

  const indice = _indiceDelLibro(libro);
  const operandos = [];
  for (const id of sobre) { const r = _resolverId(libro, indice, id); if (!r.ok) return r; operandos.push(r.op); }
  let base = null;
  if (operacion === "participacion" || operacion === "razon") { const r = _resolverId(libro, indice, p.base); if (!r.ok) return r; base = r.op; }
  const todos = base ? [...operandos, base] : operandos;

  /* una condición con valor-id: otra cifra entregada contra la que se compara */
  let condicion = null, referencia = null;
  if (operacion === "conteo") {
    const c = p.condicion;
    if (!c || typeof c !== "object" || !OPERADORES.includes(c.op)) return _rechazo("condicion_invalida", `«conteo» pide una «condicion» { op, valor } con op en ${OPERADORES.join(" ")} y valor = un número o el identificador de otra cifra entregada`);
    if (typeof c.valor === "string") { const r = _resolverId(libro, indice, c.valor); if (!r.ok) return r; referencia = r.op; condicion = { op: c.op, valor: r.op.id }; }
    else if (_finito(c.valor)) condicion = { op: c.op, valor: c.valor };
    else return _rechazo("condicion_invalida", "el «valor» de la condición debe ser un número o el identificador de una cifra entregada");
  }

  /* LA VENTA NO SE ABRE POR BODEGA (ensayo 6): ningún agregado de una métrica COMERCIAL sobre cifras que salen de un universo definido por bodega — ni directas ni a través del linaje de una derivación. `deBodega(hoja)` (lo pone quien tiene los universos del libro) dice
   * { bodegas } si la cifra sale solo de universos de bodega; sin ese verificador la regla no corre (derivar.js no sabe de universos). */
  if (typeof deBodega === "function") {
    const malas = [], bodegas = [];
    for (const x of referencia ? todos.concat([referencia]) : todos) for (const h of _hojasDe(x)) {
      if (h.derivada || h.esReferencia || !esMetricaComercial(h.clave)) continue;
      const r = deBodega(h);
      if (r) { malas.push(h.id); for (const b of (r.bodegas || [])) if (!bodegas.includes(b)) bodegas.push(b); }
    }
    if (malas.length) return _rechazo(MOTIVO_VENTA_POR_BODEGA, textoDeLaLey({ bodegas, enDerivacion: true }), [...new Set(malas)]);
  }

  /* los operandos entre sí */
  const vistos = new Set(), llaves = new Set();
  for (const x of todos) {
    if (vistos.has(x.id) || llaves.has(x.llave)) return _rechazo("operando_repetido", `la cifra ${x.id} ya está entre los operandos (el mismo identificador, o la misma cifra de otra Entrega): se contaría dos veces`, [x.id]);
    vistos.add(x.id); llaves.add(x.llave);
  }
  /* EL GRUPO QUE SE SUMA (una suma, un conteo, los numeradores de una participación de varios): ninguna cifra entregada puede estar dos veces dentro del grupo, ni directa ni a través del linaje de una derivación (la suma de D1 = a+b y a contaría a dos veces) */
  const sumandos = operacion === "suma" || operacion === "conteo" || (operacion === "participacion" && operandos.length > 1) ? operandos : null;
  if (sumandos && sumandos.some((x) => x.derivada)) {
    const vistas = new Map();
    for (const x of sumandos) for (const h of _hojasDe(x)) for (const k of [`id|${h.id}`, `llave|${h.llave}`]) {
      if (vistas.has(k) && vistas.get(k) !== x.id) return _rechazo("operando_repetido", `la cifra ${h.id} está en ${vistas.get(k)} y en ${x.id}: se contaría dos veces`, [h.id, vistas.get(k), x.id]);
      vistas.set(k, x.id);
    }
  }
  const unidades = new Set(todos.concat(referencia ? [referencia] : []).map((x) => x.unidad));
  if (unidades.size > 1) return _rechazo("unidades_distintas", `las cifras están en unidades distintas (${[...unidades].join(", ")}): no se derivan juntas`, todos.map((x) => x.id));
  const entregas = [...new Set(todos.concat(referencia ? [referencia] : []).flatMap(_entregasDe))].map((n) => indice.get(n).entrega);
  if (entregas.length > 1) {
    if (new Set(entregas.map((e) => _periodoClave(e.periodo))).size > 1) return _rechazo("otro_periodo", "las cifras son de períodos distintos: no se derivan juntas", todos.map((x) => x.id));
    if (new Set(entregas.map((e) => e.moneda || "")).size > 1) return _rechazo("otra_moneda", "las cifras son de monedas distintas: no se derivan juntas", todos.map((x) => x.id));
    if (new Set(entregas.map((e) => (e.versionId == null ? "" : String(e.versionId)))).size > 1) return _rechazo("otra_carga", "las cifras son de cargas de datos distintas: no se derivan juntas", todos.map((x) => x.id));
  }
  const claves = new Set(todos.concat(referencia ? [referencia] : []).map((x) => x.clave));
  /* las métricas que tienen que coincidir: en una suma o un conteo, las de TODAS las cifras (y la de comparación); en una participación de varios numeradores, las de los numeradores entre sí (la base puede ser de otra métrica de la misma cuenta: más abajo) */
  const clavesDelGrupo = operacion === "participacion" || operacion === "razon" || (operacion === "conteo" && referencia) ? new Set(operandos.map((x) => x.clave)) : claves;

  if (sumandos) {
    const agrupa = operacion === "suma" ? "se suman" : operacion === "conteo" ? "se cuentan" : "se agrupan como numerador";
    /* contar contra una referencia (cuántos márgenes están bajo el benchmark): la referencia es de la métrica que se cuenta, o es de otra y no se compara */
    const referenciaIncompatible = operacion === "conteo" && referencia && clavesDelGrupo.size === 1 && !clavesComparables(referencia.clave, [...clavesDelGrupo][0]);
    if (clavesDelGrupo.size !== 1 || sumandos.some((x) => !x.clave) || referenciaIncompatible) {
      const sinMetrica = sumandos.find((x) => !x.clave);
      return _rechazo("metricas_distintas", sinMetrica && clavesDelGrupo.size === 1 && !referenciaIncompatible ? `${sinMetrica.id} no tiene una métrica única (sale de métricas distintas): solo ${agrupa} cifras de la misma métrica` : `las cifras son de métricas distintas (${[...claves].map(_nombre).join(", ")}): solo ${agrupa} cifras de la misma métrica${referenciaIncompatible ? " (una referencia solo se compara con la métrica de la que es referencia)" : ""}`, todos.concat(referencia ? [referencia] : []).map((x) => x.id));
    }
    /* un total del listado ya contiene a sus filas; una derivación que sale de él también (su linaje lo trae) */
    const conTotal = sumandos.find((x) => _hojasDe(x).some((h) => h.deListado));
    if (conTotal) {
      const t = _hojasDe(conTotal).find((h) => h.deListado);
      return _rechazo("operando_es_total", conTotal.derivada
        ? `${conTotal.id} se calcula sobre ${t.id}, el total de un listado: ya contiene a sus filas, así que no entra en ${operacion === "suma" ? "una suma" : operacion === "conteo" ? "un conteo" : "el grupo de numeradores"} (se contaría dos veces)`
        : `${conTotal.id} es el total de un listado: ya contiene a sus filas, así que no entra en ${operacion === "suma" ? "una suma" : operacion === "conteo" ? "un conteo" : "el grupo de numeradores de una participación"} (se contaría dos veces)`, [conTotal.id]);
    }
  }
  if (operacion === "suma" || (operacion === "participacion" && operandos.length > 1)) {
    const m = metricaPorClave(operandos[0].clave);
    if (!m || m.referencia || m.negocio || m.tasa || (m.unidad !== "money" && m.unidad !== "count") || (operandos[0].unidad !== "money" && operandos[0].unidad !== "count")) return _rechazo("metrica_no_aditiva", `«${_nombre(operandos[0].clave)}» no se suma (un porcentaje, un promedio, unos días o una razón no son aditivos): se resta o se cuenta, o se pide a ADI`, operandos.map((x) => x.id));
  }
  if (operacion === "diferencia" || operacion === "participacion" || operacion === "razon") {
    /* el numerador de una participación de varios es UN grupo: su métrica es la de todos y su dueño, el conjunto de los dueños */
    const num = operacion === "diferencia" ? operandos[0] : { ...operandos[0], dueno: operandos.length > 1 ? [...new Set(operandos.map((x) => _dueno(x.dueno)))].join(" + ") : operandos[0].dueno, id: operandos.map((x) => x.id).join(" + ") };
    const [a, b] = operacion === "diferencia" ? [operandos[0], operandos[1]] : [num, base];
    if (operacion === "razon") {
      /* una razón compara la MISMA métrica (de dos cuentas, de dos grupos) o una métrica con su referencia: no dos métricas distintas de una misma cuenta (eso es una participación) */
      if (!clavesComparables(a.clave, b.clave)) return _rechazo("metricas_distintas", `${a.id} y ${b.id} son de métricas distintas (${_nombre(a.clave) || "sin métrica única"} y ${_nombre(b.clave) || "sin métrica única"}): una razón compara la misma métrica, o una métrica con su referencia`, [a.id, b.id]);
    } else if (!clavesComparables(a.clave, b.clave) && _dueno(a.dueno) !== _dueno(b.dueno)) return _rechazo("metricas_distintas", `${a.id} y ${b.id} son de métricas distintas (${_nombre(a.clave)} y ${_nombre(b.clave)}) y de dueños distintos: solo se relacionan dos métricas de una misma cuenta, o una métrica con su referencia`, operacion === "diferencia" ? [a.id, b.id] : [...operandos.map((x) => x.id), b.id]);
  }
  if (operacion === "razon") {
    const noPositivo = [operandos[0], base].find((x) => !(x.raw > 0));
    if (noPositivo) return _rechazo("operando_no_positivo", `${noPositivo.id} ${noPositivo.raw === 0 ? "es cero" : "es negativa"}: una razón (cuántas veces es una cifra respecto de otra) se calcula entre cifras positivas`, [noPositivo.id]);
  }
  if (operacion === "participacion") {
    const num = operandos[0];
    if (num.unidad !== "money" && num.unidad !== "count") return _rechazo("unidad_no_participable", "una participación se calcula sobre dinero o cantidades; un porcentaje, unos días o una razón no tienen participación", [...operandos.map((x) => x.id), base.id]);
    const negativo = operandos.find((x) => x.raw < 0) || (base.raw < 0 ? base : null);
    if (negativo) return _rechazo("operando_negativo", "una participación no se calcula con una cifra negativa", [negativo.id]);
    if (base.raw === 0) return _rechazo("base_cero", `la base ${base.id} es cero: no hay participación`, [base.id]);
    const sumaNum = _limpio(operandos.reduce((a, x) => a + x.raw, 0));
    if (sumaNum > base.raw) return _rechazo("numerador_mayor_que_base", `${operandos.length > 1 ? `los numeradores suman más que la base ${base.id}` : `${num.id} es mayor que la base ${base.id}`}: una participación no supera el 100 %. Si lo que busca es cuántas veces es una cifra respecto de otra, use la operación «razon» (en «sobre» la cifra, en «base» aquella respecto de la cual se compara)`, [...operandos.map((x) => x.id), base.id]);
  }
  if (operacion === "conteo" && typeof condicion.valor === "number" && operandos[0].unidad === "money" && condicion.valor !== 0) {
    return _rechazo("condicion_invalida", "para dinero, la condición compara contra 0 o contra otra cifra entregada (su identificador): una cantidad suelta es ambigua en su escala");
  }
  /* el linaje de una derivación ENCADENADA (la que tiene una derivación entre sus operandos): las cifras entregadas de las que sale, a través de todas las cadenas; se guarda con ella para no depender de que las derivaciones intermedias sigan en el libro */
  const todasConRef = todos.concat(referencia ? [referencia] : []);
  const linaje = todasConRef.some((x) => x.derivada) ? [...new Set(todasConRef.flatMap((x) => _hojasDe(x).map((h) => h.id)))] : null;
  return { ok: true, operacion, operandos, base, condicion, referencia, linaje, contexto: { versionId: entregas[0].versionId == null ? null : entregas[0].versionId, periodo: _periodoTexto(entregas[0].periodo), moneda: entregas[0].moneda || null } };
}

/* ═══ 5 · CALCULAR (con su rótulo) ════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
const _unir = (xs, tope = 120) => { const s = xs.filter(Boolean).join(" + "); return s.length <= tope ? s : `${xs.length} entidades entregadas`; };

/* cuando un lado es una REFERENCIA, el rótulo lo dice con de quién es: «(referencia, declarado por la empresa)» — nunca una referencia presentada como criterio de la empresa */
const _notaDeReferencia = (ops) => { const r = ops.find((x) => x && x.esReferencia); return r ? ` (${rotuloDeProcedencia(r)})` : ""; };

/** calcularDerivacion(validada) → { resultado: { raw, unidad, clave, texto, m? , cumplen? }, entidad, metrica } · `validada` es lo que devolvió `validarDerivacion` con `ok:true`. El rótulo dice qué es la cifra: su métrica, su base (una tasa lleva su
 *  base junto a la cifra, ley de `notario/tasas.js`) y, en un conteo, su condición. */
export function calcularDerivacion(v) {
  const S = v.operandos.map((x) => ({ raw: x.raw, unidad: x.unidad, clave: x.clave }));
  const a = aritmeticaDeDerivacion(v.operacion, {
    sobre: S, base: v.base ? { raw: v.base.raw, unidad: v.base.unidad, clave: v.base.clave } : null,
    condicion: v.condicion ? { op: v.condicion.op, valor: v.referencia ? v.referencia.raw : v.condicion.valor } : null,
  });
  if (!a) return null;
  const nom = (x) => _nombre(x.clave);
  let entidad = null, metrica = null;
  if (v.operacion === "suma") { entidad = _unir(v.operandos.map((x) => x.entidad)); metrica = `${nom(v.operandos[0])} · suma de ${v.operandos.length} cifras entregadas`; }
  else if (v.operacion === "diferencia") {
    const [x, y] = v.operandos;
    const mismoDueno = _dueno(x.dueno) === _dueno(y.dueno);
    /* una referencia («negocio») no es una entidad: si un lado es la referencia, la cifra es de la cuenta contra la que se compara */
    const conReferencia = x.esReferencia !== y.esReferencia;
    entidad = mismoDueno ? (x.entidad || null) : conReferencia ? ((x.esReferencia ? y : x).entidad || null) : [x.entidad, y.entidad].filter(Boolean).join(" − ") || null;
    metrica = x.clave === y.clave ? `${nom(x)} · diferencia${mismoDueno ? "" : " (primera menos segunda)"}` : `${nom(x)} − ${nom(y)}${_notaDeReferencia([x, y])}`;
  } else if (v.operacion === "razon") {
    const [x] = v.operandos, b = v.base;
    entidad = x.entidad || null;
    metrica = x.clave === b.clave ? `${nom(x)} · veces respecto de ${b.entidad || b.metrica || b.id}${b.valor ? ` (${b.valor})` : ""}` : `${nom(x)} ÷ ${nom(b)} · veces${_notaDeReferencia([x, b])}`;
  } else if (v.operacion === "participacion") {
    const [x] = v.operandos, b = v.base, varios = v.operandos.length > 1;
    entidad = varios ? _unir(v.operandos.map((o) => o.entidad)) : (x.entidad || null);
    metrica = x.clave === b.clave ? `${nom(x)} · participación${varios ? ` de ${v.operandos.length} cifras entregadas` : ""} sobre ${b.entidad || b.metrica || b.id}${b.valor ? ` (${b.valor})` : ""}` : `${nom(x)} ÷ ${nom(b)} · participación${varios ? ` de ${v.operandos.length} cifras entregadas` : ""}`;
  } else {
    const ref = v.referencia ? (v.referencia.valor || formatoDeLaCasa(v.referencia.raw, v.referencia.unidad)) : formatoDeLaCasa(v.condicion.valor, v.operandos[0].unidad);
    metrica = `${nom(v.operandos[0])} · cifras entregadas (${v.operandos.length}) ${_FRASE_DE_OPERADOR[v.condicion.op]} ${ref}${v.referencia ? _notaDeReferencia([v.referencia]) : ""}`;
  }
  const { cumplen, ...resultado } = a;
  return { resultado: { ...resultado, ...(cumplen ? { cumplen } : {}) }, entidad, metrica };
}

/** derivacionParaElLibro(pedido, validada, calculada) → lo que `libro.js:registrarDerivacion` guarda (sin el id, que lo pone el libro): compacto a propósito (el tope de 16 KB lo exige la base). */
export function derivacionParaElLibro(pedido, v, c) {
  return {
    operacion: v.operacion, sobre: v.operandos.map((x) => x.id),
    ...(v.linaje ? { linaje: v.linaje } : {}),
    ...(v.base ? { base: v.base.id } : {}), ...(v.condicion ? { condicion: { op: v.condicion.op, valor: v.condicion.valor } } : {}),
    resultado: c.resultado, entidad: c.entidad, metrica: c.metrica,
    versionId: v.contexto.versionId, periodo: v.contexto.periodo, moneda: v.contexto.moneda,
    /* la procedencia de cada lado, SOLO cuando algún operando no es una medición a secas (una referencia o una estimación contra una referencia): [{ id, p: procedencia, r?: 1 si es una referencia, o?: de quién es }] */
    ...(_hayQueDecirProcedencia([...v.operandos, ...(v.base ? [v.base] : []), ...(v.referencia ? [v.referencia] : [])]) ? { procedencias: [...v.operandos, ...(v.base ? [v.base] : []), ...(v.referencia ? [v.referencia] : [])].filter((x) => !x.derivada).map((x) => ({ id: x.id, p: x.procedencia, ...(x.esReferencia ? { r: 1 } : {}), ...(x.origenRef ? { o: x.origenRef } : {}) })) } : {}),
  };
}

/* ═══ 5b · LA DESCRIPCIÓN DE UNA DERIVACIÓN ═══════════════════════════════════════════════════════════════════════════════════════════════════════
 * Qué ES la cifra, en una línea de negocio: la operación, la métrica y los dueños de los operandos («Venta: suma de RC-0377, RC-0633 y RC-0415»; «Venta: participación de A, B y C (los 3 de mayor venta) sobre total del listado completo (13 clientes)»).
 * Sale SOLO de lo que el libro ya guarda (la derivación y las cifras que la sostienen) — no se guarda aparte (el tope de 16 KB es de la base) y no cambia el valor: el anfitrión que la lee sin haberla pedido sabe de qué conjunto es.
 * Una cifra derivada de otra se nombra por su id (`D1`): su descripción viaja en el mismo `retomar`. */
const _TOPE_NOMBRES = 6;
const _enumerar = (xs) => {
  if (xs.length <= 1) return xs.join("");
  const ver = xs.length <= _TOPE_NOMBRES ? xs : [...xs.slice(0, _TOPE_NOMBRES - 1), `${xs.length - (_TOPE_NOMBRES - 1)} más`];
  return `${ver.slice(0, -1).join(", ")} y ${ver[ver.length - 1]}`;
};
function _rotuloDeOperando(id, o) {
  if (_ID_DE_DERIVACION.test(String(id)) || !o) return String(id);
  if (o.entidad) return String(o.entidad);
  const m = String(o.metrica || "");   // un total no tiene dueño: «Venta · total del listado completo (13 clientes)» → «total del listado completo (13 clientes)»
  const i = m.indexOf(" · ");
  return i >= 0 ? m.slice(i + 3) : (m || String(id));
}
const _CORTE_DE_DESCRIPCION = 240;
/* la unidad de una cifra según cómo se imprimió («$23.4M» dinero · «28.4%» porcentaje · «12d» días · «2.3x» razón · «3.1pp» puntos · lo demás, una cantidad): la derivación guarda la condición de un conteo en la escala del crudo, no la unidad de los operandos */
const _unidadDeLoImpreso = (v) => { const t = String(v == null ? "" : v).trim(); return /pp$/.test(t) ? "pp" : /%$/.test(t) ? "pct" : /^[-+−]?\$/.test(t) ? "money" : /\d\s?(d|días?)$/.test(t) ? "days" : /\dx$/.test(t) ? "ratio" : "count"; };
/** describirDerivacion(d, operandosPorId) → string · `operandosPorId`: Map id → { entidad, metrica, valor, universo? } (cómo se entregó cada cifra; `universo` = el conjunto acotado del que sale, si lo hay) */
export function describirDerivacion(d, operandosPorId) {
  if (!d || !Array.isArray(d.sobre)) return "";
  const O = operandosPorId instanceof Map ? operandosPorId : new Map();
  const rot = (id) => _rotuloDeOperando(id, O.get(id));
  const M = String(d.metrica || "").split(" · ")[0];
  const nombres = d.sobre.map(rot);
  /* el conjunto del que salen los operandos, cuando todos salen del mismo conjunto acotado (los que son derivaciones se explican solos) */
  const universos = [...new Set(d.sobre.filter((id) => !_ID_DE_DERIVACION.test(String(id))).map((id) => (O.get(id) || {}).universo || ""))];
  const nota = universos.length === 1 && universos[0] && d.sobre.every((id) => !_ID_DE_DERIVACION.test(String(id)) && (O.get(id) || {}).universo) ? ` (${universos[0]})` : "";
  const encadenada = Array.isArray(d.linaje) && d.linaje.length ? ` (${d.linaje.length} cifras entregadas en total)` : "";
  let t = "";
  if (d.operacion === "suma") t = `${M}: suma de ${_enumerar(nombres)}${nota}${encadenada}`;
  else if (d.operacion === "diferencia") t = `${M}: ${nombres[0]} menos ${nombres[1]}`;
  else if (d.operacion === "participacion") t = `${M}: participación de ${_enumerar(nombres)}${nota} sobre ${rot(d.base)}`;
  else if (d.operacion === "razon") t = `${M}: cuántas veces es ${nombres[0]} respecto de ${rot(d.base)}`;
  else if (d.operacion === "conteo") {
    const c = d.condicion || {};
    const ref = typeof c.valor === "string" ? rot(c.valor) : (_finito(c.valor) ? formatoDeLaCasa(c.valor, _unidadDeLoImpreso((O.get(d.sobre[0]) || {}).valor)) : "");
    t = `${M}: cuántas de las ${d.sobre.length} cifras (${_enumerar(nombres)}) son ${_FRASE_DE_OPERADOR[c.op] || c.op} ${ref}`.trim();
  }
  return t.length > _CORTE_DE_DESCRIPCION ? `${t.slice(0, _CORTE_DE_DESCRIPCION - 1)}…` : t;
}

/** respuestaDeLaDerivacion(d, opciones) → { hecho, operandos, base?, condicion?, cumplen?, noCumplen? } · la forma que viaja al anfitrión, de la derivación guardada y de las cifras que la sostienen (`operandosPorId`: Map id → {entidad, metrica, valor}). */
export function respuestaDeLaDerivacion(d, operandosPorId) {
  /* la procedencia de cada lado, cuando la derivación la guardó (hay una referencia o una estimación contra una referencia): lo medido es «medido»; la referencia, «referencia» con de quién es */
  const procs = new Map((Array.isArray(d.procedencias) ? d.procedencias : []).map((p) => [p.id, p]));
  const rotulo = (p) => rotuloDeProcedencia({ procedencia: p.p, esReferencia: p.r === 1, origenRef: p.o });
  const pos = (id) => {
    const o = operandosPorId.get(id) || {};
    const p = procs.get(id);
    return { id, ...(o.entidad != null ? { entidad: o.entidad } : {}), ...(o.metrica != null ? { metrica: o.metrica } : {}), ...(o.valor != null ? { valor: o.valor } : {}), ...(o.procedencia === "derivado" ? { procedencia: "derivado", ...(Array.isArray(o.derivaDe) && o.derivaDe.length ? { derivaDe: o.derivaDe.slice() } : {}) } : (p ? { procedencia: p.r === 1 ? "referencia" : p.p, ...(p.r === 1 || p.p !== "medido" ? { origen: rotulo(p) } : {}) } : {})) };
  };
  const r = d.resultado || {};
  const out = {
    hecho: { id: d.id, operacion: d.operacion, sobre: d.sobre.slice(), ...(d.base ? { base: d.base } : {}), ...(Array.isArray(d.linaje) && d.linaje.length ? { linaje: d.linaje.slice() } : {}), ...(d.entidad != null ? { entidad: d.entidad } : {}), metrica: d.metrica, valor: r.texto, procedencia: "derivado", descripcion: describirDerivacion(d, operandosPorId), ...(procs.size ? { procedencias: [...new Set([...procs.values()].map(rotulo))] } : {}) },
    operandos: d.sobre.map(pos),
  };
  if (d.base) out.base = pos(d.base);
  if (d.condicion) out.condicion = { op: d.condicion.op, valor: d.condicion.valor, ...(typeof d.condicion.valor === "string" ? { referencia: pos(d.condicion.valor) } : {}) };
  if (d.operacion === "conteo" && Array.isArray(r.cumplen)) {
    const set = new Set(r.cumplen);
    out.cumplen = d.sobre.filter((_, i) => set.has(i));
    out.noCumplen = d.sobre.filter((_, i) => !set.has(i));
  }
  return out;
}
