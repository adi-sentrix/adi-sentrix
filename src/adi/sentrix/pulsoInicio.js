/* === src/adi/sentrix/pulsoInicio.js · EL PULSO DEL NEGOCIO · la banda de la pantalla de inicio ==============
 *
 * QUÉ ES: las cuatro cifras y la lectura que abren la app cuando todavía no hay conversación. Es la pantalla
 * que el owner aprobó (variante A) llevada al producto.
 *
 * POR QUÉ ESTE ARCHIVO EXISTE, y es la única razón: **la vista no calcula**. La regla de la casa es que la
 * frase y el número se arman en el módulo y el componente solo pinta — una cuenta dentro de un componente de
 * React es un defecto (CLAUDE.md §2.3). El mockup traía los cinco números escritos a mano; acá salen del motor.
 *
 * DE DÓNDE SALE CADA UNA — ninguna se recalcula, todas se reusan de quien ya las publica:
 *   · clientes en cartera + cuántos ceden  → `marginCarteraSnapshot` (specRetrieval), el MISMO universo y el
 *     mismo filtro que produce «8 de 13 clientes están bajo el margen mínimo de 30.1%» en la respuesta de ADI.
 *   · margen promedio                      → el KPI `margen` de `buildResumenEjecutivo`, el mismo que pinta la
 *     card de la Mesa. Se toma su `value` YA FORMATEADO: si acá lo volviera a formatear, bastaría un redondeo
 *     distinto para que la portada y la Mesa publicaran dos márgenes.
 *   · capital inmovilizado + SKU + bodega  → `buildMesaCapital().liquidar`, el mismo grupo que la cara Capital.
 *
 * EL REGISTRO SE CORRIGIÓ AL IMPLEMENTAR (orden del owner). El mockup aprobado decía «bajo la vara de 30,1%»
 * y «capital detenido»: las dos están prohibidas en superficie (CLAUDE.md §4) y «detenido» acababa de salir de
 * toda la app con tres candados. Acá se dice **benchmark** e **inmovilizado**, que es además lo que el propio
 * motor ya emite en sus líneas. Tercera corrección: el mockup decía «margen consolidado» y el producto entero
 * llama a esa cifra **margen promedio** — mismo concepto, misma palabra.
 *
 * LOS SEPARADORES DECIMALES NO SE TOCARON. El mockup escribía «25,1%» con coma y la app entera escribe «25.1%»
 * con punto. Cambiarlo acá solo, para que la portada quede linda, publicaría dos formatos del mismo número en
 * dos pantallas vecinas. Si el owner quiere la coma, es una decisión de producto que se aplica en todas partes
 * a la vez, no un arreglo de esta banda.
 *
 * DEGRADA HONESTO: sin cartera no hay banda; sin capital inmovilizado material la cuarta cifra no se inventa,
 * se cae, y la lectura lo dice. Un cero no se disfraza.
 */
import { buildResumenEjecutivo, marginCarteraSnapshot } from "../specRetrieval.js";
import { etiquetaDeLaReferencia } from "../../config/businessPolicy.js";   // de quién es la vara: del negocio o nuestra (owner 2026-08-26)
import { buildMesaCapital, _money } from "./mesaCapital.js";

/* buildPulsoInicio(scenario) → { rotulo, cifras:[{key,valor,etiqueta,ask}], lectura:{destacado,cola} } | null */
export function buildPulsoInicio(scenario) {
  const corte = marginCarteraSnapshot(scenario);
  if (!corte) return null;   // sin cartera no hay pulso — la portada se queda con el título y la pregunta

  const resumen = buildResumenEjecutivo(scenario);
  const kpiMargen = (resumen.kpis || []).find((k) => k.key === "margen");
  const capital = buildMesaCapital(scenario);
  const liquidar = capital && capital.liquidar;

  const cifras = [
    { key: "clientes", valor: String(corte.total), etiqueta: `${corte.label.p} en tu cartera`,
      ask: "¿Quiénes son mis principales clientes por venta?" },
    // La referencia va EN LA ETIQUETA, no suelta: «8» sin decir contra qué no es una cifra, es un número.
    { key: "bajoBenchmark", valor: String(corte.bajo), etiqueta: `bajo ${etiquetaDeLaReferencia()} (${corte.benchmark.toFixed(1)}%)`,
      ask: "¿Quiénes están bajo el margen mínimo?" },
  ];

  // NO repite el ask de la cifra de al lado: dos botones pegados que disparan la MISMA pregunta se leen como un
  // error de la pantalla. «Quiénes ceden» (ranking) y «quiénes están bajo el mínimo» (corte) son preguntas
  // distintas y las dos están verificadas — salen de HERO_CHIPS y de la Mesa, no se inventaron acá.
  if (kpiMargen) cifras.push({ key: "margen", valor: kpiMargen.value, etiqueta: "margen promedio",
    ask: "¿Qué clientes ceden más margen?" });

  if (liquidar && liquidar.n) cifras.push({ key: "inmovilizado", valor: liquidar.usdFmt,
    etiqueta: `inmovilizado en ${liquidar.n} SKU`, ask: "¿Dónde está inmovilizado mi capital?" });

  return { rotulo: "El pulso de tu negocio, ahora", cifras, lectura: _lectura(liquidar) };
}

/* LA LECTURA · dónde está concentrado el capital que no trabaja.
 * ⚠️ La bodega LOCALIZA, no explica (CLAUDE.md §2.2 y el propio mesaCapital): la frase dice DÓNDE está y por
 * dónde conviene empezar por concentración — nunca por qué se frenó, que el dato no tiene. */
function _lectura(liquidar) {
  if (!liquidar || !liquidar.n) {
    return { destacado: "No tienes capital inmovilizado material.", cola: "El inventario está trabajando." };
  }
  const porBodega = new Map();
  for (const f of liquidar.filas) porBodega.set(f.bodega, (porBodega.get(f.bodega) || 0) + f.capital);
  const orden = [...porBodega.entries()].sort((a, b) => b[1] - a[1]);
  const [bodega, usd] = orden[0];
  const pct = liquidar.usd ? Math.round((usd / liquidar.usd) * 100) : 0;

  // REPARTIDO ≠ CONCENTRADO. Si la cabeza no llega a la mitad, no hay "una sola bodega" que señalar y decirlo
  // igual sería forzar un titular: se declara el reparto, que es lo que el dato sostiene.
  if (orden.length > 1 && pct < 50) {
    return { destacado: `Los ${liquidar.usdFmt} inmovilizados están repartidos en ${orden.length} bodegas.`,
      cola: `La mayor, ${bodega}, concentra ${_money(usd)}.` };
  }
  return {
    destacado: orden.length === 1
      ? `Los ${liquidar.usdFmt} inmovilizados están en una sola bodega, la de ${bodega}.`
      : `${_money(usd)} de esos ${liquidar.usdFmt} —el ${pct}%— están en una sola bodega, la de ${bodega}.`,
    cola: "Ahí conviene empezar.",
  };
}
