/* === _tenant_gate.mjs · GATE MULTIEMPRESA (F1 · 2026-07-26 · mandato del owner: "las pruebas con un
 * segundo dataset las hagas tú mismo, corrobores… valida todas estas cosas") ===
 * LA PRUEBA DE FUEGO permanente del rumbo multiempresa, con el fixture empresa-2 (Distribuidora Andina —
 * otro rubro · 8 clientes · SIN canal · CON venta por bodega · benchmark 26.0):
 *   [A] Sentinel del demo ANTES de tocar nada (respuestas capturadas byte-a-byte).
 *   [B] initTenant(empresa2) → disponibilidad data-driven (bodega APARECE sola · canal DESAPARECE solo) ·
 *       Σ P&L == negocio EXACTO por eje × 3 escenarios · canon/coerce con SUS entidades · menú del LLM sin
 *       ejes fantasma · validador del contrato APTO · CERO fuga de entidades del demo en lo emitido.
 *   [C] initTenant(demo) → el sentinel repite BYTE-IGUAL (reversibilidad — el demo no queda tocado).
 *   [D] La matriz completa (240 celdas) y el espejo corren sobre empresa-2 vía ADI_TENANT (hijos).
 * REGLA DE ORO: si algo falla acá, el fix va SIEMPRE en el producto (des-hardcodear), jamás en el fixture.
 * Determinístico · sin key. */
import esbuild from "esbuild"; import { pathToFileURL } from "url"; import path from "path"; import fs from "fs";
import { execSync } from "child_process";
const root = process.cwd(); const entry = path.join(root, `_tne.tmp${process.pid}.js`), out = path.join(root, `_tnb.tmp${process.pid}.mjs`);
fs.writeFileSync(entry, [
  'export { initTenant } from "./src/data/tenantStore.js";',
  'export { TENANTS } from "./src/data/tenants/index.js";',
  'export { answerADIFromSpec } from "./src/adi/answerADIFromSpec.js";',
  'export { pnlDisponibilidad, setPnlLines, clearPnl, resetPnlDraft, buildPnlCascade, pnlDefined, activePnl, composePnl } from "./src/adi/pnl.js";',
  'export { POLICY, benchmarkOf, tenantPolicyDefault } from "./src/config/businessPolicy.js";',
  'export { setCriterion, forgetCriterion, activeCriteria } from "./src/adi/criteria.js";',
  'export { buildMesaResultado } from "./src/adi/sentrix/mesaResultado.js";',
  'export { axisAvailable } from "./src/config/contract/entityRegistry.js";',
  'export { coerceSpec } from "./src/adi/coerceChain.js";',
  'export { buildContractMenu } from "./src/adi/llm/contractMenu.js";',
  'export { validateDataset } from "./src/config/contract/validator.js";',
  'export * as theme from "./src/ui/theme.js";',
].join("\n"));
await esbuild.build({ entryPoints: [entry], bundle: true, outfile: out, format: "esm", platform: "node", logLevel: "silent" });
const M = await import(pathToFileURL(out).href + "?t=" + Math.random());
try { fs.unlinkSync(entry); } catch { /* */ } try { fs.unlinkSync(out); } catch { /* */ }
const { initTenant, TENANTS, answerADIFromSpec: A, pnlDisponibilidad, setPnlLines, clearPnl, resetPnlDraft,
        buildPnlCascade, buildMesaResultado, axisAvailable, coerceSpec, buildContractMenu, validateDataset,
        pnlDefined, activePnl, composePnl, POLICY, benchmarkOf, setCriterion, forgetCriterion } = M;

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; console.log(`  ✓ ${msg}`); } else { fail++; console.log(`  ✗ ${msg}`); } };
const S = (o) => ({ schemaVersion: 1, scenario: "actual", ...o });
const LINES = [{ nombre: "Logística", pct: 3 }, { nombre: "Marketing", pct: 1.5 }, { nombre: "Promotores", pct: 2 }];
const EPS = 1e-6;

// ── [A] SENTINEL DEL DEMO · lo que el demo responde HOY, capturado antes de cualquier switch ──
console.log("[A] SENTINEL del demo (pre-switch)");
// vía 1 (2026-08-20): el sentinel se captura sobre un demo DECLARADO, no sobre el que traía el import por defecto.
// `tenantStore` ya no importa ningún dataset (esos imports metían el dato de todas las empresas en el bundle
// publicado), así que sin esta línea el sentinel se tomaría sobre la forma vacía y [C] compararía peras con nada.
initTenant(TENANTS.demo);
const SENTINEL_SPECS = [
  ["overview ventas@cliente", S({ operation: "overview", metric: "ventas", dimension: "cliente" })],
  ["rank contribucion@marca", S({ operation: "rank", metric: "contribucion", dimension: "marca", limit: 3 })],
  ["dive cliente Falabella", S({ operation: "dive", dimension: "cliente", entity: "Falabella" })],
  ["rank capital@bodega", S({ operation: "rank", metric: "capital", dimension: "bodega", limit: 3 })],
  ["overview margen@familia", S({ operation: "overview", metric: "margen", dimension: "familia" })],
  ["compare ventas cliente×2", S({ operation: "compare", metric: "ventas", dimension: "cliente", comparison: { dimension: "cliente", entities: ["Falabella", "Lider"] } })],
];
const snap = () => SENTINEL_SPECS.map(([tag, spec]) => { const r = A(spec, {}, {}); return [tag, (r && r.route) + "::" + (r && r.text)]; });
const before = snap();
ok(before.every(([, t]) => t && t.length > 20), "6 respuestas sentinel del demo capturadas");
const menuDemo = buildContractMenu();

// ── [B] EMPRESA-2 · initTenant y el shape nuevo ──
console.log("[B] initTenant(empresa2) · Distribuidora Andina");
initTenant(TENANTS.empresa2);

// [B0] F2 · EL PERFIL DE LA EMPRESA aplicado en init (POLICY resuelto perfil ?? config · ANTES de tocar el P&L)
console.log("[B0] F2 · perfil de empresa aplicado en init");
ok(POLICY.targetCarga === 4 && POLICY.bestPracticeCarga === 3.5, "perfil: target de carga 4% · best practice 3.5% (los de ESTA empresa, no 3.5/3.0 del config)");
ok(POLICY.margenBrechaMaterial === 2 && POLICY.rotacionMin === 2.5 && POLICY.dohMax === 90, "perfil: brecha material 2pp · rotación 2.5x · cobertura 90d");
ok(POLICY.benchmark === 26 && benchmarkOf({}) === 26, "perfil: benchmark de cartera 26.0 (fallback para filas sin benchmark — una verdad con el por-fila)");
const pnlPerfil = activePnl();
ok(pnlDefined() && pnlPerfil.length === 2 && pnlPerfil.every((l) => l.origen === "perfil_empresa"),
   "perfil: el P&L del rubro viene armado de entrada (2 líneas · origen perfil_empresa)");

// disponibilidad data-driven del P&L: bodega APARECE (venta por bodega en SU base) · canal/sku NO
const dispo = Object.fromEntries(pnlDisponibilidad().map((d) => [d.eje, d.available]));
ok(dispo.cliente === true && dispo.marca === true && dispo.familia === true, "P&L: cliente/marca/familia disponibles");
ok(dispo.bodega === true, "P&L: el eje BODEGA APARECE solo (la base trae venta por bodega)");
ok(dispo.sku === false, "P&L: SKU sigue declarado sin desglose (honesto)");
ok(dispo.canal === false, "P&L: canal sin desglose en esta empresa");

// el eje canal DESAPARECE del universo (dato sin campo canal)
ok(axisAvailable("canal") === false, "axisAvailable: canal NO existe en esta empresa");
ok(axisAvailable("bodega") === true && axisAvailable("cliente") === true, "axisAvailable: bodega y cliente existen");

// menú del LLM: no enseña canal · el P&L ofrece bodega
const menu = buildContractMenu();
const ejesLine = (menu.split("\n").find((l) => l.startsWith("EJES disponibles")) || "");
ok(!/canal/.test(ejesLine), "menú LLM: la línea de EJES no ofrece canal");
ok(!/Retail|E-commerce/.test(menu), "menú LLM: sin valores de canal del demo");
ok(/DISPONIBLE por [^\n]*bodega/.test(menu), "menú LLM: el P&L declara bodega DISPONIBLE (aparece sola)");

// Σ P&L == NEGOCIO · exacto · por CADA eje disponible × 3 escenarios (la promesa madre del P&L)
clearPnl(); resetPnlDraft(); setPnlLines(LINES.map((l) => ({ ...l })));
const ejesDisp = pnlDisponibilidad().filter((d) => d.available && d.eje !== "cliente").map((d) => d.eje);
for (const scn of ["bonanza", "tension", "crisis"]) {
  const neg = buildPnlCascade(scn);
  let allOk = true;
  for (const eje of ["cliente", ...ejesDisp]) {
    const c = buildPnlCascade(scn, null, { dimension: eje });
    const sv = c.porEntidad.reduce((s, e) => s + e.ventaK, 0);
    const sc = c.porEntidad.reduce((s, e) => s + e.contribK, 0);
    const sr = c.porEntidad.reduce((s, e) => s + e.resultadoK, 0);
    if (Math.abs(sv - neg.ingresoK) > EPS || Math.abs(sc - neg.contribK) > EPS || Math.abs(sr - neg.resultadoK) > EPS) {
      allOk = false; console.log(`      Σ${eje}@${scn}: venta ${sv} vs ${neg.ingresoK} · contrib ${sc} vs ${neg.contribK} · resultado ${sr} vs ${neg.resultadoK}`);
    }
  }
  ok(allOk, `Σ P&L == negocio EXACTO en ${scn} (ejes: cliente, ${ejesDisp.join(", ")})`);
}
// la cara Resultado (Mesa) con el eje bodega: el cuadro cierra con el negocio
const mrB = buildMesaResultado("bonanza", "bodega");
ok(mrB && mrB.defined && mrB.cuadro && mrB.cuadro.eje === "bodega" && mrB.cuadro.rows.length === 3,
   "Mesa/cara Resultado: cuadro por BODEGA con las 3 bodegas de esta empresa");
const negB = buildPnlCascade("bonanza");
ok(mrB && Math.abs(mrB.cuadro.total.resultado - negB.resultadoK) < 0.51, "Mesa: el Total del cuadro por bodega cierra con el resultado del negocio");

// canon/coerce: el LLM emite minúsculas → el canon de ESTA empresa resuelve (coerceSpec = el camino real)
const specLower = coerceSpec("¿cómo está distribuidora los ríos?", S({ operation: "dive", dimension: "cliente", entity: "distribuidora los ríos" }), false);
ok(specLower && specLower.entity === "Distribuidora Los Ríos", "canon: 'distribuidora los ríos' (minúscula) resuelve a su forma real");
const dive = A(specLower || S({ operation: "dive", dimension: "cliente", entity: "Distribuidora Los Ríos" }), {}, {});
ok(dive && /Distribuidora Los Ríos/.test(dive.text || ""), "dive con el canon resuelto responde con SU nombre");
const ov = A(S({ operation: "overview", metric: "ventas", dimension: "cliente" }), {}, {});
ok(ov && /Supermercados del Valle/.test(ov.text || ""), "overview ventas@cliente nombra SUS clientes");
const rkB = A(S({ operation: "rank", metric: "capital", dimension: "bodega", limit: 3 }), {}, {});
ok(rkB && /Bodega (Norte|Centro|Sur)/.test(rkB.text || ""), "rank capital@bodega responde con SUS bodegas");

// KNOWN_ENTITIES (highlighter) re-armado en init
ok(Array.isArray(M.theme.KNOWN_ENTITIES) && M.theme.KNOWN_ENTITIES.length === 8 && M.theme.KNOWN_ENTITIES.includes("Comercial Aconcagua"),
   "KNOWN_ENTITIES re-armado: los 8 clientes de esta empresa");

// CERO FUGA del demo en lo emitido con empresa-2 activa
const DEMO_LEAK = /\b(Falabella|Lider|Jumbo|Sodimac|Tottus|Mercado Libre|Ripley|La Polar|Hites|Unimarc|Samsung|Philips|Bosch|Makita|Electrodom[eé]sticos|L[ií]nea Blanca|Cuidado Personal|Materiales de Construcci[oó]n|Santiago|Valpara[ií]so|Concepci[oó]n|Antofagasta|Retail|E-commerce)\b/;
const emitidos = [dive, ov, rkB].map((r) => (r && r.text) || "").join("\n") + "\n" + menu;
ok(!DEMO_LEAK.test(emitidos), "cero fuga: ninguna entidad del demo en respuestas/menú de empresa-2");

// el validador del contrato valida EL DATO DE ESTA EMPRESA al entrar (F3 hará esto en el loader)
const rep = validateDataset("ci");
ok(rep.apt === true && rep.counts.blocker === 0,
   `validador del contrato: empresa-2 APTA · 0 blockers (warnings ${rep.counts.warning} · info ${rep.counts.info})`);
if (rep.counts.blocker) for (const b of rep.findings.blocker.slice(0, 6)) console.log(`      BLOCKER [${b.rule}] ${b.where || ""} ${b.msg}`);

// ── [B2] F2 · el criterio C.2 GANA sobre el perfil · forget vuelve al default DEL TENANT · scope ida-y-vuelta ──
console.log("[B2] F2 · C.2 sobre el perfil · scope por tenant");
setCriterion("margen_minimo", 28);
ok(POLICY.benchmark === 28 && benchmarkOf({ benchmark: 26 }) === 28, "C.2 gana: margen mínimo 28 pisa el perfil (26) y el por-fila");
setCriterion("target_carga", 5);
ok(POLICY.targetCarga === 5, "C.2 gana: target de carga 5% pisa el 4% del perfil");
forgetCriterion("todo");
ok(POLICY.benchmark === 26 && POLICY.targetCarga === 4 && benchmarkOf({}) === 26,
   "«olvidá todo» vuelve a la vara DEL TENANT (26 · 4%), no al config (30.1 · 3.5%)");
// P&L: quitar la declaración vuelve a la base del perfil, con la voz honesta
setPnlLines(LINES.map((l) => ({ ...l })));
const rForget = composePnl({ action: "forget" }, null, { scenario: "bonanza" });
ok(/perfil de tu empresa/.test((rForget && rForget.text) || "") && pnlDefined() && activePnl().every((l) => l.origen === "perfil_empresa"),
   "«olvida mi P&L» quita TU declaración y vuelve al perfil del rubro — declarado honesto");
// «armemos mi P&L» sobre el perfil → abre el REARME guiado (no promete un «partir de cero» que el forget no cumple)
const rStart = composePnl({ action: "start" }, null, { scenario: "bonanza" });
ok(/perfil de tu empresa/.test((rStart && rStart.text) || "") && /selles el tuyo/.test((rStart && rStart.text) || ""),
   "«armemos mi P&L» con perfil → rearme guiado sobre esa base (sin promesa falsa de «partir de cero»)");
resetPnlDraft();
// la política del perfil en lo EMITIDO (no solo en POLICY): el foco de carga del diagnose sale del TARGET DEL
// PERFIL — con 4%, Aconcagua aporta (5%−4%)×$11.5M = $115K; con el 3.5% del config serían otras cifras
// ($172K/$70K/$72K). La cifra emitida prueba la vara usada.
// PISO RELATIVO (owner 2026-08-30): la materialidad es 0.05% de la venta REAL del negocio — para empresa-2
// ($58M) el piso es $29.000, no el $50.000 pensado para el demo de $100M. Con su propio piso, El Puerto
// ($36K de carga sobre target) DEJA DE SER MUDO: el foco pasa de único a dos cuentas, $151K en total.
// Ese cambio de cifra es la decisión del owner operando, no una regresión.
const dg = A(S({ operation: "diagnose", metric: "contribucion", dimension: "cliente" }), {}, {});
ok(dg && /Carga comercial alta: \$151K/.test(dg.text || "") && /Comercial Aconcagua \$115K/.test(dg.text || "")
   && /Mayorista El Puerto \$36K/.test(dg.text || ""),
   "diagnose con la vara del perfil (4%) y el piso del negocio ($29K): Aconcagua $115K + El Puerto $36K");
// IDA-Y-VUELTA · lo del usuario en empresa-2 NO viaja al demo — y vuelve intacto al regresar
setCriterion("margen_minimo", 27);
setPnlLines(LINES.map((l) => ({ ...l })));
initTenant(TENANTS.demo);
ok(POLICY.benchmark === 30.1 && POLICY.targetCarga === 3.5 && benchmarkOf({}) === 30.1,
   "demo tras el switch: POLICY con SU perfil (30.1 · 3.5%) — la vara 27 de empresa-2 no arrastra");
ok(!pnlDefined(), "demo tras el switch: sin líneas — ni la declaración de empresa-2 ni el perfil ajeno");
initTenant(TENANTS.empresa2);
ok(POLICY.benchmark === 27 && activePnl().length === 3 && activePnl().every((l) => l.origen === "supuesto_declarado"),
   "de vuelta en empresa-2: SU criterio (27) y SU declaración (3 líneas) siguen ahí");
forgetCriterion("todo"); clearPnl(); resetPnlDraft();

// ── [C] REVERSIBILIDAD · el demo vuelve BYTE-IGUAL ──
console.log("[C] initTenant(demo) · el demo vuelve intacto");
clearPnl(); resetPnlDraft();
initTenant(TENANTS.demo);
ok(POLICY.benchmark === 30.1 && POLICY.targetCarga === 3.5 && POLICY.margenBrechaMaterial === 4 && POLICY.dohMax === 120,
   "F2: POLICY del demo restaurada completa (30.1 · 3.5% · 4pp · 120d)");
setPnlLines(LINES.map((l) => ({ ...l })));   // mismo estado P&L que en [A]... el sentinel no usa P&L, pero dejamos simetría
clearPnl(); resetPnlDraft();
const after = snap();
let identicos = 0;
for (let i = 0; i < before.length; i++) if (before[i][1] === after[i][1]) identicos++; else console.log(`      ≠ ${before[i][0]}`);
ok(identicos === before.length, `sentinel demo BYTE-IGUAL tras ida y vuelta (${identicos}/${before.length})`);
ok(buildContractMenu() === menuDemo, "menú LLM del demo byte-igual tras ida y vuelta");
const repDemo = validateDataset("demo");
ok(repDemo.apt === true, "validador: demo sigue APTO");

// ── [D] LA MATRIZ COMPLETA + EL ESPEJO corren sobre empresa-2 (hijos vía ADI_TENANT) ──
console.log("[D] matriz 240 celdas + espejo sobre empresa-2 (hijos)");
const child = (cmd) => { try { execSync(cmd, { stdio: "pipe", env: { ...process.env, ADI_TENANT: "empresa2" } }); return true; } catch { return false; } };
ok(child("node _matrix_gate.mjs"), "matriz empresa-2: 0 ROTAS · 0 ERROR (exit 0)");
ok(child("node _espejo_gate.mjs"), "espejo empresa-2: 0 espejos rotos (exit 0)");

console.log(`\n── _tenant_gate: PASS ${pass} · FAIL ${fail} (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
