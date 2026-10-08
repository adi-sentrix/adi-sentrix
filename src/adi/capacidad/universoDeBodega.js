/* === src/adi/capacidad/universoDeBodega.js · QUÉ UNIVERSO ESTÁ DEFINIDO POR BODEGA (Etapa 2, ensayo 6 · owner 2026-10-08) ═══════════════════════════════
 * LA LEY (CLAUDE.md §4, mapa del dato): la bodega es SOLO inventario — no hay venta ni margen por bodega (el dato no dice qué bodega despachó cada venta) y no hay cruce cliente×bodega; venta e
 * inventario nunca se suman. En el ensayo 6 el Complemento la violaba por una puerta lateral: `consultar` aceptaba «los SKU de Lampa» (`universo.bodega`, eje sku) para una métrica COMERCIAL, y el
 * anfitrión sumó esos SKU y los llamó «la venta de Lampa».
 *
 * ESTE ARCHIVO es la mitad PURA de la regla: lee la FORMA de un universo / de una parte y dice si lo define una bodega y qué métricas pide. No lee prosa, no toca el Core, no importa `encargo/` ni `entrega/`
 * (lo comparten `leyDeBodega.js` —el rechazo de `consultar`— y `universoDeLasCifras.js` —el rechazo de `derivar`—, y `derivar.js` puede usarlo sin tocar el Core). Cero `node:*` (corre en `edge`). */
import { metricaPorClave } from "../notario/lexico.js";

const _es = (x) => x != null && typeof x === "object" && !Array.isArray(x);
const _lista = (x) => (Array.isArray(x) ? x : x == null ? [] : [x]);
const _nombres = (x) => _lista(x).map((n) => String(n).trim()).filter(Boolean);
const _PROF_MAX = 4;
const _str = (x) => typeof x === "string" && x.trim() !== "";

export const MOTIVO_VENTA_POR_BODEGA = "venta_por_bodega";
const _unir = (xs) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}`);
const _BODEGAS_MAX = 4;

/** textoDeLaLey({ bodegas, enDerivacion }) → la razón, en palabras de negocio. La MISMA frase en el rechazo de `consultar` y en el de `derivar` (cambia solo lo que se ofrece). */
export function textoDeLaLey({ bodegas = [], enDerivacion = false } = {}) {
  const ns = (Array.isArray(bodegas) ? bodegas : []).filter(_str);
  const inv = !ns.length ? "el inventario por bodega" : ns.length <= _BODEGAS_MAX ? `el inventario de ${_unir(ns)}` : `el inventario de ${_unir(ns.slice(0, _BODEGAS_MAX - 1))} y ${ns.length - (_BODEGAS_MAX - 1)} bodegas más`;
  const base = "La venta no se abre por bodega: el dato no dice qué bodega despachó cada venta, y tampoco su margen, contribución ni unidades.";
  return enDerivacion
    ? `${base} Sumar o comparar las ventas de los productos de una bodega no da la venta de esa bodega, así que no se arma. Puedo darle ${inv}, o derivar sobre la venta de los productos que usted nombre.`
    : `${base} Puedo darle ${inv}, o la venta de los productos que usted nombre.`;
}

/** bodegasDelUniverso(u) → { definido, nombres } · ¿el universo lo define una bodega? — `bodega`, `excluir.bodega`, una rama de `union`, o ser un universo DEL EJE bodega — y cuáles nombra */
export function bodegasDelUniverso(u, _prof = 0) {
  const out = { definido: false, nombres: [] };
  if (!_es(u) || _prof > _PROF_MAX) return out;
  const sumar = (ns) => { for (const n of ns) if (!out.nombres.includes(n)) out.nombres.push(n); };
  const b = _nombres(u.bodega);
  if (b.length) { out.definido = true; sumar(b); }
  if (_es(u.excluir)) { const e = _nombres(u.excluir.bodega); if (e.length) { out.definido = true; sumar(e); } }
  if (u.eje === "bodega") out.definido = true;
  for (const v of _lista(u.union)) { const r = bodegasDelUniverso(v, _prof + 1); if (r.definido) { out.definido = true; sumar(r.nombres); } }
  return out;
}

/** metricasDelUniverso(u) → [clave] · las métricas con que el universo se RECORTA (`top.metrica`, `filtros[].metrica`, `excluir.top[].metrica`, y las de cada rama de `union`): una selección por venta dentro de una bodega también es venta × bodega */
export function metricasDelUniverso(u, _prof = 0) {
  const out = [];
  if (!_es(u) || _prof > _PROF_MAX) return out;
  const poner = (m) => { if (typeof m === "string" && m.trim() && !out.includes(m.trim())) out.push(m.trim()); };
  if (_es(u.top)) poner(u.top.metrica);
  for (const f of _lista(u.filtros)) if (_es(f)) poner(f.metrica);
  if (_es(u.excluir)) for (const t of _lista(u.excluir.top)) if (_es(t)) poner(t.metrica);
  for (const v of _lista(u.union)) for (const m of metricasDelUniverso(v, _prof + 1)) poner(m);
  return out;
}

/** esMetricaComercial(clave, tema?) → ¿es una métrica del dominio comercial (venta, margen, contribución, unidades vendidas, carga, costo, brechas…)? Una sin dominio propio (la participación) es comercial cuando la parte es de Comercial. */
export function esMetricaComercial(clave, tema = null) {
  if (typeof clave !== "string") return false;
  const m = metricaPorClave(clave);
  return Boolean(m) && (m.dominio === "comercial" || (m.dominio == null && tema === "comercial"));
}

/** parteDefinidaPorBodega(parte, { ejeDeEntidad? }) → { porBodega, campo, valor, bodegas } · ¿la parte pide algo por bodega? —universo de bodega, eje bodega, o entidades de la bodega—. `ejeDeEntidad(nombre)` (opcional, lo pone quien tiene el
 *  tenant activo) dice el eje de una entidad dada sin eje; sin él solo cuentan las que lo declaran. */
export function parteDefinidaPorBodega(p, { ejeDeEntidad = null } = {}) {
  const sin = { porBodega: false, campo: null, valor: null, bodegas: [] };
  if (!_es(p)) return sin;
  const u = _es(p.universo) ? p.universo : null;
  const bu = bodegasDelUniverso(u);
  const bodegas = [...bu.nombres];
  let campo = bu.definido ? "universo" : null, valor = bu.definido ? p.universo : null, porBodega = bu.definido;
  if (p.eje === "bodega") { porBodega = true; if (!campo) { campo = "eje"; valor = "bodega"; } }
  for (const ref of _lista(p.entidades)) {
    const nombre = typeof ref === "string" ? ref : (_es(ref) && typeof ref.nombre === "string" ? ref.nombre : null);
    if (!nombre) continue;
    const eje = _es(ref) && typeof ref.eje === "string" ? ref.eje : (typeof ejeDeEntidad === "function" ? ejeDeEntidad(nombre) : null);
    if (eje === "bodega") { porBodega = true; if (!bodegas.includes(nombre)) bodegas.push(nombre); if (!campo) { campo = "entidad"; valor = ref; } }
  }
  return porBodega ? { porBodega, campo, valor, bodegas } : sin;
}
