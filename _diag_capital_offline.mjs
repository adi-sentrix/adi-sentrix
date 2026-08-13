/* === _diag_capital_offline.mjs · Diagnóstico OFFLINE del turno «¿Cuánto capital tengo inmovilizado en
 * inventario?» (captura del owner 2026-08-14, salió airbag en prod). CERO red, CERO .env: plan sintético +
 * borradores tipo-Sonnet pasados por el pipeline real (answerViaOracle con callbacks locales). El objetivo es
 * adjudicar: ¿el muro veta un borrador razonable (bug nuestro) o un borrador razonable pasa (el corte fue del
 * reloj / de otra cosa)? */
import { answerViaOracle } from "./src/adi/oracle/answerViaOracle.js";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
initTenant(TENANT_DEMO);

const Q = "¿Cuánto capital tengo inmovilizado en inventario?";
const PLAN = { intent: "answer", mode: "default", calls: [{ tool: "inventoryStatus", args: { focus: "detenido" } }] };

// Borradores a juzgar — del más natural al más seco. Cifras = las del demo (visibles en la captura del airbag).
const BORRADORES = [
  ["natural con tabla", `Tienes $33K de capital inmovilizado en inventario (foto de hoy), concentrado en dos bodegas:

| Bodega | Capital | % del total |
|---|---|---|
| Valparaíso | $25K | 75% |
| Antofagasta | $8K | 25% |

Por familia, Materiales de Construcción concentra $20K y Línea Blanca $14K.

El dato no registra la causa de la detención — la bodega localiza dónde está el capital, pero no explica por qué se detuvo. Empieza por Valparaíso: concentra el 75% del total, y la decisión sobre sus SKU inmovilizados (liquidar, promocionar o devolver) es la que más capital libera.

¿Quieres que baje al detalle de los SKU inmovilizados de Valparaíso?`],
  ["breve sin familias", `Tienes $33K de capital inmovilizado en inventario, en la foto de hoy. Valparaíso concentra $25K (75% del total) y Antofagasta $8K (25%). El dato no registra la causa de la detención. Empieza por Valparaíso, que concentra tres cuartos del capital.`],
];

for (const [nombre, draft] of BORRADORES) {
  let figsVistas = null;
  const out = await answerViaOracle({
    text: Q, history: [], mem: {}, scenario: "actual",
    callPlan: async () => PLAN,
    callNarrate: async (args) => { figsVistas = (args.ledgerFigs || []).map((f) => `${f.label} = ${f.value}`); return draft; },
  });
  console.log(`\n══ BORRADOR «${nombre}»`);
  if (figsVistas) console.log(`boleta del turno:\n  ${figsVistas.join("\n  ")}`);
  const nt = out && out.r.retryTrace && out.r.retryTrace.narrate;
  if (nt) for (const t of nt) console.log(`guard[${t.attempt}]: ok=${t.guardOk} · ${t.reason || "fiel"}${t.detalle ? " · " + t.detalle.join(" | ") : ""}${t.reparado ? " · REPARADO: " + t.reparado : ""}`);
  console.log(`det=${!!out.r.deterministic} · rep=${!!out.r.narrationRepaired}`);
  console.log(`TEXTO FINAL ▸ ${String(out.r.text || "").slice(0, 400)}`);
}
