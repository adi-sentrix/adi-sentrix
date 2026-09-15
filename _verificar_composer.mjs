/* _verificar_composer.mjs · ¿un composer DECLARA todo lo que escribe, y lo que declara es verdadero? (offline, sin red)
 *   node _verificar_composer.mjs <playbook> ["pregunta"]      → el composer del playbook, con su pregunta canónica (o la dada)
 *   node _verificar_composer.mjs encargo [P1|P2]               → el ensamblador del encargo compuesto (las dos preguntas de producción)
 * Compone DOS veces —sin colector y con colector— y exige el texto byte-idéntico; después juzga el texto con SUS declaraciones
 * (juez semántico, `derivada: false`): cada punto de afirmación de la prosa tiene que estar declarado, y cada declaración,
 * verificada. Salida: medidas y la lista de vetos (0 vetos = el composer cumple el estándar del cerebro).
 * NO es un gate de la suite: es la herramienta con la que se instrumenta composer por composer. */
import fs from "node:fs";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { ESCENARIO_INICIAL } from "./src/config/scenarios.js";
import { runPlan } from "./src/adi/oracle/toolRunner.js";
import { TOOLS } from "./src/adi/oracle/toolRegistry.js";
import { cajaDelAgente } from "./src/adi/agente/herramientasAgente.js";
import { cifrasDelDato } from "./src/adi/oracle/datoProyectado.js";
import { axisEntityNames } from "./src/adi/oracle/entityIndex.js";
import { PLAYBOOKS, pasosDe } from "./src/adi/agente/playbooks/registro.js";
import { partesDelEncargo, pasosDelEncargo, componerEncargo } from "./src/adi/agente/encargoCompuesto.js";
import { pasosDeDominios, dominiosDe, unirPasosDeDominios } from "./src/adi/agente/contratoDeDominios.js";
import { crearDeclarador, filtrarPorTexto } from "./src/adi/notario/declarar.js";
import { juzgarDeclaracion } from "./src/adi/notario/juez.js";

initTenant(TENANT_DEMO);
const CAJA = cajaDelAgente(TOOLS);
const ejes = (() => { const o = {}; for (const e of ["cliente", "sku", "marca", "familia", "bodega", "canal"]) { try { const n = axisEntityNames(e); if (n && n.length) o[e] = n; } catch { /* sin índice */ } } return o; })();
const PREG = JSON.parse(fs.readFileSync(new URL("./fixtures/adversarial-notario-2026-09-14.json", import.meta.url), "utf8")).preguntas;
const CANONICAS = Object.fromEntries(partesDelEncargo(PREG.P1).map((p) => [p.playbook ? p.playbook.nombre : p.local.nombre, p.pregunta]));
const leerCon = (pasos, q) => (runPlan({ intent: "answer", calls: (pasos || []).map((s) => ({ tool: s.tool, args: s.args || {} })) }, { scenario: ESCENARIO_INICIAL, maxCalls: 18, preguntaUsuario: q, registry: CAJA }).ledger || {}).figs || [];

const [que, arg] = process.argv.slice(2);
if (!que) { console.log("uso: node _verificar_composer.mjs <playbook|encargo> [pregunta|P1|P2]"); process.exit(2); }
let texto1, texto2, decl, figs, pregunta;
if (que === "encargo") {
  pregunta = PREG[arg || "P1"];
  const partes = partesDelEncargo(pregunta);
  const leer = (pasos) => leerCon(pasos, pregunta);
  figs = leerCon(unirPasosDeDominios(pasosDelEncargo(partes, [], {}), pasosDeDominios(dominiosDe(pregunta))), pregunta);
  const base = { partes, leer, scenario: ESCENARIO_INICIAL, mem: {}, semilla: "demo::x::0", pregunta };
  texto1 = componerEncargo(base);
  const D = crearDeclarador();
  texto2 = componerEncargo({ ...base, declarar: D });
  decl = filtrarPorTexto(D.lista(), texto2);
} else {
  const pb = PLAYBOOKS.find((p) => p.nombre === que);
  if (!pb) { console.log(`playbook desconocido: ${que} · disponibles: ${PLAYBOOKS.map((p) => p.nombre).join(", ")}`); process.exit(2); }
  pregunta = arg || CANONICAS[que] || pb.pregunta || "¿Cómo va el negocio?";
  const pasos = pasosDe(pb, pregunta, {});
  figs = leerCon(unirPasosDeDominios(pasos, pasosDeDominios(dominiosDe(pregunta))), pregunta);
  const base = { figs, pregunta, semilla: "demo::x::0", scenario: ESCENARIO_INICIAL, mem: {}, ctx: {} };
  texto1 = pb.componer(base);
  const D = crearDeclarador();
  texto2 = pb.componer({ ...base, declarar: D });
  decl = filtrarPorTexto(D.lista(), texto2);
}
if (!texto1 || !String(texto1).trim()) { console.log(`el composer no compuso nada para «${String(pregunta).slice(0, 60)}»`); process.exit(1); }
console.log(`■ ${que} · pregunta: «${String(pregunta).slice(0, 70)}» · texto: ${String(texto1).length} chars · byte-idéntico con colector: ${texto1 === texto2 ? "SÍ" : "NO ⚠"} · declaraciones: ${decl.length}`);
const J = juzgarDeclaracion(String(texto2), decl.length ? decl : null, { figs, datoProyectado: cifrasDelDato(ESCENARIO_INICIAL), ejesDelTenant: ejes, nombres: Object.values(ejes).flat(), sitio: que, derivada: false });
console.log("  medidas:", JSON.stringify(J.medidas));
for (const v of J.violations) console.log("  ✗", v.kind, "|", v.detail.slice(0, 190));
if (process.argv.includes("--texto")) console.log("\n" + texto2);
if (process.argv.includes("--decl")) for (const d of decl) console.log("  ·", JSON.stringify(d).slice(0, 200));
console.log(`\n${J.ok && texto1 === texto2 ? "✓ cumple el estándar" : "✗ no cumple"} · vetos: ${J.violations.length}`);
process.exit(J.ok && texto1 === texto2 ? 0 : 1);
