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
import { POLICY, benchmarkOf } from "../../config/businessPolicy.js";
import { applyScenarioToSfamiliasMargen, applyScenarioToClientesVentas } from "../../engine/scenarios.js";   // el corte por familia y la venta/presupuesto por cliente, con el escenario aplicado
import { getTenantData } from "../../data/tenantStore.js";   // multiempresa: la variación y el canal salen del tenant activo, nunca del dataset demo
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
  // LA RECONCILIACIÓN COMPACTA (owner 2026-08-07 · "una sola lectura de alcance") — la versión de una línea que
  // va bajo el veredicto. Sigue NOMBRANDO los dos universos: esa regla no se negocia por brevedad.
  const reconciliaCorta = !enCartera.length
    ? `Ninguna cuenta de la cartera llega a brecha material (${POLICY.margenBrechaMaterial} pp).`
    : !enPlano.length
      ? `Cartera completa: ${_cuentas(enCartera.length)} por ${_M(tCartera)}, todas fuera del plano.`
      : !enCola.length
        ? `Cartera completa: ${_cuentas(enCartera.length)} por ${_M(tCartera)} — todas dentro del plano.`
        : `Cartera completa: ${_cuentas(enCartera.length)} por ${_M(tCartera)} · el plano concentra el ${_pct(concentraPct)} y ${_cuentas(enCola.length)} ${enCola.length === 1 ? "queda" : "quedan"} en la cola por ${_K(tCola)}.`;
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
  return { lista: enPlano, n: enPlano.length, enJuego: tPlano, enJuegoFmt: _M(tPlano), cartera, concentraPct, concentraPctFmt: _pct(concentraPct), reconcilia, reconciliaCorta };
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

  // EL ALCANCE, UNA SOLA VEZ (owner 2026-08-07: "hoy el universo 80/20 se explica varias veces"). Esta frase es
  // LA declaración del plano de decisión de toda la vista: reemplaza a la banda "Plano de decisión" y a la banda
  // "Alcance" que vivían aparte. Sigue LOCALIZANDO, nunca atribuyendo: dice dónde está la brecha, no que esas
  // cuentas la produzcan.
  const alcance = tension.n > 0
    ? `${plano.n} clientes explican el ${plano.pct}% de las ventas. Dentro de ellos, ${tension.n} concentran ${tension.enJuegoFmt} de la brecha material.`
    : `${plano.n} clientes explican el ${plano.pct}% de las ventas. Ninguno tiene una brecha material (${POLICY.margenBrechaMaterial} pp o más bajo su referencia).`;

  // SEÑAL CLARA: crece el volumen Y el margen queda corto Y hay cuentas con brecha material adentro del plano.
  if (crece && margenCorto && tension.n > 0) {
    return { tipo: "senal", titular: "El volumen crece, pero el margen no acompaña.", soporte: alcance, lectura: lecturaBase };
  }
  if (margenCorto && tension.n > 0) {
    return { tipo: "senal", titular: "El margen está bajo tu referencia.", soporte: alcance, lectura: lecturaBase };
  }
  // NEUTRAL: sin señal suficiente no se fuerza ninguna conclusión — se lee el dato y se declara el alcance.
  return {
    tipo: "neutral",
    titular: margenCorto ? "El margen está bajo tu referencia." : "El negocio opera en línea con tu referencia.",
    soporte: alcance,
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
    // ⚠️ PARTICIÓN vs LOCALIZACIÓN — la distinción que evita una suma imposible (hallazgo 2026-08-07):
    // PROBADO + ABIERTO = el total, y eso SÍ es una partición del dinero. El INDICADO es EL MISMO dinero mirado
    // desde otro ángulo: dice en QUÉ CUENTAS está, no qué porción es. Pintarlos como tres filas iguales bajo un
    // total invita a sumar los tres, y no suman. Por eso cada tramo declara `esParte`: la vista pinta la
    // partición como partición y la localización aparte.
    tramos: [
      { estatus: "probado", esParte: true, monto: _K(probado), titulo: "Acciones comerciales sobre la meta",
        detalle: `${conExceso.length} ${conExceso.length === 1 ? "cliente opera" : "clientes operan"} con carga comercial sobre tu meta de ${_pct(POLICY.targetCarga)}. Es la única parte de la brecha con una causa medida y cuantificada.` },
      { estatus: "abierto", esParte: true, monto: _M(abierto), titulo: "Pendiente de aislar",
        detalle: "El resto debe separarse entre costo de producto, precio y composición de la venta. El motor todavía no aisló ninguno de los tres, así que son rutas de investigación abiertas — no causas." },
      { estatus: "indicado", esParte: false, monto: tension.n ? tension.enJuegoFmt : "—", titulo: "Dónde se concentra la brecha",
        detalle: tension.n
          ? `${tension.n} de los ${plano.n} clientes del plano concentran ${tension.enJuegoFmt} — el ${tension.concentraPctFmt} de los ${tension.cartera.enJuegoFmt} que suman las ${tension.cartera.n} cuentas con brecha material de toda la cartera. Es una localización comprobada, no una causa ni una tercera porción: es el MISMO dinero de arriba, visto por cuenta.`
          : "Ninguna cuenta del plano supera la brecha material; no hay concentración que señalar." },
    ],
    particionNota: `La brecha se parte en dos: lo que tiene causa medida (${_K(probado)}) y lo que falta aislar (${_M(abierto)}). Suman el total. La concentración por cuenta no es una tercera parte — es ese mismo dinero, ubicado.`,
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
        // FILA DE DECISIÓN (owner 2026-08-07): la acción concreta y qué falta, cada una en una línea corta — la
        // tarjeta larga se lee como informe; esto se lee como una decisión.
        accionCorta: tieneAccion
          ? `Revisar acciones comerciales: opera ${_pp(excesoPP)} sobre tu meta.`
          : `Abrir la Ficha y aislar la causa cuenta por cuenta.`,
        faltaCorta: tieneAccion
          ? `Falta separar costo, precio y composición del resto.`
          : `Falta separar costo, precio y composición: nada está aislado todavía.`,
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
    cumplimientoPct: tPpto ? +((tAct / tPpto) * 100).toFixed(1) : null,
    cumplimientoFmt: tPpto ? _pct((tAct / tPpto) * 100) : "—",
    // LECTURA EJECUTIVA · una sola: cierre del período, variación interanual, cumplimiento presupuestario y los
    // meses que importan. Describe el movimiento con cifras autorizadas; no dice POR QUÉ — eso es el bloque 02.
    lectura: [
      `El año cierra en ${_M(tAct * 1000)}`,
      typeof vsAnt === "number" ? `${_sig(vsAnt)} contra el anterior` : null,
      tPpto ? `${_pct((tAct / tPpto) * 100)} del presupuesto (${_sig(vsPpto)})` : null,
    ].filter(Boolean).join(" · ") + `. El mes más alto fue ${ev.meses[iMax]} (${_M(actual[iMax] * 1000)}) y el más bajo ${ev.meses[iMin]} (${_M(actual[iMin] * 1000)})${caida && caida.delta < 0 ? `; la mayor caída del año fue de ${caida.desde} a ${caida.mes} (${_K(Math.abs(caida.delta) * 1000)})` : ""}.`,
    nota: `Las tres series son dato real del período. Este año y el anterior están anclados al total oficial de venta por cliente, así que el gráfico cierra exacto con el KPI de arriba; el presupuesto es el plan que declaraste y no se ancla.`,
  };
}

/* ── QUIÉN SOSTIENE EL NEGOCIO · el 80% que mueve la aguja, por cuatro perspectivas ────────────────────────────
 * Owner 2026-08-07: "una sola sección basada en el 80% que mueve la aguja, con dos vistas — Clientes y Familias".
 * Se conservan además SKU y Canales en el MISMO selector: son el mismo tipo de corte y no duplican pantalla.
 * Cada eje trae su propio grupo 80% (calculado con `concentracion()`, no un top-N fijo) y la cartera entera detrás
 * de un switch. Y cada eje DECLARA su fuente y si cierra con la venta oficial: hay cortes que concilian al centavo
 * y otros que son otra tabla del dato, y eso se dice en vez de disimularlo — los márgenes nunca se reescalan para
 * forzar el cuadre, porque son justo la cifra que se viene a mirar.
 *
 * ⚠️ NO HAY "puntos de venta": las sucursales del tenant existen solo con INVENTARIO (`skuInventario.bodega`),
 * sin venta ni contribución. El eje real con venta y margen es el CANAL, y ese sí se ofrece.
 */
function _sostiene(scenario, rows, total) {
  const tV = total.ventas || 0, tC = total.contribucion || 0;
  const fila = (nombre, venta, contribucion, acciones, base) => {
    const margen = venta ? +((contribucion / venta) * 100).toFixed(1) : null;
    const vara = benchmarkOf(base || null);
    const brecha = typeof margen === "number" && typeof vara === "number" ? +(margen - vara).toFixed(1) : null;
    const carga = typeof acciones === "number" && venta ? +((acciones / venta) * 100).toFixed(1) : null;
    return {
      nombre, venta, contribucion,
      ventaFmt: _M(venta * 1000), contribucionFmt: _K(contribucion * 1000),
      margen, margenFmt: _pct(margen), vara, varaFmt: _pct(vara),
      brecha, brechaFmt: typeof brecha === "number" ? `${brecha >= 0 ? "+" : "−"}${Math.abs(brecha).toFixed(1)} pp` : "—",
      bajoBenchmark: typeof brecha === "number" && brecha < 0,
      material: typeof brecha === "number" && brecha <= -POLICY.margenBrechaMaterial,
      carga, cargaFmt: _pct(carga), sobreMeta: typeof carga === "number" && carga > POLICY.targetCarga,
    };
  };
  // el 80% de CADA eje sale del mismo motor de concentración que el resto de la vista
  const armar = (key, label, singular, filas, fuente) => {
    if (!filas.length) return null;
    const v = filas.reduce((s, f) => s + f.venta, 0), c = filas.reduce((s, f) => s + f.contribucion, 0);
    for (const f of filas) { f.pesoPct = v ? +((f.venta / v) * 100).toFixed(1) : 0; f.pesoFmt = _pct(v ? (f.venta / v) * 100 : 0); }
    filas.sort((a, b) => b.venta - a.venta);
    const conc = concentracion(filas.map((f) => ({ nombre: f.nombre, valor: f.venta })));
    const enGrupo = new Set(conc.entidades.map((e) => e.nombre));
    for (const f of filas) f.enGrupo = enGrupo.has(f.nombre);
    const grupo = filas.filter((f) => f.enGrupo);
    const dv = tV ? Math.abs(v - tV) / tV : 0, dc = tC ? Math.abs(c - tC) / tC : 0;
    const reconcilia = dv < 0.001 && dc < 0.001;
    // LECTURA · localiza dónde se sostiene y dónde se diluye, nunca atribuye la causa
    // ⚠️ La lectura NO repite "X clientes explican el Y%": eso ya lo dijo el veredicto, una sola vez (regla del
    // owner: no repetir cifras ni conceptos). Acá se aporta lo único que este bloque puede aportar — dónde, dentro
    // del grupo que sostiene, se diluye el margen.
    const mat = grupo.filter((f) => f.material);
    const _plural = (n, s) => `${n} ${s}${n > 1 && !/SKU/.test(s) ? "s" : ""}`;
    const lectura = mat.length
      ? `De ${_plural(grupo.length, singular)} que sostienen la venta, ${mat.map((f) => f.nombre).join(", ")} ${mat.length > 1 ? "quedan" : "queda"} ${mat.map((f) => f.brechaFmt).join(" / ")} bajo tu benchmark de ${_pct(mat[0].vara)}: ahí se sostiene el volumen y ahí se diluye el margen.`
      : `${_plural(grupo.length, singular)} sostienen la venta, y ning${singular === "familia" ? "una" : "o"} de ese grupo cede ${POLICY.margenBrechaMaterial} pp o más contra tu benchmark.`;
    return {
      key, label, filas, n: filas.length,
      grupoN: grupo.length, grupoPct: conc.totalCubiertoPct, grupoPctFmt: _pct(conc.totalCubiertoPct),
      colaN: filas.length - grupo.length,
      totalVenta: v, totalVentaFmt: _M(v * 1000), totalContribFmt: _K(c * 1000), reconcilia, lectura,
      notaFuente: reconcilia
        ? `${fuente} Cierra exacto con la venta oficial del negocio (${_M(tV * 1000)}).`
        : `${fuente} Este corte suma ${_M(v * 1000)} de venta y ${_K(c * 1000)} de contribución, contra ${_M(tV * 1000)} y ${_K(tC * 1000)} de la venta oficial por cliente (${_pct(dv * 100)} y ${_pct(dc * 100)} de diferencia): son dos cortes del mismo negocio que el dataset no concilia al centavo. Los márgenes son los del dato, sin reescalar — reescalarlos para cuadrar movería justo la cifra que venís a mirar. El peso en venta es sobre el total de esta tabla.`,
    };
  };

  const vistas = [];
  // CLIENTES · las mismas filas del cuadro (la venta oficial) → cierra por construcción
  const vCli = armar("cliente", "Clientes", "cliente",
    rows.map((r) => fila(r.name, r.ventas || 0, r.contribucion || 0, r.acciones, r)),
    "Los clientes del período, con la venta oficial por cliente.");
  if (vCli) vistas.push(vCli);
  // FAMILIAS · tabla propia del dataset, con el escenario aplicado
  try {
    const fam = applyScenarioToSfamiliasMargen(scenario) || [];
    const v = armar("familia", "Familias", "familia",
      fam.map((f) => fila(f.nombre, f.venta || 0, f.contribucion || 0, f.rebates, f)),
      "Tabla de familias del período, con el escenario aplicado.");
    if (v) vistas.push(v);
  } catch { /* sin familias → la vista no se ofrece */ }
  // SKU · tabla propia del dataset
  try {
    const sk = getTenantData()?.skusMargen || [];
    const v = armar("sku", "SKU", "SKU",
      sk.map((x) => fila(x.nombre, x.venta || 0, x.contribucion || 0, x.rebates, x)),
      "Tabla de SKU del período — la misma que alimenta el cuadro por SKU.");
    if (v) vistas.push(v);
  } catch { /* sin SKU → la vista no se ofrece */ }
  // CANALES · los mismos clientes agrupados → cierra exacto por construcción
  try {
    const cv = getTenantData()?.clientesVentas || [];
    const canalDe = new Map(cv.map((c) => [c.nombre, c.canal]).filter(([, k]) => !!k));
    if (canalDe.size) {
      const g = new Map();
      for (const r of rows) {
        const k = canalDe.get(r.name); if (!k) continue;
        const x = g.get(k) || { venta: 0, contribucion: 0, acciones: 0 };
        x.venta += r.ventas || 0; x.contribucion += r.contribucion || 0; x.acciones += r.acciones || 0;
        g.set(k, x);
      }
      const v = armar("canal", "Canales", "canal",
        [...g].map(([k, x]) => fila(k, x.venta, x.contribucion, x.acciones, null)),
        "Los mismos clientes, agrupados por el canal que declara tu dato.");
      if (v) vistas.push(v);
    }
  } catch { /* sin canal → la vista no se ofrece */ }
  if (!vistas.length) return null;
  return {
    vistas, porDefecto: "cliente",
    columnas: [
      { key: "nombre", label: "Concepto", align: "left" },
      { key: "peso", label: "Participación", align: "right" },
      { key: "venta", label: "Venta", align: "right" },
      { key: "contribucion", label: "Contribución", align: "right" },
      { key: "margen", label: "Margen", align: "right" },
      { key: "brecha", label: "Brecha", align: "right" },
      { key: "acciones", label: "Acciones comerciales", align: "right" },
    ],
    nota: `Participación = peso de cada fila en la venta de ESTE corte. Margen en ámbar = bajo tu benchmark; la brecha en ámbar es la que llega a ${POLICY.margenBrechaMaterial} pp o más. Acciones comerciales = rebates y descuentos como % de esa venta; en ámbar lo que supera tu meta de ${_pct(POLICY.targetCarga)}. El monto en juego no se repite acá: vive en el bloque de qué hacer primero.`,
    limitacion: "Por punto de venta no hay corte posible: las sucursales del dato traen inventario, no venta ni contribución. Se enciende con el ERP; inventarlo sería peor que no ofrecerlo.",
  };
}


/* ── DÓNDE SE FRENA LA VENTA Y DÓNDE SE DILUYE EL MARGEN ───────────────────────────────────────────────────────
 * Owner 2026-08-07: «"pérdida de ingresos" solo puede afirmarse si existe una referencia autorizada». Acá están
 * las dos referencias que el dato SÍ sostiene, y cada una autoriza cosas distintas:
 *
 *   · PRESUPUESTO      existe por CLIENTE (`clientesVentas.presupuesto`, suma exacto el presupuesto del KPI) y
 *                      NO por familia ni por marca. Da el monto que faltó, pero NO permite descomponer precio y
 *                      volumen: el presupuesto declara plata, no unidades.
 *   · AÑO ANTERIOR     existe por cliente Y por familia, CON unidades (`unidadesAnt`) → acá sí se puede separar
 *                      cuánto del retroceso es volumen y cuánto es precio, y la descomposición cierra exacta.
 *
 * Por eso la vista declara contra qué mide y solo ofrece precio/volumen donde el dato lo sostiene. Nada de esto
 * afirma una causa: decir que una cuenta vendió menos unidades es aritmética; decir por qué, no.
 */
function _deterioro(scenario, rows, plano, tension, puente) {
  // SIN try/catch mudo acá: si esta fuente falta, la vista tiene que fallar fuerte y no mostrar "0 cuentas bajo
  // presupuesto", que se lee como una buena noticia. (Pasó: un import faltante quedó tragado por un catch y la
  // sección declaraba que nadie estaba bajo presupuesto cuando había tres.)
  const cv = applyScenarioToClientesVentas(scenario) || [];
  const porNombre = new Map(rows.map((r) => [r.name, r]));
  const _falta = (act, ref) => (typeof act === "number" && typeof ref === "number" && act < ref ? ref - act : 0);

  // ── VENTA NO ALCANZADA · contra PRESUPUESTO (solo cliente: es donde el dato lo declara) ──
  const bajoPpto = cv.filter((c) => _falta(c.actual, c.presupuesto) > 0)
    .map((c) => ({
      nombre: c.nombre, actual: c.actual, referencia: c.presupuesto, falta: c.presupuesto - c.actual,
      actualFmt: _M(c.actual * 1000), referenciaFmt: _M(c.presupuesto * 1000), faltaFmt: _K((c.presupuesto - c.actual) * 1000),
      cumplimientoFmt: _pct((c.actual / c.presupuesto) * 100),
      material: porNombre.get(c.nombre) && porNombre.get(c.nombre).varaGap <= -POLICY.margenBrechaMaterial,
    })).sort((a, b) => b.falta - a.falta);
  const totalFaltaPpto = bajoPpto.reduce((s, x) => s + x.falta, 0);

  // ── VENTA NO ALCANZADA · contra el AÑO ANTERIOR, con precio/volumen (la descomposición cierra exacta) ──
  const _pv = (act, und, ant, undAnt) => {
    if (!(und > 0) || !(undAnt > 0)) return null;
    const pAnt = ant / undAnt, pAct = act / und;
    const volumen = (und - undAnt) * pAnt, precio = (pAct - pAnt) * und;
    return { volumen, precio, cierra: Math.abs(volumen + precio - (act - ant)) < 1,
      volumenFmt: _K(volumen * 1000), precioFmt: _K(precio * 1000),
      dominante: Math.abs(volumen) >= Math.abs(precio) ? "volumen" : "precio" };
  };
  const bajoAnt = cv.filter((c) => _falta(c.actual, c.anterior) > 0)
    .map((c) => ({
      nombre: c.nombre, actual: c.actual, referencia: c.anterior, falta: c.anterior - c.actual,
      actualFmt: _M(c.actual * 1000), referenciaFmt: _M(c.anterior * 1000), faltaFmt: _K((c.anterior - c.actual) * 1000),
      cumplimientoFmt: _pct((c.actual / c.anterior) * 100),
      pv: _pv(c.actual, c.unidades, c.anterior, c.unidadesAnt),
      material: porNombre.get(c.nombre) && porNombre.get(c.nombre).varaGap <= -POLICY.margenBrechaMaterial,
    })).sort((a, b) => b.falta - a.falta);
  const totalFaltaAnt = bajoAnt.reduce((s, x) => s + x.falta, 0);

  const _insightVenta = (lista, total, refLabel, conPV) => {
    if (!lista.length) return `Ninguna cuenta quedó por debajo ${refLabel}: la venta no se frena contra esa referencia.`;
    const top = lista.slice(0, 2);
    const base = `La venta se frena en ${top.map((x) => x.nombre).join(" y ")}${lista.length > top.length ? ` (y ${lista.length - top.length} más)` : ""}: ${_K(total * 1000)} por debajo ${refLabel}.`;
    if (!conPV) return `${base} Contra esa referencia no se puede separar precio de volumen — el presupuesto declara monto, no unidades.`;
    const conDatos = lista.filter((x) => x.pv);
    if (!conDatos.length) return `${base} No hay unidades declaradas para separar precio de volumen.`;
    const vol = conDatos.filter((x) => x.pv.dominante === "volumen").length;
    return `${base} En ${vol} de ${conDatos.length} pesa más el volumen que el precio; la aritmética separa los dos efectos, pero por qué cayó cada uno es lo que hay que ir a mirar.`;
  };

  // ── EL MARGEN, EN SUS DOS CAUSAS (owner 2026-08-07) ──────────────────────────────────────────────────────────
  // "Hay dos cosas que nos hacen perder margen: acciones comerciales y variación de costos, porque afecta el
  // precio." Las dos se miden acá, cada una contra su propia referencia, y las dos dicen cuánto vale cerrarlas.
  //
  //   A · ACCIONES COMERCIALES · contra DOS varas, porque responden preguntas distintas:
  //       · el PROMEDIO PONDERADO de tu cartera (acciones ÷ venta del negocio) — la vara realista: "¿qué pasa si
  //         los que entregan de más se parecen al resto de tu cartera?". Es la que el owner pidió.
  //       · tu META declarada (POLICY.targetCarga) — la vara aspiracional, más ambiciosa.
  //       El promedio es PONDERADO, no simple: el simple no reconcilia con el total del negocio.
  //   B · COSTO CONTRA PRECIO · la serie mensual trae `costoMedio` y `ticket` por entidad, así que se puede ver
  //       si el costo unitario se movió más que el precio. Si sube el costo y el precio no acompaña, el margen
  //       unitario se comprime — eso es pérdida, y se cuantifica multiplicando por las unidades del período.
  //       ⚠️ Es una lectura UNITARIA: `ticket` y `costoMedio` son series propias del dataset y su NIVEL no cierra
  //       al centavo con el margen contable. Lo que sí vale es su VARIACIÓN, que es cada serie contra sí misma.
  //       Por eso el efecto va como INDICADO, nunca como probado.
  const _accionesComerciales = () => {
    const tV = rows.reduce((s, r) => s + (r.ventas || 0), 0);
    const tA = rows.reduce((s, r) => s + (r.acciones || 0), 0);
    const promedio = tV ? +((tA / tV) * 100).toFixed(2) : null;
    const meta = POLICY.targetCarga;
    const vara = (ref) => {
      const sobre = rows.filter((r) => typeof r.carga === "number" && r.carga > ref)
        .map((r) => ({
          nombre: r.name, carga: r.carga, cargaFmt: _pct(r.carga),
          exceso: +(r.carga - ref).toFixed(2), excesoFmt: `${(r.carga - ref).toFixed(2)} pp`,
          ventaFmt: _M((r.ventas || 0) * 1000),
          recuperable: ((r.carga - ref) / 100) * (r.ventas || 0) * 1000,
        }))
        .map((x) => ({ ...x, recuperableFmt: _K(x.recuperable) }))
        .sort((a, b) => b.recuperable - a.recuperable);
      const total = sobre.reduce((s, x) => s + x.recuperable, 0);
      return { filas: sobre, n: sobre.length, total, totalFmt: _K(total) };
    };
    const alPromedio = vara(promedio), aLaMeta = vara(meta);
    // ── EL OTRO LADO DEL PROMEDIO (owner 2026-08-07: "¿y qué pasa con los que están bajo ese promedio?") ──
    // ⚠️ NO son dinero a capturar: llevarlos al promedio sería ENTREGARLES MÁS, y eso pierde margen, no lo gana.
    // Su valor es otro y es grande: son la PRUEBA, con tus propios clientes, de que se puede vender entregando
    // menos. Eso es lo que hace creíble el objetivo para los de arriba — no un ideal, tu propia cartera.
    // Por qué operan más bajo, el dato no lo dice: puede ser poder de negociación, canal o mezcla. Queda ABIERTO.
    const bajoFilas = rows.filter((r) => typeof r.carga === "number" && r.carga < promedio)
      .map((r) => ({
        nombre: r.name, carga: r.carga, cargaFmt: _pct(r.carga),
        holgura: +(promedio - r.carga).toFixed(2), holguraFmt: `${(promedio - r.carga).toFixed(2)} pp`,
        ventaFmt: _M((r.ventas || 0) * 1000), margenFmt: _pct(r.margen),
      })).sort((a, b) => b.holgura - a.holgura);
    const ventaBajo = rows.filter((r) => typeof r.carga === "number" && r.carga < promedio).reduce((s, r) => s + (r.ventas || 0), 0);
    const bajo = {
      filas: bajoFilas, n: bajoFilas.length, ventaFmt: _M(ventaBajo * 1000),
      menorFmt: bajoFilas.length ? bajoFilas[0].cargaFmt : "—", menorNombre: bajoFilas.length ? bajoFilas[0].nombre : null,
      lectura: bajoFilas.length
        ? `Del otro lado hay ${bajoFilas.length} ${bajoFilas.length === 1 ? "cliente que opera" : "clientes que operan"} por debajo del promedio y suman ${_M(ventaBajo * 1000)} de venta — ${bajoFilas[0].nombre} lo hace con ${bajoFilas[0].cargaFmt}. No son plata a capturar: llevarlos al promedio sería entregarles más. Son la prueba, con tus propios clientes, de que se puede vender entregando menos; por qué lo logran es lo que hay que ir a mirar.`
        : `No hay clientes por debajo del promedio: todos entregan lo mismo o más.`,
      estatus: "abierto",
    };
    return {
      bajo,
      promedio, promedioFmt: _pct(promedio, 2), meta, metaFmt: _pct(meta),
      totalFmt: _M(tA * 1000), sobreVentaFmt: _pct(promedio),
      referencias: [
        { key: "promedio", label: "al promedio de tu cartera", refFmt: _pct(promedio, 2), ...alPromedio,
          nota: `El promedio ponderado de tu cartera: ${_K(tA * 1000)} de acciones comerciales sobre ${_M(tV * 1000)} de venta. Es la vara realista — pregunta qué pasa si los que entregan de más se parecen al resto de tu propia cartera, no a un ideal.` },
        { key: "meta", label: `a tu meta de ${_pct(meta)}`, refFmt: _pct(meta), ...aLaMeta,
          nota: `Tu meta declarada. Es más ambiciosa que el promedio, así que el monto es mayor — y por eso las dos se muestran juntas: una dice qué es alcanzable comparándote con vos mismo, la otra qué te propusiste.` },
      ],
      lectura: alPromedio.n
        ? `${alPromedio.n} de ${rows.length} clientes entregan más que el promedio de tu cartera (${_pct(promedio, 2)}). Alinearlos con ese promedio recupera ${_K(alPromedio.total)}; llevarlos a tu meta de ${_pct(meta)}, ${_K(aLaMeta.total)}. Es lo único de la brecha con una causa medida cuenta por cuenta.`
        : `Ninguna cuenta entrega más que el promedio de tu cartera (${_pct(promedio, 2)}): por acciones comerciales no hay margen que rescatar.`,
    };
  };
  // B · COSTO CONTRA PRECIO — la serie mensual de cada cuenta, de su primer mes a su último
  const _costoPrecio = () => {
    const hist = getTenantData()?.historialMargen || {};
    const filas = rows.map((r) => {
      const s = hist[r.name];
      if (!Array.isArray(s) || s.length < 2) return null;
      const a = s[0], z = s[s.length - 1];
      if (![a.costoMedio, z.costoMedio, a.ticket, z.ticket].every((v) => typeof v === "number" && v > 0)) return null;
      const dCostoPct = +(((z.costoMedio / a.costoMedio) - 1) * 100).toFixed(1);
      const dPrecioPct = +(((z.ticket / a.ticket) - 1) * 100).toFixed(1);
      const mUniA = a.ticket - a.costoMedio, mUniZ = z.ticket - z.costoMedio;
      const efectoUni = +(mUniZ - mUniA).toFixed(2);
      const efecto = efectoUni * (r.unidades || 0) * 1000;   // el dato de venta viene en $K
      return {
        nombre: r.name, desde: a.mes, hasta: z.mes,
        costoA: a.costoMedio, costoZ: z.costoMedio, dCostoPct, dCostoFmt: `${dCostoPct >= 0 ? "+" : ""}${dCostoPct.toFixed(1)}%`,
        precioA: a.ticket, precioZ: z.ticket, dPrecioPct, dPrecioFmt: `${dPrecioPct >= 0 ? "+" : ""}${dPrecioPct.toFixed(1)}%`,
        efectoUni, efectoUniFmt: `${efectoUni >= 0 ? "+" : "−"}$${Math.abs(efectoUni).toFixed(2)}`,
        efecto, efectoFmt: `${efecto >= 0 ? "+" : "−"}${_K(Math.abs(efecto))}`,
        comprime: efectoUni < 0,
      };
    }).filter(Boolean);
    if (!filas.length) return null;
    filas.sort((a, b) => a.efecto - b.efecto);   // lo que más comprime, primero
    const comprimen = filas.filter((f) => f.comprime);
    const perdida = comprimen.reduce((s, f) => s + f.efecto, 0);
    const ganancia = filas.filter((f) => !f.comprime).reduce((s, f) => s + f.efecto, 0);
    const desde = filas[0].desde, hasta = filas[0].hasta;
    return {
      filas, n: filas.length, desde, hasta,
      comprimenN: comprimen.length, perdida, perdidaFmt: _K(Math.abs(perdida)),
      ganancia, gananciaFmt: _K(ganancia),
      lectura: comprimen.length
        ? `En ${comprimen.length} de ${filas.length} cuentas el costo unitario subió más que el precio entre ${desde} y ${hasta}: el margen por unidad se comprimió y eso equivale a ${_K(Math.abs(perdida))} sobre las unidades del período. Empezá por ${comprimen.slice(0, 2).map((f) => f.nombre).join(" y ")}.`
        : `Entre ${desde} y ${hasta} el costo unitario cedió y el precio subió en las ${filas.length} cuentas: el margen por unidad se expandió, no se comprimió. Por costo no estás perdiendo margen este período — el deterioro viene por el otro lado.`,
      nota: `Compara el costo unitario contra el precio por unidad de cada cuenta, de ${desde} a ${hasta}. Si el costo sube y el precio no acompaña, el margen por unidad se comprime; multiplicado por las unidades del período, eso es lo que cuesta. Va como INDICADO y no como probado: el nivel de estas dos series no cierra al centavo con el margen contable — lo que vale es su VARIACIÓN, que es cada serie contra sí misma.`,
      estatus: "indicado",
    };
  };


  // ── VENDE MUCHO PERO DEJA POCO · POR QUÉ (owner 2026-08-07) ──────────────────────────────────────────────────
  // "Quiero saber qué clientes venden mucho pero dejan poco margen. ¿Por qué me dejan poco? ¿Tienen mucha acción
  // comercial? ¿El precio es más barato que el resto y marginamos menos?"
  //
  // LA ARITMÉTICA QUE LO RESPONDE, y cierra EXACTA: margen% = 100 − costo% − acciones%. Entonces la brecha de una
  // cuenta contra el promedio de la cartera se parte SIEMPRE en dos términos, sin residuo:
  //     brecha = (acciones_promedio − acciones_cuenta) + (costo%_promedio − costo%_cuenta)
  //              └── el término de ACCIONES ──┘          └── el término de PRECIO/COSTO ──┘
  // El primero está MEDIDO cuenta por cuenta (pctRebate). El segundo es una diferencia de estructura: dice cuánto
  // de la brecha NO viene del descuento, pero no dice todavía si es que vende más barato o compra más caro. Para
  // eso está el contexto unitario de abajo — ticket y costo medio contra el promedio ponderado de la cartera.
  // Nunca se afirma "su costo es el problema": se dice cuánto pesa cada término y qué falta separar.
  const _porQue = () => {
    const tV = rows.reduce((s, r) => s + (r.ventas || 0), 0);
    const tA = rows.reduce((s, r) => s + (r.acciones || 0), 0);
    const tC = rows.reduce((s, r) => s + (r.contribucion || 0), 0);
    if (!tV) return null;
    const margenProm = +((tC / tV) * 100).toFixed(2);
    const cargaProm = +((tA / tV) * 100).toFixed(2);
    const costoProm = +(100 - margenProm - cargaProm).toFixed(2);
    // contexto unitario: ticket y costo medio del último mes, contra el promedio PONDERADO por unidades
    const hist = getTenantData()?.historialMargen || {};
    const uni = new Map();
    for (const r of rows) {
      const s = hist[r.name];
      if (Array.isArray(s) && s.length) { const z = s[s.length - 1]; if (z.ticket > 0 && z.costoMedio > 0) uni.set(r.name, { ticket: z.ticket, costo: z.costoMedio, und: r.unidades || 0 }); }
    }
    const undTot = [...uni.values()].reduce((s, x) => s + x.und, 0);
    const tickProm = undTot ? [...uni.values()].reduce((s, x) => s + x.ticket * x.und, 0) / undTot : null;
    const costoUniProm = undTot ? [...uni.values()].reduce((s, x) => s + x.costo * x.und, 0) / undTot : null;
    const enGrupo = new Set(plano.grupo.map((r) => r.name));

    const filas = rows
      .filter((r) => enGrupo.has(r.name) && typeof r.margen === "number" && r.margen < margenProm)
      .map((r) => {
        const carga = typeof r.carga === "number" ? r.carga : 0;
        const costoPct = +(100 - r.margen - carga).toFixed(2);
        const brecha = +(r.margen - margenProm).toFixed(2);
        const efCarga = +(cargaProm - carga).toFixed(2);       // negativo = entrega más que la cartera
        const efCosto = +(costoProm - costoPct).toFixed(2);    // negativo = su estructura precio/costo pesa más
        const dominante = Math.abs(efCarga) >= Math.abs(efCosto) ? "acciones" : "precio/costo";
        const u = uni.get(r.name);
        const dTicket = u && tickProm ? +(((u.ticket / tickProm) - 1) * 100).toFixed(0) : null;
        const dCostoUni = u && costoUniProm ? +(((u.costo / costoUniProm) - 1) * 100).toFixed(0) : null;
        const _sig = (v, suf) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(suf === "pp" ? 2 : 0)}${suf === "pp" ? " pp" : "%"}`;
        // el CONTEXTO unitario, en palabras: vende más caro / más barato · compra más caro / más barato
        const contexto = dTicket == null ? null
          : `Vende ${dTicket >= 0 ? `${dTicket}% más caro` : `${Math.abs(dTicket)}% más barato`} que el promedio de tu cartera y su costo por unidad es ${dCostoUni >= 0 ? `${dCostoUni}% más alto` : `${Math.abs(dCostoUni)}% más bajo`}.`;
        return {
          nombre: r.name,
          ventaFmt: _M((r.ventas || 0) * 1000), participacionFmt: _pct(((r.ventas || 0) / tV) * 100),
          margen: r.margen, margenFmt: _pct(r.margen), brecha, brechaFmt: _sig(brecha, "pp"),
          carga, cargaFmt: _pct(carga),
          efCarga, efCargaFmt: _sig(efCarga, "pp"), efCosto, efCostoFmt: _sig(efCosto, "pp"), dominante,
          dTicket, dTicketFmt: dTicket == null ? "—" : _sig(dTicket, "%"),
          dCostoUni, dCostoUniFmt: dCostoUni == null ? "—" : _sig(dCostoUni, "%"),
          contexto,
          cierra: Math.abs((efCarga + efCosto) - brecha) < 0.05,
          // LA RESPUESTA A "¿por qué me deja poco?", con la parte medida primero
          lectura: dominante === "acciones"
            ? `${_sig(brecha, "pp")} bajo el promedio de tu cartera, y la mayor parte viene de lo que le entregás: opera con ${_pct(carga)} de acciones comerciales contra el ${_pct(cargaProm, 2)} de la cartera (${_sig(efCarga, "pp")}). El resto (${_sig(efCosto, "pp")}) queda en la relación entre su precio y su costo.`
            : `${_sig(brecha, "pp")} bajo el promedio de tu cartera, y la mayor parte NO viene del descuento (${_sig(efCarga, "pp")}) sino de la relación entre su precio y su costo (${_sig(efCosto, "pp")}).${contexto ? ` ${contexto}` : ""} Falta separar cuánto es precio y cuánto es costo de producto.`,
        };
      })
      .sort((a, b) => b.brecha - a.brecha)   // menos negativo primero… se invierte abajo
      .sort((a, b) => a.brecha - b.brecha);  // la peor brecha arriba
    if (!filas.length) return null;
    const porAcciones = filas.filter((f) => f.dominante === "acciones");
    const porPrecio = filas.filter((f) => f.dominante === "precio/costo");
    return {
      filas, n: filas.length,
      margenProm, margenPromFmt: _pct(margenProm), cargaPromFmt: _pct(cargaProm, 2),
      tickPromFmt: tickProm ? `$${tickProm.toFixed(2)}` : "—", costoUniPromFmt: costoUniProm ? `$${costoUniProm.toFixed(2)}` : "—",
      lectura: `${filas.length} de los ${plano.n} clientes que sostienen la venta dejan menos margen que el promedio de tu cartera (${_pct(margenProm)}). ${porAcciones.length ? `En ${porAcciones.map((f) => f.nombre).join(", ")} pesa más lo que les entregás.` : ""}${porPrecio.length ? ` En ${porPrecio.map((f) => f.nombre).join(", ")} pesa más la relación entre su precio y su costo.` : ""} Son dos problemas distintos y se arreglan distinto.`,
      nota: `La brecha de cada cuenta contra el promedio de la cartera se parte SIEMPRE en dos términos que suman exacto: lo que le entregás en acciones comerciales (medido cuenta por cuenta) y la relación entre su precio y su costo. El segundo dice cuánto de la brecha NO viene del descuento, pero todavía no separa si vende más barato o compra más caro — para eso está la comparación de precio y costo por unidad contra el promedio ponderado de tu cartera (${tickProm ? `$${tickProm.toFixed(2)}` : "—"} y ${costoUniProm ? `$${costoUniProm.toFixed(2)}` : "—"}).`,
      estatus: "indicado",
    };
  };


  // ── MARGEN NO CAPTURADO · las cuentas bajo tu benchmark, con lo probado y lo abierto ──
  const margenFilas = rows.filter((r) => typeof r.varaGap === "number" && r.varaGap <= -POLICY.margenBrechaMaterial)
    .map((r) => {
      const exceso = typeof r.carga === "number" ? r.carga - POLICY.targetCarga : null;
      const probado = exceso > 0 ? (exceso / 100) * (r.ventas || 0) * 1000 : 0;
      return {
        nombre: r.name, margenFmt: _pct(r.margen), varaFmt: _pct(r.varaRef), brechaFmt: _pp(r.varaGap),
        enJuego: r.enJuego || 0, enJuegoFmt: _M(r.enJuego || 0),
        cargaFmt: _pct(r.carga), sobreMeta: exceso > 0, excesoFmt: exceso > 0 ? _pp(exceso) : null,
        probado, probadoFmt: probado > 0 ? _K(probado) : null,
        estatus: probado > 0 ? "probado" : "abierto",
      };
    }).sort((a, b) => b.enJuego - a.enJuego);
  const enJuegoTotal = margenFilas.reduce((s, x) => s + x.enJuego, 0);
  const probadoTotal = margenFilas.reduce((s, x) => s + x.probado, 0);
  const conProbado = margenFilas.filter((x) => x.probado > 0).length;
  const insightMargen = !margenFilas.length
    ? `Ninguna cuenta cede ${POLICY.margenBrechaMaterial} pp o más contra tu benchmark: el margen no se diluye de forma material.`
    : `El margen se diluye en ${margenFilas.slice(0, 2).map((x) => x.nombre).join(" y ")}${margenFilas.length > 2 ? ` y ${margenFilas.length - 2} más` : ""}: ${_M(enJuegoTotal)} de contribución en juego. ${conProbado ? `En ${conProbado} de ${margenFilas.length} una parte está medida — operan sobre tu meta de acciones comerciales, ${_K(probadoTotal)} en total` : "En ninguna hay todavía una parte medida"}; el resto necesita aislarse entre costo, precio y composición.`;

  return {
    venta: {
      porDefecto: bajoPpto.length ? "presupuesto" : "anterior",
      referencias: [
        { key: "presupuesto", label: "vs presupuesto", refLabel: "de tu presupuesto", filas: bajoPpto, n: bajoPpto.length,
          faltaTotal: totalFaltaPpto, faltaTotalFmt: _K(totalFaltaPpto * 1000), descomponible: false,
          insight: _insightVenta(bajoPpto, totalFaltaPpto, "de tu presupuesto", false),
          nota: "El presupuesto está declarado por CLIENTE y suma exacto el total del período. No existe por familia ni por marca, así que este corte es de clientes; y como declara monto y no unidades, contra él no se puede separar precio de volumen." },
        { key: "anterior", label: "vs año anterior", refLabel: "del año anterior", filas: bajoAnt, n: bajoAnt.length,
          faltaTotal: totalFaltaAnt, faltaTotalFmt: _K(totalFaltaAnt * 1000), descomponible: true,
          insight: _insightVenta(bajoAnt, totalFaltaAnt, "del año anterior", true),
          nota: "El período comparable trae venta Y unidades, así que acá sí se separa cuánto del retroceso es volumen y cuánto es precio. La descomposición cierra exacta: volumen + precio = la diferencia. Es aritmética, no una causa." },
      ],
    },
    margen: {
      filas: margenFilas, n: margenFilas.length,
      enJuegoTotal, enJuegoFmt: _M(enJuegoTotal), probadoFmt: _K(probadoTotal), abiertoFmt: _M(Math.max(0, puente.brechaTotal - probadoTotal)),
      insight: insightMargen,
      nota: `Las cuentas que ceden ${POLICY.margenBrechaMaterial} pp o más contra tu benchmark — el mismo criterio del detector y del cuadro. "En juego" es la contribución no capturada de esa cuenta. Lo PROBADO es el exceso medido de acciones comerciales sobre tu meta; el resto queda ABIERTO entre costo, precio y composición, que el motor todavía no aísla.`,
      // LAS DOS CAUSAS del margen, cada una con su referencia y su monto (owner 2026-08-07)
      acciones: _accionesComerciales(),
      costoPrecio: _costoPrecio(),
      porQue: _porQue(),   // vende mucho pero deja poco: la brecha partida en sus dos términos
    },
  };
}

/* ── QUÉ HACER PRIMERO · el cruce de los dos deterioros ────────────────────────────────────────────────────────
 * Owner 2026-08-07: "evita el error comercial más peligroso — intentar recuperar ventas mediante descuentos en
 * cuentas que ya están diluyendo el margen". Ese cruce es exactamente lo que hace esta función: cada cuenta se
 * clasifica por DOS ejes que ya están medidos —está bajo su referencia de venta / cede margen material— y de ahí
 * sale la prioridad. No es una recomendación inventada: es la consecuencia lógica de dos hechos del dato.
 */
function _prioridades(rows, deterioro, insights) {
  const bajoVenta = new Map();
  for (const r of (deterioro.venta.referencias.find((x) => x.key === "presupuesto") || { filas: [] }).filas) bajoVenta.set(r.nombre, r);
  const bajoMargen = new Map(deterioro.margen.filas.map((f) => [f.nombre, f]));
  const porInsight = new Map((insights || []).map((i) => [i.entidad, i]));
  const grupos = [
    { key: "proteger", label: "Proteger el margen antes de empujar la venta", tono: "alerta",
      criterio: "Están bajo su presupuesto Y ceden margen material.",
      porQue: "Empujar volumen acá con más descuento agranda la brecha en vez de cerrarla: primero hay que recuperar el margen, después la venta." },
    { key: "recuperarMargen", label: "Recuperar margen", tono: "aviso",
      criterio: "Cumplen su presupuesto pero ceden margen material.",
      porQue: "El volumen está; lo que no está es lo que deja cada peso vendido." },
    { key: "recuperarVenta", label: "Recuperar venta", tono: "neutro",
      criterio: "Están bajo su presupuesto y su margen no cede de forma material.",
      porQue: "Acá crecer no cuesta margen: el problema es de volumen o de precio, y eso se puede empujar." },
  ];
  const clasificar = (name) => {
    const v = bajoVenta.has(name), m = bajoMargen.has(name);
    return v && m ? "proteger" : m ? "recuperarMargen" : v ? "recuperarVenta" : null;
  };
  const out = grupos.map((g) => ({ ...g, filas: [] }));
  const idx = Object.fromEntries(out.map((g, i) => [g.key, i]));
  for (const r of rows) {
    const k = clasificar(r.name); if (!k) continue;
    const v = bajoVenta.get(r.name), m = bajoMargen.get(r.name), i = porInsight.get(r.name);
    out[idx[k]].filas.push({
      entidad: r.name,
      ventaFmt: _M((r.ventas || 0) * 1000),
      faltaVentaFmt: v ? v.faltaFmt : null,
      enJuegoFmt: m ? m.enJuegoFmt : null,
      probadoFmt: m && m.probadoFmt ? m.probadoFmt : null,
      brechaFmt: m ? m.brechaFmt : null,
      estatus: m ? m.estatus : "abierto",
      impacto: (m ? m.enJuego : 0) + (v ? v.falta * 1000 : 0),
      accionCorta: i ? i.accionCorta : (m && m.sobreMeta ? `Revisar acciones comerciales: opera ${m.excesoFmt} sobre tu meta.` : "Abrir la Ficha y aislar la causa cuenta por cuenta."),
      faltaCorta: i ? i.faltaCorta : "Falta separar costo, precio y composición.",
    });
  }
  for (const g of out) g.filas.sort((a, b) => b.impacto - a.impacto);
  const vivos = out.filter((g) => g.filas.length);
  const proteger = out.find((g) => g.key === "proteger");
  return {
    grupos: vivos,
    // EL ENCABEZADO · adaptativo, y con el aviso solo cuando el cruce REALMENTE lo justifica
    encabezado: !vivos.length
      ? "Ninguna cuenta queda bajo su presupuesto ni cede margen material: no hay una prioridad que el dato justifique."
      : proteger && proteger.filas.length
        ? `Empezá por acá. ${proteger.filas.length === 1 ? `${proteger.filas[0].entidad} está` : `${proteger.filas.length} cuentas están`} bajo presupuesto Y cediendo margen: empujar volumen ahí con descuento agranda la brecha en vez de cerrarla.`
        : "Empezá por acá: las cuentas ordenadas por lo que está en juego, separadas por el tipo de problema que tienen.",
    // el cruce completo, para el gate y para quien quiera auditarlo
    total: vivos.reduce((s, g) => s + g.filas.length, 0),
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
  const deterioro = _deterioro(scenario, rows, plano, tension, puente);
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
    sostiene: _sostiene(scenario, rows, total),      // 01 · quién sostiene el negocio · clientes/familias/SKU/canales
    formacion: _formacion(total),          // 02 · venta − costo conciliado − acciones = contribución
    deterioro,                             // 02 · dónde se frena la venta y dónde se diluye el margen
    prioridades: _prioridades(rows, deterioro, insights),   // 03 · el cruce de los dos deterioros
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
