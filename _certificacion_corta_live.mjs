/* === _certificacion_corta_live.mjs · CERTIFICACIÓN VIVA CORTA Y DIRIGIDA (owner 2026-08-12) ====================
 *
 * NO CORRE SOLA. Exige `ADI_CERT_CORTA=1` además de la credencial: este archivo GASTA. Sin la variable imprime la
 * matriz y sale — así el gate offline puede leerlo y contarlo sin riesgo de dispararlo.
 *
 * QUÉ MIDE, y en qué se diferencia de las corridas anteriores: no repite los 10 escenarios. Toma los SIETE frentes
 * que se cerraron entre el 11 y el 12 de agosto y los cubre con TRECE turnos en seis conversaciones cortas para saber si lo que se arregló offline se sostiene contra el proveedor real.
 *
 * ── LO QUE UNA CORRIDA PAGADA NO PUEDE MEDIR, y por eso se dice acá ────────────────────────────────────────────
 * El fallback ante un NARRAR que falla o desobedece NO se puede certificar esperando a que el proveedor se porte
 * mal: eso mide suerte, no producto. Un modelo que se porta bien las trece veces dejaría el riesgo sin tocar y el
 * informe diría «verde» sobre algo que nunca se ejercitó. Está certificado offline con narradores desobedientes
 * inyectados (`_fallback_por_forma_gate`, 48 aserciones). Acá se cubre la mitad que SÍ es viva y cuesta una sola
 * llamada: la sonda F1 pide el PLAN al gateway REAL y le inyecta una narración desobediente —tabla donde se pidió
 * prosa—, así que ejercita la recuperación sobre un plan de verdad sin pagar la narración.
 *
 * TOPES: los declara `TOPE_LLAMADAS` / `TOPE_USD` abajo, y el cerrojo corta ANTES de la llamada que los rompería.
 */
import { answerViaOracle } from "./src/adi/oracle/answerViaOracle.js";
import * as fsReal from "node:fs";
import { instalarTelemetria, telemetriaInstalada } from "./src/adi/llm/telemetrySink.js";
import { toolNames } from "./src/adi/oracle/toolRegistry.js";
import { estimateCostUSD } from "./src/adi/llm/modelPricing.js";
import { buildNarrateUserMessageC } from "./src/adi/oracle/narratePromptC.js";
import { crearCerrojo } from "./_certificacion_v12_live.mjs";
import { armarRegistroDeTurno, persistirCorrida } from "./scripts/replay-local.mjs";

/* ── LOS TOPES, dimensionados con el costo MEDIDO, no con uno esperado ──────────────────────────────────────────
 * La corrida de f4f2949: 25 turnos, 87 llamadas, US$1,9522 → 3,48 llamadas/turno y US$0,0781/turno.
 * Trece turnos a esa tasa: ~45 llamadas y ~US$1,02 (F1 paga sólo su PLAN, así que baja a ~43 y ~US$0,96). Se toma esa base y NO la mejora esperada por la política de
 * reintento económico (que debería bajarla bastante): dimensionar con la mejora que uno mismo escribió es
 * dimensionar con una ilusión. El margen que queda es para reintentos, no para otra corrida encubierta. */
export const TOPE_LLAMADAS = 50;
export const TOPE_USD = 1.20;

const HAY_TABLA = /^\s*\|.*\|\s*$/m;
const VOSEO = /\b(?:quer[eé]s|pod[eé]s|ten[eé]s|esper[aá]s|repon[eé]|corregí|liquidá|rotá|validá|priorizá|recalculá|sab[eé]s|ten[eé]lo|fijate)\b/i;
const CIFRA = /\$[\d.,]+\s*[MK]?|\d+[.,]\d+\s*(?:%|pts)|\d+%/;
const _cuerpo = (t) => String(t || "").split(/\n{2,}/).map((s) => s.trim()).filter(Boolean)
  .filter((s) => !/^\(?\s*(?:alcance|datos del|foto de inventario|supuesto)\b/i.test(s));

/* ── LA MATRIZ ─────────────────────────────────────────────────────────────────────────────────────────────────
 * `conv` agrupa turnos que comparten memoria: el contexto importa para la corrección y para «esos SKU».
 * `espera` son las tools que el plan DEBERÍA elegir — se reporta lo que eligió, se falla sólo si la condición
 * de conducta falla. Una tool distinta que responde bien no es un defecto; una condición roja sí.
 * `condiciones` reciben `{ plan, texto, r }` y devuelven true/false. */
export const SONDAS = [
  // ── A · UNIVERSOS Y CIFRA CANÓNICA ───────────────────────────────────────────────────────────────────────────
  { id: "A1", conv: "A", frente: "cifra canónica / escenario",
    texto: "¿Cuánto vendimos este año?",
    espera: ["salesRead", "queryMetric"],
    condiciones: [
      ["declara período o fecha de corte", ({ texto }) => /a[nñ]o|per[ií]odo|cierre|m[oó]vil|acumulad/i.test(texto)],
      ["trae una cifra autorizada", ({ texto }) => CIFRA.test(texto)],
      ["sin voseo", ({ texto }) => !VOSEO.test(texto)],
    ] },
  { id: "A2", conv: "A", frente: "universo inventario",
    texto: "¿Y cuánto capital tenemos inmovilizado?",
    espera: ["inventoryStatus", "queryMetric"],
    condiciones: [
      ["el marco es de STOCK, no de flujo anual", ({ texto }) => /a hoy|fecha de corte|foto|inmovilizad/i.test(texto)],
      ["trae una cifra autorizada", ({ texto }) => CIFRA.test(texto)],
      ["sin voseo", ({ texto }) => !VOSEO.test(texto)],
    ] },
  { id: "A3", conv: "A", frente: "NO cruzar universos · la trampa directa",
    texto: "Sumá las dos y decime el total del negocio.",
    espera: ["(ninguna: debe declinar la consolidación)"],
    condiciones: [
      ["NO emite un total consolidado", ({ texto }) => !/(?:el )?total (?:es|ser[ií]a|asciende|da)\s*\$/i.test(texto)],
      ["explica por qué no se suman", ({ texto }) => /no se suman|distint[oa]s?|no son comparables|una cosa es|stock|flujo|no consolid/i.test(texto)],
      ["sin voseo", ({ texto }) => !VOSEO.test(texto)],
    ] },

  // ── B · MULTI-ENTIDAD CON COBERTURA DECLARADA ────────────────────────────────────────────────────────────────
  { id: "B1", conv: "B", frente: "multi-entidad (>2)",
    texto: "Compará Falabella, Lider, Ripley y Paris por contribución.",
    espera: ["compareEntities→gridTable (descomposición)"],
    condiciones: [
      ["las CUATRO cuentas aparecen", ({ texto }) => ["Falabella", "Lider", "Ripley", "Paris"].every((e) => texto.includes(e))],
      ["no declina por cardinalidad", ({ texto }) => !/de a (?:dos|pares)|solo puedo comparar dos|no tengo (?:sus )?registros/i.test(texto)],
      ["trae cifras", ({ texto }) => CIFRA.test(texto)],
    ] },
  { id: "B2", conv: "B", frente: "cobertura PARCIAL declarada",
    texto: "Agregá NoExisteSA a esa comparación.",
    espera: ["compareEntities→gridTable + cobertura"],
    condiciones: [
      ["declara que NoExisteSA no está", ({ texto }) => /NoExisteSA/i.test(texto) && /no (?:la |lo )?(?:encuentro|existe|est[aá]|aparece|tengo)|no figura|sin registros/i.test(texto)],
      ["NO le inventa cifras", ({ texto }) => !new RegExp("NoExisteSA[^.\\n]{0,40}\\$").test(texto)],
      ["las que sí están siguen respondidas", ({ texto }) => ["Falabella", "Lider", "Ripley"].every((e) => texto.includes(e))],
    ] },

  // ── C · AFINIDAD CLIENTE×SKU COMO `INDICADO` ─────────────────────────────────────────────────────────────────
  { id: "C1", conv: "C", frente: "afinidad `indicado`, no observada",
    texto: "Para SAM-TV55 y LG-WASH11KG, ¿qué clientes podrían comprarlos? Separá lo probado de la afinidad indicada.",
    espera: ["clientesPorSku"],
    condiciones: [
      ["responde con cuentas, no declina", ({ texto }) => !/no tengo el detalle|no est[aá] disponible|no puedo cruzar/i.test(texto)],
      ["gradúa: la afinidad se declara ESTIMADA", ({ texto }) => /estimaci[oó]n|afinidad|indicad|se[nñ]al|surtido/i.test(texto)],
      ["NO la presenta como compra observada", ({ texto }) => !/compr[oó]|le vendimos|hist[oó]rico de compras|efectivamente compra/i.test(texto)],
      ["NO cuelga inventario de una cuenta", ({ texto }) => !/inventario de (?:Falabella|Lider|Ripley|Paris)|capital de (?:Falabella|Lider)/i.test(texto)],
    ] },

  // ── D · LAS CUATRO FORMAS ────────────────────────────────────────────────────────────────────────────────────
  { id: "D1", conv: "D", frente: "forma: PROSA con los tres estatus",
    texto: "¿Cómo viene Falabella? Separá lo probado de lo indicado, en prosa.",
    espera: ["entityRecord", "entityProfile"],
    condiciones: [
      ["NO emite tabla", ({ texto }) => !HAY_TABLA.test(texto)],
      ["separa lo probado de lo indicado", ({ texto }) => /probad|demuestra|confirma/i.test(texto) && /indicad|se[nñ]al|sugiere|apunta/i.test(texto)],
      ["tiene cuerpo, no sólo el pie", ({ texto }) => _cuerpo(texto).length > 0 && CIFRA.test(_cuerpo(texto).join(" "))],
      ["sin voseo", ({ texto }) => !VOSEO.test(texto)],
    ] },
  { id: "D2", conv: "D", frente: "forma: TABLA + lectura mínima",
    texto: "Mostrame el margen de los 5 principales clientes en una tabla.",
    espera: ["gridTable", "marginRead"],
    condiciones: [
      ["emite una TABLA real", ({ texto }) => HAY_TABLA.test(texto)],
      ["no es una lista numerada", ({ texto }) => !/^\s*\d+[.)]\s+/m.test(texto)],
      ["la acompaña alguna lectura", ({ texto }) => texto.split("\n").filter((l) => !/^\s*\|/.test(l) && l.trim()).length > 0],
    ] },
  { id: "D3", conv: "D", frente: "forma: SOLO LA CIFRA",
    texto: "Solo el margen de Lider, nada más.",
    espera: ["entityRecord", "queryMetric"],
    condiciones: [
      ["NO emite tabla", ({ texto }) => !HAY_TABLA.test(texto)],
      ["es breve", ({ texto }) => _cuerpo(texto).join(" ").length < 220],
      ["trae la cifra y la entidad", ({ texto }) => CIFRA.test(texto) && /Lider/i.test(texto)],
    ] },
  { id: "D4", conv: "D", frente: "forma: SOLO LA CONCLUSIÓN",
    texto: "Ahora solo la conclusión, nada más.",
    espera: ["(reusa el turno anterior)"],
    condiciones: [
      ["NO emite tabla", ({ texto }) => !HAY_TABLA.test(texto)],
      ["una sola idea, breve", ({ texto }) => _cuerpo(texto).join(" ").length < 200],
    ] },

  // ── E · CORRECCIÓN CONTEXTUAL ────────────────────────────────────────────────────────────────────────────────
  { id: "E1", conv: "E", frente: "contexto previo",
    texto: "¿Cómo viene Samsung?",
    espera: ["entityRecord", "entityProfile"],
    condiciones: [["responde sobre Samsung", ({ texto }) => /Samsung/i.test(texto)]] },
  { id: "E2", conv: "E", frente: "corrección resuelta, no ambigua",
    texto: "No, me refería a LG, no a Samsung.",
    espera: ["entityRecord (entidad corregida)"],
    condiciones: [
      ["cambia a LG", ({ texto }) => /\bLG\b/.test(texto)],
      ["NO vuelve a preguntar qué quiso decir", ({ texto }) => !/¿(?:a )?cu[aá]l|¿te refer[ií]s|¿qu[eé] quer[eé]s decir|aclarame/i.test(texto)],
      ["trae cifras de LG", ({ texto }) => CIFRA.test(texto)],
      ["sin voseo", ({ texto }) => !VOSEO.test(texto)],
    ] },

  // ── F · FALLBACK SOBRE UN PLAN REAL (1 llamada: PLAN sí, NARRAR no) ──────────────────────────────────────────
  { id: "F1", conv: "F", frente: "fallback ante NARRAR desobediente",
    texto: "¿Cómo viene Falabella? Separá lo probado de lo indicado, en prosa.",
    espera: ["PLAN real del gateway · NARRAR inyectado desobediente (no se paga)"],
    narradorDesobediente: () => "[[DATOS]]\n| Concepto | Valor |\n|---|---|\n| Falabella · Contribución | $99.9M |",
    condiciones: [
      ["el turno igual produce respuesta", ({ texto }) => texto.length > 0],
      ["con la forma PEDIDA (prosa), no la que el narrador quiso", ({ texto }) => !HAY_TABLA.test(texto)],
      ["con CUERPO, no sólo el pie declarativo", ({ texto }) => _cuerpo(texto).length > 0],
      ["sin la cifra inventada", ({ texto }) => !/99[.,]9\s*M/i.test(texto)],
    ] },
];

/* ── LA MATRIZ SE IMPRIME SIEMPRE, GASTE O NO ─────────────────────────────────────────────────────────────────── */
function imprimirMatriz() {
  console.log(`\n── CERTIFICACIÓN CORTA · ${SONDAS.length} turnos en ${new Set(SONDAS.map((s) => s.conv)).size} conversaciones ──`);
  console.log(`── TOPES · ${TOPE_LLAMADAS} llamadas pagadas · US$${TOPE_USD.toFixed(2)} · el cerrojo corta ANTES de romperlos ──\n`);
  for (const s of SONDAS) {
    console.log(`${s.id} [${s.conv}] · ${s.frente}`);
    console.log(`   «${s.texto}»`);
    console.log(`   espera: ${s.espera.join(" | ")}`);
    console.log(`   verifica: ${s.condiciones.map(([n]) => n).join(" · ")}\n`);
  }
}

if (process.env.ADI_CERT_CORTA !== "1") {
  imprimirMatriz();
  console.log("── NO SE EJECUTÓ: esta certificación GASTA. Para correrla hace falta `ADI_CERT_CORTA=1` + credencial,");
  console.log("   y autorización explícita del owner nombrando llamadas y tope en US$. ──\n");
  process.exit(0);
}

/* ── LA CORRIDA (sólo con la variable puesta) ─────────────────────────────────────────────────────────────────── */
{
  imprimirMatriz();
  const RUTA_TELEMETRIA = process.env.ADI_TELEMETRY_FILE || null;
  // LA FIRMA ES { ruta, tools, fs } — el sink falla CERRADO a propósito: sin destino escribible no se instala, y
  // sin telemetría instalada esta corrida se aborta antes de gastar un centavo. Es lo que hizo en el primer
  // disparo (0 llamadas, US$0,00) cuando el nombre del parámetro estaba mal.
  if (RUTA_TELEMETRIA) instalarTelemetria({ ruta: RUTA_TELEMETRIA, tools: toolNames(), fs: fsReal });
  if (RUTA_TELEMETRIA && !telemetriaInstalada()) { console.error("telemetría pedida y no instalada — se aborta antes de gastar"); process.exit(1); }

  const { handlePlan, handleNarrateC } = await import("./src/adi/llm/gatewayCore.js");
  const cerrojo = crearCerrojo({ topeLlamadas: TOPE_LLAMADAS, topeUSD: TOPE_USD });
  const memoria = new Map();          // una memoria por conversación
  const resultados = [], paraReplay = [];
  let cortada = null;

  for (const s of SONDAS) {
    if (cortada) { resultados.push({ id: s.id, estado: "NO CORRIDA", motivo: cortada }); continue; }
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
        // LA SONDA F1 NO PAGA NARRACIÓN: se le inyecta la desobediencia. Las demás van al gateway real.
        callNarrate: s.narradorDesobediente
          ? async () => s.narradorDesobediente()
          : async (args) => {
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
      // PENDIENTE MEDIDO EN LA CORRIDA DEL 12/08: `call.args` se persistió bien -era el hueco de f4f2949- pero
      // `results` llegó VACÍO en los 13 turnos, y el TEXTO no se guarda. Sin ellos, dos de los cuatro rojos no se
      // pudieron diagnosticar desde el replay y hubo que reproducirlos offline. Antes de la próxima corrida hay
      // que averiguar bajo qué nombre expone `answerViaOracle` los resultados del ejecutor y sumar la narración.
      paraReplay.push(armarRegistroDeTurno({ id: s.id, plan: planReal, results: r && r.results, scenario: "actual" }));
      resultados.push({ id: s.id, frente: s.frente, estado: fallas.length ? "NO CUMPLE" : "CUMPLE", fallas,
        tools: (planReal && (planReal.calls || []).map((c) => c && c.tool).filter(Boolean)) || [], largo: texto.length });
    } catch (e) {
      const esCerrojo = /cerrojo|tope/i.test(String(e && e.message));
      if (esCerrojo) cortada = String(e.message);
      resultados.push({ id: s.id, frente: s.frente, estado: esCerrojo ? "CORTADA POR EL CERROJO" : "ERROR", motivo: String(e && e.message) });
    }
  }

  console.log("\n── RESULTADO ──");
  for (const r of resultados) console.log(`  ${r.id} · ${r.estado} · ${r.frente || ""}${r.tools ? ` · tools: ${r.tools.join(",") || "—"}` : ""}${r.fallas && r.fallas.length ? `\n      falló: ${r.fallas.join(" · ")}` : ""}${r.motivo ? ` — ${r.motivo}` : ""}`);
  const est = cerrojo.estado();
  console.log(`\n── CONSUMO ── ${est.enviadas}/${est.topeLlamadas} llamadas · US$${est.gastoUSD.toFixed(4)}/${est.topeUSD}${est.detenido ? ` · DETENIDA: ${est.detenido}` : ""}`);
  if (paraReplay.length) console.log(`── REPLAY LOCAL ── ${persistirCorrida(process.env.ADI_COMMIT || "cert-corta", paraReplay)} (fuera de Git)`);
  const no = resultados.filter((r) => r.estado !== "CUMPLE");
  console.log(`\n${resultados.length - no.length}/${SONDAS.length} sondas CUMPLEN`);
  process.exit(no.length ? 1 : 0);
}
