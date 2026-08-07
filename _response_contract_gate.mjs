/* === _response_contract_gate.mjs · CONTRATO v2 · FASE 4 (owner 2026-08-07) ===========================
 * [1] FORMA ÚNICA: las 8 claves del contrato siempre presentes, en TODA respuesta del oráculo (final, bypass
 *     compuesto, bypass de criterio) — `null` explícito, nunca `undefined`.
 * [2] COERCIONES REALES: suggestions solo string[]|null (nunca [] ni objetos rotos) · sentrixAction con label y
 *     payload.clientes/skus SIEMPRE arrays (el crash latente de _threadContext).
 * [3] CLAIMS EN LA SALIDA: la boleta tipada viaja con la respuesta, con estatus epistémico.
 * [4] ESTATUS EPISTÉMICO DETERMINÍSTICO (el pendiente obligatorio): una cifra `indicado` citada en la narración
 *     NUNCA sale sin declarar que es una cuenta y de qué fórmula sale. Sin heurística de texto: dispara por el fig.
 * [5] MEMORIA CANÓNICA + VISTA DERIVADA: `memoria` se deriva de `conversationScope` y respeta el contrato que sus
 *     lectores esperan (oferta STRING, no el objeto canónico).
 * [6] NO REGRESIÓN: normalizeResponse no altera texto, ruta, evidencia ni telemetría.
 * Cero red, cero LLM. `node _response_contract_gate.mjs`
 */
import { runPlan } from "./src/adi/oracle/toolRunner.js";
import { buildClaims } from "./src/adi/oracle/narrationContract.js";
import { gradeIndicatedClaims } from "./src/adi/oracle/narratePromptC.js";
import {
  RESPONSE_KEYS, normalizeResponse, normalizeSuggestions, normalizeSentrixAction,
  assertResponseContract, deriveMemoriaLegacy, projectClaims,
} from "./src/adi/responseContract.js";
import { ADI_EPISTEMIC_NOTE_ENABLED } from "./src/config/voiceFlags.js";

let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };
const H = (t) => console.log("\n" + t);

H("[1] FORMA ÚNICA · las 8 claves, siempre");
{
  const casos = [
    ["oráculo completo", { text: "Falabella vendió $19.4M.", route: "oracle", evidence: { boleta: [] }, claims: [], suggestions: null, sentrixAction: null }],
    ["bypass compuesto", { text: "¿A qué te referís?", route: "oracle", evidence: {}, deterministic: true, claims: [], suggestions: null, sentrixAction: null }],
    ["legacy sin claims", { text: "x", route: "ranking", intent: "ranking", context: {}, suggestions: ["ver más"], sentrixAction: null }],
    ["P&L sin intent/context", { text: "x", route: "pnl_reading", evidence: {}, suggestions: null, sentrixAction: null }],
    ["conversación", { text: "x", route: "clarification_needed", evidence: {}, suggestions: null, sentrixAction: null }],
  ];
  for (const [nombre, raw] of casos) {
    const r = normalizeResponse(raw);
    const faltan = RESPONSE_KEYS.filter((k) => !(k in r));
    const undef = RESPONSE_KEYS.filter((k) => r[k] === undefined);
    ok(faltan.length === 0 && undef.length === 0, `${nombre}: las 8 claves presentes y ninguna \`undefined\``,
      faltan.length ? `faltan: ${faltan}` : undef.length ? `undefined: ${undef}` : "");
  }
  ok(assertResponseContract(normalizeResponse(casos[0][1])).length === 0, "assertResponseContract acepta una respuesta normalizada");
  ok(assertResponseContract({ text: "x" }).length > 0, "assertResponseContract RECHAZA una respuesta sin normalizar (el gate no es vacuo)");
  ok(normalizeResponse(null) === null, "normalizeResponse(null) → null (no explota)");
}

H("[2] COERCIONES · lo que hoy puede llegar mal tipado");
{
  ok(normalizeSuggestions([]) === null, "`[]` → null (el contrato exige null cuando no hay)");
  ok(normalizeSuggestions(null) === null, "null pasa igual");
  const objRoto = normalizeSuggestions([{ action: { type: "open" } }, "ver margen"]);
  ok(JSON.stringify(objRoto) === JSON.stringify(["ver margen"]),
    "una sugerencia `{action:{type}}` se DESCARTA (hoy pinta un botón vacío en la UI) y la buena sobrevive", JSON.stringify(objRoto));
  ok(JSON.stringify(normalizeSuggestions([{ text: "ver capital" }])) === JSON.stringify(["ver capital"]), "`{text}` se aplana al string que la UI y contractCloser interpolan");
  ok(normalizeSuggestions(["  ", ""]) === null, "sugerencias en blanco no cuentan");
  // sentrixAction
  ok(normalizeSentrixAction({ moduleChip: "Comercial", payload: {} }) === null, "sin `label` → null (la UI ya no lo puede pintar)");
  const a = normalizeSentrixAction({ label: "Ver Comercial", payload: { modulo: "comercial", mechanismBanner: "carga" } });
  ok(Array.isArray(a.payload.clientes) && Array.isArray(a.payload.skus),
    "clientes/skus SIEMPRE arrays aunque el productor los omita (_threadContext los indexa sin chequear)", JSON.stringify(a));
  ok(a.payload.mechanismBanner === "carga", "el resto del payload viaja intacto (no se amputa lo que un composer agregue)");
  const b = normalizeSentrixAction({ label: "X", payload: { clientes: ["Falabella", 42, ""] } });
  ok(JSON.stringify(b.payload.clientes) === JSON.stringify(["Falabella"]), "elementos no-string se filtran de clientes/skus");
}

H("[3] CLAIMS EN LA SALIDA · la boleta tipada viaja con la respuesta");
{
  const PLAN = { intent: "answer", mode: "diagnostico", calls: [{ tool: "marginRead", args: { dimension: "cliente", focus: "bajo_benchmark" } }] };
  const { results, ledger } = runPlan(PLAN, { scenario: "actual" });
  const claims = buildClaims(ledger.figs, { eje: "cliente", periodo: "año cerrado" });
  const r = normalizeResponse({ text: "x", route: "oracle", claims, evidence: {}, suggestions: null, sentrixAction: null });
  ok(Array.isArray(r.claims) && r.claims.length > 0, `claims presentes en la salida — ${r.claims.length}`);
  ok(r.claims.every((c) => c.estatus === "probado" || c.estatus === "indicado"), "todo claim de salida lleva estatus epistémico");
  ok(r.claims.some((c) => c.estatus === "indicado" && c.formula), "los derivados salen con su fórmula auditable al lado");
  ok(Object.keys(r.claims[0]).length === 7, `la proyección es COMPACTA (7 campos, no el claim entero de 15) — ${Object.keys(r.claims[0]).join(",")}`);
  ok(projectClaims([]) === null && projectClaims(null) === null, "sin claims → null, no `[]`");
}

H("[4] ESTATUS EPISTÉMICO · el SELLO es estructural, la PRESENTACIÓN va detrás de flag apagado");
{
  // Lo que el owner separó (2026-08-07): el estatus queda sellado SIEMPRE; el pie visible NO sale a producción con
  // la forma de nota técnica. Estos 4 asserts certifican esa separación — son la parte que rige HOY.
  ok(ADI_EPISTEMIC_NOTE_ENABLED === false, `ADI_EPISTEMIC_NOTE_ENABLED === false por default — vale ${ADI_EPISTEMIC_NOTE_ENABLED}`);
  const P0 = { intent: "answer", mode: "diagnostico", calls: [{ tool: "marginRead", args: { dimension: "cliente", focus: "bajo_benchmark" } }] };
  const { ledger: L0 } = runPlan(P0, { scenario: "actual" });
  const C0 = buildClaims(L0.figs, { eje: "cliente", periodo: "año cerrado" });
  const ind0 = C0.find((c) => c.estatus === "indicado");
  const txt0 = `Falabella te está costando ${ind0.valor} este año.`;
  ok(gradeIndicatedClaims(txt0, C0, "full") === txt0, "con el flag APAGADO la respuesta sale SIN pie visible (byte-idéntica)");
  ok(C0.some((c) => c.estatus === "indicado" && c.formula), "…y el SELLO sigue: los claims derivados conservan estatus `indicado` + fórmula");
  ok(projectClaims(C0).some((c) => c.estatus === "indicado"), "…y el estatus viaja hasta la SALIDA (r.claims), que es donde Sentrix puede leer la fórmula");
}

// El resto de este bloque certifica el COMPORTAMIENTO CUANDO SE ACTIVE (4º parámetro explícito, sin tocar el flag).
// La forma del pie es PROVISIONAL — el owner pidió graduación en la oración ("valor estimado en juego"), no una nota
// técnica. Se mantiene la cobertura para que el mecanismo no se pudra mientras espera su forma definitiva.
H("[4b] ESTATUS EPISTÉMICO · mecanismo (forzado ON) — la forma del pie es PROVISIONAL, ver voiceFlags.js");
{
  const PLAN = { intent: "answer", mode: "diagnostico", calls: [{ tool: "marginRead", args: { dimension: "cliente", focus: "bajo_benchmark" } }] };
  const { ledger } = runPlan(PLAN, { scenario: "actual" });
  const claims = buildClaims(ledger.figs, { eje: "cliente", periodo: "año cerrado" });
  const ind = claims.filter((c) => c.estatus === "indicado");
  ok(ind.length > 0, `el escenario real produce cifras \`indicado\` — ${ind.length}: ${ind.map((c) => `${c.etiqueta} ${c.valor}`).join(" · ")}`);

  const derivada = ind[0];
  // el caso peligroso EXACTO: la cifra derivada narrada como plata ya perdida.
  const crudo = `Falabella te está costando ${derivada.valor} este año. Revisá sus condiciones comerciales.`;
  const grad = gradeIndicatedClaims(crudo, claims, "full", true);
  ok(grad !== crudo, "una cifra `indicado` citada como hecho NO sale igual que entró");
  ok(grad.includes("es una cuenta sobre el dato"), "la salida declara que es una CUENTA, no una medición");
  ok(derivada.formula ? grad.includes(derivada.formula) : true, `declara la fórmula auditable — "${derivada.formula}"`);
  ok(grad.startsWith(crudo.trim()), "el texto del narrador queda PRIMERO e intacto (se suma, nunca se reescribe)");

  // LA NOTA NUNCA ENTIERRA LA PREGUNTA DE CIERRE (defecto cazado por _oracle_multimodo_gate en la suite completa):
  // el contrato CLARIFY exige cerrar con "?" y bajo `full` el último párrafo suele ser la oferta de siguiente paso.
  const conPregunta = `Falabella te está costando ${derivada.valor} este año.\n\n¿Querés que revisemos sus condiciones comerciales?`;
  const gp = gradeIndicatedClaims(conPregunta, claims, "full", true);
  ok(/\?\s*$/.test(gp.trim()), "si el último párrafo es una pregunta, el texto SIGUE terminando en '?' (clarify y la oferta de cierre intactas)", JSON.stringify(gp));
  ok(gp.includes("es una cuenta sobre el dato"), "y la nota igual está presente, insertada ANTES de la pregunta");
  ok(gp.indexOf("Cómo se calcula") < gp.indexOf("¿Querés"), "el orden es: lectura → nota de método → pregunta de cierre");

  // no dispara donde no corresponde
  const probada = claims.find((c) => c.estatus === "probado" && c.valor);
  const soloProbada = `Falabella vendió ${probada.valor} este año.`;
  ok(gradeIndicatedClaims(soloProbada, claims, "full", true) === soloProbada, "una cifra `probado` NO se gradúa (no ensucia la respuesta normal)");
  const sinCitar = "Falabella está por debajo del benchmark. Revisá sus condiciones.";
  ok(gradeIndicatedClaims(sinCitar, claims, "full", true) === sinCitar, "si la cifra derivada NO se citó, no hay nota que agregar");
  ok(gradeIndicatedClaims(crudo, claims, "data_only", true) === crudo, "bajo data_only NO se agrega prosa (contrato estricto de bloques respetado)");
  ok(gradeIndicatedClaims(crudo, claims, "action_only", true) === crudo, "bajo action_only tampoco");
  ok(gradeIndicatedClaims("", claims, "full", true) === "" && gradeIndicatedClaims(crudo, [], "full", true) === crudo, "sin texto o sin claims: no-op, no explota");

  // el disparador es el FIG, no el texto: dos redacciones distintas de lo mismo se gradúan las dos.
  const otra = `El valor en juego con Falabella asciende a ${derivada.valor}.`;
  ok(gradeIndicatedClaims(otra, claims, "full", true).includes("es una cuenta sobre el dato"),
    "otra redacción de la MISMA cifra también se gradúa (el disparador es el estatus del fig, no la frase)");
  // y no se duplica la nota si la cifra aparece dos veces
  const dosVeces = `${crudo} Insisto: ${derivada.valor}.`;
  const g2 = gradeIndicatedClaims(dosVeces, claims, "full", true);
  ok((g2.match(/es una cuenta sobre el dato/g) || []).length === ind.filter((c) => dosVeces.includes(c.valor)).length,
    "la nota no se duplica cuando la cifra se repite en el texto");
}

H("[5] MEMORIA CANÓNICA · la vista legacy se DERIVA del canónico");
{
  const scope = { version: 1, current: {
    turno: 3, dimension: "cliente", entities: ["Falabella"], metrica: "margen",
    ofertaPendiente: { texto: "¿Querés que simule bajar el rebate un punto?", entidad: "Falabella", dimension: "cliente", tool: "simulate" },
  } };
  const m = deriveMemoriaLegacy(scope, { prev: null, route: "oracle", suggestions: null });
  ok(m && m.entidad && m.entidad.nombre === "Falabella" && m.entidad.eje === "cliente", `entidad derivada — ${JSON.stringify(m.entidad)}`);
  ok(m.tema && m.tema.metrica === "margen" && m.tema.dimension === "cliente", `tema derivado — ${JSON.stringify(m.tema)}`);
  ok(typeof m.oferta === "string" && m.oferta.startsWith("¿Querés"),
    "la oferta se APLANA a string (el canónico guarda objeto; buildConversationContext lo interpola en el prompt)", JSON.stringify(m.oferta));
  ok(m.ruta === "oracle", "la ruta del turno viaja en la vista (el 'sí' repetido usa la escalada por ruta)");
  ok(deriveMemoriaLegacy(null) === null && deriveMemoriaLegacy({ version: 1 }) === null,
    "sin canónico → null, y el caller cae a updateMemoria (las rutas legacy no cambian)");
  // herencia: un turno sin entidad no borra la anterior
  const m2 = deriveMemoriaLegacy({ version: 1, current: { turno: 4, entities: [], dimension: null } }, { prev: m, route: "oracle" });
  ok(m2.entidad && m2.entidad.nombre === "Falabella", "un turno sin entidad HEREDA la anterior (mismo criterio que updateMemoria)");
  const m3 = deriveMemoriaLegacy(scope, { route: "oracle", suggestions: ["revisar rebates", "ver capital"] });
  ok(m3.proximaAccion === "revisar rebates" && m3.sugerencias.length === 2, "sugerencias/proximaAccion mantienen la promesa gate-proven (la 1ª ES la próxima acción)");
}

H("[6] NO REGRESIÓN · normalizar no toca contenido ni telemetría");
{
  const raw = { text: "Falabella vendió $19.4M.", route: "oracle", evidence: { boleta: [1], oracle: true },
    deterministic: true, narrationRepaired: true, retryTrace: { plan: [], narrate: [{ attempt: 0 }] },
    requestContext: { tenantId: "demo" }, claims: [], suggestions: null, sentrixAction: null };
  const r = normalizeResponse(raw);
  ok(r.text === raw.text, "el texto sale verbatim");
  ok(r.route === "oracle" && r.intent === "oracle", "route intacta · intent cae a route (lo que legacy ya hacía)");
  ok(JSON.stringify(r.evidence) === JSON.stringify(raw.evidence), "la evidencia sale intacta");
  ok(r.deterministic === true && r.narrationRepaired === true, "las marcas de telemetría sobreviven");
  ok(JSON.stringify(r.retryTrace) === JSON.stringify(raw.retryTrace) && r.requestContext.tenantId === "demo", "retryTrace y requestContext sobreviven");
  ok(normalizeResponse(r).text === r.text && assertResponseContract(normalizeResponse(r)).length === 0, "normalizar dos veces es idempotente");
}

console.log(`\n── _response_contract_gate: ${PASS} PASS · ${FAIL} FAIL (de ${PASS + FAIL}) ──`);
process.exit(FAIL ? 1 : 0);
