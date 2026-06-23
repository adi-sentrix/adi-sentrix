/* === CONFIG · 5 diccionarios _*_ES de la fuga 2 (los lee _composeSectoralContext) ===
 * Extraído de 41cc33d8 · valores byte-idénticos · cero recálculo (Fase 2 del refactor).
 * La única diferencia con el monolito es DÓNDE vive el dato, nunca QUÉ vale. */

export const _DIMENSION_LABEL_ES = {
  doh:                 "DOH",
  margen_pct:          "margen",
  rotacion:            "rotación",
  carga_comercial_pct: "carga comercial",
};

export const _DIMENSION_UNIT_ES = {
  doh:                 "días",
  margen_pct:          "%",
  rotacion:            "",
  carga_comercial_pct: "%",
};

export const _INDUSTRY_LABEL_ES = {
  retail:         "retail",
  construccion:   "construcción",
  consumo_masivo: "consumo masivo",
  generico:       "genérico",
};

export const _DIMENSION_GENDER = {
  doh:                 "masc",  // "el DOH" (siglas masc por convención)
  margen_pct:          "masc",  // "el margen"
  rotacion:            "fem",   // "la rotación"
  carga_comercial_pct: "fem",   // "la carga comercial"
};

export const _CLASSIFICATION_LABEL_ES = {
  normal:     { masc: "normal",       fem: "normal" },          // invariante
  elevated:   { masc: "algo elevado", fem: "algo elevada" },    // D-U+.A concordancia
  critical:   { masc: "crítico",      fem: "crítica" },         // D-U+.A concordancia
  healthy:    { masc: "saludable",    fem: "saludable" },       // invariante
  pressured:  { masc: "bajo presión", fem: "bajo presión" },    // locución prep+sust · invariante
};
