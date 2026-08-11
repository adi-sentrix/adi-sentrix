/* === _gateway_causa_y_costo_gate.mjs · LA MEDICIÓN NO PUEDE MENTIR (owner 2026-08-11) ==================
 * La prueba de CONDUCTA de los dos defectos que dejaron ciega a la corrida pagada. Ejerce los handlers REALES
 * del gateway de punta a punta con ADAPTERS.openai monkey-patcheado a nivel de módulo (mismo mecanismo que
 * _model_router_gate.mjs sección 5: providerAdapter.js exporta `ADAPTERS` mutable y ES modules cachea una única
 * instancia por proceso, así que el objeto que el gateway usa internamente es el que este archivo parcha).
 * CERO red, CERO credencial, CERO crédito — pero el clasificador estático de scripts/gates-offline.mjs marca LIVE
 * a todo gate que importe el gateway, así que este NO entra en la suite. Corrélo a mano, con el candado puesto:
 *     node --import ./scripts/offline-guard.mjs _gateway_causa_y_costo_gate.mjs
 * Lo que SÍ corre en la suite: _tarifa_familia_modelo_gate.mjs (la regla de precio, pura) y
 * _gateway_causa_emision_gate.mjs (el cableado de este archivo, por inspección estática).
 *
 * LO QUE MIDIÓ MAL LA CORRIDA:
 *   D1 · el cerrojo contó US$1,2908 y se gastaron US$1,4223. Las 72 llamadas del modelo base valían US$0,00 para
 *        el tope, porque el proveedor responde "gpt-4o-mini-2024-07-18" y la tabla sólo conocía "gpt-4o-mini".
 *   D2 · 10 eventos "rechazado" con la causa en null, 27 reintentos contados como llamadas felices, y 6 llamadas
 *        pagadas que fallaron sin dejar un solo evento.
 *
 * SEGUNDA PASADA (owner 2026-08-11) · las cuatro rutas ciegas que el revisor adversarial midió en rojo, y que las
 * secciones [1]–[7] no tocaban. Cada una con su medición, no con su afirmación:
 *   [8]  los DOS handlers viejos (endpoints desplegados, llamada PAGA) no emitían un solo evento.
 *   [9]  el desarmado de la respuesta vivía FUERA del try: un adapter que resolvía vacío tiraba el handler
 *        DESPUÉS de pagar la llamada, sin dejar rastro.
 *   [10] entrada hostil del cliente (history con nulos, getters que lanzan) → el handler se iba mudo.
 *   [11] EL CASO BUENO · cinco llamadas CORRECTAS, una por cada forma que atiende el gateway: siguen devolviendo
 *        lo mismo, no lanzan, y dejan UN evento (la red de seguridad no duplica el camino feliz). La doctrina de
 *        la casa es «falso negativo antes que falso positivo»: un instrumento que rompe turnos buenos hace más
 *        daño que la ceguera que venía a arreglar, así que eso se mide igual que el defecto.
 */
import { handlePlan, handleNarrateC, handleSpec, handleNarrate } from "./src/adi/llm/gatewayCore.js";
import { ADAPTERS } from "./src/adi/llm/providerAdapter.js";
import { setSink, REASON_CODES } from "./src/adi/llm/telemetry.js";
import { estimateCostUSD, modelosSinPrecio, olvidarNoTarifados } from "./src/adi/llm/modelPricing.js";

let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };
const H = (t) => console.log("\n" + t);

const USO = { prompt_tokens: 9000, completion_tokens: 120 };
const ENV = { LLM_PROVIDER: "openai", LLM_MODEL_PARSE: "gpt-4o-mini", LLM_MODEL_NARRATE: "gpt-4o-mini", LLM_RATE_MAX_PER_WINDOW: "1000" };
const PAYLOAD = { pregunta: "x", modo: "default" };
let tenant = 0;
const nuevoTenant = () => `gate_causa_${++tenant}`;

// el sink real del contrato: lo mismo que instala el host para escribir a disco
const EVENTOS = [];
setSink((e) => EVENTOS.push(e));
const desde = (n) => EVENTOS.slice(n);
const ev = (e) => `etapa=${e.etapa} intento=${e.intento} resultado=${e.resultado} reasonCode=${JSON.stringify(e.reasonCode)}`;

// el adapter simulado: la ÚNICA pieza que no es de producción. `modeloQueResponde` imita lo que hace el proveedor
// de verdad — resolver el alias pedido a un snapshot fechado.
let modeloQueResponde = "gpt-4o-mini-2024-07-18";
let revienta = null;
// `devuelveVacio` (2ª pasada): el proveedor que RESUELVE pero con algo que no se puede desarmar. El centinela es
// una cadena que nunca sería una respuesta válida, así que `undefined`/`null` se pueden simular de verdad.
let devuelveVacio = "__no__";
const orig = { parse: ADAPTERS.openai.parse, narrate: ADAPTERS.openai.narrate };
ADAPTERS.openai.parse = async () => { if (revienta) throw new Error(revienta); if (devuelveVacio !== "__no__") return devuelveVacio; return { spec: { intent: "ack", calls: [] }, usage: USO, model: modeloQueResponde }; };
ADAPTERS.openai.narrate = async () => { if (revienta) throw new Error(revienta); if (devuelveVacio !== "__no__") return devuelveVacio; return { text: "listo", usage: USO, model: modeloQueResponde }; };

try {
  H("[1] D1 · EL ALIAS VERSIONADO TARIFA COMO SU FAMILIA · de punta a punta, con el proveedor devolviendo el snapshot");
  {
    const r = await handlePlan({ text: "hola", history: [], mem: {}, scenario: "actual", attempt: 0, tenantId: nuevoTenant() }, ENV);
    ok(r.modelUsed === "gpt-4o-mini" && r.modelo === "gpt-4o-mini-2024-07-18",
      `la respuesta distingue el que se PIDIÓ del que RESPONDIÓ — ${r.modelUsed} / ${r.modelo}`);
    ok(r.modelFamilia === "gpt-4o-mini", `…y declara la familia que la tarifa — ${r.modelFamilia}`);
    ok(typeof r.costUSD === "number" && r.costUSD > 0, `la llamada tiene precio, no US$0,00 — US$${r.costUSD}`);
    // EL NÚCLEO DEL DEFECTO: los llamadores usan campos distintos (la UI el pedido, el arnés el que respondió) y
    // por eso el mismo gasto tenía dos verdades. Ahora los dos caminos dan el MISMO número.
    ok(Math.abs(estimateCostUSD(r.modelo, r.usage) - estimateCostUSD(r.modelUsed, r.usage)) < 1e-12,
      "tarifar por el id EFECTIVO o por el PEDIDO da idéntico: se acabaron las dos verdades para una misma llamada");
    ok(Math.abs(r.costUSD - estimateCostUSD(r.modelo, r.usage)) < 1e-12, "el costo que publica el gateway es el mismo que calcularía el llamador");

    const n = await handleNarrateC({ payload: PAYLOAD, mem: {}, attempt: 0, tenantId: nuevoTenant() }, ENV);
    ok(typeof n.costUSD === "number" && n.costUSD > 0 && n.modelFamilia === "gpt-4o-mini", `NARRAR recibe el mismo trato — US$${n.costUSD}`);

    // el tier caro con snapshot fechado: el escenario que el diagnóstico marcó como el peor (US$5/US$30 por millón)
    modeloQueResponde = "gpt-5.6-sol-2026-05-01";
    const caro = await handleNarrateC({ payload: PAYLOAD, mem: {}, attempt: 2, tenantId: nuevoTenant() }, ENV);
    ok(caro.modelFamilia === "gpt-5.6-sol" && caro.costUSD > n.costUSD,
      `el escalón más caro con snapshot fechado también tarifa, y más caro — US$${caro.costUSD}`);
    modeloQueResponde = "gpt-4o-mini-2024-07-18";
  }

  H("[2] D1 · UN MODELO DESCONOCIDO NO TARIFA 0 EN SILENCIO");
  {
    olvidarNoTarifados();
    modeloQueResponde = "gpt-4o-mini-turbo";   // otra línea, otra tarifa: esta tabla NO lo conoce
    const r = await handlePlan({ text: "hola", history: [], mem: {}, scenario: "actual", attempt: 0, tenantId: nuevoTenant() }, ENV);
    ok(r.costUSD === null, `el costo desconocido es null, NUNCA 0 — ${JSON.stringify(r.costUSD)}`);
    ok(r.costUSD !== 0, "un cero afirmaría que la llamada no costó nada: eso es lo que dejó pasar US$0,13 reales");
    ok(r.modelFamilia === null, "y no se le adjudica una familia que no es la suya (compartir prefijo no es ser de la familia)");
    ok(modelosSinPrecio().some((x) => x.modelo === "gpt-4o-mini-turbo"),
      `queda registrado y avisa por consola: el que cierre la corrida no puede no enterarse — ${JSON.stringify(modelosSinPrecio())}`);
    modeloQueResponde = "gpt-4o-mini-2024-07-18";
    olvidarNoTarifados();
  }

  H("[3] D2 · UN RECHAZO DEL GUARD EMITE SU reasonCode");
  {
    // El cliente declara con qué veredicto guardC rechazó el intento anterior. Es la única forma de que la causa
    // llegue: guardC corre client-side, DESPUÉS de que el gateway ya respondió.
    for (const [veredicto, esperado] of [["cifra-no-autorizada", "guard_rejected"], ["tabla-faltante", "guard_rejected"], ["guard_rejected", "guard_rejected"]]) {
      const n = EVENTOS.length;
      await handleNarrateC({ payload: PAYLOAD, mem: {}, attempt: 1, motivoReintento: veredicto, tenantId: nuevoTenant() }, ENV);
      const e = desde(n);
      ok(e.length === 1 && e[0].reasonCode === esperado, `«${veredicto}» → reasonCode ${esperado} — ${e.map(ev).join(" | ")}`);
    }
    const n = EVENTOS.length;
    await handlePlan({ text: "hola", history: [], mem: {}, scenario: "actual", attempt: 1, motivoReintento: "invalid_plan", tenantId: nuevoTenant() }, ENV);
    ok(desde(n)[0].reasonCode === "invalid_plan", `PLAN también: un reintento por plan inválido lo dice — ${desde(n).map(ev).join(" | ")}`);
    // …y NO se invierte la métrica: la llamada que salió bien sigue contando como llamada que salió bien.
    ok(desde(n)[0].resultado === "ok",
      "una llamada que salió bien NO se cuenta como rechazo por existir a causa de uno: el resultado lo decide la respuesta");
  }

  H("[4] D2 · UN REINTENTO NUNCA SALE SIN CAUSA · y un intento 0 no se la inventa");
  {
    let n = EVENTOS.length;
    await handleNarrateC({ payload: PAYLOAD, mem: {}, attempt: 2, tenantId: nuevoTenant() }, ENV);   // sin declarar nada
    ok(desde(n)[0].reasonCode === "unknown", `intento ≥1 sin causa declarada → "unknown", nunca null — ${desde(n).map(ev).join(" | ")}`);
    n = EVENTOS.length;
    await handleNarrateC({ payload: PAYLOAD, mem: {}, attempt: 0, tenantId: nuevoTenant() }, ENV);
    ok(desde(n)[0].reasonCode === null, `intento 0 no inventa una causa: no hubo rechazo previo — ${desde(n).map(ev).join(" | ")}`);
    n = EVENTOS.length;
    await handleNarrateC({ payload: PAYLOAD, mem: {}, attempt: 0, motivoReintento: "cifra-no-autorizada", tenantId: nuevoTenant() }, ENV);
    ok(desde(n)[0].reasonCode === null, "un intento 0 que declara una causa igual no la hereda: no existe un rechazo anterior que explicar");
  }

  H("[5] D2 · LA CAUSA VIAJA COMO CÓDIGO · nada del cliente atraviesa el borde");
  {
    const veneno = ["cifra-no-autorizada: $13,9M de Falabella", "El margen de Falabella cerró en $99,9M", "Falabella", "4300000", { kind: "x" }, 42];
    for (const x of veneno) {
      const n = EVENTOS.length;
      await handleNarrateC({ payload: PAYLOAD, mem: {}, attempt: 1, motivoReintento: x, tenantId: nuevoTenant() }, ENV);
      const e = desde(n)[0];
      ok(e.reasonCode === "unknown" && !/Falabella|13,9|99,9|4300000/.test(JSON.stringify(e)),
        `«${String(x).slice(0, 34)}» se descarta entero y el evento queda en "unknown" — ${JSON.stringify(e.reasonCode)}`);
    }
    const codigos = EVENTOS.map((e) => e.reasonCode).filter((c) => c != null);
    ok(codigos.every((c) => REASON_CODES.includes(c)), `TODOS los códigos emitidos son de la lista cerrada — ${JSON.stringify([...new Set(codigos)])}`);
  }

  H("[6] D2 · LAS RUTAS QUE ANTES NO DEJABAN RASTRO");
  {
    // (a) el freno propio del gateway: el `return` temprano estaba ARRIBA del único emit
    const tRate = nuevoTenant();
    const envRate = { ...ENV, LLM_RATE_MAX_PER_WINDOW: "1" };
    await handleNarrateC({ payload: PAYLOAD, mem: {}, attempt: 0, tenantId: tRate }, envRate);
    let n = EVENTOS.length;
    const rl = await handleNarrateC({ payload: PAYLOAD, mem: {}, attempt: 0, tenantId: tRate }, envRate);
    ok(rl.ok === false && rl.error === "rate_limited", "el freno sigue frenando igual que siempre (la telemetría no cambió ninguna decisión)");
    ok(desde(n).length === 1 && desde(n)[0].reasonCode === "rate_limited" && desde(n)[0].resultado === "rate_limited",
      `un turno frenado por rate limit deja UN evento con su causa — ${desde(n).map(ev).join(" | ") || "(ninguno)"}`);

    // (b) request sin contenido
    n = EVENTOS.length;
    await handlePlan({ text: null, attempt: 0, tenantId: nuevoTenant() }, ENV);
    ok(desde(n).length === 1 && desde(n)[0].resultado !== "ok", `una request sin texto deja rastro — ${desde(n).map(ev).join(" | ") || "(ninguno)"}`);
    n = EVENTOS.length;
    await handleNarrateC({ payload: null, attempt: 0, tenantId: nuevoTenant() }, ENV);
    ok(desde(n).length === 1 && desde(n)[0].resultado !== "ok", `una request sin payload también — ${desde(n).map(ev).join(" | ") || "(ninguno)"}`);

    // (c) acceso denegado (con secret puesto y sin código válido)
    n = EVENTOS.length;
    const rAcc = await handlePlan({ text: "hola", attempt: 0, tenantId: nuevoTenant() }, { ...ENV, ADI_TOKEN_SECRET: "s3creto" });
    ok(rAcc.access === "denied", "la denegación de acceso sigue siendo la de siempre");
    ok(desde(n).length === 1 && desde(n)[0].resultado !== "ok", `y ahora se puede contar — ${desde(n).map(ev).join(" | ") || "(ninguno)"}`);

    // (d) la llamada PAGADA que revienta: 6 de la corrida murieron acá sin dejar nada
    revienta = "timeout tras 25000ms esperando al proveedor";
    n = EVENTOS.length;
    let propagada = null;
    try { await handleNarrateC({ payload: PAYLOAD, mem: {}, attempt: 0, tenantId: nuevoTenant() }, ENV); } catch (e) { propagada = e; }
    ok(desde(n).length === 1 && desde(n)[0].reasonCode === "network_error" && desde(n)[0].resultado === "error",
      `la llamada que revienta deja UN evento con su causa — ${desde(n).map(ev).join(" | ") || "(ninguno)"}`);
    ok(!!propagada && /timeout/.test(propagada.message),
      "…y la excepción se propaga INTACTA: el loop de reintentos del oráculo la necesita para reintentar y para el backoff");
    n = EVENTOS.length;
    revienta = "429 rate limit del proveedor";
    try { await handlePlan({ text: "hola", history: [], mem: {}, scenario: "actual", attempt: 0, tenantId: nuevoTenant() }, ENV); } catch { /* esperado */ }
    ok(desde(n)[0].reasonCode === "rate_limited", `un 429 del proveedor se separa de un error de red — ${desde(n).map(ev).join(" | ")}`);
    revienta = null;
  }

  H("[7] UNA LLAMADA, UN EVENTO · la telemetría sigue sirviendo para contar lo que se paga");
  {
    const n = EVENTOS.length;
    await handlePlan({ text: "hola", history: [], mem: {}, scenario: "actual", attempt: 0, tenantId: nuevoTenant() }, ENV);
    await handleNarrateC({ payload: PAYLOAD, mem: {}, attempt: 1, motivoReintento: "cifra-no-autorizada", tenantId: nuevoTenant() }, ENV);
    ok(desde(n).length === 2, `2 llamadas → 2 eventos, ni uno de más (nada de eventos fantasma que inflen el conteo) — ${desde(n).length}`);
    ok(desde(n).every((e) => e.tokens_in === 9000 && e.tokens_out === 120), "y cada uno sigue trayendo su consumo real");
    const noOk = EVENTOS.filter((e) => e.resultado !== "ok");
    ok(noOk.length > 0 && noOk.every((e) => e.reasonCode != null),
      `INVARIANTE · ningún evento con resultado ≠ ok sale sin causa — ${noOk.filter((e) => e.reasonCode == null).length}/${noOk.length} en null`);
    const reintentos = EVENTOS.filter((e) => e.intento >= 1);
    ok(reintentos.length > 0 && reintentos.every((e) => e.reasonCode != null),
      `INVARIANTE · ningún reintento sale sin explicar por qué existe — ${reintentos.filter((e) => e.reasonCode == null).length}/${reintentos.length} en null`);
  }

  // ═══ SEGUNDA PASADA (owner 2026-08-11) · los cuatro defectos que el revisor adversarial midió en rojo ═══════

  H("[8] LOS DOS HANDLERS VIEJOS TAMBIÉN CUENTAN · están en endpoints desplegados y llaman al proveedor PAGO");
  {
    // El gate anterior se titulaba «toda ruta del gateway emite» y sólo aislaba la pareja del oráculo. Estos dos
    // llamaban al proveedor y no dejaban UN evento: la mitad de la superficie que puede gastar era invisible.
    let n = EVENTOS.length;
    const s = await handleSpec({ text: "cuánto vendimos", context: null }, ENV);
    ok(desde(n).length === 1 && desde(n)[0].etapa === "plan" && desde(n)[0].resultado === "ok",
      `SPEC · una lectura al LLM deja UN evento — ${desde(n).map(ev).join(" | ") || "(ninguno)"}`);
    ok((desde(n)[0] || {}).tokens_in === 9000 && (desde(n)[0] || {}).tokens_out === 120, "SPEC · con el consumo real, que es lo que se paga");
    ok(JSON.stringify(Object.keys(s)) === JSON.stringify(["ok", "spec", "usage"]),
      `SPEC · el contrato de retorno del endpoint desplegado NO cambió — ${JSON.stringify(Object.keys(s))}`);

    n = EVENTOS.length;
    const g = await handleNarrate({ text: "hola", evidence: {} }, ENV);
    ok(desde(n).length === 1 && desde(n)[0].etapa === "narrar" && desde(n)[0].resultado === "ok",
      `NARRAR-LEGACY · idem — ${desde(n).map(ev).join(" | ") || "(ninguno)"}`);
    ok(JSON.stringify(Object.keys(g)) === JSON.stringify(["ok", "narration", "usage"]),
      `NARRAR-LEGACY · contrato de retorno intacto — ${JSON.stringify(Object.keys(g))}`);

    // sus frenos propios, que eran `return {ok:false}` crudos
    n = EVENTOS.length;
    const sinTexto = await handleSpec({ text: null }, ENV);
    ok(sinTexto.ok === false && sinTexto.error === "sin texto", "SPEC · el freno sigue frenando igual que siempre");
    ok(desde(n).length === 1 && desde(n)[0].resultado !== "ok" && desde(n)[0].reasonCode != null,
      `SPEC · y ahora deja rastro con causa — ${desde(n).map(ev).join(" | ") || "(ninguno)"}`);
    n = EVENTOS.length;
    const denegado = await handleNarrate({ text: "hola", evidence: {} }, { ...ENV, ADI_TOKEN_SECRET: "s3creto" });
    ok(denegado.access === "denied", "NARRAR-LEGACY · la denegación de acceso sigue siendo la de siempre");
    ok(desde(n).length === 1 && desde(n)[0].resultado !== "ok", `NARRAR-LEGACY · y se puede contar — ${desde(n).map(ev).join(" | ") || "(ninguno)"}`);

    // la llamada PAGA que revienta, en los dos viejos
    revienta = "timeout tras 25000ms esperando al proveedor";
    for (const [etiqueta, fn] of [["SPEC", () => handleSpec({ text: "hola" }, ENV)], ["NARRAR-LEGACY", () => handleNarrate({ text: "hola", evidence: {} }, ENV)]]) {
      n = EVENTOS.length;
      let prop = null;
      try { await fn(); } catch (e) { prop = e; }
      ok(desde(n).length === 1 && desde(n)[0].reasonCode === "network_error" && desde(n)[0].resultado === "error",
        `${etiqueta} · la llamada que revienta deja UN evento con su causa — ${desde(n).map(ev).join(" | ") || "(ninguno)"}`);
      ok(!!prop && /timeout/.test(prop.message), `${etiqueta} · …y la excepción se propaga INTACTA`);
    }
    revienta = null;
  }

  H("[9] LA RESPUESTA INUTILIZABLE YA SE PAGÓ · el desarmado vive dentro del try");
  {
    // El adapter resuelve a undefined/null: antes el TypeError saltaba DESPUÉS de la llamada paga, fuera del try,
    // y el handler se iba sin dejar nada. Es la misma clase que este bloque existe para cerrar.
    const vacias = [["undefined", undefined], ["null", null], ["una cadena", "no soy un objeto"]];
    for (const [etiqueta, valor] of vacias) {
      for (const [paso, fn] of [["PLAN", () => handlePlan({ text: "hola", history: [], mem: {}, scenario: "actual", attempt: 0, tenantId: nuevoTenant() }, ENV)],
        ["NARRAR-C", () => handleNarrateC({ payload: PAYLOAD, mem: {}, attempt: 0, tenantId: nuevoTenant() }, ENV)],
        ["SPEC", () => handleSpec({ text: "hola" }, ENV)],
        ["NARRAR-LEGACY", () => handleNarrate({ text: "hola", evidence: {} }, ENV)]]) {
        devuelveVacio = valor;
        const n = EVENTOS.length;
        let prop = null;
        try { await fn(); } catch (e) { prop = e; }
        ok(desde(n).length === 1 && desde(n)[0].reasonCode != null && desde(n)[0].resultado === "error",
          `${paso} · el proveedor devuelve ${etiqueta} → 1 evento con causa (la llamada ya estaba paga) — ${desde(n).map(ev).join(" | ") || "(ninguno)"}`);
        ok(!!prop, `${paso} · …y el error se propaga: el loop de reintentos se entera igual`);
        devuelveVacio = "__no__";
      }
    }
  }

  H("[10] LA ENTRADA HOSTIL DEL CLIENTE TAMPOCO SE VA MUDA · la red de seguridad del handler entero");
  {
    // No cuesta dinero (revienta antes del proveedor) pero contradecía el invariante declarado: `history` con
    // nulos hacía lanzar al constructor del mensaje ENTRE los frenos y el try, y el handler salía sin emitir.
    const hostiles = [
      ["PLAN · history con turnos nulos", () => handlePlan({ text: "hola", history: [null, undefined], mem: {}, attempt: 0, tenantId: nuevoTenant() }, ENV)],
      ["PLAN · history con un turno cuyo getter revienta", () => handlePlan({ text: "hola", history: [{ get role() { throw new Error("boom role"); } }], mem: {}, attempt: 0, tenantId: nuevoTenant() }, ENV)],
      ["NARRAR-C · payload.modo que revienta al leerse", () => handleNarrateC({ payload: { get modo() { throw new Error("boom modo"); } }, mem: {}, attempt: 0, tenantId: nuevoTenant() }, ENV)],
      ["NARRAR-C · payload.reparacion que revienta al leerse", () => handleNarrateC({ payload: { modo: "default", get reparacion() { throw new Error("boom rep"); } }, mem: {}, attempt: 2, motivoReintento: "cifra-no-autorizada", tenantId: nuevoTenant() }, ENV)],
    ];
    for (const [etiqueta, fn] of hostiles) {
      const n = EVENTOS.length;
      let prop = null;
      try { await fn(); } catch (e) { prop = e; }
      ok(desde(n).length === 1, `${etiqueta} · deja EXACTAMENTE un evento (ni cero, ni dos) — ${desde(n).length}`);
      ok(desde(n).length === 1 && desde(n)[0].reasonCode != null, `${etiqueta} · …y con causa, nunca en null — ${desde(n).map(ev).join(" | ") || "(ninguno)"}`);
      ok(!!prop, `${etiqueta} · la excepción se relanza: la telemetría no se traga un error`);
    }
  }

  H("[11] EL CASO BUENO SIGUE PASANDO · lo que hoy funciona no se rompe, ni se cuenta dos veces");
  {
    // LA REGLA DE LA CASA: un instrumento que rompe turnos buenos hace más daño que la ceguera que venía a
    // arreglar. Cinco llamadas CORRECTAS, una por cada forma que atiende el gateway, medidas de punta a punta.
    const buenos = [
      ["PLAN · turno normal", () => handlePlan({ text: "cuánto vendimos en junio", history: [{ role: "user", content: "hola" }], mem: {}, scenario: "actual", attempt: 0, tenantId: nuevoTenant() }, ENV), "plan"],
      ["PLAN · reintento con causa declarada", () => handlePlan({ text: "cuánto vendimos", history: [], mem: {}, scenario: "actual", attempt: 1, motivoReintento: "invalid_plan", tenantId: nuevoTenant() }, ENV), "plan"],
      ["NARRAR-C · turno normal", () => handleNarrateC({ payload: PAYLOAD, mem: {}, attempt: 0, tenantId: nuevoTenant() }, ENV), "narrar"],
      ["SPEC · lectura al LLM", () => handleSpec({ text: "margen por marca", context: null }, ENV), "plan"],
      ["NARRAR-LEGACY · narración de evidencia", () => handleNarrate({ text: "hola", evidence: { transform: null } }, ENV), "narrar"],
    ];
    for (const [etiqueta, fn, etapa] of buenos) {
      const n = EVENTOS.length;
      let r = null, prop = null;
      try { r = await fn(); } catch (e) { prop = e; }
      ok(!prop, `${etiqueta} · NO lanza (la instrumentación no puede tumbar un turno que funcionaba)`, prop && prop.message);
      ok(!!r && r.ok === true, `${etiqueta} · devuelve ok:true, igual que siempre`);
      ok(desde(n).length === 1 && desde(n)[0].resultado === "ok" && desde(n)[0].etapa === etapa,
        `${etiqueta} · UN evento, resultado ok (la red de seguridad NO duplica el evento del camino feliz) — ${desde(n).map(ev).join(" | ")}`);
    }
    // y un intento 0 correcto no se inventa una causa: el campo sigue en null para el que salió bien de una
    const n = EVENTOS.length;
    await handlePlan({ text: "hola", history: [], mem: {}, scenario: "actual", attempt: 0, tenantId: nuevoTenant() }, ENV);
    ok(desde(n)[0].resultado === "ok" && desde(n)[0].reasonCode === null,
      `una llamada buena de primera no arrastra ninguna causa — ${desde(n).map(ev).join(" | ")}`);
    // el freno de rate limit sigue frenando en PLAN también (el gate anterior sólo lo ejercitaba en NARRAR)
    const tp = nuevoTenant(), envRate = { ...ENV, LLM_RATE_MAX_PER_WINDOW: "1" };
    await handlePlan({ text: "hola", history: [], mem: {}, scenario: "actual", attempt: 0, tenantId: tp }, envRate);
    const n2 = EVENTOS.length;
    const rl = await handlePlan({ text: "hola", history: [], mem: {}, scenario: "actual", attempt: 0, tenantId: tp }, envRate);
    ok(rl.ok === false && rl.error === "rate_limited" && desde(n2).length === 1 && desde(n2)[0].reasonCode === "rate_limited",
      `PLAN · el freno de rate limit frena y emite igual que el de NARRAR — ${desde(n2).map(ev).join(" | ") || "(ninguno)"}`);
  }
} finally {
  ADAPTERS.openai.parse = orig.parse;
  ADAPTERS.openai.narrate = orig.narrate;
  setSink(null);
}

console.log(`\n── CAUSA Y COSTO EN EL GATEWAY · ${PASS} PASS · ${FAIL} FAIL (de ${PASS + FAIL}) ──`);
process.exit(FAIL ? 1 : 0);
