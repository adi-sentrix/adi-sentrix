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
 * DOS UNIVERSOS QUE NUNCA SE CONFUNDEN (owner 2026-08-07):
 *   · GRUPO 80%        el mínimo de clientes cuya venta acumulada alcanza el 80%. Es el plano de decisión.
 *   · EN TENSIÓN       los del grupo 80% con brecha MATERIAL (≥ POLICY.margenBrechaMaterial pp bajo su vara).
 *                      NO es "todos los que están bajo benchmark": una diferencia chica no es material.
 * Los clientes de la cola NO entran al diagnóstico inicial — aparecen al expandir la cartera completa.
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

// ── CUENTAS EN TENSIÓN ─────────────────────────────────────────────────────────────────────────────────────────
// Brecha MATERIAL, no "bajo benchmark". La vara es la misma del detector (POLICY.margenBrechaMaterial), así que
// esta cuenta no puede divergir del semáforo del cuadro ni de lo que ADI diga: una sola verdad.
function _enTension(grupo) {
  const t = grupo.filter((r) => typeof r.varaGap === "number" && r.varaGap <= -POLICY.margenBrechaMaterial);
  return { lista: t, n: t.length, enJuego: t.reduce((s, r) => s + (r.enJuego || 0), 0) };
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
    probado, probadoFmt: _K(probado),
    abierto, abiertoFmt: _M(abierto),
    tramos: [
      { estatus: "probado", monto: _K(probado), titulo: "Acciones comerciales sobre la meta",
        detalle: `${conExceso.length} ${conExceso.length === 1 ? "cliente opera" : "clientes operan"} con carga comercial sobre tu meta de ${_pct(POLICY.targetCarga)}. Es la única parte de la brecha con una causa comprobada y cuantificada.` },
      { estatus: "indicado", monto: tension.n ? _M(tension.enJuego) : "—", titulo: "Dónde se concentra la brecha",
        detalle: tension.n
          ? `${tension.n} de los ${plano.n} clientes del plano concentran ${_M(tension.enJuego)}. Es una localización comprobada, no una causa: falta aislar qué la produce en cada cuenta.`
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

// ── VARIACIÓN ANUAL DEL NEGOCIO ────────────────────────────────────────────────────────────────────────────────
// Sale de `clientesVentas` — la MISMA fuente que la venta por cliente del cuadro, así que el "+X%" del titular y
// el "$Y" del KPI no pueden divergir. Si el tenant no trae `anterior`, devuelve null: el veredicto cae a su rama
// neutral y el KPI declara que la variación no está autorizada, en vez de rellenarla con un cero.
function _variacionAnual() {
  const rows = getTenantData()?.clientesVentas;
  if (!Array.isArray(rows) || !rows.length) return null;
  let act = 0, ant = 0;
  for (const r of rows) { if (typeof r.actual === "number") act += r.actual; if (typeof r.anterior === "number") ant += r.anterior; }
  if (!ant) return null;
  return +(((act - ant) / ant) * 100).toFixed(1);
}

// ── LA VISTA COMPLETA ──────────────────────────────────────────────────────────────────────────────────────────
export function buildResumenComercial(scenario = "actual", { maxEntidades = 10 } = {}) {
  const cuadro = buildCuadroMando("cliente", scenario);
  const rows = (cuadro.rows || []).filter((r) => r && !r._total && !r._ref);
  if (!rows.length) return null;
  const total = { ...(cuadro.total || {}), _vara: rows.find((r) => typeof r.varaRef === "number")?.varaRef ?? null };
  const plano = _plano(rows);
  const tension = _enTension(plano.grupo);
  // VARIACIÓN ANUAL DEL NEGOCIO · de la MISMA fuente que la venta por cliente (`clientesVentas`, una sola verdad
  // — ver la regla de venta oficial por cliente). Si el tenant no declara `anterior`, queda null y el veredicto lo
  // dice en vez de inventar un crecimiento.
  const variacionPct = _variacionAnual();
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
