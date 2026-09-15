/* === _auditoria_notario_gate.mjs · LA AUDITORÍA FOCALIZADA DEL NOTARIO (owner 2026-09-14) ═════════════════════════════
 * «Agente y Notario tienen que avanzar juntos.» El conjunto de referencia son los 12 borradores reales de las 6 corridas
 * vivas de la v2.31 (`fixtures/auditoria-notario-2026-09-14.json`), leídos a mano contra la boleta: los ERRORES REALES que un
 * Notario debe detener y los FALSOS POSITIVOS que emitió sobre afirmaciones correctas. Este gate mide, con el producto actual:
 *   · cobertura = errores reales detectados / errores reales;
 *   · precisión = vetos de hecho correctos / (correctos + falsos positivos vigentes);
 * y SOLO se pone rojo por una REGRESIÓN: un error que ya se detectaba deja de detectarse, o un falso positivo cerrado vuelve.
 * Los huecos abiertos (`detectado_hoy: false`, `cerrado: false`) se listan como pendientes: son el trabajo, no un fallo del
 * gate — cuando todos queden en verde, la auditoría está limpia. Las leyes de la casa (intención, densidad, juicio sin marcar,
 * vocabulario) se cuentan aparte: no son errores de hecho. Cero red: herramientas puras, cerebro mudo, fixtures en disco. */
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
const H = (t) => console.log(`\n${t}`);
initTenant(TENANT_DEMO);
const CAJA = cajaDelAgente(TOOLS);
const _ejes = (lista) => { const o = []; for (const e of lista) { try { for (const n of axisEntityNames(e)) o.push(n); } catch { /* eje sin índice */ } } return o.length ? o : null; };
/* y el catálogo POR EJE (`ejesDelTenant`, fronteras del Notario 2026-09-14): el mismo contexto que el bucle le pasa al muro en
 * la corrida en vivo — la medida se toma en la condición real, no en una más blanda */
const _porEje = () => { const o = {}; for (const e of ["cliente", "sku", "marca", "familia", "bodega", "canal"]) { try { const n = axisEntityNames(e); if (n && n.length) o[e] = n; } catch { /* eje sin índice */ } } return o; };
const A = JSON.parse(fs.readFileSync(new URL("./fixtures/auditoria-notario-2026-09-14.json", import.meta.url), "utf8"));
const jueces = new Map();
const juezDe = (pregunta) => {
  if (jueces.has(pregunta)) return jueces.get(pregunta);
  const pb = playbookPara(pregunta, {});
  const rp = runPlan({ intent: "answer", calls: pasosDelEncargo(partesDelEncargo(pregunta), pb ? pasosDe(pb, pregunta, {}) : [], {}).map((p) => ({ tool: p.tool, args: p.args || {} })) }, { scenario: ESCENARIO_INICIAL, maxCalls: 18, preguntaUsuario: pregunta, registry: CAJA });
  const j = {
    muro: (t) => { const v = guardC(t, { ledger: { figs: rp.ledger.figs }, results: rp.results, trace: null, question: pregunta, datoProyectado: cifrasDelDato(ESCENARIO_INICIAL), entidadesDelTenant: _ejes(["cliente", "sku", "marca"]), duenosDelTenant: _ejes(["cliente", "sku", "marca", "familia", "bodega", "canal"]), ejesDelTenant: _porEje(), contentScope: "full" }); return v.ok ? [] : (v.violations || []); },
    contrato: (t, sitio) => vetosDeRegistro(t, { pregunta, figs: rp.ledger.figs, sitio }),
  };
  jueces.set(pregunta, j);
  return j;
};

H("LOS 12 BORRADORES REALES, CON EL NOTARIO ACTUAL");
let detectados = 0, errores = 0, fpVigentes = 0, fpTotal = 0, regresiones = 0;
const pendientes = [];
for (const c of A.corpus) {
  const F = JSON.parse(fs.readFileSync(new URL("./fixtures/" + c.fixture, import.meta.url), "utf8"));
  const texto = stripLanguageLeaks(String(F.borradores[c.borrador - 1].texto));
  const J = juezDe(F.pregunta);
  const vetos = [...J.muro(texto).map((x) => `${x.kind}: ${x.detail}`), ...J.contrato(texto, c.sitio).map((x) => `${x.regla}: ${x.multa}`)];
  const hay = (clave) => vetos.some((v) => new RegExp(clave, "i").test(v));
  const det = c.errores_reales.filter((e) => hay(e.clave));
  const fps = c.falsos_positivos.filter((e) => hay(e.clave));
  errores += c.errores_reales.length; detectados += det.length; fpTotal += c.falsos_positivos.length; fpVigentes += fps.length;
  for (const e of c.errores_reales) { if (e.detectado_hoy && !hay(e.clave)) regresiones++; if (!hay(e.clave)) pendientes.push(`${c.id}·${c.sitio} · no detecta: «${e.texto.slice(0, 90)}» (${e.tipo})`); }
  for (const e of c.falsos_positivos) { if (e.cerrado && hay(e.clave)) regresiones++; if (hay(e.clave)) pendientes.push(`${c.id}·${c.sitio} · falso positivo vigente: «${e.texto.slice(0, 90)}» (${e.kind})`); }
  console.log(`  ${c.id} · ${c.sitio.padEnd(10)} errores reales ${String(det.length).padStart(1)}/${c.errores_reales.length} detectados · falsos positivos vigentes ${fps.length}/${c.falsos_positivos.length} · leyes de la casa: ${c.leyes_de_la_casa.length} · vetos hoy: ${vetos.map((v) => v.split(":")[0]).join(", ") || "ninguno"}`);
}
H("MEDIDA");
const cobertura = errores ? Math.round((detectados / errores) * 100) : 100;
const precision = (detectados + fpVigentes) ? Math.round((detectados / (detectados + fpVigentes)) * 100) : 100;
console.log(`  cobertura (errores reales detectados): ${detectados}/${errores} = ${cobertura}%`);
console.log(`  precisión (vetos de hecho correctos entre correctos + falsos positivos vigentes): ${detectados}/${detectados + fpVigentes} = ${precision}%`);
console.log(`  falsos positivos cerrados hoy: ${fpTotal - fpVigentes}/${fpTotal}`);
if (pendientes.length) { console.log(`  PENDIENTES (${pendientes.length}):`); for (const p of pendientes) console.log("   - " + p); }
ok(regresiones === 0, `sin regresiones: nada que ya se detectaba dejó de detectarse, ningún falso positivo cerrado volvió (${regresiones})`);
ok(true, `la auditoría ${pendientes.length ? `sigue ABIERTA: ${pendientes.length} pendientes` : "está LIMPIA"} — cobertura ${cobertura}% · precisión ${precision}%`);
console.log(`\n── _auditoria_notario_gate: ${PASS} PASS · ${FAIL} FAIL (de ${PASS + FAIL}) ──`);
process.exit(FAIL ? 1 : 0);
