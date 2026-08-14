/* === _registro_boleta_gate.mjs · EL REGISTRO EN LA BOLETA Y EN EL TEXTO VERBATIM DEL CAMINO VIGENTE ==========
 * La Poda Fase 2 · CIERRA EL HUECO POR EL QUE SE COLÓ EL DEFECTO MEDIDO EN PRODUCCIÓN (captura del owner
 * 2026-08-14): la pantalla dijo «Valparaíso · **Capital detenido** marca $25K», y CLAUDE.md §4 fija
 * **inmovilizado**, nunca «detenido».
 *
 * POR QUÉ NINGÚN GATE LO VIO, que es lo único que importa acá:
 *   · `_registro_gate.mjs` barre TEXTO EMITIDO (openers, sugerencias, líneas de la Mesa) y la narración viva
 *     lavada por `stripLanguageLeaks`. NO barre los LABELS DE LA BOLETA — y el respaldo determinístico del
 *     oráculo (`componerPorForma` → `_tabla`/`_enLinea`, narrationBlocks.js) imprime `f.label` VERBATIM. Un label
 *     no es "texto emitido" hasta que el narrador se cae; ese día lo es, y es lo único que se lee.
 *   · su `BANNED` tampoco incluía «detenido» ni «vara»: la primera está vetada por §4 como sinónimo de
 *     inmovilizado, la segunda desde el sello ejecutivo. Una lista que no las nombra no las puede cazar.
 *   · el barrido corre por `answerADIFromSpec` (el seam LEGADO). Las superficies del ORÁCULO —los labels que
 *     sella `toolRegistry`, los templates verbatim de `dialogueState`/`progressiveDisclosure`— no las tocaba
 *     nadie, y son el camino VIGENTE: el que respondió el turno de la captura.
 *
 * QUÉ CERTIFICA (5 frentes, todos sobre el camino VIGENTE):
 *   [1] LOS LABELS DE LA BOLETA · se ejecutan las tools reales del catálogo sobre una matriz de argumentos y se
 *       audita CADA fig: `label`, `context`, `formula` y `coverage.reason`. Los cuatro llegan a pantalla o al
 *       prompt como texto autorizado — el label directo por el respaldo, el resto vía narrador y evidencia.
 *   [2] LOS TEXTOS VERBATIM · `composeExhaustedMechanismAcceptance` (bypass de mecanismo agotado) y
 *       `composeProsaEjecutiva` (reparación del veredicto tabla-no-autorizada) salen SIN pasar por el narrador.
 *   [3] EL GLOSARIO CURADO · `CONCEPT_DEFS` se imprime verbatim por la tool `defineConcept`, y `_registro_gate`
 *       solo mira `METRIC_DEFS`. La entrada `vara` es la ÚNICA excepción declarada (decisión frenada para el
 *       owner, ver `_INFORME_PODA_2B.md`) y se verifica que siga siendo la única: una excepción que crece en
 *       silencio deja de ser una excepción.
 *   [4] EL ESTÁTICO DEL CONCEPTO · `specRetrieval._ESTADO_LABEL` y el título del foco son la fuente de la que
 *       salen los labels; se leen del archivo para que un futuro editor no pueda reintroducir la palabra en el
 *       origen sin ponerse rojo, aunque la matriz de [1] no llegue a esa rama.
 *   [5] EL TURNO DE LA CAPTURA · reproducido exacto: el label de la bodega con su cifra, tal como se leyó.
 *
 * PURO Y OFFLINE · corre composers determinísticos y lee archivos. Cero red, cero proveedor, cero crédito: este
 * archivo no nombra ni importa nada del gateway, así que la suite lo clasifica offline sin necesitar escapes.
 *   npm run gates:offline   (NUNCA suelto, NUNCA `npm run gates`)
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { TOOLS } from "./src/adi/oracle/toolRegistry.js";
import { composeExhaustedMechanismAcceptance, composeOrphanAcceptance, composeVagueOfferAcceptance,
  composeSubjectAmbiguity } from "./src/adi/oracle/dialogueState.js";
import { composeReferenceAmbiguity, composeReferenceDecline } from "./src/adi/oracle/conversationScope.js";
import { composeVacioPorEje, composeVacioPorCardinalidad, composeMultiEntityUnsupported,
  composeCardinalityExceeded, composeFanOutCapped, composeDimensionUnsupported,
  getToolContract } from "./src/adi/oracle/toolContracts.js";
import { composeProsaEjecutiva } from "./src/adi/oracle/progressiveDisclosure.js";
import { buildClaims } from "./src/adi/oracle/narrationContract.js";
import { CONCEPT_DEFS } from "./src/adi/sentrix/glossary.js";
import { buildResumenEjecutivo } from "./src/adi/specRetrieval.js";
import { detectVoseo, VOSEO_FORMAS } from "./src/adi/llm/voiceGuard.js";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";

initTenant(TENANT_DEMO);
const ROOT = join(fileURLToPath(new URL(".", import.meta.url)));

/* ── EL VOCABULARIO ────────────────────────────────────────────────────────────────────────────────────────────
 * CLAUDE.md §4, textual: «Prohibidas en superficie: plata, vara, dormido, guita, palanca, apretar. Se dice
 * capital, benchmark. También: "inmovilizado", no "detenido".»
 * SE SUMAN LAS DOS QUE `_registro_gate.BANNED` no trae —«vara» y «detenido»— porque son exactamente las que se
 * colaron. Las formas van ENUMERADAS por género y número, nunca `\w*`: `detenid[oa]s?` caza detenido/a/os/as sin
 * tocar «detener»/«se detuvo», que es el VERBO sobre un SKU y es legítimo (H3 de la certificación amplia, y
 * `voiceGuard` documenta la misma frontera). `varas?` no toca «varado» por el `\b`. */
const VETADAS = /\b(plata|guita|palancas?|dormid[oa]s?|apr[ei]et\w*|varas?|detenid[oa]s?)\b/i;

/* ── EL VOSEO · YA NO VIVE ACÁ, Y ESA ES LA CORRECCIÓN (owner 2026-08-14) ──────────────────────────────────────
 * ESTE GATE TENÍA SU PROPIA LISTA de formas voseantes, y `_registro_gate` tenía OTRA, y `voiceGuard._VOSEO` una
 * TERCERA. Las tres incompletas, y ninguna con las mismas entradas. Por eso la captura del owner —«…¿Sobre qué
 * cliente, SKU, marca o familia querés simular este escenario?»— salió a pantalla con los dos gates en VERDE: no
 * fallaron por no mirar voseo, fallaron porque la forma que se coló estaba en un texto que este gate no barría, y
 * las formas vecinas («referís», «liberás», «entregás», «recuperás», «quedás», «retenés», «concedés») no estaban
 * en ninguna de las tres listas. Tres copias de un vocabulario son tres oportunidades de que una quede corta.
 * Ahora la lista es UNA y vive en `voiceGuard` —la autoridad de voseo del repo, donde ya está el stripper que lo
 * neutraliza en runtime—, y los dos gates la consumen por `detectVoseo`. Sumar una forma es tocar un archivo. */

let PASS = 0, FAIL = 0; const ROTOS = [];
const H = (t) => console.log("\n" + t);
const _fallo = (origen, texto, palabra) => {
  FAIL++;
  const i = texto.indexOf(palabra);
  const gist = texto.replace(/\s+/g, " ").slice(Math.max(0, i - 45), i + 45);
  ROTOS.push(`[${origen}] «${palabra}» …${gist}…`);
  console.log(`  ✗ [${origen}] «${palabra}» …${gist}…`);
};
// vocabulario vetado + formas de voseo — el barrido de siempre, sobre labels, verbatim, glosario y Mesa.
const check = (origen, texto) => {
  if (typeof texto !== "string" || !texto.trim()) return;
  const mv = texto.match(VETADAS);
  const palabra = mv ? mv[0] : detectVoseo(texto);
  if (palabra) _fallo(origen, texto, palabra); else PASS++;
};
/* checkVoseo — SÓLO formas verbales, SIN el vocabulario `VETADAS`, y la diferencia no es un descuido. Lo usa el
 * barrido estático [2c], que lee TODO literal del archivo: `specRetrieval` tiene ~16 literales con «detenido» y
 * uno con «vara» que este gate nunca auditó. Son hallazgos REALES —quedan declarados en
 * `_INFORME_VOSEO_VIGENTE.md`— pero pertenecen a la clase de la Poda 2B, donde el renombre de `vara` está FRENADO
 * esperando decisión del owner. Meterlos acá sería abrir en silencio una decisión de producto ajena a este pase.
 * Cuando esa decisión se tome, esta función se borra y [2c] pasa a usar `check`. */
const checkVoseo = (origen, texto) => {
  if (typeof texto !== "string" || !texto.trim()) return;
  const palabra = detectVoseo(texto);
  if (palabra) _fallo(origen, texto, palabra); else PASS++;
};
const ok = (cond, msg) => { if (cond) PASS++; else { FAIL++; ROTOS.push(msg); console.log("  ✗ " + msg); } };

/* ── EL BARRIDO DE `facts`, RECURSIVO ──────────────────────────────────────────────────────────────────────────
 * POR QUÉ RECURSIVO Y NO UNA LISTA DE CAMPOS. La primera versión de este gate auditaba los campos de `facts` que
 * yo sabía que se citan (`umbral_no_aplicado.declaracion`, la nota del otro estado…) — y por eso NO vio
 * `evidence.margin.title`, donde vivía «Margen · el costo aprieta»: un título que el panel de Sentrix pinta y que
 * el prompt recibe. Una lista escrita a mano solo caza lo que su autor ya sospechaba. `facts` ES el paquete que
 * viaja al narrador y a la evidencia, así que se barre ENTERO.
 * LAS CLAVES INTERNAS SE EXCLUYEN, y se declaran una por una: son identificadores de máquina (enums de estado, de
 * eje, de foco), no prosa. `capital_frenado`, `palancas` o `sku` son valores de ruteo — vetarlos obligaría a
 * renombrar el motor para cumplir una regla de vocabulario de PANTALLA, que es exactamente lo contrario de lo que
 * pide CLAUDE.md. `etiquetas` sale por el mismo motivo que en el glosario: es vocabulario de ENTRADA. */
const CLAVES_INTERNAS = new Set([
  "focus", "focusColor", "estado", "detector", "lens", "key", "slug", "operacion", "op", "kind", "action",
  "unit", "source", "campo", "campo_sumado", "operador", "dimension", "metrica", "entityType", "color",
  "tool", "etiquetas", "sello", "eje", "universo", "id", "sku", "bodega", "familia", "marca", "canal",
]);
function barrerFacts(tag, valor, ruta = "facts") {
  if (valor == null) return;
  if (typeof valor === "string") { check(`${tag} · ${ruta}`, valor); return; }
  if (Array.isArray(valor)) { valor.forEach((v, i) => barrerFacts(tag, v, `${ruta}[${i}]`)); return; }
  if (typeof valor !== "object") return;
  for (const [k, v] of Object.entries(valor)) {
    if (CLAVES_INTERNAS.has(k)) continue;
    barrerFacts(tag, v, `${ruta}.${k}`);
  }
}

/* ══ [1] LOS LABELS DE LA BOLETA ═══════════════════════════════════════════════════════════════════════════════
 * LA MATRIZ ES EL GATE. Un `label` solo existe cuando la rama que lo emite corre, así que se barren las tools de
 * lectura/diagnóstico/simulación con los argumentos que el planificador arma de verdad — y en particular TODOS
 * los focos de inventario, que es donde vive el concepto que se corrigió. Se auditan los CUATRO campos que
 * viajan: `label` (el que el respaldo imprime), `context` y `formula` (que entran al prompt como texto
 * autorizado y a la evidencia del panel) y `coverage.reason` (que es la respuesta cuando no hay dato). */
H("══ [1] LABELS · context · formula · coverage.reason de las tools VIGENTES ══");
const LLAMADAS = [
  // inventario · los 6 focos + los alcances que cambian de rama (el vacío con alcance declarado, el corte por días)
  ["inventoryStatus", { focus: "frenado" }], ["inventoryStatus", { focus: "quiebre" }],
  ["inventoryStatus", { focus: "sobrestock" }], ["inventoryStatus", { focus: "estado" }],
  ["inventoryStatus", { focus: "stale", staleDays: 90 }], ["inventoryStatus", { focus: "top_sellers" }],
  ["inventoryStatus", { focus: "mas_vendidos_mes" }],
  ["inventoryStatus", { focus: "frenado", filters: { bodega: "Valparaíso" } }],
  ["inventoryStatus", { focus: "frenado", filters: { bodega: "Concepción" } }],   // sin frenados → la otra rama
  ["inventoryStatus", { focus: "estado", filters: { familia: "Línea Blanca" } }],
  // diagnóstico y resumen · los focos comerciales + el de capital, que es el que trae el concepto
  ["diagnose", {}], ["diagnose", { filters: { marca: "Samsung" } }],
  ["executiveSummary", {}],
  // simulaciones · su `coverage.reason` es texto de pantalla cuando no hay nada que simular
  ["simulateCapital", {}], ["simulateCapital", { filters: { bodega: "Concepción" } }],
  ["simulateCarga", {}], ["simulateCosto", { pct: -3 }],
  // perfiles y fichas · de acá salen las figs de referencia con su `context`
  ["entityProfile", { dimension: "cliente", entity: "Falabella" }],
  ["entityProfile", { dimension: "cliente", entity: "Lider" }],
  ["entityComposicion", { dimension: "cliente", entity: "Falabella" }],
  ["entityRecord", { dimension: "sku", entity: "LG-DRYER8KG" }],
  ["entityRecord", { dimension: "cliente", entity: "Falabella" }],
  ["entityCapitalLigado", { dimension: "cliente", entity: "Falabella" }],
  ["clientesPorSku", { sku: "LG-DRYER8KG" }],
  // lecturas por eje
  // los 7 focos de margen: de acá sale `_MFOCUS_TITLE`, el título que el panel pinta (donde vivía «el costo aprieta»)
  ["marginRead", { dimension: "cliente", focus: "bajo_benchmark" }],
  ["marginRead", { dimension: "cliente", focus: "causa_costo" }], ["marginRead", { dimension: "cliente", focus: "causa_precio" }],
  ["marginRead", { dimension: "cliente", focus: "subir_precio" }], ["marginRead", { dimension: "cliente", focus: "palancas" }],
  ["marginRead", { dimension: "cliente", focus: "alto_volumen_bajo_margen" }], ["marginRead", { dimension: "cliente", focus: "alto_margen_subpenetrado" }],
  ["marginRead", { dimension: "sku", focus: "bajo_benchmark" }],
  ["salesRead", { dimension: "cliente" }], ["contributionRead", { dimension: "cliente" }],
  ["queryMetric", { metric: "capital", dimension: "bodega" }],
  ["gridTable", { dimension: "sku" }], ["tensionRead", { dimension: "cliente" }],
  ["compareEntities", { dimension: "cliente", entities: ["Falabella", "Lider"] }],
  ["trend", { metric: "ventas", dimension: "cliente", entity: "Falabella" }],
  // el glosario servido como tool — la definición sale VERBATIM
  ["defineConcept", { term: "benchmark" }], ["defineConcept", { term: "capital_inmovilizado" }],
  ["defineConcept", { term: "meta" }], ["defineConcept", { term: "brecha" }],
];
let figsVistas = 0;
for (const [nombre, args] of LLAMADAS) {
  const tool = TOOLS[nombre];
  if (!tool) { ok(false, `la tool «${nombre}» ya no existe en el catálogo — la matriz de este gate quedó vieja`); continue; }
  let r;
  try { r = tool({ scenario: "actual", ...args }); }
  catch (e) { ok(false, `${nombre}(${JSON.stringify(args)}) LANZÓ: ${String(e && e.message).slice(0, 90)}`); continue; }
  if (!r) { ok(false, `${nombre}(${JSON.stringify(args)}) devolvió null`); continue; }
  const tag = `${nombre}·${JSON.stringify(args).slice(0, 42)}`;
  for (const f of (r.boleta || [])) {
    figsVistas++;
    check(`${tag} · label`, f && f.label);
    check(`${tag} · context`, f && f.context);
    check(`${tag} · formula`, f && f.formula);
  }
  if (r.coverage && r.coverage.reason) check(`${tag} · coverage.reason`, r.coverage.reason);
  barrerFacts(tag, r.facts);
}
ok(figsVistas >= 200, `la matriz tiene que ejercitar una boleta de verdad — se auditaron ${figsVistas} figs (mínimo 200; si bajó, alguna tool dejó de devolver dato y este gate se volvió decorativo)`);
console.log(`  · ${figsVistas} figs auditadas sobre ${LLAMADAS.length} llamadas`);

/* ══ [2] LOS TEXTOS VERBATIM DEL CAMINO VIGENTE ════════════════════════════════════════════════════════════════
 * Los dos salen a pantalla SIN narrador: el bypass de mecanismo agotado devuelve su string tal cual, y la prosa
 * ejecutiva es la reparación determinística del veredicto `tabla-no-autorizada`. Ningún prompt los gobierna. */
H("══ [2] TEXTOS VERBATIM · bypass de mecanismo agotado · prosa ejecutiva de reparación ══");
for (const mech of ["capital", "costo", "carga", null]) {
  check(`mecanismo agotado · ${mech || "sin mecanismo"}`, composeExhaustedMechanismAcceptance({ tool: null, mechanismExhausted: true, mechanism: mech, entidad: "Falabella" }));
}
// la prosa se compone desde CLAIMS, y los claims salen de labels de boleta: se la alimenta con la boleta REAL del
// perfil (el caso vivo) y con una boleta de capital que trae el concepto — que es la rama que interpola la métrica.
{
  const perfil = TOOLS.entityProfile({ dimension: "cliente", entity: "Falabella", scenario: "actual" });
  check("prosa ejecutiva · perfil real", composeProsaEjecutiva(buildClaims(perfil.boleta || []), { entidad: "Falabella" }));
  // LA INTERPOLACIÓN ES EL RIESGO, no el literal: `composeProsaEjecutiva` mete `palanca.metrica` CRUDA en la
  // frase de la causa. Se le pasa a propósito una boleta con la etiqueta VIEJA —la que el camino legado sigue
  // emitiendo— para verificar que el lavado de salida la neutraliza igual. Si alguien saca ese lavado, esto cae.
  const conEtiquetaVieja = [
    { label: "Falabella · Ventas", value: "$18.5M", unit: "money", raw: 18500000 },
    { label: "Capital detenido · subtotal", value: "$33K", unit: "money", raw: 33200 },
  ];
  check("prosa ejecutiva · métrica interpolada con etiqueta vieja", composeProsaEjecutiva(buildClaims(conEtiquetaVieja), { entidad: "Falabella" }));
}

/* ══ [2b] LOS COMPOSITORES DE BYPASS ═══════════════════════════════════════════════════════════════════════════
 * TODOS devuelven su string TAL CUAL a la pantalla: `answerViaOracle` los usa para cortar el turno sin pasar por
 * el narrador, así que ningún prompt los gobierna y `stripLanguageLeaks` no siempre los toca. Son exactamente la
 * familia a la que pertenece la frase de la captura, y hasta hoy sólo uno de ellos (mecanismo agotado) estaba
 * auditado. Se los llama con la matriz de argumentos que dispara CADA rama: la rama sin entidad y la rama con
 * entidad devuelven textos DISTINTOS, y una sola llamada dejaría la otra sin barrer. */
H("══ [2b] BYPASS · los compositores que responden el turno sin narrador ══");
{
  const SUBJ = [{ entidad: "Falabella" }, { entidad: "Lider" }];
  const casos = [
    ["orphanAcceptance · con temas", composeOrphanAcceptance(SUBJ)],
    ["orphanAcceptance · sin temas", composeOrphanAcceptance([])],
    ["vagueOffer · con entidad", composeVagueOfferAcceptance({ entidad: "Falabella", texto: "las condiciones" })],
    ["vagueOffer · sin entidad", composeVagueOfferAcceptance({ texto: "las condiciones" })],
    ["subjectAmbiguity", composeSubjectAmbiguity(SUBJ)],
    ["referenceAmbiguity · 1 grupo", composeReferenceAmbiguity([{ entities: ["Falabella"], dimension: "cliente" }])],
    ["referenceAmbiguity · 2 grupos", composeReferenceAmbiguity([
      { entities: ["Falabella", "Lider"], dimension: "cliente" }, { entities: ["Samsung"], dimension: "marca" }])],
    ["referenceDecline · otro_tenant", composeReferenceDecline("otro_tenant")],
    ["referenceDecline · sin_referente", composeReferenceDecline("sin_referente")],
    ["referenceDecline · otro motivo", composeReferenceDecline("lo_que_sea")],
    ["vacíoPorEje", composeVacioPorEje("marginRead", "cliente", ["Samsung"], "marca")],
    ["vacíoPorEje · sin ausentes", composeVacioPorEje("marginRead", "cliente", [], "marca")],
    ["vacíoPorCardinalidad", composeVacioPorCardinalidad("compareEntities", 2, ["Falabella", "Lider"], ["NoExiste"])],
    ["multiEntityUnsupported", composeMultiEntityUnsupported("entityProfile", "cliente", ["Falabella", "Lider"])],
    ["cardinalityExceeded", composeCardinalityExceeded("compareEntities", 2, ["Falabella", "Lider", "Jumbo"], "cliente")],
    ["fanOutCapped", composeFanOutCapped("entityProfile", ["Falabella", "Lider", "Jumbo"], 2)],
    ["dimensionUnsupported", composeDimensionUnsupported("clientesPorSku", getToolContract("clientesPorSku"), "bodega")],
  ];
  for (const [nombre, texto] of casos) {
    ok(typeof texto === "string" && texto.trim().length > 0, `el compositor «${nombre}» devolvió vacío — la matriz de este gate quedó vieja y estaría barriendo aire`);
    check(`bypass · ${nombre}`, texto);
  }
}

/* ══ [2c] LOS LITERALES DEL CAMINO VIGENTE, LEÍDOS DEL ARCHIVO ═════════════════════════════════════════════════
 * POR QUÉ ESTÁTICO ADEMÁS DE [1]/[2]/[2b], QUE EJECUTAN CÓDIGO REAL. La frase de la captura vive INLINE dentro de
 * `answerViaOracle` —no la devuelve ningún compositor exportado—, y llamarla exigiría montar un turno completo con
 * `mem`, plan y escenario. Un gate que sólo ejercita ramas audita lo que su matriz supo disparar; esto audita
 * TODO literal del archivo, incluidas las ramas que hoy no corren. Es el mismo criterio de [4] (el estático del
 * concepto), aplicado al texto en vez de a un diccionario.
 *
 * SE LEEN LITERALES, NO LÍNEAS: un mini-scanner saltea comentarios (donde el voseo es legítimo — son notas para
 * quien programa, no pantalla) y literales de expresión regular (donde es DELIBERADO: el vocabulario de ENTRADA
 * tiene que seguir entendiendo al usuario que escribe «decime» o «mostrame», misma regla que las `etiquetas` del
 * glosario). Dentro de un template se saltea la interpolación `${…}` y se conserva el texto de alrededor. */
function literalesDe(src) {
  const out = []; let i = 0; const n = src.length;
  while (i < n) {
    const c = src[i];
    if (c === "/" && src[i + 1] === "/") { while (i < n && src[i] !== "\n") i++; continue; }
    if (c === "/" && src[i + 1] === "*") { i += 2; while (i < n && !(src[i] === "*" && src[i + 1] === "/")) i++; i += 2; continue; }
    if (c === "/") {   // ¿literal regex? sólo si lo precede un operador o `return` — si no, es una división
      const prev = src.slice(Math.max(0, i - 8), i).replace(/\s+$/, "");
      if (/[=(,:[!&|?{;]$|\breturn$/.test(prev)) {
        i++; let esc = false, cls = false;
        while (i < n) {
          const d = src[i];
          if (esc) esc = false; else if (d === "\\") esc = true; else if (d === "[") cls = true;
          else if (d === "]") cls = false; else if (d === "/" && !cls) { i++; break; } else if (d === "\n") break;
          i++;
        }
        continue;
      }
      i++; continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      const q = c; i++; let buf = "", esc = false;
      while (i < n) {
        const d = src[i];
        if (esc) { buf += d; esc = false; i++; continue; }
        if (d === "\\") { esc = true; i++; continue; }
        if (d === q) { i++; break; }
        if (q === "`" && d === "$" && src[i + 1] === "{") { let dep = 1; i += 2; while (i < n && dep > 0) { if (src[i] === "{") dep++; else if (src[i] === "}") dep--; i++; } buf += " "; continue; }
        if (q !== "`" && d === "\n") break;
        buf += d; i++;
      }
      if (buf.trim()) out.push(buf);
      continue;
    }
    i++;
  }
  return out;
}
/* LOS ARCHIVOS DEL CAMINO VIGENTE que emiten texto a pantalla. NO entra el camino LEGADO (answerADIFromSpec,
 * composers/*, conversation.js, intentLayer) —se migra aparte y `_registro_gate` ya lo barre—, ni los PROMPTS
 * (planPrompt, persona, narratePromptC, conversationalContract, progressiveDisclosure, responsePreference,
 * datoProyectado): ese texto va PARA el modelo y está redactado en voseo a propósito. */
const VIGENTES = [
  "src/adi/oracle/answerViaOracle.js", "src/adi/oracle/dialogueState.js", "src/adi/oracle/conversationScope.js",
  "src/adi/oracle/toolContracts.js", "src/adi/oracle/toolRegistry.js", "src/adi/oracle/narrationBlocks.js",
  "src/adi/oracle/calculoCatalogo.js", "src/adi/oracle/entityRecord.js", "src/adi/porQueEstaCifra.js",
  "src/adi/specRetrieval.js", "src/adi/sentrix/mesa.js", "src/adi/sentrix/mesaCapital.js",
  "src/adi/sentrix/mesaResultado.js", "src/adi/sentrix/glossary.js", "src/adi/sentrix/resumenComercial.js",
  "src/adi/sentrix/cuadro.js", "src/adi/sentrix/control.js", "src/adi/sentrix/headline.js",
  "src/ui/SentrixPanel.jsx", "src/ui/ChatADI.jsx", "src/ui/AccessGate.jsx",
];
/* LA ÚNICA EXCEPCIÓN, NOMBRADA — mismo trato que `vara` en [3]. `buildOrientacionInstruction` (dialogueState.js)
 * NO compone pantalla: arma la INSTRUCCIÓN que viaja en el payload de NARRAR («su único consumidor es el payload
 * de NARRAR», answerViaOracle.js). Es texto PARA el modelo y va en voseo como el resto de los prompts. Se declara
 * por su contenido, no por número de línea, para que no se desarme al mover el archivo. */
const PROMPT_NO_PANTALLA = [
  "cerrá proponiendo mirar el MISMO tema",
  "Cerrá con 2 o 3 ángulos CONCRETOS",
  "podés retomar alguno de estos temas recientes",
];
H("══ [2c] ESTÁTICO · todo literal de pantalla del camino vigente ══");
{
  let literales = 0, exentos = 0;
  for (const rel of VIGENTES) {
    let src;
    try { src = readFileSync(join(ROOT, rel), "utf8"); }
    catch { ok(false, `no se pudo leer «${rel}» — el inventario de este gate quedó viejo, arreglalo antes de seguir`); continue; }
    for (const lit of literalesDe(src)) {
      if (PROMPT_NO_PANTALLA.some((p) => lit.includes(p))) { exentos++; continue; }
      literales++;
      checkVoseo(`${rel} · literal`, lit);
    }
  }
  ok(literales >= 3000, `el barrido estático tiene que ver un corpus de verdad — leyó ${literales} literales (mínimo 3000; si bajó, el scanner se rompió o el inventario quedó viejo y el gate se volvió decorativo)`);
  ok(exentos === PROMPT_NO_PANTALLA.length,
    `las exenciones declaradas son ${PROMPT_NO_PANTALLA.length} y se encontraron ${exentos}: si sobran, una quedó huérfana (se puede borrar); si faltan, alguien movió el texto y la exención dejó de aplicar donde creía`);
  console.log(`  · ${literales} literales barridos en ${VIGENTES.length} archivos · ${exentos} exenciones declaradas (instrucción al narrador, no pantalla)`);
}

/* ══ [2d] EL DETECTOR NO PUEDE ENCOGERSE ═══════════════════════════════════════════════════════════════════════
 * Las secciones de arriba sólo valen lo que vale `detectVoseo`: si alguien le saca una forma, todo se pone verde
 * sin que nada mejore. Esto ata las formas que este barrido MIDIÓ en pantalla —cada una salió de un literal real
 * del camino vigente, no de una lista imaginada— y exige que el detector las siga cazando.
 *
 * LO QUE ESTA SECCIÓN NO AFIRMA, dicho explícito: que el stripper de runtime las neutralice. Eso lo mide y lo
 * lockea `_voice_gate.mjs` §[V], que es donde vive la red morfológica. Estado al 2026-08-14: de 311 variantes del
 * detector el stripper cubre 290 (280 en prosa neutra + 10 gateadas a posición de orden) y las 21 restantes están
 * declaradas UNA POR UNA con su motivo en `NO_CUBIERTAS`. El hueco que este comentario declaraba abierto —150 de
 * 316— se cerró; la diferencia que queda es deliberada, no un descuido, y está listada. */
H("══ [2d] EL DETECTOR · las formas medidas en pantalla siguen cazándose ══");
{
  const MEDIDAS_EN_PANTALLA = [
    "querés", "esperás", "referís", "preferís", "podés", "tenés", "vendés", "emitís", "corregís", "reponés",
    "liberás", "entregás", "quedás", "retenés", "concedés", "recuperás",
    "decime", "decímelo", "contame", "armame", "preguntale",
    "priorizá", "probá", "revisá", "sumá", "bajá", "liquidá", "reponé", "empezá", "marcá", "olvidá",
    "elegí una", "abrí la", "seguí el", "pedí una", "medí el",
  ];
  for (const forma of MEDIDAS_EN_PANTALLA) {
    ok(!!detectVoseo(`Texto de prueba: ${forma} cosa.`),
      `el detector dejó de cazar «${forma}» — es una forma que ESTE barrido encontró en un literal de pantalla del camino vigente; si sale de la lista, vuelve a producción sin que nada se ponga rojo`);
  }
  // y no puede volverse un detector-de-todo: la prosa correcta tiene que seguir pasando limpia.
  const LEGITIMO = [
    "Si recuperarías ese margen, la cuenta cierra.", "Vas a ver que el costo tendrá su efecto.",
    "Falabella entregas más de lo que recibe.", "Las marcas del período están completas.",
    "Necesitas revisar el benchmark: quizás además el costo subió.", "Pásame el número con su unidad.",
    "Cuéntame qué quieres revisar y lo armo.", "Dime a cuál te refieres y sigo.",
    "No me armes ninguna tabla, dime qué está pasando.", "Me dejaste sin la tabla que te pedí.",
    "Yo pedí el dato ayer y no llegó.", "El informe que escribí la semana pasada ya está.",
    "Estás bajo el benchmark en tres cuentas.", "Los retenes de stock no aplican acá.",
  ];
  for (const t of LEGITIMO) {
    const v = detectVoseo(t);
    ok(!v, `FALSO POSITIVO del detector: marcó «${v}» en prosa correcta — «${t}». Un gate que marca lo bueno se termina desactivando; la forma tiene que salir de VOSEO_FORMAS o pedir tilde.`);
  }
  console.log(`  · ${MEDIDAS_EN_PANTALLA.length} formas medidas en pantalla · ${LEGITIMO.length} controles de falso positivo · ${VOSEO_FORMAS.length} entradas en el detector`);
}

/* ══ [3] EL GLOSARIO CURADO ════════════════════════════════════════════════════════════════════════════════════
 * `CONCEPT_DEFS` se imprime VERBATIM por la tool `defineConcept`. `_registro_gate` solo barre `METRIC_DEFS`, así
 * que este diccionario nunca tuvo candado — y ahí vivía «más plata» en el `distingue` de `meta`. */
H("══ [3] GLOSARIO · definiciones curadas que se imprimen verbatim ══");
// LA ÚNICA EXCEPCIÓN, NOMBRADA. El concepto `vara` usa la palabra en su propia definición porque su trabajo es
// definir la palabra que el USUARIO dijo. Renombrarlo es decisión de producto y está frenada para el owner (ver
// `_INFORME_PODA_2B.md`). Se declara acá, no se disimula — y se verifica que sea la única.
const EXCEPCION_DECLARADA = new Set(["vara"]);
// `etiquetas` QUEDA FUERA DEL BARRIDO, y no es un olvido: son el vocabulario de ENTRADA con el que el usuario
// nombra el concepto («capital detenido», «capital frenado», «vara declarada»). La regla del owner es sobre lo que
// ADI DICE, nunca sobre lo que ENTIENDE — barrerlas dejaría al glosario sordo justo a las palabras que la gente
// escribe. Se auditan `aka` (el nombre que se muestra), `def` y `distingue` (el texto que se imprime).
const conVetada = [];
for (const [slug, c] of Object.entries(CONCEPT_DEFS)) {
  const texto = [c.aka, c.def, c.distingue].filter(Boolean).join(" · ");
  const sucio = VETADAS.test(texto) || !!detectVoseo(texto);
  if (sucio) conVetada.push(slug);
  if (EXCEPCION_DECLARADA.has(slug)) continue;   // se audita aparte, abajo
  check(`glosario · ${slug}`, texto);
}
ok(conVetada.every((s) => EXCEPCION_DECLARADA.has(s)),
  `conceptos del glosario con palabra vetada FUERA de la excepción declarada: ${conVetada.filter((s) => !EXCEPCION_DECLARADA.has(s)).join(", ")}`);
// la excepción tiene que seguir SIENDO una excepción: si el owner la resuelve, este check avisa que ya se puede
// sacar de la lista; si alguien suma una entrada sucia nueva, cae el check de arriba.
ok(EXCEPCION_DECLARADA.size === 1 && CONCEPT_DEFS.vara,
  `la excepción declarada dejó de ser exactamente una (o el concepto 'vara' desapareció): revisá EXCEPCION_DECLARADA`);
console.log(`  · ${Object.keys(CONCEPT_DEFS).length} conceptos · 1 excepción declarada (vara, frenada para el owner)`);

/* ══ [3b] LA APERTURA DE LA MESA DE CONTROL ════════════════════════════════════════════════════════════════════
 * `buildResumenEjecutivo` NO es del camino legado: lo consume `SentrixPanel.jsx` y su `lectura` + `focos[].label`
 * son la primera línea que se lee al abrir el panel — la superficie más visible del producto. `_registro_gate` ya
 * la barre, pero contra su `BANNED`, que no incluye «detenido» ni «vara»; por eso «$33K de capital detenido en 3
 * SKU» pasaba en verde. Se audita en los tres escenarios porque el texto nombra entidades del dato. */
H("══ [3b] MESA DE CONTROL · la lectura y los focos de apertura ══");
for (const sc of ["actual", "bonanza", "tension", "crisis"]) {
  const res = buildResumenEjecutivo(sc);
  check(`mesa · lectura (${sc})`, res && res.lectura);
  for (const f of ((res && res.focos) || [])) { check(`mesa · foco label (${sc})`, f.label); check(`mesa · foco entidad (${sc})`, f.entidad); }
  for (const k of ((res && res.kpis) || [])) check(`mesa · kpi label (${sc})`, k.label);
}

/* ══ [4] EL ESTÁTICO DEL CONCEPTO ══════════════════════════════════════════════════════════════════════════════
 * La matriz de [1] ejercita las ramas que hoy existen. Esto ata el ORIGEN: el diccionario del que salen todos los
 * labels de inventario. Un editor futuro que reintroduzca la palabra acá se pone rojo aunque su rama no corra. */
H("══ [4] ESTÁTICO · la fuente de los labels de inventario ══");
{
  const src = readFileSync(join(ROOT, "src", "adi", "specRetrieval.js"), "utf8");
  const mEstado = src.match(/const\s+_ESTADO_LABEL\s*=\s*\{[^}]*\}/);
  ok(!!mEstado, "no se encontró `_ESTADO_LABEL` en specRetrieval.js — el gate perdió su ancla, arreglalo antes de seguir");
  if (mEstado) {
    ok(!VETADAS.test(mEstado[0]), `_ESTADO_LABEL trae una palabra vetada: ${mEstado[0].replace(/\s+/g, " ").slice(0, 160)}`);
    ok(/capital_frenado:\s*"capital inmovilizado"/.test(mEstado[0]), "`_ESTADO_LABEL.capital_frenado` dejó de ser \"capital inmovilizado\" — es EL label que llegó a la pantalla del owner");
  }
  const mFoco = src.match(/_diagFoco\("capital",\s*"([^"]+)"/);
  ok(!!mFoco && !VETADAS.test(mFoco[1]), `el título del foco de capital trae una palabra vetada: «${mFoco ? mFoco[1] : "(no encontrado)"}»`);
}

/* ══ [5] EL TURNO DE LA CAPTURA ════════════════════════════════════════════════════════════════════════════════
 * La fila exacta que el owner leyó en pantalla. No es redundante con [1]: [1] barre todo y podría quedar verde si
 * la rama de la bodega dejara de emitirse; esto exige que la fila SIGA EXISTIENDO y siga estando limpia. */
H("══ [5] EL TURNO DE LA CAPTURA · «Valparaíso · Capital detenido marca $25K» ══");
{
  const r = TOOLS.inventoryStatus({ focus: "frenado", scenario: "actual" });
  const fila = (r.boleta || []).find((f) => f && /^Valpara[ií]so · /.test(String(f.label || "")) && f.unit === "money");
  ok(!!fila, "la boleta de inventoryStatus(frenado) ya no trae la fila de Valparaíso — el caso de la captura dejó de ser reproducible por este gate");
  if (fila) {
    ok(!VETADAS.test(fila.label), `la fila de la captura sigue con palabra vetada: «${fila.label}»`);
    ok(/Capital inmovilizado/.test(fila.label), `la fila de la captura no dice «Capital inmovilizado»: «${fila.label}»`);
    ok(/^\$\d/.test(String(fila.value || "")), `la fila de la captura perdió su cifra: «${fila.value}» — corregir el registro no puede costar el dato`);
    console.log(`  · fila de la captura, hoy: «${fila.label} = ${fila.value}»`);
  }
}

console.log(`\n── _registro_boleta_gate: ${PASS} PASS · ${FAIL} FAIL ──`);
if (ROTOS.length) {
  console.log("✗ REGISTRO VETADO EN EL CAMINO VIGENTE:");
  ROTOS.forEach((r) => console.log("   " + r));
  console.log("\n   CLAUDE.md §4: prohibidas en superficie plata · vara · dormido · guita · palanca · apretar;");
  console.log("   se dice «capital», «benchmark» e «inmovilizado» (nunca «detenido»). Un label de boleta ES");
  console.log("   superficie: el respaldo determinístico lo imprime verbatim cuando el narrador no llega.");
}
process.exit(FAIL ? 1 : 0);
