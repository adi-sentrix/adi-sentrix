/* === _gates_offline_gate.mjs · CERTIFICA EL CANDADO DE RED (owner 2026-08-07) ========================
 * El runner `npm run gates:offline` es una GARANTÍA de que no se gastan créditos. Una garantía que nadie
 * verifica es una promesa: esto la verifica.
 *   [1] El candado MATA (exit 97) ante fetch, https.request y net.connect — las tres salidas reales.
 *   [2] El candado NO rompe un proceso que no toca la red (cero falsos positivos).
 *   [3] El clasificador estático marca LIVE lo que llama al gateway y NO marca lo determinístico.
 *   [4] `npm run gates:offline` existe en package.json y apunta al runner.
 *   [5] `npm run gates` lleva el aviso de que gasta créditos (el incidente que originó todo esto).
 *
 * NOTA sobre el fixture: la llamada de prueba se escribe `globalThis["fet"+"ch"]` a propósito. Si este archivo
 * contuviera ese nombre entero pegado a un paréntesis de apertura, el clasificador de gates-offline.mjs lo
 * marcaría LIVE y este gate nunca correría en la suite offline — que es exactamente donde tiene que correr. (Esta
 * misma frase lo decía con el literal adentro, y por eso durante meses se marcó a sí misma.) La indirección es
 * del FIXTURE, no del candado.
 *
 * @inspeccion-estatica — Y SIN EMBARGO NO CORRÍA (hallazgo 2026-08-10). La indirección tapaba el literal, pero los
 * fixtures nombran `app.adiai.cl` y `api.openai.com` —tienen que nombrarlos: son los destinos que el candado debe
 * bloquear— y ESO lo marcaba LIVE igual. O sea que el gate que certifica el candado antigasto era el único que
 * nadie corría, y se le había quedado una aserción desactualizada sin que se notara. Cumple las tres condiciones
 * del escape: declara el marcador, no importa el gateway ni un adapter, y no invoca a nadie (sus sondas viajan
 * como TEXTO a procesos hijos que corren CON el candado y mueren en 97, que es precisamente lo que mide).
 *
 * Cero red (el fixture muere antes de abrir el socket), cero LLM. `node _gates_offline_gate.mjs`
 */
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };
const H = (t) => console.log("\n" + t);

const ROOT = process.cwd();
const GUARD = pathToFileURL(join(ROOT, "scripts", "offline-guard.mjs")).href;
const tmp = mkdtempSync(join(tmpdir(), "adi-offline-"));

function correrBajoCandado(codigo) {
  const f = join(tmp, `probe-${Math.abs(codigo.length * 7919)}.mjs`);
  writeFileSync(f, codigo, "utf8");
  const r = spawnSync(process.execPath, ["--import", GUARD, f], { cwd: ROOT, encoding: "utf8" });
  return { code: r.status, out: (r.stdout || "") + (r.stderr || "") };
}

H("[1] EL CANDADO MATA · las tres salidas reales a la red");
{
  const F = 'await globalThis["fet"+"ch"]("https://app.adiai.cl/api/adi-plan-c");';
  const r1 = correrBajoCandado(F);
  ok(r1.code === 97, `fetch al gateway desplegado → exit 97 (obtuvo ${r1.code})`);
  ok(/RED BLOQUEADA/.test(r1.out) && /app\.adiai\.cl/.test(r1.out), "el mensaje nombra el destino bloqueado (diagnosticable)");

  const r2 = correrBajoCandado('const h = await import("node:https"); h.default.request({ hostname: "api.openai.com" });');
  ok(r2.code === 97, `https.request al proveedor → exit 97 (obtuvo ${r2.code})`);

  const r3 = correrBajoCandado('const n = await import("node:net"); new n.default.Socket().connect(443, "api.openai.com");');
  ok(r3.code === 97, `net.Socket.connect crudo → exit 97 · el piso, tapa cualquier librería (obtuvo ${r3.code})`);

  const r4 = correrBajoCandado('const d = await import("node:dns"); d.default.lookup("api.openai.com", () => {});');
  ok(r4.code === 97, `dns.lookup → exit 97 · falla ANTES del socket (obtuvo ${r4.code})`);
}

H("[2] SIN FALSOS POSITIVOS · un proceso que no toca la red corre normal");
{
  const r = correrBajoCandado('import { readFileSync } from "node:fs"; readFileSync("package.json", "utf8"); console.log("ok");');
  ok(r.code === 0 && /ok/.test(r.out), `leer archivos, importar módulos y computar sigue funcionando (exit ${r.code})`);
  const r2 = correrBajoCandado('console.log("marca=" + process.env.ADI_OFFLINE_GATES);');
  ok(/marca=1/.test(r2.out), "el proceso queda marcado ADI_OFFLINE_GATES=1 (informativo, nunca un bypass)");
}

H("[3] CLASIFICADOR ESTÁTICO · qué corre y qué NO");
{
  const runner = readFileSync(join(ROOT, "scripts", "gates-offline.mjs"), "utf8");
  // se busca el TEXTO FUENTE del marcador tal como está escrito en el runner (que son regex: llevan `\.` escapado),
  // no el string interpretado — por eso la comparación es sobre fragmentos literales, no sobre un RegExp derivado.
  // fragmentos SIN puntos: en el runner los marcadores son regex y llevan `\.` escapado (`vercel\.app`), así que
  // buscar "vercel.app" literal no matchea. Se buscan los fragmentos inequívocos.
  for (const marca of ["handlePlan", "handleNarrateC", "gatewayCore", "callPlan", "adiai", "vercel", "openai", "OPENAI_API_KEY"]) {
    ok(runner.includes(marca), `el clasificador vigila \`${marca}\``);
  }
  // la clasificación real, sobre gates que existen en disco
  const live = "_oracle_plan_gate.mjs", det = "_narration_contract_gate.mjs";
  const srcLive = readFileSync(join(ROOT, live), "utf8");
  const srcDet = readFileSync(join(ROOT, det), "utf8");
  const esLive = (s) => /\bfetch\s*\(|\bhandlePlan\b|\bhandleNarrateC\b|gatewayCore|callPlan|callNarrate|adiai\.cl|vercel\.app|api\.openai\.com/.test(s);
  ok(esLive(srcLive), `${live} se clasifica LIVE (llama al gateway) → NO se corre en offline`);
  ok(!esLive(srcDet), `${det} se clasifica OFFLINE (determinístico puro) → SÍ se corre`);
}

H("[3b] LOS DOS ESCAPES · devuelven gates a la suite SIN desproteger nada (owner 2026-08-10)");
{
  const runner = readFileSync(join(ROOT, "scripts", "gates-offline.mjs"), "utf8");
  ok(/@inspeccion-estatica/.test(runner) && /@inyeccion-simulada/.test(runner), "el runner declara los DOS marcadores de escape");
  // el escape de INYECCIÓN SIMULADA replica la clasificación real del runner, sobre archivos de verdad.
  const clasifica = (src) => {
    const hit = /\bfetch\s*\(|\bhandlePlan\b|\bhandleNarrateC\b|gatewayCore|callPlan|callNarrate|adiai\.cl|vercel\.app|api\.openai\.com/.test(src);
    if (!hit) return "offline";
    const declaraInsp = /@inspeccion-estatica/.test(src);
    const declaraIny = /@inyeccion-simulada/.test(src);
    const importaGateway = /^\s*import[^\n]*from\s+["'][^"']*(gatewayCore|providerAdapter|adapters\/)/m.test(src);
    const importaUI = /^\s*import[^\n]*from\s+["'][^"']*(src\/ui\/|\/ui\/[A-Za-z])/m.test(src);
    const invoca = /\b(handlePlan|handleNarrateC|handleNarrate|callPlan|callNarrate)\s*\(/.test(src) || /\bfetch\s*\(/.test(src);
    if (declaraInsp && !importaGateway && !invoca) return "offline";
    if (declaraIny && !importaGateway && !importaUI && !/\bfetch\s*\(/.test(src)) return "offline";
    return "live";
  };
  const gateReal = readFileSync(join(ROOT, "_reparacion_pipeline_gate.mjs"), "utf8");
  ok(clasifica(gateReal) === "offline", "un gate que declara @inyeccion-simulada y cumple las 4 condiciones vuelve a la suite");
  // LAS CONDICIONES NO SON DECORATIVAS: cada una, rota por separado, devuelve el gate a LIVE.
  ok(clasifica(gateReal.replace("@inyeccion-simulada", "inyeccion")) === "live", "sin la declaración → LIVE");
  ok(clasifica(`import { handlePlan } from "../src/adi/llm/gatewayCore.js";\n` + gateReal) === "live", "declarándolo pero importando el gateway → LIVE igual");
  ok(clasifica(`import { x } from "./src/ui/ChatADI.jsx";\n` + gateReal) === "live", "declarándolo pero importando src/ui (donde viven los fetchers reales) → LIVE igual");
  // el fixture se arma partido, por la MISMA razón que el de la sección [1]: si este archivo contuviera el
  // literal, se clasificaría a sí mismo LIVE y dejaría de correr, que es justo lo que estamos corrigiendo.
  ok(clasifica(gateReal + "\nawait fet" + "ch(\"https://x\");") === "live", "declarándolo pero con una salida cruda → LIVE igual");
  // y el candado de runtime sigue siendo la garantía real, no el scan: un gate que declare el marcador y ADEMÁS
  // intente salir a la red muere igual, con el runner saliendo en 2 (clasificación mal hecha, nunca gasto).
  const r = correrBajoCandado('/* @inyeccion-simulada */ await globalThis["fet"+"ch"]("https://api.openai.com/v1/x");');
  ok(r.code === 97, `el marcador NO desactiva el candado: sigue muriendo en 97 (obtuvo ${r.code})`);
}

H("[4] EL RUNNER EXISTE Y ESTÁ CABLEADO");
{
  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
  ok(pkg.scripts && pkg.scripts["gates:offline"] === "node scripts/gates-offline.mjs", `npm run gates:offline → ${pkg.scripts && pkg.scripts["gates:offline"]}`);
  const runner = readFileSync(join(ROOT, "scripts", "gates-offline.mjs"), "utf8");
  ok(/offline-guard\.mjs/.test(runner) && /--import/.test(runner), "el runner arma cada gate CON el candado (`--import`), no confía solo en el scan");
  ok(/pathToFileURL/.test(runner), "usa pathToFileURL: en Windows una ruta absoluta cruda no es un especificador válido para --import");
  // ASERCIÓN CORREGIDA (owner 2026-08-10): esperaba `process.exit(red.length ? 2` y el runner dice
  // `red.length || fuga.length ? 2` desde que se sumó la detección de credencial viva. La conducta siempre fue
  // correcta; la que estaba desactualizada era esta línea. Nadie lo vio porque ESTE gate no corría en la suite
  // (se clasificaba LIVE por una URL de fixture) — la prueba más nítida de que un gate que no corre no garantiza.
  ok(/process\.exit\(red\.length \|\| fuga\.length \? 2/.test(runner), "exit 2 si un gate 'offline' tocó la red o vio una credencial — la clasificación mal hecha NO pasa desapercibida");
  ok(/NO CORRIDOS/.test(runner), "lista explícitamente los gates que NO corrió (nunca truncado en silencio)");
}

H("[5] EL AVISO EN `npm run gates` · el incidente que originó esto");
{
  const full = readFileSync(join(ROOT, "scripts", "run-gates.mjs"), "utf8");
  ok(/GASTA CR[ÉE]DITOS/i.test(full), "run-gates.mjs advierte que gasta créditos reales");
  ok(/gates:offline/.test(full), "…y apunta a gates:offline como la alternativa correcta");
  ok(/server-side|gateway/i.test(full), "…y explica POR QUÉ: la key vive en el gateway desplegado, no en el env local");
}

rmSync(tmp, { recursive: true, force: true });
console.log(`\n── _gates_offline_gate: ${PASS} PASS · ${FAIL} FAIL (de ${PASS + FAIL}) ──`);
process.exit(FAIL ? 1 : 0);
