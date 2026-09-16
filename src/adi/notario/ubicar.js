/* ubicar.js · DÓNDE ESTÁ EN LA PROSA EL FRAGMENTO QUE EL MODELO DECLARÓ (Notario semántico, fase 4 · 2026-09-16) ═══════════════
 * El modelo escribe la prosa y, aparte, declara cada afirmación con su `texto` = el tramo literal que la contiene. En vivo (fase 3),
 * 16 de 383 fragmentos no se encontraron aunque la afirmación estaba en la prosa: markdown («**Santiago:** $64K» vs «Santiago: $64K»),
 * comillas («"la que mejor te deja" es…»), un paréntesis omitido («su markup (precio de lista sobre costo) es de 37,2%»), una elipsis
 * («su markup... es 40.6%»), una errata («4 de la 5 marcas») o una paráfrasis corta con la misma cifra y el mismo dueño («$33,2M de
 * Samsung» por «$33,2M contra $25,8M de LG»). Son todos fragmentos del PROPIO autor sobre su PROPIA prosa: ubicarlos con tolerancia
 * no interpreta redacción ajena ni cambia ningún veredicto — solo evita que una afirmación presente quede como «ajena».
 *
 * La tolerancia es ESCALONADA y cada escalón deja su modo en la respuesta (el expediente lo registra):
 *   literal → sin-marcas (markdown, comillas, puntuación) → con-hueco (elipsis o un paréntesis omitido) → cabeza/cola → asistida (la
 *   oración que tiene TODAS las cifras del fragmento, el dueño si lo nombra, y ≥ 70 % de sus palabras de contenido). Nada más: si no
 *   se ubica así, el fragmento es ajeno. */
import { normalizar, menosAscii } from "./afirmacion.js";

const _dec = (s) => s.replace(/(\d),(\d)/g, "$1.$2");
/* normaliza y devuelve el mapa posición-normalizada → posición-original (las posiciones del detector de presencia viven en el original) */
export function normalizarConMapa(s) {
  const src = menosAscii(String(s || ""));
  const out = [], mapa = [];
  let prevEspacio = false;
  for (let i = 0; i < src.length; i++) {
    let ch = src[i];
    if (ch === "," && /\d/.test(src[i - 1] || "") && /\d/.test(src[i + 1] || "")) ch = ".";   // 37,2 → 37.2 (mismo largo)
    ch = ch.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    if (!ch) continue;
    if (/\s/.test(ch)) { if (prevEspacio) continue; prevEspacio = true; out.push(" "); mapa.push(i); continue; }
    prevEspacio = false; out.push(ch[0]); mapa.push(i);
  }
  mapa.push(src.length);
  return { texto: out.join(""), mapa, src };
}
/* las marcas que no son prosa: markdown (** * _ `), comillas y guillemets, y la puntuación pegada («Santiago:» = «Santiago») */
const _MARCAS = /[*_`"'«»“”‘’]/g;
const _sinMarcas = (s) => s.replace(_MARCAS, "").replace(/\s+/g, " ").trim();
const _sinPuntuacion = (s) => _sinMarcas(s).replace(/[:;,.()[\]—–-]/g, " ").replace(/\s+/g, " ").trim();

const _escapar = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/* los números de un tramo (con su escala pegada: 37.2%, $33.2m, 165d) y sus palabras de contenido */
const _numeros = (s) => (s.match(/\d+(?:\.\d+)?/g) || []);
const _VACIAS = new Set(["de", "del", "la", "las", "el", "los", "un", "una", "unos", "unas", "y", "o", "e", "en", "con", "sin", "que", "a", "al", "por", "para", "su", "sus", "es", "son", "esta", "este", "esa", "ese", "eso", "esto", "lo", "le", "se", "no", "si", "mas", "muy", "ya", "como", "contra", "entre", "sobre", "hacia", "desde", "hasta", "tu", "tus", "mi", "mis", "te", "me", "nos", "hay", "fue", "era", "ser", "está", "esta", "tiene", "tienen"]);
const _palabras = (s) => _sinPuntuacion(s).split(" ").filter((w) => w.length >= 3 && !_VACIAS.has(w) && !/^\d/.test(w));
const _oraciones = (tN) => { const out = []; const re = /[^.\n!?;]+(?:\.\d+[^.\n!?;]*)*[.\n!?;]?/g; let m; while ((m = re.exec(tN))) { if (m[0].trim()) out.push({ ini: m.index, fin: m.index + m[0].length }); } return out; };

/** ubicarFragmento(prosa, fragmento, {nombres, desde}) → { ini, fin, modo } en coordenadas del ORIGINAL, o null */
export function ubicarFragmento(prosa, fragmento, { nombres = [], desde = 0 } = {}) {
  const P = normalizarConMapa(prosa);
  const fN = normalizarConMapa(fragmento).texto.trim();
  if (!fN) return null;
  const orig = (i, j) => ({ ini: P.mapa[Math.max(0, Math.min(i, P.mapa.length - 1))], fin: P.mapa[Math.max(0, Math.min(j, P.mapa.length - 1))] });
  const desdeN = desde > 0 ? (P.mapa.findIndex((x) => x >= desde)) : 0;
  const d0 = desdeN < 0 ? P.texto.length : desdeN;
  /* 1 · literal */
  let i = P.texto.indexOf(fN, d0);
  if (i >= 0) return { ...orig(i, i + fN.length), modo: "literal" };
  /* 2 · sin marcas de markdown ni comillas: se busca en la prosa con esas marcas como opcionales */
  const partesSinMarcas = _sinMarcas(fN).split(" ").filter(Boolean);
  if (partesSinMarcas.length) {
    const re = new RegExp(partesSinMarcas.map(_escapar).join("[\\s*_`\"'«»“”‘’]*[\\s]*"), "g");
    re.lastIndex = d0; const m = re.exec(P.texto);
    if (m) return { ...orig(m.index, m.index + m[0].length), modo: "sin-marcas" };
  }
  /* 3 · con hueco: una elipsis del propio fragmento, o un paréntesis/aclaración que el fragmento omitió (hasta 80 caracteres) */
  const trozos = fN.split(/\s*(?:\.{3}|…)\s*/).map((t) => t.trim()).filter(Boolean);
  if (trozos.length >= 2) {
    const re = new RegExp(trozos.map((t) => _sinPuntuacion(t).split(" ").filter(Boolean).map(_escapar).join("[^a-z0-9]{0,4}")).join("[\\s\\S]{0,120}?"), "g");
    re.lastIndex = d0; const m = re.exec(P.texto);
    if (m) return { ...orig(m.index, m.index + m[0].length), modo: "con-hueco" };
  }
  {
    const w = _sinPuntuacion(fN).split(" ").filter(Boolean);
    if (w.length >= 3) {
      const re = new RegExp(w.map(_escapar).join("(?:[^a-z0-9]{0,4}|\\s*\\([^)]{0,80}\\)\\s*|[\\s\\S]{0,12})"), "g");
      re.lastIndex = d0; const m = re.exec(P.texto);
      if (m && m[0].length <= fN.length + 100) return { ...orig(m.index, m.index + m[0].length), modo: "con-hueco" };
    }
  }
  /* 4 · cabeza o cola (fragmentos largos) */
  if (fN.length > 40) {
    const cab = fN.slice(0, 40); i = P.texto.indexOf(cab, d0); if (i >= 0) return { ...orig(i, Math.min(P.texto.length, i + fN.length)), modo: "cabeza" };
    const cola = fN.slice(-40); const j = P.texto.indexOf(cola, d0); if (j >= 0) return { ...orig(Math.max(0, j - (fN.length - 40)), j + cola.length), modo: "cola" };
  }
  /* 5 · asistida: la oración con todas las cifras del fragmento, el dueño que nombra, y la mayoría de sus palabras */
  const nums = _numeros(fN), pal = _palabras(fN);
  const duenos = (nombres || []).map((n) => normalizarConMapa(n).texto.trim()).filter((n) => n && fN.includes(n));
  if (nums.length || pal.length >= 2) {
    /* el salto de línea también cierra una oración (una lista con viñetas no es una sola oración): el espacio normalizado que
     * cubre un «\n» del original se marca como frontera */
    const conSaltos = P.texto.split("");
    for (let k = 0; k < conSaltos.length; k++) if (conSaltos[k] === " " && P.src.slice(P.mapa[k], P.mapa[k + 1]).includes("\n")) conSaltos[k] = "\n";
    for (const o of _oraciones(conSaltos.join(""))) {
      if (o.fin <= d0) continue;
      const s = P.texto.slice(o.ini, o.fin);
      if (!nums.every((n) => new RegExp("(?<![\\d.])" + _escapar(n) + "(?![\\d])").test(s))) continue;
      if (!duenos.every((n) => s.includes(n))) continue;
      const hits = pal.filter((w) => s.includes(w)).length;
      const minimo = pal.length ? Math.ceil(pal.length * 0.7) : 0;
      if (hits >= minimo && (nums.length || hits >= 2)) {
        /* el tramo cubierto: de la primera a la última pieza casada (cifras, dueños, palabras), no la oración entera */
        const posiciones = [];
        const jD = duenos.length ? s.indexOf(duenos[0]) : -1;
        for (const n of nums) {
          /* la ocurrencia de la cifra más cercana al dueño («MAK-COMP-AIR: $8K» es el $8K de su línea, no el «$8K en Antofagasta» de antes) */
          const re = new RegExp("(?<![\\d.])" + _escapar(n) + "(?![\\d])", "g"); let m, mejor = null, dist = Infinity;
          while ((m = re.exec(s))) { const d = jD >= 0 ? Math.abs(m.index - jD) : m.index; if (d < dist) { dist = d; mejor = [m.index, m.index + m[0].length]; } }
          if (mejor) posiciones.push(mejor);
        }
        for (const d of duenos) { const j = s.indexOf(d); if (j >= 0) posiciones.push([j, j + d.length]); }
        for (const w of pal) { const j = s.indexOf(w); if (j >= 0) posiciones.push([j, j + w.length]); }
        const ini = posiciones.length ? Math.min(...posiciones.map((p) => p[0])) : 0, fin = posiciones.length ? Math.max(...posiciones.map((p) => p[1])) : s.length;
        return { ...orig(o.ini + ini, o.ini + fin), modo: "asistida" };
      }
    }
  }
  return null;
}
