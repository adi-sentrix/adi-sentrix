/* === _narrativa_del_dato_gate.mjs · LA NARRATIVA SALE DEL DATO, NO DE UN GUION (owner 2026-08-30) ============
 *
 * LA AUTORIZACIÓN, textual: «si autorizado!» — decisión (B): las cadenas narrativas por escenario de
 * composeModuleOverview/V2 (bonanza=crecimiento, tensión=meseta, crisis=ruptura — la película del DEMO) se
 * colapsan a UNA narrativa data-driven para TODOS los tenants. El defecto que cierra era de la clase más grave:
 * un pack de planilla con venta −0.9% recibía «Las ventas crecen −0.9% YoY» (DIRECCIÓN INVERTIDA — la falta
 * sagrada) y causas con reparto inventado («Tier 1», «canal digital», «e-commerce», «Materiales de
 * Construcción» — cuentas de OTRO negocio).
 *
 * LAS DOS LEYES DEL CIERRE (condiciones del owner, cada una con carnada):
 *   1 · LA DIRECCIÓN SALE DEL SIGNO: «crecen/caen» jamás contradice la cifra.
 *   2 · CERO ENTIDADES INVENTADAS: la narrativa solo nombra lo que el pack trae.
 * Y el demo CAMBIA texto visible con esta autorización: sus literales nuevos quedan acá como expectativa.
 *
 * OFFLINE · determinístico · no puede gastar.
 * `node --import ./scripts/offline-guard.mjs _narrativa_del_dato_gate.mjs`
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { plantillaEjemplo } from "./src/ingesta/plantilla/generarPlantilla.js";
import { ingestarPlantilla } from "./src/ingesta/plantilla/ingestarPlantilla.js";
import { composeModuleOverview, composeModuleOverviewV2 } from "./src/adi/composers/overview.js";
import { answerADI } from "./src/adi/answerADI.js";   // R1: etlg se prueba por el camino REAL (el prepend del 16/0)

let pass = 0, fail = 0;
const ok = (cond, label, detalle) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label}`); if (detalle !== undefined) console.log(`      ${detalle}`); }
};
const H = (t) => console.log(`\n${t}`);
const PACK = ingestarPlantilla(Buffer.from(plantillaEjemplo()), { nombreArchivo: "v2.xlsx", fechaCarga: "2026-08-31" }).dataset;
// el reparto de la película del demo — nada de esto puede aparecer narrado sobre un pack que no lo tiene
const GUION = /Tier 1|Tier 2|canal digital|e-commerce|canales tradicionales|Materiales de Construcci|L[ií]nea Blanca/;
const textoDe = (r) => [r && r.opener, ...(r && Array.isArray(r.suggestions) ? r.suggestions : [])].filter(Boolean).join("\n");

/* ═══ 1 · LA DIRECCIÓN SALE DEL SIGNO ═════════════════════════════════════════════════════════════════════════ */
H("1 · «crecen/caen» lo dice la cifra — pack en caída dice «caen», demo en alza dice «crecen»");
{
  initTenant(PACK);
  const p = composeModuleOverviewV2("bonanza", "ventas").opener;
  ok(/Las ventas caen -0\.9% YoY\./.test(p), "★ el pack con venta −0.9% dice «Las ventas caen -0.9% YoY.»", p.split("\n")[0]);
  ok(!/crecen/.test(p.split("\n")[0]), "…y su titular jamás dice «crecen»");
  initTenant(TENANT_DEMO);
  const d = composeModuleOverviewV2("bonanza", "ventas").opener;
  ok(/Las ventas crecen \+7\.6% YoY\./.test(d), "el demo con venta +7.6% dice «crecen» — la dirección se preservó donde el dato crece", d.split("\n")[0]);
}

/* ═══ 2 · CERO ENTIDADES INVENTADAS ═══════════════════════════════════════════════════════════════════════════ */
H("2 · la narrativa del pack solo nombra lo que el pack trae");
{
  initTenant(PACK);
  const textos = [];
  for (const mod of ["ventas", "margenes", "inventario"]) {
    textos.push(textoDe(composeModuleOverview("bonanza", mod)));
    textos.push(textoDe(composeModuleOverviewV2("bonanza", mod)));
  }
  const cuerpo = textos.join("\n");
  ok(!GUION.test(cuerpo), "ni Tier 1/2, ni canal digital, ni e-commerce, ni categorías del demo", (cuerpo.match(GUION) || []).join(", "));
  ok(/Depósito Riachuelo/.test(cuerpo), "…y sí nombra las cuentas de ESTE negocio (la contracara: no se resolvió enmudeciendo)");
}

/* ═══ 3 · EL DEMO, REPINTADO CON AUTORIZACIÓN ═════════════════════════════════════════════════════════════════ */
H("3 · los literales nuevos del demo — cambio visible AUTORIZADO por el owner («si autorizado!»)");
{
  initTenant(TENANT_DEMO);
  const v = composeModuleOverviewV2("bonanza", "ventas").opener;
  ok(v.includes("Total $100.0M · variación $7.1M · top 3 (Falabella, Lider, Jumbo) concentran 54.6% · Mercado Libre crece +25.3% con carga 1.8% · La Polar cae -12.5%."),
    "ventas: cifras y cuentas del dato, caída incluida (antes el guion la callaba)", v);
  ok(v.includes("La dinámica de la cartera depende de pocas cuentas."), "…concentración AFIRMADA porque 54.6% ≥ 50 la sostiene");
  const m = composeModuleOverviewV2("bonanza", "margenes").opener;
  ok(m.includes("8 de 13 cuentas operan bajo tu benchmark."),
    "márgenes: población CONTADA del dato donde el guion decía «se concentra en Tier 1»", m);
  ok(m.includes("Negociaría primero la carga comercial de Falabella · luego la de Lider."),
    "…y la oferta nombra la segunda palanca REAL donde decía «Tier 2»");
  const i = composeModuleOverviewV2("bonanza", "inventario").opener;
  ok(i.includes("El inmovilizado está repartido entre familias."),
    "inventario: 35.1% < 50 ⇒ NO se afirma concentración (el guion la clavaba siempre)", i);
}

/* ═══ 2-bis · LOS CASOS DEGENERADOS (R7 del retrabajo ultracode) ══════════════════════════════════════════════
 * EL ONBOARDING ESPERADO: el primer archivo de un cliente real trae UN mes, sin año anterior ni presupuesto.
 * La narrativa colapsada CRASHEABA ahí (pct1 sobre null · división por anterior=0 → Infinity) y el inventario
 * se contradecía («$0 inmovilizado» junto a «X concentra 53.7% del inmovilizado» — el filtro literal 'Activo'
 * contra el KPI del motor). La regla: degradar HONESTO en palabras, jamás reventar ni inventar dirección. */
H("2-bis · el primer archivo de un mes no revienta la cara — declina en palabras");
{
  const c0 = PACK.clientesVentas[0];
  const MINI = { ...PACK,
    clientesVentas: [{ ...c0, anterior: 0, unidadesAnt: 0, presupuesto: 0 }],
    clientesMargen: PACK.clientesMargen.filter((m) => m.nombre === c0.nombre),
    ventasKPI: { ...PACK.ventasKPI, totalActual: c0.actual, totalAnterior: null, vsAnterior: null, totalPresupuesto: null, vsPresupuesto: null },
  };
  initTenant(MINI);
  let v;
  try { v = composeModuleOverviewV2("bonanza", "ventas"); } catch (e) { v = { opener: `💥 ${e.message}` }; }
  ok(!/💥/.test(v.opener), "★ ventas de UN mes: la cara compone (antes: crash `null.toFixed`)", v.opener.slice(0, 90));
  ok(/sin período anterior declarado para comparar/.test(v.opener), "…y la variación se DECLINA en palabras");
  ok(!/Infinity|NaN|crecen|caen/.test(v.opener), "…sin Infinity/NaN ni una dirección inventada");
  const m = composeModuleOverviewV2("bonanza", "margenes");
  ok(!/mientras|opera con margen/.test(m.opener.split("\n")[1] || "") || !new RegExp(`${c0.nombre}[^\\n]*${c0.nombre}`).test(m.opener),
    "márgenes con UN cliente: no se compara consigo mismo", m.opener.split("\n")[1]);
  const i = composeModuleOverviewV2("bonanza", "inventario");
  ok(/Sin capital inmovilizado material\./.test(i.opener) && !/concentra \d+(\.\d+)?% del capital inmovilizado/.test(i.opener),
    "★ inventario con KPI en $0: cero narrativa de concentración (la contradicción murió)", i.opener.replace(/\n+/g, " § ").slice(0, 140));
  ok(/Inmovilizado \$0 ·/.test(i.opener), "…y $0 se muestra SIN sufijo K (bajo 1000 el valor no está en miles)");
  initTenant(TENANT_DEMO);
}

/* ═══ 3-bis · LA SÉPTIMA CADENA: etlg (R1 del retrabajo ultracode) ════════════════════════════════════════════ */
H("3-bis · la tesis ejecutiva (etlg) sale del dato o no sale — las cifras clavadas murieron");
{
  initTenant(PACK);
  const rP = await answerADI("márgenes", [], {}, "bonanza");
  const tP = String((rP && (rP.text || rP.opener)) || "");
  ok(!/25\.6/.test(tP.split("\n")[0]), "★ el pack ya NO abre con el 25.6% clavado del guion", tP.split("\n")[0]);
  ok(/22\.4%/.test(tP.split("\n")[0]), "…abre con SU margen real (22.4%) — el opener data-driven de C7", tP.split("\n")[0]);
  ok(!GUION.test(tP), "…y sin el reparto del demo (Tier 1 y compañía)");
  const rV = await answerADI("ventas", [], {}, "bonanza");
  const tV = String((rV && (rV.text || rV.opener)) || "");
  ok(!/\+7\.6%|crecieron \+7\.6/.test(tV.split("\n")[0]) || /caen -0\.9%/.test(tV.split("\n")[0]),
    "ventas del pack: sin el «+7.6%» clavado — la dirección es la del dato", tV.split("\n")[0]);
  initTenant(TENANT_DEMO);
  const rD = await answerADI("márgenes", [], {}, "bonanza");
  ok(/25\.6%/.test(String((rD && (rD.text || rD.opener)) || "").split("\n")[0]),
    "el demo dice 25.6% porque ES su cifra (del dato, ya no del mapa clavado)");
}

/* ═══ 4 · CARNADAS ════════════════════════════════════════════════════════════════════════════════════════════ */
H("4 · CARNADA · las dos leyes, probadas ROJAS con el defecto adentro");
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

  // (a0 · R7) el guard de división quitado: el onboarding de un mes vuelve a reventar/inventar
  await carnada("división por anterior=0 de vuelta (Infinity en el onboarding)", "src/adi/composers/overview.js",
    [[/\.filter\(c => c\.anterior > 0 && c\.actual > c\.anterior\)/g, ".filter(c => c.actual > c.anterior)"]],
    async (Mut) => {
      const c0 = PACK.clientesVentas[0];
      initTenant({ ...PACK,
        clientesVentas: [{ ...c0, anterior: 0, unidadesAnt: 0, presupuesto: 0 }],
        clientesMargen: PACK.clientesMargen.filter((m) => m.nombre === c0.nombre),
        ventasKPI: { ...PACK.ventasKPI, totalActual: c0.actual, totalAnterior: null, vsAnterior: null, totalPresupuesto: null, vsPresupuesto: null } });
      try { return /Infinity|NaN/.test(Mut.composeModuleOverviewV2("bonanza", "ventas").opener); }
      catch { return true; }   // reventar también es el defecto
    });

  // (a) LA CARNADA DEL OWNER: una variación negativa narrada con «crecen»
  await carnada("dirección invertida — «crecen» incondicional", "src/adi/composers/overview.js",
    [[/const _dirVentas = !_hayGrowth \? null\n      : growth > 0\.5 \? `crecen \$\{pct1\(growth\)\} YoY`\n      : growth < -0\.5 \? `caen \$\{pct1\(growth\)\} YoY`\n      : `están prácticamente planas YoY \(\$\{pct1\(growth\)\}\)`;/,
      "const _dirVentas = `crecen ${pct1(growth)} YoY`;"]],
    async (Mut) => {
      initTenant(PACK);
      const t = Mut.composeModuleOverviewV2("bonanza", "ventas").opener;
      return /crecen -0\.9%/.test(t);   // el defecto: la caída narrada como crecimiento
    });

  // (b) LA OTRA CARNADA DEL OWNER: el reparto inventado de vuelta («Tier 1» sobre un pack que no lo tiene)
  await carnada("Tier 1 de vuelta en la lectura de márgenes", "src/adi/composers/overview.js",
    [[/const b4 = `\$\{_nBajoBench\} de \$\{marg\.length\} cuentas operan bajo tu benchmark\.`;/,
      "const b4 = `La presión sobre margen se concentra en Tier 1.`;"]],
    async (Mut) => {
      initTenant(PACK);
      return /Tier 1/.test(Mut.composeModuleOverviewV2("bonanza", "margenes").opener);
    });

  // (b2 · R1) el guion de etlg re-escrito de memoria: el mapa de cifras clavadas de vuelta → el pack vuelve a
  //     leer «25.6%» como primera línea → rojo. La carnada inyecta la plantilla muerta COMPLETA (verbatim).
  await carnada("el mapa clavado de etlg resucitado", "src/adi/etlg.js",
    [[/const ETLG_THESIS_TEMPLATES = \{/,
      `const ETLG_THESIS_TEMPLATES = {
  module_overview_margenes: {
    requires_concepts: [],
    bonanza: (params) => \`El margen está en \${params.actualMargin}%, bajo tu benchmark · la diferencia viene de la carga comercial sobre las cuentas Tier 1.\`,
    resolve_params: (scenario) => ({ actualMargin: ({ bonanza: "25.6", tension: "22.4", crisis: "18.9" })[scenario] || "25.6" }),
  },`]],
    async (Mut) => {
      initTenant(PACK);
      const meta = { intent_id: null, intent_type: null, archetype: null, concepts: [], modulo: "margenes", client_name: null, tier: "module_overview" };
      const r = Mut.executiveThesisLineGenerator({ opener: "x", suggestions: null, sentrixAction: null }, meta, "bonanza");
      return !!(r && r.shouldApply && /25\.6/.test(r.thesisLine || ""));   // el defecto: la cifra clavada volvió a nacer
    });

  // (c) la categoría del demo escrita a mano de vuelta en el OPENER (las sugerencias tienen su propia defensa:
  //     filterTextualSuggestions ya filtra entidades que el tenant no tiene — verificado: una sugerencia
  //     hardcodeada ni sale. El opener NO pasa por ese filtro, así que la carnada muerde donde el riesgo vive.)
  await carnada("categoría del demo hardcodeada en el opener", "src/adi/composers/overview.js",
    [[/const b5 = inmovUSD <= 0 \? `Revisaría rotación por familia\.`[^\n]*\n      : topCatName\n      \? `Atacaría primero los SKUs de \$\{topCatName\} · luego revisaría rotación por familia\.`\n      : `Atacaría primero los SKUs de la categoría más concentrada · luego revisaría rotación por familia\.`;/,
      "const b5 = `Atacaría primero los SKUs de Materiales de Construcción · luego revisaría rotación por familia.`;"]],
    async (Mut) => {
      initTenant(PACK);
      return /Materiales de Construcci/.test(Mut.composeModuleOverviewV2("bonanza", "inventario").opener || "");
    });

  for (const f of tmp) { try { fs.unlinkSync(f); } catch { /* */ } }
}

initTenant(TENANT_DEMO);
console.log(`\n── _narrativa_del_dato_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
