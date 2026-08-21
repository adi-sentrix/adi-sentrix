/* === _causa_rechazo_deterministico_gate.mjs · UN RECHAZO SIN CAUSA NO SE PUEDE CONTAR NI CORREGIR ==============
 * LOCAL, NO commiteado (convención del repo: _*_gate.mjs es local). CERO red, CERO LLM.
 *
 * EL DEFECTO QUE PROTEGE (medido en la corrida de certificación): 10 eventos de telemetría decían «rechazado» con
 * la causa en NULL. El emisor es el batch determinístico de answerViaOracle.js, que armaba
 * `resultado: results.some(...) ? "ok" : "rechazado"` y no pasaba motivo — teniendo `unsupported` (lo que runPlan
 * ya calculó sobre por qué cada call no cubrió) desestructurado ocho líneas más arriba, sin usar. Un rechazo sin
 * causa es un número que nadie puede accionar: no se sabe si el plan pidió una tool que no existe, si el dato no
 * cubre el eje, o si el turno ni siquiera pidió nada.
 *
 * LO QUE AFIRMA, y son DOS cosas que se tiran una contra la otra:
 *   1. EL INVARIANTE · todo evento determinístico no-ok trae un `reasonCode`. Ninguno vuelve a salir en null.
 *   2. EL CANDADO DE PRIVACIDAD · ese reasonCode es SIEMPRE un literal de la lista cerrada de telemetry.js, y
 *      NADA del texto de `unsupported[].reason` cruza al evento. Eso importa de verdad: esas razones nombran
 *      entidades del cliente («no encuentro 'X' en el eje 'cliente'», «"Rotación" no se mide por cliente»). La
 *      forma cómoda de cerrar el defecto —mandar la frase y que el mapa de telemetry.js la clasifique— habría
 *      cerrado el hueco de la causa abriendo uno de datos. El gate prueba las dos mitades, no una.
 *
 * MUTACIÓN QUE LO PONE EN ROJO: sacar `reasonCode` del `emitTelemetria` del batch (volver al emisor de antes) →
 * cae la sección 2 entera. Devolver `unsupported[0].reason` en vez del código → cae la sección 3 entera.
 *
 * @inyeccion-simulada — este gate le pasa a `answerViaOracle` sus DOS pasadas (PLAN y NARRAR) como funciones
 * locales definidas en este mismo archivo. No importa el gateway ni un adapter, no importa nada de `src/ui/` y no
 * contiene una salida cruda. Cumple las cuatro condiciones del escape declarado en scripts/gates-offline.mjs.
 */
import { answerViaOracle } from "./src/adi/oracle/answerViaOracle.js";
import { setSink, REASON_CODES, CAMPOS_TELEMETRIA } from "./src/adi/llm/telemetry.js";
import { runPlan } from "./src/adi/oracle/toolRunner.js";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";

// vía 1 (2026-08-20): el dataset se DECLARA acá. Antes se heredaba del import por defecto de tenantStore,
// que ya no existe: el store arranca en la forma vacía y el dato entra por initTenant. Ver tenantEmpty.js.
initTenant(TENANT_DEMO);

let pass = 0, fail = 0;
const ok = (cond, label, detail) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label}${detail !== undefined ? ` — obtuvo ${detail}` : ""}`); }
};
const seccion = (t) => console.log(`\n── ${t} ──`);

const eventos = [];
setSink((ev) => eventos.push(ev));
const deterministicos = () => eventos.filter((e) => e && e.etapa === "deterministica");

let _n = 0;
const SAFES = [
  "Ese frente no muestra desvíos que ameriten una alerta en este momento.",
  "La lectura general del período no cambia respecto de lo que veníamos conversando.",
  "Sin novedades relevantes en ese ángulo del negocio durante el período consultado.",
  "El comportamiento observado se mantiene dentro de lo esperable para esa cuenta.",
];
async function turno(text, calls, extraPlan = {}) {
  eventos.length = 0;
  await answerViaOracle({
    text, history: [], mem: {}, scenario: "actual",
    callPlan: async () => ({ intent: "answer", mode: "default", calls, ...extraPlan }),
    callNarrate: async () => SAFES[_n++ % SAFES.length],
  });
  return deterministicos();
}

// LOS CUATRO CAMINOS por los que el batch se va sin evidencia. Ninguno es inventado: los tres primeros salen del
// propio runPlan (tool inexistente · el dato no cubre el eje · la entidad no está) y el cuarto es el plan vacío.
const CASOS = [
  { nombre: "el plan nombra una tool que el motor no tiene",
    text: "¿cómo viene el negocio?", calls: [{ tool: "informeTrimestralCompleto", args: {} }], esperado: "invalid_plan" },
  { nombre: "el plan no dejó NINGUNA call que ejecutar",
    text: "gracias", calls: [], esperado: "invalid_plan" },
  { nombre: "la tool corrió y el DATO no cubre ese eje",
    text: "ordename los clientes por rotación", calls: [{ tool: "gridTable", args: { dimension: "cliente", sortBy: "rotacion", dir: "desc", limit: 3 } }], esperado: "unknown" },
  { nombre: "la entidad que el plan nombró no existe en el eje",
    text: "¿cuánto vende Comercial Zeta?", calls: [{ tool: "entityRecord", args: { dimension: "cliente", entity: "Comercial Zeta" } }], esperado: "unknown" },
];

// ════════════════════════════════════════════════════════════════════════════════════════════════════════════
seccion("1 · PRECONDICIÓN · los cuatro casos son de verdad rechazos del batch (no un arnés que se los inventa)");
for (const c of CASOS) {
  const evs = await turno(c.text, c.calls);
  ok(evs.length === 1, `[${c.nombre}] el batch emite exactamente un evento determinístico`, evs.length);
  ok(evs[0] && evs[0].resultado === "rechazado", `[${c.nombre}] y ese evento dice "rechazado"`, evs[0] && evs[0].resultado);
}

// ════════════════════════════════════════════════════════════════════════════════════════════════════════════
seccion("2 · EL INVARIANTE · ningún evento no-ok vuelve a salir con la causa en NULL");
for (const c of CASOS) {
  const evs = await turno(c.text, c.calls);
  const ev = evs[0];
  ok(!!ev && ev.reasonCode != null, `[${c.nombre}] trae reasonCode (nunca null)`, ev && JSON.stringify(ev.reasonCode));
  ok(!!ev && REASON_CODES.includes(ev.reasonCode), `[${c.nombre}] y el valor es un literal de la lista cerrada`, ev && JSON.stringify(ev.reasonCode));
  ok(!!ev && ev.reasonCode === c.esperado, `[${c.nombre}] clasifica como "${c.esperado}"`, ev && JSON.stringify(ev.reasonCode));
}
// el control simétrico: un turno que SÍ cubrió no inventa una causa que no existe.
{
  const evs = await turno("¿cómo viene el negocio?", [{ tool: "executiveSummary", args: {} }]);
  ok(evs[0] && evs[0].resultado === "ok", "control: un turno con cobertura sale ok", evs[0] && evs[0].resultado);
  ok(evs[0] && evs[0].reasonCode == null, "control: y NO se le cuelga una causa a un turno que no fue rechazado", evs[0] && JSON.stringify(evs[0].reasonCode));
}

// ════════════════════════════════════════════════════════════════════════════════════════════════════════════
seccion("3 · EL CANDADO DE PRIVACIDAD · ni una palabra de la razón real cruza al evento");
{
  // Se toma la razón REAL que el motor produce para el caso más comprometedor (nombra la entidad que el usuario
  // escribió) y se verifica que ninguna de sus palabras aparezca en ningún campo del evento.
  const { unsupported } = runPlan({ intent: "answer", calls: [{ tool: "entityRecord", args: { dimension: "cliente", entity: "Comercial Zeta" } }] }, { scenario: "actual" });
  const razonReal = String((unsupported[0] && unsupported[0].reason) || "");
  ok(/Comercial Zeta/.test(razonReal), "precondición: la razón que el motor calcula SÍ nombra la entidad del cliente", JSON.stringify(razonReal));

  const evs = await turno("¿cuánto vende Comercial Zeta?", [{ tool: "entityRecord", args: { dimension: "cliente", entity: "Comercial Zeta" } }]);
  const serializado = JSON.stringify(evs[0] || {});
  ok(!/Comercial|Zeta/i.test(serializado), "el evento no contiene el nombre de la entidad por ningún campo", serializado);
  const palabras = razonReal.toLowerCase().replace(/[^a-záéíóúñ\s]/g, " ").split(/\s+/).filter((w) => w.length >= 5);
  const filtradas = palabras.filter((w) => serializado.toLowerCase().includes(w));
  ok(!filtradas.length, "ninguna palabra de la razón real sobrevive en el evento (la causa viaja como código, no como frase)", filtradas.join(" · "));
  ok(evs[0] && Object.keys(evs[0]).every((k) => CAMPOS_TELEMETRIA.includes(k)),
    "y el evento no trae ningún campo fuera de los declarados en telemetry.js", evs[0] && Object.keys(evs[0]).join(","));
}

// ════════════════════════════════════════════════════════════════════════════════════════════════════════════
seccion("4 · LA CLASIFICACIÓN ES CONTRA EL REGISTRO REAL, no contra una lista escrita a mano acá");
{
  // Una tool REAL del registro que declina no puede clasificarse como `invalid_plan`: el plan estaba bien, lo que
  // no alcanzó fue el dato. Si alguien reemplazara el chequeo de registro por una lista copiada, este caso se
  // volvería `invalid_plan` en cuanto la lista quedara vieja.
  const evs = await turno("ordename las marcas por días sin venta", [{ tool: "gridTable", args: { dimension: "marca", sortBy: "diasSinVenta", dir: "desc", limit: 3 } }]);
  ok(evs[0] && evs[0].reasonCode === "unknown", "una tool REAL que declina NO se acusa de plan inválido", evs[0] && evs[0].reasonCode);
  ok(evs[0] && Array.isArray(evs[0].tools) && evs[0].tools.includes("gridTable"), "y la tool ejecutada sigue viajando (la causa no reemplaza al resto de la observación)", evs[0] && JSON.stringify(evs[0].tools));
}

setSink(null);
console.log(`\n── _causa_rechazo_deterministico_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
