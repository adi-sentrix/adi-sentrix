/* === _orden_verificado_gate.mjs · EL ORDEN SE VERIFICA (owner 2026-09-14 · auditoría del Notario, familia B) ══════════════════
 * LA MEDIDA: de los 21 errores reales en los 12 borradores de las seis corridas vivas de la v2.31, siete eran de ORDEN —palabras
 * de orden alrededor de cifras correctas— y el Notario no veía ninguno («carga 4.5% — la más alta de la cartera» con Easy en 5.5;
 * «con más unidades y más contribución» con Falabella arriba; «los tres … el margen más bajo de la cartera» con Sodimac fuera; «la
 * más urgente en cobranza (269 días vencidos, peor recuperación)» con Easy en 270 y Sodimac en 35 %; «la segunda en brecha» tapada
 * por «entre los tres dominios»). Cinco huecos de una sola familia, en el bloque del superlativo de guardC y en los rankings que
 * la carpeta declara (`datoProyectado.rankings`):
 *   1. entre la métrica y el marcador cabe SOLO la cifra del término (con unidad, puntuación, rayas, artículos, la cópula, el nombre
 *      de la propia entidad): «carga 4.5% — la más alta» se ata; «carga comercial produce el mayor efecto» sigue fuera;
 *   2. el «y más / y menos X» encadenado a «con más / con menos» comparte reclamante y universo, y se verifica cada uno;
 *   3. el GRUPO con universo declarado y k entidades nombradas se verifica como top-k (empates de valor valen); sin universo o sin
 *      k nombrable no se juzga (la casa prefiere el falso negativo);
 *   4. la carpeta declara los rankings de COBRANZA desde la MISMA mesa que la herramienta `cobranza` (vencido · recuperado · días ·
 *      pendiente), con sus términos («urgente», «atraso», «mora») y las fórmulas que nombran su universo («en cobranza»); y las
 *      UNIDADES vendidas;
 *   5. el candado del plural mira la cláusula del marcador (lector de cláusula), no la oración entera.
 * Y dos formas más de decir el universo: «EL cliente con más X» (el artículo definido sobre el eje, sin acotación) y la tabla
 * nombrada («en cobranza»). Lo que NO cambia: una sola entidad sin universo («Lider tiene la carga más alta») no se juzga —
 * decisión de calibración—, el comparativo («mayor QUE») y el superlativo negado siguen fuera.
 * Este gate fija las dos direcciones: cada error real de la auditoría ARDE por verificación contra la proyección, y cada
 * afirmación correcta de los mismos borradores (revisada a mano contra la boleta) VIVE. Cero red: muro y carpeta, en disco. */
import fs from "node:fs";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { ESCENARIO_INICIAL } from "./src/config/scenarios.js";
import { guardC } from "./src/adi/oracle/guardC.js";
import { cifrasDelDato } from "./src/adi/oracle/datoProyectado.js";
import { axisEntityNames } from "./src/adi/oracle/entityIndex.js";
import { stripLanguageLeaks } from "./src/adi/llm/voiceGuard.js";
initTenant(TENANT_DEMO);
let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };
const H = (t) => console.log(`\n${t}`);
const ejes = (a) => a.flatMap((e) => { try { return axisEntityNames(e); } catch { return []; } });
const CTX = { ledger: { figs: [] }, results: [], trace: null, datoProyectado: cifrasDelDato(ESCENARIO_INICIAL), entidadesDelTenant: ejes(["cliente", "sku", "marca"]), duenosDelTenant: ejes(["cliente", "sku", "marca", "familia", "bodega", "canal"]), contentScope: "full", tablePolicy: "auto" };
const sup = (t) => (guardC(t, CTX).violations || []).filter((v) => v.kind === "superlativo-no-sostenido").map((v) => String(v.detail));
const arde = (t, re, label) => { const v = sup(t); ok(v.some((d) => re.test(d)), `ARDE · ${label || t.slice(0, 90)}`, v.length ? "vetos: " + v.map((d) => d.slice(0, 160)).join(" | ") : "sin veto de superlativo"); };
const vive = (t, label) => { const v = sup(t); ok(v.length === 0, `vive · ${label || t.slice(0, 90)}`, v.map((d) => d.slice(0, 200)).join(" | ")); };
const fixture = (nombre) => JSON.parse(fs.readFileSync(new URL("./fixtures/" + nombre, import.meta.url), "utf8"));

H("1 · los rankings nuevos de la proyección: cobranza (misma mesa), unidades, y el término de carga por marca");
{
  const Rk = CTX.datoProyectado.rankings.cliente;
  const top = (k, n = 3) => Rk[k].filas.slice().sort((a, b) => b.valor - a.valor).slice(0, n).map((x) => x.entidad).join(",");
  const low = (k, n = 3) => Rk[k].filas.slice().sort((a, b) => a.valor - b.valor).slice(0, n).map((x) => x.entidad).join(",");
  ok(Rk.saldo_vencido && Rk.recuperado && Rk.dias_vencido && Rk.saldo_pendiente && Rk.unidades, "el eje cliente declara saldo vencido · recuperado · días vencido · saldo pendiente · unidades");
  ok(top("dias_vencido", 2) === "Easy,Lider" && low("recuperado", 2) === "Sodimac,Easy" && top("saldo_vencido", 1) === "Lider" && top("unidades", 3) === "Jumbo,Falabella,Lider", `los órdenes son los de la mesa: días ${top("dias_vencido", 3)} · recuperado (peor) ${low("recuperado", 3)} · vencido ${top("saldo_vencido", 3)} · unidades ${top("unidades", 3)}`);
  ok(Rk.dias_vencido.filas.length === 13 && /13 clientes de la cobranza/.test(Rk.dias_vencido.universo) && Rk.dias_vencido.peorEs === "mayor" && Rk.recuperado.peorEs === "menor" && Rk.saldo_pendiente.peorEs === null && Rk.unidades.peorEs === null, "universo entero (13, no las 8 de la boleta), y el lado malo declarado: más días y menos recuperado son el problema; saldo pendiente y unidades sin lado malo");
  ok(Array.isArray(Rk.dias_vencido.formulas) && Rk.dias_vencido.formulas.length >= 2 && Rk.dias_vencido.terminos.some((t) => /urgente/.test(t)), "la carpeta declara las fórmulas de su universo («en cobranza») y «urgente» como término de los días vencidos");
  ok(CTX.datoProyectado.rankings.marca.carga.terminos.some((t) => t === "carga\\s+comercial"), "el término de carga por MARCA vuelve a casar (iba con una sola barra invertida: nunca casó)");
}

H("2 · los ocho errores de orden de la auditoría (fixtures reales, lavados como en el bucle)");
{
  const A = fixture("auditoria-notario-2026-09-14.json");
  const orden = /superlativo|carga|urgente|segunda|Jumbo\.\*contribuci/;
  for (const c of A.corpus) {
    const F = fixture(c.fixture);
    const texto = stripLanguageLeaks(String(F.borradores[c.borrador - 1].texto));
    const vetos = sup(texto).map((d) => "superlativo-no-sostenido: " + d);
    for (const e of c.errores_reales.filter((e) => orden.test(e.clave) || /superlativo|ordinal|ranking de grupo/.test(e.tipo))) ok(vetos.some((v) => new RegExp(e.clave, "i").test(v)), `${c.id}·${c.sitio} · «${e.texto.slice(0, 70)}» arde (${e.tipo.slice(0, 50)})`, vetos.map((v) => v.slice(0, 120)).join(" | "));
    for (const f of c.falsos_positivos.filter((f) => f.kind === "superlativo-no-sostenido")) ok(!vetos.some((v) => new RegExp(f.clave, "i").test(v)), `${c.id}·${c.sitio} · falso positivo cerrado sigue cerrado: «${f.texto.slice(0, 60)}»`);
  }
}

H("3 · las afirmaciones CORRECTAS de los 12 borradores no reciben veto de orden (revisadas contra la hoja de referencia)");
vive("- Sodimac: $1.9M vencidos, 251 días, 35% recuperado — el peor porcentaje de recuperación de todos.", "«Sodimac … el peor porcentaje de recuperación de todos» (35%, cierto)");
vive("Falabella es la mayor brecha de contribución sin capturar ($1.6M), y Lider es la cuenta con peores indicadores de cobranza (269 días, 45% recuperado, $4.6M vencidos) y la mayor distancia al benchmark de margen (8.6 pp contra 8.1 pp de Falabella).", "«Lider … la mayor distancia al benchmark» (8.6 pp, cierto)");
vive("- **Comercial** — Falabella es la mayor brecha individual ($1.6M sin capturar, 8.1 pp bajo benchmark, carga en 4.5%).", "«la mayor brecha individual ($1.6M sin capturar…)» — brecha en dinero, no en pp");
vive("- Lider: $9.8M de saldo pendiente, de eso $4.6M vencidos, 269 días de atraso, solo 45% recuperado. Es tu cliente #3 en contribución ($3.8M) y el peor perfil de cobro de la cartera.", "«Es tu cliente #3 en contribución» (Lider, cierto: Falabella, Jumbo, Lider)");
vive("- Jumbo: +$1.9M YoY (+12.2%), margen 24.0%, carga 3.8%. Es el que más unidades mueve de toda la cartera: 1.194.", "«el que más unidades mueve de toda la cartera» (Jumbo 1.194, cierto)");
vive("- Falabella: +$1.5M YoY (+8.2%), margen 22.0% (8.1 pp bajo), carga 4.5%. Segundo en unidades: 1.042.", "«Segundo en unidades: 1.042» (Falabella, cierto)");
vive("- Lider: +$2.3M YoY (+14.9%), margen 21.5%, carga comercial 4.2%. Además el cliente con más unidades vendidas después de Jumbo y Falabella: 894.", "«el cliente con más unidades vendidas después de Jumbo y Falabella» (tercero: no se juzga como máximo)");
vive("Criterio mío: yo entraría primero por Lider, porque ahí coinciden severidad (8.6 pp, la peor brecha), urgencia (269 días vencidos) y monto (mayor saldo vencido de la cartera) — Falabella la supera solo en contribución sin capturar.", "«Lider … mayor saldo vencido de la cartera» ($4.6M, cierto)");
vive("Falabella, Jumbo y Lider concentran la mayor contribución ($4.3M, $4.2M y $3.8M respectivamente) pero también el mayor arrastre de margen: los tres están bajo el benchmark.", "sujeto coordinado sin universo: sigue sin juzgarse (falso positivo cerrado de P2·1)");
vive("Lider pesa más: 8.6 pp de brecha (peor que Falabella), $4.6M vencidos con apenas 45% recuperado y 269 días de atraso.", "«peor QUE Falabella» es comparativo");
vive("Su brecha al benchmark es mayor que la de Falabella (8.6 pp contra 8.1 pp).", "«mayor QUE» es comparativo");
vive("Con eso en la mesa, mi criterio es partir por Lider: la mora más grave de la cartera y $4.6M vencidos.", "«la mora más grave» no es un marcador de orden (adjetivo de juicio)");

H("4 · el superlativo con la cifra entre la métrica y el marcador (P1·3)");
arde("- Falabella: +$1.5M YoY (+8.2%), margen 22.0% (8.1 pp bajo), carga 4.5% — la más alta de la cartera.", /Falabella es «más alta» en carga.*Easy \(5\.5%/, "«carga 4.5% — la más alta de la cartera» arde (Easy 5.5)");
vive("- Easy: -$177K YoY (-5.0%), margen 32.0%, carga 5.5% — la más alta de la cartera.", "la misma forma con la cuenta correcta (Easy 5.5) vive");
arde("Falabella tiene una carga comercial de 4.5%, la más alta de la cartera.", /Falabella es «más alta» en carga/, "«carga comercial de 4.5%, la más alta» arde");
vive("Con 8.1pp de brecha, Falabella es donde una mejora de carga comercial produce el mayor efecto en dólares.", "«carga comercial produce el mayor efecto» sigue FUERA (otras palabras entre medio)");
vive("Falabella tiene margen 22.0% y carga 4.5%, y Lider el mayor crecimiento.", "dos cifras entre la métrica y el marcador: no se atan");
vive("Lider tiene la carga más alta.", "una sola entidad, sin universo: no se juzga (decisión de calibración, intacta)");

H("5 · el «y más X» encadenado a «con más» (P1·2)");
arde("Jumbo además es el cliente con más unidades vendidas (1.194) y más contribución ($4.2M), así que su volumen es real.", /Jumbo es «y más contribución» en contribucion.*Falabella \(\$4\.3M/, "«con más unidades (1.194) y más contribución ($4.2M)» arde por la contribución (Falabella $4.3M)");
vive("Jumbo además es el cliente con más unidades vendidas (1.194), así que su volumen es real.", "la primera mitad sola (Jumbo 1.194) vive");
vive("Falabella es el cliente con más contribución ($4.3M) y más venta ($19.4M).", "la cadena verdadera vive");
arde("Jumbo es el cliente con más unidades vendidas y menos margen.", /Jumbo es «y menos margen» en margen/, "«y menos margen» encadenado arde (Lider 21.5)");
vive("Jumbo produce más contribución en dólares y más unidades.", "«más» suelto sin «con más»: comparativo, fuera");
vive("Jumbo es el cliente con más unidades vendidas entre los tres grandes.", "«entre los tres grandes» acota el conjunto: sin universo, no se juzga");

H("6 · el grupo como top-k (P1·2) y la calibración del Examen 4");
arde("- El problema: los tres motores más grandes son también los que tienen el margen más bajo de la cartera — Lider 21.5%, Falabella 22.0%, Jumbo 24.0% — todos lejos del benchmark de 30.1%.", /son los 3 de «más bajo» en margen.*Sodimac \(23\.5%\).*Jumbo \(24%\) queda fuera/, "«los tres … el margen más bajo de la cartera — Lider, Falabella, Jumbo» arde: Sodimac (23.5) entra y Jumbo (24.0) sale");
vive("Los tres con el margen más bajo de la cartera son Lider 21.5%, Falabella 22.0% y Sodimac 23.5%.", "los tres correctos viven");
vive("Falabella y Lider, los dos mayores, tienen los márgenes más bajos de la cartera.", "calibración del Examen 4: k = 2 y los dos de margen más bajo SON Lider y Falabella — vive por verificación");
arde("Falabella, Lider y Jumbo, los tres mayores, tienen los márgenes más bajos de la cartera.", /son los 3 de «más bajos» en margen/, "…y con Jumbo como tercero arde");
vive("Falabella, Jumbo y Lider concentran la mayor contribución de la cartera.", "sujeto coordinado con universo y top-3 cierto: vive");
arde("Falabella, Jumbo y Sodimac concentran la mayor contribución de la cartera.", /son los 3 de «mayor» en contribucion.*Lider/, "sujeto coordinado con universo y Sodimac en lugar de Lider: arde");
vive("Lider y Falabella tienen los márgenes más bajos.", "plural sin universo: no se juzga");
vive("Los dos de mayor venta de la cartera son Falabella y Lider.", "«los dos de mayor venta de la cartera» ciertos");
arde("Los dos de mayor venta de la cartera son Falabella y Jumbo.", /son los 2 de «mayor» en ventas.*Lider/, "«los dos de mayor venta» con Jumbo en lugar de Lider arde");
vive("Falabella, Lider, Jumbo y Sodimac, los tres de mayor venta de la cartera, concentran la venta.", "«los tres» con cuatro nombradas: k no nombrable, no se juzga");
vive("Prioridad 1 — Falabella y Lider. Son los dos de mayor venta y mayor brecha combinadas.", "«los dos de mayor venta» sin universo: no se juzga (candado del Examen 4)");

H("7 · cobranza: urgencia, recuperación, vencido, pendiente (P2·1) — verificados contra la misma mesa");
arde("**Lider queda primero**: no es la que más contribución sin capturar tiene, pero es la más severa en brecha al benchmark (8.6 pp), la más urgente en cobranza (269 días vencidos, peor recuperación) y también aparece en carga excedida.", /Lider es «la más urgente» en dias vencido.*Easy \(270d contra 269d/, "«la más urgente en cobranza (269 días vencidos, peor recuperación)» arde por los días (Easy 270)");
arde("**Lider queda primero**: es la más urgente en cobranza (269 días vencidos, peor recuperación).", /Lider es «peor» en recuperado.*Sodimac \(35% contra 45%/, "…y por la recuperación (Sodimac 35%)");
vive("**Easy queda primero**: es la más urgente en cobranza (270 días vencidos).", "la cuenta correcta (Easy 270) vive");
arde("Lider es la cuenta con más días de atraso de la cartera (269).", /Lider es «con más» en dias vencido/, "«la cuenta con más días de atraso de la cartera» arde");
vive("Easy es la cuenta con más días de atraso de la cartera (270).", "…y Easy vive");
arde("Lider tiene la peor recuperación de la cobranza (45%).", /Lider es «peor» en recuperado/, "«la peor recuperación de la cobranza» arde (Sodimac 35%)");
vive("Sodimac tiene la peor recuperación de la cobranza (35%).", "…y Sodimac vive");
vive("Lider tiene el mayor saldo vencido de la cartera ($4.6M).", "«el mayor saldo vencido de la cartera» (Lider) vive");
arde("Falabella tiene el mayor saldo vencido de la cartera ($2.5M).", /Falabella es «mayor» en saldo vencido.*Lider \(\$4\.6M/, "…y Falabella arde");
vive("Lider tiene el mayor saldo pendiente de todos ($9.8M).", "«el mayor saldo pendiente de todos» (Lider) vive");
arde("Jumbo tiene la mejor recuperación de la cartera (70.5%).", /Jumbo es «mejor» en recuperado/, "«la mejor recuperación» de Jumbo arde (Mercado Libre y Ripley 77.8%)");
vive("Mercado Libre tiene la mejor recuperación de la cartera (77.8%).", "…y Mercado Libre vive (empate de valor con Ripley: vale)");
vive("Lider tiene el peor saldo pendiente de todos.", "«peor» sobre un ranking sin lado malo (saldo pendiente): no se juzga");
vive("Falabella va segundo (mayor $ en contribución no capturada, $1.6M, pero menos urgente en cobranza: 8 días de atraso).", "«menos urgente» sin artículo ni «con»: comparativo, fuera");
vive("Lider requiere más urgencia en la cobranza.", "«más urgencia» sin artículo: comparativo, fuera");

H("8 · el ordinal bajo el candado del plural (P2·2): el candado mira su cláusula, no la oración");
arde("**Dónde pondría el foco primero**: integrando severidad, materialidad y urgencia entre los tres dominios, empezaría por **Lider** — es la cuenta más grave en cobranza (269 días vencidos, solo 45% recuperado) y la segunda en brecha de margen (8.6 pp, la mayor de todas).", /Lider es «segunda en» en brecha.*puesto 2 va Falabella/, "«entre los tres dominios … la segunda en brecha de margen (8.6 pp)» arde: Lider es la primera");
vive("Integrando las señales entre los tres dominios, empezaría por Falabella — es la segunda en brecha de margen (8.1 pp).", "…y Falabella (segunda de verdad) vive");
arde("Lider es la cuenta más grave en cobranza y la segunda en brecha de margen (8.6 pp).", /«segunda en» en brecha/, "candado del gate de prioridad: «la segunda en brecha» sigue ardiendo");
vive("Es tu cliente #3 en contribución ($3.8M).", "«#3 en contribución» sin antecedente: no se juzga");
arde("- Jumbo: margen 24.0%, carga 3.8%. Es tu cliente #3 en contribución ($4.2M).", /Jumbo es «#3 en» en contribucion.*puesto 3 va Lider/, "«#3 en contribución» sobre Jumbo (que es #2) arde");

H("9 · lo que sigue igual: comparativo, negación, cópula, posesivo, el eje SKU");
vive("Falabella solo: $1.6M de contribución no capturada — la mayor de la cartera, aunque no el margen más bajo (ese es Líder, con 21.5% contra 22% de Falabella).", "el superlativo negado no reclama nada");
vive("El que más capital inmovilizado tiene entre los tres frenados es **LG-DRYER8KG**: $14K de capital.", "la construcción hendida del Examen 5 vive");
arde("Entre LG-DRYER8KG y MAK-COMP-AIR, el que más capital inmovilizado tiene es **MAK-COMP-AIR**.", /MAK-COMP-AIR es «con más|el que más/, "…y con el nombre equivocado arde");
arde("Falabella tiene el peor margen de los tres grandes: 22.0%, contra 21.5% de Lider y 24.0% de Jumbo.", /Falabella es «peor» en margen/, "el caso control del owner (Examen 4) sigue muriendo");
vive("Lider tiene el peor margen de los tres grandes: 21.5%, contra 22.0% de Falabella y 24.0% de Jumbo.", "…y su versión verdadera vive");
arde("BOS-SANDER es el SKU con más días de inventario de todos: 115d.", /BOS-SANDER es «con más» en dias inventario/, "el eje SKU sigue verificándose");
vive("Lider tiene $17.8M de venta y la quinta peor carga comercial de la cartera.", "el ordinal correcto (quinta) vive");
arde("Lider tiene $17.8M de venta y la segunda peor carga comercial sobre meta.", /Lider es «segunda peor» en carga/, "el ordinal falso (segunda) arde");

H("10 · lo que la suite destapó al primer paso: tres falsos positivos cerrados en la regla, y un error de orden real más");
vive("El mayor capital en la foto actual está en SAM-REF500L ($19K) y LG-WASH11KG ($15K), pero LG-DRYER8KG ($14K) y BOS-SANDER ($11K) ni siquiera aparecen entre los SKU de mayor venta ni de mayor contribución.", "«LG-WASH11KG» no nombra a la marca LG: el prefijo de un código no es una mención (prueba viva del cruce)");
vive("Ranking de los 5 SKU inmovilizados, de mayor a menor capital: LG-DRYER8KG $14K, SAM-TV55 $13K, BOS-SANDER $11K, PHI-IRON-PRO $10K, MAK-COMP-AIR $8K.", "«de mayor a menor» es una dirección de orden, no una afirmación (roce de universos)");
vive("Al 31 ago 2026, Líder tiene $9.8M de saldo pendiente, de los cuales $4.6M están vencidos hace 269 días, con solo 45% recuperado — el peor perfil de cobranza de la cartera.", "«45% recuperado — el peor PERFIL de cobranza»: el marcador trae su propio sustantivo, no toma el recuperado de atrás (corrida 3 de la prueba 1)");
vive("- Cobranza: $4.6M vencidos, con 269 días de atraso y solo 45% recuperado — la peor cobranza de la cartera, al corte del 31 ago 2026.", "«— la peor COBRANZA de la cartera»: ídem (segundo prompt en vivo)");
arde("Lider: 45% recuperado — el peor de la cartera.", /Lider es «peor» en recuperado.*Sodimac \(35%/, "…pero el marcador ABSOLUTO («— el peor de la cartera») sí toma el recuperado de atrás, y con Lider arde (Sodimac 35%)");
vive("Sodimac: 35% recuperado — el peor de la cartera.", "…y con Sodimac vive");
arde("Con Lider: no cortaría la cuenta, pero sí conversaría el saldo vencido antes de seguir extendiendo carga comercial — 269 días y 45% de recuperación es la señal más urgente de la cartera.", /Lider es «la señal más urgente» en dias vencido.*Easy \(270d/, "«269 días … es la señal más urgente de la cartera» (texto servido en vivo del segundo prompt) arde: la misma falsedad que P2·1, Easy tiene 270 días");
vive("Con Easy: 270 días y 40% de recuperación es la señal más urgente de la cartera.", "…y con Easy vive");
vive("- Contribución no capturada: $1.5M (segunda más alta, detrás de Falabella con $1.6M).", "«$1.5M (segunda más alta, …)» de Lider: el ordinal cabe entre la métrica y el marcador, y Lider es segundo — vive");

console.log(`\n── _orden_verificado_gate: ${PASS} PASS · ${FAIL} FAIL (de ${PASS + FAIL}) ──`);
process.exit(FAIL ? 1 : 0);
