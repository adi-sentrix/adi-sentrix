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

// los rótulos/definiciones de los estados también van formales (una sola vez — no dependen del escenario)
for (const [k, e] of Object.entries(CAPITAL_ESTADOS)) {
  const m = `${e.label} ${e.def} ${e.ask}`.match(INFORMAL);
  ok(!m, `registro-estado-${k}`, m ? `«${m[0]}»` : "");
}

console.log(`── _mesa_capital_gate: ${pass} verificaciones · ${fail} rotas ──`);
if (rotos.length) { console.log("✗ ROTAS:"); rotos.forEach((r) => console.log(`   [${r.tag}] ${r.detail}`)); }
process.exit(fail ? 1 : 0);
