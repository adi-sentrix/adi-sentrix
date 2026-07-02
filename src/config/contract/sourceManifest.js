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
  applyScenarioToClientesMargen, applyScenarioToClientesVentas,
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
    schema: { nombre: "string", tipo: "enum(sku)", marca: "string", sfamilia: "string", venta: "money(raw)",
              costo: "money(raw)", rebates: "money(raw)", contribucion: "money(raw)", pctRebate: "pct", margen: "pct",
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
    scenarioLoad: null,                                          // agregación · hoy base (se deriva de sku/cliente · scenario-blind)
    aggregate: true,                                             // ← AGREGADO: contribución almacenada = fuente de verdad · venta×margen = validación con tolerancia agregada (redondeo del margen ponderado)
    keyField: "nombre",
    schema: { nombre: "string", tipo: "enum(marca)", venta: "money(K)", contribucion: "money(K)", margen: "pct",
              pctRebate: "pct", benchmark: "pct", unidades: "count" },
  },
  sfamiliasMargen: {
    origin: { kind: "static", module: "src/data/demoData.js", export: "sfamiliasMargen" },
    load: () => sfamiliasMargen,
    scenarioLoad: (scn) => applyScenarioToSfamiliasMargen(scn),  // scenario-aware (derivada de clientes)
    aggregate: true,                                             // ← AGREGADO: mismo trato que marca (fuente de verdad = almacenada · tolerancia agregada)
    keyField: "nombre",
    schema: { nombre: "string", tipo: "enum(sfamilia)", venta: "money(K)", contribucion: "money(K)", margen: "pct",
              pctRebate: "pct", benchmark: "pct", unidades: "count" },
  },
};
