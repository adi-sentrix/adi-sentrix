/* === src/adi/oracle/caminoNatural.js · EL CAMINO NATURAL COMO PRINCIPAL (owner 2026-08-14, autorizado) =========
 * QUÉ ES: el flujo de la constitución («El flujo», _CONSTITUCION_ADI.md) productizado desde el brazo natural
 * MEDIDO de `_corrida_doble.mjs` (armNatural, 28 turnos en 3 corridas):
 *   1. el turno llega con la conversación completa → el CEREBRO responde (persona + carpeta + doctrina + contrato
 *      [[CALCULO]] — el system vive en naturalPrompt.js y viaja por el gateway);
 *   2. el NOTARIO (guardC) juzga con el contexto natural completo (dato proyectado · entidades del tenant ·
 *      supuestos del usuario vivos en el hilo · alcance heredado · re-cita aprobada);
 *   3. veto → UNA reparación con la multa → segundo juicio → suplente digno. Ese ciclo YA existe
 *      (`responderConNotario`, cicloNotarial.js, gateado offline) — acá NO se reimplementa: se le INYECTAN las
 *      piezas, exactamente como lo hacía el arnés;
 *   4. pantalla — SIEMPRE con `extraerCalculos(...).limpio`: el bloque [[CALCULO]] jamás llega al usuario, en
 *      ninguno de los estados (verde/reparado/suplente/vacío) — condición 1 del owner.
 *
 * PURO · sin red · sin imports del gateway: el cerebro entra por `callNatural` (lo pone el caller — ChatADI en
 * producción, una función local en los gates). La MISMA doctrina que hizo verificable a cicloNotarial.
 *
 * EL ÚNICO BYPASS QUE SE CONSERVA: la memoria de criterio («recuerda que mi margen mínimo es 25%») NECESITA
 * persistir en el motor y el cerebro no puede — corre ANTES del cerebro, con la MISMA red y la MISMA composición
 * que answerViaOracle (detectCriteriaIntent/composeCriteria, cero reimplementación). Los demás bypasses del
 * oráculo NO se replican acá: mueren con el camino (decisión del encargo, no un olvido).
 *
 * LO QUE ESTE CAMINO NO HACE (v1, medido): no tiene tools — lo que la carpeta no trae se declara como límite
 * (MEDIDO que declina bien). La serie mensual, el P&L guiado y «por qué esa cifra» siguen siendo de los
 * interceptores/camino actual, que corren ANTES en ChatADI. */
import { responderConNotario, alcanceHeredadoDe, recitaAprobadaDe } from "./cicloNotarial.js";
import { guardC, esNarracionVacia } from "./guardC.js";
import { cifrasDelDato, suplenteDignoDelDato } from "./datoProyectado.js";
import { axisEntityNames } from "./entityIndex.js";
import { parseFigures } from "../boleta.js";
import { stripLanguageLeaks } from "../llm/voiceGuard.js";
import { extraerCalculos, stripAllMarks, composeNoDataMessage } from "./narrationBlocks.js";
import { normalizeResponse } from "../responseContract.js";
import { detectCriteriaIntent } from "../criteria.js";     // el MISMO detector que answerViaOracle — una red, una verdad
import { composeCriteria } from "../conversation.js";      // la MISMA composición (setCriterion/forgetCriterion), jamás una copia
import { envejecerPendingSimulation, pendingSimulationVigente, withOfertaPendiente } from "./conversationScope.js";

// Los MISMOS ejes que el arnés: 3 para «entidades» (cifra-con-dueño), 6 para «dueños» (vocabulario completo).
const _EJES_ENTIDADES = ["cliente", "sku", "marca"];
const _EJES_DUENOS = ["cliente", "sku", "marca", "familia", "bodega", "canal"];
const _ejes = (lista) => {
  const o = [];
  for (const e of lista) { try { for (const n of axisEntityNames(e)) o.push(n); } catch { /* sin índice: ese eje no participa */ } }
  return o.length ? o : null;
};
const _catalogoPorEje = () => {
  const o = {};
  for (const eje of _EJES_DUENOS) {
    try { const n = axisEntityNames(eje); if (n && n.length) o[eje] = n; } catch { /* sin índice */ }
  }
  return o;
};

// el turno del NOTARIO que se le devuelve al cerebro en la reparación — TEXTUAL del arnés medido.
const _MENSAJE_NOTARIO = (multa) => `[NOTARIO — no es el usuario] Tu respuesta no pasó la verificación:\n${multa}\nReescribe tu respuesta COMPLETA corrigiendo solo lo observado, manteniendo tu calidad de asesor. No menciones esta corrección.`;

// la causa del reintento, como token corto para la telemetría del gateway (misma lista cerrada que ya viaja en
// `motivoReintento` del camino actual). Sale del primer [kind] de la multa; si no hay, undefined y el gateway
// registra "unknown" — nunca texto libre.
const _motivoDeMulta = (multa) => {
  const m = String(multa || "").match(/^\[([a-z_-]+)\]/i);
  return m ? m[1].toLowerCase() : undefined;
};

/**
 * answerViaNatural({ text, history, mem, scenario, callNatural }) → { r, mem } | throws
 *  · text      · el turno del usuario.
 *  · history   · el hilo de la UI ([{role:"user"|"adi", text}]) — viaja ENTERO al cerebro, como en el arnés.
 *  · mem       · la memoria de interacción del hilo. Se ACTUALIZA (recentNarrations con el texto LIMPIO;
 *                recitaAprobada SOLO si el muro aprobó) — jamás se crea una memoria paralela.
 *  · scenario  · el escenario del turno (default "actual").
 *  · callNatural({ mensajes, attempt, motivoReintento }) → Promise<string> — la ÚNICA puerta al mundo.
 * Si el cerebro/gateway LANZA, esta función relanza: la red de resiliencia vive en el caller (ChatADI cae al
 * camino actual en el mismo turno). r.route="natural" · r.natural = el registro del turno (condición 5).
 */
/* ── EL ESCALÓN QUE FALTABA EN LA ESCALERA DEL SUPLENTE (owner 2026-08-21) ────────────────────────────────────
 * EL DEFECTO, visto por el owner en producción: pidió «hazme un resumen ejecutivo de las dos cosas que te he
 * preguntado» después de DOS respuestas buenas, y el turno cayó al suplente — que le devolvió los KPIs
 * generales del negocio. O sea: arriba, en la misma conversación, había dos lecturas ya aprobadas por el
 * notario, y el respaldo las tiró a la basura para empezar de cero desde la carpeta.
 * EL ESCALÓN: antes de caer al genérico, ofrecer lo que ESTA conversación ya validó. Y se ofrece VERBATIM, no
 * reescrito: un texto que el muro ya aprobó vuelve a pasar por construcción, mientras que resumirlo sería
 * volver a intentar exactamente lo que acaba de fallar. Se juzga igual que cualquier otro peldaño — si el texto
 * viejo no pasa el muro de hoy (una regla nueva puede alcanzarlo), cae al peldaño siguiente sin ruido.
 * NO ES UN CONTRATO NUEVO: es la MISMA escalera de `suplenteDignoDelDato`, con un peldaño más arriba. */
function _respaldoDeLoYaAprobado(memIn, juzgar) {
  const previas = Array.isArray(memIn && memIn.recentNarrations)
    ? memIn.recentNarrations.filter((t) => typeof t === "string" && t.trim().length > 40)
    : [];
  if (!previas.length) return null;
  const candidato = [
    "No pude armar la lectura nueva con la calidad que corresponde. Lo que ya te respondí sobre esto quedó verificado y sigue en pie:",
    "",
    previas[0].trim(),
    "",
    "Dime qué parte de esto necesitas y lo trabajo sobre esas mismas cifras.",
  ].join("\n");
  if (typeof juzgar !== "function") return candidato;
  try { const v = juzgar(candidato); return v && v.ok ? candidato : null; } catch { return null; }
}

export async function answerViaNatural({ text, history, mem, scenario = "actual", callNatural } = {}) {
  if (typeof callNatural !== "function") throw new TypeError("answerViaNatural sin callNatural: el cerebro lo pone el caller");
  const q = String(text || "").trim();
  const memIn = (mem && typeof mem === "object") ? mem : {};
  const recentNarrationsPrev = Array.isArray(memIn.recentNarrations) ? memIn.recentNarrations : [];

  // ── MEMORIA DE CRITERIO · el único bypass conservado — el MISMO bloque que answerViaOracle (~L1561): misma
  // red, misma composición, mismo trato de la memoria. NO pasa por guardC por la misma razón documentada allá
  // (confirmación administrativa con cifras que el usuario nombró; el muro la vetaría como cifra-no-autorizada).
  const criteriaIntent = detectCriteriaIntent(q);
  if (criteriaIntent) {
    const cr = composeCriteria(criteriaIntent);
    let mem2 = { ...memIn, lastOffer: null, pendingSimulation: envejecerPendingSimulation(pendingSimulationVigente(memIn.pendingSimulation)), recentNarrations: [cr.text, ...recentNarrationsPrev].slice(0, 2) };
    if (mem2.conversationScope) mem2 = { ...mem2, conversationScope: withOfertaPendiente(mem2.conversationScope, null) };
    return {
      r: normalizeResponse({
        text: cr.text,
        route: "oracle",   // byte-idéntico al bypass del camino actual: es el MISMO bypass, conservado
        evidence: cr.evidence,
        deterministic: true,
        claims: [],
        suggestions: cr.suggestions || null,
        sentrixAction: cr.sentrixAction || null,
      }),
      mem: mem2,
    };
  }

  // ── EL CONTEXTO DEL NOTARIO · las mismas cinco piezas del arnés, de las mismas fuentes ──────────────────────
  const cifras = cifrasDelDato(scenario);
  const entidades = _ejes(_EJES_ENTIDADES);
  const duenos = _ejes(_EJES_DUENOS);
  const catalogoPorEje = _catalogoPorEje();
  // lo que el USUARIO declaró sigue vivo en el hilo (los supuestos): parseFigures de SUS turnos + el actual.
  const supuestosDelHilo = [];
  const hilo = Array.isArray(history) ? history : [];
  for (const h of hilo) {
    if (!h || h.role !== "user" || typeof h.text !== "string") continue;
    for (const pf of parseFigures(h.text)) supuestosDelHilo.push(pf.text);
  }
  for (const pf of parseFigures(q)) supuestosDelHilo.push(pf.text);
  // la respuesta anterior es mem.recentNarrations[0] — la memoria que YA existe, nunca una nueva.
  const respuestaAnterior = typeof recentNarrationsPrev[0] === "string" ? recentNarrationsPrev[0] : null;
  const heredado = alcanceHeredadoDe({ pregunta: q, respuestaAnterior, catalogoPorEje });
  const recita = (memIn.recitaAprobada && Array.isArray(memIn.recitaAprobada.figs) && memIn.recitaAprobada.figs.length)
    ? memIn.recitaAprobada : null;
  const juzgar = (texto) => guardC(texto, {
    ledger: { figs: [] }, results: [], trace: null, question: q,
    supuestoPendiente: supuestosDelHilo, alcanceHeredado: heredado, recitaAprobada: recita,
    datoProyectado: cifras, entidadesDelTenant: entidades, duenosDelTenant: duenos,
    contentScope: "full", tablePolicy: "auto",
  });

  // SONDA TEMPORAL (2026-08-14): expone EL MISMO juez que usa este turno, con SU contexto, para poder llamarlo
  // desde afuera con un texto exacto. Sin esto, medir en la app y medir en una sonda no son comparables.
  if (typeof window !== "undefined") window.__ADI_JUEZ__ = juzgar;

  // ── EL HILO QUE VE EL CEREBRO · la conversación completa, con el turno del usuario al final ─────────────────
  const mensajes = [];
  for (const h of hilo) {
    if (!h || typeof h.text !== "string" || !h.text.trim() || h.pending) continue;
    mensajes.push({ role: h.role === "user" ? "user" : "assistant", content: h.text });
  }
  /* EL TURNO ACTUAL, UNA SOLA VEZ (medido en la app 2026-08-14): ChatADI empuja el mensaje del usuario a
   * `messages` ANTES de llamar, así que el turno ya viene en `history` y agregarlo de nuevo lo mandaba
   * DUPLICADO al cerebro («user · assistant · user · user»). El proveedor lo tolera, pero es ruido que confunde
   * al modelo y paga tokens dos veces. Se agrega solo si el hilo no lo trae ya como último turno del usuario. */
  const _ultimo = mensajes.length ? mensajes[mensajes.length - 1] : null;
  if (!(_ultimo && _ultimo.role === "user" && _ultimo.content.trim() === q)) mensajes.push({ role: "user", content: q });

  // ── EL CICLO DE LA CONSTITUCIÓN · responderConNotario, con las piezas inyectadas (jamás reimplementado) ─────
  const res = await responderConNotario({
    juzgar,
    lavar: stripLanguageLeaks,
    suplente: () => _respaldoDeLoYaAprobado(memIn, juzgar) || suplenteDignoDelDato({ scenario, juzgar }),
    pedir: async ({ intento, multa, anterior }) => {
      if (intento === 1) return callNatural({ mensajes, attempt: 0 });
      // el turno del asistente que se devuelve NUNCA puede ir vacío (el proveedor rechaza un content en blanco).
      const conMulta = mensajes.concat([
        { role: "assistant", content: esNarracionVacia(anterior) ? "(respuesta vacía)" : anterior },
        { role: "user", content: _MENSAJE_NOTARIO(multa) },
      ]);
      // `attempt` va con el número REAL de reintento (1 o 2): el ciclo concede un segundo solo si el veto cambió.
      return callNatural({ mensajes: conMulta, attempt: intento - 1, motivoReintento: _motivoDeMulta(multa) });
    },
  });

  // ── PANTALLA · [[CALCULO]] jamás visible, en NINGÚN estado (condición 1). extraerCalculos saca la marca Y el
  // contenido del bloque; stripAllMarks barre cualquier marca suelta que haya quedado. Si la limpieza dejara el
  // texto en nada (el cerebro escribió SOLO el bloque), aplica el MISMO piso absoluto del ciclo — nunca una
  // pantalla en blanco, nunca una segunda frase.
  const ex = extraerCalculos(res.texto);
  let textoPantalla = stripAllMarks(ex.limpio);
  let suplenteDigno = res.suplenteDigno;
  if (esNarracionVacia(textoPantalla)) { textoPantalla = composeNoDataMessage(null); suplenteDigno = true; }

  // ── MEMORIA · el texto LIMPIO a recentNarrations (misma ventana de 2 que el camino actual); la re-cita SOLO
  // se acumula si el muro aprobó (candado del owner: un texto vetado no presta sus cifras), sobre lo que el
  // usuario VIO (el limpio), con el cap de 24 del propio recitaAprobadaDe.
  const memOut = { ...memIn, recentNarrations: [textoPantalla, ...recentNarrationsPrev].slice(0, 2) };
  if (res.aprobado) {
    const recitaNueva = recitaAprobadaDe({ textoAprobado: textoPantalla, catalogoEntidades: duenos || [], previa: recita });
    if (recitaNueva) memOut.recitaAprobada = recitaNueva;
  }

  // ── LA RESPUESTA · route="natural" + el registro del turno para la telemetría existente (condición 5: se
  // EXPONEN los campos, no se construye telemetría nueva). estados excluyentes: verde/reparado/suplente/vacio.
  const r = normalizeResponse({
    text: textoPantalla,
    route: "natural",
    deterministic: !!suplenteDigno,
    claims: [],
    suggestions: null,
    sentrixAction: null,
    natural: {
      estado: res.estado,
      vetos: res.vetos,
      vacias: res.vacias,
      suplenteDigno,
      reparaciones: Math.max(0, res.calls - 1),
      calculosDeclarados: ex.calculos.length,
      // el owner pidió VER el alcance y la re-cita durante el examen (condición 5): se exponen los dos, que ya
      // se calculan arriba y viajan al notario. Solo observación — nada de esto decide nada.
      alcanceHeredado: heredado ? { eje: heredado.eje, entities: heredado.entities } : null,
      recitaCifras: (recita && Array.isArray(recita.figs)) ? recita.figs.length : 0,
    },
  });
  return { r, mem: memOut };
}
