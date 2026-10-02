/* === scripts/consolidacion/generador.mjs · EL GENERADOR DE ENCARGOS AL AZAR (consolidación, infraestructura común) ═════
 * Produce encargos tipados (`encargo/v1`) al azar con SEMILLA FIJA, construidos desde el ESQUEMA del encargo — nunca desde
 * frases: temas (`DOMINIOS_REGISTRO`), cierres (`CIERRES`), ejes (`EJES`), conceptos (`CLAVES_DE_METRICA` con productor en el
 * eje, `ejesConProductor`), universos (top · estados · base · filtros · excluir · bodega · union, con los conjuntos y estados de la
 * casa), premisas, criterios (las lentes de `CRITERIOS` y las referencias del léxico) y entidades (el índice del dato). Cada encargo
 * candidato pasa por `validarEncargo`: solo se entregan los que el validador acepta SIN reparos (`noResuelto` vacío) — «válidos y
 * variados». Determinístico: misma semilla y misma raíz ⇒ mismos encargos. OFFLINE: no llama a nadie. */
import { crearAzar } from "./azar.mjs";
/* LA COBERTURA (consolidación, segunda vuelta): el sub-azar que garantiza un mínimo por cada combinación válida (tema × cierre × eje × concepto × forma de universo × premisa × criterio), con su PROPIA semilla derivada (`<semilla>:cobertura`): no mueve la secuencia de este generador ni la del sub-azar de la F3. */
export { generarCobertura, generarConteosDeCadena, VARIANTES_DE_CONTEO, especificacionesDeCeldas, auditarCobertura, celdasDe } from "./cobertura.mjs";

const PESOS_TEMA = { comercial: 0.42, inventario: 0.31, cobranza: 0.27 };
/* los cierres que el generador produce: se carga la mano en `decision` (donde vive la prioridad) y en `lectura` (la foto) */
const PESOS_CIERRE = { cifra: 0.34, decision: 0.4, lectura: 0.14, comparacion: 0.05, definicion: 0.05, cifraEntidad: 0.02 };
const PESOS_EJE = { comercial: { cliente: 0.55, marca: 0.15, sku: 0.15, familia: 0.08, canal: 0.07 }, cobranza: { cliente: 1 }, inventario: { sku: 0.7, bodega: 0.2, familia: 0.1 } };
const BODEGAS = ["Santiago", "Valparaíso", "Antofagasta", "Concepción"];
/* las referencias del léxico (`referencia: true`) con su unidad y el rango de valores razonable (el valor lo pone el «usuario») */
const RANGO_REFERENCIA = { benchmark: ["pct", 20, 32], nivel_carga: ["pct", 3, 8], umbral_materialidad: ["pct", 0.05, 0.3], piso_rotacion: ["ratio", 0.5, 4], techo_cobertura: ["days", 40, 120], umbral_frenado: ["days", 3, 120] };
const OPS = ["<", ">", "<=", ">="];
/* FAMILIA 3 (consolidación): los conjuntos de la casa que una referencia de la consulta DEFINE, con el eje y el universo tipado que los pone en juego (el generador general rara vez junta una referencia con su conjunto). Lo usa el SUB-AZAR de la F3: una referencia + UNO O VARIOS usos del mismo conjunto, en partes nuevas (de cliente, SKU, marca o familia) y a veces en una premisa. */
const CONJUNTOS_F3 = [
  { ref: "benchmark", tema: "comercial", usos: [
    { eje: "cliente", u: { base: "bajo el benchmark" } }, { eje: "cliente", u: { base: "sobre el benchmark" } }, { eje: "sku", u: { base: "SKU bajo el benchmark" } }, { eje: "sku", u: { base: "SKU sobre el benchmark" } },
    { eje: "cliente", u: { filtros: [{ metrica: "margen", op: "<", ref: "benchmark" }] } }, { eje: "marca", u: { filtros: [{ metrica: "margen", op: "<", ref: "benchmark" }] } }, { eje: "marca", u: { filtros: [{ metrica: "margen", op: ">=", ref: "benchmark" }] } }, { eje: "familia", u: { filtros: [{ metrica: "margen", op: "<", ref: "benchmark" }] } },
  ] },
  { ref: "nivel_carga", tema: "comercial", usos: [
    { eje: "cliente", u: { base: "sobre el nivel declarado de carga" } }, { eje: "cliente", u: { base: "carga comercial alta" } }, { eje: "marca", u: { filtros: [{ metrica: "carga", op: ">", ref: "nivel_carga" }] } },
  ] },
  { ref: "umbral_materialidad", tema: "comercial", usos: [{ eje: "cliente", u: { base: "carga comercial alta" } }] },
  { ref: "piso_rotacion", tema: "inventario", usos: [
    { eje: "sku", u: { estados: ["rota lento"] } }, { eje: "sku", u: { estados: ["rota bien"] } }, { eje: "sku", u: { estados: ["inmovilizado critico"] } },
  ] },
  { ref: "techo_cobertura", tema: "inventario", usos: [
    { eje: "sku", u: { filtros: [{ metrica: "dias_inventario", op: ">", ref: "techo_cobertura" }] } }, { eje: "sku", u: { estados: ["sobrestock"] } }, { eje: "sku", u: { estados: ["inmovilizado critico"] } },
  ] },
  { ref: "umbral_frenado", tema: "inventario", usos: [{ eje: "sku", u: { estados: ["frenado"] } }] },
];

export async function crearGenerador(base, { semilla = "adi-consolidacion-1", validar = true } = {}) {
  const { esquema, lexico, estados, conjuntos, entityIndex, prioridadIntegrada, dominios, proyeccion } = base;
  const R = crearAzar(semilla);
  const temasValidos = (dominios.DOMINIOS_REGISTRO || []).map((d) => d.id).filter((t) => esquema.sujetoDeTema(t) && PESOS_TEMA[t] != null);
  const claves = lexico.CLAVES_DE_METRICA.filter((m) => !m.negocio && !m.referencia && m.dominio);
  const referencias = lexico.CLAVES_DE_METRICA.filter((m) => m.referencia).map((m) => m.clave).filter((c) => RANGO_REFERENCIA[c]);
  const lentes = Object.keys(prioridadIntegrada.CRITERIOS);
  const nombresDe = (eje) => { try { return entityIndex.axisEntityNames(eje) || []; } catch { return []; } };
  const rankingDe = (eje, clave) => (proyeccion && proyeccion.rankings && proyeccion.rankings[eje] && proyeccion.rankings[eje][clave]) || null;
  const conceptosDe = (tema, eje) => claves.filter((m) => m.dominio === tema && esquema.productorDe(m.clave, eje) && m.clave !== "participacion").map((m) => m.clave);

  /* ── el universo de una parte (todos los campos de `universo` salen de las listas cerradas de la casa) ───────────────── */
  function universoDe(tema, eje, conceptos) {
    const tipo = R.pesos({ ninguno: 0.2, top: 0.3, estados: 0.2, base: 0.12, filtros: 0.08, excluir: 0.06, bodega: 0.04 });
    const u = { eje };
    const metricasTop = [...new Set([...conceptos, ...conceptosDe(tema, eje)])].filter((c) => rankingDe(eje, c));
    const top = () => ({ metrica: R.pick(metricasTop), k: R.int(1, 4), ...(R.bool(0.15) ? { direccion: "menor" } : {}) });
    if (tipo === "top" && metricasTop.length) u.top = top();
    else if (tipo === "estados") { const ee = estados.estadosValidosPara(eje); if (ee.length) u.estados = R.muestra(ee, R.bool(0.9) ? 1 : 2); }
    else if (tipo === "base") { const bb = conjuntos.CONJUNTOS_DE_LA_CASA.filter((c) => c.eje === eje && c.familia !== "estado" && !/supuesto/.test(c.nombre)); if (bb.length) u.base = R.pick(bb).nombre; }
    else if (tipo === "filtros" && metricasTop.length) {
      const m = R.pick(metricasTop); const rk = rankingDe(eje, m);
      const vs = ((rk && rk.filas) || []).map((f) => f.valor).filter((v) => Number.isFinite(v));
      const valor = vs.length ? R.pick(vs) : 1;
      const refs = referencias.filter((r) => /carga|benchmark/.test(r));
      u.filtros = [(m === "carga" && R.bool(0.5)) ? { metrica: "carga", op: R.pick(OPS), ref: "nivel_carga" } : (m === "margen" && R.bool(0.4)) ? { metrica: "margen", op: R.pick(["<", ">="]), ref: R.pick(refs.includes("benchmark") ? ["benchmark"] : ["benchmark"]) } : { metrica: m, op: R.pick(OPS), valor }];
    } else if (tipo === "excluir") {
      const k = R.pick(["conjuntos", "entidades", "estados", "bodega", "top"]);
      if (k === "conjuntos") { const bb = conjuntos.CONJUNTOS_DE_LA_CASA.filter((c) => c.eje === eje && c.familia !== "estado" && !/supuesto/.test(c.nombre)); if (bb.length) u.excluir = { conjuntos: [R.pick(bb).nombre] }; }
      else if (k === "entidades") { const nn = nombresDe(eje); if (nn.length) u.excluir = { entidades: R.muestra(nn, R.int(1, 2)) }; }
      else if (k === "estados") { const ee = estados.estadosValidosPara(eje); if (ee.length) u.excluir = { estados: [R.pick(ee)] }; }
      else if (k === "bodega" && eje === "sku") u.excluir = { bodega: R.pick(BODEGAS) };
      else if (k === "top" && metricasTop.length) u.excluir = { top: [{ metrica: R.pick(metricasTop), k: R.int(1, 3) }] };
    } else if (tipo === "bodega" && eje === "sku") { u.bodega = R.pick(BODEGAS); if (R.bool(0.5)) { const ee = estados.estadosValidosPara(eje); if (ee.length) u.estados = [R.pick(ee)]; } }
    return u;
  }

  /* ── una parte ──────────────────────────────────────────────────────────────────────────────────────────────────── */
  function parteDe(n) {
    const tema = R.pesos(Object.fromEntries(temasValidos.map((t) => [t, PESOS_TEMA[t]])));
    let cierre = R.pesos(PESOS_CIERRE);
    const conEntidades = cierre === "cifraEntidad"; if (conEntidades) cierre = "cifra";
    const id = `p${n}`;
    if (cierre === "definicion") { const cs = claves.filter((m) => m.dominio === tema); return { id, tema, cierre, concepto: R.pick(cs).clave }; }
    const pe = PESOS_EJE[tema] || { [esquema.sujetoDeTema(tema)]: 1 };
    let eje = R.pesos(pe), conceptos = conceptosDe(tema, eje);
    for (let i = 0; i < 6 && !conceptos.length; i++) { eje = R.pesos(pe); conceptos = conceptosDe(tema, eje); }
    if (!conceptos.length) { eje = esquema.sujetoDeTema(tema); conceptos = conceptosDe(tema, eje); }
    const elegidos = R.muestra(conceptos, cierre === "comparacion" ? 2 : R.int(1, 3));
    const p = { id, tema, cierre, conceptos: elegidos };
    const porDefecto = eje === esquema.sujetoDeTema(tema);
    if (!porDefecto || R.bool(0.3)) p.eje = eje;
    const nn = nombresDe(eje);
    const quiereEntidades = cierre === "comparacion" || conEntidades || ((cierre === "decision" || cierre === "lectura" || cierre === "cifra") && R.bool(cierre === "decision" ? 0.28 : 0.3));
    if (quiereEntidades && nn.length >= 2) {
      const k = cierre === "comparacion" ? 2 : R.int(1, Math.min(3, nn.length));
      p.entidades = R.muestra(nn, k).map((nombre) => (R.bool(0.3) ? { nombre, eje } : { nombre }));
    } else if (R.bool(0.75)) p.universo = universoDe(tema, eje, elegidos);
    if (!p.entidades && !p.universo && R.bool(0.2)) p.universo = { eje };
    return p;
  }

  /* ── el criterio de la raíz: ninguno · una lente · solo una referencia · ambos ──────────────────────────────────────── */
  function criterioDe() {
    const tipo = R.pesos({ ninguno: 0.5, lente: 0.3, referencia: 0.12, ambos: 0.08 });
    if (tipo === "ninguno") return null;
    const ref = () => { const c = R.pick(referencias); const [unidad, a, b] = RANGO_REFERENCIA[c]; const v = a + (b - a) * R.next(); return { concepto: c, valor: Math.round(v * 100) / 100, unidad }; };
    if (tipo === "lente") return { lente: R.pick(lentes) };
    if (tipo === "referencia") return { referencia: ref() };
    return { lente: R.pick(lentes), referencia: ref() };
  }

  /* ── las premisas (pocas y simples: la prioridad no depende de ellas, pero conviven con ella) ───────────────────────── */
  function premisasDe(partes) {
    const out = [];
    const conEje = partes.filter((p) => p.cierre !== "definicion");
    if (!conEje.length || !R.bool(0.2)) return out;
    const p = R.pick(conEje); const eje = p.eje || esquema.sujetoDeTema(p.tema); const nn = nombresDe(eje);
    if (!nn.length) return out;
    out.push({ id: "q1", tipo: "grupo", miembros: [R.pick(nn)], universo: { eje } });
    const ee = estados.estadosValidosPara(eje);
    if (ee.length && R.bool(0.5)) out.push({ id: "q2", tipo: "estado", sujeto: R.pick(nn), estado: R.pick(ee) });
    return out;
  }

  /* ── EL SUB-AZAR DE LA F3: su propia semilla (`<semilla>:f3-referencia`), que NO toca la secuencia del generador general. Sobre un encargo ya VÁLIDO, con probabilidad 0.3 le agrega una referencia de la consulta y partes nuevas que usan el MISMO conjunto que ella define (1 a 3 partes), y a veces una premisa de conteo sobre ese conjunto; el resultado se valida: si el validador lo rechaza, queda el encargo original. ── */
  const R3 = crearAzar(semilla + ":f3-referencia");
  function refinarConReferencia(enc) {
    if (!R3.bool(0.3)) return null;
    const fam = R3.pick(CONJUNTOS_F3);
    const [unidad, a, b] = RANGO_REFERENCIA[fam.ref];
    const out = JSON.parse(JSON.stringify(enc));
    out.criterio = { ...(out.criterio || {}), referencia: { concepto: fam.ref, valor: Math.round((a + (b - a) * R3.next()) * 100) / 100, unidad } };
    const uso = R3.pick(fam.usos);
    const k = Number(R3.pesos({ 1: 0.4, 2: 0.4, 3: 0.2 }));
    const otro = R3.bool(0.25) ? R3.pick(fam.usos) : null;
    let n = out.partes.length;
    for (let i = 0; i < k && n < 6; i++) {
      const u = i === k - 1 && otro ? otro : uso; n++;
      const conceptos = conceptosDe(fam.tema, u.eje);
      if (!conceptos.length) continue;
      const cierre = R3.pesos({ cifra: 0.4, decision: 0.3, lectura: 0.3 });
      const p = { id: `p${n}`, tema: fam.tema, cierre, conceptos: R3.muestra(conceptos, R3.int(1, 2)) };
      if (u.eje !== esquema.sujetoDeTema(fam.tema)) p.eje = u.eje;
      p.universo = { eje: u.eje, ...JSON.parse(JSON.stringify(u.u)) };
      out.partes.push(p);
    }
    if (R3.bool(0.4)) {
      const nn = nombresDe(uso.eje);
      if (nn.length) { const id = `q${(out.premisas || []).length + 1}`; (out.premisas = out.premisas || []).push({ id, tipo: "conteo", conteo: { n: R3.int(0, Math.min(8, nn.length)), m: nn.length }, de: { eje: uso.eje, ...JSON.parse(JSON.stringify(uso.u)) } }); }
    }
    return out;
  }

  function candidato() {
    const nPartes = Number(R.pesos({ 1: 0.62, 2: 0.24, 3: 0.1, 4: 0.04 }));
    const partes = []; for (let i = 1; i <= nPartes; i++) partes.push(parteDe(i));
    const enc = { version: "encargo/v1", partes };
    const crit = criterioDe(); if (crit) enc.criterio = crit;
    const pr = premisasDe(partes); if (pr.length) enc.premisas = pr;
    if (R.bool(0.1)) enc.profundidad = "breve";
    return enc;
  }

  /** siguiente() → un encargo válido (el validador lo acepta sin reparos). Cuenta intentos y rechazos. */
  const estadistica = { intentos: 0, rechazados: 0 };
  function siguiente() {
    for (let i = 0; i < 200; i++) {
      const enc = candidato(); estadistica.intentos++;
      if (!validar) return enc;
      const valido = (e) => { let r = null; try { r = base.validar.validarEncargo(e, {}); } catch { r = null; } return !!(r && Array.isArray(r.partes) && r.partes.length && (!Array.isArray(r.noResuelto) || r.noResuelto.length === 0)); };
      if (valido(enc)) { const f3 = refinarConReferencia(enc); return f3 && valido(f3) ? f3 : enc; }
      estadistica.rechazados++;
    }
    throw new Error("el generador no logró un encargo válido en 200 intentos");
  }
  return { siguiente, estadistica };
}

/** generarEncargos(base, { semilla, n }) → [{ origen:"azar", id, encargo }] */
export async function generarEncargos(base, { semilla = "adi-consolidacion-1", n = 100 } = {}) {
  const g = await crearGenerador(base, { semilla });
  const out = [];
  for (let i = 0; i < n; i++) out.push({ origen: "azar", id: `azar:${semilla}:${i + 1}`, encargo: g.siguiente() });
  return { casos: out, estadistica: g.estadistica };
}
