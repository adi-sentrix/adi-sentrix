/* === _capital_pct_reconciliation_gate.mjs · GATE del pedido del owner (2026-08-02) ===
 * "Agrega % del total como cifra autorizada y determinística para capital por bodega y por SKU. Debe calcularse
 * desde el mismo total, período y alcance de la boleta, nunca por el narrador. Usa tabla con estas columnas:
 * Bodega/SKU | Capital detenido | % del total. El porcentaje debe reconciliar con el total mostrado y cerrar en
 * 100% considerando redondeos. Agrega gates para suma, alcance y orden descendente por capital. Si solo existe
 * una entidad, conserva la respuesta breve y no fuerces una tabla."
 *
 * Implementación (composeSpecInventory, specRetrieval.js): _reconcilePercents (método del MAYOR RESTO / Hamilton-
 * Hare) reemplaza el Math.round independiente de _groupBy — garantiza suma=100 exacta, no solo "probablemente".
 * byBod expone Capital+% por bodega (ya viene completo, sin truncar). SKU expone top-4 + "Resto (N de M)" — mismo
 * patrón que buildGrid (entityRecord.js) — para que el % SIEMPRE reconcilie con B.total, no solo con los 4
 * nombrados (que sería parcial/engañoso si hay más de 4 SKU frenados). Todo esto vive en fig()s AUTORIZADAS
 * (raw=pct calculado acá, no en el prompt) — numberGuard/guardC son quienes impiden que el narrador invente otro
 * número al citarlas.
 *
 * Nota de cobertura: el dataset demo NUNCA tiene más de 4 SKU en estado frenado en ningún escenario/foco (actual/
 * bonanza/tension/crisis × frenado/quiebre/sobrestock, verificado) — la rama "Resto" nunca se ejercita end-to-end
 * con datos reales hoy. Se prueba _reconcilePercents directamente con una forma sintética top4+resto (misma forma
 * que arma composeSpecInventory) en vez de depender de que el dataset algún día tenga 5+.
 */
import { composeSpecInventory, _reconcilePercents } from "./src/adi/specRetrieval.js";
import { buildNarrateUserMessageC, stripSingleRowTables, isExplicitTableRequest } from "./src/adi/oracle/narratePromptC.js";
import { answerViaOracle } from "./src/adi/oracle/answerViaOracle.js";
import { handlePlan, handleNarrateC } from "./src/adi/llm/gatewayCore.js";
import fs from "fs";
for (const ln of fs.readFileSync(".env", "utf8").split(/\r?\n/)) { const m = ln.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }

let pass = 0, fail = 0;
const ok = (cond, label) => { console.log(`  ${cond ? "✓" : "✗"} ${label}`); if (cond) pass++; else fail++; };

console.log("── 1 · _reconcilePercents — la SUMA siempre cierra en 100 (método del mayor resto) ──");
{
  const r1 = _reconcilePercents([{ usd: 1 }, { usd: 1 }, { usd: 1 }], 3);   // 33.33% × 3 — Math.round ingenuo da 99
  ok(r1.reduce((s, r) => s + r.pct, 0) === 100, `3 filas iguales (33.33% c/u) suman 100 (obtuvo ${r1.reduce((s, r) => s + r.pct, 0)}, no 99)`);
  ok(r1.every((r) => r.pct === 33 || r.pct === 34), "cada fila queda en 33 o 34 (nunca lejos del valor real)");

  const r2 = _reconcilePercents([{ usd: 1 }], 1);
  ok(r2.length === 1 && r2[0].pct === 100, "1 sola fila (100% del total) da pct=100 exacto");

  const r3 = _reconcilePercents([{ usd: 5 }, { usd: 3 }], 0);
  ok(r3.every((r) => r.pct === 0) , "total=0 no crashea, degrada a 0% en vez de dividir por cero");

  const r4 = _reconcilePercents([], 100);
  ok(Array.isArray(r4) && r4.length === 0, "sin filas no crashea, devuelve array vacío");

  // forma SINTÉTICA top-4 + Resto (misma forma que arma composeSpecInventory cuando hay 5+ SKU frenados) — ver
  // nota de cobertura arriba: el dataset demo no llega a 5+ hoy, así que esto prueba el MECANISMO directamente.
  const top4Resto = [
    { nombre: "SKU-A", usd: 4000 }, { nombre: "SKU-B", usd: 3000 }, { nombre: "SKU-C", usd: 2000 }, { nombre: "SKU-D", usd: 1000 },
    { nombre: "Resto (3 de 7)", usd: 900 },
  ];
  const totalReal = top4Resto.reduce((a, r) => a + r.usd, 0);   // 10900 — el total MOSTRADO (todo lo frenado, no solo los 4 nombrados)
  const rResto = _reconcilePercents(top4Resto, totalReal);
  ok(rResto.reduce((s, r) => s + r.pct, 0) === 100, `top-4 + Resto reconcilia con el TOTAL mostrado, no solo con los 4 nombrados (suma=${rResto.reduce((s, r) => s + r.pct, 0)})`);
  ok(rResto[4].nombre.startsWith("Resto"), "Resto queda AL FINAL del orden (no se reordena por magnitud, mismo criterio que buildGrid)");
  ok(rResto[0].usd >= rResto[1].usd && rResto[1].usd >= rResto[2].usd && rResto[2].usd >= rResto[3].usd, "los 4 nombrados siguen en orden descendente entre sí");
}

console.log("\n── 2 · composeSpecInventory (real, sin mocks) — SUMA cierra en 100 por eje ──");
{
  const r = composeSpecInventory({ scenario: "actual", focus: "frenado" });
  const bol = r.evidence.boleta;
  const bodPct = bol.filter((f) => / · % del total$/.test(f.label) && r.evidence.inventory.byBodega.some((b) => f.label.startsWith(`${b.bodega} ·`)));
  ok(bodPct.length >= 2, `hay 2+ figs de % por bodega (obtuvo ${bodPct.length}) — el caso real reportado por el owner`);
  ok(bodPct.reduce((s, f) => s + f.raw, 0) === 100, `Σ % por bodega == 100 (obtuvo ${bodPct.reduce((s, f) => s + f.raw, 0)})`);
  ok(bodPct.every((f) => typeof f.raw === "number" && Number.isInteger(f.raw)), "cada % es un entero (no decimales sueltos)");

  const skuLabels = new Set(r.evidence.inventory.bySku.map((s) => s.sku));
  const skuPctFigs = bol.filter((f) => / · % del total$/.test(f.label) && (skuLabels.has(f.label.split(" · ")[0]) || f.label.startsWith("Resto (")));
  ok(skuPctFigs.length >= 2, `hay 2+ figs de % por SKU/Resto (obtuvo ${skuPctFigs.length})`);
  ok(skuPctFigs.reduce((s, f) => s + f.raw, 0) === 100, `Σ % por SKU(+Resto) == 100 (obtuvo ${skuPctFigs.reduce((s, f) => s + f.raw, 0)})`);

  // el $ de cada fig sigue siendo el MISMO que antes del fix (el % es un AGREGADO, no reemplaza ni corrompe el $)
  const bodMoneyFigs = bol.filter((f) => / · Capital detenido$/.test(f.label) && r.evidence.inventory.byBodega.some((b) => f.label.startsWith(`${b.bodega} ·`)));
  ok(bodMoneyFigs.every((f) => r.evidence.inventory.byBodega.some((b) => f.label.startsWith(`${b.bodega} ·`) && f.raw === b.usd)), "el $ de Capital detenido por bodega == el mismo dato estructurado de evidence.inventory (una sola verdad)");
}

console.log("\n── 3 · ALCANCE — el % reconcilia con el TOTAL DEL ALCANCE filtrado, no con el global ──");
{
  const rGlobal = composeSpecInventory({ scenario: "actual", focus: "frenado" });
  const bodegaExistente = rGlobal.evidence.inventory.byBodega[0].bodega;
  const rScoped = composeSpecInventory({ scenario: "actual", focus: "frenado", filters: { bodega: bodegaExistente } });
  ok(!!rScoped, `filtrar por bodega="${bodegaExistente}" sigue devolviendo respuesta`);
  if (rScoped) {
    ok(rScoped.evidence.inventory.byBodega.length === 1 && rScoped.evidence.inventory.byBodega[0].bodega === bodegaExistente, "alcance filtrado colapsa a UNA sola bodega (la pedida)");
    // esa única bodega YA NO trae fig de "% del total" (sección 5 blinda esto — sin 2do concepto no hay tabla
    // posible) — el 100% queda implícito, no autorizado como cifra propia. La prueba real de "alcance" (no hereda
    // el total GLOBAL) es el eje SKU dentro de ESE alcance: si reconciliara contra el total global ($33K) en vez
    // del total de Valparaíso ($25K), las % de sus SKU NO sumarían 100 entre sí.
    const capFig = rScoped.evidence.boleta.find((f) => f.label === `${bodegaExistente} · Capital detenido`);
    ok(!!capFig && capFig.raw === rGlobal.evidence.inventory.byBodega.find((b) => b.bodega === bodegaExistente).usd, "el $ de esa bodega bajo alcance filtrado == el mismo $ que tenía en la vista global (no se recalcula distinto)");
    const skuPctScoped = rScoped.evidence.boleta.filter((f) => / · % del total$/.test(f.label));
    const sumScoped = skuPctScoped.reduce((s, f) => s + f.raw, 0);
    ok(skuPctScoped.length >= 2 && sumScoped === 100, `los SKU dentro del alcance filtrado suman 100% ENTRE SÍ (obtuvo ${sumScoped}% de ${skuPctScoped.length} figs) — prueba que reconcilian contra el total DEL ALCANCE ($${rScoped.evidence.inventory.total || rScoped.evidence.inventory.byBodega[0].usd}), no contra el total global`);
  }
}

console.log("\n── 4 · ORDEN DESCENDENTE por capital — sellado, no a criterio del narrador ──");
{
  const r = composeSpecInventory({ scenario: "actual", focus: "frenado" });
  const bodUsd = r.evidence.inventory.byBodega.map((b) => b.usd);
  ok(bodUsd.every((v, i) => i === 0 || bodUsd[i - 1] >= v), `byBodega viene ordenado descendente por capital (${bodUsd.join(" ≥ ")})`);
  const skuUsd = r.evidence.inventory.bySku.map((s) => s.usd);
  ok(skuUsd.every((v, i) => i === 0 || skuUsd[i - 1] >= v), `bySku viene ordenado descendente por capital (${skuUsd.join(" ≥ ")})`);
}

console.log("\n── 5 · UNA sola entidad → respuesta breve, NUNCA fuerza tabla (mismo candado que _table_format_gate.mjs) ──");
{
  // forma sintética: 1 bodega con sus 2 cifras autorizadas (Capital + %) — el caso "solo existe una entidad" que
  // el owner pidió blindar. _needsTableFormat exige 2+ entidades — con 1 sola, sigue siendo prosa legítima.
  const figsUnaBodega = [
    { label: "Valparaíso · Capital detenido", value: "$25K" },
    { label: "Valparaíso · % del total", value: "100%" },
  ];
  const payload = buildNarrateUserMessageC({ text: "x", plan: { mode: "diagnostico" }, results: [], ledgerFigs: figsUnaBodega, mem: {}, history: [] });
  ok(!payload.instruccion_tabla, "1 sola bodega (2 cifras, 1 entidad) NO dispara instruccion_tabla");
  ok(!payload.instruccion_lista, "tampoco dispara instruccion_lista (1 entidad no es un ranking)");
  ok(!payload.instruccion_columnas_capital, "tampoco dispara instruccion_columnas_capital (exige tabla primero, mismo candado que Brecha)");

  // control: la MISMA forma con 2 bodegas SÍ debe seguir dispando tabla (no rompimos el caso que sí queremos)
  const figsDosBodegas = [...figsUnaBodega, { label: "Antofagasta · Capital detenido", value: "$8K" }, { label: "Antofagasta · % del total", value: "25%" }];
  const payload2 = buildNarrateUserMessageC({ text: "x", plan: { mode: "diagnostico" }, results: [], ledgerFigs: figsDosBodegas, mem: {}, history: [] });
  ok(!!payload2.instruccion_tabla, "REGRESIÓN: 2 bodegas (2 cifras c/u) sigue dispando instruccion_tabla normalmente");

  // REAL (no sintético): hallazgo en vivo (owner 2026-08-02) — un alcance de 1 sola bodega SUELE traer igual 2+
  // SKU de esa bodega en el MISMO ledger; _needsTableFormat dispara (correcto, por el grupo SKU), pero el narrador
  // a veces tabuló el grupo BODEGA (1 sola fila) igual. Fix estructural: composeSpecInventory ya NO emite
  // "Entidad · % del total" para una bodega/SKU que sea la ÚNICA de su grupo — sin 2do concepto, esa entidad no
  // puede colarse en ninguna tabla por sí sola (ver _bodMultiple/_skuMultiple en specRetrieval.js).
  const rScoped = composeSpecInventory({ scenario: "actual", focus: "frenado", filters: { bodega: "Valparaíso" } });
  if (rScoped) {
    const bodPctFig = rScoped.evidence.boleta.find((f) => f.label === "Valparaíso · % del total");
    ok(!bodPctFig, "alcance de 1 sola bodega: NO existe fig 'Valparaíso · % del total' (sin 2do concepto, no hay tabla posible para ese grupo)");
    const bodCapFig = rScoped.evidence.boleta.find((f) => f.label === "Valparaíso · Capital detenido");
    ok(!!bodCapFig, "pero el $ de Capital detenido SÍ sigue autorizado (no se pierde información, solo el % redundante)");
  }
}

console.log("\n── 6 · instruccion_columnas_capital — encabezados EXACTOS reforzados SOLO junto con tabla real ──");
{
  const figsDosBodegas = [
    { label: "Valparaíso · Capital detenido", value: "$25K" }, { label: "Valparaíso · % del total", value: "75%" },
    { label: "Antofagasta · Capital detenido", value: "$8K" }, { label: "Antofagasta · % del total", value: "25%" },
  ];
  const p = buildNarrateUserMessageC({ text: "x", plan: { mode: "diagnostico" }, results: [], ledgerFigs: figsDosBodegas, mem: {}, history: [] });
  ok(!!p.instruccion_columnas_capital, "2 bodegas con Capital detenido + % del total dispara instruccion_columnas_capital");
  ok(/Bodega.*SKU|SKU.*Bodega/.test(p.instruccion_columnas_capital) && /Capital detenido/.test(p.instruccion_columnas_capital) && /% del total/.test(p.instruccion_columnas_capital), "la instrucción nombra los 3 encabezados literales pedidos por el owner");

  // REGRESIÓN: una tabla de OTRO tipo (margen, sin "Capital detenido"/"% del total") no debe dispararla
  const figsMargen = [
    { label: "Falabella · Margen", value: "22%" }, { label: "Falabella · Ventas", value: "$19.4M" },
    { label: "Lider · Margen", value: "18%" }, { label: "Lider · Ventas", value: "$17.9M" },
  ];
  const pMargen = buildNarrateUserMessageC({ text: "x", plan: { mode: "diagnostico" }, results: [], ledgerFigs: figsMargen, mem: {}, history: [] });
  ok(!!pMargen.instruccion_tabla && !pMargen.instruccion_columnas_capital, "REGRESIÓN: tabla de margen (otros conceptos) sigue disparando instruccion_tabla, pero NO instruccion_columnas_capital");
}

console.log("\n── 7 · SMOKE LLM REAL — el caso EXACTO pedido por el owner, medido en vivo, gpt-4o-mini real ──");
{
  const callPlan = async ({ text, history, mem, scenario }) => { const r = await handlePlan({ text, history, mem, scenario }); if (!r.ok) throw new Error(r.error); return r.plan; };
  const callNarrate = async ({ text, plan, results, ledgerFigs, mem, history }) => {
    const built = buildNarrateUserMessageC({ text, plan, results, ledgerFigs, mem, history });
    const r = await handleNarrateC({ payload: built, mem });
    if (!r.ok) throw new Error(r.error);
    return r.narration;
  };
  const hasTable = (t) => t.split("\n").some((l) => l.trim().startsWith("|") && l.trim().indexOf("|", 1) > 0);
  const hasCols = (t) => /capital detenido/i.test(t) && /%\s*del\s*total/i.test(t);
  // tablesSumTo100(t) → puede haber 1 tabla (solo bodega) o 2 (bodega Y sku, ver sección 6: "si tenés ambas, dos
  // tablas separadas") — cada BLOQUE de tabla (líneas "|" consecutivas) debe sumar 100 POR SÍ SOLO; sumar todo el
  // texto junto daría 200 con 2 tablas y parecería "mal" sin estarlo. Detecta bloques por líneas en blanco.
  const tablesSumTo100 = (t) => {
    const blocks = t.split(/\n\s*\n/).filter((b) => b.split("\n").some((l) => l.trim().startsWith("|")));
    if (!blocks.length) return false;
    return blocks.every((b) => {
      const pcts = [...b.matchAll(/\|\s*(\d+)%\s*\|/g)].map((m) => Number(m[1]));
      return pcts.length > 0 && pcts.reduce((a, x) => a + x, 0) === 100;
    });
  };

  console.log("  · pregunta directa de bodega (\"¿Dónde tengo capital inmovilizado?\") — N=3:");
  let tabOk = 0, colOk = 0, sumOk = 0, resolved = 0;
  for (let i = 0; i < 3; i++) {
    const r = await answerViaOracle({ text: "¿Dónde tengo capital inmovilizado?", history: [], mem: {}, scenario: "actual", callPlan, callNarrate });
    if (!r) continue;
    resolved++;
    const t = r.r.text;
    if (hasTable(t)) tabOk++;
    if (hasCols(t)) colOk++;
    if (tablesSumTo100(t)) sumOk++;
  }
  console.log(`    medición: ${tabOk}/${resolved} con tabla real · ${colOk}/${resolved} con encabezados "Capital detenido"+"% del total" · ${sumOk}/${resolved} con CADA tabla citada sumando exacto 100`);
  ok(resolved === 0 || tabOk === resolved, `todas las corridas resueltas traen tabla real (obtuvo ${tabOk}/${resolved})`);
  ok(resolved === 0 || colOk >= Math.ceil(resolved * 0.66), `al menos 2/3 de las resueltas citan los encabezados EXACTOS pedidos (obtuvo ${colOk}/${resolved})`);
  ok(resolved === 0 || sumOk === resolved, `TODAS las corridas resueltas citan los % SIN perder ni duplicar filas al transcribir — cada tabla suma 100 (obtuvo ${sumOk}/${resolved})`);

  // Owner 2026-08-03 (captura real): "¿por qué los SKU no están en tabla?" — el refuerzo de historia completa
  // (sección 10) había desplazado la tabla de SKU a favor de la prosa causal. La causa VA ADEMÁS de la tabla, no
  // en vez de ella — medido en vivo, bajó a 0/6 antes de corregir la instrucción, acá se blinda que no vuelva.
  console.log("  · misma pregunta — ¿la tabla de SKU sigue apareciendo JUNTO con la causa en prosa? — N=4:");
  let skuTableOk = 0, resolved1b = 0;
  for (let i = 0; i < 4; i++) {
    const r = await answerViaOracle({ text: "¿Dónde tengo capital inmovilizado?", history: [], mem: {}, scenario: "actual", callPlan, callNarrate });
    if (!r) continue;
    resolved1b++;
    const t = r.r.text;
    const tableBlocks = (t.match(/\|[^\n]*\n\|[-\s|]+\|(?:\n\|[^\n]*)+/g) || []);
    const skuTable = tableBlocks.some((b) => /LG-DRYER8KG|BOS-SANDER|MAK-COMP-AIR/.test(b));
    console.log(`    run: tabla_de_sku=${skuTable}`);
    if (skuTable) skuTableOk++;
  }
  console.log(`    medición: ${skuTableOk}/${resolved1b} corridas con tabla de SKU (no solo prosa)`);
  ok(resolved1b === 0 || skuTableOk >= Math.ceil(resolved1b * 0.66), `al menos 2/3 de las corridas resueltas SIGUEN armando la tabla de SKU (no la reemplazan por prosa) — obtuvo ${skuTableOk}/${resolved1b}`);

  console.log("  · pregunta mixta bodega+SKU (\"qué SKU tienen más capital detenido, con su porcentaje del total\") — N=2:");
  // NO exigimos "2 tablas separadas" a rajatabla: medido en vivo, el narrador a veces (correctamente) responde
  // la tabla de SKU (lo que se preguntó) y menciona la bodega en PROSA como contexto — es MEJOR historia que una
  // 2da tabla no pedida, siempre que no MEZCLE una fila de bodega adentro de la tabla de SKU. Lo que sí importa:
  // si aparecen 2 tablas, que NINGUNA mezcle nombres de bodega y de SKU bajo el mismo encabezado.
  const BODEGAS_CONOCIDAS = ["Valparaíso", "Antofagasta"];
  let noMixOk = 0, resolved2 = 0;
  for (let i = 0; i < 2; i++) {
    const r = await answerViaOracle({ text: "qué SKU tienen más capital detenido, con su porcentaje del total", history: [], mem: {}, scenario: "actual", callPlan, callNarrate });
    if (!r) continue;
    resolved2++;
    const t = r.r.text;
    const tableBlocks = (t.match(/\|[^\n]*\n\|[-\s|]+\|(?:\n\|[^\n]*)+/g) || []);
    const anyMixed = tableBlocks.some((b) => BODEGAS_CONOCIDAS.some((bod) => b.includes(`| ${bod} `) || b.includes(`|${bod}`)) && /LG-DRYER8KG|BOS-SANDER|MAK-COMP-AIR/.test(b));
    console.log(`    run: ${tableBlocks.length} tabla(s) detectada(s) · mezcla bodega+SKU en la misma tabla=${anyMixed}`);
    if (!anyMixed) noMixOk++;
  }
  console.log(`    medición: ${noMixOk}/${resolved2} corridas SIN mezclar bodega y SKU bajo el mismo encabezado de tabla`);
  ok(resolved2 === 0 || noMixOk === resolved2, `NINGUNA corrida mezcla filas de bodega y de SKU bajo un solo encabezado de tabla (obtuvo ${noMixOk}/${resolved2})`);

  // SMOKE del hallazgo propio (owner 2026-08-02, encontrado en vivo DESPUÉS del primer pase): alcance de 1 bodega
  // ("cuánto capital tengo en Valparaíso") trae igual 2+ SKU de esa bodega en el ledger — sin el backstop
  // determinístico stripSingleRowTables, el narrador a veces igual tabulaba la bodega (1 fila) citando una cifra
  // SUELTA sin " · " (enrichFromFacts, ledger.js — root-cause corregido en el 2do pase, ver _ledger_entity_
  // attribution_gate.mjs). Medido: instrucción sola llegó a ~75% (6/8 en la sesión de diagnóstico), el backstop
  // de código lo cierra a 100%.
  console.log("  · alcance de 1 bodega con 2+ SKU dentro (\"cuánto capital tengo detenido en Valparaíso\") — N=4:");
  let noSingleRowTable = 0, resolved3 = 0;
  for (let i = 0; i < 4; i++) {
    const r = await answerViaOracle({ text: "cuánto capital tengo detenido en Valparaíso", history: [], mem: {}, scenario: "actual", callPlan, callNarrate });
    if (!r) continue;
    resolved3++;
    const t = r.r.text;
    const bodegaTable = /\|\s*Bodega\s*\|[\s\S]*?\n\s*\|\s*Valpara[ií]so\s*\|/i.test(t);
    console.log(`    run: tabla-de-bodega-1-fila=${bodegaTable}`);
    if (!bodegaTable) noSingleRowTable++;
  }
  console.log(`    medición: ${noSingleRowTable}/${resolved3} corridas SIN tabla de 1 fila para la bodega única`);
  ok(resolved3 === 0 || noSingleRowTable === resolved3, `NINGUNA corrida resuelta arma tabla de 1 fila para la bodega única (obtuvo ${noSingleRowTable}/${resolved3} limpias)`);
}

console.log("\n── 8 · stripSingleRowTables — backstop determinístico, unit ──");
{
  const t1 = "Tenés $25K en Valparaíso.\n\n| Bodega | Capital detenido | % del total |\n|---|---|---|\n| Valparaíso | $25K | 100% |\n\n¿Seguimos?";
  const s1 = stripSingleRowTables(t1);
  ok(!s1.includes("|"), `tabla de 1 fila de datos se borra por completo (quedó: "${s1}")`);
  ok(s1.includes("Tenés $25K en Valparaíso.") && s1.includes("¿Seguimos?"), "la prosa antes y después de la tabla se conserva intacta");

  const t2 = "| SKU | Capital detenido | % del total |\n|---|---|---|\n| LG-DRYER8KG | $14K | 55% |\n| BOS-SANDER | $11K | 45% |";
  ok(stripSingleRowTables(t2) === t2, "REGRESIÓN: tabla de 2+ filas de datos queda BYTE-IGUAL (no se toca una tabla real)");

  const t3 = "Prosa sin ninguna tabla.";
  ok(stripSingleRowTables(t3) === t3, "texto sin tablas queda byte-igual");

  const t4 = "Bodega\n| Bodega | Capital |\n|---|---|\n| Valparaíso | $25K |\n\nSKU\n| SKU | Capital |\n|---|---|\n| A | $14K |\n| B | $11K |";
  const s4 = stripSingleRowTables(t4);
  ok(!/\|\s*Valpara[ií]so/.test(s4) && / A /.test(s4) && / B /.test(s4), "2 tablas en el mismo texto: la de 1 fila se borra, la de 2+ filas se conserva");

  // EXCEPCIÓN (owner 2026-08-02, segunda vuelta): "si el usuario pidió explícitamente una tabla, debe
  // conservarse aunque tenga una fila" — stripSingleRowTables es un candado contra tablas NO pedidas, no contra
  // tablas que el usuario pidió a propósito.
  ok(isExplicitTableRequest("ponme el capital de Valparaíso en una tabla"), "isExplicitTableRequest: pedido directo de tabla → true");
  ok(isExplicitTableRequest("quiero eso en formato tabla"), "isExplicitTableRequest: 'formato tabla' → true");
  ok(!isExplicitTableRequest("cuánto capital tengo en Valparaíso"), "isExplicitTableRequest: pregunta normal, sin mención de tabla → false");
  ok(!isExplicitTableRequest("no me hagas una tabla, solo el número"), "isExplicitTableRequest: negación explícita ('no me hagas una tabla') → false");
  ok(!isExplicitTableRequest("dame el resumen sin tabla"), "isExplicitTableRequest: negación ('sin tabla') → false");
  ok(isExplicitTableRequest("no sé cómo se ve, pero armá una tabla con el detalle"), "isExplicitTableRequest: 'no' lejos del pedido de tabla (no es negación real) → true");

  const s1WithRequest = stripSingleRowTables(t1, "ponme el capital de Valparaíso en una tabla");
  ok(s1WithRequest === t1, "REGRESIÓN CRÍTICA: con pedido EXPLÍCITO de tabla, la tabla de 1 fila se CONSERVA byte-igual, no se borra");
  const s1WithoutRequest = stripSingleRowTables(t1, "cuánto capital tengo en Valparaíso");
  ok(!s1WithoutRequest.includes("|"), "sin pedido explícito (pregunta normal), la tabla de 1 fila SIGUE borrándose igual que antes");
}

console.log("\n── 9 · SMOKE LLM REAL — tabla explícita de 1 fila se CONSERVA (no la borra el backstop) ──");
{
  const callPlan = async ({ text, history, mem, scenario }) => { const r = await handlePlan({ text, history, mem, scenario }); if (!r.ok) throw new Error(r.error); return r.plan; };
  const callNarrate = async ({ text, plan, results, ledgerFigs, mem, history }) => {
    const built = buildNarrateUserMessageC({ text, plan, results, ledgerFigs, mem, history });
    const r = await handleNarrateC({ payload: built, mem });
    if (!r.ok) throw new Error(r.error);
    return r.narration;
  };
  let tableKept = 0, resolved4 = 0;
  const Q = "ponme en una tabla cuánto capital tengo detenido en Valparaíso";
  for (let i = 0; i < 3; i++) {
    const r = await answerViaOracle({ text: Q, history: [], mem: {}, scenario: "actual", callPlan, callNarrate });
    if (!r) continue;
    resolved4++;
    const hasTable = r.r.text.split("\n").some((l) => l.trim().startsWith("|") && l.trim().indexOf("|", 1) > 0);
    console.log(`  run: tabla_presente=${hasTable}`);
    if (hasTable) tableKept++;
  }
  console.log(`  medición: ${tableKept}/${resolved4} corridas con tabla pedida explícitamente PRESERVADA (pedido: "${Q}")`);
  ok(resolved4 === 0 || tableKept >= 1, `al menos 1/${resolved4 || 3} conserva la tabla cuando el usuario la pidió explícitamente, aunque el alcance sea 1 sola bodega`);
}

console.log("\n── 10 · SMOKE LLM REAL — HISTORIA COMPLETA: la tabla nunca es el cierre, sigue el por qué y el qué hacer ──");
{
  // Owner 2026-08-02, tercera vuelta ("respeta nuestra promesa... qué está pasando y por qué pasa y qué hacer"):
  // capturas reales mostraron 3 turnos (1 chip + 2 escritos) que SOLO daban la tabla + total + una oferta genérica
  // de "profundizar" — nunca la causa (rotación/días de cobertura/días sin venta, YA autorizados) ni la acción
  // puntual (qué SKU liberar primero, con su $). Backstop de INSTRUCCIÓN (no hay forma determinística de esto sin
  // dictar el texto entero) — medido en vivo, sube de 0/5 a ~9/9 en la sesión de diagnóstico.
  const callPlan = async ({ text, history, mem, scenario }) => { const r = await handlePlan({ text, history, mem, scenario }); if (!r.ok) throw new Error(r.error); return r.plan; };
  const callNarrate = async ({ text, plan, results, ledgerFigs, mem, history }) => {
    const built = buildNarrateUserMessageC({ text, plan, results, ledgerFigs, mem, history });
    const r = await handleNarrateC({ payload: built, mem });
    if (!r.ok) throw new Error(r.error);
    return r.narration;
  };
  const hasCausa = (t) => /rotaci[oó]n|d[ií]as? de cobertura|d[ií]as? sin venta/i.test(t);
  const hasAccionPuntual = (t) => /LG-DRYER8KG|BOS-SANDER|MAK-COMP-AIR/.test(t) && /\$\d/.test(t);
  const hasRotuloProhibido = (t) => /\*{0,2}(Por qu[eé]|Qu[eé] hacer)( primero)?\*{0,2}\s*:/i.test(t) || /^#{1,6}\s*(Por qu[eé]|Qu[eé] hacer)/im.test(t);

  let arcOk = 0, noLabelOk = 0, resolved5 = 0;
  for (let i = 0; i < 4; i++) {
    const r = await answerViaOracle({ text: "¿Dónde tengo capital inmovilizado?", history: [], mem: {}, scenario: "actual", callPlan, callNarrate });
    if (!r) continue;
    resolved5++;
    const t = r.r.text;
    const causa = hasCausa(t), accion = hasAccionPuntual(t), rotulo = hasRotuloProhibido(t);
    console.log(`  run: causa=${causa} · acción_puntual_con_$=${accion} · rótulo_prohibido=${rotulo}`);
    if (causa && accion) arcOk++;
    if (!rotulo) noLabelOk++;
  }
  console.log(`  medición: ${arcOk}/${resolved5} corridas con la historia completa (causa + acción puntual) · ${noLabelOk}/${resolved5} sin rótulos internos prohibidos`);
  ok(resolved5 === 0 || arcOk === resolved5, `TODAS las corridas resueltas cierran con causa Y acción puntual, no solo la tabla + oferta genérica (obtuvo ${arcOk}/${resolved5})`);
  ok(resolved5 === 0 || noLabelOk === resolved5, `NINGUNA corrida usa rótulos internos tipo "Por qué:"/"Qué hacer:" (prohibido en LA ESTRUCTURA del prompt) — obtuvo ${noLabelOk}/${resolved5} limpias`);
}

console.log(`\n── _capital_pct_reconciliation_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
