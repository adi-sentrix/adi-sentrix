/* === adi/composers/smartGuide.js · fix demo-readiness · "ADI se adueña de la conversación" ===
 * Cuando ADI NO puede responder directo (cruce no soportado, concepto sin dato, query no parseada),
 * en vez de un "no llego" seco detecta los TÉRMINOS que el usuario mencionó (cliente/margen/SKU/bodega/
 * rotación…) y GUÍA hacia lo que SÍ está disponible. Determinístico (regex sobre el texto + detectores
 * existentes). NUNCA ofrece lo que no está modelado ni emite un número (la regla madre se mantiene).
 * Principio del owner: "algo premium nunca dice que no lo sabe, se adueña de la conversación." */
import { detectAllClientsInText, detectAllWarehousesInText } from "../router.js";

const _norm = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

// Catálogo de lo DISPONIBLE (lo único que el smart-guide ofrece · regla madre).
//   comercial: ventas, margen, contribución (cliente/SKU) · inventario: rotación, capital, cobertura (SKU/bodega)
export function composeSmartGuide(text) {
  const n = _norm(text);

  // 1 · métricas mencionadas (comercial + inventario)
  const mC = [];
  if (/\bventas?\b|factura|vende[ns]?\b|vendo|vendemos|compr[ao]/.test(n)) mC.push("ventas");
  if (/\bmargen|margenes|rentab|gano|gana[rn]?\b|ganancia|rinde[ns]?\b/.test(n)) mC.push("margen");
  if (/\bcontribuci|aporta[ns]?\b|aporte/.test(n)) mC.push("contribución");
  const mI = [];
  if (/\brotaci|rota[ns]?\b|no\s+se\s+mueve|no\s+rota/.test(n)) mI.push("rotación");
  if (/\bcapital|inmoviliz|detenid|atrapad|parad|stock\s+muerto|plata\s+dormida|dormid/.test(n)) mI.push("capital inmovilizado");
  if (/\bcobertura|\bdoh\b|dias\s+de\s+(stock|cobertura)/.test(n)) mI.push("cobertura");
  const metrics = [...mC, ...mI];

  // 2 · concepto nombrado que NO está disponible (para reconocerlo y nombrarlo)
  let lead = "";
  if (/\bticket\b/.test(n))                                                    lead = "Ticket promedio aún no lo tengo. ";
  else if (/\bcanal(es)?\b/.test(n))                                           lead = "Por canal todavía no tengo el corte. ";
  else if (/\btier\b|\bsegmento\b/.test(n))                                    lead = "Por tier todavía no tengo el corte. ";
  else if (/\bantes\b|a[nñ]o\s+pasado|mes\s+pasado|\bvs\b|evoluci|tendencia|en\s+el\s+tiempo|historic/.test(n)) lead = "La comparación en el tiempo todavía no la tengo. ";
  // ejes que el inventario NO sostiene (marca/familia) — solo aplica cuando se pidió una métrica de inventario por ese eje
  else if (/\bmarcas?\b/.test(n))                                              lead = "Por marca todavía no tengo ese corte. ";
  else if (/\bfamilias?\b/.test(n))                                            lead = "Por familia todavía no tengo ese corte. ";

  // 3 · entidad (palabra o nombre concreto detectado)
  const eClient = (detectAllClientsInText(text) || []).length > 0 || /\bclientes?\b|\bcuentas?\b/.test(n);
  const eBodega = (detectAllWarehousesInText(text) || []).some(w => w && w !== "Todas") || /\bbodegas?\b|\bsucursal/.test(n);
  const eSku    = /\bskus?\b|\bproductos?\b|\bitems?\b|\barticulos?\b/.test(n);

  // ── composición · se adueña: detecta y ofrece, nunca "no sé" seco ──
  // (a) cruce de 2+ métricas → lo estamos armando, ofrece cada una por separado
  if (metrics.length >= 2) {
    return `Ese cruce de ${metrics[0]} contra ${metrics[1]} lo estoy armando. Por ahora te doy cada una por separado — ¿empezamos por ${metrics[0]} o por ${metrics[1]}?`;
  }
  // (b) 1 métrica de inventario (eje/concepto no soportado) → ofrece por SKU/bodega
  if (mI.length === 1) {
    return `${lead}De ${mI[0]} sí te respondo: por SKU o por bodega. ¿Cuál vemos?`;
  }
  // (c) 1 métrica comercial → ofrece el ranking por las dimensiones que sí tengo
  if (mC.length === 1) {
    const dims = eBodega ? "por SKU o por bodega" : "por cliente o por SKU";
    return `${lead}De ${mC[0]} te doy el ranking ${dims}. ¿Por cuál arrancamos?`;
  }
  // (d) entidad sin métrica clara (o métrica no disponible) → ofrece las métricas de esa entidad
  if (eClient) return `${lead}De tus clientes sí te doy ventas, margen y contribución. ¿Cuál te sirve?`;
  if (eBodega) return `${lead}De tus bodegas te doy capital inmovilizado, rotación y cobertura. ¿Cuál vemos?`;
  if (eSku)    return `${lead}De tus productos te doy margen, contribución, rotación y capital. ¿Por cuál vamos?`;

  // (e) nada concreto → guía general (igual se adueña: ofrece el menú)
  return `${lead}Te puedo hablar de ventas, márgenes o inventario — por cliente, producto o bodega. ¿Por dónde querés arrancar?`;
}
