/* === _materialidad_relativa_gate.mjs · EL PISO ESCUCHA AL TAMAÑO DEL NEGOCIO (owner 2026-08-30) ==============
 *
 * LA DECISIÓN DEL OWNER: «no más monto fijo pensado para $100M — la fuga de 7% de un negocio chico tiene que
 * sonar». El piso de materialidad de los focos comerciales pasa de $50.000 FIJOS a un % DECLARADO de la venta
 * del negocio (POLICY.materialidadFocoPctVenta = 0.05%).
 *
 * LA FORMA, decisión (B) del owner (chat principal 2026-08-30): el % se aplica sobre la venta del ESCENARIO
 * BASE — «la materialidad es una propiedad del negocio, no del lente con que se lo mira». Un negocio de $100M
 * mirando su crisis hipotética sigue siendo un negocio de $100M: la misma fuga no puede aparecer y desaparecer
 * entre pestañas de simulación. Consecuencias gateadas acá:
 *   1 · el demo queda BYTE-IDÉNTICO EN LOS 4 ESCENARIOS (0.05% × $100M = el $50.000 histórico, siempre);
 *   2 · el negocio de $61 mil oye su fuga del 7% (su piso es $31, no $50.000);
 *   3 · el umbral SE DECLARA en pantalla: la rama verde dice «bajo el 0,05% de tu venta: $X» — un silencio
 *       sin su umbral es inauditable desde afuera.
 *
 * OFFLINE · determinístico · no puede gastar.
 * `node --import ./scripts/offline-guard.mjs _materialidad_relativa_gate.mjs`
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { TENANTS } from "./src/data/tenants/index.js";
import { plantillaEjemplo } from "./src/ingesta/plantilla/generarPlantilla.js";
import { ingestarPlantilla } from "./src/ingesta/plantilla/ingestarPlantilla.js";
import { setCriterion, forgetCriterion } from "./src/adi/criteria.js";
import { buildMesaEstado } from "./src/adi/sentrix/mesa.js";
import { composeSpecDiagnose, declaracionUmbralFocos } from "./src/adi/specRetrieval.js";
import { POLICY_CONFIG } from "./src/config/businessPolicy.js";

let pass = 0, fail = 0;
const ok = (cond, label, detalle) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label}`); if (detalle !== undefined) console.log(`      ${detalle}`); }
};
const H = (t) => console.log(`\n${t}`);
const PACK = ingestarPlantilla(Buffer.from(plantillaEjemplo()), { nombreArchivo: "v2.xlsx", fechaCarga: "2026-08-31" }).dataset;

/* ═══ 1 · LA DECLARACIÓN Y SU DERIVACIÓN ══════════════════════════════════════════════════════════════════════ */
H("1 · el piso es un % DECLARADO que reproduce el histórico sobre el negocio de referencia");
{
  ok(POLICY_CONFIG.materialidadFocoPctVenta === 0.05, "POLICY declara materialidadFocoPctVenta = 0.05 (%)");
  initTenant(TENANT_DEMO);
  const ventaDemoRaw = TENANT_DEMO.clientesVentas.reduce((s, c) => s + c.actual, 0) * 1000;   // K declarada
  const piso = ventaDemoRaw * 0.05 / 100;
  ok(piso === 50000, `0.05% × la venta del demo ($${ventaDemoRaw / 1e6}M) = $${piso} — EXACTO el piso histórico`, String(piso));
  ok(declaracionUmbralFocos() === "bajo el 0,05% de tu venta: $50K",
    "y la frase declarada del demo lo dice con su cifra", declaracionUmbralFocos());
  initTenant(TENANTS.empresa2);
  ok(declaracionUmbralFocos() === "bajo el 0,05% de tu venta: $29K",
    "empresa-2 ($58M de venta) declara SU umbral: $29K — el piso escucha al tamaño", declaracionUmbralFocos());
}

/* ═══ 2 · EL DEMO, BYTE POR BYTE, EN LOS 4 ESCENARIOS ═════════════════════════════════════════════════════════ */
H("2 · el demo no se mueve EN NINGÚN escenario: el piso es del negocio, no del lente (decisión B)");
{
  initTenant(TENANT_DEMO);
  const CARDS = {
    actual:  { contrib: "$4.9M sin capturar contra tu benchmark · $656K de carga sobre el target", margen: "5 pp bajo tu benchmark (30.1%)" },
    bonanza: { contrib: "$4.9M sin capturar contra tu benchmark · $655K de carga sobre el target", margen: "5 pp bajo tu benchmark (30.1%)" },
    tension: { contrib: "$7.2M sin capturar contra tu benchmark · $1.3M de carga sobre el target", margen: "8.1 pp bajo tu benchmark (30.1%)" },
    crisis:  { contrib: "$9.5M sin capturar contra tu benchmark · $2.3M de carga sobre el target", margen: "11.7 pp bajo tu benchmark (30.1%)" },
  };
  for (const [esc, exp] of Object.entries(CARDS)) {
    const m = buildMesaEstado(esc);
    ok(m.estados.contribucion.linea === exp.contrib, `[${esc}] card de contribución byte-idéntica`, m.estados.contribucion.linea);
    ok(m.estados.margen.linea === exp.margen, `[${esc}] card de margen byte-idéntica`, m.estados.margen.linea);
    const d = composeSpecDiagnose({ scenario: esc });
    ok(d && d.evidence.findings.length === 3, `[${esc}] el diagnóstico sigue con sus 3 focos`);
  }
}

/* ═══ 3 · EL NEGOCIO CHICO POR FIN SUENA ══════════════════════════════════════════════════════════════════════ */
H("3 · la fuga del 7% de un negocio de $61 mil ya no es «sin fugas materiales»");
{
  initTenant(PACK);
  const m = buildMesaEstado("actual");
  ok(!/sin fugas materiales/.test(m.estados.contribucion.linea),
    "la card dejó de silenciar la fuga", m.estados.contribucion.linea);
  ok(/\$\d+K? sin capturar/.test(m.estados.contribucion.linea) && /de carga sobre el target/.test(m.estados.contribucion.linea),
    "y dice las dos cifras en la escala del archivo", m.estados.contribucion.linea);
  ok(!/\$\d+(\.\d+)?M/.test(m.estados.contribucion.linea), "sin millones inventados — la escala sigue sana");
  const d = composeSpecDiagnose({ scenario: "actual" });
  const focos = (d && d.evidence && d.evidence.findings) || [];
  ok(focos.length > 0, `el diagnóstico del pack tiene focos (${focos.length}) — antes tenía cero`);
  const montos = focos.flatMap((f) => (f.items || []).map((i) => i.usd));
  ok(montos.length > 0 && montos.every((u) => u > 0 && u < 61483), "cada monto es real y menor que la venta total del negocio", montos.join(", "));
}

/* ═══ 4 · EL UMBRAL SE DECLARA EN PANTALLA ════════════════════════════════════════════════════════════════════ */
H("4 · la rama verde dice QUÉ es material para ESTE negocio — el silencio deja de ser inauditable");
{
  // el pack chico llevado a verde con criterios C.2 del usuario (vara al mínimo, target al máximo): la card
  // verde REAL de un negocio REAL — no un fixture — declara su umbral con su cifra ($31 = 0,05% de $61.483).
  initTenant(PACK);
  setCriterion("margen_minimo", 5);
  setCriterion("target_carga", 15);
  const m = buildMesaEstado("actual");
  ok(m.estados.contribucion.estado === "verde", "con la vara del usuario relajada, la card es verde");
  ok(m.estados.contribucion.linea === "sin fugas materiales contra tu benchmark (bajo el 0,05% de tu venta: $31)",
    "★ y el verde DECLARA su umbral con la cifra de ESTE negocio", m.estados.contribucion.linea);
  forgetCriterion("todo");
}

/* ═══ 5 · CARNADAS ════════════════════════════════════════════════════════════════════════════════════════════ */
H("5 · CARNADA · el candado se prueba con el defecto adentro");
{
  const tmp = [];
  let nCarnada = 0;
  const mutar = (rel, reemplazos) => {
    const abs = path.join(process.cwd(), rel);
    let txt = fs.readFileSync(abs, "utf8").replace(/\r\n/g, "\n");
    for (const [de, a] of reemplazos) {
      const antes = txt;
      txt = txt.replace(de, a);
      if (txt === antes) return { error: `la carnada no encontró qué mutar en ${rel}` };
    }
    const destino = abs.replace(/\.js$/, `.carnada${process.pid}_${++nCarnada}.js`);
    fs.writeFileSync(destino, txt);
    tmp.push(destino);
    return { url: pathToFileURL(destino).href };
  };
  const carnada = async (nombre, rel, reemplazos, prueba) => {
    const m = mutar(rel, reemplazos);
    if (m.error) return ok(false, `carnada «${nombre}»`, m.error);
    let cazada = false, detalle = "";
    try { cazada = await prueba(await import(m.url)); }
    catch (e) { detalle = `la copia mutada ni siquiera carga: ${e.message}`; }
    ok(cazada, `carnada «${nombre}» → el chequeo se pone ROJO`, detalle || "el defecto pasó DESAPERCIBIDO");
  };

  // (a) el piso fijo de vuelta: el negocio chico vuelve a quedar mudo
  await carnada("piso fijo de $50.000 de vuelta", "src/adi/specRetrieval.js",
    [[/const _pisoFocosUSD = \(source, vField\) => \{[\s\S]*?\n\};/,
      "const _pisoFocosUSD = () => 50000;"]],
    async (Mut) => {
      initTenant(PACK);
      const d = Mut.composeSpecDiagnose({ scenario: "actual" });
      return !d || !((d.evidence && d.evidence.findings) || []).length;   // el defecto: cero focos para el negocio chico
    });

  // (b) el piso en cero: el demo admite el ruido que el piso existe para filtrar
  await carnada("piso anulado (ruido admitido)", "src/adi/specRetrieval.js",
    [[/return totalRaw \* \(\(POLICY\.materialidadFocoPctVenta \?\? 0\.05\) \/ 100\);/, "return 0;"]],
    async (Mut) => {
      initTenant(TENANT_DEMO);
      const sano = composeSpecDiagnose({ scenario: "actual" });
      const mutado = Mut.composeSpecDiagnose({ scenario: "actual" });
      const items = (x) => (((x && x.evidence && x.evidence.findings) || [])).reduce((s2, f2) => s2 + ((f2.items || []).length), 0);
      return items(mutado) > items(sano);   // sin piso entran los clientes chicos que el demo filtraba
    });

  // (c) LA PROPIEDAD B: el piso que mira el escenario del lente en vez de la realidad — la misma fuga
  //     aparecería y desaparecería entre pestañas de simulación (en crisis la venta baja → el piso baila
  //     → entran items nuevos → el diagnóstico de crisis del demo deja de ser el de siempre).
  await carnada("piso por escenario (baila entre pestañas)", "src/adi/specRetrieval.js",
    [[/const _pisoFocosUSD = \(source, vField\) => \{\n  const base = _loadReal\(source\);[^\n]*\n/,
      "const _pisoFocosUSD = (source, vField, esc) => {\n  const base = _load(source, esc);\n"],
     [/const piso = _pisoFocosUSD\(vSF\.source, vSF\.field\);/,
      "const piso = _pisoFocosUSD(vSF.source, vSF.field, scenario);"]],
    async (Mut) => {
      initTenant(TENANT_DEMO);
      const sano = JSON.stringify(composeSpecDiagnose({ scenario: "crisis" }));
      const mutado = JSON.stringify(Mut.composeSpecDiagnose({ scenario: "crisis" }));
      return mutado !== sano;   // el defecto: el demo en crisis ya no es byte-idéntico — el piso siguió al lente
    });

  // (d) el verde que vuelve a callarse el umbral — la pantalla pierde la declaración
  await carnada("el verde sin su umbral declarado", "src/adi/sentrix/mesa.js",
    [[/`sin fugas materiales contra tu benchmark \(\$\{declaracionUmbralFocos\(\)\}\)`/,
      "\"sin fugas materiales contra tu benchmark\""]],
    async (Mut) => {
      initTenant(PACK);
      setCriterion("margen_minimo", 5);
      setCriterion("target_carga", 15);
      const m = Mut.buildMesaEstado("actual");
      forgetCriterion("todo");
      return m.estados.contribucion.estado === "verde" && !/bajo el 0,05% de tu venta/.test(m.estados.contribucion.linea);
    });

  for (const f of tmp) { try { fs.unlinkSync(f); } catch { /* */ } }
}

initTenant(TENANT_DEMO);
console.log(`\n── _materialidad_relativa_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
