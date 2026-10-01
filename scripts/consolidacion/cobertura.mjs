/* === scripts/consolidacion/cobertura.mjs · LA COBERTURA DEL GENERADOR (consolidación, segunda vuelta · owner 2026-10-01) ═══
 * Los controles de las cinco familias corren sobre un corpus; si el corpus no ejerce un terreno, el control no lo prueba (las
 * mediciones ciegas v29 y v30 fallaron en el eje BODEGA, que el generador al azar casi no producía). Este módulo hace dos cosas:
 *
 *   1 · LAS CELDAS. `celdasDe(base, encargo)` describe qué combinaciones válidas ejerce un encargo, y `especificacionesDeCeldas`
 *       enumera TODAS las que el validador acepta (cada celda se confirma construyendo un encargo que el validador acepta SIN reparos:
 *       lo que no se puede construir se reporta aparte, nunca se da por válido). Las dimensiones:
 *         P  tema × cierre × eje                          D  definición: tema × concepto
 *         C  tema × cierre × eje × concepto               S  simulación: tema × eje × tipo de supuesto
 *         U  tema × cierre × eje × forma de universo      M  varias partes: pares de (tema, eje) y la terna comercial × inventario × cobranza
 *         F  LA FOTO: tema × cierre × eje × concepto, sin universo ni entidades (y los pares de conceptos de la foto: F2)
 *         Q  tema × cierre × eje × tipo de premisa (sobre un sujeto del MISMO eje que la parte)
 *         K  tema × cierre × eje × criterio (ninguno · cada lente · cada referencia · lente y referencia)
 *   2 · EL SUB-AZAR DE COBERTURA. `generarCobertura(base, { semilla, minimo })` produce, con su PROPIA semilla derivada
 *       (`<semilla>:cobertura`: no toca la secuencia del generador general ni la del sub-azar de la F3), encargos hasta que cada celda
 *       válida tiene al menos `minimo` encargos que la ejercen (cobertura voraz: un encargo suma a todas las celdas que ejerce).
 *       Cada encargo pasa por `validarEncargo`: solo se entregan los que el validador acepta sin reparos. Determinístico. OFFLINE. */
import { crearAzar } from "./azar.mjs";

const BODEGAS = ["Santiago", "Valparaíso", "Antofagasta", "Concepción"];
const OPS = ["<", ">", "<=", ">="];
const CIERRES_DE_PARTE = ["cifra", "lectura", "decision"];
const TIPOS_DE_PREMISA = ["cifra", "orden", "relacion", "grupo", "conteo", "variacion", "estado", "razon", "derivada"];
const FORMAS_DE_UNIVERSO = ["ninguno", "entidades", "top", "top-menor", "estados", "no_estados", "base", "filtros-valor", "filtros-ref", "excluir-entidades", "excluir-conjuntos", "excluir-estados", "excluir-bodega", "excluir-top", "bodega", "union", "combinado"];
const RANGO_REFERENCIA = { benchmark: ["pct", 20, 32], nivel_carga: ["pct", 3, 8], umbral_materialidad: ["pct", 0.05, 0.3], piso_rotacion: ["ratio", 0.5, 4], techo_cobertura: ["days", 40, 120], umbral_frenado: ["days", 3, 120] };
const SUPUESTOS = [   /* tipo de supuesto → unidades a probar (el validador decide) */
  { tipo: "growth", unidades: [["pct", 2], ["money", 500000]] }, { tipo: "price", unidades: [["pct", 2]] }, { tipo: "margin", unidades: [["pp", 1], ["pct", 1]] },
  { tipo: "carga", unidades: [["pp", -1]] }, { tipo: "costo", unidades: [["pct", 3]] }, { tipo: "custom", unidades: [["money", 13600], ["pct", -1]] },
];

/* ── las ayudas que no dependen del azar ─────────────────────────────────────────────────────────────────────────────── */
function ayudas(base) {
  const { esquema, lexico, estados, conjuntos, entityIndex, prioridadIntegrada, dominios, proyeccion } = base;
  const temas = dominios.DOMINIOS_REGISTRO.filter((d) => d.estado === "activo" && esquema.sujetoDeTema(d.id) && esquema.sujetoDeTema(d.id) !== "negocio").map((d) => d.id);
  const claves = lexico.CLAVES_DE_METRICA.filter((m) => !m.negocio && !m.referencia && (m.dominio || m.clave === "participacion"));
  const nombresDe = (eje) => { try { return entityIndex.axisEntityNames(eje) || []; } catch { return []; } };
  const rankingDe = (eje, clave) => (proyeccion && proyeccion.rankings && proyeccion.rankings[eje] && proyeccion.rankings[eje][clave]) || null;
  const conceptosDe = (tema, eje) => claves.filter((m) => (m.dominio === tema || m.clave === "participacion") && esquema.productorDe(m.clave, eje)).map((m) => m.clave);
  /* los pares (tema, eje) donde el tema tiene algún concepto con productor: el espacio válido de partes */
  const pares = [];
  for (const t of temas) for (const e of esquema.EJES) { if (claves.some((m) => m.dominio === t && esquema.productorDe(m.clave, e))) pares.push({ tema: t, eje: e }); }
  const baseDeEje = (eje) => conjuntos.CONJUNTOS_DE_LA_CASA.filter((c) => c.eje === eje && !/supuesto/.test(c.nombre));
  return { esquema, lexico, estados, conjuntos, entityIndex, prioridadIntegrada, temas, claves, nombresDe, rankingDe, conceptosDe, pares, baseDeEje, lentes: Object.keys(prioridadIntegrada.CRITERIOS), referencias: Object.keys(RANGO_REFERENCIA).filter((c) => lexico.CLAVES_DE_METRICA.some((m) => m.clave === c && m.referencia)), ejes: esquema.EJES };
}

function valido(base, enc) {
  let r = null;
  try { r = base.validar.validarEncargo(enc, {}); } catch { return null; }
  return r && Array.isArray(r.partes) && r.partes.length && (!Array.isArray(r.noResuelto) || r.noResuelto.length === 0) && r.partes.every((p) => p.estado === "resuelta") ? r : null;
}

/* ── LAS CELDAS QUE EJERCE UN ENCARGO ────────────────────────────────────────────────────────────────────────────────── */
function formasDelUniverso(u) {
  if (!u || typeof u !== "object") return ["ninguno"];
  const f = [];
  const lista = (x) => Array.isArray(x) && x.length > 0;
  if (u.top) f.push(u.top.direccion === "menor" ? "top-menor" : "top");
  if (lista(u.estados)) f.push("estados");
  if (lista(u.no_estados)) f.push("no_estados");
  if (u.base) f.push("base");
  if (lista(u.filtros)) f.push(u.filtros.some((x) => x && x.ref != null) ? "filtros-ref" : "filtros-valor");
  if (u.bodega) f.push("bodega");
  if (lista(u.union)) f.push("union");
  const ex = u.excluir && typeof u.excluir === "object" ? u.excluir : null;
  if (ex) { if (lista(ex.entidades)) f.push("excluir-entidades"); if (lista(ex.conjuntos)) f.push("excluir-conjuntos"); if (lista(ex.estados)) f.push("excluir-estados"); if (ex.bodega) f.push("excluir-bodega"); if (ex.top && (!Array.isArray(ex.top) || ex.top.length)) f.push("excluir-top"); }
  if (!f.length) return ["ninguno"];
  const prop = f.filter((x) => !String(x).startsWith("excluir"));
  return f.length >= 2 && (prop.length >= 2 || (prop.length >= 1 && f.length > prop.length)) ? [...f, "combinado"] : f;
}
function ejeDePremisa(a, p) {
  const sujeto = Array.isArray(p.sujeto) ? p.sujeto[0] : (p.sujeto != null ? p.sujeto : (p.num && p.num.sujeto) || null);
  const miembro = Array.isArray(p.miembros) ? p.miembros[0] : (Array.isArray(p.de) && p.de[0] && typeof p.de[0] === "object" ? p.de[0].sujeto : null);
  const u = p.universo || p.de;
  if (u && typeof u === "object" && u.eje) return u.eje;
  for (const n of [sujeto, miembro]) { if (typeof n !== "string") continue; for (const e of a.ejes) if (a.nombresDe(e).includes(n)) return e; }
  return null;
}
function criterioDe(enc) {
  const c = enc.criterio;
  if (!c || typeof c !== "object") return "ninguno";
  if (c.lente && c.referencia) return "ambos";
  if (c.lente) return `lente:${c.lente}`;
  if (c.referencia) return `ref:${c.referencia.concepto}`;
  return "ninguno";
}

/** celdasDe(base, encargo, { ayuda }) → Set de claves de celda que el encargo ejerce (solo las partes que el validador resuelve) */
export function celdasDe(base, enc, { ayuda = null, resolucion = null } = {}) {
  const a = ayuda || ayudas(base);
  const out = new Set();
  let R = resolucion;
  if (!R) { try { R = base.validar.validarEncargo(enc, {}); } catch { return out; } }
  const crit = criterioDe(enc);
  const utiles = [];
  (R.partes || []).forEach((p, i) => { if (p.estado === "resuelta" || p.estado === "parcial") utiles.push({ p, raw: (enc.partes || [])[i] || {} }); });
  const premisas = (R.premisas || []);
  for (const { p, raw } of utiles) {
    const t = p.tema, c = p.cierre;
    if (c === "definicion") { if (raw.concepto) out.add(`D:${t}|${raw.concepto}`); continue; }
    if (c === "simulacion") { for (const s of (R.supuestos || [])) out.add(`S:${t}|${p.eje}|${s.tipo}`); out.add(`P:${t}|${c}|${p.eje}`); continue; }
    const eje = p.eje || a.esquema.sujetoDeTema(t);
    out.add(`P:${t}|${c}|${eje}`);
    const conceptos = (p.conceptos && p.conceptos.length) ? p.conceptos : ["(procedimiento)"];
    for (const x of conceptos) out.add(`C:${t}|${c}|${eje}|${x}`);
    const conEntidades = Array.isArray(p.entidades) && p.entidades.length > 0;
    const formas = conEntidades ? ["entidades"] : formasDelUniverso(p.universo && Object.keys(p.universo).some((k) => k !== "eje") ? p.universo : null);
    for (const f of formas) out.add(`U:${t}|${c}|${eje}|${f}`);
    if (!conEntidades && formas[0] === "ninguno" && (c === "lectura" || c === "decision")) {
      for (const x of conceptos) out.add(`F:${t}|${c}|${eje}|${x}`);
      const cs = [...new Set(conceptos)].sort();
      for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) out.add(`F2:${t}|${c}|${eje}|${cs[i]}+${cs[j]}`);
    }
    for (const q of premisas) { const e = ejeDePremisa(a, q); if (e === eje) out.add(`Q:${t}|${c}|${eje}|${q.tipo}`); }
    if (["cifra", "lectura", "decision", "comparacion"].includes(c)) out.add(`K:${t}|${c}|${eje}|${crit}`);
  }
  /* varias partes: los pares de (tema, eje) de partes lectura/decision de temas distintos, y la terna comercial × inventario × cobranza */
  const cabezas = utiles.filter(({ p }) => p.cierre === "lectura" || p.cierre === "decision").map(({ p }) => `${p.tema}|${p.eje || a.esquema.sujetoDeTema(p.tema)}`);
  const unicas = [...new Set(cabezas)].sort();
  for (let i = 0; i < unicas.length; i++) for (let j = i + 1; j < unicas.length; j++) if (unicas[i].split("|")[0] !== unicas[j].split("|")[0]) out.add(`M:${unicas[i]}+${unicas[j]}`);
  const porTema = (t) => unicas.filter((x) => x.startsWith(`${t}|`));
  for (const x of porTema("comercial")) for (const y of porTema("inventario")) for (const z of porTema("cobranza")) out.add(`M3:${x}+${y}+${z}`);
  return out;
}

/* ── LA CONSTRUCCIÓN DE UN ENCARGO QUE EJERCE UNA CELDA ──────────────────────────────────────────────────────────────── */
function constructor(base, R) {
  const a = ayudas(base);
  const { esquema, estados } = a;
  const unidadDe = (clave) => { try { return base.lexico.unidadDeClave(clave); } catch { return null; } };
  const valorDe = (eje, clave, nombre, falso) => {
    const rk = a.rankingDe(eje, clave); const f = rk && (rk.filas || []).find((x) => x.entidad === nombre);
    const raw = f && Number.isFinite(f.raw) ? f.raw : R.int(5, 400);
    const v = falso ? Math.round(raw * (R.bool() ? 1.37 : 0.61) * 100) / 100 : raw;
    const u = unidadDe(clave);
    return u === "pct" ? `${v}%` : u === "days" ? `${v} días` : u === "ratio" ? `${v}x` : v;
  };
  const baseNombrada = (eje) => a.baseDeEje(eje);

  function universoDe(tema, eje, forma, conceptos) {
    const u = { eje };
    const metricasTop = [...new Set([...conceptos, ...a.conceptosDe(tema, eje)])];
    const conRanking = metricasTop.filter((c) => a.rankingDe(eje, c));
    const metrica = () => R.pick(conRanking.length ? conRanking : metricasTop);
    const ee = estados.estadosValidosPara(eje);
    const bb = baseNombrada(eje);
    const nn = a.nombresDe(eje);
    switch (forma) {
      case "ninguno": return R.bool(0.2) ? u : null;
      case "top": if (!metricasTop.length) return undefined; u.top = { metrica: metrica(), k: R.int(1, Math.max(1, Math.min(4, nn.length - 1))) }; return u;
      case "top-menor": if (!metricasTop.length) return undefined; u.top = { metrica: metrica(), k: R.int(1, Math.max(1, Math.min(3, nn.length - 1))), direccion: "menor" }; return u;
      case "estados": if (!ee.length) return undefined; u.estados = R.muestra(ee, 1); return u;
      case "no_estados": if (!ee.length) return undefined; u.no_estados = R.muestra(ee, 1); return u;
      case "base": if (!bb.length) return undefined; u.base = R.pick(bb).nombre; return u;
      case "filtros-valor": { if (!metricasTop.length) return undefined; const m = metrica(); const rk = a.rankingDe(eje, m); const vs = ((rk && rk.filas) || []).map((f) => f.valor).filter((v) => Number.isFinite(v)); u.filtros = [{ metrica: m, op: R.pick(OPS), valor: vs.length ? R.pick(vs) : 1 }]; return u; }
      case "filtros-ref": { const opc = []; if (metricasTop.includes("carga")) opc.push({ metrica: "carga", op: R.pick(OPS), ref: "nivel_carga" }); if (metricasTop.includes("margen")) opc.push({ metrica: "margen", op: R.pick(["<", ">="]), ref: "benchmark" }); if (metricasTop.includes("dias_inventario")) opc.push({ metrica: "dias_inventario", op: ">", ref: "techo_cobertura" }); if (metricasTop.includes("rotacion")) opc.push({ metrica: "rotacion", op: "<", ref: "piso_rotacion" }); if (!opc.length) return undefined; u.filtros = [R.pick(opc)]; return u; }
      case "excluir-entidades": if (nn.length < 2) return undefined; u.excluir = { entidades: R.muestra(nn, R.int(1, Math.min(2, nn.length - 1))) }; return u;
      case "excluir-conjuntos": if (!bb.length) return undefined; u.excluir = { conjuntos: [R.pick(bb).nombre] }; return u;
      case "excluir-estados": if (!ee.length) return undefined; u.excluir = { estados: [R.pick(ee)] }; return u;
      case "excluir-bodega": if (eje !== "sku") return undefined; u.excluir = { bodega: R.pick(BODEGAS) }; return u;
      case "excluir-top": if (!metricasTop.length) return undefined; u.excluir = { top: [{ metrica: metrica(), k: R.int(1, Math.max(1, Math.min(3, nn.length - 1))) }] }; return u;
      case "bodega": if (eje !== "sku") return undefined; u.bodega = R.pick(BODEGAS); return u;
      case "union": { const miembros = []; if (bb.length >= 2) { const dos = R.muestra(bb, 2); for (const x of dos) miembros.push({ base: x.nombre }); } else if (ee.length >= 2) { for (const x of R.muestra(ee, 2)) miembros.push({ estados: [x] }); } else return undefined; u.union = miembros; return u; }
      case "combinado": {
        const opciones = [];
        if (metricasTop.length && ee.length) opciones.push(() => { u.top = { metrica: metrica(), k: R.int(1, 3) }; u.estados = R.muestra(ee, 1); });
        if (metricasTop.length && bb.length) opciones.push(() => { u.top = { metrica: metrica(), k: R.int(1, 3) }; u.base = R.pick(bb).nombre; });
        if (eje === "sku" && ee.length) opciones.push(() => { u.bodega = R.pick(BODEGAS); u.estados = R.muestra(ee, 1); });
        if (ee.length && bb.length) opciones.push(() => { u.estados = R.muestra(ee, 1); u.excluir = { conjuntos: [R.pick(bb).nombre] }; });
        if (!opciones.length) return undefined; R.pick(opciones)(); return u;
      }
      default: return undefined;
    }
  }

  function parteDe(id, { tema, cierre, eje, concepto = null, conceptosFijos = null, forma = "ninguno" }) {
    if (cierre === "definicion") return { id, tema, cierre, concepto };
    const posibles = a.conceptosDe(tema, eje);
    let conceptos;
    if (conceptosFijos) conceptos = conceptosFijos;
    else if (cierre === "comparacion") conceptos = R.muestra(posibles, R.int(1, 2));
    else if (concepto) conceptos = [concepto, ...R.muestra(posibles.filter((c) => c !== concepto), R.pesos({ 0: 0.55, 1: 0.35, 2: 0.1 }) | 0)];
    else conceptos = R.muestra(posibles, R.int(1, 3));
    const p = { id, tema, cierre, conceptos };
    if (eje !== esquema.sujetoDeTema(tema) || R.bool(0.3)) p.eje = eje;
    const nn = a.nombresDe(eje);
    if (cierre === "comparacion") { if (nn.length < 2) return null; p.entidades = R.muestra(nn, 2).map((nombre) => (R.bool(0.3) ? { nombre, eje } : { nombre })); return p; }
    if (forma === "entidades") { if (nn.length < 2) return null; p.entidades = R.muestra(nn, R.int(1, Math.min(3, nn.length))).map((nombre) => (R.bool(0.3) ? { nombre, eje } : { nombre })); return p; }
    const u = universoDe(tema, eje, forma, conceptos);
    if (u === undefined) return null;
    if (u) p.universo = u;
    return p;
  }

  /* una premisa de `tipo` sobre sujetos de `eje` (tema: de dónde salen sus métricas) */
  function premisaDe(id, tipo, tema, eje) {
    const nn = a.nombresDe(eje); if (nn.length < 1) return null;
    const cs = a.conceptosDe(tema, eje).filter((c) => c !== "participacion"); const m = cs.length ? R.pick(cs) : null;
    const [A, B] = nn.length >= 2 ? R.muestra(nn, 2) : [nn[0], nn[0]];
    const falso = R.bool(0.35);
    switch (tipo) {
      case "cifra": return m ? { id, tipo, sujeto: A, metrica: m, valor: valorDe(eje, m, A, falso) } : null;
      case "orden": { if (!m) return null; const f = R.pick(["max", "min", "puesto", "topk", "comparativo"]); const o = { forma: f }; if (f === "puesto" || f === "topk") o.k = R.int(1, Math.max(1, Math.min(3, nn.length))); if (f === "comparativo") { if (nn.length < 2) return null; o.vs = B; } return { id, tipo, sujeto: A, metrica: m, orden: o, universo: { eje } }; }
      case "relacion": { if (!m || nn.length < 2) return null; const f = R.pick(["mayor", "menor", "veces", "igual", "fraccion", "diferencia"]); const r = { forma: f, vs: { sujeto: B } }; if (f === "veces" || f === "fraccion") r.k = f === "veces" ? 2 : 0.5; return { id, tipo, sujeto: A, metrica: m, relacion: r }; }
      case "grupo": { const u = universoDe(tema, eje, R.pick(["estados", "base", "top", "ninguno"]), cs) || { eje }; if (u === undefined) return null; return { id, tipo, miembros: R.muestra(nn, R.int(1, Math.min(2, nn.length))), universo: u }; }
      case "conteo": { const u = universoDe(tema, eje, R.pick(["estados", "base", "top", "filtros-valor"]), cs) || { eje }; return { id, tipo, conteo: { n: R.int(0, Math.min(8, nn.length)), m: nn.length }, de: u }; }
      case "estado": { const ee = estados.estadosValidosPara(eje); if (!ee.length) return null; return { id, tipo, sujeto: A, estado: R.pick(ee) }; }
      case "variacion": { const cv = a.conceptosDe(tema, eje).filter((c) => /^(ventas|variacion|ventas_anterior)$/.test(c)); if (!cv.length) return null; return { id, tipo, sujeto: A, metrica: R.pick(cv), variacion: { direccion: R.pick(["sube", "baja"]) }, periodo: "anterior" }; }
      case "razon": { if (cs.length < 2) return null; const [n, d] = R.muestra(cs, 2); return { id, tipo, sujeto: A, num: { metrica: n }, den: { metrica: d }, valor: `${R.int(5, 95)}%` }; }
      case "derivada": { if (!m || nn.length < 2) return null; return { id, tipo, op: R.pick(["suma", "diferencia"]), de: [{ sujeto: A, metrica: m }, { sujeto: B, metrica: m }], valor: valorDe(eje, m, A, true) }; }
      default: return null;
    }
  }

  function criterioDeCelda(crit) {
    const ref = (c) => { const [unidad, x, y] = RANGO_REFERENCIA[c]; return { concepto: c, valor: Math.round((x + (y - x) * R.next()) * 100) / 100, unidad }; };
    if (crit === "ninguno") return null;
    if (crit === "ambos") return { lente: R.pick(a.lentes), referencia: ref(R.pick(a.referencias)) };
    if (crit.startsWith("lente:")) return { lente: crit.slice(6) };
    if (crit.startsWith("ref:")) return { referencia: ref(crit.slice(4)) };
    return null;
  }

  /* una parte cualquiera, con forma simple, para acompañar (no es el objeto de la celda) */
  function parteAcompanante(id) {
    const pp = R.pick(a.pares);
    const cierre = R.pesos({ cifra: 0.3, lectura: 0.35, decision: 0.35 });
    const forma = R.pesos({ ninguno: 0.6, top: 0.15, estados: 0.1, entidades: 0.1, base: 0.05 });
    return parteDe(id, { tema: pp.tema, cierre, eje: pp.eje, forma });
  }

  function supuestoDe(tipoSup, tema, eje) {
    const nn = a.nombresDe(eje); if (!nn.length) return null;
    const def = SUPUESTOS.find((x) => x.tipo === tipoSup); if (!def) return null;
    const [unidad, valor] = R.pick(def.unidades);
    return { id: "s1", tipo: tipoSup, valor, unidad, alcance: { eje, nombre: R.pick(nn) }, origen: "supuesto" };
  }

  return { a, parteDe, premisaDe, criterioDeCelda, parteAcompanante, supuestoDe, universoDe };
}

/* ── LA ESPECIFICACIÓN DE CADA CELDA (lo que el constructor necesita para ejercerla) ─────────────────────────────────── */
function celdasPosibles(a) {
  const specs = new Map();
  const add = (clave, spec) => { if (!specs.has(clave)) specs.set(clave, { clave, ...spec }); };
  for (const { tema, eje } of a.pares) {
    const cs = a.conceptosDe(tema, eje);
    for (const cierre of [...CIERRES_DE_PARTE, "comparacion"]) {
      add(`P:${tema}|${cierre}|${eje}`, { dim: "P", tema, cierre, eje });
      for (const c of cs) add(`C:${tema}|${cierre}|${eje}|${c}`, { dim: "C", tema, cierre, eje, concepto: c });
      if (cierre !== "comparacion") for (const f of FORMAS_DE_UNIVERSO) add(`U:${tema}|${cierre}|${eje}|${f}`, { dim: "U", tema, cierre, eje, forma: f });
      else add(`U:${tema}|${cierre}|${eje}|entidades`, { dim: "U", tema, cierre, eje, forma: "entidades" });
      for (const crit of ["ninguno", ...a.lentes.map((l) => `lente:${l}`), ...a.referencias.map((r) => `ref:${r}`), "ambos"]) add(`K:${tema}|${cierre}|${eje}|${crit}`, { dim: "K", tema, cierre, eje, crit });
    }
    for (const cierre of CIERRES_DE_PARTE) {
      if (cierre !== "cifra") {
        for (const c of cs) add(`F:${tema}|${cierre}|${eje}|${c}`, { dim: "F", tema, cierre, eje, concepto: c });
        /* los pares de conceptos de la foto: todos si son pocos; con muchos conceptos, una muestra determinística de ~20 pares (cada par ordenado alfabéticamente) */
        const s = [...cs].sort(), todos = [];
        for (let i = 0; i < s.length; i++) for (let j = i + 1; j < s.length; j++) todos.push([s[i], s[j]]);
        const paso = Math.max(1, Math.ceil(todos.length / 20));
        todos.forEach((par, n) => { if (n % paso === 0) add(`F2:${tema}|${cierre}|${eje}|${par[0]}+${par[1]}`, { dim: "F2", tema, cierre, eje, conceptos: par }); });
      }
      for (const tp of TIPOS_DE_PREMISA) add(`Q:${tema}|${cierre}|${eje}|${tp}`, { dim: "Q", tema, cierre, eje, tipoPremisa: tp });
    }
  }
  for (const t of a.temas) { const d = a.claves.filter((m) => m.dominio === t); for (const m of d) add(`D:${t}|${m.clave}`, { dim: "D", tema: t, concepto: m.clave }); }
  for (const t of ["comercial", "inventario"]) for (const eje of a.ejes) for (const s of SUPUESTOS) add(`S:${t}|${eje}|${s.tipo}`, { dim: "S", tema: t, eje, tipoSupuesto: s.tipo });
  const items = [];
  for (const { tema, eje } of a.pares) for (const cierre of ["lectura", "decision"]) items.push({ tema, eje, cierre });
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
    if (items[i].tema === items[j].tema) continue;
    const k = [`${items[i].tema}|${items[i].eje}`, `${items[j].tema}|${items[j].eje}`].sort().join("+");
    add(`M:${k}`, { dim: "M", items: [items[i], items[j]] });
  }
  for (const x of a.pares.filter((p) => p.tema === "comercial")) for (const y of a.pares.filter((p) => p.tema === "inventario")) for (const z of a.pares.filter((p) => p.tema === "cobranza")) {
    add(`M3:${x.tema}|${x.eje}+${y.tema}|${y.eje}+${z.tema}|${z.eje}`, { dim: "M3", items: [{ ...x, cierre: "lectura" }, { ...y, cierre: "lectura" }, { ...z, cierre: "lectura" }] });
  }
  return specs;
}

function armarEncargo(base, k, R, spec) {
  const { a, parteDe, premisaDe, criterioDeCelda, parteAcompanante, supuestoDe } = k;
  const partes = []; let premisas = []; let criterio = null; let supuestos = null;
  const sig = () => `p${partes.length + 1}`;
  switch (spec.dim) {
    case "P": case "C": case "K": {
      const p = parteDe(sig(), { tema: spec.tema, cierre: spec.cierre, eje: spec.eje, concepto: spec.concepto || null, forma: spec.cierre === "comparacion" ? "ninguno" : R.pesos({ ninguno: 0.6, top: 0.12, estados: 0.1, base: 0.08, entidades: 0.1 }) });
      if (!p) return null; partes.push(p);
      if (spec.dim === "K") criterio = criterioDeCelda(spec.crit);
      break;
    }
    case "U": { const p = parteDe(sig(), { tema: spec.tema, cierre: spec.cierre, eje: spec.eje, forma: spec.forma }); if (!p) return null; partes.push(p); break; }
    case "F": { const p = parteDe(sig(), { tema: spec.tema, cierre: spec.cierre, eje: spec.eje, concepto: spec.concepto, forma: "ninguno" }); if (!p) return null; delete p.universo; partes.push(p); break; }
    case "F2": { const p = parteDe(sig(), { tema: spec.tema, cierre: spec.cierre, eje: spec.eje, conceptosFijos: [...spec.conceptos], forma: "ninguno" }); if (!p) return null; delete p.universo; partes.push(p); break; }
    case "Q": {
      const p = parteDe(sig(), { tema: spec.tema, cierre: spec.cierre, eje: spec.eje, forma: R.pesos({ ninguno: 0.7, top: 0.1, estados: 0.1, entidades: 0.1 }) }); if (!p) return null; partes.push(p);
      const q = premisaDe("q1", spec.tipoPremisa, spec.tema, spec.eje); if (!q) return null; premisas.push(q);
      break;
    }
    case "D": { const p = parteDe(sig(), { tema: spec.tema, cierre: "definicion", concepto: spec.concepto }); partes.push(p); break; }
    case "S": {
      const s = supuestoDe(spec.tipoSupuesto, spec.tema, spec.eje); if (!s) return null;
      const cs = a.conceptosDe(spec.tema, spec.eje);
      partes.push({ id: "p1", tema: spec.tema, cierre: "simulacion", conceptos: R.muestra(cs, Math.min(2, cs.length)), ...(spec.eje !== a.esquema.sujetoDeTema(spec.tema) ? { eje: spec.eje } : {}), entidades: [{ nombre: s.alcance.nombre, eje: spec.eje }], supuestos: ["s1"] });
      supuestos = [s];
      break;
    }
    case "M": case "M3": {
      for (const it of spec.items) { const p = parteDe(sig(), { tema: it.tema, cierre: it.cierre, eje: it.eje, forma: R.pesos({ ninguno: 0.85, top: 0.08, estados: 0.07 }) }); if (!p) return null; partes.push(p); }
      break;
    }
    default: return null;
  }
  /* acompañantes al azar: otras partes (variedad: cada encargo ejerce más de una celda), alguna premisa y criterio extra */
  if (spec.dim !== "M" && spec.dim !== "M3" && spec.dim !== "D" && spec.dim !== "S") {
    const extra = R.pesos({ 0: 0.62, 1: 0.28, 2: 0.1 }) | 0;
    for (let i = 0; i < extra && partes.length < 4; i++) { const p = parteAcompanante(sig()); if (p) partes.push(p); }
  }
  if (spec.dim !== "Q" && R.bool(0.18)) { const pp = R.pick(a.pares); const q = premisaDe("q1", R.pick(TIPOS_DE_PREMISA), pp.tema, pp.eje); if (q) premisas.push(q); }
  if (spec.dim !== "K" && spec.dim !== "S" && !criterio && R.bool(0.2)) criterio = criterioDeCelda(R.pick(["ninguno", ...a.lentes.map((l) => `lente:${l}`), ...a.referencias.map((r) => `ref:${r}`), "ambos"]));
  const enc = { version: "encargo/v1", partes };
  if (criterio) enc.criterio = criterio;
  if (premisas.length) enc.premisas = premisas;
  if (supuestos) enc.supuestos = supuestos;
  if (R.bool(0.1)) enc.profundidad = "breve";
  return enc;
}

/** especificacionesDeCeldas(base, { semilla, intentos }) → Map(clave → spec) con SOLO las celdas que el validador acepta (se confirma construyendo un encargo válido); `noConstruibles` lista las que no. */
export function especificacionesDeCeldas(base, { semilla = "adi-consolidacion-1", intentos = 60 } = {}) {
  const R = crearAzar(`${semilla}:cobertura:espacio`);
  const k = constructor(base, R);
  const todas = celdasPosibles(k.a);
  const validas = new Map(), noConstruibles = [];
  for (const [clave, spec] of todas) {
    let ok = false;
    for (let i = 0; i < intentos && !ok; i++) { const enc = armarEncargo(base, k, R, spec); if (!enc) continue; const r = valido(base, enc); if (r && celdasDe(base, enc, { ayuda: k.a, resolucion: r }).has(clave)) ok = true; }
    if (ok) validas.set(clave, spec); else noConstruibles.push(clave);
  }
  return { validas, noConstruibles, posibles: todas.size, ayuda: k.a };
}

/** generarCobertura(base, { semilla, minimo, dims, espacio }) → { casos, estadistica, conteo } — el sub-azar de cobertura: cada celda válida ejercida al menos `minimo` veces. */
export function generarCobertura(base, { semilla = "adi-consolidacion-1", minimo = 2, dims = null, espacio = null, maximoPorCelda = 40 } = {}) {
  const esp = espacio || especificacionesDeCeldas(base, { semilla });
  const R = crearAzar(`${semilla}:cobertura`);
  const k = constructor(base, R);
  const conteo = new Map();
  const casos = [];
  const estadistica = { intentos: 0, rechazados: 0, celdas: 0, sinCompletar: [] };
  for (const [clave, spec] of esp.validas) {
    if (dims && !dims.includes(spec.dim)) continue;
    estadistica.celdas++;
    let intentos = 0;
    while ((conteo.get(clave) || 0) < minimo && intentos < maximoPorCelda) {
      intentos++; estadistica.intentos++;
      const enc = armarEncargo(base, k, R, spec);
      const r = enc ? valido(base, enc) : null;
      if (!r) { estadistica.rechazados++; continue; }
      const cs = celdasDe(base, enc, { ayuda: esp.ayuda, resolucion: r });
      if (!cs.has(clave)) { estadistica.rechazados++; continue; }
      for (const c of cs) conteo.set(c, (conteo.get(c) || 0) + 1);
      casos.push({ origen: "cobertura", id: `cobertura:${semilla}:${casos.length + 1}`, encargo: enc, celda: clave });
    }
    if ((conteo.get(clave) || 0) < minimo) estadistica.sinCompletar.push(clave);
  }
  return { casos, estadistica, conteo };
}

/** auditarCobertura(base, casos, { espacio }) → { porDim: { dim: { validas, ceros, pocas, minimo, mediana } }, ceros: [clave], conteo } sobre un conjunto de casos */
export function auditarCobertura(base, casos, { espacio = null, umbralPoco = 5 } = {}) {
  const esp = espacio || especificacionesDeCeldas(base);
  const conteo = new Map();
  for (const c of casos) { let r = null; try { r = base.validar.validarEncargo(c.encargo, {}); } catch { continue; } for (const x of celdasDe(base, c.encargo, { ayuda: esp.ayuda, resolucion: r })) conteo.set(x, (conteo.get(x) || 0) + 1); }
  const porDim = {}, ceros = [], pocas = [];
  for (const [clave, spec] of esp.validas) {
    const d = (porDim[spec.dim] = porDim[spec.dim] || { validas: 0, ceros: 0, pocas: 0 });
    d.validas++;
    const n = conteo.get(clave) || 0;
    if (n === 0) { d.ceros++; ceros.push(clave); } else if (n < umbralPoco) { d.pocas++; pocas.push(clave); }
  }
  return { porDim, ceros, pocas, conteo, noConstruibles: esp.noConstruibles, posibles: esp.posibles };
}
