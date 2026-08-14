/* === _consola_examen.mjs · LA CONSOLA DEL EXAMEN EN AMBIENTE CONTROLADO (owner 2026-08-14) ====================
 * «Prefiero que lo corramos juntos desde el panel/código, con el camino natural activo en ambiente controlado,
 * para que tú veas el veredicto interno y yo vea la respuesta como usuario.»
 *
 * QUÉ CORRE: el camino natural REAL —`answerViaNatural` (el mismo que ChatADI invoca con el flag ON) contra el
 * gateway REAL con `modoNatural`—. No es un arnés paralelo: es exactamente lo que va a producción.
 *
 * QUÉ MUESTRA, por turno: la RESPUESTA VISIBLE (lo que vería el usuario en pantalla) y el VEREDICTO INTERNO
 * (estado · vetos · reparaciones · suplente · vacías · cálculos declarados · alcance heredado · re-cita · costo),
 * más la verificación de que el bloque [[CALCULO]] quedó oculto.
 *
 * EL ESTADO PERSISTE entre invocaciones (`_examen_estado.json`): el hilo se construye turno a turno, como una
 * conversación real. `--reset` empieza de cero; `--titulo "…"` rotula el examen en curso.
 *
 * USO:  node _consola_examen.mjs "la pregunta"
 *       node _consola_examen.mjs --reset --titulo "Examen 1 · clientes y margen"
 *       node _consola_examen.mjs --estado          (resumen del hilo sin gastar)
 * ⚠️ GASTA: cada turno son 1-2 llamadas a Sonnet. Solo con autorización del owner. */
import fs from "fs";
for (const ln of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = ln.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
process.env.LLM_PROVIDER = "anthropic";
delete process.env.LLM_MODEL_PARSE;
delete process.env.LLM_MODEL_NARRATE;

import { answerViaNatural } from "./src/adi/oracle/caminoNatural.js";
import { handleNarrateC } from "./src/adi/llm/gatewayCore.js";
import { proyectarDatoNegocio } from "./src/adi/oracle/datoProyectado.js";
import { MARCA_CALCULO } from "./src/adi/oracle/narrationBlocks.js";
import { MODEL_PRICING } from "./src/adi/llm/modelPricing.js";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
initTenant(TENANT_DEMO);

const ESTADO = "_examen_estado.json";
const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const valor = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };

let S = fs.existsSync(ESTADO) ? JSON.parse(fs.readFileSync(ESTADO, "utf8")) : null;
if (flag("--reset") || !S) S = { titulo: valor("--titulo") || "sin título", history: [], mem: {}, turnos: [], costoUSD: 0, llamadas: 0 };
if (valor("--titulo")) S.titulo = valor("--titulo");

if (flag("--estado")) {
  console.log(`《 ${S.titulo} 》 ${S.turnos.length} turnos · ${S.llamadas} llamadas · US$${S.costoUSD.toFixed(4)}`);
  for (const [i, t] of S.turnos.entries()) console.log(`  ${i + 1}. [${t.estado}${t.vetos.length ? " · " + t.vetos.join("|") : ""}] ${t.q.slice(0, 70)}`);
  process.exit(0);
}
const q = args.find((a) => !a.startsWith("--") && args[args.indexOf(a) - 1] !== "--titulo");
if (!q) { console.log("Uso: node _consola_examen.mjs \"la pregunta\"  ·  --reset --titulo \"…\"  ·  --estado"); process.exit(1); }

const DATO = proyectarDatoNegocio("actual");
const TARIFA = Object.entries(MODEL_PRICING).find(([k]) => /sonnet/i.test(k));
const _precio = (u) => {
  if (!u || !TARIFA) return 0;
  const inN = (u.input_tokens || 0), cr = (u.cache_read_input_tokens || 0), cw = (u.cache_creation_input_tokens || 0);
  return (inN * TARIFA[1].in + cr * TARIFA[1].in * 0.1 + cw * TARIFA[1].in * 1.25 + (u.output_tokens || 0) * TARIFA[1].out) / 1e6;
};

let costoTurno = 0, llamadasTurno = 0, crudoUltimo = "";
const callNatural = async ({ mensajes, attempt, motivoReintento }) => {
  llamadasTurno++;
  const nr = await handleNarrateC({ payload: { modoNatural: true, mensajes }, mem: S.mem, attempt, motivoReintento, datoNegocio: DATO });
  if (nr && nr.usage) costoTurno += _precio(nr.usage);
  if (!nr.ok) throw new Error(nr.error || "gateway sin narración");
  crudoUltimo = nr.narration || "";
  return nr.narration;
};

const t0 = Date.now();
let out;
try { out = await answerViaNatural({ text: q, history: S.history, mem: S.mem, scenario: "actual", callNatural }); }
catch (e) { console.log(`\n🔴 EL CAMINO NATURAL LANZÓ: ${String(e && e.message).slice(0, 160)}\n   (en producción, este turno caería al camino actual sin que el usuario vea el error)`); process.exit(1); }

const nat = (out.r && out.r.natural) || {};
const visible = String(out.r.text || "");
S.history = S.history.concat([{ role: "user", text: q }, { role: "adi", text: visible }]);
S.mem = out.mem || S.mem;
S.costoUSD += costoTurno; S.llamadas += llamadasTurno;
S.turnos.push({ q, estado: nat.estado || "?", vetos: nat.vetos || [], costoUSD: costoTurno, visible });
fs.writeFileSync(ESTADO, JSON.stringify(S, null, 2), "utf8");

console.log(`\n╔═══ ${S.titulo} · turno ${S.turnos.length} ═══╗`);
console.log(`❯ ${q}\n`);
console.log("┌── LO QUE VE EL USUARIO ──────────────────────────────────────────");
console.log(visible.split("\n").map((l) => "│ " + l).join("\n"));
console.log("└──────────────────────────────────────────────────────────────────");
const fugaCalc = visible.includes(MARCA_CALCULO) || /\bid=c\d+\s*·|\bop=[a-z_]+\s*·/.test(visible);
console.log(`\n┌── EL VEREDICTO INTERNO ──────────────────────────────────────────`);
console.log(`│ estado           : ${nat.estado || "?"}${nat.suplenteDigno ? "  ⚠️ respondió el SUPLENTE DIGNO" : ""}`);
console.log(`│ vetos            : ${(nat.vetos || []).length ? nat.vetos.join("  ·  ") : "ninguno"}`);
console.log(`│ reparaciones     : ${nat.reparaciones ?? (nat.estado === "reparado" ? 1 : 0)}`);
console.log(`│ vacías           : ${(nat.vacias || []).length ? nat.vacias.join(",") : "0"}`);
console.log(`│ cálculos declar. : ${nat.calculosDeclarados ?? "—"}`);
console.log(`│ alcance heredado : ${nat.alcanceHeredado ? JSON.stringify(nat.alcanceHeredado.entities || nat.alcanceHeredado) : "—"}`);
console.log(`│ re-cita en mem   : ${(S.mem.recitaAprobada && S.mem.recitaAprobada.figs && S.mem.recitaAprobada.figs.length) || 0} cifras aprobadas`);
console.log(`│ [[CALCULO]]      : ${fugaCalc ? "🔴 FUGA — el bloque llegó a pantalla" : "✅ oculto"}${crudoUltimo.includes(MARCA_CALCULO) ? " (el cerebro SÍ lo declaró)" : " (el cerebro no lo declaró este turno)"}`);
console.log(`│ llamadas · costo : ${llamadasTurno} · US$${costoTurno.toFixed(4)}   ·   acumulado: ${S.llamadas} · US$${S.costoUSD.toFixed(4)}`);
console.log(`│ tiempo           : ${((Date.now() - t0) / 1000).toFixed(1)}s`);
console.log(`└──────────────────────────────────────────────────────────────────`);
