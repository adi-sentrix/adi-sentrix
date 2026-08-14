/* === _calibracion_notario.mjs · EL INSTRUMENTO VERBOSO DE LA MATRIZ DE LA CONSTITUCIÓN ======================
 * Reporta caso por caso: qué afirma, de qué tipo es, por qué chequeo debe morir y si murió por la razón
 * correcta (las 5 exigencias del owner, 2026-08-14). Los CASOS y la evaluación viven en _calibracion_casos.mjs,
 * COMPARTIDOS con el candado de la suite (_constitucion_matriz_gate.mjs): una sola lista, una sola verdad.
 * Historia: la línea base v1 fue 0/5 positivos · 2/6 escapes; v2 con exigencias 1/8 · 3/8; el 2026-08-14 quedó
 * DONE (8/8 · 9/9) y ese mismo día se convirtió en gate. Este archivo queda como lupa de diagnóstico.
 * CERO red, CERO .env. */
import fs from "fs";
import { CASOS, evaluar } from "./_calibracion_casos.mjs";

const filas = [];
console.log("╔════ MATRIZ DE LA CONSTITUCIÓN · instrumento verboso ════╗");
for (const c of CASOS) {
  const r = evaluar(c);
  let estado;
  if (c.espera === "PASA") estado = r.ok ? "✅ PASA" : "❌ FALSO POSITIVO";
  else if (!r.ok) estado = (c.chequeoEsperado && c.chequeoEsperado.test(String(r.verdict || ""))) ? "✅ MUERE por su chequeo" : "🟠 MUERE POR LA RAZÓN EQUIVOCADA";
  else estado = c.construido ? "🔴 SE ESCAPÓ (regresión)" : "🟡 SE ESCAPA (chequeo por construir)";
  filas.push({ id: c.id, tipo: c.tipo, afirma: c.afirma, espera: c.espera, chequeoEsperado: c.chequeoEsperado ? String(c.chequeoEsperado) : null, resultado: r, estado });
  console.log(`\n${estado} · ${c.id}`);
  console.log(`   afirma: ${c.afirma}`);
  console.log(`   tipo: ${c.tipo}${c.chequeoEsperado ? ` · debe morir por: ${c.chequeoEsperado}` : ""}`);
  if (!r.ok) console.log(`   murió por: ${r.verdict} → ${r.violations[0] || ""}`);
}

const pos = filas.filter((f) => f.espera === "PASA");
const neg = filas.filter((f) => f.espera === "MUERE");
const fp = pos.filter((f) => f.estado.includes("FALSO")).length;
const bien = neg.filter((f) => f.estado.includes("por su chequeo")).length;
console.log(`\n╔════ DEFINITION OF DONE ════╗`);
console.log(`Positivos que pasan:      ${pos.length - fp}/${pos.length}`);
console.log(`Negativos por SU chequeo: ${bien}/${neg.length}`);
console.log(`El candado de la suite es _constitucion_matriz_gate.mjs — este reporte es la lupa, aquel es la ley.`);
fs.writeFileSync("_calibracion_notario.json", JSON.stringify({ fecha: "2026-08-14", version: 3, filas }, null, 2), "utf8");
console.log(`matriz completa en _calibracion_notario.json`);
