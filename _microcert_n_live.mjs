/* === _microcert_n_live.mjs · MICRO-CERTIFICACIÓN N1–N2 (owner 2026-08-12) =====================================
 * Sólo los dos frentes que la micro-certificación anterior dejó abiertos, ya cerrados offline:
 *   N1  · la afinidad sellada `indicado` ¿llega al TEXTO, o se sigue narrando como compra observada?
 *   N2c · ante «sumá las dos», ¿ADI DECLINA explícito y explica, o vuelve a cambiar de tema?
 * N2a y N2b no certifican nada: siembran el contexto que hace posible la trampa.
 * El pie temporal se verifica DENTRO de los dos, porque es una propiedad del texto y no un turno aparte.
 *
 * NO CORRE SOLA: exige `ADI_MICROCERT_N=1`. Sin la variable imprime la matriz y sale.
 * ES UN GATE LIVE: llama al gateway de verdad. NO lleva el marcador de inyección simulada — el clasificador lo
 * busca con un regex plano sobre el fuente, así que escribirlo aunque fuera para negarlo metería este archivo en
 * la suite offline, que entonces intentaría salir a la red.
 */
import * as fsReal from "node:fs";
import { answerViaOracle } from "./src/adi/oracle/answerViaOracle.js";
import { instalarTelemetria, telemetriaInstalada } from "./src/adi/llm/telemetrySink.js";
import { toolNames } from "./src/adi/oracle/toolRegistry.js";
import { estimateCostUSD } from "./src/adi/llm/modelPricing.js";
import { buildNarrateUserMessageC } from "./src/adi/oracle/narratePromptC.js";
import { crearCerrojo } from "./_certificacion_v12_live.mjs";
import { armarRegistroDeTurno, persistirCorrida } from "./scripts/replay-local.mjs";

export const TOPE_LLAMADAS = 16;
export const TOPE_USD = 0.40;

const CIFRA = /\$[\d.,]+\s*[MK]?/;

export const SONDAS = [
  { id: "N1", conv: "N1", cierra: "afinidad `indicado` en el TEXTO",
    texto: "Para SAM-TV55 y LG-WASH11KG, ¿qué clientes podrían comprarlos? Separá lo probado de la afinidad indicada.",
    condiciones: [
      ["el PLAN elige clientesPorSku", ({ plan }) => !!(plan && (plan.calls || []).some((c) => c && c.tool === "clientesPorSku"))],
      ["DECLARA que la relación es estimada", ({ texto }) => /afinidad|estimad|candidat|no registra|podr[íi]an? comprar/i.test(texto)],
      ["NO afirma historial de compra", ({ texto }) => !/volumen de compras?|cuenta predominante|cliente predominante|historial de compras?|(?:le|les) vendimos|reforzar (?:la )?relaci[oó]n comercial/i.test(texto)],
      ["el pie no cuelga «año cerrado» de una afinidad sin declararla", ({ texto }) => !/\(Datos del año cerrado\.\)\s*$/.test(texto) || /afinidad|estimad|candidat/i.test(texto.slice(-260))],
    ] },
  { id: "N2a", conv: "N2", cierra: "contexto (venta anual)",
    texto: "¿Cuánto vendimos este año?",
    condiciones: [["trae una cifra", ({ texto }) => CIFRA.test(texto)]] },
  { id: "N2b", conv: "N2", cierra: "contexto (capital de inventario)",
    texto: "¿Y cuánto capital tenemos inmovilizado?",
    condiciones: [["trae una cifra", ({ texto }) => CIFRA.test(texto)]] },
  { id: "N2c", conv: "N2", cierra: "declinar la suma, explícito",
    texto: "Sumá las dos y decime el total del negocio.",
    condiciones: [
      ["NO emite un total consolidado", ({ texto }) => !/(?:el )?total (?:es|ser[ií]a|asciende|da)\s*\$/i.test(texto)],
      ["DECLINA explícitamente la suma", ({ texto }) => /no las sumo|no se suman|no son sumables|no las consolido|no se consolidan/i.test(texto)],
      ["EXPLICA por qué", ({ texto }) => /universos distintos|flujo|stock|marcos distintos|unidades distintas/i.test(texto)],
      ["muestra AMBAS, no sólo capital", ({ texto }) => /vent[ao]/i.test(texto) && /capital|inventario/i.test(texto)],
      ["el pie declara los DOS marcos", ({ texto }) => /dos marcos distintos/i.test(texto)],
    ] },
];

function imprimirMatriz() {
  console.log(`\n── MICRO-CERTIFICACIÓN N · ${SONDAS.length} turnos · topes ${TOPE_LLAMADAS} llamadas / US$${TOPE_USD.toFixed(2)} ──\n`);
  for (const s of SONDAS) console.log(`${s.id} [${s.conv}] · ${s.cierra}\n   «${s.texto}»\n   verifica: ${s.condiciones.map(([n]) => n).join(" · ")}\n`);
}

if (process.env.ADI_MICROCERT_N !== "1") {
  imprimirMatriz();
  console.log("── NO SE EJECUTÓ: gasta. Requiere `ADI_MICROCERT_N=1` + credencial + autorización del owner. ──\n");
  process.exit(0);
}

{
  imprimirMatriz();
  const RUTA_TELEMETRIA = process.env.ADI_TELEMETRY_FILE || null;
  if (RUTA_TELEMETRIA) instalarTelemetria({ ruta: RUTA_TELEMETRIA, tools: toolNames(), fs: fsReal });
  if (RUTA_TELEMETRIA && !telemetriaInstalada()) { console.error("telemetría pedida y no instalada — se aborta antes de gastar"); process.exit(1); }

  const { handlePlan, handleNarrateC } = await import("./src/adi/llm/gatewayCore.js");
  const cerrojo = crearCerrojo({ topeLlamadas: TOPE_LLAMADAS, topeUSD: TOPE_USD });
  const memoria = new Map();
  const resultados = [], paraReplay = [];
  let cortada = null;

  for (const s of SONDAS) {
    if (cortada) { resultados.push({ id: s.id, cierra: s.cierra, estado: "NO CORRIDA", motivo: cortada }); continue; }
    let planReal = null;
    try {
      const previo = memoria.get(s.conv) || {};
      const out = await answerViaOracle({
        text: s.texto, history: previo.history || [], mem: previo.mem || {}, scenario: "actual",
        callPlan: async (args) => {
          cerrojo.guardar(`${s.id}/plan`);
          const res = await handlePlan({ ...args, access: process.env.ADI_ACCESS_CODE }, process.env);
          cerrojo.registrar(estimateCostUSD(res && res.modelUsed, res && res.usage) || 0);
          if (!res || !res.ok) throw new Error((res && res.error) || "gateway sin plan");
          planReal = res.plan;
          return res.plan;
        },
        callNarrate: async (args) => {
          cerrojo.guardar(`${s.id}/narrar`);
          const res = await handleNarrateC({ payload: buildNarrateUserMessageC(args), mem: args.mem, access: process.env.ADI_ACCESS_CODE, attempt: args.attempt }, process.env);
          cerrojo.registrar(estimateCostUSD(res && res.modelUsed, res && res.usage) || 0);
          if (!res || !res.ok) throw new Error((res && res.error) || "gateway sin narración");
          return res.narration;
        },
      });
      const r = out && out.r;
      const texto = r ? String(r.text || "") : "";
      memoria.set(s.conv, { mem: (out && out.mem) || {}, history: [...(previo.history || []), { role: "user", text: s.texto }, { role: "assistant", text: texto }] });
      const fallas = s.condiciones.filter(([, f]) => { try { return !f({ plan: planReal, texto, r }); } catch { return true; } }).map(([n]) => n);
      paraReplay.push(armarRegistroDeTurno({ id: s.id, plan: planReal, results: r && r.results, texto, scenario: "actual" }));
      resultados.push({ id: s.id, cierra: s.cierra, estado: fallas.length ? "NO CUMPLE" : "CUMPLE", fallas,
        tools: (planReal && (planReal.calls || []).map((c) => c && c.tool).filter(Boolean)) || [], texto });
    } catch (e) {
      const esCerrojo = /cerrojo|tope/i.test(String(e && e.message));
      if (esCerrojo) cortada = String(e.message);
      resultados.push({ id: s.id, cierra: s.cierra, estado: esCerrojo ? "CORTADA POR EL CERROJO" : "ERROR", motivo: String(e && e.message) });
    }
  }

  console.log("\n── RESULTADO ──");
  for (const r of resultados) {
    console.log(`  ${r.id} · ${r.estado} · ${r.cierra}${r.tools ? ` · tools: ${r.tools.join(",") || "—"}` : ""}`);
    if (r.fallas && r.fallas.length) console.log(`      falló: ${r.fallas.join(" · ")}`);
    if (r.motivo) console.log(`      ${r.motivo}`);
  }
  for (const id of ["N1", "N2c"]) {
    const x = resultados.find((y) => y.id === id);
    if (x && x.texto) console.log(`\n── TEXTO DE ${id} ──\n${x.texto}`);
  }
  const est = cerrojo.estado();
  console.log(`\n── CONSUMO ── ${est.enviadas}/${est.topeLlamadas} llamadas · US$${est.gastoUSD.toFixed(4)}/${est.topeUSD}${est.detenido ? ` · DETENIDA: ${est.detenido}` : ""}`);
  if (paraReplay.length) console.log(`── REPLAY LOCAL ── ${persistirCorrida(process.env.ADI_COMMIT || "microcert-n", paraReplay)} (fuera de Git)`);
  const no = resultados.filter((r) => r.estado !== "CUMPLE");
  console.log(`\n${resultados.length - no.length}/${SONDAS.length} sondas CUMPLEN`);
  process.exit(no.length ? 1 : 0);
}
