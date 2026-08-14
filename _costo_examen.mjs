/* Costo real del examen ejecutivo por el camino natural. CERO red — usa la tarifa declarada y los tokens
 * MEDIDOS en las corridas (system natural ≈ persona + carpeta + doctrina; salida real medida). */
import { MODEL_PRICING, costoLlamadaUSD } from "./src/adi/llm/modelPricing.js";
import { proyectarDatoNegocio } from "./src/adi/oracle/datoProyectado.js";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
initTenant(TENANT_DEMO);

const s = Object.entries(MODEL_PRICING).find(([k]) => /sonnet/i.test(k));
console.log("tarifa declarada:", s ? s[0] + " → " + JSON.stringify(s[1]) : "(no encontrada)");
// medido en la corrida de los ojos: NARRAR in≈9.322 con cache_read 26.637; el system natural es del mismo orden.
// ratio medido del corpus: 2,12 chars/token (tablas densas). La carpeta:
const carpeta = proyectarDatoNegocio("actual").length;
const tokCarpeta = Math.round(carpeta / 2.12);
console.log(`carpeta: ${carpeta} chars ≈ ${tokCarpeta} tokens (ratio medido 2,12)`);
const SYS = tokCarpeta + 3500;   // + persona + doctrina notarial + contrato de cálculo
const OUT = 700;                 // salida media medida (1.023 chars ≈ 480 tok; se toma holgado)
const IN = s[1].in / 1e6, OUT_P = s[1].out / 1e6;
const primera = SYS * IN * 1.25 + OUT * OUT_P;          // escribe caché (1.25×)
const siguiente = SYS * IN * 0.1 + OUT * OUT_P;         // lee caché (0.1×)
console.log(`  1er turno (escribe caché): US$${primera.toFixed(4)}`);
console.log(`  turnos siguientes:         US$${siguiente.toFixed(4)}  · con una reparación: US$${(siguiente * 2).toFixed(4)}`);
console.log(`\nTU EXAMEN (4 × 5 turnos = 20, asumiendo la mitad con reparación):`);
console.log(`  ≈ US$${(primera + 19 * siguiente * 1.5).toFixed(2)}  (unos ${Math.round((primera + 19 * siguiente * 1.5) * 950)} pesos chilenos)`);
console.log(`\nsystem del camino natural ≈ ${SYS} tokens · salida media ≈ ${OUT} tokens`);
