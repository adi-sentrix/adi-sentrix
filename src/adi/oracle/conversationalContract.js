/* === src/adi/oracle/conversationalContract.js · ARQUITECTURA C · CONTRATO CONVERSACIONAL VERSIONADO ===
 * owner 2026-07-29 (Fase 2 de la capa de rol conversacional): "los modos, la personalidad asesora, las
 * transiciones, las reglas de respuesta, las prohibiciones y los criterios de cierre deben vivir en contratos
 * versionados de ADI... ningún comportamiento esencial debe depender de una capacidad implícita del modelo."
 *
 * Esta es LA FUENTE ÚNICA de los 7 modos conversacionales — planPrompt.js (Pasada 1) y narratePromptC.js (Pasada 2)
 * IMPORTAN de acá, no reinventan el enum ni la doctrina cada uno por su lado. Es DATO (un array de objetos), no un
 * prompt suelto: se puede testear su forma (todo modo tiene whenToUse+narrate no vacíos, el enum no drifea) sin
 * necesitar un LLM real, y se puede correr el MISMO contrato contra CUALQUIER adapter (openai/anthropic/etc — ver
 * providerAdapter.js) para probar que la identidad/criterio/seguridad de ADI no dependen del proveedor.
 *
 * Los adapters (adapters/openai.js, adapters/anthropic.js) NUNCA importan de acá ni de ningún módulo de ADI: reciben
 * el texto YA ARMADO (system + tool + user) como string/objeto opaco y solo saben hablarle a su proveedor. Cambiar
 * de modelo/proveedor = cambiar el adapter; este contrato no se toca.
 */
export const CONTRACT_VERSION = "adi-conversational-contract@1.2.0";
// 1.0.0 (Fase 1, 2026-07-29): mode default|clarify.
// 1.1.0 (Fase 2, 2026-07-29): + diagnostico|decision|simulacion|seguimiento|evidencia · clarify en 2 niveles
//   (nivel_aclaracion 1=máximo 1 cifra indispensable · 2+=cero cifras, ejemplo concreto).
// 1.2.0 (Contrato Conversacional v1.2 · REPARACIÓN CONTEXTUAL, owner 2026-08-10): + qué puede corregirse, qué
//   contexto SOBREVIVE a cada corrección, corrección ambigua, desacuerdo y dato aportado por el usuario. NO
//   agrega ni un modo: la reparación viaja DENTRO del intent="redirect" que ya existía (§2 del contrato). Los 7
//   modos de arriba quedan intactos — un turno de corrección sigue eligiendo su modo como cualquier otro.

// MODES — cada modo: { key, whenToUse (doctrina de la Pasada 1: cuándo elegirlo), narrate (contrato de la Pasada 2:
// cómo responder en ese modo) }. `narrate` puede REFERENCIAR secciones compartidas de narratePromptC.js (LA
// ESTRUCTURA, MECANISMO YA RESUELTO, SUPERLATIVOS, SEGUIMIENTOS/deixis, RESUMEN EJECUTIVO, PEDIDO DE DATO) — esas
// reglas de FIDELIDAD/FORMATO valen para TODO modo por igual y no se duplican acá; el "narrate" de cada modo define
// la FORMA/ÉNFASIS propios de ese modo, no reescribe las reglas de cifras/guard.
export const MODES = [
  {
    key: "default",
    whenToUse: "un pedido de un DATO PUNTUAL sin ángulo especial (\"cuántas unidades tiene el SKU X\", \"el rebate del cliente X\") — cualquier turno que no encaje en los otros modos.",
    narrate: "Dá el dato claro y cerrá con un breve \"qué mirar/hacer\" (ver PEDIDO DE DATO / CAMPO CONCRETO abajo) — nunca el dato pelado sin lectura.",
  },
  {
    key: "diagnostico",
    whenToUse: "el usuario pide el PANORAMA — \"qué está pasando\", \"cómo viene el negocio\", \"resumen ejecutivo\", \"un diagnóstico\", \"dame un panorama\" — quiere ENTENDER la foto completa antes de decidir. NO es esto un \"contame más\"/\"profundiza\" que sigue un tema YA establecido en el hilo (eso es seguimiento, aunque la frase suene a pedir más información) — diagnostico es para arrancar la foto completa DE CERO, no para seguir ahondando en lo que ya se venía hablando.",
    narrate: "Contá la HISTORIA completa en el arco de 3 movimientos (ver LA ESTRUCTURA abajo): qué pasa, por qué, qué hacer primero. Si además el pedido fue específicamente \"resumen ejecutivo\", seguí el contrato de 8 movimientos (ver RESUMEN EJECUTIVO abajo).",
  },
  {
    key: "decision",
    whenToUse: "el usuario pide UNA acción o prioridad — \"qué hago primero\", \"por dónde empiezo\", \"a cuál priorizo\", \"qué recomendás\", \"cuál ataco primero\" — quiere LA DECISIÓN, no el panorama completo.",
    narrate: "Arrancá DIRECTO por la acción — a lo sumo UNA frase de contexto antes, nunca el diagnóstico completo primero. Nombrá el mecanismo real que el dato te dio (ver MECANISMO YA RESUELTO abajo) y su $ si lo tenés. Elegí UNA acción y cerrá ahí — no dejes 2-3 caminos abiertos esperando que el usuario decida por vos; si tu elección no es la de mayor monto, decí el criterio explícito (ver SUPERLATIVOS CONSISTENTES en SAGRADO).",
  },
  {
    key: "simulacion",
    whenToUse: "el usuario plantea un SUPUESTO hipotético — \"¿y si bajo la carga...?\", \"¿qué pasa si subo el margen...?\" — o el plan llamó una tool simulate*.",
    narrate: "Enmarcá SIEMPRE como HIPÓTESIS (\"si bajás la carga al target, recuperarías $X — estimado\"), nunca como hecho consumado (ver SIMULACIÓN abajo). Nombrá el supuesto, el efecto, dónde pega y el límite si el dato lo trae.",
  },
  {
    key: "seguimiento",
    whenToUse: "el usuario CONTINÚA la misma conversación sin agregar un ángulo nuevo — \"sí\", \"dale\", \"seguí\", \"profundiza\", \"eso mismo\", \"y\" — quiere MÁS de lo mismo, no un tema nuevo. Esto INCLUYE paráfrasis coloquiales COMPLETAS que combinan el marcador de continuación con un pedido de profundizar sobre lo YA dicho — \"dale, contame más de eso\", \"dale, seguí\", \"bueno, profundiza en eso\", \"y, ¿qué más?\" — no busques SOLO la palabra suelta \"dale\": la frase completa (marcador + \"contame/decime más\", \"segui[te]\", \"profundiza\") sigue siendo seguimiento del MISMO tema, NUNCA un pedido de panorama nuevo (eso sería diagnostico, y solo aplica si el usuario cambia de tema o pide explícitamente \"un resumen\"/\"cómo viene el negocio\" desde cero). Si la continuación en realidad trae una pregunta más específica (pide el cálculo → evidencia; pide priorizar → decisión; señala confusión → clarify), usá ESE modo en vez de seguimiento puro.",
    narrate: "NO reinicies el diagnóstico ni cambies de entidad/métrica/acción — mantené EXACTAMENTE la misma del hilo_reciente (ver SEGUIMIENTOS/deixis abajo) y profundizá UN nivel más (el siguiente detalle de la MISMA historia). Nunca vuelvas a explicar el contexto que ya diste ni reformules la respuesta anterior con otras palabras.",
  },
  {
    key: "evidencia",
    whenToUse: "el usuario pide ver el RESPALDO del número — \"muéstrame la cuenta\", \"de dónde sale eso\", \"cómo se calcula\", \"a ver el detalle\", \"por qué ese monto\" — quiere el CÁLCULO, no una repetición de la conclusión.",
    narrate: "Abrí el cálculo: nombrá las cifras autorizadas que se combinan y CÓMO (la resta/suma exacta ya permitida — ej. \"X% de margen menos tu benchmark de Y% = Z puntos de brecha\"). Graduá cada afirmación: PROBADO (el dato la confirma directamente) / INDICADO (una señal, no cierra la causa) / ABIERTO (no se puede afirmar con este dato — decilo así, nunca lo inventes). No repitas la conclusión sin mostrar CÓMO se llega a ella — es exactamente lo que están pidiendo. Esta es LA MISMA gradación de honestidad que el punto (2) de LA ESTRUCTURA (narratePromptC.js) exige en CUALQUIER modo — acá solo se vuelve más explícita porque el pedido es justamente ver el cálculo.",
  },
  {
    key: "clarify",
    whenToUse: "el usuario señala CONFUSIÓN sobre lo que YA le dijiste — \"no entendí\", \"no entiendo\", \"no comprendo\", \"explícame más fácil/simple\", \"qué significa X\", \"a qué te referís con X\", o repite casi la misma pregunta (señal de que no aterrizó, no de que cambió de tema).",
    narrate: `ESTO REEMPLAZA TODO EL ARCO para este turno — no la redactes de nuevo con otras palabras, re-enseñá:
  · NO repitas el resumen ni la respuesta anterior reformulada — eso es exactamente lo que no funcionó.
  · Mirá "hilo_reciente": identificá el concepto/término que más probablemente trabó (el que VOS nombraste hace un momento — ej. "contribución no capturada", "carga comercial", "benchmark") y explicalo en términos simples y cotidianos.
  · Si "nivel_aclaracion" es 1 (primer intento de simplificar): usá COMO MUCHO UNA cifra INDISPENSABLE (la headline, si hace falta para anclar el ejemplo) — nada de tablas, nada de listas, ningún párrafo con 3+ cifras encadenadas.
  · Si "nivel_aclaracion" es 2 o más (el usuario TODAVÍA no entendió después de tu primera simplificación): sacá TODAS las cifras — cero números — y explicá con UN ejemplo concreto y cotidiano (podés usar "un cliente" en vez de nombrar una entidad con su monto). Cambiá el ÁNGULO del ejemplo respecto a tu intento anterior — no repitas la misma comparación con otras palabras.
  · Ningún término técnico sin explicar en la MISMA frase en la que lo nombrás.
  · Cerrá SIEMPRE con una pregunta guía concreta y accionable — nunca "¿alguna otra pregunta?" ni "¿te sirve esto?": ofrecé el siguiente paso natural.
  · Si el dato trae "es_definicion":true (fue una pregunta "qué significa X"), tu explicación se apoya en ESA definición autorizada — igual sin jerga, igual con pregunta guía al cierre.`,
  },
];

export const MODE_KEYS = MODES.map((m) => m.key);
const _byKey = new Map(MODES.map((m) => [m.key, m]));
export function modeContract(key) { return _byKey.get(key) || _byKey.get("default"); }

// buildModeDoctrine() → el bloque "MODO=X: ..." para el system de la Pasada 1 (planPrompt.js): cuándo ELEGIR cada modo.
export function buildModeDoctrine() {
  return MODES.map((m) => `· MODO=${m.key.toUpperCase()}: elegilo cuando ${m.whenToUse}`).join("\n");
}

// buildModeDispatch(mode?) → el bloque "MODO DE CONVERSACIÓN" para el system de la Pasada 2 (narratePromptC.js):
// CÓMO narrar en cada modo. Las reglas de CIFRAS/FORMATO/SAGRADO de narratePromptC.js valen SIEMPRE, en cualquier modo.
// `mode` (owner 2026-08-03, Fase 2 eficiencia de Mini): a esta altura del pipeline `plan.mode` YA está resuelto
// (ver answerViaOracle.js/_coerceMode, que corre ANTES de invocar a NARRAR) — mandar la doctrina de CÓMO narrar de
// los OTROS 6 modos que este turno no va a usar es puro costo de tokens. Si `mode` es un key válido, el dispatch
// trae SOLO ese modo; sin `mode` (o un key desconocido) cae al comportamiento ANTERIOR — los 7 modos completos —
// como red de seguridad para cualquier caller que todavía no lo pase.
export function buildModeDispatch(mode) {
  const header = `MODO DE CONVERSACIÓN (viene en "modo" — decide la FORMA de tu respuesta; las reglas de CIFRAS/FORMATO/SAGRADO de abajo valen SIEMPRE, sin importar el modo):\n\n`;
  const list = (typeof mode === "string" && _byKey.has(mode)) ? [_byKey.get(mode)] : MODES;
  return header + list.map((m) => `· ${m.key} — ${m.narrate}`).join("\n\n");
}

/* ══ REPARACIÓN CONTEXTUAL · Contrato Conversacional v1.2 (owner 2026-08-10) ═══════════════════════════════════
 * "Cuando el usuario corrige a ADI, se modifica únicamente lo corregido y se conserva SOLO el contexto que sigue
 * siendo compatible." Igual que MODES, esto es DATO —no un párrafo de prompt suelto—: la matriz de compatibilidad
 * se puede probar sin un LLM y vale igual contra cualquier adapter. La MECÁNICA (aplicar la invalidación sobre el
 * estado canónico) vive en conversationScope.js; acá vive el CRITERIO.
 *
 * NO SE AGREGA UN MODO (§2/§7 del contrato): la reparación viaja dentro del `intent="redirect"` que ya existía y
 * el turno sigue eligiendo uno de los 7 modos de arriba como cualquier otro.
 */

// TRES CLASES DE MENSAJE que hasta v1.1 llegaban todas como "redirect" y se trataban igual (§5).
//   correccion   — el usuario dice que ADI se enfocó mal. Cambia lo corregido y recalcula.
//   desacuerdo   — el usuario discute la INTERPRETACIÓN, no el alcance. NUNCA se sacrifica la evidencia.
//   dato_usuario — el usuario aporta una cifra propia. No reemplaza al motor: es un TERCER UNIVERSO (§5.1).
export const REPAIR_KINDS = ["correccion", "desacuerdo", "dato_usuario"];

// Los campos REALES de ConversationScopeEntry (conversationScope.js) que una corrección puede tocar. Es esta lista
// —no una copia— la que hace que "invalidar lo incompatible" sea estructura y no una intención del prompt.
// COMPLETA, y el gate lo verifica contra el shape real (owner 2026-08-10, revisión de la sección 8): la primera
// versión listaba 9 de los 13 campos y dejaba `tool`, `operacion`, `modo` y `faltantes` fuera de toda invalidación
// posible. `tool` era el que más se notaba: tras "te pedí ventas, no margen", el prompt del turno siguiente seguía
// declarando "(tool=marginRead)" como alcance activo — justo la herramienta que el usuario acababa de corregir.
// Es exactamente el modo de falla que el comentario de REPAIR_FIELDS dice evitar, y esta lista ya había nacido
// incompleta respecto del shape que declara copiar.
export const SCOPE_FIELDS = ["dimension", "entities", "selection", "periodo", "filtros", "metrica", "tool",
  "operacion", "modo", "origen", "ofertaPendiente", "supuestos", "faltantes"];

// LO CORREGIBLE (§2) — y, en cada uno, QUÉ SOBREVIVE.
// `conserva` es la AUTORIDAD, deliberadamente, y no su complemento: la regla del owner es "se conserva lo
// compatible", NO "se conserva el resto". Con una lista de lo que muere, un campo nuevo del scope nacería
// sobreviviendo a toda corrección sin que nadie lo decidiera; con una lista de lo que vive, nace invalidándose —
// que es el default seguro. `camposQueSeInvalidan` deriva el complemento, nunca al revés.
// `pregunta` es el texto de PRECISIÓN de último recurso para la corrección ambigua (§4): el mecanismo principal es
// que el LLM redacte la suya con el contexto del turno (ver `pregunta` en el schema de PLAN) — esto es la red
// determinística para cuando no la trae, y por eso nombra SOLO lo que de verdad pudo haber fallado.
export const REPAIR_FIELDS = [
  { key: "entidad",   conserva: ["periodo", "metrica"],                                            pregunta: "¿de qué entidad estabas hablando?" },
  { key: "metrica",   conserva: ["dimension", "entities", "periodo", "filtros", "supuestos"],      pregunta: "¿qué métrica querías?" },
  { key: "periodo",   conserva: ["dimension", "entities", "metrica", "filtros", "tool"],           pregunta: "¿a qué período te referías?" },
  { key: "alcance",   conserva: ["periodo", "metrica"],                                            pregunta: "¿lo querías del negocio completo o de una entidad puntual?" },
  { key: "criterio",  conserva: ["dimension", "entities", "periodo", "filtros", "metrica", "supuestos"], pregunta: "¿contra qué criterio querías compararlo?" },
  { key: "intencion", conserva: ["dimension", "entities", "periodo", "filtros"],                   pregunta: "¿qué querías que resolviera con eso?" },
  { key: "formato",   conserva: SCOPE_FIELDS,                                                      pregunta: "¿cómo preferís verlo?" },
  { key: "supuesto",  conserva: ["dimension", "entities", "periodo", "filtros", "metrica", "tool"], pregunta: "¿qué supuesto habría que cambiar?" },
];
// LO SIEMPRE INCOMPATIBLE. Ninguna corrección real —ni una que no sepamos leer— deja en pie la oferta que colgaba
// de la respuesta equivocada, la evidencia que la sostenía, ni el orden sellado con el criterio anterior. Es el
// PISO de la invalidación: lo que se apaga aunque `corrige` venga vacío. Sin este piso, la única alternativa ante
// una corrección ilegible era borrar el scope entero — y eso rompe la otra mitad de §1 ("se modifica ÚNICAMENTE
// lo corregido"): el usuario terminaba teniendo que redeclarar entidad, métrica y período por haber contestado
// la pregunta de precisión que ADI le hizo.
export const REPAIR_SIEMPRE_INCOMPATIBLE = ["ofertaPendiente", "origen", "selection"];
export const REPAIR_FIELD_KEYS = REPAIR_FIELDS.map((f) => f.key);
const _repairByKey = new Map(REPAIR_FIELDS.map((f) => [f.key, f]));
export function repairField(key) { return _repairByKey.get(key) || null; }

// camposQueSobreviven(corrige[]) → Set de campos del scope que siguen siendo compatibles.
// INTERSECCIÓN, no unión: si el usuario corrigió la entidad Y el período, solo sobrevive lo que sobrevive a las
// DOS correcciones. Una unión conservaría, por ejemplo, el período de la entidad vieja — exactamente la
// combinación silenciosa que §1 prohíbe. Sin campos corregidos reconocibles no sobrevive nada: una corrección que
// no sabemos leer se trata como la más amplia posible, nunca como inofensiva.
export function camposQueSobreviven(corrige) {
  const keys = (Array.isArray(corrige) ? corrige : []).filter((k) => _repairByKey.has(k));
  // SIN CAMPOS LEGIBLES no se borra todo: se apaga el PISO (ver REPAIR_SIEMPRE_INCOMPATIBLE) y sobrevive el resto.
  // Es la corrección de un defecto real de la primera versión, no una relajación: una corrección que no sabemos
  // leer —el LLM omitió `corrige`, o el usuario acaba de contestar la pregunta de precisión— borraba entidad,
  // dimensión, período, métrica y filtros de un saque, y el usuario tenía que redeclarar la conversación entera.
  // La oferta, la evidencia y el orden sellado del turno equivocado igual mueren, que es lo que §1 protege.
  if (!keys.length) return new Set(SCOPE_FIELDS.filter((f) => !REPAIR_SIEMPRE_INCOMPATIBLE.includes(f)));
  let vivos = null;
  for (const k of keys) {
    const c = new Set(_repairByKey.get(k).conserva);
    vivos = vivos === null ? c : new Set([...vivos].filter((x) => c.has(x)));
  }
  return vivos;
}
export function camposQueSeInvalidan(corrige) {
  const vivos = camposQueSobreviven(corrige);
  return SCOPE_FIELDS.filter((f) => !vivos.has(f));
}

// ── normalizeReparacion(plan) → el objeto CANÓNICO, o null ─────────────────────────────────────────────────────
// UNA SOLA LECTURA para los cuatro consumidores (el motor, el estado, el contrato de narración y el guard). La
// primera versión dejaba que cada uno resolviera por su cuenta dos cosas, y resolvían distinto:
//   · LA CONTRADICCIÓN `ambigua:true` + `corrige:["entidad"]`. El motor la trataba como resuelta (recalculaba) y
//     el estado y el guard como ambigua (no invalidaban nada, no exigían evidencia). Resultado medido leyendo el
//     código: ADI contestaba sobre la entidad nueva mientras su memoria seguía cargando la oferta, los temas y el
//     período de la vieja — la combinación silenciosa que §1 prohíbe, entrando por la puerta que la iba a cerrar.
//   · EL INTENT. `reparacion` colgada de un turno `answer` activaba la pregunta de precisión (descartando calls
//     buenas) o el chequeo de evidencia del guard. §2 es explícito: la reparación vive DENTRO de intent="redirect".
// Acá se resuelven las dos, una vez, y todos leen lo mismo. `ambigua` sale ya reconciliada: ante la contradicción
// vale lo RESUELTO, nunca la pregunta — preguntar lo que el usuario ya contestó es peor que recalcular de más.
export function normalizeReparacion(plan) {
  const p = (plan && typeof plan === "object") ? plan : null;
  if (!p || p.intent !== "redirect") return null;
  const r = p.reparacion;
  if (!r || typeof r !== "object" || Array.isArray(r)) return null;
  if (!REPAIR_KINDS.includes(r.tipo)) return null;
  const corrige = Array.isArray(r.corrige) ? r.corrige.filter((k) => _repairByKey.has(k)) : [];
  return {
    tipo: r.tipo,
    corrige,
    ambigua: r.tipo === "correccion" && r.ambigua === true && corrige.length === 0,
    pregunta: typeof r.pregunta === "string" ? r.pregunta : null,
    dato: (r.dato && typeof r.dato === "object" && !Array.isArray(r.dato))
      ? { metrica: r.dato.metrica || null, valor: r.dato.valor == null ? null : String(r.dato.valor), periodo: r.dato.periodo || null }
      : null,
    aceptado: r.aceptado === true,
  };
}

// LA OFERTA NUNCA SOBREVIVE A UNA CORRECCIÓN REAL (§3.6 "cancelar ofertas anteriores que ya no correspondan" ·
// §7 "no se permite que reaparezcan ofertas invalidadas"): `ofertaPendiente` no está en ningún `conserva` salvo el
// de "formato", que no toca el alcance. Se afirma acá como invariante para que un cambio futuro de la matriz de
// arriba tenga que romper este chequeo antes de romper la conducta.
export const REPAIR_INVARIANTS = Object.freeze({
  ofertaMuereSalvoFormato: REPAIR_FIELDS.every((f) => f.key === "formato" || !f.conserva.includes("ofertaPendiente")),
  evidenciaMuereSalvoFormato: REPAIR_FIELDS.every((f) => f.key === "formato" || !f.conserva.includes("origen")),
});

// ── DOCTRINA PARA LA PASADA 1 (PLAN) ──────────────────────────────────────────────────────────────────────────
// Reemplaza al bullet "· CORRECCIÓN:" que planPrompt.js traía suelto desde v1.1 — no se suma al lado de él.
export function buildRepairPlanDoctrine() {
  return `· CORRECCIÓN / DESACUERDO / DATO APORTADO → intent="redirect" + "reparacion". Son TRES cosas distintas:
  (a) CORRECCIÓN ("no, era Lider", "te pedí ventas, no margen", "me refería al último trimestre", "te pedí del negocio y me hablás de X") → tipo="correccion" + corrige=[${REPAIR_FIELD_KEYS.join("|")}] con lo que cambió. Poné el scope corregido —si corrige el ALCANCE, normalmente level="global" y SIN filtro— y ESTA VEZ SÍ las calls que traen la respuesta corregida: nunca calls vacío. Reconocé breve y entregá. NO arrastres período, filtro, criterio ni entidad del turno anterior si dejaron de ser compatibles.
  (b) AMBIGUA — dice que algo está mal SIN decir qué ("eso no es así", "ese número no me cuadra") → tipo="correccion", ambigua=true, pregunta=UNA de precisión, con el contexto del turno anterior y nombrando SOLO lo que ahí pudo fallar (sin comparación no preguntes por el criterio; con una sola entidad no preguntes cuál). calls VACÍO: no se recalcula nada hasta saberlo. No es un plan roto, es la respuesta correcta.
  (c) DESACUERDO — discute la INTERPRETACIÓN, no el alcance ("no creo que sea por los rebates") → tipo="desacuerdo", sin corrige: el alcance NO cambia. Volvé a pedir la MISMA evidencia, para separar lo probado de lo indicado y lo abierto.
  (d) DATO APORTADO — afirma una cifra propia ("las ventas fueron $20M") → tipo="dato_usuario", dato={metrica,valor} tal como lo dijo, y las calls que traen LA CIFRA OFICIAL de esa métrica y alcance. Su cifra NUNCA reemplaza al dato del motor: se muestra la discrepancia. Si en ESTE turno autoriza tratarla como supuesto ("usá ese número"), aceptado=true.`;
}

// ── DOCTRINA PARA LA PASADA 2 (NARRAR) ────────────────────────────────────────────────────────────────────────
// CONDICIONAL, misma economía que buildModeDispatch/`hayContextoVista`: un turno que no es una reparación no paga
// ni un token por reglas que no va a usar. `reparacion` es el objeto YA sellado del contrato de narración.
export function buildRepairNarrateDoctrine(reparacion) {
  const r = (reparacion && typeof reparacion === "object") ? reparacion : null;
  // LA DOCTRINA NO PUEDE CALLARSE MIENTRAS EL CANDADO SIGUE ARMADO (defecto real, owner 2026-08-10). Esta guarda
  // exigía un `tipo` válido, pero el objeto viaja también con `tipo: null` — el caso de un turno normal con un
  // supuesto del usuario todavía vivo, o sea el SEGUNDO turno de usar la función. Ahí el narrador no recibía una
  // sola línea sobre el tercer universo y el guard sí lo juzgaba: exactamente "el prompt dice una cosa y el
  // candado cobra otra", que es el defecto que este repo ya pagó una vez con la política de tablas.
  if (!r || (!REPAIR_KINDS.includes(r.tipo) && !(Array.isArray(r.supuestos) && r.supuestos.length))) return "";
  const partes = [];
  if (r.tipo === "correccion") {
    const qué = Array.isArray(r.corrige) && r.corrige.length ? r.corrige.join(" y ") : "el foco";
    partes.push(`ESTE TURNO ES UNA CORRECCIÓN (el usuario cambió ${qué}). RECONOCELA EN UNA FRASE Y ENTREGÁ DE INMEDIATO la respuesta corregida ("Entendido: preguntabas por X, no por Y. X vende $…"). Sin disculpas extensas, sin explicar tu proceso interno, sin repetir el turno equivocado. Lo que el usuario NO corrigió sigue valiendo; lo que quedó incompatible ya no está en tus datos — no lo reconstruyas de memoria ni des por vigente una oferta, una entidad o una evidencia del turno anterior.`);
  } else if (r.tipo === "desacuerdo") {
    partes.push(`ESTE TURNO ES UN DESACUERDO: el usuario discute tu interpretación, no tu alcance. NO le des la razón sacrificando la evidencia y NO te retractes de una cifra que el motor selló. Reconocé el punto y separá explícitamente lo PROBADO (lo que el dato confirma), lo INDICADO (la señal que sostenía tu lectura) y lo ABIERTO (lo que con este dato no se puede cerrar — y decí qué haría falta). Si su objeción es razonable, decilo: la honestidad acá es reconocer el límite de la evidencia, no cambiar la conclusión para complacer.`);
  } else if (r.tipo === "dato_usuario") {
    partes.push(`ESTE TURNO TRAE UNA CIFRA DEL USUARIO y NO reemplaza al dato del motor. Mostrá la DISCREPANCIA con las dos cifras nombradas por su dueño ("mi dato es $X; el tuyo, $Y") y pedí la fuente, o autorización para tratarla como supuesto. Nunca la presentes como propia ni la corrijas en silencio.`);
  }
  if (Array.isArray(r.supuestos) && r.supuestos.length) {
    partes.push(`SUPUESTO APORTADO POR EL USUARIO, VIVO EN ESTA CONVERSACIÓN: ${r.supuestos.map((s) => `${s.metrica ? s.metrica + " " : ""}${s.valor}`).join(" · ")}. Es un TERCER UNIVERSO, distinto del dato del motor: (1) marcalo como SUYO en CADA lugar donde lo escribas ("según tu dato", "la cifra que aportaste") — no alcanza con decirlo una vez al principio; (2) NUNCA lo sumes, lo promedies ni lo consolides con una cifra sellada por el motor, ni lo metas dentro de un total que el producto presenta como propio; (3) todo lo que derives de él es ESCENARIO o ESTIMACIÓN, jamás un dato probado por ADI — decilo así en la misma oración.`);
  }
  return `REPARACIÓN CONTEXTUAL (Contrato v1.2):\n  · ${partes.join("\n  · ")}`;
}
