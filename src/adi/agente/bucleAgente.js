/* === src/adi/agente/bucleAgente.js · EL BUCLE DEL AGENTE (F2 · owner 2026-08-30: «esta vez quiero ADI agente»)
 *
 * LA FORMA (F1, aprobado): un solo cerebro · el hilo entero · la caja completa con contrato · bucle corto ·
 * la boleta se ACUMULA de lo que las herramientas devuelven · guardC sella al final.
 *
 *   [RONDA 1..3]  el cerebro ve mapa + hilo + boleta acumulada y decide: pedir herramientas o responder.
 *                 Las herramientas las ejecuta EL MOTOR (runPlan con la caja extendida — client-side, puro).
 *   [CIERRE]      si agotó las rondas sin responder, una última llamada SIN herramientas («cierra ahora»).
 *   [MURO]        guardC con la boleta acumulada + las fuentes de siempre · veto → UNA reparación con multa.
 *   [ESCALERA]    INVERTIDA (owner): 1· la línea honesta del límite con la cifra más cercana VERIFICADA ·
 *                 2· el respaldo de lo ya aprobado en el hilo · 3· el genérico pelado. El tablero de KPIs
 *                 dejó de ser primer recurso: queda para cuando el usuario lo pida (herramienta executiveSummary).
 *
 * LOS TOPES SON DEL CLIENTE, no promesas del prompt: 3 rondas de herramientas + 1 cierre = máx. 4 llamadas;
 * 8 calls por ronda (el cap de runPlan) y 12 por turno; una herramienta desconocida recibe UNA corrección de
 * contrato y a la segunda quema la ronda. Jamás un reintento infinito.
 *
 * EL CEREBRO SE INYECTA (`callAgente`) — ChatADI pondrá el fetch real cuando el adapter hable el modo libre;
 * los gates ponen GUIONES, incluidos los maliciosos. Contrato de `callAgente({ mensajes, mapa, herramientas,
 * ronda, attempt, motivoReintento })` → Promise<{ tipo:"herramientas", pedidos:[{tool,args}] } |
 * { tipo:"texto", texto }>. Este módulo no conoce el cable (tool_use nativo vs texto): eso es del adapter.
 *
 * PURO · sin red · detrás de la bandera ADI_AGENTE (hoy APAGADA en todos los perfiles). */
import { runPlan } from "../oracle/toolRunner.js";
import { TOOLS } from "../oracle/toolRegistry.js";
import { cajaDelAgente } from "./herramientasAgente.js";
import { doctrinasParaRonda } from "./doctrinaAgente.js";
import { mapaDelDato } from "./mapaDelDato.js";
import { guardC, esNarracionVacia } from "../oracle/guardC.js";
import { cifrasDelDato } from "../oracle/datoProyectado.js";
import { axisEntityNames } from "../oracle/entityIndex.js";
import { parseFigures } from "../boleta.js";
import { stripLanguageLeaks } from "../llm/voiceGuard.js";
import { getSelloDeCarga } from "../../ingesta/estadoCarga.js";
import { anteponerSello } from "../../ingesta/selloEnRespuesta.js";
import { extraerCalculos, stripAllMarks, composeNoDataMessage } from "../oracle/narrationBlocks.js";
import { normalizeResponse } from "../responseContract.js";
import { _respaldoDeLoYaAprobado } from "../oracle/caminoNatural.js";
import { ESCENARIO_INICIAL } from "../../config/scenarios.js";   // colapso del eje: el agente lee el MISMO dato que la pantalla
import { vetosDeContrato } from "./contratoAgente.js";   // F3 · el juez ciego de sugerencias — se SUMA a guardC, no lo toca

const TOPE_RONDAS = 3;      // rondas que pueden pedir herramientas
const TOPE_CALLS = 12;      // tool-calls por turno, sumadas todas las rondas
const CALLS_POR_RONDA = 8;  // el cap vigente de runPlan

const _MENSAJE_NOTARIO = (multa) => `[NOTARIO — no es el usuario] Tu respuesta no pasó la verificación:\n${multa}\nReescribe tu respuesta COMPLETA corrigiendo solo lo observado, manteniendo tu calidad de asesor. No menciones esta corrección.`;

const _ejes = (lista) => {
  const o = [];
  for (const e of lista) { try { for (const n of axisEntityNames(e)) o.push(n); } catch { /* eje sin índice */ } }
  return o.length ? o : null;
};

/** el resumen de una ronda de herramientas, para el cerebro — datos crudos, no prosa. */
function _resumenDeRonda(rp) {
  return rp.results.map((r) => ({
    tool: r.tool,
    ok: !(r.coverage && r.coverage.supported === false),
    ...(r.coverage && r.coverage.supported === false ? { motivo: r.coverage.reason } : {}),
    facts: r.facts,
    cifras: (r.boleta || []).map((f) => ({ label: f.label, valor: f.text || f.value })),
  }));
}

/* ── LA ESCALERA INVERTIDA · peldaño 1: la línea honesta con la cifra más cercana VERIFICADA ─────────────────── */
function _lineaHonesta({ motivos, figs, juzgar }) {
  const motivo = motivos.length ? motivos[motivos.length - 1] : null;
  /* «la cifra más cercana» sale de la BOLETA ACUMULADA — verificada por el muro antes de adoptarse, nunca
   * compuesta libre (F1 §9.3). Primero una obligatoria; si no hay, la primera con dueño.
   * ⚠️ JAMÁS UN SUPUESTO DEL USUARIO: la frase dice «lo que sí tengo verificado», y una cifra que el usuario
   * ofreció es exactamente lo contrario — citarla acá la blanquearía como dato. */
  const verificadas = figs.filter((f) => f.source !== "user_supuesto");
  const fig = verificadas.find((f) => f.mandatory) || verificadas.find((f) => f.label && (f.text || f.value)) || null;
  /* sin un LÍMITE que nombrar ni una cifra que ofrecer, este peldaño no tiene nada honesto que decir: cede al
   * siguiente (el respaldo de lo ya aprobado), que sí tiene contenido de verdad. Una línea genérica acá taparía
   * al peldaño con sustancia. */
  if (!motivo && !fig) return null;
  const partes = [
    motivo ? `No pude completar la lectura que pediste: ${motivo}.` : "No pude completar la lectura que pediste con la calidad que corresponde.",
    fig ? `Lo que sí tengo verificado: ${fig.label} = ${fig.text || fig.value}.` : null,
    "Dime por dónde quieres que siga y lo trabajo sobre lo disponible.",
  ].filter(Boolean);
  const candidato = partes.join(" ");
  if (typeof juzgar !== "function") return candidato;
  try { const v = juzgar(candidato); return v && v.ok ? candidato : null; } catch { return null; }
}

/**
 * answerViaAgente({ text, history, mem, scenario, callAgente }) → { r, mem } | throws
 * El caller (ChatADI) atrapa el throw y cae al camino natural — la misma red de resiliencia de siempre.
 */
export async function answerViaAgente({ text, history, mem, scenario = ESCENARIO_INICIAL, callAgente } = {}) {
  if (typeof callAgente !== "function") throw new TypeError("answerViaAgente sin callAgente: el cerebro lo pone el caller");
  const q = String(text || "").trim();
  const memIn = (mem && typeof mem === "object") ? mem : {};
  const recentPrev = Array.isArray(memIn.recentNarrations) ? memIn.recentNarrations : [];
  const caja = cajaDelAgente(TOOLS);
  const herramientas = Object.keys(caja).sort();
  const mapa = mapaDelDato(scenario);

  // ── el hilo que ve el cerebro (la misma disciplina del camino natural: el turno una sola vez) ──
  const mensajes = [];
  for (const h of Array.isArray(history) ? history : []) {
    if (!h || typeof h.text !== "string" || !h.text.trim() || h.pending) continue;
    mensajes.push({ role: h.role === "user" ? "user" : "assistant", content: h.text });
  }
  const _ultimo = mensajes.length ? mensajes[mensajes.length - 1] : null;
  if (!(_ultimo && _ultimo.role === "user" && _ultimo.content.trim() === q)) mensajes.push({ role: "user", content: q });

  // ── el bucle ──
  const figsTotales = [];
  const resultsTotales = [];
  const motivosNoSoportado = [];
  let calls = 0, rondas = 0, correccionUsada = false;
  let texto = null;

  while (rondas < TOPE_RONDAS && texto === null) {
    rondas++;
    const res = await callAgente({ mensajes: [...mensajes], mapa, herramientas, ronda: rondas, attempt: 0 });
    if (res && res.tipo === "texto" && typeof res.texto === "string" && res.texto.trim()) { texto = res.texto; break; }

    const pedidos = (res && res.tipo === "herramientas" && Array.isArray(res.pedidos)) ? res.pedidos.filter(Boolean) : [];
    if (!pedidos.length) continue;   // ronda vacía: cuenta contra el tope, jamás un reintento infinito

    /* herramienta desconocida: UNA corrección de contrato (el cerebro corrige); a la segunda, la ronda se
     * pierde — el error igual queda registrado en la boleta por runPlan («tool desconocida»). */
    const desconocidas = pedidos.filter((p) => !caja[p.tool]).map((p) => p.tool);
    if (desconocidas.length && !correccionUsada) {
      correccionUsada = true;
      mensajes.push({ role: "assistant", content: `[pedido de herramientas] ${pedidos.map((p) => p.tool).join(", ")}` });
      mensajes.push({ role: "user", content: `[MOTOR — no es el usuario] ${desconocidas.length === 1 ? "La herramienta" : "Las herramientas"} ${desconocidas.join(", ")} no ${desconocidas.length === 1 ? "existe" : "existen"}. El catálogo es: ${herramientas.join(", ")}. Pide de nuevo solo herramientas del catálogo.` });
      continue;
    }

    const cupo = Math.min(CALLS_POR_RONDA, TOPE_CALLS - calls);
    if (cupo <= 0) break;
    const rp = runPlan({ intent: "answer", calls: pedidos.map((p) => ({ tool: p.tool, args: p.args || {} })) },
      { scenario, maxCalls: cupo, preguntaUsuario: q, registry: caja });
    calls += Math.min(pedidos.length, cupo);
    figsTotales.push(...(rp.ledger && rp.ledger.figs ? rp.ledger.figs : []));
    resultsTotales.push(...rp.results);
    for (const u of rp.unsupported || []) if (u && u.reason) motivosNoSoportado.push(u.reason);
    for (const r of rp.results) if (r.coverage && r.coverage.supported === false && r.coverage.reason) motivosNoSoportado.push(r.coverage.reason);

    mensajes.push({ role: "assistant", content: `[pedido de herramientas] ${pedidos.map((p) => p.tool).join(", ")}` });
    /* DOCTRINA BAJO DEMANDA (F2b · §10): la instrucción de CADA herramienta usada viaja pegada a su resultado —
     * el turno que no toca P&L no carga su arco. Bloques byte-estables y en orden fijo (la disciplina del mapa):
     * el prefijo del proveedor no distingue «mismo contenido en otro orden» de «contenido nuevo». */
    const doctrina = doctrinasParaRonda(rp.results.map((r) => r.tool));
    mensajes.push({ role: "user", content: `[HERRAMIENTAS — no es el usuario] Resultados:\n${JSON.stringify(_resumenDeRonda(rp))}${doctrina ? `\n${doctrina}` : ""}\nResponde al usuario con esto, o pide más herramientas si de verdad faltan.` });
  }

  // ── el cierre forzado: agotó las rondas sin responder ──
  if (texto === null) {
    const res = await callAgente({ mensajes: [...mensajes, { role: "user", content: "[MOTOR — no es el usuario] Se acabaron las rondas de herramientas. Responde AHORA al usuario con lo que tienes; si no alcanza, declina en una línea diciendo qué falta." }], mapa, herramientas, ronda: TOPE_RONDAS + 1, attempt: 0, cierre: true });
    if (res && res.tipo === "texto" && typeof res.texto === "string" && res.texto.trim()) texto = res.texto;
  }

  // ── el muro · el MISMO juez, con la boleta acumulada ──
  const supuestosDelHilo = [];
  for (const h of Array.isArray(history) ? history : []) {
    if (!h || h.role !== "user" || typeof h.text !== "string") continue;
    for (const pf of parseFigures(h.text)) supuestosDelHilo.push(pf.text);
  }
  for (const pf of parseFigures(q)) supuestosDelHilo.push(pf.text);
  for (const f of figsTotales) if (f.source === "user_supuesto" && (f.text || f.value)) supuestosDelHilo.push(String(f.text || f.value));

  const _guard = (t) => guardC(t, {
    ledger: { figs: figsTotales }, results: resultsTotales, trace: null, question: q,
    supuestoPendiente: supuestosDelHilo,
    datoProyectado: cifrasDelDato(scenario),
    entidadesDelTenant: _ejes(["cliente", "sku", "marca"]),
    duenosDelTenant: _ejes(["cliente", "sku", "marca", "familia", "bodega", "canal"]),
    contentScope: "full", tablePolicy: "auto",
  });
  /* F3 · EL CONTRATO DE SUGERENCIAS SE SUMA AL MURO, SIN TOCARLO (owner: «ese qué hacer debe ser SUGERENCIAS…
   * las decisiones son del usuario»). guardC queda INTACTO; `vetosDeContrato` es un juez NUEVO y CIEGO (regex,
   * jamás comprensión) que corre DESPUÉS: un texto con cifras perfectas que ORDENA la ejecución («procede
   * con X») recibe multa y entra al MISMO ciclo de una-reparación. También rige la escalera: un respaldo viejo
   * que ordenaba no se re-sirve. Calibrado contra el corpus de exámenes (24 aceptadas · 0 vetos). */
  const juzgar = (t) => {
    const v = _guard(t);
    if (!v || !v.ok) return v;
    const vc = vetosDeContrato(t);
    if (!vc.length) return v;
    return { ok: false, violations: vc.map((x) => ({ rule: x.regla, detalle: x.multa })), multa: vc.map((x) => x.multa).join("\n") };
  };

  let estado = "vacio";
  let aprobado = false;
  let final = null;

  if (typeof texto === "string" && texto.trim()) {
    const lavado = stripLanguageLeaks(String(texto));
    const v1 = juzgar(lavado);
    if (v1 && v1.ok) { final = lavado; estado = "verde"; aprobado = true; }
    else {
      // UNA reparación con la multa — la mecánica del ciclo notarial, con el contexto del agente
      const multa = (v1 && (v1.multa || (v1.violations || []).map((x) => x.detalle || x.reason || x).join("\n"))) || "cifras no verificables";
      const res2 = await callAgente({
        mensajes: [...mensajes, { role: "assistant", content: esNarracionVacia(lavado) ? "(respuesta vacía)" : lavado }, { role: "user", content: _MENSAJE_NOTARIO(multa) }],
        mapa, herramientas, ronda: rondas, attempt: 1, motivoReintento: "guard",
      });
      const t2 = res2 && res2.tipo === "texto" ? stripLanguageLeaks(String(res2.texto || "")) : "";
      const v2 = t2.trim() ? juzgar(t2) : null;
      if (v2 && v2.ok) { final = t2; estado = "reparado"; aprobado = true; }
    }
  }

  // ── la escalera INVERTIDA ──
  let suplente = false;
  if (final === null) {
    final = _lineaHonesta({ motivos: motivosNoSoportado, figs: figsTotales, juzgar });
    if (final !== null) { estado = "limite"; suplente = true; }
  }
  if (final === null) {
    final = _respaldoDeLoYaAprobado(memIn, juzgar);
    if (final !== null) { estado = "respaldo"; suplente = true; }
  }
  if (final === null) { final = composeNoDataMessage(null); estado = "vacio"; suplente = true; }

  // ── pantalla · misma limpieza y sello que el camino natural ──
  const ex = extraerCalculos(final);
  let pantalla = stripAllMarks(ex.limpio);
  if (esNarracionVacia(pantalla)) { pantalla = composeNoDataMessage(null); estado = "vacio"; suplente = true; }
  pantalla = anteponerSello(pantalla, getSelloDeCarga(), { calculos: ex.calculos });

  const memOut = { ...memIn, recentNarrations: [pantalla, ...recentPrev].slice(0, 2) };
  if (aprobado && !suplente) memOut.ultimaAprobada = pantalla;

  return {
    r: normalizeResponse({
      text: pantalla,
      route: "agente",
      deterministic: false,
      claims: [],
      suggestions: null,
      sentrixAction: null,
      agente: { estado, rondas, calls, figs: figsTotales.length, motivos: motivosNoSoportado.slice(0, 3) },
    }),
    mem: memOut,
  };
}
