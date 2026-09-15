/* === _adversarial_notario_gate.mjs · EL CONJUNTO ADVERSARIAL DEL NOTARIO (owner 2026-09-14, fase 3) + LA RONDA FUERA DE MUESTRA (fase 5) ═
 * La auditoría sobre los 12 borradores reales quedó limpia (cobertura y precisión 100 %) y eso NO bastaba: seis cazadores escribieron
 * 3.173 frases NUEVAS sobre el demo —verdaderas que el Notario no debe vetar, falsas que debe vetar—, en la sintaxis del modelo, y el
 * Notario recién nivelado dio 25 % de falsos positivos y 57 % de falsos negativos. Tres familias de cierres bajaron eso a 0.1 % · 2.6 %
 * SOBRE ESE CONJUNTO. Y tampoco bastó: una segunda ronda con frases y párrafos que el Notario nunca vio (fase 5, «fuera de muestra»)
 * dio 38 % · 44 % — lo que se cerró por léxico no generaliza. Este gate mide los DOS conjuntos con el contexto completo del bucle
 * (entidades, dueños y ejes del tenant; lavado del texto):
 *   · FP = frases verdaderas con algún veto DE HECHO (las leyes de la casa no cuentan: juzgan la respuesta entera, no una frase);
 *   · FN = frases falsas sin ningún veto de hecho.
 * Objetivo del owner: ≤ 5 % de FP y ≤ 5 % de FN — y vale la medida FUERA DE MUESTRA, no la del conjunto con el que se trabajó.
 * Cada fixture guarda su línea base: el gate se pone rojo por REGRESIÓN contra ella, y cuando `exigir` es true, también si la meta no
 * se cumple. Un rótulo del cazador que resulte falso se corrige en el fixture con su motivo — nunca se ajusta el Notario a un rótulo falso.
 * Cero red: herramientas puras, fixtures en disco. */
import fs from "node:fs";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { ESCENARIO_INICIAL } from "./src/config/scenarios.js";
import { runPlan } from "./src/adi/oracle/toolRunner.js";
import { TOOLS } from "./src/adi/oracle/toolRegistry.js";
import { cajaDelAgente } from "./src/adi/agente/herramientasAgente.js";
import { guardC } from "./src/adi/oracle/guardC.js";
import { cifrasDelDato } from "./src/adi/oracle/datoProyectado.js";
import { playbookPara, pasosDe } from "./src/adi/agente/playbooks/registro.js";
import { partesDelEncargo, pasosDelEncargo } from "./src/adi/agente/encargoCompuesto.js";
import { vetosDeRegistro } from "./src/adi/agente/contratoAgente.js";
import { axisEntityNames } from "./src/adi/oracle/entityIndex.js";
import { stripLanguageLeaks } from "./src/adi/llm/voiceGuard.js";

let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };
initTenant(TENANT_DEMO);
const CAJA = cajaDelAgente(TOOLS);
const _ejes = (lista) => { const o = []; for (const e of lista) { try { for (const n of axisEntityNames(e)) o.push(n); } catch { /* eje sin índice */ } } return o.length ? o : null; };
const _porEje = () => { const o = {}; for (const e of ["cliente", "sku", "marca", "familia", "bodega", "canal"]) { try { const n = axisEntityNames(e); if (n && n.length) o[e] = n; } catch { /* eje sin índice */ } } return o; };
const jueces = new Map();
const juezDe = (pregunta) => {
  if (jueces.has(pregunta)) return jueces.get(pregunta);
  const pb = playbookPara(pregunta, {});
  const rp = runPlan({ intent: "answer", calls: pasosDelEncargo(partesDelEncargo(pregunta), pb ? pasosDe(pb, pregunta, {}) : [], {}).map((p) => ({ tool: p.tool, args: p.args || {} })) }, { scenario: ESCENARIO_INICIAL, maxCalls: 18, preguntaUsuario: pregunta, registry: CAJA });
  const ctx = { ledger: { figs: rp.ledger.figs }, results: rp.results, trace: null, question: pregunta, datoProyectado: cifrasDelDato(ESCENARIO_INICIAL), entidadesDelTenant: _ejes(["cliente", "sku", "marca"]), duenosDelTenant: _ejes(["cliente", "sku", "marca", "familia", "bodega", "canal"]), ejesDelTenant: _porEje(), contentScope: "full" };
  const j = { muro: (t) => { const v = guardC(t, ctx); return v.ok ? [] : (v.violations || []); }, contrato: (t) => vetosDeRegistro(t, { pregunta, figs: rp.ledger.figs, sitio: "cierre" }) };
  jueces.set(pregunta, j);
  return j;
};
const MUESTRA = Number(process.env.ADI_ADVERSARIAL_MUESTRA || 12);
const FIXTURES = [["adversarial-notario-2026-09-14.json", "EL CONJUNTO ADVERSARIAL (con el que se trabajó)"], ["adversarial-notario-oos-2026-09-15.json", "LA RONDA FUERA DE MUESTRA (la medida que vale)"]];
for (const [archivo, titulo] of FIXTURES) {
  const A = JSON.parse(fs.readFileSync(new URL("./fixtures/" + archivo, import.meta.url), "utf8"));
  const J = { P1: juezDe(A.preguntas.P1), P2: juezDe(A.preguntas.P2) };
  /* las leyes de la casa juzgan la respuesta entera, no una frase suelta: no cuentan ni como acierto ni como falso positivo */
  const LEYES = new Set(A.leyes_de_la_casa || []);
  const t0 = Date.now();
  const tot = { pasa: 0, fp: 0, arde: 0, fn: 0 };
  const porLente = {};
  const fallas = [];
  for (const it of A.items) {
    const texto = stripLanguageLeaks(String(it.frase));
    const ctxs = it.contexto === "ambos" ? ["P1", "P2"] : [it.contexto];
    const vetos = [];
    for (const c of ctxs) {
      for (const x of J[c].muro(texto)) if (!LEYES.has(x.kind)) vetos.push(`${c}:${x.kind}`);
      for (const x of J[c].contrato(texto)) if (!LEYES.has(x.regla)) vetos.push(`${c}:${x.regla}`);
    }
    const L = porLente[it.lente] = porLente[it.lente] || { n: 0, mal: 0 };
    L.n++;
    if (it.esperado === "pasa") { tot.pasa++; if (vetos.length) { tot.fp++; L.mal++; fallas.push(`FP ${it.id} · «${it.frase.slice(0, 110)}» → ${[...new Set(vetos)].slice(0, 3).join(", ")}`); } }
    else { tot.arde++; if (!vetos.length) { tot.fn++; L.mal++; fallas.push(`FN ${it.id} · «${it.frase.slice(0, 110)}» (${it.verdad.slice(0, 60)})`); } }
  }
  const fpPct = tot.pasa ? (100 * tot.fp / tot.pasa) : 0, fnPct = tot.arde ? (100 * tot.fn / tot.arde) : 0;
  console.log(`\n${titulo} · ${A.items.length} frases · ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  console.log(`  falsos positivos: ${tot.fp}/${tot.pasa} = ${fpPct.toFixed(1)}%   (meta ≤ 5 %)`);
  console.log(`  falsos negativos: ${tot.fn}/${tot.arde} = ${fnPct.toFixed(1)}%   (meta ≤ 5 %)`);
  for (const [l, x] of Object.entries(porLente)) console.log(`  ${l.padEnd(18)} ${String(x.mal).padStart(3)}/${x.n} mal (${(100 * x.mal / x.n).toFixed(1)}%)`);
  if (fallas.length) { console.log(`  fallas (${fallas.length}; muestra de ${Math.min(MUESTRA, fallas.length)} — ADI_ADVERSARIAL_MUESTRA=N para ver más):`); for (const f of fallas.slice(0, MUESTRA)) console.log("   - " + f); }
  const base = A.linea_base || { fp: tot.fp, fn: tot.fn };
  ok(tot.fp <= base.fp && tot.fn <= base.fn, `${archivo}: sin regresión contra la línea base (FP ${base.fp} · FN ${base.fn}): hoy FP ${tot.fp} · FN ${tot.fn}`);
  if (A.exigir) ok(fpPct <= 5 && fnPct <= 5, `${archivo}: la meta del owner (≤ 5 % · ≤ 5 %): hoy ${fpPct.toFixed(1)} % · ${fnPct.toFixed(1)} %`);
  else ok(true, `${archivo}: la meta (≤ 5 % · ≤ 5 %) todavía no se exige acá: hoy ${fpPct.toFixed(1)} % de falsos positivos · ${fnPct.toFixed(1)} % de falsos negativos`);
}
console.log(`\n── _adversarial_notario_gate: ${PASS} PASS · ${FAIL} FAIL (de ${PASS + FAIL}) ──`);
process.exit(FAIL ? 1 : 0);
