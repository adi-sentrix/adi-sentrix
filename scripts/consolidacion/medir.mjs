/* === scripts/consolidacion/medir.mjs · EL TOTAL (consolidación, infraestructura común) ═══════════════════════════════════
 * El control sobre el corpus COMPLETO: los catálogos v13–v28 más N encargos al azar con semilla fija. El gate
 * `_invariantes_consolidacion_gate.mjs` corre una muestra fija (rápida); este script corre «todo» y sirve para medir ANTES y DESPUÉS
 * de una pieza (`--raiz` apunta a otro árbol del repo, p. ej. un worktree del commit anterior).
 *
 *   node --import ./scripts/offline-guard.mjs scripts/consolidacion/medir.mjs [opciones]
 *     --raiz <ruta>      árbol del repo cuyos módulos se miden (por defecto este repo)
 *     --sin-catalogos    no incluir los catálogos v13–v28
 *     --azar <N>         N encargos al azar (por defecto 3000; 0 = ninguno)
 *     --semilla <texto>  semilla del azar (por defecto adi-consolidacion-1)
 *     --cobertura <M>    el sub-azar de COBERTURA: al menos M encargos por cada combinación válida (tema × cierre × eje × concepto × universo ×
 *                        premisa × criterio), con su propia semilla derivada (por defecto 0 = ninguno; ver `cobertura.mjs`)
 *     --solo-cobertura   solo el sub-azar de cobertura (sin catálogos ni el azar general)
 *     --familias F1,F2   solo esas familias (por defecto todas las registradas)
 *     --sin <F:regla,…>  reglas que no se cuentan (p. ej. F1:prioridad-sin-marca al medir un árbol anterior a la marca)
 *     --detalle <K>      imprime hasta K violaciones por regla (por defecto 4)
 *     --json <archivo>   guarda el resultado completo
 * OFFLINE: ningún módulo que se carga abre una conexión. */
import { writeFileSync } from "node:fs";
import { cargarBase, RAIZ_POR_DEFECTO } from "./base.mjs";
import { armarCorpus } from "./corpus.mjs";
import { cargarFamilias, correrCorpus } from "./marco.mjs";

const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i >= 0 && i + 1 < process.argv.length && !process.argv[i + 1].startsWith("--") ? process.argv[i + 1] : d; };
const tiene = (k) => process.argv.includes(k);

const raiz = arg("--raiz", RAIZ_POR_DEFECTO);
const nAzar = Number(arg("--azar", 3000));
const semilla = arg("--semilla", "adi-consolidacion-1");
const minCobertura = Number(arg("--cobertura", 0));
const soloCobertura = tiene("--solo-cobertura");
const solo = arg("--familias") ? arg("--familias").split(",") : null;
const excluir = arg("--sin") ? arg("--sin").split(",") : [];
const detalle = Number(arg("--detalle", 4));

const base = await cargarBase(raiz);
const familias = await cargarFamilias(solo);
const t0 = Date.now();
const { casos, estadistica, coberturaEstadistica } = await armarCorpus(base, { catalogos: !tiene("--sin-catalogos") && !soloCobertura, azar: nAzar > 0 && !soloCobertura ? { semilla, n: nAzar } : null, cobertura: minCobertura > 0 ? { semilla, minimo: minCobertura } : null });
const res = correrCorpus(base, casos, { familias, excluirReglas: excluir });
const seg = ((Date.now() - t0) / 1000).toFixed(1);

console.log(`── CONTROL DE INVARIANTES · raíz ${raiz} · familias ${familias.map((f) => f.id).join(",")} · ${seg}s ──`);
console.log(`corpus: ${res.total} encargos (${Object.entries(res.porOrigen).map(([o, x]) => `${o} ${x.total}`).join(" · ")}) · Entregas compuestas ${res.compuestos} · sin Entrega ${res.sinEntrega} · excepciones ${res.excepciones}`);
if (estadistica) console.log(`generador: semilla «${semilla}» · ${estadistica.intentos} candidatos · ${estadistica.rechazados} rechazados por el validador`);
if (coberturaEstadistica) console.log(`cobertura: semilla «${semilla}:cobertura» · mínimo ${minCobertura} por celda · ${coberturaEstadistica.celdas} celdas · ${coberturaEstadistica.intentos} intentos · ${coberturaEstadistica.rechazados} rechazados · sin completar: ${coberturaEstadistica.sinCompletar.length}`);
for (const [o, x] of Object.entries(res.porOrigen)) console.log(`  ${o}: ${x.compuestos} Entregas · ${x.violaciones} violaciones firmes`);
console.log(`VIOLACIONES FIRMES: ${res.firmes} en ${res.casosConViolacion} Entregas · ABIERTAS (comportamiento nuevo, a decisión): ${Object.values(res.abiertas).reduce((a, b) => a + b, 0)}`);
for (const [k, n] of Object.entries(res.porRegla).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(5)}  ${k}${res.abiertas[k] ? "  (ABIERTA)" : ""}`);
  for (const v of res.violaciones.filter((x) => `${x.familia}:${x.regla}` === k).slice(0, detalle)) console.log(`           ${v.caso}: ${v.detalle}`);
}
if (arg("--json")) writeFileSync(arg("--json"), JSON.stringify({ raiz, semilla, nAzar, ...res }, null, 1));
process.exit(0);
