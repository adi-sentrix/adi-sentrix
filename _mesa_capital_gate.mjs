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
const root = process.cwd(); const entry = path.join(root, "_mcge.js"), out = path.join(root, "_mcgb.mjs");
fs.writeFileSync(entry, [
  'export { buildMesaCapital, buildCuadroCapital, CAPITAL_ESTADOS } from "./src/adi/sentrix/mesaCapital.js";',
  'export { diagnoseInventario } from "./src/adi/diagnosis/economicDiagnosis.js";',
  'export { applyScenarioToSkuInventario } from "./src/engine/scenarios.js";',
  'export { composeSpecDiagnose } from "./src/adi/specRetrieval.js";',
].join("\n"));
await esbuild.build({ entryPoints: [entry], bundle: true, outfile: out, format: "esm", platform: "node", logLevel: "silent" });
const M = await import(pathToFileURL(out).href + "?t=" + Math.random());
try { fs.unlinkSync(entry); } catch { /* */ } try { fs.unlinkSync(out); } catch { /* */ }
const { buildMesaCapital, buildCuadroCapital, CAPITAL_ESTADOS, diagnoseInventario, applyScenarioToSkuInventario, composeSpecDiagnose } = M;

let pass = 0, fail = 0; const rotos = [];
const ok = (cond, tag, detail) => { if (cond) pass++; else { fail++; rotos.push({ tag, detail: detail || "" }); } };
const INFORMAL = /\b(vara|plata|dormid[oa]s?|guita|palancas?|flojo)\b/i;   // formal en superficie (benchmark, no vara — adi-lenguaje-formal)

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

  // (7) la pata de inventario del "En alerta" cuenta los MISMOS críticos del dato (frenado + alerta crit)
  const critOracle = D.perSku.filter((s) => s.estado === "capital_frenado").filter((s) => { const r = inv.find((x) => x.sku === s.sku); return r && r.alerta === "crit"; }).length;
  ok(mc.alertas.n === critOracle, `alertas-criticos@${sc}`, `pata ${mc.alertas.n} vs dato ${critOracle}`);
  ok(mc.alertas.usd === detSubtotal, `alertas-usd@${sc}`, `pata ${mc.alertas.usd} vs detector ${detSubtotal}`);
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
  const porEstado = { detenido: "capital_frenado", quiebres: "riesgo_quiebre" };
  for (const [k, estado] of Object.entries(porEstado)) {
    const filas = mc.drill[k].filas;
    ok(filas.every((f) => f.estado === estado), `drill-${k}-solo-su-universo@${sc}`, `alguna fila no es ${estado}`);
    ok(filas.length === (D.dist[estado] || { count: 0 }).count, `drill-${k}-completo@${sc}`,
      `${filas.length} filas vs ${(D.dist[estado] || {}).count} del motor`);
    const suma = filas.reduce((a, f) => a + f.usd, 0);
    ok(suma === (D.dist[estado] || { usd: 0 }).usd, `drill-${k}-suma@${sc}`, `${suma} vs ${(D.dist[estado] || {}).usd}`);
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

/* ── (18) EL EJE DE TIEMPO · una segunda partición del mismo capital (owner 2026-08-09) ───────────────────────
 * Se evaluaron siete visualizaciones de dashboard logístico y esta fue la única que el dato sostiene y que aporta:
 * el mismo total partido por "desde cuándo", ortogonal a la partición por estado. Lo que el gate cuida es lo que
 * la vuelve honesta: que cierre exacto como los otros cortes, que se llame DÍAS SIN VENTA —no "antigüedad en
 * bodega", que exigiría una fecha de recepción que no existe— y que NO se presente como una causa. */
for (const sc of ["bonanza", "tension", "crisis"]) {
  const mc = buildMesaCapital(sc);
  const D = diagnoseInventario(applyScenarioToSkuInventario(sc) || [], {});
  const edad = mc.cortes.vistas.find((v) => v.key === "edad");
  ok(!!edad, `corte-edad-existe@${sc}`);
  if (edad) {
    ok(edad.suma === D.total, `corte-edad-cierra@${sc}`, `${edad.suma} vs ${D.total}`);
    // ORDEN CRONOLÓGICO: un eje de tiempo leído por capital no dice nada
    const orden = ["0–30 días", "31–60 días", "61–90 días", "Más de 90 días"];
    const pos = edad.filas.map((f) => orden.indexOf(f.nombre));
    ok(pos.every((v, i) => v >= 0 && (i === 0 || pos[i - 1] < v)), `corte-edad-cronologico@${sc}`, pos.join(","));
    // SE LLAMA POR SU NOMBRE · "antigüedad/almacenado/aging" prometería una fecha de recepción que no existe
    const txt = `${edad.label} ${edad.pareto.lectura} ${edad.filas.map((f) => f.nombre).join(" ")}`;
    ok(/d[íi]as sin venta/i.test(edad.label), `corte-edad-nombre@${sc}`, `se llama «${edad.label}»`);
    ok(!/almacenad|en bodega hace|aging|antig[üu]edad en/i.test(txt), `corte-edad-no-promete-almacenaje@${sc}`,
      "sin fecha de recepción no se puede hablar de tiempo almacenado");
    // NO ES UNA CAUSA · el bloque enmarca, no explica
    ok(!/porque|se debe a|la causa/i.test(txt), `corte-edad-no-atribuye@${sc}`, txt.slice(0, 90));
    ok(/no por qu[ée]|dice desde cu[áa]ndo/i.test(edad.pareto.lectura) || !/m[áa]s de 60/i.test(edad.pareto.lectura),
      `corte-edad-declara-limite@${sc}`, "cuando afirma antigüedad, aclara que no explica");
  }
  // los TRES cortes siguen cerrando: agregar un eje no puede romper la reconciliación de los otros
  ok(mc.cortes.vistas.length === 3 && mc.cortes.vistas.every((v) => v.suma === D.total),
    `tres-cortes-cierran@${sc}`, mc.cortes.vistas.map((v) => `${v.key}:${v.suma}`).join(" "));
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
    // (b) EL TOTAL ES EL DEL MOTOR · no una suma paralela que empiece a derivar
    const esperado = v.key === "general" ? D.total : D.perSku.filter((s) => s.estado === "capital_frenado").reduce((a, s) => a + s.capital, 0);
    ok(v.total === esperado, `barras-total-vs-motor-${v.key}@${sc}`, `${v.total} vs ${esperado}`);
    ok(v.n === (v.key === "general" ? D.perSku.length : D.perSku.filter((s) => s.estado === "capital_frenado").length),
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
  // (h) EL FILTRO INMOVILIZADO ES EL MISMO UNIVERSO DEL KPI · si se separan, la cara dice dos verdades
  const inm = B && B.vistas.find((v) => v.key === "inmovilizado");
  const frenados = new Set(D.perSku.filter((s) => s.estado === "capital_frenado").map((s) => s.sku));
  ok(!!inm && inm.barras.filter((b) => !b.agrupado).every((b) => frenados.has(b.sku)),
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
  // y en la cara de la vista: los textos escritos a mano del panel de Capital
  const panel = fs.readFileSync(path.join(root, "src/ui/SentrixPanel.jsx"), "utf8");
  const capIni = panel.indexOf("function MesaCapitalCara"), capFin = panel.indexOf("function CuadroCapital");
  const bloqueCapital = capIni >= 0 && capFin > capIni ? panel.slice(capIni, capFin) : "";
  ok(bloqueCapital.length > 0 && !/cobertura/i.test(bloqueCapital), "candado-cobertura-cara-capital",
    (bloqueCapital.match(/[^.]*cobertura[^.]*/i) || [""])[0].slice(0, 120));
}

/* ── (20) CANDADO "INMOVILIZADO" · una palabra para una cosa (owner 2026-08-09) ────────────────────────────────
 * La cara decía "capital detenido" mientras la Ficha, el glosario y los propios composers de ADI ya decían
 * "capital inmovilizado" — y encima el filtro del gráfico nuevo también. Dos palabras para el mismo dinero en la
 * misma pantalla. Se unificó en INMOVILIZADO, que es la palabra que ya existía en el resto del producto.
 * ⚠️ LO QUE NO CAMBIÓ, A PROPÓSITO: las `ask` que Sentrix le manda a ADI. Ese texto es la ENTRADA de ADI, su
 * vocabulario es contrato suyo y tocarlo estaba fuera de alcance en este pase. Por eso el candado permite las
 * preguntas y prohíbe todo lo demás: si mañana alguien escribe un rótulo con la palabra vieja, salta acá.
 * Se barre el CÓDIGO —no la ejecución— porque una rama de texto que hoy no se dispara igual va a producción. */
{
  const src = fs.readFileSync(path.join(root, "src/adi/sentrix/mesaCapital.js"), "utf8");
  const sinComentarios = src.replace(/\/\*[^]*?\*\//g, "").split("\n").filter((l) => !/^\s*(\/\/|\*)/.test(l)).join("\n");
  const lits = sinComentarios.match(/"[^"\n]*detenid[^"\n]*"|'[^'\n]*detenid[^'\n]*'|`[^`\n]*detenid[^`\n]*`/gi) || [];
  // permitido: la clave interna `"detenido"` (no se lee en pantalla) y las preguntas que van a ADI
  // ojo con `\b` después de una vocal acentuada: `é` no es `\w`, así que no hay borde y la prueba falla siempre
  const esAsk = (s) => /^["'`]\s*(¿|Por qué\s)/.test(s);
  const esClave = (s) => s === '"detenido"';
  const colados = lits.filter((s) => !esAsk(s) && !esClave(s));
  ok(colados.length === 0, "candado-inmovilizado-modulo", colados.join(" | ").slice(0, 180));
  // …y en los textos escritos a mano de la cara Capital, que el módulo no controla
  const panel = fs.readFileSync(path.join(root, "src/ui/SentrixPanel.jsx"), "utf8");
  const sinCom = panel.replace(/\/\*[^]*?\*\//g, "").replace(/\{\s*\/\*[^]*?\*\/\s*\}/g, "");
  const ini = sinCom.indexOf("function MesaCapitalCara"), fin = sinCom.indexOf("function CuadroCapital");
  const bloque = ini >= 0 && fin > ini ? sinCom.slice(ini, fin) : "";
  ok(bloque.length > 0 && !/detenid/i.test(bloque), "candado-inmovilizado-cara",
    (bloque.match(/[^.]*detenid[^.]*/i) || [""])[0].slice(0, 140));
  // el rótulo del estado y el KPI son LA misma palabra (si se separan, la card y la leyenda dejan de coincidir)
  ok(CAPITAL_ESTADOS.capital_frenado.label === "inmovilizado", "candado-inmovilizado-estado", CAPITAL_ESTADOS.capital_frenado.label);
  for (const sc of ["bonanza", "tension", "crisis"]) {
    const k = buildMesaCapital(sc).kpis.find((x) => x.key === "detenido");
    ok(k.label === "Capital inmovilizado", `candado-inmovilizado-kpi@${sc}`, k.label);
  }
}

// los rótulos/definiciones de los estados también van formales (una sola vez — no dependen del escenario)
for (const [k, e] of Object.entries(CAPITAL_ESTADOS)) {
  const m = `${e.label} ${e.def} ${e.ask}`.match(INFORMAL);
  ok(!m, `registro-estado-${k}`, m ? `«${m[0]}»` : "");
}

console.log(`── _mesa_capital_gate: ${pass} verificaciones · ${fail} rotas ──`);
if (rotos.length) { console.log("✗ ROTAS:"); rotos.forEach((r) => console.log(`   [${r.tag}] ${r.detail}`)); }
process.exit(fail ? 1 : 0);
