/* === scripts/consolidacion/auditar_cobertura.mjs · LA AUDITORÍA DE COBERTURA DEL GENERADOR (consolidación, segunda vuelta) ═══
 * Compara las combinaciones que el validador acepta (tema × cierre × eje × concepto × forma de universo × premisa × criterio, ver
 * `cobertura.mjs`) con lo que produce el generador al azar y lo que traen los catálogos v13–v28. No compone Entregas (solo valida):
 * corre en segundos.
 *
 *   node --import ./scripts/offline-guard.mjs scripts/consolidacion/auditar_cobertura.mjs [opciones]
 *     --raiz <ruta>     árbol del repo cuyos módulos se auditan (por defecto este repo)
 *     --azar <N>        N encargos del generador general (por defecto 3000)
 *     --semilla <txt>   semilla del generador general (por defecto adi-consolidacion-1)
 *     --cobertura <M>   además, el sub-azar de cobertura con mínimo M por celda (0 = no)
 *     --ceros <K>       imprime hasta K celdas en cero por dimensión (por defecto 12)
 *     --json <archivo>  guarda las cifras */
import { writeFileSync } from "node:fs";
import { cargarBase, RAIZ_POR_DEFECTO } from "./base.mjs";
import { cargarCatalogos } from "./corpus.mjs";
import { generarEncargos } from "./generador.mjs";
import { especificacionesDeCeldas, generarCobertura, auditarCobertura } from "./cobertura.mjs";

const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i >= 0 && i + 1 < process.argv.length && !process.argv[i + 1].startsWith("--") ? process.argv[i + 1] : d; };
const raiz = arg("--raiz", RAIZ_POR_DEFECTO), nAzar = Number(arg("--azar", 3000)), semilla = arg("--semilla", "adi-consolidacion-1"), minCob = Number(arg("--cobertura", 0)), kCeros = Number(arg("--ceros", 12));

const base = await cargarBase(raiz);
const esp = especificacionesDeCeldas(base, { semilla });
const NOMBRE = { P: "tema×cierre×eje", C: "×concepto", U: "×forma de universo", F: "la foto (concepto)", F2: "la foto (par de conceptos)", Q: "×tipo de premisa", K: "×criterio", D: "definición", S: "simulación", M: "varias partes (par)", M3: "varias partes (terna)" };
const dimsOrden = ["P", "C", "U", "F", "F2", "Q", "K", "D", "S", "M", "M3"];

const cat = cargarCatalogos().map((c) => ({ ...c }));
const azar = nAzar > 0 ? (await generarEncargos(base, { semilla, n: nAzar })).casos : [];
const aCat = auditarCobertura(base, cat, { espacio: esp }), aAzar = auditarCobertura(base, azar, { espacio: esp });
const aTodo = auditarCobertura(base, [...cat, ...azar], { espacio: esp });
let aCob = null, cob = null;
if (minCob > 0) { cob = generarCobertura(base, { semilla, minimo: minCob, espacio: esp }); aCob = auditarCobertura(base, cob.casos, { espacio: esp }); }

console.log(`── AUDITORÍA DE COBERTURA · raíz ${raiz} · generador general: ${azar.length} encargos (semilla «${semilla}») · catálogos: ${cat.length} ──`);
console.log(`celdas posibles ${esp.posibles} · válidas (el validador acepta un encargo que las ejerce) ${esp.validas.size} · no construibles ${esp.noConstruibles.length}`);
const fila = (n, a) => `${String(a ? a.ceros : "-").padStart(5)} en cero ${String(a ? a.pocas : "-").padStart(5)} con <5`;
console.log(`${"dimensión".padEnd(28)} ${"válidas".padStart(7)} | ${"catálogos".padEnd(22)} | ${"azar general".padEnd(22)} | ${"catálogos+azar".padEnd(22)}${aCob ? ` | ${"+ sub-azar de cobertura".padEnd(22)}` : ""}`);
const tot = { v: 0, c: 0, a: 0, t: 0, k: 0 };
for (const d of dimsOrden) {
  const v = (aTodo.porDim[d] || {}).validas || 0; if (!v) continue;
  tot.v += v; tot.c += aCat.porDim[d].ceros; tot.a += aAzar.porDim[d].ceros; tot.t += aTodo.porDim[d].ceros; if (aCob) tot.k += aCob.porDim[d].ceros;
  console.log(`${(d + " · " + NOMBRE[d]).padEnd(28)} ${String(v).padStart(7)} | ${fila(d, aCat.porDim[d]).padEnd(22)} | ${fila(d, aAzar.porDim[d]).padEnd(22)} | ${fila(d, aTodo.porDim[d]).padEnd(22)}${aCob ? ` | ${fila(d, aCob.porDim[d]).padEnd(22)}` : ""}`);
}
console.log(`${"TOTAL".padEnd(28)} ${String(tot.v).padStart(7)} | ${String(tot.c).padStart(5)} en cero${" ".repeat(13)}| ${String(tot.a).padStart(5)} en cero${" ".repeat(13)}| ${String(tot.t).padStart(5)} en cero${" ".repeat(13)}${aCob ? `| ${String(tot.k).padStart(5)} en cero` : ""}`);
if (cob) console.log(`sub-azar de cobertura: ${cob.casos.length} encargos · ${cob.estadistica.intentos} intentos · ${cob.estadistica.rechazados} rechazados · celdas sin completar el mínimo: ${cob.estadistica.sinCompletar.length}${cob.estadistica.sinCompletar.length ? " (" + cob.estadistica.sinCompletar.slice(0, 8).join(", ") + ")" : ""}`);
console.log(`\nCELDAS QUE EL GENERADOR GENERAL (${azar.length}) NO PRODUCE NI LOS CATÁLOGOS (en cero) — por dimensión:`);
for (const d of dimsOrden) {
  const z = aTodo.ceros.filter((c) => c.split(":")[0] === d); if (!z.length) continue;
  console.log(`  ${d} (${z.length}): ${z.slice(0, kCeros).join(" · ")}${z.length > kCeros ? " · …" : ""}`);
}
if (esp.noConstruibles.length) console.log(`\nNO CONSTRUIBLES (posibles que el validador/constructor no logró ejercer): ${esp.noConstruibles.length}\n  ${esp.noConstruibles.slice(0, 40).join(" · ")}`);
if (arg("--json")) writeFileSync(arg("--json"), JSON.stringify({ raiz, semilla, nAzar, posibles: esp.posibles, validas: esp.validas.size, noConstruibles: esp.noConstruibles, porDim: { catalogos: aCat.porDim, azar: aAzar.porDim, todo: aTodo.porDim, cobertura: aCob && aCob.porDim }, ceros: aTodo.ceros, pocas: aTodo.pocas }, null, 1));
process.exit(0);
