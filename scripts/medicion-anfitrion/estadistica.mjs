/* === scripts/medicion-anfitrion/estadistica.mjs · LAS CUENTAS DEL A/B (`_ADI_DISENO_MEDICION_ANFITRION.md` §6bis) ═════════════════════════════════════════
 * Solo aritmética, sin azar escondido (el remuestreo usa un generador con semilla: mismos datos → mismo intervalo). Tres piezas:
 *
 *   wilson(k, n)               intervalo de Wilson (95 %) de una proporción k/n. Mejor que el normal cuando k es chico (aquí k son unas decenas de n ≈ mil).
 *   newcombe(kA, nA, kB, nB)   intervalo de Newcombe (método 10, híbrido de puntajes de Wilson) para la DIFERENCIA ABSOLUTA pA − pB. Es el chequeo «ingenuo»: trata cada afirmación como independiente.
 *   reduccionRelativa(...)     la reducción relativa 1 − pB/pA con un intervalo BOOTSTRAP POR HILO (percentil 95 %): se remuestrean los hilos del corpus —no las afirmaciones— y cada remuestra toma el
 *                              MISMO conjunto de hilos en los dos brazos (el diseño es pareado: mismo corpus, mismas preguntas). Por qué bootstrap y no Newcombe para el cociente: (1) Newcombe es para
 *                              diferencias, no para cocientes; (2) las afirmaciones de un mismo hilo no son independientes (mismo tema, mismo estilo del anfitrión) y las repeticiones repiten los hilos: el
 *                              hilo es la unidad que se remuestrea; (3) con tasas chicas el método delta del cociente (Katz) se vuelve inestable y sale simétrico en la escala equivocada.
 *
 *   veredictoDeLaRegla(...)    la REGLA DE PARADA (§6.4): «familia resuelta» si B reduce ≥ umbral (50 % por defecto) Y el intervalo de la reducción excluye la no-reducción (límite inferior > 0);
 *                              si no, «el residuo es variabilidad del anfitrión: el owner revisa el criterio».
 * Cero red, cero LLM. */

export const Z95 = 1.959963984540054;

/** wilson(k, n, z) → { p, lo, hi } · proporciones en [0, 1]. n = 0 → todo null. */
export function wilson(k, n, z = Z95) {
  if (!(n > 0)) return { p: null, lo: null, hi: null };
  const p = k / n, z2 = z * z;
  const den = 1 + z2 / n;
  const centro = (p + z2 / (2 * n)) / den;
  const mitad = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / den;
  return { p, lo: Math.max(0, centro - mitad), hi: Math.min(1, centro + mitad) };
}

/** newcombe(kA, nA, kB, nB, z) → { diff, lo, hi } · intervalo de Newcombe (método 10) para pA − pB. */
export function newcombe(kA, nA, kB, nB, z = Z95) {
  if (!(nA > 0) || !(nB > 0)) return { diff: null, lo: null, hi: null };
  const a = wilson(kA, nA, z), b = wilson(kB, nB, z);
  const d = a.p - b.p;
  return { diff: d, lo: d - Math.sqrt((a.p - a.lo) ** 2 + (b.hi - b.p) ** 2), hi: d + Math.sqrt((a.hi - a.p) ** 2 + (b.p - b.lo) ** 2) };
}

/** semilla determinista (mulberry32) */
export function generador(semilla = 20261009) {
  let a = semilla >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const _percentil = (orden, q) => { if (!orden.length) return null; const i = (orden.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i); return orden[lo] + (orden[hi] - orden[lo]) * (i - lo); };

/** reduccionRelativa({ A: {hilo: {k, n}}, B: {hilo: {k, n}} }, { iteraciones, semilla, nivel }) →
 *   { pA, pB, kA, nA, kB, nB, reduccion, lo, hi, iteraciones, validas, hilos, motivo? }
 *  k = afirmaciones de sobre-alcance, n = afirmaciones empresariales, por hilo y SUMADAS sobre las repeticiones del brazo. Los dos brazos tienen que traer los mismos hilos. */
export function reduccionRelativa({ A, B }, { iteraciones = 10000, semilla = 20261009, nivel = 0.95 } = {}) {
  const hilos = Object.keys(A).filter((h) => Object.prototype.hasOwnProperty.call(B, h)).sort();
  const suma = (X, hs) => hs.reduce((s, h) => ({ k: s.k + X[h].k, n: s.n + X[h].n }), { k: 0, n: 0 });
  const tA = suma(A, hilos), tB = suma(B, hilos);
  const base = { kA: tA.k, nA: tA.n, kB: tB.k, nB: tB.n, pA: tA.n ? tA.k / tA.n : null, pB: tB.n ? tB.k / tB.n : null, hilos: hilos.length, iteraciones, validas: 0, reduccion: null, lo: null, hi: null };
  if (!hilos.length) return { ...base, motivo: "los dos brazos no comparten ningún hilo" };
  if (!tA.n || !tB.n) return { ...base, motivo: "un brazo no tiene afirmaciones" };
  if (!tA.k) return { ...base, motivo: "el brazo A no tiene sobre-alcance: no hay nada que reducir (la reducción relativa no se define)" };
  const reduccion = 1 - (tB.k / tB.n) / (tA.k / tA.n);
  const rnd = generador(semilla), r = [];
  for (let it = 0; it < iteraciones; it++) {
    const hs = []; for (let i = 0; i < hilos.length; i++) hs.push(hilos[Math.floor(rnd() * hilos.length)]);
    const sa = suma(A, hs), sb = suma(B, hs);
    if (!sa.k || !sa.n || !sb.n) continue;
    r.push(1 - (sb.k / sb.n) / (sa.k / sa.n));
  }
  r.sort((x, y) => x - y);
  const cola = (1 - nivel) / 2;
  return { ...base, reduccion, lo: _percentil(r, cola), hi: _percentil(r, 1 - cola), validas: r.length };
}

/** veredictoDeLaRegla({ reduccion, lo }, { umbralPct }) → { resuelta, frase, umbralPct, cumpleUmbral, excluyeNoReduccion } · la regla de parada del diseño §6.4 (i)/(ii). */
export const FRASE_FAMILIA_RESUELTA = "familia resuelta";
export const FRASE_RESIDUO = "el residuo es variabilidad del anfitrión: el owner revisa el criterio";
export function veredictoDeLaRegla({ reduccion, lo }, { umbralPct = 50 } = {}) {
  const cumpleUmbral = reduccion != null && reduccion * 100 >= umbralPct;
  const excluyeNoReduccion = lo != null && lo > 0;
  const resuelta = cumpleUmbral && excluyeNoReduccion;
  return { resuelta, frase: resuelta ? FRASE_FAMILIA_RESUELTA : FRASE_RESIDUO, umbralPct, cumpleUmbral, excluyeNoReduccion };
}
