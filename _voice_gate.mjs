/* === _voice_gate.mjs · GATE del GUARD DE VOZ determinístico (stripRoboticVoice) ===
 * Lockea: (1) mata aperturas de plantilla ("He revisado tus datos…", "Las proyecciones indican que…").
 * (2) mata muletillas conectoras ("Sin embargo,", "Es importante notar que"). (3) NO toca voz natural ("Mirá,…").
 * (4) idempotente (aplicar 2x = 1x). (5) number-safe (ninguna cifra cambia). (6) preserva recomendaciones reales
 * ("es importante que revises…"). Puro string · sin key · no toca motor/seam. */
import esbuild from "esbuild"; import { pathToFileURL } from "url"; import path from "path"; import fs from "fs";
// nombres PROPIOS de este gate (ver la nota en _chart_gate.mjs).
const root = process.cwd(); const entry = path.join(root, `_voice_gate_entry.tmp${process.pid}.js`), out = path.join(root, `_voice_gate_bundle.tmp${process.pid}.mjs`);
fs.writeFileSync(entry, 'export { stripRoboticVoice, stripOutOfDataOffers, stripLanguageLeaks, detectVoseo, VOSEO_FORMAS } from "./src/adi/llm/voiceGuard.js";\nexport { CONCEPT_DEFS } from "./src/adi/sentrix/glossary.js";\n');
await esbuild.build({ entryPoints: [entry], bundle: true, outfile: out, format: "esm", platform: "node", logLevel: "silent" });
const M = await import(pathToFileURL(out).href + "?t=" + Math.random());
try { fs.unlinkSync(entry); } catch {} try { fs.unlinkSync(out); } catch {}
const { stripRoboticVoice: SV, stripOutOfDataOffers: SOD, stripLanguageLeaks: SLL, detectVoseo: DV, VOSEO_FORMAS: VF, CONCEPT_DEFS: CD } = M;

const _nums = (s) => (String(s).match(/\$?\d[\d.,]*[%MK]?/g) || []).join("|");

const cases = [
  // 1 · aperturas de plantilla
  { n: "1 · 'He revisado tus datos y te cuento que'", in: "He revisado tus datos y te cuento que hay tres áreas donde se pierde margen.", out: "Hay tres áreas donde se pierde margen." },
  { n: "2 · 'He revisado tus datos.' + frase", in: "He revisado tus datos. Primero, los $4.9M de contribución no capturada.", out: "Primero, los $4.9M de contribución no capturada." },
  { n: "3 · 'Las proyecciones indican que'", in: "Las proyecciones indican que un crecimiento del 3% llevaría el total a $103.0M.", out: "Un crecimiento del 3% llevaría el total a $103.0M." },
  { n: "4 · 'He analizado tus datos:'", in: "He analizado tus datos: Falabella cede margen.", out: "Falabella cede margen." },
  { n: "5 · 'Según los datos,'", in: "Según los datos, Lider deja 21.5% de margen.", out: "Lider deja 21.5% de margen." },
  { n: "5b · 'He estado revisando… he encontrado algunos puntos donde' (embebido → frase válida)", in: "He estado revisando tus datos y he encontrado algunos puntos donde se pierde margen: Falabella $1.6M.", out: "Algunos puntos donde se pierde margen: Falabella $1.6M." },
  { n: "5c · 'Tras revisar tus datos,'", in: "Tras revisar tus datos, hay tres focos de pérdida.", out: "Hay tres focos de pérdida." },
  { n: "5d · 'Estuve analizando la información y detecté que'", in: "Estuve analizando la información y detecté que Falabella cede $1.6M.", out: "Falabella cede $1.6M." },
  { n: "5e · flow3: 'Estuve revisando los números de X y hay…' (ancla en 'los números de')", in: "Estuve revisando los números de Falabella y hay un par de cosas que afectan tu margen. Primero, $1.6M en Falabella.", out: "Hay un par de cosas que afectan tu margen. Primero, $1.6M en Falabella." },
  { n: "5f · 'He estado analizando la situación y detecté que'", in: "He estado analizando la situación y detecté que Falabella pierde $1.6M.", out: "Falabella pierde $1.6M." },
  { n: "5f2 · 'He estado revisando TUS números y hay…' (variante tus/mis/sus)", in: "He estado revisando tus números y hay tres áreas donde se pierde margen. Primero, $4.9M.", out: "Hay tres áreas donde se pierde margen. Primero, $4.9M." },
  { n: "5f3 · 'Revisé tus cifras y encontré que'", in: "Revisé tus cifras y encontré que el capital detenido suma $33K.", out: "El capital detenido suma $33K." },
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
// ── OFERTA FUERA DE DATO (owner 2026-07-09: el narrador ofreció "campañas de marketing" — data inexistente) ──
// scrub por oración: elimina COMPLETA la que mencione data fuera del universo · nunca vacío · idempotente
const sodCases = [
  { n: "S1 · el caso real: oferta de campañas/promociones se elimina entera (el resto queda)",
    in: "El problema está en el SAM-TV55: 58 días de inventario. Ahora, ¿qué tal si analizamos las campañas de marketing o promociones que podrías implementar para el SAM-TV55? Revisemos la carga comercial.",
    out: "El problema está en el SAM-TV55: 58 días de inventario. Revisemos la carga comercial." },
  { n: "S2 · lenguaje de negocio DISPONIBLE no se toca (descuentos/bonificaciones son del universo)",
    in: "Los descuentos y bonificaciones que das consumen $655K de margen. Revisá la carga de Falabella.",
    out: "Los descuentos y bonificaciones que das consumen $655K de margen. Revisá la carga de Falabella." },
  { n: "S3 · texto todo-marketing → jamás vacío (fallback al original)",
    in: "Lanzá campañas de marketing en Instagram.",
    out: "Lanzá campañas de marketing en Instagram." },
  { n: "S4 · 'competencia' en oferta del narrador también cae",
    in: "Falabella cede $1.6M por carga. Podríamos comparar tus precios contra la competencia del retail. La medida está en la carga.",
    out: "Falabella cede $1.6M por carga. La medida está en la carga." },
];
for (const c of sodCases) {
  const got = SOD(c.in);
  const okc = got === c.out && SOD(got) === got;
  if (okc) { pass++; console.log(`  ✓ ${c.n}`); }
  else { fail++; console.log(`  ✗ ${c.n}\n     out: ${JSON.stringify(got)}\n     exp: ${JSON.stringify(c.out)}`); }
}
// ── LEAKS DE IDIOMA Y SLANG (owner 2026-07-10: "vitales") · cazados en vivo: "if" y "la pasta" ──
const leakCases = [
  { n: "L1 · leak de inglés 'if' (cazado en vivo) → 'si'",
    in: "¿Qué te parece if profundizamos en la estructura de costos de Falabella?",
    out: "¿Qué te parece si profundizamos en la estructura de costos de Falabella?" },
  { n: "L2 · slang 'la pasta' (España, cazado en vivo) → 'el capital' (registro ejecutivo · jamás 'plata')",
    in: "Esto es la pasta que no estás aprovechando de tus ventas.",
    out: "Esto es el capital que no estás aprovechando de tus ventas." },
  { n: "L3 · 'deep dive' / 'insights' → español de directorio",
    in: "Hagamos un deep dive: los insights apuntan a la carga.",
    out: "Hagamos un análisis a fondo: los hallazgos apuntan a la carga." },
  { n: "L4 · 'pasta de dientes' (producto real) NO se toca",
    in: "La pasta de dientes rota bien en Cuidado Personal.",
    out: "La pasta de dientes rota bien en Cuidado Personal." },
  { n: "L5 · texto limpio con entidades y cifras → intacto byte-igual",
    in: "Easy vende $3.4M con margen 32.0% — sobre tu piso de 30.1%.",
    out: "Easy vende $3.4M con margen 32.0% — sobre tu piso de 30.1%." },
  { n: "L6 · mayúscula inicial preservada ('If' → 'Si')",
    // el esperado decía «recuperás»: la fixture afirmaba que el voseo SOBREVIVÍA al lavado, porque esa forma no
    // estaba en `_VOSEO` (owner 2026-08-14, barrido de la clase completa). Ahora sí está, y el esperado es tuteo.
    in: "If la carga baja al target, recuperás $194K.",
    out: "Si la carga baja al target, recuperas $194K." },
  // + REGISTRO EJECUTIVO igualado al gate estático (owner 2026-07-26: "apretado" se coló NARRADO en vivo) · el stripper
  // cubría guita/palanca; faltaban apretar/dormido/plata. Formas enumeradas: preservan inflexión, género y mayúscula.
  { n: "L7 · 'apretado' (adjetivo) → 'ajustado'",
    in: "El margen de Falabella viene apretado; hay que actuar.",
    out: "El margen de Falabella viene ajustado; hay que actuar." },
  { n: "L8 · 'apretadas' (fem. plural) → 'ajustadas'",
    in: "Las cuentas grandes están apretadas.",
    out: "Las cuentas grandes están ajustadas." },
  { n: "L9 · 'apretar' (infinitivo) → 'ajustar'",
    in: "Conviene apretar la carga de Falabella.",
    out: "Conviene ajustar la carga de Falabella." },
  { n: "L10 · 'aprieta'/'aprietan' (presente) → 'ajusta'/'ajustan'",
    in: "El costo aprieta el margen y los descuentos aprietan la contribución.",
    out: "El costo ajusta el margen y los descuentos ajustan la contribución." },
  { n: "L11 · 'apretando' (gerundio) → 'ajustando'",
    in: "El costo viene apretando el margen en Lider.",
    out: "El costo viene ajustando el margen en Lider." },
  // GATE MOVIDO 2026-08-13 (cierre de la cert amplia, hallazgo 4a) — ANÁLISIS GARANTÍA-VS-FORMATO: el destino del
  // barrido era FORMATO (la réplica elegida en su momento), y «capital detenido» viola el registro que CLAUDE.md §4
  // fija («inmovilizado», no «detenido» — salió 4 veces narrado en la certificación). La garantía (dormido jamás
  // sale, number-safe, idempotente) queda intacta: solo cambia la palabra de llegada, encadenando el bigrama.
  { n: "L12 · 'capital dormido' → 'capital inmovilizado' (encadena dormido→detenido→bigrama · $33K intacto)",
    in: "Tienes $33K de capital dormido en Valparaíso.",
    out: "Tienes $33K de capital inmovilizado en Valparaíso." },
  { n: "L13 · 'dormidos' (plural) → 'detenidos'",
    in: "Varios SKU quedaron dormidos sin rotación.",
    out: "Varios SKU quedaron detenidos sin rotación." },
  { n: "L14 · 'la plata' → 'la caja' (femenino preservado · number-safe $4.9M intacto)",
    in: "La plata inmovilizada en inventario suma $4.9M.",
    out: "La caja inmovilizada en inventario suma $4.9M." },
  { n: "L15 · mayúscula inicial preservada ('Apretado' → 'Ajustado')",
    in: "Apretado el margen, conviene actuar en Falabella.",
    out: "Ajustado el margen, conviene actuar en Falabella." },
  // GATE MOVIDO 2026-08-13 (mismo análisis que L12): «capital detenido» dejó de ser registro correcto — el caso de
  // «intacto byte-igual» se ejercita con el VERBO sobre un SKU (H3/H4 de la certificación: legítimo, no se toca).
  { n: "L16 · registro correcto (ajustado/detenido-de-SKU/caja) → intacto byte-igual",
    in: "El SKU detenido y el margen ajustado ya están bien; la caja quieta suma $4.9M.",
    out: "El SKU detenido y el margen ajustado ya están bien; la caja quieta suma $4.9M." },
  { n: "L16b · el bigrama del registro viejo → inmovilizado (cierre cert amplia, hallazgo 4a)",
    in: "El capital detenido concentra $33K y el inventario detenido preocupa.",
    out: "El capital inmovilizado concentra $33K y el inventario inmovilizado preocupa." },
];
for (const c of leakCases) {
  const got = SLL(c.in);
  const okc = got === c.out && SLL(got) === got && _nums(got) === _nums(c.in);
  if (okc) { pass++; console.log(`  ✓ ${c.n}`); }
  else { fail++; console.log(`  ✗ ${c.n}\n     out: ${JSON.stringify(got)}\n     exp: ${JSON.stringify(c.out)}`); }
}
// ── JERARQUÍA DEL ASESOR en el prompt del narrador (Frente A.2): lockear las directivas clave contra regresiones ──
const entry2 = path.join(root, `_voice_gate_entry_2.tmp${process.pid}.js`), out2 = path.join(root, `_voice_gate_bundle_2.tmp${process.pid}.mjs`);
fs.writeFileSync(entry2, 'export { NARRATE_GENERAL, NARRATE_SELLO, NARRATE_RESUMEN_ARC, buildNarrateSystem } from "./src/adi/llm/narratePrompt.js";\n');
await esbuild.build({ entryPoints: [entry2], bundle: true, outfile: out2, format: "esm", platform: "node", logLevel: "silent" });
const M2 = await import(pathToFileURL(out2).href + "?t=" + Math.random());
try { fs.unlinkSync(entry2); } catch {} try { fs.unlinkSync(out2); } catch {}
const NG = M2.NARRATE_GENERAL;
const pOk = (n, c) => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; console.log(`  ✗ ${n}`); } };
console.log("\n── prompt del narrador · jerarquía del asesor ──");
pOk("P1 · EL VALOR PRIMERO (el $ de la palanca abre el consejo · registro ejecutivo 2026-07-14)", /EL VALOR PRIMERO/.test(NG));
pOk("P2 · POSTURA (opinión de asesor, no catálogo)", /POSTURA/.test(NG) && /no un cat[aá]logo/.test(NG));
pOk("P3 · CIERRE con UNA acción (sin moraleja genérica)", /CIERRE/.test(NG) && /moraleja gen[eé]rica/.test(NG));
pOk("P4 · 'Cuánto vale:' listado como andamio prohibido (se narra, no se titula)", /'Cuánto vale:'/.test(NG));
pOk("P5 · el impacto de la medida es cifra obligatoria", /impacto en \$ de la medida va SIEMPRE/.test(NG));
pOk("P6 · sin reuniones/llamadas (asesor digital: analiza al instante)", /reuniones, llamadas/.test(NG));
pOk("P7 · CAUSA (controller senior: por qué ocurre → decisión, no lista de cifras)", /CAUSA/.test(NG) && /controller senior/.test(NG) && /causa→consecuencia→movida/.test(NG));
pOk("P8 · NOMBRES sagrados (el garble 'Falcon' por 'Falabella', cazado en vivo)", /NOMBRES \(sagrados/.test(NG) && /'Falcon' por 'Falabella' NO/.test(NG));
pOk("P9 · DIRECCIONES sagradas (inversión 'sobre'→'debajo' cazada en vivo)", /DIRECCIONES \(sagradas\)/.test(NG) && /NUNCA las inviertas/.test(NG));
pOk("P10 · LA FORMA, NO EL DATO (regla del owner 2026-07-08: no recitar el panel · 3-5 cifras · cómo/dónde se gana y pierde)", /LA FORMA, NO EL DATO/.test(NG) && /NO recites lo que el panel ya enseña/.test(NG) && /SOLO las 3-5/.test(NG) && /C[OÓ]MO se gana el margen/.test(NG));
pOk("P11 · GUÍA DE LECTURA (negritas ejecutivas sobre conceptos · 3-6 · owner 2026-07-08)", /GUÍA DE LECTURA/.test(NG) && /\*\*negritas\*\*/.test(NG) && /3 a 6 por respuesta/.test(NG));
pOk("P12 · DOS CAPAS (principios con libertad · invariantes duras — no pautear)", /PRINCIPIOS \(criterio, no guión\)/.test(NG) && /INVARIANTES \(no se negocian\)/.test(NG) && /libertad total de fraseo/.test(NG));

pOk("P13 · REGISTRO EJECUTIVO (owner 2026-07-09: el usuario habla coloquial, ADI responde de directorio — capital, no plata · sin spanglish)", /REGISTRO EJECUTIVO/.test(NG) && /jam[aá]s slang ni spanglish/.test(NG));
pOk("P13b · registro con PROHIBICIÓN explícita (owner 2026-07-14: 'nada de dormido, plata, palanca' — siempre como un ejecutivo)", /PROHIBIDO 'plata'/.test(NG) && /PROHIBIDO 'dormido'/.test(NG) && /capital detenido o inmovilizado/.test(NG) && /PROHIBIDO 'palanca'/.test(NG));
pOk("P14 · ORDEN NUMERADO (owner 2026-07-09: 3+ entidades → una por punto · apertura y cierre en prosa)", /ORDEN NUMERADO/.test(NG) && /punto numerado/.test(NG) && /FUERA de la lista/.test(NG));
pOk("P15 · CIERRE dentro del universo (owner 2026-07-09: jamás ofrecer data inexistente — campañas/marketing)", /universo DISPONIBLE/.test(NG) && /campañas, marketing, publicidad/.test(NG) && /convert[ií] hacia el an[aá]lisis disponible/.test(NG));
// el universo DISPONIBLE viaja en TODO prompt de narración (derivado del contrato · capabilities.js)
const _sysGen = M2.buildNarrateSystem({ kind: "resumen" });
const _sysSim = M2.buildNarrateSystem({ transform: { value: 3 } });
pOk("P16 · buildNarrateSystem appendea DISPONIBLE (métricas del contrato + focos reales) en general y simulación",
  /DISPONIBLE — todo lo que ADI puede analizar/.test(_sysGen) && /Ventas por cliente/.test(_sysGen) && /Pareto 80\/20/.test(_sysGen) && /DISPONIBLE — todo lo que ADI puede analizar/.test(_sysSim));

// ── EL SELLO (owner 2026-07-14, desde la landing): entender→explicar→actuar como arco UNIVERSAL, proporcional ──
const SELLO = M2.NARRATE_SELLO;
pOk("P17 · SELLO con los 3 movimientos del owner (qué está pasando · por qué pasa · qué hacer primero)",
  /EL SELLO DE ADI/.test(SELLO) && /QUÉ ESTÁ PASANDO/.test(SELLO) && /POR QUÉ PASA/.test(SELLO) && /QUÉ HACER PRIMERO/.test(SELLO));
pOk("P18 · SELLO graduado (PROBADO/INDICADO/ABIERTO — jamás inventar la causa) y PROPORCIONAL a la pregunta",
  /PROBADO/.test(SELLO) && /INDICADO/.test(SELLO) && /ABIERTO/.test(SELLO) && /jamás la inventes/.test(SELLO) && /PROPORCIONAL A LA PREGUNTA/.test(SELLO) && /no un formulario/.test(SELLO));
pOk("P19 · el SELLO viaja en TODA narración (general · simulación · explain · recommendation) SALVO el resumen (arco de 8 intacto)",
  (() => { const gen = M2.buildNarrateSystem({}), sim = M2.buildNarrateSystem({ transform: {} }), exp = M2.buildNarrateSystem({ followup: true, kind: "explain" }),
    rec = M2.buildNarrateSystem({ followup: true }), res = M2.buildNarrateSystem({ kind: "resumen_ejecutivo" });
  return [gen, sim, exp, rec].every((s) => /EL SELLO DE ADI/.test(s)) && !/EL SELLO DE ADI/.test(res) && /ESTRUCTURA DEL RESUMEN EJECUTIVO/.test(res); })());

/* ══ [V] LA RED MORFOLÓGICA DEL VOSEO ══════════════════════════════════════════════════════════════════════════
 * EL HUECO QUE CIERRA, y por qué existía. `_INFORME_VOSEO_VIGENTE.md` §7.1 lo dejó medido: de las variantes que
 * el DETECTOR (`detectVoseo`/`VOSEO_FORMAS`, la lista única de los gates de registro) sabe nombrar, el STRIPPER de
 * runtime lavaba 150 y otras 10 sólo en posición de orden. Las ~156 restantes las cazaba el gate en un literal
 * pero NO se lavaban si el narrador las escribía libre — y los prompts que lo guían están en voseo A PROPÓSITO.
 * Se midió en vivo el 2026-08-14 (`_medir_ojos_vivo.json`): el narrador escribió «…si **subís** el volumen 4%».
 *
 * LO QUE ESTA SECCIÓN LOCKEA, en este orden: los dos casos medidos en vivo · el inventario COMPLETO del detector
 * medido contra el stripper · la lista CERRADA de las que no se cubren, cada una con su motivo · los controles de
 * falso positivo de los dos lados · la convergencia detector↔stripper, con su diferencia listada y no implícita.
 *
 * LA DOCTRINA QUE ORDENA TODO ESTO: falso negativo antes que falso positivo. Reescribir prosa correcta es peor
 * que dejar pasar un voseo — un lavador que rompe texto bueno se termina apagando, y entonces no lava nada. */
console.log("\n── [V] la red morfológica del voseo · cobertura, falsos positivos y convergencia ──");

// el detector declara sus formas con la tilde opcional donde la forma pelada no existe («dec[ií]s»): para medir
// cobertura hay que expandir esos patrones a las variantes CONCRETAS que un narrador puede escribir.
const _expandir = (pat) => {
  const m = pat.match(/\[([^\]]+)\]/);
  return m ? m[1].split("").flatMap((o) => _expandir(pat.replace(m[0], o))) : [pat];
};
const VARIANTES = [...new Set(VF.flatMap(_expandir))];
const _lava = (f) => SLL(f) !== f;
const _enProsa = (v) => `Con eso ${v} el margen de Falabella en 4%.`;
const _enOrden = (v) => `Primero ${v} el margen de Falabella.`;

// ── V1 · LOS DOS CASOS MEDIDOS EN VIVO (transcript del arquitecto, 2026-08-14) ────────────────────────────────
// No son ejemplos inventados: son las dos frases que salieron a la pantalla del owner en la misma corrida.
pOk("V1a · «si subís el volumen 4%» → «si subes el volumen 4%» (el 4% intacto · medido en vivo, turno 2)",
  SLL("Dime uno y te muestro qué pasa con esa cuenta si subís el volumen 4%.")
  === "Dime uno y te muestro qué pasa con esa cuenta si subes el volumen 4%.");
pOk("V1b · «Con esa vara puesta» → «Con esa referencia puesta» (medido en vivo, turno 7 · «vara» es palabra prohibida en superficie, CLAUDE.md §4)",
  SLL("Con esa vara puesta, Falabella queda 8,1 puntos por debajo.")
  === "Con esa referencia puesta, Falabella queda 8,1 puntos por debajo.");

// ── V2/V3 · EL INVENTARIO COMPLETO, MEDIDO ───────────────────────────────────────────────────────────────────
// LAS QUE NO SE CUBREN VAN POR LISTA, NUNCA EN SILENCIO. Son la grafía SIN TILDE del presente voseante en -er/-ir
// («subis» por «subís»). NO se cubren por una razón concreta: aceptar la forma pelada de esta clase exigiría
// aceptarla para toda la tabla, y ahí «retenes» (plural de retén), «soles» (plural de sol), «vendes», «pones» y
// «subes» son palabras españolas legítimas — tuteo correcto o sustantivo. El detector puede nombrarlas porque
// marcar de más sólo pone un gate rojo; el stripper no puede lavarlas porque reescribir de más cambia la
// respuesta que lee el owner. La asimetría es deliberada y es la diferencia que V6 lista.
const NO_CUBIERTAS = new Set([
  "resolves", "entendes", "atendes", "moves", "salis", "subis", "escribis", "decidis", "abris", "medis",
  "repartis", "definis", "convertis", "revertis", "permitis", "dividis", "pedis", "sentis", "vivis", "repetis",
  "reducis",
]);
// gateadas A PROPÓSITO desde el pase anterior: el imperativo en -é/-í es a la vez orden voseante y pretérito de
// primera («corregí las condiciones» / «corregí el dato ayer»), así que sólo se lava en posición de orden.
const SOLO_EN_ORDEN = new Set([
  "reponé", "vendé", "resolvé", "atendé", "corré", "aprendé", "entendé", "escogé", "recorré", "mantené",
]);
{
  const lavadas = [], enOrden = [], sinLavar = [];
  for (const v of VARIANTES) {
    if (_lava(_enProsa(v))) lavadas.push(v);
    else if (_lava(_enOrden(v))) enOrden.push(v);
    else sinLavar.push(v);
  }
  pOk(`V2 · el stripper lava ${lavadas.length} de ${VARIANTES.length} variantes en prosa neutra (§7.1 medía 150; si vuelve a bajar de 275, la red se rompió o alguien la desarmó)`,
    lavadas.length >= 275);
  pOk(`V3a · las NO cubiertas son EXACTAMENTE las ${NO_CUBIERTAS.size} declaradas — si aparece una nueva hay que declararla con su motivo, no dejarla muda [sobran: ${sinLavar.filter((v) => !NO_CUBIERTAS.has(v)).join(", ") || "—"}]`,
    sinLavar.every((v) => NO_CUBIERTAS.has(v)));
  pOk(`V3b · ninguna de las declaradas se cubrió por accidente sin sacarla de la lista [${[...NO_CUBIERTAS].filter((v) => !sinLavar.includes(v)).join(", ") || "—"}]`,
    [...NO_CUBIERTAS].every((v) => sinLavar.includes(v)));
  pOk(`V3c · las gateadas a posición de orden siguen siendo las ${SOLO_EN_ORDEN.size} declaradas (ninguna se soltó a prosa neutra, que es donde chocaría con el pretérito)`,
    enOrden.every((v) => SOLO_EN_ORDEN.has(v)) && [...SOLO_EN_ORDEN].every((v) => enOrden.includes(v)));
  console.log(`  · inventario del detector: ${VF.length} entradas → ${VARIANTES.length} variantes · lava ${lavadas.length} · sólo en orden ${enOrden.length} · declaradas sin cubrir ${sinLavar.length}`);
}

// ── V4 · FALSOS POSITIVOS DEL STRIPPER · prosa correcta que tiene que salir byte-idéntica ─────────────────────
// Cada bloque es una clase de riesgo REAL de las tres redes, no una muestra al azar. Si una se rompe, el
// comentario dice qué red la rompió y por qué su exclusión existe.
const LIMPIAS = [
  // futuro de tuteo — la razón del corte «raíz terminada en r» en la red de -ás
  "Verás el resultado en el cierre del año.", "Podrás revisarlo cuando quieras.", "Tendrás la serie mensual.",
  "Harás bien en empezar por Lider.", "Sabrás el monto exacto al cierre.", "Querrás comparar los dos ejes.",
  "El margen mejorará si la carga baja al 3.5%.", "Recuperarás $194K si cierras ese exceso.",
  // condicional — lleva la tilde en la «í», así que ni entra en la red
  "Si no se cumple el supuesto, lo que recuperarías podría variar.", "Podrías revisar el eje marca primero.",
  // adverbios y sustantivos en -ás — la lista cerrada de exclusión
  "Jamás mezclamos los dos universos en una misma cifra.", "Quizás convenga revisar Bosch primero.",
  "Además, la carga comercial sube 4%.", "Los demás clientes están sobre el piso.",
  "Detrás de la brecha hay carga comercial.", "El compás del negocio cambió en el segundo semestre.",
  // -és / -ís: clases ABIERTAS del español, la razón de que ahí NO haya red abierta sino tabla de infinitivos
  "El país cerró el año con menor consumo.", "Después de revisar la cartera, el margen cae 2 puntos.",
  "El interés del owner está en el capital.", "A través del canal digital vende $2.0M.",
  "Al revés de lo esperado, el margen subió.", "El proveedor japonés entrega en 30 días.",
  "El mercado francés no está en tu dato.", "El análisis por eje no cambia la crisis de rotación.",
  // nombres propios y topónimos — «Paris» es un cliente REAL de este tenant y «Puerto Varas» un topónimo chileno
  "Tomás revisó el inventario la semana pasada.", "Nicolás pidió el detalle por bodega.",
  "Andrés cerró la negociación con Lider.", "Paris vende $8.0M con margen 28%.",
  "Puerto Varas no está entre tus bodegas.", "Valparaíso concentra $33K de capital inmovilizado.",
  // tuteo correcto — lo que el producto SÍ debe decir
  "Necesitas revisar el benchmark antes de decidir.", "Entregas más de lo que recibes en esa cuenta.",
  "Las marcas del período cerraron bajo el benchmark.", "Retienes margen en tres cuentas.",
  "Aprendes más del eje marca que del eje canal.", "Escoges el eje y ADI arma la lectura.",
  "Recorres la cartera de 13 clientes en un cuadro.", "Subes el volumen 4% y la venta llega a $104.0M.",
  "Mides los días de inventario con doh.", "Estás sobre el benchmark de 30.1% en Easy.",
  // imperativo de USTED — el registro formal que este producto quiere: la red de enclíticos NO puede tutearlo
  "Avíseme cuando tenga el dato del proveedor.", "Hábleme del eje canal.", "Dígame qué cuenta reviso.",
  "Muéstreme la serie mensual.", "Cuénteme qué parte no cierra.", "Póngase en el escenario actual.",
  // sustantivos que colisionan con formas voseantes de la tabla
  "Los retenes de stock no aplican en este dato.", "Los soles del período no son una métrica del negocio.",
  "El tomate rota bien en Cuidado Personal.", "Los tomates quedaron fuera del catálogo.",
  // tercera persona — el motor hablando de lo que hace
  "El motor usa doh y no recomputa los días.", "La carga marca el exceso sobre la meta.",
  "El cuadro muestra la venta mes a mes.", "El rebate cobra sobre la venta neta.",
  "La medida logra $194K de recuperación.", "El SKU entra al ranking por rotación.",
  // pretérito de primera — reescribirlo cambiaría lo que la frase dice
  "Yo pedí el dato ayer y no llegó.", "Me dejaste sin la tabla que te pedí.",
  "El informe que escribí la semana pasada ya está.", "Corregí el dato ayer con la boleta nueva.",
];
for (const t of LIMPIAS) {
  const g = SLL(t);
  pOk(`V4 · intacta: «${t.slice(0, 58)}${t.length > 58 ? "…" : ""}»${g === t ? "" : `  →  «${g}»`}`, g === t);
}

// ── V5 · FALSOS POSITIVOS DEL DETECTOR · la MISMA vara, del otro lado ─────────────────────────────────────────
// Un detector que marca prosa buena se termina desactivando, y entonces deja de proteger. Se le exige el mismo
// corpus que al stripper: los dos tienen que estar de acuerdo en qué NO es voseo.
{
  const marcadas = LIMPIAS.map((t) => [t, DV(t)]).filter(([, v]) => v);
  pOk(`V5 · el detector no marca ninguna de las ${LIMPIAS.length} frases correctas [${marcadas.map(([t, v]) => `«${v}» en «${t.slice(0, 30)}…»`).join(" · ") || "—"}]`,
    marcadas.length === 0);
}

// ── V6 · CONVERGENCIA DETECTOR ↔ STRIPPER · la invariante que el archivo declara ──────────────────────────────
// «Toda forma que el detector conoce, el stripper la neutraliza». No se cumple del todo, y la diferencia se
// LISTA acá en vez de quedar implícita: son las variantes sin tilde de V3 más la excepción nombrada de abajo.
{
  const conocidas = VARIANTES.length;
  const cubiertas = VARIANTES.filter((v) => _lava(_enProsa(v)) || _lava(_enOrden(v))).length;
  const diferencia = conocidas - cubiertas;
  pOk(`V6a · la diferencia detector↔stripper es de ${diferencia} variantes y está declarada entera en NO_CUBIERTAS (${NO_CUBIERTAS.size}) — si crece sin declararse, esto se pone rojo`,
    diferencia === NO_CUBIERTAS.size);
  console.log(`  · convergencia: ${cubiertas}/${conocidas} variantes (${(100 * cubiertas / conocidas).toFixed(1)}%) · diferencia declarada: ${diferencia}`);
  // «tomate» es la ÚNICA forma que salió del detector Y del stripper a la vez, y por una razón que no es
  // lingüística: es una palabra —y en un producto de retail multi-tenant, un SKU posible—. El voseo «tomate el
  // tiempo» existe, pero ningún contexto lo separa del producto con certeza. Gana el sustantivo.
  pOk("V6b · «tomate» (el producto) no lo toca ni el stripper ni el detector — la excepción nombrada de la clase",
    SLL("El tomate rota bien en Cuidado Personal.") === "El tomate rota bien en Cuidado Personal." && !DV("El tomate rota bien."));
}

// ── V7 · LAS REGLAS DURAS DEL ARCHIVO, sobre texto que SÍ tiene voseo ─────────────────────────────────────────
const SUCIOS = [
  ["Si entendés el eje, avisame y armamos la lectura de $19.4M.", "Si entiendes el eje, avísame y armamos la lectura de $19.4M."],
  ["Primero liquidá o rotá LG-DRYER8KG en Valparaíso; después contanos cómo salió.", "Primero liquida o rota LG-DRYER8KG en Valparaíso; después cuéntanos cómo salió."],
  ["Reponé Electrodomésticos y quedate con el margen de 26%.", "Repón Electrodomésticos y quédate con el margen de 26%."],
  ["Si querés, mostrame el detalle: ponés $874K de acciones y recuperás $194K.", "Si quieres, muéstrame el detalle: pones $874K de acciones y recuperas $194K."],
  ["Fijate que el 4.5% de carga supera tu meta de 3.5% — pasame el número y lo reviso.", "Fíjate que el 4.5% de carga supera tu meta de 3.5% — pásame el número y lo reviso."],
  ["Subís el volumen y entendés el efecto en $100.0M.", "Subes el volumen y entiendes el efecto en $100.0M."],
];
for (const [sucio, esperado] of SUCIOS) {
  const g = SLL(sucio);
  const idem = SLL(g) === g, num = _nums(g) === _nums(sucio);
  pOk(`V7 · «${sucio.slice(0, 46)}…»${g === esperado ? "" : `  →  «${g}»`}${idem ? "" : " (NO idempotente)"}${num ? "" : " (CIFRA ALTERADA)"}`,
    g === esperado && idem && num);
}
pOk("V7b · preserva la mayúscula inicial en las tres redes («Subís»/«Avisame»/«Entendés» al abrir la oración)",
  SLL("Subís el volumen.") === "Subes el volumen." && SLL("Avisame el resultado.") === "Avísame el resultado."
  && SLL("Entendés el eje.") === "Entiendes el eje.");
// LAS VERSALES SON ÉNFASIS DEL MOTOR, no ruido: devolver «Compras» donde decía «COMPRÁS» apaga una intención.
pOk("V7d · TODO-MAYÚSCULAS se conserva en las tres redes y en las reglas enumeradas («COMPRÁS»→«COMPRAS» · «CONTESTÁ»→«CONTESTA» · «DECLARALO»→«DECLÁRALO»)",
  SLL("Si COMPRÁS más volumen, el costo baja.") === "Si COMPRAS más volumen, el costo baja."
  && SLL("CONTESTÁ la decisión declinándola.") === "CONTESTA la decisión declinándola."
  && SLL("DECLARALO en la primera frase.") === "DECLÁRALO en la primera frase.");
// verbos en -uar: su tuteo LLEVA tilde, así que «quitar la tilde» —la regla de las dos redes de -á/-ás— miente.
pOk("V7e · los verbos en -uar mantienen su tilde («evaluá»→«evalúa», no «evalua» · «continuá»→«continúa» · «actuá»→«actúa»)",
  SLL("Primero protege los SKU; después frená compras o evaluá salida.") === "Primero protege los SKU; después frena compras o evalúa salida."
  && SLL("Continuá con el eje marca y actuá sobre la carga.") === "Continúa con el eje marca y actúa sobre la carga.");
// CAZADO EN VIVO en el barrido de los 11.255 literales de pantalla: la red de enclíticos convertía la función de
// CSS/SVG `rotate(…)` en «rótate». Hoy esos literales no pasan por el stripper, pero la regla no puede existir.
pOk("V7f · `rotate(…)` de CSS/SVG queda intacto — junto con los otros identificadores que la red de enclíticos rozaba",
  SLL('transform="rotate(-40 120 300)" y @keyframes { transform: rotate(360deg); }')
  === 'transform="rotate(-40 120 300)" y @keyframes { transform: rotate(360deg); }'
  && SLL("El validate y el calculate del módulo separate.") === "El validate y el calculate del módulo separate.");
pOk("V7c · sin lookbehind en las reglas nuevas (Safari viejo de invitados mobile): el borde izquierdo se captura y se reinyecta",
  (() => { const src = fs.readFileSync(path.join(root, "src", "adi", "llm", "voiceGuard.js"), "utf8");
    const bloque = src.slice(src.indexOf("LA RED MORFOLÓGICA DEL PRESENTE Y DE LOS ENCLÍTICOS"), src.indexOf("const _VOSEO = ["));
    return bloque.length > 2000 && !bloque.includes("(?<"); })());

// ── V8 · «VARA» CERRADA COMO CLASE ───────────────────────────────────────────────────────────────────────────
// El pase anterior cubría tres frases (tu/la/declarada) y el narrador escribió una cuarta («esa vara»). Un
// determinante no cambia el registro: si la palabra está vetada, lo está con cualquiera.
for (const [inp, exp] of [
  ["Con esa vara puesta, Falabella queda 8,1 puntos por debajo.", "Con esa referencia puesta, Falabella queda 8,1 puntos por debajo."],
  ["Esta vara la fijaste vos en 30.1%.", "Esta referencia la fijaste tú en 30.1%."],
  ["Una vara más exigente deja 5 clientes abajo.", "Una referencia más exigente deja 5 clientes abajo."],
  ["Su vara declarada es 32%.", "Su referencia declarada es 32%."],
  ["Cualquier vara que pongas cambia el corte.", "Cualquier referencia que pongas cambia el corte."],
  ["Las varas declaradas no son el benchmark.", "Las referencias declaradas no son el benchmark."],
  ["Tu propia vara manda sobre la del sector.", "Tu referencia manda sobre la del sector."],
  ["La vara del negocio es 30.1%.", "La referencia del negocio es 30.1%."],
  ["Vara mínima: 30.1% de margen.", "Referencia mínima: 30.1% de margen."],
  // MEDIDO en el examen 1 · turno 3 (camino natural): llegó a pantalla colgada de una preposición, sin
  // determinante y sin adjetivo — las dos clases que estaban enumeradas.
  ["Aclaración de vara primero: el target cambia.", "Aclaración de referencia primero: el target cambia."],
  ["Sin vara declarada por el negocio no hay corte.", "Sin referencia declarada por el negocio no hay corte."],
  ["Comparado contra vara, Falabella queda abajo.", "Comparado contra referencia, Falabella queda abajo."],
  ["La vara la declara el negocio: benchmark 30.1%.", "La referencia la declara el negocio: benchmark 30.1%."],
]) {
  const g = SLL(inp);
  pOk(`V8 · «${inp.slice(0, 44)}…»${g === exp ? "" : `  →  «${g}»`}`, g === exp && SLL(g) === g && _nums(g) === _nums(inp));
}
pOk("V8b · «Puerto Varas» (topónimo chileno real) y «varado» (SKU encallado) NO se tocan — por eso el plural exige determinante y nunca es «\\bvaras\\b» suelto",
  SLL("Puerto Varas no está entre tus bodegas y el SKU quedó varado.") === "Puerto Varas no está entre tus bodegas y el SKU quedó varado.");

// ── V9 · EL GLOSARIO NO PASA POR EL STRIPPER · verificado, no supuesto ────────────────────────────────────────
// El concepto `vara` de `CONCEPT_DEFS` es la entrada CURADA que define la palabra que el usuario usó, y su
// renombre está FRENADO esperando al owner (`_INFORME_PODA_2B.md`). Ampliar el barrido de «vara» sería romper el
// glosario SI su definición pasara por acá. No pasa: `defineConcept` → `composeFromTextualEvidence` arma la
// respuesta VERBATIM en la rama determinística de `answerViaOracle`, y el lavado corre sólo sobre el borrador
// del narrador. Esto se comprueba en el cableado, que es donde puede romperse mañana.
{
  const motor = fs.readFileSync(path.join(root, "src", "adi", "oracle", "answerViaOracle.js"), "utf8");
  const i0 = motor.indexOf("const desdeTexto = desdeLedger ? null : composeFromTextualEvidence(results)");
  const i1 = motor.indexOf("narrationRepaired = true", i0);
  const rama = i0 > 0 && i1 > i0 ? motor.slice(i0, i1) : "";
  pOk("V9a · la rama determinística que sirve la definición curada existe y NO lava: `composeFromTextualEvidence` llega a pantalla sin pasar por el stripper",
    rama.length > 200 && !rama.includes("stripLanguageLeaks"));
  const blocks = fs.readFileSync(path.join(root, "src", "adi", "oracle", "narrationBlocks.js"), "utf8");
  pOk("V9b · `narrationBlocks` (donde vive el compositor verbatim) no importa el guard de voz — si algún día lo importa, la definición del glosario empieza a lavarse y hay que frenar",
    !/^\s*import[^\n]*voiceGuard/m.test(blocks));
  // Y se deja MEDIDO por qué importa: la entrada `vara` SÍ sería alterada si esa ruta lavara. No es una hipótesis.
  const vara = CD && CD.vara;
  pOk("V9c · la entrada `vara` del glosario sigue existiendo con su definición curada (si desaparece, este candado quedó huérfano y hay que revisar la decisión frenada del owner)",
    !!(vara && typeof vara.def === "string" && vara.def.length > 40 && typeof vara.distingue === "string"));
  pOk("V9d · MEDIDO: el `distingue` de esa entrada SÍ cambiaría al pasar por el stripper — por eso V9a/V9b son el candado y no un comentario",
    !!(vara && SLL(vara.distingue) !== vara.distingue));
  console.log(`  · el ECO narrado de «vara» sí se lava, y es la decisión ya tomada en el cierre del espejo (el registro manda sobre el eco); lo que no se toca es la definición servida verbatim`);
}

console.log(`\n── _voice_gate: PASS ${pass} · FAIL ${fail} (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
