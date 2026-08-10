/* === _entity_casing_gate.mjs · FIX: resolución case/acento-insensitive de nombres de entidad ===
 * owner en vivo 2026-07-29 (screenshot): "ventas falabella por mes" (minúscula, tal cual lo tipeó) declinó con
 * "no tengo la serie mensual... disponible a nivel global o por entidad, pero no mes a mes" — "estas son preguntas
 * simples". Root cause confirmado: historialMargen[name] / _rawRecord's String(r[key])===String(entity) hacían
 * match EXACTO — si el plan pasaba "falabella" (la casing literal del usuario, no siempre corregida por el LLM),
 * el lookup fallaba en silencio aunque el dato SÍ existe. Fix: resolveEntity/resolveEntityName en entityRecord.js
 * y temporal.js, case/acento-insensitive, ANTES de cualquier comparación exacta.
 */
import fs from "fs";
for (const ln of fs.readFileSync(".env", "utf8").split(/\r?\n/)) { const m = ln.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
import { initTenant, getTenantId } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { TENANT_EMPRESA2 } from "./src/data/tenants/empresa2.js";
import { runPlan } from "./src/adi/oracle/toolRunner.js";
import { resolveEntity, guessDimension, buildEntityRecord } from "./src/adi/oracle/entityRecord.js";
import { resolveEntityName, buildEntityEvolution } from "./src/adi/sentrix/temporal.js";

let pass = 0, fail = 0;
const ok = (cond, label) => { console.log(`  ${cond ? "✓" : "✗"} ${label}`); if (cond) pass++; else fail++; };

initTenant(TENANT_DEMO);

console.log("── 1 · resolveEntity/resolveEntityName resuelven minúscula/acento contra el canon real (demo) ──");
ok(resolveEntity("cliente", "falabella") === "Falabella", `resolveEntity(cliente, "falabella") → "${resolveEntity("cliente", "falabella")}"`);
ok(resolveEntity("cliente", "FALABELLA") === "Falabella", `resolveEntity(cliente, "FALABELLA") → "${resolveEntity("cliente", "FALABELLA")}"`);
ok(resolveEntity("familia", "linea blanca") === "Línea Blanca", `resolveEntity(familia, "linea blanca") (sin acento) → "${resolveEntity("familia", "linea blanca")}"`);
ok(resolveEntity("marca", "SAMSUNG") === "Samsung", `resolveEntity(marca, "SAMSUNG") → "${resolveEntity("marca", "SAMSUNG")}"`);
ok(resolveEntityName("falabella") === "Falabella", `resolveEntityName("falabella") (temporal.js) → "${resolveEntityName("falabella")}"`);
ok(resolveEntityName("mercado libre") === "Mercado Libre", `resolveEntityName("mercado libre") → "${resolveEntityName("mercado libre")}"`);

console.log("\n── 2 · guessDimension case-insensitive ──");
ok(guessDimension("falabella") === "cliente", `guessDimension("falabella") → "${guessDimension("falabella")}"`);
ok(guessDimension("samsung") === "marca", `guessDimension("samsung") → "${guessDimension("samsung")}"`);

console.log("\n── 3 · buildEntityRecord/entityRecord tool devuelven datos reales con minúscula, casing correcto en facts ──");
const rec = buildEntityRecord("cliente", "falabella");
ok(!!rec, "buildEntityRecord(cliente, \"falabella\") NO es null (antes del fix habría devuelto null)");
ok(!!rec && rec.facts.entidad === "Falabella", `facts.entidad muestra el nombre CANÓNICO ("${rec && rec.facts.entidad}"), no el crudo minúscula`);

console.log("\n── 4 · buildEntityEvolution (la serie mensual — el bug original exacto) con minúscula ──");
const ev = buildEntityEvolution("falabella", "venta");
ok(!!ev && Array.isArray(ev.serie) && ev.serie.length === 12, `buildEntityEvolution("falabella") devuelve la serie de 12 meses (antes: null)`);

console.log("\n── 5 · el tool trend vía runPlan (el path EXACTO del bug reportado) responde con minúscula ──");
const r = runPlan({ intent: "trend", calls: [{ tool: "trend", args: { metric: "ventas", entity: "falabella", period: "mes a mes" } }] }, { scenario: "actual" });
const res = r.results[0];
ok(res.coverage.supported === true, `tool trend(entity:"falabella") → coverage.supported=true (antes: false, "no tengo la serie mensual...")`);
ok(res.facts.entidad === "Falabella", `facts.entidad resuelto a "Falabella" en el resultado del tool`);
ok(res.facts.tablaM && res.facts.tablaM.rows.length === 13, "tabla mensual completa (12 meses + Total)");

console.log("\n── 6 · un nombre que NO existe sigue declinando honesto (no inventa un match falso) ──");
ok(resolveEntity("cliente", "Clienteinventadoxyz") === "Clienteinventadoxyz", "resolveEntity sin match devuelve el crudo tal cual (el caller declina honesto)");
const noMatch = buildEntityRecord("cliente", "Clienteinventadoxyz");
ok(noMatch === null, "buildEntityRecord con nombre inexistente sigue devolviendo null (no inventa)");

console.log("\n── 7 · comportamiento EXACTO (casing correcto) sigue idéntico — cero regresión ──");
const recExact = buildEntityRecord("cliente", "Falabella");
ok(!!recExact && recExact.facts.entidad === "Falabella", "buildEntityRecord(cliente, \"Falabella\") exacto sigue funcionando igual");

console.log("\n── 8 · MULTIEMPRESA: el resolver respeta el tenant activo — nunca cruza nombres entre empresas ──");
initTenant(TENANT_EMPRESA2);
ok(getTenantId() === "empresa2", "tenant activo = empresa2");
ok(resolveEntity("cliente", "supermercados del valle") === "Supermercados del Valle", `resolveEntity en empresa2 (minúscula) → "${resolveEntity("cliente", "supermercados del valle")}"`);
ok(resolveEntity("cliente", "falabella") === "falabella", "resolveEntity(\"falabella\") en empresa2 NO matchea nada (Falabella es del demo, no existe acá) — devuelve el crudo, declina honesto");
const rEmpresa2 = runPlan({ intent: "trend", calls: [{ tool: "trend", args: { metric: "ventas", entity: "supermercados del valle", period: "mes a mes" } }] }, { scenario: "actual" });
ok(rEmpresa2.results[0].coverage.supported === true, "trend(\"supermercados del valle\") en empresa2 también resuelve y responde");
initTenant(TENANT_DEMO);

console.log(`\n── _entity_casing_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
