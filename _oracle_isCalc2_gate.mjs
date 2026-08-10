/* === _oracle_isCalc2_gate.mjs · ARQUITECTURA C · GATE DE _isCalc2 (resta-de-restas scopeada por entidad) ===
 * turno 8 del veredicto de 18 turnos (owner 2026-07-29): el caso puntual reportado ("comparar 2 SKU contra el
 * benchmark") NO reproduce hoy (el benchmark es una constante global — la resta de brechas colapsa a una resta
 * de DOS figs originales que el _isCalc de nivel 1 YA autoriza). Pero la auditoría confirmó, con un test sintético
 * determinístico, un hueco ARQUITECTÓNICO real: si dos entidades tuvieran cada una su propio benchmark (el
 * contrato ya lo declara per-fila aunque ningún tenant lo puebla hoy), "brecha_A − brecha_B" es una resta de DOS
 * CÁLCULOS ya autorizados (nivel 2) que el guard de nivel 1 no ve — bloqueaba en falso una resta 100% derivable.
 * Fix: _isCalc2 en guardC.js, SCOPEADO a las 1-2 entidades que la narración NOMBRA (nunca todo el ledger — con
 * decenas de figs sueltas, un nivel 2 sin ese scope generaría miles de combinaciones y cualquier invento
 * "calzaría" con algo). Determinístico · sin LLM (guardC() corre directo sobre un ledger sintético fijo).
 */
import { guardC } from "./src/adi/oracle/guardC.js";
import { fig } from "./src/adi/boleta.js";

// 3 entidades con BENCHMARK PROPIO distinto (el escenario que hoy ningún tenant vivo puebla, pero que el
// contrato permite) — elegidos para que NINGUNA combinación de nivel-1 (par de las 6 cifras sueltas) colisione
// por accidente con los targets de nivel-2 que se prueban abajo (verificado a mano, ver comentario del script).
const ledger = { figs: [
  fig("Alfa · Margen", "11.3%", { unit: "pct", raw: 11.3 }),
  fig("Alfa · Benchmark propio", "26.9%", { unit: "pct", raw: 26.9 }),   // gap_Alfa = 15.6
  fig("Beta · Margen", "17.8%", { unit: "pct", raw: 17.8 }),
  fig("Beta · Benchmark propio", "27.4%", { unit: "pct", raw: 27.4 }),  // gap_Beta = 9.6  (gap_Alfa − gap_Beta = 6.0)
  fig("Gama · Margen", "21.1%", { unit: "pct", raw: 21.1 }),
  fig("Gama · Benchmark propio", "24.5%", { unit: "pct", raw: 24.5 }),  // gap_Gama = 3.4  (gap_Alfa − gap_Gama = 12.2)
] };
const results = [{ tool: "marginRead", facts: { rows: [{ name: "Alfa" }, { name: "Beta" }, { name: "Gama" }] } }];

const CASES = [
  { label: "POS-A · nivel-2 legítimo — Alfa y Beta comparados, Gama ni se nombra (antes bloqueaba en falso)",
    text: "Alfa tiene una brecha de 15.6 puntos porcentuales frente a su benchmark, y Beta de 9.6. Alfa está 6.0 puntos porcentuales peor que Beta.",
    expectOk: true },
  { label: "POS-B · control nivel-1 (regresión) — una sola brecha, ya autorizada hoy sin _isCalc2",
    text: "Alfa tiene una brecha de 15.6 puntos porcentuales frente a su benchmark propio de 26.9%.",
    expectOk: true },
  { label: "NEG-A · Gama NO nombrada — un invento que solo 'calza' combinando Alfa con Gama (prueba el scope, no debe autorizar)",
    text: "Alfa está 12.2 puntos porcentuales peor que Beta.",   // 12.2 = gap_Alfa − gap_Gama, NO gap_Alfa − gap_Beta (6.0) — Gama nunca se nombra
    expectOk: false },
  { label: "NEG-B · nivel 3 — encadenar el resultado de nivel-2 (6.0) con otra cifra (15.6) — tope duro, no recursivo",
    text: "Alfa, Beta y Gama están en juego. La diferencia acumulada de 21.6 puntos porcentuales entre Alfa y Beta explica la brecha.",
    expectOk: false },
  { label: "NEG-C · cifra lisa y llana inventada, ninguna entidad la explica ni de nivel 1 ni de nivel 2",
    text: "Alfa está 99.9 puntos porcentuales por debajo de Beta.",
    expectOk: false },
];

let pass = 0, fail = 0;
for (const c of CASES) {
  const g = guardC(c.text, { ledger, results, trace: null, question: "" });
  const ok = g.ok === c.expectOk;
  console.log(`  ${ok ? "✓" : "✗"} ${c.label} → esperaba ${c.expectOk ? "OK" : "BLOQUEO"}, obtuvo ${g.ok ? "OK" : "BLOQUEO(" + JSON.stringify(g.violations) + ")"}`);
  if (ok) pass++; else fail++;
}
console.log(`\n── _oracle_isCalc2_gate: ${pass} PASS · ${fail} FAIL (de ${CASES.length}) ──`);
process.exit(fail ? 1 : 0);
