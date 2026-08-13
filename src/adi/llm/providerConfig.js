/* === src/adi/llm/providerConfig.js · QUIÉN ES EL PROVEEDOR SE DECLARA, NO SE ADIVINA (owner 2026-08-13) ======
 *
 * EL DEFECTO QUE CIERRA, medido en vivo. `gatewayCore.js` resolvía el proveedor así:
 *     const provider = e.LLM_PROVIDER || "anthropic";
 * Si la variable no llegaba al servidor —un deploy sin setearla, un runtime que no expone el env, un typo— el
 * gateway NO fallaba: se iba callado a OTRO proveedor, con la clave equivocada, y devolvía el 401 de ese
 * proveedor ("x-api-key header is required"). Río abajo el cliente degradaba al piso y el usuario leía "gateway
 * no disponible". La causa real —una variable que falta— quedaba invisible en las tres capas.
 * Un default que apunta a otro proveedor no es un default: es una trampa. Acá no hay default.
 *
 * POR QUÉ ES UN MÓDULO PROPIO Y NO DOS LÍNEAS EN EL GATEWAY. Todo gate que importe `gatewayCore.js` queda
 * clasificado LIVE y NO corre en `npm run gates:offline` (ver scripts/gates-offline.mjs). O sea: la decisión más
 * peligrosa del gateway era, además, la única que ningún gate offline podía ejercer de verdad — solo leerla como
 * texto. Acá vive sola, sin importar nada, sin tocar la red y sin conocer un solo proveedor, así que la suite
 * offline la corre DE VERDAD, no la inspecciona.
 *
 * QUÉ NO HACE, a propósito: NO valida que el proveedor exista ni enumera los disponibles. Esa lista vive en
 * `providerAdapter.js` (ADAPTERS) y copiarla acá sería una segunda verdad que se desincroniza con el primer
 * adapter nuevo. Acá se responde UNA pregunta: ¿el operador declaró un proveedor, sí o no?
 */

/** El nombre de la variable, en un solo lugar: el mensaje de error tiene que poder NOMBRARLA sin repetirla a mano. */
export const VARIABLE_PROVEEDOR = "LLM_PROVIDER";

/* resolverProveedor(env) → { proveedor, falta }
 *   · declarada    → { proveedor: "openai", falta: null }
 *   · ausente/vacía → { proveedor: null,    falta: "LLM_PROVIDER" }
 * "  " (solo espacios) cuenta como AUSENTE: una variable seteada en blanco es el caso típico de un panel de
 * plataforma con el campo creado y sin valor, y tratarla como un nombre de proveedor daría un error mucho más
 * confuso ("adapter desconocido: ''") que el que este módulo existe para dar. */
export function resolverProveedor(env) {
  const v = env && typeof env === "object" ? env[VARIABLE_PROVEEDOR] : null;
  const s = typeof v === "string" ? v.trim() : "";
  return s ? { proveedor: s, falta: null } : { proveedor: null, falta: VARIABLE_PROVEEDOR };
}

/* El error NOMBRA la variable que falta — es todo el punto. Un "gateway no disponible" obliga a adivinar; esto
 * dice qué setear y dónde. No enumera proveedores válidos (ver arriba: esa lista no vive acá). */
export function mensajeFaltaProveedor(falta = VARIABLE_PROVEEDOR) {
  return `falta ${falta} en el entorno del servidor · el gateway no elige proveedor por su cuenta (declarala server-side, ver .env.example)`;
}
