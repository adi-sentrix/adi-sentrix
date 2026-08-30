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
  const DEFAULT_FORMS = [/\|\|\s*"bonanza"/, /\bscenario\s*=\s*"bonanza"/];
  const conDefault = [];
  for (const [p, cod] of CODIGO) {
    if (EXENTOS.test(p)) continue;
    if (DEFAULT_FORMS.some((re) => re.test(cod))) conDefault.push(p);
  }
  ok(conDefault.length === 0, "ningún módulo tiene un default literal de escenario", conDefault.join(", "));
  // y quienes lo necesitan importan la declaración (muestra representativa: la Mesa y el spec-path)
  ok(importaciones("ESCENARIO_INICIAL", CODIGO.get(join(ROOT, "src/adi/sentrix/mesa.js")) || ""),
    "la Mesa importa ESCENARIO_INICIAL de la única fuente");
  ok(importaciones("ESCENARIO_INICIAL", CODIGO.get(join(ROOT, "src/adi/answerADIFromSpec.js")) || ""),
    "el spec-path importa ESCENARIO_INICIAL de la única fuente");
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
}

console.log(`\n── _colapso_eje_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
