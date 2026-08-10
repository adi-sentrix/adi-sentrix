/* === _kpis_benchmark_integridad_gate.mjs · gate puntual · integridad #1 (evidenceSpec) ===
 * Verifica que src/adi/sentrix/kpis.js YA NO lee ".benchmark" crudo de una fila del dataset
 * (cm.benchmark / sku.benchmark / rows[0].benchmark) y que en su lugar pasa SIEMPRE por
 * businessPolicy.benchmarkOf(entity) — el único punto que respeta _benchmarkOverride
 * (memoria de criterio del owner, C.2). Sin este gate, un override activo podía hacer que
 * ADI narrara un número y el "Recibo Frío" de Sentrix mostrara otro para la MISMA entidad,
 * MISMO turno — el defecto de integridad #1 detectado en la auditoría de evidenceSpec.
 *
 * No ejecuta el runtime completo (no depende de dataset/tenant cargado) — es un gate ESTÁTICO
 * de fuente: grepea el archivo y falla si encuentra el patrón prohibido. Barato, determinístico,
 * detecta regresiones futuras (alguien reintroduce ".benchmark" a mano en un nuevo helper).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TARGET = path.join(__dirname, "src/adi/sentrix/kpis.js");

const src = readFileSync(TARGET, "utf8");
const lines = src.split("\n");

// patrón prohibido: `<algo>.benchmark` que NO sea parte de un identificador tipo benchmarkOf(...)
// (evita falsos positivos con la palabra "Benchmark" en labels de UI, o con "benchmarkOf" mismo).
const PROHIBIDO = /\b([a-zA-Z_$][\w$]*)\.benchmark\b(?!\w)/g;

let fails = [];
lines.forEach((line, i) => {
  let m;
  PROHIBIDO.lastIndex = 0;
  while ((m = PROHIBIDO.exec(line))) {
    // ignora comentarios de línea que documentan el fix (mencionan "cm.benchmark crudo" a propósito)
    const antesDelMatch = line.slice(0, m.index);
    const esComentario = antesDelMatch.includes("//") && antesDelMatch.indexOf("//") < m.index;
    if (esComentario) continue;
    fails.push({ ln: i + 1, text: line.trim(), match: m[0] });
  }
});

let pass = true;
console.log("=== _kpis_benchmark_integridad_gate ===");
if (fails.length) {
  pass = false;
  console.log(`FALLA — ${fails.length} lectura(s) cruda(s) de ".benchmark" en kpis.js:`);
  fails.forEach((f) => console.log(`  L${f.ln}: ${f.match}  ←  ${f.text}`));
} else {
  console.log("OK — ninguna lectura cruda de \".benchmark\" sobre una fila del dataset.");
}

// contra-chequeo positivo: benchmarkOf() debe estar importado Y usado (que el gate no sea vacuo)
const importaBenchmarkOf = /import\s*\{[^}]*\bbenchmarkOf\b[^}]*\}\s*from\s*["']\.\.\/\.\.\/config\/businessPolicy\.js["']/.test(src);
const usaBenchmarkOf = (src.match(/\bbenchmarkOf\s*\(/g) || []).length;
console.log(`import benchmarkOf desde businessPolicy.js: ${importaBenchmarkOf ? "sí" : "NO"}`);
console.log(`llamadas a benchmarkOf(...): ${usaBenchmarkOf}`);
if (!importaBenchmarkOf || usaBenchmarkOf < 3) {
  pass = false;
  console.log("FALLA — el gate esperaba import + ≥3 usos (sku/marca/cliente).");
}

console.log(pass ? "\n✅ GATE PASA" : "\n❌ GATE FALLA");
process.exit(pass ? 0 : 1);
