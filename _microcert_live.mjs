/* === _microcert_live.mjs · MICRO-CERTIFICACIÓN M1–M4 (owner 2026-08-12) =======================================
 * Sólo lo que se tocó al cerrar los tres rojos de la corrida corta, más el turno que recoge la evidencia que faltó.
 *   M1 · `clientesPorSku` ahora está en el enum del planificador — ¿la elige?
 *   M2 · cobertura parcial: cuatro reales + `NoExisteSA`, ¿se nombra la faltante?
 *   M3 · `solo_conclusion` sobre M2 — ¿queda breve aunque el narrador entregue un párrafo largo?
 *   M4 · tres turnos: venta → capital → «sumá las dos». NO cierra un defecto: RECOGE EL TEXTO que faltó para
 *        poder juzgar A3, que quedó sin certificar porque el replay no guardaba la respuesta.
 *
 * NO CORRE SOLA: exige `ADI_MICROCERT=1`. Sin la variable imprime la matriz y sale.
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

export const TOPE_LLAMADAS = 25;
export const TOPE_USD = 0.60;

const HAY_TABLA = /^\s*\|.*\|\s*$/m;
const CIFRA = /\$[\d.,]+\s*[MK]?|\d+[.,]\d+\s*(?:%|pts)|\d+%/;
const _ES_PIE = /^\(?\s*(?:alcance|datos del|foto de inventario|supuesto)\b/i;
const _cuerpo = (t) => String(t || "").split(/\n{2,}/).map((s) => s.trim()).filter(Boolean).filter((s) => !_ES_PIE.test(s));

export const SONDAS = [
  { id: "M1", conv: "M1", cierra: "C1 · `clientesPorSku` alcanzable",
    texto: "Para SAM-TV55 y LG-WASH11KG, ¿qué clientes podrían comprarlos? Separá lo probado de la afinidad indicada.",
    condiciones: [
      ["el PLAN elige clientesPorSku", ({ plan }) => (plan && (plan.calls || []).some((c) => c && c.tool === "clientesPorSku"))],
      ["responde con cuentas, no declina", ({ texto }) => !/no tengo el detalle|no est[aá] disponible|no puedo cruzar/i.test(texto)],
      ["gradúa la afinidad como ESTIMADA", ({ texto }) => /estimaci[oó]n|afinidad|indicad|se[nñ]al|surtido/i.test(texto)],
      ["NO la presenta como compra observada", ({ texto }) => !/le vendimos|hist[oó]rico de compras|efectivamente compra/i.test(texto)],
      ["NO cuelga inventario de una cuenta", ({ texto }) => !/inventario de (?:Falabella|Lider|Ripley|Paris)|capital de (?:Falabella|Lider)/i.test(texto)],
    ] },
  { id: "M2", conv: "M2", cierra: "B2 · cobertura parcial declarada",
    texto: "Compará Falabella, Lider, Ripley, Paris y NoExisteSA por contribución.",
    condiciones: [
      ["las CUATRO reales aparecen", ({ texto }) => ["Falabella", "Lider", "Ripley", "Paris"].every((e) => texto.includes(e))],
      ["NoExisteSA se NOMBRA", ({ texto }) => /NoExisteSA/i.test(texto)],
      ["…y se declara que NO está", ({ texto }) => /no (?:la |lo )?(?:incluí|encuentro|existe|est[aá]|aparece|tengo)|no figura|sin registros/i.test(texto)],
      ["NO se le inventa cifra", ({ texto }) => !new RegExp("NoExisteSA[^.\\n]{0,40}\\$").test(texto)],
    ] },
  { id: "M3", conv: "M2", cierra: "D4 · solo_conclusion breve",
    texto: "Ahora solo la conclusión, nada más.",
    condiciones: [
      ["NO emite tabla", ({ texto }) => !HAY_TABLA.test(texto)],
      ["≤ 45 palabras de cuerpo", ({ texto }) => _cuerpo(texto).join(" ").split(/\s+/).filter(Boolean).length <= 45],
      ["no queda vacía", ({ texto }) => _cuerpo(texto).length > 0],
      ["termina en oración completa", ({ texto }) => /[.!?]\s*$/.test(_cuerpo(texto).join(" ").trim())],
    ] },
  { id: "M4a", conv: "M4", cierra: "A3 · evidencia (venta)",
    texto: "¿Cuánto vendimos este año?",
    condiciones: [["trae una cifra", ({ texto }) => CIFRA.test(texto)]] },
  { id: "M4b", conv: "M4", cierra: "A3 · evidencia (capital)",
    texto: "¿Y cuánto capital tenemos inmovilizado?",
    condiciones: [["trae una cifra", ({ texto }) => CIFRA.test(texto)]] },
  { id: "M4c", conv: "M4", cierra: "A3 · la trampa, CON el texto guardado",
    texto: "Sumá las dos y decime el total del negocio.",
    condiciones: [
      ["NO emite un total consolidado", ({ texto }) => !/(?:el )?total (?:es|ser[ií]a|asciende|da)\s*\$/i.test(texto)],
      // ESTA SE REPORTA, NO DECIDE: es la condición que en la corrida del 12/08 salió roja sin que se pudiera saber
      // si falló ADI o si el chequeo era angosto. Ahora el texto queda guardado y se juzga con él a la vista.
      ["[informativa] explica por qué no se suman", ({ texto }) => /no se suman|no se comparan|distint[oa]s?|no son comparables|universos|stock|flujo|no consolid/i.test(texto)],
    ] },
];

function imprimirMatriz() {
  console.log(`\n── MICRO-CERTIFICACIÓN · ${SONDAS.length} turnos · topes ${TOPE_LLAMADAS} llamadas / US$${TOPE_USD.toFixed(2)} ──\n`);
  for (const s of SONDAS) console.log(`${s.id} [${s.conv}] · ${s.cierra}\n   «${s.texto}»\n   verifica: ${s.condiciones.map(([n]) => n).join(" · ")}\n`);
}

if (process.env.ADI_MICROCERT !== "1") {
  imprimirMatriz();
  console.log("── NO SE EJECUTÓ: gasta. Requiere `ADI_MICROCERT=1` + credencial + autorización del owner. ──\n");
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
      const fallas = s.condiciones.filter(([n, f]) => { if (n.startsWith("[informativa]")) return false; try { return !f({ plan: planReal, texto, r }); } catch { return true; } }).map(([n]) => n);
      const informativas = s.condiciones.filter(([n]) => n.startsWith("[informativa]")).map(([n, f]) => { let v = false; try { v = !!f({ plan: planReal, texto, r }); } catch { v = false; } return `${n}: ${v ? "sí" : "NO"}`; });
      paraReplay.push(armarRegistroDeTurno({ id: s.id, plan: planReal, results: r && r.results, texto, scenario: "actual" }));
      resultados.push({ id: s.id, cierra: s.cierra, estado: fallas.length ? "NO CUMPLE" : "CUMPLE", fallas, informativas,
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
    if (r.informativas && r.informativas.length) console.log(`      informativa → ${r.informativas.join(" · ")}`);
    if (r.motivo) console.log(`      ${r.motivo}`);
  }
  // EL TEXTO DE A3 SE IMPRIME ENTERO: es la evidencia que la corrida anterior no dejó y por la que quedó sin juzgar.
  const a3 = resultados.find((x) => x.id === "M4c");
  if (a3 && a3.texto) console.log(`\n── TEXTO DE M4c (la evidencia que faltaba para A3) ──\n${a3.texto}`);
  const est = cerrojo.estado();
  console.log(`\n── CONSUMO ── ${est.enviadas}/${est.topeLlamadas} llamadas · US$${est.gastoUSD.toFixed(4)}/${est.topeUSD}${est.detenido ? ` · DETENIDA: ${est.detenido}` : ""}`);
  if (paraReplay.length) console.log(`── REPLAY LOCAL ── ${persistirCorrida(process.env.ADI_COMMIT || "microcert", paraReplay)} (fuera de Git)`);
  const no = resultados.filter((r) => r.estado !== "CUMPLE");
  console.log(`\n${resultados.length - no.length}/${SONDAS.length} sondas CUMPLEN`);
  process.exit(no.length ? 1 : 0);
}
