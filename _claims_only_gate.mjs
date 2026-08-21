/* === _claims_only_gate.mjs · CONTRATO v2 · MODO CLAIMS-ONLY (owner 2026-08-07, opción (b)) ===========
 * Certifica el modo detrás del flag ADI_CLAIMS_ONLY_ENABLED (APAGADO por defecto):
 *   [1] FLAG APAGADO por defecto — producción sigue con el payload verificado, byte-idéntico.
 *   [2] SIN FUENTES CRUDAS: el payload claims-only NO contiene `datos`, `facts`, `plan`, `results`, `calls`,
 *       `tool`, ni ningún catálogo. Se recorre el árbol ENTERO buscando claves y formas prohibidas — si aparece
 *       una fuente cruda, el gate FALLA (es la prueba que pidió el owner).
 *   [3] CONTIENE lo autorizado: alcance, afirmaciones (con estatus), relaciones, acciones, supuestos, preguntas
 *       abiertas y política de respuesta.
 *   [4] LAS CIFRAS siguen bajo el mismo contrato con guardC (cifras_autorizadas intacto).
 *   [5] EL MODO ACTUAL no se toca: con el flag apagado el payload es el de siempre.
 * Cero red, cero LLM. `node _claims_only_gate.mjs`
 */
import { runPlan } from "./src/adi/oracle/toolRunner.js";
import { buildNarrateUserMessageC, projectClaimsOnlyPayload, projectNarratePayload } from "./src/adi/oracle/narratePromptC.js";
import { buildNarrationContract } from "./src/adi/oracle/narrationContract.js";
import { ADI_CLAIMS_ONLY_ENABLED } from "./src/config/voiceFlags.js";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";

// vía 1 (2026-08-20): el dataset se DECLARA acá. Antes se heredaba del import por defecto de tenantStore,
// que ya no existe: el store arranca en la forma vacía y el dato entra por initTenant. Ver tenantEmpty.js.
initTenant(TENANT_DEMO);

let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };
const H = (t) => console.log("\n" + t);

const PLAN = { intent: "answer", mode: "default", scope: { level: "entity", entities: ["Falabella"] }, calls: [
  { tool: "entityProfile", args: { dimension: "cliente", entity: "Falabella" } },
  { tool: "trend", args: { metric: "ventas", dimension: "cliente", entity: "Falabella" } },
  { tool: "entityComposicion", args: { dimension: "cliente", entity: "Falabella" } },
  { tool: "entityCapitalLigado", args: { dimension: "cliente", entity: "Falabella" } },
] };
const { results, ledger } = runPlan(PLAN, { scenario: "actual" });
const ARGS = { text: "muéstrame el perfil de Falabella", plan: PLAN, results, ledgerFigs: ledger.figs,
  mem: { trato: "vos" }, history: [{ role: "user", text: "hola" }], pref: null, scenario: "actual" };

H("[1] FLAG · apagado por defecto (producción intacta)");
ok(ADI_CLAIMS_ONLY_ENABLED === false, `ADI_CLAIMS_ONLY_ENABLED === false — vale ${ADI_CLAIMS_ONLY_ENABLED}`);
{
  const sinFlag = buildNarrateUserMessageC(ARGS);
  const conFlagExplicito = buildNarrateUserMessageC({ ...ARGS, claimsOnly: true });
  ok("datos" in sinFlag, "sin flag: el payload SIGUE trayendo `datos` (comportamiento verificado en vivo)");
  ok(!("datos" in conFlagExplicito), "con claimsOnly:true: `datos` desaparece");
  ok(JSON.stringify(sinFlag) === JSON.stringify(projectNarratePayload(buildNarrationContract(ARGS))),
    "sin flag el payload sigue siendo byte-idéntico a la proyección normal (Fase 1 intacta)");
}

H("[2] SIN FUENTES CRUDAS · la prueba dura");
{
  const p = projectClaimsOnlyPayload(buildNarrationContract(ARGS));
  // claves PROHIBIDAS en cualquier nivel del árbol
  const PROHIBIDAS = ["datos", "facts", "plan", "results", "calls", "tool", "coverage", "boleta", "rows", "metrics", "composicion", "capitalLigado", "tablaM", "_planCalls", "_fuente"];
  const hallazgos = [];
  const walk = (v, path) => {
    if (Array.isArray(v)) return v.forEach((x, i) => walk(x, `${path}[${i}]`));
    if (v && typeof v === "object") {
      for (const k of Object.keys(v)) {
        if (PROHIBIDAS.includes(k)) hallazgos.push(`${path}.${k}`);
        walk(v[k], `${path}.${k}`);
      }
    }
  };
  walk(p, "payload");
  ok(hallazgos.length === 0, `ninguna clave de fuente cruda en TODO el árbol (${PROHIBIDAS.length} vigiladas)`,
    hallazgos.length ? `encontradas: ${hallazgos.join(", ")}` : "");
  // y tampoco por forma: nada que parezca una fila de dato del motor
  const json = JSON.stringify(p);
  ok(!/"stockUSD"|"pctRebate"|"costoMedio"|"diasSinVenta"|"sfamilia"/.test(json),
    "ninguna COLUMNA cruda del dato (stockUSD/pctRebate/costoMedio/…) se filtra por valor");
  ok(!/"disponible"\s*:/.test(json), "no viaja el shape de `datos` (disponible/motivo/facts)");
}

H("[3] CONTIENE lo autorizado por el contrato");
{
  const p = projectClaimsOnlyPayload(buildNarrationContract(ARGS));
  ok(p.alcance && p.alcance.eje === "cliente" && p.alcance.entidades.includes("Falabella"), `alcance sellado — ${JSON.stringify(p.alcance)}`);
  ok(Array.isArray(p.afirmaciones) && p.afirmaciones.length > 0, `afirmaciones presentes — ${p.afirmaciones.length}`);
  ok(p.afirmaciones.every((a) => a.estatus === "probado" || a.estatus === "indicado"), "TODA afirmación lleva estatus epistémico");
  ok(p.afirmaciones.some((a) => a.entidad && a.metrica && a.valor), "las afirmaciones traen entidad + métrica + valor (el binding completo)");
  ok(p.relaciones_autorizadas && typeof p.relaciones_autorizadas === "object", "relaciones autorizadas presentes");
  ok(Array.isArray(p.acciones_permitidas), "acciones permitidas presentes");
  ok(p.politica_respuesta && p.politica_respuesta.puedeAgregarEntidades === false, "política de respuesta declara qué NO puede agregar");
  ok(Array.isArray(p.politica_respuesta.entidadesPermitidas) && p.politica_respuesta.entidadesPermitidas.length > 0, "la política enumera las entidades permitidas");
}

H("[4] CIFRAS · el contrato con guardC no cambia");
{
  const normal = projectNarratePayload(buildNarrationContract(ARGS));
  const claimsOnly = projectClaimsOnlyPayload(buildNarrationContract(ARGS));
  ok(JSON.stringify(normal.cifras_autorizadas) === JSON.stringify(claimsOnly.cifras_autorizadas),
    `cifras_autorizadas IDÉNTICO en ambos modos — ${claimsOnly.cifras_autorizadas.length} cifras (el muro numérico no se toca)`);
  ok(normal.pregunta === claimsOnly.pregunta && normal.modo === claimsOnly.modo, "pregunta y modo se conservan");
}

H("[5] COBERTURA · varios planes reales, ninguno filtra fuente cruda");
{
  const PLANES = [
    ["ranking de margen", { intent: "answer", mode: "diagnostico", calls: [{ tool: "marginRead", args: { dimension: "cliente", focus: "bajo_benchmark" } }] }],
    ["capital por bodega", { intent: "answer", mode: "diagnostico", calls: [{ tool: "inventoryStatus", args: { focus: "frenado" } }] }],
    ["resumen del negocio", { intent: "answer", mode: "default", calls: [{ tool: "executiveSummary", args: {} }] }],
    ["tool que declina", { intent: "answer", mode: "default", calls: [{ tool: "trend", args: { metric: "resultado" } }] }],
  ];
  for (const [nombre, plan] of PLANES) {
    const r = runPlan(plan, { scenario: "actual" });
    const p = projectClaimsOnlyPayload(buildNarrationContract({ ...ARGS, plan, results: r.results, ledgerFigs: r.ledger.figs }));
    const json = JSON.stringify(p);
    const sucio = /"facts"|"datos"|"coverage"|"disponible"\s*:/.test(json);
    ok(!sucio, `${nombre}: sin fuentes crudas`, sucio ? json.slice(0, 200) : "");
  }
}

console.log(`\n── _claims_only_gate: ${PASS} PASS · ${FAIL} FAIL (de ${PASS + FAIL}) ──`);
process.exit(FAIL ? 1 : 0);
