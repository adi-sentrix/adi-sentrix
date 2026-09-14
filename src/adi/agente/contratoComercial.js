/* === src/adi/agente/contratoComercial.js · EL CONTRATO COMERCIAL (owner 2026-09-13) ==================================
 * LA LEY: «Toda pregunta comercial parte de la misma realidad comercial. La pregunta determina el foco de la
 * respuesta, no qué evidencia tiene disponible ADI para razonar.»
 *
 * LO MEDIDO ANTES DE ESTO (22 preguntas comerciales, offline): 11 caían al cerebro libre —la evidencia la elegía el
 * modelo turno a turno, 0 capítulos garantizados— y las 11 con procedimiento recibían 5,9 de 10 capítulos del informe
 * comercial. «¿Cómo van las ventas?» recibía venta y variación sin margen, contribución, costo, carga ni benchmark;
 * «¿qué clientes están perdiendo contribución?» recibía contribución sin margen ni benchmark; la Ficha de una cuenta
 * contestaba el porqué sin markup ni huellas. Cinco boletas distintas para el mismo tema: cinco verdades posibles.
 *
 * QUÉ HACE. Cuando el tema del turno es comercial, los pasos del contrato corren SIEMPRE —antes del cerebro, unidos a
 * los del procedimiento activo sin repetir una herramienta con los mismos argumentos— y el cerebro recibe además las
 * conclusiones del procedimiento comercial (la doctrina de margen-en-riesgo: prioridad oficial, definición del
 * subtotal, sello de cada mecanismo, las leyes). Con eso las 22 preguntas tienen 10 de 10 capítulos disponibles
 * (medido en `_contrato_comercial_gate`): ventas y evolución · contribución y margen · benchmark · clientes · costos ·
 * precio/markup · acciones y carga · brecha de contribución partida en carga y precio/costo · huellas con su sello.
 *
 * QUÉ NO HACE. No cambia la forma de la respuesta: el foco sigue siendo de la pregunta y del procedimiento (el
 * entregable, la ruta, el lector). No recalcula nada: cada cifra sale del emisor que ya la publica con su rótulo —
 * una sola verdad por cifra. No inventa lo que el dato no tiene: la serie mensual de margen entra solo cuando es
 * real (`datasetCapability().history.perEntity`), el mix queda abierto (rolesCartera lo declara) y el resultado
 * después de gastos queda fuera si no hay P&L. Y no corre en turnos que no son comerciales: inventario y cobranza
 * tienen sus procedimientos; reformular re-dice un texto aprobado; una definición («¿qué es el margen bruto?») no
 * necesita la cartera entera.
 *
 * COSTO, medido: los cinco pasos pesan ~13.7K caracteres tal como los ve el modelo (el prompt de gerente ya corría
 * con 14.5K); el techo del cierre es 28K y los podadores por herramienta siguen vigentes. */
import { datasetCapability } from "../sentrix/capability.js";
import { margenEnRiesgo } from "./playbooks/margenEnRiesgo.js";
import { esReformular } from "./reformular.js";
import { axisEntityNames } from "../oracle/entityIndex.js";   // una pregunta que nombra a un cliente es comercial aunque no diga «venta»

/* el léxico del tema, cerrado a propósito: lo que suena a resultado comercial. Un «capital»/«stock»/«cobranza» en
 * la misma pregunta la manda a su universo (esos procedimientos ya leen lo suyo), y una definición no lee cartera. */
const _W = "[\\wáéíóúñ]";   // la letra de la casa: \w no incluye las vocales con tilde
const _COMERCIAL = new RegExp(`(?<!${_W})(?:ventas?|vend[ií](?:[oó]|mos|endo|ste|eron|a|an|e|en)?|vend(?:o|es|e|en|emos)|vendid[oa]s?|factur${_W}*|ingresos?|contribu${_W}*|m[aá]rgen(?:es)?|rentab${_W}*|benchmark|costos?|precios?|markup|acciones comerciales|carga comercial|rebates?|descuentos?|clientes?|cuentas?|cartera|negocio|resultado comercial|crec${_W}*|volumen|mix|ticket|comercial(?:es)?|ganamos|ganando|gano|mejorando|apuesta)(?!${_W})`, "i");
const _OTRO_UNIVERSO = new RegExp(`(?<!${_W})(?:inventario|stock|rotaci[oó]n|bodegas?|sku|reposici[oó]n|quiebres?|sobrestock|inmoviliz${_W}*|capital|cobranza|cobros?|vencid[oa]s?|deuda|abonos?|pagos?|plazo|flujo de caja|efectivo)(?!${_W})`, "i");
const _DEFINICION = /^\s*¿?\s*(?:qu[eé] (?:es|son|significa|quiere decir)|expl[ií]came (?:qu[eé] es|el concepto)|c[oó]mo se (?:calcula|define))\b/i;
/* OTRO EJE, OTRA LECTURA (medido al cablear, 2026-09-13): el contrato es la realidad comercial POR CLIENTE. Una pregunta por
 * marca, familia, canal, producto o sucursal es comercial, pero su procedimiento («lectura por eje») compone con las figs
 * de SU eje; sumarle las trece cuentas mezclaba márgenes de clientes en un ranking de marcas. Ese eje tiene su lectura;
 * el contrato por cliente no la mejora y la rompía. */
const _OTRO_EJE = new RegExp(`(?<!${_W})(?:marcas?|familias?|subfamilias?|canal(?:es)?|productos?|l[ií]neas? de producto|categor[ií]as?|sucursal(?:es)?|tiendas?|locales?|regi[oó]n(?:es)?|zonas?)(?!${_W})`, "i");
const _SALUDO_O_META = /^\s*(?:hola|gracias|ok|dale|listo|buen[oa]s?\b)/i;

/** ¿El tema del turno es comercial? Solo la pregunta: el foco (cuenta, porqué, lector) lo deciden el procedimiento y la ruta.
 *  `conOtrosUniversos` (contrato de dominios, owner 2026-09-14: «composición, no exclusión»): una palabra de inventario
 *  o cobranza ya no retira el tema comercial — suma su propio dominio. Sin la opción, la conducta de siempre. */
export function esTemaComercial(pregunta, { conOtrosUniversos = false } = {}) {
  const q = String(pregunta || "");
  if (!q.trim() || _SALUDO_O_META.test(q) || _DEFINICION.test(q)) return false;
  if (esReformular(q)) return false;
  if (!conOtrosUniversos && _OTRO_UNIVERSO.test(q)) return false;
  if (_OTRO_EJE.test(q)) return conOtrosUniversos ? _COMERCIAL.test(q) : false;   // por otro eje: es comercial, pero su realidad es la lectura de ESE eje (la decide el contrato de dominios)
  if (_COMERCIAL.test(q)) return true;
  /* «¿Cómo está Falabella?»: el nombre de una cuenta es tema comercial por definición (el eje cliente es comercial) */
  const _n = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  try { const qn = _n(q); return axisEntityNames("cliente").some((e) => e && String(e).length >= 3 && qn.includes(_n(e))); } catch { return false; }
}

/* LOS PASOS DEL CONTRATO — los mismos argumentos que usan los procedimientos, para que la unión no repita nada. */
const _PASOS = [
  { tool: "salesRead", args: {}, para: "ventas y evolución: la venta del período contra el año anterior y la variación por cliente" },
  { tool: "marginRead", args: { focus: "bajo_benchmark", dimension: "cliente" }, para: "margen y benchmark: el margen de cada cliente, el promedio, el benchmark declarado, la brecha y el peso del costo" },
  { tool: "contributionRead", args: {}, para: "contribución: el total del negocio y las cuentas que más aportan" },
  { tool: "diagnose", args: {}, para: "brecha de contribución: la contribución no capturada y la carga sobre el nivel, por cuenta y en subtotal, con la brecha partida en carga y precio/costo (cierra exacto)" },
  { tool: "rolesCartera", args: {}, para: "precio de lista/markup y carga por cuenta, los papeles de la cartera y las huellas de cada mecanismo con su sello (probado · indicado · abierto)" },
];
const _PASO_SERIE = { tool: "trend", args: { metric: "margen" }, para: "la evolución del margen mes a mes — solo porque este dato trae la serie real" };

/** los pasos del contrato para este dato: la serie de margen entra solo si es real (nunca una serie modelada). */
export function pasosDelContratoComercial() {
  let serie = false;
  try { serie = !!(datasetCapability().history && datasetCapability().history.perEntity); } catch { serie = false; }
  return serie ? [..._PASOS, _PASO_SERIE] : [..._PASOS];
}

/** la unión sin repetir: los pasos del PROCEDIMIENTO van primero y mandan; el contrato solo suma las herramientas que el
 * procedimiento no pidió — con ningún argumento. Medido (2026-09-13): «ventas contra el presupuesto» corría salesRead(vs_presupuesto)
 * y el contrato sumaba salesRead(vs_anterior); el composer leía «Valor» sin saber de cuál referencia y contestó el plan con la
 * cifra del año anterior. Una herramienta, una referencia por turno: la del procedimiento. */
export function unirPasos(delProcedimiento, delContrato) {
  const out = [...(delProcedimiento || [])];
  const herramientas = new Set(out.map((p) => p.tool));
  for (const p of delContrato || []) { if (herramientas.has(p.tool)) continue; herramientas.add(p.tool); out.push(p); }
  return out;
}

/* LA DOCTRINA COMERCIAL: las conclusiones del procedimiento —prioridad oficial, definición del subtotal, el sello de
 * cada mecanismo, las leyes— viajan con la boleta unida en TODO turno comercial, no solo cuando margen-en-riesgo es el
 * procedimiento activo (que ya las manda con su doctrina: ahí no se duplican). Es la misma función, con los mismos
 * figs: una lectura comercial, una conclusión. */
export function doctrinaComercial(figs) {
  let c = "";
  try { c = margenEnRiesgo.conclusiones(figs) || ""; } catch { c = ""; }
  if (!c) return "";
  return [
    "[CONTRATO COMERCIAL — no es el usuario] Este turno es comercial: la realidad comercial completa del negocio ya está arriba (ventas y evolución · contribución y margen · benchmark · clientes · costos · precio/markup · carga · brecha partida · huellas con su sello).",
    "La pregunta decide qué mirar primero y qué destacar; no qué evidencia usar. Responde SOLO lo que se preguntó, con el foco que pidió, y usa el resto como contexto para interpretar bien — no lo vuelques.",
    c,
  ].join("\n");
}
