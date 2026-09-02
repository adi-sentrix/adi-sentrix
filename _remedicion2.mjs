/* === _remedicion2.mjs · los 2 turnos que el freno dejó fuera (owner 2026-09-02: «vamos por B», ≈US$0.04) === */
import fs from "node:fs";
import { execFileSync } from "node:child_process";
const TECHO = 1.3598, RESERVA = 0.02, GASTADO_ANTES = 1.3098;   // tope de tanda US$0.05 sobre el ≈0.04 del owner
const ESTADO = "_examen_agente_estado.json", LOG = "_remedicion2_run.log";
const P = "C:/Users/jcnav/Downloads/Plantilla_ADI_v2_";
const TANDAS = [
  { id: "parcial-T4", planilla: P + "parcial_10_clientes_ajustada.xlsx", q: "mejores y peores puntos de venta",
    pass: "nombra que la columna «punto de venta» vino vacía + alternativa — NO responde por clientes sin avisar" },
  { id: "demo-T6", planilla: null, q: "Compara Q1 vs Q2 en ventas, margen y contribución. Si no está en la carpeta, dilo.",
    pass: "límite honesto del trimestre + alternativa — cero menú de labels internos" },
];
const log = (s) => { fs.appendFileSync(LOG, s + "\n"); console.log(s); };
const consola = (a) => execFileSync("node", ["_consola_examen.mjs", "--agente", ...a], { encoding: "utf8", timeout: 240000 });
const costo = () => { try { return JSON.parse(fs.readFileSync(ESTADO, "utf8")).costoUSD || 0; } catch { return 0; } };
fs.writeFileSync(LOG, `RE-MEDICIÓN 2 · tope tanda US$${(TECHO - GASTADO_ANTES).toFixed(2)} · reserva US$${RESERVA}\n`);
let gastado = GASTADO_ANTES;
for (const t of TANDAS) {
  if (gastado + RESERVA > TECHO) { log(`■ FRENO: no arranca ${t.id}.`); break; }
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
