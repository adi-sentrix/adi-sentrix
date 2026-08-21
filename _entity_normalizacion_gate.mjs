/* === _entity_normalizacion_gate.mjs · GATE · normalización de nombres consistente entre capas ===
 * owner 2026-07-31, auditoría (defecto "Inventario y capital inmovilizado" / "Tendencias y periodos"):
 *
 * La normalización de nombres de entidad (typos/acentos) era INCONSISTENTE entre rutas de código:
 * entityRecord.resolveEntity() y temporal.resolveEntityName() YA normalizan case+acento correctamente (confirmado
 * en este gate, sección 1) — pero specRetrieval.js _scopeRows() (usada por inventoryStatus/marginRead/
 * contributionRead/salesRead/diagnose/queryMetric para filtrar por bodega/marca/familia/cliente) hacía comparación
 * EXACTA de string ('santiago' ≠ 'Santiago') sin ninguna normalización — un capital real se reportaba falsamente
 * como inexistente solo por escribir la bodega sin acento/en minúscula.
 *
 * FIX: _scopeRows ahora normaliza (case+acento) antes de comparar, MISMO patrón `_norm` ya usado en
 * entityRecord.js/temporal.js (duplicado a propósito entre capas, convención ya establecida del repo).
 */
import fs from "fs";
for (const ln of fs.readFileSync(".env", "utf8").split(/\r?\n/)) { const m = ln.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
import { composeSpecInventory, composeSpecMargin, composeSpecContribucion, composeSpecDiagnose } from "./src/adi/specRetrieval.js";
import { resolveEntity } from "./src/adi/oracle/entityRecord.js";
import { resolveEntityName } from "./src/adi/sentrix/temporal.js";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";

// vía 1 (2026-08-20): el dataset se DECLARA acá. Antes se heredaba del import por defecto de tenantStore,
// que ya no existe: el store arranca en la forma vacía y el dato entra por initTenant. Ver tenantEmpty.js.
initTenant(TENANT_DEMO);

let pass = 0, fail = 0;
const ok = (cond, label) => { console.log(`  ${cond ? "✓" : "✗"} ${label}`); if (cond) pass++; else fail++; };

console.log("── 0 · CONFIRMACIÓN — entityRecord/temporal YA normalizan case+acento (no son la parte a arreglar) ──");
{
  ok(resolveEntity("cliente", "sodimac") === "Sodimac", `entityRecord.resolveEntity("sodimac") → "Sodimac" — obtuvo "${resolveEntity("cliente", "sodimac")}"`);
  ok(resolveEntityName("lider") === "Lider", `temporal.resolveEntityName("lider") → "Lider" — obtuvo "${resolveEntityName("lider")}"`);
}

console.log('\n── 1 · EL CASO EXACTO DEL HALLAZGO: inventoryStatus con bodega en minúscula (capital $25K real) ──');
{
  const conCaseCorrecto = composeSpecInventory({ filters: { bodega: "Santiago" }, scenario: "actual", focus: "frenado" });
  const conMinuscula = composeSpecInventory({ filters: { bodega: "santiago" }, scenario: "actual", focus: "frenado" });
  const conMayuscula = composeSpecInventory({ filters: { bodega: "SANTIAGO" }, scenario: "actual", focus: "frenado" });
  ok(!!conCaseCorrecto, `bodega="Santiago" (case correcto) responde — control, confirma que el dato SÍ existe (${!!conCaseCorrecto})`);
  ok(!!conMinuscula, `bodega="santiago" (minúscula) YA responde igual (antes: null, "no hay señal de inventario") — obtuvo ${!!conMinuscula ? "responde" : "null"}`);
  ok(!!conMayuscula, `bodega="SANTIAGO" (mayúscula) YA responde igual — obtuvo ${!!conMayuscula ? "responde" : "null"}`);
  ok(!conCaseCorrecto || !conMinuscula || conCaseCorrecto.evidence.boleta.length === conMinuscula.evidence.boleta.length, "misma cantidad de figuras autorizadas sin importar el case (mismo resultado real)");
}

console.log("\n── 2 · marginRead/contributionRead/diagnose: mismo fix, filtro por cliente sin acento/case ──");
{
  const r1 = composeSpecMargin({ filters: { cliente: "sodimac" }, scenario: "actual", dimension: "cliente" });
  ok(!!r1, `marginRead filters.cliente="sodimac" (minúscula) responde — obtuvo ${!!r1 ? "responde" : "null"}`);
  const r2 = composeSpecContribucion({ filters: { cliente: "SODIMAC" }, scenario: "actual", dimension: "cliente" });
  ok(!!r2, `contributionRead filters.cliente="SODIMAC" (mayúscula) responde — obtuvo ${!!r2 ? "responde" : "null"}`);
  const r3 = composeSpecDiagnose({ filters: { cliente: "sodimac" }, scenario: "actual" });
  ok(r3 !== undefined, `diagnose filters.cliente="sodimac" no rompe (responde algo o null honesto, nunca undefined/crash) — obtuvo ${r3 === null ? "null (honesto, sin focos)" : "responde"}`);
}

console.log("\n── 3 · REGRESIÓN — un nombre que NO existe (ni normalizado) sigue sin matchear nada ──");
{
  const r = composeSpecInventory({ filters: { bodega: "BodegaQueNoExiste9999" }, scenario: "actual", focus: "frenado" });
  ok(!r || (r.evidence && (!r.evidence.boleta || !r.evidence.boleta.length)) || r === null, `una bodega inexistente sigue sin traer resultados falsos — obtuvo ${JSON.stringify(r && r.evidence && r.evidence.boleta)}`);
}

console.log("\n── 4 · REGRESIÓN — filtros SIN typo/case (el camino normal) siguen funcionando exactamente igual ──");
{
  const r = composeSpecMargin({ filters: { cliente: "Sodimac" }, scenario: "actual", dimension: "cliente" });
  ok(!!r && r.evidence && r.evidence.margin, `filtro ya bien escrito ("Sodimac") sigue respondiendo igual que siempre — obtuvo ${!!r}`);
}

console.log(`\n── _entity_normalizacion_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
