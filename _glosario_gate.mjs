/* === _glosario_gate.mjs · GLOSARIO Y CONCEPTOS (owner 2026-08-09 · decisión 10 · hallazgo K) =====================
 *
 * EL DEFECTO QUE CIERRA. 30 de 39 etiquetas visibles de Sentrix declinaban cuando el usuario preguntaba qué eran
 * —incluidas «Acciones comerciales» y «Días de inventario», las dos que el owner renombró—. Y peor que declinar:
 * "margen bruto" devolvía, VERBATIM, la definición del margen de CONTRIBUCIÓN. Son dos conceptos distintos y el
 * glosario contestaba el equivocado con cara de certeza.
 *
 * QUÉ CERTIFICA, en el orden en que importa:
 *   [1] MARGEN BRUTO ≠ MARGEN DE CONTRIBUCIÓN   dos entradas, dos definiciones, cada una nombrando a la otra.
 *   [2] LAS ETIQUETAS DEL OWNER                 las de la decisión 10, una por una, con la definición correcta.
 *   [3] CERO HUÉRFANAS, DERIVADO                ninguna métrica del registro, comparación, kind de universo,
 *                                               sello o etiqueta del manifiesto queda sin respuesta — y la
 *                                               cobertura se DERIVA de esos contratos, no de una lista de acá.
 *   [4] NULL HONESTO                            lo que no está declarado devuelve null; no se inventa vecino.
 *   [5] LA TOOL                                 `defineConcept` del oráculo entrega la MISMA verdad, con `fuente`.
 *   [6] NO CONTAMINACIÓN DEL RUTEO              matchConcept no se roba preguntas que son lecturas, no definiciones.
 *
 * Puro/offline: importa módulos determinísticos del motor y compara strings. Cero crédito.
 *   node _glosario_gate.mjs
 */
import {
  CONCEPT_DEFS, METRIC_DEFS, CONCEPT_MATCHERS,
  matchConcept, conceptForLabel, resolveGlossary, vocabularioSinConcepto, etiquetasConocidas,
} from "./src/adi/sentrix/glossary.js";
import { VIEW_MANIFEST } from "./src/adi/sentrix/viewManifest.js";
import { METRICS } from "./src/config/contract/metricRegistry.js";
import { runPlan } from "./src/adi/oracle/toolRunner.js";

let pass = 0, fail = 0; const rotos = [];
const ok = (nombre, cond, detalle = "") => { if (cond) pass++; else { fail++; rotos.push(`${nombre}${detalle ? ` → ${detalle}` : ""}`); } };

// ── [1] MARGEN BRUTO ≠ MARGEN DE CONTRIBUCIÓN ────────────────────────────────────────────────────────────────
const bruto = resolveGlossary("margen bruto");
const contrib = resolveGlossary("margen de contribución");
ok("[1] «margen bruto» resuelve", !!bruto, JSON.stringify(bruto));
ok("[1] «margen de contribución» resuelve", !!contrib);
ok("[1] son slugs DISTINTOS", bruto && contrib && bruto.slug !== contrib.slug, `${bruto && bruto.slug} vs ${contrib && contrib.slug}`);
ok("[1] son definiciones DISTINTAS (el bug era verbatim la misma)", bruto && contrib && bruto.def !== contrib.def);
ok("[1] el bruto NO se define por la contribución", bruto && !/se convierte en contribuci/i.test(bruto.def));
ok("[1] el bruto se distingue nombrando al de contribución", bruto && /margen de contribuci/i.test(bruto.distingue || ""));
ok("[1] el de contribución se distingue nombrando al bruto", contrib && /margen bruto/i.test(contrib.distingue || ""));
ok("[1] «Margen bruto» (etiqueta del P&L, con mayúscula) resuelve al bruto", conceptForLabel("Margen bruto") === "margen_bruto");
ok("[1] matchConcept en frase libre no cae al de contribución", matchConcept("¿qué es el margen bruto?") === "margen_bruto");
ok("[1] matchConcept('cuál es mi margen') sigue siendo el de contribución", matchConcept("cuál es mi margen") === "margen");

// ── [2] LAS ETIQUETAS QUE EL OWNER NOMBRÓ (decisión 10) ──────────────────────────────────────────────────────
// [etiqueta tal como se escribe, slug esperado]. La lista es la DECISIÓN del owner, no la cobertura: la cobertura
// se mide en [3] contra los contratos.
const PEDIDAS = [
  ["acciones comerciales", "acciones"], ["Acciones comerciales", "acciones"],
  ["carga comercial", "carga"], ["Carga comercial", "carga"],
  ["días de inventario", "doh"], ["Días inv.", "doh"], ["cobertura", "doh"], ["DOH", "doh"],
  ["probado", "probado"], ["indicado", "indicado"], ["abierto", "abierto"],
  ["universo", "universo"], ["brecha", "brecha"],
  ["en juego", "en_juego"], ["En juego $", "en_juego"],
  ["grupo 80", "grupo80"], ["la cola", "cola"], ["vara", "vara"],
  ["riesgo de quiebre", "riesgo_quiebre"], ["Riesgo de quiebre", "riesgo_quiebre"],
  ["sobrestock", "sobrestock"],
  ["capital inmovilizado", "capital_inmovilizado"], ["Capital inmovilizado", "capital_inmovilizado"], ["Inmovilizado", "capital_inmovilizado"],
];
for (const [etiqueta, esperado] of PEDIDAS) {
  const r = resolveGlossary(etiqueta);
  ok(`[2] «${etiqueta}» → ${esperado}`, r && r.slug === esperado, r ? `dio ${r.slug}` : "null");
  ok(`[2] «${etiqueta}» trae definición no vacía`, r && typeof r.def === "string" && r.def.length > 40);
}
// las dos que el owner renombró NO pueden contestar con el nombre viejo como si fuera el actual
ok("[2] «acciones comerciales» habla de MONTO y remite a la carga como la tasa",
  /monto|dinero/i.test(resolveGlossary("acciones comerciales").def + resolveGlossary("acciones comerciales").distingue));
ok("[2] «carga comercial» declara que es la TASA (%)", /%/.test(resolveGlossary("carga comercial").def));
ok("[2] «días de inventario» declara cómo se llama en pantalla", /Días de inventario/i.test(resolveGlossary("días de inventario").def));
// EL CANDADO DE VOCABULARIO (owner 2026-08-09, `_mesa_capital_gate` barrido 15) Y LA COBERTURA DEL SINÓNIMO SON
// DOS COSAS DISTINTAS, y las dos tienen que valer a la vez: el sinónimo viejo se ENTIENDE (el usuario lo escribe)
// pero no se EMITE (en el producto la métrica tiene un solo nombre). Cubrirlo emitiéndolo sería romper el candado;
// declinarlo sería el hallazgo K otra vez.
const _VETADA = /cobertura/i;
{
  const r = resolveGlossary("cobertura");
  ok("[2] el sinónimo viejo se ENTIENDE (resuelve a días de inventario)", r && r.slug === "doh", r ? r.slug : "null");
  ok("[2] y la respuesta NO lo emite: contesta con el nombre del producto",
    r && !_VETADA.test(`${r.aka} ${r.def} ${r.distingue || ""}`), r && r.distingue);
  ok("[2] la respuesta nombra «días de inventario»", r && /días de inventario/i.test(`${r.aka} ${r.def}`));
}
for (const [slug, c] of Object.entries(CONCEPT_DEFS))
  ok(`[2] candado de vocabulario · ${slug} no emite el sinónimo retirado`, !_VETADA.test(`${c.aka} ${c.def} ${c.distingue || ""}`), c.def);
// y tampoco puede colarse por la puerta de atrás: la respuesta DERIVADA del manifiesto (fuente "componente")
// compone texto de otro archivo, que el candado no barre.
for (const m of Object.values(VIEW_MANIFEST)) {
  const r = m.label && resolveGlossary(m.label);
  if (r && r.fuente === "componente") ok(`[2] candado · la respuesta derivada de «${m.label}» no emite el sinónimo`, !_VETADA.test(r.def), r.def);
}

// ── [3] CERO HUÉRFANAS · la cobertura se DERIVA de los contratos ─────────────────────────────────────────────
const huerfanas = vocabularioSinConcepto();
ok("[3] toda métrica de metricRegistry tiene concepto (identidad de llave)", huerfanas.metricas.length === 0, huerfanas.metricas.join(", "));
ok("[3] toda etiqueta de columna del registro de métricas responde", huerfanas.etiquetasRegistro.length === 0, huerfanas.etiquetasRegistro.join(" | "));
ok("[3] toda COMPARACIÓN del manifiesto responde", huerfanas.comparaciones.length === 0, huerfanas.comparaciones.join(", "));
ok("[3] todo kind de UNIVERSO del manifiesto responde", huerfanas.universos.length === 0, huerfanas.universos.join(", "));
ok("[3] todo SELLO del contrato de cifras responde", huerfanas.sellos.length === 0, huerfanas.sellos.join(", "));
ok("[3] toda etiqueta de componente del manifiesto responde", huerfanas.etiquetasManifiesto.length === 0, huerfanas.etiquetasManifiesto.join(" | "));
ok("[3] toda entrada del «i» de las cards responde", huerfanas.etiquetasMetricDefs.length === 0, huerfanas.etiquetasMetricDefs.join(" | "));

// LA PRUEBA DE QUE ES DERIVADO Y NO UNA LISTA: un componente NUEVO, inventado acá y nunca escrito en el glosario,
// tiene que resolver por la métrica que declara. Si mañana alguien suma una pieza al manifiesto, nace con respuesta.
const nuevo = { vista: "comercial", seccion: "01", tipo: "kpi", label: "Una pieza que nadie escribió en el glosario", metrica: "acciones", eje: "cliente", periodo: "año cerrado", universo: { kind: "negocio", label: "el negocio completo" } };
VIEW_MANIFEST["comercial/01/_gate_pieza_nueva"] = nuevo;
{
  const mod = await import(`./src/adi/sentrix/glossary.js?nueva=${Date.now()}`);
  const r = mod.resolveGlossary("Una pieza que nadie escribió en el glosario");
  ok("[3] una pieza NUEVA del manifiesto nace con concepto (por su métrica)", r && r.slug === "acciones", r ? `dio ${r.slug}` : "null");
  const sin = mod.vocabularioSinConcepto();
  ok("[3] y por lo tanto no aparece como huérfana", !sin.etiquetasManifiesto.includes(nuevo.label));
}
// y una pieza SIN métrica igual responde con lo que el manifiesto declara de ella (nunca null, nunca inventado)
{
  VIEW_MANIFEST["comercial/01/_gate_pieza_sin_metrica"] = { ...nuevo, label: "Pieza sin métrica declarada", metrica: null };
  const mod = await import(`./src/adi/sentrix/glossary.js?sinmet=${Date.now()}`);
  const r = mod.resolveGlossary("Pieza sin métrica declarada");
  ok("[3] una pieza SIN métrica responde desde el manifiesto", r && r.fuente === "componente", r ? r.fuente : "null");
  ok("[3] y esa respuesta no trae ninguna cifra", r && !/\d/.test(r.def), r && r.def);
}
delete VIEW_MANIFEST["comercial/01/_gate_pieza_nueva"];
delete VIEW_MANIFEST["comercial/01/_gate_pieza_sin_metrica"];

// ── [4] NULL HONESTO ─────────────────────────────────────────────────────────────────────────────────────────
for (const t of ["ebitda", "churn", "NPS", "la tasa de conversión", "flete internacional", "", "   ", null, undefined, 42]) {
  ok(`[4] «${String(t)}» → null honesto`, resolveGlossary(t) === null, JSON.stringify(resolveGlossary(t)));
}
ok("[4] conceptForLabel de una etiqueta inexistente → null", conceptForLabel("Columna que no existe") === null);
// null honesto NO significa "declina cualquier cosa rara": una etiqueta que SÍ está, con otra caja y otro acento,
// resuelve igual (ese era el otro modo de fallar: la etiqueta existe y el glosario no la reconoce).
ok("[4] «DIAS INV.» (mayúsculas, sin acento) resuelve igual", conceptForLabel("DIAS INV.") === "doh");
ok("[4] «El capital inmovilizado» (con artículo) resuelve igual", conceptForLabel("El capital inmovilizado") === "capital_inmovilizado");

// ── [5] LA TOOL DEL ORÁCULO ENTREGA LA MISMA VERDAD ──────────────────────────────────────────────────────────
const _tool = (concept) => runPlan({ intent: "define", calls: [{ tool: "defineConcept", args: { concept } }] }, { scenario: "actual" }).results[0];
{
  const r = _tool("margen bruto");
  ok("[5] defineConcept('margen bruto') soportado", r.coverage && r.coverage.supported === true);
  ok("[5] y devuelve la definición del BRUTO, no la de contribución", r.facts && r.facts.definicion === CONCEPT_DEFS.margen_bruto.def);
  ok("[5] declara la fuente de la respuesta", r.coverage.fuente === "concepto", r.coverage.fuente);
  ok("[5] sin boleta ni cifras (no es numérica)", Array.isArray(r.boleta) && r.boleta.length === 0);
}
for (const et of ["Acciones comerciales", "Días inv.", "capital inmovilizado", "En juego $", "probado", "universo"]) {
  const r = _tool(et);
  ok(`[5] defineConcept('${et}') responde`, r.coverage && r.coverage.supported === true, JSON.stringify(r.coverage));
  ok(`[5] defineConcept('${et}') sin cifras en la definición`, r.facts && !/\$\s?\d/.test(r.facts.definicion));
}
{
  const r = _tool("Ticket prom.");
  ok("[5] una etiqueta que sólo tiene «i» de card responde con fuente=metrica", r.coverage.supported === true && r.coverage.fuente === "metrica", JSON.stringify(r.coverage));
}
{
  const r = _tool("ebitda");
  ok("[5] defineConcept de algo no declarado DECLINA (no inventa)", r.coverage && r.coverage.supported === false);
  ok("[5] y la razón nombra el término pedido", /ebitda/i.test(r.coverage.reason || ""));
}

// ── [6] EL RUTEO NO SE CONTAMINA ─────────────────────────────────────────────────────────────────────────────
// matchConcept alimenta el detector de "esto es una definición" (coerceChain._defineIntent). Ampliar el glosario
// no puede convertir una LECTURA en una definición: los términos de uso corriente en una pregunta de negocio se
// quedan fuera de CONCEPT_MATCHERS a propósito y sólo resuelven como etiqueta EXACTA.
for (const q of [
  "¿cuánto vendí este año?",
  "mostrame el resultado por cliente",
  "¿qué clientes están bajo presupuesto?",
  "dame el estado de mi inventario",
  "¿cuántas unidades vendí?",
]) ok(`[6] «${q}» NO se lee como definición`, matchConcept(q) === null, `dio ${matchConcept(q)}`);
// y las que SÍ son definiciones siguen resolviendo (regresión del gate de naturalidad)
ok("[6] «contribución no capturada» sigue ganando a «contribución»", matchConcept("contribución no capturada") === "no_capturada");
ok("[6] «mi contribución total» sigue siendo contribucion", matchConcept("mi contribución total") === "contribucion");
ok("[6] «explicame qué es la carga comercial» sigue siendo carga", matchConcept("explicame qué es la carga comercial") === "carga");

// ── INTEGRIDAD DEL CATÁLOGO ──────────────────────────────────────────────────────────────────────────────────
for (const [slug, c] of Object.entries(CONCEPT_DEFS)) {
  ok(`catálogo · ${slug} tiene aka`, typeof c.aka === "string" && c.aka.length > 0);
  ok(`catálogo · ${slug} tiene def`, typeof c.def === "string" && c.def.length > 40);
  // sin cifras DEL DATO: nada con separador decimal/de miles ni sufijo K/M ni monto de dos dígitos para arriba.
  // «cada $1 vendido» sí se admite: es la unidad de cuenta con que se explica un porcentaje, no un dato del tenant.
  ok(`catálogo · ${slug} sin cifras del dato`, !/\b\d[\d.,]*\s*[KM]\b|\$\s?\d{2,}|\b\d+[.,]\d\b/.test(c.def + (c.distingue || "")), c.def);
  ok(`catálogo · ${slug} resuelve por su propio slug`, resolveGlossary(slug) !== null);
}
for (const [, slug] of CONCEPT_MATCHERS) ok(`matcher · ${slug} apunta a un concepto que existe`, !!CONCEPT_DEFS[slug]);
for (const [label, txt] of Object.entries(METRIC_DEFS)) ok(`«i» · ${label} tiene texto`, typeof txt === "string" && txt.length > 10);
// los slugs de métrica son, carácter por carácter, las llaves del registro: esa identidad es la que hace derivable
// el mapa etiqueta → concepto. Si alguien renombra un slug, esto cae acá y no en producción.
for (const k of Object.keys(METRICS)) ok(`identidad métrica↔concepto · ${k}`, !!CONCEPT_DEFS[k]);

console.log(`\nGLOSARIO · ${pass} PASS · ${fail} FAIL · ${etiquetasConocidas().length} etiquetas indexadas · ${Object.keys(CONCEPT_DEFS).length} conceptos`);
if (rotos.length) { console.log("\nROTOS:"); for (const r of rotos) console.log("  ✗ " + r); }
process.exit(fail ? 1 : 0);
