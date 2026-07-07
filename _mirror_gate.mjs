/* === _mirror_gate.mjs · GATE del ESPEJO Sentrix↔ADI (Frente B · owner 2026-07-07) ===
 * El panel pinta EXACTAMENTE lo que ADI nombró, no solo el dominio. La fuente de verdad de "lo nombrado" es la BOLETA
 * (cada cifra por entidad que ADI dijo lleva su nombre en el label) → isNamedInBoleta es el predicado que la UI usa.
 * Lockea: (1) las entidades que el texto nombra dan true y las no-nombradas dan false (precisión, no "todo prendido") ·
 * (2) un "de esos…" scopeado marca evidence.scopedInherited (el chip del panel) y uno normal NO · (3) nombres cortos
 * no producen falsos positivos. */
import esbuild from "esbuild"; import { pathToFileURL } from "url"; import path from "path"; import fs from "fs";
const root = process.cwd(); const entry = path.join(root, "_mge.js"), out = path.join(root, "_mgb.mjs");
fs.writeFileSync(entry, [
  'export { coerceSpec } from "./src/adi/coerceChain.js";',
  'export { answerConversational } from "./src/adi/conversation.js";',
  'export { answerADIFromSpec } from "./src/adi/answerADIFromSpec.js";',
  'export { isNamedInBoleta } from "./src/adi/boleta.js";',
].join("\n"));
await esbuild.build({ entryPoints: [entry], bundle: true, outfile: out, format: "esm", platform: "node", logLevel: "silent" });
const M = await import(pathToFileURL(out).href + "?t=" + Math.random());
try { fs.unlinkSync(entry); } catch {} try { fs.unlinkSync(out); } catch {}
const { coerceSpec: C, answerConversational: AC, answerADIFromSpec: A, isNamedInBoleta: N } = M;

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log("  ✓ " + n); } else { fail++; console.log("  ✗ " + n); } };

console.log("── el punto celeste = lo que el TEXTO de ADI nombró (preciso, no todo prendido) ──");
// Definición del punto: "lo que ADI nombró CON CIFRA PROPIA" (labels de boleta). El sufijo proactivo del motor puede
// nombrar una entidad extra con cifra de label pelado (cobertura) → esa NO lleva punto (limitación conocida, no mentira).
const mB = A({ schemaVersion: 1, operation: "margin", metric: "margen", dimension: "cliente", focus: "bajo_benchmark" }, {}, {});
const bolM = mB.evidence.boleta, rowsM = mB.evidence.margin.panel.rows.map((r) => r.nombre);
const namedM = rowsM.filter((n) => N(bolM, n));
const textNames = rowsM.filter((n) => mB.text.includes(n));
ok("margen: todo punto corresponde a algo que el texto dice (cero puntos falsos)", namedM.length > 0 && namedM.every((n) => textNames.includes(n)));
ok("margen: los 5 que la LECTURA nombra llevan punto (el composer, espejo exacto)", ["Lider", "Falabella", "Sodimac", "Jumbo", "Ripley"].every((n) => namedM.includes(n)));
ok("margen: NO todo prendido (hay filas del panel que ADI no nombró)", namedM.length < rowsM.length);
const inv = A({ schemaVersion: 1, operation: "inventory", metric: "capital", dimension: "bodega", focus: "frenado" }, {}, {});
const bolI = inv.evidence.boleta, skus = inv.evidence.inventory.bySku.map((s) => s.sku);
ok("inventario: los SKU del texto dan true", skus.some((s) => N(bolI, s)) && skus.filter((s) => inv.text.includes(s)).every((s) => N(bolI, s)));
const cont = A({ schemaVersion: 1, operation: "contribucion", metric: "contribucion", dimension: "cliente", focus: "concentracion" }, {}, {});
const bolC = cont.evidence.boleta, rowsC = cont.evidence.contribucion.panel.rows.map((r) => r.nombre);
ok("contribución: nombradas ⊆ filas del panel y > 0", rowsC.filter((n) => N(bolC, n)).length > 0);

console.log("\n── el chip del alcance heredado (scopedInherited) ──");
const base = { schemaVersion: 1, operation: "overview", metric: "ventas", dimension: "cliente" };
const t1 = AC(C("¿quién sostiene mi contribución?", { ...base }, false), {}, {});
ok("respuesta normal NO marca scopedInherited", !t1.evidence.scopedInherited);
const t2 = AC(C("y de esos, ¿cuáles quedan bajo el margen mínimo?", { ...base }, true), { lastEvidence: t1.evidence }, {});
ok("«de esos…» scopeado SÍ marca scopedInherited (el chip del panel)", t2.evidence.scopedInherited === true);
ok("el scopeado sigue emitiendo entityList (la cadena no se corta)", !!(t2.evidence.entityList && t2.evidence.entityList.entities.length));

console.log("\n── robustez del predicado ──");
ok("nombre corto (<3) → false (sin falsos positivos)", !N([{ label: "cliente · XY margen" }], "XY"));
ok("boleta vacía/ausente → false", !N([], "Falabella") && !N(null, "Falabella"));

console.log(`\n── _mirror_gate: PASS ${pass} · FAIL ${fail} (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
