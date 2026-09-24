/* === src/adi/conocimiento/tablaSenales.js · LA TABLA DE SEÑALES POR ENTIDAD (Business Knowledge v0.2 §6, B1) ═══
 * «El corazón de todo: publicar como predicados tipados lo que el Core ya decide (bajo_benchmark, carga_alta,
 * vencido_positivo, variacion.neg, sku.estado, top_seller, en_respuesta). Es una PROYECCIÓN del libro de hechos,
 * no lógica nueva.»
 *
 * Este módulo NO calcula umbrales nuevos ni redefine qué es "alto" o "bajo": lee los mismos veredictos que ya
 * publican `descomposicionDeBrecha` (specRetrieval.js — la única definición de "carga comercial alta" y de
 * "bajo benchmark", la que ya usan la pestaña Comercial y ADI), los playbooks de cobranza/inventario (las
 * MISMAS herramientas que ya certifica `src/adi/entrega/componer.js`) y `figureType.periodoDeFiguras` (el mismo
 * campo que ya declara el Marco de la Entrega). Es una proyección — el trabajo es publicar, no calcular
 * (§4 B1 del documento).
 *
 * `cuenta.carga_sobre_resto` es la ÚNICA relación derivada acá (mayor(a,b) entre dos cifras que el motor YA
 * calculó, sin umbral): la carga % de una cuenta contra el promedio de carga % de las demás.
 *
 * Import solo del motor (oracle/, agente/playbooks/, specRetrieval, config/contract) — LA CAPA IMPORTA DEL
 * MOTOR, NUNCA AL REVÉS (candado del plan §4 C, verificado por `_conocimiento_gate.mjs`). Sin red: los playbooks
 * que este módulo corre son las mismas tools locales y deterministas que ya certifica `_entrega_gate.mjs`. */
import { ESCENARIO_INICIAL } from "../../config/scenarios.js";
import { runPlan } from "../oracle/toolRunner.js";
import { TOOLS } from "../oracle/toolRegistry.js";
import { cajaDelAgente } from "../agente/herramientasAgente.js";
import { pasosDe } from "../agente/playbooks/registro.js";
import { margenEnRiesgo, prioridadDe } from "../agente/playbooks/margenEnRiesgo.js";
import { cobranza } from "../agente/playbooks/cobranza.js";
import { buildMesaFlujo } from "../sentrix/mesaFlujo.js";
import { inventarioInmovilizado } from "../agente/playbooks/asesoria.js";
import { descomposicionDeBrecha } from "../specRetrieval.js";
import { cifrasDelDato } from "../oracle/datoProyectado.js";
import { axisEntityNames } from "../oracle/entityIndex.js";
import { asignarIds } from "../notario/hechos.js";
import { indiceDeEvidencia } from "../notario/evidencia.js";
import { periodoDeFiguras, factorComercialDe } from "../../config/contract/figureType.js";
import { dominiosDe } from "../agente/contratoDeDominios.js";
import { fig } from "../boleta.js";
import { getTenantData } from "../../data/tenantStore.js";

const _EJES = ["cliente", "sku", "marca", "familia", "bodega", "canal"];

const _lab = (f) => String((f && f.label) || "");
const _val = (f) => String((f && (f.text || f.value)) || "");
const _num = (f) => {
  if (f && Number.isFinite(f.raw)) return f.raw;
  const s = _val(f).trim();
  const m = /^\$\s?(-?[\d.,]+)\s?([KMB])?$/.exec(s);
  if (m) { const n = parseFloat(m[1].replace(",", ".")); const k = { K: 1e3, M: 1e6, B: 1e9 }[m[2]] || 1; return Number.isFinite(n) ? n * k : NaN; }
  return NaN;
};
const _all = (figs, re) => (Array.isArray(figs) ? figs : []).filter((f) => re.test(_lab(f)));
const _find = (figs, re) => (Array.isArray(figs) ? figs : []).find((f) => re.test(_lab(f))) || null;
const _entidadDe = (label) => { const p = String(label || "").split("·").map((s) => s.trim()); return p.length >= 2 ? p[0] : null; };

function _correrPasos(pasos, { scenario, pregunta }) {
  if (!Array.isArray(pasos) || !pasos.length) return { rp: null, figs: [] };
  let rp = null;
  try {
    rp = runPlan(
      { intent: "answer", calls: pasos.map((p) => ({ tool: p.tool, args: p.args })) },
      { scenario, maxCalls: 8, preguntaUsuario: pregunta, registry: cajaDelAgente(TOOLS) },
    );
  } catch { rp = null; }
  return { rp, figs: asignarIds((rp && rp.ledger && rp.ledger.figs) || [], "s") };
}

/* ═══ EL LIBRO EVALUABLE COMPLETO DE COBRANZA (owner 2026-09-23, PRI-04 — corrección tras el informe: «el tope
 * de 8 rompe la regla 2 sellada y hace falsa la línea de cobertura») ═══════════════════════════════════════════
 * `herramientasAgente.js:cobranza()` publica como máximo 8 filas por cliente — un tope de TAMAÑO DE PROMPT para
 * lo que ve el agente, no una verdad del negocio. Esta capa necesita el LIBRO EVALUABLE COMPLETO (regla 2 del
 * sello: «proporciones calculadas sobre el libro evaluable COMPLETO, nunca sobre el subconjunto que se
 * responde»), así que arma su PROPIA evidencia — misma fuente (`buildMesaFlujo`, la MISMA mesa que la pestaña
 * Flujo Comercial y que la herramienta del agente), mismo formateador de fig (`boleta.js:fig`), mismo factor de
 * escala (`factorComercialDe`) — sin el tope. NUNCA se toca `herramientasAgente.js` ni lo que el agente muestra
 * en su propia boleta: esto es evidencia INTERNA de esta capa, para verificar PRI-04, no para narrar.
 *
 * ⚠️ EL VENCIDO EN $0 SE PUBLICA ACÁ, A DIFERENCIA DEL AGENTE: `mesaFlujo.js` dice `vencidoFmt: null` tanto
 * para "sin plazo" como para "con plazo y vencido = 0" — el agente omite la fig en los dos casos (no hay nada
 * útil que mostrar de un $0). Para esta capa esa ambigüedad ES el problema: un cliente al día NO es un cliente
 * sin plazo. Por eso, cuando `diasCredito != null` (plazo declarado, con certeza), esta función publica «·
 * Saldo vencido» con SU valor real, sea $0 o no — un hecho verificable, nunca una cifra inventada; sin plazo
 * (`diasCredito === null`), la fig NO se publica (la ley del owner: nunca $0 cuando no hay plazo). */
function _figsCobranzaCompleta(scenario) {
  let M = null;
  try { M = buildMesaFlujo(scenario); } catch { M = null; }
  if (!M || !Array.isArray(M.filas) || !M.filas.length) return { figs: [], totalClientes: 0 };
  const fx = factorComercialDe(getTenantData() || {});
  const esPlanilla = M.origen === "planilla";
  const ventaLabel = esPlanilla ? "Venta a crédito" : "Venta (flujo)";
  const ventaLabelTotal = esPlanilla ? "Venta a crédito del período" : "Venta del período (flujo)";
  const ctx = `flujo comercial al ${M.fechaCorteFmt || "cierre del período"} — la misma mesa que la pestaña (libro evaluable completo de cobranza, sin el tope de la boleta del agente)`;
  const out = [];
  const _f = (label, valorFmt, rawK) => out.push(fig(label, valorFmt, { unit: "money", raw: Number.isFinite(rawK) ? rawK * fx : null, source: "actual", context: ctx }));
  if (M.total) {
    if (M.total.ventaFmt != null) _f(ventaLabelTotal, M.total.ventaFmt, M.total.ventaK);
    if (M.total.abonadoFmt != null) _f("Abonado · total", M.total.abonadoFmt, M.total.abonadoK);
    if (M.total.saldoFmt != null) _f("Saldo pendiente · total", M.total.saldoFmt, M.total.saldoK);
    if (M.total.vencidoK != null) _f("Saldo vencido · total", M.total.vencidoFmt, M.total.vencidoK);
  }
  for (const f of M.filas) {
    _f(`${f.nombre} · ${ventaLabel}`, f.ventaFmt, f.ventaK);
    _f(`${f.nombre} · Saldo pendiente`, f.saldoFmt, f.saldoK);
    if (f.diasCredito != null) _f(`${f.nombre} · Saldo vencido`, f.vencidoK > 0 ? f.vencidoFmt : "$0", f.vencidoK || 0);
  }
  return { figs: asignarIds(out, "mc"), totalClientes: M.filas.length };
}

/* ── el léxico de tema/métrica de la pregunta — el MISMO tipo de detección léxica y determinística que ya usa
 * `contratoDeDominios.js` (nunca comprensión del modelo); acá solo se agrega la métrica puntual que las piezas
 * necesitan nombrar (margen/carga/plazos), que el contrato de dominios no distingue porque no lo necesita. ── */
const _RE_MARGEN = /\bmargen|rentabilidad|contribuci[oó]n/i;
const _RE_CARGA = /\bcarga comercial|convenio|rappel|aporte publicitario|descuento log[ií]stico/i;
const _RE_PLAZOS = /\bplazo|d[ií]as de pago|d[ií]as de cobro/i;
function _preguntaDeLaTabla(pregunta) {
  let dominios = [];
  try { dominios = dominiosDe(pregunta).dominios || []; } catch { dominios = []; }
  const q = String(pregunta || "");
  const temas = [...dominios];
  // "prioridad" es un tema propio de la pregunta (no un dominio del contrato): se enciende con un encargo de
  // dos o más dominios, o con el léxico de prioridad que ya usa `prioridadIntegrada.js` (criterioDeLaPregunta).
  if (dominios.length >= 2 || /prioridad|preocupa|riesgo|prioritario|primero/i.test(q)) temas.push("prioridad");
  const metricas = [];
  if (_RE_MARGEN.test(q)) metricas.push("margen");
  if (_RE_CARGA.test(q)) metricas.push("carga");
  if (_RE_PLAZOS.test(q)) metricas.push("plazos");
  return { temas, metricas, texto: q };
}

/** construirTablaDeSenales({ scenario, pregunta, entidadesEnRespuesta }) → la tabla de señales por entidad.
 *  PROYECCIÓN pura sobre lo que el motor ya calculó — ver la cabecera. `entidadesEnRespuesta` (opcional): las
 *  cuentas/SKU que la Respuesta de ESTA Entrega ya nombra — así `cuenta.en_respuesta` no adivina, lo declara
 *  quien compone la Entrega (mismo dato que ya usan los acotadores, §3 del documento). */
export function construirTablaDeSenales({ scenario = ESCENARIO_INICIAL, pregunta = "", entidadesEnRespuesta = [] } = {}) {
  const nombradas = new Set((entidadesEnRespuesta || []).filter(Boolean));
  const cuentas = {};
  const skus = {};

  // ── COMERCIAL: bajo_benchmark · carga_alta · carga_sobre_resto — descomposicionDeBrecha es LA fuente oficial
  // (specRetrieval.js, la misma que usa `datoProyectado.js:conjuntos["carga comercial alta"]`) ──
  let D = null;
  try { D = descomposicionDeBrecha(scenario); } catch { D = null; }
  let prTop = null;
  let figsComercial = [];
  // ⚠️ CADA PROBE INTERNO USA SU PROPIA PREGUNTA CANÓNICA, NUNCA LA DEL TURNO (owner-adjacent, medido
  // construyendo esta tabla: con la pregunta del turno —ej. la del encargo multidominio— los playbooks de
  // cobranza/inventario no reconocen su dominio y devuelven cero figs). La tabla de señales es una proyección
  // AMPLIA del tenant entero, no un recorte por lo que el usuario preguntó — eso lo decide la pertinencia, no
  // esta construcción. `pregunta` (el parámetro de esta función) solo alimenta `tabla.pregunta` (tema/métrica).
  const _PREG_COMERCIAL = "¿dónde estoy perdiendo plata?", _PREG_COBRANZA = "¿quién me debe más?", _PREG_INVENTARIO = "¿tengo demasiado inventario?";
  try {
    const pasos = pasosDe(margenEnRiesgo, _PREG_COMERCIAL);
    const r = _correrPasos(pasos, { scenario, pregunta: _PREG_COMERCIAL });
    figsComercial = r.figs;
    const pr = prioridadDe(figsComercial);
    prTop = pr && pr.top ? pr.top.entidad : null;
  } catch { prTop = null; }

  if (D && Array.isArray(D.filas)) {
    const cargasValidas = D.filas.filter((f) => typeof f.carga === "number");
    for (const f of D.filas) {
      const otras = cargasValidas.filter((x) => x.entidad !== f.entidad);
      const promedioResto = otras.length ? otras.reduce((s, x) => s + x.carga, 0) / otras.length : null;
      cuentas[f.entidad] = {
        bajoBenchmark: !!f.bajoBenchmark,
        cargaAlta: !!f.cargaMaterial,
        cargaPct: typeof f.carga === "number" ? f.carga : null,
        cargaSobreResto: (typeof f.carga === "number" && promedioResto != null) ? f.carga > promedioResto : null,
        cargaPromedioResto: promedioResto,
        venta: typeof f.venta === "number" ? f.venta : null,
        vencidoPositivo: null, alDia: null, vencido: null,
        variacionVenta: "sin_serie",
        enRespuesta: nombradas.has(f.entidad),
        prioridadPrimera: prTop != null && prTop === f.entidad,
      };
    }
  }

  // ── COBRANZA: vencido_positivo / al_dia (notario/estados.js: "al día" = saldo vencido 0) ──
  // La boleta que vería el agente (capada a 8 filas — se conserva TAL CUAL, no se toca `herramientasAgente.js`).
  let figsCobranza = [];
  try {
    const pasosC = pasosDe(cobranza, _PREG_COBRANZA);
    const rC = _correrPasos(pasosC, { scenario, pregunta: _PREG_COBRANZA });
    figsCobranza = rC.figs;
  } catch { /* sin boleta de cobranza en este pack */ }

  // ═══ EL LIBRO EVALUABLE COMPLETO (owner 2026-09-23, PRI-04 — corrección: «el tope de 8 rompe la regla 2
  // sellada») — evidencia INTERNA de esta capa, nunca lo que el agente narra. `_figsCobranzaCompleta` trae las
  // 13 cuentas del demo (no las 8 de la boleta), de la MISMA fuente (`buildMesaFlujo`) y con el MISMO
  // formateador de fig — «una sola verdad por eje», nunca dos caminos que puedan divergir. ═══
  let figsCobranzaCompleta = [], universoCobranzaTotal = 0;
  try {
    const R = _figsCobranzaCompleta(scenario);
    figsCobranzaCompleta = R.figs; universoCobranzaTotal = R.totalClientes;
    for (const f of _all(figsCobranzaCompleta, /· Saldo pendiente$/i)) {
      const e = _entidadDe(_lab(f)); if (!e) continue;
      const v = _num(f);
      if (!cuentas[e]) cuentas[e] = { bajoBenchmark: null, cargaAlta: null, cargaPct: null, cargaSobreResto: null, cargaPromedioResto: null, venta: null, variacionVenta: "sin_serie", enRespuesta: nombradas.has(e), prioridadPrimera: false };
      cuentas[e].saldoPendiente = Number.isFinite(v) ? v : null;
      if (cuentas[e].tienePlazoDeclarado === undefined) cuentas[e].tienePlazoDeclarado = false;   // sin fig de vencido todavía: por defecto "sin plazo" — la pasada de abajo lo corrige a `true` si corresponde
    }
    // «· Saldo vencido» ahora se publica SIEMPRE que hay plazo declarado (con o sin monto — ver la cabecera de
    // `_figsCobranzaCompleta`): su presencia sola decide "tiene plazo", sin ambigüedad y sin cruzar nada más.
    for (const f of _all(figsCobranzaCompleta, /· Saldo vencido$/i)) {
      const e = _entidadDe(_lab(f)); if (!e) continue;
      const v = _num(f);
      if (!cuentas[e]) cuentas[e] = { bajoBenchmark: null, cargaAlta: null, cargaPct: null, cargaSobreResto: null, cargaPromedioResto: null, venta: null, variacionVenta: "sin_serie", enRespuesta: nombradas.has(e), prioridadPrimera: false };
      cuentas[e].vencido = Number.isFinite(v) ? v : null;
      cuentas[e].vencidoPositivo = Number.isFinite(v) ? v > 0 : null;
      cuentas[e].alDia = Number.isFinite(v) ? v === 0 : null;
      cuentas[e].tienePlazoDeclarado = true;
    }
  } catch { /* sin flujo comercial en este pack: los campos de cobranza quedan null, honestos */ }

  // ── VARIACIÓN DE VENTA — se busca la fig "· Variación" (si el motor la publica para este eje) sobre la MISMA
  // boleta comercial de arriba; sin ella, el predicado declara "sin_serie" (nunca se inventa un signo) ──
  try {
    for (const f of _all(figsComercial, /· Variaci[oó]n$/i)) {
      const e = _entidadDe(_lab(f)); if (!e || !cuentas[e]) continue;
      const v = _num(f);
      cuentas[e].variacionVenta = Number.isFinite(v) ? (v < 0 ? "neg" : v > 0 ? "pos" : "sin_serie") : "sin_serie";
    }
  } catch { /* sin fig de variación: queda "sin_serie" para todas — declarado, no inventado */ }

  // ── INVENTARIO: sku.frenado / sku.top_seller — el MISMO cruce que ya certifica crucePorSku.js (`stock` es la
  // clave que separa un SKU de una entidad de otro eje, igual que ese playbook) ──
  let figsInv = [], figsTop = [];
  try {
    const rInv = _correrPasos(pasosDe(inventarioInmovilizado, _PREG_INVENTARIO), { scenario, pregunta: _PREG_INVENTARIO });
    figsInv = rInv.figs;
    const bodegas = new Set((() => { try { return axisEntityNames("bodega") || []; } catch { return []; } })());
    for (const f of _all(figsInv, /· Capital frenado$/i)) {
      const e = _entidadDe(_lab(f)); if (!e || bodegas.has(e)) continue;
      if (!skus[e]) skus[e] = { frenado: false, topSeller: null, estado: null };
      skus[e].frenado = true;
    }
  } catch { /* sin boleta de inventario en este pack */ }
  try {
    const rTop = _correrPasos([{ tool: "inventoryStatus", args: { focus: "top_sellers" } }], { scenario, pregunta: _PREG_INVENTARIO });
    figsTop = rTop.figs;
    const stock = new Set(_all(figsTop, /· Stock$/i).map((f) => _entidadDe(_lab(f))).filter(Boolean));
    for (const f of _all(figsTop, /· Venta$/i)) {
      const e = _entidadDe(_lab(f)); if (!e || !stock.has(e)) continue;   // solo SKU (clave: trae fig de Stock, igual que crucePorSku.js)
      if (!skus[e]) skus[e] = { frenado: false, topSeller: null, estado: null };
      skus[e].topSeller = true;
    }
    // los SKU con stock pero sin fig de Venta en este top: no son top seller (dato disponible, veredicto false)
    for (const e of stock) { if (skus[e] && skus[e].topSeller == null) skus[e].topSeller = false; }
    // `inventoryStatus{focus:"top_sellers"}` es un TOP-N (medido: 5 de 13 SKU en el demo), no la lista completa
    // de ventas — el mismo criterio que ya usa `crucePorSku.js`: un SKU que no aparece en "los que más venden"
    // NO está entre los que más venden (`false`, no `null`). Se aplica a CUALQUIER SKU ya conocido por esta
    // tabla (ej. un SKU frenado que no salió en el top), para que `sku.top_seller` decida en vez de quedar
    // indeterminado solo por no estar en el top-N.
    for (const e of Object.keys(skus)) { if (skus[e].topSeller == null) skus[e].topSeller = false; }
  } catch { /* sin cruce de top sellers en este pack */ }

  // ── PERÍODO — el mismo campo que ya declara el Marco de la Entrega (figureType.periodoDeFiguras); "abierto"
  // es cualquier tipo que NO sea "cerrado" (año cerrado). ⚠️ MEDIDO: `margenEnRiesgo` corre marginRead + diagnose,
  // y `diagnose` barre TODOS los detectores del turno — incluido capital inmovilizado, universo "hoy" — el MISMO
  // hueco que `componer.js` ya declara y resuelve para su propio Marco («declarar el período sobre `figs` entera
  // contaminaba el marco... el período se declara sobre lo que el texto usa», línea ~218 de ese archivo). Acá se
  // aplica la MISMA solución: el período se lee solo sobre las figs de CONCEPTO comercial (Venta/Margen/
  // Contribución no capturada/Carga comercial alta), nunca sobre la boleta cruda completa. ──
  let periodoAbierto = null;
  try {
    const figsSoloComerciales = _all(figsComercial, /· (?:Venta|Margen|Contribuci[oó]n no capturada|Carga comercial alta)$/i);
    const { familias } = periodoDeFiguras(figsSoloComerciales);
    if (familias && familias.length) periodoAbierto = !(familias.length === 1 && familias[0] === "anual");
  } catch { periodoAbierto = null; }

  // ── EL ÍNDICE DE EVIDENCIA — UN SOLO índice, sobre la UNIÓN de las cuatro boletas que ya se corrieron arriba
  // (owner, corrección del 2026-09-23: «ningún dígito lo escribe la capa» — `medir.js` YA NO arma su propio
  // mini-libro; declara hechos `cifra`/`razon` de verdad y los hace verificar acá, con `notario/hechos.js`, el
  // MISMO módulo que ya verifica cada cifra de `src/adi/entrega/componer.js`). Mismo patrón que
  // `componer.js:_indiceDelTenant`: la unión de figs + `cifrasDelDato` (conjuntos/rankings — de ahí sale la
  // proyección «ranking cliente · carga · Lider» cuando ninguna boleta trae una fig literal de carga %) +
  // `axisEntityNames` por eje. ── */
  const ejesDelTenant = {};
  for (const eje of _EJES) { try { const n = axisEntityNames(eje); if (n && n.length) ejesDelTenant[eje] = n; } catch { /* eje sin índice en este tenant */ } }
  // ★ PRI-04 (owner 2026-09-23, corrección) · el índice de evidencia se arma con `figsCobranzaCompleta` (el
  // libro evaluable ENTERO), no con `figsCobranza` (la boleta capada a 8 que vería el agente) — así toda
  // participación/derivada que declare esta capa verifica sobre el universo COMPLETO (regla 2 del sello).
  const figsUnion = asignarIds([...figsComercial, ...figsCobranzaCompleta, ...figsInv, ...figsTop], "u");
  let indice = null;
  try { indice = indiceDeEvidencia({ figs: figsUnion, datoProyectado: cifrasDelDato(scenario), ejesDelTenant }); } catch { indice = null; }

  return {
    cuentas, skus,
    periodo: { abierto: periodoAbierto },
    pregunta: _preguntaDeLaTabla(pregunta),
    _scenario: scenario,
    // el índice de evidencia compartido — `medir.js` declara sus hechos `cifra`/`razon` sobre ESTE índice y los
    // verifica con `libroDeHechos` (notario/hechos.js), nunca calculándolos por su cuenta.
    _indice: indice,
    // el TOTAL de clientes con venta a crédito que `buildMesaFlujo` conoce (la fuente, sin ningún tope) — la
    // vara con la que `coberturaPisoDeCobranza` (medir.js) comprueba que no está afirmando más de lo que esta
    // evidencia pudo verificar (regla B del owner: «la cobertura nunca puede afirmar más de lo que vio»). Una
    // cartera de prueba autónoma (sin `buildMesaFlujo` real detrás) no lo declara, y eso es correcto: no hay
    // fuente externa con la que contrastar.
    _universoCobranza: universoCobranzaTotal || null,
    // las boletas crudas, por si algún cálculo necesita buscar una fig puntual (ej. citar el `ref` exacto de un
    // SKU en el top de ventas) — `medir.js` las usa solo para eso, nunca para leer un número sin verificar.
    // `cobranza` sigue siendo la boleta CAPADA (lo que ve el agente); `cobranzaCompleta` es la nueva, sin tope.
    _figs: { comercial: figsComercial, cobranza: figsCobranza, cobranzaCompleta: figsCobranzaCompleta, inventarioFrenado: figsInv, inventarioTop: figsTop, union: figsUnion },
  };
}
