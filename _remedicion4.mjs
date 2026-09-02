/* === _remedicion4.mjs · RE-MEDICIÓN de los 4 turnos fallidos de la certificación (owner 2026-09-02) =========
 * «Re-mide solo los turnos fallidos, aprox. US$0.06.» Los 4 son preguntas SIN dependencia de contexto
 * (verificado en sus corridas: ninguna lee el turno anterior), así que cada una corre en un hilo FRESCO con su
 * dataset — medir aislado acá es válido y más limpio.
 * FRENO: TECHO = acumulado (1.2467) + 0.08 de tope duro para esta tanda (el «aprox 0.06» del owner con el peor
 * turno de margen) · RESERVA 0.03 = peor turno playbook observado (0.029, cobranza) redondeado. */
import fs from "node:fs";
import { execFileSync } from "node:child_process";
const TECHO = 1.3267, RESERVA = 0.03, GASTADO_ANTES = 1.2467;
const ESTADO = "_examen_agente_estado.json", LOG = "_remedicion4_run.log";
const P = "C:/Users/jcnav/Downloads/Plantilla_ADI_v2_";
const TANDAS = [
  { id: "completa-T4", planilla: P + "completa_25_clientes_ajustada.xlsx", q: "por punto de venta, ¿quién queda bajo el plan?",
    pass: "dice que el archivo SÍ trae punto de venta pero aún no se analiza por ese eje + alternativa nombrada" },
  { id: "completa-T11", planilla: P + "completa_25_clientes_ajustada.xlsx", q: "dame los 3 riesgos para el directorio",
    pass: "3 riesgos con QUÉ (cifra) · DÓNDE (localiza) · QUÉ HACER PRIMERO (ofrece) — cero menú de rescate" },
  { id: "parcial-T4", planilla: P + "parcial_10_clientes_ajustada.xlsx", q: "mejores y peores puntos de venta",
    pass: "nombra que la columna «punto de venta» vino vacía + alternativa — NO responde por clientes sin avisar" },
  { id: "demo-T6", planilla: null, q: "Compara Q1 vs Q2 en ventas, margen y contribución. Si no está en la carpeta, dilo.",
    pass: "límite honesto del trimestre + alternativa — cero menú de labels internos" },
];
const log = (s) => { fs.appendFileSync(LOG, s + "\n"); console.log(s); };
const consola = (a) => execFileSync("node", ["_consola_examen.mjs", "--agente", ...a], { encoding: "utf8", timeout: 240000 });
const costo = () => { try { return JSON.parse(fs.readFileSync(ESTADO, "utf8")).costoUSD || 0; } catch { return 0; } };
fs.writeFileSync(LOG, `RE-MEDICIÓN · 4 turnos · techo tanda US$${(TECHO - GASTADO_ANTES).toFixed(2)} · reserva US$${RESERVA}\n`);
let gastado = GASTADO_ANTES;
for (const t of TANDAS) {
  if (gastado + RESERVA > TECHO) { log(`■ FRENO: US$${gastado.toFixed(4)} + ${RESERVA} > ${TECHO}. No arranca ${t.id}.`); break; }
  const base = t.planilla ? ["--planilla", t.planilla] : [];
  log(`\n────── ${t.id} ──────\n» ${t.q}\n  PASS: ${t.pass}`);
  log(consola([...base, "--reset", "--titulo", `Re-medición · ${t.id}`]));
  try { log(consola([...base, "--frenar-en-vacia", t.q])); }
  catch (e) { log(`✗ ERROR: ${String(e.message || e).slice(0, 250)}`); }
  gastado += costo();
  try { fs.copyFileSync(ESTADO, `_remedicion_${t.id}.json`); } catch {}
  log(`  [tanda: US$${(gastado - GASTADO_ANTES).toFixed(4)} · TOTAL: US$${gastado.toFixed(4)}]`);
}
log(`\n══ FIN · tanda US$${(gastado - GASTADO_ANTES).toFixed(4)} · acumulado US$${gastado.toFixed(4)} de US$1.68 ══`);
