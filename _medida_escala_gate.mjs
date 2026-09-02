/* === _medida_escala_gate.mjs · LA ESCALA DE LAS MEDIDAS LA DECLARA EL PACK (owner 2026-09-01) ===============
 *
 * EL DEFECTO QUE CIERRA, medido contra la planilla real del owner: «ELE-CAB25 · Medida cerrar brecha = $937.8M»
 * en un negocio que vende $74.2M el período — 1000× la cuenta real (venta $9.1M · brecha 10.3pp ≈ $937K). La
 * raíz: `venta * 10` ESCRITO A MANO en las Medidas de `marginRead` (toolRegistry) y en `_pp1` del composer de
 * margen (specRetrieval) — asume venta almacenada en miles (×1000 ÷ 100), cierto para los tenants de fábrica y
 * FALSO para un pack de planilla (`escalaComercial: "raw"`). Es el MISMO defecto ya pagado en `datoProyectado`
 * («el ×1000 fijo era correcto para los tenants de fábrica y FALSO para un pack de planilla»), en otros sitios:
 * aquella vez se arregló el sitio; esta vez se arregla LA CLASE y este gate la vigila.
 *
 * EL ARREGLO: la escala sale del pack por la única puerta de la casa (`factorComercialDe` → `_fxT`/`_fxe`),
 * `venta × factor ÷ 100` — con "K" da exactamente ×10, así que el demo NO SE MUEVE UN BYTE (sección 1, contra
 * los valores registrados ANTES del arreglo), y con "raw" da la cuenta verdadera (sección 2, exactos).
 *
 * EL BARRIDO QUE LO ACOMPAÑÓ (cada `* 10`/`* 1000` de la rama de lectura/composición, triaged en el commit):
 * los ×1000 de los composers ejecutivos son conversiones entre unidades FIJAS (M→K, iguales en todo pack) y los
 * `× 1000 / 10` son redondeos de porcentaje — no la enfermedad; `inverse.js` ya usaba el factor (el patrón
 * hecho bien). Los tres sitios enfermos eran las dos Medidas del tool y el `_pp1` del composer.
 *
 * LA CARNADA ES LA HISTORIA DEL DEFECTO: la mutación (restaurar el ×10 fijo) tiene que dar VERDE en el demo y
 * ROJO en la planilla — exactamente cómo se escondió 11 días de exámenes que solo corrían sobre el demo.
 *
 * OFFLINE · determinístico · cero red. `node --import ./scripts/offline-guard.mjs _medida_escala_gate.mjs` */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { plantillaEjemplo } from "./src/ingesta/plantilla/generarPlantilla.js";
import { ingestarPlantilla } from "./src/ingesta/plantilla/ingestarPlantilla.js";
import { TOOLS } from "./src/adi/oracle/toolRegistry.js";
import { runPlan } from "./src/adi/oracle/toolRunner.js";
import { composeSpecMargin } from "./src/adi/specRetrieval.js";

let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };
const H = (t) => console.log("\n" + t);

const PACK_PLANILLA = ingestarPlantilla(Buffer.from(plantillaEjemplo()), { nombreArchivo: "v2.xlsx", fechaCarga: "2026-08-31" }).dataset;
const medidasDe = (registry) => {
  const rp = runPlan({ intent: "answer", calls: [{ tool: "marginRead", args: { dimension: "sku" } }] },
    { scenario: "actual", maxCalls: 2, preguntaUsuario: "medidas", registry });
  const m = new Map();
  for (const f of (rp.ledger && rp.ledger.figs) || []) if (/· Medida (1pp|cerrar brecha)$/.test(f.label)) m.set(f.label, f.raw);
  return m;
};

H("[1] EL DEMO NO SE MUEVE UN BYTE · contra los valores registrados ANTES del arreglo (escala K → factor 1000 → ×10 exacto)");
{
  initTenant(TENANT_DEMO);
  const m = medidasDe(TOOLS);
  // los seis, tal como los publicaba el código viejo el 2026-09-01 (sonda registrada) — igualdad EXACTA, no «parecido»
  const ANTES = [
    ["MAK-COMP-AIR · Medida 1pp", 17000], ["MAK-COMP-AIR · Medida cerrar brecha", 377400],
    ["LG-DRYER8KG · Medida 1pp", 56000], ["LG-DRYER8KG · Medida cerrar brecha", 1064000],
    ["SAM-TV55 · Medida 1pp", 133000], ["SAM-TV55 · Medida cerrar brecha", 1542800],
  ];
  for (const [label, raw] of ANTES) ok(m.get(label) === raw, `${label} = ${raw} (byte-idéntico al pre-arreglo)`, `obtuvo ${m.get(label)}`);
}

H("[2] LA PLANILLA (escala raw) · la cuenta VERDADERA, exacta — antes salía 1000× esto");
{
  initTenant(PACK_PLANILLA);
  ok(PACK_PLANILLA.escalaComercial === "raw", `el pack de planilla declara escalaComercial "raw" (${PACK_PLANILLA.escalaComercial})`);
  const m = medidasDe(TOOLS);
  const ESPERADO = [
    ["TRM-450 · Medida 1pp", 131], ["TRM-450 · Medida cerrar brecha", 1327],
    ["ELE-CAB25 · Medida 1pp", 144], ["ELE-CAB25 · Medida cerrar brecha", 1296],
    ["ELE-TAB12 · Medida 1pp", 116], ["ELE-TAB12 · Medida cerrar brecha", 915],
  ];
  for (const [label, raw] of ESPERADO) ok(m.get(label) === raw, `${label} = $${raw} (venta × 1 ÷ 100 — la moneda cruda del archivo)`, `obtuvo ${m.get(label)}`);
  // cordura relacional en TODOS los SKU publicados: cerrar brecha ≈ 1pp × brecha (misma escala entre sí, en
  // cualquier pack). No reemplaza los exactos de arriba: una regresión que infle AMBAS medidas junta mantiene
  // esta relación — a esa la cazan los exactos y la carnada de abajo.
  let pares = 0, rotos = 0;
  for (const [label, raw] of m) {
    const mm = /^(.+) · Medida cerrar brecha$/.exec(label);
    if (!mm || !Number.isFinite(raw)) continue;
    const pp1 = m.get(`${mm[1]} · Medida 1pp`);
    if (!Number.isFinite(pp1) || pp1 <= 0) continue;
    pares++;
    const brecha = raw / pp1;   // ≈ pp de brecha; si una sola de las dos viniera ×1000, esto daría ~10.000 o ~0,01
    if (brecha < 0.05 || brecha > 60) rotos++;
  }
  ok(pares >= 4 && rotos === 0, `cordura: cerrar brecha ≈ 1pp × brecha en los ${pares} SKU publicados (ninguna medida con la escala torcida a solas)`);
}

H("[3] EL COMPOSER (`_pp1`) · la misma puerta en los dos mundos");
{
  const pp1De = (compose, pack) => {
    initTenant(pack);
    const r = compose({ focus: "alto_volumen_bajo_margen", dimension: "cliente", scenario: "actual" });
    const f = ((r && r.evidence && r.evidence.boleta) || []).find((x) => /· Medida 1pp$/.test(x.label));
    return f ? f.raw : null;
  };
  const demo = pp1De(composeSpecMargin, TENANT_DEMO);
  const planilla = pp1De(composeSpecMargin, PACK_PLANILLA);
  ok(Number.isFinite(demo) && demo > 0, `el foco alto_volumen_bajo_margen publica su Medida 1pp en el demo (${demo})`);
  ok(Number.isFinite(planilla) && planilla > 0 && planilla < 100000,
    `…y en la planilla la medida es de la moneda cruda (${planilla}), no 1000× — un 1pp mayor a $100K en un negocio de decenas de miles sería el defecto de vuelta`);
}

H("[4] LA CARNADA · el ×10 fijo restaurado: VERDE en el demo, ROJO en la planilla — así se escondió");
{
  const tmp = [];
  const mutar = (rel, reemplazos) => {
    const abs = path.join(process.cwd(), rel);
    let txt = fs.readFileSync(abs, "utf8").replace(/\r\n/g, "\n");
    for (const [de, a] of reemplazos) {
      const antes = txt;
      txt = txt.replace(de, a);
      if (txt === antes) return { error: `la carnada no encontró qué mutar en ${rel}` };
    }
    const destino = abs.replace(/\.js$/, `.carnada${process.pid}.js`);
    fs.writeFileSync(destino, txt);
    tmp.push(destino);
    return { url: pathToFileURL(destino).href };
  };
  const m1 = mutar("src/adi/oracle/toolRegistry.js", [
    ["Math.round(row.venta * _fxT() * (bench - row.margen) / 100)", "Math.round(row.venta * 10 * (bench - row.margen))"],
    ["Math.round(row.venta * _fxT() / 100);", "Math.round(row.venta * 10);"],
  ]);
  if (m1.error) ok(false, "carnada «el ×10 fijo vuelve al tool»", m1.error);
  else {
    try {
      const Mut = await import(m1.url);
      initTenant(TENANT_DEMO);
      const demoMut = medidasDe(Mut.TOOLS), demoReal = medidasDe(TOOLS);
      const igualesEnDemo = ["MAK-COMP-AIR · Medida 1pp", "SAM-TV55 · Medida cerrar brecha"].every((l) => demoMut.get(l) === demoReal.get(l));
      initTenant(PACK_PLANILLA);
      const plaMut = medidasDe(Mut.TOOLS);
      ok(igualesEnDemo, "con la mutación el DEMO da EXACTAMENTE lo mismo — el defecto es invisible ahí, por eso vivió meses");
      const mutada = plaMut.get("TRM-450 · Medida cerrar brecha");
      // ~1000× y no «=== ×1000»: el ×10 fijo redondea en otro orden (round(v×10×b) ≠ round(v×b/100)×1000 por unos pesos)
      ok(Number.isFinite(mutada) && mutada !== 1327 && mutada > 1327 * 900,
        `…y en la PLANILLA la mutación publica ~1000× (${mutada} vs 1327): el check exacto de [2] se pone ROJO`);
    } catch (e) { ok(false, "carnada «el ×10 fijo vuelve al tool»", `la copia mutada no carga: ${e.message}`); }
  }
  const m2 = mutar("src/adi/specRetrieval.js", [
    ["Math.round(r.venta * _fxe() / 100) : null);", "Math.round(r.venta * 10) : null);"],
  ]);
  if (m2.error) ok(false, "carnada «el ×10 fijo vuelve al composer»", m2.error);
  else {
    try {
      const Mut2 = await import(m2.url);
      initTenant(PACK_PLANILLA);
      const bolDe = (r) => ((r && r.evidence && r.evidence.boleta) || []).find((x) => /· Medida 1pp$/.test(x.label));
      const f = bolDe(Mut2.composeSpecMargin({ focus: "alto_volumen_bajo_margen", dimension: "cliente", scenario: "actual" }));
      const fr = bolDe(composeSpecMargin({ focus: "alto_volumen_bajo_margen", dimension: "cliente", scenario: "actual" }));
      // ~1000× por la misma razón del tool: round(v×10) ≠ round(v÷100)×1000 por unos pesos
      ok(f && fr && f.raw !== fr.raw && f.raw > fr.raw * 900, `la mutación del _pp1 del composer publica ~1000× en la planilla (${f && f.raw} vs ${fr && fr.raw}): el check [3] se pone ROJO`);
    } catch (e) { ok(false, "carnada «el ×10 fijo vuelve al composer»", `la copia mutada no carga: ${e.message}`); }
  }
  for (const f of tmp) { try { fs.unlinkSync(f); } catch { /* */ } }
}

H("[5] LA PLANILLA REAL DEL OWNER (condicional al archivo) · el caso que originó todo, exacto");
{
  const REAL = "C:/Users/jcnav/Downloads/Plantilla_ADI_v2_completa_25_clientes_ajustada.xlsx";
  if (fs.existsSync(REAL)) {
    const ing = ingestarPlantilla(fs.readFileSync(REAL), { nombreArchivo: "completa.xlsx", fechaCarga: "2026-08-31" });
    if (ing.ok && ing.dataset) {
      initTenant(ing.dataset);
      const m = medidasDe(TOOLS);
      ok(m.get("ELE-CAB25 · Medida cerrar brecha") === 937820,
        "ELE-CAB25 · Medida cerrar brecha = $937.820 — la cuenta real (venta $9.1M × brecha 10.3pp), no los $937.8M del defecto", `obtuvo ${m.get("ELE-CAB25 · Medida cerrar brecha")}`);
      ok(m.get("ELE-CAB25 · Medida 1pp") === 91051, "ELE-CAB25 · Medida 1pp = $91.051 (1% de su venta)", `obtuvo ${m.get("ELE-CAB25 · Medida 1pp")}`);
      ok([...m.values()].every((v) => !Number.isFinite(v) || v < 10000000),
        "ninguna medida de un SKU supera los $10M en un negocio que vende $74.2M el período (la cordura que el defecto rompía por 100×)");
    }
  } else {
    console.log("      (la planilla real del owner no está en esta máquina: 3 checks no corren)");
  }
}

initTenant(TENANT_DEMO);
console.log(`\n── _medida_escala_gate: ${PASS} PASS · ${FAIL} FAIL (de ${PASS + FAIL}) ──`);
process.exit(FAIL ? 1 : 0);
