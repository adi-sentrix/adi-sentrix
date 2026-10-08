/* === src/adi/capacidad/supuestoTexto.js · LA FRASE DE UN SUPUESTO, EN UN SOLO LUGAR (ensayo 9, owner 2026-10-09) ═══════════════════════════════════════════════════════
 * La Entrega dice un supuesto de simulación con una frase de negocio («el precio sube 5%», «la carga comercial baja 1 punto»); `derivar` tiene que decir el MISMO supuesto cuando una cifra
 * derivada sale de un resultado simulado («… bajo el supuesto s1: el precio sube 5%»). Dos copias de la frase se desincronizan: esta hoja es la única (PURA: solo el léxico de la casa y
 * el formato de la casa; no importa nada de `entrega/` ni de `encargo/`, corre en edge). `entrega/componer.js` la usa para sus encabezados y `capacidad/derivar.js` para la descripción. */
import { metricaDeClave } from "../notario/lexico.js";
import { formatoDeLaCasa } from "../notario/hechos.js";

const _min = (clave) => String(metricaDeClave(clave)).toLowerCase();
/** el concepto de negocio de cada tipo de supuesto (nunca el tipo interno): los que el léxico conoce (carga · costo · margen) con SU rótulo en minúscula; «precio» y «volumen» no son conceptos del léxico */
export const CONCEPTO_DE_SUPUESTO = Object.freeze({ carga: `la ${_min("carga")}`, costo: `el ${_min("costo")}`, price: "el precio", growth: "el volumen", margin: `el ${_min("margen")}` });

/** fraseDeSupuesto(s) → «el precio sube 5%» | null (un tipo sin concepto de negocio nombrable) · el margen se dice en PUNTOS, un monto con el formato de la casa */
export function fraseDeSupuesto(s) {
  if (!s) return null;
  const concepto = CONCEPTO_DE_SUPUESTO[s.tipo];
  if (!concepto || !Number.isFinite(s.valor)) return null;
  const magnitud = Math.abs(s.valor);
  const unidadTxt = s.unidad === "pp" || (s.tipo === "margin" && s.unidad === "pct") ? (magnitud === 1 ? "1 punto" : `${magnitud} puntos`) : s.unidad === "pct" ? `${magnitud}%` : s.unidad === "money" ? formatoDeLaCasa(magnitud, "money") : `${magnitud} ${s.unidad}`;
  const verbo = s.valor > 0 ? "sube" : s.valor < 0 ? "baja" : "se mueve";
  return `${concepto} ${verbo} ${unidadTxt}`;
}

/** supuestosDeLaEntrega(entrega, ids?) → los supuestos que una Entrega GUARDADA tomó (los que sus partes `simulacion` citan en el encargo que el libro conservó), opcionalmente solo los `ids` (cadena «s1+s2») */
export function supuestosDeLaEntrega(entrega, ids = null) {
  const enc = entrega && entrega.encargo && typeof entrega.encargo === "object" ? entrega.encargo : null;
  if (!enc || !Array.isArray(enc.supuestos)) return [];
  const citados = new Set();
  for (const p of Array.isArray(enc.partes) ? enc.partes : []) if (p && p.cierre === "simulacion" && Array.isArray(p.supuestos)) for (const x of p.supuestos) if (typeof x === "string") citados.add(x);
  const pedidos = typeof ids === "string" && ids ? new Set(ids.split("+")) : null;
  return enc.supuestos.filter((s) => s && typeof s.id === "string" && citados.has(s.id) && (!pedidos || pedidos.has(s.id)));
}

/** textoDeSupuestos(supuestos) → «s1: el precio sube 5% en Samsung; s2: el costo sube 10% en el negocio» · cada supuesto con su id (el que el anfitrión planteó) y su alcance */
export function textoDeSupuestos(supuestos) {
  return (Array.isArray(supuestos) ? supuestos : []).map((s) => {
    const f = fraseDeSupuesto(s);
    if (!f) return null;
    const donde = s.alcance === "negocio" ? "en el negocio" : s.alcance && s.alcance.nombre ? `en ${s.alcance.nombre}` : "";
    return `${s.id}: ${f}${donde ? ` ${donde}` : ""}`;
  }).filter(Boolean).join("; ");
}
