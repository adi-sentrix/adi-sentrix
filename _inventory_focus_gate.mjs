/* === _inventory_focus_gate.mjs · GATE end-to-end del FOCO de inventario ("la pregunta manda el foco" · owner 2026-07-06) ===
 * Cada test es una PREGUNTA real → recorre el camino COMPLETO: (1) detectInventoryFocus (el cerebro del coerce) elige la
 * punta · (2) answerADIFromSpec ejecuta el spec ya coerceado y produce la RESPUESTA. Cierra los huecos que el smoke en vivo
 * encontró: capital@familia degradaba (axis) · "90 días" se leía como simulación · exceso/sobrestock respondían frenado. */
import esbuild from "esbuild"; import { pathToFileURL } from "url"; import path from "path"; import fs from "fs";
const root = process.cwd(); const entry = path.join(root, "_ife.js"), out = path.join(root, "_ifb.mjs");
fs.writeFileSync(entry, [
  'export { detectInventoryFocus } from "./src/adi/inventoryFocus.js";',
  'export { answerADIFromSpec } from "./src/adi/answerADIFromSpec.js";',
  'export { coerceSpec } from "./src/adi/coerceChain.js";',
].join("\n"));
await esbuild.build({ entryPoints: [entry], bundle: true, outfile: out, format: "esm", platform: "node", logLevel: "silent" });
const M = await import(pathToFileURL(out).href + "?t=" + Math.random());
try { fs.unlinkSync(entry); } catch {} try { fs.unlinkSync(out); } catch {}
const { detectInventoryFocus: F, answerADIFromSpec: A, coerceSpec: CC } = M;

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log("  ✓ " + n); } else { fail++; console.log("  ✗ " + n); } };
const S = (o) => ({ schemaVersion: 1, scenario: "actual", ...o });
const ans = (spec) => { const r = A(spec, {}, {}); return (r && (r.text || r.opener)) || ""; };

console.log("── (1) detectInventoryFocus · la pregunta elige la punta ──");
ok("Q1 capital inmovilizado → frenado", (() => { const f = F("¿Qué SKU tienen capital inmovilizado?"); return f.isInventory && f.focus === "frenado"; })());
ok("Q2 reposición urgente → quiebre", (() => { const f = F("¿Qué familias necesitan reposición urgente?"); return f.isInventory && f.focus === "quiebre"; })());
ok("Q3 bodegas exceso → sobrestock", (() => { const f = F("¿Qué bodegas tienen exceso?"); return f.isInventory && f.focus === "sobrestock"; })());
ok("Q4 +90 días sin venderse → stale · staleDays=90", (() => { const f = F("¿Qué SKU llevan más de 90 días sin venderse?"); return f.isInventory && f.focus === "stale" && f.staleDays === 90; })());
ok("Q5 mayor sobrestock → sobrestock", (() => { const f = F("¿Dónde está el mayor sobrestock?"); return f.isInventory && f.focus === "sobrestock"; })());
ok("simulación de nivel ('subí el capital 10%') NO es inventario (deja simular)", F("¿cuánto libero si bajo el capital 10%?").isInventory === false);
ok("pregunta no-inventario ('compará Falabella con Lider') → isInventory false", F("compará Falabella con Lider").isInventory === false);

console.log("\n── (2) answerADIFromSpec · la RESPUESTA lidera con la punta pedida ──");
// frenado (default) — respuesta previa intacta
const rFre = ans(S({ operation: "inventory", metric: "capital", dimension: "bodega", focus: "frenado" }));
ok("frenado → lede 'capital inmovilizado' + $33K + Valparaíso", /capital inmovilizado/i.test(rFre) && /\$33K/.test(rFre) && /Valpara/.test(rFre));
ok("frenado → contrapunta honesta menciona 'riesgo de quiebre'", /riesgo de quiebre/i.test(rFre));

// quiebre (reposición) — capital@FAMILIA ya NO degrada por eje (#4 exención) + lidera con quiebre
const rQ = ans(S({ operation: "inventory", metric: "capital", dimension: "familia", focus: "quiebre" }));
ok("quiebre@familia NO degrada por eje ('no lo tengo por familia' ausente)", !/no lo tengo por/i.test(rQ));
ok("quiebre → lede de reposición ('reposición' o 'se van a cortar')", /reposici[oó]n|se van a cortar|al l[íi]mite/i.test(rQ));
ok("quiebre → nombra la familia del quiebre (Electrodomésticos)", /Electrodom/i.test(rQ));
ok("quiebre → contrapunta menciona 'capital frenado'", /capital frenado/i.test(rQ));

// sobrestock (exceso)
const rS = ans(S({ operation: "inventory", metric: "capital", dimension: "bodega", focus: "sobrestock" }));
ok("sobrestock → lede de exceso ('sobrestock' + 'cobertura')", /sobrestock/i.test(rS) && /cobertura/i.test(rS));
ok("sobrestock → NO lidera con 'capital inmovilizado'", !/^Ten[eé]s .* capital inmovilizado/i.test(rS.split("\n")[0]));

// stale (+90 días) — antes DEGRADABA a "supuesto no habilitado"; ahora responde
const rT = ans(S({ operation: "inventory", metric: "capital", dimension: "sku", focus: "stale", staleDays: 90 }));
ok("stale → responde 'sin una sola venta en más de 90 días' (NO degrada a simulación)", /90 d[ií]as/i.test(rT) && !/no est[aá] habilitado|supuesto/i.test(rT));
ok("stale → identifica 2 SKU parados +90d", (() => { const m = rT.match(/Hay (\d+) SKU sin una sola venta/i); return m && Number(m[1]) === 2; })());

// Q4 EXACTO como llega del LLM en vivo: operation inventory + transform{unit:days} → el guard pct-only NO lo hijackea a simular
const rT2 = ans(S({ operation: "inventory", metric: "capital", dimension: "sku", focus: "stale", staleDays: 90, transform: { kind: "assumption", op: "delta", value: 90, unit: "days", base: "real" } }));
ok("Q4 con transform espurio {unit:days} → NO cae en simulación · responde stale", /90 d[ií]as/i.test(rT2) && !/no est[aá] habilitado/i.test(rT2));

// regresión: una simulación REAL (unit:pct) sigue proyectando (no la rompimos)
const rSim = ans(S({ operation: "table", metric: "capital", dimension: "bodega", transform: { kind: "assumption", op: "delta", value: -10, unit: "pct", base: "real" } }));
ok("regresión · simulación real (capital -10% unit:pct) sigue ejecutando (Actual/Supuesto/Δ)", /supuesto|proyec|Δ|delta|-10/i.test(rSim) && !/no est[aá] habilitado/i.test(rSim));

// CRUCE ranking×inventario (owner 2026-07-09: "inventario disponible de los 5 principales SKU de ventas"
// respondía el foco default de capital frenado — coherente pero de OTRA pregunta)
console.log("\n── (3) cruce top-vendedores × inventario ──");
const sTop = CC("cuál es mi inventario disponible de los 5 principales sku de ventas", S({ operation: "inventory", metric: "capital", dimension: "sku" }), false);
ok("coerce · la pregunta del owner → focus top_sellers · limit 5", sTop.focus === "top_sellers" && sTop.limit === 5);
const rTop = ans(sTop);
ok("responde el CRUCE (top por venta con su stock) y NO el foco de capital frenado", /que m[aá]s venden/i.test(rTop) && /stock \d+ unidades/i.test(rTop) && !/capital inmovilizado/i.test(rTop));
ok("el top-1 por venta es SAM-TV55 con su venta real ($13.3M) y su estado del motor (Lento)", /SAM-TV55: vende \$13\.3M/.test(rTop) && /Lento/.test(rTop));
ok("los 5 del ranking real están (TV55 · WASH11KG · SHAVER9 · REF500L · HAIR-PRO)", ["SAM-TV55", "LG-WASH11KG", "PHI-SHAVER9", "SAM-REF500L", "PHI-HAIR-PRO"].every((s) => rTop.includes(s)));
ok("lectura con voz: el top vendedor frenado se marca (plata parada donde más duele)", /donde m[aá]s duele/i.test(rTop));
const sTop3 = CC("stock de mis 3 productos más vendidos", S({ operation: "inventory", metric: "capital", dimension: "sku" }), false);
ok("variante '3 productos más vendidos' → top_sellers · limit 3", sTop3.focus === "top_sellers" && sTop3.limit === 3);
ok("sin frase de ranking ('capital inmovilizado') NO roba el foco", (() => { const s = CC("¿Qué SKU tienen capital inmovilizado?", S({ operation: "inventory", metric: "capital", dimension: "sku" }), false); return s.focus !== "top_sellers"; })());

console.log(`\n── _inventory_focus_gate: PASS ${pass} · FAIL ${fail} (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
