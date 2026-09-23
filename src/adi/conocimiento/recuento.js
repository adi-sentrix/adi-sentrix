/* === src/adi/conocimiento/recuento.js · EL RECUENTO DE LO REVISADO (Business Knowledge v0.2, Parte A §5 y §6) ═══
 * «Cuando nada es pertinente —empresa sana— la capa no puede quedar muda sin explicación... "De las N cosas que
 * el oficio mira en un distribuidor, ADI midió M: ninguna está ocurriendo." Es un hallazgo, no un silencio.»
 *
 * Este recuento se calcula sobre las piezas FIRMADAS del catálogo (nunca sobre borrador — una pieza sin validar
 * no puede ni siquiera aportar un conteo: `seleccionar.js` es quien decide si corresponde mostrarlo, este
 * módulo solo lo calcula si se lo piden con un catálogo ya filtrado). Función pura.
 *
 * ═══ CORRECCIÓN 2026-09-23 (owner, defecto 3) — «la línea del recuento se lee mal» ═══════════════════════════════
 * La forma anterior, «De las N cosas que el oficio mira…, ADI midió M: …», mezclaba dos unidades distintas bajo
 * el mismo sustantivo: N piezas de conocimiento (lo que el oficio sabe mirar) y M mediciones (una por cada
 * entidad — cuenta o SKU — donde una pieza pertinente se evaluó). Un ejecutivo leía «6 cosas… midió 17» y no
 * podía saber, en una sola lectura, que 17 no es un subconjunto de 6. Ahora cada número lleva su propia unidad
 * nombrada en la misma frase: «aspectos» para las piezas, «veces» (o el eje real — cuentas/SKU) para las
 * mediciones — nunca las dos bajo la palabra "cosas". */
import { evaluarPertinencia } from "./evaluarPertinencia.js";
import { medirPieza } from "./medir.js";

const _SECTOR_TXT = { distribucion: "un distribuidor", fabricacion: "una fábrica", minorista: "un minorista", servicios: "una empresa de servicios", obras: "una empresa de obras" };
function _sectorTxt(piezas) {
  const s = piezas[0] && piezas[0].alcance && piezas[0].alcance.sector;
  const lista = Array.isArray(s) ? s : s ? [s] : [];
  return lista.length && lista[0] !== "*" ? (_SECTOR_TXT[lista[0]] || lista[0]) : "su sector";
}

/** recuentoDeLoRevisado(piezasFirmadas, tabla, perfil, pregunta) → { texto, total, medidas, ocurre } | null
 *  `null` si no hay piezas firmadas que contar, o si ninguna llegó a medirse (nada que reportar todavía). */
export function recuentoDeLoRevisado(piezasFirmadas, tabla, perfil, pregunta = "") {
  const piezas = Array.isArray(piezasFirmadas) ? piezasFirmadas : [];
  if (!piezas.length) return null;

  let medidas = 0, ocurre = 0;
  for (const pieza of piezas) {
    const pert = evaluarPertinencia(pieza, tabla, perfil, pregunta);
    if (!pert.pertinente) continue;
    const entidades = pert.entidades.length ? pert.entidades : [null];
    for (const entidad of entidades) {
      const r = medirPieza(pieza, entidad, tabla);
      if (r.estado !== "indeterminable") medidas++;
      if (r.estado === "ocurre") ocurre++;
    }
  }
  if (!medidas) return null;

  const sector = _sectorTxt(piezas);
  const nAspectos = piezas.length;
  const aspectoTxt = `${nAspectos} aspecto${nAspectos === 1 ? "" : "s"}`;
  const casoTxt = `${medidas} caso${medidas === 1 ? "" : "s"}`;
  const texto = ocurre === 0
    ? `El oficio revisa ${aspectoTxt} de ${sector}. ADI los midió en ${casoTxt}: ninguno está ocurriendo.`
    : `El oficio revisa ${aspectoTxt} de ${sector}. ADI los midió en ${casoTxt}: ${ocurre} está${ocurre === 1 ? "" : "n"} ocurriendo.`;
  return { texto, total: piezas.length, medidas, ocurre };
}
