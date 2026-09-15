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
import { metricasEn } from "../oracle/guardC.js";
import { normalizar, menosAscii } from "./afirmacion.js";

/* SINÓNIMOS · lo que el modelo (o quien etiqueta) puede escribir como métrica → los conceptos del rótulo que la nombran, en orden de
 * preferencia. Se casan por igualdad normalizada; el resto de la casación es genérica (ver conceptosDe). */
export const SINONIMOS = [
  [/^(?:ventas?|facturaci[oó]n|venta\s+comercial|venta\s+del\s+per[ií]odo|ventas\s+del\s+per[ií]odo)$/i, ["venta", "ventas", "ventas del periodo", "ventas totales", "venta (flujo)", "venta del periodo (flujo)"]],
  [/^ventas?\s+del\s+a[ñn]o\s+(?:anterior|pasado)$|^venta\s+(?:del\s+)?a[ñn]o\s+(?:anterior|pasado)$|^base\s+del\s+a[ñn]o\s+anterior$/i, ["ventas del ano anterior"]],   // la base del crecimiento, con fila propia
  [/^(?:saldo\s+)?vencidos?$|^(?:deuda\s+)?(?:en\s+)?mora$|^saldo\s+en\s+mora$|^deuda\s+vencida$/i, ["saldo vencido"]],
  [/^(?:saldo\s+)?pendientes?$|^por\s+cobrar$|^deuda$|^saldo$/i, ["saldo pendiente"]],
  [/^d[ií]as?\s+(?:de\s+)?(?:atraso|mora|retraso|vencid[oa]s?)$|^atraso$|^dias?\s+vencido$/i, ["dias vencido"]],
  [/^recuperaci[oó]n$|^recuperad[oa]$|^cobranza\s+recuperada$|^tasa\s+de\s+recuperaci[oó]n$/i, ["recuperado"]],
  [/^abonad[oa]s?$|^abonos?$|^pagad[oa]$|^cobrad[oa]$/i, ["abonado"]],
  [/^contribuci[oó]n$|^contribuci[oó]n\s+comercial$|^ganancia$/i, ["contribucion"]],
  [/^(?:contribuci[oó]n\s+)?(?:no\s+capturada|sin\s+capturar)$/i, ["contribucion no capturada"]],
  [/^m[aá]rgen(?:es)?$|^margen\s+comercial$|^margen\s+bruto$/i, ["margen", "margen promedio"]],   // el margen del negocio es su «Margen promedio»
  [/^margen\s+promedio$|^margen\s+de\s+la\s+cartera$/i, ["margen promedio"]],
  [/^cargas?(?:\s+comercial)?$|^acciones\s+comerciales$|^rebates?$|^descuentos?$/i, ["carga comercial", "carga"]],
  [/^(?:carga\s+comercial\s+alta|carga\s+alta|exceso\s+de\s+carga|carga\s+excedente|carga\s+sobre\s+el\s+nivel)$/i, ["carga comercial alta"]],
  [/^brechas?(?:\s+(?:al\s+benchmark|de\s+margen|contra\s+el\s+benchmark|al\s+margen))?$|^distancia\s+al\s+benchmark$/i, ["brecha al benchmark"]],
  [/^brecha\s+por\s+precio\s+y\s+costo$|^precio\s+y\s+costo$|^brecha\s+de\s+precio\s+y\s+costo$/i, ["brecha por precio y costo"]],
  [/^mark-?up(?:\s+sobre\s+costo)?$/i, ["markup sobre costo"]],
  [/^markup\s+promedio$/i, ["markup promedio"]],
  [/^peso\s+del\s+costo$|^costo$|^costos$/i, ["peso del costo"]],
  [/^unidades(?:\s+vendidas)?$|^volumen$|^volumen\s+vendido$/i, ["unidades vendidas"]],
  [/^unidades\s+en\s+stock$|^stock\s+en\s+unidades$|^unidades\s+en\s+inventario$/i, ["unidades en stock"]],
  [/^capital(?:\s+en\s+inventario)?$|^valor\s+de\s+inventario$|^stock$|^inventario$|^capital\s+total$/i, ["capital", "valor de inventario", "stock", "capital en inventario"]],
  [/^capital\s+(?:frenado|detenido|inmovilizado|parado|bloqueado)$|^frenado$|^inmovilizado$/i, ["capital frenado"]],
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
  cliente: { ventas: ["venta", "ventas", "venta (flujo)"], margen: ["margen"], contribucion: ["contribucion"], carga: ["carga comercial", "carga"], unidades: ["unidades vendidas", "unidades"], brecha: ["brecha al benchmark", "brecha"], no_capturada: ["contribucion no capturada"], saldo_vencido: ["saldo vencido"], recuperado: ["recuperado"], dias_vencido: ["dias vencido"], saldo_pendiente: ["saldo pendiente"] },
  marca: { ventas: ["venta", "ventas"], margen: ["margen"], contribucion: ["contribucion"], carga: ["carga comercial", "carga"] },
  sku: { ventas: ["venta", "ventas"], contribucion: ["contribucion"], capital: ["capital", "valor de inventario", "stock", "capital en inventario"], capital_inmovilizado: ["capital inmovilizado"], capital_frenado: ["capital frenado"], rotacion: ["rotacion"], dias_inventario: ["dias de inventario", "cobertura (doh)"], dias_sin_venta: ["dias sin venta"], margen_inventario: ["margen de inventario"] },
  bodega: { capital: ["capital", "capital en inventario"], capital_frenado: ["capital frenado"], capital_inmovilizado: ["capital inmovilizado"] },
};

/* los estados del inventario y sus sinónimos en la prosa de la casa */
export const ESTADOS = [
  [/inmoviliz|deten|parad|bloquead|estancad/, "inmovilizado"],
  [/frenad/, "frenado"],
  [/sobrestock|sobre\s*stock|exceso\s+de\s+stock|sobreinventario/, "sobrestock"],
  [/quiebre|riesgo\s+de\s+quiebre|desabast/, "riesgo de quiebre"],
  [/sano|saludable|normal|activo|en\s+regla|sin\s+alerta/, "capital sano"],
];
export const estadoCanon = (t) => { const s = normalizar(t); for (const [re, e] of ESTADOS) if (re.test(s)) return e; return s; };

const _NEGOCIO_FIG = /^(?:el\s+negocio|negocio|total|cartera|global)$/i;
/* un mes, como lo rotula el cuadro «el año mes a mes» (abreviado o entero) */
const _MES_RE = /^(?:ene(?:ro)?|feb(?:rero)?|mar(?:zo)?|abr(?:il)?|may(?:o)?|jun(?:io)?|jul(?:io)?|ago(?:sto)?|sep(?:t(?:iembre)?)?|oct(?:ubre)?|nov(?:iembre)?|dic(?:iembre)?)(?:\s+\d{4})?$/i;
/* qué palabras de un universo/descripción NO distinguen nada (se descartan al casar con el rótulo) */
const _VACIAS = new Set(["de", "del", "la", "las", "el", "los", "un", "una", "y", "o", "en", "con", "que", "a", "al", "por", "para", "su", "sus", "es", "son", "ese", "esa", "esos", "esas", "este", "esta", "estos", "estas", "cuentas", "clientes", "cuenta", "cliente", "sku", "skus", "bodegas", "bodega", "marcas", "marca", "entre", "solo", "sólo", "todas", "todos", "toda", "todo", "grupo", "conjunto"]);
export const tokens = (t) => normalizar(t).replace(/[()·,;:%$]/g, " ").split(/\s+/).filter((w) => w && !_VACIAS.has(w) && !/^\d+$/.test(w));
export const numerosEn = (t) => (String(t || "").match(/(?<![A-Za-z\d-])\d+(?:[.,]\d+)?(?![A-Za-z\d])/g) || []).map((x) => parseFloat(x.replace(",", ".")));   // «LG-DRYER8KG» no trae un 8

/* las palabras que dicen «el todo» en un universo declarado (un subtotal narrado así es alcance promovido) */
export const ES_TODO = /\b(?:total(?:es)?|negocio|cartera|global|todos?(?:\s+los|\s+las)?|todas?|entera?|completa?|los\s+13|las\s+13|13\s+clientes|13\s+cuentas|el\s+conjunto)\b(?!\s+(?:bajo|sobre|con|que|de|en)\b)/i;

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
    F.push({ fig, label, entidad, eje, concepto, conceptoNorm, base, calificador, universoTexto, raw, unidad, canon: String(fig.canon || "").replace(/\$/g, ""), texto: menosAscii(String(fig.value ?? fig.text ?? "")).trim(), agregado, grupo, cobertura, n, m, entidadesDelGrupo, periodo: t.periodo || "", universo: t.universoEtiqueta || t.universo || "", claves: metricasEn(concepto), source: fig.source || "", formula: fig.formula || "", context: fig.context || "" });
  }

  /* ── la casación de la métrica declarada con el concepto de la fig ── */
  const _casa = (metrica, f) => {
    const m = normalizar(metrica);
    if (!m) return 0;
    const c = f.base || f.conceptoNorm;
    if (c === m || f.conceptoNorm === m) return 4;
    const sin = conceptosDe(metrica);
    if (sin.length) { const i = sin.indexOf(c); if (i >= 0) return 3.5 - i * 0.01; if (sin.includes(f.conceptoNorm)) return 3.4; }
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
    cands.sort((a, b) => b.s - a.s || a.f.conceptoNorm.length - b.f.conceptoNorm.length);
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

  return { entidades, resolverEntidad, figs: F, buscarFigs, figsDeMetrica, rankingDe, rankings, tamanoDelEje, estados, estadosDe, dias, casa: _casa };
}
