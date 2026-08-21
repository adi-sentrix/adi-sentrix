/* === _pnl_negacion_gate.mjs · GATE · _pnlEntityEn (pnl.js) respeta la NEGACIÓN, no solo el substring más largo ===
 * owner 2026-07-31, auditoría (defecto "P&L del pipeline antiguo" — mayor severidad conceptual de la auditoría):
 *
 * _pnlEntityEn recorría el canon de nombres ordenado por LARGO de string descendente y devolvía la PRIMERA
 * coincidencia de substring en el texto — sin ningún arbitraje de negación ni de posición. En "no, el de Lider,
 * no el de Falabella", "Falabella" (9 caracteres) le ganaba siempre a "Lider" (5 caracteres) aunque el texto
 * niegue explícitamente a Falabella — el turno de corrección respondía con la entidad NEGADA, violando
 * directamente "la corrección nueva siempre prevalece sobre la memoria".
 *
 * Confirmado por lectura de código Y por ejecución real: detectPnlIntent({action:"resultado_scoped"}) quedaba con
 * entidad:"Falabella" en el turno de corrección.
 *
 * FIX (pnl.js): _pnlEntityEn ahora colecta TODAS las menciones (mismo orden de especificidad de siempre) y
 * prefiere la primera NO NEGADA — _isNegatedMention detecta "no X"/"no el de X"/"no es X" (sin coma pegada a "no",
 * que se excluye por ser un marcador de discurso/apertura de corrección, no una negación).
 */
import fs from "fs";
for (const ln of fs.readFileSync(".env", "utf8").split(/\r?\n/)) { const m = ln.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
import { detectPnlIntent, detectPnlEllipsis, resetPnlDraft } from "./src/adi/pnl.js";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";

// vía 1 (2026-08-20): el dataset se DECLARA acá. Antes se heredaba del import por defecto de tenantStore,
// que ya no existe: el store arranca en la forma vacía y el dato entra por initTenant. Ver tenantEmpty.js.
initTenant(TENANT_DEMO);

let pass = 0, fail = 0;
const ok = (cond, label) => { console.log(`  ${cond ? "✓" : "✗"} ${label}`); if (cond) pass++; else fail++; };

console.log("── 1 · EL CASO EXACTO DEL HALLAZGO: \"no, el de Lider, no el de Falabella\" (P&L) ──");
{
  resetPnlDraft();
  const r = detectPnlIntent("No, el P&L de Lider, no el de Falabella.");
  ok(!!r && r.action === "resultado_scoped", `detectPnlIntent devuelve resultado_scoped (obtuvo: ${JSON.stringify(r)})`);
  ok(!!r && r.entidad === "Lider", `la entidad resuelta es "Lider" (la NO negada), NO "Falabella" (la negada) — obtuvo entidad="${r && r.entidad}"`);
}

console.log("\n── 2 · orden inverso: negar la PRIMERA mencionada (la más larga del canon), aceptar la SEGUNDA ──");
{
  resetPnlDraft();
  const r = detectPnlIntent("No el de Falabella, quiero el P&L de Lider.");
  ok(!!r && r.entidad === "Lider", `"No el de Falabella, quiero el P&L de Lider" → resuelve Lider (Falabella, la más larga del canon, quedó negada) — obtuvo entidad="${r && r.entidad}"`);
}

console.log("\n── 3 · REGRESIÓN — sin negación, sigue ganando la MÁS ESPECÍFICA/única mencionada ──");
{
  resetPnlDraft();
  const r = detectPnlIntent("¿Cómo viene el P&L de Falabella?");
  ok(!!r && r.entidad === "Falabella", `sin negación, "P&L de Falabella" sigue resolviendo Falabella — obtuvo entidad="${r && r.entidad}"`);
}

console.log('\n── 4 · REGRESIÓN — un "no" NO adyacente a la entidad (otra cláusula, "no tienes") NO la niega falsamente ──');
{
  resetPnlDraft();
  // "no tienes" — el "no" precede a un VERBO, no a la entidad con solo artículo/de/es de por medio: no debe
  // tratarse como negación de Falabella (que sigue siendo la única entidad nombrada, sin alternativa).
  const r = detectPnlIntent("El P&L de Falabella, ¿no tienes los datos?");
  ok(!!r && r.entidad === "Falabella", `"no tienes" (verbo, no adyacente al nombre) no niega Falabella falsamente — obtuvo ${JSON.stringify(r)}`);
}

console.log(`\n── _pnl_negacion_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
