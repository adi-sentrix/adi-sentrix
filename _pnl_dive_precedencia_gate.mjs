/* === _pnl_dive_precedencia_gate.mjs · GATE · "dive" de LLM#1 NO pisa la continuidad P&L cuando el hilo P&L está vivo ===
 * owner 2026-07-31, auditoría (defecto "P&L del pipeline antiguo", alto_riesgo):
 *
 * coerceSpec (coerceChain.js) solo invocaba la red determinística de continuidad P&L (detectPnlEllipsis) cuando el
 * `operation` clasificado por LLM#1 NO había llegado ya "resuelto" a otro valor. En un seguimiento elíptico tras
 * una lectura P&L ("¿Y Lider?"), si LLM#1 clasificaba erróneamente ese turno como operation="dive" (una
 * clasificación GENÉRICA, válida para cualquier dominio), la red de continuidad P&L nunca se ejecutaba y el turno
 * perdía el dominio P&L por completo — entregando un perfil de margen/crecimiento genérico en vez del "resultado
 * después de gastos" que el usuario seguía pidiendo. Reproducido 1/3 corridas idénticas (bootstrap y seed iguales).
 *
 * FIX: coerceChain.js — cuando pnlScope() está activo (P&L en curso) y operation="dive" (la clasificación MÁS
 * débil/genérica, a diferencia de margin/contribucion/ventas que sí son señal fuerte de otro dominio), NO se
 * trata como "resuelto": detectPnlEllipsis corre igual y su resultado (si matchea) gana.
 */
import fs from "fs";
for (const ln of fs.readFileSync(".env", "utf8").split(/\r?\n/)) { const m = ln.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
import { clearPnl, resetPnlDraft, setPnlLines, composePnl, pnlScope } from "./src/adi/pnl.js";
import { coerceSpec } from "./src/adi/coerceChain.js";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";

// vía 1 (2026-08-20): el dataset se DECLARA acá. Antes se heredaba del import por defecto de tenantStore,
// que ya no existe: el store arranca en la forma vacía y el dato entra por initTenant. Ver tenantEmpty.js.
initTenant(TENANT_DEMO);

let pass = 0, fail = 0;
const ok = (cond, label) => { console.log(`  ${cond ? "✓" : "✗"} ${label}`); if (cond) pass++; else fail++; };

function establecerHiloPnl() {
  clearPnl(); resetPnlDraft();
  setPnlLines([{ nombre: "Administrativos", pct: 1 }, { nombre: "Logistica", pct: 3 }]);
  composePnl({ action: "resultado" }, null, { scenario: "actual" });   // deja pnlScope() activo (hilo P&L vivo)
}

console.log('── 1 · EL CASO EXACTO DEL HALLAZGO: "¿Y Lider?" clasificado operation="dive" por LLM#1, hilo P&L vivo ──');
{
  establecerHiloPnl();
  ok(!!pnlScope(), `pnlScope() está activo tras la lectura de resultado — obtuvo ${JSON.stringify(pnlScope())}`);
  const spec = { schemaVersion: 1, scenario: "actual", operation: "dive", metric: null, dimension: "cliente", entity: "Lider" };
  const out = coerceSpec("¿Y Lider?", spec, true, null);
  ok(out.turn_type === "pnl_setup" && out.pnl && out.pnl.action === "resultado_scoped" && out.pnl.entidad === "Lider", `"dive" NO gana — coerceSpec resuelve la continuidad P&L (resultado_scoped de Lider) — obtuvo ${JSON.stringify(out)}`);
}

console.log('\n── 2 · REGRESIÓN — "dive" SIN hilo P&L vivo sigue siendo "resuelto" (comportamiento intacto) ──');
{
  clearPnl(); resetPnlDraft();   // sin líneas declaradas → pnlScope() null
  ok(!pnlScope(), "pnlScope() está inactivo (sin P&L declarado)");
  const spec = { schemaVersion: 1, scenario: "actual", operation: "dive", metric: null, dimension: "cliente", entity: "Lider" };
  const out = coerceSpec("¿Y Lider?", spec, true, null);
  ok(out.operation === "dive" && out.turn_type !== "pnl_setup", `SIN hilo P&L vivo, "dive" sigue intacto (no se fuerza P&L de la nada) — obtuvo operation=${out.operation}, turn_type=${out.turn_type}`);
}

console.log('\n── 3 · REGRESIÓN — clasificaciones MÁS específicas (margin) siguen ganando IGUAL, aun con hilo P&L vivo ──');
{
  establecerHiloPnl();
  const spec = { schemaVersion: 1, scenario: "actual", operation: "margin", metric: "margen", dimension: "cliente", entity: "Lider" };
  const out = coerceSpec("¿Y el margen de Lider?", spec, true, null);
  ok(out.operation === "margin" && out.turn_type !== "pnl_setup", `"margin" (clasificación específica y fuerte) sigue ganando aunque el P&L esté vivo — obtuvo operation=${out.operation}, turn_type=${out.turn_type}`);
}

console.log('\n── 4 · REGRESIÓN — "dive" con hilo P&L vivo pero SIN patrón elíptico real → detectPnlEllipsis no matchea, "dive" se conserva ──');
{
  establecerHiloPnl();
  const spec = { schemaVersion: 1, scenario: "actual", operation: "dive", metric: null, dimension: "cliente", entity: "Falabella" };
  const out = coerceSpec("cuéntame sobre el desempeño general de Falabella este año", spec, true, null);
  ok(out.turn_type !== "pnl_setup", `sin el patrón elíptico corto ("¿y el de X?"), detectPnlEllipsis no matchea y "dive" se conserva — obtuvo turn_type=${out.turn_type}, operation=${out.operation}`);
}

console.log(`\n── _pnl_dive_precedencia_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
