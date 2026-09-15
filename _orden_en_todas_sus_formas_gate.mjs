/* === _orden_en_todas_sus_formas_gate.mjs · EL ORDEN SE VERIFICA EN TODAS SUS FORMAS (owner 2026-09-14, conjunto adversarial · familia ORDEN) ═══
 * LA MEDIDA: tras «atribución y significado», el conjunto adversarial dejaba 158 de 249 afirmaciones de orden FALSAS sin veto (63.5 %) y
 * decenas de afirmaciones de orden verdaderas vetadas. La raíz era una: el muro verificaba cinco marcadores («mayor / menor / más alto /
 * peor / con más») con dos formas de universo («de la cartera», «de todos»), y el orden se dice de muchas más maneras. Este gate es el
 * candado de cada regla, con frases del conjunto EN LAS DOS DIRECCIONES (la verdadera pasa · la falsa arde), sobre el contexto del bucle:
 *   1 · el LÉXICO DECLARADO por métrica (`lexico` de cada ranking en datoProyectado): verbos («la que más vende»), adjetivos con polaridad
 *       («la más morosa», «el más lento»), agentes («el mayor deudor», «el peor pagador») y los adjetivos de magnitud («más ancha / abultado /
 *       flaco»);
 *   2 · las FORMAS DEL UNIVERSO («de tu cartera», «de los 13 clientes», «entre todos tus clientes», «del portafolio», «a nivel cartera», «de las
 *       cinco marcas», «el cliente / la cuenta / la que / el de», «tu cliente», «lidera», «que nadie», «el último»);
 *   3 · los ORDINALES en todas sus formas (y «primero» como orden de una métrica, NO como prioridad del cierre);
 *   4 · los GRUPOS top-k, la PERTENENCIA, «junto con», los ordinales repartidos y el subconjunto resuelto («de los tres grandes», «de los tres»);
 *   5 · los ENCADENADOS («y con más», «y la mayor», «además de … es el de más», «lidera en X y Y»);
 *   6 · los COMPARATIVOS con las dos cifras y, sin cifras, contra el ranking (`comparacion-no-sostenida`); el contrato ya no prohíbe lo verificable;
 *   7 · los RANKINGS ANUNCIADOS y las SECUENCIAS («seguido de», «después de X viene Y») comparados con el ranking en orden y dirección;
 *   8 · la ATADURA métrica↔marcador («que es», «lo que la convierte en», «llega a», «sigue siendo», «la cifra más alta») y el RECLAMANTE detrás en
 *       todas sus formas («es el de X», «lo tiene X», «corresponde a X», «está en X», «: X», la aposición);
 *   9 · los FALSOS POSITIVOS de orden: la exclusión excluye, la negación se lee (antes, pospuesta, «ninguno», «nada»), el adjetivo de juicio sigue
 *       al eje declarado, el contraste, y lo que sigue sin juzgarse por calibración (una sola entidad sin universo; «la peor cobranza / el peor
 *       perfil»);
 *  10 · la RELACIÓN CON LA REFERENCIA por sujeto de cláusula y con la negación (`relacion-contradictoria`);
 *  11 · la RELACIÓN EN PALABRAS en las dos direcciones («casi la mitad» = «casi el doble» al revés);
 *  12 · los RANKINGS NUEVOS: venta y contribución por SKU, capital por bodega, y «frenado» ≠ «inmovilizado».
 * Cero red: herramientas puras, fixtures en disco. */
import fs from "node:fs";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { ESCENARIO_INICIAL } from "./src/config/scenarios.js";
import { runPlan } from "./src/adi/oracle/toolRunner.js";
import { TOOLS } from "./src/adi/oracle/toolRegistry.js";
import { cajaDelAgente } from "./src/adi/agente/herramientasAgente.js";
import { guardC } from "./src/adi/oracle/guardC.js";
import { cifrasDelDato } from "./src/adi/oracle/datoProyectado.js";
import { playbookPara, pasosDe } from "./src/adi/agente/playbooks/registro.js";
import { partesDelEncargo, pasosDelEncargo } from "./src/adi/agente/encargoCompuesto.js";
import { vetosDeRegistro } from "./src/adi/agente/contratoAgente.js";
import { axisEntityNames } from "./src/adi/oracle/entityIndex.js";
import { stripLanguageLeaks } from "./src/adi/llm/voiceGuard.js";

let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };
const H = (t) => console.log("\n" + t);
initTenant(TENANT_DEMO);
const CAJA = cajaDelAgente(TOOLS);
const _ejes = (lista) => { const o = []; for (const e of lista) { try { for (const n of axisEntityNames(e)) o.push(n); } catch { /* eje sin índice */ } } return o.length ? o : null; };
const _porEje = () => { const o = {}; for (const e of ["cliente", "sku", "marca", "familia", "bodega", "canal"]) { try { const n = axisEntityNames(e); if (n && n.length) o[e] = n; } catch { /* eje sin índice */ } } return o; };
const A = JSON.parse(fs.readFileSync(new URL("./fixtures/adversarial-notario-2026-09-14.json", import.meta.url), "utf8"));
const LEYES = new Set(A.leyes_de_la_casa);
const juezDe = (pregunta) => {
  const pb = playbookPara(pregunta, {});
  const rp = runPlan({ intent: "answer", calls: pasosDelEncargo(partesDelEncargo(pregunta), pb ? pasosDe(pb, pregunta, {}) : [], {}).map((p) => ({ tool: p.tool, args: p.args || {} })) }, { scenario: ESCENARIO_INICIAL, maxCalls: 18, preguntaUsuario: pregunta, registry: CAJA });
  const ctx = { ledger: { figs: rp.ledger.figs }, results: rp.results, trace: null, question: pregunta, datoProyectado: cifrasDelDato(ESCENARIO_INICIAL), entidadesDelTenant: _ejes(["cliente", "sku", "marca"]), duenosDelTenant: _ejes(["cliente", "sku", "marca", "familia", "bodega", "canal"]), ejesDelTenant: _porEje(), contentScope: "full" };
  return (t0) => {
    const t = stripLanguageLeaks(String(t0));
    const v = guardC(t, ctx);
    const kinds = (v.ok ? [] : (v.violations || [])).filter((x) => !LEYES.has(x.kind)).map((x) => x.kind);
    const todos = (v.ok ? [] : (v.violations || [])).map((x) => x.kind);
    for (const x of vetosDeRegistro(t, { pregunta, figs: rp.ledger.figs, sitio: "cierre" })) { todos.push(x.regla); if (!LEYES.has(x.regla)) kinds.push(x.regla); }
    return { kinds, todos, detalle: (v.violations || []).map((x) => `${x.kind}: ${String(x.detail).slice(0, 110)}`).join(" ‖ ") };
  };
};
const J = { P1: juezDe(A.preguntas.P1), P2: juezDe(A.preguntas.P2) };
const pasa = (frase, m = "", ctx = "P1") => { const r = J[ctx](frase); ok(r.kinds.length === 0, `pasa · «${frase.slice(0, 96)}»${m ? " — " + m : ""}`, r.detalle); };
const arde = (frase, re, m = "", ctx = "P1") => { const r = J[ctx](frase); ok(r.kinds.some((k) => re.test(k)), `arde · «${frase.slice(0, 96)}»${m ? " — " + m : ""} → ${re}`, r.kinds.join(", ") || "sin veto"); };
/* «no arde POR ESTA LEY»: incluye las leyes de la casa (para «primero» de ranking contra la prioridad del cierre) */
const sinLey = (frase, re, m = "", ctx = "P1") => { const r = J[ctx](frase); ok(!r.todos.some((k) => re.test(k)), `sin ${re} · «${frase.slice(0, 96)}»${m ? " — " + m : ""}`, r.todos.join(", ")); };
const SUP = /superlativo-no-sostenido/, CMP = /comparacion-no-sostenida/, RK = /ranking-no-sostenido/, REF = /relacion-contradictoria/, REL = /relacion-en-palabras-no-cierra/;

H("0 · la carpeta declara el léxico y los rankings nuevos");
{
  const R = cifrasDelDato(ESCENARIO_INICIAL).rankings;
  ok(R.cliente.ventas.lexico && R.cliente.ventas.lexico.verbos.includes("vend") && R.cliente.ventas.lexico.agentes.some((g) => /vendedor/.test(g)), "ventas declara el verbo «vend» y el agente «vendedor»");
  ok(R.cliente.dias_vencido.lexico && R.cliente.dias_vencido.lexico.adjetivos["moros[oa]s?"] === "mayor" && R.cliente.dias_vencido.lexico.juicio.includes("urgentes?"), "días vencidos declara «morosa» (mayor) y «urgente» como adjetivo de juicio");
  ok(R.sku.rotacion.lexico.adjetivos["lent[oa]s?"] === "menor" && R.sku.dias_inventario.lexico.adjetivos["lent[oa]s?"] === "mayor", "«lento» es MENOS rotación y MÁS días: la polaridad la declara cada métrica");
  ok(R.sku.ventas && R.sku.contribucion && R.sku.ventas.filas.length === 13 && R.bodega && R.bodega.capital.filas.length === 4, "el eje SKU declara venta y contribución (año cerrado) y el eje bodega su capital");
  ok(R.sku.capital_frenado && R.sku.capital_frenado.filas.length === 3 && R.sku.capital_inmovilizado.filas.length === 5 && !R.sku.capital_inmovilizado.terminos.some((t) => /frenado/.test(t)), "«capital frenado» (3, POLICY) y «capital inmovilizado» (5, estado ≠ Activo) son dos rankings, cada término en el suyo");
}

H("1 · EL LÉXICO DECLARADO POR MÉTRICA: verbo, adjetivo con polaridad, agente, magnitud");
arde("Jumbo es la que más vende de la cartera ($17.3M).", SUP, "el verbo «vende» nombra las ventas (Falabella $19.4M)");
pasa("Falabella es la que más vende de la cartera ($19.4M).");
arde("Lider es el que más contribución aporta de la cartera ($3.8M).", SUP);
arde("El mayor vendedor, Jumbo ($17.3M), tiene margen 24%.", SUP, "el agente «vendedor» y la aposición «, Jumbo»");
pasa("El mayor vendedor, Falabella ($19.4M), tiene margen 22%.");
arde("Falabella es el mayor deudor de la cartera, con $2.5M vencidos.", SUP, "«deudor» es el saldo vencido (Lider $4.6M)");
pasa("Lider es el mayor deudor de la cartera, con $4.6M vencidos.");
arde("Lider es el peor pagador de la cartera (45% recuperado).", SUP, "«pagador» es lo recuperado (Sodimac 35%)");
pasa("Sodimac es el peor pagador de la cartera (35% recuperado).");
arde("Con 4.8%, Ripley es la cuenta más cargada de la cartera.", SUP, "el adjetivo «cargada» es la carga (Easy 5.5%)");
pasa("Con 5.5%, Easy es la cuenta más cargada de la cartera.");
arde("Lider es la más atrasada de la cartera (269 días).", SUP, "«atrasada» son los días (Easy 270)");
pasa("Easy es la más atrasada de la cartera (270 días).");
arde("BOS-SANDER es el más lento del inventario (1.6x de rotación).", SUP, "«lento» es MENOS rotación (MAK-COMP-AIR 0.8x)");
pasa("MAK-COMP-AIR es el más lento del inventario (0.8x de rotación).");
arde("BOS-SANDER rota peor que ninguno (1.6x).", SUP, "«peor que ninguno» es un superlativo sobre el eje entero");
arde("La brecha más ancha de la cartera es la de Falabella (8.1 pp).", SUP, "«más ancha» es un adjetivo de magnitud (Lider 8.6 pp)");
pasa("La brecha más ancha de la cartera es la de Lider (8.6 pp).");
arde("Falabella tiene el saldo vencido más abultado de la cartera ($2.5M).", SUP);
arde("Falabella tiene el margen más flaco de la cartera (22.0%).", SUP, "«más flaco» es el mínimo (Lider 21.5%)");
pasa("Lider tiene el margen más flaco de la cartera (21.5%).");

H("2 · LAS FORMAS DEL UNIVERSO");
arde("Falabella tiene la carga más alta de tu cartera (4.5%).", SUP, "«de tu cartera»");
arde("Falabella tiene la carga más alta de los 13 clientes (4.5%).", SUP, "«de los 13 clientes» es el eje entero (13 = las filas del ranking), no un subconjunto");
pasa("Easy tiene la carga más alta de los 13 clientes (5.5%).");
arde("Falabella tiene la carga más alta entre todos tus clientes (4.5%).", SUP, "«entre todos» no acota");
arde("Jumbo tiene la mayor contribución del portafolio ($4.2M).", SUP);
arde("A nivel cartera, Jumbo tiene la mayor contribución ($4.2M).", SUP);
arde("Samsung tiene el peor margen de las cinco marcas (24.2%).", SUP, "«de las cinco marcas» son las cinco (LG 24.0%)");
pasa("LG tiene el peor margen de las cinco marcas (24.0%).");
arde("Jumbo es el cliente con mayor venta ($17.3M).", SUP, "«el cliente con mayor» — el artículo sobre el eje");
arde("La cuenta con la carga más alta es Ripley (4.8%).", SUP, "«la cuenta con la carga más alta» (artículo entre medio) y la cópula detrás");
pasa("La cuenta con la carga más alta es Easy (5.5%).");
arde("Jumbo es tu mayor cliente por contribución ($4.2M).", SUP, "«tu mayor cliente» — el posesivo sobre el eje");
arde("Jumbo es el principal cliente de la cartera por venta ($17.3M).", SUP, "«principal» es el MÁXIMO (antes iba con la polaridad de «peor»)");
pasa("En venta, Falabella es la principal de la cartera ($19.4M).", "…y el principal verdadero vive (antes ardía por esa polaridad)");
pasa("Lider tiene la carga más alta.", "una sola entidad SIN universo no se juzga (decisión de calibración, intacta)");
arde("Jumbo lidera la cartera en contribución ($4.2M).", SUP, "«lidera» es serlo sobre el eje entero");
pasa("Falabella lidera la contribución con $4.3M.");
arde("Lider lidera la contribución con $3.8M.", SUP);
arde("Lider encabeza el ranking de venta de la cartera con $17.8M.", SUP, "«encabeza el ranking de»");
arde("ABC es el último en ventas de la cartera ($2.5M).", SUP, "«el último» es el mínimo (Unimarc $2.3M)");
pasa("Unimarc es el último en ventas de la cartera ($2.3M).");
arde("Nadie aporta más contribución que Jumbo ($4.2M).", SUP, "«nadie … más que Y»: el extremo es Y");
pasa("Nadie aporta más contribución que Falabella ($4.3M).");
arde("Ninguna cuenta tiene más días de atraso que Lider (269).", SUP);
arde("Jumbo genera más contribución que ningún otro cliente ($4.2M).", SUP, "«más … que ningún otro»: el sujeto sobre el eje entero");
arde("Lider vende más que nadie ($17.8M).", SUP, "el verbo delante y «que nadie» detrás");

H("3 · LOS ORDINALES EN TODAS SUS FORMAS");
arde("Lider es el segundo cliente en contribución ($3.8M).", SUP, "«segundo cliente en» (Jumbo es 2.º)");
pasa("Jumbo es el segundo cliente en contribución ($4.2M).");
arde("Lider ocupa el tercer lugar en ventas ($17.8M).", SUP, "«ocupa el tercer lugar en» (Lider es 2.º)");
pasa("Jumbo ocupa el tercer lugar en ventas ($17.3M).");
arde("Sodimac ocupa el segundo lugar en vencido ($1.9M).", SUP);
arde("Jumbo es tu cliente n.º 1 en ventas ($17.3M).", SUP, "«n.º 1 en»");
arde("Jumbo es 2.º en ventas ($17.3M).", SUP, "«2.º en»");
pasa("Lider es 2.º en ventas ($17.8M).");
arde("Jumbo es el 2do en ventas ($17.3M).", SUP, "«2do en»");
arde("Jumbo va primero en contribución ($4.2M).", SUP, "«va primero en» es el máximo de una métrica");
pasa("Falabella va primero en contribución ($4.3M).");
arde("Falabella es el primero en saldo vencido ($2.5M).", SUP);
arde("En ventas, Jumbo está segundo ($17.3M).", SUP, "«está segundo» con la métrica DELANTE");
pasa("En ventas, Lider está segundo ($17.8M).");
arde("En ventas Jumbo es el segundo ($17.3M), detrás de Falabella.", SUP);
arde("Jumbo es el segundo mayor cliente por venta ($17.3M).", SUP, "«segundo mayor cliente por»");
arde("Jumbo, segundo por ventas ($17.3M), sostiene el crecimiento.", SUP, "«segundo por»");
arde("Jumbo es el tercero por contribución ($4.2M).", SUP, "«el tercero por» (Jumbo es 2.º)");
arde("Jumbo es la segunda venta de la cartera ($17.3M).", SUP, "el ordinal con la métrica pegada detrás");
pasa("Lider es la segunda venta de la cartera ($17.8M).");
pasa("Jumbo tiene la segunda contribución más alta de la cartera ($4.2M).", "el ordinal con el sustantivo de la métrica entre medio (fp-prosa 7 lo leía como máximo absoluto)");
arde("Lider tiene la segunda contribución más alta de la cartera ($3.8M).", SUP, "…y el ordinal falso arde");
pasa("Falabella tiene el segundo vencido más alto ($2.5M, detrás de Lider).", "«detrás de Lider» tras un ordinal confirma el puesto, no excluye");
pasa("Sodimac tiene la segunda carga más alta (5.4%), solo detrás de Easy (5.5%).");
pasa("Lider es el segundo más atrasado de la cartera (269 días).", "el ordinal dentro del marcador («el segundo más atrasado»)");
arde("Sodimac es el segundo más atrasado de la cartera (251 días).", SUP);
pasa("Falabella y Lider: la primera vende más ($19.4M contra $17.8M), la segunda debe más vencido ($4.6M contra $2.5M).", "«la primera / la segunda» + verbo es anáfora de la lista, no un puesto");
pasa("Lider es la segunda en venta ($17.8M, detrás de Falabella) y la tercera en contribución ($3.8M, detrás de Falabella y Jumbo).", "el «detrás de» de un paréntesis ajeno no excluye a nadie");
pasa("Tottus y Paris, con $1.3M y $1.2M vencidos, van cuarta y quinta.", "los ordinales repartidos sobre un sujeto coordinado");
arde("Tottus y Paris, con $1.3M y $1.2M vencidos, van quinta y cuarta.", SUP, "…y al revés arden");
/* «primero» como orden de una métrica no es la prioridad del cierre (prioridad-integrada-cambiada, ley de la casa · fp-listas P9) */
sinLey("Por venta, Falabella va primero ($19.4M), Lider segundo ($17.8M) y Jumbo tercero ($17.3M).", /prioridad-integrada-cambiada/, "«por venta … primero» es un ranking");
sinLey("Entre los que más venden, Falabella ($19.4M) va primero.", /prioridad-integrada-cambiada/);
sinLey("En vencido, Lider va primero ($4.6M) y Falabella segunda ($2.5M).", /prioridad-integrada-cambiada/);
pasa("Por venta, Falabella va primero ($19.4M), Lider segundo ($17.8M) y Jumbo tercero ($17.3M).", "…y como orden verdadero, vive");

H("4 · LOS GRUPOS TOP-k, LA PERTENENCIA, «JUNTO CON» Y EL SUBCONJUNTO RESUELTO");
arde("Las tres cuentas con más contribución son Falabella, Jumbo y Sodimac ($4.3M, $4.2M y $1.9M).", SUP, "«las tres cuentas con más»: Lider ($3.8M) es tercero");
pasa("Las tres cuentas con más contribución son Falabella, Jumbo y Lider ($4.3M, $4.2M y $3.8M).");
arde("Los tres con más vencido son Lider, Falabella y Tottus.", SUP, "«los tres con más» sin sustantivo (Sodimac es tercero)");
pasa("Los tres con más vencido son Lider, Falabella y Sodimac.");
arde("Falabella, Lider y Sodimac son los tres que más venden en la cartera.", SUP, "«los tres que más venden en la cartera» (Jumbo es tercero)");
arde("Los dos mayores saldos vencidos de la cartera son los de Lider y Sodimac ($4.6M y $1.9M).", SUP, "el plural del sustantivo («saldos vencidos»)");
pasa("Los dos mayores saldos vencidos de la cartera son los de Lider y Falabella ($4.6M y $2.5M).");
arde("Tu top 3 por contribución: Falabella, Jumbo y Sodimac.", SUP, "«top 3» anunciado");
pasa("Tu top 3 por contribución: Falabella, Jumbo y Lider.");
arde("Los tres grandes de la cartera por venta son Falabella, Lider y Sodimac.", SUP, "«los tres grandes por venta» (Jumbo es tercero)");
arde("Los tres primeros de la cartera en contribución son Falabella, Jumbo y Sodimac.", SUP, "«los tres primeros en»");
arde("Sodimac está entre los tres de mayor contribución de la cartera ($1.9M).", SUP, "la pertenencia: Sodimac es cuarto");
pasa("Lider está entre los tres de mayor contribución de la cartera ($3.8M).");
arde("Sodimac es uno de los tres clientes de mayor contribución de la cartera ($1.9M).", SUP, "«uno de los tres»");
arde("Sodimac entra en el top 3 de contribución ($1.9M).", SUP, "«entra en el top 3»");
arde("Sodimac es una de las dos cuentas con más vencido ($1.9M).", SUP, "«una de las dos con más»");
pasa("Falabella es una de las dos cuentas con más vencido ($2.5M).");
arde("Entre las tres cuentas que más venden está Sodimac ($8.2M).", SUP, "«entre las tres que más X está Y»");
pasa("Entre las tres cuentas que más venden está Jumbo ($17.3M).");
arde("Jumbo es el que más unidades vende, junto con Lider (1.194 y 894).", SUP, "«junto con» arma el top-2 (Falabella 1.042 es segundo)");
pasa("Jumbo es el que más unidades vende, junto con Falabella (1.194 y 1.042).");
arde("Jumbo tiene el margen más bajo de los tres grandes (24.0%).", SUP, "«de los tres grandes» son los tres de mayor venta (Lider 21.5%)");
pasa("Lider tiene el margen más bajo de los tres grandes (21.5%).");
arde("Falabella, Lider y Jumbo empujan el crecimiento. De los tres, Jumbo tiene el margen más bajo (24.0%).", SUP, "«de los tres» resuelve a la lista de la oración anterior");
arde("Entre Falabella, Lider y Jumbo, Jumbo tiene el margen más bajo (24.0%).", SUP, "«entre A, B y C» con el sujeto repetido no acorta la lista");
arde("Sodimac (35%, la peor recuperación) y Lider (45%) son las dos cuentas que menos recuperan.", SUP, "las dos que menos recuperan son Sodimac y Easy (40%) — rótulo corregido en el fixture");
pasa("Sodimac (35%, la peor recuperación) y Easy (40%) son las dos cuentas que menos recuperan.");

H("5 · LOS ENCADENADOS");
arde("Jumbo es el cliente con más unidades vendidas (1.194) y con más contribución ($4.2M).", SUP, "«y con más»");
arde("Jumbo es el cliente con más unidades (1.194), y también con más contribución ($4.2M).", SUP, "«y también con más»");
arde("Jumbo, además de ser el cliente con más unidades (1.194), es el de más contribución ($4.2M).", SUP, "«además de … es el de más»");
arde("Jumbo es el cliente con más unidades (1.194) y la mayor contribución ($4.2M).", SUP, "«y la mayor»");
arde("Jumbo es el cliente con más unidades (1.194) y, además, más contribución ($4.2M).", SUP, "«y, además, más»");
arde("Lider es el que más vende y el que menos margen deja de la cartera ($17.8M, 21.5%).", SUP, "«el que más … y el que menos»: la venta arde (Falabella)");
pasa("Falabella es el cliente con más contribución ($4.3M) y más venta ($19.4M).", "la cadena verdadera vive");
pasa("Falabella lidera en venta ($19.4M) y contribución ($4.3M); Lider, en saldo pendiente ($9.8M) y vencido ($4.6M); Jumbo, en unidades (1.194).", "«lidera en X y Y»: el término pegado encadena, y la cláusula tras «;» no");
pasa("Lider es la segunda cuenta con más días de atraso: 269, un día menos que Easy.", "«días DE atraso»: la «e» de una palabra no encadena");

H("6 · LOS COMPARATIVOS: con las dos cifras, y sin cifras contra el ranking");
arde("Lider vende más que Falabella ($17.8M contra $19.4M).", CMP, "el par «x contra y» contradice el «más»");
pasa("Falabella vende más que Lider ($19.4M contra $17.8M).");
arde("Jumbo contribuye más que Falabella ($4.2M vs $4.3M).", CMP);
arde("La carga de Falabella (4.5%) supera a la de Sodimac (5.4%).", CMP, "la cifra pegada a cada nombre");
arde("Easy recupera menos que Sodimac (40% contra 35%).", CMP);
arde("Sodimac tiene más saldo vencido que Falabella ($1.9M contra $2.5M).", CMP);
arde("Jumbo ($4.2M) contribuye más que Falabella ($4.3M).", CMP);
arde("En margen, Falabella (22.0%) está por encima de Jumbo (24.0%).", CMP, "«por encima de» con la métrica al abrir");
arde("Jumbo supera a Falabella en contribución ($4.2M contra $4.3M).", CMP, "«supera a X en»");
arde("El vencido de Sodimac ($1.9M) supera al de Falabella ($2.5M).", CMP, "«supera al de»");
arde("Lider es más urgente que Easy en cobranza (269 días contra 270).", CMP, "el adjetivo «urgente» (días) con el par");
arde("Lider crece menos que Jumbo (+14.9% contra +12.2%).", CMP, "sin ranking, las cifras deciden");
arde("Jumbo vende más que Lider.", CMP, "sin cifras: contra el ranking ($17.3M < $17.8M)");
pasa("Lider vende más que Jumbo.", "…y el verdadero sin cifras vive: prohibir no es responder");
arde("Sodimac arrastra más días de atraso que Lider.", CMP);
arde("Falabella tiene más saldo vencido que Lider.", CMP);
arde("Falabella tiene mayor brecha que Lider.", /superlativo-no-sostenido|comparacion-no-sostenida/, "«brecha» a secas es la brecha de margen (8.1 < 8.6)");
pasa("Sodimac tiene mayor brecha al benchmark que Jumbo (6.6 pp contra 6.1 pp).");
pasa("Falabella deja más contribución que Lider.", "verdadero sin cifras: el contrato ya no lo prohíbe (`comparacion-sin-cifras`)");
pasa("Jumbo paga menos carga que Lider.");
pasa("Falabella produce más contribución en dólares que Lider, aunque su margen es apenas mejor.");
pasa("Jumbo mueve más unidades y paga menos carga que Lider.");
pasa("El markup de Lider (37.2%) es más bajo que el de Falabella (39.1%) y que el de Jumbo (38.3%).", "«más BAJO que»: el adjetivo fija el lado");
pasa("Lider pesa más que Falabella en cobranza: $4.6M vencidos (contra $2.5M) y 45% recuperado (contra 57.7%).", "«pesa más» no es una métrica: no se le ata el recuperado de después (y «cobranza» no es el verbo «cobrar»)");
arde("Los grandes ceden más carga que el resto.", /comparacion-sin-cifras/, "un lado que es un GRUPO sigue exigiendo cifras (contrato)");
arde("Falabella tiene más markup que Lider.", /comparacion-sin-cifras/, "una métrica sin ranking sigue exigiendo cifras (contrato)");

H("7 · LOS RANKINGS ANUNCIADOS Y LAS SECUENCIAS");
arde("Por venta, el orden es Falabella, Jumbo y Lider ($19.4M, $17.3M y $17.8M) — 3 de 13.", RK, "«el orden es» con Jumbo antes que Lider");
pasa("Por venta, el orden es Falabella, Lider y Jumbo ($19.4M, $17.8M y $17.3M) — 3 de 13.");
arde("Ordenados por venta de mayor a menor (3 de 13): Falabella $19.4M, Jumbo $17.3M, Lider $17.8M.", RK);
arde("Ranking de saldo vencido (6 de 13): Lider $4.6M, Sodimac $1.9M, Falabella $2.5M, Tottus $1.3M, Paris $1.2M, Easy $1.1M.", RK);
pasa("Ranking de saldo vencido (6 de 13): Lider $4.6M, Falabella $2.5M, Sodimac $1.9M, Tottus $1.3M, Paris $1.2M, Easy $1.1M.");
arde("De peor a mejor recuperación (3 de 13): Lider 45%, Sodimac 35%, Easy 40%.", RK, "«de peor a mejor» con la polaridad de la métrica");
pasa("De peor a mejor recuperación (3 de 13): Sodimac 35%, Easy 40%, Lider 45%.");
arde("Los tres que más contribuyen, en este orden: Falabella, Lider y Jumbo ($4.3M, $3.8M y $4.2M).", RK, "«en este orden»");
arde("Por orden de carga comercial (4 de 13): Sodimac 5.4%, Easy 5.5%, Ripley 4.8%, Falabella 4.5%.", RK, "«por orden de»");
pasa("Ranking de los 5 SKU inmovilizados, de mayor a menor capital: LG-DRYER8KG $14K, SAM-TV55 $13K, BOS-SANDER $11K, PHI-IRON-PRO $10K, MAK-COMP-AIR $8K.", "el ranking correcto vive (roce de universos)");
pasa("Falabella ($4.3M) es el que más contribución deja, seguido de Jumbo ($4.2M) y Lider ($3.8M).", "«seguido de» con el orden real; y la cifra reclamada es la del reclamante, no la del seguidor (fp-comparaciones 3)");
arde("Falabella ($4.3M) es el que más contribución deja, seguido de Lider ($3.8M) y Jumbo ($4.2M).", RK, "…y con los seguidores al revés arde");
pasa("Easy (270 días) es la más atrasada, seguida de Lider (269) y Sodimac (251).");
arde("En vencido, después de Lider viene Sodimac ($1.9M).", RK, "«después de X viene Y» (viene Falabella $2.5M)");
pasa("En vencido, después de Lider viene Falabella ($2.5M).");
pasa("En inventario el orden es claro: LG-DRYER8KG ($14K) es el que más capital frenado tiene, BOS-SANDER ($11K) el segundo y MAK-COMP-AIR ($8K) el tercero; en días de cobertura, el orden se invierte en la punta (MAK-COMP-AIR 190, LG-DRYER8KG 165).", "la secuencia se lee hasta el «;» y la cifra del reclamante es la suya");

H("8 · LA ATADURA MÉTRICA↔MARCADOR Y EL RECLAMANTE DETRÁS");
arde("Con una carga de 4.5%, Falabella queda como la más alta de la cartera.", SUP, "«queda como»");
arde("Falabella tiene una carga comercial del 4.5% que es la más alta de la cartera.", SUP, "«que es»");
arde("Falabella tiene una carga comercial de 4.5%, lo que la convierte en la más alta de la cartera.", SUP, "«lo que la convierte en»");
arde("La carga comercial de Falabella llega a 4.5%, la más alta de la cartera.", SUP, "«llega a»");
arde("La carga de Falabella (4.5%) sigue siendo la más alta de la cartera.", SUP, "«sigue siendo»");
arde("Jumbo aporta $4.2M de contribución, la cifra más alta de la cartera.", SUP, "«la cifra más alta»: el sustantivo genérico de la cifra no es objeto propio");
arde("Falabella tiene **carga 4.5%**, la más alta de la cartera.", SUP, "la negrita no rompe la atadura");
arde("Falabella, con 1.042 unidades, es el mayor volumen de la cartera.", SUP, "«con X unidades, es el mayor volumen»");
pasa("Jumbo, con 1.194 unidades, es el mayor volumen de la cartera.");
arde("El margen más bajo del negocio lo tiene Falabella: 22.0%.", SUP, "«lo tiene X»");
pasa("El margen más bajo del negocio lo tiene Lider: 21.5%.");
arde("La mayor carga comercial de la cartera es la de Falabella (4.5%).", SUP, "«es la de X»");
arde("La mayor carga comercial de la cartera corresponde a Falabella (4.5%).", SUP, "«corresponde a X»");
arde("La mayor carga comercial de la cartera está en Falabella (4.5%).", SUP, "«está en X»");
arde("La mayor carga comercial de la cartera: Falabella (4.5%).", SUP, "«: X»");
pasa("La mayor carga comercial de la cartera: Easy (5.5%).");
arde("El atraso más grande de la cartera es el de Lider (269 días).", SUP, "«es el de X» (Easy 270)");
arde("Jumbo es la mayor de la cartera en cuanto a contribución ($4.2M).", SUP, "el universo entre el marcador y la métrica («la mayor de la cartera en cuanto a»)");
arde("Falabella ($4.3M) y Jumbo ($4.2M) concentran la contribución; Jumbo es la mayor de la cartera.", SUP, "la métrica en la cláusula anterior (antes de «;»)");
arde("LG-DRYER8KG lleva 94 días sin venta, el período más largo del inventario.", SUP, "«el período más largo»: el sustantivo genérico y los días sin venta (MAK-COMP-AIR 112)");
arde("Lider viene creciendo 14.9%. Falabella, menos. Aun así, es la que más vencido tiene ($2.5M).", SUP, "el sujeto elidido «es la que más» es Falabella (Lider $4.6M)");
arde("El cliente que menos vende, ABC ($2.5M), está sobre el benchmark.", SUP, "«el cliente que menos» + aposición (Unimarc $2.3M)");

H("9 · LOS FALSOS POSITIVOS DE ORDEN");
pasa("Después de Lider, el mayor vencido es el de Falabella ($2.5M).", "la exclusión excluye: sin Lider, Falabella es el máximo");
pasa("Fuera de Lider, el mayor vencido es el de Falabella ($2.5M).");
pasa("Sacando a Lider, el mayor vencido es el de Falabella ($2.5M).");
pasa("Después de Sodimac, la peor recuperación es la de Easy (40%).");
pasa("Detrás de Falabella ($4.3M), el que más contribución deja es Jumbo ($4.2M).");
pasa("Después de Falabella, el que más contribución deja es Jumbo ($4.2M).");
arde("Después de Lider, el mayor vencido es el de Sodimac ($1.9M).", SUP, "…y con la exclusión el falso sigue ardiendo (sin Lider, Falabella $2.5M)");
pasa("Lider es el cliente con más unidades vendidas después de Jumbo y Falabella: 894.", "la exclusión detrás del marcador (candado de la familia B: antes no se juzgaba; ahora se verifica y es verdad)");
pasa("No es Falabella la de peor recuperación (recupera 57.7%): es Sodimac, con 35%.", "la negación del reclamante");
pasa("No es Falabella, con 57.7%, la de peor recuperación: es Sodimac (35%).", "…a más de tres palabras");
pasa("Ni Falabella ni Sodimac tienen el vencido más grande: lo tiene Lider ($4.6M).", "«ni A ni B»");
pasa("Ni Falabella ni Lider tienen la carga más alta: la tiene Easy (5.5%).");
pasa("Lider no tiene la carga comercial más alta de la cartera (4.2%); Easy sí (5.5%).");
pasa("Lider no es, ni de cerca, el que más carga (4.2%): Easy carga 5.5%.");
pasa("Falabella no tiene el saldo vencido más alto ($2.5M): lo tiene Lider ($4.6M).");
pasa("El mayor vencido no es el de Falabella ($2.5M) sino el de Lider ($4.6M).", "la cópula negada no nombra al reclamante; el «sino» sí");
pasa("Lider tiene la segunda venta más alta ($17.8M) y el tercer margen más bajo no: el más bajo (21.5%).", "la negación pospuesta («… no:»)");
pasa("Nada del capital frenado está en los SKU que más venden; está en LG-DRYER8KG ($14K), BOS-SANDER ($11K) y MAK-COMP-AIR ($8K).", "«nada … está en los que más venden»");
pasa("A mi juicio, Lider es la cuenta más urgente: no por los días (Easy tiene 270), sino por el monto vencido ($4.6M, el mayor de la cartera).", "«urgente» sigue al eje declarado (el monto vencido)");
pasa("Lider es la más urgente si miro el monto ($4.6M vencidos), Easy si miro los días (270).");
pasa("Lider es la más urgente en monto ($4.6M); Easy lo es en días (270).", "…y la cifra del reclamante elige el ranking");
pasa("Si el criterio es monto, la más urgente es Lider ($4.6M); si es antigüedad, Easy (270 días).");
pasa("Lider es la cuenta más urgente: concentra el mayor vencido de la cartera ($4.6M) con solo 45% recuperado.");
arde("La cuenta más urgente de cobrar es Lider: 269 días de atraso.", SUP, "…y con los días declarados, «urgente» son los días (Easy 270)");
arde("Lider es la más urgente en cobranza (269 días vencidos, peor recuperación).", SUP, "el caso de la auditoría (P2·1) sigue ardiendo");
pasa("Mercado Libre es el caso opuesto a Lider: su carga es la menor de la cartera (1.8%).", "el término del contraste no es el reclamante");
pasa("Lider tiene el peor perfil de cobro de la cartera (45% recuperado, 269 días).", "«el peor perfil» es un juicio con objeto propio: no se juzga (decisión de calibración, documentada)");
pasa("Lider es la peor cobranza de la cartera: 45% recuperado y 269 días de atraso.", "«la peor cobranza»: ídem");
pasa("Falabella: $1.6M sin capturar (la mayor de todas), 8.1 pp de brecha (la segunda, detrás de Lider) y $2.5M vencidos (el segundo vencido, también detrás de Lider).", "el marcador dentro de un paréntesis no toma la métrica de afuera; «sin capturar» es la no capturada");
pasa("Sodimac es el cuarto cliente en venta ($8.2M), lejos de los tres grandes.", "«lejos de los tres grandes» no acota el ordinal");
pasa("Falabella va segundo (mayor $ en contribución no capturada, $1.6M, pero menos urgente en cobranza: 8 días de atraso).", "«va segundo (» sin métrica atada no se juzga (candado de la familia B)");
pasa("BOS-SANDER es el segundo SKU en capital frenado ($11K), entre LG-DRYER8KG ($14K) y MAK-COMP-AIR ($8K).", "«frenado» son los 3 frenados (BOS-SANDER es 2.º), no los 5 inmovilizados");
pasa("Las tres cuentas con más brecha por precio y costo son Falabella ($1.4M), Lider ($1.4M) y Jumbo ($1.0M).", "«brecha por precio y costo» no es la brecha de margen");

H("10 · LA RELACIÓN CON LA REFERENCIA: el sujeto de la cláusula y la negación");
pasa("Easy es la cuenta con la carga comercial más alta (5.5%), pero está sobre el benchmark (32%); Lider, con 4.2% de carga, es la que más lejos queda del benchmark (8.6 pp).", "la cuenta es el sujeto de la cláusula del «sobre» (Easy), no la primera del ledger (Lider)");
pasa("A diferencia de Falabella, La Polar está sobre el benchmark (34%).", "la comparada no es el sujeto");
pasa("Hites está sobre el benchmark (33%), no así Falabella (22%).");
pasa("Easy (32%), Unimarc (32.5%) e Hites (33%) están sobre el benchmark; Falabella (22%) y Lider (21.5%), bajo.", "la lista coordinada: todas sobre");
pasa("Falabella no está sobre el benchmark: margina 22%.", "la negación");
pasa("Falabella, lejos de estar sobre el benchmark, margina 22%.");
pasa("Falabella no supera el benchmark: margina 22%.");
pasa("Ninguna de las tres grandes supera el benchmark: Falabella 22%, Lider 21.5%, Jumbo 24%.");
pasa("Easy está sobre el benchmark con 32%; Sodimac, con 23.5%, está bajo.");
pasa("Lider margina 21.5%; Easy, 32%, sobre el benchmark.");
arde("Falabella margina 22% y está sobre el benchmark.", REF, "…y la afirmación falsa sigue ardiendo");
arde("Lider supera el benchmark con 21.5%.", REF);
arde("Falabella cumple el benchmark (22%).", REF);
arde("Falabella margina 22%. Está sobre el benchmark.", REF, "la oración sin nadie nombrado habla de la anterior");
pasa("Easy margina 32%. Está sobre el benchmark.");
pasa("Falabella solo la supera en contribución no capturada ($1.6M contra $1.5M).", "el pronombre de objeto: dos cuentas, no la referencia");

H("11 · LA RELACIÓN EN PALABRAS, EN LAS DOS DIRECCIONES");
pasa("Falabella debe casi la mitad que Lider ($2.5M contra $4.6M).", "«casi la mitad» es «casi el doble» al revés (fp-comparaciones 8)");
pasa("El vencido de Falabella es casi la mitad del de Lider ($2.5M contra $4.6M).");
pasa("Lider debe casi el doble que Falabella ($4.6M contra $2.5M).");
pasa("Lider debe $9.8M, de los cuales casi la mitad ($4.6M) ya venció.", "…y la lectura literal (47 %) también cierra");
arde("En Lider más de la mitad del saldo pendiente ya está vencido ($4.6M de $9.8M).", REL, "47 % no es «más de la mitad» en ninguna de las dos lecturas");

H("12 · LOS RANKINGS NUEVOS: SKU por venta y contribución, bodega por capital, frenado ≠ inmovilizado");
arde("LG-WASH11KG es el SKU de mayor venta ($12.4M).", SUP, "SAM-TV55 $13.3M");
pasa("SAM-TV55 es el SKU de mayor venta ($13.3M).");
arde("SAM-TV55 es el SKU con más contribución ($2.5M).", SUP, "PHI-SHAVER9 $3.4M");
pasa("PHI-SHAVER9 es el SKU con más contribución ($3.4M).");
arde("Valparaíso es la bodega con más capital ($39K).", SUP, "Santiago $64K");
pasa("Santiago es la bodega con más capital ($64K).");
pasa("Valparaíso es la bodega con más capital frenado ($25K).");
pasa("LG-DRYER8KG es el que más capital frenado tiene ($14K).");

console.log(`\n── _orden_en_todas_sus_formas_gate: ${PASS} PASS · ${FAIL} FAIL (de ${PASS + FAIL}) ──`);
process.exit(FAIL ? 1 : 0);
