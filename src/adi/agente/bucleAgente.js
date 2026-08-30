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
 * LOS TOPES SON DEL CLIENTE, no promesas del prompt: 3 rondas de herramientas + 1 cierre, más UNA ronda extra
 * cuando el cierre o la reparación piden una herramienta VÁLIDA (R1 del examen 1: descartar ese pedido mataba
 * el turno — T7 vacío pidiendo inventoryStatus) y su re-cierre — techo duro de 6 llamadas al cerebro por
 * turno (3 rondas + cierre + ronda extra con re-cierre + reparación). 8 calls por ronda (el cap de runPlan) y
 * 12 por turno; una herramienta desconocida recibe UNA corrección de contrato y a la segunda quema la ronda.
 * Jamás un reintento infinito.
 *
 * EL CEREBRO SE INYECTA (`callAgente`) — ChatADI pondrá el fetch real cuando el adapter hable el modo libre;
 * los gates ponen GUIONES, incluidos los maliciosos. Contrato de `callAgente({ mensajes, mapa, herramientas,
 * ronda, attempt, motivoReintento, figsEnBoleta })` → Promise<{ tipo:"herramientas", pedidos:[{tool,args}] } |
 * { tipo:"texto", texto }>. Este módulo no conoce el cable (tool_use nativo vs texto): eso es del adapter.
 * `figsEnBoleta` (R-eco del examen 1 del agente): cuántas cifras verificadas acumula el turno — el adapter
 * decide el tier con eso (escalar el cierre a un modelo mejor SOLO cuando hay material que reescribir; con
 * boleta vacía la escalada fue 66% del gasto y CERO verdes).
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
import { recitaAprobadaDe } from "../oracle/cicloNotarial.js";   // R2 del examen 1: la MISMA memoria de re-cita del camino natural — jamás una segunda paralela
import { ESCENARIO_INICIAL } from "../../config/scenarios.js";   // colapso del eje: el agente lee el MISMO dato que la pantalla
import { vetosDeContrato } from "./contratoAgente.js";   // F3 · el juez ciego de sugerencias — se SUMA a guardC, no lo toca
import { getNombreUsuario } from "./preferenciaNombre.js";   // R4c · el trato registrado viaja también en los rescates
import { detectSerieIntent, composeSerieIntent } from "../oracle/serieIntent.js";   // R9 · el puente, también en modo agente
import { serieRealDe } from "../sentrix/capability.js";

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

/* ── LA ESCALERA INVERTIDA · peldaño 1: la línea honesta con lo VERIFICADO del turno ─────────────────────────── */
/* R4b · métricas para emparejar un supuesto con su contraparte verificada (con y sin tilde). */
const _METRICAS_REFUTACION = ["margen", "venta", "ventas", "contribución", "contribucion", "carga", "capital",
  "inventario", "rotación", "rotacion", "unidades", "acciones", "costo"];
const _reWord = (t) => new RegExp(`\\b${String(t).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
function _lineaHonesta({ motivos, figs, juzgar, entidades }) {
  const motivo = motivos.length ? motivos[motivos.length - 1] : null;
  /* las cifras salen de la BOLETA ACUMULADA — verificadas por el muro antes de adoptarse, nunca compuestas
   * libres (F1 §9.3). Obligatorias primero.
   * ⚠️ JAMÁS UN SUPUESTO DEL USUARIO: la frase dice «lo que sí tengo verificado», y una cifra que el usuario
   * ofreció es exactamente lo contrario — citarla acá la blanquearía como dato. */
  const verificadas = figs.filter((f) => f.source !== "user_supuesto" && f.label && (f.text || f.value));

  /* R4b DEL EXAMEN 1 (2026-08-31): si el turno registró un supuesto y lo verificado lo CONTRADICE, la
   * refutación viaja también en el rescate — la corrección 30%→22.0% de T5 existía en los borradores y nunca
   * llegó: el usuario quedó creyendo el 30%. Emparejamiento CONSERVADOR: entidad Y métrica del supuesto
   * presentes en el label verificado, misma unidad, valor distinto — ante cualquier duda, nada. */
  let refutacion = null, contra = null;
  const sup = figs.find((f) => f.source === "user_supuesto" && f.label);
  if (sup) {
    const entSup = (Array.isArray(entidades) ? entidades : []).find((e) => _reWord(e).test(sup.label)) || null;
    const metSup = _METRICAS_REFUTACION.find((m) => _reWord(m).test(sup.label)) || null;
    if (entSup && metSup) {
      contra = verificadas.find((f) => _reWord(entSup).test(String(f.label)) && _reWord(metSup).test(String(f.label))) || null;
      if (contra && contra.unit === sup.unit && Number.isFinite(contra.raw) && Number.isFinite(sup.raw) && Math.abs(contra.raw - sup.raw) > 1e-9) {
        refutacion = `El supuesto que registraste no coincide con lo verificado: ${contra.label} = ${contra.text || contra.value}.`;
      } else { contra = null; }
    }
  }

  /* R4a DEL EXAMEN 1: PROPORCIONALIDAD del rescate — hasta 4 cifras verificadas del turno, no una sola (T4
   * sirvió UNA cifra donde el suplente natural servía el tablero). Sigue siendo CORTO y solo con lo que ESTE
   * turno verificó: el tablero de KPIs sigue fuera de la escalera (decisión del owner, intacta). */
  const destacadas = [
    ...verificadas.filter((f) => f.mandatory),
    ...verificadas.filter((f) => !f.mandatory),
  ].filter((f) => f !== contra).slice(0, 4);

  /* sin un LÍMITE que nombrar ni contenido que ofrecer, este peldaño no tiene nada honesto que decir: cede al
   * siguiente (el respaldo de lo ya aprobado), que sí tiene contenido de verdad. */
  if (!motivo && !destacadas.length && !refutacion) return null;
  const partes = [
    motivo ? `No pude completar la lectura que pediste: ${motivo}.` : "No pude completar la lectura que pediste con la calidad que corresponde.",
    destacadas.length ? `Lo que sí tengo verificado: ${destacadas.map((f) => `${f.label} = ${f.text || f.value}`).join("; ")}.` : null,
    refutacion,
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
  /* R9 DEL EXAMEN 1 (2026-08-31): ENTIDAD×PERÍODO BLOQUEADA → EL PUENTE, también en modo agente. Medido en el
   * bloque B: las 4 variantes declinaron honestas PERO en 8-11 líneas con menú, T9 divergió con un cuestionario
   * que prometía una cifra que el bloqueo hace imposible («con eso puedo traerte la cifra limpia» — puerta
   * falsa), y las 4 expusieron el instrumento. El puente determinístico resuelve el MISMO caso en 1-2 líneas
   * con la razón verdadera y la puerta real (la ficha) — esa ES la letra, y acá se sirve VERBATIM, como en el
   * camino natural (determinístico aprobado; el mismo espejo, no una segunda letra). SOLO intercepta la serie
   * BLOQUEADA o el nombre ambiguo: con serie real reconciliada el cerebro corre con su herramienta
   * (serieEntidad) — el agente sigue siendo agente donde el dato responde. */
  {
    const det = (() => { try { return detectSerieIntent(q); } catch { return null; } })();
    const bloqueada = det && !det.ambiguo && det.entidad && (() => { try { return !serieRealDe(det.entidad).real; } catch { return false; } })();
    if (det && (det.ambiguo || bloqueada)) {
      const puente = (() => { try { return composeSerieIntent({ q, scenario }); } catch { return null; } })();
      if (puente && puente.text) {
        const pantalla = anteponerSello(puente.text, getSelloDeCarga(), { calculos: [] });
        return {
          r: normalizeResponse({
            text: pantalla, route: "agente", deterministic: true, claims: [], suggestions: null,
            sentrixAction: puente.sentrixAction || null,
            agente: { estado: "puente", rondas: 0, calls: 0, figs: 0, motivos: [], vetos: [], recitaCifras: 0 },
          }),
          mem: { ...memIn, recentNarrations: [pantalla, ...recentPrev].slice(0, 2) },
        };
      }
    }
  }

  /* R2 DEL EXAMEN 1 DEL AGENTE (2026-08-31): la re-cita de lo YA aprobado a pantalla — el MISMO cable del
   * camino natural (caminoNatural.js), que acá NUNCA se conectó: el contador marcó 0 en los 28 turnos y las
   * cifras aprobadas en turnos previos ($194K de T9, re-citado en T13) morían como «no autorizadas». Raíz de
   * la mayoría de los turnos no-verdes. Los candados del owner viven en recitaAprobadaDe (mismo dueño, misma
   * unidad, solo textos que el muro aprobó). */
  const recita = (memIn.recitaAprobada && Array.isArray(memIn.recitaAprobada.figs) && memIn.recitaAprobada.figs.length)
    ? memIn.recitaAprobada : null;

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
  let calls = 0, rondas = 0, correccionUsada = false, rondaExtraUsada = false;
  let texto = null;

  /* ejecuta UNA tanda de pedidos y deja el intercambio en `destino` (el hilo que verá la llamada siguiente).
   * Es EL cuerpo de la ronda — la ronda normal y la ronda extra de R1 comparten esta única implementación
   * para que jamás diverjan. false = sin cupo (el tope manda). */
  const _rondaDeHerramientas = (pedidos, destino) => {
    const cupo = Math.min(CALLS_POR_RONDA, TOPE_CALLS - calls);
    if (cupo <= 0) return false;
    const rp = runPlan({ intent: "answer", calls: pedidos.map((p) => ({ tool: p.tool, args: p.args || {} })) },
      { scenario, maxCalls: cupo, preguntaUsuario: q, registry: caja });
    calls += Math.min(pedidos.length, cupo);
    figsTotales.push(...(rp.ledger && rp.ledger.figs ? rp.ledger.figs : []));
    resultsTotales.push(...rp.results);
    for (const u of rp.unsupported || []) if (u && u.reason) motivosNoSoportado.push(u.reason);
    for (const r of rp.results) if (r.coverage && r.coverage.supported === false && r.coverage.reason) motivosNoSoportado.push(r.coverage.reason);

    destino.push({ role: "assistant", content: `[pedido de herramientas] ${pedidos.map((p) => p.tool).join(", ")}` });
    /* DOCTRINA BAJO DEMANDA (F2b · §10): la instrucción de CADA herramienta usada viaja pegada a su resultado —
     * el turno que no toca P&L no carga su arco. Bloques byte-estables y en orden fijo (la disciplina del mapa):
     * el prefijo del proveedor no distingue «mismo contenido en otro orden» de «contenido nuevo». */
    const doctrina = doctrinasParaRonda(rp.results.map((r) => r.tool));
    destino.push({ role: "user", content: `[HERRAMIENTAS — no es el usuario] Resultados:\n${JSON.stringify(_resumenDeRonda(rp))}${doctrina ? `\n${doctrina}` : ""}\nResponde al usuario con esto, o pide más herramientas si de verdad faltan.` });
    return true;
  };

  /* R6 DEL EXAMEN 1 (2026-08-31): LEER ANTES DE DECLINAR U OPINAR. Medido: T20 afirmó una limitación FALSA
   * («sin 24 meses no puedo» — el dato trae el año anterior) con 0 herramientas y quedó verde; en 5 de 7 turnos
   * de la ventana 17-23 declinó o clarificó sin UNA cifra; en 24-28 pidió permiso conversacional para lecturas
   * internas («¿Quieres que tire el Executive Summary? ¿Sí o no?») en vez de ejecutarlas. Declinar sin boleta
   * es opinar. El empujón es UNO por turno, consume ronda (jamás un bucle infinito) y NO aplica cuando el
   * límite citado ya es el DECLARADO del mapa («no reconcilia» — ahí declinar directo ES la conducta). */
  const _RE_DECLINA_SIN_LEER = /\bno (?:tengo|puedo|dispongo|hay|registro)\b|\bsin (?:datos|serie|hist[oó]rico?a?|24 meses)\b|¿(?:quieres|deseas) que\b|¿s[ií] o no\?|¿vamos con\b|¿procedo\b/i;
  let nudgeUsado = false;

  while (rondas < TOPE_RONDAS && texto === null) {
    rondas++;
    const res = await callAgente({ mensajes: [...mensajes], mapa, herramientas, ronda: rondas, attempt: 0, figsEnBoleta: figsTotales.length });
    if (res && res.tipo === "texto" && typeof res.texto === "string" && res.texto.trim()) {
      if (calls === 0 && !nudgeUsado && _RE_DECLINA_SIN_LEER.test(res.texto) && !/no reconcilia/i.test(res.texto)) {
        nudgeUsado = true;
        mensajes.push({ role: "assistant", content: res.texto });
        mensajes.push({ role: "user", content: "[MOTOR — no es el usuario] Antes de declinar, afirmar un límite del dato o pedir permiso para una lectura: VERIFICA — pide ahora la(s) herramienta(s) que respalden tu respuesta y las ejecuto. Las lecturas internas no piden permiso: se ejecutan y se sirve el resultado. Solo si el límite ya está declarado en el mapa del dato, responde directo citándolo." });
        continue;   // la ronda cuenta contra el tope
      }
      texto = res.texto; break;
    }

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

    if (!_rondaDeHerramientas(pedidos, mensajes)) break;
  }

  /* R1 DEL EXAMEN 1 (2026-08-31): ¿el pedido trae al menos una herramienta REAL que valga una ronda extra?
   * En el examen, cuando el cierre o la reparación pedían una herramienta válida el pedido SE DESCARTABA y el
   * turno moría (T7: el reintento pidió inventoryStatus en cierre → vacío; mismo patrón T13/T24/T26 — 11 de
   * los 14 no-verdes). La ronda extra es UNA por turno, con el mismo cupo de calls de siempre. */
  const _pedidosValidos = (res) => {
    if (rondaExtraUsada || !res || res.tipo !== "herramientas" || !Array.isArray(res.pedidos)) return null;
    const pedidos = res.pedidos.filter(Boolean);
    return pedidos.some((p) => caja[p.tool]) ? pedidos : null;
  };

  // ── el cierre forzado: agotó las rondas sin responder ──
  if (texto === null) {
    const pedirCierre = () => callAgente({ mensajes: [...mensajes, { role: "user", content: "[MOTOR — no es el usuario] Se acabaron las rondas de herramientas. Responde AHORA al usuario con lo que tienes; si no alcanza, declina en una línea diciendo qué falta." }], mapa, herramientas, ronda: TOPE_RONDAS + 1, attempt: 0, cierre: true, figsEnBoleta: figsTotales.length });
    let res = await pedirCierre();
    const extra = _pedidosValidos(res);
    if (extra && _rondaDeHerramientas(extra, mensajes)) {   // R1: el cierre pidió una herramienta válida — se ejecuta y se le vuelve a pedir el cierre
      rondaExtraUsada = true;
      res = await pedirCierre();
    }
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

  const duenosTenant = _ejes(["cliente", "sku", "marca", "familia", "bodega", "canal"]);
  const _guard = (t) => guardC(t, {
    ledger: { figs: figsTotales }, results: resultsTotales, trace: null, question: q,
    supuestoPendiente: supuestosDelHilo,
    recitaAprobada: recita,   // R2: cifras aprobadas a pantalla en turnos previos — el muro las re-autoriza con su dueño
    datoProyectado: cifrasDelDato(scenario),
    entidadesDelTenant: _ejes(["cliente", "sku", "marca"]),
    duenosDelTenant: duenosTenant,
    contentScope: "full", tablePolicy: "auto",
  });
  /* F3 · EL CONTRATO DE SUGERENCIAS SE SUMA AL MURO, SIN TOCARLO (owner: «ese qué hacer debe ser SUGERENCIAS…
   * las decisiones son del usuario»). guardC queda INTACTO; `vetosDeContrato` es un juez NUEVO y CIEGO (regex,
   * jamás comprensión) que corre DESPUÉS: un texto con cifras perfectas que ORDENA la ejecución («procede
   * con X») recibe multa y entra al MISMO ciclo de una-reparación. También rige la escalera: un respaldo viejo
   * que ordenaba no se re-sirve. Calibrado contra el corpus de exámenes (24 aceptadas · 0 vetos). */
  /* R7 DEL EXAMEN 1 (expediente auditable): CADA veto queda registrado con su sitio y su multa — el examen 1
   * corrió con «vetos: ninguno» en los 28 veredictos mientras 14 turnos reintentaban por guard, y el post-mortem
   * quedó a ciegas justo en los turnos degradados. El registro es OBSERVACIÓN pura: no decide nada. */
  const vetosDelTurno = [];
  const _multaDe = (v) => (v && (v.multa || (v.violations || []).map((x) => x.detalle || x.detail || x.reason || x).join("\n"))) || "cifras no verificables";
  const juzgar = (t, sitio = "cierre") => {
    const v = _guard(t);
    if (!v || !v.ok) {
      vetosDelTurno.push(`${sitio} · ${String(_multaDe(v)).split("\n")[0].slice(0, 180)}`);
      return v;
    }
    const vc = vetosDeContrato(t);
    if (!vc.length) return v;
    vetosDelTurno.push(`${sitio} · ${vc[0].regla}: ${vc[0].multa.split("\n")[0].slice(0, 160)}`);
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
      const hiloReparacion = [...mensajes, { role: "assistant", content: esNarracionVacia(lavado) ? "(respuesta vacía)" : lavado }, { role: "user", content: _MENSAJE_NOTARIO(multa) }];
      let res2 = await callAgente({
        mensajes: [...hiloReparacion],
        mapa, herramientas, ronda: rondas, attempt: 1, motivoReintento: "guard", figsEnBoleta: figsTotales.length,
      });
      /* R1: la reparación pidió una herramienta VÁLIDA (T7: pidió inventoryStatus y el pedido se tiraba →
       * turno vacío). Se ejecuta la ronda extra SOBRE EL HILO DE LA REPARACIÓN (la multa sigue a la vista) y
       * se le pide reescribir con las cifras ya verificadas — recién ahí hay material para pasar el muro. */
      const extra2 = _pedidosValidos(res2);
      if (extra2 && _rondaDeHerramientas(extra2, hiloReparacion)) {
        rondaExtraUsada = true;
        res2 = await callAgente({
          mensajes: [...hiloReparacion, { role: "user", content: "[MOTOR — no es el usuario] Las herramientas que pediste ya corrieron: sus cifras están arriba. Reescribe AHORA tu respuesta completa con esas cifras verificadas, corrigiendo lo que observó la verificación." }],
          mapa, herramientas, ronda: rondas, attempt: 1, motivoReintento: "guard", figsEnBoleta: figsTotales.length,
        });
      }
      const t2 = res2 && res2.tipo === "texto" ? stripLanguageLeaks(String(res2.texto || "")) : "";
      const v2 = t2.trim() ? juzgar(t2, "reparacion") : null;
      if (v2 && v2.ok) { final = t2; estado = "reparado"; aprobado = true; }
    }
  }

  // ── la escalera INVERTIDA ──
  let suplente = false;
  if (final === null) {
    final = _lineaHonesta({ motivos: motivosNoSoportado, figs: figsTotales, juzgar: (t) => juzgar(t, "linea-honesta"), entidades: duenosTenant || [] });
    if (final !== null) { estado = "limite"; suplente = true; }
  }
  if (final === null) {
    // R3: el contexto de pertinencia viaja — el peldaño no afirma «sobre esto» si la pregunta habla de otra cosa
    final = _respaldoDeLoYaAprobado(memIn, (t) => juzgar(t, "respaldo"), { pregunta: q, entidades: duenosTenant || [], recienMostrado: recentPrev[0] || null });
    if (final !== null) { estado = "respaldo"; suplente = true; }
  }
  if (final === null) { final = composeNoDataMessage(null); estado = "vacio"; suplente = true; }

  /* R4c DEL EXAMEN 1 (2026-08-31): el trato registrado llega TAMBIÉN en los peldaños de rescate — en T14/T15
   * «jc»/«wachin» se guardaron en el motor y jamás aparecieron en pantalla (los verdes lo traen porque el
   * cerebro lee lineaDeNombre; los rescates son deterministas y no lo leían). El prefijo se verifica igual que
   * todo lo que sale a pantalla; si no pasa, sale sin trato — jamás sin respuesta. La sonda no registra veto
   * en el expediente a propósito: es cosmética, no una reparación fallida. */
  if (suplente && typeof final === "string" && final) {
    const trato = getNombreUsuario();
    if (trato && !final.startsWith(`${trato}:`)) {
      const conTrato = `${trato}: ${final}`;
      try { const vt = _guard(conTrato); if (vt && vt.ok && !vetosDeContrato(conTrato).length) final = conTrato; } catch { /* sin trato antes que sin respuesta */ }
    }
  }

  // ── pantalla · misma limpieza y sello que el camino natural ──
  const ex = extraerCalculos(final);
  let pantalla = stripAllMarks(ex.limpio);
  if (esNarracionVacia(pantalla)) { pantalla = composeNoDataMessage(null); estado = "vacio"; suplente = true; }
  pantalla = anteponerSello(pantalla, getSelloDeCarga(), { calculos: ex.calculos });

  const memOut = { ...memIn, recentNarrations: [pantalla, ...recentPrev].slice(0, 2) };
  if (aprobado && !suplente) memOut.ultimaAprobada = pantalla;
  /* R2 · la otra punta del cable: lo que el muro APROBÓ presta sus cifras al turno siguiente — el MISMO
   * constructor y los MISMOS candados del camino natural (un texto vetado o un respaldo no acumulan nada). */
  if (aprobado) {
    const recitaNueva = recitaAprobadaDe({ textoAprobado: pantalla, catalogoEntidades: duenosTenant || [], previa: recita });
    if (recitaNueva) memOut.recitaAprobada = recitaNueva;
  }

  return {
    r: normalizeResponse({
      text: pantalla,
      route: "agente",
      deterministic: false,
      claims: [],
      suggestions: null,
      sentrixAction: null,
      agente: { estado, rondas, calls, figs: figsTotales.length, motivos: motivosNoSoportado.slice(0, 3),
        vetos: vetosDelTurno,   // R7 · el expediente auditable: cada veto con su sitio y su multa (observación, no decisión)
        recitaCifras: recita && Array.isArray(recita.figs) ? recita.figs.length : 0 },
    }),
    mem: memOut,
  };
}
