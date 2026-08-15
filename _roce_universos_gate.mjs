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

console.log("\n── 3 · RANKING SIN COLA ──");
const RANK7 = "Ranking de SKU por peor rotación: MAK-COMP-AIR 0.8x, LG-DRYER8KG 1.0x, BOS-SANDER 1.6x, PHI-IRON-PRO 2.4x, SAM-TV55 3.6x, MAK-SAW18V 5.2x, LG-AIR9000 5.8x.";
ok(V(RANK7) === "ranking-sin-cola", `un ranking de 7 sobre 13 que no dice dónde corta muere (${V(RANK7)})`);
ok(/7 de 13/.test(String((J(RANK7).violations[0] || {}).detail || "")), "…y la multa dice cuántos de cuántos");
ok(J(RANK7.replace("Ranking de SKU", "Ranking de SKU (top 7 de 13)")).ok, "…y declarando «top 7 de 13» pasa");
ok(J("Los SKU frenados son MAK-COMP-AIR, LG-DRYER8KG y BOS-SANDER: son los que el dato marca en estado 90d o 120d.").ok,
  "una respuesta FILTRADA no es un recorte — no anuncia orden y responde el conjunto completo de la pregunta");
ok(J("Ranking de SKU por peor rotación: MAK-COMP-AIR 0.8x y LG-DRYER8KG 1.0x.").ok,
  "nombrar 2 no dispara nada: hace falta un listado (3+) para que se lea como el universo entero");

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

console.log("\n── 4 · SIN UNIVERSOS DECLARADOS, EL MURO NO SE MUEVE ──");
{
  const sinUni = { ...CTX, datoProyectado: { figs: (cifrasDelDato("actual").figs || []).map(({ universo, ...r }) => r) } };
  ok(guardC(MEDIDO, sinUni).verdict !== "comparacion-cruzada", "sin `universo` en la carpeta, los tres chequeos no corren (aditivos por construcción)");
}

console.log(`\n── _roce_universos_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
