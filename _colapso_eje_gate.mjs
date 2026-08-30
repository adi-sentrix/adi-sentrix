/* === _colapso_eje_gate.mjs · EL EJE DE ESCENARIOS NO RESUCITA (colapso · owner 2026-08-07, ejecución 2026-08-30)
 *
 * LA PALABRA DEL OWNER, textual: «al final el escenario bonanza es el que usó la realidad de los datos, es
 * mantener ese y eliminar el concepto escenario. La lógica está bien, al final quedaremos con uno solo, la
 * realidad». O sea: el dato de `bonanza` ES la realidad; lo que muere es el CONCEPTO visible y multivaluado.
 * NO es cambiar el default a «actual» (eso cambiaría los datos que ve el usuario, no la etiqueta) y Simulate v2
 * QUEDA (el «¿qué pasa si…?» es una pregunta del usuario, no un escenario permanente — su sustrato es el mismo
 * motor de transforms, que sigue vivo).
 *
 * QUÉ VIGILA ESTE CANDADO, corte por corte (crece con el barrido):
 *   C1 · LA ELEGIBILIDAD ESTÁ MUERTA: nada en la app puede elegir un escenario — el selector borrado, su flag
 *        retirado, el estado de React reemplazado por una constante, y la base real declarada UNA vez.
 *   C2 · LAS RAMAS-POR-NOMBRE ESTÁN DESARMADAS: el guard SKU-margen×escenario y su flag no vuelven a nacer.
 *   C3 · EL CONTRATO SIN EL EJE: blockedWhen/escenarios-que-alteran-tasas retirados de la letra del contrato.
 *   C4 · LA SUPERFICIE NO DICE «escenario»: composers, mapa del agente y view-context hablan de la base real.
 *
 * MÉTODO (patrón _poda_anti_resurreccion_gate): lista explícita, DEFINICIÓN no mención (el scan corre sin
 * comentarios — la memoria del repo puede y debe seguir contando esta historia), sucesor vivo, ni un import
 * colgando, y el detector se prueba a sí mismo con fuentes sintéticas (sección 0) y carnadas (sección final).
 *
 * CERO RED · CERO LLM · CERO CRÉDITO: solo lee archivos del disco como texto. No importa módulos del producto.
 * `node --import ./scripts/offline-guard.mjs _colapso_eje_gate.mjs`
 */
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
let pass = 0, fail = 0;
const ok = (cond, label, detalle) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label}${detalle ? " — " + detalle : ""}`); }
};
const H = (t) => console.log(`\n── ${t} ──`);

/* ── helpers de la casa (copiados de _poda_anti_resurreccion_gate — capas distintas del mismo método) ──────────── */
function sinComentarios(src) {
  let out = "", i = 0, previoSignificativo = "";
  const n = src.length;
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (c === "/" && d === "/") { while (i < n && src[i] !== "\n") i++; continue; }
    if (c === "/" && d === "*") { i += 2; while (i < n && !(src[i] === "*" && src[i + 1] === "/")) i++; i += 2; continue; }
    if (c === '"' || c === "'" || c === "`") {
      const cierre = c; out += c; i++;
      while (i < n) {
        if (src[i] === "\\") { out += src.slice(i, i + 2); i += 2; continue; }
        out += src[i];
        if (src[i] === cierre) { i++; break; }
        i++;
      }
      previoSignificativo = cierre;
      continue;
    }
    if (c === "/" && !"))]}".includes(previoSignificativo) && !/[A-Za-z0-9_$]/.test(previoSignificativo)) {
      out += c; i++;
      let enClase = false;
      while (i < n) {
        if (src[i] === "\\") { out += src.slice(i, i + 2); i += 2; continue; }
        if (src[i] === "[") enClase = true;
        else if (src[i] === "]") enClase = false;
        else if (src[i] === "/" && !enClase) { out += src[i]; i++; break; }
        else if (src[i] === "\n") break;
        out += src[i]; i++;
      }
      previoSignificativo = "/";
      continue;
    }
    out += c;
    if (!/\s/.test(c)) previoSignificativo = c;
    i++;
  }
  return out;
}
const _esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function definicionesDe(nombre, codigo) {
  const N = _esc(nombre);
  const FORMAS = [
    [new RegExp(`\\b(?:export\\s+)?(?:async\\s+)?function\\s*\\*?\\s+${N}\\b`), "function"],
    [new RegExp(`\\b(?:export\\s+)?(?:const|let|var)\\s+${N}\\s*=`), "const/let/var"],
    [new RegExp(`\\b(?:export\\s+)?class\\s+${N}\\b`), "class"],
    [new RegExp(`\\bexport\\s*\\{[^}]*\\b${N}\\b[^}]*\\}`), "export {…}"],
    [new RegExp(`\\bexport\\s+default\\s+(?:async\\s+)?function\\s+${N}\\b`), "export default function"],
    [new RegExp(`\\b${N}\\s*:\\s*(?:async\\s+)?function\\b`), "propiedad : function"],
  ];
  return FORMAS.filter(([re]) => re.test(codigo)).map(([, q]) => q);
}
function importaciones(nombre, codigo) {
  const N = _esc(nombre);
  return new RegExp(`\\bimport\\s*\\{[^}]*\\b${N}\\b[^}]*\\}\\s*from`).test(codigo);
}
const NO_SE_BARRE = new Set(["node_modules", ".claude", ".git", "dist", "coverage", ".vercel"]);
function archivosDe(dir, ext, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) { if (!NO_SE_BARRE.has(e)) archivosDe(p, ext, acc); }
    else if (ext.some((x) => e.endsWith(x)) && !/\.tmp\d+\.|\.carnada\d+/.test(e)) acc.push(p);
  }
  return acc;
}
const FUENTES = [
  ...archivosDe(join(ROOT, "src"), [".js", ".jsx"]),
  ...archivosDe(join(ROOT, "api"), [".js", ".mjs"]),
];
const LEER = (p) => readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const CODIGO = new Map(FUENTES.map((p) => [p, sinComentarios(LEER(p))]));

/* ═══ 0 · EL DETECTOR SE PRUEBA A SÍ MISMO ════════════════════════════════════════════════════════════════════ */
H("0 · el detector distingue DEFINIR de MENCIONAR");
{
  ok(definicionesDe("Xq", sinComentarios("export const Xq = 1;")).length > 0, "detecta un export const");
  ok(definicionesDe("Xq", sinComentarios("export function Xq() {}")).length > 0, "detecta un export function");
  ok(definicionesDe("Xq", sinComentarios("// el viejo Xq era mejor\nconst otro = 2;")).length === 0,
    "NO se deja engañar por un comentario");
  ok(definicionesDe("Xq", sinComentarios("const s = \"Xq = historia\";")).length === 0,
    "NO se deja engañar por un string");
  ok(importaciones("Xq", "import { a, Xq } from \"./m.js\";"), "detecta un import colgando");
  ok(!importaciones("Xq", "// import { Xq } — ya no"), "y no lo inventa en un comentario");
}

/* ═══ C1 · LA ELEGIBILIDAD ESTÁ MUERTA ════════════════════════════════════════════════════════════════════════ */
H("C1 · nada en la app puede ELEGIR un escenario");
{
  ok(!existsSync(join(ROOT, "src/ui/ScenarioSelector.jsx")), "ScenarioSelector.jsx está borrado");
  for (const nombre of ["ScenarioSelector", "ADI_SCENARIO_SWITCHER_ENABLED"]) {
    const definidoEn = [], importadoEn = [];
    for (const [p, cod] of CODIGO) {
      if (definicionesDe(nombre, cod).length) definidoEn.push(p);
      if (importaciones(nombre, cod)) importadoEn.push(p);
    }
    ok(definidoEn.length === 0, `nadie DEFINE ${nombre}`, definidoEn.join(", "));
    ok(importadoEn.length === 0, `ni un import colgando de ${nombre}`, importadoEn.join(", "));
  }
  const app = sinComentarios(LEER(join(ROOT, "src/ui/App.jsx")));
  ok(!/\bsetScenario\b/.test(app), "App.jsx no tiene setScenario — el escenario dejó de ser estado");
  ok(/const scenario = ESCENARIO_INICIAL/.test(app), "★ App.jsx: `const scenario = ESCENARIO_INICIAL` — la base real, constante");
  // el sucesor vivo (regla 3 de la poda): la base real sigue DECLARADA una sola vez
  const cfg = sinComentarios(LEER(join(ROOT, "src/config/scenarios.js")));
  ok(/export const ESCENARIO_INICIAL = "bonanza"/.test(cfg),
    "el sucesor vive: ESCENARIO_INICIAL = \"bonanza\" sigue declarado en config/scenarios.js");
}

/* ═══ C2 · LAS RAMAS-POR-NOMBRE ESTÁN DESARMADAS ══════════════════════════════════════════════════════════════ */
H("C2 · el guard SKU-margen×escenario y el blockedWhen del contrato no vuelven a nacer");
{
  for (const nombre of ["_esSkuMargenNoBonanza", "_skuMargenScenarioMsg", "ADI_SKU_SCENARIO_GUARD_ENABLED"]) {
    const definidoEn = [], importadoEn = [];
    for (const [p, cod] of CODIGO) {
      if (definicionesDe(nombre, cod).length) definidoEn.push(p);
      if (importaciones(nombre, cod)) importadoEn.push(p);
    }
    ok(definidoEn.length === 0, `nadie DEFINE ${nombre}`, definidoEn.join(", "));
    ok(importadoEn.length === 0, `ni un import colgando de ${nombre}`, importadoEn.join(", "));
  }
  // el campo condicional-por-escenario del contrato de superficie: retirado como PROPIEDAD (los comentarios
  // pueden y deben seguir contando su historia — el scan corre sin comentarios)
  const surtido = sinComentarios(LEER(join(ROOT, "src/config/contract/surfaceContract.js")));
  ok(!/\bblockedWhen\s*:/.test(surtido), "SURFACE no declara blockedWhen — la disponibilidad es del contrato, no del lente");
  ok(/export function surfaceBlock\(metric, axis\)/.test(surtido),
    "el sucesor vive: surfaceBlock(metric, axis) — sin parámetro de escenario");
  // y en TODO el repo, ningún módulo consulta un blockedWhen (llamada), que sería el guard renaciendo río abajo
  const consultan = [...CODIGO].filter(([, cod]) => /\.blockedWhen\s*\(/.test(cod)).map(([p]) => p);
  ok(consultan.length === 0, "nadie CONSULTA .blockedWhen(…) río abajo", consultan.join(", "));
}

/* ═══ C3 · LOS DEFAULTS SALEN DE LA ÚNICA FUENTE ══════════════════════════════════════════════════════════════ */
H("C3 · ni un literal de escenario como default — la base real se declara UNA vez");
{
  // Las DOS formas de default que el barrido eliminó (|| "bonanza" · scenario = "bonanza"). Los `=== "bonanza"`
  // de los composers son COMPARACIONES, no defaults — los desarma C4. Fuera del scan: config/scenarios.js (la
  // declaración única) y los datos de tenant (SCENARIO_TRANSFORMS nombra sus claves legítimamente).
  const EXENTOS = /config[\\/]scenarios\.js$|data[\\/]tenants[\\/]/;
  // R6: `|| "actual"` entra a las formas — el fallback de conveniencia dejaba armar el PLAN sobre la carpeta
  // cruda mientras la pantalla sirve la base (la clase «dos carpetas»). EXENTO declarado: answerADIFromSpec
  // (`spec.scenario || "actual"` es vocabulario del CONTRATO spec — el shape LOCKED del owner 2026-07-02).
  const EXENTO_SPEC = /answerADIFromSpec\.js$/;
  const DEFAULT_FORMS = [/\|\|\s*"bonanza"/, /\bscenario\s*=\s*"bonanza"/, /\|\|\s*"actual"/];
  const conDefault = [];
  for (const [p, cod] of CODIGO) {
    if (EXENTOS.test(p)) continue;
    const formas = DEFAULT_FORMS.filter((re) => re.test(cod));
    if (formas.length === 1 && formas[0].source.includes("actual") && EXENTO_SPEC.test(p)) continue;
    if (formas.length) conDefault.push(p);
  }
  ok(conDefault.length === 0, "ningún módulo tiene un default literal de escenario (bonanza NI actual · exento declarado: el contrato spec)", conDefault.join(", "));
  // y quienes lo necesitan importan la declaración (muestra representativa: la Mesa y el spec-path)
  ok(importaciones("ESCENARIO_INICIAL", CODIGO.get(join(ROOT, "src/adi/sentrix/mesa.js")) || ""),
    "la Mesa importa ESCENARIO_INICIAL de la única fuente");
  ok(importaciones("ESCENARIO_INICIAL", CODIGO.get(join(ROOT, "src/adi/answerADIFromSpec.js")) || ""),
    "el spec-path importa ESCENARIO_INICIAL de la única fuente");
}

/* ═══ C4 · LA SUPERFICIE NO DICE «ESCENARIO» ══════════════════════════════════════════════════════════════════ */
H("C4 · el único mundo no se etiqueta — ningún emisor compone «escenario X» para el usuario o el modelo");
{
  // Formas de EMISIÓN. SIN EXENCIONES desde C6: el scrub del seam se retiró y este lock es su sucesor.
  // ⚠️ LECCIÓN DEL RETRABAJO ULTRACODE (2026-08-30): la primera versión cazaba SOLO `escenario ${` y las
  // etiquetas por nombre — y CUATRO fugas reales la evadieron POR FORMA: la interpolación JSX («escenario
  // {scenario}» sin `$`), la mayúscula con palabras intermedias («Escenario de datos actual: ${scenario}») y
  // los dos puntos («escenario: ${scenario}»). Un lock que mide una forma mide ESA forma. Las cuatro fugas de
  // hoy quedan abajo como carnadas VERBATIM: este lock no vuelve a aprobar lo que ya se le escapó.
  // RONDA 2 (R6 del retrabajo): el A/B de R5 probó que las fugas también viven en LITERALES ESTÁTICOS — sin
  // interpolación no hay `${` que cazar. Tras sinComentarios, una frase multi-palabra con espacios SOLO puede
  // vivir dentro de un string (los identificadores no llevan espacios): por eso las formas de frase barren el
  // código pelado directo. Las etiquetas por nombre ahora cubren las TRES comillas y la minúscula, y la
  // concatenación con «+» también.
  const EMISIONES = [
    /escenario \$\{/,                                   // «· escenario ${scenario}» — la forma template
    /escenario: \$\{/,                                  // «· escenario: ${scenario}» — con dos puntos (fuga real: datoProyectado)
    /escenario \{[a-zA-Z]/,                             // «· escenario {scenario}» — interpolación JSX (fugas reales: pies del cuadro y el Pareto)
    /[Ee]scenario[^\n"`]{0,40}\$\{/,                    // «Escenario de datos actual: ${…}» — mayúscula/palabras a ≤40 chars de la interpolación (fuga real: planPrompt)
    /(?:en|del) (?:este|el) escenario\b/,               // «en este escenario» / «del escenario» — LITERAL ESTÁTICO (fugas reales R5/R6: diez composers)
    /escenario activo\b|escenario actual\b/,            // «el escenario activo/actual» — ídem (fuga real: ranking y hermanos)
    /["'`][^"'`\n]{0,80}escenario (?:[Bb]onanza|[Tt]ensi|[Cc]risis|favorable|cr[ií]tico)/,   // etiqueta por nombre, en CUALQUIER comilla y case
    /["'`]\s*\+\s*["'`]?\s*escenario\b|escenario:?\s*["'`]\s*\+/,   // la concatenación con «+» que parte el token
  ];
  // ÚNICO EXENTO (R6, declarado): figureType.js — las `razonEscenario` del tipado de la boleta son vecindario
  // del NOTARIO (guardrail del owner: guardC y la boleta no se tocan); su rename/reescritura viaja al owner
  // junto con el kind «escenario-inviable» de guardC (lo lleva el chat principal). No es una fuga nueva: es
  // territorio que espera su venia, dicho acá para que el silencio no lo tape.
  const EXENTO_NOTARIO = /contract[\\/]figureType\.js$/;
  const emiten = [];
  for (const [p, cod] of CODIGO) {
    if (EXENTO_NOTARIO.test(p)) continue;
    if (EMISIONES.some((re) => re.test(cod))) emiten.push(p);
  }
  ok(emiten.length === 0, "ningún módulo compone «escenario X» en texto emitido (exento declarado: figureType/notario)", emiten.join(", "));
  // el mapa del agente — la superficie NUEVA donde el concepto se estaba colando — no lleva el token
  const mapa = sinComentarios(LEER(join(ROOT, "src/adi/agente/mapaDelDato.js")));
  ok(!/escenario \$\{/.test(mapa) && /MAPA DEL DATO/.test(mapa),
    "el mapa del agente no etiqueta el mundo (y sigue siendo el mapa)");
  // y NADIE lee otra carpeta que la pantalla por default: `scenario = "actual"` (el valor NO declarado — la
  // base cruda) prohibido como default EN TODO EL REPO (C5 cerró los 12 módulos oráculo/sentrix que lo tenían
  // de conveniencia; los gates que dependían de la omisión ahora declaran su mundo explícito, con porqué).
  const conActual = [...CODIGO].filter(([, cod]) => /\bscenario\s*=\s*"actual"/.test(cod)).map(([p]) => p);
  ok(conActual.length === 0, "ningún default `scenario = \"actual\"` en el repo — nadie lee otra carpeta por default", conActual.join(", "));
}

/* ═══ C6 · EL SCRUB Y LOS LABELS, RETIRADOS ═══════════════════════════════════════════════════════════════════ */
H("C6 · la red transitoria y las etiquetas de UI no vuelven (R5 corrigió: el scrub SÍ atajaba literales — cortados en su fuente)");
{
  for (const nombre of ["_scrubScenario", "SCENARIOS"]) {
    const definidoEn = [], importadoEn = [];
    for (const [p, cod] of CODIGO) {
      if (definicionesDe(nombre, cod).length) definidoEn.push(p);
      if (importaciones(nombre, cod)) importadoEn.push(p);
    }
    ok(definidoEn.length === 0, `nadie DEFINE ${nombre}`, definidoEn.join(", "));
    ok(importadoEn.length === 0, `ni un import colgando de ${nombre}`, importadoEn.join(", "));
  }
  // el sucesor del scrub vive: los emisores dicen «· base real» DIRECTO (specRetrieval, el diagnose y los openers)
  const spec = sinComentarios(LEER(join(ROOT, "src/adi/specRetrieval.js")));
  ok((spec.match(/· base real\./g) || []).length >= 4,
    "el sucesor vive: specRetrieval emite «· base real» directo (diagnose + 3 openers)");
}

/* ═══ CARNADAS ════════════════════════════════════════════════════════════════════════════════════════════════ */
H("CARNADA · cada chequeo, probado ROJO con la resurrección adentro");
{
  // (a) el estado elegible de vuelta en App
  const appMut = sinComentarios(LEER(join(ROOT, "src/ui/App.jsx")))
    .replace("const scenario = ESCENARIO_INICIAL", "const [scenario, setScenario] = useState(ESCENARIO_INICIAL)");
  ok(/\bsetScenario\b/.test(appMut) && !/const scenario = ESCENARIO_INICIAL/.test(appMut),
    "carnada «useState de vuelta en App» → el chequeo se pone ROJO");

  // (b) el flag resucitado en voiceFlags
  const vfMut = sinComentarios(LEER(join(ROOT, "src/config/voiceFlags.js")))
    + "\nexport const ADI_SCENARIO_SWITCHER_ENABLED = P(\"ADI_SCENARIO_SWITCHER_ENABLED\");";
  ok(definicionesDe("ADI_SCENARIO_SWITCHER_ENABLED", vfMut).length > 0,
    "carnada «flag resucitado» → el detector lo caza como DEFINICIÓN");

  // (c) un selector nuevo que alguien re-escribe de memoria
  const selMut = sinComentarios("import { SCENARIOS } from \"../config/scenarios.js\";\nexport function ScenarioSelector({ scenario, onChange }) { return null; }");
  ok(definicionesDe("ScenarioSelector", selMut).length > 0,
    "carnada «selector re-escrito de memoria» → el detector lo caza");

  // (d) un import colgando tras un revert parcial
  ok(importaciones("ScenarioSelector", "import { ScenarioSelector } from \"./ScenarioSelector.jsx\";"),
    "carnada «import colgando tras revert» → el detector lo caza");

  // (e) el guard re-escrito de memoria en answerADI
  const guardMut = sinComentarios("function _esSkuMargenNoBonanza(intent, trimmed, scenario) {\n  if (!scenario || scenario === \"bonanza\") return false;\n  return true;\n}");
  ok(definicionesDe("_esSkuMargenNoBonanza", guardMut).length > 0,
    "carnada «guard SKU-margen re-escrito» → el detector lo caza");

  // (f) el blockedWhen condicional de vuelta en el contrato
  const surtidoMut = sinComentarios(LEER(join(ROOT, "src/config/contract/surfaceContract.js")))
    .replace("\"margen@sku\":   { lenses:", "\"margen@sku\":   { blockedWhen: (scn) => scn !== \"bonanza\" ? { reason: \"x\" } : null, lenses:");
  ok(/\bblockedWhen\s*:/.test(surtidoMut),
    "carnada «blockedWhen de vuelta en el contrato» → el chequeo se pone ROJO");

  // (g) un consumidor que vuelve a consultar la condición río abajo
  ok(/\.blockedWhen\s*\(/.test(sinComentarios("const b = sf.blockedWhen(\"bonanza\");")),
    "carnada «consulta a .blockedWhen renacida» → el chequeo se pone ROJO");

  // (h) un default literal que vuelve (las dos formas), y la exención NO tapa un módulo cualquiera
  ok(/\|\|\s*"bonanza"/.test(sinComentarios("const s = scenario || \"bonanza\";")),
    "carnada «default || \"bonanza\" de vuelta» → el chequeo se pone ROJO");
  ok(/\bscenario\s*=\s*"bonanza"/.test(sinComentarios("export function f(scenario = \"bonanza\") {}")),
    "carnada «default de firma de vuelta» → el chequeo se pone ROJO");

  // (i) un emisor que vuelve a etiquetar el mundo (las dos formas de emisión)
  ok(/escenario \$\{/.test(sinComentarios("const h = `Top 5 clientes · escenario ${scenarioLabel}.`;")),
    "carnada «header que etiqueta el escenario» → el chequeo se pone ROJO");
  ok(/"[^"\n]*escenario (?:Bonanza|Tensi|Crisis|favorable|cr[ií]tico)/.test(sinComentarios("const t = \"Resumen · escenario favorable\";")),
    "carnada «etiqueta por nombre en un literal» → el chequeo se pone ROJO");

  // (j) el agente que vuelve a leer OTRA carpeta que la pantalla
  ok(/\bscenario\s*=\s*"actual"/.test(sinComentarios("export function mapaDelDato(scenario = \"actual\") {}")),
    "carnada «default actual de vuelta en el agente» → el chequeo se pone ROJO");

  // (k) el scrub re-escrito de memoria (R5: su trabajo real —literales estáticos— ya se corta en la fuente y en el lock)
  ok(definicionesDe("_scrubScenario", sinComentarios("function _scrubScenario(text) { return text; }")).length > 0,
    "carnada «scrub re-escrito de memoria» → el detector lo caza");

  // (k2..k5) LAS CUATRO FUGAS REALES DEL RETRABAJO ULTRACODE, verbatim como cebo — la primera versión del lock
  // las aprobó a todas; esta tiene que cazarlas una por una, para siempre.
  const _emite = (src) => EMISIONES_TEST.some((re) => re.test(sinComentarios(src)));
  const EMISIONES_TEST = [
    /escenario \$\{/, /escenario: \$\{/, /escenario \{[a-zA-Z]/, /[Ee]scenario[^\n"`]{0,40}\$\{/,
    /"[^"\n]*escenario (?:Bonanza|Tensi|Crisis|favorable|cr[ií]tico)/,
  ];
  ok(_emite("const pie = <span>{cm.n} {cm.plural} · escenario {scenario}.</span>;"),
    "carnada «pie JSX del cuadro (fuga real 1)» → el lock la caza");
  ok(_emite("const t = `Concentración ${sp.byNoun} ($) · escenario {con.scenario} · barras`;"),
    "carnada «pie del Pareto (fuga real 2)» → el lock la caza");
  ok(_emite("const s = `· Escenario de datos actual: ${scenario}.`;"),
    "carnada «system del PLAN (fuga real 3)» → el lock la caza");
  ok(_emite("L.push(`EL DATO DEL NEGOCIO — ${t.nombre} · escenario: ${scenario} · moneda USD.`);"),
    "carnada «header de la proyección (fuga real 4)» → el lock la caza");

  // (l) los labels de UI de vuelta en config
  ok(definicionesDe("SCENARIOS", sinComentarios("export const SCENARIOS = { bonanza: { label: \"Bonanza\" } };")).length > 0,
    "carnada «labels SCENARIOS de vuelta» → el detector lo caza");

  // (m..p) RONDA 2 (R6): las formas que evadieron la ronda 1, con las fugas REALES verbatim como cebo
  const EMITE2 = (src) => [
    /(?:en|del) (?:este|el) escenario\b/, /escenario activo\b|escenario actual\b/,
    /["'`][^"'`\n]{0,80}escenario (?:[Bb]onanza|[Tt]ensi|[Cc]risis|favorable|cr[ií]tico)/,
    /["'`]\s*\+\s*["'`]?\s*escenario\b|escenario:?\s*["'`]\s*\+/,
  ].some((re) => re.test(sinComentarios(src)));
  ok(EMITE2('return composeHonestUnavailable("no hay datos disponibles en el escenario activo.", spec.domain);'),
    "carnada «literal estático de ranking (fuga real R5)» → el lock la caza");
  ok(EMITE2("const t = `No encontré fugas materiales en este escenario.`;"),
    "carnada «literal estático del diagnose vacío (fuga real R5)» → el lock la caza");
  ok(EMITE2("const s = 'resultados del escenario bonanza';"),
    "carnada «etiqueta minúscula en comilla simple» → el lock la caza");
  ok(EMITE2('const h = "Concentración " + byNoun + " · escenario " + con.scenario;'),
    "carnada «concatenación con + » → el lock la caza");

  // (q) el default «actual» que vuelve como fallback (la clase dos-carpetas de R6)
  ok(/\|\|\s*"actual"/.test(sinComentarios('const scn = scenario || "actual";')),
    "carnada «fallback || \"actual\" de vuelta» → el chequeo se pone ROJO");
}

console.log(`\n── _colapso_eje_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
