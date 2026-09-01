/* === _venta_oficial_una_verdad_gate.mjs · ADI Y LA PANTALLA DICEN EL MISMO NÚMERO (owner 2026-09-01) ========
 *
 * PALABRA DEL OWNER, textual: «Usa como venta oficial del negocio la misma cifra que muestra la pantalla. ADI
 * y Sentrix deben decir el mismo número para el mismo concepto. Si existe otra suma interna, déjala como
 * fuente secundaria o pendiente, pero no la uses como "total del negocio" en conversación.»
 *
 * EL DEFECTO QUE CIERRA, medido en el escenario que arranca la app (`bonanza`): `datoProyectado` publicaba los
 * KPI de ventas desde `deriveKpis` —que SUMA LAS FILAS de clientes: 99.887 → «$99.9M»— mientras la card, el
 * hero y la respuesta que abre su click usan `getVentasKPI` (99.999 → «$100.0M»). Tres cifras del mismo
 * concepto divergían: el total, el % vs año anterior (7,5 contra 7,6) y el % vs presupuesto (3,0 contra 3,1).
 * No es redondeo —el canon redondea bien: `parseFigures("$99999000") → money:$100.0M`—: son dos sumas.
 *
 * LO QUE **NO** SE TOCÓ, y se prueba acá para que nadie lo "arregle" de más: el margen de la cartera y la
 * contribución total ya coincidían, porque la Mesa los calcula sumando las mismas filas que `deriveKpis`
 * (`mesa.js:111`). Se midió antes de acotar, no se supuso.
 *
 * ⚠️ LA CIFRA DE ESTE GATE SALE DE LAS DOS FUENTES VIVAS, jamás de un literal: si el dato cambia, el gate lo
 * sigue; si las dos fuentes se separan otra vez, se pone rojo.
 *
 * OFFLINE · determinístico · CERO llamadas al modelo.
 * `node --import ./scripts/offline-guard.mjs _venta_oficial_una_verdad_gate.mjs` */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { cifrasDelDato } from "./src/adi/oracle/datoProyectado.js";
import { getVentasKPI } from "./src/engine/metrics.js";
import { deriveKpis, applyScenarioToClientesMargen } from "./src/engine/scenarios.js";
import { parseFigures } from "./src/adi/boleta.js";
import { ESCENARIO_INICIAL } from "./src/config/scenarios.js";

let pass = 0, fail = 0;
const ok = (cond, label, detalle) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label}`); if (detalle !== undefined) console.log(`      ${detalle}`); }
};
const H = (t) => console.log(`\n${t}`);
initTenant(TENANT_DEMO);
const canonDe = (raw, unit = "money") => {
  const p = parseFigures(unit === "money" ? `$${Math.round(raw)}` : `${raw}%`);
  return p.length ? p[0].canon : null;
};
/** lo que ADI publica con el concepto «total del negocio» — el mismo filtro de dueños que usa la quinta fuente */
const totalQueAdiPublica = (scenario) => (cifrasDelDato(scenario).figs || []).filter((f) =>
  /^money:/.test(String(f.canon)) && Array.isArray(f.duenos)
  && f.duenos.includes("negocio") && f.duenos.includes("total")
  && !f.duenos.includes("anterior") && !f.duenos.includes("presupuesto")
  && !f.duenos.includes("inventario"));

/* ═══ 1 · LA CIFRA · ADI dice lo que la pantalla muestra ════════════════════════════════════════════════════ */
H("1 · el total del negocio: ADI y la pantalla, una sola verdad");
{
  const K = getVentasKPI(null, null, ESCENARIO_INICIAL) || {};
  const dePantalla = canonDe(Number(K.totalActual) * 1000);
  ok(!!dePantalla, "la pantalla publica un total del período por `getVentasKPI` (mesa.js:93 · hero y card)", String(K.totalActual));
  const publica = totalQueAdiPublica(ESCENARIO_INICIAL).map((f) => String(f.canon));
  ok(publica.includes(dePantalla),
    `★ ADI publica ${dePantalla} como total del negocio — la MISMA que muestra la pantalla`,
    `ADI: ${JSON.stringify([...new Set(publica)])}`);
  /* y la otra suma NO se publica con ese concepto. Se compara solo si de verdad difieren: el día que el
   * dataset deje de arrastrar el 0,1%, las dos serán la misma cifra y este check no tendría nada que exigir. */
  const D = deriveKpis(ESCENARIO_INICIAL) || {};
  const deLasFilas = canonDe(Number((D.ventas || {}).totalActual) * 1000);
  if (deLasFilas && deLasFilas !== dePantalla) {
    ok(!publica.includes(deLasFilas),
      `★ y la Σ por fila (${deLasFilas}) NO se publica como total del negocio — es fuente secundaria, no la de conversación`,
      `ADI: ${JSON.stringify([...new Set(publica)])}`);
  } else {
    ok(true, `(las dos fuentes coinciden hoy en ${dePantalla}: no hay divergencia que exigir)`);
  }
}

/* ═══ 2 · LOS PORCENTAJES DE LA MISMA FAMILIA ══════════════════════════════════════════════════════════════
 * El total no viajaba solo: `vsAnterior` y `vsPresupuesto` salían de la misma fuente y divergían igual
 * (7,5 vs 7,6 · 3,0 vs 3,1). Arreglar el monto y dejar los % sería media verdad. */
H("2 · los % de la familia también son los de la pantalla");
{
  const K = getVentasKPI(null, null, ESCENARIO_INICIAL) || {};
  const figs = cifrasDelDato(ESCENARIO_INICIAL).figs || [];
  for (const [campo, dueno, etq] of [["vsAnterior", "anterior", "vs año anterior"], ["vsPresupuesto", "presupuesto", "vs presupuesto"]]) {
    const v = K[campo];
    if (v == null) { ok(true, `(la pantalla no publica «${etq}» en este dato)`); continue; }
    const esperado = canonDe(v, "pct");
    const publicados = figs.filter((f) => (f.duenos || []).includes(dueno) && /^pct:/.test(String(f.canon))).map((f) => String(f.canon));
    ok(publicados.includes(esperado), `★ «${etq}»: ADI publica ${esperado}, el de la pantalla`, JSON.stringify([...new Set(publicados)]));
  }
}

/* ═══ 3 · LO QUE NO SE TOCÓ, Y POR QUÉ ═════════════════════════════════════════════════════════════════════
 * Este bloque existe para frenar el arreglo de más: si alguien "unifica" margen y contribución contra una
 * función que se llama como el concepto pero la card no usa, este check lo ve. */
H("3 · el margen y la contribución ya coincidían: no se tocan");
{
  const _sum = (a, f) => a.reduce((s, r) => s + (typeof f(r) === "number" ? f(r) : 0), 0);
  const M = applyScenarioToClientesMargen(ESCENARIO_INICIAL) || [];
  const ventaBase = _sum(M, (r) => r.venta), contrib = _sum(M, (r) => r.contribucion);
  const margenPantalla = ventaBase ? +((contrib / ventaBase) * 100).toFixed(1) : 0;   // mesa.js:111-112
  const D = deriveKpis(ESCENARIO_INICIAL) || {};
  ok(canonDe((D.margen || {}).pct, "pct") === canonDe(margenPantalla, "pct"),
    `★ el margen de la cartera coincide con el de la Mesa (${margenPantalla}%) — por eso quedó intacto`,
    `ADI ${(D.margen || {}).pct} · Mesa ${margenPantalla}`);
  ok(canonDe(Number((D.margen || {}).totalUSD)) === canonDe(contrib),
    "★ y la contribución total, igual — la Mesa suma las MISMAS filas que ADI");
}

/* ═══ 4 · CARNADAS ═════════════════════════════════════════════════════════════════════════════════════════ */
H("4 · carnadas");
const carnada = async (nombre, archivo, reemplazos, comprobar) => {
  const p = path.join(process.cwd(), archivo);
  const original = fs.readFileSync(p, "utf8");
  let mutado = original, aplicados = 0;
  for (const [re, por] of reemplazos) { const antes = mutado; mutado = mutado.replace(re, por); if (mutado !== antes) aplicados++; }
  if (aplicados !== reemplazos.length) { fail++; console.log(`  ✗ carnada «${nombre}»: el patrón no existe más — carnada muerta`); return; }
  fs.writeFileSync(p, mutado);
  try {
    const mod = await import(`${pathToFileURL(p).href}?carnada=${encodeURIComponent(nombre)}`);
    const cayo = await comprobar(mod);
    ok(cayo, `carnada «${nombre}» → el chequeo se pone ROJO`, cayo === false ? "el defecto pasó DESAPERCIBIDO" : undefined);
  } finally { fs.writeFileSync(p, original); }
};

// (a) EL DEFECTO MISMO: las ventas vuelven a salir de la Σ por fila y ADI narra otro total que la pantalla.
await carnada("las ventas vuelven a la suma interna", "src/adi/oracle/datoProyectado.js",
  [[/  const kpis = \{ \.\.\._derivados, ventas: \{ \.\.\.\(_derivados\.ventas \|\| \{\}\), \.\.\._ventasPantalla \} \};/,
    "  const kpis = _derivados;   // CARNADA: como antes, la Σ por fila"]],
  async (M) => {
    initTenant(TENANT_DEMO);
    const K = getVentasKPI(null, null, ESCENARIO_INICIAL) || {};
    const dePantalla = canonDe(Number(K.totalActual) * 1000);
    const publica = (M.cifrasDelDato(ESCENARIO_INICIAL).figs || []).filter((f) =>
      /^money:/.test(String(f.canon)) && (f.duenos || []).includes("negocio") && (f.duenos || []).includes("total")
      && !(f.duenos || []).includes("anterior") && !(f.duenos || []).includes("presupuesto") && !(f.duenos || []).includes("inventario"))
      .map((f) => String(f.canon));
    return !publica.includes(dePantalla);   // el defecto: ADI ya no dice lo que la pantalla muestra
  });

// (b) el arreglo a medias: el monto se unifica y los % se dejan en la fuente vieja.
await carnada("el monto unificado pero los % en la fuente vieja", "src/adi/oracle/datoProyectado.js",
  [[/  const kpis = \{ \.\.\._derivados, ventas: \{ \.\.\.\(_derivados\.ventas \|\| \{\}\), \.\.\._ventasPantalla \} \};/,
    "  const kpis = { ..._derivados, ventas: { ...(_derivados.ventas || {}), totalActual: _ventasPantalla.totalActual } };   // CARNADA: medio arreglo"]],
  async (M) => {
    initTenant(TENANT_DEMO);
    const K = getVentasKPI(null, null, ESCENARIO_INICIAL) || {};
    const figs = M.cifrasDelDato(ESCENARIO_INICIAL).figs || [];
    const esperado = canonDe(K.vsAnterior, "pct");
    const pub = figs.filter((f) => (f.duenos || []).includes("anterior") && /^pct:/.test(String(f.canon))).map((f) => String(f.canon));
    return !pub.includes(esperado);   // el defecto: el monto coincide y el % no
  });

console.log(`\n── _venta_oficial_una_verdad_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
