/* === _cifra_canonica_lider_gate.mjs · REGRESIÓN DEL DEFECTO 5 (owner 2026-08-11) =============================
 * Las DOS rutas reales que llevan la venta de Lider tienen que traer el MISMO `raw` y el MISMO texto formateado.
 * Sin red, sin LLM, sin llamadas pagadas.
 *
 * ── EL DEFECTO ────────────────────────────────────────────────────────────────────────────────────────────────
 * La misma conversación mostró «Lider · Ventas» = $17.9M en un turno y = $17.8M en otro, las dos autorizadas por
 * la boleta y las dos con `raw: null`. El dato de origen es UNO —`clientesVentas.actual` y `clientesMargen.venta`
 * valen 17843 los dos—: lo que había eran dos emisores formateando por su cuenta, uno sin declarar el valor
 * canónico. Sin `raw` no queda con qué reconciliar, y el usuario ve dos cifras para el mismo hecho.
 *
 * ── POR QUÉ ESTE GATE Y NO UN MURO ────────────────────────────────────────────────────────────────────────────
 * Se escribió un chequeo de contradicción en guardC y se RETIRÓ: producía falsos positivos sobre boletas
 * legítimas en tres formas distintas. La causa raíz se cierra en el emisor (entityRecord declara `raw`), y esta
 * regresión es la que impide que vuelva a abrirse — compara las dos rutas de verdad, no una simulación.
 *
 * `node --import ./scripts/offline-guard.mjs _cifra_canonica_lider_gate.mjs`
 */
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { runPlan } from "./src/adi/oracle/toolRunner.js";
import { applyScenarioToClientesVentas, applyScenarioToClientesMargen } from "./src/engine/scenarios.js";

initTenant(TENANT_DEMO);
let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };
const H = (t) => console.log("\n" + t);

const figsDe = (tool, args, scenario) => {
  const r = runPlan({ intent: "answer", calls: [{ tool, args }] }, { scenario, maxCalls: 6 });
  return (r && r.ledger && Array.isArray(r.ledger.figs)) ? r.ledger.figs : [];
};
const ventaDe = (figs) => figs.find((f) => /^Lider · Ventas?$/i.test(String(f.label || "")));

H("[1] EL DATO DE ORIGEN ES UNO SOLO · las dos fuentes coinciden en el ledger crudo");
for (const scn of ["bonanza", "tension", "crisis"]) {
  const cv = applyScenarioToClientesVentas(scn).find((x) => x.nombre === "Lider");
  const cm = applyScenarioToClientesMargen(scn).find((x) => x.nombre === "Lider");
  ok(!!cv && !!cm && cv.actual === cm.venta,
    `${scn}: clientesVentas.actual (${cv && cv.actual}) === clientesMargen.venta (${cm && cm.venta})`);
}

H("[2] LAS DOS RUTAS REALES · mismo `raw` y mismo texto formateado");
for (const scn of ["bonanza", "tension", "crisis"]) {
  const a = ventaDe(figsDe("entityRecord", { dimension: "cliente", entity: "Lider" }, scn));
  const b = ventaDe(figsDe("marginRead", { dimension: "cliente", entity: "Lider" }, scn));
  ok(!!a, `${scn}: entityRecord emite la venta de Lider`, a ? "" : "no la emitió");
  if (!a) continue;
  // EL VALOR CANÓNICO TIENE QUE VIAJAR. Sin `raw` no hay nada que comparar, y ése era exactamente el defecto.
  ok(typeof a.raw === "number" && Number.isFinite(a.raw),
    `${scn}: entityRecord declara el `.concat("`raw`").concat(` canónico (${a.raw})`), JSON.stringify(a));
  const cv = applyScenarioToClientesVentas(scn).find((x) => x.nombre === "Lider");
  ok(a.raw === cv.actual * 1000, `${scn}: ese `.concat("`raw`").concat(` es el dato de origen en escala del ledger (${cv.actual} × 1000)`));
  if (b) {
    ok(b.raw == null || a.raw === b.raw, `${scn}: la otra ruta trae el MISMO raw (${a.raw} vs ${b.raw})`);
    ok(String(a.value) === String(b.value), `${scn}: y el MISMO texto formateado (${a.value} vs ${b.value})`);
  }
}

H("[3] NINGUNA BOLETA TRAE DOS VALORES PARA LA MISMA ETIQUETA");
for (const scn of ["bonanza", "tension", "crisis"]) {
  for (const [tool, args] of [["entityRecord", { dimension: "cliente", entity: "Lider" }], ["marginRead", { dimension: "cliente" }]]) {
    const figs = figsDe(tool, args, scn);
    const porEtiqueta = new Map();
    for (const f of figs) {
      if (typeof f.raw !== "number" || !Number.isFinite(f.raw)) continue;
      const k = `${String(f.label || "").trim()}·${f.unit}`;
      if (!porEtiqueta.has(k)) porEtiqueta.set(k, new Set());
      porEtiqueta.get(k).add(f.raw);
    }
    const choques = [...porEtiqueta.entries()].filter(([, v]) => v.size > 1).map(([k, v]) => `${k}: ${[...v].join(" vs ")}`);
    ok(!choques.length, `${scn}/${tool}: ninguna etiqueta con dos valores distintos`, choques.join(" · "));
  }
}

console.log(`\n── _cifra_canonica_lider_gate: ${PASS} PASS · ${FAIL} FAIL (de ${PASS + FAIL}) ──`);
process.exit(FAIL ? 1 : 0);
