/* === data/clienteSkuMatrix.js · LA MATRIZ CLIENTE×SKU del set de demo (owner 2026-07-10) ===
 * "Cuando el usuario hace click en ABC, el 80% debe decir cómo se compone SU venta/contribución." La composición
 * de un cliente por SKU (y la transpuesta: quiénes compran un SKU) necesita la matriz transaccional — este módulo
 * la CONSTRUYE determinística para el set de demo, con la regla de oro: TODO CIERRA.
 *
 *   · Por CLIENTE cierra EXACTO: Σ_sku venta(c,s) = la venta del cuadro (clientesVentas.actual) y
 *     Σ_sku contribución(c,s) = la contribución del cuadro (clientesMargen.contribucion) — al peso.
 *   · Por SKU cierra PROPORCIONAL: el set de demo trae drift declarado entre agregados (clientes ≈ $23.9M de
 *     contribución vs familias ≈ $25.6M) → el lado SKU se normaliza al total de clientes (forma fiel, no dos verdades).
 *   · AFINIDAD real del set: cada cliente compra sobre todo su marca dominante (clientesMargen.marca), algo de su
 *     familia, y poco del resto — IPF (ajuste proporcional iterativo) determinístico, sin azar.
 *
 * Cuando llegue el ERP (C.3), este módulo se reemplaza por la matriz real — la UI y los helpers no cambian. */
import { clientesVentas, clientesMargen } from "./demoData.js";
import { skusMargen } from "./skusMargen.js";

const _CLIENTES = clientesMargen.map((c) => {
  const cv = clientesVentas.find((x) => x.nombre === c.nombre);
  return { nombre: c.nombre, marca: c.marca, sfamilia: c.sfamilia, venta: cv ? cv.actual : c.venta, contribucion: c.contribucion };
});
const _SKUS = skusMargen.map((s) => ({ nombre: s.nombre, marca: s.marca, sfamilia: s.sfamilia, venta: s.venta, contribucion: s.contribucion }));

// afinidad determinística: la marca dominante manda, la familia acompaña, el resto es cola de surtido
const _w = (c, s) => (s.marca === c.marca ? 1 : s.sfamilia === c.sfamilia ? 0.45 : 0.12);

// IPF: filas → marginal de clientes (EXACTO al final) · columnas → marginal de SKUs normalizado al total de clientes
function _ipf(campo) {
  const rowT = _CLIENTES.map((c) => Number(c[campo]) || 0);
  const totalR = rowT.reduce((a, b) => a + b, 0) || 1;
  const colRaw = _SKUS.map((s) => Number(s[campo]) || 0);
  const totalC = colRaw.reduce((a, b) => a + b, 0) || 1;
  const colT = colRaw.map((v) => (v / totalC) * totalR);
  let M = _CLIENTES.map((c) => _SKUS.map((s) => _w(c, s)));
  for (let it = 0; it < 30; it++) {
    M = M.map((row, i) => { const s = row.reduce((a, b) => a + b, 0) || 1; return row.map((v) => (v * rowT[i]) / s); });
    const colS = _SKUS.map((_, j) => M.reduce((a, row) => a + row[j], 0) || 1);
    M = M.map((row) => row.map((v, j) => (v * colT[j]) / colS[j]));
  }
  // cierre EXACTO por cliente (la ficha muestra al cliente): re-escala fila + redondeo con cuadre en el mayor
  return M.map((row, i) => {
    const s = row.reduce((a, b) => a + b, 0) || 1;
    const exact = row.map((v) => (v * rowT[i]) / s);
    const out = exact.map((v) => Math.round(v));
    const diff = rowT[i] - out.reduce((a, b) => a + b, 0);
    const jMax = exact.indexOf(Math.max(...exact));
    out[jMax] += diff;
    return out;
  });
}

const _VENTA = _ipf("venta");
const _CONTRIB = _ipf("contribucion");
const _iC = new Map(_CLIENTES.map((c, i) => [c.nombre, i]));
const _iS = new Map(_SKUS.map((s, i) => [s.nombre, i]));

// composición de UN cliente (por SKU) · metric "ventas" | "contribucion" → [{ name, value }] desc, sin ceros
export function composicionCliente(nombre, metric = "ventas") {
  const i = _iC.get(nombre);
  if (i == null) return null;
  const M = metric === "contribucion" ? _CONTRIB : _VENTA;
  return _SKUS.map((s, j) => ({ name: s.nombre, value: M[i][j] })).filter((r) => r.value > 0).sort((a, b) => b.value - a.value);
}

// la transpuesta: quiénes compran UN SKU → [{ name, value }] desc (mismo cierre por construcción)
export function compradoresSku(sku, metric = "ventas") {
  const j = _iS.get(sku);
  if (j == null) return null;
  const M = metric === "contribucion" ? _CONTRIB : _VENTA;
  return _CLIENTES.map((c, i) => ({ name: c.nombre, value: M[i][j] })).filter((r) => r.value > 0).sort((a, b) => b.value - a.value);
}

// para el gate de conexión: los marginales por cliente deben cerrar EXACTO con el cuadro
export function _matrixMarginals() {
  return _CLIENTES.map((c, i) => ({
    nombre: c.nombre, venta: c.venta, contribucion: c.contribucion,
    ventaM: _VENTA[i].reduce((a, b) => a + b, 0), contribM: _CONTRIB[i].reduce((a, b) => a + b, 0),
  }));
}
