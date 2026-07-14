/* === src/adi/llm/capabilities.js · ADI Core · UNIVERSO DISPONIBLE (owner 2026-07-09) ===
 * "Lo que debemos asegurar no es que no interprete — eso es lo mejor del LLM — sino que considere SOLO lo que
 * le damos como disponible." Doctrina de la boleta extendida: la boleta autoriza las CIFRAS; este catálogo
 * autoriza las CAPACIDADES. El narrador interpreta y ofrece con libertad total DENTRO de este universo; fuera
 * de él no hay data, y ofrecer ahí es una promesa rota (el caso: "¿analizamos las campañas de marketing?").
 *
 * Doble uso: (1) sección DISPONIBLE del prompt del narrador (buildNarrateSystem la appendea a todo prompt) ·
 * (2) vocabulario FUERA-DE-DATO para el redirect determinístico (coerceChain → composeMeta) y el scrub de
 * última línea del guard de voz. Métricas×ejes se DERIVAN del contrato (una verdad, sin lista paralela);
 * los análisis con foco corresponden 1:1 a composers reales (si un foco muere, su línea muere con él). */
import { METRICS } from "../../config/contract/metricRegistry.js";

// análisis con foco propio — cada línea es un composer/focus REAL del producto (el gate de promesas prueba
// las sugerencias que los emiten; nada de esta lista es aspiracional)
const FOCOS = [
  "margen y carga comercial (cuánto margen retiene cada cuenta y cómo se recupera)",
  "causa del margen: ¿cede por precio o por costo? · candidatos a subir precio",
  "descomposición del crecimiento: ¿volumen o precio?",
  "ventas vs año anterior y vs presupuesto (quién suma, quién resta) · clientes que redujeron su compra",
  "mix de ventas y participación por familia",
  "concentración de la contribución (Pareto 80/20 real) · contribución no capturada vs benchmark",
  "inventario: capital detenido · riesgo de quiebre · sobrestock · SKU sin rotar · stock de los más vendidos",
  "profundizar en una cuenta/SKU/marca/familia (perfil completo) · comparar dos entidades",
  "proyección con supuesto +/-X% sobre el dato real",
];

// menú DISPONIBLE para el prompt del narrador · métricas×ejes derivadas del contrato + focos reales
export function buildDisponibleMenu() {
  const metricas = Object.values(METRICS)
    .map((m) => `${m.label} por ${(m.axes || []).join("/")}`)
    .join(" · ");
  return `MÉTRICAS (del dato real): ${metricas}. ANÁLISIS: ${FOCOS.join(" · ")}.`;
}

// DATA QUE NO EXISTE en el producto (ni contrato ni focos) — el narrador jamás la ofrece; si el usuario la pide,
// la cadena convierte hacia la palanca disponible (composeMeta "fuera_de_dato"). Vocabulario acotado a DATA
// inexistente — no bloquea lenguaje de negocio normal (descuentos/bonificaciones/precio SÍ son del universo).
export const OUT_OF_DATA_RE = /\b(campa[ñn]as?|marketing|publicidad|publicitari\w+|promocion\w*|redes\s+sociales|instagram|facebook|tiktok|google\s+ads|\bads\b|influencer\w*|encuesta\w*|competencia|competidor\w*|tr[aá]fico\s+(web|de\s+tienda)|posicionamiento\s+de\s+marca)\b/i;
