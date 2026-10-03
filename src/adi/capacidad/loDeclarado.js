/* === src/adi/capacidad/loDeclarado.js · LA ENTREGA USA LO DECLARADO Y PUEDE CITAR UNA RESPUESTA ANTERIOR (Etapa 2, bloque 3 · owner 2026-10-03) ═
 * LEYES DEL OWNER (2026-09-25, `adi-flujo-producto-complemento`): los CUATRO ORÍGENES (medido · documento · declarado · supuesto) nunca se funden;
 * la confirmación es un sello APARTE y no cambia el origen; un declarado NUNCA pisa un medido. Y la de siempre: «la comprensión del lenguaje es del LLM»
 * — ADI no reconoce frases: el anfitrión declara un CONCEPTO TIPADO (el id con que la casa nombra una referencia o una métrica) y un valor numérico;
 * ADI valida contra tablas cerradas (el léxico de la casa, `POLICY_CONFIG`) y decide con DATOS, nunca con texto.
 *
 * ESTE BLOQUE SOLO AGREGA UNA ENTRADA NUEVA A LA ENTREGA (la etapa 1 está cerrada: `entrega/`, el contrato §7.3 1-57 y sus controles no se tocan):
 * sin nada declarado y sin cita, la Entrega sale BYTE-IDÉNTICA a la de antes. Todo lo de este archivo es puro (sin I/O, sin red): la capa de las
 * acciones (`acciones.js`) lee la memoria y entra al tramo del Core; acá solo se decide qué de lo declarado tiene LUGAR y cómo se ve.
 *
 * UN DATO DECLARADO TIENE LUGAR EN LA ENTREGA SOLO SI LA CASA YA TIENE EL LUGAR DE ESE CONCEPTO — y solo cuenta lo VIGENTE (= confirmado; un pendiente
 * nunca entra, `continuidad/empresa.js`). Tres destinos, y ninguno se fuerza:
 *   1 · UN CRITERIO (clase «criterio», concepto = una referencia de la casa: benchmark · nivel_carga · umbral_materialidad · piso_rotacion · techo_cobertura ·
 *       umbral_frenado) es EL UMBRAL «declarado por la empresa»: entra por el mismo mecanismo que ya resuelve el origen de toda llave (`businessPolicy.js:umbral`,
 *       el registro del criterio de conversación) y la Entrega lo muestra con su origen donde lo usa (el Marco). Vale para TODA la empresa: un criterio con
 *       entidad o período no tiene ese lugar.
 *   2 · UN HECHO (clase «hecho», concepto = una métrica del léxico) se muestra declarado AL LADO de lo medido de la MISMA métrica y la MISMA entidad, cada uno
 *       con su origen; si no coinciden, se declara la diferencia. NUNCA reemplaza lo medido (ni siquiera con `usar: "declarado"`: ADI no calcula sobre lo
 *       declarado, lo declara). Solo donde la escala no se infiere (porcentajes, días, múltiplos, conteos): el DINERO declarado no se compara —la escala jamás
 *       se infiere, ley `adi-moneda-y-marco`— y queda en la memoria.
 *   3 · TODO LO DEMÁS (un concepto que la casa no conoce, un documento, el plazo de cobro mientras no se decida dónde va) SE QUEDA EN LA MEMORIA: se dice en
 *       el momento de declararlo (`lugarDeAporte`) y no se vuelve a mencionar.
 * Y la CITA (`contexto: E1`, `E1.h3`, `E1.u1`): lo que una Entrega anterior de ESTA conversación entregó, tal cual quedó guardado, para que la Entrega nueva
 * lo use como antecedente — sin recalcularlo en silencio (revisar si una cifra cambió con datos nuevos es del bloque 4). */
import { CLAVES_DE_METRICA } from "../notario/lexico.js";
import { normalizar } from "../notario/afirmacion.js";
import { formatoDeLaCasa, formatoDeReferencia } from "../notario/hechos.js";
import { POLICY_DE_REFERENCIA, ETIQUETA_ORIGEN, ORIGEN } from "../../config/businessPolicy.js";
import { CRITERIA } from "../criteria.js";   // SOLO los límites de plausibilidad de cada criterio (los mismos de «mi margen mínimo es 28 %»): nunca su reconocedor de frases

export const ORIGEN_DECLARADO = "declarado";
const _txt = (x) => String(x == null ? "" : x).trim().toLowerCase();
const _fecha = (iso) => (typeof iso === "string" && iso.length >= 10 && iso[4] === "-" && iso[7] === "-" ? iso.slice(0, 10) : null);   // la fecha de un sello ISO; sin una sola regex en este archivo (el gate lo vigila: ADI no reconoce frases)
const _num = (x) => (typeof x === "number" ? x : x != null && x !== "" ? Number(x) : NaN);

/* ═══ 1 · LAS TABLAS: QUÉ SE PUEDE DECLARAR Y DÓNDE TIENE LUGAR ═══════════════════════════════════════════════════════════ */
/** los límites de plausibilidad de cada llave de POLICY que `criteria.js` ya declara (margen, carga, rotación, cobertura); las demás solo exigen un valor positivo */
const _limitesDe = (llave) => { const c = Object.values(CRITERIA).find((x) => x.policyKey === llave); return c ? { min: c.min, max: c.max } : { min: null, max: null }; };

/** CRITERIOS_DECLARABLES: una entrada por referencia de la casa (`lexico.js`, `referencia: true`) → la llave de POLICY que fija. Se DERIVA del léxico y de `POLICY_DE_REFERENCIA`. */
export const CRITERIOS_DECLARABLES = Object.freeze(CLAVES_DE_METRICA.filter((m) => m.referencia).map((m) => Object.freeze({
  concepto: m.clave, rotulo: m.nombre, unidad: m.unidad, llave: POLICY_DE_REFERENCIA[m.clave] || null, ..._limitesDe(POLICY_DE_REFERENCIA[m.clave]),
})));
const _criterioDe = (concepto) => CRITERIOS_DECLARABLES.find((c) => c.concepto === _txt(concepto) && c.llave) || null;
/** ¿el concepto es una referencia de la casa con llave de POLICY? (un criterio con lugar en la Entrega) */
export const esReferenciaDeLaCasa = (concepto) => !!_criterioDe(concepto);

/** las unidades en que una cifra declarada es comparable SIN adivinar la escala (el dinero no: ver la cabecera). */
const UNIDADES_COMPARABLES = Object.freeze(["pct", "pp", "days", "ratio", "count"]);
/** HECHOS_DECLARABLES: las métricas del léxico (no las referencias) con dueño de dominio y una unidad cuya escala no se infiere. */
export const HECHOS_DECLARABLES = Object.freeze(CLAVES_DE_METRICA.filter((m) => !m.referencia && m.dominio && UNIDADES_COMPARABLES.includes(m.unidad)).map((m) => Object.freeze({ concepto: m.clave, rotulo: m.nombre, unidad: m.unidad, dominio: m.dominio })));
const _hechoDe = (concepto) => HECHOS_DECLARABLES.find((h) => h.concepto === _txt(concepto)) || null;
const _metricaDe = (concepto) => CLAVES_DE_METRICA.find((m) => m.clave === _txt(concepto)) || null;

/** declarable() → lo que el anfitrión puede declarar con lugar en la Entrega, con la forma exacta del aporte (para `conocerEmpresa`). */
export function declarable() {
  return {
    criterios: CRITERIOS_DECLARABLES.filter((c) => c.llave).map((c) => ({
      concepto: c.concepto, rotulo: c.rotulo, unidad: c.unidad, ...(c.min != null ? { min: c.min, max: c.max } : {}),
      comoDeclarar: { clase: "criterio", concepto: c.concepto, valor: { raw: "<número>", unidad: c.unidad } },
    })),
    hechos: HECHOS_DECLARABLES.map((h) => ({ concepto: h.concepto, rotulo: h.rotulo, unidad: h.unidad, dominio: h.dominio, comoDeclarar: { clase: "hecho", concepto: h.concepto, entidad: "<la entidad, o ninguna si es del negocio>", valor: { raw: "<número>", unidad: h.unidad } } })),
    uso: [
      "Un criterio es un umbral de toda la empresa (sin entidad ni período): al confirmarse, la Entrega lo usa y lo muestra «declarado por la empresa». Un hecho se muestra declarado AL LADO de lo medido por ADI de la misma métrica y la misma entidad; si no coinciden, se declara la diferencia: lo declarado nunca reemplaza lo medido.",
      "El dinero declarado no se compara con lo medido (ADI no infiere la escala) y lo que no esté en esta lista se queda en la memoria de la empresa sin usarse en la Entrega.",
    ],
  };
}

/* ═══ 2 · ¿DÓNDE TIENE LUGAR UN APORTE? (al declararlo y al leerlo de la memoria) ═══════════════════════════════════════════ */
/** validarCriterio({ concepto, valor, unidad, entidad, periodo }) → { ok, llave?, valorNumerico?, motivo? } · la validación TIPADA de un criterio con lugar: número finito, la unidad de la referencia (o ninguna), dentro de su rango, y para toda la empresa. */
export function validarCriterio({ concepto, raw, unidad = null, entidad = null, periodo = null, eje = null }) {
  const c = _criterioDe(concepto);
  if (!c) return { ok: false, motivo: `«${concepto}» no es una referencia de la casa` };
  const v = _num(raw);
  if (!Number.isFinite(v)) return { ok: false, motivo: `el criterio «${c.concepto}» (${c.rotulo}) necesita un valor numérico (${c.unidad}); recibió algo que no es un número` };
  if (unidad != null && unidad !== "" && _txt(unidad) !== c.unidad) return { ok: false, motivo: `el criterio «${c.concepto}» (${c.rotulo}) se declara en ${c.unidad}; recibió «${unidad}»` };
  if (!(v > 0) || (c.min != null && (v < c.min || v > c.max))) return { ok: false, motivo: `el valor ${v} no es plausible para «${c.concepto}» (${c.rotulo}): ${c.min != null ? `se declara entre ${c.min} y ${c.max} (${c.unidad})` : `se declara un número mayor que cero (${c.unidad})`}` };
  if (entidad || periodo || eje) return { ok: false, motivo: `el criterio «${c.concepto}» (${c.rotulo}) vale para toda la empresa: no se declara con una entidad, un eje ni un período` };
  return { ok: true, llave: c.llave, valorNumerico: v, unidad: c.unidad, rotulo: c.rotulo };
}

/** lugarDeAporte(entendido) → { enLaEntrega, como?, motivo?, validos? } · dónde se usaría lo que se acaba de declarar (cuando se CONFIRME): lo dice al declararlo, nunca después. */
export function lugarDeAporte(e) {
  if (!e || typeof e !== "object") return { enLaEntrega: false, motivo: "sin aporte" };
  const clase = _txt(e.clase), concepto = _txt(e.concepto);
  if (clase === "criterio") {
    const c = _criterioDe(concepto);
    if (c) return { enLaEntrega: true, como: `umbral de la empresa (${c.rotulo}): al confirmarse, la Entrega lo usa y lo muestra «${ETIQUETA_ORIGEN[ORIGEN.EMPRESA]}»` };
    return { enLaEntrega: false, motivo: "este criterio no es una de las referencias que ADI usa en la Entrega: queda en la memoria de la empresa, sin aplicarse", validos: CRITERIOS_DECLARABLES.filter((c2) => c2.llave).map((c2) => c2.concepto) };
  }
  if (clase === "hecho") {
    if (_criterioDe(concepto)) return { enLaEntrega: false, motivo: `«${concepto}» es una referencia de la empresa: se declara con la clase «criterio», no como un hecho`, validos: ["criterio"] };
    const h = _hechoDe(concepto);
    if (h) return { enLaEntrega: true, como: `se muestra declarado al lado de lo medido de la misma métrica (${h.rotulo}) y la misma entidad; si no coinciden, se declara la diferencia — nunca reemplaza lo medido` };
    const m = _metricaDe(concepto);
    if (m && m.unidad === "money") return { enLaEntrega: false, motivo: "el dinero declarado no se compara con lo medido (ADI no infiere la escala): queda en la memoria de la empresa, sin usarse en la Entrega" };
    return { enLaEntrega: false, motivo: "este hecho no es una métrica que ADI mida con la que se pueda contrastar: queda en la memoria de la empresa, sin usarse en la Entrega", validos: HECHOS_DECLARABLES.map((h2) => h2.concepto) };
  }
  if (clase === "documento") return { enLaEntrega: false, motivo: "lo que se toma de un documento queda en la memoria de la empresa: la Entrega todavía no lo usa" };
  return { enLaEntrega: false, motivo: "este aporte no tiene lugar en la Entrega" };
}

/* ═══ 3 · LO VIGENTE DE LA MEMORIA → LO QUE ENTRA ═════════════════════════════════════════════════════════════════════════ */
const _sello = (f) => { const c = f && f.confirmacion; return c && typeof c === "object" ? { por: c.por || null, cuando: c.cuando || null, medio: c.medio || null } : null; };

/** clasificarLoDeclarado(filas) → { criterios, hechos } · `filas` = las filas de la memoria de la empresa (cualquier estado): SOLO cuenta lo VIGENTE (confirmado) — un pendiente, un retirado o un omitido
 *  NUNCA entra. `criterios` = los que tienen lugar y valen (uno por llave: el más reciente), `hechos` = los comparables. Lo que no tiene lugar no se lista: se queda en la memoria. */
export function clasificarLoDeclarado(filas) {
  const vigentes = (Array.isArray(filas) ? filas : []).filter((f) => f && f.estado === "vigente" && !f.migradoDeLegado);
  const porLlave = new Map();
  const hechos = [];
  for (const f of vigentes) {
    const clase = _txt(f.clase);
    if (clase === "criterio") {
      const c = _criterioDe(f.concepto);
      if (!c) continue;
      const v = f.valor && typeof f.valor === "object" ? f.valor : {};
      const val = validarCriterio({ concepto: f.concepto, raw: v.raw, unidad: v.unidad, entidad: f.entidad, periodo: f.periodo, eje: f.eje });
      if (!val.ok) continue;
      const previo = porLlave.get(c.llave);
      if (previo && String(previo.declaradoEn || "") >= String(f.declaradoEn || "")) continue;
      porLlave.set(c.llave, { id: f.id, concepto: c.concepto, rotulo: c.rotulo, llave: c.llave, valor: val.valorNumerico, unidad: c.unidad, origen: ORIGEN_DECLARADO, sello: _sello(f), declaradoEn: f.declaradoEn || null });
    } else if (clase === "hecho") {
      const h = _hechoDe(f.concepto);
      if (!h) continue;
      const v = f.valor && typeof f.valor === "object" ? f.valor : {};
      const raw = _num(v.raw);
      if (!Number.isFinite(raw)) continue;
      if (v.unidad != null && v.unidad !== "" && _txt(v.unidad) !== h.unidad) continue;   // otra unidad: no se compara (jamás se convierte)
      hechos.push({ id: f.id, concepto: h.concepto, rotulo: h.rotulo, unidad: h.unidad, entidad: f.entidad ? String(f.entidad) : null, periodo: f.periodo ? String(f.periodo) : null, valor: raw, origen: ORIGEN_DECLARADO, sello: _sello(f), declaradoEn: f.declaradoEn || null });
    }
  }
  return { criterios: [...porLlave.values()], hechos };
}

/* ═══ 4 · LO DECLARADO AL LADO DE LO MEDIDO ═══════════════════════════════════════════════════════════════════════════════ */
/** el hecho MEDIDO que la Entrega ya sirve para (métrica, entidad, unidad): una cita directa (un solo insumo, origen medido) del libro de hechos de la Entrega — la misma llave (clave · sujeto · unidad)
 *  con la que el libro detecta una discrepancia entre orígenes (`notario/hechos.js`). */
function _medidoDe(libro, h) {
  const sujetoDeclarado = h.entidad ? normalizar(h.entidad) : null;
  for (const H of (libro && Array.isArray(libro.hechos) ? libro.hechos : [])) {
    if (!H || !H.ok || !(H.tipo === "ref" || H.tipo === "cifra") || !(H.claves && H.claves.has && H.claves.has(h.concepto))) continue;
    if (!H.origen || H.origen.titular !== "medido" || !Array.isArray(H.composicion) || H.composicion.length !== 1) continue;
    const n = H.numeros && H.numeros[H.numeros.length - 1];
    if (!n || !Number.isFinite(n.raw)) continue;
    const u = n.unidad === "pp" ? "pct" : n.unidad;
    if (u !== (h.unidad === "pp" ? "pct" : h.unidad)) continue;
    const sujeto = (H.roles && H.roles.sujetos && H.roles.sujetos[0]) || "negocio";
    if (sujetoDeclarado === null ? normalizar(sujeto) !== "negocio" : normalizar(sujeto) !== sujetoDeclarado) continue;
    return { id: H.id, raw: n.raw, unidad: n.unidad, texto: formatoDeLaCasa(n.raw, n.unidad) || n.texto };   // la forma de la casa, la misma con que la Entrega escribe una cifra medida
  }
  return null;
}
const _entidadesResueltas = (p) => (Array.isArray(p && p.entidades) ? p.entidades : []).map((e) => normalizar(typeof e === "string" ? e : (e && e.nombre) || ""));
/** ¿alguna parte resuelta de la consulta PIDIÓ esa métrica (para esa entidad, o sin entidad)? — un declarado en juego aunque ADI no tenga una cifra medida con la que contrastarlo */
function _laPidio(resolucion, h) {
  const e = h.entidad ? normalizar(h.entidad) : null;
  /* un declarado SIN entidad es del negocio: solo está en juego si la parte pidió esa métrica SIN entidades (del negocio); uno con entidad, si la parte la pidió para esa entidad */
  return (Array.isArray(resolucion && resolucion.partes) ? resolucion.partes : []).some((p) => (p.estado === "resuelta" || p.estado === "parcial") && Array.isArray(p.conceptos) && p.conceptos.includes(h.concepto) && (e === null ? _entidadesResueltas(p).length === 0 : _entidadesResueltas(p).includes(e)));
}

/** contrastarHechos({ hechos, libro, resolucion, periodos }) → [{ ...declarado, estado: "coincide"|"difiere"|"sin_medido", medido?, diferencia? }]
 *  Solo los que están EN JUEGO en esta Entrega (hay un medido de lo mismo, o una parte lo pidió); un declarado con período no se estira a otro (solo vale si
 *  el período del Marco de la Entrega es EXACTAMENTE ese: `periodos` = el texto y el rango del período del Marco). */
export function contrastarHechos({ hechos, libro, resolucion, periodos = [] }) {
  const out = [];
  const delMarco = (Array.isArray(periodos) ? periodos : [periodos]).filter((p) => typeof p === "string" && p.trim()).map((p) => normalizar(p));
  for (const h of Array.isArray(hechos) ? hechos : []) {
    if (h.periodo && !delMarco.includes(normalizar(h.periodo))) continue;
    const m = _medidoDe(libro, h);
    if (!m) { if (_laPidio(resolucion, h)) out.push({ ...h, estado: "sin_medido", medido: null, diferencia: null }); continue; }
    const mismo = formatoDeLaCasa(h.valor, h.unidad === "pp" ? "pct" : h.unidad) === formatoDeLaCasa(m.raw, m.unidad === "pp" ? "pct" : m.unidad);
    const d = h.valor - m.raw;
    out.push({
      ...h, estado: mismo ? "coincide" : "difiere",
      medido: { valor: m.raw, texto: m.texto, hecho: m.id, origen: "medido" },
      diferencia: mismo ? null : { valor: d, texto: formatoDeLaCasa(Math.abs(d), h.unidad === "pct" ? "pp" : h.unidad), sentido: d > 0 ? "declarado_mayor" : "declarado_menor" },
    });
  }
  return out;
}

/** lo que va JUNTO al bloque `declarado` de la respuesta (un campo nuevo: no toca la cabecera de uso de siempre) */
export const USO_DE_LO_DECLARADO = Object.freeze([
  "Lo declarado por la empresa se dice como declarado (con su origen): nunca se presenta como medido por ADI.",
  "Si un hecho declarado no coincide con lo medido, se dicen las dos cifras, cada una con su origen, y la diferencia; ADI no sustituye lo medido por lo declarado.",
  "Los criterios declarados rigen en todo lo que ADI calcula para esta empresa; la Entrega los muestra con su origen donde los usa.",
]);

/* ═══ 5 · EL TEXTO (tercera persona: la Entrega no le habla a nadie) ═════════════════════════════════════════════════════ */
const _quien = (h) => [h.entidad, h.rotulo].filter(Boolean).join(" · ");
const _confirmado = (s) => (s && _fecha(s.cuando) ? ` (confirmado el ${_fecha(s.cuando)})` : " (confirmado)");

/** textoDeLoDeclarado({ hechos, usar }) → string | "" · el bloque que va al final del texto de la Entrega: lo declarado y lo medido, cada uno con su origen, y la diferencia cuando no coinciden. */
export function textoDeLoDeclarado({ hechos, usar = null }) {
  const lineas = [];
  for (const h of hechos || []) {
    const declarado = `${_quien(h)}: ${formatoDeReferencia(h.valor, h.unidad)}, ${ETIQUETA_ORIGEN[ORIGEN.EMPRESA]}${_confirmado(h.sello)}`;
    if (h.estado === "sin_medido") lineas.push(`- ${declarado}. ADI no tiene en esta Entrega una cifra medida de lo mismo con la que contrastarlo.`);
    else if (h.estado === "coincide") lineas.push(`- ${declarado}. Coincide con lo medido por ADI (${h.medido.texto}).`);
    else lineas.push(`- ${declarado}. Medido por ADI: ${h.medido.texto}. No coinciden: ${h.diferencia.sentido === "declarado_mayor" ? "lo declarado supera" : "lo declarado queda por debajo de"} lo medido por ${h.diferencia.texto}. Las dos cifras se muestran con su origen y ADI no sustituye lo medido por lo declarado.`);
  }
  if (!lineas.length) return "";
  const pidioDeclarado = usar === "declarado" && (hechos || []).some((h) => h.estado === "difiere");
  return `**Lo declarado por la empresa y confirmado.**\n${lineas.join("\n")}${pidioDeclarado ? "\n- Se pidió usar lo declarado: ADI no calcula sobre lo declarado ni lo pone en lugar de lo medido; las cifras de esta Entrega son las medidas y lo declarado figura al lado, con su origen." : ""}`;
}

/* ═══ 6 · LA CITA: LO QUE UNA ENTREGA ANTERIOR ENTREGÓ ════════════════════════════════════════════════════════════════════ */
/** antecedentesDe(contextoResuelto, { versionActiva }) → [{ id, tipo, entrega, hechos?|hecho?|universo?, cargaActual, cargaCambio }] · exactamente lo que `resolverContexto` trajo del libro, más una sola cosa que se DECLARA: si la carga con que se entregó no es la activa. */
export function antecedentesDe(contextoResuelto, { versionActiva = null } = {}) {
  return (Array.isArray(contextoResuelto) ? contextoResuelto : []).map((r) => {
    const cambio = Boolean(r.entrega && r.entrega.versionId && versionActiva && r.entrega.versionId !== versionActiva);
    const base = { id: r.id, tipo: r.tipo, entrega: r.entrega, cargaActual: versionActiva || null, cargaCambio: cambio };
    if (r.tipo === "entrega") return { ...base, hechos: r.hechos, universos: r.universos };
    if (r.tipo === "hecho") return { ...base, hecho: r.hecho };
    return { ...base, universo: r.universo };
  });
}
const _lineaDeHecho = (h) => `- ${h.id} · ${[h.sujeto, h.metrica].filter(Boolean).join(" · ") || "hecho"}: ${h.valor != null ? h.valor : "sin valor"}${h.origen ? ` (${h.origen})` : ""}`;
const _lineaDeUniverso = (u, etiqueta) => `- ${etiqueta} · universo${u.texto ? `: ${u.texto}` : ""}${Array.isArray(u.entidades) && u.entidades.length ? ` (${u.entidades.join(", ")})` : ""}`;

/** textoDeAntecedentes(antecedentes) → string | "" · una sección por cita: la Entrega, su carga y su fecha, y lo que entregó tal cual (no recalculado). */
export function textoDeAntecedentes(antecedentes) {
  const secciones = [];
  for (const a of antecedentes || []) {
    const e = a.entrega || {};
    const periodo = e.periodo && typeof e.periodo === "object" ? (e.periodo.texto || null) : (e.periodo || null);
    const cabeza = `**Antecedente: lo que la Entrega E${e.n} ya entregó** (${a.id}). Carga ${e.versionId || "sin versión declarada"}${e.entregadaEn ? `, entregada el ${e.entregadaEn}` : ""}${periodo ? `; período: ${periodo}` : ""}.`;
    const lineas = [];
    if (a.tipo === "entrega") {
      if (e.recortada) lineas.push(`- La Entrega E${e.n} se recortó por tamaño: conserva sus temas${e.temas.length ? ` (${e.temas.join(", ")})` : ""} y su carga, pero ya no sus hechos.`);
      else { for (const h of a.hechos || []) lineas.push(_lineaDeHecho(h)); (a.universos || []).forEach((u, k) => lineas.push(_lineaDeUniverso(u, `E${e.n}.u${k + 1}`))); }
    } else if (a.tipo === "hecho") lineas.push(_lineaDeHecho(a.hecho));
    else lineas.push(_lineaDeUniverso(a.universo, a.id));
    const nota = `Son las cifras tal como se entregaron entonces: ADI no las recalculó.${a.cargaCambio ? ` La carga activa ahora es ${a.cargaActual}: esas cifras no se volvieron a verificar contra ella.` : ""}`;
    secciones.push([cabeza, ...lineas, nota].join("\n"));
  }
  return secciones.join("\n\n");
}
