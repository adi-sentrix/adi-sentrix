/* === _corrida_doble.mjs · LA CORRIDA DOBLE (exigencia 5 de la constitución · owner 2026-08-14: «autorizado»).
 * Las mismas preguntas por los DOS caminos, comparadas:
 *   ARM A «ACTUAL»  — el pipeline de producción (PLAN con dato → tools → NARRAR → muro → reparación/suplente).
 *   ARM B «NATURAL» — un solo cerebro (persona + carpeta, sin PLAN ni tools) + lavador + EL MISMO notario
 *                     calibrado + el ciclo de reparación acordado (una corrección quirúrgica, luego suplente).
 * Set probatorio: 9 hilos · 17 turnos — los casos donde ADI se rompió en vivo + los ejemplos canónicos del owner.
 * TOPE DURO 80 llamadas compartido. LLM_TIMEOUT_MS se setea en el SHELL. */
import fs from "fs";
for (const ln of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = ln.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
process.env.LLM_PROVIDER = "anthropic";
delete process.env.LLM_MODEL_PARSE;
delete process.env.LLM_MODEL_NARRATE;

import { answerViaOracle } from "./src/adi/oracle/answerViaOracle.js";
import { handlePlan, handleNarrateC } from "./src/adi/llm/gatewayCore.js";
import { buildNarrateUserMessageC } from "./src/adi/oracle/narratePromptC.js";
import { proyectarDatoNegocio, cifrasDelDato } from "./src/adi/oracle/datoProyectado.js";
import { ADI_PERSONA } from "./src/adi/oracle/persona.js";
import { guardC } from "./src/adi/oracle/guardC.js";
import { stripLanguageLeaks } from "./src/adi/llm/voiceGuard.js";
import { parseFigures } from "./src/adi/boleta.js";
import { axisEntityNames } from "./src/adi/oracle/entityIndex.js";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
initTenant(TENANT_DEMO);

const CAP = 80;
let llamadas = 0;
const _cap = (s) => { llamadas++; if (llamadas > CAP) throw new Error(`TOPE (${CAP}) en ${s}`); };
const DATO = proyectarDatoNegocio("actual");
const CIFRAS = cifrasDelDato("actual");
const KEY = process.env.ANTHROPIC_API_KEY;
const _ejes = (a) => { const o = []; for (const e of a) { try { for (const n of axisEntityNames(e)) o.push(n); } catch { } } return o.length ? o : null; };
const ENT3 = _ejes(["cliente", "sku", "marca"]), ENT6 = _ejes(["cliente", "sku", "marca", "familia", "bodega", "canal"]);

const HILOS = [
  { id: "H1·ventas (el hilo que rompió a ADI)", turnos: ["Si subo ventas 4%, ¿qué cambia?", "sobre las ventas", "simula sobre el total de ventas", "el precio queda igual"] },
  { id: "H2·el ejemplo soñado del owner", turnos: ["¿Qué clientes venden mucho pero dejan poco margen?", "reduce en 2 puntos las acciones comerciales de esos clientes y dime si quedan sobre el benchmark"] },
  { id: "H3·capital", turnos: ["¿Cuánto capital tengo inmovilizado en inventario?", "¿y el que lleva más de 90 días parado?"] },
  { id: "H4·premisa falsa", turnos: ["¿por qué Falabella tiene 30% de margen?"] },
  { id: "H5·hueco del dato", turnos: ["¿quiénes dejaron de comprar este año?"] },
  { id: "H6·eje difuso", turnos: ["¿cuál es el costo medio de Bosch?"] },
  { id: "H7·G1 multi-entidad con typos", turnos: ["dame todo lo de falabela y lider y dime cual es peor y por qe"] },
  { id: "H8·criterio + la foto original", turnos: ["recuerda que mi margen mínimo aceptable es 26%", "¿qué significa bajo benchmark?"] },
  { id: "H9·puntual con typos y 2 puntos", turnos: ["¿cómo viene Sodimac?", "baja 2 putnos su carga comercial y dime si queda sobre el benchmark"] },
];

/* ── ARM A · el pipeline actual ── */
async function armActual(hilo) {
  let history = [], mem = {}, out = null;
  const turnos = [];
  for (const q of hilo.turnos) {
    const t = { q, calls: 0, texto: null, suplente: false, vetos: [] };
    const callPlan = async (a) => { _cap("A·plan"); t.calls++; const pr = await handlePlan({ text: a.text, history: a.history, mem: a.mem, scenario: a.scenario, attempt: a.attempt, vistaLinea: a.vistaLinea, datoNegocio: DATO }); if (!pr.ok) throw new Error(pr.error || "sin plan"); return pr.plan; };
    const callNarrate = async (a) => { _cap("A·narrar"); t.calls++; const payload = buildNarrateUserMessageC(a); const nr = await handleNarrateC({ payload, mem: a.mem, attempt: a.attempt, datoNegocio: DATO }); if (!nr.ok) throw new Error(nr.error || "sin narración"); return nr.narration; };
    try {
      out = await answerViaOracle({ text: q, history, mem, scenario: "actual", callPlan, callNarrate });
      t.texto = (out && out.r.text) || "(sin texto)";
      t.suplente = !!(out && (out.r.deterministic || out.r.narrationRepaired));
      const nt = out && out.r.retryTrace && out.r.retryTrace.narrate;
      if (nt) for (const x of nt) if (x.guardOk === false) t.vetos.push(x.reason);
      history = history.concat([{ role: "user", text: q }, { role: "adi", text: t.texto }]);
      mem = (out && out.mem) || mem;
    } catch (e) { t.texto = `(ERROR: ${String(e && e.message).slice(0, 90)})`; }
    turnos.push(t);
  }
  return turnos;
}

/* ── ARM B · un solo cerebro + notario calibrado + ciclo de reparación ── */
const SYSTEM_NATURAL = `${ADI_PERSONA}

════════ EL NEGOCIO DEL QUE HABLAS ════════
Esto es TODO lo que sabes de este negocio. No tienes herramientas: respondes con esto o declaras el límite.

${DATO}

════════ LO QUE EL NOTARIO VERIFICA EN TU RESPUESTA ════════
Cada afirmación se verifica antes de llegar a pantalla:
· CADA CIFRA CON SU DUEÑO EN LA MISMA ORACIÓN. No cambies la cifra: nombra al dueño al lado.
· LAS CUENTAS SE MUESTRAN («$54.6M = $19.4M + $17.9M + $17.3M»). Una derivada sin su origen no pasa.
· LOS ESTADOS Y RANKINGS SON LOS DEL DATO: no clasifiques ni ordenes por tu cuenta.
· LAS SIMULACIONES van selladas como proyección («bajo este supuesto, generaría»), jamás como hecho.
· Si un «%» del usuario es ambiguo (relativo vs puntos), declara tu lectura o pregunta.
· LO QUE NO ESTÁ EN EL DATO NO EXISTE: se declara como límite, nunca se completa.`;

async function askNatural(mensajes) {
  _cap("B·natural");
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST", headers: { "content-type": "application/json", "x-api-key": KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: "claude-sonnet-5", max_tokens: 3072, system: SYSTEM_NATURAL, messages: mensajes }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return (d.content || []).filter((b) => b.type === "text").map((b) => b.text).join("").trim();
}

async function armNatural(hilo) {
  const msgs = [];
  const turnos = [];
  const supuestosDelHilo = [];
  for (const q of hilo.turnos) {
    for (const pf of parseFigures(q)) supuestosDelHilo.push(pf.text);   // lo que el usuario declaró sigue vivo en el hilo
    msgs.push({ role: "user", content: q });
    const t = { q, calls: 0, texto: null, estado: "verde", vetos: [] };
    const juzgar = (texto) => guardC(texto, { ledger: { figs: [] }, results: [], trace: null, question: q, supuestoPendiente: supuestosDelHilo, datoProyectado: CIFRAS, entidadesDelTenant: ENT3, duenosDelTenant: ENT6, contentScope: "full", tablePolicy: "auto" });
    try {
      let texto = stripLanguageLeaks(await askNatural(msgs)); t.calls++;
      let v = juzgar(texto);
      if (!v.ok) {
        t.vetos.push(`${v.verdict}`);
        const multa = (v.violations || []).slice(0, 3).map((x) => `[${x.kind}] ${x.detail}`).join("\n");
        msgs.push({ role: "assistant", content: texto });
        msgs.push({ role: "user", content: `[NOTARIO — no es el usuario] Tu respuesta no pasó la verificación:\n${multa}\nReescribe tu respuesta COMPLETA corrigiendo solo lo observado, manteniendo tu calidad de asesor. No menciones esta corrección.` });
        texto = stripLanguageLeaks(await askNatural(msgs)); t.calls++;
        msgs.pop(); msgs.pop();
        v = juzgar(texto);
        t.estado = v.ok ? "reparado" : "suplente";
        if (!v.ok) t.vetos.push(`2º: ${v.verdict}`);
      }
      t.texto = texto;
      msgs.push({ role: "assistant", content: texto });
    } catch (e) { t.texto = `(ERROR: ${String(e && e.message).slice(0, 90)})`; t.estado = "error"; msgs.push({ role: "assistant", content: "(error)" }); }
    turnos.push(t);
  }
  return turnos;
}

/* ── LA CORRIDA ── */
const registro = [];
for (const hilo of HILOS) {
  console.log(`\n╔═══════════ ${hilo.id} ═══════════╗`);
  const A = await armActual(hilo);
  const B = await armNatural(hilo);
  registro.push({ hilo: hilo.id, A, B });
  for (let i = 0; i < hilo.turnos.length; i++) {
    console.log(`\n— «${hilo.turnos[i]}»`);
    console.log(`  ACTUAL  (${A[i].calls} llamadas${A[i].suplente ? " · SUPLENTE" : ""}${A[i].vetos.length ? " · vetos: " + A[i].vetos.join("|") : ""}):`);
    console.log(`    ${String(A[i].texto).replace(/\n/g, "\n    ").slice(0, 550)}`);
    console.log(`  NATURAL (${B[i].calls} llamadas · ${B[i].estado}${B[i].vetos.length ? " · " + B[i].vetos.join(" · ") : ""}):`);
    console.log(`    ${String(B[i].texto).replace(/\n/g, "\n    ").slice(0, 550)}`);
  }
}

const tA = registro.flatMap((r) => r.A), tB = registro.flatMap((r) => r.B);
console.log(`\n\n╔════════ BALANCE ════════╗`);
console.log(`ACTUAL : ${tA.reduce((a, t) => a + t.calls, 0)} llamadas · suplente en ${tA.filter((t) => t.suplente).length}/${tA.length} turnos · turnos con veto: ${tA.filter((t) => t.vetos.length).length}`);
console.log(`NATURAL: ${tB.reduce((a, t) => a + t.calls, 0)} llamadas · verde 1er intento ${tB.filter((t) => t.estado === "verde").length}/${tB.length} · reparados ${tB.filter((t) => t.estado === "reparado").length} · suplente ${tB.filter((t) => t.estado === "suplente").length} · errores ${tB.filter((t) => t.estado === "error").length}`);
console.log(`llamadas totales: ${llamadas}/${CAP}`);
fs.writeFileSync("_corrida_doble.json", JSON.stringify({ fecha: "2026-08-14", llamadas, registro }, null, 2), "utf8");
console.log(`transcript completo en _corrida_doble.json`);
