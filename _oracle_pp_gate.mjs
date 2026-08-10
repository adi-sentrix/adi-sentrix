/* === _oracle_pp_gate.mjs · ARQUITECTURA C · GATE DE LA UNIDAD "pp" (puntos porcentuales) — turno 18 del veredicto
 * de 18 turnos (owner 2026-07-29) === Hallazgo: parseFigures (src/adi/boleta.js) solo reconocía 4 unidades
 * ($/%/x/días) — un número narrado como "5 puntos porcentuales" era INVISIBLE al guard entero (ni bloqueado ni
 * autorizado), así que una meta/brecha inventada en esa forma pasaba sin control (repro real: "establecé un
 * objetivo de incrementar al menos 5 puntos porcentuales" cuando la brecha real de Falabella era 8.1pp — "5" no
 * sale de ningún cálculo válido — guardC la dejó pasar con 0 violaciones antes del fix).
 * Fix: 5ª unidad "pp" en parseFigures/_fmtC (boleta.js) + _isCalc reconoce pp como derivable de DOS figs "pct"
 * (guardC.js). Determinístico · sin LLM (guardC() corre directo sobre fixtures fijos, como _oracle_total_gate.mjs).
 */
import { guardC } from "./src/adi/oracle/guardC.js";
import { fig } from "./src/adi/boleta.js";

// ledger sintético: Falabella margen 22%, benchmark 30.1% (brecha real = 8.1pp)
const ledger = { figs: [
  fig("Falabella · Margen", "22%", { unit: "pct", raw: 22 }),
  fig("Benchmark de margen", "30.1%", { unit: "pct", raw: 30.1 }),
] };
const results = [{ tool: "marginRead", facts: { rows: [{ name: "Falabella", margen: 22 }] } }];

const CASES = [
  { label: "A · MALO — meta inventada en 'puntos porcentuales' (antes pasaba en falso)",
    text: "Establecé un objetivo de incrementar al menos 5 puntos porcentuales en el margen de Falabella.", expectOk: false },
  { label: "B · BUENO — brecha REAL (8.1 = 30.1−22) narrada como 'puntos porcentuales' (debe autorizarse, calc pp→pct)",
    text: "Falabella tiene una brecha de 8.1 puntos porcentuales frente al benchmark de 30.1%.", expectOk: true },
  { label: "B2 · BUENO — misma brecha real, abreviada 'pp'",
    text: "Falabella tiene una brecha de 8.1pp frente al benchmark de 30.1%.", expectOk: true },
  { label: "C · BUENO — 'puntos' NO calificado no debe activar la unidad pp ni bloquear nada",
    text: "Hay tres puntos importantes a revisar antes de decidir sobre Falabella.", expectOk: true },
  { label: "D · MALO — 'puntos de margen' inventados, no derivables de las 2 pct del ledger",
    text: "La meta es cerrar 15 puntos de margen en Falabella este trimestre.", expectOk: false },
];

let pass = 0, fail = 0;
for (const c of CASES) {
  const g = guardC(c.text, { ledger, results, trace: null, question: "" });
  const ok = g.ok === c.expectOk;
  console.log(`  ${ok ? "✓" : "✗"} ${c.label} → esperaba ${c.expectOk ? "OK" : "BLOQUEO"}, obtuvo ${g.ok ? "OK" : "BLOQUEO(" + JSON.stringify(g.violations) + ")"}`);
  if (ok) pass++; else fail++;
}
console.log(`\n── _oracle_pp_gate: ${pass} PASS · ${fail} FAIL (de ${CASES.length}) ──`);
process.exit(fail ? 1 : 0);
