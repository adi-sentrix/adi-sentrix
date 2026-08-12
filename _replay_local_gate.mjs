/* === _replay_local_gate.mjs · EL CORREDOR GUARDA LO QUE HACE FALTA PARA REPRODUCIR (owner 2026-08-12) =========
 * El replay de f4f2949 llegó a 24/25. El turno que faltó dependía de `results`, y el corredor había guardado los
 * NOMBRES de las tools pero no sus `args`: 0 de 57 calls los traían. Este gate certifica que eso no vuelva a pasar
 * — ANTES de la próxima corrida pagada, que es cuando sirve.
 *
 * LAS TRES COSAS QUE MIDE, y ninguna es una promesa:
 *   (1) que el registro que arma el corredor CONTENGA `call.args` y `results`;
 *   (2) que el destino esté IGNORADO POR GIT, verificado contra el `.gitignore` real — `args` y `results` traen
 *       nombres de cuentas y cifras del negocio, y un directorio que deja de estar ignorado es el error que nadie
 *       nota hasta después del push;
 *   (3) que vaya SEPARADO de la telemetría segura: el módulo no la importa ni le escribe.
 *
 * `node --import ./scripts/offline-guard.mjs _replay_local_gate.mjs`
 */
import { readFileSync } from "node:fs";
import { armarRegistroDeTurno, DIR_REPLAY, REGLA_GITIGNORE } from "./scripts/replay-local.mjs";

let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };
const h = (t) => console.log(`\n${t}`);

/* ═══ 1 · EL REGISTRO TRAE LO QUE FALTABA ═════════════════════════════════════════════════════════════════════ */
h("1 · `call.args` y `results` — exactamente lo que el replay anterior no tuvo");
{
  const PLAN = {
    intent: "answer",
    calls: [
      { tool: "compareEntities", args: { dimension: "cliente", entities: ["Falabella", "Lider"] } },
      { tool: "simulateCosto", args: { pct: -3, scope: "bajo_benchmark" } },
    ],
  };
  const RESULTS = [
    { callId: "c0", tool: "compareEntities", facts: { lens: "compare" }, boleta: [{ label: "Falabella · Contribución", value: "$4.2M" }], coverage: { supported: true } },
    { callId: "c1", tool: "simulateCosto", facts: null, boleta: [], coverage: { supported: false, reason: "sin supuesto" } },
  ];
  const reg = armarRegistroDeTurno({ id: "E2.t2", plan: PLAN, results: RESULTS, scenario: "actual" });

  ok(reg.calls.length === 2, "guarda las dos calls del plan");
  ok(reg.calls.every((c) => c.args !== null), "las DOS traen `args` — la condición exacta que falló en f4f2949");
  ok(reg.calls[0].args.entities.length === 2 && reg.calls[0].args.dimension === "cliente",
    "…con los argumentos COMPLETOS, no una muestra", JSON.stringify(reg.calls[0].args));
  ok(reg.calls[1].args.pct === -3, "…incluidos los porcentajes de una simulación, que es lo que E6.t3 necesitaba");

  ok(reg.results.length === 2, "guarda los `results` de las dos calls");
  ok(reg.results[0].boleta.length === 1, "…con su boleta");
  ok(reg.results[1].coverage.supported === false && /sin supuesto/.test(reg.results[1].coverage.reason),
    "…y con la cobertura de la que declinó: por qué no hubo dato es parte de lo que hay que reproducir");
  ok(reg.id === "E2.t2" && reg.scenario === "actual", "y el turno queda identificado con su escenario");
}

/* ═══ 2 · FUERA DE GIT · VERIFICADO CONTRA EL `.gitignore` REAL ═══════════════════════════════════════════════ */
h("2 · el destino está ignorado — comprobado en el archivo, no prometido en un comentario");
{
  const gi = readFileSync("./.gitignore", "utf8");
  const lineas = gi.split(/\r?\n/).map((l) => l.trim());
  ok(lineas.includes(REGLA_GITIGNORE),
    `\`.gitignore\` contiene «${REGLA_GITIGNORE}»`, lineas.filter((l) => /replay/.test(l)).join(" · ") || "(ninguna línea menciona replay)");
  ok(REGLA_GITIGNORE.includes(DIR_REPLAY),
    "y la regla apunta al MISMO directorio donde el corredor escribe (no a uno parecido)", `${REGLA_GITIGNORE} vs ${DIR_REPLAY}`);
}

/* ═══ 3 · SEPARADO DE LA TELEMETRÍA SEGURA ════════════════════════════════════════════════════════════════════ */
h("3 · dos canales, no uno — la telemetría del gateway queda intacta");
{
  const src = readFileSync("./scripts/replay-local.mjs", "utf8");
  ok(!/telemetry|telemetria|telemetrySink/i.test(src.replace(/\/\*[\s\S]*?\*\//g, "")),
    "el módulo NO importa ni invoca la telemetría (fuera de los comentarios que explican por qué)");
  ok(/writeFileSync/.test(src) && !/fetch\(|https?:\/\//.test(src.replace(/\/\*[\s\S]*?\*\//g, "")),
    "escribe a disco local y no manda nada a ninguna red");

  // la otra mitad: el corredor sigue emitiendo telemetría, y ESA sigue sin datos de negocio. Se comprueba que el
  // cableado nuevo no se haya colado dentro del sink seguro.
  const runner = readFileSync("./_certificacion_v12_live.mjs", "utf8");
  ok(/persistirCorrida\(/.test(runner), "el corredor invoca la persistencia local");
  ok(/armarRegistroDeTurno\(/.test(runner), "…armando el registro por turno");
  const iTel = runner.indexOf("instalarTelemetria");
  const iRep = runner.indexOf("persistirCorrida(");
  ok(iTel !== -1 && iRep !== -1 && iTel !== iRep, "y son dos llamadas distintas, no una envolviendo a la otra");
}

console.log(`\n── _replay_local_gate: ${PASS} PASS · ${FAIL} FAIL (de ${PASS + FAIL}) ──`);
process.exit(FAIL ? 1 : 0);
