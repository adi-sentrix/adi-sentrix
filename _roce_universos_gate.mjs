/* === _roce_universos_gate.mjs · LA FUGA CONCRETA DE UNIVERSOS (owner 2026-08-15, medida en el examen 2) =======
 * NO es el contrato de universos completo — es la fuga que apareció, y nada más. Tres reglas:
 *   (1) una cifra solo se compara contra una vara de SU universo;
 *   (2) un campo que existe en los dos universos se nombra completo («margen de inventario»);
 *   (3) un ranking parcial declara su cola.
 * EL CASO QUE LO ORIGINA (turno 4 del examen 2, verde por el muro de entonces): «MAK-SAW18V… su margen es 34% —
 * el mejor de toda la lista, por encima del benchmark de cartera (30.1%)». El 34% es margen de INVENTARIO; el
 * benchmark de 30.1% es del universo de VENTA. Ninguna cuenta cruzó los dos mundos: cruzó la COMPARACIÓN.
 * Cada positivo lleva su control negativo: lo legítimo tiene que seguir pasando. CERO red, CERO .env. */
import { guardC } from "./src/adi/oracle/guardC.js";
import { MARCA_CALCULO } from "./src/adi/oracle/narrationBlocks.js";
import { cifrasDelDato } from "./src/adi/oracle/datoProyectado.js";
import { axisEntityNames } from "./src/adi/oracle/entityIndex.js";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
initTenant(TENANT_DEMO);

let pass = 0, fail = 0;
const ok = (c, m) => { console.log(`  ${c ? "✓" : "✗"} ${m}`); c ? pass++ : fail++; };
const ejes = (a) => a.flatMap((e) => { try { return axisEntityNames(e); } catch { return []; } });
const CTX = { ledger: { figs: [] }, results: [], trace: null, question: "inventario y SKU",
  datoProyectado: cifrasDelDato("actual"), entidadesDelTenant: ejes(["cliente", "sku", "marca"]),
  duenosDelTenant: ejes(["cliente", "sku", "marca", "familia", "bodega", "canal"]), contentScope: "full", tablePolicy: "auto" };
const J = (t, extra = {}) => guardC(t, { ...CTX, ...extra });
const V = (t) => { const v = J(t); return v.ok ? "PASA" : v.verdict; };

console.log("── 0 · LA CARPETA DECLARA EL UNIVERSO DE CADA CIFRA ──");
{
  const figs = cifrasDelDato("actual").figs || [];
  const conUni = figs.filter((f) => f.universo);
  ok(conUni.length === figs.length && figs.length > 0, `las ${figs.length} cifras traen universo (${conUni.length} con marca)`);
  const u = new Set(conUni.map((f) => f.universo));
  ok(u.has("venta") && u.has("inventario") && u.has("negocio"), `los universos declarados son ${[...u].join(", ")}`);
  const bench = figs.find((f) => (f.duenos || []).includes("benchmark") && f.value === "30.1%");
  ok(bench && bench.universo === "venta", `el benchmark de margen (30.1%) es del universo VENTA (obtuvo ${bench && bench.universo})`);
  const piso = figs.find((f) => String(f.value) === "2.0x");
  ok(piso && piso.universo === "inventario", `el piso de rotación (2.0x) es del universo INVENTARIO (obtuvo ${piso && piso.universo})`);
}

console.log("\n── 1 · COMPARACIÓN CRUZADA · el caso MEDIDO ──");
const MEDIDO = "MAK-SAW18V tiene margen de inventario 34.0%, por encima del benchmark de 30.1% de la cartera.";
ok(V(MEDIDO) === "comparacion-cruzada", `el caso real muere (${V(MEDIDO)})`);
ok(/de inventario/.test(String((J(MEDIDO).violations[0] || {}).detail || "")) && /universo venta/.test(String((J(MEDIDO).violations[0] || {}).detail || "")),
  "…y la multa nombra los DOS universos, para que la reparación sepa qué está mezclando");
// LOS CONTROLES NEGATIVOS · lo legítimo tiene que seguir pasando
ok(J("El margen de Falabella es 22.0%, por debajo del benchmark de 30.1%.").ok,
  "comparar un margen de VENTA contra el benchmark de VENTA pasa (es su propia vara)");
ok(J("MAK-COMP-AIR tiene rotación 0.8x, por debajo del piso de rotación de 2.0x.").ok,
  "comparar una rotación contra el piso de rotación pasa (los dos son de inventario)");
ok(J("MAK-SAW18V tiene margen de inventario 34.0% y rotación 5.2x.").ok,
  "…y sin comparación no hay nada que juzgar, aunque la cifra sea de inventario");
ok(J("El margen de inventario de MAK-SAW18V es 34.0%. El benchmark de la cartera es 30.1%.").ok,
  "…ni cuando las dos van en ORACIONES distintas: la regla es sobre la comparación, no sobre la vecindad");

console.log("\n── 2 · ETIQUETA COMPLETA ──");
ok(V("BOS-SANDER tiene margen 15.0% y capital $11K frenado.") === "etiqueta-ambigua",
  `«margen 15.0%» de un SKU, sin decir de qué universo, muere (${V("BOS-SANDER tiene margen 15.0% y capital $11K frenado.")})`);
ok(J("BOS-SANDER tiene margen de inventario 15.0% y capital $11K frenado.").ok, "…y con el nombre completo pasa");
ok(J("El margen de Falabella es 22.0%.").ok, "el margen de un CLIENTE no es ambiguo (no tiene margen de inventario): pasa");
ok(J("BOS-SANDER tiene margen de venta 18.0%.").ok, "el margen de VENTA de un SKU, nombrado completo, pasa");
/* ── LAS DOS EXCEPCIONES DE LA CALIBRACIÓN (2026-08-15, sobre los borradores guardados) ────────────────────────
 * Los dos textos son VERBATIM del corpus y los dos eran correctos: el muro los vetaba por exigir la etiqueta en
 * CADA mención, no por ambigüedad real. */
ok(J("MAK-COMP-AIR generó $1.7M en ventas con $135K de contribución y 7.9% de margen — el margen de venta más bajo de toda la cartera.").ok,
  "basta con que la cláusula lo nombre UNA vez: «7.9% de margen — el margen de venta más bajo» ya dijo de cuál habla");
ok(J("MAK-COMP-AIR rota 0.8x con margen de inventario 8.0% en la foto de hoy, y en la venta comercial del año cerrado tiene el margen más bajo de los 13 SKU (7.9%).").ok,
  "…y la frase que declara el universo en palabras («en la venta comercial del año cerrado») tampoco necesita repetir la etiqueta");
// EL CONTROL: sin ninguna de las dos cosas, el veto sigue
ok(V("BOS-SANDER tiene margen 15.0% y capital $11K.") === "etiqueta-ambigua",
  "pero un «margen 15.0%» sin universo por ningún lado sigue muriendo: la excepción es para lo declarado, no para lo omitido");
ok(V("| SKU | Rotación | Margen | Estado |\n| BOS-SANDER | 1.6x | 15.0% | 90d |") === "etiqueta-ambigua",
  "…y un encabezado de tabla «Margen» a secas también (era el caso real del examen 2)");

console.log("\n── 3 · RANKING SIN COLA ──");
const RANK7 = "Ranking de SKU por peor rotación: MAK-COMP-AIR 0.8x, LG-DRYER8KG 1.0x, BOS-SANDER 1.6x, PHI-IRON-PRO 2.4x, SAM-TV55 3.6x, MAK-SAW18V 5.2x, LG-AIR9000 5.8x.";
ok(V(RANK7) === "ranking-sin-cola", `un ranking de 7 sobre 13 que no dice dónde corta muere (${V(RANK7)})`);
ok(/7 de 13/.test(String((J(RANK7).violations[0] || {}).detail || "")), "…y la multa dice cuántos de cuántos");
ok(J(RANK7.replace("Ranking de SKU", "Ranking de SKU (top 7 de 13)")).ok, "…y declarando «top 7 de 13» pasa");
ok(J("Los SKU frenados son MAK-COMP-AIR, LG-DRYER8KG y BOS-SANDER: son los que el dato marca en estado 90d o 120d.").ok,
  "una respuesta FILTRADA no es un recorte — no anuncia orden y responde el conjunto completo de la pregunta");
ok(J("Ranking de SKU por peor rotación: MAK-COMP-AIR 0.8x y LG-DRYER8KG 1.0x.").ok,
  "nombrar 2 no dispara nada: hace falta un listado (3+) para que se lea como el universo entero");
/* PROMETER TODO Y ENTREGAR UNA PARTE (medido 2026-08-15, re-corrida del examen 2 · turno 4): la respuesta decía
 * «Ranking COMPLETO por rotación… los 13 SKU de la foto de hoy» y la tabla traía CINCO filas. Y el chequeo quedó
 * MUDO porque en otra frase aparecía «el resto» — el interruptor global otra vez, la trampa que este mismo
 * archivo ya documenta. Ahora se compara lo que el texto AFIRMA contra lo que MUESTRA. */
const PROMETE = "Ranking completo por rotación (peor a mejor), cruzado con margen de inventario — los 13 SKU de la foto de hoy: MAK-COMP-AIR 0.8x, LG-DRYER8KG 1.0x, BOS-SANDER 1.6x, PHI-IRON-PRO 2.4x, SAM-TV55 3.6x. El resto de la cola compensa con mejor margen.";
ok(V(PROMETE) === "ranking-sin-cola", `prometer «completo… los 13 SKU» y mostrar 5 muere (${V(PROMETE)})`);
ok(/COMPLETO y mostrás 5 de 13/.test(String((J(PROMETE).violations[0] || {}).detail || "")), "…y la multa dice exactamente qué prometió y qué entregó");
ok(V(RANK7 + " El resto de la cola compensa con mejor margen.") === "ranking-sin-cola",
  "…y «el resto» en cualquier parte del texto YA NO apaga la regla entera (era un interruptor global)");

/* ── 3b · LA FRASE REAL, VERBATIM DEL EXAMEN 2 · TURNO 4 ──────────────────────────────────────────────────────
 * Ni una paráfrasis: el texto que ADI puso en pantalla y que el muro de entonces dejó pasar en VERDE. Es el
 * ancla de este gate — si algún día vuelve a pasar, este caso se pone rojo antes que nadie lo note. */
console.log("\n── 3b · LA FRASE REAL DEL EXAMEN (verbatim) ──");
const REAL = "**MAK-SAW18V** es el caso más engañoso: 5.2x lo ubica bajo en el ranking de rotación, pero su margen es 34% — el mejor de toda la lista, por encima del benchmark de cartera (30.1%), y está en estado Activo.";
const vReal = J(REAL);
ok(!vReal.ok, `la frase REAL que salió a pantalla ahora muere (${vReal.ok ? "PASÓ 🔴" : vReal.verdict})`);
ok((vReal.violations || []).some((x) => x.kind === "comparacion-cruzada"), "…la caza el chequeo de comparación cruzada");
ok((vReal.violations || []).some((x) => x.kind === "etiqueta-ambigua"), "…y también el de etiqueta: «su margen es 34%» no dice de cuál de los dos habla");
// y la versión CORREGIDA de la misma frase pasa: el arreglo tiene que ser escribible
ok(J("MAK-SAW18V rota 5.2x, sobre el piso de rotación de 2.0x, y su margen de inventario es 34.0% — el mejor de la lista. Está en estado Activo.").ok,
  "…y la misma lectura, escrita bien (vara propia + etiqueta completa), pasa");

/* ── 3c · DOS ESTADOS, DOS PALABRAS (owner 2026-08-15) ────────────────────────────────────────────────────────
 * «capital inmovilizado = categoría amplia; frenado = estado crítico DENTRO de capital inmovilizado. El notario
 * debe vetar si ADI usa "frenado" como sinónimo de "inmovilizado".» La carpeta declara los dos, con nombre,
 * criterio y monto — antes no traía ninguno (deriveKpis().inventario es null) y el cerebro sumaba a mano. */
console.log("\n── 3c · «FRENADO» NO ES SINÓNIMO DE «INMOVILIZADO» ──");
{
  const c = cifrasDelDato("actual");
  const est = c.estados || [];
  const nF = est.filter((e) => e.estado === "frenado").length, nI = est.filter((e) => e.estado === "inmovilizado").length;
  ok(nF === 3 && nI === 5, `la carpeta declara los DOS estados: ${nF} frenados (crítico) y ${nI} inmovilizados (amplio)`);
  ok(est.filter((e) => e.estado === "frenado").every((e) => est.some((x) => x.estado === "inmovilizado" && x.entidad === e.entidad)),
    "…y todo frenado está también declarado inmovilizado: es un SUBCONJUNTO, no otra lista");
  const figs = c.figs || [];
  ok(figs.some((f) => (f.duenos || []).includes("inmovilizado") && f.value === "$56K"), "el monto de la categoría amplia ($56K) viaja al cerebro con su dueño");
  ok(figs.some((f) => (f.duenos || []).includes("frenado") && f.value === "$33K"), "…y el del estado crítico ($33K) también");
}
ok(V("Cinco SKU frenados concentran $56K de capital.") === "estado-no-declarado",
  `usar «frenados» para el conteo de la categoría amplia muere (${V("Cinco SKU frenados concentran $56K de capital.")})`);
ok(/no son sinónimos/i.test(String((J("Cinco SKU frenados concentran $56K de capital.").violations[0] || {}).detail || "")),
  "…y la multa explica la diferencia, no solo la corrige");
ok(V("SAM-TV55 está frenado.") === "estado-no-declarado", `un SKU inmovilizado pero NO crítico, llamado «frenado», muere (${V("SAM-TV55 está frenado.")})`);
ok(/INMOVILIZADO pero no FRENADO/.test(String((J("SAM-TV55 está frenado.").violations[0] || {}).detail || "")), "…y la multa dice exactamente cuál de los dos es");
// LOS CONTROLES NEGATIVOS · las dos palabras bien usadas tienen que pasar
ok(J("Cinco SKU concentran $56K de capital inmovilizado.").ok, "la categoría amplia con su palabra y su cifra: pasa");
ok(J("Tres SKU frenados concentran $33K.").ok, "el estado crítico con su palabra y su cifra: pasa");
ok(J("SAM-TV55 tiene capital inmovilizado.").ok, "un SKU de la categoría amplia, llamado por su palabra: pasa");
ok(J("MAK-COMP-AIR está frenado dentro del capital inmovilizado.").ok, "…y un SKU crítico, nombrado con las dos palabras a la vez: pasa");
ok(J("De los 13 SKU en stock, cinco están inmovilizados.").ok,
  "un conteo del universo ENTERO en la misma oración no se confunde con un conteo de estado (el 13 no es del estado)");

/* ── 3d · EL UNIVERSO DE UN RANKING ES EL CONJUNTO DEL QUE SE HABLA (falso positivo MEDIDO en la app) ─────────
 * A «sobre esos SKU, ¿cuáles explican el 80% del capital inmovilizado?» ADI rankeó los CINCO inmovilizados — el
 * universo completo de esa pregunta — y el chequeo le exigía «5 de 13», comparando contra todos los SKU del
 * inventario. Rankear un conjunto declarado ENTERO no es un recorte: es la respuesta completa. */
console.log("\n── 3d · RANKEAR UN CONJUNTO DECLARADO ENTERO NO ES UN RECORTE ──");
const RANK_INMOV = "Ranking de los 5 SKU inmovilizados, de mayor a menor capital: LG-DRYER8KG $14K, SAM-TV55 $13K, BOS-SANDER $11K, PHI-IRON-PRO $10K, MAK-COMP-AIR $8K.";
ok(J(RANK_INMOV).ok, `rankear los 5 inmovilizados (el conjunto entero) pasa — antes moría por «5 de 13» (${V(RANK_INMOV)})`);
ok(J("Ranking de los 3 SKU frenados por rotación: MAK-COMP-AIR 0.8x, LG-DRYER8KG 1.0x, BOS-SANDER 1.6x.").ok,
  "…y rankear los 3 frenados, que es el otro conjunto declarado, también");
ok(V("Ranking de SKU por peor rotación: MAK-COMP-AIR 0.8x, LG-DRYER8KG 1.0x, BOS-SANDER 1.6x, SAM-MICRO32L 7.4x, LG-WASH11KG 8.6x.") === "ranking-sin-cola",
  "…pero un recorte ARBITRARIO de 5 que no es ningún conjunto declarado sigue muriendo");

/* ── 3e · LA ATRIBUCIÓN ES POR CLÁUSULA, Y UNA PALABRA NEGADA NO ATRIBUYE ────────────────────────────────────
 * Falsos positivos MEDIDOS en el examen 2 (borradores CORRECTOS que el muro rechazó). Van verbatim. */
console.log("\n── 3e · CONTRASTE Y NEGACIÓN NO SON ATRIBUCIÓN ──");
const CONTRASTE = "Y dentro de ese grupo, solo LG-DRYER8KG y BOS-SANDER cruzaron a frenado (rotación bajo 2.0x o días sobre 120d); SAM-TV55 y PHI-IRON-PRO todavía están en zona de alerta, no de crítico.";
const _sinEstado = (t) => !(J(t).violations || []).some((x) => x.kind === "estado-no-declarado");
ok(_sinEstado(CONTRASTE), `el CONTRASTE entre cláusulas no atribuye el estado a los de la segunda (${V(CONTRASTE)})`);
const NEGADO = "- SAM-TV55 — $13K (23.2%) · inmovilizado, no frenado";
ok(_sinEstado(NEGADO), `«inmovilizado, no frenado» dice justo lo contrario: no puede leerse como atribución (${V(NEGADO)})`);
ok(_sinEstado("MAK-SAW18V no está frenado ni inmovilizado: rota 5.2x y su estado es Activo."), "…ni «no está frenado ni inmovilizado»");
// …y la atribución DE VERDAD sigue muriendo: la excepción es para la negación, no para el error
ok(V("SAM-TV55 está frenado.") === "estado-no-declarado", "pero afirmar «SAM-TV55 está frenado» sigue muriendo");
/* «PARADO» pide la categoría AMPLIA, no la crítica (medido en el examen 2 · turno 2): «para cortar la mayoría del
 * capital parado, mueve SAM-TV55 y PHI-IRON-PRO» es correcto — esos SKU están inmovilizados. */
ok(J("Para cortar la mayoría del capital parado necesitas mover SAM-TV55, BOS-SANDER y PHI-IRON-PRO.").ok,
  `«capital parado» sobre SKU inmovilizados pasa: es la palabra vaga de la categoría amplia (${V("Para cortar la mayoría del capital parado necesitas mover SAM-TV55, BOS-SANDER y PHI-IRON-PRO.")})`);
ok(V("MAK-SAW18V está parado.") === "estado-no-declarado", "…pero llamar «parado» a un SKU Activo sigue muriendo");
ok(V("Los SKU frenados son LG-DRYER8KG, BOS-SANDER y SAM-TV55.") === "estado-no-declarado", "…y meterlo dentro de la lista de frenados también");

/* ── 3f · LA ANÁFORA MANTIENE AL DUEÑO, CON SUS CUATRO CANDADOS (owner 2026-08-15) ────────────────────────────
 * MEDIDO en el examen 2 · Q3: «liberando ESE SKU completo cubres el 83.3%» — la cuenta cerraba, el dueño estaba
 * declarado, y el nombre vivía en la oración anterior. Cayó al suplente por una regla que no leía español. */
console.log("\n── 3f · «ESE SKU» HEREDA EL DUEÑO SOLO SI EL ANTECEDENTE ES ÚNICO E INMEDIATO ──");
const BL = (l) => `\n\n${MARCA_CALCULO}\n${l}`;
const CALC83 = "id=c1 · op=pct_de · inputs=$56K; 30% · formula=30% de $56K · resultado=$16.8K · unidad=money · dueno=total\nid=c2 · op=dividir · inputs=$14K; c1 · formula=$14K / $16.8K · resultado=83.3% · unidad=pct · dueno=LG-DRYER8KG";
const Q30 = { question: "simula liberar el 30% del capital inmovilizado", supuestoPendiente: ["30%"] };
ok(J("Concentralo en LG-DRYER8KG: es el de mayor capital ($14K). Liberando ese SKU completo cubres el 83.3% del objetivo de $16.8K." + BL(CALC83), Q30).ok,
  `el caso REAL del examen pasa: el antecedente es único e inmediato (${V("Concentralo en LG-DRYER8KG: es el de mayor capital ($14K). Liberando ese SKU completo cubres el 83.3% del objetivo de $16.8K." + BL(CALC83), Q30)})`);
// (2) DOS CANDIDATOS → NO HEREDA
ok(!J("Los mayores son LG-DRYER8KG ($14K) y SAM-TV55 ($13K). Liberando ese SKU completo cubres el 83.3% del objetivo de $16.8K." + BL(CALC83), Q30).ok,
  "con DOS SKU en la oración anterior no hay a quién referirse: no hereda");
// (3) CAMBIO DE EJE → NO HEREDA
ok(!J("Concentralo en LG-DRYER8KG: es el de mayor capital ($14K). Liberando ese cliente completo cubres el 83.3% del objetivo de $16.8K." + BL(CALC83), Q30).ok,
  "«ese cliente» no puede resolver a un SKU: cambiar de eje no hereda");
// (1) EL ANTECEDENTE TIENE QUE SER INMEDIATO
// LA CADENA DE DOS SALTOS, verbatim del examen: la oración del medio no nombra a nadie, así que no compite
{ // el caso REAL de Q3: la anáfora sostiene el 83.3%. (El texto tiene ADEMÁS sujetos elididos — «Es el de
  // mayor capital…» — que son otra construcción y NO los resuelve esta regla: se juzga solo lo que se probó.)
  const vQ3 = J("Concentralo en LG-DRYER8KG. Es el de mayor capital ($14K) y peor rotación del grupo (1.0x, la mitad del piso de 2.0x), con 94 días sin venta. Liberando ese SKU completo cubres el 83.3% del objetivo de $16.8K." + BL(CALC83), Q30);
  ok(!(vQ3.violations || []).some((x) => x.kind === "cifra-calculada-mal-atribuida"),
    "el antecedente a DOS oraciones, sin competidor en el medio, sostiene el dueño del cálculo (caso real de Q3)");
}
// …pero si en el medio aparece OTRA entidad del mismo eje, ya no es único: no hereda
ok(!J("Concentralo en LG-DRYER8KG. SAM-TV55 es el segundo en capital ($13K). Liberando ese SKU completo cubres el 83.3% del objetivo de $16.8K." + BL(CALC83), Q30).ok,
  "con otra entidad del eje en el medio, la referencia queda ambigua: no hereda");
// (4) CAMBIO DE UNIVERSO → NO HEREDA
ok(!J("LG-DRYER8KG aporta contribución en la venta comercial del año cerrado. Ese SKU tiene 83.3% de su capital en stock inmovilizado." + BL(CALC83), Q30).ok,
  "si la oración previa habla de venta y la de la cifra de inventario, la referencia no cruza universos");
// …y sin anáfora, el dueño nombrado sigue siendo el camino normal
ok(J("Liberando LG-DRYER8KG completo cubres el 83.3% del objetivo de $16.8K." + BL(CALC83), Q30).ok,
  "y nombrar al dueño en la misma oración sigue pasando, como siempre");

console.log("\n── 4 · SIN UNIVERSOS DECLARADOS, EL MURO NO SE MUEVE ──");
{
  const sinUni = { ...CTX, datoProyectado: { figs: (cifrasDelDato("actual").figs || []).map(({ universo, ...r }) => r) } };
  ok(guardC(MEDIDO, sinUni).verdict !== "comparacion-cruzada", "sin `universo` en la carpeta, los tres chequeos no corren (aditivos por construcción)");
}

console.log(`\n── _roce_universos_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
