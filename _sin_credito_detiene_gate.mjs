/* === _sin_credito_detiene_gate.mjs · UN 429 SIN CRÉDITO NO ES UN RATE LIMIT (owner 2026-08-11) ================
 * @inyeccion-simulada — `answerViaOracle` con `callPlan`/`callNarrate` a mano. No importa el gateway ni un
 * adapter de red, no contiene `fetch(`, no importa `src/ui/`. Cero red, cero llamadas pagadas.
 *
 * ── EL DEFECTO (número 1 de la certificación final) ───────────────────────────────────────────────────────────
 * La cuenta se quedó sin saldo a mitad de la corrida. El proveedor devolvió 429 con `type:"insufficient_quota"`
 * y el motor lo trató como rate-limit transitorio: reintentó tres veces por turno, escaló de modelo y siguió con
 * los 26 turnos siguientes.
 * COSTO MEDIDO: 65 de las 120 llamadas pagadas se quemaron contra una API que no iba a responder nunca, la
 * corrida tocó el tope por consumo inútil, y 26 turnos quedaron registrados como fallidos SIN HABERSE EJECUTADO
 * — que es peor que no medirlos, porque contamina el resultado con fallas que ADI no cometió.
 *
 * LA DIFERENCIA ES CATEGÓRICA: un rate-limit se resuelve esperando; la falta de crédito no se resuelve sola.
 * Reintentar es tirar dinero; escalar de modelo es tirar más. La única conducta correcta es cortar.
 *
 * `node --import ./scripts/offline-guard.mjs _sin_credito_detiene_gate.mjs`
 */
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { answerViaOracle, _esSinCredito } from "./src/adi/oracle/answerViaOracle.js";

initTenant(TENANT_DEMO);
let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };
const H = (t) => console.log("\n" + t);

// el cuerpo EXACTO que devolvió OpenAI en la corrida del 2026-08-11.
const CUERPO_REAL = `HTTP 429: {\n "error": {\n  "message": "You have no credits remaining. Add credits to continue using the API at https://platform.openai.com/settings/organization/billing/.",\n  "type": "insufficient_quota",\n  "param": null,\n`;
const errSinCredito = () => { const e = new Error(CUERPO_REAL); e.code = "billing_exhausted"; e.fatal = true; return e; };
const errRateLimit = () => { const e = new Error("HTTP 429: Rate limit reached for gpt-4o-mini"); e.code = "rate_limited"; e.retryAfterMs = 5; return e; };

H("[1] EL ADAPTER DISTINGUE LAS DOS CLASES DE 429");
{
  ok(_esSinCredito(errSinCredito()), "un 429 con `insufficient_quota` se reconoce como falta de crédito");
  ok(!_esSinCredito(errRateLimit()), "un 429 de rate-limit NO se confunde con falta de crédito");
  // el respaldo por texto existe para un adapter que todavía no etiquete: falla ABIERTA hacia lo viejo.
  ok(_esSinCredito(new Error('{"type":"insufficient_quota"}')), "sin código, el texto del proveedor todavía la reconoce");
  ok(!_esSinCredito(new Error("timeout tras 25000ms")), "un timeout no es falta de crédito");
  ok(!_esSinCredito(null) && !_esSinCredito(undefined), "sin error no hay falsa alarma");
}

H("[2] EXACTAMENTE UNA LLAMADA · no reintenta y no escala de modelo");
{
  let llamadas = 0, modelos = [];
  let lanzo = null;
  try {
    await answerViaOracle({
      text: "¿cuánto vende Falabella?", history: [], mem: {}, scenario: "bonanza",
      callPlan: async (a) => { llamadas++; modelos.push(a.attempt); throw errSinCredito(); },
      callNarrate: async () => { llamadas++; return "no debería llegar acá"; },
    });
  } catch (e) { lanzo = e; }
  ok(llamadas === 1, `se envió UNA sola llamada (se enviaron ${llamadas})`);
  ok(modelos.length === 1 && modelos[0] === 0, `no escaló de modelo: el único intento fue el tier base (attempts=${JSON.stringify(modelos)})`);
  ok(!!lanzo && _esSinCredito(lanzo), "el error se PROPAGA al caller para que detenga la corrida, en vez de abstenerse en silencio");
}

H("[3] CONTROL · un rate-limit transitorio SIGUE reintentando (no se rompió el backoff)");
{
  let llamadas = 0;
  let r = null;
  try {
    r = await answerViaOracle({
      text: "¿cuánto vende Falabella?", history: [], mem: {}, scenario: "bonanza",
      callPlan: async () => { llamadas++; throw errRateLimit(); },
      callNarrate: async () => "narración",
    });
  } catch { /* el rate-limit agota los 3 y se abstiene, no propaga */ }
  ok(llamadas === 3, `un 429 transitorio agota los 3 intentos como siempre (se enviaron ${llamadas})`);
  ok(r === null || !r, "y termina en abstención, no en excepción");
}

H("[4] LO YA RESPONDIDO SE CONSERVA · el corte no borra el turno anterior");
{
  let fase = 0;
  const mem0 = {};
  const bueno = await answerViaOracle({
    text: "¿cuánto vende Falabella?", history: [], mem: mem0, scenario: "bonanza",
    callPlan: async () => ({ intent: "answer", calls: [{ tool: "entityRecord", args: { dimension: "cliente", entity: "Falabella" } }] }),
    callNarrate: async () => "Falabella vende $19.4M en el año cerrado.",
  });
  ok(!!(bueno && bueno.r && bueno.r.text), "el turno previo respondió");
  fase = 1;
  let lanzo = null;
  try {
    await answerViaOracle({
      text: "¿y Lider?", history: [], mem: (bueno && bueno.mem) || {}, scenario: "bonanza",
      callPlan: async () => { if (fase) throw errSinCredito(); return null; },
      callNarrate: async () => "no llega",
    });
  } catch (e) { lanzo = e; }
  ok(!!lanzo, "el turno siguiente corta");
  ok(!!(bueno && bueno.r && bueno.r.text), "…y el resultado del turno anterior sigue intacto (no se pierde lo ya medido)");
}

console.log(`\n── _sin_credito_detiene_gate: ${PASS} PASS · ${FAIL} FAIL (de ${PASS + FAIL}) ──`);
process.exit(FAIL ? 1 : 0);
