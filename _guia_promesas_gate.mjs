/* === _guia_promesas_gate.mjs · EL CANDADO DE PROMESAS DE LA GUÍA (owner 2026-08-14) ===========================
 * EL DEFECTO QUE LO HACE NACER, verificado en vivo (captura del owner): la guía de inicio ofrecía con un click
 * «Si subo ventas 4%, ¿qué cambia?». Con el oráculo encendido —que es producción hoy— TODO ejemplo de la guía
 * viaja como TEXTO LIBRE (submitSpec degrada a submit(q), ChatADI.jsx), así que el spec enlatado no protege nada
 * en esa vía: la pregunta quedó a merced de PLAN, el detector determinístico no la reconocía («ventas» no era
 * vocabulario de volumen) y ADI respondió "No tengo corrida esa simulación". La guía prometió; el motor no llegó.
 *
 * LA REGLA QUE ESTE GATE FIJA, pregunta por pregunta y PERMANENTE: cada pregunta que la guía ofrece tiene que
 * traer una GARANTÍA DECLARADA de que el primer click llega al flujo correcto — o un spec enlatado válido
 * (HERO_CHIPS, curado y verificado), o el reconocimiento del piso determinístico que corresponda (detector de
 * escenario, red del P&L, coerce del piso). Una pregunta NUEVA en la guía sin garantía declarada acá pone este
 * gate en ROJO: el candado obliga a decidir la garantía ANTES de prometer, no después del primer decline.
 *
 * QUÉ GARANTIZA CADA GARANTÍA (y qué NO — el límite se declara, no se disimula):
 *   · "hero"     → el spec enlatado responde en la vía SIN oráculo (spec → answerConversational) y en el fallback.
 *                  NO cubre la vía oráculo viva (texto libre → PLAN) salvo que otra garantía la cubra.
 *   · "coerce"   → coerceFloor reclama el texto → la vía sin oráculo y el fallback con gateway caído responden.
 *                  MISMO límite: en la vía oráculo el turno lo decide PLAN.
 *   · "oraculo"  → un piso determinístico DEL ORÁCULO reconoce el texto ANTES de PLAN (detectScenarioIntent /
 *                  detectPnlIntent-cede-el-paso). Es la única garantía que cubre la vía viva de producción.
 * Las preguntas de lectura (Comercial · Capital) HOY no tienen garantía "oraculo": ese hueco está DECLARADO en el
 * informe del turno que creó este gate — el candado afirma lo que existe, nunca lo tapa.
 *
 * OFFLINE · CERO GASTO: solo detectores puros + el bundle de la guía. Nada de este archivo invoca al planificador
 * ni al gateway; el candado de runtime de gates:offline aplica igual.
 */
import { JSDOM } from "jsdom";
import esbuild from "esbuild";
import { fileURLToPath, pathToFileURL } from "url";
import path from "path";
import fs from "fs";

let pass = 0, fail = 0;
const ok = (cond, label, detail) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ FALLO: ${label}${detail !== undefined ? ` — obtuvo ${detail}` : ""}`); }
};

// ── 0 · DOM mínimo (los módulos de UI del bundle esperan window/localStorage al cargarse) ──────────────────────
const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
try { Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true }); } catch {}
globalThis.localStorage = dom.window.localStorage;
globalThis.__ADI_PROFILE__ = "dev";
if (typeof dom.window.matchMedia !== "function") {
  dom.window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
}

const root = path.dirname(fileURLToPath(import.meta.url));
const bundlePath = path.join(root, `_guia_promesas_gate_bundle.tmp${process.pid}.mjs`);
await esbuild.build({
  entryPoints: [path.join(root, "_guia_promesas_gate_entry.jsx")],
  bundle: true, outfile: bundlePath, format: "esm", platform: "node", jsx: "automatic",
  external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "react/jsx-dev-runtime"],
  logLevel: "silent",
});
const ui = await import(pathToFileURL(bundlePath).href);
const { GUIA_EJEMPLOS, HERO_CHIPS, coerceFloor, detectScenarioIntent, detectPnlIntent } = ui;
const deepEq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

console.log("═".repeat(100));
console.log("1 · NINGUNA PREGUNTA SE CAE EN SILENCIO · _TEMAS (fuente) ↔ GUIA_EJEMPLOS (lo ofrecido)");
console.log("═".repeat(100));
// _TEMAS no está exportado (es privado del módulo a propósito): se lee del FUENTE. Si el bloque cambia de forma,
// este parse devuelve otra cosa y las aserciones de abajo lo gritan — nunca falla abierto.
const fuente = fs.readFileSync(path.join(root, "src/ui/GuiaInicio.jsx"), "utf8");
const iTemas = fuente.indexOf("const _TEMAS = [");
const fTemas = fuente.indexOf("];", iTemas);
ok(iTemas > 0 && fTemas > iTemas, "el bloque _TEMAS existe en GuiaInicio.jsx");
const temasSrc = [...fuente.slice(iTemas, fTemas).matchAll(/q:\s*"([^"]+)"/g)].map((m) => m[1]);
ok(temasSrc.length >= 4, `_TEMAS declara ${temasSrc.length} preguntas (≥4)`);
for (const q of temasSrc) {
  ok(GUIA_EJEMPLOS.some((e) => e.q === q),
    `«${q}» declarada en _TEMAS SIGUE ofrecida en GUIA_EJEMPLOS — si el coercer dejó de reclamarla, se cayó en silencio`);
}
ok(GUIA_EJEMPLOS.every((e) => temasSrc.includes(e.q)), "…y la guía no ofrece nada que _TEMAS no declare");

console.log("\n" + "═".repeat(100));
console.log("2 · LA GARANTÍA DECLARADA, PREGUNTA POR PREGUNTA");
console.log("═".repeat(100));
/* El mapa del candado. `garantias` documenta por qué el primer click no puede terminar en un decline; `check`
 * lo VERIFICA contra el motor real. Agregar una pregunta a la guía exige agregar su entrada acá — con la
 * garantía pensada, no con un "ya veremos". */
const CANDADO = new Map([
  ["¿Qué clientes venden mucho pero dejan poco margen?", {
    garantias: ["coerce"],
    check(ej) {
      ok(ej.fuente === "coerce", `«${ej.q}» deriva del coercer del piso (fuente: ${ej.fuente})`);
      const s = coerceFloor(ej.q, false, null);
      ok(!!s && s.operation === "margin" && s.dimension === "cliente",
        `coerceFloor la reclama como lectura de margen por cliente — obtuvo ${JSON.stringify(s && { operation: s.operation, dimension: s.dimension })}`);
      ok(deepEq(ej.spec, s), "…y el spec ofrecido es EXACTAMENTE el derivado, sin retoques");
    },
  }],
  ["¿Dónde tengo capital inmovilizado?", {
    garantias: ["hero"],
    check(ej) {
      const chip = HERO_CHIPS.find((c) => c.q === ej.q);
      ok(!!chip, `«${ej.q}» tiene su chip curado en HERO_CHIPS`);
      ok(ej.fuente === "hero" && !!chip && deepEq(ej.spec, chip.spec), "…y la guía usa ESE spec byte a byte");
    },
  }],
  ["¿Cuánto me queda después de gastos?", {
    garantias: ["hero", "oraculo"],
    check(ej) {
      const chip = HERO_CHIPS.find((c) => c.q === ej.q);
      ok(!!chip && ej.fuente === "hero" && deepEq(ej.spec, chip.spec), `«${ej.q}» usa el spec curado de HERO_CHIPS`);
      // vía oráculo: detectPnlIntent reclama el turno y el oráculo LE CEDE EL PASO al flujo guiado del P&L
      // (ChatADI.jsx: `_oracleOn() && !detectPnlIntent(q)`) — el primer click nunca queda a merced de PLAN.
      const d = detectPnlIntent(ej.q);
      ok(!!d, `detectPnlIntent la reclama (el oráculo cede al flujo guiado) — obtuvo ${JSON.stringify(d)}`);
    },
  }],
  ["Si subo ventas 4%, ¿qué cambia?", {
    garantias: ["coerce", "oraculo"],
    check(ej) {
      // vía oráculo (producción): el detector de escenario la reconoce ANTES de PLAN — el defecto que motivó
      // todo este candado. Campo y delta EXACTOS: volumen (unidades) +4, interpretación marcada via:"ventas".
      const r = detectScenarioIntent(ej.q);
      ok(r.kind === "no_entity" && r.variable && r.variable.campo === "unidades" && r.variable.delta_pct === 4,
        `detectScenarioIntent la reconoce (kind útil, volumen +4) — obtuvo ${JSON.stringify(r)}`);
      ok(r.variable && r.variable.via === "ventas",
        "…marcada via:\"ventas\" — la respuesta del bypass DECLARA la interpretación (volumen a precios por confirmar)");
      // vía sin oráculo: el coercer del piso también la reclama (proyección determinística).
      const s = coerceFloor(ej.q, false, null);
      ok(!!s && s.operation === "simulate", `coerceFloor la reclama como simulación — obtuvo ${JSON.stringify(s && s.operation)}`);
      ok(ej.fuente === "coerce" && deepEq(ej.spec, s), "…y el spec ofrecido es el derivado exacto");
    },
  }],
]);

for (const ej of GUIA_EJEMPLOS) {
  const entrada = CANDADO.get(ej.q);
  ok(!!entrada, `«${ej.q}» tiene garantía DECLARADA en este candado — una pregunta nueva sin garantía no entra a la guía`);
  if (entrada) {
    console.log(`  · «${ej.q}» — garantías: ${entrada.garantias.join(" + ")}`);
    entrada.check(ej);
  }
}
for (const q of CANDADO.keys()) {
  ok(GUIA_EJEMPLOS.some((e) => e.q === q) || !temasSrc.includes(q),
    `la garantía declarada para «${q}» no quedó huérfana (la pregunta sigue en la guía)`);
}

// ── 3 · EL LÍMITE, A LA VISTA: las preguntas de LECTURA no tienen garantía en la vía oráculo ───────────────────
// Comercial y Capital viajan como texto libre a PLAN cuando el oráculo está encendido (producción hoy): su
// garantía cubre la vía spec y el fallback, NO la vía viva. Este bloque solo deja el hueco medible: si algún día
// un piso determinístico del oráculo las reconoce, estas aserciones invertidas lo avisan para PROMOVER la
// garantía a "oraculo" acá y en el informe — el candado nunca afirma de más ni de menos.
console.log("\n" + "═".repeat(100));
console.log("3 · EL HUECO DECLARADO · lectura (Comercial · Capital) sin piso de oráculo — reportado, no tapado");
console.log("═".repeat(100));
for (const q of ["¿Qué clientes venden mucho pero dejan poco margen?", "¿Dónde tengo capital inmovilizado?"]) {
  const r = detectScenarioIntent(q);
  ok(r.kind === "none", `«${q}» no es un escenario (detector: ${r.kind}) — su vía oráculo depende de PLAN, y eso está declarado`);
  ok(!detectPnlIntent(q), "…ni un turno de P&L: ninguna red del oráculo la reclama hoy");
}

try { fs.unlinkSync(bundlePath); } catch { /* el tmp no bloquea el veredicto */ }
console.log(`\n── _guia_promesas_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail === 0 ? 0 : 1);
