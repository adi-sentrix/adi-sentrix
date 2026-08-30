/* === src/adi/sentrix/headline.js · LOS TOTALES DE CABECERA · UNA SOLA VERDAD POR CIFRA =========================
 * (owner 2026-08-09 · decisión 6 · hallazgo E del Contrato de Concordancia)
 *
 * EL PROBLEMA QUE CIERRA. Las cinco cifras más visibles del producto —las cards de arriba de Comercial y de
 * Capital— no tenían equivalente en el oráculo. La pantalla muestra un TOTAL y la tool que el manifiesto declaraba
 * como su evidencia devolvía un RANKING por entidad: ADI no podía contrastar su propia cabecera, y por lo tanto
 * podía contestarla con otra cosa. El gate lo dice literal: «la pantalla muestra el TOTAL de X y la tool sólo
 * devuelve el ranking por entidad, nunca su total».
 *
 * LA REGLA DEL OWNER, TEXTUAL: «NO reconstruir el total sumando rankings si existe una fuente oficial». Por eso
 * este módulo NO suma la salida de ninguna tool. Cada total sale de la MISMA función que ya alimenta la pantalla:
 *   · lo comercial   `buildCuadroMando("cliente", scenario).total` — el objeto que la card de Comercial pinta;
 *   · lo de capital  `diagnoseInventario(applyScenarioToSkuInventario(scenario))` — el motor sellado del inventario.
 * No hay una segunda aritmética: si el builder cambia, este módulo cambia con él, porque es el builder. Eso es
 * también lo que exige la regla dura de que Sentrix y ADI consuman LA MISMA transformación de escenario.
 *
 * LA ROTACIÓN MEDIA, Y POR QUÉ ACÁ VIVE UNA SOLA. En el producto convivían TRES rotaciones medias con el mismo
 * nombre: 6,0x ponderada por capital (la card de Capital), 5,8x promedio simple (el pie de la tabla de drill, que
 * el owner creía código muerto y está VIVO en `SentrixPanel.jsx`) y el promedio simple implícito de rankear
 * `queryMetric{rotacion}`. Dos números distintos bajo la etiqueta «rotación media», en la misma cara. La verdad
 * que queda es la PONDERADA POR CAPITAL —es la que el manifiesto declara (`cierraCon: "Σ rotación × capital ÷ Σ
 * capital"`) y la única que responde la pregunta del negocio: cuántas veces al año rota el dinero que está
 * inmovilizado, no cuántas veces rota un SKU promedio sin importar cuánto pesa. `rotacionPonderada` es esa única
 * implementación y la importan los dos lados.
 *
 * QUÉ NO ES. No es un catálogo de métricas (eso es `metricRegistry`) ni un formateador de cifras (eso es la
 * boleta): es la lista CERRADA de los agregados que el producto muestra como cabecera, cada uno con su fuente,
 * su fórmula, su universo y su período declarados — para que la cifra que ADI dice y la que Sentrix pinta sean,
 * verificablemente, la misma. Cero nombres de tenant, cero cifras: sólo estructura y procedencia.
 */
import { buildCuadroMando } from "./cuadro.js";
import { applyScenarioToSkuInventario } from "../../engine/scenarios.js";
import { diagnoseInventario } from "../diagnosis/economicDiagnosis.js";
import { getTenantId, getTenantData, onTenantChange } from "../../data/tenantStore.js";
import { UNIVERSOS, factorComercialDe } from "../../config/contract/figureType.js";   // el PERÍODO es del universo, no se declara dos veces · la escala la DECLARA el pack

const _r1 = (n) => Math.round(n * 10) / 10;

/* ── LA ROTACIÓN MEDIA · UNA implementación, la ponderada por capital ─────────────────────────────────────────
 * El cuerpo se mudó a `./rotacion.js` el 2026-08-10 (sin tocar la cuenta) para que `cuadro.js` pueda consumirlo:
 * este archivo IMPORTA cuadro.js, así que el Cuadro no podía importar de acá sin un ciclo — y seguía publicando un
 * promedio SIMPLE local en su fila Total (5,3x eje bodega · 5,8x eje SKU contra los 6,0x de la cara Capital).
 * Se re-exporta para que todo importador existente (mesaCapital.js, _totales_cabecera_gate) siga igual. */
export { rotacionPonderada } from "./rotacion.js";
import { rotacionPonderada } from "./rotacion.js";
import { ESCENARIO_INICIAL } from "../../config/scenarios.js";   // R6 (retrabajo ultracode): el fallback «actual» dejaba armar el PLAN sobre la carpeta cruda

/* ── LAS DOS FUENTES OFICIALES, memoizadas por tenant+escenario ───────────────────────────────────────────────
 * `buildCuadroMando` arrastra la capa de asesor (que corre el diagnose), así que llamarlo por cada fila de un
 * ranking sería caro sin motivo: los builders son PUROS para un tenant y un escenario dados. La caché se limpia
 * cuando cambia el tenant, y la clave lo incluye igual — dos candados para el mismo riesgo. */
const _cache = new Map();
onTenantChange(() => _cache.clear());
function _memo(clave, fn) {
  const k = `${getTenantId()}::${clave}`;
  if (_cache.has(k)) return _cache.get(k);
  const v = fn();
  _cache.set(k, v);
  return v;
}
const _totalComercial = (scenario) => _memo(`comercial::${scenario}`, () => (buildCuadroMando("cliente", scenario) || {}).total || {});
const _inventario = (scenario) => _memo(`inventario::${scenario}`, () => {
  const inv = applyScenarioToSkuInventario(scenario) || [];
  return { inv, D: diagnoseInventario(inv, {}) };
});

/* ── EL REGISTRO · métrica@eje → el total de cabecera que la pantalla muestra ─────────────────────────────────
 * La clave es `metrica@eje` porque un total de cabecera SÓLO existe para el corte del que el producto lo afirma:
 * la venta del negocio se totaliza por cliente (la venta oficial), no por SKU ni por marca — ahí el mismo dinero
 * está repartido por otra granularidad y un "total" sería una segunda suma sin dueño. Lo que no está declarado
 * acá NO tiene total: la tool devuelve su ranking y nada más, que es la respuesta honesta.
 *
 * Cada entrada declara, además del valor: `label` (la etiqueta con que la cifra entra a la boleta, en la misma
 * convención que ya usa el ledger), `unidad`, `escala` (la del universo — miles para lo comercial, dólares crudos
 * para el inventario), `universo` y `periodo` (los de `figureType`), `sujeto` (de quién es la cifra: decisión 7,
 * ninguna cifra sin dueño), `fuente` y `formula` (de dónde sale y cómo, verificable). */
export const HEADLINES = {
  "ventas@cliente": {
    label: "Venta total", unidad: "money", escala: "K",
    universo: "venta_comercial", sujeto: "el negocio completo",
    fuente: "buildCuadroMando('cliente', escenario).total.ventas · clientesVentas.actual con el escenario aplicado (la venta oficial por cliente)",
    formula: "Σ venta oficial por cliente",
    valor: (scn) => _totalComercial(scn).ventas,
  },
  "contribucion@cliente": {
    label: "Contribución total", unidad: "money", escala: "K",
    universo: "venta_comercial", sujeto: "el negocio completo",
    fuente: "buildCuadroMando('cliente', escenario).total.contribucion · clientesMargen con el escenario aplicado",
    formula: "Σ contribución por cliente",
    valor: (scn) => _totalComercial(scn).contribucion,
  },
  "margen@cliente": {
    label: "Margen promedio", unidad: "pct",
    universo: "tasa_comercial", sujeto: "el negocio completo",
    fuente: "buildCuadroMando('cliente', escenario).total.margen",
    // PONDERADO, no promedio de márgenes: es la misma cifra que la card muestra y la única que cierra con la
    // contribución y la venta del mismo total. El promedio simple de los márgenes por cliente es OTRO número.
    formula: "contribución total ÷ venta total × 100 (ponderado por venta)",
    valor: (scn) => _totalComercial(scn).margen,
  },
  "acciones@cliente": {
    label: "Acciones comerciales · total", unidad: "money", escala: "K",
    universo: "venta_comercial", sujeto: "el negocio completo",
    fuente: "buildCuadroMando('cliente', escenario).total.acciones · clientesMargen.rebates con el escenario aplicado",
    formula: "Σ acciones comerciales (rebates y descuentos) por cliente",
    valor: (scn) => _totalComercial(scn).acciones,
  },
  "capital@sku": {
    label: "Capital en inventario · total", unidad: "money", escala: "raw",
    universo: "inventario", sujeto: "todo el inventario",
    fuente: "diagnoseInventario(applyScenarioToSkuInventario(escenario)).total · el mismo motor que pinta el mapa del capital",
    formula: "Σ capital por SKU",
    valor: (scn) => _inventario(scn).D.total,
  },
  "rotacion@sku": {
    label: "Rotación media", unidad: "ratio",
    universo: "rotacion", sujeto: "todo el inventario",
    fuente: "rotacionPonderada(applyScenarioToSkuInventario(escenario)) · la MISMA función que usa la card de Capital",
    formula: "Σ (rotación × capital) ÷ Σ capital",
    // La rotación por SKU es un campo DECLARADO por la fuente (no se deriva de días de inventario: cierra en 0 de
    // 13 filas), y un ponderado de campos declarados hereda esa condición. Lo sella `figureType`, no este módulo.
    valor: (scn) => rotacionPonderada(_inventario(scn).inv),
  },
};

/* headlineTotal(metrica, eje, escenario) → { ...declaración, valor, raw } | null
 * `raw` viene SIEMPRE en dólares (la escala del universo ya aplicada), que es la convención de `fig().raw` en todo
 * el motor desde la decisión 1: mezclar miles y dólares crudos en ese campo fue el error de ×1.000 que autorizaba
 * sumas falsas. `valor` conserva la escala nativa de la fuente para quien necesite recomponerla. */
export function headlineTotal(metrica, eje, escenario) {
  const d = HEADLINES[`${metrica}@${eje}`];
  if (!d) return null;
  const v = d.valor(escenario || ESCENARIO_INICIAL);
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  // EL PERÍODO NO SE DECLARA ACÁ, SE LEE DEL UNIVERSO. Estaba escrito a mano ("año cerrado" / "foto de inventario
  // a hoy") al lado del universo que ya lo declara, y eso es una segunda verdad esperando divergir — el mismo
  // desalineamiento de dos declaraciones que la decisión 1 prohíbe. `figureType.UNIVERSOS` manda.
  const periodo = (UNIVERSOS[d.universo] || {}).periodo || null;
  /* «K» acá significa «se almacena en la escala del universo comercial» — y ESA escala la declara el pack
   * (factorComercialDe · owner 2026-08-30): miles en los tenants de fábrica, moneda cruda en la planilla. */
  return { ...d, periodo, valor: v, raw: d.unidad === "money" && d.escala === "K" ? v * factorComercialDe(getTenantData()) : v };
}

/* headlineDe(componentId-ish) — atajo de lectura para quien tiene la métrica y el eje sueltos. */
export const tieneHeadline = (metrica, eje) => !!HEADLINES[`${metrica}@${eje}`];
