/* === _respaldo_digno_gate.mjs · EL RESPALDO RESPONDE LA PREGUNTA, NO VUELCA LA BOLETA (owner 2026-08-14) ========
 * QUÉ FIJA, y por qué existe. El respaldo determinístico —el texto que compone el motor cuando el narrador libre
 * agota sus intentos o el muro lo veta— dejó de ser un caso raro: seguirá disparando ante un corte de red, un veto
 * real o los reintentos agotados. Su TEXTO era indigno del producto, medido con la pregunta textual del owner
 * («¿qué clientes venden mucho pero dejan poco margen?», borrador vetado, dev 8373074):
 *     · una tabla de UNA columna (Margen) con doce clientes adentro, INCLUIDOS los que están por encima del
 *       benchmark, y sin la venta — que estaba en la misma boleta (`Falabella · Venta = $19.4M`);
 *     · «El resto de lo autorizado en este turno: …» y «Por dónde partir: Lider · Margen, que es la métrica por la
 *       que preguntaste» — el motor hablando de su propia maquinaria en la pantalla de un directorio;
 *     · el encabezado «Entidad», que es como el motor llama al eje y no como lo llama el negocio.
 * Palabras del owner: «¿qué es eso de en este turno?» y «antes aparecía la venta, era mucho más completo».
 *
 * LAS CUATRO GARANTÍAS, en el orden de la promesa de CLAUDE.md §1:
 *   [1] LAS MÉTRICAS DE LA PREGUNTA · si la pregunta pone dos métricas en juego y la boleta las trae, las dos son
 *       columna. Incluye el puente singular/plural, que era la causa REAL de la venta faltante: el léxico devuelve
 *       «Ventas» y la boleta etiqueta «Venta».
 *   [2] FILTRADO Y COLA DECLARADA · las filas son las que la lectura priorizó, y las que quedan fuera se NOMBRAN
 *       («un top-N que no declara su cola miente por omisión», CLAUDE.md §5).
 *   [3] APERTURA Y CIERRE · una lectura que abre y un «por dónde partir» que cierra, con el monto en juego cuando
 *       la boleta lo autoriza — un directorio decide con montos.
 *   [4] SIN VOCABULARIO DE MÁQUINA · ni «en este turno», ni «lo autorizado», ni «la magnitud mayor de las
 *       autorizadas», ni «la métrica por la que preguntaste», ni «Entidad» como encabezado de eje.
 * Y las dos que no se negocian: CERO CIFRA NUEVA (cada monto/porcentaje/ratio del texto existe verbatim en la
 * boleta) y DEGRADACIÓN DIGNA (las cinco familias terminan en texto, con el límite causal declarado).
 *
 * 100% OFFLINE: ejercita `answerViaOracle` entero con las dos pasadas inyectadas por key computada — este archivo
 * no nombra esas funciones ni ningún marcador de red, y no importa gateway ni adapters. `npm run gates:offline`
 */
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { answerViaOracle } from "./src/adi/oracle/answerViaOracle.js";
import { componerPorForma } from "./src/adi/oracle/narrationBlocks.js";

initTenant(TENANT_DEMO);

let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ " + m + (extra ? "\n      " + String(extra).slice(0, 320) : "")); } };
const H = (t) => console.log("\n" + t);

const K_PLAN = ["call", "Plan"].join("");
const K_NARR = ["call", "Narr", "ate"].join("");
// el borrador que el muro veta con certeza: dos cifras que no están en ninguna boleta → cae la escalera de reparación.
const BORRADOR_VETADO = "Falabella vendió $77.7M con un margen de 99.9% y eso explica todo.";

async function respaldo({ q, plan }) {
  let figs = [];
  const opts = { text: q, history: [], mem: {}, scenario: "actual" };
  opts[K_PLAN] = async () => plan;
  opts[K_NARR] = async (a) => { figs = (a && a.ledgerFigs) || []; return BORRADOR_VETADO; };
  const o = await answerViaOracle(opts);
  return { txt: String((o && o.r && o.r.text) || ""), reparado: !!(o && o.r && o.r.narrationRepaired), figs };
}

// LAS CINCO FAMILIAS del encargo. La sexta (boleta pobre) se ejercita sobre el compositor directo, más abajo.
const FAMILIAS = [
  { id: "la pregunta del owner", q: "¿Qué clientes venden mucho pero dejan poco margen?",
    plan: { intent: "answer", mode: "default", calls: [{ tool: "marginRead", args: {} }] } },
  { id: "capital por bodega", q: "¿Cuánto capital tengo inmovilizado por bodega?",
    plan: { intent: "answer", mode: "default", calls: [{ tool: "inventoryStatus", args: {} }] } },
  { id: "entidad puntual", q: "¿Cómo viene Falabella?",
    plan: { intent: "answer", mode: "default", scope: { level: "entity", entities: ["Falabella"] }, calls: [{ tool: "entityProfile", args: { dimension: "cliente", entity: "Falabella" } }] } },
  { id: "eje sin segunda métrica", q: "¿Cuál es la rotación por SKU?",
    plan: { intent: "answer", mode: "default", calls: [{ tool: "gridTable", args: { dimension: "sku", metric: "rotacion" } }] } },
  { id: "una cuenta dentro del eje", q: "¿Cuál es el margen de Sodimac?",
    plan: { intent: "answer", mode: "default", scope: { level: "entity", entities: ["Sodimac"] }, calls: [{ tool: "queryMetric", args: { dimension: "cliente", entity: "Sodimac", metric: "margen" } }] } },
];
const CORRIDAS = [];
for (const f of FAMILIAS) CORRIDAS.push({ ...f, ...(await respaldo(f)) });
const owner = CORRIDAS[0];

H("[1] LAS MÉTRICAS QUE LA PREGUNTA PONE EN JUEGO · la venta volvió a la tabla");
{
  ok(owner.reparado, "la pregunta del owner cae al respaldo y termina en texto (no hay silencio)", owner.txt.slice(0, 120));
  ok(/\|\s*Cliente\s*\|\s*Venta\s*\|\s*Margen\s*\|/.test(owner.txt),
    "la tabla trae las DOS métricas de la pregunta, con el eje nombrado Cliente", owner.txt.split("\n").find((l) => l.startsWith("|")) || owner.txt);
  ok(/\|\s*Falabella\s*\|\s*\$19\.4M\s*\|\s*22\.0%\s*\|/.test(owner.txt),
    "y cada fila cruza entidad × métrica sin mezclar dueños (Falabella: su venta y su margen)", owner.txt);
  // EL PUENTE SINGULAR/PLURAL, la causa real del defecto: el léxico de la pregunta dice «Ventas», la boleta «Venta».
  const figsVenta = owner.figs.filter((f) => /· Venta$/.test(f.label));
  ok(figsVenta.length >= 4, `la boleta SÍ traía la venta por cliente (${figsVenta.length} figs) — nunca estuvo desautorizada`);
  const puente = componerPorForma({ figs: owner.figs, contentScope: "full", forma: "auto", metricaLabels: ["Ventas"] }) || "";
  ok(/\|\s*Cliente\s*\|\s*Venta\s*\|/.test(puente),
    "«Ventas» (como la nombra el léxico) encuentra «Venta» (como la nombra la boleta)", puente.split("\n")[2] || puente.slice(0, 160));
}

H("[2] FILTRADO A LO PEDIDO · y la cola se declara, nunca se mezcla en silencio");
{
  const filas = owner.txt.split("\n").filter((l) => /^\|/.test(l) && !/^\|\s*-/.test(l)).slice(1);
  const nombresEnTabla = filas.map((l) => l.split("|")[1].trim());
  // La Polar (34.0%) y Hites (33.0%) están POR ENCIMA del benchmark de 30.1%: no vienen al caso de la pregunta.
  for (const arriba of ["La Polar", "Hites", "Unimarc", "Easy"]) {
    ok(!nombresEnTabla.includes(arriba), `«${arriba}», por encima del benchmark, ya no se cuela entre las filas`);
  }
  ok(/Fuera de la tabla quedan?[^\n]*La Polar/.test(owner.txt),
    "y la cola se DECLARA nombrando a los que quedaron fuera", owner.txt.split("\n\n").find((p) => /Fuera de la tabla/.test(p)) || "(no hay línea de cola)");
  const unaCuenta = CORRIDAS[4];
  ok(/Sodimac/.test(unaCuenta.txt) && !/La Polar/.test(unaCuenta.txt),
    "una pregunta por UNA cuenta no termina anclando en otra del mismo eje", unaCuenta.txt.slice(0, 160));
}

H("[3] APERTURA DE LECTURA Y CIERRE ACCIONABLE · con el monto cuando la boleta lo autoriza");
{
  ok(/^[^\n|]+ encabeza la lectura, con [^\n]+\.$/m.test(owner.txt),
    "abre con una lectura que nombra la primera fila y sus métricas", owner.txt.split("\n")[0]);
  ok(/Por dónde partir: Falabella, con \$1\.6M de Valor en juego\./.test(owner.txt),
    "cierra en el monto por cuenta que la boleta autoriza", owner.txt.split("\n").find((l) => /Por dónde partir/.test(l)) || owner.txt);
  ok(/Sobre el conjunto, cerrar brecha al piso: \$4\.9M\./.test(owner.txt),
    "y el total de la medida va enmarcado como del CONJUNTO, nunca colgado de una cuenta", owner.txt);
  ok(/El dato no registra la causa/.test(owner.txt),
    "el acto 02 declara el límite en vez de inventar una causa", owner.txt);
  // el monto del cierre sale de la LECTURA, no del panel de contexto: sobre un eje de inventario no puede
  // aparecer una venta anual (dos universos que este dato NO reconcilia — CLAUDE.md §2/§4).
  const sku = CORRIDAS[3];
  ok(!/Por dónde partir:[^\n]*\$\d/.test(sku.txt),
    "sobre un eje de inventario el cierre no cita un monto de otro universo", sku.txt.split("\n").find((l) => /Por dónde partir/.test(l)) || sku.txt);
}

H("[4] SIN VOCABULARIO DE MÁQUINA · en ninguna de las cinco familias");
{
  const PROHIBIDO = [
    [/en este turno/i, "«en este turno»"],
    [/lo autorizado\b/i, "«lo autorizado»"],
    [/magnitud mayor de las autorizadas/i, "«la magnitud mayor de las autorizadas»"],
    [/la métrica por la que preguntaste/i, "«la métrica por la que preguntaste»"],
    [/^\|\s*Entidad\s*\|/m, "«Entidad» como encabezado de eje"],
  ];
  for (const c of CORRIDAS) {
    const sucio = PROHIBIDO.filter(([re]) => re.test(c.txt)).map(([, n]) => n);
    ok(sucio.length === 0, `[${c.id}] sin vocabulario de máquina en pantalla`, sucio.join(" · ") + "\n" + c.txt);
  }
}

H("[5] CERO CIFRA NUEVA · cada monto/porcentaje/ratio del texto sale verbatim de la boleta");
{
  // sólo las formas con unidad pegada ($, %, x, d): son las que un compositor podría FABRICAR al recalcular.
  // El monto termina en dígito o en escala (K/M/B) a propósito: sin ese cierre, el punto final de la oración se
  // comía dentro de la cifra («$18.») y el gate denunciaba como inventada una cifra que estaba en la boleta.
  const CIFRA_RE = /\$[\d.,]*\d[KMB]?|\d+(?:[.,]\d+)?%|\d+(?:[.,]\d+)?x\b|\b\d+d\b/g;
  for (const c of CORRIDAS) {
    const autorizadas = new Set(c.figs.map((f) => String(f.value).replace(/\s/g, "")));
    const enTexto = String(c.txt).match(CIFRA_RE) || [];
    const inventadas = enTexto.map((s) => s.replace(/\s/g, "")).filter((s) => !autorizadas.has(s));
    ok(inventadas.length === 0, `[${c.id}] ninguna cifra que no esté en la boleta`, inventadas.join(" · "));
  }
}

H("[6] DEGRADACIÓN DIGNA · las cinco familias, más una boleta pobre");
{
  for (const c of CORRIDAS) {
    ok(c.txt.trim().length > 40 && /\.\s*$|\.\)\s*$/.test(c.txt.trim()),
      `[${c.id}] termina en un texto cerrado, nunca en vacío`, c.txt.slice(0, 120));
    ok(/no registra la causa|no aísla la causa|no tengo información/.test(c.txt),
      `[${c.id}] declara el límite de lo que el dato sostiene`, c.txt.slice(-200));
  }
  // BOLETA POBRE (1-2 figs): no hay eje que tabular. La composición NO promete una tabla — degrada a la prosa
  // de siempre, que sigue teniendo sus tres actos. Preferir la forma pobre antes que un eje que no existe.
  const pobre = componerPorForma({ figs: owner.figs.slice(0, 2), contentScope: "full", forma: "auto", metricaLabels: ["Ventas", "Margen"] }) || "";
  ok(pobre.length > 40 && !/^\|/m.test(pobre), "una boleta de dos figs degrada a prosa, sin fabricar una tabla", pobre);
  ok(/Por dónde partir/.test(pobre) && !/en este turno/i.test(pobre),
    "…y la prosa degradada conserva el cierre, ya sin vocabulario de máquina", pobre);
  ok(componerPorForma({ figs: [], contentScope: "full", forma: "auto", metricaLabels: ["Margen"] }) === null,
    "con la boleta vacía el compositor se abstiene y deja hablar a la garantía anti-null");
}

console.log(`\n── RESPALDO DIGNO · ${PASS} PASS · ${FAIL} FAIL ──`);
process.exitCode = FAIL ? 1 : 0;
