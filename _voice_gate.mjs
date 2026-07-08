/* === _voice_gate.mjs · GATE del GUARD DE VOZ determinístico (stripRoboticVoice) ===
 * Lockea: (1) mata aperturas de plantilla ("He revisado tus datos…", "Las proyecciones indican que…").
 * (2) mata muletillas conectoras ("Sin embargo,", "Es importante notar que"). (3) NO toca voz natural ("Mirá,…").
 * (4) idempotente (aplicar 2x = 1x). (5) number-safe (ninguna cifra cambia). (6) preserva recomendaciones reales
 * ("es importante que revises…"). Puro string · sin key · no toca motor/seam. */
import esbuild from "esbuild"; import { pathToFileURL } from "url"; import path from "path"; import fs from "fs";
const root = process.cwd(); const entry = path.join(root, "_vge.js"), out = path.join(root, "_vgb.mjs");
fs.writeFileSync(entry, 'export { stripRoboticVoice } from "./src/adi/llm/voiceGuard.js";\n');
await esbuild.build({ entryPoints: [entry], bundle: true, outfile: out, format: "esm", platform: "node", logLevel: "silent" });
const M = await import(pathToFileURL(out).href + "?t=" + Math.random());
try { fs.unlinkSync(entry); } catch {} try { fs.unlinkSync(out); } catch {}
const { stripRoboticVoice: SV } = M;

const _nums = (s) => (String(s).match(/\$?\d[\d.,]*[%MK]?/g) || []).join("|");

const cases = [
  // 1 · aperturas de plantilla
  { n: "1 · 'He revisado tus datos y te cuento que'", in: "He revisado tus datos y te cuento que hay tres áreas donde se te va plata.", out: "Hay tres áreas donde se te va plata." },
  { n: "2 · 'He revisado tus datos.' + frase", in: "He revisado tus datos. Primero, los $4.9M de contribución no capturada.", out: "Primero, los $4.9M de contribución no capturada." },
  { n: "3 · 'Las proyecciones indican que'", in: "Las proyecciones indican que un crecimiento del 3% llevaría el total a $103.0M.", out: "Un crecimiento del 3% llevaría el total a $103.0M." },
  { n: "4 · 'He analizado tus datos:'", in: "He analizado tus datos: Falabella cede margen.", out: "Falabella cede margen." },
  { n: "5 · 'Según los datos,'", in: "Según los datos, Lider deja 21.5% de margen.", out: "Lider deja 21.5% de margen." },
  { n: "5b · 'He estado revisando… he encontrado algunos puntos donde' (embebido → frase válida)", in: "He estado revisando tus datos y he encontrado algunos puntos donde se te va plata: Falabella $1.6M.", out: "Algunos puntos donde se te va plata: Falabella $1.6M." },
  { n: "5c · 'Tras revisar tus datos,'", in: "Tras revisar tus datos, hay tres focos de pérdida.", out: "Hay tres focos de pérdida." },
  { n: "5d · 'Estuve analizando la información y detecté que'", in: "Estuve analizando la información y detecté que Falabella cede $1.6M.", out: "Falabella cede $1.6M." },
  { n: "5e · flow3: 'Estuve revisando los números de X y hay…' (ancla en 'los números de')", in: "Estuve revisando los números de Falabella y hay un par de cosas que afectan tu margen. Primero, $1.6M en Falabella.", out: "Hay un par de cosas que afectan tu margen. Primero, $1.6M en Falabella." },
  { n: "5f · 'He estado analizando la situación y detecté que'", in: "He estado analizando la situación y detecté que Falabella pierde $1.6M.", out: "Falabella pierde $1.6M." },
  { n: "5f2 · 'He estado revisando TUS números y hay…' (variante tus/mis/sus)", in: "He estado revisando tus números y hay tres áreas donde se te va plata. Primero, $4.9M.", out: "Hay tres áreas donde se te va plata. Primero, $4.9M." },
  { n: "5f3 · 'Revisé tus cifras y encontré que'", in: "Revisé tus cifras y encontré que el capital dormido suma $33K.", out: "El capital dormido suma $33K." },
  { n: "5g · 'Claramente, estos datos indican que' encadenado al inicio", in: "Claramente, estos datos indican que se debe actuar en Falabella.", out: "Se debe actuar en Falabella." },
  { n: "5h · 'Claramente,' + 'estos datos indican que' mid-texto", in: "Falabella pierde $1.6M. Claramente, estos datos indican que hay que actuar.", out: "Falabella pierde $1.6M. Hay que actuar." },
  // 2 · muletillas conectoras mid-texto
  { n: "6 · 'Sin embargo,' mid-frase", in: "El bloque suma $5.0M. Sin embargo, este crecimiento se concentra en 7 clientes.", out: "El bloque suma $5.0M. Este crecimiento se concentra en 7 clientes." },
  { n: "7 · 'Es importante notar que'", in: "Genera $3.0M. Es importante notar que este incremento se concentra en 7 clientes.", out: "Genera $3.0M. Este incremento se concentra en 7 clientes." },
  { n: "8 · 'No obstante,' al inicio", in: "No obstante, hay un detalle crítico en el margen.", out: "Hay un detalle crítico en el margen." },
  // 3 · voz natural: NO tocar
  { n: "9 · 'Mirá,' natural → intacto", in: "Mirá, entre nuestros clientes, los que menos margen dejan son Lider 21.5%.", out: "Mirá, entre nuestros clientes, los que menos margen dejan son Lider 21.5%." },
  { n: "10 · ranking directo → intacto", in: "Los cinco clientes que más margen dejan son La Polar 34.0% y Hites 33.0%.", out: "Los cinco clientes que más margen dejan son La Polar 34.0% y Hites 33.0%." },
  // 6 · preservar recomendación real 'es importante que <acción>'
  { n: "11 · 'es importante que revises' → intacto", in: "Para recuperar margen es importante que revises la carga de Falabella.", out: "Para recuperar margen es importante que revises la carga de Falabella." },
];

let pass = 0, fail = 0;
for (const c of cases) {
  const got = SV(c.in);
  const ok = got === c.out;
  const idem = SV(got) === got;                       // idempotencia
  const numsafe = _nums(got) === _nums(c.in);         // number-safety
  if (ok && idem && numsafe) { pass++; console.log(`  ✓ ${c.n}`); }
  else { fail++; console.log(`  ✗ ${c.n}\n     in : ${JSON.stringify(c.in)}\n     out: ${JSON.stringify(got)}\n     exp: ${JSON.stringify(c.out)}${!idem ? "\n     (NO idempotente)" : ""}${!numsafe ? "\n     (cifra alterada!)" : ""}`); }
}
// ── JERARQUÍA DEL ASESOR en el prompt del narrador (Frente A.2): lockear las directivas clave contra regresiones ──
const entry2 = path.join(root, "_vge2.js"), out2 = path.join(root, "_vgb2.mjs");
fs.writeFileSync(entry2, 'export { NARRATE_GENERAL } from "./src/adi/llm/narratePrompt.js";\n');
await esbuild.build({ entryPoints: [entry2], bundle: true, outfile: out2, format: "esm", platform: "node", logLevel: "silent" });
const M2 = await import(pathToFileURL(out2).href + "?t=" + Math.random());
try { fs.unlinkSync(entry2); } catch {} try { fs.unlinkSync(out2); } catch {}
const NG = M2.NARRATE_GENERAL;
const pOk = (n, c) => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; console.log(`  ✗ ${n}`); } };
console.log("\n── prompt del narrador · jerarquía del asesor ──");
pOk("P1 · LA PLATA PRIMERO (el $ de la palanca abre el consejo)", /LA PLATA PRIMERO/.test(NG));
pOk("P2 · POSTURA (opinión de asesor, no catálogo)", /POSTURA/.test(NG) && /no un cat[aá]logo/.test(NG));
pOk("P3 · CIERRE con UNA acción (sin moraleja genérica)", /CIERRE/.test(NG) && /moraleja gen[eé]rica/.test(NG));
pOk("P4 · 'Cuánto vale:' listado como andamio prohibido (se narra, no se titula)", /'Cuánto vale:'/.test(NG));
pOk("P5 · el impacto de la palanca es cifra obligatoria", /impacto en \$ de la palanca va SIEMPRE/.test(NG));
pOk("P6 · sin reuniones/llamadas (asesor digital: analiza al instante)", /reuniones, llamadas/.test(NG));
pOk("P7 · CAUSA (controller senior: por qué ocurre → decisión, no lista de cifras)", /CAUSA/.test(NG) && /controller senior/.test(NG) && /causa→consecuencia→movida/.test(NG));
pOk("P8 · NOMBRES sagrados (el garble 'Falcon' por 'Falabella', cazado en vivo)", /NOMBRES \(sagrados/.test(NG) && /'Falcon' por 'Falabella' NO/.test(NG));
pOk("P9 · DIRECCIONES sagradas (inversión 'sobre'→'debajo' cazada en vivo)", /DIRECCIONES \(sagradas\)/.test(NG) && /NUNCA las inviertas/.test(NG));
pOk("P10 · LA FORMA, NO EL DATO (regla del owner 2026-07-08: no recitar el panel · 3-5 cifras · cómo/dónde se gana y pierde)", /LA FORMA, NO EL DATO/.test(NG) && /NO recites lo que el panel ya enseña/.test(NG) && /SOLO las 3-5/.test(NG) && /C[OÓ]MO se gana la plata/.test(NG));
pOk("P11 · GUÍA DE LECTURA (negritas ejecutivas sobre conceptos · 3-6 · owner 2026-07-08)", /GUÍA DE LECTURA/.test(NG) && /\*\*negritas\*\*/.test(NG) && /3 a 6 por respuesta/.test(NG));
pOk("P12 · DOS CAPAS (principios con libertad · invariantes duras — no pautear)", /PRINCIPIOS \(criterio, no guión\)/.test(NG) && /INVARIANTES \(no se negocian\)/.test(NG) && /libertad total de fraseo/.test(NG));

console.log(`\n── _voice_gate: PASS ${pass} · FAIL ${fail} (de ${cases.length + 12}) ──`);
process.exit(fail ? 1 : 0);
