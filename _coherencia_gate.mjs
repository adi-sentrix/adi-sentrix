/* === _coherencia_gate.mjs · COHERENCIA TOTAL de las cards de la Mesa (owner 2026-07-15) ===
 * Lockea el pase "deja todo funcionando — coherencia total": la card y la respuesta que abre su click cuentan LO MISMO.
 *   [1] Presupuesto UNA verdad: Σ por cliente == global (baseKpis) == Σ mensuales == 97,000.
 *   [2] Card VENTAS: el % del sub == el % con que abre el composer vs_presupuesto (misma KPI).
 *   [3] Card MARGEN: N bajo el piso completos (nombrados) · puente N→materiales explícito · $ del lever == En alerta == Acción.
 *   [4] Card CONTRIBUCIÓN: la cifra del sub == la apertura del composer · lista N=N que SUMA el total anunciado.
 *   [5] Card CAPITAL: total coherente · "arrancá por" y "cuánto vale" nombran el MISMO par y el $ es su suma exacta.
 *   [6] CERO "vara" en la superficie de la Mesa (runtime de mesa/mesaCapital/cuadro/watchlist + strings de SentrixPanel).
 * Determinístico (sin LLM) · corre en bonanza (prod) + smoke tensión/crisis. */
import fs from "fs";
import { buildMesaEstado, buildWatchlistEstado } from "./src/adi/sentrix/mesa.js";
import { buildMesaCapital, buildCuadroCapital } from "./src/adi/sentrix/mesaCapital.js";
import { buildCuadroMando } from "./src/adi/sentrix/cuadro.js";
import { buildResumenEjecutivo, composeSpecVentas, composeSpecMargin, composeSpecContribucion, composeSpecInventory, composeSpecDiagnose } from "./src/adi/specRetrieval.js";
import { clientesVentas } from "./src/data/demoData.js";
import { ventasKPI, ventasMensuales } from "./src/data/baseKpis.js";

let pass = 0, fail = 0;
const ok = (cond, label, detail = "") => { if (cond) { pass++; console.log(`  ✓ ${label}`); } else { fail++; console.log(`  ✗ ${label}${detail ? " — " + detail : ""}`); } };
const S = "bonanza";
const _money = (v) => { const a = Math.abs(v), s = v < 0 ? "-" : ""; if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(1)}M`; if (a >= 1e3) return `${s}$${Math.round(a / 1e3)}K`; return `${s}$${Math.round(a)}`; };

console.log("[1] PRESUPUESTO UNA VERDAD");
const sumCli = clientesVentas.reduce((s, r) => s + (r.presupuesto || 0), 0);
const sumMes = ventasMensuales.reduce((s, r) => s + (r.presupuesto || 0), 0);
ok(sumCli === ventasKPI.totalPresupuesto, `Σ presupuesto por cliente (${sumCli}) == global (${ventasKPI.totalPresupuesto})`);
ok(sumMes === ventasKPI.totalPresupuesto, `Σ presupuesto mensual (${sumMes}) == global`);
for (const r of clientesVentas) ok(typeof r.presupuesto === "number" && r.presupuesto > 0, `presupuesto de ${r.nombre} declarado`);

console.log("[2] CARD VENTAS == COMPOSER (vs_presupuesto)");
const mesa = buildMesaEstado(S);
const vSub = mesa.estados.ventas.linea;
const vComp = composeSpecVentas({ scenario: S, focus: "vs_presupuesto", dimension: "cliente" });
const mSub = vSub.match(/^([+−-])(\d+(?:\.\d+)?)% vs presupuesto/);
const mOpen = (vComp.opener || "").match(/La venta va ([+-]?)(\d+(?:\.\d+)?)% (sobre|bajo) presupuesto/);
ok(!!mSub && !!mOpen, "ambos declaran el % vs presupuesto", vSub);
if (mSub && mOpen) {
  const sSub = mSub[1] === "+" ? 1 : -1, sOpen = mOpen[3] === "sobre" ? 1 : -1;
  ok(mSub[2] === mOpen[2] && sSub === sOpen, `card ${mSub[1]}${mSub[2]}% == composer ${mOpen[1]}${mOpen[2]}% ${mOpen[3]}`, `card «${vSub}» vs composer «${mOpen[0]}»`);
}
ok(/\$97\.0M/.test(vComp.opener), "el composer ancla el presupuesto global ($97.0M)");

console.log("[3] CARD MARGEN · los N completos + puente material + $ una verdad");
const diag = composeSpecDiagnose({ filters: {}, scenario: S });
const mg = diag.evidence.findings.find((f) => f.detector === "margen");
const mComp = composeSpecMargin({ scenario: S, focus: "bajo_benchmark", dimension: "cliente" });
const below = mComp.evidence.margin.below;
const mHead = (mComp.opener || "").match(/^(\d+) de (\d+) clientes están bajo el margen mínimo/);
ok(!!mHead && Number(mHead[1]) === below.length, `la apertura declara ${below.length} bajo el piso`);
const named = below.filter((b) => mComp.opener.includes(b.nombre)).length;
ok(named === below.length, `los ${below.length} bajo el piso tienen NOMBRE en la respuesta (${named}/${below.length})`);
ok(below.length <= 5 || /cuadro de la Mesa/.test(mComp.opener), "camino declarado al resto (cuadro de la Mesa)");
ok(/queda abierto desde esta vista/.test(mComp.opener) && /«¿Es por precio o por costo\?»/.test(mComp.opener), "la CAUSA se declara ABIERTA con oferta de confirmarla");
const mLever = (mComp.opener || "").match(/de los (\d+) bajo el piso, los (\d+) con brecha material [^:]+: si llegan al benchmark son \+(\$[\d.]+[MK])/);
ok(!!mLever, "puente explícito N-bajo-el-piso → materiales en el Cuánto vale");
if (mLever) {
  ok(Number(mLever[1]) === below.length && Number(mLever[2]) === mg.items.length, `puente ${mLever[1]}→${mLever[2]} == ${below.length}→${mg.items.length}`);
  ok(mLever[3] === _money(mg.subtotal_usd), `lever ${mLever[3]} == detector ${_money(mg.subtotal_usd)}`);
  ok(mesa.alertas.usdFmt === mLever[3], `En alerta (${mesa.alertas.usdFmt}) == lever (${mLever[3]})`);
}
ok(mesa.alertas.n === mg.items.length, `En alerta n (${mesa.alertas.n}) == items del detector (${mg.items.length})`);
if (mesa.accion && /no capturada/.test(mesa.accion.detalle)) ok(mesa.accion.detalle.includes(_money(mg.subtotal_usd)), `la Acción cita el mismo $ (${_money(mg.subtotal_usd)})`);

console.log("[4] CARD CONTRIBUCIÓN == COMPOSER (no_capturada) · grupo que CIERRA");
const cComp = composeSpecContribucion({ scenario: S, focus: "no_capturada", dimension: "cliente" });
const cTotFig = cComp.evidence.boleta.find((f) => f.label === "Contribución no capturada · total");
ok(!!cTotFig && cTotFig.mandatory === true, "la cifra del grupo viaja mandatoria en la boleta");
ok(cTotFig && cTotFig.raw === mg.subtotal_usd, `total del composer (${cTotFig && cTotFig.raw}) == detector del diagnose (${mg.subtotal_usd})`);
ok(mesa.estados.contribucion.linea.startsWith(`${_money(mg.subtotal_usd)} sin capturar`), `el sub de la card ABRE con la misma cifra (${_money(mg.subtotal_usd)})`, mesa.estados.contribucion.linea);
ok((cComp.opener || "").startsWith(`Estás dejando ${_money(mg.subtotal_usd)} de contribución`), "la respuesta ABRE con la misma cifra");
const cHead = (cComp.opener || "").match(/si los (\d+) clientes materiales/);
ok(!!cHead && Number(cHead[1]) === mg.items.length, `el corte anunciado (${cHead && cHead[1]}) == items del detector (${mg.items.length})`);
const cFigs = cComp.evidence.boleta.filter((f) => / no capturada$/.test(f.label) && f.label !== "Contribución no capturada · total");
const cListedNames = cFigs.map((f) => f.label.replace(/^cliente · /, "").replace(/ no capturada$/, ""));
const cNamed = cListedNames.filter((n) => cComp.opener.includes(n));
if (Number(cHead && cHead[1]) === cListedNames.length) {
  ok(cNamed.length === cListedNames.length, `lista N=N: los ${cListedNames.length} nombrados`);
  const sumListed = cFigs.reduce((s, f) => s + f.raw, 0);
  ok(sumListed === cTotFig.raw, `Σ listados (${sumListed}) == total anunciado (${cTotFig.raw}) — el grupo CIERRA`);
  ok(/esa lista completa suma el total de arriba/.test(cComp.opener), "el cierre del grupo queda DICHO");
} else {
  ok(/completos están en el cuadro de la Mesa/.test(cComp.opener), "corte declarado con camino al resto");
}

console.log("[5] CARD CAPITAL == COMPOSER (frenado) · la medida cuantifica EXACTO lo que nombra");
const cap = diag.evidence.findings.find((f) => f.detector === "capital");
const iComp = composeSpecInventory({ scenario: S, focus: "frenado" });
ok(mesa.estados.capital.linea.includes(_money(cap.subtotal_usd)), `el sub de la card cita ${_money(cap.subtotal_usd)}`, mesa.estados.capital.linea);
ok((iComp.opener || "").includes(`Tenés ${_money(cap.subtotal_usd)} de capital inmovilizado`), "la respuesta abre con el mismo total");
const mHacer = (iComp.opener || "").match(/arrancá por ([A-Z0-9-]+(?: y [A-Z0-9-]+)?)/);
const mVale = (iComp.opener || "").match(/liberar ([A-Z0-9-]+(?: y [A-Z0-9-]+)?) devuelve (\$\d+(?:\.\d+)?[KM]?)/);
ok(!!mHacer && !!mVale, "existen el «arrancá por» y el «cuánto vale»");
if (mHacer && mVale) {
  ok(mHacer[1] === mVale[1], `el par recomendado (${mHacer[1]}) == el par cuantificado (${mVale[1]})`);
  const bySku = Object.fromEntries(iComp.evidence.inventory.bySku.map((s) => [s.sku, s.usd]));
  const suma = mVale[1].split(" y ").reduce((s, k) => s + (bySku[k] || 0), 0);
  ok(_money(suma) === mVale[2], `el $ (${mVale[2]}) == Σ capital de los nombrados (${_money(suma)})`);
}
ok(!/los más detenidos\)/.test(iComp.opener), "sin la etiqueta ambigua que fundía los grupos («los más detenidos»)");
const capMesa = buildMesaCapital(S);
ok(capMesa.alertas.linea.includes(_money(cap.subtotal_usd)), "la pata de inventario del En alerta cita el mismo $");

console.log("[6] CERO «vara» EN LA SUPERFICIE DE LA MESA");
const emitted = [];
const walk = (o) => { if (o == null) return; if (typeof o === "string") { emitted.push(o); return; } if (Array.isArray(o)) { o.forEach(walk); return; } if (typeof o === "object") Object.values(o).forEach(walk); };
for (const sc of ["bonanza", "tension", "crisis"]) {
  walk(buildMesaEstado(sc));
  walk(buildMesaCapital(sc));
  walk(buildCuadroCapital("sku", sc)); walk(buildCuadroCapital("bodega", sc));
  for (const eje of ["cliente", "sku", "marca"]) { try { walk(buildCuadroMando(eje, sc)); } catch { /* eje sin datos */ } }
  walk(buildWatchlistEstado([{ dim: "cliente", name: "Mercado Libre" }, { dim: "cliente", name: "Falabella" }, { dim: "sku", name: "LG-DRYER8KG" }, { dim: "marca", name: "LG" }, { dim: "bodega", name: "Valparaíso" }, { dim: "cliente", name: "NoExiste" }], sc));
  walk(buildResumenEjecutivo(sc).kpis); walk(buildResumenEjecutivo(sc).lectura);
}
const leaks = emitted.filter((s) => /\bvaras?\b/i.test(s));
ok(leaks.length === 0, `runtime de la Mesa sin «vara» (${emitted.length} strings barridos)`, leaks.slice(0, 3).join(" | "));
// strings visibles de SentrixPanel (literales + texto JSX) — identificadores (varaGap/varaRef/it.vara) y comentarios no cuentan
const src = fs.readFileSync("./src/ui/SentrixPanel.jsx", "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/([;{})\]])\s*\/\/[^\n"'`]*$/gm, "$1");
const lits = [...src.matchAll(/"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|`((?:[^`\\]|\\.)*)`/gs)].map((m) => m[1] || m[2] || m[3] || "");
const jsxText = [...src.matchAll(/>([^<>{}`]+)</g)].map((m) => m[1]);
const uiLeaks = [...lits, ...jsxText].filter((s) => /\bvaras?\b/i.test(s));
ok(uiLeaks.length === 0, "SentrixPanel sin «vara» visible (literales + texto JSX)", uiLeaks.slice(0, 3).join(" | "));

console.log(`\n── _coherencia_gate: ${pass} PASA · ${fail} FALLA ──`);
process.exit(fail ? 1 : 0);
