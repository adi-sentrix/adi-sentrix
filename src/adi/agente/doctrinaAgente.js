/* === src/adi/agente/doctrinaAgente.js · DOCTRINA BAJO DEMANDA (F2b · §10 del F1 · owner 2026-08-30) ==========
 *
 * EL PRINCIPIO, palabra del owner: **la instrucción no viaja hasta que hace falta.** El system del narrador de
 * hoy lleva TODA la doctrina junta (~10K tok) use lo que use el turno. En el agente, el núcleo es chico
 * (persona + invariantes + mapa) y cada doctrina viaja PEGADA a su herramienta: el turno que usa `serieEntidad`
 * recibe la doctrina de series; el que no toca P&L no carga su arco.
 *
 * GANANCIA PRINCIPAL: CALIDAD — menos instrucción impertinente = mejor obediencia. La de tokens es CONDICIONAL
 * al caché, y por eso las DOS leyes de este módulo (gateadas con carnada):
 *   1 · cada bloque es ESTABLE byte a byte entre turnos (cero prosa por turno, cero timestamps);
 *   2 · los bloques de una ronda llegan en ORDEN FIJO (alfabético por herramienta) — el prefijo del proveedor
 *       no distingue «mismo contenido en otro orden» de «contenido nuevo».
 *
 * ⚠️ LA LETRA de cada bloque se calibra en F3 contra los borradores guardados; el MECANISMO es lo que F2b
 * entrega y gatea. Un bloque nuevo se agrega acá y nace con su tope. PURO · determinístico. */

/** el tope por bloque, en caracteres (~160 tok) — probado en el gate, no prometido. */
export const TOPE_BLOQUE_CHARS = 600;

/* Una entrada por herramienta QUE NECESITA doctrina — no todas la necesitan: una lectura simple se gobierna
 * con las invariantes del núcleo. Las llaves son nombres de herramientas del catálogo, verificado en el gate. */
export const DOCTRINAS = {
  serieEntidad: "DOCTRINA · serie por entidad: cada punto declara su mes — nómbralo al citarlo. Un mes sin venta no tiene margen/ticket (null): dí «no compró ese mes», jamás un 0%. El delta se dice con su base («$X en julio → $Y en agosto»). Si la herramienta declaró un bloqueo, ese motivo ES la respuesta, en una línea.",
  trend: "DOCTRINA · serie global: es la curva del NEGOCIO completo, no de una entidad. Declara el rango de meses que citas. No extrapoles meses futuros ni proyectes — la curva termina donde termina el dato.",
  simulate: "DOCTRINA · simulación: todo resultado es un SUPUESTO aplicado, no un hecho — dilo con la forma supuesto→efecto→dónde pega→límite. Nunca presentes la cifra simulada como si ya hubiera pasado.",
  simulateCarga: "DOCTRINA · simulación de carga: el efecto sale de mover SOLO la carga comercial; los demás términos quedan fijos y eso se declara. Supuesto→efecto→límite, jamás un hecho.",
  simulateCapital: "DOCTRINA · simulación de capital: mover inventario es un supuesto operativo — declara qué se movió y qué quedó fijo. El capital es FOTO, no flujo: no lo mezcles con la venta del período.",
  simulateCosto: "DOCTRINA · simulación de costo: el margen resultante es aritmética del supuesto, no una promesa. Declara el supuesto y su límite antes de la cifra.",
  simulateGeneral: "DOCTRINA · simulación general: nombra exactamente qué variable moviste y cuánto. El resultado es condicional y se dice condicional.",
  pnlRead: "DOCTRINA · P&L: la cascada va en orden (ingreso → costo → margen bruto → carga → contribución → gastos → resultado) y cada línea con su signo. Los gastos declarados por el usuario son SUPUESTOS suyos y se etiquetan así.",
  clientesPorSku: "DOCTRINA · clientes por SKU: es AFINIDAD MODELADA (indicado), jamás compra observada — dilo con esas palabras. Ninguna cifra de inventario se atribuye a una cuenta.",
  registrarSupuesto: "DOCTRINA · supuesto del usuario: al citarlo lleva SIEMPRE su etiqueta («tu supuesto de $X»). Compararlo contra lo verificado está bien; mezclarlos sin etiqueta, jamás. Una línea de oferta, no un sermón.",
  preferenciaNombre: "DOCTRINA · nombre del usuario: guardaste SOLO el nombre. Confírmalo en una línea y úsalo con naturalidad. El registro NO cambia: formal siempre, lo llamen como lo llamen — un apodo no es un permiso de tono.",
  inventoryStatus: "DOCTRINA · inventario: es la FOTO de hoy en moneda cruda — no reconcilia con la venta del período y no se suman. «Inmovilizado» es la categoría amplia; «frenado» el subconjunto crítico. Di «capital», nunca «plata dormida».",
  entityCapitalLigado: "DOCTRINA · capital ligado: la relación cuenta→capital es INDICADA (vía surtido), no una deuda de esa cuenta. Decláralo al citar el monto.",
  executiveSummary: "DOCTRINA · resumen ejecutivo: solo cuando el usuario pidió el panorama. Arco completo: qué pasa → por qué/dónde → qué hacer primero, con las cifras de la boleta y ninguna más.",
};

/** doctrinasParaRonda(nombresDeHerramientas) → el bloque de doctrina de ESA ronda: solo las herramientas
 *  usadas que la tienen, orden alfabético FIJO, deduplicado. "" si ninguna la necesita. */
export function doctrinasParaRonda(nombres = []) {
  const usadas = [...new Set((nombres || []).filter((n) => DOCTRINAS[n]))].sort((a, b) => a.localeCompare(b, "es"));
  if (!usadas.length) return "";
  return usadas.map((n) => DOCTRINAS[n]).join("\n");
}
