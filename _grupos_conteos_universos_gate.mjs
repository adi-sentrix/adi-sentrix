/* === _grupos_conteos_universos_gate.mjs · GRUPOS, CONTEOS, UNIVERSOS E INVENTOS (owner 2026-09-14) ═══════════════════════════════
 * La familia del conjunto adversarial (fase 3, v2.31): «una cifra de grupo es del grupo completo; un conteo se compara con lo que la boleta
 * permite contar; una cifra que no está en la boleta solo vale por una cuenta MOSTRADA». Este gate es el candado de cada regla, con frases
 * del conjunto EN LAS DOS DIRECCIONES (la verdadera pasa · la falsa arde), sobre el mismo contexto del bucle (P1 = el encargo compuesto de
 * producción, P2 = la lectura comercial), sin red.
 *   1 · LA LOTERÍA DE LOS DUEÑOS DICHOS (`_isCalc` / `_isCalc2` / `_poolCatalogo` en guardC, pp en calculoCatalogo): dos cifras se suman o se
 *       restan solo si son de la MISMA métrica con sus dueños dichos, o si la cuenta está MOSTRADA; la resta de nivel 2 es solo referencia − nivel.
 *   2 · LA CIFRA DE GRUPO ES DEL GRUPO COMPLETO (`_grupoMalRepartido`): la lista antes o después, el pronombre, el conector, la descripción, la
 *       viñeta en dos líneas, el papel cambiado y el desglose que no cierra; un subconjunto de la descripción no roba la cifra.
 *   3 · EL CONTEO SE CUENTA (`_conteoDeListaFalso`): «N de M», «De M, N», «N cuentas», numerales en palabras, «media docena», «la mayoría»,
 *       negación, M parcial, otro eje (bodegas), partición, pertenencia de «los tres», simulación; el conteo verificado queda autorizado.
 *   4 · UNIVERSOS Y SUBTOTALES (`subtotal-de-otro-universo` en contratoAgente): «de los $X, $Y» solo dentro del mismo universo; un subtotal
 *       cabe en su subtotal mayor del mismo concepto; «los $X del total» es el total; el control verdadero no arde.
 *   5 · LAS FRACCIONES EN PALABRAS (`relacionEnPalabrasNoCierra` en atributosYRelaciones): «un tercio», «dos tercios», «más de la mitad»,
 *       «casi el doble» contra el dato o contra las cifras que la frase trae; el numerador dicho junto a la fracción manda.
 *   6 · LOS INVENTOS: el % plausible, el monto cerca del real, la participación recomputada, el promedio no publicado, la unidad (K/M, %/pp).
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
  const ctx = { ledger: { figs: rp.ledger.figs }, results: rp.results, trace: null, question: pregunta, datoProyectado: cifrasDelDato(ESCENARIO_INICIAL), entidadesDelTenant: _ejes(["cliente", "sku", "marca"]), duenosDelTenant: _ejes(["cliente", "sku"]), ejesDelTenant: _porEje(), contentScope: "full", tablePolicy: "auto" };
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
/* «no arde POR ESTA FAMILIA»: la frase puede caer por un chequeo de otra familia — acá solo se candado lo mío */
const noArde = (frase, re, ctx = "P1", m = "") => { const r = J[ctx](frase); ok(!r.kinds.some((k) => re.test(k)), `no arde por ${re} · «${frase.slice(0, 96)}»${m ? " — " + m : ""}`, r.detalle); };
const GRUPO = /cifra-de-grupo-mal-repartida/, CONTEO = /conteo-de-lista-falso/, CIFRA = /cifra-no-autorizada/, UNIVERSO = /subtotal-de-otro-universo/, RELACION = /relacion-en-palabras-no-cierra/;
/* el INVENTO arde por la vía que lo delata: la cifra no existe (cifra-no-autorizada), existe con otro dueño (cifra-de-dato-sin-dueno / entidad-mal-atribuida) o con otra métrica */
const INVENTO = /cifra-no-autorizada|cifra-de-dato-sin-dueno|cifra-de-boleta-sin-dueno|entidad-mal-atribuida|metrica-mal-atribuida/;

H("1 · LA LOTERÍA DE LOS DUEÑOS DICHOS: dos cifras se suman solo con la misma métrica y los dueños dichos, o con la cuenta mostrada");
arde("Lider y Falabella concentran $7.4M del vencido.", CIFRA, "P1", "4.6 + 2.5 = 7.1: la suma inventada no se autoriza por nombrar a los dueños");
pasa("Lider, Sodimac y Easy concentran $7.6M del vencido.", "P1", "4.6 + 1.9 + 1.1 = 7.6: la suma de la MISMA métrica con los tres dueños dichos");
arde("Falabella ($1.6M) y Lider ($1.5M) dejan $3.3M sin capturar.", CIFRA, "P1", "los operandos a la vista suman 3.1, no 3.3");
pasa("Falabella y Lider suman $3.1M sin capturar ($1.6M + $1.5M).", "P1", "la suma MOSTRADA que cierra");
arde("Lider creció $2.3M y Jumbo $1.9M: $4.5M entre los dos.", INVENTO, "P1", "2.3 + 1.9 = 4.2 — antes lo absolvía (vencido − YoY de Lider) + (contribución − YoY de Jumbo), la lotería con otro nombre");
arde("El vencido de Lider es el 45.7% del total.", CIFRA, "P1", "4.6 / 12.6 = 36.5 %; 45.7 era 37.2 (markup) + 8.6 (brecha): «Brecha al benchmark» no es una referencia");
arde("Falabella y Lider pesan 33.4% de la venta.", CIFRA, "P1", "19.4 + 17.9 = 37.3");
arde("Entre Falabella y Lider, el markup promedio es 41.8%.", CIFRA, "P1", "(39.1 + 37.2) / 2 = 38.2");
pasa("Lider: $4.6M de los $9.8M pendientes — el 47% — ya vencieron.", "P1", "el % derivado con los operandos a la vista, bien calculado");
arde("Lider: $4.6M de los $9.8M pendientes — el 52% — ya vencieron.", CIFRA, "P1", "el mismo con la cuenta mal hecha (es 47 %)");
arde("Entre Sodimac y Tottus venden $13.5M.", CIFRA, "P1", "8.2 + 6.8 = 15.0");
arde("Lider crece 15.7% contra el año anterior.", CIFRA, "P1", "una variación inventada cerca de la real (14.9 %)");
pasa("Ripley cae $422K contra el año anterior.", "P1", "la magnitud sin signo de una variación negativa publicada, con la dirección dicha en la cláusula");
pasa("Ocho de trece clientes están bajo el benchmark, y concentran el 86.1% de la venta (73.8% + 12.3%).", "P2", "la suma de dos cifras de grupo, MOSTRADA (corrida viva del gerente, corregida)");
arde("Ocho de trece clientes están bajo el benchmark, y concentran el 86.1% de la venta.", CIFRA, "P2", "…y sin mostrarla no vale: 86.1 no está en la boleta");
arde("Entre el vencido de Lider ($4.6M) y el capital frenado ($33K), hay $4.6M inmovilizados.", UNIVERSO, "P1", "la suma en palabras de dos universos que no reconcilian (forma 5 del contrato)");
pasa("Entre el vencido de Lider ($4.6M) y el de Falabella ($2.5M), hay $7.1M vencidos.", "P1", "la misma forma dentro de un universo, con la cuenta que cierra");

H("2 · LA CIFRA DE GRUPO ES DEL GRUPO COMPLETO: la lista antes o después, el pronombre, la descripción y el desglose");
arde("Falabella, Lider, Jumbo y Sodimac están bajo el benchmark y con carga sobre el nivel declarado, y explican en conjunto el 73.8% de la venta.", GRUPO, "P1", "73.8 % es de SEIS (con Paris y Ripley): el puente largo no rompe el vínculo");
arde("Falabella, Lider, Jumbo y Sodimac tienen carga sobre el 3.5% declarado y markup promedio 41.4% — lejos del 57.3% de los sanos.", GRUPO, "P1", "otra cifra entre la lista y la del grupo");
arde("Falabella, Lider, Jumbo y Sodimac están bajo el benchmark con carga alta. El markup promedio queda en 41.4% en ese mismo grupo.", GRUPO, "P1", "el pronombre DESPUÉS de la cifra");
arde("Falabella, Lider, Jumbo y Sodimac están bajo el benchmark y exceden la carga; el markup promedio ahí es 41.4%.", GRUPO, "P1", "«ahí»");
arde("Falabella, Lider, Jumbo, Sodimac y Paris tienen margen bajo el benchmark y carga sobre el nivel; entre ellas pesan 73.8% de la venta.", GRUPO, "P1", "«entre ellas» con cinco nombres para la cifra de seis");
arde("El 73.8% de la venta —es decir, Falabella, Lider, Jumbo, Sodimac y Paris— está en cuentas con carga sobre el nivel.", GRUPO, "P1", "la lista después con «es decir»");
arde("Markup promedio de 41.4% para Falabella, Lider, Jumbo y Sodimac, contra 57.3% en los sanos.", GRUPO, "P1", "la lista después con «para»");
arde("Las cuentas grandes tienen markup promedio 41.4%; los sanos, 57.3%.", GRUPO, "P1", "la descripción vaga de un subgrupo con la cifra de los ocho");
arde("Lider tiene un markup de 41.4%, el más pegado al costo de la cartera.", GRUPO, "P1", "la cifra de grupo colgada a UNA entidad");
arde("Hay $4.9M sin capturar en Falabella, Lider y Jumbo.", GRUPO, "P1", "el subtotal de cinco con tres nombres");
arde("Los ocho bajo el benchmark dejan $4.9M sin capturar.", GRUPO, "P1", "el subtotal de cinco atribuido a los ocho");
arde("Son $655K de carga sobre el nivel en las 5 cuentas materiales.", GRUPO, "P1", "$655K es de seis cuentas (con Easy); las cinco materiales suman $588K");
arde("Los $33K frenados: LG-DRYER8KG ($14K) y BOS-SANDER ($11K).", GRUPO, "P1", "el desglose tras los dos puntos no cierra (faltan los $8K de MAK-COMP-AIR)");
arde("Falabella, Lider, Jumbo y Sodimac están bajo el benchmark. Todas exceden la carga declarada. Su markup promedio, 41.4%, confirma la erosión.", GRUPO, "P1", "el posesivo dos oraciones después de la lista");
arde("Los que erosionan: Falabella, Lider, Jumbo y Sodimac.\n\nLos cuatro de arriba pesan 73.8% de la venta.", GRUPO, "P1", "«los cuatro de arriba» tras la lista del párrafo anterior");
arde("Markup promedio de 41.4% en los que caen, básicamente Falabella, Lider, Jumbo y Sodimac.", GRUPO, "P1", "«, básicamente A, B, C y D»");
arde("Falabella, Lider, Jumbo y Sodimac son el núcleo del problema; ese núcleo promedia 41.4% de markup.", GRUPO, "P1", "un sustantivo de grupo fuera del catálogo («núcleo»)");
arde("Falabella y Lider están bajo el benchmark y con carga alta; ambas pesan 73.8% de la venta.", GRUPO, "P1", "«ambas»");
arde("Easy, La Polar y Hites están sobre el benchmark. No tienen carga alta. En ellos el markup promedio es 57.3%.", GRUPO, "P1", "«en ellos» dos oraciones después");
arde("Easy y La Polar juntas pesan 13.8% de la venta.", GRUPO, "P1", "dos nombres con la cifra de los cinco sanos");
arde("Las seis cuentas con carga sobre el nivel —Falabella, Sodimac, Lider, Easy y Ripley— suman $655K.", GRUPO, "P1", "«las seis» con cinco nombres (falta Jumbo)");
arde("Los sanos pesan 12.3% de la venta.", GRUPO, "P1", "el papel cambiado: 12.3 % es de margen delgado; los sanos pesan 13.8 %");
arde("Cinco cuentas explican el 73.8% de la venta.", GRUPO, "P1", "el conteo pegado a la cifra de seis");
arde("- Falabella, Lider, Jumbo y Sodimac\n  Markup promedio: 41.4%", GRUPO, "P1", "la lista en una línea y la cifra en la siguiente");
arde("El 73.8% de la venta se concentra en cinco nombres: Falabella, Lider, Jumbo, Sodimac y Paris.", GRUPO, "P1", "«cinco nombres:» y la lista de cinco para la cifra de seis");
pasa("Los ocho bajo el benchmark promedian 41.4% de markup; los cinco sanos, 57.3%.", "P1", "el grupo completo por conteo");
pasa("Las 5 cuentas materiales dejan $4.9M sin capturar.", "P1", "el subtotal con su conteo");
pasa("Los $33K frenados están en LG-DRYER8KG, BOS-SANDER y MAK-COMP-AIR.", "P1", "el grupo completo nombrado");
pasa("Los tres motores más grandes —Falabella, Lider y Jumbo— están todos bajo el benchmark (22%, 21.5% y 24%).", "P1", "cifras propias de cada uno, no de grupo");
pasa("Los $33K frenados están en dos bodegas: Valparaíso $25K (75%) y Antofagasta $8K (25%).", "P1", "el conteo de OTRO eje (bodegas) no es el conteo del grupo");
pasa("Capital por bodega: Santiago $64K, Valparaíso $39K, Concepción $19K y Antofagasta $13K — los $135K del total.", "P1", "«los $X del total»: la cifra ES el total");
pasa("La venta se reparte: 73.8% en las seis que erosionan, 12.3% en las dos de margen delgado y 13.8% en las cinco sanas.", "P1", "los ítems de una lista no se contaminan");
pasa("Los $655K de carga alta se reparten entre cinco cuentas bajo el benchmark y una sobre (Easy).", "P1", "la partición «cinco … y una»");
pasa("Los $4.9M: la mayor parte en tres cuentas (Falabella $1.6M, Lider $1.5M, Jumbo $1.1M) y el resto en dos (Sodimac $540K, Ripley $240K).", "P1", "la partición con «el resto»");
pasa("La carga alta de las cinco materiales ($588K) es parte de los $655K de las seis.", "P1", "subtotal dentro del subtotal mayor del mismo concepto");
pasa("Seis sobre el nivel de carga ($655K) y, de esas seis, cinco bajo el benchmark ($588K).", "P1", "«de esas seis» hacia adelante");
pasa("$1.6M (Falabella), $1.5M (Lider), $1.1M (Jumbo), $540K (Sodimac) y $240K (Ripley) suman $4.9M.", "P1", "el desglose completo que cierra");
pasa("Entre los que caen, la contribución no capturada suma $4.9M.", "P1", "la descripción cubre al grupo (los cinco materiales son de los que caen): un subconjunto no roba la cifra");
pasa("Del saldo vencido de $12.6M, $4.6M están en Lider.", "P1", "el control verdadero del cazador: parte y todo del mismo universo");
arde("Los sanos promedian 34% de margen.", /cifra-de-boleta-sin-dueno/, "P1", "LA INVERSA: 34 % es el margen de La Polar, un miembro, narrado como el promedio del grupo");
pasa("Los sanos van de 32% a 34% de margen.", "P1", "el rango del grupo con los extremos de sus miembros");
pasa("Entre los sanos, La Polar tiene 34% de margen.", "P1", "el miembro nombrado con su cifra");
pasa("El resto de las cuentas con vencido está en 8 días de atraso.", "P2", "«el resto» no identifica a un grupo de la boleta: Falabella, Tottus y Paris están en 8 días");
pasa("Los diez SKU con más contribución quedan listados arriba; el resto (3 de 13) aporta $1.5M.", "P2", "el resto de los SKU (3 de 13) es una fig de la boleta; que $1.5M sea también de Lider no la vuelve suya");
pasa("El precio de lista está más pegado al costo en quienes caen que en los sanos (markup 41.4% contra 57.3%).", "P2", "«quienes caen» es «los que caen»: la descripción propia, en un par «x contra y» (cierre real de la prueba 2)");
arde("Las cuentas con carga sobre el nivel declarado pesan 73.8% de la venta.", GRUPO, "P2", "la descripción de OTRO grupo de la boleta (las 6 sobre el nivel, con Easy y sin Paris) con la cifra de la erosión");
pasa("Las cuentas que erosionan por acciones comerciales pesan 73.8% de la venta.", "P2", "la descripción propia del grupo, sin lista");
pasa("Dos cifras para dimensionar: $4.9M de contribución no capturada en las 5 cuentas materiales y $655K de carga comercial sobre el nivel declarado en 6 cuentas.", "P1", "la coordinación «y $655K» abre su ítem: «las 5 cuentas» es del $4.9M");
pasa("El 73.8% está en seis cuentas, el 12.3% en dos y el 13.8% en cinco.", "P1", "«, el 12.3%» abre su ítem: «seis cuentas» es del 73.8 %");

H("3 · EL CONTEO SE CUENTA: contra lo que la boleta permite contar, en todas sus formas");
arde("Solo 2 de los 13 caen: Ripley y La Polar.", CONTEO, "P1", "caen 4 (Easy y Unimarc también)");
arde("Cayendo (2 cuentas): Ripley y La Polar.", CONTEO, "P1", "«(N cuentas)» sin «de M» — la lista «· YoY» de los que más se mueven no autoriza el conteo");
arde("Solo caen dos cuentas, Ripley y La Polar.", CONTEO, "P1", "el numeral en palabras");
arde("Se te están cayendo 2 clientes contra el año anterior.", CONTEO, "P1", "el entregable viejo del playbook: la preposición tras el sustantivo no es un descriptor");
pasa("Se te están cayendo 4 clientes contra el año anterior, 2 de forma material (las otras 2 caen bajo el 0.05% de tu venta: $50K).", "P1", "el entregable corregido: cuatro caen, dos materiales");
arde("Las tres cuentas que caen: Ripley, La Polar y Easy.", CONTEO, "P1", "falta Unimarc");
arde("10 de 13 clientes crecen contra el año anterior.", CONTEO, "P1", "crecen 9");
pasa("9 de 13 clientes crecen contra el año anterior.", "P1", "el «N de M» verdadero");
pasa("9 clientes crecen contra el año anterior.", "P1", "el conteo verificado contra la boleta queda AUTORIZADO por ella (antes «conteo-no-autorizado»)");
arde("7 de 13 clientes están bajo el benchmark.", CONTEO, "P1", "son 8");
arde("Hay 4 cuentas con saldo vencido.", CONTEO, "P1", "son 6 — sin «de M»");
arde("Siete cuentas están bajo el benchmark de 30.1%.", CONTEO, "P1", "el numeral en palabras con el benchmark al lado");
arde("Media docena de cuentas venden menos que el año pasado.", CONTEO, "P1", "«media docena»: caen 4");
arde("La mayoría de las cuentas caen contra el año anterior.", CONTEO, "P1", "«la mayoría»: 4 de 13");
arde("Hay más cuentas cayendo que creciendo.", CONTEO, "P1", "caen 4, crecen 9");
arde("Cuatro de cada cinco cuentas están bajo el benchmark.", CONTEO, "P1", "8 de 13 = 62 %");
arde("Un tercio de la cartera está bajo el benchmark.", CONTEO, "P1", "8 de 13 = 62 %");
arde("9 de 13 clientes no tienen vencido.", CONTEO, "P1", "la negación: sin vencido son 7");
arde("Cuatro de las cinco cuentas materiales tienen vencido.", CONTEO, "P1", "el M parcial resuelto por su descripción: son 3");
arde("De las 8 bajo el benchmark, 7 exceden el nivel de carga.", CONTEO, "P1", "«De M, N» con M parcial: son 6");
arde("De 13 cuentas, 3 caen: Ripley, La Polar y Easy.", CONTEO, "P1", "el orden invertido");
arde("3 de 13 cuentas están bajo el benchmark y con vencido.", CONTEO, "P1", "la intersección de dos predicados: son 5");
arde("2 de las 13 cuentas concentran todo el vencido: Lider y Falabella.", CONTEO, "P1", "«concentran todo el vencido» es el conteo de las que tienen (6)");
arde("Las cinco cuentas con vencido —Lider, Falabella, Sodimac, Tottus y Paris— suman $12.6M.", /conteo-de-lista-falso|cifra-de-grupo-mal-repartida/, "P1", "son seis (falta Easy)");
arde("Seis cuentas con vencido: Lider, Falabella, Sodimac, Tottus, Paris y Jumbo.", CONTEO, "P1", "Jumbo no tiene vencido; la sexta es Easy");
arde("Los cuatro que caen: Ripley, La Polar, Easy y Hites.", CONTEO, "P1", "Hites crece: el cuarto es Unimarc");
arde("2 de 13 SKU están frenados.", /conteo-de-lista-falso|estado-no-declarado/, "P1", "frenados son 3");
pasa("3 de 13 SKU están frenados.", "P1", "el conteo de SKU verdadero");
pasa("5 de 13 SKU están inmovilizados.", "P1", "…y el de inmovilizados");
arde("Solo un SKU está frenado: LG-DRYER8KG.", /conteo-de-lista-falso|estado-no-declarado/, "P1", "son 3");
arde("Cuatro bodegas tienen capital frenado.", CONTEO, "P1", "el eje bodega: son 2 (Valparaíso y Antofagasta)");
arde("El capital frenado está repartido en tres bodegas.", CONTEO, "P1", "son 2");
pasa("Hay 8 clientes bajo el benchmark, 5 de ellos materiales: Falabella, Lider, Jumbo, Sodimac y Ripley.", "P1", "el conteo y su subconjunto material, con la lista");
pasa("De las 8 cuentas bajo el benchmark, 5 son materiales: Falabella, Lider, Jumbo, Sodimac y Ripley.", "P1", "«De M, N» verdadero");
pasa("6 cuentas están sobre el nivel de carga declarado (3.5%), y 5 de ellas además están bajo el benchmark; la sexta es Easy.", "P1", "dos conteos verdaderos coordinados");
pasa("Las 6 cuentas con carga alta ($655K) son 5 bajo el benchmark más Easy.", "P1", "la partición «5 … más Easy»");
pasa("4 de 13 cuentas caen: Ripley, La Polar, Easy y Unimarc.", "P1", "«N de M» correcto con la lista completa");
pasa("Falabella, Jumbo y Lider tienen la contribución más alta; los tres están bajo el benchmark.", "P1", "«los tres» remite a la lista: pertenencia, no conteo");
noArde("Con la carga comercial -2pp (tu supuesto), la cartera quedaría mejor: quedan sobre el benchmark 6 de 13.", CONTEO, "P1", "el conteo bajo un supuesto declarado es de la simulación, no del dato");
pasa("Tres cuentas superan los 250 días de atraso: Easy (270), Lider (269) y Sodimac (251).", "P1", "el PREDICADO CON UMBRAL verificado contra el ranking de días de atraso; la cota «250 días» no es una cifra del dato");
arde("Cuatro cuentas superan los 250 días de atraso.", CONTEO, "P1", "…y con el conteo equivocado arde (son 3)");
pasa("Solo dos SKU superan los 150 días de cobertura: MAK-COMP-AIR (190) y LG-DRYER8KG (165).", "P1", "el umbral de días de inventario, eje SKU");
arde("Tres SKU superan los 150 días de cobertura.", CONTEO, "P1", "son 2");
pasa("Cuatro clientes están por debajo de 25% de margen: Lider, Falabella, Sodimac y Jumbo.", "P1", "el umbral de margen");
arde("Cinco clientes están por debajo de 25% de margen.", CONTEO, "P1", "son 4");
arde("Ni PHI-SHAVER9 ni PHI-HAIR-PRO tienen capital frenado; los dos rotan en menos de 20 días.", CIFRA, "P1", "la cota SIN conteo verificado reemplaza las cifras reales (15 y 19 días) por una redondeada — «ni inventada ni redondeada» (owner 2026-09-14, v2.29); rótulo del cazador corregido");
arde("Lo que más pesa es el vencido de Lider y Sodimac con más de 250 días.", CIFRA, "P1", "la corrida viva de v2.29: «más de 250 días» en vez de 269 y 251 — veto legítimo del owner, intacto");
pasa("De las tres cuentas con más de 250 días de atraso, Sodimac es la de peor recuperación (35%).", "P1", "el complemento con umbral define un conjunto verificado (3): la cota es un criterio, no una cifra");
pasa("Este es el mecanismo probado: 6 cuentas caen con carga sobre el 3.5% de referencia.", "P2", "«caen» con la lectura de la casa (la boleta llama «los que caen» a los ocho bajo el benchmark): bajo el benchmark ∩ carga = 6 — reparación viva del gerente");
arde("8 cuentas venden menos que el año pasado.", CONTEO, "P2", "…pero «venden menos» solo tiene la lectura del año anterior: caen 4");
pasa("Esos tres (Falabella, Lider y Jumbo) son 3 de los 8 bajo el benchmark.", "P1", "el «N de M» de adentro se lleva el predicado: «esos tres» no se juzga contra los 8");
pasa("De 13 clientes, 8 están bajo el benchmark; de esos 8, 6 tienen carga sobre el nivel; de esos 6, 5 son materiales.", "P1", "la cadena de conteos verdaderos");
arde("De 13 clientes, 7 están bajo el benchmark.", CONTEO, "P1", "«De M, N» falso: son 8");

H("4 · UNIVERSOS Y SUBTOTALES: «de los $X, $Y» solo dentro del mismo universo; el subtotal cabe en su subtotal mayor");
arde("De los $33K frenados, $4.6M están vencidos en Lider.", UNIVERSO, "P1", "vencido (cobranza) dentro del frenado (inventario)");
arde("De los $12.6M vencidos, $8.2M corresponden a Falabella.", UNIVERSO, "P1", "$8.2M es el PENDIENTE de Falabella");
arde("Del capital de $135K, $12.6M ya están vencidos.", UNIVERSO, "P1", "inventario y cobranza");
arde("De los $25.0M de contribución, $19.4M son de Falabella.", UNIVERSO, "P1", "la venta dentro de la contribución");
arde("De los $12.6M vencidos, $9.8M están en Lider.", UNIVERSO, "P1", "el pendiente de Lider dentro del vencido");
arde("De los $41.2M pendientes, $12.2M son de Jumbo.", UNIVERSO, "P1", "lo abonado dentro del pendiente");
arde("Del capital frenado ($33K), $4.6M corresponden al vencido de Lider.", UNIVERSO, "P1", "la forma 2 (el todo entre paréntesis)");
arde("De los $33K frenados, $11K están vencidos en BOS-SANDER.", /subtotal-de-otro-universo|metrica-mal-atribuida/, "P1", "la misma cifra con la palabra de otro universo");
pasa("Del saldo vencido de $12.6M, $4.6M están en Lider.", "P2", "el control verdadero (fn-atribucion-2244, reetiquetado): mismo universo");
pasa("Son $655K de carga comercial alta en 6 cuentas, de los cuales $588K están en las 5 materiales.", "P1", "el subtotal dentro de su subtotal mayor del mismo concepto");
pasa("De los $655K de carga alta, $588K corresponden a las cinco materiales y $67K a Easy.", "P1", "el desglose del subtotal mayor");
pasa("Los tres frenados son los $33K del total.", "P1", "«los $X del total» es el total, no una parte de otro universo");
pasa("De los $4.9M no capturados, $588K son carga comercial alta y $4.4M brecha por precio y costo.", "P1", "la partición medida contra el benchmark (doctrina)");

H("5 · LAS FRACCIONES EN PALABRAS: contra el dato o contra las cifras que la frase trae; el numerador dicho manda");
arde("Falabella aporta un tercio de la contribución del negocio.", RELACION, "P1", "4.3 / 25.0 = 17 %");
arde("Lider y Falabella explican dos tercios del vencido.", RELACION, "P1", "7.1 / 12.6 = 56 %");
arde("Lider concentra más de la mitad del vencido total.", RELACION, "P1", "4.6 / 12.6 = 36.5 %");
arde("En Lider más de la mitad del saldo pendiente ya está vencido ($4.6M de $9.8M).", RELACION, "P1", "47 % con los operandos entre paréntesis");
arde("Lider y Falabella —las dos con más vencido— suman $7.1M, dos tercios del total vencido de $12.6M.", RELACION, "P1", "7.1 / 12.6 = 56 % con el numerador dicho");
pasa("Falabella, Lider y Jumbo ($19.4M, $17.8M y $17.3M) concentran más de la mitad de los $99.9M.", "P1", "54.5 / 99.9 = 55 %: la suma de la lista contra el total dicho");
pasa("Antofagasta tiene un tercio del frenado de Valparaíso ($8K contra $25K).", "P1", "la comparación con una entidad en el complemento: el par entre paréntesis");
pasa("liberar esos dos suma $22K, casi dos tercios del capital frenado total ($33K).", "P1", "el NUMERADOR DICHO junto a la fracción (22 / 33 = 67 %): la cifra del sujeto ($8K) no es la parte — borrador real de la corrida en vivo");
pasa("Lider debe casi el doble que Falabella ($4.6M contra $2.5M).", "P1", "1.83: «casi el doble»");
pasa("Sodimac recupera casi la mitad que Jumbo (35% frente a 70.5%).", "P1", "0.496");
pasa("Falabella recupera más que Lider (57.7% frente a 45%) y su vencido es casi la mitad ($2.5M frente a $4.6M).", "P1", "0.54: «casi la mitad» calibrada (0.8–1.1)");
arde("La brecha de Lider es casi el doble que la de Jumbo (8.6 pp contra 6.1 pp).", RELACION, "P1", "1.41 no es «casi el doble»");
arde("Falabella vende casi el doble que Jumbo.", RELACION, "P1", "el par sin cifras contra el dato: 1.12");
arde("Lider debe casi cuatro veces lo que Sodimac ($4.6M contra $1.9M).", RELACION, "P1", "2.4");

H("6 · LOS INVENTOS: el % plausible, el monto cerca del real, la participación recomputada, el promedio no publicado, la unidad");
arde("El 26.2% de la venta está en cuentas con margen delgado.", INVENTO, "P1", "margen delgado pesa 12.3 %");
arde("Falabella pesa 21% de la venta.", INVENTO, "P1", "19.4 / 99.9 = 19.4 %");
arde("Los tres grandes aportan el 51% de la contribución.", /cifra-de-grupo-mal-repartida|cifra-no-autorizada|cifra-de-boleta-sin-dueno/, "P1", "49 % es de los grandes; 51 % del resto");
arde("El 30% del capital está frenado.", INVENTO, "P1", "33 / 135 = 24.4 %");
arde("La carga comercial promedio de la cartera es 4.1%.", INVENTO, "P1", "un promedio no publicado");
arde("Los tres grandes promedian 40.2% de markup.", INVENTO, "P1", "(39.1 + 37.2 + 38.3) / 3 = 38.2");
arde("Los tres grandes concentran el 58% de la venta.", INVENTO, "P1", "54.6 %");
arde("Lider: $4.7M vencidos, 269 días de atraso.", /cifra-no-autorizada|cifra-de-boleta-sin-dueno|cifra-de-dato-sin-dueno/, "P1", "$4.6M; $4.7M es la venta de Ripley");
arde("Las 5 cuentas materiales dejan $5.0M sin capturar.", INVENTO, "P1", "$4.9M");
arde("Hay $35K de capital frenado.", INVENTO, "P1", "$33K");
arde("Los tres grandes venden $56M entre los tres.", INVENTO, "P1", "19.4 + 17.8 + 17.3 = 54.5");
arde("Los tres SKU frenados suman $30K.", INVENTO, "P1", "$33K");
arde("Contribución no capturada $4.9M = $588K de carga + $4.5M de precio y costo.", INVENTO, "P1", "precio y costo es $4.4M: la cuenta mostrada no cierra");
arde("Capital: $56K sano + $36K en riesgo + $10K sobrestock + $33K frenado = $140K.", /cifra-no-autorizada|suma/, "P1", "$135K");
arde("LG-DRYER8KG tiene $14M frenados.", INVENTO, "P1", "K narrado como M");
arde("Falabella vende $19.4K al año.", INVENTO, "P1", "M narrado como K");
arde("El sobrestock es el 10% del capital.", INVENTO, "P1", "$10K narrado como 10 %");

console.log(`\n${PASS} PASS · ${FAIL} FAIL`);
process.exit(FAIL ? 1 : 0);
