/* === _corpus_aceptacion_gate.mjs · EL CORPUS DE ACEPTACIÓN · LAS 15 PREGUNTAS (owner 2026-08-09) ==============
 *
 * QUÉ ES. Las quince preguntas con las que el owner cerró el Contrato de Concordancia. Cada una nació anclada a un
 * defecto VERIFICADO en el producto, y al abrir este pase las quince fallaban. El criterio de aprobación es del
 * owner y es literal: «respondibles o declinadas honestamente» — declinar bien es aprobar. Una pregunta que el dato
 * no puede contestar y que ADI contesta igual es un fallo; la misma pregunta declinada con la razón medida es un
 * acierto.
 *
 * CÓMO SE VERIFICA, SIN UNA SOLA LLAMADA A UN LLM. Cada pregunta trae su PLAN escrito a mano —las mismas tool-calls
 * que el planificador emitiría, pero fijas, para que el resultado sea reproducible byte a byte— y se mide en tres
 * puntas:
 *   · COBERTURA   qué declara cada tool: `supported` con su razón verificable, o la declinación honesta.
 *   · LEDGER      qué cifras quedan AUTORIZADAS, con su tipo completo (universo · período · escenario · sello ·
 *                 dueño). Es lo único que ADI tiene permitido decir, así que es donde se prueba que la respuesta
 *                 existe — o que no existe y por eso hay que declinar.
 *   · GUARDC      la narración CANDIDATA pasa por el muro. Para las preguntas cuyo defecto era una afirmación
 *                 falsa sobre cifras verdaderas (cruzar universos, atribuir el total a una cuenta, recomendar lo
 *                 inevaluable) se prueban LAS DOS: la versión honesta pasa y la versión defectuosa se bloquea.
 *                 Un muro que sólo dice que sí no prueba nada.
 *
 * EL ESCENARIO. `bonanza` — el que el producto muestra por defecto y del que salen las cifras que el owner citó en
 * sus preguntas ($36K de quiebre, $135K de capital, 6,0x de rotación, $4,1M de acciones, $18,5M de resultado). Las
 * cifras NO están escritas acá: se leen del builder vivo en cada corrida y se comparan contra la punta oficial
 * (`headline.js`), que es la misma función que pinta la card. Si el dato cambia, este gate se mueve con él.
 *
 * CERO RED · CERO LLM · CERO CRÉDITOS.  node _corpus_aceptacion_gate.mjs
 */
import { runPlan } from "./src/adi/oracle/toolRunner.js";
import { ledgerBoleta } from "./src/adi/oracle/ledger.js";
import { guardC } from "./src/adi/oracle/guardC.js";
import { resolveGlossary } from "./src/adi/sentrix/glossary.js";
import { headlineTotal } from "./src/adi/sentrix/headline.js";
import { transferenciaCapability } from "./src/adi/sentrix/capability.js";
import { ensureTransferenciaDeclarada, stripSingleRowTables, stripRedundantTemporalTable, stripPerfilCompletoTable } from "./src/adi/oracle/narratePromptC.js";   // la garantía C1 + los 3 backstops de forma (defecto A4): se prueban tal como corren en producción
// LA RUTA PUNTUAL DEL MOTOR (defecto C2) — las dos funciones PURAS que componen la respuesta determinística, sin
// proveedor de por medio: acá se mide la salida REAL del motor, no una narración hipotética escrita en el gate.
import { simpleEntityMetric, rutaDeterministica } from "./src/adi/oracle/answerViaOracle.js";
import { applyScenarioToSkuInventario } from "./src/engine/scenarios.js";
import { SELLOS, PERIODOS } from "./src/config/contract/figureType.js";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { setPnlLines, clearPnl, resetPnlDraft } from "./src/adi/pnl.js";
// LA FORMA DEL TURNO Y EL CATÁLOGO QUE VE EL PLANIFICADOR — los dos se DERIVAN, no se asumen (ver preguntas 11 y 13).
import { resolveTablePolicy, podarPlanProgresivo } from "./src/adi/oracle/progressiveDisclosure.js";
import { TOOL_CATALOG } from "./src/adi/oracle/planPrompt.js";

let PASS = 0, FAIL = 0;
const filaPorPregunta = [];
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("    ✓ " + m); } else { FAIL++; console.log("    ✗ " + m + (extra ? "\n        " + extra : "")); } return !!c; };

initTenant(TENANT_DEMO);
const SCN = "bonanza";
// Las MISMAS tres líneas con las que `_pnl_gate` y `_pnl_canonico_gate` miden la cascada desde siempre — el
// resultado del negocio sólo existe con gastos declarados, y este corpus mide el mismo P&L que esos gates.
clearPnl(); resetPnlDraft();
setPnlLines([{ nombre: "Logística", pct: 3 }, { nombre: "Marketing", pct: 1.5 }, { nombre: "Promotores", pct: 2 }]);

const _norm = (s) => String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const figDe = (figs, re) => figs.find((f) => re.test(f.label)) || null;
const figsDe = (figs, re) => figs.filter((f) => re.test(f.label));
const sujetoDe = (f) => String(f.label).split(" · ")[0];

/* ── EL BANCO · una pregunta = un plan fijo, una expectativa y sus pruebas ──────────────────────────────────── */
const CORPUS = [];
const pregunta = (n, q, espera, calls, prueba) => CORPUS.push({ n, q, espera, calls, prueba });

/* ══ 1 · «¿Cuánto vende SAM-TV55 y cuánto stock tiene?» ═══════════════════════════════════════════════════════
 * EL DEFECTO: venta e inventario son universos DISTINTOS (miles vs dólares crudos, año cerrado vs foto de hoy) y
 * se estaban dividiendo entre sí. La respuesta correcta da las dos cifras con SU marco y no las cruza. */
pregunta(1, "¿Cuánto vende SAM-TV55 y cuánto stock tiene?", "responde",
  [{ tool: "entityRecord", args: { dimension: "sku", entity: "SAM-TV55" } }],
  ({ figs, results, guard, q, calls }) => {
    const venta = figDe(figs, /^SAM-TV55 · Ventas$/);
    const stock = figDe(figs, /^SAM-TV55 · Valor de inventario$/);
    ok(results[0].coverage.supported === true, "entityRecord responde por el SKU");
    ok(venta && venta.tipo.universo === "venta_comercial" && venta.tipo.periodo === "anual",
      `la venta declara universo venta_comercial y período anual — ${venta && venta.value}`,
      venta ? `universo=${venta.tipo.universo} periodo=${venta.tipo.periodo}` : "no está la fig de venta");
    ok(stock && stock.tipo.universo === "inventario" && stock.tipo.periodo === "hoy",
      `el stock declara universo inventario y período hoy — ${stock && stock.value}`,
      stock ? `universo=${stock.tipo.universo} periodo=${stock.tipo.periodo}` : "no está la fig de inventario");
    const per = results[0].facts.periodos || [];
    ok(per.includes("anual") && per.includes("hoy"), `la respuesta declara LOS DOS marcos — [${per.join(", ")}]`);
    // la versión honesta pasa …
    const buena = `SAM-TV55 vendió ${venta && venta.value} en el año cerrado. Su inventario a hoy es de ${stock && stock.value}.`;
    const gB = guard(buena);
    ok(gB.ok, "la lectura que da las dos cifras POR SEPARADO pasa el muro", JSON.stringify(gB.violations));
    // … y la que las ATA (el defecto original: dividir un mundo por el otro) se bloquea
    const mala = `El stock de ${stock && stock.value} cubre ${venta && venta.value} de venta anual.`;
    const gM = guard(mala);
    ok(gM.violations.some((v) => v.kind === "cruce-de-universos"), "atar el inventario a la venta se BLOQUEA (cruce-de-universos)",
      `verdict=${gM.verdict} · ${JSON.stringify(gM.violations.map((v) => v.kind))}`);
    // LA RESPUESTA QUE EL MOTOR COMPONE DE VERDAD (owner 2026-08-10, certificación live · defecto C2). Hasta acá
    // el gate probaba que la lectura correcta PODÍA pasar el muro. En vivo, la que salió fue otra: sólo el stock,
    // sin la venta y sin declinarla — porque el extractor de métricas era sustantivo puro y no reconocía "vende",
    // así que el motor creyó que la pregunta tenía UNA sola métrica. Se mide la salida REAL, no una hipotética.
    const plan1 = { intent: "answer", mode: "default", scope: { level: "entity", entities: ["SAM-TV55"] }, calls };
    const simple = simpleEntityMetric(q, plan1, calls, results);
    ok(!!simple && simple.campos && simple.campos.length === 2,
      "el motor reconoce LAS DOS métricas de la pregunta (incluida la forma verbal «vende»)",
      simple ? `campos=${JSON.stringify((simple.campos || []).map((x) => x.token))}` : "no se activó la ruta puntual");
    const texto = simple ? rutaDeterministica({ contentScope: "full", detailLevel: "standard" }, simple) : "";
    ok(/venta de SAM-TV55/i.test(texto) && /valor de inventario de SAM-TV55/i.test(texto),
      "entrega LAS DOS cifras — la venta ya no se pierde en silencio", texto);
    ok(/no se comparan entre sí/i.test(texto) && /universos distintos/i.test(texto),
      "y DECLARA por qué no se comparan, en vez de omitir una", texto);
    const gDet = guard(texto);
    ok(gDet.ok, "esa respuesta compuesta pasa el muro (sin cifras que el ledger no autorice)", JSON.stringify(gDet.violations));
    return `venta ${venta && venta.value} (anual) · stock ${stock && stock.value} (hoy) · el cruce bloquea · las 2 se entregan con su universo declarado`;
  });

/* ══ 2 · «Por local, ¿quién queda bajo el plan?» ══════════════════════════════════════════════════════════════
 * EL DEFECTO (decisión 8): las sucursales del negocio son BODEGAS de inventario y no tienen venta ni presupuesto
 * propios. Las tools comerciales caían en silencio al eje `cliente` y devolvían un ranking de CUENTAS como si
 * fueran locales: cifras reales contestando otra pregunta. La respuesta correcta DECLINA. */
pregunta(2, "Por local, ¿quién queda bajo el plan?", "declina",
  [{ tool: "salesRead", args: { dimension: "bodega", focus: "vs_presupuesto" } },
   { tool: "marginRead", args: { dimension: "bodega", focus: "bajo_benchmark" } },
   { tool: "gridTable", args: { dimension: "bodega" } }],
  ({ figs, results }) => {
    for (const r of results) {
      ok(r.coverage.supported === false, `${r.tool} DECLINA el eje bodega`,
        `supported=${r.coverage.supported} · devolvió ${(r.boleta || []).length} cifras`);
      ok(/bodega/i.test(String(r.coverage.reason || "")), `${r.tool} nombra el eje que no puede abrir en su razón`,
        String(r.coverage.reason || "(sin razón)"));
    }
    ok(figs.length === 0, "el ledger queda VACÍO: ninguna fila de otro eje se presenta como si fuera un local",
      figs.slice(0, 6).map((f) => f.label).join(" · "));
    // y la salida honesta existe: por bodega SÍ hay capital de inventario
    const alt = runPlan({ intent: "answer", calls: [{ tool: "queryMetric", args: { metric: "capital", dimension: "bodega" } }] }, { scenario: SCN });
    const altFigs = ledgerBoleta(alt.ledger);
    ok(alt.results[0].coverage.supported === true && altFigs.length > 0,
      `la alternativa real SÍ existe: el capital por bodega responde — ${altFigs.slice(0, 3).map((f) => `${f.label}=${f.value}`).join(" · ")}`);
    // LA DECLINACIÓN NO PUEDE SER UN NO GENÉRICO: los ejes que estas mismas tools SÍ abren siguen respondiendo, y
    // una variante de escritura del eje ("clientes", "SKU") NO es un eje ajeno — antes caía al mismo fallback
    // silencioso que `bodega` y contestaba con las cuentas.
    const abren = [["marginRead", "sku"], ["salesRead", "cliente"], ["contributionRead", "familia"], ["marginRead", "SKU"], ["salesRead", "clientes"]];
    for (const [tool, dim] of abren) {
      const p = runPlan({ intent: "answer", calls: [{ tool, args: { dimension: dim } }] }, { scenario: SCN });
      const sujetos = [...new Set(ledgerBoleta(p.ledger).map((f) => sujetoDe(f)))];
      ok(p.results[0].coverage.supported === true && sujetos.length > 0,
        `${tool}{${dim}} sigue respondiendo su propio eje — ${sujetos.slice(0, 3).join(", ")}`,
        String(p.results[0].coverage.reason || ""));
    }
    return `las 3 tools comerciales declinan el eje bodega · ledger vacío · queda la salida por capital`;
  });

/* ══ 3 · «¿Qué es el margen bruto?» ══════════════════════════════════════════════════════════════════════════
 * EL DEFECTO (decisión 10): «margen bruto» y «margen de contribución» resolvían a la MISMA entrada. Son dos
 * peldaños distintos de la cascada y confundirlos cambia la lectura del negocio. */
pregunta(3, "¿Qué es el margen bruto?", "responde",
  [{ tool: "defineConcept", args: { concept: "margen bruto" } },
   { tool: "defineConcept", args: { concept: "margen de contribución" } }],
  ({ results }) => {
    const [bruto, contrib] = results;
    ok(bruto.coverage.supported === true, "el glosario define «margen bruto»");
    const d = _norm(bruto.facts && bruto.facts.definicion);
    ok(/costo/.test(d), "la definición nombra el COSTO de lo vendido");
    ok(/todavia no descont|antes|aun no descont/.test(d) && /acciones comerciales/.test(d),
      "declara que es ANTES de las acciones comerciales", d.slice(0, 160));
    ok(contrib.coverage.supported === true && _norm(contrib.facts.concepto) !== _norm(bruto.facts.concepto),
      `«margen de contribución» resuelve a OTRA entrada — «${bruto.facts.concepto}» vs «${contrib.facts.concepto}»`);
    ok(/margen de contribucion/.test(_norm(bruto.facts.distingue || "")),
      "la entrada del bruto DISTINGUE explícitamente del margen de contribución");
    return `«${bruto.facts.concepto}» ≠ «${contrib.facts.concepto}» · el bruto se declara antes de las acciones comerciales`;
  });

/* ══ 4 · «¿Qué son las acciones comerciales? ¿Y los días de inventario?» ══════════════════════════════════════
 * EL DEFECTO (decisión 10): las etiquetas VISIBLES de pantalla no tenían entrada en el glosario, y «cobertura»
 * nombraba dos cosas. La respuesta correcta define las dos y las ata a su métrica: carga (%) y doh (días). */
pregunta(4, "¿Qué son las acciones comerciales? ¿Y los días de inventario?", "responde",
  [{ tool: "defineConcept", args: { concept: "acciones comerciales" } },
   { tool: "defineConcept", args: { concept: "días de inventario" } }],
  ({ results }) => {
    const [acc, dias] = results;
    ok(acc.coverage.supported === true, "el glosario define «acciones comerciales»");
    ok(/rebate|descuento/.test(_norm(acc.facts.definicion)), "las acciones comerciales se definen como rebates/descuentos (el MONTO)");
    ok(/carga comercial/.test(_norm(acc.facts.distingue || "")), "distingue el monto ($) de la carga comercial (%)");
    ok(dias.coverage.supported === true, "el glosario define «días de inventario»");
    ok(/dias que dura el stock|ritmo de venta/.test(_norm(dias.facts.definicion)), "los días de inventario se definen sobre el ritmo de venta (doh)");
    const cob = resolveGlossary("cobertura");
    ok(cob && _norm(cob.aka) === _norm(dias.facts.concepto),
      `«cobertura» resuelve a la MISMA entrada, no a una segunda métrica — «${cob && cob.aka}»`);
    return `acciones = monto ($) vs carga = tasa (%) · días de inventario = doh · «cobertura» ya no es una segunda métrica`;
  });

/* ══ 5 · «¿Qué quiere decir que esta cifra sea "indicada"?» ═══════════════════════════════════════════════════
 * EL DEFECTO (decisión 2): el sello se mostraba sin que el producto pudiera explicarlo. */
pregunta(5, "¿Qué quiere decir que esta cifra sea \"indicada\"?", "responde",
  [{ tool: "defineConcept", args: { concept: "indicado" } }],
  ({ results }) => {
    const d = results[0];
    ok(d.coverage.supported === true, "el glosario define el sello «indicado»");
    const t = _norm(d.facts.definicion);
    ok(/estimacion|supuesto|afinidad|distribucion|inferencia/.test(t),
      "la definición nombra estimación / supuesto / distribución / afinidad", t.slice(0, 160));
    const otros = SELLOS.filter((s) => s !== "indicado").map((s) => [s, resolveGlossary(s)]);
    ok(otros.every(([, x]) => !!x), `los otros dos sellos también están definidos — ${otros.map(([s]) => s).join(", ")}`);
    ok(/probado/.test(_norm(d.facts.distingue || "")) && /abierto/.test(_norm(d.facts.distingue || "")),
      "la entrada distingue «indicado» de «probado» y de «abierto»");
    return `indicado = dato CONDICIONADO por un supuesto · los tres sellos definidos y contrastados`;
  });

/* ══ 6 · «Los quiebres próximos son $36K, ¿en qué SKU?» ══════════════════════════════════════════════════════ */
pregunta(6, "Los quiebres próximos son $36K, ¿en qué SKU?", "responde",
  [{ tool: "inventoryStatus", args: { focus: "quiebre" } }],
  ({ figs, results, guard }) => {
    const total = figDe(figs, /^Riesgo de quiebre · total$/);
    const inv = results[0].facts.inventory;
    ok(results[0].coverage.supported === true && !!total, `el foco quiebre responde con su total — ${total && total.value}`);
    const skus = (inv.bySku || []).map((r) => r.sku);
    ok(skus.length > 0 && skus.every((s) => figs.some((f) => f.label.startsWith(s + " · "))),
      `cada SKU en riesgo entra autorizado al ledger — ${skus.join(" · ")}`);
    const stgo = (inv.byBodega || []).find((b) => /santiago/i.test(b.bodega));
    ok(!!stgo && figs.some((f) => sujetoDe(f) === stgo.bodega),
      `la bodega que concentra el riesgo entra con su cifra — ${stgo && stgo.bodega} ${stgo && stgo.pct}%`);
    const malos = figsDe(figs, /Riesgo de quiebre|Días de inventario|Rotación|Capital detenido/).filter((f) => f.tipo && f.tipo.periodo !== "hoy");
    ok(malos.length === 0, "TODA cifra de inventario declara la foto de hoy, nunca el año cerrado (decisión 5)",
      malos.slice(0, 4).map((f) => `${f.label}→${f.tipo.periodo}`).join(" · "));
    const g = guard(`El riesgo de quiebre suma ${total && total.value} y se concentra en ${skus.slice(0, 3).join(", ")}.`);
    ok(g.ok, "la respuesta que nombra el total y sus SKU pasa el muro", JSON.stringify(g.violations));
    return `total ${total && total.value} · SKU ${skus.join(", ")} · ${stgo && stgo.bodega} ${stgo && stgo.pct}%`;
  });

/* ══ 7 · «Explicame el capital total de $135K» ═══════════════════════════════════════════════════════════════ */
pregunta(7, "Explicame el capital total de $135K", "responde",
  [{ tool: "inventoryStatus", args: { focus: "estado" } }],
  ({ figs, results, guard }) => {
    const total = figDe(figs, /^Capital en inventario · total$/);
    const estados = figsDe(figs, /^Estado del inventario: /);
    const oficial = headlineTotal("capital", "sku", SCN);
    ok(results[0].coverage.supported === true && !!total, `el foco estado responde el TOTAL — ${total && total.value}`);
    ok(!!oficial && total && total.tipo.universo === "inventario" && Math.abs(total.raw - oficial.raw) < 1,
      `la cifra de ADI y la de la card salen de la MISMA fuente — ledger ${total && total.raw} vs cabecera ${oficial && oficial.raw}`);
    ok(estados.length === 4, `el total se explica por sus 4 estados — ${estados.map((f) => f.value).join(" · ")}`);
    const suma = estados.reduce((a, f) => a + (f.raw || 0), 0);
    ok(Math.abs(suma - total.raw) < 1, `los 4 estados RECONCILIAN con el total — Σ ${suma} vs ${total.raw}`);
    const g = guard(`El capital en inventario suma ${total.value} a hoy: ${estados.map((f) => `${f.label.replace(/^Estado del inventario: /, "")} ${f.value}`).join(", ")}.`);
    ok(g.ok, "la explicación por estados pasa el muro", JSON.stringify(g.violations));
    return `${total && total.value} = ${estados.map((f) => f.value).join(" + ")} (cierra exacto)`;
  });

/* ══ 8 · «La rotación media es 6.0x, ¿de dónde sale?» ════════════════════════════════════════════════════════
 * EL DEFECTO (decisión 6): convivían DOS rotaciones medias con la misma etiqueta (ponderada por capital y promedio
 * simple). La respuesta correcta declara UNA, la ponderada, y no admite la segunda. */
pregunta(8, "La rotación media es 6.0x, ¿de dónde sale?", "responde",
  [{ tool: "queryMetric", args: { metric: "rotacion", dimension: "sku" } }],
  ({ figs, results, guard }) => {
    const media = figsDe(figs, /^Rotación media$/);
    const oficial = headlineTotal("rotacion", "sku", SCN);
    ok(results[0].coverage.supported === true && media.length === 1,
      `hay UNA sola «Rotación media» en el turno — ${media.map((f) => f.value).join(" / ")}`,
      `encontradas ${media.length}`);
    ok(!!oficial && media[0] && Math.abs(media[0].raw - oficial.raw) < 0.05,
      `es la MISMA que la card de Capital — ledger ${media[0] && media[0].value} vs cabecera ${oficial && oficial.valor}x`);
    ok(/rotacionPonderada/.test(String(oficial.fuente)) && /÷\s*Σ\s*capital/.test(String(oficial.formula)),
      `sale de la ponderación por capital, declarada — «${oficial.formula}»`, String(oficial.fuente));
    const porSku = figsDe(figs, /· Rotación$/);
    ok(porSku.length > 1, `el detalle por SKU que la sostiene entra autorizado — ${porSku.length} filas`);
    // LA SEGUNDA VERDAD RETIRADA: el promedio SIMPLE de las rotaciones por SKU daba otro número bajo la misma
    // etiqueta (convivían 6,0x y 5,8x en la misma cara). Que la media publicada NO sea ese promedio es la prueba
    // de que la que quedó es la ponderada, no un empate casual de dos implementaciones.
    const simple = porSku.reduce((a, f) => a + f.raw, 0) / porSku.length;
    ok(Math.abs(media[0].raw - simple) > 0.05,
      `no es el promedio simple —la segunda verdad retirada— ${media[0].value} vs ${(Math.round(simple * 10) / 10).toFixed(1)}x`);
    const g = guard(`La rotación media es ${media[0] && media[0].value}, ponderada por capital sobre ${porSku.length} SKU.`);
    ok(g.ok, "la explicación de la media pasa el muro", JSON.stringify(g.violations));
    return `${media[0] && media[0].value} única · ${oficial.formula} · ${porSku.length} SKU detrás`;
  });

/* ══ 9 · «¿Puedo mover el stock lento de Valparaíso a Santiago?» ═════════════════════════════════════════════
 * EL DEFECTO (decisión 13): ningún SKU está en dos bodegas, así que transferir no es evaluable — el usuario no
 * puede ejecutarlo ni nosotros comprobarlo. Sentrix ya lo retiró; ADI tiene que declararlo con la MISMA cuenta. */
pregunta(9, "¿Puedo mover el stock lento de Valparaíso a Santiago?", "declina la acción",
  [{ tool: "inventoryStatus", args: { focus: "frenado" } }],
  ({ figs, results, guard, q }) => {
    const cap = transferenciaCapability(applyScenarioToSkuInventario(SCN));
    ok(cap.evaluable === false && cap.skusMultiBodega === 0,
      `el dato NO permite evaluar la transferencia — ${cap.skus} SKU en ${cap.bodegas} bodegas, ${cap.skusMultiBodega} en más de una`);
    const lim = results[0].facts && results[0].facts.limite_transferencia;
    ok(!!lim && lim.evaluable === false, "la tool DECLARA el límite en sus facts (el narrador lo lee y guía)",
      lim ? JSON.stringify(lim) : "no hay `limite_transferencia` en los facts de inventoryStatus");
    ok(!!lim && lim.skusMultiBodega === cap.skusMultiBodega && lim.skus === cap.skus,
      "el límite sale de la MISMA cuenta que usa Sentrix, no de una segunda implementación",
      lim ? `tool=${JSON.stringify(lim)} vs sentrix=${JSON.stringify(cap)}` : "");
    const gMal = guard("Le conviene transferir el stock detenido de Valparaíso a Santiago para acelerar su salida.");
    ok(gMal.violations.some((v) => v.kind === "transferencia-no-evaluable"),
      "recomendar la transferencia se BLOQUEA",
      `verdict=${gMal.verdict} · ${JSON.stringify(gMal.violations.map((v) => v.kind))}`);
    const inm = figDe(figs, /^Capital inmovilizado · total$/);
    const gBien = guard(`No puedo evaluar mover stock entre bodegas: cada SKU aparece en una sola, así que no hay dos colocaciones que comparar. Lo que sí está medido es el capital detenido, ${inm && inm.value}.`);
    ok(gBien.ok, "la declinación honesta —con el capital detenido como salida— pasa el muro", JSON.stringify(gBien.violations));
    // PREGUNTADA Y NO CONTESTADA (owner 2026-08-10, certificación live · defecto C1) — el chequeo 19 es la otra
    // cara del 18: en este turno el usuario PREGUNTÓ por el traslado, así que una respuesta que solo entrega el
    // diagnóstico deja la decisión sin contestar. Eso es exactamente lo que pasó en vivo.
    const gSinContestar = guard(`El capital detenido se concentra en Valparaíso: ${inm && inm.value}.`);
    ok(gSinContestar.violations.some((v) => v.kind === "transferencia-sin-declarar"),
      "responder solo el diagnóstico, sin contestar la decisión, se BLOQUEA",
      `verdict=${gSinContestar.verdict} · ${JSON.stringify(gSinContestar.violations.map((v) => v.kind))}`);
    // «no es posible mover» afirma MÁS de lo que el dato sostiene: el límite es de EVALUACIÓN, no de posibilidad.
    ok(guard(`No es posible mover el stock a Santiago. Conviene liquidar donde está: ${inm && inm.value}.`)
      .violations.some((v) => v.kind === "transferencia-sin-declarar"),
      "declararlo como IMPOSIBILIDAD (en vez de como límite de evaluación) también se BLOQUEA");
    // LA GARANTÍA LO CIERRA SIN PAGAR UNA LLAMADA: `ensureTransferenciaDeclarada` corre en las 5 rutas que producen
    // texto (answerViaOracle.js) ANTES de que el guard mire. Se prueba acá tal como corre en producción.
    const gGarantia = guard(ensureTransferenciaDeclarada(
      `El capital detenido se concentra en Valparaíso: ${inm && inm.value}.`, results, q));
    ok(gGarantia.ok, "la garantía determinística compone la declinación y pasa el muro, sin otra llamada",
      JSON.stringify(gGarantia.violations));
    ok(/haría falta/.test(ensureTransferenciaDeclarada("Lo medido es el capital.", results, q)),
      "la declinación dice QUÉ INFORMACIÓN FALTA, no solo que no se puede");
    // EL MURO NO PUEDE SER UN VETO A LA PALABRA "MOVER": la medida que SÍ está sostenida (liquidar/rotar donde ya
    // está) y el uso figurado del verbo tienen que pasar. Un bloqueo de más degrada respuestas correctas, que es
    // justo lo que este chequeo existe para evitar. Se prueban CON la garantía aplicada —como en producción—: lo
    // que se verifica es que ninguna de las tres dispare por la palabra, no que se puedan omitir la decisión.
    for (const legítima of [
      `Conviene liquidar o rotar el stock detenido donde ya está: son ${inm && inm.value}.`,
      `Para mover la aguja del margen, la palanca está en el capital detenido (${inm && inm.value}).`,
      `El capital detenido se concentra en Valparaíso; el resto está en Antofagasta.`,
    ]) {
      const g = guard(ensureTransferenciaDeclarada(legítima, results, q));
      ok(g.ok, `no es un veto a la palabra: «${legítima.slice(0, 52)}…» pasa`, JSON.stringify(g.violations));
    }
    return `no evaluable: ${cap.skusMultiBodega}/${cap.skus} SKU en 2+ bodegas · límite declarado en facts · recomendar bloquea · preguntada-sin-contestar bloquea`;
  });

/* ══ 10 · «¿Cuánto capital tengo ligado en Falabella? ¿Y en Lider?» ══════════════════════════════════════════
 * EL DEFECTO (decisión 9): la tool devolvía el inventario GLOBAL, byte-idéntico, para las 13 cuentas. */
pregunta(10, "¿Cuánto capital tengo ligado en Falabella? ¿Y en Lider?", "declina",
  [{ tool: "entityCapitalLigado", args: { dimension: "cliente", entity: "Falabella" } },
   { tool: "entityCapitalLigado", args: { dimension: "cliente", entity: "Lider" } }],
  ({ figs, results }) => {
    for (const r of results) {
      ok(r.coverage.supported === false, `${r.args && r.args.entity}: la tool DECLINA en vez de repetir el inventario global`);
      ok(r.coverage.relacion === "sin_relacion", `declara la relación medida — relacion=${r.coverage.relacion}`);
      const c = r.coverage.cobertura || {};
      ok(c.skusEnMix === c.skusInventario,
        `la razón es VERIFICABLE: el "mix" alcanza los ${c.skusEnMix} SKU con inventario, los mismos que cualquier otra cuenta`);
      ok(Array.isArray(r.coverage.alternativas) && r.coverage.alternativas.length > 0,
        `ofrece la salida real — «${(r.coverage.alternativas || [])[0]}»`);
    }
    ok(figs.length === 0, "cero cifras cliente-específicas autorizadas: ninguna afirmación que atribuya capital a una cuenta",
      figs.slice(0, 5).map((f) => f.label).join(" · "));
    return `las 2 cuentas declinan · mix = inventario completo (${(results[0].coverage.cobertura || {}).skusEnMix} SKU) · ledger vacío`;
  });

/* ══ 11 · «Dame la tabla completa de Falabella» ══════════════════════════════════════════════════════════════
 * La pidió EXPLÍCITAMENTE: acá declinar sería el error. La fila entera tiene que estar autorizada y tabulable. */
pregunta(11, "Dame la tabla completa de Falabella", "responde",
  [{ tool: "entityRecord", args: { dimension: "cliente", entity: "Falabella" } }],
  ({ figs, results, guardCon }) => {
    ok(results[0].coverage.supported === true, "entityRecord entrega la fila completa");
    const propias = figs.filter((f) => sujetoDe(f) === "Falabella");
    ok(propias.length >= 10, `la fila trae sus columnas reales — ${propias.length} cifras de Falabella`);
    ok(propias.every((f) => f.tipo && f.tipo.entidad === "Falabella"),
      "cada cifra conserva su DUEÑO en el tipo (decisión 7)",
      propias.filter((f) => !f.tipo || f.tipo.entidad !== "Falabella").slice(0, 3).map((f) => f.label).join(" · "));
    // LA POLÍTICA SE DERIVA, NO SE ASUME (certificación 2026-08-09). Abajo la tabla se prueba con
    // tablePolicy:"required" — y eso sólo prueba algo si el producto DE VERDAD resuelve `required` para esta
    // pregunta. Medido antes del arreglo: NO lo hacía. `pideTablaExplicita` sólo reconocía la forma como
    // complemento ("en una tabla", "tabulá", "en columnas") y no el pedido de la tabla como objeto ("dame la
    // tabla"); el plan de una consulta de entidad resuelve `entityProfile`, la poda progresiva llenaba `podado`,
    // y `resolveTablePolicy` devolvía **forbidden** — guardC bloqueaba con `tabla-no-autorizada` exactamente la
    // tabla que se había pedido con todas las letras. Peor: «dame el DETALLE completo de Falabella», más vago,
    // sí daba `required`. El gate estaba verde con el producto rojo porque la política llegaba escrita a mano.
    const planPerfil = { intent: "answer", calls: [
      { tool: "entityProfile", args: { dimension: "cliente", entity: "Falabella" } },
      { tool: "trend", args: { metric: "ventas", entity: "Falabella" } },
      { tool: "entityComposicion", args: { dimension: "cliente", entity: "Falabella" } }] };
    const poda = podarPlanProgresivo(planPerfil, "Dame la tabla completa de Falabella");
    ok(poda.podado.length > 0,
      `el turno de perfil general SÍ poda detalle (${poda.podado.join(" · ")}): es el caso donde la poda empuja a forbidden`);
    ok(resolveTablePolicy({ text: "Dame la tabla completa de Falabella", podado: poda.podado }) === "required",
      "la política se DERIVA del texto: el pedido explícito de tabla gana sobre la poda",
      `resolvió ${resolveTablePolicy({ text: "Dame la tabla completa de Falabella", podado: poda.podado })}`);
    ok(resolveTablePolicy({ text: "contame de Falabella", podado: poda.podado }) === "forbidden",
      "y sin pedido explícito la misma poda sigue dando forbidden — se amplió el reconocimiento, no se apagó la regla");
    const tabla = ["| Concepto | Valor |", "| --- | --- |", ...propias.slice(0, 8).map((f) => `| ${f.label.replace("Falabella · ", "")} | ${f.value} |`)].join("\n");
    const g = guardCon(tabla, { tablePolicy: "required" });
    ok(g.ok, "la tabla pedida pasa el muro con la política `required`", JSON.stringify(g.violations));
    const gSinTabla = guardCon(`Falabella vendió ${propias[0].value}.`, { tablePolicy: "required" });
    ok(gSinTabla.violations.some((v) => v.kind === "tabla-faltante"),
      "responder en prosa lo que se pidió tabulado se marca como incumplimiento");
    // EL MOTOR NO PUEDE BORRAR LO QUE DESPUÉS EXIGE (owner 2026-08-10, certificación live · defecto A4). Los tres
    // backstops de forma corren ANTES de guardC. Medido antes del arreglo: con `required`, cualquiera de los tres
    // borraba la tabla y guardC rechazaba la MISMA narración por `tabla-faltante` — el narrador cumplía, se le
    // borraba el cumplimiento y se le cobraba el incumplimiento. Se prueban los tres en el turno que los enfrenta.
    const unaFila = ["| Concepto | Valor |", "| --- | --- |", `| Ventas | ${propias[0].value} |`].join("\n");
    const planPerfilConComposicion = { intent: "answer", calls: [
      { tool: "entityProfile", args: { dimension: "cliente", entity: "Falabella" } },
      { tool: "entityComposicion", args: { dimension: "cliente", entity: "Falabella" } }] };
    const conTrend = [{ tool: "trend", facts: { tablaM: { rows: [{ mes: "Ene" }, { mes: "Feb" }] } } }];
    const tablaMeses = ["| Mes | Venta |", "| --- | --- |", "| Ene | $1.0M |", "| Feb | $1.1M |"].join("\n");
    for (const [nombre, antes, despues] of [
      ["stripSingleRowTables", unaFila, stripSingleRowTables(unaFila, "Dame la tabla completa de Falabella", "required")],
      ["stripRedundantTemporalTable", tablaMeses, stripRedundantTemporalTable(tablaMeses, conTrend, "required")],
      ["stripPerfilCompletoTable", tabla, stripPerfilCompletoTable(tabla, planPerfilConComposicion, "required")],
    ]) {
      ok(despues.includes("|"), `con tablePolicy="required", ${nombre} NO borra la tabla que el guard va a exigir`,
        `antes=${antes.split("\n").length} líneas · después=${despues.split("\n").length}`);
    }
    // Y la regla original sigue viva donde corresponde: sin `required`, los tres siguen podando como siempre.
    ok(!stripSingleRowTables(unaFila, "contame de Falabella", "auto").includes("|"),
      "sin `required`, stripSingleRowTables sigue colapsando la tabla de una fila (no se apagó la regla)");
    ok(!stripPerfilCompletoTable(tabla, planPerfilConComposicion, "auto").includes("|"),
      "sin `required`, stripPerfilCompletoTable sigue borrando la tabla del perfil completo");
    return `${propias.length} columnas autorizadas, todas con dueño · la tabla pasa con tablePolicy=required · los 3 backstops ceden ante required`;
  });

/* ══ 12 · «¿Los que más venden son los que tienen capital detenido?» ═════════════════════════════════════════
 * EL DEFECTO: la comparación en $ NO es posible (venta en miles ↔ inventario en dólares crudos, y las unidades del
 * mismo SKU difieren entre 4x y 35x). En UNIDADES sí. La respuesta correcta cruza unidades y no cruza dinero. */
pregunta(12, "¿Los que más venden son los que tienen capital detenido?", "responde",
  [{ tool: "tensionRead", args: { dimension: "sku", metricA: "unidades", metricB: "stockUSD" } }],
  ({ figs, results, guard }) => {
    ok(results[0].coverage.supported === true, "el cruce por unidades vs capital responde");
    const unid = figsDe(figs, /· Unidades vendidas$/), capi = figsDe(figs, /· Valor de inventario$/);
    ok(unid.length > 1 && capi.length > 1, `las dos puntas entran autorizadas — ${unid.length} de unidades · ${capi.length} de capital`);
    // la comparación que SÍ se sostiene es de RANKING (¿son los mismos nombres?), y para eso cada punta tiene que
    // llegar con SU universo intacto: un conteo de unidades y un monto de inventario, nunca fundidos en uno solo.
    const uU = [...new Set(unid.map((f) => f.tipo.universo))], uC = [...new Set(capi.map((f) => f.tipo.universo))];
    ok(uU.length === 1 && uC.length === 1 && uU[0] !== uC[0],
      `cada punta conserva SU universo y son distintos — ${uU[0]} vs ${uC[0]}`);
    ok(unid.every((f) => f.tipo.unidad === "count") && capi.every((f) => f.tipo.unidad === "money"),
      "las unidades entran como conteo y el capital como dinero: no hay una sola escala que los funda");
    // el cruce en DINERO se bloquea
    const venta = runPlan({ intent: "answer", calls: [{ tool: "tensionRead", args: { dimension: "sku", metricA: "venta", metricB: "stockUSD" } }] }, { scenario: SCN });
    const vFigs = ledgerBoleta(venta.ledger);
    const vv = figDe(vFigs, /^SAM-TV55 · Ventas$/), vc = figDe(vFigs, /^SAM-TV55 · Valor de inventario$/);
    const gMal = guardC(`SAM-TV55 vende ${vv && vv.value} y tiene ${vc && vc.value} inmovilizados, o sea que el stock es una fracción de su venta.`,
      { ledger: venta.ledger, results: venta.results, question: "¿Los que más venden son los que tienen capital detenido?" });
    ok(!gMal.ok, "cruzar la venta en $ contra el capital en $ se BLOQUEA",
      `verdict=${gMal.verdict} · ${JSON.stringify(gMal.violations.map((v) => v.kind))}`);
    const top = unid[0], topCap = capi[0];
    const gBien = guard(`En unidades, el que más sale es ${sujetoDe(top)} (${top.value}); el que más capital tiene parado es ${sujetoDe(topCap)} (${topCap.value}).`);
    ok(gBien.ok, "la lectura en unidades, con cada cifra en su unidad, pasa el muro", JSON.stringify(gBien.violations));
    return `unidades ✓ (${sujetoDe(top)} ${top.value}) · dinero ✗ bloqueado (${gMal.verdict})`;
  });

/* ══ 13 · «El KPI dice $4.1M de acciones comerciales, ¿de dónde sale?» ═══════════════════════════════════════
 * EL DEFECTO (decisión 6): la card mostraba un TOTAL y la evidencia declarada devolvía un ranking por cuenta —
 * ADI no podía contrastar su propia cabecera. */
pregunta(13, "El KPI dice $4.1M de acciones comerciales, ¿de dónde sale?", "responde",
  [{ tool: "queryMetric", args: { metric: "acciones", dimension: "cliente" } }],
  ({ figs, results, guard }) => {
    const total = figDe(figs, /^Acciones comerciales · total$/);
    const oficial = headlineTotal("acciones", "cliente", SCN);
    ok(results[0].coverage.supported === true && !!total, `la tool emite el TOTAL, no sólo el ranking — ${total && total.value}`);
    ok(!!oficial && total && Math.abs(total.raw - oficial.raw) < 1,
      `es la MISMA cifra que la card — ledger ${total && total.raw} vs cabecera ${oficial && oficial.raw}`);
    ok(!!oficial && /Σ/.test(String(oficial.formula)) && String(oficial.fuente).length > 20,
      `el total declara de dónde sale — «${oficial.formula}»`);
    const porCuenta = figsDe(figs, /· Acciones comerciales$/);
    ok(porCuenta.length > 1, `el desglose por cuenta que lo sostiene entra autorizado — ${porCuenta.length} cuentas`);
    // EL PLAN DE ESTE CORPUS ESTÁ ESCRITO A MANO — así que hay que probar que el PLANIFICADOR REAL puede emitirlo
    // (certificación 2026-08-09). Medido antes del arreglo: `TOOL_CATALOG` declaraba para queryMetric «métricas:
    // ventas, margen, contribucion, costo, capital, rotacion, doh» — sin `acciones` ni `carga`, que el contrato
    // (metricRegistry.METRICS) sí declara. Y `queryMetric{metric:"acciones",dimension:"cliente"}` es LA ÚNICA tool
    // del catálogo que autoriza el total de $4.1M de la card. Es decir: la respuesta existía en el motor y era
    // inalcanzable desde el prompt, y el muro no puede avisarlo (la pregunta ECA la cifra, así que una procedencia
    // inventada pasa guardC como eco del usuario). Un plan a mano que usa una métrica no declarada mide el motor,
    // no el producto.
    for (const m of ["acciones", "carga"]) {
      ok(new RegExp(`\\b${m}\\b`).test(TOOL_CATALOG),
        `el catálogo que ve el planificador declara la métrica «${m}» — sin eso, este plan no es emitible`);
    }
    ok(!!total && SELLOS.includes(total.tipo.sello) && total.tipo.periodo === "anual" && total.tipo.escenario === SCN,
      `el total declara su tipo completo — sello=${total && total.tipo.sello} período=${total && total.tipo.periodo} escenario=${total && total.tipo.escenario}`);
    const g = guard(`Las acciones comerciales del período suman ${total.value}, repartidas entre ${porCuenta.length} cuentas.`);
    ok(g.ok, "la respuesta que explica el total pasa el muro", JSON.stringify(g.violations));
    return `${total && total.value} = ${oficial.formula} · ${porCuenta.length} cuentas detrás`;
  });

/* ══ 14 · «¿Cuál es el resultado del negocio después de gastos?» ═════════════════════════════════════════════
 * EL DEFECTO (decisión 3): se contestaba con la CONTRIBUCIÓN. Son dos peldaños distintos de la misma cascada. */
pregunta(14, "¿Cuál es el resultado del negocio después de gastos?", "responde",
  [{ tool: "pnlRead", args: { focus: "resultado" } }],
  ({ figs, results, guard }) => {
    const r = results[0];
    ok(r.coverage.supported === true, "pnlRead responde el resultado", String(r.coverage.reason || ""));
    const res = figDe(figs, /^Resultado comercial$/), pct = figDe(figs, /^Resultado %$/), contrib = figDe(figs, /^Contribución$/);
    ok(!!res && !!pct, `entrega el RESULTADO y su % — ${res && res.value} · ${pct && pct.value}`);
    ok(!!contrib && contrib.value !== res.value,
      `el resultado NO es la contribución — resultado ${res && res.value} vs contribución ${contrib && contrib.value}`);
    ok(r.facts.nivel_respondido === "resultado_final", `declara el nivel que contestó — ${r.facts.nivel_respondido}`);
    const c = r.facts.cascada || {};
    ok(c["Resultado del negocio"] === res.value && c["Resultado sobre la venta"] === pct.value,
      "la cascada de los facts y la boleta dicen lo mismo (una sola cuenta, la de composePnl)");
    ok(/gastos son supuestos|indicados/i.test(String(r.facts.graduacion || "")),
      "gradúa el sello: hasta la contribución probado, el resultado INDICADO por los gastos declarados");
    const g = guard(`Después de gastos el negocio deja ${res.value}, ${pct.value} sobre la venta. La contribución —antes de esos gastos— es ${contrib.value}.`);
    ok(g.ok, "la respuesta que distingue los dos peldaños pasa el muro", JSON.stringify(g.violations));
    // Y LA VERSIÓN DEFECTUOSA TIENE QUE REBOTAR (certificación 2026-08-09). Un muro que sólo dice que sí no prueba
    // nada — el propio encabezado de este archivo lo declara como criterio, y para esta pregunta faltaba la mitad.
    // Medido antes del arreglo: «El resultado del negocio después de gastos es $25.0M» pasaba con ok=true. La
    // cifra es REAL (la contribución está en la MISMA boleta) y la afirmación es falsa: contesta el peldaño
    // equivocado, que es exactamente el defecto que la decisión 3 cierra. `resultado` no era vocabulario de
    // ninguna métrica en guardC, así que la ventana quedaba sin señal y no se juzgaba.
    const gMal = guard(`El resultado del negocio después de gastos es ${contrib.value}.`);
    ok(!gMal.ok && gMal.violations.some((v) => v.kind === "metrica-mal-atribuida"),
      "contestar el resultado CON la contribución se BLOQUEA, aunque la cifra sea real",
      `verdict=${gMal.verdict} · ${JSON.stringify(gMal.violations.map((v) => v.kind))}`);
    const gUtil = guard(`La utilidad neta del negocio es ${contrib.value}.`);
    ok(!gUtil.ok, "y también en las otras palabras con que se pide el mismo peldaño («utilidad neta»)",
      JSON.stringify(gUtil.violations.map((v) => v.kind)));
    return `resultado ${res && res.value} (${pct && pct.value}) ≠ contribución ${contrib && contrib.value}`;
  });

/* ══ 15 · «¿Cuánto contribuye Falabella?» ════════════════════════════════════════════════════════════════════
 * EL DEFECTO (decisión 7): una cifra de una cuenta presentada como «el negocio». La respuesta correcta trae UNA
 * cifra con su dueño, su universo, su período y su sello — y el muro impide narrarla como si fuera del negocio. */
pregunta(15, "¿Cuánto contribuye Falabella?", "responde",
  [{ tool: "contributionRead", args: { dimension: "cliente", entity: "Falabella", focus: "entidad" } }],
  ({ figs, results, guard }) => {
    const f = figDe(figs, /^Falabella · Contribución$/);
    const total = figDe(figs, /^Contribución total$/);
    ok(results[0].coverage.supported === true && !!f, `responde la contribución de la cuenta — ${f && f.value}`);
    ok(!!f && f.tipo.entidad === "Falabella" && f.tipo.universo === "venta_comercial" && f.tipo.periodo === "anual",
      `la cifra conserva sujeto y marco — entidad=${f && f.tipo.entidad} universo=${f && f.tipo.universo} período=${f && f.tipo.periodo}`);
    ok(!!f && SELLOS.includes(f.tipo.sello) && !!f.tipo.verificabilidadRazon,
      `lleva sello DECLARADO con su razón — ${f && f.tipo.sello} (${f && f.tipo.verificabilidad})`);
    ok(!!total && total.value !== f.value, `el total del negocio existe y es OTRA cifra — ${total && total.value}`);
    const gMal = guard(`Tu negocio deja ${f.value} de contribución en el año.`);
    ok(!gMal.ok, "presentar la cifra de la cuenta como «el negocio» se BLOQUEA",
      `verdict=${gMal.verdict} · ${JSON.stringify(gMal.violations.map((v) => v.kind))}`);
    // LA OTRA MITAD DEL MISMO DEFECTO, en el sentido inverso (certificación 2026-08-09): no la cifra de la cuenta
    // narrada como el negocio —eso lo cubre gMal— sino el TOTAL DEL NEGOCIO colgado de la cuenta. Medido antes del
    // arreglo: «Falabella contribuye $25.0M» pasaba con ok=true. El chequeo que existe para eso desde 2026-07-28
    // exige un VERBO de equivalencia cerca, y su lista no tenía «contribuye» ni «aporta» — o sea que el muro
    // estaba ciego justo en los dos verbos con que se contesta esta pregunta.
    const gTotal = guard(`Falabella contribuye ${total.value}.`);
    ok(!gTotal.ok && gTotal.violations.some((v) => v.kind === "total-mal-atribuido"),
      "colgar el TOTAL del negocio de la cuenta se BLOQUEA, con el verbo que esta pregunta invita",
      `verdict=${gTotal.verdict} · ${JSON.stringify(gTotal.violations.map((v) => v.kind))}`);
    const gBien = guard(`Falabella aporta ${f.value} de contribución en el año cerrado, sobre un total de ${total.value}.`);
    ok(gBien.ok, "la lectura con dueño explícito pasa el muro", JSON.stringify(gBien.violations));
    const gBien2 = guard(`Falabella aporta ${f.value} de contribución, sobre un total de ${total.value} del negocio.`);
    ok(gBien2.ok, "y la que usa el total como DENOMINADOR («sobre un total de») también — se amplió el verbo, no se rompió la prosa correcta",
      JSON.stringify(gBien2.violations));
    return `${f && f.value} · dueño=${f && f.tipo.entidad} · sello=${f && f.tipo.sello} · total ${total && total.value}`;
  });

/* ── LA CORRIDA ────────────────────────────────────────────────────────────────────────────────────────────── */
console.log("── EL CORPUS DE ACEPTACIÓN · las 15 preguntas del owner ──────────────────────────────────────────────");
console.log(`   tenant demo · escenario ${SCN} · plan escrito a mano · runPlan + ledger + guardC · cero red, cero LLM\n`);

for (const c of CORPUS) {
  const antesPASS = PASS, antesFAIL = FAIL;
  console.log(`\n[${c.n}] «${c.q}»   → se espera: ${c.espera.toUpperCase()}`);
  const { ledger, results } = runPlan({ intent: "answer", calls: c.calls }, { scenario: SCN });
  const figs = ledgerBoleta(ledger);
  const guardCon = (narracion, extra = {}) => guardC(narracion, { ledger, results, question: c.q, ...extra });
  const guard = (narracion) => guardCon(narracion);
  // El `espera` no es decorativo: se verifica contra la cobertura real de las tools del plan. Son TRES formas de
  // aprobar, no dos, y la tercera es la que el criterio del owner hace explícita: hay preguntas cuyo DATO existe y
  // cuya ACCIÓN no es evaluable («¿puedo mover el stock de una bodega a otra?»). Ahí declinar de más —callar el
  // capital detenido que sí está medido— sería tan deshonesto como recomendar el movimiento: la tool responde con
  // lo medido y DECLARA el límite de lo que no puede sostener. Eso lo verifica la prueba de la pregunta.
  const algunaResponde = results.some((r) => r.coverage && r.coverage.supported === true);
  const esperaResponde = c.espera === "responde" || c.espera === "declina la acción";
  ok(esperaResponde ? algunaResponde : !algunaResponde,
    `la expectativa se cumple: ${esperaResponde ? "el dato medido se entrega" : "NINGUNA tool responde (se declina)"}`,
    results.map((r) => `${r.tool}=${r.coverage && r.coverage.supported}`).join(" · "));
  let evidencia = "";
  try {
    evidencia = c.prueba({ ledger, results, figs, guard, guardCon, q: c.q, calls: c.calls }) || "";
  } catch (e) {
    FAIL++; console.log("    ✗ la prueba explotó: " + String((e && e.message) || e));
    evidencia = `EXCEPCIÓN: ${String((e && e.message) || e)}`;
  }
  const fallos = FAIL - antesFAIL;
  filaPorPregunta.push({ n: c.n, q: c.q, espera: c.espera, estado: fallos === 0 ? c.espera : "FALLA", pass: PASS - antesPASS, fail: fallos, evidencia });
}

console.log("\n\n── TABLA · pregunta / estado / evidencia ─────────────────────────────────────────────────────────────");
for (const f of filaPorPregunta) {
  console.log(`\n[${String(f.n).padStart(2)}] ${f.estado.toUpperCase().padEnd(8)} ${f.pass}✓/${f.fail}✗  «${f.q}»`);
  console.log(`     ${f.evidencia}`);
}
const fallan = filaPorPregunta.filter((f) => f.estado === "FALLA");
console.log(`\n── CORPUS DE ACEPTACIÓN: ${filaPorPregunta.length - fallan.length}/${filaPorPregunta.length} preguntas resueltas · ${PASS} PASS · ${FAIL} FAIL ──`);
if (fallan.length) console.log(`   siguen fallando: ${fallan.map((f) => f.n).join(", ")}`);
process.exit(FAIL > 0 ? 1 : 0);
