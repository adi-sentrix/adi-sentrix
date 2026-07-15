/* === _sello_gate.mjs · GATE DE LA REVISIÓN DE CONTRATO DE LA MESA (owner 2026-07-14: "vemos cómo está
 * respondiendo ADI a cada una de esas cosas, si tiene la lógica que tenemos como contrato") ===
 * Lockea los arreglos de las 4 familias de falla que la revisión encontró (14 preguntas reales × jueces):
 *   A · FOCO DE ENTIDAD: «¿Cómo viene X vs el año pasado?» → el dive de X (jamás la cartera) · «principales
 *       clientes/marcas por venta» → ranking desc (jamás los movers) · why de una entidad → barrido SCOPEADO a
 *       ESA entidad (marca por atributo dominante, con salvedad) o el límite honesto que LA nombra.
 *   B · GARANTÍA DE ENTIDAD EN EL NARRADOR: narración que no menciona la entidad-sujeto → descartada.
 *   C · REGISTRO EN LA NARRACIÓN: palanca→acción · upside→potencial · nos pegue→nos afecte (idempotente,
 *       number-safe, mayúscula preservada).
 *   D · MESA/UMBRALES: el ask del porqué SOLO si el detector lo puede afirmar (una verdad) · el inventario por
 *       bodega responde el MONTO total y su estado aunque no haya capital detenido.
 * Todo lo verificable SIN LLM corre acá; la verificación narrada de punta a punta vive en _mesa_review.mjs (real). */
import esbuild from "esbuild"; import { pathToFileURL } from "url"; import path from "path"; import fs from "fs";
const root = process.cwd(); const entry = path.join(root, "_sge.js"), out = path.join(root, "_sgb.mjs");
fs.writeFileSync(entry, [
  'export { coerceSpec } from "./src/adi/coerceChain.js";',
  'export { answerADIFromSpec } from "./src/adi/answerADIFromSpec.js";',
  'export { answerConversational } from "./src/adi/conversation.js";',
  'export { pickNarratedText } from "./src/adi/llm/numberGuard.js";',
  'export { stripLanguageLeaks } from "./src/adi/llm/voiceGuard.js";',
  'export { buildWatchlistEstado } from "./src/adi/sentrix/mesa.js";',
  'export { buildCuadroMando } from "./src/adi/sentrix/cuadro.js";',
].join("\n"));
await esbuild.build({ entryPoints: [entry], bundle: true, outfile: out, format: "esm", platform: "node", logLevel: "silent" });
const M = await import(pathToFileURL(out).href + "?t=" + Math.random());
try { fs.unlinkSync(entry); } catch { /* */ } try { fs.unlinkSync(out); } catch { /* */ }
const { coerceSpec: C, answerADIFromSpec: A, answerConversational: AC, pickNarratedText: P, stripLanguageLeaks: L, buildWatchlistEstado: WB, buildCuadroMando: CMB } = M;

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log("  ✓ " + n); } else { fail++; console.log("  ✗ " + n); } };
const S = (o) => ({ schemaVersion: 1, scenario: "actual", operation: "overview", metric: "ventas", dimension: "cliente", entity: null, filters: null, ...o });
const txt = (r) => String((r && r.text) || "");

console.log("── A · FOCO DE ENTIDAD (coerce) ──");
{
  const s1 = C("¿Cómo viene Lider vs el año pasado?", S({}), false, null);
  ok("«¿Cómo viene Lider vs el año pasado?» → dive de Lider (no la cartera)", s1.operation === "dive" && s1.entity === "Lider" && s1.dimension === "cliente");
  const r1 = AC(s1, {}, { scenario: "bonanza" });
  ok("…y la respuesta abre con Lider (su perfil, con su YoY)", /^Lider /.test(txt(r1)) && /YoY|año/i.test(txt(r1)) && r1.evidence && r1.evidence.entidad === "Lider");
  const s2 = C("¿Cómo viene Samsung?", S({}), false, null);
  ok("«¿Cómo viene Samsung?» → dive de la marca", s2.operation === "dive" && s2.entity === "Samsung" && s2.dimension === "marca");
  const s3 = C("¿Quiénes son mis principales clientes por venta?", S({}), false, null);
  ok("«principales clientes por venta» → rank ventas desc (no los movers)", s3.operation === "rank" && s3.metric === "ventas" && s3.dimension === "cliente" && s3.sort && s3.sort.dir === "desc");
  const r3 = AC(s3, {}, { scenario: "bonanza" });
  ok("…y responde el NIVEL (mejores por ventas), no el crecimiento", /mejores clientes por ventas/i.test(txt(r3)) && !/vs el año anterior/i.test(txt(r3)));
  const s4 = C("¿Cuáles son mis principales marcas por venta?", S({}), false, null);
  ok("«principales marcas por venta» → rank ventas@marca", s4.operation === "rank" && s4.dimension === "marca");
  const s5 = C("mis 3 principales clientes", S({}), false, null);
  ok("«mis 3 principales clientes» → rank con limit 3", s5.operation === "rank" && s5.limit === 3);
  // contra-casos: las redes NO roban lo que ya rutea bien
  ok("«¿cómo viene el margen de la cartera?» sigue en margin (métrica nombrada)", C("¿cómo viene el margen de la cartera?", S({}), false, null).operation === "margin");
  ok("«¿Cómo está ABC en ventas y contribución?» sigue en multi (enumeración de métricas)", C("¿Cómo está ABC en ventas y contribución?", S({}), false, null).turn_type === "multi_analysis");
  ok("«esos mismos, ¿cómo vienen vs el año anterior?» sigue en ventas (sin entidad del canon)", C("esos mismos, ¿cómo vienen vs el año anterior?", S({}), false, null).operation === "ventas");
  ok("«principales clientes por margen» NO la roba el rank de ventas", C("¿mis principales clientes por margen?", S({}), false, null).metric !== "ventas");
  ok("cruce «inventario de los 5 principales sku de ventas» sigue en top_sellers", C("cuál es mi inventario disponible de los 5 principales sku de ventas", S({}), false, null).focus === "top_sellers");
}

console.log("\n── A · WHY SCOPEADO A LA ENTIDAD (seam) ──");
{
  const rS = A(S({ operation: "why", metric: "margen", dimension: "marca", entity: "Samsung" }), {}, {});
  ok("why@marca Samsung → barrido SCOPEADO (Diagnóstico · Samsung, no la cartera de $4.9M)", /Diagn[oó]stico · Samsung/.test(txt(rS)) && !/\$4\.9M/.test(txt(rS)));
  ok("…con la salvedad del atributo DOMINANTE declarada", /salvedad/i.test(txt(rS)) && /DOMINANTE/i.test(txt(rS)));
  ok("…y entidad-sujeto declarada para el narrador", rS.evidence && rS.evidence.entidad === "Samsung");
  const rF = A(S({ operation: "why", metric: "margen", dimension: "cliente", entity: "Falabella" }), {}, {});
  ok("why@cliente Falabella → scoped a Falabella con entidad-sujeto", /Diagn[oó]stico · Falabella/.test(txt(rF)) && rF.evidence && rF.evidence.entidad === "Falabella");
  const rM = A(S({ operation: "why", metric: "margen", dimension: "cliente", entity: "Mercado Libre" }), {}, {});
  ok("why sin foco material → límite honesto que nombra a ESA entidad", /^spec_blocked_why-empty$/.test(rM.route) && /Mercado Libre/.test(txt(rM)));
}

console.log("\n── B · GARANTÍA DE ENTIDAD EN EL NARRADOR ──");
{
  const val = { text: "Diagnóstico · Samsung. Contribución no capturada: $1.8M.", evidence: { entidad: "Samsung", boleta: [] } };
  const sin = P(val, "Estamos perdiendo $1.8M de contribución — la causa está en Falabella.");
  ok("narración SIN la entidad-sujeto → descartada (entidad-ausente, cae al determinístico)", sin.narrated === false && sin.verdict === "entidad-ausente" && sin.text === val.text);
  const con = P(val, "Samsung está cediendo $1.8M de contribución no capturada.");
  ok("narración CON la entidad-sujeto → pasa (fiel)", con.narrated === true && /Samsung/.test(con.text));
  const acc = P({ text: "Concepción tiene $19K de capital.", evidence: { entidad: "Concepción", boleta: [] } }, "En concepcion tenés $19K de capital trabajando.");
  ok("la mención se compara sin tildes ni mayúsculas ('concepcion' cuenta como Concepción)", acc.narrated === true);
  const sinSubj = P({ text: "La venta va +7.6% ($100.0M).", evidence: { boleta: [] } }, "La venta crece +7.6% y llega a $100.0M.");
  ok("sin entidad-sujeto declarada la garantía no interfiere", sinSubj.narrated === true);
}

console.log("\n── C · REGISTRO EN LA NARRACIÓN (leaks del directorio) ──");
{
  const c1 = L("Este upside es una palanca que podemos aprovechar.");
  ok("upside→potencial · palanca→acción (evidencia real de la revisión)", c1 === "Este potencial es una acción que podemos aprovechar.");
  ok("«sin que nos pegue en las ventas» → nos afecte", L("…sin que nos pegue en las ventas.") === "…sin que nos afecte en las ventas.");
  ok("mayúscula preservada (Palanca→Acción · plural palancas→acciones)", L("Palancas claras: dos palancas.") === "Acciones claras: dos acciones.");
  ok("idempotente (doble pasada no cambia)", L(L("Este upside es una palanca.")) === L("Este upside es una palanca."));
  ok("number-safe (cifras intactas)", L("La palanca vale $4.9M (30.1%).") === "La acción vale $4.9M (30.1%).");
  ok("no toca palabras que contienen el patrón ('apalancamiento' queda)", L("El apalancamiento financiero.") === "El apalancamiento financiero.");
}

console.log("\n── D · MESA: UMBRAL = MATERIALIDAD (una verdad) + MONTO POR BODEGA ──");
{
  const wlC = WB(CMB("cliente", "bonanza").rows.map((r) => ({ dim: "cliente", name: r.name })), "bonanza").items;
  const meli = wlC.find((i) => i.nombre === "Mercado Libre");
  ok("Mercado Libre bajo la vara pero INMATERIAL → ask multi (no un porqué que respondería vacío)", meli && /¿Cómo está Mercado Libre/.test(meli.ask));
  const fala = wlC.find((i) => i.nombre === "Falabella");
  ok("Falabella material (item del detector) → conserva el ask del porqué", fala && /¿Por qué Falabella cede margen\?/.test(fala.ask));
  // toda watchlist emitida debe RESPONDER por el camino real (why scopeado · multi · SKU top · capital por bodega)
  let rotas = 0;
  for (const d of ["cliente", "sku", "marca", "bodega"]) {
    for (const it of WB(CMB(d, "bonanza").rows.map((r) => ({ dim: d, name: r.name })), "bonanza").items) {
      if (!it.ask) continue;
      let r;
      if (/^¿Por qué /.test(it.ask)) r = A(S({ operation: "why", metric: "margen", dimension: d, entity: it.nombre }), {}, {});
      else r = AC(C(it.ask, S({}), false, null), {}, { scenario: "bonanza" });
      if (!txt(r).trim() || /^spec_blocked_/.test(r.route || "") || /^(No tengo a |No encuentro )/.test(txt(r).trim())) { rotas++; console.log(`    ✗ rota: [${d}] «${it.ask}» → [${r.route}]`); }
    }
  }
  ok("cada ask de la watchlist responde por su camino real (why scopeado incluido) · 0 rotas", rotas === 0);
  const rC = A(S({ operation: "inventory", metric: "capital", dimension: "bodega", entity: null, filters: { bodega: "Concepción" } }), {}, {});
  ok("«capital en Concepción» sin detenido → el MONTO total + estado (no solo el vacío)", /En Concepción tenés \$19K de capital/.test(txt(rC)) && !/^spec_blocked_/.test(rC.route || ""));
  ok("…declara la vara y la otra punta si existe", /rotaci[oó]n bajo 2x/.test(txt(rC)));
  const rV = A(S({ operation: "inventory", metric: "capital", dimension: "bodega", entity: null, filters: { bodega: "Valparaíso" } }), {}, {});
  ok("bodega CON detenido conserva su lectura scopeada de capital inmovilizado", /capital inmovilizado/i.test(txt(rV)) && /Valpara/.test(txt(rV)));
  const sB = C("¿Cuánto capital tengo en Concepción?", S({}), false, null);
  ok("coerce: la bodega nombrada viaja como alcance (jamás el global en silencio)", sB.operation === "inventory" && sB.filters && sB.filters.bodega === "Concepción");
}

console.log(`\n── _sello_gate: PASS ${pass} · FAIL ${fail} (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
