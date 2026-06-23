/* === adi/detectors.js ===
 * ADI conversacional extraído de 41cc33d8 · verbatim · solo imports agregados.
 * Importa motor (engine/) + datos/config sellados. Cero cambio de cálculo. */
import { FEATURE_BRAND_AS_ENTITY } from "../config/features.js";
import { MARCAS_ALL } from "../data/catalogs.js";
import { CLIENTES_STRATEGIC_PROFILE, skuInventario } from "../data/demoData.js";
import { applyScenarioToClientesVentas } from "../engine/scenarios.js";
import { normalizeText } from "./helpers.js";

export function detectClientInText(text) {
  const normalized = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  for (const key of CLIENT_KEYWORDS) {
    // Word boundary para no matchear "easy" dentro de "easyfit"
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`\\b${escaped}\\b`, "i").test(normalized)) {
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

export const CLIENT_KEYWORDS = [
  "falabella", "lider", "jumbo", "sodimac", "tottus", "paris",
  "mercado libre", "mercadolibre", "ripley", "easy",
  "la polar", "lapolar", "hites", "abc", "unimarc",
];

export const CLIENT_NAME_MAP = {
  "falabella":     "Falabella",
  "lider":         "Lider",
  "jumbo":         "Jumbo",
  "sodimac":       "Sodimac",
  "tottus":        "Tottus",
  "paris":         "Paris",
  "mercado libre": "Mercado Libre",
  "mercadolibre":  "Mercado Libre",
  "ripley":        "Ripley",
  "easy":          "Easy",
  "la polar":      "La Polar",
  "lapolar":       "La Polar",
  "hites":         "Hites",
  "abc":           "ABC",
  "unimarc":       "Unimarc",
};
