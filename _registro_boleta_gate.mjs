/* === _registro_boleta_gate.mjs · EL REGISTRO EN LA BOLETA Y EN EL TEXTO VERBATIM DEL CAMINO VIGENTE ==========
 * La Poda Fase 2 · CIERRA EL HUECO POR EL QUE SE COLÓ EL DEFECTO MEDIDO EN PRODUCCIÓN (captura del owner
 * 2026-08-14): la pantalla dijo «Valparaíso · **Capital detenido** marca $25K», y CLAUDE.md §4 fija
 * **inmovilizado**, nunca «detenido».
 *
 * POR QUÉ NINGÚN GATE LO VIO, que es lo único que importa acá:
 *   · `_registro_gate.mjs` barre TEXTO EMITIDO (openers, sugerencias, líneas de la Mesa) y la narración viva
 *     lavada por `stripLanguageLeaks`. NO barre los LABELS DE LA BOLETA — y el respaldo determinístico del
 *     oráculo (`componerPorForma` → `_tabla`/`_enLinea`, narrationBlocks.js) imprime `f.label` VERBATIM. Un label
 *     no es "texto emitido" hasta que el narrador se cae; ese día lo es, y es lo único que se lee.
 *   · su `BANNED` tampoco incluía «detenido» ni «vara»: la primera está vetada por §4 como sinónimo de
 *     inmovilizado, la segunda desde el sello ejecutivo. Una lista que no las nombra no las puede cazar.
 *   · el barrido corre por `answerADIFromSpec` (el seam LEGADO). Las superficies del ORÁCULO —los labels que
 *     sella `toolRegistry`, los templates verbatim de `dialogueState`/`progressiveDisclosure`— no las tocaba
 *     nadie, y son el camino VIGENTE: el que respondió el turno de la captura.
 *
 * QUÉ CERTIFICA (5 frentes, todos sobre el camino VIGENTE):
 *   [1] LOS LABELS DE LA BOLETA · se ejecutan las tools reales del catálogo sobre una matriz de argumentos y se
 *       audita CADA fig: `label`, `context`, `formula` y `coverage.reason`. Los cuatro llegan a pantalla o al
 *       prompt como texto autorizado — el label directo por el respaldo, el resto vía narrador y evidencia.
 *   [2] LOS TEXTOS VERBATIM · `composeExhaustedMechanismAcceptance` (bypass de mecanismo agotado) y
 *       `composeProsaEjecutiva` (reparación del veredicto tabla-no-autorizada) salen SIN pasar por el narrador.
 *   [3] EL GLOSARIO CURADO · `CONCEPT_DEFS` se imprime verbatim por la tool `defineConcept`, y `_registro_gate`
 *       solo mira `METRIC_DEFS`. La entrada `vara` es la ÚNICA excepción declarada (decisión frenada para el
 *       owner, ver `_INFORME_PODA_2B.md`) y se verifica que siga siendo la única: una excepción que crece en
 *       silencio deja de ser una excepción.
 *   [4] EL ESTÁTICO DEL CONCEPTO · `specRetrieval._ESTADO_LABEL` y el título del foco son la fuente de la que
 *       salen los labels; se leen del archivo para que un futuro editor no pueda reintroducir la palabra en el
 *       origen sin ponerse rojo, aunque la matriz de [1] no llegue a esa rama.
 *   [5] EL TURNO DE LA CAPTURA · reproducido exacto: el label de la bodega con su cifra, tal como se leyó.
 *
 * PURO Y OFFLINE · corre composers determinísticos y lee archivos. Cero red, cero proveedor, cero crédito: este
 * archivo no nombra ni importa nada del gateway, así que la suite lo clasifica offline sin necesitar escapes.
 *   npm run gates:offline   (NUNCA suelto, NUNCA `npm run gates`)
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { TOOLS } from "./src/adi/oracle/toolRegistry.js";
import { composeExhaustedMechanismAcceptance } from "./src/adi/oracle/dialogueState.js";
import { composeProsaEjecutiva } from "./src/adi/oracle/progressiveDisclosure.js";
import { buildClaims } from "./src/adi/oracle/narrationContract.js";
import { CONCEPT_DEFS } from "./src/adi/sentrix/glossary.js";
import { buildResumenEjecutivo } from "./src/adi/specRetrieval.js";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";

initTenant(TENANT_DEMO);
const ROOT = join(fileURLToPath(new URL(".", import.meta.url)));

/* ── EL VOCABULARIO ────────────────────────────────────────────────────────────────────────────────────────────
 * CLAUDE.md §4, textual: «Prohibidas en superficie: plata, vara, dormido, guita, palanca, apretar. Se dice
 * capital, benchmark. También: "inmovilizado", no "detenido".»
 * SE SUMAN LAS DOS QUE `_registro_gate.BANNED` no trae —«vara» y «detenido»— porque son exactamente las que se
 * colaron. Las formas van ENUMERADAS por género y número, nunca `\w*`: `detenid[oa]s?` caza detenido/a/os/as sin
 * tocar «detener»/«se detuvo», que es el VERBO sobre un SKU y es legítimo (H3 de la certificación amplia, y
 * `voiceGuard` documenta la misma frontera). `varas?` no toca «varado» por el `\b`. */
const VETADAS = /\b(plata|guita|palancas?|dormid[oa]s?|apr[ei]et\w*|varas?|detenid[oa]s?)\b/i;

/* ── EL VOSEO ───────────────────────────────────────────────────────────────────────────────────────────────────
 * El registro es «formal LatAm, sin chilenismos»: eso es tuteo neutro. Mismo criterio que `_registro_gate` —
 * formas INEQUÍVOCAS solamente, con tilde obligatoria donde la forma sin tilde es tuteo correcto («necesitas») o
 * tercera persona («hace», «pone»). Cierre por lookahead Unicode: `\b` es ASCII y no cierra tras vocal acentuada. */
const VOSEO = new RegExp(
  "\\b(?:quer[eé]s|pod[eé]s|ten[eé]s|dec[ií]s|ven[ií]s|prefer[ií]s|eleg[ií]s|segu[ií]s|perd[eé]s|sos|vos" +
  "|sabés|hacés|vendés|debés|necesitás|buscás|usás|dejás|encontrás|mostrás|pensás|llevás|liberás|priorizás" +
  "|hacé|tené|poné|andá|entregá|mirá|dejá|revisá|considerá|comenzá|probá|pensá|liquidá|priorizá|reponé" +
  ")(?![\\p{L}])", "iu");

let PASS = 0, FAIL = 0; const ROTOS = [];
const H = (t) => console.log("\n" + t);
const check = (origen, texto) => {
  if (typeof texto !== "string" || !texto.trim()) return;
  const m = texto.match(VETADAS) || texto.match(VOSEO);
  if (m) {
    FAIL++;
    const gist = texto.replace(/\s+/g, " ").slice(Math.max(0, m.index - 45), m.index + 45);
    ROTOS.push(`[${origen}] «${m[0]}» …${gist}…`);
    console.log(`  ✗ [${origen}] «${m[0]}» …${gist}…`);
  } else PASS++;
};
const ok = (cond, msg) => { if (cond) PASS++; else { FAIL++; ROTOS.push(msg); console.log("  ✗ " + msg); } };

/* ── EL BARRIDO DE `facts`, RECURSIVO ──────────────────────────────────────────────────────────────────────────
 * POR QUÉ RECURSIVO Y NO UNA LISTA DE CAMPOS. La primera versión de este gate auditaba los campos de `facts` que
 * yo sabía que se citan (`umbral_no_aplicado.declaracion`, la nota del otro estado…) — y por eso NO vio
 * `evidence.margin.title`, donde vivía «Margen · el costo aprieta»: un título que el panel de Sentrix pinta y que
 * el prompt recibe. Una lista escrita a mano solo caza lo que su autor ya sospechaba. `facts` ES el paquete que
 * viaja al narrador y a la evidencia, así que se barre ENTERO.
 * LAS CLAVES INTERNAS SE EXCLUYEN, y se declaran una por una: son identificadores de máquina (enums de estado, de
 * eje, de foco), no prosa. `capital_frenado`, `palancas` o `sku` son valores de ruteo — vetarlos obligaría a
 * renombrar el motor para cumplir una regla de vocabulario de PANTALLA, que es exactamente lo contrario de lo que
 * pide CLAUDE.md. `etiquetas` sale por el mismo motivo que en el glosario: es vocabulario de ENTRADA. */
const CLAVES_INTERNAS = new Set([
  "focus", "focusColor", "estado", "detector", "lens", "key", "slug", "operacion", "op", "kind", "action",
  "unit", "source", "campo", "campo_sumado", "operador", "dimension", "metrica", "entityType", "color",
  "tool", "etiquetas", "sello", "eje", "universo", "id", "sku", "bodega", "familia", "marca", "canal",
]);
function barrerFacts(tag, valor, ruta = "facts") {
  if (valor == null) return;
  if (typeof valor === "string") { check(`${tag} · ${ruta}`, valor); return; }
  if (Array.isArray(valor)) { valor.forEach((v, i) => barrerFacts(tag, v, `${ruta}[${i}]`)); return; }
  if (typeof valor !== "object") return;
  for (const [k, v] of Object.entries(valor)) {
    if (CLAVES_INTERNAS.has(k)) continue;
    barrerFacts(tag, v, `${ruta}.${k}`);
  }
}

/* ══ [1] LOS LABELS DE LA BOLETA ═══════════════════════════════════════════════════════════════════════════════
 * LA MATRIZ ES EL GATE. Un `label` solo existe cuando la rama que lo emite corre, así que se barren las tools de
 * lectura/diagnóstico/simulación con los argumentos que el planificador arma de verdad — y en particular TODOS
 * los focos de inventario, que es donde vive el concepto que se corrigió. Se auditan los CUATRO campos que
 * viajan: `label` (el que el respaldo imprime), `context` y `formula` (que entran al prompt como texto
 * autorizado y a la evidencia del panel) y `coverage.reason` (que es la respuesta cuando no hay dato). */
H("══ [1] LABELS · context · formula · coverage.reason de las tools VIGENTES ══");
const LLAMADAS = [
  // inventario · los 6 focos + los alcances que cambian de rama (el vacío con alcance declarado, el corte por días)
  ["inventoryStatus", { focus: "frenado" }], ["inventoryStatus", { focus: "quiebre" }],
  ["inventoryStatus", { focus: "sobrestock" }], ["inventoryStatus", { focus: "estado" }],
  ["inventoryStatus", { focus: "stale", staleDays: 90 }], ["inventoryStatus", { focus: "top_sellers" }],
  ["inventoryStatus", { focus: "mas_vendidos_mes" }],
  ["inventoryStatus", { focus: "frenado", filters: { bodega: "Valparaíso" } }],
  ["inventoryStatus", { focus: "frenado", filters: { bodega: "Concepción" } }],   // sin frenados → la otra rama
  ["inventoryStatus", { focus: "estado", filters: { familia: "Línea Blanca" } }],
  // diagnóstico y resumen · los focos comerciales + el de capital, que es el que trae el concepto
  ["diagnose", {}], ["diagnose", { filters: { marca: "Samsung" } }],
  ["executiveSummary", {}],
  // simulaciones · su `coverage.reason` es texto de pantalla cuando no hay nada que simular
  ["simulateCapital", {}], ["simulateCapital", { filters: { bodega: "Concepción" } }],
  ["simulateCarga", {}], ["simulateCosto", { pct: -3 }],
  // perfiles y fichas · de acá salen las figs de referencia con su `context`
  ["entityProfile", { dimension: "cliente", entity: "Falabella" }],
  ["entityProfile", { dimension: "cliente", entity: "Lider" }],
  ["entityComposicion", { dimension: "cliente", entity: "Falabella" }],
  ["entityRecord", { dimension: "sku", entity: "LG-DRYER8KG" }],
  ["entityRecord", { dimension: "cliente", entity: "Falabella" }],
  ["entityCapitalLigado", { dimension: "cliente", entity: "Falabella" }],
  ["clientesPorSku", { sku: "LG-DRYER8KG" }],
  // lecturas por eje
  // los 7 focos de margen: de acá sale `_MFOCUS_TITLE`, el título que el panel pinta (donde vivía «el costo aprieta»)
  ["marginRead", { dimension: "cliente", focus: "bajo_benchmark" }],
  ["marginRead", { dimension: "cliente", focus: "causa_costo" }], ["marginRead", { dimension: "cliente", focus: "causa_precio" }],
  ["marginRead", { dimension: "cliente", focus: "subir_precio" }], ["marginRead", { dimension: "cliente", focus: "palancas" }],
  ["marginRead", { dimension: "cliente", focus: "alto_volumen_bajo_margen" }], ["marginRead", { dimension: "cliente", focus: "alto_margen_subpenetrado" }],
  ["marginRead", { dimension: "sku", focus: "bajo_benchmark" }],
  ["salesRead", { dimension: "cliente" }], ["contributionRead", { dimension: "cliente" }],
  ["queryMetric", { metric: "capital", dimension: "bodega" }],
  ["gridTable", { dimension: "sku" }], ["tensionRead", { dimension: "cliente" }],
  ["compareEntities", { dimension: "cliente", entities: ["Falabella", "Lider"] }],
  ["trend", { metric: "ventas", dimension: "cliente", entity: "Falabella" }],
  // el glosario servido como tool — la definición sale VERBATIM
  ["defineConcept", { term: "benchmark" }], ["defineConcept", { term: "capital_inmovilizado" }],
  ["defineConcept", { term: "meta" }], ["defineConcept", { term: "brecha" }],
];
let figsVistas = 0;
for (const [nombre, args] of LLAMADAS) {
  const tool = TOOLS[nombre];
  if (!tool) { ok(false, `la tool «${nombre}» ya no existe en el catálogo — la matriz de este gate quedó vieja`); continue; }
  let r;
  try { r = tool({ scenario: "actual", ...args }); }
  catch (e) { ok(false, `${nombre}(${JSON.stringify(args)}) LANZÓ: ${String(e && e.message).slice(0, 90)}`); continue; }
  if (!r) { ok(false, `${nombre}(${JSON.stringify(args)}) devolvió null`); continue; }
  const tag = `${nombre}·${JSON.stringify(args).slice(0, 42)}`;
  for (const f of (r.boleta || [])) {
    figsVistas++;
    check(`${tag} · label`, f && f.label);
    check(`${tag} · context`, f && f.context);
    check(`${tag} · formula`, f && f.formula);
  }
  if (r.coverage && r.coverage.reason) check(`${tag} · coverage.reason`, r.coverage.reason);
  barrerFacts(tag, r.facts);
}
ok(figsVistas >= 200, `la matriz tiene que ejercitar una boleta de verdad — se auditaron ${figsVistas} figs (mínimo 200; si bajó, alguna tool dejó de devolver dato y este gate se volvió decorativo)`);
console.log(`  · ${figsVistas} figs auditadas sobre ${LLAMADAS.length} llamadas`);

/* ══ [2] LOS TEXTOS VERBATIM DEL CAMINO VIGENTE ════════════════════════════════════════════════════════════════
 * Los dos salen a pantalla SIN narrador: el bypass de mecanismo agotado devuelve su string tal cual, y la prosa
 * ejecutiva es la reparación determinística del veredicto `tabla-no-autorizada`. Ningún prompt los gobierna. */
H("══ [2] TEXTOS VERBATIM · bypass de mecanismo agotado · prosa ejecutiva de reparación ══");
for (const mech of ["capital", "costo", "carga", null]) {
  check(`mecanismo agotado · ${mech || "sin mecanismo"}`, composeExhaustedMechanismAcceptance({ tool: null, mechanismExhausted: true, mechanism: mech, entidad: "Falabella" }));
}
// la prosa se compone desde CLAIMS, y los claims salen de labels de boleta: se la alimenta con la boleta REAL del
// perfil (el caso vivo) y con una boleta de capital que trae el concepto — que es la rama que interpola la métrica.
{
  const perfil = TOOLS.entityProfile({ dimension: "cliente", entity: "Falabella", scenario: "actual" });
  check("prosa ejecutiva · perfil real", composeProsaEjecutiva(buildClaims(perfil.boleta || []), { entidad: "Falabella" }));
  // LA INTERPOLACIÓN ES EL RIESGO, no el literal: `composeProsaEjecutiva` mete `palanca.metrica` CRUDA en la
  // frase de la causa. Se le pasa a propósito una boleta con la etiqueta VIEJA —la que el camino legado sigue
  // emitiendo— para verificar que el lavado de salida la neutraliza igual. Si alguien saca ese lavado, esto cae.
  const conEtiquetaVieja = [
    { label: "Falabella · Ventas", value: "$18.5M", unit: "money", raw: 18500000 },
    { label: "Capital detenido · subtotal", value: "$33K", unit: "money", raw: 33200 },
  ];
  check("prosa ejecutiva · métrica interpolada con etiqueta vieja", composeProsaEjecutiva(buildClaims(conEtiquetaVieja), { entidad: "Falabella" }));
}

/* ══ [3] EL GLOSARIO CURADO ════════════════════════════════════════════════════════════════════════════════════
 * `CONCEPT_DEFS` se imprime VERBATIM por la tool `defineConcept`. `_registro_gate` solo barre `METRIC_DEFS`, así
 * que este diccionario nunca tuvo candado — y ahí vivía «más plata» en el `distingue` de `meta`. */
H("══ [3] GLOSARIO · definiciones curadas que se imprimen verbatim ══");
// LA ÚNICA EXCEPCIÓN, NOMBRADA. El concepto `vara` usa la palabra en su propia definición porque su trabajo es
// definir la palabra que el USUARIO dijo. Renombrarlo es decisión de producto y está frenada para el owner (ver
// `_INFORME_PODA_2B.md`). Se declara acá, no se disimula — y se verifica que sea la única.
const EXCEPCION_DECLARADA = new Set(["vara"]);
// `etiquetas` QUEDA FUERA DEL BARRIDO, y no es un olvido: son el vocabulario de ENTRADA con el que el usuario
// nombra el concepto («capital detenido», «capital frenado», «vara declarada»). La regla del owner es sobre lo que
// ADI DICE, nunca sobre lo que ENTIENDE — barrerlas dejaría al glosario sordo justo a las palabras que la gente
// escribe. Se auditan `aka` (el nombre que se muestra), `def` y `distingue` (el texto que se imprime).
const conVetada = [];
for (const [slug, c] of Object.entries(CONCEPT_DEFS)) {
  const texto = [c.aka, c.def, c.distingue].filter(Boolean).join(" · ");
  const sucio = VETADAS.test(texto) || VOSEO.test(texto);
  if (sucio) conVetada.push(slug);
  if (EXCEPCION_DECLARADA.has(slug)) continue;   // se audita aparte, abajo
  check(`glosario · ${slug}`, texto);
}
ok(conVetada.every((s) => EXCEPCION_DECLARADA.has(s)),
  `conceptos del glosario con palabra vetada FUERA de la excepción declarada: ${conVetada.filter((s) => !EXCEPCION_DECLARADA.has(s)).join(", ")}`);
// la excepción tiene que seguir SIENDO una excepción: si el owner la resuelve, este check avisa que ya se puede
// sacar de la lista; si alguien suma una entrada sucia nueva, cae el check de arriba.
ok(EXCEPCION_DECLARADA.size === 1 && CONCEPT_DEFS.vara,
  `la excepción declarada dejó de ser exactamente una (o el concepto 'vara' desapareció): revisá EXCEPCION_DECLARADA`);
console.log(`  · ${Object.keys(CONCEPT_DEFS).length} conceptos · 1 excepción declarada (vara, frenada para el owner)`);

/* ══ [3b] LA APERTURA DE LA MESA DE CONTROL ════════════════════════════════════════════════════════════════════
 * `buildResumenEjecutivo` NO es del camino legado: lo consume `SentrixPanel.jsx` y su `lectura` + `focos[].label`
 * son la primera línea que se lee al abrir el panel — la superficie más visible del producto. `_registro_gate` ya
 * la barre, pero contra su `BANNED`, que no incluye «detenido» ni «vara»; por eso «$33K de capital detenido en 3
 * SKU» pasaba en verde. Se audita en los tres escenarios porque el texto nombra entidades del dato. */
H("══ [3b] MESA DE CONTROL · la lectura y los focos de apertura ══");
for (const sc of ["actual", "bonanza", "tension", "crisis"]) {
  const res = buildResumenEjecutivo(sc);
  check(`mesa · lectura (${sc})`, res && res.lectura);
  for (const f of ((res && res.focos) || [])) { check(`mesa · foco label (${sc})`, f.label); check(`mesa · foco entidad (${sc})`, f.entidad); }
  for (const k of ((res && res.kpis) || [])) check(`mesa · kpi label (${sc})`, k.label);
}

/* ══ [4] EL ESTÁTICO DEL CONCEPTO ══════════════════════════════════════════════════════════════════════════════
 * La matriz de [1] ejercita las ramas que hoy existen. Esto ata el ORIGEN: el diccionario del que salen todos los
 * labels de inventario. Un editor futuro que reintroduzca la palabra acá se pone rojo aunque su rama no corra. */
H("══ [4] ESTÁTICO · la fuente de los labels de inventario ══");
{
  const src = readFileSync(join(ROOT, "src", "adi", "specRetrieval.js"), "utf8");
  const mEstado = src.match(/const\s+_ESTADO_LABEL\s*=\s*\{[^}]*\}/);
  ok(!!mEstado, "no se encontró `_ESTADO_LABEL` en specRetrieval.js — el gate perdió su ancla, arreglalo antes de seguir");
  if (mEstado) {
    ok(!VETADAS.test(mEstado[0]), `_ESTADO_LABEL trae una palabra vetada: ${mEstado[0].replace(/\s+/g, " ").slice(0, 160)}`);
    ok(/capital_frenado:\s*"capital inmovilizado"/.test(mEstado[0]), "`_ESTADO_LABEL.capital_frenado` dejó de ser \"capital inmovilizado\" — es EL label que llegó a la pantalla del owner");
  }
  const mFoco = src.match(/_diagFoco\("capital",\s*"([^"]+)"/);
  ok(!!mFoco && !VETADAS.test(mFoco[1]), `el título del foco de capital trae una palabra vetada: «${mFoco ? mFoco[1] : "(no encontrado)"}»`);
}

/* ══ [5] EL TURNO DE LA CAPTURA ════════════════════════════════════════════════════════════════════════════════
 * La fila exacta que el owner leyó en pantalla. No es redundante con [1]: [1] barre todo y podría quedar verde si
 * la rama de la bodega dejara de emitirse; esto exige que la fila SIGA EXISTIENDO y siga estando limpia. */
H("══ [5] EL TURNO DE LA CAPTURA · «Valparaíso · Capital detenido marca $25K» ══");
{
  const r = TOOLS.inventoryStatus({ focus: "frenado", scenario: "actual" });
  const fila = (r.boleta || []).find((f) => f && /^Valpara[ií]so · /.test(String(f.label || "")) && f.unit === "money");
  ok(!!fila, "la boleta de inventoryStatus(frenado) ya no trae la fila de Valparaíso — el caso de la captura dejó de ser reproducible por este gate");
  if (fila) {
    ok(!VETADAS.test(fila.label), `la fila de la captura sigue con palabra vetada: «${fila.label}»`);
    ok(/Capital inmovilizado/.test(fila.label), `la fila de la captura no dice «Capital inmovilizado»: «${fila.label}»`);
    ok(/^\$\d/.test(String(fila.value || "")), `la fila de la captura perdió su cifra: «${fila.value}» — corregir el registro no puede costar el dato`);
    console.log(`  · fila de la captura, hoy: «${fila.label} = ${fila.value}»`);
  }
}

console.log(`\n── _registro_boleta_gate: ${PASS} PASS · ${FAIL} FAIL ──`);
if (ROTOS.length) {
  console.log("✗ REGISTRO VETADO EN EL CAMINO VIGENTE:");
  ROTOS.forEach((r) => console.log("   " + r));
  console.log("\n   CLAUDE.md §4: prohibidas en superficie plata · vara · dormido · guita · palanca · apretar;");
  console.log("   se dice «capital», «benchmark» e «inmovilizado» (nunca «detenido»). Un label de boleta ES");
  console.log("   superficie: el respaldo determinístico lo imprime verbatim cuando el narrador no llega.");
}
process.exit(FAIL ? 1 : 0);
