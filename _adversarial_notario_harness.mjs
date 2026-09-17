/* _adversarial_notario_harness.mjs · EL BANCO DE ATAQUE OFFLINE del Notario semántico (fase 4, etapa B · 2026-09-16) ═══════════════
 * NO es un gate ni producto: es la mesa en la que la ronda adversarial (UltraCode) intenta romper la relación agente ↔ Notario sin
 * red y sin gasto. Siempre con el candado:  node --import ./scripts/offline-guard.mjs _adversarial_notario_harness.mjs <modo> …
 *
 *   figs "<pregunta>"                     → imprime la boleta con que se juzga un turno (la verdad contra la que se ataca)
 *   verificar <casos.json>                → cada caso {pregunta, afirmaciones:[…]} → veredicto por afirmación (ataque al resolutor/verificador)
 *   hechos <casos.json>                   → cada caso {pregunta, hechos:[…]} (verdad finita) → el libro: veredicto por hecho identificado, la verdad de lo falso
 *                                            con id, roles, claves, números y render (ataque a hechos.js + universo tipado + razón + derivada)
 *   turno <casos.json>                    → cada caso {pregunta, cierre:"prosa\n\n<<AFIRMACIONES>>…", declaracion?:"bloque", reparacion?:"…",
 *                                            falsedades:["fragmento falso", …]} corre el TURNO ENTERO con ese cerebro guionado y dice si alguna
 *                                            falsedad llegó a pantalla (estado, sitio servido, vetos)
 *
 * Un ataque «rompe» cuando: (verificar) una afirmación FALSA según la boleta sale «verdadera»; (turno) un fragmento falso de la prosa
 * llega al texto servido con estado verde/reparado/podado. Todo lo demás (no-verificable, respaldo, línea honesta) es el sistema
 * cerrando la puerta. Salida en JSON por línea para que la lea un agente. */
import fs from "node:fs";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { ESCENARIO_INICIAL } from "./src/config/scenarios.js";
import { cifrasDelDato } from "./src/adi/oracle/datoProyectado.js";
import { axisEntityNames } from "./src/adi/oracle/entityIndex.js";
import { runPlan } from "./src/adi/oracle/toolRunner.js";
import { TOOLS } from "./src/adi/oracle/toolRegistry.js";
import { cajaDelAgente } from "./src/adi/agente/herramientasAgente.js";
import { playbookPara, pasosDe } from "./src/adi/agente/playbooks/registro.js";
import { partesDelEncargo, pasosDelEncargo } from "./src/adi/agente/encargoCompuesto.js";
import { answerViaAgente } from "./src/adi/agente/bucleAgente.js";
import { dominiosDe, pasosDeDominios, unirPasosDeDominios } from "./src/adi/agente/contratoDeDominios.js";
import { verificarAfirmaciones } from "./src/adi/notario/verificar.js";
import { extraerDeclaracion } from "./src/adi/notario/declaracion.js";
import { indiceDeEvidencia } from "./src/adi/notario/evidencia.js";
import { libroDeHechos, asignarIds } from "./src/adi/notario/hechos.js";   // verdad finita (E1): el modo `hechos`

initTenant(TENANT_DEMO);
const ejes = {}; for (const e of ["cliente", "sku", "marca", "familia", "bodega", "canal"]) { try { const n = axisEntityNames(e); if (n && n.length) ejes[e] = n; } catch { /* sin índice */ } }
const DATO = cifrasDelDato(ESCENARIO_INICIAL);
const CAJA = cajaDelAgente(TOOLS);
/* la boleta del modo `verificar` es la del turno real: los pasos del procedimiento/encargo UNIDOS a los del contrato de dominios (ronda 4:
 * los cruces Comercial · Cobranza · Inventario necesitan las boletas de los dos o tres dominios, como en el bucle) */
const figsDe = (pregunta) => {
  const pb = playbookPara(pregunta, {});
  const dom = (() => { try { return dominiosDe(pregunta); } catch { return { dominios: [], eje: null }; } })();
  const pasosPb = pasosDelEncargo(partesDelEncargo(pregunta), pb ? pasosDe(pb, pregunta, {}) : [], {});
  const pasosContrato = (() => { try { return pasosDeDominios(dom); } catch { return []; } })();
  const pasos = unirPasosDeDominios(pasosPb, pasosContrato);
  const rp = runPlan({ intent: "answer", calls: pasos.map((p) => ({ tool: p.tool, args: p.args || {} })) }, { scenario: ESCENARIO_INICIAL, maxCalls: 18, preguntaUsuario: pregunta, registry: CAJA });
  return asignarIds((rp.ledger && rp.ledger.figs) || rp.ledger || []);   // verdad finita: cada fig con su id (c1, c2…)
};
const norm = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/(\d),(\d)/g, "$1.$2").replace(/\s+/g, " ").trim();
const [modo, arg] = process.argv.slice(2);
const salida = (o) => console.log(JSON.stringify(o));

if (modo === "figs") {
  const figs = figsDe(String(arg || ""));
  for (const f of figs) salida({ label: f.label, value: f.value, unit: f.unit });
  salida({ total: figs.length, rankings: Object.fromEntries(Object.entries(DATO.rankings || {}).map(([eje, R]) => [eje, Object.keys(R || {})])), conjuntos: Object.fromEntries(Object.entries(DATO.conjuntos || {}).map(([k, v]) => [k, v.entidades])), estados: DATO.estados });
} else if (modo === "hechos") {
  const casos = JSON.parse(fs.readFileSync(arg, "utf8"));
  for (const c of casos) {
    const figs = figsDe(c.pregunta);
    const I = indiceDeEvidencia({ figs, datoProyectado: DATO, ejesDelTenant: ejes });
    const libro = libroDeHechos(c.hechos, { indice: I });
    salida({ id: c.id || null, pregunta: c.pregunta, resumen: libro.resumen, hechos: libro.hechos.map((H) => ({ id: H.id, tipo: H.tipo, ok: H.ok, veredicto: H.veredicto, motivo: String(H.motivo).slice(0, 220), verdad: String(H.verdad || "").slice(0, 160), entidades: [...H.entidades], claves: [...H.claves], dominio: H.dominio, estado: H.estado, numeros: H.numeros.map((n) => n.texto || String(n.raw)), universo: H.universo ? { texto: H.universo.texto, n: H.universo.set ? H.universo.set.size : null } : null, render: H.render, derivadoDe: H.derivadoDe || null })) });
  }
} else if (modo === "verificar") {
  const casos = JSON.parse(fs.readFileSync(arg, "utf8"));
  for (const c of casos) {
    const figs = figsDe(c.pregunta);
    const R = verificarAfirmaciones(c.afirmaciones, { figs, datoProyectado: DATO, ejesDelTenant: ejes });
    salida({ id: c.id || null, pregunta: c.pregunta, veredictos: R.veredictos.map((v) => ({ id: v.id, veredicto: v.veredicto, motivo: String(v.motivo).slice(0, 220), verdad: String(v.verdad || "").slice(0, 160), resuelta: v.resuelta || null })) });
  }
} else if (modo === "turno") {
  const casos = JSON.parse(fs.readFileSync(arg, "utf8"));
  for (const c of casos) {
    const llamadas = [];
    const r = await answerViaAgente({ text: c.pregunta, history: c.history || [], mem: {}, scenario: ESCENARIO_INICIAL, notarioV3: !!c.v3, callAgente: async ({ attempt, mensajes, soloDeclaracion, motivoReintento }) => {
      const ultimo = [...(mensajes || [])].reverse().find((m) => m.role === "user");
      const pideDeclaracion = !!soloDeclaracion || /NOTARIO — solo la declaración/.test(String(ultimo && ultimo.content));
      /* v3 (verdad finita): «reanclaje» = la misma prosa con las anclas corregidas; «reparacion» = la reescritura con la verdad (c.reescritura o c.reparacion) */
      const tipo = pideDeclaracion ? "declaracion" : motivoReintento === "reanclaje" ? "reanclaje" : attempt > 0 ? "reparacion" : "cierre";
      llamadas.push(tipo);
      const t = tipo === "declaracion" ? (c.declaracion != null ? c.declaracion : c.cierre) : tipo === "reanclaje" ? (c.reanclaje != null ? c.reanclaje : c.cierre) : tipo === "reparacion" ? (c.reescritura != null ? c.reescritura : c.reparacion != null ? c.reparacion : c.cierre) : c.cierre;
      return { tipo: "texto", texto: String(t || ""), stop: "end_turn" };
    } });
    const a = r.r.agente || {};
    const texto = String(r.r.text || "");
    const servidoPremium = ["verde", "reparado", "podado"].includes(a.estado);
    const falsedadesServidas = (c.falsedades || []).filter((fr) => norm(texto).includes(norm(fr)));
    salida({ id: c.id || null, pregunta: c.pregunta, estado: a.estado, sitioServido: a.notario && a.notario.servido && a.notario.servido.sitio, llamadas, servidoPremium, falsedadesServidas, ROMPE: servidoPremium && falsedadesServidas.length > 0,
      pasos: ((a.notario && a.notario.pasos) || []).map((p) => ({ sitio: p.sitio, vetos: p.vetos, asistidas: (p.asistidas || []).map((x) => `${x.sujeto} · ${x.metrica} = ${x.valor}`), multas: (p.multas || []).slice(0, 6).map((m) => m.slice(0, 200)) })),
      texto: texto.slice(0, 1200) });
  }
} else {
  console.error("uso: node --import ./scripts/offline-guard.mjs _adversarial_notario_harness.mjs figs \"<pregunta>\" | verificar <casos.json> | hechos <casos.json> | turno <casos.json>");
  process.exit(2);
}
