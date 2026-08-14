/* === _experimento_claude_negocios.mjs · EL EXPERIMENTO DEL OWNER (2026-08-14):
 * «si tú y ADI tuvieran los mismos datos, cómo responderías, cómo se sostiene la calidad».
 *
 * BRAZO A — «Claude de negocios puro»: Sonnet recibe la persona de ADI + la proyección curada del dato
 * (la MISMA que hoy va al narrador) y responde SOLO, sin plan, sin tools, sin boleta, sin muro.
 * BRAZO B — ADI hoy: ya medido (_medir_sesion_owner.json / _medir_respaldo_vivo.json), no se re-gasta.
 *
 * Además de la calidad, mide LO QUE IMPORTA: cada cifra de la respuesta ¿está en el dato o la inventó?
 * (una cifra ausente puede ser invento O una cuenta legítima — se listan para juzgar una por una).
 * TOPE DURO 10 llamadas. */
import fs from "fs";
for (const ln of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = ln.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const KEY = process.env.ANTHROPIC_API_KEY;
if (!KEY) { console.log("sin ANTHROPIC_API_KEY"); process.exit(1); }

import { proyectarDatoNegocio } from "./src/adi/oracle/datoProyectado.js";
import { ADI_PERSONA } from "./src/adi/oracle/persona.js";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
initTenant(TENANT_DEMO);

const DATO = proyectarDatoNegocio("actual");
const CAP = 10;
let llamadas = 0;

const SYSTEM = `${ADI_PERSONA}

════════ EL NEGOCIO DEL QUE HABLAS ════════
Esto es TODO lo que sabes de este negocio. No tienes herramientas ni puedes consultar nada más.
Si algo no está acá, no lo sabes: decilo y ofrecé lo que sí podés responder.

${DATO}`;

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
  const txt = (d.content || []).filter((b) => b.type === "text").map((b) => b.text).join("").trim();
  return { txt, ms: Date.now() - t0, usage: d.usage };
}

/* ── AUDITORÍA DE CIFRAS: ¿cada número de la respuesta existe en el dato? ─────────────────────────────
 * Normaliza y busca el valor CRUDO en el texto de la proyección. Una cifra ausente NO es prueba de
 * invento (puede ser una cuenta legítima: «cada punto de margen = $194K»), pero las lista para juzgar. */
const _RE_CIFRA = /\$[\d.,]+[KMB]?|\b\d+[.,]?\d*\s*(?:%|pp|x|d)\b/gi;
function auditarCifras(texto) {
  const enTexto = [...new Set((texto.match(_RE_CIFRA) || []).map((s) => s.trim()))];
  const enDato = [], fuera = [];
  for (const c of enTexto) {
    const nucleo = c.replace(/[$%]|pp|\s/gi, "").replace(",", ".").replace(/^0+/, "");
    (DATO.includes(c) || (nucleo && DATO.includes(nucleo)) ? enDato : fuera).push(c);
  }
  return { total: enTexto.length, enDato: enDato.length, fuera };
}

const registro = [];
const PREGUNTAS = [
  "¿Qué clientes venden mucho pero dejan poco margen?",
  "¿Dónde tengo capital inmovilizado?",
];

console.log("╔══ BRAZO A · CLAUDE DE NEGOCIOS PURO (mismo dato, sin tools, sin muro) ══╗\n");
for (const q of PREGUNTAS) {
  const r = await preguntar([{ role: "user", content: q }]);
  const a = auditarCifras(r.txt);
  registro.push({ q, texto: r.txt, ms: r.ms, auditoria: a, usage: r.usage });
  console.log(`═══ «${q}» · ${(r.ms / 1000).toFixed(1)}s · in ${r.usage.input_tokens} / out ${r.usage.output_tokens}`);
  console.log(`CIFRAS: ${a.enDato}/${a.total} verificadas en el dato${a.fuera.length ? ` · A JUZGAR: ${a.fuera.join(" · ")}` : ""}`);
  console.log(`\n${r.txt}\n`);
}

console.log("\n╔══ EL HILO QUE ROMPIÓ A ADI (multi-turno: pendiente + alcance «el total») ══╗\n");
let msgs = [];
for (const q of ["Si subo ventas 4%, ¿qué cambia?", "sobre las ventas", "simula sobre el total de ventas"]) {
  msgs.push({ role: "user", content: q });
  const r = await preguntar(msgs);
  msgs.push({ role: "assistant", content: r.txt });
  const a = auditarCifras(r.txt);
  registro.push({ q, texto: r.txt, ms: r.ms, auditoria: a, usage: r.usage });
  console.log(`═══ «${q}» · ${(r.ms / 1000).toFixed(1)}s`);
  console.log(`CIFRAS: ${a.enDato}/${a.total} verificadas${a.fuera.length ? ` · A JUZGAR: ${a.fuera.join(" · ")}` : ""}`);
  console.log(`\n${r.txt}\n`);
}

fs.writeFileSync("_experimento_claude_negocios.json", JSON.stringify({ fecha: "2026-08-14", llamadas, datoChars: DATO.length, registro }, null, 2), "utf8");
console.log(`─── llamadas: ${llamadas}/${CAP} · dato: ${DATO.length} chars · transcript en _experimento_claude_negocios.json`);
