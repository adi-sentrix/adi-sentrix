/* === _certificacion_v12_live.mjs · CERTIFICACIÓN PAGADA DEL CONTRATO v1.2 · §9 =================================
 *
 * ⚠️ ESTE ARCHIVO GASTA DINERO REAL. No corre en ninguna suite: su nombre NO termina en `_gate.mjs`, así que ni
 * `gates:offline` ni `run-gates` lo levantan. Se ejecuta a mano, UNA sola vez, con autorización explícita del
 * owner que nombre el gasto y el tope. El cerrojo de abajo es una segunda red, no un permiso.
 *
 * QUÉ MIDE, y por qué no se puede offline: si el PLANIFICADOR REAL emite el objeto `reparacion` bien —la clase de
 * turno, qué campo se corrigió, y una pregunta de precisión adaptada al contexto—. Todo lo demás del contrato ya
 * está probado sin gastar (92 gates offline). Acá se paga por UNA cosa: la comprensión.
 *
 * EL CONTEXTO PREVIO NO SE PAGA. Cada sonda necesita un turno anterior que corregir; ese turno se SIEMBRA
 * determinísticamente en el estado canónico —el mismo shape que deja un turno real— en vez de gastar dos llamadas
 * en producirlo. Sin eso, 6 sondas costarían 24 llamadas en vez de 12.
 *
 * ── EL CERROJO (§9: "6 sondas · 12 llamadas esperadas · 15 como máximo absoluto") ──────────────────────────────
 * Dos topes, los dos DUROS y los dos evaluados ANTES de enviar:
 *   · CONTEO  · la llamada 16 no se envía. Se lanza antes del fetch, no después.
 *   · DINERO  · si el costo acumulado + el costo estimado de la próxima llamada supera el tope, no se envía.
 * Si cualquiera corta: se detiene la corrida entera, se conserva la evidencia de lo ya corrido y se reporta qué
 * quedó sin cubrir. NUNCA se sube el tope, NUNCA se recorta la cobertura en silencio para que entre.
 */
import { readFileSync, existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import * as fsReal from "node:fs";
import { answerViaOracle } from "./src/adi/oracle/answerViaOracle.js";
import { instalarTelemetria, telemetriaInstalada } from "./src/adi/llm/telemetrySink.js";
import { toolNames } from "./src/adi/oracle/toolRegistry.js";
import { estimateCostUSD } from "./src/adi/llm/modelPricing.js";
import { buildNarrateUserMessageC } from "./src/adi/oracle/narratePromptC.js";

export const TOPE_LLAMADAS = 15;
export const TOPE_USD = 0.40;
export const SONDAS_ESPERADAS = 6;
export const LLAMADAS_ESPERADAS = 12;

/* ── crearCerrojo({ topeLlamadas, topeUSD, costoEstimadoPorLlamada }) ──────────────────────────────────────────
 * Devuelve { guardar, registrar, estado }. `guardar()` se invoca ANTES de cada envío y LANZA si el envío
 * rompería alguno de los dos topes — de ahí que la llamada 16 no llegue a salir. `registrar()` suma el costo
 * REAL informado por el gateway cuando la llamada volvió. Exportado para que el gate lo certifique sin gastar.
 */
// `costoEstimadoPorLlamada` = el PEOR caso por llamada, no el promedio: una narración en el tier 3 del router
// (~12k de entrada + 600 de salida a US$5/US$30 por millón) cuesta ~US$0,078. Proyectar con el promedio dejaría
// pasar la llamada que rompe el tope y recién ahí cortaría — o sea, cortaría DESPUÉS de pagarla. Con el peor caso,
// una corrida barata (todas en el modelo base) nunca se topa, y una cara se detiene antes de excederse.
export function crearCerrojo({ topeLlamadas = TOPE_LLAMADAS, topeUSD = TOPE_USD, costoEstimadoPorLlamada = 0.08 } = {}) {
  let enviadas = 0, gastoUSD = 0, detenido = null;
  const guardar = (etiqueta = "") => {
    if (detenido) throw new Error(`cerrojo: la corrida ya se detuvo (${detenido})`);
    if (enviadas + 1 > topeLlamadas) {
      detenido = `tope de llamadas alcanzado (${topeLlamadas})`;
      throw new Error(`CERROJO · llamada ${enviadas + 1} NO enviada${etiqueta ? ` (${etiqueta})` : ""}: el tope absoluto es ${topeLlamadas}`);
    }
    if (gastoUSD + costoEstimadoPorLlamada > topeUSD) {
      detenido = `tope monetario alcanzado (US$${topeUSD})`;
      throw new Error(`CERROJO · llamada ${enviadas + 1} NO enviada${etiqueta ? ` (${etiqueta})` : ""}: US$${gastoUSD.toFixed(4)} + estimado excede el tope de US$${topeUSD}`);
    }
    enviadas++;
    return enviadas;
  };
  const registrar = (usd) => { if (Number.isFinite(usd)) gastoUSD += usd; };
  const estado = () => ({ enviadas, gastoUSD, detenido, topeLlamadas, topeUSD });
  return { guardar, registrar, estado };
}

/* ── LAS 6 SONDAS · una por conducta que sólo el proveedor real puede demostrar ───────────────────────────────
 * `mem` se siembra con el estado que dejaría el turno anterior — mismo shape que produce updateConversationScope.
 * `espera` describe qué tiene que traer el PLAN real para que la sonda cuente como cumplida.
 */
const scopeSembrado = ({ entities, dimension = "cliente", metrica = "margen", periodo = "año cerrado", oferta = true, supuestos = [] }) => ({
  conversationScope: {
    version: 1,
    current: {
      turno: 2, dimension, entities, selection: { orden: "por margen, ascendente", subset: { kind: "top", n: entities.length } },
      periodo, filtros: entities.length === 1 ? { [dimension]: entities[0] } : null, metrica,
      operacion: "answer", modo: "default", tool: "marginRead",
      origen: { callId: "c1", boletaLabels: [`${entities[0]} · Margen`, `${entities[0]} · Venta`] },
      supuestos, faltantes: [],
      ofertaPendiente: oferta ? { texto: `¿Querés que profundice en el rebate de ${entities[0]}?`, entidad: entities[0], tool: "entityRecord", args: { dimension, entity: entities[0] }, turno: 2 } : null,
      tenant: null,
    },
    history: [],
    recentSubjects: [{ entidad: entities[0], dimension, turno: 2, mode: "default", intent: "answer", tool: "marginRead" }],
  },
});

export const SONDAS = [
  {
    id: "S1", titulo: "corrección de ENTIDAD, resuelta",
    contexto: "el turno anterior habló del margen de Falabella",
    texto: "no, era Lider",
    mem: () => scopeSembrado({ entities: ["Falabella"] }),
    espera: (plan) => plan.intent === "redirect" && plan.reparacion && plan.reparacion.tipo === "correccion"
      && (plan.reparacion.corrige || []).includes("entidad") && !plan.reparacion.ambigua
      && Array.isArray(plan.calls) && plan.calls.length > 0,
    porQue: "§3 · identifica qué cambió, no deja calls vacío y no se declara ambigua",
  },
  {
    id: "S2", titulo: "corrección AMBIGUA",
    contexto: "el turno anterior mostró el margen de Falabella contra el benchmark",
    texto: "ese número no me cuadra",
    mem: () => scopeSembrado({ entities: ["Falabella"] }),
    espera: (plan) => plan.intent === "redirect" && plan.reparacion && plan.reparacion.ambigua === true
      && !(plan.calls || []).length && typeof plan.reparacion.pregunta === "string"
      && (plan.reparacion.pregunta.match(/\?/g) || []).length === 1,
    porQue: "§4 · UNA sola pregunta, sin calls, sin recalcular",
    sinNarrar: true,   // esta sonda corta antes de NARRAR por diseño del contrato: cuesta 1 llamada, no 2
  },
  {
    id: "S3", titulo: "DESACUERDO (no es corrección)",
    contexto: "el turno anterior atribuyó el margen bajo a las acciones comerciales",
    texto: "no creo que sea por los rebates",
    mem: () => scopeSembrado({ entities: ["Falabella"] }),
    espera: (plan) => plan.reparacion && plan.reparacion.tipo === "desacuerdo"
      && !(plan.reparacion.corrige || []).length && Array.isArray(plan.calls) && plan.calls.length > 0,
    porQue: "§5 · discute la interpretación, no el alcance: conserva y vuelve a pedir la evidencia",
  },
  {
    id: "S4", titulo: "DATO APORTADO por el usuario",
    contexto: "el turno anterior dio la venta de Falabella",
    texto: "las ventas de Falabella fueron $20M",
    mem: () => scopeSembrado({ entities: ["Falabella"], metrica: "ventas" }),
    espera: (plan) => plan.reparacion && plan.reparacion.tipo === "dato_usuario"
      && plan.reparacion.dato && /20/.test(String(plan.reparacion.dato.valor || ""))
      && Array.isArray(plan.calls) && plan.calls.length > 0,
    porQue: "§5 · declara la cifra del usuario y pide la oficial para mostrar la discrepancia",
  },
  {
    id: "S5", titulo: "corrección de MÉTRICA",
    contexto: "el turno anterior dio el margen de Falabella",
    texto: "te pedí las ventas, no el margen",
    mem: () => scopeSembrado({ entities: ["Falabella"] }),
    espera: (plan) => plan.reparacion && plan.reparacion.tipo === "correccion"
      && (plan.reparacion.corrige || []).includes("metrica")
      && !(plan.reparacion.corrige || []).includes("entidad"),
    porQue: "§1 · se modifica ÚNICAMENTE lo corregido: la entidad no entra en `corrige`",
  },
  {
    id: "S6", titulo: "corrección de ALCANCE",
    contexto: "el turno anterior habló sólo de Falabella",
    texto: "te pedí del negocio, no de una cuenta",
    mem: () => scopeSembrado({ entities: ["Falabella"] }),
    espera: (plan) => plan.reparacion && plan.reparacion.tipo === "correccion"
      && (plan.reparacion.corrige || []).some((c) => c === "alcance" || c === "entidad")
      && plan.scope && plan.scope.level === "global"
      && !(plan.calls || []).some((c) => c && c.args && c.args.filters && Object.keys(c.args.filters).length),
    porQue: "§1 · alcance global, SIN filtro heredado de la entidad anterior",
  },
];

/* ── main ─────────────────────────────────────────────────────────────────────────────────────────────────────
 * Se ejecuta SOLO con --ejecutar Y con ADI_CERTIFICACION_AUTORIZADA=si. Sin las dos, imprime el plan de la corrida
 * y sale: importar o correr este archivo por accidente no puede gastar un peso.
 */
// TRES condiciones, y la primera es que este archivo sea el ENTRYPOINT: importarlo (el gate del cerrojo lo hace,
// para certificar la función sin gastar) no puede disparar nada, ni siquiera el resumen que termina en exit(0).
const _esEntrypoint = import.meta.url === pathToFileURL(process.argv[1] || "").href;
const _ejecutar = _esEntrypoint && process.argv.includes("--ejecutar") && process.env.ADI_CERTIFICACION_AUTORIZADA === "si";
const RUTA_TELEMETRIA = process.env.ADI_TELEMETRY_FILE || null;

if (_esEntrypoint && !_ejecutar) {
  console.log("── CERTIFICACIÓN v1.2 · PLAN DE LA CORRIDA (no se ejecutó nada) ──");
  console.log(`  sondas: ${SONDAS.length} · llamadas esperadas: ${LLAMADAS_ESPERADAS} · tope absoluto: ${TOPE_LLAMADAS} · tope monetario: US$${TOPE_USD}`);
  for (const s of SONDAS) console.log(`  ${s.id} · ${s.titulo} — «${s.texto}» · ${s.porQue}${s.sinNarrar ? " · (1 llamada)" : ""}`);
  console.log(`  telemetría: ${RUTA_TELEMETRIA || "SIN DESTINO — no se puede certificar sin él"}`);
  console.log("  para ejecutar: ADI_CERTIFICACION_AUTORIZADA=si node _certificacion_v12_live.mjs --ejecutar");
  process.exit(0);
}

// IMPORTADO, NO EJECUTADO: se sale del módulo sin tocar nada. `process.exit` acá mataría al gate que lo importa
// para certificar el cerrojo — y lo mataría con código 0, o sea con un verde que nadie escribió.
const _corre = _ejecutar;

if (_corre) {
  // PRECONDICIÓN DURA (§9): sin destino de telemetría no se gasta. Gastar sin registro es el error que originó todo.
  const telem = instalarTelemetria({ ruta: RUTA_TELEMETRIA, tools: toolNames(), fs: fsReal });
  if (!telem.instalado || !telemetriaInstalada()) {
    console.error(`✗ ABORTADO · la telemetría no quedó instalada: ${telem.motivo}`);
    console.error("  §9 exige un destino real ANTES de gastar. No se envió ninguna llamada.");
    process.exit(3);
  }
  console.log(`── CERTIFICACIÓN v1.2 · telemetría → ${RUTA_TELEMETRIA}`);

  const cerrojo = crearCerrojo({});
  const { handlePlan, handleNarrateC } = await import("./src/adi/llm/gatewayCore.js");
  const resultados = [];
  let cortada = null;

  for (const sonda of SONDAS) {
    if (cortada) { resultados.push({ ...sonda, estado: "NO CORRIDA", motivo: cortada }); continue; }
    let planReal = null;
    try {
      const r = await answerViaOracle({
        text: sonda.texto, history: [{ role: "user", text: sonda.contexto }], mem: sonda.mem(), scenario: "actual",
        callPlan: async (args) => {
          cerrojo.guardar(`${sonda.id}/plan`);
          const t0 = Date.now();
          const res = await handlePlan({ ...args, access: process.env.ADI_ACCESS_CODE }, process.env);
          cerrojo.registrar(estimateCostUSD(res && res.modelUsed, res && res.usage) || 0);
          if (!res || !res.ok) throw new Error((res && res.error) || "gateway sin plan");
          planReal = res.plan;
          console.log(`  ${sonda.id} · PLAN ${res.modelo || res.modelUsed} · ${Date.now() - t0}ms · in=${(res.usage && (res.usage.prompt_tokens ?? res.usage.input_tokens)) || "?"} out=${(res.usage && (res.usage.completion_tokens ?? res.usage.output_tokens)) || "?"}`);
          return res.plan;
        },
        callNarrate: async (args) => {
          cerrojo.guardar(`${sonda.id}/narrar`);
          const t0 = Date.now();
          // el payload se ARMA acá, igual que en el cliente real (ChatADI.js:_fetchNarrateC): answerViaOracle le
          // pasa a callNarrate las decisiones del motor, no el payload — mandárselas crudas al gateway le daría al
          // narrador otro prompt del que corre en producción, y la certificación mediría otra cosa.
          const payload = buildNarrateUserMessageC(args);
          const res = await handleNarrateC({ payload, mem: args.mem, access: process.env.ADI_ACCESS_CODE, attempt: args.attempt }, process.env);
          cerrojo.registrar(estimateCostUSD(res && res.modelUsed, res && res.usage) || 0);
          if (!res || !res.ok) throw new Error((res && res.error) || "gateway sin narración");
          console.log(`  ${sonda.id} · NARRAR ${res.modelo || res.modelUsed} · ${Date.now() - t0}ms`);
          return res.narration;
        },
      });
      const cumple = planReal ? !!sonda.espera(planReal) : false;
      resultados.push({ id: sonda.id, titulo: sonda.titulo, estado: cumple ? "CUMPLE" : "NO CUMPLE", plan: planReal, retryTrace: r && r.r && r.r.retryTrace, texto: r && r.r && r.r.text });
      // UNA SONDA QUE NO CUMPLE DETIENE LA CORRIDA (owner, autorización 2026-08-10). No es lo mismo que un tope:
      // acá el producto respondió y respondió mal, así que seguir gastando en las sondas siguientes es pagar por
      // confirmar un defecto que ya está confirmado. Se conserva lo corrido y se declara lo que quedó sin cubrir.
      if (!cumple) cortada = `la sonda ${sonda.id} no cumplió — la corrida se detiene sin reintentar`;
    } catch (e) {
      const esCerrojo = /^CERROJO/.test(String(e && e.message));
      if (esCerrojo) cortada = String(e.message);
      resultados.push({ id: sonda.id, titulo: sonda.titulo, estado: esCerrojo ? "CORTADA POR EL CERROJO" : "ERROR", motivo: String(e && e.message) });
    }
  }

  console.log("\n── RESULTADO POR SONDA ──");
  for (const r of resultados) console.log(`  ${r.id} · ${r.estado} · ${r.titulo}${r.motivo ? ` — ${r.motivo}` : ""}`);
  const est = cerrojo.estado();
  console.log(`\n── CONSUMO ── llamadas enviadas: ${est.enviadas}/${est.topeLlamadas} · costo estimado: US$${est.gastoUSD.toFixed(4)}/${est.topeUSD}${est.detenido ? ` · DETENIDA: ${est.detenido}` : ""}`);
  if (existsSync(RUTA_TELEMETRIA)) {
    const lineas = readFileSync(RUTA_TELEMETRIA, "utf8").trim().split("\n").filter(Boolean);
    console.log(`── TELEMETRÍA ── ${lineas.length} eventos en ${RUTA_TELEMETRIA}`);
  }
  const noCumplen = resultados.filter((r) => r.estado !== "CUMPLE");
  console.log(`\n${resultados.length - noCumplen.length}/${SONDAS.length} sondas CUMPLEN`);
  process.exit(noCumplen.length ? 1 : 0);
}
