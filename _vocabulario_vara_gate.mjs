/* === _vocabulario_vara_gate.mjs · BENCHMARK ≠ PROMEDIO ≠ META (owner 2026-08-09) =============================
 *
 * EL DEFECTO QUE CIERRA. `mechanisms.js` decía "por debajo del **promedio de la cartera** (30.1%)" sobre un número
 * que es `POLICY.benchmark` — la VARA declarada, no un promedio de nada. Con el dato de hoy el promedio ponderado
 * real de la cartera es 25,1% y el simple 27,8%: la frase le ponía a una referencia declarada el vestido de un
 * hecho empírico, y de paso afirmaba 5 puntos más de los que la población sostiene. El conteo mentía igual: 8 de
 * 13 cuentas están bajo el benchmark, sólo 5 bajo el promedio ponderado. Una frase corregida con el conteo viejo
 * sigue mintiendo, así que acá se verifican las dos cosas.
 *
 * SON TRES CONCEPTOS Y NO SE TOCAN:
 *   · BENCHMARK / VARA / PISO — una referencia DECLARADA. La resuelve `benchmarkOf` con tres capas INTERNAS del
 *     negocio (el criterio que el usuario fijó · el benchmark por fila del tenant · `POLICY.benchmark`). Ninguna
 *     es sectorial: llamarla "de la industria", "del sector" o "de la categoría" le inventa una autoridad.
 *   · PROMEDIO — un HECHO calculado sobre una población. Hay que decir sobre CUÁL, y el ponderado no es el simple.
 *   · META / TARGET — un OBJETIVO. Presentarlo como hecho es lo que la Regla de Proporcionalidad prohíbe.
 *
 * QUÉ CERTIFICA:
 *   [1] EL CÓDIGO · barrido estático de TODO literal de texto de `src/`. El caso feliz no dispara todas las ramas
 *       y ya hubo un texto que sólo se cazó leyendo el archivo, así que el código se barre además de ejecutarse.
 *   [2] LA EJECUCIÓN · se corren las superficies reales en los tres escenarios y se audita CADA string emitido
 *       contra las cifras verdaderas de la población: si dice "promedio" y muestra la vara, cae; y al revés.
 *   [3] EL CONTEO · toda frase "N de M … bajo la <referencia>" se recalcula contra la referencia que nombra.
 *   [4] EL CANDADO · los sitios ya corregidos, uno por uno: si vuelve el texto viejo, esto se pone rojo.
 *   [5] EL GLOSARIO · los tres conceptos son entradas distintas que se nombran entre sí · y margen bruto sigue
 *       siendo un concepto distinto del margen de contribución.
 *
 * Puro/offline: lee archivos y corre composers determinísticos. Cero red, cero LLM, cero crédito.
 *   node _vocabulario_vara_gate.mjs
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { POLICY, benchmarkOf } from "./src/config/businessPolicy.js";
import { applyScenarioToClientesMargen } from "./src/engine/scenarios.js";
import { CONCEPT_DEFS, resolveGlossary } from "./src/adi/sentrix/glossary.js";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)));
const SRC = join(ROOT, "src");

let PASS = 0, FAIL = 0; const ROTOS = [];
const ok = (cond, msg, extra = "") => {
  if (cond) { PASS++; }
  else { FAIL++; ROTOS.push(msg + (extra ? `\n      ${extra}` : "")); console.log("  ✗ " + msg + (extra ? "\n      " + extra : "")); }
};
const H = (t) => console.log("\n" + t);

// ── VOCABULARIO ──────────────────────────────────────────────────────────────────────────────────────────────
// Palabra de PROMEDIO: afirma un hecho sobre una población.
const AVG_WORD = /promedi[oa]s?|\bmedias?\b/gi;
// Palabra de VARA/OBJETIVO: nombra una referencia declarada.
const BAR_WORD = /benchmarks?|\bmetas?\b|\btargets?\b|\bvaras?\b|\bpiso\b|mejor(?:es)? pr[áa]cticas?|best practice|referencia declarada/gi;
// Una palabra deja de gobernar cuando aparece la del otro concepto O cuando se termina la oración: sin el corte de
// oración la ventana se comía la frase siguiente y acusaba de mentir a una cifra que ni siquiera era la suya.
// El punto decimal NO termina una oración: con `[.]` a secas la ventana se cerraba dentro de "30.1%" y el defecto
// original —que es precisamente una cifra con decimal— pasaba de largo.
const CIERRA_AVG = /benchmarks?|\bmetas?\b|\btargets?\b|\bvaras?\b|\bpiso\b|mejor(?:es)? pr[áa]cticas?|best practice|referencia declarada|\.(?!\d)|[·;]/gi;

// Identificadores que, dentro de un `${…}`, son SIN AMBIGÜEDAD una vara declarada. Deliberadamente NO incluye
// `targetCarga`/`target_carga` sueltos: `signalRules.suggestedAction` devuelve un `target_carga` que es el
// PROMEDIO interno de la carga (el nombre miente, el texto que lo usa no) — esa clase la caza [2] por VALOR.
const BAR_EXPR = /POLICY\s*\.\s*(?:benchmark|targetCarga|bestPracticeCarga|rotacionMin)|benchmarkOf\s*\(|\bbenchmarks?\b|\bbench\b|\bbenchmarkValue\b|\bbenchmark_pct\b/;
// Identificadores que son sin ambigüedad un promedio calculado.
const AVG_EXPR = /\bavg[A-Z_]?\w*\b|\bpromedio\w*\b|\bprom\b|\bmargenProm\w*\b|\b\w+Prom\b|\bmedia\b/;

// "de la industria / del sector / del mercado / de la categoría": autoridad externa que el dato no tiene.
const AUTORIDAD_EXTERNA = /(?:benchmark|promedio|media|referencia|est[áa]ndar|standard)\s+(?:de\s+la\s+|del\s+|de\s+)?(?:industria|sector|mercado|categor[íi]a|rubro)\b/i;
// …salvo cuando el texto está PROHIBIENDO justamente eso (la instrucción del narrador tiene que poder nombrar lo
// que veda, y el glosario tiene que poder decir que la vara NO es sectorial).
const PROHIBIENDO = /\b(?:NUNCA|JAM[ÁA]S|PROHIBIDO|PROHIBIDA|no\s+es|no\s+viene|no\s+hay|ni\s+)\b/i;

// EL VEREDICTO HUÉRFANO: un juicio de rendimiento contra "el promedio" sin decir de qué población. Exige un VERBO
// de rendimiento a propósito — una etiqueta de columna ("vs promedio", "Rotación vs promedio") no afirma nada y el
// glosario ya la define; lo que no se puede comprobar ni desmentir es "rinde por debajo del promedio".
const PROMEDIO_HUERFANO = /\b(?:rinde\w*|opera\w*|est[áa]\w*|queda\w*|corre\w*|va\w*|se\s+ubica\w*|aparece\w*)\s+(?:\w+\s+){0,3}?(?:bajo|debajo\s+del?|sobre|encima\s+del?)\s+(?:el\s+|la\s+)?promedio\b(?!\s*(?:interno|ponderado|simple|operativo|de\s|del\s|\(|\$\{))/i;

const PCT_RE = /(\d{1,3}(?:[.,]\d{1,2})?)\s*%/g;
// la palabra de vara INTRODUCIENDO su cifra: "benchmark de 30,1%" · "meta: 3,5%" · "tu vara (30,1%)"
const BAR_INTRODUCE = /\b(benchmarks?|metas?|targets?|varas?|piso)\b[^.\d]{0,22}?(\d{1,3}(?:[.,]\d{1,2})?)\s*%/gi;
const cerca = (a, b, tol = 0.055) => typeof a === "number" && typeof b === "number" && Math.abs(a - b) <= tol;

// ── EXTRACTOR DE LITERALES ───────────────────────────────────────────────────────────────────────────────────
// Mini-scanner de estados: hace falta porque un regex suelto confunde `//` dentro de un string con un comentario
// y al revés (el barrido ingenuo se comía la mitad de los textos o auditaba comentarios como si fueran producto).
function literalesDe(src) {
  const out = [];
  let i = 0, line = 1;
  const n = src.length;
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (c === "\n") { line++; i++; continue; }
    if (c === "/" && d === "/") { while (i < n && src[i] !== "\n") i++; continue; }
    if (c === "/" && d === "*") { i += 2; while (i < n && !(src[i] === "*" && src[i + 1] === "/")) { if (src[i] === "\n") line++; i++; } i += 2; continue; }
    if (c === '"' || c === "'" || c === "`") {
      const quote = c, startLine = line, start = i; i++;
      let depth = 0;
      while (i < n) {
        const ch = src[i];
        if (ch === "\\") { i += 2; continue; }
        if (ch === "\n") { line++; if (quote !== "`") break; i++; continue; }
        if (quote === "`" && ch === "$" && src[i + 1] === "{") { depth++; i += 2; continue; }
        if (quote === "`" && depth > 0 && ch === "}") { depth--; i++; continue; }
        if (ch === quote && depth === 0) { i++; break; }
        i++;
      }
      out.push({ raw: src.slice(start + 1, i - 1), line: startLine });
      continue;
    }
    i++;
  }
  return out;
}

function archivosJS(dir, acc = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) { archivosJS(p, acc); continue; }
    if (/\.(js|jsx)$/.test(e)) acc.push(p);
  }
  return acc;
}

// ── LA VENTANA QUE GOBIERNA ──────────────────────────────────────────────────────────────────────────────────
// Una palabra sólo gobierna hasta que aparece la palabra del otro concepto. Así "…más que tu promedio (2,61%);
// llevarlas a tu meta de 3,5%" pasa (cada referencia con su propia cifra) y "…del promedio de la cartera (30,1%)"
// cae (la palabra de promedio gobierna una cifra que es la vara).
function ventanas(texto, palabraRe, cierreRe, largo = 70) {
  const res = [];
  palabraRe.lastIndex = 0;
  let m;
  while ((m = palabraRe.exec(texto))) {
    const desde = m.index + m[0].length;
    cierreRe.lastIndex = desde;
    const cierre = cierreRe.exec(texto);
    const hasta = Math.min(texto.length, cierre ? cierre.index : desde + largo, desde + largo);
    res.push({ palabra: m[0], desde, texto: texto.slice(desde, hasta) });
  }
  return res;
}

// ENMASCARAR LAS INTERPOLACIONES ANTES DE MIRAR LA PROSA. Sin esto el identificador de adentro cuenta como palabra
// del texto: en `…del promedio de la cartera (${POLICY.benchmark}%)` el cierre de ventana veía "benchmark" DENTRO
// del `${}` y cortaba justo antes de la cifra — el defecto original se escapaba por su propio nombre.
const TOKEN = (i) => `${i}`;
function enmascarar(raw) {
  const exprs = [];
  const masked = raw.replace(/\$\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g, (_, e) => TOKEN(exprs.push(e) - 1));
  return { masked, exprs };
}

// Interpolaciones que ocupan una RANURA DE CIFRA (van pegadas a %, pp, x, d o a un $). Se descartan las que emiten
// PALABRAS (un ternario con comillas adentro): ésas no son la cifra, son el verbo de la oración.
function interpolacionesCifra(fragmento, exprs) {
  const out = [];
  const re = /(\d+)/g;
  let m;
  while ((m = re.exec(fragmento))) {
    const expr = exprs[+m[1]];
    if (expr == null) continue;
    if (/\?/.test(expr) && /["'`]/.test(expr)) continue;              // ternario que emite texto, no cifra
    const post = fragmento.slice(m.index + m[0].length, m.index + m[0].length + 4);
    const pre = fragmento.slice(Math.max(0, m.index - 1), m.index);
    if (!/^\s*(%|pp|x\b|d\b|días|\))/.test(post) && pre !== "$") continue;
    out.push(expr);
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// [1] EL CÓDIGO · barrido estático de los literales de texto de src/
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
H("[1] EL CÓDIGO · ningún literal de texto confunde la vara con el promedio");
{
  const archivos = archivosJS(SRC);
  let literales = 0, auditados = 0;
  const hallazgos = [];
  for (const f of archivos) {
    const rel = relative(ROOT, f).split(sep).join("/");
    const src = readFileSync(f, "utf8");
    for (const { raw, line } of literalesDe(src)) {
      literales++;
      if (raw.length < 12) continue;
      if (!/[áéíóúñ¿¡ ]/.test(raw)) continue;                          // identificadores/rutas/regex, no prosa
      auditados++;
      const donde = `${rel}:${line}`;
      const { masked, exprs } = enmascarar(raw);

      // R1 · la palabra "promedio" gobernando una cifra que es la VARA declarada. Es el defecto original.
      for (const v of ventanas(masked, AVG_WORD, CIERRA_AVG)) {
        for (const expr of interpolacionesCifra(v.texto, exprs)) {
          if (BAR_EXPR.test(expr) && !AVG_EXPR.test(expr))
            hallazgos.push(`${donde} · dice "${v.palabra}" sobre una cifra que es la VARA (\${${expr.trim()}})\n        «…${v.palabra}${raw.slice(0, 70)}…»`);
        }
        // R1b · la vara escrita a mano dentro de una frase de promedio (el literal 30.1 y sus hermanos).
        PCT_RE.lastIndex = 0;
        let p;
        while ((p = PCT_RE.exec(v.texto))) {
          const val = parseFloat(p[1].replace(",", "."));
          if ([POLICY.benchmark, POLICY.targetCarga, POLICY.bestPracticeCarga].some((b) => cerca(val, b)))
            hallazgos.push(`${donde} · dice "${v.palabra}" sobre ${val}%, que es un umbral declarado de POLICY\n        «…${v.palabra}${v.texto.slice(0, 70)}…»`);
        }
      }

      // R2 · la palabra de vara gobernando una cifra que es un PROMEDIO calculado. El defecto espejo.
      for (const v of ventanas(masked, BAR_WORD, AVG_WORD)) {
        for (const expr of interpolacionesCifra(v.texto, exprs)) {
          if (AVG_EXPR.test(expr) && !BAR_EXPR.test(expr))
            hallazgos.push(`${donde} · dice "${v.palabra}" sobre una cifra que es un PROMEDIO (\${${expr.trim()}})\n        «…${v.palabra}${raw.slice(0, 70)}…»`);
        }
      }

      // R3 · autoridad que el dato no tiene: la vara es interna, nunca del sector/industria/mercado/categoría.
      if (AUTORIDAD_EXTERNA.test(raw) && !PROHIBIENDO.test(raw.slice(Math.max(0, raw.search(AUTORIDAD_EXTERNA) - 45), raw.search(AUTORIDAD_EXTERNA))))
        hallazgos.push(`${donde} · le atribuye una fuente EXTERNA a una referencia interna\n        «…${raw.slice(Math.max(0, raw.search(AUTORIDAD_EXTERNA) - 30), raw.search(AUTORIDAD_EXTERNA) + 60)}…»`);

      // R4 · "bajo el promedio" a secas: no dice de qué población, así que no se puede comprobar ni desmentir.
      if (PROMEDIO_HUERFANO.test(raw))
        hallazgos.push(`${donde} · veredicto contra "el promedio" sin decir de qué población\n        «…${raw.slice(Math.max(0, raw.search(PROMEDIO_HUERFANO) - 40), raw.search(PROMEDIO_HUERFANO) + 60)}…»`);
    }
  }
  ok(hallazgos.length === 0, `barrido estático · ${hallazgos.length} literal(es) confunden vara y promedio`, hallazgos.join("\n      "));
  console.log(`  · ${archivos.length} archivos · ${literales} literales · ${auditados} con prosa auditada`);
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// [2] LA EJECUCIÓN · las superficies reales, en los tres escenarios, contra las cifras verdaderas
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
const ESCENARIOS = ["bonanza", "tension", "crisis"];

function poblacion(scenario) {
  const rows = applyScenarioToClientesMargen(scenario) || [];
  const n = rows.length || 1;
  const tV = rows.reduce((s, r) => s + (r.venta || 0), 0);
  const tC = rows.reduce((s, r) => s + (r.contribucion || 0), 0);
  const ponderado = tV ? +((tC / tV) * 100).toFixed(2) : null;
  const simple = +(rows.reduce((s, r) => s + (r.margen || 0), 0) / n).toFixed(2);
  const cargaPond = tV ? +((rows.reduce((s, r) => s + ((r.pctRebate || 0) / 100) * (r.venta || 0), 0) / tV) * 100).toFixed(2) : null;
  const cargaSimple = +(rows.reduce((s, r) => s + (r.pctRebate || 0), 0) / n).toFixed(2);
  return {
    rows, n: rows.length, ponderado, simple, cargaPond, cargaSimple,
    varas: [...new Set([POLICY.benchmark, POLICY.targetCarga, POLICY.bestPracticeCarga, ...rows.map((r) => benchmarkOf(r))])],
    promedios: [ponderado, simple, cargaPond, cargaSimple].filter((x) => typeof x === "number"),
    bajoVara: rows.filter((r) => r.margen < benchmarkOf(r)).length,
    bajoPonderado: rows.filter((r) => r.margen < ponderado).length,
    bajoSimple: rows.filter((r) => r.margen < simple).length,
  };
}

// Recorre lo que devuelve una superficie y junta TODO string de prosa (con su ruta, para poder señalar el sitio).
function textos(valor, ruta = "", acc = [], visto = new Set()) {
  if (typeof valor === "string") {
    if (valor.length >= 20 && /\s/.test(valor) && /[áéíóúñ]|[a-z]{4,}\s+[a-z]{3,}/i.test(valor)) acc.push({ ruta, txt: valor });
    return acc;
  }
  if (!valor || typeof valor !== "object") return acc;
  if (visto.has(valor)) return acc;
  visto.add(valor);
  if (Array.isArray(valor)) { valor.forEach((v, i) => textos(v, `${ruta}[${i}]`, acc, visto)); return acc; }
  for (const [k, v] of Object.entries(valor)) {
    if (typeof v === "function") continue;
    textos(v, ruta ? `${ruta}.${k}` : k, acc, visto);
  }
  return acc;
}

function auditarTexto(txt, pob) {
  const fallas = [];
  // N1 · dice "promedio" y la cifra que gobierna es una VARA declarada (y no coincide con ningún promedio real).
  for (const v of ventanas(txt, AVG_WORD, CIERRA_AVG)) {
    PCT_RE.lastIndex = 0;
    let p;
    while ((p = PCT_RE.exec(v.texto))) {
      const val = parseFloat(p[1].replace(",", "."));
      if (pob.varas.some((b) => cerca(val, b)) && !pob.promedios.some((a) => cerca(val, a)))
        fallas.push(`dice "${v.palabra}" y muestra ${val}%, que es una VARA declarada (los promedios reales son ${pob.promedios.join("% · ")}%)`);
    }
  }
  // N2 · dice "benchmark/meta/vara" y la cifra que PRESENTA COMO TAL es un PROMEDIO calculado. Acá la cifra tiene
  // que venir introducida por la palabra de vara ("benchmark de X%", "meta: X%", "vara (X%)") — si sólo aparece
  // más adelante en la oración es otra cifra de la frase, no la vara, y confundirlas sería inventar un defecto.
  BAR_INTRODUCE.lastIndex = 0;
  let bi;
  while ((bi = BAR_INTRODUCE.exec(txt))) {
    const val = parseFloat(bi[2].replace(",", "."));
    if (pob.promedios.some((a) => cerca(val, a)) && !pob.varas.some((b) => cerca(val, b)))
      fallas.push(`presenta ${val}% como "${bi[1]}", pero ${val}% es un PROMEDIO de la población, no la vara`);
  }
  // N3 · autoridad externa y promedio huérfano, ahora sobre el texto EMITIDO (no sólo sobre el archivo).
  if (AUTORIDAD_EXTERNA.test(txt) && !PROHIBIENDO.test(txt.slice(Math.max(0, txt.search(AUTORIDAD_EXTERNA) - 45), txt.search(AUTORIDAD_EXTERNA))))
    fallas.push(`le atribuye fuente externa a una referencia interna`);
  if (PROMEDIO_HUERFANO.test(txt)) fallas.push(`compara contra "el promedio" sin decir de qué población`);
  return fallas;
}

// N4 · el CONTEO: "N de M … bajo la <referencia>" se recalcula contra la referencia que la frase nombra.
const CONTEO_RE = /(\d{1,3})\s+de\s+(\d{1,3})\s+([^.·;]{0,60}?)\b(bajo|debajo\s+de|sobre|encima\s+de)\s+(?:la\s+|el\s+|tu\s+|su\s+)?(vara|piso|benchmark|promedio\s+(?:ponderado|simple)|promedio|meta)\b/gi;
function auditarConteo(txt, pob) {
  const fallas = [];
  CONTEO_RE.lastIndex = 0;
  let m;
  while ((m = CONTEO_RE.exec(txt))) {
    const [, nS, mS, sujeto, sentido, refRaw] = m;
    const N = +nS, M = +mS;
    const ref = refRaw.toLowerCase();
    if (M !== pob.n) continue;                                   // otra población (SKU, bodegas…): no es este chequeo
    if (!/client|cuenta/i.test(sujeto)) continue;
    // "el promedio" a secas NO se recalcula: el ponderado da 5 y el simple 6, así que no hay contra qué medirlo.
    // Esa ambigüedad ya la denuncia el veredicto huérfano; acá sólo se juzga lo que se puede juzgar.
    let base;
    if (/ponderado/.test(ref)) base = pob.bajoPonderado;
    else if (/simple/.test(ref)) base = pob.bajoSimple;
    else if (/promedio/.test(ref)) continue;
    else base = pob.bajoVara;
    const debajo = /bajo|debajo/i.test(sentido);
    const esperado = debajo ? base : pob.n - base;
    if (N !== esperado)
      fallas.push(`"${m[0].trim()}" → contra ${/promedio/.test(ref) ? `el ${ref}` : "la vara"} el conteo real es ${esperado}, no ${N}`);
  }
  return fallas;
}

H("[2] LA EJECUCIÓN · las superficies reales en los tres escenarios");
{
  const superficies = [];
  const reg = (nombre, fn) => superficies.push({ nombre, fn });

  const M = await import("./src/adi/composers/mechanisms.js");
  const CD = await import("./src/adi/composers/clientDive.js");
  const SR = await import("./src/adi/specRetrieval.js");
  const RC = await import("./src/adi/sentrix/resumenComercial.js");
  const MESA = await import("./src/adi/sentrix/mesa.js");
  const MCAP = await import("./src/adi/sentrix/mesaCapital.js");
  const CUA = await import("./src/adi/sentrix/cuadro.js");
  const KPI = await import("./src/adi/sentrix/kpis.js");
  const CTRL = await import("./src/adi/sentrix/control.js");
  const RD = await import("./src/adi/sentrix/reading.js");

  const MECANISMOS = ["commercial_erosion", "quality_of_growth_deterioration", "customer_dependency_risk", "trapped_capital", "liquidity_compression"];
  for (const id of MECANISMOS) reg(`mecanismo · ${id}`, (sc) => M.composeMechanismResponse(id, sc));
  reg("mecanismos · panorama", (sc) => M.composeMechanismScan(sc));

  reg("resumen ejecutivo", (sc) => SR.composeSpecResumenEjecutivo({ scenario: sc }));
  reg("diagnose", (sc) => SR.composeSpecDiagnose({ scenario: sc }));
  for (const dim of ["cliente", "marca", "sku"]) {
    reg(`margen · ${dim}`, (sc) => SR.composeSpecMargin({ scenario: sc, dimension: dim }));
    reg(`ventas · ${dim}`, (sc) => SR.composeSpecVentas({ scenario: sc, dimension: dim }));
    reg(`contribución · ${dim}`, (sc) => SR.composeSpecContribucion({ scenario: sc, dimension: dim }));
  }
  reg("inventario", (sc) => SR.composeSpecInventory({ scenario: sc }));
  reg("simular carga", (sc) => SR.composeSpecSimulateCarga({ scenario: sc }));
  reg("simular capital", (sc) => SR.composeSpecSimulateCapital({ scenario: sc }));
  reg("simular costo", (sc) => SR.composeSpecSimulateCosto({ scenario: sc, pct: -5 }));

  reg("resumen comercial", (sc) => RC.buildResumenComercial(sc));
  reg("mesa", (sc) => MESA.buildMesaEstado(sc));
  reg("mesa capital", (sc) => MCAP.buildMesaCapital(sc));
  for (const dim of ["cliente", "marca", "sku"]) reg(`cuadro · ${dim}`, (sc) => CUA.buildCuadroMando(dim, sc));
  for (const eje of ["sku", "bodega"]) reg(`cuadro capital · ${eje}`, (sc) => MCAP.buildCuadroCapital(eje, sc));
  reg("capital · señales", (sc) => RD.buildReadingFromSignals(RD.buildCapitalSignals(sc)));

  // por entidad: la Ficha, el recibo frío, el anillo de control y el dive — donde vive la mitad de la prosa
  const nombres = (applyScenarioToClientesMargen("bonanza") || []).map((r) => r.nombre);
  for (const nombre of nombres) {
    reg(`ficha · ${nombre}`, (sc) => CD.getClientDeepDive(nombre, sc));
    reg(`recibo · ${nombre}`, (sc) => KPI.buildMarginReceipt(nombre, sc));
    reg(`descomposición · ${nombre}`, (sc) => KPI.buildMarginDecomposition(nombre, sc));
    reg(`control · ${nombre}`, (sc) => CTRL.buildControlRing("client", nombre, sc));
    reg(`dive · ${nombre}`, (sc) => SR.composeSpecDive({ dimension: "cliente", entity: nombre, scenario: sc }));
    reg(`composición · ${nombre}`, (sc) => SR.composeSpecComposicion({ dimension: "cliente", entity: nombre, scenario: sc }));
    reg(`contribución señal · ${nombre}`, (sc) => RD.buildReadingFromSignals(RD.buildClientContribSignals(nombre, sc)));
  }
  if (nombres.length >= 2) reg(`comparado · ${nombres[0]} vs ${nombres[1]}`, (sc) => SR.composeSpecCompare({ dimension: "cliente", entities: [nombres[0], nombres[1]], scenario: sc }));

  let corridas = 0, strings = 0, rotas = 0;
  const fallas = [];
  for (const sc of ESCENARIOS) {
    const pob = poblacion(sc);
    for (const s of superficies) {
      let r;
      try { r = s.fn(sc); } catch (e) { rotas++; fallas.push(`${sc} · ${s.nombre} · LA SUPERFICIE REVENTÓ: ${e && e.message}`); continue; }
      corridas++;
      for (const { ruta, txt } of textos(r)) {
        strings++;
        for (const f of auditarTexto(txt, pob)) fallas.push(`${sc} · ${s.nombre} · ${ruta}\n        ${f}\n        «${txt.slice(0, 180)}»`);
        for (const f of auditarConteo(txt, pob)) fallas.push(`${sc} · ${s.nombre} · ${ruta}\n        ${f}\n        «${txt.slice(0, 180)}»`);
      }
    }
  }
  ok(fallas.length === 0, `texto emitido · ${fallas.length} afirmación(es) confunden vara, promedio o meta`, fallas.join("\n      "));
  ok(rotas === 0, `las ${superficies.length} superficies corren en los 3 escenarios sin reventar`, `${rotas} reventaron`);
  console.log(`  · ${corridas} corridas · ${strings} strings auditados`);

  // la población que el gate usa para juzgar tiene que ser la real, si no el juicio no vale
  const pb = poblacion("bonanza");
  ok(pb.n === 13, `la cartera del escenario base tiene 13 cuentas`, `tiene ${pb.n}`);
  ok(cerca(pb.ponderado, 25.1, 0.1), `el promedio ponderado real es 25,1%`, `es ${pb.ponderado}%`);
  ok(cerca(pb.simple, 27.8, 0.1), `el promedio simple real es 27,8%`, `es ${pb.simple}%`);
  ok(POLICY.benchmark === 30.1, `la vara declarada es 30,1%`, `es ${POLICY.benchmark}%`);
  ok(pb.ponderado !== POLICY.benchmark && pb.simple !== POLICY.benchmark, `la vara NO coincide con ningún promedio: por eso confundirlas cambia la afirmación`);
  ok(pb.bajoVara === 8 && pb.bajoPonderado === 5, `8 bajo la vara · 5 bajo el promedio ponderado — el conteo depende de cuál se nombre`, `vara ${pb.bajoVara} · promedio ${pb.bajoPonderado}`);
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// [3] EL CANDADO · los sitios corregidos, uno por uno
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
H("[3] EL CANDADO · los sitios ya corregidos no vuelven atrás");
{
  // SÓLO LOS LITERALES, NO LOS COMENTARIOS: cada corrección deja escrito arriba el texto viejo para que se entienda
  // qué se arregló, y un candado que leyera el archivo crudo se acusaría a sí mismo de haber revertido el arreglo.
  const leer = (p) => literalesDe(readFileSync(join(ROOT, p), "utf8")).map((l) => l.raw).join("\n");
  const leerCrudo = (p) => readFileSync(join(ROOT, p), "utf8");
  const CANDADOS = [
    ["src/adi/composers/mechanisms.js", "erosión comercial · la lectura nombra el benchmark",
      /rinden por debajo del benchmark de cartera/, /rinden por debajo del promedio de la cartera/],
    ["src/adi/composers/mechanisms.js", "calidad del crecimiento · la lectura nombra el benchmark",
      /todos por debajo del benchmark de cartera/, /todos por debajo del promedio de la cartera/],
    ["src/adi/composers/mechanisms.js", "riesgo de dependencia · el veredicto de margen se DERIVA, no se afirma",
      /rinden por debajo de tu benchmark/, /pesan mucho, rinden por debajo del promedio/],
    ["src/adi/composers/clientDive.js", "brecha estructural · sin promedio de categoría inventado",
      /no alcanza la referencia que definiste para tu cartera/, /margen promedio de la categor[íi]a/],
    ["src/adi/composers/clientDive.js", "Tier 1 en o sobre la vara · nombra la vara, no una población",
      /margen sobre tu benchmark de cartera/, /promedio de las cuentas grandes/],
    ["src/adi/sentrix/kpis.js", "recibo frío · la vara declarada no se rotula «industria»",
      /^Tu benchmark$/m, /Benchmark industria/],
    ["src/adi/sentrix/glossary.js", "el «i» de «vs benchmark» no manda a la industria",
      /Distancia del margen contra TU benchmark/, /benchmark de la industria/],
    ["src/adi/composers/overview.js", "la banda de carga de la cartera se calcula, no se clava",
      /promedio ponderado de la cartera es \$\{_cargaPonderada\}%/, /la cartera promedio opera entre 3% y 5%/],
    ["src/config/cognitiveData.js", "el pool del rol declarado no compara contra un promedio que nadie midió",
      /sostiene su margen sin exigir carga comercial alta/, /rinde sobre promedio/],
  ];
  for (const [archivo, nombre, esperado, prohibido] of CANDADOS) {
    const src = leer(archivo);
    ok(esperado.test(src), `${nombre} · el texto corregido sigue ahí (${archivo})`);
    ok(!prohibido.test(src), `${nombre} · el texto viejo NO volvió (${archivo})`, `reapareció ${prohibido}`);
  }
  // VOZ2 es la voz VIVA: si alguien la apaga, el candado de arriba deja de proteger lo que el usuario lee.
  const flags = leerCrudo("src/config/voiceFlags.js");
  ok(/VOZ2_ENABLED\s*=\s*true/.test(flags), `VOZ2 sigue encendida — es la rama que el usuario lee, y es la que introdujo el defecto`);
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// [4] EL GLOSARIO · tres conceptos, tres entradas, cada una nombrando a las otras
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
H("[4] EL GLOSARIO · benchmark ≠ promedio ≠ meta, y margen bruto ≠ margen de contribución");
{
  const TRES = ["benchmark", "promedio_cartera", "meta"];
  for (const slug of TRES) ok(!!CONCEPT_DEFS[slug], `existe la entrada «${slug}»`);
  const defs = TRES.map((s) => CONCEPT_DEFS[s]).filter(Boolean);
  ok(new Set(defs.map((d) => d.def)).size === defs.length, `las tres definiciones son DISTINTAS entre sí`);

  ok(/no\s+es|nunca|no viene/i.test(CONCEPT_DEFS.benchmark.distingue || ""), `el benchmark se distingue por negación explícita`);
  ok(/sectorial|externa|industria|mercado/i.test((CONCEPT_DEFS.benchmark.def || "") + (CONCEPT_DEFS.benchmark.distingue || "")),
    `el benchmark declara que NO viene de una fuente sectorial`);
  ok(/benchmark/i.test(CONCEPT_DEFS.promedio_cartera.distingue || ""), `el promedio de cartera se distingue nombrando al benchmark`);
  ok(/ponderado/i.test(CONCEPT_DEFS.promedio_cartera.distingue || ""), `y distingue el ponderado del simple`);
  ok(/benchmark/i.test(CONCEPT_DEFS.meta.distingue || ""), `la meta se distingue nombrando al benchmark`);
  ok(/objetivo/i.test(CONCEPT_DEFS.meta.def || ""), `la meta se define como OBJETIVO declarado, no como hecho`);
  ok(/benchmark/i.test(CONCEPT_DEFS.vara.distingue || ""), `la vara se distingue del benchmark por defecto`);

  for (const etiqueta of ["benchmark", "promedio de la cartera", "promedio ponderado", "meta", "vara"]) {
    const r = resolveGlossary(etiqueta);
    ok(r && typeof r.def === "string" && r.def.length > 40, `«${etiqueta}» resuelve con definición`, r ? `dio ${r.slug}` : "null");
  }
  ok(resolveGlossary("benchmark").slug !== resolveGlossary("promedio de la cartera").slug, `«benchmark» y «promedio de la cartera» NO resuelven al mismo concepto`);
  ok(resolveGlossary("meta").slug !== resolveGlossary("benchmark").slug, `«meta» y «benchmark» NO resuelven al mismo concepto`);
  ok(resolveGlossary("meta").slug !== resolveGlossary("promedio de la cartera").slug, `«meta» y «promedio de la cartera» NO resuelven al mismo concepto`);

  const bruto = resolveGlossary("margen bruto"), contrib = resolveGlossary("margen de contribución");
  ok(bruto && contrib && bruto.slug !== contrib.slug, `«margen bruto» y «margen de contribución» siguen siendo entradas distintas`);
  ok(bruto && contrib && bruto.def !== contrib.def, `y con definiciones distintas`);
  ok(bruto && /margen de contribuci/i.test(bruto.distingue || ""), `el bruto se distingue nombrando al de contribución`);
  ok(contrib && /margen bruto/i.test(contrib.distingue || ""), `el de contribución se distingue nombrando al bruto`);

  // ninguna definición del glosario puede caer ella misma en la confusión que el glosario existe para deshacer
  const sucias = Object.entries(CONCEPT_DEFS)
    .filter(([, c]) => AUTORIDAD_EXTERNA.test((c.def || "") + " " + (c.distingue || "")))
    .map(([s]) => s);
  ok(sucias.length === 0, `ninguna definición le atribuye fuente externa a la vara`, sucias.join(", "));
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// [5] PARTIDA DOBLE · un gate verde que no sabe ponerse rojo no prueba nada
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
H("[5] PARTIDA DOBLE · la frase honesta pasa y la defectuosa bloquea");
{
  const pob = poblacion("bonanza");
  const audita = (t) => [...auditarTexto(t, pob), ...auditarConteo(t, pob)];

  // DEFECTUOSAS · cada una es un defecto real que ya estuvo en producción o su espejo exacto.
  const CAEN = [
    ["el defecto original · la vara vestida de promedio",
      "Las 3 cuentas aportan $10.03M al año, pero todas rinden por debajo del promedio de la cartera (30.1%)."],
    ["el espejo · el promedio vestido de vara",
      "La cuenta opera 3 puntos bajo tu benchmark de 25.1%, y esa distancia erosiona la contribución."],
    ["la meta presentada como hecho de la población",
      "La carga comercial se ubica sobre la meta de 25.1% que muestra la cartera."],
    ["autoridad inventada · la vara no es del sector",
      "La brecha es estructural: la cuenta no captura el margen promedio de la categoría."],
    ["autoridad inventada · el rótulo del recibo",
      "La comparación se hace contra el benchmark de la industria, que es la referencia del recibo."],
    ["veredicto huérfano · qué promedio, de qué población",
      "Las tres comparten el mismo perfil: pesan mucho, rinden por debajo del promedio y sostienen carga alta."],
    ["el conteo de la vara puesto sobre el promedio",
      `${pob.bajoVara} de ${pob.n} clientes están bajo el promedio ponderado.`],
    ["el conteo del promedio puesto sobre la vara",
      `${pob.bajoPonderado} de ${pob.n} clientes están bajo la vara.`],
    ["el conteo del ponderado presentado como el del simple",
      `${pob.bajoPonderado} de ${pob.n} clientes están bajo el promedio simple.`],
  ];
  for (const [nombre, txt] of CAEN) ok(audita(txt).length > 0, `bloquea · ${nombre}`, `NO la cazó: «${txt}»`);

  // HONESTAS · dicen la verdad nombrando cada referencia con su cifra. Si el gate las tumba, el gate estorba.
  const PASAN = [
    ["la vara nombrada como vara",
      "Las 3 cuentas rinden por debajo del benchmark de cartera (30.1%), y la diferencia se concentra en la carga."],
    ["el promedio nombrado con su población",
      `El promedio ponderado de tu cartera es ${pob.ponderado}%, y ubica a cada cuenta contra el resto del negocio.`],
    ["las dos referencias juntas, cada una con su cifra",
      `4 de ${pob.n} cuentas entregan más que tu promedio (${pob.cargaPond}%). Llevarlas a tu meta de ${POLICY.targetCarga}% recupera más.`],
    ["el conteo correcto contra la vara",
      `${pob.bajoVara} de ${pob.n} clientes están bajo la vara.`],
    ["el conteo correcto contra el promedio ponderado",
      `${pob.bajoPonderado} de ${pob.n} clientes están bajo el promedio ponderado.`],
    ["el conteo correcto contra el promedio simple",
      `${pob.bajoSimple} de ${pob.n} clientes están bajo el promedio simple.`],
    ["la prohibición puede nombrar lo que prohíbe",
      "NUNCA digas \"estándar del sector\" ni \"promedio del mercado\": no hay fuente sectorial en el dato."],
    ["una etiqueta de columna no es un veredicto",
      "Cuánto MENOS capital inmovilizado concentra esta bodega frente al promedio (positivo = mejor)."],
  ];
  for (const [nombre, txt] of PASAN) {
    const f = audita(txt);
    ok(f.length === 0, `deja pasar · ${nombre}`, `la tumbó por: ${f.join(" · ")}\n      «${txt}»`);
  }

  // el barrido ESTÁTICO también tiene que saber ponerse rojo (es el que cazó lo que la ejecución no toca)
  const sintetico = 'const t = `todas rinden por debajo del promedio de la cartera (${POLICY.benchmark}%) y ceden margen`;';
  const lits = literalesDe(sintetico);
  let cazadoEstatico = false;
  for (const { raw } of lits) {
    const { masked, exprs } = enmascarar(raw);
    for (const v of ventanas(masked, AVG_WORD, CIERRA_AVG))
      for (const expr of interpolacionesCifra(v.texto, exprs)) if (BAR_EXPR.test(expr) && !AVG_EXPR.test(expr)) cazadoEstatico = true;
  }
  ok(cazadoEstatico, `el barrido estático caza la vara interpolada dentro de una frase de promedio`);
}

console.log(`\n════ VOCABULARIO DE LA VARA · ${PASS} PASS · ${FAIL} FAIL ════`);
if (ROTOS.length) { console.log("\nROTOS:"); for (const r of ROTOS) console.log("  ✗ " + r); }
process.exit(FAIL ? 1 : 0);
