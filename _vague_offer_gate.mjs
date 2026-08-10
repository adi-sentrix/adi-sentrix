/* === _vague_offer_gate.mjs · GATE del fix "me dio la misma respuesta" (owner 2026-08-01) ===
 * Hallazgo en vivo (app.adiai.cl): ADI narró el margen de Falabella y cerró con "¿Querés que exploremos más sobre
 * las condiciones posibles para esa renegociación?" — el usuario dijo "sí" y recibió una respuesta casi idéntica,
 * solo reformulada. Causa raíz: esa oferta no matchea _CONTINUATION_OFFER_RE (dialogueState.js) — no es
 * "profundizá"/"el cálculo" — así que priorOffer.tool queda null y el turno caía de largo a PLAN normal, que sin
 * nada nuevo que decidir volvía a llamar la MISMA tool. Raíz de fondo: "condiciones de negociación" no tiene
 * mecanismo — simulateGeneral (toolRegistry.js) SOLO modela precio/volumen, nunca carga comercial/rebate.
 *
 * Fix de 2 capas: (1) narratePromptC.js prohíbe a NARRAR prometer ese tipo de oferta vaga de ahora en más — no
 * ejercitable acá sin LLM real, ver _dale_seguimiento_gate.mjs para el patrón de smoke LLM si se quiere ampliar.
 * (2) dialogueState.js (isVagueOffer/composeVagueOfferAcceptance) + answerViaOracle.js: red de seguridad
 * DETERMINÍSTICA para ofertas YA narradas así — "sí" corta ANTES de PLAN y ofrece lo que sí existe (simular
 * precio/volumen, o el desglose ya narrado) en vez de repetir. Este gate certifica la capa (2), 100% determinística
 * (sin LLM, sin red — mem.lastOffer se construye a mano, exactamente el mismo patrón que _criterio_oraculo_gate.mjs). */
import { answerViaOracle } from "./src/adi/oracle/answerViaOracle.js";
import { isVagueOffer, composeVagueOfferAcceptance, extractOffer, isExhaustedMechanismOffer, composeExhaustedMechanismAcceptance } from "./src/adi/oracle/dialogueState.js";

let pass = 0, fail = 0;
const ok = (cond, label) => { console.log(`  ${cond ? "✓" : "✗"} ${label}`); if (cond) pass++; else fail++; };

let planCalled = false, narrateCalled = false;
const callPlan = async () => { planCalled = true; return { intent: "answer", mode: "default", scope: { level: "global" }, calls: [] }; };
const callNarrate = async () => { narrateCalled = true; return "no debería llegar acá"; };

console.log("── 1 · isVagueOffer — clasifica correctamente ──");
{
  ok(isVagueOffer({ texto: "¿Querés que exploremos más sobre las condiciones posibles para esa renegociación?", tool: null, entidad: "Falabella" }) === true, "el caso real reportado clasifica vago");
  ok(isVagueOffer({ texto: "¿Querés ver otras alternativas de negociación?", tool: null, entidad: "Lider" }) === true, "'alternativas de negociación' clasifica vago");
  ok(isVagueOffer({ texto: "¿Querés que profundice en el cálculo?", tool: "entityProfile", entidad: "Falabella" }) === false, "oferta CON tool capturado (profundizar) nunca es 'vaga' — no compite con la ruta estructurada existente");
  ok(isVagueOffer({ texto: "¿Querés que te muestre el detalle por SKU?", tool: null, entidad: "Falabella" }) === false, "oferta concreta sin match de vaguedad no dispara falso positivo");
  ok(isVagueOffer(null) === false, "null no explota");
  ok(isVagueOffer({ texto: null, tool: null }) === false, "sin texto no explota");
}

console.log("\n── 2 · composeVagueOfferAcceptance — ofrece lo que SÍ existe (precio/volumen, desglose) ──");
{
  const t1 = composeVagueOfferAcceptance({ texto: "¿exploramos condiciones?", entidad: "Falabella" });
  ok(/Falabella/.test(t1), `nombra la entidad — "${t1}"`);
  ok(/precio/i.test(t1) && /volumen/i.test(t1), "ofrece el mecanismo real (precio/volumen)");
  ok(/desglose/i.test(t1), "ofrece la alternativa de desglose");
  ok(!/\$|%/.test(t1), "prosa sin cifras propias — no arriesga rechazo de guardC (mismo criterio que composeOrphanAcceptance)");
  const t2 = composeVagueOfferAcceptance({ texto: "¿exploramos condiciones?", entidad: null });
  ok(!/Falabella/.test(t2) && t2.length > 0, "sin entidad no inventa una — fallback genérico honesto");
}

console.log("\n── 3 · answerViaOracle: 'sí' sobre una oferta vaga NUNCA invoca PLAN/NARRAR (bypass entero) ──");
{
  planCalled = false; narrateCalled = false;
  const mem = {
    lastOffer: { texto: "¿Querés que exploremos más sobre las condiciones posibles para esa renegociación?", entidad: "Falabella", dimension: "cliente", tool: null, args: null, modoOrigen: "default", turno: 1 },
  };
  const r = await answerViaOracle({ text: "si", history: [], mem, scenario: "actual", callPlan, callNarrate });
  ok(!!r && !!r.r, "el turno resolvió (no cayó a null)");
  ok(!planCalled, "NUNCA invocó PLAN — bypass entero, cero variance de LLM");
  ok(!narrateCalled, "NUNCA invocó NARRATE — la respuesta es fija, no reformulada por el LLM");
  ok(/Falabella/.test(r.r.text), `la respuesta nombra Falabella (no un genérico) — "${r.r.text}"`);
  ok(r.r.deterministic === true, "marcado deterministic:true, igual que el resto de bypasses de esta sección");
  ok(r.mem.lastOffer === null, "lastOffer se limpia — el turno siguiente no hereda una oferta ya resuelta");
}

console.log("\n── 4 · REGRESIÓN: 'sí' sobre una oferta SIN oferta previa sigue cayendo en aceptación huérfana (no en esta rama) ──");
{
  planCalled = false; narrateCalled = false;
  const r = await answerViaOracle({ text: "si", history: [], mem: {}, scenario: "actual", callPlan, callNarrate });
  ok(!planCalled && !narrateCalled, "sigue sin invocar PLAN/NARRAR (rama huérfana preexistente, no rota por este fix)");
  ok(/No tengo (una oferta pendiente|un contexto previo)/.test(r.r.text), `cae en composeOrphanAcceptance, no en la rama nueva — "${r.r.text}"`);
}

console.log("\n── 5 · REGRESIÓN: extractOffer sigue derivando tool cuando la oferta SÍ es 'profundizar' (ruta estructurada intacta) ──");
{
  const offer = extractOffer("Todo bien con Lider.\n[[SIGUIENTE_PASO]]\n¿Querés que profundice en el cálculo?", {
    plan: { scope: { level: "entity", entities: ["Lider"] }, mode: "default" },
    calls: [{ tool: "entityProfile", args: { dimension: "cliente", entity: "Lider" } }],
    pref: { contentScope: "full" },
    turno: 1,
  });
  ok(offer && offer.tool === "entityProfile", "extractOffer sigue capturando tool para ofertas de profundizar (sin tocar por este fix)");
  ok(isVagueOffer(offer) === false, "y esa oferta NUNCA es 'vaga' (tiene tool) — las dos ramas no compiten");
}

console.log("\n── 6 · 2do hallazgo en vivo (post-deploy): 'profundicemos en el desglose de la carga comercial' seguía repitiendo — extractOffer ahora prefiere simulateCarga (mecanismo REAL) sobre repetir entityProfile ──");
{
  const narration = "Falabella tiene margen 22%, 3pp bajo el benchmark. La carga comercial, hoy 4.5%, es el mecanismo.\n[[SIGUIENTE_PASO]]\n¿Te gustaría que profundicemos en el desglose de la carga comercial de Falabella?";
  const offer = extractOffer(narration, {
    plan: { scope: { level: "entity", entities: ["Falabella"] }, mode: "default" },
    calls: [{ tool: "entityProfile", args: { dimension: "cliente", entity: "Falabella" } }],
    pref: { contentScope: "full" },
    turno: 1,
  });
  ok(offer && offer.tool === "simulateCarga", `prefiere simulateCarga sobre repetir entityProfile (obtuvo tool="${offer && offer.tool}")`);
  ok(offer && offer.args && offer.args.filters && offer.args.filters.cliente === "Falabella", "args trae filters.cliente=Falabella (mismo shape que composeSpecSimulateCarga/toolRegistry.js)");
}

console.log("\n── 7 · el caso EXACTO reportado por el owner ('condiciones para esa renegociación') TAMBIÉN enruta a simulateCarga cuando el mecanismo nombrado es carga comercial ──");
{
  const narration = "(Datos del año cerrado.) Veo que el margen de Falabella está en 22%... priorizá renegociar la carga comercial, que actualmente es 4.5%, para mejorar el margen.\n[[SIGUIENTE_PASO]]\n¿Querés que exploremos más sobre las condiciones posibles para esa renegociación?";
  const offer = extractOffer(narration, {
    plan: { scope: { level: "entity", entities: ["Falabella"] }, mode: "default" },
    calls: [{ tool: "entityProfile", args: { dimension: "cliente", entity: "Falabella" } }],
    pref: { contentScope: "full" },
    turno: 1,
  });
  ok(offer && offer.tool === "simulateCarga", `el caso REAL reportado ahora resuelve a una simulación real, no a mi mensaje de fallback (obtuvo tool="${offer && offer.tool}")`);
  ok(isVagueOffer(offer) === false, "con tool capturado, ya no pasa por la rama de fallback (isVagueOffer) — se ejecuta de verdad");
}

console.log("\n── 8 · REGRESIÓN: mecanismo distinto a carga comercial (ej. rebate) NO fuerza simulateCarga — sigue sin tool, cae en isVagueOffer ──");
{
  const narration = "Falabella tiene margen 22%. El mecanismo es el rebate, hoy 4.5%.\n[[SIGUIENTE_PASO]]\n¿Querés que exploremos otras alternativas para ese rebate?";
  const offer = extractOffer(narration, {
    plan: { scope: { level: "entity", entities: ["Falabella"] }, mode: "default" },
    calls: [{ tool: "entityProfile", args: { dimension: "cliente", entity: "Falabella" } }],
    pref: { contentScope: "full" },
    turno: 1,
  });
  ok(offer && offer.tool === null, `sin 'carga comercial' nombrada, no inventa una simulación que no corresponde (obtuvo tool="${offer && offer.tool}")`);
  ok(isVagueOffer(offer) === true, "cae en la red de seguridad genérica (isVagueOffer) — sigue siendo honesto");
}

console.log("\n── 9 · REGRESIÓN: sin entidad puntual (scope global), NO enruta a simulateCarga (correría sobre TODA la cartera, no lo pedido) ──");
{
  const narration = "La cartera tiene margen 24% en promedio. La carga comercial general es 4.5%.\n[[SIGUIENTE_PASO]]\n¿Querés que exploremos las condiciones de esa carga comercial?";
  const offer = extractOffer(narration, {
    plan: { scope: { level: "global" }, mode: "default" },
    calls: [{ tool: "diagnose", args: {} }],
    pref: { contentScope: "full" },
    turno: 1,
  });
  ok(offer && offer.tool === null, `sin entidad puntual, no arma una simulación de cartera completa por default (obtuvo tool="${offer && offer.tool}")`);
}

console.log("\n── 10 · INTEGRACIÓN end-to-end: 'sí' con priorOffer.tool='simulateCarga' ejecuta la simulación REAL (figs nuevas, no las de entityProfile) ──");
{
  let capturedFigs = null;
  const captureNarrate = async ({ ledgerFigs }) => { capturedFigs = ledgerFigs; return "narración de prueba"; };
  const failIfPlanCalled = async () => { throw new Error("PLAN no debería invocarse — la ruta estructurada bypasea PLAN"); };
  const mem = {
    lastOffer: { texto: "¿profundicemos en el desglose de la carga comercial?", entidad: "Falabella", dimension: "cliente", tool: "simulateCarga", args: { filters: { cliente: "Falabella" } }, modoOrigen: "default", turno: 1 },
  };
  const r = await answerViaOracle({ text: "si", history: [], mem, scenario: "actual", callPlan: failIfPlanCalled, callNarrate: captureNarrate });
  ok(!!r && !!r.r, "el turno resolvió (runPlan corrió contra el dataset local, sin red/LLM)");
  const labels = (capturedFigs || []).map((f) => f.label || f.entidad || JSON.stringify(f));
  ok(Array.isArray(capturedFigs) && capturedFigs.some((f) => /Recuperable/i.test(f.label || "")), `trae una fig 'Recuperable' — dato REALMENTE nuevo, no el margen/benchmark ya narrado (labels: ${JSON.stringify(labels)})`);
  ok(!capturedFigs.some((f) => /^Margen$/i.test(f.label || "")), "NO repite la fig 'Margen' de la respuesta original — es contenido distinto, no una reformulación");
}

console.log("\n── 11 · 3er hallazgo en vivo (2 aceptaciones seguidas): la 2da 'sí' sobre simulateCarga NO vuelve a repetir la tool — mechanismExhausted queda true ──");
{
  const narration = "La carga comercial de Falabella es $194K. Si ajustas al target de 3.5%, recuperás ese monto.\n[[SIGUIENTE_PASO]]\n¿Querés que profundice en el desglose de la carga comercial por SKU?";
  const offer = extractOffer(narration, {
    plan: { scope: { level: "entity", entities: ["Falabella"] }, mode: "seguimiento" },
    calls: [{ tool: "simulateCarga", args: { filters: { cliente: "Falabella" } } }],
    pref: { contentScope: "full" },
    turno: 2,
  });
  ok(offer && offer.tool === null, `NO vuelve a capturar simulateCarga (repetirla no agrega nada) — obtuvo tool="${offer && offer.tool}"`);
  ok(offer && offer.mechanismExhausted === true, "queda marcada mechanismExhausted:true");
  ok(isExhaustedMechanismOffer(offer) === true, "isExhaustedMechanismOffer la reconoce");
  ok(isVagueOffer(offer) === false, "NO cae en la rama vaga genérica (el mensaje específico es mejor)");
}

console.log("\n── 12 · composeExhaustedMechanismAcceptance — honesto: ya corrió, ofrece Sentrix o otra simulación, sin inventar cifras ──");
{
  const msg = composeExhaustedMechanismAcceptance({ entidad: "Falabella" });
  ok(/Falabella/.test(msg), `nombra la entidad — "${msg}"`);
  ok(/ya la corrí|ya corrí/i.test(msg), "reconoce explícitamente que la simulación YA se hizo (no finge que es la primera vez)");
  ok(/Sentrix/i.test(msg), "ofrece ver el detalle en Sentrix");
  ok(/precio|volumen/i.test(msg), "ofrece la alternativa real (otra simulación)");
  ok(!/\$|\d+%/.test(msg), "prosa sin cifras propias — no arriesga rechazo de guardC");
  const msgSinEntidad = composeExhaustedMechanismAcceptance({ entidad: null });
  ok(msgSinEntidad.length > 0 && !/Falabella/.test(msgSinEntidad), "sin entidad no la inventa");
}

console.log("\n── 13 · answerViaOracle: la 2da 'sí' NUNCA invoca PLAN/NARRAR y corta el loop (bypass entero) ──");
{
  planCalled = false; narrateCalled = false;
  const mem = {
    lastOffer: { texto: "¿Querés que profundice en el desglose de la carga comercial por SKU?", entidad: "Falabella", dimension: "cliente", tool: null, args: null, mechanismExhausted: true, modoOrigen: "seguimiento", turno: 2 },
  };
  const r = await answerViaOracle({ text: "si", history: [], mem, scenario: "actual", callPlan, callNarrate });
  ok(!!r && !!r.r, "el turno resolvió (no cayó a null)");
  ok(!planCalled, "NUNCA invocó PLAN — corta el loop antes de repetir la simulación");
  ok(!narrateCalled, "NUNCA invocó NARRATE");
  ok(/Falabella/.test(r.r.text) && /ya la corrí/i.test(r.r.text), `respuesta honesta, no una 3ra repetición — "${r.r.text}"`);
  ok(r.mem.lastOffer === null, "lastOffer se limpia — no perpetúa el loop al turno siguiente");
}

console.log("\n── 14 · REGRESIÓN: precedencia — mechanismExhausted gana sobre isVagueOffer cuando ambas condiciones aplican ──");
{
  planCalled = false; narrateCalled = false;
  const mem = {
    lastOffer: { texto: "¿exploramos otras condiciones de esa carga comercial?", entidad: "Falabella", dimension: "cliente", tool: null, args: null, mechanismExhausted: true, modoOrigen: "seguimiento", turno: 2 },
  };
  const r = await answerViaOracle({ text: "dale", history: [], mem, scenario: "actual", callPlan, callNarrate });
  ok(/ya la corrí/i.test(r.r.text), "responde con el mensaje ESPECÍFICO de mecanismo agotado, no el genérico de oferta vaga");
}

console.log("\n── 15 · REGRESIÓN: la PRIMERA aceptación (calls=[entityProfile], nunca corrió simulateCarga) sigue enrutando a simulateCarga normal — el guard nuevo no rompe el fix anterior ──");
{
  const narration = "Falabella tiene margen 22%, 3pp bajo el benchmark. La carga comercial, hoy 4.5%, es el mecanismo.\n[[SIGUIENTE_PASO]]\n¿Te gustaría que profundicemos en el desglose de la carga comercial de Falabella?";
  const offer = extractOffer(narration, {
    plan: { scope: { level: "entity", entities: ["Falabella"] }, mode: "default" },
    calls: [{ tool: "entityProfile", args: { dimension: "cliente", entity: "Falabella" } }],
    pref: { contentScope: "full" },
    turno: 1,
  });
  ok(offer && offer.tool === "simulateCarga", `1ra aceptación SIGUE enrutando a simulateCarga (obtuvo tool="${offer && offer.tool}")`);
  ok(offer && offer.mechanismExhausted === false, "mechanismExhausted es false en la 1ra vuelta (recién se va a correr, no está agotada)");
}

console.log("\n── 16 · 4to hallazgo en vivo (owner 2026-08-02, app.adiai.cl): 'cuánto capital tengo inmovilizado en inventario' → 'sí, profundicemos en la estrategia para liberarlo' — extractOffer ahora prefiere simulateCapital (mecanismo REAL) sobre repetir inventoryStatus ──");
{
  const narration = "(Foto de inventario a hoy.) El capital inmovilizado en inventario es de $33K. Este monto está distribuido principalmente en las bodegas de Valparaíso, con $25K (75%) y Antofagasta, con $8K (25%).\n[[SIGUIENTE_PASO]]\n¿Te gustaría que profundicemos en la estrategia para liberar ese inventario?";
  const offer = extractOffer(narration, {
    plan: { scope: { level: "global" }, mode: "default" },
    calls: [{ tool: "inventoryStatus", args: {} }],
    pref: { contentScope: "full" },
    turno: 1,
  });
  ok(offer && offer.tool === "simulateCapital", `el caso REAL reportado ahora enruta a la simulación real, no repite inventoryStatus (obtuvo tool="${offer && offer.tool}")`);
  ok(offer && offer.args && JSON.stringify(offer.args) === "{}", `sin entidad puntual (pregunta global), args queda {} — simulateCapital corre sobre TODO el inventario, no exige un cliente como simulateCarga (obtuvo ${JSON.stringify(offer && offer.args)})`);
  ok(isVagueOffer(offer) === false, "con tool capturado, no cae en la rama de fallback genérica");
}

console.log("\n── 17 · simulateCapital SÍ pasa la entidad cuando el foco es una bodega/marca puntual (no siempre global) ──");
{
  const narration = "El capital inmovilizado en la bodega Valparaíso es de $25K.\n[[SIGUIENTE_PASO]]\n¿Querés que profundicemos en la estrategia para liberar ese capital?";
  const offer = extractOffer(narration, {
    plan: { scope: { level: "entity", entities: ["Valparaíso"] }, mode: "default" },
    calls: [{ tool: "inventoryStatus", args: { filters: { bodega: "Valparaíso" } } }],
    pref: { contentScope: "full" },
    turno: 1,
  });
  ok(offer && offer.tool === "simulateCapital", `enruta a simulateCapital igual con una bodega puntual en foco (obtuvo tool="${offer && offer.tool}")`);
  ok(offer && offer.args && offer.args.filters && offer.args.filters.bodega === "Valparaíso", `args trae filters.bodega="Valparaíso" (mismo shape que inventoryStatus/toolRegistry.js) — obtuvo ${JSON.stringify(offer && offer.args)}`);
}

console.log("\n── 18 · REGRESIÓN: mecanismo distinto a capital/carga NO fuerza simulateCapital — sigue sin tool, cae en isVagueOffer ──");
{
  const narration = "Las ventas del negocio suben 8% vs el año anterior.\n[[SIGUIENTE_PASO]]\n¿Querés que exploremos otras alternativas de crecimiento?";
  const offer = extractOffer(narration, {
    plan: { scope: { level: "global" }, mode: "default" },
    calls: [{ tool: "salesRead", args: {} }],
    pref: { contentScope: "full" },
    turno: 1,
  });
  ok(offer && offer.tool === null, `sin 'capital inmovilizado/detenido' nombrado, no inventa una simulación que no corresponde (obtuvo tool="${offer && offer.tool}")`);
  ok(isVagueOffer(offer) === true, "cae en la red de seguridad genérica (isVagueOffer)");
}

console.log("\n── 19 · 2da aceptación seguida sobre capital: mechanismExhausted queda true, con el mensaje de capital (no el de carga comercial) ──");
{
  const narration = "Si liberás el capital detenido, recuperarías $33K estimado.\n[[SIGUIENTE_PASO]]\n¿Querés que profundicemos más en la estrategia para liberar ese capital?";
  const offer = extractOffer(narration, {
    plan: { scope: { level: "global" }, mode: "seguimiento" },
    calls: [{ tool: "simulateCapital", args: {} }],
    pref: { contentScope: "full" },
    turno: 2,
  });
  ok(offer && offer.tool === null, `NO vuelve a capturar simulateCapital (repetirla no agrega nada) — obtuvo tool="${offer && offer.tool}"`);
  ok(offer && offer.mechanismExhausted === true, "queda marcada mechanismExhausted:true");
  ok(offer && offer.mechanism === "capital", `mechanism="capital" (no "carga") — obtuvo "${offer && offer.mechanism}"`);
  ok(isExhaustedMechanismOffer(offer) === true, "isExhaustedMechanismOffer la reconoce");

  const msg = composeExhaustedMechanismAcceptance(offer);
  ok(/capital/i.test(msg) && !/carga comercial/i.test(msg), `el mensaje habla de CAPITAL, no reusa el texto de carga comercial — "${msg}"`);
  ok(/ya la corrí/i.test(msg), "reconoce que la simulación ya se hizo");
  ok(/Sentrix/i.test(msg) && /precio|volumen/i.test(msg), "ofrece las 2 rutas reales (Sentrix, otra simulación)");
  ok(!/\$|\d+%/.test(msg), "prosa sin cifras propias — no arriesga rechazo de guardC");
}

console.log("\n── 20 · REGRESIÓN: composeExhaustedMechanismAcceptance SIN campo `mechanism` (llamadas viejas, ej. sección 12) sigue devolviendo el texto de carga comercial — no rompe compatibilidad ──");
{
  const msg = composeExhaustedMechanismAcceptance({ entidad: "Falabella" });
  ok(/carga comercial/i.test(msg), `sin mechanism explícito, default sigue siendo carga comercial — "${msg}"`);
}

console.log("\n── 21 · AUDITORÍA GENERAL (owner 2026-08-02): simulateCosto — auto-rutea SOLO si la propia oferta ya trae el % con signo explícito, nunca lo adivina ──");
{
  const narrationConPct = "El costo medio de tus SKU bajo benchmark es alto.\n[[SIGUIENTE_PASO]]\n¿Querés que profundicemos simulando bajar el costo medio un 3%?";
  const offerConPct = extractOffer(narrationConPct, {
    plan: { scope: { level: "global" }, mode: "default" },
    calls: [{ tool: "marginRead", args: { dimension: "sku" } }],
    pref: { contentScope: "full" },
    turno: 1,
  });
  ok(offerConPct && offerConPct.tool === "simulateCosto", `con % explícito en la oferta, enruta a simulateCosto (obtuvo tool="${offerConPct && offerConPct.tool}")`);
  ok(offerConPct && offerConPct.args && offerConPct.args.pct === -3, `args.pct = -3 (signo correcto, "bajar" lo determina) — obtuvo ${JSON.stringify(offerConPct && offerConPct.args)}`);

  const narrationSinPct = "El costo medio de tus SKU bajo benchmark es alto.\n[[SIGUIENTE_PASO]]\n¿Querés que profundicemos en el costo medio?";
  const offerSinPct = extractOffer(narrationSinPct, {
    plan: { scope: { level: "global" }, mode: "default" },
    calls: [{ tool: "marginRead", args: { dimension: "sku" } }],
    pref: { contentScope: "full" },
    turno: 1,
  });
  ok(offerSinPct && offerSinPct.tool === null, `SIN % explícito, NO adivina — no enruta a simulateCosto (obtuvo tool="${offerSinPct && offerSinPct.tool}")`);
  ok(offerSinPct && offerSinPct.mechanismBlocked === "costo", `queda marcado mechanismBlocked="costo" — obtuvo "${offerSinPct && offerSinPct.mechanismBlocked}"`);
  // el hallazgo que esto cierra: SIN este flag, calls.length===1 + "profundicemos" (matchea _CONTINUATION_OFFER_RE)
  // caía al fallback genérico y repetía marginRead — la MISMA lectura, el MISMO bug de fondo, solo que en costo.
  ok(offerSinPct && offerSinPct.tool !== "marginRead", `NO repite marginRead a ciegas (el bug de fondo que este mapeo general existe para cerrar)`);
}

console.log("\n── 22 · AUDITORÍA GENERAL: simulateCosto con entidad puntual en foco pasa filters, igual que capital ──");
{
  const narration = "El costo medio de Sodimac está alto.\n[[SIGUIENTE_PASO]]\n¿Profundizamos simulando subir el costo medio 5%?";
  const offer = extractOffer(narration, {
    plan: { scope: { level: "entity", entities: ["Sodimac"] }, mode: "default" },
    calls: [{ tool: "entityProfile", args: { dimension: "cliente", entity: "Sodimac" } }],
    pref: { contentScope: "full" },
    turno: 1,
  });
  ok(offer && offer.tool === "simulateCosto" && offer.args.pct === 5, `signo correcto para "subir" (+5) — obtuvo ${JSON.stringify(offer && offer.args)}`);
  ok(offer && offer.args.filters && offer.args.filters.cliente === "Sodimac", `pasa la entidad como filters.cliente — obtuvo ${JSON.stringify(offer && offer.args && offer.args.filters)}`);
}

console.log("\n── 23 · AUDITORÍA GENERAL: 2da aceptación sobre costo → mechanismExhausted con mensaje de costo ──");
{
  const narration = "Si bajás el costo medio 3%, el margen sube.\n[[SIGUIENTE_PASO]]\n¿Profundizamos más en el costo medio?";
  const offer = extractOffer(narration, {
    plan: { scope: { level: "global" }, mode: "seguimiento" },
    calls: [{ tool: "simulateCosto", args: { pct: -3, dimension: "sku" } }],
    pref: { contentScope: "full" },
    turno: 2,
  });
  ok(offer && offer.tool === null && offer.mechanismExhausted === true && offer.mechanism === "costo", `mechanism="costo", exhausted=true — obtuvo tool="${offer && offer.tool}", mechanism="${offer && offer.mechanism}"`);
  const msg = composeExhaustedMechanismAcceptance(offer);
  ok(/costo medio/i.test(msg) && !/carga comercial/i.test(msg) && !/capital detenido/i.test(msg), `mensaje habla de COSTO, no reusa carga ni capital — "${msg}"`);
}

console.log("\n── 24 · AUDITORÍA GENERAL: simulateGeneral (2 variables) queda FUERA de MECHANISM_TABLE a propósito — ese flujo lo maneja mem.pendingSimulation (#56), no extractOffer ──");
{
  const narration = "Si subís el precio 5% a Falabella pero perdés 10% de volumen, no conviene.\n[[SIGUIENTE_PASO]]\n¿Simulamos otro escenario de precio y volumen?";
  const offer = extractOffer(narration, {
    plan: { scope: { level: "entity", entities: ["Falabella"] }, mode: "seguimiento" },
    calls: [{ tool: "simulateGeneral", args: { dimension: "cliente", entity: "Falabella", variableA: { campo: "precioLista", delta_pct: 5 }, variableB: { campo: "unidades", delta_pct: -10 } } }],
    pref: { contentScope: "full" },
    turno: 2,
  });
  ok(offer && offer.mechanism === null && offer.mechanismExhausted === false, `simulateGeneral NUNCA entra a mechanismExhausted por esta tabla — obtuvo mechanism="${offer && offer.mechanism}"`);
}

console.log(`\n── _vague_offer_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
