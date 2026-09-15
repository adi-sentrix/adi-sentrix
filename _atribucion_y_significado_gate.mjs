/* === _atribucion_y_significado_gate.mjs · ATRIBUCIÓN Y SIGNIFICADO: dueño + significado + signo, verificados por ESTRUCTURA (owner 2026-09-14) ═══
 * La familia del conjunto adversarial (fase 3): «la verdad de una cifra es dueño + significado + signo», resuelta por el lector de
 * cláusula (`src/adi/oracle/lectorDeClausula.js`) y VERIFICADA contra la boleta y la proyección, nunca absuelta por una heurística.
 * Antes: 25.2 % de falsos positivos y 57.5 % de falsos negativos; la ventana de 90 caracteres liberaba «Lider y Sodimac arrastran $1.9M y
 * $4.6M vencidos» (invertido) y condenaba «Falabella lo supera ($4.3M contra $4.2M)» (el pronombre de objeto). Este gate es el candado de
 * cada regla, con frases del conjunto EN LAS DOS DIRECCIONES (la verdadera pasa · la falsa arde), sobre el mismo contexto del bucle:
 *   1 · PERMUTACIÓN entre entidades nombradas: la coordinación «A y B … (x y y)» se verifica por orden; el par «x contra y» es (sujeto,
 *       comparada / objeto); la aposición «Nombre (cifra)» manda; el sujeto plural con UNA cifra exige que todos sean dueños.
 *   2 · ANÁFORA y POSESIVO: «su», «este último», «la segunda», «ambas», el elidido sostenido — resueltos y verificados; sin antecedente, sin dueño.
 *   3 · COBRANZA y SIGNIFICADO: vencido, pendiente, abonado, recuperado, días de atraso, capital frenado, «% del capital» como participación.
 *   4 · DIRECCIÓN y SIGNO: la palabra y el signo contra la variación publicada; un nivel no se mueve; la evolución dicha exige serie.
 *   5 · el CANON «.0»: misma cifra = mismo canon, en un solo lugar.
 *   6 · los falsos positivos de estructura: la negación de estado, la cota en palabras, el lado negado del «sino», el ítem de lista.
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
import { leerClausula } from "./src/adi/oracle/lectorDeClausula.js";

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
    for (const x of vetosDeRegistro(t, { pregunta, figs: rp.ledger.figs, sitio: "cierre" })) if (!LEYES.has(x.regla)) kinds.push(x.regla);
    return { kinds, detalle: (v.violations || []).map((x) => `${x.kind}: ${String(x.detail).slice(0, 110)}`).join(" ‖ ") };
  };
};
const J = { P1: juezDe(A.preguntas.P1), P2: juezDe(A.preguntas.P2) };
const pasa = (frase, ctx = "P1", m = "") => { const r = J[ctx](frase); ok(r.kinds.length === 0, `pasa · «${frase.slice(0, 96)}»${m ? " — " + m : ""}`, r.detalle); };
const arde = (frase, re, ctx = "P1", m = "") => { const r = J[ctx](frase); ok(r.kinds.some((k) => re.test(k)), `arde · «${frase.slice(0, 96)}»${m ? " — " + m : ""} → ${re}`, r.kinds.join(", ") || "sin veto"); };
/* «no arde POR ESTA FAMILIA»: la frase puede caer por un chequeo de otra familia (un superlativo, un grupo) — acá solo se candado lo mío */
const noArde = (frase, re, ctx = "P1", m = "") => { const r = J[ctx](frase); ok(!r.kinds.some((k) => re.test(k)), `no arde por ${re} · «${frase.slice(0, 96)}»${m ? " — " + m : ""}`, r.detalle); };

H("1 · PERMUTACIÓN ENTRE ENTIDADES NOMBRADAS: la coordinación y el par «contra» se verifican por orden, no se absuelven");
arde("Lider y Sodimac arrastran $1.9M y $4.6M vencidos, en ese orden.", /cifra-de-boleta-sin-dueno/, "P1", "invertido: Lider $4.6M, Sodimac $1.9M — antes la ventana de 90 lo liberaba");
pasa("Sodimac $1.9M y Falabella $2.5M vencidos.", "P1", "el par bien asignado, con la cifra pegada al nombre");
pasa("Lider vende $17.8M y Falabella $19.4M.");
arde("Falabella y Jumbo tienen 8 días de atraso.", /cifra-de-boleta-sin-dueno/, "P1", "sujeto plural con UNA cifra: Jumbo no tiene atraso");
arde("Lider y Jumbo venden $17.8M cada uno.", /cifra-de-boleta-sin-dueno/);
pasa("Falabella, Tottus y Paris tienen 8 días de atraso cada una.", "P1", "los tres son dueños de los 8 días (la proyección lo sabe)");
pasa("Jumbo es el cliente con más unidades vendidas (1.194), pero no el de más contribución: Falabella lo supera ($4.3M contra $4.2M).", "P1", "el pronombre de objeto: (Falabella, Jumbo)");
pasa("Lider supera a Falabella en brecha (8.6 pp contra 8.1 pp), pero Falabella la supera en contribución no capturada ($1.6M contra $1.5M).");
pasa("Falabella vende más que Lider ($19.4M contra $17.8M) y que Jumbo ($19.4M contra $17.3M).", "P1", "dos comparadas, cada par con la suya");
pasa("Lider pesa más que Falabella en cobranza: $4.6M vencidos (contra $2.5M) y 45% recuperado (contra 57.7%).", "P1", "el paréntesis «(contra x)» es la cifra de la comparada");
pasa("Frente a Lider, Falabella tiene menos vencido ($2.5M contra $4.6M) y mejor recuperación (57.7% contra 45%).", "P1", "«frente a X» es la comparada, no el sujeto");
pasa("Mercado Libre es el caso opuesto a Lider: su carga es la menor de la cartera (1.8%).", "P1", "el marcador de contraste es la comparada");
pasa("Falabella recupera más: 57.7% contra 45% de Lider.", "P1", "la aposición «cifra de Nombre» manda");
pasa("Lider está peor que Falabella en todo lo que importa en cobranza —monto vencido, días de atraso y recuperación—: $4.6M contra $2.5M, 269 días contra 8, 45% contra 57.7%.", "P1", "la comparación larga: el sujeto de la cláusula manda sin ventana");

H("2 · ANÁFORA Y POSESIVO: resueltos y verificados; sin antecedente, sin dueño");
arde("Su carga comercial es 5.4%.", /cifra-de-boleta-sin-dueno/, "P1", "posesivo sin nadie nombrado: cifra sin dueño");
pasa("El saldo vencido llega a $4.6M.", "P1", "la cifra suelta sin posesivo sigue pasando (control del cazador)");
arde("Jumbo creció fuerte. Su carga comercial es 5.4%.", /cifra-de-boleta-sin-dueno/, "P1", "«su» = Jumbo; 5.4% es de Sodimac");
arde("Falabella vende $19.4M y Lider apenas menos; su saldo vencido llega a $2.5M, el más alto de la cartera.", /cifra-de-boleta-sin-dueno/, "P1", "«su» = Lider (último sujeto); $2.5M es Falabella");
arde("Lider crece 14.9%; Jumbo también. Este último tiene $4.6M vencidos.", /cifra-de-boleta-sin-dueno/, "P1", "«este último» = Jumbo, sin vencido");
arde("Falabella y Lider crecen. La segunda tiene 8 días de atraso.", /cifra-de-boleta-sin-dueno/, "P1", "«la segunda» = Lider (269 d)");
arde("Falabella y Lider crecen; ambas tienen 8 días de atraso.", /cifra-de-boleta-sin-dueno/, "P1", "«ambas»: la cifra tiene que ser de las dos");
pasa("Falabella y Lider: la primera vende más ($19.4M contra $17.8M), la segunda debe más vencido ($4.6M contra $2.5M).", "P1", "los ordinales resueltos contra la lista");
pasa("Lider concentra el riesgo. Tiene el peor margen (21.5%). Tiene el mayor vencido ($4.6M). Lleva 269 días de atraso. Y aun así vende menos que Falabella ($17.8M contra $19.4M).", "P1", "el sujeto elidido sostenido cuatro oraciones");
pasa("Sodimac: $5.3M pendientes y $1.9M vencidos. Ese cliente recupera solo 35%, el peor porcentaje de la cartera.", "P1", "«ese cliente» es el antecedente");
pasa("Easy (270 días), Lider (269) y Sodimac (251) son las tres con más atraso; las demás con vencido están en 8 días.", "P1", "«las demás» es el complemento de la lista");
pasa("Falabella vende $19.4M y Lider $17.8M; sus márgenes son 22% y 21.5%.", "P1", "el posesivo plural reparte por orden");
{ const t = "Jumbo es el cliente con más unidades vendidas (1.194), pero no el de más contribución: Falabella lo supera ($4.3M contra $4.2M).";
  const L = leerClausula(t, t.indexOf("$4.2M"), { nombres: ["Jumbo", "Falabella", "Lider"] });
  ok(L.pronombreObjeto && L.sujeto && L.sujeto.nombre === "falabella", "el lector lee el pronombre de objeto y el sujeto («Falabella lo supera»)", JSON.stringify({ pron: L.pronombreObjeto, sujeto: L.sujeto }));
  const t2 = "Lider es el caso más claro. Margina 21.5%. Debe $4.6M vencidos. Falabella, en cambio, deja más contribución ($4.3M contra $3.8M).";
  const L2 = leerClausula(t2, t2.indexOf("$3.8M"), { nombres: ["Jumbo", "Falabella", "Lider"] });
  ok(L2.referente && L2.referente.nombre === "lider" && L2.referente.saltadas === 2, "el referente salta las oraciones sin entidad (el elidido sostenido)", JSON.stringify(L2.referente)); }

H("3 · COBRANZA Y SIGNIFICADO: el vocabulario declarado desde los rótulos de la boleta");
arde("Lider vendió $4.6M en el período.", /metrica-mal-atribuida/, "P1", "$4.6M es su vencido");
arde("Lider tiene un margen de 45%.", /metrica-mal-atribuida/, "P1", "45% es lo recuperado");
arde("Falabella tiene $19.4M vencidos.", /metrica-mal-atribuida/, "P1", "$19.4M es su venta");
arde("Lider tiene 269 días de inventario.", /metrica-mal-atribuida/, "P1", "269 son días de atraso");
arde("Sodimac ya cobró $5.3M.", /metrica-mal-atribuida/, "P1", "$5.3M es el saldo pendiente («cobró» tras vocal acentuada)");
arde("Lider inmoviliza $4.6M.", /metrica-mal-atribuida/, "P1", "vencido narrado como capital");
arde("Falabella deja $2.5M de contribución.", /metrica-mal-atribuida/, "P1", "cifra + DUEÑO + significado: para Falabella $2.5M es vencido, no la contribución de SAM-TV55");
pasa("SAM-TV55 deja $2.5M de contribución.", "P1", "…y para SAM-TV55 sí lo es");
arde("PHI-SHAVER9 vende $3.4M.", /metrica-mal-atribuida/, "P1", "el 9 del nombre no es un conteo que tome la mención");
arde("El capital en inventario del negocio es $33K.", /metrica-mal-atribuida/, "P1", "el calificador «frenado» del rótulo tiene que decirse");
pasa("Lo que sí está medido es el capital detenido, $33K.", "P1", "«detenido» es el frenado en la prosa de la casa (el corpus de aceptación)");
pasa("Valparaíso concentra el 75.0% del capital frenado.", "P1", "«% del capital frenado» es una participación, y la larga se lleva a la corta");
pasa("Los grandes son el 49% de la contribución.", "P1", "un % rotulado con una métrica de dinero es su participación");
arde("Los grandes son el 22.5% de la contribución.", /metrica-mal-atribuida/, "P1", "22.5% es el margen de los grandes");
pasa("Ripley cae en venta (-8.2%).", "P1", "«cae en venta» es la variación de la venta");
pasa("Ripley cae en venta (-8.2%).", "P2", "…también sin salesRead: la proyección publica la variación por cuenta");
pasa("Lider es peor que Falabella en brecha al benchmark, en saldo vencido, en días de atraso y en porcentaje recuperado (8.6 pp contra 8.1 pp, $4.6M contra $2.5M, 269 días contra 8, 45% contra 57.7%).", "P1", "el ítem de lista no se contamina con la métrica del vecino");
pasa("El capital frenado no está donde más se vende sino en LG-DRYER8KG ($14K).", "P1", "el lado negado del «sino» no describe la cifra afirmada");

H("4 · DIRECCIÓN Y SIGNO: la palabra y el signo contra la variación publicada");
arde("Lider cae 14.9% contra el año anterior.", /direccion-contradicha/, "P1", "Lider crece +14.9%");
arde("Jumbo retrocede $1.9M.", /direccion-contradicha/, "P1", "+$1.9M");
arde("Ripley suma $422K más que el año pasado.", /direccion-contradicha/, "P1", "-$422K");
arde("Cayendo: Lider (-$2.3M).", /direccion-contradicha/, "P1", "el signo invertido");
arde("Ripley: +$422K.", /direccion-contradicha/, "P2", "el signo invertido, sin salesRead (la proyección)");
arde("Ripley: $422K.", /direccion-contradicha/, "P1", "la copia sin signo de una caída");
pasa("Ripley movió $422K contra el año anterior.", "P1", "el verbo neutro no afirma dirección (control del cazador)");
pasa("Ripley pierde $422K contra el año anterior.", "P1", "la dirección correcta");
pasa("Lider crece en venta (+$2.3M, +14.9%).", "P2");
arde("Falabella sube 22%.", /direccion-contradicha|variacion-sin-serie/, "P1", "un nivel (su margen) narrado como movimiento");
arde("Ripley cae 25.0%.", /direccion-contradicha|variacion-sin-serie/, "P1", "su margen 25.0% no es una caída");
arde("El margen de Lider cayó a 21.5%.", /variacion-sin-serie/, "P1", "no hay serie de margen");
arde("El margen de Lider viene cayendo.", /variacion-sin-serie/, "P1", "la evolución dicha sin serie");
arde("La carga de Sodimac subió a 5.4%.", /variacion-sin-serie|direccion-contradicha/);
arde("El vencido de Lider creció 14.9% en el año.", /variacion-sin-serie/, "P1", "la variación de la venta narrada como del vencido");
pasa("Tottus y Mercado Libre (12.3%) caen sin que la carga ni el volumen lo expliquen.", "P1", "«caen» sin ancla temporal es la prosa de la casa para «bajo el benchmark»");
pasa("Los tres motores más grandes —Falabella, Lider y Jumbo— están todos bajo el benchmark (22%, 21.5% y 24%).", "P1", "la lista del inciso reparte por orden");
pasa("Mercado Libre es la cuenta que más crece en porcentaje (+25.3%), aunque Lider aporta más dólares nuevos (+$2.3M).", "P1");

H("5 · EL CANON «.0»: misma cifra = mismo canon");
pasa("Ripley tiene margen 25%.", "P1", "publicado «25.0%»: antes ardía como cifra de Antofagasta");
pasa("El sobrestock es el 7% del capital en inventario ($10K).", "P1", "publicado «7.0%»");
pasa("Margen por cuenta bajo el benchmark: Lider 21.5%, Falabella 22.0%, Sodimac 23.5%, Jumbo 24.0%, Ripley 25.0%, Paris 26.5%, Tottus 28.0% y Mercado Libre 29.0%.", "P1");

H("6 · LOS FALSOS POSITIVOS DE ESTRUCTURA");
pasa("SAM-TV55 no está entre los frenados, aunque tenga 58 días de cobertura.", "P1", "la negación de estado");
pasa("Ni SAM-REF500L ni LG-WASH11KG están frenados.", "P1");
pasa("PHI-SHAVER9 está fuera del grupo frenado; su cobertura es de 15 días.", "P1");
arde("SAM-TV55 está frenado.", /estado-no-declarado/, "P1", "…y la afirmación sigue ardiendo");
pasa("Cuatro clientes están por debajo de 25% de margen: Lider, Falabella, Sodimac y Jumbo.", "P1", "la cota en palabras no reclama dueño");
pasa("Los tres frenados rotan menos de 2x: LG-DRYER8KG 1.0x, BOS-SANDER 1.6x y MAK-COMP-AIR 0.8x.", "P1");
pasa("Con $4.6M vencidos, Lider es la cuenta más expuesta en cobranza.", "P1", "el sujeto que viene detrás");
pasa("El 75% del capital frenado está en Valparaíso; el 25%, en Antofagasta.", "P1");
arde("El saldo vencido total es $4.6M.", /cifra-de-boleta-sin-dueno/, "P1", "la marca de total le da a la cartera la cifra de Lider");
arde("El inventario del negocio vale $64K.", /cifra-de-boleta-sin-dueno/, "P1", "$64K es Santiago");
pasa("Lider tiene la brecha más grande de la cartera (8.6 pp, peor que los 8.1 pp de Falabella) y también el vencido más grande ($4.6M contra $2.5M).", "P1");
pasa("Lider tiene el markup más bajo de la cartera (37.2%); le siguen Jumbo (38.3%) y Falabella (39.1%).", "P1", "«bajo» no es un verbo de dirección");

H("7 · LA SEGUNDA TANDA (owner 2026-09-14): unidades vendidas vs en stock · la estructura que faltaba · la quinta fuente verificada");
/* unidades: parseFigures no las veía; ahora tienen dueño y significado (boleta y proyección) */
arde("Jumbo vendió 140 unidades.", /cifra-de-boleta-sin-dueno|metrica-mal-atribuida/, "P1", "140 son unidades en stock de PHI-SHAVER9/PHI-IRON-PRO");
arde("PHI-SHAVER9 vendió 140 unidades en el año.", /metrica-mal-atribuida/, "P1", "sus 140 son stock, no vendidas");
arde("Falabella tiene 1.042 unidades en stock.", /metrica-mal-atribuida/, "P1", "1.042 son sus unidades VENDIDAS");
arde("Falabella tiene 1.042 unidades en stock.", /metrica-mal-atribuida/, "P2", "…también sin salesRead: la proyección declara el concepto");
arde("Lider tiene 894 unidades en inventario.", /metrica-mal-atribuida/, "P1");
arde("LG-DRYER8KG vendió 42 unidades.", /metrica-mal-atribuida/, "P1", "42 son unidades en stock");
arde("Lider y Jumbo mueven 1.194 unidades.", /cifra-de-boleta-sin-dueno/, "P1", "sujeto plural con UNA cifra: solo Jumbo vende 1.194");
pasa("Jumbo vendió 1.194 unidades.", "P1");
pasa("Falabella mueve 1.042 unidades.", "P1", "«unidades» a secas describe a las vendidas");
pasa("PHI-SHAVER9 tiene 140 unidades en stock.", "P1");
pasa("Jumbo es el cliente con más unidades vendidas (1.194).", "P1");
/* la estructura que faltaba */
pasa("Los cinco SKU que más contribuyen —PHI-SHAVER9 ($3.4M), LG-WASH11KG ($2.9M), PHI-HAIR-PRO ($2.8M), SAM-TV55 ($2.5M) y SAM-REF500L ($2.4M)—: ninguno tiene capital frenado.", "P2", "un paréntesis dentro de un inciso: el sujeto de $3.4M es PHI-SHAVER9 (la proyección sabe su contribución)");
arde("Easy contribuye $3.4M.", /metrica-mal-atribuida|cifra-de-boleta-sin-dueno/, "P1", "$3.4M de Easy es su venta");
noArde("Sodimac merece mención aparte: no es de las más grandes ($8.2M de venta, cuarta de la cartera), pero tiene la peor recuperación (35%), 251 días de atraso, $1.9M vencidos y la segunda carga más alta (5.4%, solo detrás de Easy).", /cifra-de-boleta-sin-dueno|metrica-mal-atribuida/, "P1", "«la segunda carga más alta» no es un ordinal anafórico: el sujeto sigue siendo Sodimac (el superlativo del ordinal lo juzga otra familia)");
pasa("El resto de las cuentas con vencido está en 8 días de atraso.", "P1", "«el resto» sin lista a la vista no es anáfora de nadie");
pasa("La venta de Ripley cae -8.2% y la de La Polar -12.5%.", "P1", "«y la de La Polar» abre otro ítem: no es aposición del -8.2%");
arde("La venta de Ripley cae -12.5% y la de La Polar -8.2%.", /cifra-de-boleta-sin-dueno/, "P1", "…y el invertido arde");
arde("La venta de Ripley cae -12.5% y la de La Polar -8.2%.", /cifra-de-dato-sin-dueno/, "P2", "sin salesRead, la quinta fuente también VERIFICA por estructura (los dos dueños estaban nombrados)");
pasa("La venta de Ripley cae -8.2% y la de La Polar -12.5%.", "P2");
pasa("Jumbo es el que más unidades vende (1.194), pero en contribución Falabella ($4.3M) lo supera ($4.2M).", "P1", "el pronombre de objeto con la cifra sola: del sujeto o del objeto, las dos lecturas");
arde("Jumbo es el que más unidades vende (1.194), pero en contribución Falabella ($4.3M) lo supera ($3.8M).", /cifra-de-boleta-sin-dueno/, "P1", "$3.8M no es de ninguno de los dos");
pasa("Crecen: Lider +$2.3M (+14.9%), Jumbo +$1.9M (+12.2%), Falabella +$1.5M (+8.2%) y Mercado Libre +$1.1M (+25.3%).", "P1", "la aposición admite el signo pegado a la cifra");
arde("Crecen: Lider +$1.1M (+14.9%), Jumbo +$1.9M (+12.2%), Falabella +$1.5M (+8.2%) y Mercado Libre +$2.3M (+25.3%).", /cifra-de-boleta-sin-dueno/, "P1", "…y la permutación arde");
pasa("SAM-REF500L queda fuera de los frenados: rota en 17 días.", "P1", "una mención negada («fuera de los frenados») no describe a la cifra");
pasa("Del capital frenado, el 75% está en Valparaíso y el 25% en Antofagasta.", "P1", "el partitivo delante del porcentaje es participación");
arde("Del capital frenado, el 75% está en Antofagasta y el 25% en Valparaíso.", /cifra-de-boleta-sin-dueno/, "P1", "…y la permutación arde");
pasa("La brecha está en Lider ($1.5M sin capturar), el capital frenado en LG-DRYER8KG ($14K).", "P1", "la contribución no capturada es la brecha en dinero");
arde("La contribución no capturada de Lider es $4.6M.", /metrica-mal-atribuida/, "P1", "$4.6M es su vencido");
pasa("Mercado Libre crece más rápido que Lider (+25.3% contra +14.9%), pero aporta menos dólares nuevos (+$1.1M contra +$2.3M).", "P2", "el par «contra» en el binding: la segunda cifra es de la comparada");
arde("Mercado Libre vende más que Lider ($1.1M contra $2.3M).", /metrica-mal-atribuida/, "P1", "las variaciones narradas como venta");
pasa("Los tres grandes (Falabella, Lider y Jumbo) tienen los tres márgenes más bajos si dejo fuera a Sodimac; con Sodimac adentro, son cuatro los que están por debajo de 25%.", "P1", "la cota en palabras no reclama dueño (tampoco por cercanía)");
arde("Sodimac margina 25%.", /cifra-de-boleta-sin-dueno|entidad-mal-atribuida/, "P1", "…y la atribución directa sigue ardiendo");

H("8 · LO QUE LA SUITE ENSEÑÓ (owner 2026-09-14): los textos reales del producto que la estructura tenía que seguir leyendo bien");
pasa("Falabella es la cuenta más grande. Ella vende $19.4M.", "P1", "«ella» es el antecedente");
arde("Falabella es la cuenta más grande. Ella vende $17.8M.", /cifra-de-boleta-sin-dueno/, "P1", "…y verificado: $17.8M es Lider");
pasa("Tus tres principales clientes bajo el benchmark de 30.1% son Lider con 21.5%, Falabella con 22.0% y Sodimac con 23.5%.", "P1", "«Nombre con cifra, Nombre con cifra»: tres ítems, ninguna aposición cruzada (constitución P6)");
pasa("Si cae en Falabella o Lider (los de mayor peso y menor margen, 22.0% y 21.5%), el negocio crece pero se aleja más del benchmark.", "P1", "la disyunción también coordina y reparte por orden (constitución P4)");
arde("Si cae en Falabella o Lider (los de mayor peso y menor margen, 21.5% y 22.0%), el negocio crece pero se aleja más del benchmark.", /cifra-de-boleta-sin-dueno/, "P1", "…y la permutación arde");
pasa("Lider vende $17.8M contra $19.4M de Falabella, y aporta $3.8M contra $4.3M.", "P1", "la comparada puede venir detrás de su cifra («contra $19.4M de Falabella»): el sujeto de $3.8M sigue siendo Lider (playbook de contradicción)");
pasa("Lider deja $3.8M, mientras Jumbo deja $4.2M. La razón está en el margen: 24.0% contra 21.5%.", "P1", "el par sin sujeto en su oración se verifica contra las entidades de la anterior, en cualquier orden (cuadro explicado)");
pasa("LG-DRYER8KG concentra el 41% del capital frenado y está en Valparaíso, junto con BOS-SANDER (75% del frenado total en esa bodega).", "P1", "«en esa bodega» remite a Valparaíso, no a BOS-SANDER (reparación real de la prueba 1)");
arde("LG-DRYER8KG concentra el 41% del capital frenado y está en Antofagasta, junto con BOS-SANDER (75% del frenado total en esa bodega).", /cifra-de-boleta-sin-dueno/, "P1", "…y con la bodega equivocada, arde");
pasa("Los SKU frenados son MAK-COMP-AIR, LG-DRYER8KG y BOS-SANDER: son los que el dato marca en estado 90d o 120d.", "P1", "«90d o 120d» es una alternativa entre dos valores, no un par repartido (roce de universos)");
noArde("PHI-SHAVER9 es el mejor caso — lidera contribución ($3.4M) con capital bajo ($11K) y cobertura muy corta (15 días), igual que PHI-HAIR-PRO (contribución $2.8M, capital $6K, 19 días): ambos sostienen margen sin pedir capital.", /cifra-de-boleta-sin-dueno|metrica-mal-atribuida/, "P1", "el paréntesis pegado a la comparada es SU ficha entera (borrador real del cruce; el cruce de universos es de la casa)");
pasa("Sodimac es la de peor recuperación entre las seis con vencido (35%), seguida de Easy (40%) y Lider (45%).", "P1", "«recuperación» con un % es la cobranza");
arde("Sodimac tiene 35% de margen.", /metrica-mal-atribuida/, "P1", "…y el 35% narrado como margen arde");
pasa("Ocho clientes están bajo el benchmark de 30.1%; de ellos, cinco tienen más de 4 pp de brecha.", "P1", "una cota en puntos no cita a nadie");
arde("La carga de Falabella es 4.5 pp.", /metrica-mal-atribuida/, "P1", "un nivel narrado en puntos porcentuales");
arde("El margen de Lider es 21.5 pp.", /metrica-mal-atribuida/, "P1");
pasa("La carga de Falabella es 4.5%.", "P1");
arde("Falabella tiene 4.5 pp de brecha al benchmark.", /metrica-mal-atribuida/, "P1", "4.5 es su carga, no su brecha (8.1 pp)");

console.log(`\n── _atribucion_y_significado_gate: ${PASS} PASS · ${FAIL} FAIL (de ${PASS + FAIL}) ──`);
process.exit(FAIL ? 1 : 0);
