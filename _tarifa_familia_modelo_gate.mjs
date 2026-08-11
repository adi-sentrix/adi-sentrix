/* === _tarifa_familia_modelo_gate.mjs · EL PRECIO SE RESUELVE POR FAMILIA (owner 2026-08-11) ============
 * Cero red, cero proveedor, cero crédito: importa UNA función pura (src/adi/llm/modelPricing.js) y la ejerce.
 *
 * EL HECHO QUE LO MOTIVA: en la corrida pagada el cerrojo monetario contó US$1,2908 y el gasto real fue
 * US$1,4223. La diferencia —US$0,1315— son exactamente las 72 llamadas del modelo base. La tabla tenía la clave
 * "gpt-4o-mini" y el proveedor respondía "gpt-4o-mini-2024-07-18": el lookup por clave EXACTA no encontraba nada,
 * devolvía null, y todo llamador que hace `|| 0` convertía "no sé cuánto costó" en "costó cero". Una corrida
 * entera del modelo base se contabilizaba en US$0,00 y el tope en dólares nunca frenaba.
 *
 * POR QUÉ NINGÚN GATE LO CAZÓ: los dos que tocan el tema estaban VERDES con producción rota. _model_router_gate
 * sección 10 sólo prueba claves LITERALES (las que el router ELIGE), nunca el id que el proveedor DEVUELVE; y
 * _cerrojo_certificacion_gate alimenta el tope con costos escritos a mano, sin llamar jamás al tarifador. Este
 * gate cubre justo el hueco: los ids REALES, y la regla completa, no el caso medido.
 *
 *   [1] LA FAMILIA, NO LA CADENA · toda forma de nombrar un modelo tarifa igual que su clave — y para las CUATRO
 *       familias de la tabla, no sólo la que falló: si mañana se agrega una quinta, la regla la cubre sola.
 *   [2] NUNCA INVENTA UN PRECIO · un modelo que sólo COMPARTE PREFIJO es otro modelo, con otra tarifa: null.
 *   [3] UN COSTO DESCONOCIDO ES RUIDOSO · queda registrado y avisa. Nunca un cero silencioso.
 *   [4] SIN `usage` TAMPOCO ES CERO · la llamada que el proveedor generó y facturó sin devolver conteo.
 *   [5] LA ARITMÉTICA DE LA CORRIDA MEDIDA · las cifras exactas del incidente, tarifadas de nuevo.
 *   [6] EL CONTRATO VIEJO, INTACTO · lo que ya afirmaban otros gates sigue siendo verdad.
 */
import { MODEL_PRICING, estimateCostUSD, costoLlamadaUSD, resolvePricingKey, ESTADO_COSTO,
  modelosSinPrecio, modelosSinUsage, olvidarNoTarifados } from "./src/adi/llm/modelPricing.js";

let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };
const H = (t) => console.log("\n" + t);
const USO = { input_tokens: 10000, output_tokens: 500 };
const casi = (a, b) => a != null && b != null && Math.abs(a - b) < 1e-12;
// silencia (y captura) los avisos del tarifador para poder afirmar que EXISTEN, sin ensuciar la salida del gate
function conAvisos(fn) {
  const orig = console.warn, avisos = [];
  console.warn = (...a) => avisos.push(a.join(" "));
  try { fn(); } finally { console.warn = orig; }
  return avisos;
}

H("[1] LA FAMILIA, NO LA CADENA · las CUATRO familias de la tabla, con todas las formas en que un id puede llegar");
{
  // La regla no se prueba sobre el caso medido: se prueba sobre TODA la tabla. Cada familia se somete a las seis
  // formas en que un id realmente aparece en producción — y todas tienen que dar EL MISMO número que la clave.
  const formas = (k) => [
    [`${k}-2024-07-18`, "snapshot fechado (lo que el proveedor devuelve de verdad)"],
    [`${k}-2026-05-01`, "snapshot de otra fecha (el día que ops pinee otra versión)"],
    [`${k}-20260501`, "snapshot compacto, sin guiones"],
    [`${k}-latest`, "alias «latest» del mismo modelo"],
    [`openai/${k}`, "con prefijo de proveedor (el proveedor viaja en su propio campo)"],
    [k.toUpperCase(), "otra caja: un id es un id, no una contraseña"],
  ];
  for (const clave of Object.keys(MODEL_PRICING)) {
    const base = estimateCostUSD(clave, USO);
    for (const [id, porQue] of formas(clave)) {
      ok(casi(estimateCostUSD(id, USO), base) && resolvePricingKey(id) === clave,
        `"${id}" tarifa como "${clave}" — ${porQue}`,
        `familia=${resolvePricingKey(id)} costo=${estimateCostUSD(id, USO)} vs ${base}`);
    }
  }
  // EL CASO MEDIDO y los DOS que el diagnóstico señaló como los peores (el escalamiento por reintento es el
  // dinero grande: US$2/US$12 y US$5/US$30 por millón). Los tres son la MISMA regla, no tres parches.
  ok(casi(estimateCostUSD("gpt-4o-mini-2024-07-18", USO), estimateCostUSD("gpt-4o-mini", USO)),
    "el id EXACTO de las 72 llamadas de la corrida ya no queda mudo");
  ok(estimateCostUSD("gpt-5.6-terra-2026-05-01", USO) > 0 && estimateCostUSD("gpt-5.6-sol-2026-05-01", USO) > 0,
    "los dos tiers de escalamiento (los más caros) tarifan con snapshot fechado: ahí está el dinero grande");
  // EL PEDIDO Y EL EFECTIVO SON LA MISMA LLAMADA: los llamadores usan campos distintos (la UI el que se PIDIÓ, el
  // arnés el que RESPONDIÓ). Con el precio resuelto por familia, los dos dan el mismo número — que era el punto.
  ok(casi(estimateCostUSD("gpt-4o-mini", USO), estimateCostUSD("gpt-4o-mini-2024-07-18", USO)),
    "el id PEDIDO y el id EFECTIVO de una misma llamada tarifan idéntico: ya no hay dos verdades para un mismo gasto");
}

H("[2] NUNCA INVENTA UN PRECIO · compartir prefijo no es ser de la familia");
{
  // El riesgo del arreglo fácil: un match por prefijo haría que un futuro "gpt-4o-mini-turbo" —otro modelo, otra
  // tarifa— heredara en silencio la de gpt-4o-mini. Un tope calculado con un precio equivocado es MÁS peligroso
  // que uno que corta por desconocido. Sólo se acepta lo que demostrablemente no cambia el modelo tarifado.
  const impostores = [
    ["gpt-4o-mini-turbo", "otro modelo de la misma línea, tarifa distinta"],
    ["gpt-4o-mini-hd", "sufijo de capacidad, no de fecha"],
    ["gpt-5.6-terra-xl", "el mismo truco sobre el tier caro"],
    ["gpt-4o-mini-2024-07", "fecha incompleta: no es un snapshot válido"],
    ["gpt-4o-mini-latest-preview", "cadena de sufijos: no se pela hasta que dé"],
    ["gpt-4o", "prefijo de la clave, pero modelo DISTINTO (y más caro)"],
    ["modelo-inexistente-xyz", "control: el id que _model_router_gate ya exigía en null"],
  ];
  for (const [id, porQue] of impostores)
    ok(resolvePricingKey(id) === null && estimateCostUSD(id, USO) === null, `"${id}" → null — ${porQue}`);
}

H("[3] UN COSTO DESCONOCIDO ES RUIDOSO · nunca un cero silencioso");
{
  olvidarNoTarifados();
  const avisos = conAvisos(() => {
    estimateCostUSD("claude-opus-4-1-20250805", USO);      // otro proveedor: esta tabla no lo tarifa
    estimateCostUSD("claude-opus-4-1-20250805", USO);      // dos veces: se cuenta, se avisa una sola vez
    estimateCostUSD("gemini-9-ultra", USO);                // una familia distinta, de otro proveedor todavía
    estimateCostUSD("gpt-4o-mini", USO);                   // control: lo conocido no ensucia el registro
  });
  const reg = modelosSinPrecio();
  ok(reg.length === 2, `el registro nombra EXACTAMENTE los ids que no supo tarifar — ${JSON.stringify(reg)}`);
  ok(reg.some((x) => x.modelo === "claude-opus-4-1-20250805" && x.veces === 2), "y cuenta cuántas llamadas quedaron sin tarifar");
  ok(!reg.some((x) => x.modelo === "gpt-4o-mini"), "un modelo con precio conocido NO entra al registro");
  ok(avisos.length === 2 && avisos.every((a) => /SIN PRECIO CONOCIDO/.test(a)),
    `avisa una vez por id, no una por llamada — ${avisos.length} aviso(s)`);
  ok(avisos.every((a) => /no es un costo cero/i.test(a)), "el aviso dice la consecuencia, no sólo el síntoma");
  // LA AFIRMACIÓN CENTRAL: desconocido ≠ 0. Un cero es una afirmación sobre el gasto; null es la ausencia de una.
  ok(estimateCostUSD("claude-opus-4-1-20250805", USO) !== 0, "un modelo desconocido NO tarifa 0");
  ok(costoLlamadaUSD("claude-opus-4-1-20250805", USO).estado === ESTADO_COSTO.SIN_PRECIO,
    "y el estado lo dice con nombre propio, para que el llamador no tenga que adivinar qué significa un null");
  ok(costoLlamadaUSD("claude-opus-4-1-20250805", USO).usd === null, "sin número que se pueda sumar por accidente");
  olvidarNoTarifados();
  ok(modelosSinPrecio().length === 0, "el registro se puede reiniciar: cada corrida cuenta lo suyo");
}

H("[4] SIN `usage` TAMPOCO ES CERO · la segunda vía por la que entraba gasto real como US$0,00");
{
  // 6 de las 105 llamadas pagadas de la corrida murieron en timeout contra el proveedor: éste las generó (y muy
  // probablemente las facturó), pero el cliente nunca recibió el conteo de tokens. El llamador las sumaba como 0.
  olvidarNoTarifados();
  const avisos = conAvisos(() => { estimateCostUSD("gpt-4o-mini-2024-07-18", null); estimateCostUSD("gpt-5.6-sol", undefined); });
  const c = costoLlamadaUSD("gpt-4o-mini", null);
  ok(c.usd === null && c.estado === ESTADO_COSTO.SIN_USAGE, `«sin conteo» es un estado propio, distinto de «sin precio» — ${JSON.stringify(c)}`);
  ok(c.familia === "gpt-4o-mini", "…y aun así se sabe QUÉ familia era: el precio se conoce, lo que falta es el consumo");
  ok(modelosSinUsage().length === 2 && avisos.length === 2, `queda registrado y avisa, igual que el otro caso — ${JSON.stringify(modelosSinUsage())}`);
  ok(estimateCostUSD("gpt-4o-mini", null) !== 0, "una llamada sin conteo NO tarifa 0");
  // UN OBJETO VACÍO NO ES CONSUMO CERO: era un número (0 exacto) donde correspondía "no sé". Mismo cero silencioso.
  ok(estimateCostUSD("gpt-4o-mini", {}) === null && costoLlamadaUSD("gpt-4o-mini", {}).estado === ESTADO_COSTO.SIN_USAGE,
    "un `usage` presente pero sin ningún conteo utilizable tampoco tarifa 0");
  ok(estimateCostUSD("gpt-4o-mini", { cachedTokens: 7600 }) === null, "…ni siquiera si trae otros campos del proveedor");
  // LAS DOS FORMAS DE `usage` QUE CIRCULAN EN EL REPO (telemetry.js acepta las dos, el tarifador leía UNA):
  // un conteo real escrito con las claves de la otra forma daba US$0,00 exacto, y nadie podía notarlo.
  const crudo = estimateCostUSD("gpt-4o-mini", { prompt_tokens: 10000, completion_tokens: 500 });
  ok(casi(crudo, estimateCostUSD("gpt-4o-mini", USO)), `la forma cruda del proveedor tarifa igual que la normalizada — US$${crudo}`);
  ok(crudo !== 0, "…y sobre todo NO tarifa 0: un consumo real escrito con otras claves no es consumo nulo");
  olvidarNoTarifados();
}

H("[5] LA ARITMÉTICA DE LA CORRIDA MEDIDA · las cifras exactas del incidente");
{
  // Totales REALES de la corrida pagada (telemetria.jsonl, agregado por modelo efectivo). No se inventa un token.
  const base = estimateCostUSD("gpt-4o-mini-2024-07-18", { input_tokens: 829443, output_tokens: 11859 });
  const terra = estimateCostUSD("gpt-5.6-terra", { input_tokens: 271547, output_tokens: 9484 });
  const sol = estimateCostUSD("gpt-5.6-sol", { input_tokens: 94566, output_tokens: 5368 });
  ok(base != null && Math.abs(base - 0.1315) < 5e-5, `las 72 llamadas del modelo base valen US$${base && base.toFixed(4)}, no US$0,00`);
  ok(Math.abs((terra + sol) - 1.2908) < 5e-5, `los dos tiers que SÍ se contaban siguen dando lo mismo — US$${(terra + sol).toFixed(4)} (el "gasto: US$1.2908" del log)`);
  ok(Math.abs((base + terra + sol) - 1.4223) < 5e-5,
    `el total ahora cierra con el gasto REAL de la corrida — US$${(base + terra + sol).toFixed(4)} vs US$1,4223`);
  ok(base > 0.05, "y ese faltante solo ya supera el tope de US$0,05 de una certificación chica: no era un redondeo");
}

H("[6] EL CONTRATO VIEJO, INTACTO · lo que otros gates ya afirmaban sigue siendo verdad");
{
  const exacto = estimateCostUSD("gpt-4o-mini", { input_tokens: 1000000, output_tokens: 1000000 });
  ok(casi(exacto, MODEL_PRICING["gpt-4o-mini"].in + MODEL_PRICING["gpt-4o-mini"].out), `1M in + 1M out = in+out — ${exacto}`);
  ok(estimateCostUSD("gpt-4o-mini", { input_tokens: 0, output_tokens: 0 }) === 0, "usage con ceros → 0 exacto, NO null (el objeto es truthy y el consumo es real: cero)");
  ok(estimateCostUSD("gpt-4o-mini", null) === null && estimateCostUSD("gpt-4o-mini", undefined) === null, "usage ausente → null");
  ok(estimateCostUSD("modelo-inexistente-xyz", USO) === null, "modelo sin precio conocido → null (nunca inventa un precio)");
  ok(resolvePricingKey(null) === null && resolvePricingKey(undefined) === null && resolvePricingKey(42) === null && resolvePricingKey("") === null,
    "un id que no es un id no revienta ni resuelve a nada");
  ok(Object.keys(MODEL_PRICING).every((k) => resolvePricingKey(k) === k), "toda clave de la tabla se resuelve a sí misma");
  ok(Object.keys(MODEL_PRICING).length === 4, `la tabla no cambió de contenido: sigue con sus ${Object.keys(MODEL_PRICING).length} familias verificadas`);
}

console.log(`\n── TARIFA POR FAMILIA DE MODELO · ${PASS} PASS · ${FAIL} FAIL ──`);
process.exit(FAIL ? 1 : 0);
