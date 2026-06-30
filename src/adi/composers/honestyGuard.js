/* === adi/composers/honestyGuard.js · GAP 1 · guard de HONESTIDAD ante lo imposible ===
 * Corre ANTES del spine/ranking. Cuando la pregunta pide algo que el dato NO sostiene, el motor NO debe
 * contestar otra pregunta ni sustituir la entidad: DECLARA el límite y redirige a lo disponible (smart-guide).
 * Es lo que hace VERDADERO el "ADI nunca inventa". Determinístico (detectores existentes · membresía).
 *
 * v1 · solo los casos GENUINAMENTE imposibles + seguros (cero sobre-bloqueo):
 *   - cruce marca×cliente: la marca por cuenta NO viene desagregada (campo decorativo · Ejemplo 5 Situación B).
 *   - cruce cliente×SKU: no hay transacciones atómicas (quién compra qué).
 *   - SKU inexistente: un código con patrón SKU que no está en el dataset.
 * NO bloquea: marca×SKU (filtro legítimo), marca sola, cliente solo, marca×bodega (derivable de skuInventario),
 *   ni nada que el spine sí responde. (temporal + cliente/marca inexistente = v2.)
 */
import { detectBrandInText, detectSkuInText } from "../detectors.js";
import { detectAllClientsInText } from "../router.js";
import { composeSmartGuide } from "./smartGuide.js";

const _norm = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

// ¿hay un token con forma de SKU que NO está en el dataset? (XYZ-9999, SKU-PHANTOM, BOS-DRILL18V)
function _unknownSku(text) {
  const toks = (text.toUpperCase().match(/[A-Z]{2,}-[A-Z0-9]{2,}(?:-[A-Z0-9]+)*/g) || [])
    .filter((t) => /\d/.test(t) || t.length >= 8);          // parece código de SKU (no un guión casual)
  return toks.find((t) => !detectSkuInText(t)) || null;     // detectSkuInText = membresía → null si no existe
}

// ¿pide evolución/causa EN EL TIEMPO de una entidad específica? (histórico por entidad = sintético/plano)
const _MESES = "(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)";
function _temporalPerEntity(n, brand, text) {
  const temporal =
    /\b(evoluci[oó]n|tendencia|mes a mes|trimestr|24 meses|12 meses|[uú]ltimos?\s+\d+\s+meses|en el tiempo|cada mes)\b/.test(n)
    || /\b(por que|porque)\b[^.]*\b(cay[oó]|baj[oó]|subi[oó]|deterior|mejor[oó]|aument[oó])\b/.test(n)
    || new RegExp(`\\ben\\s+${_MESES}\\b`).test(n)
    || new RegExp(`${_MESES}\\b[^.]*\\bvs\\b[^.]*${_MESES}`).test(n);
  if (!temporal) return false;
  // exige entidad ESPECÍFICA (marca/cliente/SKU) · la tendencia GLOBAL (ventasMensuales) SÍ es real → no bloquear.
  return !!brand || (detectAllClientsInText(text) || []).length > 0 || !!detectSkuInText(text);
}

// Devuelve el texto honesto (límite declarado + redirección) o null si la pregunta NO es imposible.
export function composeHonestyGuard(text) {
  if (!text || typeof text !== "string") return null;
  const n = _norm(text);
  const brand = detectBrandInText(text);
  // cliente: nombre específico (detector) O referencia genérica ("cada cliente", "los clientes", "por cliente").
  const clientRef = (detectAllClientsInText(text) || []).length > 0 || /\bclientes?\b|\bcuentas?\b/.test(n);
  const skuRef = !!detectSkuInText(text) || /\bskus?\b|\bproductos?\b|\bitems?\b|\bart[ií]culos?\b/.test(n);
  // patrón "quién compra [SKU]" / "qué clientes compran" → pide el cruce cliente×SKU aunque no nombre "cliente".
  const asksWhoBuys = /\bqui[eé]n(es)?\b[^.]*\bcompr|\bqu[eé]\s+clientes?\b/.test(n);

  let limit = null;
  if (brand && clientRef) {
    limit = "El detalle de marca por cliente no está en los datos (la marca por cuenta no viene desagregada). ";
  } else if ((clientRef && skuRef) || (asksWhoBuys && skuRef)) {
    limit = "No tengo qué productos compra cada cliente — no hay transacciones atómicas cliente×SKU. ";
  } else if (_temporalPerEntity(n, brand, text)) {
    // evolución/causa en el tiempo de UNA entidad específica · el histórico por entidad es plano/sintético.
    limit = "No tengo histórico real por entidad para afirmar una evolución o una causa en el tiempo. ";
  } else {
    const unk = _unknownSku(text);
    if (unk) limit = `No tengo el SKU ${unk} en los datos. `;
  }
  if (!limit) return null;
  // se adueña: declara el límite y guía a lo disponible (regla madre · nunca inventa, nunca "no sé" seco).
  return limit + composeSmartGuide(text);
}
