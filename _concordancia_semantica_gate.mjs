/* === _concordancia_semantica_gate.mjs · CONCORDANCIA ADI↔SENTRIX · SEMÁNTICA Y CONTINUIDAD (owner 2026-08-09) ===
 *
 * Los otros dos gates del frente certifican la ESTRUCTURA (_view_context_gate: manifiesto, sellado, direcciones,
 * candado O(1)) y la FORMA declarada (_forma_respuesta_gate: precedencia de resolveAnswerShape, cero duplicación
 * con la preferencia de respuesta). Este certifica lo que queda, que es lo que el owner pidió con palabras suyas:
 * que el chat ENTIENDA lo que la pantalla está mostrando, y que dejar de mostrarlo NO contamine el turno siguiente.
 *
 *   [1] DEIXIS DE COMPONENTE   "este gráfico", "ese punto", "los de arriba", "acá", "esto" a secas → la pieza que
 *                              el usuario tiene delante. Sin pantalla declarada NO resuelve nada (no inventa).
 *   [2] DEIXIS DE ENTIDAD      "estos clientes" / "esos SKU" → la selección viva. Con 300 filas no hay lista que
 *                              referenciar: resuelve como FILTRO. Nunca cruza de eje, nunca gana en silencio.
 *   [3] NOMBRES MAL ESCRITOS   "falabela"/"Sodimak" → la entidad correcta, con la canonicalización que YA existe
 *                              (entityIndex). Lo que no existe se declara desconocido en vez de inventarse.
 *   [4] NO CONTAMINACIÓN       cambiar de vista, de filtro, de entidad o de tema descarta el contexto ENTERO —
 *                              verificado hasta el PAYLOAD: la vista anterior no deja rastro en lo que lee el LLM.
 *   [5] «SOLO EL DATO»         los equivalentes semánticos se detectan con la red determinística REAL del motor
 *                              (extraída del archivo, no reescrita acá), y la respuesta compuesta tiene dato +
 *                              período + alcance y NINGUNA interpretación.
 *   [6] PROPORCIONALIDAD       una pregunta puntual no se convierte en informe — ni siquiera con Sentrix abierto.
 *   [7] EXPLICAR ESTE GRÁFICO  los cinco movimientos, medidos en el payload REAL de la segunda pasada, alimentados
 *                              desde el ViewContext derivado del builder vivo (no de un contexto de laboratorio).
 *   [8] ESCALA                 300 clientes y 5000 SKU seleccionados. Se miden BYTES REALES de los dos prompts.
 *                              El costo por entidad tiene que ser CERO, no "poco".
 *
 * El gate no habla con ningún proveedor ni sale de la máquina: importa módulos puros del motor, corre las tools
 * client-side y mide strings. Se corre con `npm run gates:offline`, sin consumo de crédito.
 * ⚠️ NO ESCRIBAS EN ESTE ARCHIVO —NI EN UN COMENTARIO— NINGUNO DE LOS PATRONES QUE scripts/gates-offline.mjs usa
 * para clasificar un gate como "de red": ese script lee el ARCHIVO ENTERO, comentarios incluidos, y bastaría
 * nombrarlos para que este gate quede fuera de la suite determinística.
 *
 *   node _concordancia_semantica_gate.mjs
 */
import { readFileSync } from "node:fs";

import {
  resolveComponentReference, resolveConversationReference, resolveOrdinalReference,
  emptyConversationScope, DEICTIC_PLURAL_RE,
} from "./src/adi/oracle/conversationScope.js";
import {
  sealViewContext, validateViewContext, invalidateViewContext, viewContextEntry, viewContextChanged,
  projectViewContextForPlan, projectViewContextForCoercion,
  VIEW_SELECTION_MAX, VIEW_PLAN_LINE_MAX, VIEW_CONTEXT_TTL_ENTRADAS,
} from "./src/adi/oracle/viewContext.js";
import {
  resolveAnswerShape, buildAnswerShapeInstruction, buildAlcanceLine,
  DEICTIC_COMPONENT_RE, esPreguntaPuntual,
} from "./src/adi/oracle/progressiveDisclosure.js";
import { buildNarrateUserMessageC } from "./src/adi/oracle/narratePromptC.js";
import { buildNarrationContract, sealScopeContract, isSealed } from "./src/adi/oracle/narrationContract.js";
import { buildPlanUserMessage } from "./src/adi/oracle/planPrompt.js";
import { runPlan } from "./src/adi/oracle/toolRunner.js";
import { composeFromLedger } from "./src/adi/oracle/narrationBlocks.js";
import { guardC, periodosEsperados, ensurePeriodoDeclared } from "./src/adi/oracle/guardC.js";
import { resolveEntityRef } from "./src/adi/oracle/entityIndex.js";
import { guessDimension } from "./src/adi/oracle/entityRecord.js";
import { deriveViewContextOrErrors } from "./src/adi/sentrix/viewContextFrom.js";
import { buildResumenComercial } from "./src/adi/sentrix/resumenComercial.js";
import { buildMesaCapital } from "./src/adi/sentrix/mesaCapital.js";
import { getTenantId } from "./src/data/tenantStore.js";

let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };
const H = (t) => console.log("\n" + t);

const SCN = "bonanza";
const RC = { tenantId: getTenantId() };
const HIST = [{ role: "user", text: "¿cómo viene el negocio?" }, { role: "assistant", text: "La venta cerró el año en línea con el presupuesto." }];

// ── contextos base ────────────────────────────────────────────────────────────────────────────────────────────
// Uno DERIVADO del builder vivo (el camino real: mejora B) y otros ARMADOS a mano para poder mover una sola
// variable por vez — que es lo que exige probar la invalidación sin ambigüedad.
const COM = buildResumenComercial(SCN);
const CAP = buildMesaCapital(SCN);
const derivar = (id, out, opts = {}) => deriveViewContextOrErrors(id, out, { scenario: SCN, requestContext: RC, ...opts });

const BASE = {
  tenantId: RC.tenantId, vista: "comercial", seccion: "01", componentId: "comercial/01/tabla-cartera", tipo: "tabla",
  metrica: "ventas", eje: "cliente", periodo: "año cerrado", escenario: SCN,
  universo: { kind: "negocio", n: 13, label: "la cartera completa", cierraCon: "clientesVentas.actual" },
  seleccion: { modo: "todas", n: 13, entidades: [], filtro: null },
  filtros: {}, comparacion: "presupuesto", controles: {}, evidenceIds: [], estatus: "indicado",
};
const vc = (patch) => sealViewContext({ ...BASE, ...patch });
const VC_TABLA = vc({});
const VC_SEL2 = vc({ seleccion: { modo: "explicita", n: 2, entidades: ["Falabella", "Sodimac"], filtro: null } });
const VC_SKU = vc({
  componentId: "comercial/01/sostiene-sku", metrica: "margen", eje: "sku",
  seleccion: { modo: "explicita", n: 2, entidades: ["SAM-TV55", "LG-WASH11KG"], filtro: null },
});
const VC_CAPITAL = vc({
  vista: "capital", componentId: "capital/01/barras", tipo: "barra", metrica: "capital", eje: "sku",
  comparacion: null, universo: { kind: "negocio", n: 2, label: "el capital por SKU", cierraCon: "las barras suman el total" },
  seleccion: { modo: "todas", n: 2, entidades: [], filtro: null },
});
const PLAN_ABIERTO = { mode: "default", intent: "answer", scope: { level: "entity", entities: [] }, calls: [] };

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════
H("[1] DEIXIS DE COMPONENTE · la pregunta apunta a lo que está en pantalla");
{
  ok(!!VC_TABLA && !!VC_SEL2 && !!VC_SKU && !!VC_CAPITAL, "los contextos de prueba sellan");

  // Las formas que el owner enumeró, tal como se escriben.
  const FRASES = [
    "explicame este gráfico", "¿qué significa ese punto?", "explicame esta tabla", "qué mide este KPI",
    "los de arriba", "acá qué está pasando", "explicame lo que estoy viendo", "qué significa esa barra",
    "explicame esto", "¿por qué pasó esto?", "¿y esto?",
  ];
  const mudas = FRASES.filter((f) => resolveComponentReference(f, VC_TABLA).kind !== "resolved");
  ok(!mudas.length, "toda deixis de componente encuentra la pieza que el usuario tiene delante", mudas.map((x) => `«${x}»`).join(" · "));

  const r = resolveComponentReference("explicame este gráfico", VC_TABLA);
  ok(r.componentId === "comercial/01/tabla-cartera", "resuelve al componentId exacto, no a la cara entera");
  const c = r.componente || {};
  ok(c.metrica === "ventas" && c.eje === "cliente", "y trae QUÉ mide y en qué eje");
  ok(!!c.periodo && !!c.universo && !!c.estatus, "más su período, su universo y su sello — las tres cosas que hacen falta para explicarlo");
  // El contexto LOCALIZA, no cotiza: si trajera cifras, el narrador tendría una segunda fuente numérica.
  const dinero = /\$\s?-?\d|\d+([.,]\d+)?\s*%/.test(JSON.stringify(r));
  ok(!dinero, "la referencia resuelta NO trae ninguna cifra: dice qué se mira, nunca cuánto vale");

  ok(resolveComponentReference("explicame este gráfico", null).kind === "none", "sin pantalla declarada NO resuelve nada (un deíctico al aire sigue siendo irresoluble)");
  ok(resolveComponentReference("¿cuánto vendió Falabella?", VC_TABLA).kind === "none", "una pregunta sin deixis no se apropia del componente");

  // Cambiar de pieza cambia el referente: el deíctico apunta a lo VIGENTE, nunca a lo anterior.
  const rCap = resolveComponentReference("explicame este gráfico", VC_CAPITAL);
  ok(rCap.componentId === "capital/01/barras" && rCap.componente.metrica === "capital",
    "con otra pieza en pantalla, el MISMO texto resuelve a la pieza nueva");
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════
H("[2] DEIXIS DE ENTIDAD · «estos clientes», «esos SKU», y el caso de 300 filas");
{
  const rCli = resolveConversationReference("¿cuáles de estos clientes están bajo su presupuesto?", PLAN_ABIERTO, emptyConversationScope(), RC, null, VC_SEL2);
  ok(rCli.kind === "resolved" && rCli.dimension === "cliente" && rCli.entities.join("|") === "Falabella|Sodimac",
    "«cuáles de estos clientes» resuelve contra la selección viva de la vista", JSON.stringify(rCli));

  const rSku = resolveConversationReference("¿qué hago con esos SKU?", PLAN_ABIERTO, emptyConversationScope(), RC, null, VC_SKU);
  ok(rSku.kind === "resolved" && rSku.dimension === "sku" && rSku.entities.length === 2,
    "«esos SKU» resuelve contra la selección de SKU", JSON.stringify(rSku));

  // El eje del texto ACOTA: pedir SKU con clientes en pantalla es un rechazo explícito, nunca una respuesta sobre
  // clientes disfrazada de respuesta sobre SKU.
  const cruzado = resolveConversationReference("¿qué hago con esos SKU?", PLAN_ABIERTO, emptyConversationScope(), RC, null, VC_SEL2);
  ok(cruzado.kind === "decline", "pedir SKU con una selección de CLIENTES en pantalla se rechaza — jamás se cruza de eje", JSON.stringify(cruzado));

  // La pantalla es UN candidato más, nunca autoridad: si el hilo dice otra cosa, se pregunta.
  const scopeOtro = { ...emptyConversationScope(), current: { dimension: "cliente", entities: ["Jumbo", "Lider"], metric: "ventas", turno: 1 } };
  const amb = resolveConversationReference("comparalos", PLAN_ABIERTO, scopeOtro, RC, null, VC_SEL2);
  ok(amb.kind === "ambiguous" && amb.options.length === 2, "si el hilo y la pantalla apuntan a grupos distintos hay AMBIGÜEDAD: se pregunta, no gana la pantalla en silencio", JSON.stringify(amb.kind));

  // Coinciden → no se pregunta de más.
  const scopeIgual = { ...emptyConversationScope(), current: { dimension: "cliente", entities: ["Falabella", "Sodimac"], metric: "ventas", turno: 1 } };
  const coinc = resolveConversationReference("comparalos", PLAN_ABIERTO, scopeIgual, RC, null, VC_SEL2);
  ok(coinc.kind === "resolved", "si coinciden no inventa una ambigüedad que el usuario no percibe");

  // 300 filas: el referente EXISTE, pero es un criterio. Este es el camino O(1) completo.
  const VC_300 = vc({ seleccion: { modo: "filtro", n: 300, entidades: [], filtro: { canal: "Retail" } } });
  const r300 = resolveConversationReference("¿cuáles de estos clientes están bajo su presupuesto?", PLAN_ABIERTO, emptyConversationScope(), RC, null, VC_300);
  ok(r300.kind === "resolved-scope" && r300.filtros && r300.filtros.canal === "Retail",
    "con 300 filas «estos clientes» resuelve como FILTRO — el referente es un criterio, no una lista", JSON.stringify(r300));
  ok(!Array.isArray(r300.entities), "y NO devuelve entidades: no hay ninguna lista de nombres que pudiera viajar");
  ok(r300.n === 300, "el tamaño viaja como conteo (para poder decirlo), no como contenido");

  // Ordinales sobre lo que se ve.
  const cur = { dimension: "cliente", entities: ["Falabella", "Sodimac", "Jumbo", "Lider"], metric: "ventas", turno: 1 };
  const dos = resolveOrdinalReference("los dos de arriba", cur);
  ok(dos && dos.entities.join("|") === "Falabella|Sodimac", "«los dos de arriba» recorta el orden ya sellado, sin re-derivar el ranking");
  const tres = resolveOrdinalReference("los tres primeros", cur);
  ok(tres && tres.entities.length === 3, "«los tres primeros» también");
  ok(resolveOrdinalReference("los dos peores", cur) === null,
    "«los dos peores» SIN orden sellado devuelve null: no se adivina la dirección del ranking");
  const peor = resolveOrdinalReference("los dos peores", { ...cur, selection: { orden: "descendente por ventas" } });
  ok(peor && peor.entities.join("|") === "Jumbo|Lider", "con el orden sellado, «los dos peores» sí recorta el extremo correcto");

  // Sin NADA a qué referirse, no se fabrica un grupo.
  const vacio = resolveConversationReference("comparalos", PLAN_ABIERTO, emptyConversationScope(), RC, null, null);
  ok(vacio.kind === "none", "sin selección, sin hilo y sin pantalla no se fabrica ningún grupo");
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════
H("[3] NOMBRES MAL ESCRITOS · la canonicalización que ya existe, no una segunda");
{
  const CASOS = [
    ["falabela", "Falabella", "cliente"], ["Falabela", "Falabella", "cliente"], ["Sodimak", "Sodimac", "cliente"],
    ["sodimac", "Sodimac", "cliente"], ["FALABELLA", "Falabella", "cliente"], ["Valparaiso", "Valparaíso", "bodega"],
    ["samsun", "Samsung", "marca"], ["SAM-TV-55", "SAM-TV55", "sku"],
  ];
  const fallan = [];
  for (const [escrito, canon, dim] of CASOS) {
    const r = resolveEntityRef(escrito);
    const acierta = (r.estado === "resuelto" && r.nombre === canon)
      || (r.estado === "sugerencia" && (r.candidatos || []).some((c) => c.nombre === canon));
    if (!acierta) fallan.push(`${escrito}→${JSON.stringify(r)}`);
  }
  ok(!fallan.length, `los ${CASOS.length} nombres mal escritos llegan a su entidad canónica`, fallan.join("  |  "));

  const dim = resolveEntityRef("falabela", { dimension: "cliente" });
  ok(dim.estado === "sugerencia" && dim.candidatos[0].nombre === "Falabella" && dim.candidatos[0].distancia <= 2,
    "con el eje ya decidido, el candidato viene del eje correcto y con su distancia (nunca un nombre a secas)");

  const inventado = resolveEntityRef("Zyxwvut Corporación");
  ok(inventado.estado === "desconocido", "lo que no existe se declara desconocido — nunca se completa con el parecido más cercano");

  // Un nombre corrido NO puede entrar al contexto como si fuera una entidad real: la revalidación del pool lo tira.
  const VC_MAL = vc({ seleccion: { modo: "explicita", n: 1, entidades: ["falabela"], filtro: null } });
  ok(!!VC_MAL, "un contexto con un nombre mal escrito igual sella (la UI no valida ortografía)");
  ok(guessDimension("falabela") === null, "…pero ese nombre no pertenece a ningún eje del tenant");
  const rMal = resolveConversationReference("¿cuáles de estos clientes?", PLAN_ABIERTO, emptyConversationScope(), RC, null, VC_MAL);
  ok(rMal.kind !== "resolved", "y la resolución NO lo acepta como entidad: se revalida contra el dato, nunca se confía en lo que vino de la UI", JSON.stringify(rMal));
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════
H("[4] NO CONTAMINACIÓN · cambiar de vista, de filtro, de entidad o de tema descarta el contexto ENTERO");
{
  const entry = viewContextEntry(VC_TABLA, 2);

  ok(viewContextChanged(VC_TABLA, VC_CAPITAL), "cambiar de VISTA cambia la huella del contexto");
  ok(viewContextChanged(VC_TABLA, vc({ filtros: { canal: "Retail" } })), "cambiar de FILTRO también");
  ok(viewContextChanged(VC_TABLA, VC_SEL2), "cambiar la ENTIDAD seleccionada también");
  ok(viewContextChanged(VC_TABLA, vc({ escenario: "actual" })), "cambiar de ESCENARIO también");
  ok(viewContextChanged(VC_TABLA, vc({ controles: { todos: 1 } })), "y hasta un control declarado de la vista");

  // Lo que NO debe invalidar: repintar lo mismo. Un contexto que se invalida de más es tan malo como uno que
  // se arrastra: obliga al usuario a repetir lo que ya dijo.
  const repintado = vc({ evidenceIds: ["Falabella · Ventas", "Sodimac · Ventas"], universo: { ...BASE.universo, n: 11 } });
  ok(!viewContextChanged(VC_TABLA, repintado), "repintar la MISMA pantalla con el mismo dato NO invalida nada");

  ok(invalidateViewContext(entry, null, { plan: { scope: { level: "global" } }, requestContext: RC, turno: 3 }) === null,
    "CAMBIO DE TEMA (el mismo disparador que ya usa el alcance conversacional) descarta el contexto");
  const fresco = invalidateViewContext(entry, VC_CAPITAL, { plan: PLAN_ABIERTO, requestContext: RC, turno: 3 });
  ok(fresco && fresco.componentId === "capital/01/barras", "con pantalla nueva manda la nueva, entera");
  ok(fresco && fresco.metrica === "capital" && fresco.eje === "sku",
    "y no queda ni un campo de la anterior: es un reemplazo, jamás una mezcla de dos pantallas");

  const sobrevive = invalidateViewContext(entry, null, { plan: PLAN_ABIERTO, requestContext: RC, turno: 2 + VIEW_CONTEXT_TTL_ENTRADAS });
  ok(sobrevive && sobrevive.componentId === "comercial/01/tabla-cartera", "con el panel cerrado el contexto sobrevive su ventana declarada");
  ok(invalidateViewContext(entry, null, { plan: PLAN_ABIERTO, requestContext: RC, turno: 3 + VIEW_CONTEXT_TTL_ENTRADAS }) === null,
    "…y vencida esa ventana se descarta: el contexto no envejece indefinidamente");

  const ajeno = sealViewContext({ ...BASE, tenantId: "otra-empresa-sa" });
  ok(invalidateViewContext(entry, ajeno, { plan: PLAN_ABIERTO, requestContext: RC, turno: 3 }) === null, "un contexto de OTRA empresa no entra");
  ok(resolveConversationReference("comparalos", PLAN_ABIERTO, emptyConversationScope(), RC, null,
    sealViewContext({ ...BASE, tenantId: "otra-empresa-sa", seleccion: { modo: "explicita", n: 2, entidades: ["Falabella", "Sodimac"], filtro: null } })).kind !== "resolved",
    "y tampoco se usa para resolver referencias: nunca se cruza dato entre empresas");

  // LA PRUEBA QUE IMPORTA: la contaminación se mide en lo que el LLM LEE, no en el objeto.
  const P = { mode: "default", intent: "answer", scope: { level: "entity", entities: ["Falabella"] }, calls: [{ tool: "marginRead", args: { focus: "bajo_benchmark" } }] };
  const { results, ledger } = runPlan(P, { scenario: SCN });
  const payload = (v) => buildNarrateUserMessageC({
    text: "explicame esta tabla", plan: P, results, ledgerFigs: ledger.figs, mem: {}, history: HIST,
    pref: null, scenario: SCN, requestContext: RC, viewContext: v, formaRespuesta: v ? "explicar_componente" : null,
  });
  const pA = payload(VC_TABLA), pB = payload(VC_CAPITAL);
  const sA = JSON.stringify(pA), sB = JSON.stringify(pB);
  ok(!!pA.contexto_vista && !!pB.contexto_vista, "el payload declara qué pantalla se está mirando");
  ok(pA.contexto_vista !== pB.contexto_vista, "y al cambiar de vista la línea cambia");
  ok(/Comercial/.test(pA.contexto_vista) && /Capital/.test(pB.contexto_vista), "cada una nombra SU cara");
  ok(!/Comercial ›/.test(sB) && !/tabla-cartera/.test(sB),
    "el payload de la vista nueva no menciona la vista anterior en NINGUNA parte — la contaminación se cierra en el prompt, no solo en el objeto");
  ok(!/capital/i.test(pA.contexto_vista), "ni al revés");
  const pSin = payload(null);
  ok(!("contexto_vista" in pSin), "cerrado Sentrix, la llave ni aparece: un turno que no viene de la pantalla no paga ni un byte de contexto");
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════
H("[5] «SOLO EL DATO» · dato + período + alcance, y nada más");
{
  // La detección de los equivalentes semánticos vive en la red determinística del motor. Se EXTRAE de ahí para
  // probar la de producción: reescribirla acá sería certificar una copia, que es justo lo que puede divergir.
  const src = readFileSync(new URL("./src/adi/oracle/answerViaOracle.js", import.meta.url), "utf8");
  const linea = (src.split("\n").find((l) => l.trim().startsWith("const _PREF_DATA_ONLY_RE")) || "");
  let RED = null;
  try { RED = new Function(`return ${linea.slice(linea.indexOf("=") + 1).trim().replace(/;\s*$/, "")}`)(); } catch { RED = null; }
  ok(RED instanceof RegExp, "la red determinística de «solo el dato» se lee del motor (no se reescribe en el gate)");

  if (RED) {
    const EQUIVALENTES = [
      "dame solo el dato", "sólo el número", "solo la cifra", "dame únicamente el número", "quiero únicamente los datos",
      "sin análisis", "sin interpretación", "sin explicación", "directo al dato", "directo al número",
      "no me des contexto", "no me recomiendes nada", "dame el margen y punto.", "solo dame los kpis", "solo los resultados",
    ];
    const perdidos = EQUIVALENTES.filter((f) => !RED.test(f));
    ok(!perdidos.length, `los ${EQUIVALENTES.length} equivalentes semánticos de «solo el dato» se reconocen`, perdidos.map((x) => `«${x}»`).join(" · "));

    const NORMALES = ["¿cuánto vendió Falabella?", "explicame este gráfico", "¿por qué cayó el margen?", "dame el detalle del año"];
    const falsos = NORMALES.filter((f) => RED.test(f));
    ok(!falsos.length, "y ninguna pregunta normal se confunde con un pedido de dato pelado", falsos.map((x) => `«${x}»`).join(" · "));
  }

  for (const alcance of ["data_only", "results_only"]) {
    const shape = resolveAnswerShape({ text: "explicame este gráfico", plan: PLAN_ABIERTO, viewContext: VC_TABLA, pref: { contentScope: alcance } });
    ok(shape === "solo_dato", `${alcance} → solo_dato aunque el turno diga «explicame este gráfico» y haya pantalla abierta`);
  }
  ok(buildAnswerShapeInstruction("solo_dato", { viewContext: VC_TABLA }) === "",
    "y NO se compone ninguna instrucción extra: el alcance ya tiene su enforcement, duplicarlo sería una segunda verdad");

  // La respuesta REAL, compuesta por las mismas piezas que usa el motor en esa rama.
  const P = { mode: "default", intent: "answer", scope: { level: "entity", entities: ["Falabella"] }, calls: [{ tool: "entityRecord", args: { entity: "Falabella", field: "venta" } }] };
  const { results, ledger } = runPlan(P, { scenario: SCN });
  const pref = { contentScope: "data_only", detailLevel: "standard" };
  const dato = composeFromLedger(ledger.figs, "data_only");
  const alcanceLinea = buildAlcanceLine(sealScopeContract({ plan: P, results, scenario: SCN, requestContext: RC, pref }));
  const respuesta = ensurePeriodoDeclared(`${dato}\n\n${alcanceLinea}`, periodosEsperados(results));

  ok(!!dato && /Falabella/.test(dato) && /\$/.test(dato), "1/3 · EL DATO: la boleta compone las cifras autorizadas");
  ok(/año cerrado|a la fecha de hoy|hoy/i.test(respuesta), "2/3 · EL PERÍODO: queda declarado en el texto");
  ok(/^Alcance:/m.test(respuesta) && /Falabella/.test(alcanceLinea), "3/3 · EL ALCANCE: sobre qué universo está medido");
  ok(!/\d/.test(alcanceLinea), "el alcance no introduce ninguna cifra que el guard deba autorizar");

  // «NADA MÁS» — la parte que un texto puede incumplir sin que ninguna etiqueta lo note.
  const INTERPRETACION = /\bte\s+recomiendo\b|\bconviene\b|\bdeber[ií]as?\b|\bsugiero\b|\bhay\s+que\b|\bpor\s+eso\b|\bse\s+explica\s+por\b|\bpriori[zc]\w*\b|\brevis[aá]\b/i;
  ok(!INTERPRETACION.test(respuesta), "NADA MÁS: cero recomendación, cero causa, cero acción en la respuesta compuesta");
  const g = guardC(respuesta, { ledger, results, trace: [], question: "dame solo el dato de Falabella" });
  ok(g.ok, "y la respuesta pasa el candado numérico sin reparación", JSON.stringify(g).slice(0, 220));
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════
H("[6] PROPORCIONALIDAD · una pregunta puntual no se convierte en informe");
{
  const puntual = { mode: "default", intent: "answer", scope: { level: "entity", entities: ["Falabella"] }, calls: [{ tool: "entityRecord", args: { entity: "Falabella", field: "venta" } }] };
  const causa = { mode: "default", intent: "answer", scope: { level: "entity", entities: ["Falabella"] }, calls: [{ tool: "marginRead", args: { focus: "bajo_benchmark" } }] };

  ok(esPreguntaPuntual({ text: "¿cuánto vendió Falabella?", plan: puntual }), "«¿cuánto vendió X?» es puntual");
  ok(esPreguntaPuntual({ text: "dame el margen de Falabella", plan: puntual }), "un pedido directo de dato también");
  ok(!esPreguntaPuntual({ text: "¿por qué cayó el margen de Falabella?", plan: causa }), "«por qué» NUNCA es puntual: es el turno que más necesita el arco");
  ok(!esPreguntaPuntual({ text: "¿qué hago con Falabella?", plan: causa }), "pedir acción tampoco");
  ok(!esPreguntaPuntual({ text: "dame el mes a mes de Falabella", plan: puntual }), "pedir la serie es pedir DETALLE, no una pregunta puntual");

  // LA PRUEBA CON SENTRIX ABIERTO: tener la pantalla declarada no puede inflar todas las respuestas.
  const shapePuntual = resolveAnswerShape({ text: "¿cuánto vendió Falabella?", plan: puntual, viewContext: VC_TABLA, pref: null });
  ok(shapePuntual === "puntual", "con Sentrix abierto, una pregunta puntual SIGUE siendo puntual — la pantalla no convierte todo en informe");
  const shapeExplica = resolveAnswerShape({ text: "explicame esta tabla", plan: puntual, viewContext: VC_TABLA, pref: null });
  ok(shapeExplica === "explicar_componente", "y pedir explicación del componente sí abre el arco de explicación");

  const instr = buildAnswerShapeInstruction("puntual", { viewContext: VC_TABLA, claims: [] });
  ok(/PRIMERA oraci[oó]n/i.test(instr), "la instrucción puntual ordena responder PRIMERO y después interpretar");
  ok(/PROHIBIDO/i.test(instr) && /plan\s+de\s+acci[oó]n/i.test(instr), "y prohíbe explícitamente desplegar el arco completo");
  ok(!/QU[EÉ] MIDE/i.test(instr) && !/CU[AÁ]L ES SU UNIVERSO/i.test(instr),
    "una pregunta puntual NO recibe los cinco movimientos de explicación: cada forma pide lo suyo y nada más");

  // Medido en el payload: el turno puntual no arrastra la maquinaria del informe.
  const { results, ledger } = runPlan(puntual, { scenario: SCN });
  const mk = (forma) => buildNarrateUserMessageC({
    text: "¿cuánto vendió Falabella?", plan: puntual, results, ledgerFigs: ledger.figs, mem: {}, history: HIST,
    pref: null, scenario: SCN, requestContext: RC, viewContext: VC_TABLA, formaRespuesta: forma,
  });
  const bytesPuntual = JSON.stringify(mk("puntual")).length;
  const bytesExplica = JSON.stringify(mk("explicar_componente")).length;
  ok(bytesPuntual < bytesExplica, `la instrucción puntual pesa MENOS que la de explicación (${bytesPuntual} < ${bytesExplica} bytes): la proporcionalidad se paga en tokens, no solo en prosa`);
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════
H("[7] «EXPLICAME ESTE GRÁFICO» · los cinco movimientos, sobre un contexto derivado del builder vivo");
{
  const d = derivar("comercial/01/evolutivo-serie", COM, { controles: { oculta: 0 } });
  ok(d.ok, "el contexto del evolutivo se DERIVA de la salida del builder (no se escribe a mano)", (d.errors || []).join(" · "));
  const VCS = d.ok ? d.vc : VC_TABLA;

  const P = { mode: "default", intent: "answer", scope: { level: "global", entities: [] }, calls: [{ tool: "trend", args: { metric: "ventas" } }] };
  const { results, ledger } = runPlan(P, { scenario: SCN });
  const payload = buildNarrateUserMessageC({
    text: "explicame este gráfico", plan: P, results, ledgerFigs: ledger.figs, mem: {}, history: HIST,
    pref: null, scenario: SCN, requestContext: RC, viewContext: VCS, formaRespuesta: "explicar_componente",
  });
  const instr = String(payload.instruccion_forma_respuesta || "");
  ok(!!instr, "la instrucción de explicación llega al payload REAL de la segunda pasada");

  const MOVS = [
    [/QU[EÉ] MIDE/i, "1 · qué mide"],
    [/CU[AÁ]L ES SU UNIVERSO/i, "2 · cuál es su universo"],
    [/QU[EÉ] PATR[OÓ]N IMPORTA/i, "3 · qué patrón importa"],
    [/QU[EÉ] SABEMOS DE SU CAUSA/i, "4 · qué sabemos de su causa"],
    [/QU[EÉ] CONVIENE REVISAR PRIMERO/i, "5 · qué conviene revisar primero"],
  ];
  for (const [re, nombre] of MOVS) ok(re.test(instr), `movimiento ${nombre}`);

  // Cada movimiento ALIMENTADO por el contexto derivado, no por texto genérico.
  ok(VCS.metrica && instr.includes(VCS.metrica), "«qué mide» usa la métrica que el builder declaró");
  ok(VCS.universo && VCS.universo.label && instr.includes(VCS.universo.label), "«el universo» sale del builder, no de una lista fija");
  ok(VCS.universo && VCS.universo.cierraCon && instr.includes(VCS.universo.cierraCon), "…y con qué cierra ese universo (la reconciliación, dicha)");
  ok(instr.includes(VCS.estatus), "«qué sabemos de su causa» va graduado por el sello real del componente");
  ok(/SOLO las cifras autorizadas|cifras_autorizadas/.test(instr), "el patrón se lee SOLO con cifras autorizadas");
  ok(/NO TRAE CIFRAS/i.test(instr), "y la instrucción declara explícitamente que el contexto no cotiza nada");

  ok(!/\$\s?-?\d/.test(instr), "la instrucción no contiene ninguna cifra de dinero");
  ok(/no describas la interfaz/i.test(instr), "y prohíbe describir la interfaz en vez del negocio (se explica el negocio que el componente mide)");

  // QUÉ AGREGA EXACTAMENTE LA PANTALLA AL PAYLOAD. Medirlo por diferencia es la única forma honesta: buscar
  // "filas"/"rows" a secas daría falso positivo con la tabla que la TOOL selló (esa sí es evidencia legítima, y
  // es justamente el camino que el contrato quiere — el LLM entiende, el motor calcula). Lo que no puede pasar es
  // que el contexto de pantalla meta la salida del builder por la ventana.
  const sinVista = buildNarrateUserMessageC({
    text: "explicame este gráfico", plan: P, results, ledgerFigs: ledger.figs, mem: {}, history: HIST,
    pref: null, scenario: SCN, requestContext: RC, viewContext: null,
  });
  const agregadas = Object.keys(payload).filter((k) => !(k in sinVista));
  const PERMITIDAS = ["contexto_vista", "instruccion_forma_respuesta"];
  ok(agregadas.every((k) => PERMITIDAS.includes(k)),
    `la pantalla agrega SOLO ${PERMITIDAS.join(" y ")} al payload`, `agregadas: ${agregadas.join(", ")}`);
  ok(typeof payload.contexto_vista === "string", "y el contexto viaja como UNA línea de texto, nunca como el objeto ViewContext");
  const s = JSON.stringify(payload);
  ok(!/evidenceIds|"controles"|dataSnapshotId|componentId|"universo"|"seleccion"/.test(s),
    "ni un campo estructural del contexto se filtra al prompt (evidenceIds, controles, componentId, universo, selección)");
  const sBuilder = JSON.stringify(COM);
  const fugas = ["porMes", "sostiene", "reconcilia", "evolutivo", "cartera"].filter((k) => sBuilder.includes(`"${k}"`) && s.includes(`"${k}"`));
  ok(!fugas.length, "y ninguna llave propia de la salida del builder de Sentrix aparece en el payload", fugas.join(", "));
  ok(String(payload.contexto_vista || "").length <= VIEW_PLAN_LINE_MAX, `contexto_vista respeta el tope de ${VIEW_PLAN_LINE_MAX} caracteres`);

  const contrato = buildNarrationContract({
    text: "explicame este gráfico", plan: P, results, ledgerFigs: ledger.figs, mem: {}, history: HIST,
    pref: null, scenario: SCN, requestContext: RC, viewContext: VCS, formaRespuesta: "explicar_componente",
  });
  ok(isSealed(contrato), "el contrato —con la pantalla y la forma adentro— queda congelado con la MISMA verificación de siempre");
  ok(contrato.scope.vista && contrato.scope.vista.componentId === VCS.componentId, "y la pantalla vive DENTRO del alcance sellado, no al lado");
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════
H("[8] ESCALA · 300 clientes y 5000 SKU seleccionados · BYTES REALES de los dos prompts");
{
  const CLIENTES_300 = Array.from({ length: 300 }, (_, i) => `Cadena Regional ${String(i + 1).padStart(3, "0")} S.A.`);
  const SKU_5000 = Array.from({ length: 5000 }, (_, i) => `SKU-${String(i + 1).padStart(5, "0")}-XL`);

  // (a) EL CANDADO ES ESTRUCTURAL: no existe forma de representar 300 nombres. La función que lo intente falla.
  const r300 = validateViewContext({ ...BASE, seleccion: { modo: "explicita", n: 300, entidades: CLIENTES_300, filtro: null } });
  ok(!r300.ok && r300.errors.some((x) => /VIEW_SELECTION_MAX/.test(x)), "300 nombres explícitos se RECHAZAN en la validación (el candado no es una convención)");
  const r5000 = validateViewContext({ ...BASE, componentId: "comercial/01/sostiene-sku", metrica: "margen", eje: "sku", seleccion: { modo: "explicita", n: 5000, entidades: SKU_5000, filtro: null } });
  ok(!r5000.ok, `5000 SKU explícitos también (el tope declarado es ${VIEW_SELECTION_MAX})`);

  // (b) La forma legítima: el criterio.
  const VC_300 = vc({ seleccion: { modo: "filtro", n: 300, entidades: [], filtro: { canal: "Retail" } } });
  const VC_5000 = vc({
    componentId: "comercial/01/sostiene-sku", metrica: "margen", eje: "sku",
    seleccion: { modo: "filtro", n: 5000, entidades: [], filtro: { marca: "Samsung" } },
  });
  ok(!!VC_300 && !!VC_5000, "300 clientes y 5000 SKU sí sellan como FILTRO");

  // (c) BYTES en el prompt de la primera pasada.
  const TXT = "¿cuáles de estos clientes están bajo su presupuesto?";
  const bPlan = (v) => buildPlanUserMessage(HIST, TXT, v ? projectViewContextForPlan(v) : null).length;
  const planBase = bPlan(null), plan2 = bPlan(VC_SEL2), plan300 = bPlan(VC_300), plan5000 = bPlan(VC_5000);
  console.log(`      · primera pasada — sin contexto ${planBase}B · 2 entidades ${plan2}B · 300 clientes ${plan300}B · 5000 SKU ${plan5000}B`);
  ok(Math.abs(plan300 - plan2) <= 64 && Math.abs(plan5000 - plan300) <= 64,
    `pasar de 2 a 300 a 5000 entidades mueve el prompt menos de 64 bytes (Δ ${plan300 - plan2}B y ${plan5000 - plan300}B)`);
  ok(plan300 - planBase <= VIEW_PLAN_LINE_MAX + 2 && plan5000 - planBase <= VIEW_PLAN_LINE_MAX + 2,
    `el contexto NUNCA cuesta más que su línea declarada (${plan300 - planBase}B y ${plan5000 - planBase}B sobre el tope de ${VIEW_PLAN_LINE_MAX})`);

  // (d) BYTES en el prompt de la segunda pasada.
  const P = { mode: "default", intent: "answer", scope: { level: "entity", entities: ["Falabella"] }, calls: [{ tool: "marginRead", args: { focus: "bajo_benchmark" } }] };
  const { results, ledger } = runPlan(P, { scenario: SCN });
  const bNarrate = (v) => JSON.stringify(buildNarrateUserMessageC({
    text: TXT, plan: P, results, ledgerFigs: ledger.figs, mem: {}, history: HIST,
    pref: null, scenario: SCN, requestContext: RC, viewContext: v, formaRespuesta: v ? "explicar_componente" : null,
  }));
  const n2 = bNarrate(VC_SEL2), n300 = bNarrate(VC_300), n5000 = bNarrate(VC_5000);
  console.log(`      · segunda pasada — 2 entidades ${n2.length}B · 300 clientes ${n300.length}B · 5000 SKU ${n5000.length}B`);
  ok(Math.abs(n300.length - n2.length) <= 64 && Math.abs(n5000.length - n300.length) <= 64,
    `el payload de NARRAR tampoco crece con la selección (Δ ${n300.length - n2.length}B y ${n5000.length - n300.length}B)`);

  // (e) EL COSTO POR ENTIDAD ES CERO, no "poco".
  const costoPorCliente = (n300.length - n2.length) / (300 - 2);
  const costoPorSku = (n5000.length - n300.length) / (5000 - 300);
  ok(Math.abs(costoPorCliente) < 1 && Math.abs(costoPorSku) < 1,
    `costo marginal por entidad: ${costoPorCliente.toFixed(4)} B/cliente y ${costoPorSku.toFixed(4)} B/SKU — O(1), no O(n)`);

  // (f) Y ninguno de los nombres aparece: la selección viaja como criterio, no como contenido.
  const todo = `${n300}\n${n5000}\n${buildPlanUserMessage(HIST, TXT, projectViewContextForPlan(VC_300))}\n${buildPlanUserMessage(HIST, TXT, projectViewContextForPlan(VC_5000))}`;
  const filtrados = [...CLIENTES_300, ...SKU_5000].filter((n) => todo.includes(n));
  ok(!filtrados.length, "ninguno de los 5300 nombres seleccionados aparece en ninguno de los dos prompts", filtrados.slice(0, 3).join(" · "));

  // (g) El MOTOR sí recibe el criterio completo — que es lo que le permite filtrar sin que el prompt lo pague.
  const proj = projectViewContextForCoercion(VC_5000);
  ok(proj && proj.filtros && proj.filtros.marca === "Samsung", "el motor recibe el FILTRO completo (es él quien filtra, ordena y compara)");
  ok(Array.isArray(proj.entidades) && !proj.entidades.length, "y sin ninguna lista de entidades: ni siquiera del lado del motor se materializan 5000 nombres");
  ok(JSON.stringify(proj).length < 1500, `la proyección al motor pesa ${JSON.stringify(proj).length}B con 5000 SKU seleccionados`);

  // (h) La contra-prueba: el candado ACOTA, no ciega. Una selección chica sigue viajando por nombre (es el sujeto
  // de la pantalla, y sin él ADI no sabría de quién se habla); una grande se declara por su CRITERIO.
  const linea2 = projectViewContextForPlan(VC_SEL2);
  ok(/selecci[oó]n de 2 entidades|entidad «/.test(linea2), `una selección chica sí se nombra: «${linea2.slice(0, 90)}…»`);
  const linea300 = projectViewContextForPlan(VC_300);
  ok(/selecci[oó]n por filtro \(canal\)/.test(linea300), "y una grande viaja por su criterio, nombrando el eje del filtro", linea300);
  ok(!CLIENTES_300.some((n) => linea300.includes(n)), "sin un solo nombre de los 300 en la línea que lee el modelo");
}

console.log(`\n${FAIL === 0 ? "✓" : "✗"} CONCORDANCIA SEMÁNTICA · ${PASS} pasaron · ${FAIL} fallaron`);
process.exit(FAIL ? 1 : 0);
