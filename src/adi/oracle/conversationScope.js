/* === src/adi/oracle/conversationScope.js · ARQUITECTURA C · CONTINUIDAD CONVERSACIONAL UNIVERSAL — Etapa 1/3 ===
 * owner (pedido "continuidad conversacional universal", 2026-08-03): ADI debe recordar sobre qué se está
 * trabajando y resolver referencias naturales ("estos SKU", "esos clientes", "los dos peores", "haz lo mismo con
 * X") SIN volver a preguntar lo que ya sabe — transversal a cliente/SKU/marca/familia/bodega/canal/período/
 * ranking/comparación/diagnóstico/simulación, no un parche para un caso puntual.
 *
 * REGLA DURA DE FIDELIDAD (la más importante, nunca se relaja): toda resolución de referencia acá SOLO lee
 * ConversationScopeEntry.entities — que a su vez SOLO se deriva de `result.boleta` (resultado ESTRUCTURADO de una
 * tool-call, ver buildEntityList) — JAMÁS de `narration`/prosa del narrador. La prosa es para el humano, nunca la
 * fuente de verdad del estado (un LLM puede parafrasear/resumir de formas no parseables con seguridad).
 *
 * Funciones PURAS (sin LLM, sin I/O) — mismo patrón arquitectónico que dialogueState.js, orquestadas por
 * answerViaOracle.js. Etapa 1 la dejó ADITIVA (mem.lastOffer/mem.recentSubjects seguían vivos en paralelo, sin
 * leer de acá) a propósito, para no arriesgar los ~30 gates/mecanismos que dependían de esas 2 keys antes de que
 * el resto de la generalización (Etapa 2: contratos de tool + entityScope multi-entidad; Etapa 3: scenarioIntent.js
 * multi-eje) estuviera asentada. Etapa 4 (2026-08-04, "lastOffer/recentSubjects como vistas derivadas del scope
 * canónico") cerró esa consolidación pendiente — ver "CONSOLIDACIÓN — ESTADO AL CIERRE DE ETAPA 4" al final del
 * archivo para el estado final exacto (lastOffer: derivación real · recentSubjects: consolidación física parcial,
 * por diseño, no por omisión).
 *
 * ── ConversationScopeEntry ──────────────────────────────────────────────────────────────────────────────────────
 *   turno       number|null            = history.length del turno que lo estableció (misma convención que
 *                                         recentSubjects/lastOffer hoy)
 *   dimension   "cliente"|"sku"|"marca"|"familia"|"bodega"|"canal"|"cartera"|null
 *                                       "cartera" = plan.scope.level="global" explícito (negocio entero);
 *                                       null = aún no se estableció ningún eje en la conversación
 *   entities    string[]               0..N nombres CANÓNICOS, SIEMPRE de un resultado estructurado de ESTE turno
 *   selection   {orden,subset}|null    orden = el string YA SELLADO por la tool (facts.orden/ordenA/ordenB)
 *   periodo     string|null            el mismo string que toolRunner.js/trend ya producen
 *   filtros     object|null            mismo shape que args.filters de las tools
 *   metrica     string|null            best-effort (ver comentario en updateConversationScope) — NO autoridad
 *   operacion   string|null            = plan.intent de este turno
 *   modo        string|null            = plan.mode ya coercido
 *   tool        string|null            tool dominante del turno (calls[0].tool)
 *   origen      {callId, boletaLabels} trazabilidad mínima (nunca un puntero vivo a `results`)
 *   supuestos   array                  reservado — Etapa 3 (simulate multi-entidad) lo puebla
 *   faltantes   string[]               reservado — Etapa 3
 *   ofertaPendiente object|null        Etapa 4 (owner 2026-08-04) — escrito por answerViaOracle.js vía
 *                                       withOfertaPendiente (abajo) en el MISMO instante que mem.lastOffer (dual-
 *                                       write); leído por dialogueState.js:getLastOffer. mem.lastOffer sigue vivo
 *                                       como shim de compatibilidad para fixtures viejos — ver dialogueState.js.
 *   tenant      {tenantId,dataSnapshotId}|null   copiado AL ESCRIBIR, nunca recalculado
 *
 * mem.conversationScope = { version: 1, current: ConversationScopeEntry|null, history: ConversationScopeEntry[],
 *   recentSubjects: RecentSubject[] }   — `recentSubjects` (Etapa 4, owner 2026-08-04) es consolidación FÍSICA
 *   (misma lista/shape que dialogueState.js:updateRecentSubjects siempre produjo, dual-escrita acá como key
 *   hermana de `current`/`history`) — NUNCA derivada de `history` (política de archivado distinta, ver el
 *   comentario "POR QUÉ recentSubjects NO se deriva de conversationScope.history" en dialogueState.js).
 * (history: tope 3, más-reciente-primero, nunca incluye a `current`)
 */
import { guessDimension } from "./entityRecord.js";
import { PERIODO_MIXTO_ETIQUETA } from "../../config/contract/figureType.js";   // la etiqueta corta del marco mixto (decisión 5)
// DEIXIS DE COMPONENTE (owner 2026-08-09, Contrato de Concordancia ADI↔Sentrix): la expresión vive en
// progressiveDisclosure.js —donde se decide la FORMA de la respuesta, que la necesita para "explicame este
// gráfico"— y acá se importa. NUNCA se declara una segunda: mismo criterio que DEICTIC_PLURAL_RE (que vive acá y
// scenarioIntent.js importa de acá).
import { DEICTIC_COMPONENT_RE } from "./progressiveDisclosure.js";
// REPARACIÓN CONTEXTUAL (Contrato v1.2, owner 2026-08-10): el CRITERIO de compatibilidad vive en el contrato
// versionado —igual que los 7 modos—, la MECÁNICA de aplicarlo sobre el estado canónico vive acá. Una sola verdad
// por lado: este archivo nunca decide qué sobrevive, y el contrato nunca toca el estado.
import { camposQueSeInvalidan } from "./conversationalContract.js";

// bodega/canal sumados Etapa 1 (owner 2026-08-04, "cierre de los límites restantes"): guessDimension
// (entityRecord.js) ya los reconoce vía ENTITIES.bodega/canal (entityRegistry.js) — este Set gatea buildEntityList
// (abajo) y los 7 puntos de uso de guessDimension de este archivo, así que el fix se hereda mecánicamente.
const _AXES = new Set(["sku", "cliente", "marca", "familia", "bodega", "canal"]);

export function emptyConversationScope() {
  return { version: 1, current: null, history: [] };
}

// ── withOfertaPendiente(scope, offer) → scope' — Etapa 4 (owner 2026-08-04, "lastOffer/recentSubjects como vistas
// derivadas del scope canónico"): escribe/limpia ConversationScopeEntry.ofertaPendiente SIN mutar el objeto
// recibido. `scope.current` puede ser la MISMA referencia que un scopePrev.current de un turno anterior (ver
// updateConversationScope más abajo, rama "sin entidades nuevas": devuelve `prev.current` TAL CUAL, sin clonar) —
// mutarlo en el lugar corrompería en silencio la memoria de un turno que el caller ya devolvió/persistió en otro
// lado. `ofertaPendiente` era un campo RESERVADO desde el diseño original del shape (ver el comentario de
// ConversationScopeEntry arriba, "reservado — Etapa 2/3") — este es el punto único donde Etapa 4 empieza a
// escribirlo; dialogueState.js:getLastOffer es el único lector. No-op (devuelve `scope` tal cual) si no hay
// `current` sobre el que escribir — nunca inventa un scope nuevo desde acá.
export function withOfertaPendiente(scope, offer) {
  if (!scope || !scope.current) return scope || null;
  return { ...scope, current: { ...scope.current, ofertaPendiente: offer || null } };
}

/* ══ REPARACIÓN CONTEXTUAL · Contrato Conversacional v1.2 (owner 2026-08-10) ═══════════════════════════════════
 * "Se modifica únicamente lo corregido y se conserva SOLO el contexto que sigue siendo compatible."
 *
 * ACÁ VIVE LA MECÁNICA; el CRITERIO (qué sobrevive a qué) vive en conversationalContract.js, versionado con el
 * resto del contrato. Se aplica sobre el MISMO estado canónico que ya existe —mem.conversationScope— sin crear ni
 * una memoria, capa ni modo paralelo: invalidar es apagar campos de `current`, no guardar un registro nuevo.
 *
 * POR QUÉ NO SE TOCA `history`: el contrato invalida el contexto DE LA CORRECCIÓN, no la conversación entera. Un
 * tema anterior legítimo (uno que el usuario nunca corrigió) sigue siendo un referente válido para "esos de
 * antes". Lo que sí queda garantizado es que la entidad corregida no vuelve por la puerta de atrás: no se archiva
 * en `history` (updateConversationScope solo archiva ante un cambio real de tema) y se saca de `recentSubjects`,
 * que es la señal que el prompt le muestra al LLM como "temas recientes".
 */

// _vaciar(campo) → el valor NEUTRO de cada campo del scope. Vaciar no es borrar la key: el shape de
// ConversationScopeEntry no cambia nunca (los ~30 lectores del scope siguen encontrando lo que esperan).
const _NEUTRO = {
  dimension: null, entities: [], selection: null, periodo: null, filtros: null, metrica: null,
  tool: null, operacion: null, modo: null,
  origen: { callId: null, boletaLabels: [] }, ofertaPendiente: null, supuestos: [], faltantes: [],
};

// applyRepairToScope(scopeRoot, reparacion) → scopeRoot' — PURA, no muta.
// Corre ANTES del batch de este turno, sobre el scope del turno ANTERIOR: lo que sale de acá es el contexto que
// esta corrección deja vivo, y es lo que van a leer la resolución de referencias, el prompt de NARRAR y
// updateConversationScope. Una reparación ambigua (§4) NUNCA llega acá: mientras no se sepa qué corregir, el
// contexto no se toca — el llamador corta antes.
export function applyRepairToScope(scopeRoot, reparacion) {
  const prev = (scopeRoot && typeof scopeRoot === "object") ? scopeRoot : emptyConversationScope();
  const r = (reparacion && typeof reparacion === "object") ? reparacion : null;
  // desacuerdo y dato aportado NO son correcciones de alcance: no invalidan nada (§5 — "conserva la evidencia").
  if (!r || r.tipo !== "correccion" || r.ambigua) return prev;
  const invalidar = camposQueSeInvalidan(r.corrige);
  if (!invalidar.length) return prev;

  // SIN `current` LA REPARACIÓN NO ES UN NO-OP (defecto real, owner 2026-08-10). `current` queda en null cuando
  // ningún turno anterior produjo entidades en boleta — el caso EXACTO de un turno cuya tool declinó honesto. Pero
  // ese turno igual dejó `recentSubjects` poblado (se deriva de plan.scope, no de results) y una oferta viva en el
  // shim `mem.lastOffer` (su entidad también sale del plan). Con la guarda anterior, corregir la entidad después
  // de un turno declinado no invalidaba nada: la oferta de la entidad equivocada sobrevivía, y un "dale" dos
  // turnos después la ejecutaba. Ahora la purga de la señal corre igual, con o sin `current`.
  const entidadesPrevias = (prev.current && Array.isArray(prev.current.entities)) ? prev.current.entities.slice() : [];
  const retiradas = invalidar.includes("entities") ? entidadesPrevias : [];
  const out = { ...prev };
  if (prev.current) {
    const current = { ...prev.current };
    for (const campo of invalidar) {
      if (!Object.prototype.hasOwnProperty.call(_NEUTRO, campo)) continue;
      const v = _NEUTRO[campo];
      current[campo] = Array.isArray(v) ? [] : (v && typeof v === "object") ? { ...v } : v;
    }
    out.current = current;
  }
  // `recentSubjects` se purga por la ENTIDAD retirada cuando la hay; y cuando no hay `current` del cual leerla
  // —el turno declinado— se purga la que la propia señal declara como más reciente, que es la que ADI usó para
  // responder mal. Nunca se toca `history`: el contrato invalida el contexto DE LA CORRECCIÓN, no la conversación.
  if (invalidar.includes("entities") && Array.isArray(prev.recentSubjects) && prev.recentSubjects.length) {
    const objetivo = retiradas.length ? retiradas : [prev.recentSubjects[0] && prev.recentSubjects[0].entidad].filter(Boolean);
    out.recentSubjects = prev.recentSubjects.filter((s) => !(s && objetivo.includes(s.entidad)));
  }
  return out;
}

// ── inferirCorrige(scopePrev, plan) → string[] · LA REPARACIÓN CUANDO NADIE PUDO DECLARARLA ────────────────────
// EL HUECO QUE CIERRA, y es general, no de una tool: hay rutas que arman un plan SINTÉTICO sin consultar a PLAN
// (la lectura determinística del P&L es la que llega hasta el batch). Ahí `reparacion` no existe —el objeto lo
// emite PLAN, y PLAN no corrió— así que una corrección que caiga en esas rutas no invalidaba nada: el narrador
// seguía recibiendo la oferta y los temas del turno equivocado, y ni la doctrina de reconocimiento ni el chequeo
// de evidencia se activaban.
//
// NO ES UN DETECTOR DE FRASES ni un segundo clasificador: no mira el texto del usuario en ningún momento. Compara
// DOS ESTRUCTURAS —el alcance canónico del turno anterior y el que este plan resolvió— y nombra qué campos del
// contrato cambiaron. Si no cambió nada, devuelve vacío y la ruta determinística queda exactamente igual que hoy:
// una consulta normal no paga nada, no pierde su bypass y no cambia de comportamiento.
//
// SOLO PARA PLANES SINTÉTICOS. Cuando PLAN sí corre, él declara la reparación por comprensión, que es el
// mecanismo principal del contrato; superponerle esta inferencia sería un segundo criterio sobre lo mismo.
/* EL ALCANCE REALMENTE RESUELTO POR LAS CALLS (owner 2026-08-11, defecto 9 de la certificación).
 * `plan.scope` lo DECLARA el planificador y es opcional: el plan medido en E8.t3 llegó como
 * `{intent:"redirect", calls:["pnlRead"]}`, sin `scope`. Con la guarda vieja —`if (!plan.scope) return []`— toda
 * corrección cuyo plan omitiera ese campo se volvía AMBIGUA por defecto, y ahí se mezclaban dos conductas que no
 * son la misma: «eso está mal» (no hay información suficiente: preguntar) y «no, era Lider» (la corrección está
 * resuelta, el sujeto nuevo viene EN LAS CALLS: ejecutar). Una omisión del modelo no puede decidir eso.
 * Las calls son la verdad de lo que el turno va a pedir de verdad, así que se leen como segunda fuente: nunca
 * pisan al `scope` declarado, sólo lo completan cuando falta. Si no hay ni uno ni otro, se sigue devolviendo []
 * y el motor trata el turno como ambiguo, que es el comportamiento correcto para «eso está mal». */
function _scopeDeCalls(plan) {
  const calls = Array.isArray(plan && plan.calls) ? plan.calls.filter(Boolean) : [];
  if (!calls.length) return null;
  const ents = [], dims = [];
  for (const c of calls) {
    const a = (c && c.args) || {};
    for (const k of ["entity", "entidad", "entityA", "entityB"]) if (a[k]) ents.push(String(a[k]));
    if (Array.isArray(a.entities)) for (const e of a.entities) if (e) ents.push(String(e));
    if (a.dimension) dims.push(String(a.dimension));
  }
  // `level` se deriva del mismo criterio que usa el scope canónico: hay entidad nombrada → entity; si no, y el
  // pedido es de eje/cartera → global. Sin ninguna de las dos señales no se inventa un nivel.
  const level = ents.length ? "entity" : (dims.length ? "global" : null);
  return { level, entities: [...new Set(ents)] };
}

export function inferirCorrige(scopePrev, plan) {
  const cur = (scopePrev && scopePrev.current) || null;
  if (!cur || !plan) return [];
  const scopeEfectivo = (plan.scope && (plan.scope.level || (Array.isArray(plan.scope.entities) && plan.scope.entities.length)))
    ? plan.scope
    : _scopeDeCalls(plan);
  if (!scopeEfectivo) return [];
  const out = [];
  const nivelPrev = cur.dimension === "cartera" ? "global" : (Array.isArray(cur.entities) && cur.entities.length ? "entity" : null);
  const nivelAhora = scopeEfectivo.level || null;
  const entsPrev = Array.isArray(cur.entities) ? cur.entities : [];
  const entsAhora = Array.isArray(scopeEfectivo.entities) ? scopeEfectivo.entities.filter(Boolean) : [];
  // ALCANCE: se pasó de una entidad al negocio entero (o al revés). Es el cambio más grande y el que más contexto
  // deja incompatible, así que se nombra como tal y no como una corrección de entidad.
  if (nivelPrev && nivelAhora && nivelPrev !== nivelAhora) out.push("alcance");
  // ENTIDAD: mismo nivel, otra entidad. Se compara por nombre canónico, que es lo que las dos puntas ya usan.
  else if (entsPrev.length && entsAhora.length && !entsAhora.some((e) => entsPrev.includes(e))) out.push("entidad");
  // MÉTRICA: la que declara la call dominante contra la que quedó registrada. Es best-effort de los dos lados
  // (el scope la guarda como best-effort, ver updateConversationScope) — por eso solo se nombra cuando las DOS
  // existen y difieren: una ausencia no es un cambio.
  const dom = Array.isArray(plan.calls) && plan.calls[0];
  const metAhora = (dom && dom.args && (dom.args.metric || dom.args.metricA || dom.args.sortBy)) || null;
  if (cur.metrica && metAhora && cur.metrica !== metAhora) out.push("metrica");
  return out;
}

/* ══ LA SIMULACIÓN PENDIENTE · CICLO DE VIDA POR ESTADO, NO POR CALENDARIO (owner 2026-08-11) ═══════════════════
 * EL DEFECTO QUE CIERRA (medido, E7): ADI preguntaba el supuesto que faltaba ("¿cuánto cambia el volumen?"), el
 * usuario hacía CUALQUIER OTRA COSA en el medio, y al volver con la respuesta la simulación ya no existía — ADI
 * volvía a pedir el precio que el usuario ya había dado tres turnos antes. La causa no era el texto de ningún
 * turno: `mem.pendingSimulation` se borraba INCONDICIONALMENTE en los tres puntos de salida de answerViaOracle.js,
 * o sea moría por CALENDARIO (sobrevivía exactamente un turno) sin mirar nunca si el turno intercalado tenía algo
 * que ver con la simulación.
 *
 * LA REGLA CORRECTA, y es la misma que ya gobierna al resto del estado conversacional: un pendiente muere cuando
 *   · se RESUELVE (el usuario contestó el supuesto y la simulación corrió),
 *   · se REEMPLAZA (el usuario plantea otro escenario, sobre otra entidad),
 *   · una CORRECCIÓN lo invalida (§1 del Contrato v1.2: "no, era Jumbo" no puede seguir simulando Sodimac),
 *   · o se le acaba el plazo (TTL).
 * Un cambio de tema NO es ninguna de esas cuatro cosas.
 *
 * POR QUÉ EL TTL EXISTE Y POR QUÉ ES CORTO: sin plazo, un pendiente vivo convierte cualquier porcentaje suelto de
 * cualquier turno futuro ("baja 3%", hablando de otra cosa) en un candidato a resolverlo — el pendiente ZOMBI. El
 * plazo es la mitad que hace segura a la otra: el contexto dura lo que dura una conversación sobre el mismo tema,
 * no toda la sesión. 3 turnos cubre con holgura el paréntesis realista (una pregunta al medio, una aclaración) y
 * deja el pendiente muerto mucho antes de que el usuario pueda haberlo olvidado.
 *
 * POR QUÉ ACÁ Y NO EN answerViaOracle.js: este archivo ya es el hogar canónico del ciclo de vida del contexto
 * (ofertaPendiente, recentSubjects, supuestos del usuario, invalidación por reparación). Un quinto ciclo de vida
 * escrito a mano en el orquestador sería la cuarta fuente de verdad sobre "qué sobrevive a qué". El orquestador
 * decide CUÁNDO llamar a estas funciones; ellas deciden QUÉ queda vivo. */
export const PENDING_SIM_TTL_TURNOS = 3;

// _mismasEntidades(pending, otras) — comparación por nombre canónico, case-insensitive, EXACTA en ambos sentidos:
// simular "Sodimac" y simular "Sodimac + Jumbo" no son la misma simulación (la segunda REEMPLAZA a la primera).
function _mismasEntidades(pending, otras) {
  const propias = new Set([pending && pending.entity, ...((pending && Array.isArray(pending.entities)) ? pending.entities : [])].filter(Boolean).map((e) => String(e).toLowerCase()));
  const nuevas = new Set((Array.isArray(otras) ? otras : []).filter(Boolean).map((e) => String(e).toLowerCase()));
  if (!propias.size || propias.size !== nuevas.size) return false;
  for (const e of nuevas) if (!propias.has(e)) return false;
  return true;
}

// _pendienteBienFormado(p) → un pendiente sin variable conocida o sin campo faltante no es un pendiente: es basura
// persistida. Mismo criterio que _buildPendingSimulation ("mejor nada que un pendiente roto").
// EL ALCANCE TAMBIÉN PUEDE SER LO QUE FALTA (owner 2026-08-14, hilo medido del owner): el arm "no_entity" declara
// la variable pero no tiene entidad — ese estado se persiste con `faltaAlcance:true` (la pregunta abierta es
// "¿sobre qué?"), y cuando el usuario contesta "el total del negocio" el pendiente pasa a `alcance:"global"`
// (sin entidad puntual, deliberadamente). Ambos estados son pendientes legítimos: sin ellos, el turno siguiente
// caía a PLAN con un pendiente que PLAN no entiende — y PLAN fabricó un simulateCosto que nadie pidió.
function _pendienteBienFormado(p) {
  if (!p || typeof p !== "object" || !p.missingCampo || !p.known || typeof p.known.delta_pct !== "number") return false;
  return !!(p.entity || (Array.isArray(p.entities) && p.entities.length) || p.faltaAlcance === true || p.alcance === "global");
}

// nacePendingSimulation(pending) → el pendiente RECIÉN armado, con su plazo estampado. Es el único punto que fija
// `restan`: quien arma un pendiente no tiene que acordarse del TTL, solo de pasar por acá.
export function nacePendingSimulation(pending) {
  if (!_pendienteBienFormado(pending)) return null;
  return { ...pending, restan: PENDING_SIM_TTL_TURNOS };
}

// pendingSimulationVigente(pending) → el pendiente si TODAVÍA está en plazo, null si se le acabó o está roto.
// `restan` ausente (pendientes persistidos antes de este mecanismo) = plazo completo: una memoria vieja no se
// descarta por no traer un campo que no existía cuando se escribió.
export function pendingSimulationVigente(pending) {
  if (!_pendienteBienFormado(pending)) return null;
  const restan = typeof pending.restan === "number" ? pending.restan : PENDING_SIM_TTL_TURNOS;
  return restan > 0 ? pending : null;
}

// envejecerPendingSimulation(pending) → el pendiente con un turno menos de plazo, o null si se le acabó. Se llama
// UNA vez por turno, en el punto de salida que ese turno haya tomado (ruta PLAN o cualquiera de los bypasses) —
// nunca dos veces, o el plazo se consumiría al doble de velocidad que los turnos que lo gastan.
export function envejecerPendingSimulation(pending) {
  const p = pendingSimulationVigente(pending);
  if (!p) return null;
  const restan = (typeof p.restan === "number" ? p.restan : PENDING_SIM_TTL_TURNOS) - 1;
  return restan > 0 ? { ...p, restan } : null;
}

// repararPendingSimulation(pending, reparacion, plan) → qué queda del pendiente después de una corrección.
// LA MITAD QUE FALTABA DE §1: con el pendiente vivo, "No, era Jumbo" tiene que REESCRIBIRLO o MATARLO — si no, la
// próxima respuesta del usuario ("el volumen no cambia") ejecutaría la simulación sobre la entidad que él acaba de
// decir que estaba mal. Se reescribe cuando la corrección deja una entidad concreta en su lugar (el supuesto que
// el usuario YA aportó sigue siendo suyo: corrigió el sujeto, no el escenario) y se mata cuando la corrección se
// lleva el eje entero (pasó al negocio completo: ya no hay nada puntual que simular).
// Desacuerdo y dato aportado NO son correcciones de alcance (mismo criterio que applyRepairToScope): no tocan nada.
export function repararPendingSimulation(pending, reparacion, plan) {
  const p = pendingSimulationVigente(pending);
  if (!p) return null;
  const r = (reparacion && typeof reparacion === "object") ? reparacion : null;
  if (!r || r.tipo !== "correccion" || r.ambigua) return p;
  if (!camposQueSeInvalidan(r.corrige).includes("entities")) return p;   // corrigió otra cosa (período/métrica): el sujeto sigue siendo el mismo
  const scope = (plan && plan.scope) || null;
  const nuevas = (scope && Array.isArray(scope.entities)) ? scope.entities.filter(Boolean) : [];
  if (!nuevas.length || (scope && scope.level === "global")) return null;   // sin sujeto puntual que simular → el pendiente muere
  if (_mismasEntidades(p, nuevas)) return p;
  // la corrección le puso entidad: si el pendiente estaba esperando el alcance, esa espera terminó acá mismo —
  // dejar `faltaAlcance` vivo junto a una entidad haría que el motor volviera a preguntar lo que ya tiene.
  const { faltaAlcance: _fa, alcance: _al, ...resto } = p;
  return { ...resto, entity: nuevas[0], entities: nuevas.slice(), dimension: guessDimension(nuevas[0]) || p.dimension || null };
}

// fusionarPendientes(previo, nuevo) → LA REGLA DE PRECEDENCIA cuando este turno arma su propia simulación teniendo
// una pendiente viva. Es la que impide la degradación medida (el pendiente de Sodimac con precio +8% pisado por uno
// nuevo de Sodimac con volumen 0%, perdiendo el +8% que el usuario ya había dado):
//   · MISMA entidad + la variable que faltaba  → COMPLETAR: la simulación ya tiene sus dos supuestos, se ejecuta.
//   · MISMA entidad + la MISMA variable        → ACTUALIZAR: el usuario cambió de idea sobre el mismo supuesto.
//   · OTRA entidad                             → REEMPLAZAR: es otro escenario, el anterior se abandona.
// `nuevo` puede venir sin `restan` (recién armado por quien sea): todo lo que sale de acá pasa por nacePendingSimulation.
export function fusionarPendientes(previo, nuevo) {
  const p = pendingSimulationVigente(previo);
  if (!_pendienteBienFormado(nuevo)) return p ? { accion: "conserva", pending: p } : { accion: "ninguno", pending: null };
  if (!p) return { accion: "reemplaza", pending: nacePendingSimulation(nuevo) };
  const nuevasEnt = [nuevo.entity, ...(Array.isArray(nuevo.entities) ? nuevo.entities : [])].filter(Boolean);
  if (!_mismasEntidades(p, [...new Set(nuevasEnt)])) return { accion: "reemplaza", pending: nacePendingSimulation(nuevo) };
  if (nuevo.known.campo === p.missingCampo) {
    const conocida = p.known, aportada = { campo: nuevo.known.campo, delta_pct: nuevo.known.delta_pct };
    // el orden variableA/variableB lo fija el CAMPO (precio primero), igual que en la resolución del pendiente —
    // nunca el orden en que el usuario los fue nombrando.
    return { accion: "completa", pending: p, vars: conocida.campo === "precioLista" ? { variableA: conocida, variableB: aportada } : { variableA: aportada, variableB: conocida } };
  }
  return { accion: "actualiza", pending: nacePendingSimulation({ ...p, known: { campo: nuevo.known.campo, delta_pct: nuevo.known.delta_pct }, missingCampo: p.missingCampo }) };
}

// pendienteDesdeEscenario(intent) → el pendiente que DECLARA un turno cuyo texto trae campo+% y entidad (la salida
// de detectScenarioIntent, arms "future"/"future_multi"). Vive acá para que el orquestador pueda pasárselo a
// fusionarPendientes sin duplicar la traducción de un shape al otro en cada arm.
export function pendienteDesdeEscenario(intent) {
  if (!intent || !intent.variable || !intent.variable.campo) return null;
  const entities = intent.kind === "future_multi"
    ? ((Array.isArray(intent.entities) ? intent.entities : []).filter(Boolean))
    : (intent.entity ? [intent.entity] : []);
  if (!entities.length) return null;
  return {
    dimension: intent.dimension || guessDimension(entities[0]) || "cliente",
    entity: entities[0], entities,
    known: { campo: intent.variable.campo, delta_pct: intent.variable.delta_pct },
    missingCampo: intent.variable.campo === "precioLista" ? "unidades" : "precioLista",
  };
}

// ── EL TERCER UNIVERSO · la cifra que aporta el usuario (§5.1) ─────────────────────────────────────────────────
// "Queda marcada como suya en cada lugar donde aparezca · nunca se suma a un total sellado por el motor · todo
// cálculo derivado hereda su procedencia · se invalida junto con el resto del contexto incompatible."
// Vive en ConversationScopeEntry.supuestos —el campo que el shape original ya reservaba— no en una memoria nueva.
// Se guarda SOLO cuando el usuario autorizó tratarla como supuesto: una cifra suya que todavía no aceptó es una
// discrepancia que se muestra y se pregunta, no un supuesto vivo.
export const SUPUESTOS_USUARIO_MAX = 3;
// _supuestosHeredados(prevCurrent, dimensionNueva, entidadesNuevas) → los supuestos del usuario que SIGUEN
// vigentes en el alcance de este turno. Sobrevive el que no declaró alcance (aportado sobre el negocio completo,
// sin entidad: no hay alcance que contradecir) y el que comparte eje Y al menos una entidad con el turno nuevo.
// Cualquier otro cambió de alcance y muere, que es lo que pide el cuarto bullet de §5.1.
function _supuestosHeredados(prevCurrent, dimensionNueva, entidadesNuevas, tenantNuevo) {
  const prev = (prevCurrent && Array.isArray(prevCurrent.supuestos)) ? prevCurrent.supuestos : [];
  if (!prev.length) return [];
  // TENANT PRIMERO (defecto real, owner 2026-08-10): hasta este contrato NINGÚN campo de negocio cruzaba turnos
  // —`current` se reconstruía entero— así que la herencia convierte al supuesto en el primer dato que podría
  // cruzar la frontera entre empresas. Mismo criterio que validateScopeTenant: ante la duda se descarta ENTERO.
  const tenantPrev = (prevCurrent && prevCurrent.tenant && prevCurrent.tenant.tenantId) || null;
  const tenantAhora = (tenantNuevo && tenantNuevo.tenantId) || null;
  if (tenantPrev && tenantAhora && tenantPrev !== tenantAhora) return [];
  const ents = new Set(Array.isArray(entidadesNuevas) ? entidadesNuevas : []);
  return prev.filter((s) => {
    if (!s || s.origen !== "usuario") return false;
    const a = s.alcance;
    if (!a || !a.dimension || !Array.isArray(a.entities) || !a.entities.length) return true;   // sin alcance declarado
    if (dimensionNueva && a.dimension !== dimensionNueva) return false;
    return a.entities.some((e) => ents.has(e));
  });
}
export function withSupuestoUsuario(scope, dato, turno = null) {
  if (!scope || !scope.current || !dato || typeof dato !== "object") return scope || null;
  const valor = dato.valor == null ? "" : String(dato.valor).trim();
  if (!valor) return scope;
  // EL SUPUESTO GUARDA SU ALCANCE (owner 2026-08-10, revisión de la sección 8). Sin esto, una cifra aportada sobre
  // Falabella seguía viva —y autorizada en el guard— cuando la conversación pasaba a Lider: el cuarto bullet de
  // §5.1 dice que se invalida "cuando cambia el alcance", y el alcance no se podía comparar porque no se guardaba.
  const alcance = {
    dimension: scope.current.dimension || null,
    entities: Array.isArray(scope.current.entities) ? scope.current.entities.slice() : [],
  };
  const nuevo = { origen: "usuario", valor, metrica: dato.metrica ? String(dato.metrica) : null, periodo: dato.periodo ? String(dato.periodo) : null, alcance, turno };
  const prev = Array.isArray(scope.current.supuestos) ? scope.current.supuestos : [];
  // mismo LRU que el resto del estado conversacional: el más reciente primero, sin duplicar la misma cifra.
  const sin = prev.filter((s) => !(s && s.origen === "usuario" && s.valor === nuevo.valor && (s.metrica || null) === nuevo.metrica));
  return { ...scope, current: { ...scope.current, supuestos: [nuevo, ...sin].slice(0, SUPUESTOS_USUARIO_MAX) } };
}
// supuestosUsuarioVivos(scope) → los supuestos APORTADOS POR EL USUARIO que siguen vigentes. Lee del scope
// canónico; devuelve [] cuando no hay ninguno, que es el 100% de los turnos normales.
export function supuestosUsuarioVivos(scope) {
  const sup = scope && scope.current && Array.isArray(scope.current.supuestos) ? scope.current.supuestos : [];
  return sup.filter((s) => s && s.origen === "usuario" && s.valor);
}

// ── LA PREGUNTA DE PRECISIÓN (§4) ──────────────────────────────────────────────────────────────────────────────
// "ADI hace UNA SOLA pregunta, enfocada en las alternativas plausibles según el contexto. No enumera opciones que
// no correspondan." El mecanismo PRINCIPAL es que PLAN la redacte con el contexto del turno (reparacion.pregunta);
// esto es la red determinística para cuando no la trae — y por eso nombra SOLO lo que el turno anterior realmente
// tenía: si no hubo comparación no pregunta por el criterio, si hubo una sola entidad no pregunta cuál.
export function composePrecisionQuestion(scopeRoot, reparacion) {
  const r = (reparacion && typeof reparacion === "object") ? reparacion : {};
  const propia = typeof r.pregunta === "string" ? r.pregunta.trim() : "";
  if (propia) return propia;
  const cur = (scopeRoot && scopeRoot.current) || null;
  const candidatos = [];
  if (cur && Array.isArray(cur.entities) && cur.entities.length) candidatos.push("entidad");
  if (cur && cur.metrica) candidatos.push("metrica");
  if (cur && cur.periodo) candidatos.push("periodo");
  if (cur && cur.selection) candidatos.push("criterio");
  // LA CIFRA es corregible según §4 aunque no sea un campo del alcance (§2): "lo corregible puede ser la entidad,
  // la métrica, el período, el alcance, el criterio o LA CIFRA". Si el turno anterior mostró cifras, "ese número
  // no me cuadra" es una de las lecturas plausibles y la pregunta tiene que poder nombrarla.
  if (cur && cur.origen && Array.isArray(cur.origen.boletaLabels) && cur.origen.boletaLabels.length) candidatos.push("cifra");
  const nombres = { entidad: "la entidad", metrica: "la métrica", periodo: "el período", criterio: "el criterio", cifra: "la cifra" };
  const lista = candidatos.map((k) => nombres[k]).filter(Boolean);
  if (!lista.length) return "Dime qué parte está mal y la corrijo — ¿la pregunta que entendí, o el dato que traje?";
  const ultimo = lista.pop();
  const enumeracion = lista.length ? `${lista.join(", ")} o ${ultimo}` : ultimo;
  return `Antes de rehacerlo, dime qué corrijo: ¿${enumeracion}?`;
}

// ── buildEntityList(toolName, result) → {dimension, entities, orden} | null ────────────────────────────────────
// MECANISMO UNIVERSAL: los labels de boleta de las tools de lectura/diagnóstico/simulación siguen la convención
// "<entidad> · <label>" (verificado por lectura directa: simulateGeneral/toolRegistry.js "${entity} · Venta
// actual", entityRecord.js _formatRecord "${entity} · ${label}", specRetrieval.js composeSpecInventory
// "${s.sku} · Capital detenido"/composeSpecMargin lever "${row.nombre} · Medida cerrar brecha", entityRecord.js
// buildTension "${x.e} · ${m.l}"). Extrae el prefijo antes de " · " de cada fig de `result.boleta` (NUNCA de
// `result.facts` crudo — facts puede traer listas SIN el tope que la tool realmente autorizó a narrar, ej.
// facts.inventory.bySku es la lista COMPLETA sin cap mientras boleta trae solo el top-3/4 ya sellado — usar facts
// capturaría entidades que el narrador nunca nombró, rompiendo "los N EXACTOS" del caso obligatorio), dedupea
// preservando orden, y descarta cualquier candidato para el que guessDimension() devuelva null (filtra
// automáticamente labels que no son entidades reales: "Benchmark de margen", "Resto (3 de 8)", "Estado del
// inventario: …", "Medida · liberar X y Y" — ninguno de esos matchea un nombre real del dato).
//
// RESOLUCIÓN DE DIMENSIÓN (hallazgo empírico 2026-08-03, ver openRisks del diseño — "antes de confiar en este
// mecanismo universalmente, correr un chequeo determinístico contra varios composers"; se corrió contra
// inventoryStatus/marginRead/salesRead/contributionRead/diagnose/entityProfile/entityRecord/simulateCarga/
// simulateCapital/simulateGeneral/compareEntities/gridTable/tensionRead/queryMetric con datos reales del demo):
//   1. Si `facts.entityType` es un eje válido (sku/cliente/marca/familia) → se usa tal cual — es la declaración
//      EXPLÍCITA de la tool (entityRecord/entityProfile/gridTable/tensionRead/compareEntities YA lo estampan).
//   2. Si no, y la tool NO está en `_AMBIGUOUS_DIMENSION_TOOLS`, `facts.dimension` (si es un eje válido) — vale
//      para marginRead/salesRead/contributionRead/diagnose/simulateCarga/simulateGeneral/queryMetric: ahí
//      `dimension` SÍ describe el eje de las entidades nombradas en la boleta.
//   3. Si no (inventoryStatus: `facts.dimension` describe el eje de AGRUPACIÓN de la narrativa — "Por bodega:"/
//      "Por familia:" — NO el eje de las entidades puntuales, que casi siempre son SKU; confirmado en vivo: para
//      "capital inmovilizado" default, la boleta trae 2 familias ANTES que los 3 SKU reales) → fallback de
//      MAYORÍA entre los candidatos con dimensión válida, empate roto por el grupo que aparece MÁS TARDE en la
//      boleta (el detalle puntual —lo que casi siempre importa para "estos X"— tiende a listarse al final: total
//      → agregados por bodega/familia → detalle por entidad).
// LÍMITE CONOCIDO (no resuelto acá, documentado): `diagnose`/`executiveSummary` son estructuralmente
// MULTI-dimensión (comercial por cliente + capital por SKU en la MISMA boleta) — el fallback de mayoría no separa
// ambos grupos, elige uno. Generalizar diagnose a un contrato multi-eje es Etapa 2 (toolContracts.js), fuera de
// alcance acá; mientras tanto, una referencia tipo "esos SKU" después de un `diagnose` puede resolver mal si el
// diagnose trajo más entidades de cliente que de SKU. bodega/canal SÍ resuelven desde Etapa 1 (owner 2026-08-04):
// guessDimension (entityRecord.js) reconoce ambos ejes group-by vía ENTITIES.bodega/canal (entityRegistry.js) —
// mismo mecanismo universal de este archivo, sin caso especial acá (inventoryStatus, el composer típico que trae
// grupos de bodega en su boleta, sigue en `_AMBIGUOUS_DIMENSION_TOOLS` → el fallback de mayoría decide entre sku/
// bodega/familia por conteo, igual que antes decidía entre sku/familia).
const _AMBIGUOUS_DIMENSION_TOOLS = new Set(["inventoryStatus"]);

export function buildEntityList(toolName, result) {
  if (!result || !Array.isArray(result.boleta) || !result.boleta.length) return null;
  const facts = (result.facts && typeof result.facts === "object") ? result.facts : {};
  const seen = new Set();
  const candidates = [];
  for (const f of result.boleta) {
    if (!f || typeof f.label !== "string") continue;
    const sepIdx = f.label.indexOf(" · ");
    const name = (sepIdx === -1 ? f.label : f.label.slice(0, sepIdx)).trim();
    if (!name || seen.has(name)) continue;
    const dim = guessDimension(name);
    if (!dim) continue;   // no es una entidad real del dato — descartado (Benchmark/Resto/Estado/Medida/…)
    seen.add(name);
    candidates.push({ name, dim });
  }
  if (!candidates.length) return null;

  let dimension = null;
  if (_AXES.has(facts.entityType)) dimension = facts.entityType;
  else if (!_AMBIGUOUS_DIMENSION_TOOLS.has(toolName) && _AXES.has(facts.dimension)) dimension = facts.dimension;
  if (!dimension) {
    const counts = new Map(), lastIdx = new Map();
    candidates.forEach((c, i) => { counts.set(c.dim, (counts.get(c.dim) || 0) + 1); lastIdx.set(c.dim, i); });
    let best = null;
    for (const [dim, count] of counts) {
      if (!best || count > best.count || (count === best.count && lastIdx.get(dim) > lastIdx.get(best.dim))) best = { dim, count };
    }
    dimension = best.dim;
  }

  const entities = candidates.filter((c) => c.dim === dimension).map((c) => c.name);
  if (!entities.length) return null;
  const orden = facts.orden || facts.ordenA || facts.ordenB || null;
  return { dimension, entities, orden };
}

// ── updateConversationScope(scopePrev, {plan, calls, results, turno, requestContext}) → {version,current,history}
// Corre en el MISMO punto donde hoy corre updateRecentSubjects (dialogueState.js), después de runPlan.
export function updateConversationScope(scopePrev, { plan, calls, results, turno, requestContext, seleccion, ordenPresentado } = {}) {
  const prev = (scopePrev && typeof scopePrev === "object") ? scopePrev : emptyConversationScope();
  const history = Array.isArray(prev.history) ? prev.history.slice(0, 3) : [];
  const tenant = (requestContext && requestContext.tenantId)
    ? { tenantId: requestContext.tenantId, dataSnapshotId: requestContext.dataSnapshotId || null }
    : (prev.current && prev.current.tenant) || null;

  /* ── LA SELECCIÓN DENTRO DEL CONJUNTO PRESENTADO (2026-09-11) ──────────────────────────────────────────────
   * «Profundiza en el primero» NO cambia el conjunto: el usuario sigue mirando los cuatro y eligió uno. Si este
   * turno pisara `current` con las cifras de Lider, «ahora el segundo» y «los otros tres» se quedarían sin
   * conjunto. La selección vive en `selection.subset` —el campo que el shape ya tenía para esto— y el conjunto
   * se conserva. `anterior` guarda la selección previa (para «compáralo con el anterior»), y solo cuando hubo
   * una: recién mostrado el conjunto, no hay «anterior» que nombrar. Aplica ÚNICAMENTE si lo seleccionado está
   * dentro del conjunto vigente; una entidad de afuera es un tema nuevo y sigue el camino de siempre. */
  const selEnts = (seleccion && Array.isArray(seleccion.entities)) ? seleccion.entities.filter(Boolean) : [];
  /* ⚠️ SOLO UN SUBCONJUNTO PROPIO: si «eso» resolvió al conjunto ENTERO («¿qué clientes explican eso?»), el turno
   * es una lectura nueva y sigue el camino de siempre — sus resultados, en el orden que la respuesta presentó,
   * pisan el conjunto. Tratarlo como selección habría conservado el orden VIEJO bajo una tabla nueva: el
   * mismo defecto que esto cierra, por la puerta de atrás. */
  if (selEnts.length && prev.current && Array.isArray(prev.current.entities) && prev.current.entities.length >= 2
      && selEnts.length < prev.current.entities.length
      && prev.current.dimension !== "cartera" && selEnts.every((e) => prev.current.entities.includes(e))) {
    const subPrev = prev.current.selection && prev.current.selection.subset;
    const anterior = (subPrev && Array.isArray(subPrev.entities) && subPrev.entities.length && subPrev.entities.join("|") !== selEnts.join("|")) ? subPrev.entities : (subPrev && subPrev.anterior) || null;
    const current = {
      ...prev.current, turno: turno == null ? prev.current.turno : turno,
      selection: { ...(prev.current.selection || { orden: null }), subset: { kind: "seleccion", entities: selEnts, anterior } },
    };
    return { version: 1, current, history };
  }

  // CAMBIO REAL DE TEMA — disparador ÚNICO (a propósito, para no inventar un segundo clasificador difuso):
  // plan.scope.level==="global" es la señal EXPLÍCITA que PLAN ya emite por doctrina existente (planPrompt.js,
  // "REGLA DE ALCANCE" — sin tocar el prompt) cuando el usuario dice "el negocio"/"en general"/"la cartera". Es el
  // ÚNICO punto donde `current` se retira a `history`; en cualquier otro turno `current` simplemente se
  // sobrescribe (mismo comportamiento LRU que recentSubjects ya tiene hoy).
  if (plan && plan.scope && plan.scope.level === "global") {
    const nextHistory = prev.current ? [prev.current, ...history].slice(0, 3) : history;
    const cartera = {
      turno: turno == null ? null : turno, dimension: "cartera", entities: [],
      selection: null, periodo: null, filtros: null, metrica: null,
      operacion: (plan && plan.intent) || null, modo: (plan && plan.mode) || null,
      tool: (Array.isArray(calls) && calls[0] && calls[0].tool) || null,
      origen: { callId: null, boletaLabels: [] },
      supuestos: [], faltantes: [], ofertaPendiente: null, tenant,
    };
    return { version: 1, current: cartera, history: nextHistory };
  }

  const arr = Array.isArray(results) ? results : [];
  let built = null, builtFrom = null;
  /* ⚠️ CON DOS HERRAMIENTAS HAY DOS ÓRDENES SELLADOS, y se vio en la pantalla del owner (2026-09-11): la prosa
   * enumeró en el orden de `rolesCartera` (Falabella primero, por venta) y la tabla en el de `marginRead`
   * (Lider primero, por brecha). «El primero» era ambiguo dentro de la misma respuesta. `ordenPresentado` es el
   * orden en que las entidades aparecen en las FILAS DE TABLA de la respuesta aprobada (y si no hay tabla, en
   * el texto): NO es la fuente de las entidades —siguen saliendo de un resultado estructurado— sino el criterio
   * para elegir CUÁL de los resultados sellados es el que el usuario vio. Sin él, gana el primero de siempre. */
  const primeroVisto = (Array.isArray(ordenPresentado) && ordenPresentado.length) ? ordenPresentado[0] : null;
  const construidos = arr.map((r) => ({ r, b: buildEntityList(r && r.tool, r) })).filter((x) => x.b && x.b.entities.length);
  const elegido = (primeroVisto && construidos.find((x) => x.b.entities[0] === primeroVisto)) || construidos[0] || null;
  if (elegido) { built = elegido.b; builtFrom = elegido.r; }
  const planEntities = (plan && plan.scope && Array.isArray(plan.scope.entities)) ? plan.scope.entities.filter(Boolean) : [];
  /* EL CONJUNTO ES LO QUE EL USUARIO VIO, dentro de lo sellado (2026-09-11): la herramienta devolvió ocho
   * clientes y la tabla mostró cuatro; «los otros tres» son tres, no siete. Se conservan SOLO las entidades del
   * resultado estructurado que la respuesta presentó, en el orden en que las presentó — nunca un nombre que
   * la prosa haya inventado (la regla de fidelidad sigue intacta: el filtro corre sobre `built.entities`). Con
   * menos de dos presentadas no hay conjunto que recortar y queda el de la herramienta. */
  const vistas = (built && Array.isArray(ordenPresentado)) ? ordenPresentado.filter((e) => built.entities.includes(e)) : [];
  const entities = built ? (vistas.length >= 2 ? vistas : built.entities) : planEntities.filter((e) => guessDimension(e));
  // sin entidades nuevas que nombrar (declinó / respuesta agregada sin entidad puntual / intent=define-ack) → NO
  // pisa el scope anterior con uno vacío — conserva `current`/`history` tal cual (mismo criterio que "mejor nada
  // que un pendiente roto" en dialogueState.js: perder memoria por una consulta que no trajo nada nuevo sería peor
  // que simplemente no actualizar).
  if (!entities.length) return { version: 1, current: prev.current || null, history };

  const dimension = built ? built.dimension : guessDimension(entities[0]);
  const dominant = Array.isArray(calls) && calls[0];
  // el período que se RECUERDA del turno (persona.js lo surfacea como "período ya mostrado"): la etiqueta corta,
  // no la frase que instruye al narrador — un resultado de marco MIXTO trae un párrafo ahí (decisión 5).
  const periodoHallado = arr.map((r) => {
    const f = r && r.facts;
    if (!f) return null;
    if (Array.isArray(f.periodos) && f.periodos.length > 1) return PERIODO_MIXTO_ETIQUETA;
    return f.periodo || null;
  }).find(Boolean) || null;
  const ordenHallado = (built && built.orden) || null;
  const filtrosDominante = (dominant && dominant.args && dominant.args.filters && typeof dominant.args.filters === "object" && !Array.isArray(dominant.args.filters)) ? dominant.args.filters : null;
  // metrica: best-effort (token del vocabulario compartido, cuando la call lo declara explícito) — NUNCA autoridad
  // para el resolver de referencias (que solo lee dimension/entities/selection); solo trazabilidad para consumo
  // futuro (Etapa 2/3, ej. reconstruir un pendingSimulation con la métrica ya conocida).
  const metricaDominante = (dominant && dominant.args && (dominant.args.metric || dominant.args.metricA || dominant.args.sortBy)) || null;

  const current = {
    turno: turno == null ? null : turno,
    dimension: dimension || null,
    entities,
    selection: ordenHallado ? { orden: ordenHallado, subset: { kind: "top", n: entities.length || null } } : null,
    periodo: periodoHallado,
    filtros: filtrosDominante,
    metrica: metricaDominante,
    operacion: (plan && plan.intent) || null,
    modo: (plan && plan.mode) || null,
    tool: (dominant && dominant.tool) || null,
    origen: {
      callId: (builtFrom && builtFrom.callId) || (arr[0] && arr[0].callId) || null,
      boletaLabels: (builtFrom && Array.isArray(builtFrom.boleta)) ? builtFrom.boleta.slice(0, 8).map((f) => f.label) : [],
    },
    // EL SUPUESTO DEL USUARIO SE HEREDA, PERO SOLO DENTRO DE SU ALCANCE (Contrato v1.2 §5.1, owner 2026-08-10).
    // "Queda marcada como suya MIENTRAS SIGA VIVA EN LA CONVERSACIÓN" y "se invalida junto con el resto del
    // contexto incompatible cuando cambia el alcance" — las dos mitades de la misma regla. Este objeto se
    // reconstruye entero en cada turno con entidades nuevas: sin heredar, la cifra duraba un turno y la
    // procedencia se olvidaba sola (peor que no tenerla, porque la cifra sigue en el hilo sin marca); heredando
    // sin condición, una cifra aportada sobre Falabella seguía autorizada en el guard hablando de Lider.
    // Solo los de ORIGEN usuario: los supuestos que sella un composer de simulación son del turno que los produjo.
    supuestos: _supuestosHeredados(prev.current, dimension, entities, tenant),
    faltantes: [],
    ofertaPendiente: null,
    tenant,
  };
  return { version: 1, current, history };
}

// ── validateScopeTenant(scopeRoot, requestContext) → {ok, reason?} ──────────────────────────────────────────────
// Mismo shape {ok,reason} que assertTenantContext (requestContext.js) — no inventa una segunda convención. Si el
// tenant del scope guardado no coincide con el tenant ACTIVO de este turno, el scope se descarta ENTERO (nunca
// reuso parcial) — ver resolveConversationReference, que usa esto como guard de entrada.
export function validateScopeTenant(scopeRoot, requestContext) {
  const entry = (scopeRoot && scopeRoot.current) || (scopeRoot && Array.isArray(scopeRoot.history) && scopeRoot.history[0]) || null;
  if (!entry || !entry.tenant) return { ok: true };   // nada que validar (scope vacío/sin tenant registrado)
  if (!requestContext || typeof requestContext !== "object" || !requestContext.tenantId) {
    return { ok: false, reason: "sin requestContext — no se puede validar el tenant del scope conversacional" };
  }
  if (entry.tenant.tenantId !== requestContext.tenantId) {
    return { ok: false, reason: `el scope conversacional pertenece al tenant "${entry.tenant.tenantId}" pero el turno actual es del tenant "${requestContext.tenantId}" — se descarta, nunca se mezcla dato entre empresas` };
  }
  return { ok: true };
}

// ── resolveOrdinalReference(text, current) → {kind:"resolved", entities} | null ─────────────────────────────────
// "el primero"/"los dos primeros"/"el último"/"los peores"/"los mejores" — recorta `current.entities` (YA en el
// orden que la tool selló, ver `current.selection.orden`) SIN re-derivar el ranking. Solo lee `current` (NUNCA
// `history` — un ordinal es sobre el tema QUE ESTÁ vigente, no sobre uno anterior). Devuelve null cuando el texto
// no trae ningún patrón ordinal reconocible (el llamador sigue con la resolución deíctica normal).
const _NUM_WORDS = { un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5 };
const _ORD_N_RE = /\blos?\s+(dos|tres|cuatro|cinco|\d+)\b/i;
const _ORD_PRIMERO_RE = /\bel\s+primero\b|\bla\s+primera\b|\blos?\s+primeros?\b/i;
const _ORD_ULTIMO_RE = /\bel\s+[uú]ltimo\b|\bla\s+[uú]ltima\b|\blos?\s+[uú]ltimos?\b/i;
const _ORD_PEOR_RE = /\bpeor(?:es)?\b/i;
const _ORD_MEJOR_RE = /\bmejor(?:es)?\b/i;
/* ══ EL CAMINO DEL AGENTE ENTRA AL SCOPE CANÓNICO (owner 2026-09-11) ═══════════════════════════════════════
 * LA PRUEBA DE CONTINUIDAD DEL OWNER: «¿qué está explicando ese resultado?» redujo el negocio a Falabella, y
 * «profundiza en el primero» sobre una tabla que abría con Lider respondió Falabella. Auditado offline: en el
 * camino del agente NADIE conservaba ni resolvía `scope activo → conjunto presentado → ordinal → entidad
 * activa` — todo vivía en la lectura que el modelo hace del hilo. Este archivo lo hacía bien para el oráculo
 * y quedó huérfano tras La Poda. Su orden, textual: «reutilizando conversationScope y los mecanismos
 * existentes. No quiero otra memoria paralela ni otro resolver». Lo que sigue EXTIENDE este resolver con lo
 * que la conversación real pide y hoy no leía; no nace otro.
 *   · «el segundo» / «la tercera» — la posición, no solo primero/último.
 *   · «el anterior» — la entidad que estaba activa ANTES de la actual (la selección previa dentro del mismo
 *     conjunto), para «compáralo con el anterior».
 *   · «los otros (tres)» / «los demás» — el complemento de la selección dentro del conjunto presentado; si
 *     el número no calza, NO se adivina.
 *   · el deíctico SINGULAR («ese», «esa cuenta», «¿y ese?», «compáralo») y el NEUTRO («eso», «esto», «ese
 *     resultado»): el neutro apunta al RESULTADO y conserva el alcance vigente —negocio entero o selección—,
 *     el otro apunta a UN ítem y exige que haya uno activo; con varios, se pregunta (nunca se elige solo).
 * LA REGLA DE FIDELIDAD NO CAMBIA: todo esto sigue leyendo SOLO `current.entities` (orden sellado por la
 * herramienta) y `current.selection.subset` (lo que el usuario seleccionó dentro de ese conjunto). */
const _ORD_POS = { segund: 2, tercer: 3, cuart: 4, quint: 5 };
const _ORD_POS_RE = /\b(?:el|la)\s+(segund|tercer|cuart|quint)[oa]\b/i;
const _ORD_ANTERIOR_RE = /\b(?:el|la)\s+anterior\b/i;
const _OTROS_RE = /\b(?:los|las)\s+(?:otr[oa]s|dem[aá]s)\b(?:\s+(dos|tres|cuatro|cinco|\d+))?/i;
/* SINGULAR NEUTRO — apunta a lo dicho, no a un ítem: «eso», «esto», «ese resultado», «esa lectura». Conserva
 * el alcance vigente: si ADI hablaba del negocio entero, «¿qué explica eso?» sigue siendo del negocio entero.
 * Es el caso 1 de la prueba del owner: una referencia anafórica jamás REDUCE el scope sin instrucción. */
const _DEICTIC_NEUTRO_RE = /\b(?:eso|esto)\b|\b(?:es[ea]|est[ea])\s+(?:resultado|an[aá]lisis|lectura|diagn[oó]stico|respuesta|conclusi[oó]n|brecha|ca[ií]da|subida|n[uú]mero|cifra|dato|punto|tema)\b/i;
/* SINGULAR CON GÉNERO — apunta a UN ítem: «ese», «esa cuenta», «este cliente», «¿y ese?», y el clítico singular
 * pegado al verbo («compáraLO», «profundízaLA»). Quedan fuera los sustantivos de TIEMPO («esta semana», «este
 * año» — un plan de la semana no tiene referente de entidad) y los de COMPONENTE («este gráfico», «esa tabla»:
 * de eso se ocupa DEICTIC_COMPONENT_RE con el ViewContext). */
/* ⚠️ «esta» SIN TILDE ES «está» EN MEDIO CHAT («Falabella esta perdiendo margen»), y un demostrativo suelto lo
 * confundiría con un deíctico. Por eso el demostrativo con género solo cuenta en POSICIÓN de referencia: al
 * arranque o tras una preposición/conjunción («¿y ese?», «en ese», «con esa»), y seguido de puntuación o de un
 * sustantivo de entidad («esa cuenta», «este cliente»). Un «esta» pegado a un verbo no es un deíctico. */
const _DEICTIC_SING_RE = /(?:^|[¿¡,;:(]\s*|\b(?:y|en|con|sobre|de|a|por|para|desde|hacia|contra|solo|s[oó]lo)\s+)(?:es[ea]|est[ea])(?=\s*(?:[?.!,;)]|$)|\s+(?:cuenta|cliente|marca|familia|sku|producto|bodega|canal|proveedor|art[ií]culo|categor[ií]a|sucursal|uno|una)\b)|\b(?:comp[aá]r|profund[ií]z|anal[ií]z|rev[ií]s|expl[ií]c|m[ií]r|abr[ií]|sim[uú]l|desglos)al[oa]\b/i;
export const DEICTIC_SINGULAR_RE = new RegExp(`${_DEICTIC_NEUTRO_RE.source}|${_DEICTIC_SING_RE.source}`, "i");
/* lo que está ACTIVO dentro del conjunto: la selección si la hay, si no el conjunto entero */
function _activas(current) {
  const sub = current && current.selection && current.selection.subset;
  if (sub && Array.isArray(sub.entities) && sub.entities.length) return sub.entities;
  return (current && Array.isArray(current.entities)) ? current.entities : [];
}
function _anteriorDe(current) {
  const sub = current && current.selection && current.selection.subset;
  return (sub && Array.isArray(sub.anterior) && sub.anterior.length) ? sub.anterior : null;
}
export function esAlcanceGlobal(text) {
  /* las MISMAS palabras que la doctrina de PLAN ya trataba como cambio de tema («el negocio», «en general», «la
   * cartera») — acá en regla, porque el agente no tiene PLAN que lo emita. Lista corta y cerrada a propósito. */
  return /\b(?:todo el|al|el)\s+negocio(?:\s+(?:completo|entero))?\b|\btoda la cartera\b|\bla cartera(?:\s+(?:completa|entera))?\b|\ben general\b|\bnegocio completo\b|\bvisi[oó]n global\b/i.test(String(text || ""));
}
function _ordN(text) {
  const m = _ORD_N_RE.exec(text);
  if (!m) return null;
  const raw = m[1].toLowerCase();
  return _NUM_WORDS[raw] || parseInt(raw, 10) || null;
}
/* ⚠️ UNA LECTURA NUEVA NO ES UNA REFERENCIA (cazado al cablear el agente, 2026-09-11): «dame los 5 clientes de
 * mejor margen» tras una tabla de cuatro resolvía «los 5» y «mejor» sobre el conjunto presentado. En el oráculo
 * este resolutor corría solo cuando PLAN no había resuelto; en el agente no hay PLAN, así que el contrapeso va
 * acá: si la frase NOMBRA una métrica es un ranking nuevo sobre esa métrica, y si pide más de los que hay no
 * puede estar hablando de ellos. Las formas POSICIONALES («el primero», «el segundo», «el anterior», «los
 * otros») no dependen de métrica alguna y siguen resolviendo. */
const _NOMBRA_METRICA_RE = /\b(?:m[aá]rgen(?:es)?|ventas?|contribuci[oó]n|carga|rotaci[oó]n|stock|capital|cobertura|rentabilidad|brecha|costos?|precio)\b/i;
export function resolveOrdinalReference(text, current) {
  const t = String(text || "");
  if (!current || !Array.isArray(current.entities) || !current.entities.length) return null;
  const entities = current.entities;
  const nCrudo = _ordN(t);
  if (nCrudo && nCrudo > entities.length) return null;          // «los 5» sobre cuatro: pide otra cosa
  const lecturaNueva = _NOMBRA_METRICA_RE.test(t);
  const n = lecturaNueva ? null : nCrudo;

  /* «el anterior» — la selección PREVIA dentro del mismo conjunto. Con un deíctico singular al lado
   * («compáraLO con el anterior») la resolución son los dos: la activa y la anterior, en ese orden. */
  if (_ORD_ANTERIOR_RE.test(t)) {
    const ant = _anteriorDe(current);
    if (!ant) return { kind: "decline", reason: "sin_anterior" };
    const conActiva = _DEICTIC_SING_RE.test(t) ? _activas(current) : [];
    return { kind: "resolved", entities: [...new Set([...conActiva, ...ant])] };
  }
  /* «los otros (tres)» — el complemento de la selección dentro del conjunto presentado */
  const mOtros = _OTROS_RE.exec(t);
  if (mOtros) {
    const activas = _activas(current);
    const otros = entities.filter((e) => !activas.includes(e));
    if (!otros.length) return { kind: "decline", reason: "sin_referente" };
    const k = mOtros[1] ? (_NUM_WORDS[mOtros[1].toLowerCase()] || parseInt(mOtros[1], 10)) : null;
    if (k && k !== otros.length) return { kind: "decline", reason: "conteo_no_calza", detalle: { pedidos: k, hay: otros.length, otros } };
    return { kind: "resolved", entities: otros };
  }
  const pos = _ORD_POS_RE.exec(t);
  if (pos) {
    const i = _ORD_POS[pos[1].toLowerCase()] - 1;
    return i < entities.length ? { kind: "resolved", entities: [entities[i]] } : { kind: "decline", reason: "sin_referente" };
  }
  if (_ORD_PRIMERO_RE.test(t)) return { kind: "resolved", entities: entities.slice(0, n || 1) };
  if (_ORD_ULTIMO_RE.test(t)) return { kind: "resolved", entities: entities.slice(-(n || 1)) };

  // dirección YA SELLADA por la tool (current.selection.orden), NUNCA re-derivada — sin ella, "peor/mejor" es
  // ambiguo (no sabemos si el ranking mostrado es ascendente o descendente) y se deja pasar (null).
  const ordenTxt = current.selection && typeof current.selection.orden === "string" ? current.selection.orden : null;
  if ((_ORD_PEOR_RE.test(t) || _ORD_MEJOR_RE.test(t)) && !lecturaNueva) {
    if (!ordenTxt) return null;
    const asc = /ascendente/i.test(ordenTxt);
    const wantsWorst = _ORD_PEOR_RE.test(t);
    // ascendente = de menor a mayor (el primero de la lista YA es el más bajo) · descendente = de mayor a menor
    // (el ÚLTIMO de la lista mostrada es el más bajo de los mostrados).
    const takeFromStart = wantsWorst ? asc : !asc;
    const k = n || 1;
    return takeFromStart ? { kind: "resolved", entities: entities.slice(0, k) } : { kind: "resolved", entities: entities.slice(-k) };
  }
  if (n) return { kind: "resolved", entities: entities.slice(0, n) };   // "los dos"/"los 3" sin calificador → cardinalidad simple
  return null;
}

// ── resolveConversationReference(text, plan, scopePrev, requestContext) ─────────────────────────────────────────
//   → {kind:"resolved", entities, dimension} | {kind:"ambiguous", options} | {kind:"none"}
// Se invoca DESDE answerViaOracle.js, en la MISMA cadena que _coerceEntityScopedFilters/_coerceTensionArgs — solo
// cuando el plan vino de una llamada REAL a PLAN (no de un plan sintético ya resuelto por otro bypass, ver
// answerViaOracle.js:_coerceConversationScope).
// exportado (Etapa 3, owner 2026-08-03) — scenarioIntent.js lo reusa para su arm "future_multi" (ver el comentario
// de cabecera de ese archivo): UNA sola fuente de verdad del patrón deíctico plural, nunca 2 regex que puedan
// divergir (mismo principio que ZERO_EXPLICIT_RE, compartido entre scenarioIntent.js y answerViaOracle.js).
// AMPLIACIÓN (owner 2026-08-03, hallazgo del revisor de continuidad universal, verificado con ejecución real):
// el regex original no reconocía verbo+clítico ("comparalos"/"compáralos"/"simulalos"/"simúlalos") ni el
// deíctico espacial "ahí" — 2 de las formas EXACTAS que el owner listó como obligatorias ("compáralos,
// simúlalos, profundiza ahí"). Sin esto, "Simúlalos: sube el precio 3%." en vez de "estos SKU" reproducía una
// versión más leve del bug original (re-pregunta algo que el sistema ya sabía). Extensión ANGOSTA (misma
// disciplina que el resto de regexes deterministas del repo, ver _SEGUIMIENTO_VERB_RE/_PREF_*_RE en
// answerViaOracle.js): enumera los verbos de acción que ya aparecen en la doctrina del motor (comparar/
// simular/profundizar/analizar/revisar) + el clítico los/las, en vez de una regla gramatical genérica de
// sufijo (que arriesgaría falsos positivos con sustantivos comunes terminados en "-alos"/"-alas", ej.
// "regalos") — y "ahí"/"ahi" (con o sin tilde) como deíctico espacial explícito.
export const DEICTIC_PLURAL_RE = /\best[oa]s\b|\bes[oa]s\b|\bell[oa]s\b|\blos?\s+mismos?\b|\b(?:comp[aá]r|sim[uú]l|profund[ií]z|anal[ií]z|rev[ií]s)al[oa]s\b|\bah[ií](?![a-záéíóúñ])/i;
const _DEICTIC_PLURAL_RE = DEICTIC_PLURAL_RE;
// _RECALL_MARK_RE — SOLO con esta marca explícita se consulta `history` además de `current` (ver el comentario
// largo más abajo, "por qué history NO entra en el caso común"). Sin ella, un "estos/esos" plano SOLO mira
// `current` — nunca resucita un tema abandonado por un cambio de tema real.
const _RECALL_MARK_RE = /\bde\s+antes\b|\bde\s+nuevo\b|\botra\s+vez\b|\banterior(?:es)?\b|\bque\s+ten[ií]amos\b/i;
const _DIM_HINT = [
  [/\bskus?\b/i, "sku"],
  [/\bclientes?\b/i, "cliente"],
  [/\bmarcas?\b/i, "marca"],
  [/\bfamilias?\b/i, "familia"],
  [/\bbodegas?\b/i, "bodega"],   // Etapa 1 (owner 2026-08-04) — "esas bodegas"/"esos canales" como pista explícita
  [/\bcanales?\b/i, "canal"],    // de desambiguación (sin esto el pool cae al filtro por defecto igual, no bloqueaba)
];
function _dimHint(text) {
  for (const [re, dim] of _DIM_HINT) if (re.test(text)) return dim;
  return null;
}
function _dedupeGroups(groups) {
  const seen = new Set();
  const out = [];
  for (const g of groups) {
    const key = `${g.dimension}::${g.entities.join(",")}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(g);
  }
  return out;
}

// _looksLikeReference(text) → true si el texto trae CUALQUIER marcador que este módulo reconoce como una
// referencia conversacional inequívoca (deíctico plural u ordinal/superlativo) — usado SOLO para distinguir un
// rechazo EXPLÍCITO (composeReferenceDecline: "sí había una referencia, no la puedo honrar") de un "none" mudo
// (no había nada que este módulo debiera resolver este turno, PLAN sigue con su criterio normal).
function _looksLikeReference(t) {
  return _DEICTIC_PLURAL_RE.test(t) || _ORD_PRIMERO_RE.test(t) || _ORD_ULTIMO_RE.test(t) || _ORD_PEOR_RE.test(t) || _ORD_MEJOR_RE.test(t) || !!_ordN(t)
    || _ORD_POS_RE.test(t) || _ORD_ANTERIOR_RE.test(t) || _OTROS_RE.test(t) || DEICTIC_SINGULAR_RE.test(t);
}

// _uiSignalsGroup(uiSignals) → {dimension,entities}|null — Etapa 3 (owner 2026-08-03): "chips, tablas, filas de
// Sentrix... deben pasar TODAS por el MISMO mecanismo de contexto (nunca un camino paralelo para UI vs texto)".
// uiSignals.mesaSel (selección de checkboxes en la Mesa, ver SentrixPanel.jsx/uiSignals.js) hoy SOLO alimenta la
// ruta LEGACY (coerceChain.js) — un camino paralelo real: con el oráculo ON, "comparalos" tras seleccionar 2 filas
// en la Mesa no llegaba a esta resolución. Se trata como UN CANDIDATO MÁS del pool (mismas 4 reglas: cada entidad
// se REVALIDA con guessDimension — nunca se confía ciegamente en lo que viajó de la UI — y el eje declarado por la
// Mesa, si vino, se usa solo como HINT, no como autoridad). NUNCA reemplaza `current`/`history`: si ambos existen a
// la vez y no coinciden, es ambigüedad real (ver `pool` más abajo), nunca un silencioso "gana la UI".
function _uiSignalsGroup(uiSignals) {
  if (!uiSignals || !Array.isArray(uiSignals.mesaSel)) return null;
  const raw = uiSignals.mesaSel.filter((e) => typeof e === "string" && e);
  if (raw.length < 2) return null;
  const dims = raw.map((e) => guessDimension(e));
  const dimension = (typeof uiSignals.mesaDim === "string" && _AXES.has(uiSignals.mesaDim)) ? uiSignals.mesaDim : dims.find(Boolean) || null;
  if (!dimension) return null;
  const entities = raw.filter((e, i) => dims[i] === dimension);   // revalidación: solo las que SÍ pertenecen a ese eje
  return entities.length >= 2 ? { dimension, entities } : null;
}

// ── CONTEXTO DE PANTALLA (owner 2026-08-09, Contrato de Concordancia ADI↔Sentrix) ──────────────────────────────
// _viewContextGroup(vc) → GEMELO de _uiSignalsGroup (arriba): el ViewContext sellado entra al pool como UN
// CANDIDATO MÁS, con la MISMA disciplina — cada entidad se REVALIDA con guessDimension (nunca se confía en lo que
// viajó de la UI), el eje declarado por la vista es HINT y no autoridad, y si sobrevive junto a `current` sin
// coincidir es AMBIGÜEDAD REAL (se pregunta), nunca "gana la pantalla en silencio".
// DIFERENCIA ÚNICA con el gemelo, deliberada: acá basta 1 entidad. `mesaSel` con un solo checkbox no es un grupo
// ("comparalos" con uno solo no significa nada), pero una selección de UNA fila en una vista SÍ es un referente
// legítimo de "este cliente"/"ese SKU".
function _viewContextGroup(vc) {
  if (!vc || typeof vc !== "object") return null;
  const sel = vc.seleccion;
  if (!sel || typeof sel !== "object" || sel.modo !== "explicita") return null;
  const raw = Array.isArray(sel.entidades) ? sel.entidades.filter((e) => typeof e === "string" && e) : [];
  if (!raw.length) return null;
  const dims = raw.map((e) => guessDimension(e));
  const dimension = (typeof vc.eje === "string" && _AXES.has(vc.eje)) ? vc.eje : dims.find(Boolean) || null;
  if (!dimension) return null;
  const entities = raw.filter((e, i) => dims[i] === dimension);
  return entities.length ? { dimension, entities } : null;
}

// _viewContextFiltroGroup(vc) → el camino O(1) para "cuáles de estos clientes" cuando lo que hay en pantalla son
// 300 filas: NO hay lista de nombres que referenciar (no puede haberla, ver el candado de viewContext.js), hay un
// FILTRO. Se devuelve como `resolved-scope`, que el llamador traduce a args.filters — nunca a scope.entities.
function _viewContextFiltroGroup(vc) {
  if (!vc || typeof vc !== "object") return null;
  const sel = vc.seleccion;
  const desdeSeleccion = (sel && sel.modo === "filtro" && sel.filtro && typeof sel.filtro === "object") ? sel.filtro : null;
  const desdeVista = (vc.filtros && typeof vc.filtros === "object" && Object.keys(vc.filtros).length) ? vc.filtros : null;
  const filtros = desdeSeleccion || desdeVista;
  if (!filtros || !Object.keys(filtros).length) return null;
  const dimension = (typeof vc.eje === "string" && _AXES.has(vc.eje)) ? vc.eje : null;
  return { dimension, filtros, n: (sel && Number.isFinite(sel.n)) ? sel.n : null };
}

// DEICTIC_COMPONENT_RE — el deíctico de COMPONENTE, no de entidad: "este gráfico", "esa tabla", "ese punto", "los
// de arriba", "este número", "acá". Es un eje DISTINTO de DEICTIC_PLURAL_RE (que apunta a un grupo de entidades):
// acá el referente es la PIEZA que el usuario está mirando. Sin ViewContext no resuelve nada — y eso es correcto:
// sin pantalla declarada, "este gráfico" es genuinamente irresoluble y PLAN sigue con su criterio normal.
// SU CASA ES progressiveDisclosure.js (donde se decide la FORMA de la respuesta, que necesita la misma expresión):
// acá se IMPORTA, nunca se declara una segunda — mismo principio que DEICTIC_PLURAL_RE, que vive acá y scenarioIntent
// importa de acá. Una sola verdad por expresión, sin dos regex que puedan divergir.

// resolveComponentReference(text, viewContext) → {kind:"resolved", componentId, componente} | {kind:"none"}
// Solo LOCALIZA: dice a qué pieza apunta el deíctico y qué declara esa pieza (qué mide, en qué eje, con qué
// universo, con qué período y con qué sello). NUNCA trae cifras — las sigue pidiendo PLAN a las tools.
export function resolveComponentReference(text, viewContext) {
  const t = String(text || "");
  if (!viewContext || typeof viewContext !== "object" || !viewContext.componentId) return { kind: "none" };
  if (!DEICTIC_COMPONENT_RE.test(t)) return { kind: "none" };
  return {
    kind: "resolved",
    componentId: viewContext.componentId,
    componente: {
      vista: viewContext.vista || null,
      seccion: viewContext.seccion || null,
      tipo: viewContext.tipo || null,
      titulo: viewContext.titulo || null,
      metrica: viewContext.metrica || null,
      eje: viewContext.eje || null,
      periodo: viewContext.periodo || null,
      escenario: viewContext.escenario || null,
      universo: viewContext.universo || null,
      comparacion: viewContext.comparacion || null,
      estatus: viewContext.estatus || null,
    },
  };
}

export function resolveConversationReference(text, plan, scopePrev, requestContext, uiSignals, viewContext) {
  const t = String(text || "");
  const tenantCheck = validateScopeTenant(scopePrev, requestContext);

  const level = plan && plan.scope && plan.scope.level;
  if (level === "global") return { kind: "none" };   // el cambio de tema lo maneja updateConversationScope, nada que resolver acá

  const named = (plan && plan.scope && Array.isArray(plan.scope.entities)) ? plan.scope.entities.filter(Boolean) : [];
  if ((level === "entity" || level === "list") && named.length && named.every((e) => !!guessDimension(e))) {
    return { kind: "none" };   // PLAN ya lo resolvió bien por comprensión — nada que forzar
  }

  // TENANT — el scope guardado es de OTRO tenant: se descarta ENTERO (nunca reuso parcial). Si el texto de todos
  // modos trae una referencia inequívoca, es un RECHAZO EXPLÍCITO (nunca inventa/cruza tenant en silencio); si el
  // texto no traía ninguna referencia de todos modos, no hay nada que declarar — "none" simple.
  if (!tenantCheck.ok) return _looksLikeReference(t) ? { kind: "decline", reason: "otro_tenant" } : { kind: "none" };

  const safePrev = scopePrev || emptyConversationScope();
  const current = safePrev.current;

  // ORDINAL/SUPERLATIVO ("el primero", "los dos peores") — solo sobre `current`, nunca `history`.
  /* ⚠️ «los otros» ES la excepción medida (2026-09-11): tras «ahora solo Lider» el conjunto de los cuatro puede
   * haber quedado en `history` si en el medio hubo un cambio de tema; si `current` es UNA entidad que vive
   * dentro de history[0], «los otros» son los de ese conjunto. Es el único recuerdo implícito, y es angosto:
   * exige que la entidad activa esté dentro del conjunto recordado. */
  const baseOrdinal = (() => {
    if (current && Array.isArray(current.entities) && current.entities.length >= 2) return current;
    if (current && Array.isArray(current.entities) && current.entities.length === 1 && _OTROS_RE.test(t)) {
      const h0 = Array.isArray(safePrev.history) ? safePrev.history[0] : null;
      if (h0 && Array.isArray(h0.entities) && h0.entities.length >= 2 && h0.entities.includes(current.entities[0]) && h0.dimension === current.dimension) {
        return { ...h0, selection: { ...(h0.selection || { orden: null }), subset: { kind: "seleccion", entities: current.entities, anterior: null } } };
      }
    }
    return current;
  })();
  const ordinal = resolveOrdinalReference(t, baseOrdinal);
  if (ordinal) {
    if (ordinal.kind === "decline") return ordinal;   // «el anterior» sin selección previa · «los otros dos» cuando son tres — no se adivina
    const revalidated = ordinal.entities.filter((e) => guessDimension(e) === baseOrdinal.dimension);
    return revalidated.length ? { kind: "resolved", entities: revalidated, dimension: baseOrdinal.dimension } : { kind: "decline", reason: "sin_referente" };
  }

  const isDeictic = _DEICTIC_PLURAL_RE.test(t);
  if (!isDeictic) {
    /* ── EL DEÍCTICO SINGULAR (2026-09-11) ──────────────────────────────────────────────────────────────────
     * NEUTRO («eso», «ese resultado») → conserva el alcance vigente, sea el negocio entero o la selección.
     * CON GÉNERO («ese», «esa cuenta», «compáralo») → exige UN ítem activo; con varios, se pregunta. */
    const neutro = _DEICTIC_NEUTRO_RE.test(t);
    const conGenero = _DEICTIC_SING_RE.test(t);
    if (!neutro && !conGenero) return { kind: "none" };   // sin marcador deíctico ni ordinal → nada inequívoco que resolver acá
    /* sin NINGÚN scope establecido («seguime con eso» como primer mensaje) un neutro no apunta a nada que
     * este módulo sepa: «none», y el turno sigue su camino de siempre. Distinto de un scope de CARTERA
     * escrito por un turno del negocio entero, que sí es un alcance que conservar. */
    if (!current) return { kind: "none" };   // vale para los dos: sin scope, este módulo no tiene a qué apuntar
    const esCartera = current.dimension === "cartera" || !Array.isArray(current.entities) || !current.entities.length;
    if (neutro && !conGenero) {
      if (esCartera) return { kind: "resolved-scope", alcance: "cartera" };
      const activas = _activas(current).filter((e) => guessDimension(e) === current.dimension);
      return activas.length ? { kind: "resolved", entities: activas, dimension: current.dimension } : { kind: "resolved-scope", alcance: "cartera" };
    }
    if (esCartera) return { kind: "decline", reason: "sin_referente" };
    const activas = _activas(current).filter((e) => guessDimension(e) === current.dimension);
    if (activas.length === 1) return { kind: "resolved", entities: activas, dimension: current.dimension };
    if (!activas.length) return { kind: "decline", reason: "sin_referente" };
    return { kind: "ambiguous", options: activas.map((e) => ({ dimension: current.dimension, entities: [e] })) };
  }

  // POR QUÉ history NO entra en el caso común: un "estos/esos" PLANO se refiere al tema QUE ESTÁ vigente — dejar
  // que mire `history` también arriesgaría resucitar un tema que un cambio de tema real (plan.scope.level=global)
  // ya retiró a `history` a propósito ("cambio real de tema no hereda nada"). Solo cuando el texto AGREGA una
  // marca de recuerdo explícita ("esos clientes DE ANTES", "los mismos que ANTES") se habilita `history` como
  // candidato — ahí sí puede haber 2+ lecturas igual de válidas (current vs. una entrada de history de la MISMA
  // dimensión) → ambigüedad real, nunca se adivina (ver composeReferenceAmbiguity).
  const wantsRecall = _RECALL_MARK_RE.test(t);
  const historyList = Array.isArray(safePrev.history) ? safePrev.history : [];
  // uiGroup (Etapa 3) — SIEMPRE candidato disponible (no depende de `wantsRecall`: la selección de la Mesa es
  // estado VIVO de la pantalla, no un tema conversacional "de antes" que haya que recordar explícitamente).
  const uiGroup = _uiSignalsGroup(uiSignals);
  // viewGroup (owner 2026-08-09) — el contexto de pantalla, con el MISMO trato que uiGroup: estado VIVO de lo que
  // el usuario está mirando, siempre candidato, nunca autoridad. TENANT: el ViewContext ya viene validado/sellado
  // por answerViaOracle (invalidateViewContext descarta el de otra empresa ANTES de llegar acá) — esta segunda
  // verificación es la red por si algún caller futuro lo pasara sin ese paso; nunca se cruza dato entre empresas.
  const vcTenantOk = !viewContext || !requestContext || !requestContext.tenantId || viewContext.tenantId === requestContext.tenantId;
  const vcSafe = vcTenantOk ? viewContext : null;
  const viewGroup = _viewContextGroup(vcSafe);
  const basePool = wantsRecall ? [current, ...historyList, uiGroup, viewGroup] : [current, uiGroup, viewGroup];
  const pool = basePool.filter((g) => g && Array.isArray(g.entities) && g.entities.length && g.dimension && g.dimension !== "cartera");

  const hint = _dimHint(t);
  if (!pool.length) {
    // Sin NINGUNA lista de nombres que referenciar. Antes de declarar "no aplica", el camino O(1): si la pantalla
    // declara un FILTRO (una selección de 300 clientes, un universo acotado), "cuáles de estos clientes" SÍ tiene
    // referente — solo que es un criterio, no una lista. Se devuelve como alcance, para args.filters.
    const filtroGroup = _viewContextFiltroGroup(vcSafe);
    if (filtroGroup && (!hint || !filtroGroup.dimension || filtroGroup.dimension === hint)) {
      return { kind: "resolved-scope", dimension: filtroGroup.dimension || hint || null, filtros: { ...filtroGroup.filtros }, n: filtroGroup.n };
    }
    return { kind: "none" };   // no había NADA estructurado que referenciar — no es un rechazo, es "no aplica"
  }

  const filtered = hint ? pool.filter((g) => g.dimension === hint) : pool;
  if (!filtered.length) return { kind: "decline", reason: "sin_referente" };   // SÍ había scope, pero de otra dimensión — rechazo explícito, no silencio

  // AMBIGÜEDAD REAL: 2+ grupos DISTINTOS sobreviven el filtro — incluso con `hint` puesto (el hint solo acota la
  // DIMENSIÓN, "cliente" vs "sku"; con 2+ grupos de la MISMA dimensión —current Y una entrada de history, ambas
  // de clientes— sigue habiendo 2 lecturas igual de válidas de CUÁLES clientes). Con un único candidato (el caso
  // común: solo `current` calza, o hint+wantsRecall dejan un solo grupo) no hay nada que preguntar.
  let chosen;
  if (filtered.length > 1) {
    const distinct = _dedupeGroups(filtered);
    if (distinct.length > 1) return { kind: "ambiguous", options: distinct };
    chosen = distinct[0];
  } else {
    chosen = filtered[0];
  }
  const revalidated = chosen.entities.filter((e) => guessDimension(e) === chosen.dimension);
  if (!revalidated.length) return { kind: "decline", reason: "sin_referente" };   // el escenario/tenant cambió a mitad de sesión — nunca fuerza una interpretación rota
  return { kind: "resolved", entities: revalidated, dimension: chosen.dimension };
}

// ── composeReferenceAmbiguity/composeReferenceDecline — bypasean el narrador libre (mismo patrón que
// composeSubjectAmbiguity/composeOrphanAcceptance de dialogueState.js): nunca una pregunta genérica tipo "¿para
// qué cliente?" — siempre nombra las alternativas CONCRETAS que ya existen en el scope estructurado.
export function composeReferenceAmbiguity(options) {
  const groups = (Array.isArray(options) ? options : []).filter((g) => g && Array.isArray(g.entities) && g.entities.length);
  if (groups.length < 2) return `No tengo claro a qué te refieres — dime la entidad o el grupo concreto y sigo.`;
  /* un deíctico singular sobre varios ítems («¿y ese?» con cuatro en pantalla): se listan los ítems, no «grupos» */
  if (groups.every((g) => g.entities.length === 1)) {
    const nombres = groups.map((g) => g.entities[0]);
    return `¿A cuál te refieres: ${nombres.slice(0, -1).join(", ")} o ${nombres[nombres.length - 1]}?`;
  }
  const partes = groups.map((g) => `${g.entities.join(", ")}${g.dimension ? ` (${g.dimension})` : ""}`);
  return `Tengo más de un grupo reciente que podría ser: ${partes.join(" — o — ")}. ¿A cuál te refieres?`;
}

export function composeReferenceDecline(reason, detalle = null) {
  const r = String(reason || "").trim();
  if (r === "otro_tenant") return `Esa referencia es de otra empresa/conversación — no puedo reusarla acá. Dime a qué entidad te refieres.`;
  if (r === "sin_referente") return `No tengo un grupo de entidades reciente al que eso pueda referirse — dime a cuáles te refieres.`;
  if (r === "sin_anterior") return `No hay una selección anterior con la que comparar en esta conversación — dime con cuál.`;
  if (r === "conteo_no_calza" && detalle && Array.isArray(detalle.otros)) {
    return `Los otros son ${detalle.otros.length}, no ${detalle.pedidos}: ${detalle.otros.join(", ")}. ¿Sigo con esos?`;
  }
  return `No puedo resolver esa referencia con lo que tengo — dime a qué entidad o grupo te refieres.`;
}

/* ── LO QUE EL AGENTE CONSUME DE LA RESOLUCIÓN (2026-09-11) ─────────────────────────────────────────────────
 * La ley del owner del día anterior, aplicada a la referencia: «la conclusión es del procedimiento, no del
 * narrador» — y el REFERENTE también. El resolutor decide a quién apunta «el primero»; el cerebro lo recibe
 * como hecho, no como sugerencia, y si narra sobre otro, el notario lo cobra. */

/** el mensaje de procedimiento para el cerebro — byte-estable para los mismos insumos */
export function doctrinaDeReferente(ref, current) {
  if (!ref) return null;
  if (ref.kind === "resolved-scope" && ref.alcance === "cartera") {
    return [
      "[PROCEDIMIENTO — no es el usuario] EL ALCANCE DE ESTE TURNO ES EL NEGOCIO ENTERO (la cartera completa).",
      "La pregunta apunta al resultado que ya mostraste a nivel de negocio: respóndela a ESE nivel. No lo reduzcas a",
      "una cuenta. Si nombras cuentas, es para LOCALIZAR dónde pesa algo, no para cambiar el tema a una de ellas.",
    ].join("\n");
  }
  if (ref.kind === "resolved" && Array.isArray(ref.entities) && ref.entities.length) {
    const conjunto = (current && Array.isArray(current.entities) && current.entities.length >= 2) ? current.entities : null;
    const varias = ref.entities.length > 1;
    const lista = varias ? `${ref.entities.slice(0, -1).join(", ")} y ${ref.entities[ref.entities.length - 1]}` : ref.entities[0];
    return [
      `[PROCEDIMIENTO — no es el usuario] LA REFERENCIA DE LA PREGUNTA YA ESTÁ RESUELTA: apunta a ${lista}.`,
      conjunto ? `Es del conjunto que mostraste, en el orden en que lo mostraste: ${conjunto.join(" → ")}.` : null,
      `Responde sobre ${lista}. No cambies el referente ni lo reemplaces por otra cuenta; si pides`,
      `herramientas, pídelas para ${varias ? "esas cuentas" : "esa cuenta"}. Si el dato no alcanza para ${varias ? "ellas" : "ella"}, dilo — no contestes por otra.`,
    ].filter(Boolean).join("\n");
  }
  return null;
}

/** vetoReferente(texto, ref) → { regla, multa } | null — el texto narra sobre OTRO ítem del mismo conjunto y
 *  no nombra al referente resuelto. Solo referentes singulares: en una comparación las dos se nombran. */
const _reNombre = (n) => new RegExp(`(?:^|[^\\wáéíóúñ])${String(n).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\wáéíóúñ])`, "i");
export function vetoReferente(texto, ref, current) {
  const t = String(texto || "");
  if (!t.trim() || !ref || ref.kind !== "resolved" || !Array.isArray(ref.entities) || ref.entities.length !== 1) return null;
  const referente = ref.entities[0];
  if (_reNombre(referente).test(t)) return null;
  const conjunto = (current && Array.isArray(current.entities)) ? current.entities : [];
  const otra = conjunto.find((e) => e !== referente && _reNombre(e).test(t));
  if (!otra) return null;
  return { regla: "referente-cambiado", multa: `la pregunta apunta a ${referente} —lo resolvió el procedimiento sobre el conjunto que mostraste— y respondes sobre ${otra} sin nombrar a ${referente}. El referente es del procedimiento, no del narrador: responde sobre ${referente}, o di que el dato no alcanza para esa cuenta.` };
}

/** el orden en que la respuesta aprobada PRESENTÓ las entidades: filas de tabla primero; si no hay tabla, el
 *  texto. Insumo de `updateConversationScope.ordenPresentado` — elige entre órdenes SELLADOS, no los crea. */
export function ordenPresentadoEn(texto, catalogo) {
  const t = String(texto || "");
  const nombres = Array.isArray(catalogo) ? catalogo.filter(Boolean) : [];
  if (!t.trim() || !nombres.length) return [];
  const filas = t.split(/\r?\n/).filter((l) => /^\s*\|/.test(l) && !/^\s*\|[\s:|-]+\|?\s*$/.test(l));
  const fuente = filas.length ? filas : [t];
  const orden = [];
  for (const linea of fuente) {
    const vistos = nombres.map((n) => ({ n, i: linea.search(_reNombre(n)) })).filter((x) => x.i >= 0).sort((a, b) => a.i - b.i);
    for (const { n } of vistos) if (!orden.includes(n)) orden.push(n);
  }
  return orden;
}

/* ── CONSOLIDACIÓN — ESTADO AL CIERRE DE ETAPA 4 (2026-08-04, documentado a propósito, para que el próximo agente
 * no lo re-descubra — el núcleo se CONGELA después de esta etapa, nadie retoma esto pronto) ──────────────────────
 * toolContracts.js + entityScope multi-entidad (queryMetric/gridTable/tensionRead/simulateCosto + diagnose/
 * simulateCarga/simulateCapital) y scenarioIntent.js multi-eje + el arm "future_multi" (CASO OBLIGATORIO: "¿Qué
 * pasa si subo 3% el precio de estos SKU?" → pregunta SOLO por volumen, nunca por cliente, cierre de punta a
 * punta) — YA ESTÁN COMPLETOS (ver los commits de "continuidad conversacional universal" + "cierre de los límites
 * restantes de conversationScope"), sin relación con lo que sigue.
 *
 * lastOffer/recentSubjects (Etapa 4, "vistas derivadas del scope canónico") — RESUELTO CON ALCANCE PARCIAL, por
 * diseño, NO por omisión:
 *   · lastOffer → conversationScope.current.ofertaPendiente: DERIVACIÓN REAL. mem.lastOffer sigue vivo SOLO como
 *     shim de compatibilidad (dialogueState.js:getLastOffer cae a él cuando conversationScope no trae nada — los
 *     ~13-20 fixtures de gate que arman `mem:{lastOffer:{...}}` a mano sin poblar conversationScope en paralelo lo
 *     necesitan). answerViaOracle.js escribe AMBOS campos en el mismo instante (dual-write, nunca 2 fuentes que
 *     puedan divergir) — ver withOfertaPendiente arriba y los 3 sitios que la usan en ese archivo.
 *   · recentSubjects → mem.conversationScope.recentSubjects: consolidación FÍSICA únicamente (key hermana de
 *     `current`/`history`, MISMO mecanismo LRU de dialogueState.js:updateRecentSubjects, sin cambiar su
 *     semántica). La derivación SEMÁNTICA completa (calcular recentSubjects desde conversationScope.history, sin
 *     ningún campo paralelo) quedó EXPLÍCITAMENTE fuera de esta etapa — ver el comentario "POR QUÉ recentSubjects
 *     NO se deriva de conversationScope.history" al final de dialogueState.js para la razón completa (política de
 *     archivado de `history` distinta a la retención LRU de recentSubjects) y qué requeriría cerrarla de verdad.
 *
 * mem.pendingSimulation NO se retiró en favor de conversationScope.current.{supuestos,faltantes} — fuera de
 * alcance de Etapa 4 (el owner pidió específicamente lastOffer/recentSubjects, no pendingSimulation) y del pedido
 * original de cierre de límites; sigue viviendo como su propio campo de `mem`, sin cambios de esa etapa.
 * ACTUALIZACIÓN (owner 2026-08-11): el CAMPO sigue viviendo en `mem`, pero su CICLO DE VIDA ya no está escrito a
 * mano en el orquestador — vive acá, con el resto del contexto conversacional (ver "LA SIMULACIÓN PENDIENTE ·
 * CICLO DE VIDA POR ESTADO" arriba). Mover el campo entero a `current.{supuestos,faltantes}` sigue pendiente y
 * sigue siendo otra tarea: lo que se cerró es que el pendiente muera por las mismas razones que todo lo demás.
 */
