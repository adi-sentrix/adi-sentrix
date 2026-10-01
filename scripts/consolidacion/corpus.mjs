/* === scripts/consolidacion/corpus.mjs · EL CORPUS DE LOS CONTROLES (consolidación, infraestructura común) ═════════════════
 * El corpus es de dos partes:
 *   1 · LOS CATÁLOGOS: los ~1.600 encargos de los catálogos de validación v13–v28 (más los ajustados a la 43(d) de v13–v19), en
 *       `fixtures/consolidacion/catalogos-v13-v28.json` (solo id + encargo; los armó `construir` desde los catálogos sellados).
 *   2 · EL AZAR: N encargos de `generador.mjs` con semilla fija (miles, válidos y variados).
 * `entregaDe` compone la Entrega de un caso (validar → componer) y la devuelve con todo lo que un control necesita:
 * la Entrega, su texto, la resolución y el DATO de la proyección. OFFLINE. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { RAIZ_POR_DEFECTO } from "./base.mjs";
import { generarEncargos } from "./generador.mjs";

export const RUTA_CATALOGOS = join(RAIZ_POR_DEFECTO, "fixtures", "consolidacion", "catalogos-v13-v28.json");

/** cargarCatalogos() → [{ origen:"catalogo", id, encargo }] */
export function cargarCatalogos(ruta = RUTA_CATALOGOS) {
  const J = JSON.parse(readFileSync(ruta, "utf8"));
  return (J.casos || []).map((c) => ({ origen: "catalogo", id: c.id, encargo: c.encargo }));
}

/** armarCorpus(base, { catalogos, azar: { semilla, n } }) → { casos, estadistica } */
export async function armarCorpus(base, { catalogos = true, azar = null, rutaCatalogos = RUTA_CATALOGOS } = {}) {
  const casos = [];
  let estadistica = null;
  if (catalogos) casos.push(...cargarCatalogos(rutaCatalogos));
  if (azar && azar.n > 0) { const g = await generarEncargos(base, { semilla: azar.semilla || "adi-consolidacion-1", n: azar.n }); casos.push(...g.casos); estadistica = g.estadistica; }
  return { casos, estadistica };
}

/** entregaDe(base, caso) → { ok, entrega, texto, resolucion, encargo, dato, base } | { ok:false, motivo } — nunca lanza */
export function entregaDe(base, caso) {
  try {
    const resolucion = base.validar.validarEncargo(caso.encargo, {});
    const r = base.componer.componerEntrega(resolucion);
    if (!r || !r.ok || !r.entrega) return { ok: false, motivo: (r && r.motivo) || "no compone", resolucion };
    return { ok: true, entrega: r.entrega, texto: r.texto, resolucion, encargo: caso.encargo, dato: base.proyeccion, base, caso };
  } catch (e) {
    return { ok: false, excepcion: String((e && e.message) || e).slice(0, 300) };
  }
}
