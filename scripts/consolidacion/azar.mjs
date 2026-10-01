/* === scripts/consolidacion/azar.mjs · EL AZAR CON SEMILLA (consolidación, infraestructura común de los controles) ═════
 * Un generador pseudoaleatorio DETERMINÍSTICO (mulberry32): la misma semilla produce siempre la misma secuencia, en cualquier
 * máquina. Sin `Math.random`, sin reloj. Lo usa `generador.mjs` para que «el corpus al azar» sea reproducible: una violación
 * que aparece con la semilla S y el índice i aparece SIEMPRE con esa semilla y ese índice. */
const _hash = (s) => { let h = 2166136261 >>> 0; const t = String(s); for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; };

export function crearAzar(semilla) {
  let s = _hash(semilla) >>> 0;
  const next = () => { s = (s + 0x6D2B79F5) >>> 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const int = (a, b) => a + Math.floor(next() * (b - a + 1));
  const bool = (p = 0.5) => next() < p;
  const pick = (xs) => xs[Math.floor(next() * xs.length)];
  /** elige una clave de `{ clave: peso }` con probabilidad proporcional al peso */
  const pesos = (o) => { const ks = Object.keys(o); const tot = ks.reduce((a, k) => a + o[k], 0); let r = next() * tot; for (const k of ks) { r -= o[k]; if (r < 0) return k; } return ks[ks.length - 1]; };
  /** k elementos distintos de `xs` (sin reemplazo, en orden aleatorio) */
  const muestra = (xs, k) => { const a = xs.slice(); const out = []; while (a.length && out.length < k) out.push(a.splice(Math.floor(next() * a.length), 1)[0]); return out; };
  return { next, int, bool, pick, pesos, muestra };
}
