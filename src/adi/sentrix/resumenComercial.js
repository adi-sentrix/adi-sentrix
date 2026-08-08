/* === src/adi/sentrix/resumenComercial.js · RESUMEN COMERCIAL (owner 2026-08-07) ======================
 * LA TESIS: Resumen comercial DETECTA → la Ficha EXPLICA → Sentrix DEMUESTRA.
 * Esta pestaña deja de ser un cuadro de datos y pasa a ser la señal global que te lleva a la entidad donde vale
 * la pena profundizar.
 *
 * ALCANCE SIEMPRE GLOBAL. Se construye desde `buildCuadroMando("cliente", scenario)` — el negocio completo — sin
 * recibir ninguna selección. Una entidad previamente elegida NO puede teñir esta vista: acá no entra.
 *
 * CERO CÁLCULO PARALELO. Todo sale de lo que el motor ya autoriza:
 *   · el 80/20            → `concentracion()` (economicDiagnosis.js), la MISMA que usa el diagnóstico
 *   · la brecha material  → `POLICY.margenBrechaMaterial`, la MISMA vara del detector y del semáforo del cuadro
 *   · la meta de carga    → `POLICY.targetCarga`
 *   · la referencia       → `varaRef` de cada fila (benchmarkOf ya resuelto por el cuadro)
 *   · el dinero en juego  → `enJuego` de cada fila (ya conciliado con la Ficha y con ADI)
 * Este módulo ORDENA y RECONCILIA; no inventa una segunda aritmética. Si una cifra no está autorizada, se declara
 * la limitación en vez de rellenarla.
 *
 * UNIVERSOS QUE NUNCA SE CONFUNDEN, Y QUE SIEMPRE RECONCILIAN (owner 2026-08-07):
 *   · GRUPO 80%        el mínimo de clientes cuya venta acumulada alcanza el 80%. Es el plano de decisión.
 *   · EN TENSIÓN       los del grupo 80% con brecha MATERIAL (≥ POLICY.margenBrechaMaterial pp bajo su vara).
 *                      NO es "todos los que están bajo benchmark": una diferencia chica no es material.
 *   · CARTERA MATERIAL el MISMO criterio de materialidad sobre TODO el negocio — el universo de la alerta de
 *                      margen de la Mesa. En tensión + cola material = cartera material, exacto.
 * Los clientes de la cola NO entran al diagnóstico inicial — aparecen al expandir la cartera completa.
 * REGLA DURA (owner 2026-08-07, tras ver la vista con la tira legacy al lado): dos montos parecidos de universos
 * distintos NUNCA pueden aparecer juntos sin decir de cuál sale cada uno. Por eso `tension.reconcilia` y
 * `puente.universo` se arman ACÁ, ya formateados y nombrando su universo — la vista no improvisa esa frase.
 *
 * PROPORCIONALIDAD SEMÁNTICA (el contrato que rige a ADI, aplicado a la UI): el veredicto localiza la tensión,
 * nunca afirma la causa. "X concentran $N de brecha" es una localización comprobada; "X están debilitando el
 * margen" sería una atribución causal que el dato no sostiene. La referencia se narra "tu benchmark", nunca
 * sectorial. Costo, precio y mix quedan como rutas ABIERTAS mientras el motor no los aísle.
 */
import { buildCuadroMando } from "./cuadro.js";
import { concentracion } from "../diagnosis/economicDiagnosis.js";
import { POLICY } from "../../config/businessPolicy.js";
import { getTenantData } from "../../data/tenantStore.js";   // multiempresa: la variación sale del tenant activo, nunca del dataset demo
import { buildGlobalEvolution, anchorSerie } from "./temporal.js";   // el año mes a mes (3 series REALES) + el anclaje a la venta oficial

const _M = (raw) => (typeof raw === "number" ? `$${(raw / 1e6).toFixed(1)}M` : "—");
const _K = (raw) => (typeof raw === "number" ? (Math.abs(raw) >= 1e6 ? `$${(raw / 1e6).toFixed(1)}M` : `$${Math.round(raw / 1000)}K`) : "—");
const _pct = (v, d = 1) => (typeof v === "number" ? `${v.toFixed(d)}%` : "—");
const _pp = (v) => (typeof v === "number" ? `${Math.abs(v).toFixed(1)} pp` : "—");

// ── EL PLANO DE DECISIÓN ───────────────────────────────────────────────────────────────────────────────────────
// X e Y SIEMPRE dinámicos: nunca "7 de 13". El umbral es el 80% fijado por el owner; todo lo demás sale del dato.
function _plano(rows) {
  const conc = concentracion(rows.map((r) => ({ nombre: r.name, valor: r.ventas })));
  const nombres = new Set(conc.entidades.map((e) => e.nombre));
  const grupo = rows.filter((r) => nombres.has(r.name));
  const cola = rows.filter((r) => !nombres.has(r.name));
  const ventasGrupo = grupo.reduce((s, r) => s + (r.ventas || 0), 0);
  const ventasCola = cola.reduce((s, r) => s + (r.ventas || 0), 0);
  return {
    grupo, cola, conc,
    n: grupo.length, pct: conc.totalCubiertoPct,
    colaN: cola.length, colaPct: +(100 - conc.totalCubiertoPct).toFixed(1),
    ventasGrupo, ventasCola, ventasTotal: ventasGrupo + ventasCola,
    frase: `Las conclusiones iniciales se construyen sobre los ${grupo.length} clientes que explican el ${conc.totalCubiertoPct}% de las ventas. Son quienes mueven la aguja del negocio.`,
    colaFrase: cola.length ? `Los otros ${cola.length} quedan disponibles al expandir.` : "No hay cola: todos los clientes entran en el plano.",
  };
}

// ── CUENTAS EN TENSIÓN · LOS DOS UNIVERSOS, RECONCILIADOS ──────────────────────────────────────────────────────
// Brecha MATERIAL, no "bajo benchmark". La vara es la misma del detector (POLICY.margenBrechaMaterial), así que
// esta cuenta no puede divergir del semáforo del cuadro, de la tira de alerta de la Mesa ni de lo que ADI diga.
//
// EL MISMO CRITERIO SE APLICA A DOS UNIVERSOS Y LOS DOS SE DECLARAN (owner 2026-08-07, tras ver la vista):
//   · CARTERA COMPLETA  todas las cuentas del negocio con brecha material — el universo de la alerta de margen.
//   · GRUPO 80%         las de ese conjunto que además están dentro del plano de decisión.
// El resto vive en la cola. Las tres cifras cierran: plano + cola = cartera. Y como las dos primeras se parecen
// ($4.7M vs $4.9M en el set demo), la regla dura es que NUNCA pueden aparecer juntas sin decir de qué universo es
// cada una: por eso la frase de reconciliación se arma acá, formateada, y no se improvisa en la vista.
function _enTension(plano, rows) {
  const material = (xs) => xs.filter((r) => typeof r.varaGap === "number" && r.varaGap <= -POLICY.margenBrechaMaterial);
  const suma = (xs) => xs.reduce((s, r) => s + (r.enJuego || 0), 0);
  const enPlano = material(plano.grupo);
  const enCartera = material(rows);
  const dentro = new Set(enPlano.map((r) => r.name));
  const enCola = enCartera.filter((r) => !dentro.has(r.name));
  const tPlano = suma(enPlano), tCartera = suma(enCartera), tCola = suma(enCola);
  // CUÁNTO DE LA OPORTUNIDAD MATERIAL VIVE DENTRO DEL PLANO — dinámico, nunca un porcentaje clavado.
  const concentraPct = tCartera > 0 ? +((tPlano / tCartera) * 100).toFixed(1) : null;
  const _cuentas = (n) => `${n} ${n === 1 ? "cuenta" : "cuentas"}`;
  const cartera = {
    lista: enCartera, n: enCartera.length, enJuego: tCartera, enJuegoFmt: _M(tCartera),
    colaLista: enCola, colaN: enCola.length, colaEnJuego: tCola, colaEnJuegoFmt: _K(tCola),
  };
  // LA RECONCILIACIÓN · los dos universos nombrados y el puente entre ellos, en una sola frase.
  let reconcilia;
  if (!enCartera.length) {
    reconcilia = `Ninguna cuenta de la cartera tiene brecha material (${POLICY.margenBrechaMaterial} pp o más bajo su referencia), ni dentro ni fuera del plano de decisión.`;
  } else if (!enPlano.length) {
    reconcilia = `En toda la cartera hay ${_cuentas(enCartera.length)} con brecha material por ${_M(tCartera)}, pero ninguna está dentro del plano de decisión: la oportunidad vive entera en la cola.`;
  } else if (!enCola.length) {
    reconcilia = `Toda la cartera tiene ${_cuentas(enCartera.length)} con brecha material por ${_M(tCartera)}, y ${enCartera.length === 1 ? "esa cuenta está" : "todas están"} dentro del plano de decisión: el ${_pct(100)} de esa oportunidad ya está en foco.`;
  } else {
    reconcilia = `En toda la cartera hay ${_cuentas(enCartera.length)} con brecha material por ${_M(tCartera)}. Las ${enPlano.length} que están dentro del plano de decisión concentran el ${_pct(concentraPct)} de esa oportunidad; ${_cuentas(enCola.length)} ${enCola.length === 1 ? "queda" : "quedan"} en la cola por ${_K(tCola)}.`;
  }
  return { lista: enPlano, n: enPlano.length, enJuego: tPlano, enJuegoFmt: _M(tPlano), cartera, concentraPct, concentraPctFmt: _pct(concentraPct), reconcilia };
}

// ── EL VEREDICTO · jerarquía de tres pasos (owner 2026-08-07) ──────────────────────────────────────────────────
// 1. señal clara y autorizada → veredicto determinístico que LOCALIZA la tensión
// 2. sin señal → lectura neutral con ventas, variación, margen y brecha
// 3. NUNCA una afirmación causal cuando solo se sabe DÓNDE se concentra la brecha
// El bloque nunca queda vacío y la conclusión nunca se fuerza.
function _veredicto({ total, plano, tension, variacionPct }) {
  const brecha = typeof total.margen === "number" && typeof total._vara === "number" ? total._vara - total.margen : null;
  const crece = typeof variacionPct === "number" && variacionPct > 0;
  const margenCorto = typeof brecha === "number" && brecha > 0;
  const lecturaBase = [
    typeof total.ventas === "number" ? `Vendiste ${_M(total.ventas * 1000)}` : null,
    typeof variacionPct === "number" ? `${variacionPct >= 0 ? "+" : ""}${variacionPct.toFixed(1)}% contra el año anterior` : null,
    typeof total.margen === "number" ? `margen de ${_pct(total.margen)}` : null,
    margenCorto ? `${_pp(brecha)} bajo tu benchmark de ${_pct(total._vara)}` : null,
  ].filter(Boolean).join(" · ");

  // SEÑAL CLARA: crece el volumen Y el margen queda corto Y hay cuentas con brecha material adentro del plano.
  if (crece && margenCorto && tension.n > 0) {
    return {
      tipo: "senal",
      titular: "El volumen crece, pero el margen no acompaña.",
      // LOCALIZA, no atribuye: dice DÓNDE está la brecha, no que esas cuentas sean su causa.
      soporte: `Dentro de los ${plano.n} clientes que explican el ${plano.pct}% de las ventas, ${tension.n} concentran una brecha material de ${_M(tension.enJuego)}.`,
      lectura: lecturaBase,
    };
  }
  if (margenCorto && tension.n > 0) {
    return {
      tipo: "senal",
      titular: "El margen está bajo tu referencia.",
      soporte: `Dentro de los ${plano.n} clientes que explican el ${plano.pct}% de las ventas, ${tension.n} concentran una brecha material de ${_M(tension.enJuego)}.`,
      lectura: lecturaBase,
    };
  }
  // NEUTRAL: sin señal suficiente no se fuerza ninguna conclusión — se lee el dato y se declara el alcance.
  return {
    tipo: "neutral",
    titular: margenCorto ? "El margen está bajo tu referencia." : "El negocio opera en línea con tu referencia.",
    soporte: tension.n === 0
      ? `Ningún cliente del grupo que explica el ${plano.pct}% de las ventas tiene una brecha material (${POLICY.margenBrechaMaterial} pp o más bajo su referencia).`
      : `Se localizaron ${tension.n} cuentas con brecha material dentro del plano de decisión.`,
    lectura: lecturaBase,
  };
}

// ── EL PARETO · barras acotadas, línea acumulada REAL ──────────────────────────────────────────────────────────
// TOPE (owner 2026-08-07): desktop 12 barras (10 entidades + resto de cabeza + cola) · móvil 8 (6 + resto + cola).
// La línea acumulada y el punto del 80% se calculan con TODAS las entidades reales, aunque se agrupen visualmente:
// agrupar es una decisión de dibujo, nunca de aritmética.
export function buildPareto(plano, metrica = "ventas", { maxEntidades = 10 } = {}) {
  const val = (r) => (metrica === "contribucion" ? r.contribucion : r.ventas) || 0;
  const todos = [...plano.grupo, ...plano.cola].sort((a, b) => val(b) - val(a));
  const total = todos.reduce((s, r) => s + val(r), 0) || 1;
  // línea acumulada REAL, entidad por entidad
  let acc = 0;
  const real = todos.map((r) => { acc += val(r); return { nombre: r.name, valor: val(r), acumuladoPct: +((acc / total) * 100).toFixed(1) }; });
  const cruce = real.findIndex((x) => x.acumuladoPct >= 80);
  const nombresGrupo = new Set(plano.grupo.map((r) => r.name));
  const cabeza = real.filter((x) => nombresGrupo.has(x.nombre));
  const cola = real.filter((x) => !nombresGrupo.has(x.nombre));

  const barras = [];
  const individuales = cabeza.slice(0, maxEntidades);
  for (const x of individuales) barras.push({ tipo: "entidad", nombre: x.nombre, valor: x.valor, fmt: _M(x.valor * 1000), acumuladoPct: x.acumuladoPct });
  const restoCabeza = cabeza.slice(maxEntidades);
  if (restoCabeza.length) {
    const v = restoCabeza.reduce((s, x) => s + x.valor, 0);
    barras.push({ tipo: "resto-cabeza", nombre: `Resto de la cabeza (${restoCabeza.length})`, valor: v, fmt: _M(v * 1000), acumuladoPct: restoCabeza[restoCabeza.length - 1].acumuladoPct, n: restoCabeza.length });
  }
  if (cola.length) {
    const v = cola.reduce((s, x) => s + x.valor, 0);
    barras.push({ tipo: "cola", nombre: `Cola (${cola.length})`, valor: v, fmt: _M(v * 1000), acumuladoPct: 100, n: cola.length });
  }
  return {
    metrica, barras, total,
    entidadesReales: real.length,
    cruce80: cruce >= 0 ? real[cruce].nombre : null,
    agrupadas: restoCabeza.length,
    nota: `Las barras muestran ${metrica === "contribucion" ? "contribución" : "venta"} por cliente y la línea el porcentaje acumulado.${cruce >= 0 ? ` El umbral del 80% se alcanza en ${real[cruce].nombre}.` : ""}`,
  };
}

// ── EL PUENTE DE OPORTUNIDAD ───────────────────────────────────────────────────────────────────────────────────
// Brecha total → parte PROBADA → parte INDICADA → parte ABIERTA. Nunca se atribuye toda la brecha a la carga
// comercial: lo comprobado es solo el exceso sobre la meta, y el resto queda declarado como pendiente de aislar.
// Costo, precio y mix NO se presentan como causas comprobadas — el motor no los aisló, así que son rutas abiertas.
function _puente(rows, plano, tension) {
  const brechaTotal = rows.reduce((s, r) => s + (r.enJuego || 0), 0);
  const conExceso = rows.filter((r) => typeof r.carga === "number" && r.carga > POLICY.targetCarga);
  const probado = conExceso.reduce((s, r) => s + ((r.carga - POLICY.targetCarga) / 100) * (r.ventas || 0) * 1000, 0);
  const abierto = Math.max(0, brechaTotal - probado);
  return {
    brechaTotal, brechaTotalFmt: _M(brechaTotal),
    // EL UNIVERSO DEL TOTAL, DECLARADO: son TODAS las cuentas con contribución en juego — las de brecha material y
    // las que no llegan a serlo. Por eso este número es distinto (y mayor) que el de las cuentas materiales de la
    // cartera: dos cifras parecidas que solo se pueden leer bien si cada una dice de qué universo sale.
    universo: `Toda la cartera: las ${rows.length} cuentas del negocio, sumando las de brecha material y las que no llegan a serlo.`,
    materialFmt: tension.cartera.enJuegoFmt, materialN: tension.cartera.n,
    probado, probadoFmt: _K(probado),
    abierto, abiertoFmt: _M(abierto),
    tramos: [
      { estatus: "probado", monto: _K(probado), titulo: "Acciones comerciales sobre la meta",
        detalle: `${conExceso.length} ${conExceso.length === 1 ? "cliente opera" : "clientes operan"} con carga comercial sobre tu meta de ${_pct(POLICY.targetCarga)}. Es la única parte de la brecha con una causa comprobada y cuantificada.` },
      { estatus: "indicado", monto: tension.n ? tension.enJuegoFmt : "—", titulo: "Dónde se concentra la brecha",
        detalle: tension.n
          ? `${tension.n} de los ${plano.n} clientes del plano concentran ${tension.enJuegoFmt} — el ${tension.concentraPctFmt} de los ${tension.cartera.enJuegoFmt} que suman las ${tension.cartera.n} cuentas con brecha material de toda la cartera. Es una localización comprobada, no una causa: falta aislar qué la produce en cada cuenta.`
          : "Ninguna cuenta del plano supera la brecha material; no hay concentración que señalar." },
      { estatus: "abierto", monto: _M(abierto), titulo: "Pendiente de aislar",
        detalle: "El resto debe separarse entre costo de producto, precio y composición de la venta. El motor todavía no aisló ninguno de los tres, así que son rutas de investigación abiertas — no causas." },
    ],
  };
}

// ── INSIGHTS QUE MUEVEN LA AGUJA ───────────────────────────────────────────────────────────────────────────────
// SOLO sobre el grupo 80%. Cada insight declara entidad, posición por ventas, posición por margen, venta, margen,
// brecha, contribución en juego y el estatus de la causa. La prioridad combina materialidad + deterioro +
// evidencia disponible + existencia de una acción concreta.
function _insights(plano, rows) {
  const porVenta = [...rows].sort((a, b) => (b.ventas || 0) - (a.ventas || 0)).map((r) => r.name);
  const porMargen = [...rows].filter((r) => typeof r.margen === "number").sort((a, b) => a.margen - b.margen).map((r) => r.name);
  const out = plano.grupo
    .filter((r) => (r.enJuego || 0) > 0)
    .map((r) => {
      const excesoPP = typeof r.carga === "number" ? r.carga - POLICY.targetCarga : null;
      const tieneAccion = typeof excesoPP === "number" && excesoPP > 0;
      const probado = tieneAccion ? (excesoPP / 100) * (r.ventas || 0) * 1000 : 0;
      const material = typeof r.varaGap === "number" && r.varaGap <= -POLICY.margenBrechaMaterial;
      return {
        entidad: r.name,
        posVenta: porVenta.indexOf(r.name) + 1,
        posMargen: porMargen.indexOf(r.name) + 1,
        ventaFmt: _M((r.ventas || 0) * 1000),
        margenFmt: _pct(r.margen),
        varaFmt: _pct(r.varaRef),
        brechaFmt: _pp(r.varaGap),
        enJuego: r.enJuego || 0,
        enJuegoFmt: _M(r.enJuego || 0),
        probado, probadoFmt: tieneAccion ? _K(probado) : null,
        estatusCausa: tieneAccion ? "probado" : "abierto",
        // POR QUÉ vale la pena profundizar — localiza, nunca atribuye.
        razon: tieneAccion
          ? `Parte de la brecha ya está comprobada: opera ${_pp(excesoPP)} sobre tu meta de acciones comerciales, que equivalen a ${_K(probado)}. El resto necesita aislarse en la Ficha.`
          : `El monto es material, pero la causa todavía no está aislada: hay que separar costo, precio y composición de la venta.`,
        titulo: material ? `${_pp(r.varaGap)} bajo tu referencia` : `Brecha de ${_pp(r.varaGap)}`,
        // PRIORIDAD: materialidad (en juego) + deterioro (brecha) + evidencia (¿hay causa probada?) + acción.
        _score: (r.enJuego || 0) * (1 + (material ? 0.5 : 0)) * (tieneAccion ? 1.35 : 1),
      };
    })
    .sort((a, b) => b._score - a._score);
  return out;
}

// ── LA VENTA OFICIAL DEL NEGOCIO ───────────────────────────────────────────────────────────────────────────────
// El ACTUAL sale del total del cuadro — que ya es la suma de `clientesVentas` CON el escenario aplicado. El
// ANTERIOR sale del tenant, que es estado base: los escenarios modelan cómo pudo ir ESTE año (`actual = anterior ×
// (1+growth)`) y nunca reescriben el año pasado, así que la cifra cruda es la correcta en los tres escenarios.
//
// DEFECTO CORREGIDO ACÁ (2026-08-07): esto leía `actual` del tenant CRUDO, ajeno al escenario. En bonanza la
// diferencia era de 0.1% y pasaba desapercibida; en crisis el KPI habría dicho "+7.6% vs año anterior" mientras la
// venta cae un 12.7%. Ahora la variación, el KPI y el evolutivo salen todos del MISMO total.
// Si el tenant no trae `anterior`, la variación queda null: el veredicto cae a su rama neutral y el KPI declara
// que no está autorizada, en vez de rellenarla con un cero.
function _ventasOficiales(total) {
  const rows = getTenantData()?.clientesVentas;
  let ant = 0;
  if (Array.isArray(rows)) for (const r of rows) if (typeof r.anterior === "number") ant += r.anterior;
  return { actual: (total && total.ventas) || null, anterior: ant || null };
}
function _variacionAnual(of = _ventasOficiales()) {
  if (!of || !of.anterior || !of.actual) return null;
  return +(((of.actual - of.anterior) / of.anterior) * 100).toFixed(1);
}

// ── EL AÑO, MES A MES · TRES SERIES QUE RECONCILIAN ────────────────────────────────────────────────────────────
// El owner lo pidió de vuelta y con sus tres líneas: este año, año anterior y presupuesto. La forma del año sale
// de `buildGlobalEvolution()` (dato real, la MISMA serie de "La Historia" y del chat).
//
// EL PROBLEMA QUE ESTO CIERRA: la serie mensual vive en `ventasMensuales` y la venta del negocio en
// `clientesVentas` — dos tablas del dataset que difieren ~0.1% ($100.0M vs $99.9M). Poner el KPI en $99.9M y el
// gráfico en $100.0M al lado es exactamente el defecto que hace decir "los números no cuadran". Así que las dos
// series con contraparte oficial (este año, año anterior) se ANCLAN a ella con `anchorSerie`: se reescala la curva
// y el residuo cae en el último mes — el total queda EXACTO y la forma del año (picos, valles, caídas) intacta.
// El PRESUPUESTO no se ancla: es un plan declarado, no tiene contraparte por cliente. Se dice, no se disimula.
function _evolutivo(oficial) {
  let ev = null;
  try { ev = buildGlobalEvolution(); } catch { return null; }
  if (!ev || !ev.n || !Array.isArray(ev.actual)) return null;
  const actual = oficial && oficial.actual ? anchorSerie(ev.actual, oficial.actual) : ev.actual;
  const anterior = oficial && oficial.anterior ? anchorSerie(ev.anterior, oficial.anterior) : ev.anterior;
  const presupuesto = ev.presupuesto;
  const suma = (s) => (Array.isArray(s) ? s.reduce((a, v) => a + (Number(v) || 0), 0) : 0);
  const tAct = suma(actual), tAnt = suma(anterior), tPpto = suma(presupuesto);
  const vsAnt = tAnt ? +(((tAct - tAnt) / tAnt) * 100).toFixed(1) : null;
  const vsPpto = tPpto ? +(((tAct - tPpto) / tPpto) * 100).toFixed(1) : null;
  const iMax = actual.indexOf(Math.max(...actual)), iMin = actual.indexOf(Math.min(...actual));
  // la mayor caída mes a mes del año en foco — describe el movimiento, nunca su causa
  let caida = null;
  for (let i = 1; i < actual.length; i++) {
    const d = actual[i] - actual[i - 1];
    if (!caida || d < caida.delta) caida = { delta: d, mes: ev.meses[i], desde: ev.meses[i - 1] };
  }
  const _sig = (v) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
  return {
    meses: ev.meses,
    series: [
      { key: "actual", label: "Este año", valores: actual, total: tAct, totalFmt: _M(tAct * 1000), estatus: "probado", anclada: !!(oficial && oficial.actual),
        nota: "Venta real del período, anclada al total oficial por cliente." },
      { key: "anterior", label: "Año anterior", valores: anterior, total: tAnt, totalFmt: _M(tAnt * 1000), estatus: "probado", anclada: !!(oficial && oficial.anterior),
        nota: "Venta del año anterior, anclada al mismo total oficial." },
      { key: "presupuesto", label: "Presupuesto", valores: presupuesto, total: tPpto, totalFmt: _M(tPpto * 1000), estatus: "indicado", anclada: false,
        nota: "El plan que declaraste. No se ancla: no existe presupuesto por cliente contra el cual conciliarlo." },
    ],
    totalActual: tAct, totalActualFmt: _M(tAct * 1000),
    vsAnteriorPct: vsAnt, vsAnteriorFmt: typeof vsAnt === "number" ? _sig(vsAnt) : "—",
    vsPresupuestoPct: vsPpto, vsPresupuestoFmt: typeof vsPpto === "number" ? _sig(vsPpto) : "—",
    maxMes: ev.meses[iMax], maxFmt: _M(actual[iMax] * 1000),
    minMes: ev.meses[iMin], minFmt: _M(actual[iMin] * 1000),
    caida: caida && caida.delta < 0 ? { ...caida, fmt: _K(Math.abs(caida.delta) * 1000) } : null,
    // LECTURA: describe el movimiento del año con cifras autorizadas. No dice por qué — eso es el bloque 02.
    lectura: [
      `El año cierra en ${_M(tAct * 1000)}`,
      typeof vsAnt === "number" ? `${_sig(vsAnt)} contra el anterior` : null,
      typeof vsPpto === "number" ? `${_sig(vsPpto)} contra tu presupuesto` : null,
    ].filter(Boolean).join(" · ") + `. El mes más alto fue ${ev.meses[iMax]} (${_M(actual[iMax] * 1000)}) y el más bajo ${ev.meses[iMin]} (${_M(actual[iMin] * 1000)}).`,
    nota: `Las tres series son dato real del período. Este año y el anterior están anclados al total oficial de venta por cliente, así que el gráfico cierra exacto con el KPI de arriba; el presupuesto es el plan que declaraste y no se ancla.`,
  };
}

// ── LA COMPOSICIÓN DEL NEGOCIO, CLIENTE POR CLIENTE ────────────────────────────────────────────────────────────
// El gemelo GLOBAL de la "Composición de la compra" de la Ficha (owner 2026-08-07): misma tabla, mismas columnas
// donde el dato las sostiene, mismo pie honesto. Donde la Ficha muestra ROTACIÓN, acá va ACCIONES COMERCIALES: la
// rotación es del inventario, no del cliente — prometerla sería el primer dato inventado de la vista.
// TRES VISTAS declaradas (decisión del owner): Grupo 80% · Menor margen (los 5 con mayor brecha contra tu
// benchmark, estén o no en el plano) · Todos. La cola del 80/20 se lee comparando la primera con la última.
const MENOR_MARGEN_N = 5;
function _composicion(plano, rows, total) {
  const totalVentas = rows.reduce((s, r) => s + (r.ventas || 0), 0) || 1;
  const enPlano = new Set(plano.grupo.map((r) => r.name));
  const fila = (r) => ({
    nombre: r.name,
    participacionPct: +(((r.ventas || 0) / totalVentas) * 100).toFixed(1),
    participacionFmt: _pct(((r.ventas || 0) / totalVentas) * 100),
    ventaFmt: _M((r.ventas || 0) * 1000),
    contribucionFmt: _K((r.contribucion || 0) * 1000),
    margen: typeof r.margen === "number" ? r.margen : null, margenFmt: _pct(r.margen),
    varaRef: typeof r.varaRef === "number" ? r.varaRef : null, varaRefFmt: _pct(r.varaRef),
    varaGap: typeof r.varaGap === "number" ? r.varaGap : null, brechaFmt: _pp(r.varaGap),
    bajoBenchmark: typeof r.varaGap === "number" && r.varaGap < 0,
    material: typeof r.varaGap === "number" && r.varaGap <= -POLICY.margenBrechaMaterial,
    unidades: typeof r.unidades === "number" ? r.unidades : null,
    unidadesFmt: typeof r.unidades === "number" ? r.unidades.toLocaleString("es-CL") : "—",
    // ACCIONES COMERCIALES · el % de su venta que se entrega en rebates y descuentos (dato medido por cuenta)
    carga: typeof r.carga === "number" ? r.carga : null, cargaFmt: _pct(r.carga),
    sobreMeta: typeof r.carga === "number" && r.carga > POLICY.targetCarga,
    enPlano: enPlano.has(r.name),
  });
  const porVenta = (a, b) => (b.ventas || 0) - (a.ventas || 0);
  const conMargen = rows.filter((r) => typeof r.varaGap === "number");
  const menor = [...conMargen].sort((a, b) => a.varaGap - b.varaGap).slice(0, MENOR_MARGEN_N);
  const menorDentro = menor.filter((r) => enPlano.has(r.name)).length;
  const vistas = [
    { key: "grupo80", label: "Grupo 80%", filas: [...plano.grupo].sort(porVenta).map(fila), n: plano.n,
      nota: `Los ${plano.n} clientes que explican el ${plano.pct}% de las ventas — el plano de decisión.` },
    { key: "menorMargen", label: "Menor margen", filas: menor.map(fila), n: menor.length,
      nota: menor.length
        ? `Los ${menor.length} clientes con mayor brecha contra tu benchmark de ${_pct(menor[0].varaRef)}, estén o no en el grupo 80%: ${menorDentro} ${menorDentro === 1 ? "está" : "están"} dentro del plano y ${menor.length - menorDentro} ${menor.length - menorDentro === 1 ? "queda" : "quedan"} fuera.`
        : "Ninguna cuenta declara margen en este período." },
    { key: "todos", label: "Todos", filas: [...rows].sort(porVenta).map(fila), n: rows.length,
      nota: `La cartera completa: ${rows.length} clientes. Comparala con el Grupo 80% y tenés la cola.` },
  ];
  return {
    vistas, porDefecto: "grupo80", totalVentasFmt: _M(totalVentas * 1000),
    columnas: [
      { key: "nombre", label: "Cliente", align: "left" },
      { key: "participacion", label: "Participación", align: "right" },
      { key: "venta", label: "Venta", align: "right" },
      { key: "contribucion", label: "Contribución", align: "right" },
      { key: "margen", label: "Margen", align: "right" },
      { key: "unidades", label: "Unidades", align: "right" },
      { key: "acciones", label: "Acciones comerciales", align: "right" },
    ],
    nota: `Participación = peso de cada cliente en la venta del negocio; la vista Todos cubre la cartera entera (las filas suman el ${_pct(100)} salvo el redondeo de cada una a un decimal). Margen en ámbar = bajo tu benchmark de ${_pct(total._vara)}. Acciones comerciales = rebates y descuentos como % de la venta de esa cuenta; en ámbar lo que supera tu meta de ${_pct(POLICY.targetCarga)}. El monto recuperable no se repite acá: vive en el bloque de qué hacer primero.`,
  };
}

// ── CÓMO SE FORMA EL MARGEN · la identidad, con el estatus de cada línea ───────────────────────────────────────
// venta − costo conciliado − acciones comerciales = contribución. Cierra EXACTO por construcción, y ese es
// justamente el punto epistémico: el COSTO no está medido, se obtiene por diferencia. Declararlo "conciliado" e
// "indicado" es lo que sostiene que la vista nunca diga "revisar costo" como si fuera una causa probada.
function _formacion(total) {
  const venta = total.ventas || 0, contrib = total.contribucion || 0, acciones = total.acciones || 0;
  const costo = venta - contrib - acciones;
  const p = (v) => (venta ? _pct((v / venta) * 100) : "—");
  return {
    identidad: "Venta − Costo conciliado − Acciones comerciales = Contribución",
    cierra: Math.abs(venta - costo - acciones - contrib) < 0.5,
    lineas: [
      { key: "venta", signo: "", label: "Venta", montoFmt: _M(venta * 1000), pctFmt: p(venta), estatus: "probado",
        nota: "Dato directo: la venta oficial por cliente del período, la misma de todos los bloques de arriba." },
      { key: "costo", signo: "−", label: "Costo conciliado", montoFmt: _M(costo * 1000), pctFmt: p(costo), estatus: "indicado",
        nota: "No está medido: se obtiene por diferencia entre la venta, las acciones comerciales y la contribución. Por eso el costo nunca se afirma como causa de la brecha — hay que ir a aislarlo." },
      { key: "acciones", signo: "−", label: "Acciones comerciales", montoFmt: _M(acciones * 1000), pctFmt: p(acciones), estatus: "probado",
        nota: `Medido cuenta por cuenta: rebates y descuentos. Tu meta es ${_pct(POLICY.targetCarga)} de la venta.` },
      { key: "contribucion", signo: "=", label: "Contribución", montoFmt: _M(contrib * 1000), pctFmt: p(contrib), estatus: "probado",
        nota: "Lo que queda después del costo y de las acciones comerciales. Es el margen del negocio." },
    ],
    lectura: `De cada ${_pct(100)} que vendés, ${p(costo)} se va en costo, ${p(acciones)} en acciones comerciales y ${p(contrib)} queda como contribución.`,
  };
}

// ── LA VISTA COMPLETA ──────────────────────────────────────────────────────────────────────────────────────────
export function buildResumenComercial(scenario = "actual", { maxEntidades = 10 } = {}) {
  const cuadro = buildCuadroMando("cliente", scenario);
  const rows = (cuadro.rows || []).filter((r) => r && !r._total && !r._ref);
  if (!rows.length) return null;
  const total = { ...(cuadro.total || {}), _vara: rows.find((r) => typeof r.varaRef === "number")?.varaRef ?? null };
  const plano = _plano(rows);
  const tension = _enTension(plano, rows);
  // VARIACIÓN ANUAL DEL NEGOCIO · de la MISMA fuente que la venta por cliente (`clientesVentas`, una sola verdad
  // — ver la regla de venta oficial por cliente). Si el tenant no declara `anterior`, queda null y el veredicto lo
  // dice en vez de inventar un crecimiento. Esa misma fuente ancla el evolutivo: una sola venta oficial.
  const oficial = _ventasOficiales(total);
  const variacionPct = _variacionAnual(oficial);
  const veredicto = _veredicto({ total, plano, tension, variacionPct });
  const puente = _puente(rows, plano, tension);
  const insights = _insights(plano, rows);
  return {
    alcance: "negocio",
    scenario,
    cuadro,                       // la tabla completa sigue disponible como evidencia opcional
    rows,
    total,
    plano,
    tension,
    veredicto,
    evolutivo: _evolutivo(oficial),        // 01 · el año mes a mes, tres series, ancladas a la venta oficial
    composicion: _composicion(plano, rows, total),   // 01 · el gemelo global de la composición de la Ficha
    formacion: _formacion(total),          // 02 · venta − costo conciliado − acciones = contribución
    puente,
    insights,
    primera: insights[0] || null,
    pareto: {
      ventas: buildPareto(plano, "ventas", { maxEntidades }),
      contribucion: buildPareto(plano, "contribucion", { maxEntidades }),
    },
    kpis: [
      { key: "ventas", label: "Ventas · año cerrado", valor: _M((total.ventas || 0) * 1000), pie: typeof variacionPct === "number" ? `${variacionPct >= 0 ? "+" : ""}${variacionPct.toFixed(1)}% vs año anterior` : "variación no autorizada en este período", tono: typeof variacionPct === "number" && variacionPct >= 0 ? "ok" : "neutro" },
      { key: "contribucion", label: "Contribución", valor: _M((total.contribucion || 0) * 1000), pie: typeof total.margen === "number" ? `${_pct(total.margen)} de la venta` : "—", tono: "neutro" },
      { key: "margen", label: "Margen promedio", valor: _pct(total.margen), pie: typeof total._vara === "number" ? `${_pp(total._vara - total.margen)} bajo tu benchmark` : "sin referencia declarada", tono: typeof total._vara === "number" && total.margen < total._vara ? "alerta" : "ok" },
      { key: "acciones", label: "Acciones comerciales", valor: _M((total.acciones || 0) * 1000), pie: `${puente.probadoFmt} sobre tu meta de ${_pct(POLICY.targetCarga)}`, tono: puente.probado > 0 ? "aviso" : "ok" },
    ],
  };
}
