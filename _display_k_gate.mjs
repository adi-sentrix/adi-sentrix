/* === _display_k_gate.mjs · BAJO $1M SE MUESTRA EN K (owner 2026-08-30: «$87K, nunca $0.1M») ==================
 *
 * LA DECISIÓN DEL OWNER: un monto chico forzado a millones pierde toda resolución — el negocio de $61 mil veía
 * «$0.1M» de venta y «$0.0M» de contribución donde debía leer «$61K» y «$14K». Bajo $1M el sufijo es K; sobre
 * $1M todo queda byte-idéntico a siempre (el demo de $100M no se mueve).
 *
 * Cubre los formateadores MÓDULO-lado que eran siempre-M: `_M` de resumenComercial · `fmtM` (×2) de overview ·
 * `fmt` de contribution. Los 4 de SentrixPanel (fMon · money del cuadro · fmV ×2) son JSX y los vigila el
 * chequeo textual de `_escala_pantalla_gate` §4, actualizado con este mismo porqué.
 *
 * OFFLINE · determinístico · no puede gastar.
 * `node --import ./scripts/offline-guard.mjs _display_k_gate.mjs`
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { plantillaEjemplo } from "./src/ingesta/plantilla/generarPlantilla.js";
import { ingestarPlantilla } from "./src/ingesta/plantilla/ingestarPlantilla.js";
import { buildResumenComercial } from "./src/adi/sentrix/resumenComercial.js";
import { composeModuleOverview } from "./src/adi/composers/overview.js";
import { composeClientContributionRanking } from "./src/adi/composers/contribution.js";

let pass = 0, fail = 0;
const ok = (cond, label, detalle) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label}`); if (detalle !== undefined) console.log(`      ${detalle}`); }
};
const H = (t) => console.log(`\n${t}`);
const PACK = ingestarPlantilla(Buffer.from(plantillaEjemplo()), { nombreArchivo: "v2.xlsx", fechaCarga: "2026-08-31" }).dataset;
// el defecto que este gate existe para impedir: un monto en «$0.XM» (cero coma algo millones)
const CERO_M = /\$-?0\.\d+M/;

/* ═══ 1 · EL NEGOCIO CHICO HABLA EN SU ESCALA ═════════════════════════════════════════════════════════════════ */
H("1 · el pack de $61 mil dice K, nunca «$0.XM»");
{
  initTenant(PACK);
  const R = buildResumenComercial("actual");
  const kv = Object.fromEntries(R.kpis.map((k) => [k.key, k.valor]));
  ok(kv.ventas === "$61K" && kv.contribucion === "$14K" && kv.acciones === "$2K",
    "los KPI del resumen comercial: $61K · $14K · $2K", JSON.stringify(kv));
  ok(!CERO_M.test(JSON.stringify(R)), "y NINGUNA cifra del resumen es «$0.XM»");

  const ov = composeModuleOverview("actual", "ventas");
  ok(/Total \$61K/.test(ov.opener || ""), "overview de ventas: «Total $61K»", (ov.opener || "").slice(0, 120));
  ok(!CERO_M.test(ov.opener || ""), "…sin «$0.XM» en el opener");
  const om = composeModuleOverview("actual", "margenes");
  ok(/concentra \$1K en carga/.test(om.opener || ""), "overview de márgenes: la carga chica en K", (om.opener || "").slice(0, 160));

  const cr = composeClientContributionRanking("actual");
  ok(/aportan \$14K de contribución/.test(cr.opener || "") && /Contribución \$5K/.test(cr.opener || ""),
    "ranking de contribución: «$14K» agregada y «$5K» del top", (cr.opener || "").slice(0, 120));
  ok(!CERO_M.test(cr.opener || ""), "…sin «$0.XM» en el ranking");
}

/* ═══ 2 · EL DEMO SIGUE EN M, BYTE POR BYTE ═══════════════════════════════════════════════════════════════════
 * CORRECCIÓN (retrabajo ultracode, corte del fast-path 2026-08-30): esta sección certificaba el mundo «actual»
 * — QUE NADIE SIRVE (la app corre la base declarada). Confesado en la medición del fast-path y corregido: los
 * literales son ahora los del MUNDO SERVIDO. Con el atajo muerto, el ranking dice $25.03M/$4.27M — las cifras
 * D8-reconciliadas que la Mesa también suma (mismo crudo 25028, dos formatos: $25.0M / $25.03M). */
H("2 · sobre $1M nada cambió: el demo, literal, EN EL MUNDO SERVIDO");
{
  initTenant(TENANT_DEMO);
  const R = buildResumenComercial("bonanza");
  const kv = Object.fromEntries(R.kpis.map((k) => [k.key, k.valor]));
  ok(kv.ventas === "$99.9M" && kv.contribucion === "$25.0M" && kv.acciones === "$4.1M",
    "los KPI del demo servido: $99.9M · $25.0M · $4.1M", JSON.stringify(kv));
  const ov = composeModuleOverview("bonanza", "ventas");
  ok(/Total \$100\.0M · variación \$7\.1M/.test(ov.opener || ""), "overview del demo: «Total $100.0M · variación $7.1M»");
  const cr = composeClientContributionRanking("bonanza");
  ok(/aportan \$25\.03M de contribución/.test(cr.opener || "") && /Contribución \$4\.27M/.test(cr.opener || ""),
    "ranking del demo servido: «$25.03M» y «$4.27M» — las cifras D8-reconciliadas (el atajo pre-D8 murió)");
}

/* ═══ 3 · CARNADAS ════════════════════════════════════════════════════════════════════════════════════════════ */
H("3 · CARNADA · cada formateador, probado ROJO con el siempre-M de vuelta");
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

  // (a) resumenComercial._M vuelve a siempre-M: el KPI del chico vuelve a «$0.1M»
  await carnada("_M del resumen siempre-M de vuelta", "src/adi/sentrix/resumenComercial.js",
    [[/const _M = \(raw\) => \(typeof raw === "number" \? \(Math\.abs\(raw\) >= 1e6 \? `\$\{simboloMoneda\(\)\}\$\{\(raw \/ 1e6\)\.toFixed\(1\)\}M` : `\$\{simboloMoneda\(\)\}\$\{Math\.round\(raw \/ 1e3\)\}K`\) : "—"\);/,
      "const _M = (raw) => (typeof raw === \"number\" ? `${simboloMoneda()}${(raw / 1e6).toFixed(1)}M` : \"—\");"]],
    async (Mut) => {
      initTenant(PACK);
      const R = Mut.buildResumenComercial("actual");
      return CERO_M.test(JSON.stringify(R.kpis));   // el defecto: el negocio chico otra vez en «$0.XM»
    });

  // (b) los DOS fmtM de overview pierden la rama K: la venta del chico vuelve a millones sin resolución
  await carnada("fmtM de overview sin rama K (los dos)", "src/adi/composers/overview.js",
    [[/\n *if \(Math\.abs\(m\) < 1\) return `\$\{simboloMoneda\(\)\}\$\{Math\.round\(m \* 1000\)\}K`;/g, ""]],
    async (Mut) => {
      initTenant(PACK);
      const o1 = Mut.composeModuleOverview("actual", "ventas");
      const o2 = Mut.composeModuleOverview("actual", "margenes");
      return CERO_M.test(o1.opener || "") && CERO_M.test(o2.opener || "");   // ambas películas rotas = ambas cazadas
    });

  // (c) contribution.fmt siempre-M: el ranking del chico vuelve a «$0.01M»
  await carnada("fmt de contribución siempre-M de vuelta", "src/adi/composers/contribution.js",
    [[/\{ const m = _enM\(val\); return Math\.abs\(m\) >= 1 \? `\$\{simboloMoneda\(\)\}\$\{m\.toFixed\(2\)\}M` : `\$\{simboloMoneda\(\)\}\$\{Math\.round\(m \* 1000\)\}K`; \}/,
      "return `${simboloMoneda()}${_enM(val).toFixed(2)}M`;"]],
    async (Mut) => {
      initTenant(PACK);
      const cr = Mut.composeClientContributionRanking("actual");
      return CERO_M.test(cr.opener || "");
    });

  for (const f of tmp) { try { fs.unlinkSync(f); } catch { /* */ } }
}

initTenant(TENANT_DEMO);
console.log(`\n── _display_k_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
