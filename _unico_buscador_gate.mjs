/* === _unico_buscador_gate.mjs · LA LEY DEL ÚNICO BUSCADOR (owner 2026-09-03) ================================
 *
 * NACIDA DEL DEFECTO DE PRODUCCIÓN del 2026-09-02: el owner preguntó por «Mercado Norte» y ADI declinó sobre
 * «Mercado Libre» — serieIntent aceptaba el candidato de un PEDAZO del nombre. El arreglo mató ese caso; ESTA
 * es la ley que impide el siguiente: **ningún módulo resuelve nombres de entidad fuera del índice canónico
 * (`entityIndex`), y del índice solo el match EXACTO resuelve — el parecido se ofrece, jamás se asume.**
 *
 * LO QUE ESTE GATE BARRE, mecánico:
 *   1 · IMPLEMENTAR DISTANCIA (levenshtein y familia) solo puede hacerlo la lista declarada — la casa
 *       (entityIndex) y los DOS JUECES de salida (entityGuard · guardC), que comparan el TEXTO DEL MODELO
 *       contra nombres para VETAR corrupción: dirección INVERSA al defecto (juzgan salida, no resuelven
 *       entrada del usuario) y además intocables por orden del owner. Un cuarto sitio con distancia → ROJO.
 *   2 · CONSUMIR `findCandidates` (el buscador borroso) solo puede hacerlo la lista declarada, cada uno con su
 *       conducta escrita. Un consumidor nuevo → ROJO hasta declararse con su porqué.
 *       (`resolveCanonical`/`resolveEntityRef` no llevan lista: son exactos/veredicto POR CONSTRUCCIÓN — usar
 *       esos ES la ley.)
 *   3 · PINS de conducta en los resolvedores arreglados: el «solo exacto» no se afloja sin que esto arda.
 *
 * EL GRIS DECLARADO (criterio del supervisor: «los grises, con el porqué escrito»):
 *   · `fichaIntent` resuelve parecidos (prefijo/tipeo) PERO su único producto es un BOTÓN cuya etiqueta nombra
 *     la entidad resuelta («Ver la ficha de Mercado Libre en Sentrix»): el usuario LEE el nombre y decide con
 *     el click — es una oferta explícita, no una respuesta sobre otro sujeto. Queda declarado como gris y
 *     TRAÍDO al supervisor (2026-09-03) para que el owner decida si el botón-parecido le vale como oferta o lo
 *     quiere exacto+tipeo. Este gate NO le congela esa conducta: solo lo mantiene en la lista con este porqué.
 *   · `mapaDelDato._sinNombresDeEntidad` TAPA nombres para leer qué EJES nombra una pregunta — usa nombres para
 *     otra cosa, no resuelve al usuario. No consume findCandidates (el barrido §2 lo verifica solo).
 *
 * OFFLINE · determinístico · cero red. `node --import ./scripts/offline-guard.mjs _unico_buscador_gate.mjs` */
import fs from "node:fs";
import path from "node:path";

let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };
const H = (t) => console.log("\n" + t);
const ROOT = process.cwd();

/* el barrido, factorizado para que las carnadas lo ejerciten con fuentes sintéticos */
export const implementaDistancia = (src) =>
  /\b_?lev(?:enshtein)?\s*\(|\blevenshtein\b|editDistance|damerau|matriz de distancia/i.test(src)
  || /motivo:\s*"(?:prefijo|tipeo)"/.test(src);   // fabricar candidatos borrosos con la firma del índice también es implementar
export const consumeBuscadorBorroso = (src) => /\bfindCandidates\s*\(/.test(src) || /\bfindCandidates\b/.test(src) && /import[^\n]*findCandidates/.test(src);

const _archivos = (dir, out = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name.startsWith(".")) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) _archivos(p, out);
    else if (/\.(js|jsx)$/.test(e.name) && !/\.carnada/.test(e.name)) out.push(p);
  }
  return out;
};
const rel = (p) => path.relative(ROOT, p).replace(/\\/g, "/");

/* ═══ 1 · LA DISTANCIA SOLO VIVE EN LA LISTA DECLARADA ══════════════════════════════════════════════════════ */
H("1 · implementar distancia de nombres: solo la casa y los dos jueces de salida");
{
  const DECLARADOS = new Map([
    ["src/adi/oracle/entityIndex.js", "LA CASA: el único índice que busca borroso — todos le piden a él"],
    ["src/adi/llm/entityGuard.js", "JUEZ de salida (intocable): caza nombres corruptos EN EL TEXTO DEL MODELO — juzga salida, no resuelve entrada"],
    ["src/adi/oracle/guardC.js", "JUEZ de salida (intocable): el casi-match ahí VETA («Cada» ≈ «Casa Belgrano»), jamás resuelve"],
  ]);
  const con = _archivos(path.join(ROOT, "src")).filter((p) => implementaDistancia(fs.readFileSync(p, "utf8")));
  const fuera = con.map(rel).filter((p) => !DECLARADOS.has(p));
  ok(fuera.length === 0, `★ ningún módulo fuera de los ${DECLARADOS.size} declarados implementa distancia de nombres (${con.length} con distancia)`, fuera.join(", "));
  for (const [p, porque] of DECLARADOS) {
    ok(fs.existsSync(path.join(ROOT, p)), `declarado vivo: ${p} — ${porque.slice(0, 60)}…`);
  }
}

/* ═══ 2 · LOS CONSUMIDORES DEL BUSCADOR BORROSO, DECLARADOS CON SU CONDUCTA ═════════════════════════════════ */
H("2 · `findCandidates` solo lo consume la lista declarada — el nuevo se declara o arde");
const CONSUMIDORES = new Map([
  ["src/adi/oracle/entityIndex.js", "la casa (lo define)"],
  ["src/adi/oracle/serieIntent.js", "solo EXACTO resuelve; prefijo/tipeo → noResuelve con oferta (310ca8f — el arreglo del defecto de la captura)"],
  ["src/adi/oracle/fichaIntent.js", "GRIS-OFERTA declarado: el parecido produce un BOTÓN etiquetado con el nombre resuelto — el usuario lee y decide; traído al supervisor 2026-09-03"],
  ["src/adi/agente/herramientasAgente.js", "solo EXACTO resuelve; el parecido viaja como sugerencia en el sinSoporte («ofrécelo, no lo asumas»)"],
]);
{
  const con = _archivos(path.join(ROOT, "src")).filter((p) => /\bfindCandidates\b/.test(fs.readFileSync(p, "utf8")));
  const fuera = con.map(rel).filter((p) => !CONSUMIDORES.has(p));
  ok(fuera.length === 0, `★ los ${con.length} consumidores de findCandidates están declarados con su conducta`, fuera.join(", "));
  const muertos = [...CONSUMIDORES.keys()].filter((p) => !con.map(rel).includes(p));
  ok(muertos.length === 0, "…y ninguna declaración apunta a un consumidor que ya no consume (la lista no acumula fantasmas)", muertos.join(", "));
}

/* ═══ 3 · LOS PINS DE CONDUCTA · el «solo exacto» no se afloja en silencio ══════════════════════════════════ */
H("3 · los resolvedores arreglados conservan la ley en su texto");
{
  const serie = fs.readFileSync(path.join(ROOT, "src/adi/oracle/serieIntent.js"), "utf8");
  ok(/motivo === "exacto"/.test(serie) && /noResuelve/.test(serie),
    "serieIntent: la aceptación exige motivo exacto y el roce sale como noResuelve (jamás como entidad)");
  const herr = fs.readFileSync(path.join(ROOT, "src/adi/agente/herramientasAgente.js"), "utf8");
  ok(/motivo === "exacto"/.test(herr) && /sugerencia/.test(herr) && /Ofrécelo, no lo asumas/.test(herr),
    "la caja del agente: _resolver exige exacto y el parecido viaja como sugerencia ofrecida");
  const mapa = fs.readFileSync(path.join(ROOT, "src/adi/agente/mapaDelDato.js"), "utf8");
  ok(!/findCandidates/.test(mapa),
    "el gris del mapa (_sinNombresDeEntidad) sigue tapando nombres SIN consumir el buscador — usa nombres para otra cosa");
}

/* ═══ 4 · CARNADAS · plantar un segundo buscador tiene que arder ════════════════════════════════════════════ */
H("4 · carnadas: el barrido muerde lo que la ley prohíbe");
{
  const segundo = `function _lev(a, b) { const m = []; /* mi propia distancia */ return m.length; }\nconst cerca = _lev(q, nombre) <= 2;`;
  ok(implementaDistancia(segundo), "carnada «un segundo levenshtein plantado» → el barrido §1 lo marca: ROJO");
  const fabricante = `const candidatos = nombres.map((n) => ({ nombre: n, motivo: "prefijo" }));`;
  ok(implementaDistancia(fabricante), "carnada «fabricar candidatos con la firma del índice (motivo prefijo)» → ROJO igual");
  const consumidor = `import { findCandidates } from "./entityIndex.js";\nconst c = findCandidates("cliente", frase);`;
  ok(/\bfindCandidates\b/.test(consumidor) && !CONSUMIDORES.has("src/adi/oracle/nuevoModulo.js"),
    "carnada «un consumidor nuevo sin declarar» → el check §2 lo lista y arde hasta que se declare con su porqué");
  const limpio = `import { resolveCanonical } from "./entityIndex.js";\nconst canon = resolveCanonical("cliente", nombre);`;
  ok(!implementaDistancia(limpio) && !/\bfindCandidates\b/.test(limpio),
    "control: consumir resolveCanonical (exacto por construcción) NO se marca — usarlo ES la ley");
}

console.log(`\n── _unico_buscador_gate: ${PASS} PASS · ${FAIL} FAIL (de ${PASS + FAIL}) ──`);
process.exit(FAIL ? 1 : 0);
