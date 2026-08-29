/* === config/marcoPeriodo.js · DE QUÉ PERÍODO HABLA UNA CIFRA (owner 2026-08-29) ========================
 *
 * LA ORDEN: «cuidado con año cerrado: si el archivo trae solo julio/agosto, ADI debe decir período cargado o
 * mes informado, no año cerrado». Y la condición: «si el marco viaja a la boleta, que cambie completo, no
 * solo el texto visible».
 *
 * QUÉ ESTABA MAL. `viewManifest` declaraba «año cerrado» escrito a mano en 35 lugares. Era cierto para el
 * negocio de demostración —que trae doce meses— y falso para cualquier planilla cargada con dos. No es un
 * rótulo de pantalla: ese string viaja al contexto, a la dirección de cada cifra y a la BOLETA, y el narrador
 * lo compara para decidir cómo hablar. Un marco equivocado no es una palabra fea: es una cifra bien calculada
 * presentada como si cubriera un año que nadie informó.
 *
 * ES LA REGLA 3 DEL PROYECTO. Nada hardcodeado: ni una cifra, ni un umbral, ni un rótulo. El marco sale del
 * dato o no sale.
 *
 * ⚠️ LOS MARCOS SON POCOS Y ESTABLES A PROPÓSITO. Este string se guarda en boletas y se compara: si dijera
 * «el período cargado (jul–ago 2026)» cambiaría con cada carga y ninguna boleta vieja reconciliaría con una
 * nueva. La precisión de qué meses son ya vive en la preview y en la carpeta; acá hace falta un marco
 * estable que diga la VERDAD sobre su alcance.
 *
 * EL INVENTARIO NO SE TOCA: «foto de inventario a hoy» es correcto siempre — es una foto del stock, no un
 * acumulado de un período. Confundirlos fue un defecto real de este producto y no se reabre.
 */
import { getTenantData } from "../data/tenantStore.js";

export const MARCO_ANIO = "año cerrado";
export const MARCO_PERIODO = "el período cargado";
export const MARCO_MES = "el mes informado";

/** Cuántos meses de historia trae el negocio activo. `null` si no hay con qué saberlo. */
export function mesesInformados(dataset) {
  const d = dataset || getTenantData();
  const mens = d && d.ventasMensuales;
  return Array.isArray(mens) && mens.length ? mens.length : null;
}

/* marcoDeVentas(dataset) → el marco REAL del período de ventas del negocio activo.
 *
 * Sin historia con que decidir se devuelve el marco de período, no el de año: ante la duda, la afirmación
 * más chica. Decir «año cerrado» sin saberlo es exactamente lo que hay que dejar de hacer. */
export function marcoDeVentas(dataset) {
  const n = mesesInformados(dataset);
  if (n === null) return MARCO_PERIODO;
  if (n >= 12) return MARCO_ANIO;
  if (n === 1) return MARCO_MES;
  return MARCO_PERIODO;
}

/* Las formas escritas a mano en el manifiesto que AFIRMAN un año. Se listan explícitas en vez de detectarse
 * por heurística: una lista corta que hay que mantener es mejor que una regla que un día traduzca de más. */
const FRASES_DE_ANIO = [
  "año cerrado",
  "año completo",
  "12 meses del año en foco",
];

/* resolverMarco(declarado, dataset) → el marco declarado, con la parte que afirma un año reemplazada por la
 * que el dato sostiene. Conserva el resto: «año cerrado · dato base, sin escenario» mantiene su aclaración.
 *
 * Lo que NO afirma un año —«foto de inventario a hoy», «del primer al último mes del historial»— pasa intacto. */
export function resolverMarco(declarado, dataset) {
  const s = String(declarado == null ? "" : declarado);
  if (!s) return s;
  const real = marcoDeVentas(dataset);
  if (real === MARCO_ANIO) return s;   // el dato sostiene el año: nada que cambiar

  for (const frase of FRASES_DE_ANIO) {
    if (s.toLowerCase().startsWith(frase)) return real + s.slice(frase.length);
    if (s.toLowerCase() === frase) return real;
  }
  return s;
}

/** ¿Este marco habla de un año cerrado? Para quien tenga que decidir cómo redactar. */
export const esMarcoDeAnio = (marco) =>
  FRASES_DE_ANIO.some((f) => String(marco || "").toLowerCase().startsWith(f));
