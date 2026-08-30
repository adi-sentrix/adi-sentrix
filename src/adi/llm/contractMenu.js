/* === src/adi/llm/contractMenu.js · ADI Core · Paso 5 v1 · MENÚ DEL CONTRATO para el LLM ===
 * El LLM NO adivina qué existe: lee el MENÚ que ESTE archivo serializa DESDE el contrato (Paso 3) — métricas, ejes,
 * disponibilidad, cruces bloqueados, escenario. Es la MISMA fuente contra la que answerADIFromSpec (Paso 4) valida el
 * spec. Fuente única: cuando el contrato crece (métrica/eje/dominio nuevo), el menú del LLM crece SOLO.
 *
 * ADITIVO: lee el contrato, no lo toca. No lo importa el motor sellado → gate 16/0 intacto.
 * Regla madre: el LLM entiende y emite el spec · ADI calcula, valida y decide. Este menú es lo que el LLM PUEDE pedir. */
import { METRICS } from "../../config/contract/metricRegistry.js";
import { ENTITIES, axisAvailable } from "../../config/contract/entityRegistry.js";
import { SOURCES } from "../../config/contract/sourceManifest.js";
import { BLOCKED_CROSSES } from "../../config/contract/surfaceContract.js";
import { pnlDisponibilidad } from "../pnl.js";   // P&L pase 2 · disponibilidad DATA-DRIVEN del alcance (una verdad)

// la línea de disponibilidad del P&L para el menú (derivada del contrato+dato · si mañana hay venta por bodega,
// esta línea cambia sola)
const _pnlDisponibleLinea = () => {
  const d = pnlDisponibilidad();
  const si = d.filter((x) => x.available).map((x) => x.label.sing);
  const no = d.filter((x) => !x.available).map((x) => x.label.sing);
  return `${si.join("/")} y del negocio${no.length ? ` — por ${no.join("/")} NO hay venta desglosada` : ""}`;
};

// F1 multiempresa: los EJEMPLOS del menú nombran entidades del TENANT ACTIVO (con el demo, los mismos
// nombres de siempre — byte-idéntico). Nunca más un menú que le enseña al LLM clientes de otra empresa.
const _picks = () => {
  const cl = (SOURCES.clientesMargen.load() || []).filter(SOURCES.clientesMargen.rowFilter || (() => true));
  const fam = SOURCES.sfamiliasMargen.load() || [];
  const inv = SOURCES.skuInventario.load() || [];
  const at = (a, i) => (a[Math.min(i, Math.max(0, a.length - 1))] || {});
  return {
    c0: at(cl, 0).nombre || "", c1: at(cl, 1).nombre || "", c2: at(cl, 2).nombre || "",
    cLow: at(cl, 7).nombre || "", cLower: at(cl, 9).nombre || "",
    fam: at(fam, 2).nombre || "", skuInv: at(inv, 3).sku || "",
  };
};

// descripciones de las operaciones (capa de presentación · el set canónico vive en el seam)
const _operations = (P) => [
  ["overview", "una métrica a lo largo de una dimensión, en tabla/ranking · ej: 'ventas por cliente'"],
  ["rank", "top/bottom N de una dimensión por una métrica · ej: 'los 5 mejores clientes por contribución'"],
  ["compare", `dos entidades de una misma dimensión · ej: 'compará ${P.c0} con ${P.c1}'`],
  ["dive", `el detalle de UNA entidad · ej: '¿cómo está ${P.c0}?'`],
  ["diagnose", "los FOCOS de la cartera, GENERAL · ej: '¿qué me come el margen?', 'hazme un resumen ejecutivo', 'panorama del negocio', '¿cómo vengo?' · EN ADI 'resumen ejecutivo' SIEMPRE significa esto: los focos con su $ y su palanca (no un ranking ni una lectura de datos) · barre los focos (contribución no capturada · carga comercial alta · capital detenido) y los ordena por impacto en $. OJO: '¿dónde pierdo/se me va el DINERO?' ya NO es diagnose — es la historia del P&L (pnl_setup con pnl {intent:'perdiendo'}); si la pregunta es ESPECÍFICA de capital/inventario/bodega/SKU → usá `inventory`."],
  ["inventory", "FOCO en el CAPITAL INMOVILIZADO del inventario, por BODEGA y por SKU · ej: '¿dónde está mi capital inmovilizado?', 'qué bodegas y qué SKU tienen capital dormido', 'stock frenado, dónde' · responde SOLO capital/inventario (total → por bodega → por SKU → por qué rotación/DOH → qué hacer), NO el diagnóstico general. La pregunta manda el foco. Poné metric='capital', dimension='bodega'."],
  ["why", `el PORQUÉ de algo · ej: '¿por qué ${P.c0} cede margen?', '¿por qué este SKU no rota?', '¿por qué vendo más pero gano menos?' · reusa el mecanismo (carga/rotación/capital) y gradúa la certeza (probado / la señal apunta / no puedo afirmar)`],
  ["recommend", "QUÉ HACER · ej: '¿qué hago con los SKU dormidos?', '¿cómo lo corrijo?', '¿qué me recomendás?' · TAMBIÉN toda META de crecimiento u objetivo: 'qué tengo que hacer para subir un 3% las ventas', 'cómo mejoro el margen', 'dame alternativas para reducir el inventario' → SIEMPRE recommend con metric+dimension (NUNCA meta_question ni clarification_needed: una meta sobre ventas/margen/contribución/capital es un pedido de palancas) · recomienda SOLO sobre palancas probadas (carga/capital) con su $ y su trade-off; si la causa está abierta, recomienda diagnosticar (no inventa una solución) · si la meta trae un % objetivo, ADI la ancla al dato solo ($ de la meta + caminos)"],
  ["simulate", "QUÉ PASA SI · un SUPUESTO proyectado sobre el dato real · ej: '¿qué pasa si las ventas suben 3%?', '¿y si el capital baja 10%?' → operation simulate + `transform {kind:'assumption', op:'delta', value:±N, unit:'pct', base:'real'}` · TAMBIÉN el supuesto de una ACCIÓN sin %: 'si llevo la carga al target' → metric='carga', dimension='cliente' (sin transform · el cliente nombrado va en filters.cliente) · 'si libero el capital detenido' → metric='capital', dimension='sku' (sin transform) · OJO: '30% de margen' o 'el 80% de mi contribución' NO son simulaciones (son lecturas de margen/contribución); simulate exige el condicional (qué pasa si / y si…)"],
  ["explain_availability", "explicar si una métrica por un eje está disponible, o por qué no"],
  ["temporal", `el MES A MES o un PERIODO del año · ej: 'ventas mes a mes', 'dame las ventas por mes y por clientes en una tabla', '¿cómo vino el Q1 / el primer trimestre / el primer semestre?', 'ventas de enero a marzo', 'la venta de ${P.c0} por mes' → operation temporal + metric (ventas/contribucion/margen) + dimension = el eje del desglose si lo piden ('por cliente/familia/marca/sku') · entity si nombran una. ADI arma LA HISTORIA (tendencia · mejor/peor mes · quién tracciona) + la tabla; los periodos agregados son SUMA EXACTA de meses de la misma serie. El resultado/P&L mensual y el inventario mensual NO existen en el dato — pedilo igual con operation temporal y ADI declara el límite solo.`],
];

export function buildContractMenu() {
  const P = _picks();
  const L = [];
  L.push("Sos el TRADUCTOR de ADI. Convertís una pregunta de negocio en un SPEC canónico (JSON) llamando a la tool emit_spec.");
  L.push("NO calculás. NO respondés en prosa. NO inventás métricas ni ejes. SOLO emitís el spec, eligiendo de las listas de abajo.");
  L.push("");
  L.push("OPERACIONES (campo `operation`):");
  for (const [k, d] of _operations(P)) L.push(`  · ${k}: ${d}`);
  L.push("");
  L.push("MÉTRICAS (campo `metric`) y los ejes donde existen (campo `dimension`):");
  // F1 multiempresa: el menú SOLO enseña ejes que el dato del tenant activo trae (axisAvailable — una empresa
  // sin canal en sus ventas no ve el eje canal · con el demo la lista es byte-idéntica a la de siempre).
  for (const [k, m] of Object.entries(METRICS)) {
    const ejes = (m.axes || []).filter(axisAvailable);
    const blind = ejes.filter((a) => m.scenarioAware && m.scenarioAware[a] === false);
    const note = blind.length ? `   (base-only en ${blind.join(", ")}: no se simula)` : "";
    L.push(`  · ${k} (${m.label}): ${ejes.join(", ")}${note}`);
  }
  L.push("");
  L.push("EJES disponibles (campo `dimension`): " + Object.keys(ENTITIES).filter(axisAvailable).join(", ") + ".");
  if (axisAvailable("canal")) {
    // los VALORES del canal salen del dato (con el demo: Retail · E-commerce — línea byte-idéntica)
    const _cv = [];
    for (const r of (SOURCES[ENTITIES.canal.source].load() || [])) { const v = r[ENTITIES.canal.keyField]; if (v && !_cv.includes(v)) _cv.push(v); }
    const _c0 = _cv[0] || "", _c1 = _cv[1] || _c0;
    L.push(`  · canal = el canal comercial (agrupa los clientes: ${_cv.join(" · ")}). 'ventas por canal' → overview/rank ventas@canal · 'cuánto me deja cada canal' → contribucion@canal · 'compara ${_c0.toLowerCase()} con ${_c1.toLowerCase()}' → compare con comparison.entities ['${_c0}','${_c1}'] y dimension 'canal' · '¿cómo viene el ${_c1.toLowerCase()}?' → dive con dimension 'canal' y entity '${_c1}'.`);
  }
  L.push("");
  L.push("SUPUESTOS / PROYECCIÓN (campo `transform`): ADI proyecta un SUPUESTO sobre el DATO REAL — es 'actual vs supuesto', NO una segunda base ni un escenario del negocio (nada de bonanza/tensión/crisis).");
  L.push("  · Si el usuario pide proyectar/simular un cambio (ej. 'sube ventas 3%', 'agregales 3% a la contribución', '¿y si crece 5%?', 'bajá el capital 10%'), emití `transform { kind:'assumption', op:'delta', value:<n>, unit:'pct', base:'real' }`. value negativo = baja (ej. -5). Con el condicional explícito ('¿qué pasa si…?', 'y si…') usá operation:'simulate'.");
  L.push("  · Hoy se proyecta sobre ventas / contribución / capital (niveles), en cualquier eje. Otra métrica (margen/rotación/DOH, que son tasas) o eje no habilitado → ADI degrada honesto solo.");
  L.push("  · COMPUESTO: si el pedido combina 2 o más supuestos (ej. 'ventas +3% Y margen +2 puntos'), NO elijas uno solo ni proyectes parcial. Emití `transform { kind:'assumption', op:'multi', base:'real' }` → ADI degrada honesto (hoy proyecta un supuesto a la vez).");
  L.push("  · IMPORTANTE: dejá `scenario` en 'actual' aunque haya supuesto. La proyección vive en `transform`, NO en `scenario`. NO uses `scenario:'simulation'` ni `assumption` (son legacy, sin uso en el producto).");
  L.push("");
  L.push("CRUCES BLOQUEADOS (NO los pidas · no hay dato atómico para cruzarlos):");
  for (const bc of BLOCKED_CROSSES) L.push(`  · ${bc.cross.join(" × ")}: ${bc.reason}`);
  L.push("");
  L.push("REGLAS DEL SPEC:");
  L.push("  · `schemaVersion` SIEMPRE 1.");
  L.push("  · Elegí metric / dimension / operation SOLO de las listas de arriba. Si la pregunta no encaja exacto, elegí lo más cercano disponible.");
  L.push("  · rank: `sort.dir` 'desc' = los más altos · 'asc' = los más bajos · `limit` = N.");
  L.push("  · compare: `comparison { dimension, entities:[a, b] }` (exactamente dos).");
  L.push("  · dive: `dimension` = el TIPO de la entidad (cliente si es un cliente · marca si es una marca · bodega si es una bodega) · `entity` = el nombre · `metric` = una representativa (ej. margen · el dive perfila la entidad entera).");
  L.push("  · diagnose: para '¿dónde pierdo/gano plata?' y similares · `dimension` = cliente y `metric` = contribucion (representativos) · el motor barre TODOS los focos solo; filtrá con `filters` (marca/familia/bodega) si el usuario acota a una parte de la cartera.");
  L.push(`  · why: para '¿por qué…?' · \`dimension\` = el eje (cliente/sku/familia) · \`entity\` = la entidad si la nombran (ej. ${P.c0}, ${P.skuInv}) · \`metric\` opcional como pista (margen/carga/contribucion) · el motor reusa el mecanismo y gradúa la certeza.`);
  L.push("  · recommend: para '¿qué hago?' / '¿cómo lo corrijo?' · `dimension` = cliente (o el eje del foco) · `entity` = la entidad si la nombran · el motor recomienda SOLO sobre palancas probadas y, si la causa está abierta, recomienda diagnosticar.");
  L.push("  · filtro por marca/familia/cliente/bodega → `filters { marca?, familia?, cliente?, bodega? }`.");
  L.push("");
  L.push("CONVERSACIÓN — clasificá `turn_type` (V1). Puede venir un bloque CONTEXTO (turnos previos + la última evidencia accionable: metric/dimension/transform/boletaDigest + `memoria`). Usalo para resolver referencias:");
  L.push("  · `memoria` = la boleta de memoria del hilo: `entidad` en foco {nombre, eje} · `oferta` (la pregunta con que ADI cerró) · `proximaAccion` (la siguiente jugada sugerida) · `tema` {metrica, dimension}. Un 'sí/dale/muéstrame más/continuá' ACEPTA la `oferta` (o la `proximaAccion`): emití el turn_type/spec que la ejecute (ej. oferta de comparar → `followup_compare`; oferta de costos sobre la `entidad` → `why` con esa entidad). 'compáralo'/'por qué'/'profundiza' sin nombre refieren a `memoria.entidad` — SALVO que la pregunta sea autónoma o cambie de tema: ahí `new_query` normal, la memoria no fuerza una entidad vieja. Con `oferta`/`proximaAccion` claras evitá responder un 'sí' con `clarification_needed`; si la oferta es genuinamente ambigua (dos caminos), repreguntá corto cuál de los dos.");
  L.push("  · `new_query`: pedido AUTÓNOMO (no depende de lo anterior). Llená metric/dimension/operation normalmente. Ej: 'los 5 mejores clientes por margen'.");
  L.push("  · `followup_modify_assumption`: cambia el SUPUESTO de lo último ('y si fuera 5%', 'subilo a 10%'). Emití el spec YA RESUELTO: mismo metric/dimension/filters que `contexto.last`, con `transform` nuevo (value cambiado). NO calculás — solo el parámetro.");
  L.push("  · `followup_change_dimension`: mismo análisis, OTRO eje ('mostralo por marca', 'y por familia?'). Emití el spec resuelto: mismo metric/transform que `contexto.last`, `dimension` nueva.");
  L.push("  · `followup_recommendation`: '¿qué hacemos?' / '¿qué recomendás?' → NO emitas cifras; ADI arma la recomendación desde la última evidencia.");
  L.push("  · `followup_explain`: '¿por qué decís eso?' / 'explicámelo simple' → ADI explica desde la estructura ya computada.");
  L.push("  · `meta_question`: '¿esto es real o supuesto?' / '¿de dónde sale?' / '¿qué podés hacer?' → poné el tema en `meta` ('real_o_supuesto'|'fuente'|'capacidades').");
  L.push("  · `clarification_needed`: si el pedido es ambiguo o cruza mundos, poné la repregunta en `clarify` (no adivines).");
  L.push(`  · \`followup_compare\` ('compará con ${P.c1}', 'compáralo con ${P.cLower}', 'y versus ${P.c2}'): comparación conversacional. Poné en \`comparison.entities\` la(s) entidad(es) que el usuario NOMBRA (el target, ej. ['${P.cLower}']) y \`comparison.dimension\` = el eje de \`contexto.last\`. NO repitas el sujeto: ADI lo toma de la última evidencia. Si el usuario nombra dos entidades explícitas, poné las dos.`);
  L.push(`  · \`pnl_setup\`: el P&L COMERCIAL del usuario — SUS líneas de gasto (% sobre la venta) que él mismo define conversando. Usalo cuando el usuario: quiere armar/definir su P&L o sus gastos ('armemos mi p&l', 'definamos los gastos'), está EN el flujo (lista nombres de gastos como 'administrativos, logística, marketing' o da porcentajes sueltos tras una pregunta de ADI), edita una línea ('cambia logística a 2%', 'saca promotores', 'agrega bodegaje 1%'), o pregunta por su resultado después de gastos ('¿cómo queda mi resultado comercial?', '¿cuánto deja ${P.c0} después de gastos?', '¿cuánto tengo que vender para ganar $2M después de gastos?'). NO emitas metric/dimension ni cifras: ADI guía el flujo y calcula la cascada. OJO: nombres como 'marketing' o 'publicidad' en este flujo son LÍNEAS DE GASTO del usuario, no análisis de campañas.`);
  L.push(`  · pnl_setup CON ALCANCE (campo \`pnl\`): el P&L también va por entidad y por eje — 'P&L de ${P.c0}' / 'de ${P.fam}' / '¿cuánto vender en ${P.c0} para que deje $500K después de gastos?' → \`pnl {entity:'${P.c0}'}\` · 'P&L por familia/cliente/marca' → \`pnl {dimension:'familia'}\` · 'P&L del negocio' → \`pnl {dimension:'negocio'}\`. DISPONIBLE por ${_pnlDisponibleLinea()}; si piden un eje sin venta desglosada (punto de venta/bodega/SKU) EMITÍ IGUAL el pnl con esa dimension — ADI declara el límite y redirige honesto (nunca lo conviertas en otra lectura). CONTINUIDAD: tras un turno P&L (memoria.ruta pnl_*), '¿y el de ${P.cLow}?' hereda la operación con la entidad nueva → \`pnl {entity:'${P.cLow}'}\`; 'volvamos al P&L' / 'recuerda lo anterior' sobre un hilo P&L → pnl_setup sin campos (ADI retoma el último alcance); 'de esos, ¿cuánto me dejan después de gastos?' tras una lista → pnl_setup sin campos (ADI hereda el conjunto de la última evidencia). ESPEJO/RE-ARME: la INTENCIÓN de rehacer la estructura — 'quiero nuevos prorrateos/supuestos', 'cambiemos los porcentajes', 'rehagamos los gastos', o como sea que lo diga — es EL MISMO CAMINO del P&L → pnl_setup sin campos (ADI guía el rearme: pregunta los % de esta vez o la lista nueva), JAMÁS una lectura de ventas/margen. VENTA PROYECTADA: '¿y si (${P.c0}|el negocio) vendiera $25M, cuánto me queda con estos gastos?' o 'cambia/usa una venta de $25M' — un MONTO de venta (no un %) sobre el hilo P&L → pnl_setup (con entity si la nombra): ADI escala el P&L real manteniendo margen/carga y muestra real vs proyectado. NO lo conviertas en transform (el proyector de % es otra cosa). SEGUIMIENTO P&L-aware: tras un turno P&L, 'explícame esto más sencillo' → followup_explain · '¿qué decisiones tomo/qué hago con esto?' → followup_recommendation · '¿esto es real o supuesto?' → meta_question 'real_o_supuesto' — ADI responde con LA MISMA historia del P&L (clasificá el turn_type estándar, no inventes).`);
  L.push("  · SIN contexto o pedido autónomo → `new_query`. NUNCA inventes cifras ni entidades que no estén en el contexto o en las listas.");
  return L.join("\n");
}

// buildParseUserMessage(conversationContext, text) → el mensaje de usuario para el LLM #1. Si hay contexto (turnos + última
// evidencia), lo antepone como bloque legible para que el modelo clasifique turn_type y resuelva referencias. Sin contexto
// (o sin `last`) → solo el texto (turno aislado). El CONTEXTO es data para interpretar; el pedido real es "MENSAJE".
export function buildParseUserMessage(conversationContext, text) {
  const c = conversationContext;
  if (!c || (!c.last && !(c.turns && c.turns.length) && !c.memoria)) return String(text || "");
  const compact = { turns: c.turns || [], last: c.last || null, ...(c.memoria ? { memoria: c.memoria } : {}) };
  return `CONTEXTO DE CONVERSACIÓN (para interpretar · NO es el pedido):\n${JSON.stringify(compact)}\n\nMENSAJE DEL USUARIO:\n${String(text || "")}`;
}
