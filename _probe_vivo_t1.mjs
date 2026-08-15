/* Sonda OFFLINE: juzga el TEXTO QUE SALIÓ A PANTALLA en la app (sin su bloque [[CALCULO]], que ya fue
 * removido) con el mismo contexto del camino natural. Sirve para saber si esas cifras pasaron el muro por
 * sí solas o si fue el contrato de cálculo el que las autorizó. Cero red, cero costo. */
import { guardC } from "./src/adi/oracle/guardC.js";
import { cifrasDelDato } from "./src/adi/oracle/datoProyectado.js";
import { axisEntityNames } from "./src/adi/oracle/entityIndex.js";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
initTenant(TENANT_DEMO);

const VISIBLE = `Los clientes que venden por encima de la media están, todos, por debajo del benchmark de margen (30.1%). Representan $86.0M de los $99.9M vendidos (86% del negocio) y ninguno alcanza la referencia.

| Cliente | Venta | Margen | Brecha vs 30.1% |
|---|---|---|---|
| Falabella | $19.4M | 22.0% | -8.1pp |
| Lider | $17.8M | 21.5% | -8.6pp |
| Jumbo | $17.3M | 24.0% | -6.1pp |
| Sodimac | $8.2M | 23.5% | -6.6pp |
| Tottus | $6.8M | 28.0% | -2.1pp |
| Paris | $6.3M | 26.5% | -3.6pp |
| Mercado Libre | $5.5M | 29.0% | -1.1pp |
| Ripley | $4.7M | 25.0% | -5.1pp |

Qué hacer primero: Falabella. Es el cliente de mayor venta ($19.4M) y el que más contribución potencial deja sobre la mesa: cerrar 8.1pp de brecha en ese volumen equivale a $1.57M adicionales de margen.`;

const _ejes = (a) => { const o = []; for (const e of a) { try { for (const n of axisEntityNames(e)) o.push(n); } catch { } } return o.length ? o : null; };
const v = guardC(VISIBLE, {
  ledger: { figs: [] }, results: [], trace: null,
  question: "Dime cuáles son los clientes que venden mucho pero están bajo el benchmark de margen. Ordénalos por mayor venta y dame un resumen ejecutivo.",
  datoProyectado: cifrasDelDato("actual"),
  entidadesDelTenant: _ejes(["cliente", "sku", "marca"]), duenosDelTenant: _ejes(["cliente", "sku", "marca", "familia", "bodega", "canal"]),
  contentScope: "full", tablePolicy: "auto",
});
console.log(`SIN el bloque de cálculo → ${v.ok ? "PASA (⚠️)" : v.verdict}`);
for (const x of (v.violations || [])) console.log(`  · [${x.kind}] ${String(x.detail).slice(0, 190)}`);
