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

console.log(`\n── _lever_gate: PASS ${pass} · FAIL ${fail} (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
