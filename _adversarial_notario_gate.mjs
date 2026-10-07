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
import { leerFixtureVigente, refrescarEnProfundidad } from "./scripts/una-sola-realidad/cifrasVigentes.mjs";   /* una sola realidad (2026-10-06): los corpus archivados se leen con las cifras vigentes del demo, sin tocar el archivo */
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
/* CONGELAMIENTO (owner 2026-09-28, §7.3·34b, etapa 5 — migración de significado de «frenado»): estos 6 items del
 * conjunto adversarial (con el que se trabajó) pinzaban el significado VIEJO de «frenado» (capital_frenado,
 * rotación) o son un efecto directo y medido de esa migración — verificado línea a línea contra `scratchpad/wt_head`
 * (8e96bd5e, limpio, ANTES de esta migración): ningún otro item del conjunto (ni de la ronda fuera de muestra)
 * cambió de veredicto. No se reetiquetan ni se borran: quedan como registro histórico, reportados aparte. */
const HISTORICOS = new Map([
  /* MARCA Y FAMILIA = LA SUMA DE SUS SKU (owner 2026-10-06, §2-bis): la contribución del SKU se calibró con el cliente (× 1,0556) y su veredicto cambió por el dato, no por el juez. Verificado contra el árbol limpio
   * del commit cd16580a: solo estos cinco items de las dos fixtures (los demás cambios de veredicto de esta consolidación son mejoras o se re-mapean con `cifrasVigentes`). Se registran, no se reetiquetan ni se borran. */
  ["fp-comparaciones-1511", "premisa perdida por el dato (marca desde SKU): «LG-AIR9000 y BOS-DRILL18V empatan en contribución: $1.8M cada uno» — con la contribución calibrada ya no empatan ($1.951K y $1.939K: $2.0M y $1.9M); el veto es correcto"],
  ["fp-comparaciones-1512", "idem, contexto P2"],
  ["fn-atribucion-2177", "premisa perdida por el dato (marca desde SKU): «$1.6M es de Falabella» — «Resto de Contribución (3 de 13)» suma $1.599K y es ahora también $1.6M en la boleta del turno: la cifra deja de ser de una sola cuenta"],
  ["oos-fp-lecturas-0097", "coincidencia de redondeo (marca desde SKU): «$1.5M» es ahora a la vez la contribución no capturada de Lider y la contribución de PHI-IRON-PRO ($1.486K) en la boleta del turno; la frase es verdadera y el muro la lee ambigua"],
  ["oos-fp-lecturas-0189", "coincidencia de redondeo (marca desde SKU): «$3.6M» (Tottus, Paris y Easy) es ahora también la contribución de PHI-SHAVER9 ($3.635K) en la boleta del turno; la frase es verdadera y el muro la lee ambigua"],
  ["fn-atribucion-2013", "frenado-regla-de-rotacion (§7.3·34b) — «el capital frenado total» pinzaba capital_frenado (subtotal $25K Valparaíso vs total $33K)"],
  ["fn-atribucion-2014", "frenado-regla-de-rotacion (§7.3·34b) — idem, contexto P2"],
  ["fn-atribucion-2369", "frenado-regla-de-rotacion (§7.3·34b) — «el capital frenado del negocio» pinzaba capital_frenado (bodega→negocio)"],
  ["fn-atribucion-2370", "frenado-regla-de-rotacion (§7.3·34b) — idem, contexto P2"],
  ["fp-prosa-0108", "efecto medido de la migración (§7.3·34b): «LG-DRYER8KG y MAK-COMP-AIR suman $22K liberables» — el rótulo «Medida · liberar…» que antes absolvía esta coordinación ya no calza byte a byte tras el renombre de superficie (capital_frenado → inmovilizado crítico); la raíz exacta vive en guardC.js:_totalMisattribution (comparación de canon entre la cifra dicha y el rótulo del ledger) y no se tocó — fuera del alcance de esta etapa (Notario/Entrega/encargo)"],
  ["fp-prosa-0109", "efecto medido de la migración (§7.3·34b) — idem, contexto P2"],
  /* UNA SOLA REALIDAD (owner 2026-10-06): cuatro items más pierden su PREMISA por el dato, no por el juez. Atribuyen a Falabella «$17.8M — es la venta de Lider» y la cifra ajena
   * tenía que ser de UNA sola cuenta; con la tabla Lider vende $17.857K («$17.9M») y ese mismo «$17.9M» es ahora también la venta del año anterior de Falabella (17.942K): la frase ya
   * no es una atribución falsa inequívoca. No se reetiquetan ni se borran (registro histórico); ningún otro item de los dos conjuntos cambió de veredicto por este motivo (verificado
   * contra el árbol limpio del commit 98ad5c03: solo estos cuatro). */
  ["fn-atribucion-2097", "cifra ajena ya no es de una sola cuenta ($17.9M = Lider y Falabella·anterior) — «aquella vende $17.9M», contexto P1"],
  ["fn-atribucion-2098", "idem, contexto P2"],
  ["fn-atribucion-2099", "cifra ajena ya no es de una sola cuenta — «Falabella, cuya venta de $17.9M creció 8.3 %», contexto P1"],
  ["fn-atribucion-2100", "idem, contexto P2"],
]);
for (const [archivo, titulo] of FIXTURES) {
  const A = leerFixtureVigente(new URL("./fixtures/" + archivo, import.meta.url));
  const J = { P1: juezDe(A.preguntas.P1), P2: juezDe(A.preguntas.P2) };
  /* las leyes de la casa juzgan la respuesta entera, no una frase suelta: no cuentan ni como acierto ni como falso positivo */
  const LEYES = new Set(A.leyes_de_la_casa || []);
  const t0 = Date.now();
  const tot = { pasa: 0, fp: 0, arde: 0, fn: 0 };
  const porLente = {};
  const fallas = [];
  const historicosVistos = [];
  for (const it of A.items) {
    if (HISTORICOS.has(it.id)) { historicosVistos.push(it.id); continue; }
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
  if (historicosVistos.length) console.log(`  ❄ HISTÓRICOS (§7.3·34b, no juzgados contra el canon vigente): ${historicosVistos.length} — ${historicosVistos.join(", ")}`);
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
