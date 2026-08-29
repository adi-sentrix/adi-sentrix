/* === _poda_anti_resurreccion_gate.mjs · EL CANDADO DE LA PODA (Fase 2A, 2026-08-14) ==============================
 * QUÉ IMPIDE: que una ruta que ya se adjudicó MUERTA y se borró vuelva a nacer sin que nadie lo decida. Un símbolo
 * podado reaparece por tres vías reales, no hipotéticas: alguien lo re-escribe de memoria, alguien revierte un
 * archivo entero desde una rama vieja, o alguien restaura una copia de seguridad. En los tres casos el repo vuelve
 * a tener dos compositores para lo mismo — que es exactamente el estado que La Poda existe para terminar.
 *
 * CÓMO LO VERIFICA, y por qué así:
 *   1. POR LISTA EXPLÍCITA, no por heurística. No hay forma honesta de detectar «código muerto en general» sin
 *      falsos positivos (una función sin caller hoy puede ser el entrypoint de mañana). Lo que sí se puede afirmar
 *      sin ambigüedad es: ESTOS CUATRO NOMBRES fueron adjudicados muertos, verificados uno por uno y borrados —
 *      así que su reaparición es un hecho comprobable, no un juicio. Agregar un nombre a la lista es una decisión
 *      humana, igual que borrarlo lo fue.
 *   2. DEFINICIÓN, NO MENCIÓN. Los comentarios del motor siguen contando la historia de estos símbolos —y deben:
 *      explican por qué el mecanismo de hoy es como es. Un gate que se pusiera rojo ante una mención convertiría la
 *      memoria del repo en deuda. Así que el scan corre sobre el código CON LOS COMENTARIOS QUITADOS, y sólo busca
 *      formas de DEFINIR o EXPORTAR.
 *   3. LO QUE LOS REEMPLAZÓ TIENE QUE SEGUIR VIVO. Un candado que sólo mira ausencias se queda verde el día que
 *      alguien borra las dos piezas — la vieja y la nueva. Por cada podado se verifica que su sucesor siga
 *      exportado desde donde el motor lo importa.
 *   4. NI UN IMPORT COLGANDO. Un `import { X }` de un export que ya no existe revienta en tiempo de link, no de
 *      compilación: se descubre corriendo, y sólo si esa ruta se ejercita. Se barre todo el repo, no sólo src/.
 *   5. EL DETECTOR SE PRUEBA A SÍ MISMO. Un candado que nunca vio rojo no es un candado: la sección 0 le pasa
 *      fuentes sintéticas donde el símbolo SÍ está definido (tiene que detectarlas) y otras donde sólo está
 *      nombrado en un comentario o en un string (no puede detectarlas).
 *
 * CERO RED, CERO LLM, CERO CRÉDITO: este gate sólo lee archivos del disco como texto. No importa ni un módulo del
 * producto — ni siquiera los que certifica.
 */
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
let pass = 0, fail = 0;
const ok = (cond, label, detalle) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label}${detalle ? " — " + detalle : ""}`); }
};
const H = (t) => console.log(`\n── ${t} ──`);

/* ── LO PODADO ────────────────────────────────────────────────────────────────────────────────────────────────────
 * `vivia`: dónde estaba, para que el mensaje de error diga qué revisar sin ir a buscar el commit.
 * `sucesor`: el símbolo que hace hoy ese trabajo, y el archivo que tiene que seguir exportándolo. `null` cuando el
 *            podado no tenía sucesor porque no hacía nada que hubiera que seguir haciendo. */
const PODADOS = [
  {
    nombre: "composeFromLedger",
    vivia: "src/adi/oracle/narrationBlocks.js",
    porque: "la reparación tabular vieja; componerPorForma la reemplazó cuando la reparación pasó a respetar la forma pedida (owner 2026-08-12, punto 3)",
    sucesor: { nombre: "componerPorForma", archivo: "src/adi/oracle/narrationBlocks.js" },
  },
  {
    nombre: "composeCompareNotYet",
    vivia: "src/adi/conversation.js",
    porque: "el placeholder V1 que prometía «la comparación llega en el próximo paso»; ese paso es composeCompare, en producción desde 2026-07-06",
    sucesor: { nombre: "composeCompare", archivo: "src/adi/conversation.js" },
  },
  {
    nombre: "repairField",
    vivia: "src/adi/oracle/conversationalContract.js",
    porque: "el accessor de una fila de REPAIR_FIELDS; el único consumidor real de la tabla es camposQueSobreviven, que lee el índice directo",
    sucesor: { nombre: "camposQueSobreviven", archivo: "src/adi/oracle/conversationalContract.js" },
  },
  {
    nombre: "_HeroInicioLegacy",
    vivia: "src/ui/ChatADI.jsx",
    porque: "el hero viejo con chips y botón de resumen ejecutivo; el owner cortó el inicio a una sola pregunta (2026-08-12) y los ejemplos viven en la Guía de inicio",
    sucesor: { nombre: "HeroInicio", archivo: "src/ui/ChatADI.jsx" },
  },
];

/* ── SIN COMENTARIOS ──────────────────────────────────────────────────────────────────────────────────────────────
 * Quita comentarios de línea y de bloque respetando strings, template literals y literales de expresión regular —
 * las tres formas en que un `//` puede NO ser un comentario. El límite declarado: la heurística de regex-vs-división
 * mira el último carácter significativo, que es lo que usan todos los tokenizadores simples; puede equivocarse en
 * expresiones exóticas. Si se equivocara, el efecto es dejar de más o de menos TEXTO DE COMENTARIO — nunca puede
 * inventar una definición donde no la hay, porque las formas que se buscan abajo exigen palabras clave reales. */
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
      // literal de expresión regular: corre hasta la barra de cierre sin escapar, saltando clases [...]
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

/* ── LAS FORMAS DE VOLVER A NACER ─────────────────────────────────────────────────────────────────────────────────
 * Cada una es una manera real de DEFINIR o EXPORTAR el nombre en este repo. No se busca la mención: se busca que el
 * nombre vuelva a ser algo que otro archivo pueda usar. */
const _esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function definicionesDe(nombre, codigo) {
  const N = _esc(nombre);
  const FORMAS = [
    [new RegExp(`\\b(?:export\\s+)?(?:async\\s+)?function\\s*\\*?\\s+${N}\\b`), "function"],
    [new RegExp(`\\b(?:export\\s+)?(?:const|let|var)\\s+${N}\\s*=`), "const/let/var"],
    [new RegExp(`\\b(?:export\\s+)?class\\s+${N}\\b`), "class"],
    [new RegExp(`\\bexport\\s*\\{[^}]*\\b${N}\\b[^}]*\\}`), "export {…}"],
    [new RegExp(`\\bexport\\s+default\\s+(?:async\\s+)?function\\s+${N}\\b`), "export default function"],
    [new RegExp(`\\b${N}\\s*:\\s*(?:async\\s+)?function\\b`), "propiedad : function"],
  ];
  return FORMAS.filter(([re]) => re.test(codigo)).map(([, q]) => q);
}
function importaciones(nombre, codigo) {
  const N = _esc(nombre);
  return new RegExp(`\\bimport\\s*\\{[^}]*\\b${N}\\b[^}]*\\}\\s*from`).test(codigo);
}

// ── los archivos que se barren ────────────────────────────────────────────────────────────────────────────────────
/* ⚠️ LO QUE NO SE BARRE, Y POR QUÉ (2026-08-29). Esto excluía solo `node_modules`, así que entraba
 * `.claude/worktrees/` — que hoy tiene ONCE COPIAS COMPLETAS DEL REPO, dos de ellas de 326 MB y 428 MB. El
 * gate se quedaba sin memoria a los 92 segundos y moría sin diagnóstico, dejando la suite roja por algo que no
 * tenía nada que ver con el producto.
 *
 * Y el consumo de memoria era el síntoma menor: barrer los worktrees significa que un símbolo podado, revivido
 * en la copia de trabajo de OTRA sesión, ponía rojo este candado. Un falso positivo sobre código que ni
 * siquiera está en esta rama. Lo que este archivo tiene que vigilar es el repo, no sus copias.
 *
 * `dist` y `.git` se excluyen por lo mismo: uno es salida compilada —donde todo símbolo aparece «definido»— y
 * el otro no es código. */
const NO_SE_BARRE = new Set(["node_modules", ".claude", ".git", "dist", "coverage", ".vercel"]);
function archivosDe(dir, ext, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) { if (!NO_SE_BARRE.has(e)) archivosDe(p, ext, acc); }
    else if (ext.some((x) => e.endsWith(x))) acc.push(p);
  }
  return acc;
}
const FUENTES_SRC = archivosDe(join(ROOT, "src"), [".js", ".jsx", ".mjs"]);
const FUENTES_REPO = [
  ...FUENTES_SRC,
  ...archivosDe(join(ROOT, "api"), [".js", ".mjs"]),
  ...(existsSync(join(ROOT, "server.js")) ? [join(ROOT, "server.js")] : []),
  /* ⚠️ LOS BUNDLES TEMPORALES NO SON FUENTE, Y LEERLOS MATÓ ESTE CANDADO (2026-08-29). Varios gates de
   * pantalla compilan con esbuild a `_..._bundle.tmp<pid>.mjs` en la raíz y no siempre alcanzan a borrarlos.
   * Se habían acumulado **1242 archivos, 2,2 GB**: este gate los leía todos, los cacheaba, y se quedaba sin
   * memoria a los 92 segundos muriendo sin diagnóstico — la suite en rojo por basura de corridas viejas.
   *
   * Y son lo contrario de lo que hay que barrer: un bundle trae TODO el código inlineado, así que cualquier
   * símbolo podado aparecería «definido» ahí dentro. Leerlos no solo costaba memoria: podía dar un falso
   * positivo sobre código que ya no existe en ninguna fuente. */
  ...readdirSync(ROOT)
    .filter((f) => /^_.*\.(mjs|jsx)$/.test(f) && !/_bundle(\.tmp\d+)?\.mjs$/.test(f))
    .map((f) => join(ROOT, f)),
];
const _cache = new Map();
const codigoDe = (p) => {
  if (!_cache.has(p)) { try { _cache.set(p, sinComentarios(readFileSync(p, "utf8"))); } catch { _cache.set(p, ""); } }
  return _cache.get(p);
};

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
H("0 · EL DETECTOR SE PRUEBA A SÍ MISMO (si esta sección falla, todo lo de abajo es decorativo)");
{
  const POSITIVOS = [
    ["export function composeFromLedger(figs, scope) { return null; }", "export function"],
    ["function composeFromLedger(a) {}", "function suelta"],
    ["const composeFromLedger = (a) => a;", "const flecha"],
    ["let composeFromLedger = null;", "let"],
    ["export { composeFromLedger, otro };", "export {…}"],
    ["export { parseBlocks, composeFromLedger } from './x.js';", "re-export"],
    ["const API = { composeFromLedger: function (a) { return a; } };", "propiedad : function"],
  ];
  for (const [src, que] of POSITIVOS) {
    ok(definicionesDe("composeFromLedger", sinComentarios(src)).length > 0, `detecta la resurrección por ${que}`, src);
  }
  const NEGATIVOS = [
    ["// acá vivía composeFromLedger, el compositor viejo", "comentario de línea"],
    ["/* export function composeFromLedger(figs) {} */", "código viejo comentado en bloque"],
    ['const nota = "composeFromLedger ya no existe";', "nombrado dentro de un string"],
    ["const RE = /composeFromLedger/;   // literal de regex", "nombrado dentro de una regex"],
    ["const t = `la reparación (composeFromLedger) se fue`;", "nombrado en un template literal"],
  ];
  for (const [src, que] of NEGATIVOS) {
    ok(definicionesDe("composeFromLedger", sinComentarios(src)).length === 0, `NO se confunde: ${que}`, src);
  }
  ok(FUENTES_SRC.length > 50, `barre el src/ completo (${FUENTES_SRC.length} archivos) — si esto viniera en 0, el resto pasaría por vacío`);
  ok(FUENTES_REPO.length > FUENTES_SRC.length, `y el repo entero para los imports colgando (${FUENTES_REPO.length} archivos)`);
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
H("1 · NINGUNO DE LOS PODADOS VOLVIÓ A NACER EN src/");
for (const p of PODADOS) {
  const culpables = [];
  for (const f of FUENTES_SRC) {
    const formas = definicionesDe(p.nombre, codigoDe(f));
    if (formas.length) culpables.push(`${relative(ROOT, f)} [${formas.join(", ")}]`);
  }
  ok(culpables.length === 0, `${p.nombre} sigue borrado (vivía en ${p.vivia})`,
    culpables.length ? `RESUCITÓ en: ${culpables.join(" · ")}. Se podó porque ${p.porque}. Si hace falta de vuelta, es una decisión del owner y se saca de la lista de este gate.` : "");
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
H("2 · NI UN IMPORT COLGANDO EN TODO EL REPO (src/ · api/ · server.js · arneses de la raíz)");
for (const p of PODADOS) {
  const culpables = FUENTES_REPO.filter((f) => importaciones(p.nombre, codigoDe(f))).map((f) => relative(ROOT, f));
  ok(culpables.length === 0, `nadie importa ${p.nombre}`,
    culpables.length ? `lo importan: ${culpables.join(" · ")} — ese import revienta al enlazar el módulo, no al compilar` : "");
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
H("3 · LO QUE LOS REEMPLAZÓ SIGUE VIVO (una ausencia sola no prueba nada)");
for (const p of PODADOS) {
  if (!p.sucesor) continue;
  const codigo = codigoDe(join(ROOT, p.sucesor.archivo));
  const formas = definicionesDe(p.sucesor.nombre, codigo);
  ok(formas.length > 0, `${p.sucesor.nombre} sigue definido en ${p.sucesor.archivo} — es quien hace hoy el trabajo de ${p.nombre}`,
    formas.length ? "" : "el sucesor desapareció: se podaron las DOS piezas y el comportamiento se fue con ellas");
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
H("4 · LA TABLA REPAIR_FIELDS NO VOLVIÓ A CARGAR SUS `pregunta`");
{
  // Caso aparte porque lo podado no fue un símbolo sino un CAMPO de cada fila: ocho textos de pregunta de precisión
  // que nadie leía nunca (la red real es composePrecisionQuestion, conversationScope.js). `conserva` —lo que sí vive
  // de esta tabla— se verifica intacto en el mismo movimiento: sin eso, borrar la tabla entera pasaría en verde.
  const RUTA = "src/adi/oracle/conversationalContract.js";
  const codigo = codigoDe(join(ROOT, RUTA));
  const m = codigo.match(/export\s+const\s+REPAIR_FIELDS\s*=\s*\[([\s\S]*?)\n\]\s*;/);
  ok(!!m, `${RUTA} sigue declarando REPAIR_FIELDS`);
  if (m) {
    const cuerpo = m[1];
    ok(!/\bpregunta\s*:/.test(cuerpo), "ninguna fila de REPAIR_FIELDS trae `pregunta`",
      "volvió el texto de precisión por campo: son dos fuentes para la misma pregunta, y la que se imprime es la otra");
    ok((cuerpo.match(/\bconserva\s*:/g) || []).length === (cuerpo.match(/\bkey\s*:/g) || []).length,
      "y cada fila sigue trayendo su `conserva` — lo único de esta tabla que el motor lee de verdad");
  }
  const composePQ = FUENTES_SRC.some((f) => definicionesDe("composePrecisionQuestion", codigoDe(f)).length > 0);
  ok(composePQ, "composePrecisionQuestion sigue definido — es la red determinística REAL de la pregunta de precisión");
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
H("5 · LO QUE NO SE PODÓ Y NO ES UN DESCUIDO");
{
  // `bypassConfianza`/`puedeResponderSinPagar` figuran como «muerto» en el inventario de la Fase 1 y NO se borraron:
  // no son residuo, son DORMANCIA DELIBERADA gateada por ADI_BYPASS_SIN_PAGO, con una decisión del owner pendiente
  // (41% de las preguntas se responderían con cero llamadas). Este gate los deja anotados en verde para que el
  // próximo que lea el inventario no los confunda con algo que quedó a medias.
  const vivo = (nombre) => FUENTES_SRC.some((f) => definicionesDe(nombre, codigoDe(f)).length > 0);
  ok(vivo("puedeResponderSinPagar"), "puedeResponderSinPagar SIGUE en el repo a propósito (bypass sin pago, apagado por flag — decisión del owner pendiente)");
}

console.log(`\n${pass} PASS · ${fail} FAIL`);
process.exit(fail ? 1 : 0);
