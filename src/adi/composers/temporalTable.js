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
import { buildGlobalEvolution, buildGlobalEvolutionAnclada, buildEntityEvolutionComparado, resolveEntityName, reconcileMonthly } from "../sentrix/temporal.js";
import { getTenantData } from "../../data/tenantStore.js";
import { factorComercialDe } from "../../config/contract/figureType.js";
// escala DECLARADA del pack (barrido A·maquinaria 2026-08-30) — con el demo («K») es la identidad de siempre
const _fxm = () => factorComercialDe(getTenantData());
import { clientesMargen, marcasMargen, sfamiliasMargen } from "../../data/demoData.js";
import { skusMargen } from "../../data/skusMargen.js";
import { fig } from "../boleta.js";
import { simboloMoneda } from "../../config/moneda.js";

const _norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
const _money = (v) => { const a = Math.abs(v), s = v < 0 ? "-" : ""; if (a >= 1e6) return `${s}${simboloMoneda()}${(a / 1e6).toFixed(1)}M`; if (a >= 1e3) return `${s}${simboloMoneda()}${Math.round(a / 1e3)}K`; return `${s}${simboloMoneda()}${Math.round(a)}`; };
const _mK = (v) => _money(v * _fxm());   // las series vienen en la ESCALA DECLARADA del dato
const _pct1 = (v) => `${Math.round(v * 10) / 10}%`;
const _sum = (a) => a.reduce((x, y) => x + y, 0);
// dv(actual, base) → "+X.X%"/"-X.X%" — variación porcentual entre 2 valores REALES de la serie (nunca inventada,
// mismo redondeo/formato ya usado inline para dAnt/dPpto arriba en este mismo archivo). null si no hay base
// (evita división por 0 — "s/d" en vez de un % falso).
const dv = (actual, base) => { if (!base) return null; const d = Math.round(((actual - base) / base) * 1000) / 10; return `${d >= 0 ? "+" : ""}${d}%`; };

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
// `scenario` (owner 2026-08-09, decisión 4 · hallazgo C): la rama GLOBAL leía `buildGlobalEvolution()` pelado —
// serie cruda de `ventasMensuales`, ajena al escenario y sin anclar a la venta oficial por cliente. Ahora entra por
// `buildGlobalEvolutionAnclada`, la MISMA función que ancla el evolutivo de Sentrix.
export function composeSpecTemporal({ metric, dimension = null, entity = null, periodo = null, scenario = "actual" } = {}) {
  if (dimension === "canal") return temporalDeclarado("canal");   // el mes a mes por canal no está desglosado en el dato
  const met = metric === "ventas" ? "venta" : metric;   // canon del contrato → canon del historial
  if (!["venta", "contribucion", "margen"].includes(met)) return temporalDeclarado(metric);
  const p = periodo || { tipo: "mes_a_mes" };
  const metLbl = met === "venta" ? "venta" : met === "contribucion" ? "contribución" : "margen";
  const fmt = met === "margen" ? _pct1 : _mK;
  const unit = met === "margen" ? "pct" : "money";
  const bol = [];
  const F = (label, v, extra = {}) => { bol.push(fig(label, fmt(v), { unit, raw: unit === "money" ? v * _fxm() : v, source: "computed", context: `${metLbl} ${_plabel(p)}`, ...extra })); return fmt(v); };

  /* ── COBERTURA DE LA SERIE · SE DECLARA, NO SE SUPONE (owner 2026-08-11, defecto 4 de la certificación) ────────
   * EL CASO MEDIDO: la boleta de E3.t2 llegó con SIETE meses (Ene, Mar, Abr, May, Jun, Ago, Nov) y un total de
   * "$23.9M · Contribución del período" sellado `computed` / `derivada_no_reconciliada`, con su propia razón
   * escrita en el dato: «no es una lectura del dato, es un supuesto del motor». ADI lo narró como hecho pelado:
   * «La contribución del negocio alcanza $23.9M». Los siete meses visibles suman $13.9M.
   * La causa NO es que el total esté mal —la serie interna sí tiene los 12 meses—: es que a la boleta sólo entran
   * los meses que el texto cita (F() se invoca para el máximo y el mínimo), así que aguas abajo el narrador y el
   * muro ven un subconjunto y un total que no cierra con él, sin nada que diga que es un subconjunto.
   * ESTO LO DICE. Cinco campos, todos verificables, ninguno opinable:
   *   mesesDisponibles / mesesFaltantes · cobertura observada vs esperada · procedencia del total ·
   *   si las filas reconcilian con él · y qué CLASE de total es.
   * Un total `estimado` conserva su sello hasta la respuesta: es la diferencia entre «el negocio contribuyó $23.9M»
   * y «la serie disponible suma $13.9M sobre 7 de 12 meses». */
  const _declararCobertura = (mesesTodos, serieTodos, total, mesesEnBoleta) => {
    const todos = Array.isArray(mesesTodos) ? mesesTodos : [];
    const enBoleta = new Set(mesesEnBoleta || []);
    const faltantes = todos.filter((m) => !enBoleta.has(m));
    const sumaVisible = (serieTodos || []).reduce((s, v, i) => (enBoleta.has(todos[i]) && typeof v === "number" ? s + v : s), 0);
    const reconcilia = total != null && Math.abs(sumaVisible - total) <= Math.max(1, Math.abs(total) * 0.005);
    // TRES CLASES, y la del medio es la que evita la falsa alarma: un total ANUAL legítimo puede convivir con una
    // serie parcial sin que ninguno de los dos esté mal — lo prohibido es fingir que las filas lo suman.
    const clase = total == null ? null
      : (!faltantes.length ? "observado" : (reconcilia ? "observado" : "agregado_independiente"));
    return {
      mesesDisponibles: todos.filter((m) => enBoleta.has(m)),
      mesesFaltantes: faltantes,
      coberturaObservada: enBoleta.size, coberturaEsperada: todos.length,
      sumaFilasVisibles: sumaVisible, total, reconcilia,
      procedenciaTotal: clase,
      // la frase que el narrador puede citar y el muro puede exigir: una sola redacción, nunca improvisada.
      leyenda: total == null ? null
        : (!faltantes.length
          ? `la serie cubre los ${todos.length} meses y sus filas suman el total`
          : `la serie disponible cubre ${enBoleta.size} de ${todos.length} meses (faltan ${faltantes.join(", ")}); el total es del período completo y NO es la suma de las filas visibles`),
    };
  };
  const _figCobertura = (cob) => {
    if (!cob || cob.total == null || !cob.mesesFaltantes.length) return;
    bol.push(fig("Cobertura de la serie", `${cob.coberturaObservada} de ${cob.coberturaEsperada} meses`,
      { unit: "count", raw: cob.coberturaObservada, mandatory: true, source: "actual",
        context: `${metLbl} ${_plabel(p)} · ${cob.leyenda}` }));
  };

  // ── POR EJE (matriz meses × entidades · top 4 + Resto + Total exactos) ──
  if (dimension && _EJE_NAMES[dimension] && !entity) {
    if (met === "margen") {
      // El ejemplo entre comillas sale del EJE que se está pidiendo; antes decía «Falabella», fijo. Es texto que
      // el usuario ve y puede copiar tal cual: nombrarle una entidad ajena lo manda derecho a una consulta vacía.
      const _ej = (_EJE_NAMES[dimension]() || [])[0];
      const _comoPedirlo = _ej ? ` («margen de ${_ej} mes a mes»)` : "";
      return { reason: "declarada", texto: `El margen mes a mes te lo doy por entidad${_comoPedirlo} o del negocio — la matriz completa por ${_EJE_LBL[dimension]} mezclaría porcentajes que no se suman. ¿Te muestro la venta mes a mes por ${_EJE_LBL[dimension]}?`, sugerencias: [`Venta mes a mes por ${_EJE_LBL[dimension]}`] };
    }
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
    const serieAnt = e.anterior ? _rangoSerie(e.anterior.serie, p) : null;
    const tot = _sum(serie);
    const ant = serieAnt ? _sum(serieAnt) : null;
    const iMax = serie.indexOf(Math.max(...serie)), iMin = serie.indexOf(Math.min(...serie));
    const rows = meses.map((mes, i) => ({ label: mes, values: [fmt(serie[i]), ...(e.anterior ? [fmt(_rangoSerie(e.anterior.serie, p)[i])] : [])] }));
    if (met !== "margen") rows.push({ label: "Total", values: [F(`${entity} · ${metLbl} ${_plabel(p)}`, tot, { mandatory: true }), ...(ant != null ? [F(`${entity} · año anterior (${_plabel(p)})`, ant)] : [])], strong: true });
    const varTxt = ant != null && ant > 0 ? ` — ${tot >= ant ? "sube" : "baja"} ${Math.round(Math.abs((tot - ant) / ant) * 1000) / 10}% contra el mismo período del año anterior (${fmt(ant)})` : "";
    // mejorMes/peorMes + variacionMensual estructurados (owner 2026-08-06, mismo patrón que la rama GLOBAL de
    // arriba — "perfil/avance/estado de X" pide meses altos/bajos CON su % citable). Antes solo vivían en el
    // opener/boleta como prosa+figs sueltos; narratePromptC ya instruye "usá facts.mejorMes/peorMes" pero esa
    // forma solo existía para GLOBAL. Solo "venta" declara serie año-anterior por entidad (ver
    // buildEntityEvolutionComparado) — margen/contribución quedan con vsAnioAnterior:null, honesto, nunca inventado.
    const variacionMensual = serieAnt ? meses.map((mes, i) => ({ label: mes, vsAnioAnterior: serieAnt[i] ? dv(serie[i], serieAnt[i]) : null })) : null;
    // variacionAnual (owner 2026-08-07, Ficha Ejecutiva real, KPI "variación"): el % del período YA se calculaba
    // para el opener (varTxt, prosa) pero no vivía estructurado — dv() es la MISMA función que ya arma
    // variacionMensual/mejorMes/peorMes, cero cálculo nuevo, solo expone lo que ya existía.
    const variacionAnual = ant != null ? { actual: fmt(tot), anterior: fmt(ant), pct: dv(tot, ant) } : null;
    const mejorMes = { label: meses[iMax], valor: fmt(serie[iMax]), vsAnioAnterior: serieAnt && serieAnt[iMax] ? dv(serie[iMax], serieAnt[iMax]) : null };
    const peorMes = { label: meses[iMin], valor: fmt(serie[iMin]), vsAnioAnterior: serieAnt && serieAnt[iMin] ? dv(serie[iMin], serieAnt[iMin]) : null };
    const opener = [
      met === "margen"
        ? `El margen de ${entity}, ${_plabel(p)}: se mueve entre ${F(`${entity} · margen mínimo (${meses[iMin]})`, serie[iMin])} (${meses[iMin]}) y ${F(`${entity} · margen máximo (${meses[iMax]})`, serie[iMax])} (${meses[iMax]}), cerrando el período consistente con su margen anual.`
        : `La ${metLbl} de ${entity} en ${p.tipo === "rango" ? _plabel(p) : "el año, mes a mes"}: ${F(`${entity} · ${metLbl} del período`, tot, { mandatory: true })}${varTxt}.`,
      `· Mejor mes: ${meses[iMax]} (${fmt(serie[iMax])})`,
      `· Mes más bajo: ${meses[iMin]} (${fmt(serie[iMin])})`,
      `La misma curva vive en el Perfil Ejecutivo de ${entity} en Sentrix — tabla abajo.`,
    ].join("\n");
    return {
      opener, suggestions: [`¿Cómo está ${entity}?`], sentrixAction: null,
      evidence: {
        lens: "temporal", followup: false, entidad: entity, dimension: dimension || null,
        tablaM: { titulo: `${entity} — ${metLbl} ${_plabel(p)}`, cols: [metLbl === "venta" ? "Este año" : metLbl, ...(e.anterior ? ["Año anterior"] : [])], rows, nota: "misma serie del Perfil Ejecutivo en Sentrix · el año cierra exacto con el dato del período" },
        ...(variacionMensual ? { variacionMensual } : {}),
        ...(variacionAnual ? { variacionAnual } : {}),
        mejorMes, peorMes,
        boleta: bol,
      },
    };
  }

  // ── GLOBAL (la curva real del negocio · ventasMensuales con año anterior y presupuesto) ──
  if (met === "venta") {
    const g = buildGlobalEvolutionAnclada(scenario);
    if (!g || !g.n) return null;
    const meses = _rangoMeses(g.meses, p), serie = _rangoSerie(g.actual, p), sAnt = _rangoSerie(g.anterior, p), sPpto = _rangoSerie(g.presupuesto, p);
    const tot = _sum(serie), totAnt = _sum(sAnt), totPpto = _sum(sPpto);
    const iMax = serie.indexOf(Math.max(...serie)), iMin = serie.indexOf(Math.min(...serie));
    const rows = meses.map((mes, i) => ({ label: mes, values: [fmt(serie[i]), fmt(sAnt[i]), fmt(sPpto[i])] }));
    rows.push({ label: "Total", values: [F(`Venta del período`, tot, { mandatory: true }), F(`Año anterior (${_plabel(p)})`, totAnt), F(`Presupuesto (${_plabel(p)})`, totPpto)], strong: true });
    const dAnt = totAnt ? Math.round(((tot - totAnt) / totAnt) * 1000) / 10 : null;
    const dPpto = totPpto ? Math.round(((tot - totPpto) / totPpto) * 1000) / 10 : null;
    // VARIACIÓN POR MES (owner 2026-08-05, hallazgo en vivo: "le falta el % cuanto ha variado, eso es lo que
    // debería explicar ADI"): la tabla YA trae el $ de cada mes, pero ningún % de variación mes-a-mes-vs-año-
    // anterior/presupuesto existía en ningún lado — el narrador no podía citarlo (guardC lo hubiera bloqueado
    // como "cifra-no-autorizada": %  es una DIVISIÓN, no una resta/suma permitida sobre 2 cifras autorizadas) ni
    // aunque quisiera. Se computa acá (el motor, no el LLM) y se autoriza vía enrichFromFacts (ledger.js) — mismo
    // mecanismo que ya autoriza los $ de `tablaM.rows` y `comparacion.vs_anio_anterior/vs_presupuesto` (ver
    // toolRegistry.js trend()) — el campo `label` en cada entrada la ata a un mes real (mismo criterio "label" que
    // _ENTITY_KEYS de ledger.js ya reconoce), así que nunca puede citarse sin decir DE QUÉ mes es. mejorMes/
    // peorMes quedan aparte, ya resueltos por el motor (el narrador no debe re-derivar "cuál es el mayor/menor",
    // ver SUPERLATIVOS CONSISTENTES) — con su % de variación ya calculado, listo para citar.
    const variacionMensual = meses.map((mes, i) => ({
      label: mes,
      vsAnioAnterior: sAnt[i] ? `${dv(serie[i], sAnt[i])}` : null,
      vsPresupuesto: sPpto[i] ? `${dv(serie[i], sPpto[i])}` : null,
    }));
    const mejorMes = { label: meses[iMax], valor: fmt(serie[iMax]), vsAnioAnterior: sAnt[iMax] ? dv(serie[iMax], sAnt[iMax]) : null, vsPresupuesto: sPpto[iMax] ? dv(serie[iMax], sPpto[iMax]) : null };
    const peorMes = { label: meses[iMin], valor: fmt(serie[iMin]), vsAnioAnterior: sAnt[iMin] ? dv(serie[iMin], sAnt[iMin]) : null, vsPresupuesto: sPpto[iMin] ? dv(serie[iMin], sPpto[iMin]) : null };
    const opener = [
      `Tu venta de ${p.tipo === "rango" ? _plabel(p) : "todo el año, mes a mes"}: ${fmt(tot)}${dAnt != null ? ` — ${dAnt >= 0 ? "+" : ""}${dAnt}% contra el año anterior` : ""}${dPpto != null ? ` y ${dPpto >= 0 ? "+" : ""}${dPpto}% contra el presupuesto` : ""}.`,
      `· Mejor mes: ${meses[iMax]} (${fmt(serie[iMax])}, ${mejorMes.vsAnioAnterior || "s/d"} vs año anterior)`,
      `· Mes más bajo: ${meses[iMin]} (${fmt(serie[iMin])}, ${peorMes.vsAnioAnterior || "s/d"} vs año anterior)`,
      `Es la misma curva del evolutivo de Sentrix — la tabla va abajo.`,
    ].join("\n");
    return {
      opener, suggestions: ["Venta mes a mes por cliente"], sentrixAction: null,
      evidence: {
        lens: "temporal", followup: false, dimension: null,
        tablaM: { titulo: `Venta del negocio — ${_plabel(p)}`, cols: ["Este año", "Año anterior", "Presupuesto"], rows, nota: "la curva real del negocio (misma serie del evolutivo de Sentrix)" },
        variacionMensual, mejorMes, peorMes,
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
  // la cobertura se calcula sobre los meses que EFECTIVAMENTE quedaron como fig en la boleta, no sobre los que la
  // serie interna conoce: lo que el narrador y el muro pueden ver aguas abajo es la boleta, no la serie.
  // LA COBERTURA SE MIDE SOBRE LAS FILAS QUE EL COMPOSER PRODUJO, no sobre `bol`: los meses entran a la boleta
  // AGUAS ABAJO (el toolRunner los deriva de `tablaM.rows`), así que consultarla acá daba 0 de 12 y declaraba una
  // laguna que no existe. Medirse contra `rows` es medirse contra lo que este composer realmente afirma.
  const _cobG = _declararCobertura(meses, serie, tot, rows.filter((r) => r.label !== "Total").map((r) => r.label));
  _figCobertura(_cobG);
  return {
    opener, suggestions: ["Venta mes a mes por cliente"], sentrixAction: null,
    evidence: {
      lens: "temporal", followup: false, dimension: null,
      tablaM: { titulo: `${met === "margen" ? "Margen" : "Contribución"} del negocio — ${_plabel(p)}`, cols: [met === "margen" ? "Margen" : "Contribución"], rows, nota: "derivado de las mismas series por cliente del evolutivo (cierra con el dato del período)" },
      cobertura: _cobG,
      boleta: bol,
    },
  };
}
