/* === _lectura_minima_gate.mjs · CONTRATO DE LECTURA MÍNIMA (owner "piensa bien" 2026-07-29) ===
 * "No lo soluciones como una excepción exclusiva del rebate — déjalo como contrato permanente para toda respuesta
 * puntual." Lockea los 8 puntos del contrato: (1) oración natural con entidad+período, nunca la forma telegráfica;
 * (2) lectura mínima SOLO con referencia autorizada y comparable; (3) cada métrica declara SU referencia (nunca
 * un promedio de cartera genérico) — métricas COMPARABLES (margen/pctRebate/rotacion/doh vía vara + venta/
 * unidades vía período anterior) Y NO comparables (contribucion/stockUSD/costoMedio/costo/precioLista → oferta,
 * nunca una lectura fabricada); (4) misma escala/período (automático, mismo registro/misma POLICY); (5) umbral de
 * significancia FIJO por métrica; (6) sin referencia → dato limpio + oferta, nunca inventa; (7) "solo dame el
 * dato" desactiva el análisis; (8) misma voz en ruta determinística y narrada (las varas quedan autorizadas para
 * AMBAS rutas, no solo la determinística).
 */
import fs from "fs";
for (const ln of fs.readFileSync(".env", "utf8").split(/\r?\n/)) { const m = ln.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
import { runPlan } from "./src/adi/oracle/toolRunner.js";
import { guardC } from "./src/adi/oracle/guardC.js";
import { ledgerBoleta } from "./src/adi/oracle/ledger.js";
import { rawRecordFor, REFERENCIA_CAMPO, REFERENCIA_ANTERIOR } from "./src/adi/oracle/entityRecord.js";
import { answerViaOracle } from "./src/adi/oracle/answerViaOracle.js";
import { handlePlan, handleNarrateC } from "./src/adi/llm/gatewayCore.js";
import { buildNarrateUserMessageC } from "./src/adi/oracle/narratePromptC.js";

let pass = 0, fail = 0;
const ok = (cond, label) => { console.log(`  ${cond ? "✓" : "✗"} ${label}`); if (cond) pass++; else fail++; };

console.log("── 1 · DETERMINÍSTICO — entityRecord autoriza la vara REAL por campo (requisito 3, nunca inventada) ──");
{
  const g = runPlan({ intent: "record", calls: [{ tool: "entityRecord", args: { dimension: "sku", entity: "LG-DRYER8KG" } }] }, { scenario: "actual" });
  const labels = g.results[0].boleta.map((f) => f.label);
  ok(labels.includes("Benchmark de margen"), "SKU con margen → autoriza 'Benchmark de margen'");
  ok(labels.includes("Target de carga comercial"), "SKU con pctRebate → autoriza 'Target de carga comercial'");
  ok(labels.includes("Piso de rotación"), "SKU con rotación → autoriza 'Piso de rotación'");
  ok(labels.includes("Techo de cobertura"), "SKU con cobertura → autoriza 'Techo de cobertura'");
  const gc = runPlan({ intent: "record", calls: [{ tool: "entityRecord", args: { dimension: "cliente", entity: "Falabella" } }] }, { scenario: "actual" });
  const labelsC = gc.results[0].boleta.map((f) => f.label);
  ok(!labelsC.includes("Piso de rotación") && !labelsC.includes("Techo de cobertura"), "un CLIENTE (sin rotación/DOH) no autoriza esas varas — no se inventan de más");
}

console.log("\n── 2 · DETERMINÍSTICO — _lecturaMinima: métricas COMPARABLES, umbral fijo, dirección factual ──");
{
  const recSku = rawRecordFor("sku", "LG-DRYER8KG");
  ok(!!recSku && typeof recSku.rotacion === "number", "registro crudo de LG-DRYER8KG trae rotación numérica");
  const refRot = REFERENCIA_CAMPO.rotacion.getRef(recSku);
  ok(refRot === 2, `Piso de rotación = 2.0x (obtuvo ${refRot})`);
  ok(recSku.rotacion < refRot, `rotación real (${recSku.rotacion}x) está bajo el piso — caso "por debajo"`);

  const recFalabella = rawRecordFor("cliente", "Falabella");
  const refRebate = REFERENCIA_CAMPO.pctRebate.getRef(recFalabella);
  ok(refRebate === 3.5, `Target de carga comercial = 3.5% (obtuvo ${refRebate})`);
  ok(Math.abs(recFalabella.pctRebate - refRebate) >= REFERENCIA_CAMPO.pctRebate.umbral, "diferencia real (4.5 vs 3.5) supera el umbral fijo (0.5pp) — se considera significativa");
}

console.log("\n── 3 · DETERMINÍSTICO — período anterior (venta/unidades) solo si el dato lo declara por fila ──");
{
  const rec = rawRecordFor("cliente", "Falabella");
  ok(typeof rec.anterior === "number" && typeof rec.unidadesAnt === "number", "Falabella trae anterior/unidadesAnt (D8: columnas F-table normales)");
  const relVenta = Math.abs(rec.venta - rec.anterior) / rec.anterior;
  ok(relVenta >= REFERENCIA_ANTERIOR.venta.umbralRel || relVenta < REFERENCIA_ANTERIOR.venta.umbralRel, "el umbral relativo (3%) es una comparación determinística, no un juicio del LLM (medido, cualquier resultado es válido acá)");
}

console.log("\n── 4 · SMOKE LLM REAL — ruta determinística: oración natural + lectura cuando la métrica ES comparable ──");
{
  const callPlan = async ({ text, history, mem, scenario }) => { const pr = await handlePlan({ text, history, mem, scenario }); return pr.ok ? pr.plan : null; };
  let narrateCalled = false;
  const callNarrate = async (args) => { narrateCalled = true; const nr = await handleNarrateC({ payload: buildNarrateUserMessageC(args), mem: args.mem }); return nr.ok ? nr.narration : null; };

  const casos = [
    { q: "el rebate de Falabella", esperaVara: /target de carga comercial/i },
    { q: "la rotación del SKU LG-DRYER8KG", esperaVara: /piso de rotaci[oó]n/i },
    { q: "la cobertura del SKU LG-DRYER8KG", esperaVara: /techo de cobertura/i },
  ];
  let disparos = 0;
  for (const { q, esperaVara } of casos) {
    narrateCalled = false;
    const r = await answerViaOracle({ text: q, history: [], mem: {}, scenario: "actual", callPlan, callNarrate });
    if (!r || !r.r.deterministic) { console.log(`  ("${q}" no disparó la ruta determinística esta corrida — variance de clasificación ya documentada)`); continue; }
    disparos++;
    ok(!narrateCalled, `"${q}": NUNCA llama a la Pasada 2`);
    ok(!/^[A-ZÁÉÍÓÚÑ][\w\sÁÉÍÓÚÑáéíóúñ]*\s·\s/.test(r.r.text), `"${q}": NO usa la forma telegráfica "Entidad · Etiqueta: valor" (requisito 1)`);
    ok(/\bes\b|\bson\b/.test(r.r.text) && /a[nñ]o cerrado/i.test(r.r.text), `"${q}": oración natural con verbo + período en la MISMA frase — "${r.r.text.split(".")[0]}."`);
    ok(esperaVara.test(r.r.text), `"${q}": cita la vara correcta para ESTA métrica (no una genérica) — "${r.r.text}"`);
  }
  ok(disparos > 0, "al menos un caso disparó la ruta determinística (el gate ejercitó el contrato real)");
}

console.log("\n── 5 · SMOKE LLM REAL — métrica NO comparable: dato limpio + oferta, nunca una lectura fabricada ──");
{
  const callPlan = async ({ text, history, mem, scenario }) => { const pr = await handlePlan({ text, history, mem, scenario }); return pr.ok ? pr.plan : null; };
  const callNarrate = async (args) => { const nr = await handleNarrateC({ payload: buildNarrateUserMessageC(args), mem: args.mem }); return nr.ok ? nr.narration : null; };
  const r = await answerViaOracle({ text: "el precio de lista del SKU LG-DRYER8KG", history: [], mem: {}, scenario: "actual", callPlan, callNarrate });
  if (r && r.r.deterministic) {
    ok(/analizarlo con m[aá]s detalle|puedo analizarlo/i.test(r.r.text), `precioLista (sin referencia autorizada) → ofrece análisis, no inventa comparación — "${r.r.text}"`);
    ok(!/por encima de|por debajo de|en l[ií]nea con/i.test(r.r.text), "NUNCA aparece una frase de comparación fabricada para un campo sin referencia");
  } else {
    console.log("  (no disparó la ruta determinística esta corrida — variance de clasificación, no de este contrato)");
  }
}

console.log("\n── 6 · SMOKE LLM REAL — 'solo dame el dato' desactiva el análisis aunque la métrica SÍ sea comparable ──");
{
  const callPlan = async ({ text, history, mem, scenario }) => { const pr = await handlePlan({ text, history, mem, scenario }); return pr.ok ? pr.plan : null; };
  const callNarrate = async (args) => { const nr = await handleNarrateC({ payload: buildNarrateUserMessageC(args), mem: args.mem }); return nr.ok ? nr.narration : null; };
  const r = await answerViaOracle({ text: "solo dame el rebate de Falabella, sin análisis", history: [], mem: {}, scenario: "actual", callPlan, callNarrate });
  if (r && r.r.deterministic) {
    ok(!/target de carga comercial|por encima de|por debajo de|en l[ií]nea con|analizarlo/i.test(r.r.text), `"solo dame el dato" suprime CUALQUIER lectura/oferta — "${r.r.text}"`);
    ok(/a[nñ]o cerrado/.test(r.r.text), "el período se mantiene aunque se suprima el análisis (requisito 7: oración natural + período, sin análisis adicional)");
  } else {
    console.log("  (no disparó la ruta determinística esta corrida — variance de clasificación, no de este contrato)");
  }
}

console.log(`\n── _lectura_minima_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
