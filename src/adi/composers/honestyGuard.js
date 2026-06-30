/* === adi/composers/honestyGuard.js · GAP 1 · guard de HONESTIDAD ante lo imposible ===
 * Corre ANTES del spine/ranking. Cuando la pregunta pide algo que el dato NO sostiene, el motor NO debe
 * contestar otra pregunta ni sustituir la entidad: DECLARA el límite y redirige a lo disponible.
 * Es lo que hace VERDADERO el "ADI nunca inventa". Determinístico (detectores existentes · membresía).
 *
 * El redirect tiene 3 partes (estructura premium · se adueña apuntando a lo que el usuario nombró):
 *   1) el LÍMITE con su razón ("no desagrega ventas por marca dentro de cada cliente")
 *   2) lo DISPONIBLE, afirmativo ("Sí puedo mostrarte ventas por cliente o ventas por SKU")
 *   3) una ELECCIÓN concreta con las entidades/métrica nombradas ("¿partir por Falabella o por SKUs Samsung?")
 *
 * Casos imposibles + seguros (cero sobre-bloqueo · ver _prueba_overblock.mjs):
 *   - cruce marca×cliente: la marca por cuenta NO viene desagregada (campo decorativo · Ejemplo 5 Situación B).
 *   - cruce cliente×SKU: no hay transacciones atómicas (quién compra qué).
 *   - métrica×entidad imposible: rotación/DOH/capital sobre un cliente (son métricas de inventario).
 *   - evolución/causa EN EL TIEMPO por entidad: el histórico por entidad es plano/sintético.
 *   - SKU inexistente: un código con patrón SKU que no está en el dataset.
 * NO bloquea: marca×SKU (filtro legítimo), marca sola, cliente solo, marca×bodega (derivable), tendencia GLOBAL.
 */
import { detectBrandInText, detectSkuInText } from "../detectors.js";
import { detectAllClientsInText, detectAllWarehousesInText } from "../router.js";

const _norm = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

// ¿hay un token con forma de SKU que NO está en el dataset? (XYZ-9999, SKU-PHANTOM, BOS-DRILL18V)
function _unknownSku(text) {
  const toks = (text.toUpperCase().match(/[A-Z]{2,}-[A-Z0-9]{2,}(?:-[A-Z0-9]+)*/g) || [])
    .filter((t) => /\d/.test(t) || t.length >= 8);          // parece código de SKU (no un guión casual)
  return toks.find((t) => !detectSkuInText(t)) || null;     // detectSkuInText = membresía → null si no existe
}

// métrica nombrada en la pregunta → redirige en SUS términos · default ventas (lo más común / "compra"→ventas).
function _metricOf(n) {
  if (/\bmargen|m[aá]rgenes|rentabil/.test(n)) return { label: "margen", sup: "mayor margen" };
  if (/\bcontribuci/.test(n)) return { label: "contribución", sup: "mayor contribución" };
  if (/\brotaci/.test(n)) return { label: "rotación", sup: "mejor rotación" };
  if (/\bdoh\b|cobertura/.test(n)) return { label: "DOH", sup: "menor DOH" };
  if (/capital|inmoviliz/.test(n)) return { label: "capital inmovilizado", sup: "mayor capital" };
  return { label: "ventas", sup: "mayores ventas" };
}

// ¿pide evolución/causa EN EL TIEMPO de una entidad/eje? (histórico por entidad = sintético/plano)
const _MESES = "(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)";
function _temporalPerEntity(n, brand, text) {
  const temporal =
    /\b(evoluci[oó]n|tendencia|mes a mes|trimestr|24 meses|12 meses|[uú]ltimos?\s+\d+\s+meses|en el tiempo|cada mes)\b/.test(n)
    || /\b(por que|porque)\b[^.]*\b(cay[oó]|baj[oó]|subi[oó]|deterior|mejor[oó]|aument[oó])\b/.test(n)
    || new RegExp(`\\ben\\s+${_MESES}\\b`).test(n)
    || new RegExp(`${_MESES}\\b[^.]*\\bvs\\b[^.]*${_MESES}`).test(n);
  if (!temporal) return false;
  // exige entidad específica O un EJE de entidad · la tendencia GLOBAL (ventasMensuales · sin eje) SÍ es real.
  return !!brand || (detectAllClientsInText(text) || []).length > 0 || !!detectSkuInText(text)
    || (detectAllWarehousesInText(text) || []).some((w) => w && w !== "Todas")
    || /\b(marcas?|clientes?|cuentas?|skus?|productos?|art[ií]culos?|bodegas?|sucursal\w*|familias?)\b/.test(n);
}

// Devuelve el texto honesto (3 partes) o null si la pregunta NO es imposible.
export function composeHonestyGuard(text) {
  if (!text || typeof text !== "string") return null;
  const n = _norm(text);
  const brand = detectBrandInText(text);
  const clients = detectAllClientsInText(text) || [];
  const namedClient = clients[0] || null;
  const clientRef = clients.length > 0 || /\bclientes?\b|\bcuentas?\b/.test(n);
  const namedSku = !!detectSkuInText(text);
  const skuRef = namedSku || /\bskus?\b|\bproductos?\b|\bitems?\b|\bart[ií]culos?\b/.test(n);
  const asksWhoBuys = /\bqui[eé]n(es)?\b[^.]*\bcompr|\bqu[eé]\s+clientes?\b/.test(n);
  const m = _metricOf(n);

  // 1 · cruce marca×cliente — la marca por cuenta no viene desagregada.
  if (brand && clientRef) {
    const pick = namedClient
      ? `¿Prefieres partir por ${namedClient} o por SKUs ${brand}?`
      : `¿Prefieres ver ${brand} por SKU o el ranking de clientes?`;
    return `No tengo ese cruce disponible: la base no desagrega ${m.label} por marca dentro de cada cliente. `
      + `Sí puedo mostrarte ${m.label} por cliente o ${m.label} por SKU. ${pick}`;
  }
  // 2 · cruce cliente×SKU — no hay transacciones atómicas.
  if ((clientRef && skuRef) || (asksWhoBuys && skuRef)) {
    const lead = namedSku
      ? `No puedo identificar qué clientes compran ese SKU, porque los datos no tienen transacciones a nivel cliente × SKU. `
      : `No tengo qué productos compra cada cliente — los datos no tienen transacciones a nivel cliente × SKU. `;
    return lead
      + `Sí puedo mostrarte el ranking de clientes o el ranking de SKUs por ${m.label}. `
      + `¿Quieres revisar primero el SKU o los clientes?`;
  }
  // 3 · métrica de inventario pedida sobre un cliente — un cliente no tiene rotación/DOH/capital.
  if (clientRef && /\brotaci|\bdoh\b|\bcobertura\b|capital\s+inmoviliz|stock\s+(inmoviliz|muert|parad)/.test(n)) {
    return `Un cliente no tiene ${m.label} — esa es una métrica de inventario, vive en el SKU y la bodega. `
      + `Sí puedo mostrarte ${m.label} por SKU o por bodega. ¿La vemos por SKU o por bodega?`;
  }
  // 4 · evolución/causa en el tiempo por entidad — el histórico por entidad es plano/sintético.
  if (_temporalPerEntity(n, brand, text)) {
    return `No tengo histórico real por entidad para afirmar una evolución o una causa en el tiempo. `
      + `Sí puedo darte la foto de hoy: el ranking actual por ${m.label}. ¿Te la muestro?`;
  }
  // 5 · SKU inexistente.
  const unk = _unknownSku(text);
  if (unk) {
    return `No encontré el SKU ${unk} en los datos disponibles. `
      + `Para ${m.label}, puedo mostrarte el ranking por SKU o por cliente. ¿Quieres ver los SKUs con ${m.sup}?`;
  }
  return null;
}
