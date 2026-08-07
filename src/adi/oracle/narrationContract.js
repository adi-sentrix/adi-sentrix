/* === src/adi/oracle/narrationContract.js · CONTRATO v2 · FASE 1 · EL SELLADO ===
 * (owner 2026-08-07, tras la revisión de arquitectura del Contrato de Intención y Alcance)
 *
 * EL PROBLEMA QUE RESUELVE. Hasta acá el invariante "el LLM no puede modificar entidades/métricas/períodos/
 * supuestos después de que el motor los valide" NO era validar-y-congelar: era coercionar-antes (answerViaOracle
 * pisa los args del plan) + guardar-después (guardC revisa el TEXTO ya narrado). En el medio, NARRAR recibía el
 * plan completo + los results crudos y redactaba libre. El muro de guardC es sólido para el VALOR numérico (su
 * canon es `unit:value`), pero NO para la SEMÁNTICA que lo envuelve: qué métrica, qué entidad, qué período, si es
 * supuesto o hecho. Esta sesión lo probó tres veces con cifras REALES en oraciones equivocadas (superlativo falso
 * de familia, capital atribuido al cliente en vez de al inventario, exceso de acciones comerciales confundido con
 * la brecha total) — ninguna la detectó guardC; las tres necesitaron doctrina o backstop determinístico.
 *
 * LA IDEA. La unidad de autorización deja de ser LA CIFRA y pasa a ser LA AFIRMACIÓN (claim):
 * (entidad, eje, métrica, período, unidad, valor, estatus epistémico). El motor SELLA un contrato inmutable y
 * NARRAR redacta SOLO sobre lo sellado — no porque el prompt se lo pida, sino porque no recibe otra cosa.
 *
 * FRONTERA (regla de oro del contrato v2): el LLM comprende y PROPONE; el motor canonicaliza, valida, CONGELA,
 * calcula y autoriza; el LLM narra SOLO sobre lo congelado; el guard valida valor Y binding semántico.
 *
 * QUÉ GARANTIZA ESTE MÓDULO (Fase 1, determinístico y verificable):
 *   · el contrato es INMUTABLE (deep-freeze real, no convención) — nadie río abajo puede mutarlo;
 *   · el payload de NARRAR es una PROYECCIÓN PURA del contrato (projectNarratePayload solo lee el contrato,
 *     nunca `plan` ni `results`) — la garantía es ESTRUCTURAL, no doctrinal;
 *   · cada claim lleva su estatus epistémico (probado | indicado | abierto) derivado del dato, no del prompt;
 *   · las RELACIONES entre claims (comparable/derivada/parte-de) se declaran explícitas: qué se puede comparar
 *     con qué es una decisión del motor, no una inferencia del narrador.
 *
 * QUÉ NO GARANTIZA TODAVÍA (honestidad de alcance — sigue siendo doctrina hasta Fase 2):
 *   · que el narrador RESPETE el binding (que no cuelgue una cifra real de la métrica/entidad/período equivocado).
 *     Eso lo cierra el guard estricto de Fase 2, que consume ESTE contrato como fuente de verdad del binding.
 *   · el payload todavía viaja con `datos` (los facts, la forma que el narrador consume hoy). Migrar el CONTENIDO
 *     de facts crudos → claims cambia el prompt y NO es verificable sin corridas pagadas; queda declarado como
 *     Fase 1b y NO se hace acá (el owner fijó "cada fase conserva el comportamiento actual" como puerta de deploy).
 *
 * PURO · SIN ESTADO · SIN LLM · gate-testable. No importa nada que haga red.
 */

// ── INMUTABILIDAD REAL ─────────────────────────────────────────────────────────────────────────────────────────
// Object.freeze es superficial: congela el objeto pero no sus hijos. Un contrato "sellado" cuyo `claims[3].valor`
// se puede reescribir no es un contrato. _deepFreeze recorre y congela todo el árbol. Tolera ciclos (WeakSet) por
// seguridad, aunque el contrato se construye acíclico por diseño.
function _deepFreeze(obj, seen = new WeakSet()) {
  if (obj === null || typeof obj !== "object" || seen.has(obj)) return obj;
  seen.add(obj);
  for (const k of Object.getOwnPropertyNames(obj)) {
    const v = obj[k];
    if (v && typeof v === "object") _deepFreeze(v, seen);
  }
  return Object.freeze(obj);
}

// ── PARSE DEL LABEL DE BOLETA ──────────────────────────────────────────────────────────────────────────────────
// La convención "Entidad · Concepto" (boleta.js/fig + specRetrieval.js) es la MISMA que ya leen _groupByEntity /
// _needsTableFormat (narratePromptC.js) y enrichFromFacts (ledger.js): se parte en el PRIMER " · ". Un label sin
// separador es una cifra del NEGOCIO (sin dueño), no una entidad anónima — se marca entidad:null, nunca inventada.
import { resolveEntityRef } from "./entityIndex.js";                              // Fase 3 · el eje REAL de un nombre, O(1) por tenant
import { REFERENCIA_PROCEDENCIA, METRICAS_DE_REFERENCIA } from "../../config/businessPolicy.js";   // procedencia de la vara (una verdad, junto a benchmarkOf)

const _SEP = " · ";
function _splitLabel(label) {
  const s = String(label == null ? "" : label);
  const i = s.indexOf(_SEP);
  if (i < 0) return { entidad: null, metrica: s.trim() };
  return { entidad: s.slice(0, i).trim() || null, metrica: s.slice(i + _SEP.length).trim() };
}

// ── ESTATUS EPISTÉMICO ─────────────────────────────────────────────────────────────────────────────────────────
// probado  · la cifra sale del dato tal cual (source "actual", sin fórmula) — se puede afirmar.
// indicado · la cifra es DERIVADA por el motor (tiene fórmula, o source "computed": brechas, excesos, proyecciones)
//            — es real y auditable, pero es una CUENTA sobre el dato, no una lectura directa; se afirma como tal.
// abierto  · no vive acá: lo que no se puede afirmar no es un claim, es una pregunta abierta (ver buildOpenQuestions).
// Deriva del fig, NUNCA del texto ni del prompt — por eso es determinístico y portable entre proveedores.
function _estatusDe(fig) {
  if (!fig) return "probado";
  if (fig.formula) return "indicado";
  if (fig.source && fig.source !== "actual") return "indicado";
  return "probado";
}

// ══ REGLA DE PROPORCIONALIDAD SEMÁNTICA (owner 2026-08-07) ═════════════════════════════════════════════════════
// "ADI nunca puede afirmar más de lo que la evidencia autorizada demuestra."
// No es una regla nueva al costado: son CUATRO CAMPOS MÁS en el claim, que el prompt lee y el guard verifica.
// Todo se DERIVA de lo que el motor ya sabe — ningún composer tiene que declarar nada nuevo (salvo la etiqueta de
// referencia, que ya era una convención vigente y ahora está declarada en businessPolicy.js).
//
//   sujetoTipo        entidad | negocio | concepto   ← quién es el sujeto REAL de la cifra
//   procedencia       interna_empresa | externa_sector | null   ← de dónde sale la vara
//   nivelFinanciero   venta|costo|margen|contribucion|carga|resultado|null   ← qué nivel de la cascada es
//   coberturaCausal   total | parcial | no_determinada | null   ← cuánto del fenómeno explica
//   explica           {monto, universo, fraccion} | null        ← la parte y el todo, cuando ambos existen

// ── SUJETO ─────────────────────────────────────────────────────────────────────────────────────────────────────
// El `eje` del claim MENTÍA: buildClaims le estampaba a TODOS el `scope.eje` del turno, que sale del PRIMER
// facts.entityType que aparezca. Medido: executiveSummary (lectura del NEGOCIO) sellaba eje:"cliente", e
// inventoryStatus sellaba eje:"bodega" sobre un ledger que mezcla bodegas, familias y SKU (LG-DRYER8KG quedaba
// tipado como bodega). Ahora el eje se resuelve POR CLAIM contra el catálogo real del tenant, con el índice O(1)
// de Fase 3 — que además separa limpio la entidad real de la pseudo-entidad ("Capital inmovilizado", "Medida",
// "headline" son labels que _splitLabel devuelve como si fueran sujetos, y no lo son).
function _sujetoDe(entidad, ejeDelTurno) {
  if (!entidad) return { sujetoTipo: "negocio", eje: null };
  const ref = resolveEntityRef(entidad);
  if (ref.estado === "resuelto") return { sujetoTipo: "entidad", eje: ref.dimension };
  // no existe en NINGÚN eje del tenant → no es una entidad, es un concepto de la lectura. NO hereda el eje del
  // turno: heredarlo es justamente lo que producía "LG-DRYER8KG es una bodega".
  return { sujetoTipo: "concepto", eje: null, _ejeTurno: ejeDelTurno || null };
}

// ── NIVEL FINANCIERO ───────────────────────────────────────────────────────────────────────────────────────────
// La cascada real del negocio (buildPnlCascade, pnl.js): Ingreso − Costo = Margen bruto − Carga comercial =
// Contribución − Σ Gastos = Resultado. Venta positiva significa que VENDE; margen positivo, que DEJA MARGEN;
// contribución positiva, que APORTA CONTRIBUCIÓN. Ninguna autoriza por sí sola a decir "es rentable": eso exige
// un RESULTADO que ya descontó costos y gastos. Hoy `resultado` no está declarado para ejes de entidad
// (metricRegistry) y el tenant demo ni siquiera tiene P&L definido — así que en la práctica casi nunca existe,
// y esa ausencia es exactamente lo que el guard usa para bloquear la afirmación de rentabilidad.
// `\b` y no `$`: las etiquetas reales del motor traen calificador ("Venta del período", "Margen bruto",
// "Contribución del período") y sin eso quedaban sin nivel — cazado proyectando el payload de un trend de negocio.
const _NIVEL_POR_METRICA = [
  [/^ventas?\b/i, "venta"], [/^costo\b/i, "costo"], [/^margen\b/i, "margen"],
  [/^contribuci[oó]n\b/i, "contribucion"], [/^carga comercial\b/i, "carga"], [/^resultado\b/i, "resultado"],
];
function _nivelFinancieroDe(metrica) {
  const m = String(metrica || "").trim();
  for (const [re, nivel] of _NIVEL_POR_METRICA) if (re.test(m)) return nivel;
  return null;   // rotación, cobertura, unidades, ticket, capital… no son niveles de la cascada
}

// ── COBERTURA CAUSAL ───────────────────────────────────────────────────────────────────────────────────────────
// Una PALANCA (exceso de acciones comerciales, capital detenido…) explica UNA PARTE de un fenómeno mayor. El caso
// que lo motiva, con las cifras reales: "Falabella · exceso de acciones comerciales" = $194K, dentro de un
// universo de $1.574.333 (venta × benchmark − contribución) — o sea el 12,3%, equivalente a 1,0 pp de los 8,1 pp
// de brecha. Narrado suelto se lee como la explicación completa. Nunca lo es.
// El universo vive en OTRA tool ("Valor en juego" / "Contribución no capturada"), así que puede NO estar en la
// boleta del turno. Esa distinción importa y se sella: con universo → se puede declarar la fracción; sin universo
// → sigue siendo parcial, pero la fracción es INNARRABLE y el prompt lo dice explícito.
const _UNIVERSO_DE_PALANCA = [/valor en juego/i, /contribuci[oó]n no capturada/i, /brecha.*contribuci/i];
function _esUniverso(metrica) { return _UNIVERSO_DE_PALANCA.some((re) => re.test(String(metrica || ""))); }

// ── CLAIMS ─────────────────────────────────────────────────────────────────────────────────────────────────────
// buildClaims(ledgerFigs, {eje, periodo}) → la boleta convertida en AFIRMACIONES tipadas. Cada claim conserva el
// `canon` original de la fig (unit:value) para que el guard de Fase 2 pueda atar el binding sin recalcular nada.
// El orden se preserva (la boleta ya viene ordenada por el composer — el orden es información).
export function buildClaims(ledgerFigs, { eje = null, periodo = null } = {}) {
  const figs = Array.isArray(ledgerFigs) ? ledgerFigs : [];
  const base = figs.filter(Boolean).map((f, i) => {
    const { entidad, metrica } = _splitLabel(f.label);
    const suj = _sujetoDe(entidad, eje);
    return {
      id: `c${i}`,
      entidad,
      // PROPORCIONALIDAD SEMÁNTICA · el sujeto real, resuelto por claim contra el catálogo del tenant (ver
      // _sujetoDe): deja de heredar a ciegas el eje del turno, que en ledgers multi-eje mentía.
      sujetoTipo: suj.sujetoTipo,
      eje: suj.eje,
      metrica,
      periodo,
      unidad: f.unit || null,
      valor: f.value,                     // string YA formateado (verbatim, una sola verdad con el texto)
      valorRaw: typeof f.raw === "number" ? f.raw : null,
      estatus: _estatusDe(f),
      // PROCEDENCIA · una REFERENCIA no es una medición del negocio. Las tres capas de benchmarkOf son internas
      // de la empresa, así que se narra "tu benchmark"/"tu referencia" — nunca sectorial (ver businessPolicy.js).
      procedencia: METRICAS_DE_REFERENCIA.includes(metrica) ? REFERENCIA_PROCEDENCIA : null,
      // NIVEL FINANCIERO · qué escalón de la cascada es esta cifra. Solo `resultado` sostiene "es rentable".
      nivelFinanciero: _nivelFinancieroDe(metrica),
      coberturaCausal: null,              // se completa abajo: necesita ver TODOS los claims del turno
      explica: null,
      obligatoria: !!f.mandatory,         // la narración DEBE citarla (guardC ya lo enforcea)
      gancho: !!f.gancho,                 // disponible pero opcional (no exigible)
      formula: f.formula || null,
      // SUPUESTOS del claim: lo que hubo que asumir para que esta cifra exista. Hoy son dos y ambos derivan del
      // fig: la fórmula (es una cuenta, no una lectura) y la referencia usada (la vara es interna, no del sector).
      supuestos: [
        ...(f.formula ? [`se calcula como ${f.formula}`] : []),
        ...(METRICAS_DE_REFERENCIA.includes(metrica) ? ["la referencia la define tu negocio, no una fuente sectorial"] : []),
      ],
      contexto: f.context || null,
      etiqueta: f.label,                  // el label ORIGINAL — el binding del guard se ata a esto
      canon: f.canon || null,
    };
  });

  // ── SEGUNDA PASADA · COBERTURA CAUSAL ────────────────────────────────────────────────────────────────────────
  // Necesita el conjunto completo: una palanca es PARCIAL siempre, pero solo se puede declarar la FRACCIÓN si su
  // universo está en la MISMA boleta y para la MISMA entidad. Sin universo, la cobertura sigue siendo parcial y
  // la fracción queda explícitamente innarrable — que es distinto de no saber nada.
  for (const c of base) {
    const pal = _PALANCAS.find((p) => p.re.test(c.metrica));
    if (!pal || !pal.esParte) continue;   // la brecha es el FENÓMENO, no una parte de sí misma (ver _PALANCAS)
    c.coberturaCausal = "parcial";
    const universo = base.find((u) => u !== c && u.entidad === c.entidad && _esUniverso(u.metrica) && typeof u.valorRaw === "number" && u.valorRaw > 0);
    const monto = typeof c.valorRaw === "number" ? c.valorRaw : null;
    c.explica = {
      clase: pal.clase,
      monto: c.valor,
      montoRaw: monto,
      universo: universo ? universo.valor : null,
      universoEtiqueta: universo ? universo.etiqueta : null,
      // la fracción SOLO existe si ambas cifras están autorizadas en este turno. Si no, es null y el prompt
      // instruye a decir "explica una parte" sin ponerle número — nunca a estimarla.
      fraccion: (universo && monto != null) ? `${Math.round((monto / universo.valorRaw) * 1000) / 10}%` : null,
    };
  }
  return base;
}

// ── RELACIONES AUTORIZADAS ─────────────────────────────────────────────────────────────────────────────────────
// El owner pidió "relaciones autorizadas entre claims" — o sea: QUÉ se puede cruzar con QUÉ lo decide el motor, no
// el narrador. Tres relaciones, todas derivadas determinísticamente de los claims (nunca del texto):
//   · comparable   mismos (métrica, unidad, período) en entidades DISTINTAS → autoriza compararlas entre sí.
//                  Sin esta relación explícita, comparar dos cifras es una inferencia libre del LLM; con ella, es
//                  una operación autorizada. (Y su ausencia es igual de informativa: dos métricas distintas NO son
//                  comparables aunque compartan unidad — la trampa clásica de "margen 22% vs carga 4.5%".)
//   · derivada     el claim tiene fórmula → se declara que es una CUENTA, con su fórmula auditable al lado.
//   · mismaEntidad todos los claims de una misma entidad → autoriza construir el perfil de esa entidad sin mezclar.
export function buildRelations(claims) {
  const cs = Array.isArray(claims) ? claims : [];
  const comparables = [];
  const porClave = new Map();
  for (const c of cs) {
    if (!c.entidad || !c.metrica) continue;
    const k = `${c.metrica}|${c.unidad}|${c.periodo || ""}`;
    if (!porClave.has(k)) porClave.set(k, []);
    porClave.get(k).push(c.id);
  }
  for (const [k, ids] of porClave) {
    if (ids.length < 2) continue;
    const [metrica, unidad] = k.split("|");
    comparables.push({ tipo: "comparable", metrica, unidad, claims: ids });
  }
  const derivadas = cs.filter((c) => c.formula).map((c) => ({ tipo: "derivada", claim: c.id, formula: c.formula }));
  const porEntidad = new Map();
  for (const c of cs) {
    if (!c.entidad) continue;
    if (!porEntidad.has(c.entidad)) porEntidad.set(c.entidad, []);
    porEntidad.get(c.entidad).push(c.id);
  }
  const mismaEntidad = [...porEntidad.entries()].map(([entidad, ids]) => ({ tipo: "mismaEntidad", entidad, claims: ids }));
  // PARTE-DE (Regla de Proporcionalidad Semántica) — la relación que la cabecera de este archivo prometía y que
  // nunca se había escrito. Es la que impide que una causa parcial se narre como la explicación completa: declara
  // explícitamente qué claim es una PARTE de qué otro, con la fracción cuando ambas cifras están autorizadas.
  // Su AUSENCIA también informa: una palanca sin universo en la boleta sigue siendo parcial, pero su fracción es
  // innarrable — el prompt lo dice, y nunca se estima.
  const parteDe = cs.filter((c) => c.coberturaCausal === "parcial" && c.explica).map((c) => ({
    tipo: "parte-de",
    claim: c.id,
    clase: c.explica.clase,
    parte: c.explica.monto,
    universo: c.explica.universo,           // null si no está en esta boleta
    universoEtiqueta: c.explica.universoEtiqueta,
    fraccion: c.explica.fraccion,           // null si el universo no está autorizado en este turno
    cuantificable: !!c.explica.fraccion,
  }));
  return { comparables, derivadas, mismaEntidad, parteDe };
}

// ── PREGUNTAS ABIERTAS (el estatus "abierto" del contrato) ─────────────────────────────────────────────────────
// Lo que el motor NO pudo responder este turno no es una cifra: es un límite declarado. Sale de coverage.supported
// === false (la tool degradó honesto) con su motivo y sus alternativas — la MISMA fuente que hoy alimenta el
// bloque HONESTIDAD del narrador, pero tipada en vez de mezclada dentro de `datos`.
export function buildOpenQuestions(results) {
  const list = Array.isArray(results) ? results : [];
  return list.filter((r) => r && r.coverage && r.coverage.supported === false).map((r) => ({
    tool: r.tool || null,
    motivo: (r.coverage && r.coverage.reason) || null,
    alternativas: Array.isArray(r.coverage && r.coverage.alternativas) ? r.coverage.alternativas.slice() : [],
    cruceImposible: !!(r.coverage && r.coverage.cross),
  }));
}

// ── SUPUESTOS ──────────────────────────────────────────────────────────────────────────────────────────────────
// Un supuesto NO es un hecho, y esa distinción tiene que viajar tipada (hoy es doctrina de prosa: "SI hacés X,
// PODRÍAS recuperar Y"). Dos fuentes determinísticas: los supuestos_faltantes del plan (simulación que pidió
// clarificación) y los facts.supuestos que sellan los composers de simulación.
export function buildSupuestos({ plan, results }) {
  const out = [];
  const faltantes = plan && Array.isArray(plan.supuestos_faltantes) ? plan.supuestos_faltantes : [];
  for (const s of faltantes) if (s) out.push({ tipo: "faltante", detalle: String(s) });
  const list = Array.isArray(results) ? results : [];
  for (const r of list) {
    const sup = r && r.facts && r.facts.supuestos;
    if (Array.isArray(sup)) for (const s of sup) if (s) out.push({ tipo: "declarado", tool: r.tool || null, detalle: typeof s === "string" ? s : JSON.stringify(s) });
    else if (sup && typeof sup === "object") out.push({ tipo: "declarado", tool: r.tool || null, detalle: JSON.stringify(sup) });
  }
  return out;
}

// ── ACCIONES Y PRIORIDADES PERMITIDAS ──────────────────────────────────────────────────────────────────────────
// El owner pidió "acciones y prioridades permitidas". La regla: una acción es proponible SOLO si el motor computó
// una palanca CUANTIFICADA para ella. Se derivan de los claims cuya métrica nombra una palanca reconocida por el
// contrato de negocio (exceso de acciones comerciales, brecha de margen, capital detenido) — cada una con su monto
// para que la PRIORIDAD sea del dato (mayor monto primero), no del criterio del narrador.
// Nota de alcance: es una lista de lo PERMITIDO/priorizable, no una orden. El narrador sigue eligiendo cómo
// contarlo; lo que no puede es proponer una acción sin respaldo cuantificado en esta lista.
// `esParte` (Regla de Proporcionalidad Semántica): distingue el MECANISMO del FENÓMENO. Un mecanismo explica una
// PARTE de algo mayor — el exceso de acciones comerciales y el capital detenido son mecanismos. La BRECHA no: la
// brecha ES el fenómeno, el universo contra el que se mide la parte. Sin esta distinción, la primera versión
// marcaba la brecha de 8,1 pp como "causa parcial de sí misma" (cazado corriendo la derivación sobre 4 ejes).
const _PALANCAS = [
  { re: /exceso de acciones comerciales/i, clase: "acciones_comerciales", accion: "revisar las acciones comerciales (rebates y descuentos)", esParte: true },
  { re: /capital detenido/i,               clase: "capital_detenido",     accion: "liberar el capital detenido en inventario",               esParte: true },
  { re: /\bbrecha\b/i,                     clase: "brecha_margen",        accion: "cerrar la brecha de margen contra el benchmark",          esParte: false },
];
export function buildAllowedActions(claims) {
  const cs = Array.isArray(claims) ? claims : [];
  const out = [];
  for (const c of cs) {
    const p = _PALANCAS.find((x) => x.re.test(c.metrica || ""));
    if (!p) continue;
    out.push({
      clase: p.clase,
      accion: p.accion,
      sobre: c.entidad,
      magnitud: c.valor,
      magnitudRaw: c.valorRaw,
      unidad: c.unidad,
      claim: c.id,
      estatus: c.estatus,
    });
  }
  // prioridad = magnitud en dinero, descendente. Las no-dinerarias (pp) van después: una brecha en puntos no es
  // comparable con un $ (misma trampa que evita `comparables` arriba) — se ordenan entre sí, nunca contra el $.
  const money = out.filter((a) => a.unidad === "money").sort((a, b) => (b.magnitudRaw || 0) - (a.magnitudRaw || 0));
  const resto = out.filter((a) => a.unidad !== "money");
  return [...money, ...resto].map((a, i) => ({ ...a, prioridad: i + 1 }));
}

// ── SCOPE CONTRACT ─────────────────────────────────────────────────────────────────────────────────────────────
// El ALCANCE como campo de PRIMERA CLASE (hoy vive disperso en plan.scope + call.args + mem.conversationScope +
// una docena de coercers). Se sella DESPUÉS de que answerViaOracle ya coercionó/validó, así que lo que entra acá
// es el alcance YA validado contra el catálogo del tenant — este objeto es la única verdad río abajo.
// `periodo` sale del dato (facts.periodo sellado por el composer) y cae al escenario solo si el dato no lo declara:
// nunca se inventa un período que el dato no sostenga.
export function sealScopeContract({ plan, results, scenario = null, requestContext = null, pref = null } = {}) {
  const list = Array.isArray(results) ? results : [];
  const scope = (plan && plan.scope) || null;
  const entidades = scope && Array.isArray(scope.entities) ? scope.entities.filter(Boolean).slice() : [];
  // el eje: el que declaren los facts (entityType/dimension son la salida YA canonicalizada del motor).
  let eje = null;
  for (const r of list) {
    const f = r && r.facts;
    if (!f) continue;
    if (f.entityType) { eje = f.entityType; break; }
    if (f.dimension) { eje = f.dimension; break; }
  }
  // el período: sellado por el composer si existe; si no, el escenario del turno.
  let periodo = null;
  for (const r of list) {
    const f = r && r.facts;
    if (f && f.periodo) { periodo = f.periodo; break; }
  }
  if (!periodo && scenario) periodo = scenario;
  const metricas = [];
  for (const r of list) {
    const ms = r && r.facts && Array.isArray(r.facts.metrics) ? r.facts.metrics : [];
    for (const m of ms) if (m && m.label && !metricas.includes(m.label)) metricas.push(m.label);
  }
  const filtros = {};
  for (const c of (plan && Array.isArray(plan.calls) ? plan.calls : [])) {
    const f = c && c.args && c.args.filters;
    if (f && typeof f === "object") for (const [k, v] of Object.entries(f)) if (v != null && v !== "") filtros[k] = v;
  }
  return {
    tenant: (requestContext && requestContext.tenantId) || null,
    escenario: scenario || null,
    periodo,
    eje,
    entidades,
    nivel: (scope && scope.level) || (entidades.length > 1 ? "list" : entidades.length === 1 ? "entity" : "global"),
    // `declarado` = el alcance TAL COMO lo emitió el plan, ya coercionado/validado por answerViaOracle. Se sella
    // verbatim (no una reconstrucción) porque es lo que el narrador viene consumiendo como `alcance` — mantenerlo
    // idéntico es lo que hace que Fase 1 no cambie una coma del prompt. Fase 1b lo reemplaza por eje/entidades.
    declarado: scope || null,
    filtros,
    metricas,
    modo: (plan && plan.mode) || "default",
    contentScope: (pref && pref.contentScope) || "full",
    detalle: (pref && pref.detailLevel) || "standard",
  };
}

// ── POLÍTICA DE EXTENSIÓN ──────────────────────────────────────────────────────────────────────────────────────
// Qué le está permitido AGREGAR al narrador por encima de los claims. El owner fue explícito: "puede redactar con
// naturalidad, pero no agregar ni modificar entidades, métricas, períodos, causalidad, acciones o supuestos fuera
// de ese contrato". Esto lo declara como DATO (no como párrafo de prompt) para que Fase 2 pueda verificarlo y para
// que sea legible por cualquier proveedor.
export function buildExtensionPolicy({ scope, claims, acciones }) {
  return {
    puedeRedactarLibre: true,               // la naturalidad es del LLM — no se toca
    puedeAgregarEntidades: false,
    puedeAgregarMetricas: false,
    puedeAgregarPeriodos: false,
    puedeAgregarCausalidad: false,          // el "por qué" solo puede apoyarse en relaciones/claims sellados
    puedeAgregarAcciones: false,            // solo las de `acciones` (cuantificadas)
    puedeAgregarSupuestos: false,
    entidadesPermitidas: [...new Set((claims || []).map((c) => c.entidad).filter(Boolean))],
    metricasPermitidas: [...new Set((claims || []).map((c) => c.metrica).filter(Boolean))],
    periodoPermitido: scope ? scope.periodo : null,
    accionesPermitidas: (acciones || []).map((a) => a.accion),
    // cuánto puede extenderse: el contrato de forma ya resuelto (modo + densidad) — la "proporcionalidad".
    densidad: scope ? scope.contentScope : "full",
    detalle: scope ? scope.detalle : "standard",
  };
}

// ── EL CONTRATO ────────────────────────────────────────────────────────────────────────────────────────────────
// buildNarrationContract(args) → NarrationContract INMUTABLE. Es lo único que NARRAR puede ver.
// `datos` viaja acá (Fase 1) porque el narrador de hoy consume facts y migrar ese contenido cambia el prompt —
// pero YA está DENTRO del contrato, sellado: nadie río abajo lo lee de `results`. Fase 1b lo reemplaza por claims.
export function buildNarrationContract({
  text, plan, results, ledgerFigs, mem, history, pref, instruccionOrientacion, instruccionDisclosure, scenario = null, requestContext = null,
} = {}) {
  const scope = sealScopeContract({ plan, results, scenario, requestContext, pref });
  const claims = buildClaims(ledgerFigs, { eje: scope.eje, periodo: scope.periodo });
  const relaciones = buildRelations(claims);
  const preguntasAbiertas = buildOpenQuestions(results);
  const supuestos = buildSupuestos({ plan, results });
  const acciones = buildAllowedActions(claims);
  const politicaExtension = buildExtensionPolicy({ scope, claims, acciones });
  const datos = (results || []).map((r) => ({
    tool: r.tool,
    disponible: !!(r.coverage && r.coverage.supported),
    ...(r.coverage && r.coverage.supported === false ? { motivo: r.coverage.reason } : {}),
    facts: r.facts || null,
  }));
  const h = Array.isArray(history) ? history.slice(-4) : [];
  const hiloReciente = h
    .map((m) => ({ quien: m.role === "user" ? "usuario" : "ADI", dijo: String(m.gist || m.text || "").slice(0, 220) }))
    .filter((m) => m.dijo);
  return _deepFreeze({
    version: 1,
    pregunta: String(text == null ? "" : text),
    intencion: (plan && plan.intent) || "answer",
    scope,
    claims,
    relaciones,
    supuestos,
    acciones,
    preguntasAbiertas,
    politicaExtension,
    // ── material de FORMA ya resuelto por el motor (no es "results crudos": son decisiones tomadas) ──
    forma: {
      modo: scope.modo,
      clarifyStreak: (plan && plan.clarifyStreak) || null,
      instruccionOrientacion: instruccionOrientacion || null,
      // DIVULGACIÓN PROGRESIVA (owner 2026-08-07): qué decir en vez de la tabla que NO se trajo. Va en 
      // porque es una instrucción de FORMA del turno, igual que la orientación — no es un claim ni un dato.
      instruccionDisclosure: instruccionDisclosure || null,
      // el plan sigue viajando SOLO para los detectores de forma que hoy lo consultan (perfil completo, orden por
      // monto). Fase 1b los mueve a consumir `claims`/`scope` y este campo desaparece.
      _planCalls: (plan && Array.isArray(plan.calls) ? plan.calls : []).map((c) => ({ tool: c && c.tool })),
    },
    datos,
    hiloReciente,
    memoria: mem || null,
    pref: pref || null,
    // trazabilidad: para auditar de dónde salió el contrato sin volver a los crudos.
    _fuente: { figs: Array.isArray(ledgerFigs) ? ledgerFigs.length : 0, results: Array.isArray(results) ? results.length : 0 },
  });
}

// ── VERIFICACIÓN DE SELLADO (para gates) ───────────────────────────────────────────────────────────────────────
// isSealed(contract) → true si el contrato es realmente inmutable en profundidad. Un gate puede afirmarlo sin
// intentar mutarlo (que en modo no-estricto falla en silencio y daría un falso verde).
export function isSealed(contract, seen = new WeakSet()) {
  if (contract === null || typeof contract !== "object") return true;
  if (seen.has(contract)) return true;
  seen.add(contract);
  if (!Object.isFrozen(contract)) return false;
  for (const k of Object.getOwnPropertyNames(contract)) {
    const v = contract[k];
    if (v && typeof v === "object" && !isSealed(v, seen)) return false;
  }
  return true;
}
