/* === adi/detectors.js ===
 * ADI conversacional extraído de 41cc33d8 · verbatim · solo imports agregados.
 * Importa motor (engine/) + datos/config sellados. Cero cambio de cálculo. */
import { FEATURE_BRAND_AS_ENTITY } from "../config/features.js";
import { MARCAS_ALL } from "../data/catalogs.js";
import { CLIENTES_STRATEGIC_PROFILE, clientesAlias, clientesAmbiguos, clientesVentas, skuInventario } from "../data/demoData.js";
import { onTenantChange } from "../data/tenantStore.js";
import { applyScenarioToClientesVentas } from "../engine/scenarios.js";
import { normalizeText } from "./helpers.js";

// \u2500\u2500 Piece 1 (hardening \u00b7 paso bloqueante) \u00b7 endurecimiento de keywords cortas/ambiguas \u2500\u2500
// Hay nombres de cuenta que adem\u00e1s son palabras comunes en espa\u00f1ol/ingl\u00e9s \u2192 falso positivo de
// filtro-cliente ("el abc del margen" \u2260 cliente ABC). En modo strict (solo lo usa el extractor
// de filtros \u00b7 Fase 2) exigen un conector de cliente antes ("de/del/cliente/cuenta/para ABC").
// SIN strict el regex es id\u00e9ntico al original (\bkey\b) \u2192 comportamiento del piso byte-exacto.
// CU\u00c1LES son esos nombres NO se deriva del dato: ninguna regla por largo separa "easy"/"paris" de
// "lider" sin cambiarle el trato a Lider. Los declara el negocio (`clientesAmbiguos` \u00b7 tenants/demo.js)
// y se re-arman en initTenant, igual que el canon de m\u00e1s abajo.
export let _AMBIGUOUS_CLIENT_KW = new Set((clientesAmbiguos || []).map((k) => k.toLowerCase()));
const _CLIENT_FILTER_CONNECTOR = "(?:de|del|cliente|cuenta|para)";
export function _clientKwRegex(key, strict) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (strict && _AMBIGUOUS_CLIENT_KW.has(key)) {
    return new RegExp(`\\b${_CLIENT_FILTER_CONNECTOR}\\s+${escaped}\\b`, "i");
  }
  return new RegExp(`\\b${escaped}\\b`, "i");
}

export function detectClientInText(text, opts) {
  const strict = !!(opts && opts.strict);
  const normalized = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  for (const key of CLIENT_KEYWORDS) {
    // Word boundary para no matchear "easy" dentro de "easyfit" (+ conector si strict \u00b7 ambiguas)
    if (_clientKwRegex(key, strict).test(normalized)) {
      return CLIENT_NAME_MAP[key] || key;
    }
  }
  return null;
}

export function detectBrandInText(text) {
  if (!FEATURE_BRAND_AS_ENTITY || !text || typeof text !== "string") return null;
  const norm = normalizeText(text);
  for (const b of MARCAS_ALL) {
    const re = new RegExp(`\\b${normalizeText(b)}\\b(?!-)`, "i");
    if (re.test(norm)) return b;
  }
  return null;
}

export function detectSkuInText(text) {
  if (!text) return null;
  const upper = text.toUpperCase();

  // Iterar SKUs del dataset · match directo
  for (const s of skuInventario) {
    if (upper.includes(s.sku.toUpperCase())) {
      return s.sku;
    }
  }

  // Variantes sin guiones (LGDRYER8KG matchea LG-DRYER8KG)
  const noHyphen = upper.replace(/-/g, "");
  for (const s of skuInventario) {
    const skuNoHyphen = s.sku.replace(/-/g, "").toUpperCase();
    if (skuNoHyphen.length >= 6 && noHyphen.includes(skuNoHyphen)) {
      return s.sku;
    }
  }

  return null;
}

export function getSubstitutionMap(clientName, scenarioId) {
  const profile = getStrategicProfile(clientName);
  if (!profile) return { substitutes: [], isUnique: false };

  const ventas = applyScenarioToClientesVentas(scenarioId);
  const totalActual = ventas.reduce((s, c) => s + c.actual, 0);

  // Detect "no natural substitute" flag (string entries starting with "sin")
  const sustList = profile.sustitutosNaturales || [];
  const isUnique = sustList.some(s => typeof s === "string" && s.toLowerCase().startsWith("sin"));

  if (isUnique) {
    return {
      substitutes: [],
      isUnique: true,
      uniqueReason: sustList.find(s => s.toLowerCase().startsWith("sin")) || "sin reemplazo natural",
    };
  }

  // Parse each substitute entry "{Name} {calificator}" and enrich with live share
  const enriched = sustList.map(entry => {
    const parts = String(entry).split(" ");
    const calificator = parts[parts.length - 1]; // "parcial" | "limitado"
    const name = parts.slice(0, -1).join(" ");
    const sustData = ventas.find(c => c.nombre === name);
    const currentShare = sustData
      ? +((sustData.actual / totalActual) * 100).toFixed(1)
      : null;
    return { name, calificator, currentShare };
  });

  return { substitutes: enriched, isUnique: false };
}

export function getStrategicProfile(clientName) {
  return CLIENTES_STRATEGIC_PROFILE[clientName] || null;
}

/* ── EL CANON DE CLIENTES · DERIVADO DEL DATO ACTIVO (2026-08-21) ────────────────────────────────────────────
 * Antes acá vivían dos listas escritas a mano con las 13 cuentas del demo y sus 15 alias. Eso no era un dataset
 * de prueba: era vocabulario de ADI hardcodeado en código de producto, y con el archivo de un cliente real habría
 * sido un defecto de correctitud — ADI reconociendo «Falabella» y NO las cuentas de quien paga.
 *
 * Ahora sale de `clientesVentas` (orden del dataset) + los alias que el negocio declara. Mismo patrón que
 * `KNOWN_ENTITIES` en ui/theme.js: se arma acá y se RE-ARMA en `initTenant` — nunca más en import de módulo,
 * porque desde la vía 1 el store arranca vacío y el import ya no ve dato.
 *
 * ORDEN · importa y no es cosmético: `detectClientInText` y la PRIORIDAD 1 del router devuelven el PRIMER match,
 * así que el orden del arreglo es precedencia. Cada alias se emite JUSTO DESPUÉS del nombre del que sale, que es
 * exactamente el orden que tenía la lista a mano. Con el demo activo, las dos estructuras salen byte-idénticas. */
const _normKw = (s) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

function _derivarCanonClientes() {
  const keywords = [];
  const map = {};
  // alias declarados, agrupados por su canónico, para emitirlos pegados al nombre que los origina
  const aliasPorCanonico = {};
  for (const [alias, canonico] of Object.entries(clientesAlias || {})) {
    if (!alias || !canonico) continue;
    (aliasPorCanonico[canonico] = aliasPorCanonico[canonico] || []).push(alias);
  }
  const agregar = (key, canonico) => {
    const k = _normKw(key);
    if (!k || Object.prototype.hasOwnProperty.call(map, k)) return;
    keywords.push(k);
    map[k] = canonico;
  };
  const vistos = new Set();
  for (const c of clientesVentas) {
    if (!c || !c.nombre || vistos.has(c.nombre)) continue;
    vistos.add(c.nombre);
    agregar(c.nombre, c.nombre);
    for (const alias of aliasPorCanonico[c.nombre] || []) agregar(alias, c.nombre);
  }
  return { keywords, map };
}

let _canon = _derivarCanonClientes();
export let CLIENT_KEYWORDS = _canon.keywords;
export let CLIENT_NAME_MAP = _canon.map;

onTenantChange(() => {
  _canon = _derivarCanonClientes();
  CLIENT_KEYWORDS = _canon.keywords;
  CLIENT_NAME_MAP = _canon.map;
  _AMBIGUOUS_CLIENT_KW = new Set((clientesAmbiguos || []).map(_normKw));
});
