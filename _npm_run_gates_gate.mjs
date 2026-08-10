/* === _npm_run_gates_gate.mjs · REQUISITO 6 · "pase quirúrgico de confiabilidad" (owner 2026-07-29) ===
 * "Agrega un `npm run gates` que ejecute la suite completa." Lockea: (1) package.json declara el script "gates";
 * (2) scripts/run-gates.mjs existe y enumera TODOS los `_*_gate.mjs` de la raíz (glob, no una lista a mano — un
 * gate nuevo entra solo, sin tocar el runner); (3) el runner exit-codea 1 si algún gate falla, 0 si todos pasan
 * (subset sintético de 2 gates de juguete, para no correr la suite REAL completa DENTRO de este gate — eso ya lo
 * hace `npm run gates` en sí); (4) el runner es SECUENCIAL (no paralelo) — a propósito, documentado en el archivo.
 */
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import os from "os";

let pass = 0, fail = 0;
const ok = (cond, label) => { console.log(`  ${cond ? "✓" : "✗"} ${label}`); if (cond) pass++; else fail++; };

console.log("── 1 · package.json declara \"gates\" → scripts/run-gates.mjs ──");
{
  const pkg = JSON.parse(fs.readFileSync("./package.json", "utf8"));
  ok(pkg.scripts && pkg.scripts.gates === "node scripts/run-gates.mjs", `scripts.gates="${pkg.scripts && pkg.scripts.gates}"`);
}

console.log("\n── 2 · scripts/run-gates.mjs enumera los _*_gate.mjs de la raíz por GLOB (no una lista fija) ──");
{
  ok(fs.existsSync("./scripts/run-gates.mjs"), "scripts/run-gates.mjs existe");
  const src = fs.readFileSync("./scripts/run-gates.mjs", "utf8");
  ok(/readdirSync/.test(src) && /_.*_gate\\\.mjs/.test(src), "usa readdirSync + regex sobre el nombre — un gate nuevo entra solo, sin editar este archivo");
  const real = fs.readdirSync(".").filter((f) => /^_.*_gate\.mjs$/.test(f));
  ok(real.length >= 60, `la raíz tiene ${real.length} archivos _*_gate.mjs (≥60 — la suite creció con los 6 de este pase, no encogió)`);
  ok(real.includes("_ruta_deterministica_gate.mjs") && real.includes("_topn_resto_gate.mjs") && real.includes("_periodo_declarado_gate.mjs") && real.includes("_orden_sellado_gate.mjs") && real.includes("_tabla_estructurada_gate.mjs"), "los 5 gates nuevos de este pase (1-5) están en la raíz y el glob los va a recoger");
}

console.log("\n── 3 · el runner exit-codea correctamente (subset sintético de gates de juguete, no la suite real) ──");
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "gates-test-"));
  fs.mkdirSync(path.join(tmp, "scripts"));
  fs.writeFileSync(path.join(tmp, "scripts", "run-gates.mjs"), fs.readFileSync("./scripts/run-gates.mjs", "utf8"));

  // caso A: todos los gates (de juguete) pasan → exit 0
  fs.writeFileSync(path.join(tmp, "_ok1_gate.mjs"), "console.log('ok1'); process.exit(0);\n");
  fs.writeFileSync(path.join(tmp, "_ok2_gate.mjs"), "console.log('ok2'); process.exit(0);\n");
  const rAllOk = spawnSync(process.execPath, ["scripts/run-gates.mjs"], { cwd: tmp, encoding: "utf8", env: { ...process.env, GATES_PAUSE_MS: "0" } });
  ok(rAllOk.status === 0, `exit 0 cuando TODOS los gates pasan (obtuvo ${rAllOk.status})`);
  ok(/2 PASS · 0 FAIL/.test(rAllOk.stdout), `reporta "2 PASS · 0 FAIL" en el resumen`);

  // caso B: agrego un gate que falla → exit 1, y el resumen lo señala
  fs.writeFileSync(path.join(tmp, "_fail_gate.mjs"), "console.log('fail'); process.exit(1);\n");
  const rWithFail = spawnSync(process.execPath, ["scripts/run-gates.mjs"], { cwd: tmp, encoding: "utf8", env: { ...process.env, GATES_PAUSE_MS: "0" } });
  ok(rWithFail.status === 1, `exit 1 cuando UN gate falla (obtuvo ${rWithFail.status})`);
  ok(/2 PASS · 1 FAIL/.test(rWithFail.stdout), `reporta "2 PASS · 1 FAIL" en el resumen`);
  ok(rWithFail.stdout.includes("✗ _fail_gate.mjs") && rWithFail.stdout.includes("✓ _ok1_gate.mjs"), "el resumen marca CUÁL gate falló y cuáles pasaron, por nombre");

  fs.rmSync(tmp, { recursive: true, force: true });
}

console.log("\n── 4 · el runner es SECUENCIAL a propósito (documentado — evita saturar rate limits del LLM) ──");
{
  const src = fs.readFileSync("./scripts/run-gates.mjs", "utf8");
  ok(/for \(const file of gates\)/.test(src) && /await runOne/.test(src), "un for...of con await (secuencial), no un Promise.all (paralelo)");
  ok(/SECUENCIAL/i.test(src), "el archivo documenta explícitamente por qué es secuencial");
}
