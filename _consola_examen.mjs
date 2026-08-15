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

/* ── EL SELLO DE VERSIÓN (owner 2026-08-14) ───────────────────────────────────────────────────────────────────
 * «Antes de medir, confirma explícitamente: versión de código servida · ruta que respondió · bloque [[CALCULO]]
 * oculto · rastro interno activo.» Y no es una formalidad: el servidor de desarrollo estuvo sirviendo MÓDULOS
 * VIEJOS, así que respuestas en vivo se midieron contra código anterior al arreglo. La versión no se DECLARA: se
 * PRUEBA, ejercitando las reglas nuevas contra el muro cargado en este proceso. Todo offline, cero costo. */
import { execSync } from "node:child_process";
import { guardC } from "./src/adi/oracle/guardC.js";
import { cifrasDelDato } from "./src/adi/oracle/datoProyectado.js";
import { axisEntityNames } from "./src/adi/oracle/entityIndex.js";
import { CONTRATO_CALCULO_NATURAL } from "./src/adi/oracle/naturalPrompt.js";
function _sello() {
  const commit = (() => { try { return execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim(); } catch { return "(sin git)"; } })();
  // `numberGuard.js` y `entityGuard.js` son trabajo sin commitear de OTRA sesión (CLAUDE.md §3: no se tocan ni se
  // commitean). Aparecen sucios siempre; contarlos convertiría la alarma en ruido y dejaría de significar nada.
  const sucio = (() => {
    try {
      return execSync("git status --porcelain src/adi/oracle src/adi/llm src/ui", { encoding: "utf8" })
        .split(/\r?\n/).filter((l) => l.trim() && !/numberGuard\.js|entityGuard\.js/.test(l)).join(" · ");
    } catch { return ""; }
  })();
  const ejes = (a) => a.flatMap((e) => { try { return axisEntityNames(e); } catch { return []; } });
  const CTX = { ledger: { figs: [] }, results: [], trace: null, question: "clientes bajo benchmark",
    datoProyectado: cifrasDelDato("actual"), entidadesDelTenant: ejes(["cliente", "sku", "marca"]),
    duenosDelTenant: ejes(["cliente", "sku", "marca", "familia", "bodega", "canal"]), contentScope: "full", tablePolicy: "auto" };
  const M = "[[CALCULO]]";
  // (1) el contrato EXIGE dueño · (2) la cifra de otro dueño no se lava con un cálculo · (3) el prompt lo pide
  const sinDueno = guardC(`El negocio subiría a $104.0M.\n\n${M}\nid=c1 · op=aplicar_pct · inputs=$100.0M; 4% · formula=$100.0M + 4% · resultado=$104.0M · unidad=money`, CTX);
  const ajena = guardC(`Lider vendió $17.8M en el año.\n\n${M}\nid=c1 · op=sumar · inputs=$19.4M; $17.8M · formula=suma · resultado=$37.2M · unidad=money · dueno=total`, CTX);
  const conDueno = guardC(`El negocio subiría a $104.0M.\n\n${M}\nid=c1 · op=aplicar_pct · inputs=$100.0M; 4% · formula=$100.0M + 4% · resultado=$104.0M · unidad=money · dueno=total`, CTX);
  const P = (b) => (b ? "✅" : "🔴");
  return [
    `┌── SELLO DE VERSIÓN ──────────────────────────────────────────────`,
    `│ commit           : ${commit}${sucio ? "  ⚠️ con cambios sin commitear en el motor" : "  (motor limpio)"}`,
    `│ ruta             : camino natural REAL (answerViaNatural + gateway con modoNatural) — no hay otra en esta consola`,
    `│ contrato · dueño : ${P(!sinDueno.ok && /campo «dueño»/.test(String((sinDueno.violations[0] || {}).detail || "")))} sin dueño la cuenta NO autoriza  ·  ${P(conDueno.ok)} con dueño sí`,
    `│ atribución       : ${P(!ajena.ok)} la cifra de otro dueño NO se lava con un cálculo (obtuvo ${ajena.ok ? "PASÓ 🔴" : ajena.verdict})`,
    `│ prompt del cerebro: ${P(/dueno=<de QUIÉN/.test(CONTRATO_CALCULO_NATURAL))} el contrato que lee el modelo pide el dueño`,
    `│ rastro interno   : ✅ activo (estado · vetos · reparaciones · cálculos · [[CALCULO]] oculto, por turno)`,
    `└──────────────────────────────────────────────────────────────────`,
  ].join("\n");
}

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
/* ⚠️ EL RESET TIENE QUE GUARDARSE (medido 2026-08-14 en la 2ª corrida del examen 1): `--reset` sin pregunta
 * armaba el estado nuevo EN MEMORIA y salía por la puerta del «Uso:» sin escribir el archivo — así que el examen
 * siguiente arrancaba con el hilo viejo adentro y el turno 1 se corría con cinco turnos de contexto ajeno. */
if (!q && flag("--sello")) { console.log(_sello()); process.exit(0); }
if (!q && flag("--reset")) { fs.writeFileSync(ESTADO, JSON.stringify(S, null, 2)); console.log(`${_sello()}\n《 ${S.titulo} 》 estado en blanco: 0 turnos.`); process.exit(0); }
if (!q) { console.log("Uso: node _consola_examen.mjs \"la pregunta\"  ·  --reset --titulo \"…\"  ·  --estado"); process.exit(1); }

const DATO = proyectarDatoNegocio("actual");
const TARIFA = Object.entries(MODEL_PRICING).find(([k]) => /sonnet/i.test(k));
const _precio = (u) => {
  if (!u || !TARIFA) return 0;
  const inN = (u.input_tokens || 0), cr = (u.cache_read_input_tokens || 0), cw = (u.cache_creation_input_tokens || 0);
  return (inN * TARIFA[1].in + cr * TARIFA[1].in * 0.1 + cw * TARIFA[1].in * 1.25 + (u.output_tokens || 0) * TARIFA[1].out) / 1e6;
};

/* EL EXPEDIENTE DEL TURNO (2026-08-14): cuando un turno cae al suplente, el veredicto solo dice el NOMBRE del
 * veto — y con eso no se puede reparar nada: hay que ver el borrador que el notario rechazó y la multa exacta
 * que se le devolvió. Se captura acá, en el caller, sin tocar una línea del producto. */
const EXPEDIENTE = () => `_examen_debug_t${S.turnos.length}.json`;   // uno por turno: el del turno 2 no pisa al del 1
let costoTurno = 0, llamadasTurno = 0, crudoUltimo = "";
const intentos = [];
const callNatural = async ({ mensajes, attempt, motivoReintento }) => {
  llamadasTurno++;
  const ultimo = mensajes.length ? mensajes[mensajes.length - 1] : null;
  const nr = await handleNarrateC({ payload: { modoNatural: true, mensajes }, mem: S.mem, attempt, motivoReintento, datoNegocio: DATO });
  if (nr && nr.usage) costoTurno += _precio(nr.usage);
  if (!nr.ok) throw new Error(nr.error || "gateway sin narración");
  crudoUltimo = nr.narration || "";
  intentos.push({ intento: llamadasTurno, motivoReintento: motivoReintento || null, multaRecibida: attempt > 0 && ultimo ? ultimo.content : null, borrador: crudoUltimo });
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
fs.writeFileSync(EXPEDIENTE(), JSON.stringify({ q, estado: nat.estado, vetos: nat.vetos, intentos }, null, 2), "utf8");
// si el turno NO salió del cerebro, se muestra en pantalla POR QUÉ: el último borrador rechazado y la multa que
// se le devolvió. Sin esto, un «suplente» es un callejón sin salida para quien tiene que arreglarlo.
if (nat.suplenteDigno && intentos.length) {
  const ult = intentos[intentos.length - 1];
  console.log(`\n┌── EL BORRADOR QUE EL NOTARIO RECHAZÓ (intento ${ult.intento} de ${intentos.length}) ─────────`);
  console.log(String(ult.borrador || "").split("\n").slice(-24).map((l) => "│ " + l).join("\n"));
  if (ult.multaRecibida) {
    const m = String(ult.multaRecibida).match(/\[[a-z-]+\][\s\S]*/);
    console.log(`├── LA MULTA QUE SE LE DEVOLVIÓ ANTES DE ESE BORRADOR ─────────────`);
    console.log(String(m ? m[0] : ult.multaRecibida).split("\n").slice(0, 8).map((l) => "│ " + l).join("\n"));
  }
  console.log(`└── expediente completo en ${EXPEDIENTE()} ──────────────────────`);
}
