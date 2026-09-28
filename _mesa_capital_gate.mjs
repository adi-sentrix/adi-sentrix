/* === _mesa_capital_gate.mjs · GATE DE LA CARA CAPITAL (owner 2026-07-15 "ok, veamos cómo queda") ===
 * La segunda cara de la Mesa cuenta EL MISMO dato del motor — este gate lo verifica contra un ORÁCULO independiente
 * (diagnoseInventario + el detector de capital del diagnose) por los 3 escenarios:
 *   (1) el MAPA suma EXACTO: tramos == total del motor == total del cuadro (sku y bodega) — ni un peso fabricado;
 *   (2) "En juego $" == el subtotal del detector de capital del diagnose (una verdad con la Mesa/cuadro comercial);
 *   (3) REPONER ⊆ riesgo_quiebre del motor · LIQUIDAR ⊆ capital_frenado (las listas no inventan candidatos);
 *   (4) anti-BI: todo tramo/KPI/foco/línea/chip lleva su pregunta (no hay elemento mudo);
 *   (5) honestidad: "Qué cambió" NO existe (sin historial de stock no se fabrica) · microlectura SOLO con señal;
 *   (6) lenguaje FORMAL en superficie: "vara" no se emite (benchmark) · registro ejecutivo limpio;
 *   (7) la pata de inventario del "En alerta" cuenta los MISMOS críticos del dato.
 * Corre sin key (determinístico) · La cara comercial NO se toca acá (sus gates ya la cubren). */
import esbuild from "esbuild"; import { pathToFileURL } from "url"; import path from "path"; import fs from "fs";
const root = process.cwd(); const entry = path.join(root, `_mcge.tmp${process.pid}.js`), out = path.join(root, `_mcgb.tmp${process.pid}.mjs`);
fs.writeFileSync(entry, [
  'export { initTenant } from "./src/data/tenantStore.js";',
  'export { TENANT_DEMO } from "./src/data/tenants/demo.js";',
  'export { buildMesaCapital, buildCuadroCapital, CAPITAL_ESTADOS } from "./src/adi/sentrix/mesaCapital.js";',
  // `jerarquiaInventario` (etapas 1-2, decisión del owner §7.3·31/32) — el ORÁCULO de la nueva sección (18),
  // "Días sin venta": el cruce con inmovilizado/crítico/frenado de la pestaña se verifica CONTRA la fuente única.
  'export { diagnoseInventario, jerarquiaInventario } from "./src/adi/diagnosis/economicDiagnosis.js";',
  'export { applyScenarioToSkuInventario } from "./src/engine/scenarios.js";',
  'export { composeSpecDiagnose } from "./src/adi/specRetrieval.js";',
  // decisión 13 · las OTRAS dos superficies que recomiendan sobre este mismo inventario
  'export { buildControlRing, caminoEstructural } from "./src/adi/sentrix/control.js";',
  'export { buildCapitalSignals, buildReadingFromSignals } from "./src/adi/sentrix/reading.js";',
  'export { transferenciaCapability } from "./src/adi/sentrix/capability.js";',
  // el coercer del piso · para probar que la palabra nueva de los `ask` SIGUE entrando al chat (owner 2026-08-15)
  'export { coerceFloor } from "./src/adi/coerceChain.js";',
].join("\n"));
await esbuild.build({ entryPoints: [entry], bundle: true, outfile: out, format: "esm", platform: "node", logLevel: "silent" });
const M = await import(pathToFileURL(out).href + "?t=" + Math.random());
// vía 1 (2026-08-20): el dataset se DECLARA acá. Antes se heredaba del import por defecto de tenantStore,
// que ya no existe: el store arranca en la forma vacía y el dato entra por initTenant. Ver tenantEmpty.js.
M.initTenant(M.TENANT_DEMO);
try { fs.unlinkSync(entry); } catch { /* */ } try { fs.unlinkSync(out); } catch { /* */ }
const { buildMesaCapital, buildCuadroCapital, CAPITAL_ESTADOS, diagnoseInventario, jerarquiaInventario, applyScenarioToSkuInventario, composeSpecDiagnose,
        buildControlRing, caminoEstructural, buildCapitalSignals, buildReadingFromSignals, transferenciaCapability, coerceFloor } = M;

let pass = 0, fail = 0; const rotos = [];
const ok = (cond, tag, detail) => { if (cond) pass++; else { fail++; rotos.push({ tag, detail: detail || "" }); } };
const INFORMAL = /\b(vara|plata|dormid[oa]s?|guita|palancas?|flojo|detenid[oa]s?)\b/i;   // formal en superficie (benchmark, no vara — adi-lenguaje-formal) · + detenido (owner 2026-08-15: la palabra es «inmovilizado»)

for (const sc of ["bonanza", "tension", "crisis"]) {
  const mc = buildMesaCapital(sc);
  const inv = applyScenarioToSkuInventario(sc) || [];
  const D = diagnoseInventario(inv, {});   // el ORÁCULO: el mismo motor, llamado aparte

  // (1) el mapa suma EXACTO el total del motor · los tramos no fabrican ni pierden un peso
  const sumTramos = mc.mapa.tramos.reduce((a, t) => a + t.usd, 0);
  ok(sumTramos === D.total && mc.mapa.totalUsd === D.total, `mapa-suma@${sc}`, `tramos ${sumTramos} vs motor ${D.total}`);
  for (const t of mc.mapa.tramos) {
    const d = D.dist[t.key];
    ok(!!d && d.usd === t.usd && d.count === t.n, `tramo-${t.key}@${sc}`, `usd ${t.usd} vs ${d && d.usd} · n ${t.n} vs ${d && d.count}`);
  }
  const cSku = buildCuadroCapital("sku", sc), cBod = buildCuadroCapital("bodega", sc);
  ok(cSku.total.capital === D.total && cBod.total.capital === D.total, `cuadro-total@${sc}`, `sku ${cSku.total.capital} · bodega ${cBod.total.capital} vs motor ${D.total}`);

  // (2) "En juego $" == el subtotal del detector de capital del diagnose (una verdad)
  const diag = composeSpecDiagnose({ filters: {}, scenario: sc });
  const capF = diag && diag.evidence && diag.evidence.findings ? diag.evidence.findings.find((f) => f.detector === "capital") : null;
  const detSubtotal = capF ? capF.subtotal_usd : 0;
  const ejSku = cSku.rows.reduce((a, r) => a + (r.enJuego || 0), 0);
  const ejBod = cBod.rows.reduce((a, r) => a + (r.enJuego || 0), 0);
  ok(ejSku === detSubtotal && ejBod === detSubtotal, `enjuego@${sc}`, `sku ${ejSku} · bodega ${ejBod} vs detector ${detSubtotal}`);
  const frenadoTramo = mc.mapa.tramos.find((t) => t.key === "capital_frenado");
  ok((frenadoTramo ? frenadoTramo.usd : 0) === detSubtotal, `detenido-una-verdad@${sc}`, `tramo ${frenadoTramo && frenadoTramo.usd} vs detector ${detSubtotal}`);

  // (3) las listas no inventan candidatos: reponer ⊆ riesgo_quiebre · liquidar ⊆ capital_frenado (del motor)
  const estadoDe = {}; for (const s of D.perSku) estadoDe[s.sku] = s.estado;
  for (const it of mc.reponer.filas) ok(estadoDe[it.sku] === "riesgo_quiebre", `reponer-${it.sku}@${sc}`, `estado ${estadoDe[it.sku]}`);
  for (const it of mc.liquidar.filas) ok(estadoDe[it.sku] === "capital_frenado", `liquidar-${it.sku}@${sc}`, `estado ${estadoDe[it.sku]}`);

  // (4) anti-BI: nada mudo — todo lo ofrecido lleva su pregunta
  for (const t of mc.mapa.tramos) ok(typeof t.ask === "string" && t.ask.trim().length > 0, `ask-tramo-${t.key}@${sc}`);
  for (const k of mc.kpis) ok(typeof k.ask === "string" && k.ask.trim().length > 0, `ask-kpi-${k.key}@${sc}`);
  for (const f of mc.focos) ok(typeof f.ask === "string" && f.ask.trim().length > 0, `ask-foco-${f.key}@${sc}`);
  for (const [lista, tag] of [[mc.reponer, "reponer"], [mc.liquidar, "liquidar"]]) {
    if (lista.filas.length) ok(typeof lista.ask === "string" && lista.ask.trim().length > 0, `ask-${tag}@${sc}`);
    for (const it of lista.filas) ok(typeof it.ask === "string" && it.ask.trim().length > 0, `ask-${tag}-${it.sku}@${sc}`);
  }
  for (const s of mc.simulaciones) ok(typeof s.ask === "string" && s.ask.trim().length > 0, `ask-ysi-${s.key}@${sc}`);
  for (const r of [...cSku.rows, ...cBod.rows]) ok(typeof r.accionAsk === "string" && r.accionAsk.trim().length > 0, `ask-chip-${r.name}@${sc}`);

  // (5) honestidad: sin historial de stock NO hay "qué cambió" · microlectura SOLO con señal (alert)
  ok(mc.cambios === undefined, `sin-que-cambio@${sc}`, "la cara no fabrica movimiento sin historial de stock");
  for (const r of cSku.rows) ok(!r.lectura || r.alert, `microlectura-${r.name}@${sc}`, "lectura sin señal del detector");

  // (6) lenguaje formal + registro ejecutivo en TODO texto emitido por la cara
  const textos = [
    mc.mapa.lectura,
    ...mc.mapa.tramos.map((t) => `${t.label} ${t.ask}`),
    ...mc.kpis.map((k) => `${k.label} ${k.linea} ${k.ask}`),
    ...mc.focos.map((f) => `${f.label} ${f.ask}`),
    ...mc.reponer.filas.map((i) => i.linea), ...mc.liquidar.filas.map((i) => i.linea),
    mc.reponer.criterio, mc.reponer.accion, mc.liquidar.criterio, mc.liquidar.accion,
    mc.veredicto.titular, mc.veredicto.soporte, mc.veredicto.cierre || "",
    ...(mc.limitaciones || []),
    ...mc.cortes.vistas.flatMap((v) => v.filas.map((f) => `${f.nombre} ${f.dominanteLabel || ""}`)), mc.cortes.nota,
    ...mc.simulaciones.map((s) => s.texto),
    mc.alertas.linea,
    ...cSku.rows.map((r) => `${r.estadoLabel} ${r.lectura || ""} ${r.accion}`),
    ...cBod.rows.map((r) => `${r.estadoLabel} ${r.lectura || ""} ${r.accion}`),
  ];
  for (const t of textos) {
    const m = String(t || "").match(INFORMAL);
    ok(!m, `registro@${sc}`, m ? `«${m[0]}» en «${String(t).slice(0, 70)}»` : "");
  }

  /* (7) la pata de inventario del "En alerta" cuenta los MISMOS críticos del dato · decisión del owner
   * 2026-09-28, §7.3·34a: la alerta del archivo (`alerta === "crit"`) deja de llamarse «crítico» en superficie —
   * ANTES: `critOracle` intersectaba `capital_frenado ∧ alerta==='crit'` (2 SKU en el demo bonanza/tensión) — una
   * mezcla que el propio manifiesto (`viewManifest.js`, "capital/01/alertas") ya contradecía, declarando esta
   * pata como "los SKU críticos DEL DETECTOR" sin mencionar la alerta del archivo. AHORA: «crítico» tiene una
   * sola definición (inmovilizado crítico = `capital_frenado`, sin la alerta), así que el oráculo es directo:
   * todos los SKU en ese estado (3 en el demo bonanza/tensión). */
  const critOracle = D.perSku.filter((s) => s.estado === "capital_frenado").length;
  ok(mc.alertas.n === critOracle, `alertas-criticos@${sc}`, `pata ${mc.alertas.n} vs dato ${critOracle}`);
  // el campo se llama `inmovilizado` desde 2026-08-09 (decisión 6): la assertion es la MISMA —este dinero es el
  // subtotal del detector, no el capital del inventario— y ese es justo el motivo del nombre nuevo. Se llamaba
  // `usd`, y leído por su nombre un agregado sin identidad de fila decía «capital» valiendo el inmovilizado.
  ok(mc.alertas.inmovilizado === detSubtotal, `alertas-inmovilizado@${sc}`, `pata ${mc.alertas.inmovilizado} vs detector ${detSubtotal}`);
}

/* ══ LAS DECISIONES DEL OWNER DEL 2026-08-08, SELLADAS ═══════════════════════════════════════════════════════
 * Cada bloque de acá abajo existe porque una decisión suya puede romperse en silencio si nadie la vigila. */
for (const sc of ["bonanza", "tension", "crisis"]) {
  const mc = buildMesaCapital(sc);
  const D = diagnoseInventario(applyScenarioToSkuInventario(sc) || [], {});
  const inv = applyScenarioToSkuInventario(sc) || [];

  /* ── (8) DECISIÓN 7 · NI UNA CIFRA DE VENTA COMERCIAL EN CAPITAL ───────────────────────────────────────────
   * Es la más importante. El inventario y la venta comercial no reconcilian en unidad, moneda ni período:
   * `skusMargen.venta` viene en MILES y `stockUSD` en dólares crudos, y las unidades declaradas difieren hasta
   * 35x por SKU. Antes la lista de reposición mostraba "vende $12.3M al año" junto a "$14K detenidos" — dos
   * universos incompatibles en la misma pantalla. El sello tiene DOS mitades, y las dos importan:
   *   a) el módulo no importa `skusMargen` (lo que no entra no se cuela);
   *   b) ninguna cifra de ese universo aparece en un texto de la cara. */
  const fuente = fs.readFileSync(path.join(root, "src/adi/sentrix/mesaCapital.js"), "utf8");
  ok(!/from\s+["'][^"']*skusMargen/.test(fuente), `sin-import-skusMargen@${sc}`, "el módulo no debe importar la venta comercial");
  const textosCap = [
    mc.veredicto.titular, mc.veredicto.soporte, mc.veredicto.cierre || "", mc.mapa.lectura,
    ...mc.kpis.map((k) => `${k.label} ${k.linea}`),
    ...mc.reponer.filas.map((f) => f.linea), ...mc.liquidar.filas.map((f) => f.linea),
    mc.reponer.criterio, mc.reponer.accion, mc.liquidar.criterio, mc.liquidar.accion,
    ...mc.cortes.vistas.flatMap((v) => v.filas.map((f) => `${f.nombre} ${f.usdFmt}`)),
    ...(mc.limitaciones || []),
  ].join(" ");
  // el capital de este tenant vive en miles de dólares; una cifra en millones solo puede venir del otro universo
  ok(!/\$\d+(?:[.,]\d+)?M\b/.test(textosCap), `sin-millones@${sc}`,
    `una cifra en $M no puede salir del inventario: ${(textosCap.match(/\$\d+(?:[.,]\d+)?M\b/g) || []).join(", ")}`);
  /* Lo prohibido es una CIFRA del universo comercial, no el verbo: el titular sellado por el owner dice "donde no
   * se vende", que es la historia y no un monto. Se caza el patrón que sí sería falso — una plata pegada a un
   * verbo de venta ("vende $12.3M") o a un período anual ("$12.3M al año"), que fue exactamente el defecto. */
  ok(!/vend\w*\s+\$|\$[\d.,]+\s*[KM]?\s*(al año|anual)|venta anual/i.test(textosCap), `sin-venta-comercial@${sc}`,
    `una plata pegada a un verbo de venta solo puede venir del otro universo: ${(textosCap.match(/vend\w*\s+\$[^\s]*|\$[\d.,]+\s*[KM]?\s*(?:al año|anual)/i) || [""])[0]}`);

  /* ── (9) DECISIÓN 2 · UNA SOLA VERDAD DE COBERTURA, Y SE LLAMA "DÍAS DE INVENTARIO" ────────────────────────
   * El dato trae `doh` (que cierra: stockUnd ÷ ventaDiaria) y `cobertura` (declarado, distinto — hasta 28 días
   * de diferencia en un mismo SKU). Sentrix usa `doh`; lo que se prohíbe es volver a nombrarlo "cobertura",
   * porque esa palabra es también el nombre del OTRO campo y ahí nace la ambigüedad. */
  const supCap = [textosCap, ...Object.values(CAPITAL_ESTADOS).map((e) => `${e.label} ${e.def}`),
    ...buildCuadroCapital("sku", sc).columns.map((c) => c.label)].join(" ");
  ok(!/cobertura/i.test(supCap), `sin-palabra-cobertura@${sc}`,
    `«cobertura» es ambigua: hay dos campos con ese nombre — ${(supCap.match(/[^.]*cobertura[^.]*/i) || [""])[0].slice(0, 80)}`);
  // y el valor que se muestra ES `doh`, no el otro campo
  const cSku2 = buildCuadroCapital("sku", sc);
  for (const r of cSku2.rows) {
    const src = inv.find((x) => x.sku === r.name);
    ok(!src || r.doh === Math.round(src.doh), `doh-es-doh-${r.name}@${sc}`, `fila ${r.doh} vs dato ${src && src.doh}`);
  }

  /* ── (10) DECISIÓN 5 · EL MISMO CAPITAL POR TRES CORTES, Y LOS TRES CIERRAN ────────────────────────────────
   * Es la parte que más valor da y la que más fácil se rompe: si un corte no suma el total, la cara estaría
   * mostrando tres cuentas distintas y llamándolas la misma. Se verifica fila por fila. */
  for (const v of mc.cortes.vistas) {
    const suma = v.filas.reduce((a, f) => a + f.usd, 0);
    ok(suma === D.total, `corte-${v.key}-cierra@${sc}`, `${v.key} suma ${suma} vs total ${D.total}`);
    ok(v.reconcilia === true, `corte-${v.key}-declara@${sc}`, "el corte debe declararse conciliado");
    for (const f of v.filas) {
      const st = f.tramos.reduce((a, t) => a + t.usd, 0);
      ok(st === f.usd, `corte-${v.key}-fila-${f.nombre}@${sc}`, `tramos ${st} vs fila ${f.usd}`);
    }
  }
  const sumaDetalle = mc.cortes.detalle.reduce((a, d) => a + d.usd, 0);
  ok(sumaDetalle === D.total, `detalle-sku-cierra@${sc}`, `detalle ${sumaDetalle} vs total ${D.total}`);
  ok(mc.cortes.detalle.length === D.perSku.length, `detalle-completo@${sc}`, "el detalle debe traer todos los SKU");

  /* ── (11) DECISIÓN 3 · LA BODEGA LOCALIZA, NO HABILITA TRANSFERENCIAS ──────────────────────────────────────
   * Ningún SKU está en más de una bodega, así que mover stock de una a otra no es evaluable con este dato.
   * Se prohíbe la recomendación Y se exige que el límite esté declarado — las dos cosas, porque callarlo
   * también sería deshonesto. */
  const _recomienda = [mc.reponer.criterio, mc.reponer.accion, mc.liquidar.criterio, mc.liquidar.accion,
    ...mc.reponer.filas.map((f) => f.linea), ...mc.liquidar.filas.map((f) => f.linea),
    mc.veredicto.cierre || "", ...buildCuadroCapital("sku", sc).rows.map((r) => r.accion),
    ...buildCuadroCapital("bodega", sc).rows.map((r) => r.accion)].join(" ");
  ok(!/transferi|redistribu|mover stock/i.test(_recomienda), `sin-transferencia@${sc}`,
    "ninguna superficie que RECOMIENDA puede proponer transferir: el dato no permite evaluarlo");
  const porSku = {}; for (const s of D.perSku) (porSku[s.sku] = porSku[s.sku] || new Set()).add(s.bodega);
  const multi = Object.values(porSku).filter((b) => b.size > 1).length;
  ok(multi > 0 || (mc.limitaciones || []).some((t) => /transferir entre bodegas no se puede evaluar/i.test(t)),
    `limite-transferencia-declarado@${sc}`, "si no se puede evaluar, hay que decirlo");
  ok((mc.limitaciones || []).length >= 3, `limitaciones-declaradas@${sc}`, "la cara declara lo que no puede afirmar");

  /* ── (11b) DECISIÓN 13 · LAS OTRAS DOS SUPERFICIES QUE RECOMIENDAN SOBRE EL MISMO INVENTARIO ────────────────
   * El candado de arriba cubría la cara Capital, y la contradicción vivía FUERA de ella: la tarjeta estructural
   * del ring de bodega ("Rotar / transferir el stock lento · mover lo lento a donde se vende") y la lectura
   * ejecutiva del capital ("revisaría salida comercial y transferencia de stock") proponían exactamente lo que
   * esta cara declara inevaluable. Se verifican las TRES juntas y contra UNA sola cuenta: si alguna se entera de
   * que el dato cambió y otra no, vuelve la contradicción por la ventana. */
  const capTransf = transferenciaCapability(inv);
  ok(capTransf.evaluable === (multi > 0), `transferencia-capability@${sc}`,
    `la cuenta compartida dice evaluable=${capTransf.evaluable} y el oráculo cuenta ${multi} SKU en más de una bodega`);
  ok(mc.limitaciones[0] === capTransf.motivo, `transferencia-una-sola-cuenta@${sc}`,
    "la cara Capital tiene que declarar el límite CON la cuenta compartida, no con una suya");
  for (const bod of [...new Set(inv.map((x) => x.bodega))]) {
    const ring = buildControlRing("bodega", bod, sc);
    if (!ring) continue;
    ok(!!ring.transferencia && ring.transferencia.evaluable === capTransf.evaluable, `ring-transferencia-declarada@${sc}/${bod}`,
      "el ring tiene que traer el hecho, para que la tarjeta se condicione al dato y no a mano");
  }
  const sig = buildCapitalSignals(sc);
  if (sig) {
    ok(sig.why.driver.transferible === capTransf.evaluable, `lectura-transferible@${sc}`,
      "la lectura ejecutiva lee la MISMA cuenta");
    const rec = String(buildReadingFromSignals(sig).recommendation || "");
    ok(capTransf.evaluable || !/transferenci|transferi|redistribu|mover stock/i.test(rec), `lectura-sin-transferencia@${sc}`,
      `la lectura ejecutiva recomienda transferir sin poder evaluarlo: «${rec}»`);
  }

  /* ── (12) DECISIÓN 6 · TOPE DE 5 POR LISTA ────────────────────────────────────────────────────────────────
   * Para que escale a una empresa grande. Y el resto no se pierde: se declara cuántos quedan. */
  for (const [lista, tag] of [[mc.reponer, "reponer"], [mc.liquidar, "liquidar"]]) {
    ok(lista.tope <= 5, `tope-${tag}@${sc}`, `tope ${lista.tope}`);
    ok(lista.tope + lista.resto === lista.n, `tope-resto-${tag}@${sc}`, `${lista.tope}+${lista.resto} vs ${lista.n}`);
    ok(lista.filas.length === lista.n, `filas-completas-${tag}@${sc}`, "el módulo entrega todas; la vista corta");
  }

  /* ── (13) DECISIÓN 9 · LAS CUATRO ACCIONES PERMITIDAS, Y NINGUNA OTRA ──────────────────────────────────────
   * "Liquidar" afirmaba una decisión comercial que el dato no toma: que un SKU no rote no prueba que haya que
   * rematarlo. La acción del detenido es EVALUAR una salida, no ejecutarla. */
  const PERMITIDAS = { capital_frenado: "evaluar salida comercial", riesgo_quiebre: "revisar reposición",
    sobrestock: "frenar o ajustar reposición", capital_sano: "sostener" };
  for (const r of cSku2.rows) {
    const st = D.perSku.find((s) => s.sku === r.name);
    ok(!st || r.accion === PERMITIDAS[st.estado], `accion-${r.name}@${sc}`, `«${r.accion}» para estado ${st && st.estado}`);
  }
  ok(!/\bliquidar\b|\bremat/i.test(textosCap + " " + cSku2.rows.map((r) => r.accion).join(" ")),
    `sin-liquidar@${sc}`, "el dato no autoriza a afirmar que haya que liquidar");

  /* ── (14) DECISIÓN 8 · LA HISTORIA SELLADA, Y SIN AFIRMAR LA VENTA PERDIDA ─────────────────────────────────
   * El titular es del owner, textual, cuando el dato da la señal. Y el límite epistémico: la venta no realizada
   * por un quiebre NO está medida — la cara localiza el riesgo, nunca lo cuantifica. */
  const frenado = D.dist.capital_frenado || { usd: 0 }, quiebre = D.dist.riesgo_quiebre || { count: 0 };
  if (frenado.usd > 0 && quiebre.count > 0) {
    ok(mc.veredicto.titular === "Tu capital está donde no se vende, y escasea donde sí.",
      `veredicto-sellado@${sc}`, `«${mc.veredicto.titular}»`);
    ok(mc.veredicto.tipo === "senal", `veredicto-senal@${sc}`);
  }
  ok(!/venta perdida|ventas perdidas|dejaste de vender|pierde[sn]? venta/i.test(textosCap),
    `sin-venta-perdida@${sc}`, "la venta no realizada por quiebre no está medida: no se afirma");
  ok(!/porque|se debe a|la causa es/i.test(mc.veredicto.titular + " " + mc.veredicto.soporte),
    `veredicto-no-atribuye@${sc}`, "el veredicto localiza, no atribuye causa");
}

/* ── (16) CADA CARD CIERRA CON SU PROPIA TABLA (owner 2026-08-09) ─────────────────────────────────────────────
 * "Las cifras no cuadran entre ellas; necesitamos única fuente de verdad sin inventar nada." Tenía razón: el KPI
 * de rotación mostraba 5,8x —media SIMPLE de las 13 filas— y su propia tabla mostraba familias de 3,9x a 7,9x,
 * cuya media da 5,97x. El usuario abría la card y NO podía llegar al número de arriba desde lo de abajo.
 * Ahora las dos se ponderan por capital, así que las familias RECOMPONEN el total. El gate rehace esa cuenta. */
for (const sc of ["bonanza", "tension", "crisis"]) {
  const mc = buildMesaCapital(sc);
  const D = diagnoseInventario(applyScenarioToSkuInventario(sc) || [], {});
  const t = mc.drill.rotacion;
  const cap = t.filas.reduce((a, f) => a + f.usd, 0);
  const recompuesta = cap ? t.filas.reduce((a, f) => a + f.rotacion * f.usd, 0) / cap : 0;
  const kpiRot = parseFloat(mc.kpis.find((k) => k.key === "rotacion").value);
  ok(Math.abs(recompuesta - kpiRot) <= 0.1, `rotacion-recomponible@${sc}`,
    `el KPI dice ${kpiRot}x y sus familias recomponen ${recompuesta.toFixed(2)}x`);
  ok(cap === D.total, `rotacion-tabla-cierra@${sc}`, `la tabla de familias suma ${cap} vs total ${D.total}`);
  // LAS CUATRO CARDS EN LA MISMA UNIDAD donde tiene sentido: tres en plata, la de rotación en veces.
  const enPlata = mc.kpis.filter((k) => /^\$/.test(String(k.value))).length;
  ok(enPlata === 3, `kpis-misma-unidad@${sc}`, `${enPlata} de 4 cards en plata — las tres de capital deben serlo`);
  // Y CADA CARD ABRE EXACTAMENTE SU UNIVERSO: la tabla no puede traer filas de otro estado
  // "quiebres" sigue siendo UN estado (riesgo_quiebre) — sin cambio.
  const porEstado = { quiebres: "riesgo_quiebre" };
  for (const [k, estado] of Object.entries(porEstado)) {
    const filas = mc.drill[k].filas;
    ok(filas.every((f) => f.estado === estado), `drill-${k}-solo-su-universo@${sc}`, `alguna fila no es ${estado}`);
    ok(filas.length === (D.dist[estado] || { count: 0 }).count, `drill-${k}-completo@${sc}`,
      `${filas.length} filas vs ${(D.dist[estado] || {}).count} del motor`);
    const suma = filas.reduce((a, f) => a + f.usd, 0);
    ok(suma === (D.dist[estado] || { usd: 0 }).usd, `drill-${k}-suma@${sc}`, `${suma} vs ${(D.dist[estado] || {}).usd}`);
  }
  /* "detenido" (la pestaña "Capital inmovilizado") · decisión del owner 2026-09-28, §7.3·31/34a/34c: ANTES el
   * universo era SOLO `capital_frenado` (`filas.every(f => f.estado === "capital_frenado")`, completo contra
   * `D.dist.capital_frenado.count`, suma contra `D.dist.capital_frenado.usd`). AHORA es el UNIVERSO ∪ (crítico ∪
   * sobrestock), con el crítico distinguido por su columna «Situación» — la pestaña sigue llamándose «Capital
   * inmovilizado» y muestra lo que su nombre promete, no solo el crítico. */
  {
    const filas = mc.drill.detenido.filas;
    const esperadoEstado = new Set(["capital_frenado", "sobrestock"]);
    ok(filas.every((f) => esperadoEstado.has(f.estado)), `drill-detenido-solo-su-universo@${sc}`,
      `alguna fila no es capital_frenado ni sobrestock`);
    const nEsperado = (D.dist.capital_frenado || { count: 0 }).count + (D.dist.sobrestock || { count: 0 }).count;
    ok(filas.length === nEsperado, `drill-detenido-completo@${sc}`, `${filas.length} filas vs ${nEsperado} del motor (crítico ∪ sobrestock)`);
    const suma = filas.reduce((a, f) => a + f.usd, 0);
    const usdEsperado = (D.dist.capital_frenado || { usd: 0 }).usd + (D.dist.sobrestock || { usd: 0 }).usd;
    ok(suma === usdEsperado, `drill-detenido-suma@${sc}`, `${suma} vs ${usdEsperado}`);
    // el crítico sigue siendo exactamente el subconjunto capital_frenado — la contención por construcción
    const criticoEsperado = (D.dist.capital_frenado || { count: 0 }).count;
    ok(filas.filter((f) => f.situacion === "Crítico").length === criticoEsperado, `drill-detenido-critico-subconjunto@${sc}`,
      `${filas.filter((f) => f.situacion === "Crítico").length} vs ${criticoEsperado}`);
    // orden: crítico primero, después por capital
    const rank = (f) => (f.situacion === "Crítico" ? 0 : 1);
    ok(filas.every((f, i) => i === 0 || rank(filas[i - 1]) <= rank(f) && (rank(filas[i - 1]) < rank(f) || filas[i - 1].usd >= f.usd)),
      `drill-detenido-orden@${sc}`, "crítico primero; dentro de cada grupo, de mayor a menor capital");
  }
  ok(mc.drill.capital.filas.length === D.perSku.length, `drill-capital-completo@${sc}`);
  // EL 80/20 · cabeza + cola cierran con el total del corte, igual que en Comercial
  for (const v of mc.cortes.vistas) {
    const cabeza = v.filas.filter((f) => f.enGrupo).reduce((a, f) => a + f.usd, 0);
    const colaU = v.filas.filter((f) => !f.enGrupo).reduce((a, f) => a + f.usd, 0);
    ok(cabeza + colaU === v.suma, `pareto-${v.key}-cierra@${sc}`, `${cabeza}+${colaU} vs ${v.suma}`);
    ok(!!v.pareto && typeof v.pareto.lectura === "string" && v.pareto.lectura.length > 20,
      `pareto-${v.key}-lectura@${sc}`, "el 80/20 se declara en una frase del módulo");
  }
}

/* ── (18) DÍAS SIN VENTA · el ranking con capital acumulado, SIN CORTES (decisión del owner 2026-09-28, §7.3·34c,
 * experiencia APROBADA — reemplaza el corte por tramos fijos 0-30/31-60/61-90/>90 que vivía en `cortes.vistas`).
 * ANTES: `mc.cortes.vistas` tenía 3 vistas (bodega, familia, "edad" con tramos fijos); el bloque de abajo
 * verificaba que "edad" existiera, cerrara con el total, fuera cronológico y no prometiera antigüedad de bodega.
 * AHORA: `mc.cortes.vistas` tiene 2 (bodega, familia — sin cambio de comportamiento) y "Días sin venta" vive en
 * `mc.diasSinVenta`, con otra forma: un RANKING (no tramos) con el capital ACUMULADO al recorrerlo. Lo que este
 * bloque cuida:
 *   · el ranking está ordenado por días sin venta, descendente (lo que lleva más tiempo primero);
 *   · el acumulado crece SIN CORTES y la última fila cierra exacto con el total del inventario;
 *   · el cruce con inmovilizado/crítico por fila concuerda con `jerarquiaInventario` sobre las MISMAS filas;
 *   · sin umbral declarado, NINGUNA fila se marca «Frenada» (nunca 60/90 días como verdad de ADI) y la nota +
 *     la pregunta a ADI están declaradas; con umbral, el total y su procedencia concuerdan con `J.frenado`;
 *   · los hechos del período (`vendidoMes`, `diasSinVenta`) salen de CAMPOS DEL DATO, nunca de texto a mano: se
 *     verifica releyendo el dato crudo fila por fila — y la incoherencia (venta en el período con más días sin
 *     venta que el período) se declara, nunca se fuerza un contraste que el propio dato contradice. */
for (const sc of ["bonanza", "tension", "crisis"]) {
  const mc = buildMesaCapital(sc);
  const D = diagnoseInventario(applyScenarioToSkuInventario(sc) || [], {});
  const J = jerarquiaInventario(applyScenarioToSkuInventario(sc) || []);
  const inv = applyScenarioToSkuInventario(sc) || [];
  const byInv = {}; for (const r of inv) byInv[r.sku] = r;
  const dsv = mc.diasSinVenta;
  ok(!!dsv, `dias-sin-venta-existe@${sc}`);
  // los DOS cortes que quedan (bodega, familia) siguen cerrando exacto — "edad" ya no es uno de ellos
  ok(mc.cortes.vistas.length === 2 && mc.cortes.vistas.every((v) => v.suma === D.total)
    && mc.cortes.vistas.every((v) => v.key !== "edad"),
    `dos-cortes-cierran@${sc}`, mc.cortes.vistas.map((v) => `${v.key}:${v.suma}`).join(" "));
  if (dsv) {
    ok(dsv.totalUsd === D.total, `dias-sin-venta-total@${sc}`, `${dsv.totalUsd} vs ${D.total}`);
    ok(dsv.n === D.perSku.length, `dias-sin-venta-n@${sc}`, `${dsv.n} vs ${D.perSku.length}`);
    // orden: lo que lleva MÁS tiempo sin venderse primero (nulos al final, declarados con `sinDato`)
    const dias = dsv.filas.map((f) => (f.sinDato ? -1 : f.diasSinVenta));
    ok(dias.every((v, i) => i === 0 || dias[i - 1] >= v), `dias-sin-venta-orden@${sc}`, dias.join(","));
    // EL ACUMULADO CIERRA SIN CORTES: suma corrida de `capital`, byte-exacta, hasta el total en la última fila
    let acc = 0; let ok_acc = true;
    for (const f of dsv.filas) { acc += f.capital; if (f.acumuladoUsd !== acc) ok_acc = false; }
    ok(ok_acc, `dias-sin-venta-acumulado-corre@${sc}`, "el acumulado debe crecer exactamente con el capital de cada fila, sin cortes");
    ok(dsv.filas[dsv.filas.length - 1].acumuladoUsd === D.total, `dias-sin-venta-acumulado-cierra@${sc}`,
      `${dsv.filas[dsv.filas.length - 1].acumuladoUsd} vs ${D.total}`);
    // NUNCA TRAMOS FIJOS NI LA FRASE VIEJA: ni en las filas ni en las notas de la vista
    const textoVista = JSON.stringify(dsv);
    ok(!/0–30|31–60|61–90|[Mm]ás de 90 d[ií]as|llevan m[áa]s de 60 d[ií]as sin venderse/.test(textoVista),
      `dias-sin-venta-sin-tramos-fijos@${sc}`, "los tramos fijos y la frase «$X llevan más de 60 días sin venderse» están retirados (§7.3·34c)");
    // EL CRUCE CON LA JERARQUÍA ÚNICA: mismos SKU, mismo inmovilizado/crítico que `jerarquiaInventario`
    const byJ = {}; for (const s of J.porSku) byJ[s.sku] = s;
    ok(dsv.filas.every((f) => byJ[f.sku] && f.inmovilizado === byJ[f.sku].inmovilizado && f.critico === byJ[f.sku].critico),
      `dias-sin-venta-cruce-jerarquia@${sc}`, "cada fila debe concordar con jerarquiaInventario para su SKU");
    // SIN UMBRAL, NINGUNA FILA DICE «FRENADA» (nunca 60/90 como verdad de ADI) — y la nota + la pregunta están
    ok(J.frenado.evaluado || dsv.filas.every((f) => f.frenado !== "Frenada"), `dias-sin-venta-sin-frenado-sin-umbral@${sc}`,
      "sin umbral declarado, ninguna fila puede marcar venta frenada");
    if (!J.frenado.evaluado) {
      ok(dsv.frenado.evaluado === false && typeof dsv.notaUmbral === "string" && dsv.notaUmbral.length > 0 && typeof dsv.askUmbral === "string",
        `dias-sin-venta-nota-umbral@${sc}`, "sin umbral: nota + pregunta a ADI declaradas, nunca un veredicto");
      ok(!/no hay (SKU )?frenad/i.test(dsv.notaUmbral), `dias-sin-venta-nunca-no-hay-frenados@${sc}`,
        "el límite se dice como límite, nunca como «no hay frenados» (§7.3·32a)");
    } else {
      // con umbral: el total de frenado concuerda con J.frenado (misma jerarquía, mismas filas)
      ok(dsv.frenado.evaluado === true && dsv.frenado.usd === J.frenado.usd && dsv.frenado.n === J.frenado.n,
        `dias-sin-venta-frenado-concuerda@${sc}`, `${dsv.frenado.usd}/${dsv.frenado.n} vs ${J.frenado.usd}/${J.frenado.n}`);
      ok(dsv.notaUmbral === null && dsv.askUmbral === null, `dias-sin-venta-sin-nota-con-umbral@${sc}`,
        "con umbral declarado no corresponde la nota de «sin declarar»");
    }
    // LA NOTA FIJA DE NATURALEZA DEL DATO viaja siempre, con o sin umbral (§7.3·34c/d)
    ok(/no son un pron[oó]stico/i.test(dsv.notaNaturaleza || ""), `dias-sin-venta-nota-naturaleza@${sc}`,
      "la nota de naturaleza del dato (histórico, no pronóstico) debe viajar siempre");
    // LOS HECHOS SALEN DE CAMPOS DEL DATO, no de texto armado a mano: se releen crudos y se comparan
    for (const f of dsv.filas) {
      const r = byInv[f.sku] || {};
      if (typeof r.vendidoMes === "number" && r.vendidoMes === 0) {
        ok(f.texto === "Sin ventas registradas en el período.", `dias-sin-venta-hecho-sin-ventas-${f.sku}@${sc}`, f.texto);
      } else if (typeof r.vendidoMes === "number" && r.vendidoMes > 0 && typeof r.diasSinVenta === "number") {
        const coherente = r.diasSinVenta <= 31;
        ok(f.coherente === coherente, `dias-sin-venta-coherencia-${f.sku}@${sc}`,
          `vendidoMes=${r.vendidoMes} diasSinVenta=${r.diasSinVenta} → coherente esperado ${coherente}, fila dice ${f.coherente}`);
        if (!coherente) {
          ok(!/unidades vendidas en el per[ií]odo · [uú]ltima venta/.test(f.texto) && /no se muestra el contraste/.test(f.texto),
            `dias-sin-venta-incoherente-no-contraste-${f.sku}@${sc}`, f.texto);
        } else {
          ok(f.texto.includes(String(r.vendidoMes)) && /unidades vendidas en el per[ií]odo/.test(f.texto),
            `dias-sin-venta-coherente-muestra-contraste-${f.sku}@${sc}`, f.texto);
        }
      }
    }
  }
}

/* ── (19) LAS BARRAS · el reparto por SKU, sin corte silencioso (owner 2026-08-09, tras el dashboard Power BI) ──
 * El owner trajo dos gráficos y preguntó por el de barras azules: monto al final, unidades adentro, dos filtros.
 * Un gráfico de barras es la superficie MÁS FÁCIL de volver deshonesta sin querer: se dibujan los 10 primeros, el
 * ojo lee "esto es todo" y la cola desaparece. Por eso lo que este bloque cuida no es el dibujo sino la aritmética:
 *   · cabeza + barra agrupada == el total de la vista, al peso · y ese total == el mismo capital del motor;
 *   · si algo quedó fuera de las 10, la lectura lo DICE (cuántos y que van agrupados) — nunca se corta callado;
 *   · las unidades también cierran: es el segundo número que el usuario lee y nadie lo verifica solo;
 *   · la barra agrupada no es preguntable ni tiene estado: "Otros 3" no es un SKU y no se puede diagnosticar;
 *   · el filtro "Inmovilizado" contiene EXACTAMENTE los capital_frenado del motor — el mismo universo del KPI. */
for (const sc of ["bonanza", "tension", "crisis"]) {
  const mc = buildMesaCapital(sc);
  const D = diagnoseInventario(applyScenarioToSkuInventario(sc) || [], {});
  const B = mc.barras;
  ok(!!B && Array.isArray(B.vistas) && B.vistas.length === 2, `barras-existen@${sc}`, B ? `${B.vistas.length} vistas` : "no hay");
  ok(!!B && B.vistas.some((v) => v.key === B.porDefecto), `barras-default-valido@${sc}`, B ? B.porDefecto : "");
  for (const v of (B ? B.vistas : [])) {
    // (a) NI UN PESO PERDIDO · cabeza + cola agrupada == total de la vista. Esta es LA verificación del bloque:
    //     un top-N que no declara su cola miente por omisión aunque cada barra individual sea correcta.
    const suma = v.barras.reduce((a, b) => a + b.usd, 0);
    ok(suma === v.total, `barras-cierran-${v.key}@${sc}`, `${suma} vs ${v.total}`);
    const sumaUnd = v.barras.reduce((a, b) => a + (b.und || 0), 0);
    ok(sumaUnd === v.und, `barras-unidades-cierran-${v.key}@${sc}`, `${sumaUnd} vs ${v.und}`);
    /* (b) EL TOTAL ES EL DEL MOTOR · no una suma paralela que empiece a derivar. Decisión del owner 2026-09-28,
     * §7.3·31/34a: ANTES la vista "inmovilizado" filtraba solo `capital_frenado` (el crítico); AHORA filtra el
     * UNIVERSO (crítico ∪ sobrestock) — el mismo que cuenta la card "Capital inmovilizado" (antes: $33.200/3 SKU
     * en el demo; ahora: $43.000/4 SKU, con PHI-IRON-PRO en sobrestock sumándose). */
    const esInmov = (s) => s.estado === "capital_frenado" || s.estado === "sobrestock";
    const esperado = v.key === "general" ? D.total : D.perSku.filter(esInmov).reduce((a, s) => a + s.capital, 0);
    ok(v.total === esperado, `barras-total-vs-motor-${v.key}@${sc}`, `${v.total} vs ${esperado}`);
    ok(v.n === (v.key === "general" ? D.perSku.length : D.perSku.filter(esInmov).length),
      `barras-n-vs-motor-${v.key}@${sc}`, `${v.n}`);
    // (c) LA COLA SE DECLARA · si hay agrupados, la lectura dice cuántos; si no hay, no promete un corte que no hubo
    const agrup = v.barras.filter((b) => b.agrupado);
    ok(agrup.length === (v.colaN > 0 ? 1 : 0), `barras-una-agrupada-${v.key}@${sc}`, `${agrup.length} agrupadas, cola ${v.colaN}`);
    if (v.colaN > 0) {
      ok(new RegExp(`\\b${v.colaN}\\b`).test(v.lectura) && /agrupad/i.test(v.lectura),
        `barras-declara-cola-${v.key}@${sc}`, v.lectura.slice(0, 120));
      // la agrupada NO es preguntable ni diagnosticable: "Otros 3" no es un SKU
      ok(agrup[0].ask === null && agrup[0].estado === null, `barras-agrupada-muda-${v.key}@${sc}`, `${agrup[0].ask}`);
      ok(agrup[0] === v.barras[v.barras.length - 1], `barras-agrupada-ultima-${v.key}@${sc}`);
    } else {
      ok(!/agrupad|se dibujan|otros/i.test(v.lectura), `barras-sin-cola-no-promete-${v.key}@${sc}`, v.lectura.slice(0, 120));
    }
    // (d) ORDEN DESCENDENTE en la cabeza y ancho proporcional al mayor (la primera llena la fila)
    const cab = v.barras.filter((b) => !b.agrupado);
    ok(cab.every((b, i) => i === 0 || cab[i - 1].usd >= b.usd), `barras-orden-desc-${v.key}@${sc}`,
      cab.map((b) => b.usd).join(">"));
    ok(cab.length > 0 && cab[0].anchoPct === 100, `barras-ancho-referencia-${v.key}@${sc}`, cab.length ? `${cab[0].anchoPct}%` : "vacía");
    ok(v.barras.every((b) => b.anchoPct >= 0 && b.anchoPct <= 100), `barras-ancho-en-rango-${v.key}@${sc}`);
    // (e) CADA BARRA REAL ES PREGUNTABLE (anti-BI: no hay elemento mudo) y trae su monto ya formateado
    ok(cab.every((b) => b.ask && b.usdFmt && b.estadoLabel), `barras-cabeza-preguntable-${v.key}@${sc}`);
    // (e2) LA LEYENDA DEL PUNTO · un color sin clave es un código interno. Y tiene que ser EXACTAMENTE los estados
    //      dibujados: si sobra una clave, promete un estado que no está; si falta, deja un punto sin explicar.
    const presentes = [...new Set(cab.map((b) => b.estado))];
    ok(v.leyenda.length === presentes.length && v.leyenda.every((l) => presentes.includes(l.estado)),
      `barras-leyenda-exacta-${v.key}@${sc}`, `${v.leyenda.map((l) => l.estado).join(",")} vs ${presentes.join(",")}`);
    ok(v.leyenda.every((l) => l.label === CAPITAL_ESTADOS[l.estado].label && l.color === CAPITAL_ESTADOS[l.estado].color),
      `barras-leyenda-una-fuente-${v.key}@${sc}`, "rótulo y color salen de CAPITAL_ESTADOS, no de una copia");
    // (f) REGISTRO FORMAL y sin causalidad: el gráfico ubica el capital, no explica por qué está ahí
    const txt = `${v.label} ${v.nota} ${v.lectura}`;
    const inf = txt.match(INFORMAL);
    ok(!inf, `barras-registro-${v.key}@${sc}`, inf ? `«${inf[0]}»` : "");
    ok(!/porque|se debe a|la causa|por culpa/i.test(txt), `barras-no-atribuye-${v.key}@${sc}`, txt.slice(0, 100));
    // (g) EL SELLO DE LOS DOS UNIVERSOS · acá no entra ni una cifra del universo comercial
    ok(!/\$[\d.,]+\s*M\b/.test(txt) && !/vend[eió]|factur/i.test(txt), `barras-un-solo-universo-${v.key}@${sc}`, txt.slice(0, 100));
  }
  // (h) EL FILTRO INMOVILIZADO ES EL MISMO UNIVERSO DEL KPI · si se separan, la cara dice dos verdades. Decisión
  // ·31/34a: antes el universo esperado era solo `capital_frenado`; ahora es crítico ∪ sobrestock.
  const inm = B && B.vistas.find((v) => v.key === "inmovilizado");
  const inmovilizados = new Set(D.perSku.filter((s) => s.estado === "capital_frenado" || s.estado === "sobrestock").map((s) => s.sku));
  ok(!!inm && inm.barras.filter((b) => !b.agrupado).every((b) => inmovilizados.has(b.sku)),
    `barras-inmovilizado-mismo-universo@${sc}`);
  const kpiDet = mc.kpis.find((k) => k.key === "detenido");
  ok(!!inm && !!kpiDet && inm.totalFmt === kpiDet.value, `barras-inmovilizado-vs-kpi@${sc}`,
    `${inm ? inm.totalFmt : "-"} vs ${kpiDet ? kpiDet.value : "-"}`);
}

/* ── (17) "A QUIÉN LE VENDÉS LO DETENIDO" · nombres y porcentajes, ni un peso (owner 2026-08-09) ───────────────
 * La matriz cliente×SKU es del universo COMERCIAL y el SKU detenido del de inventario. Se toma el reparto para
 * saber a quién le calza el producto —la pregunta accionable— y el monto se descarta en el acto: un "$X" al lado
 * de "$14K detenidos" se leería como que ese cliente tiene $14K parados. El gate verifica las tres cosas que lo
 * hacen honesto: que no sobreviva plata, que vaya sellado `indicado` (la matriz se construye por afinidad, no es
 * una transacción observada), y que la imposibilidad de "quiénes dejaron de comprar" esté DECLARADA. */
for (const sc of ["bonanza", "tension", "crisis"]) {
  const det = buildMesaCapital(sc).drill.detenido;
  const conC = det.filas.filter((f) => f.compradores);
  ok(det.filas.length === 0 || conC.length === det.filas.length, `compradores-en-todos@${sc}`,
    `${conC.length} de ${det.filas.length} filas detenidas traen a quién le calza`);
  for (const f of conC) {
    const campos = new Set(f.compradores.filas.flatMap((c) => Object.keys(c)));
    ok([...campos].every((k) => ["nombre", "pct", "pctFmt"].includes(k)), `compradores-sin-plata-${f.sku}@${sc}`,
      `campos: ${[...campos].join(",")} — solo nombre y participación`);
    ok(!/\$/.test(JSON.stringify(f.compradores)), `compradores-sin-signo-peso-${f.sku}@${sc}`);
    ok(f.compradores.filas.every((c) => c.pct >= 1 && c.pct <= 100), `compradores-pct-valido-${f.sku}@${sc}`);
    ok(f.compradores.estatus === "indicado", `compradores-indicado-${f.sku}@${sc}`,
      "la matriz se construye por afinidad: no es una transacción observada");
    // y no puede pisar el orden: la fila sigue ordenada por días sin venta, no por comprador
    ok(f.compradores.filas.every((c, i) => i === 0 || f.compradores.filas[i - 1].pct >= c.pct),
      `compradores-orden-${f.sku}@${sc}`, "los compradores van por peso descendente");
  }
  ok(/dejaron de comprar/i.test((det.faltan || []).join(" ")), `falta-dejaron-de-comprar@${sc}`,
    "la imposibilidad se declara, no se deja una columna hueca");
  ok(/afinidad/i.test(det.compradoresNota || "") && /participaci[óo]n/i.test(det.compradoresNota || ""),
    `compradores-nota@${sc}`, "la nota dice que es estimación y por qué va en participación");
}

/* ── (15) EL CANDADO DE LA DECISIÓN 2, BARRIDO SOBRE EL CÓDIGO ────────────────────────────────────────────────
 * No alcanza con revisar la salida del módulo: la palabra también vive en textos escritos a mano en la vista y
 * en el glosario, que es JUSTO donde alguien va a buscar la definición. Se barre el archivo, no la ejecución.
 * ⚠️ ADI queda fuera a propósito (vocabulario, composers, ranking): eso es comportamiento de ADI, no de Sentrix,
 * y tocarlo estaba prohibido en este pase. Ahí "cobertura" sigue siendo un alias válido de la métrica. */
{
  const superficies = ["src/adi/sentrix/mesaCapital.js", "src/adi/sentrix/glossary.js"];
  // Se miran los STRINGS EMITIDOS, no los comentarios: un comentario que explica por qué la palabra está prohibida
  // necesita nombrarla, y prohibirla ahí obligaría a documentar el candado sin poder decir qué candado es.
  const sinComentarios = (t) => t.replace(/\/\*[^]*?\*\//g, "").split("\n").filter((l) => !/^\s*(\/\/|\*)/.test(l)).join("\n");
  for (const f of superficies) {
    const txt = sinComentarios(fs.readFileSync(path.join(root, f), "utf8"));
    const enTexto = txt.match(/"[^"\n]*cobertura[^"\n]*"|'[^'\n]*cobertura[^'\n]*'|`[^`\n]*cobertura[^`\n]*`/gi) || [];
    ok(enTexto.length === 0, `candado-cobertura-${f}`, enTexto.join(" | ").slice(0, 160));
  }
  // y en la cara de la vista: los textos escritos a mano del panel de Capital.
  // DELIMITADOR ACTUALIZADO (R2-bis del retrabajo ultracode 2026-08-30): `CuadroCapital` — el viejo cierre del
  // bloque — se BORRÓ (huérfano sin punto de montaje); lo que sigue a la cara Capital ahora es el propio
  // SentrixPanel, así que el bloque se corta ahí. La propiedad vigilada no cambió.
  const panel = fs.readFileSync(path.join(root, "src/ui/SentrixPanel.jsx"), "utf8");
  const capIni = panel.indexOf("function MesaCapitalCara"), capFin = panel.indexOf("export function SentrixPanel");
  const bloqueCapital = capIni >= 0 && capFin > capIni ? panel.slice(capIni, capFin) : "";
  ok(bloqueCapital.length > 0 && !/cobertura/i.test(bloqueCapital), "candado-cobertura-cara-capital",
    (bloqueCapital.match(/[^.]*cobertura[^.]*/i) || [""])[0].slice(0, 120));
}

/* ── (20) CANDADO "INMOVILIZADO" · una palabra para una cosa (owner 2026-08-09) ────────────────────────────────
 * La cara decía "capital detenido" mientras el Perfil Ejecutivo, el glosario y los propios composers de ADI ya decían
 * "capital inmovilizado" — y encima el filtro del gráfico nuevo también. Dos palabras para el mismo dinero en la
 * misma pantalla. Se unificó en INMOVILIZADO, que es la palabra que ya existía en el resto del producto.
 * ⚠️ LAS `ask` TAMBIÉN CAMBIARON (owner 2026-08-15, autorización explícita). Hasta ese día quedaban exentas —eran
 * la ENTRADA de ADI y su vocabulario es contrato suyo—, pero un `ask` SE VE: es la burbuja del usuario cuando
 * alguien toca un KPI. Con la exención puesta, la pantalla seguía diciendo «¿Dónde está detenido mi capital?»
 * mientras el KPI de arriba decía «Capital inmovilizado». Así que el candado ya no perdona a las preguntas: en
 * este módulo solo sobrevive la clave interna `"detenido"`, que nadie lee. Que el motor SIGA entendiendo la forma
 * nueva se prueba abajo, contra el coercer — cambiar la palabra sin probar la entrada sería romper el chat.
 * Se barre el CÓDIGO —no la ejecución— porque una rama de texto que hoy no se dispara igual va a producción. */
{
  const src = fs.readFileSync(path.join(root, "src/adi/sentrix/mesaCapital.js"), "utf8");
  const sinComentarios = src.replace(/\/\*[^]*?\*\//g, "").split("\n").filter((l) => !/^\s*(\/\/|\*)/.test(l)).join("\n");
  const lits = sinComentarios.match(/"[^"\n]*detenid[^"\n]*"|'[^'\n]*detenid[^'\n]*'|`[^`\n]*detenid[^`\n]*`/gi) || [];
  // permitido: SOLO la clave interna `"detenido"` (no se lee en pantalla). Las preguntas ya no están exentas.
  const esClave = (s) => s === '"detenido"';
  const colados = lits.filter((s) => !esClave(s));
  ok(colados.length === 0, "candado-inmovilizado-modulo", colados.join(" | ").slice(0, 180));
  // …y en los textos escritos a mano de la cara Capital, que el módulo no controla
  const panel = fs.readFileSync(path.join(root, "src/ui/SentrixPanel.jsx"), "utf8");
  const sinCom = panel.replace(/\/\*[^]*?\*\//g, "").replace(/\{\s*\/\*[^]*?\*\/\s*\}/g, "");
  // (mismo delimitador nuevo que arriba — R2-bis: CuadroCapital borrado, el bloque termina donde empieza el panel)
  const ini = sinCom.indexOf("function MesaCapitalCara"), fin = sinCom.indexOf("export function SentrixPanel");
  const bloque = ini >= 0 && fin > ini ? sinCom.slice(ini, fin) : "";
  ok(bloque.length > 0 && !/detenid/i.test(bloque), "candado-inmovilizado-cara",
    (bloque.match(/[^.]*detenid[^.]*/i) || [""])[0].slice(0, 140));
  // el rótulo del estado y el KPI son LA misma palabra (si se separan, la card y la leyenda dejan de coincidir)
  /* R5 DEL EXAMEN 1 DEL AGENTE (2026-08-31): el canon pasó a «frenado» — el dinero de la card ERA el subconjunto
   * frenado (rotación bajo piso / DOH sobre techo), no el inmovilizado AMPLIO (estado ≠ Activo, $56K vs $33K en
   * el demo). Doctrina textual del owner (Examen 2): «usá la palabra que corresponde a la cifra que estés
   * citando». La INTENCIÓN de estos candados no cambia: jamás «detenido», y card+leyenda con LA misma palabra.
   *
   * DECISIÓN DEL OWNER 2026-09-28, §7.3·31/34a — «Apruebo completamente la separación entre inmovilizado,
   * inmovilizado crítico y frenado» — MIGRA el canon otra vez, la tercera migración del mismo rótulo (detenido →
   * inmovilizado → frenado → inmovilizado crítico). ANTES: `CAPITAL_ESTADOS.capital_frenado.label === "frenado"`
   * y el KPI de la card decía «Capital frenado» (con el valor del crítico solo). AHORA: «frenado» deja de nombrar
   * la regla de ROTACIÓN en superficie — esa regla es «inmovilizado crítico» — y la card pasa a «Capital
   * inmovilizado» con el valor del UNIVERSO (crítico ∪ sobrestock, `jerarquiaInventario().inmovilizado`). La
   * clave interna `capital_frenado`/`detenido` NO cambia (decisión ·31, campo de API) — jamás «detenido» en
   * superficie sigue vigente, y ahora tampoco «frenado» nombrando esta regla. */
  ok(CAPITAL_ESTADOS.capital_frenado.label === "inmovilizado crítico", "candado-inmovilizado-estado", CAPITAL_ESTADOS.capital_frenado.label);
  for (const sc of ["bonanza", "tension", "crisis"]) {
    const k = buildMesaCapital(sc).kpis.find((x) => x.key === "detenido");
    ok(k.label === "Capital inmovilizado", `candado-inmovilizado-kpi@${sc}`, k.label);
  }
}

/* ── (20b) LA PALABRA NUEVA TIENE QUE SEGUIR ENTRANDO AL CHAT (owner 2026-08-15) ────────────────────────────────
 * Un `ask` es SALIDA y ENTRADA a la vez. Cambiarle la palabra en pantalla es media tarea: si el motor deja de
 * reconocer la forma nueva, la Mesa queda preguntando algo que ADI ya no entiende y el usuario se come un
 * "no te sigo" en su primer click. Así que la forma NUEVA se compara con la VIEJA campo por campo — no basta con
 * que "responda algo", tiene que resolver al MISMO pedido. La forma vieja sigue viva como vocabulario de ENTRADA
 * (nadie deja de entender a un usuario que escribe «detenido»); lo que dejó de existir es en la superficie. */
{
  const EQUIVALENTES = [
    ["¿Dónde está detenido mi capital?", "¿Dónde está inmovilizado mi capital?"],
    ["Por qué el capital está detenido", "Por qué el capital está inmovilizado"],
    ["¿Qué pasa si libero el capital detenido?", "¿Qué pasa si libero el capital inmovilizado?"],
    ["¿Cómo libero el capital detenido en Valparaíso?", "¿Cómo libero el capital inmovilizado en Valparaíso?"],
    ["Qué SKU están detenidos", "Qué SKU están inmovilizados"],
    // R5 (2026-08-31) · la generación nueva: las ask de la Mesa dicen «frenado» y tienen que resolver al MISMO
    // pedido que las formas anteriores (probado IGUAL antes del corte — el vocabulario de entrada ya la traía).
    ["¿Dónde está inmovilizado mi capital?", "¿Dónde está frenado mi capital?"],
    ["Por qué el capital está inmovilizado", "Por qué el capital está frenado"],
    ["¿Qué pasa si libero el capital inmovilizado?", "¿Qué pasa si libero el capital frenado?"],
  ];
  for (const [viejo, nuevo] of EQUIVALENTES) {
    const a = coerceFloor(viejo, false, null), b = coerceFloor(nuevo, false, null);
    ok(!!b && !!b.operation, `ask-nueva-reclamada · «${nuevo}»`, JSON.stringify(b));
    ok(JSON.stringify(a) === JSON.stringify(b), `ask-nueva-equivalente · «${nuevo}»`,
      `vieja ${JSON.stringify(a)} · nueva ${JSON.stringify(b)}`);
  }
  // …y ninguna de las preguntas que la Mesa emite de verdad conserva la palabra vieja
  for (const sc of ["bonanza", "tension", "crisis"]) {
    const mc = buildMesaCapital(sc);
    const asks = [...mc.mapa.tramos, ...mc.kpis, ...mc.focos, ...mc.simulaciones].map((x) => x.ask)
      .concat([mc.reponer && mc.reponer.ask, mc.liquidar && mc.liquidar.ask])
      .concat(buildCuadroCapital(sc, "sku").rows.map((r) => r.accionAsk))
      .concat(buildCuadroCapital(sc, "bodega").rows.map((r) => r.accionAsk))
      .filter((s) => typeof s === "string");
    const sucias = asks.filter((s) => /detenid/i.test(s));
    ok(sucias.length === 0, `ask-sin-palabra-vieja@${sc}`, sucias.join(" | ").slice(0, 160));
  }
}

// los rótulos/definiciones de los estados también van formales (una sola vez — no dependen del escenario)
for (const [k, e] of Object.entries(CAPITAL_ESTADOS)) {
  const m = `${e.label} ${e.def} ${e.ask}`.match(INFORMAL);
  ok(!m, `registro-estado-${k}`, m ? `«${m[0]}»` : "");
}

/* ── DECISIÓN 13 · LA TARJETA VUELVE SOLA CUANDO EL DATO LA SOSTIENE ────────────────────────────────────────────
 * Retirar la recomendación de transferir no puede ser un texto borrado a mano: eso la mata para siempre, incluso
 * el día que el ERP traiga el mismo SKU en dos bodegas. La condición vive en el DATO, y acá se prueba en las dos
 * direcciones sobre el mismo inventario real: tal como está → no evaluable; con UNA fila duplicada en otra bodega
 * → evaluable, con su motivo cambiado. Si alguien vuelve a hardcodear el `false`, esta prueba se cae. */
{
  const base = applyScenarioToSkuInventario("bonanza") || [];
  const hoy = transferenciaCapability(base);
  ok(hoy.evaluable === false && /no se puede evaluar/i.test(hoy.motivo), "transferencia-hoy-no-evaluable", hoy.motivo);

  const otraBodega = [...new Set(base.map((x) => x.bodega))].find((b) => b !== base[0].bodega);
  const conDuplicado = [...base, { ...base[0], bodega: otraBodega }];
  const manana = transferenciaCapability(conDuplicado);
  ok(manana.evaluable === true && manana.skusMultiBodega === 1 && /más de una bodega/i.test(manana.motivo),
    "transferencia-vuelve-sola", `evaluable=${manana.evaluable} · multi=${manana.skusMultiBodega} · «${manana.motivo}»`);

  // LA TARJETA DEL PANEL. El texto de la tarjeta estructural lo emite el MOTOR (`_caminoEstructural`), no la vista:
  // por eso el candado se puede pedir sobre la fuente sin ambigüedad — dentro del ControlRing no puede quedar NI UNA
  // palabra de transferencia escrita a mano, porque cualquier literal ahí sería una recomendación que el dato no
  // condiciona. (Mismo método de lectura de fuente que el candado de "inmovilizado" de más arriba.)
  const src = fs.readFileSync(path.join(root, "src/ui/SentrixPanel.jsx"), "utf8")
    .replace(/\/\*[^]*?\*\//g, "").replace(/\{\s*\/\*[^]*?\*\/\s*\}/g, "");
  const iR = src.indexOf("function ControlRing"), fR = src.indexOf("function CuadroMando");
  const ring = iR >= 0 && fR > iR ? src.slice(iR, fR) : "";
  ok(ring.length > 0 && !/transferi|mover lo lento|redistribu/i.test(ring), "panel-transferencia-condicionada",
    `el ControlRing escribe la transferencia a mano en vez de recibirla del motor: «${(ring.match(/[^\n]*(transferi|mover lo lento|redistribu)[^\n]*/i) || [""])[0].trim().slice(0, 120)}»`);
  // la tarjeta que la vista pinta HOY, con el dato real: sin transferencia y con el límite dicho
  // el título NO puede proponerla y el detalle NO puede describir el movimiento; el límite, en cambio, SÍ tiene que
  // estar dicho (callarlo sería el otro modo de deshonestidad: retirar la palanca sin explicar por qué).
  const hoyCard = buildControlRing("bodega", base[0].bodega, "bonanza").transferencia;
  ok(!/transferi|redistribu/i.test(hoyCard.titulo) && !/mover lo lento/i.test(hoyCard.detalle) && /no se puede evaluar/i.test(hoyCard.detalle),
    "panel-tarjeta-sin-transferencia", `la tarjeta estructural sigue proponiendo transferir: «${hoyCard.titulo} · ${hoyCard.detalle}»`);
  // y la MISMA función, con el mismo SKU en dos bodegas, la recupera entera: la recomendación no está borrada
  const mananaCard = caminoEstructural(manana);
  ok(/transferir/i.test(mananaCard.titulo) && /mover lo lento/i.test(mananaCard.detalle),
    "panel-tarjeta-vuelve-sola", `con el dato que la sostiene la tarjeta no vuelve: «${mananaCard.titulo} · ${mananaCard.detalle}»`);

  // y la lectura ejecutiva vuelve a proponerla con ese mismo hecho — la condición es una, no una por superficie
  const sig = buildCapitalSignals("bonanza");
  const recSi = buildReadingFromSignals({ ...sig, why: { ...sig.why, driver: { ...sig.why.driver, lento: true, transferible: true } } }).recommendation;
  const recNo = buildReadingFromSignals({ ...sig, why: { ...sig.why, driver: { ...sig.why.driver, lento: true, transferible: false } } }).recommendation;
  ok(/transferencia/i.test(recSi) && !/transferencia/i.test(recNo), "lectura-condicionada-al-dato",
    `con dato: «${recSi}» · sin dato: «${recNo}»`);
}

console.log(`── _mesa_capital_gate: ${pass} verificaciones · ${fail} rotas ──`);
if (rotos.length) { console.log("✗ ROTAS:"); rotos.forEach((r) => console.log(`   [${r.tag}] ${r.detail}`)); }
process.exit(fail ? 1 : 0);
