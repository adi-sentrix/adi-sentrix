/* === _lever_gate.mjs · GATE de PALANCA CUANTIFICADA (asesor · Frente A.1 · owner 2026-07-06) ===
 * Cada consejo lleva su $ ("Cuánto vale"). Regla madre UNA VERDAD: la palanca de margen/carga usa la MISMA cuenta gated
 * que el diagnóstico (_diagComercial) — este gate lo verifica comparando el subtotal de la palanca contra el subtotal del
 * diagnose (mismo raw). Además: 1pp = venta×1% en los ejes sin detector · figuras con source:"computed"+formula (auditables)
 * · el scope heredado ("de esos…") recorta también la palanca. */
import esbuild from "esbuild"; import { pathToFileURL } from "url"; import path from "path"; import fs from "fs";
const root = process.cwd(); const entry = path.join(root, "_lve.js"), out = path.join(root, "_lvb.mjs");
fs.writeFileSync(entry, [
  'export { coerceSpec } from "./src/adi/coerceChain.js";',
  'export { answerConversational } from "./src/adi/conversation.js";',
  'export { answerADIFromSpec } from "./src/adi/answerADIFromSpec.js";',
  'export { guardAgainstBoleta } from "./src/adi/boleta.js";',
  'export { buildResumenEjecutivo } from "./src/adi/specRetrieval.js";',
  'export { pickNarratedText } from "./src/adi/llm/numberGuard.js";',
].join("\n"));
await esbuild.build({ entryPoints: [entry], bundle: true, outfile: out, format: "esm", platform: "node", logLevel: "silent" });
const M = await import(pathToFileURL(out).href + "?t=" + Math.random());
try { fs.unlinkSync(entry); } catch {} try { fs.unlinkSync(out); } catch {}
const { coerceSpec: C, answerConversational: AC, answerADIFromSpec: A } = M;

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log("  ✓ " + n); } else { fail++; console.log("  ✗ " + n); } };
const spec = (o) => ({ schemaVersion: 1, metric: "margen", dimension: "cliente", ...o });
const bol = (r) => (r && r.evidence && r.evidence.boleta) || [];
const figOf = (r, re) => bol(r).find((f) => re.test(f.label));

console.log("── UNA VERDAD · la palanca usa la MISMA cuenta gated que el diagnóstico ──");
const diag = A(spec({ operation: "diagnose" }), {}, {});
const diagMargen = figOf(diag, /Contribución no capturada · subtotal/);
const diagCarga = figOf(diag, /Carga comercial alta · subtotal/);
const mBench = A(spec({ operation: "margin", focus: "bajo_benchmark" }), {}, {});
const leverBrecha = figOf(mBench, /Palanca · cerrar brecha al piso/);
ok("bajo_benchmark lleva «Cuánto vale» + palanca en boleta", /Cuánto vale:/.test(mBench.text) && !!leverBrecha);
ok("palanca de margen == subtotal del diagnose (mismo raw)", leverBrecha && diagMargen && leverBrecha.raw === diagMargen.raw);
ok("la palanca es computed + formula auditable", leverBrecha && leverBrecha.source === "computed" && /benchmark/.test(leverBrecha.formula || ""));
const mPal = A(spec({ operation: "margin", focus: "palancas" }), {}, {});
const leverCarga = figOf(mPal, /Palanca · carga al target/);
ok("palancas lleva la carga cuantificada al target", /llevar la carga al target/i.test(mPal.text) && !!leverCarga);
ok("palanca de carga == subtotal del diagnose (mismo raw)", leverCarga && diagCarga && leverCarga.raw === diagCarga.raw);

console.log("\n── 1pp = venta × 1% en focos por entidad ──");
const mSubir = A(spec({ operation: "margin", focus: "subir_precio", dimension: "sku" }), {}, {});
const lever1pp = figOf(mSubir, /Palanca · 1pp en /);
ok("subir_precio cuantifica el punto de precio", /cada punto de precio en .+ vale \+\$/.test(mSubir.text) && !!lever1pp && lever1pp.raw > 0);
const mVol = A(spec({ operation: "margin", focus: "alto_volumen_bajo_margen" }), {}, {});
ok("alto_volumen cuantifica 1pp del caso más caro", /1pp de margen en .+ son \+\$/.test(mVol.text) && !!figOf(mVol, /Palanca · 1pp en /));
const mPrecio = A(spec({ operation: "margin", focus: "causa_precio" }), {}, {});
ok("causa_precio cuantifica 1pp vía precio", /recuperar 1pp vía precio/.test(mPrecio.text) && !!figOf(mPrecio, /Palanca · 1pp en /));
const mCosto = A(spec({ operation: "margin", focus: "causa_costo" }), {}, {});
ok("causa_costo cuantifica 1pp vía costo", /recuperar 1pp vía costo/.test(mCosto.text) && !!figOf(mCosto, /Palanca · 1pp en /));

console.log("\n── ventas e inventario ──");
const vPpto = A({ schemaVersion: 1, operation: "ventas", metric: "ventas", dimension: "cliente", focus: "vs_presupuesto" }, {}, {});
ok("vs_presupuesto cuantifica cerrar el plan", /Cuánto vale:.*cerrar lo que falta al plan/.test(vPpto.text) && !!figOf(vPpto, /Palanca · cerrar el plan/));
const inv = A({ schemaVersion: 1, operation: "inventory", metric: "capital", dimension: "bodega", focus: "frenado" }, {}, {});
const invLever = figOf(inv, /Palanca · liberar /);
ok("inventario cuantifica liberar los 2 top a caja", /devuelve \$\S+ a caja/.test(inv.text) && !!invLever && invLever.raw > 0);

console.log("\n── el scope heredado («de esos…») recorta también la palanca ──");
const base = { schemaVersion: 1, operation: "overview", metric: "ventas", dimension: "cliente" };
const t1 = AC(C("¿quién sostiene mi contribución?", { ...base }, false), {}, {});
const t2 = AC(C("y de esos, ¿cuáles quedan bajo el margen mínimo?", { ...base }, true), { lastEvidence: t1.evidence }, {});
const leverScoped = figOf(t2, /Palanca · cerrar brecha al piso/);
ok("la palanca scopeada ≤ la palanca de cartera (recortó al bloque)", leverScoped && leverBrecha && leverScoped.raw <= leverBrecha.raw && leverScoped.raw > 0);

console.log("\n── guard × palanca · mandatory bien calibrado (el bug del 30.1% fantasma) ──");
const G = M.guardAgainstBoleta;
// una narración de PALANCAS correcta que NO cita el benchmark (su lectura no lo usa) debe PASAR — antes caía al piso
const narrPal = `Hay +$655K al año si llevás la carga al target del 3.5%: Easy (5.5%), Sodimac (5.4%), Ripley (4.8%) y Falabella (4.5%) están sobre el target. Solo Falabella devuelve +$194K. Yo arrancaría por ahí.`;
const gPal = G(narrPal, bol(mPal));
ok("narración de palancas SIN benchmark pasa el guard (30.1% ya no es obligatoria ahí)", gPal.ok);
// el benchmark SIGUE siendo obligatorio donde la lectura lo cita (bajo_benchmark)
const benchFig = figOf(mBench, /Benchmark de margen/);
ok("bajo_benchmark mantiene el benchmark como obligatorio (su lectura lo cita)", benchFig && benchFig.mandatory === true);
// una narración que OMITE la plata de la palanca cae al piso (la palanca titular es mandatory)
const narrSinPlata = `Ocho de trece clientes están bajo el margen mínimo de 30.1%. El más lejos es Lider con 21.5% (8.6pp).`;
const gSin = G(narrSinPlata, bol(mBench));
ok("narración que omite el $ de la palanca NO pasa (mejor el piso, que la tiene)", !gSin.ok && gSin.missing.length > 0);

console.log("\n── capa CAUSAL del compare · el motor lee, la capa explica (controller senior) ──");
const cmp = A({ schemaVersion: 1, operation: "compare", metric: "margen", dimension: "cliente", comparison: { dimension: "cliente", entities: ["Falabella", "Lider"] } }, {}, {});
ok("el compare trae POR QUÉ ocurre (causa de la brecha: costo vs carga)", /\*\*Por qué ocurre:\*\*/.test(cmp.text));
ok("el compare trae DÓNDE ESTÁ TU PLATA (la no-capturada de cada uno)", /\*\*Dónde está tu plata:\*\*/.test(cmp.text) && /sobre la mesa/.test(cmp.text));
ok("el compare trae LA DECISIÓN (palanca + por cuál empezar)", /\*\*La decisión:\*\*/.test(cmp.text) && /Empezá por/.test(cmp.text));
const cmpFal = figOf(cmp, /Plata en juego · Falabella/);
const diagFal = bol(diag).find((f) => /Contribución no capturada · Falabella/.test(f.label));
ok("una verdad: la plata en juego de Falabella == el ítem del diagnose (mismo raw)", cmpFal && diagFal && cmpFal.raw === diagFal.raw);
ok("las cifras causales son computed + formula auditable", cmpFal && cmpFal.source === "computed" && !!cmpFal.formula);
ok("el valor del punto por entidad está (palanca 1pp en ambos)", !!figOf(cmp, /Palanca · 1pp en Falabella/) && !!figOf(cmp, /Palanca · 1pp en Lider/));

console.log("\n── capa CAUSAL del DIVE (Profundiza en X) · la brecha en pp + la plata gated + la decisión ──");
const dive = A({ schemaVersion: 1, operation: "dive", dimension: "cliente", entity: "Falabella" }, {}, {});
ok("el dive trae POR QUÉ está donde está (brecha en pp descompuesta)", /\*\*Por qué está donde está:\*\*/.test(dive.text) && /pp/.test(dive.text));
ok("el dive trae DÓNDE está la plata + valor del punto", /\*\*Dónde está tu plata:\*\*/.test(dive.text) && /cada punto de margen vale/i.test(dive.text));
ok("el dive trae LA DECISIÓN (palanca dominante)", /\*\*La decisión:\*\*/.test(dive.text) && /palanca/i.test(dive.text));
const divePlata = figOf(dive, /Plata en juego · Falabella/);
ok("una verdad: la plata del dive == el ítem del diagnose (mismo raw)", divePlata && diagFal && divePlata.raw === diagFal.raw);
ok("aritmética honesta: carga sobre target + precio/costo ≈ brecha (mismos pp)", (() => { const g = figOf(dive, /Causa · brecha al piso/), c = figOf(dive, /Causa · carga sobre target/), r = figOf(dive, /Causa · precio\/costo/); return g && r && Math.abs((c ? c.raw : 0) + r.raw - g.raw) < 0.15; })());
const diveTop = A({ schemaVersion: 1, operation: "dive", dimension: "cliente", entity: "La Polar" }, {}, {});
ok("cuenta SOBRE el piso → historia de DEFENDER (no inventa pérdida)", /\*\*Por qué gana:\*\*/.test(diveTop.text) && /defiende|cuidala/i.test(diveTop.text));
const cmpMarca = A({ schemaVersion: 1, operation: "compare", metric: "margen", dimension: "marca", comparison: { dimension: "marca", entities: ["Samsung", "LG"] } }, {}, {});
console.log("\n── EL PERFIL · ADI lee el gráfico (owner 2026-07-08: quién parte arriba · dónde se cruzan · qué explica el cambio) ──");
ok("Falabella vs Lider (dominio con 1 quiebre) → 'único quiebre es CARGA'", /\*\*El perfil:\*\*/.test(cmp.text) && /parte arriba/.test(cmp.text) && /ÚNICO quiebre es CARGA/.test(cmp.text));
ok("el perfil trae el score de estaciones", /gana \d+ estaciones/.test(cmp.text) && /de 5\./.test(cmp.text));
const cmpCross = A({ schemaVersion: 1, operation: "compare", metric: "margen", dimension: "cliente", comparison: { dimension: "cliente", entities: ["ABC", "Unimarc"] } }, {}, {});
ok("ABC vs Unimarc (cruce clásico) → 'las líneas se cruzan en MARGEN' + quién manda después", /las líneas se cruzan en MARGEN/.test(cmpCross.text) && /de ahí manda Unimarc/.test(cmpCross.text));
ok("…y nombra la variable que explica el cambio (la palanca)", /El cambio lo explica la (estructura de costo|carga comercial)/.test(cmpCross.text));
// GARANTÍA 100%: si el narrador omite la trayectoria, la lectura del piso se ANTEPONE; si omite la historia del año
// (owner 2026-07-08: "al profundizar, que diga el porqué — costos, acciones, cuándo"), se APPENDEA (código, no prompt)
const narrSin = "Unimarc es más eficiente que ABC: margen 32.5% vs 31%, con carga 3% vs 3.5% y costo 64.5% vs 65.5% de la lista. Yo revisaría los costos de ABC.";
const picked = M.pickNarratedText(cmpCross, narrSin);
ok("narración SIN trayectoria → 'El perfil:' antepuesto Y 'El año' appendeado (verdict fiel+perfil+año)", picked.narrated && picked.verdict === "fiel+perfil+año" && /^\*\*El perfil:\*\*/.test(picked.text) && /se cruzan en MARGEN/.test(picked.text) && /\*\*El año, mes a mes:\*\*/.test(picked.text));
const narrCon = "ABC parte arriba en ventas pero las líneas se cruzan en margen: de ahí manda Unimarc por su costo (64.5% vs 65.5%), con margen 32.5% vs 31% y carga 3% vs 3.5%.";
ok("narración QUE SÍ lee el gráfico → sin duplicar el perfil; el año del piso se appendea (fiel+año)", (() => { const p = M.pickNarratedText(cmpCross, narrCon); return p.narrated && p.verdict === "fiel+año" && !/^\*\*El perfil:\*\*/.test(p.text) && /\*\*El año, mes a mes:\*\*/.test(p.text); })());
ok("narración que SÍ cuenta el año (mejor mes/acciones) → no se duplica el bloque del año", (() => { const p = M.pickNarratedText(cmpCross, narrCon + " El mejor mes de los dos llega en la temporada alta y las acciones de precios suben hacia el cierre."); return p.narrated && p.verdict === "fiel" && !/\*\*El año, mes a mes:\*\*/.test(p.text); })());
ok("piso SIN historia del año (dive) → no se appendea nada", (() => { const p = M.pickNarratedText(dive, "A Falabella le faltan 8.1pp para tu piso de 30.1% — la palanca es la estructura de costo y cada punto vale plata."); return p.narrated && !/\*\*El año, mes a mes:\*\*/.test(p.text); })());
ok("compare de MARCA también trae causa (estructura precio/costo del eje)", /\*\*Por qué ocurre:\*\*/.test(cmpMarca.text));
ok("compare de MARCA honesto: plata por valor del punto (sin detector gated)", /\*\*Dónde está tu plata:\*\*/.test(cmpMarca.text) && /cada punto de margen vale/i.test(cmpMarca.text) && !/sobre la mesa/.test(cmpMarca.text.split("**Dónde está tu plata:**")[1].split("**")[0]));

console.log("\n── apertura proactiva · los focos del hero = los subtotales del diagnose (una verdad) ──");
const res = M.buildResumenEjecutivo("bonanza");
ok("el resumen emite focos estructurados (detector + $ + label)", Array.isArray(res.focos) && res.focos.length >= 2 && res.focos.every((f) => f.detector && f.usd > 0 && f.usdFmt && f.label));
const resMg = res.focos.find((f) => f.detector === "margen");
ok("foco margen del hero == subtotal del diagnose (mismo raw)", resMg && diagMargen && resMg.usd === diagMargen.raw);
ok("la lectura invita a arrancar («¿Por cuál empezamos?»)", /¿Por cuál empezamos\?/.test(res.lectura));

console.log(`\n── _lever_gate: PASS ${pass} · FAIL ${fail} (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
