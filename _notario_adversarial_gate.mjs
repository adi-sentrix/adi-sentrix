/* _notario_adversarial_gate.mjs · LA RONDA ADVERSARIAL, CONGELADA (Notario semántico, fase 4 · 2026-09-16) ═══════════════════════════════
 * Solo por `npm run gates:offline` (o con el candado: node --import ./scripts/offline-guard.mjs _notario_adversarial_gate.mjs). Sin red.
 *
 * Seis agentes atacaron offline la relación agente ↔ Notario (forma de la declaración, ubicador y consistencia, asistencia de identidad,
 * reparación con prosa congelada, definiciones únicas, modelo que escribe libre): 637 casos, 69 roturas CONFIRMADAS por un escéptico
 * independiente (`fixtures/notario-adversarial-2026-09-16.json`). Este gate las replica todas con el mismo banco (`_adversarial_notario_harness`
 * es la mesa; acá vive la misma lógica) y exige que ninguna vuelva a romper:
 *   · modo `verificar`: la afirmación FALSA según la boleta no puede salir «verdadera» (falsa o no-verificable, las dos cierran la puerta);
 *   · modo `turno`: la falsedad de la prosa no puede llegar a pantalla con estado verde/reparado/podado.
 * Y las carnadas de CONTROL: para cada familia de rotura, la versión VERDADERA de la misma forma sigue pasando (la puerta se cierra sin
 * bloquear al que dice la verdad). */
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
import { verificarAfirmaciones } from "./src/adi/notario/verificar.js";

let PASS = 0, FAIL = 0;
const ok = (c, msg, detalle = "") => { if (c) { PASS++; console.log(`  ✓ ${msg}`); } else { FAIL++; console.log(`  ✗ ${msg}${detalle ? `\n      ${String(detalle).slice(0, 420)}` : ""}`); } };
const H = (t) => console.log(`\n${t}`);
initTenant(TENANT_DEMO);
const ejes = {}; for (const e of ["cliente", "sku", "marca", "familia", "bodega", "canal"]) { try { const n = axisEntityNames(e); if (n && n.length) ejes[e] = n; } catch { /* sin índice */ } }
const DATO = cifrasDelDato(ESCENARIO_INICIAL);
const CAJA = cajaDelAgente(TOOLS);
const _figs = new Map();
const figsDe = (pregunta) => {
  if (_figs.has(pregunta)) return _figs.get(pregunta);
  const pb = playbookPara(pregunta, {});
  const rp = runPlan({ intent: "answer", calls: pasosDelEncargo(partesDelEncargo(pregunta), pb ? pasosDe(pb, pregunta, {}) : [], {}).map((p) => ({ tool: p.tool, args: p.args || {} })) }, { scenario: ESCENARIO_INICIAL, maxCalls: 18, preguntaUsuario: pregunta, registry: CAJA });
  const figs = (rp.ledger && rp.ledger.figs) || rp.ledger || [];
  _figs.set(pregunta, figs);
  return figs;
};
const norm = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/(\d),(\d)/g, "$1.$2").replace(/\s+/g, " ").trim();
export async function correrTurno(c) {
  const llamadas = [];
  const r = await answerViaAgente({ text: c.pregunta, history: c.history || [], mem: {}, scenario: ESCENARIO_INICIAL, callAgente: async ({ attempt, mensajes, soloDeclaracion }) => {
    const ultimo = [...(mensajes || [])].reverse().find((m) => m.role === "user");
    const pideDeclaracion = !!soloDeclaracion || /NOTARIO — solo la declaración/.test(String(ultimo && ultimo.content));
    const tipo = pideDeclaracion ? "declaracion" : attempt > 0 ? "reparacion" : "cierre";
    llamadas.push(tipo);
    const t = tipo === "declaracion" ? (c.declaracion != null ? c.declaracion : c.cierre) : tipo === "reparacion" ? (c.reparacion != null ? c.reparacion : c.cierre) : c.cierre;
    return { tipo: "texto", texto: String(t || ""), stop: "end_turn" };
  } });
  const a = r.r.agente || {};
  const texto = String(r.r.text || "");
  const servidoPremium = ["verde", "reparado", "podado"].includes(a.estado);
  const falsedadesServidas = (c.falsedades || []).filter((fr) => norm(texto).includes(norm(fr)));
  return { estado: a.estado, sitio: a.notario && a.notario.servido && a.notario.servido.sitio, llamadas, servidoPremium, falsedadesServidas, rompe: servidoPremium && falsedadesServidas.length > 0, texto, pasos: (a.notario && a.notario.pasos) || [] };
}
export function correrVerificar(c) {
  const R = verificarAfirmaciones(c.afirmaciones, { figs: figsDe(c.pregunta), datoProyectado: DATO, ejesDelTenant: ejes });
  return R.veredictos;
}

const F = JSON.parse(fs.readFileSync(new URL("./fixtures/notario-adversarial-2026-09-16.json", import.meta.url), "utf8"));
H(`A · las ${F.casos.length} roturas confirmadas de la ronda adversarial, replicadas: ninguna vuelve a romper`);
const porAngulo = {};
for (const c of F.casos) {
  const e = c.entrada;
  let rompe = false, detalle = "";
  if (c.modo === "verificar") {
    const vs = correrVerificar(e);
    /* la afirmación falsa (o alguna de las falsas del caso) no puede salir verdadera: el atacante declara cuáles son falsas en `verdad`;
     * acá se exige lo fuerte: NINGUNA verdadera en el caso salvo las que el caso marque `verdaderaEsperada` */
    const esperadasVerdaderas = new Set((e.afirmaciones || []).filter((a) => a && a.verdaderaEsperada).map((a) => a.id));
    const malas = vs.filter((v) => v.veredicto === "verdadera" && !esperadasVerdaderas.has(v.id));
    rompe = malas.length > 0;
    detalle = malas.map((v) => `${v.id}: ${String(v.motivo).slice(0, 120)}`).join(" | ");
  } else {
    const r = await correrTurno(e);
    rompe = r.rompe;
    detalle = `estado ${r.estado} · sitio ${r.sitio} · servidas: ${r.falsedadesServidas.join(" / ")}`;
  }
  porAngulo[c.angulo] = porAngulo[c.angulo] || { n: 0, ok: 0 };
  porAngulo[c.angulo].n++; if (!rompe) porAngulo[c.angulo].ok++;
  ok(!rompe, `${c.id} [${c.modo}] · ${String(c.verdad).slice(0, 110)}`, detalle);
}
console.log(`  por ángulo: ${Object.entries(porAngulo).map(([k, v]) => `${k} ${v.ok}/${v.n}`).join(" · ")}`);

/* ═══ B · LOS CONTROLES: la puerta se cierra sin bloquear al que dice la verdad ═══════════════════════════════════════════════════════ */
const CTL = F.controles || { verificar: [], turno: [] };
H(`B · controles: ${CTL.verificar.length} declaraciones verdaderas (verificar) + ${CTL.turno.length} turnos correctos (verde en una llamada)`);
for (const c of CTL.verificar) {
  const vs = correrVerificar(c);
  const malas = vs.filter((v) => v.veredicto !== "verdadera");
  ok(!malas.length, `${c.id} · ${c.afirmaciones.map((a) => "«" + String(a.texto).slice(0, 60) + "»").join(" + ")} → verdadera`, malas.map((v) => `${v.id}: ${v.veredicto} · ${String(v.motivo).slice(0, 140)}`).join(" | "));
}
for (const c of CTL.turno) {
  const r = await correrTurno(c);
  const bien = r.estado === "verde" && r.llamadas.length === 1;
  ok(bien, `${c.id} · «${String(c.cierre).split("\n")[0].slice(0, 80)}» → verde en una llamada`, `estado ${r.estado} · llamadas ${r.llamadas.join(" → ")} · ${(r.pasos || []).map((p) => p.sitio + ": " + (p.multas || []).map((m) => m.slice(0, 120)).join(" | ")).join(" ‖ ")}`);
}

console.log(`\n── _notario_adversarial_gate: ${PASS} PASS · ${FAIL} FAIL (de ${PASS + FAIL}) ──`);
process.exit(FAIL ? 1 : 0);
