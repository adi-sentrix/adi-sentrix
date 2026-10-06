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
 * DECISIONES QUE EL DISEÑO NO CUBRÍA (la opción conservadora, a revisión del owner): (a) un TOTAL DEL LISTADO (`deListado`) no entra a una suma ni a un conteo —sumaría dos veces lo que ya contiene— pero sí a una
 * diferencia o a una participación (total − top-3 · una fila ÷ su total): `operando_es_total`; (b) una participación no se calcula con un numerador o una base NEGATIVOS: `operando_negativo`; (c) una diferencia o
 * participación entre métricas distintas exige el MISMO dueño («Saldo pendiente − Saldo vencido» de una cuenta): dos métricas y dos dueños a la vez no es una cifra del negocio — `metricas_distintas`; (d) el conteo de
 * DINERO contra una cantidad suelta solo admite 0 (la escala de «5» —¿$5 o $5M?— es ambigua): contra otra cifra entregada (su id) admite cualquier valor. */
import { cifrasDeLaEntrega, llaveDeCifra } from "../continuidad/revalidar.js";
import { formatoDeLaCasa } from "../notario/hechos.js";
import { metricaPorClave, metricaDeClave } from "../notario/lexico.js";
import { normalizar } from "../notario/afirmacion.js";

export const OPERACIONES = Object.freeze(["suma", "diferencia", "participacion", "conteo"]);
export const OPERADORES = Object.freeze([">", ">=", "<", "<=", "="]);
/** lo que un universo lista a la vista (= `compacto.js:ENTIDADES_DE_UN_UNIVERSO_MAX`; el gate lo iguala: acá no se importa para no cerrar un ciclo con `acciones.js`) */
export const OPERANDOS_MAX = 40;
export const MOTIVOS_DE_DERIVACION = Object.freeze([
  "falta_conversacion", "conversacion_inexistente", "otra_empresa",
  "operacion_desconocida", "faltan_operandos", "demasiados_operandos",
  "id_invalido", "id_inexistente", "entrega_recortada",
  "operando_sin_valor_exacto", "operando_no_medido", "operando_repetido", "operando_es_total", "operando_negativo",
  "unidades_distintas", "metricas_distintas", "metrica_no_aditiva",
  "otro_periodo", "otra_moneda", "otra_carga",
  "base_cero", "numerador_mayor_que_base", "unidad_no_participable", "condicion_invalida",
]);
const _PROCEDENCIAS_ADMITIDAS = new Set(["medido", "derivado", "estimacion_referencia"]);   /* una brecha también se suma; un supuesto o una propuesta no */
const _ID_DE_CIFRA = /^E(\d+)\.h(\d+)(?:\.(\d+))?$/;
const _finito = (x) => typeof x === "number" && Number.isFinite(x);
const _limpio = (x) => Number((+x).toPrecision(12));   /* sin el ruido de coma flotante: 33.3 − 21.5 = 11.8, no 11.799999999999997 */
const _rechazo = (motivo, detalle, ids) => ({ ok: false, motivo, detalle, ...(ids && ids.length ? { ids } : {}) });
const _periodoClave = (p) => (p && typeof p === "object" ? `${p.texto || ""}|${p.rango || ""}` : p ? String(p) : "");
const _periodoTexto = (p) => (p && typeof p === "object" ? (p.texto || p.rango || null) : (p || null));
const _nombre = (clave) => (clave ? metricaDeClave(clave) : "");
const _dueno = (d) => String(d == null ? "negocio" : d).split(" + ").map((x) => normalizar(x)).join(" + ");
const _FRASE_DE_OPERADOR = { ">": "mayores que", ">=": "mayores o iguales que", "<": "menores que", "<=": "menores o iguales que", "=": "iguales a" };

/* ═══ 1 · EL PEDIDO ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
/** llaveDeDerivacion({operacion, sobre, base?, condicion?}) → string · la IDENTIDAD de una derivación (para la idempotencia): misma operación, mismos operandos, misma base, misma condición. La suma y el conteo no dependen del orden
 *  de los operandos; la diferencia sí (primero − segundo). */
export function llaveDeDerivacion(p) {
  const sobre = Array.isArray(p && p.sobre) ? p.sobre.map(String) : [];
  const orden = p && p.operacion === "diferencia" ? sobre : sobre.slice().sort();
  const c = p && p.condicion && typeof p.condicion === "object" ? `${p.condicion.op}|${typeof p.condicion.valor === "number" ? `n:${p.condicion.valor}` : `id:${p.condicion.valor}`}` : "";
  return [p && p.operacion, orden.join(","), p && p.operacion === "participacion" ? String(p.base || "") : "", p && p.operacion === "conteo" ? c : ""].join("¦");
}

/* ═══ 2 · LAS CIFRAS DEL LIBRO ════════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
/* el índice de lo entregable: Entrega n → { entrega, porId: Map id → cifra (una por cifra: las filas anchas ya vienen abiertas) } — solo de las Entregas que conservan sus hechos */
function _indiceDelLibro(libro) {
  const idx = new Map();
  for (const e of (libro && Array.isArray(libro.entregas) ? libro.entregas : [])) {
    if (!e || typeof e !== "object") continue;
    const porId = new Map();
    if (!e.recortada) for (const h of cifrasDeLaEntrega(e)) if (h && h.id) porId.set(h.id, h);
    idx.set(e.n, { entrega: e, porId });
  }
  return idx;
}

/** cifrasDeLosOperandos(libro, ids) → Map id → { entidad, metrica, valor } · cómo se entregó cada cifra (lo que el anfitrión ve de un operando); una cifra que el libro ya no conserva simplemente no está en el mapa */
export function cifrasDeLosOperandos(libro, ids) {
  const indice = _indiceDelLibro(libro);
  const out = new Map();
  for (const id of ids || []) {
    const m = typeof id === "string" ? _ID_DE_CIFRA.exec(id) : null;
    const h = m && indice.get(Number(m[1])) ? indice.get(Number(m[1])).porId.get(id) : null;
    if (h) out.set(id, { entidad: h.sujeto != null ? h.sujeto : null, metrica: h.metrica != null ? h.metrica : null, valor: h.valor != null ? h.valor : null });
  }
  return out;
}

/* una cifra del libro → un operando con todo lo que la derivación necesita (y nada que haya que volver a calcular) */
function _resolverId(libro, indice, id) {
  const m = typeof id === "string" ? _ID_DE_CIFRA.exec(id.trim()) : null;
  if (!m) return _rechazo("id_invalido", `«${typeof id === "string" ? id : JSON.stringify(id)}» no es el identificador de una cifra entregada (E<n>.h<k>): solo se deriva sobre cifras que ADI ya entregó en esta conversación`, [String(id)]);
  const idc = id.trim();
  const n = Number(m[1]);
  const ent = indice.get(n);
  if (!ent) {
    const turno = libro && Number.isInteger(libro.turno) ? libro.turno : 0;
    if (!indice.size) return _rechazo("id_inexistente", `la conversación todavía no tiene ninguna Entrega: ${idc} no existe`, [idc]);
    if (n >= 1 && n <= turno) return _rechazo("id_inexistente", `la Entrega E${n} ya no se conserva en la conversación (el libro recorta las más viejas): ${idc} no existe`, [idc]);
    return _rechazo("id_inexistente", `la conversación no tiene la Entrega E${n}: ${idc} no existe`, [idc]);
  }
  if (ent.entrega.recortada) return _rechazo("entrega_recortada", `la Entrega E${n} se recortó por tamaño: ya no conserva sus cifras, así que no se puede derivar sobre ${idc}`, [idc]);
  const h = ent.porId.get(idc);
  if (!h) return _rechazo("id_inexistente", `la Entrega E${n} no tiene la cifra ${idc}`, [idc]);
  const v = h.rv && typeof h.rv === "object" ? h.rv : null;
  if (!v || !_finito(v.raw) || !v.clave || !v.unidad) return _rechazo("operando_sin_valor_exacto", `la cifra ${idc} se entregó sin valor exacto (es de antes de que ADI lo conservara, o es una cifra de proyección): no se puede derivar sobre ella`, [idc]);
  if (v.deSupuesto === true || (v.titular && v.titular !== "medido") || !_PROCEDENCIAS_ADMITIDAS.has(v.procedencia)) return _rechazo("operando_no_medido", `la cifra ${idc} no es una medición (es un supuesto, una propuesta o un dato declarado): no se deriva sobre ella`, [idc]);
  return {
    ok: true,
    op: {
      id: idc, entregaN: n, entidad: h.sujeto != null ? h.sujeto : (v.sujeto != null ? v.sujeto : null), metrica: h.metrica != null ? h.metrica : (v.metrica != null ? v.metrica : null), valor: h.valor != null ? h.valor : (v.valor != null ? v.valor : null),
      raw: v.raw, unidad: v.unidad, clave: v.clave, dueno: v.dueno || "negocio", llave: llaveDeCifra({ tipo: v.tipo || null, clave: v.clave, dueno: v.dueno, unidad: v.unidad, procedencia: v.procedencia }), deListado: v.deListado === true,
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
    if (S.length !== 1 || !base || !_finito(S[0].raw) || !_finito(base.raw) || !(base.raw > 0)) return null;
    const raw = _limpio((100 * S[0].raw) / base.raw);
    return { raw, unidad: "pct", clave: "participacion", texto: formatoDeLaCasa(raw, "pct") };
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
export function validarDerivacion(libro, pedido, { tenantId = null } = {}) {
  const p = pedido && typeof pedido === "object" ? pedido : {};
  if (!p.conversacionId || typeof p.conversacionId !== "string") return _rechazo("falta_conversacion", "falta conversacionId: derivar se hace sobre cifras entregadas en una conversación con ADI");
  if (!libro) return _rechazo("conversacion_inexistente", "no existe una conversación con ese id: derive sobre cifras entregadas en una conversación abierta con consultar");
  if (libro.empresaId && tenantId && libro.empresaId !== tenantId) return _rechazo("otra_empresa", "esta conversación es de otra empresa");
  const operacion = p.operacion;
  if (!OPERACIONES.includes(operacion)) return _rechazo("operacion_desconocida", `la operación «${typeof operacion === "string" ? operacion : JSON.stringify(operacion)}» no existe: use ${OPERACIONES.join(", ")}`);

  const sobre = Array.isArray(p.sobre) ? p.sobre : [];
  const minimo = operacion === "suma" || operacion === "diferencia" ? 2 : 1;
  if (sobre.length < minimo) return _rechazo("faltan_operandos", `«${operacion}» pide ${operacion === "participacion" ? "un identificador en «sobre» (el numerador) y otro en «base»" : operacion === "conteo" ? "al menos un identificador en «sobre»" : "al menos dos identificadores en «sobre»"}`);
  const maximo = operacion === "diferencia" ? 2 : operacion === "participacion" ? 1 : OPERANDOS_MAX;
  if (sobre.length > maximo) return _rechazo("demasiados_operandos", operacion === "diferencia" ? "«diferencia» resta exactamente dos cifras (la primera menos la segunda)" : operacion === "participacion" ? "«participacion» lleva un solo numerador en «sobre» y la base en «base»" : `se pueden derivar hasta ${OPERANDOS_MAX} cifras a la vez (llegaron ${sobre.length})`);
  if (operacion === "participacion" && (typeof p.base !== "string" || !p.base.trim())) return _rechazo("faltan_operandos", "«participacion» necesita la base: el identificador de la cifra contra la que se calcula, en «base»");

  const indice = _indiceDelLibro(libro);
  const operandos = [];
  for (const id of sobre) { const r = _resolverId(libro, indice, id); if (!r.ok) return r; operandos.push(r.op); }
  let base = null;
  if (operacion === "participacion") { const r = _resolverId(libro, indice, p.base); if (!r.ok) return r; base = r.op; }
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

  /* los operandos entre sí */
  const vistos = new Set(), llaves = new Set();
  for (const x of todos) {
    if (vistos.has(x.id) || llaves.has(x.llave)) return _rechazo("operando_repetido", `la cifra ${x.id} ya está entre los operandos (el mismo identificador, o la misma cifra de otra Entrega): se contaría dos veces`, [x.id]);
    vistos.add(x.id); llaves.add(x.llave);
  }
  const unidades = new Set(todos.concat(referencia ? [referencia] : []).map((x) => x.unidad));
  if (unidades.size > 1) return _rechazo("unidades_distintas", `las cifras están en unidades distintas (${[...unidades].join(", ")}): no se derivan juntas`, todos.map((x) => x.id));
  const entregas = [...new Set(todos.concat(referencia ? [referencia] : []).map((x) => x.entregaN))].map((n) => indice.get(n).entrega);
  if (entregas.length > 1) {
    if (new Set(entregas.map((e) => _periodoClave(e.periodo))).size > 1) return _rechazo("otro_periodo", "las cifras son de períodos distintos: no se derivan juntas", todos.map((x) => x.id));
    if (new Set(entregas.map((e) => e.moneda || "")).size > 1) return _rechazo("otra_moneda", "las cifras son de monedas distintas: no se derivan juntas", todos.map((x) => x.id));
    if (new Set(entregas.map((e) => (e.versionId == null ? "" : String(e.versionId)))).size > 1) return _rechazo("otra_carga", "las cifras son de cargas de datos distintas: no se derivan juntas", todos.map((x) => x.id));
  }
  const claves = new Set(todos.concat(referencia ? [referencia] : []).map((x) => x.clave));
  const mismaClave = claves.size === 1;

  if (operacion === "suma" || operacion === "conteo") {
    if (!mismaClave) return _rechazo("metricas_distintas", `las cifras son de métricas distintas (${[...claves].map(_nombre).join(", ")}): ${operacion === "suma" ? "solo se suman cifras de la misma métrica" : "se cuentan cifras de la misma métrica"}`, todos.map((x) => x.id));
    const total = todos.find((x) => x.deListado);
    if (total) return _rechazo("operando_es_total", `${total.id} es el total de un listado: ya contiene a sus filas, así que no entra en ${operacion === "suma" ? "una suma" : "un conteo"} (se contaría dos veces)`, [total.id]);
  }
  if (operacion === "suma") {
    const m = metricaPorClave(operandos[0].clave);
    if (!m || m.referencia || m.negocio || m.tasa || (m.unidad !== "money" && m.unidad !== "count") || (operandos[0].unidad !== "money" && operandos[0].unidad !== "count")) return _rechazo("metrica_no_aditiva", `«${_nombre(operandos[0].clave)}» no se suma (un porcentaje, un promedio, unos días o una razón no son aditivos): se resta o se cuenta, o se pide a ADI`, operandos.map((x) => x.id));
  }
  if (operacion === "diferencia" || operacion === "participacion") {
    const [a, b] = operacion === "diferencia" ? operandos : [operandos[0], base];
    if (a.clave !== b.clave && _dueno(a.dueno) !== _dueno(b.dueno)) return _rechazo("metricas_distintas", `${a.id} y ${b.id} son de métricas distintas (${_nombre(a.clave)} y ${_nombre(b.clave)}) y de dueños distintos: solo se relacionan dos métricas de una misma cuenta`, [a.id, b.id]);
  }
  if (operacion === "participacion") {
    const num = operandos[0];
    if (num.unidad !== "money" && num.unidad !== "count") return _rechazo("unidad_no_participable", "una participación se calcula sobre dinero o cantidades; un porcentaje, unos días o una razón no tienen participación", [num.id, base.id]);
    if (num.raw < 0 || base.raw < 0) return _rechazo("operando_negativo", "una participación no se calcula con una cifra negativa", [num.raw < 0 ? num.id : base.id]);
    if (base.raw === 0) return _rechazo("base_cero", `la base ${base.id} es cero: no hay participación`, [base.id]);
    if (num.raw > base.raw) return _rechazo("numerador_mayor_que_base", `${num.id} es mayor que la base ${base.id}: una participación no supera el 100 %`, [num.id, base.id]);
  }
  if (operacion === "conteo" && typeof condicion.valor === "number" && operandos[0].unidad === "money" && condicion.valor !== 0) {
    return _rechazo("condicion_invalida", "para dinero, la condición compara contra 0 o contra otra cifra entregada (su identificador): una cantidad suelta es ambigua en su escala");
  }
  return { ok: true, operacion, operandos, base, condicion, referencia, contexto: { versionId: entregas[0].versionId == null ? null : entregas[0].versionId, periodo: _periodoTexto(entregas[0].periodo), moneda: entregas[0].moneda || null } };
}

/* ═══ 5 · CALCULAR (con su rótulo) ════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
const _unir = (xs, tope = 120) => { const s = xs.filter(Boolean).join(" + "); return s.length <= tope ? s : `${xs.length} entidades entregadas`; };

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
    entidad = mismoDueno ? (x.entidad || null) : [x.entidad, y.entidad].filter(Boolean).join(" − ") || null;
    metrica = x.clave === y.clave ? `${nom(x)} · diferencia${mismoDueno ? "" : " (primera menos segunda)"}` : `${nom(x)} − ${nom(y)}`;
  } else if (v.operacion === "participacion") {
    const [x] = v.operandos, b = v.base;
    entidad = x.entidad || null;
    metrica = x.clave === b.clave ? `${nom(x)} · participación sobre ${b.entidad || b.metrica || b.id}${b.valor ? ` (${b.valor})` : ""}` : `${nom(x)} ÷ ${nom(b)} · participación`;
  } else {
    const ref = v.referencia ? (v.referencia.valor || formatoDeLaCasa(v.referencia.raw, v.referencia.unidad)) : formatoDeLaCasa(v.condicion.valor, v.operandos[0].unidad);
    metrica = `${nom(v.operandos[0])} · cifras entregadas (${v.operandos.length}) ${_FRASE_DE_OPERADOR[v.condicion.op]} ${ref}`;
  }
  const { cumplen, ...resultado } = a;
  return { resultado: { ...resultado, ...(cumplen ? { cumplen } : {}) }, entidad, metrica };
}

/** derivacionParaElLibro(pedido, validada, calculada) → lo que `libro.js:registrarDerivacion` guarda (sin el id, que lo pone el libro): compacto a propósito (el tope de 16 KB lo exige la base). */
export function derivacionParaElLibro(pedido, v, c) {
  return {
    operacion: v.operacion, sobre: v.operandos.map((x) => x.id),
    ...(v.base ? { base: v.base.id } : {}), ...(v.condicion ? { condicion: { op: v.condicion.op, valor: v.condicion.valor } } : {}),
    resultado: c.resultado, entidad: c.entidad, metrica: c.metrica,
    versionId: v.contexto.versionId, periodo: v.contexto.periodo, moneda: v.contexto.moneda,
  };
}

/** respuestaDeLaDerivacion(d, opciones) → { hecho, operandos, base?, condicion?, cumplen?, noCumplen? } · la forma que viaja al anfitrión, de la derivación guardada y de las cifras que la sostienen (`operandosPorId`: Map id → {entidad, metrica, valor}). */
export function respuestaDeLaDerivacion(d, operandosPorId) {
  const pos = (id) => { const o = operandosPorId.get(id) || {}; return { id, ...(o.entidad != null ? { entidad: o.entidad } : {}), ...(o.metrica != null ? { metrica: o.metrica } : {}), ...(o.valor != null ? { valor: o.valor } : {}) }; };
  const r = d.resultado || {};
  const out = {
    hecho: { id: d.id, operacion: d.operacion, sobre: d.sobre.slice(), ...(d.base ? { base: d.base } : {}), ...(d.entidad != null ? { entidad: d.entidad } : {}), metrica: d.metrica, valor: r.texto, procedencia: "derivado" },
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
