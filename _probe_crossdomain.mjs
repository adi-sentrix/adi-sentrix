// Sonda · qué detecta el modular (detectCrossDomainQuery + detectIntent) por query.
// Informa el cableado de answerADI Y chequea que el camino crítico NO caiga en cross-domain.
import { detectCrossDomainQuery, detectIntent } from "./src/adi/router.js";

const qs = [
  // objetivo de extracción (mecanismos)
  "clientes con bajo margen", "qué clientes tienen bajo margen", "qué clientes erosionan el margen",
  "dónde se está yendo el margen", "quién aporta más contribución", "qué cliente concentra la pérdida",
  // camino crítico sellado (NO deben volverse cross-domain si hoy no lo son)
  "cómo están las ventas", "cómo está el margen", "cómo está el inventario", "cómo va el negocio",
  "cómo están las ventas de Falabella", "Santiago vs Valparaíso", "cuál es el SKU con peor rotación",
  "cómo viene Makita", "cuánto debe vender Falabella para aportar $1M",
  // otras familias
  "Falabella vs Lider", "mejores clientes", "dónde tengo capital detenido",
];
for (const q of qs) {
  const cd = detectCrossDomainQuery(q);
  const intent = detectIntent(q, {});
  console.log(`«${q}»`);
  console.log(`   crossDomain: ${cd.isCrossDomainQuery} · archetype: ${cd.archetype || "—"} · detectIntent.type: ${intent.type}`);
}
