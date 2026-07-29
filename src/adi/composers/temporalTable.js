/* === src/adi/composers/temporalTable.js · TIEMPO/TRAYECTORIA (mejora 7 · owner 2026-07-25/26) ===
 * "Si yo te dijera dame las ventas por mes y por clientes en una tabla… espero que ADI diga la historia que ya
 * sabemos y al ver en Sentrix esté todo como debe estar" + "cuando alguien pida el mes a mes, o el primer Q o lo
 * que sea, debe estar disponible".
 *
 * UNA VERDAD CON SENTRIX: toda serie sale de temporal.js (buildGlobalEvolution · buildEntityEvolutionComparado —
 * las MISMAS series ancladas del evolutivo de la Mesa y el sparkline de la Ficha; el total del año cierra EXACTO
 * con el dato del período). Los PERIODOS AGREGADOS (Q1-Q4 · semestres · rangos "enero a marzo" · un mes) son Σ de
 * meses de esa misma serie — exactos por construcción, jamás prorrateo.
 *
 * HONESTIDAD DECLARADA: resultado/P&L mensual no existe (los gastos son % sobre la venta ANUAL) · inventario es
 * foto de hoy · canal mensual sin desglose → cada límite se DECLARA y redirige a donde el dato sí llega.
 * LA HISTORIA primero (tendencia · mejor/peor mes · quién tracciona — registro ejecutivo, cifras una por línea,
 * todas en la boleta) + LA TABLA estructurada en la evidencia (tabla_matriz → InlineChart). */
import { buildGlobalEvolution, buildEntityEvolutionComparado, resolveEntityName, reconcileMonthly } from "../sentrix/temporal.js";
import { clientesMargen, marcasMargen, sfamiliasMargen } from "../../data/demoData.js";
import { skusMargen } from "../../data/skusMargen.js";
import { fig } from "../boleta.js";

const _norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
const _money = (v) => { const a = Math.abs(v), s = v < 0 ? "-" : ""; if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(1)}M`; if (a >= 1e3) return `${s}$${Math.round(a / 1e3)}K`; return `${s}$${Math.round(a)}`; };
const _mK = (vK) => _money(vK * 1000);   // las series vienen en MILES de $ (misma escala del dato)
const _pct1 = (v) => `${Math.round(v * 10) / 10}%`;
const _sum = (a) => a.reduce((x, y) => x + y, 0);

// ── PERIODO · parse determinístico del español (la fuerza del piso: meses/trimestres/semestres/rangos) ──
const _MESES_L = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const _MES_IDX = (w) => { const n = _norm(w).replace(/^setiembre$/, "septiembre"); return _MESES_L.indexOf(n); };
const _MES_RE = /\b(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\b/g;
const _ORD = { primer: 0, primera: 0, segundo: 1, segunda: 1, tercer: 2, tercera: 2, cuarto: 3, cuarta: 3 };

export function detectPeriodo(q) {
  const t = _norm(q);
  if (!t) return null;
  // trimestres: "Q1" · "primer trimestre" · "trimestre 2" · "el primer Q"
  let m = t.match(/\bq\s*([1-4])\b/) || t.match(/\btrimestre\s+([1-4])\b/);
  if (m) { const i = Number(m[1]) - 1; return { tipo: "rango", desde: i * 3, hasta: i * 3 + 2, label: `Q${m[1]}` }; }
  m = t.match(/\b(primer|segundo|tercer|cuarto)a?\s+(trimestre|q)\b/);
  if (m) { const i = _ORD[m[1]]; return { tipo: "rango", desde: i * 3, hasta: i * 3 + 2, label: `Q${i + 1}` }; }
  // semestres
  m = t.match(/\b(primer|segundo)a?\s+(semestre|mitad del ano)\b/);
  if (m) { const i = _ORD[m[1]]; return { tipo: "rango", desde: i * 6, hasta: i * 6 + 5, label: i === 0 ? "el primer semestre" : "el segundo semestre" }; }
  // rango con nombres de mes: "de enero a marzo" · "entre abril y junio" · "enero-marzo"
  const meses = [...t.matchAll(_MES_RE)].map((x) => _MES_IDX(x[1])).filter((i) => i >= 0);
  if (meses.length >= 2 && /\b(a|hasta|y)\b|[-–]/.test(t)) {
    const d = Math.min(meses[0], meses[1]), h = Math.max(meses[0], meses[1]);
    return { tipo: "rango", desde: d, hasta: h, label: `${_MESES_L[d]} a ${_MESES_L[h]}` };
  }
  // mes a mes / mensual
  if (/\bmes a mes\b|\bmes por mes\b|\bpor mes(es)?\b|\bmensual(es|izad\w*|mente)?\b|\bcada mes\b/.test(t)) return { tipo: "mes_a_mes" };
  // un mes puntual: "en marzo" · "de marzo" (un solo nombre de mes)
  if (meses.length === 1) return { tipo: "rango", desde: meses[0], hasta: meses[0], label: _MESES_L[meses[0]] };
  // el año a la fecha (el dato del demo cubre el año completo — se declara)
  if (/\blo que va del ano\b|\bytd\b|\bano a la fecha\b|\ben lo que llevamos del ano\b/.test(t)) return { tipo: "rango", desde: 0, hasta: 11, label: "el año del dato (completo)" };
  return null;
}

// nombres del eje (mismas fuentes del contrato · orden por venta del período descendente)
const _EJE_NAMES = {
  cliente: () => clientesMargen.filter((c) => c.tipo === "cliente").map((c) => c.nombre),
  familia: () => sfamiliasMargen.map((f) => f.nombre),
  marca:   () => marcasMargen.map((m) => m.nombre),
  sku:     () => skusMargen.map((s) => s.nombre),
};
const _EJE_LBL = { cliente: "cliente", familia: "familia", marca: "marca", sku: "SKU" };

const _rangoMeses = (meses, p) => (p && p.tipo === "rango" ? meses.slice(p.desde, p.hasta + 1) : meses);
const _rangoSerie = (serie, p) => (p && p.tipo === "rango" ? serie.slice(p.desde, p.hasta + 1) : serie);
const _plabel = (p) => (!p || p.tipo === "mes_a_mes" ? "mes a mes" : p.label);

// ── LÍMITES DECLARADOS (la letra (d) del owner: responder donde el dato alcanza y declarar donde no) ──
export function temporalDeclarado(metric) {
  if (metric === "resultado")
    return { reason: "declarada", texto: "El resultado después de gastos se calcula sobre el año: tus líneas de gasto son porcentajes sobre la venta anual, así que un resultado por mes sería inventar el reparto. Mes a mes sí tengo la venta, la contribución y el margen. ¿Te muestro la venta mes a mes?", sugerencias: ["¿Te muestro la venta mes a mes?"] };
  if (metric === "inventario")
    return { reason: "declarada", texto: "El inventario es la foto de hoy — capital, rotación y cobertura no traen serie mensual. Mes a mes tengo la venta, la contribución y el margen. ¿Te muestro la venta mes a mes?", sugerencias: ["¿Te muestro la venta mes a mes?"] };
  if (metric === "canal")
    return { reason: "declarada", texto: "El mes a mes por canal no está desglosado en el dato. Sí tengo el año completo por canal (ventas y contribución), o el mes a mes por cliente, familia, marca o SKU. ¿Cuál te sirve?", sugerencias: ["Venta mes a mes por cliente"] };
  return null;
}

// ── EL COMPOSER · {metric, dimension?, entity?, periodo} → historia + tabla | null ──
export function composeSpecTemporal({ metric, dimension = null, entity = null, periodo = null } = {}) {
  if (dimension === "canal") return temporalDeclarado("canal");   // el mes a mes por canal no está desglosado en el dato
  const met = metric === "ventas" ? "venta" : metric;   // canon del contrato → canon del historial
  if (!["venta", "contribucion", "margen"].includes(met)) return temporalDeclarado(metric);
  const p = periodo || { tipo: "mes_a_mes" };
  const metLbl = met === "venta" ? "venta" : met === "contribucion" ? "contribución" : "margen";
  const fmt = met === "margen" ? _pct1 : _mK;
  const unit = met === "margen" ? "pct" : "money";
  const bol = [];
  const F = (label, v, extra = {}) => { bol.push(fig(label, fmt(v), { unit, raw: unit === "money" ? v * 1000 : v, source: "computed", context: `${metLbl} ${_plabel(p)}`, ...extra })); return fmt(v); };

  // ── POR EJE (matriz meses × entidades · top 4 + Resto + Total exactos) ──
  if (dimension && _EJE_NAMES[dimension] && !entity) {
    if (met === "margen") return { reason: "declarada", texto: `El margen mes a mes te lo doy por entidad («margen de Falabella mes a mes») o del negocio — la matriz completa por ${_EJE_LBL[dimension]} mezclaría porcentajes que no se suman. ¿Te muestro la venta mes a mes por ${_EJE_LBL[dimension]}?`, sugerencias: [`Venta mes a mes por ${_EJE_LBL[dimension]}`] };
    const names = _EJE_NAMES[dimension]();
    const series = [];
    for (const nm of names) {
      const e = buildEntityEvolutionComparado(nm, met);
      if (e) series.push({ nombre: nm, serie: e.serie, meses: e.meses });
    }
    if (!series.length) return null;
    // D1 (auditoría 2026-07-28 "la matriz por eje y la curva del negocio son DOS SERIES DISTINTAS" — medido: un mes
    // podía diferir ~1000 sobre ~6000, aunque el AÑO cuadraba exacto): reconcilia el MES A MES de cada fila contra la
    // curva REAL del negocio (ventasMensuales), preservando el total anual de CADA entidad (el mismo que ya citaba el
    // Total). Solo "venta" tiene esa curva externa propia; degrada honesto (sin tocar) si los universos no cuadran.
    if (met === "venta") {
      const rec = reconcileMonthly(series.map((s) => s.serie), buildGlobalEvolution().actual);
      series.forEach((s, i) => { s.serie = rec[i]; });
    }
    const meses = _rangoMeses(series[0].meses, p);
    const conSuma = series.map((s) => ({ ...s, rango: _rangoSerie(s.serie, p), total: _sum(_rangoSerie(s.serie, p)) })).sort((a, b) => b.total - a.total);
    const top = conSuma.slice(0, 4), resto = conSuma.slice(4);
    const totalNeg = conSuma.reduce((a, s) => a + s.total, 0);
    const rows = meses.map((mes, i) => {
      const vals = top.map((s) => fmt(s.rango[i]));
      const rSum = resto.reduce((a, s) => a + s.rango[i], 0);
      if (resto.length) vals.push(fmt(rSum));
      vals.push(fmt(top.reduce((a, s) => a + s.rango[i], 0) + rSum));
      return { label: mes, values: vals };
    });
    // mandatory SOLO lo que el texto afirma (los 3 tops enumerados + el total del negocio) — el 4º y el Resto viven en la tabla
    rows.push({ label: "Total", values: [...top.map((s, ix) => F(`${s.nombre} · ${metLbl} ${_plabel(p)}`, s.total, { mandatory: ix < 3 })), ...(resto.length ? [F(`Resto · ${metLbl}`, totalNeg - _sum(top.map((s) => s.total)))] : []), F(`Negocio · ${metLbl} ${_plabel(p)}`, totalNeg, { mandatory: true })], strong: true });
    const lider = conSuma[0], share = totalNeg ? Math.round((lider.total / totalNeg) * 1000) / 10 : 0;
    bol.push(fig(`${lider.nombre} · participación del período`, `${share}%`, { unit: "pct", raw: share, source: "computed", context: `${metLbl} ${_plabel(p)}` }));
    const opener = [
      `La ${metLbl} de ${p.tipo === "rango" ? _plabel(p) : "todo el año"}, ${_EJE_LBL[dimension]} por ${_EJE_LBL[dimension]} y mes a mes — la historia corta: ${lider.nombre} tracciona el período con ${fmt(lider.total)} (${share}% del total).`,
      `· Total del negocio en el período: ${fmt(totalNeg)}`,
      ...top.slice(0, 3).map((s) => `· ${s.nombre}: ${fmt(s.total)}`),
      `La tabla completa va abajo — y la misma película vive en el evolutivo de Sentrix (Mesa de control).`,
    ].join("\n");
    return {
      opener, suggestions: [`¿Cómo viene el margen de ${lider.nombre}?`], sentrixAction: null,
      evidence: {
        lens: "temporal", followup: false, dimension, entityType: dimension,
        entityList: { entities: top.map((s) => s.nombre), dimension },
        tablaM: { titulo: `${metLbl === "venta" ? "Venta" : "Contribución"} ${_plabel(p)} · por ${_EJE_LBL[dimension]}`, cols: [...top.map((s) => s.nombre), ...(resto.length ? ["Resto"] : []), "Total"], rows, nota: "misma serie del evolutivo de Sentrix · el total cierra exacto con el dato del período" },
        boleta: bol,
      },
    };
  }

  // ── UNA ENTIDAD (serie anclada de la Ficha · vs año anterior solo si el dato lo declara) ──
  if (entity) {
    // resolveEntityName (owner "estas son preguntas simples", hallazgo en vivo 2026-07-29): el plan puede mandar
    // el nombre con otra mayúscula/acento que como lo tipeó el usuario ("falabella") — se resuelve al nombre REAL
    // del dato ANTES de interpolarlo en la prosa/evidencia de abajo, para no narrar/mostrar el nombre crudo mal escrito.
    entity = resolveEntityName(entity);
    const e = buildEntityEvolutionComparado(entity, met);
    if (!e) return null;
    const meses = _rangoMeses(e.meses, p), serie = _rangoSerie(e.serie, p);
    const tot = _sum(serie);
    const ant = e.anterior ? _sum(_rangoSerie(e.anterior.serie, p)) : null;
    const iMax = serie.indexOf(Math.max(...serie)), iMin = serie.indexOf(Math.min(...serie));
    const rows = meses.map((mes, i) => ({ label: mes, values: [fmt(serie[i]), ...(e.anterior ? [fmt(_rangoSerie(e.anterior.serie, p)[i])] : [])] }));
    if (met !== "margen") rows.push({ label: "Total", values: [F(`${entity} · ${metLbl} ${_plabel(p)}`, tot, { mandatory: true }), ...(ant != null ? [F(`${entity} · año anterior (${_plabel(p)})`, ant)] : [])], strong: true });
    const varTxt = ant != null && ant > 0 ? ` — ${tot >= ant ? "sube" : "baja"} ${Math.round(Math.abs((tot - ant) / ant) * 1000) / 10}% contra el mismo período del año anterior (${fmt(ant)})` : "";
    const opener = [
      met === "margen"
        ? `El margen de ${entity}, ${_plabel(p)}: se mueve entre ${F(`${entity} · margen mínimo (${meses[iMin]})`, serie[iMin])} (${meses[iMin]}) y ${F(`${entity} · margen máximo (${meses[iMax]})`, serie[iMax])} (${meses[iMax]}), cerrando el período consistente con su margen anual.`
        : `La ${metLbl} de ${entity} en ${p.tipo === "rango" ? _plabel(p) : "el año, mes a mes"}: ${F(`${entity} · ${metLbl} del período`, tot, { mandatory: true })}${varTxt}.`,
      `· Mejor mes: ${meses[iMax]} (${fmt(serie[iMax])})`,
      `· Mes más bajo: ${meses[iMin]} (${fmt(serie[iMin])})`,
      `La misma curva vive en la Ficha de ${entity} en Sentrix — tabla abajo.`,
    ].join("\n");
    return {
      opener, suggestions: [`¿Cómo está ${entity}?`], sentrixAction: null,
      evidence: {
        lens: "temporal", followup: false, entidad: entity, dimension: dimension || null,
        tablaM: { titulo: `${entity} — ${metLbl} ${_plabel(p)}`, cols: [metLbl === "venta" ? "Este año" : metLbl, ...(e.anterior ? ["Año anterior"] : [])], rows, nota: "misma serie de la Ficha en Sentrix · el año cierra exacto con el dato del período" },
        boleta: bol,
      },
    };
  }

  // ── GLOBAL (la curva real del negocio · ventasMensuales con año anterior y presupuesto) ──
  if (met === "venta") {
    const g = buildGlobalEvolution();
    if (!g || !g.n) return null;
    const meses = _rangoMeses(g.meses, p), serie = _rangoSerie(g.actual, p), sAnt = _rangoSerie(g.anterior, p), sPpto = _rangoSerie(g.presupuesto, p);
    const tot = _sum(serie), totAnt = _sum(sAnt), totPpto = _sum(sPpto);
    const iMax = serie.indexOf(Math.max(...serie)), iMin = serie.indexOf(Math.min(...serie));
    const rows = meses.map((mes, i) => ({ label: mes, values: [fmt(serie[i]), fmt(sAnt[i]), fmt(sPpto[i])] }));
    rows.push({ label: "Total", values: [F(`Venta del período`, tot, { mandatory: true }), F(`Año anterior (${_plabel(p)})`, totAnt), F(`Presupuesto (${_plabel(p)})`, totPpto)], strong: true });
    const dAnt = totAnt ? Math.round(((tot - totAnt) / totAnt) * 1000) / 10 : null;
    const dPpto = totPpto ? Math.round(((tot - totPpto) / totPpto) * 1000) / 10 : null;
    const opener = [
      `Tu venta de ${p.tipo === "rango" ? _plabel(p) : "todo el año, mes a mes"}: ${fmt(tot)}${dAnt != null ? ` — ${dAnt >= 0 ? "+" : ""}${dAnt}% contra el año anterior` : ""}${dPpto != null ? ` y ${dPpto >= 0 ? "+" : ""}${dPpto}% contra el presupuesto` : ""}.`,
      `· Mejor mes: ${meses[iMax]} (${fmt(serie[iMax])})`,
      `· Mes más bajo: ${meses[iMin]} (${fmt(serie[iMin])})`,
      `Es la misma curva del evolutivo de Sentrix — la tabla va abajo.`,
    ].join("\n");
    return {
      opener, suggestions: ["Venta mes a mes por cliente"], sentrixAction: null,
      evidence: {
        lens: "temporal", followup: false, dimension: null,
        tablaM: { titulo: `Venta del negocio — ${_plabel(p)}`, cols: ["Este año", "Año anterior", "Presupuesto"], rows, nota: "la curva real del negocio (misma serie del evolutivo de Sentrix)" },
        boleta: bol,
      },
    };
  }
  // contribución/margen global = Σ / derivado de las series por cliente (misma técnica de la Mesa)
  const names = _EJE_NAMES.cliente();
  let sumV = null, sumC = null, meses0 = null;
  for (const nm of names) {
    const eV = buildEntityEvolutionComparado(nm, "venta"), eC = buildEntityEvolutionComparado(nm, "contribucion");
    if (!eV || !eC) return null;
    if (!sumV) { sumV = eV.serie.slice(); sumC = eC.serie.slice(); meses0 = eV.meses; }
    else { eV.serie.forEach((v, i) => { sumV[i] += v; }); eC.serie.forEach((v, i) => { sumC[i] += v; }); }
  }
  const meses = _rangoMeses(meses0, p);
  const serie = met === "margen" ? _rangoSerie(sumC, p).map((c, i) => Math.round((c / _rangoSerie(sumV, p)[i]) * 1000) / 10) : _rangoSerie(sumC, p);
  const iMax = serie.indexOf(Math.max(...serie)), iMin = serie.indexOf(Math.min(...serie));
  const rows = meses.map((mes, i) => ({ label: mes, values: [fmt(serie[i])] }));
  const tot = met === "margen" ? null : _sum(serie);
  if (tot != null) rows.push({ label: "Total", values: [F(`Contribución del período`, tot, { mandatory: true })], strong: true });
  const opener = [
    met === "margen"
      ? `El margen del negocio, ${_plabel(p)}: se mueve entre ${F(`Margen mínimo (${meses[iMin]})`, serie[iMin])} (${meses[iMin]}) y ${F(`Margen máximo (${meses[iMax]})`, serie[iMax])} (${meses[iMax]}) — contribución sobre venta de cada mes, las mismas series del evolutivo.`
      : `La contribución del negocio en ${p.tipo === "rango" ? _plabel(p) : "el año, mes a mes"}: ${fmt(tot)}.`,
    `· Mejor mes: ${meses[iMax]} (${fmt(serie[iMax])})`,
    `· Mes más bajo: ${meses[iMin]} (${fmt(serie[iMin])})`,
    `Tabla abajo — misma verdad que el evolutivo de Sentrix.`,
  ].join("\n");
  return {
    opener, suggestions: ["Venta mes a mes por cliente"], sentrixAction: null,
    evidence: {
      lens: "temporal", followup: false, dimension: null,
      tablaM: { titulo: `${met === "margen" ? "Margen" : "Contribución"} del negocio — ${_plabel(p)}`, cols: [met === "margen" ? "Margen" : "Contribución"], rows, nota: "derivado de las mismas series por cliente del evolutivo (cierra con el dato del período)" },
      boleta: bol,
    },
  };
}
