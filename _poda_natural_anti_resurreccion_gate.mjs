/* === _poda_natural_anti_resurreccion_gate.mjs · EL CANDADO DE LA PODA DEL NATURAL (2026-09-05) ==============
 *
 * LA PODA: con la palabra del owner («poda inmediata», tras el pulido del anclaje) el CAMINO NATURAL se retiró
 * del código — el orquestador (`caminoNatural.js`), su prompt (`naturalPrompt.js`), la rama `modoNatural` del
 * gateway y de los adapters, `_fetchNatural`/su bloque en ChatADI y el flag `ADI_CAMINO_NATURAL`. La cascada
 * del turno libre quedó agente → oráculo. El rollback es `git revert` del commit del retiro, documentado en
 * `_PODA_NATURAL_PLAN.md`.
 *
 * QUÉ IMPIDE ESTE GATE: que lo retirado vuelva sin que nadie lo decida — re-escrito de memoria, revertido de
 * una rama vieja, o restaurado de una copia. El patrón es el de `_poda_anti_resurreccion_gate` (Fase 2A):
 *   1 · POR LISTA EXPLÍCITA, no heurística: estos nombres fueron adjudicados muertos uno por uno.
 *   2 · DEFINICIÓN, NO MENCIÓN: los comentarios siguen contando la historia (y deben) — el scan corre sobre
 *       el código con los comentarios quitados.
 *   3 · LO QUE LOS REEMPLAZÓ SIGUE VIVO: la cascada agente → oráculo y el freno tipado del gateway.
 *   4 · EL DETECTOR SE PRUEBA A SÍ MISMO: sintéticos que SÍ debe cazar y menciones que NO puede cazar.
 *
 * CERO RED, CERO LLM: solo lee archivos como texto. @inspeccion-estatica — menciona `gatewayCore` porque LEE
 * ese archivo para certificar el freno tipado; no lo importa ni invoca nada (las condiciones del escape del
 * clasificador, verificadas por él, no confiadas). */
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
let pass = 0, fail = 0;
const ok = (cond, label, detalle) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label}${detalle ? " — " + detalle : ""}`); }
};
const H = (t) => console.log(`\n── ${t} ──`);

/* sinComentarios: la misma herramienta local de `_poda_anti_resurreccion_gate` (con su mismo límite declarado:
 * la heurística regex-vs-división mira el último carácter significativo; equivocarse deja texto de comentario
 * de más o de menos — jamás inventa una definición, porque lo que se busca exige palabras clave reales). */
function sinComentarios(src) {
  let out = "", i = 0, previoSignificativo = "";
  const n = src.length;
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (c === "/" && d === "/") { while (i < n && src[i] !== "\n") i++; continue; }
    if (c === "/" && d === "*") { i += 2; while (i < n && !(src[i] === "*" && src[i + 1] === "/")) i++; i += 2; continue; }
    if (c === '"' || c === "'" || c === "`") {
      const cierre = c; out += c; i++;
      while (i < n) {
        if (src[i] === "\\") { out += src.slice(i, i + 2); i += 2; continue; }
        out += src[i];
        if (src[i] === cierre) { i++; break; }
        i++;
      }
      previoSignificativo = cierre;
      continue;
    }
    if (c === "/" && !"))]}".includes(previoSignificativo) && !/[A-Za-z0-9_$]/.test(previoSignificativo)) {
      out += c; i++;
      let enClase = false;
      while (i < n) {
        if (src[i] === "\\") { out += src.slice(i, i + 2); i += 2; continue; }
        if (src[i] === "[") enClase = true;
        else if (src[i] === "]") enClase = false;
        else if (src[i] === "/" && !enClase) { out += src[i]; i++; break; }
        else if (src[i] === "\n") break;
        out += src[i]; i++;
      }
      previoSignificativo = "/";
      continue;
    }
    out += c;
    if (!/\s/.test(c)) previoSignificativo = c;
    i++;
  }
  return out;
}

/* el barrido: todo src/ (y api/ si existe) — .js/.jsx/.mjs; dist/ y node_modules quedan fuera (build e
 * instalación no son fuente; el bundle limpio lo verifica el commit del retiro y el build de cada release). */
const archivosFuente = (dir) => {
  const out = [];
  const caminar = (d) => {
    for (const f of readdirSync(d)) {
      const p = join(d, f);
      const st = statSync(p);
      if (st.isDirectory()) { if (!/node_modules|dist|\.git/.test(f)) caminar(p); continue; }
      if (/\.(js|jsx|mjs)$/.test(f)) out.push(p);
    }
  };
  if (existsSync(dir)) caminar(dir);
  return out;
};

/* las formas de RESUCITAR, cada una con su detector sobre código sin comentarios */
const RE_IMPORT_MUERTO = /(?:from\s*["'][^"']*(?:caminoNatural|naturalPrompt)(?:\.js)?["'])|(?:import\s*\(\s*["'][^"']*(?:caminoNatural|naturalPrompt))/;
const RE_FLAG_DECLARADO = /(?:^|[^A-Za-z0-9_$"'])(?:export\s+const\s+ADI_CAMINO_NATURAL|["']ADI_CAMINO_NATURAL["']\s*,|P\(\s*["']ADI_CAMINO_NATURAL["']\s*\))/m;
const RE_SIMBOLO_DEFINIDO = /(?:function\s+answerViaNatural\b|const\s+answerViaNatural\s*=|export\s*\{[^}]*\banswerViaNatural\b|function\s+buildNaturalSystemSegments\b|const\s+buildNaturalSystemSegments\s*=)/;

H("0 · el detector se prueba a sí mismo (sintéticos: debe cazar la definición, no la mención)");
{
  ok(RE_IMPORT_MUERTO.test(sinComentarios('import { answerViaNatural } from "../oracle/caminoNatural.js";')),
    "caza el import estático del orquestador muerto");
  ok(RE_IMPORT_MUERTO.test(sinComentarios('const m = await import("./src/adi/oracle/naturalPrompt.js");')),
    "caza el import dinámico del prompt muerto");
  ok(!RE_IMPORT_MUERTO.test(sinComentarios('/* la historia: acá vivía caminoNatural.js, retirado en La Poda */\nconst x = 1;')),
    "y NO caza la mención en un comentario — la memoria del repo no es deuda");
  ok(RE_FLAG_DECLARADO.test(sinComentarios('const FEATURE = [\n  "ADI_CAMINO_NATURAL",\n];')),
    "caza el flag re-declarado en una lista de perfil");
  ok(RE_FLAG_DECLARADO.test(sinComentarios('export const ADI_CAMINO_NATURAL = P("ADI_CAMINO_NATURAL");')),
    "caza el export del flag re-nacido");
  ok(!RE_FLAG_DECLARADO.test(sinComentarios('// APAGARLO = quitar ADI_CAMINO_NATURAL de FEATURE\nconst y = 2;')),
    "y NO caza el nombre del flag en un comentario");
  ok(RE_SIMBOLO_DEFINIDO.test(sinComentarios("export function answerViaNatural() { return 1; }")),
    "caza la re-definición del orquestador");
  ok(!RE_SIMBOLO_DEFINIDO.test(sinComentarios('const t = "answerViaNatural se retiró";')),
    "y NO caza el nombre dentro de un string");
}

H("1 · los archivos muertos siguen muertos");
{
  ok(!existsSync(join(ROOT, "src", "adi", "oracle", "caminoNatural.js")), "caminoNatural.js no existe");
  ok(!existsSync(join(ROOT, "src", "adi", "oracle", "naturalPrompt.js")), "naturalPrompt.js no existe");
}

H("2 · nadie importa ni define lo retirado, y el flag no se re-declara (src/ y api/, sin comentarios)");
{
  const archivos = [...archivosFuente(join(ROOT, "src")), ...archivosFuente(join(ROOT, "api"))];
  const importan = [], definen = [], flagean = [], ramas = [];
  for (const p of archivos) {
    const limpio = sinComentarios(readFileSync(p, "utf8").replace(/\r\n/g, "\n"));
    const rel = relative(ROOT, p);
    if (RE_IMPORT_MUERTO.test(limpio)) importan.push(rel);
    if (RE_SIMBOLO_DEFINIDO.test(limpio)) definen.push(rel);
    if (RE_FLAG_DECLARADO.test(limpio)) flagean.push(rel);
    /* la rama modoNatural: la ÚNICA aparición viva permitida es el freno tipado del gateway */
    const m = limpio.match(/modoNatural/g);
    if (m && m.length) ramas.push(`${rel} (${m.length})`);
  }
  ok(!importan.length, "ni un import (estático o dinámico) de caminoNatural/naturalPrompt", importan.join(" · "));
  ok(!definen.length, "ni una re-definición de answerViaNatural/buildNaturalSystemSegments", definen.join(" · "));
  ok(!flagean.length, "ADI_CAMINO_NATURAL no vuelve: ni a FEATURE, ni como export, ni por P(...)", flagean.join(" · "));
  ok(ramas.length === 1 && /gatewayCore\.js \(1\)/.test(ramas[0]),
    "la única mención viva de `modoNatural` es el freno tipado del gateway — una rama nueva sería resurrección",
    ramas.join(" · "));
}

H("3 · lo que lo reemplazó sigue vivo (un candado de ausencias solas se queda verde ante el desierto)");
{
  const chat = sinComentarios(readFileSync(join(ROOT, "src", "ui", "ChatADI.jsx"), "utf8").replace(/\r\n/g, "\n"));
  ok(/if \(ADI_AGENTE\) \{/.test(chat) && /bucleAgente\.js/.test(chat),
    "el peldaño del AGENTE está en ChatADI (el camino principal)");
  ok(/answerViaOracle\(\{/.test(chat), "…y el ORÁCULO sigue debajo: la cascada de dos peldaños existe");
  ok(/el agente falló y el turno cayó al oráculo/.test(readFileSync(join(ROOT, "src", "ui", "ChatADI.jsx"), "utf8")),
    "…con el catch que deja rastro (la lección del catch mudo, conservada)");
  const gw = sinComentarios(readFileSync(join(ROOT, "src", "adi", "llm", "gatewayCore.js"), "utf8").replace(/\r\n/g, "\n"));
  ok(/payload\.modoNatural === true/.test(gw) && /el modo natural fue retirado/.test(readFileSync(join(ROOT, "src", "adi", "llm", "gatewayCore.js"), "utf8")),
    "el gateway FRENA con error tipado a un caller viejo con modoNatural — silencio sería peor");
  const bucle = sinComentarios(readFileSync(join(ROOT, "src", "adi", "agente", "bucleAgente.js"), "utf8").replace(/\r\n/g, "\n"));
  ok(/detectFichaIntent\(/.test(bucle), "la puerta a la ficha desde texto libre vive en el bucle (re-cableada del natural)");
  ok(/_respaldoDeLoYaAprobado\(/.test(bucle) && /ultimaAprobada = pantalla/.test(bucle),
    "el peldaño del respaldo y su marca `ultimaAprobada` viven en el agente (paso 0 + re-cableo verificados)");
}

console.log(`\n── _poda_natural_anti_resurreccion_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail === 0 ? 0 : 1);
