/* === _totales_cabecera_gate.mjs · LOS TOTALES DE CABECERA (owner 2026-08-09 · decisión 6 · hallazgo E) ========
 *
 * QUÉ PRUEBA. Que la cifra más visible del producto —la card de arriba de cada cara— y la cifra que ADI tiene
 * AUTORIZADO decir son la misma, en los tres escenarios. No que se parezcan: la misma cadena, carácter por
 * carácter, y el mismo `raw` en dólares.
 *
 * POR QUÉ EXISTE. Antes de este pase, cinco cabeceras declaraban como evidencia una tool que devolvía un RANKING
 * por entidad y nunca su total. El usuario miraba "$99.9M" y la única cifra que ADI tenía permitido decir era la
 * venta de cada cliente por separado: podía contestar la cabecera con otra cosa y nada lo hubiera detectado. La
 * regla del owner fue explícita —«NO reconstruir el total sumando rankings si existe una fuente oficial»—, así que
 * este gate no verifica una suma: verifica que las dos puntas salgan de la MISMA función.
 *
 * CUATRO CANDADOS:
 *   [1] la declaración no se desincroniza del contrato (métrica@eje que no existe en `metricRegistry` = rojo);
 *   [2] el total canónico reproduce EXACTO lo que la card pinta, en los 3 escenarios;
 *   [3] la tool que el manifiesto declara para esa cabecera EMITE esa cifra en su boleta, con su universo, su
 *       período y su dueño — y con el `raw` en dólares, la convención de la decisión 1;
 *   [4] hay UNA sola rotación media en el producto (la card y el pie de la tabla de drill tienen que decir lo
 *       mismo: convivieron 6,0x y 5,8x con la misma etiqueta y en la misma cara).
 *
 * CERO RED · CERO LLM · CERO CRÉDITOS.  node _totales_cabecera_gate.mjs
 */
import { HEADLINES, headlineTotal, rotacionPonderada } from "./src/adi/sentrix/headline.js";
import { METRICS } from "./src/config/contract/metricRegistry.js";
import { VIEW_MANIFEST } from "./src/adi/sentrix/viewManifest.js";
import { buildResumenComercial } from "./src/adi/sentrix/resumenComercial.js";
import { buildMesaCapital, buildCuadroCapital } from "./src/adi/sentrix/mesaCapital.js";
import { applyScenarioToSkuInventario } from "./src/engine/scenarios.js";
import { runPlan } from "./src/adi/oracle/toolRunner.js";
import { ledgerBoleta } from "./src/adi/oracle/ledger.js";
import { SCENARIOS } from "./src/config/scenarios.js";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";

// vía 1 (2026-08-20): el dataset se DECLARA acá. Antes se heredaba del import por defecto de tenantStore,
// que ya no existe: el store arranca en la forma vacía y el dato entra por initTenant. Ver tenantEmpty.js.
initTenant(TENANT_DEMO);

let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };
const H = (t) => console.log("\n" + t);
const ESC = Object.keys(SCENARIOS);

// QUÉ CARD PINTA CADA CABECERA. Es lo ÚNICO que este gate declara a mano, y es estructura (dónde mirar), no
// cifras: el valor lo lee del builder vivo en cada corrida. Si el producto renombra una card, esto se pone rojo.
const CARD = {
  "ventas@cliente":       { cara: "comercial", kpi: "ventas",       campo: "valor" },
  "contribucion@cliente": { cara: "comercial", kpi: "contribucion", campo: "valor" },
  "margen@cliente":       { cara: "comercial", kpi: "margen",       campo: "valor" },
  "acciones@cliente":     { cara: "comercial", kpi: "acciones",     campo: "valor" },
  "capital@sku":          { cara: "capital",   kpi: "capital",      campo: "value" },
  "rotacion@sku":         { cara: "capital",   kpi: "rotacion",     campo: "value" },
};
// el componente del manifiesto cuya cabecera es cada total (para verificar que su evidencia declarada la emite)
const COMPONENTE = {
  "ventas@cliente": "comercial/01/kpi-ventas",
  "contribucion@cliente": "comercial/01/kpi-contribucion",
  "margen@cliente": "comercial/01/kpi-margen",
  "acciones@cliente": "comercial/01/kpi-acciones-comerciales",
  "capital@sku": "capital/01/kpi-capital",
  "rotacion@sku": "capital/01/kpi-rotacion",
};

const _money = (v) => { const a = Math.abs(v), s = v < 0 ? "-" : ""; if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(1)}M`; if (a >= 1e3) return `${s}$${Math.round(a / 1e3)}K`; return `${s}$${Math.round(a)}`; };
const _p1 = (v) => (Math.round(v * 10) / 10).toFixed(1);
// el MISMO formateo que usa la boleta de las tools (specRetrieval._money/_p1)
const fmtCanon = (h) => h.unidad === "money" ? _money(h.raw) : h.unidad === "pct" ? `${_p1(h.valor)}%` : h.unidad === "ratio" ? `${h.valor.toFixed(1)}x` : String(h.valor);

console.log("── TOTALES DE CABECERA · la card y la boleta dicen la misma cifra ──────────────────────────────────");
console.log(`   escenarios: ${ESC.join(" · ")} · ${Object.keys(HEADLINES).length} cabeceras declaradas · cero red · cero LLM\n`);

H("[1] LA DECLARACIÓN NO SE DESINCRONIZA DEL CONTRATO");
{
  const huerfanas = [], sinCard = [], sinComponente = [];
  for (const clave of Object.keys(HEADLINES)) {
    const [met, eje] = clave.split("@");
    const m = METRICS[met];
    if (!m || !(m.axes || []).includes(eje) || !(m.sourceByAxis && m.sourceByAxis[eje])) huerfanas.push(clave);
    if (!CARD[clave]) sinCard.push(clave);
    if (!COMPONENTE[clave] || !VIEW_MANIFEST[COMPONENTE[clave]]) sinComponente.push(clave);
  }
  ok(!huerfanas.length, "toda cabecera declarada es una métrica×eje que el contrato conoce", huerfanas.join(", "));
  ok(!sinCard.length, "toda cabecera declarada nombra la card que la pinta", sinCard.join(", "));
  ok(!sinComponente.length, "toda cabecera declarada nombra un componente real del manifiesto", sinComponente.join(", "));
  // el sentido inverso: una card de KPI del producto sin cabecera declarada es cobertura faltante, no un error —
  // se informa para que se vea, porque el modo de falla de este frente fue justamente el silencio.
  const kpisManifiesto = Object.entries(VIEW_MANIFEST).filter(([, m]) => m.tipo === "kpi").map(([id]) => id);
  const cubiertos = new Set(Object.values(COMPONENTE));
  const fuera = kpisManifiesto.filter((id) => !cubiertos.has(id));
  console.log(`      ${cubiertos.size} de ${kpisManifiesto.length} KPI del manifiesto tienen total de cabecera declarado${fuera.length ? ` · sin declarar: ${fuera.join(", ")}` : ""}`);
}

H("[2] EL TOTAL CANÓNICO REPRODUCE EXACTO LO QUE LA CARD PINTA · en los tres escenarios");
{
  const malos = [];
  for (const scn of ESC) {
    const caras = { comercial: buildResumenComercial(scn), capital: buildMesaCapital(scn) };
    for (const [clave, c] of Object.entries(CARD)) {
      const [met, eje] = clave.split("@");
      const h = headlineTotal(met, eje, scn);
      const card = ((caras[c.cara].kpis || []).find((k) => k.key === c.kpi) || {})[c.campo];
      if (!h) { malos.push(`[${scn}] ${clave}: la fuente oficial no devolvió cifra`); continue; }
      if (card == null) { malos.push(`[${scn}] ${clave}: la card '${c.kpi}' no existe o no pinta '${c.campo}'`); continue; }
      if (fmtCanon(h) !== card) malos.push(`[${scn}] ${clave}: card «${card}» ≠ canónico «${fmtCanon(h)}»`);
    }
  }
  ok(!malos.length, `las ${Object.keys(CARD).length} cabeceras coinciden carácter por carácter en los ${ESC.length} escenarios`, malos.join("\n      "));
}

H("[3] LA TOOL QUE EL MANIFIESTO DECLARA EMITE ESA CIFRA · con dueño, universo y período");
{
  const faltan = [], mal = [], sinTipo = [];
  for (const scn of ESC) {
    for (const [clave, componentId] of Object.entries(COMPONENTE)) {
      const [met, eje] = clave.split("@");
      const h = headlineTotal(met, eje, scn);
      const m = VIEW_MANIFEST[componentId];
      const calls = (m.evidencia || []).map((ev) => ({ tool: ev.tool, args: { ...(ev.args || {}), ...(ev.focus ? { focus: ev.focus } : {}) } }));
      if (!calls.length) { faltan.push(`[${scn}] ${componentId}: no declara ninguna tool`); continue; }
      const { ledger } = runPlan({ calls }, { scenario: scn, maxCalls: 8 });
      const figs = ledgerBoleta(ledger);
      const f = figs.find((x) => x.label === h.label);
      if (!f) { faltan.push(`[${scn}] ${componentId}: [${calls.map((c) => c.tool).join(",")}] no autoriza «${h.label}»`); continue; }
      if (f.value !== fmtCanon(h)) mal.push(`[${scn}] ${clave}: boleta «${f.value}» ≠ card «${fmtCanon(h)}»`);
      // el `raw` en DÓLARES (decisión 1): con miles y dólares crudos en el mismo pool, guardC autoriza sumas falsas
      if (typeof f.raw !== "number" || Math.abs(f.raw - h.raw) > 0.5) mal.push(`[${scn}] ${clave}: raw ${f.raw} ≠ ${h.raw} (debe venir en dólares)`);
      const t = f.tipo || {};
      if (t.universo !== h.universo) sinTipo.push(`[${scn}] ${clave}: universo «${t.universo}» ≠ «${h.universo}»`);
      if (t.periodo !== h.periodo) sinTipo.push(`[${scn}] ${clave}: período «${t.periodo}» ≠ «${h.periodo}»`);
      if (!t.entidad) sinTipo.push(`[${scn}] ${clave}: la cifra viaja SIN dueño (decisión 7)`);
      if (t.escenario !== scn) sinTipo.push(`[${scn}] ${clave}: la cifra no declara su escenario (${t.escenario})`);
    }
  }
  ok(!faltan.length, "la evidencia declarada de cada cabecera AUTORIZA su total (no sólo el ranking)", faltan.join("\n      "));
  ok(!mal.length, "la cifra autorizada es la misma que la card, y su `raw` viene en dólares", mal.join("\n      "));
  ok(!sinTipo.length, "cada total viaja con universo, período, escenario y dueño declarados", sinTipo.slice(0, 8).join("\n      "));
}

H("[4] UNA SOLA ROTACIÓN MEDIA · la card y el pie de la tabla no pueden decir dos números");
{
  const choques = [], simples = [];
  for (const scn of ESC) {
    const cap = buildMesaCapital(scn);
    const card = ((cap.kpis || []).find((k) => k.key === "rotacion") || {}).value;
    for (const eje of ["sku", "bodega"]) {
      const cc = buildCuadroCapital(eje, scn);
      if (`${cc.rotacionMedia.toFixed(1)}x` !== card) choques.push(`[${scn}] card «${card}» ≠ pie de la tabla ${eje} «${cc.rotacionMedia.toFixed(1)}x»`);
      if (cc.total && `${Number(cc.total.rotacion).toFixed(1)}x` !== card) choques.push(`[${scn}] card «${card}» ≠ fila Total de la tabla ${eje} «${Number(cc.total.rotacion).toFixed(1)}x»`);
    }
    // …y que la que queda sea la PONDERADA, no la simple: si alguien vuelve al promedio simple, esto se pone rojo
    const inv = applyScenarioToSkuInventario(scn) || [];
    const simple = inv.length ? Math.round((inv.reduce((a, r) => a + r.rotacion, 0) / inv.length) * 10) / 10 : 0;
    const pond = rotacionPonderada(inv);
    if (`${pond.toFixed(1)}x` !== card) choques.push(`[${scn}] la card no muestra la ponderada: «${card}» ≠ «${pond.toFixed(1)}x»`);
    if (simple !== pond) simples.push(`[${scn}] ponderada ${pond}x · simple ${simple}x (son distintas: por eso el nombre tenía que quedar en una sola)`);
  }
  ok(!choques.length, `la rotación media es UNA en toda la cara Capital, en los ${ESC.length} escenarios`, choques.join("\n      "));
  // no es un fallo: es la prueba de que el candado de arriba no es decorativo (si fueran iguales, no probaría nada)
  console.log(`      ${simples.length ? simples.join("\n      ") : "ponderada y simple coinciden en este dato: el candado de arriba no distingue hoy"}`);
}

console.log(`\n${FAIL ? "✗" : "✓"} TOTALES DE CABECERA · ${PASS} pasaron · ${FAIL} fallaron`);
process.exit(FAIL ? 1 : 0);
