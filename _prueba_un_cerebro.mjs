/* === _prueba_un_cerebro.mjs · LA PRUEBA ESTRICTA (owner 2026-08-14: «hace una prueba y ve si se arregla…
 * quiero naturalidad, es el mismo modelo de Claude, por lo tanto debería responder como él. ¡Estricto!»)
 *
 * EL CAMINO INVERTIDO, completo: Sonnet responde con el dato del negocio en su contexto (SIN plan, SIN tools,
 * SIN boleta) → y encima le corre EL MURO REAL (guardC con la proyección como fuente + catálogo de cálculo)
 * y EL BARRIDO DE VOZ REAL (voiceGuard/stripLanguageLeaks). Cero indulgencia: es el mismo notario que corre
 * en producción, con las mismas fuentes que tendría en el camino invertido.
 *
 * La pregunta que responde este arnés: ¿la respuesta NATURAL sobrevive al notario, o el notario la mata?
 * TOPE DURO 10 llamadas. */
import fs from "fs";
for (const ln of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = ln.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const KEY = process.env.ANTHROPIC_API_KEY;
if (!KEY) { console.log("sin ANTHROPIC_API_KEY"); process.exit(1); }

import { proyectarDatoNegocio, cifrasDelDato } from "./src/adi/oracle/datoProyectado.js";
import { ADI_PERSONA } from "./src/adi/oracle/persona.js";
import { guardC } from "./src/adi/oracle/guardC.js";
import { stripLanguageLeaks } from "./src/adi/llm/voiceGuard.js";
import { axisEntityNames } from "./src/adi/oracle/entityIndex.js";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
initTenant(TENANT_DEMO);

const DATO = proyectarDatoNegocio("actual");
const CIFRAS = cifrasDelDato("actual");
const _ejes = (ejes) => { const o = []; for (const e of ejes) { try { for (const n of axisEntityNames(e)) o.push(n); } catch { /* sin índice */ } } return o.length ? o : null; };
const ENTIDADES = _ejes(["cliente", "sku", "marca"]);
const DUENOS = _ejes(["cliente", "sku", "marca", "familia", "bodega", "canal"]);

const CAP = 10;
let llamadas = 0;

/* El system del camino invertido: la persona de siempre + el dato + LA DISCIPLINA QUE EL MURO COBRA.
 * No se le pide que "sea prolijo": se le dice exactamente qué verifica el notario, que es distinto. */
const SYSTEM = `${ADI_PERSONA}

════════ EL NEGOCIO DEL QUE HABLAS ════════
Esto es TODO lo que sabes de este negocio. No tienes herramientas: respondes con esto o declaras el límite.

${DATO}

════════ LO QUE EL NOTARIO VERIFICA EN TU RESPUESTA ════════
Cada cifra que escribas se verifica contra el dato de arriba antes de llegar a la pantalla. Tres reglas:
· CADA CIFRA CON SU DUEÑO EN LA MISMA ORACIÓN. «Falabella vende $19.4M» pasa; «la venta es $19.4M» en una
  oración que no nombra a Falabella, NO pasa. No cambies la cifra: nombra al dueño al lado.
· LAS CUENTAS SE MUESTRAN. Si sumas, restas o aplicas un porcentaje, decí de dónde sale
  («$54.6M = $19.4M + $17.9M + $17.3M»). Una cifra derivada sin su origen no pasa.
· LO QUE NO ESTÁ EN EL DATO NO EXISTE. No completes con conocimiento general del rubro ni con supuestos
  propios. Si falta, se declara como límite.`;

async function preguntar(mensajes) {
  llamadas++;
  if (llamadas > CAP) throw new Error(`TOPE (${CAP})`);
  const t0 = Date.now();
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: "claude-sonnet-5", max_tokens: 3072, system: SYSTEM, messages: mensajes }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${JSON.stringify(d).slice(0, 200)}`);
  return { txt: (d.content || []).filter((b) => b.type === "text").map((b) => b.text).join("").trim(), ms: Date.now() - t0, usage: d.usage };
}

/* EL NOTARIO REAL, con las fuentes del camino invertido: sin boleta (ledger vacío), sin tools (results vacío),
 * la proyección como fuente de cifras, y el catálogo de entidades/dueños del tenant. */
function auditar(texto, pregunta) {
  const v = guardC(texto, {
    ledger: { figs: [] }, results: [], trace: null, question: pregunta,
    datoProyectado: CIFRAS, entidadesDelTenant: ENTIDADES, duenosDelTenant: DUENOS,
    contentScope: "full", tablePolicy: "auto",
  });
  return v;
}

const registro = [];
async function turno(q, mensajes) {
  const r = await preguntar(mensajes);
  const lavado = stripLanguageLeaks(r.txt);
  const cambioRegistro = lavado !== r.txt;
  const v = auditar(lavado, q);
  registro.push({ q, crudo: r.txt, lavado, cambioRegistro, ok: v.ok, verdict: v.verdict, violations: (v.violations || []).map((x) => `${x.kind}: ${String(x.detail || "").slice(0, 160)}`), ms: r.ms, usage: r.usage });
  console.log(`\n═══ «${q}» · ${(r.ms / 1000).toFixed(1)}s · in ${r.usage.input_tokens} / out ${r.usage.output_tokens}`);
  console.log(`NOTARIO: ${v.ok ? "✅ PASA" : `❌ VETA → ${v.verdict}`}`);
  for (const x of (v.violations || []).slice(0, 4)) console.log(`   · ${x.kind}: ${String(x.detail || "").slice(0, 190)}`);
  console.log(`REGISTRO: ${cambioRegistro ? "⚠️ el barrido tuvo que corregir voz" : "✓ limpio de origen"}`);
  console.log(`\n${lavado}\n`);
  return r.txt;
}

console.log("╔══════ UN SOLO CEREBRO + EL MURO REAL ══════╗");
for (const q of ["¿Qué clientes venden mucho pero dejan poco margen?", "¿Dónde tengo capital inmovilizado?"]) {
  await turno(q, [{ role: "user", content: q }]);
}

console.log("\n╔══════ EL HILO MULTI-TURNO (lo que ADI rompe hoy) ══════╗");
const msgs = [];
for (const q of ["Si subo ventas 4%, ¿qué cambia?", "sobre las ventas", "simula sobre el total de ventas"]) {
  msgs.push({ role: "user", content: q });
  const txt = await turno(q, msgs);
  msgs.push({ role: "assistant", content: txt });
}

const pasan = registro.filter((r) => r.ok).length;
console.log(`\n╔══════ VEREDICTO ══════╗`);
console.log(`Sobrevivieron al notario: ${pasan}/${registro.length}`);
console.log(`Registro limpio de origen: ${registro.filter((r) => !r.cambioRegistro).length}/${registro.length}`);
for (const r of registro.filter((x) => !x.ok)) console.log(`  ✗ «${r.q}» → ${r.verdict}`);
fs.writeFileSync("_prueba_un_cerebro.json", JSON.stringify({ fecha: "2026-08-14", llamadas, registro }, null, 2), "utf8");
console.log(`llamadas: ${llamadas}/${CAP} · transcript en _prueba_un_cerebro.json`);
