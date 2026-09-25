/* === src/adi/encargo/lecturasDe.js · DEL ENCARGO A LAS LECTURAS DEL CORE (Etapa 1 · Corte 3a · owner 2026-09-25)
 * ══════════════════════════════════════════════════════════════════════════════════════════════════════════════
 * `_ADI_CONTRATO_ENCARGO_V1.md` es el contrato; `validar.js` produce la `Resolucion` (Corte 1). Este archivo hace
 * el paso siguiente: `lecturasDe(resolucion) → { plan, porParte }` — un PLAN determinístico de llamadas a las
 * tools del Core (`oracle/toolRegistry.js`, ejecutadas después con `oracle/toolRunner.js:runPlan`), por parte,
 * según (tema × cierre × conceptos × entidades × eje × universo × período × criterio × supuestos). QUÉ NO decide
 * este archivo: la CONCLUSIÓN (eso es de `prioridadIntegrada`/los composers/la Entrega, etapas siguientes) — acá
 * solo se decide QUÉ LECTURAS CORREN.
 *
 * LA LEY QUE OBEDECE (contrato §0, memoria `adi-no-desviarse-deterministico`): cero lectura de
 * `resolucion.encargo.preguntaOriginal`. Lo único que se lee del encargo crudo (`resolucion.encargo.partes`) son
 * los DOS campos estructurados que `validarEncargo` no reproyecta en `ParteResuelta` — `Parte.concepto` (el único
 * concepto de una `definicion`) y `Parte.supuestos` (los ids que una `simulacion` cita) — nunca `preguntaOriginal`
 * ni `Supuesto.cita`. Cero `cuandoAplica`: los disparadores léxicos de los playbooks (`agente/playbooks/registro.js`)
 * NO se usan acá — un playbook se activa por FRASE, y este archivo decide por FORMA (la `Resolucion` tipada).
 *
 * REUSA SIN COPIAR:
 *   · `agente/contratoComercial.js:pasosDelContratoComercial` — las cinco lecturas cuando el tema es comercial.
 *   · `agente/contratoDeDominios.js:pasosDeDominios` — YA recibe `{ dominios, eje }` objetos (nunca texto): es la
 *     pieza que este corte más aprovecha, porque ya compone comercial+inventario+cobranza sin leer una frase.
 *   · `agente/prioridadIntegrada.js` — NO se llama acá (opera sobre `figs` ya leídas, en la etapa de composición);
 *     el cierre `decision` corre las MISMAS lecturas que `lectura` para sus temas — es lo que `prioridadIntegrada`
 *     necesita para poder leer las señales después.
 *   · `oracle/toolRegistry.js:compareEntities` — el cierre `comparacion`.
 *   · `oracle/toolRegistry.js:simulate{General,Carga,Capital,Costo}` — el cierre `simulacion`, con el `productor`
 *     que ya resolvió `validar.js` (`Resolucion.supuestos[].productor`, contrato §3.5): este archivo NUNCA vuelve
 *     a decidir el productor, solo arma los args de la tool que `validar.js` ya nombró.
 *   · `agente/herramientasAgente.js:cobranza` (mesaFlujo) — el productor de cobranza en TODOS los cierres: no vive
 *     en `oracle/toolRegistry.js:TOOLS` (esa caja es la del oráculo puro); vive en la caja EXTENDIDA del agente
 *     (`cajaDelAgente`), la misma que ya usa `contratoDeDominios.js:_PASOS_COBRANZA`. `REGISTRO_LECTURAS` de acá
 *     es esa caja — hay que pasarla a `runPlan(plan, { registry: REGISTRO_LECTURAS })`, si no, `cobranza` sale
 *     "tool desconocida".
 *
 * LOS PLAYBOOKS DE `agente/playbooks/*` (margenEnRiesgo, etc.) NO se importan acá. Se investigó: sus `pasos` son
 * subconjuntos de lo que YA corre `pasosDelContratoComercial()` (margenEnRiesgo: marginRead(bajo_benchmark) +
 * diagnose() — las DOS primeras de las cinco del contrato comercial) o de `pasosDeDominios` (cobranza, lecturaPorEje)
 * — nada de lo que un playbook trae por FORMA (`pasosDe(playbook, pregunta)`, que hoy recibe la pregunta en TEXTO
 * para decidir el EJE de "lectura por eje") es necesario acá: el eje de una `Parte` YA es un campo tipado
 * (`ParteResuelta.eje`), así que la decisión que `pasosDe` tomaría leyendo la frase la toma acá leyendo el campo.
 * Si una etapa futura necesita un playbook que compone algo que ni `pasosDelContratoComercial` ni `pasosDeDominios`
 * cubren, la extensión pedida por el encargo es la de la cabecera del corte: una entrada NUEVA en ese playbook que
 * reciba la `Parte`/`Resolucion` en vez de `pregunta` — aditiva, sin tocar `pasos` (función de texto) que sigue
 * sirviendo al camino natural mientras exista. Hoy no hace falta: se deja escrito para la próxima vez que sí.
 *
 * PURO frente al ENCARGO (nunca lee `preguntaOriginal`/`.cita`) pero NO offline-puro frente al TENANT: como
 * `pasosDeDominios` (que ya lee `getTenantData()` para saber si el tenant trae inventario/cobranza/serie con
 * unidades), este archivo hereda esa dependencia — determinístico por tenant + versión de datos, igual que
 * `validarEncargo`. Nada de red, nada de LLM, nada de Math.random ni Date.now().
 *
 * `lecturasDe(resolucion) → { plan: { intent, calls: [{tool,args}] }, porParte: { [parteId]: [{tool,args,para}] } }`
 *   `plan` es lo que se le pasa a `runPlan` (con `registry: REGISTRO_LECTURAS`, más abajo). `porParte` es la traza:
 *   qué llamadas sirven a qué parte (las de `lectura`/`decision` se ATRIBUYEN por tool → tema, `_temaDeCall`, best
 *   effort de trazabilidad — no es una segunda validación de negocio, ver su comentario). */
import { TOOLS } from "../oracle/toolRegistry.js";
import { cajaDelAgente } from "../agente/herramientasAgente.js";
/* `pasosDelContratoComercial` NO se importa directo: `pasosDeDominios` (abajo) ya la llama por dentro cuando el
 * tema comercial participa sin eje explícito — importarla acá sería una segunda invocación que nadie usa. */
import { pasosDeDominios } from "../agente/contratoDeDominios.js";
import { sujetoDeTema, metricaCoreDe } from "./esquema.js";

/* LA CAJA EXTENDIDA (owner 2026-08-30, F2 · ADI Agente): `cobranza` y `rolesCartera` —las dos que
 * `pasosDelContratoComercial`/`pasosDeDominios` ya citan por nombre— viven en `cajaDelAgente`, no en `TOOLS` del
 * oráculo puro. Se exporta para que el LLAMADOR (el gate, y más adelante `entrega/componer.js`) pase SIEMPRE este
 * registro a `runPlan`, nunca `TOOLS` a secas — si no, esas dos tools salen "desconocida" y el plan degrada honesto
 * pero incompleto. */
export const REGISTRO_LECTURAS = cajaDelAgente(TOOLS);

/* ── conceptos SIN fuente declarativa en `metricRegistry.js` (contrato §3.3, la tabla residual de `esquema.js`):
 * cada familia tiene UN productor fijo, sea cual sea el eje que le llegue (el eje lo filtra `validar.js` — acá ya
 * llegó validado). El orden de estas listas es el de la tabla del contrato, no arbitrario. ─────────────────────── */
const _FAM_DIAGNOSE = new Set(["no_capturada", "carga_alta", "brecha", "brecha_precio_costo"]);
const _FAM_CAPITAL_FRENADO = new Set(["capital_frenado", "capital_inmovilizado", "dias_sin_venta", "margen_inventario"]);
/* markup/peso_costo NO tienen familia acá (corrección del contraste, `esquema.js:_PRODUCTOR_RESIDUAL`, con
 * evidencia): `specRetrieval.js` calcula esos dos valores pero nunca los publica como `fig()` — ni `marginRead`
 * ni `entityRecord` traen una cifra autorizada que citar. `ejesConProductor("markup"|"peso_costo") === []` en
 * TODOS los ejes, así que `validar.js` ya nunca deja esas claves en `ParteResuelta.conceptos` — este archivo no
 * necesita una rama que jamás se alcanza. Si `specRetrieval.js` llega a publicar el fig, la corrección es la
 * inversa: reabrir la fila en `esquema.js` y agregar la familia acá. */
const _FAM_VS_ANTERIOR = new Set(["variacion", "variacion_usd", "ventas_anterior"]);
const _FAM_VS_PRESUPUESTO = new Set(["vs_presupuesto", "vs_presupuesto_usd"]);
const _FAM_COBRANZA = new Set(["venta_credito", "saldo_vencido", "saldo_pendiente", "saldo_por_vencer", "abonado", "recuperado", "dias_vencido"]);

/** la llamada (o llamadas) que sirve UN concepto por UN eje, group-by, sin entidad puntual (contrato §3.3). */
function _callsDeConceptoEje(tema, concepto, eje) {
  if (tema === "cobranza" || _FAM_COBRANZA.has(concepto)) {
    return [{ tool: "cobranza", args: {}, para: `${concepto} de la cartera de cobranza (mesaFlujo, la misma mesa que la pestaña)` }];
  }
  if (_FAM_DIAGNOSE.has(concepto)) {
    return [{ tool: "diagnose", args: {}, para: `${concepto} — el detector de brecha comercial, por cliente (contrato §3.3)` }];
  }
  if (_FAM_CAPITAL_FRENADO.has(concepto)) {
    return [{ tool: "inventoryStatus", args: { focus: "frenado" }, para: `${concepto} — capital frenado por ${eje} (mesaCapital)` }];
  }
  if (_FAM_VS_ANTERIOR.has(concepto)) {
    return [{ tool: "salesRead", args: { focus: "vs_anterior", dimension: eje }, para: `${concepto} por ${eje} (salesRead vs_anterior)` }];
  }
  if (_FAM_VS_PRESUPUESTO.has(concepto)) {
    return [{ tool: "salesRead", args: { focus: "vs_presupuesto", dimension: eje }, para: `${concepto} por ${eje} (salesRead vs_presupuesto)` }];
  }
  const metrica = metricaCoreDe(concepto) || concepto;
  return [{ tool: "queryMetric", args: { metric: metrica, dimension: eje }, para: `${concepto} por ${eje} (METRICS.${metrica})` }];
}

/* ── cierre `cifra` (contrato §1.1: productor `queryMetric / entityRecord / gridTable / mesaFlujo / mesaCapital`) */
function _pasosCifra(p) {
  const eje = p.eje;
  if (p.tema === "cobranza") {
    // mesaFlujo es SIEMPRE por cliente (contrato §3.3): una entidad puntual o la cartera entera pasan por la
    // MISMA tool — la fila de un cliente puntual la recorta la Entrega, no una segunda llamada.
    const quien = p.entidades.length ? p.entidades.map((e) => e.nombre).join(", ") : "la cartera";
    return [{ tool: "cobranza", args: {}, para: `cobranza de ${quien} (mesaFlujo)` }];
  }
  if (p.entidades.length) {
    // LA FILA COMPLETA de cada entidad (entityRecord: "TODAS sus columnas reales del dato") — cubre de sobra
    // cualquier concepto puntual de comercial/inventario que la parte haya pedido, sin adivinar cuál.
    return p.entidades.map((e) => ({ tool: "entityRecord", args: { dimension: e.eje, entity: e.nombre }, para: `la fila completa de ${e.nombre} (entityRecord)` }));
  }
  if (p.universo && p.universo.top && p.universo.top.metrica) {
    const { metrica, k, direccion } = p.universo.top;
    const ejeUniverso = p.universo.eje || eje;
    const out = [{ tool: "queryMetric", args: { metric: metricaCoreDe(metrica) || metrica, dimension: ejeUniverso, sort: direccion === "menor" ? "asc" : "desc", limit: k }, para: `el top ${k} de ${ejeUniverso} por ${metrica} (universo.top)` }];
    // los OTROS conceptos de la parte, por el mismo eje SIN recorte: la Entrega selecciona de ahí las filas del
    // top ya fijado arriba — dos rankings por separado, nunca una segunda decisión de universo.
    for (const c of p.conceptos) { if (c === metrica) continue; out.push(..._callsDeConceptoEje(p.tema, c, ejeUniverso)); }
    return _dedupeCalls(out);
  }
  if (p.universo && Array.isArray(p.universo.filtros) && p.universo.filtros.length) {
    const out = [];
    for (const f of p.universo.filtros) {
      const ref = f && (f.ref || f.metrica);
      if (ref === "nivel_carga" || f.metrica === "carga") out.push({ tool: "diagnose", args: {}, para: "el universo sobre el nivel de carga — mismo detector que lo declaró (contrato §3.3)" });
      else if (ref === "benchmark" || f.metrica === "margen") out.push({ tool: "marginRead", args: { focus: "bajo_benchmark", dimension: "cliente" }, para: "el universo bajo el benchmark — mismo detector que lo declaró (contrato §3.3)" });
    }
    for (const c of p.conceptos) out.push(..._callsDeConceptoEje(p.tema, c, p.universo.eje || eje));
    return _dedupeCalls(out);
  }
  // group-by listing: eje sin entidades ni universo — un concepto, una o más llamadas.
  const out = [];
  for (const c of p.conceptos) out.push(..._callsDeConceptoEje(p.tema, c, eje));
  return _dedupeCalls(out);
}

/* ── cierre `comparacion` (contrato §1.1: EXACTAMENTE 2 entidades del MISMO eje → `compareEntities`) ──────────── */
function _pasosComparacion(p) {
  if (p.entidades.length !== 2 || p.entidades[0].eje !== p.entidades[1].eje) return [];
  return [{ tool: "compareEntities", args: { dimension: p.entidades[0].eje, entities: p.entidades.map((e) => e.nombre) }, para: `comparación ${p.entidades.map((e) => e.nombre).join(" vs ")}` }];
}

/* ── cierre `simulacion` (contrato §3.5: el PRODUCTOR ya lo resolvió `validar.js`, acá solo se arman los args) ─── */
function _callDeSupuesto(s) {
  const alcance = s.alcance;
  const esNegocio = alcance === "negocio";
  const nombre = esNegocio ? null : (alcance && alcance.nombre) || null;
  const ejeAlcance = esNegocio ? null : (alcance && alcance.eje) || null;
  const entityScope = nombre ? [nombre] : null;
  if (s.productor === "simulateGeneral") {
    // simulateGeneral exige DOS variables de rol distinto (precio · volumen), cada una con su delta — contrato
    // §3.5: "price" mueve precio, "growth" mueve volumen; la variable que el supuesto NO trae viaja en 0 (el
    // usuario no declaró ese movimiento, así que su delta es cero, nunca inferido de otra cifra).
    const variableA = { campo: "precioLista", delta_pct: s.tipo === "price" ? s.valor : 0 };
    const variableB = { campo: "unidades", delta_pct: s.tipo === "growth" ? s.valor : 0 };
    return { tool: "simulateGeneral", args: { dimension: ejeAlcance, entity: nombre, variableA, variableB }, para: `simulación ${s.tipo} (${s.valor}${s.unidad}) sobre ${nombre || "el negocio"} (simulateGeneral)` };
  }
  if (s.productor === "simulateCarga") {
    return { tool: "simulateCarga", args: { entityScope, delta_pp: s.valor }, para: `simulación de carga (${s.valor}pp) sobre ${nombre || "la cartera"} (simulateCarga)` };
  }
  if (s.productor === "simulateCapital") {
    return { tool: "simulateCapital", args: { entityScope }, para: `liberar el capital frenado de ${nombre || "el SKU"} (simulateCapital)` };
  }
  if (s.productor === "simulateCosto") {
    // scope:"all" — el supuesto apunta a UNA entidad puntual (entityScope); el filtro "bajo_benchmark" de
    // simulateCosto es del modo SIN entidad (mover el costo de todo el eje bajo la vara) y la excluiría si ya
    // está sobre el benchmark, que no es la pregunta que el supuesto puntual hace.
    return { tool: "simulateCosto", args: { dimension: ejeAlcance, entityScope, pct: s.valor, scope: "all" }, para: `simulación de costo (${s.valor}%) sobre ${nombre || "el eje"} (simulateCosto)` };
  }
  return null;
}
function _pasosSimulacion(p, supuestosResueltos, citadosPorParte) {
  const citados = citadosPorParte.get(p.id) || [];
  const out = [];
  for (const sid of citados) {
    const s = (supuestosResueltos || []).find((x) => x.id === sid);
    if (!s) continue;   // el gate del corte 1 ya lo declara en noResuelto; acá simplemente no hay llamada que armar
    const call = _callDeSupuesto(s);
    if (call) out.push(call);
  }
  return out;
}

/* ── cierre `definicion` (contrato §1.1: exige `concepto`, prohíbe cifras — `defineConcept` nunca lee la boleta) */
function _pasosDefinicion(p, conceptoPorParte) {
  const concepto = conceptoPorParte.get(p.id);
  if (!concepto) return [];
  return [{ tool: "defineConcept", args: { concept: concepto }, para: `definición de ${concepto} (defineConcept)` }];
}

/* ── cierres `lectura` y `decision` (contrato §1.1: `decision` corre lo que `prioridadIntegrada` necesita LEER
 * después — las MISMAS lecturas que `lectura` para sus temas; `prioridadIntegrada` no se llama acá, opera sobre
 * los `figs` que estas llamadas van a producir, en la etapa de composición). Se agrupan TODAS las partes con
 * estos dos cierres de una vez (mismo criterio que `pasosDeDominios`: el `multi` de dos temas juntos trae MÁS
 * pasos que la suma de cada uno por separado — `_INV_CRUCE`, `_COM_POR_EJE` bajo `multi`) — es la pieza que este
 * corte reusa completa, sin copiar una línea de su cuerpo. */
function _pasosLecturaDecision(partes) {
  if (!partes.length) return [];
  const dominios = [...new Set(partes.map((p) => p.tema))];
  // el primer eje EXPLÍCITO (≠ el sujeto por defecto del tema) entre estas partes — el mismo campo que ya resolvió
  // `validar.js` en `ParteResuelta.eje`; nunca se relee una frase para encontrarlo.
  let eje = null;
  for (const p of partes) { if (p.eje && p.eje !== sujetoDeTema(p.tema)) { eje = p.eje; break; } }
  let out = pasosDeDominios({ dominios, eje });
  // LA GRIETA DE UN SOLO TEMA CON EJE EXPLÍCITO (documentada, corte 3a): `pasosDeDominios` solo agrega la lectura
  // comercial POR EJE (`_COM_POR_EJE`) cuando participan DOS o más dominios (`multi`); con un único tema comercial
  // y un eje explícito (p. ej. "el margen por marca", sin que inventario/cobranza participen) devuelve `[]` para
  // esa parte. Ningún caso del catálogo de desarrollo lo ejercita hoy (D20 es de dos temas), así que se documenta
  // en vez de tocar `contratoDeDominios.js` sin un caso que lo pida: si aparece, cae acá, por concepto y eje —
  // mismo camino que el group-by de `cifra`, para no inventar una segunda regla de composición.
  if (!out.length && dominios.length === 1 && eje) {
    const conceptos = new Set(partes.flatMap((p) => p.conceptos || []));
    for (const c of conceptos) out.push(..._callsDeConceptoEje(dominios[0], c, eje));
  }
  return out;
}

/* la clasificación tool→tema es de TRAZABILIDAD (`porParte`), no una segunda validación de negocio: si una tool
 * sirve dos temas (queryMetric), se distingue por la métrica pedida. Nunca se usa para decidir QUÉ corre — eso ya
 * lo decidió `pasosDeDominios`/`pasosDelContratoComercial` arriba. */
const _TOOLS_COBRANZA = new Set(["cobranza"]);
const _TOOLS_INVENTARIO = new Set(["inventoryStatus", "tensionRead"]);
const _TOOLS_COMERCIAL = new Set(["salesRead", "marginRead", "contributionRead", "diagnose", "rolesCartera", "trend"]);
const _METRICAS_INVENTARIO = new Set(["capital", "doh", "stock", "rotacion"]);
function _temaDeCall(call) {
  const tool = call && call.tool;
  if (_TOOLS_COBRANZA.has(tool)) return "cobranza";
  if (_TOOLS_INVENTARIO.has(tool)) return "inventario";
  if (_TOOLS_COMERCIAL.has(tool)) return "comercial";
  if (tool === "queryMetric") return _METRICAS_INVENTARIO.has(call.args && call.args.metric) ? "inventario" : "comercial";
  return null;
}

/* dedupe EXACTO (tool + args, byte a byte vía JSON): dos llamadas iguales colapsan en una — nunca dos llamadas
 * DISTINTAS con el mismo nombre de tool (dos `queryMetric` con distinto `metric`/`dimension` son dos lecturas). */
function _dedupeCalls(calls) {
  const vistos = new Set();
  const out = [];
  for (const c of calls) {
    if (!c || !c.tool) continue;
    const clave = JSON.stringify({ tool: c.tool, args: c.args || {} });
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    out.push(c);
  }
  return out;
}

/** lecturasDe(resolucion) → { plan, porParte }. Puro frente al encargo (nunca lee `preguntaOriginal`); hereda de
 *  `pasosDeDominios` la dependencia del TENANT activo (no de la red, no del LLM) — ver cabecera. */
export function lecturasDe(resolucion) {
  if (!resolucion || !Array.isArray(resolucion.partes)) return { plan: { intent: "encargo", calls: [] }, porParte: {} };

  const partesCrudas = (resolucion.encargo && Array.isArray(resolucion.encargo.partes)) ? resolucion.encargo.partes : [];
  const conceptoPorParte = new Map();     // Parte.concepto (SOLO `definicion`) — no viaja en ParteResuelta
  const citadosPorParte = new Map();      // Parte.supuestos (SOLO `simulacion`) — no viaja en ParteResuelta
  for (const cruda of partesCrudas) {
    if (!cruda || typeof cruda !== "object" || !cruda.id) continue;
    if (typeof cruda.concepto === "string") conceptoPorParte.set(cruda.id, cruda.concepto);
    if (Array.isArray(cruda.supuestos)) citadosPorParte.set(cruda.id, cruda.supuestos.filter((x) => typeof x === "string"));
  }

  const porParte = {};
  const sueltas = [];          // llamadas de cifra/comparacion/simulacion/definicion — una parte, sus llamadas
  const partesLecturaDecision = [];   // se agrupan al final (ver _pasosLecturaDecision)

  for (const p of resolucion.partes) {
    if (!p || p.estado === "no_resuelta") { if (p) porParte[p.id] = []; continue; }
    if (p.cierre === "cifra") { const c = _pasosCifra(p); porParte[p.id] = c; sueltas.push(...c); }
    else if (p.cierre === "comparacion") { const c = _pasosComparacion(p); porParte[p.id] = c; sueltas.push(...c); }
    else if (p.cierre === "simulacion") { const c = _pasosSimulacion(p, resolucion.supuestos, citadosPorParte); porParte[p.id] = c; sueltas.push(...c); }
    else if (p.cierre === "definicion") { const c = _pasosDefinicion(p, conceptoPorParte); porParte[p.id] = c; sueltas.push(...c); }
    else { partesLecturaDecision.push(p); }   // "lectura" | "decision": se agrupan
  }

  const lecturaCalls = _pasosLecturaDecision(partesLecturaDecision);
  for (const p of partesLecturaDecision) porParte[p.id] = lecturaCalls.filter((c) => _temaDeCall(c) === p.tema);

  const todas = _dedupeCalls([...lecturaCalls, ...sueltas]);
  return {
    plan: { intent: "encargo", calls: todas.map(({ tool, args }) => ({ tool, args: args || {} })) },
    porParte,
  };
}
