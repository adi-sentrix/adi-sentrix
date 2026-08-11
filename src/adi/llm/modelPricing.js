/* === src/adi/llm/modelPricing.js · precios verificados por modelo (USD por 1M tokens) ===
 * Única fuente de precio para el router (modelRouter.js) y para la telemetría de costo por turno (ChatADI.jsx).
 * Verificado 2026-08-02 (2 fuentes independientes, cloudzero.com + benchlm.ai, coinciden exacto) — mismo
 * _model_comparison.mjs que midió calidad/latencia/costo real contra el pipeline de producción.
 *
 * ── EL PRECIO SE RESUELVE POR FAMILIA, NO POR CADENA EXACTA (owner 2026-08-11) ────────────────────────────────
 * POR QUÉ: en la corrida pagada el cerrojo monetario contó US$1,2908 y el gasto real fue US$1,4223. La diferencia
 * son exactamente las 72 llamadas del modelo base. La tabla tiene la clave "gpt-4o-mini", pero el proveedor NO
 * responde con el alias que se pidió: responde con el snapshot fechado "gpt-4o-mini-2024-07-18". El lookup era por
 * clave EXACTA, no encontraba nada, devolvía null — y todo llamador que hace `|| 0` convierte "no sé cuánto costó"
 * en "costó cero". Una corrida entera del modelo base se contabilizaba en US$0,00 y el tope en dólares no frenaba
 * nunca. El defecto no es de una pregunta ni de un modelo: es de la REGLA DE LOOKUP, y alcanza a toda llamada cuyo
 * id no sea literalmente una clave de esta tabla (snapshot del proveedor, alias pineado por ops, prefijo de
 * proveedor, otra caja). Por eso la corrección es de clase: el id se NORMALIZA a su familia y ahí se busca.
 *
 * QUÉ NO HACE: NUNCA inventa un precio (la regla de siempre, ahora explícita). La normalización acepta sólo lo que
 * demostrablemente no cambia el modelo tarifado — sufijo de snapshot fechado, "-latest", prefijo de proveedor y
 * caja— y JAMÁS un prefijo libre: un futuro "gpt-4o-mini-turbo" es OTRO modelo, con otra tarifa, y tiene que
 * quedar sin precio. Un tope calculado con un precio equivocado es más peligroso que uno que corta por desconocido.
 *
 * UN COSTO DESCONOCIDO NO ES UN COSTO CERO. Los dos casos que dejaban dinero afuera se separan y se hacen
 * RUIDOSOS (`modelosSinPrecio` / `modelosSinUsage` + un aviso por consola la primera vez que aparece cada id):
 *   · modelo sin precio conocido  — p.ej. cualquier id de otro proveedor: esta tabla no lo tarifa y lo dice.
 *   · llamada sin `usage`         — los 6 timeouts de la corrida: el proveedor generó (y facturó) la respuesta,
 *                                   el cliente nunca recibió el conteo. Contarlas en 0 es la misma mentira.
 * `estimateCostUSD` mantiene su contrato de siempre (número | null) para no romper a sus llamadores; quien pueda
 * distinguir los tres estados debe usar `costoLlamadaUSD`, que los devuelve tipados y no se puede aplanar con `|| 0`.
 */
export const MODEL_PRICING = {
  "gpt-4o-mini": { in: 0.15, out: 0.60 },
  "gpt-5.6-luna": { in: 0.20, out: 1.20 },
  "gpt-5.6-terra": { in: 2.00, out: 12.00 },
  "gpt-5.6-sol": { in: 5.00, out: 30.00 },
};

// LO ÚNICO QUE SE PUEDE QUITAR de un id para encontrar su familia. Cada forma está acá porque NO cambia el modelo
// que se tarifa: un snapshot es la versión fechada del mismo alias ("gpt-4o-mini-2024-07-18"), y "-latest" es ese
// mismo alias apuntando a la última. Nada de esto es un prefijo libre: "-turbo" o "-mini-hd" NO entran, y no deben.
const _SUFIJO_DE_SNAPSHOT = /-(?:\d{4}-\d{2}-\d{2}|\d{8}|latest)$/;

// índice en minúsculas → clave real de la tabla. La tabla sigue siendo la única fuente: esto es sólo su índice.
const _POR_FAMILIA = new Map(Object.keys(MODEL_PRICING).map((k) => [k.toLowerCase(), k]));

/** resolvePricingKey(model) → la clave de MODEL_PRICING que tarifa ese id | null si no hay ninguna (no inventa). */
export function resolvePricingKey(model) {
  if (typeof model !== "string") return null;
  let id = model.trim().toLowerCase();
  if (!id) return null;
  if (_POR_FAMILIA.has(id)) return _POR_FAMILIA.get(id);
  // prefijo de proveedor ("openai/gpt-4o-mini"): el proveedor ya viaja en su propio campo, no es parte del modelo.
  const barra = id.lastIndexOf("/");
  if (barra >= 0) id = id.slice(barra + 1);
  if (_POR_FAMILIA.has(id)) return _POR_FAMILIA.get(id);
  const familia = id.replace(_SUFIJO_DE_SNAPSHOT, "");
  if (familia !== id && _POR_FAMILIA.has(familia)) return _POR_FAMILIA.get(familia);
  return null;
}

/** Los tres estados posibles de una tarifación. Sólo `tarifado` trae un número. */
export const ESTADO_COSTO = Object.freeze({
  TARIFADO: "tarifado",
  SIN_PRECIO: "modelo-sin-precio",
  SIN_USAGE: "llamada-sin-usage",
});

// ── EL RUIDO · un costo que no se pudo calcular tiene que doler, no pasar desapercibido ─────────────────────────
// Se registra POR ID (no un booleano global) para que el host pueda decir exactamente QUÉ no supo tarifar y
// cuántas veces. El aviso por consola sale UNA vez por id: sirve para que nadie termine una corrida sin enterarse,
// no para inundar el log. Un id de modelo es vocabulario del proveedor, nunca un dato del cliente.
const _SIN_PRECIO = new Map();    // id efectivo → veces visto
const _SIN_USAGE = new Map();     // familia → veces vista sin conteo de tokens

function _anotar(registro, clave, aviso) {
  const veces = (registro.get(clave) || 0) + 1;
  registro.set(clave, veces);
  if (veces === 1 && typeof console !== "undefined" && console.warn) console.warn(aviso);
}
const _lista = (registro) => [...registro.entries()].map(([modelo, veces]) => ({ modelo, veces }));

/** Ids que se intentaron tarifar y esta tabla no conoce. Si no está vacío, cualquier total de gasto está incompleto. */
export function modelosSinPrecio() { return _lista(_SIN_PRECIO); }
/** Familias con precio conocido cuyas llamadas llegaron SIN `usage` (timeout/respuesta truncada): gasto real, invisible. */
export function modelosSinUsage() { return _lista(_SIN_USAGE); }
/** Reinicia los dos registros (el host que abre una corrida nueva; los gates entre casos). */
export function olvidarNoTarifados() { _SIN_PRECIO.clear(); _SIN_USAGE.clear(); }

/**
 * costoLlamadaUSD(model, usage) → { usd, estado, familia }
 *   · usd es número SOLO en estado "tarifado"; en los otros dos es null y el estado dice por qué.
 * Es la forma que NO se puede aplanar sin querer: un llamador que sume tiene que decidir explícitamente qué hace
 * con un costo desconocido (detener la corrida, cargarlo al peor caso, o declararlo) — nunca sumar cero sin verlo.
 */
export function costoLlamadaUSD(model, usage) {
  const familia = resolvePricingKey(model);
  if (!familia) {
    const id = typeof model === "string" && model.trim() ? model.trim() : null;
    if (id) _anotar(_SIN_PRECIO, id, `[modelPricing] SIN PRECIO CONOCIDO para "${id}" — esa llamada NO se puede ` +
      `tarifar. Un costo desconocido no es un costo cero: cualquier total que la sume como 0 está subcontando.`);
    return { usd: null, estado: ESTADO_COSTO.SIN_PRECIO, familia: null };
  }
  // LAS DOS FORMAS DE `usage` DEL REPO, igual que telemetry.js: los adapters normalizan a input_tokens/
  // output_tokens, pero la forma cruda del proveedor (prompt_tokens/completion_tokens) también circula. Leer una
  // sola era un tercer cero silencioso: un objeto con conteos reales y las claves de la otra forma daba US$0,00
  // exacto —un número, no un null— y ningún llamador podía notarlo.
  const _conteo = (u, a, b) => {
    for (const k of [a, b]) if (u && u[k] != null && Number.isFinite(Number(u[k]))) return Number(u[k]);
    return null;
  };
  const entrada = _conteo(usage, "input_tokens", "prompt_tokens");
  const salida = _conteo(usage, "output_tokens", "completion_tokens");
  if (!usage || (entrada === null && salida === null)) {
    _anotar(_SIN_USAGE, familia, `[modelPricing] llamada de "${familia}" SIN conteo de tokens utilizable — el ` +
      `proveedor pudo haberla generado y facturado igual. No se tarifa, y contarla como 0 la haría invisible.`);
    return { usd: null, estado: ESTADO_COSTO.SIN_USAGE, familia };
  }
  const p = MODEL_PRICING[familia];
  const usd = ((entrada || 0) / 1e6) * p.in + ((salida || 0) / 1e6) * p.out;
  return { usd, estado: ESTADO_COSTO.TARIFADO, familia };
}

// estimateCostUSD(model, usage) → número | null (modelo sin precio conocido, o sin usage — nunca inventa un precio)
// El contrato de siempre, intacto para sus llamadores; lo que cambió es que ahora encuentra la familia del id.
export function estimateCostUSD(model, usage) {
  return costoLlamadaUSD(model, usage).usd;
}
