/* === config/contract/sourceManifest.js · CONTRATO DE DATOS · Paso 3 ===
 * DE DÓNDE VIENE CADA DATO. Aditivo: apunta a los exports que YA existen (el motor sellado los lee directo, sin cambios).
 * Este módulo NO transforma ni recalcula — solo DECLARA la fuente, su schema y cómo el escenario la ajusta.
 *
 * EXTENSIBILIDAD (la prueba del Paso 3): un dominio NUEVO mañana entra como una entrada más acá —
 *   origin { kind:"excel"|"api"|"static", ... } + su schema + su scenarioLoad — sin tocar el motor.
 *
 * `origin.kind`: hoy todo "static" (JS sellado). Mañana un productor nuevo puede declararse "excel"/"api"; el loader
 * (paso futuro) transforma ese origen a este mismo contrato. El resto del contrato no se entera de dónde vino.
 * `scenarioLoad`: cómo el escenario ajusta la fuente. null = SCENARIO-BLIND (el dato no se mueve por escenario · hoy: skusMargen). */
import { clientesMargen, clientesVentas, marcasMargen, sfamiliasMargen, skuInventario } from "../../data/demoData.js";
import { skusMargen } from "../../data/skusMargen.js";
import {
  applyScenarioToClientesMargen, applyScenarioToClientesVentas, applyScenarioToMarcasMargen,
  applyScenarioToSfamiliasMargen, applyScenarioToSkuInventario,
} from "../../engine/scenarios.js";

// tipos del schema (vocabulario del contrato · el validador los usa para chequear escala/tipo):
//   string · count(entero) · pct(%) · money(K)=$ en miles · money(raw)=$ crudo · money(unit)=$ por unidad · ratio(x) · days(d) · enum(...)
export const SOURCES = {
  clientesMargen: {
    origin: { kind: "static", module: "src/data/demoData.js", export: "clientesMargen" },
    load: () => clientesMargen,
    scenarioLoad: (scn) => applyScenarioToClientesMargen(scn),   // scenario-aware
    keyField: "nombre",
    rowFilter: (r) => r.tipo === "cliente",
    schema: { nombre: "string", tipo: "enum(cliente)", venta: "money(K)", costo: "money(K)", rebates: "money(K)",
              contribucion: "money(K)", pctRebate: "pct", margen: "pct", benchmark: "pct", unidades: "count",
              costoMedio: "money(unit)", precioLista: "money(unit)", marca: "string", sfamilia: "string" },
  },
  clientesVentas: {
    origin: { kind: "static", module: "src/data/demoData.js", export: "clientesVentas" },
    load: () => clientesVentas,
    scenarioLoad: (scn) => applyScenarioToClientesVentas(scn),   // scenario-aware
    keyField: "nombre",
    schema: { nombre: "string", actual: "money(K)", anterior: "money(K)", presupuesto: "money(K)",
              unidades: "count", unidadesAnt: "count", pctRebate: "pct", canal: "string", marca: "string", sfamilia: "string" },
  },
  skusMargen: {
    origin: { kind: "static", module: "src/data/skusMargen.js", export: "skusMargen" },
    load: () => skusMargen,
    scenarioLoad: null,                                          // ← SCENARIO-BLIND (el motor no ajusta skusMargen · info declarada)
    keyField: "nombre",
    // ESCALA ALINEADA (owner 2026-08-09, decisión 1). Acá decía `money(raw)` mientras metricRegistry declaraba
    // `scale: { sku: "K" }` para las MISMAS columnas: el contrato afirmaba dos cosas del mismo campo, que es
    // exactamente el desalineamiento que ya había roto Capital. Manda `money(K)`, y no por convención: Σ
    // skusMargen.venta = 100.000, que es el mismo $100.0M que Sentrix muestra como venta del negocio y el mismo
    // total que suman clientesVentas, marcasMargen y sfamiliasMargen. `raw` habría hecho que el SKU líder valiera
    // $13.3K contra los $13.3M del motor — dos verdades para la misma cifra.
    // costoMedio/precioLista siguen siendo money(unit): son $ por unidad, crudos, y por eso `unidades × precioLista`
    // NO cierra contra `venta` — divergencia declarada en config/contract/figureType.js, no un error de este schema.
    schema: { nombre: "string", tipo: "enum(sku)", marca: "string", sfamilia: "string", venta: "money(K)",
              costo: "money(K)", rebates: "money(K)", contribucion: "money(K)", pctRebate: "pct", margen: "pct",
              benchmark: "pct", unidades: "count", costoMedio: "money(unit)", precioLista: "money(unit)" },
  },
  skuInventario: {
    origin: { kind: "static", module: "src/data/demoData.js", export: "skuInventario" },
    load: () => skuInventario,
    scenarioLoad: (scn) => applyScenarioToSkuInventario(scn),    // scenario-aware
    keyField: "sku",
    schema: { sku: "string", bodega: "string", marca: "string", sfamilia: "string", stockUSD: "money(raw)",
              stockUnd: "count", rotacion: "ratio(x)", doh: "days(d)", cobertura: "days(d)", margenPct: "pct",
              diasSinVenta: "days(d)", vendidoMes: "count", ventaDiaria: "count", estado: "string", alerta: "string" },
  },
  marcasMargen: {
    origin: { kind: "static", module: "src/data/demoData.js", export: "marcasMargen" },
    load: () => marcasMargen,
    /* ⚠️ CABLEADO POR ORDEN DEL OWNER (2026-09-09), textual: «No quiero dos verdades para el eje marca. Si el
     * usuario ingresa marca en la planilla, Sentrix y ADI deben decir lo mismo, en lo que sea.»
     *
     * QUÉ PASABA, medido en el escenario que muestra la app: la pantalla decía Samsung $33.2M (de
     * `marcasVentas`, que SÍ se mueve con el escenario) y ADI decía $31.6M (de esta tabla, que estaba
     * declarada ciega). Las 4 marcas divergían: Philips $29.4M vs $28.0M · LG $25.8M vs $24.6M · Bosch $11.5M
     * vs $11.0M. Preguntar «cuánto vendió Samsung» daba una cifra distinta según a quién le preguntaras.
     *
     * `applyScenarioToMarcasMargen` ya existía SIN USAR y hace exactamente lo que corresponde: toma la venta de
     * `applyScenarioToMarcasVentas` —la MISMA fuente que pinta la pantalla— y re-deriva contribución y costo
     * conservando el margen% reportado (el margen es la eficiencia de la marca, no se recalcula). Por eso el
     * arreglo va ACÁ, en el contrato, y no herramienta por herramienta: todo consumidor que pase por el
     * manifiesto recibe la misma cifra, que es la definición de «una sola verdad» de esta casa.
     *
     * ⚠️ Y FUNCIONA IGUAL CON LA PLANILLA DE UN CLIENTE: sin transformación de escenario declarada —el caso de
     * todo pack de ingesta— la función devuelve la tabla del tenant activo tal cual, sin tocar un número. */
    scenarioLoad: (scn) => applyScenarioToMarcasMargen(scn),     // ← una sola verdad por marca (antes: scenario-blind)
    aggregate: true,                                             // ← AGREGADO: contribución almacenada = fuente de verdad · venta×margen = validación con tolerancia agregada (redondeo del margen ponderado)
    keyField: "nombre",
    schema: { nombre: "string", tipo: "enum(marca)", venta: "money(K)", costo: "money(K)", contribucion: "money(K)", margen: "pct",
              pctRebate: "pct", benchmark: "pct", unidades: "count" },   // costo: el dato SIEMPRE lo trajo — el contrato lo declara (caza del _tenant_gate en modo ci · metricRegistry lo expandió 2026-07-09)
  },
  sfamiliasMargen: {
    origin: { kind: "static", module: "src/data/demoData.js", export: "sfamiliasMargen" },
    load: () => sfamiliasMargen,
    scenarioLoad: (scn) => applyScenarioToSfamiliasMargen(scn),  // scenario-aware (derivada de clientes)
    aggregate: true,                                             // ← AGREGADO: mismo trato que marca (fuente de verdad = almacenada · tolerancia agregada)
    keyField: "nombre",
    schema: { nombre: "string", tipo: "enum(sfamilia)", venta: "money(K)", costo: "money(K)", contribucion: "money(K)", margen: "pct",
              pctRebate: "pct", benchmark: "pct", unidades: "count" },   // costo declarado (misma caza que marca)
  },
};
