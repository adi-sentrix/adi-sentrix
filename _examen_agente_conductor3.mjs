/* === _examen_agente_conductor3.mjs · CORRIDA 3 · CON EL FRENO ARREGLADO ==================================
 *
 * ⚠️ LA FALLA QUE ESTE ARCHIVO CORRIGE ES MÍA (supervisor, corrida 2): el freno chequeaba el acumulado DESPUÉS
 * de cada turno, con corte en US$0.90 sobre un techo autorizado de US$1.00. Con US$0.8111 acumulados —bajo el
 * corte— arrancó un turno que costó US$0.2534 él solo y la corrida cerró en US$1.0645: **se pasó del techo que
 * el owner autorizó**. Chico en plata (6 centavos), grave en principio: un freno que puede superar el límite
 * que custodia no es un freno.
 *
 * EL ARREGLO: se frena ANTES de arrancar cada turno, reservando el PEOR turno observado. Si lo que queda no
 * alcanza para pagar un turno del peor caso, no se arranca — el techo deja de poder superarse por diseño, en
 * vez de por suerte. La reserva sale de la medición, no de una corazonada: US$0.2534 fue el peor turno real.
 *
 * Y se conserva `--frenar-en-vacia` por turno (un turno roto cuesta UNA llamada, no un reintento pago).
 *
 * AUTORIZACIÓN: este archivo NO corre solo. La corrida 3 exige la palabra del owner nombrando el gasto
 * (protocolo ≈US$0.45 típico · techo US$1.00 tras P2/P3). */
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const LOG = "_examen_agente_corrida3_run.log";
const ESTADO = "_examen_agente_estado.json";
const TECHO = 1.00;          // el autorizado por el owner
const RESERVA = 0.26;        // el peor turno medido (corrida 2, t19: US$0.2534) redondeado hacia arriba

const corpus = [];
for (const f of ["_examen1_consolidado.json", "_examen2_consolidado.json", "_examen3_consolidado.json", "_examen4_consolidado.json"]) {
  const j = JSON.parse(fs.readFileSync(f, "utf8"));
  for (const t of (j.turnos || [])) corpus.push({ bloque: "A", q: t.pregunta || t.q });
}
const B = [
  "cuanto me compro falabella el ultimo mes",
  "cuánto le vendí a Lider en julio?",
  "muéstrame la venta de Jumbo mes a mes",
  "cuánto me compró Tottus en diciembre",
].map((q) => ({ bloque: "B", q }));
const C = [
  "que hago con falabella?",
  "llamame jc de ahora en adelante. como viene mi margen?",
  "mejor decime wachin. y el inventario como esta?",
  "ponele que el año que viene crezco 3%: cuanto seria mi venta?",
].map((q) => ({ bloque: "C", q }));

/* ⚠️ B Y C VAN PRIMERO. Son el PROPÓSITO del examen (la grieta que motivó el agente y las invariantes del
 * contrato); el corpus es la vara de regresión. En la corrida 2 el corpus se comió el presupuesto y B/C
 * quedaron SIN MEDIR — un examen que no llega a lo que vino a probar no es un examen. Si el freno corta, corta
 * redundancia de regresión, nunca propósito. */
const TURNOS = [...B, ...C, ...corpus];

const log = (s) => { fs.appendFileSync(LOG, s + "\n"); console.log(s); };
fs.writeFileSync(LOG, `EXAMEN DEL AGENTE · CORRIDA 3 (post P1-P4) · ${TURNOS.length} turnos (B=4 C=4 A=${corpus.length}) · techo US$${TECHO} · reserva por turno US$${RESERVA}\n`);

const consola = (args) => execFileSync("node", ["_consola_examen.mjs", "--agente", ...args], { encoding: "utf8", timeout: 240000 });

log(consola(["--reset", "--titulo", "Examen Agente 3 · post P1-P4"]));
log(consola(["--sello"]));

let acum = 0;
for (const [i, t] of TURNOS.entries()) {
  /* EL FRENO, ANTES DE GASTAR: si lo que queda no paga un turno del peor caso, se para acá. */
  if (acum + RESERVA > TECHO) {
    log(`\n■ FRENO PREVENTIVO: acumulado US$${acum.toFixed(4)} + reserva US$${RESERVA} > techo US$${TECHO}.`);
    log(`   No se arranca el turno ${i + 1}/${TURNOS.length} — el techo autorizado NO se supera.`);
    break;
  }
  log(`\n══════ TURNO ${i + 1}/${TURNOS.length} · BLOQUE ${t.bloque} ══════`);
  log(`» ${t.q}`);
  try {
    log(consola(["--frenar-en-vacia", t.q]));
  } catch (e) {
    log(`✗ TURNO CON ERROR: ${String(e.message || e).slice(0, 300)}`);
    log(String(e.stdout || "").slice(-800));
  }
  try {
    const s = JSON.parse(fs.readFileSync(ESTADO, "utf8"));
    acum = s.costoUSD || 0;
    log(`   [acumulado: US$${acum.toFixed(4)} · llamadas: ${s.llamadas}]`);
  } catch { log("   [estado ilegible — freno por precaución]"); break; }
}
log(`\n══════ FIN · costo total US$${acum.toFixed(4)} de US$${TECHO} autorizados ══════`);
