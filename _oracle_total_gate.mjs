/* === _oracle_total_gate.mjs · ARQUITECTURA C · GATE DE ATRIBUCIÓN TOTAL-VS-SUBCONJUNTO (owner 2026-07-28) ===
 * "El error es peligroso porque cambia el tamaño real de la oportunidad — pediría un guard determinístico que
 * bloquee frases donde una cifra total aparece atribuida a una entidad individual." Repro real: "Lider y Falabella
 * representan una brecha total de $4.9M" cuando $4.9M es el total de 8 clientes (~$3.1M real para esos 2).
 *
 * Corre guardC._totalMisattribution (vía guardC(), no exportada aparte) contra un ledger REAL (marginRead/diagnose
 * sobre el escenario actual) con textos MALOS (total colgado de 1-2 entidades con verbo de equivalencia) y BUENOS
 * (total escalado al grupo completo, marco "parte de", o sin verbo de equivalencia cerca). Determinístico · sin LLM
 * en el chequeo mismo (el ledger es real, los textos son fijos) → exit 1 si algún caso no da el veredicto esperado.
 */
import { runPlan } from "./src/adi/oracle/toolRunner.js";
import { guardC } from "./src/adi/oracle/guardC.js";
import { fig } from "./src/adi/boleta.js";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";

// vía 1 (2026-08-20): el dataset se DECLARA acá. Antes se heredaba del import por defecto de tenantStore,
// que ya no existe: el store arranca en la forma vacía y el dato entra por initTenant. Ver tenantEmpty.js.
initTenant(TENANT_DEMO);
const SC = "actual";

const marginLedger = runPlan({ intent: "answer", calls: [{ tool: "marginRead", args: { dimension: "cliente", focus: "bajo_benchmark" } }] }, { scenario: SC });
const diagLedger = runPlan({ intent: "answer", calls: [{ tool: "diagnose", args: {} }] }, { scenario: SC });
// ledger sintético (mismo fig() real) con UN figura unit:"days" propia de "Lider" — reproduce el bug de canon
// (barrido adversarial 2026-07-28): ledger.js guarda "94d", pero la prosa natural narra "94 días" — sin canon,
// _stripSpace("94d") ≠ _stripSpace("94 días") y el guard veía la cifra como "sin dueño" pese a tenerlo.
const marginLedgerConDias = { ...marginLedger, ledger: { ...marginLedger.ledger, figs: [...marginLedger.ledger.figs, fig("Lider · dias sin resolver", "94d", { unit: "days", raw: 94 })] } };

const CASES = [
  { ledger: marginLedger, q: "¿Qué clientes ceden más margen?", label: "MALO · total colgado de 1 solo cliente",
    text: "Deberías empezar por ajustar las condiciones comerciales con Lider, que resulta en una recuperación estimada de $5.7M en total al cerrar esta brecha.", expect: true },
  { ledger: marginLedger, q: "¿Qué clientes ceden más margen?", label: "MALO · la frase original del owner (2 entidades)",
    text: "Lider y Falabella representan una brecha total de $4.9M respecto al benchmark.", expect: true },
  { ledger: diagLedger, q: "¿Dónde pierdo plata?", label: "MALO · subtotal de diagnose colgado de 1 cliente",
    text: "El foco principal es Falabella, que genera $5.7M en contribución no capturada que hay que corregir ya.", expect: true },
  { ledger: marginLedger, q: "¿Qué clientes ceden más margen?", label: "BUENO · total escalado al grupo completo",
    text: "Estos clientes están por debajo del benchmark de margen del 30.1%, y representan una brecha total de $5.7M. Considerá con prioridad revisar las condiciones comerciales con Lider.", expect: false },
  { ledger: marginLedger, q: "¿Qué clientes ceden más margen?", label: "BUENO · marco explícito 'parte de'",
    text: "Empezá por Lider, que cede 8.6 puntos de margen. Es parte de una brecha total del negocio de $5.7M.", expect: false },
  { ledger: marginLedger, q: "¿Qué clientes ceden más margen?", label: "BUENO · cifra propia sin verbo de equivalencia",
    text: "Lider tiene un margen de 21.5%, 8.6 puntos bajo el benchmark de 30.1%. El total del negocio bajo benchmark es $5.7M.", expect: false },
  { ledger: marginLedger, q: "¿Cómo viene el margen de Falabella?", label: "BUENO · una sola entidad en juego (atribuirle el total ES correcto)",
    text: "Falabella tiene un margen de 22%, 8.1 puntos bajo el benchmark de 30.1%.", expect: false },
  // ── 4 casos agregados tras el barrido adversarial (owner-audit 2026-07-28) — cada uno reproduce un bug REAL
  // encontrado por verificación propia del agente síntesis (no solo relato de campo), no solo hipótesis ──
  { ledger: marginLedgerConDias, q: "¿Qué pasa con Lider?", label: "BUENO · cifra 'days' propia narrada en prosa (bug de canon, antes fallaba)",
    text: "Lider, que representa 94 días sin resolver la brecha, es la prioridad de este trimestre.", expect: false },
  { ledger: marginLedger, q: "¿Qué clientes ceden más margen?", label: "BUENO · verbo+entidad en la ORACIÓN SIGUIENTE (bleed-over lineal, antes fallaba)",
    text: "La brecha total del negocio es de $5.7M. Lider representa la prioridad para este trimestre.", expect: false },
  { ledger: marginLedger, q: "¿Qué clientes ceden más margen?", label: "MALO · verbo en GERUNDIO (antes no matcheaba, falso negativo)",
    text: "Falabella y Lider vienen representando la recuperación total de $5.7M este trimestre.", expect: true },
  { ledger: marginLedger, q: "¿Qué clientes ceden más margen?", label: "BUENO · verbo de equivalencia + excepción 'parte del total' explícita en la MISMA frase",
    text: "Lider representa una parte del total de $5.7M en brecha de margen este trimestre.", expect: false },
];

let pass = 0, fail = 0;
for (const c of CASES) {
  const g = guardC(c.text, { ledger: c.ledger.ledger, results: c.ledger.results, trace: c.ledger.trace, question: c.q });
  const got = g.violations.some((v) => v.kind === "total-mal-atribuido");
  const ok = got === c.expect;
  console.log(`  ${ok ? "✓" : "✗"} ${c.label} → esperaba ${c.expect ? "VIOLACIÓN" : "limpio"}, obtuvo ${got ? "VIOLACIÓN" : "limpio"}`);
  if (!ok) console.log(`      detail: ${JSON.stringify(g.violations.filter((v) => v.kind === "total-mal-atribuido"))}`);
  if (ok) pass++; else fail++;
}
console.log(`\n── _oracle_total_gate: ${pass} PASS · ${fail} FAIL (de ${CASES.length}) ──`);
process.exit(fail ? 1 : 0);
