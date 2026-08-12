/* === _microcert_n1_live.mjs · UN SOLO TURNO, LA CONDICIÓN DE DEPLOY (owner 2026-08-12) ========================
 * N1 es lo único que falta comprobar en vivo: que el narrador acierte SOLO, con la doctrina condicional en el
 * payload, sin que lo salve el compositor determinístico.
 * LA CONDICIÓN DURA, y por eso este archivo la mide y no la interpreta: pasa NARRADO (`narrationRepaired`
 * ausente), en 1 PLAN + 1 NARRAR, declarando la estimación, sin recomendar sin marco y sin cruzar sujeto con
 * cifra. Si necesita el fallback, el texto va a ser correcto igual —el muro y la reparación ya están probados—
 * pero la doctrina no habrá alcanzado, y eso se reporta como tal, no como verde.
 *
 * NO CORRE SOLA: exige `ADI_MICROCERT_N1=1`.
 * ES UN GATE LIVE: llama al gateway. No lleva el marcador de inyección simulada — el clasificador lo busca con un
 * regex plano sobre el fuente, así que escribirlo aunque fuera para negarlo lo metería en la suite offline.
 */
import * as fsReal from "node:fs";
import { answerViaOracle } from "./src/adi/oracle/answerViaOracle.js";
import { instalarTelemetria, telemetriaInstalada } from "./src/adi/llm/telemetrySink.js";
import { toolNames } from "./src/adi/oracle/toolRegistry.js";
import { estimateCostUSD } from "./src/adi/llm/modelPricing.js";
import { buildNarrateUserMessageC } from "./src/adi/oracle/narratePromptC.js";
import { crearCerrojo } from "./_certificacion_v12_live.mjs";
import { armarRegistroDeTurno, persistirCorrida } from "./scripts/replay-local.mjs";

export const TOPE_LLAMADAS = 6;
export const TOPE_USD = 0.15;

export const PREGUNTA = "Para SAM-TV55 y LG-WASH11KG, ¿qué clientes podrían comprarlos? Separá lo probado de la afinidad indicada.";

const _ES_PIE = /^\(?\s*(?:alcance|datos del|foto de inventario|supuesto)\b/i;
const _cuerpo = (t) => String(t || "").split(/\n{2,}/).map((s) => s.trim()).filter(Boolean).filter((s) => !_ES_PIE.test(s));
const _RECOMIENDA = /\b(?:sugiero|recomiendo|conviene|deber[íi]as?|hay que|habr[íi]a que|prioriz[aá]|reforz[aá]|activ[aá]|empez[aá] por|enfoc[aá]|considera|consider[aá])\b/i;
const _ENMARCA = /\b(?:posible|posibles|podr[íi]as?|podr[íi]an?|hip[oó]tesis|a validar|por validar|si se confirma|candidat[oa]s?|tentativ[oa]s?|explorar|evaluar|probar si|estimad[oa]s?|afinidad)\b/i;

export const CONDICIONES = [
  ["el PLAN elige clientesPorSku", ({ plan }) => !!(plan && (plan.calls || []).some((c) => c && c.tool === "clientesPorSku"))],
  // LAS DOS CONDICIONES DE DEPLOY, primero porque son las que el owner puso como corte.
  ["NARRADO, sin fallback (`narrationRepaired` ausente)", ({ r }) => !(r && r.narrationRepaired)],
  ["1 PLAN + 1 NARRAR", ({ llamadas }) => llamadas === 2],
  ["DECLARA que la relación es estimada", ({ texto }) => /afinidad|estimad|candidat|no registra|podr[íi]an? comprar/i.test(texto)],
  ["NO afirma historial de compra", ({ texto }) => !/volumen de compras?|cuenta predominante|cliente predominante|historial de compras?|(?:le|les) vendimos/i.test(texto)],
  ["ninguna recomendación sin marco de hipótesis", ({ texto }) =>
    !texto.split(/(?<=[.!?])\s+/).some((o) => _RECOMIENDA.test(o) && !_ENMARCA.test(o))],
  /* SUJETO Y CIFRA · se mide sobre el TEXTO FINAL, venga del narrador o del fallback: la atribución cruzada es
   * igual de grave la escriba quien la escriba. Se busca «Sobre X: Y · …» con X ≠ Y. */
  ["no cruza sujeto con cifra", ({ texto }) => {
    const m = texto.match(/Sobre ([^:\n]+):\s*([^\n·]+?)\s*·/);
    return !m || m[1].trim() === m[2].trim();
  }],
  ["tiene cuerpo, no sólo el pie", ({ texto }) => _cuerpo(texto).length > 0],
];

function imprimirMatriz() {
  console.log(`\n── MICRO-CERTIFICACIÓN N1 · 1 turno · topes ${TOPE_LLAMADAS} llamadas / US$${TOPE_USD.toFixed(2)} ──\n`);
  console.log(`«${PREGUNTA}»\n`);
  console.log(`verifica: ${CONDICIONES.map(([n]) => n).join(" · ")}\n`);
}

if (process.env.ADI_MICROCERT_N1 !== "1") {
  imprimirMatriz();
  console.log("── NO SE EJECUTÓ: gasta. Requiere `ADI_MICROCERT_N1=1` + credencial + autorización del owner. ──\n");
  process.exit(0);
}

{
  imprimirMatriz();
  const RUTA_TELEMETRIA = process.env.ADI_TELEMETRY_FILE || null;
  if (RUTA_TELEMETRIA) instalarTelemetria({ ruta: RUTA_TELEMETRIA, tools: toolNames(), fs: fsReal });
  if (RUTA_TELEMETRIA && !telemetriaInstalada()) { console.error("telemetría pedida y no instalada — se aborta antes de gastar"); process.exit(1); }

  const { handlePlan, handleNarrateC } = await import("./src/adi/llm/gatewayCore.js");
  const cerrojo = crearCerrojo({ topeLlamadas: TOPE_LLAMADAS, topeUSD: TOPE_USD });
  let planReal = null, llamadas = 0, error = null, r = null, texto = "";

  try {
    const out = await answerViaOracle({
      text: PREGUNTA, history: [], mem: {}, scenario: "actual",
      callPlan: async (args) => {
        cerrojo.guardar("N1/plan"); llamadas++;
        const res = await handlePlan({ ...args, access: process.env.ADI_ACCESS_CODE }, process.env);
        cerrojo.registrar(estimateCostUSD(res && res.modelUsed, res && res.usage) || 0);
        if (!res || !res.ok) throw new Error((res && res.error) || "gateway sin plan");
        planReal = res.plan;
        return res.plan;
      },
      callNarrate: async (args) => {
        cerrojo.guardar("N1/narrar"); llamadas++;
        const res = await handleNarrateC({ payload: buildNarrateUserMessageC(args), mem: args.mem, access: process.env.ADI_ACCESS_CODE, attempt: args.attempt }, process.env);
        cerrojo.registrar(estimateCostUSD(res && res.modelUsed, res && res.usage) || 0);
        if (!res || !res.ok) throw new Error((res && res.error) || "gateway sin narración");
        return res.narration;
      },
    });
    r = out && out.r;
    texto = r ? String(r.text || "") : "";
  } catch (e) { error = String(e && e.message); }

  const fallas = error ? ["ERROR: " + error]
    : CONDICIONES.filter(([, f]) => { try { return !f({ plan: planReal, texto, r, llamadas }); } catch { return true; } }).map(([n]) => n);

  console.log("── RESULTADO ──");
  console.log(`  tools: ${(planReal && (planReal.calls || []).map((c) => c && c.tool).filter(Boolean).join(",")) || "—"}`);
  console.log(`  llamadas: ${llamadas} · fallback: ${r && r.narrationRepaired ? "SÍ (el compositor resolvió el turno)" : "NO (narrado)"}`);
  for (const [n, f] of CONDICIONES) {
    if (error) break;
    let vale = false; try { vale = !!f({ plan: planReal, texto, r, llamadas }); } catch { vale = false; }
    console.log(`  ${vale ? "✓" : "✗"} ${n}`);
  }
  if (error) console.log(`  ✗ ${error}`);
  console.log(`\n── TEXTO FINAL ──\n${texto || "(vacío)"}`);

  const est = cerrojo.estado();
  console.log(`\n── CONSUMO ── ${est.enviadas}/${est.topeLlamadas} llamadas · US$${est.gastoUSD.toFixed(4)}/${est.topeUSD}${est.detenido ? ` · DETENIDA: ${est.detenido}` : ""}`);
  persistirCorrida(process.env.ADI_COMMIT || "microcert-n1", [armarRegistroDeTurno({ id: "N1", plan: planReal, results: r && r.results, texto, scenario: "actual" })]);
  console.log(fallas.length ? `\nNO CUMPLE · ${fallas.join(" · ")}` : "\nCUMPLE · las 8 condiciones");
  process.exit(fallas.length ? 1 : 0);
}
