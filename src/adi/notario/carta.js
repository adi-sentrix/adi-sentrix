/* carta.js · LA CARTA DE HECHOS DEL TURNO (Notario semántico, fase 4 · etapa B · owner 2026-09-16) ═══════════════════════════════
 * «El modelo no debería necesitar conocer convenciones internas de ADI para poder ser verificado correctamente.» La carta es la parte
 * de esas convenciones que SÍ le sirve para declarar: cómo se llaman las referencias de la boleta, qué conjuntos identifica la
 * evidencia (con su tamaño y su única definición), qué rankings existen por eje (para que un superlativo sea un orden con universo),
 * y qué cuentas puede declarar con su evidencia. Viaja pegada a los resultados de las herramientas —junto a la boleta, no en el
 * system: el caché del system no se toca— una vez por turno, y después solo lo nuevo (los subtotales que aparecen en rondas
 * siguientes). Es TEXTO derivado de la evidencia del turno: sin ella no hay carta. Puro: sin I/O, sin red. */
import { conjuntosConocidos } from "./verificar.js";

/* el nombre con que el modelo declara cada ranking de la proyección (el vocabulario de la casa, no una cifra) */
const _NOMBRE_DE_RANKING = {
  ventas: "Ventas", margen: "Margen", contribucion: "Contribución", carga: "Carga comercial", brecha: "Brecha al benchmark", unidades: "Unidades vendidas",
  no_capturada: "Contribución no capturada", saldo_vencido: "Saldo vencido", saldo_pendiente: "Saldo pendiente", recuperado: "Recuperado", dias_vencido: "Días vencido",
  capital: "Capital", capital_frenado: "Capital frenado", capital_inmovilizado: "Capital inmovilizado", rotacion: "Rotación", dias_inventario: "Días de inventario",
  dias_sin_venta: "Días sin venta", margen_inventario: "Margen de inventario", stock: "Unidades en stock",
};
const _PLURAL = { cliente: "clientes", sku: "SKU", marca: "marcas", familia: "familias", bodega: "bodegas", canal: "canales", mes: "meses" };
const _REFERENCIA = /^(?:benchmark de|nivel de carga|techo de|piso de|umbral de|referencia de)/i;   // las referencias declaradas, no cualquier rótulo que las nombre
const _ARTICULO = { cliente: "los", sku: "los", marca: "las", familia: "las", bodega: "las", canal: "los", mes: "los" };
const _NOMBRE_DE_CONJUNTO = { critico: "crítico" };

/** cartaDeHechos(I, { vistos }) → { texto, vistos } · `vistos`: los subtotales ya nombrados en este turno (para no repetirlos) */
export function cartaDeHechos(I, { vistos = null } = {}) {
  if (!I || !Array.isArray(I.figs)) return { texto: "", vistos: vistos || new Set() };
  const yaVistos = vistos || new Set();
  const primera = yaVistos.size === 0 && !yaVistos.has("__carta__");
  const L = [];
  /* los subtotales y grupos de la boleta (con su universo en el rótulo): cada uno se nombra una sola vez por turno */
  const subtotales = I.figs.filter((f) => f.agregado && !f.entidad && (f.grupo || f.n != null || /subtotal/.test(f.conceptoNorm)) && !/(?:^|· )(?:total|subtotal)$/.test(f.conceptoNorm)).map((f) => f.label);
  const nuevos = [...new Set(subtotales)].filter((l) => !yaVistos.has(l)).slice(0, 14);
  for (const l of nuevos) yaVistos.add(l);
  if (!primera) {
    if (!nuevos.length) return { texto: "", vistos: yaVistos };
    return { texto: `[CARTA DE HECHOS — no es el usuario] Subtotales nuevos en tus resultados (declara cada uno con su universo tal como está en el rótulo): ${nuevos.join(" · ")}.`, vistos: yaVistos };
  }
  yaVistos.add("__carta__");
  L.push("[CARTA DE HECHOS — no es el usuario] Lo que tus resultados permiten declarar, con el nombre con que se verifica:");
  /* referencias */
  const refs = []; const vr = new Set();
  for (const f of I.figs) if (!f.entidad && !f.agregado && f.unidad !== "count" && _REFERENCIA.test(f.conceptoNorm) && !vr.has(f.label)) { vr.add(f.label); refs.push(`${f.label} = ${f.texto}`); }
  if (refs.length) L.push(`· Referencias: ${refs.slice(0, 8).join(" · ")}.`);
  /* conjuntos: el eje entero y los que la evidencia identifica, con su tamaño */
  let conjuntos = [];
  try { conjuntos = conjuntosConocidos(I); } catch { conjuntos = []; }
  const porEje = new Map();
  for (const c of conjuntos) { if (!c || !c.set || !c.set.size || /^grupo «/.test(String(c.fuente || ""))) continue; const e = c.eje || "cliente"; if (!porEje.has(e)) porEje.set(e, []); if (!porEje.get(e).some((x) => x.nombre === c.nombre)) porEje.get(e).push({ nombre: _NOMBRE_DE_CONJUNTO[c.nombre] || c.nombre, n: c.set.size }); }
  const partes = [];
  for (const [eje, lista] of porEje) {
    const total = typeof I.tamanoDelEje === "function" ? I.tamanoDelEje(eje) : null;
    partes.push(`${total ? `${_ARTICULO[eje] || "los"} ${total} ${_PLURAL[eje] || eje}` : `${_ARTICULO[eje] || "los"} ${_PLURAL[eje] || eje}`}: ${lista.slice(0, 14).map((x) => `${x.nombre} (${x.n})`).join(" · ")}`);
  }
  if (partes.length) L.push(`· Conjuntos (el universo de un orden, un conteo o un subtotal se nombra así, o con el rótulo del subtotal): ${partes.join(" — ")}.`);
  if (nuevos.length) L.push(`· Subtotales de tus resultados (cada uno con su universo en el rótulo): ${nuevos.join(" · ")}.`);
  /* rankings por eje */
  const rk = [];
  for (const [eje, R] of Object.entries(I.rankings || {})) {
    const nombres = Object.entries(R || {}).filter(([, r]) => r && Array.isArray(r.filas) && r.filas.length).map(([k]) => _NOMBRE_DE_RANKING[k] || k);
    if (nombres.length) rk.push(`${_PLURAL[eje] || eje}: ${nombres.join(" · ")}`);
  }
  if (rk.length) L.push(`· Rankings verificables (un superlativo —la más alta, el que menos, encabeza— es un ORDEN con su universo): ${rk.join(" — ")}.`);
  L.push("· Cuentas que puedes declarar con su evidencia: brecha en puntos = Benchmark de margen − Margen de la cuenta; variación en $ del negocio = Ventas del período − Ventas del año anterior; diferencia o cociente entre dos cifras de la misma métrica; una cifra como parte de otra.");
  L.push("· Toda comparación en palabras (más que, por encima de, lejos de, el doble, casi la mitad, más pegado al costo) es una RELACIÓN con su valor «A vs B»; «N de M» es un CONTEO con universo; una cifra que citas dentro de un orden o una relación se declara también como cifra.");
  return { texto: L.join("\n"), vistos: yaVistos };
}
