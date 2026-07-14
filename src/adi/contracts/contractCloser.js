/* === src/adi/contracts/contractCloser.js · CONTRATO DE RESPUESTA · CLOSER compartido ===
 * composeContract envuelve la resp de un productor spec-driven ANTES de _finalize y la convierte en respuesta
 * EJECUTIVA según el contrato (lectura → porqué → palanca → cierre). Reglas duras (owner 2026-07-03):
 *   · NO inventa causas: el porqué sale del mecanismo que el detector PROBÓ; si el dato no cierra la causa raíz,
 *     lo dice explícito (graduación honesta), nunca fabrica una causa.
 *   · NO introduce cifras nuevas: reusa las líneas del productor VERBATIM (toda cifra ya autorizada) y agrega SOLO
 *     marco cualitativo. Igual pasa el texto por el number-guard: si alguna cifra quedara no autorizada, DESCARTA el
 *     texto ejecutivo y cae al opener del productor (jamás manda un número de más).
 *   · NO-OP sobre _degrade / bloques honestos (no envolver un "no puedo" en un marco ejecutivo).
 *   · Fase 1: solo `diagnose_value_leak` ACTIVO · el resto stub → no-op. Ramas ricas NO pasan por acá (assert-only en tests).
 *
 * ADITIVO: el motor sellado answerADI.js NO importa este módulo → gate 16/0 intacto. Ver [[adi-contrato-de-respuesta]]. */
import { CONTRACTS } from "./contractRegistry.js";
import { numberGuard } from "../llm/numberGuard.js";
import { POLICY } from "../../config/businessPolicy.js";   // umbrales para LEER la tensión del dive (benchmark/rotación/DOH) · NO se citan como cifra

// GRADUACIÓN · porqué por detector: carga/capital = mecanismo PROBADO (condición del detector) → afirma ·
// margen = brecha OBSERVADA pero causa raíz ABIERTA → lo dice honesto (no inventa el precio/costo/mezcla).
const _PORQUE = {
  carga:   "la carga comercial está sobre el target interno — es valor que no llega al margen.",
  capital: "son SKU que dejaron de rotar; ahí queda el capital inmovilizado.",
  margen:  "el margen cede frente a su benchmark de cartera; la causa raíz (precio, costo o mezcla) necesita el detalle por SKU o canal.",
};
// frase honesta para un foco sin mecanismo reconocido (blindaje de "ADI no inventa")
const _HONEST_CAUSE = "con este dato veo el foco pero no puedo cerrar la causa — para eso necesito el detalle por SKU o canal.";

// composeContract(contractId, resp, evidence, ctx, scenario) → resp con opener EJECUTIVO (o intacta si no-op / guard falla)
export function composeContract(contractId, resp, evidence, ctx, scenario) {   // eslint-disable-line no-unused-vars
  const c = CONTRACTS[contractId];
  if (!c || !c.active) return resp;              // stub / no activado → no-op (Fase 1: solo diagnose)
  if (!resp || !resp.opener) return resp;        // _degrade / bloque honesto → no-op (no envolver un "no puedo")
  if (contractId === "diagnose_value_leak")  return _closeDiagnose(resp);
  if (contractId === "overview_domain")       return _closeOverview(resp);
  if (contractId === "rank_business_entity")  return _closeRank(resp);
  if (contractId === "dive_entity")           return _closeDive(resp);
  if (contractId === "compare_entities")      return _closeCompare(resp);
  if (contractId === "why_mechanism")         return _closeWhy(resp);
  if (contractId === "recommend_action")      return _closeRecommend(resp);
  return resp;
}

// candado compartido: el texto ejecutivo pasa por number-guard; si metiera una cifra no autorizada → cae al opener seguro.
function _guardWrap(resp, exec, contractId) {
  const g = numberGuard(exec, { text: resp.opener, evidence: resp.evidence });
  return { ...resp, opener: g.ok ? exec : resp.opener, evidence: { ...(resp.evidence || {}), _contract: { id: contractId, guard: g.ok ? "ok" : "fallback" } } };
}

// lee el PATRÓN de una tabla spec-driven (composeSpecRetrieval) desde evidence.rows · null si no hay al menos 2 filas
function _readRows(resp) {
  const ev = resp.evidence || {};
  const rows = Array.isArray(ev.rows) ? ev.rows : null;
  if (!rows || rows.length < 2) return null;             // sin ≥2 filas no hay patrón → no-op (deja el productor)
  const parts = String(resp.opener).split("\n\n");
  return {
    header: parts[0] || "",
    listLine: parts.slice(1).join("\n\n"),               // la lista formateada · reuso VERBATIM (cifras ya autorizadas)
    rows, leader: rows[0], tail: rows[rows.length - 1],
    metricLabel: (ev.metricLabel || "el valor").toLowerCase(),
    lowerBetter: ev.polarity === "lowerIsBetter",
  };
}

function _closeDiagnose(resp) {
  const ev = resp.evidence || {};
  const F = Array.isArray(ev.findings) ? ev.findings : [];
  const lines = String(resp.opener).split("\n");
  const header = lines[0] || "";
  const focoLines = lines.filter((l) => l.trim().startsWith("•"));
  if (!F.length || !focoLines.length) return resp;   // sin estructura reconocible → no-op seguro

  // IMPACTO + PORQUÉ por foco: la línea del productor VERBATIM (cifras ya autorizadas) + un porqué graduado (sin cifras).
  // Cada foco = su propio bloque (\n\n) y el porqué va FLUSH (sin sangría): 2+ espacios dispararían el render tabular (markdown.jsx).
  const focoBlocks = focoLines.map((line, i) => {
    const det = F[i] && F[i].detector;
    const por = _PORQUE[det] || _HONEST_CAUSE;
    return `${line}\n**Porqué:** ${por}`;
  });

  // PRIORIDAD: el foco que más pesa ($, ya viene ordenado desc) · nombre = titulo (texto, sin cifra nueva)
  const biggest = (F[0] && F[0].titulo) ? F[0].titulo.toLowerCase() : "el foco de mayor impacto";
  const prioridad = `**Prioridad:** lo que más pesa es ${biggest} — arrancá por ahí.`;

  // PALANCA: adaptada a los focos presentes (accionable · sin cifras)
  const dets = new Set(F.map((f) => f.detector));
  const pal = [];
  if (dets.has("carga"))   pal.push("la carga comercial es lo más accionable rápido: recuperás margen sin resignar venta");
  if (dets.has("capital")) pal.push("el capital detenido se libera revisando esos SKU sin rotar");
  if (dets.has("margen") && !dets.has("carga")) pal.push("el margen bajo benchmark pide mirar precio/costo o la carga por cliente");
  const palanca = "**Palanca:** " + (pal.length ? pal.join("; ") + "." : "atacá primero el foco de mayor impacto.");

  // PRÓXIMO PASO: la guía que ya generó el productor (texto, sin cifras)
  const proximo = (resp.suggestions && resp.suggestions[0]) ? `**Próximo paso:** ${resp.suggestions[0]}.` : "**Próximo paso:** profundizá en el foco que más pesa.";

  const exec = [header, ...focoBlocks, [prioridad, palanca, proximo].join("\n")].join("\n\n");

  // NUMBER-GUARD · candado: el texto ejecutivo no puede introducir una cifra fuera del opener/evidence del productor.
  const g = numberGuard(exec, { text: resp.opener, evidence: resp.evidence });
  const opener = g.ok ? exec : resp.opener;      // por si un cambio futuro metiera una cifra de más → cae al opener seguro
  return { ...resp, opener, evidence: { ...ev, _contract: { id: "diagnose_value_leak", guard: g.ok ? "ok" : "fallback" } } };
}

// dispatcher overview_domain: INVENTARIO (composeSpecRetrieval · evidence.rows) vs COMERCIAL (composeRetrieval · materialMetrics/_qiContext).
function _closeOverview(resp) {
  if (resp.evidence && Array.isArray(resp.evidence.rows)) return _closeOverviewInventory(resp);
  if (resp.materialMetrics || resp._qiContext) return _closeOverviewCommercial(resp);
  return resp;                                   // forma no reconocida → no-op seguro
}

// overview_domain COMERCIAL: composeRetrieval YA trae tabla + Lectura(concentración) + Foco(cruce con margen). El closer
// PREPONE la lectura general (VOLUMEN vs VALOR + honestidad de snapshot) → sale READING-FORWARD, no como tabla · NO fuerza
// fuga ni palanca (es panorama) · reusa el opener entero (RIL) → number-safe trivial (cero cifra nueva). NO toca el motor.
function _closeOverviewCommercial(resp) {
  const metric = resp._qiContext && resp._qiContext.metric;
  const isValue = metric === "margen" || metric === "contribucion" || metric === "carga";
  const lead = isValue
    ? "**Lectura general:** acá estás mirando el **valor** de la venta (su calidad), no el tamaño. Con el snapshot actual (sin evolución en el tiempo), lo que importa es quién sostiene el margen y quién lo diluye."
    : "**Lectura general:** esto es **volumen** —cuánto entra por cliente—, todavía no si la venta es sana. Con el snapshot actual (sin evolución en el tiempo), el tamaño solo no lo dice: eso lo define cruzarlo con el margen.";
  return _guardWrap(resp, `${lead}\n\n${resp.opener}`, "overview_domain");
}

// overview_domain INVENTARIO: lectura general → volumen → concentración → señal → QUÉ HACER PRIMERO (sello: la señal
// que merece atención + la acción con su $, no un cruce explorador). SIN tendencia (el inventario no trae período ·
// honesto). Reusa header + lista VERBATIM + líder/cola (cifras del opener) · marco cualitativo.
function _closeOverviewInventory(resp) {
  const R = _readRows(resp); if (!R) return resp;
  const concentracion = `**Concentración:** el grueso del ${R.metricLabel} está en ${R.leader.name} (${R.leader.fmt}); el más bajo es ${R.tail.name} (${R.tail.fmt}).`;
  const senal = R.lowerBetter
    ? `**Señal:** ${R.leader.name} es donde más se acumula — el punto a vigilar.`
    : `**Señal:** ${R.leader.name} es el más fuerte; ${R.tail.name} el que más lejos quedó.`;
  const accion = R.lowerBetter
    ? `**Qué hacer primero:** abrí ${R.leader.name} — concentra ${R.leader.fmt} de ${R.metricLabel} y es donde más hay para destrabar. ¿Lo desglosamos?`
    : `**Qué hacer primero:** abrí ${R.leader.name} — con ${R.leader.fmt} es el bloque que más pesa en ${R.metricLabel}; ahí está el movimiento más grande. ¿Lo desglosamos?`;
  return _guardWrap(resp, [R.header, R.listLine, concentracion, senal, accion].join("\n\n"), "overview_domain");
}

// rank_business_entity: ranking → patrón → brecha/concentración → advertencia (polaridad) → QUÉ HACER PRIMERO
// (sello: la señal que merece atención + la acción con su $, no un cruce explorador).
function _closeRank(resp) {
  const R = _readRows(resp); if (!R) return resp;
  const patron = `**Patrón:** ${R.leader.name} (${R.leader.fmt}) está en la punta; ${R.tail.name} (${R.tail.fmt}) en la otra.`;
  const lo = Math.min(Math.abs(R.leader.value), Math.abs(R.tail.value)) || 1;
  const spread = Math.abs(R.leader.value - R.tail.value) / lo;
  const brechaAdj = spread >= 2 ? "amplia" : spread >= 0.5 ? "marcada" : "estrecha";   // adjetivo derivado del dato (sin citar cifra)
  const brecha = `**Brecha:** la distancia entre ${R.leader.name} y ${R.tail.name} es ${brechaAdj} — ahí se ve la concentración.`;
  const advertencia = R.lowerBetter
    ? `**Ojo:** en ${R.metricLabel} lo más bajo es lo mejor — el que encabeza es el que más pesa, no el que mejor está.`
    : `**Lectura:** cuanto más arriba, mejor en ${R.metricLabel}.`;
  const accion = R.lowerBetter
    ? `**Qué hacer primero:** la señal que merece atención es ${R.leader.name}: ${R.leader.fmt} de ${R.metricLabel}, lo que más pesa de la lista. Abrilo y vemos qué lo explica y cuánto se recupera. ¿Lo desgloso?`
    : `**Qué hacer primero:** la señal está en ${R.leader.name}: con ${R.leader.fmt} es el bloque que sostiene el resultado — defenderlo o crecerlo es la primera jugada. ¿Lo abro en detalle?`;
  return _guardWrap(resp, [R.header, R.listLine, patron, brecha, advertencia, accion].join("\n\n"), "rank_business_entity");
}

// dive_entity: perfil → tensión → mecanismo (graduado por umbral · probado/abierto) → impacto → siguiente análisis.
// La tensión se DETECTA con umbrales de POLICY (margen<benchmark · rotación<min · doh>max) pero NO cita el umbral (cifra nueva);
// solo reusa la cifra de la propia entidad (fmt del opener). Si no hay señal fuerte → lo dice honesto (no inventa mecanismo).
function _closeDive(resp) {
  const ev = resp.evidence || {};
  const metrics = Array.isArray(ev.metrics) ? ev.metrics : null;
  if (!metrics || !metrics.length) return resp;
  const parts = String(resp.opener).split("\n\n");
  const header = parts[0] || "", listLine = parts.slice(1).join("\n\n");
  const mMargen  = metrics.find((m) => m.unit === "pct" && /margen/i.test(m.label));
  const mRot     = metrics.find((m) => /rotaci/i.test(m.label));
  const mDoh     = metrics.find((m) => /cobertura|doh/i.test(m.label));
  const mCapital = metrics.find((m) => m.unit === "money" && /capital/i.test(m.label));
  const mContrib = metrics.find((m) => m.unit === "money" && /contribuci/i.test(m.label));
  // prioridad de tensión: salud de INVENTARIO primero (rotación/DOH · coherente con el diagnose de capital dormido),
  // después margen bajo benchmark, y si nada dispara → lo dice honesto (no inventa).
  let tension, mecanismo, tKind = null;
  if (mRot && typeof mRot.value === "number" && mRot.value < POLICY.rotacionMin) {
    tension = `**Tensión:** la rotación (${mRot.fmt}) es baja — casi no se mueve.`;
    mecanismo = "**Mecanismo:** stock que no rota → capital inmovilizado (probado por el dato)."; tKind = "inv";
  } else if (mDoh && typeof mDoh.value === "number" && mDoh.value > POLICY.dohMax) {
    tension = `**Tensión:** la cobertura (${mDoh.fmt}) es alta — hay más stock del que se vende.`;
    mecanismo = "**Mecanismo:** cobertura alta → capital inmovilizado (probado por el dato)."; tKind = "inv";
  } else if (mMargen && typeof mMargen.value === "number" && mMargen.value < POLICY.benchmark) {
    tension = `**Tensión:** el margen (${mMargen.fmt}) está por debajo de su benchmark de cartera.`;
    mecanismo = "**Mecanismo:** margen bajo benchmark — probado por el dato; la causa raíz (precio, costo o carga) necesita más detalle."; tKind = "margen";
  } else {
    tension = "**Tensión:** no veo una tensión marcada con este dato — el perfil se ve parejo.";
    mecanismo = "**Mecanismo:** sin una señal fuerte no afirmo un mecanismo; para cerrarlo necesito el detalle por período o canal.";
  }
  // impacto: la plata en juego SEGÚN la tensión (inventario → capital · margen → contribución · si no, la primera money)
  const mImp = (tKind === "inv" && mCapital) ? mCapital : (tKind === "margen" && mContrib) ? mContrib : (mContrib || mCapital || metrics.find((m) => m.unit === "money"));
  const impacto = mImp ? `**Impacto:** pesa ${mImp.fmt} en ${mImp.label.toLowerCase()}.` : null;
  const accion = "**Siguiente análisis:** ¿lo comparo con otro para ubicarlo mejor, o abro el detalle?";
  const exec = [header, listLine, tension, mecanismo, impacto, accion].filter(Boolean).join("\n\n");
  return _guardWrap(resp, exec, "dive_entity");
}

// compare_entities: diferencia principal (mayor delta relativo) → ganador (según polaridad del criterio) → riesgo/trade-off → decisión.
// Reusa las cifras del opener (aFmt/bFmt) · el ganador se decide con los valores + polaridad, sin citar cifra nueva.
function _closeCompare(resp) {
  const ev = resp.evidence || {};
  const pairs = Array.isArray(ev.pairs) ? ev.pairs : null;
  if (!pairs || !pairs.length) return resp;
  const a = ev.entidad, b = ev.entityB;
  const parts = String(resp.opener).split("\n\n");
  const header = parts[0] || "", listLine = parts.slice(1).join("\n\n");
  const scored = pairs
    .filter((p) => typeof p.aVal === "number" && typeof p.bVal === "number")
    .map((p) => { const lo = Math.min(Math.abs(p.aVal), Math.abs(p.bVal)) || 1; return { ...p, spread: Math.abs(p.aVal - p.bVal) / lo }; })
    .sort((x, y) => y.spread - x.spread);
  if (!scored.length) return resp;
  const top = scored[0], lowerBetter = top.polarity === "lowerIsBetter";
  const winner = (lowerBetter ? top.aVal < top.bVal : top.aVal > top.bVal) ? a : b;
  const loser = winner === a ? b : a, crit = top.label.toLowerCase();
  const dif = `**Diferencia principal:** en ${crit}, ${a} ${top.aFmt} vs ${b} ${top.bFmt} — es lo que más los separa.`;
  const ganador = `**Ganador (por ${crit}):** ${winner} rinde mejor en ese criterio.`;
  const riesgo = `**Riesgo / trade-off:** ${loser} no queda descartado — puede ganar en otra métrica de la lista; no cierres por un solo número.`;
  const decision = `**Decisión:** si lo que más te importa es ${crit}, ${winner}; si pesa otra métrica, mirá su fila antes de elegir.`;
  return _guardWrap(resp, [header, listLine, dif, ganador, riesgo, decision].join("\n\n"), "compare_entities");
}

// why_mechanism · dispatcher: reusa el productor spec-driven que ya trae la causa. NUNCA reescribe una rama rica
// (el book-wide vía dispatchIntent no pasa por acá · lo devuelve el seam tal cual). Slots [mecanismo·evidencia·certeza·impacto·palanca].
function _closeWhy(resp) {
  const ev = resp.evidence || {};
  if (Array.isArray(ev.findings) && ev.findings.length) return _whyFromDiagnose(resp);   // cliente scoped (composeSpecDiagnose)
  if (Array.isArray(ev.metrics)  && ev.metrics.length)  return _whyFromDive(resp);        // sku/familia (composeSpecDive)
  return resp;                                                                            // forma no reconocida → no-op seguro
}

// why desde un DIVE (sku/familia): reusa el mismo ladder de _closeDive (rotación/DOH/margen) — el `trapped_capital` del
// motor es un stub muerto, así que ESTA es la lógica reusable. Gradúa: probado (inventario) · señal (margen · causa raíz abierta)
// · insuficiente (perfil parejo → frase honesta). Evidencia = el perfil completo VERBATIM (todas las cifras autorizadas).
function _whyFromDive(resp) {
  const ev = resp.evidence || {};
  const metrics = Array.isArray(ev.metrics) ? ev.metrics : null;
  if (!metrics || !metrics.length) return resp;
  const parts = String(resp.opener).split("\n\n");
  const header = parts[0] || "", listLine = parts.slice(1).join("\n\n");
  const mMargen  = metrics.find((m) => m.unit === "pct" && /margen/i.test(m.label));
  const mRot     = metrics.find((m) => /rotaci/i.test(m.label));
  const mDoh     = metrics.find((m) => /cobertura|doh/i.test(m.label));
  const mCapital = metrics.find((m) => m.unit === "money" && /capital/i.test(m.label));
  const mContrib = metrics.find((m) => m.unit === "money" && /contribuci/i.test(m.label));
  let mech, certeza, palanca, tKind = null;
  if (mRot && typeof mRot.value === "number" && mRot.value < POLICY.rotacionMin) {
    mech = "stock que no rota → capital inmovilizado";
    certeza = "**Certeza:** probado por el dato."; palanca = "**Palanca:** el capital se libera moviendo o liquidando ese stock."; tKind = "inv";
  } else if (mDoh && typeof mDoh.value === "number" && mDoh.value > POLICY.dohMax) {
    mech = "cobertura alta → capital inmovilizado";
    certeza = "**Certeza:** probado por el dato."; palanca = "**Palanca:** el capital se libera bajando el stock a su rotación real."; tKind = "inv";
  } else if (mMargen && typeof mMargen.value === "number" && mMargen.value < POLICY.benchmark) {
    mech = "margen bajo su benchmark de cartera";
    certeza = "**Certeza:** la señal apunta a margen bajo benchmark; la causa raíz (precio, costo o carga) queda abierta — para cerrarla necesito el detalle por SKU o canal.";
    palanca = "**Palanca / siguiente cruce:** cruzá precio, costo y carga por SKU o canal."; tKind = "margen";
  } else {
    mech = "sin una señal fuerte, no afirmo un mecanismo";
    certeza = "**Certeza:** con este dato no puedo afirmar causa; para cerrarla necesito el detalle por período o canal.";
    palanca = "**Siguiente cruce:** abrí el detalle por período o canal."; tKind = null;
  }
  const mImp = (tKind === "inv" && mCapital) ? mCapital : (tKind === "margen" && mContrib) ? mContrib : (mContrib || mCapital || metrics.find((m) => m.unit === "money"));
  const impacto = mImp ? `**Impacto:** pesa ${mImp.fmt} en ${mImp.label.toLowerCase()}.` : null;
  const exec = [header, `**Mecanismo:** ${mech}.`, `**Evidencia:** ${listLine}`, certeza, impacto, palanca].filter(Boolean).join("\n\n");
  return _guardWrap(resp, exec, "why_mechanism");
}

// why desde un DIAGNOSE scoped a un cliente: reusa el _PORQUE del diagnose (carga=probado · margen=causa raíz abierta).
// Evidencia = las líneas de foco VERBATIM (con su $ · autorizadas). Palanca = la guía que el diagnose ya generó.
function _whyFromDiagnose(resp) {
  const ev = resp.evidence || {};
  const F = Array.isArray(ev.findings) ? ev.findings : [];
  const openerLines = String(resp.opener).split("\n");
  const header = openerLines[0] || "";
  const focoLines = openerLines.filter((l) => l.trim().startsWith("•"));
  if (!F.length || !focoLines.length) return resp;
  // el mecanismo LIDERA con el detector PROBADO y accionable (carga → capital), no con el foco de mayor $ (que suele
  // ser el margen · causa raíz abierta) — así el porqué afirma cuando el dato prueba, coherente con el mecanismo determinístico.
  const mechFoco = F.find((f) => f.detector === "carga") || F.find((f) => f.detector === "capital") || F[0];
  const proven = mechFoco.detector === "carga" || mechFoco.detector === "capital";
  const mecanismo = `**Mecanismo:** ${_PORQUE[mechFoco.detector] || _HONEST_CAUSE}`;
  const evidencia = `**Evidencia:**\n${focoLines.join("\n")}`;
  const certeza = proven
    ? "**Certeza:** probado por el dato."
    : "**Certeza:** la señal apunta ahí; la causa raíz queda abierta — para cerrarla necesito el detalle por SKU o canal.";
  const palanca = (resp.suggestions && resp.suggestions[0]) ? `**Palanca:** ${resp.suggestions[0]}.` : "**Palanca:** cruzá con carga/precio/costo para cerrar la causa.";
  return _guardWrap(resp, [header, mecanismo, evidencia, certeza, palanca].join("\n\n"), "why_mechanism");
}

// recommend_action (el de MAYOR riesgo de invención). GUARDRAILS DUROS: recomienda SOLO sobre palancas PROBADAS y
// accionables (carga → $ recuperable · capital → $ liberable). NUNCA recomienda una solución para el margen bajo benchmark
// (causa raíz abierta) → ahí recomienda DIAGNOSTICAR la causa. Impacto = el $ ya computado (reusado, sin cifra nueva).
// Trade-off explícito incluyendo lo que el dato NO sabe (la reacción del volumen). Slots [recomendación·fundamento·impacto·trade-off·primer paso].
function _closeRecommend(resp) {
  const ev = resp.evidence || {};
  const F = Array.isArray(ev.findings) ? ev.findings : [];
  const openerLines = String(resp.opener).split("\n");
  const header = openerLines[0] || "";
  const focoLines = openerLines.filter((l) => l.trim().startsWith("•"));
  if (!F.length || !focoLines.length) return resp;
  const cargaF = F.find((f) => f.detector === "carga");
  const capF   = F.find((f) => f.detector === "capital");
  const actionable = cargaF || capF;   // palancas PROBADAS y accionables · el margen (causa abierta) NO es accionable

  if (!actionable) {
    // sólo hay margen (causa raíz abierta) o nada probado → NO inventa una recomendación · recomienda diagnosticar
    const exec = [header,
      "**Recomendación:** todavía no tengo una palanca accionable *probada* para recomendar una acción concreta.",
      `**Fundamento:** el foco material es margen bajo benchmark, y su causa raíz (precio, costo o mezcla) el dato no la cierra:\n${focoLines.join("\n")}`,
      "**Trade-off / riesgo:** recomendar una acción sin la causa raíz sería inventar una solución que el dato no sostiene.",
      "**Primer paso:** un diagnóstico de causa raíz por SKU o canal — recién con eso hay una acción que recomendar.",
    ].join("\n\n");
    return _guardWrap(resp, exec, "recommend_action");
  }

  const isCarga = !!cargaF;
  const topEntity = actionable.items && actionable.items[0] ? actionable.items[0].entidad : null;
  const recomendacion = isCarga
    ? `**Recomendación:** llevá la carga comercial hacia el target interno${topEntity ? `, empezando por ${topEntity}` : ""}.`
    : `**Recomendación:** liberá el capital detenido de los SKU que no rotan${topEntity ? ` (arrancá por ${topEntity})` : ""}.`;
  const fundamento = isCarga
    ? "**Fundamento:** la carga está sobre el target interno — es valor que hoy no llega al margen (probado por el dato)."
    : "**Fundamento:** son SKU que dejaron de rotar; su capital queda inmovilizado (probado por el dato).";
  // impacto = el $ YA computado por el diagnose (líneas de foco VERBATIM · nada nuevo)
  const impacto = `**Impacto esperado:** lo que está en juego, por foco:\n${focoLines.join("\n")}`;
  const tradeoff = isCarga
    ? "**Trade-off / riesgo:** renegociar el rebate puede presionar el volumen — el dato NO predice esa reacción; ese es el riesgo a poner sobre la mesa."
    : "**Trade-off / riesgo:** mover o liquidar stock suele ser a descuento; el dato no dice a qué precio real se coloca.";
  const primerPaso = isCarga
    ? `**Primer paso:** sentate con comercial a ver cuánto del rebate${topEntity ? ` de ${topEntity}` : ""} se puede mover sin resignar volumen.`
    : "**Primer paso:** listá esos SKU y definí liquidación o reubicación con logística.";
  return _guardWrap(resp, [header, recomendacion, fundamento, impacto, tradeoff, primerPaso].join("\n\n"), "recommend_action");
}
