/* === _probe_paso0_prefijo.mjs · Paso 0 "ADI pierde el hilo" · A0.1 + A0.2 (2026-08-13) ==================
 * PROBE 100% OFFLINE: importa los módulos de prompt por URL file:// y NO importa el gateway ni ningún
 * adapter — no hay ninguna ruta de código acá que pueda producir una llamada pagada. El cableado del
 * gateway se verifica LEYENDO su fuente como texto, nunca ejecutándolo.
 * Correr con el candado de red puesto:  node --import ./scripts/offline-guard.mjs _probe_paso0_prefijo.mjs
 *
 * Qué demuestra:
 *   A0.1 · el system de NARRAR construido para los 7 modos comparte un prefijo común ≥95% en el PEOR par
 *          (medido antes del cambio: 21,3% — 7.679 de ~36.100 chars).
 *   A0.2 · la doctrina de CADA modo sigue presente en el system, byte-idéntica al contrato (MODES[].narrate).
 *   extra· fijo+variable === system completo · el segmento fijo es idéntico entre turnos con memoria,
 *          pantalla, reparación y preferencia distintas · el corte del caché queda declarado en el gateway.
 */
import { readFileSync } from "node:fs";

const M = await import(new URL("./src/adi/oracle/narratePromptC.js", import.meta.url).href);
const P = await import(new URL("./src/adi/oracle/persona.js", import.meta.url).href);
const C = await import(new URL("./src/adi/oracle/conversationalContract.js", import.meta.url).href);

const { buildNarrateSystemC, buildNarrateSystemSegments } = M;
const { ADI_PERSONA, renderInteractionMemory } = P;
const { MODES, MODE_KEYS, buildModeDispatch } = C;

let PASS = 0, FAIL = 0;
const ok = (cond, msg, extra) => {
  if (cond) { PASS++; console.log(`  ✓ ${msg}`); }
  else { FAIL++; console.log(`  ✗ ${msg}${extra ? " — " + extra : ""}`); }
};
const commonPrefix = (a, b) => { let i = 0; const n = Math.min(a.length, b.length); while (i < n && a[i] === b[i]) i++; return i; };
const pct = (x) => `${(x * 100).toFixed(1)}%`;

console.log("── A0.1 · prefijo común par a par entre los 7 modos ──");
const systems = MODE_KEYS.map((k) => buildNarrateSystemC(ADI_PERSONA, "", k, null, false, null));
let worst = { p: 1, par: "", cp: 0, max: 0 };
for (let i = 0; i < systems.length; i++) {
  for (let j = i + 1; j < systems.length; j++) {
    const cp = commonPrefix(systems[i], systems[j]);
    const max = Math.max(systems[i].length, systems[j].length);
    const p = cp / max;
    if (p < worst.p) worst = { p, par: `${MODE_KEYS[i]} ↔ ${MODE_KEYS[j]}`, cp, max };
  }
}
console.log(`  peor par: ${worst.par || "(todos idénticos)"} · prefijo común ${worst.cp || systems[0].length} de ${worst.max || systems[0].length} chars (${pct(worst.p)})`);
console.log(`  largo del system por modo: ${systems.map((s, i) => `${MODE_KEYS[i]}=${s.length}`).join(" · ")}`);
ok(worst.p >= 0.95, `prefijo común ≥ 95% del system en el PEOR par (obtuvo ${pct(worst.p)})`);
ok(systems.every((s) => s === systems[0]), "de hecho los 7 systems son BYTE-IDÉNTICOS (el modo del turno viaja en el payload, no en el system)");

console.log("\n── A0.2 · la doctrina de CADA modo sigue en el system, byte-idéntica al contrato ──");
for (const m of MODES) {
  ok(systems[0].includes(m.narrate), `doctrina de "${m.key}" presente byte-idéntica (${m.narrate.length} chars del contrato)`);
}
ok(systems[0].includes(buildModeDispatch()), "el dispatch COMPLETO (los 7 modos con su header) está embebido tal cual");

console.log("\n── SEGMENTOS · el corte del caché queda donde el prefijo deja de ser estable ──");
const MEM = renderInteractionMemory({ identidad: { nombre: "JC", empresa: "Sentrix" }, preferencias: { trato: "usted" } });
const REP = { tipo: "correccion", corrige: ["entidad"], supuestos: [] };
const variantes = [
  ["turno pelado", buildNarrateSystemSegments(ADI_PERSONA, "", "default", null, false, null)],
  ["con memoria de sesión", buildNarrateSystemSegments(ADI_PERSONA, MEM, "diagnostico", null, false, null)],
  ["con contexto de pantalla", buildNarrateSystemSegments(ADI_PERSONA, "", "evidencia", null, true, null)],
  ["con reparación", buildNarrateSystemSegments(ADI_PERSONA, "", "seguimiento", null, false, REP)],
  ["con preferencia no-default", buildNarrateSystemSegments(ADI_PERSONA, MEM, "decision", { contentScope: "data_only", detailLevel: "brief" }, true, REP)],
];
const fijo0 = variantes[0][1].fijo;
for (const [nombre, seg] of variantes) {
  ok(seg.fijo === fijo0, `segmento FIJO idéntico en "${nombre}" (${seg.fijo.length} chars)`);
}
const segFull = variantes[4][1];
const fullStr = buildNarrateSystemC(ADI_PERSONA, MEM, "decision", { contentScope: "data_only", detailLevel: "brief" }, true, REP);
ok(segFull.fijo + segFull.variable === fullStr, "fijo + variable === system completo, byte por byte");
ok(segFull.variable.includes("REPARACIÓN CONTEXTUAL") && segFull.variable.includes("CONTEXTO DE PANTALLA") && segFull.variable.includes("MEMORIA DE INTERACCIÓN"),
  "todo lo por-turno (reparación · pantalla · memoria) vive en la cola VARIABLE");
console.log(`  turno típico (sin nada por-turno): fijo ${variantes[0][1].fijo.length} chars · variable ${variantes[0][1].variable.length} chars · cacheable ${pct(variantes[0][1].fijo.length / (variantes[0][1].fijo.length + variantes[0][1].variable.length))}`);

// cableado del gateway: se lee la FUENTE como texto (nunca se ejecuta) y se exige el corte declarado.
const GW = readFileSync(new URL("./src/adi/llm/gatewayCore.js", import.meta.url), "utf8");
// [,)] y no ")": AMPLITUD F1 (2026-08-13) agregó el 7º argumento `datoNegocio` DESPUÉS de la reparación — la
// GARANTÍA de este assert (la reparación del payload viaja al builder segmentado) no cambió; solo el FORMATO de
// la llamada (la reparación ya no es el último argumento). Análisis garantía-vs-formato: ajuste legítimo.
ok(/buildNarrateSystemSegments\([\s\S]{0,260}?payload\.reparacion \|\| null[,)]/.test(GW),
  "el gateway arma el system de NARRAR con los segmentos (misma segmentación que PLAN)");
ok(/\{ text: _segN\.fijo, cache: true \}, \{ text: _segN\.variable, cache: false \}/.test(GW),
  "y declara el corte del caché exactamente al final del segmento fijo");

// comparación para el informe: costo nominal de mandar los 7 modos siempre vs. mover el dispatch a la cola.
const dispatchTodos = buildModeDispatch().length;
const porModo = MODE_KEYS.map((k) => buildModeDispatch(k).length);
console.log(`\n── COMPARACIÓN (para el informe) ──`);
console.log(`  dispatch completo (7 modos): ${dispatchTodos} chars · CACHEADO en cada llamada`);
console.log(`  dispatch de un solo modo: ${Math.min(...porModo)}–${Math.max(...porModo)} chars · iría SIN caché si viajara en la cola`);
console.log(`  (la alternativa de mover el dispatch por-modo a la cola variable además VIOLA A0.2: los 7 textos deben estar presentes)`);

console.log(`\n── _probe_paso0_prefijo: ${PASS} PASS · ${FAIL} FAIL ──`);
process.exit(FAIL ? 1 : 0);
