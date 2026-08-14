/* === _constitucion_matriz_gate.mjs · EL CANDADO DE LA CONSTITUCIÓN (exigencia 5 del owner, 2026-08-14) ======
 * La matriz de calibración, convertida en gate el día que quedó verde: 8 respuestas legítimas (5 congeladas de
 * Sonnet —P2 corregida al motor— + 3 paráfrasis) DEBEN pasar el muro, y 9 inventos (7 sintéticos por categoría
 * + 2 MEDIDOS en salidas reales del modelo) DEBEN morir cada uno POR SU chequeo — morir por otra razón cuenta
 * como FAIL (lección del caso «meta»). Los casos y la evaluación viven en _calibracion_casos.mjs (compartidos
 * con el instrumento verboso): una sola lista, imposible que gate e instrumento diverjan.
 * Si este gate se pone rojo, un ajuste del notario abrió un falso positivo o dejó vivo un invento — la regla
 * de la constitución es que ese ajuste se descarta, no que el gate se afloje. CERO red, CERO .env. */
import { CASOS, evaluar } from "./_calibracion_casos.mjs";

let pass = 0, fail = 0;
for (const c of CASOS) {
  const r = evaluar(c);
  let ok, motivo;
  if (c.espera === "PASA") { ok = r.ok; motivo = ok ? "pasa el muro" : `FALSO POSITIVO: ${r.verdict} · ${(r.violations[0] || "").slice(0, 110)}`; }
  else if (r.ok) { ok = false; motivo = "SE ESCAPÓ: el invento pasó el muro"; }
  else { ok = c.chequeoEsperado.test(String(r.verdict || "")); motivo = ok ? `muere por su chequeo (${r.verdict})` : `MUERE POR LA RAZÓN EQUIVOCADA: ${r.verdict} (se esperaba ${c.chequeoEsperado})`; }
  console.log(`  ${ok ? "✓" : "✗"} ${c.id} — ${motivo}`);
  ok ? pass++ : fail++;
}
console.log(`\n── _constitucion_matriz_gate: ${pass} PASS · ${fail} FAIL (de ${CASOS.length}) ──`);
process.exit(fail ? 1 : 0);
