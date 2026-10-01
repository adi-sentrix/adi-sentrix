/* === scripts/consolidacion/marco.mjs · EL MARCO DE LOS INVARIANTES (consolidación, infraestructura común F1…F5) ═════════
 * Cada FAMILIA de la consolidación registra UNA función invariante: `invariante(ctx) → violaciones[]`. El control lee la ENTREGA
 * (su texto, sus oraciones y marcas, sus tablas, sus universos) y el DATO de la proyección; NUNCA el código de la pieza que
 * decide la propiedad: así la pieza y el control no pueden estar equivocados de la misma manera. Una violación es
 * `{ familia, regla, detalle }`; el marco le agrega el caso.
 *
 * Cómo se suma una familia: un archivo `familias/fN_<nombre>.mjs` que exporta `familia = { id: "FN", nombre, invariante }`.
 * El marco carga todos los que haya (`cargarFamilias`).
 *
 * `ctx` = { entrega, texto, resolucion, encargo, dato, base, caso }  (ver `corpus.mjs:entregaDe`). OFFLINE. */
import { readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { entregaDe } from "./corpus.mjs";

const DIR_FAMILIAS = join(dirname(fileURLToPath(import.meta.url)), "familias");

/** cargarFamilias(solo?) → [{ id, nombre, invariante }] — todas las de `familias/` (o solo las ids pedidas), ordenadas por id */
export async function cargarFamilias(solo = null) {
  const archivos = readdirSync(DIR_FAMILIAS).filter((f) => /^f\d.*\.mjs$/.test(f)).sort();
  const out = [];
  for (const f of archivos) {
    const m = await import(pathToFileURL(join(DIR_FAMILIAS, f)).href);
    const fam = m.familia;
    if (!fam || typeof fam.invariante !== "function") throw new Error(`familias/${f} no exporta \`familia\` con \`invariante\``);
    if (solo && !solo.includes(fam.id)) continue;
    out.push(fam);
  }
  return out;
}

/** revisarEntrega(ctx, familias) → violaciones[] (con `familia`); una invariante que lanza se reporta como violación `EXCEPCION` */
export function revisarEntrega(ctx, familias) {
  const out = [];
  for (const fam of familias) {
    let vs = [];
    try { vs = fam.invariante(ctx) || []; } catch (e) { vs = [{ regla: "EXCEPCION", detalle: String((e && e.message) || e).slice(0, 200) }]; }
    for (const v of vs) out.push({ familia: fam.id, regla: v.regla, detalle: v.detalle, ...(v.abierta ? { abierta: true } : {}) });
  }
  return out;
}

/** correrCorpus(base, casos, { familias }) → { total, compuestos, sinEntrega, excepciones, violaciones: [{ caso, familia, regla, detalle, abierta? }], porRegla, abiertas, firmes, casosConViolacion }
 *  FIRMES = una regla del contrato que la Entrega incumple (rojo con UNA). ABIERTAS = una regla vigente cuyo cumplimiento exige comportamiento nuevo: se cuentan aparte y el gate las congela. */
export function correrCorpus(base, casos, { familias, excluirReglas = [], porEntrega = null } = {}) {
  const res = { total: casos.length, compuestos: 0, sinEntrega: 0, excepciones: 0, violaciones: [], porRegla: {}, abiertas: {}, firmes: 0, casosConViolacion: 0, porOrigen: {} };
  for (const caso of casos) {
    const e = entregaDe(base, caso);
    const o = (res.porOrigen[caso.origen] = res.porOrigen[caso.origen] || { total: 0, compuestos: 0, violaciones: 0 });
    o.total++;
    if (!e.ok) { if (e.excepcion) res.excepciones++; else res.sinEntrega++; continue; }
    res.compuestos++; o.compuestos++;
    if (porEntrega) porEntrega(e, caso);
    const vs = revisarEntrega(e, familias).filter((v) => !excluirReglas.includes(`${v.familia}:${v.regla}`));
    if (vs.some((v) => !v.abierta)) { res.casosConViolacion++; }
    for (const v of vs) {
      res.violaciones.push({ caso: caso.id, ...v });
      const k = `${v.familia}:${v.regla}`; res.porRegla[k] = (res.porRegla[k] || 0) + 1;
      if (v.abierta) { res.abiertas[k] = (res.abiertas[k] || 0) + 1; } else o.violaciones++;
    }
  }
  res.firmes = res.violaciones.filter((v) => !v.abierta).length;
  return res;
}
